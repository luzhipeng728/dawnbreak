/* =====================================================================
   魔界 · 潜行者希洛克：领主的自定义钩子（机制库覆盖不到的部分；其余全部在 siroco.js 的数据里）
   希洛克的「凝视」：每隔十几秒她睁开无数只眼睛，1.8 秒后结算——面朝她的人被恐惧（减速 + 失明 + 15% 最大 HP），背对她就没事。
   机制库里的安全区只看站位，这里要看朝向，所以写成钩子。组队：主机睁眼时发 hook 事件，队员这边同样睁眼、到点按自己的朝向判定自己（mirror）。
   ===================================================================== */
REGION_HOOKS.siroco = {
  onSpawn(m) { m.gaze = { next: 14, warn: 0 }; },
  update(m, dt) {
    const G = m.gaze; if (!G || m.msHidden) return;
    if (G.warn > 0) { G.warn -= dt; if (G.warn <= 0) sirocoGazeResolve(m); return; }
    G.next -= dt; if (G.next <= 0) sirocoGazeStart(m);
  },
  onPhase(m, i) { if (m.gaze && i >= 2) m.gaze.next = Math.min(m.gaze.next, 6); },
  hud(c, m, x, y) { const G = m.gaze; if (!G) return; uiText(G.warn > 0 ? '凝视！背对希洛克！' : `凝视 ${Math.ceil(G.next)}s`, x + 790, y + 14, { size: 15, align: 'right', color: G.warn > 0 ? '#ff9ad0' : '#c8b8e8', sw: 3 }); },
  mirror: {   // 组队队员（net/coop_mech.js）：主机睁眼时这边也睁眼，到点按自己的朝向判定自己；平时本地倒数（HUD）
    gaze(m, d) { const G = m.gaze ??= {}; G.warn = d.w; G.next = d.n; sirocoGazeFx(m, G.warn); },
    tick(m, dt) { const G = m.gaze; if (!G) return; if (G.warn > 0) { G.warn -= dt; if (G.warn <= 0) sirocoGazeResolve(m, [msSelf()]); } else G.next = Math.max(0, G.next - dt); } },
};
function sirocoGazeStart(m) {
  const G = m.gaze; G.next = m.msPhase >= 2 ? 13 : 18; G.warn = 1.8;
  MS_STATS.mech.gaze = (MS_STATS.mech.gaze || 0) + 1;
  sirocoGazeFx(m, G.warn);
  msNetEv(m, null, 'hook', { h: 'gaze', w: G.warn, n: G.next });
}
function sirocoGazeFx(m, dur) {
  toastMsg('希洛克睁开了无数只眼睛——背对她！', '#ff9ad0'); msSay(m, '看着我……', '#ff9ad0', 15); sfx.buff();
  addFx({ x: m.x, y: m.y + 1, z: 0, dur, ent: m, draw(c) {   // 身边浮现一圈眼睛
    const E = msLive(this.ent), k = this.t / this.dur, H = E.h * (E.scale || 1), X = sx(E.x), Y = sy(E.y, E.z) - H * 0.55;
    c.save(); c.globalAlpha = Math.min(1, k * 4);
    for (let i = 0; i < 9; i++) { const a = i / 9 * TAU + game.t * 0.6, ex = X + Math.cos(a) * H * 0.75, ey = Y + Math.sin(a) * H * 0.45, open = Math.min(1, k * 1.6);
      c.fillStyle = '#f4ecff'; c.beginPath(); c.ellipse(ex, ey, 9, 5 * open + 0.5, 0, 0, TAU); c.fill(); c.fillStyle = '#8a3aff'; c.beginPath(); c.arc(ex, ey, 3 * open, 0, TAU); c.fill(); }
    c.restore();
  } });
}
function sirocoGazeResolve(m, who = ents) {   // who：组队队员只判定自己
  if (m.dead) return;
  cam.flash = 0.12; cam.flashCol = '#d8b0ff'; sfx.boom(0.7);
  for (const t of who) {
    if (t.team !== 'p' || t.dead || t.remove || t.ghost) continue;   // 队友的影子：由队友自己的客户端判定（net/coop_mech.js）
    const facing = Math.sign(m.x - t.x || 1) === t.face;
    if (!facing) { fxText('避开了凝视', t.x, t.y, t.z + 60, { col: '#e8d8ff', size: 11 }); MS_STATS.mech.gazeSafe = (MS_STATS.mech.gazeSafe || 0) + 1; continue; }
    addStatus(t, 'slow', 3, { src: m, force: true }); addStatus(t, 'blind', 2, { src: m, force: true }); msTrueHit(m, t, 0.15);
    fxText('恐惧', t.x, t.y, t.z + 60, { col: '#ff9ad0', size: 14 }); MS_STATS.mech.gazeHit = (MS_STATS.mech.gazeHit || 0) + 1;
  }
}
