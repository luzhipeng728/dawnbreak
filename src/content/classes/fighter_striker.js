/* =====================================================================
   格斗家转职：散打（男，striker）—— B5（官方现版：docs/SKILLS_OFFICIAL_fighter.md 第 5 节；逐技能对照 docs/skills/fighter_striker_final.md）
   手感核心：
   - 柔化肌肉：「武术」技能（上踢 / 前踢 / 下段踢 / 鹰踏·强袭拳 / 疾风追击 / 旋风腿 + 散打的踢拳技）之间可以强制中断，次数有限、定时恢复（5+n 次，每 3.6−0.35n 秒 1 次）；
     转职技能攻击力常驻提高（2023 起官方改成常驻，不再是“柔化出来的那一招才增伤”）；柔化放出的技能打中时霸体护甲 +2 秒（最多 60 秒）
   - 霸体护甲 60 秒霸体 BUFF；强拳 永久暴击伤害 + 硬直
   - 一觉 烈焰焚步 = 变身型 BUFF（双脚缠火、武术技能冷却 −15%、后摇减少、技能攻击 / 硬直提高、柔化恢复快 1 秒、走过的地面着火）；
     焚步中 双重施放：下一次 瞬影连环踢 / 烈火强拳 / 炼狱坠星腿 追加一段同等威力的攻击
   - 拳套只有散打能装（WTYPES.boxing.jobs，B0）；拳套掌握：散打技能冷却每级 −1%（觉醒 / 双重施放除外）
   觉醒：一觉 武极（烈焰焚步）→ 二觉 极武皇（极武霸皇踢）→ 三觉 归元·散打（焚火逐日拳）
   基础技能（f_*，B3 的 fighter.js）：强袭拳改鹰踏、闪步改瞬步用 S.morph 包一层（fsMorph），不改基础技能本身；基础技能还没定义时跳过
   动作：矢量占位模型用下面的 CLIPS.fighter.fs*；出精灵帧后 J.anims 先找 fs_ 帧、再退回 B0 的 f_ 帧 / 通用帧
   ===================================================================== */
const FS = 'striker';
const fsOn = p => jobOf(p) === FS;
// 可以用柔化肌肉互相中断的技能（官方 머슬 시프트 캔슬 목록 + 闪击快打；学了闪步后瞬步也算）
const FS_MA = new Set(['f_highkick', 'f_hammer', 'f_lowkick', 'f_airwalk', 'fs_raidp', 'f_chain', 'f_tornado', 'fs_elbow', 'fs_pusher', 'fs_bone', 'fs_flamekick', 'fs_close',
  'fs_dance', 'fs_dragon', 'fs_spin', 'fs_whirl', 'fs_descent', 'fs_cannon', 'fs_awaken2', 'fs_mortal', 'fs_rush']);
const fsMA = (p, id) => FS_MA.has(id) || ((id === 'f_flash' || id === 'fs_stepp') && skLv(p, 'fs_step') > 0);
// 拳套掌握 / 焚步冷却缩减不算的技能（官方：화염의 각、이중개방、패황연격、멸화파천격）
const FS_NOCDR = new Set(['fs_awaken', 'fs_dual', 'fs_awaken2', 'fs_awaken3']);
const FS_FIRE = '#ff7a2a';
// 帧：有精灵帧时先用 fs_ 帧，没有就退回 B0 的 f_ 帧，再退回通用帧（SPR_DATA 是构建时生成的，这里能读）
const fsTl = (tl, fb) => typeof SPR_DATA !== 'undefined' && SPR_DATA.fighter && SPR_DATA.fighter.frames && SPR_DATA.fighter.frames[tl[0][0]] ? tl : fb;

/* ---- 矢量占位模型的骨骼片段（精灵帧到位前用） ---- */
POSE.fsElbow = P(POSE.dashS, { uaF: 95, faF: 150, wF: -60, uaB: -50, faB: 80 });
POSE.fsPunch = P(POSE.dashS, { uaF: 88, faF: 0, wF: -90, uaB: -40, faB: 100 });
POSE.fsPunchW = P(POSE.idle, { torso: 12, head: -6, uaF: -30, faF: 110, uaB: 30, faB: 90, thF: 40, shF: -50, thB: -30, shB: -30 });
POSE.fsFly = P(POSE.jumpUp, { torso: 50, head: -30, thF: 95, shF: 0, ftF: 0, thB: -10, shB: -60, uaF: -20, faF: 60, uaB: -60, faB: 40 });
POSE.fsKnee = P(POSE.idle, { torso: -10, head: 8, thF: 120, shF: -120, ftF: 20, uaF: 70, faF: 90, uaB: -20, faB: 80 });
POSE.fsDive = P(POSE.jumpFall, { torso: 30, head: -14, uaF: 60, faF: 0, wF: -90, uaB: -60, faB: 40, thF: 20, shF: -40, thB: -30, shB: -70 });
Object.assign(CLIPS.fighter, {
  fsElbow: { dur: 0.42, keys: [k(0, POSE.fJabW, 'hold'), k(0.04, POSE.fsElbow, 'out'), k(0.3, POSE.fsElbow), k(0.42, POSE.idle)] },
  fsPush: { dur: 0.5, keys: [k(0, POSE.fShoulder, 'hold'), k(0.32, POSE.fShoulder), k(0.5, POSE.idle)] },
  fsLow: { dur: 0.5, keys: [k(0, POSE.kickW, 'hold'), k(0.1, POSE.fLowKick, 'out'), k(0.32, POSE.fLowKick), k(0.5, POSE.idle)] },
  fsMid: { dur: 0.7, keys: [k(0, POSE.fsKnee, 'hold'), k(0.18, POSE.kickSide, 'out'), k(0.45, POSE.kickSide), k(0.7, POSE.idle)] },
  fsPunch: { dur: 0.45, keys: [k(0, POSE.fsPunchW, 'hold'), k(0.06, POSE.fsPunch, 'out'), k(0.32, POSE.fsPunch), k(0.45, POSE.idle)] },
  fsCharge: { dur: 0.3, keys: [k(0, POSE.fsPunchW)] },
  fsFly: { dur: 0.7, keys: [k(0, POSE.jumpUp, 'hold'), k(0.12, POSE.fsFly, 'out'), k(0.7, POSE.fsFly)] },
  fsSpin: { dur: 0.2, loop: true, keys: [k(0, POSE.kickSide), k(0.1, POSE.fLowKick)] },
  fsUp: { dur: 0.4, keys: [k(0, POSE.kickW, 'hold'), k(0.06, POSE.kickUp, 'out'), k(0.4, POSE.kickUp)] },
  fsStomp: { dur: 0.5, keys: [k(0, POSE.fAxeUp, 'hold'), k(0.2, POSE.fAxeDown, 'out'), k(0.5, POSE.fAxeDown)] },
  fsDive: { dur: 0.3, keys: [k(0, POSE.fsDive)] },
  fsBuff: { dur: 0.7, keys: [k(0, POSE.crouch, 'hold'), k(0.18, POSE.roar, 'out'), k(0.7, POSE.roar)] },
});
const FS_ANIMS = {
  fsElbow: fsTl([['fs_elbow', 0]], fsTl([['f_shoulder1', 0], ['f_shoulder2', 0.05]], [['run3', 0]])),
  fsPush: fsTl([['f_shoulder1', 0], ['f_shoulder2', 0.05]], [['run3', 0]]),
  fsLow: fsTl([['f_low1', 0], ['f_low2', 0.1]], [['idle', 0]]),
  fsMid: fsTl([['fs_kneekick', 0], ['f_mid2', 0.18]], fsTl([['f_mid1', 0], ['f_mid2', 0.18]], [['idle', 0]])),
  fsPunch: fsTl([['fs_dashpunch', 0]], fsTl([['f_jab1', 0], ['f_jab2', 0.06]], [['idle', 0]])),
  fsRush: fsTl([['fs_rush1', 0], ['fs_rush2', 0.1]], fsTl([['f_jab1', 0], ['f_jab2', 0.1]], [['idle', 0]])),
  fsCharge: fsTl([['fs_cannon1', 0]], fsTl([['f_focus', 0]], [['charge', 0]])),
  fsFly: fsTl([['f_flykick', 0]], [['jump2', 0]]),
  fsSpin: fsTl([['f_spin1', 0]], null) ? { fps: 16, frames: ['f_spin1', 'f_spin2'] } : [['idle', 0]],
  fsUp: fsTl([['f_high1', 0], ['f_high2', 0.06]], [['idle', 0]]),
  fsStomp: fsTl([['f_axe1', 0], ['f_axe2', 0.2]], fsTl([['f_stomp', 0]], [['jump3', 0]])),
  fsDive: fsTl([['fs_divepunch', 0]], fsTl([['f_dive', 0]], [['jump3', 0]])),
  fsBuff: fsTl([['f_focus', 0]], [['charge', 0]]),
};

