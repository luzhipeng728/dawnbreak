/* =====================================================================
   圣职者转职：驱魔师（`exorcist`，技能前缀 pe_，P-exorcist；逐技能对照 docs/skills/priest_exorcist_final.md，规格 docs/skills/priest.json 的 pe_ 段）
   官方口径：KR 2024-06-20 驱魔师大改之后的现版（namu 퇴마사/스킬 2026-09、国服 2024 国庆版本、dnf.qq.com 2026-04 职业调整页）：
   - 物理 / 魔法合一（法阵：万悟）：符咒类（破魔符 / 压制符 / 朱雀符 / 落雷符 / 灭魂符）、五芒星阵、脉轮都已删除；技能分两系
       巨兵系：疾风打、星落打、狂乱锤击、疾空旋风破、无双击、逆鳞震、逆龙七杀、式神灭却·合（+ 空斩打 / 落凤锤）
       式神系：式神：热炎朱雀 / 地之玄武 / 空之白虎 / 幻海青龙（出现一次、攻击、离开；不是常驻召唤兽），黄龙 = 二觉被动（全队三速 +10%）+ 升龙·开阵 / 真龙焚天
   - 驱魔震慑：普攻 / 跑攻 / 跳攻换成战斧招式（3 段：横扫 → 反手上撩挑空 → 可蓄力的过顶重砸带冲击波，出招前短霸体、每一下把敌人往身前带）；移速 +10%
   - 落凤锤砸地之后可以接巨兵系技能；升天阵 / 落凤锤伤害、范围 +20%，普攻中可以取消（基础块的 noForce 已按驱魔写好）；空斩打可以蓄力（包一层 SKILLS.p_launcher.act）
   - 式神之悟（三觉被动）：共鸣 —— 巨兵系技能施放中可以瞬发式神技能（没有施放动作），2 次、每 3 秒恢复 1 次
   觉醒：一觉 龙斗士（四座千泰门）→ 二觉 真龙星君（真龙焚天）→ 三觉 光启·驱魔师（雷鸣怒海·火啸山崩；国服 2020 年叫 神启·驱魔师，后来改名）
   本文件：常量 / 动作 / 特效构件 / 钩子 / 普攻 / 被动 / BUFF / 巨兵系技能；式神、升龙·开阵、觉醒、自动学会、登记在 priest_exorcist_p1.js
   ===================================================================== */
const PE = 'exorcist';
const peOn = p => !!p && jobOf(p) === PE;
const PE_COL = { fire: '#ff6a2a', gold: '#ffd24a', axe: '#ffe7a0', earth: '#c8964a', water: '#4ab8ff', thunder: '#bfe6ff', dragon: '#ffcf3a', seal: '#ff3a3a', dark: '#6a4a8a' };
// 巨兵系（落凤锤砸地后能接、共鸣时能在施放中瞬发式神）
const PE_GIANT = new Set(['p_launcher', 'p_phoenix', 'pe_gale', 'pe_star', 'pe_chaos', 'pe_spin', 'pe_atomic', 'pe_quake', 'pe_seven', 'pe_blitz']);
const PE_SHIKI = new Set(['pe_suzaku', 'pe_genbu', 'pe_byakko', 'pe_seiryu']);
// 帧：有精灵帧时用驱魔的 pe_ 帧，没有就用通用帧（SPR_DATA 是构建时生成的，这里能读）
const peTl = (tl, fb) => typeof SPR_DATA !== 'undefined' && SPR_DATA.priest && SPR_DATA.priest.frames && SPR_DATA.priest.frames[tl[0][0]] ? tl : fb;
// 角色等级（人 = game.lvl；AI / 影子 = p.lvl）
const peLvl = p => (p && (p.kit ? p.lvl : game.lvl)) || game.lvl || 1;

/* ---- 矢量占位模型的片段（精灵帧到位前用；片段名 = J.anims 的名字）---- */
Object.assign(CLIPS.priest, {
  peSummon: CLIPS.priest.pray, peSeal: CLIPS.priest.cast, peThrow: CLIPS.priest.throw, peCharge: CLIPS.priest.rapture,
  peSpin: CLIPS.sword.spin, peSweep: HUMAN_CLIPS.atk2, pePlant: CLIPS.sword.a3slam, peThrust: HUMAN_CLIPS.dash, peSwing: HUMAN_CLIPS.atk3, peLeap: CLIPS.priest.leap,
  peA1: HUMAN_CLIPS.atk1, peA2: HUMAN_CLIPS.atk2, peA3: HUMAN_CLIPS.atk3, peDash: HUMAN_CLIPS.dash, peJatk: HUMAN_CLIPS.jatk, peGrab: CLIPS.priest.grab,
});
const PE_ANIMS = {
  peSummon: peTl([['pe_summon', 0]], [['charge', 0]]), peSeal: peTl([['pe_seal', 0]], [['charge', 0]]), peThrow: peTl([['pe_throw', 0]], [['idle', 0]]),
  peCharge: peTl([['pe_charge', 0]], [['charge', 0]]), peSpin: peTl([['pe_spin', 0]], [['idle', 0]]), peSweep: peTl([['pe_sweep', 0]], [['idle', 0]]),
  pePlant: peTl([['pe_plant', 0]], [['jump5', 0]]), peThrust: peTl([['pe_thrust', 0]], [['run3', 0]]), peSwing: peTl([['pe_charge', 0], ['pe_plant', 0.14]], [['charge', 0], ['jump5', 0.14]]),
  peLeap: peTl([['pe_charge', 0]], [['jump2', 0]]),
  // 驱魔震慑的战斧普攻 / 星落打的抓取：用原装的普攻 / 基础技能帧（docs/PRIEST_ART.md §7.2 / 7.3）
  peA1: peTl([['a1_1', 0], ['a1_2', 0.05], ['a1_3', 0.12]], [['idle', 0]]), peA2: peTl([['a2_1', 0], ['a2_2', 0.05], ['a2_3', 0.14]], [['idle', 0]]),
  peA3: peTl([['a3_1', 0], ['a3_2', 0.2]], [['idle', 0]]), peDash: peTl([['dash1', 0], ['dash2', 0.06]], [['run3', 0]]), peJatk: peTl([['jatk1', 0], ['jatk2', 0.06]], [['jump2', 0]]),
  peGrab: peTl([['p_grab', 0], ['p_tiger', 0.3]], [['idle', 0]]),
};

