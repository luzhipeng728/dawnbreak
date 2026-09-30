/* =====================================================================
   格斗家转职：柔道家（男，grappler，B7）—— 按国服现版对齐（docs/SKILLS_OFFICIAL_fighter.md §7；逐技能对照 docs/skills/fighter_grappler_final.md）
   本文件：通用构件（抓轰炮 / 暴力抓取 / 滑行抓取 / 连环抓取 / 二觉预约 / 摔地冲击波）+ Lv15~20 的转职技能 + 膝击 / 金刚碎的柔道家版本 + 转职登记。
   一觉之后（力之奥义、死亡旋律、彗星冲击、武莲华 …… 三觉 山岳崩颓）在 fighter_grappler_p1.js。
   招牌机制：
     抓取     几乎全是抓取：抓住期间自己无敌（h.grabInvul），能抓霸体 / 格挡中的敌人
     抓轰炮   抓不了的（领主 / 不可抓取 / 刚被抓过）→ 强力推开 + 冲击波 + 无视霸体的强制硬直（addStatus 'hold'，领主 ×0.3），伤害 = 这个技能剩下的伤害；
              同一帧同时碰到能抓的和抓不了的，以抓住为准（fgFailMark → 下一帧 fgFailTick）；决斗场不给硬直
     暴力抓取 开关 BUFF：膝击 / 抛投 / 地狱风火轮 / 黑震旋风 变成范围抓（grabRange），抓取技能和普攻伤害提高，抓取动作带霸体
     滑行抓取 冲刺中放 膝击 / 抛投 / 浮空凌云踢 / 地狱风火轮 / 武莲华 / 黑震旋风：先滑过去（上下键调纵深），滑的途中碰到就抓
     连环抓取 野蛮冲撞 / 彗星冲击命中后可以取消接抓取技能，接上的那一下伤害提高
     二觉预约 浮空凌云踢 / 疾波猛坠 / 裂石破天 / 死亡旋律 / 疾风闪电 / 黑震流·殒灭 施放中按二觉（或三觉）：先把本技能剩下的终结伤害打完，再接觉醒（act.fgFin）
   动作片段（J.anims）：柔道家专用帧名前缀 fg_（B1 出帧：fg_scissor 空中剪刀腿夹、fg_swing1/2 抡人旋转、fg_press 身体压下、fg_flip 后空翻、fg_plant 倒插地面），
     没出帧时依次用格斗家共用帧（f_grab / f_lift / f_slam …，B1）、通用帧兜底；矢量占位模型用下面的 POSE.fg*。
   ===================================================================== */
const GJ = 'grappler';
const FG_COL = { shock: '#cfe6ff', hit: '#ffe6b0', fire: '#ff8a3a', rock: '#9a8468', dust: '#b8a48a', wind: '#e4f4ff', gold: '#ffc84a', red: '#ff5a3a' };
const fgIs = p => !!p && p.cls === 'fighter' && jobOf(p) === GJ;
const fgOG = p => !!(p && p.buffs && p.buffs.fg_overgrab);   // 暴力抓取开着
const FG_OG_RANGE = 190;
const fgMul = e => (e && e.act && e.act.dmgMul) || 1;   // 当前动作的伤害倍率（blast / 投掷走投射物口径，不自动乘，这里手动乘）
const fgWaveK = e => hasSkill(e, 'fg_takedown') ? 1.05 + 0.03 * skLv(e, 'fg_takedown') : 1;   // 摔技强化：冲击波范围
// 按下的方向（相对朝向）：u 上 / d 下 / f 前 / b 后 / '' 没按
function fgDir(e) { const I = e.pad; if (!I) return ''; if (I.is('up')) return 'u'; if (I.is('down')) return 'd'; const d = I.dx(); return d === e.face ? 'f' : d ? 'b' : ''; }
// 以 e 为源、不乘当前动作倍率地打一下（m = 施放时记下的倍率）
function fgHitT(e, t, h, m = 1, src) { if (!t || t.dead || t.remove) return false; return applyHit(e, t, { sure: true, noCounterBonus: true, snd: 'blunt', ...h, dmg: (h.dmg || 0) * m }, { proj: true, src: src || { x: e.x, y: e.y, z: e.z, face: e.face } }); }
// 摔地冲击波：冲击环 + 尘土 + 碎石 + 范围伤害；范围吃「摔技强化」
function fgWave(e, x, y, r, h, o = {}) {
  const R = r * fgWaveK(e), m = o.mul ?? fgMul(e), col = o.col || FG_COL.shock;
  fxShock(x, y, R, col); fxDust(x, y, o.dust ?? 8, R * 0.35, FG_COL.dust);
  if (o.burst !== false) fxBurst(x, y, 16, R * 1.1, o.bcol || col);
  if (o.rocks) fgRocks(x, y, o.rocks, R);
  cam.shake = Math.max(cam.shake, o.shake ?? 3); sfx.boom(o.boom ?? 0.5);
  blast(e, x, y, R, { knock: 140, stun: 0.45, hs: 0.05, snd: 'blunt', col, downHit: true, ...h, dmg: (h.dmg || 0) * m }, { zMax: o.zMax ?? 70 });
}
// 换色：fx 里没登记基础色相的素材（vortex 紫 273、tornado 青绿 112）按实际色相换；近白色 → 去饱和提亮（不改全局的 FX_BASE_HUE，别的职业按原样用）
const FG_HUE = { vortex: 273, tornado: 112 };
function fgTint(name, col) {
  const b = FG_HUE[name]; if (!col || b === undefined || !IMG['fx/' + name]) return fxTint(name, col);
  const { h, s } = hueOf(col); return s < 0.22 ? tintImg('fx/' + name, 0, 1.2, 0.05) : tintImg('fx/' + name, Math.round(h - b), 1, 1);
}
function fgSpr(name, x, y, z, o = {}) { const f = fxSpr(name, x, y, z, o); if (o.col && FG_HUE[name] !== undefined) f.img = fgTint(name, o.col); return f; }
// 碎石：石块素材向上迸出再落下
function fgRocks(x, y, n, r = 80, col) {
  const img = col ? fxTint('rock', col) : IMG['fx/rock'];
  for (let i = 0; i < n; i++) {
    const a = rnd(0, TAU), d = rnd(0.2, 1) * r * 0.5;
    addFx({ x: x + Math.cos(a) * d, y: y + Math.sin(a) * d * 0.4 + 0.5, z: 4, vx: Math.cos(a) * rnd(40, 140), vz: rnd(260, 520), s: rnd(8, 20), rot: rnd(0, TAU), dur: rnd(0.6, 0.9), img,
      update(dt) { this.x += this.vx * dt; this.vz -= 1300 * dt; this.z = Math.max(0, this.z + this.vz * dt); this.rot += dt * 8; },
      draw(c) { const k = this.t / this.dur; drawSpr(c, this.img, sx(this.x), sy(this.y, this.z), this.s, 0, { rot: this.rot, add: false, alpha: k > 0.8 ? (1 - k) / 0.2 : 1 }); } });
  }
}
// 旋风：旋风素材（染色）原地转几圈
function fgWind(x, y, h, dur, col = FG_COL.wind, o = {}) {
  const img = fgTint('tornado', col);
  return addFx({ x, y: y + 1, z: 0, dur, img, ent: o.ent, draw(c) {
    const k = this.t / this.dur, a = (k < 0.15 ? k / 0.15 : k > 0.8 ? (1 - k) / 0.2 : 1) * (o.alpha ?? 0.85), X = sx(this.ent ? this.ent.x + (o.ox || 0) * this.ent.face : this.x);
    for (let i = 0; i < 2; i++) drawSpr(c, this.img, X + Math.sin(game.t * 22 + i * 3) * 4, sy(this.y, 0) + 6, 0, h * (1 - i * 0.2), { ay: 1, flip: (Math.floor(game.t * 14) + i) % 2 === 1, alpha: a * (1 - i * 0.35) });
  } });
}
// 大爆炸：爆炸素材 + 冲击环 + 碎石（死亡旋律 / 裂石破天 / 疾风闪电 / 三觉）
function fgBoom(x, y, size, col = FG_COL.fire, rocks = 10) {
  fxSpr('explosion', x, y, size * 0.35, { w: size, dur: 0.55, grow: [0.4, 1.1], col });
  fxBurst(x, y, 20, size * 1.2, col); fxShock(x, y, size * 0.9, col); fgRocks(x, y, rocks, size * 0.8);
  cam.shake = Math.max(cam.shake, 8); sfx.boom(1);
}

