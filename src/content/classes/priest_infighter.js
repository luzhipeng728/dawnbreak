/* =====================================================================
   圣职者转职：蓝拳圣使（男，转职 id monk，技能前缀 pi_ = Infighter）—— 转职技能（官方 Lv15~45 → 本作 15~20）；觉醒三段见 priest_infighter_p1.js
   官方现版（namu 인파이터(던전앤파이터)/남자/스킬 2026、wiki.dfo.world 各技能页、国服官网 2020 三觉专题）；逐技能对照 docs/skills/priest_infighter_final.md
   手感核心：
   - 意念驱动：巨兵插在地上（进地下城 / 换房间 / 决斗开局自动插在脚下；按住技能键收回，收回后本房间不再自动插），750px 光环里暴击伤害 / 暴击率提高、技能冷却 −10%；
     插着巨兵时普攻变成拳击 4 连（刺拳 → 刺拳 → 直拳 → 上勾拳）+ 跑攻上段钩拳；除神圣反击外的转职技能都要先插巨兵；空斩打 / 落凤锤插着巨兵时不能用
   - 俯冲（Z）/ 摆动（↓↓+C）：0.25 秒无敌的前冲 / 后撤，互相取消；俯冲中 X / ↑X / ↓X = 俯冲直拳 / 翔拳 / 腹拳，摆动中 X = 破碎之锤（技巧精通后互通）
   - 神圣反击：祈祷架势中正面挨打 → 受到的伤害 −90%，冲上去一记腹拳反击；幻影化身：影子分身追加打击；干涸之泉（一觉）：神击技能之间互相取消（3.5 秒一次）
   动作：精灵帧用 P-art 的 pm_duck / pm_sway / pm_jab / pm_straight / pm_upper / pm_rush1~2 / pm_counter + 基础帧（docs/PRIEST_ART.md §7，PI_ANIMS）；CLIPS.priest.pi* 是矢量模型用的同名片段
   ===================================================================== */
const PIJ = 'monk';
const PI_COL = { fist: '#9fd8ff', hot: '#cfeaff', holy: '#ffe38a', gold: '#ffd24a', shadow: '#5a5a9a', nuke: '#ffa04a' };
const piOn = p => !!p && p.cls === 'priest' && jobOf(p) === PIJ;
const piPad = p => p.pad || { dx: () => 0, dy: () => 0, is: () => false, buffered: () => false, consume: () => {} };
const piMovable = t => !t.boss && !(hasSA(t) && t.st !== 'hit' && t.st !== 'air');
const piScene = () => game.scene === 'dungeon' || game.scene === 'test';

