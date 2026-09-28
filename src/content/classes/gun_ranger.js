/* =====================================================================
   转职：漫游枪手（女）—— 左轮 + 枪刃 + 锁链（官方现版，见 docs/SKILLS_OFFICIAL_gun.md 第 4 节；等级按统一等级表换算）
   手感核心：
   - 花式枪术：技能之间有次数的强制中断（1~5 次，5~6.8 秒恢复 1 次）；刺踢 → 上旋踢、浮空弹 / 致命射击 → 刺踢 免费；上旋踢中可以移动
   - 双枪极舞刃（转职自动学会）：地面连按 C C = 飞燕射击；跳跃中 Z = 俯冲斩；滑铲中 Z = 起身斩（再按 Z 挑飞）；上旋踢中 Z = 翻腾攻击
   - 上旋踢是枢纽：上旋踢中 X = 音速劫击、Z = 翻腾攻击，还能接鲜血劫击
   觉醒：一觉 绯红盛宴（沾血蔷薇）→ 二觉 血舞祭（绯红玫瑰）→ 三觉 盛放·绯红花园（重霄·漫游枪手）
   ===================================================================== */
// 体术技能（隐匿切割：命中时追加一次枪刃切割 + 出血）
const RANGER_BODY = new Set(['g_knee', 'g_spin', 'g_flash', 'g_stomp', 'g_bbq', 'g_slide', 'g_sonic', 'g_bl_flip', 'g_bl_dive', 'g_bl_rush', 'g_bl_up', 'g_bl_rush2', 'g_bloodspike']);
// 枪刃刀光（红色）；有素材 fx/gunblade 时在刀光位置叠一把飞刃
function bladeSlash(e, o = {}) {
  fxSlashOn(e, { a0: o.a0 ?? -2.4, a1: o.a1 ?? 0.8, r: o.r || 58, w: o.w || 14, off: o.off || [12, 58], col: o.col || '#ff6a7a', squash: o.squash, heavy: o.heavy, silent: o.silent });
}
// 出血（枪刃改良延长时间、提高伤害）
function rangerBleed(a, t, k = 1) { const up = skLv(a, 'g_bladeup'); addStatus(t, 'bleed', 3 + up * 0.2, { dps: a.atk * 0.04 * k * (1 + 0.03 * up), src: a }); }
// 一条直线的精准射击（致命射击 / 致命回射 / 心灵反击共用）
function preciseShot(e, dmg, o = {}) {
  muzzle(e); sfx.gun(1.6); sfx.iai(); cam.shake = Math.max(cam.shake, 4); cam.flash = 0.04; cam.flashCol = '#fff0d0';
  fxStreak({ x: e.x + e.face * 30, y: e.y, z: e.z + 64, face: e.face, len: o.len || 560, w: 9, col: o.col || '#ffd070', dur: 0.22 });
  instantHit(e, { box: [20, o.len || 560, 16, 40, 92], dmg, stun: 0.5, knock: o.knock ?? 160, hs: 0.1, big: 1.5, col: '#ffe0a0', critBonus: o.crit ?? 0.3, snd: 'stab', ...(o.hit || {}) });
}
// 锁链（代码画，不用素材）：屏幕坐标 (X0,Y0) → (X1,Y1) 的一条二次曲线，链环平躺 / 侧立交替；
// o: { sag 下垂（像素）, col 链环高光色, glow 发光色（叠加一层）, tip 末端画枪刃尖, alpha }
function drawChain(c, X0, Y0, X1, Y1, o = {}) {
  const L = Math.hypot(X1 - X0, Y1 - Y0); if (L < 4) return;
  const CX = (X0 + X1) / 2, CY = (Y0 + Y1) / 2 + (o.sag || 0), n = Math.max(2, Math.floor(L / 7));
  const P = t => [(1 - t) * (1 - t) * X0 + 2 * (1 - t) * t * CX + t * t * X1, (1 - t) * (1 - t) * Y0 + 2 * (1 - t) * t * CY + t * t * Y1];
  const A = t => Math.atan2(2 * (1 - t) * (CY - Y0) + 2 * t * (Y1 - CY), 2 * (1 - t) * (CX - X0) + 2 * t * (X1 - CX));
  c.save(); c.globalAlpha *= o.alpha ?? 1; c.lineCap = 'round';
  if (o.glow) { c.globalCompositeOperation = 'lighter'; c.strokeStyle = o.glow; c.lineWidth = 8; c.beginPath(); c.moveTo(X0, Y0); c.quadraticCurveTo(CX, CY, X1, Y1); c.stroke(); c.globalCompositeOperation = 'source-over'; }
  const flat = new Path2D(), edge = new Path2D();
  for (let i = 0; i < n; i++) { const t = (i + 0.5) / n, [x, y] = P(t), a = A(t), ca = Math.cos(a), sa = Math.sin(a);
    if (i % 2) { edge.moveTo(x - ca * 3.5, y - sa * 3.5); edge.lineTo(x + ca * 3.5, y + sa * 3.5); }
    else { flat.moveTo(x + ca * 4.4, y + sa * 4.4); flat.ellipse(x, y, 4.4, 2.6, a, 0, TAU); } }
  c.strokeStyle = '#2a1a20'; c.lineWidth = 3.2; c.stroke(flat); c.lineWidth = 3.6; c.stroke(edge);
  c.strokeStyle = o.col || '#d8ccd0'; c.lineWidth = 1.4; c.stroke(flat); c.lineWidth = 1.6; c.stroke(edge);
  if (o.tip) chainTip(c, X1, Y1, A(1), o.tip === true ? 1 : o.tip);
  c.restore();
}
// 锁链末端的枪刃尖（和觉醒插图里一样的菱形刃）
function chainTip(c, x, y, a, s = 1) {
  c.save(); c.translate(x, y); c.rotate(a); c.scale(s, s);
  c.beginPath(); c.moveTo(16, 0); c.lineTo(2, -5.5); c.lineTo(-3, -2); c.lineTo(-6, -4); c.lineTo(-6, 4); c.lineTo(-3, 2); c.lineTo(2, 5.5); c.closePath();
  c.fillStyle = '#e8e2e6'; c.fill(); c.strokeStyle = '#2a1a20'; c.lineWidth = 1.6; c.stroke();
  c.beginPath(); c.moveTo(14, 0); c.lineTo(2, -3.6); c.strokeStyle = '#d0203a'; c.lineWidth = 1.4; c.stroke();
  c.restore();
}
// 从角色手上甩出一条锁链到某个点：先飞出去（前 0.08 秒），再停住，最后淡出
function chainLine(e, tx, tz, dur = 0.2, col = '#d8c0a0') {
  addFx({ x: e.x, y: e.y + 0.5, z: e.z + 62, tx, tz, face: e.face, dur, draw(c) { const k = this.t / this.dur, g = Math.min(1, this.t / 0.08), X0 = sx(this.x + this.face * 20), Y0 = sy(this.y, this.z);
    drawChain(c, X0, Y0, lerp(X0, sx(this.tx), g), lerp(Y0, sy(this.y, this.tz), g), { col, tip: true, sag: 6 * g, alpha: k > 0.7 ? (1 - k) / 0.3 : 1 }); } });
}
// 绯红花园：锁链从背后扇形放出（像一朵花在身后盛开），地上一圈锁链围成花园；fin 之后锁链断开、碎链飞散
function gardenFx(e, cx) {
  const N = 11, ring = 8, cy = e.y, face = e.face;
  const fan = addFx({ x: e.x, y: e.y - 0.6, z: e.z, dur: 3.6, draw(c) {
    const t = this.t, X0 = sx(e.x - face * 6), Y0 = sy(e.y, e.z + 72), cut = this.cutT ? clamp((t - this.cutT) / 0.3, 0, 1) : 0;
    for (let i = 0; i < N; i++) { const t0 = 0.05 + i * 0.045, g = clamp((t - t0) / 0.12, 0, 1); if (!g) continue;
      const ang = -Math.PI / 2 + (i / (N - 1) - 0.5) * 2.5 + Math.sin(t * 2 + i) * 0.03, R = (150 + (i % 3) * 34) * easeOut(g);
      const X1 = X0 + Math.cos(ang) * R - face * R * 0.3, Y1 = Y0 + Math.sin(ang) * R * 0.9;
      drawChain(c, X0, Y0, X1, Y1, { col: '#f0c8d0', glow: 'rgba(255,40,80,.22)', tip: 1.1, sag: -8, alpha: cut ? 1 - cut : 1 }); } } });
  const ground = addFx({ x: cx, y: -1e4, z: 0, dur: 3.6, draw(c) {
    const t = this.t - 0.55; if (t <= 0) return; const g = Math.min(1, t / 0.35), cut = this.cutT ? clamp((this.t - this.cutT) / 0.3, 0, 1) : 0, pts = [];
    for (let i = 0; i < ring; i++) { const a = i / ring * TAU + 0.3; pts.push([sx(cx + Math.cos(a) * 300), sy(cy + Math.sin(a) * 95, 0)]); }
    for (let i = 0; i < ring; i++) { const [xa, ya] = pts[i], [xb, yb] = pts[(i + 1) % ring]; if (i / ring > g) break;
      drawChain(c, xa, ya, xb, yb, { col: '#e8b8c4', glow: 'rgba(255,40,80,.18)', sag: 4, alpha: 1 - cut }); }
    if (cut < 1) for (const [x, y] of pts) chainTip(c, x, y - 14, Math.PI / 2, 1.2 * g); } });   // 钉在地上的枪刃
  // 终结：锁链全部断开，碎链和枪刃向四周飞散
  return { cut() { fan.cutT = fan.t; ground.cutT = ground.t; fan.dur = Math.min(fan.dur, fan.t + 0.35); ground.dur = Math.min(ground.dur, ground.t + 0.35); bladeShards(cx, cy, 40, 14); bladeShards(e.x, e.y, 70, 8); } };
}
// 飞散的碎链 / 枪刃（纯特效）
function bladeShards(x, y, z, n, col = '#ff5a7a') {
  for (let i = 0; i < n; i++) { const a = rnd(0, TAU), v = rnd(160, 420);
    addFx({ x, y: y + rnd(-30, 30), z: z + rnd(0, 60), vx: Math.cos(a) * v, vz: Math.sin(a) * v * 0.7 + 120, rot: rnd(0, TAU), spin: rnd(-14, 14), dur: rnd(0.35, 0.6),
      update(dt) { this.x += this.vx * dt; this.z = Math.max(0, this.z + this.vz * dt); this.vz -= 700 * dt; this.rot += this.spin * dt; },
      draw(c) { drawSpr(c, 'gunblade', sx(this.x), sy(this.y, this.z), 40, 0, { rot: this.rot, add: false, alpha: 1 - easeIn(this.t / this.dur) });
        c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = col; c.globalAlpha = 0.5 * (1 - this.t / this.dur); c.fillRect(sx(this.x) - 2, sy(this.y, this.z) - 2, 4, 4); c.restore(); } }); }
}
/* ---- 花式枪术：次数制柔化 ---- */
const STYLISH_FREE = { g_flash: ['g_spin'], g_launch: ['g_flash'], g_head: ['g_flash'] };   // 不消耗次数的衔接
const stylishMax = p => { const lv = skLv(p, 'g_stylish'); return lv ? Math.min(5, 1 + Math.floor((lv - 1) / 2)) + (skLv(p, 'g_chainwill') ? 1 : 0) : 0; };
function stylishOf(p) {
  const lv = skLv(p, 'g_stylish'), max = stylishMax(p), per = 6.8 - (lv - 1) * 0.2, s = p._sty || (p._sty = { n: max, last: game.t });
  while (s.n < max && game.t - s.last >= per) { s.n++; s.last += per; }
  if (s.n >= max) { s.n = max; s.last = game.t; }
  return s;
}
CLASSES.gun.cancelHook = (p, a, id) => {
  if (!a.skill || !skLv(p, 'g_stylish')) return false;
  const S = SKILLS[id]; if (!S || S.awaken || S.passive) return false;
  if ((STYLISH_FREE[a.skill] || []).includes(id)) return true;
  if (game.pvp || p.actT < 0.05) return false;           // 决斗场里次数为 0（官方）
  return stylishOf(p).n >= 1;
};
// 真的放出来了才扣次数（castSkill 成功后调用）
CLASSES.gun.softCommit = (p, a, id) => {
  if (!a || !a.skill || (STYLISH_FREE[a.skill] || []).includes(id)) return;
  const s = stylishOf(p); if (s.n >= 1) { if (s.n >= stylishMax(p)) s.last = game.t; s.n--; fxText('花式', p.x, p.y, p.z + 16, { col: '#ff9ab0', size: 10 }); }
};
/* ---- 转职技能（官方 15~45 级 → 本作 15~20 级）---- */
defSkill('g_revmaster', { name: '左轮奥义', cls: 'gun', job: 'ranger', lvReq: 15, sp: 15, mp: 0, cd: 0, type: 'phys', passive: true, col: '#8a6a3a',
  desc: '【被动】精通左轮：普通射击的攻击力、穿透几率提高，装填更快；暴击率、攻击速度、移动速度小幅提高。只在装备左轮（或没装备武器）时生效。',
  infoExtra: lv => [['射击伤害', '+' + pct(0.02 * lv)], ['穿透几率', pct(0.04 * lv)], ['装填速度', '+' + pct(0.1 * lv)], ['暴击 / 攻速 / 移速', '+' + pct(0.01 * lv)]] });
