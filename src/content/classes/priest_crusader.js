/* =====================================================================
   圣职者转职：圣骑士（男，crusader，技能前缀 pc_）—— 转职技能（官方 Lv15~45 → 本作 15~20）；觉醒三段见 priest_crusader_p1.js
   官方现版（namu 크루세이더(던전앤파이터)/남자/스킬 2026-08、wiki.dfo.world 各技能页、国服官网 2020 三觉专题）；逐技能对照 docs/skills/priest_crusader_final.md
   两条路线（官方 2025-12 起「守护恩赐 / 勇气恩赐」互斥）：本作 = 开关型被动（技能窗口里的「开启 / 关闭 守护路线」，和萨亚冰冻一样的 switchOpt）
   - 战斗路线（默认）：勇气恩赐 + 圣灵之槌（换普攻、技能攻击 / 全速度提高）；天启之珠冷却 135 秒、不给队友祝福；守护系技能放不出
   - 守护路线（纯辅助）：守护徽章 / 荣誉祝福 / 圣光守护 / 生命源泉（免死复活）/ 圣愈之风 / 快速愈合 / 灵魂牺牲 / 冥想 / 信念光环 / 神圣洗礼；
     队伍效果走 net/party_sync.js：partyCast('buff' | 'shield' | 'heal' | 'cleanse')，单体用 d.to；单刷时守护恩赐给独立攻击力 + 冷却缩减（官方单刷专用效果）
   攻击技能大多是光属性独立攻击（官方「마법 독립 공격」）；基础技能（空斩打 / 虎袭 / 直拳冲击……）在圣骑士下也按独立攻击算（PRIEST_HOOKS.mod）
   动作：精灵帧用 P-art 的 pc_raise / pc_heal / pc_wall / pc_spear1~2 / pc_hammer1~2 / pc_judge + 基础帧（docs/PRIEST_ART.md §7，PC_ANIMS）；CLIPS.priest.pc* 是矢量模型用的同名片段
   ===================================================================== */
const PCJ = 'crusader';
const PC_COL = { holy: '#ffe38a', light: '#fff4c0', white: '#fffaf0', blue: '#9fd8ff', heal: '#8ff0b0', gold: '#ffd24a', bolt: '#fff38a', guard: '#a8d8ff' };
const pcOn = p => !!p && p.cls === 'priest' && jobOf(p) === PCJ;
const pcOpts = () => typeof save !== 'undefined' && save.data ? (save.data.opts ??= {}) : null;
// 路线：守护恩赐学了且开启 = 守护路线；否则战斗路线。AI / 决斗格斗者读 kit.pcGuard（默认战斗）
function pcGuard(p) {
  if (!pcOn(p) || !(skLv(p, 'pc_guard') > 0)) return false;
  if (p.pcRoute) return p.pcRoute === 'guard';   // 体检用（skillaudit 规格的 set）
  if (!isHuman(p)) return !!(p.kit && p.kit.pcGuard);
  const O = pcOpts(); return !(O && O.swOff && O.swOff.pc_guard);
}
const pcBattle = p => pcOn(p) && !pcGuard(p);
const pcNeedGuard = p => pcGuard(p) || '需要开启守护恩赐（守护路线）';
const pcNeedBattle = p => !pcGuard(p) || '守护路线下不能用（勇气恩赐专用）';
const pcPad = p => p.pad || { dx: () => 0, dy: () => 0, is: () => false, buffered: () => false, consume: () => {} };
const pcMovable = t => !t.boss && !(hasSA(t) && t.st !== 'hit' && t.st !== 'air');

/* ---- 队伍目标：自己 + 同房间 r 以内的队友影子；AI / 决斗格斗者只有自己 ---- */
function pcMembers(e, r) { return e === game.player ? partyOf(e, r) : [e]; }
const pcUid = (e, t) => t === e ? partyMyUid() : t.uid;
function pcGive(e, t, kind, d) { partyCast(kind, { ...d, to: pcUid(e, t) }, e); }
// 官方“选择一名队员”：本作自动挑 r 以内 HP 比例最低的（self = false 时不含自己）
function pcPickMate(e, r, self = true) {
  let best = null;
  for (const t of pcMembers(e, r)) if ((self || t !== e) && (!best || t.hp / Math.max(1, t.hpMax) < best.hp / Math.max(1, best.hpMax))) best = t;
  return best;
}

/* ---- 矢量占位的姿势 / 片段 ---- */
POSE.pcRaise = P(POSE.idle, { torso: 6, head: -12, uaF: 168, faF: 8, wF: 30, uaB: 150, faB: 20 });
POSE.pcHeal = P(POSE.idle, { torso: -6, head: 2, uaF: 112, faF: -12, wF: -60, uaB: 100, faB: 8 });
POSE.pcPush = P(POSE.dashS, { uaF: 96, faF: -6, wF: -90, uaB: 84, faB: 6 });
POSE.pcThrowW = P(POSE.idle, { torso: 14, head: -8, uaF: -150, faF: 40, wF: 60, uaB: 60, faB: 40, thF: 40, shF: -40, thB: -30 });
POSE.pcThrow = P(POSE.dashS, { uaF: 100, faF: -8, wF: -80, uaB: -70, faB: 30 });
POSE.pcKneel = P(POSE.getup, { uaF: 60, faF: 90, uaB: 50, faB: 100 });
Object.assign(CLIPS.priest, {
  pcRaise: { dur: 0.6, keys: [k(0, POSE.crouch, 'hold'), k(0.15, POSE.pcRaise, 'out'), k(0.6, POSE.pcRaise)] },
  pcHeal: { dur: 0.5, keys: [k(0, POSE.fSeal, 'hold'), k(0.12, POSE.pcHeal, 'out'), k(0.5, POSE.pcHeal)] },
  pcWall: { dur: 0.5, keys: [k(0, POSE.fJabW, 'hold'), k(0.1, POSE.pcPush, 'out'), k(0.5, POSE.pcPush)] },
  pcThrow: { dur: 0.5, keys: [k(0, POSE.pcThrowW, 'hold'), k(0.12, POSE.pcThrow, 'out'), k(0.5, POSE.pcThrow)] },
  pcAim: { dur: 0.4, keys: [k(0, POSE.pcThrowW)] },
  pcHammer: { dur: 0.6, keys: [k(0, POSE.a3w, 'hold'), k(0.18, POSE.a3s, 'out'), k(0.6, POSE.a3r)] },
  pcKneel: { dur: 0.6, keys: [k(0, POSE.pcKneel)] },
  pcPray: { dur: 0.6, keys: [k(0, POSE.fSeal)] },
  pcCast: { dur: 0.5, keys: [k(0, POSE.fJabW, 'hold'), k(0.1, POSE.fFocus, 'out'), k(0.5, POSE.fFocus)] },
  pcDash: { dur: 0.4, keys: [k(0, POSE.runA), k(0.06, POSE.dashS, 'hold'), k(0.4, POSE.dashS)] },
  pcUpper: { dur: 0.5, keys: [k(0, POSE.upW, 'hold'), k(0.1, POSE.upS, 'out'), k(0.5, POSE.upS)] },
  pcLeap: { dur: 0.4, keys: [k(0, POSE.jumpUp)] },
  pcSlam: { dur: 0.5, keys: [k(0, POSE.jAtkW, 'hold'), k(0.08, POSE.fQuake, 'out'), k(0.5, POSE.fQuake)] },
  pcFloat: { dur: 0.6, keys: [k(0, P(POSE.pcRaise, { g: 0 }))] },
});
// 精灵帧（P-art docs/PRIEST_ART.md §7.3 / 7.4，帧已全部在 SPR_DATA.priest）
const PC_ANIMS = {
  pcRaise: [['pc_raise', 0]], pcHeal: [['pc_heal', 0]], pcWall: [['pc_wall', 0]],
  pcThrow: [['pc_spear1', 0], ['pc_spear2', 0.12]], pcAim: [['pc_spear1', 0]],
  pcHammer: [['pc_hammer1', 0], ['pc_hammer2', 0.18]], pcKneel: [['pc_judge', 0]],
  pcPray: [['p_pray1', 0], ['p_pray2', 0.15]], pcCast: [['p_focus', 0]], pcDash: [['dash1', 0], ['dash2', 0.06]],
  pcUpper: [['p_up1', 0], ['p_up2', 0.08]], pcLeap: [['p_slamUp', 0]], pcSlam: [['p_slamDown', 0]], pcFloat: [['pc_raise', 0]],
};

