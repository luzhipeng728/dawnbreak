// 团本领主机制运行时（game/raid_mech_rt.js）的实验室测试：样品怪挂 raidScript，逐个谜题在真实场景里解开 / 不解开。
//   出场无敌（打不动）→ 读条 → 物件 / 地面标记真的刷出来 → 按解法操作（站位、打物件、连打、蹲下）→ 虚弱（受伤倍率）；不操作 → 灭团攻击真的掉血
//   另外：全屏击倒（蹲下躲）、状态翻译成异常（掩埋 = 定身）、BGM 节拍、HUD 不报错
// 用法：node test/raid_mech_lab.mjs [谜题,谜题…]；截图在 test/shots/raid_mech_lab/
import { launch, URL_BASE } from './lib.mjs';
import fs from 'fs';
const out = 'test/shots/raid_mech_lab'; fs.mkdirSync(out, { recursive: true });
const only = process.argv[2] ? process.argv[2].split(',') : null;
let fail = 0, n = 0;
const ok = (c, msg, d) => { n++; if (c) console.log('✓', msg); else { fail++; console.log('✗', msg, d !== undefined ? JSON.stringify(d).slice(0, 400) : ''); } return c; };
const { browser, page, logs } = await launch({ width: 1280, height: 720 });
await page.goto(`${URL_BASE}?test&mute&mon=msLab`); await page.waitForFunction(() => window.__READY, null, { timeout: 30000 });
await page.evaluate(async () => { await loadBundles(monBundles(['msLab'])); });
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
    path(c) { c._k = (c._k || 0) + 0.06; const cells = c.cells.map(s => s.split(',').map(Number)).sort((a, b) => a[0] - b[0]); const q = cells[Math.min(cells.length - 1, Math.floor(c._k))]; T.put(c.W * c.p.x0 + c.cw * (q[0] + 0.5), c.ch * (q[1] + 0.5)); },
    soulSwap(c, f) { if (f % 5) return; const o = c.objs.find(q => q.alive && q.side === c.soul.me); const e = o && T.ent('soul:' + o.i); if (e) T.hit(e); },
    reflect(c, f) { if (!c.up && f % 10 === 0) { T.hit(window.__m); window.__m.hp = window.__m.hpMax; } },
    facing() { T.put(500, 100, -1); },
    crouch() { game.player.raidCrouch = true; },
  };
});
const puzzles = only || ['pads', 'heartbeat', 'realBody', 'orbs', 'crystals', 'burial', 'tether', 'souls', 'swords', 'breath', 'guide', 'gem', 'path', 'soulSwap', 'reflect', 'facing', 'crouch'];
// 出场无敌
{
  const r = await page.evaluate(() => { T.clear(); T.put(400); const m = T.spawn({ intro: { dur: 2.5, say: '入场' }, weak: { every: 999, pool: [{ use: 'crystals' }] } }); SIM(0.2); const hp0 = m.hp; if (canHit(game.player, m, {})) applyHit(game.player, m, { dmg: 20, sure: true, knock: 0, stun: 0.05, hs: 0 }, { proj: true }); SIM(0.1); const a = m.hp === hp0; SIM(2.6); const h1 = m.hp; if (canHit(game.player, m, {})) applyHit(game.player, m, { dmg: 20, sure: true, knock: 0, stun: 0.05, hs: 0 }, { proj: true }); SIM(0.1); return { a, b: m.hp < h1, ph: RAID_MECH.view(window.__st.S).ph, fx: fxList.includes(window.__st.fx) }; });
  ok(r.a && r.b && r.ph === 'fight' && r.fx, '出场无敌 2.5 秒打不动（canHit 拒绝），之后能打（地面标记特效挂上）', r);
}
for (const id of puzzles) {
  const r = await page.evaluate(id => {
    T.clear(); T.put(400); const m = T.spawn({ intro: { dur: 0.1 }, weak: { every: 0.5, pool: [{ use: id }] }, onSolve: { dur: 4, mul: 1.7 } });
    let seen = { objs: 0, marks: 0 }, f = 0;
    SIM(0.8);
    const c0 = window.__st.S.cast; if (!c0) return { err: 'no cast', ph: window.__st.S.ph };
    SIM(40, () => { const S = window.__st.S, c = S.cast; if (!c) return; seen.objs = Math.max(seen.objs, Object.keys(window.__st.ents).length); seen.marks = Math.max(seen.marks, (c.marks || []).length); SOLVE[id](c, f++); });
    const log = window.__st.log.map(x => x.k);
    return { id, log: log.join(','), brk: m.msMul.raidBreak, seen, solve: log.includes('solve'), fail: log.includes('fail') };
  }, id);
  ok(r.solve && !r.fail && (r.seen.objs || r.seen.marks || ['burial', 'facing', 'crouch', 'reflect'].includes(id)), `${id}：按解法操作 → 解开、领主虚弱`, r);
}
// 画面：每个谜题刚开始时的样子（物件 + 地面标记 + HUD）
for (const id of puzzles) {
  await page.evaluate(id => { T.clear(); T.put(300); T.spawn({ intro: { dur: 0.1 }, weak: { every: 0.5, pool: [{ use: id }] } }); SIM(1.4); game.paused = false; }, id);
  await page.waitForTimeout(120); await page.screenshot({ path: `${out}/${id}.png` }); await page.evaluate(() => { game.paused = true; });
}
// 没解开 → 灭团（普通模式 100%）；虚弱时受伤倍率
{
  const r = await page.evaluate(() => {
    T.clear(); T.put(400); window.__keepOn = false; const p = game.player; p.hp = p.hpMax; p.invul = 0;
    T.spawn({ intro: { dur: 0.1 }, weak: { every: 0.5, pool: [{ use: 'crystals', dur: 3 }] }, onFail: { frac: 0.5, down: true } });
    SIM(5); const d = p.hpMax - p.hp; window.__keepOn = true; return { d, frac: d / p.hpMax, log: window.__st.log.map(x => x.k).join() };
  });
  ok(r.frac > 0.45 && r.frac < 0.56 && /wipe/.test(r.log), '没解开 → 灭团攻击按最大 HP 结算（这里写 50%）', r);
}
{
  const r = await page.evaluate(() => {
    T.clear(); T.put(400); const p = game.player; window.__keepOn = false; p.hp = p.hpMax; p.invul = 0;
    T.spawn({ intro: { dur: 0.1 }, weak: { every: 0.5, pool: [{ use: 'burial', dur: 3 }] } });
    SIM(1); const rooted = !!(p.status && p.status.root), tomb = !!T.ent('tomb:0'); SIM(4); window.__keepOn = true;
    return { rooted, tomb, after: !!(p.status && p.status.root), log: window.__st.log.map(x => x.k).join() };
  });
  ok(r.rooted && r.tomb && !r.after, '掩埋：本机玩家被定身、脚下刷墓碑；结束后解除定身', r);
}
{
  const r = await page.evaluate(() => {
    const run = crouch => { T.clear(); T.put(400); const p = game.player; window.__keepOn = false; p.hp = p.hpMax; p.invul = 0; T.spawn({ intro: { dur: 0.1 }, atk: [{ every: [99, 99], first: 0.3, puzzle: { use: 'crouch' } }] }); let lo = p.hp; SIM(3, () => { p.raidCrouch = crouch; lo = Math.min(lo, p.hp); }); window.__keepOn = true; return { d: p.hpMax - lo, log: window.__st.log.map(x => x.k).join(), dead: p.dead, st: p.st, hp: p.hp, side: window.__st.S.side.map(s => [s.id, s.t, JSON.stringify(s.pl)]) }; };
    return { up: run(false), down: run(true) };
  });
  ok(r.up.d > 0 && r.down.d === 0, '全屏击倒（定时机制招）：站着挨打、蹲下没事', r);
}
{
  const r = await page.evaluate(() => { T.clear(); T.put(400); const m = T.spawn({ intro: { dur: 0.1 }, weak: { every: 0.5, pool: [{ use: 'souls' }] } }); let cue = 0; const f0 = cam.flash; SIM(7, () => { if (window.__st.log.some(x => x.k === 'cue')) cue = 1; }); return { cue }; });
  ok(r.cue === 1, '守门人之魂：BGM 节拍事件（钟声 + 闪屏）', r);
}
{
  const r = await page.evaluate(() => {
    T.clear(); T.put(400); const m = T.spawn({ intro: { dur: 0.1 }, weak: { every: 0.5, pool: [{ use: 'crystals' }] } }); SIM(1);
    const n0 = ents.filter(e => e.kind === 'rmObj_crystal' && !e.remove).length, st = window.__st;
    m.hp = 0; killEnt(m, game.player, {}); SIM(0.3);
    return { n0, n1: ents.filter(e => e.kind === 'rmObj_crystal' && !e.remove && !e.dead).length, fx: fxList.includes(st.fx), ended: !!st.ended };
  });
  ok(r.n0 === 4 && r.n1 === 0 && !r.fx && r.ended, '领主读条中倒下：谜题物件和地面标记一起收走（不会卡住通关）', r);
}
{
  const r = await page.evaluate(() => { T.clear(); T.put(400); const m = T.spawn({ intro: { dur: 0.1 }, weak: { every: 0.5, pool: [{ use: 'breath' }] }, atk: [{ every: [99, 99], first: 0.6, puzzle: { use: 'facing', mode: 'random' } }] }); SIM(1.0);
    const cv = document.createElement('canvas'); cv.width = 1280; cv.height = 720; const c = cv.getContext('2d'); let h = 0, err = null; try { h = BOSS_MECHS.raidScript.hud(c, m, window.__st, 560, 40, 800); } catch (e) { err = String(e); } return { h, err }; });
  ok(r.h > 16 && !r.err, 'HUD：读条条 + 提示 + 呼吸槽 + 机制招提示', r);
}
{
  await page.evaluate(() => { T.clear(); T.put(400); T.spawn({ intro: { dur: 0.1 }, weak: { every: 0.5, pool: [{ use: 'breath' }] }, atk: [{ every: [99, 99], first: 0.6, puzzle: { use: 'tether' } }] }); SIM(1.2); game.paused = false; });
  await page.waitForTimeout(200); await page.screenshot({ path: `${out}/hud.png` }); await page.evaluate(() => { game.paused = true; });
  const errs = logs.filter(l => /error|TypeError|ReferenceError/i.test(l));
  ok(errs.length === 0, 'HUD / 地面标记绘制没有报错', errs.slice(0, 3));
}
console.log(`\n${n - fail}/${n} 通过`);
await browser.close();
process.exit(fail ? 1 : 0);