defSkill('g_blade', { name: '双枪极舞刃', cls: 'gun', job: 'ranger', lvReq: 15, maxLv: 1, sp: 0, mp: 0, cd: 0, type: 'phys', passive: true, col: '#c83a4a', cmdNote: 'C C / 空中 Z / 滑铲中 Z / 上旋踢中 Z',
  desc: '【被动，转职时自动学会】左轮装上枪刃，多出 4 个派生：地面连按 C C = 飞燕射击（向前空翻，向下射击）；跳跃中按 Z = 俯冲斩；滑铲（跑攻）中按 Z = 起身斩（再按 Z 把敌人挑飞，落地前可以接浮空弹或致命射击）；上旋踢中按 Z = 翻腾攻击。' });
// 双枪极舞刃的 4 个派生（不单独学，等级跟双枪极舞刃走）
const bladeSub = (id, o) => defSkill(id, { cls: 'gun', job: 'ranger', lvReq: 15, lvFrom: 'g_blade', maxLv: 1, sp: 0, hidden: true, type: 'phys', col: '#c83a4a', ...o });
bladeSub('g_bl_flip', { name: '飞燕射击', mp: 6, cd: 2, air: true, airOnly: true, req: p => p.st === 'jump' && p.stT < 0.4 ? true : '起跳后马上再按 C',
  desc: '起跳后马上再按 C：向前空翻，同时向下连开 3 枪。',
  act: () => ({ name: 'g_bl_flip', clip: 'rainbow', dur: 0.55, airOnly: true, lowGrav: 0.45, noCounter: true,
    onStart: e => { e.vz = Math.max(e.vz, 300); e.vx = e.face * 230; sfx.jump(); },
    update: e => { const a = e.act, n = Math.floor((e.actT - 0.1) / 0.1); if (e.actT > 0.1 && n !== a.n && n < 3) { a.n = n; fireBullet(e, { down: true, dmg: 0.9 * shotDmgOf(e), life: 0.5, vol: 0.7 }); } } }) });
bladeSub('g_bl_dive', { name: '俯冲斩', mp: 6, cd: 1, air: true, airOnly: true, desc: '跳跃中按 Z：挥着枪刃沿斜线向下俯冲斩击。',
  act: () => ({ name: 'g_bl_dive', clip: 'airBlade', dur: 0.7, airOnly: true, noCounter: true,
    onStart: e => { e.vz = -560; e.vx = e.face * 380; bladeSlash(e, { a0: -1.3, a1: 1.7, r: 62, heavy: true }); },
    hits: [HB(0, 0.7, [-6, 62, 26, -50, 70], 1.4, { stun: 0.4, knock: 80, airLift: 160, hs: 0.05, snd: 'slash', col: '#ff9aa8' })],
    onLand: e => { fxDust(e.x, e.y, 5, 12); e.vx *= 0.2; e.endAct(); } }) });