/* ---- 特效构件 ---- */
// 式神 / 神兽的形象：生图素材 fx/pe_<名字>（exorcist_avenger_art.py parts）；还没出图时用现成的发光素材顶上
const PE_BEAST_FB = { pe_suzaku: ['fireball', '#ff6a2a'], pe_genbu: ['eel', '#7a9a5a'], pe_byakko: ['as_raijin', '#e8f4ff'], pe_seiryu: ['dragonfang', '#4ab8ff'], pe_kouryu: ['dragonfang', '#ffcf3a'], pe_gate: ['sb_gate', '#ff5a3a'] };
function peBeast(c, name, x, y, h, o = {}) {
  const own = IMG['fx/' + name], fb = PE_BEAST_FB[name], img = own || (fb && fxTint(fb[0], fb[1])); if (!img) return;
  drawSpr(c, img, x, y, 0, h, { add: own ? !!o.add : true, flip: o.flip, alpha: o.alpha, rot: o.rot, ay: o.ay ?? 1 });
}
// 战斧砸地：冲击环 + 碎石 + 尘土（col = 光的颜色）
function peSlamFx(x, y, r, col = PE_COL.axe, big = 1) {
  cam.shake = Math.max(cam.shake, 5 * big); sfx.boom(0.5 + 0.4 * big);
  fxShock(x, y, r, col); fxShock(x, y, r * 0.55, '#fff4c8'); fxDust(x, y, Math.round(6 * big), r * 0.35);
  for (let i = 0; i < 5 + big * 2; i++) { const a = rnd(0, TAU); fxSpr('rock', x + Math.cos(a) * r * 0.35, y + Math.sin(a) * r * 0.12, rnd(8, 30), { w: rnd(14, 26), dur: 0.5, add: false, spin: rnd(-7, 7), grow: [1, 0.6] }); }
}
// 地面的裂缝（逆鳞震 / 式神灭却）：几条发光的折线从落点往外裂
function peCracks(x, y, r, col = '#ffb04a', dur = 0.9) {
  const L = []; for (let i = 0; i < 9; i++) { const a = i / 9 * TAU + rnd(-0.2, 0.2), pts = [[0, 0]]; let d = 0; while (d < r) { d += rnd(r * 0.12, r * 0.22); pts.push([Math.cos(a) * d + rnd(-8, 8), Math.sin(a) * d * GR + rnd(-3, 3)]); } L.push(pts); }
  addFx({ x, y: y - 40, z: 0, dur, draw(c) { const k = this.t / this.dur, a = k < 0.1 ? k / 0.1 : 1 - Math.max(0, k - 0.5) / 0.5, X = sx(x), Y = sy(y, 0);
    c.save(); c.globalCompositeOperation = 'lighter'; c.lineJoin = 'round';
    for (const [w, al, cc] of [[9, 0.35, col], [3, 0.9, '#fff0c0']]) { c.strokeStyle = cc; c.globalAlpha = a * al; c.lineWidth = w; for (const P of L) { c.beginPath(); P.forEach(([px, py], i) => i ? c.lineTo(X + px, Y + py) : c.moveTo(X + px, Y + py)); c.stroke(); } }
    c.restore(); } });
}
// 把敌人往 (x, y) 拉（领主 / 霸体中的不动；k = 这一下拉多少）
const peMovable = t => !t.boss && !t.heldBy && !(hasSA(t) && t.st !== 'hit' && t.st !== 'air');
function pePull(t, x, y, k = 0.5) { if (!peMovable(t)) return; t.x = lerp(t.x, x, k); t.y = clamp(lerp(t.y, y, k), 4, DEPTH - 4); }
// 身边 (rx, ry) 以内的敌人
function peFoes(e, x, y, rx, ry = rx * 0.45, zMax = 240) { const L = []; for (const t of ents) if (hittable(e, t) && Math.abs(t.x - x) < rx && Math.abs(t.y - y) < ry && t.z < zMax) L.push(t); return L; }
// 空中飘落的符纸（驱魔的招牌小特效：施法时身边飘几张黄符）
function peTalisman(e, n = 3) {
  for (let i = 0; i < n; i++) { const ox = rnd(-40, 40), oz = rnd(40, 110), spin = rnd(-5, 5), vx = rnd(-30, 30);
    addFx({ x: e.x + ox, y: e.y + 1, z: e.z + oz, dur: rnd(0.6, 0.9), draw(c) { const k = this.t / this.dur, X = sx(this.x + vx * this.t), Y = sy(this.y, this.z - 30 * k);
      c.save(); c.translate(X, Y); c.rotate(spin * this.t); c.globalAlpha = 1 - k * k; c.fillStyle = '#f2d86a'; c.fillRect(-5, -9, 10, 18); c.fillStyle = '#c82a2a'; c.fillRect(-2, -6, 4, 11); c.fillRect(-4, -3, 8, 2); c.restore(); } }); }
}
// 巨斧的弧光（金色新月，比普通刀光粗）
const peArc = (e, o) => fxSlashOn(e, { col: PE_COL.axe, w: 26, r: 118, off: [18, 58], heavy: true, ...o });

/* ---- 钩子：基础技能在驱魔下的强化（官方：升天阵 / 落凤锤 伤害 +20%、范围更大；升天阵聚怪；落凤锤跳得更高更快；二觉被动 真龙 升天阵范围再 +10%）---- */
PRIEST_HOOKS.mod.push((p, id) => {
  if (!peOn(p)) return null;
  if (id === 'p_phoenix') return { dmg: 1.2, range: 1.2, jump: 1.25 };
  if (id === 'p_emblem') return { dmg: 1.2, range: 1.3 * (skLv(p, 'pe_kouryu') ? 1.1 : 1), pull: true };
  return null;
});
// 取消：落凤锤砸地之后可以接巨兵系技能（官方 낙봉추 이후 거병 스킬 캔슬）
PRIEST_HOOKS.cancelHook.push((p, a, id) => peOn(p) && a.skill === 'p_phoenix' && !a.onLand && id !== 'p_phoenix' && PE_GIANT.has(id) && p.actT > 0.05);
// 潜龙：技能霸体中 / 蓄力中受到的伤害 −25%（2024 起潜龙只剩这一条）
PRIEST_HOOKS.beforeHurt.push((p, a, h) => (peOn(p) && skLv(p, 'pe_lurk') && p.st === 'act' && p.act && p.act.skill && (hasSA(p) || p.act.charging)) ? { mul: 0.75 } : null);
// 空斩打：驱魔师按住技能键可以蓄力（蓄力中霸体，最多 1 秒，伤害最多 +50%）；只包一层
function pePatchBase() {
  const S = SKILLS.p_launcher; if (!S || S._peWrap) return; S._peWrap = true;
  const act0 = S.act;
  S.act = (lv, p) => { const a = act0(lv, p); if (!peOn(p)) return a;
    return { ...a, charge: { at: 0.06, max: 1.0, min: 0, dmg: 0.5, update: e => { e.superArmor = Math.max(e.superArmor, 0.05); if (Math.random() < 0.35) fxCharge(e, PE_COL.fire, 1); } } }; };
}
pePatchBase();

