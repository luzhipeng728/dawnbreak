/* =====================================================================
   91c. 决斗场（PvP 原型）：玩家 vs AI 控制的另一个职业角色（?duel=sword&vs=gun），一局定胜负，每局 90 秒（开局 3 秒倒计时不算）
   ?duel=<职业|me>&vs=<职业>&job=<转职>&vsjob=<转职>&lv=30&ai=1..3&auto（自己也交给 AI，自动测试用）&theme=<场景>
   - 天平系统：双方按职业写入一套固定的 PvP 属性（不看装备，HP ×hpMul），伤害再乘决斗场修正（engine/combat.js 的 PVP）
   - 保护机制（engine/combat.js + 本文件 PVP_PROT，docs/PVP.md §5）：平推 / 浮空一级·二级 / 倒地（含二次浮空）/ 硬直 / 时间保护、抓取保护；燃斗模式（HP ≤25%：攻击 +15%、受到伤害 −10%）
   - 开局：3 秒倒计时（能走、能放 BUFF，不能攻击）；大技能 / 觉醒开局就在冷却（DUEL_START_CD，官方“起始冷却时间”）
   - 决斗不写玩家存档（存档键切到 dawnbreak_duel）
   ===================================================================== */
// 一局定胜负（用户要求，2026-09-29；原来三局两胜）；决斗等级固定 Lv30（PVP_JOB / DUEL_BASE 都是按 Lv30 技能等级调的，见 docs/PVP.md）
// hpMul / mpMul：决斗 HP / MP 倍率（2026-09-30 用户：“两套技能就结束战斗了”→ 同水平一局 40~60 秒）；保护阈值按原 HP 算（PVP_PROT），连招长度不变、占的血量比例变小
// guard：每局开始的倒计时秒数（能走、能放 BUFF / 加状态的技能，不能普攻和放伤害技能，双方的 AI 和联机两边都一样）
const DUEL_CFG = { rounds: 1, time: 90, lv: 30, hpMul: 1.7, mpMul: 1.5, guard: 3 };
const DUEL_BASE = {   // 每个职业的 PvP 基准属性（天平后）
  sword: { hp: 21000, mp: 4200, atk: 2100, matk: 1800, def: 2100, mdef: 1800 },
  gun: { hp: 19500, mp: 4400, atk: 2000, matk: 1700, def: 1900, mdef: 1900 },
  mage: { hp: 18000, mp: 5600, atk: 1300, matk: 2150, def: 1700, mdef: 2200 },
  fighter: { hp: 21000, mp: 4200, atk: 2100, matk: 1800, def: 2100, mdef: 1800 },   // 男格斗家和鬼剑士同一档（近战、官方四维相同），强弱由 PVP_JOB 调（B9，docs/PVP.md §4）
};
function duelStats(p) {
  const B = DUEL_BASE[p.cls], C = CLASSES[p.cls];
  const hp = Math.round(B.hp * DUEL_CFG.hpMul), mp = Math.round(B.mp * DUEL_CFG.mpMul);
  Object.assign(p, { hpMax: hp, hp, mpMax: mp, mp, atk: B.atk, matk: B.matk, indep: B.atk, def: B.def, mdef: B.mdef, crit: 0.12, mcrit: 0.12, baseCrit: 0.12, baseMcrit: 0.12, critDmg: 1.5,
    aspd: 1, cspd: 1, mspd: 1, hitRate: 0.05, evade: 0.03, hardness: 0, stagger: 0, elem: null, res: null, cdMul: 1, dmgUp: 0, dmgTaken: 1, atkElem: null, lvl: DUEL_CFG.lv,
    // 公正决斗：装备 / 强化 / 增幅 / 锻造 / 宝珠 / 附魔 / 套装 / 史诗特效 / 时装 / 宠物 / 称号 / 图鉴 / 公会 / 虚弱全部不带进来（这些都在 recalcStats 里，决斗角色不走它）
    gearProcs: [], sets: {}, mastery: null, masteryN: 0, killHeal: 0, killMp: 0, mpRegen: 1, weak: false, goldUp: 0, expUp: 0 });
  const J = C.jobs && p.kit && C.jobs[p.kit.job];
  const pj = PVP_JOB[p.cls + ':' + ((p.kit && p.kit.job) || '')] ?? 1;   // 职业平衡修正（docs/PVP.md，AI 循环赛调出来的）：造成伤害倍率 [, 受到伤害倍率]
  p.dmgUp = (Array.isArray(pj) ? pj[0] : pj) - 1; p.dmgTaken = Array.isArray(pj) ? pj[1] : 1;
  if (J && J.dmgType === 'mag') { p.matk = Math.max(B.matk, B.atk); p.dmgType = 'mag'; }   // 神枪手里的魔法转职（机械师）：决斗魔攻不低于同职业物理转职的物攻
  p.baseStats = { atk: B.atk, speed: C.speed * 1.1, runSpeed: C.runSpeed * 1.1 };
  applyBuffs(p);
}
const firstJob = cls => openJobs(cls)[0] || null;   // 没开放的转职（J.ready === false）不选
/* ---- 公正决斗（排位 / 练习 / 好友决斗都一样，地下城不受影响）：规则见 docs/PVP.md ----
   技能等级：决斗等级（30）下本职业 + 转职能学的技能全部按标准等级 1 + ⌊(30 − 需求等级) / 3⌋（不超过满级），和 SP 加点、装备的技能等级无关；
   觉醒（一 / 二 / 三觉）在决斗里全部可用，不看觉醒任务；每局最多放一次（冷却至少 61 秒，每局开始冷却清零）。技能栏沿用玩家自己的摆放（只保留能用的技能） */
