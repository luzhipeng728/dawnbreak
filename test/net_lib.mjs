// 联机测试公共部分：临时数据库起一个本地服务端（顺带托管 dist/web），开 1~4 个互相隔离的玩家（同一个 Chrome 进程里的独立上下文，各自的 localStorage）
// 注意：用户电脑怕热，同一时间最多 4 个玩家页面，测完调用 close() 立刻关掉
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from './lib.mjs';

const ROOT = new URL('..', import.meta.url).pathname;
export async function startServer(o = {}) {
  process.env.NODE_NO_WARNINGS = '1';
  const { start } = await import(new URL('../server/index.js', import.meta.url).href);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dnf-net-'));
  // LAG=毫秒：服务端发往每个客户端的消息都延迟这么久（模拟真实网络，JITTER=抖动毫秒）
  const lag = +(process.env.LAG || 0), jitter = +(process.env.JITTER || 0);
  const app = await start({ port: 0, db: path.join(tmp, 'net.db'), invites: ['NETTEST'], admins: ['alice'], static: path.join(ROOT, 'dist/web'), graceMs: 4000, lagMs: lag, jitterMs: jitter, ...o });
  if (lag) console.log(`（模拟网络延迟：服务端下行 ${lag}ms + 抖动 ${jitter}ms）`);
  const url = `http://127.0.0.1:${app.port}/index.html`;
  return { app, url, tmp, stop: async () => { await app.stop(); fs.rmSync(tmp, { recursive: true, force: true }); } };
}
// 服务端跑在独立进程里（和线上一样），可以 kill -9 再拉起来：模拟服务器重启 / 崩溃（同端口、同数据库）
export async function startServerProc(o = {}) {
  const { spawn } = await import('node:child_process');
  const net = await import('node:net');
  const port = await new Promise(res => { const s = net.createServer().listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dnf-proc-'));
  const env = { ...process.env, DNF_PORT: String(port), DNF_HOST: '127.0.0.1', DNF_DB: path.join(tmp, 'net.db'), DNF_INVITE: 'NETTEST', DNF_ADMIN: 'alice', DNF_STATIC: path.join(ROOT, 'dist/web'), DNF_GRACE_MS: String(o.graceMs || 4000), DNF_RESTORE_MS: String(o.restoreMs || 30000) };
  let proc = null;
  const up = async () => {
    proc = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', path.join(ROOT, 'server/index.js')], { env, stdio: ['ignore', 'pipe', 'pipe'] });
    proc.stdout.on('data', d => { if (process.env.SRVLOG) process.stdout.write('[服务端] ' + d); });
    proc.stderr.on('data', d => process.stdout.write('[服务端错误] ' + d));
    for (let i = 0; i < 100; i++) { try { const r = await fetch(`http://127.0.0.1:${port}/api/health`); if (r.ok) return; } catch (e) { /* 还没起来 */ } await new Promise(r => setTimeout(r, 100)); }
    throw new Error('服务端没有启动');
  };
  await up();
  const kill = () => new Promise(res => { if (!proc || proc.exitCode !== null) { res(); return; } proc.once('exit', () => res()); proc.kill('SIGKILL'); });
  return { port, url: `http://127.0.0.1:${port}/index.html`, kill, up, restart: async () => { await kill(); await up(); }, stop: async () => { await kill(); fs.rmSync(tmp, { recursive: true, force: true }); } };
}
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
export async function launchPlayers(n, { width = 1280, height = 720 } = {}) {
  if (n > 4) throw new Error('最多 4 个玩家页面');
  const browser = await chromium.launch({ headless: true, executablePath: CHROME, args: ['--autoplay-policy=no-user-gesture-required', '--ignore-gpu-blocklist', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'] });
  const players = [];
  for (let i = 0; i < n; i++) {
    const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
    const page = await ctx.newPage(), logs = [];
    page.on('console', m => { if (m.type() === 'error') logs.push({ type: 'error', text: m.text() }); });
    page.on('pageerror', e => logs.push({ type: 'pageerror', text: e.message + '\n' + (e.stack || '') }));
    players.push({ i, ctx, page, logs });
  }
  return { browser, players, close: () => browser.close() };
}
let fails = 0, total = 0;
export const ok = (c, msg, extra) => { total++; if (c) console.log('✓', msg); else { fails++; console.log('✗', msg, extra !== undefined ? JSON.stringify(extra) : ''); } return !!c; };
export const result = () => ({ fails, total });
export const sleep = ms => new Promise(r => setTimeout(r, ms));
// 在页面里等条件成立（字符串表达式），超时返回 false
// 默认 20 秒：机器忙（多组测试并行、别的程序占 CPU）时页面加载 / 推送都会变慢，成功时不会多等
export async function until(page, fn, arg, ms = 20000) {
  try { await page.waitForFunction(fn, arg, { timeout: ms, polling: 100 }); return true; } catch (e) { return false; }
}
// 通过界面注册 / 登录（真实点按钮、填表单）
// 机器忙时整条链路（页面加载 → 探测服务器 → 注册 / 登录 → 读云存档）可能要十几秒；客户端接口超时是 12 秒，这里等 30 秒，出错提示一出现就提前结束
// authInfo：最近一次注册 / 登录的实测值（耗时、窗口里的错误提示、窗口栈……），失败时测试可以把它打印出来；失败时这里也会打印一行
export const authInfo = {};
async function uiAuth(page, url, mode, fields) {
  const t0 = Date.now(), btn = mode === 'register' ? '注册' : '登录', submit = mode === 'register' ? '注册并登录' : '登录';
  await page.goto(url + '?mute'); await page.waitForFunction(() => window.__READY, null, { timeout: 60000 });
  const title = await until(page, b => menus.isOpen('title') && [...document.querySelectorAll('#title button')].some(e => e.textContent === b), btn, 30000);   // 探测到服务器后才出现登录 / 注册
  if (title) {
    await page.click(`#title button:text-is("${btn}")`);
    const inputs = page.locator('.loginbd input');
    await inputs.nth(fields.length - 1).waitFor({ timeout: 10000 });
    for (let k = 0; k < 3; k++) {   // 填完读回来核对（窗口被重建时值会丢），不对就重填
      for (let i = 0; i < fields.length; i++) await inputs.nth(i).fill(fields[i]);
      if ((await inputs.evaluateAll(els => els.map(e => e.value))).every((v, i) => i >= fields.length || v === fields[i])) break;
    }
    await page.click(`.loginbd button:text-is("${submit}")`);
    await until(page, () => (netOn() && !menus.isOpen('login')) || (menus.isOpen('login') && /^(?!正在).+/.test((document.querySelector('.loginbd .askerr') || {}).textContent || '')), null, 30000);
  }
  const st = await page.evaluate(() => ({ on: netOn(), login: menus.isOpen('login'), err: (document.querySelector('.loginbd .askerr') || {}).textContent || '', stack: menus.stack.slice(), avail: net.avail }));
  Object.assign(authInfo, { mode, user: fields[0], ok: st.on && !st.login, ms: Date.now() - t0, title, ...st });
  if (!authInfo.ok) console.log(`  （${btn} ${fields[0]} 没有成功：${JSON.stringify(authInfo)}）`);
  return authInfo.ok;
}
export const uiRegister = (page, url, user, pass = 'secret123') => uiAuth(page, url, 'register', [user, pass, pass]);
export const uiLogin = (page, url, user, pass = 'secret123') => uiAuth(page, url, 'login', [user, pass]);
// 创建角色并进城（真实界面流程）
export async function uiCreateChar(page, clsIndex = 0, name) {
  if (await page.evaluate(() => menus.isOpen('ask'))) await page.click('.askwin button:has-text("暂不上传")').catch(() => {});
  if (!(await page.evaluate(() => menus.isOpen('charselect')))) { await page.click('text=进入游戏').catch(() => {}); await until(page, () => menus.isOpen('charselect'), null, 8000); }
  await page.click('#charsel button:has-text("创建角色")');
  await page.click(`.clscard >> nth=${clsIndex}`);
  if (name) await page.fill('#newgame input.txt', name);
  await page.click('text=创建并开始');
  const okTown = await until(page, () => game.scene === 'town' && world && game.player, null, 20000);
  await page.evaluate(() => { for (const n of ['help']) if (menus.isOpen(n)) menus.close(n); });
  return okTown;
}
export function dumpErrors(players) {
  const errs = [];
  for (const p of players) for (const l of p.logs) if (l.type === 'pageerror' || (l.type === 'error' && !/Failed to load resource|favicon|ERR_CONNECTION_REFUSED|WebSocket connection/.test(l.text))) errs.push(`[玩家${p.i + 1}] ${l.text.slice(0, 400)}`);
  return errs;
}