/* ---- 普攻：驱魔震慑（战斧 3 段 + 跑攻 + 跳攻；每一下出招前短霸体、把敌人往身前带；第 3 段可以蓄力）---- */
const peGather = (dx = 90, k = 0.35) => (a, t) => pePull(t, a.x + a.face * dx, a.y, k);
const PE_ACTS = {
  atk1: { name: 'atk1', clip: 'peA1', dur: 0.4, basic: true, speed: 'aspd', chain: [0.16, 0.4], next: 'atk2', superArmor: [0, 0.12], move: [[0.02, 0.1, 110]],
    hits: [HB(0.1, 0.17, [0, 150, 46, 20, 125], 1.05, { stun: 0.34, knock: 20, hs: 0.06, snd: 'blunt', onHit: peGather() })],
    events: [slashAt(0.09, { a0: -0.4, a1: 0.9, r: 110, w: 24, off: [16, 60], col: PE_COL.axe, heavy: true })] },
  atk2: { name: 'atk2', clip: 'peA2', dur: 0.42, basic: true, speed: 'aspd', chain: [0.17, 0.42], next: 'atk3', superArmor: [0, 0.12], move: [[0.02, 0.08, 80]],
    hits: [HB(0.1, 0.18, [0, 150, 46, 0, 110], 1.15, { launch: 430, knock: 10, hs: 0.06, snd: 'blunt', onHit: peGather(80) })],
    events: [slashAt(0.09, { a0: 1.3, a1: -1.4, r: 112, w: 24, off: [16, 44], col: PE_COL.axe, heavy: true })] },
  // 过顶重砸：按住 X 蓄力（最多 0.8 秒，伤害 +50%），砸地出冲击波
  atk3: { name: 'atk3', clip: 'peA3', dur: 0.6, basic: true, speed: 'aspd', key: 'attack', superArmor: [0, 0.26], move: [[0.04, 0.14, 120]],
    charge: { at: 0.1, max: 0.8, min: 0, dmg: 0.5, update: e => { if (Math.random() < 0.35) fxCharge(e, PE_COL.fire, 1); } },
    hits: [HB(0.2, 0.27, [0, 150, 48, 0, 140], 1.4, { stun: 0.55, knock: 60, hs: 0.09, shake: 3, heavy: true, big: 1.3, snd: 'blunt', onHit: peGather(100, 0.5) })],
    events: [slashAt(0.18, { a0: -2.6, a1: 1.1, r: 120, w: 28, off: [14, 64], col: PE_COL.axe, heavy: true, squash: 0.85 }),
      evAt(0.24, e => { const x = e.x + e.face * 110, k = (e.act && e.act.chargeK) || 0; peSlamFx(x, e.y, 150 + 60 * k, PE_COL.fire, 0.8 + k);
        blast(e, x, e.y, 120 + 50 * k, { dmg: 0.6 * (1 + k * 0.5), knock: 110, launch: 260, hs: 0.05, downHit: true, snd: 'blunt' }, { zMax: 90 }); })] },
  dash: { name: 'dash', clip: 'peDash', dur: 0.5, basic: true, speed: 'aspd', move: [[0, 0.28, 420]], noCounter: true, superArmor: [0, 0.2],
    hits: [HB(0.06, 0.28, [0, 130, 44, 10, 120], 1.35, { stun: 0.6, knock: 90, hs: 0.07, shake: 2, snd: 'blunt', onHit: peGather(110, 0.25) })],
    events: [evAt(0.03, e => { fxStreak({ x: e.x - e.face * 10, y: e.y, z: e.z + 58, face: e.face, len: 120, w: 16, col: PE_COL.axe, dur: 0.22 }); fxDust(e.x - e.face * 12, e.y, 3, 8); sfx.swing(true); })] },
  jatk: { name: 'jatk', clip: 'peJatk', dur: 0.38, basic: true, speed: 'aspd', airOnly: true, lowGrav: 0.75,
    hits: [HB(0.07, 0.2, [0, 125, 44, -50, 90], 1.1, { stun: 0.36, knock: 40, hs: 0.05, airLift: 150, snd: 'blunt' })],
    events: [slashAt(0.06, { a0: -1.7, a1: 1.4, r: 100, w: 22, off: [10, 40], col: PE_COL.axe, heavy: true })] },
};
PRIEST_ACT_PICK.push(p => peOn(p) && skLv(p, 'pe_force') ? { ...pActsOf(p), ...PE_ACTS } : null);

/* ---- 共鸣（式神之悟）：巨兵系技能施放中瞬发式神（2 次，每 3 秒恢复 1 次）---- */
function peRes(p) {
  const s = p._peRes || (p._peRes = { n: 2, last: game.t });
  while (s.n < 2 && game.t - s.last >= 3) { s.n++; s.last += 3; }
  if (s.n >= 2) { s.n = 2; s.last = game.t; }
  return s;
}
const peInGiant = p => p.st === 'act' && p.act && PE_GIANT.has(p.act.skill);
// 按 C 跳跃取消（狂乱锤击 / 疾空旋风破，官方：决斗场不行）
function peJumpCancel(e, I) { if (game.pvp || !I.buffered('jump')) return false; I.consume('jump'); const a = e.act; e.act = null; if (a && a.onEnd) a.onEnd(e, true); e.vz = 480; e.z = 1; e.setState('jump'); return true; }
const peResOk = p => peOn(p) && skLv(p, 'pe_general') > 0 && peInGiant(p) && peRes(p).n >= 1;

/* =====================================================================
   被动 / BUFF（官方学习等级 → 本作按 common.md 第 7 节压缩：15 → 15、20 → 16、30 → 18、48 → 21、75 → 26、95 → 29）
   数值：官方是 Lv110 体系的百分比，本作按散打 / 柔道家同类被动的尺度缩小（写在各自的 infoExtra）
   ===================================================================== */
