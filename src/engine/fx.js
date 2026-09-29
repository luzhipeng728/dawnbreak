/* =====================================================================
   06. 特效：刀光弧、打击火花、伤害数字、文字弹出（COUNTER / BACK ATTACK）、尘土、残影
   每个特效：{ y: 深度排序用, t, dur, draw(c) }；add 模式的光效用 'lighter' 混合
   ===================================================================== */
const fxList = [];
const numList = [];
function addFx(f) { f.t = 0; fxList.push(f); return f; }
function updateFx(dt) {
  for (let i = fxList.length - 1; i >= 0; i--) { const f = fxList[i]; f.t += dt; if (f.update) f.update(dt); if (f.t >= f.dur) fxList.splice(i, 1); }
  for (let i = numList.length - 1; i >= 0; i--) { const n = numList[i]; n.t += dt; if (n.t >= n.dur) numList.splice(i, 1); }
}

/* ---- 手绘特效素材：fx/<名字>；发光类用“叠加”混合绘制，可按颜色换色 ---- */
const FX_BASE_HUE = { orb: 300, slash: 195, thrust: 195, slashx: 200, rune: 220, hexagram: 220, aura: 48, burst: 48, spark: 50, wave: 205, shock: 30,
  ghost: 275, crossx: 355, swordrain: 190, bloodwave: 355, bloodhand: 355, bloodpillar: 355, lava: 25, dragonfang: 45, chaser: 50, laser: 190, flame: 25, quantum: 205, darkorb: 285, eel: 55, petal: 330, thunderbolt: 240 };