function duelKit(cls, job, bar) {
  const K = aiKit(cls, job, DUEL_CFG.lv);
  if (Array.isArray(bar) && bar.some(Boolean)) K.bar = Array.from({ length: SKILL_SLOTS }, (_, i) => { const id = bar[i]; return id && K.lv[id] > 0 && SKILLS[id] && !SKILLS[id].passive ? id : null; });
  const J = CLASSES[cls].jobs && CLASSES[cls].jobs[job];
  if (J && J.auto) for (const id of J.auto) if (!(K.lv[id] > 0)) K.lv[id] = 1;
  return K;
}
// 决斗里对照用的“公正属性”快照（测试 / 联机两端核对）
function duelFairSnap(p) {
  const r = v => Math.round(v * 1000) / 1000;
  return { cls: p.cls, job: (p.kit && p.kit.job) || null, lvl: p.lvl, hpMax: p.hpMax, mpMax: p.mpMax, atk: r(p.baseStats ? p.baseStats.atk : p.atk), matk: r(p.matk), indep: r(p.indep), def: r(p.def), mdef: r(p.mdef),
    crit: r(p.baseCrit), critDmg: p.critDmg, aspd: p.aspd, cspd: p.cspd, mspd: p.mspd, cdMul: p.cdMul, dmgUp: r(p.dmgUp), dmgTaken: p.dmgTaken, hitRate: p.hitRate, evade: p.evade,
    skills: Object.keys((p.kit && p.kit.lv) || {}).sort().map(k => k + ':' + p.kit.lv[k]).join(','), procs: (p.gearProcs || []).length, sets: Object.keys(p.sets || {}).length };
}
// 决斗中别的系统（换装 / 公会 / 任务 / 装备损坏）想重算属性：决斗角色一律忽略
{ const rs0 = recalcStats; recalcStats = function (p) { if (p && p.fighter && game.pvp && game.duel && p.kit) return; return rs0(p); }; }
// 决斗里所有觉醒都能放（不看觉醒任务）
{ const tu0 = tierUnlocked; tierUnlocked = function (n) { return game.pvp && game.duel ? true : tu0(n); }; }
// 决斗里的控制上限（docs/PVP.md「抓取 / 强制硬直」）：强制硬直 hold（格斗家组，无视霸体）最长 1 秒，结束后 1.5 秒内不能再被 hold（和抓取保护一样）；束缚最长 3 秒。地下城不受影响
// 格斗家的持续伤害（街霸的毒 / 出血、气功师的感电追加）在决斗里也吃 PVP.dmg 和职业修正（updateStatus 直接扣血，不走 applyHit；老职业的没改，免得动已调好的平衡）
const PVP_CTRL = { hold: 1.0, holdProt: 1.5, bind: 3 };
{ const as0 = addStatus; addStatus = function (t, kind, dur, o = {}) {
  if (game.pvp && game.duel && t && t.fighter) {
    if (game.duel.state === 'fight' && game.duel.guardT > 0) return;   // 开局倒计时：异常状态一律无效
    if (kind === 'hold') { if (game.t < (t.pvpHoldProt || 0)) return; dur = Math.min(dur, PVP_CTRL.hold); t.pvpHoldProt = game.t + dur + PVP_CTRL.holdProt; }
    else if (kind === 'bind') dur = Math.min(dur, PVP_CTRL.bind);
    const s = o.src; if (s && s.cls === 'fighter' && (o.dps || o.hitDmg)) { const k = PVP.dmg * (1 + (s.dmgUp || 0)) * (t.dmgTaken ?? 1); o = { ...o, dps: (o.dps || 0) * k, hitDmg: (o.hitDmg || 0) * k }; }
  }
  return as0(t, kind, dur, o);
}; }
/* ---- 决斗场伤害修正（全局 PVP.dmg 之外，按技能类型的默认系数；职业文件里写了 S.pvp 的以职业为准）---- */
const PVP_SKILL = { awaken: 0.5, grab: 0.8, summon: 0.8, burst: 0.85, aoe: 0.9 };
// 职业（转职）整体修正：AI 循环赛（node test/pvp_balance.mjs 6 all 6）自动调出来的，1 = 不修正；数组 = [造成伤害, 受到伤害]（未转职技能太少，只加伤害追不上）
const PVP_JOB = {
  'sword:': [1.45, 0.55], 'sword:blade': 0.92, 'sword:berserker': 0.58, 'sword:asura': [0.31, 1.35], 'sword:soulbender': 0.54, 'sword:ghostblade': 0.83,
  'gun:': [2.2, 0.65], 'gun:ranger': 1.38, 'gun:launcher': 1.3, 'gun:spitfire': 1.0, 'gun:mechanic': 0.8, 'gun:paramedic': 1.62,
  'mage:': 2.0, 'mage:elemental': 1.19, 'mage:battlemage': 1.15, 'mage:summoner': 1.4, 'mage:witch': 1.17, 'mage:enchantress': 1.14,
  'fighter:': [1.53, 0.6], 'fighter:nenmaster': [0.32, 1.3], 'fighter:striker': 0.81, 'fighter:brawler': 0.45, 'fighter:grappler': 0.7,
};
for (const id in SKILLS) {
  const S = SKILLS[id]; if (!S || S.passive) continue;
  const kind = S.awaken ? 'awaken' : S.ai && S.ai.summon ? 'summon' : S.ai && S.ai.kind;
  if (S.pvp === undefined && PVP_SKILL[kind]) S.pvp = PVP_SKILL[kind];
  if (S.awaken && S.cd && S.cd * (S.pvpCd || 1) < DUEL_CFG.time + 1) S.pvpCd = (DUEL_CFG.time + 1) / S.cd;   // 觉醒每局一次
}
/* ---- 连招保护（docs/PVP.md §5，官方决斗场的五种保护；阈值都按“原 HP”= hpMax / hpMul 算）----
   平推（红）stand：站着挨打累计 22% → 强制击倒；浮空（蓝）air1 / air2：浮空中累计 20% → 一级保护（重力 ×1.6、再挑空 ×0.55，之后每 5% 再加一级），
   累计 30% → 二级保护（重力 ×2.8、挑不起来，只能收尾）——都不会在空中强制受身，落地后还能追击；
   倒地（黄）down：倒地后（第一次落地之后，被再挑起来的“二次浮空”也算）累计 20% → 强制起身 + 无敌 0.7 秒；
   硬直保护：同一轮每多挨一下硬直 −2.5%（最低 60%，combat.js PVP.stunDecay）；时间保护 lockMax：连续不能行动超过 7 秒（觉醒定格不算），下一下直接受身脱出；
   受击状态：浮空中挨打 ×0.85、倒地挨打 ×0.9（官方“状态保护”）；以上都在对方能行动 1 秒后清零（combat.js COMBAT.protReset） */