/* ---- 小工具 ---- */
const fsPad = p => p.pad || { dx: () => 0, dy: () => 0, is: () => false, buffered: () => false, consume: () => {} };
const fsFwd = p => { const I = fsPad(p); return I.is(p.face > 0 ? 'right' : 'left'); };
const fsCanMove = t => !t.boss && !(hasSA(t) && t.st !== 'hit' && t.st !== 'air');
// 把敌人往 (x, y) 拉（领主 / 霸体不动）
function fsPull(t, x, y, k = 0.5) { if (!fsCanMove(t)) return; t.x = lerp(t.x, x, k); t.y = clamp(lerp(t.y, y, k), 4, DEPTH - 4); }
// 周围最强的敌人（领主 > 精英 > 最大生命）
function fsStrongest(e, r, ry = r * 0.5) {
  let best = null, bv = -1;
  for (const t of ents) if (hittable(e, t) && Math.abs(t.x - e.x) < r && Math.abs(t.y - e.y) < ry && t.z < 220) { const v = (t.boss ? 3 : t.elite ? 2 : 1) * 1e9 + (t.hpMax || t.hp || 0); if (v > bv) { bv = v; best = t; } }
  return best;
}
// 闪电一样的折线（肘击 / 闪电之舞的瞬移轨迹）
function fsBolt(x0, y0, z0, x1, y1, z1, col = '255,220,90', dur = 0.2) {
  const pts = []; for (let i = 0; i <= 7; i++) { const q = i / 7, m = i && i < 7; pts.push([lerp(x0, x1, q) + (m ? rnd(-12, 12) : 0), lerp(y0, y1, q), lerp(z0, z1, q) + (m ? rnd(-16, 16) : 0)]); }
  addFx({ x: (x0 + x1) / 2, y: Math.max(y0, y1) + 1, z: 0, dur, draw(c) { const a = 1 - this.t / this.dur; c.save(); c.globalCompositeOperation = 'lighter'; c.lineCap = 'round'; c.lineJoin = 'round';
    for (const [w, al] of [[8, 0.3], [2.6, 1]]) { c.strokeStyle = `rgba(${al < 1 ? col : '255,255,230'},${al * a})`; c.lineWidth = w; c.beginPath(); pts.forEach(([x, y, z], i) => i ? c.lineTo(sx(x), sy(y, z)) : c.moveTo(sx(x), sy(y, z))); c.stroke(); }
    c.restore(); } });
}
// 骨裂：冲击点上的白色裂纹
function fsCrack(x, y, z, s = 1) {
  const L = []; for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + rnd(-0.3, 0.3); L.push([a, rnd(14, 26) * s]); }
  addFx({ x, y: y + 2, z, dur: 0.3, draw(c) { const k = this.t / this.dur, X = sx(this.x), Y = sy(this.y, this.z); c.save(); c.strokeStyle = `rgba(255,255,255,${1 - k})`; c.lineWidth = 2.2;
    for (const [a, r] of L) { c.beginPath(); c.moveTo(X, Y); c.lineTo(X + Math.cos(a) * r * 0.55 + 3, Y + Math.sin(a) * r * 0.55); c.lineTo(X + Math.cos(a) * r, Y + Math.sin(a) * r); c.stroke(); } c.restore(); } });
}
// 火焰旋风（炽焰旋风腿 / 飞燕旋风）：身体周围一圈转动的火舌
function fsFlameRing(e, dur, col = FS_FIRE, r = 46) {
  return addFx({ ent: e, x: e.x, y: e.y + 0.6, z: 0, dur, update() { this.x = this.ent.x; this.y = this.ent.y + 0.6; }, draw(c) {
    const E = this.ent, k = this.t / this.dur, a = k < 0.1 ? k / 0.1 : k > 0.85 ? (1 - k) / 0.15 : 1; c.save(); c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 6; i++) { const ang = this.t * 16 + i / 6 * TAU, X = sx(E.x + Math.cos(ang) * r), Y = sy(E.y + Math.sin(ang) * r * 0.3, E.z + 20); c.globalAlpha = a * (0.55 + 0.45 * Math.sin(ang)); jlCell(c, 'jv_flame', col, i + Math.floor(this.t * 20), X, Y + 20, 46, 1.1); }
    c.restore(); } });
}
// 地面一小团火（焚步走过的地面 / 火焰落点）
function fsGroundFire(x, y, dur = 0.8, h = 30) {
  addFx({ x, y: y + 0.2, z: 0, dur, draw(c) { const k = this.t / this.dur, a = k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85; c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.8 * a;
    jlCell(c, 'jv_flame', FS_FIRE, Math.floor(this.t * 14) + Math.floor(this.x), sx(this.x), sy(this.y, 0) + 2, h * (0.6 + 0.4 * a), 1.2); c.restore(); } });
}
// 火焰爆炸（焚步发动 / 烈火强踢落地 / 双重施放追加段 / 三觉）
function fsBlastFx(x, y, z, size = 200) {
  fxSpr('explosion', x, y, z, { w: size, dur: 0.5, grow: [0.5, 1.15] }); fxShock(x, y, size * 0.9, FS_FIRE); fxDust(x, y, 8, size * 0.12, '#8a5a3a');
  for (let i = 0; i < 5; i++) fsGroundFire(x + rnd(-size * 0.4, size * 0.4), y + rnd(-20, 20), rnd(0.5, 0.9), rnd(26, 40));
}
// 双脚缠火（烈焰焚步变身）：跟着人画，BUFF 没了自己结束；换场景特效被清掉时 passives 里补回来
function fsFeetFx(p) {
  if (p._fsFeet && fxList.includes(p._fsFeet)) return;
  p._fsFeet = addFx({ ent: p, x: p.x, y: p.y + 0.4, z: 0, dur: 1e6, update() { const E = this.ent; this.x = E.x; this.y = E.y + 0.4; if (!E.buffs.fs_awaken || E.dead || E.remove) this.dur = this.t; },
    draw(c) { const E = this.ent, t = this.t; c.save(); c.globalCompositeOperation = 'lighter';
      for (const [dx, ph] of [[-9, 0], [10, 2]]) { const X = sx(E.x + dx * E.face), Y = sy(E.y, E.z) + 3; c.globalAlpha = 0.85; jlCell(c, 'jv_flame', FS_FIRE, Math.floor(t * 16) + ph, X, Y, 30 + Math.sin(t * 20 + ph) * 4, 1.05);
        c.globalAlpha = 0.5; jlCell(c, 'jv_flame', '#ffd23a', Math.floor(t * 16) + ph + 1, X, Y, 18, 0.9); }
      c.restore(); } });
}
// 拳上的红光（强拳持续中）
function fsFistFx(p) {
  if (p._fsFist && fxList.includes(p._fsFist)) return;
  p._fsFist = addFx({ ent: p, x: p.x, y: p.y + 0.5, z: 0, dur: 1e6, update() { const E = this.ent; this.x = E.x; this.y = E.y + 0.5; if (!E.buffs.fs_power || E.dead || E.remove) this.dur = this.t; },
    draw(c) { const E = this.ent; c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.35 + 0.15 * Math.sin(this.t * 8);
      drawSpr(c, fxTint('orb', '#ff3a3a'), sx(E.x + E.face * 16), sy(E.y, E.z + 58), 22, 0, { add: true }); drawSpr(c, fxTint('orb', '#ff3a3a'), sx(E.x - E.face * 6), sy(E.y, E.z + 56), 16, 0, { add: true }); c.restore(); } });
}

/* ---- 柔化肌肉：次数制强制中断 ---- */
const fsShiftMax = p => { const lv = skLv(p, 'fs_shift'); return lv ? 5 + lv + (skLv(p, 'fs_fire') ? 4 : 0) : 0; };
function fsShiftPer(p) {
  const lv = skLv(p, 'fs_shift'), f = skLv(p, 'fs_fire');
  return Math.max(0.5, 3.6 - 0.35 * lv - (f ? Math.min(3.2, 0.6 + 0.3 * f) : 0) - (p.buffs.fs_awaken ? 1 : 0));
}
function fsShiftOf(p) {
  const max = fsShiftMax(p), per = fsShiftPer(p), s = p._fsm || (p._fsm = { n: max, last: game.t });
  while (s.n < max && game.t - s.last >= per) { s.n++; s.last += per; }
  if (s.n >= max) { s.n = max; s.last = game.t; }
  return s;
}
FIGHTER_HOOKS.cancelHook.push((p, a, id) => {
  if (!fsOn(p) || !a.skill || !skLv(p, 'fs_shift')) return false;
  if (!fsMA(p, a.skill) || !fsMA(p, id)) return false;
  const A = SKILLS[a.skill], S = SKILLS[id]; if (!S || (A && A.awaken) || S.passive) return false;
  if (p.actT < 0.05 || a.fsNoShift) return false;                                              // 瞬影连环踢落地前、强袭拳刚落地
  if (a.fsLandT !== undefined && p.actT - a.fsLandT < 0.15 && id !== 'f_tornado' && id !== 'fs_descent') return false;   // 官方：强袭拳落地瞬间只有旋风腿 / 烈火强踢能接
  if (game.pvp && game.t - (p._fsDuelT ?? -99) < 10) return false;                             // 决斗场：开场 10 秒后才开始生效
  if (fsShiftOf(p).n < 1) return false;
  if (id === 'f_flash' || id === 'fs_stepp') p._fsFace = p.face;                               // 闪步：记下柔化前的朝向（按← 面朝前向后退）
  if (id === 'f_flash' || id === 'f_airwalk') p._fsMorphSoft = game.t;                         // 改形技能：castSkill 按改形后的 id 对不上柔化记录，由动作 onStart 自己结算（fsMorphCommit）
  return true;
});
// 柔化真的放出来了：扣 1 次；闪步不进冷却
function fsShiftCommit(p, id) {
  const s = fsShiftOf(p); if (s.n >= 1) { if (s.n >= fsShiftMax(p)) s.last = game.t; s.n--; }
  if (p.act) p.act.fsSoft = true;
  if (id === 'f_flash' || id === 'fs_stepp') { p.cool.f_flash = 0; p.cool.fs_stepp = 0; }
  fxText('柔化', p.x, p.y, p.z + 16, { col: '#8ae8ff', size: 10, dur: 0.45 });
}
FIGHTER_HOOKS.softCommit.push((p, a, id) => { if (fsOn(p) && skLv(p, 'fs_shift')) fsShiftCommit(p, id); });
const fsMorphCommit = (e, id) => { if (e._fsMorphSoft === game.t) { e._fsMorphSoft = null; fsShiftCommit(e, id); } };
// 柔化放出的技能打中时：霸体护甲 +2 秒（最多 60 秒；每个动作只加一次）
FIGHTER_HOOKS.onHit.push((p, t, h, dmg) => {
  const a = p.act; if (!fsOn(p) || !a || !a.fsSoft || a._fsSa || !p.buffs.fs_sa) return;
  a._fsSa = true; p.buffs.fs_sa.t = Math.min(game.pvp ? 8 : 60, p.buffs.fs_sa.t + 2);
});
// 冷却：拳套掌握（散打技能每级 −1%，觉醒除外）、焚步中武术技能 −15%；焚步中武术技能后摇减少
FIGHTER_HOOKS.onCast.push((p, id, act, how) => {
  if (!fsOn(p) || how === 'recast') return;
  const S = SKILLS[id]; if (!S || S.passive) return;
  let m = 1; const B = p.buffs.fs_awaken;
  if ((S.job === FS || fsMA(p, id)) && !FS_NOCDR.has(id)) m *= 1 - 0.01 * skLv(p, 'fs_glove');
  if (B && fsMA(p, id) && !FS_NOCDR.has(id)) m *= 0.85;
  if (m !== 1 && p.cool[id] > 0) p.cool[id] *= m;
  if (act && B && fsMA(p, id)) act.recMul = Math.min(act.recMul || 1, 1 - B.rec);
});
// 烈焰燃烧：焚步期间技能 MP 消耗减少（包在 B0 的臂铠 MP 修正外面）
{ const mp0 = CLASSES.fighter.mpMul; CLASSES.fighter.mpMul = (p, id) => (mp0 ? mp0(p, id) : 1) * (fsOn(p) && p.buffs.fs_awaken && skLv(p, 'fs_burn') ? 1 - Math.min(0.5, 0.1 + 0.03 * skLv(p, 'fs_burn')) : 1); }

/* ---- 双重施放：焚步中强化下一次 瞬影连环踢 / 烈火强拳 / 炼狱坠星腿 ---- */
// 施放目标技能时调用：返回 true = 这一招带双重施放；学了千锤百炼则打中才消耗（fsDualHit）
function fsDualTake(p, act) {
  if (!p.buffs.fs_dual) return false;
  act.fsDual = true; if (!skLv(p, 'fs_limit')) delete p.buffs.fs_dual;
  fxAura(p, FS_FIRE, 0.6); fxText('双重施放', p.x, p.y, p.z + 24, { col: '#ffb040', size: 12 });
  return true;
}
const fsDualHit = p => { delete p.buffs.fs_dual; };

/* ---- 基础技能在散打下的强化形态（强袭拳 / 闪步）：S.morph 包一层，基础技能还没定义时跳过 ---- */
function fsMorph(id, to) {
  const S = SKILLS[id]; if (!S || S._fsMorph) return;
  const m0 = S.morph; S._fsMorph = true;
  S.morph = p => (fsOn(p) && to(p)) || (m0 ? m0(p) : null);
}
function fsPatchBase() { fsMorph('f_airwalk', p => skLv(p, 'fs_raid') ? 'fs_raidp' : null); fsMorph('f_flash', p => skLv(p, 'fs_step') ? 'fs_stepp' : null); }
fsPatchBase();

/* ---- 被动 / BUFF（官方 15~20 级 → 本作 15~20 级）---- */
defSkill('fs_glove', { name: '拳套掌握', cls: 'fighter', job: FS, lvReq: 15, maxLv: 10, sp: 10, mp: 0, cd: 0, type: 'phys', passive: true, col: '#c8323c',
  desc: '【被动，转职时自动学会】能装备拳套（只有散打能装）。散打技能的冷却时间每级减少 1%（烈焰焚步、双重施放、极武霸皇踢、焚火逐日拳除外），和拳套本身的冷却 −10% 相乘。',
  infoExtra: lv => [['冷却减少', pct(0.01 * lv)]] });
defSkill('fs_light', { name: '散打轻甲专精', cls: 'fighter', job: FS, lvReq: 15, maxLv: 1, sp: 0, mp: 0, cd: 0, type: 'phys', passive: true, col: '#b8a078',
  desc: '【被动，转职时自动学会】穿轻甲时力量、攻击速度、移动速度提高，受击时更不容易被打僵（防具精通，按穿着的轻甲件数生效）。' });
defSkill('fs_power', { name: '强拳', cls: 'fighter', job: FS, lvReq: 15, maxLv: 20, mp: 20, cd: 5, type: 'phys', buff: true, col: '#d82a2a',
  desc: '【BUFF】把力量集中到双拳：暴击伤害提高，打中的敌人硬直时间变成 130%。永久持续（决斗场 10 秒），双拳发出红光。', ai: { kind: 'buff' },
  infoExtra: lv => [['暴击伤害', '+' + pct(0.03 + 0.02 * lv)], ['敌人硬直', '130%'], ['持续', '永久（决斗场 10 秒）']],
  act: lv => ({ name: 'fs_power', clip: 'fsBuff', dur: 0.5, noCounter: true,
    onStart: e => { e.buffs.fs_power = { t: game.pvp ? 10 : 1e6, critDmg: 0.03 + 0.02 * lv, stagger: 75, lv, col: '#d82a2a' }; sfx.buff(); fxAura(e, '#ff3a3a', 0.7); fsFistFx(e); } }) });
