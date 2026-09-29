/* =====================================================================
   面子系统（让人一眼看出“不一样”）：强化 / 增幅武器光效阶梯、时装城镇移速、天空套 8 件专属特效、名牌徽章
   - 武器光效：武器 it.enh ≥ 5 → look.glow = { lv, amp }（带 it.dim 的是增幅，走另一套颜色）；lookFromEquip 里算，
     所以自己、城镇里的其他玩家（net/town.js 发的 look）、组队影子（net/coop.js）、决斗对手、选角立绘、状态窗口都一样。
     外观层（models/avatar.js）画武器时调这里：
       vanityWeaponFx  在武器的同一个变换里画两次：武器图之前 = 光晕 + 刀身描边 + 爆闪的光 + 电弧（都在刀身后面）；之后 = 刀身外沿的火花 + 环绕光点 + 尖端星芒
       vanityTrail     挥砍拖尾：记下最近几帧的握点 / 角度，按角度插值画成扇形带（只在大幅挥动时出现）
       vanityGround    +15 起脚下的光环
   - 光效阶梯：GLOW_ENH / GLOW_AMP 一行一个等级，改数值就能调（见表头注释）。
     官方国服（玩家社区整理）：1~4 无光；5~8 淡黄，越高闪得越快；9~12 蓝，11、12 会闪；13~14 红 / 粉；15~16 紫 / 金。
     这里照官方的色系走，每级再加一样看得见的东西（火花密度 / 拖尾 / 爆闪 / 光环 / 电弧），做到“一眼看出 +几”。
     增幅官方和强化同色；这里改成血红 + 异次元紫（火花是菱形碎片），和强化区分开。
   - 城镇移速 townSpd：每件装扮 +2%（天空套 +3%），8 件同套高级装扮再 +14%，8 件天空套再 +36%（合计 +60%，同手游官方天空 8 件）。
     只在城镇场景的移动里生效（world.js playerControlTown 乘 vanityTownMul()）；不进 p.stats，地下城 / 决斗场天然为 0。
   - 天空套 8 件（shop_pet.js cashEntTick 调 vanitySkyTick）：城镇里走动留下光羽脚印（天穹圣翼）/ 火焰脚印（炎龙之魂），
     站着时背后展开光翼 / 脚下燃起火环；名牌加一圈套装色的边框。
   - 性能（ARCHITECTURE 绘制规范）：不用 filter / shadowBlur，混合只用 source-over / lighter；光晕 / 光点 / 光翼都是第一次用到时生成的缓存画布。
   ===================================================================== */

/* ---- 1. 武器光效阶梯 ----
   nm 名称；col 光晕色（数组 = 几种颜色轮流渐变）；col2 火花色（'rainbow' = 七彩）；a 光晕强度 0~1；r 光晕半径（游戏像素，跟角色大小走）；
   pulse 呼吸频率（次 / 秒）；spark 火花（个 / 秒）；trail 挥砍拖尾（秒）；flare 待机爆闪间隔（秒）；ground 脚下光环；arcs 电弧 */
function vanityLadder(amp, T) { for (const lv in T) T[lv] = { spark: 0, trail: 0, flare: 0, ground: 0, arcs: 0, rim: 0, orbit: 0, aura2: null, ...T[lv], lv: +lv, amp }; return T; }
/* +10 起刀身外面一圈清楚的描边（rim，游戏像素）+ 大光晕（r）；+12 光晕是 +10 的 1.5 倍、更亮；+13 起每级多一样一眼看得出的东西：
   +13 变红 + 待机爆闪，+14 环绕光点（orbit 颗，绕着武器转、不压刀身），+15 变紫 + 外层第二圈光晕（aura2）+ 脚下光环，+16 七彩轮换 + 电弧 + 光点加倍 */
