/* =====================================================================
   转职外观渲染（数据在 content/avatar/job_looks.js，配方见 docs/JOB_VISUALS.md）
   外观层 AvatarLayer 调用：under → jlUnder（人物身后，最先画；无敌半透明在这里设 globalAlpha，SpriteModel.draw 的 save/restore 会还原）
                        over  → jlOver（人物身前）；weapon → jlWeapon（武器图坐标，画在武器图之前 = 光在刀身后面）
   组件（JL_COMP）：每个转职的常驻外观 = JOB_LOOKS 条目里的组件字段；状态特效 = states[i].fx 里的组件字段（强度 lv 放大）。
     同一个组件状态里也有时，状态的那份代替常驻的那份（例：元素师的小元素珠 → 元素点燃时的大元素珠）。画的顺序见 JL_ORDER。
   坐标 = 帧像素：原点 = 脚底锚点，人物朝右（朝左由实体整体翻转）；1 帧像素 = 1 / res 游戏像素（res 1.8），“身后” = -x，“上” = -y。
   锚点：头 F.head（每套时装自己的；没有头部锚点的帧按帧高估一个）；副手 F.oh 只写在原装帧里（时装帧按脚底锚点对齐，借用原装同名帧的）；武器手 = F.wpn 握点。
   实体：自己 = game.player；其他（队友影子、决斗 / AI 对手）按 e.model 在 ents 里找（每秒最多找一次）；UI 立绘、城镇其他玩家没有实体 → 只画常驻外观。
   性能（ARCHITECTURE 绘制规范）：不用 filter / shadowBlur，混合只用 source-over / lighter；着色剪影按（帧图, 颜色）缓存（最多 JL_SIL_MAX 张帧图），
   素材都是 fxTint 缓存过的图；常驻外观每人每帧约 4~10 次 drawImage，状态全开约 20~40 次。
   ===================================================================== */
FX_BASE_HUE.jv_flame = 22; FX_BASE_HUE.jv_wisp = 262;   // 素材本来的色相（fxTint 按它转到目标颜色）
const JL_STRIP = { jv_flame: 4, jv_wisp: 3 };            // 素材条的格数（art/tools/jobvis_art.py）
const JL_EYE = { sword: [15, 21] };                      // 眼睛相对头部锚点（帧像素，站姿朝右）
const jlNow = () => performance.now() / 1000;
const jlHash = n => { const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453; return s - Math.floor(s); };
// 颜色 / 素材参数可以是：值、数组（按编号轮流取）、函数 (e, i) → 值（按实体状态变色，例：弹药专家的属性）
const jlVal = (v, e, i = 0) => typeof v === 'function' ? v(e, i) : Array.isArray(v) ? v[i % v.length] : v;