const peDef = (id, S) => defSkill(id, { cls: 'priest', job: PE, col: PE_COL.fire, ...S });
peDef('pe_zen', { name: '法阵：万悟', lvReq: 15, maxLv: 1, sp: 0, passive: true, col: '#ff8a3a',
  desc: '【被动，转职时自动学会】（2024 起驱魔物理 / 魔法合一）力量 / 智力、物理 / 魔法暴击率里较高的一边决定攻击方式：智力和魔法攻击更高时，驱魔技能按魔法攻击结算。' });
peDef('pe_force', { name: '驱魔震慑', lvReq: 15, maxLv: 1, sp: 0, passive: true, col: '#ffb04a',
  desc: '【被动，转职时自动学会】普攻、跑攻、跳攻变成战斧招式：横扫 → 反手上撩（挑空）→ 过顶重砸（按住 X 蓄力，砸地出冲击波）。每一下出招前短暂霸体，把敌人往身前带。移动速度 +10%，对不死 / 恶魔 / 灵魂系敌人普攻伤害 +5%。',
  infoExtra: () => [['移动速度', '+10%'], ['第 3 段蓄力', '最多 +50%']] });
peDef('pe_lurk', { name: '潜龙', lvReq: 15, maxLv: 1, sp: 0, passive: true, col: '#3a6ad8',
  desc: '【被动，转职时自动学会】技能霸体中、蓄力中受到的伤害 −25%，也不会被打退。（2024 起“蓄力强化技能”的效果拆进各个技能，潜龙只剩这一条）', infoExtra: () => [['技能霸体中受到伤害', '−25%']] });
peDef('pe_plate', { name: '驱魔板甲精通', lvReq: 15, maxLv: 1, sp: 0, passive: true, col: '#c8b088',
  desc: '【被动，转职时自动学会】穿板甲时物理 / 魔法防御、HP 上限提高，硬直恢复更快（防具精通，按穿着的板甲件数生效）。' });
peDef('pe_mastery', { name: '巨兵精通', lvReq: 16, maxLv: 10, sp: 15, passive: true, col: '#e8c06a',
  desc: '【被动】熟练地挥舞巨兵：命中率、普攻和技能攻击力提高。装备战斧 / 念珠时不受武器本身的 MP 消耗 / 冷却修正影响。',
  infoExtra: lv => [['攻击力', '+' + pct(0.02 + 0.004 * lv)], ['命中率', '+' + pct(0.003 * lv)]] });
peDef('pe_book', { name: '驱魔之书', lvReq: 18, maxLv: 10, sp: 15, passive: true, col: '#d8a04a',
  desc: '【被动】参透驱魔典籍：驱魔技能攻击力提高、冷却时间 −10%（觉醒除外）。', infoExtra: lv => [['技能攻击力', '+' + pct(0.006 * lv)], ['冷却时间', '−10%']] });
peDef('pe_spirit', { name: '斗志散发', lvReq: 21, maxLv: 10, sp: 20, passive: true, col: '#ff4a2a',
  desc: '【被动】（2024 起常驻，不再需要蓄满斗志）斗志外放：普攻和技能攻击力常驻提高。', infoExtra: lv => [['攻击力', '+' + pct(0.02 + 0.004 * lv)]] });
// 封魔莲华：永久 BUFF，武器附带火 / 光属性（取强化更高的一边）、攻击力 / 直接攻击的硬直提高
defSkill('pe_lotus', { name: '封魔莲华', cls: 'priest', job: PE, lvReq: 16, mp: 40, cd: 5, buff: true, cast: true, col: '#ff8a3a',
  desc: '【BUFF · 永久】施放 0.7 秒：以莲华封印加持巨兵，武器附带火 / 光属性（取你属性强化更高的一边），攻击力、命中率、直接攻击的硬直提高。永久持续（决斗场 30 秒）。',
  infoExtra: lv => [['攻击力', '+' + pct(0.03 + 0.01 * lv)], ['硬直', '+' + pct(0.03 * lv)], ['武器属性', '火 / 光'], ['施放时间', '0.7 秒']], ai: { kind: 'buff' },
  act: lv => ({ name: 'pe_lotus', clip: 'peSeal', dur: 0.7, noCounter: true,
    events: [evAt(0.05, e => { fxCharge(e, PE_COL.fire, 3); peTalisman(e, 3); sfx.charge(); }),
      evAt(0.55, e => { e.buffs.pe_lotus = { t: game.pvp ? 30 : 1e6, atk: 0.03 + 0.01 * lv, stagger: 8 * lv, lv, name: '封魔莲华', col: '#ff8a3a' };
        fxSpr('petal', e.x, e.y, e.z + 60, { w: 150, dur: 0.6, col: '#ff8a3a', grow: [0.4, 1.2] }); fxSpr('rune', e.x, e.y, 2, { w: 180, h: 70, dur: 0.7, col: '#ff6a2a', grow: [0.4, 1] });
        fxAura(e, '#ffb04a', 0.8); sfx.buff(); fxText('封魔莲华', e.x, e.y, e.z + 24, { col: '#ffb070', size: 12 }); })] }) });

/* =====================================================================
   巨兵系主动技能（伤害按本作同冷却技能的尺度 ≈ 冷却 × 0.45，各段比例照官方 DFO Lv1 百分比；距离按官方 px × 1.05，宁大勿小）
   ===================================================================== */
