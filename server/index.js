/* 破晓地下城 · 联机服务端入口
   启动：node --disable-warning=ExperimentalWarning index.js（需要 Node 22.13+，用内置 node:sqlite）
   环境变量（见 deploy/dawnbreak.env.example）：
     DNF_PORT=18790  DNF_HOST=127.0.0.1  DNF_DB=./data/dawnbreak.db
     DNF_INVITE=邀请码1,邀请码2（注册用，可重复使用）  DNF_ADMIN=管理员用户名1,用户名2
     DNF_STATIC=../dist/web（可选：本地测试时顺带托管网页版，线上由 Caddy 托管）  DNF_TRUST_PROXY=1  DNF_LOG_HTTP=0
   结构：server/core/*.js（账号、存档、好友 / 聊天 / 同屏、队伍、房间转发）和 server/modules/*.js（其他组的扩展模块）用同一套模块接口，见 README 段落 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { openDb, migrate } from './lib/db.js';
import { Router, makeHandler } from './lib/http.js';
import { makeHub, NET_VER } from './lib/hub.js';
import { err, ts } from './lib/util.js';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const env = process.env;
const list = s => String(s || '').split(',').map(x => x.trim()).filter(Boolean);
export const cfg = {
  port: +(env.DNF_PORT || 18790), host: env.DNF_HOST || '127.0.0.1',
  db: env.DNF_DB || path.join(DIR, 'data', 'dawnbreak.db'),
  invites: list(env.DNF_INVITE), admins: list(env.DNF_ADMIN).map(s => s.toLowerCase()),
  static: env.DNF_STATIC || '', trustProxy: env.DNF_TRUST_PROXY !== '0', logHttp: env.DNF_LOG_HTTP === '1',
  bodyLimit: 64 * 1024, saveLimit: 4 * 1024 * 1024,
  httpRate: [120, 10],          // 每个 IP：10 秒内最多 120 个请求
  wsConnRate: [20, 60],         // 每个 IP：60 秒内最多新建 20 条 WS 连接
  wsRate: [300, 3],             // 每条连接：3 秒内最多 300 条消息（决斗 30Hz 输入 + 心跳绰绰有余）
  wsMaxPayload: 64 * 1024,
  pingEvery: 20_000,
  graceMs: +(env.DNF_GRACE_MS || 20_000),   // 掉线后保留队伍 / 房间的时间（这段时间内重连可以接着玩）
  sessionDays: 30,
};

const log = (...a) => console.log(ts(), ...a);
export async function start(over = {}) {
  Object.assign(cfg, over);
  const db = openDb(cfg.db);
  const router = new Router();
  const handlers = new Map(), hooks = { connect: [], close: [] }, mods = {};
  const ctx = { db, cfg, log, err, mods, NET_VER };
  // 模块：先核心（固定顺序），再扩展模块（按文件名排序）
  const coreOrder = ['account', 'saves', 'social', 'party', 'room'];
  const files = [
    ...coreOrder.map(n => path.join(DIR, 'core', n + '.js')),
    ...(fs.existsSync(path.join(DIR, 'modules')) ? fs.readdirSync(path.join(DIR, 'modules')).filter(f => f.endsWith('.js')).sort().map(f => path.join(DIR, 'modules', f)) : []),
  ];
  const loaded = [];
  for (const f of files) {
    let m;
    try { m = (await import(pathToFileURL(f).href)).default; }
    catch (e) { log(`模块加载失败 ${path.basename(f)}`, e.stack || e); if (f.includes(`${path.sep}core${path.sep}`)) throw e; continue; }
    if (!m || !m.name) { log(`模块 ${path.basename(f)} 没有导出 { name }，跳过`); continue; }
    if (mods[m.name]) { log(`模块名重复：${m.name}（${path.basename(f)}），跳过`); continue; }
    migrate(db, m.name, m.migrations, log);
    loaded.push(m); mods[m.name] = m;
  }
  // 鉴权（account 模块提供）
  const auth = { byToken: t => mods.account.userByToken(t), fromReq: req => mods.account.userFromReq(req) };
  const server = http.createServer();
  const hub = makeHub({ server, cfg, ctx, auth, handlers, hooks });
  Object.assign(ctx, {
    hub,
    sendTo: (id, msg) => hub.sendTo(id, msg),
    broadcast: (msg, filter) => hub.broadcast(msg, filter),
    isOnline: id => hub.clients.has(id),
    client: id => hub.clients.get(id),
    online: () => [...hub.clients.values()].map(c => ({ id: c.user.id, name: c.user.name, admin: c.user.admin, scene: c.scene, char: c.char && { name: c.char.name, cls: c.char.cls, job: c.char.job, lvl: c.char.lvl }, since: c.since, ip: c.ip })),
  });
  for (const m of loaded) {
    if (m.init) { const api = await m.init(ctx); if (api) mods[m.name] = api; }
    if (m.routes) m.routes(router, ctx);
    if (m.ws) for (const [t, fn] of Object.entries(m.ws)) { if (handlers.has(t)) log(`WS 消息类型 ${t} 被 ${m.name} 重复注册，后者覆盖`); handlers.set(t, fn); }
    if (m.onWs) handlers.set('*' + m.name, m.onWs);
    if (m.onConnect) hooks.connect.push(m.onConnect);
    if (m.onClose) hooks.close.push(m.onClose);
    if (m.tick && m.tick.every && m.tick.fn) setInterval(() => { try { m.tick.fn(ctx); } catch (e) { log(`${m.name}.tick 出错`, e.stack || e); } }, Math.max(1000, m.tick.every)).unref();
  }
  router.get('/api/health', () => ({ ok: true, ver: NET_VER, online: hub.clients.size, time: Date.now() }));
  server.on('request', makeHandler({ router, ctx, cfg, auth: req => auth.fromReq(req) }));
  server.headersTimeout = 15_000; server.requestTimeout = 30_000; server.keepAliveTimeout = 5_000;
  await new Promise((res, rej) => { server.once('error', rej); server.listen(cfg.port, cfg.host, res); });
  const addr = server.address();
  log(`破晓地下城服务端已启动：http://${cfg.host}:${addr.port}（协议 v${NET_VER}，数据库 ${cfg.db}，模块 ${loaded.map(m => m.name).join(' / ')}）`);
  if (!cfg.invites.length) log('提示：没有设置 DNF_INVITE，只能用管理员生成的邀请码注册');
  const stop = () => new Promise(res => { hub.close(); server.close(() => { db.close(); res(); }); setTimeout(() => { db.close(); res(); }, 2000).unref(); });
  return { server, ctx, port: addr.port, stop };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const app = await start();
  const bye = sig => { log(`收到 ${sig}，正在关闭…`); app.stop().then(() => process.exit(0)); };
  process.on('SIGTERM', () => bye('SIGTERM')); process.on('SIGINT', () => bye('SIGINT'));
}
