/* =====================================================================
   03. 人形模型：可配置比例 + 部件画法（剑士 / 哥布林 / 盗贼 / 骷髅等共用）
   角色局部空间：脚底中心为原点，面朝 +x，y 向下为正（头在负 y）
   ===================================================================== */
function humanoidSkeleton(s) {
  return new Skeleton([
    { name: 'root', y: -s.hipY },
    { name: 'torso', parent: 'root', base: 180, len: s.torso },
    { name: 'head', parent: 'torso', y: s.torso + s.neck },
    { name: 'uaB', parent: 'torso', x: -s.shX, y: s.torso - s.shDrop, base: 180, len: s.ua },
    { name: 'faB', parent: 'uaB', y: s.ua, len: s.fa },
    { name: 'hB', parent: 'faB', y: s.fa },
    { name: 'uaF', parent: 'torso', x: s.shX, y: s.torso - s.shDrop, base: 180, len: s.ua },
    { name: 'faF', parent: 'uaF', y: s.ua, len: s.fa },
    { name: 'hF', parent: 'faF', y: s.fa },
    { name: 'wF', parent: 'hF', y: 1, base: 90 },
    { name: 'wB', parent: 'hB', y: 1, base: 90 },
    { name: 'thB', parent: 'root', x: -s.hipX, len: s.th },
    { name: 'shB', parent: 'thB', y: s.th, len: s.sh },
    { name: 'ftB', parent: 'shB', y: s.sh },
    { name: 'thF', parent: 'root', x: s.hipX, len: s.th },
    { name: 'shF', parent: 'thF', y: s.th, len: s.sh },
    { name: 'ftF', parent: 'shF', y: s.sh },
  ]);
}
const HUMAN_DEF = { hipY: 57, torso: 32, neck: 2, headR: 12.5, shX: 2.5, shDrop: 5, ua: 18, fa: 17, th: 26, sh: 26, hipX: 3 };

/* ---- 通用部件画法 ---- */
function drawLimb(c, len, r0, r1, col, { lw = 1.3, hi = 0.25, sh = -0.3 } = {}) {
  capsulePath(c, len, r0, r1);
  const g = c.createLinearGradient(-r0, 0, r0, 0);
  g.addColorStop(0, shade(col, sh)); g.addColorStop(0.55, col); g.addColorStop(1, shade(col, hi));
  fillStroke(c, g, lw);
}
function gradX(c, x0, x1, col, sh = -0.3, hi = 0.22) { const g = c.createLinearGradient(x0, 0, x1, 0); g.addColorStop(0, shade(col, sh)); g.addColorStop(0.6, col); g.addColorStop(1, shade(col, hi)); return g; }
function drawBootFoot(c, col, len = 12, h = 6) {
  // 脚：局部 +y 为小腿方向，脚尖朝 +x（面朝方向）
  c.beginPath(); c.moveTo(-4, -3); c.lineTo(3, -4); c.quadraticCurveTo(len, -3, len, h - 1); c.lineTo(-5, h - 1); c.quadraticCurveTo(-6, 1, -4, -3); c.closePath();
  fillStroke(c, gradX(c, -5, len, col, -0.35, 0.15), 1.3);
  c.fillStyle = shade(col, -0.55); c.fillRect(-5, h - 2.5, len + 0.5, 1.5);
}
function drawFist(c, col, r = 3.6) { c.beginPath(); c.ellipse(0.5, 1.5, r, r * 1.1, 0, 0, TAU); fillStroke(c, gradX(c, -r, r, col, -0.3, 0.2), 1.2); }