// 疾风打：霸体肩撞冲刺（不能转向，攻速越快冲得越远），把路上的敌人推着走，冲到头出一道冲击波；15% 几率眩晕 1 秒。官方固定 1 级、随基础精通成长 → 本作转职自动学会、随角色等级成长
const peGaleLv = p => clamp(1 + Math.floor((peLvl(p) - 15) / 3), 1, 16);
defSkill('pe_gale', { name: '疾风打', cls: 'priest', job: PE, lvReq: 15, maxLv: 1, sp: 0, mp: 20, cd: 4, col: '#e8d8a0', icon: 'pe_gale',
  desc: '【转职时自动学会，威力随角色等级提升】以霸体向前肩撞冲刺（冲刺中不能转向，攻击速度越快冲得越远），把路上的敌人推着走，冲到头打出一道冲击波；15% 几率眩晕 1 秒。可以在普攻中、落凤锤砸地后施放。',
  pow: () => skillDmg(2.2, 0.22, peGaleLv(game.player)), infoExtra: () => [['肩撞 : 冲击波', '355% : 532%'], ['眩晕几率', '15%']], ai: { kind: 'gap', r: [0, 260], dy: 40 },
  act: (lv, p) => { const L = peGaleLv(p), T = skillDmg(2.2, 0.22, L), push = new Set();
    return { name: 'pe_gale', clip: 'peThrust', dur: 0.5, noCounter: true, superArmor: true, move: [[0.02, 0.26, 950]],
      onStart: e => { sfx.swing(true); fxDust(e.x, e.y, 4, 10); fxStreak({ x: e.x - e.face * 30, y: e.y, z: e.z + 60, face: e.face, len: 220, w: 22, col: '#fff4d0', dur: 0.26 }); },
      update: e => { const a = e.act; if (e.actT > 0.27) return;
        if (Math.floor(e.actT / 0.04) !== a.ai) { a.ai = Math.floor(e.actT / 0.04); fxAfterimage(e, '#fff0c0'); fxDust(e.x - e.face * 10, e.y, 1, 6); }
        for (const t of peFoes(e, e.x + e.face * 60, e.y, 70, 60, 130)) if ((t.x - e.x) * e.face > -10) { if (!push.has(t)) { push.add(t); applyHit(e, t, { dmg: T * 0.4, stun: 0.5, knock: 60, hs: 0.04, snd: 'blunt', col: '#fff0c0', box: null }, { src: e }); } if (peMovable(t)) t.x = e.x + e.face * 70; } },
      events: [evAt(0.3, e => { const x = e.x + e.face * 90; fxSpr('wave', x, e.y, 50, { h: 160, dur: 0.3, rot: e.face * Math.PI / 2, col: '#fff4d0', grow: [0.6, 1.3] }); peSlamFx(x, e.y, 140, '#fff0c0', 0.6);
        instantHit(e, { box: [20, 220, 60, 0, 140], dmg: T * 0.6, stun: 0.6, knock: 240, hs: 0.07, shake: 3, big: 1.3, snd: 'blunt', col: '#fff0c0', onHit: (a, t) => { if (Math.random() < 0.15) addStatus(t, 'stun', 1, { src: a }); } }); })] }; } });
// 星落打：抓住身前一个敌人（霸体也能抓；抓不动的原地打）→ 小跳 → 把周围的敌人吸过来 → 抡圆了扔出去（被扔的撞到身边的敌人）。
// 点按 = 低、按住 = 高；方向：不按 = 砸进前方地面，→ = 平着扔远，↑ = 斜着扔高。抓住起全程无敌
defSkill('pe_star', { name: '星落打', cls: 'priest', job: PE, lvReq: 17, mp: 60, cd: 12, grab: true, col: '#ffd86a', pre: { p_launcher: 1 },
  desc: '抓住身前的一个敌人（霸体的也能抓；抓不动的领主原地挨打），小跳一下把周围的敌人吸过来，再抡圆了巨兵把他扔出去，砸到身边的敌人。按住技能键 = 扔得更高；方向键：不按 = 砸进前方地面、按 → = 平着扔远、按 ↑ = 斜着扔高。抓住以后全程无敌。可以在普攻中、落凤锤砸地后施放。需要空斩打 Lv1。',
  pow: lv => skillDmg(5.6, 0.56, lv), infoExtra: () => [['抓取', '1 个（能抓霸体）'], ['无敌', '抓住以后']], ai: { kind: 'grab', r: [0, 120], dy: 30 },
  act: (lv, p) => { const T = skillDmg(5.6, 0.56, lv);
    return { name: 'pe_star', clip: 'peGrab', dur: 0.5, noCounter: true,
      hits: [HB(0.06, 0.2, [0, 125, 42, 0, 130], T * 0.1, { grab: true, grabInvul: true, stun: 0.5, knock: 20, hs: 0.05, snd: 'blunt',
        onGrabFail: (a, t) => { if (!a.act || a.act.skill !== 'pe_star' || a.act.fail) return; a.act.fail = t; a.act.dur = a.actT + 0.7; } })],
      onGrab: (e, t) => { const a = e.act; if (a.gT !== undefined) return; a.gT = e.actT; a.dur = e.actT + 1.0; t.heldClip = 'hit2'; e.vz = 260; e.z = Math.max(e.z, 1); e.play('peCharge', true); sfx.swing(false); },
      update: e => { const a = e.act;
        if (a.fail && !a.failDone && e.actT - (a.dur - 0.7) > 0.3) { a.failDone = true; e.play('peSwing', true); peArc(e, { a0: -2.2, a1: 1.3 }); if (!a.fail.dead) applyHit(e, a.fail, { dmg: T, knock: 120, launch: 200, hs: 0.1, sure: true, big: 1.5, snd: 'blunt', box: null }, { src: e }); }
        if (a.gT === undefined || a.thrown) return; const k = e.actT - a.gT;
        if (k < 0.45) { for (const t of peFoes(e, e.x, e.y, 260, 140)) if (!t.heldBy) pePull(t, e.x + e.face * 60, e.y, 0.08); if (Math.random() < 0.4) fxCharge(e, PE_COL.gold, 1); }
        if (k >= 0.45) { a.thrown = true; const t = e.grabbed, I = e.pad, dir = I ? (I.is('up') ? 'up' : I.dx() === e.face ? 'far' : 'down') : 'down', held = I && e.act.key && I.is(e.act.key), hi = held ? 1.5 : 1;
          e.play('peSwing', true); peArc(e, { a0: 2.3, a1: -1.2, r: 130 }); cam.shake = Math.max(cam.shake, 6); sfx.swing(true);
          instantHit(e, { box: [-40, 170, 70, 0, 170], dmg: T * 0.2, launch: 260, knock: 80, hs: 0.05, snd: 'blunt', col: PE_COL.gold });
          if (t) { const o = dir === 'up' ? { dx: 260, h: 260 * hi, dur: 0.6 } : dir === 'far' ? { dx: 380, h: 70 * hi, dur: 0.45 } : { dx: 170, h: 120 * hi, dur: 0.4 };
            fxStreak({ x: t.x, y: t.y, z: t.z + 40, face: e.face, len: o.dx, w: 20, col: '#ffe890', dur: 0.4 });
            throwArc(e, t, { ...o, other: { dmg: T * 0.2, down: true, knock: 150, hs: 0.05, snd: 'blunt' },
              hit: { dmg: T * 0.7, down: true, downLift: 160, knock: 100, hs: 0.12, shake: 5, big: 1.6, snd: 'blunt' }, onLand: (a2, t2) => { peSlamFx(t2.x, t2.y, 170, PE_COL.gold, 1); fxSpr('spark', t2.x, t2.y, 30, { w: 120, dur: 0.4, col: '#fff0a0' }); } }); }
          a.dur = e.actT + 0.4; } },
      hold: (e, t) => { t.x = e.x + e.face * 30; t.y = e.y + 0.5; t.z = e.z + 90; t.face = -e.face; } }; } });
