// 组队刷图：网络抖动下队友 / 怪物动得顺不顺（docs/PERF.md）。服务端下行加 LAG 延迟 + 0~JITTER 的随机抖动，
// 队长来回跑（每段 1.2 秒），队员那边逐帧记录队长影子的 x：统计“卡住的帧”（队长在跑、影子这一帧没动）、“跳帧”（一帧走了正常的 2 倍以上）
// 和速度的波动（每帧速度的标准差 / 平均速度）；再反过来看队长那边的队员影子（队员原地不动时应该纹丝不动）。
// 用法：node test/mp_smooth.mjs [LAG=40] [JITTER 列表=0,40,80]   MAXSTALL=百分比：最大那档抖动下卡住的帧比例上限（不设 = 只测量）
import { startServer, launchPlayers, ok, result, sleep, until, uiRegister, uiCreateChar, dumpErrors } from './net_lib.mjs';
const LAG = +(process.argv[2] ?? 40), JITS = (process.argv[3] || '0,40,80').split(',').map(Number), MAXSTALL = process.env.MAXSTALL !== undefined ? +process.env.MAXSTALL : null;
const srv = await startServer(process.env.STATIC ? { static: process.env.STATIC } : {});   // STATIC=目录：测另一份构建（改前 / 改后对照）
const { players, close } = await launchPlayers(2);
const [A, B] = players.map(p => p.page);
const out = {};
try {
  for (const [i, P] of [A, B].entries()) { ok(await uiRegister(P, srv.url, ['alice', 'bob'][i]), `${['alice', 'bob'][i]} 注册`); ok(await uiCreateChar(P, i), '建角色进城'); await P.evaluate(() => { testLoadout(10); save.write(); }); }
  await A.evaluate(n => netPartyInvite(null, n), 'bob');
  await until(B, () => menus.isOpen('nd_pinv'), null, 8000); await B.click('.netask button:has-text("加入队伍")');
  ok(await until(A, () => netParty.p && netParty.p.members.length === 2, null, 8000), '组队');
  await A.evaluate(() => enterDungeon('lorien', 0));
  ok((await Promise.all([A, B].map(P => until(P, () => game.scene === 'dungeon' && coop.state === 'play', null, 30000)))).every(Boolean), '进入地下城');
  // 房间里的怪先清掉（只看队友的移动），双方无敌
  await A.evaluate(() => { for (const e of ents) if (e.team === 'e') { e.hp = 0; e.dead = true; e.remove = true; } setInterval(() => { for (const e of ents) if (e.team === 'e' && !e.dead) { e.remove = true; e.dead = true; } game.player.hp = game.player.hpMax; }, 200); });
  await B.evaluate(() => setInterval(() => { game.player.hp = game.player.hpMax; }, 200));
  await sleep(1500);
  const cfg = srv.app.ctx.cfg;
  for (const jit of JITS) {
    cfg.lagMs = LAG; cfg.jitterMs = jit;
    await sleep(1500);
    // 队员页面：逐帧记下队长影子的 x（和当帧时间）
    await B.evaluate(() => { const g = [...coop.mates.values()][0], W = window.__sm = { xs: [], ts: [], on: true }; const r0 = window.renderWorld; window.__smR0 = window.__smR0 || r0; window.renderWorld = () => { window.__smR0(); if (W.on) { W.xs.push(g.x); W.ts.push(performance.now()); } }; });
    await A.evaluate(() => { const W = window.__hx = { xs: [], ts: [], on: true }; const r0 = window.renderWorld; window.__hxR0 = window.__hxR0 || r0; window.renderWorld = () => { window.__hxR0(); if (W.on) { W.xs.push(game.player.x); W.ts.push(performance.now()); } }; });
    for (let k = 0; k < 4; k++) { const key = k % 2 ? 'ArrowRight' : 'ArrowLeft'; await A.keyboard.down(key); await sleep(1200); await A.keyboard.up(key); await sleep(150); }
    await sleep(400);
    const r = await B.evaluate(() => { const W = window.__sm; W.on = false; return { xs: W.xs, ts: W.ts }; });
    const H = await A.evaluate(() => { window.__hx.on = false; return window.__hx; }), hx = H.xs;
    // 队长自己的每帧速度（px/帧）当“应该的速度”；队员那边影子在动的区间里统计
    const hv = hx.slice(1).map((x, i) => Math.abs(x - hx[i])).filter(v => v > 0.5), sp = hv.sort((a, b) => a - b)[Math.floor(hv.length / 2)] || 1;
    // 每帧速度按帧间隔折算成“每 16.7ms 走多少”（掉帧的那一帧不算跳帧）；只看“应该在动”的帧：前后 6 帧内有明显位移
    const stat = (xs, ts) => {
      const d = xs.slice(1).map((x, i) => Math.abs(x - xs[i]) * 16.7 / Math.max(1, ts[i + 1] - ts[i]));
      const moving = d.map((v, i) => d.slice(Math.max(0, i - 6), i + 7).some(w => w > sp * 0.5));
      const M = d.filter((v, i) => moving[i]), mean = M.reduce((a, b) => a + b, 0) / Math.max(1, M.length), sd = Math.sqrt(M.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, M.length));
      return { frames: M.length, stallPct: +(M.filter(v => v < sp * 0.2).length / Math.max(1, M.length) * 100).toFixed(1), jumpPct: +(M.filter(v => v > sp * 2).length / Math.max(1, M.length) * 100).toFixed(1), cv: +(sd / Math.max(0.01, mean)).toFixed(2) };
    };
    const R = { speed: +sp.toFixed(2), ...stat(r.xs, r.ts), hostCv: stat(hx, H.ts).cv };
    out[jit] = R;
    console.log(`LAG ${LAG}ms + 抖动 0~${jit}ms：队员看队长影子　跑动帧 ${R.frames}，卡住 ${R.stallPct}%，跳帧 ${R.jumpPct}%，速度波动 ${R.cv}（队长自己 ${R.hostCv}，每帧 ${R.speed}px）`);
  }
  if (MAXSTALL !== null) { const J = Math.max(...JITS); ok(out[J].stallPct <= MAXSTALL, `抖动 0~${J}ms：卡住的帧 ${out[J].stallPct}% ≤ ${MAXSTALL}%`, out[J]); }
  const errs = dumpErrors(players); ok(!errs.length, '页面没有报错', errs.slice(0, 5));
} catch (e) { ok(false, '异常：' + (e.stack || e)); }
if (process.env.OUT) (await import('node:fs')).writeFileSync(process.env.OUT, JSON.stringify(out));
await close(); await srv.stop();
const r = result(); console.log(`\n${r.total - r.fails}/${r.total} 通过`); process.exit(r.fails ? 1 : 0);
