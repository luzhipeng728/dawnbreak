/* =====================================================================
   29. 更多场景主题：幽影密林 / 雷鸣遗迹 / 毒雾遗迹 / 牛头营地 / 烈焰营地 / 亡者遗迹
   每个主题 = 预渲染分层（far / mid / wall / floor / fore）+ 每帧的动态点缀（back：墙上的火焰；ambient：雨、雷光、毒泡、火星、鬼火、萤火虫）
   ===================================================================== */
/* ---- 通用绘制件 ---- */
function mountains(c, w, base, hMax, col, R, step = 50) {
  c.fillStyle = col; c.beginPath(); c.moveTo(-10, base); let y = base - hMax * 0.5;
  for (let x = -10; x <= w + step; x += step * (0.6 + R() * 0.8)) { y = clamp(y + (R() - 0.5) * hMax * 0.7, base - hMax, base - hMax * 0.15); c.lineTo(x, y); }
  c.lineTo(w + 10, base); c.closePath(); c.fill();
}
function deadTree(c, x, base, h, col, R, lw = 1) {
  c.strokeStyle = col; c.lineCap = 'round';
  const br = (x0, y0, a, len, w, d) => {
    const x1 = x0 + Math.sin(a) * len, y1 = y0 - Math.cos(a) * len;
    c.lineWidth = w; c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo((x0 + x1) / 2 + (R() - 0.5) * len * 0.3, (y0 + y1) / 2, x1, y1); c.stroke();
    if (d > 0) { const n = 2 + (R() < 0.4 ? 1 : 0); for (let i = 0; i < n; i++) br(x1, y1, a + (R() - 0.5) * 1.5, len * (0.55 + R() * 0.2), w * 0.62, d - 1); }
  };
  c.fillStyle = col; c.beginPath(); c.moveTo(x - h * 0.08 * lw, base); c.quadraticCurveTo(x, base - h * 0.1, x - h * 0.02, base - h * 0.2); c.lineTo(x + h * 0.03, base - h * 0.2); c.quadraticCurveTo(x, base - h * 0.1, x + h * 0.09 * lw, base); c.fill();
  br(x, base - h * 0.15, (R() - 0.5) * 0.3, h * 0.42, h * 0.06 * lw, 4);
}
function column(c, x, base, h, w, pal, R, broken) {
  const top = base - h;
  c.fillStyle = pal[1]; c.fillRect(x - w * 0.75, base - 8, w * 1.5, 8); c.fillRect(x - w * 0.65, base - 13, w * 1.3, 5);
  const g = c.createLinearGradient(x - w / 2, 0, x + w / 2, 0); g.addColorStop(0, pal[2]); g.addColorStop(0.35, pal[0]); g.addColorStop(1, pal[2]);
  c.fillStyle = g;
  if (broken) { c.beginPath(); c.moveTo(x - w / 2, base - 13); c.lineTo(x - w / 2, top + 10); for (let i = 0; i <= 4; i++) c.lineTo(x - w / 2 + w * i / 4, top + R() * 22); c.lineTo(x + w / 2, base - 13); c.closePath(); c.fill(); }
  else { c.fillRect(x - w / 2, top + 10, w, h - 23); c.fillStyle = pal[1]; c.fillRect(x - w * 0.75, top, w * 1.5, 6); c.fillRect(x - w * 0.62, top + 6, w * 1.24, 5); }
  c.strokeStyle = 'rgba(0,0,0,.18)'; c.lineWidth = 1; for (let i = 1; i < 4; i++) { c.beginPath(); c.moveTo(x - w / 2 + w * i / 4, top + 14); c.lineTo(x - w / 2 + w * i / 4, base - 14); c.stroke(); }
  for (let i = 0; i < 3; i++) { c.strokeStyle = 'rgba(0,0,0,.35)'; c.beginPath(); const yy = top + 20 + R() * (h - 40); c.moveTo(x - w / 2, yy); c.lineTo(x - w / 2 + R() * w * 0.6, yy + 6 + R() * 8); c.stroke(); }
}
function brickWall(c, x0, x1, top, base, pal, R, bw = 26, bh = 12) {
  c.fillStyle = pal[0]; c.fillRect(x0, top, x1 - x0, base - top);
  for (let y = top, row = 0; y < base; y += bh, row++) for (let x = x0 - (row % 2) * bw / 2; x < x1; x += bw) {
    c.fillStyle = shade(pal[0], (R() - 0.5) * 0.18); c.fillRect(Math.max(x0, x + 1), y + 1, Math.min(bw - 2, x1 - x - 1), bh - 2);
    if (R() < 0.08) { c.fillStyle = pal[1]; c.fillRect(Math.max(x0, x + 3), y + 3, bw * 0.4, 3); }
  }
}
function flagstones(c, w, top, pal, R, gap = 'rgba(0,0,0,.45)') {
  let y = top;
  for (let row = 0; y < WH; row++) {
    const rh = 9 + row * 2.6;
    for (let x = -R() * 40; x < w; ) {
      const sw = (30 + R() * 34) * (1 + row * 0.1);
      c.fillStyle = gap; c.fillRect(x, y, sw, rh);
      c.fillStyle = shade(pal[Math.floor(R() * pal.length)], (R() - 0.5) * 0.14); c.fillRect(x + 1, y + 1, sw - 2, rh - 2);
      c.fillStyle = 'rgba(255,255,255,.05)'; c.fillRect(x + 1, y + 1, sw - 2, 1);
      if (R() < 0.12) { c.strokeStyle = 'rgba(0,0,0,.4)'; c.lineWidth = 1; c.beginPath(); c.moveTo(x + sw * R(), y + 1); c.lineTo(x + sw * R(), y + rh * 0.6); c.lineTo(x + sw * R(), y + rh - 1); c.stroke(); }
      x += sw;
    }
    y += rh;
  }
}
function tent(c, x, base, w, h, pal, R) {
  c.fillStyle = pal[1]; c.beginPath(); c.moveTo(x - w / 2, base); c.lineTo(x - w * 0.06, base - h); c.lineTo(x + w * 0.06, base - h); c.lineTo(x + w / 2, base); c.closePath(); c.fill();
  c.fillStyle = pal[0]; c.beginPath(); c.moveTo(x - w / 2, base); c.lineTo(x - w * 0.06, base - h); c.lineTo(x, base - h * 0.9); c.lineTo(x - w * 0.1, base); c.closePath(); c.fill();
  c.fillStyle = 'rgba(0,0,0,.55)'; c.beginPath(); c.moveTo(x - w * 0.14, base); c.lineTo(x, base - h * 0.45); c.lineTo(x + w * 0.14, base); c.closePath(); c.fill();
  for (let i = 0; i < 4; i++) { c.fillStyle = shade(pal[1], -0.2); c.fillRect(x - w / 2 + w * (0.15 + i * 0.22), base - h * 0.35 - R() * h * 0.2, w * 0.08, h * 0.12); }
  c.strokeStyle = pal[2]; c.lineWidth = 2; c.beginPath(); c.moveTo(x - 2, base - h); c.lineTo(x - 8, base - h - 14); c.moveTo(x + 2, base - h); c.lineTo(x + 8, base - h - 12); c.stroke();
}
function palisade(c, x0, x1, base, h, col, R) {
  for (let x = x0; x < x1; x += 11) {
    const hh = h * (0.8 + R() * 0.3);
    c.fillStyle = shade(col, (R() - 0.5) * 0.2); c.beginPath(); c.moveTo(x, base); c.lineTo(x, base - hh); c.lineTo(x + 5, base - hh - 9); c.lineTo(x + 10, base - hh); c.lineTo(x + 10, base); c.closePath(); c.fill();
    c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(x + 7, base - hh, 3, hh);
  }
  c.fillStyle = shade(col, -0.25); c.fillRect(x0, base - h * 0.35, x1 - x0, 4); c.fillRect(x0, base - h * 0.75, x1 - x0, 4);
}
function totem(c, x, base, h, R) {
  c.fillStyle = '#4a3222'; c.fillRect(x - 5, base - h, 10, h);
  c.fillStyle = '#e8dcc0'; c.beginPath(); c.ellipse(x, base - h + 4, 11, 9, 0, 0, TAU); c.fill();
  c.fillStyle = '#1a1210'; c.fillRect(x - 6, base - h + 2, 4, 4); c.fillRect(x + 2, base - h + 2, 4, 4);
  c.strokeStyle = '#e8dcc0'; c.lineWidth = 3; c.beginPath(); c.moveTo(x - 9, base - h); c.quadraticCurveTo(x - 22, base - h - 8, x - 18, base - h - 20); c.moveTo(x + 9, base - h); c.quadraticCurveTo(x + 22, base - h - 8, x + 18, base - h - 20); c.stroke();
  c.fillStyle = '#8a2a1a'; c.fillRect(x - 6, base - h * 0.6, 12, 3); c.fillRect(x - 6, base - h * 0.45, 12, 3);
}
function tombstone(c, x, base, s, pal, R) {
  const w = 16 * s, h = 26 * s, tilt = (R() - 0.5) * 0.25;
  c.save(); c.translate(x, base); c.rotate(tilt);
  c.fillStyle = pal[0]; c.beginPath(); c.moveTo(-w / 2, 0); c.lineTo(-w / 2, -h + w / 2); c.arc(0, -h + w / 2, w / 2, Math.PI, 0); c.lineTo(w / 2, 0); c.closePath(); c.fill();
  c.fillStyle = pal[1]; c.fillRect(-w / 2 + 2, -h + w / 2, 2, h - w / 2 - 2);
  c.fillStyle = 'rgba(0,0,0,.4)'; c.fillRect(-2 * s, -h * 0.7, 4 * s, h * 0.35); c.fillRect(-5 * s, -h * 0.62, 10 * s, 3 * s);
  c.restore();
}
function bones(c, x, y, R) { c.fillStyle = '#d8d0b8'; c.fillRect(x, y, 8, 2); c.fillRect(x - 1, y - 1, 2, 4); c.fillRect(x + 7, y - 1, 2, 4); if (R() < 0.4) { c.beginPath(); c.ellipse(x + 14, y, 4, 3.5, 0, 0, TAU); c.fill(); c.fillStyle = '#2a2420'; c.fillRect(x + 12, y - 1, 1.5, 1.5); c.fillRect(x + 15, y - 1, 1.5, 1.5); } }
function skyGrad(c, w, stops) { const g = c.createLinearGradient(0, 0, 0, FLOOR_Y + 10); stops.forEach(([t, col]) => g.addColorStop(t, col)); c.fillStyle = g; c.fillRect(0, 0, w, FLOOR_Y + 10); }
function hazeBand(c, w, y0, y1, col) { const g = c.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, shade(col, 0, 0)); g.addColorStop(1, shade(col, 0, 0.4)); c.fillStyle = g; c.fillRect(0, y0, w, y1 - y0); }
function dirtFloor(c, w, pal, R, speck) {
  const top = FLOOR_Y - 4, h = WH - top;
  const g = c.createLinearGradient(0, top, 0, WH); g.addColorStop(0, pal[0]); g.addColorStop(0.4, pal[1]); g.addColorStop(1, pal[2]); c.fillStyle = g; c.fillRect(0, top, w, h);
  for (let i = 0; i < w * 0.7; i++) { const x = R() * w, y = top + 4 + R() * (h - 6); c.fillStyle = speck[Math.floor(R() * speck.length)]; c.fillRect(Math.round(x), Math.round(y), 1 + Math.floor(R() * 2), 1); }
}
// 墙上火把：位置记到 room.lights，每帧在 back 里画跳动的火焰和光晕
function addTorch(c, room, x, y, col = '#ff9a3a') {
  c.fillStyle = '#3a2a1a'; c.fillRect(x - 2, y, 4, 22); c.fillStyle = '#6a4a2a'; c.fillRect(x - 4, y - 2, 8, 5);
  (room.lights = room.lights || []).push({ x, y: y - 4, col });
}
function drawLights(c, room) {
  if (!room.lights) return;
  c.save(); c.globalCompositeOperation = 'lighter';
  for (const L of room.lights) {
    const X = Math.round(L.x - (cam.x - room.x0) + cam.shx), Y = L.y + cam.shy; if (X < -80 || X > WW + 80) continue;
    const f = 0.8 + 0.2 * Math.sin(game.t * 13 + L.x) + 0.1 * Math.sin(game.t * 23 + L.x * 0.3);
    const g = c.createRadialGradient(X, Y, 2, X, Y, 60 * f); g.addColorStop(0, shade(L.col, 0.2, 0.45)); g.addColorStop(1, shade(L.col, 0, 0)); c.fillStyle = g; c.fillRect(X - 70, Y - 70, 140, 140);
    c.fillStyle = shade(L.col, 0, 0.9); c.beginPath(); c.moveTo(X - 4 * f, Y + 2); c.quadraticCurveTo(X - 5, Y - 6 * f, X + Math.sin(game.t * 17 + L.x) * 2, Y - 14 * f); c.quadraticCurveTo(X + 5, Y - 6 * f, X + 4 * f, Y + 2); c.fill();
    c.fillStyle = 'rgba(255,240,200,.9)'; c.beginPath(); c.ellipse(X, Y - 2, 2, 4 * f, 0, 0, TAU); c.fill();
  }
  c.restore();
}
// 伪随机粒子：由序号和时间决定位置，不需要保存状态
function ambientParticles(c, n, fn) { for (let i = 0; i < n; i++) fn(i, hash2(i, 17), hash2(i, 91), hash2(i, 43)); }

