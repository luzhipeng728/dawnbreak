/* =====================================================================
   一键出售 / 一键分解（物品栏底部的两个按钮，随时可用）
   按品级勾选（普通 / 高级 / 稀有 / 神器 / 传说 / 史诗）+ 保护选项（只处理比身上差的、保留套装、保留强化过的），
   预览列表里可以单独取消某一件；勾选设置会记住（本机界面偏好）
   时装页的“一键出售”：按类别勾选（时装 / 武器装扮 / 宠物 / 宠物装备 / 光环 / 天空套），默认同一种留下最好的 1 件（身上穿着的也算）
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
function titleCandidates(P = bulkPrefs()) {
  const worn = new Set(Object.values(inv.equip).filter(Boolean).map(e => e.key)), best = {};
  const all = inv.items.filter(it => it.kind === 'equip' && it.slot === 'title' && canSell(it) && P.rar.includes(it.rar || 0));
  if (P.keepOne) for (const it of all) if (!best[it.key] || avScore(it) > avScore(best[it.key])) best[it.key] = it;
  return all.filter(it => !(P.keepOne && (best[it.key] === it || worn.has(it.key))));
}
function bulkCandidates(mode, P = bulkPrefs()) {
  if (mode === 'tsell') return titleCandidates(P);
  return inv.items.filter(it => {
    if (it.kind !== 'equip' || it.slot === 'title' || (typeof isAvatar === 'function' && isAvatar(it))) return false;   // 称号、时装不参与
    if (mode === 'sell' ? !canSell(it) : !canDisassemble(it)) return false;
    if (!P.rar.includes(it.rar || 0)) return false;
    if (P.keepSet && it.set) return false;
    if (P.keepEnh && (it.enh || it.dim || it.forge || it.orb)) return false;   // 强化 / 增幅 / 锻造 / 附魔过的都算
    if (P.worse && typeof equipCompare === 'function') { const c = equipCompare(it); if (c && !['down', 'na'].includes(c.v)) return false; }   // 只处理比身上差的（和别的职业用的）
    return true;
  });
}
const AV_CATS = [['cos', '时装'], ['weapon', '武器装扮'], ['pet', '宠物'], ['petgear', '宠物装备'], ['aura', '光环'], ['sky', '天空套']];
const avCat = it => { const S = typeof CASH_SETS !== 'undefined' && CASH_SETS[it.avSet || it.set];
  return it.slot === 'av_pet' ? 'pet' : /^av_pet[RBG]$/.test(it.slot) ? 'petgear' : it.slot === 'av_aura' ? 'aura' : it.slot === 'av_weapon' ? 'weapon' : S && S.tier === 'rare' ? 'sky' : 'cos'; };
const AVB_DEF = { cats: ['cos', 'weapon', 'pet', 'petgear', 'aura'], keepOne: true, keepOrb: true };
const avBulkPrefs = () => ({ ...AVB_DEF, ...(uiPref('avbulk') || {}) });
const avScore = it => (it.rar || 0) * 1e4 + (it.orb ? 5000 : 0) + Object.values(it.st || {}).reduce((s, v) => s + (Math.abs(v) < 1 ? v * 100 : v), 0);
function avBulkCandidates(P = avBulkPrefs()) {
  const all = inv.items.filter(it => it.kind === 'equip' && isAvatar(it) && canSell(it)), keep = new Set();
  if (P.keepOne) {
    const by = {}; for (const it of all) (by[it.key] = by[it.key] || []).push(it);
    for (const k in by) if (!Object.values(inv.equip).some(e => e && e.key === k)) keep.add(by[k].sort((a, b) => avScore(b) - avScore(a))[0]);
  }
  return all.filter(it => P.cats.includes(avCat(it)) && !keep.has(it) && !(P.keepOrb && it.orb));
}
Object.assign(menus, {
  w_bulk(mode = 'sell') {
    const av = mode === 'avsell', ti = mode === 'tsell', sell = mode === 'sell' || av || ti;
    const el = itemWin('bulk', av ? '一键出售时装' : ti ? '一键出售称号' : sell ? '一键出售' : '一键分解', el => {
      const P = av ? avBulkPrefs() : ti ? { ...bulkPrefs(), keepOne: bulkPrefs().keepOne !== false } : bulkPrefs(), save2 = p => { setPref(av ? 'avbulk' : 'bulk', p); el._render(); };
      const rars = av
        ? h('div', { class: 'rars' }, AV_CATS.map(([k, name]) => {
          const on = P.cats.includes(k);
          return h('label', { class: 'rar' + (on ? ' on' : ''), style: `color:${k === 'sky' ? '#ff9ae8' : '#e8d4a8'}`, onclick: e => { e.preventDefault(); sfx.click(); save2({ ...P, cats: on ? P.cats.filter(x => x !== k) : [...P.cats, k] }); } }, itemCheckBox(on, () => {}), name);
        }))
        : h('div', { class: 'rars' }, RARITY.map((R, i) => {
          const on = P.rar.includes(i);
          return h('label', { class: 'rar' + (on ? ' on' : ''), style: `color:${R.col}`, onclick: e => { e.preventDefault(); sfx.click(); save2({ ...P, rar: on ? P.rar.filter(x => x !== i) : [...P.rar, i].sort() }); } }, itemCheckBox(on, () => {}), R.name);
        }));
      const opt = (k, txt) => h('label', { class: 'opt', onclick: e => { e.preventDefault(); sfx.click(); save2({ ...P, [k]: !P[k] }); } }, itemCheckBox(P[k], () => {}), txt);
      const opts = av ? h('div', { class: 'opts' }, opt('keepOne', '同一种留 1 件（留最好的；身上穿着的也算）'), opt('keepOrb', '保留附魔过的'))
        : ti ? h('div', { class: 'opts' }, opt('keepOne', '同名称号留 1 件（留最好的；身上戴着的也算）'))
        : h('div', { class: 'opts' }, opt('worse', '只处理比身上差的（▼ 和别的职业的 ×）'), opt('keepSet', '保留套装部件'), opt('keepEnh', '保留强化过的'));
      const cand = av ? avBulkCandidates(P) : bulkCandidates(mode, P), list = cand.filter(it => !bulkSkip.has(it.id));
      const grid = h('div', { class: 'igrid', 'data-sk': 'bulk' });
      for (const it of cand) grid.append(itemSlot(it, { chk: !bulkSkip.has(it.id), dim: bulkSkip.has(it.id), cmp: true, onClick: () => { bulkSkip.has(it.id) ? bulkSkip.delete(it.id) : bulkSkip.add(it.id); sfx.click(); el._render(); } }));
      if (!cand.length) grid.append(h('div', { class: 'ihint', style: 'grid-column:1 / -1;padding:1em' }, ti ? '没有符合条件的称号' : '没有符合条件的装备'));
      const high = list.filter(it => (it.rar || 0) >= 3 || (av && avCat(it) === 'sky')).length;
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
          if (sell) { const g = sellItems(list); if (g) toastMsg(`一键出售 ${list.length} 件${ti ? '称号' : '装备'}，获得 ${fmtNum(g)} G`, '#ffd23a'); }
          else { const r = disassemble(list); if (r) toastMsg(`一键分解 ${r.n} 件装备：${Object.entries(r.mats).map(([k, n]) => `${(ITEMS[k] || {}).name || k}×${n}`).join('、')}`, '#bfe8ff'); }
          bulkSkip.clear(); itemsRefresh();
        };
        if (high) itemDialog(el, { title: sell ? '确认出售' : '确认分解', danger: true, okText: sell ? '全部出售' : '全部分解', onOk: run,
          msg: `其中有 <b style="color:#ff55ff">${high}</b> 件${av ? '天空套 / 神器及以上品级的时装' : '神器及以上品级的装备'}，${sell ? '出售' : '分解'}后${sell ? '只能在回购里找回最近 12 件' : '无法恢复'}。确定继续吗？` });
        else run();
      } }, sell ? `出售 ${list.length} 件` : `分解 ${list.length} 件`);
      return [h('div', { class: 'bulk col', style: 'gap:.45em' },
        h('div', { class: 'small', style: 'color:#e8c26a;font-weight:900' }, av ? '选择类别' : '选择品级'), rars,
        opts, (av ? P.cats.includes('sky') : P.rar.some(r => r >= 3)) ? h('div', { class: 'warn' }, av ? '已勾选天空套，执行前会再确认一次' : '已勾选神器及以上品级，执行前会再确认一次') : null,
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
      if (IW.invTab === 'avatar') bar.append(b('一键出售', 'avsell')); else if (IW.invTab === 'title') bar.append(b('一键出售', 'tsell')); else bar.append(b('一键出售', 'sell'), b('一键分解', 'dis')); };
    add(); const r0 = el._render; el._render = () => { r0(); add(); };
    return el;
  };
}
ITEM_WINS.push('bulk');
