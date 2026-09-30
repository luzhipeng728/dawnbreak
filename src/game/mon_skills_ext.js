/* =====================================================================
   怪物技能库 · 第二批（领主差异化 P0，docs/BOSS_SPEC.md §1 / §3）：放在 game/mon_skills.js 后面、game/region.js 前面
   - 技能：hold 读条 | leap 跳砸 / 升空追踪落地 | cone 扇形吐息 | lanes 纵深分道奔袭 | mark 头顶标记 | plant 可破坏物件 | pool 地面残留区 | pull 吸 / 推
           dash 的变体（carry / spin / bounces / wallStun / frac）也在这里（mon_skills.js 的 dash 带这些参数时转过来）
   - 特性（MS_TRAIT_HOOKS）：hitHp saVsRanged reflectRanged rooted back onGetup grabOnly stacks substitute trail
   - 物件怪：msPlant（炸弹 / 蛋）msHeart（要保护的心脏）msCover（掩体）msDecoy（替身草人）msTotem（图腾）
   组队：技能里的随机结果（落点、哪几条纵深、标记谁、物件在哪）只在主机算，用 msNetEv(怪, null, 'hook', { h: 'msXxx', mi: 招式编号, … }) 发出去，
   队员在 MS_MIRROR.msXxx 里按同一个招式的参数重放（预警、伤害都一样，谁挨打谁结算）；确定性的部分（扇形朝向、吸推）按招式编号重播就够了
   ===================================================================== */
// 队员这边按编号找回同一招的参数
const msMiP = (m, mi) => { const A = m && m.def_ && m.def_.msAll && m.def_.msAll[mi]; return A ? A.p : null; };
const msMine = e => msFoes(e).filter(t => !t.ghost);   // 本机要结算的目标（主机：自己 + 召唤物；队员：自己）
const msActIdx = e => (e.act ? e.act.msIdx : undefined);
const msPlayers = () => ents.filter(t => t.team === 'p' && !t.dead && !t.remove && !t.summon && (t.fighter || t.ghost || t === game.player));

/* ================= 物件怪（技能 / 机制刷出来的可破坏物件）：没有动作表，程序画 ================= */
class MsObjModel {
  constructor(shape, col, h) { this.shape = shape; this.col = col; this.h = h; this.skel = { map: {} }; }
  draw(c, pose, t = 0) {
    const h = this.h, col = this.col, dk = shade(col, -0.35, 1), lt = shade(col, 0.35, 0.95);
    c.save(); c.lineWidth = 3; c.strokeStyle = '#140c18';
    if (this.shape === 'egg') {
      c.fillStyle = col; c.beginPath(); c.ellipse(0, -h * 0.45, h * 0.3, h * 0.46, 0, 0, TAU); c.fill(); c.stroke();
      c.fillStyle = lt; c.beginPath(); c.ellipse(-h * 0.1, -h * 0.62, h * 0.07, h * 0.13, -0.4, 0, TAU); c.fill();
      c.strokeStyle = dk; c.lineWidth = 2; c.beginPath(); c.moveTo(-h * 0.2, -h * 0.35); c.lineTo(-h * 0.05, -h * 0.28); c.lineTo(h * 0.08, -h * 0.4); c.lineTo(h * 0.22, -h * 0.32); c.stroke();
    } else if (this.shape === 'heart') {
      const b = Math.sin(t * 5) * 0.05 + 1; c.scale(b, b); c.fillStyle = col; c.beginPath(); c.moveTo(0, -h * 0.15); c.bezierCurveTo(h * 0.5, -h * 0.55, h * 0.25, -h * 0.95, 0, -h * 0.7); c.bezierCurveTo(-h * 0.25, -h * 0.95, -h * 0.5, -h * 0.55, 0, -h * 0.15); c.fill(); c.stroke();
      c.fillStyle = lt; c.beginPath(); c.ellipse(-h * 0.14, -h * 0.66, h * 0.06, h * 0.1, -0.5, 0, TAU); c.fill();
    } else if (this.shape === 'block') {
      c.fillStyle = dk; c.fillRect(-h * 0.4, -h * 0.7, h * 0.8, h * 0.7); c.strokeRect(-h * 0.4, -h * 0.7, h * 0.8, h * 0.7); c.fillStyle = col; c.fillRect(-h * 0.4, -h * 0.7, h * 0.8, h * 0.16);
    } else if (this.shape === 'dummy') {
      c.fillStyle = '#c8a86a'; c.fillRect(-4, -h * 0.9, 8, h * 0.9); c.fillRect(-h * 0.35, -h * 0.72, h * 0.7, 8); c.beginPath(); c.arc(0, -h * 0.9, h * 0.16, 0, TAU); c.fill(); c.stroke();
      c.fillStyle = col; c.fillRect(-h * 0.2, -h * 0.66, h * 0.4, h * 0.34);
    } else if (this.shape === 'totem' || this.shape === 'pillar') {
      c.fillStyle = dk; c.fillRect(-h * 0.14, -h, h * 0.28, h); c.strokeRect(-h * 0.14, -h, h * 0.28, h);
      c.fillStyle = col; for (let i = 0; i < 3; i++) c.fillRect(-h * 0.14, -h * (0.9 - i * 0.3), h * 0.28, h * 0.08);
      c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.3 + 0.2 * Math.sin(t * 4); c.fillStyle = col; c.beginPath(); c.arc(0, -h * 0.85, h * 0.18, 0, TAU); c.fill();
    } else {   // bomb
      c.fillStyle = dk; c.beginPath(); c.arc(0, -h * 0.4, h * 0.38, 0, TAU); c.fill(); c.stroke(); c.fillStyle = col; c.fillRect(-3, -h * 0.9, 6, h * 0.14);
      c.globalCompositeOperation = 'lighter'; c.fillStyle = Math.floor(t * 6) % 2 ? '#fff4a0' : col; c.beginPath(); c.arc(0, -h * 0.94, 5, 0, TAU); c.fill();
    }
    c.restore();
  }
}
// 物件怪的定义：region spec 的怪物写 obj: { shape, col, h } 也走这里（game/region.js）
function msObjDef(name, o = {}) {
  const h = o.h || 60;
  return { name, lvl: 30, hp: 1000, atk: 1, def: 200, w: o.w || 16, d: 12, h, weight: 99, speed: 0, exp: 0, gold: [0, 0], shadowR: o.w || 16, pref: 0, clips: BEAST_CLIPS, noGrab: true, attacks: [], msObj: true, customModel: true,
    botSkip: !!o.botSkip, model: () => new MsObjModel(o.shape || 'bomb', o.col || '#ffb070', h), onSpawn: msOnSpawn, onDamaged: msOnDamaged, msTraits: o.traits || {} };
}
Object.assign(MON, {
  msPlant: msObjDef('定时炸弹', { shape: 'bomb', col: '#ff8a4a', h: 56 }),
  msHeart: msObjDef('心脏', { shape: 'heart', col: '#ff6a8a', h: 70, botSkip: true }),
  msCover: msObjDef('掩体', { shape: 'block', col: '#8a8a9a', h: 90, w: 30, botSkip: true }),
  msDecoy: msObjDef('替身草人', { shape: 'dummy', col: '#6a4a3a', h: 90 }),
  msTotem: msObjDef('图腾', { shape: 'totem', col: '#8ad8ff', h: 110 }),
});

/* ================= hold 读条 / 蓄力（stagger 机制用；也能单独写成一招“站着蓄力”） ================= */
defineMonSkill('hold', { clip: 'charge', sa: true, desc: '读条 / 蓄力', defaults: { dur: 2, col: '#ffb030' }, range: [0, 900], dy: 900, cd: [20, 30],
  act: p => ({ dur: p.dur, noCounter: true, update: e => { e.vx = e.vy = 0; if (Math.random() < 0.35) fxCharge(e, p.col); } }) });

