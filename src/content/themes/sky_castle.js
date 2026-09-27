/* =====================================================================
   天空之城的场景主题（手绘背景在 art/final/bg/<主题>_{far,floor,edge}.webp，由 art/tools/sky_art.py 生成）
   - skyTower  云上的白石塔台（龙人之塔、石巨人塔、区域地图）
   - skyHall   人偶玄关：摆满石像的大理石大厅
   - skyDark   黑暗玄廊：漆黑的骑士长廊；夜视镜卡格还活着时更黑
   - skyPalace 城主宫殿 / 悬空城：金白色的光之宫殿
   每个主题都有程序化的兜底图层（没有手绘背景时用）+ back（背景层动态）+ ambient（前景粒子）
   ===================================================================== */
Object.assign(BG_GRADE, {
  skyTower: { tint: 'rgba(170,215,255,0.08)', fog: 'rgba(230,245,255,0.10)' },
  skyHall: { tint: 'rgba(150,100,210,0.12)', fog: 'rgba(210,170,255,0.08)' },
  skyDark: { tint: 'rgba(90,30,50,0.20)', fog: 'rgba(160,60,80,0.08)' },
  skyPalace: { tint: 'rgba(255,225,150,0.10)', fog: 'rgba(255,245,210,0.10)' },
});
// 飘过的云朵（远景之上、地面之下）
function skyClouds(c, n, y0, y1, col, speed = 12, par = 0.25) {
  c.save();
  ambientParticles(c, n, (i, a, b, s) => {
    const w = 90 + s * 120, x = ((a * 1600 + game.t * speed * (0.6 + s) - cam.x * par) % 1400 + 1400) % 1400 - 220, y = y0 + b * (y1 - y0);
    c.fillStyle = col; c.globalAlpha = 0.35 + s * 0.3;
    for (let j = 0; j < 4; j++) { c.beginPath(); c.ellipse(x + j * w * 0.22, y - Math.sin(j * 1.7 + i) * 6, w * 0.22, w * 0.11, 0, 0, TAU); c.fill(); }
  });
  c.restore();
}
function skyMotes(c, n, rgb, rise = 18) {
  c.save(); c.globalCompositeOperation = 'lighter';
  ambientParticles(c, n, (i, a, b, s) => {
    const ph = (game.t * (0.05 + s * 0.05) + b) % 1, x = ((a * 1300 - cam.x * 0.9 + Math.sin(game.t * 0.8 + i) * 20) % 1100 + 1100) % 1100 - 70, y = FLOOR_Y + 170 - ph * (rise * 14), al = Math.sin(ph * Math.PI);
    c.fillStyle = `rgba(${rgb},${0.7 * al})`; c.fillRect(x, y, 2, 2); c.fillStyle = `rgba(${rgb},${0.15 * al})`; c.beginPath(); c.arc(x + 1, y + 1, 5, 0, TAU); c.fill();
  });
  c.restore();
}
// 从上方斜射下来的光柱
function skyRays(c, n, rgb, a0 = 0.08) {
  c.save(); c.globalCompositeOperation = 'lighter';
  for (let i = 0; i < n; i++) {
    const x = ((i * 390 + 120 - cam.x * 0.3) % 1300 + 1300) % 1300 - 170, a = a0 * (0.7 + 0.3 * Math.sin(game.t * 0.6 + i * 2));
    const g = c.createLinearGradient(x, 0, x + 140, FLOOR_Y + 120); g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(1, `rgba(${rgb},0)`);
    c.fillStyle = g; c.beginPath(); c.moveTo(x, 0); c.lineTo(x + 60, 0); c.lineTo(x + 230, FLOOR_Y + 120); c.lineTo(x + 120, FLOOR_Y + 120); c.closePath(); c.fill();
  }
  c.restore();
}

