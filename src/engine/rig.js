/* =====================================================================
   02. 2D 骨骼动画
   - 骨骼角度约定：0 = 竖直向下，正值 = 朝“面朝方向”（+x）转；世界方向 = (sin a, cos a)
   - 每根骨骼：parent、offset（父骨骼局部坐标，父骨骼沿 +y）、len、base（基准角）
   - 姿势：{ r:[x,y,a], 骨骼名: 角度(度) }；动画片段按关键帧插值，时间按 fps 量化 → 帧动画的“一顿一顿”感
   ===================================================================== */
const D2R = Math.PI / 180;
class Skeleton {
  constructor(bones) {
    this.bones = bones.map((b, i) => ({ ...b, i, pi: -1, wx: 0, wy: 0, wa: 0 }));
    this.map = {};
    for (const b of this.bones) this.map[b.name] = b;
    for (const b of this.bones) b.pi = b.parent ? this.map[b.parent].i : -1;
  }
  // pose: 当前姿势（角度为度）；计算所有骨骼的世界变换（角色局部空间，脚底中心为原点）
  solve(pose) {
    const B = this.bones, r = pose.r || [0, 0, 0];
    for (const b of B) {
      const pa = (pose[b.name] || 0) * D2R + (b.base || 0) * D2R;
      if (b.pi < 0) { b.wx = r[0] + (b.x || 0); b.wy = r[1] + (b.y || 0); b.wa = r[2] * D2R + pa; continue; }
      const p = B[b.pi], ca = Math.cos(p.wa), sa = Math.sin(p.wa), ox = b.x || 0, oy = b.y || 0;
      b.wx = p.wx + ox * ca + oy * sa; b.wy = p.wy - ox * sa + oy * ca; b.wa = p.wa + pa;
    }
  }
  shift(dx, dy) { for (const b of this.bones) { b.wx += dx; b.wy += dy; } }
  // 把画布变换到某根骨骼的局部坐标（骨骼沿 +y）
  apply(c, name) { const b = this.map[name]; c.translate(b.wx, b.wy); c.rotate(-b.wa); }
  // 骨骼上某点（局部 u,v）的角色空间坐标
  point(name, u = 0, v = 0, out = {}) { const b = this.map[name], ca = Math.cos(b.wa), sa = Math.sin(b.wa); out.x = b.wx + u * ca + v * sa; out.y = b.wy - u * sa + v * ca; return out; }
  end(name, out) { return this.point(name, 0, this.map[name].len || 0, out); }
}

/* ---- 姿势插值 ---- */
function lerpPose(a, b, t, out) {
  for (const k in a) { if (k === 'r' || k === '__n' || k === '__c' || k === '__t') continue; out[k] = lerp(a[k] || 0, b[k] ?? a[k] ?? 0, t); }
  for (const k in b) if (!(k in a) && k !== 'r' && k !== '__n' && k !== '__c' && k !== '__t') out[k] = lerp(0, b[k], t);
  const ra = a.r || [0, 0, 0], rb = b.r || ra;
  out.r = out.r || [0, 0, 0]; out.r[0] = lerp(ra[0], rb[0], t); out.r[1] = lerp(ra[1], rb[1], t); out.r[2] = lerp(ra[2], rb[2], t);
  return out;
}
// 片段：{ keys:[[t, pose, ease?], ...], dur, loop, fps }；ease: 'hold' 保持到下一帧、'out' 减速、默认线性
function samplePose(clip, t, out) {
  const K = clip.keys, fps = clip.fps ?? 20;
  if (clip.loop) t = ((t % clip.dur) + clip.dur) % clip.dur; else t = Math.min(t, clip.dur);
  out.__t = t;   // 片段内时间（逐帧精灵按它选帧）
  if (fps) t = Math.floor(t * fps + 1e-6) / fps;
  let i = 0; while (i < K.length - 1 && K[i + 1][0] <= t) i++;
  const a = K[i], b = K[i + 1] || (clip.loop ? [clip.dur, K[0][1]] : a);
  out.__c = clip.__name;   // 逐帧精灵用：当前片段名 + 最接近的关键帧姿势名
  if (a === b || a[2] === 'hold') { out.__n = poseName(a[1]); return lerpPose(a[1], a[1], 0, out); }
  let f = (t - a[0]) / Math.max(1e-6, b[0] - a[0]);
  out.__n = poseName(f < 0.5 ? a[1] : b[1]);
  if (a[2] === 'out') f = easeOut(f); else if (a[2] === 'in') f = easeIn(f); else if (a[2] === 'smooth') f = f * f * (3 - 2 * f);
  return lerpPose(a[1], b[1], f, out);
}
// 以某个基础姿势为模板，覆盖部分骨骼
const P = (base, over) => { const o = { ...base, ...over }; if (over.r) o.r = over.r; else if (base.r) o.r = base.r.slice(); Object.defineProperty(o, '__b', { value: base }); return o; };
// 姿势名：POSE 里的姿势在所有文件加载后统一命名（nameAllPoses）；临时用 P() 派生的姿势沿用基础姿势的名字
function poseName(p) { for (let i = 0; p && i < 6; i++, p = p.__b) if (p.__n) return p.__n; return ''; }
function nameAllPoses() {
  for (const k in POSE) if (!Object.prototype.hasOwnProperty.call(POSE[k], '__n')) Object.defineProperty(POSE[k], '__n', { value: k });
  const sets = [CLIPS.sword, CLIPS.gun, CLIPS.mage, HUMAN_CLIPS, GOB_CLIPS, BEAST_CLIPS];
  for (const S of sets) if (S) for (const k in S) if (!S[k].__name) Object.defineProperty(S[k], '__name', { value: k });
}
