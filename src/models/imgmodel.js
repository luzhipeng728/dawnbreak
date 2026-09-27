/* =====================================================================
   手绘美术：素材分包加载 + 换色 + 逐帧精灵模型 / 静态立绘模型
   - ASSET_SRC / ASSET_BUNDLE / SPR_DATA 由 build.mjs 从 art/final 生成
   - 怪物变种用色相旋转（可只处理某个色相区间）在加载时预先生成
   ===================================================================== */
const IMG = {};
/* ---- 分包加载：网页版按需拉取 assets/ 下的文件；离线版素材已内嵌（data URI），加载瞬间完成 ----
   分包名：core（图标 / 特效 / 标题 / 职业立绘）、spr:<角色或怪物>、bg:<场景主题>、npc、scene:<场景> */
const bundleLoads = {};
function loadBundles(names) {
  const want = new Set(names.filter(Boolean)), jobs = [];
  for (const k in ASSET_SRC) {
    if (!want.has(ASSET_BUNDLE[k]) || IMG[k]) continue;
    jobs.push(bundleLoads[k] || (bundleLoads[k] = new Promise(res => { const im = new Image(); im.onload = () => { IMG[k] = im; res(); }; im.onerror = () => { console.warn('素材加载失败', k); res(); }; im.src = ASSET_SRC[k]; })));
  }
  return Promise.all(jobs);
}
const allBundles = () => [...new Set(Object.values(ASSET_BUNDLE))];
// 加载中提示：超过 150 ms 才显示，避免离线版闪一下
function withLoading(names, fn) {
  let el = null; const t = setTimeout(() => { el = document.createElement('div'); el.id = 'loading'; el.textContent = '加载中…'; document.getElementById('stage').appendChild(el); }, 150);
  return loadBundles(names).then(() => { clearTimeout(t); if (el) el.remove(); return fn ? fn() : undefined; });
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
  let d; try { d = x.getImageData(0, 0, im.width, im.height); } catch (e) { return (tintCache[ck] = im); }   // 用 file:// 打开网页版时图片算跨域，读不了像素：退回原图
  const p = d.data;
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
  // 外观层钩子（外观与换装组 models/avatar.js）：this.av = { frame(m, f) → {F, im} 换帧来源（时装），under / over(c, m, f, F) 在帧前后叠加武器与配件 }；没有 av 时行为不变
  draw(c, pose, t = 0, opts = NO_OPTS) {
    const f = this.frameOf(pose), av = this.av;
    let F = this.S.frames[f], im = this.img[f];
    if (av) { const s = av.frame(this, f); if (s) { F = s.F; im = s.im; } }
    if (!im) return;
    const k = 1 / this.S.res, rot = SPR_ROT[f] && pose.r ? pose.r[2] * SPR_ROT[f] * D2R : 0;
    c.save();
    if (rot) { const cy = -F.h * k * 0.45; c.translate(0, cy); c.rotate(rot); c.translate(0, -cy); }
    if (f === 'idle') c.scale(1 - Math.sin(t * 2.6) * 0.006, 1 + Math.sin(t * 2.6) * 0.012);   // 呼吸
    c.scale(k, k);
    if (av) av.under(c, this, f, F);
    c.drawImage(im, -F.ax, -F.ay);
    if (av) av.over(c, this, f, F);
    if (opts.glow) { c.globalCompositeOperation = 'lighter'; c.globalAlpha = Math.min(1, opts.glow) * 0.45; c.drawImage(im, -F.ax, -F.ay); }
    c.restore();
  }
}