/* ---- 特效构件（复用 art/final/fx，运行时染色） ---- */
// 光柱
function pcPillar(x, y, o = {}) { fxSpr('pillar', x, y, 0, { w: o.w || 70, h: o.h || 220, dur: o.dur || 0.45, col: o.col || PC_COL.holy, ay: 1, grow: [0.5, 1] }); }
// 地面法阵（hexagram / rune）
function pcCircle(x, y, r, col, dur = 0.6, o = {}) {
  return addFx({ x, y: y + 0.3, z: 0, dur, r, img: fxTint(o.img || 'hexagram', col), rot0: rnd(0, TAU), draw(c) {
    const k = this.t / this.dur, a = k < 0.15 ? k / 0.15 : k > 0.75 ? (1 - k) / 0.25 : 1, w = this.r * 2 * (0.85 + 0.15 * easeOut(Math.min(1, k * 3)));
    drawSpr(c, this.img, sx(this.x), sy(this.y, 0), w, w * GR, { ground: true, rot: this.rot0 + this.t * (o.spin ?? 0.6), alpha: a * (o.alpha ?? 0.9) });
  } });
}
// 圣光落雷（光之复仇 / 天启之珠 / 神罚之锤）
function pcBoltFx(x, y, h = 260, col = PC_COL.bolt) {
  addFx({ x, y: y + 2, z: 0, dur: 0.28, add: true, flip: Math.random() < 0.5, img: fxTint('thunderbolt', col), draw(c) {
    const k = this.t / this.dur, X = sx(this.x), Y = sy(this.y, 0), a = k < 0.15 ? 1 : 1 - (k - 0.15) / 0.85;
    drawSpr(c, this.img, X, Y + 6, 0, h, { ay: 1, flip: this.flip, alpha: a }); drawSpr(c, fxTint('spark', col), X, Y - 4, 64 * (0.6 + k), 0, { alpha: a });
  } });
}
// 圣光十字（crossx 转 45°）
const pcCrossFx = (x, y, z, w = 120, col = PC_COL.holy, dur = 0.4) => fxSpr('crossx', x, y, z, { w, dur, col, rot: Math.PI / 4, grow: [0.5, 1.1] });
// 光之长矛（投出去的矛 / 天使的矛 / 神圣之矛）：thrust 素材
function pcSpearFx(x, y, z, len, ang, col = PC_COL.light, dur = 0.3) {
  addFx({ x, y: y + 1, z, dur, add: true, img: fxTint('thrust', col), draw(c) { const k = this.t / this.dur; drawSpr(c, this.img, sx(this.x), sy(this.y, this.z), len, len * 0.16, { rot: ang, alpha: 1 - k * k }); } });
}
// 巨大的光之锤（忏悔之锤 / 神罚之锤）：程序画的锤头 + 锤柄，从头顶挥下
function pcHammerFx(e, x, o = {}) {
  const s = o.s || 1, face = e.face;
  return addFx({ x: x - face * 30 * s, y: e.y + 2, z: 0, dur: o.dur || 0.5, face, draw(c) {
    const k = this.t / this.dur, ang = lerp(-2.1, 1.15, easeIn(Math.min(1, k / 0.45))), a = k > 0.7 ? (1 - k) / 0.3 : 1, X = sx(this.x), Y = sy(this.y, 70 * s), L = 150 * s;
    c.save(); c.globalAlpha = 0.95 * a; c.translate(X, Y); c.scale(this.face, 1); c.rotate(ang);
    c.fillStyle = '#c8a040'; c.strokeStyle = '#5a3a10'; c.lineWidth = 2; c.fillRect(0, -6 * s, L, 12 * s); c.strokeRect(0, -6 * s, L, 12 * s);
    const g = c.createLinearGradient(L - 20 * s, 0, L + 44 * s, 0); g.addColorStop(0, '#fff6c8'); g.addColorStop(0.5, '#ffd24a'); g.addColorStop(1, '#c88a20');
    c.fillStyle = g; c.beginPath(); if (c.roundRect) c.roundRect(L - 24 * s, -46 * s, 64 * s, 92 * s, 12 * s); else c.rect(L - 24 * s, -46 * s, 64 * s, 92 * s); c.fill(); c.stroke();
    c.fillStyle = '#ffffff'; c.fillRect(L - 2 * s, -30 * s, 8 * s, 60 * s); c.fillRect(L - 14 * s, -6 * s, 32 * s, 12 * s);
    c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.5 * a * FX_DIM; c.fillStyle = '#fff2a0'; c.beginPath(); c.ellipse(L + 8 * s, 0, 58 * s, 70 * s, 0, 0, TAU); c.fill(); c.restore();
  } });
}

/* ---- 基础技能在圣骑士下：独立攻击（官方：勇气恩赐后巨兵技能从物理百分比变成魔法独立攻击） ---- */
PRIEST_HOOKS.mod.push((p, id) => pcOn(p) ? { type: 'indep' } : null);

/* =====================================================================
   被动 / 路线
   ===================================================================== */
defSkill('pc_god', { name: '神的恩赐', cls: 'priest', job: PCJ, lvReq: 15, maxLv: 1, sp: 0, mp: 0, cd: 0, type: 'indep', passive: true, col: '#fff4c0',
  desc: '【被动，转职时自动学会】神的恩赐：所有异常状态抗性提高（本作：身上的异常状态持续时间缩短 5%）。', infoExtra: () => [['异常状态抗性', '+5%']] });
defSkill('pc_courage', { name: '勇气恩赐', cls: 'priest', job: PCJ, lvReq: 15, maxLv: 10, sp: 20, mp: 0, cd: 0, type: 'indep', passive: true, col: '#ff9a4a',
  desc: '【被动，转职时自动学会 · 战斗路线】守护的意志化为勇气之光：基本攻击和技能攻击力提高。战斗路线下：天启之珠不给队友祝福、冷却缩短到 135 秒且覆盖整个画面；神圣之光只能对自己施放；神圣洗礼：信仰之翼不能用；生命礼赞：神威固定为「审判」演出、不给 BUFF；守护系辅助技能（守护徽章 / 荣誉祝福 / 圣光守护 / 生命源泉 / 圣愈之风 / 快速愈合 / 灵魂牺牲 / 冥想）放不出。开启「守护恩赐」切换到守护路线时这个被动不生效。',
  infoExtra: lv => [['技能攻击力', '+' + pct(0.08 + 0.012 * lv)]] });
defSkill('pc_guard', { name: '守护恩赐', cls: 'priest', job: PCJ, lvReq: 15, maxLv: 10, sp: 10, mp: 0, cd: 0, type: 'indep', passive: true, col: '#a8d8ff', switchOpt: '守护路线（纯辅助）',
  desc: '【被动，转职时自动学会 · 路线开关】神圣的守护恩赐。默认关闭（战斗路线）；在技能窗口按「开启守护路线」切换成纯辅助（官方和勇气恩赐互斥）：体力 / 精神提高（最大 HP 提高、受到的伤害降低），守护系辅助技能可以使用，勇气恩赐和圣灵之槌不生效。组队时：攻击到的敌人受到的属性伤害提高（10 秒，最多 3 层）；单刷时（官方单刷专用效果）：独立攻击力提高、技能冷却 −20%。',
  infoExtra: lv => [['最大 HP', '+' + pct(0.03 + 0.004 * lv)], ['组队：敌人受到伤害', '+5.5% × 3 层'], ['单刷：技能攻击力', '+' + pct(0.12 + 0.01 * lv)], ['单刷：冷却', '−20%']] });
defSkill('pc_firm', { name: '坚定意志', cls: 'priest', job: PCJ, lvReq: 18, maxLv: 10, sp: 15, mp: 0, cd: 0, type: 'indep', passive: true, col: '#c8c8d0',
  desc: '【被动】对神坚定的信仰让圣骑士的意志坚不可摧：基本攻击和转职技能攻击力、魔法暴击率提高（两条路线都生效）。', infoExtra: lv => [['技能攻击力', '+' + pct(0.01 * lv)], ['暴击率', '+' + pct(0.02 + 0.003 * lv)]] });
// 光之复仇：无限持续的 BUFF；攻击时 100%（间隔 0.2 秒）、被魔法 / 物理攻击时 80% / 42% 落下圣光雷击（被打时 10% 感电）；装备神罚之锤时不能手动放、神罚之锤施放时自动施放
const PC_BOLT = lv => skillDmg(0.4, 0.04, lv || 1);
defSkill('pc_revenge', { name: '光之复仇', cls: 'priest', job: PCJ, lvReq: 16, maxLv: 1, sp: 20, mp: 20, cd: 10, type: 'indep', elem: 'light', buff: true, cast: true, noHitCheck: true, col: '#fff38a',
  desc: '【BUFF · 永久】给自己施加光之复仇：直接攻击时必定、受到魔法 / 物理攻击时 80% / 42% 的几率，在敌人身上落下圣光雷击（攻击时每 0.2 秒最多一次，被打时 0.25 秒一次；被打时的雷击有 10% 几率让敌人感电 5 秒）。学了神罚之锤后不能手动施放，改为施放神罚之锤时自动施放。',
  req: p => !(skLv(p, 'pc_jupiter') > 0) || '学了神罚之锤后改为施放神罚之锤时自动施放', ai: { kind: 'buff' },
  infoExtra: () => [['雷击攻击力', pct(PC_BOLT(1))], ['持续', '永久'], ['施放时间', '0.5 秒']],
  act: () => ({ name: 'pc_revenge', clip: 'pcRaise', dur: 0.5, noCounter: true,
    events: [evAt(0.02, e => fxCharge(e, PC_COL.bolt, 2)), evAt(0.35, e => pcRevengeOn(e))] }) });
