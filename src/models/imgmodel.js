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
      if (only[1] > 360 && h < only[1] - 360) h += 360;   // 区间跨 0°（格斗家的暗红马甲）：[335, 372]
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
// 纯色剪影缓存（怪物的受击闪白 / 霸体描边）：帧图 → 颜色 → 画布；最多 SPR_SIL_MAX 张帧图，最久没用的先释放
const SPR_SIL = new Map(), SPR_SIL_MAX = 96;
function sprSil(im, col) {
  let M = SPR_SIL.get(im);
  if (M) { SPR_SIL.delete(im); SPR_SIL.set(im, M); } else {
    SPR_SIL.set(im, M = new Map());
    if (SPR_SIL.size > SPR_SIL_MAX) { const k0 = SPR_SIL.keys().next().value; for (const cv of SPR_SIL.get(k0).values()) cv.width = cv.height = 0; SPR_SIL.delete(k0); }
  }
  let cv = M.get(col); if (cv) return cv;
  const [c2, x] = offCanvas(im.width, im.height); x.drawImage(im, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = col; x.fillRect(0, 0, im.width, im.height);
  M.set(col, cv = c2); return cv;
}
/* ---- 逐帧精灵模型：同一角色的手绘动作帧（每张动作表 8 帧连续动画，比例画风一致）
   anims：{ 片段名: [[帧, 起始时间], ...]（一次性动作）或 { fps, frames: [...] }（循环） }，按片段内时间选帧；
   没列出的片段按姿势名对照表 map 兜底；翻滚帧按姿势的整体转角旋转；站立时带轻微呼吸起伏 */
const SPR_ROT = { roll: 1 };
/* ---- 动作顺滑（docs/ANIMATION.md，所有职业 / 时装 / 转职共用）----
   1) 走 / 跑的身体起伏：美术帧里头部高度和前倾一帧一个样（跑步第 3、7 帧突然站直、头往上跳 6~7 像素，下一帧又落回去），
      按原装帧的头部锚点（F.head）把这一圈的头部轨迹拟合成“每步一次”的正弦（只保留均值 + 二次谐波；前倾的起伏再减半），
      每帧绕脚底做一点竖向压缩 / 水平错切把头对到拟合位置：脚不离地、时装 / 武器 / 配件跟着一起变，形变不超过 6% / 0.08
   2) 换帧时身体的水平跳动：同一个动作里相邻两帧的锚点常对不齐（普攻 1 起手 → 挥砍头部往后跳 28 像素、法师普攻往前跳 26），
      换帧时把头部的水平跳动记成偏移，再按指数衰减在 ~0.1 秒内收回到 0：瞬移变成很快的滑步，停下来时仍在原锚点（判定 / 特效位置不变）。
      循环动作内部、受击 / 浮空 / 倒地类片段、转身、跳动超过 max 的（跳斩起跳 / 落地、冲刺这类本来就是换姿势的整段位移）照旧直接换帧 */
const SPR_LOOP_NORM = { walk: 1, run: 1 }, SPR_LOOP_CACHE = {};
const SPR_EASE = { k: 28, max: 40, skip: { hit: 1, hit2: 1, air: 1, airUp: 1, bounceUp: 1, down: 1, getup: 1, tech: 1, held: 1 } };
function sprLoopNorm(m, clip, A) {
  const ck = m.key + '|' + clip; if (ck in SPR_LOOP_CACHE) return SPR_LOOP_CACHE[ck];
  const n = A.frames.length, H = A.frames.map(f => { const F = m.S.frames[f]; return F && F.head && [F.head.x - F.ax, F.head.y - F.ay]; });
  if (n < 4 || n % 2 || H.some(h => !h || h[1] > -10)) return (SPR_LOOP_CACHE[ck] = null);
  const fit = (i, keep) => {   // 均值 + 二次谐波（一圈两步 → 每步一个起伏）
    let mu = 0, a = 0, b = 0;
    for (let j = 0; j < n; j++) { const w = 4 * Math.PI * j / n; mu += H[j][i]; a += H[j][i] * Math.cos(w); b += H[j][i] * Math.sin(w); }
    mu /= n; a *= 2 / n; b *= 2 / n;
    return H.map((_, j) => mu + keep * (a * Math.cos(4 * Math.PI * j / n) + b * Math.sin(4 * Math.PI * j / n)));
  };
  const TX = fit(0, 0.5), TY = fit(1, 1), R = {};
  A.frames.forEach((f, j) => { const [hx, hy] = H[j]; R[f] = [clamp((TX[j] - hx) / hy, -0.08, 0.08), clamp(TY[j] / hy, 0.94, 1.06)]; });
  return (SPR_LOOP_CACHE[ck] = R);
}
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
  // 走 / 跑的播放速度倍率（engine/entity.js、路人）：A.v = 这个 fps 对应的移动速度；每帧停留的逻辑步数取整（节奏均匀），最少 2 步
  loopRate(clip, speed) {
    const A = this.anims[clip]; if (!A || !A.v || !A.frames || !(speed > 1)) return 1;
    const h0 = 60 / A.fps, h = Math.max(2, Math.round(h0 * A.v / speed));
    return clamp(h0 / h, 0.4, 2.5);
  }
  // 换帧时身体的水平跳动（见下方 SPR_EASE）：返回这一帧要额外平移的量（世界单位，模型本地朝向）
  ease(pose, f, t, A) {
    const B = this.S.frames[f], hx = B && B.head ? (B.head.x - B.ax) / this.S.res : null;
    let o = this.eo || 0;
    if (o && this.et !== undefined) { o *= Math.exp(-SPR_EASE.k * Math.max(0, t - this.et)); if (Math.abs(o) < 0.2) o = 0; }
    const flip = pose.__f !== this.ed; if (flip) { this.ed = pose.__f; o = 0; }   // 转身：偏移是本地坐标，翻面后会反向，直接清掉（这次换帧也不再记跳动）
    if (f !== this.ef) {
      const inLoop = A && A.frames && pose.__c === this.ec;
      if (flip || hx === null || this.eh == null || SPR_EASE.skip[pose.__c]) o = 0;
      else if (!inLoop) { o += this.eh - hx; if (Math.abs(o) > SPR_EASE.max) o = 0; }
      this.ef = f; this.ec = pose.__c; this.eh = hx;
    }
    this.eo = o; this.et = t; return o;
  }
  // 外观层钩子（外观与换装组 models/avatar.js）：this.av = { frame(m, f) → {F, im} 换帧来源（时装），under / over(c, m, f, F) 在帧前后叠加武器与配件 }；没有 av 时行为不变
  draw(c, pose, t = 0, opts = NO_OPTS) {
    const f = this.frameOf(pose), av = this.av;
    let F = this.S.frames[f], im = this.img[f];
    if (av) { const s = av.frame(this, f); if (s) { F = s.F; im = s.im; } }
    if (!im) return;
    const k = 1 / this.S.res, rot = SPR_ROT[f] && pose.r ? pose.r[2] * SPR_ROT[f] * D2R : 0;
    const A = pose.__c && this.anims[pose.__c], N = A && A.frames && SPR_LOOP_NORM[pose.__c] ? sprLoopNorm(this, pose.__c, A) : null, nf = N && N[f], ex = this.ease(pose, f, t, A);
    c.save();
    if (ex) c.translate(ex, 0);
    if (rot) { const cy = -F.h * k * 0.45; c.translate(0, cy); c.rotate(rot); c.translate(0, -cy); }
    if (f === 'idle') c.scale(1 - Math.sin(t * 2.6) * 0.006, 1 + Math.sin(t * 2.6) * 0.012);   // 呼吸
    c.scale(k, k);
    if (nf) c.transform(1, 0, nf[0], nf[1], 0, 0);   // 绕脚底：水平错切（前倾）+ 竖向压缩（起伏），时装 / 武器 / 配件一起变
    if (opts.sil) { c.drawImage(sprSil(im, opts.sil), -F.ax, -F.ay); c.restore(); return; }   // 纯色剪影：实体的霸体描边 / 受击闪白（engine/entity.js，只用于没有外观层的模型）
    if (av) av.under(c, this, f, F);
    c.drawImage(im, -F.ax, -F.ay);
    if (av) av.over(c, this, f, F);
    if (opts.glow) { c.globalCompositeOperation = 'lighter'; c.globalAlpha = Math.min(1, opts.glow) * 0.45; c.drawImage(im, -F.ax, -F.ay); }
    c.restore();
  }
}
