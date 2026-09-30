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
   外观 look = { wpn: 武器图 key | null, set: 套装 id | null, acc: [配件物品 key], job: 转职 | null }（见 content/avatar/looks.js；转职外观见 models/job_fx.js）
   性能：每帧只多 1 次 drawImage + 变换（身前武器再多 1 次握拳小图）；换装 / 首次用到某帧时才分配对象。
   ===================================================================== */
const AVATAR_CLS = { sword: 1, gun: 1, mage: 1, fighter: 1, pmsuit: 1 };   // pmsuit：协战师的战斗服（地下城里整套换帧），只用来挂转职外观（帧里没有武器轨迹 / 头部锚点）
const AV_FIST_R = 13;   // 格斗家拳头半径（帧像素；原装空拳约 26 × 26）：读不了像素时远侧拳的拳上武器按这一圈裁
const AVATAR_SIG_SLOTS = ['weapon', 'av_weapon', 'av_top', 'av_bottom', 'av_chest', 'av_belt', 'av_shoes', 'av_hat', 'av_hair', 'av_face'];   // 这些部位换了就重算外观
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
      const gs = e.weapon ? (e.weapon.enh || 0) * (e.weapon.dim ? -1 : 1) : 0;   // 强化 / 增幅等级变了也要重算（武器光效）
      if (this.own && s[0] === e && this.gs === gs && this.gj === game.job && AVATAR_SIG_SLOTS.every((k, i) => s[i + 1] === e[k])) return;
      this.sig = [e, ...AVATAR_SIG_SLOTS.map(k => e[k])]; this.gs = gs; this.gj = game.job;   // 转职了也重算（转职外观）
      this.own = true; this.apply(lookFromEquip(this.cls, e)); return;
    }
    if (this.own === false && this.look) return;
    this.own = false; this.apply(defaultLook(this.cls));
  }
  apply(look) {
    this.look = look; this.glow = vanityGlowRow(look.glow);   // 强化 / 增幅光效（game/vanity.js）
    this.A = look.wpn && WEAPON_IMG[look.wpn] || null; this.wim = this.A ? IMG['weapon/' + look.wpn] : null;
    this.arm = this.A && SPR_DATA['farm_' + this.A.type] ? 'farm_' + this.A.type : null; this.armV = this.arm ? avArmVariant(look.wpn, this.A.type) : null;   // 格斗家：按帧重画的手臂层（没有就退回贴武器图）
    if (this.arm && !IMG[`spr/${this.arm}/idle`] && !AV_ARM_LOAD[this.arm]) AV_ARM_LOAD[this.arm] = loadBundles(['spr:' + this.arm]);   // 换上武器就开始加载
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
    this.acc = (look.acc || []).map(k => AVATAR_ACC[k]).filter(Boolean); this.jobId = undefined;   // 转职外观下一帧重新确定（models/job_fx.js）
    for (const a of this.acc) if (!IMG['avatar/' + a.img]) loadArtKey('avatar/' + a.img);
  }
  // 钩子：换帧来源（时装）；格斗家戴拳上武器（A.cover）时换成把拳头抹掉的那张（avFists），fit = 每只拳头的位置 / 大小（手套按它套上去）
  frame(m, f) {
    this.sync();
    const r = this.frame0(m, f); this.fr = r;
    const ov = this.armOf(f);
    if (this.arm && !ov && avArmNone(this.arm, f)) return r;   // 手臂层做过这一帧、两只拳都被挡住：照原帧画（不贴武器）；没做过的帧退回贴武器图
    if (!this.A || !(this.A.cover || ov) || !(this.wim || ov)) return r;
    const F = r ? r.F : m.S.frames[f], im = r ? r.im : m.img[f];
    if (!F || !im) return r;
    const o = F.wpn || F.wpn2 ? avFists(im, F) : null;
    return (this.fr = { F, im: o ? o.im : im, fit: o ? o.fit : undefined, ov, up: r ? r.up : undefined, src: r && ov ? r : null });
  }
  // 手臂层（art/final/spr/farm_<类型>，art/tools/fighter_arms_art.py）：这一帧有就用（按品级 / 装扮换色），分包没加载先按需加载
  armOf(f) {
    const k = this.arm; if (!k) return null;
    const O = SPR_DATA[k].frames[f], im = O && IMG[`spr/${k}/${f}`];
    if (!O) return null;
    if (!im) { if (!AV_ARM_LOAD[k]) AV_ARM_LOAD[k] = loadBundles(['spr:' + k]); return null; }
    return { O, im: this.armV ? avArmTint(im, this.armV) : im };
  }
  armDraw(c, ov, f) {
    const { O } = ov, src = this.fr && this.fr.src, B = SPR_DATA.fighter.frames[f], bim = IMG['spr/fighter/' + f];
    const sl = src && B && bim ? avSleeve(src.im, src.F, bim, B) : null;   // 时装：袖子盖在手套上面（袖口以下才露出手套）
    let im = ov.im;
    if (sl) { const [cv, x] = avScratch(im.width, im.height); x.drawImage(im, 0, 0); x.globalCompositeOperation = 'destination-out'; x.drawImage(sl, O.ax - src.F.ax, O.ay - src.F.ay); x.globalCompositeOperation = 'source-over'; im = cv; }
    const P = { w: ov.im.width, h: ov.im.height, gx: 0, gy: ov.im.height / 2, tx: ov.im.width, ty: ov.im.height / 2, kind: 'glove' };   // 光效沿手臂层的横轴（vanityWeaponFx 当成一把武器画光晕 / 火花）
    if (this.glow) { c.save(); c.translate(-O.ax, -O.ay + P.gy); vanityWeaponFx(c, this, {}, P, ov.im, 1, true); c.restore(); }
    if (this.jw) { c.save(); c.translate(-O.ax, -O.ay + P.gy); jlWeapon(c, this, P, ov.im, 1); c.restore(); }
    c.drawImage(im, 0, 0, P.w, P.h, -O.ax, -O.ay, P.w, P.h);
    if (this.glow) { c.save(); c.translate(-O.ax, -O.ay + P.gy); vanityWeaponFx(c, this, {}, P, ov.im, 1, false); c.restore(); }
  }
  frame0(m, f) {
    const r = this.alt[f]; if (r !== undefined && !(r && r.dead)) return r;   // dead：拼好的画布被全局缓存挤掉了，重新拼
    if (this.parts) { const c = avatarMix(m, this.cls, f, this.parts); if (c) return (this.alt[f] = c); if (c === undefined) return null; }   // undefined = 素材还没加载完，下次再拼
    if (!this.S2) return (this.alt[f] = null);
    const F = this.S2.frames[f], im = F && IMG[`spr/${this.setKey}/${f}`];
    return (this.alt[f] = im ? { F, im } : null);
  }
  // 钩子：帧之前（身后的武器、后脑的发饰）
  under(c, m, f, F) {
    jlUnder(c, this, m, f, F);   // 转职外观：身后的鬼影 / 残影 / 血焰 / 小鬼神；无敌半透明（models/job_fx.js）
    const cover = this.A && this.A.cover, w = F.wpn, w2 = F.wpn2, noPaste = (this.fr && this.fr.ov) || (this.arm && avArmNone(this.arm, f)), back = x => x && !noPaste && (!x.front || (x.side === 'f' && !cover));   // 格斗家远侧拳（side 'f'）握着的武器（东方棍）画在身后；盖拳的在 over 里按拳头露出来的地方画
    if (back(w2) && this.dual()) this.weapon(c, w2, F);
    if (back(w)) this.weapon(c, w, F);
    if (F.head && this.acc.length) this.accessories(c, F, true, f);
    if (this.glow && this.glow.ground) vanityGround(c, this);
  }
  // 钩子：帧之后（身前的武器 + 握拳、头部配件）
  over(c, m, f, F) {
    jlHair(c, this, m, f, F);   // 转职发色：紧贴在帧图上面（身前武器 / 头饰之前，models/job_fx.js）
    const w = F.wpn, w2 = F.wpn2, far = x => x && x.side === 'f';
    if (this.fr && this.fr.ov) this.armDraw(c, this.fr.ov, f);   // 手臂层：两只手连同武器已经按这一帧画好（远侧手被身体挡着的部分本来就没画）
    else if (!(this.arm && avArmNone(this.arm, f))) {
      if (w2 && w2.front && this.dual() && far(w2)) this.front(c, m, f, F, w2, 1);   // 远侧拳先画：近侧拳（最前面）的手套压在它上面
      if (w && w.front) this.front(c, m, f, F, w, 0);
      if (w2 && w2.front && this.dual() && !far(w2)) this.front(c, m, f, F, w2, 1);
    }
    if (F.head && this.acc.length) this.accessories(c, F, false, f);
    if (this.glow && this.glow.trail) vanityTrail(c, this, F, f);
    jlOver(c, this, m, f, F);   // 转职外观：鬼手 / 红眼 / 身前的火舌和鬼火
  }
  dual() { return !!this.A && this.A.dual !== 0; }   // 双枪帧的副手：长枪 / 手炮 / 手弩不画（副手空着）
  /* 身前的武器：握在手里的（剑、枪、东方棍）画完把握拳像素盖回去（做出“握住”）；格斗家远侧拳握着的在 under 里画在身后。
     拳上武器（A.cover：手套 / 拳套 / 爪 / 臂铠）：身体帧里的拳头已经抹掉（frame → avFists），手套按这一帧拳头的位置 / 大小套上去（fit）；
     远侧拳（side 'f'）的手套只画在远侧拳原来露出来的像素上（fit.mask）—— 头、身体、近侧手臂挡在它前面的地方照样挡着（docs/CLASS_PLAN_FIGHTER.md §4.5） */
  front(c, m, f, F, w, i) {
    const cover = this.A && this.A.cover;
    if (!cover) { if (w.side === 'f') return; this.weapon(c, w, F); if (w.hand && this.wim) this.hand(c, m, f, F, w, i); return; }
    const fit = this.fr && this.fr.fit ? this.fr.fit[w === F.wpn ? 'wpn' : 'wpn2'] : undefined;
    if (w.side !== 'f') return this.weapon(c, w, F, fit || undefined);   // 近侧拳没找到露出来的拳头：照锚点画
    if (fit === null) return;   // 远侧拳这一帧其实被挡住了（没找到露出来的拳头）
    if (fit) this.masked(c, F, w, fit); else if (this.wim) this.fistClip(c, F, w, () => this.weapon(c, w, F));   // 读不了像素（file:// 跨域）：按拳心一圈裁
  }
  // 远侧拳的手套：先画到临时画布（3 倍精度），只留远侧拳露出来的那些像素，再贴回去
  masked(c, F, w, fit) {
    const M = fit.mask, Q = 3, [cv, x] = avScratch(M.w * Q, M.h * Q);
    x.setTransform(Q, 0, 0, Q, (F.ax - M.x0) * Q, (F.ay - M.y0) * Q); this.weapon(x, w, F, fit);
    x.setTransform(1, 0, 0, 1, 0, 0); x.globalCompositeOperation = 'destination-in'; x.drawImage(M.cv, 0, 0, M.w * Q, M.h * Q); x.globalCompositeOperation = 'source-over';
    c.drawImage(cv, 0, 0, M.w * Q, M.h * Q, M.x0 - F.ax, M.y0 - F.ay, M.w, M.h);
  }
  fistClip(c, F, w, draw) {
    let r = AV_FIST_R;
    if (w.hand) for (const P of w.hand) for (let j = 0; j < P.length; j += 2) r = Math.max(r, Math.hypot(P[j] - w.gx, P[j + 1] - w.gy) + 1.5);
    c.save(); c.beginPath(); c.arc(w.gx - F.ax, w.gy - F.ay, Math.min(r, AV_FIST_R * 1.35), 0, TAU); c.clip(); draw(); c.restore();
  }
  weapon(c, w, F, fit) {
    const A = this.A, im = this.wim; if (!A || !im) return;
    const kf = fit && A.fh && A.type !== 'gauntlet' ? clamp(fit.h * 1.05 / A.fh, 1, 1.15) : 1, ang = fit ? fit.ang : w.ang;   // 拳上武器顺着前臂的方向；拳头比手套大的帧稍微放大一点（拳头已经抹掉，不用硬盖满；臂铠带着整条护臂，放大会伸到腰上）
    const s = A.size / (A.tx - A.gx) * kf, fy = Math.cos(ang) < -0.05 ? -s : s;   // 朝左时上下翻转，武器的“上面”保持朝上
    c.save(); if (fit) c.translate(fit.cx - F.ax, fit.cy - F.ay); else c.translate(w.gx - F.ax, w.gy - F.ay); c.rotate(ang);
    const pole = A.kind === 'pole';
    if (pole) c.translate(w.len, 0);   // 长杆：杖头对准棍子的尖端
    c.scale(s, fy);
    if (this.glow) vanityWeaponFx(c, this, w, A, im, s, true);   // 光晕 / 电弧画在武器图之前：光在刀身外面，刀身本身看得清
    if (this.jw) jlWeapon(c, this, A, im, s);                    // 转职状态把武器染色（狂暴之力的血色双刀）
    if (pole) {   // 只画到占位棍在握点另一侧露出的长度（被身体挡住 / 画师本来就没画出来的那截不画）
      const x0 = w.bk === undefined ? 0 : Math.max(0, A.tx - (w.len + w.bk + 6) / s);
      if (x0 > 0) c.drawImage(im, x0, 0, A.w - x0, A.h, x0 - A.tx, -A.ty, A.w - x0, A.h); else c.drawImage(im, -A.tx, -A.ty);
    }
    else c.drawImage(im, -A.gx, -A.gy);
    if (this.glow) vanityWeaponFx(c, this, w, A, im, s, false);  // 火花 / 爆闪：在刀身外侧
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
/* ---- 格斗家拳上武器（cover）：这一帧露出来的拳头 ----
   绑带和皮肤颜色分不开（色相 15~40°、饱和度 0.1~0.4，实测），所以按几何 + 连通来找：
   ① “浅色、暖、不鲜艳”的像素（1 = 绑带 / 皮肤，2 = 中等亮度的指节线 / 阴影）；脸（头部锚点转正后的一个框，嘴和下巴也在里面）不算；
   ② 腐蚀一圈再从拳头锚点附近往外长（断开一像素宽的桥：拳头贴着脸 / 另一只手臂的地方不会连过去），半径 AV_ARM_R 以内，再长回两圈 → 拳头 + 前臂；
      近侧拳先找，远侧拳不能用近侧已经占了的像素（远侧拳在近侧手臂后面时只剩真正露出来的部分）；
   ③ 拳头 = 离锚点 AV_FIST_R2 以内的那部分；前臂方向 = 手腕那一截（从拳头外扩几像素跨过描边、在拳心外一圈里按浅色像素长）的质心 → 拳头质心（找不到就用占位棒的方向）；
      fit = 拳心（沿前臂方向：最前面往回半个拳头高）+ 拳头高 h + 方向 ang（手套按它套上去、至少比拳头大一圈）；
   ④ 身体帧里把拳头（+ 外面一圈描边）抹掉、用周围的像素补上（手套盖不全的地方不会再露出一只绑带拳头）；前臂留着（缠着绑带的前臂伸进手套口）；
   ⑤ 远侧拳：遮罩 = 这只手露出来的像素（拳头 + 前臂 + 一圈描边）+ 空白处，手套只画在这里面 —— 头、身体、近侧手臂挡着的地方照样挡着，伸到身体外面的照画。
   每张帧图算一次（WeakMap，原装 / 时装 / 混搭拼帧都一样）；读不了像素（file:// 跨域）返回 null（退回按拳心一圈裁）。 */
const AV_FISTS = new WeakMap(), AV_FIST_R2 = 17, AV_ARM_R = 32;
/* 手臂层换色（品级 / 武器装扮不再单独生图）：手臂层按材质分两类 —— 有颜色的（皮革 / 布 / 漆，饱和度 ≥ 0.25）换成主色，发白发灰的（金属 / 袖口）往辅色靠；
   绑带 / 皮肤、深色描边不动；保留明暗。每张图 × 款式算一次（WeakMap） */
const AV_ARM_TINT = { r2: ['#8a5ae0', '#c8b8f0'], r3: ['#e0508e', '#ecd4e0'], r4: ['#e8a030', '#f4d060'], spring: ['#d8282a', '#f0c040'], summer: ['#3aa0f0', '#f4f8ff'],
  holywing: ['#f4f0e6', '#f0c848'], flamedragon: ['#9a1a24', '#3a2228'], academy: ['#2a3a90', '#d0d4e8'], gothic: ['#2a2630', '#d8d8e8'] };
const AV_ARM_LOAD = {}, AV_ARM_TC = new WeakMap(), avArmNone = (k, f) => !!(SPR_DATA[k].none && SPR_DATA[k].none.includes(f));
/* 时装的袖子：原装这里是绑带 / 皮肤（小臂），时装这里是衣服 → 袖子，手臂层在这里不画（袖子盖住手套口）。躯干（原装是红马甲）不算，近侧手套在身体前面照画。
   每张时装帧图算一次（WeakMap）；读不了像素 / 没有袖子返回 null */
const AV_SLEEVE = new WeakMap();
function avSleeve(im, F, bim, B) {
  let o = AV_SLEEVE.get(im); if (o !== undefined) return o; o = null;
  try {
    const skin = (d, i) => { const r = d[i], g = d[i + 1], b = d[i + 2], mx = Math.max(r, g, b), mn = Math.min(r, g, b), sat = mx ? (mx - mn) / mx : 0; if (mx < 140 || sat < 0.07 || sat >= 0.45 || r < b || mx === mn) return false; let h = mx === r ? ((g - b) / (mx - mn)) % 6 : mx === g ? (b - r) / (mx - mn) + 2 : (r - g) / (mx - mn) + 4; h *= 60; if (h < 0) h += 360; return h > 8 && h < 48; };
    const W = im.width, H = im.height, [c0, x0] = offCanvas(W, H); x0.drawImage(im, 0, 0); const d = x0.getImageData(0, 0, W, H).data;
    const bw = bim.width, bh = bim.height, [c1, x1] = offCanvas(bw, bh); x1.drawImage(bim, 0, 0); const e = x1.getImageData(0, 0, bw, bh).data;
    const dx = Math.round(B.ax - F.ax), dy = Math.round(B.ay - F.ay), m = new Uint8Array(W * H), A = [F.wpn, F.wpn2].filter(Boolean);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x; if (d[i * 4 + 3] < 128 || skin(d, i * 4)) continue;
      if (A.some(w => (x - w.gx) ** 2 + (y - w.gy) ** 2 < 225)) continue;   // 拳头一圈不算（袖子到不了拳头；时装表重画的拳头边缘和原装差几个像素，不能在手套上挖洞）
      const bx = x + dx, by = y + dy; if (bx < 0 || by < 0 || bx >= bw || by >= bh) continue;
      const j = (by * bw + bx) * 4; if (e[j + 3] < 128 || !skin(e, j)) continue;
      m[i] = 1;
    }
    const md = new Uint8ClampedArray(W * H * 4), st = []; let n = 0;   // 只留成块的袖子（≥ 40 像素）：零星的描边差异不算
    for (let i0 = 0; i0 < W * H; i0++) {
      if (m[i0] !== 1) continue;
      const blob = [i0]; m[i0] = 2; st.push(i0);
      while (st.length) { const i = st.pop(), x = i % W; for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W]) if (j >= 0 && j < W * H && m[j] === 1) { m[j] = 2; blob.push(j); st.push(j); } }
      if (blob.length >= 40) for (const i of blob) { md[i * 4 + 3] = 255; n++; }
    }
    if (n) { const [cv, x] = offCanvas(W, H); x.putImageData(new ImageData(md, W, H), 0, 0); o = cv; }
  } catch (err) { o = null; }
  AV_SLEEVE.set(im, o); return o;
}
function avArmVariant(key, type) {
  if (!key || key === type) return null;
  const r = /_r(\d)$/.exec(key); if (r) return AV_ARM_TINT['r' + r[1]] ? 'r' + r[1] : null;
  if (key.startsWith('ep_')) return 'r4';
  const sk = key.split('_')[0]; return AV_ARM_TINT[sk] ? sk : null;
}
function avArmTint(im, v) {
  let M = AV_ARM_TC.get(im); if (!M) AV_ARM_TC.set(im, M = new Map());
  let o = M.get(v); if (o) return o;
  const W = im.width, H = im.height, [cv, x] = offCanvas(W, H); x.drawImage(im, 0, 0);
  let d; try { d = x.getImageData(0, 0, W, H); } catch (e) { M.set(v, im); return im; }
  const p = d.data, [m1, m2] = AV_ARM_TINT[v].map(hexRgb), cls = new Uint8Array(p.length / 4), L = [];
  for (let i = 0; i < p.length; i += 4) {   // 1 = 有颜色的材质（换主色），2 = 金属 / 白（往辅色靠），0 = 不动
    if (p[i + 3] < 10) continue;
    const r = p[i], g = p[i + 1], b = p[i + 2], mx = Math.max(r, g, b), mn = Math.min(r, g, b), sat = mx ? (mx - mn) / mx : 0;
    let h = 0; if (mx > mn) { h = mx === r ? ((g - b) / (mx - mn)) % 6 : mx === g ? (b - r) / (mx - mn) + 2 : (r - g) / (mx - mn) + 4; h *= 60; if (h < 0) h += 360; }
    if (mx < 60 || (mx >= 140 && sat >= 0.07 && sat < 0.45 && r >= b && h > 8 && h < 48)) continue;   // 描边 / 绑带皮肤不动
    if (sat >= 0.25) { cls[i / 4] = 1; L.push(0.3 * r + 0.59 * g + 0.11 * b); } else if (mx >= 90) cls[i / 4] = 2;
  }
  L.sort((a, b) => a - b); const med = Math.max(20, L.length ? L[L.length >> 1] : 100);   // 主材质的中间亮度 → 对到主色（明暗按比例）
  for (let i = 0; i < p.length; i += 4) {
    const c = cls[i / 4]; if (!c) continue;
    const l = 0.3 * p[i] + 0.59 * p[i + 1] + 0.11 * p[i + 2];
    if (c === 1) { const k = l / med, hi = Math.max(0, k - 1.1) * 0.7; for (let j = 0; j < 3; j++) p[i + j] = Math.min(255, m1[j] * Math.min(k, 1.2) + (255 - m1[j]) * hi); }
    else for (let j = 0; j < 3; j++) p[i + j] = Math.min(255, p[i + j] * 0.4 + m2[j] * (l / 200) * 0.6);
  }
  x.putImageData(d, 0, 0); M.set(v, cv); return cv;
}
let AV_SCRATCH = null;
function avScratch(w, h) {
  if (!AV_SCRATCH || AV_SCRATCH[0].width < w || AV_SCRATCH[0].height < h) AV_SCRATCH = offCanvas(Math.max(w, AV_SCRATCH ? AV_SCRATCH[0].width : 0), Math.max(h, AV_SCRATCH ? AV_SCRATCH[0].height : 0));
  AV_SCRATCH[1].setTransform(1, 0, 0, 1, 0, 0); AV_SCRATCH[1].clearRect(0, 0, w, h); return AV_SCRATCH;
}
function avFists(im, F) {
  let o = AV_FISTS.get(im); if (o !== undefined) return o;
  try { o = avFistsCalc(im, F); } catch (e) { o = null; }
  AV_FISTS.set(im, o); return o;
}
function avFistsCalc(im, F) {
  const W = im.width, H = im.height, [c0, x0] = offCanvas(W, H); x0.drawImage(im, 0, 0);
  const d = x0.getImageData(0, 0, W, H), p = d.data, n = W * H, L = new Uint8Array(n), E = new Uint8Array(n), er = new Uint8Array(n), taken = new Uint8Array(n), hd = F.head, fit = {};
  const ha = hd ? -(hd.a || 0) : 0, hc = Math.cos(ha), hs = Math.sin(ha);
  const face = (x, y) => { if (!hd) return false; const dx = x - hd.x, dy = y - hd.y, lx = dx * hc - dy * hs, ly = dx * hs + dy * hc; return lx > -14 && lx < 38 && ly > -4 && ly < 44; };
  for (let i = 0; i < n; i++) {
    if (p[i * 4 + 3] < 128) continue;
    const r = p[i * 4], g = p[i * 4 + 1], b = p[i * 4 + 2], mx = Math.max(r, g, b), sat = mx ? (mx - Math.min(r, g, b)) / mx : 0;
    if (r < b) continue;
    if (mx >= 140 && sat < 0.45) L[i] = 1; else if (mx >= 95 && sat < 0.65) L[i] = 2;
  }
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) { const i = y * W + x; E[i] = L[i] === 1 && L[i - 1] === 1 && L[i + 1] === 1 && L[i - W] === 1 && L[i + W] === 1 ? 1 : 0; }
  const keys = ['wpn', 'wpn2'].filter(k => F[k]).sort((a, b) => (F[a].side === 'f') - (F[b].side === 'f'));   // 近侧拳先找
  for (const key of keys) {
    const w = F[key], gx = w.gx, gy = w.gy, R = AV_ARM_R, X0 = Math.max(0, Math.floor(gx - R - 3)), X1 = Math.min(W - 1, Math.ceil(gx + R + 3)), Y0 = Math.max(0, Math.floor(gy - R - 3)), Y1 = Math.min(H - 1, Math.ceil(gy + R + 3));
    const o = F[key === 'wpn' ? 'wpn2' : 'wpn'], mine = o ? (x, y) => (x - gx) ** 2 + (y - gy) ** 2 <= (x - o.gx) ** 2 + (y - o.gy) ** 2 + 30 : () => true;   // 两只拳挨在一起：按离哪个锚点近分开
    const ok = (x, y) => (x - gx) ** 2 + (y - gy) ** 2 <= R * R && !taken[y * W + x] && !face(x, y) && mine(x, y);
    let m = new Uint8Array(n); const st = [];
    for (let y = Y0; y <= Y1; y++) for (let x = X0; x <= X1; x++) { const i = y * W + x; if (E[i] && (x - gx) ** 2 + (y - gy) ** 2 <= 64 && ok(x, y)) { m[i] = 1; st.push(i); } }
    while (st.length) {
      const i = st.pop(), x = i % W, y = (i - x) / W;
      for (const [j, xx, yy] of [[i - 1, x - 1, y], [i + 1, x + 1, y], [i - W, x, y - 1], [i + W, x, y + 1]]) if (xx >= 0 && xx < W && yy >= 0 && yy < H && !m[j] && E[j] && ok(xx, yy)) { m[j] = 1; st.push(j); }
    }
    for (let k = 0; k < 2; k++) {   // 长回腐蚀掉的两圈（只在浅色像素里）
      const g = m.slice();
      for (let y = Y0; y <= Y1; y++) for (let x = X0; x <= X1; x++) { const i = y * W + x; if (m[i] || !L[i] || !ok(x, y)) continue; if ((x > 0 && m[i - 1]) || (x < W - 1 && m[i + 1]) || (y > 0 && m[i - W]) || (y < H - 1 && m[i + W])) g[i] = 1; }
      m = g;
    }
    let fn = 0, fx = 0, fy = 0;
    const R1 = AV_FIST_R2 * AV_FIST_R2;
    for (let y = Y0; y <= Y1; y++) for (let x = X0; x <= X1; x++) { const i = y * W + x; if (m[i] && (x - gx) ** 2 + (y - gy) ** 2 <= R1) { fn++; fx += x; fy += y; } }
    if (fn < 24) { fit[key] = null; continue; }   // 拳头被挡住了（只露出一点点）
    fx /= fn; fy /= fn;
    // 前臂方向：从拳头（外扩 3 像素，跨过拳头和手腕之间的描边）往外，在拳心外 AV_FIST_R2 - 4 ~ + 10 这一圈里按浅色像素长（手腕那一截），质心 → 拳心
    const RA0 = (AV_FIST_R2 - 4) ** 2, RA1 = (AV_FIST_R2 + 10) ** 2, inA = (x, y) => { const d2 = (x - fx) ** 2 + (y - fy) ** 2; return d2 > RA0 && d2 <= RA1 && !taken[y * W + x] && !face(x, y) && mine(x, y); };
    const A = new Uint8Array(n), sa = [];
    for (let y = Y0; y <= Y1; y++) for (let x = X0; x <= X1; x++) {
      const i = y * W + x; if (!L[i] || !inA(x, y)) continue;
      let near = false; for (let dy = -3; dy <= 3 && !near; dy++) for (let dx = -3; dx <= 3; dx++) { const j = i + dy * W + dx; if (j >= 0 && j < n && m[j] && (x + dx - gx) ** 2 + (y + dy - gy) ** 2 <= R1) { near = true; break; } }
      if (near) { A[i] = 1; sa.push(i); }
    }
    while (sa.length) { const i = sa.pop(), x = i % W, y = (i - x) / W; for (const [j, xx, yy] of [[i - 1, x - 1, y], [i + 1, x + 1, y], [i - W, x, y - 1], [i + W, x, y + 1]]) if (xx >= 0 && xx < W && yy >= 0 && yy < H && !A[j] && L[j] && inA(xx, yy)) { A[j] = 1; sa.push(j); } }
    let an = 0, axs = 0, ays = 0; for (let y = Y0; y <= Y1; y++) for (let x = X0; x <= X1; x++) if (A[y * W + x]) { an++; axs += x; ays += y; }
    let ux = Math.cos(w.ang), uy = Math.sin(w.ang);
    if (an >= 25) { const vx = fx - axs / an, vy = fy - ays / an, l = Math.hypot(vx, vy); if (l > 3) { ux = vx / l; uy = vy / l; } }
    const T = [], N = [], R3 = (AV_FIST_R2 + 4) ** 2;
    for (let y = Y0; y <= Y1; y++) for (let x = X0; x <= X1; x++) { if (!m[y * W + x]) continue; const dx = x - gx, dy = y - gy; if (dx * dx + dy * dy > R3) continue; T.push(dx * ux + dy * uy); N.push(-dx * uy + dy * ux); }
    const q = (A, k) => A[Math.min(A.length - 1, Math.floor(A.length * k))], TS = T.slice().sort((a, b) => a - b), front = q(TS, 0.96);
    const NS = N.filter((v, j) => T[j] > front - 24).sort((a, b) => a - b), nlo = q(NS, 0.04), nhi = q(NS, 0.96), h = nhi - nlo + 2, tc = front - h / 2, nc = (nlo + nhi) / 2;
    const f = { cx: gx + ux * tc - uy * nc, cy: gy + uy * tc + ux * nc, h, ang: Math.atan2(uy, ux) };
    // 抹掉拳头（锚点 AV_FIST_R2 + 2 以内）+ 一圈描边
    const RE = (AV_FIST_R2 + 2) ** 2, far = w.side === 'f', edge = (x, y, i) => m[i] || (x > 0 && m[i - 1]) || (x < W - 1 && m[i + 1]) || (y > 0 && m[i - W]) || (y < H - 1 && m[i + W]);
    for (let y = Y0; y <= Y1; y++) for (let x = X0; x <= X1; x++) {
      const i = y * W + x; if (p[i * 4 + 3] < 20 || !edge(x, y, i)) continue;
      if (m[i]) taken[i] = 1;
      if ((x - gx) ** 2 + (y - gy) ** 2 <= RE) er[i] = 1;
    }
    // 远侧拳的遮罩：这只手露出来的像素（+ 一圈描边）和空白处（手套伸到身体外面的部分照画）；身体、头、近侧手臂上不画（它们挡在远侧拳前面）
    if (far) {
      const RM = 100, MX0 = Math.max(0, Math.floor(gx - RM)), MX1 = Math.min(W - 1, Math.ceil(gx + RM)), MY0 = Math.max(0, Math.floor(gy - RM)), MY1 = Math.min(H - 1, Math.ceil(gy + RM)), mw = MX1 - MX0 + 1, mh = MY1 - MY0 + 1, md = new Uint8ClampedArray(mw * mh * 4);
      for (let y = MY0; y <= MY1; y++) for (let x = MX0; x <= MX1; x++) { const i = y * W + x; if (p[i * 4 + 3] < 40 || edge(x, y, i)) md[((y - MY0) * mw + x - MX0) * 4 + 3] = 255; }
      const [mc, mx] = offCanvas(mw, mh); mx.putImageData(new ImageData(md, mw, mh), 0, 0); f.mask = { cv: mc, x0: MX0, y0: MY0, w: mw, h: mh };
    }
    fit[key] = f;
  }
  // 抹掉拳头：一圈一圈用外面已知的像素（含透明）的平均补进去
  let todo = []; for (let i = 0; i < n; i++) if (er[i]) todo.push(i);
  for (let pass = 0; todo.length && pass < 40; pass++) {
    const next = [], fill = [];
    for (const i of todo) {
      const x = i % W; let r = 0, g = 0, b = 0, a = 0, k = 0;
      for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W]) if (j >= 0 && j < n && !er[j]) { const aj = p[j * 4 + 3]; r += p[j * 4] * aj; g += p[j * 4 + 1] * aj; b += p[j * 4 + 2] * aj; a += aj; k++; }
      if (!k) { next.push(i); continue; }
      fill.push([i, a ? r / a : 0, a ? g / a : 0, a ? b / a : 0, a / k]);
    }
    for (const [i, r, g, b, a] of fill) { p[i * 4] = r; p[i * 4 + 1] = g; p[i * 4 + 2] = b; p[i * 4 + 3] = a; er[i] = 0; }
    todo = next;
  }
  x0.putImageData(d, 0, 0);
  return { im: c0, fit };
}
/* ---- 混搭拼帧：按原装帧的分割线（F.cut：腰线 + 脚踝线，垂直于身体轴）把上身 / 下身 / 脚三段拼成一张，接缝处羽化 FEATHER 像素 ----
   只在第一次用到（帧 × 搭配）时拼一次，缓存成一张画布（全局 LRU，最多 MIX_MAX 张），之后每帧还是一次 drawImage。
   各套时装帧都已按脚底锚点对齐到原装同名帧（art/tools/avatar_align.py），所以同一条分割线换算到各套里是同一个位置。
   返回 { F, im, up }；这一帧没有分割线（躺地 / 翻滚等）返回 null（调用方整套用 look.set）；素材没加载完返回 undefined。 */
const MIX_CACHE = new Map(), MIX_MAX = 128, FEATHER = 6;   // 一张约 120×210 像素（~100 KB），最多 ~13 MB
function avatarMix(m, cls, f, P) {
  const o = m.o || {}, key = `${cls}|${f}|${P.up || ''}|${P.low || ''}|${P.feet || ''}|${o.hue || 0},${o.bright || 1},${o.sat || 1},${o.only || ''}`;   // 默认造型那段可能换过色（路人）
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
  if (MIX_CACHE.size > MIX_MAX) { const k0 = MIX_CACHE.keys().next().value, o = MIX_CACHE.get(k0); MIX_CACHE.delete(k0); o.dead = true; if (o.im.width) o.im.width = o.im.height = 0; }
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
