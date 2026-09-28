/* =====================================================================
   转职外观渲染（数据在 content/avatar/job_looks.js，配方见 docs/JOB_VISUALS.md）
   外观层 AvatarLayer 调用：under → jlUnder（人物身后，最先画；无敌半透明在这里设 globalAlpha，SpriteModel.draw 的 save/restore 会还原）
                        over  → jlOver（人物身前）；weapon → jlWeapon（武器图坐标，画在武器图之前 = 光在刀身后面）
   坐标 = 帧像素：原点 = 脚底锚点，人物朝右（朝左由实体整体翻转）；1 帧像素 = 1 / res 游戏像素（剑士 res 1.8），“身后” = -x。
   锚点：头 F.head（每套时装自己的）；副手 F.oh 只写在原装帧里（时装帧按脚底锚点对齐，借用原装同名帧的）；没有头部锚点的帧不画眼睛 / 燃烧。
   实体：自己 = game.player；其他（队友影子、决斗 / AI 对手）按 e.model 在 ents 里找（每秒最多找一次）；UI 立绘、城镇其他玩家没有实体 → 只画常驻外观。
   性能（ARCHITECTURE 绘制规范）：不用 filter / shadowBlur，混合只用 source-over / lighter；着色剪影按（帧图, 颜色）缓存（最多 JL_SIL_MAX 张帧图），
   火舌 / 鬼火是换过色的素材条（fxTint 缓存）；常驻外观每人每帧约 8 次 drawImage，状态全开约 30 次。
   ===================================================================== */
FX_BASE_HUE.jv_flame = 22; FX_BASE_HUE.jv_wisp = 262;   // 素材本来的色相（fxTint 按它转到目标颜色）
const JL_STRIP = { jv_flame: 4, jv_wisp: 3 };            // 素材条的格数（art/tools/jobvis_art.py）
const JL_EYE = { sword: [15, 21] };                      // 眼睛相对头部锚点（帧像素，站姿朝右）
const jlNow = () => performance.now() / 1000;
const jlHash = n => { const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453; return s - Math.floor(s); };

// 素材条第 i 格，底边中点在 (x, y)，高 h（宽按格子比例 × wk）
function jlCell(c, name, col, i, x, y, h, wk = 1) {
  const img = fxTint(name, col); if (!img) return;
  const n = JL_STRIP[name] || 1, cw = img.width / n, w = h * cw / img.height * wk;
  c.drawImage(img, (i % n) * cw, 0, cw, img.height, x - w / 2, y - h, w, h);
}
/* ---- 着色剪影缓存：flat = 纯色剪影（燃烧的外轮廓），否则保留一点明暗（鬼影 / 残影） ---- */
const JL_SIL = new Map(), JL_SIL_MAX = 160;
function jlSil(im, col, flat) {
  let M = JL_SIL.get(im);
  if (M) { JL_SIL.delete(im); JL_SIL.set(im, M); } else {
    JL_SIL.set(im, M = new Map());
    if (JL_SIL.size > JL_SIL_MAX) { const k0 = JL_SIL.keys().next().value; for (const cv of JL_SIL.get(k0).values()) cv.width = cv.height = 0; JL_SIL.delete(k0); }
  }
  const k = flat ? col + '|f' : col; let cv = M.get(k); if (cv) return cv;
  const [c2, x] = offCanvas(im.width, im.height); x.drawImage(im, 0, 0);
  x.globalCompositeOperation = flat ? 'source-in' : 'source-atop'; x.globalAlpha = flat ? 1 : 0.7; x.fillStyle = col; x.fillRect(0, 0, im.width, im.height);
  M.set(k, c2); return c2;
}
// 眼睛后面拖的光带（横向渐变的细长条，缓存）
const JL_STREAK = new Map();
function jlStreak(col) {
  let cv = JL_STREAK.get(col); if (cv) return cv;
  const [c2, x] = offCanvas(64, 12), [r, g, b] = hexRgb(col), gr = x.createLinearGradient(0, 0, 64, 0);
  gr.addColorStop(0, `rgba(${r},${g},${b},0)`); gr.addColorStop(0.7, `rgba(${r},${g},${b},0.75)`); gr.addColorStop(1, 'rgba(255,220,220,1)');
  x.fillStyle = gr; x.beginPath(); x.moveTo(0, 6); x.quadraticCurveTo(40, 1, 64, 3.5); x.lineTo(64, 8.5); x.quadraticCurveTo(40, 11, 0, 6); x.fill();
  JL_STREAK.set(col, c2); return c2;
}

