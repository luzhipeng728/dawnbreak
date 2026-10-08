// 团本领主机制运行时（game/raid_mech_rt.js）的实验室测试：样品怪挂 raidScript，逐个谜题在真实场景里解开 / 不解开。
//   出场无敌（打不动）→ 读条 → 物件 / 地面标记真的刷出来 → 按解法操作（站位、打物件、连打、蹲下）→ 虚弱（受伤倍率）；不操作 → 灭团攻击真的掉血
//   另外：全屏击倒（蹲下躲）、状态翻译成异常（掩埋 = 定身）、BGM 节拍、HUD 不报错
// 用法：node test/raid_mech_lab.mjs [谜题,谜题…]；截图在 test/shots/raid_mech_lab/
import { launch, URL_BASE } from './lib.mjs';
import fs from 'fs';
import { setupRaidLab } from './lib_raidmech.mjs';
const out = 'test/shots/raid_mech_lab'; fs.mkdirSync(out, { recursive: true });
const only = process.argv[2] ? process.argv[2].split(',') : null;
let fail = 0, n = 0;
const ok = (c, msg, d) => { n++; if (c) console.log('✓', msg); else { fail++; console.log('✗', msg, d !== undefined ? JSON.stringify(d).slice(0, 400) : ''); } return c; };
const { browser, page, logs } = await launch({ width: 1280, height: 720 });
await page.goto(`${URL_BASE}?test&mute&mon=msLab`); await page.waitForFunction(() => window.__READY, null, { timeout: 30000 });
await page.evaluate(async () => { await loadBundles(monBundles(['msLab'])); });
await setupRaidLab(page);
const puzzles = only || ['pads', 'heartbeat', 'realBody', 'orbs', 'crystals', 'burial', 'tether', 'souls', 'swords', 'breath', 'guide', 'gem', 'path', 'soulSwap', 'reflect', 'facing', 'crouch', 'dps', 'clear', 'feed', 'gauge', 'absorb'];
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
  ok(r.solve && !r.fail && (r.seen.objs || r.seen.marks || ['burial', 'facing', 'crouch', 'reflect', 'dps', 'gauge'].includes(id)), `${id}：按解法操作 → 解开、领主虚弱`, r);
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
