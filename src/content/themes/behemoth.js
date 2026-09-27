/* =====================================================================
   天帷巨兽的场景主题（手绘背景 art/final/bg/<主题>_{far,floor,edge}.webp，由 art/tools/behemoth_art.py 生成）
   - bhTemple    神殿外围：巨兽背上的 GBL 教神殿遗迹，云海（也用在区域地图“神殿之路”）
   - bhJungle    树精丛林：长在巨兽背上的魔法丛林，花粉飘散
   - bhPurgatory 炼狱：熔岩与黑曜石神殿，火星上升
   - bhDay       极昼：太阳永不落下的金色神殿，光柱
   - bhSpine     第二脊椎：巨兽脊椎里的骨拱与海水，气泡上升（也用在区域地图“脊背”）
   - bhForbidden 天帷禁地：被诅咒的教团禁地，红色鬼火
   每帧的点缀只用 source-over / lighter（ARCHITECTURE.md 的绘制规范）
   ===================================================================== */
Object.assign(BG_GRADE, {
  bhTemple: { tint: 'rgba(200,225,255,0.08)', fog: 'rgba(240,248,255,0.10)' },
  bhJungle: { tint: 'rgba(90,160,90,0.12)', fog: 'rgba(200,255,200,0.08)' },
  bhPurgatory: { tint: 'rgba(170,50,20,0.14)', fog: 'rgba(255,110,40,0.10)' },
  bhDay: { tint: 'rgba(255,220,140,0.10)', fog: 'rgba(255,248,220,0.10)' },
  bhSpine: { tint: 'rgba(110,80,160,0.12)', fog: 'rgba(170,220,255,0.10)' },
  bhForbidden: { tint: 'rgba(120,20,40,0.18)', fog: 'rgba(200,60,80,0.08)' },
});
// 上升的气泡（第二脊椎）
function bhBubbles(c, n) {
  c.save();
  ambientParticles(c, n, (i, a, b, s) => {
    const ph = (game.t * (0.06 + s * 0.06) + b) % 1, x = ((a * 1300 - cam.x * 0.85 + Math.sin(game.t * 1.5 + i) * 10) % 1100 + 1100) % 1100 - 70, y = WH + 20 - ph * (WH - 120), r = 2 + s * 4;
    c.globalAlpha = 0.5 * Math.sin(ph * Math.PI); c.strokeStyle = '#bfe8ff'; c.lineWidth = 1; c.beginPath(); c.arc(x, y, r, 0, TAU); c.stroke();
    c.fillStyle = '#ffffff'; c.fillRect(x - r * 0.4, y - r * 0.5, 1.5, 1.5);
  });
  c.restore();
}
// 飘动的鬼火（天帷禁地）
function bhWisps(c, n, rgb) {
  c.save(); c.globalCompositeOperation = 'lighter';
  ambientParticles(c, n, (i, a, b, s) => {
    const x = ((a * 1300 + Math.sin(game.t * 0.5 + i) * 80 - cam.x * 0.9) % 1100 + 1100) % 1100 - 70, y = FLOOR_Y - 40 + b * 200 + Math.sin(game.t * 1.3 + i) * 14, f = 0.7 + 0.3 * Math.sin(game.t * 9 + i);
    c.fillStyle = `rgba(${rgb},${0.18 * f})`; c.beginPath(); c.arc(x, y, 11, 0, TAU); c.fill();
    c.fillStyle = `rgba(${rgb},${0.75 * f})`; c.beginPath(); c.moveTo(x - 3, y); c.quadraticCurveTo(x, y - 12 * f, x + 1, y - 14 * f); c.quadraticCurveTo(x + 3, y - 5, x + 3, y); c.fill();
  });
  c.restore();
}