function pcRevengeOn(e) { e.buffs.pc_revenge = { t: game.pvp ? 60 : 1e6, col: '#fff38a', name: '光之复仇' }; pcBoltFx(e.x, e.y, 200); sfx.buff(); fxText('光之复仇', e.x, e.y, e.z + 20, { col: '#fff38a', size: 11 }); }
// 圣光雷击：打一个目标（独立攻击、光属性，h.pcBolt 标记防止连锁）
function pcBoltOn(p, t, stun) {
  if (!t || t.dead) return;
  pcBoltFx(t.x, t.y, 240); sfx.hit('crit', false);
  applyHit(p, t, { dmg: PC_BOLT(1), type: 'indep', elem: 'light', sure: true, stun: t.st === 'hit' ? Math.max(t.stun || 0, 0.12) : 0.12, knock: 0, hs: 0.02, pcBolt: true, box: null, col: '#fff38a' }, { proj: true, src: { x: t.x - p.face * 10, y: t.y, z: 0, face: p.face } });
  if (stun && !t.dead) addStatus(t, 'shock', 5, { src: p });
}

/* ---- 守护路线（纯辅助）---- */
defSkill('pc_sacrifice', { name: '灵魂牺牲', cls: 'priest', job: PCJ, lvReq: 16, maxLv: 1, sp: 50, mp: 0, cd: 0, type: 'indep', passive: true, col: '#9ff0b8', pre: { pc_guard: 1 },
  desc: '【被动 · 守护路线】把灵魂锤炼到极限：移动速度、施放速度、基本攻击和技能攻击力提高。圣骑士死亡时，1600px 内的队员回复 HP 和 MP。', req: pcNeedGuard,
  infoExtra: () => [['移动速度', '+10%'], ['施放速度', '+15%'], ['技能攻击力', '+5%'], ['死亡时队员回复', 'HP / MP 10%']] });
defSkill('pc_light', { name: '圣光守护', cls: 'priest', job: PCJ, lvReq: 17, maxLv: 10, sp: 25, mp: 35, cd: 15, type: 'indep', buff: true, cast: true, noHitCheck: true, col: '#ffe9a0', pre: { pc_guard: 1 },
  desc: '【守护路线】用神圣之光包住 1200px 内 HP 比例最低的一名队员（单刷是自己），8 秒内替他吸收物理 / 魔法伤害；护盾量 = 圣骑士最大 HP 的一定比例（药品提高的 HP 不算）。官方是施放后用方向键选队员，本作自动选。',
  req: pcNeedGuard, ai: { kind: 'buff' }, infoExtra: lv => [['护盾', '圣骑士最大 HP × ' + pct(0.07 + 0.005 * lv)], ['持续', '8 秒'], ['范围', '1200px'], ['施放时间', '0.7 秒']],
  act: lv => ({ name: 'pc_light', clip: 'pcHeal', dur: 0.7, noCounter: true,
    events: [evAt(0.02, e => fxCharge(e, PC_COL.light, 2)), evAt(0.55, e => { const t = pcPickMate(e, 1200) || e;
      pcGive(e, t, 'shield', { id: 'pc_light', v: Math.round(e.hpMax * (0.07 + 0.005 * lv)), t: 8, cap: 0.8 });
      fxSpr('pm_hexshield', t.x, t.y, t.z + 60, { w: 90, h: 150, dur: 0.6, col: PC_COL.light, grow: [0.6, 1.1] }); pcCrossFx(t.x, t.y, t.z + 120, 60, PC_COL.light); sfx.buff(); pcHolyAdd(e, 1); })] }) });
defSkill('pc_sign', { name: '守护徽章', cls: 'priest', job: PCJ, lvReq: 17, maxLv: 10, sp: 25, mp: 40, cd: 10, type: 'indep', buff: true, cast: true, noHitCheck: true, col: '#7ab0ff', pre: { pc_guard: 1 },
  desc: '【守护路线 · 队伍 BUFF】900px 内的队员（含自己）300 秒内物理 / 魔法防御、体力 / 精神、HP / MP 上限提高（本作：受到的伤害降低、最大 HP / MP 提高）。先给自己放、再给队友放效果更好（官方）。',
  req: pcNeedGuard, ai: { kind: 'buff' }, infoExtra: lv => [['最大 HP / MP', '+' + pct(0.04 + 0.004 * lv)], ['受到的伤害', '−' + pct(0.03 + 0.003 * lv)], ['持续', '300 秒'], ['范围', '900px']],
  act: lv => ({ name: 'pc_sign', clip: 'pcRaise', dur: 0.5, noCounter: true,
    events: [evAt(0.3, e => { const b = { t: 300, hpPct: 0.04 + 0.004 * lv, mpPct: 0.04 + 0.004 * lv, taken: -(0.03 + 0.003 * lv), name: '守护徽章', col: '#7ab0ff' };
      for (const t of pcMembers(e, 900)) pcGive(e, t, 'buff', { id: 'pc_sign', b, aura: '#7ab0ff' });
      fxSpr('pm_hexshield', e.x, e.y, e.z + 60, { w: 120, h: 170, dur: 0.6, col: '#9fc8ff', grow: [0.6, 1.1] }); fxShock(e.x, e.y, 200, '#9fc8ff'); sfx.buff(); pcHolyAdd(e, 1); })] }) });
defSkill('pc_fastheal', { name: '快速愈合', cls: 'priest', job: PCJ, lvReq: 17, maxLv: 1, sp: 50, mp: 0, cd: 0, type: 'indep', passive: true, col: '#6ae88a', pre: { p_slowheal: 1, pc_guard: 1 },
  desc: '【被动 · 守护路线】缓慢愈合的回复时间缩短到 1 秒、回复量提高到 135%，施放时间缩短到 0.5 秒。', req: pcNeedGuard, infoExtra: () => [['缓慢愈合回复时间', '1 秒'], ['回复量', '135%']] });
// 荣誉祝福：队友（不含自己）攻击力提高；自己的技能攻击力提高（圣骑士的“自 BUFF”）；神圣洗礼的圣力层数提高效果
const pcHonorVal = (lv, n) => ({ atk: (0.06 + 0.006 * lv) * (1 + 0.05 * (n || 0)), dmg: Math.min(0.35, 0.1 + 0.02 * lv) * (1 + 0.05 * (n || 0)) });
defSkill('pc_honor', { name: '荣誉祝福', cls: 'priest', job: PCJ, lvReq: 18, maxLv: 10, sp: 30, mp: 45, cd: 10, type: 'indep', buff: true, cast: true, noHitCheck: true, col: '#ffd24a', pre: { pc_sign: 1 },
  desc: '【守护路线 · 队伍 BUFF】祝福 900px 内的队员（不含自己）：物理 / 魔法 / 独立攻击力、力量 / 智力、命中率提高（本作：攻击力提高）；自己的基本攻击和技能攻击力提高。300 秒。神圣洗礼：信仰之翼的圣力每层让效果再提高 5%。',
  req: pcNeedGuard, ai: { kind: 'buff' }, infoExtra: lv => [['队友攻击力', '+' + pct(pcHonorVal(lv).atk)], ['自己技能攻击力', '+' + pct(pcHonorVal(lv).dmg)], ['持续', '300 秒'], ['范围', '900px']],
  act: lv => ({ name: 'pc_honor', clip: 'pcRaise', dur: 0.5, noCounter: true,
    events: [evAt(0.3, e => { const n = e.buffs.pc_holy ? e.buffs.pc_holy.n : 0, V = pcHonorVal(lv, n);
      for (const t of pcMembers(e, 900)) pcGive(e, t, 'buff', t === e ? { id: 'pc_honor', b: { t: 300, dmg: V.dmg, name: '荣誉祝福', col: '#ffd24a' }, aura: '#ffd24a' } : { id: 'pc_honor_p', b: { t: 300, atk: V.atk, name: '荣誉祝福', col: '#ffd24a' }, aura: '#ffd24a' });
      fxSpr('aura', e.x, e.y, 0, { h: 200, ay: 1, dur: 0.7, col: '#ffe070' }); pcCrossFx(e.x, e.y, e.z + 140, 80, '#ffe070', 0.6); sfx.buff(); pcHolyAdd(e, 1); })] }) });
// 生命源泉：选一名队友（不含自己），200 秒 HP 回复提高；死亡时复活（回复 25%，复活瞬间无敌）；组队才能用、决斗不能用；活着时最多用 12 次
const PC_FOUNT_N = 12;
defSkill('pc_fountain', { name: '生命源泉', cls: 'priest', job: PCJ, lvReq: 19, maxLv: 1, sp: 100, mp: 60, cd: 60, type: 'indep', buff: true, cast: true, noHitCheck: true, col: '#b8ff9a', pre: { pc_sacrifice: 1 },
  desc: '【守护路线 · 复活】选 1200px 内 HP 比例最低的一名队友（不含自己），200 秒内 HP 持续回复；这个队友 HP 归零时立即复活（回复 25% HP，复活瞬间无敌），复活后 BUFF 消失。只有组队时能用（单刷、决斗场不能用）；圣骑士活着的时候最多用 12 次。头顶绕着两个小精灵。',
  req: p => { const r = pcNeedGuard(p); if (r !== true) return r; if (game.pvp) return '决斗场不能用'; if (p === game.player && !pcPickMate(p, 1200, false)) return '需要队友（组队才能用）'; return (p._pcFountN || 0) < PC_FOUNT_N || '次数已用完（死亡后重置）'; },
  ai: { kind: 'buff' }, infoExtra: () => [['复活后 HP', '25%'], ['持续', '200 秒'], ['每秒回复', '0.3% 最大 HP'], ['次数', PC_FOUNT_N + ' 次'], ['范围', '1200px']],
  act: () => ({ name: 'pc_fountain', clip: 'pcHeal', dur: 0.8, noCounter: true,
    events: [evAt(0.02, e => fxCharge(e, '#b8ff9a', 3)), evAt(0.62, e => { const t = pcPickMate(e, 1200, false); if (!t) return;
      e._pcFountN = (e._pcFountN || 0) + 1;
      pcGive(e, t, 'buff', { id: 'pc_fountain', b: { t: 200, hot: 0.003, life: 0.25, name: '生命源泉', col: '#b8ff9a' }, aura: '#b8ff9a' });
      fxSpr('heal', t.x, t.y, 0, { w: 90, h: 220, ay: 1, dur: 0.8, col: '#b8ff9a', grow: [0.5, 1] }); fxText('生命源泉', t.x, t.y, t.z + 30, { col: '#c8ffb0', size: 12 }); sfx.buff(); pcHolyAdd(e, 1); })] }) });
