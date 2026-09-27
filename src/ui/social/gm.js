/* =====================================================================
   管理员后台（gm，只有 DNF_ADMIN 账号能看到）：发放（金币 / 点券 / 物品邮件）、邀请码、在线玩家、全服公告、日志、拍卖行管理
   ===================================================================== */
addStyle(`
.sxgm .gform{display:grid;grid-template-columns:5.5em 1fr;gap:.4em .6em;align-items:center}
.sxgm .gform .sxlbl{text-align:right}
.sxgm .gres{display:flex;flex-direction:column;max-height:11em;overflow:auto;background:#0b090e;border:.1em solid #3a3040;border-radius:.25em}
.sxgm .gres .r{display:flex;align-items:center;gap:.5em;padding:.2em .4em;cursor:pointer;font-size:.86em}
.sxgm .gres .r:hover{background:rgba(120,90,40,.25)}
.sxgm .gres .r img{width:1.8em;height:1.8em}
.sxgm .gatt{display:flex;flex-direction:column;gap:.25em}
.sxgm .gatt .r{display:flex;align-items:center;gap:.4em;font-size:.86em}
.sxgm .gatt .r img{width:1.8em;height:1.8em}
.sxgm .code{font-family:ui-monospace,Menlo,monospace;font-size:1.05em;color:#ffe8a8;user-select:text;-webkit-user-select:text}
.sxgm .det{font-size:.78em;color:#b8ac90;max-width:26em;word-break:break-all}
`);
const SXG = { tab: 'give', g: { to: '', all: false, title: '', body: '', gold: '', cera: '', days: 30, items: [], q: '' }, logType: '', logUser: '', aucStatus: 'on' };
const SXG_TABS = [['give', '发放'], ['invite', '邀请码'], ['online', '在线玩家'], ['notice', '全服公告'], ['logs', '日志'], ['auction', '拍卖行']];
const SXG_LOGS = [['', '全部'], ['auction', '拍卖行'], ['mail', '邮件'], ['signin', '签到'], ['gm', '管理员']];
const SXG_DETAIL = { kind: '类型', from: '来自', title: '标题', gold: '金币', cera: '点券', items: '物品', to: '收件人', item: '物品', price: '价格', hours: '时长', fee: '保管费', seller: '卖家', tax: '手续费', day: '日期', count: '本月第几次', streak: '连续天数', codes: '邀请码', code: '邀请码', note: '备注', text: '内容', why: '原因', n: '人数' };
const SXG_LOGNAME = { 'auction.list': '上架', 'auction.buy': '成交', 'auction.expire': '到期退回', 'auction.cancel': '下架', 'mail.send': '寄信', 'mail.claim': '领取附件', signin: '签到', 'gm.mail': '发放', 'gm.invite': '生成邀请码', 'gm.invite.del': '删除邀请码', 'gm.notice': '公告' };
const sxgLoad = () => {
  const t = SXG.tab;
  if (t === 'invite') return sxApi('GET', '/api/gm/invites');
  if (t === 'online') return sxApi('GET', '/api/gm/online');
  if (t === 'logs') return sxApi('GET', `/api/gm/logs?limit=200${SXG.logType ? '&type=' + SXG.logType : ''}${SXG.logUser ? '&user=' + encodeURIComponent(SXG.logUser) : ''}`);
  if (t === 'auction') return sxApi('GET', `/api/gm/auction${SXG.aucStatus ? '?status=' + SXG.aucStatus : ''}`);
  return Promise.resolve({});
};
Object.assign(menus, {
  w_gm() {
    if (!sxGate('管理员后台')) return null;
    if (!sxAdmin()) { toastMsg('只有管理员账号可以打开后台', '#ffd0a0'); sfx.error(); return null; }
    const el = sxWin('gm', '管理员后台', {
      w: 52, load: sxgLoad,
      render: (el, d) => {
        const tabs = h('div', { class: 'itabs' }, SXG_TABS.map(([id, nm]) => h('div', { class: 'itab' + (SXG.tab === id ? ' on' : ''), onclick: () => { SXG.tab = id; sfx.click(); el._data = undefined; el._reload(); el._render(); } }, nm)));
        const R = { give: sxgGive, invite: sxgInvite, online: sxgOnline, notice: sxgNotice, logs: sxgLogs, auction: sxgAuction }[SXG.tab];
        return [tabs, ...R(el, d)];
      },
    });
    el.classList.add('sxgm');
    return el;
  },
});
const sxgFail = e => { toastMsg(sxErrText(e), '#ff6a6a'); sfx.error(); };
/* ---- 发放 ---- */
function sxgGive(el) {
  const G = SXG.g;
  const to = sxInput({ placeholder: '用户名，多个用逗号隔开', value: G.to, style: 'flex:1' });
  const all = itemCheckBox(G.all, v => { G.all = v; el._render(); });
  const title = sxInput({ maxlength: 40, value: G.title, placeholder: '邮件标题' });
  const body = sxInput({ rows: 3, maxlength: 1000, placeholder: '正文' }, 'textarea'); body.value = G.body;
  const gold = sxInput({ type: 'number', min: 0, value: G.gold, placeholder: '0', style: 'width:9em;text-align:right' });
  const cera = sxInput({ type: 'number', min: 0, value: G.cera, placeholder: '0', style: 'width:7em;text-align:right' });
  const days = sxInput({ type: 'number', min: 1, max: 365, value: G.days, style: 'width:4em;text-align:right' });
  const sync = () => { G.to = to.value; G.title = title.value; G.body = body.value; G.gold = gold.value; G.cera = cera.value; G.days = +days.value || 30; };
  for (const x of [to, title, body, gold, cera, days]) x.addEventListener('input', sync);
  if (G.all) to.disabled = true;
  // 物品：从物品库按名字 / key 搜索
  const q = sxInput({ placeholder: '搜索物品（名字或 key）', value: G.q, style: 'width:100%;box-sizing:border-box' });
  const res = h('div', { class: 'gres', 'data-sk': 'gr' });
  const search = () => {
    G.q = q.value.trim(); res.replaceChildren();
    if (!G.q) { res.append(h('div', { class: 'sxload', style: 'padding:.5em' }, '输入名字或 key 搜索物品库')); return; }
    const kw = G.q.toLowerCase(), hits = Object.keys(ITEMS).filter(k => k.toLowerCase().includes(kw) || String(ITEMS[k].name || '').includes(G.q)).slice(0, 40);
    for (const k of hits) { const D = ITEMS[k]; res.append(h('div', { class: 'r', onclick: () => { if (G.items.length >= 5) { toastMsg('每封邮件最多 5 件物品', '#ffb0a0'); return; } G.items.push({ key: k, n: 1, enh: 0, grade: D.kind === 'equip' && D.rar < 5 ? 4 : null }); sfx.click(); el._render(); } },
      h('img', { src: itemIconSrc(k, 48) }), h('span', { class: `q${D.rar || 0}`, style: 'font-weight:900' }, D.name), h('span', { class: 'small dim' }, `${k}${D.lvl ? ' · Lv.' + D.lvl : ''}`))); }
    if (!hits.length) res.append(h('div', { class: 'sxload', style: 'padding:.5em' }, '没有找到'));
  };
  q.addEventListener('input', search); search();
  const att = h('div', { class: 'gatt' }, G.items.length ? G.items.map((e, i) => {
    const D = ITEMS[e.key] || {};
    const n = sxInput({ type: 'number', min: 1, max: 9999, value: e.n, style: 'width:4.5em;text-align:right' }); n.addEventListener('input', () => { e.n = clamp(+n.value | 0, 1, 9999); });
    const extra = [];
    if (D.kind === 'equip' && D.slot !== 'title' && !String(D.slot).startsWith('av_')) {
      const enh = sxInput({ type: 'number', min: 0, max: 20, value: e.enh, style: 'width:3.5em;text-align:right' }); enh.addEventListener('input', () => { e.enh = clamp(+enh.value | 0, 0, 20); });
      const gr = sxInput({ style: 'width:5.5em' }, 'select'); GRADES.forEach((g, gi) => { const o = h('option', { value: gi }, g); if (gi === e.grade) o.selected = true; gr.append(o); }); gr.addEventListener('change', () => { e.grade = +gr.value; });
      extra.push(h('span', { class: 'small dim' }, '强化 +'), enh, D.rar < 5 ? gr : null);
    }
    return h('div', { class: 'r' }, h('img', { src: itemIconSrc(e.key, 48) }), h('span', { class: `q${D.rar || 0}`, style: 'font-weight:900;min-width:8em' }, D.name || e.key), h('span', { class: 'small dim' }, '数量'), n, ...extra,
      h('button', { class: 'btn sm red', onclick: () => { G.items.splice(i, 1); el._render(); } }, '移除'));
  }) : h('div', { class: 'small dim' }, '（没有物品附件）'));
  const send = h('button', { class: 'btn', onclick: () => {
    sync();
    const items = G.items.map(e => ({ key: e.key, n: e.n, opt: ITEMS[e.key] && ITEMS[e.key].kind === 'equip' ? { enh: e.enh || 0, ...(e.grade != null ? { grade: e.grade } : {}) } : undefined }));
    const who = G.all ? '全体玩家' : G.to;
    itemDialog(el, { title: '确认发放', msg: `收件人：${escHtml(who || '（未填）')}<br>标题：${escHtml(G.title || '（未填）')}<br>金币 ${fmtNum(+G.gold || 0)}，点券 ${fmtNum(+G.cera || 0)}，物品 ${items.length} 件`, okText: '发放', onOk: () => {
      sxApi('POST', '/api/gm/mail', { to: G.all ? '*' : G.to, title: G.title, body: G.body, gold: +G.gold || 0, cera: +G.cera || 0, items, days: G.days })
        .then(r => { toastMsg(`已发放给 ${r.n} 人`, '#8aff9a'); sfx.coin(); G.items = []; G.gold = ''; G.cera = ''; el._render(); }).catch(sxgFail);
    } });
  } }, '发放');
  return [h('div', { class: 'gform' },
    h('span', { class: 'sxlbl' }, '收件人'), h('div', { class: 'row' }, to, h('label', { class: 'small row', style: 'gap:.2em' }, all, '全体玩家')),
    h('span', { class: 'sxlbl' }, '标题'), title,
    h('span', { class: 'sxlbl' }, '正文'), body,
    h('span', { class: 'sxlbl' }, '金币 / 点券'), h('div', { class: 'row' }, gold, h('span', { class: 'small dim' }, 'G'), cera, h('span', { class: 'small dim' }, '点券'), h('span', { class: 'sp' }), h('span', { class: 'small dim' }, '有效'), days, h('span', { class: 'small dim' }, '天')),
    h('span', { class: 'sxlbl' }, '物品'), h('div', { class: 'col', style: 'gap:.3em' }, q, res, att)),
    h('div', { class: 'row' }, h('span', { class: 'ihint' }, '以“管理员”邮件发出，玩家在邮箱里领取。装备可以指定强化等级和品质。'), h('span', { class: 'sp' }), send)];
}
/* ---- 邀请码 ---- */
function sxgInvite(el, d) {
  const note = sxInput({ placeholder: '备注（给谁的）', maxlength: 40, style: 'width:12em' });
  const n = sxInput({ type: 'number', min: 1, max: 20, value: 1, style: 'width:4em;text-align:right' });
  // 联机组的 listInvites：{ code, createdAt, usedAt, note, createdBy（用户名）, usedBy（用户名）}
  const list = (d.list || []).map(v => ({ code: v.code, note: v.note, at: v.createdAt ?? v.created_at, usedAt: v.usedAt ?? v.used_at, usedBy: v.usedBy ?? v.used_by, by: v.createdBy ?? '' })).sort((a, b) => (b.at || 0) - (a.at || 0));
  return [h('div', { class: 'row' }, note, n, h('span', { class: 'small dim' }, '个'), h('button', { class: 'btn sm', onclick: () => sxApi('POST', '/api/gm/invite', { note: note.value, n: +n.value || 1 }).then(r => { toastMsg(`生成了 ${r.codes.length} 个邀请码`, '#8aff9a'); el._reload(); }).catch(sxgFail) }, '生成')),
    h('div', { class: 'sxscroll', style: 'max-height:20em' }, list.length ? h('table', { class: 'sxtbl' }, h('thead', {}, h('tr', {}, ['邀请码', '备注', '生成时间', '状态', ''].map(t => h('th', {}, t)))),
      h('tbody', {}, list.map(v => h('tr', {}, h('td', { class: 'code' }, v.code), h('td', { class: 'small' }, v.note || ''), h('td', { class: 'small dim' }, v.at ? sxDate(v.at) : ''),
        h('td', { class: 'small', style: v.usedBy || v.usedAt ? 'color:#9a8f7c' : 'color:#8aff8a' }, v.usedBy || v.usedAt ? `已使用${v.usedBy ? `（${v.usedBy}）` : ''}${v.usedAt ? ' ' + sxDate(v.usedAt) : ''}` : '未使用'),
        h('td', {}, v.usedBy || v.usedAt ? null : h('button', { class: 'btn sm red', onclick: () => sxApi('DELETE', `/api/gm/invite/${encodeURIComponent(v.code)}`).then(() => el._reload()).catch(sxgFail) }, '删除'))))))
      : h('div', { class: 'sxload' }, '还没有邀请码'))];
}
/* ---- 在线玩家 ---- */
function sxgOnline(el, d) {
  const L = d.list || [];
  const sceneName = id => typeof SCENES !== 'undefined' && SCENES[id] ? `${SCENES[id].name}${SCENES[id].area && SCENES[id].area !== SCENES[id].name ? ' · ' + SCENES[id].area : ''}` : typeof DUNGEONS !== 'undefined' && DUNGEONS[id] ? DUNGEONS[id].name : id || '—';
  return [h('div', { class: 'row' }, h('b', {}, `在线 ${L.length} 人`), h('span', { class: 'sp' }), h('button', { class: 'btn sm blue', onclick: () => el._reload() }, '刷新')),
    h('div', { class: 'sxscroll', style: 'max-height:22em' }, L.length ? h('table', { class: 'sxtbl' }, h('thead', {}, h('tr', {}, ['账号', '角色', '职业', '等级', '位置', '在线时长'].map(t => h('th', {}, t)))),
      h('tbody', {}, L.map(o => { const c = o.char || {}; return h('tr', {}, h('td', { style: 'font-weight:900' }, o.name, o.admin ? h('span', { class: 'small', style: 'color:#ff8a6a;margin-left:.3em' }, '管理员') : null), h('td', {}, c.name || '—'), h('td', { class: 'small' }, c.cls ? sxClsName(c.cls, c.job) : '—'), h('td', { class: 'num' }, c.lvl ? `Lv.${c.lvl}` : '—'), h('td', { class: 'small' }, sceneName(o.scene)), h('td', { class: 'small dim' }, o.since ? sxLeft(d.now - o.since).replace('已到期', '刚刚') : '')); })))
      : h('div', { class: 'sxload' }, '没有人在线'))];
}
/* ---- 全服公告 ---- */
function sxgNotice(el) {
  const t = sxInput({ rows: 3, maxlength: 120, placeholder: '公告内容（最多 120 字），会在所有在线玩家的屏幕上方滚动显示', style: 'width:100%;box-sizing:border-box' }, 'textarea');
  return [t, h('div', { class: 'row' }, h('span', { class: 'sp' }), h('button', { class: 'btn', onclick: () => { const v = t.value.trim(); if (!v) { toastMsg('请填写公告内容', '#ffb0a0'); return; } sxApi('POST', '/api/gm/notice', { text: v }).then(() => { toastMsg('公告已发布', '#8aff9a'); t.value = ''; }).catch(sxgFail); } }, '发布'))];
}
/* ---- 日志 ---- */
function sxgLogs(el, d) {
  const sel = sxInput({ style: 'width:7em' }, 'select'); for (const [v, n] of SXG_LOGS) { const o = h('option', { value: v }, n); if (v === SXG.logType) o.selected = true; sel.append(o); }
  sel.addEventListener('change', () => { SXG.logType = sel.value; el._reload(); });
  const u = sxInput({ placeholder: '用户名', value: SXG.logUser, style: 'width:8em' }); u.addEventListener('keydown', ev => { if (ev.key === 'Enter') { SXG.logUser = u.value.trim(); el._reload(); } });
  const det = x => {
    const o = x.detail || {}; if (typeof o !== 'object') return String(o);
    return Object.keys(o).filter(k => o[k] !== 0 && o[k] !== '' && o[k] != null && !(Array.isArray(o[k]) && !o[k].length)).map(k => {
      const v = o[k], t = Array.isArray(v) ? v.map(x => String(x).replace(/^(\w+)×/, (m, key) => ITEMS[key] ? ITEMS[key].name + '×' : m)).join('、') : typeof v === 'object' ? JSON.stringify(v) : typeof v === 'number' && ['gold', 'price', 'fee', 'tax', 'cera'].includes(k) ? fmtNum(v) : v;
      return k === 'id' ? `#${t}` : `${SXG_DETAIL[k] || k}：${k === 'kind' ? SX_KIND[v] || v : k === 'hours' ? v + ' 小时' : t}`;
    }).join('；');
  };
  const L = d.list || [];
  return [h('div', { class: 'row' }, sel, u, h('button', { class: 'btn sm', onclick: () => { SXG.logUser = u.value.trim(); el._reload(); } }, '查询'), h('span', { class: 'sp' }), h('span', { class: 'small dim' }, `最近 ${L.length} 条`)),
    h('div', { class: 'sxscroll', style: 'max-height:22em' }, L.length ? h('table', { class: 'sxtbl' }, h('thead', {}, h('tr', {}, ['时间', '类型', '用户', '内容'].map(t => h('th', {}, t)))),
      h('tbody', {}, L.map(x => h('tr', {}, h('td', { class: 'small dim', style: 'white-space:nowrap' }, sxDate(x.at)), h('td', { class: 'small', style: 'white-space:nowrap' }, SXG_LOGNAME[x.type] || x.type), h('td', { class: 'small' }, x.user), h('td', { class: 'det' }, det(x)))))) : h('div', { class: 'sxload' }, '没有日志'))];
}
/* ---- 拍卖行管理 ---- */
function sxgAuction(el, d) {
  const sel = sxInput({ style: 'width:7em' }, 'select');
  for (const [v, n] of [['on', '在售'], ['sold', '已成交'], ['expired', '到期退回'], ['cancel', '已下架'], ['', '全部']]) { const o = h('option', { value: v }, n); if (v === SXG.aucStatus) o.selected = true; sel.append(o); }
  sel.addEventListener('change', () => { SXG.aucStatus = sel.value; el._reload(); });
  const ST = { on: '在售', sold: '已成交', expired: '到期退回', cancel: '已下架' };
  const L = d.list || [];
  return [h('div', { class: 'row' }, sel, h('span', { class: 'sp' }), h('button', { class: 'btn sm blue', onclick: () => el._reload() }, '刷新')),
    h('div', { class: 'sxscroll', style: 'max-height:22em' }, L.length ? h('table', { class: 'sxtbl' }, h('thead', {}, h('tr', {}, ['#', '物品', '价格', '卖家', '买家', '状态', ''].map(t => h('th', {}, t)))),
      h('tbody', {}, L.map(a => h('tr', {}, h('td', { class: 'num dim' }, String(a.id)), h('td', { class: `q${a.rar || 0}`, style: 'font-weight:900' }, `${a.enh ? '+' + a.enh + ' ' : ''}${a.name}${a.n > 1 ? ' ×' + a.n : ''}`),
        h('td', { class: 'num gold' }, fmtNum(a.price)), h('td', { class: 'small' }, `${a.sellerChar || ''}（${a.seller}）`), h('td', { class: 'small' }, a.buyer || ''),
        h('td', { class: 'small' }, a.status === 'on' ? `在售 · ${sxLeft(a.left)}` : ST[a.status] || a.status),
        h('td', {}, a.status === 'on' ? h('button', { class: 'btn sm red', onclick: () => itemDialog(el, { title: '强制下架', msg: `把 #${a.id} ${escHtml(a.name)} 强制下架？物品会通过邮件退回卖家。`, danger: true, okText: '下架', onOk: () => { sxApi('POST', '/api/gm/auction/cancel', { id: a.id }).then(() => { toastMsg('已下架', '#bfe8bf'); el._reload(); }).catch(sxgFail); } }) }, '下架') : null)))))
      : h('div', { class: 'sxload' }, '没有记录'))];
}
