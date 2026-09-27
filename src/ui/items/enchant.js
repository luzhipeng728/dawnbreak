/* =====================================================================
   附魔窗口（宝珠 / 怪物卡片）：左边选宝珠，右边选要附魔的装备（身上 + 背包，只列能附魔的部位），对比新旧属性后附魔
   打开方式：罗莉安的「附魔」、背包里右键宝珠 / 卡片、物品操作栏的「附魔」按钮
   ===================================================================== */
addStyle(`
.enchwrap{display:flex;gap:.7em;align-items:stretch}
.enchcol{display:flex;flex-direction:column;gap:.3em}
.enchcol .igrid{grid-template-columns:repeat(5,3.1em);max-height:13.5em;overflow:auto}
.enchright{flex:1;min-width:17em;display:flex;flex-direction:column;gap:.35em;padding:.5em;background:radial-gradient(ellipse at 50% 20%,#1c2a36,#0c0a10 70%);border:.1em solid #3a5060;border-radius:.3em}
.enchright .ttl{font-weight:900;color:#9ae8ff}
.enchcmp{display:grid;grid-template-columns:1fr auto 1fr;gap:.4em;align-items:center;font-size:.84em}
.enchcmp .box{background:#0c0a10;border:.08em solid #2e3a48;border-radius:.25em;padding:.35em .5em;min-height:3.4em}
.enchcmp .box b{display:block;color:#9ae8ff;font-size:.95em;margin-bottom:.15em}
.enchcmp .arrow{color:#9ae8ff;font-size:1.4em;font-weight:900}
.enchlbl{font-size:.78em;color:#8aa8b8;font-weight:800}
`);
const orbItemsInBag = () => inv.items.filter(it => it.kind !== 'equip' && ITEMS[it.key] && ITEMS[it.key].orb);
Object.assign(menus, {
  w_enchant(arg = {}) {
    inv.ensure();
    if (arg.card) IW.enchOrb = arg.card.key;
    const npc = arg && arg.name ? arg : arg.npc;
    const el = itemWin('enchant', `${npc && npc.name ? npc.name + ' · ' : ''}附魔`, el => {
      const orbs = orbItemsInBag();
      if (!orbs.some(x => x.key === IW.enchOrb)) IW.enchOrb = orbs[0] ? orbs[0].key : null;
      const orbKey = IW.enchOrb, O = orbKey && ITEMS[orbKey];
      const og = h('div', { class: 'igrid', 'data-sk': 'enchorb' });
      for (let i = 0; i < Math.max(15, Math.ceil(orbs.length / 5) * 5); i++) { const it = orbs[i]; og.append(itemSlot(it, { sel: it && it.key === orbKey, onClick: () => { if (!it) return; IW.enchOrb = it.key; IW.enchMsg = null; sfx.click(); el._render(); } })); }
      // 能附魔的装备：身上的在前
      const worn = SLOTS.map(s => inv.equip[s]).filter(it => it && it.slot && orbKey && canEnchant(orbKey, it)), bag = orbKey ? inv.items.filter(it => it.kind === 'equip' && canEnchant(orbKey, it)) : [];
      const targets = [...worn, ...bag];
      if (!targets.includes(IW.enchTgt)) IW.enchTgt = targets[0] || null;
      const tgt = IW.enchTgt;
      const tg = h('div', { class: 'igrid', 'data-sk': 'enchtgt' });
      for (let i = 0; i < Math.max(15, Math.ceil(targets.length / 5) * 5); i++) { const it = targets[i]; tg.append(itemSlot(it, { sel: it && it === tgt, cmp: false, label: '', onClick: () => { if (!it) return; IW.enchTgt = it; IW.enchMsg = null; sfx.click(); el._render(); } })); }
      const stTxt = st => Object.keys(st || {}).map(k => statLine(k, st[k])).join('，') || '—';
      const right = h('div', { class: 'enchright' });
      if (!O) right.append(h('div', { class: 'dim', style: 'margin:auto;text-align:center' }, '背包里没有宝珠或怪物卡片。', h('br'), h('span', { class: 'small' }, '怪物卡片由各地下城的怪物、领主掉落；宝珠可以在商城获得。')));
      else {
        right.append(h('div', { class: 'ttl' }, O.name), h('div', { class: 'small', style: 'color:#b8d8e8' }, `可附魔：${orbOnText(O.orb.on)}`), h('div', { class: 'small', style: 'color:#9ae8ff' }, stTxt(O.orb.st)));
        if (!tgt) right.append(h('div', { class: 'dim small', style: 'margin-top:1em' }, '身上和背包里没有能附魔这颗宝珠的装备。'));
        else {
          right.append(h('div', { class: 'enchlbl' }, `目标：`, h('span', { class: `q${tgt.rar || 0}` }, (tgt.enh ? '+' + tgt.enh + ' ' : '') + tgt.name), inv.equip[tgt.slot] === tgt ? '（装备中）' : '（背包）'),
            h('div', { class: 'enchcmp' },
              h('div', { class: 'box' }, h('b', {}, tgt.orb ? orbName(tgt) : '当前：未附魔'), tgt.orb ? stTxt(orbStats(tgt)) : null),
              h('div', { class: 'arrow' }, '▶'),
              h('div', { class: 'box' }, h('b', {}, O.name), stTxt(O.orb.st))),
            tgt.orb ? h('div', { class: 'small', style: 'color:#ffb070' }, '⚠ 附魔会覆盖原来的宝珠，原来的宝珠会消失。') : null,
            h('button', { class: 'btn big', onclick: () => enchGo(el, tgt, orbs.find(x => x.key === orbKey)) }, '附魔'));
        }
      }
      const M = IW.enchMsg;
      right.append(h('div', { class: 'enhmsg ' + (M ? M.cls : '') }, M ? M.text : ''));
      return [h('div', { class: 'enchwrap' },
        h('div', { class: 'enchcol' }, h('div', { class: 'enchlbl' }, `宝珠 / 卡片（${orbs.reduce((s, x) => s + (x.n || 1), 0)}）`), og),
        h('div', { class: 'enchcol' }, h('div', { class: 'enchlbl' }, `可附魔的装备（${targets.length}）`), tg),
        right),
        h('div', { class: 'ihint' }, '每件装备（含称号、时装、宠物）有 1 个附魔槽，附魔必定成功；再附魔会覆盖旧的。怪物卡片由各地下城的怪物掉落（领主掉率最高，深渊派对里翻倍）。')];
    }, { w: 44, at: 'left' });
    el._arg = arg;
    return el;
  },
});
function enchGo(el, tgt, orbIt) {
  if (!tgt || !orbIt) return;
  const go = () => {
    const r = enchantItem(tgt, orbIt);
    if (r.err) { IW.enchMsg = { text: r.err, cls: 'fail' }; sfx.error(); }
    else { IW.enchMsg = { text: `附魔成功：${tgt.name} ← ${ITEMS[orbIt.key].name}`, cls: 'ok' }; sfx.enhanceOk(); }
    itemsRefresh();
  };
  if (tgt.orb) itemDialog(el, { title: '覆盖附魔', msg: `${itemNameHtml(tgt)} 已经附魔了 <b style="color:#9ae8ff">${orbName(tgt)}</b>。<br>用 <b style="color:#9ae8ff">${ITEMS[orbIt.key].name}</b> 覆盖后，原来的宝珠会消失。确定吗？`, okText: '覆盖', danger: true, onOk: go });
  else go();
}
Object.assign(NPC_SERVICES, { enchant: { label: '附魔', run: N => menus.open('enchant', { npc: N }) } });
menus.BLOCK.add('enchant');