/* ---- 抓轰炮（被动，转职自动学会）：抓不了的敌人 → 强力推开 + 冲击波 + 无视霸体的强制硬直，伤害 = 本技能剩下的伤害 ---- */
const fgFailMark = (rest, co) => (a, t) => { const A = a.act; if (A && !A.fgFailT && !A.fgCannoned) { A.fgFailT = t; A.fgRest = rest; A.fgCo = co; } };
function fgFailTick(e) {
  const A = e.act; if (!A || !A.fgFailT || A.fgCannoned) return;
  if (e.grabbed) { A.fgFailT = null; return; }   // 同一帧里还抓住了别人：以抓住为准
  if (A.fgOnFail) { const t = A.fgFailT; A.fgFailT = null; A.fgCannoned = true; A.fgOnFail(e, t); return; }   // 技能自己的回退（无情摔击、黑震旋风……）
  fgCannon(e, A.fgFailT, A.fgRest, A.fgCo);
}
function fgCannon(e, t, dmg, o = {}) {
  const A = e.act;
  if (A) { A.fgCannoned = true; A.fgFailT = null; A.fgFinDone = true; if (!o.keep) { A.dur = Math.min(A.dur, e.actT + (o.rec ?? 0.34)); A.move = null; A.onLand = A.airOnly ? null : A.onLand; } }
  if (!t || t.dead || t.remove) return;
  const pvp = isPvp(e, t), m = o.mul ?? fgMul(e), z = t.z + t.h * 0.5, x = t.x - e.face * 8;
  fxSpr('burst', x, t.y, z, { w: 150, dur: 0.3, col: '#ffffff', grow: [0.3, 1.2] }); fxBurst(x, t.y, z, 210, FG_COL.shock); fxShock(t.x, t.y, 150, FG_COL.shock);
  fxSpr('wave', t.x + e.face * 20, t.y, 0, { h: 120, dur: 0.3, ay: 1, flip: e.face < 0, col: FG_COL.shock, grow: [0.6, 1.1] });
  fxText('抓轰炮', t.x, t.y, t.z + t.h + 8, { col: '#bfe4ff', size: 12, dur: 0.7 }); cam.shake = Math.max(cam.shake, 5); sfx.boom(0.7);
  fgHitT(e, t, { dmg, throwHit: true, knock: pvp ? 220 : 170, stun: 0.55, hs: 0.1, shake: 5, big: 1.6, heavy: true, col: FG_COL.shock }, m);
  if (!pvp && !t.dead) addStatus(t, 'hold', o.hold ?? 1.5, { src: e });   // 无视霸体的强制硬直（领主 ×0.3，决斗场不给）
  for (const u of ents) if (u !== t && foe(e, u) && u.invul <= 0 && u.z < 70 && u.st !== 'down' && inGround(u, t.x, t.y, 120))   // 冲击波推开周围（不吃摔技强化）
    fgHitT(e, u, { dmg: dmg * 0.3, knock: 200, radial: true, stun: 0.4, hs: 0.04 }, m, { x: t.x, y: t.y, z: 0, face: e.face });
  e.invul = Math.max(e.invul, 0.3);   // 官方：和真的抓住一样给无敌
  if (o.after) o.after(e, t);
}
// 柔道家的抓取判定：抓住期间无敌；抓不住 → rest 伤害的抓轰炮（rest = null：技能自己处理 / 不回退）
// o.cannon = 抓轰炮的选项（rec 收招秒数 / hold 硬直秒数 / after(e, t) 之后做什么）
function fgGrabHB(t0, t1, box, dmg, rest, o = {}) {
  const { cannon, ...ho } = o;
  return HB(t0, t1, box, dmg, { grab: true, grabInvul: true, stun: 0.4, knock: 0, hs: 0.05, snd: 'blunt', col: FG_COL.hit, ...(rest !== null ? { onGrabFail: fgFailMark(rest, cannon) } : {}), ...ho });
}
// 被抓住的敌人排在施放者前面（多目标错开纵深）
function fgHoldAt(e, t, i, dx, z) { t.x = e.x + e.face * (dx + (i ? 10 + 6 * i : 0)); t.y = clamp(e.y + (i ? (i % 2 ? 1 : -1) * 8 * Math.ceil(i / 2) : 0) + 0.5, 4, DEPTH - 4); t.z = Math.max(0, z); t.face = -e.face; }

/* ---- 动作包装：抓轰炮检查、二觉预约的终结（onEnd 被觉醒打断时记下来，onCast 里结算）、滑行抓取 ---- */
function fgAct(A) {
  const up = A.update, st = A.onStart, end = A.onEnd;
  A.update = (e, dt) => { const a = e.act; fgFailTick(e); if (e.act === a && up) up(e, dt); };
  A.onStart = e => { e._fgA = e.act; if (st) st(e); };
  A.onEnd = (e, int) => {
    const a = e._fgA; e._fgA = null;
    if (int && a && a.fgFin && !a.fgFinDone && !a.fgCannoned) e._fgResv = { t: game.t, fn: a.fgFin, G: grabsOf(e).slice(), a };
    if (end) end(e, int);
  };
  return A;
}
// 所有时间点往后挪 T 秒（滑行抓取在前面插一段滑行）
function fgShift(A, T) {
  const W = w => w === true || !w ? w : typeof w[0] === 'number' ? [w[0] + T, w[1] + T] : w.map(x => [x[0] + T, x[1] + T]);
  if (A.hits) A.hits = A.hits.map(h => ({ ...h, t0: h.t0 + T, t1: h.t1 + T }));
  if (A.events) A.events = A.events.map(ev => ({ ...ev, t: ev.t + T }));
  if (A.move) A.move = A.move.map(m => [m[0] + T, m[1] + T, ...m.slice(2)]);
  A.superArmor = W(A.superArmor); A.invul = W(A.invul); A.dur += T;
  for (const k of ['cancelFrom', 'linkFrom']) if (A[k] !== undefined) A[k] += T;
  return A;
}
// 滑行抓取：冲刺中施放 → 前面插 0.26 秒滑行（约 170 px，上下键调纵深），滑行途中同一个抓取判定一直有效，抓住就停下接后面的动作；没抓到照常放完（官方）
const fgRunning = p => p.st === 'run';
const FG_SLIDE_T = 0.26;
function fgSlide(A, p) {
  if (!hasSkill(p, 'fg_slide') || !fgRunning(p) || !A.hits) return A;
  const g = A.hits.find(h => h.grab); if (!g) return A;
  fgShift(A, FG_SLIDE_T);
  A.hits.unshift({ ...g, t0: 0, t1: FG_SLIDE_T });
  A.move = [[0, FG_SLIDE_T, 650], ...(A.move || [])];
  const up = A.update, og = A.onGrab;
  A.update = (e, dt) => {
    const a = e.act;
    if (e.actT < FG_SLIDE_T && !a.slid) { e.vy = e.pad ? e.pad.dy() * 170 : 0; if (Math.random() < 0.5) fxDust(e.x - e.face * 10, e.y, 1, 6); if (!a.sfx) { a.sfx = true; fxStreak({ x: e.x - e.face * 30, y: e.y, z: e.z + 30, face: e.face, len: 120, w: 10, col: '#ffffff', dur: 0.2 }); } }
    if (up) up(e, dt);
  };
  A.onGrab = (e, t) => { const a = e.act; if (!a.slid && e.actT < FG_SLIDE_T) { a.slid = true; a.move = (a.move || []).filter(m => m[0] >= FG_SLIDE_T); e.vx = 0; e.vy = 0; e.actT = FG_SLIDE_T; } if (og) og(e, t); };
  A.fgSlide = true;
  return A;
}

