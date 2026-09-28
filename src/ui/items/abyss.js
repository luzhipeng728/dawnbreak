/* =====================================================================
   深渊派对窗口（歌兰蒂斯）：深渊派对介绍与入口 / 邀请函 / 宇宙灵魂兑换史诗 / 浓密的异界精髓兑换异界套装
   官方：资格任务、邀请函（破魔石）、宇宙灵魂兑换史诗都在歌兰蒂斯处
   ===================================================================== */
addStyle(`
.abywin .abyhead{display:flex;gap:1em;align-items:center;flex-wrap:wrap;font-size:.9em;padding:.4em .7em;border-radius:.3em;background:linear-gradient(90deg,rgba(90,20,140,.55),rgba(20,8,30,.6));border:.1em solid #7a3aaa}
.abywin .abyhead b{color:#ffd0ff}
.abywin .abyhead img{width:1.6em;height:1.6em;vertical-align:middle;margin-right:.2em}
.abywin .abydg{display:grid;grid-template-columns:1fr;gap:.5em}
.abywin .dgcard{padding:.5em .7em;border-radius:.3em;background:radial-gradient(ellipse at 90% 0%,rgba(150,50,220,.35),rgba(12,8,18,.95) 60%);border:.1em solid #5a2a7a}
.abywin .dgcard.lock{filter:saturate(.3);opacity:.8}
.abywin .dgcard .nm{font-weight:900;font-size:1.15em;color:#f0c8ff}
.abywin .dgcard .sub{font-size:.8em;color:#b8a0c8}
.abywin .dgcard .pool{display:flex;flex-wrap:wrap;gap:.15em;margin-top:.3em}
.abywin .dgcard .pool .islot{width:2.2em;height:2.2em}
.abywin .exgrid{grid-template-columns:repeat(9,3.1em);max-height:15em;overflow:auto}
.abywin .exrow{display:flex;gap:.6em;align-items:center;flex-wrap:wrap;padding:.4em .6em;background:#120e18;border:.08em solid #3a2a4a;border-radius:.25em;font-size:.88em}
.abywin .exrow .sp{flex:1}
.abywin .price{color:#8ae0ff;font-weight:900}
`);
const ABYSS_TICKET_DAY = 5;
const abyssTicketPrice = () => 3000 + game.lvl * 150;
const abyssEpicCost = key => { const D = ITEMS[key]; return D.set ? 36 : D.lvl >= 28 ? 40 : 28; };
// 史诗兑换列表：等级 ≤ 当前等级 + 3，武器只列本职业（含深渊专属）
const abyssExchangeKeys = () => { const cls = game.player.cls; return EPICS.filter(E => { const D = ITEMS[E.key]; return D && !D.noDrop && E.lvl <= game.lvl + 3 && (!E.cls || E.cls === cls); }).sort((a, b) => b.lvl - a.lvl || SLOTS.indexOf(a.slot) - SLOTS.indexOf(b.slot)).map(E => E.key); };
function abyssDay() { const S = abyssData(), d = dayKey(); if (S.day !== d) { S.day = d; S.bought = 0; } return S; }
Object.assign(menus, {
  w_abyss(npc) {
    inv.ensure();
    const el = itemWin('abyss', `${npc && npc.name ? npc.name + ' · ' : ''}深渊派对`, el => {
      const S = abyssDay(), tab = IW.abyTab || 'info', tk = inv.count('abyss_ticket'), soul = inv.count('m_cosmos'), ess = inv.count('m_otherworld');
      const ic = k => h('img', { src: itemIconSrc(k, 32) });
      const head = h('div', { class: 'abyhead' }, h('span', {}, ic('abyss_ticket'), '邀请函 ', h('b', {}, tk)), h('span', {}, ic('m_cosmos'), '宇宙灵魂 ', h('b', {}, soul)), h('span', {}, ic('m_otherworld'), '异界精髓 ', h('b', {}, ess)),
        h('span', { class: 'small', style: 'margin-left:auto;color:#c8a8d8' }, `深渊派对 ${S.runs || 0} 次 · 史诗 ${S.epics || 0} 件`));
      const tabs = h('div', { class: 'itabs' }, [['info', '深渊派对'], ['ticket', '邀请函'], ['epic', '史诗兑换'], ['ow', '异界兑换']].map(([id, nm]) => h('div', { class: 'itab' + (tab === id ? ' on' : ''), onclick: () => { IW.abyTab = id; IW.abySel = null; sfx.click(); el._render(); } }, nm)));
      let body;
      if (tab === 'info') {
        body = h('div', { class: 'abydg', 'data-sk': 'aby' }, Object.keys(ABYSS).map(id => {
          const D = DUNGEONS[id], A = ABYSS[id], un = dungeonUnlocked(D), Q = QUESTS[A.quest], sc = SCENES[A.scene];
          const cls = game.player.cls, own = abyssPool(A), pool = [...own.map(k => ({ key: k })), ...EPICS.filter(E => { const I = ITEMS[E.key]; return I && I.abyss && !own.includes(E.key) && E.lvl <= A.lordLvl + 3 && E.lvl >= D.lvl[0] - 6 && (!E.cls || E.cls === cls); }).sort((a, b) => b.lvl - a.lvl)].slice(0, 24);   // 本区域的深渊专属排前面；其余和 rollEpic(领主等级, { abyss }) 能出的一致
          return h('div', { class: 'dgcard' + (un ? '' : ' lock') },
            h('div', { class: 'nm' }, D.name, h('span', { class: 'sub', style: 'margin-left:.6em' }, `推荐 Lv.${D.lvl[0]}~${D.lvl[1]} · 深渊领主 Lv.${A.lordLvl}（随机：${A.lords.map(k => (MON[k] || {}).name || k).join(' / ')}）`)),
            h('div', { class: 'sub' }, un ? `入口：${sc ? sceneTitle(sc) : A.scene}（紫色的深渊之门）· 每次消耗邀请函 ×${A.cost} · 通关 ${S.clears[id] || 0} 次` : `未解锁：完成任务「${Q ? Q.name : A.quest}」（Lv.${Q ? Q.lvl : '?'}，${Q && NPCS[Q.npc] ? NPCS[Q.npc].name : '歌兰蒂斯'}）`),
            h('div', { class: 'sub', style: 'color:#ffd88a' }, `史诗保底 ${(S.pity || {})[id] || 0}/${A.pity}：连续 ${A.pity - 1} 次没出史诗，第 ${A.pity} 次深渊领主必掉（优先本区域的深渊专属）`),
            h('div', { class: 'sub', style: 'color:#e0c8f0' }, D.desc.replace(/^【深渊派对】/, '')),
            h('div', { class: 'pool' }, pool.map(E => itemSlot(codexItemOf(E.key), { cmp: false }))));
        }));
      } else if (tab === 'ticket') {
        const price = abyssTicketPrice(), left = ABYSS_TICKET_DAY - (S.bought || 0), stone = inv.count('m_soul');
        body = h('div', { class: 'col', style: 'gap:.4em' },
          h('div', { class: 'exrow' }, itemSlot(codexItemOf('abyss_ticket')), h('div', {}, h('b', {}, '深渊派对邀请函 ×1'), h('div', { class: 'small dim' }, `每天限购 ${ABYSS_TICKET_DAY} 张（今天还能买 ${left} 张）`)), h('span', { class: 'sp' }), h('span', { class: 'gold' }, `${fmtNum(price)} G`),
            h('button', { class: 'btn sm' + (left > 0 && game.gold >= price ? '' : ' off'), onclick: () => abyssBuyTicket(el) }, '购买')),
          h('div', { class: 'exrow' }, itemSlot(codexItemOf('m_soul')), h('div', {}, h('b', {}, '灵魂之石 ×1 → 邀请函 ×3'), h('div', { class: 'small dim' }, `分解史诗得到灵魂之石（持有 ${stone}）`)), h('span', { class: 'sp' }),
            h('button', { class: 'btn sm' + (stone ? '' : ' off'), onclick: () => abyssTrade(el, 'm_soul', 1, 'abyss_ticket', 3) }, '兑换')),
          h('div', { class: 'exrow' }, itemSlot(codexItemOf('m_cosmos')), h('div', {}, h('b', {}, '宇宙灵魂 ×3 → 邀请函 ×1'), h('div', { class: 'small dim' }, '急着进深渊的时候用')), h('span', { class: 'sp' }),
            h('button', { class: 'btn sm' + (soul >= 3 ? '' : ' off'), onclick: () => abyssTrade(el, 'm_cosmos', 3, 'abyss_ticket', 1) }, '兑换')),
          h('div', { class: 'ihint' }, `邀请函的来源：Lv12 以上地下城的领主（难度越高越容易掉）、深渊领主和「深渊宝藏」翻牌、每天第 3 次通关地下城时歌兰蒂斯送 2 张（今天 ${Math.min(ABYSS_DAILY_N, S.dailyDay === dayKey() ? S.dailyN || 0 : 0)}/${ABYSS_DAILY_N}）、这里购买 / 兑换、商城礼盒。`));
      } else if (tab === 'epic') {
        const keys = abyssExchangeKeys(), g = h('div', { class: 'igrid exgrid', 'data-sk': 'abye' }), sel = keys.includes(IW.abySel) ? IW.abySel : null;
        for (const k of keys) g.append(itemSlot(codexItemOf(k), { cmp: true, sel: k === sel, onClick: () => { IW.abySel = k; sfx.click(); el._render(); } }));
        const cost = sel ? abyssEpicCost(sel) : 0;
        body = h('div', { class: 'col', style: 'gap:.4em' }, g,
          h('div', { class: 'exrow' }, sel ? [h('b', { class: 'q5' }, ITEMS[sel].name), h('span', { class: 'small dim' }, `Lv.${ITEMS[sel].lvl} ${itemTypeName(codexItemOf(sel))}`)] : h('span', { class: 'dim' }, '选择要兑换的史诗'), h('span', { class: 'sp' }),
            sel ? h('span', { class: 'price' }, `宇宙灵魂 ×${cost}`) : null, h('button', { class: 'btn sm' + (sel && soul >= cost ? '' : ' off'), onclick: () => sel && abyssTrade(el, 'm_cosmos', cost, sel, 1, true) }, '兑换')),
          h('div', { class: 'ihint' }, '单件史诗 28 个、Lv28 以上 40 个、史诗套装部件 36 个宇宙灵魂。深渊派对每次通关必得宇宙灵魂（难度越高越多）。兑换的史诗是封装状态：穿上之前可以交易。'));
      } else {
        const sets = Object.values(SETS).filter(X => X.job).sort((a, b) => (b.job === game.job) - (a.job === game.job));
        const g = h('div', { class: 'igrid exgrid', 'data-sk': 'abyo' }), sel = IW.abySel && ITEMS[IW.abySel] && ITEMS[IW.abySel].named ? IW.abySel : null;
        for (const X of sets) for (const k of X.pieces) g.append(itemSlot(codexItemOf(k), { cmp: true, sel: k === sel, onClick: () => { IW.abySel = k; sfx.click(); el._render(); } }));
        body = h('div', { class: 'col', style: 'gap:.4em' }, g,
          h('div', { class: 'exrow' }, sel ? h('b', { class: 'q4' }, ITEMS[sel].name) : h('span', { class: 'dim' }, '选择要兑换的异界套装部件（本转职的排在前面）'), h('span', { class: 'sp' }),
            sel ? h('span', { class: 'price' }, '浓密的异界精髓 ×6') : null, h('button', { class: 'btn sm' + (sel && ess >= 6 ? '' : ' off'), onclick: () => sel && abyssTrade(el, 'm_otherworld', 6, sel, 1) }, '兑换')),
          h('div', { class: 'ihint' }, '异界套装是各转职的专属套装（传说品级）：3 件套让本转职的招牌技能冷却更短、伤害更高。浓密的异界精髓由深渊领主、堕落守护者掉落。'));
      }
      return [npc && npc.lines ? h('div', { style: 'color:#c8b890;font-size:.85em;font-style:italic' }, `“${pick(npc.lines)}”`) : null, head, tabs, body];
    }, { w: 36 });
    el.classList.add('abywin'); el._arg = npc;
    return el;
  },
});
function abyssBuyTicket(el) {
  const S = abyssDay(), price = abyssTicketPrice();
  if ((S.bought || 0) >= ABYSS_TICKET_DAY) { toastMsg('今天的邀请函已经卖完了，明天再来吧', '#ff6a6a'); sfx.error(); return; }
  if (game.gold < price) { toastMsg('金币不足', '#ff6a6a'); sfx.error(); return; }
  if (!inv.add(makeItem('abyss_ticket', 1))) { toastMsg('背包已满', '#ff6a6a'); sfx.error(); return; }
  game.gold -= price; S.bought = (S.bought || 0) + 1; sfx.coin(); save.write(); itemsRefresh();
}
function abyssTrade(el, payKey, payN, getKey, getN, confirm) {
  const go = () => {
    if (inv.count(payKey) < payN) { toastMsg(`${ITEMS[payKey].name}不足`, '#ff6a6a'); sfx.error(); return; }
    const it = makeItem(getKey, getN); if (!it) return;
    if (!inv.add(it)) { toastMsg('背包已满', '#ff6a6a'); sfx.error(); return; }
    inv.take(payKey, payN); sfx.coin(); if ((it.rar || 0) >= 5) sfx.epic();
    toastMsg(`兑换获得 ${it.name}${getN > 1 ? ' ×' + getN : ''}`, RARITY[it.rar || 0].col, 'log'); save.write(); itemsRefresh();
  };
  if (confirm) itemDialog(el, { title: '兑换史诗', msg: `用 <b style="color:#8ae0ff">宇宙灵魂 ×${payN}</b> 兑换 ${itemNameHtml(codexItemOf(getKey))}？`, okText: '兑换', onOk: go });
  else go();
}
Object.assign(NPC_SERVICES, { abyss: { label: '深渊派对', run: N => menus.open('abyss', N) } });
menus.BLOCK.add('abyss');