// 狂乱锤击：霸体原地连砸 4 下（施放时先把前方的敌人聚过来），最后一下是蓄力重锤（眩晕）；连按 / 按住技能键加速，按住 ← / → 转身，最后一下之前可以按 C 跳跃取消
defSkill('pe_chaos', { name: '狂乱锤击', cls: 'priest', job: PE, lvReq: 19, mp: 90, cd: 14, col: '#e8a04a',
  desc: '以霸体原地抡起巨兵连砸 4 下（施放时先把前方的敌人聚到身前），最后一下是蓄满力的重锤，打中的敌人眩晕。连按或按住技能键砸得更快；按住 ← / → 可以转身；最后一下之前可以按 C 跳跃取消。可以在普攻中、落凤锤砸地后施放。',
  pow: lv => skillDmg(6, 0.6, lv), infoExtra: () => [['段数', '4（前 3 下 1038% : 最后 1223%）'], ['最后一下', '眩晕 1 秒']], ai: { kind: 'aoe', r: [0, 200], dy: 60 },
  act: lv => { const T = skillDmg(6, 0.6, lv), per = T * 1038 / 4337, fin = T * 1223 / 4337;
    return { name: 'pe_chaos', clip: 'pePlant', dur: 1.35, noCounter: true, superArmor: true,
      onStart: e => { for (const t of peFoes(e, e.x + e.face * 120, e.y, 260, 110)) pePull(t, e.x + e.face * 95, e.y, 0.7); fxShock(e.x + e.face * 95, e.y, 220, PE_COL.axe); sfx.swing(true); },
      onInput: (e, I) => { const a = e.act; if ((a.n || 0) < 4 && peJumpCancel(e, I)) return true;
        const d = I.dx(); if (d && d !== e.face) e.face = d; if ((a.key && I.is(a.key)) || I.buffered(a.key || 'cmd')) { a.fast = true; if (a.key) I.consume(a.key); } return false; },
      update: (e, dt) => { const a = e.act; a.n = a.n || 0; if (a.fast && a.n < 4) e.actT += dt * 0.5;
        const T0 = [0.18, 0.42, 0.66, 1.02]; if (a.n < 4 && e.actT >= T0[a.n]) { const last = a.n === 3; a.n++;
          e.play(last ? 'peSwing' : 'pePlant', true); e.animT = last ? 0.14 : 0.2; const x = e.x + e.face * 95;
          peArc(e, { a0: -2.4, a1: 1.2, r: last ? 130 : 110 }); peSlamFx(x, e.y, last ? 200 : 140, last ? PE_COL.fire : PE_COL.axe, last ? 1.3 : 0.7);
          instantHit(e, { box: [-10, 190, 70, 0, 150], dmg: last ? fin : per, stun: last ? 0.7 : 0.45, knock: last ? 180 : 10, launch: last ? 300 : 0, hs: last ? 0.1 : 0.05, shake: last ? 5 : 2, big: last ? 1.6 : 1, downHit: true, snd: 'blunt', col: PE_COL.axe,
            onHit: (a2, t) => { pePull(t, x, e.y, 0.4); if (last) addStatus(t, 'stun', 1, { src: a2 }); } });
          if (last) a.dur = e.actT + 0.32; } } }; } });
// 疾空旋风破：霸体抡着巨兵大回旋 7 圈，方向键移动、连按加速，把周围的敌人往身前卷，最后一圈把敌人甩上天；可以按 C 跳跃取消
defSkill('pe_spin', { name: '疾空旋风破', cls: 'priest', job: PE, lvReq: 20, mp: 100, cd: 20, col: '#f0c060', pre: { pe_star: 1 },
  desc: '以霸体抡着巨兵原地大回旋 7 圈，方向键可以移动，连按技能键转得更快；每一圈把周围的敌人往身前卷，最后一圈把敌人甩上天。可以按 C 跳跃取消。可以在普攻中、落凤锤砸地后施放。需要星落打 Lv1。',
  pow: lv => skillDmg(8, 0.8, lv), infoExtra: () => [['段数', '7（6 圈 848% : 最后 1774%）'], ['半径', '165px']], ai: { kind: 'aoe', r: [0, 170], dy: 80 },
  act: lv => { const T = skillDmg(8, 0.8, lv), per = T * 848 / 6862, fin = T * 1774 / 6862;
    return { name: 'pe_spin', clip: 'peSpin', dur: 2.2, noCounter: true, superArmor: true,
      onStart: e => { const a = e.act; a.n = 0; a.ring = addFx({ ent: e, x: e.x, y: e.y + 0.6, z: 0, dur: 2.2, draw(c) { const E = this.ent; if (!E.act || E.act.name !== 'pe_spin') { this.dur = this.t; return; }
        drawSpr(c, fxTint('slash', PE_COL.axe), sx(E.x), sy(E.y, E.z + 50), 320, 110, { rot: -game.t * 14, alpha: 0.75 }); drawSpr(c, fxTint('slash', '#fff4d0'), sx(E.x), sy(E.y, E.z + 60), 260, 90, { rot: game.t * 20 + 2, alpha: 0.7 }); drawSpr(c, fxTint('shock', PE_COL.gold), sx(E.x), sy(E.y, 0), 330, 0, { alpha: 0.5 }); } }); },
      onInput: (e, I) => { const a = e.act; if (a.n < 7 && peJumpCancel(e, I)) return true;
        e.vx = I.dx() * 220; e.vy = I.dy() * 130; if (I.buffered(a.key || 'cmd')) { I.consume(a.key || 'cmd'); a.fast = 0.3; } return false; },
      update: (e, dt) => { const a = e.act; if (a.fast > 0) { a.fast -= dt; e.actT += dt * 0.6; } e.drawFlip = Math.floor(e.actT / 0.07) % 2 === 1;
        const k = Math.floor((e.actT - 0.08) / 0.27); if (e.actT > 0.08 && k !== a.k && a.n < 7) { a.k = k; a.n++; const last = a.n === 7; sfx.swing(last);
          for (const t of peFoes(e, e.x, e.y, 360, 140)) pePull(t, e.x + e.face * 60, e.y, 0.18);
          blast(e, e.x, e.y, last ? 190 : 165, { dmg: last ? fin : per, stun: 0.35, knock: last ? 60 : -40, launch: last ? 520 : 0, airLift: last ? 0 : 60, hs: last ? 0.1 : 0.03, downHit: true, big: last ? 1.6 : 1, snd: 'blunt', col: PE_COL.axe }, { zMax: 160 });
          if (last) { e.drawFlip = false; a.dur = e.actT + 0.3; fxShock(e.x, e.y, 260, PE_COL.gold); cam.shake = 6; } } },
      onEnd: e => { e.drawFlip = false; e.vy = 0; } }; } });
