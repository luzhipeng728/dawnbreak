/* =====================================================================
   格斗家转职：街霸（男，brawler）—— B6（docs/CLASS_PLAN_FIGHTER.md §4 块 B6；官方资料 docs/SKILLS_OFFICIAL_fighter.md 第 6 节；逐技能对照 docs/skills/fighter_brawler_final.md）
   魔法百分比职业（J.dmgType 'mag'，吃智力），重甲。本文件 = 转职 ~ 20 级（投掷 / 擒月炎 / 伏虎霸王拳 / 挑衅 / 滑铲 / 毒雷 / 极恶飞锁），
   fighter_brawler_p1.js = 一觉之后（千手罗汉 / 暗街之王 / 归元·街霸）。
   招牌机制：
     4 种投掷物装填（毒瓶 10 / 毒针 10 / 砖块 10 / 罗网 5）：每投一次耗 1 个，“再投间隔” = 技能冷却（S.cd），用完进入“装填冷却”（FB_RELOAD）后自动装满，
       MP 在装填时扣（官方：装好以后投掷不耗 MP）。引擎的 S.charges 只用来计数 / 显示（S.reload 设成很大，不走引擎的逐颗补充），装填由本文件的被动刷新做。
     强化投掷（←→+C，无动作施放）：只强化下一次投掷，多耗投掷物（毒瓶 / 罗网 2、砖块 3、毒针 4、爆破污桶 / 逆道·爆狱 0）；学了后备口袋才能在普攻 / 转职技能中按。
     后街战术（BUFF）：抛沙和投掷一次扔两个（耗 2 个；罗网除外；强化投掷优先）；擒月炎的爆炸、毒雷的毒柱变大。
     按敌人身上的异常个数加伤（最多 3 个）：擒月炎 +20%、狂·霸王拳 +20%（冲击波范围 +10%）、燃火轰天炮 +25%（按压制时的个数）。
     诡诈之道（二觉被动）：毒雷 / 极恶飞锁 / 千锁乱舞 / 爆破污桶 / 飞沙走石 施放中可以取消接抛沙和投掷（霸体、不耗投掷物）。
   帧：人物帧由 B1 出（帧名 fb_ 前缀，见 J.anims），没出之前用格斗家通用帧 / 矢量占位（CLIPS.fighter 的 fb* 片段）。
   道具（瓶 / 砖 / 针 / 网 / 雷 / 桶 / 锁链 / 链钩）全部运行时程序绘制，特效复用 fx 素材（poison / explosion / rock / dust / shock / burst / lava / jv_flame）。
   ===================================================================== */
const FB_JOB = 'brawler';
const FB_COL = { poison: '#a45ae0', fire: '#ff7a2a', bleed: '#e0303a', net: '#e0cf98', brick: '#c0603a', chain: '#aab0bc', gas: '#9ad05a', pink: '#ff5ad0', iron: '#8a93a3' };
const FB_OUT = '#2a1a14';
// 算“异常”的状态（按个数加伤）：不含挑衅、强制硬直
const FB_ABN = ['poison', 'bleed', 'burn', 'blind', 'stun', 'slow', 'bind', 'shock', 'freeze', 'root', 'curse', 'sleep', 'confuse'];
const FB_THROWS = ['fb_poison', 'fb_needle', 'fb_brick', 'fb_net'];
const FB_RELOAD = { fb_poison: 7, fb_needle: 6, fb_brick: 7, fb_net: 17 };   // 装填冷却（官方冷却），再投间隔写在 S.cd
const FB_RELOAD_MP = { fb_poison: 30, fb_needle: 30, fb_brick: 35, fb_net: 60 };
const FB_STRONG_COST = { fb_poison: 2, fb_needle: 4, fb_brick: 3, fb_net: 2 };
const FB_RB_FROM = ['fb_mine', 'fb_lariat', 'fb_chain', 'fb_barrel', 'fb_cavein'];   // 诡诈之道：这些技能中可以取消接抛沙 / 投掷
const FB_RB_TO = ['f_sand', 'fb_poison', 'fb_needle', 'fb_brick', 'fb_net'];
const isFb = p => !!p && p.cls === 'fighter' && jobOf(p) === FB_JOB;

/* ---- 异常 ---- */
function fbN(t) { if (!t || !t.status) return 0; let n = 0; for (const k of FB_ABN) if (t.status[k]) n++; return n; }
const fbAbnMul = (t, per, n) => 1 + per * Math.min(3, n ?? fbN(t));
// 异常持续时间倍率：诡诈之道（所有怪物异常抗性降低）、挑衅光环（光环内的敌人异常抗性降低）——本作没有异常抗性，折算成持续时间
function fbDurMul(p, t) { let m = 1; if (hasSkill(p, 'fb_rulebreak')) m += 0.2; if (t && t._fbAura > game.t) m += 0.15 + 0.01 * skLv(p, 'fb_taunt'); return m; }
function fbAbn(p, t, kind, dur, dps = 0) { if (!t || t.dead) return; addStatus(t, kind, dur * fbDurMul(p, t), { dps: dps ? atkOf(p, 'mag') * dps : 0, src: p }); }
// 以 (x,y) 为中心的圆形范围攻击，每个目标可以有自己的伤害倍率（o.mul(t)）；返回打中的目标
function fbArea(e, x, y, r, h, o = {}) {
  const fake = { x: x - e.face * 10, y, z: 0, face: e.face }, out = [];
  r *= rngOf(e);
  for (const t of ents.slice()) {
    if (!foe(e, t) || t.invul > 0 || (t.st === 'down' && !h.downHit) || t.z > (o.zMax ?? 140) + (o.z || 0) || !inGround(t, x, y, r)) continue;
    const m = o.mul ? o.mul(t) : 1; if (!m) continue;   // 倍率 0 = 这个目标不算（例：每个敌人只吃一次、离自己太近打不到）
    applyHit(e, t, { type: 'mag', ...h, box: null, dmg: (h.dmg ?? 1) * m }, { proj: true, src: fake }); out.push(t);
  }
  return out;
}
// 前方盒子的立即判定（带逐目标倍率）
function fbBox(e, box, h, o = {}) {
  const B = atkBox(e, { box }), out = [];
  for (const t of ents.slice()) { if (!canHit(e, t, h) || !overlaps(B, t)) continue; const m = o.mul ? o.mul(t) : 1; if (!m) continue; applyHit(e, t, { type: 'mag', ...h, dmg: (h.dmg ?? 1) * m }, { proj: true, src: e }); out.push(t); }
  return out;
}
const fbAim = (e, def, range) => { const A = aimAhead(e, def, range, 70); const R = game.room; return { x: R ? clamp(A.x, R.x0 + 20, R.x1 - 20) : A.x, y: A.y, t: A.t }; };
const fbBack = p => { const I = p.pad; return !!I && I.dx && I.dx() === -p.face; };
const fbFwd = p => { const I = p.pad; return !!I && I.dx && I.dx() === p.face; };

/* ---- 装填 ---- */
// 装填数 = 基础 + 千手奥义；再投间隔 / 装填冷却按千手奥义缩短（冷却减少照常生效）
function fbCap(p, id) { const S = SKILLS[id], th = skLv(p, 'fb_thousand'); return S.charges + (th ? 1 + Math.floor((th - 1) / 3) : 0); }
function fbRethrow(p, id) { const th = skLv(p, 'fb_thousand'); return SKILLS[id].cd * (th ? 0.96 - 0.01 * th : 1) * (p.cdMul || 1); }
function fbReloadT(p, id) { const th = skLv(p, 'fb_thousand'); return FB_RELOAD[id] * (th ? 1 - 0.02 * th : 1) * (p.cdMul || 1) * (game.pvp ? 1.3 : 1); }
function fbStartReload(p, id) { const Q = chargesOf(p, id); if (!Q) return; Q.n = 0; Q.rl = true; p.cool[id] = fbReloadT(p, id); }
function fbFill(p, id) { const Q = chargesOf(p, id); if (!Q) return; Q.cap = fbCap(p, id); Q.n = Q.cap; Q.rl = false; }
function fbReloadTick(p) {
  for (const id of FB_THROWS) {
    if (!hasSkill(p, id)) continue;
    const Q = chargesOf(p, id), cap = fbCap(p, id);
    if (Q.cap === undefined) Q.cap = SKILLS[id].charges;
    if (Q.cap !== cap) { if (!Q.rl) Q.n = Math.max(0, Q.n + cap - Q.cap); Q.cap = cap; }
    if (Q.rl && (p.cool[id] || 0) <= 0 && hasSkill(p, 'fb_autoload')) {
      const mp = FB_RELOAD_MP[id]; if (p.mp < mp) continue;
      p.mp -= mp; Q.n = cap; Q.rl = false;
      if (isHuman(p)) fxText(`${SKILLS[id].name} 装填完毕`, p.x, p.y, p.z + 30, { col: '#ffe070', size: 10, dur: 0.6 });
    }
  }
}
// 这次投掷用哪种形态：强化（多耗投掷物）> 后街战术两连投 > 普通；castSkill 已经扣了 1 个
const fbHave = (p, id) => { const Q = p && chargesOf(p, id); return Q ? Q.n + 1 : 99; };
const fbPeekStrong = (p, id) => !!(p && p.buffs && p.buffs.fb_strong && fbHave(p, id) >= (FB_STRONG_COST[id] || 0));
function fbThrowStart(e, id) {
  const a = e.act, Q = chargesOf(e, id), have = Q ? Q.n + 1 : 99, sc = FB_STRONG_COST[id] ?? 0;
  let strong = false, n = 1;
  if (e.buffs.fb_strong && have >= sc) { strong = true; delete e.buffs.fb_strong; }
  else if (id !== 'fb_net' && e.buffs.fb_backstreet && have >= 2) n = 2;
  const use = strong ? sc : n;
  if (Q) { Q.n -= use - 1; if (Q.n <= 0) fbStartReload(e, id); else e.cool[id] = fbRethrow(e, id); }
  a.fbM = { strong, n, use };
  return a.fbM;
}
// 投掷速度（千手奥义 ×1.1）
const fbSpd = p => hasSkill(p, 'fb_thousand') ? 1.1 : 1;