/* ================= leap 跳砸 / 升空追踪落地 ================= */
// crouch 下蹲 → up 秒升空（不可选中）→ 地面圈跟着目标 track 秒 → 锁定 → fall 秒落下 → 圆形（或 ring: [r0, r1] 双环：内圈安全）冲击；jump = 跳起来能躲；n = 连跳几次
defineMonSkill('leap', { clip: 'pounce', sa: true, desc: '跳砸 / 升空追踪落地', defaults: { crouch: 0.35, up: 0.5, track: 1.2, fall: 0.7, r: 110, ring: null, dmg: 1.6, jump: false, hover: 520, down: true, n: 1, col: '#ff8a4a', knock: 240 },
  range: [0, 800], dy: 800, cd: [10, 13],
  act: p => {
    const T0 = p.crouch, T1 = T0 + p.up, T2 = T1 + p.track, T3 = T2 + p.fall;
    return { dur: T3 + 0.45,
      onStart: e => { e.msLeapI = msActIdx(e); if (!e.puppet) { const tg = game.player; msLeapTrack(e, p, tg); msNetEv(e, null, 'hook', { h: 'msLeap', mi: e.msLeapI, s: 't', tgE: tg }); } },
      update: (e, dt) => {
        const t = e.actT; e.vx = e.vy = 0; if (t < T0) return;
        if (t < T3) e.invul = Math.max(e.invul, 0.08);
        if (e.puppet) return;
        if (t < T1) { e.z = p.hover * easeOut((t - T0) / p.up); e.vz = 0; }
        else if (t < T2) { e.z = p.hover; e.vz = 0; }
        else if (t < T3) { const L = e.msLeap; if (L && !L.locked) msLeapLock(e, p); const k = (t - T2) / p.fall; e.z = p.hover * (1 - k * k); e.vz = 0; }
      },
      events: [evAt(T0, e => { sfx.swing(true); fxDust(e.x, e.y, 10, 30); }), evAt(T3, e => { e.z = 0; e.vz = 0; })],
      onEnd: (e, broke) => { if (!e.puppet && e.z > 0) e.vz = -200; const L = e.msLeap; e.msLeap = null; if (broke && L && L.g && !L.locked) killTele(L.g);
        if (!broke && !e.dead && !e.puppet && (e.msLeapN = (e.msLeapN || 0) + 1) < p.n) (e.msQueue ??= []).push(e.def_.msAll[e.msLeapI]); else e.msLeapN = 0; } };
  } });
// 地面圈：跟着目标（每个客户端跟自己这边的那个实体），锁定后停住；落地由预警的 fire 结算（两边各判自己）
function msLeapTrack(e, p, tg) {
  const T = p.crouch + p.up + p.track + p.fall, R = p.ring ? p.ring[1] : p.r;
  const g = telegraph({ x: tg ? tg.x : e.x, y: tg ? tg.y : e.y, r: R, dur: T, col: p.col, fire: g => msLeapImpact(e, p, g) });
  e.msLeap = { g, locked: false, tg };
  if (p.ring) g.draw = (c, g) => { const X = sx(g.x), Y = sy(g.y, 0); c.save(); c.globalAlpha = 0.8; c.strokeStyle = '#ffffff'; c.lineWidth = 2; c.setLineDash([6, 5]); c.beginPath(); c.ellipse(X, Y, p.ring[0], p.ring[0] * GR, 0, 0, TAU); c.stroke(); c.restore(); };
  msTicker(dt => { const L = e.msLeap; if (!L || L.g !== g || L.locked || !tg || tg.dead || !groundFx.includes(g)) return true; g.x = damp(g.x, tg.x, 4, dt); g.y = damp(g.y, tg.y, 4, dt); return false; });
  msSay(e, p.say || '', msCol(p));
}
function msLeapLock(e, p, x, y) {
  const L = e.msLeap; if (!L || L.locked) return; L.locked = true;
  if (x !== undefined) { L.g.x = x; L.g.y = y; }
  if (!e.puppet) { e.x = L.g.x; e.y = L.g.y; msNetEv(e, null, 'hook', { h: 'msLeap', mi: e.msLeapI, s: 'l', x: Math.round(L.g.x), y: Math.round(L.g.y) }); }
  sfx.charge();
}
function msLeapImpact(e, p, g) {
  if (e.dead) return; cam.shake = Math.max(cam.shake, 9); sfx.boom(1.1); fxShock(g.x, g.y, (p.ring ? p.ring[1] : p.r) * 1.1, msCol(p)); fxDust(g.x, g.y, 16, 60);
  if (p.ring) msArea(e, g.x, g.y, p.ring[1], p, p.ring[0]); else msArea(e, g.x, g.y, p.r, p);
}
MS_MIRROR.msLeap = (m, d) => {
  const p = msMiP(m, d.mi); if (!p) return;
  if (d.s === 't') { m.msLeapI = d.mi; msLeapTrack(m, p, d.tgE); return; }
  if (d.s === 'l') { if (!m.msLeap) msLeapTrack(m, { ...p, crouch: 0, up: 0, track: 0 }, null); msLeapLock(m, p, d.x, d.y); }
};

/* ================= cone 扇形吐息 / 喷射 ================= */
// windup 秒扇形预警（朝向在出手那一刻定死）→ dur 秒持续喷射，每 tick 秒结算一次（异常状态每个目标只上一次）；sweep = 每秒转多少度（从一侧扫到另一侧）
defineMonSkill('cone', { clip: 'cast', sa: true, desc: '扇形吐息 / 喷射', defaults: { ang: 70, len: 260, dur: 1.2, tick: 0.2, windup: 0.9, dmg: 0.35, sweep: 0, jump: false, col: '#bfe6ff', knock: 40, stun: 0.25 },
  range: p => [0, p.len * 0.8], dy: p => Math.max(24, p.len * Math.sin(p.ang * D2R / 2) * GR * 0.8), cd: [7, 9],
  act: p => ({ dur: p.windup + p.dur + 0.3,
    onStart: e => { const C = e.msCone = { x: e.x, y: e.y, face: e.face, tick: 0, got: new Set(), on: false }; C.g = telegraph({ x: e.x, y: e.y, r: 0, R: p.len, kind: 'cone', dur: p.windup, col: msCol(p), draw: (c, g) => msConeDraw(c, C, p, g.t / g.dur, false) }); },
    update: (e, dt) => {
      const C = e.msCone; e.vx = e.vy = 0; if (!C || e.actT < p.windup || e.actT > p.windup + p.dur) return;
      if (!C.on) { C.on = true; sfx.boom(0.6); cam.shake = Math.max(cam.shake, 4); C.fx = addFx({ x: C.x, y: C.y + 1, z: 0, dur: p.dur, add: true, draw(c) { msConeDraw(c, C, p, this.t / this.dur, true); } }); }
      C.tick -= dt; if (C.tick > 0) return; C.tick = p.tick;
      const a0 = msConeAng(C, p, e.actT - p.windup);
      for (const t of msFoes(e)) {
        if (t.invul > 0 || t.st === 'down' || t.z >= (p.jump ? 12 : 60) || !msInCone(C, a0, p, t)) continue;
        const first = !C.got.has(t); C.got.add(t);
        applyHit(e, t, { ...msHit({ ...p, status: first ? p.status : null }, { stun: p.stun, knock: p.knock, hs: 0.03, snd: 'fire' }), box: null }, { proj: true, src: { x: C.x, y: t.y, z: 0, face: C.face } });
      }
    },
    onEnd: e => { const C = e.msCone; if (C) { if (C.g) killTele(C.g); if (C.fx) C.fx.t = 1e9; } e.msCone = null; } }) });
const msConeAng = (C, p, t) => (p.sweep ? (-p.sweep * p.dur / 2 + p.sweep * clamp(t, 0, p.dur)) * D2R : 0);
function msInCone(C, a0, p, t) {
  const u = (t.x - C.x) * C.face, v = (t.y - C.y) / GR, d = Math.hypot(u, v); if (d > p.len + t.w) return false; if (d < t.w + 10) return true;
  let a = Math.atan2(v, u) - a0; while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return Math.abs(a) <= p.ang * D2R / 2 + Math.atan2(t.w, d);
}
function msConeDraw(c, C, p, k, live) {
  const X = sx(C.x), Y = sy(C.y, 0), a0 = msConeAng(C, p, live ? k * p.dur : 0), h = p.ang * D2R / 2, col = msCol(p), blink = Math.floor((live ? k * 10 : k * (6 + k * 14))) % 2;
  c.save(); c.translate(X, Y); c.scale(C.face, GR);
  c.globalAlpha = 0.55; c.strokeStyle = '#0a1830'; c.lineWidth = 5; c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, p.len, a0 - h, a0 + h); c.closePath(); c.stroke();   // 深色描边：亮色地图（雪地）上也看得清
  c.globalCompositeOperation = 'lighter';
  c.globalAlpha = live ? 0.3 + 0.15 * blink : 0.12 + 0.2 * k + 0.12 * blink; c.fillStyle = col;
  c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, p.len, a0 - h, a0 + h); c.closePath(); c.fill();
  c.globalAlpha = live ? 0.8 : 0.6; c.strokeStyle = col; c.lineWidth = 2.5; c.stroke();
  if (!live) { c.globalAlpha = 0.35; c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, p.len * k, a0 - h, a0 + h); c.closePath(); c.fill(); }
  c.restore();
  if (!live) return;
  const img = fxTint('flame', col); if (!img) return;
  for (let i = 0; i < 9; i++) { const f = ((game.t * 2.2 + i / 9) % 1), a = a0 + (Math.sin(i * 7.3) * 0.8) * h, r = p.len * f; drawSpr(c, img, X + Math.cos(a) * r * C.face, Y + Math.sin(a) * r * GR - 30, 40 + 70 * f, 0, { alpha: (1 - f) * 0.9, rot: a * C.face }); }
}