const PVP_PROT = { stand: 0.22, air1: 0.2, air2: 0.3, airStep: 0.05, down: 0.2, lockMax: 7, airDmg: 0.85, downDmg: 0.9 };
Object.assign(PVP, { airProt: PVP_PROT.air1 / DUEL_CFG.hpMul, airStep: PVP_PROT.airStep / DUEL_CFG.hpMul, downProt: PVP_PROT.down / DUEL_CFG.hpMul, standProt: PVP_PROT.stand / DUEL_CFG.hpMul });
JUGGLE.pvpRecover = 99;   // 不再到顶强制空中受身（二级保护后落地、倒地保护接手；时间保护兜底）
const duelProtHp = p => p.hpMax / DUEL_CFG.hpMul;
const duelAirLv = p => { const r = p.cmb.airDmg / duelProtHp(p); return r >= PVP_PROT.air2 ? 2 : r >= PVP_PROT.air1 ? 1 : 0; };   // 0 / 一级 / 二级（画在人物头上）
/* ---- 开局冷却（官方决斗场第 8 季“起始冷却时间”：大技能开局就在冷却，时长 = 技能的决斗冷却；手游“无色技能开场自动进入冷却”）----
   awaken：一 / 二 / 三觉开局冷却（秒）；决斗冷却 ≥ big 秒的技能开局整段冷却（最多 cap 秒）；mid ~ big 秒的开局冷却一半；更短的、BUFF 类开局就能用；skill：单个技能覆盖（秒，0 = 开局可用） */
