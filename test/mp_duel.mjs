// 联机 M4：好友决斗（2 个玩家）：点玩家发起 → 对方接受 → 双方进决斗场 → 对方的键盘输入驱动主机上的角色 → 打完三局两胜 → 各自回城 + pvpResult
import fs from 'node:fs';
import { startServer, launchPlayers, ok, result, sleep, until, uiRegister, uiCreateChar, dumpErrors } from './net_lib.mjs';
const out = 'test/shots/mp_duel'; fs.mkdirSync(out, { recursive: true });
const srv = await startServer();
const { players, close } = await launchPlayers(2);
const [A, B] = players.map(p => p.page);
try {
  for (const [i, P] of [A, B].entries()) { ok(await uiRegister(P, srv.url, ['alice', 'bob'][i]), `${['alice', 'bob'][i]} 注册`); ok(await uiCreateChar(P, i), '建角色进城'); await P.evaluate(() => { window.__pvp = []; bus.on('pvpResult', e => window.__pvp.push(e)); }); }
  for (const P of [A, B]) await P.evaluate(() => worldTravel('elvenguard'));
  await until(A, () => netTown.peers.size === 1, null, 10000);
  const before = await A.evaluate(() => ({ lvl: game.lvl, gold: game.gold, items: inv.items.length, quick: inv.quick.slice() }));
  // alice 点 bob → 发起决斗；bob 接受
  await A.evaluate(() => { const p = [...netTown.peers.values()][0]; netPlayerMenu({ id: p.id, name: p.name, char: p.char }); });
  await A.click('.pmenu button:has-text("发起决斗")');
  ok(await until(B, () => menus.isOpen('nd_duelask'), null, 5000), 'bob 收到决斗邀请');
  await B.screenshot({ path: `${out}/01-ask.png` });
  await B.click('.netask button:has-text("接受决斗")');
  ok(await until(A, () => netDuel.state === 'fight' && game.duel === duel, null, 20000), 'alice（主机）进入决斗场');
  ok(await until(B, () => netDuel.state === 'fight' && game.duel && game.duel.a, null, 20000), 'bob 进入决斗场（对手和自己都显示）');
  await until(A, () => duel.state === 'fight', null, 8000);
  // bob 用键盘：向左走 → 主机上 bob 的角色跟着走
  const bx0 = await A.evaluate(() => duel.b.x);
  await B.keyboard.down('ArrowLeft'); await sleep(600);
  const predicted = await B.evaluate(() => game.player.x);
  await B.keyboard.up('ArrowLeft'); await sleep(400);
  const bx1 = await A.evaluate(() => duel.b.x);
  ok(bx0 - bx1 > 40, 'bob 的方向键驱动主机上的角色移动', { bx0, bx1 });
  const view = await B.evaluate(() => ({ x: game.player.x, ax: game.duel.a.x }));
  ok(Math.abs(view.x - bx1) < 40, 'bob 自己屏幕上的位置和主机一致（预测 + 校正）', { view: view.x, host: bx1, predicted });
  // bob 连按攻击 → 主机上 bob 的角色出招
  await A.evaluate(() => { window.__bActs = 0; const d = duel.b.doAct; duel.b.doAct = function (def, ex) { window.__bActs++; return d.call(this, def, ex); }; });
  for (let i = 0; i < 6; i++) { await B.keyboard.press('KeyX'); await sleep(120); }
  const acted = await A.evaluate(() => window.__bActs > 0);
  ok(acted, 'bob 按 X → 主机上 bob 出招');
  // 之后让主机这边的 alice 交给 AI（测试用），每局 20 秒
  await A.evaluate(() => { DUEL_CFG.time = 20; duel.timer = Math.min(duel.timer, 20); const a = duel.a; a.pad = new Pad(); a.brain = new FighterBrain(a, 2); a.control = (e, dt) => { if (duel.state === 'fight') aiFighterControl(e, dt); else e.pad.frame(game.t); }; });
  await sleep(1200);
  await A.screenshot({ path: `${out}/02-host.png` }); await B.screenshot({ path: `${out}/03-guest.png` });
  // 双方血量同步
  await sleep(1500);
  const hp = [await A.evaluate(() => [Math.round(duel.a.hp), Math.round(duel.b.hp)]), await B.evaluate(() => [Math.round(game.duel.a.hp), Math.round(game.duel.b.hp)])];
  ok(Math.abs(hp[0][0] - hp[1][0]) < hp[0][0] * 0.2 + 500 && Math.abs(hp[0][1] - hp[1][1]) < hp[0][1] * 0.2 + 500, '双方看到的血量一致', hp);
  // bob 乱按直到决斗结束（最多 3 局 × 20 秒）
  const keys = ['KeyX', 'KeyX', 'KeyC', 'KeyZ', 'ArrowLeft', 'ArrowRight', 'KeyA', 'KeyS'];
  for (let i = 0; i < 400; i++) {
    if (await A.evaluate(() => netDuel.state !== 'fight')) break;
    const k = keys[i % keys.length]; await B.keyboard.down(k); await sleep(60); await B.keyboard.up(k); await sleep(60);
  }
  ok(await until(A, () => netDuel.state === 'end' || netDuel.state === 'none', null, 90000), '决斗打完');
  await sleep(500); await A.screenshot({ path: `${out}/04-end-host.png` }); await B.screenshot({ path: `${out}/05-end-guest.png` });
  const back = [await until(A, () => game.scene === 'town' && netDuel.state === 'none' && !game.pvp, null, 15000), await until(B, () => game.scene === 'town' && netDuel.state === 'none' && !game.pvp, null, 15000)];
  ok(back.every(Boolean), '双方自动回城', back);
  const res = [await A.evaluate(() => window.__pvp), await B.evaluate(() => window.__pvp)];
  ok(res[0].length === 1 && res[1].length === 1, 'pvpResult 事件各发一次', res);
  if (res[0][0] && res[1][0]) ok(res[0][0].draw ? res[1][0].draw : res[0][0].win !== res[1][0].win, '胜负一致（一方赢一方输）', res);
  ok(res[0][0] && res[0][0].vs === 'bob' && res[1][0].vs === 'alice', 'pvpResult.vs 是对方用户名');
  const after = await A.evaluate(() => ({ lvl: game.lvl, gold: game.gold, items: inv.items.length, quick: inv.quick.slice() }));
  ok(JSON.stringify(after) === JSON.stringify(before), '决斗不影响等级 / 金币 / 背包 / 快捷栏', { before, after });
  ok(await A.evaluate(() => save.live && !!save.data), '回城后存档恢复正常写入');
  const errs = dumpErrors(players);
  ok(!errs.length, '页面没有报错', errs.slice(0, 5));
} catch (e) { ok(false, '异常：' + (e.stack || e)); }
await close(); await srv.stop();
const r = result(); console.log(`\n${r.total - r.fails}/${r.total} 通过`); process.exit(r.fails ? 1 : 0);
