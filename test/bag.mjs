// 背包不限格子 + 时装页一键出售（按类别、同种留 1 件、天空套默认保留）+ 时装随时可以单件出售
import { launch, URL_BASE } from './lib.mjs';
import fs from 'fs';
const out = 'test/shots/bag'; fs.mkdirSync(out, { recursive: true });
let fail = 0; const ok = (c, m, x = '') => { console.log(c ? '  ✓' : '  ✗', m, x); if (!c) fail++; };
const { browser, page, logs } = await launch({ width: 1280, height: 720 });
await page.goto(`${URL_BASE}?town&mute&cls=gun&fresh`); await page.waitForFunction(() => window.__READY); await page.waitForTimeout(800);
const closeAll = () => page.evaluate(() => { while (menus.stack.length) menus.close(menus.stack[menus.stack.length - 1]); });
await closeAll();
// ---- 装备页放 70 件：全部放得下 ----
const e = await page.evaluate(() => {
  let n = 0; for (let i = 0; i < 70; i++) if (inv.add(rollEquip({ slot: 'top', lvl: 5, rar: 0 }))) n++;
  IW.invTab = 'equip'; menus.open('inv');
  const w = menus.wins.inv; return { n, cells: w.querySelectorAll('.igrid .islot, .igrid > *').length, label: [...w.querySelectorAll('.ibar .small.dim')].map(x => x.textContent).join('|'), free: inv.free('equip') };
});
ok(e.n === 70 && e.free === Infinity, `装备页放进 70 件都成功（剩余格子 ${e.free}）`);
ok(e.cells >= 72 && /不限格子/.test(e.label), `物品栏显示 ${e.cells} 格，标注“${e.label}”`);
await page.screenshot({ path: `${out}/01-equip70.png` });
// ---- 时装页：宠物 3 只（同种）、光环 2 个（同种）、天空套 1 件、时装 2 件（同种） ----
const setup = await page.evaluate(() => {
  inv.items = inv.items.filter(it => !isAvatar(it)); inv._norm = inv.items;
  const add = (k, o) => { const it = makeItem(k, 1, o); inv.add(it); return it; };
  add('pet_lion'); add('pet_lion'); add('pet_lion'); add('pet_seal');
  const au = Object.keys(ITEMS).find(k => ITEMS[k].slot === 'av_aura'); add(au); add(au);
  const sky = Object.keys(ITEMS).find(k => ITEMS[k].avSet === 'av_sky1'); add(sky);
  add('av_top_spring'); add('av_top_spring');
  IW.invTab = 'avatar'; menus.refresh('inv');
  return { total: inv.items.filter(isAvatar).length, bulkBtns: [...menus.wins.inv.querySelectorAll('.bulkbtn')].map(b => b.textContent) };
});
ok(setup.total === 9 && setup.bulkBtns.join() === '一键出售', `时装页 ${setup.total} 件，底部只有“一键出售”`, setup.bulkBtns.join());
await page.evaluate(() => { setPref('avbulk', null); [...menus.wins.inv.querySelectorAll('.bulkbtn')][0].click(); });
await page.waitForTimeout(300);
const pv = await page.evaluate(() => ({ title: menus.wins.bulk.querySelector('.ttl, .wtitle, h2') ? menus.wins.bulk.querySelector('.ttl, .wtitle, h2').textContent : '', cand: avBulkCandidates().map(it => it.key).sort() }));
ok(pv.cand.join() === ['pet_lion', 'pet_lion', pv.cand.find(k => k.startsWith('aura') || ITEMS[k].slot === 'av_aura'), 'av_top_spring'].sort().join(), `默认：同种留 1 件、天空套不卖 → 预览 ${pv.cand.length} 件`, pv.cand.join());
await page.screenshot({ path: `${out}/02-avbulk.png` });
const g0 = await page.evaluate(() => game.gold);
await page.evaluate(() => [...menus.wins.bulk.querySelectorAll('.btn.big')].find(b => /出售/.test(b.textContent)).click()); await page.waitForTimeout(300);
const after = await page.evaluate(g0 => ({ left: inv.items.filter(isAvatar).map(it => it.key).sort(), gold: game.gold - g0 }), g0);
ok(after.left.length === 5 && after.left.filter(k => k === 'pet_lion').length === 1 && after.gold > 0, `卖掉 4 件，获得 ${after.gold} G，每种各剩 1 件`, after.left.join());
// ---- 单件出售：不开商店也有“出售” ----
await closeAll();
const one = await page.evaluate(() => { IW.invTab = 'avatar'; IW.invSel = inv.items.find(it => it.key === 'pet_seal'); menus.open('inv'); const b = [...menus.wins.inv.querySelectorAll('.ibar .btn')].find(x => x.textContent === '出售'); if (b) b.click(); return !!b; });
await page.waitForTimeout(300);
ok(one && !(await page.evaluate(() => inv.items.some(it => it.key === 'pet_seal'))), '没开商店：选中宠物直接“出售”');
const ti = await page.evaluate(() => {
  const tk = Object.keys(ITEMS).find(k => ITEMS[k].slot === 'title');
  inv.items = inv.items.filter(it => it.slot !== 'title'); inv._norm = inv.items;
  for (let i = 0; i < 4; i++) inv.add(makeItem(tk, 1));
  const R = (makeItem(tk, 1).rar) || 0;
  setPref('bulk', { rar: [R], keepOne: true });
  IW.invTab = 'title'; menus.refresh('inv');
  const btn = [...menus.wins.inv.querySelectorAll('.bulkbtn')].map(b => b.textContent);
  menus.open('bulk', 'tsell');
  const n = menus.wins.bulk.querySelectorAll('.igrid .islot, .igrid > *').length;
  return { btn, n, tk };
});
ok(ti.btn.join() === '一键出售', '称号页底部只有“一键出售”', ti.btn.join());
await page.evaluate(() => { const go = [...menus.wins.bulk.querySelectorAll('.btn.big')][0]; go.click(); });
await page.waitForTimeout(300);
await page.evaluate(() => { const d = [...document.querySelectorAll('button')].find(b => b.textContent === '全部出售'); if (d) d.click(); });
await page.waitForTimeout(300);
ok(await page.evaluate(() => inv.items.filter(it => it.slot === 'title').length) === 1, '称号一键出售：同名只留 1 件');
await page.screenshot({ path: `${out}/03-sold.png` });
const errs = logs.filter(l => l.type === 'pageerror'); ok(!errs.length, '没有页面错误', errs.length ? errs[0].text.slice(0, 300) : '');
await browser.close();
console.log(fail ? `${fail} 项失败` : '全部通过'); process.exit(fail ? 1 : 0);
