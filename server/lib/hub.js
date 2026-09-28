/* WebSocket 连接中心：鉴权、每个账号一条连接（新连接顶掉旧的）、心跳、消息大小 / 频率限制、按消息类型分发给各模块
   客户端连上 /ws 后第一条消息必须是 { t:'auth', token, ver, build }（也兼容 /ws?token=...），5 秒内没鉴权就断开 */
import { WebSocketServer } from 'ws';
import { limiter } from './util.js';
import { clientIp } from './http.js';

export const NET_VER = 1;   // 联机协议版本：客户端不一致时提示刷新页面

export function makeHub({ server, cfg, ctx, auth, handlers, hooks }) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: cfg.wsMaxPayload, perMessageDeflate: false });
  const clients = new Map();       // userId → client
  const connLimit = limiter(cfg.wsConnRate[0], cfg.wsConnRate[1]);
  let connSeq = 1, closing = false;

  server.on('upgrade', (req, sock, head) => {
    let url; try { url = new URL(req.url, 'http://x'); } catch { sock.destroy(); return; }
    if (url.pathname !== '/ws') { sock.destroy(); return; }
    const ip = clientIp(req, cfg.trustProxy);
    if (!connLimit(ip)) { sock.write('HTTP/1.1 429 Too Many Requests\r\n\r\n'); sock.destroy(); return; }
    wss.handleUpgrade(req, sock, head, ws => onConn(ws, ip, url.searchParams.get('token')));
  });

  function makeClient(ws, ip) {
    const c = {
      cid: connSeq++, ws, ip, user: null, since: Date.now(), alive: true, ver: 0, build: '', char: null, scene: null, pos: null,
      rl: limiter(cfg.wsRate[0], cfg.wsRate[1]), dropped: 0,
      send(msg) {
        if (ws.readyState !== 1) return false;
        const s = typeof msg === 'string' ? msg : JSON.stringify(msg);
        if (cfg.lagMs) {   // 测试用：模拟网络延迟（带抖动，但和 TCP 一样不乱序）
          const at = Math.max(c.lagAt || 0, Date.now() + cfg.lagMs + Math.random() * (cfg.jitterMs || 0)); c.lagAt = at;
          setTimeout(() => { if (ws.readyState === 1) try { ws.send(s); } catch { /* 已断开 */ } }, at - Date.now()); return true;
        }
        try { ws.send(s); return true; } catch { return false; }
      },
      close(code = 1000, reason = '') { try { ws.close(code, reason); } catch { /* 已关闭 */ } },
    };
    ws._c = c;
    return c;
  }

  async function doAuth(c, token, msg) {
    const user = await auth.byToken(token);
    if (!user) { c.send({ t: 'error', code: 'auth', msg: '登录已过期，请重新登录' }); c.close(4001, 'auth'); return; }
    if (msg && msg.ver !== undefined && msg.ver !== NET_VER) { c.send({ t: 'error', code: 'version', msg: '游戏版本已更新，请刷新页面' }); c.close(4002, 'version'); return; }
    c.user = user; c.ver = NET_VER; c.build = msg && typeof msg.build === 'string' ? msg.build.slice(0, 40) : '';
    const old = clients.get(user.id);
    if (old && old !== c) { old.replaced = true; old.send({ t: 'kicked', msg: '你的账号在其他地方登录了' }); old.close(4003, 'replaced'); }
    clients.set(user.id, c);
    c.send({ t: 'welcome', user, ver: NET_VER, serverTime: Date.now(), boot: cfg.boot });
    for (const f of hooks.connect) { try { f(c, ctx); } catch (e) { ctx.log('onConnect 出错', e.stack || e); } }
  }

  function onConn(ws, ip, qtoken) {
    const c = makeClient(ws, ip);
    const authTimer = setTimeout(() => { if (!c.user) c.close(4001, 'auth timeout'); }, 5000);
    if (qtoken) doAuth(c, qtoken, null);
    ws.on('pong', () => { c.alive = true; });
    ws.on('message', (data, isBin) => {
      c.alive = true;
      if (isBin) return;
      if (!c.rl(1)) {   // 超出频率：丢弃；持续刷屏就断开
        if (++c.dropped > cfg.wsRate[0] * 3) { c.send({ t: 'error', code: 'flood', msg: '消息太频繁，连接已断开' }); c.close(4008, 'flood'); }
        return;
      }
      let msg; try { msg = JSON.parse(data.toString()); } catch { return; }
      if (!msg || typeof msg !== 'object' || typeof msg.t !== 'string') return;
      if (!c.user) { if (msg.t === 'auth' && typeof msg.token === 'string') doAuth(c, msg.token, msg); return; }
      if (msg.t === 'ping') { c.send({ t: 'pong', ts: msg.ts, st: Date.now() }); return; }
      const h = handlers.get(msg.t);
      if (!h) return;
      try { h(c, msg, ctx); } catch (e) { ctx.log(`WS 消息 ${msg.t} 处理出错`, e.stack || e); }
    });
    ws.on('close', () => {
      clearTimeout(authTimer);
      if (!c.user || closing) return;   // 服务端关闭中：不再跑各模块的下线逻辑（数据库马上要关）
      if (clients.get(c.user.id) === c) clients.delete(c.user.id);
      for (const f of hooks.close) { try { f(c, ctx); } catch (e) { ctx.log('onClose 出错', e.stack || e); } }
    });
    ws.on('error', () => { /* close 会紧跟着触发 */ });
  }

  // 心跳：每 20 秒 ping 一次，上一轮没回 pong 的连接直接断开
  const hb = setInterval(() => {
    for (const ws of wss.clients) {
      const c = ws._c; if (!c) continue;
      if (!c.alive) { ws.terminate(); continue; }
      c.alive = false;
      try { ws.ping(); } catch { /* 忽略 */ }
    }
  }, cfg.pingEvery);
  hb.unref();

  return {
    clients, wss,
    get: id => clients.get(id),
    sendTo(id, msg) { const c = clients.get(id); return c ? c.send(msg) : false; },
    broadcast(msg, filter) { const s = JSON.stringify(msg); let n = 0; for (const c of clients.values()) if (!filter || filter(c)) { if (c.send(s)) n++; } return n; },
    kick(id, msg) { const c = clients.get(id); if (c) { c.send({ t: 'kicked', msg }); c.close(4004, 'kicked'); } },
    close() { closing = true; clearInterval(hb); for (const c of clients.values()) c.close(1001, 'server shutdown'); wss.close(); },
  };
}
