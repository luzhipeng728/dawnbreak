/* =====================================================================
   天帷巨兽的怪物（官方经典版 Lv28~40，本作压缩到 Lv24~30）
   资料：腾讯 2011 资料站“天帷巨兽”（各地下城的怪物与领主）、官方主线表、百度百科。
   - GBL 教：信徒 / 神官 / 祭司 / 主教，天帷禁地里是“复活的”版本；领主 GBL教大主教 + 大祭司（神殿外围）
   - 章鱼怪 / 蓝章鱼 / 小八爪、夜叉、树精 / 树魔 / 混乱花、龙头炮 / 火焰龙头炮 / 激光龙头、锯角撞车、多尼尔
   - 领主：大主教（+大祭司）、巨树守护者 罗丁、夜叉王、多尼尔（EX）、长脚罗特斯、审判者马塞尔；精英：园丁鲁尔、巨型黑章鱼
   用户嫌难：所有大招都有地面预警（圈 / 线 / 文字提示），留出躲避时间；复用天空之城的招式模板（sky*）。
   ===================================================================== */

/* ---- 招式模板 ---- */
// 抛物线投弹：落点先出现红圈，落地爆炸（龙头炮、多尼尔、罗丁的果实）
function bhLob(e, o = {}) {
  const p = game.player; if (!p) return;
  const tx = (o.x ?? p.x), ty = clamp(o.y ?? p.y, 8, DEPTH - 8), dist = Math.abs(tx - e.x), T = o.t || clamp(dist / 280, 0.7, 1.2), r = o.r || 46;
  const tele = telegraph({ x: tx, y: ty, r, dur: T, col: o.col || '#ff5a3a' });
  sfx.swing(false);
  spawnProj({ owner: e, x: e.x + e.face * 14, y: e.y, z: o.z0 || 60, vx: (tx - e.x) / T, vy: (ty - e.y) / T, vz: 260, grav: ((o.z0 || 60) + 260 * T) * 2 / (T * T), life: 3, w: 8, d: 10, h: 12, face: e.face, pierce: false, shadow: 6,
    hit: { dmg: 0.4, stun: 0.2, knock: 40, hs: 0.03 },
    onEnd(pr) {
      killTele(tele); if (e.dead && !o.keep) return;
      if (o.fruit) { fxDust(pr.x, pr.y, 8, 30, '#c84a3a'); sfx.hit('blunt', false); } else meteorImpact(pr, 0.55);
      areaHit(e, pr.x, pr.y, r, 0, { dmg: o.dmg || 1.1, down: true, knock: 180, hs: 0.07, snd: o.fruit ? 'blunt' : 'fire', shake: 4 }, o.status ? { status: o.status, sdur: o.sdur || 2, dps: o.dps || 0 } : {});
    },
    draw(c, pr) {
      const X = sx(pr.x), Y = sy(pr.y, pr.z);
      if (o.fruit) { c.fillStyle = '#e8503a'; c.strokeStyle = '#5a1a14'; c.lineWidth = 2; c.beginPath(); c.arc(X, Y, 9, 0, TAU); c.fill(); c.stroke(); c.fillStyle = '#4aa03a'; c.fillRect(X - 1, Y - 13, 3, 5); c.fillStyle = 'rgba(255,255,255,.5)'; c.beginPath(); c.arc(X - 3, Y - 3, 3, 0, TAU); c.fill(); }
      else drawSpr(c, 'bomb', X, Y, 0, 18, { add: false, rot: pr.t * 8 });
    } });
}
// 扇形飞刀：三把刀上下错开飞出（GBL教祭司、审判者马塞尔）
function bhKnives(e, n = 3, o = {}) {
  const p = game.player; sfx.swing(false);
  const vy0 = p ? clamp((p.y - e.y) * 1.2, -60, 60) : 0;
  for (let i = 0; i < n; i++) {
    const vy = vy0 + (i - (n - 1) / 2) * (o.spread || 70);
    spawnProj({ owner: e, x: e.x + e.face * 14, y: e.y, z: 50, vx: e.face * (o.speed || 320), vy, life: 1.8, w: 8, d: 9, h: 10, face: e.face, pierce: false, shadow: 3,
      hit: { dmg: o.dmg || 0.7, stun: 0.25, knock: 50, hs: 0.04, snd: 'stab' },
      draw(c, pr) { const X = sx(pr.x), Y = sy(pr.y, pr.z), f = pr.face; c.save(); c.fillStyle = o.col || '#e8e0c8'; c.strokeStyle = '#3a2a1a'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(X + f * 12, Y); c.quadraticCurveTo(X + f * 2, Y - 6, X - f * 6, Y - 2); c.lineTo(X - f * 6, Y + 2); c.quadraticCurveTo(X + f * 2, Y + 3, X + f * 12, Y); c.fill(); c.stroke(); c.fillStyle = '#8a5a2a'; c.fillRect(X - f * 12 - 2, Y - 2, 7, 4); c.restore(); } });
  }
}
// 带预警的冲刺：先出现红线（warn 秒），再贴地冲过去（夜叉王、审判者马塞尔的拔刀刺）
function bhDash(len, speed, dmg, warn = 0.8) {
  const T1 = warn + len / speed;
  return { dur: T1 + 0.4, superArmor: true, onStart: e => { const p = game.player; if (p) e.face = p.x >= e.x ? 1 : -1; e.dashGo = false; e.dashTele = telegraph({ x: e.x, y: e.y, kind: 'line', len: Math.min(len, Math.abs(skyWall(e, e.face) - e.x)) * e.face, face: 1, hw: 22, dur: warn, col: '#ff5a3a' }); },
    update: (e, dt) => { if (e.actT < warn) { e.vx = 0; return; } if (e.actT < T1) { if (!e.dashGo) { e.dashGo = true; e.play('charge', true); sfx.swing(true); } e.vx = e.face * speed; if (Math.random() < 0.5) fxDust(e.x - e.face * 18, e.y, 1, 6); } else e.vx = 0; },
    hits: [{ t0: warn, t1: T1, box: [-6, 50, 24, 0, 110], dmg, knock: 220, stun: 0.5, hs: 0.08, snd: 'slash', shake: 4 }],
    onEnd: e => { e.vx = 0; e.dashGo = false; if (e.dashTele) killTele(e.dashTele); } };
}
// 圣光柱：金色圈跟着玩家一小段时间后锁定，落下光柱（大主教）
function bhHolyPillars(e, n, col = '#ffd84a') {
  const p = game.player; if (!p) return;
  const img = fxTint('pillar', col);
  const strike = g => { if (e.dead) return; sfx.boom(0.5); addFx({ x: g.x, y: g.y + 2, z: 0, dur: 0.5, add: true, draw(c) { const k = this.t / this.dur; drawSpr(c, img, sx(this.x), sy(this.y, 0) + 6, 0, 240, { ay: 1, alpha: 1 - k }); } }); fxShock(g.x, g.y, 55, col); areaHit(e, g.x, g.y, 40, 0, { dmg: 1.3, launch: 270, knock: 60, hs: 0.08, snd: 'crit' }); };
  for (let i = 0; i < n; i++) telegraph({ x: p.x, y: p.y, r: 40, dur: 1.5 + i * 0.55, follow: p, col, fire: strike });
}
// 根须突刺：从领主脚下沿玩家所在的纵深一路刺过去（上下走开就能躲）
function bhRootWave(e, n = 7) {
  const p = game.player; if (!p) return;
  const dir = p.x >= e.x ? 1 : -1, y = p.y;
  fxText('根须来了！上下走开！', e.x, e.y, e.z + e.h * (e.scale || 1) + 12, { col: '#8aff6a', size: 12, dur: 1.2 });
  for (let i = 0; i < n; i++) { const x = e.x + dir * (90 + i * 95); if (game.room && (x < game.room.x0 + 20 || x > game.room.x1 - 20)) break; skySpikeAt(e, x, y, 1.1 + i * 0.13, { r: 40, dmg: 1.15, col: '#7aff5a', rock: '#8a6a3a' }); }
}
// 果实雨：树冠里掉下果实，一个落在玩家脚下，其余随机（红圈 1.4 秒以上）
function bhFruitRain(e, n = 6) {
  const p = game.player; if (!p) return;
  for (let i = 0; i < n; i++) {
    const x = i === 0 ? p.x : cam.x + rnd(80, WW - 80), y = i === 0 ? p.y : rnd(20, DEPTH - 20);
    telegraph({ x, y: clamp(y, 8, DEPTH - 8), r: 44, dur: 1.4 + i * 0.12, col: '#ff8a3a', fire: g => {
      if (e.dead) return; sfx.hit('blunt', false); fxDust(g.x, g.y, 8, 34, '#c84a3a');
      addFx({ x: g.x, y: g.y + 1, z: 0, dur: 0.5, draw(c) { const k = this.t / this.dur, X = sx(this.x), Y = sy(this.y, 0); c.save(); c.globalAlpha = 1 - k; c.fillStyle = '#e8503a'; for (let j = 0; j < 6; j++) { const a = j / 6 * TAU; c.beginPath(); c.arc(X + Math.cos(a) * 30 * k, Y + Math.sin(a) * 12 * k - 10 * k, 5, 0, TAU); c.fill(); } c.restore(); } });
      areaHit(e, g.x, g.y, 44, 0, { dmg: 1.1, down: true, knock: 160, hs: 0.07, snd: 'blunt', shake: 3 });
    } });
  }
}
// 夜叉王的震地咆哮：全屏冲击波贴着地面扩散——跳起来或闪避就能躲开
function bhRoarWave(e) {
  fxText('震地咆哮——跳起来躲开！', e.x, e.y, e.z + e.h * (e.scale || 1) + 14, { col: '#ffb040', size: 14, dur: 1.6 }); sfx.charge();
  const warn = 1.5, spd = 900, hitDone = new Set();
  addFx({ x: e.x, y: e.y + 1, z: 0, dur: warn + 1.4, ent: e, update(dt) {
    const E = this.ent; if (this.t < warn) { this.x = E.x; this.y = E.y + 1; return; }
    if (E.dead) { this.t = this.dur; return; }
    if (!this.boomed) { this.boomed = true; cam.shake = Math.max(cam.shake, 8); sfx.boom(1.1); }
    const R = (this.t - warn) * spd;
    for (const t of ents) if (t.team === 'p' && !t.dead && !hitDone.has(t) && Math.abs(Math.hypot(t.x - this.x, (t.y - this.y) / GR) - R) < 40) {
      hitDone.add(t); if (t.invul > 0 || t.z > 8) { fxText('躲开了！', t.x, t.y, t.z + 40, { col: '#9fe8ff', size: 11 }); continue; }
      applyHit(E, t, { dmg: 0.6, stun: 0, knock: 60, hs: 0.05, snd: 'blunt' }, { proj: true, src: { x: this.x, y: this.y, z: 0, face: Math.sign(t.x - this.x) || 1 } }); addStatus(t, 'stun', 1.0, { src: E });
    }
  }, draw(c) {
    const X = sx(this.x), Y = sy(this.y, 0);
    c.save();
    if (this.t < warn) { const k = this.t / warn, blink = Math.floor(this.t * (6 + k * 14)) % 2; c.strokeStyle = `rgba(255,120,40,${0.4 + 0.5 * blink})`; c.lineWidth = 3; c.beginPath(); c.ellipse(X, Y, 60 + 40 * k, (60 + 40 * k) * GR, 0, 0, TAU); c.stroke(); }
    else { const R = (this.t - warn) * spd, a = 1 - (this.t - warn) / 1.4; c.globalCompositeOperation = 'lighter'; c.strokeStyle = `rgba(255,150,60,${0.8 * a})`; c.lineWidth = 10; c.beginPath(); c.ellipse(X, Y, R, R * GR, 0, 0, TAU); c.stroke(); c.strokeStyle = `rgba(255,230,160,${a})`; c.lineWidth = 3; c.stroke(); }
    c.restore();
  } });
}
// 地毯轰炸：沿玩家所在的纵深从一侧炸到另一侧（多尼尔 EX）
function bhCarpetBomb(e) {
  const p = game.player; if (!p) return;
  fxText('地毯轰炸！', e.x, e.y, e.z + 120, { col: '#ff8a5a', size: 13 });
  const dir = p.x >= e.x ? 1 : -1, x0 = cam.x + (dir > 0 ? 60 : WW - 60);
  for (let i = 0; i < 8; i++) {
    const x = x0 + dir * i * 118;
    telegraph({ x, y: clamp(p.y + (i % 2 ? 26 : -26), 10, DEPTH - 10), r: 48, dur: 1.4 + i * 0.12, col: '#ff5a3a', fire: g => { if (e.dead) return; meteorImpact(g, 0.5); areaHit(e, g.x, g.y, 48, 0, { dmg: 1.2, down: true, knock: 200, hs: 0.07, snd: 'fire', shake: 4 }); } });
  }
}
// 追踪导弹：红圈跟着玩家，锁定后爆炸
function bhMissiles(e, n) {
  const p = game.player; if (!p) return;
  for (let i = 0; i < n; i++) telegraph({ x: p.x, y: p.y, r: 42, dur: 1.5 + i * 0.5, follow: p, col: '#ff7a3a', fire: g => { if (e.dead) return; meteorImpact(g, 0.45); areaHit(e, g.x, g.y, 42, 0, { dmg: 1.2, down: true, knock: 180, hs: 0.07, snd: 'fire' }); } });
}
// 触手：从领主身后伸出的粗触手（只是表现）
function bhTentacleFx(x0, y0, x1, y1, dur, col = '#6a2a8a') {
  addFx({ x: (x0 + x1) / 2, y: Math.max(y0, y1) + 2, z: 0, dur, draw(c) {
    const k = this.t / this.dur, ext = k < 0.25 ? easeOut(k / 0.25) : k > 0.75 ? 1 - (k - 0.75) / 0.25 : 1;
    const X0 = sx(x0), Y0 = sy(y0, 30), X1 = X0 + (sx(x1) - X0) * ext, Y1 = Y0 + (sy(y1, 8) - Y0) * ext, mx = (X0 + X1) / 2, my = Math.min(Y0, Y1) - 50 * ext;
    c.save(); c.lineCap = 'round';
    c.strokeStyle = '#2a0e36'; c.lineWidth = 26; c.beginPath(); c.moveTo(X0, Y0); c.quadraticCurveTo(mx, my, X1, Y1); c.stroke();
    c.strokeStyle = col; c.lineWidth = 20; c.stroke();
    c.fillStyle = '#ff9ad8'; for (let i = 1; i < 7; i++) { const u = i / 7, px = (1 - u) * (1 - u) * X0 + 2 * (1 - u) * u * mx + u * u * X1, py = (1 - u) * (1 - u) * Y0 + 2 * (1 - u) * u * my + u * u * Y1; c.beginPath(); c.arc(px, py + 5, 3.5, 0, TAU); c.fill(); }
    c.restore();
  } });
}
// 触手横扫：玩家所在的纵深先亮起一条细线（1.3 秒），然后一条触手横着扫过去
function bhTentacleSweep(e, y) {
  const dir = e.face, x0 = e.x, x1 = skyWall(e, dir), warn = 1.3;
  telegraph({ x: x0, y, kind: 'line', len: x1 - x0, face: 1, hw: 24, dur: warn, col: '#d070ff' });
  fxText('触手横扫——上下躲开！', e.x, e.y, e.z + 150, { col: '#e0a0ff', size: 12 });
  game.after(warn, () => {
    if (e.dead || !game.player) return;
    sfx.swing(true); cam.shake = Math.max(cam.shake, 5); bhTentacleFx(x0, e.y, x1, y, 0.6);
    skyLineHit(e, x0, x1, y, 26, { dmg: 1.5, down: true, knock: 220, hs: 0.09, snd: 'blunt', shake: 5 });
  });
}
// 触手连砸：紫圈跟着玩家，锁定后触手砸下来
function bhTentacleSlam(e, n) {
  const p = game.player; if (!p) return;
  for (let i = 0; i < n; i++) telegraph({ x: p.x, y: p.y, r: 44, dur: 1.4 + i * 0.5, follow: p, col: '#c060ff', fire: g => { if (e.dead) return; bhTentacleFx(e.x, e.y, g.x, g.y, 0.5); sfx.hit('blunt', true); cam.shake = Math.max(cam.shake, 4); fxDust(g.x, g.y, 8, 30, '#6a4a7a'); areaHit(e, g.x, g.y, 44, 0, { dmg: 1.3, down: true, knock: 180, hs: 0.08, snd: 'blunt' }); } });
}
// 墨汁：面前一大片地面变黑（1 秒预警），站在里面会失明、减速
function bhInk(e, r = 90) {
  const x = e.x + e.face * 110;
  telegraph({ x, y: e.y, r, dur: 1.0, col: '#8a5aff', fire: g => {
    if (e.dead) return; sfx.hit('fire', false);
    addFx({ x: g.x, y: g.y + 1, z: 0, dur: 1.2, draw(c) { const k = this.t / this.dur; c.save(); c.globalAlpha = 0.7 * (1 - k); c.fillStyle = '#140a1e'; c.beginPath(); c.ellipse(sx(this.x), sy(this.y, 0), r, r * GR, 0, 0, TAU); c.fill(); c.restore(); } });
    for (const t of ents) if (t.team === 'p' && !t.dead && t.invul <= 0 && t.z < 30 && inGround(t, g.x, g.y, r)) { applyHit(e, t, { dmg: 0.6, stun: 0.2, knock: 40, hs: 0.04, snd: 'blunt' }, { proj: true, src: { x: g.x, y: g.y, z: 0, face: e.face } }); addStatus(t, 'blind', 1.6, { src: e }); addStatus(t, 'slow', 2.5, { src: e }); }
  } });
}
// 花粉：以自己为中心的粉色圈（0.9 秒），站在里面会减速（混乱花；官方是混乱，这里改成减速）
function bhPollen(e, r = 75) {
  telegraph({ x: e.x, y: e.y, r, dur: 0.9, col: '#ff8ad8', fire: g => {
    if (e.dead) return; sfx.hit('fire', false);
    for (let i = 0; i < 10; i++) { const a = rnd(0, TAU), d = rnd(0, r); addFx({ x: g.x + Math.cos(a) * d, y: g.y + Math.sin(a) * d * GR, z: rnd(5, 40), vz: rnd(10, 40), dur: 0.9, update(dt) { this.z += this.vz * dt; }, draw(c) { const k = this.t / this.dur; c.fillStyle = `rgba(255,170,230,${0.8 * (1 - k)})`; c.beginPath(); c.arc(sx(this.x), sy(this.y, this.z), 3, 0, TAU); c.fill(); } }); }
    areaHit(e, g.x, g.y, r, 0, { dmg: 0.8, stun: 0.3, knock: 40, hs: 0.04, snd: 'blunt' }, { status: 'slow', sdur: 2.2 });
  } });
}
// 喷火：面前短距离一条火焰带（先出现短红线）
function bhFlame(e) {
  const len = 170;
  return { dur: 1.3, onStart: m => { m.flTele = telegraph({ x: m.x, y: m.y, kind: 'line', len: len * m.face, face: 1, hw: 20, dur: 0.6, col: '#ff7a2a' }); },
    events: [evAt(0.6, m => { sfx.hit('fire', false); addFx({ x: m.x + m.face * len / 2, y: m.y + 2, z: 0, dur: 0.6, add: true, f: m.face, draw(c) { const k = this.t / this.dur; drawSpr(c, 'fireball', sx(this.x), sy(this.y, 40), len * (0.8 + k * 0.4), 0, { flip: this.f < 0, alpha: 1 - k }); } }); })],
    hits: [{ t0: 0.6, t1: 1.1, rep: 0.25, box: [0, len, 22, 0, 90], dmg: 0.55, knock: 60, stun: 0.25, hs: 0.04, snd: 'fire', onHit: (a, t) => addStatus(t, 'burn', 2.5, { dps: a.atk * 0.06, src: a }) }],
    onEnd: m => { if (m.flTele) killTele(m.flTele); } };
}
// 血色护罩（审判者马塞尔）：原地升起一个护罩，他待在罩子里时受到的伤害大减——把他引出来
function bhBarrier(e) {
  const x = e.x, y = e.y, r = 95, dur = 9;
  fxText('血色护罩——把他引出罩子！', e.x, e.y, e.z + 150, { col: '#ff8a8a', size: 13, dur: 1.6 }); sfx.buff();
  e.barrier = true;
  addFx({ x, y: y + 0.5, z: 0, dur, ent: e, update(dt) {
    const E = this.ent; if (E.dead) { this.t = this.dur; return; }
    const inside = inGround(E, x, y, r - E.w); E.dmgTakenMul = inside ? 0.3 : 1;
    if (this.t > this.dur - dt * 1.5) { E.dmgTakenMul = 1; E.barrier = false; }
  }, draw(c) {
    const k = this.t / this.dur, X = sx(x), Y = sy(y, 0), a = k < 0.1 ? k / 0.1 : k > 0.9 ? (1 - k) / 0.1 : 1;
    c.save(); c.globalAlpha = 0.18 * a; c.fillStyle = '#ff3a4a'; c.beginPath(); c.ellipse(X, Y, r, r * GR, 0, 0, TAU); c.fill();
    c.globalAlpha = 0.25 * a; c.beginPath(); c.ellipse(X, Y - r * 0.55, r, r * 0.95, 0, Math.PI, 0); c.fill();
    c.globalAlpha = 0.7 * a; c.strokeStyle = '#ff8a8a'; c.lineWidth = 2; c.beginPath(); c.ellipse(X, Y, r, r * GR, 0, 0, TAU); c.stroke(); c.beginPath(); c.ellipse(X, Y - r * 0.55, r, r * 0.95, 0, Math.PI, 0); c.stroke();
    c.restore();
  } });
}
// 召唤：在领主两侧落下几只小怪（不会落在玩家头上）
function bhSummon(e, kind, n, lvl, text, col = '#ffd060') {
  if (text) fxText(text, e.x, e.y, e.z + 60, { col, size: 12 });
  const W = game.room ? game.room.x1 : 1400;
  for (let i = 0; i < n; i++) spawnMonster(kind, clamp(e.x + (i % 2 ? 1 : -1) * rnd(120, 240), 80, W - 80), rnd(20, DEPTH - 20), { lvl: lvl ?? e.lvl - 3, drop: true, ...skyMul() });
}
// 长脚罗特斯：4 秒没挨打就开始回血（官方：回血很快，要连续打）
function bhRegen(m) {
  m.lastHurt = game.t;
  if (m.regenFx && fxList.includes(m.regenFx)) return;
  m.regenFx = addFx({ x: m.x, y: m.y, z: 0, dur: 1e9, tick: 0, ent: m, update(dt) {
    const E = this.ent; if (E.dead) { this.t = this.dur; return; }
    this.x = E.x; this.y = E.y;
    if (game.t - E.lastHurt < 4 || E.hp >= E.hpMax) return;
    this.tick -= dt; if (this.tick > 0) return; this.tick = 1;
    const h = Math.round(E.hpMax * 0.006); E.hp = Math.min(E.hpMax, E.hp + h); addNumber(h, E.x, E.y, E.z + 40, { heal: true });
    if (!this.told) { this.told = true; fxText('罗特斯在回血——别停手！', E.x, E.y, E.z + 150, { col: '#8aff9a', size: 12 }); }
  }, draw() {} });
}

