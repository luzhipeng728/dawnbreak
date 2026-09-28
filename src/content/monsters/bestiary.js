/* =====================================================================
   28. 怪物图鉴：数值、攻击招式、AI 习性（治疗 / 逃跑 / 自爆 / 领主招式轮换）、异常状态与地面预警
   ===================================================================== */
/* ---- 额外姿势 ---- */
POSE.crouch = P(POSE.idle, { torso: -30, head: 22, thF: 70, shF: -100, ftF: 30, thB: -10, shB: -100, ftB: 70, uaF: 30, faF: 60, uaB: 20, faB: 60 });
POSE.leap = P(POSE.jumpUp, { torso: -40, head: 30, uaF: 110, faF: 10, uaB: 90, faB: 10, thF: 30, shF: -30, thB: -40, shB: -60 });
POSE.scratchW = P(POSE.idle, { torso: 5, uaF: 150, faF: 60, uaB: 120, faB: 50 });
POSE.scratchS = P(POSE.a1s, { torso: -30, uaF: 70, faF: 10, uaB: 40, faB: 20 });
POSE.chargeRun = P(POSE.runA, { torso: -55, head: 50, uaF: -20, faF: 30, uaB: -30, faB: 40 });
POSE.chargeRun2 = P(POSE.runC, { torso: -55, head: 50, uaF: -20, faF: 30, uaB: -30, faB: 40 });
POSE.roar = P(POSE.idle, { torso: 18, head: -30, uaF: 120, faF: 40, uaB: 110, faB: 40, thF: 30, shF: -30, thB: -30, shB: -20 });
POSE.slamW = P(POSE.idle, { torso: 15, head: -10, uaF: 190, faF: 30, uaB: 185, faB: 30 });
POSE.slamS = P(POSE.idle, { torso: -45, head: 35, uaF: 75, faF: -10, uaB: 65, faB: -10, thF: 50, shF: -60, thB: -40, shB: -30 });
POSE.cast = P(POSE.idle, { torso: 5, head: -8, uaF: 175, faF: 20, wF: -80, uaB: 60, faB: 60 });
POSE.cast2 = P(POSE.cast, { uaF: 165, faF: 30, uaB: 70 });
POSE.bite = P(POSE.idle, { torso: -40, head: 35, uaF: 60, faF: 40, uaB: 50, faB: 40 });
POSE.heal = P(POSE.idle, { torso: 0, head: -12, uaF: 150, faF: 30, uaB: 150, faB: 30 });
const BEAST_CLIPS = { ...GOB_CLIPS,
  pounce: { dur: 1.0, fps: 16, keys: [k(0, POSE.crouch, 'hold'), k(0.35, POSE.leap, 'hold'), k(0.85, POSE.land), k(1.0, POSE.idle)] },
  scratch: { dur: 0.7, fps: 18, keys: [k(0, POSE.scratchW, 'hold'), k(0.3, POSE.scratchS, 'out'), k(0.7, POSE.idle)] },
  axe: { dur: 1.25, fps: 14, keys: [k(0, POSE.idle), k(0.15, POSE.a3w, 'hold'), k(0.62, POSE.a3s, 'out'), k(0.85, POSE.a3s), k(1.25, POSE.idle)] },
  chargeW: { dur: 0.8, fps: 10, keys: [k(0, POSE.crouch), k(0.4, P(POSE.crouch, { torso: -40 }))], loop: true },
  charge: { dur: 0.3, loop: true, fps: 14, keys: [k(0, POSE.chargeRun), k(0.15, POSE.chargeRun2)] },
  roar: { dur: 1.2, fps: 12, keys: [k(0, POSE.crouch, 'hold'), k(0.45, POSE.roar, 'hold'), k(1.2, POSE.idle)] },
  slam: { dur: 1.3, fps: 14, keys: [k(0, POSE.idle), k(0.15, POSE.slamW, 'hold'), k(0.7, POSE.slamS, 'out'), k(1.0, POSE.slamS), k(1.3, POSE.idle)] },
  cast: { dur: 0.6, loop: true, fps: 8, keys: [k(0, POSE.cast), k(0.3, POSE.cast2)] },
  bite: { dur: 0.8, fps: 14, keys: [k(0, POSE.idle), k(0.3, POSE.bite, 'out'), k(0.5, POSE.bite), k(0.8, POSE.idle)] },
  heal: { dur: 0.8, loop: true, fps: 8, keys: [k(0, POSE.heal), k(0.4, P(POSE.heal, { uaF: 140, uaB: 160 }))] },
};
/* ---- 异常状态 ----
   addStatus(t, kind, dur, o)：o = { src, dps, force, amt, hitDmg }
   原有：burn 灼烧 / poison 中毒 / bleed 出血（持续伤害 dps）、freeze 冰冻、stun 眩晕、slow 减速、blind 失明
   新增（魔法师对齐组维护，接口见协作板）：
     shock   感电：持续期间每次受到攻击，额外受到一次光属性伤害 hitDmg（默认 = 施加者攻击力 × 0.1），同一目标每 0.1 秒最多触发一次
     curse   诅咒：受到的伤害 +amt（默认 10%，相当于降低防御），自己造成的伤害 −amt
     sleep   睡眠：不能行动；受到攻击时醒来，唤醒的这一击伤害 ×1.5
     root    定身：不能移动、不能行动；能被打，但不会被击退 / 浮空 / 倒地（领主改为减速）
     bind    束缚：不能移动，但还能攻击（领主改为减速）
     taunt   挑衅：怪物的攻击目标强制切到施加者 src
     confuse 混乱：怪物乱走、不出招；玩家方向键反转（player.js 读 statusConfused(e)）
   免疫：t.statusImmune = { kind: true }；受击前钩子返回 noStatus 时，同一帧内不附加任何状态 */
const STATUS_COL = { burn: '#ff7a2a', poison: '#b05aff', bleed: '#e02a2a', freeze: '#8ae0ff', stun: '#ffe070', slow: '#6ab0ff', blind: '#202030',
  shock: '#fff38a', curse: '#9a4ad0', sleep: '#a8b0ff', root: '#d0a060', bind: '#7aa05a', taunt: '#ff5a3a', confuse: '#ff8ae0' };
const STATUS_NAME = { burn: '灼烧', poison: '中毒', bleed: '出血', freeze: '冰冻', stun: '眩晕', slow: '减速', blind: '失明',
  shock: '感电', curse: '诅咒', sleep: '睡眠', root: '定身', bind: '束缚', taunt: '挑衅', confuse: '混乱' };