// 素材条第 i 格，底边中点在 (x, y)，高 h（宽按格子比例 × wk）
function jlCell(c, name, col, i, x, y, h, wk = 1) {
  const img = fxTint(name, col); if (!img) return;
  const n = JL_STRIP[name] || 1, cw = img.width / n, w = h * cw / img.height * wk;
  c.drawImage(img, (i % n) * cw, 0, cw, img.height, x - w / 2, y - h, w, h);
}
// 取一张图：'weapon/<key>' / 'spr/<id>/<帧>' 直接取（没加载就按需加载），其他 = 特效素材 fx/<名字>（有颜色就换色）
function jlImg(name, col) {
  if (!name) return null;
  if (name.includes('/')) { const im = IMG[name]; if (!im && typeof loadArtKey === 'function') loadArtKey(name); return im || null; }
  return col ? fxTint(name, col) : IMG['fx/' + name] || null;
}
// 在 (x, y) 画一个小东西（中心对齐，高 h）：img = 素材名 | 'dot'（光球）| 'bubble'（泡泡）| 'cross'（十字）；S.add = 叠加混合，S.glow = 身后垫一团光
function jlSprite(c, img, col, x, y, h, S, rot = 0) {
  if (!img || img === 'dot') {
    c.save(); c.globalCompositeOperation = 'lighter'; c.drawImage(vanityDot(col || '#ffffff'), x - h * 1.6, y - h * 1.6, h * 3.2, h * 3.2);
    c.fillStyle = '#ffffff'; c.beginPath(); c.arc(x, y, h * 0.45, 0, TAU); c.fill(); c.restore(); return;
  }
  if (img === 'bubble') { c.save(); c.strokeStyle = col; c.lineWidth = h * 0.22; c.beginPath(); c.arc(x, y, h, 0, TAU); c.stroke(); c.fillStyle = col; c.globalAlpha *= 0.35; c.fill(); c.globalAlpha /= 0.35; c.fillStyle = '#ffffff'; c.beginPath(); c.arc(x - h * 0.35, y - h * 0.35, h * 0.25, 0, TAU); c.fill(); c.restore(); return; }
  if (img === 'cross') { c.save(); c.globalCompositeOperation = 'lighter'; c.drawImage(vanityDot(col), x - h * 1.5, y - h * 1.5, h * 3, h * 3); c.fillStyle = col; c.fillRect(x - h * 0.9, y - h * 0.3, h * 1.8, h * 0.6); c.fillRect(x - h * 0.3, y - h * 0.9, h * 0.6, h * 1.8); c.restore(); return; }
  const im = jlImg(img, col); if (!im) return;
  const w = h * im.width / im.height;
  if (S && S.glow) { c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha *= 0.6; c.drawImage(vanityDot(col || S.glow), x - h, y - h, h * 2, h * 2); c.restore(); }
  c.save(); if (S && S.add) c.globalCompositeOperation = 'lighter'; c.translate(x, y); if (rot) c.rotate(rot); c.drawImage(im, -w / 2, -h / 2, w, h); c.restore();
}
/* ---- 着色剪影缓存：flat = 纯色剪影（燃烧 / 气场的外轮廓），否则保留一点明暗（鬼影 / 残影） ---- */
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
// 每帧：确定转职（look.job > 实体的 kit.job）→ L.J；开着的状态 → L.jfx = [[fx, 强度], ...]；武器染色 → L.jw = { col, a }
function jlResolve(L) {
  const e = jlEnt(L), job = (L.look && L.look.job) || (e && e.kit && e.kit.job) || null;
  if (job !== L.jobId) {
    L.jobId = job; L.J = (job && JOB_LOOKS[job]) || null; L.hist = null;
    const J = L.J; if (J && J.acc) {   // look 里没带转职配件（AI 对手等）：这里补上
      if (J.noFace) L.acc = L.acc.filter(a => !a.face);
      for (const k of J.acc) { const a = AVATAR_ACC[k]; if (a && !L.acc.includes(a)) { L.acc.push(a); if (!IMG['avatar/' + a.img]) loadArtKey('avatar/' + a.img); } }
    }
  }
  const J = L.J, out = L.jfx || (L.jfx = []); out.length = 0; let w = J && J.wtint;
  if (J && J.states && e && !e.dead) for (const S of J.states) { const lv = S.on(e) || 0; if (lv > 0) { out.push([S.fx, lv]); if (S.fx.wtint) w = S.fx.wtint; } }
  w = w && jlVal(w, e); L.jw = !w ? null : typeof w === 'string' ? { col: w, a: 1 } : { col: jlVal(w.col, e), a: w.a ?? 1 };
  return e;
}
const jlSpeed = e => e ? Math.hypot(e.vx || 0, e.vy || 0) : 0;
function jlFrameIm(L, m, f) { const a = L.alt[f]; return (a && a.im) || m.img[f]; }
// 身体几何（帧像素，原点脚底）：头心 hx hy、半身宽 bw；没有头部锚点的帧（战斗服等）按帧高估：头心在顶上往下 20%
function jlBody(F, res) {
  const H = F.head || { x: F.ax, y: F.ay - F.h * 0.8, a: 0, f: 0 };
  const hx = H.x - F.ax, hy = H.y - F.ay; return { hx, hy, bw: Math.max(12 * res, -hy * 0.16), H };
}
// 一个组件在人物身上的锚点（帧像素）：head 头心、back 后背肩膀、waist 腰、hand 武器手（没有就后背）、feet 脚底
function jlAt(X, at) {
  const { B, F } = X;
  if (at === 'head') return [B.hx, B.hy];
  if (at === 'waist') return [B.hx * 0.6, B.hy * 0.42];
  if (at === 'feet') return [0, 0];
  if (at === 'hand' && F.wpn) return [F.wpn.gx - F.ax, F.wpn.gy - F.ay];
  return [B.hx * 0.7 - 6 * X.res, B.hy * 0.7];
}

