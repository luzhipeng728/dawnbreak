/* 破晓地下城 · 后台管理（/admin/）
   - 用游戏账号登录，只有 DNF_ADMIN 里的账号能进；token 放在 Authorization 头里（不用 cookie，没有 CSRF 问题），默认只存在本标签页（sessionStorage），勾选“保持登录”才存 localStorage
   - 所有玩家提供的字符串都用 textContent 放进页面（h() 不接受 HTML），没有 eval / innerHTML；页面带 CSP（server/lib/http.js）
   - 接口：/api/gm/*（server/modules/admin.js、gm.js），物品 / 职业 / 场景名字来自网页版构建出的 /catalog.json（tools/item_catalog.mjs） */
'use strict';
(() => {
  const SVGNS = 'http://www.w3.org/2000/svg';
  const TK = 'dnf_admin_token';
  const S = { token: '', me: null, cat: null, items: [], itemMap: new Map(), tab: '', gen: 0, timers: [], drawer: null };
  const V = {
    users: { q: '', filter: 'active', sort: 'id', dir: 'desc', page: 1, size: 30 },
    regs: { days: 7 },
    mail: { mode: 'list', to: '', title: '', body: '', gold: '', cera: '', days: 30, items: [], q: '', last: null },
    errs: { user: '', q: '' },
    logs: { type: '', user: '' },
  };
  const CLS_FALLBACK = { sword: '鬼剑士', gun: '神枪手', mage: '魔法师', fighter: '格斗家' };
  const SLOT_NAME = { weapon: '武器', title: '称号', top: '上衣', head: '头肩', bottom: '下装', belt: '腰带', shoes: '鞋', neck: '项链', bracelet: '手镯', ring: '戒指', support: '辅助装备', stone: '魔法石',
    av_hair: '时装头部', av_hat: '时装帽子', av_face: '时装脸部', av_chest: '时装胸部', av_top: '时装上衣', av_bottom: '时装下装', av_belt: '时装腰带', av_shoes: '时装鞋' };
  const GRADES = ['最下级', '下级', '中级', '上级', '最上级'];
  const LOG_NAME = { 'gm.mail': '发邮件', 'gm.notice': '全服公告', 'gm.ban': '封禁', 'gm.unban': '解封', 'gm.kick': '踢下线', 'gm.password': '重设密码', 'gm.delete': '删除账号', 'gm.undelete': '恢复账号',
    'gm.invite': '生成邀请码', 'gm.invite.del': '删除邀请码', 'auction.list': '拍卖上架', 'auction.buy': '拍卖成交', 'auction.expire': '拍卖到期', 'auction.cancel': '拍卖下架', 'mail.send': '寄信', 'mail.claim': '领取附件',
    signin: '签到', arena: '决斗场', 'guild.create': '创建公会', 'guild.disband': '解散公会', 'guild.shop': '公会商店' };
  const LOG_KEY = { kind: '类型', from: '来自', title: '标题', gold: '金币', cera: '点券', items: '物品', to: '收件人', item: '物品', price: '价格', hours: '时长', fee: '保管费', seller: '卖家', tax: '手续费', day: '日期',
    count: '本月第几次', streak: '连续天数', note: '备注', text: '内容', why: '原因', n: '人数', mails: '邮件数', days: '有效天数', batch: '批次', name: '账号', backup: '备份', vs: '对手', winner: '胜者', codes: '邀请码', code: '邀请码' };
  const ICON = {
    dash: 'M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z',
    users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
    regs: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM19 8v6M22 11h-6',
    mail: 'M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM22 6l-10 7L2 6',
    notice: 'M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1zM15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13',
    online: 'M22 12h-4l-3 9L9 3l-3 9H2',
    errs: 'M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01',
    logs: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
    refresh: 'M23 4v6h-6M1 20v-6h6M3.5 9a9 9 0 0 1 14.9-3.4L23 10M1 14l4.6 4.4A9 9 0 0 0 20.5 15',
    out: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
    x: 'M18 6 6 18M6 6l12 12',
  };
  const TABS = [['dash', '概况'], ['users', '账号'], ['regs', '注册'], ['mail', '发邮件'], ['notice', '公告'], ['online', '在线'], ['errs', '报错'], ['logs', '日志']];

  /* ---------- 小工具 ---------- */
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'class') el.className = v;
      else if (k === 'style') el.style.cssText = v;
      else if (k === 'value') el.value = v;
      else if (k === 'checked' || k === 'disabled' || k === 'selected') el[k] = !!v;
      else el.setAttribute(k, v === true ? '' : String(v));
    }
    add(el, kids);
    return el;
  }
  const put = (el, ...kids) => { el.replaceChildren(); return add(el, kids); };
  function add(el, kids) { for (const k of kids.flat(Infinity)) if (k != null && k !== false) el.append(k instanceof Node ? k : document.createTextNode(String(k))); return el; }
  function icon(name) {
    const s = document.createElementNS(SVGNS, 'svg');
    for (const [k, v] of Object.entries({ viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.8', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' })) s.setAttribute(k, v);
    const p = document.createElementNS(SVGNS, 'path'); p.setAttribute('d', ICON[name]); s.append(p);
    return s;
  }
  function logo() {
    const s = document.createElementNS(SVGNS, 'svg'); s.setAttribute('viewBox', '0 0 32 32'); s.setAttribute('aria-hidden', 'true');
    const el = (tag, a) => { const e = document.createElementNS(SVGNS, tag); for (const k in a) e.setAttribute(k, a[k]); s.append(e); };
    el('rect', { x: 1, y: 1, width: 30, height: 30, rx: 8, fill: '#1e1a24', stroke: '#3d3545' });
    el('path', { d: 'M8 21a8 8 0 0 1 16 0z', fill: '#e3a94a' });
    el('path', { d: 'M16 6v3M8.2 9.8l2 2M23.8 9.8l-2 2M4.5 15.5h2.6M24.9 15.5h2.6', stroke: '#ffd98e', 'stroke-width': 1.8, 'stroke-linecap': 'round' });
    el('path', { d: 'M5 21.5h22', stroke: '#ffd98e', 'stroke-width': 1.6, 'stroke-linecap': 'round' });
    el('path', { d: 'M9 25h14', stroke: '#6d6459', 'stroke-width': 1.4, 'stroke-linecap': 'round' });
    return s;
  }
  const store = {
    get() { try { return sessionStorage.getItem(TK) || localStorage.getItem(TK) || ''; } catch (e) { return ''; } },
    set(t, keep) { try { (keep ? localStorage : sessionStorage).setItem(TK, t); } catch (e) { S.token = t; } },
    clear() { try { sessionStorage.removeItem(TK); localStorage.removeItem(TK); } catch (e) { S.token = ''; } },
  };
  const fmtN = n => (Math.floor(Number(n) || 0)).toLocaleString('zh-CN');
  const pad = n => String(n).padStart(2, '0');
  const fmtT = t => { if (!t) return '—'; const d = new Date(t), y = d.getFullYear() !== new Date().getFullYear(); return `${y ? d.getFullYear() + '-' : ''}${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  const ago = t => { if (!t) return '—'; const s = (Date.now() - t) / 1000; if (s < 60) return '刚刚'; if (s < 3600) return `${Math.floor(s / 60)} 分钟前`; if (s < 86400) return `${Math.floor(s / 3600)} 小时前`; if (s < 86400 * 30) return `${Math.floor(s / 86400)} 天前`; return fmtT(t); };
  const dur = sec => { sec = Math.max(0, Math.floor(sec)); const d = Math.floor(sec / 86400), hh = Math.floor(sec % 86400 / 3600), m = Math.floor(sec % 3600 / 60); return d ? `${d} 天 ${hh} 小时` : hh ? `${hh} 小时 ${m} 分` : `${m} 分钟`; };
  const bytes = b => b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.round(b / 1024)} KB`;
  const clsName = (cls, job) => { const C = S.cat && S.cat.classes && S.cat.classes[cls]; if (job) return (C && C.jobs[job]) || job; return C ? C.name : CLS_FALLBACK[cls] || cls || '?'; };
  const sceneName = id => (S.cat && S.cat.scenes && S.cat.scenes[id]) || id || '—';
  const itemName = key => { const it = S.itemMap.get(key); return it ? it.name : key; };
  const rid = () => Array.from(crypto.getRandomValues(new Uint8Array(9)), b => b.toString(36).padStart(2, '0')).join('').slice(0, 16);
  const loading = () => h('div', { class: 'loading' }, '加载中…');
  const empty = t => h('div', { class: 'empty' }, t);
  function table(cols, rows, o = {}) {
    return h('div', { class: 'tw' }, rows.length ? h('table', { class: 't' },
      h('thead', {}, h('tr', {}, cols.map(c => typeof c === 'string' ? h('th', {}, c) : c))), h('tbody', {}, rows)) : empty(o.empty || '没有数据'));
  }

  /* ---------- 接口 / 提示 ---------- */
  class ApiErr extends Error { constructor(status, msg) { super(msg); this.status = status; } }
  async function api(method, url, body) {
    let r;
    try { r = await fetch(url, { method, cache: 'no-store', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + S.token }, body: body ? JSON.stringify(body) : undefined }); }
    catch (e) { throw new ApiErr(0, '连不上服务器，请检查网络'); }
    let d = {}; try { d = await r.json(); } catch (e) { d = {}; }
    if (!r.ok) throw new ApiErr(r.status, d.error || `请求失败（${r.status}）`);
    return d;
  }
  function toast(msg, kind = '') {
    let box = document.querySelector('.toasts'); if (!box) { box = h('div', { class: 'toasts', 'aria-live': 'polite' }); document.body.append(box); }
    const t = h('div', { class: 'toast ' + kind }, msg); box.append(t);
    setTimeout(() => t.remove(), kind === 'err' ? 6000 : 3500);
  }
  function fail(e) {
    if (e && e.status === 401) { store.clear(); showLogin('登录已过期，请重新登录'); return; }
    toast((e && e.message) || String(e), 'err');
  }
  function modal({ title, body, okText = '确定', cancelText = '取消', danger = false, wide = false, onOk, noOk = false }) {
    return new Promise(res => {
      const ok = h('button', { class: 'btn ' + (danger ? 'danger' : 'primary') }, okText);
      const cancel = h('button', { class: 'btn ghost' }, cancelText);
      const mb = h('div', { class: 'mb' });
      const box = h('div', { class: 'modal' + (danger ? ' danger' : '') + (wide ? ' wide' : ''), role: 'dialog', 'aria-modal': 'true' }, h('h3', {}, title), mb, h('div', { class: 'mf' }, cancel, noOk ? null : ok));
      add(mb, [typeof body === 'function' ? body(ok) : body]);
      const bg = h('div', { class: 'modal-bg' }, box);
      const key = e => { if (e.key === 'Escape') { e.stopPropagation(); close(false); } };
      const close = v => { bg.remove(); document.removeEventListener('keydown', key, true); res(v); };
      cancel.addEventListener('click', () => close(false));
      bg.addEventListener('mousedown', e => { if (e.target === bg) close(false); });
      ok.addEventListener('click', async () => {
        if (!onOk) { close(true); return; }
        ok.disabled = true;
        try { const v = await onOk(); if (v === false) { ok.disabled = false; return; } close(v === undefined ? true : v); } catch (e) { ok.disabled = false; fail(e); }
      });
      document.addEventListener('keydown', key, true);
      document.body.append(bg);
      const f = box.querySelector('input, textarea, select'); (f || (ok.disabled ? cancel : ok)).focus();
    });
  }
  let catP = null;
  function loadCatalog() {
    if (!catP) {
      catP = fetch('/catalog.json', { cache: 'no-cache' }).then(r => (r.ok ? r.json() : null)).catch(() => null).then(c => {
        if (c && Array.isArray(c.items)) {
          S.cat = c;
          S.items = c.items.map(x => ({ key: x[0], name: x[1], rar: x[2] | 0, kind: x[3], slot: x[4], lvl: x[5] | 0, cls: x[6], icon: x[7] }));
          S.itemMap = new Map(S.items.map(i => [i.key, i]));
        }
        return S.cat;
      });
    }
    return catP;
  }
  function fonts() {
    const l = document.createElement('link'); l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Noto+Serif+SC:wght@600;700&display=swap';
    document.head.append(l);
  }

  /* ---------- 登录 ---------- */
  function brand() { return h('div', { class: 'brand' }, logo(), h('div', {}, h('b', {}, '破晓地下城'), h('small', {}, '后台管理'))); }
  function stopTimers() { S.timers.forEach(clearInterval); S.timers = []; }
  function showLogin(msg) {
    stopTimers(); closeDrawer(); S.me = null; S.token = ''; S.tab = '';
    const user = h('input', { class: 'inp', name: 'user', autocomplete: 'username', maxlength: 32, placeholder: '管理员账号' });
    const pass = h('input', { class: 'inp', name: 'pass', type: 'password', autocomplete: 'current-password', maxlength: 64, placeholder: '密码' });
    const keep = h('input', { type: 'checkbox', id: 'keep' });
    const err = h('div', { class: 'err', role: 'alert' }, msg || '');
    const btn = h('button', { class: 'btn primary', type: 'submit' }, '登录后台');
    const form = h('form', { class: 'card', onsubmit: async ev => {
      ev.preventDefault();
      if (!user.value.trim() || !pass.value) { err.textContent = '请输入账号和密码'; return; }
      btn.disabled = true; err.textContent = '';
      try {
        const r = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user: user.value.trim(), pass: pass.value }) });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || '登录失败');
        if (!d.user || !d.user.admin) {
          await fetch('/api/logout', { method: 'POST', headers: { Authorization: 'Bearer ' + d.token } }).catch(() => {});
          throw new Error('这个账号不是管理员，不能进入后台');
        }
        S.token = d.token; S.me = d.user; store.set(d.token, keep.checked);
        startApp();
      } catch (e) { err.textContent = e.message || '登录失败'; btn.disabled = false; }
    } },
    brand(), h('h1', {}, '后台登录'), h('div', { class: 'sub' }, '用 DNF_ADMIN 里配置的游戏账号登录'),
    h('label', { for: 'u' }, '账号'), user, h('label', {}, '密码'), pass,
    h('label', { class: 'keep', for: 'keep' }, keep, '保持登录（这台电脑）'), btn, err);
    user.id = 'u';
    put(document.getElementById('app'), h('div', { class: 'login' }, form));
    document.getElementById('app').className = '';
    user.focus();
  }
  async function logout() {
    try { await api('POST', '/api/logout'); } catch (e) { /* 已经失效 */ }
    store.clear(); showLogin('已退出');
  }

  /* ---------- 框架 ---------- */
  let head, mainEl, navEl;
  function startApp() {
    const nav = h('nav', { class: 'nav' }, TABS.map(([id, name]) => h('a', { href: '#' + id, 'data-tab': id }, icon(id), h('span', {}, name))));
    navEl = nav;
    head = h('div', { class: 'head' });
    mainEl = h('div', { class: 'view' });
    const side = h('aside', { class: 'side' }, brand(), nav,
      h('div', { class: 'me' }, h('b', {}, S.me.name), h('div', { class: 'dim small' }, '管理员'), h('button', { class: 'btn ghost sm', title: '退出登录', onclick: logout }, icon('out'), h('span', {}, '退出'))));
    document.getElementById('app').className = '';
    put(document.getElementById('app'), h('div', { class: 'shell' }, side, h('main', { class: 'main' }, head, mainEl)));
    S.tab = '';
    loadCatalog();
    route();
  }
  function route() {
    if (!S.me) return;
    const tab = (location.hash.replace(/^#\/?/, '').split('/')[0]) || 'dash';
    const T = TABS.some(t => t[0] === tab) ? tab : 'dash';
    for (const a of navEl.querySelectorAll('a')) a.classList.toggle('on', a.dataset.tab === T);
    S.tab = T; S.gen++; stopTimers();
    put(mainEl);
    const gen = S.gen, alive = () => gen === S.gen && S.me;
    const run = { dash: viewDash, users: viewUsers, regs: viewRegs, mail: viewMail, notice: viewNotice, online: viewOnline, errs: viewErrs, logs: viewLogs }[T];
    Promise.resolve(run(mainEl, alive)).catch(fail);
  }
  function setHead(title, hint, ...acts) {
    put(head, h('h2', {}, title), hint ? h('span', { class: 'hint' }, hint) : null, h('span', { class: 'sp' }), ...acts);
  }
  const refreshBtn = fn => h('button', { class: 'btn sm', title: '刷新', onclick: fn }, icon('refresh'), h('span', {}, '刷新'));
  const stamp = () => h('span', { class: 'hint' }, '更新于 ' + new Date().toTimeString().slice(0, 8));

  /* ---------- 概况 ---------- */
  async function viewDash(el, alive) {
    setHead('概况', '');
    put(el, loading());
    const [d] = await Promise.all([api('GET', '/api/gm/stats?tz=' + (-new Date().getTimezoneOffset())), loadCatalog()]);
    if (!alive()) return;
    setHead('概况', '', stamp(), refreshBtn(() => viewDash(el, alive)));
    const kpi = (l, v, sub, warn) => h('div', { class: 'kpi' + (warn ? ' warn' : '') }, h('div', { class: 'l' }, l), h('div', { class: 'v' }, fmtN(v)), h('div', { class: 'd' }, sub));
    const U = d.users;
    const kpis = h('div', { class: 'kpis' },
      kpi('注册用户', U.total, `已封禁 ${U.banned} · 已删除 ${U.deleted}`), kpi('今日新增', U.today, `近 7 天 ${U.week}`), kpi('当前在线', d.online, `24 小时内登录 ${U.dau}`),
      kpi('7 日活跃', U.wau, '7 天内登录过的账号'), kpi('角色总数', d.chars, '未删除账号的全部角色'), kpi('客户端报错', d.cerr.day, `24 小时 · 7 天共 ${d.cerr.week}`, d.cerr.day > 0));
    const chart = h('div', { class: 'card' }, h('h3', {}, '近 30 天注册', h('span', { class: 'dim' }, `今天 ${U.today} · 7 天 ${U.week} · 30 天 ${d.regs.reduce((a, b) => a + b, 0)}`)), h('div', { class: 'chart' }, barChart(d.regs, d.day0)));
    const jobs = h('div', { class: 'card' }, h('h3', {}, '职业 / 转职分布', h('span', { class: 'dim' }, `共 ${fmtN(d.chars)} 个角色`)), jobBars(d.jobs));
    const lvMax = Math.max(1, ...d.lv), lvLab = ['1-10', '11-20', '21-30', '31-40', '41-50', '51-60', '60+'];
    const lv = h('div', { class: 'card' }, h('h3', {}, '角色等级'), h('div', { class: 'vbars' }, d.lv.map((n, i) => (i < 6 || n) ? h('div', { class: 'vb', title: `Lv ${lvLab[i]}：${n} 个角色` }, h('b', {}, n), h('i', { style: `height:${Math.round(n / lvMax * 80)}%` }), h('span', {}, lvLab[i])) : null)));
    const errs = h('div', { class: 'card' }, h('h3', {}, '最近 24 小时报错', h('span', { class: 'sp' }), h('a', { href: '#errs', class: 'small' }, '全部 →')),
      d.cerr.top.length ? h('div', { class: 'col' }, d.cerr.top.map(x => h('div', { class: 'small' }, h('span', { class: 'chip' }, h('b', {}, '×' + x.n), `${x.users} 人`), ' ', h('span', { class: 'mono dim' }, x.place), ' ', x.msg))) : empty('没有报错'));
    const sv = d.server;
    const server = h('div', { class: 'card' }, h('h3', {}, '服务器'), h('dl', { class: 'kv' },
      h('dt', {}, '联机协议'), h('dd', { class: 'mono' }, 'v' + sv.ver),
      h('dt', {}, '网页版本'), h('dd', { class: 'mono' }, sv.web || '（没有物品目录）'),
      h('dt', {}, '启动于'), h('dd', {}, `${fmtT(sv.boot)}（已运行 ${dur(sv.uptime)}）`),
      h('dt', {}, 'Node'), h('dd', { class: 'mono' }, sv.node),
      h('dt', {}, '内存'), h('dd', { class: 'mono' }, `${bytes(sv.rss)}（堆 ${bytes(sv.heap)}）`),
      h('dt', {}, '数据库'), h('dd', { class: 'mono' }, bytes(sv.db)),
      h('dt', {}, '物品目录'), h('dd', {}, sv.items ? `${fmtN(sv.items)} 件（发物品邮件时校验 key）` : h('span', { class: 'red' }, '服务端读不到 catalog.json，发邮件只校验格式')),
      h('dt', {}, 'GM 邮件'), h('dd', {}, `近 7 天发了 ${d.gmMail7} 次`)));
    put(el, kpis, h('div', { class: 'grid g2' }, chart, jobs), h('div', { class: 'grid g3', style: 'margin-top:14px' }, lv, errs, server));
  }
  function barChart(vals, day0) {
    const W = 600, H = 240, pl = 30, pb = 24, pt = 14, n = vals.length, max = Math.max(4, ...vals), bw = (W - pl) / n, ih = H - pb - pt;
    const s = document.createElementNS(SVGNS, 'svg'); s.setAttribute('viewBox', `0 0 ${W} ${H}`); s.setAttribute('role', 'img'); s.setAttribute('aria-label', '近 30 天每天的注册人数');
    const el = (tag, a, text) => { const e = document.createElementNS(SVGNS, tag); for (const k in a) e.setAttribute(k, a[k]); if (text != null) e.textContent = text; s.append(e); return e; };
    for (const f of [0, 0.5, 1]) { const y = pt + ih * (1 - f); el('line', { x1: pl, x2: W, y1: y, y2: y, class: 'grid-l' }); el('text', { x: pl - 6, y: y + 3, 'text-anchor': 'end', class: 'axis' }, Math.round(max * f)); }
    vals.forEach((v, i) => {
      const bh = Math.max(v ? 2 : 0, v / max * ih), x = pl + i * bw + 2, day = new Date(day0 - (n - 1 - i) * 86400000), lab = `${pad(day.getMonth() + 1)}-${pad(day.getDate())}`;
      const r = el('rect', { x, y: pt + ih - bh, width: Math.max(1, bw - 4), height: bh, rx: 2, class: 'bar' + (i === n - 1 ? ' today' : '') });
      const t = document.createElementNS(SVGNS, 'title'); t.textContent = `${lab}：${v} 人`; r.append(t);
      if (v) el('text', { x: x + (bw - 4) / 2, y: pt + ih - bh - 3, 'text-anchor': 'middle', class: 'axis' }, v);
      if ((n - 1 - i) % 5 === 0) el('text', { x: x + (bw - 4) / 2, y: H - 6, 'text-anchor': 'middle', class: 'axis' }, i === n - 1 ? '今天' : lab);
    });
    return s;
  }
  function jobBars(jobs) {
    if (!jobs.length) return empty('还没有角色');
    const order = [...Object.keys((S.cat && S.cat.classes) || CLS_FALLBACK)], by = {};
    for (const j of jobs) (by[j.cls] = by[j.cls] || []).push(j);
    for (const c in by) if (!order.includes(c)) order.push(c);
    const max = Math.max(...jobs.map(j => j.n));
    return h('div', { class: 'hbars' }, order.filter(c => by[c]).map(c => {
      const L = by[c].sort((a, b) => (a.job ? 1 : 0) - (b.job ? 1 : 0) || b.n - a.n), tot = L.reduce((s, j) => s + j.n, 0);
      return h('div', { class: 'hcls' }, h('div', { class: 't' }, clsName(c), h('span', { class: 'dim small mono' }, `${tot} 个`)),
        L.map(j => h('div', { class: 'hbar', title: `${j.job ? clsName(c, j.job) : clsName(c) + '（未转职）'}：${j.n} 个，平均 Lv${j.avglv}，最高 Lv${j.maxlv}` },
          h('span', { class: j.job ? '' : 'dim' }, j.job ? clsName(c, j.job) : '未转职'), h('div', { class: 'track' }, h('div', { class: 'fill' + (j.job ? '' : ' base'), style: `width:${Math.max(2, j.n / max * 100)}%` })), h('span', { class: 'num small' }, j.n))));
    }));
  }

  /* ---------- 账号 ---------- */
  function statusTags(u) {
    return [u.deleted ? h('span', { class: 'tag del' }, '已删除') : u.banned ? h('span', { class: 'tag bad' }, '已封禁') : h('span', { class: 'tag ok' }, '正常'),
      u.online ? h('span', { class: 'tag ok', title: '在线' }, h('span', { class: 'dot' }), '在线') : null, u.admin ? h('span', { class: 'tag gm' }, '管理员') : null];
  }
  const charChip = c => h('span', { class: 'chip', title: `${c.name} · ${clsName(c.cls)}${c.job ? ' · ' + clsName(c.cls, c.job) : ''} · Lv${c.lvl}` }, h('b', {}, 'Lv' + c.lvl), clsName(c.cls, c.job));
  async function viewUsers(el, alive) {
    const Q = V.users;
    await loadCatalog();
    const q = h('input', { class: 'inp', type: 'search', placeholder: '搜索用户名 / 角色名 / IP / #ID', value: Q.q, style: 'width:min(320px,100%)' });
    const filter = h('select', { class: 'inp' }, [['active', '正常 + 封禁'], ['banned', '只看封禁'], ['online', '只看在线'], ['deleted', '已删除'], ['all', '全部']].map(([v, t]) => h('option', { value: v, selected: v === Q.filter }, t)));
    const size = h('select', { class: 'inp', title: '每页条数' }, [20, 30, 50, 100].map(n => h('option', { value: n, selected: n === Q.size }, `${n} 条 / 页`)));
    const box = h('div', {}, loading());
    let timer = 0;
    const load = async () => {
      const p = new URLSearchParams({ q: Q.q, filter: Q.filter, sort: Q.sort, dir: Q.dir, page: Q.page, size: Q.size });
      const d = await api('GET', '/api/gm/users?' + p);
      if (!alive()) return;
      Q.page = d.page;
      const th = (key, label, num) => {
        const on = Q.sort === key;
        return h('th', { class: 'sort' + (on ? ' on' : '') + (num ? ' num' : ''), title: '点击排序', onclick: () => { if (Q.sort === key) Q.dir = Q.dir === 'desc' ? 'asc' : 'desc'; else { Q.sort = key; Q.dir = key === 'name' ? 'asc' : 'desc'; } Q.page = 1; load().catch(fail); } }, label, on ? (Q.dir === 'desc' ? ' ↓' : ' ↑') : '');
      };
      const rows = d.list.map(u => h('tr', { class: 'click', 'data-id': u.id, onclick: () => openUser(u.id) },
        h('td', { class: 'mono dim' }, '#' + u.id), h('td', { style: 'font-weight:600' }, u.name), h('td', {}, h('div', { class: 'chips' }, statusTags(u))),
        h('td', {}, h('div', { class: 'chips' }, u.chars.slice(0, 3).map(charChip), u.chars.length > 3 ? h('span', { class: 'chip' }, `+${u.chars.length - 3}`) : null, u.chars.length ? null : h('span', { class: 'faint small' }, '没有角色'))),
        h('td', { class: 'num' }, fmtN(u.cera)), h('td', { class: 'num' }, fmtN(u.gold)),
        h('td', { class: 'nowrap small', title: fmtT(u.created) }, fmtT(u.created)), h('td', { class: 'nowrap small', title: fmtT(u.lastLogin) }, ago(u.lastLogin)),
        h('td', { class: 'mono small dim' }, u.lastIp || '—')));
      const pager = h('div', { class: 'pager' }, h('span', {}, `共 ${fmtN(d.total)} 个账号`), h('span', { class: 'sp' }),
        h('button', { class: 'btn sm', disabled: d.page <= 1, onclick: () => { Q.page = d.page - 1; load().catch(fail); } }, '上一页'),
        h('span', { class: 'mono' }, `${d.page} / ${d.pages}`),
        h('button', { class: 'btn sm', disabled: d.page >= d.pages, onclick: () => { Q.page = d.page + 1; load().catch(fail); } }, '下一页'));
      put(box, table([th('id', 'ID'), th('name', '用户名'), '状态', th('lvl', '角色'), th('cera', '点券', 1), th('gold', '金币', 1), th('created', '注册时间'), th('login', '最近登录'), '最近 IP'], rows, { empty: '没有符合条件的账号' }), pager);
    };
    q.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => { Q.q = q.value.trim(); Q.page = 1; load().catch(fail); }, 300); });
    filter.addEventListener('change', () => { Q.filter = filter.value; Q.page = 1; load().catch(fail); });
    size.addEventListener('change', () => { Q.size = +size.value; Q.page = 1; load().catch(fail); });
    setHead('账号', '点一行看详情：角色 / 邮件 / 登录记录，封禁、踢下线、重设密码', refreshBtn(() => load().catch(fail)));
    put(el, h('div', { class: 'row', style: 'margin-bottom:12px' }, q, filter, h('span', { class: 'sp' }), size), box);
    await load();
  }

  function closeDrawer() { if (S.drawer) { S.drawer.close(); S.drawer = null; } }
  async function openUser(id) {
    closeDrawer();
    const dr = h('div', { class: 'drawer', role: 'dialog', 'aria-modal': 'true' }, loading());
    const bg = h('div', { class: 'drawer-bg' });
    const key = e => { if (e.key === 'Escape' && !document.querySelector('.modal-bg')) closeDrawer(); };
    const me = { id, el: dr, close: () => { dr.remove(); bg.remove(); document.removeEventListener('keydown', key); } };
    bg.addEventListener('click', closeDrawer);
    document.addEventListener('keydown', key);
    document.body.append(bg, dr);
    S.drawer = me;
    const reload = async (list = true) => {
      const d = await api('GET', `/api/gm/users/${id}`);
      if (S.drawer !== me) return;
      renderUser(dr, d, () => reload().catch(fail));
      if (list && S.tab !== 'mail') route();
    };
    await reload(false).catch(e => { put(dr, empty(e.message)); fail(e); });
  }
  function renderUser(dr, d, reload) {
    const u = d.user, sv = d.save;
    const act = (label, cls, fn, dis, title) => h('button', { class: 'btn sm ' + cls, disabled: dis, title: title || null, onclick: fn }, label);
    const adminT = u.admin ? '管理员账号不能在这里操作（由 DNF_ADMIN 配置）' : null;
    const acts = h('div', { class: 'acts' },
      u.banned ? act('解除封禁', '', () => doBan(u, false, reload), u.admin || u.deleted, u.deleted ? '已删除的账号请先恢复' : adminT) : act('封禁', 'danger', () => doBan(u, true, reload), u.admin, adminT),
      act('踢下线', '', () => doKick(u, reload), u.id === S.me.id, u.id === S.me.id ? '不能踢自己' : '作废这个账号的所有登录，在线的立刻断开'),
      act('重设密码', '', () => doPass(u, reload), u.admin, adminT),
      act('发邮件', '', () => { Object.assign(V.mail, { mode: 'list', to: u.name }); closeDrawer(); location.hash = '#mail'; if (S.tab === 'mail') route(); }, u.deleted),
      h('span', { class: 'sp' }),
      u.deleted ? act('恢复账号', '', () => doUndelete(u, reload)) : act('删除账号…', 'danger', () => doDelete(u, reload), u.admin, adminT || '软删除：停用 + 隐藏，数据保留、可以恢复；删除前自动备份数据库'));
    const kv = pairs => h('dl', { class: 'kv' }, pairs.filter(Boolean).flatMap(([k, v]) => [h('dt', {}, k), h('dd', {}, v)]));
    const on = d.online;
    const info = kv([['账号 ID', h('span', { class: 'mono' }, '#' + u.id)], ['注册时间', `${fmtT(u.created)}（${ago(u.created)}）`], ['注册 IP', h('span', { class: 'mono' }, u.regIp || '—')],
      ['最近登录', `${fmtT(u.lastLogin)}（${ago(u.lastLogin)}）`], ['最近 IP', h('span', { class: 'mono' }, u.lastIp || '—')],
      ['在线', on ? [h('span', { class: 'dot' }), ` ${on.char ? `${on.char.name}（${clsName(on.char.cls, on.char.job)} Lv${on.char.lvl}）` : ''} · ${sceneName(on.scene)} · 已在线 ${dur((d.now - on.since) / 1000)} · `, h('span', { class: 'mono' }, on.ip)] : h('span', { class: 'dim' }, '离线')],
      ['云存档', sv ? `${fmtT(sv.updatedAt)} 更新 · ${bytes(sv.size)} · 历史备份 ${sv.history} 份` : h('span', { class: 'dim' }, '还没有云存档')],
      ['点券', sv ? h('span', { class: 'mono gold' }, fmtN(sv.cera)) : '—'], ['账号金库', sv && sv.bank ? `${fmtN(sv.bank.gold)} G · ${sv.bank.items} 件物品` : '—'],
      u.deleted ? ['删除时间', h('span', { class: 'red' }, fmtT(u.deletedAt))] : null]);
    const chars = sv && sv.chars && sv.chars.length ? h('div', { class: 'chars' }, sv.chars.map(c => h('div', { class: 'charc' },
      h('div', { class: 'n' }, c.name || '（无名）'), h('div', { class: 'm' }, `${clsName(c.cls)}${c.job ? ' · ' + clsName(c.cls, c.job) : ''} · Lv${c.lvl} · ${fmtN(c.gold)} G · 背包 ${c.inv} 格 / 仓库 ${c.storage} 格`),
      h('div', { class: 'eq' }, c.equip.length ? c.equip.map(e => h('div', { title: e.key }, h('span', { class: 's' }, SLOT_NAME[e.slot] || e.slot), h('span', { class: 'q' + (e.rar | 0) }, `${e.enh ? '+' + e.enh + ' ' : ''}${e.name}`))) : h('span', { class: 'faint' }, '没有装备'))))) : empty('没有角色');
    const mailSt = m => m.deleted ? h('span', { class: 'tag del' }, '已删除') : m.claimedAt ? h('span', { class: 'tag ok' }, '已领取') : m.expires && m.expires < d.now ? h('span', { class: 'tag' }, '已过期') : m.readAt ? h('span', { class: 'tag info' }, '已读') : h('span', { class: 'tag gm' }, '未读');
    const att = m => [m.gold ? `${fmtN(m.gold)} G` : null, m.cera ? `点券 ${fmtN(m.cera)}` : null, ...m.items.map(e => e.item ? `${e.item.name || e.item.key}×${e.item.n || 1}` : `${itemName(e.key)}${e.opt && e.opt.enh ? ' +' + e.opt.enh : ''}×${e.n}`)].filter(Boolean).join('、') || '—';
    const mails = table(['时间', '来自', '标题', '附件', '状态'], d.mails.map(m => h('tr', {}, h('td', { class: 'nowrap small' }, fmtT(m.created)), h('td', { class: 'small' }, m.from), h('td', {}, m.title), h('td', { class: 'det' }, att(m)), h('td', {}, mailSt(m)))), { empty: '没有邮件' });
    const ua = s => { const m = /(Edg|Chrome|Firefox|Safari)\/[\d.]+/.exec(s || ''); const os = /iPhone|iPad|Android|Mac OS X|Windows|Linux/.exec(s || ''); return `${m ? m[1] : '未知浏览器'}${os ? ' · ' + os[0].replace('Mac OS X', 'Mac') : ''}`; };
    const sess = table(['登录时间', '最近活动', 'IP', '设备', '到期'], d.sessions.map(s => h('tr', {}, h('td', { class: 'nowrap small' }, fmtT(s.created)), h('td', { class: 'nowrap small' }, ago(s.lastSeen)), h('td', { class: 'mono small' }, s.ip || '—'), h('td', { class: 'small', title: s.ua }, ua(s.ua)), h('td', { class: 'nowrap small dim' }, fmtT(s.expires)))), { empty: '没有有效的登录（已全部退出或被踢下线）' });
    const logs = table(['时间', '操作', '操作人', '内容'], d.logs.map(x => h('tr', {}, h('td', { class: 'nowrap small' }, fmtT(x.at)), h('td', { class: 'nowrap small' }, LOG_NAME[x.type] || x.type), h('td', { class: 'small' }, x.user), h('td', { class: 'det' }, logText(x.detail)))), { empty: '没有记录' });
    const errs = d.errs.length ? table(['时间', '位置', '消息', '版本'], d.errs.map(x => h('tr', {}, h('td', { class: 'nowrap small' }, fmtT(x.at)), h('td', { class: 'mono small' }, x.place), h('td', { class: 'det' }, x.msg), h('td', { class: 'mono small dim' }, x.ver)))) : null;
    put(dr, 
      h('div', { class: 'dh' }, h('h2', {}, u.name), statusTags({ ...u, online: !!on }), h('span', { class: 'sp' }), h('button', { class: 'btn ghost sm', title: '关闭（Esc）', onclick: closeDrawer }, icon('x'))),
      acts, info,
      h('div', { class: 'sec' }, h('h3', {}, '角色', h('span', { class: 'dim' }, sv ? `${sv.chars.length} 个` : '')), chars),
      h('div', { class: 'sec' }, h('h3', {}, '邮件', h('span', { class: 'dim' }, '最近 50 封')), mails),
      h('div', { class: 'sec' }, h('h3', {}, '登录会话', h('span', { class: 'dim' }, `${d.sessions.length} 个`)), sess),
      h('div', { class: 'sec' }, h('h3', {}, '相关日志', h('span', { class: 'dim' }, '这个账号的操作 + 管理员对它的操作')), logs),
      errs ? h('div', { class: 'sec' }, h('h3', {}, '客户端报错'), errs) : null);
  }
  async function doBan(u, on, reload) {
    const why = h('input', { class: 'inp', maxlength: 100, placeholder: '原因（可不填，会记进操作日志）', style: 'width:100%' });
    const ok = await modal({ title: on ? `封禁「${u.name}」` : `解除封禁「${u.name}」`, danger: on, okText: on ? '封禁' : '解除封禁',
      body: [h('p', {}, on ? '封禁后这个账号立刻下线，所有登录作废，不能再登录。数据都会保留，随时可以解除。' : '解除后这个账号可以重新登录。'), why],
      onOk: () => api('POST', `/api/gm/users/${u.id}/ban`, { on, reason: why.value }) });
    if (ok) { toast(on ? `已封禁 ${u.name}` : `已解除封禁 ${u.name}`, 'ok'); reload(); }
  }
  async function doKick(u, reload) {
    const r = await modal({ title: `让「${u.name}」下线`, okText: '踢下线', body: h('p', {}, '作废这个账号的所有登录（包括游戏和其他设备），在线的立刻断开，需要重新输入密码登录。'), onOk: () => api('POST', `/api/gm/users/${u.id}/logout`) });
    if (r) { toast(`已作废 ${r.sessions} 个登录${r.online ? '，并踢下线' : ''}`, 'ok'); reload(); }
  }
  async function doPass(u, reload) {
    const p1 = h('input', { class: 'inp', type: 'text', autocomplete: 'new-password', maxlength: 64, placeholder: '新密码（6~64 位）', style: 'flex:1' });
    const gen = h('button', { class: 'btn sm', type: 'button', onclick: () => { p1.value = rid().slice(0, 10); p1.select(); } }, '随机生成');
    const ok = await modal({ title: `重设「${u.name}」的密码`, okText: '重设密码',
      body: [h('p', {}, '重设后这个账号的所有登录作废，要用新密码重新登录。把新密码私下告诉玩家。'), h('div', { class: 'row' }, p1, gen)],
      onOk: () => { if (p1.value.length < 6) { toast('密码至少 6 位', 'err'); return false; } return api('POST', `/api/gm/users/${u.id}/password`, { pass: p1.value }); } });
    if (ok) { toast(`已重设 ${u.name} 的密码`, 'ok'); reload(); }
  }
  async function doDelete(u, reload) {
    const inp = h('input', { class: 'inp', maxlength: 40, placeholder: `输入用户名 ${u.name} 确认`, style: 'width:100%', autocomplete: 'off' });
    const r = await modal({ title: `删除账号「${u.name}」`, danger: true, okText: '确认删除',
      body: ok => {
        ok.disabled = true;
        inp.addEventListener('input', () => { ok.disabled = inp.value !== u.name; });
        return [h('div', { class: 'warnbox' }, '一般情况下用“封禁”就够了。'),
          h('p', {}, '删除是软删除：账号立即停用、踢下线，并从账号列表里隐藏（在“已删除”里能找到），存档、邮件等数据都保留，可以恢复。删除前服务器会自动把整个数据库备份一份。'),
          h('p', {}, '请输入完整的用户名确认：'), inp];
      },
      onOk: () => api('POST', `/api/gm/users/${u.id}/delete`, { confirm: inp.value }) });
    if (r) { toast(`已删除 ${u.name}${r.backup ? `（备份 ${r.backup}）` : ''}`, 'ok'); reload(); }
  }
  async function doUndelete(u, reload) {
    const ok = await modal({ title: `恢复账号「${u.name}」`, okText: '恢复', body: h('p', {}, '恢复后账号回到列表里，但仍是封禁状态；确认没问题再点“解除封禁”。'), onOk: () => api('POST', `/api/gm/users/${u.id}/undelete`) });
    if (ok) { toast(`已恢复 ${u.name}（仍是封禁状态）`, 'ok'); reload(); }
  }

  /* ---------- 注册 ---------- */
  async function viewRegs(el, alive) {
    const Q = V.regs;
    setHead('注册', '');
    put(el, loading());
    const [d] = await Promise.all([api('GET', `/api/gm/regs?days=${Q.days}&limit=300`), loadCatalog()]);
    if (!alive()) return;
    const seg = h('div', { class: 'seg' }, [[1, '24 小时'], [7, '7 天'], [30, '30 天'], [90, '90 天']].map(([n, t]) => h('button', { class: Q.days === n ? 'on' : '', onclick: () => { Q.days = n; viewRegs(el, alive).catch(fail); } }, t)));
    setHead('注册', `同一个 IP 注册 ${d.flagAt} 个以上账号的标红`, seg, refreshBtn(() => viewRegs(el, alive).catch(fail)));
    const goUser = name => { V.users.q = name; V.users.filter = 'all'; V.users.page = 1; location.hash = '#users'; };
    const ips = table(['IP', '账号数', `近 ${Q.days} 天`, '第一次', '最近一次', '已封禁', '账号'], d.ips.map(x => h('tr', { class: x.flag ? 'flag' : '' },
      h('td', { class: 'mono' }, x.ip), h('td', { class: 'num' }, x.flag ? h('span', { class: 'tag bad' }, '×' + x.n) : x.n), h('td', { class: 'num' }, x.recent), h('td', { class: 'nowrap small' }, fmtT(x.first)), h('td', { class: 'nowrap small' }, fmtT(x.last)), h('td', { class: 'num' }, x.banned || 0),
      h('td', {}, h('div', { class: 'chips' }, x.names.map(n => h('a', { class: 'chip', href: '#users', onclick: e => { e.preventDefault(); goUser(n); } }, n)), x.n > x.names.length ? h('span', { class: 'chip' }, `+${x.n - x.names.length}`) : null)))), { empty: '没有同一个 IP 注册多个账号的情况' });
    const list = table(['注册时间', '用户名', '注册 IP', '第一个角色', '角色数', '最近登录', '状态'], d.list.map(x => h('tr', { class: 'click' + (x.flag ? ' flag' : ''), onclick: () => openUser(x.id) },
      h('td', { class: 'nowrap small' }, fmtT(x.created)), h('td', { style: 'font-weight:600' }, x.name),
      h('td', {}, h('span', { class: 'mono small' }, x.ip || '—'), x.sameIp > 1 ? [' ', h('span', { class: 'tag ' + (x.flag ? 'bad' : 'info'), title: '这个 IP 一共注册的账号数' }, `同 IP ×${x.sameIp}`)] : null),
      h('td', {}, x.char ? [h('span', { style: 'font-weight:600' }, x.char.name), ' ', h('span', { class: 'dim small' }, `${clsName(x.char.cls, x.char.job)} Lv${x.char.lvl}`)] : h('span', { class: 'faint small' }, '还没建角色')),
      h('td', { class: 'num' }, x.nchars), h('td', { class: 'nowrap small' }, ago(x.lastLogin)), h('td', {}, h('div', { class: 'chips' }, statusTags(x))))), { empty: `近 ${Q.days} 天没有新注册` });
    put(el, h('div', { class: 'col', style: 'gap:14px' },
      h('div', { class: 'sec', style: 'margin:0' }, h('h3', {}, '同一个 IP 注册的多个账号', h('span', { class: 'dim' }, '全部时间，按账号数排序')), ips),
      h('div', { class: 'sec', style: 'margin:0' }, h('h3', {}, '最近注册', h('span', { class: 'dim' }, `近 ${Q.days} 天 ${d.list.length} 个${d.list.length >= 300 ? '（只显示最新 300 个）' : ''}`)), list)));
  }

  /* ---------- 发邮件 ---------- */
  async function viewMail(el, alive) {
    const M = V.mail;
    setHead('发邮件', '以“管理员”的名义发到玩家邮箱，玩家在游戏里领取');
    put(el, loading());
    await loadCatalog();
    if (!alive()) return;
    const left = h('div', { class: 'card' }), right = h('div', { class: 'card' }, h('h3', {}, '发送记录', h('span', { class: 'sp' }), refreshBtn(() => hist().catch(fail))), h('div', { class: 'mhist' }, loading()));
    put(el, h('div', { class: 'grid gmail' }, left, right));
    const hist = async () => {
      const d = await api('GET', '/api/gm/mails?limit=40');
      if (!alive()) return;
      const box = right.querySelector('.mhist');
      put(box, ...(d.list.length ? d.list.map(x => {
        const st = x.stat, pct = st && st.n ? Math.round(st.claimed / st.n * 100) : 0;
        const to = x.to === '全体' ? '全体玩家' : Array.isArray(x.to) ? x.to.join('、') : String(x.to || '');
        const items = Array.isArray(x.items) ? x.items.map(s => String(s).replace(/^([a-z0-9_]+)×/, (m, k) => itemName(k) + '×')).join('、') : '';
        return h('div', { class: 'mh' }, h('div', { class: 'row' }, h('span', { class: 'ti' }, x.title || '（无标题）'), h('span', { class: 'sp' }), h('span', { class: 'dim small' }, `${fmtT(x.at)} · ${x.by}`)),
          h('div', { class: 'me2' }, `发给 ${to}（${x.n} 人${x.mails && x.mails !== x.n ? `，${x.mails} 封` : ''}）`),
          h('div', { class: 'me2' }, [x.gold ? `${fmtN(x.gold)} G` : '', x.cera ? `点券 ${fmtN(x.cera)}` : '', items].filter(Boolean).join(' · ') || '（只有文字）'),
          st ? h('div', { class: 'row', style: 'margin-top:6px' }, h('div', { class: 'progress', style: 'flex:1' }, h('i', { style: `width:${pct}%` })), h('span', { class: 'small dim' }, `已领取 ${st.claimed} / ${st.n} · 已读 ${st.seen}`)) : null);
      }) : [empty('还没有发过')]));
    };
    renderMailForm(left, hist);
    await hist();
  }
  function renderMailForm(box, hist) {
    const M = V.mail;
    const inp = (k, a) => { const e = h(a && a.tag || 'input', { class: 'inp', value: M[k], ...(a || {}), tag: null }); e.addEventListener('input', () => { M[k] = e.value; }); return e; };
    const seg = h('div', { class: 'seg' }, [['list', '指定玩家'], ['all', '全体玩家']].map(([v, t]) => h('button', { type: 'button', class: M.mode === v ? 'on' : '', onclick: () => { M.mode = v; renderMailForm(box, hist); } }, t)));
    const to = inp('to', { tag: 'textarea', rows: 2, placeholder: '账号名，多个用逗号、空格或换行隔开（最多 500 个）', style: 'width:100%' });
    const title = inp('title', { maxlength: 40, placeholder: '邮件标题（最多 40 字）' });
    const body = inp('body', { tag: 'textarea', rows: 3, maxlength: 1000, placeholder: '正文（可不填）' });
    const gold = inp('gold', { type: 'number', min: 0, max: 2000000000, placeholder: '0', class: 'inp num', style: 'width:11em' });
    const cera = inp('cera', { type: 'number', min: 0, max: 200000000, placeholder: '0', class: 'inp num', style: 'width:11em' });
    const days = inp('days', { type: 'number', min: 1, max: 365, class: 'inp num', style: 'width:5em' });
    const ceraHint = h('span', { class: 'hint' });
    const upHint = () => { const c = Math.floor(+M.cera || 0); ceraHint.textContent = c > 1e7 ? `超过单封上限 1000 万：每人拆成 ${Math.ceil(Math.min(c, 2e8) / 1e7)} 封` : '单封最多 1000 万，超出自动拆成多封（最多 2 亿）'; };
    cera.addEventListener('input', upHint); upHint();
    const q = h('input', { class: 'inp', type: 'search', value: M.q, placeholder: S.items.length ? `搜索物品名字或 key（${fmtN(S.items.length)} 件），也可以输入 key@强化 回车` : '没有物品目录：直接输入 key@强化 回车', style: 'width:100%', autocomplete: 'off' });
    const res = h('div', { class: 'pres', hidden: true });
    const att = h('div', { class: 'att' });
    const addItem = (key, enh = 0, n = 1) => {
      if (M.items.length >= 5) { toast('每封邮件最多 5 件物品', 'err'); return; }
      const it = S.itemMap.get(key);
      if (S.items.length && !it) { toast(`物品库里没有 ${key}`, 'err'); return; }
      const eq = !it || it.kind === 'equip', canGrade = it && eq && it.rar < 5 && it.slot !== 'title' && !String(it.slot).startsWith('av_');
      M.items.push({ key, n, enh: eq ? enh : 0, grade: canGrade ? 4 : null });
      q.value = ''; M.q = ''; search(); drawAtt();
    };
    const search = () => {
      const kw = q.value.trim().toLowerCase(); M.q = q.value;
      if (!kw || !S.items.length) { res.hidden = true; put(res); return; }
      const base = kw.replace(/@.*$/, '');
      const hits = S.items.filter(i => i.key.toLowerCase().includes(base) || i.name.toLowerCase().includes(base))
        .sort((a, b) => (b.key === base) - (a.key === base) || (b.name === base) - (a.name === base) || b.rar - a.rar || b.lvl - a.lvl).slice(0, 60);
      res.hidden = false;
      put(res, ...(hits.length ? hits.map((i, k) => h('div', { class: 'it' + (k === 0 ? ' act' : ''), 'data-key': i.key, onclick: () => addItem(i.key) },
        itemIcon(i), h('div', {}, h('div', { class: 'q' + i.rar, style: 'font-weight:600' }, i.name), h('div', { class: 'k' }, i.key)),
        h('span', { class: 'lv' }, [i.kind === 'equip' ? SLOT_NAME[i.slot] || i.slot : { use: '消耗品', mat: '材料', quest: '任务' }[i.kind] || i.kind, i.lvl > 1 ? 'Lv' + i.lvl : '', i.cls ? clsName(i.cls) : ''].filter(Boolean).join(' · ')))) : [empty('没有找到')]));
    };
    q.addEventListener('input', search);
    q.addEventListener('keydown', e => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const m = /^([a-z][a-z0-9_]{0,59})(?:@(\d{1,2}))?(?:[x×*](\d{1,4}))?$/i.exec(q.value.trim());
      if (m && (S.itemMap.has(m[1]) || !S.items.length)) { addItem(m[1], Math.min(31, +m[2] || 0), Math.max(1, Math.min(9999, +m[3] || 1))); return; }
      const first = res.querySelector('.it'); if (first) addItem(first.dataset.key);
    });
    const drawAtt = () => {
      put(att, ...(M.items.length ? M.items.map((e, i) => {
        const it = S.itemMap.get(e.key), eq = !it || it.kind === 'equip';
        const n = h('input', { class: 'inp sm num', type: 'number', min: 1, max: 9999, value: e.n, title: '数量' }); n.addEventListener('input', () => { e.n = Math.max(1, Math.min(9999, Math.floor(+n.value) || 1)); });
        const extra = [];
        if (eq) {
          const enh = h('input', { class: 'inp sm num', type: 'number', min: 0, max: 31, value: e.enh, title: '强化等级' }); enh.addEventListener('input', () => { e.enh = Math.max(0, Math.min(31, Math.floor(+enh.value) || 0)); });
          extra.push(h('span', { class: 'small dim' }, '强化 +'), enh);
          if (e.grade != null) { const g = h('select', { class: 'inp sm', title: '品质' }, GRADES.map((t, gi) => h('option', { value: gi, selected: gi === e.grade }, t))); g.addEventListener('change', () => { e.grade = +g.value; }); extra.push(g); }
        }
        return h('div', { class: 'a' }, itemIcon(it || { key: e.key, rar: 0 }), h('div', {}, h('div', { class: 'nm q' + (it ? it.rar : 0) }, it ? it.name : e.key), h('div', { class: 'k mono small faint' }, e.key)),
          h('span', { class: 'sp' }), h('span', { class: 'small dim' }, '数量'), n, ...extra, h('button', { class: 'btn ghost sm', type: 'button', title: '移除', onclick: () => { M.items.splice(i, 1); drawAtt(); } }, icon('x')));
      }) : [h('div', { class: 'hint' }, '没有物品附件（最多 5 件）')]));
    };
    drawAtt(); if (M.q) search();
    const payload = () => ({ to: M.mode === 'all' ? '*' : M.to, title: M.title.trim(), body: M.body, gold: Math.floor(+M.gold || 0), cera: Math.floor(+M.cera || 0), days: Math.floor(+M.days || 30),
      items: M.items.map(e => { const it = S.itemMap.get(e.key), eq = !it || it.kind === 'equip'; return { key: e.key, n: e.n, ...(eq ? { opt: { enh: e.enh || 0, ...(e.grade != null ? { grade: e.grade } : {}) } } : {}) }; }) });
    const result = h('div', {});
    if (M.last) result.append(h('div', { class: 'result' }, M.last));
    const send = h('button', { class: 'btn primary', type: 'button', onclick: async () => {
      const p = payload();
      if (!p.title) { toast('请填写标题', 'err'); title.focus(); return; }
      if (M.mode === 'list' && !String(p.to).trim()) { toast('请填写收件人', 'err'); to.focus(); return; }
      send.disabled = true;
      let pv;
      try { pv = await api('POST', '/api/gm/mail', { ...p, preview: true }); } catch (e) { send.disabled = false; fail(e); return; }
      send.disabled = false;
      const batch = rid();
      const r = await modal({ title: M.mode === 'all' ? '确认发给全体玩家' : '确认发送', wide: true, danger: M.mode === 'all', okText: `发送 ${pv.mails} 封`,
        body: [M.mode === 'all' ? h('div', { class: 'warnbox' }, `将发给全体 ${fmtN(pv.n)} 名玩家（不含封禁 / 删除的账号），发出后不能撤回。`) : null,
          h('dl', { class: 'kv' },
            h('dt', {}, '收件人'), h('dd', {}, `${fmtN(pv.n)} 人`, pv.n <= 50 ? h('div', { class: 'chips', style: 'margin-top:4px' }, pv.names.map(n => h('span', { class: 'chip' }, n))) : h('div', { class: 'dim small' }, pv.names.join('、') + ` …等 ${pv.n} 人`)),
            h('dt', {}, '标题'), h('dd', {}, pv.titles.length > 1 ? pv.titles.join(' / ') : pv.titles[0]),
            h('dt', {}, '每人'), h('dd', {}, `${pv.per} 封${pv.per > 1 ? '（点券超过单封上限，自动拆分）' : ''}，共 ${fmtN(pv.mails)} 封`),
            h('dt', {}, '金币'), h('dd', { class: 'mono' }, fmtN(pv.gold)),
            h('dt', {}, '点券'), h('dd', { class: 'mono' }, fmtN(pv.cera)),
            h('dt', {}, '物品'), h('dd', {}, pv.items.length ? h('div', { class: 'col', style: 'gap:2px' }, pv.items.map(e => { const it = S.itemMap.get(e.key); return h('div', {}, h('span', { class: 'q' + (it ? it.rar : 0) }, `${e.opt && e.opt.enh ? '+' + e.opt.enh + ' ' : ''}${e.name || itemName(e.key)}`), ` ×${e.n}`, e.opt && e.opt.grade != null ? h('span', { class: 'dim small' }, ` · ${GRADES[e.opt.grade]}`) : null, h('span', { class: 'mono faint small' }, ' ' + e.key)); })) : '无'),
            h('dt', {}, '有效期'), h('dd', {}, `${pv.days} 天`)),
          pv.checked ? null : h('div', { class: 'infobox' }, '服务端没有物品目录，只检查了格式；物品 key 不存在时玩家领取会提示“未知物品”。')],
        onOk: () => api('POST', '/api/gm/mail', { ...p, rid: batch }) });
      if (!r) return;
      M.last = `${r.again ? '这一批已经发过了（没有重复发送）' : '发送成功'}：${fmtN(r.n)} 人，共 ${fmtN(r.mails)} 封（批次 ${r.batch}）`;
      toast(M.last, 'ok');
      M.gold = ''; M.cera = ''; M.items = [];
      renderMailForm(box, hist); hist().catch(fail);
    } }, '预览并发送');
    const clear = h('button', { class: 'btn ghost', type: 'button', onclick: () => { Object.assign(M, { to: '', title: '', body: '', gold: '', cera: '', days: 30, items: [], q: '', last: null }); renderMailForm(box, hist); } }, '清空');
    put(box, h('h3', {}, '新邮件'), h('div', { class: 'form' },
      h('label', {}, '收件人'), h('div', { class: 'col' }, seg, M.mode === 'list' ? to : h('div', { class: 'hint' }, '发给所有正常账号（不含封禁和已删除的），发送前会显示人数。')),
      h('label', {}, '标题'), title,
      h('label', {}, '正文'), body,
      h('label', {}, '金币'), h('div', { class: 'row' }, gold, h('span', { class: 'hint' }, '单封最多 20 亿')),
      h('label', {}, '点券'), h('div', { class: 'row' }, cera, ceraHint),
      h('label', {}, '有效期'), h('div', { class: 'row' }, days, h('span', { class: 'hint' }, '天（1~365，过期没领取的邮件会被清掉）')),
      h('label', {}, '物品'), h('div', { class: 'picker' }, q, res, att),
      h('div', { class: 'full row', style: 'margin-top:6px' }, h('span', { class: 'hint' }, '先预览：显示收件人数和拆分结果，确认后才发。'), h('span', { class: 'sp' }), clear, send)), result);
  }
  function itemIcon(i) {
    if (i && i.icon) return h('img', { class: 'ico', src: '/' + i.icon, alt: '', loading: 'lazy' });
    return h('span', { class: 'ico' });
  }

  /* ---------- 公告 ---------- */
  async function viewNotice(el, alive) {
    setHead('全服公告', '发给所有在线玩家，在屏幕上方滚动显示');
    const t = h('textarea', { class: 'inp', rows: 3, maxlength: 120, placeholder: '公告内容（最多 120 字）', style: 'width:100%' });
    const cnt = h('span', { class: 'hint' }, '0 / 120'), pre = h('div', { class: 'notice-pre' }, h('span', { class: 'faint' }, '预览'));
    t.addEventListener('input', () => { cnt.textContent = `${t.value.length} / 120`; put(pre, t.value.trim() ? `【管理员】${t.value.trim()}` : h('span', { class: 'faint' }, '预览')); });
    const hist = h('div', {}, loading());
    const load = async () => {
      const d = await api('GET', '/api/gm/logs?type=gm.notice&limit=50');
      if (!alive()) return;
      put(hist, table(['时间', '发布人', '内容'], d.list.map(x => h('tr', {}, h('td', { class: 'nowrap small' }, fmtT(x.at)), h('td', { class: 'small' }, x.user), h('td', {}, (x.detail && x.detail.text) || ''))), { empty: '还没有发过公告' }));
    };
    const btn = h('button', { class: 'btn primary', onclick: async () => {
      const v = t.value.trim(); if (!v) { toast('请填写公告内容', 'err'); return; }
      const ok = await modal({ title: '发布全服公告', okText: '发布', body: [h('p', {}, '所有在线玩家会立刻看到：'), h('div', { class: 'notice-pre' }, v)], onOk: () => api('POST', '/api/gm/notice', { text: v }) });
      if (ok) { toast('公告已发布', 'ok'); t.value = ''; t.dispatchEvent(new Event('input')); load().catch(fail); }
    } }, '发布公告');
    put(el, h('div', { class: 'grid g2' },
      h('div', { class: 'card' }, h('h3', {}, '新公告'), t, h('div', { class: 'row', style: 'margin:8px 0' }, cnt, h('span', { class: 'sp' }), btn), pre),
      h('div', { class: 'card' }, h('h3', {}, '发布记录'), hist)));
    await load();
  }

  /* ---------- 在线 ---------- */
  async function viewOnline(el, alive) {
    const box = h('div', {}, loading()), info = h('span', { class: 'hint' });
    const load = async () => {
      const [d] = await Promise.all([api('GET', '/api/gm/online'), loadCatalog()]);
      if (!alive()) return;
      info.textContent = `在线 ${d.list.length} 人 · 每 15 秒自动刷新 · ${new Date().toTimeString().slice(0, 8)}`;
      put(box, table(['账号', '角色', '职业', '等级', '位置', '在线时长', 'IP', ''], d.list.sort((a, b) => a.since - b.since).map(o => {
        const c = o.char || {};
        return h('tr', {}, h('td', { style: 'font-weight:600' }, h('a', { href: '#online', onclick: e => { e.preventDefault(); openUser(o.id); } }, o.name), o.admin ? [' ', h('span', { class: 'tag gm' }, '管理员')] : null),
          h('td', {}, c.name || '—'), h('td', { class: 'small' }, c.cls ? clsName(c.cls, c.job) : '—'), h('td', { class: 'num' }, c.lvl ? 'Lv' + c.lvl : '—'),
          h('td', { class: 'small' }, sceneName(o.scene)), h('td', { class: 'small nowrap' }, dur((d.now - o.since) / 1000)), h('td', { class: 'mono small dim' }, o.ip || '—'),
          h('td', {}, o.id === S.me.id ? null : h('button', { class: 'btn sm', onclick: () => doKick({ id: o.id, name: o.name }, () => load().catch(fail)) }, '踢下线')));
      }), { empty: '现在没有人在线' }));
    };
    setHead('在线玩家', '', info, refreshBtn(() => load().catch(fail)));
    put(el, box);
    await load();
    S.timers.push(setInterval(() => { if (!document.hidden && !document.querySelector('.modal-bg')) load().catch(() => {}); }, 15000));
  }

  /* ---------- 客户端报错 ---------- */
  async function viewErrs(el, alive) {
    const Q = V.errs;
    const user = h('input', { class: 'inp', placeholder: '账号名', value: Q.user, style: 'width:9em' }), kw = h('input', { class: 'inp', type: 'search', placeholder: '关键字（消息 / 位置）', value: Q.q, style: 'width:14em' });
    const box = h('div', {}, loading());
    let last = 0;
    const load = async more => {
      const p = new URLSearchParams({ limit: 100 }); if (Q.user) p.set('user', Q.user); if (Q.q) p.set('q', Q.q); if (more && last) p.set('before', last);
      const d = await api('GET', '/api/gm/cerr?' + p);
      if (!alive()) return;
      const rows = d.list.map(x => h('tr', {}, h('td', { class: 'nowrap small' }, fmtT(x.at)), h('td', { class: 'small' }, x.user),
        h('td', { class: 'mono small' }, x.place), h('td', { class: 'det' }, h('div', { style: 'color:var(--text)' }, x.msg), x.info && x.info !== 'null' ? h('div', { class: 'mono' }, x.info) : null,
          x.stack ? h('details', { class: 'stk' }, h('summary', {}, '堆栈'), h('pre', {}, x.stack)) : null), h('td', { class: 'mono small dim' }, x.ver)));
      if (more) { const tb = box.querySelector('.list tbody'); if (tb) add(tb, rows); }
      else {
        const groups = table(['位置', '消息', '次数', '人数', '最近', '版本'], d.groups.map(g => h('tr', {}, h('td', { class: 'mono small' }, g.place), h('td', { class: 'det' }, g.msg), h('td', { class: 'num' }, g.n), h('td', { class: 'num' }, g.users), h('td', { class: 'nowrap small' }, ago(g.last)), h('td', { class: 'mono small dim' }, g.ver))), { empty: '最近 7 天没有报错' });
        const list = table(['时间', '账号', '位置', '消息', '版本'], rows, { empty: '没有报错' }); list.classList.add('list');
        put(box, h('div', { class: 'sec', style: 'margin:0' }, h('h3', {}, '最近 7 天（按位置 + 消息分组）'), groups),
          h('div', { class: 'sec' }, h('h3', {}, '明细', h('span', { class: 'dim' }, `一共保存 ${fmtN(d.total)} 条（最多 5000 条）`)), list), h('div', { class: 'pager more' }));
      }
      if (d.list.length) last = d.list[d.list.length - 1].id;
      const pg = box.querySelector('.more'); if (pg) put(pg, d.list.length >= 100 ? h('button', { class: 'btn sm', onclick: () => load(true).catch(fail) }, '加载更多') : h('span', { class: 'hint' }, '没有更多了'));
    };
    const go = () => { Q.user = user.value.trim(); Q.q = kw.value.trim(); load().catch(fail); };
    for (const i of [user, kw]) i.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
    setHead('客户端报错', '玩家页面逐帧出错时自动上报（同一个错误每个页面报一次）', refreshBtn(go));
    put(el, h('div', { class: 'row', style: 'margin-bottom:12px' }, user, kw, h('button', { class: 'btn', onclick: go }, '查询')), box);
    await load();
  }

  /* ---------- 操作日志 ---------- */
  function logText(o) {
    if (o == null) return '';
    if (typeof o !== 'object') return String(o);
    return Object.keys(o).filter(k => k !== 'uid' && o[k] !== 0 && o[k] !== '' && o[k] != null && !(Array.isArray(o[k]) && !o[k].length)).map(k => {
      const v = o[k];
      const t = Array.isArray(v) ? v.map(x => String(x).replace(/^([a-z][a-z0-9_]*)×/, (m, key) => (S.itemMap.has(key) ? itemName(key) + '×' : m))).join('、') : typeof v === 'object' ? JSON.stringify(v) : typeof v === 'number' && ['gold', 'price', 'fee', 'tax', 'cera'].includes(k) ? fmtN(v) : String(v);
      return k === 'id' ? `#${t}` : `${LOG_KEY[k] || k}：${t}`;
    }).join('；');
  }
  async function viewLogs(el, alive) {
    const Q = V.logs;
    await loadCatalog();
    const sel = h('select', { class: 'inp' }, [['', '全部'], ['gm', '管理员操作'], ['mail', '邮件'], ['auction', '拍卖行'], ['signin', '签到'], ['guild', '公会'], ['arena', '决斗场']].map(([v, t]) => h('option', { value: v, selected: v === Q.type }, t)));
    const user = h('input', { class: 'inp', placeholder: '操作人账号名', value: Q.user, style: 'width:10em' });
    const box = h('div', {}, loading());
    let last = 0;
    const load = async more => {
      const p = new URLSearchParams({ limit: 100 }); if (Q.type) p.set('type', Q.type); if (Q.user) p.set('user', Q.user); if (more && last) p.set('before', last);
      const d = await api('GET', '/api/gm/logs?' + p);
      if (!alive()) return;
      const rows = d.list.map(x => h('tr', {}, h('td', { class: 'nowrap small' }, fmtT(x.at)), h('td', { class: 'nowrap' }, h('span', { class: 'tag' + (x.type.startsWith('gm.') ? ' gm' : '') }, LOG_NAME[x.type] || x.type)), h('td', { class: 'small' }, x.user), h('td', { class: 'det' }, logText(x.detail))));
      if (more) { const tb = box.querySelector('tbody'); if (tb) add(tb, rows); }
      else put(box, table(['时间', '类型', '操作人', '内容'], rows, { empty: '没有日志' }), h('div', { class: 'pager more' }));
      if (d.list.length) last = d.list[d.list.length - 1].id;
      const pg = box.querySelector('.more'); if (pg) put(pg, d.list.length >= 100 ? h('button', { class: 'btn sm', onclick: () => load(true).catch(fail) }, '加载更多') : h('span', { class: 'hint' }, '没有更多了'));
    };
    const go = () => { Q.type = sel.value; Q.user = user.value.trim(); load().catch(fail); };
    sel.addEventListener('change', go); user.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
    setHead('操作日志', '管理员操作、邮件、拍卖、签到等都记在这里', refreshBtn(go));
    put(el, h('div', { class: 'row', style: 'margin-bottom:12px' }, sel, user, h('button', { class: 'btn', onclick: go }, '查询')), box);
    await load();
  }

  /* ---------- 启动 ---------- */
  window.addEventListener('hashchange', route);
  window.addEventListener('load', () => setTimeout(fonts, 0));
  const t0 = store.get();
  if (!t0) showLogin();
  else {
    S.token = t0;
    api('GET', '/api/me').then(r => {
      if (r.user && r.user.admin) { S.me = r.user; startApp(); } else { store.clear(); showLogin('这个账号不是管理员'); }
    }).catch(e => { if (e.status === 401) store.clear(); showLogin(e.status === 401 ? '' : e.message); });
  }
})();