/* ---- 幽影密林：更暗、更冷，枯树与发光蘑菇，萤火虫 ---- */
THEMES.forestDark = {
  sky: '#070c14',
  far(c, w, R) {
    skyGrad(c, w, [[0, '#05080f'], [0.6, '#0d1a24'], [1, '#162a2e']]);
    c.fillStyle = 'rgba(200,220,255,.8)'; c.beginPath(); c.arc(w * 0.3, 60, 16, 0, TAU); c.fill(); c.fillStyle = '#0a1018'; c.beginPath(); c.arc(w * 0.3 + 6, 56, 14, 0, TAU); c.fill();
    for (let x = -40; x < w + 40; x += 30 + R() * 26) tree(c, x, FLOOR_Y + 4, 250 + R() * 100, '#0a141a', ['#0c1a1e', '#0e1e22', '#0a1418'], R, 0);
  },
  mid(c, w, R) {
    for (let x = 0; x < w; x += 110 + R() * 120) deadTree(c, x, FLOOR_Y + 8, 170 + R() * 80, '#141c22', R, 1.2);
    hazeBand(c, w, FLOOR_Y - 110, FLOOR_Y + 10, '#4a6a80');
  },
  wall(c, w, R, room) {
    for (let x = -20; x < w + 20; x += 12 + R() * 16) { const h = 16 + R() * 24, col = ['#1c3a34', '#224238', '#18302c'][Math.floor(R() * 3)]; c.fillStyle = col; c.beginPath(); c.ellipse(x, FLOOR_Y - 2, 14 + R() * 12, h * 0.6, 0, Math.PI, 0); c.fill(); }
    room.shrooms = [];
    for (let x = 30; x < w; x += 70 + R() * 140) { const n = 1 + Math.floor(R() * 3); for (let j = 0; j < n; j++) { const xx = x + j * 9, s = 0.7 + R() * 0.6; c.fillStyle = '#c8d8d0'; c.fillRect(xx - 1, FLOOR_Y - 8 * s, 2, 8 * s); c.fillStyle = '#4ad0c0'; c.beginPath(); c.ellipse(xx, FLOOR_Y - 8 * s, 6 * s, 4 * s, 0, Math.PI, 0); c.fill(); room.shrooms.push({ x: xx, y: FLOOR_Y - 9 * s }); } }
  },
  floor(c, w, R) {
    THEMES.forest.floor(c, w, R);
    c.fillStyle = 'rgba(10,20,40,.45)'; c.fillRect(0, FLOOR_Y - 4, w, WH);
    for (let i = 0; i < w / 90; i++) { const x = R() * w, y = FLOOR_Y + 30 + R() * 150; c.fillStyle = 'rgba(30,50,60,.5)'; c.beginPath(); c.ellipse(x, y, 30 + R() * 30, 6 + R() * 5, 0, 0, TAU); c.fill(); }
  },
  fore(c, w, R) { for (let x = -40; x < w + 40; x += 180 + R() * 200) { c.fillStyle = '#04080a'; for (let j = 0; j < 5; j++) { c.beginPath(); c.ellipse(x + j * 18 - 36, WH + 6, 22 + R() * 14, 30 + R() * 34, 0, Math.PI, 0); c.fill(); } } },
  back(c, room) {
    if (!room.shrooms) return; c.save(); c.globalCompositeOperation = 'lighter';
    for (const s of room.shrooms) { const X = s.x - (cam.x - room.x0) + cam.shx, a = 0.18 + 0.08 * Math.sin(game.t * 2 + s.x); if (X < -30 || X > WW + 30) continue; c.fillStyle = `rgba(80,220,200,${a})`; c.beginPath(); c.arc(X, s.y, 12, 0, TAU); c.fill(); }
    c.restore();
  },
  ambient(c) {
    c.save(); c.globalCompositeOperation = 'lighter';
    ambientParticles(c, 26, (i, a, b, s) => { const x = ((a * 1400 + Math.sin(game.t * 0.4 + i) * 60 - cam.x * 0.9) % 1100 + 1100) % 1100 - 70, y = FLOOR_Y - 60 + b * 220 + Math.sin(game.t * 0.9 + i * 2) * 18, al = 0.5 + 0.5 * Math.sin(game.t * (1.5 + s * 2) + i); c.fillStyle = `rgba(190,255,140,${0.55 * al})`; c.fillRect(x, y, 2, 2); c.fillStyle = `rgba(190,255,140,${0.12 * al})`; c.beginPath(); c.arc(x + 1, y + 1, 5, 0, TAU); c.fill(); });
    c.restore();
  },
};