// 圣愈之风：900px 内队员回复 HP / MP，并给护盾（圣骑士最大 HP 的 23%，约 5 秒）；施放中按跳跃键取消（回复照样生效）
defSkill('pc_wind', { name: '圣愈之风', cls: 'priest', job: PCJ, lvReq: 20, maxLv: 1, sp: 100, mp: 70, cd: 60, type: 'indep', buff: true, cast: true, noHitCheck: true, col: '#8ff0c8', pre: { pc_fastheal: 1 },
  desc: '【守护路线 · 群体治疗】900px 内的队员（含自己）1 秒内回复 HP 和 MP，并得到一层护盾（圣骑士最大 HP 的 23%，约 5 秒；离开范围就消失）。神圣的风一边吹一边持续，施放中按跳跃键可以提前结束（回复已经生效）。可以在普攻中取消施放。',
  req: pcNeedGuard, noForce: false, ai: { kind: 'buff' }, infoExtra: () => [['HP / MP 回复', '25%'], ['护盾', '圣骑士最大 HP × 23%'], ['护盾持续', '5 秒'], ['范围', '900px']],
  act: () => ({ name: 'pc_wind', clip: 'pcHeal', dur: 1.4, noCounter: true,
    onInput: (e, I) => { if (I.buffered('jump') && e.actT > 0.55) { I.consume('jump'); e.endAct(); return true; } return false; },
    update: e => { const a = e.act; if (e.actT > 0.5 && Math.floor(e.actT / 0.18) !== a.k) { a.k = Math.floor(e.actT / 0.18); fxSpr('tornado', e.x + rnd(-120, 120), e.y + rnd(-20, 20), 0, { h: 120, ay: 1, dur: 0.5, col: '#b8ffd8', alpha: 0.5 }); } },
    events: [evAt(0.5, e => { const v = Math.round(e.hpMax * 0.23);
      for (const t of pcMembers(e, 900)) { pcGive(e, t, 'buff', { id: 'pc_wind_h', b: { t: 1.2, hot: 0.25, name: '圣愈之风', col: '#8ff0c8' } }); pcGive(e, t, 'heal', { mp: 0.25 }); pcGive(e, t, 'shield', { id: 'pc_wind', v, t: 5.08, cap: 0.8 });
        fxSpr('heal', t.x, t.y, 0, { w: 80, h: 180, ay: 1, dur: 0.7, col: '#8ff0c8' }); }
      fxShock(e.x, e.y, 260, '#8ff0c8'); sfx.buff(); pcHolyAdd(e, 1); })] }) });

/* ---- 战斗路线 ---- */
const pcMaceVal = lv => ({ dmg: 0.03 + 0.007 * lv, aspd: 0.05 + 0.003 * lv, cspd: 0.12 + 0.004 * lv, mspd: 0.1 + 0.003 * lv });
defSkill('pc_mace', { name: '圣灵之槌', cls: 'priest', job: PCJ, lvReq: 16, maxLv: 10, sp: 20, mp: 20, cd: 7, type: 'indep', buff: true, noHitCheck: true, col: '#ffcf5a', pre: { pc_courage: 1 },
  desc: '【BUFF · 战斗路线 · 永久】召唤注入圣灵之力的战槌：普攻变成战槌连击（第 3 下和空斩打会震出圣光冲击波，攻击距离更长），基本攻击和技能攻击力、所有速度、命中率提高。瞬间施放。',
  req: pcNeedBattle, ai: { kind: 'buff' }, infoExtra: lv => { const V = pcMaceVal(lv); return [['技能攻击力', '+' + pct(V.dmg)], ['攻击速度', '+' + pct(V.aspd)], ['施放速度', '+' + pct(V.cspd)], ['移动速度', '+' + pct(V.mspd)], ['持续', '永久']]; },
  act: lv => ({ name: 'pc_mace', clip: 'pcRaise', dur: 0.35, noCounter: true,
    onStart: e => { e.buffs.pc_mace = { t: game.pvp ? 60 : 1e6, ...pcMaceVal(lv), name: '圣灵之槌', col: '#ffcf5a' }; pcPillar(e.x + e.face * 16, e.y, { h: 170, w: 50, col: '#ffe070' }); fxAura(e, '#ffcf5a', 0.8); sfx.buff(); } }) });

/* =====================================================================
   转职攻击技能（官方 Lv15~45）
   ===================================================================== */
// 胜利之矛：投出圣力长矛，贯穿一排敌人把他们钉到落点（强制硬直），过一会儿爆炸；按住技能键蓄力（0.3 秒）贯穿伤害 / 贯穿数提高；
// 学了神之代行者：直接满蓄、矛更大，矛插在地上时再按技能键立即引爆
const pcSpearDmg = lv => ({ pierce: skillDmg(1.0, 0.1, lv), full: skillDmg(1.35, 0.135, lv), boom: skillDmg(2.0, 0.2, lv) });
defSummon('pc_spear_f', { kind: 'field', life: 4, max: 3, over: 'oldest', keepRoom: false, type: 'indep', elem: 'light', col: PC_COL.light,
  update(s, dt) {
    if (s.fly > 0) { const st = Math.min(s.fly, dt); s.fly -= st; s.x += s.face * 1150 * st; const R = game.room; if (R) s.x = clamp(s.x, R.x0 + 20, R.x1 - 20);
      for (const t of ents) { if (s.pinned.size >= s.cap || s.pinned.has(t) || !foe(s.owner, t) || t.invul > 0 || Math.abs(t.x - s.x) > 36 * s.big + t.w || Math.abs(t.y - s.y) > 26 * s.big || t.z > 140) continue;
        s.pinned.add(t); summonHit(s, t, { dmg: s.dmg.hit, stun: 0.7, knock: 0, hs: 0.05, sure: true, downHit: true, col: PC_COL.light }); if (!t.dead) addStatus(t, 'hold', 3, { src: s.owner }); }
      if (s.fly <= 0) { s.stuckT = s.lifeT; fxDust(s.x, s.y, 6, 16); sfx.thud(0.6); } }
    for (const t of s.pinned) if (!t.dead && pcMovable(t)) { t.x = lerp(t.x, s.x - s.face * 14, 0.5); t.y = lerp(t.y, s.y, 0.3); }
    if (s.stuckT !== undefined && !s.boomed && s.lifeT - s.stuckT >= s.delay) pcSpearBoom(s);
  },
  drawUpright(c, s) { if (s.boomed) return; const stuck = s.stuckT !== undefined, X = sx(s.x), Y = sy(s.y, stuck ? 30 : 64), w = 150 * s.big;
    drawSpr(c, fxTint('thrust', s.full ? '#fff2a0' : '#fffaf0'), X, Y, w, w * 0.2, { rot: stuck ? s.face * 0.55 : 0, flip: s.face < 0 }); },
  onEnd(s) { for (const t of s.pinned) if (t.status) delete t.status.hold; } });