function hueOf(hex) { const [r, g, b] = hexRgb(hex), mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; if (!d) return { h: 0, s: 0 }; let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; if (h < 0) h += 360; return { h, s: d / mx }; }
// 按目标颜色给发光素材换色（近白色 → 去饱和）
function fxTint(name, col) {
  if (!col || !IMG['fx/' + name]) return IMG['fx/' + name];
  const { h, s } = hueOf(col), base = FX_BASE_HUE[name] ?? h;
  return s < 0.22 ? tintImg('fx/' + name, 0, 1.1, 0.25) : tintImg('fx/' + name, Math.round(h - base), 1, 1);
}
// 以 (x,y) 为锚点画一张素材；w/h 省略一个时按原比例；o: { rot, alpha, add(默认 true), flip, ax, ay }
function drawSpr(c, img, x, y, w, h, o = {}) {
  if (typeof img === 'string') img = IMG['fx/' + img]; if (!img) return;
  if (!h) h = w * img.height / img.width; if (!w) w = h * img.width / img.height;
  c.save(); if (o.add !== false) c.globalCompositeOperation = 'lighter'; if (o.alpha !== undefined) c.globalAlpha *= clamp(o.alpha, 0, 1);
  c.translate(x, y);
  if (o.ground) { c.scale(1, h / w); if (o.rot) c.rotate(o.rot); c.drawImage(img, -w / 2, -w / 2, w, w); c.restore(); return; }   // 平躺在地面的法阵：在地面平面里转，再按透视压扁（不会像立着的圆盘那样原地转）
  if (o.rot) c.rotate(o.rot); if (o.flip) c.scale(-1, 1);
  c.drawImage(img, -w * (o.ax ?? 0.5), -h * (o.ay ?? 0.5), w, h); c.restore();
}
/* ---- 刀光：新月形刀光素材，沿 a0→a1（弧度，0 = 朝右）扫出来；扇形裁剪做出“挥过去”的过程 ---- */
function fxSlash(o) {
  const img = fxTint('slash', o.col || '#8fd8ff');
  return addFx({ ...o, y: o.y + 0.5, dur: (o.dur || 0.16) * 1.4, add: true, img,
    draw(c) {
      const k = this.t / this.dur, img = this.img; if (!img) return;
      const cx = sx(this.x + (this.off ? this.off[0] * this.face : 0)), cy = sy(this.y, this.z + (this.off ? this.off[1] : 0));
      const a0 = this.a0, a1 = this.a1, sweep = a1 - a0, span = Math.min(Math.PI * 0.95, Math.abs(sweep)), R = this.r * (1 + k * 0.12);
      const cur = a0 + sweep * easeOut(Math.min(1, k * 3.2));
      c.save(); c.translate(cx, cy); c.scale(this.face, this.squash || 1);
      c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, R * 1.6, a0, cur, sweep < 0); c.closePath(); c.clip();
      c.rotate((a0 + a1) / 2);
      const h = 2 * R * Math.sin(span / 2) * 1.2 + this.w * 1.5, w = h * img.width / img.height;
      c.globalCompositeOperation = 'lighter'; c.globalAlpha = 1 - easeIn(k);
      c.drawImage(img, R - w * 0.92, -h / 2, w, h);
      if (k < 0.35) { c.globalAlpha = (0.35 - k) * 2; c.drawImage(img, R - w * 0.92, -h / 2, w, h); }   // 刚挥出时更亮
      c.restore();
    } });
}
/* ---- 直线刀光（突刺 / 拔刀）：光枪素材，尖端在前 ---- */
function fxStreak(o) {
  const img = fxTint('thrust', o.col || '#8fd8ff');
  return addFx({ ...o, y: o.y + 0.5, dur: o.dur || 0.18, add: true, img,
    draw(c) {
      const k = this.t / this.dur, len = this.len * (0.6 + 0.4 * easeOut(Math.min(1, k * 3))), h = Math.max(8, this.w * 2.2) * (1 - k * 0.5);
      drawSpr(c, this.img, sx(this.x) + (this.face > 0 ? 0 : 0), sy(this.y, this.z), len, h, { ax: 0, ay: 0.5, flip: this.face < 0, alpha: 1 - easeIn(k) });
    } });
}
/* ---- 打击火花：星形爆闪素材（暴击用更大的橙红爆闪） ---- */
function fxHit(x, y, z, face, { col = '#ffe7a0', big = 1, crit = false } = {}) {
  const S = (crit ? 70 : 42) * big;
  addFx({ x, y: y + 1, z, dur: 0.16 + big * 0.04 + (crit ? 0.08 : 0), add: true, rot: rnd(0, TAU), S, crit,
    draw(c) {
      const k = this.t / this.dur, s = this.S * (0.5 + easeOut(Math.min(1, k * 3)) * 0.65), X = sx(this.x), Y = sy(this.y, this.z);
      drawSpr(c, this.crit ? 'crit' : 'spark', X, Y, s, s, { rot: this.rot + k * 0.5, alpha: 1 - k * k });
      if (this.crit && k < 0.5) drawSpr(c, 'spark', X, Y, s * 0.7, s * 0.7, { rot: -this.rot, alpha: 1 - k * 2 });
    } });
}
/* ---- 尘土：卡通烟团素材，向上飘散 ---- */
function fxDust(x, y, n = 4, spread = 10, col = '#b8a48a') {
  for (let i = 0; i < n; i++) {
    const vx = rnd(-30, 30), vz = rnd(8, 30), r = rnd(3, 6);
    addFx({ x: x + rnd(-spread, spread), y: y + rnd(-3, 3), z: 1, vx, vz, r, dur: rnd(0.35, 0.6), rot: rnd(-0.4, 0.4),
      update(dt) { this.x += this.vx * dt; this.z += this.vz * dt; this.vx *= 0.92; this.vz *= 0.9; },
      draw(c) { const k = this.t / this.dur, s = this.r * 3.6 * (0.7 + k * 0.8); drawSpr(c, 'dust', sx(this.x), sy(this.y, this.z), s, 0, { add: false, rot: this.rot, alpha: 0.85 * (1 - k) }); } });
  }
}
/* ---- 伤害数字（原作风格：黄橙渐变 + 深色描边，暴击更大更红；连续命中向上叠） ---- */
let numStack = 0, numStackT = 0;
function addNumber(n, x, y, z, { crit = false, player = false, heal = false, col } = {}) {
  if (game.t - numStackT > 0.35) numStack = 0;
  numStackT = game.t; const off = (numStack++ % 6) * 11;
  numList.push({ n: Math.round(n), x: x + rnd(-6, 6), y, z: z + off, t: 0, dur: 0.85, crit, player, heal, col });
}
// 伤害数字的字形图集：每种（字号 × 描边色 × 填充）一张，0-9、逗号、负号；上一行是描边层、下一行是填充层（渐变按字高，和整串画时一样）。
// 画一串数字 = 先把每个字的描边层贴上去，再贴填充层，效果同 strokeText + fillText；大范围技能一次几十上百个数字时不用每帧重新排版、描边、建渐变（docs/PERF.md）
const NUM_GLYPHS = '0123456789,-', NUM_ATLAS = new Map(), NUM_GRAD = {
  heal: [[0, '#d6ffd0'], [1, '#3ad060']], player: [[0, '#ffd0d0'], [1, '#ff3040']], crit: [[0, '#ffe0d0'], [0.45, '#ff5a3a'], [1, '#c80a0a']], norm: [[0, '#fffbe8'], [1, '#ffd24a']] };
