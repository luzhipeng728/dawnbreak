/* =====================================================================
   职业：圣职者（男，key `priest`）—— B0 骨架 + 基础职业（计划见 docs/CLASS_PLAN_PRIEST.md，逐技能对照 docs/skills/priest_base_final.md，规格 docs/skills/priest.json）
   现状：已上线（选角 / 转职 / 武器 / 商店默认开放；?priest=1 或 ?dev=priest 仍可用于测试跳转）；美术到位前是矢量占位模型
         （鬼剑士骨架换色、拿巨型十字架），精灵帧到位后自动换成 SpriteModel（content/sprites.js，片段名 = SPR_ANIMS.priest）。
   武器：5 种“巨兵”（十字架 / 念珠 / 图腾 / 镰刀 / 战斧）是拿在手上的武器（和鬼剑士 / 魔法师一样的手持武器图和 wpn 握点），不改普攻动作，只改攻速 / 距离 / 硬直（PRIEST_FEEL）。
   普攻：巨兵 3 连击（横扫 → 回扫 → 重砸）；跑攻 = 滑步猛击（按 X 接勾拳追击）；跳攻 = 空中下劈。
   基础技能（官方现版 11 个，namu 2026 / wiki.dfo.world）：空斩打（Z）、虎袭（→↓+Z，抓取冲刺）、直拳冲击（→+Z）、勾拳追击（跑攻中 X）、缓慢愈合（→+Space，单体持续回复）、
             净化（↓↓+Space，全队解除异常）、恶魔之手（↓→+Z）、纯白之刃（↑→+Z，只有圣骑士）、落凤锤（↑↓+Z）、化魔（↓→+C）、升天阵（↓↑+Z）
   取消：普攻 → 攻击技能随时；例外（官方）：直拳冲击只有蓝拳圣使、升天阵 / 落凤锤只有驱魔师能在普攻中取消（S.noForce(p)）
   转职（这里登记 CLASSES.priest.jobs.<id> 的名字 / 精通 / 伤害类型 / 觉醒名；四个转职已完成并开放，技能和动作写在各自的文件）：
     圣骑士 priest_crusader.js（pc_）、蓝拳圣使 priest_monk.js（pi_）、驱魔师 priest_exorcist.js（pe_）、复仇者 priest_avenger.js（pa_）
   分工：本文件归基础职业块（P-core）；转职块只改自己的文件，往 PRIEST_HOOKS / PRIEST_ACT_PICK 里登记，不改这里。给转职用的构件：
     pMod(p, id)（转职改基础技能：PRIEST_HOOKS.mod 返回 { dmg, range, type, jump, pull }）、pReq(id)（PRIEST_HOOKS.req：意念驱动中不能用空斩打 / 落凤锤等）、
     priestActsFor(F)（按武器生成的普攻表，PRIEST_ACT_PICK 换普攻时展开它再覆盖）、pBoxHit（手动判定一个攻击框，可跳过目标）、
     队伍原语（net/party_sync.js）：partyCast('buff' | 'shield' | 'heal' | 'cleanse' | 'revive', d, 施放者)、d.to 单体目标、partyPick(src, r) 找 HP 最低的队员、
     BUFF 字段 hot（持续回复）/ life（免死一次，engine/entity.js tickHot / lifeSave）
   ===================================================================== */
const PAL_PRIEST = { skin: '#efc39c', hair: '#3a2c22', eye: '#4d6f85', coat: '#e8e2d2', coat2: '#b9ae98', trim: '#d4b45e', scarf: '#e6e0d1', pants: '#3e4250', boot: '#3c3028', glove: '#e6e0d1', belt: '#66503a', blade: '#d8dde8', glow: '#ffe3a0' };

/* ---- id 预留表（B0 定死，各块按这个写，不要另起）：技能 / 帧 / 片段名前缀和技能前缀相同（pm_ 已被协战师占用，蓝拳圣使用 pi_ = Infighter）---- */
const PRIEST_IDS = {
  prefix: { base: 'p_', crusader: 'pc_', monk: 'pi_', exorcist: 'pe_', avenger: 'pa_' },
  jobs: ['crusader', 'monk', 'exorcist', 'avenger'],
  weapons: { cross: 'cr', rosary: 'ro', totem: 'tt', scythe: 'sc', battleaxe: 'ba' },   // 武器类型 key → 物品代码（WTYPES，game/items.js；具名史诗 ep_<代码>_*）
  base: ['p_launcher', 'p_smasher', 'p_lucky', 'p_second', 'p_slowheal', 'p_cure', 'p_grab', 'p_purity', 'p_phoenix', 'p_rapture', 'p_emblem'],
  // 觉醒技 id（一 / 二 / 三觉）：插图 cutin/<转职>{,2,3}，转职块按这个写
  awaken: { crusader: ['pc_awaken', 'pc_awaken2', 'pc_awaken3'], monk: ['pi_awaken', 'pi_awaken2', 'pi_awaken3'], exorcist: ['pe_awaken', 'pe_awaken2', 'pe_awaken3'], avenger: ['pa_awaken', 'pa_awaken2', 'pa_awaken3'] },
};

/* ---- 武器手感（官方：巨兵只改速度 / 距离 / 数值，不改普攻动作；攻速 / 施放速度本身在 WTYPES.aspd / cspd）：reach 普攻 / 部分技能判定前沿的倍率，stun 硬直倍率。不装武器按十字架算 ---- */
const PRIEST_FEEL = {
  cross: { reach: 1.0, stun: 1.0 },
  rosary: { reach: 0.9, stun: 1.0 },
  totem: { reach: 0.95, stun: 1.05 },
  scythe: { reach: 1.15, stun: 0.8 },
  battleaxe: { reach: 1.15, stun: 1.2 },
};
const pFeelOf = p => PRIEST_FEEL[wtypeOf(p)] || PRIEST_FEEL.cross;