/* ---- 神殿外围 ---- */
THEMES.bhTemple = {
  sky: '#9ecbf0',
  far(c, w, R) {
    skyGrad(c, w, [[0, '#7ab8e8'], [0.6, '#b8dcf8'], [1, '#eef6ff']]);
    c.fillStyle = 'rgba(255,255,255,.85)'; for (let x = -60; x < w + 60; x += 80 + R() * 60) { c.beginPath(); c.ellipse(x, FLOOR_Y - 20 + R() * 20, 70 + R() * 50, 24 + R() * 12, 0, 0, TAU); c.fill(); }
    c.fillStyle = '#8a8a98'; c.beginPath(); c.moveTo(0, FLOOR_Y - 30); for (let x = 0; x <= w; x += 60) c.lineTo(x, FLOOR_Y - 60 - Math.sin(x * 0.004) * 30); c.lineTo(w, FLOOR_Y); c.lineTo(0, FLOOR_Y); c.fill();
  },
  mid(c, w, R) { for (let x = 0; x < w; x += 180 + R() * 140) column(c, x, FLOOR_Y + 6, 140 + R() * 50, 26, ['#f0ebe0', '#dcd4c4', '#c8bea8'], R, R() < 0.4); hazeBand(c, w, FLOOR_Y - 80, FLOOR_Y + 10, '#ffffff'); },
  wall(c, w, R) { brickWall(c, 0, w, FLOOR_Y - 28, FLOOR_Y, ['#e8e0d0', '#d4cab6'], R); c.fillStyle = '#2a8a8a'; c.fillRect(0, FLOOR_Y - 30, w, 3); },
  floor(c, w, R) { flagstones(c, w, FLOOR_Y - 4, ['#e4dccc', '#ece6d8', '#d8cfbc'], R, 'rgba(90,80,60,.35)'); },
  fore(c, w, R) { for (let x = 80; x < w; x += 380 + R() * 220) column(c, x, WH + 30, 150, 34, ['#c8beaa', '#b0a690', '#9a907a'], R, true); },
  back(c, room) { skyClouds(c, 6, 30, FLOOR_TOP - 70, '#ffffff', 9, 0.18); },
  ambient(c) {   // 风里飘着的沙粒与白色花瓣
    c.save();
    ambientParticles(c, 16, (i, a, b, s) => { const x = ((a * 1300 + game.t * (50 + s * 40) - cam.x * 1.05) % 1100 + 1100) % 1100 - 70, y = FLOOR_Y - 140 + b * 330 + Math.sin(game.t * 2 + i) * 10; c.fillStyle = i % 3 ? 'rgba(255,245,220,.7)' : 'rgba(255,255,255,.8)'; c.save(); c.translate(x, y); c.rotate(game.t * 2 + i); c.fillRect(-2, -1, 4, 2); c.restore(); });
    c.restore();
  },
};
/* ---- 树精丛林 ---- */
THEMES.bhJungle = {
  sky: '#1e3a2a',
  far(c, w, R) { skyGrad(c, w, [[0, '#1a3a2a'], [0.6, '#2e5a3a'], [1, '#4a7a4a']]); for (let x = -40; x < w + 40; x += 40 + R() * 30) tree(c, x, FLOOR_Y + 4, 240 + R() * 90, '#1e3a24', ['#2a5a32', '#326a3a', '#244a2c'], R, 0); },
  mid(c, w, R) { for (let x = -60; x < w + 60; x += 100 + R() * 80) tree(c, x, FLOOR_Y + 10, 200 + R() * 70, '#3a2a1a', ['#3a7a3a', '#4a8a44', '#2e6a32', '#5a9a4a'], R, 1); for (let x = 30; x < w; x += 90 + R() * 90) { c.fillStyle = ['#e87ac8', '#c86ae8', '#ff9ab8'][Math.floor(R() * 3)]; c.beginPath(); c.arc(x, FLOOR_Y - 10 - R() * 30, 10 + R() * 8, 0, TAU); c.fill(); } },
  wall(c, w, R) { THEMES.forest.wall(c, w, R); },
  floor(c, w, R) { THEMES.forest.floor(c, w, R); c.fillStyle = 'rgba(40,90,40,.25)'; c.fillRect(0, FLOOR_Y - 4, w, WH); },
  fore(c, w, R) { THEMES.forest.fore(c, w, R); },
  back(c, room) {   // 从树冠漏下来的光斑
    c.save(); c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 5; i++) { const x = ((i * 260 + 90 - (cam.x - room.x0) * 0.4) % 1300 + 1300) % 1300 - 170, a = 0.06 + 0.03 * Math.sin(game.t * 0.7 + i * 1.7); c.fillStyle = `rgba(210,255,170,${a})`; c.beginPath(); c.moveTo(x, 0); c.lineTo(x + 50, 0); c.lineTo(x + 170, FLOOR_Y + 80); c.lineTo(x + 90, FLOOR_Y + 80); c.closePath(); c.fill(); }
    c.restore();
  },
  ambient(c) { skyMotes(c, 24, '255,190,240', 16); },
};
/* ---- 炼狱 ---- */
THEMES.bhPurgatory = {
  sky: '#2a0806',
  far(c, w, R) { skyGrad(c, w, [[0, '#1a0404'], [0.55, '#4a0e08'], [0.9, '#a8300e'], [1, '#e0601a']]); mountains(c, w, FLOOR_Y + 10, 120, '#1a0a08', R, 60); },
  mid(c, w, R) { for (let x = 0; x < w; x += 220 + R() * 160) column(c, x, FLOOR_Y + 6, 130 + R() * 40, 28, ['#2a1a1a', '#3a2020', '#1a0e0e'], R, R() < 0.5); hazeBand(c, w, FLOOR_Y - 90, FLOOR_Y + 10, '#ff5a1a'); },
  wall(c, w, R) { brickWall(c, 0, w, FLOOR_Y - 34, FLOOR_Y, ['#2a1c1a', '#1e1412'], R); },
  floor(c, w, R) { flagstones(c, w, FLOOR_Y - 4, ['#2a2020', '#342626', '#221a1a'], R, 'rgba(255,90,20,.55)'); },
  fore(c, w, R) { for (let x = 60; x < w; x += 340 + R() * 240) column(c, x, WH + 30, 150, 34, ['#120606', '#1a0a0a', '#080202'], R, true); },
  ambient(c) {
    embers(c, 40, 'rgba(255,150,60,');
    c.save(); c.globalCompositeOperation = 'lighter'; const g = c.createLinearGradient(0, WH - 110, 0, WH); g.addColorStop(0, 'rgba(255,70,20,0)'); g.addColorStop(1, `rgba(255,70,20,${0.12 + 0.04 * Math.sin(game.t * 2.6)})`); c.fillStyle = g; c.fillRect(0, WH - 110, WW, 110); c.restore();
  },
};
/* ---- 极昼 ---- */
THEMES.bhDay = {
  sky: '#fff0c0',
  far(c, w, R) { skyGrad(c, w, [[0, '#ffe8a0'], [0.6, '#fff4d0'], [1, '#ffffff']]); c.fillStyle = 'rgba(255,255,230,.9)'; c.beginPath(); c.arc(w * 0.4, 70, 40, 0, TAU); c.fill(); for (let x = 0; x < w; x += 170) { c.fillStyle = '#f4e8c8'; c.fillRect(x + 40, 60, 50, FLOOR_Y - 60); c.fillStyle = '#e0c060'; c.beginPath(); c.arc(x + 65, 60, 26, Math.PI, 0); c.fill(); } },
  mid(c, w, R) { for (let x = 0; x < w; x += 160) column(c, x, FLOOR_Y + 6, 190, 30, ['#fffaf0', '#f0e6d0', '#e0d0b0'], R, false); hazeBand(c, w, FLOOR_Y - 90, FLOOR_Y + 10, '#fff6d8'); },
  wall(c, w, R) { brickWall(c, 0, w, FLOOR_Y - 24, FLOOR_Y, ['#f8f0dc', '#ecdcc0'], R); c.fillStyle = '#e0b040'; c.fillRect(0, FLOOR_Y - 26, w, 3); },
  floor(c, w, R) { flagstones(c, w, FLOOR_Y - 4, ['#fbf6ea', '#f2e8d4', '#fffcf4'], R, 'rgba(210,170,70,.45)'); },
  fore(c, w, R) { for (let x = 80; x < w; x += 400 + R() * 200) column(c, x, WH + 30, 150, 34, ['#e8d8b0', '#d8c490', '#c8b070'], R, false); },
  back(c, room) { c.fillStyle = 'rgba(60,40,20,.12)'; c.fillRect(0, 0, WW, WH); skyRays(c, 5, '255,244,200', 0.13); },   // 压暗一点，金白色的怪物才看得清
  ambient(c) { skyMotes(c, 22, '255,236,160', 18); },
};
/* ---- 第二脊椎 ---- */
THEMES.bhSpine = {
  sky: '#2a1a3a',
  far(c, w, R) { skyGrad(c, w, [[0, '#1e1030'], [0.6, '#3a2050'], [1, '#5a3a6a']]); for (let x = 20; x < w; x += 170 + R() * 60) { c.fillStyle = '#e8dcc8'; c.beginPath(); c.ellipse(x, FLOOR_Y - 120, 30, 110, 0, 0, TAU); c.fill(); c.fillStyle = '#c8b8a0'; c.beginPath(); c.ellipse(x + 8, FLOOR_Y - 120, 16, 96, 0, 0, TAU); c.fill(); } },
  mid(c, w, R) { for (let x = 0; x < w; x += 140 + R() * 80) { c.fillStyle = ['#ff8ab8', '#c86ae8', '#6ac8e8'][Math.floor(R() * 3)]; for (let j = 0; j < 4; j++) { c.beginPath(); c.ellipse(x + j * 8, FLOOR_Y - 8 - j * 7, 5, 12, (j - 1.5) * 0.3, 0, TAU); c.fill(); } } hazeBand(c, w, FLOOR_Y - 90, FLOOR_Y + 10, '#8ab8e8'); },
  wall(c, w, R) { for (let x = -20; x < w + 20; x += 36 + R() * 30) { c.fillStyle = '#d8ccb4'; c.beginPath(); c.ellipse(x, FLOOR_Y - 4, 18 + R() * 8, 16 + R() * 10, 0, Math.PI, 0); c.fill(); } },
  floor(c, w, R) { flagstones(c, w, FLOOR_Y - 4, ['#cfc2ac', '#dcd0bc', '#c2b49c'], R, 'rgba(60,40,80,.4)'); for (let i = 0; i < w / 120; i++) { c.fillStyle = 'rgba(90,150,210,.35)'; c.beginPath(); c.ellipse(R() * w, FLOOR_Y + 30 + R() * 150, 30 + R() * 30, 6 + R() * 4, 0, 0, TAU); c.fill(); } },
  fore(c, w, R) { for (let x = 60; x < w; x += 360 + R() * 220) { c.fillStyle = '#2a1a2a'; c.beginPath(); c.ellipse(x, WH + 20, 40, 110, 0.2, 0, TAU); c.fill(); } },
  ambient(c) { bhBubbles(c, 18); skyMotes(c, 10, '160,220,255', 12); },
};
/* ---- 天帷禁地 ---- */
THEMES.bhForbidden = {
  sky: '#120608',
  far(c, w, R) { skyGrad(c, w, [[0, '#0a0406'], [0.6, '#200a10'], [1, '#381418']]); for (let x = 0; x < w; x += 150 + R() * 60) { c.fillStyle = '#1e0e12'; c.fillRect(x, 40, 36, FLOOR_Y - 40); c.fillStyle = '#6a0a1a'; c.fillRect(x + 50, 60, 30, 100); } },
  mid(c, w, R) { for (let x = 60; x < w; x += 170 + R() * 80) { c.fillStyle = '#2a1a1e'; c.fillRect(x - 12, FLOOR_Y - 90, 24, 90); c.beginPath(); c.ellipse(x, FLOOR_Y - 98, 13, 15, 0, 0, TAU); c.fill(); } },
  wall(c, w, R) { brickWall(c, 0, w, FLOOR_Y - 34, FLOOR_Y, ['#2a1a1e', '#1e1216'], R); },
  floor(c, w, R) { flagstones(c, w, FLOOR_Y - 4, ['#2a2226', '#322a2e', '#241c20'], R, 'rgba(0,0,0,.6)'); c.strokeStyle = 'rgba(150,20,30,.5)'; c.lineWidth = 3; c.beginPath(); c.ellipse(w / 2, FLOOR_Y + 100, 160, 50, 0, 0, TAU); c.stroke(); },
  fore(c, w, R) { for (let x = 60; x < w; x += 300 + R() * 240) tombstone(c, x, WH + 16, 3 + R(), ['#0e0608', '#160a0e'], R); },
  ambient(c) { bhWisps(c, 12, '255,90,110'); },
};
