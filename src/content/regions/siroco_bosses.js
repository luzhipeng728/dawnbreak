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

/* 故事关四张门的机制常量（组队编号要和 siroco.js 里的是同一个对象，BOSS_SPEC §7）。旧钩子和上面三个函数不要改。 */
const SI_WIT_STANCE = { use: 'stance', every: [12, 15], modes: [
  { id: 'charm', name: '魅惑', col: '#e080ff', replace: true, atk: 1.1, say: '魅惑——方向会乱！', skills: [
    { use: 'shot', id: 'charmShot', clip: 'sigA', mode: 'homing', n: 3, spread: 50, speed: 240, turn: 2.0, dmg: 0.85, status: 'confuse', sdur: 2.2, col: '#e080ff', cd: [5, 7], w: 1.6, say: '魅惑之吻——方向会乱！' },
    { use: 'aoe', id: 'charmRing', clip: 'sigB', shape: 'ring', at: 'self', r: 190, r0: 60, windup: 1.1, dmg: 1.0, status: 'confuse', sdur: 2.2, col: '#e080ff', cd: [7, 9], w: 1.4, say: '混乱之舞——跳出圈外！' }] },
  { id: 'blade', name: '刃舞', col: '#c8d0ff', say: '刃舞——她换回了匕首！', skills: ['witDash', 'witSeq'] }] };

const SI_LAVICE = { use: 'form', name: '拉维切', dur: 16, scale: 1.06, invulT: 1.1, col: '#c86aff', say: '拉维切——左右次元，闪烁的那一半会塌！',
  skills: [{ use: 'shot', mode: 'homing', n: 3, spread: 46, speed: 230, turn: 1.8, dmg: 0.9, col: '#c86aff', cd: [4, 6], w: 1.4 },
    { use: 'swipe', n: 2, reach: 96, dmg: 1.0, cd: [1.6, 2.4], w: 2 }] };
const SI_LAVICE_SIDE = { use: 'arena', kind: 'tiles', cols: 2, hot: 0.5, every: 5, warn: 1.2, frac: 0.06, tick: 0.6, dur: 16, col: '#c86aff', say: '左右次元——闪烁的那一半马上塌掉，站到另一边！' };
const SI_LESTER = { use: 'form', name: '莱斯特', dur: 14, invulT: 0.6, col: '#9ecbff', say: '莱斯特——她会一次次进入无敌！',
  skills: [{ use: 'mech', id: 'lesterInv', mech: { use: 'invuln', until: 'survive', survive: 3.2, hide: false, col: '#9ecbff', say: '莱斯特无敌了——撑过这几秒！' }, cd: [6, 8], gap: 4, w: 2 },
    { use: 'shot', mode: 'spread', n: 4, spread: 70, speed: 320, dmg: 0.75, col: '#9ecbff', cd: [3.5, 5], w: 1.2 }] };
// 不新造动物图：吉里用希洛克精灵换色、再缩小（form.scale 乘在 1.5 上）
const SI_GIRI = { use: 'form', name: '吉里', art: ['siroco', { hue: 108, sat: 1.3, bright: 1.2 }], scale: 0.62, dur: 14, invulT: 1.0, col: '#8ad86a', say: '吉里化形了——换了颜色，也缩小了！',
  skills: [{ use: 'dash', len: 480, speed: 780, windup: 0.7, dmg: 1.25, cd: [3.5, 5], w: 2, say: '扑击！' },
    { use: 'cone', ang: 80, len: 340, windup: 0.8, dur: 0.9, dmg: 0.35, col: '#8ad86a', cd: [5, 7], w: 1.4, say: '吐息——绕到侧面！' }] };
const SI_LORD_FORMS = [SI_LAVICE, SI_LESTER, SI_GIRI];