/* ================= lanes 纵深分道奔袭 / 齐射 ================= */
// 把纵深分成 lanes 条，挑 hit 条（至少留一条安全）先出横贯全场的预警，windup 秒后从一侧扫过去：
// kind = bolt 整条落雷（同时）| wave 地波 | runner 奔袭的影子（runner = 怪物 id，借它的精灵）| shot 一排弹幕；n 波、每波间隔 gap；jump = 跳起来能躲
defineMonSkill('lanes', { clip: 'roar', sa: true, desc: '纵深分道奔袭 / 齐射', defaults: { lanes: 4, hit: 3, kind: 'wave', runner: null, speed: 560, windup: 1.0, from: 'side', dmg: 1.3, n: 1, gap: 1.3, jump: false, down: true, col: '#ffe070', knock: 200 },
  range: [0, 1400], dy: 900, cd: [11, 15],
  act: p => ({ dur: 1.1, events: [evAt(0.3, e => { if (e.puppet) return; const d = msLanesPlan(e, p); msLanesRun(e, p, d); msNetEv(e, null, 'hook', { h: 'msLanes', mi: msActIdx(e), ...d }); })] }) });
function msLanesPlan(e, p) {
  const n = p.lanes, hit = clamp(p.hit, 1, n - 1), L = [], S = [], pl = game.player;
  for (let v = 0; v < p.n; v++) {
    const idx = Array.from({ length: n }, (_, i) => i).sort(() => Math.random() - 0.5).slice(0, hit).sort((a, b) => a - b); L.push(idx);
    S.push(p.from === 'left' ? 1 : p.from === 'right' ? -1 : p.from === 'boss' ? (pl && pl.x < e.x ? -1 : 1) : Math.random() < 0.5 ? 1 : -1);
  }
  return { l: L, s: S };
}
function msLanesRun(e, p, d) {
  const W = msRoomW(), n = p.lanes, bw = DEPTH / n, col = msCol(p);
  (d.l || []).forEach((idx, v) => game.after(v * p.gap, () => {
    if (e.dead) return;
    const dir = d.s[v] || 1, x0 = dir > 0 ? 10 : W - 10;
    for (const i of idx) {
      const y = bw * (i + 0.5);
      telegraph({ x: dir > 0 ? 20 : W - 20, y, kind: 'line', len: dir * (W - 40), face: 1, hw: bw / 2 - 2, dur: p.windup, col, fire: () => msLaneSweep(e, p, y, bw / 2, dir, x0) });   // 箭头指向扫过来的方向
    }
  }));
}
function msLaneSweep(e, p, y, hw, dir, x0) {
  if (e.dead) return;
  const W = msRoomW(), col = msCol(p), got = new Set(), md = p.kind === 'runner' && p.runner && MON_ART[p.runner] ? msArtModel(MON_ART[p.runner]) : null;
  const hitIn = (xa, xb) => { for (const t of msFoes(e)) { if (got.has(t) || t.invul > 0 || t.st === 'down' || t.z >= (p.jump ? 12 : 60) || Math.abs(t.y - y) > hw + 2) continue; if (t.x + t.w < Math.min(xa, xb) || t.x - t.w > Math.max(xa, xb)) continue; got.add(t); applyHit(e, t, { ...msHit(p), box: null }, { proj: true, src: { x: t.x - dir * 10, y: t.y, z: 0, face: dir } }); } };
  if (p.kind === 'bolt') { hitIn(0, W); for (let x = 60; x < W; x += 140) lightningStrike({ x: x + rnd(-30, 30), y }); cam.shake = Math.max(cam.shake, 5); return; }
  sfx.swing(true);
  const T = (W + 40) / p.speed, S = { t: 0, x: x0 };
  msTicker(dt => { S.t += dt; const nx = x0 + dir * p.speed * Math.min(S.t, T); hitIn(S.x, nx); S.x = nx; return S.t >= T || e.dead; });
  addFx({ x: x0, y: y + 1, z: 0, dur: T, update() { this.x = S.x; },
    draw(c) { const X = sx(S.x), Y = sy(y, 0);
      if (md) { c.save(); c.translate(X, Y); c.scale(dir * 1.1, 1.1); c.globalAlpha = 0.85; md.draw(c, { __c: 'run', __t: this.t, __n: 'run', __f: dir }, game.t); c.restore(); fxAfterimageAt(c, X, Y, dir, col); return; }
      if (p.kind === 'shot') { const img = fxTint('orb', col); drawSpr(c, img, X, Y - 40, 34, 34, {}); return; }
      const img = fxTint('wave', col) || fxTint('shock', col); drawSpr(c, img, X, Y - 26, 90, 60, { flip: dir < 0, alpha: 0.9 }); } });
}
function fxAfterimageAt(c, X, Y, dir, col) { c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.25; c.fillStyle = col; c.beginPath(); c.ellipse(X - dir * 40, Y - 40, 60, 26, 0, 0, TAU); c.fill(); c.restore(); }
MS_MIRROR.msLanes = (m, d) => { const p = msMiP(m, d.mi); if (p) msLanesRun(m, p, d); };

/* ================= mark 头顶标记延迟结算 ================= */
// 给目标头顶挂一个倒数（delay 秒），然后按 mode 结算：burst 以他为中心爆炸（别靠近队友）| share 半径 r 内的人平摊伤害（聚在一起）
// | move 之后 dur 秒必须一直移动，站着不动就掉血 | cover 躲到掩体（cover 物件）后面，否则挨狙；dmg 走伤害公式，frac 按最大 HP 真实伤害；n = 标几个人
defineMonSkill('mark', { clip: 'cast', sa: true, desc: '头顶标记延迟结算', defaults: { delay: 1.5, r: 120, mode: 'burst', dmg: 1.6, frac: 0, jump: false, n: 1, dur: 3, tick: 0.5, still: 16, col: '#ff5a8a', cover: 'msCover', down: true },
  range: [0, 1400], dy: 900, cd: [12, 16],
  act: p => ({ dur: 0.9, events: [evAt(0.3, e => {
    if (e.puppet) return;
    const L = msPlayers(), tg = [game.player, ...L.filter(t => t !== game.player).sort(() => Math.random() - 0.5)].filter(Boolean).slice(0, p.n);
    for (const t of tg) { msMarkRun(e, p, t); msNetEv(e, null, 'hook', { h: 'msMark', mi: msActIdx(e), tgE: t }); }
  })] }) });
