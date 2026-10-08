// 无头浏览器测试公共部分：启动 Chrome（headless）、收集控制台/页面错误、分析截图亮度
import { createRequire } from 'module';
import { execSync } from 'child_process';
import { existsSync, readdirSync } from 'fs';
import { homedir } from 'os';
import path from 'path';
const require = createRequire(import.meta.url);

function loadPlaywright() {
  try { return require('playwright'); } catch { /* 本地没装就用全局的 */ }
  const root = execSync('npm root -g').toString().trim();
  for (const p of [`${root}/playwright`, `${root}/@playwright/cli/node_modules/playwright`, `${root}/@playwright/test/node_modules/playwright`]) {
    try { return require(p); } catch { /* try next */ }
  }
  throw new Error('找不到 playwright，请先 npm i -D playwright');
}
export const { chromium, devices } = loadPlaywright();

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
// 系统 Chrome 在 macOS headless 启动时会触发 HIServices/RegisterApplication，
// 多个测试并发清理 profile 时可能直接 SIGABRT。优先使用 Playwright 自带
// 浏览器；本机偶尔只保留相邻 revision 的 headless-shell，因此动态寻找
// 已安装的 shell，避免把“浏览器没启动”误报成页面断言失败。
function bundledBrowser() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const own = chromium.executablePath();
  if (existsSync(own)) return own;
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH && process.env.PLAYWRIGHT_BROWSERS_PATH !== '0'
    ? process.env.PLAYWRIGHT_BROWSERS_PATH : path.join(homedir(), 'Library', 'Caches', 'ms-playwright');
  try {
    const dirs = readdirSync(root).filter(n => /^chromium_headless_shell-/.test(n)).sort().reverse();
    const suffix = process.platform === 'darwin' ? (process.arch === 'arm64' ? 'mac-arm64' : 'mac') : process.platform === 'win32' ? 'win64' : 'linux';
    for (const d of dirs) {
      const base = path.join(root, d);
      const names = readdirSync(base, { withFileTypes: true }).filter(x => x.isDirectory()).map(x => x.name);
      for (const n of names) {
        const f = path.join(base, n, `chrome-headless-shell-${suffix}`);
        if (existsSync(f)) return f;
        const g = path.join(base, n, 'chrome-headless-shell');
        if (existsSync(g)) return g;
      }
    }
  } catch { /* 没有缓存时让 Playwright 给出标准安装提示 */ }
  return null;
}
const CHROME = bundledBrowser();
// 给自己调 chromium.launch 的测试用（手机触屏测试要 newContext({ isMobile })）：CHROME_PATH → Playwright 自带 → 常见的系统 Chrome 路径 → undefined（交给 Playwright 自己找）
const SYS_CHROME = ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'];
export const CHROME_EXE = CHROME || SYS_CHROME.find(f => existsSync(f)) || undefined;

export async function launch({ width = 1280, height = 720, gpu = process.env.PELICAN_GPU || (process.platform === 'darwin' ? 'metal' : 'default') } = {}) {
  const args = ['--autoplay-policy=no-user-gesture-required', '--enable-precise-memory-info', '--js-flags=--expose-gc', '--ignore-gpu-blocklist'];
  if (gpu === 'swiftshader') args.push('--use-angle=swiftshader', '--enable-unsafe-swiftshader');
  else if (gpu === 'metal') args.push('--use-angle=metal', '--enable-gpu');
  const launchOpt = { headless: true, args };
  if (CHROME) launchOpt.executablePath = CHROME;
  const browser = await chromium.launch(launchOpt);
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

// 已开放的职业 / 转职：读页面里的 CLASSES，跳过 ready === false（职业）/ J.ready === false（转职）——新职业（格斗家）开放后自动进各测试的列表
// openLists(page) → { classes: ['sword', ...], jobs: ['sword:blade', ...], wtypes: 这些职业的武器类型 }；没开页面时 openLists() 临时开一个（约 3 秒）
export async function openLists(page) {
  const get = pg => pg.evaluate(() => ({ classes: openClasses(), jobs: openClasses().flatMap(c => openJobs(c).map(j => c + ':' + j)), wtypes: Object.keys(WTYPES).filter(t => clsOpen(WTYPES[t].cls)) }));
  if (page) return get(page);
  const { browser, page: pg } = await launch({ width: 320, height: 180 });
  await pg.goto(`${URL_BASE}?mute`); await pg.waitForFunction(() => window.__READY, null, { timeout: 60000 });
  const r = await get(pg); await browser.close(); return r;
}

export async function forceGC(page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('HeapProfiler.collectGarbage');
  await cdp.detach();
}
