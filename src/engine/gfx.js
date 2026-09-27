/* =====================================================================
   01. 画布与绘图工具
   - 世界层：960×540 的像素画布，CSS 最近邻放大（复古像素质感，接近原作 800×600 放大后的颗粒感）
   - UI 层：按设备像素比的高清画布，逻辑坐标 1920×1080
   ===================================================================== */
const WW = 960, WH = 540;                 // 世界层逻辑分辨率
const RS = 2;                             // 世界层实际按 2 倍像素渲染（手绘美术需要高清）
const UW = 1920, UH = 1080;               // UI 逻辑分辨率
const FLOOR_Y = 318;                      // 地面纵深 y=0 对应的屏幕 y
const DEPTH = 196;                        // 可行走纵深范围（y ∈ [0, DEPTH]）
const stage = document.getElementById('stage');
const wcan = document.getElementById('world'), wctx = wcan.getContext('2d');
const ucan = document.getElementById('ui'), uctx = ucan.getContext('2d');
const dom = document.getElementById('dom');
let uiScale = 1, stageW = 1920, stageH = 1080;
function resize() {
  const ar = 16 / 9, w = innerWidth, h = innerHeight;
  stageW = Math.floor(Math.min(w, h * ar)); stageH = Math.floor(stageW / ar);
  stage.style.width = stageW + 'px'; stage.style.height = stageH + 'px';
  const dpr = Math.min(devicePixelRatio || 1, 2);
  ucan.width = Math.round(stageW * dpr); ucan.height = Math.round(stageH * dpr);
  uiScale = ucan.width / UW;
  document.documentElement.style.setProperty('--u', (stageW / UW).toFixed(4));
}
addEventListener('resize', resize); resize();
wcan.width = WW * RS; wcan.height = WH * RS;

const cam = { x: 0, shake: 0, shx: 0, shy: 0, zoom: 1, flash: 0, flashCol: '#fff' };
// 世界坐标 → 世界画布坐标
const sx = x => Math.round((x - cam.x + cam.shx) * RS) / RS;
const sy = (y, z = 0) => Math.round((FLOOR_Y + y - z + cam.shy) * RS) / RS;

/* ---- 颜色 ---- */
function hexRgb(h) { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
function rgb(r, g, b, a = 1) { return a >= 1 ? `rgb(${r | 0},${g | 0},${b | 0})` : `rgba(${r | 0},${g | 0},${b | 0},${a})`; }
function shade(h, f, a = 1) { const [r, g, b] = hexRgb(h); return f >= 0 ? rgb(r + (255 - r) * f, g + (255 - g) * f, b + (255 - b) * f, a) : rgb(r * (1 + f), g * (1 + f), b * (1 + f), a); }
function mixHex(a, b, t) { const A = hexRgb(a), B = hexRgb(b); return rgb(lerp(A[0], B[0], t), lerp(A[1], B[1], t), lerp(A[2], B[2], t)); }
const OUTLINE = '#120b16';

/* ---- 路径工具 ---- */
// 锥形胶囊：从 (0,0) 半径 r0 到 (0,len) 半径 r1（骨骼局部坐标，骨骼沿 +y）
function capsulePath(c, len, r0, r1) {
  c.beginPath();
  c.arc(0, 0, r0, Math.PI, 0, false);
  c.lineTo(r1, len);
  c.arc(0, len, r1, 0, Math.PI, false);
  c.closePath();
}
function polyPath(c, pts) { c.beginPath(); c.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]); c.closePath(); }
function smoothPolyPath(c, pts) {   // 经过中点的二次曲线平滑多边形
  const n = pts.length / 2;
  c.beginPath();
  const mx = (i) => (pts[(i % n) * 2] + pts[((i + 1) % n) * 2]) / 2, my = (i) => (pts[(i % n) * 2 + 1] + pts[((i + 1) % n) * 2 + 1]) / 2;
  c.moveTo(mx(n - 1), my(n - 1));
  for (let i = 0; i < n; i++) c.quadraticCurveTo(pts[i * 2], pts[i * 2 + 1], mx(i), my(i));
  c.closePath();
}
function fillStroke(c, fill, lw = 1.4, stroke = OUTLINE) { c.fillStyle = fill; c.fill(); if (lw > 0) { c.lineWidth = lw; c.strokeStyle = stroke; c.lineJoin = 'round'; c.stroke(); } }

/* ---- 文字（UI 层） ---- */
function uiText(txt, x, y, { size = 28, color = '#fff', align = 'left', base = 'alphabetic', weight = 700, stroke = 'rgba(0,0,0,.85)', sw = 5, font } = {}) {
  const c = uctx;
  c.font = `${weight} ${size}px ${font || '"PingFang SC","Microsoft YaHei",sans-serif'}`;
  c.textAlign = align; c.textBaseline = base;
  if (sw > 0) { c.lineJoin = 'round'; c.lineWidth = sw; c.strokeStyle = stroke; c.strokeText(txt, x, y); }
  c.fillStyle = color; c.fillText(txt, x, y);
}
