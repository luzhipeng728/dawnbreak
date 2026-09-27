// 联机 M2：城镇同屏 + 聊天 + 好友 + 组队邀请（3 个玩家页面）
import fs from 'node:fs';
import { startServer, launchPlayers, ok, result, sleep, until, uiRegister, uiCreateChar, dumpErrors } from './net_lib.mjs';
const out = 'test/shots/mp_town'; fs.mkdirSync(out, { recursive: true });
const srv = await startServer();
const { players, close } = await launchPlayers(3);
const [A, B, C] = players.map(p => p.page);
const names = ['alice', 'bob', 'carol'], chars = ['阿丽剑士', '小鲍枪手', '卡萝法师'];
try {
  for (let i = 0; i < 3; i++) {
    const P = players[i].page;
    ok(await uiRegister(P, srv.url, names[i]), `${names[i]} 注册登录`);
    ok(await uiCreateChar(P, i, chars[i]), `${names[i]} 创建角色 ${chars[i]} 进城`);
  }
  // 都去艾尔文防线（同一个场景）
  for (const P of [A, B, C]) await P.evaluate(() => worldTravel('elvenguard'));
  for (const P of [A, B, C]) await until(P, () => world && world.S.id === 'elvenguard');
  await A.evaluate(() => { game.player.x = 900; game.player.y = 110; });
  await B.evaluate(() => { game.player.x = 1000; game.player.y = 90; });
  await C.evaluate(() => { game.player.x = 1100; game.player.y = 130; });
  const seeAll = await until(A, () => netTown.peers.size === 2 && [...netTown.peers.values()].every(p => p.char && p.model), null, 10000);
  ok(seeAll, 'alice 看到另外 2 个玩家（带角色信息和模型）', await A.evaluate(() => [...netTown.peers.values()].map(p => p.char && p.char.name)));
  ok(await until(B, () => netTown.peers.size === 2), 'bob 也看到 2 个玩家');
  const info = await A.evaluate(() => [...netTown.peers.values()].map(p => ({ n: p.char.name, cls: p.char.cls, lv: p.char.lvl, wpn: p.char.look && p.char.look.wpn })));
  ok(info.some(x => x.n === '小鲍枪手' && x.cls === 'gun') && info.some(x => x.n === '卡萝法师' && x.cls === 'mage'), '名字 / 职业正确', info);
  // bob 用键盘走动 → alice 看到的位置跟上（插值平滑）
  await sleep(500);
  const b0 = await B.evaluate(() => game.player.x);
  await B.keyboard.down('ArrowRight'); await sleep(1200); await B.keyboard.up('ArrowRight'); await sleep(600);
  const bx = await B.evaluate(() => game.player.x);
  const seen = await A.evaluate(() => { const p = [...netTown.peers.values()].find(p => p.char.name === '小鲍枪手'); return { x: p.x, st: p.st, face: p.face }; });
  ok(bx - 150 > b0 && Math.abs(seen.x - bx) < 6, 'bob 走动后 alice 看到的位置跟上', { b0, bx, seen });
  // 平滑：采样 alice 看到的 bob 位置，不应该有跳变
  await B.keyboard.down('ArrowLeft');
  // 按游戏逻辑时间（game.t，固定 60Hz 步长）算速度：浏览器负载高时一帧可能跑好几步，用真实时间算会误报
  const samples = await A.evaluate(async () => { const p = [...netTown.peers.values()].find(p => p.char.name === '小鲍枪手'), xs = []; for (let i = 0; i < 60; i++) { await new Promise(r => requestAnimationFrame(r)); xs.push([game.t * 1000, p.x]); } return xs; });
  await B.keyboard.up('ArrowLeft');
  const speeds = [0]; for (let i = 1; i < samples.length; i++) { const dt = samples[i][0] - samples[i - 1][0]; if (dt > 1) speeds.push(Math.abs(samples[i][1] - samples[i - 1][1]) / dt * 1000); }
  ok(Math.max(...speeds) < 400, '插值平滑：看到的移动速度没有跳变（< 400 像素/秒，走路约 165）', { max: Math.max(...speeds).toFixed(0) });
  await A.screenshot({ path: `${out}/01-alice-sees.png` });
  // 名牌扩展点：其他组定义 netPlayerTag(userId)（例如公会名），画在职业那行前面
  const tagged = await A.evaluate(() => { window.netPlayerTag = id => id === 2 ? '破晓' : null; const p = [...netTown.peers.values()].find(p => p.id === 2); return p.guild; });
  ok(/^<破晓> /.test(tagged), '名牌扩展点 netPlayerTag：公会名显示在职业前', tagged);
  await sleep(200); await A.screenshot({ path: `${out}/01b-tag.png` });
  await A.evaluate(() => { delete window.netPlayerTag; });
  // 换装后外观同步：给 bob 换一把武器
  const wpnB = await B.evaluate(() => { const it = inv.items.find(x => x.slot === 'weapon' || (x.kind === 'equip' && x.slot === 'weapon')); return it ? it.key : null; });
  // 离开场景：carol 去另一个场景 → alice 那边消失
  await C.evaluate(() => worldTravel('hendon_myre'));
  ok(await until(A, () => netTown.peers.size === 1, null, 6000), 'carol 离开场景 → alice 那边只剩 bob');
  await C.evaluate(() => worldTravel('elvenguard'));
  ok(await until(A, () => netTown.peers.size === 2, null, 8000), 'carol 回来 → 又看到');
  // ---- 聊天 ----
  await A.keyboard.press('Enter');
  ok(await A.evaluate(() => document.activeElement && document.activeElement.classList.contains('chatinp')), '回车打开聊天输入框');
  const ax0 = await A.evaluate(() => game.player.x);
  await A.keyboard.type('大家好 ArrowRight xxx'); await A.keyboard.down('ArrowRight'); await sleep(300); await A.keyboard.up('ArrowRight');
  ok(Math.abs(await A.evaluate(() => game.player.x) - ax0) < 1, '输入框聚焦时游戏按键无效（角色不动）');
  await A.evaluate(() => { chat.inp.value = '大家好'; });
  await A.keyboard.press('Enter');
  ok(await until(B, () => [...document.querySelectorAll('.chatline')].some(e => e.textContent.includes('大家好') && e.textContent.includes('[世界]')), null, 5000), '世界频道：bob 收到');
  ok(await until(C, () => [...document.querySelectorAll('.chatline')].some(e => e.textContent.includes('大家好')), null, 5000), '世界频道：carol 收到');
  ok(!(await A.evaluate(() => chat.open)), '发送后回车收起输入框');
  await A.evaluate(() => chat.sendText('/w bob 悄悄话测试'));
  ok(await until(B, () => [...document.querySelectorAll('.chatline')].some(e => e.textContent.includes('悄悄话测试') && e.textContent.includes('对你说')), null, 5000), '私聊：bob 收到');
  await sleep(500);
  ok(!(await C.evaluate(() => [...document.querySelectorAll('.chatline')].some(e => e.textContent.includes('悄悄话测试')))), '私聊：carol 收不到');
  await B.evaluate(() => chat.sendText('/r 收到了'));
  ok(await until(A, () => [...document.querySelectorAll('.chatline')].some(e => e.textContent.includes('收到了')), null, 5000), '/r 回复私聊');
  await A.screenshot({ path: `${out}/02-chat.png` });
  // ---- 点击玩家 → 菜单 → 加好友 ----
  await A.evaluate(() => { const p = [...netTown.peers.values()].find(p => p.char.name === '小鲍枪手'); game.player.x = p.x - 150; });
  await sleep(300);
  const pt = await A.evaluate(() => { const p = [...netTown.peers.values()].find(p => p.char.name === '小鲍枪手'); const r = wcan.getBoundingClientRect(); return { x: r.left + (p.x - cam.x) / WW * r.width, y: r.top + (FLOOR_Y + p.y - 50) / WH * r.height }; });
  await A.mouse.click(pt.x, pt.y);
  ok(await until(A, () => menus.isOpen('pmenu'), null, 3000), '点击玩家弹出菜单');
  await A.screenshot({ path: `${out}/03-pmenu.png` });
  await A.click('.pmenu button:has-text("加为好友")');
  ok(await until(B, () => menus.isOpen('nd_freq1'), null, 5000), 'bob 收到好友申请提示');
  await B.click('.netask button:has-text("同意")');
  ok(await until(A, () => netFriends.isFriend(2) && netFriends.list[0].online, null, 5000), 'alice 的好友列表有 bob（在线）');
  await A.evaluate(() => menus.show('friends'));
  await sleep(300); await A.screenshot({ path: `${out}/04-friends.png` });
  const frText = await A.evaluate(() => document.querySelector('.frlist').textContent);
  ok(frText.includes('bob') && frText.includes('艾尔文防线'), '好友窗口显示在线状态和位置', frText.slice(0, 120));
  await A.evaluate(() => menus.close('friends'));
  // ---- 组队邀请 ----
  await A.evaluate(() => netPartyInvite(2, 'bob'));
  ok(await until(B, () => menus.isOpen('nd_pinv'), null, 5000), 'bob 收到组队邀请');
  await B.click('.netask button:has-text("加入队伍")');
  ok(await until(A, () => netParty.p && netParty.p.members.length === 2 && netParty.isLeader(), null, 5000), '组队成功，alice 是队长');
  await A.evaluate(() => netPartyInvite(3, 'carol'));
  await until(C, () => menus.isOpen('nd_pinv'), null, 5000);
  await C.click('.netask button:has-text("拒绝")');
  ok(await until(A, () => [...document.querySelectorAll('.chatline')].some(e => e.textContent.includes('carol 拒绝了组队邀请')), null, 5000), 'carol 拒绝 → alice 收到提示');
  await B.evaluate(() => chat.sendText('/p 队伍频道测试'));
  ok(await until(A, () => [...document.querySelectorAll('.chatline')].some(e => e.textContent.includes('队伍频道测试') && e.textContent.includes('[队伍]')), null, 5000), '队伍频道');
  await sleep(300);
  ok(!(await C.evaluate(() => [...document.querySelectorAll('.chatline')].some(e => e.textContent.includes('队伍频道测试')))), '队伍频道：队外的人收不到');
  await A.evaluate(() => menus.show('party')); await sleep(300);
  await A.screenshot({ path: `${out}/05-party.png` });
  ok(await A.evaluate(() => document.querySelectorAll('.ptrow').length === 2), '队伍窗口列出 2 个队员');
  // 队友名牌颜色（橙）：画一帧看看不报错
  await A.evaluate(() => menus.close('party'));
  // 断线重连：bob 断网 3 秒 → 自动重连，alice 仍然看得到
  await players[1].ctx.setOffline(true); await sleep(2500); await players[1].ctx.setOffline(false);
  ok(await until(B, () => net.connected, null, 15000), 'bob 断网后自动重连');
  ok(await until(A, () => netTown.peers.size === 2 && netParty.p && netParty.p.members.every(m => m.online), null, 10000), '重连后 alice 仍看到 bob，队伍还在');
  // 性能：3 个玩家同屏时的帧时间（画一段时间取 fps）
  const fpsA = await A.evaluate(async () => { const t0 = performance.now(); let n = 0; while (performance.now() - t0 < 2000) { await new Promise(r => requestAnimationFrame(r)); n++; } return n / 2; });
  ok(fpsA > 25, `同屏帧率（无头浏览器 3 页同时跑）${fpsA.toFixed(0)} fps`);
  const errs = dumpErrors(players);
  ok(!errs.length, '页面没有报错', errs);
} catch (e) { ok(false, '异常：' + (e.stack || e)); }
await close(); await srv.stop();
const r = result(); console.log(`\n${r.total - r.fails}/${r.total} 通过`); process.exit(r.fails ? 1 : 0);