defSkill('fs_sa', { name: '霸体护甲', cls: 'fighter', job: FS, lvReq: 16, maxLv: 20, mp: 30, cd: 30, type: 'phys', buff: true, col: '#e0a82a', pre: { f_iron: 1 },
  desc: '【BUFF】60 秒内霸体（被打中照样掉血，但不会被打僵、打倒），物理 / 魔法防御和体力提高；施放动作本身就是霸体。用柔化肌肉施放的技能打中敌人时持续时间 +2 秒（最多 60 秒）。决斗场里持续 8 秒、移动速度 −10%。需要钢筋铁骨 Lv1。',
  ai: { kind: 'buff' }, infoExtra: lv => [['受到伤害', '−' + pct(0.05 + 0.005 * (lv - 1))], ['持续', '60 秒（决斗场 8 秒）'], ['柔化命中', '+2 秒']],
  act: lv => ({ name: 'fs_sa', clip: 'fsBuff', dur: 0.7, noCounter: true, superArmor: true,
    events: [evAt(0.2, e => { e.buffs.fs_sa = { t: game.pvp ? 8 : 60, taken: -(0.05 + 0.005 * (lv - 1)), mspd: game.pvp ? -0.1 : 0, lv, col: '#e0a82a' }; e.superArmor = Math.max(e.superArmor, 0.3); sfx.buff(); fxAura(e, '#ffd23a', 0.9); fxText('霸体', e.x, e.y, e.z + 20, { col: '#ffe070', size: 12 }); })] }) });
defSkill('fs_aim', { name: '弱点感知', cls: 'fighter', job: FS, lvReq: 18, sp: 15, mp: 0, cd: 0, type: 'phys', passive: true, col: '#c82a4a',
  desc: '【被动】看穿敌人的要害：物理暴击率提高（官方还提高命中率）。', infoExtra: lv => [['物理暴击率', '+' + pct(0.02 + 0.008 * lv)]] });
defSkill('fs_shift', { name: '柔化肌肉', cls: 'fighter', job: FS, lvReq: 18, maxLv: 5, sp: 15, mp: 0, cd: 0, type: 'phys', passive: true, col: '#3ab8d8', cmdNote: '武术技能中按另一个武术技能',
  desc: '【被动】让肌肉瞬间变得柔韧：武术技能（上踢、前踢、下段踢、鹰踏 / 强袭拳、疾风追击、旋风腿、肘击、铁山靠、碎骨、闪击快打、冲膝、炽焰旋风腿、闪电之舞、瞬影连环踢、飞燕旋风、旋风碎心踢、烈火强踢、烈火强拳、极武霸皇踢、炼狱坠星腿；学了闪步后还有瞬步）施放中可以强制中断、接另一个武术技能。中断次数有限，隔一段时间恢复 1 次（HUD 图标上的数字）；不能中断普攻和觉醒。转职技能攻击力常驻提高；柔化施放的技能打中时霸体护甲 +2 秒。决斗场开场 10 秒后才生效。',
  infoExtra: lv => [['柔化次数', String(5 + lv)], ['恢复 1 次', (3.6 - 0.35 * lv).toFixed(2) + ' 秒'], ['转职技能攻击力', '+' + pct(0.0625 + 0.0075 * lv)]] });
defSkill('fs_step', { name: '闪步', cls: 'fighter', job: FS, lvReq: 18, maxLv: 1, sp: 10, mp: 0, cd: 0, type: 'phys', passive: true, col: '#6ac8ff', pre: { f_flash: 1 },
  desc: '【被动】瞬步强化成闪步：碰到敌人也不会停下，能被柔化肌肉施放（柔化施放不进冷却）；柔化施放时按 ← 保持面朝前方向后退，拉开距离接瞬影连环踢。需要瞬步 Lv1。' });
defSkill('fs_raid', { name: '强袭拳', cls: 'fighter', job: FS, lvReq: 17, maxLv: 1, sp: 25, mp: 0, cd: 0, type: 'phys', passive: true, col: '#e06a2a', pre: { f_airwalk: 1 },
  desc: '【被动】鹰踏变成强袭拳：空中按 Z 斜着俯冲下来一拳（直接命中）、落地爆炸，攻击力是鹰踏的 145%。空中也能柔化；落地瞬间只有旋风腿、烈火强踢能接。需要鹰踏 Lv1。',
  infoExtra: () => [['攻击力', '鹰踏的 145%']] });
// 强袭拳的动作（鹰踏在学了强袭拳后 morph 成它；等级跟鹰踏走）
defSkill('fs_raidp', { name: '强袭拳', cls: 'fighter', job: FS, lvReq: 17, lvFrom: 'f_airwalk', maxLv: 10, hidden: true, mp: 12, cd: 7, type: 'phys', air: true, airOnly: true, col: '#e06a2a', icon: 'slam',
  desc: '空中：斜着俯冲下来一拳，落地爆炸。', pow: lv => skillDmg(3.8, 0.38, lv), ai: { kind: 'gap', r: [30, 200], dy: 30 },
  act: lv => ({ name: 'fs_raidp', clip: 'fsDive', dur: 1.2, airOnly: true, noCounter: true,
    onStart: e => { fsMorphCommit(e, 'fs_raidp'); e.vz = -680; e.vx = e.face * 460; sfx.swing(true); fxText('流星!', e.x, e.y, e.z + 30, { col: '#ffb070', size: 11, dur: 0.4 }); },
    update: e => { if (!e.act.fsLandT && Math.floor(e.actT / 0.04) !== e.act.ai) { e.act.ai = Math.floor(e.actT / 0.04); fxAfterimage(e, '#ffa060'); } },
    hits: [HB(0, 0.6, [-10, 72, 38, -50, 80], skillDmg(1.5, 0.15, lv), { stun: 0.4, knock: 60, spike: 200, hs: 0.06, snd: 'blunt', col: '#ffc080' })],
    onLand: e => { const a = e.act; if (a.fsLandT !== undefined) return; a.fsLandT = e.actT; a.dur = e.actT + 0.38; e.vx = 0; e.play('fsStomp', true); cam.shake = 6; sfx.boom(0.7);
      const x = e.x + e.face * 30; fsBlastFx(x, e.y, 10, 190); blast(e, x, e.y, 150, { dmg: skillDmg(2.3, 0.23, lv), launch: 380, knock: 120, hs: 0.08, downHit: true, snd: 'fire', col: '#ffb070' }, { zMax: 110 }); } }) });
// 闪步的动作（瞬步在学了闪步后 morph 成它）
defSkill('fs_stepp', { name: '闪步', cls: 'fighter', job: FS, lvReq: 18, lvFrom: 'f_flash', maxLv: 1, hidden: true, mp: 5, cd: 5, type: 'phys', col: '#6ac8ff', icon: 'rise',
  desc: '向前闪出约 210 px（碰到敌人也不停）；柔化施放不进冷却，按 ← 面朝前向后退。', ai: { kind: 'gap', r: [120, 320], dy: 40 },
  act: (lv, p) => { const I = fsPad(p), f0 = p._fsFace; p._fsFace = null;
    const back = f0 !== null && f0 !== undefined && I.dx() && I.dx() !== f0;   // 柔化施放时按 ←：保持原来的朝向向后退
    return { name: 'fs_stepp', clip: 'dash', dur: 0.26, noCounter: true, invul: [0, 0.14],
      onStart: e => { fsMorphCommit(e, 'fs_stepp'); if (back) e.face = f0; e.act.dir = back ? -e.face : e.face; fxAfterimage(e, '#8ad8ff'); sfx.jump(); },
      update: e => { const a = e.act; if (e.actT < 0.13) { e.vx = a.dir * 1650; if (Math.floor(e.actT / 0.03) !== a.ai) { a.ai = Math.floor(e.actT / 0.03); fxAfterimage(e, '#8ad8ff'); } } else e.vx *= 0.5; } }; } });

/* ---- 转职主动技能 ---- */
defSkill('fs_elbow', { name: '肘击', cls: 'fighter', job: FS, lvReq: 16, mp: 18, cd: 4, type: 'phys', col: '#e8c83a', icon: 'iai',
  desc: '像闪电一样突进的肘击，让敌人硬直，从一开始就有攻击判定。按住 → 冲得更远，按住 ↑ / ↓ 边打边往纵深移动；不按方向原地出肘。', pow: lv => skillDmg(2.4, 0.24, lv), ai: { kind: 'gap', r: [0, 220], dy: 40 },
  act: (lv, p) => { const I = fsPad(p), fwd = I.dx() === p.face || fsFwd(p), dy = I.dy();
    return { name: 'fs_elbow', clip: 'fsElbow', dur: 0.42, noCounter: true, move: [[0, 0.2, fwd ? 1000 : 320, undefined, dy * 300]],
      onStart: e => { sfx.swing(false); fxStreak({ x: e.x - e.face * 20, y: e.y, z: e.z + 62, face: e.face, len: fwd ? 260 : 120, w: 10, col: '#ffe86a', dur: 0.2 }); },
      update: e => { if (e.actT < 0.2 && Math.floor(e.actT / 0.04) !== e.act.ai) { e.act.ai = Math.floor(e.actT / 0.04); fxAfterimage(e, '#ffe070'); if (e.act.ai % 2) fsBolt(e.x - e.face * 50, e.y, e.z + 60, e.x + e.face * 20, e.y, e.z + 64, '255,220,90', 0.12); } },
      hits: [HB(0, 0.24, [-10, 84, 38, 10, 115], skillDmg(2.4, 0.24, lv), { max: 1, stun: 0.55, knock: 70, hs: 0.07, snd: 'blunt', col: '#ffe070' })] }; } });
defSkill('fs_pusher', { name: '铁山靠', cls: 'fighter', job: FS, lvReq: 17, mp: 25, cd: 7, type: 'phys', col: '#b87a3a', icon: 'rise', pre: { fs_sa: 1 },
  desc: '以霸体向前冲，用肩膀把敌人狠狠撞飞；按住 → 冲得更远。纵深判定宽，能打倒地的敌人。学了千锤百炼后，烈焰焚步中撞到敌人会向前方扩散一道冲击波。需要霸体护甲 Lv1。',
  pow: lv => skillDmg(3.8, 0.38, lv), ai: { kind: 'gap', r: [0, 260], dy: 55 },
  act: (lv, p) => { const far = fsFwd(p);
    return { name: 'fs_pusher', clip: 'fsPush', dur: 0.55, noCounter: true, superArmor: [0, 0.34], move: [[0.03, 0.27, far ? 1050 : 720]],
      onStart: e => { sfx.swing(true); fxDust(e.x, e.y, 4, 10); },
      update: e => { if (e.actT < 0.27 && Math.floor(e.actT / 0.05) !== e.act.ai) { e.act.ai = Math.floor(e.actT / 0.05); fxDust(e.x - e.face * 10, e.y, 2, 8); } },
      hits: [HB(0.03, 0.3, [-5, 88, 58, 0, 115], skillDmg(3.8, 0.38, lv), { max: 1, knock: 380, launch: 200, airLift: 220, hs: 0.08, shake: 4, heavy: true, big: 1.3, downHit: true, snd: 'blunt', col: '#ffd0a0',
        onHit: (a, t) => { fxShock(t.x, t.y, 120, '#ffd0a0'); if (a.act && a.act.skill === 'fs_pusher' && !a.act.fsWave && a.buffs.fs_awaken && skLv(a, 'fs_limit')) { a.act.fsWave = true; const x0 = t.x, y0 = t.y;
          game.after(0.12, () => { if (a.dead) return; fxSpr('wave', x0 + a.face * 60, y0, 40, { h: 170, dur: 0.35, rot: a.face * Math.PI / 2, col: FS_FIRE, grow: [0.7, 1.3] }); fxShock(x0 + a.face * 160, y0, 260, FS_FIRE);
            areaHit(a, x0 + a.face * 170, y0, 200, 0, { dmg: skillDmg(1.2, 0.12, skLv(a, 'fs_pusher') || 1), knock: 260, launch: 160, hs: 0.04, downHit: true, snd: 'fire', col: '#ffb070' }, { zMax: 120 }); }); } } })] }; } });
