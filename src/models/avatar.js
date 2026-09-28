/* =====================================================================
   外观合成（外观与换装组）：武器按轨迹叠加、时装整套换帧、头部配件叠加
   - 角色帧里的武器已抠掉，每帧的武器轨迹在 SPR_DATA[职业].frames[帧].wpn / wpn2（art/tools/avatar_frames.py 生成）：
       { gx, gy 握点, ang 握点→尖端方向（弧度）, len 可见长度, front 1 身前 / 0 身后, hand [[x,y,…]] 握拳轮廓 }
     身后的武器画在帧之前；身前的画在帧之后，再把握拳那块像素盖回去，做出“手握住武器”的效果。
     没有 wpn 的帧照旧（武器画死在帧里，或本来就没拿武器）。
   - 时装：SPR_DATA['<职业>@<套装>'] 同名帧整套替换（按需加载分包 spr:<职业>@<套装>，没加载完先用原帧）。
   - 头部配件：帧里的 head 锚点 { x, y 头部中心, a 转角, f: 0 = 脸被挡住（不画眼镜）}（art/tools/avatar_head.py 生成），IMG['avatar/<图>'] 按锚点叠加。
   用法：每个职业精灵模型（SpriteModel）第一次画的时候自动挂一个外观层 m.av：
     - 是玩家的模型 → 跟随 inv.equip（换装后下一帧就变）
     - 其他（路人、决斗对手、选角预览）→ 职业默认外观；想指定就 avatarSetLook(model, look)
   外观 look = { wpn: 武器图 key | null, set: 套装 id | null, acc: [配件物品 key] }（见 content/avatar/looks.js）
   性能：每帧只多 1 次 drawImage + 变换（身前武器再多 1 次握拳小图）；换装 / 首次用到某帧时才分配对象。
   ===================================================================== */