/* ---- 程序绘制的道具（屏幕坐标） ---- */
function fbDrawBottle(c, X, Y, rot, col, s = 1) {
  c.save(); c.translate(X, Y); c.rotate(rot); c.scale(s, s); c.lineWidth = 1.4; c.strokeStyle = FB_OUT;
  c.fillStyle = col; c.beginPath(); c.arc(0, 3, 5.5, 0, TAU); c.fill(); c.stroke();
  c.fillStyle = '#d8e8e0'; c.fillRect(-2, -6, 4, 5); c.strokeRect(-2, -6, 4, 5);
  c.fillStyle = '#8a5a3a'; c.fillRect(-2.6, -8.5, 5.2, 2.8); c.strokeRect(-2.6, -8.5, 5.2, 2.8);
  c.fillStyle = 'rgba(255,255,255,.75)'; c.beginPath(); c.arc(-2, 1.4, 1.5, 0, TAU); c.fill(); c.restore();
}
function fbDrawBrick(c, X, Y, rot, s = 1) {
  c.save(); c.translate(X, Y); c.rotate(rot); c.scale(s, s); c.lineWidth = 1.4; c.strokeStyle = FB_OUT;
  c.fillStyle = '#b8503a'; c.fillRect(-7.5, -4.5, 15, 9); c.strokeRect(-7.5, -4.5, 15, 9);
  c.fillStyle = '#d87a5a'; c.fillRect(-6.5, -3.5, 13, 2.2); c.strokeStyle = '#e8c098'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(-1, -4); c.lineTo(-1, 4); c.stroke(); c.restore();
}
function fbDrawNeedle(c, X, Y, face, col) {
  c.save(); c.lineCap = 'round'; c.strokeStyle = FB_OUT; c.lineWidth = 3; c.beginPath(); c.moveTo(X - 10 * face, Y); c.lineTo(X + 8 * face, Y); c.stroke();
  c.strokeStyle = '#eef4ff'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(X - 10 * face, Y); c.lineTo(X + 9 * face, Y); c.stroke();
  c.fillStyle = col || '#ff6a7a'; c.fillRect(X - 11 * face - 1.5, Y - 1.5, 3, 3); c.restore();
}
function fbDrawNet(c, X, Y, r, alpha = 1, spin = 0) {
  c.save(); c.globalAlpha *= alpha; c.translate(X, Y); c.rotate(spin); c.strokeStyle = FB_OUT; c.lineWidth = 2.6;
  const ring = k => { c.beginPath(); c.ellipse(0, 0, r * k, r * k * 0.8, 0, 0, TAU); c.stroke(); };
  const spokes = () => { for (let i = 0; i < 8; i++) { const a = i * TAU / 8; c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(a) * r, Math.sin(a) * r * 0.8); c.stroke(); } };
  ring(1); ring(0.62); ring(0.3); spokes();
  c.strokeStyle = FB_COL.net; c.lineWidth = 1.2; ring(1); ring(0.62); ring(0.3); spokes();
  c.fillStyle = '#6a5a3a'; for (let i = 0; i < 8; i++) { const a = i * TAU / 8; c.beginPath(); c.arc(Math.cos(a) * r, Math.sin(a) * r * 0.8, 2, 0, TAU); c.fill(); }
  c.restore();
}
function fbDrawMine(c, X, Y, s = 1) {
  c.save(); c.translate(X, Y); c.scale(s, s); c.strokeStyle = FB_OUT; c.lineWidth = 2;
  for (let i = 0; i < 8; i++) { const a = i * TAU / 8 + 0.2; c.beginPath(); c.moveTo(Math.cos(a) * 6, Math.sin(a) * 6); c.lineTo(Math.cos(a) * 10, Math.sin(a) * 10); c.stroke(); }
  c.fillStyle = '#3e4a34'; c.beginPath(); c.arc(0, 0, 7, 0, TAU); c.fill(); c.stroke();
  c.fillStyle = FB_COL.poison; c.fillRect(-7, -1.5, 14, 3);
  c.fillStyle = Math.floor(game.t * 10) % 2 ? '#ff3a3a' : '#7a1a1a'; c.beginPath(); c.arc(0, -3.5, 1.8, 0, TAU); c.fill(); c.restore();
}
// kind: 'wood' 木桶（污物）/ 'iron' 铁桶 / 'bomb' 炸药桶 / 'metal' 金属燃料桶
function fbDrawBarrel(c, X, Y, rot, kind = 'wood', s = 1) {
  const P = { wood: ['#8a5a32', '#5a3a1e', '#9ad05a'], iron: ['#8a93a3', '#4a505a', '#ffd23a'], bomb: ['#c83a2a', '#3a1e1a', '#ffd23a'], metal: ['#6a7a8a', '#3a4450', '#ff7a2a'] }[kind];
  c.save(); c.translate(X, Y); c.rotate(rot); c.scale(s, s); c.lineWidth = 1.6; c.strokeStyle = FB_OUT;
  c.fillStyle = P[0]; c.beginPath(); c.ellipse(0, 0, 10, 13, 0, 0, TAU); c.fill(); c.stroke();
  c.fillStyle = P[1]; c.fillRect(-10, -7, 20, 2.5); c.fillRect(-10, 4.5, 20, 2.5);
  if (kind === 'wood') { c.fillStyle = P[2]; c.beginPath(); c.ellipse(-2, -11, 6, 2.5, 0, 0, TAU); c.fill(); }
  else { c.fillStyle = P[2]; c.fillRect(-4, -2.5, 8, 5); c.strokeRect(-4, -2.5, 8, 5); }
  c.restore();
}
// 锁链：两点之间的链节（sag 下垂量），end = 'hook' 在末端画链钩
function fbDrawChain(c, x0, y0, x1, y1, o = {}) {
  const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy); if (L < 3) return;
  const n = Math.max(2, Math.floor(L / 7)), a = Math.atan2(dy, dx), s = o.s || 1;
  c.save(); c.lineWidth = 2 * s;
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n, X = x0 + dx * t, Y = y0 + dy * t + (o.sag ? Math.sin(t * Math.PI) * o.sag : 0);
    c.strokeStyle = FB_OUT; c.beginPath(); c.ellipse(X, Y, 4.4 * s, (i % 2 ? 1.5 : 2.7) * s, a, 0, TAU); c.stroke();
    c.strokeStyle = i % 2 ? '#6a6e7a' : o.col || '#c8ccd6'; c.lineWidth = 1.1 * s; c.beginPath(); c.ellipse(X, Y, 4.4 * s, (i % 2 ? 1.5 : 2.7) * s, a, 0, TAU); c.stroke(); c.lineWidth = 2 * s;
  }
  if (o.end === 'hook') fbDrawHook(c, x1, y1, a, s * (o.hs || 1));
  c.restore();
}
function fbDrawHook(c, X, Y, ang, s = 1) {
  c.save(); c.translate(X, Y); c.rotate(ang); c.scale(s, s); c.lineCap = 'round';
  c.strokeStyle = FB_OUT; c.lineWidth = 5; c.beginPath(); c.moveTo(-2, 0); c.lineTo(6, 0); c.arc(6, 7, 7, -Math.PI / 2, Math.PI * 0.75); c.stroke();
  c.strokeStyle = '#dfe4ee'; c.lineWidth = 2.4; c.beginPath(); c.moveTo(-2, 0); c.lineTo(6, 0); c.arc(6, 7, 7, -Math.PI / 2, Math.PI * 0.75); c.stroke(); c.restore();
}
function fbDrawRock(c, X, Y, w, rot, alpha = 1) { drawSpr(c, 'rock', X, Y, w, 0, { rot, add: false, alpha }); }
// 挥舞的锁链：绕人物转的链子 + 链钩（dur 秒；ang(k) 给出角度；r 半径）
function fbChainSwingFx(e, dur, o = {}) {
  return addFx({ ent: e, x: e.x, y: e.y + 0.6, z: 0, dur, draw(c) {
    const p = this.ent, k = this.t / this.dur, R = (o.r || 150) * (o.grow ? Math.min(1, k * 4) : 1), a = (o.a0 ?? 0) + (o.spin ?? 14) * this.t;
    const hx = sx(p.x + p.face * 10), hy = sy(p.y, p.z + (o.hz ?? 62)), tx = hx + Math.cos(a) * R * p.face, ty = hy + Math.sin(a) * R * (o.flat ?? 0.32);
    c.save(); c.globalAlpha = k > 0.85 ? (1 - k) / 0.15 : 1; fbDrawChain(c, hx, hy, tx, ty, { end: 'hook', s: o.s || 1 });
    c.globalCompositeOperation = 'lighter'; c.strokeStyle = shade(o.col || '#c8d0e0', 0, 0.35); c.lineWidth = 6; c.beginPath(); c.ellipse(hx, hy, R, R * (o.flat ?? 0.32), 0, a - 0.9 * p.face, a, p.face < 0); c.stroke(); c.restore();
  } });
}

// 一记大幅度的锁链横扫：链钩沿椭圆从 a0 扫到 a1（弧度，0 = 正前方），身后留一道灰白的拖尾
function fbChainSweep(e, dur, o = {}) {
  const r = o.r || 300, a0 = o.a0 ?? Math.PI, a1 = o.a1 ?? 0, fl = o.flat ?? 0.3;
  return addFx({ ent: e, x: e.x, y: e.y + 0.6, z: 0, dur, draw(c) {
    const p = this.ent, k = easeOut(Math.min(1, this.t / (this.dur * 0.75))), a = lerp(a0, a1, k), hx = sx(p.x + p.face * 8), hy = sy(p.y, p.z + 64);
    const px = ang => hx + Math.cos(ang) * r * p.face, py = ang => hy + Math.sin(ang) * r * fl, fade = this.t > this.dur * 0.75 ? 1 - (this.t / this.dur - 0.75) / 0.25 : 1;
    c.save(); c.globalAlpha = fade;
    c.globalCompositeOperation = 'lighter'; c.lineCap = 'round';
    for (let i = 0; i < 3; i++) { c.strokeStyle = shade(o.col || '#c8ccd6', 0, 0.28 - i * 0.08); c.lineWidth = 14 - i * 4; c.beginPath(); const b0 = lerp(a0, a, Math.max(0, 1 - 0.55 - i * 0.1)); for (let j = 0; j <= 12; j++) { const q = lerp(b0, a, j / 12); j ? c.lineTo(px(q), py(q)) : c.moveTo(px(q), py(q)); } c.stroke(); }
    c.globalCompositeOperation = 'source-over'; fbDrawChain(c, hx, hy, px(a), py(a), { end: 'hook', s: o.s || 1.3 }); c.restore();
  } });
}