function msMarkRun(e, p, tg) {
  if (!tg) return; const col = msCol(p), K = msPunishK();
  const txt = { burst: '标记：离队友远一点！', share: '标记：和队友站在一起分摊！', move: '标记：不要停下！', cover: '被瞄准了：躲到掩体后面！' }[p.mode];
  if (tg === msSelf()) toastMsg(p.say || txt, col);
  addFx({ x: tg.x, y: tg.y + 3, z: 0, dur: p.delay + (p.mode === 'move' ? p.dur : 0), update() { this.x = tg.x; this.y = tg.y + 3; },
    draw(c) { const X = sx(tg.x), Y = sy(tg.y, tg.z + tg.h + 34), left = p.delay - this.t;
      c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.6 + 0.3 * Math.sin(game.t * 12); c.strokeStyle = col; c.lineWidth = 3; c.beginPath(); c.arc(X, Y, 15, 0, TAU); c.stroke(); c.restore();
      uiTextWorld(c, left > 0 ? left.toFixed(1) : p.mode === 'move' ? '动！' : '!', X, Y + 10, col); } });
  if (p.mode === 'burst' || p.mode === 'share') {
    const g = telegraph({ x: tg.x, y: tg.y, r: p.r, dur: p.delay, col, fire: g => {
      if (e.dead) return; fxShock(g.x, g.y, p.r * 1.1, col); sfx.boom(0.8); cam.shake = Math.max(cam.shake, 6);
      const share = p.mode === 'share' ? Math.max(1, msPlayers().filter(t => inGround(t, g.x, g.y, p.r)).length) : 1;
      if (share > 1) fxText(`分摊 ×${share}`, g.x, g.y, 90, { col, size: 16 });
      for (const t of msMine(e)) { if (t.invul > 0 || !inGround(t, g.x, g.y, p.r) || (p.jump && t.z >= 12)) continue; if (p.frac) msTrueHit(e, t, p.frac * K / share); else applyHit(e, t, { ...msHit({ ...p, dmg: p.dmg * K / share }), box: null }, { proj: true, src: { x: g.x, y: g.y, z: 0, face: e.face } }); }
    } });
    msTicker(() => { if (!groundFx.includes(g) || tg.dead) return true; g.x = tg.x; g.y = tg.y; return false; });
    return;
  }
  if (p.mode === 'move') {
    let lx = tg.x, ly = tg.y, tk = p.tick, t = 0;
    msTicker(dt => { t += dt; if (t > p.delay + p.dur) return true; if (t < p.delay || tg !== msSelf() || tg.dead) { lx = tg.x; ly = tg.y; return false; } tk -= dt; if (tk > 0) return false; tk = p.tick;
      const moved = Math.hypot(tg.x - lx, tg.y - ly); lx = tg.x; ly = tg.y; if (moved < p.still * p.tick * 2) { const s0 = msNetSrc; msNetSrc = msNetSrc || 'mark'; try { msTrueHit(e, tg, (p.frac || 0.03) * K); } finally { msNetSrc = s0; } fxText('别停下！', tg.x, tg.y, tg.z + 70, { col, size: 12 }); } return false; });
    return;
  }
  if (p.mode === 'cover') {
    game.after(p.delay, () => {
      if (e.dead) return; const E = msLive(e); addFx({ x: E.x, y: E.y + 1, z: 0, dur: 0.25, add: true, draw(c) { c.save(); c.globalCompositeOperation = 'lighter'; c.strokeStyle = col; c.lineWidth = 4; c.beginPath(); c.moveTo(sx(E.x), sy(E.y, 60)); c.lineTo(sx(tg.x), sy(tg.y, 50)); c.stroke(); c.restore(); } });
      sfx.boom(0.6); if (tg !== msSelf() || tg.dead || tg.invul > 0) return;
      const safe = ents.some(o => !o.dead && !o.remove && (o.kind === p.cover || (o.def_ && o.def_.msCover)) && Math.abs(o.y - tg.y) < 30 && (o.x - E.x) * (o.x - tg.x) < 0);
      if (safe) { fxText('躲过了狙击', tg.x, tg.y, tg.z + 60, { col: '#e8f4ff', size: 12 }); msLog('solve', e, { id: 'mark' }); return; }
      if (p.frac) msTrueHit(e, tg, p.frac * K); else applyHit(e, tg, { ...msHit({ ...p, dmg: p.dmg * K }), box: null }, { proj: true, src: { x: tg.x - Math.sign(tg.x - E.x) * 10, y: tg.y, z: 0, face: Math.sign(tg.x - E.x) || 1 } });
      msLog('fail', e, { id: 'mark' });
    });
  }
}
MS_MIRROR.msMark = (m, d) => { const p = msMiP(m, d.mi); if (p) msMarkRun(m, p, d.tgE); };

/* ================= plant 可破坏物件（蛋 / 图腾 / 炸弹 / 柱子 / 投石车） ================= */
// 刷 n 个物件 kind（at: target 目标脚下 | self 领主身边 | spots 全场均匀 | random）；头顶引信 fuse 秒，打掉就没事，到点 onFuse：
// explode 原地爆炸（r / dmg）| hatch:<怪物> 孵化 | heal 领主回 heal×HP | buff 领主狂暴 | release:<怪物>xN 放出 N 只；
// hp = 领主最大 HP 的比例，hits = 固定打几下；root = 目标被定住直到物件被打掉 / 引信到点；operator = 旁边刷一个操作员，操作员死了物件跟着坏
defineMonSkill('plant', { clip: 'cast', sa: true, desc: '可破坏物件（蛋 / 图腾 / 炸弹）', defaults: { kind: 'msPlant', n: 1, at: 'target', fuse: 6, hp: 0.01, hits: 0, onFuse: 'explode', r: 110, dmg: 1.6, root: false, operator: null, spread: 160, col: '#ffb070', max: 6, heal: 0.05, down: true },
  range: [0, 1400], dy: 900, cd: [16, 22], cond: p => () => skyAlive(p.kind) < p.max,
  act: p => ({ dur: 1.0, events: [evAt(0.45, e => { if (!e.puppet) msPlantRun(e, p, msActIdx(e)); })] }) });
function msPlantRun(e, p, mi) {
  const W = msRoomW(), pl = game.player, L = [];
  for (let i = 0; i < p.n; i++) {
    let x, y;
    if (p.at === 'self') { x = e.x + (i % 2 ? 1 : -1) * (60 + i * 40); y = e.y + rnd(-40, 40); }
    else if (p.at === 'spots') { x = W * (0.15 + 0.7 * (p.n > 1 ? i / (p.n - 1) : 0.5)); y = i % 2 ? DEPTH * 0.3 : DEPTH * 0.7; }
    else if (p.at === 'random') { x = rnd(80, W - 80); y = rnd(20, DEPTH - 20); }
    else { x = (pl ? pl.x : e.x) + (i ? rnd(-p.spread, p.spread) : 0); y = (pl ? pl.y : e.y) + (i ? rnd(-40, 40) : 0); }
    const o = spawnMonster(p.kind, clamp(x, 60, W - 60), clamp(y, 12, DEPTH - 12), { lvl: e.lvl - 1, drop: true, ...skyMul() });
    if (p.hits) { o.hp = o.hpMax = p.hits; msMulSet(o, 'hitHp', 1e-9); } else if (p.hp) o.hp = o.hpMax = Math.max(1, Math.round(e.hpMax * p.hp));
    o.noLoot = true; o.msPlantBy = e;
    if (p.operator) { const op = spawnMonster(p.operator, clamp(o.x + 60, 60, W - 60), o.y, { lvl: e.lvl - 1, drop: true, ...skyMul() }); o.msOperator = op; }
    L.push(o);
  }
  const root = p.root && p.at === 'target' ? pl : null;
  msPlantFx(e, p, L, root);
  msNetEv(e, null, 'hook', { h: 'msPlant', mi, o: L.map(o => o.nid || 0), tgE: root || undefined });
  for (const o of L) msTicker(dt => {
    o.msFuseT += dt;
    if (o.dead || o.remove) { msPlantDone(e, o, root, false); return true; }
    if (o.msOperator && o.msOperator.dead) { o.hp = 0; killEnt(o, e, {}); return false; }
    if (o.msFuseT >= p.fuse) { msPlantFuse(e, p, o, mi); msPlantDone(e, o, root, true); return true; }
    return false; });
}
function msPlantFx(e, p, L, root) {
  for (const o of L) { o.msFuseT = 0; msHeadBar(o, () => 1 - o.msFuseT / p.fuse, p.col, p.label || '', () => !o.dead && !o.remove && o.msFuseT < p.fuse); }   // 引信：主机的计时器推进 msFuseT；队员这边的头顶条本地走
  if (root && root === msSelf()) { addStatus(root, 'root', p.fuse, { src: e, force: true }); toastMsg('被定住了——打掉身边的物件！', p.col); }
  if (p.say) msSay(e, p.say, p.col, 14);
}
function msPlantDone(e, o, root, fused) {
  if (o.msPlantDone) return; o.msPlantDone = true;
  if (!fused) { MS_STATS.mech.plantBroken = (MS_STATS.mech.plantBroken || 0) + 1; msLog('solve', e, { id: 'plant' }); }
  if (root) { if (root === msSelf() && root.status) delete root.status.root; msNetEv(e, null, 'hook', { h: 'msUnroot', tgE: root }); }
}
function msPlantFuse(e, p, o, mi) {
  MS_STATS.mech.plantFuse = (MS_STATS.mech.plantFuse || 0) + 1; msLog('fail', e, { id: 'plant', why: p.onFuse });
  const [act, arg] = String(p.onFuse).split(':'), x = Math.round(o.x), y = Math.round(o.y);
  if (act === 'explode') { msPlantBoom(e, p, x, y); msNetEv(e, null, 'hook', { h: 'msFuse', mi, x, y }); }
  else if (act === 'hatch' || act === 'release') { const [k, nn] = (arg || '').split('x'); for (let i = 0; i < (+nn || 1); i++) if (MON[k]) spawnMonster(k, clamp(x + i * 30, 60, msRoomW() - 60), y, { lvl: e.lvl - 1, drop: true, ...skyMul() }); fxBurst(x, y, 40, 160, p.col); }
  else if (act === 'heal' && !e.dead) { const h = Math.round(e.hpMax * p.heal); e.hp = Math.min(e.hpMax, e.hp + h); addNumber(h, e.x, e.y, e.z + 40, { heal: true }); msSay(e, '回复了体力', '#9affc0'); }
  else if (act === 'buff' && !e.dead) msBuff(e, { kind: 'enrage', target: 'self', dur: 10, amt: 0.3 });
  o.noLoot = true; o.hp = 0; killEnt(o, e, {});
}
const msPlantBoom = (e, p, x, y) => msExplodeAt(e, x, y, { r: p.r, windup: 0.6, dmg: p.dmg, elem: p.elem, col: p.col, punish: true, down: true }, null);
MS_MIRROR.msPlant = (m, d) => { const p = msMiP(m, d.mi); if (!p) return; const L = (d.o || []).map(id => msNetEnt(id)).filter(Boolean); msPlantFx(m, p, L, d.tgE || null); for (const o of L) msTicker(dt => { if (o.dead || o.remove || o.msFuseT >= p.fuse) return true; o.msFuseT += dt; return false; }); };
MS_MIRROR.msFuse = (m, d) => { const p = msMiP(m, d.mi); if (p) msPlantBoom(m, p, d.x, d.y); };
MS_MIRROR.msUnroot = (m, d) => { const t = d.tgE; if (t && t === msSelf() && t.status) delete t.status.root; };