/* ---- 意念驱动：巨兵插在地上（p.piWill = { x, y, room }）；手动收回的房间里不自动插（p.piWillOff = 那个房间）---- */
const piWillOn = p => !!(p && p.piWill && p.piWill.room === game.room);
function piPlant(p, x, y, quiet) {
  const R = game.room; p.piWill = { x: R ? clamp(x, R.x0 + 20, R.x1 - 20) : x, y: clamp(y, 4, DEPTH - 4), room: game.room, t: game.t }; p.piWillOff = null;
  piWillFx(p);
  if (!quiet) { fxShock(p.piWill.x, p.piWill.y, 150, PI_COL.fist); fxDust(p.piWill.x, p.piWill.y, 6, 20); sfx.thud(0.8); }
}
function piRetrieve(p) { if (!p.piWill) return; fxSpr('burst', p.piWill.x, p.piWill.y, 60, { w: 90, dur: 0.3, col: PI_COL.fist }); p.piWill = null; p.piWillOff = game.room; delete p.buffs.pi_shadow; fxText('收回巨兵', p.x, p.y, p.z + 30, { col: PI_COL.hot, size: 11 }); sfx.swing(false); }
// 转职技能的前提：巨兵插着。地下城 / 测试房 / 决斗场没插、且这个房间没手动收回过 → 自动插在脚下。
// 决斗每一局开始重新插（上一局收回的不算到下一局）。
function piEnsureWill(p) {
  if (game.duel && p._piDuelRound !== game.duel.round) { p._piDuelRound = game.duel.round; p.piWillOff = null; p.piWill = null; }
  if (piWillOn(p)) return true;
  if (piScene() && p.piWillOff !== game.room && !p.dead) { piPlant(p, p.x - p.face * 30, p.y, true); return true; }
  return false;
}
const piNeedWill = p => piEnsureWill(p) || '需要意念驱动（先把巨兵插在地上）';
// 插在地上的巨兵。纯笔画的锻银十字架：顶面、右侧厚度、凹槽、金箍和穹顶蓝宝石，下端榫头埋进砸开的石块。不贴图。脚下淡光环只标 750px 范围。
function piWillDraw(c, t) {
  const pulse = 0.5 + 0.5 * Math.sin(t * 2.2);
  const poly = pts => { c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]); c.closePath(); };
  const fillp = (pts, style) => { poly(pts); c.fillStyle = style; c.fill(); };
  const steelX = (x0, x1) => {
    const g = c.createLinearGradient(x0, 0, x1, 0);
    g.addColorStop(0, '#8d97a4'); g.addColorStop(0.10, '#eef2f6'); g.addColorStop(0.20, '#c5ced8');
    g.addColorStop(0.55, '#7b8592'); g.addColorStop(0.82, '#454d5a'); g.addColorStop(1, '#2a3038');
    return g;
  };
  const steelY = (y0, y1) => {
    const g = c.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, '#e7edf3'); g.addColorStop(0.18, '#c3ccd6'); g.addColorStop(0.55, '#7e8896'); g.addColorStop(1, '#3a424c');
    return g;
  };
  const crease = (x0, y0, x1, y1) => { c.strokeStyle = 'rgba(10,12,16,.55)'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); };
  c.save(); c.filter = 'blur(2.4px)'; c.fillStyle = 'rgba(16,10,8,.55)'; c.beginPath(); c.ellipse(10, 16, 36, 8, 0.05, 0, TAU); c.fill(); c.restore();
  c.fillStyle = 'rgba(36,24,16,.55)'; c.beginPath(); c.ellipse(2, 10, 32, 9, 0, 0, TAU); c.fill();
  fillp([[11, -156], [17.6, -153], [17.6, -16], [11, -18]], (() => { const g = c.createLinearGradient(11, 0, 18, 0); g.addColorStop(0, '#5a6370'); g.addColorStop(0.4, '#2c333c'); g.addColorStop(1, '#14181e'); return g; })());
  fillp([[-14, -156], [-10, -156], [-10, -18], [-14, -18]], (() => { const g = c.createLinearGradient(-14, 0, -10, 0); g.addColorStop(0, '#b7c2ce'); g.addColorStop(1, '#f4f7fb'); return g; })());
  fillp([[-11, -154], [11, -154], [11, -18], [-11, -18]], steelX(-11, 11));
  crease(11, -154, 11, -18);
  c.save();
  poly([[-11, -154], [11, -154], [11, -18], [-11, -18]]); c.clip();
  const bounce = c.createLinearGradient(0, -70, 0, -16);
  bounce.addColorStop(0, 'rgba(90,56,30,0)'); bounce.addColorStop(1, 'rgba(92,58,32,.32)');
  c.fillStyle = bounce; c.fillRect(-11, -70, 22, 54);
  const recess = (x, y, w, h) => {
    c.save(); c.beginPath(); c.roundRect(x, y, w, h, 1.4); c.clip();
    const g = c.createLinearGradient(x, y, x + w, y + h);
    g.addColorStop(0, 'rgba(8,10,14,.32)'); g.addColorStop(0.25, 'rgba(8,10,14,.08)'); g.addColorStop(1, 'rgba(255,255,255,.07)');
    c.fillStyle = g; c.fillRect(x, y, w, h);
    c.strokeStyle = 'rgba(255,255,255,.32)'; c.lineWidth = 0.7; c.beginPath(); c.moveTo(x + 1.2, y + 0.8); c.lineTo(x + w - 1.2, y + 0.8); c.stroke();
    c.restore();
  };
  recess(-6.2, -148, 12.4, 24); recess(-6.2, -104, 12.4, 80);
  c.strokeStyle = 'rgba(30,22,16,.32)'; c.lineWidth = 0.7; c.beginPath(); c.moveTo(-2, -62); c.lineTo(3, -46); c.moveTo(5, -38); c.lineTo(1, -26); c.stroke();
  c.restore();
  const arm = dir => {
    const Q = [[0, -126], [46, -126], [54, -120], [54, -104], [46, -98], [0, -98]].map(([x, y]) => [dir * x, y]);
    const top = [Q[0], Q[1], Q[2]], topUp = top.map(([x, y], i) => [x + dir * 0.6, y - 4 + (i === 2 ? 1.5 : 0)]);
    fillp([Q[2], Q[3], [Q[3][0] + dir * 5.2, Q[3][1] + 1.6], [Q[2][0] + dir * 5.2, Q[2][1] + 1.2]], (() => { const g = c.createLinearGradient(Q[2][0], 0, Q[2][0] + dir * 5.2, 0); g.addColorStop(0, '#66707e'); g.addColorStop(1, '#161a20'); return g; })());
    fillp([top[0], top[1], top[2], topUp[2], topUp[1], topUp[0]], (() => { const g = c.createLinearGradient(0, -130, 0, -122); g.addColorStop(0, '#fbfcfe'); g.addColorStop(1, '#b4bec9'); return g; })());
    c.strokeStyle = 'rgba(255,255,255,.8)'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(top[0][0], top[0][1]); c.lineTo(top[1][0], top[1][1]); c.lineTo(top[2][0], top[2][1]); c.stroke();
    fillp(Q, steelY(-126, -98));
    c.save(); poly(Q); c.clip();
    const ao = c.createLinearGradient(0, 0, dir * 16, 0);
    ao.addColorStop(0, 'rgba(0,0,0,.16)'); ao.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = ao; c.fillRect(Math.min(0, dir * 16), -128, 16, 32);
    c.beginPath(); c.roundRect(dir > 0 ? 18 : -50, -120, 30, 14, 1.2); c.clip();
    c.fillStyle = 'rgba(8,10,14,.22)'; c.fillRect(dir > 0 ? 18 : -50, -120, 30, 14);
    c.restore();
    c.strokeStyle = '#c6a25a'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(dir * 20, -119); c.lineTo(dir * 46, -119); c.stroke();
    c.strokeStyle = 'rgba(40,28,10,.45)'; c.lineWidth = 0.6; c.beginPath(); c.moveTo(dir * 20, -118); c.lineTo(dir * 46, -118); c.stroke();
    crease(Q[2][0], Q[2][1], Q[3][0], Q[3][1]);
  };
  arm(1); arm(-1);
  const fillet = (x, y, dx, dy) => {
    c.beginPath(); c.moveTo(x, y + dy); c.lineTo(x, y); c.lineTo(x + dx, y); c.quadraticCurveTo(x, y, x, y + dy); c.closePath();
    c.fillStyle = steelY(Math.min(y, y + dy), Math.max(y, y + dy)); c.fill();
  };
  fillet(11, -126, 14, -14); fillet(-11, -126, -14, -14); fillet(11, -98, 14, 14); fillet(-11, -98, -14, 14);
  fillp([[0, -184], [8, -156], [14.2, -153], [3.6, -180]], (() => { const g = c.createLinearGradient(2, 0, 14, 0); g.addColorStop(0, '#4e5560'); g.addColorStop(1, '#16191e'); return g; })());
  fillp([[0, -184], [-8, -156], [8, -156]], (() => { const g = c.createLinearGradient(-8, -184, 8, -156); g.addColorStop(0, '#fbfcfe'); g.addColorStop(0.35, '#d5dce4'); g.addColorStop(1, '#6a7380'); return g; })());
  c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = 0.9; c.beginPath(); c.moveTo(-0.6, -178); c.lineTo(-2.2, -160); c.stroke();
  fillp([[-13, -158], [11, -158], [16.4, -155], [16.4, -150], [11, -150], [-13, -150]], '#4a3814');
  fillp([[-12, -157], [10, -157], [10, -151], [-12, -151]], (() => { const g = c.createLinearGradient(-12, 0, 10, 0); g.addColorStop(0, '#7a5c28'); g.addColorStop(0.28, '#fff0c4'); g.addColorStop(0.62, '#c49840'); g.addColorStop(1, '#5a4016'); return g; })());
  fillp([[-12, -157], [10, -157], [11.2, -160.2], [-11, -160.2]], '#f8e7bc');
  const band = (x, y, w, h, stops, side) => {
    c.fillStyle = side; c.beginPath(); c.moveTo(x + w, y); c.lineTo(x + w + 5.2, y + 1.4); c.lineTo(x + w + 5.2, y + h + 1.4); c.lineTo(x + w, y + h); c.closePath(); c.fill();
    const top = c.createLinearGradient(0, y - 3, 0, y); top.addColorStop(0, '#f4f7fb'); top.addColorStop(1, '#9aa6b4'); c.fillStyle = top;
    c.beginPath(); c.moveTo(x, y); c.lineTo(x + w, y); c.lineTo(x + w + 1.2, y - 3.2); c.lineTo(x + 1.2, y - 3.2); c.closePath(); c.fill();
    const g = c.createLinearGradient(x, 0, x + w, 0); stops.forEach(([s, col]) => g.addColorStop(s, col)); c.fillStyle = g; c.fillRect(x, y, w, h);
    crease(x + w, y, x + w, y + h);
  };
  band(-15, -18, 30, 6, [[0, '#59616e'], [0.12, '#f2f5f8'], [0.4, '#8c97a4'], [1, '#2a3038']], '#14181e');
  band(-17, -12, 34, 7, [[0, '#343a44'], [0.22, '#6e7886'], [0.7, '#3a424c'], [1, '#1a1e24']], '#10141a');
  c.strokeStyle = 'rgba(0,0,0,.4)'; c.lineWidth = 1; c.beginPath(); c.moveTo(-16, -8.6); c.lineTo(16, -8.6); c.stroke();
  c.strokeStyle = 'rgba(255,255,255,.25)'; c.lineWidth = 0.6; c.beginPath(); c.moveTo(-16, -11.4); c.lineTo(16, -11.4); c.stroke();
  band(-13, -5, 26, 5, [[0, '#6a4e1a'], [0.22, '#ffe7b4'], [0.6, '#b18434'], [1, '#46320e']], '#2e220c');
  fillp([[-4.5, 0], [4.5, 0], [5.6, 2], [5.6, 11], [4.5, 11], [-4.5, 11]], steelX(-4.5, 5.6));
  const stone = (pts, lit, body) => { fillp(pts.map(([x, y]) => [x - 1.6, y - 1.5]), lit); fillp(pts, body); };
  stone([[-30, 6], [-18, 2], [-8, 8], [-14, 16], [-28, 14]], '#a08068', '#6a5342');
  stone([[-12, 4], [2, 1], [8, 8], [0, 14], [-10, 12]], '#b09078', '#5c4636');
  stone([[6, 3], [20, 1], [28, 8], [16, 15], [4, 11]], '#8d6e56', '#3f3126');
  stone([[-6, 10], [8, 12], [14, 18], [-2, 20], [-10, 16]], '#4a3a2c', '#241910');
  c.fillStyle = 'rgba(255,232,204,.4)'; c.beginPath(); c.ellipse(-22, 4, 3.2, 1.2, -0.5, 0, TAU); c.fill(); c.beginPath(); c.ellipse(2, 2, 3.6, 1.2, 0.3, 0, TAU); c.fill();
  c.strokeStyle = 'rgba(20,12,8,.8)'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(-16, 6); c.lineTo(-8, 12); c.lineTo(-1, 8); c.moveTo(10, 5); c.lineTo(18, 11); c.stroke();
  c.fillStyle = 'rgba(62,42,26,.5)'; c.beginPath(); c.ellipse(-9, -2, 2.4, 1.2, 0.4, 0, TAU); c.fill(); c.beginPath(); c.ellipse(7, 0, 1.8, 1, -0.3, 0, TAU); c.fill();
  const rivet = (x, y) => {
    c.beginPath(); c.arc(x + 0.55, y + 0.6, 1.9, 0, TAU); c.fillStyle = '#1c160e'; c.fill();
    const g = c.createRadialGradient(x - 0.5, y - 0.6, 0.15, x + 0.2, y + 0.2, 1.7);
    g.addColorStop(0, '#fff8dc'); g.addColorStop(0.35, '#e6c068'); g.addColorStop(1, '#5e4414');
    c.beginPath(); c.arc(x, y, 1.45, 0, TAU); c.fillStyle = g; c.fill();
  };
  rivet(-42, -112); rivet(42, -112); rivet(0, -140); rivet(0, -70);
  c.beginPath(); c.arc(1.3, -110.4, 15, 0, TAU); c.fillStyle = '#1a1e24'; c.fill();
  const md = c.createRadialGradient(-5, -120, 2, 1, -110, 15);
  md.addColorStop(0, '#f4f7fb'); md.addColorStop(0.5, '#8b95a3'); md.addColorStop(1, '#343b46');
  c.beginPath(); c.arc(0, -112, 14, 0, TAU); c.fillStyle = md; c.fill();
  const gx = 0, gy = -112, R = 6.4;
  c.beginPath(); c.ellipse(gx + 1.2, gy + 2.2, R + 3.6, R + 3.2, 0, 0, TAU); c.fillStyle = '#2a200e'; c.fill();
  const bz = c.createRadialGradient(gx - 2.2, gy - 2.4, 0.8, gx + 0.6, gy + 0.8, R + 3.3);
  bz.addColorStop(0, '#fff6d8'); bz.addColorStop(0.42, '#e2b65c'); bz.addColorStop(1, '#5c4214');
  c.beginPath(); c.arc(gx, gy, R + 2.5, 0, TAU); c.fillStyle = bz; c.fill();
  c.beginPath(); c.arc(gx, gy, R + 0.4, 0, TAU); c.strokeStyle = 'rgba(40,28,8,.7)'; c.lineWidth = 0.9; c.stroke();
  const gg = c.createRadialGradient(gx - R * 0.32, gy - R * 0.38, R * 0.05, gx + R * 0.2, gy + R * 0.25, R * 1.05);
  gg.addColorStop(0, '#ffffff'); gg.addColorStop(0.16, '#b7e4ff'); gg.addColorStop(0.42, '#1c6ed2'); gg.addColorStop(0.78, '#0a2a6e'); gg.addColorStop(1, '#071433');
  c.beginPath(); c.arc(gx, gy, R, 0, TAU); c.fillStyle = gg; c.fill();
  c.beginPath(); c.ellipse(gx - 1.5, gy - 2.3, 2.1, 1.05, -0.6, 0, TAU); c.fillStyle = 'rgba(255,255,255,.92)'; c.fill();
  c.beginPath(); c.ellipse(gx + 1.8, gy + 1.6, 1.6, 0.7, 0.8, 0, TAU); c.fillStyle = 'rgba(180,220,255,.35)'; c.fill();
  c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.10 + pulse * 0.06; c.fillStyle = '#7eb6ff'; c.beginPath(); c.arc(gx, gy, R + 5, 0, TAU); c.fill(); c.restore();
}
function piWillFx(p) {
  if (p._piWillFx && fxList.includes(p._piWillFx)) return;
  p._piWillFx = addFx({ ent: p, x: 0, y: 0, z: 0, dur: 1e9, update() { const W = this.ent.piWill; if (!W || W.room !== game.room || this.ent.remove) { this.dur = this.t; return; } this.x = W.x; this.y = W.y + 0.2; },
    draw(c) { const W = this.ent.piWill; if (!W) return; const X = sx(W.x), Y = sy(W.y, 0), t = this.t;
      c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.09; c.strokeStyle = '#9fd8ff'; c.lineWidth = 2; c.beginPath(); c.ellipse(X, Y, 750, 750 * GR, 0, 0, TAU); c.stroke(); c.restore();
      c.save(); c.translate(X, Y); c.rotate(-0.025); piWillDraw(c, t); c.restore(); } });
}
// 巨兵插在地上时手里的十字架不画：矢量模型藏掉手上的部件，精灵模型包一层外观层（models/avatar.js）的 weapon
function piHideHandCross(p) {
  const m = p.model; if (!m || m._piHide) return; m._piHide = true;
  const off = () => piOn(p) && piWillOn(p);
  if (m.parts) for (const part of m.parts) if (part.bone === 'wF' && part.z === 17 && part.when) { const w0 = part.when; part.when = () => w0() && !off(); }
  const av = m.av; if (av && av.weapon) { const w0 = av.weapon; av.weapon = function (...a) { if (!off()) return w0.apply(this, a); }; }
}

