/* =====================================================================
   10. 实体与战斗结算
   坐标：x 横向、y 纵深（0..DEPTH）、z 高度；速度 vx vy vz（px/s）
   状态：idle walk run jump act（执行动作）hit（地面硬直）air（浮空）down（倒地）getup dead
   动作 act：{ name, clip, dur, hits:[{t0,t1,box:[前沿0,前沿1,纵深半宽,z0,z1], ...}], move:[[t0,t1,vx,vz?]], ... }
   ===================================================================== */
const GRAV = 1500;
const ents = [];
let entSeq = 1;
class Ent {
  constructor(o) {
    Object.assign(this, {
      id: entSeq++, team: 'e', x: 0, y: 100, z: 0, vx: 0, vy: 0, vz: 0, face: 1,
      w: 14, d: 12, h: 100, weight: 1, hp: 1000, hpMax: 1000, mp: 0, mpMax: 0,
      atk: 100, def: 0, crit: 0.05, critDmg: 1.5, lvl: 1, name: '',
      st: 'idle', stT: 0, act: null, actT: 0, hitstop: 0, invul: 0, stun: 0, superArmor: 0, flash: 0,
      juggle: 0, downHits: 0, bounced: false, clipName: 'idle', animT: 0, pose: {}, dead: false, remove: false,
      speed: 150, runSpeed: 290, jumpV: 470, shadowR: 20, hitsDone: new Map(), stats: {},
    }, o);
    this.hpMax = this.hp;
  }
  get grounded() { return this.z <= 0.01 && this.vz <= 0; }
  get busy() { return this.st === 'act' || this.st === 'hit' || this.st === 'air' || this.st === 'down' || this.st === 'getup' || this.st === 'dead'; }
  setState(s) { if (this.st !== s) { this.st = s; this.stT = 0; } }
  play(name, restart = false) { if (this.clipName !== name || restart) { this.clipName = name; this.animT = 0; } }
  doAct(def, extra) {
    if (this.act && this.act.onEnd) { const o = this.act; this.act = null; o.onEnd(this, true); }   // 被新动作取代时也要做收尾
    this.act = { ...def, ...extra }; this.actT = 0; this.hitsDone.clear(); this.setState('act');
    if (this.act.events) this.act.events = this.act.events.map(ev => ({ ...ev, done: false }));
    this.play(this.act.clip || def.name, true);
    if (this.act.onStart) this.act.onStart(this);
  }
  endAct() { const a = this.act; this.act = null; if (this.st === 'act') this.setState(this.grounded ? 'idle' : 'jump'); if (a && a.onEnd) a.onEnd(this); }
  // 当前的受击盒高度：倒地时很矮、浮空时是横躺的身体
  hurtH() { return this.st === 'down' ? 22 : this.st === 'air' ? this.h * 0.55 : this.h; }
  update(dt) {
    if (this.flash > 0) this.flash -= dt;
    if (this.hitstop > 0) { this.hitstop -= dt; return; }
    this.stT += dt; this.animT += dt;
    if (this.invul > 0) this.invul -= dt;
    if (this.superArmor > 0) this.superArmor -= dt;
    // ---- 动作 ----
    if (this.st === 'act' && this.act) {
      const a = this.act; this.actT += dt;
      if (a.move) for (const m of a.move) if (this.actT >= m[0] && this.actT < m[1]) { this.vx = m[2] * this.face; if (m[3] !== undefined) this.vz = m[3]; if (m[4] !== undefined) this.vy = m[4]; }
      if (a.update) a.update(this, dt);
      if (a.events) for (const ev of a.events) if (!ev.done && this.actT >= ev.t) { ev.done = true; ev.fn(this); }
      if (this.actT >= a.dur) this.endAct();
    }
    // ---- 物理 ----
    const inAir = this.z > 0 || this.vz > 0;
    if (inAir) {
      const g = this.st === 'air' ? GRAV * (1 + Math.min(this.juggle, 12) * 0.03) : (this.act && this.act.lowGrav ? GRAV * this.act.lowGrav : GRAV);
      this.vz -= g * dt; this.z += this.vz * dt;
      if (this.z <= 0) { this.z = 0; this.land(); }
    }
    this.x += this.vx * dt; this.y += this.vy * dt;
    // 地面摩擦：硬直/倒地/动作结束后滑行减速
    if (this.z <= 0) {
      const fr = this.st === 'hit' || this.st === 'down' ? 6 : this.st === 'act' ? 10 : 14;
      if (!(this.st === 'walk' || this.st === 'run') && !(this.act && this.act.move && this.act.move.some(m => this.actT >= m[0] && this.actT < m[1]))) { this.vx *= Math.exp(-fr * dt); this.vy *= Math.exp(-fr * dt); }
    } else if (this.st === 'air') this.vx *= Math.exp(-0.8 * dt);
    const R = game.room;
    if (R) { this.x = clamp(this.x, R.x0 + this.w, R.x1 - this.w); }
    this.y = clamp(this.y, 4, DEPTH - 4);
    // ---- 受击状态计时 ----
    if (this.st === 'hit') { this.stun -= dt; if (this.stun <= 0) this.setState('idle'); }
    else if (this.st === 'down') { if (this.stT > (this.downTime || 0.8)) this.startGetup(); }
    else if (this.st === 'getup') { if (this.stT > 0.4) { this.setState('idle'); this.downHits = 0; this.juggle = 0; } }
    if (this.st === 'dead') this.deadT = (this.deadT || 0) + dt;
    // ---- 动画 ----
    this.animate(dt);
  }
  land() {
    const imp = -this.vz;
    if (this.st === 'air') {
      if (!this.bounced && imp > 330 && !this.dead) { this.bounced = true; this.vz = imp * 0.32; this.z = 0.01; fxDust(this.x, this.y, 5, 14); sfx.thud(0.6); return; }
      this.vz = 0; this.setState('down'); this.downTime = this.dead ? 99 : (this.team === 'p' ? 0.55 : 0.75); fxDust(this.x, this.y, 6, 18); sfx.thud(0.8);
      return;
    }
    this.vz = 0;
    if (this.st === 'act' && this.act && this.act.onLand) { this.act.onLand(this); return; }
    if (this.st === 'act' && this.act && this.act.airOnly) this.endAct();
    if (this.st === 'jump') { this.setState('idle'); this.play('land', true); this.landT = 0.1; fxDust(this.x, this.y, 3, 8); }
  }
  startGetup() { this.setState('getup'); this.play('getup', true); this.invul = Math.max(this.invul, this.team === 'p' ? 1.1 : 0.55); this.bounced = false; }
  animate(dt) {
    let clip = this.clipName;
    if (this.st === 'idle') clip = this.landT > 0 ? 'land' : 'idle';
    else if (this.st === 'walk') clip = 'walk';
    else if (this.st === 'run') clip = 'run';
    else if (this.st === 'jump') clip = this.vz > 60 ? 'jumpUp' : 'jumpFall';
    else if (this.st === 'hit') clip = this.clipName === 'hit' ? 'hit' : 'hit';
    else if (this.st === 'air') clip = 'air';
    else if (this.st === 'down' || (this.st === 'dead' && this.z <= 0)) clip = 'down';
    else if (this.st === 'dead') clip = 'air';
    if (this.landT > 0) this.landT -= dt;
    if (clip !== this.clipName) this.play(clip);
    const c = this.clips[this.clipName] || this.clips.idle;
    samplePose(c, this.animT, this.pose);
  }
  // 先画进离屏精灵，再整体合成：受击闪白、霸体红描边只需处理一次（逐部件加滤镜又慢又会把内部线条也描红）
  draw(c) {
    const sc = this.scale || 1, X = sx(this.x), Y = sy(this.y, this.z);
    const shk = this.hitstop > 0 ? (Math.floor(game.t * 60) % 2 ? 1.5 : -1.5) : 0;
    let a = 1;
    if (this.st === 'dead' && this.z <= 0) a = clamp(1 - (this.deadT - 0.5) / 0.6, 0, 1);
    if (this.invul > 0 && this.team === 'p' && this.st !== 'getup' && Math.floor(game.t * 20) % 2) a *= 0.55;
    if (a <= 0) return;
    const sa = !this.dead && (this.superArmor > 0 || (this.st === 'act' && this.act && this.act.superArmor));
    const fsx = this.face * (this.drawFlip ? -1 : 1) * sc;
    if (!sa && !(this.flash > 0)) {   // 普通情况：直接画到世界层
      c.save(); c.globalAlpha = a; c.translate(X + shk, Y); c.scale(fsx, sc);
      this.model.draw(c, this.pose, game.t + this.id, this.drawOpts || NO_OPTS);
      c.restore(); return;
    }
    // 受击闪白 / 霸体红描边：先画进离屏精灵再整体着色合成
    const S = spriteBuf;
    S.x.setTransform(RS, 0, 0, RS, 0, 0); S.x.clearRect(0, 0, S.w, S.h);
    S.x.translate(S.ox, S.oy); S.x.scale(fsx, sc);
    this.model.draw(S.x, this.pose, game.t + this.id, this.drawOpts || NO_OPTS);
    const dx = X - S.ox + shk, dy = Y - S.oy;
    const T = tintBuf; T.x.globalCompositeOperation = 'copy'; T.x.drawImage(S.cv, 0, 0); T.x.globalCompositeOperation = 'source-in';
    T.x.fillStyle = this.flash > 0 ? '#ffffff' : (Math.floor(game.t * 8) % 2 ? '#ff2020' : '#ff6a3a'); T.x.fillRect(0, 0, S.cv.width, S.cv.height); T.x.globalCompositeOperation = 'source-over';
    const C = compBuf; C.x.clearRect(0, 0, S.cv.width, S.cv.height);
    if (sa) for (const [ox, oy] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) C.x.drawImage(T.cv, ox, oy);
    C.x.drawImage(S.cv, 0, 0);
    if (this.flash > 0) { C.x.globalAlpha = 0.7; C.x.drawImage(T.cv, 0, 0); C.x.globalAlpha = 1; }
    c.globalAlpha = a; c.drawImage(C.cv, dx, dy, S.w, S.h); c.globalAlpha = 1;
  }
  drawShadow(c) {
    const X = sx(this.x), Y = sy(this.y, 0), k = 1 / (1 + this.z / 120);
    c.fillStyle = `rgba(0,0,0,${0.35 * k})`; c.beginPath(); c.ellipse(X, Y, this.shadowR * k, this.shadowR * 0.32 * k, 0, 0, TAU); c.fill();
  }
}

