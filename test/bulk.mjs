// 一键出售 / 一键分解：按品级勾选、保护选项、单独取消、执行结果
import { launch, URL_BASE } from './lib.mjs';
import fs from 'fs';
const out = 'test/shots/bulk'; fs.mkdirSync(out, { recursive: true });
let fail = 0; const ok = (c, m, x = '') => { console.log(c ? '  ✓' : '  ✗', m, x); if (!c) fail++; };
const { browser, page, logs } = await launch({ width: 1280, height: 720 });
await page.goto(`${URL_BASE}?town&mute&cls=sword&fresh`); await page.waitForFunction(() => window.__READY); await page.waitForTimeout(800);
await page.evaluate(() => { while (menus.stack.length) menus.close(menus.stack[menus.stack.length - 1]); });
const setup = () => page.evaluate(() => {
  testLoadout(15); setPref('bulk', { rar: [0, 1], worse: true, keepSet: true, keepEnh: true });
  const mk = (lvl, rar) => { for (let i = 0; i < 80; i++) { const it = makeEquip('top', lvl, rar); if (!it.set) return it; } };
  const junk = [mk(1, 0), mk(1, 0), mk(2, 1), mk(3, 1)], good = mk(20, 4), enh = mk(1, 0); enh.enh = 5;
  const setKey = Object.keys(ITEMS).find(k => ITEMS[k].set && ITEMS[k].slot === 'top'), setIt = makeItem(setKey); setIt.rar = 1;
  const purple = mk(12, 2); purple.rar = 2;
  inv.items = [...junk, good, enh, setIt, purple];
  return { junk: junk.map(x => x.id), good: good.id, enh: enh.id, set: setIt.id, purple: purple.id, gold: game.gold };
});
let S = await setup();
await page.keyboard.press('KeyI'); await page.waitForTimeout(400);
await page.click('[data-win="inv"] .bulkbtn:has-text("一键出售")'); await page.waitForTimeout(400);
let c = await page.evaluate(() => bulkCandidates('sell').map(x => x.id));
const exp = await page.evaluate(() => inv.items.filter(it => (it.rar || 0) <= 1 && !it.set && !it.enh && ['down', 'na'].includes(equipCompare(it).v)).map(x => x.id));
ok(c.length === exp.length && exp.every(id => c.includes(id)) && S.junk.every(id => c.includes(id)), `默认（普通 + 高级、只处理更差的、保留套装和强化）：选中 ${c.length} 件，4 件垃圾装备都在`);
const pr = await page.evaluate(id => inv.items.find(x => x.id === id).rar, S.purple);
ok(!c.includes(S.good) && !c.includes(S.enh) && !c.includes(S.set) && (pr < 2 || !c.includes(S.purple)), '更好的、强化过的、套装、稀有品级都没被选中');
const nSell = c.length;
await page.screenshot({ path: `${out}/01-sell.png` });
await page.click('[data-win="bulk"] .rar:has-text("稀有")'); await page.waitForTimeout(300);
c = await page.evaluate(() => bulkCandidates('sell').map(x => x.id));
const pv = await page.evaluate(id => equipCompare(inv.items.find(x => x.id === id)).v, S.purple);
ok(pr < 2 || !['down', 'na'].includes(pv) || c.includes(S.purple), `勾上“稀有”后，比身上差的稀有装备也被选中（这件对比结果：${pv}）`);
await page.click('[data-win="bulk"] .rar:has-text("稀有")'); await page.waitForTimeout(200);
// 单独取消一件
await page.click('[data-win="bulk"] .igrid .islot >> nth=0'); await page.waitForTimeout(250);
const g0 = await page.evaluate(() => game.gold);
await page.click('[data-win="bulk"] .btn.big'); await page.waitForTimeout(500);
const r = await page.evaluate(() => ({ gold: game.gold, left: inv.items.map(x => x.id), bb: (save.data.buyback || []).length }));
ok(r.gold > g0 && r.left.length === 8 - (nSell - 1) && r.bb === nSell - 1, `出售 ${nSell - 1} 件（1 件被单独取消），金币 +${r.gold - g0}，进了回购`, JSON.stringify({ left: r.left.length, bb: r.bb }));
// 一键分解
S = await setup(); await page.evaluate(() => { menus.close('bulk'); game.gold = 100000; });
await page.click('[data-win="inv"] .bulkbtn:has-text("一键分解")'); await page.waitForTimeout(400);
await page.screenshot({ path: `${out}/02-dis.png` });
const d0 = await page.evaluate(() => ({ crystal: inv.count('crystal'), n: bulkCandidates('dis').length, eq: inv.items.filter(x => x.kind === 'equip').length }));
await page.click('[data-win="bulk"] .btn.big'); await page.waitForTimeout(500);
const d1 = await page.evaluate(() => ({ crystal: inv.count('crystal'), left: inv.items.filter(x => x.kind === 'equip').length }));
ok(d0.n >= 4 && d1.crystal > d0.crystal && d1.left === d0.eq - d0.n, `一键分解 ${d0.n} 件，得到无色小晶块 ${d1.crystal - d0.crystal} 个`, JSON.stringify(d1));
const errs = logs.filter(l => l.type === 'pageerror'); ok(!errs.length, '没有页面错误', errs.length ? errs[0].text.slice(0, 300) : '');
await browser.close();
console.log(fail ? `${fail} 项失败` : '全部通过'); process.exit(fail ? 1 : 0);
