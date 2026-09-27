// 美术实验室截图：node test/art.mjs <输出png> "<查询参数>"
import { launch, URL_BASE } from './lib.mjs';
const out = process.argv[2] || 'test/shots/art.png', q = process.argv[3] || 'poses=idle,idle2&zoom';
const { browser, page, logs } = await launch({ width: 1920, height: 1080 });
await page.goto(`${URL_BASE}?art&${q}`);
await page.waitForFunction(() => window.__ART_READY, null, { timeout: 20000 });
await page.waitForTimeout(+(process.env.WAIT || 300));
await page.screenshot({ path: out });
console.log('LOGS', JSON.stringify(logs.slice(0, 5)));
await browser.close();
