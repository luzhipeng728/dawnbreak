// 好友决斗的操作延迟（docs/NETWORK.md「决斗的操作延迟」）：对方（队员）按下攻击 / 技能 → 自己屏幕上自己的角色开始出招，隔了多少毫秒。
// 服务端下行延迟 LAG 依次取 0 / 60 / 120 ms（每个玩家到服务器的往返 ≈ LAG；对方的一次操作要经过 服务器→主机、服务器→对方 两段）。
// 每档按 X（普攻）和 A（技能栏 1）各若干次；同时核对：出招只播一次（本地先出、主机的出招事件不再重播）、主机那边确实也出了同样的招、最后位置和主机一致（没有瞬移）。
// 用法：node test/mp_duel_lag.mjs [每档次数=6] [延迟列表=0,60,120]   MAXMS=33：120ms 档要求 p90 不超过这个值（本地预测后；不设 = 只测量）
import { startServer, launchPlayers, ok, result, sleep, until, uiRegister, uiCreateChar, dumpErrors } from './net_lib.mjs';
const N = +(process.argv[2] || 6), LAGS = (process.argv[3] || '0,60,120').split(',').map(Number), MAXMS = +(process.env.MAXMS || 0);
const srv = await startServer();
const { players, close } = await launchPlayers(2);
const [A, B] = players.map(p => p.page);
const out = {};
try {
  for (const [i, P] of [A, B].entries()) { ok(await uiRegister(P, srv.url, ['alice', 'bob'][i]), `${['alice', 'bob'][i]} 注册`); ok(await uiCreateChar(P, i), '建角色进城'); }
  for (const P of [A, B]) await P.evaluate(() => worldTravel('elvenguard'));
  await until(A, () => netTown.peers.size === 1, null, 10000);
  await A.evaluate(() => { const p = [...netTown.peers.values()][0]; netPlayerMenu({ id: p.id, name: p.acct, char: p.char }); });
  await A.click('.pmenu button:has-text("发起决斗")');
  await until(B, () => menus.isOpen('nd_duelask'), null, 5000);
  await B.click('.netask button:has-text("接受决斗")');
  ok(await until(B, () => netDuel.state === 'fight' && game.duel && game.duel.a, null, 20000), '进入决斗场');
  ok(await until(A, () => duel.state === 'fight', null, 10000), '开打');
  await A.evaluate(() => { duel.timer = 9999; window.__hostActs = []; const d = duel.b.doAct; duel.b.doAct = function (def, ex) { window.__hostActs.push({ t: performance.now(), k: (ex && ex.skill) || def.name }); return d.call(this, def, ex); }; });
  // 对方页面：按键时刻（keydown 的时间戳）→ 自己的角色开始出招后第一次画到屏幕上的时刻；每次出招都记下来（数一数有没有重播）
  await B.evaluate(() => {
    const W = window.__lag = { t0: 0, key: '', acts: [], seen: 0, pend: false };
    addEventListener('keydown', e => { if ((e.code === 'KeyX' || e.code === 'KeyA') && !e.repeat) { W.t0 = e.timeStamp; W.key = e.code; W.seen = 0; } }, true);
    const p = game.player, d0 = p.doAct;
    p.doAct = function (def, ex) { W.acts.push({ t: performance.now(), k: (ex && ex.skill) || def.name }); W.pend = true; return d0.call(this, def, ex); };
    const r0 = window.renderWorld; window.renderWorld = () => { r0(); if (W.pend) { W.pend = false; if (W.t0 && !W.seen) W.seen = performance.now(); } };
  });
  const cfg = srv.app.ctx.cfg;
  for (const lag of LAGS) {
    cfg.lagMs = lag; cfg.jitterMs = 0;
    await sleep(1000);
    const R = { x: [], a: [], acts: [], hostActs: [] };
    for (let i = 0; i < N * 2; i++) {
      const key = i % 2 ? 'KeyA' : 'KeyX';
      // 双方都停稳：对方自己的角色可以自由行动、主机上它也是空闲
      await until(B, () => { const p = game.player; return !p.act && (p.st === 'idle' || p.st === 'walk') && game.duel.state === 'fight'; }, null, 5000);
      await until(A, () => !duel.b.act && duel.b.st === 'idle', null, 5000);
      await sleep(250);
      if (key === 'KeyA') await B.evaluate(() => { for (const k in game.player.cool) game.player.cool[k] = 0; });
      await A.evaluate(() => { for (const k in duel.b.cool) duel.b.cool[k] = 0; duel.b.mp = duel.b.mpMax; window.__hostActs.length = 0; });
      await B.evaluate(() => { window.__lag.acts.length = 0; });
      await B.keyboard.press(key);
      const seen = await until(B, () => window.__lag.seen > 0, null, 3000);
      await sleep(900 + lag * 2);
      const r = await B.evaluate(() => ({ ms: window.__lag.seen ? window.__lag.seen - window.__lag.t0 : null, acts: window.__lag.acts.map(a => a.k) }));
      const h = await A.evaluate(() => window.__hostActs.map(a => a.k));
      (key === 'KeyX' ? R.x : R.a).push(seen ? Math.round(r.ms) : null);
      R.acts.push(r.acts.length); R.hostActs.push(h.length);
      if (r.acts[0] !== h[0]) R.mismatch = (R.mismatch || []).concat([[r.acts, h]]);
    }
    // 位置一致：停下来之后对方屏幕上的自己和主机上的位置
    await sleep(600);
    const pos = [await A.evaluate(() => [Math.round(duel.b.x), Math.round(duel.b.y)]), await B.evaluate(() => [Math.round(game.player.x), Math.round(game.player.y)])];
    R.posErr = Math.round(Math.hypot(pos[0][0] - pos[1][0], pos[0][1] - pos[1][1]));
    const q = (a, k) => { const s = a.filter(v => v !== null).sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * k))] : null; };
    R.p50 = q(R.x.concat(R.a), 0.5); R.p90 = q(R.x.concat(R.a), 0.9);
    out[lag] = R;
    console.log(`LAG ${lag}ms（每人到服务器往返 ≈ ${lag}ms）：按键→自己出招 中位 ${R.p50}ms / p90 ${R.p90}ms　普攻 ${JSON.stringify(R.x)} 技能 ${JSON.stringify(R.a)}　每次出招次数 对方 ${JSON.stringify(R.acts)} 主机 ${JSON.stringify(R.hostActs)}　停下后位置差 ${R.posErr}px` + (R.mismatch ? `　不一致 ${JSON.stringify(R.mismatch)}` : ''));
    ok(R.x.concat(R.a).every(v => v !== null), `LAG ${lag}：每次按键都出招了`);
    ok(R.acts.every(n => n >= 1) && R.hostActs.every(n => n >= 1), `LAG ${lag}：对方和主机都出了招`, { acts: R.acts, host: R.hostActs });
    ok(R.posErr < 30, `LAG ${lag}：停下后对方屏幕上的位置和主机一致（${R.posErr}px）`);
    if (MAXMS && lag === Math.max(...LAGS)) {
      ok(R.p90 <= MAXMS, `LAG ${lag}：按键到自己出招 p90 ${R.p90}ms ≤ ${MAXMS}ms（本地先出招）`);
      ok(R.acts.every(n => n === 1), `LAG ${lag}：每次按键自己的角色只出一次招（本地先出的，主机的出招事件不再重播）`, R.acts);
      ok(!R.mismatch, `LAG ${lag}：本地出的招和主机上的一致`, R.mismatch);
    }
  }
  // 最高延迟下再看两件事：① 按住方向键走 1 秒：自己的角色每帧的位移平滑（没有被校正拽回去 / 瞬移），停下后和主机一致
  // ② 主机这边的对手交给 AI 打 4 秒：被打中时跟随主机（受击 / 倒地），恢复后回到本地操作，不报错、最后位置一致
  const lag = Math.max(...LAGS); cfg.lagMs = lag;
  await until(B, () => !game.player.act && game.player.self.mode === 'local', null, 5000);
  await B.evaluate(() => { const p = game.player, W = window.__mv = { xs: [] }; const r0 = window.renderWorld; window.renderWorld = () => { r0(); if (W.on) W.xs.push(p.x); }; W.on = true; });
  await B.keyboard.down('ArrowLeft'); await sleep(1000); await B.keyboard.up('ArrowLeft');
  await B.evaluate(() => { window.__mv.on = false; });
  await sleep(800 + lag * 2);
  const mv = await B.evaluate(() => { const xs = window.__mv.xs, d = xs.slice(1).map((x, i) => x - xs[i]); return { n: xs.length, maxStep: +Math.max(...d.map(Math.abs)).toFixed(1), back: d.filter(v => v > 0.5).length, moved: Math.round(xs[0] - xs[xs.length - 1]) }; });
  const pos2 = [await A.evaluate(() => Math.round(duel.b.x)), await B.evaluate(() => Math.round(game.player.x))];
  console.log(`按住左走 1 秒（LAG ${lag}）：${JSON.stringify(mv)}，停下后 主机 ${pos2[0]} / 本地 ${pos2[1]}`);
  ok(mv.moved > 100 && mv.maxStep < 12 && mv.back <= 2, `LAG ${lag}：走动时自己的角色每帧位移平滑（最大 ${mv.maxStep}px/帧，往回拽 ${mv.back} 帧）`, mv);
  ok(Math.abs(pos2[0] - pos2[1]) < 30, `LAG ${lag}：走完停下后和主机位置一致`, pos2);
  await B.evaluate(() => { const S = game.player.self, W = window.__mode = { sw: 0, last: S.mode }; setInterval(() => { if (S.mode !== W.last) { W.sw++; W.last = S.mode; } }, 5); });
  await A.evaluate(() => { const a = duel.a; a.x = duel.b.x - 70; a.y = duel.b.y; a.pad = new Pad(); a.brain = new FighterBrain(a, 3); a.control = (e, dt) => { if (duel.state === 'fight') aiFighterControl(e, dt); else e.pad.frame(game.t); }; });
  let hitAt = -1;   // 一直按键，挨打之后再打 6 下
  for (let i = 0; i < 60 && (hitAt < 0 || i < hitAt + 6); i++) { await B.keyboard.press(i % 3 ? 'KeyX' : 'KeyA'); await sleep(250); if (hitAt < 0 && await B.evaluate(() => window.__mode.sw >= 1)) hitAt = i; }
  await A.evaluate(() => { const a = duel.a; a.control = (e, dt) => e.pad.frame(game.t); });
  await sleep(2500 + lag * 2);
  const hit = await B.evaluate(() => ({ sw: window.__mode.sw, mode: game.player.self.mode, hp: Math.round(game.player.hp), hpMax: game.player.hpMax }));
  const pos3 = [await A.evaluate(() => [Math.round(duel.b.x), Math.round(duel.b.y), duel.b.st]), await B.evaluate(() => [Math.round(game.player.x), Math.round(game.player.y), game.player.st])];
  console.log(`对手 AI 贴身进攻：${JSON.stringify(hit)}，之后 主机 ${JSON.stringify(pos3[0])} / 本地 ${JSON.stringify(pos3[1])}`);
  ok(hit.hp < hit.hpMax && hit.sw >= 2, `LAG ${lag}：挨打时跟随主机、恢复后回到本地操作（切换 ${hit.sw} 次）`, hit);
  ok(hit.mode === 'local' && Math.hypot(pos3[0][0] - pos3[1][0], pos3[0][1] - pos3[1][1]) < 30, `LAG ${lag}：打完停下后本地操作、位置和主机一致`, pos3);
  const errs = dumpErrors(players); ok(!errs.length, '页面没有报错', errs.slice(0, 5));
} catch (e) { ok(false, '异常：' + (e.stack || e)); }
if (process.env.OUT) (await import('node:fs')).writeFileSync(process.env.OUT, JSON.stringify(out));
await close(); await srv.stop();
const r = result(); console.log(`\n${r.total - r.fails}/${r.total} 通过`); process.exit(r.fails ? 1 : 0);