function pcSpearBoom(s) {
  if (s.boomed) return; s.boomed = true; cam.shake = Math.max(cam.shake, 5); sfx.boom(0.6);
  pcCrossFx(s.x, s.y, 50, 150 * s.big, '#fff2a0', 0.45); fxSpr('burst', s.x, s.y, 40, { w: 190 * s.big, dur: 0.4, col: '#fff2a0', grow: [0.5, 1.1] }); fxShock(s.x, s.y, 140 * s.big, '#ffe8a0');
  for (const t of s.pinned) if (t.status) delete t.status.hold;
  summonArea(s, s.x, s.y, 110 * s.big, { dmg: s.dmg.boom, launch: 380, knock: 100, hs: 0.08, downHit: true, col: '#fff2a0' }, { zMax: 160 });
  s.life = s.lifeT + 0.05;
}
defSkill('pc_spear', { name: '胜利之矛', cls: 'priest', job: PCJ, lvReq: 16, sp: 20, mp: 20, cd: 6.6, type: 'indep', elem: 'light', col: '#fff2a0',
  desc: '投出用神圣之力凝成的长矛：贯穿路上的敌人（最多 10 个，满蓄 16 个），把他们一起拖到落点钉住（强制硬直，霸体 / 领主拖不动），1 秒后长矛爆炸。按住技能键蓄力（最多 0.3 秒，按 3 秒以上自动投出）：贯穿攻击力和贯穿数提高。学了神之代行者：直接以满蓄投出、矛更大，矛插在地上时再按技能键立即引爆。',
  pow: lv => pcSpearDmg(lv).pierce + pcSpearDmg(lv).boom, ai: { kind: 'poke', r: [40, 380], dy: 30 },
  infoExtra: lv => [['满蓄贯穿攻击力', pct(pcSpearDmg(lv).full)], ['爆炸攻击力', pct(pcSpearDmg(lv).boom)], ['最多贯穿', '10 个（满蓄 16 个）'], ['距离', '约 370px']],
  recast: { ok: p => skLv(p, 'pc_agent') > 0 && summonsOf(p, 'pc_spear_f').some(s => s.stuckT !== undefined && !s.boomed), instant: true, cd: 0.2, mp: 0, act: (lv, p) => { for (const s of summonsOf(p, 'pc_spear_f')) if (s.stuckT !== undefined) pcSpearBoom(s); } },
  act: (lv, p) => { const agent = skLv(p, 'pc_agent') > 0;
    return { name: 'pc_spear', clip: 'pcAim', dur: 0.52, noCounter: true,
      charge: agent ? null : { at: 0.05, max: 0.3, min: 0, dmg: 0, hold: true, holdMax: 2.7, update: e => { if (Math.random() < 0.4) fxCharge(e, '#fff2a0'); } },
      update: e => { const a = e.act; if (a.thrown || !a.chargeDone || e.actT < 0.08) return; a.thrown = true; e.play('pcThrow', true); e.animT = 0.1; sfx.swing(true);
        const full = agent || (a.chargeK || 0) >= 0.99, D = pcSpearDmg(lv), big = (full ? 1.2 : 1) * (agent ? 1.3 : 1);
        const s = summon(e, 'pc_spear_f', { x: e.x + e.face * 40, y: e.y, lv });
        if (s) Object.assign(s, { fly: full ? 0.36 : 0.32, pinned: new Set(), cap: full ? 16 : 10, big, full, delay: 1.0, dmg: { hit: full ? D.full : D.pierce, boom: D.boom } });
        fxStreak({ x: e.x + e.face * 30, y: e.y, z: e.z + 64, face: e.face, len: 140, w: 14, col: '#fff2a0', dur: 0.2 }); } }; } });
// 圣光沁盾：前方生成圣力之墙（光属性魔法独立攻击），缓缓前进推开敌人；敌人和敌人的远程攻击过不去，队友 / 自己的攻击能穿过；5 秒
// 双子沁盾（开关被动）：生成两面墙相向移动、相撞爆炸（相撞 / 爆炸各为圣光沁盾的 50%）
const pcWallDmg = lv => skillDmg(3.6, 0.36, lv);
defSummon('pc_wall_f', { kind: 'field', life: 5, max: 4, over: 'oldest', keepRoom: false, type: 'indep', elem: 'light', col: '#bfe8ff',
  update(s, dt) {
    s.x += s.face * s.v * dt; const R = game.room; if (R) s.x = clamp(s.x, R.x0 + 30, R.x1 - 30);
    for (const t of ents) { if (!foe(s.owner, t) || t.dead || Math.abs(t.y - s.y) > 64 || t.z > 180) continue;
      const d = (t.x - s.x) * s.face, gap = 22 + t.w;
      if (Math.abs(d) < gap) { if (!s.hitSet.has(t) && t.invul <= 0) { s.hitSet.add(t); summonHit(s, t, { dmg: s.dmg, stun: 0.45, knock: 60, hs: 0.05, downHit: true, col: '#bfe8ff' }); }
        if (pcMovable(t) && t.st !== 'held') t.x = s.x + s.face * gap * (d >= 0 ? 1 : -1); } }
    if (s.hp > 0) s.hp -= eraseProjs(s.owner.team, { x0: s.x - 26, x1: s.x + 26, y0: s.y - 64, y1: s.y + 64, z0: 0, z1: 200 }, q => fxSpr('spark', q.x, q.y, q.z + 10, { w: 50, dur: 0.2, col: '#bfe8ff' }));
    if (s.hp <= 0 && !s.broke) { s.broke = true; s.life = s.lifeT + 0.05; fxSpr('burst', s.x, s.y, 80, { w: 120, dur: 0.3, col: '#bfe8ff' }); }
    if (s.pair && !s.clash && s.pair.x !== undefined && (s.pair.x - s.x) * s.face <= 40 && s.front) pcWallClash(s);
  },
  drawUpright(c, s) { const k = Math.min(1, s.lifeT / 0.15), a = s.life - s.lifeT < 0.3 ? (s.life - s.lifeT) / 0.3 : 1;
    drawSpr(c, fxTint('pm_hexshield', s.front === false ? '#ffe8a0' : '#bfe8ff'), sx(s.x), sy(s.y, 0) - 6, 70 * k, 190, { ay: 1, flip: s.face < 0, alpha: 0.85 * a }); } });
function pcWallClash(s) {
  const o = s.pair; s.clash = o.clash = true; const x = (s.x + o.x) / 2; cam.shake = Math.max(cam.shake, 5); sfx.boom(0.7);
  fxSpr('burst', x, s.y, 80, { w: 220, dur: 0.45, col: '#fff2c0', grow: [0.5, 1.2] }); fxShock(x, s.y, 180, '#bfe8ff'); pcCrossFx(x, s.y, 90, 160, '#fff2c0', 0.5);
  summonArea(s, x, s.y, 140, { dmg: s.dmg0 * 0.5, stun: 0.5, knock: 40, hs: 0.06, downHit: true }, { zMax: 180 });
  game.after(0.15, () => summonArea(s, x, s.y, 170, { dmg: s.dmg0 * 0.5, launch: 360, knock: 120, hs: 0.08, downHit: true, col: '#fff2c0' }, { zMax: 180 }));
  s.life = s.lifeT + 0.1; o.life = o.lifeT + 0.1;
}
defSkill('pc_wall', { name: '圣光沁盾', cls: 'priest', job: PCJ, lvReq: 18, sp: 25, mp: 25, cd: 8, type: 'indep', elem: 'light', cast: true, col: '#bfe8ff', pre: { p_purity: 1 },
  desc: '用神圣之力在前方筑起一面墙（生成时和碰到的敌人各受一次光属性伤害），墙缓缓前进推开敌人；敌人和敌人的远程攻击过不去，自己和队友能穿过。持续 5 秒，挡掉一定数量的远程攻击后破碎。贴身放能把近战敌人挡在墙外。学了双子沁盾（开关）时改为两面墙相向移动、相撞爆炸。',
  pow: pcWallDmg, ai: { kind: 'poke', r: [0, 220], dy: 50 }, infoExtra: lv => [['持续', '5 秒'], ['挡住远程攻击', (6 + lv) + ' 次'], ['施放时间', '0.5 秒']],
  act: lv => ({ name: 'pc_wall', clip: 'pcWall', dur: 0.55, noCounter: true,
    events: [evAt(0.02, e => fxCharge(e, '#bfe8ff', 2)), evAt(0.4, e => { const D = pcWallDmg(lv), R = game.room, cx = x => R ? clamp(x, R.x0 + 30, R.x1 - 30) : x;
      if (skLv(e, 'pc_pwall') > 0 && !(isHuman(e) && pcSw('pc_pwall'))) {
        const a = summon(e, 'pc_wall_f', { x: cx(e.x + e.face * 80), y: e.y, lv }), b = summon(e, 'pc_wall_f', { x: cx(e.x + e.face * 330), y: e.y, lv });
        if (a && b) { Object.assign(a, { v: 95, hitSet: new Set(), hp: Math.round((6 + lv) * 1.2), dmg: D * 0.25, dmg0: D, pair: b, front: true }); Object.assign(b, { face: -e.face, v: 95, hitSet: new Set(), hp: Math.round((6 + lv) * 1.2), dmg: D * 0.25, dmg0: D, pair: a, front: false }); }
      } else { const s = summon(e, 'pc_wall_f', { x: cx(e.x + e.face * 95), y: e.y, lv }); if (s) Object.assign(s, { v: 45, hitSet: new Set(), hp: 6 + lv, dmg: D }); }
      sfx.buff(); fxShock(e.x + e.face * 95, e.y, 90, '#bfe8ff'); })] }) });
const pcSw = id => { const O = pcOpts(); return !!(O && O.swOff && O.swOff[id]); };
defSkill('pc_pwall', { name: '双子沁盾', cls: 'priest', job: PCJ, lvReq: 18, maxLv: 1, sp: 10, mp: 0, cd: 0, type: 'indep', elem: 'light', passive: true, col: '#bfe8ff', icon: 'pc_wall', pre: { pc_wall: 1 }, switchOpt: '双子沁盾',
  desc: '【被动 · 可开关】圣光沁盾改为生成两面墙（HP 为圣光沁盾的 120%），两面墙相向移动、相撞后爆炸（相撞 / 爆炸的攻击力各为圣光沁盾的 50%），把中间的敌人夹住一起炸。技能窗口里可以关闭，关闭后恢复成一面墙。' });
