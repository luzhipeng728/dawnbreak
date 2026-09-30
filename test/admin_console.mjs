// 后台管理页面 /admin/ 的无头浏览器测试：本地服务端（临时数据库，托管 dist/web）→ 普通玩家登录被拒 → 管理员登录 → 逐个页签打开并截图 →
// 账号详情里封禁一个玩家 → 发一封点券超过单封上限 + 物品带强化的邮件 → 发公告 → 窄屏（手机）再看一遍；检查页面报错 / CSP 拦截 / 角色名里的 HTML 没有被当成标签
// 截图：test/shots/admin/*.png   用法：node build.mjs --web && node test/admin_console.mjs（worktree 里要先软链 server/node_modules）
import fs from 'node:fs';
import { startServer, ok, result, sleep } from './net_lib.mjs';
import { chromium } from './lib.mjs';

const OUT = new URL('./shots/admin/', import.meta.url).pathname;
fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
const S = await startServer({ admins: ['alice'], httpRate: [100000, 10] });
S.app.ctx.log = () => {};
const BASE = S.url.replace('/index.html', '');
const api = async (method, p, body, token) => {
  const r = await fetch(BASE + p, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, ...(await r.json().catch(() => ({}))) };
};
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await chromium.launch({ headless: true, executablePath: CHROME });
const errs = [];
const watch = page => {
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/fonts\.(googleapis|gstatic)\.com|Failed to load resource/.test(m.text())) errs.push('console: ' + m.text()); });
};
const socks = [];
let cur = null;
// 切页签：等导航高亮切过去（hashchange 是异步的，直接等选择器可能等到上一页的表格），再等本页的内容
const tab = async (page, id, sel) => { await page.click(`.nav a[data-tab=${id}]`); await page.waitForSelector(`.nav a.on[data-tab=${id}]`); await page.waitForSelector('.view ' + sel); };
try {
  // ---- 造数据：5 个账号（同一个 IP）、存档（含格斗家）、一条客户端报错、两个在线玩家 ----
  const T = {};
  for (const u of ['alice', 'bob', 'carol', 'dave', 'eve']) T[u] = (await api('POST', '/api/register', { user: u, pass: 'secret123' })).token;
  const save = (tok, chars, cera = 0) => api('PUT', '/api/saves', { baseUpdatedAt: 0, data: { v: 4, cur: 0, acct: { cera }, chars } }, tok);
  const ch = (cls, job, name, lvl, gold, equip = {}) => ({ cls, job, name, lvl, gold, inv: [{ key: 'fatigue', n: 3 }, { key: 'hpM', n: 20 }], storage: [], equip, created: Date.now() });
  await save(T.bob, [ch('fighter', 'striker', '拳王', 45, 58000, { weapon: { key: 'ep_katana', name: '冠军拳套', rar: 5, enh: 12 }, top: { key: 'x', name: '稀有上衣', rar: 2, enh: 7 } }), ch('sword', 'berserker', '血狱狂战', 60, 1200000)], 99000);
  await save(T.carol, [ch('gun', 'ranger', '漫游小枪', 60, 320000), ch('mage', 'enchantress', '小魔女', 38, 5000)], 1200);
  await save(T.dave, [ch('fighter', null, '新人格斗', 8, 900)]);
  await save(T.eve, [ch('sword', null, '<img src=x onerror=alert(1)>', 3, 10)]);
  await api('POST', '/api/cerr', { where: 'town.step', msg: 'Cannot read properties of undefined (reading \'x\')', stack: 'TypeError: boom\n    at step (game.js:1:1)', ver: 'abc123' }, T.carol);
  await api('POST', '/api/gm/notice', { text: '欢迎来到破晓地下城' }, T.alice);
  for (const u of ['bob', 'carol']) {
    const ws = new WebSocket(BASE.replace('http', 'ws') + '/ws'); socks.push(ws);
    ws.onopen = () => { ws.send(JSON.stringify({ t: 'auth', token: T[u], ver: 1, build: 't' })); setTimeout(() => ws.send(JSON.stringify({ t: 'hello', char: { name: u === 'bob' ? '拳王' : '漫游小枪', cls: u === 'bob' ? 'fighter' : 'gun', job: u === 'bob' ? 'striker' : 'ranger', lvl: u === 'bob' ? 45 : 60 } })), 100); setTimeout(() => ws.send(JSON.stringify({ t: 'scene', id: 'hm_plaza', x: 100, y: 80, f: 1 })), 150); };
  }
  await sleep(500);

  // ---- 桌面 ----
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage(); watch(page); cur = page;
  const shot = async name => { await sleep(250); await page.screenshot({ path: OUT + name + '.png', fullPage: true }); };
  await page.goto(BASE + '/admin/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.login form');
  await shot('00-login');
  await page.fill('input[name=user]', 'bob'); await page.fill('input[name=pass]', 'secret123'); await page.click('.login button[type=submit]');
  ok(await page.waitForFunction(() => /不是管理员/.test(document.querySelector('.login .err').textContent), null, { timeout: 8000 }).then(() => true, () => false), '普通玩家登录后台被拒绝');
  await page.fill('input[name=user]', 'alice'); await page.fill('input[name=pass]', 'secret123'); await page.click('.login button[type=submit]');
  await page.waitForSelector('.kpis .kpi');
  const kpi = await page.locator('.kpis .kpi .v').allTextContents();
  ok(kpi[0] === '5' && kpi[1] === '5' && kpi[2] === '2', '概况：注册 5、今日新增 5、在线 2', kpi);
  ok(await page.locator('.hcls .t:has-text("格斗家")').count() === 1 && await page.locator('.hbar:has-text("散打")').count() === 1, '职业分布里有格斗家 / 散打');
  ok(await page.locator('.chart svg rect.bar').count() === 30, '近 30 天注册图');
  await shot('01-dash');

  await tab(page, 'users', '.t tbody tr[data-id]');
  ok(await page.locator('.t tbody tr[data-id]').count() === 5, '账号列表 5 行');
  ok(await page.locator('img[src="x"]').count() === 0 && (await page.locator('.t tbody').textContent()).includes('Lv3'), '角色名里的 HTML 没有被当成标签');
  await page.fill('input[type=search]', '拳王'); await page.waitForFunction(() => document.querySelectorAll('.t tbody tr[data-id]').length === 1);
  ok(true, '按角色名搜索');
  await page.fill('input[type=search]', ''); await page.waitForFunction(() => document.querySelectorAll('.t tbody tr[data-id]').length === 5);
  await page.click('th.sort:has-text("金币")'); await page.waitForFunction(() => document.querySelector('.t tbody tr[data-id] td:nth-child(2)').textContent === 'bob');
  ok(true, '按金币排序');
  await shot('02-users');
  await page.click('.t tbody tr[data-id]:has-text("bob")'); await page.waitForSelector('.drawer .charc');
  ok(await page.locator('.drawer .charc').count() === 2 && (await page.locator('.drawer').textContent()).includes('+12 冠军拳套'), '账号详情：角色和装备');
  await page.screenshot({ path: OUT + '03-user-detail.png' });
  await page.click('.drawer .acts button:has-text("封禁")'); await page.waitForSelector('.modal');
  await page.fill('.modal input', '测试：刷屏');
  await page.screenshot({ path: OUT + '04-ban-confirm.png' });
  await page.click('.modal .mf button.danger');
  await page.waitForSelector('.drawer .tag.bad');
  ok((await api('POST', '/api/login', { user: 'bob', pass: 'secret123' })).status === 403, '界面上封禁 bob 后 bob 不能登录');
  await page.click('.drawer .acts button:has-text("删除账号")'); await page.waitForSelector('.modal.danger');
  ok(await page.locator('.modal .mf button.danger').isDisabled(), '删除：没输用户名时按钮不可点');
  await page.fill('.modal input', 'bob');
  ok(!(await page.locator('.modal .mf button.danger').isDisabled()), '删除：输对用户名后才能点');
  await page.screenshot({ path: OUT + '05-delete-confirm.png' });
  await page.click('.modal .mf button.ghost');
  await page.keyboard.press('Escape'); await page.waitForSelector('.drawer', { state: 'detached' });

  await tab(page, 'regs', '.t tbody tr.flag');
  ok(await page.locator('.tag.bad:has-text("同 IP ×5")').count() === 5, '注册记录：同一个 IP 的 5 个账号都标出来了');
  await shot('06-regs');

  await tab(page, 'mail', '.picker');
  await page.fill('textarea[placeholder^="账号名"]', 'carol, dave');
  await page.fill('input[placeholder^="邮件标题"]', '开服补偿');
  await page.fill('textarea[placeholder^="正文"]', '感谢大家支持！');
  await page.fill('input[type=number][max="200000000"]', '25000000');
  await page.fill('.picker input[type=search]', '抗疲劳'); await page.waitForSelector('.pres .it');
  await page.click('.pres .it >> nth=0');
  await page.fill('.picker input[type=search]', 'ep_katana@12'); await page.press('.picker input[type=search]', 'Enter');
  await page.waitForFunction(() => document.querySelectorAll('.att .a').length === 2);
  ok((await page.locator('.att .a').nth(1).locator('input').nth(1).inputValue()) === '12', '输入 key@12 回车：加上 +12 的装备');
  await shot('07-mail');
  await page.click('button:has-text("预览并发送")'); await page.waitForSelector('.modal');
  ok((await page.locator('.modal').textContent()).includes('3 封（点券超过单封上限，自动拆分），共 6 封'), '预览：每人 3 封、共 6 封');
  await page.screenshot({ path: OUT + '08-mail-preview.png' });
  await page.click('.modal .mf button.primary'); await page.waitForSelector('.result');
  const cm = (await api('GET', '/api/mail', null, T.carol)).list.filter(m => m.kind === 'gm');
  ok(cm.length === 3 && cm.reduce((s, m) => s + m.cera, 0) === 25000000 && cm.some(m => m.items.some(e => e.key === 'ep_katana' && e.opt.enh === 12)), 'carol 收到 3 封：点券合计 2500 万 + 物品 +12', cm.map(m => [m.title, m.cera, m.items.length]));
  await page.waitForSelector('.mh .progress');
  await shot('09-mail-sent');

  await tab(page, 'notice', '.notice-pre');
  await page.fill('textarea[maxlength="120"]', '今晚 22:00 停服维护 10 分钟');
  await page.click('button:has-text("发布公告")'); await page.click('.modal .mf button.primary');
  await page.waitForFunction(() => [...document.querySelectorAll('.t td')].some(td => td.textContent.includes('停服维护')));
  ok(true, '发布公告并出现在记录里');
  await shot('10-notice');

  await tab(page, 'online', '.t tbody tr');
  const onl = await page.locator('.view .t tbody').textContent();
  ok(onl.includes('漫游小枪') && onl.includes('赫顿玛尔') && !onl.includes('拳王'), '在线玩家：carol（带场景名字），被封禁的 bob 已经下线', onl);
  await shot('11-online');

  await tab(page, 'errs', '.list tbody tr');
  ok((await page.locator('.view').textContent()).includes('reading \'x\''), '客户端报错');
  await shot('12-errs');

  await tab(page, 'logs', '.t tbody tr');
  const logs = await page.locator('.view .t tbody').first().textContent();
  ok(logs.includes('封禁') && logs.includes('发邮件') && logs.includes('全服公告') && logs.includes('测试：刷屏'), '操作日志：封禁 / 发邮件 / 公告都有（带原因）');
  await shot('13-logs');
  await ctx.close();

  // ---- 手机 ----
  const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const mp = await mctx.newPage(); watch(mp); cur = mp;
  await mp.goto(BASE + '/admin/', { waitUntil: 'domcontentloaded' });
  await mp.fill('input[name=user]', 'alice'); await mp.fill('input[name=pass]', 'secret123'); await mp.click('.login button[type=submit]');
  await mp.waitForSelector('.kpis .kpi'); await sleep(300);
  const wide = await mp.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  ok(wide <= 1, '手机宽度下页面不横向溢出', wide);
  await mp.screenshot({ path: OUT + '20-mobile-dash.png', fullPage: true });
  await tab(mp, 'users', '.t tbody tr[data-id]'); await sleep(200);
  await mp.screenshot({ path: OUT + '21-mobile-users.png', fullPage: true });
  await mp.click('.t tbody tr[data-id]:has-text("carol")'); await mp.waitForSelector('.drawer .charc'); await sleep(300);
  await mp.screenshot({ path: OUT + '22-mobile-detail.png' });
  await mp.keyboard.press('Escape');
  await tab(mp, 'mail', '.picker'); await sleep(200);
  await mp.screenshot({ path: OUT + '23-mobile-mail.png', fullPage: true });
  await mctx.close();

  ok(!errs.length, '页面没有报错 / CSP 拦截', errs.slice(0, 5));
} catch (e) { ok(false, '异常：' + (e.stack || e)); if (cur) await cur.screenshot({ path: OUT + 'zz-fail.png' }).catch(() => {}); }
for (const s of socks) try { s.close(); } catch (e) { /* 已关 */ }
await browser.close();
await S.stop();
const { fails, total } = result();
console.log(`\n${total - fails}/${total} 通过，截图在 test/shots/admin/`);
process.exit(fails ? 1 : 0);