/* ---- 投掷物 ---- */
// 抛物线投掷物（程序绘制）：碰到敌人或落地时 onLand(pr, t)
function fbLob(e, o) {
  const x0 = e.x + e.face * 20, z0 = e.z + (o.z0 ?? 72), T = o.T || 0.45, vz0 = o.vz ?? 220;
  const pr = spawnProj({ owner: e, x: x0, y: e.y, z: z0, vx: (o.tx - x0) / T, vy: ((o.ty ?? e.y) - e.y) / T, vz: vz0, grav: (z0 + vz0 * T) * 2 / (T * T), life: T + 0.05,
    w: o.bw || 12, d: o.bd || 14, h: o.bh || 20, face: e.face, pierce: true, shadow: o.shadow ?? 6, hit: null, spin: 0,
    update(q, dt) { q.spin += dt * (o.spinV ?? 14) * q.face; if (o.stopOnHit !== false && q.t > 0.04 && !q.hitT) for (const t of ents) if (foe(e, t) && t.invul <= 0 && t.st !== 'down' && Math.abs(t.x - q.x) < t.w + q.w && Math.abs(t.y - q.y) < t.d + q.d && q.z < t.z + t.hurtH() && q.z + q.h > t.z) { q.hitT = t; q.t = q.life; break; }
      if (o.update) o.update(q, dt); },
    onEnd(q) { if (o.onLand) o.onLand(q, q.hitT || null); },
    draw(c, q) { o.draw(c, sx(q.x), sy(q.y, q.z), q); } });
  return pr;
}
// 毒瓶（普通）：落点 / 撞到敌人时碎开，半径 100（官方毒范围 200px）的毒液；kind: 'poison' 毒瓶 / 'fire' 火焰瓶 / 'both' 逆道·皆允的特制瓶
function fbBottle(e, lv, o = {}) {
  const kind = o.kind || 'poison', A = fbAim(e, 230, 330), tx = (o.tx ?? A.x) + (o.dx || 0) * e.face, col = kind === 'fire' ? '#ff8a3a' : kind === 'both' ? '#d05ab0' : FB_COL.poison;
  sfx.swing(false);
  return fbLob(e, { tx, ty: A.t ? A.y : e.y, T: 0.42 / fbSpd(e), vz: 200, draw: (c, X, Y, q) => fbDrawBottle(c, X, Y, q.spin, col),
    onLand: q => {
      const x = q.x, y = q.y; sfx.hit('crit', false); sfx.boom(0.25); fxShock(x, y, 110, col);
      if (kind !== 'fire') fxSpr('poison', x, y, 22, { w: 120, dur: 0.5, grow: [0.5, 1.1] });
      if (kind !== 'poison') { fxSpr('explosion', x, y, 30, { w: 100, dur: 0.4 }); fxSpr('jv_flame', x, y, 0, { w: 110, dur: 0.5, ay: 1 }); }
      fbArea(e, x, y, 100, { dmg: skillDmg(1.2, 0.12, lv) * (o.mul || 1), stun: 0.3, knock: 30, airLift: 60, hs: 0.04, col, snd: 'blunt',
        onHit: (a, t) => { if (kind !== 'fire') fbAbn(a, t, 'poison', 3, 0.3 * lvMul(lv)); if (kind !== 'poison') fbAbn(a, t, 'burn', 3, 0.25 * lvMul(lv)); } }, { zMax: 110 });
    } });
}
// 毒瓶（强化）：往上扔到空中炸开，洒下一片毒区（中毒 + 灼伤）；按住 ↓ 扔到脚下；逆道·皆允：毒雾多留 2 秒
defSummon('fb_poisonfield', { kind: 'field', life: 3, r: 150, tick: 0.5, max: 4, over: 'oldest', keepRoom: false,
  onTick(s, list) { for (const t of list) { summonHit(s, t, { dmg: s.dmg, stun: 0.12, knock: 0, hs: 0.02, type: 'mag', col: FB_COL.poison, snd: 'blunt' }); fbAbn(s.owner, t, 'poison', 3, s.dps); if (s.burn) fbAbn(s.owner, t, 'burn', 3, s.dps * 0.8); } },
  draw(c, s) { const k = s.lifeT / s.life, a = k > 0.85 ? (1 - k) / 0.15 : Math.min(1, s.lifeT * 5), X = sx(s.x), Y = sy(s.y, 0);
    c.save(); c.globalAlpha = 0.5 * a; c.fillStyle = shade(FB_COL.poison, -0.2, 0.55); c.beginPath(); c.ellipse(X, Y, 150, 150 * GR, 0, 0, TAU); c.fill(); c.restore();
    for (let i = 0; i < 5; i++) { const q = (game.t * 0.7 + i / 5) % 1, ang = i * 1.3 + s.sid; drawSpr(c, 'poison', X + Math.cos(ang) * 90 * (0.3 + 0.7 * ((i * 37) % 10) / 10), Y + Math.sin(ang) * 30 - q * 30, 56, 0, { alpha: a * 0.7 * (1 - q) }); } } });
function fbBottleStrong(e, lv) {
  const down = !!(e.pad && e.pad.is && e.pad.is('down') && !game.pvp), A = fbAim(e, 190, 300), tx = down ? e.x + e.face * 12 : A.x, ty = down ? e.y : A.y, pic = hasSkill(e, 'fb_picaresque');
  sfx.swing(true);
  const T = 0.5 / fbSpd(e), x0 = e.x + e.face * 20, burstZ = 120;
  addFx({ x: x0, y: e.y + 0.5, z: 0, dur: T, x0, x1: tx, y0: e.y, y1: ty, draw(c) { const k = this.t / this.dur, x = lerp(this.x0, this.x1, k), y = lerp(this.y0, this.y1, k), z = 80 + (burstZ + 90 - 80) * Math.sin(k * Math.PI * 0.62); this.x = x; this.y = y; fbDrawBottle(c, sx(x), sy(y, z), game.t * 18, FB_COL.poison, 1.3); } });
  game.after(T, () => {
    if (e.dead) return; sfx.boom(0.5); fxBurst(tx, ty, burstZ, 150, FB_COL.poison); fxSpr('poison', tx, ty, burstZ - 20, { w: 170, dur: 0.6, grow: [0.4, 1.2] });
    for (let i = 0; i < 10; i++) { const ox = rnd(-120, 120), oy = rnd(-40, 40); addFx({ x: tx + ox, y: ty + oy, z: burstZ, vz: rnd(-60, 20), dur: 0.35, update(dt) { this.vz -= 900 * dt; this.z = Math.max(0, this.z + this.vz * dt); }, draw(c) { c.fillStyle = FB_COL.poison; c.beginPath(); c.arc(sx(this.x), sy(this.y, this.z), 3, 0, TAU); c.fill(); } }); }
    fbArea(e, tx, ty, 150, { dmg: skillDmg(1.8, 0.18, lv), stun: 0.3, knock: 20, hs: 0.04, col: FB_COL.poison, downHit: true, onHit: (a, t) => { fbAbn(a, t, 'poison', 3, 0.35 * lvMul(lv)); fbAbn(a, t, 'burn', 3, 0.25 * lvMul(lv)); } }, { zMax: 200 });
    const s = summon(e, 'fb_poisonfield', { x: tx, y: ty, life: 3 + (pic ? 2 : 0), lv }); if (s) { s.dmg = skillDmg(0.35, 0.035, lv); s.dps = 0.3 * lvMul(lv); s.burn = true; }
  });
}
// 毒针：直线飞，贯穿，出血 + 短暂硬直；逆道·皆允：附带感电（强化投掷的每根针小范围爆开）
function fbNeedleShot(e, lv, o = {}) {
  const pic = hasSkill(e, 'fb_picaresque'), sp = 900 * fbSpd(e), col = pic ? '#fff38a' : '#ff6a7a';
  return spawnProj({ owner: e, x: e.x + e.face * 24, y: e.y + (o.dy || 0) * 0.15, z: e.z + 62, vx: e.face * sp, vy: o.vy || 0, vz: 0, face: e.face, life: 0.58, w: 12, d: 14, h: 18, pierce: true,
    hit: { dmg: skillDmg(0.95, 0.095, lv) * (o.mul || 1), stun: 0.34, knock: 16, airLift: 50, hs: 0.035, type: 'mag', col: '#ffd0d8', snd: 'stab',
      onHit: (a, t) => { fbAbn(a, t, 'bleed', 3, 0.22 * lvMul(lv)); if (pic) fbAbn(a, t, 'shock', 6); } },
    onHitT: (q, t) => { if (o.aoe) { fxBurst(q.x, q.y, q.z, 60, '#fff38a'); fbArea(e, q.x, q.y, 50, { dmg: skillDmg(0.4, 0.04, lv), stun: 0.2, knock: 10, hs: 0.02, col: '#fff38a' }, { zMax: 140 }); } },
    update(q) { if (Math.random() < 0.5) addFx({ x: q.x - q.face * 12, y: q.y + 0.2, z: q.z, dur: 0.12, draw(c) { c.fillStyle = 'rgba(230,240,255,.6)'; c.fillRect(sx(this.x) - 4, sy(this.y, this.z) - 0.5, 8, 1); } }); },
    draw(c, q) { fbDrawNeedle(c, sx(q.x), sy(q.y, q.z), q.face, col); } });
}
// 砖块：飞出去撞到敌人碎开，碎片打周围的敌人（眩晕 50%）
function fbBrickShot(e, lv, o = {}) {
  const sp = 620 * fbSpd(e);
  sfx.swing(false);
  return spawnProj({ owner: e, x: e.x + e.face * 22, y: e.y, z: e.z + 56, vx: e.face * sp, vz: 60, grav: 420, face: e.face, life: 0.7, w: 12, d: 14, h: 16, pierce: false, spin: 0,
    hit: { dmg: skillDmg(1.4, 0.14, lv) * (o.mul || 1), stun: 0.45, knock: 70, airLift: 110, hs: 0.06, type: 'mag', col: '#ffc090', snd: 'blunt', onHit: (a, t) => { if (Math.random() < 0.5) fbAbn(a, t, 'stun', 1.5); } },
    update(q, dt) { q.spin += dt * 16 * q.face; },
    onEnd(q) { sfx.hit('blunt', false); fxDust(q.x, q.y, 5, 10, '#c07a5a'); for (let i = 0; i < 6; i++) { const vx = rnd(-160, 160), vz = rnd(80, 220); addFx({ x: q.x, y: q.y + 0.4, z: Math.max(10, q.z), vx, vz, dur: 0.45, r: rnd(0, 6), update(dt) { this.x += this.vx * dt; this.vz -= 900 * dt; this.z = Math.max(0, this.z + this.vz * dt); }, draw(c) { fbDrawBrick(c, sx(this.x), sy(this.y, this.z), this.r + this.t * 12, 0.45); } }); }
      fbArea(e, q.x, q.y, 80, { dmg: skillDmg(0.9, 0.09, lv) * (o.mul || 1), stun: 0.35, knock: 50, hs: 0.03, col: '#ffc090', onHit: (a, t) => { if (Math.random() < 0.5) fbAbn(a, t, 'stun', 1.5); } }, { zMax: 140, z: q.z }); },
    draw(c, q) { fbDrawBrick(c, sx(q.x), sy(q.y, q.z), q.spin); } });
}
// 罗网：飞出去张开，罩住的敌人强制硬直 2 秒 + 束缚（领主 = 减速）；强化：扇形 3 张，把罩住的敌人拉到身前
function fbNetShot(e, lv, o = {}) {
  const sp = 520 * fbSpd(e), hitList = [];
  return spawnProj({ owner: e, x: e.x + e.face * 26, y: e.y, z: e.z + 60, vx: e.face * sp, vy: o.vy || 0, vz: 0, face: e.face, life: 0.78, w: 26, d: 22, h: 70, pierce: true,
    hit: { dmg: skillDmg(3.0, 0.3, lv) * (o.mul || 1), stun: 0.6, knock: 0, hs: 0.05, type: 'mag', col: FB_COL.net, snd: 'blunt',
      onHit: (a, t) => { addStatus(t, 'hold', 2); fbAbn(a, t, 'bind', 9.7); hitList.push(t); fbNetWrap(t); } },
    update(q) { q.z = Math.max(20, q.z - 20 / 60); },
    onEnd(q) { if (o.pull && hitList.length) game.after(0.3, () => { if (e.dead) return; for (const t of hitList) if (!t.dead && !t.boss && !t.fixed && hasStatus(t, 'hold')) { const R = game.room; t.x = R ? clamp(e.x + e.face * 72, R.x0 + t.w, R.x1 - t.w) : e.x + e.face * 72; t.y = clamp(e.y + rnd(-10, 10), 4, DEPTH - 4); fxDust(t.x, t.y, 4, 10); } sfx.swing(true); }); },
    draw(c, q) { const k = Math.min(1, q.t / 0.18); fbDrawNet(c, sx(q.x), sy(q.y, q.z), 8 + 22 * k, 1, q.t * 3); } });
}
// 被罗网罩住的敌人身上画一张网（束缚期间）
function fbNetWrap(t) {
  if (t._fbNetFx && fxList.indexOf(t._fbNetFx) >= 0) return;
  t._fbNetFx = addFx({ ent: t, y: t.y + 0.7, dur: 12, update() { this.y = this.ent.y + 0.7; if (this.ent.dead || !(hasStatus(this.ent, 'bind') || hasStatus(this.ent, 'hold'))) this.t = this.dur; },
    draw(c) { const t = this.ent; fbDrawNet(c, sx(t.x), sy(t.y, t.z + t.h * 0.45), Math.max(18, t.w * 1.6), 0.8, 0); } });
}

