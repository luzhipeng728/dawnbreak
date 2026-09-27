// 临时调试脚本：node test/_dbg.mjs "<查询参数>" "<页面里执行的表达式>"
import { launch, URL_BASE } from './lib.mjs';
const [q, expr] = process.argv.slice(2);
const { browser, page, logs } = await launch({ width: 960, height: 540 });
await page.goto(`${URL_BASE}?${q}&mute`); await page.waitForFunction(() => window.__READY, null, { timeout: 30000 });
const r = await page.evaluate(expr);
console.log(JSON.stringify(r, null, 1), JSON.stringify(logs.filter(l => l.type !== 'warning').slice(0, 3)));
await browser.close();