const DUEL_START_CD = { awaken: [30, 40, 45], big: 14, cap: 42, mid: 8, midFrac: 0.5, skill: {} };
// 觉醒是第几觉：转职登记的 awaken / awaken2 / awaken3 为准，其次 S.tier，都没写（老职业的二 / 三觉）按学习等级（26 / 30 级）
function duelAwTier(id) { const S = SKILLS[id], C = S && CLASSES[S.cls]; for (const J of Object.values((C && C.jobs) || {})) { if (J.awaken3 === id) return 3; if (J.awaken2 === id) return 2; if (J.awaken === id) return 1; } return S.tier ? clamp(S.tier, 1, 3) : S.lvReq >= 30 ? 3 : S.lvReq >= 26 ? 2 : 1; }
function duelStartCdOf(id) {
  const S = SKILLS[id], T = DUEL_START_CD; if (!S || S.passive || !(S.act || S.instant)) return 0;
  if (T.skill[id] !== undefined) return T.skill[id];
  if (S.awaken) return T.awaken[duelAwTier(id) - 1];
  if (S.buff || (S.ai && S.ai.kind === 'buff')) return 0;
  const cd = (S.cd || 0) * (S.pvpCd || 1);
  return cd >= T.big ? Math.min(T.cap, cd) : cd >= T.mid ? cd * T.midFrac : 0;
}
function duelStartCd(p) { const L = (p.kit && p.kit.lv) || {}; for (const id in L) { if (!(L[id] > 0)) continue; const c = duelStartCdOf(id); if (c > 0) p.cool[id] = Math.max(p.cool[id] || 0, c); } }
/* ---- 开局倒计时（guard）：能走、能放 BUFF / 加状态的技能；普攻、伤害技能、命中、异常状态一律无效（联机对方用主机快照里的 gd）---- */
const duelGuardOn = p => !!(p && p.fighter && game.pvp && game.duel && game.duel.state === 'fight' && game.duel.guardT > 0);
const duelGuardFree = id => { const S = SKILLS[id]; return !!S && !S.awaken && (!!S.buff || (!!S.ai && (S.ai.kind === 'buff' || S.ai.kind === 'stance' || S.ai.kind === 'mode'))); };
{ const cs0 = castSkill; castSkill = function (p, id, viaCmd, key) {
  if (duelGuardOn(p) && !duelGuardFree(id)) { if (p === game.player && game.duel && game.t - (game.duel._gtT || -9) > 0.6) { game.duel._gtT = game.t; fxText('倒计时中不能攻击', p.x, p.y, p.z + 40, { col: '#ffd070', size: 11, dur: 0.6 }); } return false; }
  return cs0(p, id, viaCmd, key);
}; }
{ const da0 = Ent.prototype.doAct; Ent.prototype.doAct = function (def, extra) { if (def && def.basic && duelGuardOn(this)) return; return da0.call(this, def, extra); }; }
// 命中：倒计时中不算；时间保护（连续不能行动太久：这一下改成受身脱出）；受击状态修正（浮空 ×0.85、倒地 ×0.9）；二次浮空（第一次落地之后被再挑起来的伤害也算倒地保护）
function duelEscape(t) {
  if (t.st === 'down' || t.st === 'getup') { t.startGetup(true); t.invul = Math.max(t.invul, PVP.getupInvul); }
  else if (t.st === 'air' || t.z > 2) airRecover(t);
  else { t.stun = 0; t.invul = Math.max(t.invul, 0.5); }
  t.pvpLockT = 0; fxText('连招保护', t.x, t.y, t.z + 40, { col: '#9fe8ff', size: 11 }); fxAura(t, '#9fe8ff', 0.5);
}
/* ---- 决斗系数的口径统一（所有职业）：投射物 / 召唤物按“放出它的那个技能”的决斗系数算（原来按命中那一刻主人正在做的动作，
   主人放完觉醒去普攻，之前的子弹就变成 ×1；跟随型召唤物自己出手时根本不吃 PVP.dmg）---- */