bladeSub('g_bl_rush', { name: '起身斩', mp: 6, cd: 1, desc: '滑铲（跑攻）中按 Z：顺势起身斩击；再按 Z 把敌人挑飞，落地前可以接浮空弹或致命射击。',
  act: () => ({ name: 'g_bl_rush', clip: 'rushBlade', dur: 0.46, noCounter: true, move: [[0, 0.12, 140]], follow: () => bladeRush2(), followWin: [0.16, 0.46],
    hits: [HB(0.05, 0.16, [0, 72, 28, 0, 110], 1.3, { stun: 0.5, knock: 60, launch: 220, hs: 0.06, snd: 'slash', col: '#ff9aa8' })],
    events: [evAt(0.04, e => bladeSlash(e, { a0: 1.5, a1: -1.6, r: 60 }))] }) });
function bladeRush2() {
  return { name: 'g_bl_rush2', clip: 'kick', dur: 0.45, noCounter: true, links: ['g_launch', 'g_head'],
    hits: [HB(0.06, 0.16, [0, 70, 28, 10, 140], 1.2, { launch: 520, knock: 40, hs: 0.07, snd: 'blunt', big: 1.2 })],
    events: [evAt(0.05, e => bladeSlash(e, { a0: 1.8, a1: -1.2, r: 66, heavy: true }))] };
}
bladeSub('g_bl_up', { name: '翻腾攻击', mp: 6, cd: 1.5, desc: '上旋踢中按 Z：原地向上一记翻腾踢，把敌人挑飞。',
  act: () => ({ name: 'g_bl_up', clip: 'kick', dur: 0.42, noCounter: true, links: ['g_launch', 'g_head', 'g_flash'],
    hits: [HB(0.06, 0.16, [-10, 66, 28, 10, 150], 1.2, { launch: 560, knock: 20, hs: 0.07, snd: 'blunt', big: 1.2 })],
    events: [evAt(0.05, e => bladeSlash(e, { a0: 2.0, a1: -1.4, r: 60 }))] }) });
defSkill('g_head', { name: '致命射击', cls: 'gun', job: 'ranger', lvReq: 15, mp: 25, cd: 6.5, type: 'phys', icon: 'g_head', col: '#8a2a3a',
  desc: '瞬间射出一发贯穿直线的精准子弹，命中率、暴击率都很高。', pow: lv => skillDmg(4.0, 0.4, lv), ai: { kind: 'burst', r: [0, 540], dy: 12 },
  act: (lv) => ({ name: 'g_head', clip: 'headShot', dur: 0.42, events: [evAt(0.06, e => preciseShot(e, skillDmg(4.0, 0.4, lv) * shotDmgOf(e)))] }) });
defSkill('g_guard', { name: '远程格挡', cls: 'gun', job: 'ranger', lvReq: 16, mp: 8, cd: 5, type: 'phys', col: '#6a8aa8', cmdNote: '只能用快捷栏',
  desc: '举枪挡住正面的远程攻击（飞行道具），吸收一部分伤害，不会被打僵。按住技能键持续格挡。格挡成功后，短时间内攻击速度、移动速度提高。',
  infoExtra: lv => [['吸收伤害', pct(Math.min(0.8, 0.3 + 0.05 * lv))]], ai: { kind: 'guard' },
  act: (lv) => ({ name: 'g_guard', clip: 'dualAim', dur: 3, noCounter: true, guardProj: Math.min(0.8, 0.3 + 0.05 * lv),
    update: e => { e.vx = 0; if (e.actT > 0.25 && !e.pad.is(e.act.key || 'attack')) e.endAct(); } }) });
// 远程格挡：只挡正面的飞行道具（受击前钩子 beforeHurt，由 engine/combat.js 调用）
CLASSES.gun.beforeHurt = (p, a, h, opt) => {
  const act = p.act; if (!act || p.st !== 'act' || !act.guardProj || !opt || !opt.proj || h.grab) return null;
  const src = opt.src || a; if (Math.sign((src.x ?? a.x) - p.x || 1) !== p.face) return null;
  p.buffs.g_guardOk = { t: 5, aspd: 0.1, spd: 0.03, hide: false }; fxGuard(p);
  return { mul: 1 - act.guardProj, noStun: true };
};
defSkill('g_stylish', { name: '花式枪术', cls: 'gun', job: 'ranger', lvReq: 16, sp: 20, mp: 0, cd: 0, type: 'phys', passive: true, col: '#d86a9a',
  desc: '【被动】漫游枪手的身法：技能之间可以强制中断（柔化），次数有限，隔一段时间恢复 1 次；刺踢 → 上旋踢、浮空弹 / 致命射击 → 刺踢 不消耗次数；上旋踢中可以用方向键移动。决斗场里不能柔化。',
  infoExtra: lv => [['柔化次数', String(Math.min(5, 1 + Math.floor((lv - 1) / 2)))], ['恢复 1 次', (6.8 - (lv - 1) * 0.2).toFixed(1) + ' 秒']] });
defSkill('g_quickdraw', { name: '快速拔枪', cls: 'gun', job: 'ranger', lvReq: 17, sp: 15, mp: 0, cd: 0, type: 'phys', passive: true, col: '#b8903a',
  desc: '【被动】普通攻击的拔枪速度和攻击力提高。', infoExtra: lv => [['拔枪速度', '+' + pct(0.08 * lv)], ['普攻伤害', '+' + pct(0.015 * lv)]] });
defSkill('g_revenge', { name: '心灵反击', cls: 'gun', job: 'ranger', lvReq: 17, maxLv: 1, mp: 20, cd: 4.5, type: 'phys', col: '#a0304a', cmdNote: '(被击时) Z',
  whenHit: true, hitWin: 1,   // 受击硬直 / 倒地中，或被打中后 1 秒内
  desc: '被击中后 1 秒内（或受击、倒地中）按 Z：先闪身（无敌），再以霸体回敬一发致命射击，把敌人眩晕 3 秒。被抓住时不能用。', pow: () => 4.0, ai: { kind: 'burst', r: [0, 400], dy: 14 },
  act: (lv) => ({ name: 'g_revenge', clip: 'backshot', dur: 0.55, noCounter: true, invul: [0, 0.22], superArmor: [0.22, 0.55],
    onStart: e => { fxAfterimage(e, '#ff9ab0'); e.vx = -e.face * 80; },
    events: [evAt(0.22, e => { e.play('headShot', true); preciseShot(e, skillDmg(4.0, 0.4, skLv(e, 'g_head') || 1) * shotDmgOf(e), { knock: game.pvp ? 320 : 120, hit: { onHit: (a, t) => { if (!game.pvp) addStatus(t, 'stun', 3, { src: a }); } } }); })] }) });
defSkill('g_chain', { name: '锁链截击', cls: 'gun', job: 'ranger', lvReq: 17, mp: 35, cd: 5, type: 'phys', col: '#a8a098',
  desc: '把枪刃连着锁链竖着甩出去旋转，多段攻击并把周围的敌人聚到身前。旋转中再按技能键：第 2 击把敌人推开，第 3 击把敌人拉回身边。', pow: lv => skillDmg(4.2, 0.42, lv), ai: { kind: 'aoe', r: [0, 150], dy: 40 },
  act: (lv) => chainStage(lv, 1) });