defSkill('fs_bone', { name: '碎骨', cls: 'fighter', job: FS, lvReq: 17, mp: 25, cd: 7, type: 'phys', col: '#d8d0c0', icon: 'wave', pre: { f_lowkick: 5 },
  desc: '强化版下段踢：一记能踢碎腿骨的低踢（有一点前摇，柔化施放时没有），很高几率让敌人减速 10 秒（移速 −73%、攻速 −25%）。踢中后产生冲击波打周围的敌人（被直接踢中的不吃冲击波）；能打倒地的敌人。学了千锤百炼后烈焰焚步中冲击波范围变大。需要下段踢 Lv5。',
  pow: lv => skillDmg(3.8, 0.38, lv), ai: { kind: 'burst', r: [0, 110], dy: 34 },
  act: (lv, p) => { const t0 = p.act && p.act.skill && fsMA(p, p.act.skill) ? 0.04 : 0.15;   // 柔化施放：没有前摇
    return { name: 'fs_bone', clip: 'fsLow', dur: t0 + 0.34, noCounter: true, fsDirect: new Set(),
      onStart: e => { e.animT = t0 < 0.1 ? 0.08 : 0; },
      events: [evAt(t0, e => { sfx.swing(true); fxSlashOn(e, { a0: 2.4, a1: 0.4, r: 60, w: 12, off: [30, 14], col: '#ffffff', silent: true }); })],
      hits: [HB(t0, t0 + 0.08, [0, 100, 36, 0, 55], skillDmg(2.8, 0.28, lv), { stun: 0.5, knock: 40, hs: 0.1, downHit: true, snd: 'blunt', col: '#ffffff', shake: 3,
        onHit: (a, t) => { const A = a.act; if (A && A.fsDirect) A.fsDirect.add(t); fsCrack(t.x, t.y, 22, 1.3); fxText('咔嚓', t.x, t.y, t.z + 30, { col: '#ffffff', size: 11, dur: 0.4 });
          if (Math.random() < (game.pvp ? 0.5 : 0.9)) addStatus(t, 'slow', game.pvp ? 3 : 10, { src: a, amt: 0.73 });
          if (A && !A.fsWaved) { A.fsWaved = true; const big = a.buffs.fs_awaken && skLv(a, 'fs_limit'), r = big ? 280 : 170, D = A.fsDirect, x0 = t.x, y0 = t.y;
            fxShock(x0, y0, r * 1.1, big ? FS_FIRE : '#e8e0d0'); fxSpr('wave', x0 + a.face * 40, y0, 30, { h: 120, dur: 0.3, rot: a.face * Math.PI / 4, col: big ? FS_FIRE : '#e8e8ff', grow: [0.6, 1.2] });
            for (const o of ents) if (hittable(a, o) && !D.has(o) && inGround(o, x0, y0, r) && o.z < 100) applyHit(a, o, { dmg: skillDmg(1.0, 0.1, skLv(a, 'fs_bone') || 1), stun: 0.4, knock: 120, airLift: 120, downHit: true, hs: 0.03, snd: 'blunt', col: '#e8e0d0', box: null }, { proj: true, src: { x: x0, y: y0, z: 0, face: a.face } }); } } })] }; } });
defSkill('fs_rush', { name: '闪击快打', cls: 'fighter', job: FS, lvReq: 18, mp: 30, cd: 12, type: 'phys', col: '#ff9a3a', icon: 'flurry', cmdNote: '只能用快捷栏（官方指令未查到）',
  desc: '像光一样冲向敌人，对途中碰到的第一个敌人打出肘击 + 中段踢两连击。按住方向键会追踪前方一定范围内的敌人冲过去（柔化施放时也能换方向）；前方没有敌人就冲到头原地出招。',
  pow: lv => skillDmg(5.6, 0.56, lv), ai: { kind: 'gap', r: [40, 380], dy: 60 },
  act: (lv, p) => { const I = fsPad(p), track = !!(I.dx() || I.dy()), T = track ? aimAhead(p, 380, 420, 150).t : null;
    return { name: 'fs_rush', clip: 'fsElbow', dur: 1.0, noCounter: true, superArmor: [0, 0.2],
      onStart: e => { e.act.tgt = T; fxAfterimage(e, '#ffc070'); sfx.swing(false); fxText('一！', e.x, e.y, e.z + 30, { col: '#ffe0a0', size: 11, dur: 0.35 }); },
      update: e => { const a = e.act;
        if (a.hitAt === undefined) {
          const tx = a.tgt && !a.tgt.dead ? a.tgt.x : null, dy = a.tgt && !a.tgt.dead ? a.tgt.y - e.y : 0;
          if (tx !== null) e.face = Math.sign(tx - e.x) || e.face;
          e.vx = e.face * 1250; e.vy = clamp(dy * 6, -420, 420); if (Math.floor(e.actT / 0.03) !== a.ai) { a.ai = Math.floor(e.actT / 0.03); fxAfterimage(e, '#ffc070'); }
          const hit = ents.some(t => hittable(e, t) && (t.x - e.x) * e.face > -10 && Math.abs(t.x - e.x) < 72 && Math.abs(t.y - e.y) < 40 && t.z < 120);
          if (hit || e.actT > 0.32) { a.hitAt = e.actT; e.vx = e.face * 60; e.vy = 0; a.dur = e.actT + 0.5;
            instantHit(e, { box: [-10, 96, 44, 10, 120], dmg: skillDmg(2.6, 0.26, lv), stun: 0.5, knock: 40, hs: 0.07, snd: 'blunt', col: '#ffd070' }); fxBurst(e.x + e.face * 60, e.y, e.z + 70, 90, '#ffb040'); } }
        else if (!a.two && e.actT > a.hitAt + 0.14) { a.two = true; e.play('fsMid', true); e.animT = 0.18; sfx.swing(true); fxText('二！', e.x, e.y, e.z + 30, { col: '#ffe0a0', size: 11, dur: 0.35 });
          fxSlashOn(e, { a0: 2.2, a1: -0.2, r: 70, w: 14, off: [36, 50], col: '#ffb040', silent: true });
          instantHit(e, { box: [-10, 110, 46, 10, 130], dmg: skillDmg(3.0, 0.3, lv), stun: 0.5, knock: 200, launch: 160, airLift: 200, hs: 0.09, heavy: true, snd: 'blunt', col: '#ffd070' }); } },
      onEnd: e => { e.vy = 0; } }; } });
defSkill('fs_close', { name: '冲膝', cls: 'fighter', job: FS, lvReq: 19, mp: 40, cd: 15, type: 'phys', col: '#e84a2a', icon: 'focus', pre: { fs_bone: 1 },
  desc: '贴身一记威力巨大的中段踢（出招慢，踢空破绽很大）。踢中后停一拍，从敌人身后炸出一道长长的冲击波，打中后面的敌人并把他们远远推开（被直接踢中的敌人不吃冲击波）；烈焰焚步中冲击波不推开敌人。需要碎骨 Lv1。',
  pow: lv => skillDmg(7.4, 0.74, lv), ai: { kind: 'burst', r: [0, 100], dy: 34 },
  act: lv => ({ name: 'fs_close', clip: 'fsMid', dur: 0.95, noCounter: true, fsDirect: new Set(),
    events: [evAt(0.2, e => { sfx.swing(true); fxSlashOn(e, { a0: 2.0, a1: -0.4, r: 64, w: 16, off: [28, 48], col: '#ffe0c0', heavy: true, silent: true }); }),
      evAt(0.36, e => { const a = e.act; if (!a.fsDirect.size) a.dur = 0.95; else a.dur = 0.62; })],   // 踢空：后摇长
    hits: [HB(0.2, 0.28, [0, 88, 36, 20, 110], skillDmg(5.6, 0.56, lv), { stun: 0.6, knock: 60, hs: 0.14, shake: 6, big: 1.8, heavy: true, snd: 'blunt', col: '#ffe0c0',
      onHit: (a, t) => { const A = a.act; if (!A || A.skill !== 'fs_close') return; A.fsDirect.add(t); fxBurst(t.x, t.y, t.z + 60, 160, '#fff0d0'); fxText('Impact!', t.x, t.y, t.z + 36, { col: '#fff0d0', size: 12, dur: 0.45 });
        if (A.fsWave) return; A.fsWave = true; const x0 = t.x, y0 = t.y, D = A.fsDirect, lvS = skLv(a, 'fs_close') || 1;
        game.after(0.12, () => { if (a.dead) return; const burn = !!a.buffs.fs_awaken; cam.shake = Math.max(cam.shake, 6); sfx.boom(0.6);
          fxShock(x0 + a.face * 30, y0, 220, burn ? FS_FIRE : '#ffffff'); fxStreak({ x: x0, y: y0, z: 60, face: a.face, len: 420, w: 36, col: burn ? '#ff9a4a' : '#e8f4ff', dur: 0.3 });
          for (const o of ents) if (hittable(a, o) && !D.has(o) && (o.x - x0) * a.face > -30 && Math.abs(o.x - x0) < 440 && Math.abs(o.y - y0) < 70 && o.z < 150)
            applyHit(a, o, { dmg: skillDmg(1.8, 0.18, lvS), stun: 0.5, knock: burn ? 20 : 520, airLift: 120, hs: 0.05, downHit: true, snd: 'blunt', col: '#e8f4ff', box: null }, { proj: true, src: { x: x0, y: y0, z: 0, face: a.face } }); }); } })] }) });
// 炽焰旋风腿：原地 6 段旋转踢 + 强踢；按住 → 施放则斜向上升 4 段再下劈；跳跃键取消
defSkill('fs_flamekick', { name: '炽焰旋风腿', cls: 'fighter', job: FS, lvReq: 19, mp: 40, cd: 15, type: 'phys', air: true, col: '#ff5a1a', icon: 'spin', pre: { f_tornado: 1 },
  desc: '双腿带火的旋风腿：原地高速旋转踢 6 段，最后一记强踢把敌人踢飞（火焰只是特效，伤害是无属性物理）。按住 → 施放则斜向上升着踢 4 段，再一记下劈把敌人砸向地面。施放时攻击速度 +25%；空中也能用；中途按跳跃键取消（之后可以接空中技能）。需要旋风腿 Lv1。',
  pow: lv => skillDmg(7.3, 0.73, lv), ai: { kind: 'aoe', r: [0, 150], dy: 50 },
  act: (lv, p) => { const up = fsFwd(p), n = up ? 4 : 6, step = 0.075, T0 = 0.06, fin = T0 + n * step + 0.04;
    return { name: 'fs_flamekick', clip: 'fsSpin', dur: fin + 0.36, noCounter: true, lowGrav: up ? 0.35 : 0.6,
      onStart: e => { e.act.spd *= 1.25; e.act.ring = fsFlameRing(e, (fin + 0.1) / e.act.spd); sfx.swing(true); if (up) { e.vz = 380; e.vx = e.face * 320; } else if (e.z > 2) e.vz = Math.max(e.vz, 60); },
      onInput: (e, I) => { if (I.buffered('jump')) { while (I.consume('jump')); const a = e.act; if (a.ring) a.ring.dur = a.ring.t; e.drawFlip = false; e.endAct(); if (e.z > 2) e.setState('jump'); return true; } return false; },
      update: e => { const a = e.act, k = Math.floor((e.actT - T0) / step);
        if (e.actT < fin) e.drawFlip = Math.floor(e.actT / 0.05) % 2 === 1;
        if (e.actT > T0 && k !== a.k && k < n) { a.k = k; if (k % 2 === 0) sfx.swing(false);
          fxSlashOn(e, { a0: k % 2 ? 0.6 : -2.6, a1: k % 2 ? -2.6 : 0.6, r: 66, w: 12, off: [10, 50], col: '#ff8a3a', silent: true });
          instantHit(e, { box: [-80, 116, 52, -10, 140], dmg: skillDmg(0.75, 0.075, lv), stun: 0.35, knock: 0, airLift: up ? 260 : 150, hs: 0.02, snd: 'blunt', col: '#ffb070',
            onHit: (a2, t) => { if (fsCanMove(t)) { t.x = lerp(t.x, e.x + e.face * 55, 0.4); if (up) { t.z = Math.max(t.z, e.z * 0.8); t.vz = Math.max(t.vz, e.vz); } } } }); }
        if (!a.fin && e.actT >= fin) { a.fin = true; e.drawFlip = false; e.play(up ? 'fsStomp' : 'fsUp', true); sfx.swing(true); cam.shake = Math.max(cam.shake, 4);
          if (up) { e.vz = -500; fxSlashOn(e, { a0: -2.2, a1: 1.2, r: 80, w: 18, off: [30, 30], col: '#ff6a2a', heavy: true }); }
          else fxSlashOn(e, { a0: 2.0, a1: -1.6, r: 84, w: 18, off: [30, 50], col: '#ff6a2a', heavy: true });
          instantHit(e, { box: [-20, 136, 54, -30, 150], dmg: skillDmg(2.8, 0.28, lv), stun: 0.5, knock: up ? 60 : 240, launch: up ? 0 : 380, spike: up ? 520 : 0, bounce: up ? 0.7 : 0, hs: 0.1, big: 1.5, heavy: true, snd: 'fire', col: '#ffa050' }); } },
      onLand: e => { const a = e.act; if (a.fin) { e.vx = 0; a.dur = Math.min(a.dur, e.actT + 0.2); fxDust(e.x, e.y, 5, 14); } else { e.vz = 0; e.z = 0; } },
      onEnd: e => { e.drawFlip = false; if (e.act && e.act.ring) e.act.ring.dur = e.act.ring.t; } }; } });