/* ================= pool 地面残留区（毒 / 油 / 冰 / 减速 / 失明 / 火） ================= */
// 落点预警 windup 秒 → 落地（dmg > 0 时有一下冲击）→ 地上留 linger 秒的区域；站在里面每 tick 秒按 zone 生效（各自判定自己）：
// poison 中毒 | oil 减速、会被火点燃连环爆炸 | ice 减速 | slow 减速 | blind 失明 | fire 灼烧 + frac 真实伤害
// trail: true = 这招变成“接下来 dur 秒走过的地方留下区域”（每 every 秒一块）；特性 traits.trail 是一直留
const MS_POOL_COL = { poison: '#b05aff', oil: '#3a3028', ice: '#bfe6ff', slow: '#6ab0ff', blind: '#2a1a3a', fire: '#ff6a2a' };
const MS_POOLS = [];
defineMonSkill('pool', { clip: 'cast', sa: true, desc: '地面残留区', defaults: { at: 'target', n: 1, r: 70, windup: 0.9, linger: 6, zone: 'poison', dmg: 0, tick: 0.5, frac: 0.02, scatter: 120, trail: false, dur: 6, every: 0.45, boom: 1.4 },
  range: [0, 800], dy: 800, cd: [9, 12],
  act: p => p.trail
    ? { dur: 0.6, onStart: e => { if (!e.puppet) msTrailStart(e, p, msActIdx(e)); } }
    : { dur: 0.4 + Math.min(p.windup, 0.8), events: [evAt(0.15, e => { if (e.puppet) return; const pl = game.player, ax = p.at === 'self' ? e.x : p.at === 'front' ? e.x + e.face * p.r : pl ? pl.x : e.x, ay = p.at === 'target' && pl ? pl.y : e.y, L = [];
        for (let i = 0; i < p.n; i++) L.push([Math.round(clamp(ax + (i ? rnd(-p.scatter, p.scatter) : 0), 30, msRoomW() - 30)), Math.round(clamp(ay + (i ? rnd(-50, 50) : 0), 8, DEPTH - 8))]);
        msPoolDrop(e, p, L); msNetEv(e, null, 'hook', { h: 'msPool', mi: msActIdx(e), l: L }); })] } });
function msPoolDrop(e, p, L, now) {
  const col = p.col || MS_POOL_COL[p.zone] || '#b05aff';
  for (const [x, y] of L) {
    if (now) { msPoolAt(e, x, y, p); continue; }
    telegraph({ x, y, r: p.r, dur: p.windup, col, fire: g => { if (e.dead) return; fxBurst(g.x, g.y, 20, 100, col); sfx.boom(0.4); if (p.dmg) msArea(e, g.x, g.y, p.r, { ...p, elem: p.zone === 'fire' ? 'fire' : p.elem }); msPoolAt(e, g.x, g.y, p); } });
  }
}
function msPoolAt(e, x, y, p) {
  const col = p.col || MS_POOL_COL[p.zone] || '#b05aff', P = { x, y, r: p.r, zone: p.zone, owner: e, p, t0: game.t, lit: false };
  MS_POOLS.push(P);
  P.g = msGround((c, g) => { const k = (game.t - P.t0) / p.linger, X = sx(P.x), Y = sy(P.y, 0), a = k > 0.85 ? (1 - k) / 0.15 : 1;
    c.save(); c.globalAlpha = 0.45 * a; c.fillStyle = col; c.beginPath(); c.ellipse(X, Y, P.r, P.r * GR, 0, 0, TAU); c.fill(); c.globalAlpha = 0.7 * a; c.strokeStyle = shade(col, 0.3, 1); c.lineWidth = 2; c.stroke();
    if (P.zone === 'oil') { c.globalAlpha = 0.25 * a; c.fillStyle = '#c8b070'; c.beginPath(); c.ellipse(X - P.r * 0.2, Y - 2, P.r * 0.35, P.r * 0.1, 0, 0, TAU); c.fill(); } c.restore(); },
    { dur: p.linger, fire: () => msPoolOff(P) });
  let tk = 0;
  msTicker(dt => { if (P.lit || !groundFx.includes(P.g)) { if (!P.lit) msPoolOff(P); return true; } tk -= dt; if (tk > 0) return false; tk = p.tick; msPoolTick(P); return false; });
  return P;
}
function msPoolOff(P) { const i = MS_POOLS.indexOf(P); if (i >= 0) MS_POOLS.splice(i, 1); msGroundOff(P.g); }
function msPoolTick(P) {
  const t = msSelf(), p = P.p; if (!t || t.dead || t.invul > 0 || t.z > 20 || !inGround(t, P.x, P.y, P.r - t.w)) return;
  const s0 = msNetSrc; msNetSrc = msNetSrc || 'pool:' + P.zone;
  try {
    if (P.zone === 'poison') addStatus(t, 'poison', 2, { src: P.owner, dps: P.owner.atk * 0.06 });
    else if (P.zone === 'oil' || P.zone === 'ice' || P.zone === 'slow') addStatus(t, 'slow', 1, { src: P.owner });
    else if (P.zone === 'blind') addStatus(t, 'blind', 1.2, { src: P.owner });
    else if (P.zone === 'fire') { addStatus(t, 'burn', 1.5, { src: P.owner, dps: P.owner.atk * 0.06 }); msTrueHit(P.owner, t, p.frac * msPunishK()); }
  } finally { msNetSrc = s0; }
}
// 火落在油上：这块油和挨着的油依次爆炸（每一块隔 0.25 秒，先闪一下）
function msPoolIgnite(e, x, y, r) {
  for (const P of MS_POOLS.slice()) {
    if (P.zone !== 'oil' || P.lit || Math.hypot(P.x - x, (P.y - y) / GR) > r + P.r) continue;
    P.lit = true; msGroundOff(P.g);
    telegraph({ x: P.x, y: P.y, r: P.r * 1.2, dur: 0.25, col: '#ff7a2a', fire: g => { msPoolOff(P); meteorImpact(g, 0.5); msArea(P.owner, g.x, g.y, g.r, { dmg: P.p.boom, elem: 'fire', down: true, status: 'burn', knock: 180 }); } });
    MS_STATS.mech.poolIgnite = (MS_STATS.mech.poolIgnite || 0) + 1;
  }
}
function msTrailStart(e, p, mi) {
  let lx = e.x, ly = e.y, tk = 0;
  msSay(e, p.say || '', p.col || MS_POOL_COL[p.zone]);
  let t = 0;
  msTicker(dt => { t += dt; if (e.dead || t > p.dur) return true; tk -= dt; if (tk > 0) return false; tk = p.every; if (Math.hypot(e.x - lx, e.y - ly) < 20) return false; lx = e.x; ly = e.y; const L = [[Math.round(e.x), Math.round(e.y)]]; msPoolDrop(e, p, L, true); msNetEv(e, null, 'hook', { h: 'msPool', mi, l: L, now: 1 }); return false; });
}
MS_MIRROR.msPool = (m, d) => { const p = d.tr ? { ...MS_TRAIL_DEF, ...m.def_.msTraits.trail } : msMiP(m, d.mi); if (p) msPoolDrop(m, p, d.l || [], !!d.now); };

