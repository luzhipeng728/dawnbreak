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
export async function until(page, fn, arg, ms = 10000) {
  try { await page.waitForFunction(fn, arg, { timeout: ms, polling: 100 }); return true; } catch (e) { return false; }
}
// 通过界面注册 / 登录（真实点按钮、填表单）
export async function uiRegister(page, url, user, pass = 'secret123', invite = 'NETTEST') {
  await page.goto(url + '?mute'); await page.waitForFunction(() => window.__READY);
  await until(page, () => menus.isOpen('title') && document.querySelector('#title .netacct, #title button.btn.big'));
  await page.click('#title button:has-text("注册")');
  const inputs = page.locator('.loginbd input');
  await inputs.nth(0).fill(user); await inputs.nth(1).fill(pass); await inputs.nth(2).fill(pass); await inputs.nth(3).fill(invite);
  await page.click('.loginbd button:has-text("注册并登录")');
  return until(page, () => netOn() && !menus.isOpen('login'), null, 10000);
}
export async function uiLogin(page, url, user, pass = 'secret123') {
  await page.goto(url + '?mute'); await page.waitForFunction(() => window.__READY);
  await until(page, () => menus.isOpen('title'));
  await page.click('#title button:has-text("登录")');
  const inputs = page.locator('.loginbd input');
  await inputs.nth(0).fill(user); await inputs.nth(1).fill(pass);
  await page.click('.loginbd button:has-text("登录")');
  return until(page, () => netOn() && !menus.isOpen('login'), null, 10000);
}
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
