// 团本领主机制测试的公共工具（test/raid_mech_lab.mjs、test/raid_bosses.mjs 共用）：确定性推进 SIM、摆位 / 打一下 T、每个谜题的“正确操作” SOLVE
// 用法：import { setupRaidLab } from './lib_raidmech.mjs'; await setupRaidLab(page);
export async function setupRaidLab(page) {
  await page.evaluate(() => {
  window.__keepOn = true;
  const keep = () => { if (!window.__keepOn) return; const q = game.player; q.hp = q.hpMax; q.mp = q.mpMax; q.dead = false; };
  game.paused = true; Math.random = mulberry(20261008);
  window.SIM = (sec, each) => { const n = Math.round(sec * 60); for (let i = 0; i < n; i++) { if (each) each(i); step(1 / 60); keep(); } };
  window.T = {
    clear() { for (let k = ents.length - 1; k >= 0; k--) if (ents[k].team === 'e') ents.splice(k, 1); groundFx.length = 0; projs.length = 0; game.timers.length = 0; MS_POOLS.length = 0; const p = game.player; if (p.act) p.endAct(); p.status = {}; p.invul = 0; p.raidCrouch = false; p.raidMash = false; p.dead = false; p.hp = p.hpMax; if (p.st === 'dead' || p.st === 'down') p.setState('idle'); },
    spawn(spec) { const m = window.__m = spawnMonster('msLab', 900, 100, { lvl: 60, boss: true }); m.invul = 0; m.z = 0; m.setState('idle'); const c = m.control; m.control = (e, dt) => { e.aiCd = 99; if (c) c(e, dt); }; window.__st = msMechStart(m, { use: 'raidScript', mode: 'normal', ...spec }); return m; },
    put(x, y = 100, face) { const p = game.player; if (p.act) p.endAct(); p.x = x; p.y = y; p.z = 0; p.vx = p.vy = 0; if (p.st !== 'idle' && p.st !== 'walk') p.setState('idle'); if (face) p.face = face; },
    hit(t) { t.invul = 0; return applyHit(game.player, t, { dmg: 20, sure: true, knock: 0, stun: 0.05, hs: 0 }, { proj: true }); },
    ent(key) { return window.__st.ents[key]; },
  };
  // 每个谜题的“正确操作”（每帧调用）：c = 当前读条的谜题状态
  window.SOLVE = {
    pads(c) { if (c.t < c.p.peek + 0.2) return; const mk = c.marks[c.seq[c.i]]; if (mk) T.put(mk.x, mk.y); },
    heartbeat(c, f) { const e = T.ent('heart:0'); if (e && c.objs[0].glow && f % 6 === 0) T.hit(e); },
    realBody(c, f) { const o = c.objs.find(q => q.glow); const e = o && T.ent('clone:' + o.i); if (e && f % 6 === 0) T.hit(e); },
    orbs(c, f) { const i = c.objs.findIndex(o => o.alive && o.elem === c.seq[c.k]); const e = i >= 0 && T.ent('orb:' + i); if (e && f % 4 === 0) T.hit(e); },
    crystals(c, f) { const e = Object.values(window.__st.ents)[0]; if (e && f % 4 === 0) T.hit(e); },
    burial(c, f) { if (f % 5 === 0) game.player.raidMash = true; },
    tether() { const m = window.__m; T.put(m.x < msRoomW() / 2 ? msRoomW() - 60 : 60, 100); },
    souls(c, f) { if (!c.open || f % 5) return; const o = c.objs.find(q => q.alive); const e = o && T.ent('soul:' + o.i); if (e) T.hit(e); },
    swords(c) { const mk = c.marks.find(q => q.on) || c.marks[0]; T.put(mk.x, mk.y); },
    breath(c) { const mk = c.marks[0]; T.put(mk.x, mk.y); },
    guide(c) { const o = c.orbs.find(q => !q.on); if (!o) return; const g = c.goal, dx = g.x - o.x, dy = (g.y - o.y) / 0.45, L = Math.hypot(dx, dy) || 1; T.put(o.x + dx / L * 44, o.y + dy / L * 44 * 0.45); },
    gem(c) { const g = c.carry.me; if (g != null) T.put(c.altar.x, c.altar.y); else { const q = c.gems.find(x => !x.on); if (q) T.put(q.x, q.y); } },
    path(c) { c._k = (c._k || 0) + (c.t >= c.p.grace ? 0.06 : 0); const cells = c.cells.map(s => s.split(',').map(Number)).sort((a, b) => a[0] - b[0]); const q = cells[Math.min(cells.length - 1, Math.floor(c._k))]; const x = c.W * c.p.x0 + c.cw * (q[0] + 0.5); T.put(c.p.rtl ? c.W - x : x, c.ch * (q[1] + 0.5)); },
    soulSwap(c, f) { if (f % 5) return; const o = c.objs.find(q => q.alive && q.side === c.soul.me); const e = o && T.ent('soul:' + o.i); if (e) T.hit(e); },
    reflect(c, f) { if (!c.up && f % 10 === 0) { T.hit(window.__m); window.__m.hp = window.__m.hpMax; } },
    facing() { T.put(500, 100, -1); },
    crouch() { game.player.raidCrouch = true; },
    dps(c, f) { const m = window.__m; if (f % 3) return; m.invul = 0; m.hp = 1e12; applyHit(game.player, m, { dmg: 400, sure: true, knock: 0, stun: 0.05, hs: 0 }, { proj: true }); m.hp = m.hpMax; },
    clear(c) { const mk = c.marks.find(q => q.on); if (mk) T.put(mk.x, mk.y); },
    feed(c, f) { const e = T.ent('orb:0'); if (e && c.p.elems[c.k] !== RAID_MECH.OPP[c.sign] && f % 24 === 0) T.hit(e); },
    gauge() {},
    absorb(c) { const mk = c.marks[0], g = c.g.me || 0; if (g > 80) c._out = true; else if (g < 8) c._out = false; T.put(mk.x, c._out ? mk.y + 150 : mk.y); },
  };
});
}