// 闪电之舞：踢前方一个敌人，借反冲力瞬移到周围敌人身边连踢 8 次、把他们赶到第一次踢中的位置，最后一记终结
defSkill('fs_dance', { name: '闪电之舞', cls: 'fighter', job: FS, lvReq: 19, mp: 45, cd: 20, type: 'phys', col: '#ffe23a', icon: 'triple', pre: { fs_close: 1 },
  desc: '先踢前方一个敌人，借反冲力像闪电一样瞬移到周围敌人身边连踢 8 次，把敌人都赶到第一次踢中的地方（被赶过去的敌人强制硬直，霸体也不例外），最后一记强力终结。瞬移的瞬间无敌；周围没有敌人时提前终结，按跳跃键立即终结。透明 / 无敌 / 飞得太高的敌人追不到。需要冲膝 Lv1。',
  pow: lv => skillDmg(9.6, 0.96, lv), ai: { kind: 'aoe', r: [0, 150], dy: 50 },
  act: lv => ({ name: 'fs_dance', clip: 'fsMid', dur: 0.5, noCounter: true, superArmor: true,
    onInput: (e, I) => { if (I.buffered('jump')) { while (I.consume('jump')); if (e.act.gx !== undefined && !e.act.fin) e.act.stop = true; return true; } return false; },
    hits: [HB(0.1, 0.18, [0, 96, 40, 0, 120], skillDmg(1.0, 0.1, lv), { max: 1, stun: 0.6, knock: 0, hs: 0.06, snd: 'blunt', col: '#cfe8ff',
      onHit: (a, t) => { const A = a.act; if (!A || A.skill !== 'fs_dance' || A.gx !== undefined) return; A.gx = t.x; A.gy = t.y; A.n = 0; A.next = a.actT + 0.1; A.dur = 3; fxText('Kick!', t.x, t.y, t.z + 30, { col: '#cfe8ff', size: 11, dur: 0.4 });
        addStatus(t, 'hold', 3, { src: a }); } })],
    update: e => { const a = e.act; if (a.gx === undefined || a.fin) return;
      if (a.stop || a.n >= 8 || e.actT >= a.next) {
        const L = a.stop || a.n >= 8 ? [] : ents.filter(t => hittable(e, t) && Math.abs(t.x - a.gx) < 440 && Math.abs(t.y - a.gy) < 170 && t.z < 150);
        if (!L.length) { a.fin = e.actT; e.x = a.gx - e.face * 90; e.y = a.gy; fsBolt(e.x, e.y, 60, a.gx, a.gy, 60, '120,190,255'); fxAfterimage(e, '#9ad0ff'); e.play('fsUp', true); sfx.swing(true); cam.shake = 8; sfx.boom(0.8);
          a.dur = e.actT + 0.5; fxBurst(a.gx, a.gy, 60, 220, '#8ac8ff'); fxShock(a.gx, a.gy, 260, '#8ac8ff');
          for (const o of ents) if (hittable(e, o) && Math.abs(o.x - a.gx) < 190 && Math.abs(o.y - a.gy) < 80 && o.z < 170) { if (o.status) delete o.status.hold;
            applyHit(e, o, { dmg: skillDmg(3.4, 0.34, lv), launch: 480, knock: 260, hs: 0.14, big: 2, shake: 6, downHit: true, snd: 'blunt', col: '#cfe8ff', box: null }, { src: { x: e.x, y: e.y, z: 0, face: e.face } }); }
          return; }
        const t = L[a.n % L.length]; a.n++; a.next = e.actT + 0.12;
        const side = Math.sign(t.x - a.gx) || (a.n % 2 ? 1 : -1), x0 = e.x, y0 = e.y;
        fxAfterimage(e, '#9ad0ff'); e.x = clamp(t.x + side * 58, game.room ? game.room.x0 + 20 : -1e9, game.room ? game.room.x1 - 20 : 1e9); e.y = t.y; e.face = -side; e.invul = Math.max(e.invul, 0.06);
        fsBolt(x0, y0, 60, e.x, e.y, 60, '120,190,255'); e.play(a.n % 2 ? 'fsMid' : 'fsUp', true); e.animT = 0.18; sfx.swing(a.n % 2 === 0);
        fxText(['Quick!', 'Cut!', '上段!', '中段!', '下段!'][a.n % 5], t.x, t.y, t.z + 36, { col: '#cfe8ff', size: 10, dur: 0.3 });
        applyHit(e, t, { dmg: skillDmg(0.65, 0.065, lv), stun: 0.5, knock: 0, hs: 0.03, sure: true, downHit: true, snd: 'blunt', col: '#cfe8ff' }, { src: e });
        if (!t.dead) { fsPull(t, a.gx + side * 26, a.gy, 1); if (!t.boss) addStatus(t, 'hold', 3, { src: e }); } } } }) });
// 瞬影连环踢（俗称“大脚”）：能踢穿对手似的飞踢，单发大伤害；落地后才能柔化
defSkill('fs_dragon', { name: '瞬影连环踢', cls: 'fighter', job: FS, lvReq: 20, mp: 55, cd: 45, type: 'phys', col: '#ff3a2a', icon: 'iai', pre: { fs_close: 1 },
  desc: '散打的上乘秘技：小跳后一记像要把对手踢穿的飞踢，单发大伤害，被踢中的敌人一律向前方击退（贴身放会踢过对手、从背后命中）。落地后才能用柔化肌肉接别的技能。烈焰焚步中双重施放：追加一段同等威力的火焰爆炸。需要冲膝 Lv1。',
  pow: lv => skillDmg(20, 2, lv), ai: { kind: 'burst', r: [60, 320], dy: 34 },
  act: (lv, p) => ({ name: 'fs_dragon', clip: 'fsFly', dur: 1.3, noCounter: true, fsNoShift: true, lowGrav: 0.5,
    onStart: e => { e.vz = 240; e.vx = e.face * 160; e.z = Math.max(e.z, 1); fsDualTake(e, e.act); sfx.jump(); },
    update: e => { const a = e.act;
      if (!a.go && e.actT >= 0.16) { a.go = true; e.vx = e.face * 1250; e.vz = 40; sfx.swing(true); sfx.iai(); fxStreak({ x: e.x - e.face * 30, y: e.y, z: e.z + 50, face: e.face, len: 380, w: 30, col: a.fsDual ? '#ff9a4a' : '#fff0c0', dur: 0.32 }); }
      if (a.go && e.actT < 0.46 && Math.floor(e.actT / 0.03) !== a.ai) { a.ai = Math.floor(e.actT / 0.03); fxAfterimage(e, a.fsDual ? '#ff8a3a' : '#ffe0a0'); }
      if (a.go && e.actT >= 0.46 && !a.slow) { a.slow = true; e.vx = e.face * 200; } },
    hits: [HB(0.16, 0.46, [-60, 112, 46, 0, 125], skillDmg(20, 2, lv), { max: 1, knock: 460, launch: 240, airLift: 260, hs: 0.16, shake: 9, big: 2.4, heavy: true, critBonus: 0.1, snd: 'blunt', col: '#fff0c0',
      onHit: (a, t) => { const A = a.act; if (!A || A.skill !== 'fs_dragon') return; fxBurst(t.x, t.y, t.z + 60, 240, '#fff0c0'); cam.flash = 0.08; cam.flashCol = '#fff6e0';
        if (A.fsDual && !A.fsDualDone) { A.fsDualDone = true; fsDualHit(a); const x = t.x, y = t.y;
          game.after(0.08, () => { if (a.dead) return; fsBlastFx(x, y, 60, 260); cam.shake = 12; sfx.boom(1.2); fxText('双重施放!', x, y, 120, { col: '#ffb040', size: 13 });
            for (const o of ents) if (hittable(a, o) && Math.abs(o.x - x) < 180 && Math.abs(o.y - y) < 70) applyHit(a, o, { dmg: skillDmg(22, 2.2, skLv(a, 'fs_dragon') || 1), knock: 300, launch: 300, hs: 0.12, big: 2, sure: true, downHit: true, snd: 'fire', col: '#ffb070', box: null }, { proj: true, src: { x: x - a.face * 20, y, z: 0, face: a.face } }); }); } } })],
    onLand: e => { const a = e.act; if (e.actT < 0.3) { e.vz = 0; e.z = 0.5; e.vz = 60; return; } if (a.landed) return; a.landed = true; a.fsNoShift = false; e.vx *= 0.2; a.dur = e.actT + 0.32; e.play('land', true); fxDust(e.x, e.y, 6, 16); } }) });

/* ---- 一次觉醒：武极（官方 48~70 级 → 本作 21~25 级）---- */
defSkill('fs_burn', { name: '烈焰燃烧', cls: 'fighter', job: FS, tier: 1, lvReq: 21, sp: 30, mp: 0, cd: 0, type: 'phys', passive: true, col: '#ff8a2a',
  desc: '【一觉被动】把体内的力量更有效地燃烧：物理攻击力提高；烈焰焚步持续时间变长，焚步期间技能 MP 消耗减少。',
  infoExtra: lv => [['物理攻击力', '+' + pct(0.005 * lv)], ['焚步持续', '+' + (3 + 6 * lv) + ' 秒'], ['焚步中 MP 消耗', '−' + pct(Math.min(0.5, 0.1 + 0.03 * lv))]] });
const fsBurnDur = p => (game.pvp ? 20 : 50) + (skLv(p, 'fs_burn') ? 3 + 6 * skLv(p, 'fs_burn') : 0);
defSkill('fs_awaken', { name: '烈焰焚步', cls: 'fighter', job: FS, tier: 1, lvReq: 21, maxLv: 3, mp: 150, cd: 135, pvp: 0.45, type: 'phys', awaken: true, col: '#ff4a1a',
  desc: '【觉醒 · 变身型 BUFF】唤来地狱之火缠住双脚，发动时周围炸开一圈火焰。持续期间：武术技能冷却 −15%、后摇减少，技能 / 普攻攻击力提高，敌人硬直时间变长，柔化肌肉恢复快 1 秒，走过的地面燃起火焰灼伤敌人。持续 50 秒（烈焰燃烧加长）。焚步中可以用双重施放。',
  pow: lv => skillDmg(8, 2, lv), ai: { kind: 'buff' },
  infoExtra: lv => [['技能攻击力', '+' + pct(0.04 + 0.03 * (lv - 1))], ['后摇减少', pct(0.02 + 0.05 * (lv + 2))], ['武术技能冷却', '−15%'], ['持续', '50 秒 + 烈焰燃烧']],
  act: lv => ({ name: 'fs_awaken', clip: 'fsBuff', dur: 0.95, noCounter: true, invul: true, superArmor: true,
    onStart: e => { game.cutin = { t: 0, dur: 1.0, name: '烈焰焚步', who: cutinWho(e) }; game.timeStop = 0.8; sfx.awaken(); },
    events: [evAt(0.22, e => { cam.shake = 12; cam.flash = 0.2; cam.flashCol = '#ffb070'; sfx.boom(1.3); fxText('喝啊啊啊!', e.x, e.y, e.z + 40, { col: '#ffb040', size: 14 });
      e.buffs.fs_awaken = { t: fsBurnDur(e), dmg: 0.04 + 0.03 * (lv - 1), stagger: 60, rec: Math.min(0.5, 0.02 + 0.05 * (lv + 2)), lv, col: '#ff4a1a' };
      fsFeetFx(e); fsBlastFx(e.x, e.y, 20, 320); fxSpr('lava', e.x, e.y, 0, { h: 200, ay: 1, dur: 0.6, grow: [0.6, 1.1] });
      blast(e, e.x, e.y, 260, { dmg: skillDmg(8, 2, lv), launch: 420, knock: 200, hs: 0.1, big: 1.6, downHit: true, sure: true, snd: 'fire', col: '#ffb070' }, { zMax: 180 }); })] }) });
