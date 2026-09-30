/* =====================================================================
   万年雪山 · 领主的自定义钩子（机制库覆盖不到的部分；其余全部在 snow.js 的数据里，规划见 docs/BOSS_PLAN.md §2 万年雪山）
   - 冰雪女王洛丝的壁钟（REGION_HOOKS.roseClock，官方 HK61「洛丝的壁钟」）：左墙上的壁钟每隔十几秒敲响，2.6 秒后一道寒潮从壁钟那边横扫宫殿——
       只有躲到王座后面（王座右边）的人没事，其余的挨 22% 最大 HP 的真实伤害并被冻住（普通难度打折）。
       组队：主机敲钟时发 hook 事件，队员这边同样出预警、到点只判定自己；平时的倒数本地走（HUD）
   - 洛丝走下王座（最后一个阶段）：不再固定不动（形态机制 form 在 snow.js，这里只解开 rooted）
   ===================================================================== */
REGION_HOOKS.roseClock = {
  sig: ['洛丝的壁钟（钟响时躲到王座后）'],
  onSpawn(m) { m.clock = { next: 12, warn: 0, tx: Math.round(m.x) }; snClockProp(m); },
  update(m, dt) {   // 领主没在出手（test/boss.mjs 安抚着它逐招测、车轮战观战）时壁钟不走
    const C = m.clock; if (!C || m.msHidden || m.msIdle || m.aiCd > 20) return; if (C.warn > 0) { C.warn -= dt; return; } C.next -= dt; if (C.next <= 0) snClockStart(m); },
  onPhase(m, i) { if (i === m.def_.msPhases.length - 1) m.msRooted = false; },
  hud(c, m, x, y) { const C = m.clock; if (!C) return; uiText(C.warn > 0 ? '钟响了——躲到王座后面！' : `壁钟 ${Math.ceil(C.next)}s`, x + 790, y + 14, { size: 15, align: 'right', color: C.warn > 0 ? '#bfe6ff' : '#c8d8e8', sw: 3 }); },
  mirror: {
    clock(m, d) { const C = m.clock ??= { next: 0, warn: 0, tx: d.tx }; C.tx = d.tx; C.warn = d.w; C.next = d.n; snClockRun(m, C); },
    tick(m, dt) { const C = m.clock; if (!C) return; if (C.warn > 0) C.warn = Math.max(0, C.warn - dt); else C.next = Math.max(0, C.next - dt); } },
};
function snClockStart(m) {
  const C = m.clock; C.warn = 2.6; C.next = m.msPhase >= 2 ? 16 : 20;
  MS_STATS.mech.roseClock = (MS_STATS.mech.roseClock || 0) + 1;
  snClockRun(m, C);
  msNetEv(m, null, 'hook', { h: 'clock', w: C.warn, n: C.next, tx: C.tx });
}
// 预警：从左墙到王座前面、整条纵深闪烁（安全的只有王座后面那一段，画一条白色虚线）；地面层自己画，到点结算
function snClockRun(m, C) {
  const S = C.tx - 20;
  toastMsg('洛丝的壁钟敲响了——躲到王座后面！', '#bfe6ff'); msSay(m, '时间……冻结吧。', '#bfe6ff', 15); sfx.buff();
  msGround((c, g) => {
    const k = g.t / g.dur, blink = Math.floor(g.t * (5 + k * 12)) % 2, X0 = sx(20), X1 = sx(S), Y0 = sy(0, 0), Y1 = sy(DEPTH, 0);
    c.save(); c.globalAlpha = 0.14 + 0.18 * k + 0.1 * blink; c.fillStyle = '#bfe6ff'; c.fillRect(X0, Y0, (X1 - X0) * Math.min(1, 0.3 + k), Y1 - Y0);
    c.globalAlpha = 0.9; c.strokeStyle = '#ffffff'; c.lineWidth = 3; c.setLineDash([10, 8]); c.beginPath(); c.moveTo(X1, Y0 - 10); c.lineTo(X1, Y1 + 10); c.stroke(); c.restore();
  }, { dur: C.warn, kind: 'roseClock', fire: () => snClockFire(m, S) });
}
function snClockFire(m, S) {
  if (msLive(m).dead) return;
  cam.flash = 0.2; cam.flashCol = '#dff6ff'; cam.shake = Math.max(cam.shake, 6); sfx.boom(1.1);
  for (let x = 80; x < S; x += 150) fxBurst(x, DEPTH * (0.2 + 0.6 * ((x / 150) % 2)), 30, 150, '#dff6ff');
  for (const t of msMine(m)) {
    if (t.team !== 'p' || t.summon || t.dead || t.remove || t.invul > 0) continue;
    if (t.x >= S) { fxText('躲在王座后面', t.x, t.y, t.z + 60, { col: '#e8f4ff', size: 12 }); MS_STATS.mech.roseClockSafe = (MS_STATS.mech.roseClockSafe || 0) + 1; msLog('solve', m, { id: 'roseClock' }); continue; }
    msTrueHit(m, t, 0.22 * msPunishK()); addStatus(t, 'freeze', 1.5, { src: m, force: true }); msLog('fail', m, { id: 'roseClock' });
  }
}
// 左墙上的壁钟（程序画）：钟面的指针按倒数走，敲响时摆锤晃、指针飞转
let snClockFxNow = null;
function snClockProp(m) {
  if (snClockFxNow) snClockFxNow.t = snClockFxNow.dur;
  const fx = snClockFxNow = addFx({ x: 80, y: 1, z: 0, dur: 1e9, draw(c) {
    const E = msLive(m); if (E.dead || snClockFxNow !== fx) { this.t = this.dur; return; }
    const C = E.clock || m.clock; if (!C) return;
    const X = sx(80), Y = sy(1, 0) - 190, r = 30, warn = C.warn > 0, a = warn ? game.t * 9 : -Math.PI / 2 + (1 - Math.min(1, C.next / 20)) * TAU, sw = Math.sin(game.t * (warn ? 9 : 3)) * (warn ? 0.5 : 0.25);
    c.save(); c.lineWidth = 3; c.strokeStyle = '#2a4a7a';
    c.fillStyle = '#9ac0e0'; c.fillRect(X - 5, Y + r - 2, 10, 70); c.strokeRect(X - 5, Y + r - 2, 10, 70);
    c.fillStyle = '#dff0ff'; c.beginPath(); c.arc(X + Math.sin(sw) * 40, Y + r + 60 + Math.cos(sw) * 6, 11, 0, TAU); c.fill(); c.stroke();
    c.fillStyle = warn && Math.floor(game.t * 6) % 2 ? '#ffffff' : '#e8f4ff'; c.beginPath(); c.arc(X, Y, r, 0, TAU); c.fill(); c.stroke();
    for (let i = 0; i < 12; i++) { const b = i / 12 * TAU; c.beginPath(); c.moveTo(X + Math.cos(b) * r * 0.78, Y + Math.sin(b) * r * 0.78); c.lineTo(X + Math.cos(b) * r * 0.92, Y + Math.sin(b) * r * 0.92); c.stroke(); }
    c.strokeStyle = warn ? '#3a8aff' : '#2a4a7a'; c.beginPath(); c.moveTo(X, Y); c.lineTo(X + Math.cos(a) * r * 0.75, Y + Math.sin(a) * r * 0.75); c.stroke();
    c.restore();
    if (warn) uiTextWorld(c, C.warn.toFixed(1), X, Y - r - 14, '#bfe6ff');
  } });
}