/* ---- 职业钩子：基础 / 各转职往这里登记（照 FIGHTER_HOOKS）----
   onHit(p, t, h, dmg, act, opt) 命中；onHurt(p, a, h, dmg) 受击后；beforeHurt(p, a, h, opt) → { block, mul, minHp, noStun, noStatus }（多个结果：mul 相乘、block 优先）；
   onCast(p, id, act, how) 施放后；cancelHook(p, act, id) → true = 允许这次技能取消（蓝拳 干涸之泉 / 驱魔 落凤锤后接物理技能）；softCommit(p, act, id) 真放出来后；
   req(p, id) → true | 提示文字（这个基础技能现在不能用，例：意念驱动中不能用空斩打 / 落凤锤）；
   mod(p, id) → { dmg 伤害倍率, range 范围倍率, type 伤害类型, jump 落凤锤跳跃倍率, pull 升天阵聚怪 } | null（转职改写基础技能：圣骑士独立攻击、驱魔师落凤锤 / 升天阵 +20%……）*/
const PRIEST_HOOKS = { onHit: [], onHurt: [], beforeHurt: [], onCast: [], cancelHook: [], softCommit: [], req: [], mod: [] };
function pMod(p, id) {
  const r = { dmg: 1, range: 1 }; if (!p) return r;
  for (const f of PRIEST_HOOKS.mod) { const m = f(p, id); if (!m) continue; for (const k in m) r[k] = k === 'dmg' || k === 'range' ? r[k] * m[k] : m[k]; }
  return r;
}
const pReq = id => p => { for (const f of PRIEST_HOOKS.req) { const r = f(p, id); if (r && r !== true) return r; } return true; };
// 手动判定一个攻击框（box 同 HB：[前沿0, 前沿1, 纵深半宽, z0, z1]），skip = 不打的目标集合；返回打中的数量
function pBoxHit(e, box, h, skip) {
  const B = atkBox(e, { box }, {}); let n = 0;
  for (const t of ents) if (canHit(e, t, h) && !(skip && skip.has(t)) && overlaps(B, t)) { applyHit(e, t, { ...h, box }); n++; }
  return n;
}

/* ---- 矢量占位模型的骨骼片段（美术到位后由 content/sprites.js 换成逐帧精灵；片段名 = SPR_ANIMS.priest 的名字）：借鬼剑士的挥砍、格斗家的拳 / 结印姿势 ---- */
CLIPS.priest = { ...HUMAN_CLIPS,
  a3slam: CLIPS.sword.a3slam, focus: CLIPS.fighter.focus,
  up: HUMAN_CLIPS.up, upper: HUMAN_CLIPS.up,
  grab: CLIPS.fighter.grab, carry: { dur: 0.4, keys: [k(0, POSE.fGrab)] }, throw: CLIPS.fighter.palm2,
  jab: CLIPS.fighter.atk1, straight: CLIPS.fighter.palm,
  pray: CLIPS.fighter.seal, cast: CLIPS.fighter.palm, cross: CLIPS.fighter.palm2, rapture: CLIPS.fighter.focus,
  leap: HUMAN_CLIPS.jumpUp, thrust: CLIPS.fighter.quake,
};

/* ---- 特效构件（全部复用 art/final/fx 运行时染色，不烘进人物帧） ---- */
const P_COL = { holy: '#ffe3a0', light: '#fff2b0', heal: '#7ae0a0', dark: '#9a5ad8', blood: '#b04a6a', cure: '#9fe0ff' };
// 拳风（直拳 / 勾拳）
const pPunch = (e, len, heavy) => { fxStreak({ x: e.x + e.face * 20, y: e.y, z: e.z + 64, face: e.face, len, w: heavy ? 12 : 8, col: P_COL.holy, dur: heavy ? 0.16 : 0.1 }); sfx.swing(!!heavy); };
// 祈祷光：头顶小十字 + 脚下光环
function pPrayFx(e, col) { fxSpr('crossx', e.x, e.y, e.z + 120, { w: 46, dur: 0.5, col, grow: [0.5, 1] }); fxAura(e, col, 0.5); }

/* ---- 普攻：按武器手感生成（判定前沿 × reach、硬直 × stun），每种武器一张，passives 每 0.25 秒按武器 / BUFF 挑表 ----
   巨兵 3 连击：横扫 → 回扫 → 重砸（击退）；跑攻 滑步猛击（后半段按 X = 勾拳追击）；跳攻 空中下劈 */