// 无双击：抡两圈把四面八方的敌人卷到身前一处（打击型抓取），然后一记过顶重砸；卷人时霸体、砸下时无敌；按住技能键可以推迟砸下（最多 1 秒）
defSkill('pe_atomic', { name: '无双击', cls: 'priest', job: PE, lvReq: 20, mp: 110, cd: 40, col: '#ffb040', pre: { pe_chaos: 1 },
  desc: '抡着巨兵转两圈，把四面八方的敌人卷到身前一处（打击型抓取：抓不动的敌人原地不动，但在范围里照样挨砸），然后高高跃起一记过顶重砸。卷人时霸体，砸下时无敌；按住技能键可以推迟砸下（最多 1 秒）。可以在落凤锤砸地后施放。需要狂乱锤击 Lv1。',
  pow: lv => skillDmg(12, 1.2, lv), infoExtra: () => [['卷人 × 2 : 重砸', '791% : 10505%'], ['卷人半径', '340px']], ai: { kind: 'aoe', r: [0, 300], dy: 110 },
  act: lv => { const T = skillDmg(12, 1.2, lv), spin = T * 791 / 12087, slam = T * 10505 / 12087;
    return { name: 'pe_atomic', clip: 'peSpin', dur: 1.5, noCounter: true, superArmor: [0, 0.7],
      update: e => { const a = e.act, gx = e.x + e.face * 110;
        for (const [i, t0] of [[1, 0.1], [2, 0.36]]) if (!a['s' + i] && e.actT >= t0) { a['s' + i] = true; e.drawFlip = i === 1; sfx.swing(true); fxShock(e.x, e.y, 340, PE_COL.axe); peArc(e, { a0: -3, a1: 3, r: 150, off: [0, 50] });
          for (const t of peFoes(e, e.x, e.y, 360, 170, 260)) { applyHit(e, t, { dmg: spin, stun: 0.9, knock: 0, hs: 0.04, downHit: true, snd: 'blunt', col: PE_COL.axe, box: null }, { src: e }); pePull(t, gx, e.y, i === 1 ? 0.6 : 0.95); if (!t.boss) addStatus(t, 'hold', 1.2, { src: e }); } }
        if (a.s2 && !a.up && e.actT >= 0.6) { e.drawFlip = false;
          const I = e.pad; if (I && a.key && I.is(a.key) && (a.wait || 0) < 1) { a.wait = (a.wait || 0) + 1 / 60; e.actT -= 1 / 60; if (Math.random() < 0.4) fxCharge(e, PE_COL.fire, 2); return; }
          a.up = true; e.vz = 520; e.z = Math.max(e.z, 1); e.play('peLeap', true); a.invul = [e.actT, e.actT + 0.9]; sfx.jump(); }
        if (a.up && !a.fall && e.actT >= 0.82 + (a.wait || 0)) { a.fall = true; e.vz = -1400; e.play('peSwing', true); } },
      onLand: e => { const a = e.act; if (!a.up) { e.vz = 0; return; } if (a.slam) return; a.slam = true; e.vx = 0; a.dur = e.actT + 0.42; const x = e.x + e.face * 110;
        cam.shake = 14; cam.flash = 0.12; cam.flashCol = '#ffe0a0'; peSlamFx(x, e.y, 300, PE_COL.fire, 2); peCracks(x, e.y, 220, '#ffb04a', 0.8); fxSpr('pillar', x, e.y, 0, { h: 260, ay: 1, dur: 0.5, col: PE_COL.gold, grow: [0.5, 1.1] });
        for (const t of ents) if (t.status && t.status.hold && t.status.hold.src === e) delete t.status.hold;
        blast(e, x, e.y, 200, { dmg: slam, launch: 500, knock: 120, hs: 0.16, big: 2.2, shake: 6, downHit: true, snd: 'blunt', col: '#ffe0a0' }, { zMax: 220 }); },
      onEnd: e => { e.drawFlip = false; } }; } });
// 逆鳞震：把巨兵往后一拉、跃起、砸地震出巨大的裂缝（单段）；按住技能键蓄力：跳得更高、范围最多 +110%
defSkill('pe_quake', { name: '逆鳞震', cls: 'priest', job: PE, tier: 1, lvReq: 25, mp: 110, cd: 50, col: '#ff8a2a',
  desc: '把巨兵往后一拉、纵身跃起，狠狠砸向地面震出巨大的裂缝（单段伤害）。按住技能键蓄力（最多 1 秒）：跳得更高，裂缝范围最多扩大 110%。蓄力中霸体。可以在落凤锤砸地后施放。',
  pow: lv => skillDmg(20, 2, lv), infoExtra: () => [['半径', '220px（满蓄 460px）'], ['段数', '1']], ai: { kind: 'aoe', r: [0, 300], dy: 90 },
  act: lv => ({ name: 'pe_quake', clip: 'peCharge', dur: 2.2, noCounter: true, superArmor: true,
    charge: { at: 0.12, max: 1.0, min: 0, dmg: 0, update: e => { if (Math.random() < 0.5) fxCharge(e, PE_COL.fire, 2); cam.shake = Math.max(cam.shake, 1.5); } },
    update: e => { const a = e.act; if (!a.chargeDone || a.up) return; a.up = true; const k = a.chargeK || 0; a.k = k; e.vz = 520 + 260 * k; e.z = Math.max(e.z, 1); e.vx = e.face * 90; e.play('peLeap', true); sfx.jump(); fxDust(e.x, e.y, 5, 12); },
    onLand: e => { const a = e.act; if (!a.up) { e.vz = 0; return; } if (a.slam) return; a.slam = true; e.vx = 0; e.play('pePlant', true); a.dur = e.actT + 0.5;
      const k = a.k || 0, R = 220 * (1 + 1.1 * k), x = e.x + e.face * 80; cam.shake = 16; cam.flash = 0.14; cam.flashCol = '#ffc080';
      peSlamFx(x, e.y, R * 1.2, PE_COL.fire, 2); peCracks(x, e.y, R, '#ff9a3a', 1.2); fxSpr('lava', x, e.y, 0, { h: 160 + 60 * k, ay: 1, dur: 0.6, grow: [0.5, 1.1] });
      for (let i = 0; i < 6; i++) { const ang = i / 6 * TAU; game.after(0.05 * i, () => fxSpr('pillar', x + Math.cos(ang) * R * 0.6, e.y + Math.sin(ang) * R * 0.2, 0, { h: 120, w: 40, ay: 1, dur: 0.4, col: '#ff8a2a', grow: [0.4, 1] })); }
      blast(e, x, e.y, R, { dmg: skillDmg(20, 2, lv), launch: 520, knock: 140, hs: 0.16, big: 2.2, shake: 6, downHit: true, snd: 'blunt', col: '#ffc080' }, { zMax: 220 }); } }) });