/* ---- 人物动作片段：矢量占位（CLIPS.fighter）+ 精灵帧名（J.anims，B1 出 fb_ 帧前用格斗家通用帧） ---- */
POSE.fbCrouchPunch = P(POSE.crouch, { uaF: 60, faF: -10, torso: -40, head: 30 });
POSE.fbCrouchRaise = P(POSE.crouch, { uaF: 170, faF: 30 });
Object.assign(CLIPS.fighter, {
  fbThrow: { dur: 0.36, fps: 24, keys: [k(0, POSE.throwW, 'hold'), k(0.1, POSE.throwS, 'out'), k(0.22, POSE.throwS), k(0.36, POSE.idle)] },
  fbFan: { dur: 0.36, fps: 24, keys: [k(0, P(POSE.throwW, { torso: 25, uaF: 110 }), 'hold'), k(0.1, P(POSE.throwS, { uaF: 95, faF: 0 }), 'out'), k(0.36, POSE.idle)] },
  fbHook: { dur: 0.8, fps: 24, keys: [k(0, POSE.fLowKick, 'out'), k(0.14, POSE.fLowKick), k(0.2, POSE.kickUp, 'out'), k(0.34, POSE.kickW, 'hold'), k(0.44, POSE.kickSide, 'out'), k(0.8, POSE.idle)] },
  fbGrab: { dur: 0.4, fps: 24, keys: [k(0, POSE.fJabW), k(0.08, P(POSE.fJab, { uaB: 80, faB: 10 })), k(0.4, POSE.idle)] },
  fbMount: { dur: 0.3, loop: true, fps: 20, keys: [k(0, POSE.fbCrouchRaise), k(0.12, POSE.fbCrouchPunch), k(0.3, POSE.fbCrouchRaise)] },
  fbSlide: { dur: 0.3, keys: [k(0, POSE.slide)] },
  fbSwing: { dur: 0.3, loop: true, fps: 20, keys: [k(0, POSE.a1w), k(0.15, POSE.a1s), k(0.3, POSE.a1w)] },
  fbTaunt: { dur: 0.5, keys: [k(0, POSE.roar)] },
  fbLift: { dur: 0.5, keys: [k(0, POSE.slamW)] },
  fbSlam: { dur: 0.4, keys: [k(0, POSE.slamW, 'hold'), k(0.1, POSE.slamS, 'out'), k(0.4, POSE.slamS)] },
  fbKick: { dur: 0.4, fps: 24, keys: [k(0, POSE.kickW, 'hold'), k(0.08, POSE.kickSide, 'out'), k(0.4, POSE.idle)] },
});
// 写成 getter：fAnim / sprHas 在 content/sprites.js 里定义（比本文件晚加载），sprites.js 并入 J.anims（Object.assign）时才求值
const FB_ANIMS = {
  get fbThrow() { return fAnim([['fb_throw1', 0], ['fb_throw2', 0.1]], fAnim([['f_palm1', 0]])); }, get fbFan() { return fAnim([['fb_sidethrow', 0]], fAnim([['f_palm2', 0]])); },
  get fbHook() { return fAnim([['f_low2', 0], ['f_high2', 0.18], ['f_mid2', 0.42]]); }, get fbGrab() { return fAnim([['f_grab', 0]]); },
  get fbMount() { return fAnim([['fb_pound1', 0], ['fb_pound2', 0.06]], fAnim([['f_smash', 0]])); },
  get fbSlide() { return fAnim([['fb_slide', 0]], fAnim([['f_crouch', 0]])); }, get fbSwing() { return sprHas('fighter', 'fb_chain1') ? { fps: 12, frames: ['fb_chain1', 'fb_chain2'] } : fAnim([['f_spin1', 0]]); },
  get fbTaunt() { return fAnim([['fb_taunt', 0]], fAnim([['f_focus', 0]])); }, get fbLift() { return fAnim([['f_lift', 0]]); }, get fbSlam() { return fAnim([['f_smash', 0]], fAnim([['f_slam', 0]])); },
  get fbKick() { return fAnim([['f_mid1', 0], ['f_mid2', 0.08]]); },
};

/* ---- 被动（转职自动学会：剧毒抵抗 / 邪功修炼 / 重甲专精 / 自动填充） ---- */
defSkill('fb_poisonres', { name: '剧毒抵抗', cls: 'fighter', job: FB_JOB, lvReq: 15, maxLv: 1, sp: 0, passive: true, type: 'mag', col: '#7a4aa0',
  desc: '【被动 · 转职自动学会】常年和毒打交道，受到的中毒伤害 -25%。' });
defSkill('fb_overstrain', { name: '邪功修炼', cls: 'fighter', job: FB_JOB, lvReq: 15, maxLv: 1, sp: 0, passive: true, type: 'mag', col: '#6a2a5a',
  desc: '【被动 · 转职自动学会】力量和智力、物理暴击和魔法暴击，低的一方提高到和高的一方一样。副作用：施放念气类技能（念气波、分身）时有 2% 几率走火入魔，眩晕 1 秒（决斗场不会）。' });
defSkill('fb_heavy', { name: '街霸重甲专精', cls: 'fighter', job: FB_JOB, lvReq: 15, maxLv: 1, sp: 0, passive: true, type: 'mag', col: '#6a6a7a',
  desc: '【被动 · 转职自动学会】精通重甲：穿重甲时每件提高力量、物理防御和 HP 上限（防具精通，按穿着的重甲件数结算）；穿其他防具没有精通加成。' });
defSkill('fb_autoload', { name: '自动填充', cls: 'fighter', job: FB_JOB, lvReq: 15, maxLv: 1, sp: 0, passive: true, type: 'mag', col: '#b89a50',
  desc: '【被动 · 转职自动学会】毒瓶、毒针、砖块、罗网用完后，经过各自的装填冷却自动装满（装填时消耗 MP，投掷本身不耗 MP）。',
  infoExtra: () => [['装填冷却', '毒瓶 7 / 毒针 6 / 砖块 7 / 罗网 17 秒'], ['装填 MP', '毒瓶 30 / 毒针 30 / 砖块 35 / 罗网 60']] });
defSkill('fb_claw', { name: '爪精通', cls: 'fighter', job: FB_JOB, lvReq: 17, passive: true, type: 'mag', col: '#8a6a4a',
  desc: '【被动】装备爪时，物理 / 魔法武器攻击力、命中和硬直提高。', infoExtra: lv => [['攻击力（装爪）', '+' + pct(0.03 + 0.01 * lv)], ['硬直（装爪）', '+' + pct(0.5)]] });
defSkill('fb_pocket', { name: '后备口袋', cls: 'fighter', job: FB_JOB, lvReq: 17, maxLv: 1, sp: 50, passive: true, type: 'mag', col: '#8a5a3a', pre: { fb_strong: 1 },
  desc: '【被动】普攻和转职技能施放中也能按强化投掷。后街战术状态下投毒瓶时，第二个换成会引起灼伤的火焰瓶。' });
defSkill('fb_vulcan', { name: '狂·霸王拳', cls: 'fighter', job: FB_JOB, lvReq: 19, passive: true, type: 'mag', col: '#4a8ad8', pre: { fb_mount: 1 },
  desc: '【被动 · 改变伏虎霸王拳】伏虎霸王拳改成只打 1 拳，但这一拳和周围的冲击波大幅提高；抓不住的敌人也能用（没有控制效果）。抓住时敌人身上每有一个异常状态，攻击 +20%、冲击波范围 +10%（最多 3 个）。',
  pow: lv => skillDmg(7.6, 0.76, lv), infoExtra: () => [['异常加成', '每个 +20% 攻击 / +10% 冲击波范围（最多 3 个）']] });

/* ---- 强化投掷（←→+C）：无动作施放，只强化下一次投掷 ---- */
defSkill('fb_strong', { name: '强化投掷', cls: 'fighter', job: FB_JOB, lvReq: 15, maxLv: 1, sp: 30, mp: 15, cd: 0.1, type: 'mag', col: '#d8a030', noForce: true, noHitCheck: true,
  desc: '只强化下一次投掷（毒瓶 / 毒针 / 砖块 / 罗网 / 爆破污桶 / 逆道·爆狱），多消耗投掷物：\n· 毒瓶（2 个）：扔到空中炸开，洒下一片毒区（中毒 + 灼伤）；按住 ↓ 扔到脚下\n· 毒针（4 根）：扇形一次扔出 4 根\n· 砖块（3 块）：跳起来举起大岩石扔出，空中按 ←→ 调落点\n· 罗网（2 张）：扇形扔出，把罩住的敌人拉到身前\n· 爆破污桶：改成一脚踢出铁桶（不耗投掷物）\n强化投掷优先于后街战术的两连投。学会后备口袋后，普攻和转职技能中也能按。',
  req: p => { if (p.buffs && p.buffs.fb_strong) return '已强化'; if (p.st === 'act' && p.act && !(hasSkill(p, 'fb_pocket') && (p.act.basic || (p.act.skill && SKILLS[p.act.skill] && SKILLS[p.act.skill].job === FB_JOB)))) return '动作中不能用'; return true; },
  ai: { kind: 'buff' },
  instant: (lv, p) => { p.buffs.fb_strong = { t: 1e9, name: '强化投掷', col: '#ffd23a' }; sfx.charge(); fxAura(p, '#ffd070', 0.4); fxText('强化投掷', p.x, p.y, p.z + 30, { col: '#ffe070', size: 11, dur: 0.6 }); return true; },
  act: () => ({ name: 'fb_strong', clip: 'fbThrow', dur: 0.1, noCounter: true }) });