// 圣光球：前方生成缓缓前进的光球，0.2 秒一次多段攻击（15 段），3 秒后消失时让 300px 内的敌人眩晕 6 秒；按住 → 施放时生成得更远
// 神圣琉璃球（开关被动）：不再多段，碰到敌人就地爆炸（光球攻击力的 14 倍）并眩晕
const pcOrbDmg = lv => skillDmg(0.43, 0.043, lv);
defSummon('pc_sphere_f', { kind: 'field', life: 3, max: 2, over: 'oldest', keepRoom: false, type: 'indep', elem: 'light', col: '#fff2a0',
  update(s, dt) { s.x += s.face * (s.scrap ? 150 : 35) * dt; const R = game.room; if (R && (s.x < R.x0 + 20 || s.x > R.x1 - 20)) { s.x = clamp(s.x, R.x0 + 20, R.x1 - 20); if (s.scrap) pcOrbBurst(s); }
    if (s.scrap && !s.burst && ents.some(t => foe(s.owner, t) && t.invul <= 0 && !t.dead && Math.abs(t.x - s.x) < 40 + t.w && Math.abs(t.y - s.y) < 30 && t.z < 120)) pcOrbBurst(s);
    if (!s.scrap) { s.tk = (s.tk || 0) + dt; while (s.tk >= 0.2 && s.nHit < 15) { s.tk -= 0.2; s.nHit++; summonArea(s, s.x, s.y, 88, { dmg: s.dmg, stun: 0.25, knock: 0, hs: 0.01, downHit: true, col: '#fff2a0' }, { zMax: 140 }); } } },
  drawUpright(c, s) { if (s.burst) return; const k = Math.min(1, s.lifeT / 0.2), p = 1 + Math.sin(game.t * 12) * 0.06; drawSpr(c, 'chaser', sx(s.x), sy(s.y, 56), 84 * k * p, 0, {}); drawSpr(c, fxTint('spark', '#fff2a0'), sx(s.x), sy(s.y, 56), 60 * k, 0, { rot: game.t * 3, alpha: 0.6 }); },
  onEnd(s) { if (!s.burst) pcOrbStun(s); } });
function pcOrbStun(s) { fxShock(s.x, s.y, 300, '#fff2a0'); fxSpr('burst', s.x, s.y, 56, { w: 160, dur: 0.35, col: '#fff8d0' }); sfx.hit('crit', false);
  for (const t of ents) if (foe(s.owner, t) && !t.dead && t.invul <= 0 && inGround(t, s.x, s.y, 300)) addStatus(t, 'stun', game.pvp ? 1.5 : 6, { src: s.owner }); }
function pcOrbBurst(s) { if (s.burst) return; s.burst = true; cam.shake = Math.max(cam.shake, 4); sfx.boom(0.5); fxSpr('explosion', s.x, s.y, 56, { w: 180, dur: 0.4, grow: [0.5, 1.1] });
  summonArea(s, s.x, s.y, 120, { dmg: s.dmg * 14, launch: 260, knock: 140, hs: 0.08, downHit: true, col: '#fff2a0' }, { zMax: 160 }); pcOrbStun(s); s.life = s.lifeT + 0.05; }
defSkill('pc_sphere', { name: '圣光球', cls: 'priest', job: PCJ, lvReq: 19, sp: 40, mp: 45, cd: 14.4, type: 'indep', elem: 'light', cast: true, col: '#fff2a0',
  desc: '在前方生成一个缓缓前进的光球，每 0.2 秒对周围的敌人造成一次光属性伤害（共 15 段），3 秒后消失时让 300px 内的敌人眩晕 6 秒（决斗场：只眩晕面朝光球的敌人，本作 1.5 秒）。按住 → 施放时光球生成得更远。学了神圣琉璃球（开关）时改为碰到敌人就地爆炸。',
  pow: lv => pcOrbDmg(lv) * 15, ai: { kind: 'aoe', r: [40, 300], dy: 50 }, infoExtra: lv => [['每段', pct(pcOrbDmg(lv))], ['段数', '15'], ['眩晕', '6 秒（300px）'], ['施放时间', '0.5 秒']],
  act: (lv, p) => { const far = pcPad(p).is(p.face > 0 ? 'right' : 'left');
    return { name: 'pc_sphere', clip: 'pcCast', dur: 0.55, noCounter: true,
      events: [evAt(0.02, e => fxCharge(e, '#fff2a0', 2)), evAt(0.42, e => { const scrap = skLv(e, 'pc_shrapnel') > 0 && !(isHuman(e) && pcSw('pc_shrapnel'));
        const s = summon(e, 'pc_sphere_f', { x: e.x + e.face * (far ? 210 : 120), y: e.y, lv }); if (s) Object.assign(s, { dmg: pcOrbDmg(lv), nHit: 0, scrap }); sfx.charge(); })] }; } });
defSkill('pc_shrapnel', { name: '神圣琉璃球', cls: 'priest', job: PCJ, lvReq: 19, maxLv: 1, sp: 10, mp: 0, cd: 0, type: 'indep', elem: 'light', passive: true, col: '#fff2a0', icon: 'pc_sphere', pre: { pc_sphere: 1 }, switchOpt: '神圣琉璃球',
  desc: '【被动 · 可开关】圣光球改为向前飞的琉璃球：不再多段攻击，碰到敌人（或 3 秒后）就地爆炸，攻击力是一段光球的 14 倍，并让 300px 内的敌人眩晕 6 秒。技能窗口里可以关闭。' });
// 圣光聚合：接受洗礼的光柱落在自己身上 → 砸地 → 爆炸并把周围的敌人吸过来（光柱 : 砸地 : 爆炸 ≈ 1 : 2 : 7.6）
const pcHaptDmg = lv => skillDmg(4.5, 0.45, lv);
defSkill('pc_haptism', { name: '圣光聚合', cls: 'priest', job: PCJ, lvReq: 19, sp: 30, mp: 32, cd: 10, type: 'indep', elem: 'light', col: '#ffe8a0',
  desc: '让神圣洗礼的光柱落在自己身上，砸地后爆炸，把 220px 内的敌人吸到身边。施放很快、范围不小，可以在普攻中取消施放；本身没有霸体和无敌。',
  pow: pcHaptDmg, ai: { kind: 'aoe', r: [0, 200], dy: 60 }, infoExtra: lv => [['吸怪范围', '220px']],
  act: lv => { const T = pcHaptDmg(lv);
    return { name: 'pc_haptism', clip: 'pcRaise', dur: 0.5, noCounter: true, noSA: true,
      events: [evAt(0.04, e => { pcPillar(e.x, e.y, { w: 90, h: 280, dur: 0.4, col: '#fff0b0' }); sfx.charge(); areaHit(e, e.x, e.y, 70, 0, { dmg: T * 0.094, type: 'indep', elem: 'light', stun: 0.3, knock: 0, hs: 0.02, downHit: true }, { zMax: 160 }); }),
        evAt(0.16, e => { fxShock(e.x, e.y, 120, '#fff0b0'); fxDust(e.x, e.y, 5, 14); areaHit(e, e.x, e.y, 110, 0, { dmg: T * 0.188, type: 'indep', elem: 'light', stun: 0.35, knock: 0, hs: 0.03, downHit: true }, { zMax: 120 }); }),
        evAt(0.26, e => { cam.shake = Math.max(cam.shake, 4); sfx.boom(0.6); fxSpr('burst', e.x, e.y, 50, { w: 260, dur: 0.4, col: '#fff0b0', grow: [0.4, 1.1] }); fxShock(e.x, e.y, 240, '#ffe8a0');
          for (const t of ents) if (foe(e, t) && !t.dead && t.invul <= 0 && inGround(t, e.x, e.y, 220) && pcMovable(t)) { t.x = lerp(t.x, e.x + e.face * 40, 0.75); t.y = lerp(t.y, e.y, 0.6); }
          areaHit(e, e.x + e.face * 30, e.y, 150, 0, { dmg: T * 0.718, type: 'indep', elem: 'light', stun: 0.5, knock: 30, hs: 0.07, downHit: true, col: '#fff0b0' }, { zMax: 160 }); })] }; } });