/* ---- 云上的白石塔台 ---- */
THEMES.skyTower = {
  sky: '#8ec8f0',
  far(c, w, R) {
    skyGrad(c, w, [[0, '#6ab0e8'], [0.6, '#a8d8f8'], [1, '#e8f4ff']]);
    c.fillStyle = 'rgba(255,255,255,.85)'; for (let x = -60; x < w + 60; x += 70 + R() * 60) { c.beginPath(); c.ellipse(x, FLOOR_Y - 30 + R() * 20, 70 + R() * 50, 26 + R() * 14, 0, 0, TAU); c.fill(); }
    for (let x = 80; x < w; x += 260 + R() * 220) { const h = 120 + R() * 90; c.fillStyle = '#d8d0c0'; c.fillRect(x, FLOOR_Y - h, 34, h); c.fillStyle = '#4a7ac8'; c.beginPath(); c.moveTo(x - 6, FLOOR_Y - h); c.lineTo(x + 17, FLOOR_Y - h - 40); c.lineTo(x + 40, FLOOR_Y - h); c.fill(); }
  },
  mid(c, w, R) { for (let x = 0; x < w; x += 200 + R() * 160) column(c, x, FLOOR_Y + 6, 150 + R() * 40, 26, ['#e8e0d0', '#d0c8b8', '#bab2a2'], R, R() < 0.3); hazeBand(c, w, FLOOR_Y - 80, FLOOR_Y + 10, '#ffffff'); },
  wall(c, w, R) { brickWall(c, 0, w, FLOOR_Y - 30, FLOOR_Y, ['#e0d8c8', '#cfc6b4'], R); c.fillStyle = '#c8a040'; c.fillRect(0, FLOOR_Y - 32, w, 3); },
  floor(c, w, R) { flagstones(c, w, FLOOR_Y - 4, ['#d8d2c4', '#e4ddd0', '#ccc4b4'], R, 'rgba(90,80,60,.35)'); c.fillStyle = 'rgba(200,160,64,.35)'; for (let x = 0; x < w; x += 120) c.fillRect(x, FLOOR_Y - 4, 2, WH); },
  fore(c, w, R) { c.fillStyle = 'rgba(255,255,255,.9)'; for (let x = 0; x < w; x += 260 + R() * 200) for (let j = 0; j < 4; j++) { c.beginPath(); c.ellipse(x + j * 30, WH + 10, 40, 26, 0, Math.PI, 0); c.fill(); } },
  back(c, room) { c.fillStyle = 'rgba(30,40,80,.1)'; c.fillRect(0, 0, WW, WH); skyClouds(c, 7, 30, FLOOR_TOP - 60, '#ffffff', 10, 0.18); },
  ambient(c) {
    c.save(); c.globalAlpha = 0.9;
    ambientParticles(c, 14, (i, a, b, s) => { const x = ((a * 1300 + game.t * (40 + s * 40) - cam.x * 1.05) % 1100 + 1100) % 1100 - 70, y = FLOOR_Y - 120 + b * 320 + Math.sin(game.t * 2 + i) * 10; c.fillStyle = i % 3 ? 'rgba(255,255,255,.75)' : 'rgba(255,210,230,.75)'; c.save(); c.translate(x, y); c.rotate(game.t * 2 + i); c.fillRect(-2, -1, 4, 2); c.restore(); });
    c.restore();
  },
};
/* ---- 人偶玄关 ---- */
THEMES.skyHall = {
  sky: '#2a1a3a',
  far(c, w, R) {
    skyGrad(c, w, [[0, '#1e1230'], [0.6, '#3a2450'], [1, '#5a3a6a']]);
    for (let x = 40; x < w; x += 120 + R() * 40) { c.fillStyle = '#6a3a7a'; c.fillRect(x, 20, 60, FLOOR_Y - 30); c.fillStyle = '#4a2a5a'; for (let k = 0; k < 4; k++) c.fillRect(x + 6 + k * 14, 20, 4, FLOOR_Y - 30); }
  },
  mid(c, w, R) { for (let x = 30; x < w; x += 110 + R() * 60) { c.fillStyle = '#8a8490'; c.fillRect(x - 14, FLOOR_Y - 20, 28, 20); c.fillStyle = '#a8a2b0'; c.beginPath(); c.ellipse(x, FLOOR_Y - 88, 12, 14, 0, 0, TAU); c.fill(); c.fillRect(x - 12, FLOOR_Y - 74, 24, 54); } },
  wall(c, w, R) { brickWall(c, 0, w, FLOOR_Y - 26, FLOOR_Y, ['#4a3a5a', '#3a2c4a'], R); },
  floor(c, w, R) { const top = FLOOR_Y - 4; for (let y = top, r = 0; y < WH; y += 22, r++) for (let x = (r % 2) * 22; x < w; x += 44) { c.fillStyle = r % 2 ? '#6a4a80' : '#d8c8b8'; c.fillRect(x, y, 22, 22); c.fillStyle = r % 2 ? '#d8c8b8' : '#6a4a80'; c.fillRect(x + 22, y, 22, 22); } c.fillStyle = 'rgba(20,10,30,.35)'; c.fillRect(0, top, w, WH - top); },
  fore(c, w, R) { c.strokeStyle = 'rgba(220,200,255,.25)'; c.lineWidth = 1; for (let x = 0; x < w; x += 90 + R() * 80) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x + R() * 10, 80 + R() * 120); c.stroke(); } },
  back(c, room) {   // 天花板垂下的提线，微微摆动
    c.save(); c.strokeStyle = 'rgba(230,210,255,.22)'; c.lineWidth = 1;
    for (let i = 0; i < 9; i++) { const x = ((i * 157 + 40 - (cam.x - room.x0) * 0.6) % 1100 + 1100) % 1100 - 70, len = 90 + (i * 53) % 110, sw = Math.sin(game.t * 0.9 + i) * 6; c.beginPath(); c.moveTo(x, 0); c.quadraticCurveTo(x + sw, len / 2, x + sw * 1.6, len); c.stroke(); c.fillStyle = 'rgba(230,210,255,.3)'; c.fillRect(x + sw * 1.6 - 2, len, 4, 4); }
    c.restore();
  },
  ambient(c) { skyMotes(c, 20, '220,170,255', 16); },
};
/* ---- 黑暗玄廊：画面整体很暗，只有玩家周围亮；夜视镜卡格活着时更暗（官方：卡格会关灯） ---- */
THEMES.skyDark = {
  sky: '#0a0608',
  far(c, w, R) { skyGrad(c, w, [[0, '#050304'], [0.6, '#140a0e'], [1, '#221216']]); for (let x = 0; x < w; x += 140 + R() * 60) { c.fillStyle = '#1a1014'; c.fillRect(x, 30, 40, FLOOR_Y - 30); c.fillStyle = '#0a0608'; c.beginPath(); c.moveTo(x + 40, FLOOR_Y); c.lineTo(x + 40, 110); c.arc(x + 100, 110, 60, Math.PI, 0); c.lineTo(x + 160, FLOOR_Y); c.fill(); } },
  mid(c, w, R) { for (let x = 60; x < w; x += 170 + R() * 80) { c.fillStyle = '#2a2228'; c.fillRect(x - 12, FLOOR_Y - 96, 24, 96); c.beginPath(); c.ellipse(x, FLOOR_Y - 104, 13, 15, 0, 0, TAU); c.fill(); c.fillStyle = 'rgba(255,40,40,.7)'; c.fillRect(x - 6, FLOOR_Y - 106, 12, 2); } },
  wall(c, w, R) { brickWall(c, 0, w, FLOOR_Y - 34, FLOOR_Y, ['#2a2024', '#1e161a'], R); },
  floor(c, w, R) { flagstones(c, w, FLOOR_Y - 4, ['#2a2426', '#322a2c', '#241e20'], R, 'rgba(0,0,0,.6)'); c.fillStyle = 'rgba(110,20,30,.55)'; c.fillRect(0, FLOOR_Y + 70, w, 60); },
  fore(c, w, R) { for (let x = 60; x < w; x += 300 + R() * 240) column(c, x, WH + 30, 150, 34, ['#0a0608', '#120c0e', '#060404'], R, true); },
  back(c, room) {   // 墙上的红色火把
    c.save(); c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 4; i++) { const x = ((i * 290 + 130 - (cam.x - room.x0)) % 1160 + 1160) % 1160 - 100, y = FLOOR_TOP - 70, f = 0.8 + 0.2 * Math.sin(game.t * 11 + i * 3); const g = c.createRadialGradient(x, y, 2, x, y, 70 * f); g.addColorStop(0, 'rgba(255,90,60,.5)'); g.addColorStop(1, 'rgba(255,40,40,0)'); c.fillStyle = g; c.fillRect(x - 80, y - 80, 160, 160); }
    c.restore();
  },
  ambient(c, room) {
    const p = game.player;
    const goggles = game.scene === 'dungeon' ? ents.filter(e => e.kind === 'kargoGoggle' && !e.dead).length : 0;
    const dark = goggles ? 0.62 : 0.38, r0 = goggles ? 150 : 230;
    const X = p ? sx(p.x) : WW / 2, Y = p ? sy(p.y, p.z + 40) : WH / 2;
    const g = c.createRadialGradient(X, Y, r0, X, Y, r0 + 260); g.addColorStop(0, 'rgba(6,2,6,0)'); g.addColorStop(1, `rgba(6,2,6,${dark})`);
    c.fillStyle = g; c.fillRect(0, 0, WW, WH);
    skyMotes(c, 12, '255,90,80', 10);
  },
};
/* ---- 光之宫殿 ---- */
THEMES.skyPalace = {
  sky: '#f0e0b0',
  far(c, w, R) { skyGrad(c, w, [[0, '#f8e8b8'], [0.6, '#fff4d8'], [1, '#ffffff']]); for (let x = 0; x < w; x += 150) { c.fillStyle = 'rgba(120,180,255,.35)'; c.fillRect(x + 40, 40, 60, 160); c.fillStyle = 'rgba(255,200,120,.35)'; c.beginPath(); c.arc(x + 70, 40, 30, Math.PI, 0); c.fill(); } },
  mid(c, w, R) { for (let x = 0; x < w; x += 150) column(c, x, FLOOR_Y + 6, 190, 30, ['#fffaf0', '#f0e6d0', '#e0d0b0'], R, false); hazeBand(c, w, FLOOR_Y - 90, FLOOR_Y + 10, '#fff6d8'); },
  wall(c, w, R) { brickWall(c, 0, w, FLOOR_Y - 24, FLOOR_Y, ['#f4ecdc', '#e8dcc4'], R); c.fillStyle = '#d8b040'; c.fillRect(0, FLOOR_Y - 26, w, 3); },
  floor(c, w, R) { flagstones(c, w, FLOOR_Y - 4, ['#f8f4ec', '#efe8da', '#fffcf6'], R, 'rgba(200,160,60,.45)'); },
  fore(c, w, R) { for (let x = 80; x < w; x += 380 + R() * 200) column(c, x, WH + 30, 150, 34, ['#e8d8b0', '#d8c490', '#c8b070'], R, false); },
  back(c, room) { c.fillStyle = 'rgba(40,30,70,.2)'; c.fillRect(0, 0, WW, WH); skyRays(c, 4, '255,240,190', 0.12); },   // 背景整体压暗一点，金白色的赛格哈特才看得清
  ambient(c) { skyMotes(c, 22, '255,230,150', 18); },
};