function priestActsFor(F) {
  const R = b => [b[0], Math.round(b[1] * F.reach), b[2], b[3], b[4]], S = s => +(s * F.stun).toFixed(3);
  return {
    atk1: { name: 'atk1', dur: 0.36, basic: true, speed: 'aspd', chain: [0.14, 0.36], next: 'atk2', move: [[0.02, 0.08, 90]],
      hits: [HB(0.08, 0.14, R([0, 112, 36, 20, 115]), 1.0, { stun: S(0.32), knock: 50, hs: 0.055, snd: 'blunt' })],
      events: [slashAt(0.07, { a0: -2.2, a1: 0.9, r: 82, w: 18, off: [12, 56] })] },
    atk2: { name: 'atk2', dur: 0.38, basic: true, speed: 'aspd', chain: [0.15, 0.38], next: 'atk3', move: [[0.02, 0.08, 90]],
      hits: [HB(0.08, 0.15, R([0, 116, 36, 16, 115]), 1.1, { stun: S(0.34), knock: 55, hs: 0.055, snd: 'blunt' })],
      events: [slashAt(0.07, { a0: 0.9, a1: -2.2, r: 84, w: 18, off: [12, 54] })] },
    // 重砸：巨兵从头顶砸下，击退
    atk3: { name: 'atk3', dur: 0.56, basic: true, speed: 'aspd', move: [[0.04, 0.16, 150]],
      hits: [HB(0.16, 0.24, R([0, 126, 40, 0, 135]), 1.6, { stun: S(0.55), knock: 220, hs: 0.09, shake: 3, heavy: true, big: 1.3, snd: 'blunt' })],
      events: [slashAt(0.14, { a0: -2.7, a1: 1.1, r: 94, w: 24, off: [12, 60], squash: 0.85, heavy: true }), evAt(0.2, e => fxDust(e.x + e.face * 80, e.y, 4, 14))] },
    // 跑攻 滑步猛击：不击倒（官方接勾拳追击），后半段按 X 派生勾拳追击（keyLinks）
    dash: { name: 'dash', dur: 0.46, basic: true, speed: 'aspd', move: [[0, 0.26, 400]], noCounter: true, keyLinks: { attack: 'p_second' }, linkFrom: 0.12,
      hits: [HB(0.05, 0.26, R([0, 100, 36, 10, 112]), 1.3, { stun: S(0.6), knock: 70, hs: 0.07, shake: 2, snd: 'blunt' })],
      events: [evAt(0.03, e => { fxStreak({ x: e.x - e.face * 10, y: e.y, z: e.z + 58, face: e.face, len: 96, w: 12, col: P_COL.holy, dur: 0.2 }); fxDust(e.x - e.face * 12, e.y, 3, 8); sfx.swing(true); })] },
    jatk: { name: 'jatk', dur: 0.36, basic: true, speed: 'aspd', airOnly: true, lowGrav: 0.75,
      hits: [HB(0.07, 0.18, R([0, 100, 36, -40, 84]), 1.0, { stun: S(0.34), knock: 50, hs: 0.05, airLift: 160, snd: 'blunt' })],
      events: [slashAt(0.06, { a0: -1.6, a1: 1.3, r: 78, w: 16, off: [10, 40] })] },
  };
}
const PRIEST_ACTS_BY_W = {}; for (const w in PRIEST_FEEL) PRIEST_ACTS_BY_W[w] = priestActsFor(PRIEST_FEEL[w]);
const PRIEST_ACTS = PRIEST_ACTS_BY_W.cross;
const pActsOf = p => (p && PRIEST_ACTS_BY_W[wtypeOf(p)]) || PRIEST_ACTS;
// 普攻动作表按转职 / 状态挑选（蓝拳 意念驱动换拳、复仇者 半魔化 / 魔化）：转职文件往 PRIEST_ACT_PICK 里登记 p => 动作表 | null
const PRIEST_ACT_PICK = [];
function priestActs(p) { for (const f of PRIEST_ACT_PICK) { const A = f(p); if (A) return A; } return pActsOf(p); }

/* =====================================================================
   基础技能（国服现版；等级按 SKILLS_OFFICIAL_common.md 第 7 节压缩，冷却写官方现版值，刷图时引擎统一 ×0.6，?rawcd 看原值）
   伤害：按官方各段比例分配，总量和同冷却的其他职业基础技能一致（冷却 2 秒 ≈ 1.8，5~6 秒 ≈ 2.9~3.3）；距离按官方 px × 1.05
   ===================================================================== */
// 空斩打：巨兵从下往上挑，身前的敌人挑空、身后的敌人砸倒；整个动作霸体（官方：挑空技能里霸体最长）；圣骑士算独立攻击、驱魔师能蓄力（转职块用 pMod / 包一层）
defSkill('p_launcher', { name: '空斩打', cls: 'priest', lvReq: 1, lvStep: 3, sp: 20, mp: 0, cd: 2, type: 'phys', col: '#e0b050', req: pReq('p_launcher'),
  desc: '用巨兵从下往上猛挑，把身前的敌人挑到空中；同时打到身后的敌人，把它们砸倒在地。整个动作霸体。可以在普攻中取消施放。',
  pow: lv => skillDmg(1.8, 0.18, lv), infoExtra: lv => [['身后攻击力', pct(skillDmg(0.9, 0.09, lv))], ['霸体', '整个动作']], ai: { kind: 'launch', r: [0, 110], dy: 24 },
  act: (lv, p) => { const M = pMod(p, 'p_launcher'), F = pFeelOf(p);
    return { name: 'p_launcher', clip: 'up', dur: 0.5, cancelFrom: 0.3, superArmor: [0, 0.5], move: [[0.02, 0.1, 110]], type: M.type,
      hits: [HB(0.1, 0.19, [0, Math.round(118 * F.reach * M.range), 38, 0, 140], skillDmg(1.8, 0.18, lv) * M.dmg, { launch: 580 + lv * 6, knock: 40, hs: 0.08, shake: 2, big: 1.2, snd: 'blunt' }),
        HB(0.12, 0.2, [-Math.round(84 * M.range), 0, 36, 0, 120], skillDmg(0.9, 0.09, lv) * M.dmg, { radial: true, down: true, downLift: 120, knock: 60, hs: 0.06, snd: 'blunt' })],
      events: [slashAt(0.09, { a0: 1.5, a1: -1.9, r: 92, w: 22, off: [10, 52], heavy: true }), evAt(0.1, e => fxDust(e.x - e.face * 30, e.y, 3, 10))] }; } });