// 忏悔之锤：用神圣之力凝成的巨锤砸下（前方很宽、身后也有一点），挥锤时霸体；锤子打中有几率让敌人忏悔（本作：混乱，敌人乱走不攻击；领主几率 / 时长减半，决斗场无效）；落点再出一圈冲击波
const pcHammerDmg = lv => ({ swing: skillDmg(4.6, 0.46, lv), wave: skillDmg(1.9, 0.19, lv) });
defSkill('pc_hammer', { name: '忏悔之锤', cls: 'priest', job: PCJ, lvReq: 19, sp: 45, mp: 40, cd: 14.4, type: 'indep', elem: 'light', speed: 'cspd', col: '#ffe070',
  desc: '挥下用神圣之力凝成的巨大战锤：前方判定很宽，身后也会打到一点；挥锤期间霸体（挥锤速度受施放速度影响）。被锤子打中的敌人有几率陷入“忏悔”（本作：混乱，乱走、不攻击你；领主几率和时长减半，决斗场无效），落点再震出一圈冲击波（冲击波不会让敌人忏悔）。',
  pow: lv => pcHammerDmg(lv).swing + pcHammerDmg(lv).wave, ai: { kind: 'burst', r: [0, 230], dy: 70 }, infoExtra: lv => [['冲击波攻击力', pct(pcHammerDmg(lv).wave)], ['忏悔几率', pct(Math.min(1, 0.6 + 0.04 * lv))], ['忏悔时间', '8 秒']],
  act: lv => { const D = pcHammerDmg(lv);
    return { name: 'pc_hammer', clip: 'pcHammer', dur: 0.72, noCounter: true, superArmor: [0, 0.5],
      events: [evAt(0.04, e => { pcHammerFx(e, e.x + e.face * 60, { s: 1.25, dur: 0.5 }); sfx.swing(true); }), evAt(0.3, e => { cam.shake = Math.max(cam.shake, 6); sfx.boom(0.8); fxDust(e.x + e.face * 150, e.y, 8, 30); })],
      hits: [HB(0.24, 0.32, [-90, 250, 76, 0, 200], D.swing, { type: 'indep', elem: 'light', stun: 0.7, knock: 90, hs: 0.1, shake: 5, big: 1.6, heavy: true, snd: 'blunt', col: '#fff0a0',
        onHit: (a, t) => { if (!game.pvp && !t.dead && Math.random() < Math.min(1, 0.6 + 0.04 * lv) * (t.boss ? 0.5 : 1)) { addStatus(t, 'confuse', t.boss ? 4 : 8, { src: a }); fxText('忏悔', t.x, t.y, t.z + 40, { col: '#ffe070', size: 11 }); } } })],
      update: e => { const a = e.act; if (!a.wave && e.actT >= 0.38) { a.wave = true; const x = e.x + e.face * 150; fxShock(x, e.y, 200, '#ffe070'); fxSpr('wave', x, e.y, 30, { h: 110, dur: 0.3, col: '#ffe8a0' });
        areaHit(e, x, e.y, 170, 0, { dmg: D.wave, type: 'indep', elem: 'light', launch: 260, knock: 120, hs: 0.05, downHit: true, col: '#ffe8a0' }, { zMax: 90 }); } } }; } });
// 正义审判：前方展开神圣法阵，光之刃连续落下（16 段，每 0.07 秒），之后正义天使从地下现身投出光之长矛（刃 : 矛 ≈ 1 : 1）；落刃中按跳跃键立即召唤天使；全程霸体
const pcJudgeDmg = lv => ({ blade: skillDmg(0.56, 0.056, lv), spear: skillDmg(9, 0.9, lv) });
defSkill('pc_judge', { name: '正义审判', cls: 'priest', job: PCJ, lvReq: 20, sp: 50, mp: 60, cd: 45, type: 'indep', elem: 'light', cast: true, col: '#fff6c0', pre: { pc_spear: 1 },
  desc: '在前方展开神圣魔法阵，光之刃接连落下（16 段），最后正义天使从地下升起，向阵中投出光之长矛造成大爆炸。落刃期间按跳跃键立即召唤天使。施放时间 0.6 秒，全程霸体；打中的敌人是硬直（不是强制控制），被打飞前记得接天使。',
  pow: lv => pcJudgeDmg(lv).blade * 16 + pcJudgeDmg(lv).spear, ai: { kind: 'aoe', r: [60, 360], dy: 80 }, infoExtra: lv => [['光之刃', pct(pcJudgeDmg(lv).blade) + ' × 16'], ['光之长矛', pct(pcJudgeDmg(lv).spear)], ['法阵半径', '170px']],
  act: lv => { const D = pcJudgeDmg(lv);
    return { name: 'pc_judge', clip: 'pcCast', dur: 2.4, noCounter: true, superArmor: true,
      onStart: e => { e.act.cx = e.x + e.face * 200; e.act.cy = e.y; e.act.n = 0; fxCharge(e, '#fff6c0', 3); },
      onInput: (e, I) => { const a = e.act; if (I.buffered('jump') && a.n > 0 && !a.angel) { I.consume('jump'); a.skip = true; return true; } return false; },
      update: e => { const a = e.act, T0 = 0.6;
        if (e.actT >= T0 && !a.circle) { a.circle = true; pcCircle(a.cx, a.cy, 170, '#fff2a0', 1.7); sfx.buff(); }
        while (!a.angel && !a.skip && a.n < 16 && e.actT >= T0 + a.n * 0.07) { a.n++; const x = a.cx + rnd(-140, 140), y = clamp(a.cy + rnd(-40, 40), 4, DEPTH - 4);
          pcSpearFx(x, y, 60, 90, Math.PI / 2, '#fff8e0', 0.2); if (a.n % 3 === 0) sfx.swing(false);
          blast(e, a.cx, a.cy, 170, { dmg: D.blade, type: 'indep', elem: 'light', stun: 0.3, knock: 0, hs: 0.01, downHit: true, col: '#fff8e0' }, { zMax: 150 }); }
        if (!a.angel && (a.skip || a.n >= 16)) { a.angel = e.actT; e.play('pcRaise', true); pcPillar(a.cx, a.cy, { w: 110, h: 300, dur: 0.8, col: '#fff6c0' });
          fxSpr('slash', a.cx - 40, a.cy, 170, { w: 150, dur: 0.7, col: '#fffaf0', rot: -0.4, flip: true }); fxSpr('slash', a.cx + 40, a.cy, 170, { w: 150, dur: 0.7, col: '#fffaf0', rot: 0.4 }); sfx.charge(); a.dur = e.actT + 0.8; }
        if (a.angel && !a.boom && e.actT >= a.angel + 0.35) { a.boom = true; pcSpearFx(a.cx, a.cy, 110, 260, Math.PI / 2, '#fff2a0', 0.3); cam.shake = Math.max(cam.shake, 10); cam.flash = 0.08; cam.flashCol = '#fff6d0'; sfx.boom(1.1);
          fxSpr('burst', a.cx, a.cy, 40, { w: 340, dur: 0.5, col: '#fff2a0', grow: [0.4, 1.15] }); fxShock(a.cx, a.cy, 300, '#fff2a0'); pcCrossFx(a.cx, a.cy, 90, 240, '#fff2a0', 0.6);
          blast(e, a.cx, a.cy, 190, { dmg: D.spear, type: 'indep', elem: 'light', launch: 460, knock: 160, hs: 0.14, big: 2, downHit: true, col: '#fff2a0' }, { zMax: 220 }); } } }; } });
// 圣光十字：投出圣力十字架，打中就爆炸，圣骑士脚下出现五芒星阵：阵里的自己 15 秒所有速度提高；守护路线阵里的队友也提高
// 学了神之代行者：十字架 / 爆炸 / 法阵更大，命中位置的法阵也给 BUFF，没打中也在自己脚下生成法阵
const pcCrossDmg = lv => ({ cross: skillDmg(1.55, 0.155, lv), boom: skillDmg(2.05, 0.205, lv) });
defSummon('pc_cross_f', { kind: 'field', life: 1.4, max: 3, over: 'oldest', keepRoom: false, col: '#ffe070' });
function pcCrossField(e, x, y, r = 150) {
  const s = summon(e, 'pc_cross_f', { x, y }); if (!s) return; pcCircle(x, y, r, '#ffe070', 1.4, { spin: 1.2 });
  const sup = pcGuard(e), lvC = skLv(e, 'pc_cross') || 1;
  for (const t of pcMembers(e, 2000)) { if (!inGround(t, x, y, r + 20) || (t !== e && !sup)) continue;
    const v = t === e ? 0.05 + (sup ? 0.0125 + 0.0025 * lvC : 0) : 0.0125 + 0.0025 * lvC;
    pcGive(e, t, 'buff', { id: 'pc_cross', b: { t: 15, aspd: v, cspd: v, mspd: v, name: '圣光十字', col: '#ffe070' }, aura: '#ffe070' }); }
}
defSkill('pc_cross', { name: '圣光十字', cls: 'priest', job: PCJ, lvReq: 17, sp: 25, mp: 25, cd: 8, type: 'indep', elem: 'light', col: '#ffe070',
  desc: '向前投出圣力十字架，打中敌人时爆炸，并在自己脚下生成五芒星阵：阵里的自己 15 秒内攻击 / 移动 / 施放速度提高（守护路线：阵里的队友也提高）。十字架被挡住（打中但没爆开）不算打中。学了神之代行者：十字架、爆炸、法阵都变大，命中处的法阵也有 BUFF，没打中也会在自己脚下生成法阵。',
  pow: lv => pcCrossDmg(lv).cross + pcCrossDmg(lv).boom, ai: { kind: 'poke', r: [40, 400], dy: 30 }, infoExtra: lv => [['爆炸攻击力', pct(pcCrossDmg(lv).boom)], ['自己速度', '+5%（15 秒）'], ['守护路线：队友速度', '+' + pct(0.0125 + 0.0025 * lv)]],
  act: (lv, p) => { const D = pcCrossDmg(lv), big = skLv(p, 'pc_agent') > 0 ? 1.4 : 1;
    return { name: 'pc_cross', clip: 'pcThrow', dur: 0.42, noCounter: true,
      events: [evAt(0.1, e => { sfx.swing(true); let hit = false;
        const pr = spawnProj({ owner: e, x: e.x + e.face * 40, y: e.y, z: e.z + 60, vx: e.face * 760, face: e.face, life: 0.55, w: 18 * big, d: 20 * big, h: 40 * big, pierce: false,
          hit: { dmg: D.cross, type: 'indep', elem: 'light', stun: 0.4, knock: 40, hs: 0.05, col: '#ffe070' },
          onHitT: (q, t) => { if (hit) return; hit = true; const x = q.x; cam.shake = Math.max(cam.shake, 4); sfx.boom(0.5); fxSpr('burst', x, q.y, 60, { w: 170 * big, dur: 0.4, col: '#ffe070' }); pcCrossFx(x, q.y, 60, 130 * big, '#ffe070');
            blast(e, x, q.y, 100 * big, { dmg: D.boom, type: 'indep', elem: 'light', launch: 300, knock: 80, hs: 0.07, downHit: true, col: '#ffe070' }, { zMax: 150 });
            pcCrossField(e, e.x, e.y, 150 * big); if (big > 1) pcCrossField(e, x, q.y, 150 * big); },
          onEnd: () => { if (!hit && big > 1) pcCrossField(e, e.x, e.y, 150 * big); },
          draw(c, q) { drawSpr(c, fxTint('crossx', '#ffe070'), sx(q.x), sy(q.y, q.z), 70 * big, 0, { rot: Math.PI / 4 + q.t * 14 }); } }); })] }; } });