/* ---- 组件表：back = 人物身后画，front = 身前画；X = 这一帧的上下文 ---- */
const JL_COMP = {
  ring: { back: (c, X, S, lv) => jlRing(c, X, S, lv) },
  trail: { back: (c, X, S) => jlTrail(c, X.L, X.m, X.f, X.F, X.e, S, X.res) },
  ghost: { back: (c, X, S) => jlGhost(c, X.L, X.m, X.f, X.F, X.e, S, X.res, X.t) },
  aura: { back: (c, X, S, lv) => jlAura(c, X, S, lv, true), front: (c, X, S, lv) => jlAura(c, X, S, lv, false) },
  prop: { back: (c, X, S) => jlProps(c, X, S, true), front: (c, X, S) => jlProps(c, X, S, false) },
  pet: { back: (c, X, S) => !S.front && jlPet(c, X, S), front: (c, X, S) => S.front && jlPet(c, X, S) },
  spirit: { back: (c, X, S) => jlSpirit(c, X, S) },
  burn: { back: (c, X, S, lv) => jlBurn(c, X.B, S, lv, X.res, X.t, true, X.im, X.F), front: (c, X, S, lv) => jlBurn(c, X.B, S, lv, X.res, X.t, false, X.im, X.F) },
  orbit: { back: (c, X, S, lv) => jlOrbit(c, X, S, lv, true), front: (c, X, S, lv) => jlOrbit(c, X, S, lv, false) },
  wisps: { back: (c, X, S, lv) => jlWisps(c, X.B, S, lv, X.res, X.t, true), front: (c, X, S, lv) => jlWisps(c, X.B, S, lv, X.res, X.t, false) },
  motes: { back: (c, X, S, lv) => jlMotes(c, X, S, lv, true), front: (c, X, S, lv) => jlMotes(c, X, S, lv, false) },
  arcs: { front: (c, X, S, lv) => jlArcs(c, X, S, lv) },
  arm: { front: (c, X, S) => { const base = SPR_DATA[X.L.cls] && SPR_DATA[X.L.cls].frames[X.f], oh = base && base.oh; if (oh) jlArm(c, S, oh[0] - base.ax, oh[1] - base.ay, X.res, X.t); } },
  eyes: { front: (c, X, S) => { if (X.B.H.f !== 0) jlEyes(c, S, X.B.H, X.F, X.L.cls, X.e, X.res, X.t); } },
};
const JL_ORDER = ['ring', 'trail', 'ghost', 'aura', 'prop', 'pet', 'spirit', 'burn', 'orbit', 'wisps', 'motes', 'arcs', 'arm', 'eyes'];
// 这一帧要画的组件 [[名字, 参数, 强度]]：状态里有的用状态的，没有的用常驻的
function jlList(L) {
  const J = L.J, out = L.jlist || (L.jlist = []); out.length = 0;
  for (const k of JL_ORDER) {
    let hit = false;
    for (const [fx, lv] of L.jfx) if (fx[k]) { out.push([k, fx[k], lv]); hit = true; }
    if (!hit && J[k]) out.push([k, J[k], 1]);
  }
  return out;
}