/* ---- 投掷技能：共用的信息栏 / 动作外壳 ---- */
function fbThrowInfo(id, extra) {
  return (lv, p) => { const S = SKILLS[id], L = [['技能攻击力', pct(S.pow(Math.max(1, lv)))], ['装填数', String(p ? fbCap(p, id) : S.charges)], ['再投间隔', S.cd + ' 秒'], ['装填冷却', FB_RELOAD[id] + ' 秒'], ['装填 MP', String(FB_RELOAD_MP[id])]];
    if (extra) L.push(...extra(Math.max(1, lv))); return L; };
}
// 投掷动作：onStart 决定形态（强化 / 两连投 / 普通）并扣投掷物，fire(e, M, i) 第 i 次出手（两连投 i = 0、1）
function fbThrowAct(id, lv, p, o) {
  return { name: id, clip: o.clip || 'fbThrow', dur: o.dur || 0.38, noCounter: true, cancelFrom: o.cancelFrom ?? 0.26,
    onStart: e => { const M = fbThrowStart(e, id); if (M.n > 1) e.act.dur += o.gap || 0.16; },
    events: [evAt(o.at || 0.1, e => o.fire(e, e.act.fbM, 0)), evAt((o.at || 0.1) + (o.gap || 0.16), e => { const M = e.act.fbM; if (M && M.n > 1) { e.play(o.clip || 'fbThrow', true); o.fire(e, M, 1); } })] };
}

// ---- 毒瓶投掷（→→+Space，官方基础技能“毒瓶投掷”，现版只有街霸能学）----
defSkill('fb_poison', { name: '毒瓶投掷', cls: 'fighter', job: FB_JOB, lvReq: 15, mp: 0, cd: 2, charges: 10, reload: 1e9, type: 'mag', col: FB_COL.poison,
  desc: '向前方扔出毒瓶，碎开的毒液（直径 200px）让敌人中毒 3 秒。装 10 瓶，再投间隔 2 秒，用完后装填冷却 7 秒。\n强化投掷：扔到空中炸开，留下一片毒区（中毒 + 灼伤）；按住 ↓ 扔到脚下。\n后街战术：一次扔 2 瓶（学了后备口袋，第二瓶换成火焰瓶）。逆道·皆允：普通投掷变成毒 + 火合一的特制瓶，强化投掷的毒雾多留 2 秒。',
  pow: lv => skillDmg(1.2, 0.12, lv), ai: { kind: 'proj', r: [60, 330], dy: 40 },
  act: (lv, p) => fbThrowAct('fb_poison', lv, p, { fire: (e, M, i) => {
    if (M.strong) return fbBottleStrong(e, lv);
    const pic = hasSkill(e, 'fb_picaresque'), fire = i === 1 && hasSkill(e, 'fb_pocket') && !game.pvp;
    fbBottle(e, lv, { kind: pic ? 'both' : fire ? 'fire' : 'poison', dx: i * 45, mul: M.n > 1 ? 0.6 : 1 });   // 两连投：每瓶 -40%（官方）
  } }) });
SKILLS.fb_poison.info = fbThrowInfo('fb_poison', () => [['中毒', '100%，3 秒']]);

// ---- 毒针投掷（→→+Z）----
defSkill('fb_needle', { name: '毒针投掷', cls: 'fighter', job: FB_JOB, lvReq: 17, mp: 0, cd: 3, charges: 10, reload: 1e9, type: 'mag', col: '#e05a6a',
  desc: '扔出涂了肌肉僵硬药的毒针，贯穿路上的敌人，让敌人短暂硬直并出血 3 秒。装 10 根，再投间隔 3 秒，用完后装填冷却 6 秒。\n强化投掷：扇形一次扔出 4 根（贴身时一个敌人能吃好几根）。后街战术：一次扔 2 根。\n逆道·皆允：普通投掷附带感电；强化投掷的每根针命中时小范围爆开。',
  pow: lv => skillDmg(0.95, 0.095, lv), ai: { kind: 'proj', r: [40, 480], dy: 26 },
  act: (lv, p) => fbThrowAct('fb_needle', lv, p, { clip: 'fbFan', gap: 0.12, fire: (e, M, i) => {
    sfx.swing(false);
    if (M.strong) { const pic = hasSkill(e, 'fb_picaresque'); for (const vy of [-150, -50, 50, 150]) fbNeedleShot(e, lv, { vy, dy: vy, mul: 0.85, aoe: pic }); return; }
    fbNeedleShot(e, lv, { mul: M.n > 1 ? 0.9 : 1 });
  } }) });
SKILLS.fb_needle.info = fbThrowInfo('fb_needle', () => [['出血', '100%，3 秒'], ['强化投掷', '扇形 4 根']]);

// ---- 砖块投掷（↑→+Z）；强化：跳起来举起大岩石扔出（空中 ←→ 调落点，太近的敌人打不到）----
function fbBrickStrongAct(lv) {
  return { name: 'fb_brick', clip: 'fbLift', dur: 0.95, noCounter: true, lowGrav: 0.55, superArmor: [0, 0.5], cancelFrom: 0.8,
    onStart: e => { fbThrowStart(e, 'fb_brick'); e.vz = 430; e.z = Math.max(e.z, 1); sfx.jump(); fxDust(e.x, e.y, 5, 12, '#b89a7a'); },
    update: e => { const a = e.act; if (e.actT < 0.5) { const d = e.pad && e.pad.dx ? e.pad.dx() : 0; if (d) a.adj = d * e.face; } if (e.actT < 0.46) addFx({ x: e.x, y: e.y + 0.3, z: 0, dur: 0.02, draw(c) { fbDrawRock(c, sx(e.x), sy(e.y, e.z + 128), 58, 0.3); } }); },
    onLand: e => { e.vz = 0; },
    events: [evAt(0.46, e => {
      const a = e.act, pic = hasSkill(e, 'fb_picaresque'), dist = 250 + (a.adj || 0) * 110, R = game.room, tx = R ? clamp(e.x + e.face * dist, R.x0 + 30, R.x1 - 30) : e.x + e.face * dist;
      e.play('fbSlam', true); sfx.swing(true);
      fbLob(e, { tx, ty: e.y, T: 0.38 / fbSpd(e), vz: 120, z0: e.z + 120, bw: 26, bd: 22, bh: 40, shadow: 20, stopOnHit: false, spinV: 5,
        draw: (c, X, Y, q) => { fbDrawRock(c, X, Y, 64, q.spin); if (pic) fbDrawChain(c, sx(e.x + e.face * 10), sy(e.y, e.z + 70), X, Y, { s: 0.9 }); },
        onLand: q => {
          const x = q.x, y = q.y; cam.shake = Math.max(cam.shake, 6); sfx.boom(0.8); fxShock(x, y, 190, '#c8a070'); fxDust(x, y, 10, 40, '#a08a6a'); fxSpr('rock', x, y, 10, { w: 70, dur: 0.5, add: false });
          for (let i = 0; i < 8; i++) { const vx = rnd(-220, 220), vz = rnd(120, 300); addFx({ x, y: y + rnd(-20, 20), z: 12, vx, vz, dur: 0.55, update(dt) { this.x += this.vx * dt; this.vz -= 900 * dt; this.z = Math.max(0, this.z + this.vz * dt); }, draw(c) { fbDrawRock(c, sx(this.x), sy(this.y, this.z), 16, this.t * 9); } }); }
          const near = t => Math.abs(t.x - e.x) < 60;   // 官方：离自己太近的敌人打不到
          fbArea(e, x, y, 125, { dmg: skillDmg(2.6, 0.26, lv), launch: 320, knock: 90, hs: 0.1, big: 1.5, col: '#ffc090', snd: 'blunt', downHit: true }, { mul: t => near(t) ? 0 : 1 });
          fbArea(e, x, y, 190, { dmg: skillDmg(1.4, 0.14, lv), stun: 0.5, knock: 40, hs: 0.04, col: '#ffc090', downHit: true, onHit: (a, t) => { if (!near(t)) fbAbn(a, t, 'stun', 2); } }, { mul: t => near(t) ? 0 : 1 });
          if (pic) game.after(0.25, () => { if (e.dead) return; sfx.swing(true);   // 逆道·皆允：挂着锁链的岩石被拽回来，一路扫过去
            addFx({ x, y, z: 0, dur: 0.3, x0: x, x1: e.x + e.face * 60, draw(c) { const k = easeIn(this.t / this.dur), X = lerp(this.x0, this.x1, k); fbDrawChain(c, sx(e.x + e.face * 10), sy(e.y, e.z + 62), sx(X), sy(y, 16), { s: 0.9 }); fbDrawRock(c, sx(X), sy(y, 16), 52, -k * 8); } });
            fbBox(e, [30, Math.abs(x - e.x) + 30, 60, 0, 90], { dmg: skillDmg(1.2, 0.12, lv), stun: 0.4, knock: 60, hs: 0.05, col: '#ffc090', pull: true, snd: 'blunt' }); });
        } });
    })] };
}
defSkill('fb_brick', { name: '砖块投掷', cls: 'fighter', job: FB_JOB, lvReq: 18, mp: 0, cd: 4, charges: 10, reload: 1e9, type: 'mag', col: FB_COL.brick,
  desc: '扔出砖块，砸中敌人后碎开，碎片打周围的敌人（50% 眩晕）。装 10 块，再投间隔 4 秒，用完后装填冷却 7 秒。\n强化投掷（3 块）：跳起来从地上举起大岩石扔出，空中按 ←→ 调落点；碎石 100% 眩晕，离自己太近的敌人打不到。后街战术：一次扔 2 块。\n逆道·皆允：强化投掷的岩石挂上锁链，砸下去之后再拽回来扫一遍。',
  pow: lv => skillDmg(2.3, 0.23, lv), ai: { kind: 'proj', r: [40, 380], dy: 30 },
  act: (lv, p) => fbPeekStrong(p, 'fb_brick') ? fbBrickStrongAct(lv) : fbThrowAct('fb_brick', lv, p, { fire: (e, M) => fbBrickShot(e, lv, { mul: M.n > 1 ? 0.6 : 1 }) }) });
SKILLS.fb_brick.info = fbThrowInfo('fb_brick', () => [['眩晕', '碎片 50%（强化 100%）']]);

// ---- 罗网投掷（←↑→+Z）----
defSkill('fb_net', { name: '罗网投掷', cls: 'fighter', job: FB_JOB, lvReq: 19, mp: 0, cd: 15, charges: 5, reload: 1e9, type: 'mag', col: '#b8a060',
  desc: '扔出罗网，罩住的敌人强制硬直 2 秒（无视霸体，领主缩短），并束缚约 9.7 秒（领主改为减速）。装 5 张，再投间隔 15 秒，用完后装填冷却 17 秒。\n强化投掷（2 张）：扇形扔出，罩住的敌人被拉到身前。后街战术不会一次扔两张。',
  pow: lv => skillDmg(3.0, 0.3, lv), ai: { kind: 'proj', r: [40, 380], dy: 40 },
  act: (lv, p) => fbThrowAct('fb_net', lv, p, { clip: 'fbFan', at: 0.14, dur: 0.46, fire: (e, M) => {
    sfx.swing(true);
    if (M.strong) { for (const vy of [-110, 0, 110]) fbNetShot(e, lv, { vy, pull: true, mul: 0.7 }); return; }
    fbNetShot(e, lv);
  } }) });