function chainStage(lv, n) {
  const base = { name: 'g_chain' + n, clip: n === 1 ? 'chainSnatch' : 'shoot2', noCounter: true, follow: n < 3 ? () => chainStage(lv, n + 1) : null, followWin: [0.3, 0.8] };
  if (n === 1) return { ...base, dur: 0.8,
    update: e => { const a = e.act, k = Math.floor((e.actT - 0.08) / 0.1), cx = e.x + e.face * 80;
      if (e.actT > 0.08 && e.actT < 0.7 && k !== a.k) { a.k = k; chainLine(e, cx, 70, 0.2); bladeSlash(e, { a0: -Math.PI + k, a1: k + 0.5, r: 46, off: [70, 70], silent: k % 2 === 1 });
        instantHit(e, { box: [20, 150, 44, 0, 120], dmg: skillDmg(0.4, 0.04, lv), stun: 0.3, knock: 0, airLift: 90, hs: 0.02, snd: 'slash', col: '#ffb0b0',
          onHit: (a2, t) => { if (!hasSA(t) && !t.boss) { t.x = lerp(t.x, cx, 0.35); t.y = lerp(t.y, e.y, 0.3); } } }); } } };
  return { ...base, dur: 0.55,
    events: [evAt(0.08, e => { const push = n === 2; chainLine(e, e.x + e.face * (push ? 190 : 140), 70, 0.2); sfx.swing(true);
      instantHit(e, { box: [20, push ? 190 : 170, 40, 0, 120], dmg: skillDmg(1.2, 0.12, lv), stun: 0.5, knock: push ? 260 : 220, pull: !push, hs: 0.06, heavy: true, snd: 'slash', col: '#ffb0b0' }); })] };
}
defSkill('g_backshot', { name: '致命回射', cls: 'gun', job: 'ranger', lvReq: 18, mp: 30, cd: 12, type: 'phys', col: '#9a3a4a', pre: { g_head: 1 },
  desc: '迅速回身，朝身后开一发致命射击。需要致命射击 Lv1。', pow: lv => skillDmg(4.6, 0.46, lv), ai: { kind: 'burst', r: [0, 500], dy: 12 },
  act: (lv) => ({ name: 'g_backshot', clip: 'backshot', dur: 0.45, onStart: e => { e.face = -e.face; },
    events: [evAt(0.08, e => preciseShot(e, skillDmg(4.6, 0.46, lv) * shotDmgOf(e), { crit: 0.25 }))] }) });
defSkill('g_sonic', { name: '音速劫击', cls: 'gun', job: 'ranger', lvReq: 18, mp: 25, cd: 4.4, type: 'phys', col: '#e0703a', cmdNote: '上旋踢中 方向键 + X',
  desc: '上旋踢中按方向键决定方向、按 X：贴地飞踢突进，多段攻击并把敌人踢飞。', pow: lv => skillDmg(3.6, 0.36, lv),
  act: (lv, p) => { const dy = p && p.pad ? p.pad.dy() : 0; return { name: 'g_sonic', clip: 'flashKick', dur: 0.5, noCounter: true, move: [[0, 0.32, 520, 0, dy * 160]],
    update: e => { if (e.actT < 0.32 && Math.floor(e.actT / 0.05) !== e.act.ai) { e.act.ai = Math.floor(e.actT / 0.05); fxAfterimage(e, '#ffb070'); } },
    hits: [HB(0.02, 0.34, [-6, 64, 28, 0, 90], skillDmg(1.2, 0.12, lv), { rep: 0.1, max: 3, stun: 0.4, knock: 60, launch: 300, airLift: 220, hs: 0.05, snd: 'blunt' })] }; } });
defSkill('g_buff', { name: '死亡左轮', cls: 'gun', job: 'ranger', lvReq: 18, mp: 40, cd: 5, type: 'phys', buff: true, icon: 'g_buff', col: '#8a60e0',
  desc: '【BUFF】120 秒内暴击伤害提高（只在装备左轮时生效）。', infoExtra: lv => [['暴击伤害', '+' + pct(0.1 + 0.02 * lv)], ['持续', '120 秒']], ai: { kind: 'buff' },
  act: (lv) => ({ name: 'g_buff', clip: 'gbuff', dur: 0.45, noCounter: true,
    onStart: e => { e.buffs.g_buff = { t: 120, critDmg: isRevolver(e) ? 0.1 + 0.02 * lv : 0, lv }; sfx.buff(); muzzle(e); sfx.gun(0.6); fxAura(e, '#b080ff'); } }) });
defSkill('g_rapid', { name: '枪舞', cls: 'gun', job: 'ranger', lvReq: 19, mp: 50, cd: 16, type: 'phys', icon: 'g_rapid', col: '#d8a02a',
  desc: '原地一边挥枪刃一边向周围开枪（近处是枪刃，远处是子弹），把周围的敌人吸过来并托上天。全程霸体；连按 X 加快、按 C 中断。', pow: lv => skillDmg(6.0, 0.6, lv), ai: { kind: 'aoe', r: [0, 200], dy: 60 },
  act: (lv) => ({ name: 'g_rapid', clip: 'gunDance', dur: 1.8, noCounter: true, superArmor: true,
    onInput: (e, I) => { if (I.buffered('attack')) { I.consume('attack'); e.act.fast = Math.min(0.45, (e.act.fast || 0) + 0.06); } if (I.buffered('jump')) { I.consume('jump'); e.act.dur = Math.min(e.act.dur, e.actT + 0.05); } return false; },
    update: e => { const a = e.act, step = 0.08 * (1 - (a.fast || 0)), n = Math.floor(e.actT / step);
      if (n !== a.n && e.actT < a.dur - 0.12) { a.n = n; const f = e.face; e.face = n % 2 ? -f : f;
        fireBullet(e, { up: n % 4 === 2, low: n % 4 === 3, dmg: skillDmg(0.24, 0.024, lv) * shotDmgOf(e), lift: 200, life: 0.36, vol: 0.45, quiet: n % 2 === 1 }); e.face = f; }
      const b = Math.floor(e.actT / 0.2); if (b !== a.b && e.actT < a.dur - 0.1) { a.b = b; bladeSlash(e, { a0: b % 2 ? 0.5 : -2.6, a1: b % 2 ? -2.6 : 0.5, r: 72, off: [0, 60], silent: true });
        for (const t of ents) if (hittable(e, t) && Math.abs(t.x - e.x) < 170 && Math.abs(t.y - e.y) < 60 && !hasSA(t) && !t.boss) { t.x = lerp(t.x, e.x + Math.sign(t.x - e.x || 1) * 50, 0.25); }
        instantHit(e, { box: [-95, 95, 46, 0, 130], dmg: skillDmg(0.36, 0.036, lv), stun: 0.3, knock: 0, airLift: 200, launch: 200, hs: 0.02, snd: 'slash', col: '#ffb0b0' }); } } }) });
const MOVING_AMMO = { revolver: 30, autopistol: 50, rifle: 30, handcannon: 20, bowgun: 45 };
defSkill('g_moving', { name: '移动射击', cls: 'gun', job: 'ranger', lvReq: 19, mp: 40, cd: 20, type: 'phys', col: '#6a8a3a',
  desc: '进入移动射击模式：方向键自由移动，X（或按住技能键）射击，Z 调转方向，C 退出。子弹打完就结束（左轮 30 发、自动手枪 50、步枪 30、手炮 20、手弩 45）。全程霸体。', pow: lv => skillDmg(0.4, 0.04, lv) * 30,
  infoExtra: () => [['弹数', '左轮 30 发']], ai: { kind: 'mode' },
  act: (lv) => ({ name: 'g_moving', clip: 'moveShot', dur: 20, noCounter: true, superArmor: true,
    onStart: e => { e.act.ammo = MOVING_AMMO[wtypeOf(e)] || 30; },
    onInput: (e, I) => {
      const a = e.act, dx = I.dx(), dy = I.dy(), sp = e.speed * mspdOf(e) * 0.75;
      e.vx = dx * sp; e.vy = dy * sp * 0.8;
      if (I.buffered('cmd')) { I.consume('cmd'); e.face = -e.face; }
      if (I.buffered('jump') && e.actT > 0.1) { I.consume('jump'); a.dur = Math.min(a.dur, e.actT + 0.05); }
      if ((I.buffered('attack') || I.is('attack') || (a.key && a.key[0] === 's' && I.is(a.key))) && !(a.cdT > e.actT) && a.ammo > 0) {
        I.consume('attack'); a.cdT = e.actT + 0.12 / aspdOf(e); a.ammo--; fireBullet(e, { dmg: skillDmg(0.4, 0.04, lv) * shotDmgOf(e) });
        if (a.ammo <= 0) a.dur = Math.min(a.dur, e.actT + 0.25); }
      a.walking = !!(dx || dy);
      return true;   // 模式中按键都由这里处理（Z 调转方向、C 退出）
    },
    update: e => { e.play(e.act.walking ? 'moveShot' : 'dualAim'); },
    onEnd: e => { e.vx = 0; e.vy = 0; } }) });
