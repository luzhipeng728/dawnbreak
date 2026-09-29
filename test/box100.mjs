// 百连开箱：结果合并同名 + 数量、按品级排序、汇总一行；剩 ≥100 个时有“百连”按钮；背包数量对得上
// 用法：node build.mjs && node test/box100.mjs
import { launch, URL_BASE } from './lib.mjs';
import fs from 'fs';
const out = 'test/shots/box100'; fs.mkdirSync(out, { recursive: true });
const { browser, page, logs } = await launch({ width: 1280, height: 720 });
let fails = 0; const check = (ok, msg, x = '') => { console.log(ok ? '  ✓' : '  ✗', msg, x); if (!ok) fails++; };
await page.goto(`${URL_BASE}?town&fresh&mute&cls=sword`);
await page.waitForFunction(() => window.__READY && game.player && game.scene === 'town', null, { timeout: 30000 });
await page.evaluate(() => { while (menus.stack.length) menus.close(menus.stack[menus.stack.length - 1]); game.lvl = 30; inv.add(makeItem('box_equip', 250)); });
const before = await page.evaluate(() => ({ box: inv.count('box_equip'), n: inv.items.length }));
await page.evaluate(() => { const o = cashOpenBoxes; cashOpenBoxes = (k, c) => { const r = o(k, c); if (!r.err) window.__lastBox = r.results.flatMap(R => R.items); return r; }; cashBoxUI('box_equip', 100); });
await page.waitForTimeout(400);
await page.click('.cbox-foot .btn.blue').catch(() => {});   // 跳过摇箱
await page.waitForTimeout(600);
const r = await page.evaluate(() => ({ box: inv.count('box_equip'), sub: document.querySelector('.cbox-ov .sub')?.textContent || '', tiles: document.querySelectorAll('.cbox-ov .cbox-t').length, groups: new Set(__lastBox.map(it => `${it.key}|${it.rar || 0}|${cbItemName(it)}`)).size,
  btns: [...document.querySelectorAll('.cbox-foot .btn')].map(b => b.textContent) }));
await page.screenshot({ path: `${out}/1_result.png` });
check(before.box - r.box === 100, `扣了 100 个礼盒（${before.box} → ${r.box}）`);
check(/共 100 件/.test(r.sub), '汇总一行：共 100 件 + 各品级数量', r.sub);
check(r.tiles > 0 && r.tiles === r.groups, `合并后全部列出：${r.tiles} 格 = ${r.groups} 种`);
check(r.btns.includes('百连'), '剩 ≥100 个时有“百连”按钮', JSON.stringify(r.btns));
// 按“百连”再开一次；剩 50 个时没有百连按钮
await page.evaluate(() => { [...document.querySelectorAll('.cbox-foot .btn')].find(b => b.textContent === '百连').click(); });
await page.waitForTimeout(400); await page.click('.cbox-foot .btn.blue').catch(() => {}); await page.waitForTimeout(500);
const r2 = await page.evaluate(() => ({ box: inv.count('box_equip'), btns: [...document.querySelectorAll('.cbox-foot .btn')].map(b => b.textContent) }));
check(r2.box === 50 && !r2.btns.includes('百连') && r2.btns.includes('十连'), `再百连后剩 ${r2.box}，只剩十连 / 再开 1 个`, JSON.stringify(r2.btns));
check(!logs.some(l => /error/i.test(l)), '没有报错');
await browser.close(); console.log(fails ? `✗ ${fails} 项失败` : '✓ 全部通过'); process.exit(fails ? 1 : 0);