/* ---- 人物身后 ---- */
function jlUnder(c, L, m, f, F) {
  const e = jlResolve(L), J = L.J; if (!J) return;
  const res = (m.S && m.S.res) || 1, t = jlNow() + (L.seed ??= Math.random() * 9), A0 = c.globalAlpha;
  const X = L.jx || (L.jx = {}); Object.assign(X, { L, m, f, F, e, res, t, B: jlBody(F, res), im: jlFrameIm(L, m, f) });
  for (const [k, S, lv] of jlList(L)) { const C = JL_COMP[k]; if (C.back) C.back(c, X, S, lv); }
  if (J.draw) J.draw(c, L, F, f, true, e);
  let fade = null; for (const [fx] of L.jfx) if (fx.fade && e && e.invul > 0) fade = fx.fade;
  if (fade) { L.faded = fade; c.globalAlpha = A0 * (fade.a + 0.08 * Math.sin(t * 38)); } else L.faded = null;   // 无敌：本体半透明（微微闪烁）
}
/* ---- 人物身前 ---- */
function jlOver(c, L, m, f, F) {
  const J = L.J, X = L.jx; if (!J || !X || X.F !== F) return;
  if (L.faded) {   // 无敌半透明时身上一层鬼火微光
    c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha *= 0.35 + 0.15 * Math.sin(X.t * 20); c.drawImage(jlSil(X.im, L.faded.col), -F.ax, -F.ay); c.restore();
  }
  for (const [k, S, lv] of L.jlist) { const C = JL_COMP[k]; if (C.front) C.front(c, X, S, lv); }
  if (J.draw) J.draw(c, L, F, f, false, X.e);
}
/* ---- 武器光（武器图坐标；画在武器图之前 = 光在刀身外面一圈，刀身本身不被盖住） ---- */
function jlWeapon(c, L, A, im, s) {
  const W = L.jw; if (!W || !im) return;
  const z = ((L.m.S && L.m.S.res) || 1) / s, r = Math.max(2, Math.min(40, Math.round(3.2 * z / 2) * 2)), H = vanityHalo(im, W.col, r);
  const ox = (A.kind === 'pole' ? -A.tx : -A.gx) - H.p, oy = (A.kind === 'pole' ? -A.ty : -A.gy) - H.p, A0 = c.globalAlpha, pu = 0.8 + 0.2 * Math.sin(jlNow() * 9);
  c.save(); c.globalAlpha = A0 * Math.min(1, 0.55 * W.a) * pu; c.drawImage(H.ring, ox, oy); c.globalCompositeOperation = 'lighter'; c.globalAlpha = A0 * Math.min(1, 0.7 * W.a) * pu; c.drawImage(H.cv, ox, oy); c.restore();
}