defSkill('g_multi', { name: '多重射击', cls: 'gun', job: 'ranger', lvReq: 19, mp: 60, cd: 15, type: 'phys', col: '#a02a3a', noWtype: ['handcannon'], pre: { g_backshot: 1, g_rapid: 1 },
  desc: '朝一片区域连续精准射击 9 发，暴击率提高。施放时按住方向键决定朝哪边打（前方、上方纵深、下方纵深、身后），有敌人时优先打敌人。手炮不能用。需要致命回射、枪舞各 Lv1。', pow: lv => skillDmg(9.0, 0.9, lv), ai: { kind: 'burst', r: [0, 480], dy: 80 },
  act: (lv) => ({ name: 'g_multi', clip: 'aimShot', dur: 1.25, noCounter: true, superArmor: [0, 0.3],
    onStart: e => { const I = e.pad, dx = I ? I.dx() : 0, dy = I ? I.dy() : 0; if (dx) e.face = dx; e.act.dy = dy; sfx.charge(); },
    update: e => { const a = e.act, n = Math.floor((e.actT - 0.3) / 0.1);
      if (e.actT > 0.3 && n !== a.n && n < 9) { a.n = n;
        const ys = a.dy < 0 ? [e.y - 90, e.y + 10] : a.dy > 0 ? [e.y - 10, e.y + 90] : [e.y - 50, e.y + 50];
        const L = ents.filter(t => hittable(e, t) && (t.x - e.x) * e.face > 0 && Math.abs(t.x - e.x) < 660 && t.y > ys[0] && t.y < ys[1]);
        const t = L.length ? L[n % L.length] : null, px = t ? t.x : e.x + e.face * rnd(120, 560), py = t ? t.y : clamp(rnd(ys[0], ys[1]), 8, DEPTH - 8), pz = t ? t.z + t.hurtH() * 0.75 : 60;
        muzzle(e); sfx.gun(1.1); e.play('headShot', true);
        addFx({ x: e.x + e.face * 34, y: Math.max(e.y, py) + 1, z: e.z + 64, tx: px, ty: py, tz: pz, dur: 0.1, add: true, draw(c) { c.save(); c.globalCompositeOperation = 'lighter'; c.strokeStyle = `rgba(255,220,120,${1 - this.t / this.dur})`; c.lineWidth = 3; c.beginPath(); c.moveTo(sx(this.x), sy(this.y, this.z)); c.lineTo(sx(this.tx), sy(this.ty, this.tz)); c.stroke(); c.restore(); } });
        if (t && hittable(e, t)) applyHit(e, t, { dmg: skillDmg(1.0, 0.1, lv) * shotDmgOf(e), stun: 0.45, knock: 60, hs: 0.05, critBonus: 0.3, snd: 'stab', col: '#ffe0a0', sure: true }, { proj: true });
        else fxDust(px, py, 3, 8, '#a89878'); } } }) });
defSkill('g_hawk', { name: '双鹰回旋', cls: 'gun', job: 'ranger', lvReq: 20, mp: 60, cd: 25, type: 'phys', icon: 'g_hawk', col: '#2aa0a0', pre: { g_multi: 1 },
  desc: '把两把左轮旋转着掷出，飞出去再飞回来，一路自动开火。接住飞回来的枪后可以再按技能键再掷（最多 3 次），每掷一次范围更大、转得更快；接枪和掷枪时霸体。需要多重射击 Lv1。', pow: lv => skillDmg(4.5, 0.45, lv) * 3, ai: { kind: 'proj', r: [0, 360], dy: 20 },
  recast: { ok: p => !!p._hawk && game.t - p._hawk.t < 1.5 && p._hawk.n <= 3, act: (lv, p) => { const n = p._hawk.n; p._hawk = null; return hawkThrow(lv, n); }, cd: 0.2, mp: 0 },
  act: (lv) => hawkThrow(lv, 1) });
function hawkThrow(lv, n) {
  return { name: 'g_hawk' + n, clip: 'ghawk', dur: 0.5, superArmor: [0, 0.3], noCounter: true,
    onStart: e => { e._hawk = null; e._hawkOut = 2; },
    events: [evAt(0.2, e => { sfx.swing(true); for (let i = 0; i < 2; i++) game.after(i * 0.1, () => { if (!e.dead) hawkGun2(e, i, skillDmg(1.5, 0.15, lv) * (1 + 0.15 * (n - 1)), n); }); })] };
}
// 回旋手枪：飞出去再飞回来（范围随第几掷变大）；两把都回来了就算“接住”，可以再掷
function hawkGun2(e, i, dmg, n) {
  const T = 1.2 - 0.1 * (n - 1), R = 330 * (1 + 0.2 * (n - 1)), x0 = e.x, dir = e.face, z0 = 50 + i * 28;
  spawnProj({ owner: e, x: x0, y: e.y, z: z0, face: dir, life: T, w: 14 + n * 3, d: 18 + n * 4, h: 18, pierce: true, spin: 0, sndT: 0,
    hit: { dmg, stun: 0.3, knock: 20, airLift: 150, hs: 0.03, rep: 0.14 - 0.02 * (n - 1), col: '#bfefff' },
    update(pr, dt) { const u = clamp(pr.t / T, 0, 1); pr.x = lerp(x0, e.x, u) + dir * R * Math.sin(Math.PI * u); pr.y = damp(pr.y, e.y, 4, dt); pr.spin += dt * (30 + n * 8); pr.sndT -= dt;
      if (pr.sndT <= 0) { pr.sndT = 0.15; sfx.swing(false); sfx.gun(0.25); }
      if (Math.random() < 0.3) addFx({ x: pr.x, y: pr.y + 1, z: pr.z, dur: 0.06, add: true, rot: rnd(0, TAU), draw(c) { drawSpr(c, 'muzzle', sx(this.x), sy(this.y, this.z), 26, 0, { ax: 0.2, rot: this.rot, alpha: 1 - this.t / this.dur }); } }); },   // 旋转中自动开火的枪口火光
    onEnd() { if (--e._hawkOut <= 0 && !e.dead && e.st !== 'held' && e.st !== 'down') { e._hawk = { n: n + 1, t: game.t }; if (n < 3) { e.superArmor = Math.max(e.superArmor, 0.3); fxText('接枪', e.x, e.y, e.z + 20, { col: '#bfefff', size: 10 }); } } },
    draw(c, pr) { const X = sx(pr.x), Y = sy(pr.y, pr.z); c.save(); c.translate(X, Y); c.rotate(pr.spin); c.globalCompositeOperation = 'lighter'; c.strokeStyle = 'rgba(160,230,255,.5)'; c.lineWidth = 3; c.beginPath(); c.arc(0, 0, 14 + n * 3, 0, TAU * 0.7); c.stroke(); c.globalCompositeOperation = 'source-over'; c.rotate(Math.PI / 2); c.scale(1.1, 1.1); drawGun(c, PAL_GUN); c.restore(); } });
}
/* ---- 一次觉醒：沾血蔷薇（官方 48~70 级 → 本作 21~25 级）---- */
defSkill('g_hidecut', { name: '隐匿切割', cls: 'gun', job: 'ranger', tier: 1, lvReq: 21, sp: 20, mp: 0, cd: 0, type: 'phys', passive: true, col: '#a0203a',
  desc: '【一觉被动】体术技能（后撩踢、上旋踢、刺踢、钉刺射、BBQ、浮空铲、音速劫击、双枪极舞刃的派生……）命中时，追加一次枪刃切割并让敌人出血。',
  infoExtra: lv => [['切割伤害', pct(skillDmg(0.8, 0.08, lv))]] });