/* ---- 头部（3/4 朝向镜头）：脸 + 双眼 + 头发 ---- */
function drawHead(c, R, o) {
  // 局部：头骨骼沿 +y 指向头顶，这里转回“头朝上”的坐标（+x 为面朝方向）
  c.rotate(Math.PI);
  const hy = -R * 0.9;
  if (o.hairBack) { c.save(); c.translate(0, hy); o.hairBack(c, R); c.restore(); }
  // 脸：3/4 视角，下巴偏向面朝方向
  c.beginPath();
  c.moveTo(-R * 0.72, hy - R * 0.45);
  c.bezierCurveTo(-R * 0.85, hy + R * 0.35, -R * 0.35, hy + R * 0.95, R * 0.28, hy + R * 1.08);
  c.bezierCurveTo(R * 0.72, hy + R * 0.9, R * 0.95, hy + R * 0.45, R * 0.93, hy - R * 0.05);
  c.bezierCurveTo(R * 0.95, hy - R * 0.75, R * 0.2, hy - R * 1.05, -R * 0.3, hy - R * 0.95);
  c.quadraticCurveTo(-R * 0.72, hy - R * 0.85, -R * 0.72, hy - R * 0.45); c.closePath();
  const g = c.createLinearGradient(-R, hy, R, hy); g.addColorStop(0, shade(o.skin, -0.3)); g.addColorStop(0.45, o.skin); g.addColorStop(1, shade(o.skin, 0.1));
  fillStroke(c, g, 1.3);
  // 腮红 / 下巴阴影
  c.fillStyle = shade(o.skin, -0.12, 0.8); c.beginPath(); c.ellipse(-R * 0.25, hy + R * 0.55, R * 0.35, R * 0.25, 0, 0, TAU); c.fill();
  // 双眼（近眼大，远眼窄）
  const eye = (x, w, h) => {
    const y = hy + R * 0.12;
    c.fillStyle = '#fff'; c.beginPath(); c.ellipse(x, y, w, h, 0, 0, TAU); c.fill();
    c.fillStyle = o.eye || '#3050b0'; c.beginPath(); c.ellipse(x + w * 0.25, y + h * 0.1, w * 0.62, h * 0.85, 0, 0, TAU); c.fill();
    c.fillStyle = OUTLINE; c.beginPath(); c.ellipse(x + w * 0.3, y + h * 0.15, w * 0.3, h * 0.45, 0, 0, TAU); c.fill();
    c.fillStyle = '#fff'; c.fillRect(Math.round(x + w * 0.05), Math.round(y - h * 0.55), 1, 1);
    c.strokeStyle = OUTLINE; c.lineWidth = 1.4; c.beginPath(); c.moveTo(x - w * 1.1, y - h * 0.8); c.quadraticCurveTo(x, y - h * 1.35, x + w * 1.15, y - h * 0.7); c.stroke();   // 上眼线
  };
  if (o.eyes !== false) { eye(R * 0.08, R * 0.24, R * 0.3); eye(R * 0.66, R * 0.15, R * 0.28); }
  if (o.face) o.face(c, R, hy);
  // 鼻 / 嘴
  c.fillStyle = shade(o.skin, -0.35); c.fillRect(Math.round(R * 0.5), Math.round(hy + R * 0.45), 1, 1);
  if (o.mouth !== false) { c.fillStyle = shade(o.skin, -0.5); c.fillRect(Math.round(R * 0.3), Math.round(hy + R * 0.72), 3, 1); }
  if (o.hair) { c.save(); c.translate(0, hy); o.hair(c, R); c.restore(); }
  if (o.headwear) { c.save(); c.translate(0, hy); o.headwear(c, R); c.restore(); }
}
// 尖刺发型：pts 为以头心为原点、R 为单位的轮廓点
function spikyHair(col, pts, { hi = 0.3 } = {}) {
  return (c, R) => {
    const p = pts.map(v => v * R);
    smoothPolyPath(c, p);
    const g = c.createLinearGradient(0, -R * 1.3, R * 0.3, R * 0.6); g.addColorStop(0, shade(col, hi)); g.addColorStop(0.45, col); g.addColorStop(1, shade(col, -0.35));
    fillStroke(c, g, 1.3);
    c.strokeStyle = shade(col, 0.55, 0.7); c.lineWidth = 1; c.beginPath(); c.moveTo(-R * 0.2, -R * 0.85); c.quadraticCurveTo(R * 0.25, -R * 1.02, R * 0.55, -R * 0.75); c.stroke();
  };
}

/* ---- 模型：骨骼 + 部件 → draw(c, pose, t) ---- */
class Model {
  constructor(skel, parts, style) { this.skel = skel; this.parts = parts.slice().sort((a, b) => a.z - b.z); this.style = style; this.t = 0; }
  draw(c, pose, t = 0, opts = {}) {
    this.skel.solve(pose); this.t = t; this.opts = opts;
    if (pose.g !== 0 && this.skel.map.ftF) {   // 自动踩地：最低的脚底对齐 y=0
      const f = this.style.footH ?? 5, yb = Math.max(this.skel.map.ftF.wy, this.skel.map.ftB.wy) + f;
      this.skel.shift(0, -yb);
    }
    for (const p of this.parts) {
      if (p.when && !p.when(opts)) continue;
      c.save();
      if (p.bone) this.skel.apply(c, p.bone);
      p.draw(c, this, opts);
      c.restore();
    }
  }
}
