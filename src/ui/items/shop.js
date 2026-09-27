/* =====================================================================
   商店（官方式）：购买 / 出售 / 回购 三个页签
   - 购买：勾选多件后一次买；Shift + 点击输入数量；右键直接买 1 个；拖到背包也能买
   - 出售：勾选多件批量出售，“全选普通 / 高级及以下”快捷键；背包右键或拖进商店也能卖
   - 回购：最近卖掉的 12 件
   - 贵重物品（神器以上 / 强化过 / 套装 / 1 万金币以上）买卖前二次确认
   ===================================================================== */
addStyle(`
.shopwin .greet{color:#c8b890;font-size:.85em;font-style:italic}
.shopcats{display:flex;gap:.3em;align-items:center;flex-wrap:wrap;margin-bottom:.3em}
.shopcats .cat{padding:.15em .6em;border-radius:1em;border:.08em solid #4a3c2c;cursor:pointer;font-size:.8em;color:#b8a888;background:#18121e}
.shopcats .cat.on{background:#5a4424;color:#ffe8a8;border-color:#a88450}
.shopcats label{font-size:.78em;color:#b8a888;display:flex;align-items:center;gap:.2em;cursor:pointer;margin-left:auto}
.srow{display:grid;grid-template-columns:1.3em 2.6em 1fr auto 5.6em;gap:.5em;align-items:center;padding:.22em .45em;background:#15111a;border:.08em solid #2e2838;border-radius:.25em;cursor:pointer}
.srow:hover{border-color:#8a6a3a;background:#1e1824}
.srow.on{border-color:#6aff7a;background:#1a2418}
.srow .ck{width:1.1em;height:1.1em;border:.1em solid #8a7a5a;border-radius:.15em;display:grid;place-items:center;font-size:.8em;color:#6aff7a;font-weight:900}
.srow .islot{width:2.6em;height:2.6em}
.srow .nm{font-weight:800;font-size:.9em;line-height:1.2}
.srow .sub{font-size:.72em;color:#8a806e}
.srow .sub .bad{color:#ff6a6a}
.srow .qty{font-size:.78em;color:#ffe070;font-weight:900}
.srow .pr{text-align:right;color:#ffd24a;font-weight:800;font-size:.88em}
.srow .pr.no{color:#ff6a6a}
.shopfoot{display:flex;gap:.5em;align-items:center;flex-wrap:wrap;padding:.4em .5em;background:#0c0a10;border:.1em solid #3a3040;border-radius:.25em}
.shopfoot .sp{flex:1}
.shopfoot .tot{color:#ffd24a;font-weight:900}
.selgrid{max-height:17.5em;overflow:auto}
.bbrow{grid-template-columns:2.6em 1fr 5.6em 4em}
`);
const shopOf = arg => SHOPS[arg && arg.shop] || SHOPS._default;
const shopPrice = (S, key) => Math.max(1, Math.round((ITEMS[key].price || 10) * (S.markup || 1)));
const shopPreview = {};
const previewOf = key => shopPreview[key] || (shopPreview[key] = makeItem(key, 1, { grade: 2 }));
function shopGoods(S, tabI) {
  const T = S.tabs[tabI]; if (!T) return [];
  let keys = typeof T.goods === 'function' ? T.goods(game.lvl, game.player.cls) : T.goods;
  keys = keys.filter(k => ITEMS[k]);
  if (T.cls && IW.shopOwnCls !== false) keys = keys.filter(k => !ITEMS[k].cls || ITEMS[k].cls === game.player.cls);
  return keys;
}
// 买：list = [{ key, n }]
function shopBuy(list, S = SHOPS._default) {
  let cost = 0; const need = {}, seen = new Set();
  for (const e of list) {
    const D = ITEMS[e.key]; if (!D) continue; cost += shopPrice(S, e.key) * e.n;
    if (e.key === 'coin') continue;
    const tab = TAB_OF(D);
    if (D.kind === 'equip') need[tab] = (need[tab] || 0) + e.n;
    else if (!inv.count(e.key) && !seen.has(e.key)) { seen.add(e.key); need[tab] = (need[tab] || 0) + 1; }
  }
  if (game.gold < cost) { toastMsg(`金币不足（需要 ${fmtNum(cost)} G）`, '#ff6a6a'); sfx.error(); return false; }
  for (const t in need) if (inv.free(t) < need[t]) { toastMsg('背包空间不足', '#ff6a6a'); sfx.error(); return false; }
  for (const e of list) {
    const D = ITEMS[e.key]; if (!D) continue;
    if (D.kind === 'equip') for (let i = 0; i < e.n; i++) inv.add(makeItem(e.key, 1, { grade: 2 }));
    else inv.add(makeItem(e.key, e.n));
    bus.emit('buy', { key: e.key, n: e.n, cost: shopPrice(S, e.key) * e.n });
  }
  game.gold -= cost; sfx.coin(); save.write();
  toastMsg(list.length === 1 ? `购买了 ${ITEMS[list[0].key].name}${list[0].n > 1 ? ' ×' + list[0].n : ''}（-${fmtNum(cost)} G）` : `购买了 ${list.length} 种物品（-${fmtNum(cost)} G）`, '#ffd23a');
  return true;
}
function shopBuyAsk(list, win, S) {
  S = S || (win && win._shop) || SHOPS._default;
  list = list.filter(e => ITEMS[e.key] && e.n > 0); if (!list.length) return;
  const cost = list.reduce((s, e) => s + shopPrice(S, e.key) * e.n, 0);
  const done = () => { if (shopBuy(list, S)) { IW.shopSel = {}; itemsRefresh(); } };
  const valuable = cost >= 10000 || list.some(e => ITEMS[e.key].rar >= 3);
  if (!valuable || !win) return done();
  itemDialog(win, { title: '确认购买', msg: list.map(e => `${itemNameHtml({ ...ITEMS[e.key], n: e.n })}　<span class="gold">${fmtNum(shopPrice(S, e.key) * e.n)} G</span>`).join('<br>') + `<hr>合计 <b class="gold">${fmtNum(cost)} G</b>（持有 ${fmtNum(game.gold)} G）`, okText: '购买', onOk: done });
}
function shopSellAsk(items, win) {
  items = items.filter(canSell);
  if (!items.length) { toastMsg('没有可以出售的物品', '#ffb0a0'); sfx.error(); return; }
  const gold = items.reduce((s, it) => s + sellPrice(it), 0);
  const done = () => { const g = sellItems(items); if (g) { toastMsg(`出售了 ${items.length} 件物品，获得 ${fmtNum(g)} G`, '#ffd23a'); for (const it of items) IW.sellSel.delete(it); } itemsRefresh(); };
  const valuable = items.filter(it => isValuable(it, sellPrice(it)));
  if (!valuable.length || !win) return done();
  itemDialog(win, { title: '确认出售', msg: `下面的物品比较贵重，确定要出售吗？<br>${valuable.slice(0, 8).map(itemNameHtml).join('<br>')}${valuable.length > 8 ? `<br>……等 ${valuable.length} 件` : ''}<hr>共 ${items.length} 件，获得 <b class="gold">${fmtNum(gold)} G</b><br><span class="dim small">卖掉后可以在“回购”页签买回来。</span>`, okText: '出售', danger: true, onOk: done });
}
Object.assign(menus, {
  w_shop(arg = {}) {
    inv.ensure();
    const S = shopOf(arg), npc = arg.npc, sid = S.id;
    IW.shopTab[sid] = arg.tab || IW.shopTab[sid] || 'buy';
    const el = itemWin('shop', `${npc ? npc.name + ' · ' : ''}${S.name}`, el => {
      const mode = IW.shopTab[sid];
      const tabs = h('div', { class: 'itabs' }, [['buy', '购买'], ['sell', '出售'], ['buyback', '回购']].map(([id, nm]) => h('div', { class: 'itab' + (mode === id ? ' on' : ''), onclick: () => { IW.shopTab[sid] = id; closeItemDialog(); sfx.click(); el._render(); } }, nm, id === 'buyback' ? h('span', { class: 'cnt' }, (save.data.buyback || []).length) : null)));
      const out = [S.greet ? h('div', { class: 'greet' }, `“${S.greet}”`) : null, tabs];
      if (mode === 'buy') out.push(...shopBuyView(S, el));
      else if (mode === 'sell') out.push(...shopSellView(el));
      else out.push(...shopBuybackView(el));
      return out;
    }, { w: 34, at: 'left' });
    el._shop = S; el._arg = arg; el.classList.add('shopwin');
    // 把背包里的物品拖进商店 = 出售
    dnd.target(el, { accept: p => p.type === 'item' && p.from === 'inv', drop: p => shopSellAsk([p.item], el) });
    if (!menus.isOpen('inv') && menus.w_inv) setTimeout(() => { if (menus.isOpen('shop') && !menus.isOpen('inv')) menus.open('inv'); }, 0);
    return el;
  },
  w_sell(arg = {}) { return this.w_shop({ ...arg, tab: 'sell' }); },
});
function shopBuyView(S, el) {
  const sid = S.id, cat = clamp(IW.shopCat[sid] || 0, 0, S.tabs.length - 1), sel = IW.shopSel;
  const cats = h('div', { class: 'shopcats' }, S.tabs.length > 1 ? S.tabs.map((T, i) => h('span', { class: 'cat' + (i === cat ? ' on' : ''), onclick: () => { IW.shopCat[sid] = i; sfx.click(); el._render(); } }, T.name)) : null,
    S.tabs[cat].cls ? h('label', {}, h('input', { type: 'checkbox', checked: IW.shopOwnCls !== false ? '' : null, onchange: e => { IW.shopOwnCls = e.target.checked; el._render(); } }), '只看本职业') : null);
  if (S.tabs[cat].cls && IW.shopOwnCls === false) cats.querySelector('input').checked = false;
  const keys = shopGoods(S, cat);
  const list = h('div', { class: 'ilist', 'data-sk': 'goods' });
  for (const key of keys) {
    const D = ITEMS[key], pr = shopPrice(S, key), it = D.kind === 'equip' ? previewOf(key) : { ...D, key, n: 1 }, on = sel[key] > 0;
    const low = D.kind === 'equip' && D.lvl > game.lvl;
    const sub = D.kind === 'equip' ? [h('span', { class: low ? 'bad' : '' }, `Lv.${D.lvl}`), ` ${itemTypeName(it)}`, D.cls && D.cls !== game.player.cls ? h('span', { class: 'bad' }, ` · ${CLASSES[D.cls] ? CLASSES[D.cls].name : ''}专用`) : null] : [itemTypeName(it), key === 'coin' ? ` · 持有 ${save.data.coins}` : ` · 持有 ${inv.count(key)}`];
    const row = h('div', { class: 'srow' + (on ? ' on' : '') },
      h('span', { class: 'ck' }, on ? '✔' : ''), itemSlot(it, { cmp: true }),
      h('div', {}, h('div', { class: `nm q${D.rar}` }, D.name), h('div', { class: 'sub' }, ...sub)),
      h('span', { class: 'qty' }, on && sel[key] > 1 ? `×${sel[key]}` : ''),
      h('span', { class: 'pr' + (game.gold < pr ? ' no' : '') }, `${fmtNum(pr)} G`));
    row.addEventListener('click', ev => {
      if (row._dndJustDropped) return;
      sfx.click();
      if (ev.shiftKey) {   // Shift + 点击：输入数量
        const max = D.kind === 'equip' ? Math.max(1, inv.free('equip')) : 999;
        qtyDialog(el, { title: `购买数量：${D.name}`, max: Math.max(1, Math.min(max, Math.floor(game.gold / pr) || 1)), init: sel[key] || 1, unit: pr, onOk: n => { sel[key] = n; el._render(); } });
        return;
      }
      if (on) delete sel[key]; else sel[key] = 1; el._render();
    });
    row.addEventListener('contextmenu', ev => { ev.preventDefault(); shopBuyAsk([{ key, n: 1 }], el, S); });
    dnd.source(row, () => ({ type: 'item', item: it, key, from: 'shop' }));
    list.append(row);
  }
  if (!keys.length) list.append(h('div', { class: 'dim', style: 'padding:1em;text-align:center' }, '现在没有适合你等级的货物，升级后再来看看吧。'));
  const chosen = Object.keys(sel).filter(k => sel[k] > 0 && ITEMS[k]);
  const total = chosen.reduce((s, k) => s + shopPrice(S, k) * sel[k], 0);
  const foot = h('div', { class: 'shopfoot' },
    h('span', {}, `已选 ${chosen.length} 种　合计 `, h('span', { class: 'tot' }, `${fmtNum(total)} G`)), h('span', { class: 'sp' }), h('span', { class: 'igold' }, `${fmtNum(game.gold)} G`),
    h('button', { class: 'btn sm blue' + (chosen.length ? '' : ' off'), onclick: () => { IW.shopSel = {}; sfx.click(); el._render(); } }, '清空'),
    h('button', { class: 'btn sm' + (chosen.length && total <= game.gold ? '' : ' off'), onclick: () => { sfx.click(); shopBuyAsk(chosen.map(k => ({ key: k, n: sel[k] })), el, S); } }, `购买选中${chosen.length ? `（${chosen.length}）` : ''}`));
  return [cats, list, foot, h('div', { class: 'ihint' }, '点击勾选（可多选）· Shift + 点击输入数量 · 右键直接购买 1 个 · 拖到背包购买 · 把背包物品拖进来出售')];
}
function shopSellView(el) {
  const tab = IW.sellTab || 'equip', list = inv.items.filter(x => TAB_OF(x) === tab), sel = IW.sellSel;
  for (const it of [...sel]) if (!inv.items.includes(it)) sel.delete(it);
  const cnt = tabCounts(inv.items);
  const tabs = h('div', { class: 'shopcats' }, INV_TABS.filter(([id]) => id !== 'quest').map(([id, nm]) => h('span', { class: 'cat' + (id === tab ? ' on' : ''), onclick: () => { IW.sellTab = id; sfx.click(); el._render(); } }, `${nm} ${cnt[id] || 0}`)));
  const grid = h('div', { class: 'igrid selgrid', 'data-sk': 'sell' });
  for (let i = 0; i < Math.max(24, Math.ceil(list.length / 8) * 8); i++) {
    const it = list[i];
    grid.append(itemSlot(it, { chk: it && sel.has(it), dim: it && !canSell(it), onClick: () => { if (!it || !canSell(it)) return; sel.has(it) ? sel.delete(it) : sel.add(it); sfx.click(); el._render(); }, onRight: () => it && shopSellAsk([it], el) }));
  }
  const pickBy = f => { for (const it of list) if (canSell(it) && f(it)) sel.add(it); sfx.click(); el._render(); };
  const quick = h('div', { class: 'shopcats' },
    h('span', { class: 'cat', onclick: () => pickBy(it => (it.rar || 0) === 0 && !it.enh) }, '全选普通'),
    h('span', { class: 'cat', onclick: () => pickBy(it => (it.rar || 0) <= 1 && !it.enh) }, '全选高级及以下'),
    tab === 'equip' ? h('span', { class: 'cat', onclick: () => pickBy(it => it.lvl < game.lvl - 5 && (it.rar || 0) <= 2) }, '全选低等级') : null,
    h('span', { class: 'cat', onclick: () => pickBy(() => true) }, '全选本页'),
    h('span', { class: 'cat', onclick: () => { sel.clear(); sfx.click(); el._render(); } }, '清空'));
  const items = [...sel], gold = items.reduce((s, it) => s + sellPrice(it), 0);
  const foot = h('div', { class: 'shopfoot' }, h('span', {}, `已选 ${items.length} 件　可得 `, h('span', { class: 'tot' }, `${fmtNum(gold)} G`)), h('span', { class: 'sp' }), h('span', { class: 'igold' }, `${fmtNum(game.gold)} G`),
    h('button', { class: 'btn sm red' + (items.length ? '' : ' off'), onclick: () => { sfx.click(); shopSellAsk(items, el); } }, `出售选中${items.length ? `（${items.length}）` : ''}`));
  return [tabs, quick, grid, foot, h('div', { class: 'ihint' }, '点击勾选 · 右键直接出售 · 卖错了可以在“回购”买回来')];
}
function shopBuybackView(el) {
  const bb = save.data.buyback || [];
  const list = h('div', { class: 'ilist', 'data-sk': 'bb' });
  bb.forEach((e, i) => {
    const row = h('div', { class: 'srow bbrow' }, itemSlot(e.item, {}), h('div', {}, h('div', { class: `nm q${e.item.rar || 0}` }, (e.item.enh ? `+${e.item.enh} ` : '') + e.item.name + (e.item.n > 1 ? ` ×${e.item.n}` : '')), h('div', { class: 'sub' }, itemTypeName(e.item))),
      h('span', { class: 'pr' + (game.gold < e.price ? ' no' : '') }, `${fmtNum(e.price)} G`),
      h('button', { class: 'btn sm', onclick: ev => { ev.stopPropagation(); if (buyBack(i)) { toastMsg(`回购了 ${e.item.name}`, '#ffd23a'); itemsRefresh(); } } }, '回购'));
    dnd.source(row, () => ({ type: 'item', item: e.item, from: 'buyback', index: i }));
    list.append(row);
  });
  if (!bb.length) list.append(h('div', { class: 'dim', style: 'padding:1em;text-align:center' }, '最近没有出售过物品'));
  return [list, h('div', { class: 'ihint' }, '保留最近出售的 12 件物品，按出售价格买回。')];
}