/* ---- 怪物表（数值是 1 级基数，按等级放大；参照天空之城的曲线） ---- */
const BH_PAL = { skin: '#d8d0c8', hair: '#e8e8e0', eye: '#ffd23a', cloth: '#2a6a6a', pants: '#e8e0d0' };
const gblMelee = (dmg = 1.0) => melee('club', 0.44, 0.52, [0, 72, 22, 10, 90], { range: [0, 64], cd: [1.6, 2.6], hit: { dmg, knock: 110, stun: 0.4, snd: 'stab' }, events: [slashAt(0.42, { a0: -1.6, a1: 0.4, r: 44, w: 9, off: [10, 44], col: '#fff2c0', silent: true })] });
const gblShamanAtk = (col) => [gblMelee(0.9), { clip: 'throw', range: [110, 380], dy: 50, cd: [4, 5.5], w: 1.6, cond: skyRangedOk, act: { dur: 0.9, onStart: skyRangedUse, events: [evAt(0.45, e => bhKnives(e, 3, { col }))] } }];
const gblBishopAtk = (summon) => [
  melee('slam', 0.7, 0.8, [-20, 90, 30, 0, 110], { range: [0, 84], cd: [2.8, 4], sa: true, w: 1.5, hit: { dmg: 1.3, down: true, knock: 200, shake: 4 }, events: [evAt(0.7, e => { fxShock(e.x + e.face * 40, e.y, 90, '#ffd060'); sfx.boom(0.4); })] }),
  { clip: 'cast', range: [0, 130], dy: 70, cd: [6, 8], act: { dur: 1.2, superArmor: true, events: [evAt(0.1, e => skyNova(e, 95, 0.9, '#ffd060', { dmg: 1.1 }))] } },
  { clip: 'roar', range: [0, 700], dy: 700, cd: [14, 18], w: 0.6, cond: () => skyAlive(summon) < 3, act: { dur: 1.2, superArmor: true, events: [evAt(0.6, e => bhSummon(e, summon, 1, null, '信徒们，出来！'))] } }];
