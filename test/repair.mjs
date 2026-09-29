// 一键修理：物品栏按钮显示费用并修好全部装备；设置“进图自动修理”打开时进地下城自动修，关掉就不修
// 用法：node build.mjs && node test/repair.mjs
import { launch, URL_BASE } from './lib.mjs';
const { browser, page, logs } = await launch({ width: 1280, height: 720 });
let fails = 0; const check = (ok, msg, x = '') => { console.log(ok ? '  ✓' : '  ✗', msg, x); if (!ok) fails++; };
await page.goto(`${URL_BASE}?town&fresh&mute&cls=sword`);
await page.waitForFunction(() => window.__READY && game.player && game.scene === 'town', null, { timeout: 30000 });
const wear = () => page.evaluate(() => { for (const it of durItems()) it.dur = Math.floor(it.durMax / 2); game.gold = 1e6; return repairCost(); });
const c0 = await wear();
await page.evaluate(() => { while (menus.stack.length) menus.close(menus.stack[menus.stack.length - 1]); menus.open('inv'); }); await page.waitForTimeout(400);
const btn = await page.evaluate(() => document.querySelector('[data-repair]').textContent);
check(c0 > 0 && btn.includes('一键修理') && btn.replace(/,/g, '').includes(String(c0)), `物品栏按钮显示费用：${btn}`);
await page.click('[data-repair]'); await page.waitForTimeout(300);
const r1 = await page.evaluate(() => ({ cost: repairCost(), full: durItems().every(it => it.dur === it.durMax), btn: document.querySelector('[data-repair]').textContent }));
check(r1.cost === 0 && r1.full && r1.btn === '无需修理', '点一下全部修好，按钮变成“无需修理”', r1);
// 进图自动修理（默认开）
await wear();
await page.evaluate(() => { while (menus.stack.length) menus.close(menus.stack[menus.stack.length - 1]); save.data.fatigue = FATIGUE_MAX; enterDungeon('lorien', 0); });
await page.waitForFunction(() => game.scene === 'dungeon', null, { timeout: 20000 });
check(await page.evaluate(() => repairCost() === 0), '进地下城自动修好（默认开）');
// 关掉后不修
await page.evaluate(() => { setPref('autoRepair', false); for (const it of durItems()) it.dur = 1; bus.emit('dungeonEnter', { id: 'x' }); });
check(await page.evaluate(() => repairCost() > 0), '关掉“进图自动修理”后不自动修');
check(!logs.some(l => /error/i.test(l)), '没有报错');
await browser.close(); console.log(fails ? `✗ ${fails} 项失败` : '✓ 全部通过'); process.exit(fails ? 1 : 0);