function lawOrbDead(o) { return !o || o.dead || o.remove; }
function lawOrbLabels(m) {
  if (m.lawFx) m.lawFx.t = m.lawFx.dur;
  m.lawFx = addFx({ x: 0, y: -1, z: 0, dur: 1e9, draw(c) {
    const E = msLive(m), L = (E && E.law) || m.law; if (!L || !L.on || !E || E.dead) { this.t = this.dur; return; }
    const list = L.orbs && L.orbs.length ? L.orbs : (L.nids || []).map(id => msNetEnt(id));
    for (let i = 0; i < list.length; i++) {
      const o = msLive(list[i]); if (lawOrbDead(o)) continue;
      const n = o.lawN || i + 1;
      uiTextWorld(c, String(n), sx(o.x), sy(o.y, (o.z || 0) + (o.h || 70) + 22), n === L.expect ? '#ffe070' : '#d0b0ff');
    }
  } });
}
function lawOrbSpawn(m) {
  const L = m.law; if (!L || L.on || m.puppet) return;
  const W = msRoomW(), orbs = [];
  for (let n = 1; n <= 4; n++) {
    const o = spawnMonster('lawOrb', clamp(W * (0.18 + 0.2 * (n - 1)), 90, W - 90), n % 2 ? DEPTH * 0.32 : DEPTH * 0.68, { lvl: Math.max(1, m.lvl - 1), drop: true, ...skyMul() });
    o.lawN = n; o.lawBoss = m; orbs.push(o);
  }
  L.on = true; L.expect = 1; L.orbs = orbs;
  MS_STATS.mech.order = (MS_STATS.mech.order || 0) + 1;
  lawOrbLabels(m);
  toastMsg('紫球按 1、2、3、4 打碎——打错就重来！', '#c080ff'); msSay(m, '顺序。', '#c080ff', 16);
  const A = (m.def_.attacks || []).find(a => a.msId === 'lawCall'); if (A && !(m.stun > 0)) msStart(m, A);
  msNetEv(m, null, 'hook', { h: 'lawOrbs', ids: orbs.map(o => o.nid || 0), expect: 1 });
}
function lawOrbClear(m) {
  const L = m.law; if (!L) return;
  L.on = false;
  for (const o of L.orbs || []) if (o && !o.dead) { o.hp = 0; killEnt(o, m, {}); }
  L.orbs = [];
}
function lawOrbFail(m) {
  const L = m.law; if (!L || !L.on) return;
  lawOrbClear(m); L.expect = 1; L.next = 10;
  MS_STATS.mech.orderFail = (MS_STATS.mech.orderFail || 0) + 1; msLog('fail', m, { id: 'order' });
  for (const t of msMine(m)) if (!t.summon) msTrueHit(m, t, 0.10 * msPunishK());
  toastMsg('顺序错了——紫球重置了！', '#c080ff'); msSay(m, '错了。', '#c080ff', 16);
  msNetEv(m, null, 'hook', { h: 'lawOrder', fail: 1, ok: 0, expect: 1, next: 10 });
}
function lawOrbSolve(m) {
  const L = m.law; if (!L || !L.on) return;
  L.on = false; L.orbs = []; L.expect = 1; L.next = 20;
  MS_STATS.mech.orderSolve = (MS_STATS.mech.orderSolve || 0) + 1; msLog('solve', m, { id: 'order' });
  if (msMechActive(m, 'groggy')) msGroggyBreak(m);
  toastMsg('顺序对了——守门人破招了！', '#ffe070'); msSay(m, '……', '#ffe070', 16);
  msNetEv(m, null, 'hook', { h: 'lawOrder', fail: 0, ok: 1, expect: 1, next: 20 });
}
function lawOrbWatch(m) {
  const L = m.law; if (!L || !L.on) return;
  const was = L.expect;
  while (L.expect <= 4) {
    const cur = (L.orbs || []).find(o => o.lawN === L.expect);
    if (!cur || !(cur.dead || cur.remove)) break;
    L.expect++;
  }
  if (L.expect > 4) { lawOrbSolve(m); return; }
  if ((L.orbs || []).some(o => o.lawN > L.expect && (o.dead || o.remove))) { lawOrbFail(m); return; }
  if (L.expect !== was) msNetEv(m, null, 'hook', { h: 'lawOrder', fail: 0, ok: 0, expect: L.expect, next: L.next });
}
REGION_HOOKS.lawWarden = {
  sig: ['紫球顺序', '裁决横扫'],
  onSpawn(m) { m.law = { next: 7, on: false, expect: 1, orbs: [] }; },
  update(m, dt) {
    if (m.puppet || m.msHidden) return;
    const L = m.law; if (!L) return;
    if (L.on) { lawOrbWatch(m); return; }
    if (m.msIdle || m.aiCd > 20) return;
    L.next -= dt; if (L.next <= 0) lawOrbSpawn(m);
  },
  hud(c, m, x, y) { const L = m.law; if (!L) return; uiText(L.on ? `紫球顺序：打 ${L.expect}` : `紫球 ${Math.ceil(L.next || 0)}s`, x + 790, y + 14, { size: 15, align: 'right', color: L.on ? '#d0b0ff' : '#c8b8e8', sw: 3 }); },
  mirror: {
    lawOrbs(m, d) { const L = m.law ??= { next: 7, on: false, expect: 1 }; L.on = true; L.expect = d.expect || 1; L.nids = d.ids || []; lawOrbLabels(m); toastMsg('紫球按 1、2、3、4 打碎——打错就重来！', '#c080ff'); },
    lawOrder(m, d) {
      const L = m.law ??= {};
      if (d.fail) { L.on = false; L.expect = 1; L.next = d.next || 10; const t = msSelf(); if (t && !t.summon) msTrueHit(m, t, 0.10 * msPunishK()); toastMsg('顺序错了——紫球重置了！', '#c080ff'); return; }
      L.expect = d.expect || 1;
      if (d.ok) { L.on = false; L.next = d.next || 20; toastMsg('顺序对了——守门人破招了！', '#ffe070'); }
    },
    tick(m, dt) { const L = m.law; if (!L || L.on) return; L.next = Math.max(0, (L.next || 0) - dt); },
  },
};