defSkill('fs_dual', { name: '双重施放', cls: 'fighter', job: FS, tier: 1, lvReq: 21, maxLv: 1, sp: 0, mp: 0, cd: 135, type: 'phys', col: '#ff6a1a', icon: 'awaken', pre: { fs_awaken: 1 },
  desc: '【烈焰焚步中才能用】让体内的地狱火瞬间爆开：下一次 瞬影连环踢 / 烈火强拳 / 炼狱坠星腿（哪个先放用在哪个）追加一段同等威力的攻击。放出强化的技能时就消耗掉；学了千锤百炼后可以在别的技能施放中使用，而且强化的技能打中才消耗。',
  ai: { kind: 'buff' },
  req: p => !p.buffs.fs_awaken ? '需要烈焰焚步' : (!skLv(p, 'fs_limit') && p.st === 'act' && p.act && !p.act.basic) ? '施放中不能用' : true,
  instant: (lv, p, extra) => {
    p.buffs.fs_dual = { t: Math.max(5, p.buffs.fs_awaken ? p.buffs.fs_awaken.t : 30), col: '#ff6a1a' };
    sfx.boom(0.7); sfx.buff(); fxAura(p, FS_FIRE, 0.9); fxSpr('explosion', p.x, p.y, p.z + 50, { w: 150, dur: 0.4, grow: [0.4, 1.1] }); fxText('开放!', p.x, p.y, p.z + 30, { col: '#ffb040', size: 13 });
    if (!skLv(p, 'fs_limit') && !(p.st === 'act' && p.act)) p.doAct({ name: 'fs_dual', clip: 'fsBuff', dur: 0.4, noCounter: true, superArmor: true }, extra); } });
// 飞燕旋风：快速回旋踢把前方的敌人扫到一起，再强力一击；按住 → 向前跃起施放
defSkill('fs_whirl', { name: '飞燕旋风', cls: 'fighter', job: FS, tier: 1, lvReq: 23, mp: 50, cd: 20, type: 'phys', col: '#4ab8ff', icon: 'spin', cmdNote: '只能用快捷栏（官方没有指令）',
  desc: '一连串快速回旋踢把前方大范围的敌人扫到一处，再补上强力的一击。按住 → 施放时向前跃起。范围大，清怪好用。',
  pow: lv => skillDmg(9, 0.9, lv), ai: { kind: 'aoe', r: [0, 240], dy: 70 },
  act: (lv, p) => { const leap = fsFwd(p);
    return { name: 'fs_whirl', clip: 'fsSpin', dur: 0.95, noCounter: true, superArmor: [0, 0.6], lowGrav: 0.6,
      onStart: e => { if (leap) { e.vz = 300; e.vx = e.face * 420; e.z = Math.max(e.z, 1); } e.act.ring = fsFlameRing(e, 0.55, '#8ad8ff', 60); sfx.swing(true); },
      update: e => { const a = e.act, k = Math.floor((e.actT - 0.05) / 0.09), gx = e.x + e.face * 140;
        if (e.actT < 0.45) e.drawFlip = Math.floor(e.actT / 0.045) % 2 === 1;
        if (e.actT > 0.05 && k !== a.k && k < 4) { a.k = k; sfx.swing(k % 2 === 1);
          fxSlashOn(e, { a0: k % 2 ? 0.8 : -2.4, a1: k % 2 ? -2.4 : 0.8, r: 110, w: 18, off: [60, 50], col: '#9ae0ff', silent: true });
          instantHit(e, { box: [-50, 320, 76, -10, 140], dmg: skillDmg(0.75, 0.075, lv), stun: 0.45, knock: 0, airLift: 140, hs: 0.02, snd: 'blunt', col: '#bfeaff', onHit: (a2, t) => fsPull(t, gx, e.y, 0.55) }); }
        if (!a.fin && e.actT >= 0.48) { a.fin = true; e.drawFlip = false; e.play('fsMid', true); e.animT = 0.18; sfx.swing(true); cam.shake = 6;
          fxSlashOn(e, { a0: 2.2, a1: -1.2, r: 120, w: 24, off: [60, 60], col: '#4ab8ff', heavy: true }); fxShock(gx, e.y, 220, '#8ad8ff');
          instantHit(e, { box: [0, 280, 76, -10, 160], dmg: skillDmg(6, 0.6, lv), knock: 260, launch: 400, hs: 0.12, big: 1.8, heavy: true, snd: 'blunt', col: '#bfeaff' }); } },
      onLand: e => { e.vx *= 0.3; if (e.act.fin) e.act.dur = Math.min(e.act.dur, e.actT + 0.3); },
      onEnd: e => { e.drawFlip = false; } }; } });
// 旋风碎心踢：原地转一圈（前后都能打到、把敌人卷到身前），借离心力低跳两脚踢飞，落点炸开
defSkill('fs_spin', { name: '旋风碎心踢', cls: 'fighter', job: FS, tier: 1, lvReq: 25, mp: 70, cd: 50, type: 'phys', col: '#ff8a1a', icon: 'spin', pre: { fs_whirl: 1 },
  desc: '原地飞快转一圈（前后都能打到，把敌人卷到身前），借离心力低跳着连踢两脚，把敌人踢飞击倒，同时前方炸开一圈冲击。范围非常大；本身没有霸体（转圈时可能被打断）。需要飞燕旋风 Lv1。',
  pow: lv => skillDmg(20, 2, lv), ai: { kind: 'aoe', r: [0, 300], dy: 90 },
  act: lv => ({ name: 'fs_spin', clip: 'fsSpin', dur: 1.15, noCounter: true, lowGrav: 0.8,
    onStart: e => { e.act.ring = fsFlameRing(e, 0.4, '#ffb04a', 80); sfx.swing(true); },
    update: e => { const a = e.act, k = Math.floor((e.actT - 0.04) / 0.1);
      if (e.actT < 0.34) e.drawFlip = Math.floor(e.actT / 0.05) % 2 === 1;
      if (e.actT > 0.04 && k !== a.k && k < 3) { a.k = k; sfx.swing(false); fxSlashOn(e, { a0: -Math.PI + k * 2, a1: k * 2, r: 140, w: 18, off: [0, 40], col: '#ffc070', silent: true });
        instantHit(e, { box: [-150, 240, 90, -10, 140], dmg: skillDmg(1.4, 0.14, lv), stun: 0.5, knock: 0, hs: 0.02, snd: 'blunt', col: '#ffd090', onHit: (a2, t) => fsPull(t, e.x + e.face * 90, e.y, 0.5) }); }
      if (!a.jump && e.actT >= 0.36) { a.jump = true; e.drawFlip = false; e.vz = 320; e.z = Math.max(e.z, 1); e.vx = -e.face * 60; e.play('fsUp', true); sfx.jump(); }
      for (const [i, t] of [[1, 0.46], [2, 0.6]]) if (a.jump && !a['kk' + i] && e.actT >= t) { a['kk' + i] = true; sfx.swing(true); cam.shake = Math.max(cam.shake, 5);
        fxSlashOn(e, { a0: i === 1 ? 2.4 : -2.6, a1: i === 1 ? -1.4 : 1.2, r: 150, w: 26, off: [40, 60], col: '#ff9a3a', heavy: true });
        instantHit(e, { box: [-60, 250, 90, -10, 170], dmg: skillDmg(i === 1 ? 5 : 6, i === 1 ? 0.5 : 0.6, lv), down: i === 2, downLift: 260, knock: i === 2 ? 380 : 60, launch: i === 1 ? 300 : 0, hs: 0.1, big: 1.8, heavy: true, snd: 'blunt', col: '#ffc070' });
        if (i === 2) { const x = e.x + e.face * 120; fsBlastFx(x, e.y, 20, 260); blast(e, x, e.y, 260, { dmg: skillDmg(4.2, 0.42, lv), down: true, downLift: 220, knock: 320, hs: 0.1, downHit: true, snd: 'fire', col: '#ffb070' }, { zMax: 160 }); } } },
    onLand: e => { const a = e.act; if (a.jump && a.kk2) { e.vx = 0; a.dur = Math.min(a.dur, e.actT + 0.3); } },
    onEnd: e => { e.drawFlip = false; } }) });

/* ---- 二次觉醒：极武皇（官方 75~85 级 → 本作 26~27 级）---- */
defSkill('fs_fire', { name: '烈火支配', cls: 'fighter', job: FS, tier: 2, lvReq: 26, sp: 30, mp: 0, cd: 0, type: 'phys', passive: true, col: '#ff5a2a',
  desc: '【二觉被动】把体内的力量连同灵魂一起开放到全身：普攻 / 技能攻击力提高；柔化肌肉次数 +4，恢复时间缩短。',
  infoExtra: lv => [['攻击力', '+' + pct(0.02 * lv)], ['柔化次数', '+4'], ['恢复时间', '−' + Math.min(3.2, 0.6 + 0.3 * lv).toFixed(1) + ' 秒']] });
// 烈火强踢：前冲让敌人硬直并赶到前方一处，跳起强力下劈爆炸；空中 / 后跳中施放则原地直接下劈
defSkill('fs_descent', { name: '烈火强踢', cls: 'fighter', job: FS, tier: 2, lvReq: 26, mp: 80, cd: 45, type: 'phys', air: true, col: '#ff3a1a', icon: 'slam',
  desc: '向前冲出，让路上的敌人硬直并把他们赶到前方一处，然后跳起一记强力下劈，落点炸开火焰。空中 / 后跳中施放则原地直接急速下劈。霸体的敌人赶不动、挑不起来。空中可以柔化。',
  pow: lv => skillDmg(18, 1.8, lv), ai: { kind: 'aoe', r: [0, 260], dy: 60 },
  act: (lv, p) => { const air = p.z > 2 || p.st === 'jump' || (p.act && p.act.name === 'back');
    return { name: 'fs_descent', clip: air ? 'fsStomp' : 'fsPush', dur: 2.0, noCounter: true, superArmor: true,
      onStart: e => { const a = e.act; a.gx = e.x + e.face * 200; a.air = air; if (air) { a.dive = true; e.vz = -1300; e.vx = e.face * 40; fxText('落花!', e.x, e.y, e.z + 30, { col: '#ffb070', size: 12, dur: 0.4 }); } else sfx.swing(true); },
      update: e => { const a = e.act;
        if (!a.air && e.actT < 0.26) { e.vx = e.face * 820; if (Math.floor(e.actT / 0.04) !== a.ai) { a.ai = Math.floor(e.actT / 0.04); fxAfterimage(e, '#ff9a5a'); }
          for (const t of ents) if (hittable(e, t) && (t.x - e.x) * e.face > -20 && Math.abs(t.x - e.x) < 110 && Math.abs(t.y - e.y) < 60 && t.z < 120) { if (!a.gat) a.gat = new Set();
            if (!a.gat.has(t)) { a.gat.add(t); applyHit(e, t, { dmg: skillDmg(0.5, 0.05, lv), stun: 0.9, knock: 0, hs: 0.02, snd: 'blunt', col: '#ffc080' }, { src: e }); }
            fsPull(t, e.x + e.face * 90, e.y, 0.35); } }
        if (!a.air && !a.up && e.actT >= 0.26) { a.up = true; e.vx = e.face * 90; e.vz = 560; e.z = Math.max(e.z, 1); e.play('fsStomp', true); sfx.jump();
          for (const t of a.gat || []) if (hittable(e, t) && fsCanMove(t)) { t.x = e.x + e.face * 130; t.y = clamp(lerp(t.y, e.y, 0.8), 4, DEPTH - 4); } }
        if (a.up && !a.dive && e.actT >= 0.5) { a.dive = true; e.vz = -1300; sfx.swing(true); }
        if (a.dive && !a.slam && Math.floor(e.actT / 0.03) !== a.ai) { a.ai = Math.floor(e.actT / 0.03); fxAfterimage(e, '#ff7a3a'); } },
      onLand: e => { const a = e.act; if (!a.dive) { e.vz = 0; return; } if (a.slam) return; a.slam = true; e.vx = 0; a.dur = e.actT + 0.45; cam.shake = 14; cam.flash = 0.12; cam.flashCol = '#ffb070'; sfx.boom(1.3);
        const x = e.x + e.face * 50; fsBlastFx(x, e.y, 20, 300); fxSpr('lava', x, e.y, 0, { h: 180, ay: 1, dur: 0.55, grow: [0.5, 1.1] });
        blast(e, x, e.y, 250, { dmg: skillDmg(17, 1.7, lv), launch: 460, knock: 160, hs: 0.14, big: 2, downHit: true, snd: 'fire', col: '#ffb070' }, { zMax: 200 }); } }; } });