SKILLS.fb_net.info = fbThrowInfo('fb_net', () => [['强制硬直', '2 秒'], ['束缚', '9.7 秒']]);

/* ---- 后街战术（↑↑+Space）：BUFF，抛沙和投掷一次扔两个；擒月炎爆炸 / 毒雷毒柱变大；普攻、抛沙、转职技能攻击提高 ---- */
defSkill('fb_backstreet', { name: '后街战术', cls: 'fighter', job: FB_JOB, lvReq: 16, mp: 40, cd: 5, type: 'mag', buff: true, col: '#c83a2a',
  desc: '【BUFF · 开关】施放 0.6 秒，再按一次解除。持续期间：抛沙、毒瓶、毒针、砖块一次扔两个（消耗 2 个，每个的攻击降低；罗网不会）；擒月炎的爆炸、毒雷引爆的毒柱变大；普攻、抛沙和转职技能的攻击提高。持续期间每秒消耗少量 MP。强化投掷优先。',
  infoExtra: lv => [['攻击', '+' + pct(0.05 + 0.01 * lv)], ['擒月炎爆炸 / 毒柱范围', '+30% / +25%'], ['每秒 MP', '1.6']], ai: { kind: 'buff' },
  act: lv => ({ name: 'fb_backstreet', clip: 'fbTaunt', dur: 0.6, noCounter: true, speed: 'cspd',
    onStart: e => { if (toggleBuff(e, 'fb_backstreet', 1e9, { dmg: 0.05 + 0.01 * lv, name: '后街战术', col: '#ff5a3a' })) { sfx.buff(); fxAura(e, '#ff4a3a', 0.8); fxShock(e.x, e.y, 90, '#ff6a3a'); } } }) });

/* ---- 擒月炎（←↓→+Z）：扫腿 → 后踢把一个敌人踢起 → 侧踢引爆事先埋进去的火药（灼伤）；异常越多越痛；抓不住的敌人立即爆炸 ---- */
function fbHookBoom(e, t, lv, n) {
  const x = t ? t.x : e.x + e.face * 70, y = t ? t.y : e.y, z = t ? t.z : 0, big = e.buffs.fb_backstreet ? 1.3 : 1, mul = fbAbnMul(null, 0.2, n);
  sfx.boom(0.7); cam.shake = Math.max(cam.shake, 5); fxSpr('explosion', x, y, z + 40, { w: 150 * big, dur: 0.45, grow: [0.5, 1.2] }); fxShock(x, y, 130 * big, FB_COL.fire); fxBurst(x, y, z + 40, 120 * big, '#ffb050');
  fbArea(e, x, y, 85 * big, { dmg: skillDmg(2.6, 0.26, lv) * mul, launch: 280, knock: 90, hs: 0.1, big: 1.5, col: FB_COL.fire, snd: 'crit', downHit: true, onHit: (a, q) => fbAbn(a, q, 'burn', 6, 0.12 * lvMul(lv)) }, { zMax: 200, z });
}
defSkill('fb_hook', { name: '擒月炎', cls: 'fighter', job: FB_JOB, lvReq: 16, mp: 30, cd: 5.5, type: 'mag', col: FB_COL.fire,
  desc: '扫腿打前方的敌人，把扫中的一个敌人后踢到空中，再一记侧踢引爆事先埋进他身上的火药：爆炸伤及周围并造成长时间灼伤。抓不住的敌人（领主等）直接爆炸。敌人身上每有一个异常状态，攻击 +20%（最多 3 个）。后街战术：爆炸范围变大。',
  pow: lv => skillDmg(4.4, 0.44, lv), ai: { kind: 'grab', r: [0, 115], dy: 28 }, infoExtra: () => [['异常加成', '每个 +20%（最多 3 个）'], ['灼伤', '6 秒']],
  act: lv => ({ name: 'fb_hook', clip: 'fbHook', dur: 0.56, noCounter: true, cancelFrom: 0.5,
    hits: [HB(0.06, 0.16, [-10, 118, 34, 0, 50], skillDmg(1.0, 0.1, lv), { grab: true, stun: 0.45, knock: 20, hs: 0.05, type: 'mag', snd: 'blunt', col: '#ffd0a0',
      onGrabFail: (a, t) => fbHookBoom(a, t, lv, fbN(t)) })],
    onGrab: e => { e.act.dur = 0.8; e.act.cancelFrom = 0.7; },
    hold: (e, t) => { const k = clamp((e.actT - 0.16) / 0.2, 0, 1); t.x = e.x + e.face * 44; t.y = e.y + 0.5; t.z = 78 * Math.sin(k * Math.PI / 2); t.face = -e.face; },
    events: [evAt(0.05, e => { sfx.swing(false); fxSlashOn(e, { col: '#ffd8b0', a0: 2.2, a1: 0.2, r: 76, w: 12, off: [6, 12], dur: 0.14, squash: 0.45 }); }),
      evAt(0.2, e => { const t = e.grabbed; if (!t) return; sfx.swing(true); fxSlashOn(e, { a0: 1.5, a1: -1.7, r: 70, w: 14, off: [16, 44], dur: 0.14, col: '#ffe0b0' });
        applyHit(e, t, { dmg: skillDmg(0.8, 0.08, lv) * fbAbnMul(t, 0.2), sure: true, noCounterBonus: true, throwHit: true, hs: 0.05, type: 'mag', snd: 'blunt' }); }),
      evAt(0.44, e => { const t = e.grabbed; if (!t) return; const n = fbN(t); sfx.swing(true); fxSlashOn(e, { a0: -0.6, a1: 0.5, r: 84, w: 16, off: [18, 60], dur: 0.14, col: '#ffb070' });
        throwGrab(e, { dmg: 0.01, launch: 200, knock: 160, hs: 0.04, type: 'mag' }); fbHookBoom(e, t, lv, n); })] }) });

/* ---- 伏虎霸王拳（→↓+Z）：按倒敌人骑上去连打 3 拳（按跳跃直接终结），全程无敌；抓不住就捶地出冲击波；狂·霸王拳：只打 1 拳 + 大冲击波 ---- */
const FB_MOUNT_FIN = 1.3;
function fbMountAct(lv, p) {
  if (p && hasSkill(p, 'fb_vulcan')) return fbVulcanAct(lv, p);
  const punch = (e, i) => { const t = e.grabbed; if (!t) return; e.play('fbMount', true); sfx.hit('blunt', false); cam.shake = Math.max(cam.shake, 2);
    fxHit(t.x, t.y, 18, e.face, { col: '#ffe08a', big: 1.2 }); applyHit(e, t, { dmg: skillDmg(1.3, 0.13, lv), sure: true, noCounterBonus: true, throwHit: true, hs: 0.06, type: 'mag', snd: 'blunt', col: '#ffe08a' }); };
  return { name: 'fb_mount', clip: 'fbGrab', dur: 0.62, invul: true, noCounter: true, noAwk: true, speed: 'aspd',
    hits: [HB(0.06, 0.18, [-6, 104, 32, 0, 110], skillDmg(0.4, 0.04, lv), { grab: true, grabDown: true, grabInvul: true, stun: 0.5, hs: 0.05, type: 'mag', snd: 'blunt' })],
    onGrab: (e, t) => { const a = e.act; a.dur = FB_MOUNT_FIN + 0.35; a.ride = true; t.heldClip = t.clipOr('down'); fxDust(t.x, t.y, 6, 16); sfx.thud(0.8); },
    hold: (e, t) => { t.x = e.x + e.face * 16; t.y = e.y + 0.5; t.z = 0; t.face = -e.face; },
    onInput: (e, I) => { const a = e.act; if (a.ride && e.actT < FB_MOUNT_FIN - 0.05 && I.buffered('jump')) { while (I.consume('jump')); e.actT = FB_MOUNT_FIN - 0.05; } return false; },
    events: [evAt(0.26, e => { if (e.act.ride) return;   // 抓空 / 抓不住：捶地冲击波
        e.play('fbSlam', true); sfx.boom(0.5); cam.shake = Math.max(cam.shake, 3); const x = e.x + e.face * 60; fxShock(x, e.y, 150, '#ffe08a'); fxDust(x, e.y, 6, 20);
        fbArea(e, x, e.y, 110, { dmg: skillDmg(2.0, 0.2, lv), launch: 240, knock: 60, hs: 0.06, col: '#ffe08a', downHit: true }); }),
      evAt(0.42, e => punch(e, 0)), evAt(0.7, e => punch(e, 1)), evAt(0.98, e => punch(e, 2)),
      evAt(FB_MOUNT_FIN, e => { const t = e.grabbed; if (!t) return; e.play('fbSlam', true); sfx.boom(0.7); cam.shake = Math.max(cam.shake, 5);
        throwGrab(e, { dmg: skillDmg(1.4, 0.14, lv), down: true, downLift: 120, knock: 30, hs: 0.1, big: 1.5, type: 'mag', shake: 4 });
        fxShock(t.x, t.y, 170, '#ffe08a'); fbArea(e, t.x, t.y, 120, { dmg: skillDmg(1.2, 0.12, lv), launch: 220, knock: 70, hs: 0.05, col: '#ffe08a', downHit: true }); })] };
}
function fbVulcanAct(lv) {
  return { name: 'fb_mount', clip: 'fbGrab', dur: 0.95, invul: true, noCounter: true, noAwk: true, speed: 'aspd',
    hits: [HB(0.06, 0.18, [-6, 104, 32, 0, 110], skillDmg(0.3, 0.03, lv), { grab: true, grabDown: true, grabInvul: true, stun: 0.5, hs: 0.05, type: 'mag', snd: 'blunt',
      onHit: (a, t) => { if (a.act && !a.act.vt) { a.act.vt = t; a.act.vn = fbN(t); } }, onGrabFail: () => {} })],
    onGrab: (e, t) => { t.heldClip = t.clipOr('down'); fxDust(t.x, t.y, 6, 16); sfx.thud(0.8); },
    hold: (e, t) => { t.x = e.x + e.face * 16; t.y = e.y + 0.5; t.z = 0; t.face = -e.face; },
    events: [evAt(0.2, e => { e.play('fbLift', true); fxCharge(e, '#8ac8ff', 3); }),
      evAt(0.46, e => { const a = e.act, n = a.vn || 0, mul = fbAbnMul(null, 0.2, n), R = 160 * (1 + 0.1 * Math.min(3, n)), t = e.grabbed || (a.vt && !a.vt.dead ? a.vt : null), x = t ? t.x : e.x + e.face * 60, y = t ? t.y : e.y;
        e.play('fbSlam', true); sfx.boom(1.0); cam.shake = Math.max(cam.shake, 7); fxShock(x, y, R * 1.3, '#8ac8ff'); fxShock(x, y, R, '#e0f0ff'); fxBurst(x, y, 30, R * 1.2, '#8ac8ff'); fxSpr('spark', x, y, 20, { w: 140, dur: 0.3, col: '#bfe0ff' });
        if (e.grabbed) throwGrab(e, { dmg: skillDmg(2.4, 0.24, lv) * mul, down: true, downLift: 180, knock: 40, hs: 0.12, big: 1.8, type: 'mag', shake: 5 });
        else if (t) applyHit(e, t, { dmg: skillDmg(2.4, 0.24, lv) * mul, sure: true, stun: 0.5, knock: 40, hs: 0.1, big: 1.8, type: 'mag', snd: 'blunt' }, { proj: true });
        fbArea(e, x, y, R, { dmg: skillDmg(5.2, 0.52, lv) * mul, launch: 300, knock: 100, hs: 0.1, big: 1.6, col: '#8ac8ff', downHit: true }, { zMax: 160 }); })] };
}
defSkill('fb_mount', { name: '伏虎霸王拳', cls: 'fighter', job: FB_JOB, lvReq: 18, mp: 40, cd: 15, type: 'mag', col: '#d8a030', speed: 'aspd', grab: true,
  desc: '把前方的敌人按倒在地，骑上去连打 3 拳，最后一拳砸出冲击波（按跳跃直接终结）。能抓倒地、霸体的敌人；全程无敌。抓不住的敌人改为捶地出冲击波。出拳速度受攻击速度影响。学会狂·霸王拳后改成 1 拳 + 大冲击波。',
  pow: lv => skillDmg(6.5, 0.65, lv), ai: { kind: 'grab', r: [0, 105], dy: 26 }, act: fbMountAct });

