// 联机 M1：账号与云存档（2 个玩家页面）
// 注册（界面）→ 建角色 → 防抖上传 → 另一处登录看到同一份存档 → 两处同时改 → 冲突选择 → 断网改动 → 恢复后自动补传 → 本机角色上传到账号 → 登出回到单机存档
import fs from 'node:fs';
import { startServer, launchPlayers, ok, result, sleep, until, uiRegister, uiLogin, uiCreateChar, dumpErrors } from './net_lib.mjs';
const out = 'test/shots/net_account'; fs.mkdirSync(out, { recursive: true });
const srv = await startServer();
const { players, close } = await launchPlayers(2);
const [A, B] = players.map(p => p.page);
const cloud = uid => srv.app.ctx.mods.saves.read(uid);
try {
  // ---- 标题画面：服务器可用时出现 登录 / 注册 / 不登录直接玩 ----
  await A.goto(srv.url + '?mute'); await A.waitForFunction(() => window.__READY);
  await until(A, () => document.querySelector('#title button') && [...document.querySelectorAll('#title button')].some(b => b.textContent === '注册'));
  const titleBtns = await A.evaluate(() => [...document.querySelectorAll('#title button')].map(b => b.textContent));
  ok(titleBtns.includes('登录') && titleBtns.includes('注册') && titleBtns.includes('不登录直接玩'), '标题：登录 / 注册 / 不登录直接玩', titleBtns);
  await A.screenshot({ path: `${out}/01-title.png` });
  // ---- 先不登录玩：建一个本机角色（之后测试上传到账号）----
  await A.click('#title button:has-text("不登录直接玩")'); await until(A, () => menus.isOpen('charselect'));
  ok(await uiCreateChar(A, 1, '本机枪手'), '不登录：创建本机角色并进城');
  const localKey = await A.evaluate(() => save.key);
  ok(localKey === 'dawnbreak_save_v1', '不登录时用本机存档', localKey);
  await A.evaluate(() => { game.gold = 4321; save.write(); });
  // ---- 注册 ----
  ok(await uiRegister(A, srv.url, 'alice'), '界面注册 alice 并自动登录');
  const imp = await until(A, () => menus.isOpen('nd_import'), null, 5000);
  ok(imp, '第一次登录：提示上传本机角色');
  await A.screenshot({ path: `${out}/02-import.png` });
  await A.click('.netask button:has-text("上传到账号")');
  ok(await until(A, () => menus.isOpen('charselect') && save.chars.length === 1, null, 8000), '上传后进入角色选择，账号里有 1 个角色');
  await sleep(600);
  let c = cloud(1);
  ok(c.data && c.data.chars.length === 1 && c.data.chars[0].name === '本机枪手' && c.data.chars[0].gold === 4321, '服务器上有上传的本机角色', c.data && c.data.chars.map(x => x.name));
  // 建第二个角色并进城
  ok(await uiCreateChar(A, 0, '云端剑士'), '账号里新建角色并进城');
  await A.evaluate(() => { game.gold = 7777; save.write(); });
  const t0 = Date.now();
  ok(await until(A, () => !cloudSave.dirty && !cloudSave.busy, null, 8000), '改动防抖上传完成');
  c = cloud(1);
  ok(c.data.chars.length === 2 && c.data.chars.find(x => x.name === '云端剑士').gold === 7777, '云端存档已更新（金币 7777）', Date.now() - t0);
  // ---- 另一处（B）登录同一个账号：看到同一份存档 ----
  ok(await uiLogin(B, srv.url, 'alice'), 'B 登录 alice');
  await until(B, () => menus.isOpen('charselect') || menus.isOpen('title'));
  if (await B.evaluate(() => menus.isOpen('title'))) await B.click('text=进入游戏');
  ok(await until(B, () => menus.isOpen('charselect') && save.chars.length === 2, null, 8000), 'B 的角色选择里有同样的 2 个角色');
  const bGold = await B.evaluate(() => save.chars.find(x => x.name === '云端剑士').gold);
  ok(bGold === 7777, 'B 读到的金币和 A 一致', bGold);
  await B.screenshot({ path: `${out}/03-B-charselect.png` });
  // ---- 冲突：B 进游戏改金币并上传；A（旧版本）再改 → 409 → 冲突对话框 ----
  await B.evaluate(() => { const i = save.chars.findIndex(x => x.name === '云端剑士'); menus.csSel = i; });
  await B.click('#charsel button:has-text("开始游戏")');
  await until(B, () => game.scene === 'town' && game.player);
  await B.evaluate(() => { game.gold = 11111; save.write(); });
  ok(await until(B, () => !cloudSave.dirty && !cloudSave.busy, null, 8000), 'B 上传 11111');
  await A.evaluate(() => { game.gold = 22222; save.write(); });
  ok(await until(A, () => menus.isOpen('nd_conflict'), null, 8000), 'A 上传时发现冲突 → 弹出选择框');
  await A.screenshot({ path: `${out}/04-conflict.png` });
  await A.click('.netask button:has-text("使用云端存档")');
  ok(await until(A, () => menus.isOpen('charselect') && save.chars.find(x => x.name === '云端剑士').gold === 11111, null, 8000), 'A 选“使用云端存档” → 回到角色选择，金币 = 11111');
  // 再来一次冲突，这次选“用本机覆盖云端”
  await A.evaluate(() => { const i = save.chars.findIndex(x => x.name === '云端剑士'); menus.csSel = i; });
  await A.click('#charsel button:has-text("开始游戏")'); await until(A, () => game.scene === 'town' && game.player);
  await until(A, () => !cloudSave.dirty && !cloudSave.busy, null, 8000);   // 进城本身会存一次档并上传
  // B 此时是旧版本：让 B 先切到最新的云端存档再进游戏改金币
  await B.evaluate(() => cloudSave.useCloud()); await until(B, () => menus.isOpen('charselect'));
  await B.evaluate(() => { menus.csSel = save.chars.findIndex(x => x.name === '云端剑士'); menus.refresh('charselect'); });
  await B.click('#charsel button:has-text("开始游戏")'); await until(B, () => game.scene === 'town' && game.player);
  await B.evaluate(() => { game.gold = 33333; save.write(); }); await sleep(300); await until(B, () => !cloudSave.dirty && !cloudSave.busy, null, 8000);
  await A.evaluate(() => { game.gold = 44444; save.write(); });
  ok(await until(A, () => menus.isOpen('nd_conflict'), null, 8000), '第二次冲突');
  await A.click('.netask button:has-text("用本机覆盖云端")');
  await sleep(1000);
  ok(cloud(1).data.chars.find(x => x.name === '云端剑士').gold === 44444, 'A 选“用本机覆盖云端” → 云端 = 44444');
  // ---- 断网：改动先存本机，恢复后自动补传 ----
  await B.close();
  await players[0].ctx.setOffline(true);
  await A.evaluate(() => { game.gold = 55555; save.write(); });
  await sleep(3500);
  const off = await A.evaluate(() => ({ dirty: cloudSave.dirty, state: cloudSave.state, local: JSON.parse(localStorage.getItem(save.key)).chars.find(x => x.name === '云端剑士').gold }));
  ok(off.dirty && off.local === 55555, '断网：本机缓存已写入、标记待上传', off);
  ok(cloud(1).data.chars.find(x => x.name === '云端剑士').gold === 44444, '断网期间云端没变');
  await players[0].ctx.setOffline(false);
  ok(await until(A, () => !cloudSave.dirty, null, 20000), '恢复网络后自动补传');
  ok(cloud(1).data.chars.find(x => x.name === '云端剑士').gold === 55555, '云端 = 断网时的进度 55555');
  // ---- 刷新页面后仍是登录状态、读到云存档 ----
  await A.reload(); await A.waitForFunction(() => window.__READY);
  ok(await until(A, () => netOn() && menus.isOpen('title') && !!document.querySelector('#title .netacct')), '刷新后保持登录（标题显示账号区）');
  await A.screenshot({ path: `${out}/05-title-loggedin.png` });
  // ---- 系统菜单：账号信息 / 登出 ----
  await A.click('text=进入游戏'); await until(A, () => menus.isOpen('charselect'));
  await A.click('#charsel button:has-text("开始游戏")'); await until(A, () => game.scene === 'town' && game.player);
  await A.evaluate(() => { for (const n of [...menus.stack]) menus.close(n); menus.open('system'); });
  const sysBtns = await A.evaluate(() => [...document.querySelectorAll('.sysmenu button')].map(b => b.textContent));
  ok(sysBtns.some(t => t.startsWith('账号信息')) && sysBtns.includes('登出账号'), '系统菜单有 账号信息 / 登出', sysBtns);
  await A.click('.sysmenu button:has-text("账号信息")'); await until(A, () => menus.isOpen('account'));
  await A.screenshot({ path: `${out}/06-account.png` });
  await A.evaluate(() => menus.close('account'));
  await Promise.all([A.waitForNavigation(), A.evaluate(() => account.logout())]);
  await A.waitForFunction(() => window.__READY);
  ok(await until(A, () => !netOn() && menus.isOpen('title') && save.key === 'dawnbreak_save_v1'), '登出 → 回到标题，存档切回本机');
  const localGold = await A.evaluate(() => { save.loadAll(); return save.chars.map(x => x.name + ':' + x.gold); });
  ok(localGold.length === 1 && localGold[0] === '本机枪手:4321', '本机存档没被账号数据污染', localGold);
  const errs = dumpErrors(players);
  ok(!errs.length, '页面没有报错', errs);
} catch (e) { ok(false, '异常：' + (e.stack || e)); }
await close(); await srv.stop();
const r = result(); console.log(`\n${r.total - r.fails}/${r.total} 通过`); process.exit(r.fails ? 1 : 0);
