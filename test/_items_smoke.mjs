import { launch, URL_BASE } from './lib.mjs';
import fs from 'fs';
const out = 'test/shots/items'; fs.mkdirSync(out, { recursive: true });
const { browser, page, logs } = await launch({ width: 1280, height: 720 });
const wait = ms => page.waitForTimeout(ms);
await page.goto(`${URL_BASE}?town&fresh&cls=${process.argv[2] || 'sword'}&mute`);
await page.waitForFunction(() => window.__READY && game.player && game.scene === 'town', null, { timeout: 20000 });
await wait(500);
await page.evaluate(() => { while (menus.stack.length) menus.close(menus.stack[menus.stack.length - 1]); });
const r = await page.evaluate(() => {
  const p = game.player;
  return { gear: GEAR.length, items: Object.keys(ITEMS).length, epics: EPICS.length, sets: Object.keys(SETS).length, stats: p.stats, equip: Object.fromEntries(Object.entries(inv.equip).map(([k, v]) => [k, v.name + ' ' + v.key])), items0: inv.items.map(x => x.name + '×' + x.n) };
});
console.log(JSON.stringify(r, null, 1));
for (const w of ['inv', 'status']) { await page.evaluate(w => menus.open(w), w); await wait(300); }
await page.screenshot({ path: `${out}/smoke-inv-status.png` });
await page.evaluate(() => { while (menus.stack.length) menus.close(menus.stack[menus.stack.length - 1]); menus.open('shop', { shop: 'linus', npc: NPCS.linus }); });
await wait(400); await page.screenshot({ path: `${out}/smoke-shop.png` });
console.log('LOGS', JSON.stringify(logs, null, 1));
await browser.close();
