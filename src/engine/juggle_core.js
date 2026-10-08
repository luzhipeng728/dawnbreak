/* =====================================================================
   10a. 刷图浮空保护核心（纯逻辑）：连招会话 + 一级 / 二级保护 + 倒地追击额度（docs/COMBAT_JUGGLE.md §5）
   ---------------------------------------------------------------------
   - 不碰 DOM / 游戏全局 / 时钟：只读写传进来的会话对象 S 和参数表 P，Node 里可以直接用 node:vm 加载测（test/juggle_core.mjs）
   - 浏览器：按 src/ORDER 拼进同一个脚本，对外的全局名只有 JUGGLE_PROT、JUGGLE_CORE（const：重名会直接报语法错，不会静默覆盖）
   - 只管刷图（怪物、地下城里的玩家）；决斗另有一套按 HP% 算的保护（src/game/duel.js、docs/PVP.md），不走这里
   官方口径（调研见 docs/COMBAT_JUGGLE.md §1）：
     没有固定的浮空时限；保护线之前怎么连都一样（下落速度不变、再挑不递减）；
     过了一级保护越来越沉（下落加快、挑空 / 接住变弱）；过了二级保护挑不起来、直接往下掉；
     倒地追击（打地 / 扫地）越打托得越低，额度用完强制起身 + 短暂无敌；起身后保护全部清零，下一套从头算
   会话 S（纯 JSON，挂在目标的 t.js 上）：
     phase  'stand' 站着挨打 → 'air' 被挑起 → 'ground' 第一次落地后（倒地 / 打地小浮空 / 弹地）→ 'air2' 倒地后被重新挑成正常浮空
     pts    浮空点数（被挑起之后才累计；站着挨打不算）  lv 0 自由段 / 1 一级保护 / 2 二级保护
     launches 本套挑空次数  otg 已用的追击次数（按“一招”算）  otgKey / otgSeg 当前这招的标识 / 段数  otgSegs 本套追击总段数  fb 强制弹地次数
   ===================================================================== */