/* ================= pull 吸 / 推 ================= */
// windup 秒预警（圈 r）→ 一下爆发（status 异常 + dmg，可选）→ dur 秒持续把圈里的人吸向 / 推离领主（mode in / out）或吸向最近的 to 物件（mode toward，或写 'toward:<怪物>'）
defineMonSkill('pull', { clip: 'roar', sa: true, desc: '吸 / 推', defaults: { mode: 'in', to: null, r: 400, force: 260, dur: 1.5, windup: 0.9, status: null, sdur: 1, dmg: 0, col: '#bfe6ff' },
  range: p => [0, p.r * 0.8], dy: p => p.r * GR, cd: [10, 14],
  act: p => { const [mode, to] = String(p.mode).split(':');
    return { dur: p.windup + p.dur + 0.2,
      onStart: e => { e.msPull = { hit: false, x: e.x, y: e.y }; telegraph({ x: e.x, y: e.y, r: 0, R: p.r, kind: 'pull', dur: p.windup, col: msCol(p), draw: (c, g) => msPullDraw(c, e.msPull || g, p, mode, g.t / g.dur) }); },
      update: (e, dt) => {
        const S = e.msPull; e.vx = e.vy = 0; if (!S || e.actT < p.windup) return;
        if (!S.hit) { S.hit = true; sfx.boom(0.8); cam.shake = Math.max(cam.shake, 6); fxShock(S.x, S.y, p.r, msCol(p)); S.fx = addFx({ x: S.x, y: S.y + 1, z: 0, dur: p.dur, add: true, draw(c) { msPullDraw(c, S, p, mode, 0, this.t); } });
          for (const t of msMine(e)) { if (t.invul > 0 || !inGround(t, S.x, S.y, p.r)) continue; if (p.status) addStatus(t, p.status, p.sdur, { src: e }); if (p.dmg) applyHit(e, t, { ...msHit(p, { knock: 0, stun: 0.2 }), box: null }, { proj: true }); } }
        const T = mode === 'toward' ? ents.filter(o => !o.dead && !o.remove && o.kind === (to || p.to)).sort((a, b) => Math.abs(a.x - S.x) - Math.abs(b.x - S.x))[0] : null, cx = T ? T.x : S.x, cy = T ? T.y : S.y;
        for (const t of msMine(e)) {
          if (t.st === 'held' || t.invul > 5 || !inGround(t, S.x, S.y, p.r)) continue;
          const dx = cx - t.x, dy = cy - t.y, d = Math.hypot(dx, dy) || 1, s = (mode === 'out' ? -1 : 1) * p.force * dt;
          if (mode !== 'out' && d < 24) continue;
          t.x = clamp(t.x + dx / d * s, 20, msRoomW() - 20); t.y = clamp(t.y + dy / d * s * 0.6, 4, DEPTH - 4);
        }
      },
      onEnd: e => { if (e.msPull && e.msPull.fx) e.msPull.fx.t = 1e9; e.msPull = null; } }; } });
function msPullDraw(c, S, p, mode, k, live) {
  const X = sx(S.x), Y = sy(S.y, 0), col = msCol(p);
  c.save(); c.globalAlpha = 0.5; c.strokeStyle = '#0a1830'; c.lineWidth = 5; c.beginPath(); c.ellipse(X, Y, p.r, p.r * GR, 0, 0, TAU); c.stroke();
  c.globalCompositeOperation = 'lighter'; c.strokeStyle = col; c.lineWidth = 2.5;
  if (live === undefined) { c.globalAlpha = 0.3 + 0.5 * k; c.beginPath(); c.ellipse(X, Y, p.r, p.r * GR, 0, 0, TAU); c.stroke(); c.globalAlpha = 0.12; c.fillStyle = col; c.beginPath(); c.ellipse(X, Y, p.r * k, p.r * k * GR, 0, 0, TAU); c.fill(); c.restore(); return; }
  for (let i = 0; i < 4; i++) { const f = ((live * 1.6 + i / 4) % 1), r = p.r * (mode === 'out' ? f : 1 - f); c.globalAlpha = 0.5 * (1 - Math.abs(f - 0.5) * 2); c.beginPath(); c.ellipse(X, Y, r, r * GR, 0, 0, TAU); c.stroke(); }
  c.restore();
}