/* ---- 矢量占位的姿势 / 片段（格斗家的拳姿势） ---- */
POSE.piDuck = P(POSE.idle, { g: 0, r: [0, 22, 0], torso: -46, head: 30, uaF: 70, faF: 90, wF: -60, uaB: 50, faB: 100, thF: 90, shF: -100, ftF: 20, thB: -20, shB: -90, ftB: 60 });
POSE.piSway = P(POSE.idle, { torso: 24, head: -18, uaF: 40, faF: 110, uaB: 30, faB: 110, thF: 30, shF: -20, thB: -40, shB: -40, ftB: 40 });
POSE.piGuard = P(POSE.idle, { torso: -6, head: 4, uaF: 60, faF: 120, wF: -40, uaB: 50, faB: 125 });
Object.assign(CLIPS.priest, {
  piJab: { dur: 0.22, fps: 24, keys: [k(0, POSE.fJabW, 'hold'), k(0.04, POSE.fJab, 'out'), k(0.12, POSE.fJab), k(0.22, POSE.piGuard)] },
  piStraight: { dur: 0.3, fps: 24, keys: [k(0, POSE.fJabW, 'hold'), k(0.06, POSE.fsPunch, 'out'), k(0.18, POSE.fsPunch), k(0.3, POSE.piGuard)] },
  piUpper: { dur: 0.4, fps: 24, keys: [k(0, POSE.upW, 'hold'), k(0.08, POSE.fnUp, 'out'), k(0.25, POSE.fnUp), k(0.4, POSE.piGuard)] },
  piHook: { dur: 0.42, fps: 24, keys: [k(0, POSE.runA), k(0.06, POSE.fShoulder, 'hold'), k(0.14, POSE.a3s, 'out'), k(0.42, POSE.a3r)] },
  piDuck: { dur: 0.5, keys: [k(0, POSE.piDuck)] },
  piSway: { dur: 0.4, keys: [k(0, POSE.piSway)] },
  piBody: { dur: 0.36, fps: 24, keys: [k(0, POSE.piDuck, 'hold'), k(0.06, POSE.fbCrouchPunch || POSE.fPalm, 'out'), k(0.36, POSE.fbCrouchPunch || POSE.fPalm)] },
  piCounter: { dur: 0.6, keys: [k(0, POSE.fSeal)] },
  piChop: { dur: 0.45, fps: 24, keys: [k(0, POSE.a3w, 'hold'), k(0.14, POSE.a3s, 'out'), k(0.45, POSE.a3r)] },
  piRush: { dur: 0.12, loop: true, fps: 24, keys: [k(0, POSE.fJab), k(0.06, POSE.fsPunch)] },
  piSpin: { dur: 0.3, keys: [k(0, P(POSE.fsPunch, { faF: 30 }))] },
  piPlant: { dur: 0.45, keys: [k(0, POSE.a3w, 'hold'), k(0.18, POSE.fQuake, 'out'), k(0.45, POSE.fQuake)] },
  piPray: { dur: 0.6, keys: [k(0, POSE.fSeal)] },
  piLeap: { dur: 0.4, keys: [k(0, POSE.jumpUp)] },
  piSlam: { dur: 0.45, keys: [k(0, POSE.jAtkW, 'hold'), k(0.08, POSE.fQuake, 'out'), k(0.45, POSE.fQuake)] },
});
const PI_ANIMS = {
  piJab: [['pm_jab', 0]], piStraight: [['pm_straight', 0]], piUpper: [['pm_upper', 0]], piHook: [['p_hookDash', 0], ['pm_straight', 0.1]],
  piDuck: [['pm_duck', 0]], piSway: [['pm_sway', 0]], piBody: [['pm_duck', 0], ['pm_jab', 0.06]], piCounter: [['pm_counter', 0]],
  piChop: [['p_slamUp', 0], ['p_slamDown', 0.12]], piRush: { fps: 16, frames: ['pm_rush1', 'pm_rush2'] }, piSpin: [['pm_straight', 0]],
  piPlant: [['p_slamDown', 0]], piPray: [['p_pray1', 0], ['p_pray2', 0.15]], piLeap: [['p_slamUp', 0]], piSlam: [['p_slamDown', 0]],
};

/* ---- 特效构件 ---- */
// 拳风（蓝白色圣光拳气）
const piPunchFx = (e, len = 90, heavy, col = PI_COL.fist, z = 62) => { fxStreak({ x: e.x + e.face * 16, y: e.y, z: e.z + z, face: e.face, len, w: heavy ? 18 : 10, col, dur: heavy ? 0.18 : 0.1 }); sfx.swing(!!heavy); };
// 拳头命中的冲击环
const piImpact = (x, y, z, s = 1, col = PI_COL.fist) => { fxSpr('burst', x, y, z, { w: 90 * s, dur: 0.25, col, grow: [0.4, 1.1] }); fxSpr('shock', x, y, z, { w: 70 * s, dur: 0.2, col }); };

/* =====================================================================
   普攻：插着巨兵时换成拳击（刺拳 → 刺拳 → 直拳 → 上勾拳；跑攻 上段钩拳；跳攻 下砸拳）；技巧精通加攻击距离，百炼成钢让上勾拳 / 跑攻打得到倒地的敌人
   ===================================================================== */
const PI_ACTS = {};
function piFistActs(p) {
  const tl = skLv(p, 'pi_tech'), low = skLv(p, 'pi_body') > 0, key = tl + (low ? 'L' : ''); if (PI_ACTS[key]) return PI_ACTS[key];
  const X = tl ? 13 + 2 * tl : 0, bx = (a, b, z0 = 26, z1 = 115) => [0, a + X, 32, z0, z1];
  const jab = (n, dmg, len) => ({ name: 'atk' + n, dur: 0.24, basic: true, speed: 'aspd', chain: [0.1, 0.24], next: 'atk' + (n + 1), move: [[0.02, 0.06, 60]],
    hits: [HB(0.04, 0.1, bx(len), dmg, { stun: 0.32, knock: 30, hs: 0.04, snd: 'blunt', col: PI_COL.fist })], events: [evAt(0.03, e => { e.play(n === 3 ? 'piStraight' : 'piJab', true); piPunchFx(e, 70 + len * 0.3, n === 3); })] });
  const A = {
    atk1: jab(1, 0.7, 84), atk2: jab(2, 0.75, 84), atk3: { ...jab(3, 0.95, 92), dur: 0.3, chain: [0.12, 0.3], hits: [HB(0.05, 0.12, bx(92), 0.95, { stun: 0.4, knock: 70, hs: 0.05, snd: 'blunt', col: PI_COL.fist })] },
    atk4: { name: 'atk4', dur: 0.42, basic: true, speed: 'aspd', move: [[0.02, 0.08, 90]],
      hits: [HB(0.06, 0.14, bx(88, low ? -10 : 0, 140), 1.2, { launch: 520, knock: 50, hs: 0.07, shake: 2, downHit: low, snd: 'blunt', col: PI_COL.fist })], events: [evAt(0.04, e => { e.play('piUpper', true); piPunchFx(e, 70, true); fxSlashOn(e, { a0: 1.5, a1: -1.6, r: 60, w: 14, off: [26, 50], col: PI_COL.hot, silent: true }); })] },
    dash: { name: 'dash', dur: 0.44, basic: true, speed: 'aspd', move: [[0, 0.22, 380]], noCounter: true, keyLinks: { attack: 'p_second' }, linkFrom: 0.12,
      hits: [HB(0.1, 0.22, bx(92, low ? -10 : 0, 120), 1.3, { stun: 0.55, knock: 70, hs: 0.07, shake: 2, downHit: low, snd: 'blunt', col: PI_COL.fist })],
      events: [evAt(0.02, e => { e.play('piHook', true); fxSlashOn(e, { a0: -2.2, a1: 0.6, r: 64, w: 16, off: [28, 56], col: PI_COL.hot, silent: true }); sfx.swing(true); })] },
    jatk: { name: 'jatk', dur: 0.34, basic: true, speed: 'aspd', airOnly: true, lowGrav: 0.75,
      hits: [HB(0.06, 0.16, [0, 80 + X, 32, -40, 84], 0.9, { stun: 0.34, knock: 40, hs: 0.05, airLift: 150, snd: 'blunt', col: PI_COL.fist })], events: [evAt(0.04, e => { e.play('piSlam', true); piPunchFx(e, 60); })] },
  };
  A.atk4.next = null;
  return (PI_ACTS[key] = A);
}
PRIEST_ACT_PICK.push(p => piOn(p) && piWillOn(p) ? piFistActs(p) : null);
// 插着巨兵时空斩打 / 落凤锤（要用巨兵的基础技能）不能用
PRIEST_HOOKS.req.push((p, id) => (id === 'p_launcher' || id === 'p_phoenix') && piOn(p) && piWillOn(p) ? '意念驱动中不能用（巨兵插在地上）' : true);

/* =====================================================================
   被动
   ===================================================================== */
defSkill('pi_body', { name: '百炼成钢', cls: 'priest', job: PIJ, lvReq: 15, maxLv: 1, sp: 0, mp: 0, cd: 0, type: 'phys', passive: true, col: '#9fd8ff',
  desc: '【被动，转职时自动学会】强化身体：移动速度 +15%、攻击速度 +10%、跳跃力提高；拳头放出拳气，普攻的上勾拳、勾拳追击、跑攻能打到更低的位置（打得到倒地的敌人）。',
  infoExtra: () => [['移动速度', '+15%'], ['攻击速度', '+10%']] });