/* ---- 雷鸣遗迹：雷云、断柱、石砖地面；雨丝 + 远处闪电 ---- */
const RUIN_STONE = ['#6a6a72', '#7a7880', '#5a5a64'];
THEMES.ruins = {
  sky: '#141620',
  far(c, w, R) {
    skyGrad(c, w, [[0, '#101220'], [0.5, '#262a3c'], [1, '#3a3e4c']]);
    for (let i = 0; i < w / 60; i++) { const x = R() * w, y = 20 + R() * 120, r = 30 + R() * 50; c.fillStyle = `rgba(${20 + R() * 20},${22 + R() * 20},${34 + R() * 20},.7)`; c.beginPath(); c.ellipse(x, y, r * 1.8, r * 0.6, 0, 0, TAU); c.fill(); }
    mountains(c, w, FLOOR_Y + 10, 120, '#23252f', R, 70);
    for (let x = 40; x < w; x += 140 + R() * 160) column(c, x, FLOOR_Y - 10, 90 + R() * 70, 14, ['#34363f', '#3c3e48', '#2a2c34'], R, R() < 0.6);
  },
  mid(c, w, R) {
    for (let x = 0; x < w; x += 200 + R() * 160) {
      if (R() < 0.5) { const h = 150 + R() * 60, ww = 90; column(c, x, FLOOR_Y + 6, h, 18, ['#4c4e58', '#565862', '#3a3c46'], R, false); column(c, x + ww, FLOOR_Y + 6, h, 18, ['#4c4e58', '#565862', '#3a3c46'], R, false); c.fillStyle = '#4a4c56'; c.fillRect(x - 16, FLOOR_Y + 6 - h - 16, ww + 32, 16); }
      else column(c, x, FLOOR_Y + 6, 110 + R() * 80, 20, ['#4c4e58', '#565862', '#3a3c46'], R, true);
    }
    hazeBand(c, w, FLOOR_Y - 80, FLOOR_Y + 10, '#5a6070');
  },
  wall(c, w, R, room) {
    brickWall(c, 0, w, FLOOR_Y - 46, FLOOR_Y, ['#4a4a54', '#34343c'], R);
    for (let x = 0; x < w; x += 30 + R() * 50) { c.fillStyle = '#1a1a20'; const bw = 10 + R() * 30; c.beginPath(); c.moveTo(x, FLOOR_Y - 46); c.lineTo(x + bw * 0.2, FLOOR_Y - 46 + R() * 16); c.lineTo(x + bw * 0.6, FLOOR_Y - 46 + R() * 10); c.lineTo(x + bw, FLOOR_Y - 46); c.fill(); }
    for (let x = 30; x < w; x += 60 + R() * 100) { c.fillStyle = ['#3a5a30', '#2e4a26'][Math.floor(R() * 2)]; for (let j = 0; j < 4; j++) c.fillRect(x + j * 3, FLOOR_Y - 46 + R() * 20, 2, 14 + R() * 18); }
    for (let x = 160; x < w; x += 380 + R() * 200) addTorch(c, room, x, FLOOR_Y - 34, '#9ad0ff');
  },
  floor(c, w, R) {
    flagstones(c, w, FLOOR_Y - 4, RUIN_STONE, R);
    for (let i = 0; i < w / 12; i++) { const x = R() * w, y = FLOOR_Y + R() * 200; c.fillStyle = ['#4a6a3a', '#3a5a2e'][Math.floor(R() * 2)]; c.fillRect(x, y, 1, 3); c.fillRect(x + 2, y + 1, 1, 2); }
    for (let i = 0; i < w / 160; i++) { const x = R() * w, y = FLOOR_Y + 20 + R() * 170; c.fillStyle = 'rgba(80,100,130,.35)'; c.beginPath(); c.ellipse(x, y, 20 + R() * 26, 4 + R() * 3, 0, 0, TAU); c.fill(); }
  },
  fore(c, w, R) { for (let x = 100; x < w; x += 420 + R() * 300) column(c, x, WH + 30, 150, 34, ['#1a1a22', '#222230', '#121218'], R, true); },
  back: (c, room) => drawLights(c, room),
  ambient(c, room) {
    c.strokeStyle = 'rgba(170,190,230,.35)'; c.lineWidth = 1; c.beginPath();
    ambientParticles(c, 70, (i, a, b) => { const x = ((a * 1100 + game.t * 120 - cam.x * 1.1) % 1100 + 1100) % 1100 - 70, y = ((b * 600 + game.t * 620) % 600) - 40; c.moveTo(x, y); c.lineTo(x - 5, y + 16); });
    c.stroke();
    const ph = game.t % 7.7; if (ph < 0.22) { c.fillStyle = `rgba(210,220,255,${(ph < 0.06 || (ph > 0.12 && ph < 0.17)) ? 0.22 : 0.06})`; c.fillRect(0, 0, WW, WH); const n = Math.floor(game.t / 7.7); if (room.bolt !== n) { room.bolt = n; sfx.boom(0.15); } }
  },
};

