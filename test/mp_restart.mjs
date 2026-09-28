// 联机：服务器重启（kill -9 再拉起，同端口同数据库）后，组队刷图和好友决斗都接着玩，不回城（2 个玩家）
import fs from 'node:fs';
import { startServerProc, launchPlayers, ok, result, sleep, until, uiRegister, uiCreateChar, dumpErrors } from './net_lib.mjs';
const out = 'test/shots/mp_restart'; fs.mkdirSync(out, { recursive: true });
const srv = await startServerProc();
const { players, close } = await launchPlayers(2);
const [A, B] = players.map(p => p.page);
const kills = () => Promise.all([A.evaluate(() => game.dungeon && game.dungeon.kills), B.evaluate(() => game.dungeon && game.dungeon.kills)]);
try {
  for (const [i, P] of [A, B].entries()) { await uiRegister(P, srv.url, ['alice', 'bob'][i]); await uiCreateChar(P, i); await P.evaluate(() => { testLoadout(8); save.write(); }); }
  await A.evaluate(() => netPartyInvite(null, 'bob')); await until(B, () => menus.isOpen('nd_pinv')); await B.click('.netask button:has-text("加入队伍")');
  ok(await until(A, () => netParty.p && netParty.p.members.length === 2), '组队');
  await A.evaluate(() => { const s = Object.keys(SCENES).find(s => SCENES[s].gates.some(g => g.dungeon === 'lorien')); return worldTravel(s); });
  await until(A, () => world && world.S.gates.some(g => g.dungeon === 'lorien'));
  await A.evaluate(() => enterDungeon('lorien', 0));
  ok(await until(B, () => coop.state === 'play' && game.scene === 'dungeon', null, 30000), '组队进图');
  await sleep(1500);
  const room0 = await B.evaluate(() => coop.room && coop.room.id);
  // ---- 杀掉服务端进程，1.5 秒后拉起 ----
  await srv.kill();
  await sleep(1500);
  ok(await A.evaluate(() => !net.connected) && await B.evaluate(() => !net.connected), '服务端挂了：双方都断开');
  await srv.up();
  ok(await until(A, () => net.connected, null, 20000) && await until(B, () => net.connected, null, 20000), '服务端拉起后双方自动重连');
  ok(await until(B, id => coop.state === 'play' && coop.room && coop.room.id !== id && !coop.hostLag, room0, 25000), '队员重新加入了恢复后的房间（没有回城）', await B.evaluate(() => ({ st: coop.state, room: coop.room && coop.room.id, scene: game.scene })));
  ok(await until(A, () => coop.state === 'play' && coop.mates.size === 1 && ![...coop.mates.values()][0].lag, null, 15000), '队长那边队友恢复（不再是断线状态）');
  ok(await until(A, () => netParty.p && netParty.p.members.length === 2, null, 10000) && await until(B, () => netParty.p && netParty.p.members.length === 2, null, 10000), '队伍恢复（2 人）');
  const s0 = await B.evaluate(() => coop.stats.snaps); await sleep(1200);
  ok(await B.evaluate(s => coop.stats.snaps > s + 10, s0), '主机的快照照常到达队员');
  await A.evaluate(() => { const m = ents.find(e => e.team === 'e' && !e.dead); if (m) { m.hp = 1; applyHit(game.player, m, { dmg: 99, sure: true }); } });
  await sleep(1200);
  const k = await kills();
  ok(k[0] === k[1] && k[0] > 0, '恢复后击杀照常同步（奖励各拿各的）', k);
  ok(await A.evaluate(() => game.scene === 'dungeon') && await B.evaluate(() => game.scene === 'dungeon'), '双方都还在地下城里');
  await B.screenshot({ path: `${out}/01-coop-restored.png` });
  // 回城，准备决斗
  await B.evaluate(() => { menus.closeAll(); lootAll(); goTown(); }); await A.evaluate(() => { menus.closeAll(); lootAll(); goTown(); });
  await until(A, () => game.scene === 'town' && coop.state === 'none'); await until(B, () => game.scene === 'town' && coop.state === 'none');
  for (const P of [A, B]) await P.evaluate(() => worldTravel('elvenguard'));
  await until(A, () => netTown.peers.size === 1, null, 10000);
  await A.evaluate(() => { const p = [...netTown.peers.values()][0]; netDuelAsk({ id: p.id, name: p.acct, char: p.char }); });
  await until(B, () => menus.isOpen('nd_duelask'), null, 5000); await B.click('.netask button:has-text("接受决斗")');
  ok(await until(A, () => netDuel.state === 'fight' && duel.state === 'fight', null, 25000) && await until(B, () => netDuel.state === 'fight', null, 20000), '决斗开始');
  const droom = await B.evaluate(() => netDuel.room.id);
  await srv.kill(); await sleep(1500);
  ok(await until(A, () => game.paused, null, 3000), '服务端挂了：主机那边决斗暂停（对方没法操作，不白挨打）');
  const t0 = await A.evaluate(() => duel.timer);
  await srv.up();
  ok(await until(B, id => netDuel.state === 'fight' && netDuel.resumed && netDuel.room.id !== id, droom, 30000), '重连后决斗房间恢复（对方）');
  ok(await until(A, () => netDuel.resumed && !netDuel.peerLag && !game.paused, null, 20000), '主机恢复并继续（取消暂停）');
  const bx0 = await A.evaluate(() => duel.b.x);
  await B.keyboard.down('ArrowLeft'); await sleep(700); await B.keyboard.up('ArrowLeft'); await sleep(300);
  const bx1 = await A.evaluate(() => duel.b.x);
  ok(Math.abs(bx1 - bx0) > 30, '恢复后对方的按键照常驱动主机上的角色', { bx0, bx1 });
  const t1 = await A.evaluate(() => duel.timer);
  ok(t0 - t1 < 8, '断线期间决斗计时没有白白走掉', { t0, t1 });
  await B.screenshot({ path: `${out}/02-duel-restored.png` });
  const errs = dumpErrors(players).filter(e => !/WebSocket|ERR_CONNECTION|net::/.test(e));
  ok(!errs.length, '页面没有报错', errs.slice(0, 5));
} catch (e) { ok(false, '异常：' + (e.stack || e)); }
await close(); await srv.stop();
const r = result(); console.log(`\n${r.total - r.fails}/${r.total} 通过`); process.exit(r.fails ? 1 : 0);