const GLOW_ENH = vanityLadder(0, {
  5: { nm: '微光', col: '#fff2b8', a: 0.12, r: 3, pulse: 0.4 },
  6: { nm: '微光', col: '#ffeaa0', a: 0.18, r: 3, pulse: 0.5 },
  7: { nm: '淡金', col: '#ffe488', a: 0.26, r: 3.5, pulse: 0.6, rim: 0.6 },
  8: { nm: '金闪', col: '#ffd66a', a: 0.34, r: 4, pulse: 0.9, rim: 0.8 },
  9: { nm: '冰蓝', col: '#8fd0ff', a: 0.42, r: 4.5, pulse: 0.7, rim: 1 },
  10: { nm: '天蓝', col: '#58b8ff', col2: '#ffffff', a: 0.65, r: 6, pulse: 1.0, spark: 4, rim: 1.3 },
  11: { nm: '湛蓝', col: '#2a86ff', col2: '#cfeaff', a: 0.78, r: 7.5, pulse: 1.6, spark: 6, trail: 0.09, rim: 1.5 },
  12: { nm: '深蓝', col: '#3a5cff', col2: '#ffe27a', a: 0.9, r: 9, pulse: 2.2, spark: 8, trail: 0.12, rim: 1.8 },
  13: { nm: '烈红', col: '#ff3a1a', col2: '#ffc040', a: 0.95, r: 10, pulse: 1.4, spark: 10, trail: 0.15, flare: 3.2, rim: 2 },
  14: { nm: '绯红', col: '#ff2c8c', col2: '#ffd4ee', a: 1, r: 11, pulse: 1.8, spark: 10, trail: 0.18, flare: 2.6, rim: 2.2, orbit: 3 },
  15: { nm: '紫耀', col: '#9a4cff', col2: '#f0dcff', a: 1, r: 12, pulse: 2.0, spark: 12, trail: 0.21, flare: 2.2, ground: 1, rim: 2.4, orbit: 4, aura2: '#ffd86a' },
  16: { nm: '七彩圣辉', col: ['#ffb400', '#00c8ff', '#ff3ac8'], col2: 'rainbow', a: 1, r: 15, pulse: 2.4, spark: 14, trail: 0.25, flare: 1.8, ground: 1, arcs: 1, rim: 2.8, orbit: 7, aura2: 'cycle' },
});
const GLOW_AMP = vanityLadder(1, {
  5: { nm: '血光', col: '#ffa0b0', col2: '#c890ff', a: 0.12, r: 3, pulse: 0.4 },
  6: { nm: '血光', col: '#ff8ca0', col2: '#c080ff', a: 0.18, r: 3, pulse: 0.5 },
  7: { nm: '血光', col: '#ff7890', col2: '#b878ff', a: 0.26, r: 3.5, pulse: 0.6, rim: 0.6 },
  8: { nm: '血光', col: '#ff6480', col2: '#b070ff', a: 0.34, r: 4, pulse: 0.9, rim: 0.8 },
  9: { nm: '血光', col: '#ff5070', col2: '#a868ff', a: 0.42, r: 4.5, pulse: 0.7, rim: 1 },
  10: { nm: '蔷薇', col: '#ff7898', col2: '#ffc0d4', a: 0.6, r: 6, pulse: 1.0, spark: 4, rim: 1.3 },
  11: { nm: '绯血', col: '#ff3a64', col2: '#ff9ab8', a: 0.72, r: 7.5, pulse: 1.6, spark: 6, trail: 0.09, rim: 1.5 },
  12: { nm: '深红', col: '#e8224e', col2: '#c080ff', a: 0.9, r: 9, pulse: 2.2, spark: 8, trail: 0.12, rim: 1.8 },
  13: { nm: '血焰', col: '#ff1a3a', col2: '#a050ff', a: 0.95, r: 10, pulse: 1.4, spark: 10, trail: 0.15, flare: 3.2, rim: 2 },
  14: { nm: '魔红', col: '#ff1c6c', col2: '#ff70ff', a: 1, r: 11, pulse: 1.8, spark: 10, trail: 0.18, flare: 2.6, rim: 2.2, orbit: 3 },
  15: { nm: '暗血', col: '#d8103e', col2: '#8a3cff', a: 1, r: 12, pulse: 2.0, spark: 12, trail: 0.21, flare: 2.2, ground: 1, rim: 2.4, orbit: 4, aura2: '#8a3cff' },
  16: { nm: '异界之辉', col: ['#ff1030', '#9a40ff', '#ff5a80'], col2: '#ff80c0', a: 1, r: 14, pulse: 2.4, spark: 14, trail: 0.25, flare: 1.8, ground: 1, arcs: 1, rim: 2.6, orbit: 7, aura2: '#ff80ff' },
});
const VANITY_BADGE_LV = 10;   // 名牌旁的 “+13” 徽章从 +10 起显示
// 武器 → look.glow（< +5 没有光效，不发）
function vanityGlowOf(it) { return it && it.slot === 'weapon' && it.enh >= 5 ? { lv: Math.min(16, it.enh), amp: it.dim ? 1 : 0 } : null; }
function vanityGlowRow(g) { return g && g.lv ? (g.amp ? GLOW_AMP : GLOW_ENH)[Math.min(16, g.lv | 0)] || null : null; }
const vanityCol = (G, t = performance.now() / 1000) => Array.isArray(G.col) ? G.col[Math.floor(t * 0.5) % G.col.length] : G.col;
function vanityHash(n) { const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453; return s - Math.floor(s); }
const vanityAngD = (b, a) => { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; else if (d < -Math.PI) d += TAU; return d; };
const vanityFxImg = (name, col) => IMG['fx/' + name] ? fxTint(name, col) : null;