/* ---- 毒雾遗迹：紫绿色调、毒水洼、升起的毒泡 ---- */
THEMES.ruinsPoison = {
  sky: '#120e18',
  far(c, w, R) {
    skyGrad(c, w, [[0, '#0e0a14'], [0.55, '#241a30'], [1, '#2e3a2a']]);
    mountains(c, w, FLOOR_Y + 10, 110, '#1c1824', R, 60);
    for (let x = 40; x < w; x += 120 + R() * 150) column(c, x, FLOOR_Y - 6, 80 + R() * 60, 13, ['#2a2632', '#322e3a', '#221e28'], R, R() < 0.7);
  },
  mid(c, w, R) {
    for (let x = 0; x < w; x += 170 + R() * 150) column(c, x, FLOOR_Y + 6, 100 + R() * 90, 20, ['#48404e', '#524a58', '#383040'], R, R() < 0.6);
    for (let x = 0; x < w; x += 90 + R() * 80) deadTree(c, x, FLOOR_Y + 6, 90 + R() * 50, '#221a26', R, 0.8);
    hazeBand(c, w, FLOOR_Y - 120, FLOOR_Y + 10, '#6aa050');
  },
  wall(c, w, R, room) {
    brickWall(c, 0, w, FLOOR_Y - 40, FLOOR_Y, ['#3e3844', '#2a2430'], R);
    for (let x = 0; x < w; x += 20 + R() * 30) { c.fillStyle = 'rgba(120,200,80,.35)'; c.fillRect(x, FLOOR_Y - 40 + R() * 30, 2, 6 + R() * 14); }
    for (let x = 200; x < w; x += 420 + R() * 200) addTorch(c, room, x, FLOOR_Y - 30, '#8aff6a');
  },
  floor(c, w, R, room) {
    flagstones(c, w, FLOOR_Y - 4, ['#4e4856', '#57505e', '#443e4a'], R);
    room.pools = [];
    for (let i = 0; i < w / 260; i++) {
      const x = 80 + R() * (w - 160), y = FLOOR_Y + 30 + R() * 150, rx = 30 + R() * 30, ry = 7 + R() * 5;
      c.fillStyle = '#2a4a1a'; c.beginPath(); c.ellipse(x, y, rx + 4, ry + 2, 0, 0, TAU); c.fill();
      const g = c.createRadialGradient(x, y, 2, x, y, rx); g.addColorStop(0, '#8aff4a'); g.addColorStop(0.6, '#4ab02a'); g.addColorStop(1, '#2a6a1a'); c.fillStyle = g; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, TAU); c.fill();
      room.pools.push({ x, y, rx });
    }
  },
  fore(c, w, R) { for (let x = 60; x < w; x += 380 + R() * 260) { c.fillStyle = '#0e0a12'; deadTree(c, x, WH + 20, 160, '#0e0a12', R, 1.6); } },
  back(c, room) { drawLights(c, room); },
  ambient(c, room) {
    c.save(); c.globalCompositeOperation = 'lighter';
    if (room.pools) room.pools.forEach((P, j) => { for (let i = 0; i < 4; i++) { const ph = (game.t * 0.6 + i * 0.25 + j * 0.13) % 1, X = P.x - (cam.x - room.x0) + Math.sin(i * 3 + j) * P.rx * 0.6, Y = P.y - ph * 40; if (X < -20 || X > WW + 20) continue; c.strokeStyle = `rgba(160,255,100,${0.6 * (1 - ph)})`; c.lineWidth = 1; c.beginPath(); c.arc(X, Y, 2 + ph * 2, 0, TAU); c.stroke(); } });
    const g = c.createLinearGradient(0, FLOOR_Y + 40, 0, WH); g.addColorStop(0, 'rgba(90,160,60,0)'); g.addColorStop(1, `rgba(90,160,60,${0.1 + 0.03 * Math.sin(game.t)})`); c.fillStyle = g; c.fillRect(0, FLOOR_Y + 40, WW, WH);
    c.restore();
  },
};