// 虎袭：抓住身前的敌人推着冲刺，沿路撞到的敌人多段伤害，最后把抓住的敌人扔出去（扔出去的敌人砸到沿路的敌人）；冲刺中按 X 立即扔出、伤害 +20%
const P_SMASH_R = 130;
function pSmashThrow(e, lv, M, quick) {
  const a = e.act; if (!a || a.name !== 'p_smasher' || a.thrown) return; a.thrown = true;
  const t = e.grabbed; e.vx = 0; e.play('throw', true); sfx.swing(true); cam.shake = Math.max(cam.shake, 3);
  a.dur = e.actT + 0.3; a.update = null;
  if (!t) return;
  fxBurst(t.x, t.y, t.z + 40, quick ? 130 : 100, P_COL.holy); if (quick) fxText('+20%', t.x, t.y, t.z + 50, { col: '#ffe07a', size: 11 });
  throwArc(e, t, { dx: 200, h: 70, dur: 0.38, other: { dmg: skillDmg(1.45, 0.145, lv) * M.dmg, type: M.type, down: true, knock: 150, hs: 0.05, snd: 'blunt' },
    hit: { dmg: skillDmg(2.9, 0.29, lv) * M.dmg * (quick ? 1.2 : 1), type: M.type, down: true, downLift: 140, knock: 120, hs: 0.1, shake: 3, big: 1.4, snd: 'blunt' } });
}
defSkill('p_smasher', { name: '虎袭', cls: 'priest', lvReq: 1, sp: 15, mp: 15, cd: 5, type: 'phys', grab: true, col: '#d08a3a', req: pReq('p_smasher'),
  desc: '抓住身前的敌人，推着他向前冲一段距离后扔出去。冲刺中撞到的其他敌人受到多段伤害，被扔出去的敌人还会砸到沿路的敌人。冲刺中按攻击键立即扔出，伤害 +20%。能抓住霸体、格挡中的敌人；抓不住领主等不可抓取的敌人（只受到一次撞击）。可以在普攻中取消施放。',
  pow: lv => skillDmg(2.9, 0.29, lv), infoExtra: lv => [['冲撞攻击力', pct(skillDmg(1.16, 0.116, lv)) + '（5 段）'], ['被扔的敌人砸中别人', pct(skillDmg(1.45, 0.145, lv))]], ai: { kind: 'grab', r: [0, 110], dy: 20 },
  act: (lv, p) => { const M = pMod(p, 'p_smasher'), bump = skillDmg(1.16, 0.116, lv) * M.dmg;
    return { name: 'p_smasher', clip: 'grab', dur: 0.42, noCounter: true, type: M.type, move: [[0.02, 0.18, 320]],
      hits: [HB(0.04, 0.18, [0, 100, 36, 0, 125], bump * 0.2, { grab: true, grabInvul: true, stun: 0.4, knock: 30, hs: 0.05, snd: 'blunt',
        onGrabFail: (a, t) => applyHit(a, t, { dmg: bump, type: M.type, sure: true, stun: 0.45, knock: 140, hs: 0.06, snd: 'blunt' }) })],
      onGrab: (e, t) => { const a = e.act; if (a.gT !== undefined) return; a.gT = e.actT; a.dur = e.actT + 0.9; a.move = null; a.bumpN = 0; a.bumpT = 0; t.heldClip = 'hit2';
        e.play('carry', true); sfx.swing(true); fxDust(e.x, e.y, 3, 10); },
      update: e => { const a = e.act; if (a.gT === undefined || a.thrown) return;
        const k = e.actT - a.gT, R = game.room; e.vx = e.face * 460;
        if (R && (e.x <= R.x0 + e.w + 4 || e.x >= R.x1 - e.w - 4)) { pSmashThrow(e, lv, M, false); return; }
        if (k >= a.bumpT && a.bumpN < 5) { a.bumpN++; a.bumpT = k + 0.1; pBoxHit(e, [0, P_SMASH_R, 40, 0, 120], { dmg: bump / 5, type: M.type, stun: 0.3, knock: 90, hs: 0.03, snd: 'blunt' }, new Set(grabsOf(e)));
          if (a.bumpN % 2) fxStreak({ x: e.x - e.face * 20, y: e.y, z: e.z + 50, face: e.face, len: 90, w: 10, col: P_COL.holy, dur: 0.14 }); }
        if (k >= 0.5) pSmashThrow(e, lv, M, false); },
      onInput: (e, I) => { const a = e.act; if (a.gT === undefined || a.thrown || e.actT - a.gT < 0.08 || !I.buffered('attack')) return false; I.consume('attack'); pSmashThrow(e, lv, M, true); return true; },
      hold: (e, t) => { t.x = e.x + e.face * 42; t.y = e.y + 0.5; t.z = e.z + 16; t.face = -e.face; } }; } });
// 直拳冲击：3 记直拳，最后一拳伤害最高、暴击率 +20%；按住 → 边打边前进，按住 ← 原地出拳。只有蓝拳圣使能在普攻中取消
defSkill('p_lucky', { name: '直拳冲击', cls: 'priest', lvReq: 5, sp: 15, mp: 15, cd: 3, type: 'phys', col: '#e0703a', noForce: p => jobOf(p) !== 'monk', req: pReq('p_lucky'),
  desc: '连续打出 3 记直拳，最后一拳伤害最高、暴击率 +20%，把敌人打退。按住 → 边打边前进，按住 ← 原地出拳。只有蓝拳圣使能在普攻中取消施放。',
  pow: lv => skillDmg(2.1, 0.21, lv), infoExtra: () => [['最后一击暴击率', '+20%'], ['段数', '3']], ai: { kind: 'poke', r: [0, 140], dy: 24 },
  act: (lv, p) => { const M = pMod(p, 'p_lucky'), r = M.range, jab = skillDmg(0.42, 0.042, lv) * M.dmg;
    return { name: 'p_lucky', clip: 'jab', dur: 0.62, type: M.type, move: [[0.04, 0.44, 110]],
      update: e => { const a = e.act; if (a.dir !== undefined || e.actT < 0.02) return; a.dir = e.pad ? e.pad.dx() * e.face : 0; a.move = a.dir > 0 ? [[0.04, 0.44, 230]] : a.dir < 0 ? null : [[0.04, 0.44, 110]]; },
      hits: [HB(0.05, 0.1, [0, Math.round(110 * r), 34, 30, 115], jab, { stun: 0.35, knock: 60, hs: 0.04, snd: 'blunt' }),
        HB(0.2, 0.25, [0, Math.round(110 * r), 34, 30, 115], jab, { stun: 0.35, knock: 60, hs: 0.04, snd: 'blunt' }),
        HB(0.38, 0.44, [0, Math.round(124 * r), 36, 30, 118], skillDmg(1.26, 0.126, lv) * M.dmg, { critBonus: 0.2, stun: 0.5, knock: 260, heavy: true, hs: 0.09, shake: 2, big: 1.3, snd: 'blunt' })],
      events: [evAt(0.04, e => { e.play('jab', true); pPunch(e, 80); }), evAt(0.19, e => { e.play('jab', true); pPunch(e, 80); }), evAt(0.36, e => { e.play('straight', true); pPunch(e, 120, true); })] }; } });