CLASSES.gun.onHit = (p, t, h, dmg, act, opt) => {
  if (!act || !act.skill || !RANGER_BODY.has(act.skill) || (opt && opt.hidecut)) return;
  const lv = skLv(p, 'g_hidecut'); if (!lv || t.dead) return;
  const done = act._hc || (act._hc = new Set()); if (done.has(t.id)) return; done.add(t.id);
  fxSlash({ x: t.x - p.face * 20, y: t.y, z: t.z + 40, face: p.face, col: '#ff4a5a', a0: -2.2, a1: 0.9, r: 34, w: 8, off: [0, 0], silent: true });
  applyHit(p, t, { dmg: skillDmg(0.8, 0.08, lv), hs: 0.01, sure: true, snd: 'slash', col: '#ff8a9a', stun: 0.1, knock: 0 }, { proj: true, hidecut: true });
  rangerBleed(p, t);
};
defSkill('g_awaken', { name: '绯红盛宴', cls: 'gun', job: 'ranger', tier: 1, lvReq: 21, maxLv: 3, mp: 150, cd: 60, pvp: 0.45, type: 'phys', awaken: true, col: '#c0102a',
  desc: '【觉醒】用枪刃向前方一片区域连续斩击、投掷，连按 X 或 Z 增加轮数（最多 6 轮，每轮 4 段），最后聚起一把灵魂巨刃升空斩终结；按住前方向键会多冲一段。全程无敌，全部附加出血。', pow: lv => skillDmg(22, 6, lv), ai: { kind: 'awaken', r: [0, 260], dy: 60 },
  act: (lv) => ({ name: 'g_awaken', clip: 'carnival', dur: 4, superArmor: true, noCounter: true, invul: true,
    onStart: e => { game.cutin = { t: 0, dur: 1.0, name: '绯红盛宴', who: cutinWho(e) }; game.timeStop = 0.9; sfx.awaken(); e.act.rounds = 1; e.act.finT = 0.4 + 0.45; },
    onInput: (e, I) => { const a = e.act; if (!a.fin && (I.buffered('attack') || I.buffered('cmd')) && a.rounds < 6) { I.consume('attack'); I.consume('cmd'); a.rounds++; a.finT = 0.4 + a.rounds * 0.45; } return true; },
    update: e => { const a = e.act, k = Math.floor((e.actT - 0.4) / 0.11);
      if (!a.fin && e.actT > 0.4 && e.actT < a.finT && k !== a.k) { a.k = k; e.play(k % 2 ? 'carnival' : 'carnival2', true); bladeSlash(e, { a0: k % 2 ? 1.2 : -2.4, a1: k % 2 ? -2.4 : 1.2, r: 90, w: 18, off: [30, 70], silent: k % 3 !== 0 });
        instantHit(e, { box: [0, 230, 60, 0, 150], dmg: skillDmg(0.9, 0.3, lv), stun: 0.4, knock: 0, airLift: 60, hs: 0.02, sure: true, downHit: true, snd: 'slash', col: '#ff5a6a', onHit: (a2, t) => rangerBleed(a2, t, 1.5) }); }
      if (!a.fin && e.actT >= a.finT) { a.fin = e.actT; a.dur = e.actT + 1.0; e.play('carnival2', true); if (e.pad && e.pad.is(e.face > 0 ? 'right' : 'left')) e.vx = e.face * 380; }
      if (a.fin && !a.boom && e.actT > a.fin + 0.35) { a.boom = true; e.vx = 0; cam.shake = 12; cam.flash = 0.2; cam.flashCol = '#ffb0c0'; sfx.boom(1.3);
        fxSpr('petal', e.x + e.face * 120, e.y, 80, { w: 260, dur: 0.7, col: '#ff4a6a', grow: [0.3, 1.3] }); fxShock(e.x + e.face * 110, e.y, 260, '#ff3a5a');
        for (const t of ents) if (hittable(e, t) && (t.x - e.x) * e.face > -40 && Math.abs(t.x - e.x) < 320 && Math.abs(t.y - e.y) < 80) { applyHit(e, t, { dmg: skillDmg(8, 2.4, lv), launch: 560, knock: 160, hs: 0.15, big: 2, critBonus: 0.2, sure: true, downHit: true, col: '#ff8aa0' }, { proj: true }); rangerBleed(e, t, 3); } } } }) });
defSkill('g_bloodspike', { name: '鲜血劫击', cls: 'gun', job: 'ranger', tier: 1, lvReq: 23, mp: 55, cd: 20, type: 'phys', col: '#c0203a', air: true,
  desc: '斜向跃起，枪刃在前突刺；跃起中再按技能键，旋转着向下劈斩落地。空中和上旋踢中都能用。', pow: lv => skillDmg(8.0, 0.8, lv), ai: { kind: 'gap', r: [40, 220], dy: 26 },
  act: (lv) => ({ name: 'g_bloodspike', clip: 'rushBlade', dur: 0.8, noCounter: true, superArmor: [0, 0.4], follow: () => bloodSpikeDown(lv), followWin: [0.15, 0.8],
    onStart: e => { e.vz = e.z > 2 ? 200 : 420; e.z = Math.max(e.z, 1); e.vx = e.face * 380; sfx.jump(); },
    hits: [HB(0, 0.5, [0, 70, 30, 0, 110], skillDmg(3.0, 0.3, lv), { stun: 0.4, launch: 380, knock: 60, hs: 0.06, snd: 'stab', col: '#ff6a7a' })],
    update: e => { if (Math.floor(e.actT / 0.05) !== e.act.ai && e.actT < 0.4) { e.act.ai = Math.floor(e.actT / 0.05); fxAfterimage(e, '#ff6a7a'); } },
    onLand: e => { if (e.actT > 0.1) { e.vx *= 0.3; e.endAct(); } } }) });
function bloodSpikeDown(lv) {
  return { name: 'g_bloodspike2', clip: 'airBlade', dur: 1.2, noCounter: true, superArmor: true,
    onStart: e => { e.vz = -900; e.vx = e.face * 120; bladeSlash(e, { a0: -2.6, a1: 1.8, r: 70, heavy: true }); },
    hits: [HB(0, 1.2, [-20, 70, 30, -60, 60], skillDmg(1.0, 0.1, lv), { rep: 0.08, max: 4, stun: 0.4, knock: 20, spike: 300, hs: 0.04, snd: 'slash', col: '#ff6a7a' })],
    onLand: e => { if (e.act.landed) return; e.act.landed = true; e.vx = 0; e.act.dur = e.actT + 0.3; cam.shake = 6; sfx.boom(0.8); fxDust(e.x, e.y, 10, 26); fxShock(e.x, e.y, 150, '#ff5a6a');
      blast(e, e.x + e.face * 20, e.y, 110, { dmg: skillDmg(4.0, 0.4, lv), launch: 420, knock: 140, hs: 0.1, downHit: true, col: '#ff6a7a', onHit: (a, t) => rangerBleed(a, t) }, { zMax: 120 }); } };
}
defSkill('g_suppress', { name: '压制射击', cls: 'gun', job: 'ranger', tier: 1, lvReq: 25, mp: 80, cd: 30, type: 'phys', col: '#d86a2a',
  desc: '向前方疯狂乱射。连按 X 或技能键加快，按 C 中断。全程霸体。', pow: lv => skillDmg(12, 1.2, lv), ai: { kind: 'burst', r: [0, 380], dy: 40 },
  act: (lv) => ({ name: 'g_suppress', clip: 'gunDance', dur: 2.2, noCounter: true, superArmor: true,
    onInput: (e, I) => { const a = e.act; if (I.buffered('attack') || (a.key && I.buffered(a.key))) { I.consume('attack'); if (a.key) I.consume(a.key); a.fast = Math.min(0.5, (a.fast || 0) + 0.05); } if (I.buffered('jump')) { I.consume('jump'); a.dur = Math.min(a.dur, e.actT + 0.05); } return false; },
    update: e => { const a = e.act, n = Math.floor(e.actT / (0.06 * (1 - (a.fast || 0))));
      if (n !== a.n && e.actT > 0.15 && e.actT < a.dur - 0.1) { a.n = n; fireBullet(e, { up: n % 5 === 1, low: n % 5 === 3, dmg: skillDmg(0.36, 0.036, lv) * shotDmgOf(e), lift: 160, knock: 30, life: 0.5, vol: 0.45, quiet: n % 2 === 1 }); } } }) });
/* ---- 二次觉醒：绯红玫瑰（官方 75~85 级 → 本作 26~27 级）---- */
defSkill('g_bladeup', { name: '枪刃改良', cls: 'gun', job: 'ranger', tier: 2, lvReq: 26, sp: 30, mp: 0, cd: 0, type: 'phys', passive: true, col: '#b01a3a',
  desc: '【二觉被动】普通攻击和技能的攻击力提高，出血持续更久、伤害更高。', infoExtra: lv => [['攻击力', '+' + pct(0.02 * lv)], ['出血', '+' + pct(0.03 * lv)]] });