// 烈火强拳：按住技能键调整出拳时机，准备中方向键调距离（→ 冲得远、← 原地），突进路线上的敌人一起拖走，最后一记重拳把敌人打飞
defSkill('fs_cannon', { name: '烈火强拳', cls: 'fighter', job: FS, tier: 2, lvReq: 26, mp: 90, cd: 55, type: 'phys', col: '#ff2a2a', icon: 'iai',
  desc: '摆出架势蓄力，突进一记重拳把敌人打飞。按住技能键可以推迟出拳（蓄得久不会更痛）；准备中按 → 冲得更远、按 ← 原地出拳（原地时突进的伤害并进拳击）。突进路线上的敌人会被一路拖走。烈焰焚步中双重施放：追加一段同等威力的“Buster!”。',
  pow: lv => skillDmg(22, 2.2, lv), ai: { kind: 'burst', r: [0, 360], dy: 34 },
  act: lv => ({ name: 'fs_cannon', clip: 'fsCharge', dur: 1.2, noCounter: true, superArmor: true,
    charge: { at: 0.22, max: 1.4, min: 0, dmg: 0, update: e => { const I = fsPad(e), dx = I.dx(); if (dx) e.act.dist = dx === e.face ? 2 : 0; if (Math.random() < 0.3) fxCharge(e, '#ff6a3a'); } },
    onStart: e => { e.act.dist = fsFwd(e) ? 2 : 1; fsDualTake(e, e.act); sfx.charge(); fxText('Atomic~', e.x, e.y, e.z + 30, { col: '#ffb070', size: 11, dur: 0.5 }); },
    update: e => { const a = e.act; if (!a.chargeDone || a.hit) return;
      if (a.go === undefined) { a.go = e.actT; a.D = [0, 300, 470][a.dist]; a.x0 = e.x; a.drag = new Set(); e.play('fsPunch', true); sfx.swing(true);
        fxStreak({ x: e.x - e.face * 20, y: e.y, z: e.z + 62, face: e.face, len: Math.max(160, a.D + 120), w: 26, col: '#ff8a4a', dur: 0.3 }); }
      if (a.D && e.actT - a.go < 0.14) { e.vx = e.face * a.D / 0.14; if (Math.floor(e.actT / 0.025) !== a.ai) { a.ai = Math.floor(e.actT / 0.025); fxAfterimage(e, '#ff8a4a'); }
        for (const t of ents) if (hittable(e, t) && (t.x - e.x) * e.face > -20 && (t.x - e.x) * e.face < 100 && Math.abs(t.y - e.y) < 50 && t.z < 120) { a.drag.add(t); if (fsCanMove(t)) { t.x = e.x + e.face * 70; t.y = lerp(t.y, e.y, 0.3); } }   // 突进路线上的敌人一路拖走
        return; }
      a.hit = true; e.vx = 0; const inPlace = a.dist === 0, dmg = skillDmg(22, 2.2, lv) * (inPlace ? 1 : 0.92);   // 原地出拳：突进的伤害并进拳击
      cam.shake = 12; cam.flash = 0.1; cam.flashCol = '#ffc0a0'; sfx.boom(1.1); fxText('Cannon!', e.x, e.y, e.z + 40, { col: '#ff8a4a', size: 13 });
      fxBurst(e.x + e.face * 90, e.y, e.z + 62, 240, '#ff8a4a'); fxShock(e.x + e.face * 90, e.y, 200, '#ff8a4a');
      const hit = instantHit(e, { box: [-20, 150, 52, 0, 140], dmg, knock: 560, launch: 320, airLift: 300, hs: 0.16, big: 2.4, shake: 8, heavy: true, snd: 'blunt', col: '#ffd0a0' });
      for (const t of a.drag) if (hittable(e, t) && Math.abs(t.x - e.x) > 170) applyHit(e, t, { dmg: dmg * 0.08, stun: 0.4, knock: 200, hs: 0.03, sure: true, snd: 'blunt', col: '#ffd0a0' }, { src: e });   // 拖到最后没被拳打到的
      if (a.fsDual && hit) { fsDualHit(e); game.after(0.14, () => { if (e.dead) return; const x = e.x + e.face * 110; fsBlastFx(x, e.y, 60, 300); cam.shake = 14; sfx.boom(1.3); fxText('Buster!', x, e.y, 130, { col: '#ffb040', size: 14 });
        for (const o of ents) if (hittable(e, o) && (o.x - e.x) * e.face > -40 && Math.abs(o.x - e.x) < 320 && Math.abs(o.y - e.y) < 70) applyHit(e, o, { dmg: skillDmg(24, 2.4, lv), knock: 400, launch: 360, hs: 0.14, big: 2.2, sure: true, downHit: true, snd: 'fire', col: '#ffb070', box: null }, { proj: true, src: e }); }); }
      a.dur = e.actT + 0.45; } }) });
// 极武霸皇踢：电光般左右来回出拳把前方的敌人聚到一点，最后全身力量聚到脚尖，一记贯穿前方的飞踢
defSkill('fs_awaken2', { name: '极武霸皇踢', cls: 'fighter', job: FS, tier: 2, lvReq: 27, maxLv: 3, mp: 200, cd: 170, pvp: 0.45, type: 'phys', awaken: true, col: '#ffc01a',
  desc: '【二次觉醒】电光石火般在敌人左右两侧来回各打出一拳，把前方大范围的敌人聚到一点，然后把全身的力量集中到脚尖，一记贯穿前方的飞踢（大部分伤害在飞踢，“爆碎”）。全程无敌。',
  pow: lv => skillDmg(30, 8, lv), ai: { kind: 'awaken', r: [0, 460], dy: 110 },
  act: lv => ({ name: 'fs_awaken2', clip: 'fsPunch', dur: 2.3, superArmor: true, noCounter: true, invul: true,
    onStart: e => { game.cutin = { t: 0, dur: 1.0, name: '极武霸皇踢', who: cutinWho(e, 2) }; game.timeStop = 0.9; sfx.awaken(); const a = e.act, R = game.room;
      a.gx = R ? clamp(e.x + e.face * 210, R.x0 + 260, R.x1 - 260) : e.x + e.face * 210; a.gy = e.y; a.f0 = e.face; },
    update: e => { const a = e.act, t = e.actT, T = skillDmg(30, 8, lv);
      const punch = (i) => { const side = i ? a.f0 : -a.f0, x0 = e.x; fxAfterimage(e, '#ffe070'); e.x = a.gx + side * 80; e.y = a.gy; e.face = -side; fsBolt(x0, e.y, 60, e.x, e.y, 60, '255,210,80', 0.2);
        e.play('fsPunch', true); sfx.swing(true); cam.shake = 7; fxBurst(a.gx, a.gy, 70, 200, '#ffe070'); fxShock(a.gx, a.gy, 300, '#ffe070');
        for (const o of ents) if (hittable(e, o) && Math.abs(o.x - a.gx) < 460 && Math.abs(o.y - a.gy) < 150 && o.z < 200) { fsPull(o, a.gx, a.gy, 0.85); if (!o.boss) addStatus(o, 'hold', 1.6, { src: e });
          applyHit(e, o, { dmg: T * 0.1, stun: 0.6, knock: 0, airLift: 80, hs: 0.06, sure: true, downHit: true, snd: 'blunt', col: '#fff0a0', box: null }, { src: e }); } };
      if (!a.p1 && t >= 0.3) { a.p1 = true; punch(0); }
      if (!a.p2 && t >= 0.62) { a.p2 = true; punch(1); }
      if (!a.ready && t >= 0.9) { a.ready = true; fxAfterimage(e, '#ffe070'); e.face = a.f0; e.x = a.gx - a.f0 * 230; e.y = a.gy; e.play('fsCharge', true); sfx.charge(); fxAura(e, '#ffd23a', 0.6); for (let i = 0; i < 4; i++) fxCharge(e, '#ffe070', 3); }
      if (!a.kick && t >= 1.25) { a.kick = true; e.play('fsFly', true); e.animT = 0.12; e.vx = e.face * 1500; sfx.iai(); sfx.swing(true); fxStreak({ x: e.x, y: e.y, z: e.z + 60, face: e.face, len: 620, w: 44, col: '#ffe070', dur: 0.4 }); }
      if (a.kick && !a.stop) e.vx = e.face * 1500;
      if (a.kick && !a.boom) { if (Math.floor(t / 0.03) !== a.ai) { a.ai = Math.floor(t / 0.03); fxAfterimage(e, '#ffd040'); }
        if ((e.x - a.gx) * e.face > 0 || t >= 1.45) { a.boom = true; cam.shake = 16; cam.flash = 0.25; cam.flashCol = '#fff0c0'; sfx.boom(1.5); fxText('爆碎', a.gx, a.gy, 150, { col: '#ffe070', size: 22, dur: 1 });
          fxBurst(a.gx, a.gy, 70, 360, '#ffe070'); fxShock(a.gx, a.gy, 420, '#ffd040'); fxStreak({ x: a.gx - e.face * 100, y: a.gy, z: 70, face: e.face, len: 700, w: 70, col: '#fff0a0', dur: 0.45 });
          for (const o of ents) if (hittable(e, o) && (o.x - a.gx) * e.face > -260 && Math.abs(o.x - a.gx) < 640 && Math.abs(o.y - a.gy) < 130 && o.z < 220) { if (o.status) delete o.status.hold;
            applyHit(e, o, { dmg: T * 0.8, knock: 520, launch: 420, hs: 0.2, big: 2.6, sure: true, downHit: true, critBonus: 0.1, snd: 'blunt', col: '#fff0a0', box: null }, { src: { x: a.gx - e.face * 40, y: a.gy, z: 0, face: e.face } }); } } }
      if (a.kick && t >= 1.62 && !a.stop) { a.stop = true; e.vx = e.face * 120; e.play('land', true); } } }) });

/* ---- 三次觉醒：归元·散打（官方 95~100 级 → 本作 29~30 级）---- */
defSkill('fs_limit', { name: '千锤百炼', cls: 'fighter', job: FS, tier: 3, lvReq: 29, sp: 40, mp: 0, cd: 0, type: 'phys', passive: true, col: '#ffb01a',
  desc: '【三觉被动】突破自己的极限：普攻和转职技能攻击力提高。烈焰焚步中 碎骨 的冲击波范围变大、铁山靠 撞到敌人时向前方扩散冲击波；双重施放可以在别的技能施放中使用，强化的技能没打中时不消耗。',
  infoExtra: lv => [['攻击力', '+' + pct(0.03 * lv)]] });