// 勾拳追击：跑攻（滑步猛击）中按 X 接一记上勾拳挑空，上勾拳动作中霸体；贴身时打两下。也可以直接按技能键施放
defSkill('p_second', { name: '勾拳追击', cls: 'priest', lvReq: 10, sp: 15, mp: 10, cd: 2, type: 'phys', col: '#e08a3a', cmdNote: '跑攻中 X', req: pReq('p_second'),
  desc: '跑动攻击（滑步猛击）中按 X，紧接着打出一记上勾拳把敌人挑到空中，上勾拳动作中霸体；贴得很近时会打中两次。也可以直接按技能键施放。',
  pow: lv => skillDmg(1.8, 0.18, lv), infoExtra: lv => [['贴身追加', pct(skillDmg(0.4, 0.04, lv))]], ai: { kind: 'launch', r: [0, 100], dy: 22 },
  act: (lv, p) => { const M = pMod(p, 'p_second');
    return { name: 'p_second', clip: 'upper', dur: 0.48, superArmor: [0, 0.3], move: [[0.02, 0.1, 140]], type: M.type,
      hits: [HB(0.08, 0.16, [0, Math.round(100 * M.range), 36, 0, 140], skillDmg(1.8, 0.18, lv) * M.dmg, { launch: 600 + lv * 6, knock: 50, hs: 0.08, shake: 2, big: 1.25, snd: 'blunt' }),
        HB(0.09, 0.17, [0, 42, 30, 0, 130], skillDmg(0.4, 0.04, lv) * M.dmg, { launch: 620, knock: 30, hs: 0.04, snd: 'blunt' })],
      events: [evAt(0.07, e => { fxStreak({ x: e.x + e.face * 30, y: e.y, z: e.z + 40, face: e.face, len: 70, w: 12, col: P_COL.holy, dur: 0.16 }); sfx.swing(true); })] }; } });
// 缓慢愈合：945px 内 HP 比例最低的一名队员（单刷时是自己）20 秒持续回复；施放者体力越高回复越多（组队走 partyCast 'buff' + to，回复由目标自己的客户端每秒结算）
const pHealPct = (p, lv) => Math.min(0.6, (0.24 + 0.02 * (lv - 1)) * (1 + ((p && p.vit) || 0) * 0.002));
defSkill('p_slowheal', { name: '缓慢愈合', cls: 'priest', lvReq: 5, lvStep: 3, sp: 15, mp: 28, cd: 10, type: 'mag', buff: true, cast: true, noHitCheck: true, col: '#7ae0a0', req: pReq('p_slowheal'),
  desc: '为 945px 内 HP 比例最低的一名队员（单刷时是自己）施加 20 秒的持续回复。施放者的体力越高，回复量越大。',
  infoExtra: (lv, p) => [['20 秒总回复', pct(pHealPct(p || game.player, lv)) + ' 最大 HP'], ['范围', '945px'], ['施放时间', '0.8 秒']], ai: { kind: 'buff' },
  act: lv => ({ name: 'p_slowheal', clip: 'pray', dur: 0.8, noCounter: true,
    events: [evAt(0.02, e => { fxCharge(e, '#9ff0b8', 3); sfx.charge(); }),
      evAt(0.6, e => { const { t, to } = partyPick(e, 945), v = pHealPct(e, lv);
        partyCast('buff', { id: 'p_slowheal', to, b: { t: 20, hot: v / 20, name: '缓慢愈合', col: P_COL.heal }, aura: P_COL.heal }, e);
        fxSpr('heal', t.x, t.y, t.z + 70, { w: 96, dur: 0.7, col: '#9ff0b8', grow: [0.6, 1.1] }); pPrayFx(e, P_COL.heal); sfx.buff(); fxText('缓慢愈合', t.x, t.y, t.z + 20, { col: '#b8ffd2', size: 11 }); })] }) });
// 净化：解除全队最多 5 种异常（官方范围 1530px；组队时 partyCast 不看距离）
defSkill('p_cure', { name: '净化', cls: 'priest', lvReq: 10, maxLv: 1, sp: 50, mp: 22, cd: 15, type: 'mag', buff: true, cast: true, noHitCheck: true, col: '#9fe0ff', req: pReq('p_cure'),
  desc: '祈祷驱散邪气，解除全队身上最多 5 种异常状态（中毒、灼烧、出血、诅咒、失明、减速、束缚……）。',
  infoExtra: () => [['解除异常', '最多 5 种'], ['施放时间', '0.5 秒']], ai: { kind: 'buff' },
  act: () => ({ name: 'p_cure', clip: 'pray', dur: 0.55, noCounter: true,
    events: [evAt(0.36, e => { partyCast('cleanse', { n: 5 }, e); pPrayFx(e, P_COL.cure); fxShock(e.x, e.y, 150, P_COL.cure); fxSpr('heal', e.x, e.y, e.z + 70, { w: 110, dur: 0.6, col: '#c8f0ff', grow: [0.6, 1.2] }); sfx.buff(); })] }) });
