// 寻找好友：按角色名加好友 → 好友列表“前往”（跨区域自动走到好友身边）→ 聊天 /找 名字 → 方向键取消
import fs from 'node:fs';
import { startServer, launchPlayers, ok, result, sleep, until, uiRegister, uiCreateChar, dumpErrors } from './net_lib.mjs';
const out = 'test/shots/findfriend'; fs.mkdirSync(out, { recursive: true });
const srv = await startServer();
const { players, close } = await launchPlayers(2);
const [A, B] = players.map(p => p.page);
try {
  ok(await uiRegister(A, srv.url, 'alice'), 'alice 注册');
  ok(await uiCreateChar(A, 0, '阿丽剑士'), 'alice 建角色');
  ok(await uiRegister(B, srv.url, 'bob'), 'bob 注册');
  ok(await uiCreateChar(B, 1, '小鲍枪手'), 'bob 建角色');
  await B.evaluate(() => save.write()); await sleep(2500);   // 等云存档上传：服务端按存档里的角色名查人
  // 按角色名加好友
  const add = await A.evaluate(async () => { await netFriends.add('小鲍枪手'); await new Promise(r => setTimeout(r, 400)); return netFriends.outgoing.map(f => f.name); });
  ok(add.includes('bob'), 'alice 输入角色名“小鲍枪手”→ 向账号 bob 发出好友申请', add);
  await B.evaluate(() => netFriends.accept('alice'));
  ok(await until(A, () => { netFriends.load(); return netFriends.isFriend(2); }, null, 6000), '成为好友');
  // bob 去另一个区域（从艾尔文防线出发要过门的地方）
  await A.evaluate(() => worldTravel('elvenguard'));
  await until(A, () => world && world.S.id === 'elvenguard');
  const target = await A.evaluate(() => ['seria_room', 'lorien', 'hendon_myre'].find(id => SCENES[id] && (guide.route('elvenguard', id) || []).length >= 1));
  ok(!!target, `目标区域 ${target}（从艾尔文防线有路）`);
  await B.evaluate(id => worldTravel(id), target);
  await until(B, id => world && world.S.id === id, target);
  await B.evaluate(() => { game.player.x = Math.min(world.S.width - 300, 700); game.player.y = 80; });
  await sleep(1500);
  // 好友列表“前往”
  await A.evaluate(() => { netFriends.load(); });
  await sleep(800);
  await A.evaluate(() => menus.open('friends')); await sleep(500);
  const btn = await A.evaluate(() => { const b = [...document.querySelectorAll('[data-win="friends"] .btn')].find(x => x.textContent === '前往'); if (b) b.click(); return !!b; });
  ok(btn, '好友列表里在线好友有“前往”按钮');
  ok(await A.evaluate(() => guide.follow && guide.auto && !menus.isOpen('friends')), '点了开始自动前往，好友窗口关闭');
  await sleep(1200); await A.screenshot({ path: `${out}/01-going.png` });
  const arrived = await until(A, id => world.S.id === id && !guide.follow && netTown.peers.has(2) && Math.abs(game.player.x - netTown.peers.get(2).x) < 70, target, 90000);
  const st = await A.evaluate(() => ({ scene: world.S.id, px: Math.round(game.player.x), bx: netTown.peers.get(2) && Math.round(netTown.peers.get(2).x), follow: !!guide.follow }));
  ok(arrived, `跨区域走到好友身边（${target}）`, st);
  await A.screenshot({ path: `${out}/02-arrived.png` });
  // 同区域：bob 走远，alice 用聊天 /找 小鲍枪手
  await B.evaluate(() => { game.player.x = world.S.width > 1200 ? 150 : 100; });
  await sleep(1200);
  await A.evaluate(() => { game.player.x = world.S.width - 200; });
  await sleep(300);
  await A.evaluate(() => chat.sendText('/找 小鲍枪手'));
  ok(await A.evaluate(() => !!guide.follow && guide.auto), '聊天 /找 小鲍枪手：开始自动前往');
  ok(await until(A, () => !guide.follow && Math.abs(game.player.x - netTown.peers.get(2).x) < 70, null, 60000), '同区域走到 bob 身边');
  // 方向键取消
  await B.evaluate(() => { game.player.x = world.S.width - 150; }); await sleep(1000);
  await A.evaluate(() => chat.sendText('/f bob'));
  await sleep(600);
  await A.keyboard.down('ArrowLeft'); await sleep(150); await A.keyboard.up('ArrowLeft');
  ok(await A.evaluate(() => !guide.follow && !guide.auto), '按方向键取消自动前往');
  // 找不到的人
  await A.evaluate(() => chat.sendText('/找 不存在的人'));
  ok(await A.evaluate(() => !guide.follow), '找不到的名字：提示，不会乱走');
  const errs = dumpErrors(players); ok(!errs.length, '页面没有报错', errs);
} catch (e) { ok(false, '异常：' + (e.stack || e)); }
await close(); await srv.stop();
const r = result(); console.log(`
${r.total - r.fails}/${r.total} 通过`); process.exit(r.fails ? 1 : 0);
