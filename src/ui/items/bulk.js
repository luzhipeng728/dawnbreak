/* =====================================================================
   一键出售 / 一键分解（物品栏底部的两个按钮，随时可用）
   按品级勾选（普通 / 高级 / 稀有 / 神器 / 传说 / 史诗）+ 保护选项（只处理比身上差的、保留套装、保留强化过的），
   预览列表里可以单独取消某一件；勾选设置会记住（本机界面偏好）
   ===================================================================== */
addStyle(`
.bulk .rars{display:flex;gap:.35em;flex-wrap:wrap}
.bulk .rar{display:flex;align-items:center;gap:.25em;padding:.2em .55em;border:.08em solid #4a3c2c;border-radius:.3em;cursor:pointer;background:#120e16;font-weight:800;font-size:.9em;user-select:none}
.bulk .rar.on{border-color:currentColor;background:rgba(255,255,255,.06);box-shadow:inset 0 0 .5em rgba(255,255,255,.08)}
.bulk .rar input,.bulk .opt input{pointer-events:none}
.bulk .opts{display:flex;gap:.3em 1em;flex-wrap:wrap;font-size:.86em;color:#c8b890}
.bulk .opt{display:flex;align-items:center;gap:.25em;cursor:pointer;user-select:none}
.bulk .igrid{max-height:14em;overflow:auto;grid-template-columns:repeat(9,3.1em)}
.bulk .sum{display:flex;align-items:center;gap:.6em;flex-wrap:wrap;background:#0c0a10;border:.08em solid #3a3040;border-radius:.25em;padding:.4em .6em;font-size:.9em}
.bulk .warn{color:#ff9a7a;font-size:.82em}
`);
const BULK_DEF = { rar: [0, 1], worse: true, keepSet: true, keepEnh: true };
const bulkPrefs = () => ({ ...BULK_DEF, ...(uiPref('bulk') || {}) });
const bulkSkip = new Set();   // 预览里被单独取消的物品 id（关窗口时清空）
function bulkCandidates(mode, P = bulkPrefs()) {
  return inv.items.filter(it => {
    if (it.kind !== 'equip' || it.slot === 'title' || (typeof isAvatar === 'function' && isAvatar(it))) return false;   // 称号、时装不参与
    if (mode === 'sell' ? !canSell(it) : !canDisassemble(it)) return false;
    if (!P.rar.includes(it.rar || 0)) return false;
    if (P.keepSet && it.set) return false;
    if (P.keepEnh && it.enh) return false;
    if (P.worse && typeof equipCompare === 'function') { const c = equipCompare(it); if (c && !['down', 'na'].includes(c.v)) return false; }   // 只处理比身上差的（和别的职业用的）
    return true;
  });
}
Object.assign(menus, {
  w_bulk(mode = 'sell') {
    const sell = mode === 'sell';
    const el = itemWin('bulk', sell ? '一键出售' : '一键分解', el => {
      const P = bulkPrefs(), save2 = p => { setPref('bulk', p); el._render(); };
      const rars = h('div', { class: 'rars' }, RARITY.map((R, i) => {
        const on = P.rar.includes(i);
        return h('label', { class: 'rar' + (on ? ' on' : ''), style: `color:${R.col}`, onclick: e => { e.preventDefault(); sfx.click(); save2({ ...P, rar: on ? P.rar.filter(x => x !== i) : [...P.rar, i].sort() }); } }, itemCheckBox(on, () => {}), R.name);
      }));
      const opt = (k, txt) => h('label', { class: 'opt', onclick: e => { e.preventDefault(); sfx.click(); save2({ ...P, [k]: !P[k] }); } }, itemCheckBox(P[k], () => {}), txt);
      const opts = h('div', { class: 'opts' }, opt('worse', '只处理比身上差的（▼ 和别的职业的 ×）'), opt('keepSet', '保留套装部件'), opt('keepEnh', '保留强化过的'));
      const cand = bulkCandidates(mode, P), list = cand.filter(it => !bulkSkip.has(it.id));
      const grid = h('div', { class: 'igrid', 'data-sk': 'bulk' });
      for (const it of cand) grid.append(itemSlot(it, { chk: !bulkSkip.has(it.id), dim: bulkSkip.has(it.id), cmp: true, onClick: () => { bulkSkip.has(it.id) ? bulkSkip.delete(it.id) : bulkSkip.add(it.id); sfx.click(); el._render(); } }));
      if (!cand.length) grid.append(h('div', { class: 'ihint', style: 'grid-column:1 / -1;padding:1em' }, '没有符合条件的装备'));
      const high = list.filter(it => (it.rar || 0) >= 3).length;
      let sum;
      if (sell) {
        const gold = list.reduce((s, it) => s + sellPrice(it), 0);
        sum = h('div', { class: 'sum' }, `共 ${list.length} 件`, h('span', { class: 'igold' }, `+${fmtNum(gold)} G`), h('span', { class: 'sp' }), h('span', { class: 'ihint' }, '卖掉的装备可以在商店的“回购”里买回最近 12 件'));
      } else {
        const mats = {}, fee = list.reduce((s, it) => s + disassembleFee(it), 0);
        for (const it of list) { const y = disassembleYield(it); for (const k in y) mats[k] = (mats[k] || 0) + y[k]; }
        sum = h('div', { class: 'sum' }, `共 ${list.length} 件 · 手续费 `, h('span', { class: 'igold' }, `${fmtNum(fee)} G`), ' · 预计得到：',
          ...Object.entries(mats).map(([k, n]) => h('span', { style: 'white-space:nowrap' }, `${(ITEMS[k] || {}).name || k} ×${n}`)));
      }
      const go = h('button', { class: 'btn big' + (list.length ? '' : ' off'), onclick: () => {
        if (!list.length) { sfx.error(); return; }
        const run = () => {
          if (sell) { const g = sellItems(list); if (g) toastMsg(`一键出售 ${list.length} 件装备，获得 ${fmtNum(g)} G`, '#ffd23a'); }
          else { const r = disassemble(list); if (r) toastMsg(`一键分解 ${r.n} 件装备：${Object.entries(r.mats).map(([k, n]) => `${(ITEMS[k] || {}).name || k}×${n}`).join('、')}`, '#bfe8ff'); }
          bulkSkip.clear(); itemsRefresh();
        };
        if (high) itemDialog(el, { title: sell ? '确认出售' : '确认分解', danger: true, okText: sell ? '全部出售' : '全部分解', onOk: run,
          msg: `其中有 <b style="color:#ff55ff">${high}</b> 件神器及以上品级的装备，${sell ? '出售' : '分解'}后${sell ? '只能在回购里找回最近 12 件' : '无法恢复'}。确定继续吗？` });
        else run();
      } }, sell ? `出售 ${list.length} 件` : `分解 ${list.length} 件`);
      return [h('div', { class: 'bulk col', style: 'gap:.45em' },
        h('div', { class: 'small', style: 'color:#e8c26a;font-weight:900' }, '选择品级'), rars,
        opts, P.rar.some(r => r >= 3) ? h('div', { class: 'warn' }, '已勾选神器及以上品级，执行前会再确认一次') : null,
        h('div', { class: 'small dim' }, `预览（点击格子可以单独取消 / 恢复）`), grid, sum,
        h('div', { class: 'row', style: 'justify-content:flex-end' }, go, h('button', { class: 'btn blue', onclick: () => { sfx.click(); bulkSkip.clear(); menus.close('bulk'); } }, '取消')))];
    }, { w: 34, at: 'left' });
    el._arg = mode; return el;
  },
});
// 物品栏底部加两个按钮
{
  const w0 = menus.w_inv;
  menus.w_inv = function (arg) {
    const el = w0.call(this, arg);
    const add = () => { const bar = el.querySelector('.ibar'); if (!bar || bar.querySelector('.bulkbtn')) return;
      const b = (txt, mode) => h('button', { class: 'btn sm bulkbtn', onclick: () => { sfx.click(); bulkSkip.clear(); if (menus.isOpen('bulk')) menus.close('bulk'); menus.open('bulk', mode); } }, txt);
      bar.append(b('一键出售', 'sell'), b('一键分解', 'dis')); };
    add(); const r0 = el._render; el._render = () => { r0(); add(); };
    return el;
  };
}
ITEM_WINS.push('bulk');