function siroLordPose(m, id) {
  if (!m || m.dead || m.stun > 0 || m.puppet) return;
  const A = (m.def_.attacks || []).find(a => a.msId === id); if (A) msStart(m, A);
}
function siroLordFormTick(m, dt) {
  if (m.dead || m.msIdle || m.aiCd > 20) return;
  const F = m.lordForm; if (!F || msMechActive(m, 'form')) return;
  F.next -= dt; if (F.next > 0) return;
  F.i = (F.i + 1) % SI_LORD_FORMS.length;
  msMechStart(m, SI_LORD_FORMS[F.i]);
  if (F.i === 0) msMechStart(m, SI_LAVICE_SIDE);
  F.next = 3; siroLordPose(m, 'lordFace');
}
REGION_HOOKS.sirocoLord = {
  sig: ['三形态轮换（拉维切 / 莱斯特 / 吉里）', '凝视（背对她）'],
  onSpawn(m) { m.gaze = { next: 14, warn: 0 }; m.lordForm = { i: -1, next: 8 }; },
  update(m, dt) {
    if (m.puppet || m.msHidden) return;
    const G = m.gaze;
    if (G) {
      if (G.warn > 0) { G.warn -= dt; if (G.warn <= 0) sirocoGazeResolve(m); }
      else if (!(m.aiCd > 20) && !m.msIdle) { G.next -= dt; if (G.next <= 0) { sirocoGazeStart(m); siroLordPose(m, 'lordGaze'); } }
    }
    siroLordFormTick(m, dt);
  },
  onPhase(m, i) { if (m.gaze && i >= 2) m.gaze.next = Math.min(m.gaze.next, 6); },
  hud(c, m, x, y) { const G = m.gaze; if (!G) return; uiText(G.warn > 0 ? '凝视！背对希洛克！' : `凝视 ${Math.ceil(G.next)}s`, x + 790, y + 14, { size: 15, align: 'right', color: G.warn > 0 ? '#ff9ad0' : '#c8b8e8', sw: 3 }); },
  mirror: {
    gaze(m, d) { const G = m.gaze ??= {}; G.warn = d.w; G.next = d.n; sirocoGazeFx(m, G.warn); },
    tick(m, dt) { const G = m.gaze; if (!G) return; if (G.warn > 0) { G.warn -= dt; if (G.warn <= 0) sirocoGazeResolve(m, [msSelf()]); } else G.next = Math.max(0, G.next - dt); },
  },
};