// 炼狱坠星腿：锁定周围最强的敌人，跃起后出现在他头顶下劈并出冲击波；双重施放时再追加一记终结拳（只打前方）
defSkill('fs_mortal', { name: '炼狱坠星腿', cls: 'fighter', job: FS, tier: 3, lvReq: 29, mp: 110, cd: 60, type: 'phys', air: true, col: '#ff4a3a', icon: 'slam',
  desc: '地面、空中都能用：锁定周围（约 440 px）最强的敌人，纵身跃起，片刻后出现在他头顶一脚踩下，落地炸出大范围冲击波。烈焰焚步中双重施放：再追加一记同等威力的终结拳（只打前方）。',
  pow: lv => skillDmg(26.5, 2.65, lv), ai: { kind: 'burst', r: [0, 440], dy: 160 },
  act: lv => ({ name: 'fs_mortal', clip: 'fsUp', dur: 2.2, noCounter: true, superArmor: true,
    onStart: e => { const a = e.act; a.tgt = fsStrongest(e, 440, 220); fsDualTake(e, a); e.vz = 900; e.z = Math.max(e.z, 1); e.vx = 0; sfx.jump(); fxDust(e.x, e.y, 6, 14); fxText(a.tgt ? '抓到了!' : '上!', e.x, e.y, e.z + 30, { col: '#ffb070', size: 11, dur: 0.4 }); },
    update: e => { const a = e.act;
      if (!a.drop && e.actT < 0.34) { e.vz = Math.max(e.vz, 700); if (Math.floor(e.actT / 0.04) !== a.ai) { a.ai = Math.floor(e.actT / 0.04); fxAfterimage(e, '#ff8a5a'); } }
      if (!a.drop && e.actT >= 0.42) { a.drop = true; const t = a.tgt && !a.tgt.dead ? a.tgt : null, x = t ? t.x : e.x + e.face * 260, y = t ? t.y : e.y;
        if (t) e.face = Math.sign(t.x - e.x) || e.face; e.x = clamp(x - e.face * 10, game.room ? game.room.x0 + 20 : -1e9, game.room ? game.room.x1 - 20 : 1e9); e.y = y; e.z = 300; e.vz = -1800; e.vx = 0; e.play('fsStomp', true); sfx.swing(true);
        addFx({ x, y: y + 1, z: 0, dur: 0.25, draw(c) { const k = this.t / this.dur; drawSpr(c, fxTint('rune', '#ff4a3a'), sx(this.x), sy(this.y, 0), 180 * (1.2 - 0.4 * k), 60, { ground: true, alpha: 0.8 * (1 - k) }); } }); }
      if (a.drop && !a.land && Math.floor(e.actT / 0.03) !== a.ai) { a.ai = Math.floor(e.actT / 0.03); fxAfterimage(e, '#ff6a3a'); } },
    onLand: e => { const a = e.act; if (!a.drop) { e.vz = 700; e.z = 1; return; } if (a.land) return; a.land = true; a.dur = e.actT + (a.fsDual ? 0.85 : 0.45); cam.shake = 16; cam.flash = 0.15; cam.flashCol = '#ffb0a0'; sfx.boom(1.4);
      const T = skillDmg(26.5, 2.65, lv); fsBlastFx(e.x, e.y, 20, 340); fxShock(e.x, e.y, 520, '#ff5a3a');
      const k = instantHit(e, { box: [-60, 70, 50, -20, 160], dmg: T * 0.45, knock: 80, launch: 260, hs: 0.12, big: 2, sure: true, downHit: true, snd: 'blunt', col: '#ffd0a0' });
      blast(e, e.x, e.y, 330, { dmg: T * 0.55, launch: 380, knock: 260, hs: 0.12, big: 1.8, downHit: true, snd: 'fire', col: '#ffb070' }, { zMax: 220 });
      if (a.fsDual) game.after(0.35, () => { if (e.dead || e.act !== a) return; e.play('fsPunch', true); sfx.swing(true); cam.shake = 14; sfx.boom(1.2); const x = e.x + e.face * 120; fsBlastFx(x, e.y, 60, 280); fxText('双重施放!', x, e.y, 130, { col: '#ffb040', size: 13 });
        let n = 0; for (const o of ents) if (hittable(e, o) && (o.x - e.x) * e.face > -20 && Math.abs(o.x - e.x) < 340 && Math.abs(o.y - e.y) < 80) { n++; applyHit(e, o, { dmg: T, knock: 440, launch: 340, hs: 0.14, big: 2.2, sure: true, downHit: true, snd: 'fire', col: '#ffb070', box: null }, { src: e }); }
        if (n) fsDualHit(e); });
      else if (k) fsDualHit(e); } }) });
// 焚火逐日拳：瞬移到周围最强的敌人身边，豁出一切连续全力出拳，一记回旋踢，最后一记“灭火”重拳
defSkill('fs_awaken3', { name: '焚火逐日拳', cls: 'fighter', job: FS, tier: 3, lvReq: 30, maxLv: 3, mp: 300, cd: 270, pvp: 0.45, type: 'phys', awaken: true, col: '#ff2a1a',
  desc: '【三次觉醒】把烧尽一切的觉悟灌进双拳：瞬移到周围最强的敌人身边，一拳一拳全力连打（7 拳），接一记回旋踢，最后一记“灭火”重拳引爆火焰。实际打击范围比看起来大得多。全程无敌。',
  pow: lv => skillDmg(44, 12, lv), ai: { kind: 'awaken', r: [0, 520], dy: 150 },
  act: lv => ({ name: 'fs_awaken3', clip: 'fsPunch', dur: 3.4, superArmor: true, noCounter: true, invul: true,
    onStart: e => { game.cutin = { t: 0, dur: 1.2, name: '焚火逐日拳', who: cutinWho(e, 3) }; game.timeStop = 1.0; sfx.awaken(); fxText('去吧……!', e.x, e.y, e.z + 36, { col: '#ffb040', size: 12 });
      const a = e.act, t = fsStrongest(e, 620, 260); if (t) { fxAfterimage(e, '#ff6a3a'); const x0 = e.x; e.face = Math.sign(t.x - e.x) || e.face; e.x = clamp(t.x - e.face * 70, game.room ? game.room.x0 + 20 : -1e9, game.room ? game.room.x1 - 20 : 1e9); e.y = t.y; fsBolt(x0, e.y, 60, e.x, e.y, 60, '255,120,60', 0.3); }
      a.cx = e.x + e.face * 90; a.cy = e.y; a.feet = fsFlameRing(e, 2.4, FS_FIRE, 40); },
    update: e => { const a = e.act, t = e.actT, T = skillDmg(44, 12, lv), P = 0.06, hit = (d, o) => areaHit(e, a.cx, a.cy, 330, 0, { dmg: T * d, stun: 0.6, knock: 0, airLift: 60, hs: 0.05, sure: true, downHit: true, snd: 'fire', col: '#ffb070', ...o }, { zMax: 220 });
      const k = Math.floor((t - 0.35) / 0.2);
      if (t > 0.35 && k !== a.k && k < 7) { a.k = k; e.play('fsRush', true); e.animT = k % 2 ? 0.1 : 0; sfx.swing(k % 2 === 1); cam.shake = Math.max(cam.shake, 6); fxText(k % 2 ? '啊啦!' : '欧拉!', e.x, e.y, e.z + 40, { col: '#ffc080', size: 11, dur: 0.3 });
        fxBurst(a.cx + rnd(-30, 30), a.cy, 60 + rnd(-20, 30), 200, '#ff8a3a'); fxSpr('explosion', a.cx + rnd(-40, 40), a.cy, 50 + rnd(0, 40), { w: 150, dur: 0.35, grow: [0.5, 1.1] });
        for (const o of ents) if (hittable(e, o) && Math.abs(o.x - a.cx) < 480 && Math.abs(o.y - a.cy) < 170 && o.z < 220) fsPull(o, a.cx, a.cy, 0.35);
        hit(P); }
      if (!a.spin && t >= 1.8) { a.spin = true; e.play('fsMid', true); e.animT = 0.18; sfx.swing(true); cam.shake = 10; fxSlashOn(e, { a0: 2.4, a1: -2.2, r: 170, w: 30, off: [20, 60], col: '#ff8a3a', heavy: true }); fxText('哈!', e.x, e.y, e.z + 40, { col: '#ffc080', size: 12, dur: 0.35 }); hit(0.12, { airLift: 160 }); }
      if (!a.charge && t >= 2.1) { a.charge = true; e.play('fsCharge', true); sfx.charge(); fxAura(e, FS_FIRE, 0.6); for (let i = 0; i < 4; i++) fxCharge(e, '#ff8a3a', 3); }
      if (!a.fin && t >= 2.55) { a.fin = true; e.play('fsPunch', true); e.animT = 0.06; cam.shake = 20; cam.flash = 0.3; cam.flashCol = '#ffc0a0'; sfx.boom(1.6); fxText('灭火!', a.cx, a.cy, 160, { col: '#ff6a2a', size: 22, dur: 1 });
        fsBlastFx(a.cx + e.face * 40, a.cy, 60, 420); fxSpr('lava', a.cx + e.face * 40, a.cy, 0, { h: 260, ay: 1, dur: 0.7, grow: [0.5, 1.2] }); fxStreak({ x: e.x, y: e.y, z: e.z + 62, face: e.face, len: 520, w: 60, col: '#ff8a4a', dur: 0.4 });
        hit(1 - 7 * P - 0.12, { launch: 520, knock: 420, airLift: 0, hs: 0.2, big: 2.6, critBonus: 0.1 }); } },
    onEnd: e => { const a = e.act; if (a && a.feet) a.feet.dur = a.feet.t; } }) });

/* ---- 被动效果（每 0.25 秒刷新；hide = 不在 HUD 上显示图标）---- */
CLASSES.fighter.passives.push(p => {
  if (!fsOn(p)) { for (const id of ['fs_shift', 'fs_aim', 'fs_burn', 'fs_fire', 'fs_limit']) setPassive(p, id, false); return; }
  fsPatchBase();
  if (game.pvp && p._fsDuel !== game.duel) { p._fsDuel = game.duel; p._fsDuelT = game.t; }
  const sh = skLv(p, 'fs_shift'); if (sh) { const s = fsShiftOf(p); setPassive(p, 'fs_shift', true, { dmg: 0.0625 + 0.0075 * sh, lab: '×' + s.n, col: '#3ab8d8' }); } else setPassive(p, 'fs_shift', false);
  const aim = skLv(p, 'fs_aim'); setPassive(p, 'fs_aim', aim > 0, { crit: 0.02 + 0.008 * aim, hide: true });
  const bu = skLv(p, 'fs_burn'); setPassive(p, 'fs_burn', bu > 0, { atk: 0.005 * bu, hide: true });
  const fi = skLv(p, 'fs_fire'), li = skLv(p, 'fs_limit'); setPassive(p, 'fs_fire', fi > 0 || li > 0, { dmg: 0.02 * fi + 0.03 * li, hide: true });
  if (p.buffs.fs_sa) p.superArmor = Math.max(p.superArmor, 0.3);   // 霸体护甲：BUFF 期间一直霸体
  if (p.buffs.fs_power) fsFistFx(p);
  if (p.buffs.fs_awaken) { fsFeetFx(p);
    if ((p.st === 'run' || p.st === 'walk') && Math.hypot(p.vx, p.vy) > 60) { fsGroundFire(p.x - p.face * 10, p.y, 0.9, 34);   // 焚步：走过的地面着火
      areaHit(p, p.x - p.face * 10, p.y, 50, 0, { dmg: skillDmg(0.3, 0.08, skLv(p, 'fs_awaken') || 1), stun: 0.1, knock: 0, hs: 0, sure: true, snd: 'fire', col: '#ffb070' }, { zMax: 60 }); } }
  if (!p.buffs.fs_awaken && p.buffs.fs_dual) delete p.buffs.fs_dual;
});

/* ---- 登记 ---- */
CLASSES.fighter.jobs.striker = { art: 'job/striker', name: '散打', role: '近战 · 连打（物理）', armor: 'light', growth: { str: 1.1, vit: 1.04 },
  awaken: 'fs_awaken', awakenName: '武极', awaken2: 'fs_awaken2', awakenName2: '极武皇', awaken3: 'fs_awaken3', awakenName3: '归元·散打', ready: false,
  desc: '只相信自己拳脚的格斗家。柔化肌肉让散打技能之间可以强制衔接，霸体护甲撑住正面；一觉烈焰焚步点燃双腿，还能把下一记大招双重施放。拳套只有散打能装备。',
  auto: ['fs_glove', 'fs_light'],
  anims: FS_ANIMS,
  skills: ['fs_glove', 'fs_light', 'fs_power', 'fs_elbow', 'fs_sa', 'fs_pusher', 'fs_bone', 'fs_raid', 'fs_aim', 'fs_shift', 'fs_step', 'fs_rush', 'fs_close', 'fs_flamekick', 'fs_dance',
    'fs_dragon', 'fs_burn', 'fs_awaken', 'fs_dual', 'fs_whirl', 'fs_spin', 'fs_fire', 'fs_descent', 'fs_cannon', 'fs_awaken2', 'fs_limit', 'fs_mortal', 'fs_awaken3'] };
// 指令（官方 DFO 指令表；强拳 →→+Space；闪击快打 / 飞燕旋风官方没有指令，只能用快捷栏）
CLASSES.fighter.cmds.push(['uf', 'fs_elbow'], ['uu', 'fs_sa', 'buff'], ['ff', 'fs_power', 'buff'], ['ff', 'fs_pusher'], ['fd', 'fs_bone'], ['bdf', 'fs_close'], ['buf', 'fs_flamekick'],
  ['bff', 'fs_dance'], ['uff', 'fs_dragon'], ['uudd', 'fs_awaken'], ['dduu', 'fs_dual'], ['fbuf', 'fs_spin'], ['fbf', 'fs_descent'], ['dff', 'fs_cannon'], ['duff', 'fs_awaken2'],
  ['udff', 'fs_mortal'], ['bufd', 'fs_awaken3']);
