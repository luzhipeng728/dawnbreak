/* =====================================================================
   15. 房间场景：分层背景（远景 / 中景 / 后墙 / 地面 / 前景），按主题程序生成并预渲染成离屏画布
   视差：远景 0.2、中景 0.5、后墙与地面 1.0、前景 1.2
   ===================================================================== */
const THEMES = {};
function offCanvas(w, h) { const c = document.createElement('canvas'); c.width = Math.ceil(w); c.height = Math.ceil(h); const x = c.getContext('2d'); return [c, x]; }
let lastArt = null;
function buildRoomArt(room) {
  // 释放上一个房间的离屏画布（手机上画布内存很紧张）
  if (lastArt && lastArt !== room && lastArt.layers) for (const k in lastArt.layers) lastArt.layers[k].cv.width = lastArt.layers[k].cv.height = 0;
  lastArt = room;
  if (hasArt(`bg/${room.theme}_far`)) { room.art = true; room.layers = null; return; }   // 有手绘背景：不再生成程序化图层
  const T = THEMES[room.theme] || THEMES.forest, R = mulberry(room.seed || 1), W = room.x1 - room.x0;
  const layers = {};
  for (const [name, par] of [['far', 0.2], ['mid', 0.5], ['wall', 1], ['floor', 1], ['fore', 1.2]]) {
    const lw = (W - WW) * par + WW + 40;
    const [cv, c] = offCanvas(lw, WH);
    if (T[name]) T[name](c, lw, R, room);
    layers[name] = { cv, par };
  }
  room.layers = layers;
}
/* ---- 手绘背景：远景（视差 0.2）+ 地面（视差 1）+ 交界带（视差 1，盖住两层的接缝）；超出图宽时镜像拼接 ---- */
const BG_GRADE = {   // 各场景的整体色调（叠加在画面最上层，让角色和背景的光线统一）+ 远景地平线位置微调
  forest: { tint: 'rgba(40,90,120,0.10)', fog: 'rgba(120,190,200,0.10)' }, forestDark: { tint: 'rgba(60,40,120,0.16)', fog: 'rgba(120,100,200,0.12)' },
  ruins: { tint: 'rgba(60,80,120,0.14)', fog: 'rgba(150,170,200,0.10)' }, ruinsPoison: { tint: 'rgba(80,60,110,0.12)', fog: 'rgba(120,220,90,0.10)' },
  camp: { tint: 'rgba(160,90,40,0.10)', fog: 'rgba(255,170,90,0.10)' }, campFire: { tint: 'rgba(170,50,20,0.12)', fog: 'rgba(255,110,40,0.12)' },
  ruinsDark: { tint: 'rgba(30,50,110,0.18)', fog: 'rgba(110,140,220,0.12)' }, town: { tint: 'rgba(255,220,160,0.05)', fog: 'rgba(255,240,210,0.08)' },
};
const FAR_W = 1100, FLOOR_TOP = FLOOR_Y - 8;
function drawMirrored(c, img, x0, y, w, h, flipFirst) {
  // 从 x0 开始向右铺满屏幕：原图、镜像、原图……（镜像拼接没有接缝）
  let i = Math.floor(-x0 / w), x = x0 + i * w;
  for (; x < WW + 1; x += w, i++) {
    if (x + w < -1) continue;
    if ((i & 1) ^ (flipFirst ? 1 : 0)) { c.save(); c.translate(x + w, y); c.scale(-1, 1); c.drawImage(img, 0, 0, w, h); c.restore(); }
    else c.drawImage(img, x, y, w, h);
  }
}
function drawArtBack(c, room) {
  const t = room.theme, far = IMG[`bg/${t}_far`], floor = IMG[`bg/${t}_floor`], edge = IMG[`bg/${t}_edge`];
  const ox = cam.x - room.x0, shx = cam.shx, shy = cam.shy;
  c.fillStyle = '#000'; c.fillRect(0, 0, WW, WH);
  if (far) { const h = far.height * FAR_W / far.width, anchor = h * (BG_GRADE[t] && BG_GRADE[t].anchor || 0.93); drawMirrored(c, far, -ox * 0.2 + shx * 0.5, FLOOR_TOP + 14 - anchor + shy * 0.5, FAR_W, h); }
  if (floor) { const G = BG_GRADE[t] || {}, w = (G.floorW || floor.width / RS), h = WH - FLOOR_TOP + 6; drawMirrored(c, floor, -ox + shx, FLOOR_TOP + shy, w, h); }
  // 地面远端压暗 + 薄雾，拉出纵深
  const g = c.createLinearGradient(0, FLOOR_TOP, 0, FLOOR_TOP + 90); g.addColorStop(0, 'rgba(0,0,0,0.45)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, FLOOR_TOP, WW, 90);
  if (edge) { const w = edge.width / RS, h = edge.height / RS; drawMirrored(c, edge, -ox + shx, FLOOR_TOP + 16 - h + shy, w, h); }
}
// 画面最上层：色调 + 暗角（暗角预渲染一次）
let vignette = null;
function drawGrade(c, room) {
  const G = BG_GRADE[room.theme]; if (!G) return;
  // 色调：原来用全屏 soft-light 混合（高级混合模式需要读回整屏像素，GPU 很贵），改成普通半透明叠加
  c.save(); c.globalAlpha = 0.6; c.fillStyle = G.tint; c.fillRect(0, 0, WW, WH); c.restore();
  if (!vignette) { const [cv, x] = offCanvas(480, 270); const g = x.createRadialGradient(240, 150, 90, 240, 135, 300); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.55)'); x.fillStyle = g; x.fillRect(0, 0, 480, 270); vignette = cv; }
  c.drawImage(vignette, 0, 0, WW, WH);
}
function drawRoomBack(c, room) {
  if (room.art) { drawArtBack(c, room); const T = THEMES[room.theme]; if (T && T.back && room.theme !== 'town') T.back(c, room); return; }
  c.fillStyle = (THEMES[room.theme] || THEMES.forest).sky || '#101418'; c.fillRect(0, 0, WW, WH);
  for (const n of ['far', 'mid', 'wall', 'floor']) { const L = room.layers[n]; c.drawImage(L.cv, Math.round(-(cam.x - room.x0) * L.par + cam.shx), Math.round(cam.shy)); }
  const T = THEMES[room.theme]; if (T && T.back) T.back(c, room);
}
function drawRoomFore(c, room) { const T = THEMES[room.theme]; if (T && T.ambient) T.ambient(c, room); if (room.art) { drawGrade(c, room); return; } const L = room.layers.fore; c.drawImage(L.cv, Math.round(-(cam.x - room.x0) * L.par + cam.shx), Math.round(cam.shy)); }

/* ---- 主题：暮色林地 ---- */
function tree(c, x, base, h, trunk, leaf, R, detail = 1) {
  const tw = h * 0.07;
  c.fillStyle = trunk; c.beginPath(); c.moveTo(x - tw, base); c.lineTo(x - tw * 0.6, base - h * 0.55); c.lineTo(x + tw * 0.6, base - h * 0.55); c.lineTo(x + tw, base); c.closePath(); c.fill();
  // 树根
  c.beginPath(); c.moveTo(x - tw * 2.2, base); c.quadraticCurveTo(x - tw, base - tw * 1.5, x - tw * 0.6, base - tw * 3); c.lineTo(x + tw * 0.6, base - tw * 3); c.quadraticCurveTo(x + tw, base - tw * 1.5, x + tw * 2.4, base); c.fill();
  for (let i = 0; i < 5 + detail * 3; i++) {
    const a = R() * TAU, r = h * (0.16 + R() * 0.12), cx = x + Math.cos(a) * h * 0.18, cy = base - h * (0.62 + R() * 0.28) + Math.sin(a) * h * 0.08;
    c.fillStyle = leaf[Math.floor(R() * leaf.length)]; c.beginPath(); c.arc(cx, cy, r, 0, TAU); c.fill();
  }
}
THEMES.forest = {
  sky: '#0c1a1c',
  far(c, w, R) {
    const g = c.createLinearGradient(0, 0, 0, FLOOR_Y); g.addColorStop(0, '#0a1a22'); g.addColorStop(0.6, '#15332e'); g.addColorStop(1, '#244a38');
    c.fillStyle = g; c.fillRect(0, 0, w, FLOOR_Y + 10);
    // 月光光柱
    c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < w / 260; i++) { const x = R() * w; const gg = c.createLinearGradient(x, 0, x + 80, FLOOR_Y); gg.addColorStop(0, 'rgba(160,220,200,0.10)'); gg.addColorStop(1, 'rgba(160,220,200,0)'); c.fillStyle = gg; c.beginPath(); c.moveTo(x, 0); c.lineTo(x + 40, 0); c.lineTo(x + 160, FLOOR_Y); c.lineTo(x + 60, FLOOR_Y); c.closePath(); c.fill(); }
    c.globalCompositeOperation = 'source-over';
    for (let x = -40; x < w + 40; x += 38 + R() * 30) tree(c, x, FLOOR_Y + 4, 240 + R() * 90, '#12282a', ['#15302c', '#183630', '#12282a'], R, 0);
  },
  mid(c, w, R) {
    for (let x = -60; x < w + 60; x += 90 + R() * 80) tree(c, x, FLOOR_Y + 10, 200 + R() * 70, '#1e2a22', ['#1f4a32', '#265a3a', '#1a3e2a', '#2e6640'], R, 1);
    // 地平线雾
    const g = c.createLinearGradient(0, FLOOR_Y - 90, 0, FLOOR_Y + 10); g.addColorStop(0, 'rgba(90,150,120,0)'); g.addColorStop(1, 'rgba(90,150,120,0.35)'); c.fillStyle = g; c.fillRect(0, FLOOR_Y - 90, w, 100);
  },
  wall(c, w, R) {
    // 可行走区域的后缘：灌木、树根、蕨类
    for (let x = -20; x < w + 20; x += 14 + R() * 18) {
      const h = 18 + R() * 26, col = ['#2c5a34', '#356a3c', '#244a2c'][Math.floor(R() * 3)];
      c.fillStyle = col; c.beginPath(); c.ellipse(x, FLOOR_Y - 2, 14 + R() * 12, h * 0.6, 0, Math.PI, 0); c.fill();
      c.fillStyle = shade(col, 0.2); c.beginPath(); c.ellipse(x - 3, FLOOR_Y - h * 0.35, 6, 4, 0, 0, TAU); c.fill();
    }
    for (let x = 0; x < w; x += 60 + R() * 120) {   // 大石头
      const r = 10 + R() * 12; c.fillStyle = '#4a5048'; c.beginPath(); c.ellipse(x, FLOOR_Y - 2, r * 1.4, r, 0, Math.PI, 0); c.fill(); c.fillStyle = '#6a7066'; c.beginPath(); c.ellipse(x - r * 0.3, FLOOR_Y - r * 0.7, r * 0.6, r * 0.3, 0, 0, TAU); c.fill();
    }
  },
  floor(c, w, R) {
    const top = FLOOR_Y - 4, h = WH - top;
    const g = c.createLinearGradient(0, top, 0, WH); g.addColorStop(0, '#3a4a2c'); g.addColorStop(0.35, '#4a5634'); g.addColorStop(1, '#3a4028'); c.fillStyle = g; c.fillRect(0, top, w, h);
    // 泥土小径（中间一条弯曲带）
    c.fillStyle = 'rgba(120,96,64,0.55)';
    c.beginPath(); c.moveTo(0, top + h * 0.35);
    for (let x = 0; x <= w; x += 40) c.lineTo(x, top + h * 0.33 + Math.sin(x * 0.006) * 14);
    for (let x = w; x >= 0; x -= 40) c.lineTo(x, top + h * 0.66 + Math.sin(x * 0.006 + 1) * 12);
    c.closePath(); c.fill();
    // 草丛、石子、落叶（像素点）
    for (let i = 0; i < w * 0.9; i++) {
      const x = R() * w, y = top + 6 + R() * (h - 10), k = R();
      if (k < 0.45) { c.fillStyle = ['#5a7a3a', '#6a8a44', '#4a6a30'][Math.floor(R() * 3)]; c.fillRect(Math.round(x), Math.round(y), 1, 2 + Math.floor(R() * 2)); c.fillRect(Math.round(x) + 1, Math.round(y) + 1, 1, 2); }
      else if (k < 0.55) { c.fillStyle = 'rgba(40,36,26,0.6)'; c.fillRect(Math.round(x), Math.round(y), 2, 1); }
      else if (k < 0.6) { c.fillStyle = '#7a7a6a'; c.fillRect(Math.round(x), Math.round(y), 2, 2); c.fillStyle = '#9a9a88'; c.fillRect(Math.round(x), Math.round(y), 1, 1); }
      else if (k < 0.63) { c.fillStyle = ['#8a5a2a', '#a06a2a', '#6a4a2a'][Math.floor(R() * 3)]; c.fillRect(Math.round(x), Math.round(y), 2, 1); }
    }
    // 草丛团
    for (let x = 0; x < w; x += 50 + R() * 90) { const y = top + 20 + R() * (h - 60); for (let j = 0; j < 7; j++) { c.strokeStyle = ['#5a8a3a', '#6a9a44', '#4a7a30'][j % 3]; c.lineWidth = 1; c.beginPath(); c.moveTo(x + j * 2, y); c.lineTo(x + j * 2 + (R() - 0.5) * 6, y - 5 - R() * 6); c.stroke(); } }
  },
  fore(c, w, R) {
    for (let x = -40; x < w + 40; x += 160 + R() * 220) {
      const col = '#0c1810';
      c.fillStyle = col;
      for (let j = 0; j < 5; j++) { c.beginPath(); c.ellipse(x + j * 18 - 36, WH + 6, 22 + R() * 14, 26 + R() * 30, 0, Math.PI, 0); c.fill(); }
    }
  },
};