defSkill('pi_tech', { name: '技巧精通', cls: 'priest', job: PIJ, lvReq: 16, maxLv: 10, sp: 20, mp: 0, cd: 0, type: 'phys', passive: true, col: '#6ab0ff',
  desc: '【被动】基本攻击和转职技能攻击力、移动速度提高；普攻 / 瞬拳 / 圣拳连击的攻击距离变长。附加效果：摆动中也能放俯冲直拳 / 翔拳 / 腹拳，俯冲中也能放破碎之锤；刺拳猛击 / 破碎之拳会把周围的敌人吸过来；神圣反击可以再按技能键 / 攻击键主动冲出去（伤害降低）；直拳冲击 / 俯冲腹拳 / 破碎之锤 / 神圣组合拳的部分动作变成霸体；俯冲直拳 / 腹拳 / 翔拳、圣拳连击打中时追加一次按原技能攻击力比例的伤害。',
  infoExtra: lv => [['技能攻击力', '+' + pct(0.01 * lv)], ['移动速度', '+' + pct(0.01 * lv)], ['普攻距离', '+' + (13 + 2 * lv) + 'px'], ['神圣反击主动冲出', pct(Math.min(0.8, 0.4 + 0.04 * lv))]] });
defSkill('pi_parry', { name: '急速闪避', cls: 'priest', job: PIJ, lvReq: 17, maxLv: 5, sp: 15, mp: 0, cd: 0, type: 'phys', passive: true, col: '#bfe8ff',
  desc: '【被动】放神击系技能（幻影化身以外的转职主动技能、觉醒技）的起手 0.6 秒内回避率大幅提高（75%）；这样躲开攻击时，10 秒内物理暴击率 +10%（最多叠 4 层）。',
  infoExtra: lv => [['起手回避', '75%（' + (0.6 + 0.1 * lv).toFixed(1) + ' 秒）'], ['躲开后暴击率', '+10% × 4 层']] });
const piWillVal = lv => ({ critDmg: 0.013 + 0.02 * lv, crit: 0.05 + 0.015 * lv });
defSkill('pi_will', { name: '意念驱动', cls: 'priest', job: PIJ, lvReq: 15, maxLv: 10, sp: 15, mp: 5, cd: 5, type: 'phys', buff: true, noHitCheck: true, col: '#9fd8ff',
  desc: '【转职时自动学会 Lv1】把巨兵插进地面：周围 150px 的敌人硬直；巨兵周围 750px 的光环里暴击伤害、物理暴击率、命中率提高，技能冷却 −10%（觉醒除外；离开光环后效果保留 30 秒）。插着巨兵时普攻变成拳击，除神圣反击外的转职技能都要插着巨兵才能用；空斩打 / 落凤锤不能用。已经插着时：点一下 = 在脚下重新插（破碎之锤的动作），按住技能键 = 收回巨兵（幻影化身随之解除）。进地下城、换房间、决斗开局都会自动插在脚下；按住收回后，这个房间里不再自动插。',
  ai: { kind: 'buff' }, infoExtra: lv => [['暴击伤害', '+' + pct(piWillVal(lv).critDmg)], ['暴击率', '+' + pct(piWillVal(lv).crit)], ['技能冷却', '−10%'], ['光环', '750px'], ['硬直范围', '150px']],
  act: (lv, p) => { const re = piWillOn(p);
    return { name: 'pi_will', clip: 'piPlant', dur: re ? 0.4 : 0.45, noCounter: true,
      update: e => { const a = e.act; if (a.done) return; const held = a.key && piPad(e).is(a.key);
        if (re && held && e.actT >= 0.3) { a.done = true; piRetrieve(e); a.dur = e.actT + 0.15; return; }
        if (e.actT >= (re ? 0.14 : 0.2) && !(re && held && e.actT < 0.3)) { a.done = true; piPlant(e, e.x + e.face * 24, e.y); cam.shake = Math.max(cam.shake, 3); fxText('Driver!', e.x, e.y, e.z + 40, { col: PI_COL.hot, size: 11 });
          areaHit(e, e.x + e.face * 24, e.y, 150, 0, { dmg: 0.05, stun: 0.6, knock: 0, hs: 0.02, downHit: true, col: PI_COL.fist }, { zMax: 80 }); } } }; } });
// 幻影化身：影子分身在你直接打中敌人时追加一次打击（原伤害的 5%+1.5%/级；双重幻影再多一个 50% 的分身）；要插着巨兵，收回巨兵时解除；地下城永久，决斗场 10 秒
const piShadowK = lv => 0.05 + 0.015 * lv;
defSkill('pi_shadow', { name: '幻影化身', cls: 'priest', job: PIJ, lvReq: 19, maxLv: 10, sp: 40, mp: 45, cd: 5, type: 'phys', buff: true, cast: true, noHitCheck: true, col: '#6a6ab8', req: piNeedWill,
  desc: '【BUFF】造出自己的影子分身：你直接打中敌人时，分身稍后追加一次打击（原伤害的一定比例，单独的硬直，冲击波 / 爆炸也算）。学了双重幻影再多一个分身（攻击力是第一个的 50%）。要插着巨兵才能放，收回巨兵时解除；地下城里一直持续（决斗场 10 秒）。',
  ai: { kind: 'buff' }, infoExtra: lv => [['追加打击', '原伤害 × ' + pct(piShadowK(lv))], ['持续', '永久（决斗场 10 秒）'], ['施放时间', '0.5 秒']],
  act: lv => ({ name: 'pi_shadow', clip: 'piPray', dur: 0.5, noCounter: true,
    events: [evAt(0.35, e => { e.buffs.pi_shadow = { t: game.pvp ? 10 : 1e6, lv, name: '幻影化身', col: '#6a6ab8' }; fxAfterimage(e, '#6a6ab8'); fxAura(e, '#8a8ad8', 0.6); sfx.buff(); })] }) });
defSkill('pi_double', { name: '双重幻影', cls: 'priest', job: PIJ, lvReq: 20, maxLv: 1, sp: 50, mp: 0, cd: 0, type: 'phys', passive: true, col: '#6a6ab8', pre: { pi_shadow: 1 },
  desc: '【被动】幻影化身的分身多一个，追加的分身攻击力是幻影化身的 50%。' });

/* =====================================================================
   俯冲 / 摆动（0.25 秒无敌，互相取消）与俯冲系
   ===================================================================== */
// 从俯冲 / 摆动里接出来的技能（onInput 用）：能用、冷却好、取消规则允许才放
function piTry(e, id) { if (!SKILLS[id] || !skillUsable(e, id) || (e.cool[id] || 0) > 0 || !canCancelInto(e, id)) return false; return castSkill(e, id, false, null); }
const PI_DUCKS = ['pi_dstraight', 'pi_dupper', 'pi_dbody'];
defSkill('pi_duck', { name: '俯冲', cls: 'priest', job: PIJ, lvReq: 15, maxLv: 1, sp: 25, mp: 1, cd: 0.7, type: 'phys', move: true, noHitCheck: true, col: '#9fd8ff', req: piNeedWill, pre: { pi_will: 1 },
  desc: '插着巨兵时按 Z：压低身子快速前冲 150px（按 ↑ / ↓ 斜着冲），开头 0.25 秒无敌，下半身以上的攻击打不到。俯冲中按 X / ↑+X / ↓+X 接俯冲直拳 / 俯冲翔拳 / 俯冲腹拳，按摆动的指令接摆动；按跳跃键立即停下。可以取消普攻。',
  ai: { kind: 'gap', r: [60, 200], dy: 60 }, infoExtra: () => [['距离', '150px'], ['无敌', '0.25 秒']],
  act: (lv, p) => { const I = piPad(p), dy = I.dy(), tech = skLv(p, 'pi_tech') > 0;
    return { name: 'pi_duck', clip: 'piDuck', dur: 0.5, noCounter: true, invul: [0, 0.25], hurtH: 55, move: [[0, 0.46, 330, undefined, dy * 200]],
      links: ['pi_sway', ...PI_DUCKS, 'pi_cork', 'pi_demo', 'pi_atomic', ...(tech ? ['pi_chop'] : [])], linkFrom: 0.02,
      onStart: e => { fxAfterimage(e, PI_COL.fist); fxDust(e.x, e.y, 3, 8); sfx.jump(); },
      onInput: (e, I2) => { if (I2.buffered('jump') && e.actT > 0.05 && !I2.is('down')) { I2.consume('jump'); e.vx = e.vy = 0; e.endAct(); return true; }
        if (I2.buffered('attack')) { const d = I2.dy(), id = d < 0 ? 'pi_dupper' : d > 0 ? 'pi_dbody' : 'pi_dstraight'; if (piTry(e, id)) { I2.consume('attack'); return true; } } return false; },
      onEnd: e => { e.vy = 0; } }; } });