defSkill('g_deathchain', { name: '死亡锁链', cls: 'gun', job: 'ranger', tier: 2, lvReq: 26, mp: 90, cd: 40, type: 'phys', col: '#8a1a2a', superArmor: true,
  desc: '向前掷出锁链枪刃，最多钉住 6 个敌人 5 秒。钉住期间再按技能键：朝被钉住的敌人快速连开 5 枪，再补一发终结射击。', pow: lv => skillDmg(16, 1.6, lv), ai: { kind: 'burst', r: [0, 420], dy: 40 },
  recast: { ok: p => !!p._dchain && game.t - p._dchain.t < 5, act: (lv, p) => deathChainFire(lv, p), cd: 0.3, mp: 0 },
  act: (lv) => ({ name: 'g_deathchain', clip: 'chainSnatch', dur: 0.7, noCounter: true, superArmor: true,
    events: [evAt(0.18, e => { sfx.swing(true); const L = ents.filter(t => hittable(e, t) && (t.x - e.x) * e.face > 0 && Math.abs(t.x - e.x) < 440 && Math.abs(t.y - e.y) < 50).sort((a, b) => Math.abs(a.x - e.x) - Math.abs(b.x - e.x)).slice(0, 6);
      e._dchain = { t: game.t, list: L };
      for (const t of L) { chainLine(e, t.x, t.z + 50, 0.6, '#ff8a9a'); applyHit(e, t, { dmg: skillDmg(3.0, 0.3, lv), stun: 0.5, knock: 0, hs: 0.05, snd: 'stab', col: '#ff8a9a', sure: true }, { proj: true });
        if (!t.dead) addStatus(t, STATUS_NAME.root ? 'root' : 'stun', 5, { src: e }); } })] }) });   // 定身 root（不能动也不能出招；领主会自动变成减速）
function deathChainFire(lv, p) {
  const L = (p._dchain && p._dchain.list) || []; p._dchain = null;
  return { name: 'g_deathchain2', clip: 'headShot', dur: 0.9, noCounter: true, superArmor: true,
    update: e => { const a = e.act, n = Math.floor((e.actT - 0.05) / 0.1);
      if (e.actT > 0.05 && n !== a.n && n < 6) { a.n = n; muzzle(e); sfx.gun(n === 5 ? 1.8 : 1); e.play('headShot', true);
        for (const t of L) if (hittable(e, t)) { if (n === 5 && t.status) { delete t.status.root; delete t.status.stun; }   // 终结射击前先解开定身（定身中的目标不会被击飞）
          applyHit(e, t, { dmg: skillDmg(n === 5 ? 5 : 1.4, n === 5 ? 0.5 : 0.14, lv) * shotDmgOf(e), stun: 0.3, knock: n === 5 ? 240 : 0, down: n === 5, hs: 0.04, critBonus: 0.2, snd: 'stab', col: '#ffe0a0', sure: true }, { proj: true }); } } } };
}
defSkill('g_chaincut', { name: '锁链切割', cls: 'gun', job: 'ranger', tier: 2, lvReq: 26, mp: 90, cd: 45, type: 'phys', col: '#a01a2a',
  desc: '连着锁链大幅挥两次枪刃，把前方的敌人拉到身前，再斩一刀。', pow: lv => skillDmg(15, 1.5, lv), ai: { kind: 'aoe', r: [0, 260], dy: 50 },
  act: (lv) => ({ name: 'g_chaincut', clip: 'carnival', dur: 1.0, noCounter: true, superArmor: true,
    events: [0.12, 0.36].map((t, i) => evAt(t, e => { e.play(i ? 'carnival2' : 'carnival', true); bladeSlash(e, { a0: i ? 1.4 : -2.6, a1: i ? -2.6 : 1.4, r: 110, w: 20, off: [40, 70], heavy: true }); chainLine(e, e.x + e.face * 260, 60, 0.25);
      instantHit(e, { box: [0, 280, 60, 0, 140], dmg: skillDmg(4.0, 0.4, lv), stun: 0.6, knock: 200, pull: true, hs: 0.07, snd: 'slash', col: '#ff6a7a', onHit: (a, t) => rangerBleed(a, t, 1.5) }); })).concat([
      evAt(0.7, e => { bladeSlash(e, { a0: -2.8, a1: 1.3, r: 80, w: 22, heavy: true }); cam.shake = 7; sfx.boom(0.7);
        instantHit(e, { box: [0, 120, 44, 0, 140], dmg: skillDmg(7.0, 0.7, lv), launch: 460, knock: 120, hs: 0.1, big: 1.6, snd: 'slash', col: '#ff6a7a', onHit: (a, t) => rangerBleed(a, t, 2) }); })]) }) });
defSkill('g_awaken2', { name: '血舞祭', cls: 'gun', job: 'ranger', tier: 2, lvReq: 27, maxLv: 3, mp: 200, cd: 90, pvp: 0.45, type: 'phys', awaken: true, col: '#d0103a',
  desc: '【二次觉醒】向四周撒出大量枪刃并向前突进，把大范围的敌人聚到一起，最后一发强力射击收尾。全程无敌，全部附加出血。', pow: lv => skillDmg(30, 8, lv), ai: { kind: 'awaken', r: [0, 360], dy: 90 },
  act: (lv) => ({ name: 'g_awaken2', clip: 'bloodDance', dur: 3.0, superArmor: true, noCounter: true, invul: true,
    onStart: e => { game.cutin = { t: 0, dur: 1.0, name: '血舞祭', who: cutinWho(e, 2) }; game.timeStop = 0.9; sfx.awaken(); },
    update: e => { const a = e.act, cx = e.x + e.face * 180;
      if (e.actT > 0.3 && e.actT < 1.7 && Math.floor(e.actT / 0.12) !== a.k) { a.k = Math.floor(e.actT / 0.12); bladeSlash(e, { a0: a.k * 1.3, a1: a.k * 1.3 + 2.4, r: 120, w: 12, off: [0, 60], silent: a.k % 3 !== 0 }); bladeShards(e.x, e.y, 60, 3);
        for (const t of ents) if (hittable(e, t) && Math.abs(t.x - cx) < 420 && Math.abs(t.y - e.y) < 110 && !(t.boss && hasSA(t))) { t.x = damp(t.x, cx, 3, 0.12); t.y = damp(t.y, e.y, 3, 0.12); }
        instantHit(e, { box: [-200, 480, 110, 0, 170], dmg: skillDmg(1.0, 0.3, lv), stun: 0.4, knock: 0, airLift: 90, hs: 0.02, sure: true, downHit: true, snd: 'slash', col: '#ff5a6a', onHit: (a2, t) => rangerBleed(a2, t, 1.5) }); }
      if (e.actT > 1.2 && e.actT < 1.6) { e.vx = e.face * 300; if (Math.floor(e.actT / 0.05) !== a.ai) { a.ai = Math.floor(e.actT / 0.05); fxAfterimage(e, '#ff6a8a'); } } else e.vx = 0;
      if (!a.fin && e.actT > 2.1) { a.fin = true; e.play('headShot', true); preciseShot(e, 0, { len: 700, col: '#ff5a7a' }); cam.shake = 12; cam.flash = 0.2; cam.flashCol = '#ffb0c0'; sfx.boom(1.3);
        for (const t of ents) if (hittable(e, t) && (t.x - e.x) * e.face > -60 && Math.abs(t.x - e.x) < 520 && Math.abs(t.y - e.y) < 110) { applyHit(e, t, { dmg: skillDmg(12, 3.4, lv), down: true, knock: 260, hs: 0.15, big: 2, sure: true, downHit: true, col: '#ff8aa0' }, { proj: true }); rangerBleed(e, t, 3); } } } }) });
/* ---- 三次觉醒：重霄·漫游枪手（官方 95~100 级 → 本作 29~30 级）---- */
defSkill('g_chainwill', { name: '锁链意志', cls: 'gun', job: 'ranger', tier: 3, lvReq: 29, sp: 40, mp: 0, cd: 0, type: 'phys', passive: true, col: '#c03a5a',
  desc: '【三觉被动】普通攻击和转职技能的攻击力提高，花式枪术的柔化次数 +1。', infoExtra: lv => [['攻击力', '+' + pct(0.03 * lv)], ['柔化次数', '+1']] });