/* ---- 挑衅（↓↓+Space）：常驻光环（周围敌人异常抗性降低，被自己打中的敌人受到伤害加深），施放时嘲讽周围的敌人；按住 → 放出音波嘲讽远处 ---- */
defSkill('fb_taunt', { name: '挑衅', cls: 'fighter', job: FB_JOB, lvReq: 19, mp: 40, cd: 5, type: 'mag', buff: true, col: '#ff5a3a',
  desc: '【BUFF · 60 秒】身边形成挑衅光环：光环内（200px 起，随等级扩大）的敌人异常抗性降低（本作折算为异常持续时间变长）；被自己打中的敌人 10 秒内受到的伤害加深。施放时嘲讽周围的敌人，让他们把攻击对准自己；按住 → 施放则向前放出挑衅音波，嘲讽远处的敌人。',
  infoExtra: lv => [['光环范围', (200 + 17 * (lv - 1)) + 'px'], ['伤害加深', '+' + pct(0.06 + 0.01 * lv) + '（10 秒）'], ['异常持续时间', '+' + pct(0.15 + 0.01 * lv)]], ai: { kind: 'buff' },
  act: lv => ({ name: 'fb_taunt', clip: 'fbTaunt', dur: 0.5, noCounter: true, speed: 'cspd',
    onStart: e => { e.act.wave = fbFwd(e); },
    events: [evAt(0.18, e => { const lvR = 200 + 17 * (lv - 1); e.buffs.fb_taunt = { t: 60, lv, name: '挑衅', col: '#ff5a3a' }; sfx.buff(); fxAura(e, '#ff5a3a', 0.6); fxShock(e.x, e.y, lvR, '#ff5a3a'); fxText('来啊！', e.x, e.y, e.z + 110, { col: '#ff7a5a', size: 14, dur: 0.8 });
      const wave = e.act.wave;
      for (const t of ents) { if (!foe(e, t) || t.dead) continue; const dx = (t.x - e.x) * e.face, inA = inGround(t, e.x, e.y, lvR), inW = wave && dx > 0 && dx < 520 && Math.abs(t.y - e.y) < 70;
        if (inA || inW) { addStatus(t, 'taunt', 4, { src: e }); fbTauntMark(e, t, lv); } }
      if (wave) for (let i = 0; i < 4; i++) game.after(i * 0.06, () => fxSpr('wave', e.x + e.face * (80 + i * 110), e.y, 60, { w: 60, h: 120, dur: 0.3, col: '#ff7a5a', flip: e.face < 0 })); })] }) });
function fbTauntMark(p, t, lv) { t.buffs = t.buffs || {}; t.buffs.fb_ti = { t: 1e9, taken: 0.06 + 0.01 * lv, until: game.t + 10, hide: true }; }

/* ---- 螺旋滑铲（←→→+Z）：贴地滑铲向前，3 段，失明；按 ← 缩短距离；霸体；对抓不住的敌人 +20% ---- */
defSkill('fb_tackle', { name: '螺旋滑铲', cls: 'fighter', job: FB_JOB, lvReq: 19, mp: 50, cd: 20, type: 'mag', col: '#c8a060',
  desc: '贴着地面滑铲向前（约 360px），一路扬起沙土造成 3 段魔法攻击，有几率让敌人失明 5 秒。按住 ← 施放距离缩短。施放中霸体；对无法抓取的敌人伤害 +20%。',
  pow: lv => skillDmg(7.8, 0.78, lv), ai: { kind: 'poke', r: [0, 320], dy: 26 },
  act: (lv, p) => { const sp = p && fbBack(p) ? 380 : 720;
    // 3 段：每段判定从身后 130px 到身前（滑过去的敌人都算），抓不住的敌人（领主 / noGrab）伤害 ×1.2
    const seg = e => { sfx.hit('blunt', false); fbBox(e, [-130, 76, 36, 0, 64], { dmg: skillDmg(2.6, 0.26, lv), stun: 0.45, knock: 90, airLift: 140, hs: 0.04, col: '#e8d0a0', snd: 'blunt',
      onHit: (a, t) => { if (Math.random() < 0.5) fbAbn(a, t, 'blind', 5); } }, { mul: t => t.noGrab || t.boss ? 1.2 : 1 }); };
    return { name: 'fb_tackle', clip: 'fbSlide', dur: 0.72, superArmor: true, noCounter: true, cancelFrom: 0.62, move: [[0.06, 0.52, sp]], counterEnd: 0.56,
      onStart: () => sfx.swing(true), events: [evAt(0.16, seg), evAt(0.34, seg), evAt(0.52, seg)],
      update: e => { if (e.actT < 0.54 && Math.random() < 0.7) { fxDust(e.x - e.face * 6, e.y, 1, 6, '#c8b090'); if (Math.random() < 0.3) fxSpr('dust', e.x + e.face * 30, e.y, 14, { w: 40, dur: 0.3, add: false, alpha: 0.7 }); } } }; } });

/* ---- 毒雷引爆（↓↓+Z）：往身前抛出一颗悬空的毒雷，侧踢引爆，向前喷出毒气柱（击倒 + 中毒）；毒雷爆炸前霸体；后街战术：毒柱变大 ---- */
defSkill('fb_mine', { name: '毒雷引爆', cls: 'fighter', job: FB_JOB, lvReq: 19, mp: 60, cd: 24, type: 'mag', col: FB_COL.gas,
  desc: '往身前抛出一颗悬空的毒雷，再一记侧踢把它踢爆：先炸出冲击波，再向前喷出一道毒气柱，打中的敌人被击倒并中毒。毒雷爆炸前霸体，踢完会被反冲往后推一点。后街战术：毒柱变大。',
  pow: lv => skillDmg(9.0, 0.9, lv), ai: { kind: 'burst', r: [0, 300], dy: 40 },
  act: (lv, p) => ({ name: 'fb_mine', clip: 'fbThrow', dur: 0.95, noCounter: true, superArmor: [0, 0.6], cancelFrom: 0.8, move: [[0.52, 0.66, -150]], links: fbRbLinks(p), linkFrom: 0.3, fbRB: true,
    onEnd: (e, cut) => { if (cut) e._fbRB = game.t; },
    events: [evAt(0.1, e => { sfx.swing(false); const x0 = e.x + e.face * 18, x1 = e.x + e.face * 58, z0 = e.z + 70; e.act.mx = x1; e.act.my = e.y;
        addFx({ x: x1, y: e.y + 0.5, z: 0, dur: 0.44, draw(c) { const k = Math.min(1, this.t / 0.22), x = lerp(x0, x1, k), z = z0 + Math.sin(k * Math.PI) * 30 + (k >= 1 ? Math.sin(game.t * 12) * 2 : 0) - k * 10; fbDrawMine(c, sx(x), sy(this.y, z), 1.3); } }); }),
      evAt(0.36, e => e.play('fbKick', true)),
      evAt(0.5, e => { const big = e.buffs.fb_backstreet ? 1.25 : 1, x = e.act.mx, y = e.act.my, L = 300 * big; sfx.boom(0.8); cam.shake = Math.max(cam.shake, 5);
        fxBurst(x, y, 60, 110, FB_COL.pink); fxShock(x, y, 120, FB_COL.poison);
        fbArea(e, x, y, 80, { dmg: skillDmg(2.4, 0.24, lv), stun: 0.4, knock: 60, hs: 0.05, col: FB_COL.pink }, { zMax: 160 });
        for (let i = 0; i < 6; i++) game.after(i * 0.04, () => fxSpr('poison', x + e.face * (40 + i * (L - 40) / 5), y + rnd(-6, 6), 30 + rnd(0, 40), { w: 110 * big, dur: 0.55, grow: [0.5, 1.2] }));
        addFx({ x: x + e.face * L / 2, y: y + 1, z: 0, dur: 0.5, draw(c) { const k = this.t / this.dur, X0 = sx(x), X1 = sx(x + e.face * L), Y = sy(y, 70); c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.6 * (1 - k); const g = c.createLinearGradient(X0, 0, X1, 0); g.addColorStop(0, '#ff9ae8'); g.addColorStop(1, 'rgba(160,80,220,0)'); c.fillStyle = g; c.beginPath(); c.ellipse((X0 + X1) / 2, Y, Math.abs(X1 - X0) / 2, 36 * big * (1 - k * 0.4), 0, 0, TAU); c.fill(); c.restore(); } });
        fbBox(e, [0, (x - e.x) * e.face + L, 46 * big, 0, 150], { dmg: skillDmg(6.6, 0.66, lv), down: true, downLift: 200, knock: 150, hs: 0.08, big: 1.5, col: FB_COL.gas, snd: 'crit', onHit: (a, t) => fbAbn(a, t, 'poison', 3, 0.3 * lvMul(lv)) }); })] }) });
function fbRbLinks(p) { return p && hasSkill(p, 'fb_rulebreak') ? FB_RB_TO : undefined; }

