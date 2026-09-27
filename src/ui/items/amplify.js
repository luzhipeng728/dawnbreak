/* =====================================================================
   增幅窗口（凯丽）与锻造窗口（林纳斯）：布局沿用强化窗口（左边装备格子，右边操作面板）
   规则在 game/gear.js
   ===================================================================== */
addStyle(`
.ampwin .enhlv .to{color:#ff5a8a}.ampwin .enhlv{text-shadow:0 0 .4em rgba(255,90,138,.6)}
.ampwin .dimline{font-size:.95em;font-weight:900;color:#ff5a8a}
.ampwin .dimline .old{color:#8a6a78;font-weight:600;text-decoration:line-through;margin-right:.3em}
.ampwin .enhslot.busy::after{border-color:#ff5a8a}
.ampwin .enhbar i{background:linear-gradient(90deg,#ff4a7a,#ffd0e0,#ff4a7a);background-size:200% 100%}
.ampwin .purify{display:flex;flex-direction:column;align-items:center;gap:.35em;text-align:center;font-size:.86em;color:#d8c8e8}
.ampwin .dimpick{display:flex;gap:.3em}
.ampwin .dimpick span{padding:.1em .45em;border-radius:.3em;border:.08em solid #5a3a4a;color:#c8a0b0;font-size:.85em}
.ampwin .dimpick span.on{border-color:#ff5a8a;color:#ff8ab0;background:rgba(255,90,138,.12)}
.forgewin .enhlv .to{color:#ffb070}.forgewin .enhlv{text-shadow:0 0 .4em rgba(255,176,112,.6)}
.forgewin .enhslot.busy::after{border-color:#ffb070}
.forgewin .enhbar i{background:linear-gradient(90deg,#ff8a3a,#ffe0b0,#ff8a3a);background-size:200% 100%}
.smithopt{font-size:.82em;cursor:pointer;display:flex;align-items:center;gap:.3em}
`);
// 左侧装备列表（装备中 / 背包）；返回 [左侧 DOM, 选中的装备]
function smithList(el, st, filter, onPick) {
  const worn = SLOTS.map(s => inv.equip[s]).filter(it => it && filter(it)), bag = inv.items.filter(filter);
  const src = IW[st + 'Src'] || 'worn', list = src === 'worn' ? worn : bag;
  let sel = IW[st + 'Sel'] && (worn.includes(IW[st + 'Sel']) || bag.includes(IW[st + 'Sel'])) ? IW[st + 'Sel'] : null;
  if (!sel && !IW[st + 'Msg']) sel = IW[st + 'Sel'] = list[0] || worn[0] || bag[0] || null;
  const tabs = h('div', { class: 'itabs' }, [['worn', `装备中 ${worn.length}`], ['bag', `背包 ${bag.length}`]].map(([id, nm]) => h('div', { class: 'itab' + (src === id ? ' on' : ''), onclick: () => { IW[st + 'Src'] = id; sfx.click(); el._render(); } }, nm)));
  const grid = h('div', { class: 'igrid', 'data-sk': st });
  for (let i = 0; i < Math.max(20, Math.ceil(list.length / 5) * 5); i++) { const it = list[i]; grid.append(itemSlot(it, { sel: it && it === sel, cmp: false, onClick: () => { if (!it || IW[st + 'Busy']) return; IW[st + 'Sel'] = it; IW[st + 'Msg'] = null; sfx.click(); onPick && onPick(it); el._render(); } })); }
  return [h('div', { class: 'enhleft col', style: 'gap:0' }, tabs, grid), sel];
}
const costRow = (label, need, have, fmt = v => v) => [h('span', {}, label), h('b', { class: have < need ? 'no' : '' }, `${fmt(need)}（持有 ${fmt(have)}）`)];
/* ---------------- 增幅 ---------------- */
function ampRiskText(it) {
  if ((it.enh || 0) >= AMP_MAX) return ['已经增幅到最高等级', ''];
  const f = ampFailResult(it), to = (it.enh || 0) + 1;
  if (to <= 4) return ['+1 ~ +4 必定成功', ''];
  if (f.broken) return ['⚠ 失败时装备会破碎！（保护券：只降 1 级）', 'bad'];
  if (f.lvl === 0) return [`⚠ 失败时增幅等级归零！（保护券：只降 1 级）`, 'bad'];
  return [`失败时增幅等级降为 +${f.lvl}`, ''];
}
Object.assign(menus, {
  w_amplify(npc) {
    inv.ensure();
    const el = itemWin('amplify', `${npc && npc.name ? npc.name + ' · ' : ''}装备增幅`, el => {
      const [left, sel] = smithList(el, 'amp', canAmplify);
      const right = h('div', { class: 'enhright' }), M = IW.ampMsg;
      if (!sel && !M) right.append(h('div', { class: 'dim', style: 'margin:auto' }, '没有可以增幅的装备'));
      else {
        const it = sel || M.item;
        right.append(h('div', { class: 'enhslot' + (IW.ampBusy ? ' busy' : '') + (M && !IW.ampBusy ? ' ' + M.cls : '') }, itemSlot(it, { cmp: false, drop: { accept: p => p.type === 'item' && (p.from === 'inv' || p.from === 'equip') && canAmplify(p.item), drop: p => { IW.ampSel = p.item; IW.ampMsg = null; el._render(); } } })),
          h('div', { class: `q${it.rar}`, style: 'font-weight:900;text-align:center' }, it.name));
        if (sel && !sel.dim) {
          // 还没有红字：先净化异界气息
          const ok = hasOtherworld(sel), c = ampConvertCost(sel), book = inv.count('amp_purify');
          right.append(h('div', { class: 'purify' },
            ok ? h('div', {}, '这件装备带有 ', h('b', { style: 'color:#c080ff' }, '异界气息'), '。用异界气息净化书净化后，会随机获得一种异次元属性（红字），之后才能增幅。') : h('div', { class: 'down' }, '这件装备没有异界气息（需要 Lv15 以上、稀有品级以上的装备）。'),
            h('div', { class: 'dimpick' }, DIM_STATS.map(k => h('span', {}, DIM_NAME[k]))),
            sel.enh ? h('div', { style: 'color:#ffb070' }, `当前强化 +${sel.enh}：净化后原样变成增幅 +${sel.enh}，之后只能增幅、不能再强化。`) : null,
            ok ? h('div', { class: 'enhcost' }, ...costRow('异界气息净化书', 1, book), ...costRow('金币', c.gold, game.gold, fmtNum)) : null,
            ok ? h('button', { class: 'btn big' + (IW.ampBusy ? ' off' : ''), onclick: () => ampPurifyGo(el, sel) }, '净化') : null));
        } else if (sel) {
          const c = ampCost(sel), lv = sel.enh || 0, max = lv >= AMP_MAX, [risk, rc] = ampRiskText(sel);
          const bookN = inv.count('amp_book'), guardN = inv.count('amp_guard'), f = max ? null : ampFailResult(sel), risky = f && (f.broken || f.lvl < lv - 1);
          const rate = max ? 0 : Math.min(1, AMP_RATE[lv] + (IW.ampBook && bookN ? 0.15 : 0));
          const v0 = ampStatVal(sel), v1 = max ? v0 : ampStatVal(sel, lv + 1);
          right.append(...[
            h('div', { class: 'enhlv' }, `+${lv}`, max ? null : h('span', { class: 'to' }, ` → +${lv + 1}`)),
            h('div', { class: 'dimline' }, `${DIM_NAME[sel.dim]} +${v0}`, max ? null : h('span', { style: 'color:#ffd0e0' }, ` → +${v1}`)),
            max ? null : h('div', { class: 'enhrate' }, '成功率 ', h('b', {}, `${(rate * 100).toFixed(0)}%`)),
            h('div', { class: 'enhrisk ' + rc }, risk),
            max ? null : h('div', { class: 'enhcost' }, ...costRow('矛盾的结晶体', c.contra, inv.count('m_contra')), ...costRow('金币', c.gold, game.gold, fmtNum)),
            max ? null : h('label', { class: 'smithopt' }, itemCheckBox(!!(IW.ampBook && bookN), v => { IW.ampBook = v; el._render(); }, !bookN), `使用黄金增幅书：成功率 +15%（持有 ${bookN}）`),
            risky ? h('label', { class: 'smithopt' }, itemCheckBox(!!(IW.ampGuard && guardN), v => { IW.ampGuard = v; }, !guardN), `使用增幅保护券：失败只降 1 级（持有 ${guardN}）`) : null,
            h('div', { class: 'enhbar' + (IW.ampBusy ? ' run' : '') }, h('i')),
            h('div', { class: 'row', style: 'gap:.5em' }, h('button', { class: 'btn big' + (IW.ampBusy || max ? ' off' : ''), onclick: () => ampGo(el, sel) }, IW.ampBusy ? '增幅中……' : '增幅'),
              h('button', { class: 'btn sm blue', title: '用异界气息净化书换一种红字（增幅等级不变）', onclick: () => ampPurifyGo(el, sel, true) }, '重新净化'))].filter(Boolean));
        }
        right.append(h('div', { class: 'enhmsg ' + (M ? M.cls : '') }, M ? M.text : ''));
      }
      return [npc && npc.lines ? h('div', { style: 'color:#c8b890;font-size:.85em;font-style:italic' }, `“${pick(npc.lines)}”`) : null, h('div', { class: 'enhwrap' }, left, right),
        h('div', { class: 'ihint' }, '增幅 = 强化效果 + 红字（异次元属性），和强化互斥。+1~+4 必定成功；冲 +5~+7 失败掉 1 级，冲 +8~+10 失败归零，冲 +11 以上失败破碎。增幅到 +10 以上会发全服公告。材料：矛盾的结晶体（深渊派对、领主掉落，也可以在凯丽的商店买）。')];
    }, { w: 40, at: 'left' });
    el.classList.add('ampwin'); el._arg = npc;
    return el;
  },
});
function ampPurifyGo(el, it, reroll) {
  const go = () => { const r = ampConvert(it); if (r.err) { toastMsg(r.err, '#ff6a6a'); sfx.error(); IW.ampMsg = { text: r.err, cls: 'fail', item: it }; } else { sfx.buff(); IW.ampMsg = { text: `获得了 ${DIM_NAME[r.dim]}！`, cls: 'ok', item: it }; } itemsRefresh(); };
  if (reroll) itemDialog(el, { title: '重新净化', msg: `用 1 本异界气息净化书，把 ${itemNameHtml(it)} 的 <b style="color:#ff5a8a">${DIM_NAME[it.dim]}</b> 换成另外三种之一（随机，增幅等级不变）。确定吗？`, okText: '净化', onOk: go });
  else if (it.enh) itemDialog(el, { title: '净化异界气息', msg: `${itemNameHtml(it)} 当前强化 +${it.enh}。净化后会变成增幅 +${it.enh}，<b style="color:#ff5a8a">之后不能再强化</b>。确定吗？`, okText: '净化', onOk: go });
  else go();
}
function ampGo(el, it) {
  if (IW.ampBusy || !it) return;
  const c = ampCost(it);
  if (game.gold < c.gold) { toastMsg('金币不足', '#ff6a6a'); sfx.error(); return; }
  if (inv.count('m_contra') < c.contra) { toastMsg('矛盾的结晶体不足（深渊派对、领主掉落，凯丽的商店也有卖）', '#ff6a6a'); sfx.error(); return; }
  const f = ampFailResult(it), guard = !!IW.ampGuard && inv.count('amp_guard') > 0;
  const run = () => {
    IW.ampBusy = true; IW.ampMsg = null; el._render(); sfx.charge();
    setTimeout(() => {
      IW.ampBusy = false; if (!el.isConnected) return;
      const res = tryAmplify(it, { guard, book: !!IW.ampBook });
      if (res.err) { IW.ampMsg = { text: res.err, cls: 'fail', item: it }; sfx.error(); }
      else if (res.ok) { IW.ampMsg = { text: `增幅成功！+${res.lvl}`, cls: 'ok', item: it }; sfx.enhanceOk(); if (res.lvl >= 10) sfx.epic(); }
      else if (res.broken) { IW.ampMsg = { text: `装备破碎了……（返还矛盾的结晶体 ×${res.refund}）`, cls: 'broke', item: it }; IW.ampSel = null; sfx.enhanceFail(); }
      else { IW.ampMsg = { text: res.guard ? `失败！保护券生效，+${res.from} → +${res.lvl}` : res.reset ? `增幅失败，等级归零……` : `增幅失败 +${res.from} → +${res.lvl}`, cls: 'fail', item: it }; sfx.enhanceFail(); }
      itemsRefresh();
    }, 1150);
  };
  if ((f.broken || f.lvl < (it.enh || 0) - 1) && !guard) itemDialog(el, { title: '增幅有风险', msg: `${itemNameHtml(it)} 当前 +${it.enh}，增幅失败时<b style="color:#ff6a5a">${f.broken ? '装备会破碎' : '增幅等级归零'}</b>。<br>成功率 ${Math.round(Math.min(1, AMP_RATE[it.enh] + (IW.ampBook && inv.count('amp_book') ? 0.15 : 0)) * 100)}%，确定要增幅吗？`, okText: '增幅', danger: true, onOk: run });
  else run();
}
/* ---------------- 锻造 ---------------- */
Object.assign(menus, {
  w_forge(npc) {
    inv.ensure();
    const el = itemWin('forge', `${npc && npc.name ? npc.name + ' · ' : ''}武器锻造`, el => {
      const [left, sel] = smithList(el, 'forge', canForge);
      const right = h('div', { class: 'enhright' }), M = IW.forgeMsg;
      if (!sel && !M) right.append(h('div', { class: 'dim', style: 'margin:auto' }, '没有可以锻造的武器'));
      else {
        const it = sel || M.item;
        right.append(h('div', { class: 'enhslot' + (IW.forgeBusy ? ' busy' : '') + (M && !IW.forgeBusy ? ' ' + M.cls : '') }, itemSlot(it, { cmp: false })), h('div', { class: `q${it.rar}`, style: 'font-weight:900;text-align:center' }, it.name));
        if (sel) {
          const lv = sel.forge || 0, max = lv >= FORGE_MAX, c = forgeCost(sel), cur = forgeStats(sel), nx = forgeStats(sel, Math.min(FORGE_MAX, lv + 1));
          right.append(...[
            h('div', { class: 'enhlv' }, `锻造 +${lv}`, max ? null : h('span', { class: 'to' }, ` → +${lv + 1}`)),
            max ? null : h('div', { class: 'enhrate' }, '成功率 ', h('b', {}, `${(FORGE_RATE[lv] * 100).toFixed(1).replace(/\.0$/, '')}%`)),
            h('div', { class: 'enhrisk' }, max ? '已经锻造到最高等级' : '失败不会降级，只消耗材料'),
            h('div', { class: 'small', style: 'color:#ffb070;text-align:center' }, (max ? '当前：' : '成功后：') + Object.keys(nx).map(k => `${(STAT_INFO[k] || [k])[0]} +${fmtNum(nx[k])}${cur[k] && !max ? `（+${fmtNum(nx[k] - cur[k])}）` : ''}`).join('，')),
            max ? null : h('div', { class: 'enhcost' }, ...costRow('强烈的气息', c.aura, inv.count('m_aura')), ...costRow('无色小晶块', c.crystal, inv.count('crystal')), ...costRow('金币', c.gold, game.gold, fmtNum)),
            h('div', { class: 'enhbar' + (IW.forgeBusy ? ' run' : '') }, h('i')),
            h('button', { class: 'btn big' + (IW.forgeBusy || max ? ' off' : ''), onclick: () => forgeGo(el, sel) }, IW.forgeBusy ? '锻造中……' : '锻造')].filter(Boolean));
        }
        right.append(h('div', { class: 'enhmsg ' + (M ? M.cls : '') }, M ? M.text : ''));
      }
      return [npc && npc.lines ? h('div', { style: 'color:#c8b890;font-size:.85em;font-style:italic' }, `“${pick(npc.lines)}”`) : null, h('div', { class: 'enhwrap' }, left, right),
        h('div', { class: 'ihint' }, '锻造只对武器有效：提升独立攻击力（本作同时提升一半比例的物理 / 魔法攻击）。失败不降级；锻造到 +6 以上会发全服公告。材料：强烈的气息（Lv10 以上地下城的领主、精英，深渊派对）。')];
    }, { w: 40, at: 'left' });
    el.classList.add('forgewin'); el._arg = npc;
    return el;
  },
});
function forgeGo(el, it) {
  if (IW.forgeBusy || !it) return;
  const c = forgeCost(it);
  if (game.gold < c.gold || inv.count('m_aura') < c.aura || inv.count('crystal') < c.crystal) { toastMsg(game.gold < c.gold ? '金币不足' : inv.count('m_aura') < c.aura ? '强烈的气息不足（领主、精英和深渊派对会掉落）' : '无色小晶块不足', '#ff6a6a'); sfx.error(); return; }
  IW.forgeBusy = true; IW.forgeMsg = null; el._render(); sfx.charge();
  setTimeout(() => {
    IW.forgeBusy = false; if (!el.isConnected) return;
    const res = tryForge(it);
    if (res.err) { IW.forgeMsg = { text: res.err, cls: 'fail', item: it }; sfx.error(); }
    else if (res.ok) { IW.forgeMsg = { text: `锻造成功！+${res.lvl}`, cls: 'ok', item: it }; sfx.enhanceOk(); if (res.lvl >= 6) sfx.epic(); }
    else { IW.forgeMsg = { text: `锻造失败（等级不变）`, cls: 'fail', item: it }; sfx.enhanceFail(); }
    itemsRefresh();
  }, 900);
}
Object.assign(NPC_SERVICES, {
  amplify: { label: '增幅', run: N => menus.open('amplify', N) },
  forge: { label: '锻造', run: N => menus.open('forge', N) },
});
for (const n of ['amplify', 'forge']) menus.BLOCK.add(n);