const AVATAR_CLS = { sword: 1, gun: 1, mage: 1 };
class AvatarLayer {
  constructor(m) {
    this.m = m; this.cls = m.key; this.fixed = null; this.look = null; this.own = null; this.sig = [];
    this.A = null; this.wim = null; this.setKey = null; this.S2 = null; this.alt = {}; this.hands = {}; this.acc = [];
  }
  // 当前外观：指定外观 > 玩家装备 > 职业默认
  sync() {
    if (this.fixed) { if (this.look !== this.fixed) this.apply(this.fixed); return; }
    const p = typeof game !== 'undefined' && game.player, own = !!(p && p.model === this.m);
    if (own) {
      const e = inv.equip, s = this.sig;
      if (this.own && s[0] === e.weapon && s[1] === e.av_top && s[2] === e.av_bottom && s[3] === e.av_hat && s[4] === e.av_hair && s[5] === e.av_face && s[6] === e.av_weapon && s[7] === e.av_shoes && s[8] === e) return;
      this.sig = [e.weapon, e.av_top, e.av_bottom, e.av_hat, e.av_hair, e.av_face, e.av_weapon, e.av_shoes, e];
      this.own = true; this.apply(lookFromEquip(this.cls, e)); return;
    }
    if (this.own === false && this.look) return;
    this.own = false; this.apply(defaultLook(this.cls));
  }
  apply(look) {
    this.look = look;
    this.A = look.wpn && WEAPON_IMG[look.wpn] || null; this.wim = this.A ? IMG['weapon/' + look.wpn] : null;
    if (this.A && !this.wim) { const k = 'weapon/' + look.wpn; loadArtKey(k).then(() => { if (this.look === look) this.wim = IMG[k] || null; }); }
    const sk = look.set ? `${this.cls}@${look.set}` : null;
    if (sk !== this.setKey) {
      this.setKey = sk; this.S2 = null; this.alt = {}; this.hands = {};
      if (sk && SPR_DATA[sk]) {
        const ready = () => { if (this.setKey === sk) { this.S2 = SPR_DATA[sk]; this.alt = {}; this.hands = {}; } };
        if (IMG[`spr/${sk}/idle`]) ready(); else loadBundles(['spr:' + sk]).then(ready);
      }
    }
    // 混搭：三段各用哪套（null = 职业默认）；需要的帧集分包都加载上，加载完之前先按整套 / 默认画
    const P = look.parts || null;
    this.parts = P; this.mixKey = P ? `${P.up || ''}|${P.low || ''}|${P.feet || ''}` : null; this.alt = {}; this.hands = {};
    if (P) {
      const need = [...new Set([P.up, P.low, P.feet].filter(Boolean))].filter(id => !IMG[`spr/${this.cls}@${id}/idle`]).map(id => `spr:${this.cls}@${id}`);
      if (need.length) { const mk = this.mixKey; loadBundles(need).then(() => { if (this.mixKey === mk) { this.alt = {}; this.hands = {}; } }); }
    }
    this.acc = (look.acc || []).map(k => AVATAR_ACC[k]).filter(Boolean);
    for (const a of this.acc) if (!IMG['avatar/' + a.img]) loadArtKey('avatar/' + a.img);
  }
  // 钩子：换帧来源（时装）
  frame(m, f) {
    this.sync();
    const r = this.alt[f]; if (r !== undefined) return r;
    if (this.parts) { const c = avatarMix(m, this.cls, f, this.parts); if (c) return (this.alt[f] = c); if (c === undefined) return null; }   // undefined = 素材还没加载完，下次再拼
    if (!this.S2) return (this.alt[f] = null);
    const F = this.S2.frames[f], im = F && IMG[`spr/${this.setKey}/${f}`];
    return (this.alt[f] = im ? { F, im } : null);
  }
  // 钩子：帧之前（身后的武器、后脑的发饰）
  under(c, m, f, F) {
    const w = F.wpn, w2 = F.wpn2;
    if (w2 && !w2.front && this.dual()) this.weapon(c, w2, F);
    if (w && !w.front) this.weapon(c, w, F);
    if (F.head && this.acc.length) this.accessories(c, F, true, f);
  }
  // 钩子：帧之后（身前的武器 + 握拳、头部配件）
  over(c, m, f, F) {
    const w = F.wpn, w2 = F.wpn2;
    if (w && w.front) { this.weapon(c, w, F); if (w.hand && this.wim) this.hand(c, m, f, F, w, 0); }
    if (w2 && w2.front && this.dual()) { this.weapon(c, w2, F); if (w2.hand && this.wim) this.hand(c, m, f, F, w2, 1); }
    if (F.head && this.acc.length) this.accessories(c, F, false, f);
  }
  dual() { return !!this.A && this.A.dual !== 0; }   // 双枪帧的副手：长枪 / 手炮 / 手弩不画（副手空着）
  weapon(c, w, F) {
    const A = this.A, im = this.wim; if (!A || !im) return;
    const s = A.size / (A.tx - A.gx), fy = Math.cos(w.ang) < -0.05 ? -s : s;   // 朝左时上下翻转，武器的“上面”保持朝上
    c.save(); c.translate(w.gx - F.ax, w.gy - F.ay); c.rotate(w.ang);
    if (A.kind === 'pole') {   // 长杆：杖头对准棍子的尖端；只画到占位棍在握点另一侧露出的长度（被身体挡住 / 画师本来就没画出来的那截不画）
      c.translate(w.len, 0); c.scale(s, fy);
      const x0 = w.bk === undefined ? 0 : Math.max(0, A.tx - (w.len + w.bk + 6) / s);
      if (x0 > 0) c.drawImage(im, x0, 0, A.w - x0, A.h, x0 - A.tx, -A.ty, A.w - x0, A.h); else c.drawImage(im, -A.tx, -A.ty);
    }
    else { c.scale(s, fy); c.drawImage(im, -A.gx, -A.gy); }
    c.restore();
  }
  // 握拳那块像素（按轮廓从当前帧图里剪出来，第一次用到时生成并缓存）盖在武器上
  hand(c, m, f, F, w, i) {
    const key = i ? f + '|2' : f; let h = this.hands[key];
    if (h === undefined) {
      const im = this.alt[f] ? this.alt[f].im : m.img[f];
      h = this.hands[key] = im ? avatarCutHand(im, w.hand) : null;
    }
    if (h) c.drawImage(h.cv, h.x - F.ax, h.y - F.ay);
  }
  accessories(c, F, back, f0) {
    const H = F.head;
    for (const a of this.acc) {
      if (!!a.back !== back || (a.face && H.f === 0)) continue;
      const up = this.alt[f0] && this.alt[f0].up, costume = up !== undefined ? !!up : !!this.S2;   // 头来自哪套（混搭时 = 上身那套）
      const im = IMG['avatar/' + a.img], P = (costume && (a.pos[`${this.cls}@${up || this.setKey && this.setKey.split('@')[1]}`] || a.pos[this.cls + '@'])) || a.pos[this.cls]; if (!im || !P) continue;
      c.save(); c.translate(H.x - F.ax, H.y - F.ay); if (H.a) c.rotate(H.a); c.translate(P[0], P[1]); if (P[2]) c.rotate(P[2]);
      const k = AVATAR_ACC_SCALE * (P[3] || 1); c.scale(k, k); c.drawImage(im, -im.width / 2, -im.height / 2); c.restore();
    }
  }
}
/* ---- 混搭拼帧：按原装帧的分割线（F.cut：腰线 + 脚踝线，垂直于身体轴）把上身 / 下身 / 脚三段拼成一张，接缝处羽化 FEATHER 像素 ----
   只在第一次用到（帧 × 搭配）时拼一次，缓存成一张画布（全局 LRU，最多 MIX_MAX 张），之后每帧还是一次 drawImage。
   各套时装帧都已按脚底锚点对齐到原装同名帧（art/tools/avatar_align.py），所以同一条分割线换算到各套里是同一个位置。
   返回 { F, im, up }；这一帧没有分割线（躺地 / 翻滚等）返回 null（调用方整套用 look.set）；素材没加载完返回 undefined。 */