const STATUS_HARD = { stun: 1, freeze: 1, sleep: 1, root: 1 };   // 硬控：不能行动（进入 hit 状态）
function addStatus(t, kind, dur, o = {}) {
  if (t.dead || t.invul > 0 || t.remove) return;
  if (t.statusImmune && t.statusImmune[kind]) return;
  if (t._noStatusT === game.t && !o.force) return;   // 受击前钩子 noStatus：这一帧不附加状态
  if ((kind === 'root' || kind === 'bind') && t.boss && !o.force) kind = 'slow';   // 领主：定身 / 束缚改为减速
  const sa = t.superArmor > 0 || (t.act && t.act.superArmor), hard = !!STATUS_HARD[kind];
  if (hard && (t.boss || sa) && !o.force) dur *= 0.3;
  t.status = t.status || {};
  const cur = t.status[kind];
  t.status[kind] = { t: Math.max(dur, cur ? cur.t : 0), dps: Math.max(o.dps || 0, cur ? cur.dps : 0), src: o.src || (cur && cur.src) || null, tick: cur ? cur.tick : 0.5,
    amt: o.amt ?? (cur ? cur.amt : undefined), hitDmg: Math.max(o.hitDmg || 0, cur ? cur.hitDmg || 0 : 0) };
  // 硬控：霸体动作中不打断（除非强制），浮空 / 倒地时等落地再生效
  if (hard && (!sa || o.force) && t.st !== 'air' && t.st !== 'down' && t.z <= 2) { if (t.act) { const a = t.act; t.act = null; if (a.onEnd) a.onEnd(t, true); } t.setState('hit'); t.stun = dur; t.vx *= 0.3; }
  if (kind === 'root' || kind === 'bind') { t.vx = t.vy = 0; }
  if (!cur) fxText(STATUS_NAME[kind], t.x, t.y, t.z + 20, { col: STATUS_COL[kind], size: 10, dur: 0.8 });
}
function hasStatus(t, k) { return !!(t && t.status && t.status[k]); }
const statusNoMove = e => hasStatus(e, 'root') || hasStatus(e, 'bind');   // 不能移动（player.js / 怪物 AI 读取）
const statusConfused = e => hasStatus(e, 'confuse');                      // 方向键反转（player.js 读取）
// 定身：受击只掉血，不击退 / 不浮空 / 不倒地（applyHit 跳过 react）。想让“定身后接一记击飞 / 击倒”生效，要先 delete t.status.root 再打
function statusRooted(e) { return hasStatus(e, 'root') && !e.boss; }
// 伤害修正（applyHit 调用）：受到的（诅咒 +、睡眠唤醒 ×1.5）× 造成的（诅咒 −）
function statusDmgMul(a, t) {
  let m = 1; const S = t.status, A = a && a.status;
  if (S) { if (S.curse) m *= 1 + (S.curse.amt ?? 0.1); if (S.sleep) m *= 1.5; }
  if (A && A.curse) m *= 1 - (A.curse.amt ?? 0.1);
  return m;
}
// 受击后（applyHit 调用）：感电追加伤害、睡眠被打醒
function statusOnHit(t, a, dmg, h) {
  const S = t.status; if (!S || t.dead) return;
  if (S.sleep) { delete S.sleep; if (t.st === 'hit') t.stun = Math.min(t.stun, 0.25); fxText('醒了！', t.x, t.y, t.z + 24, { col: STATUS_COL.sleep, size: 10, dur: 0.6 }); }
  if (S.shock && !h.shockProc && game.t - (t._shockT || -9) >= 0.1) {
    t._shockT = game.t; const src = S.shock.src || a;
    const x = Math.max(1, Math.round(S.shock.hitDmg || (src ? atkOf(src, 'mag') * 0.1 : dmg * 0.1)));
    t.hp -= x; addNumber(x, t.x, t.y, t.z + 10, { player: t.team === 'p' && !t.summon, col: STATUS_COL.shock });
    if (Math.random() < 0.5) fxSpr('spark', t.x + rnd(-8, 8), t.y + 1, t.z + t.h * 0.6, { w: 30, dur: 0.15 });
    if (t.hp <= 0 && !t.dead) { t.hp = 0; killEnt(t, src || t, {}); }
  }
}
// 挑衅：怪物 AI 的目标
const tauntSrc = m => { const s = m.status && m.status.taunt && m.status.taunt.src; return s && !s.dead && !s.remove ? s : null; };
function updateStatus(t, dt) {
  const S = t.status; if (!S) return;
  for (const k in S) {
    const s = S[k]; s.t -= dt;
    if (s.dps) { s.tick -= dt; if (s.tick <= 0) { s.tick = 0.5; const dmg = Math.max(1, Math.round(s.dps * 0.5)); t.hp -= dmg; addNumber(dmg, t.x, t.y, t.z, { player: t.team === 'p' && !t.summon, col: STATUS_COL[k] }); if (t.hp <= 0 && !t.dead) { t.hp = 0; killEnt(t, s.src || t, {}); return; } } }
    if (STATUS_HARD[k]) {
      const sa = t.superArmor > 0 || (t.act && t.act.superArmor);
      if (t.st !== 'hit' && t.st !== 'air' && t.st !== 'down' && t.st !== 'getup' && t.st !== 'held' && !sa) { if (t.act) { const a = t.act; t.act = null; if (a.onEnd) a.onEnd(t, true); } t.setState('hit'); t.stun = s.t; }
      if (t.st === 'hit' && t.stun < s.t && (k === 'root' || k === 'sleep')) t.stun = Math.min(s.t, t.stun + dt * 2);
      if ((k === 'freeze' || k === 'sleep' || k === 'root') && t.st === 'hit') t.animT -= dt;
    }
    if ((k === 'root' || k === 'bind') && t.z <= 2) { t.vx = 0; t.vy = 0; }
    if ((k === 'burn' || k === 'poison' || k === 'bleed') && Math.random() < dt * 18) {
      addFx({ x: t.x + rnd(-t.w, t.w), y: t.y + 1, z: t.z + rnd(10, t.h * 0.8), vz: k === 'bleed' ? -30 : 40, dur: 0.5, col: STATUS_COL[k], update(dt) { this.z += this.vz * dt; }, draw(cc) { const kk = this.t / this.dur; cc.fillStyle = shade(this.col, 0.2, 0.8 * (1 - kk)); cc.beginPath(); cc.arc(sx(this.x), sy(this.y, this.z), 2.2 * (1 - kk * 0.5), 0, TAU); cc.fill(); } });
    }
    if (s.t <= 0) { delete S[k]; if (STATUS_HARD[k] && t.st === 'hit' && !Object.keys(S).some(q => STATUS_HARD[q])) t.stun = Math.min(t.stun, 0.05); }
  }
}
function drawStatus(c, t) {
  const S = t.status; if (!S) return;
  const X = sx(t.x), top = sy(t.y, t.z + t.h * (t.scale || 1) + 6);
  if (S.stun) { for (let i = 0; i < 3; i++) { const a = game.t * 5 + i * TAU / 3; c.fillStyle = '#ffe070'; c.font = 'bold 9px sans-serif'; c.textAlign = 'center'; c.fillText('★', X + Math.cos(a) * 10, top + Math.sin(a) * 3); } }
  if (S.freeze) { c.save(); c.globalAlpha = 0.55; c.fillStyle = '#bfefff'; c.strokeStyle = '#ffffff'; c.lineWidth = 1; const w = t.w * 1.6, hh = t.h * (t.scale || 1) * 0.9, y0 = sy(t.y, t.z); c.beginPath(); c.moveTo(X - w, y0); c.lineTo(X - w * 0.8, y0 - hh * 0.8); c.lineTo(X - w * 0.2, y0 - hh); c.lineTo(X + w * 0.7, y0 - hh * 0.85); c.lineTo(X + w, y0 - hh * 0.2); c.lineTo(X + w * 0.9, y0); c.closePath(); c.fill(); c.stroke(); c.restore(); }
  if (S.slow) { c.strokeStyle = 'rgba(100,170,255,.5)'; c.lineWidth = 1; c.beginPath(); c.ellipse(X, sy(t.y, 0), 14 + Math.sin(game.t * 6) * 2, 4, 0, 0, TAU); c.stroke(); }
  if (S.sleep) { c.fillStyle = '#c8d0ff'; c.font = 'bold 10px sans-serif'; c.textAlign = 'center'; for (let i = 0; i < 2; i++) { const q = (game.t * 0.8 + i * 0.5) % 1; c.globalAlpha = 1 - q; c.fillText('Z', X + 6 + q * 10, top - q * 14); } c.globalAlpha = 1; }
  if (S.shock && Math.floor(game.t * 12) % 3 === 0) { c.strokeStyle = '#fff38a'; c.lineWidth = 1.5; const y0 = sy(t.y, t.z + t.h * 0.5), w = t.w * 1.4; c.beginPath(); c.moveTo(X - w, y0 - 6); c.lineTo(X - 2, y0 + 4); c.lineTo(X + 3, y0 - 8); c.lineTo(X + w, y0 + 2); c.stroke(); }
  if (S.curse) { c.fillStyle = 'rgba(120,40,170,.55)'; for (let i = 0; i < 3; i++) { const a = game.t * 2 + i * TAU / 3; c.beginPath(); c.arc(X + Math.cos(a) * 11, top + 4 + Math.sin(a) * 3, 2.5, 0, TAU); c.fill(); } }
  if (S.root || S.bind) { c.strokeStyle = S.root ? 'rgba(210,160,90,.8)' : 'rgba(122,160,90,.8)'; c.lineWidth = 2; const Y0 = sy(t.y, 0); for (let i = -1; i <= 1; i++) { c.beginPath(); c.moveTo(X + i * 8, Y0); c.quadraticCurveTo(X + i * 12, Y0 - 12, X + i * 4, Y0 - 22); c.stroke(); } }
  if (S.taunt) { c.fillStyle = '#ff5a3a'; c.font = 'bold 12px sans-serif'; c.textAlign = 'center'; c.fillText('!', X, top - 6 + Math.sin(game.t * 10) * 2); }
  if (S.confuse) { c.fillStyle = '#ff8ae0'; c.font = 'bold 10px sans-serif'; c.textAlign = 'center'; for (let i = 0; i < 2; i++) { const a = game.t * 4 + i * Math.PI; c.fillText('?', X + Math.cos(a) * 10, top + Math.sin(a) * 3); } }
}
// 失明：视野只剩角色周围一小圈
function drawBlind(c) {
  const p = game.player; if (!p || !p.status || !p.status.blind) return;
  const a = Math.min(1, p.status.blind.t * 2), X = sx(p.x), Y = sy(p.y, p.z + 45);
  const g = c.createRadialGradient(X, Y, 50, X, Y, 170); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(4,2,10,${0.93 * a})`);
  c.fillStyle = g; c.fillRect(0, 0, WW, WH);
}
// 蓄力中被打出足够伤害 → 破招：取消动作并长时间硬直
function breakAct(t) {
  const ac = t.act; t.act = null; if (ac && ac.onEnd) ac.onEnd(t, true);
  t.superArmor = 0; t.breakDmg = 0; t.vx = 0; t.invul = 0;
  fxText('BREAK!', t.x, t.y, t.z + 40, { col: '#ffd23a', size: 18, dur: 1.2 }); cam.shake = Math.max(cam.shake, 6); sfx.boom(0.8); sfx.hit('crit', true);
  addStatus(t, 'stun', 3.2, { force: true }); fxBurst(t.x, t.y, t.z + t.h * 0.6, 220, '#ffd23a');
  if (game.dungeon) game.dungeon.counter += 3;
}
const killTele = g => { const i = groundFx.indexOf(g); if (i >= 0) groundFx.splice(i, 1); };
/* ---- 地面预警：到时间后执行回调（落雷黄圈、陨石六芒星、白霜等） ---- */
const groundFx = [];
function telegraph(o) { const g = { t: 0, dur: 1, r: 30, col: '#ffe070', kind: 'circle', ...o }; groundFx.push(g); return g; }
function updateGroundFx(dt) { for (let i = groundFx.length - 1; i >= 0; i--) { const g = groundFx[i]; g.t += dt; if (g.follow && g.t < g.dur * 0.35) { g.x = damp(g.x, g.follow.x, 3, dt); g.y = damp(g.y, g.follow.y, 3, dt); } if (g.t >= g.dur) { groundFx.splice(i, 1); if (g.fire) g.fire(g); } } }
function drawGroundFx(c) {
  for (const g of groundFx) {
    const k = g.t / g.dur, X = sx(g.x), Y = sy(g.y, 0), R = g.r, blink = Math.floor(g.t * (6 + k * 14)) % 2, pulse = 0.55 + 0.35 * blink;
    if (g.kind === 'line') {   // 冲撞路线：半透明带子 + 流动的箭头
      c.save(); c.globalCompositeOperation = 'lighter'; c.strokeStyle = shade(g.col, 0, 0.5 + 0.4 * blink); c.fillStyle = shade(g.col, 0, 0.1 + 0.25 * k); c.lineWidth = 1.5;
      const hw = g.hw || 10, x0 = Math.min(X, X + g.len * g.face); c.fillRect(x0, Y - hw, Math.abs(g.len), hw * 2); c.strokeRect(x0, Y - hw, Math.abs(g.len), hw * 2);
      c.fillStyle = shade(g.col, 0.2, 0.35 + 0.3 * blink); const dir = Math.sign(g.len * g.face) || 1;
      for (let ax = 40; ax < Math.abs(g.len) - 20; ax += 70) { const px = X + dir * ((ax + g.t * 160) % Math.max(60, Math.abs(g.len) - 20)); c.beginPath(); c.moveTo(px, Y - hw * 0.6); c.lineTo(px + dir * 18, Y); c.lineTo(px, Y + hw * 0.6); c.closePath(); c.fill(); }
      c.restore(); continue;
    }
    // 圆形预警：法阵素材（按颜色换色）平铺在地面上缓慢旋转，内圈随时间收缩到中心 = 快要落下
    if (!g.img) g.img = fxTint(g.kind === 'hex' ? 'hexagram' : 'rune', g.kind === 'frost' ? '#bfefff' : g.col);
    c.save(); c.translate(X, Y); c.scale(1, GR); c.rotate(g.t * (g.kind === 'hex' ? 0.8 : 0.5));
    c.globalCompositeOperation = 'lighter'; c.globalAlpha = Math.min(1, g.t * 6) * pulse;
    if (g.img) c.drawImage(g.img, -R, -R, R * 2, R * 2);
    c.globalAlpha = 0.25 + 0.3 * k; c.fillStyle = g.kind === 'frost' ? '#dff6ff' : g.col; c.beginPath(); c.arc(0, 0, R * (1 - k), 0, TAU); c.fill();
    c.restore();
    if (g.kind === 'frost') { c.save(); c.globalAlpha = 0.25 + 0.4 * k; drawSpr(c, 'frost', X, Y, R * 2.1, 0, { ay: 0.7, alpha: 0.3 + 0.5 * k }); c.restore(); }
    // 陨石：落地前 0.45 秒从左上方砸下来
    if (g.kind === 'hex' && !g.friendly && g.t > g.dur - 0.45) { const f = 1 - (g.dur - g.t) / 0.45; drawSpr(c, 'meteor', X - 200 * (1 - f), Y - 440 * (1 - f), 110, 0, { ax: 0.8, ay: 0.82 }); }
  }
}
// 在某个位置立即对玩家造成伤害（预警结束后的落雷 / 陨石 / 冲击波）
const GR = 0.45;   // 地面圆形在屏幕上的纵向压缩比（绘制与判定共用）
const inGround = (t, x, y, r) => Math.hypot(t.x - x, (t.y - y) / GR) < r + t.w;
function areaHit(owner, x, y, r, z, h, o = {}) {
  const fake = { x: x - owner.face * 10, y, z, face: owner.face };
  for (const t of ents) if (t.team !== owner.team && !t.dead && t.invul <= 0 && !t.remove && inGround(t, x, y, r) && t.z < z + (o.zMax ?? 30) && (t.st !== 'down' || h.downHit)) { applyHit(owner, t, { ...h, box: null }, { proj: true, src: fake }); if (o.status) addStatus(t, o.status, o.sdur || 2, { dps: o.dps ? owner.atk * o.dps : 0, src: owner }); }
}
function lightningStrike(g) {
  cam.shake = Math.max(cam.shake, 3); sfx.boom(0.4); sfx.hit('crit', false);
  // 落雷：从天而降的闪电素材 + 落点爆闪
  addFx({ x: g.x, y: g.y + 2, z: 0, dur: 0.3, add: true, flip: Math.random() < 0.5, draw(c) {
    const k = this.t / this.dur, X = sx(this.x), Y = sy(this.y, 0), a = k < 0.15 ? 1 : 1 - (k - 0.15) / 0.85;
    drawSpr(c, 'lightning', X, Y + 6, 54, Y + 20, { ay: 1, flip: this.flip !== (Math.floor(this.t * 40) % 2 === 1), alpha: a });
    drawSpr(c, 'spark', X, Y - 6, 70 * (0.6 + k), 0, { alpha: a });
  } });
  fxShock(g.x, g.y, 45, '#fff6a0');
}
function meteorImpact(g, s = 1) {
  cam.shake = Math.max(cam.shake, 7 * s); sfx.boom(s); fxDust(g.x, g.y, Math.round(10 * s), 30 * s, '#6a4a3a');
  // 爆炸：火球爆裂素材 + 地面冲击环
  addFx({ x: g.x, y: g.y + 2, z: 0, dur: 0.55, add: true, s, rot: rnd(-0.3, 0.3), draw(c) {
    const k = this.t / this.dur, w = 150 * this.s * (0.55 + easeOut(k) * 0.6);
    drawSpr(c, 'explosion', sx(this.x), sy(this.y, 0) - w * 0.32, w, 0, { rot: this.rot, alpha: 1 - k * k });
  } });
  fxShock(g.x, g.y, 120 * s, '#ffa050');
}
const aliveAdds = () => ents.filter(e => e.team === 'e' && !e.dead && !e.boss).length;
/* ---- 投射物工厂 ---- */
function shootStraight(e, o) {
  const p = game.player; const dir = e.face; sfx.swing(false);
  spawnProj({ owner: e, x: e.x + dir * 16, y: e.y, z: o.z || 55, vx: dir * (o.speed || 300), vy: p ? clamp((p.y - e.y) * 1.2, -60, 60) : 0, life: o.life || 1.6, w: 8, d: 10, h: 12, face: dir, pierce: !!o.pierce, shadow: 5,
    hit: { dmg: (o.dmg || 1) * (o.explode ? 0.4 : 1), stun: 0.3, knock: 80, hs: 0.05, snd: o.snd || 'blunt', onHit: o.status && !o.explode ? (a, t) => addStatus(t, o.status, 3, { src: a }) : null }, spin: 0,
    update(pr, dt) { pr.spin += dt * 10; if (o.trail && Math.random() < 0.6) addFx({ x: pr.x, y: pr.y + 0.5, z: pr.z, dur: 0.3, col: o.col, draw(c) { const k = this.t / this.dur; c.fillStyle = shade(this.col, 0.2, 0.6 * (1 - k)); c.beginPath(); c.arc(sx(this.x), sy(this.y, this.z), 3 * (1 - k), 0, TAU); c.fill(); } }); },
    onEnd(pr) { if (o.explode) { areaHit(e, pr.x, pr.y, o.explode, 0, { dmg: o.dmg, down: true, knock: 150, hs: 0.06, snd: 'fire' }, { status: o.status, sdur: 3, dps: 0.12 }); meteorImpact({ x: pr.x, y: pr.y }, 0.5); } },
    spr: o.status === 'burn' || o.explode ? 'fireball' : o.status === 'slow' ? 'icespike' : o.status === 'blind' ? fxTint('orb', '#7a3aff') : 'rock',
    draw(c, pr) { const X = sx(pr.x), Y = sy(pr.y, pr.z);
      if (pr.spr === 'rock') drawSpr(c, 'rock', X, Y, 16, 16, { add: false, rot: pr.spin });
      else if (typeof pr.spr !== 'string') drawSpr(c, pr.spr, X, Y, 26, 26, { rot: pr.spin });
      else drawSpr(c, pr.spr, X, Y, pr.spr === 'fireball' ? 58 : 50, 0, { ax: 0.72, flip: pr.face < 0 }); } });
}
/* ---- 通用攻击定义工厂 ---- */
const melee = (clip, t0, t1, box, o = {}) => ({ clip, act: { dur: BEAST_CLIPS[clip].dur, hits: [{ t0, t1, box, dmg: 1, stun: 0.4, knock: 120, hs: 0.07, snd: 'blunt', shake: 2, ...o.hit }], events: [...(o.noSwing ? [] : [evAt(Math.max(0, t0 - 0.06), () => sfx.swing(true))]), ...(o.events || [])], superArmor: o.sa }, range: o.range || [0, box[1]], dy: o.dy || 16, cd: o.cd || [1.8, 3], w: o.w || 1, cond: o.cond });

/* ---- 怪物表 ---- */
Object.assign(MON, {
  goblinBlue: { name: '青哥布林', lvl: 4, hp: 2400, atk: 200, def: 110, w: 11, d: 11, h: 72, weight: 0.8, speed: 85, exp: 40, gold: [8, 22], shadowR: 15, pref: 170, clips: BEAST_CLIPS,
    model: () => buildGoblinVariant({ ...PAL_GOB, skin: '#4a8ab0', skin2: '#3a6a8a', band: '#e8e8f0' }, { weapon: 'none' }),
    attacks: [{ clip: 'throw', range: [90, 330], dy: 30, cd: [2.2, 3.4], act: { dur: 0.9, events: [evAt(0.45, e => shootStraight(e, { col: '#bfefff', dmg: 1, status: 'slow', speed: 320, pierce: true, glow: true }))] } }] },
  goblinRed: { name: '赤哥布林', lvl: 5, hp: 2400, atk: 210, def: 110, w: 11, d: 11, h: 72, weight: 0.8, speed: 85, exp: 42, gold: [8, 22], shadowR: 15, pref: 170, clips: BEAST_CLIPS,
    model: () => buildGoblinVariant({ ...PAL_GOB, skin: '#c85a3a', skin2: '#9a3a2a', band: '#2a2a2a' }, { weapon: 'none' }),
    attacks: [{ clip: 'throw', range: [90, 330], dy: 30, cd: [2.4, 3.6], act: { dur: 0.9, events: [evAt(0.45, e => shootStraight(e, { col: '#ff8a3a', dmg: 1.1, status: 'burn', speed: 280, explode: 26, trail: true, glow: true }))] } }] },
  goblinCaptain: { name: '哥布林十夫长', lvl: 3, hp: 4200, atk: 210, def: 160, w: 12, d: 11, h: 76, weight: 0.9, speed: 120, exp: 60, gold: [15, 35], shadowR: 16, pref: 45, clips: BEAST_CLIPS, scale: 1.08,
    model: () => buildGoblinVariant({ ...PAL_GOB, skin: '#5a8a3a', band: null }, { helmet: true, weapon: 'sword' }),
    attacks: [
      { clip: 'atk1', range: [0, 60], dy: 16, cd: [1.2, 2.2], act: { dur: 0.7, hits: [{ t0: 0.08, t1: 0.14, box: [0, 60, 22, 10, 70], dmg: 0.9, stun: 0.35, knock: 70, hs: 0.06 }, { t0: 0.4, t1: 0.46, box: [0, 60, 22, 10, 70], dmg: 1, stun: 0.4, knock: 140, hs: 0.07 }], events: [slashAt(0.07, { a0: -2.3, a1: 0.6, r: 40, w: 10, off: [10, 40], col: '#ffffff' }), evAt(0.35, e => { e.play('atk2', true); }), slashAt(0.38, { a0: 1.0, a1: -2.0, r: 40, w: 10, off: [10, 40], col: '#ffffff' })] } },
      { clip: 'roar', range: [0, 400], dy: 400, cd: [9, 14], w: 0.4, act: { dur: 1.2, superArmor: true, events: [evAt(0.5, e => { sfx.boom(0.3); fxText('冲啊！', e.x, e.y, e.z + 10, { col: '#ffb040', size: 11 }); for (const o of ents) if (o.team === 'e' && !o.dead && Math.abs(o.x - e.x) < 300) { o.buffs = o.buffs || {}; o.speed = (o.def_.speed || 90) * 1.5; o.aiCd = Math.min(o.aiCd, 0.3); game.after(5, () => { if (!o.dead) o.speed = (o.def_.speed || 90) * (o.enraged ? 1.2 : 1); }); } })] } }] },
  goblinCoward: { name: '胆小哥布林', lvl: 9, hp: 1800, atk: 150, def: 80, w: 10, d: 10, h: 66, weight: 0.7, speed: 130, exp: 120, gold: [20, 40], shadowR: 14, pref: 260, clips: BEAST_CLIPS, scale: 0.9, coward: true,
    model: () => buildGoblinVariant({ ...PAL_GOB, skin: '#a0b060', band: '#ffd23a' }, { weapon: 'none' }), attacks: [] },
  goblinBomber: { name: '自爆哥布林', lvl: 12, hp: 2200, atk: 220, def: 90, w: 11, d: 11, h: 72, weight: 0.8, speed: 150, exp: 70, gold: [10, 25], shadowR: 15, pref: 10, clips: BEAST_CLIPS,
    model: () => buildGoblinVariant({ ...PAL_GOB, skin: '#6a5a4a', skin2: '#4a3a2a', band: '#ff6a2a' }, { weapon: 'bomb' }),
    attacks: [{ clip: 'throw', range: [0, 40], dy: 20, cd: [0.2, 0.4], act: { dur: 1.05, superArmor: true, update: e => { e.flash = Math.floor(e.actT * (8 + e.actT * 14)) % 2 ? 0.05 : 0; }, events: [evAt(0.02, e => { telegraph({ x: e.x, y: e.y, r: 56, dur: 0.88, col: '#ff5a2a' }); }), evAt(0.9, e => { areaHit(e, e.x, e.y, 56, 0, { dmg: 1.6, down: true, knock: 220, hs: 0.1, snd: 'fire', shake: 5 }, { status: 'burn', sdur: 3, dps: 0.1 }); meteorImpact({ x: e.x, y: e.y }, 0.7); e.hp = 0; e.noLoot = true; killEnt(e, e, {}); })] } },
      { clip: 'throw', range: [120, 300], dy: 30, cd: [3, 4.5], act: { dur: 0.9, events: [evAt(0.45, e => { const p = game.player; if (!p) return; const T = 0.9; spawnProj({ owner: e, x: e.x, y: e.y, z: 60, vx: (p.x - e.x) / T, vy: (p.y - e.y) / T, vz: 200, grav: (60 + 200 * T) * 2 / (T * T), life: 3, w: 8, d: 10, h: 12, face: e.face, pierce: false, shadow: 6, hit: { dmg: 0.5, stun: 0.2, knock: 40, hs: 0.03 }, onEnd(pr) { areaHit(e, pr.x, pr.y, 40, 0, { dmg: 1.4, down: true, knock: 160, hs: 0.07, snd: 'fire', shake: 4 }, { status: 'burn', sdur: 2, dps: 0.1 }); meteorImpact(pr, 0.5); }, draw(c, pr) { drawSpr(c, 'bomb', sx(pr.x), sy(pr.y, pr.z), 0, 18, { add: false, rot: pr.t * 8 }); } }); })] } }] },
  goblinChief: { name: '投掷哥布林首领', lvl: 3, hp: 30000, atk: 260, def: 200, w: 16, d: 14, h: 100, weight: 2.5, speed: 90, exp: 400, gold: [60, 120], shadowR: 24, pref: 160, clips: BEAST_CLIPS, scale: 1.45, bars: 8,
    model: () => buildGoblinVariant({ ...PAL_GOB, skin: '#5a7a3a', skin2: '#3a5a2a', band: '#ffd23a' }, { weapon: 'none', helmet: true }),
    attacks: [
      { clip: 'throw', range: [60, 380], dy: 60, cd: [2.4, 3.4], w: 2, act: { dur: 1.1, events: [0.45, 0.75].map(t => evAt(t, e => throwRock(e)))} },
      melee('slam', 0.7, 0.8, [-20, 80, 34, 0, 80], { range: [0, 70], cd: [3, 5], sa: true, hit: { dmg: 1.6, down: true, knock: 200, shake: 5 }, events: [evAt(0.7, e => { fxDust(e.x + e.face * 40, e.y, 10, 30); sfx.boom(0.6); })] }),
      { clip: 'roar', range: [0, 600], dy: 600, cd: [12, 16], w: 0.6, act: { dur: 1.2, superArmor: true, events: [evAt(0.5, e => { sfx.boom(0.3); fxText('小的们，上！', e.x, e.y, e.z + 30, { col: '#ffb040', size: 12 }); for (let i = 0; i < 2 && aliveAdds() < 4; i++) spawnMonster(pick(['goblin', 'goblinThrower']), cam.x + rnd(100, WW - 100), rnd(20, DEPTH - 20), { lvl: e.lvl, drop: true, mul: game.dungeon ? game.dungeon.D.hp : 1 }); })] } }] },
  tauSoldier: { name: '牛头兵', lvl: 5, hp: 7000, atk: 220, def: 260, w: 16, d: 13, h: 118, weight: 1.8, speed: 80, exp: 90, gold: [20, 40], shadowR: 22, pref: 60, clips: BEAST_CLIPS,
    model: () => buildTau({ fur: '#7a4a2a', muzzle: '#c8a080', horn: '#e8dcc0', eye: '#ff4a2a', cloth: '#5a4a3a' }),
    attacks: [
      melee('axe', 0.62, 0.72, [0, 92, 30, 0, 120], { range: [0, 85], cd: [2, 3.2], sa: true, hit: { dmg: 1.4, knock: 180, stun: 0.5, shake: 4 } }),
      { clip: 'chargeW', range: [150, 420], dy: 20, cd: [5, 8], w: 0.8, act: tauCharge(1.2) }] },
  tauSoldierBoss: { name: '牛头兵首领', lvl: 5, hp: 42000, atk: 270, def: 300, w: 18, d: 14, h: 128, weight: 3, speed: 95, exp: 700, gold: [90, 160], shadowR: 26, pref: 70, clips: BEAST_CLIPS, scale: 1.15, bars: 10,
    model: () => buildTau({ fur: '#6a3a24', muzzle: '#c8a080', horn: '#fff4e0', eye: '#ff2a1a', cloth: '#3a2a4a' }, { armor: '#8a8e96' }),
    attacks: [
      melee('axe', 0.62, 0.72, [0, 100, 32, 0, 130], { range: [0, 90], cd: [1.8, 2.8], sa: true, w: 2, hit: { dmg: 1.5, knock: 200, stun: 0.5, shake: 5 } }),
      { clip: 'chargeW', range: [120, 520], dy: 30, cd: [4, 6], w: 1.2, act: tauCharge(1.5) },
      melee('roar', 0.5, 0.6, [-90, 90, 70, 0, 150], { range: [0, 100], cd: [9, 12], sa: true, w: 0.7, noSwing: true, hit: { dmg: 0.4, stun: 0, knock: 60 }, events: [evAt(0.5, e => { sfx.boom(0.5); cam.shake = 5; for (const t of ents) if (t.team === 'p' && Math.abs(t.x - e.x) < 110 && Math.abs(t.y - e.y) < 70) addStatus(t, 'stun', 0.8); })] })] },
  tauBeast: { name: '牛头巨兽', lvl: 8, hp: 14000, atk: 240, def: 320, w: 20, d: 15, h: 140, weight: 3, speed: 60, exp: 160, gold: [30, 60], shadowR: 28, pref: 70, clips: BEAST_CLIPS, scale: 1.3,
    model: () => buildTau({ fur: '#5a3a2a', muzzle: '#a88a70', horn: '#d8ccb0', eye: '#ffb030', cloth: '#4a3a2a' }, { weapon: 'none' }),
    attacks: [
      melee('slam', 0.7, 0.8, [-30, 110, 40, 0, 90], { range: [0, 95], cd: [2.4, 3.6], sa: true, hit: { dmg: 1.8, down: true, knock: 220, shake: 6 }, events: [evAt(0.7, e => { fxDust(e.x + e.face * 50, e.y, 12, 36); sfx.boom(0.7); })] }),
      melee('roar', 0.5, 0.6, [-100, 100, 80, 0, 150], { range: [0, 160], cd: [8, 12], sa: true, w: 0.6, noSwing: true, hit: { dmg: 0.3, stun: 0, knock: 40 }, events: [evAt(0.5, e => { sfx.boom(0.5); cam.shake = 5; for (const t of ents) if (t.team === 'p' && Math.abs(t.x - e.x) < 140 && Math.abs(t.y - e.y) < 80) addStatus(t, 'stun', 0.9); })] })] },
  tauKing: { name: '牛头王 萨乌塔', lvl: 16, hp: 120000, atk: 300, def: 520, w: 22, d: 16, h: 150, weight: 4, speed: 100, exp: 2400, gold: [200, 400], shadowR: 30, pref: 80, clips: BEAST_CLIPS, scale: 1.4, bars: 22,
    model: () => buildTau({ fur: '#4a2a1a', muzzle: '#b89a80', horn: '#fff8e8', eye: '#ff2a1a', cloth: '#6a1a1a' }, { armor: '#c8a040', crown: true, big: true }),
    attacks: [
      melee('axe', 0.62, 0.72, [0, 120, 34, 0, 140], { range: [0, 110], cd: [1.8, 2.8], sa: true, w: 2, hit: { dmg: 1.6, knock: 220, stun: 0.55, shake: 6 } }),
      { clip: 'chargeW', range: [140, 700], dy: 40, cd: [4, 6], w: 1.2, act: tauCharge(1.7, true) },
      { clip: 'slam', range: [0, 500], dy: 500, cd: [10, 14], w: 1, act: { dur: 3.1, superArmor: true, breakable: 0.05, noCounter: true,
        onStart: e => { e.animT = 0; e.breakDmg = 0; sfx.charge(); fxText('蓄力中！', e.x, e.y, e.z + 60, { col: '#ff6a3a', size: 13 }); e.quakeT = telegraph({ x: e.x + e.face * 130, y: e.y, r: 135, dur: 2.4, col: '#ff5a2a' }); },
        onEnd: e => { if (e.quakeT) killTele(e.quakeT); e.quakeT = null; },
        update: (e, dt) => { if (e.actT < 2.32) e.animT = Math.min(e.animT, 0.62); else if (e.act.breakable) e.act.breakable = 0; },
        events: [evAt(2.4, e => { cam.shake = 12; sfx.boom(1.4); fxShock(e.x + e.face * 130, e.y, 135); fxDust(e.x + e.face * 130, e.y, 24, 130, '#8a6a4a'); areaHit(e, e.x + e.face * 130, e.y, 135, 0, { dmg: 2.0, down: true, knock: 260, hs: 0.12, shake: 8 }); })] } }] },
  catDemon: { name: '猫妖', lvl: 6, hp: 3600, atk: 200, def: 150, w: 11, d: 11, h: 86, weight: 0.8, speed: 150, exp: 60, gold: [12, 28], shadowR: 15, pref: 60, clips: BEAST_CLIPS,
    model: () => buildCat({ fur: '#8a7a9a', belly: '#d8c8e0', ear: '#e8a0b0', eye: '#ffd23a', cloth: '#4a2a4a' }),
    attacks: [
      melee('scratch', 0.3, 0.38, [0, 56, 22, 10, 80], { range: [0, 55], cd: [1.2, 2.2], hit: { dmg: 0.9, knock: 70, stun: 0.3, snd: 'slash' }, events: [slashAt(0.29, { a0: -2.2, a1: 0.8, r: 30, w: 8, off: [8, 40], col: '#ffffff', silent: true })] }),
      { clip: 'pounce', range: [90, 240], dy: 30, cd: [2.4, 3.6], act: pounceAct(1.1) }] },
  catGlow: { name: '荧光猫妖', lvl: 7, hp: 3000, atk: 170, def: 130, w: 11, d: 11, h: 86, weight: 0.8, speed: 130, exp: 90, gold: [15, 30], shadowR: 15, pref: 160, clips: BEAST_CLIPS, healer: true,
    model: () => buildCat({ fur: '#5aaa7a', belly: '#c8f0d8', ear: '#9affc0', eye: '#9affb0', cloth: '#1a4a2a', eyeGlow: true }),
    attacks: [melee('scratch', 0.3, 0.38, [0, 56, 22, 10, 80], { range: [0, 55], cd: [1.5, 2.5], hit: { dmg: 0.8, knock: 60 } }),
      { clip: 'heal', range: [0, 999], dy: 999, cd: [6, 9], w: 3, cond: (m) => ents.some(o => o.team === 'e' && !o.dead && o !== m && !o.boss && o.hp < o.hpMax * 0.85), act: { dur: 1.6, superArmor: true, events: [evAt(0.8, e => { sfx.buff(); for (const o of ents) if (o.team === 'e' && !o.dead && !o.boss && Math.abs(o.x - e.x) < 320) { const hh = Math.round(o.hpMax * 0.12); o.hp = Math.min(o.hpMax, o.hp + hh); addNumber(hh, o.x, o.y, o.z, { heal: true }); addFx({ x: o.x, y: o.y + 1, z: 0, dur: 0.7, add: true, ent: o, draw(c) { const k = this.t / this.dur; drawSpr(c, 'heal', sx(this.ent.x), sy(this.ent.y, 0) + 4, 0, 110 * (0.6 + k * 0.5), { ay: 1, alpha: k < 0.2 ? k * 5 : 1 - (k - 0.2) / 0.8 }); } }); } })] } }] },
  catVenom: { name: '毒爪猫妖', lvl: 9, hp: 4200, atk: 210, def: 170, w: 11, d: 11, h: 86, weight: 0.8, speed: 160, exp: 90, gold: [15, 32], shadowR: 15, pref: 55, clips: BEAST_CLIPS,
    model: () => buildCat({ fur: '#6a4a8a', belly: '#c8a8e8', ear: '#d890ff', eye: '#c0ff60', cloth: '#2a1a3a' }),
    attacks: [melee('scratch', 0.3, 0.38, [0, 56, 22, 10, 80], { range: [0, 55], cd: [1.2, 2], hit: { dmg: 1, knock: 70, onHit: (a, t) => addStatus(t, 'poison', 4, { dps: a.atk * 0.08, src: a }) } }),
      { clip: 'pounce', range: [90, 260], dy: 30, cd: [2.2, 3.4], act: pounceAct(1.2, 'poison') }] },
  catKing: { name: '毒猫王', lvl: 13, hp: 90000, atk: 280, def: 380, w: 14, d: 12, h: 100, weight: 2, speed: 210, exp: 1800, gold: [160, 300], shadowR: 20, pref: 60, clips: BEAST_CLIPS, scale: 1.25, bars: 18,
    model: () => buildCat({ fur: '#4a2a6a', belly: '#b890e0', ear: '#ff80ff', eye: '#c0ff40', cloth: '#1a0a2a', eyeGlow: true }),
    onDamaged: (m, a, dmg, crit) => { if (!crit || (m.lastCloud && game.t - m.lastCloud < 4)) return; m.lastCloud = game.t; poisonCloud(m, m.x, m.y); },
    attacks: [
      melee('scratch', 0.3, 0.38, [0, 64, 24, 10, 90], { range: [0, 60], cd: [0.8, 1.4], w: 2, hit: { dmg: 1.1, knock: 80, onHit: (a, t) => addStatus(t, 'poison', 5, { dps: a.atk * 0.1, src: a }) } }),
      { clip: 'pounce', range: [80, 400], dy: 50, cd: [1.8, 2.8], w: 1.5, act: pounceAct(1.5, 'poison') },
      { clip: 'roar', range: [0, 120], dy: 60, cd: [6, 9], w: 0.8, act: { dur: 1.2, superArmor: true, events: [evAt(0.5, e => poisonCloud(e, e.x, e.y))] } }] },
  goblinShaman: { name: '落雷 凯诺', lvl: 11, hp: 70000, atk: 260, def: 300, w: 13, d: 12, h: 90, weight: 1.6, speed: 110, exp: 1500, gold: [150, 280], shadowR: 18, pref: 170, clips: BEAST_CLIPS, scale: 1.25, bars: 16,
    model: () => buildGoblinVariant({ ...PAL_GOB, skin: '#e8e8e0', skin2: '#b8b8b0', eye: '#6ad0ff', band: null }, { weapon: 'scimitar', robe: '#3a3a7a' }),
    attacks: [
      melee('atk1', 0.08, 0.16, [0, 64, 24, 10, 80], { range: [0, 60], cd: [1.2, 2], w: 1.5, hit: { dmg: 1.1, knock: 90, onHit: (a, t) => { if (Math.random() < 0.2) addStatus(t, 'stun', 0.5); } }, events: [slashAt(0.07, { a0: -2.3, a1: 0.6, r: 44, w: 10, off: [10, 44], col: '#fff6a0' })] }),
      { clip: 'cast', range: [0, 700], dy: 700, cd: [3.5, 5], w: 2, act: { dur: 1.8, superArmor: true, events: [evAt(0.2, e => thunderPattern(e))] } }] },
  flameMage: { name: '烈焰 彼诺修', lvl: 18, hp: 150000, atk: 300, def: 420, w: 13, d: 12, h: 92, weight: 1.6, speed: 100, exp: 3200, gold: [260, 480], shadowR: 18, pref: 200, clips: BEAST_CLIPS, scale: 1.3, bars: 24,
    model: () => buildGoblinVariant({ ...PAL_GOB, skin: '#b86a4a', skin2: '#8a4a3a', eye: '#ffd23a', band: null }, { weapon: 'staff', orb: '#ff6a2a', robe: '#8a1a1a' }),
    attacks: [
      { clip: 'cast', range: [0, 260], dy: 60, cd: [1.6, 2.4], w: 2, act: { dur: 1.0, events: [evAt(0.4, e => shootStraight(e, { col: '#ff7a2a', dmg: 1.2, status: 'burn', speed: 330, explode: 30, trail: true, glow: true, z: 60 }))] } },
      { clip: 'cast', range: [0, 800], dy: 800, cd: [6, 8], w: 1.5, act: { dur: 2.2, superArmor: true, events: [evAt(0.3, e => meteorPattern(e))] } },
      { clip: 'cast', range: [0, 800], dy: 800, cd: [14, 18], w: 0.6, act: { dur: 1.4, superArmor: true, events: [evAt(0.6, e => { fxText('出来吧，我的爆弹们！', e.x, e.y, e.z + 30, { col: '#ff8a3a', size: 11 }); for (let i = 0; i < 3 && aliveAdds() < 5; i++) spawnMonster('goblinBomber', cam.x + rnd(80, WW - 80), rnd(20, DEPTH - 20), { lvl: e.lvl - 2, drop: true, mul: game.dungeon ? game.dungeon.D.hp : 1, atkMul: game.dungeon ? game.dungeon.D.atk : 1 }); })] } }] },
  zombie: { name: '饥饿僵尸', lvl: 16, hp: 8000, atk: 220, def: 300, w: 13, d: 12, h: 100, weight: 1.2, speed: 60, exp: 140, gold: [25, 50], shadowR: 18, pref: 45, clips: BEAST_CLIPS,
    model: () => buildZombie({ skin: '#8a9a7a', hair: '#3a3a30', eye: '#ff3a2a', cloth: '#4a4a5a', pants: '#3a3a3a' }),
    attacks: [melee('bite', 0.3, 0.42, [0, 50, 20, 30, 90], { range: [0, 48], cd: [1.5, 2.5], hit: { dmg: 1.1, knock: 40, stun: 0.5, snd: 'stab' } }),
      { clip: 'throw', range: [100, 300], dy: 30, cd: [4, 6], w: 0.6, act: { dur: 0.9, events: [evAt(0.45, e => shootStraight(e, { col: '#2a1a3a', dmg: 0.8, status: 'blind', speed: 220, glow: true }))] } }] },
  zombieRed: { name: '卡尔扎克', lvl: 18, hp: 12000, atk: 240, def: 360, w: 13, d: 12, h: 104, weight: 1.4, speed: 110, exp: 200, gold: [30, 60], shadowR: 18, pref: 45, clips: BEAST_CLIPS, scale: 1.05,
    model: () => buildZombie({ skin: '#b86a5a', hair: '#1a1a1a', eye: '#ffd23a', cloth: '#5a2a2a', pants: '#2a1a1a' }),
    attacks: [melee('bite', 0.3, 0.42, [0, 54, 22, 30, 95], { range: [0, 50], cd: [1.2, 2], hit: { dmg: 1.2, knock: 50, stun: 0.5, snd: 'stab', onHit: (a, t) => addStatus(t, 'bleed', 3, { dps: a.atk * 0.08, src: a }) } })] },
  boneLord: { name: '盗尸者 骨狱息', lvl: 22, hp: 220000, atk: 320, def: 520, w: 16, d: 13, h: 120, weight: 3, speed: 90, exp: 5200, gold: [360, 640], shadowR: 24, pref: 60, clips: BEAST_CLIPS, scale: 1.35, bars: 30,
    model: () => buildZombie({ skin: '#c8c8d0', hair: '#e8e8f0', eye: '#6ad0ff', cloth: '#1a1a2a', pants: '#1a1a2a' }),
    attacks: [
      melee('bite', 0.3, 0.42, [0, 60, 24, 30, 110], { range: [0, 56], cd: [1.2, 2], w: 2, hit: { dmg: 1.3, knock: 50, stun: 0.5, snd: 'stab', onHit: (a, t) => { const h = Math.round(a.hpMax * 0.004); a.hp = Math.min(a.hpMax, a.hp + h); addNumber(h, a.x, a.y, a.z, { heal: true }); } } }),
      { clip: 'cast', range: [0, 900], dy: 900, cd: [8, 11], w: 1.3, act: { dur: 1.6, superArmor: true, events: [evAt(0.3, e => frostPattern(e))] } },
      { clip: 'throw', range: [90, 360], dy: 40, cd: [3, 4.5], w: 1, act: { dur: 0.9, events: [0.35, 0.5, 0.65].map(t => evAt(t, e => shootStraight(e, { col: '#bfefff', dmg: 1, status: 'slow', speed: 300, glow: true, pierce: true })))} }] },
});
// 牛头冲撞：低头蓄力 → 长距离冲刺（霸体，命中带出血 / 眩晕）
function tauCharge(mul, bleed) {
  return { dur: 2.5, superArmor: true, onStart: e => { e.chargeGo = false; const R = game.room, len = R ? (e.face > 0 ? R.x1 - e.x : e.x - R.x0) : 600; e.chargeTele = telegraph({ x: e.x, y: e.y, kind: 'line', len: len * e.face, face: 1, hw: 26 + 12, dur: 1.15, col: '#ff4a2a' }); },
    update: (e, dt) => { if (e.actT < 1.15) { e.play('chargeW'); e.vx = 0; return; } if (!e.chargeGo) { e.chargeGo = true; e.play('charge', true); sfx.boom(0.3); } e.vx = e.face * 430 * Math.min(1.2, mul * 0.8); if (Math.random() < 0.4) fxDust(e.x - e.face * 20, e.y, 1, 6); const R = game.room; if (R && ((e.face < 0 && e.x <= R.x0 + e.w + 2) || (e.face > 0 && e.x >= R.x1 - e.w - 2))) { e.actT = e.act.dur; cam.shake = 5; sfx.thud(1); } },
    hits: [{ t0: 1.15, t1: 2.45, rep: 9, box: [-10, 50, 26, 0, 110], dmg: 0.95 * mul, launch: 300, knock: 260, hs: 0.08, shake: 5, onHit: (a, t) => addStatus(t, bleed ? 'bleed' : 'stun', bleed ? 4 : 1, { dps: bleed ? a.atk * 0.1 : 0, src: a }) }],
    onEnd: e => { e.vx = 0; e.chargeGo = false; if (e.chargeTele) killTele(e.chargeTele); } };
}
// 猫妖扑击：蹲伏 → 跃起扑向玩家 → 落地爪击
function pounceAct(mul, status) {
  return { dur: 1.0, onStart: e => { e.pounceGo = false; },
    update: (e, dt) => { if (e.actT >= 0.35 && !e.pounceGo) { e.pounceGo = true; const p = game.player; const dx = p ? p.x - e.x : 100; e.face = dx >= 0 ? 1 : -1; e.vz = 330; e.z = 1; e.vx = clamp(dx / 0.45, -520, 520); e.vy = p ? (p.y - e.y) / 0.45 : 0; sfx.jump(); } },
    onLand: e => { e.vx *= 0.2; e.vy = 0; },
    hits: [{ t0: 0.4, t1: 0.9, box: [-6, 40, 22, -10, 80], dmg: mul, knock: 140, stun: 0.45, hs: 0.07, snd: 'slash', onHit: status ? (a, t) => addStatus(t, status, 4, { dps: a.atk * 0.08, src: a }) : null }],
    onEnd: e => { e.vy = 0; } };
}
function poisonCloud(e, x, y) {
  sfx.hit('fire', false);
  addFx({ x, y: y - 30, cy: y, z: 0, dur: 4, tick: 0, update(dt) { this.tick -= dt; if (this.tick <= 0) { this.tick = 0.5; for (const t of ents) if (t.team === 'p' && !t.dead && inGround(t, this.x, this.cy, 70) && t.z < 40) addStatus(t, 'poison', 3, { dps: e.atk * 0.12, src: e }); } },
    draw(c) { const k = this.t / this.dur, a = k < 0.1 ? k / 0.1 : k > 0.8 ? (1 - k) / 0.2 : 1; for (let i = 0; i < 5; i++) { const ang = i / 5 * TAU + this.t * 0.6; drawSpr(c, 'poison', sx(this.x) + Math.cos(ang) * 38, sy(this.cy, 16) + Math.sin(ang) * 14, 70 + Math.sin(this.t * 3 + i) * 8, 0, { add: false, alpha: 0.75 * a, rot: ang }); } } });
}
// 落雷术士：三种落雷（成排 / 追踪 / 自身周围一圈），落点先出现黄色法阵
function thunderPattern(e) {
  const p = game.player; if (!p) return;
  const mode = pick(['row', 'track', 'ring']);
  const strike = (g) => { lightningStrike(g); areaHit(e, g.x, g.y, 34, 0, { dmg: 1.15, launch: 280, knock: 60, hs: 0.08, snd: 'crit' }, { status: 'stun', sdur: 0.8 }); };
  if (mode === 'row') { const y = p.y; for (let i = 0; i < 7; i++) telegraph({ x: cam.x + 80 + i * 130, y, r: 34, dur: 1.5 + i * 0.1, fire: strike }); }
  else if (mode === 'track') { for (let i = 0; i < 4; i++) telegraph({ x: p.x, y: p.y, r: 36, dur: 1.4 + i * 0.5, follow: p, fire: strike }); }
  else { for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; telegraph({ x: e.x + Math.cos(a) * 120, y: clamp(e.y + Math.sin(a) * 60, 6, DEPTH - 6), r: 34, dur: 1.6, fire: strike }); } }
}
// 炎术士：召唤火陨石，落点先出现红色六芒星
function meteorPattern(e) {
  const p = game.player; if (!p) return;
  const spots = [[p.x, p.y]]; for (let i = 0; i < 4; i++) spots.push([cam.x + rnd(80, WW - 80), rnd(20, DEPTH - 20)]);
  spots.forEach(([x, y], i) => telegraph({ x, y, r: 60, dur: 1.9 + i * 0.3, kind: 'hex', col: '#ff5a2a', fire: (g) => { meteorImpact(g); areaHit(e, g.x, g.y, 62, 0, { dmg: 1.7, down: true, knock: 240, hs: 0.1, snd: 'fire', shake: 6 }, { status: 'burn', sdur: 4, dps: 0.12 }); } }));
}
// 骨狱领主：地面结出白霜，几秒后冻结站在上面的人（跳起来可以躲开）
function frostPattern(e) {
  const p = game.player; if (!p) return;
  for (let i = 0; i < 3; i++) telegraph({ x: i === 0 ? p.x : cam.x + rnd(100, WW - 100), y: i === 0 ? p.y : rnd(20, DEPTH - 20), r: 90, dur: 4.5, kind: 'frost', col: '#bfefff', fire: (g) => { sfx.hit('crit', false); addFx({ x: g.x, y: g.y + 1, z: 0, dur: 0.55, add: true, draw(c) { const k = this.t / this.dur; drawSpr(c, 'frost', sx(this.x), sy(this.y, 0), 200 * (0.6 + easeOut(k) * 0.5), 0, { ay: 0.72, alpha: 1 - k * k }); } }); for (const t of ents) if (t.team === 'p' && !t.dead && t.invul <= 0 && t.z < 8 && inGround(t, g.x, g.y, 90)) { addStatus(t, 'freeze', 2.2, { force: true }); applyHit(e, t, { dmg: 1.2, stun: 0, knock: 0, hs: 0.05 }, { proj: true, src: { ...e, x: g.x, face: e.face } }); } } });
}

/* ---- 手绘美术：怪物 → 骨骼素材（变种用换色 / 去掉武器区分；有素材时替换程序化造型） ---- */
/* ---- 格兰之森后续地下城的怪物（在已有怪物的基础上改数值 / 招式，美术用换色区分） ---- */
// 冰霜克拉赫的冰箭：以玩家为中心四个方向落下冰柱封路，被砸中会冻结
function iceArrowRing(e) {
  const p = game.player; if (!p) return;
  const pts = [[-110, 0], [110, 0], [0, -60], [0, 60]];
  pts.forEach(([dx, dy], i) => telegraph({ x: p.x + dx, y: clamp(p.y + dy, 8, DEPTH - 8), r: 42, dur: 1.3 + i * 0.05, kind: 'frost', col: '#bfefff', fire: (g) => { sfx.ice(); fxShock(g.x, g.y, 60, '#bfefff'); areaHit(e, g.x, g.y, 42, 0, { dmg: 1.2, stun: 0.3, knock: 40, hs: 0.06, snd: 'stab', col: '#dff6ff' }, { status: 'freeze', sdur: 1.2 }); } }));
}
Object.assign(MON, {
  catCurse: { ...MON.catKing, name: '暗咒猫妖', lvl: 9, hp: 52000, atk: 230, def: 260, speed: 230, exp: 1200, gold: [110, 220], scale: 1.2, bars: 12, onDamaged: null,
    attacks: [
      melee('scratch', 0.3, 0.38, [0, 64, 24, 10, 90], { range: [0, 60], cd: [0.7, 1.2], w: 2, hit: { dmg: 1.0, knock: 70 } }),
      { clip: 'pounce', range: [80, 400], dy: 50, cd: [1.6, 2.4], w: 1.6, act: pounceAct(1.3) },
      melee('bite', 0.3, 0.42, [0, 56, 22, 20, 90], { range: [0, 55], cd: [4, 6], w: 0.8, hit: { dmg: 1.3, stun: 0.5, snd: 'stab', onHit: (a, t) => { addStatus(t, 'slow', 3, { src: a }); addStatus(t, 'blind', 2.5, { src: a }); } } })] },
  goblinFrost: { ...MON.goblinBlue, name: '冰霜哥布林', lvl: 7, hp: 2800, atk: 210, def: 130, exp: 55,
    onDamaged: (m, a, dmg, crit, h) => { if (a.team === 'p' && h.box && Math.abs(a.x - m.x) < 70 && Math.random() < 0.12) { addStatus(a, 'freeze', 0.8, { src: m }); fxText('寒冰甲', m.x, m.y, m.z + 10, { col: '#bfefff', size: 10 }); } } },
  tauVanguard: { ...MON.tauSoldier, name: '牛头先锋', lvl: 6, hp: 7800, atk: 230, speed: 105, exp: 105,
    attacks: [MON.tauSoldier.attacks[0], { ...MON.tauSoldier.attacks[1], cd: [3.5, 5.5], w: 1.3 }] },
  tauGuard: { ...MON.tauSoldierBoss, name: '牛头护卫', lvl: 10, hp: 16000, atk: 240, def: 360, exp: 190, gold: [30, 60], scale: 1.05, bars: undefined,
    onDamaged: (m, a, dmg, crit, h) => { if (!h.box && !m.act) { m.superArmor = Math.max(m.superArmor, 1.2); } } },   // 被远程攻击时自动霸体
  frostMage: { ...MON.flameMage, name: '冰霜 克拉赫', lvl: 12, hp: 82000, atk: 250, def: 320, exp: 1700, gold: [150, 300], bars: 16, summons: ['goblinFrost'],
    attacks: [
      melee('atk1', 0.08, 0.16, [0, 60, 24, 10, 80], { range: [0, 60], cd: [1.2, 2], w: 1.5, hit: { dmg: 1.0, knock: 90, onHit: (a, t) => addStatus(t, 'slow', 2, { src: a }) } }),
      { clip: 'cast', range: [0, 300], dy: 60, cd: [1.8, 2.6], w: 1.6, act: { dur: 1.0, events: [evAt(0.4, e => shootStraight(e, { col: '#bfefff', dmg: 1.0, status: 'slow', speed: 320, pierce: true, glow: true, z: 60 }))] } },
      { clip: 'cast', range: [0, 800], dy: 800, cd: [6, 8], w: 1.5, act: { dur: 1.8, superArmor: true, events: [evAt(0.3, e => iceArrowRing(e))] } },
      { clip: 'cast', range: [0, 800], dy: 800, cd: [14, 18], w: 0.6, act: { dur: 1.4, superArmor: true, events: [evAt(0.6, e => { fxText('来吧，冰霜的仆从们！', e.x, e.y, e.z + 30, { col: '#bfefff', size: 11 }); for (let i = 0; i < 3 && aliveAdds() < 4; i++) spawnMonster('goblinFrost', cam.x + rnd(80, WW - 80), rnd(20, DEPTH - 20), { lvl: e.lvl - 3, drop: true, mul: game.dungeon ? game.dungeon.D.hp : 1, atkMul: game.dungeon ? game.dungeon.D.atk : 1 }); })] } }] },
  plague: { ...MON.goblinThrower, name: '普拉格', lvl: 15, hp: 6000, atk: 230, def: 200, speed: 110, exp: 180, gold: [30, 60],
    // 试玩核查：原来 1.1~1.8 秒扔一次、一次两块，几只普拉格在屏幕外轮流扔会把人砸得起不来（机器人在暗黑雷鸣废墟被击 153 次里有 113 次来自它）；改成 2.6~3.8 秒一次、一次一块
    attacks: [{ clip: 'throw', range: [100, 340], dy: 40, cd: [2.6, 3.8], w: 2, act: { dur: 0.9, events: [evAt(0.45, e => throwRock(e))] } }, MON.goblinBomber.attacks[1]] },
});
const G = [45, 160];   // 哥布林绿色皮肤的色相区间
const MON_ART = {
  goblin: ['goblin'], goblinThrower: ['goblin', { weapon: false, hue: -25, only: G }], goblinBlue: ['goblin', { weapon: false, hue: 115, only: G }], goblinRed: ['goblin', { weapon: false, hue: -95, sat: 1.2, only: G }],
  goblinCaptain: ['goblinCaptain'], goblinCoward: ['goblin', { weapon: false, hue: -45, bright: 1.1, only: G }], goblinBomber: ['goblin', { weapon: false, hue: -60, sat: 0.6, bright: 0.8, only: G }],
  goblinChief: ['goblinChief'], goblinShaman: ['goblinShaman'], flameMage: ['flameMage'],
  catDemon: ['cat'], catGlow: ['cat', { hue: -140, sat: 1.9, bright: 1.08 }], catVenom: ['cat', { hue: 25, sat: 2.2, bright: 0.72 }], catKing: ['catKing'],
  tauSoldier: ['tau'], tauBeast: ['tau', { weapon: false, hue: -10, bright: 0.78 }], tauSoldierBoss: ['tauArmored'], tauKing: ['tauKing'],
  zombie: ['zombie'], zombieRed: ['zombie', { hue: -85, sat: 1.8, only: [40, 140] }], boneLord: ['boneLord'],
  catCurse: ['catKing', { hue: 150, sat: 1.1, bright: 0.9 }], goblinFrost: ['goblin', { hue: 150, sat: 0.6, bright: 1.15, only: G }], tauVanguard: ['tau', { hue: 20, sat: 1.2, bright: 0.95 }],
  tauGuard: ['tauArmored', { hue: -150, sat: 0.8 }], frostMage: ['flameMage', { hue: 180, sat: 0.9, bright: 1.05 }], plague: ['goblin', { weapon: false, hue: 0, sat: 0.15, bright: 0.55, only: G }],
};
MON.goblinChief.summons = ['goblin', 'goblinThrower']; MON.flameMage.summons = ['goblinBomber'];
// 怪物 → 所需美术分包（进地下城前按需加载）
const monBundles = kinds => [...new Set(kinds.flatMap(k => [k, ...((MON[k] && MON[k].summons) || [])]).map(k => MON_ART[k] && 'spr:' + MON_ART[k][0]).filter(Boolean))];