/* ================= dash 的变体（mon_skills.js 的 dash 带 carry / spin / bounces / wallStun / frac 时用这个） ================= */
// carry 顶着第一个撞到的人一路推到墙边，撞墙连打 3 下再扔出去 | spin 旋转着冲（多段）| bounces:n 撞墙反弹 n 次（整条纵深都是危险区）
// | wallStun 撞到墙自己晕 wallStun 秒（反击窗口）| frac 撞中按最大 HP 结算（frac × 难度系数）
function msDashPlus(p) {
  const hitBase = p.frac ? { dmg: 0.01, onHit: (a, t) => { if (t.ghost || t.dead) return; const d = Math.max(1, Math.round(t.hpMax * p.frac * msPunishK())); t.hp -= d; addNumber(d, t.x, t.y, t.z + 20, { player: t.team === 'p' }); } } : {};   // 被击次数 applyHit 已经记过（0.01 那一下）
  const hit = { t0: p.windup, t1: 99, box: p.spin ? [-54, 54, p.hw + 2, 0, 110] : [-6, 50, p.hw + 2, 0, 110], ...msHit(p, { stun: 0.5, hs: 0.08, snd: 'slash', shake: 4 }), ...hitBase };
  if (p.carry) Object.assign(hit, { grab: true, grabMaxW: 9, dmg: (p.dmg ?? 1.2) * 0.4, stun: 0.2, knock: 0 });
  if (p.spin) Object.assign(hit, { rep: 0.16, max: 8, dmg: (p.frac ? 0.01 : (p.dmg ?? 1.2) * 0.3), knock: 60, stun: 0.3 });
  if (p.bounces && !p.spin) Object.assign(hit, { rep: 0.35, max: p.bounces + 1 });
  return { dur: 9, hits: [hit],
    onStart: e => {
      const pl = game.player; if (pl) e.face = pl.x >= e.x ? 1 : -1;
      const W = msRoomW(), segs = []; let x = e.x, dir = e.face, T = p.windup;
      for (let i = 0; i <= (p.bounces || 0); i++) {
        const wall = dir > 0 ? W - 30 - e.w : 30 + e.w, toWall = p.bounces || p.wallStun || p.carry || i > 0, x1 = toWall ? wall : clamp(x + dir * p.len, 30 + e.w, W - 30 - e.w), t = Math.abs(x1 - x) / p.speed;
        segs.push({ t0: T, t1: T + t, dir, wall: Math.abs(x1 - wall) < 2 }); T += t; x = x1; dir = -dir;
      }
      e.msDash = { segs, T1: T, go: false, spinT: 0 }; e.act.dur = T + (p.carry ? 0.9 : 0.45); e.act.hits[0].t1 = T;
      const len0 = segs.length > 1 ? (e.face > 0 ? W - 30 - e.x : e.x - 30) : Math.abs(segs[0].t1 - segs[0].t0) * p.speed;
      e.msDash.g = telegraph({ x: segs.length > 1 ? 20 : e.x, y: e.y, kind: 'line', len: segs.length > 1 ? W - 40 : len0 * e.face, face: 1, hw: p.hw, dur: segs.length > 1 ? T : p.windup, col: msCol(p) });
    },
    update: (e, dt) => {
      const D = e.msDash; if (!D) return; const t = e.actT;
      if (t < p.windup) { e.vx = 0; return; }
      const S = D.segs.find(s => t >= s.t0 && t < s.t1);
      if (!S) { e.vx = 0; return; }
      if (!D.go) { D.go = true; e.play('charge', true); sfx.swing(true); }
      if (S.dir !== e.face) { e.face = S.dir; fxShock(e.x, e.y, 60, msCol(p)); sfx.boom(0.4); }
      e.vx = S.dir * p.speed; if (Math.random() < 0.5) fxDust(e.x - e.face * 18, e.y, 1, 6);
      if (p.spin && (D.spinT -= dt) <= 0) { D.spinT = 0.09; e.drawFlip = !e.drawFlip; fxAfterimage(e, msCol(p)); }
    },
    onEnd: (e, broke) => {
      const D = e.msDash; e.vx = 0; e.drawFlip = false; e.msDash = null; if (D && D.g) killTele(D.g);
      if (broke || !D || e.dead) { if (e.grabbed) dropGrab(e); return; }
      const last = D.segs[D.segs.length - 1];
      if (p.carry && e.grabbed) { const t = e.grabbed; for (let i = 0; i < 3; i++) game.after(0.12 * i, () => { if (!t.dead && t.heldBy === e) { applyHit(e, t, { dmg: (p.dmg ?? 1.2) * 0.35, sure: true, stun: 0.2, knock: 0, hs: 0.06, snd: 'blunt', shake: 5 }, { proj: true }); fxShock(t.x, t.y, 50, msCol(p)); } }); game.after(0.4, () => { if (e.grabbed === t) throwGrab(e, { dmg: p.dmg ?? 1.2, launch: 300, knock: 260, down: true, snd: 'blunt', shake: 6 }); }); }
      if (p.wallStun && last.wall) { cam.shake = Math.max(cam.shake, 8); sfx.boom(0.9); fxText('撞墙了！', e.x, e.y, e.z + e.h * (e.scale || 1) + 10, { col: '#ffd23a', size: 18, dur: 1.2 }); if (!e.puppet) addStatus(e, 'stun', p.wallStun, { force: true }); MS_STATS.mech.wallStun = (MS_STATS.mech.wallStun || 0) + 1; }
    } };
}

/* ================= 特性（MS_TRAIT_HOOKS，game/mon_skills.js 在出场 / 受伤 / 每帧 / 起身时调用） ================= */
const msRanged = h => !(h.box || h.mel) && !h.grab && !h.grb;
const msAuth = m => !m.puppet;   // 只在主机（单机）上改怪物状态；队员那边的傀儡只做表现
// hitHp: n —— 固定 n 下打碎（每下伤害恒为 1）
MS_TRAIT_HOOKS.hitHp = {
  spawn(m, n) { m.hp = m.hpMax = +n || 6; msMulSet(m, 'hitHp', 1e-9); },
  puppet(m, n) { msMulSet(m, 'hitHp', 1e-9); } };
// saVsRanged: 秒 —— 被远程打中自动霸体（逼玩家贴身打）
MS_TRAIT_HOOKS.saVsRanged = { damaged(m, c, a, dmg, crit, h) { if (!msRanged(h)) return; m.superArmor = Math.max(m.superArmor || 0, typeof c === 'number' ? c : 1.2); if (!(m.msSaTxt > game.t)) { m.msSaTxt = game.t + 2; fxText('远程霸体', m.x, m.y, m.z + m.h * (m.scale || 1), { col: '#ff8a6a', size: 12 }); } } };
// reflectRanged: { on: 3, off: 6, k: 0.3, mul: 0.3, col } —— 周期性张开反射罩：罩子亮着时远程攻击被反弹（打的人挨 k × 伤害，最多 6% 最大 HP），自己只受 mul 倍伤害
const MS_REFL_DEF = { on: 3, off: 6, k: 0.3, mul: 0.3, col: '#ffe070' };
MS_TRAIT_HOOKS.reflectRanged = {
  spawn(m) { m.msReflT = 2; },
  update(m, c, dt) { if (!msAuth(m)) return; const C = { ...MS_REFL_DEF, ...(typeof c === 'object' ? c : {}) }; if ((m.msReflT -= dt) > 0) return; const on = !m.msReflOn; m.msReflT = on ? C.on : C.off; msReflSet(m, on, C); msNetEv(m, null, 'hook', { h: 'msRefl', on: on ? 1 : 0 }); },
  damaged(m, c, a, dmg, crit, h) { if (!m.msReflOn || !msRanged(h)) return; msReflectHit(m, a, dmg, h, { k: ({ ...MS_REFL_DEF, ...(typeof c === 'object' ? c : {}) }).k, col: '#ffe070', type: 'all' }); } };
function msReflSet(m, on, C) {
  m.msReflOn = on; msMulSet(m, 'reflect', on ? C.mul : null);
  if (!on) return; msSay(m, '反射罩！远程无效', C.col, 13);
  addFx({ x: m.x, y: m.y + 0.5, z: 0, dur: C.on, update() { const E = msLive(m); this.x = E.x; this.y = E.y + 0.5; if (!E.msReflOn || E.dead) this.t = this.dur; },
    draw(c) { const E = msLive(m); if (!msShown(E)) return; const H = E.h * (E.scale || 1), X = sx(E.x), Y = sy(E.y, E.z); c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.35 + 0.15 * Math.sin(game.t * 9); c.strokeStyle = C.col; c.lineWidth = 3; c.setLineDash([10, 6]); c.beginPath(); c.ellipse(X, Y - H * 0.5, H * 0.55, H * 0.7, 0, 0, TAU); c.stroke(); c.restore(); } });
}
MS_MIRROR.msRefl = (m, d) => { const C = { ...MS_REFL_DEF, ...(typeof m.def_.msTraits.reflectRanged === 'object' ? m.def_.msTraits.reflectRanged : {}) }; msReflSet(m, !!d.on, C); };
// 反伤（reflectRanged、stance 的 reflect: 'phys' | 'magic' | 'ranged' | 'melee' | 'all'）：只打本机的攻击者（队友的攻击由队友那边结算）
function msReflectHit(m, a, dmg, h, R) {
  if (!a || a.ghost || a.dead || a.team !== 'p' || a.summon || !(a === msSelf() || a === game.player)) return;
  const type = (h && h.type) || (a.act && a.act.type) || a.dmgType || 'phys', ranged = msRanged(h || {});
  const ok = R.type === 'all' || R.type === type || (R.type === 'ranged' && ranged) || (R.type === 'melee' && !ranged); if (!ok) return;
  const frac = Math.min(0.06, dmg * (R.k ?? 0.3) / a.hpMax); if (frac <= 0) return;
  if (!(m.msReflFx > game.t)) { m.msReflFx = game.t + 0.5; fxText('反弹！', a.x, a.y, a.z + 70, { col: R.col || '#ffe070', size: 13 }); }
  msTrueHit(m, a, frac);
}
// rooted: true —— 固定不动（不走、不被击退）
MS_TRAIT_HOOKS.rooted = { spawn(m) { m.msRooted = true; m.weight = Math.max(m.weight || 1, 30); } };
// back: 'interrupt' | { interrupt: true, stun: 1.5, do: 技能 spec, cd: 6 } —— 被背后打中：打断正在放的霸体大招（反击窗口）/ 立刻放一招（背击喷毒雾）
MS_TRAIT_HOOKS.back = {
  precompile(D, c) { if (c && c.do) msNestA(D, c, '_A', c.do); },
  damaged(m, c, a, dmg, crit, h) {
    if (!msAuth(m) || !a || m.dead || Math.sign(a.x - m.x || 1) === m.face || (m.msBackT > game.t)) return;
    const C = typeof c === 'object' ? c : { interrupt: c === 'interrupt' || c === true };
    m.msBackT = game.t + (C.cd ?? 6);
    if (C.interrupt !== false && (C.interrupt || !C.do) && m.act && m.act.superArmor && !m.act.msHold) { msBreakStun(m, C.stun ?? 1.5); fxText('背击打断！', m.x, m.y, m.z + m.h * (m.scale || 1) + 30, { col: '#ffd23a', size: 16 }); MS_STATS.mech.backBreak = (MS_STATS.mech.backBreak || 0) + 1; msLog('solve', m, { id: 'back' }); }
    if (C._A) { (m.msQueue ??= []).unshift(C._A); MS_STATS.mech.backDo = (MS_STATS.mech.backDo || 0) + 1; }
  } };