// 逆龙七杀：跃起从天而降劈下第一斧，打中的第一个敌人超级硬直，接着 6 斧（第 5 下是双击）共 7 击（1:2:3:4:5:6:21）；第一斧没打中就到此为止；第一斧打中后无敌；连按技能键挥得更快
const PE_SEVEN_T = [0.22, 0.44, 0.66, 0.88, 0.98, 1.3];   // 第 2~7 斧离第一斧的时间（第 5 下双击 = 0.88 + 0.98）
const PE_SEVEN_U = [2, 3, 4, 5, 6, 21];
defSkill('pe_seven', { name: '逆龙七杀', cls: 'priest', job: PE, tier: 2, lvReq: 26, mp: 110, cd: 50, col: '#ffd040',
  desc: '跃起从天而降劈下第一斧：打中的第一个敌人陷入超级硬直，接着连续挥出 6 斧（第 5 下是双击）共 7 击，最后一斧威力最大（1 : 2 : 3 : 4 : 5 : 6 : 21）。第一斧没打中就到此为止；第一斧打中后无敌。连按技能键挥得更快。可以在落凤锤砸地后施放。',
  pow: lv => skillDmg(20, 2, lv), infoExtra: () => [['段数', '7'], ['比例', '1:2:3:4:5:6:21']], ai: { kind: 'burst', r: [0, 150], dy: 40 },
  act: lv => { const U = skillDmg(20, 2, lv) / 42;
    return { name: 'pe_seven', clip: 'peLeap', dur: 1.0, noCounter: true, superArmor: true,
      onStart: e => { e.vz = 380; e.z = Math.max(e.z, 1); e.vx = e.face * 180; sfx.jump(); },
      onInput: (e, I) => { const a = e.act; if (a.first && I.buffered(a.key || 'cmd')) { I.consume(a.key || 'cmd'); a.fast = 0.25; } return false; },
      update: (e, dt) => { const a = e.act;
        if (!a.dive && e.actT > 0.18) { a.dive = true; e.vz = -1200; e.play('peSwing', true); }
        if (!a.first) return; if (a.fast > 0) { a.fast -= dt; e.actT += dt * 0.6; }
        while (a.n <= 6 && e.actT - a.t0 >= PE_SEVEN_T[a.n - 1]) { const i = a.n, t = a.first, last = i === 6; a.n++;
          e.play(i % 2 ? 'peSweep' : 'peSwing', true); e.animT = 0.1; peArc(e, { a0: i % 2 ? 1.3 : -2.4, a1: i % 2 ? -1.5 : 1.2, r: last ? 150 : 125, col: last ? '#ffe070' : PE_COL.axe }); sfx.swing(last);
          const h = { dmg: U * PE_SEVEN_U[i - 1], stun: 0.5, knock: last ? 420 : 0, launch: last ? 460 : 0, hs: last ? 0.2 : 0.06, big: last ? 2.4 : 1.2, shake: last ? 8 : 3, downHit: true, snd: 'blunt', col: '#ffe070', box: null };
          if (t && !t.dead) { if (last && t.status) delete t.status.hold; applyHit(e, t, { ...h, sure: true }, { src: e }); }
          for (const o of peFoes(e, e.x + e.face * 90, e.y, 150, 70, 200)) if (o !== t) applyHit(e, o, { ...h, dmg: h.dmg * 0.5 }, { src: e });
          if (last) { cam.shake = 12; cam.flash = 0.18; cam.flashCol = '#fff0a0'; peSlamFx(e.x + e.face * 100, e.y, 240, '#ffe070', 1.8); fxText('七杀!', e.x, e.y, e.z + 70, { col: '#ffe070', size: 18 }); a.dur = e.actT + 0.4; } } },
      onLand: e => { const a = e.act; if (a.landed) { e.vz = 0; return; } a.landed = true; e.vx = 0; peArc(e, { a0: -2.6, a1: 1.2, r: 130 }); peSlamFx(e.x + e.face * 80, e.y, 140, PE_COL.gold, 0.8);
        let tgt = null; for (const t of peFoes(e, e.x + e.face * 80, e.y, 115, 60, 200)) { if (!tgt || Math.abs(t.x - e.x) < Math.abs(tgt.x - e.x)) tgt = t; applyHit(e, t, { dmg: U, stun: 0.6, knock: 0, hs: 0.06, downHit: true, snd: 'blunt', col: PE_COL.gold, box: null }, { src: e }); }
        if (!tgt) { a.dur = e.actT + 0.35; return; }
        a.first = e._peSeven = tgt; addStatus(tgt, 'hold', 2.6, { src: e, force: true }); a.dur = e.actT + 1.9; a.t0 = e.actT; a.n = 1; a.invul = [e.actT, e.actT + 2.2]; fxText('逆龙!', e.x, e.y, e.z + 60, { col: '#ffe070', size: 14 }); },
      onEnd: e => { const t = e._peSeven; e._peSeven = null; if (t && t.status && t.status.hold && t.status.hold.src === e) delete t.status.hold; } }; } });