/* =====================================================================
   普攻改写：圣灵之槌 / 神罚之锤（官方：变成驱魔师那样的巨兵 3 连击、距离更长；第 3 下和空斩打震出圣光冲击波；神罚之锤：光属性独立攻击、跑攻投出圣光雷枪）
   ===================================================================== */
const PC_ACTS = {};
function pcHolyShock(e, jup, back) {
  const x = e.x + e.face * (back ? -90 : 110), lv = skLv(e, jup ? 'pc_jupiter' : 'pc_mace') || 1;
  pcPillar(x, e.y, { w: 80, h: 200, dur: 0.35, col: jup ? '#fff38a' : '#ffe8a0' }); fxShock(x, e.y, 140, jup ? '#fff38a' : '#ffe8a0'); if (jup) pcBoltFx(x, e.y, 230);
  areaHit(e, x, e.y, 110, 0, { dmg: skillDmg(0.9, 0.06, lv), type: 'indep', elem: 'light', launch: 240, knock: 80, hs: 0.05, downHit: true, col: '#fff2a0' }, { zMax: 140 });
}
function pcHolyLightning(e) {
  const lv = skLv(e, 'pc_jupiter') || 1; pcSpearFx(e.x + e.face * 90, e.y, e.z + 50, 160, e.face > 0 ? 0 : Math.PI, '#fff38a', 0.3);
  for (let i = 0; i < 3; i++) game.after(i * 0.08, () => { if (e.dead) return; pcBoltFx(e.x + e.face * (50 + i * 45), e.y, 150);
    instantHit(e, { box: [0, 160, 40, 0, 130], dmg: skillDmg(0.35, 0.025, lv), type: 'indep', elem: 'light', stun: 0.3, knock: 30, hs: 0.03, downHit: true, col: '#fff38a' }); });
}
function pcActsFor(w, jup) {
  const key = (w || 'cross') + (jup ? '|j' : '|m'); if (PC_ACTS[key]) return PC_ACTS[key];
  const F = PRIEST_FEEL[w] || PRIEST_FEEL.cross, B = priestActsFor({ reach: F.reach * 1.2, stun: F.stun }), A = {};
  const sw = h => jup ? { ...h, type: 'indep', elem: 'light', col: '#fff38a' } : h;
  for (const n in B) A[n] = { ...B[n], hits: B[n].hits.map(sw), events: [...(B[n].events || [])] };
  A.atk3.events.push(evAt(0.22, e => pcHolyShock(e, jup)));
  if (jup) { A.dash.events.push(evAt(0.1, e => pcHolyLightning(e))); A.jatk.hits = A.jatk.hits.map(h => ({ ...h, box: [h.box[0], Math.round(h.box[1] * 1.3), Math.round(h.box[2] * 1.3), h.box[3], h.box[4]] })); }
  return (PC_ACTS[key] = A);
}
PRIEST_ACT_PICK.push(p => pcOn(p) && p.buffs && (p.buffs.pc_jupiter || p.buffs.pc_mace) ? pcActsFor(wtypeOf(p), !!p.buffs.pc_jupiter) : null);

/* =====================================================================
   钩子：光之复仇 / 圣力层数 / 守护恩赐的属性伤害 / 快速愈合 / 冷却 / 圣灵之槌与神罚之锤改基础技能
   ===================================================================== */
// 神圣洗礼：信仰之翼的圣力（最多 5 层）：施放辅助技能 / 攻击技能打中时 +1
function pcHolyAdd(p, n) { const b = p.buffs && p.buffs.pc_holy; if (!b) return; b.n = Math.min(5, b.n + n); b.lab = '×' + b.n; }
PRIEST_HOOKS.onHit.push((p, t, h, dmg, act) => {
  if (!pcOn(p) || h.pcBolt) return;
  if (p.buffs.pc_revenge && !t.dead && game.t - (p._pcBoltT ?? -9) >= 0.2 && Math.abs(t.x - p.x) < 700) { p._pcBoltT = game.t; pcBoltOn(p, t, false); }
  if (act && act.skill && SKILLS[act.skill] && !act._pcHoly && (act.skill.startsWith('pc_') || act.skill === 'p_purity')) { act._pcHoly = true; pcHolyAdd(p, 1); }
  if (pcGuard(p) && !soloPlay() && !t.dead) { t.buffs = t.buffs || {}; const b = t.buffs.pc_vuln || (t.buffs.pc_vuln = { t: 10, taken: 0, n: 0 }); if (!act || act._pcVuln !== t.id) { if (act) act._pcVuln = t.id; b.n = Math.min(3, b.n + 1); } b.t = 10; b.taken = 0.055 * b.n; }
});
PRIEST_HOOKS.onHurt.push((p, a, h) => {
  if (!pcOn(p) || !p.buffs.pc_revenge || !a || a === p || a.team === p.team || a.dead || game.t - (p._pcBoltH ?? -9) < 0.25) return;
  if (Math.random() < ((h && h.type === 'mag') ? 0.8 : 0.42)) { p._pcBoltH = game.t; pcBoltOn(p, a.owner && a.owner.team !== p.team ? a.owner : a, Math.random() < 0.1); }
});
PRIEST_HOOKS.onCast.push((p, id, act, how) => {
  if (!pcOn(p) || how === 'recast') return;
  const S = SKILLS[id]; if (!S) return;
  // 守护路线单刷：技能冷却 −20%（觉醒除外）
  if (pcGuard(p) && soloPlay() && !S.awaken && p.cool[id] > 0) p.cool[id] *= 0.8;
  // 快速愈合：缓慢愈合 0.5 秒放完、1 秒内回复 135%
  if (id === 'p_slowheal' && act && pcGuard(p) && skLv(p, 'pc_fastheal') > 0) {
    act.dur = 0.5; act.events = [evAt(0.02, e => { fxCharge(e, '#9ff0b8', 2); sfx.charge(); }), evAt(0.32, e => { const t = pcPickMate(e, 945) || e, v = pHealPct(e, skLv(e, 'p_slowheal') || 1) * 1.35;
      pcGive(e, t, 'buff', { id: 'p_slowheal', b: { t: 1.2, hot: v, name: '快速愈合', col: P_COL.heal }, aura: P_COL.heal });
      fxSpr('heal', t.x, t.y, t.z + 70, { w: 110, dur: 0.6, col: '#9ff0b8', grow: [0.6, 1.1] }); pPrayFx(e, P_COL.heal); sfx.buff(); fxText('快速愈合', t.x, t.y, t.z + 20, { col: '#b8ffd2', size: 11 }); pcHolyAdd(e, 1); })].map(ev => ({ ...ev, done: false }));
  }
  if ((id === 'p_cure' || id === 'p_slowheal' || id === 'pc_revenge') && act) pcHolyAdd(p, 1);
  // 圣灵之槌 / 神罚之锤：空斩打震出圣光冲击波（神罚之锤：开头身前、结尾身后各一次）
  if (id === 'p_launcher' && act && (p.buffs.pc_mace || p.buffs.pc_jupiter)) { const jup = !!p.buffs.pc_jupiter; act.events = [...(act.events || []), { t: 0.14, done: false, fn: e => pcHolyShock(e, jup) }]; if (jup) act.events.push({ t: 0.42, done: false, fn: e => pcHolyShock(e, true, true) }); }
  // 神罚之锤：落凤锤变成雷霆重击（落地多出三道圣光雷）
  if (id === 'p_phoenix' && act && p.buffs.pc_jupiter) { const o = act.onLand; act.onLand = e => { o(e); if (act.onLand === null && !act._pcTc) { act._pcTc = true; pcThunderCrush(e); } }; }
});
function pcThunderCrush(e) {
  const lv = skLv(e, 'pc_jupiter') || 1, x = e.x + e.face * 26; fxText('雷霆重击', e.x, e.y, e.z + 60, { col: '#fff38a', size: 12 });
  for (let i = 0; i < 3; i++) game.after(0.05 + i * 0.07, () => { const bx = x + (i - 1) * 90; pcBoltFx(bx, e.y, 280); sfx.hit('crit', false); areaHit(e, bx, e.y, 90, 0, { dmg: skillDmg(0.7, 0.05, lv), type: 'indep', elem: 'light', launch: 300, knock: 60, hs: 0.04, downHit: true, col: '#fff38a' }, { zMax: 120 }); });
}
