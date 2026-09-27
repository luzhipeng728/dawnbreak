/* =====================================================================
   04b. 手绘美术：素材加载 + 图片骨骼模型（AI 手绘部件挂在骨骼上，沿用全部姿势与动画）
   - ASSET_SRC / RIG_DATA 由 build.mjs 从 art/final 生成并内嵌（单文件离线可用）
   - 部件图按“每世界单位 res 像素”存储；躯干 / 头 / 裙摆等朝上的部件在骨骼坐标里先转 180°
   - 远侧（身后）的手脚用调暗的同一张图；怪物变种用色相旋转在加载时预先生成
   ===================================================================== */
const IMG = {};
function loadAssets() {
  const src = typeof ASSET_SRC !== 'undefined' ? ASSET_SRC : {};
  return Promise.all(Object.keys(src).map(k => new Promise(res => {
    const im = new Image(); im.onload = () => { IMG[k] = im; res(); }; im.onerror = () => res(); im.src = src[k];
  })));
}
const hasArt = key => !!IMG[key];
// 逐像素调色（不依赖 ctx.filter，旧版 Safari 也能用）：色相旋转 deg、亮度 b、饱和度 s
// only=[h0,h1]：只处理色相落在这个区间（度）的像素，例如只把哥布林的绿色皮肤换成蓝色，头巾保持红色
const tintCache = {};
function tintImg(key, deg = 0, b = 1, s = 1, only = null) {
  const ck = `${key}|${deg}|${b}|${s}|${only}`; if (tintCache[ck]) return tintCache[ck];
  const im = IMG[key]; if (!im) return null;
  if (!deg && b === 1 && s === 1) return (tintCache[ck] = im);
  const [cv, x] = offCanvas(im.width, im.height); x.drawImage(im, 0, 0);
  const d = x.getImageData(0, 0, im.width, im.height), p = d.data;
  const r = deg * Math.PI / 180, cs = Math.cos(r), sn = Math.sin(r);
  // 标准色相旋转矩阵（与 CSS hue-rotate 相同）
  const m = [0.213 + cs * 0.787 - sn * 0.213, 0.715 - cs * 0.715 - sn * 0.715, 0.072 - cs * 0.072 + sn * 0.928,
    0.213 - cs * 0.213 + sn * 0.143, 0.715 + cs * 0.285 + sn * 0.140, 0.072 - cs * 0.072 - sn * 0.283,
    0.213 - cs * 0.213 - sn * 0.787, 0.715 - cs * 0.715 + sn * 0.715, 0.072 + cs * 0.928 + sn * 0.072];
  for (let i = 0; i < p.length; i += 4) {
    if (!p[i + 3]) continue;
    let R = p[i], G = p[i + 1], B = p[i + 2];
    if (only) {   // 计算色相，不在区间内的像素原样保留
      const mx = Math.max(R, G, B), mn = Math.min(R, G, B), d2 = mx - mn; if (d2 < 18) continue;
      let h = mx === R ? ((G - B) / d2) % 6 : mx === G ? (B - R) / d2 + 2 : (R - G) / d2 + 4; h *= 60; if (h < 0) h += 360;
      if (h < only[0] || h > only[1]) continue;
    }
    if (deg) { const r2 = R * m[0] + G * m[1] + B * m[2], g2 = R * m[3] + G * m[4] + B * m[5], b2 = R * m[6] + G * m[7] + B * m[8]; R = r2; G = g2; B = b2; }
    if (s !== 1) { const l = 0.3 * R + 0.59 * G + 0.11 * B; R = l + (R - l) * s; G = l + (G - l) * s; B = l + (B - l) * s; }
    p[i] = R * b; p[i + 1] = G * b; p[i + 2] = B * b;
  }
  x.putImageData(d, 0, 0);
  return (tintCache[ck] = cv);
}
// 把任意图像整体调暗（给按区间换色后的远侧肢体用）
function darken(src) {
  if (!src) return null; if (src._dark) return src._dark;
  const [cv, x] = offCanvas(src.width, src.height); x.drawImage(src, 0, 0); x.globalCompositeOperation = 'source-atop'; x.fillStyle = 'rgba(10,8,20,0.4)'; x.fillRect(0, 0, cv.width, cv.height);
  return (src._dark = cv);
}
function imgSkeleton(S) {
  // 躯干骨骼局部坐标：+y 沿身体向上，+x 指向身后；远侧肩膀比近侧略靠前
  return new Skeleton([
    { name: 'root', y: -S.hipY },
    { name: 'torso', parent: 'root', base: 180, len: S.torso },
    { name: 'head', parent: 'torso', x: S.neckX, y: S.torso },
    { name: 'uaB', parent: 'torso', x: S.shX - S.torso * 0.08, y: S.shY, base: 180, len: S.ua },
    { name: 'faB', parent: 'uaB', y: S.ua, len: S.fa },
    { name: 'hB', parent: 'faB', y: S.fa },
    { name: 'uaF', parent: 'torso', x: S.shX, y: S.shY, base: 180, len: S.ua },
    { name: 'faF', parent: 'uaF', y: S.ua, len: S.fa },
    { name: 'hF', parent: 'faF', y: S.fa },
    { name: 'wF', parent: 'hF', y: 0, base: 90 },
    { name: 'wB', parent: 'hB', y: 0, base: 90 },
    { name: 'thB', parent: 'root', x: -S.hipX, len: S.th },
    { name: 'shB', parent: 'thB', y: S.th, len: S.sh },
    { name: 'ftB', parent: 'shB', y: S.sh },
    { name: 'thF', parent: 'root', x: S.hipX, len: S.th },
    { name: 'shF', parent: 'thF', y: S.th, len: S.sh },
    { name: 'ftF', parent: 'shF', y: S.sh },
  ]);
}
class ImageModel {
  // o: { hue, bright, sat, weapon:false|'rig/part', scale }
  constructor(rig, o = {}) {
    const R = RIG_DATA[rig]; this.R = R; this.rig = rig; this.o = o;
    this.skel = imgSkeleton(R.skel); this.style = { footH: R.skel.footH }; this.t = 0; this.k = 1 / R.res;
    this.im = {}; this.imD = {};
    for (const p in R.parts) {
      this.im[p] = tintImg(`${rig}/${p}`, o.hue || 0, o.bright || 1, o.sat || 1, o.only);
      this.imD[p] = tintImg(`${rig}/${p}`, o.hue || 0, (o.bright || 1) * 0.62, (o.sat || 1) * 0.85, o.only);
      if (o.only) { const base = this.im[p]; this.imD[p] = darken(base); }
    }
    if (typeof o.weapon === 'string') { const [r, p] = o.weapon.split('/'); this.im.weapon = tintImg(o.weapon); this.wR = RIG_DATA[r].parts[p]; this.wRes = RIG_DATA[r].res; }
    if (o.weapon === false) this.im.weapon = null;
    this.headH = R.skel.headH;
  }
  part(c, bone, key, dark, flip, ox, oy, rot) {
    const img = (dark ? this.imD : this.im)[key]; if (!img) return;
    const P = key === 'weapon' && this.wR ? this.wR : this.R.parts[key], k = key === 'weapon' && this.wR ? 1 / this.wRes : this.k;
    c.save(); this.skel.apply(c, bone);
    if (flip) c.rotate(Math.PI);
    if (ox || oy) c.translate(ox, oy);
    if (rot) c.rotate(rot);
    c.scale(k, k); c.drawImage(img, -P.px, -P.py);
    c.restore();
  }
  draw(c, pose, t = 0, opts = NO_OPTS) {
    const K = this.skel, R = this.R, T = R.parts.torso; K.solve(pose); this.t = t; this.opts = opts;
    if (pose.g !== 0) { const yb = Math.max(K.map.ftF.wy, K.map.ftB.wy) + this.style.footH; K.shift(0, -yb); }
    const sway = Math.sin(t * 7) * 0.07, spd = opts.speed || 0;
    const neck = T.neckPt || [0, -R.skel.torso], waist = T.waist || [0, -R.skel.torso * 0.25];
    // 最靠后：披风 / 围巾 / 尾巴
    const rest = k => R.parts[k].rot || 0;
    if (this.im.cape) this.part(c, 'torso', 'cape', false, true, neck[0], neck[1], rest('cape') + sway * 0.4 + spd * 0.15);
    if (this.im.scarf) this.part(c, 'torso', 'scarf', false, true, neck[0], neck[1], rest('scarf') + sway + spd * 0.3);
    if (this.im.tail) this.part(c, 'torso', 'tail', false, true, waist[0], waist[1], rest('tail') + sway * 1.5);
    // 远侧手臂与腿（调暗）
    this.part(c, 'faB', 'fa', true); this.part(c, 'uaB', 'ua', true);
    this.part(c, 'ftB', 'ft', true); this.part(c, 'thB', 'th', true); this.part(c, 'shB', 'sh', true);
    if (this.im.skirt) this.part(c, 'torso', 'skirt', false, true, waist[0], waist[1], rest('skirt') + sway * 0.25);
    this.part(c, 'ftF', 'ft'); this.part(c, 'thF', 'th'); this.part(c, 'shF', 'sh');
    this.part(c, 'torso', 'torso', false, true);   // 躯干：以髋为原点，随前倾 / 后仰转动
    if (this.im.hair) { const at = R.parts.hair.at || [0, -this.headH * 0.55]; this.part(c, 'head', 'hair', false, true, at[0], at[1], rest('hair') - sway * 0.8 + spd * 0.25); }
    this.part(c, 'head', 'head', false, true);
    if (this.im.weapon) {
      this.part(c, 'wF', 'weapon');
      if (opts.glow) { c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = Math.min(1, opts.glow) * 0.7; this.part(c, 'wF', 'weapon'); c.restore(); }
      if (opts.muzzle) { const P = this.wR || R.parts.weapon, k = this.wR ? 1 / this.wRes : this.k; c.save(); K.apply(c, 'wF'); c.translate(0, (P.h - P.py) * k + 3); c.globalCompositeOperation = 'lighter'; c.fillStyle = `rgba(255,220,120,${opts.muzzle})`; c.beginPath(); c.moveTo(0, -2); c.lineTo(5, 7); c.lineTo(0, 14); c.lineTo(-5, 7); c.closePath(); c.fill(); c.restore(); }
    }
    this.part(c, 'faF', 'fa'); this.part(c, 'uaF', 'ua');
  }
}
// 静态立绘（城镇 NPC）：脚底中心为原点，轻微呼吸起伏
class StaticModel {
  constructor(key, height) { this.img = IMG[key]; this.h = height; this.skel = { map: {} }; }
  draw(c, pose, t = 0) {
    const im = this.img; if (!im) return; const k = this.h / im.height, br = 1 + Math.sin(t * 2.2) * 0.008;
    c.save(); c.scale(k, k * br); c.drawImage(im, -im.width / 2, -im.height); c.restore();
  }
}
/* ---- 逐帧精灵模型：同一角色的手绘动作帧（每张动作表 8 帧连续动画，比例画风一致）
   anims：{ 片段名: [[帧, 起始时间], ...]（一次性动作）或 { fps, frames: [...] }（循环） }，按片段内时间选帧；
   没列出的片段按姿势名对照表 map 兜底；翻滚帧按姿势的整体转角旋转；站立时带轻微呼吸起伏 */
