/* HTTP：路由表、JSON 请求体（带大小上限）、鉴权、限流、错误处理；开发 / 测试时可以顺带托管静态文件（DNF_STATIC）
   /admin/：后台管理页面（server/admin/ 下固定的几个文件，带严格的 CSP；页面本身不含数据，数据都走 /api/gm/*，只有管理员能调） */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { HttpError, limiter } from './util.js';

export class Router {
  constructor() { this.routes = []; }
  add(method, p, opts, fn) {
    if (typeof opts === 'function') { fn = opts; opts = {}; }
    const keys = [];
    const re = new RegExp('^' + p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\/:(\w+)/g, (_, k) => { keys.push(k); return '/([^/]+)'; }) + '/?$');
    this.routes.push({ method, path: p, re, keys, opts, fn, rl: opts.rate ? limiter(opts.rate[0], opts.rate[1]) : null });
  }
  get(p, o, f) { this.add('GET', p, o, f); }
  post(p, o, f) { this.add('POST', p, o, f); }
  put(p, o, f) { this.add('PUT', p, o, f); }
  del(p, o, f) { this.add('DELETE', p, o, f); }
  patch(p, o, f) { this.add('PATCH', p, o, f); }
  match(method, pathname) {
    let any = false;
    for (const r of this.routes) {
      const m = r.re.exec(pathname); if (!m) continue;
      any = true; if (r.method !== method) continue;
      const params = {}; r.keys.forEach((k, i) => { try { params[k] = decodeURIComponent(m[i + 1]); } catch { params[k] = m[i + 1]; } });
      return { r, params };
    }
    return any ? 'method' : null;
  }
}

export function clientIp(req, trustProxy) {
  const ra = req.socket.remoteAddress || '';
  if (trustProxy && /^(127\.|::1$|::ffff:127\.)/.test(ra)) {
    const xff = req.headers['x-forwarded-for'];
    if (xff) { const list = String(xff).split(',').map(s => s.trim()).filter(Boolean); if (list.length) return list[list.length - 1]; }
    if (req.headers['x-real-ip']) return String(req.headers['x-real-ip']);
  }
  return ra.replace(/^::ffff:/, '');
}

export function sendJson(res, status, obj) {
  const body = JSON.stringify(obj ?? {});
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Length': Buffer.byteLength(body) });
  res.end(body);
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const len = +req.headers['content-length'] || 0;
    if (len > limit) { reject(new HttpError(413, '请求内容太大')); req.resume(); return; }
    const chunks = []; let size = 0, done = false;
    req.on('data', c => { if (done) return; size += c.length; if (size > limit) { done = true; reject(new HttpError(413, '请求内容太大')); req.resume(); return; } chunks.push(c); });
    req.on('end', () => { if (done) return; done = true; resolve(Buffer.concat(chunks).toString('utf8')); });
    req.on('error', e => { if (!done) { done = true; reject(e); } });
  });
}

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.json': 'application/json', '.ico': 'image/x-icon', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg' };
function serveStatic(root, pathname, res) {
  let p;
  try { p = path.join(root, decodeURIComponent(pathname)); } catch { res.writeHead(400); res.end(); return; }
  if (!p.startsWith(path.resolve(root))) { res.writeHead(403); res.end(); return; }
  if (pathname.endsWith('/')) p = path.join(p, 'index.html');
  fs.readFile(p, (e, buf) => {
    if (e) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream', 'Cache-Control': 'no-cache' }); res.end(buf);
  });
}

const ADMIN_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'admin');
const ADMIN_FILES = { '/admin/': 'index.html', '/admin/index.html': 'index.html', '/admin/admin.js': 'admin.js', '/admin/admin.css': 'admin.css' };
const ADMIN_CSP = "default-src 'none'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
function serveAdmin(pathname, res) {
  if (pathname === '/admin') { res.writeHead(301, { Location: '/admin/' }); res.end(); return; }
  const f = ADMIN_FILES[pathname];
  if (!f) { res.writeHead(404); res.end('not found'); return; }
  fs.readFile(path.join(ADMIN_DIR, f), (e, buf) => {
    if (e) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)], 'Cache-Control': 'no-cache', 'Content-Security-Policy': ADMIN_CSP, 'X-Frame-Options': 'DENY', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' });
    res.end(buf);
  });
}

// 生成 http.createServer 用的处理函数
export function makeHandler({ router, ctx, cfg, auth }) {
  const ipLimit = limiter(cfg.httpRate[0], cfg.httpRate[1]);
  return async (req, res) => {
    let url;
    try { url = new URL(req.url, 'http://x'); } catch { res.writeHead(400); res.end(); return; }
    const pathname = url.pathname;
    if (!pathname.startsWith('/api/')) {
      if (pathname === '/admin' || pathname.startsWith('/admin/')) return serveAdmin(pathname, res);
      if (cfg.static) return serveStatic(path.resolve(cfg.static), pathname, res);
      res.writeHead(404); res.end('not found'); return;
    }
    const ip = clientIp(req, cfg.trustProxy);
    const t0 = Date.now();
    try {
      if (!ipLimit(ip)) throw new HttpError(429, '请求太频繁，请稍后再试');
      const m = router.match(req.method, pathname);
      if (!m) throw new HttpError(404, '接口不存在');
      if (m === 'method') throw new HttpError(405, '请求方法不对');
      const { r, params } = m, o = r.opts;
      const user = await auth(req);
      if ((o.auth || o.admin) && !user) throw new HttpError(401, '请先登录');
      if (o.admin && !user.admin) throw new HttpError(403, '需要管理员权限');
      if (r.rl && !r.rl((user ? 'u' + user.id : 'ip' + ip))) throw new HttpError(429, '操作太频繁，请稍后再试');
      let body = {};
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        const raw = await readBody(req, o.limit || cfg.bodyLimit);
        if (raw) { try { body = JSON.parse(raw); } catch { throw new HttpError(400, '请求内容不是合法的 JSON'); } }
        if (!body || typeof body !== 'object' || Array.isArray(body)) throw new HttpError(400, '请求内容格式不对');
      }
      const out = await r.fn({ user, body, params, query: Object.fromEntries(url.searchParams), ip, headers: req.headers, req, res }, ctx);
      if (!res.headersSent) sendJson(res, 200, out === undefined ? { ok: true } : out);
    } catch (e) {
      if (res.headersSent) return;
      if (e instanceof HttpError) sendJson(res, e.status, { error: e.message, ...(e.data || {}) });
      else { ctx.log('接口出错', req.method, pathname, e && e.stack || e); sendJson(res, 500, { error: '服务器出错了，请稍后再试' }); }
    } finally {
      if (cfg.logHttp) ctx.log(`${req.method} ${pathname} ${res.statusCode} ${Date.now() - t0}ms ${ip}`);
    }
  };
}
