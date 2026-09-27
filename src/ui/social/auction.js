/* =====================================================================
   拍卖行窗口（auction）：购买（搜索 / 类别 / 品级 / 等级 / 职业筛选、排序、一口价购买）、出售（选背包物品、定价、时长、保管费、成交价参考）、我的拍卖（下架、成交记录）
   规则见 docs/SOCIAL.md：保管费 max(10, 价格×0.5%×时长系数) 不退，成交收 5% 手续费；买到的物品和卖出的金币都通过邮件到账
   入口：快捷键 B、屏幕左侧社交按钮条、诺顿（赫顿玛尔中央广场）的“拍卖行”
   ===================================================================== */
addStyle(`
.sxauc .afil{display:flex;flex-wrap:wrap;gap:.35em .6em;align-items:center}
.sxauc .ares{height:21em}
.sxauc .ares td.it{display:flex;align-items:center;gap:.45em;min-width:14em}
.sxauc .ares td.it .nm{font-weight:900;line-height:1.2}
.sxauc .ares td.it .sub{font-size:.78em;color:#8a806e}
.sxauc .sell{display:flex;gap:.7em;align-items:stretch}
.sxauc .sell .igrid{grid-template-columns:repeat(7,2.9em);max-height:19.5em;overflow:auto}
.sxauc .sell .igrid .islot{width:2.9em;height:2.9em}
.sxauc .sform{flex:1;min-width:17em;display:flex;flex-direction:column;gap:.45em}
.sxauc .sform .kv{display:grid;grid-template-columns:5.2em 1fr;gap:.35em .5em;align-items:center;font-size:.92em}
.sxauc .sform .kv b{color:#c8a870;font-size:.9em}
.sxauc .ref{font-size:.82em;color:#9ad0ff;line-height:1.5;min-height:2.6em}
.sxauc .st-sold{color:#8aff8a}.sxauc .st-expired{color:#ffb070}.sxauc .st-cancel{color:#9a8f7c}.sxauc .st-bought{color:#8fe8ff}
`);
const SXA_CATS = [['', '全部'], ['weapon', '武器'], ['armor', '防具'], ['acc', '首饰'], ['special', '特殊装备'], ['title', '称号'], ['avatar', '时装'], ['use', '消耗品'], ['mat', '材料']];
const SXA_SORTS = [['unit', '单价从低到高'], ['unit_desc', '单价从高到低'], ['price', '总价从低到高'], ['lvl_desc', '等级从高到低'], ['lvl', '等级从低到高'], ['rar', '品级从高到低'], ['end', '即将到期'], ['new', '最新上架']];
const SXA = { tab: 'buy', f: { q: '', cat: '', rar: '', lvmin: '', lvmax: '', cls: '', sort: 'unit', page: 0 }, s: { it: null, n: 1, price: '', hours: 24, ref: null, tab: 'equip' }, busy: false };
const sxaQuery = () => { const f = SXA.f, p = new URLSearchParams(); for (const k in f) if (f[k] !== '' && f[k] != null) p.set(k, f[k]); return p.toString(); };
Object.assign(menus, {
  w_auction() {
    if (!sxGate('拍卖行')) return null;
    inv.ensure();
    const el = sxWin('auction', '拍卖行', {
      w: 58,
      load: async () => SXA.tab === 'buy' ? sxApi('GET', '/api/auction/search?' + sxaQuery()) : sxApi('GET', '/api/auction/mine'),
      render: (el, d) => {
        const tabs = h('div', { class: 'itabs' }, [['buy', '购买'], ['sell', '出售'], ['mine', '我的拍卖']].map(([id, nm]) => h('div', { class: 'itab' + (SXA.tab === id ? ' on' : ''), onclick: () => { if (SXA.tab === id) return; const was = SXA.tab === 'buy'; SXA.tab = id; sfx.click(); if (was || id === 'buy') { el._data = undefined; el._reload(); } el._render(); } }, nm)));
        const body = SXA.tab === 'buy' ? sxaBuy(el, d) : SXA.tab === 'sell' ? sxaSell(el, d) : sxaMine(el, d);
        return [tabs, ...body, h('div', { class: 'ibar' }, h('span', { class: 'igold' }, `${fmtNum(game.gold)} G`), h('span', { class: 'sp' }), h('span', { class: 'ihint' }, '买到的物品、卖出的金币都会通过邮件送达（屏幕左侧的“邮件”）。'))];
      },
    });
    el.classList.add('sxauc');
    // 从背包拖物品到窗口上 = 选中它准备出售
    dnd.target(el, { accept: p => p.type === 'item' && p.from === 'inv', drop: p => { SXA.tab = 'sell'; sxaPick(el, p.item); } });
    return el;
  },
});
/* ---- 购买 ---- */
function sxaBuy(el, d) {
  const f = SXA.f, go = () => { f.page = 0; el._reload(); };
  const q = sxInput({ placeholder: '物品名称', value: f.q, style: 'width:10em' });
  q.addEventListener('keydown', ev => { if (ev.key === 'Enter') { f.q = q.value.trim(); go(); } });
  const sel = (opts, key, w) => { const s = sxInput({ style: `width:${w}em` }, 'select'); for (const [v, t] of opts) { const o = h('option', { value: v }, t); if (String(f[key]) === String(v)) o.selected = true; s.append(o); } s.addEventListener('change', () => { f[key] = s.value; go(); }); return s; };
  const num = (key, ph) => { const i = sxInput({ type: 'number', min: 0, max: 99, placeholder: ph, value: f[key], style: 'width:3.6em;text-align:right' }); i.addEventListener('change', () => { f[key] = i.value; go(); }); return i; };
  const clsOpts = [['', '全部职业'], ...Object.keys(CLASSES).filter(c => CLASS_WTYPES(c).length).map(c => [c, CLASSES[c].name])];
  const filters = h('div', { class: 'col', style: 'gap:.35em' },
    h('div', { class: 'afil' }, q, h('button', { class: 'btn sm', onclick: () => { f.q = q.value.trim(); go(); } }, '搜索'),
      sel([['', '全部品级'], ...RARITY.map((R, i) => [i, R.name])], 'rar', 7.2), h('span', { class: 'small dim' }, '等级'), num('lvmin', '1'), '~', num('lvmax', '99'),
      sel(clsOpts, 'cls', 7.2), h('span', { class: 'sp' }), sel(SXA_SORTS, 'sort', 10),
      h('button', { class: 'btn sm blue', onclick: () => { SXA.f = { q: '', cat: '', rar: '', lvmin: '', lvmax: '', cls: '', sort: 'unit', page: 0 }; el._reload(); } }, '重置')),
    h('div', { class: 'sxchips' }, SXA_CATS.map(([v, t]) => h('span', { class: 'sxchip' + (f.cat === v ? ' on' : ''), onclick: () => { f.cat = v; sfx.click(); go(); } }, t))));
  const rows = d.list.map(a => {
    const it = a.item ? normalizeItem(JSON.parse(JSON.stringify(a.item))) : null;
    return h('tr', { class: a.mine ? 'me' : '' },
      h('td', { class: 'it' }, it ? (() => { const s = itemSlot(it, { cmp: true }); s.classList.add('sm'); return s; })() : null,
        h('div', {}, h('div', { class: `nm q${a.rar || 0}` }, (it && it.enh ? `+${it.enh} ` : '') + a.name), h('div', { class: 'sub' }, it ? `${RARITY[it.rar || 0].name} ${itemTypeName(it)}${it.kind === 'equip' && it.grade != null ? ' · ' + GRADES[it.grade] : ''}` : ''))),
      h('td', { class: 'num' }, a.lvl > 1 ? `Lv.${a.lvl}` : '—'),
      h('td', { class: 'num' }, a.n > 1 ? `×${fmtNum(a.n)}` : '1'),
      h('td', { class: 'num gold' }, `${fmtNum(a.unit)} G`),
      h('td', { class: 'num gold', style: 'font-weight:900' }, `${fmtNum(a.price)} G`),
      h('td', { class: 'small' }, a.sellerChar || a.seller),
      h('td', { class: 'small', style: 'white-space:nowrap' }, sxLeft(a.expires - d.now)),
      h('td', {}, a.mine ? h('span', { class: 'small dim' }, '我的') : h('button', { class: 'btn sm' + (game.gold < a.price ? ' off' : ''), onclick: () => sxaBuyAsk(el, a) }, '购买')));
  });
  const table = h('div', { class: 'sxscroll ares', 'data-sk': 'ar' }, d.list.length ? h('table', { class: 'sxtbl' },
    h('thead', {}, h('tr', {}, ['物品', '等级', '数量', '单价', '总价', '卖家', '剩余时间', ''].map(t => h('th', {}, t)))), h('tbody', {}, rows))
    : h('div', { class: 'sxload' }, f.q || f.cat || f.rar !== '' || f.lvmin || f.lvmax || f.cls ? '没有符合条件的物品' : '拍卖行里还没有人上架物品'));
  const pager = h('div', { class: 'sxpager' },
    h('button', { class: 'btn sm' + (d.page > 0 ? '' : ' off'), onclick: () => { f.page = d.page - 1; el._reload(); } }, '◀'),
    h('span', {}, `第 ${d.page + 1} / ${d.pages} 页（共 ${d.total} 件）`),
    h('button', { class: 'btn sm' + (d.page + 1 < d.pages ? '' : ' off'), onclick: () => { f.page = d.page + 1; el._reload(); } }, '▶'),
    h('button', { class: 'btn sm blue', onclick: () => el._reload() }, '刷新'));
  return [filters, table, pager];
}
function sxaBuyAsk(el, a) {
  if (game.gold < a.price) { toastMsg('金币不足', '#ff6a6a'); sfx.error(); return; }
  const it = a.item || { name: a.name, rar: a.rar };
  itemDialog(el, { title: '一口价购买', msg: `以 <span class="gold">${fmtNum(a.price)} G</span> 购买 ${sxItemHtml({ ...it, n: a.n })}？<br><span class="small dim">物品会通过邮件送到你的邮箱。</span>`, okText: '购买', onOk: () => {
    if (SXA.busy) return;
    SXA.busy = true;
    sxAuctionBuy(a).then(() => { sfx.coin(); toastMsg(`购买成功：${a.name}，请到邮箱领取`, '#8aff9a'); }).catch(e => { toastMsg(e.message, '#ff6a6a'); sfx.error(); })
      .finally(() => { SXA.busy = false; if (el.isConnected) el._reload(); });
  } });
}
/* ---- 出售 ---- */
function sxaPick(el, it) {
  const S = SXA.s;
  if (!sxTradable(it)) { toastMsg(`${it.name}：${sxBindText(it)}，不能上架`, '#ffb0a0'); sfx.error(); return; }
  S.it = it; S.n = it.n || 1; S.price = ''; S.ref = null; S.tab = TAB_OF(it); sfx.click();
  sxApi('GET', '/api/auction/price?key=' + encodeURIComponent(it.key)).then(r => { if (S.it === it) { S.ref = r; if (!S.price && (r.avg || r.onLo)) S.price = Math.max(1, Math.round((r.avg || r.onLo) * S.n)); el._render(); } }).catch(() => {});
  el._render();
}
function sxaSell(el, d) {
  const S = SXA.s;
  if (S.it && !inv.items.includes(S.it)) S.it = null;
  const list = inv.items.filter(x => TAB_OF(x) === S.tab);
  const tabs = h('div', { class: 'itabs' }, INV_TABS.filter(t => t[0] !== 'quest').map(([id, nm]) => h('div', { class: 'itab' + (S.tab === id ? ' on' : ''), onclick: () => { S.tab = id; sfx.click(); el._render(); } }, nm)));
  const grid = h('div', { class: 'igrid', 'data-sk': 'sg' }, list.map(it => itemSlot(it, { cmp: false, sel: it === S.it, dim: !sxTradable(it), onClick: () => sxaPick(el, it), drag: () => ({ type: 'item', item: it, from: 'auc' }) })));
  const form = h('div', { class: 'sform sxbox' });
  const onN = d.on ? d.on.length : 0;
  if (!S.it) form.append(h('div', { class: 'sxload' }, '点击左边背包里的物品（或从背包窗口拖过来）选择要出售的物品'));
  else {
    const it = S.it, stack = it.kind !== 'equip' && it.n > 1;
    const nIn = stack ? sxInput({ type: 'number', min: 1, max: it.n, value: S.n, style: 'width:6em;text-align:right' }) : null;
    const pIn = sxInput({ type: 'number', min: 1, max: SX_AUCTION.maxPrice, value: S.price, placeholder: '总价', style: 'width:10em;text-align:right' });
    const calc = h('div', { class: 'small', style: 'line-height:1.6' });
    const upd = () => {
      if (nIn) S.n = clamp(Math.floor(+nIn.value || 1), 1, it.n);
      S.price = pIn.value === '' ? '' : Math.max(0, Math.floor(+pIn.value || 0));
      const p = +S.price || 0, fee = p ? sxAuctionFee(p, S.hours) : 0, tax = Math.floor(p * SX_AUCTION.tax);
      calc.replaceChildren(h('div', {}, '单价 ', h('b', { class: 'gold' }, p ? `${fmtNum(p / (stack ? S.n : 1))} G` : '—')),
        h('div', {}, '保管费 ', h('b', { class: game.gold < fee ? 'bad' : 'gold', style: game.gold < fee ? 'color:#ff6a6a' : '' }, `${fmtNum(fee)} G`), h('span', { class: 'dim' }, '（上架时支付，不退）')),
        h('div', {}, '卖出后实得 ', h('b', { class: 'gold' }, `${fmtNum(p - tax)} G`), h('span', { class: 'dim' }, `（扣 5% 手续费 ${fmtNum(tax)} G）`)));
    };
    for (const x of [nIn, pIn]) if (x) x.addEventListener('input', upd);
    const R = S.ref;
    const ref = h('div', { class: 'ref' }, R ? [R.sold ? h('div', {}, `近 7 天成交 ${R.sold} 笔，均价 ${fmtNum(R.avg)} G / 个（最低 ${fmtNum(R.lo)}）`) : h('div', {}, '近 7 天没有成交记录'),
      R.onSale ? h('div', {}, `当前在售 ${R.onSale} 件，最低 ${fmtNum(R.onLo)} G / 个`) : h('div', {}, '当前没有人在卖同样的物品')] : '正在查询成交价……');
    const slot = itemSlot(it, { cmp: false });
    form.append(h('div', { class: 'row' }, slot, h('div', {}, h('div', { class: `q${it.rar || 0}`, style: 'font-weight:900' }, (it.enh ? `+${it.enh} ` : '') + it.name + (it.n > 1 ? ` ×${it.n}` : '')), h('div', { class: 'small dim' }, sxBindText(it)))),
      h('div', { class: 'kv' },
        stack ? h('b', {}, '数量') : null, stack ? h('div', { class: 'row' }, nIn, h('span', { class: 'small dim' }, `/ ${it.n}`)) : null,
        h('b', {}, '一口价'), h('div', { class: 'row' }, pIn, h('span', { class: 'small dim' }, 'G（总价）')),
        h('b', {}, '上架时长'), h('div', { class: 'sxchips' }, [12, 24, 48].map(hr => h('span', { class: 'sxchip' + (S.hours === hr ? ' on' : ''), onclick: () => { S.hours = hr; sfx.click(); upd(); el._render(); } }, `${hr} 小时`)))),
      calc, ref,
      h('div', { class: 'row' }, h('span', { class: 'small dim' }, `已上架 ${onN} / ${SX_AUCTION.maxOn}`), h('span', { class: 'sp' }),
        h('button', { class: 'btn sm blue', onclick: () => { S.it = null; el._render(); } }, '取消'),
        h('button', { class: 'btn' + (onN >= SX_AUCTION.maxOn ? ' off' : ''), onclick: () => { upd(); sxaListAsk(el); } }, '上架')));
    upd();
  }
  return [h('div', { class: 'sell' }, h('div', { class: 'col', style: 'gap:.3em' }, tabs, grid, h('div', { class: 'ihint' }, '灰色的物品不能交易（绑定 / 任务道具）')), form)];
}
function sxaListAsk(el) {
  const S = SXA.s, it = S.it, p = +S.price || 0;
  if (!it) return;
  if (p < 1) { toastMsg('请填写价格', '#ffb0a0'); sfx.error(); return; }
  const fee = sxAuctionFee(p, S.hours);
  itemDialog(el, { title: '确认上架', msg: `${sxItemHtml({ ...it, n: it.kind === 'equip' ? 1 : S.n })}<br>一口价 <span class="gold">${fmtNum(p)} G</span>，上架 ${S.hours} 小时<br>保管费 <span class="gold">${fmtNum(fee)} G</span>（不退）`, okText: '上架', onOk: () => {
    if (SXA.busy) return;
    SXA.busy = true;
    sxAuctionList(it, S.n, p, S.hours).then(() => { sfx.coin(); toastMsg(`已上架：${it.name}`, '#8aff9a'); S.it = null; S.price = ''; }).catch(e => { toastMsg(e.message, '#ff6a6a'); sfx.error(); })
      .finally(() => { SXA.busy = false; if (el.isConnected) el._reload(); });
  } });
}
/* ---- 我的拍卖 ---- */
function sxaMine(el, d) {
  const on = d.on.map(a => h('tr', {},
    h('td', { class: `q${a.rar || 0}`, style: 'font-weight:900' }, `${a.item && a.item.enh ? '+' + a.item.enh + ' ' : ''}${a.name}${a.n > 1 ? ' ×' + a.n : ''}`),
    h('td', { class: 'num gold' }, `${fmtNum(a.price)} G`), h('td', { class: 'small' }, sxLeft(a.expires - d.now)),
    h('td', {}, h('button', { class: 'btn sm red', onclick: () => itemDialog(el, { title: '取消上架', msg: `把 ${escHtml(a.name)} 撤下来？<br><span class="small dim">物品会通过邮件退回，保管费不退。</span>`, okText: '下架', danger: true, onOk: () => { sxApi('POST', '/api/auction/cancel', { id: a.id }).then(() => { toastMsg('已下架，物品已通过邮件退回', '#bfe8bf'); }).catch(e => { toastMsg(sxErrText(e), '#ff6a6a'); sfx.error(); }).finally(() => el._reload()); } }) }, '下架'))));
  const ST = a => a.bought ? ['bought', `买入（卖家 ${a.sellerChar || a.seller}）`] : a.status === 'sold' ? ['sold', `卖出（买家 ${a.buyer || ''}）`] : a.status === 'expired' ? ['expired', '到期退回'] : ['cancel', '已下架'];
  const hist = d.history.map(a => { const [c, t] = ST(a); return h('tr', {},
    h('td', { class: `q${a.rar || 0}` }, `${a.name}${a.n > 1 ? ' ×' + a.n : ''}`), h('td', { class: 'num gold' }, `${fmtNum(a.price)} G`), h('td', { class: 'small st-' + c }, t), h('td', { class: 'small dim' }, sxDate(a.closed))); });
  return [h('div', { class: 'sxlbl' }, `在售（${d.on.length} / ${d.maxOn}）`),
    h('div', { class: 'sxscroll', style: 'max-height:10em' }, d.on.length ? h('table', { class: 'sxtbl' }, h('thead', {}, h('tr', {}, ['物品', '一口价', '剩余时间', ''].map(t => h('th', {}, t)))), h('tbody', {}, on)) : h('div', { class: 'sxload' }, '没有在售的物品')),
    h('div', { class: 'sxlbl' }, '最近的记录'),
    h('div', { class: 'sxscroll', style: 'max-height:12em' }, d.history.length ? h('table', { class: 'sxtbl' }, h('thead', {}, h('tr', {}, ['物品', '价格', '结果', '时间'].map(t => h('th', {}, t)))), h('tbody', {}, hist)) : h('div', { class: 'sxload' }, '还没有记录'))];
}