/* ---- 牛头营地：黄昏、木栅栏、兽皮帐篷、图腾、篝火 ---- */
THEMES.camp = {
  sky: '#2a1a14',
  far(c, w, R) {
    skyGrad(c, w, [[0, '#2a1a2a'], [0.45, '#7a3a2a'], [0.8, '#c8703a'], [1, '#e8a050']]);
    c.fillStyle = 'rgba(255,220,150,.9)'; c.beginPath(); c.arc(w * 0.62, FLOOR_Y - 70, 28, 0, TAU); c.fill();
    mountains(c, w, FLOOR_Y + 10, 140, '#4a2a24', R, 80); mountains(c, w, FLOOR_Y + 10, 80, '#3a2220', R, 50);
  },
  mid(c, w, R) {
    for (let x = 0; x < w; x += 150 + R() * 120) tent(c, x, FLOOR_Y + 6, 90 + R() * 40, 70 + R() * 30, ['#6a4a34', '#8a6444', '#e8dcc0'], R);
    palisade(c, 0, w, FLOOR_Y + 8, 46, '#4a3020', R);
    hazeBand(c, w, FLOOR_Y - 60, FLOOR_Y + 10, '#c8784a');
  },
  wall(c, w, R, room) {
    for (let x = -10; x < w; x += 16) { c.fillStyle = shade('#5a3a24', (R() - 0.5) * 0.2); c.beginPath(); c.moveTo(x, FLOOR_Y); c.lineTo(x + 3, FLOOR_Y - 34 - R() * 8); c.lineTo(x + 8, FLOOR_Y - 38 - R() * 10); c.lineTo(x + 13, FLOOR_Y - 34); c.lineTo(x + 14, FLOOR_Y); c.fill(); }
    c.fillStyle = '#3a2416'; c.fillRect(0, FLOOR_Y - 20, w, 4);
    for (let x = 120; x < w; x += 260 + R() * 200) totem(c, x, FLOOR_Y + 2, 58 + R() * 20, R);
    for (let x = 250; x < w; x += 360 + R() * 200) addTorch(c, room, x, FLOOR_Y - 30);
  },
  floor(c, w, R) {
    dirtFloor(c, w, ['#6a4a30', '#5a3e28', '#4a3220'], R, ['#7a5a3a', '#3a2818', '#8a6a4a']);
    for (let i = 0; i < w / 60; i++) { const x = R() * w, y = FLOOR_Y + 10 + R() * 180; c.fillStyle = 'rgba(40,24,14,.4)'; c.beginPath(); c.ellipse(x, y, 5, 2, 0, 0, TAU); c.fill(); c.beginPath(); c.ellipse(x + 10, y + 3, 5, 2, 0, 0, TAU); c.fill(); }
    for (let i = 0; i < w / 150; i++) bones(c, R() * w, FLOOR_Y + 20 + R() * 170, R);
    for (let i = 0; i < w / 400; i++) { const x = R() * w, y = FLOOR_Y + 30 + R() * 140; c.fillStyle = '#4a3020'; c.save(); c.translate(x, y); c.rotate((R() - 0.5) * 0.4); c.fillRect(-26, -4, 52, 8); c.fillStyle = '#6a4a30'; c.beginPath(); c.ellipse(26, 0, 3, 4, 0, 0, TAU); c.fill(); c.restore(); }
  },
  fore(c, w, R) { for (let x = 80; x < w; x += 360 + R() * 260) { palisade(c, x, x + 60, WH + 10, 70, '#1a100a', R); } },
  back: (c, room) => drawLights(c, room),
  ambient: (c) => embers(c, 18, 'rgba(255,170,80,'),
};
function embers(c, n, rgb) {
  c.save(); c.globalCompositeOperation = 'lighter';
  ambientParticles(c, n, (i, a, b, s) => { const ph = (game.t * (0.12 + s * 0.1) + b) % 1, x = ((a * 1300 - cam.x * 0.8 + Math.sin(game.t * 2 + i) * 14) % 1100 + 1100) % 1100 - 70, y = WH - ph * (WH + 40); c.fillStyle = rgb + (0.8 * (1 - ph)) + ')'; c.fillRect(x, y, 2, 2); });
  c.restore();
}