/* ---- 缓存画布：着色光晕（按武器图 × 颜色 × 半径）、柔光圆点、光翼 ---- */
const VANITY_HALO = new WeakMap();
function vanityHalo(im, col, r) {
  let M = VANITY_HALO.get(im); if (!M) VANITY_HALO.set(im, M = new Map());
  const k = col + '|' + r; let H = M.get(k); if (H) return H;
  const W = im.width, Ht = im.height, p = r + 2;
  const [sil, sc] = offCanvas(W, Ht); sc.drawImage(im, 0, 0); sc.globalCompositeOperation = 'source-in'; sc.fillStyle = col; sc.fillRect(0, 0, W, Ht);   // 不读像素：file:// 打开时图片算跨域也能用
  const [cv, x] = offCanvas(W + p * 2, Ht + p * 2);
  x.globalAlpha = 0.2;
  for (const f of [1, 0.66, 0.33]) for (let i = 0; i < 10; i++) { const a = i / 10 * TAU + f * 2; x.drawImage(sil, p + Math.cos(a) * r * f, p + Math.sin(a) * r * f); }
  const [ring, rg] = offCanvas(cv.width, cv.height); rg.drawImage(cv, 0, 0); rg.globalCompositeOperation = 'destination-out'; rg.drawImage(im, p, p);   // 只留武器外面一圈：亮背景上用正常混合画，看得见
  H = { cv, ring, sil, p }; M.set(k, H); return H;
}
const VANITY_DOT = new Map();
function vanityDot(col) {
  let d = VANITY_DOT.get(col); if (d) return d;
  const [cv, x] = offCanvas(64, 64), [r, g, b] = hexRgb(col), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, `rgba(${r},${g},${b},1)`); gr.addColorStop(0.45, `rgba(${r},${g},${b},0.45)`); gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
  x.fillStyle = gr; x.fillRect(0, 0, 64, 64); VANITY_DOT.set(col, cv); return cv;
}
function vanityWings() {
  if (vanityWings.cv) return vanityWings.cv;
  const W = 230, H = 130, [cv, x] = offCanvas(W, H), cx = W / 2, cy = H * 0.62;
  for (const sd of [-1, 1]) for (let i = 9; i >= 0; i--) {   // 从下往上画：上面的长羽（初级飞羽）压在下面的短羽上
    const a = -1.0 + i * 0.14, L = 100 - Math.abs(i - 2) * 7, wd = 8.5 - i * 0.3;
    x.save(); x.translate(cx + sd * 5, cy); x.scale(sd, 1); x.rotate(a);
    const g = x.createLinearGradient(0, 0, L, 0); g.addColorStop(0, 'rgba(255,250,225,1)'); g.addColorStop(0.5, 'rgba(255,214,110,0.9)'); g.addColorStop(1, 'rgba(255,170,40,0.15)');
    x.fillStyle = g; x.beginPath(); x.ellipse(L / 2, 0, L / 2, wd, 0, 0, TAU); x.fill();
    x.strokeStyle = 'rgba(176,112,20,0.85)'; x.lineWidth = 1.4; x.stroke();   // 深金描边：亮的城镇背景上也看得清
    x.strokeStyle = 'rgba(255,255,255,0.8)'; x.lineWidth = 1; x.beginPath(); x.moveTo(4, 0); x.lineTo(L * 0.8, 0); x.stroke(); x.restore();
  }
  return (vanityWings.cv = cv);
}

/* ---- 2. 武器上的光效（外观层 AvatarLayer.weapon 在武器的变换里调用两次；坐标 = 武器图像素） ----
   back = true：画武器图之前 —— 外层第二圈光晕（+15 起）→ 大光晕（正常混合的外圈 + 叠加发光）→ 紧贴刀身的一圈实色描边（rim）→ 爆闪的光 → 电弧；
                刀身画在它们上面，所以武器轮廓始终清楚，光从刀身四周透出来。
   back = false：画武器图之后 —— 刀身外沿往外飘的火花、绕着武器转的光点（椭圆轨道把整把武器包在里面，不压刀身）、尖端星芒。 */
