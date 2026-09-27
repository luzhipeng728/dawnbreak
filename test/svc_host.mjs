// 社交服务测试的服务端：用联机组的真实服务端（server/index.js 的 start()）在临时数据库上起一个本机实例，顺带托管网页版 dist/web
// 注册测试账号、加好友，每个账号挂一条 WS 连接（Node 22 自带 WebSocket）记录服务端推送，方便断言
// 用法：const H = await startHost(); await H.api('alice', 'GET', '/api/mail'); H.msgs('alice'); H.tick(); await H.close();
import fs from 'fs';
import os from 'os';
import path from 'path';
const ROOT = new URL('..', import.meta.url).pathname;
export const INVITE = 'SVCTEST';

export async function startHost({ admins = ['gm'], users = ['alice', 'bob', 'gm'], friends = [['alice', 'bob']], ws = true } = {}) {
  process.env.DNF_SVC_TEST = '1';            // 打开 gm 模块的测试接口（平移服务端时间）
  process.env.NODE_NO_WARNINGS = '1';
  const { start } = await import(new URL('../server/index.js', import.meta.url).href);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'svc-'));
  const app = await start({ port: 0, db: path.join(dir, 'svc.db'), invites: [INVITE], admins, static: path.join(ROOT, 'dist/web'), httpRate: [100000, 10], graceMs: 3000 });
  app.ctx.log = () => {};
  const base = `http://127.0.0.1:${app.port}`;
  const tokens = {}, U = [], sent = {}, socks = [];
  const raw = async (tok, method, p, b) => {
    const res = await fetch(base + p, { method, headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}) }, body: b ? JSON.stringify(b) : undefined });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, ...data };
  };
  const api = (who, method, p, b) => raw(who ? tokens[who] : null, method, p, b);
  for (const name of users) {
    const r = await raw(null, 'POST', '/api/register', { user: name, pass: 'secret123', invite: INVITE });
    if (!r.token) throw new Error(`注册 ${name} 失败：${JSON.stringify(r)}`);
    tokens[name] = r.token; U.push({ ...r.user, name, admin: admins.includes(name), pass: 'secret123' });
  }
  for (const [a, b] of friends) { await api(a, 'POST', '/api/friends', { user: b }); await api(b, 'POST', '/api/friends/accept', { user: a }); }
  // 每个账号一条 WS：记录推送（mail:new / notice:show 等）
  if (ws) for (const u of U) {
    const s = new WebSocket(`${base.replace('http', 'ws')}/ws`);
    sent[u.name] = [];
    s.onopen = () => s.send(JSON.stringify({ t: 'auth', token: tokens[u.name], ver: 1, build: 'svc-test' }));
    s.onmessage = e => { try { const m = JSON.parse(e.data); if (m.t !== 'ping' && m.t !== 'pong') sent[u.name].push(m); } catch { /* 忽略 */ } };
    socks.push(s);
  }
  if (ws) { const t0 = Date.now(); while (app.ctx.online().length < U.length && Date.now() - t0 < 5000) await new Promise(r => setTimeout(r, 50)); }
  const mods = [];
  for (const f of fs.readdirSync(path.join(ROOT, 'server/modules')).filter(f => f.endsWith('.js'))) mods.push((await import(path.join(ROOT, 'server/modules', f))).default);
  return {
    base, url: base + '/index.html', ctx: app.ctx, api, users: U, tokens,
    msgs: who => { const L = sent[who] || []; sent[who] = []; return L; },
    tick: () => { for (const m of mods) if (m.tick) m.tick.fn(app.ctx); },
    close: async () => { for (const s of socks) try { s.close(); } catch { /* 已关 */ } await app.stop(); fs.rmSync(dir, { recursive: true, force: true }); },
  };
}