/* ---- 烈焰营地：燃烧的天空、倒塌燃烧的帐篷、焦土裂缝 ---- */
THEMES.campFire = {
  sky: '#2a0a06',
  far(c, w, R) {
    skyGrad(c, w, [[0, '#1a0606'], [0.5, '#5a140a'], [0.85, '#b83a14'], [1, '#e8701e']]);
    for (let i = 0; i < w / 50; i++) { const x = R() * w, y = 40 + R() * 150, r = 30 + R() * 60; c.fillStyle = `rgba(${30 + R() * 30},${10 + R() * 10},10,.55)`; c.beginPath(); c.ellipse(x, y, r * 1.6, r * 0.7, 0, 0, TAU); c.fill(); }
    mountains(c, w, FLOOR_Y + 10, 130, '#2a0e0a', R, 70);
  },
  mid(c, w, R, room) {
    for (let x = 0; x < w; x += 180 + R() * 140) { tent(c, x, FLOOR_Y + 6, 90 + R() * 40, 50 + R() * 30, ['#2a1a14', '#3a2418', '#1a100a'], R); }
    palisade(c, 0, w, FLOOR_Y + 8, 40, '#2a1610', R);
    hazeBand(c, w, FLOOR_Y - 100, FLOOR_Y + 10, '#ff6a2a');
  },
  wall(c, w, R, room) {
    for (let x = -10; x < w; x += 16) { c.fillStyle = shade('#3a2014', (R() - 0.5) * 0.2); c.beginPath(); c.moveTo(x, FLOOR_Y); c.lineTo(x + 3, FLOOR_Y - 26 - R() * 12); c.lineTo(x + 8, FLOOR_Y - 32 - R() * 14); c.lineTo(x + 13, FLOOR_Y - 24); c.lineTo(x + 14, FLOOR_Y); c.fill(); }
    for (let x = 60; x < w; x += 120 + R() * 140) addTorch(c, room, x, FLOOR_Y - 24 - R() * 10, '#ff7a2a');
  },
  floor(c, w, R) {
    dirtFloor(c, w, ['#3a2218', '#2e1a12', '#22120c'], R, ['#4a2a1a', '#1a0e08', '#5a3a2a']);
    for (let i = 0; i < w / 70; i++) { const x = R() * w, y = FLOOR_Y + 10 + R() * 180; c.strokeStyle = 'rgba(255,110,30,.55)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(x, y); let xx = x, yy = y; for (let j = 0; j < 4; j++) { xx += (R() - 0.3) * 18; yy += (R() - 0.5) * 6; c.lineTo(xx, yy); } c.stroke(); }
    for (let i = 0; i < w / 120; i++) bones(c, R() * w, FLOOR_Y + 20 + R() * 170, R);
  },
  fore(c, w, R) { for (let x = 80; x < w; x += 360 + R() * 260) palisade(c, x, x + 50, WH + 10, 60, '#0e0604', R); },
  back: (c, room) => drawLights(c, room),
  ambient(c) {
    embers(c, 44, 'rgba(255,140,50,');
    c.save(); c.globalCompositeOperation = 'lighter'; const g = c.createLinearGradient(0, WH - 120, 0, WH); g.addColorStop(0, 'rgba(255,80,20,0)'); g.addColorStop(1, `rgba(255,80,20,${0.12 + 0.04 * Math.sin(game.t * 3)})`); c.fillStyle = g; c.fillRect(0, WH - 120, WW, 120); c.restore();
  },
};

/* ---- 亡者遗迹：灰蓝、墓碑、地穴拱门、蓝色鬼火 ---- */
THEMES.ruinsDark = {
  sky: '#06070c',
  far(c, w, R) {
    skyGrad(c, w, [[0, '#040508'], [0.6, '#10141e'], [1, '#1c2230']]);
    for (let i = 0; i < w / 14; i++) { c.fillStyle = `rgba(200,210,255,${0.3 + R() * 0.5})`; c.fillRect(R() * w, R() * 180, 1, 1); }
    mountains(c, w, FLOOR_Y + 10, 100, '#12161e', R, 60);
    for (let x = 40; x < w; x += 130 + R() * 140) deadTree(c, x, FLOOR_Y + 6, 110 + R() * 60, '#0e1016', R, 1);
  },
  mid(c, w, R) {
    for (let x = 0; x < w; x += 260 + R() * 200) {
      const ww = 110, h = 130; c.fillStyle = '#262a36'; c.fillRect(x - 12, FLOOR_Y + 6 - h, ww + 24, h);
      c.fillStyle = '#0a0c12'; c.beginPath(); c.moveTo(x + 14, FLOOR_Y + 6); c.lineTo(x + 14, FLOOR_Y + 6 - h * 0.55); c.arc(x + ww / 2, FLOOR_Y + 6 - h * 0.55, ww / 2 - 14, Math.PI, 0); c.lineTo(x + ww - 14, FLOOR_Y + 6); c.fill();
      c.fillStyle = '#1c202a'; c.fillRect(x - 18, FLOOR_Y + 6 - h - 10, ww + 36, 12);
    }
    for (let x = 0; x < w; x += 40 + R() * 50) tombstone(c, x, FLOOR_Y + 8, 1 + R() * 0.5, ['#3a3e4a', '#4a4e5a'], R);
    hazeBand(c, w, FLOOR_Y - 90, FLOOR_Y + 10, '#5a6a8a');
  },
  wall(c, w, R, room) {
    brickWall(c, 0, w, FLOOR_Y - 42, FLOOR_Y, ['#2a2e3a', '#1c202a'], R);
    for (let x = 30; x < w; x += 50 + R() * 70) tombstone(c, x, FLOOR_Y + 2, 1.2 + R() * 0.4, ['#44485a', '#565a6a'], R);
    for (let x = 180; x < w; x += 340 + R() * 200) addTorch(c, room, x, FLOOR_Y - 32, '#5ab0ff');
  },
  floor(c, w, R) {
    flagstones(c, w, FLOOR_Y - 4, ['#2e323c', '#363a46', '#262a32'], R, 'rgba(0,0,0,.6)');
    for (let i = 0; i < w / 90; i++) bones(c, R() * w, FLOOR_Y + 14 + R() * 180, R);
    for (let i = 0; i < w / 200; i++) { const x = R() * w, y = FLOOR_Y + 30 + R() * 150; c.fillStyle = 'rgba(60,10,20,.5)'; c.beginPath(); c.ellipse(x, y, 16 + R() * 20, 4 + R() * 3, 0, 0, TAU); c.fill(); }
  },
  fore(c, w, R) { for (let x = 60; x < w; x += 300 + R() * 240) tombstone(c, x, WH + 16, 3 + R(), ['#08090e', '#0e1016'], R); },
  back: (c, room) => drawLights(c, room),
  ambient(c) {
    c.save(); c.globalCompositeOperation = 'lighter';
    ambientParticles(c, 12, (i, a, b, s) => { const x = ((a * 1300 + Math.sin(game.t * 0.5 + i) * 80 - cam.x * 0.9) % 1100 + 1100) % 1100 - 70, y = FLOOR_Y - 20 + b * 180 + Math.sin(game.t * 1.3 + i) * 14, f = 0.7 + 0.3 * Math.sin(game.t * 9 + i);
      const g = c.createRadialGradient(x, y, 1, x, y, 12); g.addColorStop(0, `rgba(150,210,255,${0.7 * f})`); g.addColorStop(1, 'rgba(60,120,255,0)'); c.fillStyle = g; c.beginPath(); c.arc(x, y, 12, 0, TAU); c.fill();
      c.fillStyle = `rgba(200,235,255,${0.8 * f})`; c.beginPath(); c.moveTo(x - 3, y); c.quadraticCurveTo(x, y - 12 * f, x + 1, y - 14 * f); c.quadraticCurveTo(x + 3, y - 5, x + 3, y); c.fill(); });
    const g = c.createLinearGradient(0, FLOOR_Y + 60, 0, WH); g.addColorStop(0, 'rgba(120,140,200,0)'); g.addColorStop(1, 'rgba(120,140,200,.12)'); c.fillStyle = g; c.fillRect(0, FLOOR_Y + 60, WW, WH);
    c.restore();
  },
};