const SPR_ROT = { roll: 1 };
class SpriteModel {
  constructor(key, map, anims, o = {}) {
    this.S = SPR_DATA[key]; this.key = key; this.map = map || {}; this.anims = anims || {}; this.o = o; this.skel = { map: {} }; this.img = {}; this.style = {};
    for (const f in this.S.frames) this.img[f] = tintImg(`spr/${key}/${f}`, o.hue || 0, o.bright || 1, o.sat || 1, o.only);
  }
  frameOf(pose) {
    const A = pose.__c && this.anims[pose.__c], t = pose.__t || 0;
    let f = null;
    if (A) {
      if (A.frames) { const n = A.frames.length; f = A.frames[Math.floor(t * A.fps + 1e-6) % n]; }
      else for (const [fn, t0] of A) if (t >= t0 - 1e-6) f = fn;
    }
    if (!f || !this.img[f]) f = this.map[pose.__n || ''] || this.map._;
    return this.img[f] ? f : 'idle';
  }
  draw(c, pose, t = 0, opts = NO_OPTS) {
    const f = this.frameOf(pose), F = this.S.frames[f], im = this.img[f]; if (!im) return;
    const k = 1 / this.S.res, rot = SPR_ROT[f] && pose.r ? pose.r[2] * SPR_ROT[f] * D2R : 0;
    c.save();
    if (rot) { const cy = -F.h * k * 0.45; c.translate(0, cy); c.rotate(rot); c.translate(0, -cy); }
    if (f === 'idle') c.scale(1 - Math.sin(t * 2.6) * 0.006, 1 + Math.sin(t * 2.6) * 0.012);   // 呼吸
    c.scale(k, k); c.drawImage(im, -F.ax, -F.ay);
    if (opts.glow) { c.globalCompositeOperation = 'lighter'; c.globalAlpha = Math.min(1, opts.glow) * 0.45; c.drawImage(im, -F.ax, -F.ay); }
    c.restore();
  }
}
