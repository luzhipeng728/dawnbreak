/* =====================================================================
   邮件窗口（mail）：收件箱（系统 / 管理员 / 好友 / 拍卖行邮件，领取附件、删除、全部领取、清理已读）+ 写信（只能寄给好友，附带金币 / 物品，邮费 100 G）
   附件领到当前角色身上；背包空间不够时整封不领。入口：屏幕左侧社交按钮条的“邮件”、诺顿（中央广场）的“邮箱”
   ===================================================================== */
addStyle(`
.sxmail .mbox{display:flex;gap:.5em;min-height:0;height:24em}
.sxmail .mlist{width:15em;flex:none}
.sxmail .mrow{display:flex;gap:.4em;align-items:center;padding:.35em .45em;border-bottom:.06em solid #2a2230;cursor:pointer}
.sxmail .mrow:hover{background:rgba(120,90,40,.2)}.sxmail .mrow.sel{background:rgba(160,120,40,.3);outline:.08em solid #b89450}
.sxmail .mrow .t{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:.9em}
.sxmail .mrow.new .t{font-weight:900;color:#fff2c0}
.sxmail .mrow .s{font-size:.72em;color:#8a806e;white-space:nowrap}
.sxmail .mrow .ic{width:1.1em;height:1.1em;flex:none;border-radius:.15em;background:#3a3040}
.sxmail .mrow .ic.att{background:linear-gradient(#ffd24a,#a06a10)}.sxmail .mrow .ic.done{background:#4a4a50}.sxmail .mrow .ic.new{background:linear-gradient(#f4e6c0,#b8a070)}
.sxmail .mdet{flex:1;min-width:0;display:flex;flex-direction:column;gap:.4em}
.sxmail .mdet .mt{font-weight:900;font-size:1.08em;color:#ffe8a8}
.sxmail .mdet .mf{font-size:.8em;color:#9a8f7c}
.sxmail .mdet .mb{flex:1;min-height:4em;overflow:auto;white-space:pre-wrap;line-height:1.55;font-size:.92em;background:rgba(0,0,0,.2);border-radius:.25em;padding:.4em .55em}
.sxmail .matt{display:flex;flex-wrap:wrap;gap:.3em;align-items:center;min-height:3.2em}
.sxmail .kind{font-size:.72em;padding:0 .4em;border-radius:.2em;margin-right:.3em;font-weight:900}
.sxmail .kind.sys{background:#2a4a6a}.sxmail .kind.gm{background:#6a2a2a}.sxmail .kind.friend{background:#2a5a3a}.sxmail .kind.auction{background:#6a4a1a}
.sxmail .cgrid{display:grid;grid-template-columns:repeat(8,2.6em);gap:.14em;padding:.25em;background:#0b090e;border:.1em solid #3a3040;border-radius:.25em;max-height:8.6em;overflow:auto}
.sxmail .cgrid .islot{width:2.6em;height:2.6em}
.sxmail .catt{display:flex;gap:.2em}
`);
const SXM = { tab: 'in', sel: null, c: { to: '', title: '', body: '', gold: 0, items: [] }, busy: false };
const SX_KIND = { sys: '系统', gm: '管理员', friend: '好友', auction: '拍卖行' };
async function sxFriends() {
  try { const r = await sxApi('GET', '/api/friends'); const L = Array.isArray(r) ? r : r.list || r.friends || []; return L.filter(f => !f.pending && f.state !== 'pending' && f.status !== 'pending' && !f.incoming && !f.outgoing).map(f => f.name || f.user || f); }
  catch (e) { return []; }
}
Object.assign(menus, {
  w_mail() {
    if (!sxGate('邮件')) return null;
    const el = sxWin('mail', '邮件', {
      w: 44,
      load: async () => { const [m, fr] = await Promise.all([sxApi('GET', '/api/mail'), SXM.tab === 'send' || !SXM.friends ? sxFriends() : Promise.resolve(SXM.friends)]); SXM.friends = fr; sxSetCounts(m); return m; },
      render: (el, d) => {
        const tabs = h('div', { class: 'itabs' }, [['in', `收件箱`], ['send', '写信']].map(([id, nm]) => h('div', { class: 'itab' + (SXM.tab === id ? ' on' : ''), onclick: () => { SXM.tab = id; sfx.click(); el._render(); } }, nm, id === 'in' ? h('span', { class: 'cnt' }, `${d.list.length}`) : null)));
        return [tabs, ...(SXM.tab === 'in' ? sxMailInbox(el, d) : sxMailCompose(el))];
      },
    });
    el.classList.add('sxmail');
    return el;
  },
});
function sxMailInbox(el, d) {
  const L = d.list;
  if (!L.some(m => m.id === SXM.sel)) SXM.sel = L.length ? L[0].id : null;
  const m = L.find(x => x.id === SXM.sel);
  if (m && !m.read) { m.read = true; sxApi('POST', '/api/mail/read', { id: m.id }).then(sxSetCounts).catch(() => {}); }
  const list = h('div', { class: 'sxscroll mlist', 'data-sk': 'ml' }, L.length ? L.map(x => h('div', { class: 'mrow' + (x.id === SXM.sel ? ' sel' : '') + (!x.read ? ' new' : ''), onclick: () => { SXM.sel = x.id; sfx.click(); el._render(); } },
    h('span', { class: 'ic' + (x.att && !x.claimed ? ' att' : !x.read ? ' new' : x.att ? ' done' : '') }),
    h('div', { style: 'flex:1;min-width:0' }, h('div', { class: 't' }, x.title), h('div', { class: 's' }, `${x.from} · ${sxDate(x.created)}`)))) : h('div', { class: 'sxload' }, '没有邮件'));
  const det = h('div', { class: 'mdet' });
  if (m) {
    const exp = m.expires ? `${Math.max(0, Math.ceil((m.expires - d.now) / 86400000))} 天后过期` : '永久保存';
    det.append(h('div', { class: 'mt' }, h('span', { class: 'kind ' + m.kind }, SX_KIND[m.kind] || m.kind), m.title),
      h('div', { class: 'mf' }, `来自：${m.from}　${sxDate(m.created)}　${exp}`),
      h('div', { class: 'mb' }, m.body || '（没有正文）'));
    if (m.att) {
      det.append(h('div', { class: 'sxlbl' }, m.claimed ? '附件（已领取）' : '附件'),
        h('div', { class: 'matt', style: m.claimed ? 'opacity:.45' : '' }, ...sxMoney(m.gold, m.cera), ...m.items.map(e => sxEntrySlot(e))));
    }
    det.append(h('div', { class: 'row', style: 'justify-content:flex-end' },
      m.att && !m.claimed ? h('button', { class: 'btn', onclick: ev => sxMailDoClaim(el, [m], ev.currentTarget) }, '领取附件') : null,
      !m.att || m.claimed ? h('button', { class: 'btn sm red', onclick: async () => { try { sxSetCounts(await sxApi('DELETE', `/api/mail/${m.id}`)); sfx.click(); el._reload(); } catch (e) { toastMsg(sxErrText(e), '#ff6a6a'); sfx.error(); } } }, '删除') : null));
  } else det.append(h('div', { class: 'sxload' }, '选择左边的一封邮件'));
  const todo = L.filter(x => x.att && !x.claimed);
  return [h('div', { class: 'mbox' }, list, det),
    h('div', { class: 'ibar' }, h('span', { class: 'small dim' }, `未读 ${d.unread} · 未领取 ${d.pending}`), h('span', { class: 'sp' }),
      h('button', { class: 'btn sm' + (todo.length ? '' : ' off'), onclick: ev => sxMailDoClaim(el, todo, ev.currentTarget) }, `全部领取${todo.length ? `（${todo.length}）` : ''}`),
      h('button', { class: 'btn sm blue', onclick: async () => { try { const r = await sxApi('POST', '/api/mail/clean'); sxSetCounts(r); toastMsg(r.n ? `清理了 ${r.n} 封邮件` : '没有可以清理的邮件', '#bfe8bf'); el._reload(); } catch (e) { toastMsg(sxErrText(e), '#ff6a6a'); } } }, '清理已读')),
    h('div', { class: 'ihint' }, '附件会领到当前角色身上。拍卖行邮件永久保存，其他邮件 30 天后过期，过期后附件一并消失。')];
}
async function sxMailDoClaim(el, list, btn) {
  if (SXM.busy || !list.length) return;
  SXM.busy = true; if (btn) btn.classList.add('off');
  const got = [];
  try {
    for (const m of list) {
      try { const r = await sxMailClaim(m); got.push(...(r.got || [])); }
      catch (e) { toastMsg(e.message, '#ff6a6a'); sfx.error(); break; }
    }
  } finally { SXM.busy = false; }
  if (got.length) toastMsg(`领取了：${got.slice(0, 6).join('、')}${got.length > 6 ? ` 等 ${got.length} 项` : ''}`, '#ffe8a8');
  if (el.isConnected) el._reload();
}
function sxMailCompose(el) {
  const C = SXM.c;
  C.items = C.items.filter(a => inv.items.includes(a.it) && (a.it.kind === 'equip' || a.n <= a.it.n));
  const fr = SXM.friends || [];
  const to = sxInput({ list: 'sxfrlist', placeholder: fr.length ? '好友名字' : '（还没有好友）', value: C.to, style: 'width:12em' });
  const dl = h('datalist', { id: 'sxfrlist' }, fr.map(n => h('option', { value: n })));
  const title = sxInput({ maxlength: 40, placeholder: '标题', value: C.title, style: 'flex:1' });
  const body = sxInput({ maxlength: 500, placeholder: '正文（可以不写）', rows: 4, style: 'width:100%;box-sizing:border-box' }, 'textarea'); body.value = C.body;
  const gold = sxInput({ type: 'number', min: 0, value: C.gold || '', placeholder: '0', style: 'width:8em;text-align:right' });
  const post = h('span', { class: 'small' });
  const upd = () => { C.to = to.value.trim(); C.title = title.value.trim(); C.body = body.value; C.gold = Math.max(0, Math.floor(+gold.value || 0)); const p = C.gold || C.items.length ? SX_POSTAGE : 0; post.textContent = `邮费 ${fmtNum(p)} G · 合计 ${fmtNum(C.gold + p)} G（持有 ${fmtNum(game.gold)} G）`; };
  for (const x of [to, title, body, gold]) x.addEventListener('input', upd);
  upd();
  // 点击：放进 / 拿出附件；可以叠加的物品先问数量（默认全部）
  const add = (it, n) => { C.items.push({ it, n }); sfx.click(); upd(); el._render(); };
  const toggle = it => {
    const i = C.items.findIndex(a => a.it === it);
    if (i >= 0) { C.items.splice(i, 1); sfx.click(); upd(); el._render(); return; }
    if (C.items.length >= 5) { toastMsg('每封邮件最多附带 5 件物品', '#ffb0a0'); sfx.error(); return; }
    if (!sxTradable(it)) { toastMsg(`${it.name}：${sxBindText(it)}，不能邮寄`, '#ffb0a0'); sfx.error(); return; }
    if (it.kind !== 'equip' && it.n > 1) qtyDialog(el, { title: `邮寄数量：${it.name}`, max: it.n, init: it.n, onOk: n => add(it, n) });
    else add(it, 1);
  };
  const att = h('div', { class: 'catt' }, Array.from({ length: 5 }, (_, i) => { const a = C.items[i]; return itemSlot(a ? (a.it.kind === 'equip' ? a.it : { ...a.it, n: a.n }) : null, { label: '附件', cmp: false, onClick: () => a && toggle(a.it), drop: { accept: p => p.type === 'item' && p.from === 'inv', drop: p => { if (!C.items.some(x => x.it === p.item)) toggle(p.item); } } }); }));
  const pool = inv.items.filter(sxTradable);
  const grid = h('div', { class: 'cgrid', 'data-sk': 'cg' }, pool.map(it => itemSlot(it, { cmp: false, chk: C.items.some(a => a.it === it), onClick: () => toggle(it) })));
  const send = h('button', { class: 'btn', onclick: async () => {
    upd(); if (SXM.busy) return;
    SXM.busy = true; send.classList.add('off');
    try { await sxMailSend({ to: C.to, title: C.title, body: C.body, gold: C.gold, items: C.items.slice() }); toastMsg(`已寄给 ${C.to}`, '#bfe8bf'); sfx.coin(); SXM.c = { to: C.to, title: '', body: '', gold: 0, items: [] }; SXM.tab = 'in'; el._reload(); }
    catch (e) { toastMsg(e.message, '#ff6a6a'); sfx.error(); el._render(); }
    finally { SXM.busy = false; }
  } }, '寄出');
  return [h('div', { class: 'col', style: 'gap:.4em' },
    h('div', { class: 'row' }, h('span', { class: 'sxlbl' }, '收件人'), to, dl, h('span', { class: 'small dim' }, '只能寄给互为好友的人')),
    h('div', { class: 'row' }, h('span', { class: 'sxlbl' }, '标题'), title),
    body,
    h('div', { class: 'row' }, h('span', { class: 'sxlbl' }, '附带金币'), gold, h('span', { class: 'sp' }), post),
    h('div', { class: 'row', style: 'align-items:flex-start' }, h('span', { class: 'sxlbl', style: 'margin-top:.8em' }, '附件'), att, h('span', { class: 'sp' }), send),
    h('div', { class: 'sxlbl' }, '背包里可以邮寄的物品（点击放进附件，也可以从背包拖过来）'), grid,
    h('div', { class: 'ihint' }, '点券不能邮寄；绑定的物品、任务道具不能邮寄。对方 30 天内没领取时，附件会退回给你。'))];
}