/* ---- 矢量占位的骨骼姿势（美术帧到位前）；片段名 fg* 只在这个转职里用 ---- */
POSE.fgGrab = P(POSE.idle, { torso: -18, head: 12, uaF: 82, faF: 6, wF: -84, uaB: 70, faB: 16, thF: 34, shF: -30, ftF: 0, thB: -24, shB: -18, ftB: 34 });
POSE.fgLift = P(POSE.idle, { torso: 16, head: -14, uaF: 168, faF: 18, wF: 20, uaB: 160, faB: 26, thF: 24, shF: -26, ftF: 6, thB: -14, shB: -24, ftB: 30 });
POSE.fgSlam = P(POSE.idle, { torso: -46, head: 30, uaF: 40, faF: -10, wF: -60, uaB: 30, faB: 0, thF: 80, shF: -96, ftF: 20, thB: -50, shB: -40, ftB: 60 });
POSE.fgPalm = P(POSE.idle, { torso: -14, head: 8, uaF: 96, faF: -4, wF: -96, uaB: -40, faB: 50, thF: 36, shF: -30, thB: -26, shB: -14, ftB: 36 });
POSE.fgKnee = P(POSE.fgGrab, { thF: 105, shF: -125, ftF: 20, thB: -8, shB: -12 });
POSE.fgSpin = P(POSE.idle, { torso: 12, head: -8, uaF: 120, faF: 10, uaB: -110, faB: 10, thF: 96, shF: -4, ftF: 10, thB: -12, shB: -20, ftB: 30 });
POSE.fgFlip = P(POSE.jumpUp, { r: [0, -24, -150], thF: 110, shF: -130, thB: 100, shB: -120 });
POSE.fgPress = P(POSE.jumpFall, { r: [0, -12, 70], torso: 24, uaF: 150, faF: 10, uaB: 140, faB: 10, thF: 20, shF: -10, thB: 10, shB: -10 });
POSE.fgScissor = P(POSE.jumpUp, { torso: 24, thF: 84, shF: -8, ftF: 10, thB: 64, shB: -8, uaF: 30, faF: 60, uaB: -30, faB: 60 });
POSE.fgStomp = P(POSE.land, { torso: -26, head: 16, uaF: 60, faF: 40, uaB: 50, faB: 40 });
POSE.fgFocus = P(POSE.idle, { torso: -4, head: 4, uaF: 60, faF: 110, wF: -40, uaB: 50, faB: 110, thF: 36, shF: -40, thB: -36, shB: -30, ftB: 40 });
Object.assign(CLIPS.fighter, {
  fgGrab: { dur: 0.3, keys: [k(0, POSE.idle, 'out'), k(0.06, POSE.fgGrab)] },
  fgKnee: { dur: 0.16, keys: [k(0, POSE.fgGrab, 'out'), k(0.06, POSE.fgKnee), k(0.16, POSE.fgGrab)] },
  fgLift: { dur: 0.3, keys: [k(0, POSE.fgGrab, 'out'), k(0.12, POSE.fgLift)] },
  fgSlam: { dur: 0.4, keys: [k(0, POSE.fgLift, 'out'), k(0.08, POSE.fgSlam)] },
  fgPalm: { dur: 0.4, keys: [k(0, POSE.fJabW || POSE.idle, 'hold'), k(0.08, POSE.fgPalm, 'out'), k(0.4, POSE.idle)] },
  fgKick: { dur: 0.36, keys: [k(0, POSE.kickW || POSE.idle, 'hold'), k(0.06, POSE.kickSide || POSE.fgSpin, 'out'), k(0.36, POSE.idle)] },
  fgHigh: { dur: 0.4, keys: [k(0, POSE.fgGrab, 'hold'), k(0.06, POSE.fAxeUp || POSE.upS, 'out'), k(0.4, POSE.fAxeUp || POSE.upS)] },
  fgAxe: { dur: 0.3, keys: [k(0, POSE.fAxeUp || POSE.upS, 'hold'), k(0.08, POSE.fAxeDown || POSE.a3s, 'out')] },
  fgSpin: { dur: 0.24, loop: true, keys: [k(0, P(POSE.fgSpin, { r: [0, 0, 0] })), k(0.12, P(POSE.fgSpin, { torso: -10, uaF: -110, uaB: 120 }))] },
  fgShoulder: { dur: 0.4, keys: [k(0, POSE.fShoulder || POSE.dashS)] },
  fgCrouch: { dur: 0.3, keys: [k(0, POSE.fCrouch || POSE.getup)] },
  fgFlip: { dur: 0.36, keys: [k(0, POSE.jumpUp), k(0.18, POSE.fgFlip), k(0.36, P(POSE.fgFlip, { r: [0, -10, -300] }))] },
  fgDive: { dur: 0.3, keys: [k(0, POSE.fJKick || POSE.jAtkS)] },
  fgPress: { dur: 0.3, keys: [k(0, POSE.jumpUp, 'out'), k(0.12, POSE.fgPress)] },
  fgScissor: { dur: 0.3, keys: [k(0, POSE.jumpUp, 'out'), k(0.08, POSE.fgScissor)] },
  fgStomp: { dur: 0.3, keys: [k(0, POSE.fgStomp)] },
  fgFocus: { dur: 0.5, keys: [k(0, POSE.idle, 'out'), k(0.12, POSE.fgFocus)] },
  fgSwing: { dur: 0.3, loop: true, keys: [k(0, POSE.fgLift), k(0.15, P(POSE.fgLift, { torso: -10, uaF: 120, uaB: 110 }))] },
});
// 精灵帧（B1 出帧后生效）：第一个有素材的时间轴整条用
const fgHas = f => typeof SPR_DATA !== 'undefined' && !!(SPR_DATA.fighter && SPR_DATA.fighter.frames && SPR_DATA.fighter.frames[f]);
const fgTl = (...L) => L.find(tl => fgHas(tl[0][0])) || L[L.length - 1];
const FG_ANIMS = {
  fgGrab: fgTl([['fg_grab', 0]], [['f_grab', 0]], [['idle', 0]]),
  fgKnee: fgTl([['f_grab', 0], ['f_knee', 0.06]], [['idle', 0]]),
  fgLift: fgTl([['f_lift', 0]], [['charge', 0]]),
  fgSlam: fgTl([['f_slam', 0]], [['tech', 0]]),
  fgPalm: fgTl([['f_palm1', 0]], [['f_jab2', 0]], [['idle', 0]]),
  fgKick: fgTl([['f_mid1', 0], ['f_mid2', 0.06]], [['idle', 0]]),
  fgHigh: fgTl([['f_high1', 0], ['f_high2', 0.06]], [['jump2', 0]]),
  fgAxe: fgTl([['f_axe1', 0], ['f_axe2', 0.08]], [['jump3', 0]]),
  fgSpin: fgHas('f_spin1') ? { fps: 16, frames: ['f_spin1', 'f_spin2'] } : [['idle', 0]],
  fgShoulder: fgTl([['f_shoulder1', 0], ['f_shoulder2', 0.05]], [['run3', 0]]),
  fgCrouch: fgTl([['f_crouch', 0]], [['charge', 0]]),
  fgFlip: fgTl([['fg_flip', 0]], [['roll', 0]]),
  fgDive: fgTl([['f_dive', 0]], [['jump3', 0]]),
  fgPress: fgTl([['fg_press', 0]], [['f_dive', 0]], [['jump3', 0]]),
  fgScissor: fgTl([['fg_scissor', 0]], [['f_jkick2', 0]], [['jump2', 0]]),
  fgStomp: fgTl([['f_stomp', 0]], [['jump5', 0]]),
  fgFocus: fgTl([['f_focus', 0]], [['charge', 0]]),
  fgSwing: fgHas('fg_swing1') ? { fps: 12, frames: ['fg_swing1', 'fg_swing2'] } : fgTl([['f_lift', 0]], [['charge', 0]]),
};

/* ================= 被动 / BUFF（Lv15~16） ================= */
defSkill('fg_grabcannon', { name: '抓轰炮', cls: 'fighter', job: GJ, lvReq: 15, maxLv: 1, sp: 0, passive: true, type: 'phys', col: '#8ac8ff',
  desc: '【被动 · 转职自动学会】膝击、抛投、空绞锤、浮空凌云踢、地狱风火轮、霹雳旋踢、武莲华 抓不住敌人（领主、不可抓取、刚被抓过）时，改成强力推开 + 冲击波：伤害和原技能相同，并使目标进入无视霸体的强制硬直 1.5 秒（领主缩短为 30%，决斗场没有硬直）。推开的同时自己也获得短暂无敌。',
  infoExtra: () => [['强制硬直', '1.5 秒（领主 0.45 秒）'], ['冲击波半径', '120 px']] });
defSkill('fg_takedown', { name: '摔技强化', cls: 'fighter', job: GJ, lvReq: 15, maxLv: 10, passive: true, type: 'phys', col: '#c8964a',
  desc: '【被动】摔技的冲击波范围扩大，技能攻击力提高。影响膝击（↓ 摔地）、抛投（↓ 下劈）、无情摔击、霹雳旋踢、空绞锤、浮空凌云踢、疾波猛坠、地狱风火轮、裂石破天、死亡旋律、武莲华、黑震旋风、疾风闪电等所有摔地冲击波。',
  infoExtra: lv => [['冲击波范围', pct(1.05 + 0.03 * lv)], ['技能攻击力', '+' + pct(0.02 + 0.01 * lv)]] });
defSkill('fg_overgrab', { name: '暴力抓取', cls: 'fighter', job: GJ, lvReq: 15, maxLv: 10, mp: 30, cd: 5, type: 'phys', buff: true, col: '#5aa8ff', pre: { fg_takedown: 1 },
  desc: '【开关 BUFF】握拳运气（施放 0.5 秒），持续到再按一次关闭：膝击、抛投、地狱风火轮、黑震旋风 变成把周围敌人一起卷过来的范围抓取（最多 5 个）；抓取技能和普攻的攻击力提高；抓取动作期间带霸体。',
  infoExtra: lv => [['抓取 / 普攻攻击力', '+' + pct(0.1 + 0.01 * lv)], ['范围抓取半径', FG_OG_RANGE + ' px']], ai: { kind: 'buff' },
  act: lv => ({ name: 'fg_overgrab', clip: 'fgFocus', dur: 0.5, noCounter: true,
    onStart: e => { fxCharge(e, '#8ac8ff', 6); },
    events: [evAt(0.35, e => { if (!toggleBuff(e, 'fg_overgrab', 1e9, { lv })) return; fxAura(e, '#6ab8ff', 0.8); fxSpr('spark', e.x, e.y, e.z + 60, { w: 90, dur: 0.3, col: '#8ac8ff' }); sfx.boom(0.3); fxText('暴力抓取', e.x, e.y, e.z + 20, { col: '#8ac8ff', size: 12 }); })] }) });
defSkill('fg_slide', { name: '滑行抓取', cls: 'fighter', job: GJ, lvReq: 15, maxLv: 1, passive: true, type: 'phys', col: '#7ac0e0',
  desc: '【被动】冲刺中施放 膝击、抛投、浮空凌云踢、地狱风火轮、武莲华、黑震旋风 时，先向前滑行一段（约 170 px，滑行中可以按 ↑ ↓ 调整纵深），滑行途中碰到敌人就直接抓住；没抓到也会照常放完。',
  infoExtra: () => [['滑行距离', '约 170 px'], ['滑行时间', FG_SLIDE_T + ' 秒']] });
defSkill('fg_light', { name: '柔道家轻甲专精', cls: 'fighter', job: GJ, lvReq: 15, maxLv: 10, passive: true, type: 'phys', col: '#c05a4a',
  desc: '【被动】穿轻甲时力量和硬直恢复提高：每件轻甲提高攻击力和攻击速度（穿得越多加得越多）。',
  infoExtra: lv => [['每件轻甲 攻击力', '+' + pct(0.004 + 0.001 * lv)], ['每件轻甲 攻击速度', '+' + pct(0.002 + 0.0005 * lv)]] });
defSkill('fg_gauntlet', { name: '臂铠精通', cls: 'fighter', job: GJ, lvReq: 15, maxLv: 1, sp: 0, passive: true, type: 'phys', col: '#8a8a9a',
  desc: '【被动 · 转职自动学会】柔道家转职技能的冷却时间 -10%（死亡旋律、一字传承·极义震天破、山岳崩颓除外）；装备臂铠时技能 MP 消耗 -20%。不增加武器攻击力。',
  infoExtra: () => [['转职技能冷却', '-10%'], ['装备臂铠时 MP', '-20%']] });
defSkill('fg_combo', { name: '连环抓取', cls: 'fighter', job: GJ, lvReq: 16, maxLv: 10, passive: true, type: 'phys', col: '#e0b040', pre: { fg_slide: 1 },
  desc: '【被动】暴击伤害提高。野蛮冲撞、彗星冲击命中后，可以直接取消接 膝击、抛投、霹雳旋踢、无情摔击、浮空凌云踢、疾波猛坠、地狱风火轮、武莲华、黑震旋风、疾风闪电、黑震流·殒灭（彗星冲击不能接野蛮冲撞），接上的技能攻击力再提高。',
  infoExtra: lv => [['暴击伤害', '+' + pct(0.05 + 0.01 * lv)], ['取消接上时攻击力', '+' + pct(0.08 + 0.008 * lv)]] });