defSkill('pi_sway', { name: '摆动', cls: 'priest', job: PIJ, lvReq: 15, maxLv: 1, sp: 30, mp: 1, cd: 0.7, type: 'phys', move: true, noHitCheck: true, col: '#9fd8ff', req: piNeedWill,
  desc: '插着巨兵时：身体后仰快速后撤 150px（按 ↑ / ↓ 斜着退），开头 0.25 秒无敌、下半身以上的攻击打不到。摆动中按 X 接破碎之锤（学了技巧精通：↑+X / ↓+X 接俯冲翔拳 / 腹拳），按 Z 接俯冲；按跳跃键立即停下。和俯冲可以无限互相取消。可以取消普攻。',
  ai: { kind: 'gap', r: [0, 120], dy: 60 }, infoExtra: () => [['距离', '150px（后撤）'], ['无敌', '0.25 秒']],
  act: (lv, p) => { const I = piPad(p), dy = I.dy(), tech = skLv(p, 'pi_tech') > 0;
    return { name: 'pi_sway', clip: 'piSway', dur: 0.42, noCounter: true, invul: [0, 0.25], hurtH: 60, move: [[0, 0.38, -380, undefined, dy * 200]],
      links: ['pi_duck', 'pi_chop', 'pi_cork', 'pi_demo', 'pi_atomic', ...(tech ? PI_DUCKS : [])], linkFrom: 0.02,
      onStart: e => { fxAfterimage(e, PI_COL.fist); sfx.jump(); },
      onInput: (e, I2) => { if (I2.buffered('jump') && e.actT > 0.08 && !I2.is('down')) { I2.consume('jump'); e.vx = e.vy = 0; e.endAct(); return true; }
        if (I2.buffered('attack')) { const d = I2.dy(), id = tech && d < 0 ? 'pi_dupper' : tech && d > 0 ? 'pi_dbody' : 'pi_chop'; if (piTry(e, id)) { I2.consume('attack'); return true; } }
        if (I2.buffered('cmd') && piTry(e, 'pi_duck')) { I2.consume('cmd'); return true; } return false; },
      onEnd: e => { e.vy = 0; } }; } });
// 俯冲系：从俯冲 / 摆动里接出来是直接出拳；直接按技能栏时先自动小冲一步（本作方便）
const piFromDuck = p => !!(p.act && (p.act.name === 'pi_duck' || p.act.name === 'pi_sway'));
const piDuckDmg = lv => skillDmg(1.9, 0.19, lv);
function piDuckAct(id, lv, p, o) {
  const pre = piFromDuck(p) ? 0 : 0.12, t = pre + (o.t || 0.05);
  return { name: id, clip: o.clip, dur: pre + o.dur, noCounter: true, superArmor: o.sa ? [pre, pre + 0.2] : undefined, move: pre ? [[0, pre, 480]] : [[0, 0.06, 150]],
    invul: pre ? [0, pre] : undefined, hurtH: pre ? 55 : undefined, links: o.links, linkFrom: o.links ? pre + o.dur - 0.16 : undefined, hitCancel: !!o.links,
    onStart: e => { if (pre) { e.play('piDuck', true); fxAfterimage(e, PI_COL.fist); } },
    events: [evAt(Math.max(0, t - 0.03), e => { e.play(o.clip, true); piPunchFx(e, o.len || 100, true, o.col); })],
    hits: [HB(t, t + 0.08, o.box, o.dmg, { hs: 0.08, shake: 2, big: 1.3, heavy: true, snd: 'blunt', col: o.col || PI_COL.fist, ...o.h })] };
}
defSkill('pi_dstraight', { name: '俯冲直拳', cls: 'priest', job: PIJ, lvReq: 15, sp: 20, mp: 18, cd: 3.5, type: 'phys', col: '#9fd8ff', req: piNeedWill, pre: { pi_duck: 1 }, cmdNote: '俯冲中 X',
  desc: '俯冲中按 X：一记直拳把敌人打退（现版不再打得很远，方便接连击）。学了技巧精通摆动中也能用、打中时追加一次伤害。直接按技能栏会先自动小冲一步再出拳。',
  pow: piDuckDmg, ai: { kind: 'poke', r: [0, 150], dy: 30 },
  act: (lv, p) => piDuckAct('pi_dstraight', lv, p, { clip: 'piStraight', dur: 0.36, box: [0, 112, 34, 26, 120], dmg: piDuckDmg(lv), h: { stun: 0.5, knock: 150 } }) });
defSkill('pi_dupper', { name: '俯冲翔拳', cls: 'priest', job: PIJ, lvReq: 15, sp: 20, mp: 18, cd: 3.5, type: 'phys', col: '#9fd8ff', req: piNeedWill, pre: { pi_duck: 1 }, cmdNote: '俯冲中 ↑+X',
  desc: '俯冲中按 ↑+X：一记上勾拳把敌人挑到空中（浮空力 80%），从最低到最高的判定都很宽。学了技巧精通摆动中也能用、打中时追加一次伤害。直接按技能栏会先自动小冲一步。',
  pow: piDuckDmg, ai: { kind: 'launch', r: [0, 140], dy: 30 },
  act: (lv, p) => piDuckAct('pi_dupper', lv, p, { clip: 'piUpper', dur: 0.42, box: [0, 104, 36, -10, 160], dmg: piDuckDmg(lv), h: { launch: 470, knock: 40, downHit: true } }) });
defSkill('pi_dbody', { name: '俯冲腹拳', cls: 'priest', job: PIJ, lvReq: 16, sp: 20, mp: 18, cd: 3.5, type: 'phys', col: '#9fd8ff', req: piNeedWill, pre: { pi_duck: 1 }, cmdNote: '俯冲中 ↓+X',
  desc: '俯冲中按 ↓+X：一记重腹拳，打中的敌人长时间硬直（不会倒地），有几率眩晕；对空中的敌人用会让他在空中僵住。技巧精通：出拳时霸体、打中追加伤害；绝对正义（三觉）：打中后能用俯冲 / 摆动取消后摇。直接按技能栏会先自动小冲一步。',
  pow: piDuckDmg, ai: { kind: 'poke', r: [0, 140], dy: 30 }, infoExtra: lv => [['眩晕几率', pct(Math.min(0.8, 0.3 + 0.03 * lv))], ['眩晕', '3 秒']],
  act: (lv, p) => piDuckAct('pi_dbody', lv, p, { clip: 'piBody', dur: 0.46, sa: skLv(p, 'pi_tech') > 0, links: skLv(p, 'pi_one') > 0 ? ['pi_duck', 'pi_sway'] : null, box: [0, 100, 34, 10, 100], dmg: piDuckDmg(lv), col: '#ffe8a0',
    h: { stun: 1.1, knock: 20, airLift: 200, onHit: (a, t) => { if (!t.dead && Math.random() < Math.min(0.8, 0.3 + 0.03 * lv)) addStatus(t, 'stun', 3, { src: a }); fxText('Smasher!', t.x, t.y, t.z + 40, { col: '#ffe8a0', size: 11, dur: 0.4 }); } } }) });

/* =====================================================================
   转职攻击技能
   ===================================================================== */
// 圣拳锤击：一拳砸地（直接 : 冲击波 ≈ 1 : 9），冲击波把周围的敌人轻轻挑起
const piCrushDmg = lv => ({ hit: skillDmg(0.28, 0.028, lv), wave: skillDmg(2.52, 0.252, lv) });
defSkill('pi_crush', { name: '圣拳锤击', cls: 'priest', job: PIJ, lvReq: 16, sp: 20, mp: 12, cd: 5, type: 'phys', col: '#9fd8ff', req: piNeedWill,
  desc: '一拳用力砸向地面：拳头打中的敌人受到伤害，同时向周围扩散冲击波把敌人轻轻挑起（打得到倒地的敌人）。可以在普攻中取消施放。',
  pow: lv => piCrushDmg(lv).hit + piCrushDmg(lv).wave, ai: { kind: 'aoe', r: [0, 150], dy: 60 },
  act: lv => { const D = piCrushDmg(lv);
    return { name: 'pi_crush', clip: 'piSlam', dur: 0.5, noCounter: true,
      hits: [HB(0.14, 0.2, [0, 90, 34, -10, 80], D.hit, { stun: 0.4, knock: 20, hs: 0.05, downHit: true, snd: 'blunt', col: PI_COL.fist })],
      events: [evAt(0.1, e => sfx.swing(true)), evAt(0.16, e => { const x = e.x + e.face * 60; cam.shake = Math.max(cam.shake, 4); sfx.boom(0.5); fxShock(x, e.y, 170, PI_COL.fist); fxDust(x, e.y, 6, 20); fxText('Crush!', e.x, e.y, e.z + 40, { col: PI_COL.hot, size: 10, dur: 0.35 });
        areaHit(e, x, e.y, 150, 0, { dmg: D.wave, launch: 250, knock: 60, hs: 0.05, downHit: true, col: PI_COL.fist }, { zMax: 60 }); })] }; } });
// 瞬拳：一记伸得很远的弹击拳（约 260px）；之后再按技能键 / 攻击键：近身追加一击（最低位判定），把打到的敌人拽到身前
const piSideDmg = lv => ({ jab: skillDmg(1.84, 0.184, lv), pull: skillDmg(0.46, 0.046, lv) });
defSkill('pi_side', { name: '瞬拳', cls: 'priest', job: PIJ, lvReq: 17, sp: 25, mp: 22, cd: 4, type: 'phys', col: '#9fd8ff', req: piNeedWill, pre: { p_smasher: 1 },
  desc: '像风一样把拳头伸到远处的弹击拳（约 300px）。打完后再按技能键或攻击键：追加一记贴地的近身拳，把前面打到的敌人拽到身前（决斗场里是“拽过来接抓取”的核心）。学了技巧精通攻击距离更长。',
  pow: lv => piSideDmg(lv).jab + piSideDmg(lv).pull, ai: { kind: 'poke', r: [60, 300], dy: 30 },
  act: (lv, p) => { const D = piSideDmg(lv), L = 300 + Math.round(2.7 * skLv(p, 'pi_tech'));
    return { name: 'pi_side', clip: 'piStraight', dur: 0.5, noCounter: true, followWin: [0.16, 0.5],
      events: [evAt(0.04, e => { sfx.swing(true); fxStreak({ x: e.x + e.face * 20, y: e.y, z: e.z + 64, face: e.face, len: L, w: 12, col: PI_COL.hot, dur: 0.16 }); })],
      hits: [HB(0.06, 0.14, [20, L, 30, 30, 120], D.jab, { stun: 0.55, knock: 20, hs: 0.05, snd: 'blunt', col: PI_COL.fist, onHit: (a, t) => { if (a.act && a.act.name === 'pi_side') (a.act.tgts || (a.act.tgts = new Set())).add(t); } })],
      onInput: (e, I) => { if (e.actT >= 0.16 && I.buffered('attack')) { I.consume('attack'); const a = e.act, nx = a.follow(e); if (nx) { e.doAct(nx, { skill: a.skill, lv: a.lv, key: a.key, type: a.type }); return true; } } return false; },
      follow: e => { const tg = e.act && e.act.tgts ? [...e.act.tgts] : [];
        return { name: 'pi_side2', clip: 'piBody', dur: 0.36, noCounter: true,
          onStart: e2 => { e2.play('piBody', true); sfx.swing(true); fxSlashOn(e2, { a0: 1.2, a1: -0.4, r: 60, w: 12, off: [30, 20], col: PI_COL.hot, silent: true });
            for (const t of tg) if (!t.dead && piMovable(t)) { t.x = e2.x + e2.face * 55; t.y = lerp(t.y, e2.y, 0.7); fxStreak({ x: t.x, y: t.y, z: 60, face: -e2.face, len: 80, w: 8, col: PI_COL.fist, dur: 0.15 }); } },
          hits: [HB(0.04, 0.12, [0, 110, 36, -10, 90], D.pull, { stun: 0.6, knock: 60, pull: true, hs: 0.05, downHit: true, snd: 'blunt', col: PI_COL.fist })] }; } }; } });
