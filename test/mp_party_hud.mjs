// 组队：按角色名邀请 → 对方接受 → 城镇左侧队伍面板显示 → 点队员移交队长 / 请离；提示走屏幕横幅
import fs from 'node:fs';
import { startServer, launchPlayers, ok, result, sleep, until, uiRegister, uiCreateChar, dumpErrors } from './net_lib.mjs';
const out = 'test/shots/mp_party_hud'; fs.mkdirSync(out, { recursive: true });
const srv = await startServer();
const { players, close } = await launchPlayers(2);
const [A, B] = players.map(p => p.page);
try {
  ok(await uiRegister(A, srv.url, 'alice'), 'alice 注册'); ok(await uiCreateChar(A, 0, '阿丽剑士'), 'alice 建角色');
  ok(await uiRegister(B, srv.url, 'bob'), 'bob 注册'); ok(await uiCreateChar(B, 1, '小鲍枪手'), 'bob 建角色');
  await B.evaluate(() => save.write()); await sleep(2500);   // 等云存档上传：服务端按存档里的角色名查人
  for (const P of [A, B]) await P.evaluate(() => worldTravel('elvenguard'));
  ok(!(await A.evaluate(() => { partyHud.tick(); return !document.getElementById('pthud').hidden; })), '没有队伍时不显示队伍面板');
  // 在队伍窗口里输入角色名邀请
  await A.evaluate(() => menus.open('party')); await sleep(300);
  await A.fill('[data-win="party"] input', '小鲍枪手');
  await A.evaluate(() => [...document.querySelectorAll('[data-win="party"] .btn')].find(b => b.textContent === '邀请').click());
  const banner = await until(A, () => { const b = document.getElementById('toastbar'); return b && !b.hidden && /组队邀请/.test(b.textContent); }, null, 5000);
  ok(banner, '邀请已发出：屏幕中间有提示');
  ok(await until(B, () => menus.isOpen('ask') || [...document.querySelectorAll('.btn')].some(b => b.textContent === '加入队伍'), null, 5000), 'bob 收到组队邀请');
  await B.evaluate(() => [...document.querySelectorAll('.btn')].find(b => b.textContent === '加入队伍').click());
  ok(await until(A, () => netParty.p && netParty.p.members.length === 2, null, 5000), '组队成功（2 人）');
  await sleep(400);
  const hud = await A.evaluate(() => { const el = document.getElementById('pthud'); return { shown: !el.hidden, rows: [...el.querySelectorAll('.pm')].map(r => r.textContent) }; });
  ok(hud.shown && hud.rows.length === 2 && hud.rows.some(t => /♛.*阿丽剑士/.test(t)) && hud.rows.some(t => /小鲍枪手/.test(t)), '城镇左侧显示队伍面板：队长皇冠 + 两名队员', hud.rows);
  ok(await B.evaluate(() => !document.getElementById('pthud').hidden && document.querySelectorAll('#pthud .pm').length === 2), 'bob 那边也显示队伍面板');
  await A.screenshot({ path: `${out}/01-hud.png` });
  // 点 bob 那一行 → 玩家菜单里有“移交队长”
  await A.evaluate(() => [...document.querySelectorAll('#pthud .pm')].find(r => /小鲍枪手/.test(r.textContent)).click());
  await sleep(300);
  const btns = await A.evaluate(() => [...document.querySelectorAll('[data-win="pmenu"] .btn')].map(b => b.textContent));
  ok(btns.includes('移交队长') && btns.includes('请离队伍'), '队长点队员：菜单里有移交队长 / 请离队伍', btns);
  await A.evaluate(() => [...document.querySelectorAll('[data-win="pmenu"] .btn')].find(b => b.textContent === '移交队长').click());
  ok(await until(B, () => netParty.isLeader(), null, 5000), '移交队长：bob 成为队长');
  await sleep(400);
  ok(await A.evaluate(() => [...document.querySelectorAll('#pthud .pm')].some(r => /♛.*小鲍枪手/.test(r.textContent))), '面板上的皇冠移到 bob');
  await A.screenshot({ path: `${out}/02-lead.png` });
  // 自己那一行 → 队伍窗口（离开队伍）
  await A.evaluate(() => [...document.querySelectorAll('#pthud .pm')].find(r => r.classList.contains('me')).click()); await sleep(300);
  ok(await A.evaluate(() => menus.isOpen('party') && [...document.querySelectorAll('[data-win="party"] .btn')].some(b => b.textContent === '离开队伍')), '点自己：打开队伍窗口（可以离开队伍）');
  // 地下城里不显示城镇面板（地下城有自己的血条面板）
  const errs = dumpErrors(players); ok(!errs.length, '页面没有报错', errs);
} catch (e) { ok(false, '异常：' + (e.stack || e)); }
await close(); await srv.stop();
const r = result(); console.log(`\n${r.total - r.fails}/${r.total} 通过`); process.exit(r.fails ? 1 : 0);