const NO_OPTS = {};
const spriteBuf = (() => { const [cv, x] = offCanvas(360 * RS, 340 * RS); return { cv, x, w: 360, h: 340, ox: 180, oy: 270 }; })();
const tintBuf = (() => { const [cv, x] = offCanvas(360 * RS, 340 * RS); return { cv, x }; })();
const compBuf = (() => { const [cv, x] = offCanvas(360 * RS, 340 * RS); return { cv, x }; })();
/* ---- 命中判定：每帧检查所有激活中的攻击框 ---- */
function atkBox(a, h) {
  const b = h.box, x0 = a.face > 0 ? a.x + b[0] : a.x - b[1], x1 = a.face > 0 ? a.x + b[1] : a.x - b[0];
  return { x0, x1, y0: a.y - b[2], y1: a.y + b[2], z0: a.z + b[3], z1: a.z + b[4] };
}
function overlaps(B, t) {
  return B.x1 >= t.x - t.w && B.x0 <= t.x + t.w && B.y1 >= t.y - t.d && B.y0 <= t.y + t.d && B.z1 >= t.z && B.z0 <= t.z + t.hurtH();
}
function resolveHits() {
  for (const a of ents) {
    if (a.st !== 'act' || !a.act || !a.act.hits || a.hitstop > 0) continue;
    for (let hi = 0; hi < a.act.hits.length; hi++) {
      const h = a.act.hits[hi];
      if (a.actT < h.t0 || a.actT >= h.t1) continue;
      const B = atkBox(a, h);
      for (const t of ents) {
        if (t.team === a.team || t.dead || t.invul > 0 || t.remove) continue;
        if (t.st === 'down' && !h.downHit && B.z0 > 8) continue;
        if (!overlaps(B, t)) continue;
        const key = t.id * 100 + hi, last = a.hitsDone.get(key);
        if (last !== undefined && (!h.rep || a.actT - last < h.rep)) continue;
        a.hitsDone.set(key, a.actT);
        applyHit(a, t, h);
      }
    }
  }
}
// 伤害：攻击力 × 技能倍率 × 防御减免 × 浮动；暴击 / COUNTER / 背击 加成
function applyHit(a, t, h, opt = {}) {
  const src = opt.src || a;
  const counter = t.st === 'act' && t.act && t.act.hits && t.act.hits.some(x => t.actT < x.t1) && !t.act.noCounter;
  const back = Math.sign(src.x - t.x || 1) !== t.face && t.st !== 'down';
  let critRate = (a.crit || 0) + (back ? 0.1 : 0) + (h.critBonus || 0);
  const crit = Math.random() < critRate;
  let dmg = (a.atk || 100) * (h.dmg || 1) * (1 - t.def / (t.def + 1200)) * rnd(0.93, 1.07);
  if (crit) dmg *= a.critDmg || 1.5;
  if (counter) dmg *= 1.25;
  if (back) dmg *= 1.1;
  if (t.dmgTakenMul) dmg *= t.dmgTakenMul;
  dmg = Math.max(1, Math.round(dmg));
  t.hp -= dmg; t.lastDmg = dmg;
  const hx = (Math.max(Math.min(t.x + t.w, src.x + (h.box ? h.box[1] : 20) * src.face), t.x - t.w) + t.x) / 2;
  const hz = clamp(src.z + (h.box ? (h.box[3] + h.box[4]) / 2 : 40), t.z + 10, t.z + t.hurtH() - 8);
  addNumber(dmg, t.x, t.y, t.z, { crit, player: t.team === 'p' });
  fxHit(hx, t.y, hz, src.face, { col: h.col || (a.team === 'p' ? '#bfe8ff' : '#ffd0a0'), big: h.big || 1, crit });
  if (counter) fxText('COUNTER', t.x, t.y, t.z, { col: '#ff4a2a' });
  else if (back && a.team === 'p') fxText('BACK ATTACK', t.x, t.y, t.z, { col: '#ffb030', size: 11 });
  t.flash = 0.08;
  const hs = (h.hs ?? 0.06) + (crit ? 0.02 : 0) + (counter ? 0.03 : 0);
  if (!opt.proj) a.hitstop = Math.max(a.hitstop, hs);
  t.hitstop = Math.max(t.hitstop, hs + 0.01);
  if (h.shake) cam.shake = Math.max(cam.shake, h.shake * (crit ? 1.4 : 1));
  sfx.hit(h.snd || (crit ? 'crit' : 'slash'), crit);
  if (a.team === 'p') game.onPlayerHit(t, dmg, crit, counter, back);
  if (t.team === 'p') game.onPlayerHurt(t, dmg);
  if (h.onHit) h.onHit(a, t);
  if (t.onDamaged) t.onDamaged(t, a, dmg, crit, h);
  // ---- 反应 ----
  if (t.hp <= 0) { t.hp = 0; killEnt(t, a, h); return; }
  // 倒地的目标：没有挑起 / 追打属性的攻击只造成伤害，不会把它“打站起来”
  if (t.st === 'down' && !h.downHit && !h.launch) { if (t.onHurt) t.onHurt(a, h); return; }
  if (t.act && t.act.breakable && a.team !== t.team) { t.breakDmg = (t.breakDmg || 0) + dmg; if (t.breakDmg > t.hpMax * t.act.breakable) { breakAct(t); return; } }
  const sa = t.superArmor > 0 || (t.act && t.act.superArmor);
  if (sa && !h.grab) { t.flash = 0.1; return; }
  if (t.act) { const ac = t.act; t.act = null; if (ac.onEnd) ac.onEnd(t, true); }
  const dir = h.pull ? -src.face : src.face, kb = (h.knock ?? 80) / Math.max(0.5, t.weight);
  const airborne = t.st === 'air' || t.z > 2;
  if (h.launch || airborne || (t.st === 'down' && h.downHit)) {
    const decay = Math.max(0.3, Math.pow(0.85, t.juggle));
    let vz = (h.launch || (airborne ? h.airLift ?? 180 : 160)) * decay / Math.sqrt(t.weight);
    if (airborne && !h.launch) vz = Math.max(t.vz * 0.3, vz);
    t.vz = vz; t.z = Math.max(t.z, 1); t.vx = dir * kb * (airborne ? 0.6 : 0.8); t.juggle++;
    if (t.st === 'down') { t.downHits++; t.bounced = true; if (t.downHits > 3 && t.team === 'e') { t.setState('down'); t.startGetup(); t.invul = 0.7; return; } }
    t.setState('air'); t.play('air', true);
  } else if (h.down) {
    t.vz = 230 / Math.sqrt(t.weight); t.z = 1; t.vx = dir * kb; t.setState('air'); t.bounced = false; t.juggle++;
  } else {
    t.setState('hit'); t.stun = (h.stun ?? 0.32) * (counter ? 1.4 : 1) / Math.sqrt(t.weight); t.vx = dir * kb; t.play('hit', true);
  }
  if (t.onHurt) t.onHurt(a, h);
}
function killEnt(t, a, h) {
  if (t.act && t.act.onEnd) { const o = t.act; t.act = null; o.onEnd(t, true); }
  t.dead = true; t.setState('dead'); t.deadT = 0; t.act = null;
  t.vz = Math.max(t.vz, t.z > 2 ? 120 : 260); t.vx = a.face * 120; t.z = Math.max(t.z, 1);
  t.hitstop = 0.12;
  if (t.onDeath) t.onDeath(a);
  game.onKill(t, a);
}