Object.assign(MON, {
  // GBL 教：信徒（短刀）、神官（冲刺刺击）、祭司（扇形飞刀）、主教（霸体下刺 + 召唤信徒）
  gblBeliever: { name: 'GBL教信徒', lvl: 24, hp: 7500, atk: 255, def: 480, w: 13, d: 12, h: 96, weight: 1.2, speed: 95, exp: 115, gold: [30, 60], shadowR: 17, pref: 58, clips: BEAST_CLIPS,
    model: () => buildZombie(BH_PAL), attacks: [gblMelee()] },
  gblPriest: { name: 'GBL教神官', lvl: 25, hp: 7000, atk: 262, def: 460, w: 13, d: 12, h: 96, weight: 1.1, speed: 110, exp: 118, gold: [30, 60], shadowR: 17, pref: 70, clips: BEAST_CLIPS,
    model: () => buildZombie({ ...BH_PAL, cloth: '#3a4a8a' }), attacks: [gblMelee(1.05), { clip: 'chargeW', range: [130, 300], dy: 24, cd: [4, 6], act: skyDashAct(230, 560, 1.1) }] },
  gblShaman: { name: 'GBL教祭司', lvl: 26, hp: 6800, atk: 265, def: 440, w: 13, d: 12, h: 96, weight: 1.1, speed: 95, exp: 120, gold: [30, 62], shadowR: 17, pref: 220, clips: BEAST_CLIPS,
    model: () => buildZombie({ ...BH_PAL, cloth: '#6a3a6a' }), attacks: gblShamanAtk() },
  gblBishop: { name: 'GBL教主教', lvl: 26, hp: 12000, atk: 270, def: 560, w: 15, d: 13, h: 104, weight: 1.8, speed: 80, exp: 135, gold: [36, 70], shadowR: 20, pref: 70, clips: BEAST_CLIPS, scale: 1.1,
    model: () => buildZombie({ ...BH_PAL, cloth: '#c8a040' }), attacks: gblBishopAtk('gblBeliever') },
  // 天帷禁地：复活的 GBL 教徒（红黑色，数值略高）
  gblRevPriest: { name: '复活的GBL神官', lvl: 29, hp: 7800, atk: 275, def: 500, w: 13, d: 12, h: 96, weight: 1.1, speed: 115, exp: 124, gold: [34, 66], shadowR: 17, pref: 70, clips: BEAST_CLIPS,
    model: () => buildZombie({ ...BH_PAL, cloth: '#7a1a2a' }), attacks: [gblMelee(1.05), { clip: 'chargeW', range: [130, 300], dy: 24, cd: [3.8, 5.6], act: skyDashAct(240, 580, 1.1) }] },
  gblRevShaman: { name: '复活的GBL祭司', lvl: 29, hp: 7200, atk: 275, def: 470, w: 13, d: 12, h: 96, weight: 1.1, speed: 95, exp: 124, gold: [34, 66], shadowR: 17, pref: 220, clips: BEAST_CLIPS,
    model: () => buildZombie({ ...BH_PAL, cloth: '#5a1a3a' }), attacks: gblShamanAtk('#ff9a9a') },
  gblRevBishop: { name: '复活的GBL主教', lvl: 30, hp: 12500, atk: 280, def: 580, w: 15, d: 13, h: 104, weight: 1.8, speed: 80, exp: 138, gold: [36, 72], shadowR: 20, pref: 70, clips: BEAST_CLIPS, scale: 1.1,
    model: () => buildZombie({ ...BH_PAL, cloth: '#8a2a1a' }), attacks: gblBishopAtk('gblRevPriest') },
  // 章鱼：章鱼怪（触手拍 + 喷墨减速）、蓝章鱼（连喷两口）、小八爪（又小又快，会扑）
  octopus: { name: '章鱼怪', lvl: 24, hp: 7200, atk: 255, def: 470, w: 13, d: 12, h: 70, weight: 1, speed: 90, exp: 115, gold: [30, 60], shadowR: 17, pref: 60, clips: BEAST_CLIPS,
    model: () => buildCat({ fur: '#b85a9a', belly: '#f0c0e0', ear: '#8a3a6a', eye: '#ffd23a', cloth: '#6a2a5a' }),
    attacks: [melee('scratch', 0.3, 0.38, [0, 56, 20, 10, 70], { range: [0, 52], cd: [1.4, 2.4], hit: { dmg: 0.9, knock: 80, snd: 'blunt' } }),
      { clip: 'throw', range: [100, 320], dy: 36, cd: [4, 5.5], cond: skyRangedOk, act: { dur: 0.9, onStart: skyRangedUse, events: [evAt(0.45, e => shootStraight(e, { col: '#2a1a3a', dmg: 0.8, status: 'slow', speed: 240, z: 40 }))] } }] },
  octopusBlue: { name: '蓝章鱼', lvl: 27, hp: 7800, atk: 265, def: 500, w: 13, d: 12, h: 70, weight: 1, speed: 95, exp: 122, gold: [32, 62], shadowR: 17, pref: 70, clips: BEAST_CLIPS,
    model: () => buildCat({ fur: '#4a7ac8', belly: '#c0e0f0', ear: '#2a4a8a', eye: '#ffd23a', cloth: '#2a3a6a' }),
    attacks: [melee('scratch', 0.3, 0.38, [0, 56, 20, 10, 70], { range: [0, 52], cd: [1.4, 2.4], hit: { dmg: 0.95, knock: 80, snd: 'blunt' } }),
      { clip: 'throw', range: [100, 340], dy: 36, cd: [4.4, 5.8], cond: skyRangedOk, act: { dur: 1.1, onStart: skyRangedUse, events: [evAt(0.5, e => shootStraight(e, { col: '#1a2a4a', dmg: 0.8, status: 'slow', speed: 250, z: 40 }))] } }] },
  babyOcto: { name: '小八爪', lvl: 26, hp: 4200, atk: 250, def: 380, w: 10, d: 10, h: 52, weight: 0.7, speed: 160, exp: 90, gold: [20, 40], shadowR: 13, pref: 50, clips: BEAST_CLIPS, scale: 0.8,
    model: () => buildCat({ fur: '#e88a6a', belly: '#f8d0c0', ear: '#b85a3a', eye: '#ffd23a', cloth: '#8a3a2a' }),
    attacks: [melee('scratch', 0.3, 0.38, [0, 46, 18, 0, 50], { range: [0, 42], cd: [1.6, 2.6], hit: { dmg: 0.7, knock: 60, snd: 'blunt' } }), { clip: 'pounce', range: [80, 240], dy: 30, cd: [4.5, 6], act: pounceAct(0.85) }] },
  // 夜叉：双刀连斩 + 短冲刺
  yaksha: { name: '夜叉', lvl: 26, hp: 9000, atk: 268, def: 520, w: 14, d: 12, h: 100, weight: 1.3, speed: 115, exp: 125, gold: [32, 64], shadowR: 18, pref: 60, clips: BEAST_CLIPS,
    model: () => buildZombie({ skin: '#b83a2a', hair: '#f0f0f0', eye: '#ffd23a', cloth: '#1a1a1a', pants: '#2a1a1a' }),
    attacks: [
      { clip: 'atk1', range: [0, 70], dy: 16, cd: [1.4, 2.4], w: 1.5, act: { dur: 0.8, hits: [{ t0: 0.1, t1: 0.16, box: [0, 70, 22, 10, 90], dmg: 0.7, stun: 0.3, knock: 60, hs: 0.05, snd: 'slash' }, { t0: 0.42, t1: 0.48, box: [0, 70, 22, 10, 90], dmg: 0.85, stun: 0.4, knock: 140, hs: 0.06, snd: 'slash' }], events: [slashAt(0.09, { a0: -2.2, a1: 0.7, r: 42, w: 10, off: [10, 44], col: '#ff9a6a' }), evAt(0.38, e => e.play('atk2', true)), slashAt(0.4, { a0: 1.0, a1: -2.0, r: 42, w: 10, off: [10, 44], col: '#ff9a6a' })] } },
      { clip: 'chargeW', range: [130, 300], dy: 24, cd: [4, 6], act: skyDashAct(240, 600, 1.1) }] },
  // 树精：慢，砸地霸体 + 脚下冒根刺；树魔：更硬
  treant: { name: '树精', lvl: 25, hp: 12000, atk: 260, def: 600, w: 18, d: 14, h: 112, weight: 2.6, speed: 55, exp: 128, gold: [32, 64], shadowR: 24, pref: 70, clips: BEAST_CLIPS,
    model: () => buildTau({ fur: '#7a5a3a', muzzle: '#a88a60', horn: '#4a8a3a', eye: '#8aff6a', cloth: '#3a6a2a' }, { weapon: 'none' }),
    attacks: [
      melee('slam', 0.7, 0.8, [-10, 100, 32, 0, 110], { range: [0, 90], cd: [2.6, 3.8], sa: true, hit: { dmg: 1.3, down: true, knock: 200, shake: 5 }, events: [evAt(0.7, e => { fxDust(e.x + e.face * 50, e.y, 10, 30, '#6a5a3a'); sfx.boom(0.5); })] }),
      { clip: 'cast', range: [0, 420], dy: 420, cd: [4, 6], act: { dur: 1.2, events: [evAt(0.25, e => { const p = game.player; if (p) skySpikeAt(e, p.x, p.y, 1.1, { r: 38, dmg: 1.05, follow: p, col: '#7aff5a', rock: '#8a6a3a' }); })] } }] },
  treantDark: { name: '树魔', lvl: 26, hp: 12500, atk: 268, def: 620, w: 18, d: 14, h: 112, weight: 2.6, speed: 60, exp: 130, gold: [32, 64], shadowR: 24, pref: 70, clips: BEAST_CLIPS, scale: 1.05,
    model: () => buildTau({ fur: '#4a3a5a', muzzle: '#6a5a7a', horn: '#6a3a8a', eye: '#d06aff', cloth: '#3a2a4a' }, { weapon: 'none' }),
    attacks: [
      melee('slam', 0.7, 0.8, [-10, 100, 32, 0, 110], { range: [0, 90], cd: [2.4, 3.6], sa: true, hit: { dmg: 1.35, down: true, knock: 200, shake: 5 }, events: [evAt(0.7, e => { fxDust(e.x + e.face * 50, e.y, 10, 30, '#5a4a6a'); sfx.boom(0.5); })] }),
      { clip: 'cast', range: [0, 420], dy: 420, cd: [4, 6], act: { dur: 1.3, events: [evAt(0.25, e => { const p = game.player; if (!p) return; skySpikeAt(e, p.x, p.y, 1.1, { r: 38, dmg: 1.05, follow: p, col: '#d06aff', rock: '#6a4a7a', status: 'slow', sdur: 2 }); })] } }] },
  // 混乱花：扎根不动，走近会喷花粉（减速）
  flower: { name: '混乱花', lvl: 25, hp: 5000, atk: 250, def: 300, w: 12, d: 12, h: 60, weight: 99, speed: 0, exp: 80, gold: [16, 32], shadowR: 16, pref: 0, clips: BEAST_CLIPS, noGrab: true,
    model: () => buildCat({ fur: '#e87ac8', belly: '#ffd0f0', ear: '#4aa03a', eye: '#ffd23a', cloth: '#2a6a2a' }),
    attacks: [melee('bite', 0.3, 0.42, [0, 50, 20, 0, 60], { range: [0, 46], dy: 20, cd: [1.6, 2.6], hit: { dmg: 0.8, knock: 60, snd: 'stab' } }),
      { clip: 'cast', range: [0, 110], dy: 60, cd: [3.5, 5], w: 1.5, act: { dur: 1.2, events: [evAt(0.05, e => bhPollen(e))] } }] },
  // 龙头炮：慢慢推着走，远远地打炮（落点有红圈）；火焰龙头炮：近距离喷火；激光龙头：同一纵深的激光（先出细线）
  dragonCannon: { name: '龙头炮', lvl: 24, hp: 8000, atk: 260, def: 520, w: 16, d: 13, h: 66, weight: 2.4, speed: 45, exp: 118, gold: [30, 60], shadowR: 20, pref: 260, clips: BEAST_CLIPS, noGrab: true,
    model: () => buildTau({ fur: '#b8883a', muzzle: '#d8b060', horn: '#8a6a2a', eye: '#ff8a2a', cloth: '#6a4a2a' }, { weapon: 'none' }),
    attacks: [{ clip: 'throw', range: [140, 540], dy: 200, cd: [4, 5.5], cond: skyRangedOk, act: { dur: 0.9, onStart: skyRangedUse, events: [evAt(0.45, e => bhLob(e, { r: 46, dmg: 1.1 }))] } }] },
  fireCannon: { name: '火焰龙头炮', lvl: 27, hp: 8600, atk: 268, def: 540, w: 16, d: 13, h: 66, weight: 2.4, speed: 55, exp: 124, gold: [32, 62], shadowR: 20, pref: 110, clips: BEAST_CLIPS, noGrab: true,
    model: () => buildTau({ fur: '#c8502a', muzzle: '#e8804a', horn: '#8a3a1a', eye: '#ffd23a', cloth: '#6a2a1a' }, { weapon: 'none' }),
    attacks: [{ clip: 'cast', range: [0, 160], dy: 22, cd: [3, 4.4], w: 1.4, act: bhFlame() },
      { clip: 'throw', range: [180, 540], dy: 200, cd: [5, 6.5], cond: skyRangedOk, act: { dur: 0.9, onStart: skyRangedUse, events: [evAt(0.45, e => bhLob(e, { r: 46, dmg: 1.1, status: 'burn', sdur: 2, dps: 0.06 }))] } }] },
  laserCannon: { name: '激光龙头', lvl: 28, hp: 9000, atk: 272, def: 560, w: 16, d: 13, h: 66, weight: 2.4, speed: 50, exp: 126, gold: [32, 64], shadowR: 20, pref: 320, clips: BEAST_CLIPS, noGrab: true,
    model: () => buildTau({ fur: '#3a8ab8', muzzle: '#6ab0d8', horn: '#2a5a8a', eye: '#aef0ff', cloth: '#2a4a6a' }, { weapon: 'none' }),
    attacks: [{ clip: 'cast', range: [140, 900], dy: 20, cd: [6.5, 8.5], cond: skyRangedOk, act: { dur: 1.6, onStart: skyRangedUse, events: [evAt(0.1, e => skyLaser(e, e.y, { dmg: 1.1, warn: 1.3, col: '#9ae8ff' }))] } }] },
  // 锯角撞车：低头蓄力后直线冲撞（红色路线）；贴身时锯片连续切割
  sawCart: { name: '锯角撞车', lvl: 27, hp: 10500, atk: 270, def: 600, w: 18, d: 14, h: 74, weight: 2.6, speed: 70, exp: 128, gold: [32, 64], shadowR: 22, pref: 90, clips: BEAST_CLIPS, noGrab: true,
    model: () => buildTau({ fur: '#8a6a4a', muzzle: '#b8905a', horn: '#d8d8d8', eye: '#ff3a2a', cloth: '#5a3a2a' }, { weapon: 'none' }),
    attacks: [{ clip: 'scratch', range: [0, 70], dy: 18, cd: [2, 3], act: { dur: 0.9, hits: [{ t0: 0.25, t1: 0.7, rep: 0.15, box: [0, 70, 22, 0, 70], dmg: 0.4, stun: 0.25, knock: 40, hs: 0.03, snd: 'slash' }], events: [evAt(0.2, () => sfx.swing(true))] } },
      { clip: 'chargeW', range: [150, 460], dy: 20, cd: [4.5, 6.5], w: 1.3, act: tauCharge(1.0) }] },
  // 多尼尔：飞在空中的小飞艇，往玩家脚下扔炸弹（红圈 1.1 秒）
  donnier: { name: '多尼尔', lvl: 27, hp: 6500, atk: 262, def: 450, w: 14, d: 12, h: 70, weight: 1.2, speed: 100, exp: 120, gold: [30, 62], shadowR: 16, pref: 90, clips: BEAST_CLIPS, noGrab: true,
    model: () => buildCat({ fur: '#e8e0d0', belly: '#ffffff', ear: '#c8a040', eye: '#6ac8ff', cloth: '#3a6a9a' }),
    attacks: [{ clip: 'cast', range: [0, 300], dy: 200, cd: [4, 5.5], cond: skyRangedOk, act: { dur: 1.3, onStart: skyRangedUse, events: [evAt(0.2, e => { const p = game.player; if (!p) return; telegraph({ x: p.x, y: p.y, r: 44, dur: 1.1, col: '#ff5a3a', fire: g => { if (e.dead) return; meteorImpact(g, 0.45); areaHit(e, g.x, g.y, 44, 0, { dmg: 1.1, down: true, knock: 180, hs: 0.07, snd: 'fire' }); } }); })] } }] },
  // 精英：园丁鲁尔（会种混乱花的树精）、巨型黑章鱼（会旋转、喷墨、召唤小八爪；官方是第一脊椎的领主）
  blackOctopus: { name: '巨型黑章鱼', lvl: 29, hp: 12000, atk: 275, def: 600, w: 34, d: 22, h: 160, weight: 5, speed: 60, exp: 230, gold: [50, 100], shadowR: 44, pref: 90, clips: BEAST_CLIPS, scale: 2.1, noGrab: true,
    model: () => buildCat({ fur: '#3a2a4a', belly: '#6a5a7a', ear: '#2a1a3a', eye: '#ff3a3a', cloth: '#1a0a2a' }),
    attacks: [
      { clip: 'roar', range: [0, 145], dy: 60, cd: [5, 7], w: 1.4, act: { dur: 2.0, superArmor: true, onStart: e => { e.spinTele = telegraph({ x: e.x, y: e.y, r: 135, dur: 0.9, col: '#ff5a8a', follow: e }); fxText('要转起来了！', e.x, e.y, e.z + 190, { col: '#ff9ad8', size: 12 }); },
        onEnd: e => { if (e.spinTele) killTele(e.spinTele); }, hits: [{ t0: 0.9, t1: 1.8, rep: 0.45, box: [-135, 135, 60, 0, 120], dmg: 0.55, knock: 160, stun: 0.3, hs: 0.04, snd: 'blunt' }], events: [evAt(0.8, e => { sfx.swing(true); for (let i = 0; i < 4; i++) game.after(i * 0.28, () => { if (!e.dead) fxShock(e.x, e.y, 135, '#b060d0'); }); })] } },
      { clip: 'throw', range: [80, 380], dy: 60, cd: [5, 7], act: { dur: 1.2, events: [evAt(0.1, e => bhInk(e, 90))] } },
      { clip: 'cast', range: [0, 700], dy: 700, cd: [12, 16], w: 0.7, cond: () => skyAlive('babyOcto') < 3, act: { dur: 1.2, superArmor: true, events: [evAt(0.6, e => bhSummon(e, 'babyOcto', 2, null, '孩子们！', '#ff9ad8'))] } }] },
  // 大祭司：和大主教一起出现在神殿外围的领主房；她活着时大主教有圣光护盾（见下方 roomEnter）
  gblHighPriest: { name: 'GBL教大祭司', lvl: 26, hp: 26000, atk: 290, def: 480, w: 13, d: 12, h: 116, weight: 2, speed: 90, exp: 900, gold: [120, 240], shadowR: 18, pref: 170, clips: BEAST_CLIPS, scale: 1.1, bars: 8,
    model: () => buildZombie({ ...BH_PAL, cloth: '#5a2a7a' }),
    attacks: [
      { clip: 'cast', range: [0, 420], dy: 60, cd: [4, 5.5], w: 1.6, act: { dur: 1.0, events: [evAt(0.4, e => shootStraight(e, { col: '#b070ff', dmg: 0.8, status: 'slow', speed: 240, glow: true, z: 60 }))] } },
      { clip: 'cast', range: [0, 700], dy: 700, cd: [7, 9], act: { dur: 1.2, events: [evAt(0.25, e => { const p = game.player; if (p) skySpikeAt(e, p.x, p.y, 1.2, { r: 40, dmg: 1.05, follow: p, col: '#b070ff', rock: '#8a6aa8' }); })] } },
      { clip: 'heal', range: [0, 900], dy: 900, cd: [12, 16], w: 2, cond: m => { const b = game.dungeon && game.dungeon.boss; return !!(b && !b.dead && b.hp < b.hpMax * 0.9); },
        act: { dur: 2.2, breakable: 0.06, onStart: e => { e.breakDmg = 0; fxText('大祭司在祈祷——打断她！', e.x, e.y, e.z + 140, { col: '#e0a0ff', size: 13, dur: 1.8 }); sfx.charge(); },
          events: [evAt(2.0, e => { const b = game.dungeon && game.dungeon.boss; if (!b || b.dead) return; const h = Math.round(b.hpMax * 0.04); b.hp = Math.min(b.hpMax, b.hp + h); addNumber(h, b.x, b.y, b.z + 40, { heal: true }); sfx.buff(); fxAura(b, '#8aff9a', 0.8); })] } }] },

  /* ---- 领主 ---- */
  // GBL教大主教（神殿外围）：杖击、圣光柱（跟随后锁定）、圣光环、召唤信徒；大祭司活着时有护盾
  gblArchbishop: { name: 'GBL教大主教', lvl: 26, hp: 125000, atk: 320, def: 600, w: 16, d: 14, h: 124, weight: 3, speed: 85, exp: 3500, gold: [400, 720], shadowR: 24, pref: 110, clips: BEAST_CLIPS, scale: 1.15, bars: 24,
    model: () => buildZombie({ ...BH_PAL, cloth: '#e8e0c8', eye: '#ffd23a' }),
    attacks: [
      melee('club', 0.44, 0.52, [0, 110, 28, 10, 120], { range: [0, 100], cd: [1.5, 2.5], w: 2, hit: { dmg: 1.2, knock: 150, stun: 0.45 } }),
      { clip: 'cast', range: [0, 900], dy: 900, cd: [6, 8], w: 1.6, act: { dur: 1.8, superArmor: true, events: [evAt(0.2, e => bhHolyPillars(e, e.enraged ? 4 : 3))] } },
      { clip: 'cast', range: [0, 160], dy: 90, cd: [6, 8], w: 1.3, act: { dur: 1.4, superArmor: true, events: [evAt(0.1, e => skyNova(e, 130, 1.0, '#ffe070', { dmg: 1.3 }))] } },
      { clip: 'roar', range: [0, 900], dy: 900, cd: [16, 22], w: 0.8, cond: () => skyAlive('gblBeliever') < 2, act: { dur: 1.3, superArmor: true, events: [evAt(0.6, e => bhSummon(e, 'gblBeliever', 2, null, '信徒们，净化入侵者！'))] } }] },
  // 巨树守护者 罗丁（树精丛林）：横扫、根须突刺（沿纵深推进）、果实雨、种下混乱花
  rodin: { name: '巨树守护者 罗丁', lvl: 27, hp: 150000, atk: 325, def: 640, w: 22, d: 16, h: 150, weight: 6, speed: 55, exp: 3700, gold: [420, 760], shadowR: 30, pref: 90, clips: BEAST_CLIPS, scale: 1.15, bars: 26, noGrab: true,
    model: () => buildTau({ fur: '#6a4a2a', muzzle: '#9a7a50', horn: '#3a8a2a', eye: '#ffb030', cloth: '#2a5a1a' }, { weapon: 'none', big: true }),
    onDamaged: (m) => { m.superArmor = Math.max(m.superArmor, 0.25); },
    attacks: [
      melee('slam', 0.7, 0.8, [-30, 130, 40, 0, 140], { range: [0, 120], dy: 30, cd: [2, 3], sa: true, w: 2, hit: { dmg: 1.4, down: true, knock: 220, shake: 5 }, events: [evAt(0.7, e => { fxDust(e.x + e.face * 60, e.y, 12, 40, '#6a5a3a'); sfx.boom(0.6); })] }),
      { clip: 'cast', range: [0, 900], dy: 900, cd: [5, 7], w: 1.5, act: { dur: 1.6, superArmor: true, events: [evAt(0.2, e => bhRootWave(e, e.enraged ? 9 : 7))] } },
      { clip: 'roar', range: [0, 900], dy: 900, cd: [7, 10], w: 1.2, act: { dur: 1.4, superArmor: true, events: [evAt(0.3, e => bhFruitRain(e, e.enraged ? 8 : 6))] } },
      { clip: 'roar', range: [0, 900], dy: 900, cd: [16, 22], w: 0.8, cond: () => skyAlive('flower') < 2, act: { dur: 1.3, superArmor: true, events: [evAt(0.6, e => bhSummon(e, 'flower', 2, null, '森林啊，开花吧！', '#ff9ad8'))] } }] },
  // 夜叉王（炼狱）：官方“速度快、常霸体、全屏眩晕”——双斩、带预警的瞬斩、业火斩、震地咆哮（跳起来躲）
  yakshaKing: { name: '夜叉王', lvl: 28, hp: 150000, atk: 330, def: 620, w: 16, d: 14, h: 126, weight: 3, speed: 125, exp: 3900, gold: [440, 780], shadowR: 24, pref: 80, clips: BEAST_CLIPS, scale: 1.15, bars: 26,
    model: () => buildZombie({ skin: '#c8302a', hair: '#fff0e0', eye: '#ffd23a', cloth: '#1a1a1a', pants: '#3a0a0a' }),
    attacks: [
      { clip: 'club', range: [0, 110], dy: 20, cd: [1.6, 2.6], w: 2, act: { dur: 1.3, hits: [{ t0: 0.44, t1: 0.52, box: [0, 118, 28, 10, 120], dmg: 1.1, knock: 110, stun: 0.45, hs: 0.07, snd: 'slash' }, { t0: 0.94, t1: 1.02, box: [0, 118, 28, 10, 120], dmg: 1.3, knock: 200, stun: 0.5, hs: 0.08, snd: 'slash', shake: 3 }],
        events: [slashAt(0.42, { a0: -2.2, a1: 0.8, r: 70, w: 14, off: [10, 55], col: '#ff8a4a', silent: true }), evAt(0.6, e => e.play('club', true)), slashAt(0.92, { a0: 1.0, a1: -2.0, r: 70, w: 14, off: [10, 55], col: '#ff8a4a' })] } },
      { clip: 'chargeW', range: [150, 700], dy: 40, cd: [4.5, 6.5], w: 1.3, act: bhDash(460, 720, 1.3, 0.8) },
      { clip: 'throw', range: [0, 600], dy: 40, cd: [4, 6], w: 1.2, act: { dur: 1.0, events: [evAt(0.45, e => shootStraight(e, { col: '#ff7a2a', dmg: 1.2, status: 'burn', speed: 300, pierce: true, trail: true, glow: true, z: 40 }))] } },
      { clip: 'roar', range: [0, 900], dy: 900, cd: [11, 15], w: 1, act: { dur: 2.4, superArmor: true, events: [evAt(0.05, e => bhRoarWave(e))] } }] },
  // 多尼尔（EX）（极昼）：飞艇——炮击、地毯轰炸、激光扫射、追踪导弹、空投信徒
  donnierEX: { name: '多尼尔（EX）', lvl: 29, hp: 158000, atk: 332, def: 600, w: 22, d: 16, h: 104, weight: 5, speed: 80, exp: 4100, gold: [460, 820], shadowR: 30, pref: 200, clips: BEAST_CLIPS, scale: 1.2, bars: 28, noGrab: true,
    model: () => buildCat({ fur: '#f0e8d8', belly: '#ffffff', ear: '#c8a040', eye: '#ff4a3a', cloth: '#2a4a8a' }),
    onDamaged: (m) => { m.superArmor = Math.max(m.superArmor, 0.25); },
    attacks: [
      { clip: 'cast', range: [0, 700], dy: 700, cd: [3.4, 4.6], w: 2, act: { dur: 1.2, events: [evAt(0.3, e => { const p = game.player; if (!p) return; bhLob(e, { r: 48, dmg: 1.2, z0: 90 }); bhLob(e, { r: 48, dmg: 1.2, z0: 90, x: p.x + rnd(-160, 160), y: p.y + rnd(-50, 50) }); })] } },
      { clip: 'cast', range: [0, 900], dy: 900, cd: [7, 9], w: 1.4, act: { dur: 2.2, superArmor: true, events: [evAt(0.2, e => bhCarpetBomb(e))] } },
      { clip: 'cast', range: [120, 900], dy: 40, cd: [5, 7], w: 1.3, act: { dur: 1.9, superArmor: true, events: [evAt(0.15, e => skyLaser(e, e.y, { dmg: 1.6, col: '#ff8a8a' }))] } },
      { clip: 'cast', range: [0, 900], dy: 900, cd: [8, 11], w: 1.1, act: { dur: 1.6, superArmor: true, events: [evAt(0.2, e => bhMissiles(e, e.enraged ? 4 : 3))] } },
      { clip: 'roar', range: [0, 900], dy: 900, cd: [18, 24], w: 0.7, cond: () => skyAlive('gblBeliever') < 2, act: { dur: 1.3, superArmor: true, events: [evAt(0.6, e => bhSummon(e, 'gblBeliever', 2, null, '空投！', '#ff8a5a'))] } }] },
  // 长脚罗特斯（第二脊椎）：几乎不动；触手横扫（沿纵深，先出细线）、触手连砸、喷墨、召唤小八爪；4 秒没挨打会回血
  lotus: { name: '长脚罗特斯', lvl: 30, hp: 170000, atk: 338, def: 650, w: 26, d: 18, h: 140, weight: 9, speed: 22, exp: 4400, gold: [480, 860], shadowR: 34, pref: 140, clips: BEAST_CLIPS, scale: 1.25, bars: 30, noGrab: true,
    model: () => buildCat({ fur: '#4a2a5a', belly: '#8a5a9a', ear: '#2a1a3a', eye: '#ff3a3a', cloth: '#1a0a2a', eyeGlow: true }),
    onDamaged: (m) => { m.superArmor = Math.max(m.superArmor, 0.3); bhRegen(m); },
    attacks: [
      melee('slam', 0.7, 0.8, [-60, 140, 50, 0, 120], { range: [0, 130], dy: 40, cd: [2.8, 3.8], sa: true, w: 2, hit: { dmg: 1.4, down: true, knock: 220, shake: 5 }, events: [evAt(0.7, e => { bhTentacleFx(e.x, e.y, e.x + e.face * 120, e.y, 0.4); sfx.boom(0.6); })] }),
      { clip: 'cast', range: [0, 900], dy: 900, cd: [5, 7], w: 1.6, act: { dur: 1.8, superArmor: true, events: [evAt(0.1, e => { const p = game.player; if (p) bhTentacleSweep(e, p.y); })] } },
      { clip: 'roar', range: [0, 900], dy: 900, cd: [6, 8], w: 1.3, act: { dur: 1.6, superArmor: true, events: [evAt(0.2, e => bhTentacleSlam(e, e.enraged ? 4 : 3))] } },
      { clip: 'throw', range: [0, 300], dy: 60, cd: [5, 7], w: 1.1, act: { dur: 1.3, superArmor: true, events: [evAt(0.1, e => bhInk(e))] } },
      { clip: 'roar', range: [0, 900], dy: 900, cd: [20, 26], w: 0.8, cond: () => skyAlive('babyOcto') < 2, act: { dur: 1.3, superArmor: true, events: [evAt(0.6, e => bhSummon(e, 'babyOcto', 2, null, '去吧，小八爪们！', '#ff9ad8'))] } }] },
  // 审判者马塞尔（天帷禁地）：官方“全程霸体”——三连飞刀（上下错开）、拔刀刺、震飞、血色护罩（把他引出来）、复活教徒
  marcel: { name: '审判者马塞尔', lvl: 30, hp: 165000, atk: 340, def: 650, w: 16, d: 14, h: 122, weight: 3, speed: 95, exp: 4500, gold: [480, 860], shadowR: 24, pref: 120, clips: BEAST_CLIPS, scale: 1.15, bars: 30,
    model: () => buildZombie({ skin: '#e0d8e0', hair: '#1a1a1a', eye: '#ff3a3a', cloth: '#6a0a1a', pants: '#1a0a0a' }),
    onDamaged: (m) => { m.superArmor = Math.max(m.superArmor, 0.3); },
    attacks: [
      { clip: 'throw', range: [100, 480], dy: 70, cd: [2.5, 3.5], w: 2, act: { dur: 1.0, events: [evAt(0.45, e => bhKnives(e, 3, { dmg: 0.8, col: '#ffc8c8' }))] } },
      { clip: 'chargeW', range: [120, 420], dy: 26, cd: [4, 6], w: 1.3, act: bhDash(320, 650, 1.3, 0.75) },
      { clip: 'slam', range: [0, 150], dy: 70, cd: [5, 7], w: 1.2, act: { dur: 1.4, superArmor: true, events: [evAt(0.05, e => skyNova(e, 120, 0.9, '#ff4a5a', { dmg: 1.3 }))] } },
      { clip: 'cast', range: [0, 900], dy: 900, cd: [16, 20], w: 1, cond: m => !m.barrier, act: { dur: 1.0, superArmor: true, events: [evAt(0.4, e => bhBarrier(e))] } },
      { clip: 'roar', range: [0, 900], dy: 900, cd: [20, 26], w: 0.7, cond: () => skyAlive('gblRevPriest') < 2, act: { dur: 1.3, superArmor: true, events: [evAt(0.6, e => bhSummon(e, 'gblRevPriest', 2, null, '起来吧，我的信徒们……', '#ff8a8a'))] } }] },
});
// 园丁鲁尔在树精的基础上加一招（要等 MON.treant 定义好）
Object.assign(MON, {
  gardenerRul: { ...MON.treant, name: '园丁鲁尔', lvl: 26, hp: 14000, atk: 268, def: 620, exp: 190, gold: [40, 80], scale: 1.15,
    attacks: [...MON.treant.attacks, { clip: 'roar', range: [0, 700], dy: 700, cd: [12, 16], w: 0.8, cond: () => skyAlive('flower') < 3, act: { dur: 1.2, superArmor: true, events: [evAt(0.6, e => bhSummon(e, 'flower', 2, null, '开花吧！', '#ff9ad8'))] } }] },
});
MON.gblBishop.summons = ['gblBeliever']; MON.gblRevBishop.summons = ['gblRevPriest']; MON.gardenerRul.summons = ['flower']; MON.blackOctopus.summons = ['babyOcto'];
MON.gblArchbishop.summons = ['gblBeliever', 'gblHighPriest']; MON.rodin.summons = ['flower']; MON.donnierEX.summons = ['gblBeliever']; MON.lotus.summons = ['babyOcto']; MON.marcel.summons = ['gblRevPriest'];