/* ---- 实体 / 转职 / 状态 ---- */
function jlEnt(L) {
  const p = game.player; if (p && p.model === L.m) return p;
  if (L.entT !== undefined && Math.abs(game.t - L.entT) < 1 && (!L.ent || L.ent.model === L.m)) return L.ent;
  L.entT = game.t; L.ent = ents.find(e => e.model === L.m) || null; return L.ent;
}
// 每帧：确定转职（look.job > 实体的 kit.job）→ L.J；算出开着的状态特效 → L.jfx = [[fx, 强度], ...]
function jlResolve(L) {
  const e = jlEnt(L), job = (L.look && L.look.job) || (e && e.kit && e.kit.job) || null;
  if (job !== L.jobId) {
    L.jobId = job; L.J = (job && JOB_LOOKS[job]) || null; L.hist = null;
    const J = L.J; if (J && J.acc) {   // look 里没带转职配件（AI 对手等）：这里补上
      if (J.noFace) L.acc = L.acc.filter(a => !a.face);
      for (const k of J.acc) { const a = AVATAR_ACC[k]; if (a && !L.acc.includes(a)) { L.acc.push(a); if (!IMG['avatar/' + a.img]) loadArtKey('avatar/' + a.img); } }
    }
  }
  const J = L.J, out = L.jfx || (L.jfx = []); out.length = 0; L.jw = null;
  if (J && J.states && e && !e.dead) for (const S of J.states) { const lv = S.on(e) || 0; if (lv > 0) { out.push([S.fx, lv]); if (S.fx.wtint) L.jw = S.fx.wtint; } }
  return e;
}
const jlSpeed = e => e ? Math.hypot(e.vx || 0, e.vy || 0) : 0;
function jlFrameIm(L, m, f) { const a = L.alt[f]; return (a && a.im) || m.img[f]; }
// 身体几何（帧像素，原点脚底）：头心 hx hy、半身宽 bw
function jlBody(F, res) {
  const H = F.head; if (!H) return null;
  const hx = H.x - F.ax, hy = H.y - F.ay; return { hx, hy, bw: Math.max(12 * res, -hy * 0.16), H };
}

