// 社交服务测试用的最小宿主：按联机组公布的模块扩展点约定（协作板“服务端模块扩展点”）加载 server/modules/*.js，
// 在 node:sqlite 临时数据库上跑 HTTP 接口。只用于在联机组服务端合并前做接口测试；WS 推送记录在内存里（/__msgs 查看）
// 用法：const H = await startHost({ admins: ['gm'] }); await H.api('alice', 'GET', '/api/mail'); H.msgs('alice'); await H.close();
import http from 'http';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { DatabaseSync } from 'node:sqlite';
const ROOT = new URL('..', import.meta.url).pathname;

export async function startHost({ admins = ['gm'], users = ['alice', 'bob', 'gm'], friends = [['alice', 'bob']] } = {}) {
  process.env.DNF_SVC_TEST = '1';
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'svc-')), raw = new DatabaseSync(path.join(dir, 'test.db'));
  const db = {
    run: (sql, ...a) => raw.prepare(sql).run(...a), get: (sql, ...a) => raw.prepare(sql).get(...a), all: (sql, ...a) => raw.prepare(sql).all(...a), exec: sql => raw.exec(sql),
    tx(fn) { raw.exec('BEGIN'); try { const r = fn(); raw.exec('COMMIT'); return r; } catch (e) { raw.exec('ROLLBACK'); throw e; } },
  };
  const U = users.map((name, i) => ({ id: i + 1, name, admin: admins.includes(name), created: Date.now() }));
  const byName = n => U.find(u => u.name.toLowerCase() === String(n).toLowerCase());
  const fr = friends.map(([a, b]) => [byName(a).id, byName(b).id]);
  const invites = [];
  const sent = {}, online = new Set(U.map(u => u.id));
  const ctx = {
    db, mods: {}, cfg: {},
    err: (status, msg) => Object.assign(new Error(msg), { status }),
    log: () => {},
    sendTo: (uid, msg) => { (sent[uid] ||= []).push(msg); return online.has(uid); },
    broadcast: (msg, filter) => { for (const u of U) if (online.has(u.id)) (sent[u.id] ||= []).push(msg); },
    online: () => U.filter(u => online.has(u.id)).map(u => ({ id: u.id, name: u.name, admin: u.admin, scene: 'hm_plaza', char: { name: u.name + '的角色', cls: 'sword', job: null, lvl: 10 }, since: Date.now() - 60000, ip: '127.0.0.1' })),
    isOnline: uid => online.has(uid),
    findUser: q => (typeof q === 'number' ? U.find(u => u.id === q) : byName(q)) || null,
    readSave: () => null,
  };
  ctx.mods.account = {
    createInvite: (by, note) => { const code = Math.random().toString(36).slice(2, 10).toUpperCase(); invites.push({ code, created_by: by, created_at: Date.now(), used_by: null, used_at: null, note }); return code; },
    listInvites: () => invites.slice(), deleteInvite: code => { const i = invites.findIndex(v => v.code === code); if (i >= 0) invites.splice(i, 1); },
    listUsers: () => U.map(u => ({ id: u.id, name: u.name })),
  };
  ctx.mods.social = { friendsOf: uid => fr.filter(p => p.includes(uid)).map(p => p[0] === uid ? p[1] : p[0]) };
  // 加载模块
  const routes = [], ticks = [];
  const files = fs.readdirSync(path.join(ROOT, 'server/modules')).filter(f => f.endsWith('.js')).sort();
  const mods = [];
  for (const f of files) mods.push((await import(path.join(ROOT, 'server/modules', f))).default);
  for (const m of mods) m.migrations.forEach(s => typeof s === 'function' ? s(db) : raw.exec(s));
  for (const m of mods) ctx.mods[m.name] = m.init ? m.init(ctx) || m : m;
  const r = {};
  for (const verb of ['get', 'post', 'del']) r[verb] = (p, opts, fn) => routes.push({ method: verb === 'del' ? 'DELETE' : verb.toUpperCase(), re: new RegExp('^' + p.replace(/:(\w+)/g, '(?<$1>[^/]+)') + '$'), opts, fn });
  for (const m of mods) { if (m.routes) m.routes(r, ctx); if (m.tick) ticks.push(m.tick); }
  const srv = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x'), send = (st, o) => { res.writeHead(st, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
    let body = ''; for await (const c of req) body += c;
    const tok = (req.headers.authorization || '').replace(/^Bearer /, ''), user = byName(tok) || null;
    const rt = routes.find(x => x.method === req.method && x.re.test(url.pathname));
    if (!rt) return send(404, { error: '没有这个接口' });
    if ((rt.opts.auth || rt.opts.admin) && !user) return send(401, { error: '请先登录' });
    if (rt.opts.admin && !user.admin) return send(403, { error: '需要管理员权限' });
    try {
      const out = await rt.fn({ user: user ? { id: user.id, name: user.name, admin: user.admin } : null, body: body ? JSON.parse(body) : {}, params: url.pathname.match(rt.re).groups || {}, query: Object.fromEntries(url.searchParams), ip: '127.0.0.1', headers: req.headers });
      send(200, out ?? {});
    } catch (e) { if (e.status) send(e.status, { error: e.message }); else { console.error(e); send(500, { error: '服务器错误' }); } }
  });
  await new Promise(ok => srv.listen(0, '127.0.0.1', ok));
  const base = `http://127.0.0.1:${srv.address().port}`;
  const api = async (who, method, p, b) => {
    const res = await fetch(base + p, { method, headers: { 'Content-Type': 'application/json', ...(who ? { Authorization: 'Bearer ' + who } : {}) }, body: b ? JSON.stringify(b) : undefined });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, ...data };
  };
  return {
    base, ctx, api, users: U,
    msgs: who => { const u = byName(who); const L = sent[u.id] || []; sent[u.id] = []; return L; },
    tick: () => { for (const t of ticks) t.fn(ctx); },
    close: () => new Promise(ok => { srv.close(ok); raw.close(); fs.rmSync(dir, { recursive: true, force: true }); }),
  };
}