/* ---- 美术：逐帧精灵（art/final/spr/<id>），变种用染色 ---- */
Object.assign(MON_ART, {
  gblBeliever: ['gbl'], gblPriest: ['gbl', { hue: 40, sat: 1.1 }], gblShaman: ['gbl', { hue: 100, sat: 1.1 }], gblBishop: ['gbl', { hue: -140, sat: 1.3, bright: 1.05 }],
  gblRevPriest: ['gbl', { hue: 170, sat: 1.4, bright: 0.75 }], gblRevShaman: ['gbl', { hue: 140, sat: 1.3, bright: 0.7 }], gblRevBishop: ['gbl', { hue: 180, sat: 1.6, bright: 0.8 }],
  octopus: ['octopus'], octopusBlue: ['octopus', { hue: -90, sat: 1.1 }], babyOcto: ['octopus', { hue: 40, sat: 1.2, bright: 1.1 }], blackOctopus: ['octopus', { hue: -40, sat: 0.75, bright: 0.42 }],
  yaksha: ['yaksha'], treant: ['treant'], treantDark: ['treant', { hue: 150, sat: 0.9, bright: 0.75 }], gardenerRul: ['treant', { hue: 40, sat: 1.25, bright: 1.1 }],
  flower: ['flower'], dragonCannon: ['dragonCannon'], fireCannon: ['dragonCannon', { hue: -30, sat: 1.5 }], laserCannon: ['dragonCannon', { hue: 170, sat: 1.1 }],
  sawCart: ['sawCart'], donnier: ['donnier'],
  gblArchbishop: ['archbishop'], gblHighPriest: ['highPriest'], rodin: ['rodin'], yakshaKing: ['yakshaKing'], donnierEX: ['donnierEX'], lotus: ['lotus'], marcel: ['marcel'],
});