// 恶魔之手：伸出恶魔之手打最远处（第 1 击），再握紧打身前一段（第 2 击）并几率束缚；暗属性魔法，贴地判定；圣骑士不能学
const pGrabBind = lv => Math.min(0.8, 0.2 + 0.04 * (lv - 1));
defSkill('p_grab', { name: '恶魔之手', cls: 'priest', lvReq: 10, sp: 15, mp: 28, cd: 6, type: 'mag', elem: 'dark', cast: true, col: '#8a4ac8', excl: ['crusader'], req: pReq('p_grab'),
  desc: '召唤恶魔之手向前伸出（第 1 击，打到最远处），再猛地握紧往回拽（第 2 击），被握住的敌人有几率被束缚 2 秒。暗属性魔法攻击，伸出的手能打到贴地的敌人。可以在普攻中取消施放。圣骑士不能学。',
  pow: lv => skillDmg(1.07, 0.107, lv) + skillDmg(2.13, 0.213, lv), infoExtra: lv => [['束缚几率', pct(pGrabBind(lv))], ['束缚时间', '2 秒'], ['距离', '260px']], ai: { kind: 'poke', r: [40, 250], dy: 26 },
  act: (lv, p) => { const M = pMod(p, 'p_grab'), L = Math.round(260 * M.range), hand = fxTint('bloodhand', P_COL.dark);
    return { name: 'p_grab', clip: 'cast', dur: 0.78, noCounter: true, type: M.type || 'mag',
      hits: [HB(0.3, 0.38, [30, L, 42, 0, 100], skillDmg(1.07, 0.107, lv) * M.dmg, { type: M.type || 'mag', elem: 'dark', downHit: true, stun: 0.45, knock: 40, pull: true, hs: 0.05, col: '#c89aff' }),
        HB(0.5, 0.58, [20, L - 20, 44, 0, 110], skillDmg(2.13, 0.213, lv) * M.dmg, { type: M.type || 'mag', elem: 'dark', stun: 0.6, knock: 90, pull: true, hs: 0.08, shake: 2, big: 1.3, col: '#c89aff',
          onHit: (a, t) => { if (Math.random() < pGrabBind(lv)) addStatus(t, 'bind', 2, { src: a }); } })],
      events: [evAt(0.02, e => fxCharge(e, P_COL.dark, 2)),
        evAt(0.28, e => { sfx.swing(true); for (let i = 0; i < 3; i++) fxSpr('darkorb', e.x + e.face * (60 + i * (L - 60) / 2), e.y, e.z + 30, { w: 60, dur: 0.3, col: P_COL.dark, alpha: 0.6, grow: [0.5, 1] });
          addFx({ x: e.x, y: e.y + 0.6, z: e.z, face: e.face, dur: 0.34, img: hand, draw(c) { const k = easeOut(Math.min(1, this.t / 0.14)); drawSpr(c, this.img, sx(this.x + this.face * (40 + (L - 40) * k)), sy(this.y, this.z + 50), 150, 0, { flip: this.face < 0, alpha: this.t > 0.26 ? (0.34 - this.t) / 0.08 : 1 }); } }); }),
        evAt(0.48, e => { fxBurst(e.x + e.face * (L * 0.6), e.y, e.z + 50, 120, P_COL.dark); sfx.boom(0.4); })] }; } });
// 纯白之刃：双臂交叉凝出十字形圣光之刃斩向前方（光属性，独立攻击），被斩中的敌人长时间硬直；只有圣骑士能学
defSkill('p_purity', { name: '纯白之刃', cls: 'priest', lvReq: 15, sp: 15, mp: 27, cd: 2, type: 'indep', elem: 'light', col: '#fff0a0', only: ['crusader'], req: pReq('p_purity'),
  desc: '双臂交叉，凝聚出十字形的圣光之刃斩向前方（光属性，独立攻击），被斩中的敌人长时间硬直。可以在普攻中取消施放。只有圣骑士能学。',
  pow: lv => skillDmg(1.8, 0.18, lv), infoExtra: () => [['硬直', '×2.4']], ai: { kind: 'poke', r: [0, 150], dy: 28 },
  act: (lv, p) => { const M = pMod(p, 'p_purity'), L = Math.round(150 * M.range);
    return { name: 'p_purity', clip: 'cross', dur: 0.46, move: [[0.02, 0.1, 80]], type: 'indep',
      hits: [HB(0.12, 0.2, [0, L, 40, 0, 135], skillDmg(1.8, 0.18, lv) * M.dmg, { type: 'indep', elem: 'light', stun: 0.85, knock: 60, hs: 0.08, shake: 2, big: 1.3, col: P_COL.light })],
      events: [evAt(0.02, e => fxCharge(e, P_COL.light, 2)), evAt(0.11, e => { fxSpr('crossx', e.x + e.face * L * 0.55, e.y, e.z + 64, { w: 170, dur: 0.36, col: P_COL.light, grow: [0.5, 1.15], flip: e.face < 0 }); sfx.swing(true); })] }; } });
