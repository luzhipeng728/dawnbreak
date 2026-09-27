// 联机 M3/M5：组队刷图里的断线（2 个玩家；测试服务器的掉线宽限期是 4 秒）
// 队员短断 → 重连后补齐房间和怪物 → 队长短断 → 补发关键事件 → 队员长断 → 离队、主机继续 → 队长长断 → 队员回城
import fs from 'node:fs';
import { startServer, launchPlayers, ok, result, sleep, until, uiRegister, uiCreateChar, dumpErrors } from './net_lib.mjs';
const out = 'test/shots/mp_coop_drop'; fs.mkdirSync(out, { recursive: true });
const srv = await startServer();
const { players, close } = await launchPlayers(2);
const [A, B] = players.map(p => p.page), [cA, cB] = players.map(p => p.ctx);
async function enterTogether() {
  await A.evaluate(() => { const s = Object.keys(SCENES).find(s => SCENES[s].gates.some(g => g.dungeon === 'lorien')); return worldTravel(s); });
  await until(A, () => world && world.S.gates.some(g => g.dungeon === 'lorien'));
  await A.evaluate(() => enterDungeon('lorien', 0));
  return (await until(A, () => coop.state === 'play', null, 30000)) && (await until(B, () => coop.state === 'play', null, 30000));
}
const monCount = P => P.evaluate(() => ents.filter(e => e.team === 'e' && !e.dead).length);
try {
  for (const [i, P] of [A, B].entries()) { await uiRegister(P, srv.url, ['alice', 'bob'][i]); await uiCreateChar(P, i); await P.evaluate(() => { testLoadout(8); save.write(); }); }
  await A.evaluate(() => netPartyInvite(null, 'bob')); await until(B, () => menus.isOpen('nd_pinv')); await B.click('.netask button:has-text("加入队伍")');
  await until(A, () => netParty.p && netParty.p.members.length === 2);
  ok(await enterTogether(), '组队进图');
  // ---- 队员短断 3 秒：期间主机清掉第一个房间并进入下一个 ----
  await B.evaluate(() => net.simDrop(3000));
  ok(await until(A, () => [...coop.mates.values()].some(g => g.lag), null, 5000), '主机看到队员连接中断');
  await A.evaluate(() => { bot.on = true; game.speedMul = 2; });
  ok(await until(A, () => game.dungeon.roomsEntered >= 2 && !game.dungeon.transition, null, 20000), '队员断线期间，主机清房并进入下一个房间');
  await A.evaluate(() => { bot.on = false; game.speedMul = 1; input.virt = {}; });
  const roomA = await A.evaluate(() => coop.rk());
  ok(await until(B, () => net.connected, null, 15000), '队员自动重连');
  ok(await until(B, rk => coop.rk() === rk && !game.dungeon.transition, roomA, 10000), '重连后队员被同步到主机所在的房间', { roomA, roomB: await B.evaluate(() => coop.rk()) });
  await sleep(800);
  const k0 = [await A.evaluate(() => game.dungeon.kills), await B.evaluate(() => game.dungeon.kills)];
  ok(k0[0] === k0[1] && k0[0] > 0, '断线期间错过的击杀补发了（奖励不丢）', k0);
  await sleep(1500);
  ok(await monCount(A) === await monCount(B), '怪物数量一致', [await monCount(A), await monCount(B)]);
  ok(await until(A, () => ![...coop.mates.values()].some(g => g.lag), null, 5000), '主机看到队员恢复');
  // ---- 队长短断 3 秒 ----
  await A.evaluate(() => net.simDrop(3000));
  ok(await until(B, () => coop.hostLag, null, 8000), '队员看到“队长的连接中断了”');
  await B.screenshot({ path: `${out}/01-host-lag.png` });
  await A.evaluate(() => { const m = ents.find(e => e.team === 'e' && !e.dead); if (m) { m.hp = 1; applyHit(game.player, m, { dmg: 99, sure: true }); } });   // 断线期间主机击杀一只怪
  ok(await until(A, () => net.connected, null, 15000), '队长自动重连');
  ok(await until(B, () => !coop.hostLag, null, 10000), '队员看到队长恢复');
  await sleep(1500);
  const k = [await A.evaluate(() => game.dungeon.kills), await B.evaluate(() => game.dungeon.kills)];
  ok(k[0] === k[1] && k[0] > 0, '断线期间的击杀补发给了队员（击杀数一致）', k);
  ok(await monCount(A) === await monCount(B), '怪物数量仍然一致', [await monCount(A), await monCount(B)]);
  // ---- 队员长断（超过宽限期）→ 被移出房间，主机继续；队员重连后回城 ----
  await B.evaluate(() => net.simDrop(9000));
  ok(await until(A, () => coop.mates.size === 0, null, 15000), '队员掉线超时 → 主机那边移除队友，继续打');
  ok(await A.evaluate(() => game.scene === 'dungeon'), '主机还在地下城里');
  ok(await until(B, () => game.scene === 'town' && coop.state === 'none', null, 20000), '队员重连后发现房间没了 → 回城（奖励保留）');
  await B.screenshot({ path: `${out}/02-member-back.png` });
  // 队员重新入队，再来一局，测试队长长断
  await A.evaluate(() => { menus.closeAll(); lootAll(); goTown(); });
  await until(A, () => game.scene === 'town' && coop.state === 'none');
  if (!(await A.evaluate(() => netParty.p && netParty.p.members.length === 2))) {
    await A.evaluate(() => netPartyInvite(null, 'bob')); await until(B, () => menus.isOpen('nd_pinv')); await B.click('.netask button:has-text("加入队伍")');
    await until(A, () => netParty.p && netParty.p.members.length === 2);
  }
  ok(await enterTogether(), '再次组队进图');
  await A.evaluate(() => net.simDrop(9000));
  ok(await until(B, () => game.scene === 'town' && coop.state === 'none', null, 20000), '队长掉线超时 → 房间关闭，队员回城');
  const msg = await B.evaluate(() => [...document.querySelectorAll('.chatline')].map(e => e.textContent).filter(t => /队长/.test(t)).pop());
  ok(/队长/.test(msg || ''), '队员收到提示：' + msg);
  ok(await until(A, () => net.connected, null, 15000), '队长重连');
  ok(await until(A, () => coop.state === 'none', null, 10000), '队长那边：联机断开后地下城继续（单人）');
  const errs = dumpErrors(players);
  ok(!errs.length, '页面没有报错', errs.slice(0, 5));
} catch (e) { ok(false, '异常：' + (e.stack || e)); }
await close(); await srv.stop();
const r = result(); console.log(`\n${r.total - r.fails}/${r.total} 通过`); process.exit(r.fails ? 1 : 0);