/* ---- 房间机关 ---- */
// 神殿外围的领主房：大主教身边还有大祭司；大祭司活着时，大主教身上有圣光护盾（受到的伤害 ×0.6）
bus.on('roomEnter', d => {
  if (d.id !== 'temple_outskirts' || d.type !== 'boss' || !game.dungeon) return;
  const b = game.dungeon.boss; if (!b || b.dead || b.remove) return;
  const W = game.room ? game.room.x1 : 1400;
  const pr = spawnMonster('gblHighPriest', W - 170, clamp(b.y + 60, 20, DEPTH - 20), { lvl: game.dungeon.def.boss.lvl, ...skyMul() });
  if (!pr || pr.dead || pr.remove) return;
  b.dmgTakenMul = 0.6;
  game.after(1.2, () => fxText('大祭司在守护大主教——先打倒大祭司！', b.x, b.y, b.z + 160, { col: '#ffe070', size: 14, dur: 2 }));
  addFx({ x: b.x, y: b.y + 1, z: 0, dur: 1e9, update() {
    this.x = b.x; this.y = b.y + 1;
    if (b.dead) { this.t = this.dur; return; }
    if (pr.dead || pr.remove) { this.t = this.dur; b.dmgTakenMul = 1; fxText('圣光护盾破碎了！', b.x, b.y, b.z + 150, { col: '#ffe070', size: 15, dur: 1.6 }); fxBurst(b.x, b.y, 70, 200, '#ffe070'); sfx.boom(0.6); }
  }, draw(c) {
    const X = sx(this.x), Y = sy(this.y, 0), r = 48 + Math.sin(game.t * 3) * 3, H = b.h * (b.scale || 1);
    c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.28; c.strokeStyle = '#ffe070'; c.lineWidth = 3;
    c.beginPath(); c.ellipse(X, Y - H * 0.5, r, H * 0.62, 0, 0, TAU); c.stroke();
    c.globalAlpha = 0.12; c.fillStyle = '#ffe070'; c.fill(); c.restore();
  } });
});
// 第二脊椎：通往领主房的前一个房间里一定有巨型黑章鱼（官方是第一脊椎的领主；精英房是随机的，这样任务「巨型黑章鱼」每次都能完成）
bus.on('roomEnter', d => {
  const D = game.dungeon; if (d.id !== 'second_spine' || !D || D.octoSpawned || d.type === 'boss' || !d.room) return;
  if (!Object.values(d.room.doors || {}).some(r => r.type === 'boss')) return;
  D.octoSpawned = true;
  const W = game.room ? game.room.x1 : 1400;
  spawnMonster('blackOctopus', W * 0.62, DEPTH / 2, { lvl: D.def.lvl[1], elite: true, ...skyMul() });
  game.after(0.8, () => toastMsg('巨型黑章鱼挡住了去路！', '#ff9ad8'));
});
