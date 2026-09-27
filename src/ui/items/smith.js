/* =====================================================================
   铁匠类窗口：强化（凯丽 / 林纳斯）、分解（诺顿 / 林纳斯）、修理（林纳斯 / 卡坤）
   ===================================================================== */
addStyle(`
.enhwrap{display:flex;gap:.8em;align-items:stretch}
.enhleft{width:17.6em}
.enhleft .igrid{grid-template-columns:repeat(5,3.1em);max-height:16.5em;overflow:auto}
.enhright{flex:1;min-width:17em;display:flex;flex-direction:column;align-items:center;gap:.35em;padding:.6em;background:radial-gradient(ellipse at 50% 30%,#2a2436,#0c0a10 70%);border:.1em solid #4a3c2c;border-radius:.3em;position:relative;overflow:hidden}
.enhslot{position:relative;width:4.6em;height:4.6em}
.enhslot .islot{width:4.6em;height:4.6em}
.enhslot.busy::after{content:'';position:absolute;inset:-.6em;border-radius:50%;border:.2em dashed #8fe8ff;animation:enhspin 1s linear infinite;pointer-events:none}
@keyframes enhspin{to{transform:rotate(360deg)}}
.enhslot.ok::before{content:'';position:absolute;inset:-2.5em;background:radial-gradient(circle,rgba(255,240,150,.9),rgba(255,200,60,.35) 40%,transparent 70%);animation:enhburst .9s ease-out forwards;pointer-events:none;z-index:2}
@keyframes enhburst{from{transform:scale(.3);opacity:1}to{transform:scale(1.6);opacity:0}}
.enhslot.fail{animation:enhshake .45s ease-in-out}
@keyframes enhshake{20%{transform:translateX(-.3em)}40%{transform:translateX(.3em)}60%{transform:translateX(-.2em)}80%{transform:translateX(.2em)}}
.enhslot.broke .islot{animation:enhbreak 1s ease-in forwards}
@keyframes enhbreak{0%{filter:none}30%{filter:brightness(2) sepia(1) hue-rotate(-40deg)}100%{filter:grayscale(1) brightness(.3);transform:scale(.85) rotate(-6deg);opacity:.4}}
.enhlv{font-size:1.6em;font-weight:900;color:#fff2d0;text-shadow:0 0 .4em rgba(143,232,255,.6)}
.enhlv .to{color:#8fe8ff}
.enhrate{font-size:1.05em}.enhrate b{color:#ffe070;font-size:1.25em}
.enhrisk{font-size:.8em;color:#c8b890;text-align:center}.enhrisk.bad{color:#ff6a5a;font-weight:800}
.enhcost{font-size:.82em;display:grid;grid-template-columns:auto auto;gap:.1em .8em;background:#0c0a10;padding:.35em .7em;border-radius:.25em;border:.08em solid #3a3040}
.enhcost .no{color:#ff6a6a}
.enhbar{width:100%;height:.6em;background:#1a1420;border-radius:.3em;overflow:hidden;border:.08em solid #3a3040}
.enhbar i{display:block;height:100%;width:0;background:linear-gradient(90deg,#4ab0ff,#bff4ff,#4ab0ff);background-size:200% 100%}
.enhbar.run i{animation:enhfill 1.1s linear forwards,enhshine .4s linear infinite}
@keyframes enhfill{to{width:100%}}@keyframes enhshine{to{background-position:-200% 0}}
.enhmsg{min-height:1.5em;font-size:1.2em;font-weight:900;text-align:center}
.enhmsg.ok{color:#8aff8a;animation:enhpop .5s ease-out}.enhmsg.fail{color:#ff8a7a;animation:enhpop .5s ease-out}.enhmsg.broke{color:#ff4a4a;animation:enhpop .5s ease-out}
@keyframes enhpop{from{transform:scale(1.8);opacity:0}to{transform:scale(1);opacity:1}}
.dispreview{display:flex;flex-wrap:wrap;gap:.3em .8em;font-size:.82em;min-height:1.4em;padding:.35em .6em;background:#0c0a10;border:.08em solid #3a3040;border-radius:.25em}
.dispreview span{display:flex;align-items:center;gap:.25em}
.dispreview img{width:1.5em;height:1.5em}
.reprow{display:grid;grid-template-columns:2.6em 1fr 6em 5.2em 4em;gap:.5em;align-items:center;padding:.2em .45em;background:#15111a;border:.08em solid #2e2838;border-radius:.25em}
.reprow .islot{width:2.6em;height:2.6em}
.reprow .db{height:.5em;background:#2a2228;border-radius:.25em;overflow:hidden}.reprow .db i{display:block;height:100%;background:#6ad06a}.reprow .db.low i{background:#ff5a3a}
`);
/* ---------------- 强化 ---------------- */
function enhRiskText(it) {
  if (it.enh >= ENH_MAX) return ['已经强化到最高等级', ''];
  const f = enhFailResult(it);
  if (it.enh < 3) return ['失败不会降级', ''];
  if (f.broken) return ['⚠ 失败时装备会破碎！', 'bad'];
  return [`失败时强化等级降为 +${f.lvl}`, it.enh >= 9 ? 'bad' : ''];
}
Object.assign(menus, {
  w_enhance(npc) {
    inv.ensure();
    const el = itemWin('enhance', `${npc && npc.name ? npc.name + ' · ' : ''}装备强化`, el => {
      const worn = SLOTS.map(s => inv.equip[s]).filter(canEnhance), bag = inv.items.filter(canEnhance);
      const src = IW.enhSrc || 'worn', list = src === 'worn' ? worn : bag;
      let sel = IW.enhSel && (worn.includes(IW.enhSel) || bag.includes(IW.enhSel)) ? IW.enhSel : null;
      if (!sel && !IW.enhMsg) sel = IW.enhSel = list[0] || worn[0] || bag[0] || null;
      const tabs = h('div', { class: 'itabs' }, [['worn', `装备中 ${worn.length}`], ['bag', `背包 ${bag.length}`]].map(([id, nm]) => h('div', { class: 'itab' + (src === id ? ' on' : ''), onclick: () => { IW.enhSrc = id; sfx.click(); el._render(); } }, nm)));
      const grid = h('div', { class: 'igrid', 'data-sk': 'enh' });
      for (let i = 0; i < Math.max(20, Math.ceil(list.length / 5) * 5); i++) { const it = list[i]; grid.append(itemSlot(it, { sel: it && it === sel, cmp: false, onClick: () => { if (!it || IW.enhBusy) return; IW.enhSel = it; IW.enhMsg = null; sfx.click(); el._render(); } })); }
      const left = h('div', { class: 'enhleft col', style: 'gap:0' }, tabs, grid);
      const right = h('div', { class: 'enhright' });
      const M = IW.enhMsg;
      if (!sel && !M) right.append(h('div', { class: 'dim', style: 'margin:auto' }, '没有可以强化的装备'));
      else {
        const it = sel || (M && M.item);
        const slot = h('div', { class: 'enhslot' + (IW.enhBusy ? ' busy' : '') + (M && !IW.enhBusy ? ' ' + M.cls : '') }, itemSlot(it, { cmp: false, drop: { accept: p => p.type === 'item' && (p.from === 'inv' || p.from === 'equip') && canEnhance(p.item), drop: p => { IW.enhSel = p.item; IW.enhMsg = null; el._render(); } } }));
        right.append(slot, h('div', { class: `q${it.rar}`, style: 'font-weight:900;text-align:center' }, it.name));
        if (sel) {
          const c = enhCost(sel), rate = sel.enh < ENH_MAX ? ENH_RATE[sel.enh] : 0, [risk, rc] = enhRiskText(sel), f = enhFailResult(sel);
          const hasG = inv.count('crystal'), guardN = inv.count('guard');
          right.append(...[
            h('div', { class: 'enhlv' }, `+${sel.enh}`, sel.enh < ENH_MAX ? h('span', { class: 'to' }, ` → +${sel.enh + 1}`) : null),
            h('div', { class: 'enhrate' }, '成功率 ', h('b', {}, `${(rate * 100).toFixed(1)}%`)),
            h('div', { class: 'enhrisk ' + rc }, risk),
            h('div', { class: 'enhcost' }, h('span', {}, '金币'), h('b', { class: game.gold < c.gold ? 'no' : 'gold' }, `${fmtNum(c.gold)} G（持有 ${fmtNum(game.gold)}）`), h('span', {}, '无色小晶块'), h('b', { class: hasG < c.crystal ? 'no' : '' }, `${c.crystal} 个（持有 ${hasG}）`)),
            f.broken && sel.enh < ENH_MAX ? h('label', { class: 'small', style: 'cursor:pointer' }, itemCheckBox(!!(IW.enhGuard && guardN), v => { IW.enhGuard = v; }, !guardN), ` 使用强化保护券（持有 ${guardN}）：失败时不破碎，但强化等级归零`) : null,
            (() => { const s = enhStats({ ...sel, enh: Math.min(ENH_MAX, sel.enh + 1) }), cur = enhStats(sel); return h('div', { class: 'small', style: 'color:#8fe8ff' }, '成功后：', Object.keys(s).map(k => `${(STAT_INFO[k] || [k])[0]} ${fmtStatVal(k, s[k])}${cur[k] ? `（+${fmtNum(s[k] - cur[k])}）` : ''}`).join('，') || '-'); })(),
            h('div', { class: 'enhbar' + (IW.enhBusy ? ' run' : '') }, h('i')),
            h('button', { class: 'btn big' + (IW.enhBusy || sel.enh >= ENH_MAX ? ' off' : ''), onclick: () => enhGo(el, sel) }, IW.enhBusy ? '强化中……' : '强化')].filter(Boolean));
        }
        right.append(h('div', { class: 'enhmsg ' + (M ? M.cls : '') }, M ? M.text : ''));
      }
      return [npc && npc.lines ? h('div', { class: 'greet', style: 'color:#c8b890;font-size:.85em;font-style:italic' }, `“${pick(npc.lines)}”`) : null, h('div', { class: 'enhwrap' }, left, right),
        h('div', { class: 'ihint' }, '+1~+3 必定成功；+4 起失败会降级；武器 +12、防具 / 首饰 +10 以上失败会破碎。强化 +10 以上成功会发公告。')];
    }, { w: 40, at: 'left' });
    el._arg = npc;
    return el;
  },
});
function enhGo(el, it) {
  if (IW.enhBusy || !it) return;
  const c = enhCost(it);
  if (game.gold < c.gold) { toastMsg('金币不足', '#ff6a6a'); sfx.error(); return; }
  if (inv.count('crystal') < c.crystal) { toastMsg('无色小晶块不足（可以在林纳斯 / 诺顿处购买，或分解装备获得）', '#ff6a6a'); sfx.error(); return; }
  const f = enhFailResult(it);
  const run = () => {
    IW.enhBusy = true; IW.enhMsg = null; el._render(); sfx.charge();
    setTimeout(() => {
      IW.enhBusy = false;
      if (!el.isConnected) return;
      const res = tryEnhance(it, !!IW.enhGuard && f.broken);
      if (res.err) { IW.enhMsg = { text: res.err, cls: 'fail', item: it }; sfx.error(); }
      else if (res.ok) { IW.enhMsg = { text: `强化成功！+${res.lvl}`, cls: 'ok', item: it }; sfx.enhanceOk(); if (res.lvl >= 10) sfx.epic(); }
      else if (res.broken) { IW.enhMsg = { text: `装备破碎了……（返还无色小晶块 ×${res.refund}）`, cls: 'broke', item: it }; IW.enhSel = null; sfx.enhanceFail(); }
      else { IW.enhMsg = { text: res.guard ? `失败！保护券生效，强化等级归零` : `强化失败 +${res.from} → +${res.lvl}`, cls: 'fail', item: it }; sfx.enhanceFail(); }
      itemsRefresh();
    }, 1150);
  };
  // 有破碎风险又没用保护券：先确认
  if (f.broken && !(IW.enhGuard && inv.count('guard'))) itemDialog(el, { title: '强化有破碎风险', msg: `${itemNameHtml(it)} 当前 +${it.enh}，强化失败时<b style="color:#ff6a5a">装备会破碎</b>。<br>成功率 ${(ENH_RATE[it.enh] * 100).toFixed(1)}%，确定要强化吗？`, okText: '强化', danger: true, onOk: run });
  else run();
}
/* ---------------- 分解 ---------------- */
Object.assign(menus, {
  w_disassemble(npc) {
    inv.ensure();
    const el = itemWin('disassemble', `${npc && npc.name ? npc.name + ' · ' : ''}装备分解`, el => {
      const list = inv.items.filter(canDisassemble), sel = IW.disSel;
      for (const it of [...sel]) if (!list.includes(it)) sel.delete(it);
      const grid = h('div', { class: 'igrid', 'data-sk': 'dis', style: 'max-height:17.5em;overflow:auto' });
      for (let i = 0; i < Math.max(24, Math.ceil(list.length / 8) * 8); i++) { const it = list[i]; grid.append(itemSlot(it, { chk: it && sel.has(it), onClick: () => { if (!it) return; sel.has(it) ? sel.delete(it) : sel.add(it); sfx.click(); el._render(); }, onRight: () => it && disGo(el, [it]) })); }
      const pickBy = f => { for (const it of list) if (f(it)) sel.add(it); sfx.click(); el._render(); };
      const quick = h('div', { class: 'shopcats' },
        h('span', { class: 'cat', onclick: () => pickBy(it => it.rar === 0 && !it.enh) }, '全选普通'),
        h('span', { class: 'cat', onclick: () => pickBy(it => it.rar <= 1 && !it.enh) }, '全选高级及以下'),
        h('span', { class: 'cat', onclick: () => pickBy(it => it.rar <= 2 && !it.enh) }, '全选稀有及以下'),
        h('span', { class: 'cat', onclick: () => { sel.clear(); sfx.click(); el._render(); } }, '清空'));
      const total = {}; let fee = 0;
      for (const it of sel) { const y = disassembleYield(it); for (const k in y) total[k] = (total[k] || 0) + y[k]; fee += disassembleFee(it); }
      const prev = h('div', { class: 'dispreview' }, Object.keys(total).length ? Object.keys(total).map(k => h('span', {}, h('img', { src: itemIconSrc(k, 32) }), h('span', { class: `q${ITEMS[k].rar}` }, ITEMS[k].name), ` ×${total[k]}`)) : h('span', { class: 'dim' }, '勾选装备后这里显示能得到的材料'));
      const foot = h('div', { class: 'shopfoot' }, h('span', {}, `已选 ${sel.size} 件　手续费 `, h('span', { class: 'tot' }, `${fmtNum(fee)} G`)), h('span', { class: 'sp' }), h('span', { class: 'igold' }, `${fmtNum(game.gold)} G`),
        h('button', { class: 'btn sm red' + (sel.size ? '' : ' off'), onclick: () => { sfx.click(); disGo(el, [...sel]); } }, `分解${sel.size ? `（${sel.size}）` : ''}`));
      return [npc && npc.lines ? h('div', { style: 'color:#c8b890;font-size:.85em;font-style:italic' }, `“${pick(npc.lines)}”`) : null, quick, grid, prev, foot,
        h('div', { class: 'ihint' }, '点击勾选（可多选）· 右键直接分解一件 · 身上穿着的装备不会出现在这里。品级越高得到的材料越好，强化过的装备额外返还无色小晶块。')];
    }, { w: 30, at: 'left' });
    dnd.target(el, { accept: p => p.type === 'item' && p.from === 'inv' && canDisassemble(p.item), drop: p => { IW.disSel.add(p.item); el._render(); } });
    return el;
  },
});
function disGo(el, list) {
  list = list.filter(canDisassemble); if (!list.length) return;
  const go = () => { const r = disassemble(list); if (r) { for (const it of list) IW.disSel.delete(it); toastMsg(`分解了 ${r.n} 件装备：${Object.keys(r.mats).map(k => `${ITEMS[k].name}×${r.mats[k]}`).join('、')}`, '#bfe8ff'); } itemsRefresh(); };
  const valuable = list.filter(it => isValuable(it));
  if (!valuable.length) return go();
  itemDialog(el, { title: '确认分解', msg: `下面的装备比较贵重，分解后无法恢复：<br>${valuable.slice(0, 8).map(itemNameHtml).join('<br>')}${valuable.length > 8 ? `<br>……等 ${valuable.length} 件` : ''}`, okText: '分解', danger: true, onOk: go });
}
/* ---------------- 修理 ---------------- */
Object.assign(menus, {
  w_repair(npc) {
    inv.ensure();
    const el = itemWin('repair', `${npc && npc.name ? npc.name + ' · ' : ''}修理`, el => {
      const list = repairList(), worn = list.filter(it => SLOTS.some(s => inv.equip[s] === it));
      const rows = h('div', { class: 'ilist', 'data-sk': 'rep' }, list.map(it => {
        const low = it.dur <= it.durMax * 0.2, c = repairCostOf(it);
        return h('div', { class: 'reprow' }, itemSlot(it, { cmp: false }), h('div', {}, h('div', { class: `q${it.rar}`, style: 'font-weight:800;font-size:.9em' }, it.name), h('div', { class: 'small dim' }, worn.includes(it) ? '装备中' : '背包')),
          h('div', {}, h('div', { class: 'small' + (it.dur <= 0 ? ' down' : '') }, `${it.dur}/${it.durMax}`), h('div', { class: 'db' + (low ? ' low' : '') }, h('i', { style: `width:${it.dur / it.durMax * 100}%` }))),
          h('span', { class: 'gold small' }, `${fmtNum(c)} G`), h('button', { class: 'btn sm', onclick: () => { if (repairAll(false, [it])) itemsRefresh(); } }, '修理'));
      }));
      if (!list.length) rows.append(h('div', { class: 'dim', style: 'padding:1em;text-align:center' }, '装备都很完好，不需要修理'));
      const all = repairCost(list), wc = repairCost(worn);
      return [rows, h('div', { class: 'shopfoot' }, h('span', { class: 'igold' }, `${fmtNum(game.gold)} G`), h('span', { class: 'sp' }),
        h('button', { class: 'btn sm' + (wc ? '' : ' off'), onclick: () => { if (repairAll(true, worn)) itemsRefresh(); } }, `修理身上装备（${fmtNum(wc)} G）`),
        h('button', { class: 'btn sm' + (all ? '' : ' off'), onclick: () => { if (repairAll(true, list)) itemsRefresh(); } }, `全部修理（${fmtNum(all)} G）`)),
        h('div', { class: 'ihint' }, '在地下城里被击中、倒下都会消耗耐久度；耐久度为 0 的装备属性失效。')];
    }, { w: 30 });
    el._arg = npc;
    return el;
  },
});