// 圣拳连击：刺拳 → 直拳 → 摆拳三连（连打中霸体）；打完摆拳可以直接接俯冲 / 摆动
const piGorgDmg = lv => [skillDmg(1.0, 0.1, lv), skillDmg(1.19, 0.119, lv), skillDmg(1.43, 0.143, lv)];
defSkill('pi_gorgeous', { name: '圣拳连击', cls: 'priest', job: PIJ, lvReq: 17, sp: 25, mp: 45, cd: 7, type: 'phys', col: '#9fd8ff', req: piNeedWill, pre: { p_lucky: 1, pi_will: 1 },
  desc: '飞快地打出刺拳、直拳、摆拳三连击（“欧拉！欧拉！欧拉！”），连打中霸体；摆拳让敌人硬直更久。打完摆拳马上能接俯冲或摆动取消后摇。学了技巧精通攻击距离更长、打中追加伤害。',
  pow: lv => piGorgDmg(lv).reduce((a, b) => a + b, 0), ai: { kind: 'burst', r: [0, 130], dy: 30 },
  act: (lv, p) => { const D = piGorgDmg(lv), X = Math.round(3.4 * skLv(p, 'pi_tech'));
    return { name: 'pi_gorgeous', clip: 'piJab', dur: 0.56, noCounter: true, superArmor: [0, 0.34], links: ['pi_duck', 'pi_sway'], linkFrom: 0.32, move: [[0.02, 0.3, 90]],
      events: [evAt(0.03, e => { e.play('piJab', true); piPunchFx(e, 80); }), evAt(0.13, e => { e.play('piStraight', true); piPunchFx(e, 100); }), evAt(0.23, e => { e.play('piHook', true); piPunchFx(e, 110, true); fxText('Ora!', e.x, e.y, e.z + 40, { col: PI_COL.hot, size: 10, dur: 0.3 }); })],
      hits: [HB(0.05, 0.1, [0, 96 + X, 34, 26, 120], D[0], { stun: 0.4, knock: 10, hs: 0.04, snd: 'blunt', col: PI_COL.fist }), HB(0.15, 0.2, [0, 104 + X, 34, 26, 120], D[1], { stun: 0.45, knock: 20, hs: 0.05, snd: 'blunt', col: PI_COL.fist }),
        HB(0.25, 0.31, [0, 110 + X, 38, 20, 125], D[2], { stun: 0.8 + 0.02 * lv, knock: 60, hs: 0.08, shake: 2, heavy: true, snd: 'blunt', col: PI_COL.fist })] }; } });
// 神圣反击：祈祷架势（不用插巨兵）；这时正面挨打 → 受到的伤害 −90%，向前冲出一记腹拳反击（攻击力 = 俯冲腹拳 + 自身）；技巧精通：再按技能键 / 攻击键主动冲出（伤害 40%+4%/级）
const piCounterDmg = p => piDuckDmg(skLv(p, 'pi_dbody') || 1) + skillDmg(0.8, 0.05, skLv(p, 'pi_counter') || 1);
function piCounterStrike(e, manual) {
  const a = e.act; if (!a || a.name !== 'pi_counter' || a.struck) return; a.struck = true;
  const tl = skLv(e, 'pi_tech'), k = manual ? Math.min(0.8, 0.4 + 0.04 * tl) : 1;
  e.doAct({ name: 'pi_counter2', clip: 'piBody', dur: 0.5, noCounter: true, superArmor: manual ? undefined : [0, 0.3], move: [[0, 0.18, 900]],
    onStart: e2 => { fxAfterimage(e2, '#ffe8a0'); sfx.swing(true); fxText(manual ? 'Smasher!' : 'Sereno → Smasher!', e2.x, e2.y, e2.z + 50, { col: '#ffe8a0', size: 11, dur: 0.5 }); },
    hits: [HB(0.06, 0.22, [0, 110, 40, 10, 110], piCounterDmg(e) * k, { max: 1, stun: 1.0, knock: 80, hs: 0.1, shake: 4, big: 1.6, heavy: true, snd: 'blunt', col: '#ffe8a0' })] }, { skill: 'pi_counter', lv: a.lv, type: 'phys' });
}
defSkill('pi_counter', { name: '神圣反击', cls: 'priest', job: PIJ, lvReq: 18, maxLv: 1, sp: 50, mp: 43, cd: 6, type: 'phys', noHitCheck: true, col: '#ffe8a0',
  desc: '（不用插巨兵也能放）进入祈祷架势约 1 秒：这时正面受到攻击，受到的伤害 −90%，并立即向前冲出一记腹拳反击（攻击力 = 俯冲腹拳 + 神圣反击自身）。学了技巧精通：架势中再按技能键 / 攻击键主动冲出（伤害降低、没有霸体）。决斗场里是重要的反击手段。',
  pow: piCounterDmg, ai: { kind: 'counter', r: [0, 160], dy: 30 }, infoExtra: () => [['祈祷中受到伤害', '−90%'], ['架势', '约 1 秒']],
  act: (lv, p) => ({ name: 'pi_counter', clip: 'piCounter', dur: 1.0, noCounter: true, superArmor: true, piCounter: [0.04, 0.95],
    onStart: e => { fxAura(e, '#ffe8a0', 0.8); fxText('Sereno', e.x, e.y, e.z + 50, { col: '#ffe8a0', size: 10, dur: 0.5 }); },
    onInput: (e, I) => { const a = e.act; if (skLv(e, 'pi_tech') > 0 && e.actT > 0.1 && (I.buffered('attack') || (a.key && I.buffered(a.key)))) { I.consume('attack'); if (a.key) I.consume(a.key); piCounterStrike(e, true); return true; } return false; } }) });
PRIEST_HOOKS.beforeHurt.push((p, a, h) => {
  if (!piOn(p)) return null;
  const A = p.act;
  if (A && A.name === 'pi_counter' && A.piCounter && inWin(A.piCounter, p.actT) && !A.struck) { const src = a && a.x !== undefined ? a : null;
    if (!src || Math.sign(src.x - p.x || p.face) === p.face) { game.after(0, () => piCounterStrike(p, false)); return { mul: 0.1, noStun: true }; } }
  // 急速闪避：神击技能的起手回避
  const L = skLv(p, 'pi_parry');
  if (L && A && A.skill && SKILLS[A.skill] && (SKILLS[A.skill].job === PIJ || A.skill === 'p_lucky' || A.skill === 'p_smasher') && A.skill !== 'pi_shadow' && p.actT < 0.6 + 0.1 * L && !h.sure && !h.grab && Math.random() < 0.75) {
    fxText('回避', p.x, p.y, p.z + 40, { col: '#bfe8ff', size: 11, dur: 0.4 }); const b = p.buffs.pi_parry || (p.buffs.pi_parry = { t: 10, n: 0, name: '急速闪避', col: '#bfe8ff' }); b.n = Math.min(4, b.n + 1); b.t = 10; b.crit = 0.1 * b.n; b.lab = '×' + b.n;
    return { block: true };
  }
  return null;
});
// 破碎之锤：摆动中按 X：向前冲出，一记下劈的钩拳把敌人砸到地上弹起；拳头打中且敌人撞地时再出一道冲击波（霸体：下劈前一瞬间）；
// 绝对正义（三觉）：不出冲击波，改为在落点插下巨兵引发神圣爆炸（不打中也会爆，意念驱动的光环跟着移到这里）
const piChopDmg = lv => ({ fist: skillDmg(1.8, 0.18, lv), wave: skillDmg(1.2, 0.12, lv) });
defSkill('pi_chop', { name: '破碎之锤', cls: 'priest', job: PIJ, lvReq: 18, sp: 30, mp: 30, cd: 6, type: 'phys', col: '#9fd8ff', req: piNeedWill, pre: { pi_sway: 1 }, cmdNote: '摆动中 X',
  desc: '摆动中按 X：向前冲出一记下劈的钩拳，把敌人砸到地上再弹起来，敌人撞地时出一道冲击波打周围（下劈前一瞬间霸体）。学了技巧精通俯冲中也能用。绝对正义（三觉）：不再出冲击波，改为在落点插下巨兵引发神圣爆炸（伤害合在一起，打不中也会爆），意念驱动的光环跟着移过来。直接按技能栏会先小撤一步再冲。',
  pow: lv => piChopDmg(lv).fist + piChopDmg(lv).wave, ai: { kind: 'launch', r: [0, 170], dy: 30 },
  act: (lv, p) => { const D = piChopDmg(lv), one = skLv(p, 'pi_one') > 0, pre = piFromDuck(p) ? 0 : 0.12;
    return { name: 'pi_chop', clip: 'piChop', dur: pre + 0.55, noCounter: true, superArmor: [pre + 0.06, pre + 0.2], move: pre ? [[0, pre, -300], [pre, pre + 0.18, 700]] : [[0, 0.18, 700]],
      onStart: e => { if (pre) e.play('piSway', true); },
      events: [evAt(pre, e => { e.play('piChop', true); fxAfterimage(e, PI_COL.fist); sfx.swing(true); }),
        evAt(pre + 0.16, e => { fxSlashOn(e, { a0: -2.3, a1: 0.9, r: 70, w: 18, off: [30, 60], col: PI_COL.hot, heavy: true, silent: true });
          if (one) { const x = e.x + e.face * 70; piPlant(e, x, e.y); cam.shake = Math.max(cam.shake, 6); sfx.boom(0.8); fxSpr('burst', x, e.y, 50, { w: 220, dur: 0.4, col: '#ffe8a0', grow: [0.4, 1.1] }); fxShock(x, e.y, 190, '#ffe8a0');
            areaHit(e, x, e.y, 150, 0, { dmg: D.fist + D.wave, launch: 420, knock: 80, hs: 0.08, downHit: true, col: '#ffe8a0' }, { zMax: 150 }); } })],
      hits: one ? [] : [HB(pre + 0.16, pre + 0.24, [0, 110, 38, 0, 140], D.fist, { spike: 380, bounce: 0.95, knock: 40, hs: 0.08, shake: 3, heavy: true, snd: 'blunt', col: PI_COL.fist,
        onHit: (a, t) => { const A = a.act; if (!A || A.name !== 'pi_chop' || A.waved) return; A.waved = true; game.after(0.14, () => { if (a.dead) return; fxShock(t.x, t.y, 150, PI_COL.fist); fxDust(t.x, t.y, 5, 18);
          areaHit(a, t.x, t.y, 120, 0, { dmg: D.wave, launch: 300, knock: 40, hs: 0.05, downHit: true, col: PI_COL.fist }, { zMax: 100 }); }); } })] }; } });
