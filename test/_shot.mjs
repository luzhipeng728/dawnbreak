// 临时截图小工具：node test/_shot.mjs "<URL 参数>" <输出.png> [等待毫秒]，加 JS=... 环境变量可在截图前执行脚本
import { launch, URL_BASE } from './lib.mjs';
const [q, out, wait = 1500] = process.argv.slice(2);
const { browser, page, logs } = await launch({ width: 1600, height: 900 });
await page.goto(`${URL_BASE}?${q}&mute`); await page.waitForFunction(() => window.__READY, null, { timeout: 30000 });
await page.evaluate(() => { while (menus.stack.length) menus.close(menus.stack[menus.stack.length - 1]); });
if (process.env.JS) await page.evaluate(process.env.JS);
await page.waitForTimeout(+wait); await page.screenshot({ path: out });
console.log(out, JSON.stringify(logs.filter(l => l.type !== 'warning').slice(0, 3)));
await browser.close();