const VANITY_SPARK_K = 0.6;
function vanityWeaponFx(c, L, w, A, im, s, back) {
  const G = L.glow; if (!G || !im) return;
  const t = performance.now() / 1000 + (L.seed ??= Math.random() * 9), A0 = c.globalAlpha;
  const z = ((L.m.S && L.m.S.res) || 1) / s, pole = A.kind === 'pole';   // z：1 个游戏像素 = 多少武器图像素（光效大小跟着角色走，不受画布缩放影响）
  const ox = pole ? -A.tx : -A.gx, oy = pole ? -A.ty : -A.gy;
  const x0 = pole && w.bk !== undefined ? Math.max(0, A.tx - (w.len + w.bk + 6) / s) : 0;   // 长杆被身体挡住的那截（和武器图同样裁掉）
  const pu = 0.78 + 0.22 * Math.sin(t * G.pulse * TAU), R = v => Math.max(2, Math.min(160, Math.round(v * z / 2) * 2));   // 半径按游戏像素算（武器图存多大都一样）
  const blit = (img, pad, a) => {
    if (a <= 0.01) return; c.globalAlpha = A0 * Math.min(1, a);
    if (x0 > 0) { const q = x0 + pad; c.drawImage(img, q, 0, img.width - q, img.height, ox + x0, oy - pad, img.width - q, img.height); }
    else c.drawImage(img, ox - pad, oy - pad);
  };
  const gx = A.gx + ox, gy = A.gy + oy, tx = A.tx + ox, ty = A.ty + oy, dx = tx - gx, dy = ty - gy, dl = Math.hypot(dx, dy) || 1, nx = -dy / dl, ny = dx / dl, u0 = pole ? 0.45 : 0.2;
  const multi = Array.isArray(G.col), n = multi ? G.col.length : 1, ph = (t * 0.5) % n, ci = Math.floor(ph), cf = ph - ci;
  const colA = multi ? G.col[ci] : G.col, colB = multi ? G.col[(ci + 1) % n] : G.col, colC = multi ? G.col[(ci + 2) % n] : G.col;   // 多色：描边 / 光晕 / 外圈同时是三种颜色，一起轮换（七彩）
  c.save();
  if (back) {
    // 一层光晕：正常混合的外圈（亮背景上也看得见）+ 叠加发光；多色时两种颜色交叉渐变
    const layer = (col1, col2, f, rr, aRing, aGlow) => {
      const H1 = vanityHalo(im, col1, rr), H2 = f > 0.01 ? vanityHalo(im, col2, rr) : H1;
      c.globalCompositeOperation = 'source-over'; blit((f < 0.5 ? H1 : H2).ring, H1.p, aRing);
      c.globalCompositeOperation = 'lighter'; blit(H1.cv, H1.p, aGlow * (1 - f)); if (f > 0.01) blit(H2.cv, H2.p, aGlow * f);
    };
    if (G.aura2) { if (G.aura2 === 'cycle') layer(colC, colA, cf, R(G.r * 1.7), 0.4 * pu, 0.6 * pu); else layer(G.aura2, G.aura2, 0, R(G.r * 1.7), 0.35 * pu, 0.55 * pu); }   // +15 起：外层第二圈（另一种颜色，更大）
    layer(colA, colB, multi ? cf : 0, R(G.r), G.a * 0.7 * pu, G.a * 1.1 * pu);                              // 大光晕
    if (G.rim) layer(multi ? colB : colA, multi ? colC : colB, multi ? cf : 0, R(G.rim), Math.min(1, 0.55 + G.a * 0.5), G.a * 0.9);     // 紧贴刀身的实色描边：沿整把武器一圈看得清的颜色
    // 待机爆闪的光：整把武器外面亮一下（刀身挡在前面）
    if (G.flare) { const ft = t % G.flare, D = 0.5; if (ft < D) { const H = vanityHalo(im, vanityCol(G, t), R(G.r * 1.3)); c.globalCompositeOperation = 'lighter'; blit(H.cv, H.p, (1 - ft / D) * 0.9); } }
    // 电弧：沿刃身两道闪电，每秒换 14 次形状；在刀身后面，只从两侧露出来
    if (G.arcs) {
      const sd = Math.floor(t * 14); c.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 2; k++) {
        if (vanityHash(sd * 1.3 + k * 9.1) < 0.3) continue;
        c.beginPath();
        for (let i = 0; i <= 6; i++) { const u = u0 + (1 - u0) * i / 6, jj = (vanityHash(sd + k * 11 + i * 3.7) - 0.5) * 22 * z * (i && i < 6 ? 1 : 0.3), px = gx + dx * u + nx * jj, py = gy + dy * u + ny * jj; if (i) c.lineTo(px, py); else c.moveTo(px, py); }
        c.globalAlpha = A0 * 0.6; c.strokeStyle = G.amp ? G.col2 : vanityCol(G, t); c.lineWidth = 3.4 * z; c.stroke();
        c.globalAlpha = A0 * 0.95; c.strokeStyle = '#ffffff'; c.lineWidth = 1.2 * z; c.stroke();
      }
    }
    c.restore(); return;
  }
  c.globalCompositeOperation = 'lighter';
  const half = Math.max(2, A.h * 0.22);   // 刀身半宽（武器图像素，粗估）
  // 火花：每颗有固定寿命，位置由（编号, 第几轮）哈希出来；从刀身外沿往外飘（不压在刀身上）；强化是十字星，增幅是菱形碎片
  if (G.spark) {
    const life = 0.6, cnt = Math.min(16, Math.round(G.spark * life * VANITY_SPARK_K * 2)), rb = G.col2 === 'rainbow', big = G.lv >= 13 ? 2.2 : 1.7;
    if (!rb) c.fillStyle = G.col2 || G.col;
    for (let j = 0; j < cnt; j++) {
      const q = t / life + j / cnt, cy = Math.floor(q), u = q - cy, h1 = vanityHash(j * 7.13 + cy * 1.77), h2 = vanityHash(j * 3.1 + cy * 5.3);
      const along = u0 + (1 - u0) * h1, off = (half + (2 + u * (6 + h2 * 8)) * z) * (h2 < 0.5 ? -1 : 1);
      const px = gx + dx * along + nx * off, py = gy + dy * along + ny * off, sz = big * (1 - u * 0.4) * z;
      c.globalAlpha = A0 * Math.sin(u * Math.PI) * (0.6 + 0.4 * G.a);
      if (rb) c.fillStyle = `hsl(${(t * 140 + j * 47) % 360 | 0},100%,72%)`;
      if (G.amp) { c.beginPath(); c.moveTo(px, py - sz * 1.9); c.lineTo(px + sz, py); c.lineTo(px, py + sz * 1.9); c.lineTo(px - sz, py); c.closePath(); c.fill(); }
      else { c.fillRect(px - sz * 1.8, py - sz * 0.3, sz * 3.6, sz * 0.6); c.fillRect(px - sz * 0.3, py - sz * 1.8, sz * 0.6, sz * 3.6); }
    }
  }
  // 环绕光点（+14 起）：椭圆轨道把整把武器包在里面（长轴沿刀身、比刀身长一截），光点永远在刀身外面；转到“前面”的一半更大更亮
  if (G.orbit) {
    const cx = gx + dx * (u0 + 1) / 2, cy = gy + dy * (u0 + 1) / 2, ea = dl * (1 - u0) / 2 + 8 * z, eb = half + 7 * z, rb = G.col2 === 'rainbow', ux = dx / dl, uy = dy / dl;
    const at = b => [cx + ux * ea * Math.cos(b) + nx * eb * Math.sin(b), cy + uy * ea * Math.cos(b) + ny * eb * Math.sin(b)];
    for (let j = 0; j < G.orbit; j++) {
      const a = t * 2.2 + j / G.orbit * TAU, front = 0.65 + 0.35 * Math.sin(a), [px, py] = at(a);
      const col = rb ? `hsl(${(t * 120 + j * 51) % 360 | 0},100%,65%)` : (G.amp ? G.col2 : vanityCol(G, t)), rr = (4 + 2 * front) * z;
      c.globalAlpha = A0 * 0.8 * front; c.drawImage(vanityDot(rb ? '#ffffff' : col), px - rr * 1.6, py - rr * 1.6, rr * 3.2, rr * 3.2);
      c.fillStyle = rb ? col : '#ffffff'; c.globalAlpha = A0 * front; c.beginPath(); c.arc(px, py, rr * 0.42, 0, TAU); c.fill();
      c.fillStyle = col;
      for (let k = 1; k <= 3; k++) { const [qx, qy] = at(a - k * 0.16); c.globalAlpha = A0 * 0.5 * front * (1 - k / 4); c.beginPath(); c.arc(qx, qy, rr * 0.4 * (1 - k / 5), 0, TAU); c.fill(); }   // 拖尾
    }
  }
  // 待机爆闪：每隔 flare 秒，尖端炸开一颗星芒
  if (G.flare) {
    const ft = t % G.flare, D = 0.5;
    if (ft < D) {
      const k = ft / D, col = vanityCol(G, t), img = vanityFxImg('spark', col), Rr = (10 + 26 * Math.sin(k * Math.PI / 2)) * z;
      c.globalAlpha = A0 * (1 - k); if (img) c.drawImage(img, tx - Rr, ty - Rr, Rr * 2, Rr * 2); else c.drawImage(vanityDot(col), tx - Rr, ty - Rr, Rr * 2, Rr * 2);
    }
  }
  c.restore();
}
// 挥砍拖尾（AvatarLayer.over 调用；坐标 = 帧像素，和 w.gx / w.gy 同一空间）
function vanityTrail(c, L, F, f) {
  const G = L.glow, w = F.wpn, A = L.A; if (!w || !A || !L.wim) return;
  if (/^(idle|walk|run)/.test(f)) { if (L.trail) L.trail.length = 0; return; }   // 站着 / 走路 / 跑步的帧不画（只有出招才有拖尾）
  const now = performance.now() / 1000, T = L.trail || (L.trail = []), len = A.kind === 'pole' ? w.len : A.size, gx = w.gx - F.ax, gy = w.gy - F.ay;
  const last = T[T.length - 1];
  if (!last || last.ang !== w.ang || last.gx !== gx || last.gy !== gy) { T.push({ gx, gy, ang: w.ang, len, t: now }); if (T.length > 16) T.shift(); }
  while (T.length > 1 && now - T[1].t > G.trail) T.shift();
  if (T.length < 2) return;
  let sweep = 0, big = 0; for (let i = 1; i < T.length; i++) { const d = Math.abs(vanityAngD(T[i].ang, T[i - 1].ang)); sweep += d; big = Math.max(big, d); }
  if (sweep < 0.9 || big < 0.35) return;   // 走路 / 跑步时手臂的小摆动不算挥砍
  const A0 = c.globalAlpha;
  c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = vanityCol(G, now);
  for (let i = 1; i < T.length; i++) {
    const a = T[i - 1], b = T[i], age = now - b.t, da = vanityAngD(b.ang, a.ang); if (age > G.trail || Math.abs(da) < 0.2) continue;
    const al = (1 - age / G.trail) * 0.6 * G.a;
    let pix = 0, piy = 0, pox = 0, poy = 0;
    for (let k = 0; k <= 4; k++) {
      const f = k / 4, g0 = lerp(a.gx, b.gx, f), g1 = lerp(a.gy, b.gy, f), an = a.ang + da * f, l = lerp(a.len, b.len, f), cs = Math.cos(an), sn = Math.sin(an);
      const ix = g0 + cs * l * 0.35, iy = g1 + sn * l * 0.35, ex = g0 + cs * l, ey = g1 + sn * l;
      if (k) { c.globalAlpha = A0 * al * (0.35 + 0.65 * f); c.beginPath(); c.moveTo(pix, piy); c.lineTo(pox, poy); c.lineTo(ex, ey); c.lineTo(ix, iy); c.closePath(); c.fill(); }
      pix = ix; piy = iy; pox = ex; poy = ey;
    }
  }
  c.restore();
}
// +15 起脚下的光环（AvatarLayer.under 调用；原点 = 脚底）
function vanityGround(c, L) {
  const G = L.glow, t = performance.now() / 1000 + (L.seed || 0), R = 36 * ((L.m.S && L.m.S.res) || 1);
  const col = vanityCol(G, t), pu = 0.75 + 0.25 * Math.sin(t * 2), A0 = c.globalAlpha, img = vanityFxImg('rune', G.amp ? G.col2 : col);
  c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = A0 * 0.4 * pu; c.drawImage(vanityDot(col), -R * 1.3, -R * 0.42, R * 2.6, R * 0.84); c.restore();
  if (img) drawSpr(c, img, 0, 0, R * 2, R * 0.66, { ground: true, rot: t * 0.6, alpha: 0.6 * pu });
}

