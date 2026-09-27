/* =====================================================================
   物品栏（I）：页签（装备 / 消耗品 / 材料 / 任务 / 称号）、8×6 格子、金币、整理
   右键：穿戴 / 使用（商店开着时 = 出售，仓库开着时 = 存入）；拖动：快捷栏 / 装备栏 / 仓库 / 商店 / 格子之间换位置；拖到窗外 = 丢弃
   ===================================================================== */
// 背包物品的默认操作（右键 / 双击）
function invPrimary(it, win) {
  if (!it) return;
  if (menus.isOpen('shop') || menus.isOpen('sell')) return shopSellAsk([it], menus.wins.shop || menus.wins.sell);
  if (menus.isOpen('storage')) return storagePut(it);
  if (menus.isOpen('disassemble') && canDisassemble(it)) { IW.disSel.has(it) ? IW.disSel.delete(it) : IW.disSel.add(it); sfx.click(); return itemsRefresh(); }
  if (menus.isOpen('enhance') && canEnhance(it)) { IW.enhSel = it; sfx.click(); return itemsRefresh(); }
  if (it.kind === 'equip') { if (inv.wear(it)) { save.write(); itemsRefresh(); } return; }
  if (it.kind === 'use') { if (inv.useItem(it)) itemsRefresh(); return; }
  toastMsg(it.kind === 'quest' ? '任务道具，完成任务时会自动交付' : '材料：可以出售，或在强化时使用', '#bfb0a0');
}
function invDiscard(it, win) {
  if (it.kind === 'quest') { toastMsg('任务道具不能丢弃', '#ff6a6a'); sfx.error(); return; }
  itemDialog(win, { title: '丢弃物品', msg: `确定要丢弃 ${itemNameHtml(it)} 吗？<br><span class="dim small">丢弃后无法找回。想换金币的话请到商店出售。</span>`, okText: '丢弃', danger: true,
    onOk: () => { inv.remove(it); for (let i = 0; i < 6; i++) if (inv.quick[i] === it.key && !inv.count(it.key)) inv.quick[i] = null; sfx.click(); save.write(); itemsRefresh(); } });
}
// 背包格子的拖放目标：收装备栏卸下、仓库取出、商店购买、快捷栏清除、格子之间换位置
function invDropTarget(target) {
  return {
    accept: p => p.type === 'item' && ['inv', 'equip', 'storage', 'bank', 'shop', 'quick', 'buyback'].includes(p.from),
    drop: p => {
      if (p.from === 'equip') { if (inv.unwear(p.slot)) { save.write(); itemsRefresh(); } return; }
      if (p.from === 'storage' || p.from === 'bank') return storageTake(p.item, p.from);
      if (p.from === 'shop') return shopBuyAsk([{ key: p.key, n: 1 }], menus.wins.shop);
      if (p.from === 'buyback') { if (buyBack(p.index)) itemsRefresh(); return; }
      if (p.from === 'quick') { inv.quick[p.slot] = null; return; }
      if (p.from === 'inv' && target && target !== p.item) {   // 换位置
        const a = inv.items.indexOf(p.item), b = inv.items.indexOf(target);
        if (a >= 0 && b >= 0) { inv.items[a] = target; inv.items[b] = p.item; itemsRefresh(); }
      } else if (p.from === 'inv' && !target) { const a = inv.items.indexOf(p.item); if (a >= 0) { inv.items.splice(a, 1); inv.items.push(p.item); itemsRefresh(); } }
    },
  };
}
// 选中物品后的操作栏（鼠标用右键 / 拖放也行；触屏只能点，所以这里给按钮）
function invActions(it, el) {
  if (!it) return null;
  const b = (txt, fn, cls = '') => h('button', { class: 'btn sm ' + cls, onclick: () => { sfx.click(); fn(); } }, txt);
  const row = h('div', { class: 'ibar', style: 'margin-top:.3em;padding:.3em .45em;background:#0c0a10;border:.08em solid #3a3040;border-radius:.25em' }, h('span', { class: `q${it.rar || 0}`, style: 'font-weight:800;font-size:.85em;max-width:9em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap' }, it.name), h('span', { class: 'sp' }));
  if (it.kind === 'equip') row.append(b('穿戴', () => invPrimaryPlain(it)));
  if (it.kind === 'use' && ITEMS[it.key] && ITEMS[it.key].use) row.append(b(ITEMS[it.key].use.open ? '打开' : '使用', () => invPrimaryPlain(it)));
  if (it.kind === 'use') row.append(h('span', { class: 'small dim' }, '快捷栏'), ...[0, 1, 2, 3, 4, 5].map(i => h('button', { class: 'btn sm' + (inv.quick[i] === it.key ? ' blue' : ''), style: 'padding:.2em .45em', onclick: () => { inv.quick[i] = inv.quick[i] === it.key ? null : it.key; sfx.click(); save.write(); el._render(); } }, String(i + 1))));
  if (menus.isOpen('shop') && canSell(it)) row.append(b('出售', () => shopSellAsk([it], menus.wins.shop), 'red'));
  if (menus.isOpen('storage') && it.kind !== 'quest') row.append(b('存入', () => storagePut(it)));
  if (it.kind !== 'quest') row.append(b('丢弃', () => invDiscard(it, el), 'red'));
  return row;
}
// 不管有没有开商店 / 仓库，直接穿戴 / 使用
function invPrimaryPlain(it) {
  if (it.kind === 'equip') { if (inv.wear(it)) { save.write(); itemsRefresh(); } }
  else if (it.kind === 'use' && inv.useItem(it)) itemsRefresh();
}
Object.assign(menus, {
  w_inv() {
    inv.ensure();
    const el = itemWin('inv', '物品栏', el => {
      const tab = IW.invTab, cnt = tabCounts(inv.items), list = inv.items.filter(x => TAB_OF(x) === tab);
      const tabs = h('div', { class: 'itabs' }, INV_TABS.map(([id, nm]) => h('div', { class: 'itab' + (id === tab ? ' on' : ''), onclick: () => { IW.invTab = id; sfx.click(); el._render(); } }, nm, h('span', { class: 'cnt' }, cnt[id] || 0))));
      const grid = h('div', { class: 'igrid', 'data-sk': 'inv' });
      if (IW.invSel && !inv.items.includes(IW.invSel)) IW.invSel = null;
      for (let i = 0; i < inv.cap; i++) {
        const it = list[i];
        grid.append(itemSlot(it, {
          quick: true, sel: it && it === IW.invSel, onRight: () => invPrimary(it, el), onDbl: () => invPrimary(it, el),
          onClick: () => { IW.invSel = it && IW.invSel !== it ? it : null; el._render(); },
          drag: it ? () => ({ type: 'item', item: it, key: it.key, from: 'inv', onVoid: () => { if (!ptrOverWindow()) invDiscard(it, el); } }) : null,
          drop: invDropTarget(it),
        }));
      }
      const quests = tab === 'quest' && list.length > inv.cap ? h('div', { class: 'ihint' }, `还有 ${list.length - inv.cap} 件任务道具`) : null;
      const bar = h('div', { class: 'ibar' },
        h('span', { class: 'igold' }, `${fmtNum(game.gold)} G`),
        h('span', { class: 'small', style: 'color:#ffe8c0' }, `复活币 ×${save.data ? save.data.coins : 0}`),
        h('span', { class: 'sp' }),
        h('span', { class: 'small dim' }, `${list.length}/${inv.cap}`),
        h('button', { class: 'btn sm', onclick: () => { inv.sort(); sfx.click(); itemsRefresh(); } }, '整理'),
        menus.w_status ? h('button', { class: 'btn sm blue', onclick: () => { sfx.click(); if (!menus.isOpen('status')) menus.open('status'); } }, '个人信息') : null);
      const acts = invActions(IW.invSel, el);
      const hint = h('div', { class: 'ihint' }, menus.isOpen('shop') ? '右键 / 拖进商店：出售' : menus.isOpen('storage') ? '右键：存入仓库' : '▲ 比身上的好 · ▼ 比身上的差 · 右键：穿戴 / 使用 · 拖动：换位置、放进快捷栏 · 拖到窗外：丢弃');
      return [tabs, grid, quests, bar, acts, hint];
    }, { w: 29, at: 'right' });
    return el;
  },
});