/* ---- 人物身后 ---- */
function jlUnder(c, L, m, f, F) {
  const e = jlResolve(L), J = L.J; if (!J) return;
  const res = (m.S && m.S.res) || 1, t = jlNow() + (L.seed ??= Math.random() * 9), B = jlBody(F, res), A0 = c.globalAlpha;
  let fade = null;
  for (const [fx, lv] of L.jfx) {
    if (fx.trail) jlTrail(c, L, m, f, F, e, fx.trail, res);
    if (fx.ghost) jlGhost(c, L, m, f, F, e, fx.ghost, res, t);
    if (fx.burn && B) jlBurn(c, B, fx.burn, lv, res, t, true, jlFrameIm(L, m, f), F);
    if (fx.wisps && B) jlWisps(c, B, fx.wisps, lv, res, t, true);
    if (fx.fade && e && e.invul > 0) fade = fx.fade;
  }
  if (J.spirit && B) {   // 身后的小鬼神：飘在后背肩膀上方，慢慢上下浮动
    const S = J.spirit, bob = Math.sin(t * 1.6) * 3 * res, x = B.hx - 24 * res + Math.sin(t * 0.9) * 2 * res, y = B.hy + 26 * res + bob;
    c.save(); c.globalAlpha = A0 * S.a; jlCell(c, 'jv_wisp', S.col, 0, x, y, S.h * res); c.globalCompositeOperation = 'lighter'; c.globalAlpha = A0 * S.a * 0.5; jlCell(c, 'jv_wisp', S.col, 0, x, y, S.h * res); c.restore();
  }
  if (J.draw) J.draw(c, L, F, f, true, e);
  if (fade) { L.faded = fade; c.globalAlpha = A0 * (fade.a + 0.08 * Math.sin(t * 38)); } else L.faded = null;   // 无敌：本体半透明（微微闪烁）
}
/* ---- 人物身前 ---- */
function jlOver(c, L, m, f, F) {
  const J = L.J; if (!J) return;
  const e = L.ent || (game.player && game.player.model === L.m ? game.player : null);
  const res = (m.S && m.S.res) || 1, t = jlNow() + (L.seed || 0), B = jlBody(F, res);
  if (L.faded) {   // 无敌半透明时身上一层鬼火微光
    c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha *= 0.35 + 0.15 * Math.sin(t * 20); c.drawImage(jlSil(jlFrameIm(L, m, f), L.faded.col), -F.ax, -F.ay); c.restore();
  }
  for (const [fx, lv] of L.jfx) {
    if (fx.burn && B) jlBurn(c, B, fx.burn, lv, res, t, false, jlFrameIm(L, m, f), F);
    if (fx.wisps && B) jlWisps(c, B, fx.wisps, lv, res, t, false);
  }
  const base = SPR_DATA[L.cls] && SPR_DATA[L.cls].frames[f], oh = base && base.oh;
  if (J.arm && oh) jlArm(c, J.arm, oh[0] - base.ax, oh[1] - base.ay, res, t);
  if (J.eyes && B && B.H.f !== 0) jlEyes(c, J.eyes, B.H, F, L.cls, e, res, t);
  if (J.draw) J.draw(c, L, F, f, false, e);
}
/* ---- 武器光（武器图坐标；画在武器图之前 = 光在刀身外面一圈，刀身本身不被盖住） ---- */
function jlWeapon(c, L, A, im, s) {
  const col = L.jw; if (!col || !im) return;
  const z = ((L.m.S && L.m.S.res) || 1) / s, r = Math.max(2, Math.min(40, Math.round(3.2 * z / 2) * 2)), H = vanityHalo(im, col, r);
  const ox = (A.kind === 'pole' ? -A.tx : -A.gx) - H.p, oy = (A.kind === 'pole' ? -A.ty : -A.gy) - H.p, A0 = c.globalAlpha, pu = 0.8 + 0.2 * Math.sin(jlNow() * 9);
  c.save(); c.globalAlpha = A0 * 0.55 * pu; c.drawImage(H.ring, ox, oy); c.globalCompositeOperation = 'lighter'; c.globalAlpha = A0 * 0.7 * pu; c.drawImage(H.cv, ox, oy); c.restore();
}