/* ---- 新组件 ---- */
// 身后的小鬼神（jv_wisp）：飘在后背肩膀上方，慢慢上下浮动
function jlSpirit(c, X, S) {
  const { B, res, t } = X, A0 = c.globalAlpha, bob = Math.sin(t * 1.6) * 3 * res, x = B.hx - 24 * res + Math.sin(t * 0.9) * 2 * res, y = B.hy + 26 * res + bob;
  c.save(); c.globalAlpha = A0 * S.a; jlCell(c, 'jv_wisp', S.col, 0, x, y, S.h * res); c.globalCompositeOperation = 'lighter'; c.globalAlpha = A0 * S.a * 0.5; jlCell(c, 'jv_wisp', S.col, 0, x, y, S.h * res); c.restore();
}
// 环绕：n 个小东西绕身体转（水平椭圆，转到身后的一半画在人物后面）；side: 'back' = 全部画在身后（背后悬着的光剑）
//   { img, col, n, nLv（每级多几个）, h 大小, hLv, rx ry 轨道半径, y 高度（头心高度的比例，1 = 头心）, x 水平偏移, spd, a, add, glow }
function jlOrbit(c, X, S, lv, back) {
  const { B, res, t, e } = X, n = (S.n ?? 3) + (S.nLv || 0) * (lv - 1); if (n <= 0) return;
  if (S.side === 'back' && !back) return;
  const rx = (S.rx ?? 26) * res, ry = (S.ry ?? 7) * res, cx = B.hx * 0.5 + (S.x || 0) * res, cy = B.hy * (S.y ?? 0.55), h = (S.h ?? 10) * res * (1 + (S.hLv || 0) * (lv - 1)), A0 = c.globalAlpha;
  c.save();
  for (let i = 0; i < n; i++) {
    const a = t * (S.spd ?? 1.2) + i / n * TAU, d = Math.sin(a); if (S.side !== 'back' && (d < 0) !== back) continue;
    const k = 0.82 + 0.18 * d, x = cx + Math.cos(a) * rx, y = cy + d * ry + Math.sin(t * 2 + i * 1.3) * 2 * res;
    c.globalAlpha = A0 * (S.a ?? 1) * (0.72 + 0.28 * d);
    jlSprite(c, jlVal(S.img, e, i), jlVal(S.col, e, i), x, y, h * k, S);
  }
  c.restore();
}
// 身上的道具（背后的重炮 / 扫把 / 喷射翼、头上的蔷薇…）：[{ img, at（锚点，见 jlAt）, x, y 偏移（游戏像素）, h 长度, ang 转角, a, front 1 = 画在身前, noWpn 手里拿着这种武器时不画 }]
function jlProps(c, X, list, back) {
  const { res, L } = X, A0 = c.globalAlpha;
  for (const P of list) {
    if (!!P.front === back || (P.noWpn && L.A && L.A.type === P.noWpn)) continue;
    const im = jlImg(P.img, P.col); if (!im) continue;
    const [ax, ay] = jlAt(X, P.at || 'back'), w = P.h * res, h = w * im.height / im.width;
    c.save(); c.globalAlpha = A0 * (P.a ?? 1); c.translate(ax + (P.x || 0) * res, ay + (P.y || 0) * res); if (P.ang) c.rotate(P.ang); c.drawImage(im, -w / 2, -h / 2, w, h); c.restore();
  }
}
// 小伙伴（精灵帧）：{ spr 精灵名, idle 站着的帧（默认 idle）, hide(e) 这时不画, tint 着色成魂魄, h 高（游戏像素）, x y 相对脚底（at: 'hand' = 相对武器手）, fly 上下浮动, hop 走动时蹦跳, move [走动的帧], a, front, strings 丝线颜色（从手连到它头上） }
function jlPet(c, X, S) {
  const { res, t, e, L } = X, D0 = SPR_DATA[S.spr]; if (!D0) return;
  const f0 = S.idle || 'idle'; if (!IMG[`spr/${S.spr}/${f0}`]) { if (!S._req) { S._req = 1; loadBundles(['spr:' + S.spr]); } return; }
  if (S.hide && e && S.hide(e)) return;
  const moving = jlSpeed(e) > 30, f = moving && S.move ? S.move[Math.floor(t * 10) % S.move.length] : f0, D = D0.frames[f] || D0.frames[f0], im = IMG[`spr/${S.spr}/${f}`] || IMG[`spr/${S.spr}/${f0}`];
  const k = S.h * res / D.h, [ax, ay] = S.at ? jlAt(X, S.at) : [0, 0];
  const bob = S.fly ? Math.sin(t * 2.2) * S.fly * res : S.hop && moving ? -Math.abs(Math.sin(t * 9)) * 3 * res : 0;
  const x = ax + (S.x || 0) * res - (moving && !S.at ? 6 * res : 0), y = ay + (S.y || 0) * res + bob;
  if (S.strings) {   // 提线：从手拉三根线到人偶头上（人偶在下面晃）
    c.save(); c.strokeStyle = S.strings; c.lineWidth = 1 * res; c.globalAlpha *= 0.9;
    for (const dx of [-0.25, 0, 0.25]) { c.beginPath(); c.moveTo(ax + dx * 4 * res, ay); c.lineTo(x + dx * D.w * k * 0.7, y - D.ay * k + D.h * k * 0.12); c.stroke(); }
    c.restore();
  }
  const src = S.tint ? jlSil(im, S.tint) : im;   // tint：着色成半透明的魂魄（剑影的幻鬼）
  c.save(); c.globalAlpha *= S.a ?? 1; if (S.add) c.globalCompositeOperation = 'lighter'; c.drawImage(src, x - D.ax * k, y - D.ay * k, D.w * k, D.h * k);
  if (S.tint) { c.globalCompositeOperation = 'lighter'; c.globalAlpha *= 0.35; c.drawImage(src, x - D.ax * k, y - D.ay * k, D.w * k, D.h * k); }
  c.restore();
}
// 地上的法阵 / 波纹：img 有 = 平躺旋转的法阵素材；没有 = 一圈圈往外扩散的椭圆波纹；upright = 竖在背后的法阵（魔法书）
//   { img, col, r 半径（游戏像素）, rLv, spin, a, n 波纹圈数, spd }
function jlRing(c, X, S, lv) {
  const { res, t, B, e } = X, R = (S.r ?? 40) * res * (1 + (S.rLv || 0) * (lv - 1)), a = (S.a ?? 0.6) * (0.85 + 0.15 * Math.sin(t * 3)), col = jlVal(S.col, e);
  if (S.upright) { const im = jlImg(S.img, col); if (im) drawSpr(c, im, B.hx * 0.3 - 10 * res, B.hy * 0.62, R * 2, R * 2, { rot: t * (S.spin ?? 0.5), alpha: a }); return; }
  if (S.img) { const im = jlImg(S.img, col); if (im) drawSpr(c, im, 0, 0, R * 2, R * 0.7, { ground: true, rot: t * (S.spin ?? 0.6), alpha: a }); return; }
  const n = S.n || 3, A0 = c.globalAlpha;
  c.save(); c.strokeStyle = col;
  for (let k = 0; k < n; k++) {
    const u = (t * (S.spd || 0.8) + k / n) % 1, r = R * (0.3 + 0.7 * u);
    c.globalCompositeOperation = 'source-over'; c.globalAlpha = A0 * a * (1 - u) * 0.6; c.lineWidth = (2.6 - 1.6 * u) * res; c.beginPath(); c.ellipse(0, 0, r, r * 0.3, 0, 0, TAU); c.stroke();
    c.globalCompositeOperation = 'lighter'; c.globalAlpha = A0 * a * (1 - u); c.stroke();
  }
  c.restore();
}
// 飘动的小颗粒（花瓣、泡泡、火星、十字…）：{ img, col, n, nLv, h 大小, rise 每轮上升多少（负数 = 往下飘）, life 一轮秒数, y0 起始高度（头心高度的比例；不写 = 随机）, spread 横向范围, a, spin 旋转, grow 越飘越大 }
function jlMotes(c, X, S, lv, back) {
  const { B, res, t, e } = X, n = (S.n ?? 5) + (S.nLv || 0) * (lv - 1), life = S.life || 1.6, A0 = c.globalAlpha, h = (S.h ?? 6) * res;
  c.save();
  for (let i = 0; i < n; i++) {
    if ((i % 2 === 0) !== back) continue;
    const q = t / life + i / n, cyc = Math.floor(q), u = q - cyc, h1 = jlHash(i * 3.7 + cyc * 1.3), h2 = jlHash(i * 9.1 + cyc * 2.9);
    const x = B.hx * 0.5 + (h1 - 0.5) * (B.bw * 2 + (S.spread ?? 20) * res) + Math.sin(u * 5 + i) * 3 * res;
    const y = B.hy * (S.y0 ?? 0.15 + 0.7 * h2) - u * (S.rise ?? 24) * res;
    c.globalAlpha = A0 * (S.a ?? 0.9) * Math.sin(u * Math.PI);
    jlSprite(c, jlVal(S.img, e, i), jlVal(S.col, e, i), x, y, h * (S.grow ? 0.6 + 0.7 * u : 1 - 0.3 * u), S, S.spin ? (u * 4 + i) * S.spin : 0);
  }
  c.restore();
}
// 身上的电光：几道闪电沿身体外沿跳动（每秒换 12 次形状）：{ col, n }
function jlArcs(c, X, S, lv) {
  const { B, res, t, e } = X, n = (S.n ?? 2) + (lv - 1), sd = Math.floor(t * 12), cx = B.hx * 0.5, cy = B.hy * 0.52, rx = B.bw * 1.6, ry = -B.hy * 0.52, A0 = c.globalAlpha, col = jlVal(S.col, e);
  c.save(); c.globalCompositeOperation = 'lighter'; c.lineJoin = 'round';
  for (let k = 0; k < n; k++) {
    if (jlHash(sd * 1.7 + k * 5.3) < 0.25) continue;
    const a0 = jlHash(sd + k * 7.1) * TAU, a1 = a0 + 0.7 + jlHash(sd * 2.1 + k) * 1.1;
    c.beginPath();
    for (let i = 0; i <= 6; i++) { const a = a0 + (a1 - a0) * i / 6, j = (jlHash(sd * 3.3 + k * 11 + i) - 0.5) * 10 * res * (i && i < 6 ? 1 : 0), x = cx + Math.cos(a) * (rx + j), y = cy + Math.sin(a) * (ry + j); if (i) c.lineTo(x, y); else c.moveTo(x, y); }
    c.globalAlpha = A0 * 0.75; c.strokeStyle = col; c.lineWidth = 2.6 * res; c.stroke();
    c.globalAlpha = A0 * 0.95; c.strokeStyle = '#ffffff'; c.lineWidth = 0.9 * res; c.stroke();
  }
  c.restore();
}
// 气场：身后一团光雾 + 一圈着色外轮廓；身前一层很淡的着色（人还看得清）：{ col, a 外轮廓, haze 光雾, r 外轮廓粗细, tint 身上的着色 }
function jlAura(c, X, S, lv, back) {
  const { B, res, t, im, F, e } = X; if (!im) return;
  const A0 = c.globalAlpha, col = jlVal(S.col, e), fl = 0.85 + 0.15 * Math.sin(t * (S.pulse || 4));
  c.save();
  if (back) {
    const R = -B.hy * 0.72; c.globalAlpha = A0 * (S.haze ?? 0.25) * fl; c.drawImage(vanityDot(col), B.hx * 0.5 - R * 0.62, B.hy * 0.5 - R, R * 1.24, R * 2);
    const sil = jlSil(im, col, true), r = (S.r ?? 2) * res * (1 + 0.3 * (lv - 1)), a = (S.a ?? 0.35) * fl;
    c.globalAlpha = A0 * a; c.drawImage(sil, -F.ax, -F.ay - r * 0.6);
    c.globalCompositeOperation = 'lighter';
    for (const [ox, oy] of [[-r, 0], [r, 0], [0, -r], [0, r * 0.5]]) { c.globalAlpha = A0 * a * 0.8; c.drawImage(sil, -F.ax + ox, -F.ay + oy); }
  } else { c.globalCompositeOperation = 'lighter'; c.globalAlpha = A0 * (S.tint ?? 0.1) * fl; c.drawImage(jlSil(im, col, true), -F.ax, -F.ay); }
  c.restore();
}

/* ---- 原有组件 ---- */
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