const FG_CHAIN = ['f_knee', 'fg_fling', 'fg_snapshot', 'fg_breakdown', 'fg_slamkick', 'fg_magnum', 'fg_rolling', 'fg_fury', 'fg_blacktornado', 'fg_stormdiver', 'fg_basalt'];
const FG_GRAB_IDS = ['f_knee', 'fg_fling', 'fg_breakdown', 'fg_snapshot', 'fg_slamkick', 'fg_rolling', 'fg_fury', 'fg_blacktornado', 'fg_stormdiver'];
// 野蛮冲撞 / 彗星冲击：命中后被取消 → 记一下（onCast 里给接上的技能加伤害）
const fgChainEnd = (e, int) => { if (int && e.hitsDone.size && hasSkill(e, 'fg_combo')) e._fgChain = game.t; };

/* ================= 抛投（Lv16） ================= */
defSkill('fg_fling', { name: '抛投', cls: 'fighter', job: GJ, lvReq: 16, mp: 20, cd: 7, type: 'phys', grab: true, col: '#d08a3a',
  desc: '抓住前方的敌人（能抓霸体、格挡中的敌人，抓住期间无敌），一脚把他踢飞：被踢飞的敌人撞到别的敌人也有伤害，撞墙或落地再受一次伤害（撞墙更痛，两者不重复）。方向键改变踢法：不按 / → 向前踢飞；↑ 往上踢飞（越重的敌人飞得越低）；↓ 下劈砸进地面并出冲击波（敌人倒地，可以接霹雳旋踢）。',
  pow: lv => skillDmg(3.2, 0.32, lv), ai: { kind: 'grab', r: [0, 105], dy: 30 },
  act: (lv, p) => {
    const P = skillDmg(3.2, 0.32, lv), og = fgOG(p);
    return fgSlide(fgAct({ name: 'fg_fling', clip: 'fgGrab', dur: 0.8, noCounter: true, superArmor: og ? [0, 0.34] : undefined,
      hits: [fgGrabHB(0.05, 0.2, [0, 108, 38, 0, 120], P * 0.1, P * 0.9, og ? { grabRange: FG_OG_RANGE } : {})],
      hold: (e, t, i) => fgHoldAt(e, t, i, 40, e.z + 12),
      events: [evAt(0.34, e => {
        const G = grabsOf(e).slice(); if (!G.length) return;
        const d = fgDir(e), R = game.room; e.play('fgKick', true); sfx.swing(true);
        fxSlash({ x: e.x, y: e.y, z: e.z, face: e.face, col: '#ffffff', a0: d === 'u' ? 1.2 : d === 'd' ? -1.4 : 0.9, a1: d === 'u' ? -1.6 : d === 'd' ? 1.4 : -0.6, r: 70, w: 18, off: [18, 50], heavy: true });
        for (const t of G) {
          if (d === 'u') { throwGrab(e, { dmg: P * 0.8, launch: 760, knock: 60, hs: 0.1, big: 1.5, shake: 3, snd: 'blunt' }); continue; }
          if (d === 'd') { throwGrab(e, { dmg: P * 0.6, spike: 520, down: true, knock: 20, hs: 0.1, big: 1.5, shake: 4, snd: 'blunt' }); continue; }
          applyHit(e, t, { dmg: P * 0.5, sure: true, noCounterBonus: true, hs: 0.09, big: 1.5, shake: 3, snd: 'blunt', col: FG_COL.hit });
          const want = t.x + e.face * 300, wall = !!R && (want > R.x1 - t.w - 1 || want < R.x0 + t.w + 1), m = fgMul(e);
          throwArc(e, t, { dx: 300, h: 60, dur: 0.42, other: { dmg: P * 0.25 * m, down: true, knock: 170 },
            hit: wall ? { dmg: P * 0.42 * m, bounce: 0.55, knock: -120, shake: 6, big: 1.8 } : { dmg: P * 0.3 * m, spike: 300 },
            onLand: (a, u) => { if (wall) { fxText('撞墙', u.x, u.y, u.z + 60, { col: '#ffcf6a', size: 11 }); fxBurst(u.x, u.y, 50, 160, FG_COL.hit); fgRocks(u.x, u.y, 5, 50); } } });
        }
        if (d === 'd') { const x = e.x + e.face * 42, m = fgMul(e); game.after(0.08, () => { if (!e.dead) fgWave(e, x, e.y, 110, { dmg: P * 0.3, launch: 200 }, { mul: m, rocks: 4 }); }); e.act.links = ['fg_snapshot']; e.act.linkFrom = e.actT + 0.1; }   // ↓ 下劈：敌人倒地，收招可以接霹雳旋踢
      })] }), p);
  } });

/* ================= 野蛮冲撞（Lv17，蓄力） ================= */
function fgTackleFly(a, t, P) {   // 被撞飞的敌人撞到别人也有伤害（能扔的才飞；领主 / 不可抓取的照常击退）
  if (t.boss || t.noGrab || t.weight > 2.2 || t.dead) return;
  const m = fgMul(a);
  game.after(0, () => { if (!t.dead && t.st === 'air') throwArc(a, t, { dx: 210, h: 55, dur: 0.36, other: { dmg: P * 0.35 * m, down: true, knock: 150 }, hit: { dmg: P * 0.05 * m, spike: 200 } }); });
}
defSkill('fg_tackle', { name: '野蛮冲撞', cls: 'fighter', job: GJ, lvReq: 17, mp: 30, cd: 8, type: 'phys', col: '#c86a3a',
  desc: '压低身体蓄力（按住技能键，蓄力中像蹲伏一样躲开高处的攻击，0.3 秒蓄满），然后滑行肩撞把敌人撞飞；被撞飞的敌人撞到别的敌人也有伤害。蓄满时冲得更快更远、伤害更高，并带霸体。不能在空中使用。学会连环抓取后，命中后可以取消接柔道家的抓取技能。',
  pow: lv => skillDmg(3.6, 0.36, lv) * 1.3, ai: { kind: 'gap', r: [0, 200], dy: 26 },
  infoExtra: () => [['满蓄时间', '0.3 秒'], ['满蓄伤害', '+30%']],
  act: (lv, p) => {
    const P = skillDmg(3.6, 0.36, lv), chain = hasSkill(p, 'fg_combo');
    return { name: 'fg_tackle', clip: 'fgShoulder', dur: 0.62, noCounter: true, hurtH: 46,
      charge: { at: 0.02, max: 0.3, min: 0, dmg: 0.3, clip: 'fgCrouch',
        update: (e, dt, k) => { if (Math.random() < 0.4) fxCharge(e, k >= 1 ? '#ffb04a' : '#ffe0a0'); },
        onRelease: (e, k) => { const a = e.act; a.hurtH = undefined; a.full = k >= 0.99; a.move = [[0.03, 0.3, a.full ? 760 : 540]]; if (a.full) { a.superArmor = true; fxAura(e, '#ffb04a', 0.4); }
          fxStreak({ x: e.x - e.face * 20, y: e.y, z: e.z + 50, face: e.face, len: a.full ? 200 : 140, w: 16, col: '#ffcf8a', dur: 0.25 }); sfx.swing(true); } },
      move: [[0.03, 0.3, 540]],
      update: e => { if (e.actT > 0.03 && e.actT < 0.3 && Math.random() < 0.6) fxDust(e.x - e.face * 12, e.y, 1, 6); },
      hits: [HB(0.04, 0.32, [-4, 72, 38, 0, 110], P, { knock: 220, down: true, downLift: 170, hs: 0.08, shake: 3, heavy: true, big: 1.4, snd: 'blunt', col: FG_COL.hit, onHit: (a, t) => fgTackleFly(a, t, P) })],
      links: chain ? FG_CHAIN : undefined, hitCancel: true, linkFrom: 0.08, onEnd: fgChainEnd };
  } });