/* ---- 3. 城镇移速（townSpd） ---- */
const VANITY_TOWN = { piece: 0.02, rarePiece: 0.03, set8: { adv: 0.14, rare: 0.36 } };
function vanityTownSpd(eq) {
  eq = eq || {}; let v = 0; const sets = {};
  for (const s of AV_SLOTS) {
    const it = eq[s]; if (!it) continue;
    const S = it.set && typeof CASH_SETS !== 'undefined' ? CASH_SETS[it.set] : null;
    v += S && S.tier === 'rare' ? VANITY_TOWN.rarePiece : VANITY_TOWN.piece;
    if (it.set) sets[it.set] = (sets[it.set] || 0) + 1;
  }
  for (const id in sets) if (sets[id] >= 8) { const S = typeof CASH_SETS !== 'undefined' && CASH_SETS[id]; v += VANITY_TOWN.set8[S && S.tier === 'rare' ? 'rare' : 'adv']; }
  return +v.toFixed(3);
}
let vanityTownCache = null;
for (const ev of ['equip', 'unequip', 'charLeave', 'sceneEnter']) bus.on(ev, () => { vanityTownCache = null; });
// 城镇移动的速度倍率：只在城镇场景（不在决斗 / 地下城）
function vanityTownMul() {
  if (game.scene !== 'town' || game.duel || game.pvp) return 1;
  if (vanityTownCache === null) { inv.ensure(); vanityTownCache = vanityTownSpd(inv.equip); }
  return 1 + vanityTownCache;
}
// 套装 8 件效果的说明里补上城镇移速
for (const id in (typeof CASH_SETS !== 'undefined' ? CASH_SETS : {})) {
  const B = SETS[id] && SETS[id].bonus[8], rare = CASH_SETS[id].tier === 'rare'; if (!B) continue;
  B.desc = `${B.desc || ''}；城镇移动速度 +${Math.round(VANITY_TOWN.set8[rare ? 'rare' : 'adv'] * 100)}%（每件另有 +${Math.round((rare ? VANITY_TOWN.rarePiece : VANITY_TOWN.piece) * 100)}%，8 件合计 +${Math.round((VANITY_TOWN.set8[rare ? 'rare' : 'adv'] + 8 * (rare ? VANITY_TOWN.rarePiece : VANITY_TOWN.piece)) * 100)}%）`;
}
// 状态窗口的一行
function vanityStatusLine(eq = inv.equip) {
  inv.ensure(); const v = vanityTownSpd(eq), n = AV_SLOTS.filter(s => eq[s]).length;
  const sky = typeof cashLook === 'function' ? cashLook(eq).sky8 : null;
  return h('div', {}, '城镇移动速度：', h('b', { class: 'gold' }, `+${Math.round(v * 100)}%`),
    h('span', { class: 'dim' }, v ? `（装扮 ${n} 件${sky ? ` · ${CASH_SETS[sky].name} 8 件` : ''}，只在城镇生效）` : '（每件装扮 +2%，集齐 8 件高级装扮 / 天空套加得更多；只在城镇生效）'));
}