let duelSumCtx = null;
const duelSkPvp = id => { const S = id && SKILLS[id]; return S && S.pvp !== undefined ? S.pvp : 1; };
{ const sp0 = spawnProj; spawnProj = function (o) { const p = sp0(o); if (game.pvp && p.hit && p.hit.pvp === undefined && o.owner) { const act = o.owner.act; p.hit = { ...p.hit, pvp: act ? (act.pvp ?? duelSkPvp(act.skill)) : 1 }; } return p; }; }
{ const su0 = summon; summon = function (owner, key, o) { const s = su0(owner, key, o); if (s && !s.fromSkill && owner && owner.act) s.fromSkill = owner.act.skill || null; return s; }; }
{ const sh0 = summonHit; summonHit = function (s, t, h, o) { const c0 = duelSumCtx; duelSumCtx = s; try { return sh0(s, t, h, o); } finally { duelSumCtx = c0; } }; }
// 召唤为主的转职：召唤物单独一个倍率（和 PVP_JOB 分开调；只加总倍率会让它的普通法术也一起变得离谱：召唤师 4 下打掉 63% HP）
const PVP_SUMMON = { 'mage:summoner': 3.0 };
const duelSumPvp = s => { const S = s && s.fromSkill && SKILLS[s.fromSkill], o = s && s.owner; return (S && S.pvp !== undefined ? S.pvp : PVP_SKILL.summon) * ((o && PVP_SUMMON[o.cls + ':' + ((o.kit && o.kit.job) || '')]) || 1); };
{ const ah0 = applyHit; applyHit = function (a, t, h, opt) {
  if (game.pvp && game.duel && a && t && t.fighter && !t.ghost && !a.fighter && a.summon && a.owner && a.owner.fighter && a.owner.team !== t.team) {   // 跟随型召唤物出手：按决斗伤害算
    if (game.duel.guardT > 0) return false;
    h = { ...h, dmg: (h.dmg ?? 1) * PVP.dmg * duelSumPvp(a) * (1 + (a.owner.dmgUp || 0)) / (1 + (a.dmgUp || 0)) };
    return ah0(a, t, h, opt);
  }
  if (!(game.pvp && game.duel && a && t && a.fighter && t.fighter && a.team !== t.team && !a.ghost && !t.ghost)) return ah0(a, t, h, opt);
  if (game.duel.guardT > 0) return false;
  if (duelSumCtx && h && h.pvp === undefined) h = { ...h, pvp: duelSumPvp(duelSumCtx) };   // 场地 / 附着型召唤物（summonHit 以主人的名义打）
  if ((t.pvpLockT || 0) > PVP_PROT.lockMax && t.st !== 'held') { duelEscape(t); return false; }
  const st0 = t.st, air0 = st0 === 'air' || t.z > 2, m0 = t.dmgTakenMul, c = t.cmb, dmg0 = c.dmg;
  t.dmgTakenMul = (m0 || 1) * (air0 ? PVP_PROT.airDmg : st0 === 'down' ? PVP_PROT.downDmg : 1);
  let r; try { r = ah0(a, t, h, opt); } finally { t.dmgTakenMul = m0; }
  if (c.landed && st0 !== 'down' && c.dmg > dmg0) c.downDmg += c.dmg - dmg0;
  if (c.landed && (t.st === 'air' || t.z > 2) && !t.dead && c.downDmg >= t.hpMax * PVP.downProt && !t.recoverLand) { airRecover(t); fxText('倒地保护', t.x, t.y, t.z, { col: '#9fe8ff', size: 10 }); }
  return r;
}; }
{ const rc0 = resetCmb; resetCmb = function (e) { rc0(e); if (e && e.cmb) e.cmb.landed = false; }; }
const duel = {
  state: 'none', t: 0, round: 1, wins: [0, 0], a: null, b: null, msg: '', msgT: 0, timer: 60, koT: 0, result: null,
  start(o) {
    this.o = o; this.round = 1; this.wins = [0, 0]; this.result = null;
    ents.length = 0; projs.length = 0; fxList.length = 0; drops.length = 0; groundFx.length = 0; numList.length = 0;
    game.scene = 'test'; game.pvp = true; game.duel = this; game.dungeon = null; game.lvl = o.lv;
    game.room = { x0: 0, x1: 1120, theme: o.theme, seed: 11 }; buildRoomArt(game.room);
    // 玩家一方：技能栏 / 等级写进 game（HUD 用），角色用同一份 kit
    const kA = duelKit(o.a, o.ja, o.me && o.me.skillBar);   // 我的角色：标准技能等级 + 自己的技能栏
    game.job = o.ja; game.skillLv = kA.lv; game.skillBar = kA.bar;
    const a = makePlayer(o.a, { kit: { bar: game.skillBar, lv: game.skillLv, job: o.ja, wtype: null, pool: kA.pool }, name: o.nameA || CLASSES[o.a].name });
    if (o.auto) { a.pad = new Pad(); a.brain = new FighterBrain(a, o.ai); }
    const b = makePlayer(o.b, { team: 'e', pad: new Pad(), kit: duelKit(o.b, o.jb), name: o.nameB || 'AI · ' + CLASSES[o.b].name });
    b.brain = new FighterBrain(b, o.ai);
    for (const p of [a, b]) { duelStats(p); const inner = p.brain ? aiFighterControl : playerControl; p.control = (e, dt) => { if (duel.state === 'fight') inner(e, dt); else if (e.pad !== input) { e.pad.frame(game.t); } }; }
    game.player = a; this.a = a; this.b = b; ents.push(a, b);
    cmdLabel(o.a); music.play('boss');
    this.resetRound();
  },
  resetRound() {
    projs.length = 0; groundFx.length = 0; game.timeStop = 0; game.cutin = null; game.slowmo = false;
    [[this.a, 330, 1], [this.b, 790, -1]].forEach(([p, x, f]) => {
      Object.assign(p, { x, y: DEPTH / 2, z: 0, vx: 0, vy: 0, vz: 0, face: f, dead: false, hp: p.hpMax, mp: p.mpMax, invul: 0, superArmor: 0, stun: 0, hitstop: 0, act: null, status: {}, buffs: {}, cool: {}, chasers: [], rot: 0, reboundCd: 0, bsCd: 0, charges: {}, burning: false, pvpHoldProt: 0, pvpLockT: 0 });
      if (p.brain) p.brain.reset();
      p.grabbed = null; p.heldBy = null; p.deadT = 0; p.remove = false; if (!ents.includes(p)) ents.push(p); p.setState('idle'); p.play('idle', true); resetCmb(p); applyBuffs(p);
      duelStartCd(p);   // 大技能 / 觉醒开局就在冷却（技能栏上直接显示）
    });
    this.state = 'intro'; this.t = 0; this.timer = DUEL_CFG.time; this.guardT = 0; this.say(`ROUND ${this.round}`, 1.1);
  },
  say(msg, dur = 1) { this.msg = msg; this.msgT = dur; this.msgDur = dur; },
  focusX() { return (this.a.x + this.b.x) / 2; },
  update(dt) {
    this.t += dt; if (this.msgT > 0) this.msgT -= dt;
    const A = this.a, B = this.b;
    if (this.state === 'intro') { if (this.t > 1.1) { this.state = 'fight'; this.guardT = DUEL_CFG.guard; this.msgT = 0; } return; }   // ROUND 1 → 3 秒倒计时（state 已经是 fight：能走、能放 BUFF）
    if (this.state === 'fight') {
      if (this.guardT > 0) { this.guardT -= dt; if (this.guardT <= 0) { this.guardT = 0; this.say('开始!', 0.8); sfx.boom(0.6); } }
      else this.timer -= dt;
      for (const p of [A, B]) {   // 时间保护：连续不能行动的时间（觉醒定格不算）；二次浮空：这一轮连招第一次落地之后的伤害都算倒地保护
        if (game.timeStop <= 0) p.pvpLockT = !p.dead && !(p.free || p.st === 'act') ? (p.pvpLockT || 0) + dt : 0;
        if (p.st === 'down' && p.cmb.hits > 0) p.cmb.landed = true;
      }
      for (const p of [A, B]) if (!p.burning && !p.dead && p.hp < p.hpMax * 0.25) { p.burning = true; p.buffs.burn_mode = { t: 999, atk: 0.15, taken: -0.1 }; fxText('燃斗模式', p.x, p.y, p.z + 20, { col: '#ff7a3a', size: 14, dur: 1.2 }); fxAura(p, '#ff6a2a', 1); }
      if (A.dead || B.dead || this.timer <= 0) this.ko(A.dead && B.dead ? -1 : A.dead ? 1 : B.dead ? 0 : (Math.abs(A.hp / A.hpMax - B.hp / B.hpMax) < 1e-6 ? -1 : A.hp / A.hpMax > B.hp / B.hpMax ? 0 : 1));   // 时间到：剩余 HP 比例高的赢，一样就平局
      return;
    }
    if (this.state === 'ko') {
      this.koT += dt; if (this.koT > 0.9) game.slowmo = false;
      const last = Math.max(this.wins[0], this.wins[1]) > DUEL_CFG.rounds / 2 || this.round >= DUEL_CFG.rounds;
      if (this.koT > (last ? 1.2 : 2.6)) { if (last) this.finish(); else { this.round++; this.resetRound(); } }   // 最后一局 K.O. 后 1.2 秒直接出结果
      return;
    }
    if (this.state === 'result') { if (input.hit('attack') || input.hit('confirm') || this.o.auto && this.t > 3) { if (this.o.auto) { window.__duelDone = this.result; this.state = 'done'; return; } this.start(this.o); } }
  },
  ko(winner) {
    this.state = 'ko'; this.koT = 0; game.slowmo = true;
    if (winner >= 0) this.wins[winner]++;
    this.lastWinner = winner;
    this.say(this.timer <= 0 ? 'TIME UP' : winner < 0 ? 'DOUBLE K.O.' : 'K.O.', 1.6); cam.shake = 10; sfx.boom(1.2);
    (this.roundLog = this.roundLog || []).push({ round: this.round, winner, hpA: Math.round(this.a.hp / this.a.hpMax * 100), hpB: Math.round(this.b.hp / this.b.hpMax * 100), time: Math.round(DUEL_CFG.time - this.timer) });
  },
  finish() {
    this.state = 'result'; this.t = 0; game.slowmo = false;
    const w = this.wins[0] > this.wins[1] ? 0 : this.wins[1] > this.wins[0] ? 1 : -1;
    this.result = { winner: w, wins: this.wins.slice(), rounds: this.roundLog.slice(), a: this.o.a + ':' + (this.o.ja || ''), b: this.o.b + ':' + (this.o.jb || '') };
    this.say(w === 0 ? 'YOU WIN' : w === 1 ? 'YOU LOSE' : 'DRAW', 99);
  },
  onKill(t, a) { if (t.fighter) { t.hp = 0; } },
  // ---- 画面：双方血条 / MP / 保护条 / 回合 / 计时 / 中央提示 ----
  drawOverlay(c) {
    const A = this.a, B = this.b;
    const bar = (p, x, w, right) => {
      const f = clamp(p.hp / p.hpMax, 0, 1), y = 14, h = 16;
      c.fillStyle = 'rgba(10,6,8,.75)'; c.fillRect(x - 3, y - 3, w + 6, h + 26);
      c.fillStyle = '#3a0a0a'; c.fillRect(x, y, w, h);
      p._hpShow = p._hpShow === undefined ? f : Math.max(f, p._hpShow - 0.004);
      c.fillStyle = '#ffd070'; c.fillRect(right ? x + w * (1 - p._hpShow) : x, y, w * p._hpShow, h);
      const g = c.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, p.burning ? '#ff9a3a' : '#ff5a5a'); g.addColorStop(1, p.burning ? '#c83a0a' : '#b0101a');
      c.fillStyle = g; c.fillRect(right ? x + w * (1 - f) : x, y, w * f, h);
      c.strokeStyle = '#e8c070'; c.lineWidth = 1.5; c.strokeRect(x, y, w, h);
      // MP 与保护条（红 = 平推、蓝 = 浮空：刻度是一级保护，满 = 二级保护、黄 = 倒地；阈值按原 HP，见 PVP_PROT）
      const mp = clamp(p.mp / p.mpMax, 0, 1); c.fillStyle = '#1a3a8a'; c.fillRect(x, y + h + 2, w, 3); c.fillStyle = '#5ab0ff'; c.fillRect(right ? x + w * (1 - mp) : x, y + h + 2, w * mp, 3);
      const ph = duelProtHp(p), bw = 80, bx = right ? x + w - bw : x;
      const P3 = [[(p.cmb.standDmg || 0) / (ph * PVP_PROT.stand), '#c84a4a'], [p.cmb.airDmg / (ph * PVP_PROT.air2), '#4a8ae8'], [p.cmb.downDmg / (ph * PVP_PROT.down), '#c8a02a']];
      P3.forEach(([v, col], i) => { const yy = y + h + 7 + i * 4; c.fillStyle = 'rgba(0,0,0,.5)'; c.fillRect(bx, yy, bw, 3); c.fillStyle = col; c.fillRect(bx, yy, bw * clamp(v, 0, 1), 3); });
      c.fillStyle = '#fff'; c.fillRect(bx + bw * PVP_PROT.air1 / PVP_PROT.air2 - 0.5, y + h + 10, 1, 5);
      const J = jobOf(p) && CLASSES[p.cls].jobs[jobOf(p)];
      c.font = 'bold 11px "PingFang SC","Microsoft YaHei",sans-serif'; c.textAlign = right ? 'right' : 'left'; c.fillStyle = '#fff';
      c.fillText(`${p.name}${J ? ' · ' + J.name : ''}  ${Math.max(0, Math.round(p.hp))}`, right ? x + w : x, y + h + 24);
      // 受身蹲伏：蹲伏中 / 冷却（双方都显示）
      const rc = p.reboundCd || 0; c.font = 'bold 10px "PingFang SC","Microsoft YaHei",sans-serif';
      c.fillStyle = p.techHold ? '#8fd8ff' : rc > 0 ? 'rgba(255,255,255,.45)' : '#9fe8b0';
      c.fillText(p.techHold ? '受身蹲伏中（无敌）' : rc > 0 ? `受身蹲伏 ${Math.ceil(rc)}s` : '受身蹲伏 就绪', right ? x + w : x, y + h + 37);
    };
    bar(A, 20, 380, false); bar(B, WW - 400, 380, true);
    // 浮空保护等级画在人物头上：一级 = 一个蓝色箭头，二级 = 两个（二级后挑不起来，该收尾了）
    if (this.state === 'fight') for (const p of [A, B]) { const lv = !p.dead && (p.st === 'air' || p.st === 'down' || p.z > 2) ? duelAirLv(p) : 0; if (!lv) continue;
      const X = sx(p.x), Y = sy(p.y, p.z + (p.h || 100) + 16); c.fillStyle = lv > 1 ? '#ff8a5a' : '#6ab0ff'; c.strokeStyle = '#0a1020'; c.lineWidth = 1.5;
      for (let i = 0; i < lv; i++) { const yy = Y - i * 7; c.beginPath(); c.moveTo(X - 7, yy - 4); c.lineTo(X, yy + 3); c.lineTo(X + 7, yy - 4); c.lineTo(X + 7, yy - 1); c.lineTo(X, yy + 6); c.lineTo(X - 7, yy - 1); c.closePath(); c.stroke(); c.fill(); } }
    // 开局倒计时：3、2、1（能走、能放 BUFF，不能攻击）
    if (this.state === 'fight' && this.guardT > 0) {
      const n = Math.ceil(this.guardT), k = this.guardT - Math.floor(this.guardT), sc = 1 + 0.4 * Math.max(0, k - 0.6);
      c.save(); c.textAlign = 'center'; c.font = `900 ${Math.round(64 * sc)}px "Arial Black",sans-serif`; c.lineWidth = 8; c.strokeStyle = '#1a0806'; c.strokeText(n, WW / 2, 210); c.fillStyle = '#ffe070'; c.fillText(n, WW / 2, 210);
      c.font = 'bold 14px "PingFang SC","Microsoft YaHei",sans-serif'; c.lineWidth = 4; const s = '准备：可以移动、放 BUFF，倒计时结束才能攻击'; c.strokeText(s, WW / 2, 238); c.fillStyle = '#fff'; c.fillText(s, WW / 2, 238); c.restore();
    }
    c.textAlign = 'center'; c.font = '900 26px "Arial Black",sans-serif'; c.lineWidth = 4; c.strokeStyle = '#1a0806';
    const tm = Math.max(0, Math.ceil(this.timer)); c.strokeText(tm, WW / 2, 38); c.fillStyle = tm <= 10 ? '#ff6a4a' : '#ffe8a8'; c.fillText(tm, WW / 2, 38);
    for (let i = 0; i < 2; i++) for (const [k, cx] of [[0, WW / 2 - 40 - i * 14], [1, WW / 2 + 40 + i * 14]]) { c.fillStyle = this.wins[k] > i ? '#ffd23a' : 'rgba(255,255,255,.25)'; c.beginPath(); c.arc(cx, 52, 5, 0, TAU); c.fill(); }
    if (this.msgT > 0 || this.state === 'result') {
      const k = this.state === 'result' ? 1 : clamp(this.msgT / this.msgDur, 0, 1), pop = 1 + Math.max(0, k - 0.8) * 2;
      c.save(); c.globalAlpha = Math.min(1, k * 4); c.font = `italic 900 ${Math.round(56 * pop)}px "Arial Black",sans-serif`; c.lineWidth = 8; c.strokeStyle = '#1a0806';
      c.strokeText(this.msg, WW / 2, 230); const g = c.createLinearGradient(0, 190, 0, 240); g.addColorStop(0, '#fff6c0'); g.addColorStop(1, '#ff9a2a'); c.fillStyle = g; c.fillText(this.msg, WW / 2, 230);
      if (this.state === 'result') { c.font = 'bold 16px "PingFang SC",sans-serif'; c.lineWidth = 4; const s = `${this.wins[0]} : ${this.wins[1]}　按 ${keyName('attack')} 再来一局 · Esc 离开决斗场`; c.strokeText(s, WW / 2, 268); c.fillStyle = '#fff'; c.fillText(s, WW / 2, 268); }
      c.restore();
    }
  },
};
// 启动参数：?duel=sword&vs=gun（boot.js 调用）
function duelParams() {
  const pick1 = (v, def) => CLASSES[v] ? v : def;
  let a = PARAMS.get('duel'), me = null;
  if (a === 'me') { const k0 = save.key; save.key = 'dawnbreak_save_v1'; try { if (save.load()) me = JSON.parse(JSON.stringify(save.data)); } catch (e) { /* 没有存档 */ } save.key = k0; a = me ? me.cls : 'sword'; }   // 只读正式存档，不写回
  a = pick1(a, 'sword'); const b = pick1(PARAMS.get('vs'), pick(openClasses()));   // 随机对手：已开放的职业（ready:false 的不抽）
  const jobOk = (cls, j) => j === 'none' ? null : CLASSES[cls].jobs && CLASSES[cls].jobs[j] ? j : firstJob(cls);
  return { a, b, ja: me && me.job ? me.job : jobOk(a, PARAMS.get('job')), jb: jobOk(b, PARAMS.get('vsjob')), lv: +(PARAMS.get('lv') || DUEL_CFG.lv), ai: clamp(+(PARAMS.get('ai') || 2), 1, 3),
    auto: PARAMS.has('auto'), theme: PARAMS.get('theme') || 'ruinsDark', nameA: me && me.name, me };
}
function bootDuel() {
  save.key = 'dawnbreak_duel'; const o = duelParams();
  save.key = 'dawnbreak_duel'; save.chars = []; save.cur = -1; save.data = save.defaults(o.a);   // 决斗不碰正式存档（存档键切到 dawnbreak_duel）
  return withLoading(['spr:' + o.a, 'spr:' + o.b, 'bg:' + o.theme], () => duel.start(o));
}
/* ---- 决斗场入口：城镇 NPC 维尔·克鲁（竞技大赛）/ P 键窗口 ---- */
if (typeof NPC_SERVICES !== 'undefined') NPC_SERVICES.arena = { label: '决斗场', run: () => menus.open('duel') };
Object.assign(menus, {
  w_duel() {
    const sel = { a: 'me', ja: '', b: 'gun', jb: '', ai: 2 };
    const clsBtns = (key, jkey, withMe) => { const row = h('div', { class: 'duelrow' }); const draw = () => { row.replaceChildren(...[...(withMe ? ['me'] : []), ...openClasses()].map(c => h('button', { class: 'btn' + (sel[key] === c ? '' : ' off'), onclick: () => { sel[key] = c; sel[jkey] = ''; draw(); jobRow(); } }, c === 'me' ? '我的角色' : CLASSES[c].name))); }; draw(); return row; };
    const jobsA = h('div', { class: 'duelrow' }), jobsB = h('div', { class: 'duelrow' });
    const jobRow = () => { for (const [key, jkey, el] of [['a', 'ja', jobsA], ['b', 'jb', jobsB]]) { const c = sel[key]; el.replaceChildren(...(c === 'me' ? [] : Object.entries(CLASSES[c].jobs || {}).filter(([, J]) => jobOpen(J)).map(([j, J]) => h('button', { class: 'btn' + (sel[jkey] === j || (!sel[jkey] && j === firstJob(c)) ? '' : ' off'), onclick: () => { sel[jkey] = j; jobRow(); } }, J.name)))); } };
    jobRow();
    const lvRow = h('div', { class: 'duelrow' }, ...[1, 2, 3].map(n => h('button', { class: 'btn' + (sel.ai === n ? '' : ' off'), onclick: e => { sel.ai = n; [...lvRow.children].forEach((b, i) => b.classList.toggle('off', i + 1 !== n)); } }, ['简单', '普通', '困难'][n - 1])));
    const go = h('button', { class: 'btn big', onclick: () => { const q = new URLSearchParams({ duel: sel.a, vs: sel.b, ai: sel.ai }); if (DEV_OPEN) q.set('fighter', '1'); if (sel.ja) q.set('job', sel.ja); if (sel.jb) q.set('vsjob', sel.jb); if (save.data) save.write(); location.search = '?' + q.toString(); } }, '开始决斗');
    return this.win('决斗场', h('div', { class: 'duelwin' }, h('b', {}, '我方'), clsBtns('a', 'ja', true), jobsA, h('b', {}, '对手（AI）'), clsBtns('b', 'jb', false), jobsB, h('b', {}, 'AI 难度'), lvRow,
      h('div', { class: 'dueltip' }, `一局定胜负，每局 ${DUEL_CFG.time} 秒（开局 ${DUEL_CFG.guard} 秒倒计时只能走位 / 放 BUFF，大技能和觉醒开局在冷却）。双方属性由天平系统统一；平推 / 浮空 / 倒地 / 时间保护与燃斗模式生效。`), go), { w: 34 });
  },
});
addStyle('.duelwin{display:flex;flex-direction:column;gap:.5em}.duelrow{display:flex;gap:.4em;flex-wrap:wrap}.dueltip{opacity:.75;font-size:.85em}');
