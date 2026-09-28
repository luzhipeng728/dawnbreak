// 点券 / 魔盒碎片 / 礼包币账号共享（老存档合并）+ 没名字的角色补默认名 + 角色选择“改名”
import { launch, URL_BASE } from './lib.mjs';
import fs from 'fs';
const out = 'test/shots/acct'; fs.mkdirSync(out, { recursive: true });
let fail = 0; const ok = (c, m, x = '') => { console.log(c ? '  ✓' : '  ✗', m, x); if (!c) fail++; };
const { browser, page, logs } = await launch({ width: 1280, height: 720 });
await page.goto(`${URL_BASE}?town&mute&cls=sword&fresh`); await page.waitForFunction(() => window.__READY); await page.waitForTimeout(800);
// 老格式存档：余额分散在两个角色身上，神枪手没有名字
const m = await page.evaluate(() => {
  PARAMS.delete('fresh');   // ?fresh 会让 loadAll 直接跳过读档
  const a = { ...save.defaults('gun'), v: SAVE_V, name: '', cera: 1000, shop: { shard: 5, gcoin: 7 } };
  const b = { ...save.defaults('sword'), v: SAVE_V, name: '剑魂A', cera: 500, shop: { shard: 1 } };
  localStorage.setItem(save.key, JSON.stringify({ v: SAVE_V, cur: 0, chars: [a, b] }));
  save.loadAll();
  const r = { acct: { ...save.acct }, name0: save.chars[0].name, gunName: CLASSES.gun.name, left: save.chars.map(c => [c.cera, c.shop.shard, c.shop.gcoin || 0]) };
  save.select(0); r.bal0 = cashBal('cera'); cashAdd('cera', 100); cashAdd('shard', 2);
  save.select(1); r.bal1 = cashBal('cera'); r.shard1 = cashBal('shard');
  save.persist(); save.loadAll(); save.loadAll(); r.again = { ...save.acct };
  return r;
});
ok(m.acct.cera === 1500 && m.acct.shard === 6 && m.acct.gcoin === 7, '两个角色的点券 / 碎片 / 礼包币合并进账号', JSON.stringify(m.acct));
ok(m.left.every(x => x.every(v => v === 0)), '合并后角色身上的余额清零', JSON.stringify(m.left));
ok(m.name0 === m.gunName, `没名字的角色补上默认名：${m.name0}`);
ok(m.bal0 === 1500 && m.bal1 === 1600 && m.shard1 === 8, `角色 1 充值后角色 2 也看得到（${m.bal0} → ${m.bal1}，碎片 ${m.shard1}）`);
ok(m.again.cera === 1600 && m.again.shard === 8, '重复读取不会重复合并', JSON.stringify(m.again));
// 角色选择界面改名
await page.evaluate(() => { while (menus.stack.length) menus.close(menus.stack[menus.stack.length - 1]); save.data = null; menus.csSel = 0; menus.open('charselect'); });
await page.waitForTimeout(400);
const clickBtn = t => page.evaluate(t => { const b = [...document.querySelectorAll('#charsel .csbtns .btn')].find(x => x.textContent === t); if (b) b.click(); return !!b; }, t);
ok(await clickBtn('改名'), '角色选择有“改名”按钮');
await page.waitForTimeout(300);
const tryName = async v => { await page.fill('[data-win="ask"] input', v); await page.evaluate(() => [...document.querySelectorAll('[data-win="ask"] .btn')].find(b => b.textContent === '改名').click()); await page.waitForTimeout(250);
  return page.evaluate(() => ({ open: menus.isOpen('ask'), err: (document.querySelector('[data-win="ask"] .askerr') || {}).textContent || '', name: save.chars[0].name })); };
const dup = await tryName('剑魂A');
ok(dup.open && /已经被/.test(dup.err) && dup.name !== '剑魂A', '和其他角色重名：拒绝', dup.err);
await page.screenshot({ path: `${out}/01-rename.png` });
const good = await tryName('破晓枪神');
const stored = await page.evaluate(() => JSON.parse(localStorage.getItem(save.key)).chars[0].name);
ok(!good.open && good.name === '破晓枪神' && stored === '破晓枪神', '改名成功并写进存档', JSON.stringify({ good, stored }));
const shown = await page.evaluate(() => document.querySelector('#charsel .csinfo b').textContent);
ok(shown === '破晓枪神', `角色选择立即显示新名字：${shown}`);
await page.screenshot({ path: `${out}/02-renamed.png` });
const errs = logs.filter(l => l.type === 'pageerror'); ok(!errs.length, '没有页面错误', errs.length ? errs[0].text.slice(0, 300) : '');
await browser.close();
console.log(fail ? `${fail} 项失败` : '全部通过'); process.exit(fail ? 1 : 0);