/* ---- 4. 物品提示：+10 起武器名发光、写出光效等级；装扮写出城镇移速 ---- */
function vanityTipDecorate(el, it) {
  if (!el || !it || it.kind !== 'equip') return;
  if (it.slot === 'weapon') {
    const G = vanityGlowRow(vanityGlowOf(it)); if (!G) return;
    const col = Array.isArray(G.col) ? G.col[0] : G.col, nm = el.querySelector('.nm');
    if (nm && G.lv >= VANITY_BADGE_LV) { nm.classList.add('vglow'); if (G.lv >= 12) nm.classList.add('vglow2'); nm.style.setProperty('--vg', col); }
    const ex = [G.rim && '刀身描边', G.spark && '火花', G.trail && '挥砍拖尾', G.flare && '待机爆闪', G.orbit && '环绕光点', G.aura2 && '双层光晕', G.ground && '脚下光环', G.arcs && '电弧'].filter(Boolean);
    el.append(h('div', { class: 'sec vglowl', style: `color:${col}` }, `✦ ${G.amp ? '增幅' : '强化'}光效 +${G.lv}「${G.nm}」${ex.length ? '：' + ex.join(' · ') : ''}`));
  } else if (AV_SLOTS.includes(it.slot)) {
    const S = it.set && typeof CASH_SETS !== 'undefined' ? CASH_SETS[it.set] : null, v = S && S.tier === 'rare' ? VANITY_TOWN.rarePiece : VANITY_TOWN.piece;
    el.append(h('div', { class: 'sec vtown' }, `城镇移动速度 +${Math.round(v * 100)}%（只在城镇生效）`));
  }
}
{ const one0 = itemTipOne; itemTipOne = function (it, cur, head, who) { const el = one0(it, cur, head, who); try { vanityTipDecorate(el, it); } catch (e) { console.error('光效提示', e); } return el; }; }
addStyle(`#itip .nm.vglow{filter:drop-shadow(0 0 .22em var(--vg))}#itip .nm.vglow2{animation:vglow 1.4s ease-in-out infinite}
@keyframes vglow{50%{filter:drop-shadow(0 0 .45em var(--vg)) drop-shadow(0 0 .12em #fff)}}#itip .vglowl{font-weight:700}#itip .vtown{color:#9fe8ff}`);

