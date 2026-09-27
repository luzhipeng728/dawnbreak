// 无头浏览器测试公共部分：启动 Chrome（headless）、收集控制台/页面错误、分析截图亮度
import { createRequire } from 'module';
import { execSync } from 'child_process';
const require = createRequire(import.meta.url);

function loadPlaywright() {
  try { return require('playwright'); } catch { /* 本地没装就用全局的 */ }
  const root = execSync('npm root -g').toString().trim();
  for (const p of [`${root}/playwright`, `${root}/@playwright/cli/node_modules/playwright`, `${root}/@playwright/test/node_modules/playwright`]) {
    try { return require(p); } catch { /* try next */ }
  }
  throw new Error('找不到 playwright，请先 npm i -D playwright');
}
export const { chromium } = loadPlaywright();

// 默认打开本地离线单文件；WEB=1 时起一个本地 HTTP 服务测网页版（dist/web，素材按需加载，和线上一样同源）；GAME_URL 可指向线上地址
import http from 'http';
import fsx from 'fs';
import pathx from 'path';
function serveWeb() {
  const root = new URL('../dist/web/', import.meta.url).pathname;
  const types = { '.html': 'text/html; charset=utf-8', '.webp': 'image/webp', '.js': 'text/javascript' };
  const srv = http.createServer((req, res) => {
    const p = pathx.join(root, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html'));
    fsx.readFile(p, (err, buf) => { if (err) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': types[pathx.extname(p)] || 'application/octet-stream' }); res.end(buf); });
  }).listen(0);
  srv.unref();
  return `http://127.0.0.1:${srv.address().port}/index.html`;
}
export const URL_BASE = process.env.GAME_URL || (process.env.WEB ? serveWeb() : new URL('../dist/dawnbreak.html', import.meta.url).href);
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

export async function launch({ width = 1280, height = 720, gpu = process.env.PELICAN_GPU || 'default' } = {}) {
  const args = ['--autoplay-policy=no-user-gesture-required', '--enable-precise-memory-info', '--js-flags=--expose-gc', '--ignore-gpu-blocklist'];
  if (gpu === 'swiftshader') args.push('--use-angle=swiftshader', '--enable-unsafe-swiftshader');
  else if (gpu === 'metal') args.push('--use-angle=metal', '--enable-gpu');
  const browser = await chromium.launch({ headless: true, executablePath: CHROME, args });
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  const logs = [];
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') logs.push({ type: m.type(), text: m.text() }); });
  page.on('pageerror', e => logs.push({ type: 'pageerror', text: e.message + '\n' + (e.stack || '') }));
  page.on('requestfailed', r => logs.push({ type: 'requestfailed', text: r.url() + ' ' + (r.failure() && r.failure().errorText) }));
  if (process.env.BLOCK_NET) await page.route(u => !u.href.startsWith('file:') && !u.href.startsWith('data:') && !u.href.startsWith('blob:'), r => { logs.push({ type: 'blocked', text: r.request().url() }); r.abort(); });   // 模拟断网：只允许本地文件
  return { browser, page, logs };
}

export async function gpuInfo(page) {
  return page.evaluate(() => {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return 'no webgl2';
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
  });
}

// 在页面里解码截图，统计平均亮度/标准差/近黑像素比例（判断黑屏/白屏）
export async function imageStats(page, pngBuffer) {
  const b64 = pngBuffer.toString('base64');
  return page.evaluate(async (b64) => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + b64;
    await img.decode();
    const w = 320, h = Math.round(img.height / img.width * 320);
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const g = cv.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0, w, h);
    const d = g.getImageData(0, 0, w, h).data;
    let sum = 0, sum2 = 0, dark = 0; const n = w * h;
    for (let i = 0; i < d.length; i += 4) {
      const l = (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255;
      sum += l; sum2 += l * l; if (l < 0.02) dark++;
    }
    const mean = sum / n;
    return { mean: +mean.toFixed(4), std: +Math.sqrt(Math.max(0, sum2 / n - mean * mean)).toFixed(4), darkRatio: +(dark / n).toFixed(4) };
  }, b64);
}

export async function forceGC(page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('HeapProfiler.collectGarbage');
  await cdp.detach();
}