// 落凤锤：跳起后把巨兵插进地面，插中的敌人受到直接伤害 + 冲击波打周围；跳起时方向键调前后落点；下落时霸体，拔出巨兵时无敌
const pPhoenixR = (lv, M) => 165 * (1 + 0.02 * (lv - 1)) * ((M && M.range) || 1);
defSkill('p_phoenix', { name: '落凤锤', cls: 'priest', lvReq: 15, sp: 20, mp: 28, cd: 6, type: 'phys', col: '#e0a040', noForce: p => jobOf(p) !== 'exorcist', req: pReq('p_phoenix'),
  desc: '跳起后把巨兵猛插进地面：插中的敌人受到直接伤害，同时放出冲击波攻击周围的敌人。跳起时可以按方向键前后调整落点；下落时霸体，拔出巨兵时无敌。驱魔师：伤害 / 范围更大，跳得更高更快，可以在普攻中施放。',
  pow: lv => skillDmg(0.65, 0.065, lv) + skillDmg(2.6, 0.26, lv), infoExtra: lv => [['冲击波攻击力', pct(skillDmg(2.6, 0.26, lv))], ['冲击波半径', Math.round(pPhoenixR(lv)) + 'px']], ai: { kind: 'aoe', r: [40, 240], dy: 40 },
  act: (lv, p) => { const M = pMod(p, 'p_phoenix'), J = M.jump || 1, R = pPhoenixR(lv, M);
    return { name: 'p_phoenix', clip: 'leap', dur: 2, noCounter: true, superArmor: [0.12, 2], type: M.type,
      onStart: e => { e.vz = 520 * J; e.z = Math.max(e.z, 1); e.vx = e.face * 170; e.vy = 0; sfx.jump(); fxDust(e.x, e.y, 3, 8); },
      onInput: (e, I) => { if (e.z > 1 && e.act.onLand) { const d = I.dx() * e.face; e.vx = e.face * (d > 0 ? 300 : d < 0 ? 40 : 170); } return false; },
      update: e => { const a = e.act; if (!a.dive && a.onLand && e.actT > 0.3 / J) { a.dive = true; e.vz = -900 * J; e.play('thrust', true); } },
      onLand: e => { const a = e.act; if (e.actT < 0.1) { e.vz = 0; return; }
        a.onLand = null; a.update = null; e.vx = e.vy = 0; e.play('thrust', true); a.dur = e.actT + 0.42; a.invul = [e.actT + 0.12, e.actT + 0.42];
        const x = e.x + e.face * 26; cam.shake = Math.max(cam.shake, 5); sfx.boom(0.7);
        fxShock(x, e.y, R + 20, '#ffd890'); fxShock(x, e.y, R * 0.6, '#fff4c8'); fxDust(x, e.y, 10, R * 0.5);
        for (let i = 0; i < 6; i++) { const ang = i / 6 * TAU; fxSpr('rock', x + Math.cos(ang) * R * 0.45, e.y + Math.sin(ang) * R * 0.15, 10 + rnd(0, 20), { w: rnd(16, 26), dur: 0.5, add: false, spin: rnd(-6, 6), grow: [1, 0.6] }); }
        fxSpr('pillar', x, e.y, 0, { w: 70, h: 150, dur: 0.35, col: P_COL.holy, ay: 1, grow: [0.6, 1] });
        instantHit(e, { box: [-10, 70, 32, 0, 80], dmg: skillDmg(0.65, 0.065, lv) * M.dmg, type: M.type, launch: 420, knock: 40, hs: 0.07, downHit: true, snd: 'blunt' });
        blast(e, x, e.y, R, { dmg: skillDmg(2.6, 0.26, lv) * M.dmg, type: M.type, launch: 460, knock: 90, hs: 0.07, downHit: true, snd: 'blunt', big: 1.2 }, { zMax: 70 }); } }; } });
// 化魔（痛苦的喜悦）：8 秒内每 2 秒消耗最大 HP 的 3%，回复最大 MP 的 6%；HP 太低不能施放；圣骑士不能学（复仇者版本由复仇者块改写：恶魔能量 / 自动施放）
const P_RAPTURE = { t: 8, every: 2, hp: 0.03, mp: 0.06 };
defSkill('p_rapture', { name: '化魔', cls: 'priest', lvReq: 15, maxLv: 1, sp: 20, mp: 0, cd: 8, type: 'mag', buff: true, noHitCheck: true, col: '#b04a6a', excl: ['crusader'],
  req: p => { const r = pReq('p_rapture')(p); return r !== true ? r : p.hp > p.hpMax * 0.25 || 'HP 不足'; },
  desc: '痛苦的喜悦：8 秒内每 2 秒消耗最大 HP 的 3%，回复最大 MP 的 6%。HP 低于 25% 时不能施放。圣骑士不能学。',
  infoExtra: () => [['持续', P_RAPTURE.t + ' 秒'], ['每 2 秒', `HP -${pct(P_RAPTURE.hp)} / MP +${pct(P_RAPTURE.mp)}`]], ai: { kind: 'buff' },
  act: () => ({ name: 'p_rapture', clip: 'rapture', dur: 0.4, noCounter: true,
    onStart: e => { e.buffs.p_rapture = { t: P_RAPTURE.t, next: P_RAPTURE.t - 0.01, name: '化魔', col: P_COL.blood }; fxAura(e, P_COL.blood, 0.6); fxText('化魔', e.x, e.y, e.z + 20, { col: '#ff9ab8', size: 11 }); sfx.charge(); } }) });
function pRaptureTick(p) {
  const b = p.buffs.p_rapture; if (!b || p.dead || b.t > b.next) return;
  b.next -= P_RAPTURE.every; const hp = Math.round(p.hpMax * P_RAPTURE.hp), mp = Math.round(p.mpMax * P_RAPTURE.mp);
  p.hp = Math.max(1, p.hp - hp); p.mp = Math.min(p.mpMax, p.mp + mp);
  addNumber(mp, p.x, p.y, p.z + 20, { col: '#7ac8ff' }); fxSpr('darkorb', p.x, p.y, p.z + 60, { w: 50, dur: 0.3, col: P_COL.blood, alpha: 0.6, grow: [0.6, 1] });
}
// 升天阵：前方地面画出升天法阵，光属性魔法把阵上的敌人挑起（只挑到头顶左右）；只有驱魔师能在普攻中取消（驱魔师 +20% 伤害 / 范围、圣光脉轮聚怪由驱魔块用 pMod）；圣骑士不能学
defSkill('p_emblem', { name: '升天阵', cls: 'priest', lvReq: 16, sp: 20, mp: 28, cd: 5, type: 'mag', elem: 'light', cast: true, col: '#ffe070', excl: ['crusader'], noForce: p => jobOf(p) !== 'exorcist', req: pReq('p_emblem'),
  desc: '在前方地面画出升天法阵，光属性魔法攻击把阵上的敌人挑起（只挑到头顶左右的高度）。只有驱魔师能在普攻中取消施放。圣骑士不能学。',
  pow: lv => skillDmg(2.9, 0.29, lv), infoExtra: (lv, p) => [['法阵半径', Math.round(120 * pMod(p || game.player, 'p_emblem').range) + 'px'], ['施放时间', '0.4 秒']], ai: { kind: 'launch', r: [60, 260], dy: 36 },
  act: (lv, p) => { const M = pMod(p, 'p_emblem'), R = 120 * M.range;
    return { name: 'p_emblem', clip: 'cast', dur: 0.62, noCounter: true, type: M.type || 'mag',
      events: [evAt(0.03, e => { fxCharge(e, P_COL.light, 3); sfx.charge(); }),
        evAt(0.4, e => { const x = e.x + e.face * 150; sfx.boom(0.4);
          fxSpr('hexagram', x, e.y, 2, { w: R * 2.2, h: R * 0.8, dur: 0.6, col: P_COL.light, grow: [0.4, 1] });
          fxSpr('heal', x, e.y, 0, { w: R * 0.9, h: 200, dur: 0.5, col: '#fffaf0', ay: 1, grow: [0.5, 1] }); fxBurst(x, e.y, 40, R * 1.4, '#ffd23a');
          blast(e, x, e.y, R, { dmg: skillDmg(2.9, 0.29, lv) * M.dmg, type: M.type || 'mag', elem: 'light', launch: 400, knock: M.pull ? -140 : 20, hs: 0.07, downHit: true, col: P_COL.light, big: 1.2 }, { zMax: 90 }); })] }; } });