// onGetup: 技能 spec | { do: 技能 spec, cd } —— 倒地起身时立刻反击（起身冲击波 / 龙之吼）
MS_TRAIT_HOOKS.onGetup = {
  precompile(D, c) { const S = c && c.use ? c : c && c.do; if (S) msNestA(D, c, '_A', S); },
  getup(m, c) { if (!msAuth(m) || !c || !c._A || (m.msGetupCd > game.t)) return; m.msGetupCd = game.t + (c.cd ?? 4); (m.msQueue ??= []).unshift(c._A); m.invul = Math.max(m.invul, 0.4); MS_STATS.mech.onGetup = (MS_STATS.mech.onGetup || 0) + 1; } };
// grabOnly: true —— 一直霸体，只有抓取技能能打出硬直（抓中后 1.2 秒内可以正常打出硬直）
MS_TRAIT_HOOKS.grabOnly = {
  update(m) { if (!(m.msGrabOpen > game.t)) m.superArmor = Math.max(m.superArmor || 0, 0.25); },
  damaged(m, c, a, dmg, crit, h) { if (!(h.grab || h.grb)) return; m.superArmor = 0; m.msGrabOpen = game.t + 1.2; if (m.act && !m.act.msHold) m.interrupt(); fxText('破霸体！', m.x, m.y, m.z + m.h * (m.scale || 1), { col: '#ffd23a', size: 15 }); MS_STATS.mech.grabBreak = (MS_STATS.mech.grabBreak || 0) + 1; } };
// stacks: { n: 6, dur: 8, target: 'attacker' | 'self', r: 110, frac: 0.12, do: 技能 spec } —— 受击叠层：
//   attacker（默认）= 打它的人头上叠炸弹，满 n 层在他脚下爆（各自判定自己）；self = 自己叠层，满了放出 do（默认身边一圈冲击）
MS_TRAIT_HOOKS.stacks = {
  precompile(D, c) { if (c && typeof c === 'object' && c.target === 'self') msNestA(D, c, '_A', c.do || { use: 'aoe', shape: 'circle', at: 'self', r: c.r || 140, windup: 0.8, dmg: 1.6, punish: true }); },
  damaged(m, c, a, dmg, crit, h) {
    const C = { n: 6, dur: 8, target: 'attacker', r: 110, frac: 0.12, col: '#ff7a3a', ...(typeof c === 'object' ? c : { n: +c || 6 }) };
    if (C.target === 'self') { if (!msAuth(m)) return; if (game.t - (m.msStkT || 0) > C.dur) m.msStk = 0; m.msStkT = game.t; m.msStk = (m.msStk || 0) + 1; if (m.msStk >= C.n) { m.msStk = 0; if (c._A) (m.msQueue ??= []).unshift(c._A); msLog('fail', m, { id: 'stacks' }); } return; }
    if (!a || a.ghost || a.team !== 'p' || a.summon || a !== msSelf()) return;
    const S = a.msStk && game.t - a.msStk.t < C.dur ? a.msStk : (a.msStk = { n: 0, t: game.t, fx: null }); S.n++; S.t = game.t;
    if (!S.fx || S.fx.t >= S.fx.dur) S.fx = addFx({ x: a.x, y: a.y + 3, z: 0, dur: 1e9, update() { this.x = a.x; this.y = a.y + 3; if (!a.msStk || a.msStk !== S || game.t - S.t > C.dur || a.dead) this.t = this.dur; }, draw(c2) { const X = sx(a.x), Y = sy(a.y, a.z + a.h + 30); uiTextWorld2(c2, `炸弹 ${S.n}/${C.n}`, X, Y, C.col); } });
    if (S.n < C.n) return;
    a.msStk = null; toastMsg('炸弹满了——要爆炸了！', C.col);
    telegraph({ x: a.x, y: a.y, r: C.r, dur: 0.9, col: C.col, follow: a, fire: g => { meteorImpact(g, 0.6); if (inGround(a, g.x, g.y, C.r) && a.z < 30) msTrueHit(m, a, C.frac * msPunishK()); } });
    msLog('fail', m, { id: 'stacks' });
  } };
// substitute: { cd: 12, heavy: 0.02, kind: 'msDecoy', to: 'away', summon: { kind, n } } —— 挨重击（单下 ≥ heavy×最大 HP，或被打浮空 / 倒地）时原地留下替身、自己闪走（可顺便召唤）
MS_TRAIT_HOOKS.substitute = {
  damaged(m, c, a, dmg, crit, h) {
    if (!msAuth(m) || m.dead) return; const C = { cd: 12, heavy: 0.02, kind: 'msDecoy', to: 'away', ...(typeof c === 'object' ? c : {}) };
    if ((m.msSubT > game.t) || !(dmg >= m.hpMax * C.heavy || h.launch || h.down)) return;
    m.msSubT = game.t + C.cd;
    const A = [Math.round(m.x), Math.round(m.y)], o = spawnMonster(C.kind, m.x, m.y, { lvl: m.lvl, ...skyMul() }); o.hp = o.hpMax = Math.max(1, Math.round(m.hpMax * 0.004)); o.noLoot = true; o.face = m.face;
    if (m.act) m.endAct(); m.superArmor = Math.max(m.superArmor || 0, 0.5); m.stun = 0; m.setState('idle'); m.z = 0; m.vz = 0;
    msBlink(m, { to: C.to, dist: 160, col: '#c8a86a' });
    if (C.summon) msSummon(m, C.summon.kind, C.summon.n || 2);
    msSubFx(A, [Math.round(m.x), Math.round(m.y)]); msNetEv(m, null, 'hook', { h: 'msSub', a: A, b: [Math.round(m.x), Math.round(m.y)] });
    MS_STATS.mech.substitute = (MS_STATS.mech.substitute || 0) + 1;
  } };
function msSubFx(A, B) { fxBurst(A[0], A[1], 60, 160, '#c8a86a'); fxText('替身术！', A[0], A[1], 120, { col: '#ffe0a0', size: 16 }); fxBurst(B[0], B[1], 60, 140, '#c8a86a'); sfx.swing(false); }
MS_MIRROR.msSub = (m, d) => msSubFx(d.a, d.b);
// trail: { zone: 'oil', every: 0.6, r: 36, linger: 8 } —— 一直在走过的地方留下区域（纵火犯滴汽油）
const MS_TRAIL_DEF = { zone: 'oil', every: 0.6, r: 36, linger: 8, tick: 0.5, frac: 0.02, boom: 1.4, dmg: 0 };
MS_TRAIT_HOOKS.trail = {
  update(m, c, dt) {
    if (!msAuth(m) || m.dead) return; const C = { ...MS_TRAIL_DEF, ...(typeof c === 'object' ? c : {}) };
    if ((m.msTrailT = (m.msTrailT ?? C.every) - dt) > 0) return; m.msTrailT = C.every;
    if (m.msTrailX !== undefined && Math.hypot(m.x - m.msTrailX, m.y - m.msTrailY) < 24) return; m.msTrailX = m.x; m.msTrailY = m.y;
    const L = [[Math.round(m.x), Math.round(m.y)]]; msPoolDrop(m, C, L, true); msNetEv(m, null, 'hook', { h: 'msPool', tr: 1, l: L, now: 1 });
  } };
// 定义时预编译特性里的招式（region.js / defineBossKit 调用）
function msTraitPrecompile(D) { const T = D.msTraits || {}; for (const k in T) { const H = MS_TRAIT_HOOKS[k]; if (H && H.precompile && T[k] && typeof T[k] === 'object') H.precompile(D, T[k]); } }