let numMeasure = null;
function numAtlas(size, stroke, fill) {
  const key = size + stroke + fill; let A = NUM_ATLAS.get(key); if (A) return A;
  const font = `900 ${size}px "Arial Black","Impact",sans-serif`, pad = 4, ch = Math.ceil(size * 0.8) * 2, G = {};
  if (!numMeasure) numMeasure = offCanvas(1, 1)[1];
  numMeasure.font = font; let W = 0;
  for (const g of NUM_GLYPHS) { const adv = numMeasure.measureText(g).width; G[g] = { x: W, w: Math.ceil(adv) + pad * 2, adv }; W += G[g].w + 2; }
  const [cv, x] = offCanvas(W * RS, ch * 2 * RS);
  x.setTransform(RS, 0, 0, RS, 0, 0); x.font = font; x.textAlign = 'left'; x.textBaseline = 'middle';
  x.lineWidth = 4; x.strokeStyle = stroke; x.lineJoin = 'round';
  for (const g of NUM_GLYPHS) x.strokeText(g, G[g].x + pad, ch / 2);
  let fs = fill; if (NUM_GRAD[fill]) { fs = x.createLinearGradient(0, ch * 1.5 - size * 0.5, 0, ch * 1.5 + size * 0.5); for (const [o, col] of NUM_GRAD[fill]) fs.addColorStop(o, col); }
  x.fillStyle = fs; for (const g of NUM_GLYPHS) x.fillText(g, G[g].x + pad, ch * 1.5);
  A = { cv, G, pad, ch }; NUM_ATLAS.set(key, A); return A;
}
function drawNumbers(c) {
  if (typeof uiPref === 'function' && !uiPref('dmgNum')) return;   // 设置里关闭了伤害数字
  for (const d of numList) {
    const k = d.t / d.dur, pop = d.t < 0.08 ? 1.7 - d.t / 0.08 * 0.7 : 1, rise = easeOut(Math.min(1, d.t / 0.5)) * 18;
    const X = sx(d.x), Y = sy(d.y, d.z + rise + 70);
    const txt = d.txt || (d.txt = fmtNum(d.n)), A = numAtlas(d.crit ? 21 : 15, d.player ? '#3a0008' : '#2a1400', d.col || (d.heal ? 'heal' : d.player ? 'player' : d.crit ? 'crit' : 'norm'));
    let w = 0; for (const g of txt) { const G = A.G[g]; if (!G) { w = -1; break; } w += G.adv; }
    if (w < 0) continue;
    c.globalAlpha = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
    const y = Y - A.ch / 2 * pop, h = A.ch * pop, x0 = X - w * pop / 2;
    for (let row = 0; row < 2; row++) {
      let x = x0;
      for (const g of txt) { const G = A.G[g]; c.drawImage(A.cv, G.x * RS, row * A.ch * RS, G.w * RS, A.ch * RS, Math.round((x - A.pad * pop) * RS) / RS, y, G.w * pop, h); x += G.adv * pop; }
    }
    if (d.crit) { c.fillStyle = '#fff'; c.font = '900 9px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; if (d.sw === undefined) d.sw = c.measureText(txt).width; c.fillText('★', X - d.sw * 0.5 - 22, Y - 6); }
  }
  c.globalAlpha = 1;
}
/* ---- 文字弹出：COUNTER / BACK ATTACK / 连击评价等 ---- */
function fxText(txt, x, y, z, { col = '#ff5a3a', size = 13, dur = 0.7 } = {}) {
  addFx({ x, y: y + 2, z, dur, txt, col, size,
    draw(c) {
      const k = this.t / this.dur, pop = this.t < 0.06 ? 1.6 - this.t / 0.06 * 0.6 : 1;
      c.save(); c.globalAlpha = k > 0.6 ? 1 - (k - 0.6) / 0.4 : 1;
      c.font = `italic 900 ${(this.size * pop).toFixed(1)}px "Arial Black",sans-serif`; c.textAlign = 'center';
      const X = sx(this.x), Y = sy(this.y, this.z + 92 + k * 8);
      c.lineWidth = 4; c.strokeStyle = '#1a0806'; c.strokeText(this.txt, X, Y); c.fillStyle = this.col; c.fillText(this.txt, X, Y);
      c.restore();
    } });
}
/* ---- 残影（技能突进 / 闪避时）：生成时把当前姿势画到离屏画布上，并蒙一层白色提亮成浅色剪影（只做一次）；
   逐帧只是 lighter 贴图——不用 c.filter（每帧滤镜会让 GPU 满载） ---- */
const GHOST = { list: [], i: 0, W: 280, H: 300, FY: 280 };
function ghostSnap(ent) {
  const G = GHOST; let cv = G.list[G.i % 8]; G.i++;
  if (!cv) { cv = document.createElement('canvas'); cv.width = G.W; cv.height = G.H; G.list.push(cv); }
  const g = cv.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; g.clearRect(0, 0, G.W, G.H);
  g.translate(G.W / 2, G.FY); g.scale(ent.face, 1);
  ent.model.draw(g, { ...ent.pose, r: ent.pose.r ? ent.pose.r.slice() : undefined }, 0, {});
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(235,245,255,.55)'; g.fillRect(0, 0, G.W, G.H);
  g.globalCompositeOperation = 'source-over';
  return cv;
}
function fxAfterimage(ent, col = '#6ad0ff') {
  const img = ghostSnap(ent), x = ent.x, y = ent.y, z = ent.z;
  addFx({ y: ent.y - 0.2, dur: 0.22, col, img,
    draw(c) {
      const k = this.t / this.dur;
      c.save(); c.globalAlpha = 0.45 * (1 - k); c.globalCompositeOperation = 'lighter';
      c.drawImage(this.img, sx(x) - GHOST.W / 2, sy(y, z) - GHOST.FY);
      c.restore();
    } });
}
/* ---- 地面冲击波：冲击环素材向外扩散 ---- */
function fxShock(x, y, r = 100, col) {
  addFx({ x, y: y + 1, z: 0, dur: 0.5, add: true, r, img: col ? fxTint('shock', col) : IMG['fx/shock'], draw(c) {
    const k = this.t / this.dur, w = this.r * 2 * (0.35 + easeOut(k) * 0.9);
    drawSpr(c, this.img, sx(this.x), sy(this.y, 0), w, 0, { alpha: 1 - k });
  } });
}
/* ---- 光柱（增益 / 升级）与爆闪 ---- */
function fxAura(e, col, dur = 0.8) {
  const img = col ? fxTint('aura', col) : IMG['fx/aura'];
  addFx({ x: e.x, y: e.y + 1, z: 0, dur, add: true, ent: e, img, draw(c) {
    const k = this.t / this.dur, h = 150 * (0.6 + easeOut(Math.min(1, k * 2)) * 0.5);
    drawSpr(c, this.img, sx(this.ent.x), sy(this.ent.y, this.ent.z) + 4, 0, h, { ay: 1, alpha: k < 0.2 ? k * 5 : 1 - (k - 0.2) / 0.8 });
  } });
}
function fxBurst(x, y, z, size = 160, col) {
  const img = col ? fxTint('burst', col) : IMG['fx/burst'];
  addFx({ x, y: y + 2, z, dur: 0.45, add: true, img, rot: rnd(0, TAU), draw(c) {
    const k = this.t / this.dur; drawSpr(c, this.img, sx(this.x), sy(this.y, this.z), size * (0.5 + easeOut(k) * 0.7), 0, { rot: this.rot + k * 0.3, alpha: 1 - k * k });
  } });
}
function fxSlashX(x, y, z, size = 150, col) {
  const img = col ? fxTint('slashx', col) : IMG['fx/slashx'];
  addFx({ x, y: y + 2, z, dur: 0.35, add: true, img, rot: rnd(-0.4, 0.4), draw(c) {
    const k = this.t / this.dur; drawSpr(c, this.img, sx(this.x), sy(this.y, this.z), size * (0.6 + easeOut(Math.min(1, k * 3)) * 0.5), 0, { rot: this.rot, alpha: 1 - k * k });
  } });
}
/* ---- 通用手绘特效：一张素材做出现 / 缩放 / 旋转 / 淡出（技能特效大多用它） ----
   o：{ w, h, dur, rot, spin, flip, col（换色）, grow:[起始比例, 结束比例], ax, ay, add, follow（跟随实体）, fadeIn, alpha } */
function fxSpr(name, x, y, z, o = {}) {
  const img = o.col ? fxTint(name, o.col) : IMG['fx/' + name];
  const g = o.grow || [1, 1];
  return addFx({ x, y: y + 1, yy: y, z, dur: o.dur || 0.4, add: o.add !== false, img, o, draw(c) {
    const k = this.t / this.dur, O = this.o, s = lerp(g[0], g[1], easeOut(k)), fi = O.fadeIn || 0.08;
    const a = (O.alpha ?? 1) * (k < fi ? k / fi : k > 0.6 ? 1 - (k - 0.6) / 0.4 : 1);
    const e = O.follow, X = sx(e ? e.x + (O.ox || 0) * e.face : this.x), Y = sy(e ? e.y : this.yy, e ? e.z + (O.oz || 0) : this.z);
    drawSpr(c, this.img, X, Y, O.w ? O.w * s : 0, O.h ? O.h * s : 0, { rot: (O.rot || 0) + (O.spin || 0) * this.t, flip: O.flip, alpha: a, ax: O.ax, ay: O.ay, add: O.add });
  } });
}
/* ---- 横向光束（激光炮等）：一段光束素材横向拉伸，宽度随时间收缩 ---- */
function fxBeam(x, y, z, len, face, o = {}) {
  const img = o.col ? fxTint(o.img || 'laser', o.col) : IMG['fx/' + (o.img || 'laser')];
  return addFx({ x, y: y + 1, z, dur: o.dur || 0.5, add: true, img, len, face, w: o.w || 40, draw(c) {
    const k = this.t / this.dur, h = this.w * (k < 0.1 ? k / 0.1 : 1 - easeIn(Math.max(0, (k - 0.5) / 0.5)) * 0.9);
    drawSpr(c, this.img, sx(this.x), sy(this.y, this.z), this.len, h, { ax: 0, ay: 0.5, flip: this.face < 0, alpha: k > 0.8 ? (1 - k) / 0.2 : 1 });
  } });
}
/* ---- 蓄力：光点向角色汇聚 ---- */
function fxCharge(e, col = '#ffe07a', n = 1) {
  for (let i = 0; i < n; i++) {
    const a = rnd(0, TAU), r = rnd(40, 70);
    addFx({ x: e.x, y: e.y + 1, z: e.z + 50, ax: Math.cos(a) * r, az: Math.sin(a) * r * 0.8, dur: 0.3, col, ent: e, draw(c) {
      const k = easeIn(this.t / this.dur), X = sx(this.ent.x + this.ax * (1 - k)), Y = sy(this.ent.y, this.ent.z + 50 + this.az * (1 - k));
      c.fillStyle = this.col; c.globalAlpha = 0.9 * (1 - k * 0.5); c.fillRect(X - 1.5, Y - 1.5, 3, 3); c.globalAlpha = 1;
    } });
  }
}
/* ---- 格挡火花 ---- */
function fxGuard(e) {
  addFx({ x: e.x + e.face * 22, y: e.y + 2, z: e.z + 55, dur: 0.2, add: true, face: e.face, draw(c) {
    const k = this.t / this.dur; c.save(); c.globalCompositeOperation = 'lighter'; c.strokeStyle = `rgba(160,220,255,${1 - k})`; c.lineWidth = 3;
    c.beginPath(); c.ellipse(sx(this.x), sy(this.y, this.z), 8 + k * 10, 26 + k * 10, 0, this.face > 0 ? -1.3 : 1.84, this.face > 0 ? 1.3 : 4.44); c.stroke(); c.restore();
    drawSpr(c, 'spark', sx(this.x), sy(this.y, this.z), 40 * (1 - k * 0.5), 0, { alpha: 1 - k });
  } });
}
