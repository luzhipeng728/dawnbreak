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
      if (this.own && s[0] === e.weapon && s[1] === e.av_top && s[2] === e.av_bottom && s[3] === e.av_hat && s[4] === e.av_hair && s[5] === e.av_face && s[6] === e.av_weapon && s[7] === e) return;
      this.sig = [e.weapon, e.av_top, e.av_bottom, e.av_hat, e.av_hair, e.av_face, e.av_weapon, e];
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
    this.acc = (look.acc || []).map(k => AVATAR_ACC[k]).filter(Boolean);
    for (const a of this.acc) if (!IMG['avatar/' + a.img]) loadArtKey('avatar/' + a.img);
  }
  // 钩子：换帧来源（时装）
  frame(m, f) {
    this.sync();
    if (!this.S2) return null;
    const r = this.alt[f]; if (r !== undefined) return r;
    const F = this.S2.frames[f], im = F && IMG[`spr/${this.setKey}/${f}`];
    return (this.alt[f] = im ? { F, im } : null);
  }
  // 钩子：帧之前（身后的武器、后脑的发饰）
  under(c, m, f, F) {
    const w = F.wpn, w2 = F.wpn2;
    if (w2 && !w2.front && this.dual()) this.weapon(c, w2, F);
    if (w && !w.front) this.weapon(c, w, F);
    if (F.head && this.acc.length) this.accessories(c, F, true);
  }
  // 钩子：帧之后（身前的武器 + 握拳、头部配件）
  over(c, m, f, F) {
    const w = F.wpn, w2 = F.wpn2;
    if (w && w.front) { this.weapon(c, w, F); if (w.hand && this.wim) this.hand(c, m, f, F, w, 0); }
    if (w2 && w2.front && this.dual()) { this.weapon(c, w2, F); if (w2.hand && this.wim) this.hand(c, m, f, F, w2, 1); }
    if (F.head && this.acc.length) this.accessories(c, F, false);
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
      const im = this.S2 && this.alt[f] ? this.alt[f].im : m.img[f];
      h = this.hands[key] = im ? avatarCutHand(im, w.hand) : null;
    }
    if (h) c.drawImage(h.cv, h.x - F.ax, h.y - F.ay);
  }
  accessories(c, F, back) {
    const H = F.head;
    for (const a of this.acc) {
      if (!!a.back !== back || (a.face && H.f === 0)) continue;
      const im = IMG['avatar/' + a.img], P = (this.S2 && (a.pos[this.setKey] || a.pos[this.cls + '@'])) || a.pos[this.cls]; if (!im || !P) continue;
      c.save(); c.translate(H.x - F.ax, H.y - F.ay); if (H.a) c.rotate(H.a); c.translate(P[0], P[1]); if (P[2]) c.rotate(P[2]);
      const k = AVATAR_ACC_SCALE * (P[3] || 1); c.scale(k, k); c.drawImage(im, -im.width / 2, -im.height / 2); c.restore();
    }
  }
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