/* ---- 组件 ---- */
// 鬼手：副手上几条火舌 + 一团柔光 + 往上飘的光点 / 往下滴的血
function jlArm(c, S, x, y, res, t) {
  const A0 = c.globalAlpha, n = S.n || 2;
  c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = A0 * S.a * 0.55; const R = 9 * res; c.drawImage(vanityDot(S.col), x - R, y - R, R * 2, R * 2);
  for (let j = 0; j < n; j++) {
    const h = S.h * res * (0.8 + 0.25 * Math.sin(t * 7 + j * 2.1)), fx = x + (j - (n - 1) / 2) * 5 * res, i = Math.floor(t * 12 + j * 2);
    c.globalCompositeOperation = 'source-over'; c.globalAlpha = A0 * S.a * 0.4; jlCell(c, 'jv_flame', S.col, i, fx, y + 5 * res, h, 1.25);
    c.globalCompositeOperation = 'lighter'; c.globalAlpha = A0 * S.a * 0.8; jlCell(c, 'jv_flame', S.col, i, fx, y + 5 * res, h, 1.25);
  }
  if (S.motes) {
    c.fillStyle = S.motes;
    for (let j = 0; j < 3; j++) { const u = (t * 0.8 + j / 3) % 1, px = x + Math.sin((t + j) * 3) * 5 * res, py = y - u * 30 * res, sz = (2.4 - 1.6 * u) * res; c.globalAlpha = A0 * (1 - u) * 0.9; c.fillRect(px - sz / 2, py - sz / 2, sz, sz); }
  }
  c.restore();
  if (S.drip) {   // 血：两滴交替往下落（正常混合，亮背景上也看得见）
    c.save(); c.fillStyle = S.drip;
    for (let j = 0; j < 2; j++) { const u = (t / 1.1 + j * 0.5) % 1, px = x + (j ? 3 : -3) * res, py = y + 4 * res + u * u * 30 * res, sz = 1.7 * res; c.globalAlpha = A0 * (1 - u) * 0.95; c.beginPath(); c.ellipse(px, py, sz * 0.75, sz * (1 + u), 0, 0, TAU); c.fill(); }
    c.restore();
  }
}
// 眼睛发光（红眼）：一团光 + 亮芯；移动时往后拖一道光带
function jlEyes(c, S, H, F, cls, e, res, t) {
  const o = JL_EYE[cls] || JL_EYE.sword, ca = Math.cos(H.a || 0), sa = Math.sin(H.a || 0);
  const px = H.x - F.ax + o[0] * ca - o[1] * sa, py = H.y - F.ay + o[0] * sa + o[1] * ca;
  const A0 = c.globalAlpha, pu = 0.8 + 0.2 * Math.sin(t * 5), R = S.r * res * pu;
  c.save();
  const sp = jlSpeed(e);
  if (S.trail && sp > 40 && e) {   // 往运动的反方向拖（后跳时拖向前）；先正常混合（亮背景上看得见）再叠加
    const dir = Math.sign((e.vx || 0) * (e.face || 1)) >= 0 ? -1 : 1, len = Math.min(64, 16 + sp * 0.12) * res, st = jlStreak(S.col);
    c.save(); c.translate(px, py); if (dir > 0) c.scale(-1, 1);
    c.globalAlpha = A0 * 0.75; c.drawImage(st, -len, -1.8 * res, len, 3.6 * res); c.globalCompositeOperation = 'lighter'; c.globalAlpha = A0 * 0.6; c.drawImage(st, -len, -1.8 * res, len, 3.6 * res); c.restore();
  }
  c.globalAlpha = A0 * 0.7 * pu; c.drawImage(vanityDot(S.col), px - R, py - R * 0.8, R * 2, R * 1.6);
  c.globalCompositeOperation = 'lighter'; c.globalAlpha = A0 * 0.8; c.drawImage(vanityDot(S.col), px - R * 1.4, py - R * 1.1, R * 2.8, R * 2.2);
  c.globalAlpha = A0; c.drawImage(vanityDot('#fff0e0'), px - R * 0.45, py - R * 0.35, R * 0.9, R * 0.7);
  c.restore();
}
// 身后的鬼影：自己的着色剪影，飘在身后，移动时拖远一点
function jlGhost(c, L, m, f, F, e, S, res, t) {
  const im = jlFrameIm(L, m, f); if (!im) return;
  const sil = jlSil(im, S.col), sp = jlSpeed(e), dx = -(14 + Math.min(24, sp * 0.06)) * res, dy = (-4 + Math.sin(t * 2.3) * 2.5) * res, A0 = c.globalAlpha;
  c.save(); c.translate(dx, dy); c.scale(1.05, 1.05);
  c.globalAlpha = A0 * S.a; c.drawImage(sil, -F.ax, -F.ay);
  c.globalCompositeOperation = 'lighter'; c.globalAlpha = A0 * S.a * 0.45; c.drawImage(sil, -F.ax, -F.ay);
  c.restore();
}
// 残影：移动时每 0.05 秒记一帧（位置 / 朝向 / 帧图），画最近 0.25 秒的
function jlTrail(c, L, m, f, F, e, S, res) {
  if (!e) return;
  const H = L.hist || (L.hist = []), now = game.t, last = H[H.length - 1];
  while (H.length && now - H[0].t > 0.25) H.shift();
  if (jlSpeed(e) > 60 && (!last || now - last.t >= 0.05)) { const im = jlFrameIm(L, m, f); if (im) H.push({ x: e.x, y: e.y, z: e.z || 0, dir: e.face * (e.drawFlip ? -1 : 1), im, F, t: now }); if (H.length > 6) H.shift(); }
  if (!H.length) return;
  const sc = e.scale || 1, dir = e.face * (e.drawFlip ? -1 : 1), Y0 = sy(e.y, e.z || 0), A0 = c.globalAlpha;
  c.save();
  for (const h of H) {
    const age = now - h.t; if (age < 0.02) continue;
    const xm = (h.x - e.x) * res / (dir * sc), ym = (sy(h.y, h.z) - Y0) * res / sc; if (Math.abs(xm) < 6 * res && Math.abs(ym) < 6 * res) continue;
    const sil = jlSil(h.im, S.col); c.globalAlpha = A0 * S.a * (1 - age / 0.25);
    if (h.dir !== dir) { c.save(); c.translate(xm, ym); c.scale(-1, 1); c.drawImage(sil, -h.F.ax, -h.F.ay); c.restore(); } else c.drawImage(sil, xm - h.F.ax, ym - h.F.ay);
  }
  c.restore();
}
// 环绕的鬼火：绕身体转，转到身后的那一半画在人物后面（back），另一半画在前面
function jlWisps(c, B, S, lv, res, t, back) {
  const n = S.n + lv, A0 = c.globalAlpha; c.save();
  for (let i = 0; i < n; i++) {
    const ph = t * 1.1 + i / n * TAU, d = Math.sin(ph); if ((d < 0) !== back) continue;
    const x = B.hx * 0.5 + Math.cos(ph) * (B.bw + 16 * res), y = B.hy * 0.55 + Math.sin(t * 2 + i * 1.7) * 6 * res + d * 5 * res, h = 20 * res * (0.85 + 0.15 * d);
    c.globalAlpha = A0 * (0.55 + 0.25 * d); jlCell(c, 'jv_wisp', S.col, i, x, y + h / 2, h);
  }
  c.restore();
}
// 全身燃烧：身后一圈着色轮廓（正常混合 + 叠加，亮背景也看得见）+ 沿身体两侧往上窜的火舌；身前再补几条小的，火是“裹着”人的
function jlBurn(c, B, S, lv, res, t, back, im, F) {
  const A0 = c.globalAlpha, k = lv > 1 ? 1.3 : 1, n = Math.round(S.n * (lv > 1 ? 1.5 : 1)), fl = 0.8 + 0.2 * Math.sin(t * 13);
  c.save();
  if (back) {
    const R = -B.hy * 0.75;   // 身后一团血雾
    c.globalAlpha = A0 * 0.22 * k; c.drawImage(vanityDot(S.col), B.hx * 0.5 - R * 0.62, B.hy * 0.5 - R, R * 1.24, R * 2);
    if (im) {
      const sil = jlSil(im, S.col, true), r = (1.6 + 0.7 * lv) * res;
      c.globalAlpha = A0 * (0.25 + 0.1 * lv) * fl; c.drawImage(sil, -F.ax, -F.ay - r);
      c.globalCompositeOperation = 'lighter';
      for (const [ox, oy] of [[-r, 0], [r, 0], [0, -r * 1.7], [-r * 0.7, -r * 1.2], [r * 0.7, -r * 1.2]]) { c.globalAlpha = A0 * (0.2 + 0.1 * lv) * fl; c.drawImage(sil, -F.ax + ox, -F.ay + oy); }
      c.globalCompositeOperation = 'source-over';
    }
  } else if (im) {   // 身上一层淡淡的血光（人还看得清）
    c.globalCompositeOperation = 'lighter'; c.globalAlpha = A0 * (0.1 + 0.05 * lv) * fl; c.drawImage(jlSil(im, S.col, true), -F.ax, -F.ay); c.globalCompositeOperation = 'source-over';
  }
  const m = back ? n + 3 : 4 + lv;
  for (let i = 0; i < m; i++) {
    let x, y, h;
    if (!back) { const u = 0.12 + i / m * 0.8, sd = i % 2 ? 1 : -1; x = B.hx * u + sd * B.bw * (0.85 - 0.2 * u); y = B.hy * u + S.h * res * 0.2; h = S.h * res * 0.7 * k * (0.8 + 0.3 * jlHash(i * 5.7 + Math.floor(t * 4))); }
    else if (i < n) { const u = (i + 0.5) / n, sd = i % 2 ? 1 : -1; x = B.hx * u + sd * B.bw * (1.15 - 0.3 * u) + (jlHash(i * 3.1) - 0.5) * 6 * res; y = B.hy * u * 0.9 + S.h * res * 0.35; h = S.h * res * k * (0.8 + 0.4 * jlHash(i * 7.3 + Math.floor(t * 3))); }
    else { const j = i - n; x = B.hx + (j - 1) * B.bw * 0.6; y = B.hy + 12 * res; h = S.h * res * k * (j === 1 ? 1.7 : 1.35) * (0.85 + 0.15 * Math.sin(t * 6 + i)); }   // 头顶 / 两肩三条大的
    const fi = Math.floor(t * 13 + i * 1.37), fa = 0.75 + 0.25 * Math.sin(t * 9 + i * 2.3);
    c.globalCompositeOperation = 'source-over'; c.globalAlpha = A0 * (back ? 0.6 : 0.35) * fa; jlCell(c, 'jv_flame', S.col, fi, x, y, h, 1.35);
    c.globalCompositeOperation = 'lighter'; c.globalAlpha = A0 * (back ? 0.55 : 0.4) * fa; jlCell(c, 'jv_flame', S.col, fi, x, y, h, 1.35);
  }
  c.restore();
}
// 出血命中的血花（狂战士的出血命中调用，class 文件里的视觉钩子）：几颗往外溅的血滴 + 一小团血雾；同一目标 0.15 秒内只溅一次
function jobFxBlood(t, dir = 1) {
  if (!t || (t._jlBloodT && game.t - t._jlBloodT < 0.15)) return; t._jlBloodT = game.t;
  const x = t.x, y = t.y, z = (t.z || 0) + (t.hurtH ? t.hurtH() * 0.6 : 40), seed = Math.random() * 99;
  addFx({ x, y: y + 1, z, dur: 0.45, draw(c) {
    const k = this.t / this.dur, X = sx(x), Y = sy(y, z); c.save();
    c.globalAlpha = (1 - k) * 0.5; c.fillStyle = '#7a0010'; c.beginPath(); c.ellipse(X, Y, 10 + 10 * k, 7 + 6 * k, 0, 0, TAU); c.fill();
    c.fillStyle = '#c0101c';
    for (let i = 0; i < 7; i++) {
      const a = -Math.PI / 2 + (jlHash(seed + i) - 0.5) * 2.4, v = 40 + 70 * jlHash(seed + i * 2.3), px = X + dir * Math.cos(a) * v * k * 0.9 + (jlHash(seed + i * 5) - 0.5) * 8, py = Y + Math.sin(a) * v * k + 90 * k * k;
      const r = (2.4 - 1.4 * k) * (0.7 + 0.6 * jlHash(seed + i * 9)); c.globalAlpha = 1 - k * k; c.beginPath(); c.arc(px, py, r, 0, TAU); c.fill();
    }
    c.restore(); } });
}