/* ---- 职业定义 ---- */
CLASSES.priest = { name: '圣职者', ready: true, hp0: 1900, hpPer: 155, mp0: 760, mpPer: 44, atk0: 480, atkPer: 58, def0: 320, defPer: 30, crit: 0.07, speed: 155, runSpeed: 285,
  desc: '侍奉神明、挥舞巨兵的男圣职者：以十字架、念珠、图腾、镰刀、战斧为武器，基础技能兼顾近战挑空、抓取冲撞与治疗净化。转职后可以成为圣骑士、蓝拳圣使、驱魔师或复仇者。',
  model: () => buildSwordsman(PAL_PRIEST, { weapon: 'cross', hair: 'short', hat: null, scarf: false, pauldron: true, coatTail: true }),
  acts: PRIEST_ACTS, slashCol: '#ffe3a0', dmgType: 'phys', airMax: 1,
  skills: [...PRIEST_IDS.base], start: ['p_launcher', 'p_smasher'], bar: ['p_launcher', 'p_smasher', ...Array(SKILL_SLOTS - 2).fill(null)],
  // 指令：[方向序列, 技能 id, 按键]（f 前 b 后 u 上 d 下；按键省略 = Z，attack = X，buff = Space，jump = C）；勾拳追击 = 跑攻的 keyLinks
  cmds: [['', 'p_launcher'], ['fd', 'p_smasher'], ['f', 'p_lucky'], ['f', 'p_slowheal', 'buff'], ['dd', 'p_cure', 'buff'], ['df', 'p_grab'], ['uf', 'p_purity'], ['ud', 'p_phoenix'],
    ['df', 'p_rapture', 'jump'], ['du', 'p_emblem']],
  // 4 个转职（官方现版，docs/CLASS_PLAN_PRIEST.md §2）：技能 / 动作 / 觉醒技由各转职块写进自己的文件（skills.push / Object.assign），这里只登记元数据
  jobs: {
    crusader: { name: '圣骑士', role: '辅助 / 神圣审判（独立攻击）', armor: 'plate', dmgType: 'mag', growth: { int: 1.05, vit: 1.06, spr: 1.08 },
      awakenName: '天启者', awakenName2: '神思者', awakenName3: '神启·圣骑士', ready: true,
      desc: '以十字架与神圣之力守护同伴的圣职者：全队祝福、治疗、复活与护盾，也能用圣光审判敌人。', skills: [], anims: {} },
    monk: { name: '蓝拳圣使', role: '近身拳击 · 物理', armor: 'light', dmgType: 'phys', growth: { str: 1.1, vit: 1.04 },
      awakenName: '神之手', awakenName2: '正义仲裁者', awakenName3: '神启·蓝拳圣使', ready: true,
      desc: '把巨兵插在地上（意念驱动），赤手空拳贴身连打的圣职者：俯冲 / 摆动闪避、神圣反击、技能互相取消的连击。', skills: [], anims: {} },
    exorcist: { name: '驱魔师', role: '巨兵 · 式神（物理）', armor: 'plate', dmgType: 'phys', growth: { str: 1.08, int: 1.03, vit: 1.04 },
      awakenName: '龙斗士', awakenName2: '真龙星君', awakenName3: '神启·驱魔师', ready: true,
      desc: '挥舞战斧、念珠等巨兵，召唤式神（朱雀 / 玄武 / 白虎 / 苍龙 / 黄龙）降妖除魔的圣职者。', skills: [], anims: {} },
    avenger: { name: '复仇者', role: '暗属性魔法 · 恶魔化', armor: 'heavy', dmgType: 'mag', growth: { int: 1.1, vit: 1.03 },
      awakenName: '末日审判者', awakenName2: '永生者', awakenName3: '神启·复仇者', ready: true,
      desc: '以镰刀和体内的恶魔之力战斗的圣职者：积攒恶魔能量，半魔化 / 魔化成末日审判者，暗属性魔法伤害。', skills: [], anims: {} },
  }, passives: [] };
CLASSES.priest.passives.push(p => {
  if (!(p.st === 'act' && p.act && p.act.basic)) p.acts = priestActs(p);   // 普攻连段中途不换表
  pRaptureTick(p);
});
CLASSES.priest.onHit = (p, t, h, dmg, act, opt) => { for (const f of PRIEST_HOOKS.onHit) f(p, t, h, dmg, act, opt); };
CLASSES.priest.onHurt = (p, a, h, dmg) => { for (const f of PRIEST_HOOKS.onHurt) f(p, a, h, dmg); };
CLASSES.priest.beforeHurt = (p, a, h, opt = {}) => {
  let r = null;
  for (const f of PRIEST_HOOKS.beforeHurt) { const x = f(p, a, h, opt); if (!x) continue; if (x.block) return x; r = { ...r, ...x, mul: ((r && r.mul) || 1) * (x.mul || 1) }; }
  return r;
};
CLASSES.priest.onCast = (p, id, act, how) => { for (const f of PRIEST_HOOKS.onCast) f(p, id, act, how); };
CLASSES.priest.cancelHook = (p, a, id) => PRIEST_HOOKS.cancelHook.some(f => f(p, a, id));
CLASSES.priest.softCommit = (p, a, id) => { for (const f of PRIEST_HOOKS.softCommit) f(p, a, id); };