/* ---- 5. 名牌：+10 起的等级徽章、天空套 8 件的套装色边框（world.js 自己的名牌、net/town.js 其他玩家的名牌调用） ---- */
const VANITY_SKY = {
  av_sky1: { col: '#ffe9a0', plate: '#ffd86a', wings: 1, step: 0.1 },   // 天穹圣翼：光翼 + 光羽脚印
  av_sky2: { col: '#ff7a2a', plate: '#ff7040', flame: 1, step: 0.08 },  // 炎龙之魂：火环 + 火焰脚印
};
// 名牌抬高：天空套 8 件头顶有光环 / 光翼，名牌按原高度会压住头（用户截图反馈）
function vanityLabelLift(look) { return look && look.cash && VANITY_SKY[look.cash.sky8] ? 22 : 0; }
function vanityPlate(c, X, ny, half, look) {
  if (!look) return;
  const K = look.cash && VANITY_SKY[look.cash.sky8], G = look.glow && look.glow.lv >= VANITY_BADGE_LV ? vanityGlowRow(look.glow) : null;
  if (!K && !G) return;
  c.save();
  if (K) {
    const x0 = X - half - 6, x1 = X + half + 6, y0 = ny - 11, y1 = ny + 4;
    c.fillStyle = 'rgba(16,10,6,.55)'; c.fillRect(x0, y0, x1 - x0, y1 - y0);
    c.strokeStyle = K.plate; c.lineWidth = 1; c.strokeRect(x0 + 0.5, y0 + 0.5, x1 - x0 - 1, y1 - y0 - 1);
    c.fillStyle = K.plate; for (const px of [x0, x1]) { c.beginPath(); c.moveTo(px - 3, ny - 3.5); c.lineTo(px, ny - 8); c.lineTo(px + 3, ny - 3.5); c.lineTo(px, ny + 1); c.closePath(); c.fill(); }
  }
  if (G) {
    const txt = `+${G.lv}`, col = vanityCol(G); c.font = 'bold 8px "PingFang SC","Microsoft YaHei",sans-serif';
    const bw = c.measureText(txt).width + 6, bx = X - half - (K ? 11 : 4) - bw, by = ny - 9;
    c.fillStyle = G.amp ? 'rgba(56,0,16,.85)' : 'rgba(8,14,30,.85)'; c.fillRect(bx, by, bw, 11);
    c.strokeStyle = col; c.lineWidth = 1; c.strokeRect(bx + 0.5, by + 0.5, bw - 1, 10);
    c.fillStyle = G.amp ? '#ff6a90' : col; c.textAlign = 'center'; c.fillText(txt, bx + bw / 2, by + 8.5);
  }
  c.restore();
}
// 自己的名牌用的外观（换装 / 强化后重算）
let vanityOwnLook = null;
for (const ev of ['equip', 'unequip', 'charLeave', 'sceneEnter', 'enhance', 'amplify']) bus.on(ev, () => { vanityOwnLook = null; });
function vanityOwn() { if (!vanityOwnLook) { inv.ensure(); vanityOwnLook = { glow: vanityGlowOf(inv.equip.weapon), cash: typeof cashLook === 'function' ? cashLook(inv.equip) : null }; } return vanityOwnLook; }