// 刺拳猛击：飞快地连打 15 记刺拳（连按技能键更快；按 Z 直接出终结），最后一拳往下砸；终结后再按攻击键 / 技能键追加一记上勾拳；连打中霸体；技巧精通：把周围的敌人吸过来
const piMgDmg = lv => ({ jab: skillDmg(0.2, 0.02, lv), fin: skillDmg(0.92, 0.092, lv), up: skillDmg(0.6, 0.06, lv) });
defSkill('pi_mgjab', { name: '刺拳猛击', cls: 'priest', job: PIJ, lvReq: 19, sp: 30, mp: 50, cd: 10, type: 'phys', col: '#9fd8ff', req: piNeedWill,
  desc: '飞快地连打 15 记刺拳（连按技能键 / 攻击键打得更快，按 Z 立即出终结），最后一拳往下砸（打得到倒地的敌人，会把弹起的敌人重新挑高）；砸完后再按攻击键 / 技能键追加一记上勾拳。连打中霸体，终结时解除。学了技巧精通：连打时把周围（150px + 17px/级）的敌人吸到面前。',
  pow: lv => piMgDmg(lv).jab * 15 + piMgDmg(lv).fin + piMgDmg(lv).up, ai: { kind: 'burst', r: [0, 120], dy: 30 },
  act: (lv, p) => { const D = piMgDmg(lv), tl = skLv(p, 'pi_tech'), pullR = tl ? 150 + 17 * tl : 0;
    return { name: 'pi_mgjab', clip: 'piRush', dur: 2.4, noCounter: true, superArmor: [0, 1.2],
      onStart: e => { const a = e.act; a.n = 0; a.next = 0.05; a.mash = -9; fxText('Rush!', e.x, e.y, e.z + 50, { col: PI_COL.hot, size: 11, dur: 0.4 }); },
      onInput: (e, I) => { const a = e.act; if (!a.fin && ((a.key && I.buffered(a.key)) || I.buffered('attack'))) { if (a.key) I.consume(a.key); I.consume('attack'); a.mash = e.actT; return true; }
        if (!a.fin && I.buffered('cmd')) { I.consume('cmd'); a.n = 15; return true; }
        if (a.fin && !a.up && e.actT - a.fin > 0.08 && e.actT - a.fin < 0.45 && ((a.key && I.buffered(a.key)) || I.buffered('attack'))) { if (a.key) I.consume(a.key); I.consume('attack'); piMgUp(e, D); return true; } return false; },
      update: e => { const a = e.act;
        if (!a.fin && a.n < 15 && e.actT >= a.next) { a.n++; a.next = e.actT + (e.actT - a.mash < 0.25 ? 0.045 : 0.07); if (a.n % 2) sfx.swing(false);
          fxStreak({ x: e.x + e.face * 20, y: e.y + rnd(-8, 8), z: e.z + 56 + rnd(-14, 14), face: e.face, len: 70, w: 8, col: PI_COL.fist, dur: 0.08 });
          if (pullR) for (const t of ents) if (foe(e, t) && !t.dead && piMovable(t) && Math.abs(t.x - e.x) < pullR && Math.abs(t.y - e.y) < 90) { t.x = lerp(t.x, e.x + e.face * 70, 0.25); t.y = lerp(t.y, e.y, 0.25); }
          instantHit(e, { box: [0, 110, 38, 10, 125], dmg: D.jab, stun: 0.3, knock: 0, hs: 0.015, airLift: 90, snd: 'blunt', col: PI_COL.fist }); }
        if (!a.fin && a.n >= 15) { a.fin = e.actT; e.play('piChop', true); sfx.swing(true); cam.shake = Math.max(cam.shake, 4); fxText('Spike!', e.x, e.y, e.z + 50, { col: PI_COL.hot, size: 11, dur: 0.35 });
          fxSlashOn(e, { a0: -2.2, a1: 0.8, r: 64, w: 16, off: [30, 56], col: PI_COL.hot, heavy: true, silent: true });
          instantHit(e, { box: [0, 115, 40, -10, 130], dmg: D.fin, launch: 330, knock: 60, hs: 0.08, downHit: true, heavy: true, snd: 'blunt', col: PI_COL.fist }); a.dur = e.actT + 0.5; } } }; } });
function piMgUp(e, D) { const a = e.act; a.up = true; a.dur = e.actT + 0.4; e.play('piUpper', true); sfx.swing(true); fxText('Impact!', e.x, e.y, e.z + 50, { col: PI_COL.hot, size: 11, dur: 0.35 });
  fxSlashOn(e, { a0: 1.5, a1: -1.6, r: 60, w: 16, off: [26, 50], col: PI_COL.hot, heavy: true, silent: true }); instantHit(e, { box: [0, 110, 40, -10, 150], dmg: D.up, launch: 560, knock: 40, hs: 0.08, downHit: true, snd: 'blunt', col: PI_COL.fist }); }
// 旋涡重拳：手臂飞快旋转卷起旋风，把周围的敌人吸到拳头前面并控制住（10 段），最后一拳往下砸；俯冲 / 摆动中也能用；霸体（决斗场没有）
const piCorkDmg = lv => ({ spin: skillDmg(0.34, 0.034, lv), fin: skillDmg(5.1, 0.51, lv) });
defSkill('pi_cork', { name: '旋涡重拳', cls: 'priest', job: PIJ, lvReq: 19, sp: 40, mp: 45, cd: 20, type: 'phys', col: '#9fd8ff', req: piNeedWill,
  desc: '把手臂转得飞快卷起旋风，把前方和两侧的敌人吸到拳头前面并控制住（强制硬直，10 段），最后一拳往下砸（“Screw~ Blow!”）。俯冲 / 摆动中也能用。施放中霸体（决斗场没有，吸力和范围也变小）。',
  pow: lv => piCorkDmg(lv).spin * 10 + piCorkDmg(lv).fin, ai: { kind: 'aoe', r: [0, 170], dy: 60 }, infoExtra: () => [['吸怪范围', '前方 170px、纵深 ±60px']],
  act: lv => { const D = piCorkDmg(lv);
    return { name: 'pi_cork', clip: 'piSpin', dur: 1.15, noCounter: true, superArmor: game.pvp ? undefined : true,
      onStart: e => { const a = e.act; a.n = 0; fxText('Screw~', e.x, e.y, e.z + 50, { col: PI_COL.hot, size: 11, dur: 0.5 }); sfx.charge(); },
      update: e => { const a = e.act, fx = e.x + e.face * 70;
        if (a.n < 10 && e.actT >= 0.12 + a.n * 0.07) { a.n++; if (a.n % 2) sfx.swing(false); fxSpr('orb', fx, e.y, e.z + 60, { w: 90, dur: 0.14, col: PI_COL.fist, spin: 20, alpha: 0.7 }); fxSlashOn(e, { a0: a.n * 2.1, a1: a.n * 2.1 + 3, r: 46, w: 10, off: [70, 60], col: PI_COL.hot, silent: true });
          for (const t of ents) if (foe(e, t) && !t.dead && t.invul <= 0 && (t.x - e.x) * e.face > -30 && Math.abs(t.x - e.x) < (game.pvp ? 130 : 180) && Math.abs(t.y - e.y) < (game.pvp ? 40 : 60)) { if (piMovable(t)) { t.x = lerp(t.x, fx, 0.4); t.y = lerp(t.y, e.y, 0.4); } if (!t.boss) addStatus(t, 'hold', 0.3, { src: e }); }
          instantHit(e, { box: [0, 120, 44, 0, 140], dmg: D.spin, stun: 0.3, knock: 0, hs: 0.01, sure: true, snd: 'blunt', col: PI_COL.fist }); }
        if (!a.fin && e.actT >= 0.86) { a.fin = true; e.play('piChop', true); sfx.boom(0.7); cam.shake = Math.max(cam.shake, 6); fxText('Blow!', e.x, e.y, e.z + 50, { col: PI_COL.hot, size: 12, dur: 0.4 }); piImpact(fx, e.y, 50, 2);
          instantHit(e, { box: [0, 130, 46, -10, 150], dmg: D.fin, spike: 300, bounce: 0.9, knock: 100, hs: 0.12, shake: 5, big: 1.8, heavy: true, sure: true, downHit: true, snd: 'blunt', col: PI_COL.fist }); } } }; } });