/* ---- 极恶飞锁（→←→+Z，官方 45 级锁链技能，取代旧的血色风暴）：挥锁链扫周围 8 次（出血）→ 终结把打中的敌人拉到身前；按 X 加快、按跳跃直接终结；霸体 ---- */
const FB_LARIAT_FIN = 1.62;
defSkill('fb_lariat', { name: '极恶飞锁', cls: 'fighter', job: FB_JOB, lvReq: 20, mp: 80, cd: 40, type: 'mag', col: '#9aa0b0',
  desc: '挥动锁链横扫周围 8 次（前后都打得到，横向范围很大），让敌人出血；最后一记终结把打中的敌人拉到身前。挥动中连按 X 加快攻速，按跳跃直接终结。施放中霸体。',
  pow: lv => skillDmg(12, 1.2, lv), ai: { kind: 'aoe', r: [0, 240], dy: 40 },
  act: (lv, p) => ({ name: 'fb_lariat', clip: 'fbSwing', dur: FB_LARIAT_FIN + 0.42, superArmor: true, noCounter: true, links: fbRbLinks(p), linkFrom: 0.3, fbRB: true, hitSet: new Set(),
    hits: [HB(0.12, FB_LARIAT_FIN - 0.02, [-240, 240, 44, 0, 110], skillDmg(0.95, 0.095, lv), { rep: 0.18, max: 8, stun: 0.35, knock: 0, airLift: 80, hs: 0.025, type: 'mag', col: '#d8dce8', snd: 'slash',
      onHit: (a, t) => { fbAbn(a, t, 'bleed', 3, 0.2 * lvMul(lv)); if (a.act && a.act.hitSet) a.act.hitSet.add(t); } })],
    onStart: e => { e.act.cf = fbChainSwingFx(e, FB_LARIAT_FIN, { r: 200, spin: 12, flat: 0.28, grow: true }); sfx.swing(true); },
    onInput: (e, I) => { const a = e.act; if (e.actT >= FB_LARIAT_FIN) return false;
      if (I.buffered('attack')) { while (I.consume('attack')); a.spd = Math.min(1.6, (a.spd || 1) + 0.1); }
      if (I.buffered('jump')) { while (I.consume('jump')); e.actT = FB_LARIAT_FIN - 0.02; if (a.cf) a.cf.t = a.cf.dur; }
      return false; },
    onEnd: (e, cut) => { if (cut) e._fbRB = game.t; },
    update: e => { const a = e.act; if (e.actT < FB_LARIAT_FIN && Math.floor(e.actT / 0.18) !== a.sw) { a.sw = Math.floor(e.actT / 0.18); sfx.swing(false); fxDust(e.x + e.face * rnd(-200, 200), e.y + rnd(-20, 20), 2, 10); } },
    events: [evAt(FB_LARIAT_FIN, e => { const a = e.act; a.spd = 1; e.play('fbSlam', true); sfx.swing(true); cam.shake = Math.max(cam.shake, 4);
      fbChainSweep(e, 0.3, { r: 250, a0: Math.PI, a1: -0.2 });
      const hit = fbBox(e, [-250, 250, 50, 0, 120], { dmg: skillDmg(2.6, 0.26, lv), stun: 0.6, knock: 0, hs: 0.08, big: 1.4, col: '#dfe4ee', snd: 'blunt', onHit: (q, t) => fbAbn(q, t, 'bleed', 3, 0.25 * lvMul(lv)) });
      for (const t of new Set([...a.hitSet, ...hit])) if (!t.dead && !t.boss && !t.fixed) { const R = game.room, x = e.x + e.face * 64; t.x = R ? clamp(x, R.x0 + t.w, R.x1 - t.w) : x; t.y = clamp(lerp(t.y, e.y, 0.7), 4, DEPTH - 4); fxDust(t.x, t.y, 3, 8); } })] }) });

/* ---- 转职登记（J.ready 保持 false：等 B1 出帧、主线程开放）---- */
CLASSES.fighter.jobs.brawler = { art: 'job/brawler', name: '街霸', role: '中近距离 · 投掷 / 异常（魔法百分比）', armor: 'heavy', dmgType: 'mag', growth: { int: 1.08, vit: 1.05 },
  awakenName: '千手罗汉', awakenName2: '暗街之王', awakenName3: '归元·街霸', ready: true,
  desc: '在暗街里摸爬滚打出来的格斗家。毒瓶、毒针、砖块、罗网四种投掷物自动装填，敌人身上的异常越多伤害越高；锁链大招把一群敌人拖进来暴打。魔法百分比伤害职业。' };
Object.assign(CLASSES.fighter.jobs.brawler, {
  awaken: 'fb_awaken', awaken2: 'fb_awaken2', awaken3: 'fb_awaken3',
  auto: ['fb_poisonres', 'fb_overstrain', 'fb_heavy', 'fb_autoload'],
  skills: ['fb_poisonres', 'fb_overstrain', 'fb_heavy', 'fb_autoload', 'fb_strong', 'fb_poison', 'fb_backstreet', 'fb_hook', 'fb_pocket', 'fb_claw', 'fb_needle', 'fb_brick', 'fb_mount',
    'fb_taunt', 'fb_tackle', 'fb_net', 'fb_vulcan', 'fb_mine', 'fb_lariat'],
  anims: FB_ANIMS });
CLASSES.fighter.cmds.push(['bf', 'fb_strong', 'jump'], ['ff', 'fb_poison', 'buff'], ['uu', 'fb_backstreet', 'buff'], ['bdf', 'fb_hook'], ['ff', 'fb_needle'], ['uf', 'fb_brick'], ['fd', 'fb_mount'],
  ['dd', 'fb_taunt', 'buff'], ['bff', 'fb_tackle'], ['buf', 'fb_net'], ['dd', 'fb_mine'], ['fbf', 'fb_lariat']);

/* ---- 钩子 ---- */
FIGHTER_HOOKS.onHit.push((p, t, h, dmg) => {
  if (!isFb(p) || !t || t.dead) return;
  if (p.buffs.fb_taunt) fbTauntMark(p, t, p.buffs.fb_taunt.lv || 1);   // 挑衅：被打中的敌人伤害加深 10 秒
});
FIGHTER_HOOKS.onCast.push((p, id, act) => {
  if (!isFb(p)) return;
  // 诡诈之道：毒雷 / 极恶飞锁 / 千锁乱舞 / 爆破污桶 / 飞沙走石 中途取消接抛沙 / 投掷——霸体、不耗投掷物
  if (act && p._fbRB === game.t && FB_RB_TO.includes(id)) { act.superArmor = true;
    const Q = chargesOf(p, id), M = act.fbM; if (Q && M) { Q.n += M.use; if (Q.rl) { Q.rl = false; p.cool[id] = fbRethrow(p, id); } } }
  // 后街战术：抛沙一次撒两把（第二把晚 0.16 秒；每把 -50%）
  if (id === 'f_sand' && act && p.buffs.fb_backstreet && !act.fbDouble) { act.fbDouble = true; const d = 0.16;
    act.dmgMul = (act.dmgMul || 1) * 0.5; if (act.hits) act.hits = act.hits.concat(act.hits.map(h => ({ ...h, t0: h.t0 + d, t1: h.t1 + d })));
    if (act.events) act.events = act.events.concat(act.events.map(ev => ({ ...ev, t: ev.t + d, done: false }))); act.dur += d; }
  // 邪功修炼的副作用：念气类技能 2% 走火入魔
  if ((id === 'f_nenshot' || id === 'f_clone') && hasSkill(p, 'fb_overstrain') && !game.pvp && Math.random() < 0.02) game.after(0.3, () => { if (!p.dead) { addStatus(p, 'stun', 1); fxText('走火入魔', p.x, p.y, p.z + 40, { col: '#c080ff', size: 11 }); } });
});
// ---- 被动刷新（每 0.25 秒）----
CLASSES.fighter.passives.push(p => {
  if (!isFb(p)) { if (p._fbDt) { p.dmgType = p._fbDt; p._fbDt = null; } return; }
  if (p.dmgType !== 'mag') { p._fbDt = p.dmgType; p.dmgType = 'mag'; }   // 街霸是魔法职业：没写伤害类型的攻击（普攻 / 基础技能）也按魔法结算
  // 复活时：诡诈之道自动装满
  if (p._fbDead && !p.dead && hasSkill(p, 'fb_rulebreak')) for (const id of FB_THROWS) if (hasSkill(p, id)) fbFill(p, id);
  p._fbDead = p.dead;
  fbReloadTick(p);
  // 剧毒抵抗：中毒伤害 -25%
  const po = p.status && p.status.poison; if (po && !po._fbRes && hasSkill(p, 'fb_poisonres')) { po.dps *= 0.75; po._fbRes = true; }
  // 邪功修炼：力量 / 智力、物理 / 魔法暴击取高（按重新计算属性后的新面板取一次）
  if (hasSkill(p, 'fb_overstrain') && p.stats && p._fbOs !== p.stats) { p._fbOs = p.stats; const S = p.stats;
    if (S.str > S.int) p.matk = S.matk * (1 + S.str * 0.004) / (1 + S.int * 0.004);
    p.mcrit = Math.max(S.mcrit ?? 0, S.crit ?? 0); }
  // 爪精通（装爪时）
  const cl = skLv(p, 'fb_claw'); setPassive(p, 'fb_claw', cl > 0 && wtypeOf(p) === 'claw', { atk: 0.03 + 0.01 * cl, stagger: 25 });
  // 后街战术：每秒 1.6 MP；红色气息
  if (p.buffs.fb_backstreet) { p.mp = Math.max(0, p.mp - 0.4); if (Math.random() < 0.5) fxSpr('spark', p.x + rnd(-12, 12), p.y + 1, p.z + rnd(20, 90), { w: 16, dur: 0.2, col: '#ff5a3a' }); }
  // 挑衅光环
  const B = p.buffs.fb_taunt;
  if (B) { const R = 200 + 17 * ((B.lv || 1) - 1); for (const t of ents) if (foe(p, t) && inGround(t, p.x, p.y, R)) t._fbAura = game.t + 0.5; fbTauntAuraFx(p, R); }
  // 伤害加深到期
  for (const t of ents) if (t.buffs && t.buffs.fb_ti && t.buffs.fb_ti.until < game.t) delete t.buffs.fb_ti;
});
function fbTauntAuraFx(p, R) {
  if (p._fbAuraFx && fxList.indexOf(p._fbAuraFx) >= 0) { p._fbAuraFx.R = R; return; }
  p._fbAuraFx = addFx({ ent: p, y: p.y - 0.8, z: 0, dur: 1e9, R, update() { const e = this.ent; this.y = e.y - 0.8; if (e.dead || ents.indexOf(e) < 0 || !e.buffs.fb_taunt) this.t = this.dur; },
    draw(c) { const e = this.ent, X = sx(e.x), Y = sy(e.y, 0); c.save(); c.strokeStyle = 'rgba(255,90,58,.45)'; c.lineWidth = 2; c.setLineDash([8, 6]); c.lineDashOffset = -game.t * 20;
      c.beginPath(); c.ellipse(X, Y, this.R, this.R * GR, 0, 0, TAU); c.stroke(); c.restore(); } });
}
// 诡诈之道：进地下城自动装满投掷物
bus.on('dungeonEnter', () => { const p = game.player; if (!isFb(p) || !hasSkill(p, 'fb_rulebreak')) return; for (const id of FB_THROWS) if (hasSkill(p, id)) fbFill(p, id); });