/* ================= 无情摔击（Lv17） ================= */
function fgBreakSlam(e, P) {
  const a = e.act; if (!a || a.slammed) return; a.slammed = true; a.fgFinDone = true;
  const G = grabsOf(e).slice(), x = e.x - e.face * 34; e.play('fgSlam', true);
  for (const t of G) throwGrab(e, { dmg: P * 0.6, spike: 420, down: true, bounce: 0.35, knock: -40, hs: 0.1, big: 1.8, shake: 6, snd: 'blunt', col: FG_COL.hit });
  fgWave(e, x, e.y, 130, { dmg: P * 0.35, launch: 240 }, { rocks: 5, shake: 6 });
}
defSkill('fg_breakdown', { name: '无情摔击', cls: 'fighter', job: GJ, lvReq: 17, mp: 30, cd: 10, type: 'phys', grab: true, air: true, col: '#b0502a', pre: { fg_takedown: 3 },
  desc: '向前猛冲，撞到敌人就抓住背摔（抓住期间无敌），被摔的敌人和周围的敌人都受到冲击波伤害。不可抓取的敌人：造成伤害并使其强制硬直 2.5 秒后继续往前冲（决斗场没有硬直）。跳跃中也能使用（空中撞到不可抓取的敌人没有伤害；空中没抓到人，冷却只有 1 秒）。',
  pow: lv => skillDmg(4.4, 0.44, lv), ai: { kind: 'gap', r: [0, 220], dy: 26 },
  act: (lv, p) => {
    const P = skillDmg(4.4, 0.44, lv), air = p.st === 'jump' || p.z > 2;
    return fgAct({ name: 'fg_breakdown', clip: 'fgShoulder', dur: air ? 1.2 : 0.62, noCounter: true, airOnly: air,
      move: air ? [[0.02, 0.4, 540, -80]] : [[0.02, 0.38, 620]],
      update: e => { const a = e.act;
        if (!a.gT && e.actT < 0.4 && Math.random() < 0.6) fxStreak({ x: e.x - e.face * 30, y: e.y + rnd(-4, 4), z: e.z + rnd(30, 70), face: e.face, len: rnd(50, 90), w: 5, col: '#ffffff', dur: 0.1 });
        if (a.gT !== undefined && !air && e.actT - a.gT >= 0.28) fgBreakSlam(e, P); },
      hits: [fgGrabHB(0.02, 0.4, [-6, 74, 38, air ? -50 : 0, 120], P * 0.05, 0)],
      fgOnFail: (e, t) => {   // 不可抓取：伤害 + 强制硬直 2.5 秒，继续冲；神怡气静：原地停下出冲击波
        const a = e.act, pvp = isPvp(e, t); a.fgCannoned = false;
        if (air) return;
        if (hasSkill(e, 'fg_equanimity')) { a.move = null; e.vx = 0; a.dur = Math.min(a.dur, e.actT + 0.4); a.fgCannoned = true;
          const x = t.x - e.face * 10; fgWave(e, x, e.y, 130, { dmg: P * 0.6, knock: 60 }, { rocks: 4 }); if (!pvp) for (const u of ents) if (foe(e, u) && !u.dead && inGround(u, x, e.y, 130 * fgWaveK(e))) addStatus(u, 'hold', 2.5, { src: e }); return; }
        fgHitT(e, t, { dmg: P * 0.6, throwHit: true, knock: 30, stun: 0.5, hs: 0.08, big: 1.4, col: FG_COL.hit }, fgMul(e));
        if (!pvp && !t.dead) addStatus(t, 'hold', 2.5, { src: e });
      },
      onGrab: e => { const a = e.act; if (a.gT !== undefined) return; a.gT = e.actT; a.move = null; e.vx = 0; e.play('fgLift', true); if (air) { e.vz = -620; a.dur = 3; } else a.dur = e.actT + 0.62; },
      hold: (e, t, i) => { const a = e.act, k = clamp((e.actT - (a.gT || 0)) / 0.28, 0, 1), th = k * Math.PI; t.x = e.x + e.face * 36 * Math.cos(th); t.y = e.y + 0.5 + i * 6; t.z = Math.max(0, e.z + 24 + 64 * Math.sin(th)); t.face = -e.face; t.rot = e.face * th * 0.8; },
      onLand: e => { const a = e.act; e.vx = 0;
        if (a.gT !== undefined && !a.slammed) { fgBreakSlam(e, P); a.dur = e.actT + 0.4; a.onLand = null; return; }
        if (a.gT === undefined) { e.cool.fg_breakdown = Math.min(e.cool.fg_breakdown || 0, 1); a.dur = e.actT + 0.12; } a.onLand = null; } });
  } });

/* ================= 折颈（Lv17） ================= */
function fgNeck(a, t) {
  if (!t.statue && t.speed !== 0 && !t.botSkip) t.face = Math.sign(t.x - a.x) || a.face;   // 打得转过身去（背对自己，之后的攻击算背击）；固定型的转不过去
  const pvp = isPvp(a, t);
  game.after(0, () => { if (!t.dead) addStatus(t, 'hold', pvp ? 1.0 : 3, { src: a }); });
  addFx({ ent: t, y: t.y + 1, dur: 0.9, draw(c) { const e = this.ent, k = this.t / this.dur; for (let i = 0; i < 3; i++) { const an = game.t * 9 + i * TAU / 3; drawSpr(c, 'spark', sx(e.x + Math.cos(an) * 14), sy(e.y, e.z + e.h + 6 + Math.sin(an) * 3), 12, 0, { alpha: 1 - k, col: undefined }); } } });
}
defSkill('fg_necksnap', { name: '折颈', cls: 'fighter', job: GJ, lvReq: 17, mp: 20, cd: 9, type: 'phys', col: '#d0c060',
  desc: '一巴掌把敌人打得转过身去，并使其强制硬直 3 秒（和技能等级无关，无视霸体）。柔道家对领主 / 精英也有效（领主硬直按规则缩短为 30%）；固定型的敌人转不过去。决斗场硬直 1 秒。',
  pow: lv => skillDmg(2.6, 0.26, lv), ai: { kind: 'poke', r: [0, 95], dy: 28 },
  infoExtra: () => [['强制硬直', '3 秒（领主 0.9 秒，决斗 1 秒）']],
  act: lv => ({ name: 'fg_necksnap', clip: 'fgPalm', dur: 0.5, noCounter: true, move: [[0.02, 0.08, 120]],
    hits: [HB(0.1, 0.18, [0, 98, 38, 20, 125], skillDmg(2.6, 0.26, lv), { stun: 0.45, knock: 10, hs: 0.1, big: 1.4, shake: 2, snd: 'blunt', col: '#ffffff', onHit: fgNeck })],
    events: [evAt(0.09, e => { fxSlash({ x: e.x, y: e.y, z: e.z, face: e.face, col: '#ffffff', a0: -0.9, a1: 1.0, r: 58, w: 14, off: [26, 70] }); sfx.swing(false); })] }) });

/* ================= 霹雳旋踢（Lv18，只抓倒地的敌人） ================= */
function fgSnapGrab(e, P) {
  const a = e.act, drive = fgOG(e) && hasSkill(e, 'fg_equanimity');   // 神怡气静 + 暴力抓取：驱赶抓取（站着的也一起抓，最多 5 个）
  const h = { grabInvul: true, grabDown: true, grabMax: drive ? 5 : 1 };
  const L = ents.filter(t => foe(e, t) && t.invul <= 0 && (drive || t.st === 'down') && (t.x - e.x) * e.face > -34 && (t.x - e.x) * e.face < (drive ? 150 : 84) && Math.abs(t.y - e.y) < 34 && t.z < 40)
    .sort((p, q) => Math.abs(p.x - e.x) - Math.abs(q.x - e.x));
  for (const t of L) {
    if (grabsOf(e).length >= h.grabMax) break;
    if (canGrab(e, t, h)) startGrab(e, t, h);
    else if (!grabsOf(e).length) { fgCannon(e, t, P * 0.95); return; }
  }
  if (!grabsOf(e).length) a.dur = Math.min(a.dur, e.actT + 0.2);   // 身前没有倒地的敌人：落空
}
defSkill('fg_snapshot', { name: '霹雳旋踢', cls: 'fighter', job: GJ, lvReq: 18, mp: 30, cd: 12, type: 'phys', grab: true, col: '#6ab0ff', pre: { fg_fling: 1 }, noHitCheck: true,   // 只抓倒地的：连拍的木桩站着，不查“没打中”

  desc: '把脚边倒地的敌人拉起来，回旋踢把他踢飞，同时产生冲击波攻击周围的敌人（只能抓倒地的敌人，判定很小，要站在敌人身边）。可以在金刚碎、浮空凌云踢（↓ 砸地）、抛投（↓ 下劈）的收招中取消使用。神怡气静 + 暴力抓取：改成驱赶抓取，把身前站着的敌人也一起抓起来，并且能滑行抓取。',
  pow: lv => skillDmg(5.0, 0.5, lv), ai: { kind: 'otg', r: [0, 80], dy: 28 },
  act: (lv, p) => {
    const P = skillDmg(5.0, 0.5, lv), drive = fgOG(p) && hasSkill(p, 'fg_equanimity') && hasSkill(p, 'fg_slide') && fgRunning(p);
    return fgAct({ name: 'fg_snapshot', clip: 'fgGrab', dur: 0.78, noCounter: true, move: drive ? [[0, 0.2, 650]] : undefined,
      events: [evAt(drive ? 0.2 : 0.06, e => { e.vx = 0; fgSnapGrab(e, P); }),
        evAt(drive ? 0.26 : 0.14, e => { if (grabsOf(e).length) e.play('fgLift', true); }),
        evAt(drive ? 0.42 : 0.32, e => {
          const G = grabsOf(e).slice(); if (!G.length) return; e.play('fgSpin', true); sfx.swing(true);
          fgSpr('vortex', e.x, e.y, e.z + 50, { w: 150, dur: 0.3, col: '#bfe4ff', spin: -14, grow: [0.6, 1.2] });
          for (const t of G) throwGrab(e, { dmg: P * 0.6, launch: 420, knock: 260, hs: 0.1, big: 1.6, shake: 4, snd: 'blunt', col: FG_COL.shock });
          fgWave(e, e.x + e.face * 20, e.y, 140, { dmg: P * 0.35, launch: 300, knock: 180 }, { col: '#bfe4ff' });
        })],
      hold: (e, t, i) => { const k = clamp((e.actT - 0.1) / 0.16, 0, 1); fgHoldAt(e, t, i, 34, 8 + k * 26); t.rot = (1 - k) * 1.2 * -e.face; } });
  } });