// 神圣组合拳：右钩拳 → 左钩拳 → 强力直拳（1 : 1.3 : 2），把纵深方向的敌人拢到一条线上；直拳打中后可以用俯冲 / 摆动取消后摇
const piHeavDmg = lv => [skillDmg(1.65, 0.165, lv), skillDmg(2.15, 0.215, lv), skillDmg(3.4, 0.34, lv)];
defSkill('pi_heavenly', { name: '神圣组合拳', cls: 'priest', job: PIJ, lvReq: 19, sp: 40, mp: 45, cd: 16, type: 'phys', col: '#ffe8a0', req: piNeedWill, pre: { pi_gorgeous: 1 },
  desc: '右钩拳（Right!）→ 左钩拳（Left!）→ 强力直拳（Terminate!）：钩拳把纵深方向上下两侧的敌人拢到一条线上，硬直很长，直拳把敌人打飞。直拳打中后可以用俯冲 / 摆动取消后摇。学了技巧精通出拳时霸体。',
  pow: lv => piHeavDmg(lv).reduce((a, b) => a + b, 0), ai: { kind: 'burst', r: [0, 140], dy: 70 },
  act: (lv, p) => { const D = piHeavDmg(lv), sa = skLv(p, 'pi_tech') > 0;
    const pullY = (a, t) => { if (piMovable(t)) t.y = lerp(t.y, a.y, 0.7); };
    return { name: 'pi_heavenly', clip: 'piHook', dur: 0.95, noCounter: true, superArmor: sa ? [0, 0.7] : undefined, links: ['pi_duck', 'pi_sway'], linkFrom: 0.7, hitCancel: true, move: [[0.08, 0.14, 120], [0.34, 0.4, 120], [0.6, 0.66, 160]],
      events: [evAt(0.08, e => { e.play('piHook', true); piPunchFx(e, 90, true, '#ffe8a0'); fxText('Right!', e.x, e.y, e.z + 50, { col: '#ffe8a0', size: 10, dur: 0.3 }); }),
        evAt(0.34, e => { e.play('piJab', true); piPunchFx(e, 90, true, '#ffe8a0'); fxText('Left!', e.x, e.y, e.z + 50, { col: '#ffe8a0', size: 10, dur: 0.3 }); }),
        evAt(0.6, e => { e.play('piStraight', true); piPunchFx(e, 140, true, '#fff2c0'); fxText('Terminate!', e.x, e.y, e.z + 50, { col: '#fff2c0', size: 12, dur: 0.4 }); })],
      hits: [HB(0.1, 0.16, [0, 110, 70, 10, 130], D[0], { stun: 0.9, knock: 10, hs: 0.06, snd: 'blunt', col: '#ffe8a0', onHit: pullY }),
        HB(0.36, 0.42, [0, 110, 70, 10, 130], D[1], { stun: 0.9, knock: 10, hs: 0.07, snd: 'blunt', col: '#ffe8a0', onHit: pullY }),
        HB(0.62, 0.7, [0, 130, 44, 10, 135], D[2], { knock: 360, launch: 120, hs: 0.12, shake: 5, big: 1.8, heavy: true, snd: 'blunt', col: '#fff2c0' })] }; } });
// 极速飓风拳：把 936px 内的敌人吸过来，左右钩拳连打 10 下（连按攻击键更快，←→ 能前后移动），最后一记上勾拳打飞；按跳跃键立即出上勾拳
const piHurrDmg = lv => ({ hook: skillDmg(1.26, 0.126, lv), up: skillDmg(5.4, 0.54, lv) });
defSkill('pi_hurricane', { name: '极速飓风拳', cls: 'priest', job: PIJ, lvReq: 20, sp: 50, mp: 70, cd: 45, type: 'phys', col: '#9fd8ff', req: piNeedWill, pre: { pi_gorgeous: 1 },
  desc: '卷起飓风把周围很大范围（936px）的敌人吸过来，左右钩拳连打 10 下，最后一记强力上勾拳把敌人打飞（接空中连击）。连打中可以按 ← / → 前后移动，连按攻击键 / 技能键打得更快，按跳跃键立即出上勾拳。霸体；判定前后都有。',
  pow: lv => piHurrDmg(lv).hook * 10 + piHurrDmg(lv).up, ai: { kind: 'aoe', r: [0, 400], dy: 150 }, infoExtra: () => [['吸怪范围', '936px'], ['钩拳', '10 下']],
  act: lv => { const D = piHurrDmg(lv);
    return { name: 'pi_hurricane', clip: 'piRush', dur: 2.8, noCounter: true, superArmor: true,
      onStart: e => { const a = e.act; a.n = 0; a.next = 0.2; a.mash = -9; sfx.charge(); fxText('Hurricane!', e.x, e.y, e.z + 60, { col: PI_COL.hot, size: 12, dur: 0.5 }); },
      onInput: (e, I) => { const a = e.act; if (a.fin) return false;
        if (I.buffered('jump')) { I.consume('jump'); a.n = 10; return true; }
        if ((a.key && I.buffered(a.key)) || I.buffered('attack')) { if (a.key) I.consume(a.key); I.consume('attack'); a.mash = e.actT; return true; }
        e.vx = I.dx() * 140; return false; },
      update: e => { const a = e.act;
        if (!a.fin && Math.floor(e.actT / 0.15) !== a.tw) { a.tw = Math.floor(e.actT / 0.15); fxSpr('wave', e.x + rnd(-80, 80), e.y + rnd(-10, 10), 60, { h: 130, dur: 0.35, col: '#9fd8ff', rot: rnd(-0.6, 0.6), flip: Math.random() < 0.5, alpha: 0.6 }); }
        for (const t of ents) if (foe(e, t) && !t.dead && t.invul <= 0 && piMovable(t) && Math.abs(t.x - e.x) < 936 && Math.abs(t.y - e.y) < 250) { t.x = lerp(t.x, e.x + e.face * 60, 0.07); t.y = lerp(t.y, e.y, 0.07); }
        if (!a.fin && a.n < 10 && e.actT >= a.next) { a.n++; a.next = e.actT + (e.actT - a.mash < 0.3 ? 0.1 : 0.16); e.play(a.n % 2 ? 'piHook' : 'piJab', true); sfx.swing(a.n % 2 === 0);
          fxSlashOn(e, { a0: a.n % 2 ? -2.0 : 2.0, a1: a.n % 2 ? 0.8 : -0.8, r: 70, w: 14, off: [24, 56], col: PI_COL.hot, silent: true });
          instantHit(e, { box: [-50, 120, 50, 0, 140], dmg: D.hook, stun: 0.45, knock: 0, hs: 0.03, sure: true, snd: 'blunt', col: PI_COL.fist }); }
        if (!a.fin && a.n >= 10) { a.fin = true; e.vx = 0; e.play('piUpper', true); sfx.boom(0.8); cam.shake = Math.max(cam.shake, 7); fxText('Crasher!', e.x, e.y, e.z + 60, { col: PI_COL.hot, size: 13, dur: 0.45 });
          fxSlashOn(e, { a0: 1.6, a1: -1.7, r: 90, w: 22, off: [26, 60], col: '#fff2c0', heavy: true }); piImpact(e.x + e.face * 60, e.y, 80, 2.2);
          instantHit(e, { box: [-40, 140, 60, -10, 170], dmg: D.up, launch: 640, knock: 80, hs: 0.14, shake: 6, big: 2, heavy: true, sure: true, downHit: true, snd: 'blunt', col: '#fff2c0' }); a.dur = e.actT + 0.5; } } }; } });

/* =====================================================================
   钩子：冷却 −10%（意念驱动）、幻影化身的追加打击、技巧精通的追加伤害
   ===================================================================== */
const PI_NOCDR = new Set(['pi_awaken', 'pi_awaken2', 'pi_awaken3']);
PRIEST_HOOKS.onCast.push((p, id, act, how) => {
  if (!piOn(p) || how === 'recast') return;
  const S = SKILLS[id]; if (!S || PI_NOCDR.has(id) || !(p.cool[id] > 0)) return;
  if (piWillOn(p)) p.cool[id] *= 0.9;
});
const PI_TECH_EXTRA = { pi_dstraight: [0.05, 2], pi_dupper: [0.05, 2], pi_dbody: [0.1, 1], pi_gorgeous: [0.03, 1] };
PRIEST_HOOKS.onHit.push((p, t, h, dmg, act) => {
  if (!piOn(p) || h.piShadow || t.dead) return;
  const B = p.buffs.pi_shadow, src = { x: t.x - p.face * 10, y: t.y, z: 0, face: p.face };
  if (B && (h.dmg || 0) > 0) { const k = piShadowK(B.lv || 1), dbl = skLv(p, 'pi_double') > 0;
    for (const [dt, kk] of dbl ? [[0.08, 1], [0.15, 0.5]] : [[0.08, 1]]) game.after(dt, () => { if (t.dead || p.dead) return;
      fxSpr('spark', t.x - p.face * 12, t.y, t.z + 60, { w: 50, dur: 0.18, col: '#8a8ad8' }); fxSpr('ghost', t.x - p.face * 30, t.y, t.z + 60, { w: 60, dur: 0.2, col: '#6a6ab8', alpha: 0.5 });
      applyHit(p, t, { dmg: h.dmg * k * kk, type: 'phys', sure: true, stun: t.st === 'hit' ? Math.max(t.stun || 0, 0.12) : 0.12, knock: 0, hs: 0.01, piShadow: true, box: null, col: '#8a8ad8' }, { proj: true, src }); }); }
  const X = act && act.skill && PI_TECH_EXTRA[act.skill];
  if (X && skLv(p, 'pi_tech') > 0 && (h.dmg || 0) > 0 && !h.piExtra) for (let i = 0; i < X[1]; i++) game.after(0.05 + i * 0.05, () => { if (t.dead || p.dead) return;
    applyHit(p, t, { dmg: h.dmg * X[0], type: 'phys', sure: true, stun: t.st === 'hit' ? Math.max(t.stun || 0, 0.1) : 0.1, knock: 0, hs: 0.01, piExtra: true, piShadow: true, box: null, col: PI_COL.hot }, { proj: true, src }); });
});
