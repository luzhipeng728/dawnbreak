/* =====================================================================
   仓库：角色仓库（save.data.storage）+ 账号金库（所有角色共享，localStorage 'dawnbreak_bank'，可存金币）
   背包右键 = 存入当前页签；仓库右键 = 取出；两边可以互相拖；Shift + 右键可以只存 / 取一部分
   ===================================================================== */
const storageList = which => which === 'bank' ? bank.load().items : inv.storage;
// 金库操作前重新从 localStorage 读一次（开了多个标签页时尽量不互相覆盖）
const bankFresh = () => { bank.loadedKey = null; return bank.load(); };
function storageAdd(list, it, cap = 48) {
  if (it.kind !== 'equip') { const ex = list.find(x => x.key === it.key && x.kind !== 'equip'); if (ex) { ex.n += it.n || 1; return true; } }
  if (list.length >= cap) return false;
  list.push(it); return true;
}
function storageSaved(which) { if (which === 'bank') bank.write(); if (save.data) save.data.storage = inv.storage; save.write(); }
function storagePut(it, which = IW.stTab, n) {
  if (!it || !inv.items.includes(it)) return;
  if (which === 'bank') bankFresh();
  if (it.kind === 'quest') { toastMsg('任务道具不能放进仓库', '#ff6a6a'); sfx.error(); return; }
  const list = storageList(which), part = n && it.kind !== 'equip' && n < it.n ? { ...it, id: itemSeq++, n } : it;
  if (!storageAdd(list, part === it ? it : { ...part })) { toastMsg('仓库已满', '#ff6a6a'); sfx.error(); return; }
  if (part === it) inv.remove(it); else it.n -= n;
  for (let i = 0; i < 6; i++) if (inv.quick[i] === it.key && !inv.count(it.key)) inv.quick[i] = null;
  sfx.pickup(); storageSaved(which); itemsRefresh();
}
function storageTake(it, which = IW.stTab, n) {
  if (which === 'bank') { const id = it.id; bankFresh(); it = bank.items.find(x => x.id === id); if (!it) { itemsRefresh(); return; } }
  const list = storageList(which); if (!list.includes(it)) return;
  const part = n && it.kind !== 'equip' && n < it.n ? { ...it, id: itemSeq++, n } : it;
  if (!inv.add(part === it ? it : part)) { toastMsg('背包已满', '#ff6a6a'); sfx.error(); return; }
  if (part === it) list.splice(list.indexOf(it), 1); else it.n -= n;
  sfx.pickup(); storageSaved(which); itemsRefresh();
}
Object.assign(menus, {
  w_storage() {
    inv.ensure(); bank.load();
    const el = itemWin('storage', '仓库', el => {
      const which = IW.stTab, list = storageList(which);
      const tabs = h('div', { class: 'itabs' }, [['char', '角色仓库'], ['bank', '账号金库']].map(([id, nm]) => h('div', { class: 'itab' + (which === id ? ' on' : ''), onclick: () => { IW.stTab = id; sfx.click(); el._render(); } }, nm, h('span', { class: 'cnt' }, `${storageList(id).length}/48`))));
      const grid = h('div', { class: 'igrid', 'data-sk': 'st' });
      for (let i = 0; i < 48; i++) {
        const it = list[i];
        grid.append(itemSlot(it, {
          onRight: ev => { if (!it) return; if (ev.shiftKey && it.n > 1) qtyDialog(el, { title: `取出数量：${it.name}`, max: it.n, init: it.n, onOk: n => storageTake(it, which, n) }); else storageTake(it, which); },
          onDbl: () => it && storageTake(it, which),
          drag: it ? () => ({ type: 'item', item: it, from: which === 'bank' ? 'bank' : 'storage' }) : null,
          drop: { accept: p => p.type === 'item' && p.from === 'inv', drop: p => storagePut(p.item, which) },
        }));
      }
      const out = [tabs, grid];
      if (which === 'bank') {
        const inp = h('input', { type: 'number', min: 0, value: '', placeholder: '金额', style: 'width:7em;background:#0c0a10;color:#fff;border:.1em solid #6a5436;border-radius:.2em;padding:.2em .4em;font-family:inherit' });
        inp.addEventListener('keydown', ev => ev.stopPropagation());
        const amt = () => Math.max(0, Math.floor(+inp.value || 0));
        out.push(h('div', { class: 'shopfoot' }, h('span', {}, '金库金币 ', h('b', { class: 'igold' }, `${fmtNum(bank.gold)} G`)), h('span', { class: 'sp' }), inp,
          h('button', { class: 'btn sm', onclick: () => { const a = Math.min(amt(), game.gold); if (a <= 0) { toastMsg('请输入要存入的金额', '#ffb0a0'); sfx.error(); return; } bankFresh(); game.gold -= a; bank.gold += a; sfx.coin(); storageSaved('bank'); itemsRefresh(); } }, '存入'),
          h('button', { class: 'btn sm blue', onclick: () => { bankFresh(); const a = Math.min(amt(), bank.gold); if (a <= 0) { toastMsg(bank.gold ? '请输入要取出的金额' : '金库里没有金币', '#ffb0a0'); sfx.error(); return; } bank.gold -= a; game.gold += a; sfx.coin(); storageSaved('bank'); itemsRefresh(); } }, '取出')));
      }
      out.push(h('div', { class: 'ibar' }, h('span', { class: 'igold' }, `${fmtNum(game.gold)} G`), h('span', { class: 'sp' }),
        h('button', { class: 'btn sm', onclick: () => { const L = storageList(which), m = []; for (const x of L) { if (x.kind !== 'equip') { const e = m.find(y => y.key === x.key && y.kind !== 'equip'); if (e) { e.n += x.n; continue; } } m.push(x); } m.sort((a, b) => (TAB_OF(a) > TAB_OF(b) ? 1 : TAB_OF(a) < TAB_OF(b) ? -1 : 0) || b.rar - a.rar || (b.lvl || 0) - (a.lvl || 0)); L.length = 0; L.push(...m); storageSaved(which); sfx.click(); el._render(); } }, '整理')),
        h('div', { class: 'ihint' }, which === 'bank' ? '账号金库：同一台电脑上的所有角色共用，可以存金币。背包右键存入，这里右键取出（Shift + 右键取出一部分）。' : '角色仓库：只有这个角色能用。背包右键存入，这里右键取出（Shift + 右键取出一部分）。'));
      return out;
    }, { w: 29, at: 'left' });
    dnd.target(el, { accept: p => p.type === 'item' && p.from === 'inv', drop: p => storagePut(p.item) });
    if (!menus.isOpen('inv') && menus.w_inv) setTimeout(() => { if (menus.isOpen('storage') && !menus.isOpen('inv')) menus.open('inv'); }, 0);
    return el;
  },
});