// 浮空保护参数表：common 是公共值，normal / elite / boss 只写不一样的；怪物定义里写 juggle: { p1, p2, ... } 可以单独覆盖
// 点数（pt）：普通空中受击 1、rep 多段每段 0.5、挑空 3、击倒 2、砸地 1、追击每段 0.5；技能的命中判定写 jp 直接指定这一下的点数
// 阈值按 ÷ 重量^wExp 缩放（越重越早进保护）
const JUGGLE_PROT = {
  common: {
    pt: { hit: 1, rep: 0.5, launch: 3, down: 2, spike: 1, otg: 0.5 },
    wExp: 0.5,
    lv1: { grav: 1.6, gravRamp: 0.9, launch: 0.6, catch: 0.6 },   // 一级：重力 ×1.6，往二级走的过程中再线性加到 ×2.5；挑空 ×0.6、空中接住 ×0.6
    lv2: { grav: 3, launch: 0, catch: 0 },                         // 二级：挑不起来（挑空按普通空中受击算）、接不住、重力 ×3，进二级那一下直接开始下落
    otgMax: 4,          // 倒地追击最多 4 招（按一次出招 / 一个投射物算，不按段数）；第 5 招打到 → 强制起身 + 无敌
    otgSegMax: 10,      // 同一招最多托起 10 段，之后只扣血不托（防止一招无限按在地上）
    otgLiftStep: 0.07, otgLiftMin: 0.35,   // 追击托起高度：本套每多一段追击 −7%，最低 35%（官方“越打托得越低，最后只在地上抽动”）
    otgKeep: 0.25,      // 被追击托起、落回地面后，倒地时间只保证还剩 ≥0.25 秒（不再整段重置）
    otgInvul: 0.7,      // 追击额度用完强制起身的无敌时间
    bounceMax: 2,       // 一套里技能强制弹地（bounce）最多 2 次（防止“砸—弹—砸”无限循环）；自然弹地另算，每次浮空最多一次
  },
  normal: { p1: 60, p2: 108 },   // 普通怪：官方没有浮空保护，这里给一个很高的线，正常连招碰不到，只防止真正的无限浮空
  elite: { p1: 40, p2: 72 },     // 精英 / 冠军
  boss: { p1: 22, p2: 40 },      // 领主：官方对领主、APC 有重力保护
};
const JUGGLE_CORE = (() => {
  const P0 = JUGGLE_PROT;
  // 合并参数：common ← 档位（normal / elite / boss）← 单个怪物的覆盖
  function profile(kind, over) {
    const c = P0.common, k = P0[kind] || P0.normal, o = over || {};
    return { ...c, ...k, ...o, pt: { ...c.pt, ...(k.pt || {}), ...(o.pt || {}) }, lv1: { ...c.lv1, ...(k.lv1 || {}), ...(o.lv1 || {}) }, lv2: { ...c.lv2, ...(k.lv2 || {}), ...(o.lv2 || {}) } };
  }
  const session = () => ({ phase: 'stand', pts: 0, lv: 0, launches: 0, otg: 0, otgKey: null, otgSeg: 0, otgSegs: 0, fb: 0 });
  const wk = (P, w) => Math.pow(Math.max(1, w || 1), P.wExp);
  const p1Of = (P, w) => P.p1 / wk(P, w), p2Of = (P, w) => P.p2 / wk(P, w);
  function level(S, P, w) { return S.pts >= p2Of(P, w) ? 2 : S.pts >= p1Of(P, w) ? 1 : 0; }
  // 一次受击：info = { kind: 'launch' | 'air' | 'down' | 'spike' | 'stand' | 'otg', rep, jp, w, ground }
  // 返回 { lv, up（这一下升了级）, canLaunch, launchK, catchK }
  function hit(S, P, info) {
    const kind = info.kind;
    if (S.phase === 'stand' && (kind === 'launch' || kind === 'down' || kind === 'spike')) S.phase = 'air';
    else if (info.ground && kind === 'launch') S.phase = 'air2';
    if (S.phase !== 'stand' && kind !== 'stand') {
      const pt = P.pt, d = info.jp !== undefined ? info.jp : kind === 'launch' ? pt.launch : kind === 'down' ? pt.down : kind === 'spike' ? pt.spike : kind === 'otg' ? pt.otg : info.rep ? pt.rep : pt.hit;
      S.pts += Math.max(0, +d || 0);
    }
    const lv0 = S.lv; S.lv = Math.max(S.lv, level(S, P, info.w));
    if (kind === 'launch') S.launches++;
    return { lv: S.lv, up: S.lv > lv0, ...mods(S, P, info.w) };
  }
  // 当前保护等级下的倍率：launchK 挑空力、catchK 空中接住力度（0..1）、canLaunch 还能不能挑
  function mods(S, P) {
    if (S.lv >= 2) return { canLaunch: P.lv2.launch > 0, launchK: P.lv2.launch, catchK: P.lv2.catch };
    if (S.lv === 1) return { canLaunch: true, launchK: P.lv1.launch, catchK: P.lv1.catch };
    return { canLaunch: true, launchK: 1, catchK: 1 };
  }
  // 浮空重力倍率：自由段 ×1（官方：保护线之前下落速度都一样）；一级 ×1.6 起，越接近二级越重；二级 ×3
  function grav(S, P, w) {
    if (!S || !S.lv) return 1;
    if (S.lv >= 2) return P.lv2.grav;
    const a = p1Of(P, w), b = p2Of(P, w), f = b > a ? Math.min(1, Math.max(0, (S.pts - a) / (b - a))) : 1;
    return P.lv1.grav + P.lv1.gravRamp * f;
  }
  // 落地进入倒地：进入 ground 阶段（站着被击倒也一样）
  function land(S) { S.phase = 'ground'; }
  // 倒地追击：key = 这一招的标识（同一次出招 / 同一个投射物相同；null = 每下都算新的一招）
  // 返回 { act: 'getup' 强制起身 | 'pop' 托起 | 'dmg' 只扣血, liftK 托起高度倍率 }
  function otg(S, P, key) {
    if (key === null || key === undefined || key !== S.otgKey) { S.otg++; S.otgKey = key ?? null; S.otgSeg = 0; if (S.otg > P.otgMax) return { act: 'getup', liftK: 0 }; }
    S.otgSeg++;
    if (S.otgSeg > P.otgSegMax) return { act: 'dmg', liftK: 0 };
    const liftK = Math.max(P.otgLiftMin, 1 - P.otgLiftStep * S.otgSegs); S.otgSegs++;
    return { act: 'pop', liftK };
  }
  // 技能强制弹地：本套还没用满 bounceMax 次 → true（并记一次）
  function bounce(S, P) { if (S.fb >= P.bounceMax) return false; S.fb++; return true; }
  return { profile, session, level, hit, mods, grav, land, otg, bounce, p1Of, p2Of };
})();