/* ================= 空绞锤（Lv18，空中 C） ================= */
defSkill('fg_airsteiner', { name: '空绞锤', cls: 'fighter', job: GJ, lvReq: 18, mp: 30, cd: 7, type: 'phys', grab: true, air: true, airOnly: true, col: '#8a6ad8',
  pre: SKILLS.f_seismic ? { f_seismic: 1 } : undefined,
  desc: '只能在空中使用（跳跃中按 C）：用双腿夹住前下方敌人的脖子，旋转着把他砸向地面，砸地出冲击波（抓住期间无敌）。不可抓取的敌人改成踢一脚（抓轰炮）再弹起。砸完之后自己会短暂弹到空中，可以接无情摔击、裂石破天、一字传承·极义震天破。没抓到人时冷却只有 1 秒。',
  pow: lv => skillDmg(4.0, 0.4, lv), ai: { kind: 'air', r: [0, 110], dy: 30 },
  act: (lv, p) => {
    const P = skillDmg(4.0, 0.4, lv);
    return fgAct({ name: 'fg_airsteiner', clip: 'fgScissor', dur: 1.6, noCounter: true, airOnly: true, lowGrav: 0.4,
      move: [[0, 0.3, 240, -60]],
      update: e => { const a = e.act; if (a.gT !== undefined && !a.dive && e.actT - a.gT > 0.16) { a.dive = true; e.vz = -900; e.vx = e.face * 60; } if (a.dive) e.rot = 0; },
      hits: [fgGrabHB(0.02, 0.34, [-12, 84, 38, -110, 70], P * 0.1, P * 0.9, { cannon: { rec: 0.3, after: e => { e.vz = Math.max(e.vz, 380); } } })],
      onGrab: e => { const a = e.act; if (a.gT !== undefined) return; a.gT = e.actT; a.move = null; e.vx = 0; e.vz = 60; sfx.swing(true); },
      hold: (e, t, i) => { const a = e.act, k = e.actT - (a.gT || 0); t.x = e.x + e.face * (18 + i * 10); t.y = e.y + 0.5; t.z = Math.max(0, e.z - 16); t.face = -e.face; t.rot = a.dive ? Math.PI * 0.9 * -e.face : k * 12 * -e.face; },
      onLand: e => { const a = e.act; e.vx = 0; a.onLand = null;
        if (a.gT === undefined) { if (!a.fgCannoned) e.cool.fg_airsteiner = Math.min(e.cool.fg_airsteiner || 0, 1); a.dur = e.actT + 0.14; a.airOnly = false; return; }
        const G = grabsOf(e).slice(); e.play('fgSlam', true);
        for (const t of G) throwGrab(e, { dmg: P * 0.62, spike: 480, down: true, bounce: 0.3, knock: 20, hs: 0.1, big: 1.8, shake: 6, snd: 'blunt' });
        fgWave(e, e.x + e.face * 18, e.y, 120, { dmg: P * 0.28, launch: 220 }, { rocks: 5, shake: 6 });
        e.vz = 360; e.z = 1; a.dur = e.actT + 0.3; a.airOnly = true; a.bounced = true;
      },
      onEnd: e => { e.rot = 0; } });
  } });

/* ================= 浮空凌云踢（Lv19） ================= */
// 下劈（把抓着 / 预约时放开的敌人砸向地面）→ 落地：落地伤害 + 落地冲击波
function fgSlamAxe(e, a, G) {
  const P = a.P, m = a.dmgMul || 1; a.axed = G.slice(); a.axeX = G.length ? G[0].x : e.x + e.face * 40;
  for (const t of G) { if (t.dead) continue; if (t.heldBy === e) { ungrab(e, t); t.heldBy = null; t.heldClip = null; t.setState('hit'); t.grabProt = isPvp(e, t) ? PVP.grabProt : 0.3; }
    fgHitT(e, t, { dmg: P * 0.33, spike: 760, down: true, bounce: 0.25, knock: 30, hs: 0.1, big: 1.8, shake: 4, throwHit: true, col: '#d8b8ff' }, m); }
}
function fgSlamLand(e, a) {
  const P = a.P, m = a.dmgMul || 1, x = a.axeX ?? e.x + e.face * 40; a.fgFinDone = true;
  for (const t of a.axed || []) if (!t.dead && Math.abs(t.x - x) < 100) fgHitT(e, t, { dmg: P * 0.22, spike: 500, otgLift: 60, knock: 20, hs: 0.06, big: 1.4 }, m);   // 落地伤害（还在空中的继续往下砸）
  fgWave(e, x, e.y, 150, { dmg: P * 0.26, launch: 260 }, { mul: m, col: '#d8b8ff', rocks: 6, shake: 6 });
}
defSkill('fg_slamkick', { name: '浮空凌云踢', cls: 'fighter', job: GJ, lvReq: 19, mp: 45, cd: 15, type: 'phys', grab: true, col: '#a06ae0',
  desc: '上踢把敌人挑到空中，自己跳上去一记下劈把他砸向地面，落地再受一次伤害并产生冲击波。跳到最高点时按方向键改变终结：↑ 把敌人踢向前方、← 踢向身后、↓ 抓住一起砸进地面（砸地后可以取消接霹雳旋踢）。抓不住的敌人改成抓轰炮。不按方向时，施放中可以预约一字传承·极义震天破。',
  pow: lv => skillDmg(6.5, 0.65, lv), ai: { kind: 'launch', r: [0, 100], dy: 30 },
  act: (lv, p) => {
    const P = skillDmg(6.5, 0.65, lv);
    return fgSlide(fgAct({ name: 'fg_slamkick', clip: 'fgHigh', dur: 0.6, noCounter: true, P,
      hits: [fgGrabHB(0.06, 0.18, [0, 104, 38, 0, 125], P * 0.185, P * 0.815)],
      events: [evAt(0.05, e => { fxSlash({ x: e.x, y: e.y, z: e.z, face: e.face, col: '#e0d0ff', a0: 1.5, a1: -1.7, r: 74, w: 18, off: [16, 50], heavy: true }); sfx.swing(true); })],
      onGrab: e => { const a = e.act; if (a.gT !== undefined) return; a.gT = e.actT; a.dur = 3; e.vz = 560; e.z = 1; e.vx = e.face * 40; fxBurst(e.x + e.face * 40, e.y, 60, 120, '#d8b8ff'); },
      hold: (e, t, i) => { const a = e.act; if (a.mode === 'd') { fgHoldAt(e, t, i, 22, e.z - 10); return; } fgHoldAt(e, t, i, 34, e.z + 40 + Math.min(40, (e.actT - (a.gT || 0)) * 160)); },
      update: e => { const a = e.act; if (a.gT === undefined || a.mode) return;
        if (e.vz < 60 || e.actT - a.gT > 0.36) {   // 最高点：看方向键
          const d = fgDir(e), G = grabsOf(e).slice(); a.mode = d === 'u' || d === 'b' || d === 'd' ? d : 'n'; e.play('fgAxe', true); sfx.swing(true);
          fxSlash({ x: e.x, y: e.y, z: e.z, face: e.face, col: '#e0d0ff', a0: -1.6, a1: 1.3, r: 80, w: 22, off: [18, 60], heavy: true });
          if (a.mode === 'd') { e.vz = -950; a.fgFinDone = true; return; }
          if (a.mode === 'u' || a.mode === 'b') { a.fgFinDone = true; const dir = a.mode === 'b' ? -e.face : e.face, m = fgMul(e);
            for (const t of G) { applyHit(e, t, { dmg: P * 0.55, sure: true, noCounterBonus: true, hs: 0.1, big: 1.6, snd: 'blunt', col: '#d8b8ff' }); throwArc(e, t, { dx: 260, dir, h: 30, dur: 0.4, other: { dmg: P * 0.15 * m, down: true }, hit: { dmg: P * 0.26 * m, spike: 300 } }); }
            e.vz = -500; return; }
          fgSlamAxe(e, a, G); e.vz = -900;
        } },
      onLand: e => { const a = e.act; if (a.gT === undefined) return; e.vx = 0; a.onLand = null;
        if (a.mode === 'd') { fgSlamAxe(e, a, grabsOf(e).slice()); fgSlamLand(e, a); e.play('fgSlam', true); a.links = ['fg_snapshot']; a.linkFrom = 0; }
        else { if (a.mode === 'n') fgSlamLand(e, a); fxDust(e.x, e.y, 5, 16); e.play('fgStomp', true); }
        a.dur = e.actT + 0.36; },
      fgFin: (e, G, a) => { if (!a.axed) fgSlamAxe(e, a, G); fgSlamLand(e, a); } }), p);
  } });

/* ================= 疾波猛坠（Lv19） ================= */
function fgMagnumStomp(e, a, n0 = 0) {   // 踏地 + 冲击波多段（6 段）
  const P = a.P, m = a.dmgMul || 1, x = e.x + e.face * 30, y = e.y;
  fgHitsFront(e, { dmg: P * 0.63, launch: 320, knock: 60, hs: 0.1, big: 1.6, shake: 5, col: '#9fd8ff' }, m, [-40, 100, 42, 0, 90]);
  fxSpr('pillar', x, y, 0, { h: 150, dur: 0.35, ay: 1, col: '#9fd8ff', grow: [0.4, 1] }); fgRocks(x, y, 6, 110);
  for (let i = n0; i < 6; i++) game.after((i - n0) * 0.07, () => { if (e.dead) return; fxShock(x, y, 110 + i * 18, '#9fd8ff'); blast(e, x, y, (130 + i * 10) * fgWaveK(e), { dmg: P * 0.062 * m, airLift: 120, stun: 0.3, knock: 30, hs: 0.02, snd: 'blunt', col: '#9fd8ff', downHit: true }, { zMax: 90 }); });
  cam.shake = Math.max(cam.shake, 6); sfx.boom(0.8);
}
function fgHitsFront(e, h, m, box) { const B = atkBox(e, { box }); for (const t of ents) if (canHit(e, t, { downHit: true }) && overlaps(B, t)) fgHitT(e, t, h, m); }
defSkill('fg_magnum', { name: '疾波猛坠', cls: 'fighter', job: GJ, lvReq: 19, mp: 50, cd: 15, type: 'phys', air: true, col: '#5ab0e0',
  desc: '后空翻向前跃起，脚上聚气猛踏地面，产生 6 段冲击波。按住 → 跃得更远；跳跃中施放则急速下坠直接踏地。踏地后的收招可以取消接柔道家的抓取技能。施放中可以预约一字传承·极义震天破。',
  pow: lv => skillDmg(6.5, 0.65, lv), ai: { kind: 'gap', r: [40, 220], dy: 30 },
  act: (lv, p) => {
    const P = skillDmg(6.5, 0.65, lv), air = p.st === 'jump' || p.z > 2;
    return fgAct({ name: 'fg_magnum', clip: air ? 'fgDive' : 'fgFlip', dur: 2, noCounter: true, P,
      onStart: e => { if (air) { e.vz = -1100; e.vx = e.face * 80; return; } const far = e.pad && e.pad.dx() === e.face; e.vz = 520; e.z = 1; e.vx = e.face * (far ? 420 : 240); sfx.jump(); fxDust(e.x, e.y, 4, 12); },
      update: e => { const a = e.act; if (!air && !a.dive && e.actT > 0.3) { a.dive = true; e.vz = -1000; e.play('fgDive', true); } if (Math.random() < 0.5) fxSpr('spark', e.x, e.y, e.z + 8, { w: 26, dur: 0.15, col: '#9fd8ff' }); },
      onLand: e => { const a = e.act; if (e.actT < 0.05 && !air) { e.vz = 0; return; } a.onLand = null; e.vx = 0; e.play('fgStomp', true); a.fgFinDone = true; fgMagnumStomp(e, a); a.dur = e.actT + 0.5; a.links = FG_GRAB_IDS; a.linkFrom = e.actT + 0.12; },
      fgFin: (e, G, a) => fgMagnumStomp(e, a) });
  } });

