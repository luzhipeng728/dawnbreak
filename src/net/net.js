/* =====================================================================
   联机客户端核心：HTTP 接口封装、登录状态、WebSocket（鉴权、心跳测延迟、断线自动重连）、消息订阅
   对外（其他组也可以用，接口约定见协作板）：
     net.api(method, path, body) → Promise<JSON>（失败抛 Error，带 .status / .data）
     net.on(type, fn) → 取消函数；net.off(type, fn)；net.send({ t, ... }) → 是否发出
     net.user（{ id, name, admin } | null）、net.connected、net.rtt（毫秒）、netOn()（已登录）
     bus 事件：netLogin { user } / netLogout / netOpen（连上 / 重连成功）/ netClose
   服务器地址：网页版默认同源（/api、/ws）；?server=http://127.0.0.1:18790 可以指定（本地调试）。离线单文件（file://）没有联机功能
   ===================================================================== */
const NET_VER = 1;
const NET_STORE = 'dawnbreak_net_v1';
const net = {
  base: '', avail: false, probed: false, user: null, token: null, ws: null, connected: false, rtt: 0, ready: false,
  handlers: {}, retry: 0, retryT: 0, stopped: false, lastPong: 0, pingT: 0, clockOff: 0,
  // 这个页面能不能用联机（网页版同源，或者 ?server= 指定）
  canUse() {
    if (PARAMS.has('server')) return true;
    return /^https?:$/.test(location.protocol) && !PARAMS.has('offline');
  },
  init() {
    if (!this.canUse()) return;
    this.base = PARAMS.has('server') ? PARAMS.get('server').replace(/\/$/, '') : '';
    try { const s = JSON.parse(localStorage.getItem(NET_STORE) || 'null'); if (s && s.token && s.user) { this.token = s.token; this.user = s.user; } } catch (e) { /* 忽略 */ }
    // 探测服务器：/api/health 通了才显示登录入口（静态托管、服务端没起时保持单机界面）
    this.probe = fetch(this.base + '/api/health', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(j => { this.avail = !!(j && j.ok); }).catch(() => { this.avail = false; }).finally(() => { this.probed = true; bus.emit('netProbe', { ok: this.avail }); });
    addEventListener('online', () => { if (this.token && !this.connected) this.connect(true); });
  },
  store() { try { if (this.token) localStorage.setItem(NET_STORE, JSON.stringify({ token: this.token, user: this.user })); else localStorage.removeItem(NET_STORE); } catch (e) { /* 无痕模式 */ } },
  async api(method, path, body, o = {}) {
    const ctl = new AbortController(), tm = setTimeout(() => ctl.abort(), o.timeout || 12000);
    let r;
    try {
      r = await fetch(this.base + path, { method, headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(this.token ? { Authorization: 'Bearer ' + this.token } : {}) },
        body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body), signal: ctl.signal, cache: 'no-store' });
    } catch (e) { const er = new Error('连接服务器失败，请检查网络'); er.status = 0; er.offline = true; throw er; }
    finally { clearTimeout(tm); }
    let data = null; try { data = await r.json(); } catch (e) { data = {}; }
    if (!r.ok) {
      const er = new Error((data && data.error) || `服务器返回 ${r.status}`); er.status = r.status; er.data = data;
      if (r.status === 401 && this.token && !o.noAuthReset) this.authLost();
      throw er;
    }
    return data;
  },
  setLogin(token, user) { this.token = token; this.user = user; this.store(); bus.emit('netLogin', { user }); this.connect(); },
  // 登录失效（token 过期 / 被停用）
  authLost() {
    if (!this.token) return;
    this.disconnect(); this.token = null; const u = this.user; this.user = null; this.store();
    toastMsg('登录已过期，请重新登录', '#ff9a6a');
    bus.emit('netLogout', { user: u, lost: true });
  },
  logoutLocal() { this.disconnect(); this.token = null; this.user = null; this.store(); bus.emit('netLogout', {}); },
  /* ---- WebSocket ---- */
  connect(now) {
    if (!this.token || (this.ws && this.ws.readyState <= 1)) return;
    if (performance.now() < this.blockUntil) { clearTimeout(this.retryT); this.retryT = setTimeout(() => this.connect(), this.blockUntil - performance.now() + 50); return; }
    this.stopped = false; clearTimeout(this.retryT);
    const url = (this.base ? this.base.replace(/^http/, 'ws') : (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host) + '/ws';
    let ws;
    try { ws = new WebSocket(url); } catch (e) { this.scheduleRetry(); return; }
    this.ws = ws;
    ws.onopen = () => ws.send(JSON.stringify({ t: 'auth', token: this.token, ver: NET_VER, build: netBuild() }));
    ws.onmessage = ev => { let m; try { m = JSON.parse(ev.data); } catch (e) { return; } this.dispatch(m); };
    ws.onclose = ev => {
      if (this.ws !== ws) return;
      const was = this.connected; this.connected = false; this.ws = null; clearInterval(this.pingT);
      if (was) bus.emit('netClose', { code: ev.code });
      if (ev.code === 4001) { this.authLost(); return; }
      if (ev.code === 4002 || ev.code === 4003 || ev.code === 4004) { this.stopped = true; return; }   // 版本不一致 / 被顶号 / 被踢：不自动重连
      if (!this.stopped) this.scheduleRetry();
    };
    ws.onerror = () => { /* onclose 会紧跟着触发 */ };
  },
  scheduleRetry() {
    if (!this.token || this.stopped) return;
    const ms = Math.min(10000, 800 * Math.pow(1.7, this.retry++)) * (0.8 + Math.random() * 0.4);
    clearTimeout(this.retryT); this.retryT = setTimeout(() => this.connect(), ms);
  },
  disconnect() { this.stopped = true; clearTimeout(this.retryT); clearInterval(this.pingT); const ws = this.ws; this.ws = null; if (ws) try { ws.close(1000); } catch (e) { /* 忽略 */ } if (this.connected) { this.connected = false; bus.emit('netClose', {}); } },
  // 测试用：模拟断网 ms 毫秒（断开 WS，期间不重连）
  blockUntil: 0,
  simDrop(ms) { this.blockUntil = performance.now() + ms; const ws = this.ws; if (ws) { try { ws.close(4000); } catch (e) { /* */ } } },
  send(msg) { const ws = this.ws; if (!ws || ws.readyState !== 1 || !this.connected) return false; try { ws.send(JSON.stringify(msg)); return true; } catch (e) { return false; } },
  on(t, fn) { (this.handlers[t] || (this.handlers[t] = [])).push(fn); return () => this.off(t, fn); },
  off(t, fn) { const L = this.handlers[t]; if (L) { const i = L.indexOf(fn); if (i >= 0) L.splice(i, 1); } },
  dispatch(m) {
    if (m.t === 'welcome') {
      this.connected = true; this.retry = 0; this.user = m.user; this.store(); this.lastPong = performance.now();
      this.clockOff = m.serverTime - Date.now();
      clearInterval(this.pingT); this.pingT = setInterval(() => this.ping(), 2000); this.ping();
      // 服务端重启过（启动编号变了）：服务端内存里的队伍 / 房间都没了，由各自的客户端重新登记（net/coop.js 的 netRestore）
      this.restarted = !!(this.boot && m.boot && m.boot !== this.boot); if (m.boot) this.boot = m.boot;
      bus.emit('netOpen', { user: m.user, restarted: this.restarted });
      if (this.restarted) bus.emit('netRestart', {});
    } else if (m.t === 'pong') {
      const rtt = performance.now() - m.ts; this.lastPong = performance.now();
      if (!document.hidden && m.ts >= (this.visibleSince || 0)) this.rtt = this.rtt ? this.rtt * 0.7 + rtt * 0.3 : rtt;   // 后台期间发出的 ping 回来得晚，不计入延迟
    } else if (m.t === 'error') {
      if (m.code === 'version') { this.stopped = true; netNotice('游戏版本已更新', '服务器的联机版本和你的页面不一致，请刷新页面（Ctrl+F5 / 下拉刷新）后再联机。', true); }
      else if (m.msg) toastMsg(m.msg, '#ff9a6a');
    } else if (m.t === 'kicked') { this.stopped = true; netNotice('已断开联机', m.msg || '你的账号在其他地方登录了', false); }
    const L = this.handlers[m.t]; if (L) for (const fn of L.slice()) { try { fn(m); } catch (e) { console.error(`联机消息 ${m.t} 处理出错`, e); } }
  },
  ping() {
    if (!this.connected) return;
    // 页面在后台时浏览器会把定时器压到每秒 / 每分钟一次，“多久没回音”算不准：后台不做超时判断，
    // 连接保活交给服务端的协议级 ping（浏览器底层自动回 pong，不受页面节流影响）；也不在后台测延迟
    if (document.hidden) return;
    if (performance.now() - this.lastPong > 15000 && this.ws) { try { this.ws.close(4000); } catch (e) { /* */ } return; }   // 前台 15 秒没有回音：当作断线，走重连
    this.send({ t: 'ping', ts: performance.now() });
  },
};
// 切回前台：后台期间的“没回音”不算，重新开始计时并立刻测一次延迟
document.addEventListener('visibilitychange', () => { if (document.hidden) return; net.visibleSince = performance.now(); net.lastPong = performance.now(); net.rtt = 0; if (net.connected) net.ping(); });
const netOn = () => !!(net.user && net.token);
// 当前页面的版本号（build.mjs 按内容算的 BUILD_ID）：队友 / 决斗对手的页面版本不一样时提示刷新（不同版本的怪物 / 技能数据会对不上）
const netBuild = () => BUILD_ID;
// 联机用的确认框：每种提示独立窗口（不会被别的 menus.ask 顶掉，关闭按钮 = 取消）
function netAsk(id, o) {
  if (typeof menus === 'undefined') return;
  const name = 'nd_' + id;
  menus['w_' + name] = () => {
    const done = f => { menus.close(name); sfx.click(); if (f) f(); };
    const txt = h('div', { class: 'asktxt' }); if (o.text instanceof Node) txt.append(o.text); else txt.innerHTML = o.text || '';
    const btns = h('div', { class: 'row', style: 'justify-content:flex-end;margin-top:.6em;gap:.5em' }, h('button', { class: 'btn' + (o.danger ? ' red' : ''), onclick: () => done(o.ok) }, o.okText || '确定'), o.cancelText === null ? null : h('button', { class: 'btn blue', onclick: () => done(o.cancel) }, o.cancelText || '取消'));
    const esc = o.noEsc ? () => {} : () => done(o.cancel);
    const el = menus.win(o.title || '提示', h('div', { class: 'col askbd' }, txt, btns), { block: o.block !== false, onClose: esc, drag: false });
    el.classList.add('askwin', 'netask'); el._onConfirm = () => done(o.ok); el._netEsc = esc;
    if (o.noEsc) { const x = el.querySelector('.hd .x'); if (x) x.remove(); }
    if (o.timeout) setTimeout(() => { if (menus.wins[name] === el && menus.isOpen(name)) done(o.onTimeout || o.cancel); }, o.timeout);
    return el;
  };
  if (menus.isOpen(name)) menus.close(name);
  return menus.open(name);
}
// Esc 关联机提示框 = 点“取消”（带 noEsc 的不响应）
const _netCloseTop = menus.closeTop;
menus.closeTop = function () { const n = this.top(), el = n && this.wins[n]; if (el && el._netEsc) { el._netEsc(); return; } return _netCloseTop.call(this); };
// 重要提示（断线 / 版本不一致等）
function netNotice(title, text, reload) {
  netAsk('notice', { title, text: escHtml(text), okText: reload ? '刷新页面' : '知道了', cancelText: reload ? '稍后' : null, ok: () => { if (reload) location.reload(); } });
}
net.init();