const MIX_CACHE = new Map(), MIX_MAX = 160, FEATHER = 6;
function avatarMix(m, cls, f, P) {
  const key = `${cls}|${f}|${P.up || ''}|${P.low || ''}|${P.feet || ''}|${m.o.hue || 0}`;
  const hit = MIX_CACHE.get(key); if (hit) { MIX_CACHE.delete(key); MIX_CACHE.set(key, hit); return hit; }
  const B = SPR_DATA[cls].frames[f], cut = B && B.cut; if (!cut) return null;
  const part = id => { if (!id) return m.img[f] ? { F: B, im: m.img[f] } : null; const F = SPR_DATA[`${cls}@${id}`].frames[f], im = IMG[`spr/${cls}@${id}/${f}`]; return F && im ? { F, im } : null; };
  // 三段，相邻同一套的合并（少一条接缝）
  const segs = [];
  for (const [id, lo, hi] of [[P.up, -1e9, 0], [P.low, 0, cut.kd], [P.feet, cut.kd, 1e9]]) {
    const L = segs[segs.length - 1];
    if (L && L.id === id) L.hi = hi; else segs.push({ id, lo, hi });
  }
  const got = segs.map(g => part(g.id)); if (got.some(x => !x)) return undefined;
  // 画布：所有段按脚底锚点对齐
  let l = 0, r = 0, t = 0, b = 0;
  for (const { F } of got) { l = Math.max(l, F.ax); r = Math.max(r, F.w - F.ax); t = Math.max(t, F.ay); b = Math.max(b, F.h - F.ay); }
  const W = Math.ceil(l + r), H = Math.ceil(t + b), AX = l, AY = t;
  const [cv, x] = offCanvas(W, H);
  const ux = Math.sin(cut.a), uy = Math.cos(cut.a), wx = cut.wx - B.ax + AX, wy = cut.wy - B.ay + AY, RG = 600;   // 腰线上的点（画布坐标）
  const at = d => (d + RG) / (2 * RG);   // 沿身体轴离腰线 d 像素 → 渐变位置
  for (let i = got.length - 1; i >= 0; i--) {   // 从脚往上画：上面的段盖住下面的段（上衣下摆压在裤子上）
    const g = segs[i], { F, im } = got[i];
    const [lc, lx] = offCanvas(W, H); lx.drawImage(im, AX - F.ax, AY - F.ay);
    const gr = lx.createLinearGradient(wx - ux * RG, wy - uy * RG, wx + ux * RG, wy + uy * RG);
    const lo = g.lo - FEATHER, hi = g.hi + FEATHER;   // 上边界往上多留一点（被上一段盖住），下边界羽化
    if (g.lo > -1e8) { gr.addColorStop(Math.max(0, at(lo) - 1e-4), 'rgba(0,0,0,0)'); gr.addColorStop(at(lo), 'rgba(0,0,0,1)'); } else gr.addColorStop(0, 'rgba(0,0,0,1)');
    if (g.hi < 1e8) { gr.addColorStop(at(g.hi - FEATHER), 'rgba(0,0,0,1)'); gr.addColorStop(at(hi), 'rgba(0,0,0,0)'); } else gr.addColorStop(1, 'rgba(0,0,0,1)');
    lx.globalCompositeOperation = 'destination-in'; lx.fillStyle = gr; lx.fillRect(0, 0, W, H);
    if (i > 0) avatarDropBits(lx, W, H);   // 下身 / 脚：切下来的碎块（翅膀尖、披风角）去掉
    x.drawImage(lc, 0, 0); lc.width = lc.height = 0;
  }
  // 帧数据：锚点 = 画布锚点；武器轨迹 / 头部锚点来自上身那段（手和头都在上身）
  const U = got[0].F, sh = (o, dx, dy) => o && { ...o, x: o.x + dx, y: o.y + dy };
  const dx = AX - U.ax, dy = AY - U.ay, mv = w => w && { ...w, gx: w.gx + dx, gy: w.gy + dy, hand: w.hand && w.hand.map(p => p.map((v, j) => v + (j % 2 ? dy : dx))) };
  const F = { w: W, h: H, ax: AX, ay: AY, wpn: mv(U.wpn), wpn2: mv(U.wpn2), head: sh(U.head, dx, dy) };
  const res = { F, im: cv, up: P.up };
  MIX_CACHE.set(key, res);
  if (MIX_CACHE.size > MIX_MAX) { const k0 = MIX_CACHE.keys().next().value, o = MIX_CACHE.get(k0); MIX_CACHE.delete(k0); if (o.im.width) o.im.width = o.im.height = 0; }
  return res;
}
// 一段里和主体不相连、又很小（< 最大块的 15%）的碎块去掉：例如下身那套背后的翅膀，腰线以下露出来的翅膀尖会漂在半空
// （只在拼帧时做一次；读像素失败（跨域）就不处理）
function avatarDropBits(x, W, H) {
  let d; try { d = x.getImageData(0, 0, W, H); } catch (e) { return; }
  const a = d.data, lab = new Int32Array(W * H), sizes = [0], st = [];
  for (let p = 0; p < W * H; p++) {
    if (lab[p] || a[p * 4 + 3] < 40) continue;
    const id = sizes.length; let n = 0; lab[p] = id; st.push(p);
    while (st.length) {
      const q = st.pop(); n++; const qx = q % W, qy = (q - qx) / W;
      for (const r of [qx > 0 ? q - 1 : -1, qx < W - 1 ? q + 1 : -1, qy > 0 ? q - W : -1, qy < H - 1 ? q + W : -1]) if (r >= 0 && !lab[r] && a[r * 4 + 3] >= 40) { lab[r] = id; st.push(r); }
    }
    sizes.push(n);
  }
  const big = Math.max(...sizes); if (sizes.length <= 2) return;
  let hit = false;
  for (let p = 0; p < W * H; p++) { const id = lab[p]; if (id && sizes[id] < big * 0.15) { a[p * 4 + 3] = 0; hit = true; } }
  if (hit) x.putImageData(d, 0, 0);
}
function avatarCutHand(im, polys) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const P of polys) for (let j = 0; j < P.length; j += 2) { x0 = Math.min(x0, P[j]); x1 = Math.max(x1, P[j]); y0 = Math.min(y0, P[j + 1]); y1 = Math.max(y1, P[j + 1]); }
  x0 = Math.floor(x0); y0 = Math.floor(y0); const w = Math.ceil(x1) - x0 + 1, h = Math.ceil(y1) - y0 + 1;
  if (!(w > 0 && h > 0)) return null;
  const [cv, x] = offCanvas(w, h);
  x.beginPath();
  for (const P of polys) { x.moveTo(P[0] - x0, P[1] - y0); for (let j = 2; j < P.length; j += 2) x.lineTo(P[j] - x0, P[j + 1] - y0); x.closePath(); }
  x.clip(); x.drawImage(im, -x0, -y0);
  return { cv, x: x0, y: y0 };
}
// 单个素材按键加载（武器图、配件图都在 core 包里，一般启动时就有了；这里兜底）
function loadArtKey(k) {
  if (IMG[k] || !ASSET_SRC[k]) return Promise.resolve();
  return bundleLoads[k] || (bundleLoads[k] = new Promise(res => { const im = new Image(); im.onload = () => { IMG[k] = im; res(); }; im.onerror = () => res(); im.src = ASSET_SRC[k]; }));
}
// 职业精灵模型第一次读 m.av 时自动挂上外观层（怪物的精灵模型不挂）
Object.defineProperty(SpriteModel.prototype, 'av', {
  configurable: true,
  get() { const v = AVATAR_CLS[this.key] ? new AvatarLayer(this) : null; Object.defineProperty(this, 'av', { value: v, writable: true, configurable: true }); return v; },
  set(v) { Object.defineProperty(this, 'av', { value: v, writable: true, configurable: true }); },
});
// 指定某个模型的外观（路人冒险家、预览）；look 传 null 恢复自动
function avatarSetLook(m, look) { const L = m && m.av; if (!L) return; L.fixed = look || null; L.look = null; L.own = null; L.sync(); }
// 给界面用：按外观画一个站姿小人到新画布（个人信息纸娃娃、选角预览）。素材没加载时先返回空画布，加载完自动画上
//   look 省略 = 职业默认；想跟随当前装备：avatarCanvas(cls, lookFromEquip(cls, inv.equip))；存档里的角色：lookFromEquip(d.cls, d.equip)
function avatarCanvas(cls, look, w = 110, h = 134, scale = 1) {
  const [cv, x] = offCanvas(w, h);
  if (!SPR_DATA[cls]) return cv;
  look = look || defaultLook(cls);
  const want = ['spr:' + cls, look.set && SPR_DATA[`${cls}@${look.set}`] ? `spr:${cls}@${look.set}` : null];
  const go = () => {
    if (!IMG[`spr/${cls}/idle`]) return;
    const m = new SpriteModel(cls, SPR_FALLBACK, SPR_ANIMS[cls]); avatarSetLook(m, look);
    const draw = () => { x.clearRect(0, 0, w, h); x.save(); x.translate(w / 2, h - 6); x.scale(scale, scale); m.draw(x, { __c: 'idle', __t: 0 }, 0, NO_OPTS); x.restore(); };
    draw();
    const L = m.av; if (L && L.A && !L.wim) loadArtKey('weapon/' + look.wpn).then(() => { L.wim = IMG['weapon/' + look.wpn]; draw(); });
  };
  if (IMG[`spr/${cls}/idle`] && (!want[1] || IMG[`spr/${cls}@${look.set}/idle`])) go(); else loadBundles(want).then(go);
  return cv;
}