/* ================= 地狱风火轮（Lv19） ================= */
function fgRollFx(t, dur) {   // 滚着飞出去的敌人身上的火轮
  const img = fgTint('vortex', FG_COL.fire);
  addFx({ ent: t, y: t.y + 1, dur, draw(c) { const e = this.ent, k = this.t / this.dur; if (!e.thrown && k > 0.1) { this.t = this.dur; return; } drawSpr(c, img, sx(e.x), sy(e.y, e.z + 30), 90, 90, { rot: -game.t * 18 * (e.thrown ? e.thrown.dir : 1), alpha: 0.85 }); } });
}
defSkill('fg_rolling', { name: '地狱风火轮', cls: 'fighter', job: GJ, lvReq: 19, mp: 60, cd: 25, type: 'phys', grab: true, col: '#e06a2a', pre: { fg_slamkick: 1 },
  desc: '抓住敌人回身摔在地上（摔地出冲击波），趁他弹起一记回旋踢，让他裹着火轮滚着飞出去，一路撞倒路上的敌人，落地再出冲击波。回旋踢前按方向键调飞行距离：↑ / → 最远、不按 中等、↓ 最近。能抓霸体、格挡中的敌人；抓不住的改成抓轰炮。暴力抓取时把周围的敌人一起卷过来。',
  pow: lv => skillDmg(8.0, 0.8, lv), ai: { kind: 'grab', r: [0, 105], dy: 30 },
  act: (lv, p) => {
    const P = skillDmg(8.0, 0.8, lv), og = fgOG(p);
    return fgSlide(fgAct({ name: 'fg_rolling', clip: 'fgGrab', dur: 0.7, noCounter: true, superArmor: og ? [0, 0.4] : undefined,
      hits: [fgGrabHB(0.05, 0.2, [0, 106, 38, 0, 120], P * 0.05, P * 0.95, og ? { grabRange: FG_OG_RANGE } : {})],
      onGrab: e => { const a = e.act; if (a.gT !== undefined) return; a.gT = e.actT; a.dur = e.actT + 1.05; e.play('fgLift', true); },
      hold: (e, t, i) => { const a = e.act, k = e.actT - (a.gT || 0);
        if (k < 0.26) { const th = clamp(k / 0.26, 0, 1) * Math.PI; t.x = e.x + e.face * (36 + i * 8) * Math.cos(th); t.z = Math.max(0, e.z + 20 + 60 * Math.sin(th)); t.rot = e.face * th * 0.8; }
        else { t.x = e.x + e.face * (40 + i * 8); t.z = Math.max(0, 50 * Math.sin(clamp((k - 0.26) / 0.24, 0, 1) * Math.PI * 0.6)); t.rot = 0; }
        t.y = clamp(e.y + (i % 2 ? 7 : -7) * Math.ceil(i / 2) + 0.5, 4, DEPTH - 4); t.face = -e.face; },
      update: e => { const a = e.act; if (a.gT === undefined) return; const k = e.actT - a.gT;
        if (k >= 0.26 && !a.slam) { a.slam = true; e.face = -e.face; e.play('fgSlam', true);   // 回身摔：摔到身后，人跟着转过来
          for (const t of grabsOf(e)) applyHit(e, t, { dmg: P * 0.24, sure: true, noCounterBonus: true, hs: 0.08, big: 1.5, shake: 4, snd: 'blunt' });
          fgWave(e, e.x + e.face * 40, e.y, 120, { dmg: P * 0.14, launch: 200 }, { rocks: 4 }); }
        if (k >= 0.5 && !a.kick) { a.kick = true; e.play('fgSpin', true); sfx.swing(true);
          const d = fgDir(e), dx = d === 'u' || d === 'f' ? 440 : d === 'd' ? 180 : 310, m = fgMul(e);
          fgSpr('vortex', e.x + e.face * 30, e.y, e.z + 50, { w: 140, dur: 0.3, col: FG_COL.fire, spin: -16 });
          for (const t of grabsOf(e).slice()) {
            applyHit(e, t, { dmg: P * 0.39, sure: true, noCounterBonus: true, hs: 0.1, big: 1.7, shake: 4, snd: 'blunt', col: FG_COL.fire });
            throwArc(e, t, { dx, h: 34, dur: 0.3 + dx / 1400, other: { dmg: P * 0.18 * m, down: true, knock: 200, col: FG_COL.fire },
              hit: { dmg: 0.01, spike: 200 }, onLand: (a2, u) => fgWave(e, u.x, u.y, 130, { dmg: P * 0.22, launch: 260 }, { mul: m, col: FG_COL.fire, rocks: 5, bcol: FG_COL.fire }) });
            fgRollFx(t, 1.2);
          } } } }), p);
  } });

/* ================= 裂石破天（Lv20，空中 ←→+C） ================= */
defSkill('fg_cannonspike', { name: '裂石破天', cls: 'fighter', job: GJ, lvReq: 20, mp: 75, cd: 40, type: 'phys', grab: true, air: true, airOnly: true, col: '#e0702a',
  pre: { fg_airsteiner: 1, fg_rolling: 1 },
  desc: '只能在空中使用（跳跃中 ←→+C）：急速下坠踢击，抓住碰到的第一个敌人，一起狠狠砸进地面，砸地产生冲击波。下坠中按方向键调角度（← 更陡，→ 更平）。不可抓取的敌人受到更高的踢击伤害（不抓人）。施放中可以预约一字传承·极义震天破。',
  pow: lv => skillDmg(9.5, 0.95, lv), ai: { kind: 'air', r: [0, 200], dy: 34 },
  act: (lv, p) => {
    const P = skillDmg(9.5, 0.95, lv);
    const land = (e, a) => { a.fgFinDone = true; const G = grabsOf(e).slice(), m = a.dmgMul || 1, x = G.length ? G[0].x : e.x + e.face * 30;
      e.play('fgStomp', true);
      for (const t of G) throwGrab(e, { dmg: P * 0.66, spike: 600, down: true, bounce: 0.35, knock: 30, hs: 0.12, big: 2, shake: 8, snd: 'blunt', col: FG_COL.fire });
      if (a.miss) fgHitT(e, a.miss, { dmg: P * 0.93, throwHit: true, knock: 120, stun: 0.6, hs: 0.1, big: 1.8, col: FG_COL.fire }, m);
      fxSpr('flame', x, e.y, 10, { w: 220, dur: 0.5, col: FG_COL.fire, grow: [0.5, 1.2] });
      fgWave(e, x, e.y, 150, { dmg: P * 0.32, launch: 320 }, { mul: m, col: FG_COL.fire, bcol: FG_COL.fire, rocks: 8, shake: 8, boom: 0.9 }); };
    return fgAct({ name: 'fg_cannonspike', clip: 'fgDive', dur: 2.5, noCounter: true, airOnly: true, P,
      onStart: e => { e.vz = -780; e.vx = e.face * 300; fxStreak({ x: e.x, y: e.y, z: e.z + 40, face: e.face, len: 100, w: 14, col: FG_COL.fire, dur: 0.2 }); sfx.swing(true); },
      update: e => { const a = e.act; if (a.gT === undefined) { const d = fgDir(e); e.vx = e.face * (d === 'b' ? 120 : d === 'f' ? 440 : 300); }
        if (Math.random() < 0.7) fxSpr('flame', e.x - e.face * 10, e.y, e.z + 20, { w: 40, dur: 0.18, col: FG_COL.fire, rot: e.face * 0.8 }); },
      hits: [fgGrabHB(0, 2.4, [-10, 60, 38, -40, 60], P * 0.02, null, { onGrabFail: (a, t) => { const A = a.act; if (A && !A.miss && !a.grabbed) A.miss = t; } })],
      onGrab: e => { const a = e.act; if (a.gT === undefined) { a.gT = e.actT; a.miss = null; } },
      hold: (e, t, i) => { fgHoldAt(e, t, i, 20, e.z - 20); t.rot = Math.PI * 0.5 * -e.face; },
      onLand: e => { const a = e.act; e.vx = 0; a.onLand = null; land(e, a); a.dur = e.actT + 0.45; a.airOnly = false; },
      fgFin: (e, G, a) => { for (const t of G) if (!t.dead) fgHitT(e, t, { dmg: P * 0.66, spike: 600, down: true, throwHit: true, hs: 0.1, big: 2 }, a.dmgMul || 1);
        fgWave(e, e.x + e.face * 20, e.y, 150, { dmg: P * 0.32, launch: 320 }, { mul: a.dmgMul || 1, col: FG_COL.fire, bcol: FG_COL.fire, rocks: 8 }); } });
  } });