defSkill('g_ruin', { name: '毁灭风暴', cls: 'gun', job: 'ranger', tier: 3, lvReq: 29, mp: 120, cd: 60, type: 'phys', col: '#e0304a',
  desc: '挥着连着锁链的枪刃大范围快斩 4 次，第 5 斩带一发终结射击，碎裂的锁链再伤害周围的敌人。连按技能键斩得更快。全程霸体。', pow: lv => skillDmg(26, 2.6, lv), ai: { kind: 'aoe', r: [0, 300], dy: 70 },
  act: (lv) => ({ name: 'g_ruin', clip: 'carnival', dur: 1.8, noCounter: true, superArmor: true,
    onInput: (e, I) => { const a = e.act; if (a.key && I.buffered(a.key)) { I.consume(a.key); a.fast = Math.min(0.35, (a.fast || 0) + 0.07); } return false; },
    update: e => { const a = e.act, step = 0.26 * (1 - (a.fast || 0)), n = Math.floor((e.actT - 0.1) / step);
      if (e.actT > 0.1 && n !== a.n && n < 4) { a.n = n; e.play(n % 2 ? 'carnival2' : 'carnival', true); bladeSlash(e, { a0: n % 2 ? 1.5 : -2.7, a1: n % 2 ? -2.7 : 1.5, r: 130, w: 22, off: [40, 70], heavy: true }); cam.shake = Math.max(cam.shake, 4);
        instantHit(e, { box: [-40, 300, 70, 0, 150], dmg: skillDmg(4.0, 0.4, lv), stun: 0.5, knock: 60, airLift: 120, hs: 0.06, snd: 'slash', col: '#ff6a7a', onHit: (a2, t) => rangerBleed(a2, t, 1.5) }); }
      if (n >= 4 && !a.fin) { a.fin = true; a.dur = e.actT + 0.6; e.play('headShot', true); preciseShot(e, skillDmg(6.0, 0.6, lv) * shotDmgOf(e), { len: 600 });
        game.after(0.2, () => { if (e.dead) return; fxShock(e.x + e.face * 150, e.y, 220, '#ff5a6a'); blast(e, e.x + e.face * 150, e.y, 170, { dmg: skillDmg(6.0, 0.6, lv), launch: 420, knock: 160, hs: 0.1, downHit: true, col: '#ff6a7a' }, { zMax: 160 }); }); } } }) });
defSkill('g_awaken3', { name: '盛放·绯红花园', cls: 'gun', job: 'ranger', tier: 3, lvReq: 30, maxLv: 3, mp: 300, cd: 120, pvp: 0.45, type: 'phys', awaken: true, col: '#ff1a4a',
  desc: '【三次觉醒】向四面八方掷出枪刃，用锁链织成一座绯红花园，在里面体术与射击连携攻击，最后切断所有锁链，一记终结斩击。全程无敌。', pow: lv => skillDmg(44, 12, lv), ai: { kind: 'awaken', r: [0, 420], dy: 100 },
  act: (lv) => ({ name: 'g_awaken3', clip: 'garden', dur: 4.2, superArmor: true, noCounter: true, invul: true,
    onStart: e => { game.cutin = { t: 0, dur: 1.2, name: '盛放·绯红花园', who: cutinWho(e, 3) }; game.timeStop = 1.0; sfx.awaken(); e.act.cx = e.x + e.face * 200; },
    update: e => { const a = e.act, cx = a.cx;
      if (e.actT > 0.3 && !a.gfx) { a.gfx = gardenFx(e, cx); sfx.swing(true); }
      if (e.actT > 0.9 && e.actT < 3.0 && Math.floor(e.actT / 0.1) !== a.k) { a.k = Math.floor(e.actT / 0.1); e.play(a.k % 3 === 0 ? 'headShot' : a.k % 2 ? 'carnival' : 'carnival2', true);
        if (a.k % 3 === 0) { muzzle(e); sfx.gun(0.8); } else bladeSlash(e, { a0: a.k * 1.7, a1: a.k * 1.7 + 2.2, r: 90, off: [60, 70], silent: a.k % 2 === 1 });
        for (const t of ents) if (hittable(e, t) && Math.abs(t.x - cx) < 360 && Math.abs(t.y - e.y) < 120 && !(t.boss && hasSA(t))) { t.x = damp(t.x, cx, 2, 0.1); }
        areaHit(e, cx, e.y, 320, 0, { dmg: skillDmg(1.1, 0.3, lv), stun: 0.4, knock: 0, airLift: 110, hs: 0.02, sure: true, downHit: true, snd: 'slash', col: '#ff5a6a', onHit: (a2, t) => rangerBleed(a2, t, 2) }, { zMax: 220 }); }
      if (!a.fin && e.actT > 3.2) { a.fin = true; if (a.gfx) a.gfx.cut(); e.play('carnival2', true); cam.shake = 16; cam.flash = 0.3; cam.flashCol = '#ffc0d0'; sfx.boom(1.5);
        fxSpr('petal', cx, e.y, 90, { w: 420, dur: 0.9, col: '#ff3a6a', grow: [0.3, 1.4] }); fxShock(cx, e.y, 380, '#ff3a5a');
        areaHit(e, cx, e.y, 380, 0, { dmg: skillDmg(18, 5, lv), launch: 600, knock: 200, hs: 0.16, big: 2.2, critBonus: 0.2, sure: true, downHit: true, col: '#ff8aa0', onHit: (a2, t) => rangerBleed(a2, t, 3) }, { zMax: 300 }); } } }) });
/* ---- 被动效果（每 0.25 秒刷新；hide = 不在 HUD 上显示图标）---- */
CLASSES.gun.passives.push(p => {
  const rv = skLv(p, 'g_revmaster'), rev = rv > 0 && isRevolver(p);
  setPassive(p, 'g_revmaster', rev, { crit: 0.01 * rv, aspd: 0.01 * rv, mspd: 0.01 * rv, hide: true });
  const up = skLv(p, 'g_bladeup'), cw = skLv(p, 'g_chainwill');
  setPassive(p, 'g_bladeup', up > 0 || cw > 0, { dmg: 0.02 * up + 0.03 * cw, hide: true });
  if (skLv(p, 'g_stylish')) setPassive(p, 'g_stylish', !game.pvp, { n: stylishOf(p).n }); else setPassive(p, 'g_stylish', false);
});
CLASSES.gun.jobs.ranger = { art: 'job/ranger', name: '漫游枪手', role: '远程 · 连射 / 体术', armor: 'leather', awaken: 'g_awaken', awakenName: '沾血蔷薇', awaken2: 'g_awaken2', awakenName2: '绯红玫瑰', awaken3: 'g_awaken3', awakenName3: '重霄·漫游枪手',
  desc: '左轮装上枪刃的枪手。花式枪术让技能之间自由衔接，射击与体术交替，锁链把敌人拉进枪口。',
  auto: ['g_blade'],
  skills: ['g_revmaster', 'g_blade', 'g_head', 'g_guard', 'g_stylish', 'g_quickdraw', 'g_revenge', 'g_chain', 'g_backshot', 'g_sonic', 'g_buff', 'g_rapid', 'g_moving', 'g_multi', 'g_hawk',
    'g_hidecut', 'g_awaken', 'g_bloodspike', 'g_suppress', 'g_bladeup', 'g_deathchain', 'g_chaincut', 'g_awaken2', 'g_chainwill', 'g_ruin', 'g_awaken3'] };
CLASSES.gun.cmds.push(['ff', 'g_head'], ['hit', 'g_revenge'], ['bf', 'g_chain'], ['bff', 'g_backshot'], ['ff', 'g_buff', 'buff'], ['fbf', 'g_rapid', 'attack'], ['df', 'g_moving', 'jump'], ['buf', 'g_multi'], ['bdf', 'g_hawk'],
  ['uudd', 'g_awaken'], ['fbdf', 'g_bloodspike'], ['fbuf', 'g_suppress'], ['fbf', 'g_deathchain'], ['dff', 'g_chaincut'], ['duff', 'g_awaken2'], ['udff', 'g_ruin'], ['bufd', 'g_awaken3'],
  ['', 'g_bl_dive']);   // 跳跃中 Z = 俯冲斩（双枪极舞刃）
// 跳跃中再按 C = 飞燕射击（双枪极舞刃）
CLASSES.gun.jumpLinks = { jump: 'g_bl_flip' };