/* ---- 6. 天空套 8 件：城镇里的脚印 / 光翼 / 火环（shop_pet.js cashEntTick 每个逻辑步调用） ---- */
const VANITY_SKY_FULL = 9;   // 同屏最多几个人画完整的天空特效（自己总是算在内；再多的只保留原来的身上光点）
let vanitySkyT = -1, vanitySkyN = 0;
function vanitySkyTick(e, C, sky8, dt, keep) {
  if (vanitySkyT !== game.t) { vanitySkyT = game.t; vanitySkyN = 0; }
  const full = !!VANITY_SKY[sky8] && game.scene === 'town' && (e === game.player || vanitySkyN++ < VANITY_SKY_FULL - 1);
  keep('skyFx', full, () => ({ t: 0, dur: Infinity, y: e.y, draw(c) { vanitySkyDraw(c, e); } }));
  const S = C.sky || (C.sky = { steps: [], lx: e.x, ly: e.y, idle: 1, st: 0, set: null });
  if (!full) { S.steps.length = 0; S.set = null; return; }
  S.set = sky8; C.skyFx.y = e.y - 0.6;
  const d = Math.hypot(e.x - S.lx, e.y - S.ly), moving = d > 0.4 && d < 80; S.lx = e.x; S.ly = e.y;   // 一步挪太远 = 换场景 / 纠正位置，不算走路
  S.idle = clamp(S.idle + (moving ? -dt * 4 : dt * 1.2), 0, 1);
  if (moving && (S.st -= dt) <= 0 && S.steps.length < 14) { S.st = VANITY_SKY[sky8].step; S.steps.push({ x: e.x + rnd(-8, 8), y: e.y + rnd(-3, 3), t: 0, life: 0.9 }); }
  for (let i = S.steps.length - 1; i >= 0; i--) { const q = S.steps[i]; if ((q.t += dt) >= q.life) S.steps.splice(i, 1); }
}
function vanitySkyDraw(c, e) {
  const C = e._cash, S = C && C.sky; if (!S || !S.set) return;
  const K = VANITY_SKY[S.set], t = C.t, X = sx(e.x); if (X < -140 || X > WW + 140) return;
  const A0 = e.a !== undefined ? e.a : 1;   // 其他玩家淡入淡出
  c.save(); c.globalCompositeOperation = 'lighter';
  const fl = K.flame ? vanityFxImg('flame', K.col) : null, sp = K.wings ? vanityFxImg('spark', K.col) : null, dot = vanityDot(K.col);
  for (const q of S.steps) {
    const u = q.t / q.life, a = (1 - u) * A0, qx = sx(q.x), qy = sy(q.y, 0);
    c.globalCompositeOperation = 'source-over'; c.globalAlpha = a * 0.45; c.drawImage(dot, qx - 10, qy - 4, 20, 8); c.globalCompositeOperation = 'lighter';
    if (fl) { const hh = 20 * (1 - u * 0.6); c.globalAlpha = a * 0.85; c.drawImage(fl, qx - hh * 0.35, qy - hh - u * 8, hh * 0.7, hh); }
    else if (sp) { const s = 13 * (1 - u * 0.5); c.globalAlpha = a * 0.9; c.drawImage(sp, qx - s / 2, qy - s / 2 - 4 - u * 16, s, s); }
  }
  const I = S.idle * A0;
  if (I > 0.02) {
    const Y = sy(e.y, e.z || 0), pu = 0.8 + 0.2 * Math.sin(t * 2.2);
    c.globalCompositeOperation = 'source-over'; c.globalAlpha = I * 0.35 * pu; c.drawImage(dot, X - 46, Y - 11, 92, 22); c.globalCompositeOperation = 'lighter';   // 脚下的光晕
    if (K.wings) { const W = vanityWings(), k = 0.92 + 0.08 * Math.sin(t * 2.4), ww = W.width * 0.7 * k, wh = W.height * 0.7, wy = Y - 55 - wh * 0.62; c.globalCompositeOperation = 'source-over'; c.globalAlpha = I * 0.8; c.drawImage(W, X - ww / 2, wy, ww, wh); c.globalCompositeOperation = 'lighter'; c.globalAlpha = I * 0.3 * pu; c.drawImage(W, X - ww / 2, wy, ww, wh); }   // 光翼：从后背展开，缓慢扇动
    if (fl) {   // 火环：背后一道升腾的火焰 + 脚下一圈火苗
      const fh = 96 + 10 * Math.sin(t * 5), fw = 62;
      c.globalCompositeOperation = 'source-over'; c.globalAlpha = I * 0.3; c.drawImage(fl, X - fw / 2, Y - fh, fw, fh);
      c.globalCompositeOperation = 'lighter'; c.globalAlpha = I * 0.45 * pu; c.drawImage(fl, X - fw / 2, Y - fh, fw, fh);
      c.globalCompositeOperation = 'source-over'; c.globalAlpha = I * 0.4; c.drawImage(dot, X - 40, Y - 9, 80, 18); c.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 6; i++) { const a = t * 0.8 + i / 6 * TAU, hh = 28 + 9 * Math.sin(t * 7 + i * 2); c.globalAlpha = I * (0.7 + 0.25 * Math.sin(a)); c.drawImage(fl, X + Math.cos(a) * 30 - hh * 0.35, Y + Math.sin(a) * 9 - hh, hh * 0.7, hh); }
    }
  }
  c.restore();
}