/* ================= 膝击 / 金刚碎：柔道家版本（基础技能在 fighter.js，B3；这里包一层，只对柔道家生效） ================= */
// 膝击（柔道家）：多撞一下（共 3 下）；最后一下按 ↑ = 把敌人挑起并一起跳起（算跳跃状态，可接空绞锤 / 无情摔击 / 裂石破天 / 二觉），按 ↓ = 摔在地上出冲击波；
// 抓不住 → 抓轰炮；暴力抓取 → 范围抓；冲刺中 → 滑行抓取
function fgKneeAct(lv, p) {
  const S = SKILLS.f_knee, P = (S && S.pow ? S.pow(lv) : skillDmg(1.8, 0.18, lv)) * 1.25, og = fgOG(p);
  return fgSlide(fgAct({ name: 'f_knee', clip: 'fgGrab', dur: 0.62, noCounter: true, superArmor: og ? [0, 0.4] : undefined,
    hits: [fgGrabHB(0.04, 0.16, [0, 96, 38, 0, 120], P * 0.06, P * 0.94, og ? { grabRange: FG_OG_RANGE } : {})],
    onGrab: e => { const a = e.act; if (a.gT === undefined) { a.gT = e.actT; a.dur = e.actT + 0.8; } },
    hold: (e, t, i) => { const a = e.act; fgHoldAt(e, t, i, 30, e.z + 10 + (a.kn || 0) * 8); },
    update: e => { const a = e.act; if (a.gT === undefined) return; const k = e.actT - a.gT;
      for (let n = 0; n < 3; n++) if (k >= 0.1 + n * 0.14 && (a.kn || 0) <= n) { a.kn = n + 1; e.play('fgKnee', true); sfx.hit('blunt', false);
        for (const t of grabsOf(e)) { applyHit(e, t, { dmg: P * 0.16, sure: true, noCounterBonus: true, hs: 0.06, big: 1.2, snd: 'blunt' }); fxHit(t.x, t.y, t.z + 40, e.face, { col: FG_COL.hit, big: 1.2 }); } }
      if (k >= 0.52 && !a.fin) { a.fin = true; const d = fgDir(e), G = grabsOf(e).slice();
        if (d === 'u') { for (const t of G) throwGrab(e, { dmg: P * 0.3, launch: 620, knock: 20, hs: 0.08, big: 1.5 }); e.vz = 560; e.z = 1; e.vx = e.face * 40; a.dur = e.actT + 0.1; sfx.jump(); return; }
        if (d === 'd') { e.play('fgSlam', true); for (const t of G) throwGrab(e, { dmg: P * 0.3, spike: 480, down: true, bounce: 0.3, hs: 0.1, big: 1.6, shake: 5 }); fgWave(e, e.x + e.face * 30, e.y, 110, { dmg: P * 0.16, launch: 200 }, { rocks: 4 }); a.dur = e.actT + 0.3; return; }
        e.play('fgHigh', true); for (const t of G) throwGrab(e, { dmg: P * 0.36, launch: 480, knock: 60, hs: 0.1, big: 1.5 }); a.dur = e.actT + 0.3; } } }), p);
}
// 金刚碎（柔道家）：收招可以取消接霹雳旋踢（官方：柔道家改成肘击砸地，对倒地敌人伤害更高——动作 / 倍率归基础技能，这里只加取消）
function fgWrapBase() {
  const K = SKILLS.f_knee; if (K && K.act && !K.fgWrapped) { const a0 = K.act; K.fgWrapped = true; K.act = (lv, p) => p && fgIs(p) ? fgKneeAct(lv, p) : a0(lv, p); }
  const Sm = SKILLS.f_seismic; if (Sm && Sm.act && !Sm.fgWrapped) { const a0 = Sm.act; Sm.fgWrapped = true;
    Sm.act = (lv, p) => { const A = a0(lv, p); if (A && p && fgIs(p)) { A.links = [...(A.links || []), 'fg_snapshot']; A.linkFrom = A.linkFrom ?? (A.dur || 0.6) * 0.45; } return A; }; }
}
fgWrapBase();

/* ================= 钩子：施放 / 命中 / 被动 ================= */
// 抓取类技能和普攻的倍率：暴力抓取 +(10+lv)%、力之奥义 +(4+lv)%（p1）
const fgGrabMul = p => (fgOG(p) ? 1.1 + 0.01 * ((p.buffs.fg_overgrab && p.buffs.fg_overgrab.lv) || skLv(p, 'fg_overgrab')) : 1) * (hasSkill(p, 'fg_counter') ? 1.04 + 0.01 * skLv(p, 'fg_counter') : 1);
FIGHTER_HOOKS.onCast.push((p, id, act, how) => {
  if (!fgIs(p)) { p._fgResv = null; return; }
  const S = SKILLS[id];
  if (S && S.job === GJ && !S.awaken && hasSkill(p, 'fg_gauntlet') && p.cool[id] > 0 && how !== 'recast') p.cool[id] *= 0.9;   // 臂铠精通：转职技能冷却 -10%
  if (act && act === p.act && how !== 'recast') {
    if (S && (S.grab || id === 'f_knee')) act.dmgMul = (act.dmgMul || 1) * fgGrabMul(p);
    if (p._fgChain === game.t && FG_CHAIN.includes(id)) { act.dmgMul = (act.dmgMul || 1) * (1.08 + 0.008 * skLv(p, 'fg_combo')); fxText('连环抓取', p.x, p.y, p.z + 30, { col: '#ffd070', size: 11, dur: 0.6 }); }
    const R = p._fgResv;   // 二觉 / 三觉预约：先把被打断的技能剩下的终结打完
    if (R && R.t === game.t && (id === 'fg_awaken2' || id === 'fg_awaken3')) { R.a.fgFinDone = true; R.fn(p, R.G.filter(t => !t.dead && !t.remove), R.a); act.fgResv = true; fxText('预约', p.x, p.y, p.z + 40, { col: '#ffe070', size: 12, dur: 0.7 }); }
  }
  p._fgResv = null; p._fgChain = null;
});
// 臂铠精通：装备臂铠时 MP -20%（接在职业的 MP 修正后面）
{ const mp0 = CLASSES.fighter.mpMul; CLASSES.fighter.mpMul = (p, id) => (mp0 ? mp0(p, id) : 1) * (fgIs(p) && wtypeOf(p) === 'gauntlet' && hasSkill(p, 'fg_gauntlet') ? 0.8 : 1); }
// 彗星冲击没打中时可以取消接旋风腿（官方）
FIGHTER_HOOKS.cancelHook.push((p, a, id) => fgIs(p) && a.name === 'fg_pierce' && id === 'f_tornado' && !p.hitsDone.size);
// 普攻：暴力抓取 / 力之奥义的倍率（按武器 + 倍率缓存动作表）
const FG_ACTS_CACHE = new Map();
FIGHTER_ACT_PICK.push(p => {
  if (!fgIs(p)) return null;
  const m = Math.round(fgGrabMul(p) * 100) / 100; if (m === 1) return null;
  const w = wtypeOf(p) || 'knuckle', key = w + '|' + m; let A = FG_ACTS_CACHE.get(key);
  if (!A) { const B = (typeof FIGHTER_ACTS_BY_W !== 'undefined' && FIGHTER_ACTS_BY_W[w]) || CLASSES.fighter.acts; A = {}; for (const k in B) A[k] = B[k] && B[k].basic ? { ...B[k], dmgMul: m } : B[k]; FG_ACTS_CACHE.set(key, A); }
  return A;
});
// 被动：摔技强化 / 轻甲专精 / 连环抓取（p1 里再加 力之奥义 / 傲天之怒 / 神怡气静）
CLASSES.fighter.passives.push(p => {
  const on = fgIs(p);
  const tl = on ? skLv(p, 'fg_takedown') : 0; setPassive(p, 'fg_takedown', tl > 0, { dmg: 0.02 + 0.01 * tl });
  const ll = on ? skLv(p, 'fg_light') : 0;
  const nL = ll > 0 ? (p.kit ? 5 : typeof inv !== 'undefined' && inv.equip ? Object.values(inv.equip).filter(it => it && it.atype === 'light').length : 0) : 0;
  setPassive(p, 'fg_light', nL > 0, { atk: (0.004 + 0.001 * ll) * nL, aspd: (0.002 + 0.0005 * ll) * nL });
  const cl = on ? skLv(p, 'fg_combo') : 0; setPassive(p, 'fg_combo', cl > 0, { critDmg: 0.05 + 0.01 * cl });
  if (!on && p.buffs.fg_overgrab) delete p.buffs.fg_overgrab;
  if (on && p.buffs.fg_overgrab && Math.random() < 0.3) fxSpr('spark', p.x + rnd(-14, 14), p.y + 1, p.z + rnd(40, 80), { w: 16, dur: 0.15, col: '#8ac8ff' });
});

/* ================= 转职登记 ================= */
CLASSES.fighter.jobs.grappler = { art: 'job/grappler', name: '柔道家', role: '近战 · 抓取 / 投技（物理）', armor: 'light', growth: { str: 1.1, vit: 1.06 },
  awaken: 'fg_awaken', awakenName: '风林火山', awakenName2: '宗师', awakenName3: '归元·柔道家', ready: false,
  desc: '把抓取练到极致的格斗家。几乎所有技能都是抓取，抓住时自己无敌；抓不动的敌人自动改成抓轰炮，冲击波加上无视霸体的强制硬直。暴力抓取把周围的敌人一起卷过来，冲刺中能滑行抓取，野蛮冲撞 / 彗星冲击命中后连环抓取。',
  auto: ['fg_grabcannon', 'fg_gauntlet'],
  skills: ['fg_grabcannon', 'fg_takedown', 'fg_overgrab', 'fg_slide', 'fg_light', 'fg_gauntlet', 'fg_combo', 'fg_fling', 'fg_tackle', 'fg_breakdown', 'fg_necksnap',
    'fg_snapshot', 'fg_airsteiner', 'fg_slamkick', 'fg_magnum', 'fg_rolling', 'fg_cannonspike'],
  anims: FG_ANIMS };
CLASSES.fighter.cmds.push(['uu', 'fg_overgrab', 'buff'], ['uf', 'fg_fling'], ['bdf', 'fg_tackle'], ['uuf', 'fg_breakdown'], ['ff', 'fg_necksnap'], ['fd', 'fg_snapshot'],
  ['', 'fg_airsteiner', 'jump'], ['fdf', 'fg_slamkick'], ['du', 'fg_magnum'], ['bff', 'fg_rolling'], ['bf', 'fg_cannonspike', 'jump']);
