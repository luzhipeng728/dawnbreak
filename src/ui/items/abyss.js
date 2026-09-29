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
const abyssTicketPrice = () => 3000 + game.lvl * 150;   // 不限购（深渊派对没有次数限制，有邀请函就能进）
// 宇宙灵魂兑换价（装备 2.0 按等级 / 档加价：Lv50~59 55，Lv60 T1 / T2 70，Lv60 T3 和 Lv60 套装部件 90）
const abyssEpicCost = key => { const D = ITEMS[key]; if (D.lvl >= 60) return D.set || (D.tier || 1) >= 3 ? 90 : 70; if (D.lvl >= 50) return 55; return D.set ? 36 : D.lvl >= 28 ? 40 : 28; };
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
      const tabs = h('div', { class: 'itabs' }, [['info', '深渊派对'], ['ticket', '邀请函'], ['epic', '史诗兑换'], ['ow', '异界兑换'], ['cdr', '纯冷却流']].filter(([id]) => npc || id === 'info' || id === 'ticket').map(([id, nm]) => h('div', { class: 'itab' + (tab === id ? ' on' : ''), onclick: () => { IW.abyTab = id; IW.abySel = null; sfx.click(); el._render(); } }, nm)));
      let body;
      if (tab === 'info') {
        body = h('div', { class: 'abydg', 'data-sk': 'aby' }, Object.keys(ABYSS).map(id => {
          const D = DUNGEONS[id], A = ABYSS[id], un = dungeonUnlocked(D), Q = QUESTS[A.quest], sc = SCENES[A.scene];
          const cls = game.player.cls, own = abyssPool(A), pool = [...own.map(k => ({ key: k })), ...EPICS.filter(E => { const I = ITEMS[E.key]; return I && I.abyss && !own.includes(E.key) && E.lvl <= A.lordLvl + 3 && E.lvl >= D.lvl[0] - 6 && (!E.cls || E.cls === cls); }).sort((a, b) => b.lvl - a.lvl)].slice(0, 24);   // 本区域的深渊专属排前面；其余和 rollEpic(领主等级, { abyss }) 能出的一致
          const qs = Q ? questState(Q.id) : 'locked', qn = Q && NPCS[Q.npc] ? NPCS[Q.npc].name : '歌兰蒂斯', qsc = Q && qSceneOfNpc(Q.npc);
          const qTxt = { done: '资格：已完成', active: `资格：进行中（${Q && Q.goals[0] && DUNGEONS[Q.goals[0].dungeon] ? '通关' + DUNGEONS[Q.goals[0].dungeon].name : ''}）`, ready: `资格：可以交付（${qn}）`, avail: `资格：可以接（${qsc ? qsc.name + ' · ' : ''}${qn}）`, soon: `资格：Lv.${Q && Q.lvl} 开放`, locked: `资格：Lv.${Q && Q.lvl} 开放${Q && Q.pre.length ? '（先完成前一个深渊的资格）' : ''}` }[qs];
          const go = qs === 'done' ? () => abyssGoGate(id) : qs === 'avail' || qs === 'active' || qs === 'ready' ? () => abyssGoQuest(Q.id) : null;
          return h('div', { class: 'dgcard' + (un ? '' : ' lock'), 'data-aby': id },
            h('div', { class: 'nm' }, D.name, h('span', { class: 'sub', style: 'margin-left:.6em' }, `推荐 Lv.${D.lvl[0]}~${D.lvl[1]} · 深渊领主 Lv.${A.lordLvl}（随机：${A.lords.map(k => (MON[k] || {}).name || k).join(' / ')}）`),
              h('button', { class: 'btn sm abygo' + (go ? '' : ' off'), style: 'float:right', onclick: () => { if (!go) { toastMsg('资格任务还没开放', '#ffd0a0'); sfx.error(); return; } sfx.click(); go(); } }, '前往')),
            h('div', { class: 'sub', style: `color:${qs === 'done' ? '#a8e8a0' : '#ffd0a0'}` }, qTxt, ` · 门：${sc ? sceneTitle(sc) : A.scene}（紫色的深渊之门${un ? '' : '，资格完成后出现'}）`),
            h('div', { class: 'sub' }, `每次消耗邀请函 ×${A.cost}（持有 ${tk}）· 通关 ${S.clears[id] || 0} 次`),
            h('div', { class: 'sub', style: 'color:#ffd88a' }, `史诗保底 ${(S.pity || {})[id] || 0}/${A.pity}：连续 ${A.pity - 1} 次没出史诗，第 ${A.pity} 次深渊领主必掉（优先本区域的深渊专属）`),
            h('div', { class: 'sub', style: 'color:#e0c8f0' }, D.desc.replace(/^【深渊派对】/, '')),
            h('div', { class: 'pool' }, pool.map(E => itemSlot(codexItemOf(E.key), { cmp: false }))));
        }));
      } else if (tab === 'ticket') {
        const price = abyssTicketPrice(), stone = inv.count('m_soul'), T = ABYSS_TICKET_DROP, pc = x => `${+(x * 100).toFixed(1)}%`, off = npc ? '' : ' off';
        body = h('div', { class: 'col', style: 'gap:.4em' },
          h('div', { class: 'exrow' }, itemSlot(codexItemOf('abyss_ticket')), h('div', {}, h('b', {}, '深渊派对邀请函 ×1'), h('div', { class: 'small dim' }, npc ? '不限购' : '在赫顿玛尔的歌兰蒂斯处购买')), h('span', { class: 'sp' }), h('span', { class: 'gold' }, `${fmtNum(price)} G`),
            h('button', { class: 'btn sm' + (game.gold >= price ? off : ' off'), onclick: () => npc && abyssBuyTicket(el) }, '购买')),
          h('div', { class: 'exrow' }, itemSlot(codexItemOf('m_soul')), h('div', {}, h('b', {}, '灵魂之石 ×1 → 邀请函 ×3'), h('div', { class: 'small dim' }, `分解史诗得到灵魂之石（持有 ${stone}）`)), h('span', { class: 'sp' }),
            h('button', { class: 'btn sm' + (stone ? off : ' off'), onclick: () => npc && abyssTrade(el, 'm_soul', 1, 'abyss_ticket', 3) }, '兑换')),
          h('div', { class: 'exrow' }, itemSlot(codexItemOf('m_cosmos')), h('div', {}, h('b', {}, '宇宙灵魂 ×3 → 邀请函 ×1'), h('div', { class: 'small dim' }, '急着进深渊的时候用')), h('span', { class: 'sp' }),
            h('button', { class: 'btn sm' + (soul >= 3 ? off : ' off'), onclick: () => npc && abyssTrade(el, 'm_cosmos', 3, 'abyss_ticket', 1) }, '兑换')),
          h('div', { class: 'ihint', 'data-sk': 'abytk' }, `持有 ${tk} 张。掉落：Lv${T.minLv} 以上的普通地下城——领主 ${pc(T.boss)}、精英 ${pc(T.elite)}、小怪 ${pc(T.mob)}（每档难度 +${pc(T.diff)}），平均每 1~2 次通关一张；深渊领主 15%、「深渊宝藏」翻牌 18%。另外：每天第 3 次通关地下城时歌兰蒂斯送 2 张（今天 ${Math.min(ABYSS_DAILY_N, S.dailyDay === dayKey() ? S.dailyN || 0 : 0)}/${ABYSS_DAILY_N}，是额外奖励不是限制）、歌兰蒂斯处购买 / 兑换、商城礼盒。深渊派对没有次数限制。`));
      } else if (tab === 'epic') {
        const keys = abyssExchangeKeys(), g = h('div', { class: 'igrid exgrid', 'data-sk': 'abye' }), sel = keys.includes(IW.abySel) ? IW.abySel : null;
        for (const k of keys) g.append(itemSlot(codexItemOf(k), { cmp: true, sel: k === sel, onClick: () => { IW.abySel = k; sfx.click(); el._render(); } }));
        const cost = sel ? abyssEpicCost(sel) : 0;
        body = h('div', { class: 'col', style: 'gap:.4em' }, g,
          h('div', { class: 'exrow' }, sel ? [h('b', { class: 'q5' }, ITEMS[sel].name), h('span', { class: 'small dim' }, `Lv.${ITEMS[sel].lvl} ${itemTypeName(codexItemOf(sel))}`)] : h('span', { class: 'dim' }, '选择要兑换的史诗'), h('span', { class: 'sp' }),
            sel ? h('span', { class: 'price' }, `宇宙灵魂 ×${cost}`) : null, h('button', { class: 'btn sm' + (sel && soul >= cost ? '' : ' off'), onclick: () => sel && abyssTrade(el, 'm_cosmos', cost, sel, 1, true) }, '兑换')),
          h('div', { class: 'ihint' }, '单件史诗 28 个、Lv28 以上 40 个、史诗套装部件 36 个宇宙灵魂。深渊派对每次通关必得宇宙灵魂（难度越高越多）。兑换的史诗是封装状态：穿上之前可以交易。'));
      } else if (tab === 'cdr') {   // 纯冷却流（content/items/cdr60.js）：传说「时之沙漏」/ 神器「流沙」，宇宙灵魂兑换
        const keys = cdr60ExchangeKeys(), g = h('div', { class: 'igrid exgrid', 'data-sk': 'abyc' }), sel = keys.includes(IW.abySel) ? IW.abySel : null, D = sel && ITEMS[sel];
        for (const k of keys) g.append(itemSlot(codexItemOf(k), { cmp: true, sel: k === sel, onClick: () => { IW.abySel = k; sfx.click(); el._render(); } }));
        const cost = sel ? cdr60Cost(sel) : 0, buy = () => itemDialog(el, { title: '兑换纯冷却装备', msg: `用 <b style="color:#8ae0ff">宇宙灵魂 ×${cost}</b> 兑换 ${itemNameHtml(codexItemOf(sel))}？`, okText: '兑换', onOk: () => abyssTrade(el, 'm_cosmos', cost, sel, 1) });
        body = h('div', { class: 'col', style: 'gap:.4em' }, g,
          h('div', { class: 'exrow' }, sel ? [h('b', { class: 'q' + D.rar }, D.name), h('span', { class: 'small dim' }, `Lv.${D.lvl} ${itemTypeName(codexItemOf(sel))} · 技能冷却 -${Math.round(D.fx.cdr * 100)}%`)] : h('span', { class: 'dim' }, '选择要兑换的纯冷却装备'), h('span', { class: 'sp' }),
            sel ? h('span', { class: 'price' }, `宇宙灵魂 ×${cost}`) : null, h('button', { class: 'btn sm' + (sel && soul >= cost ? '' : ' off'), onclick: () => sel && buy() }, '兑换')),
          h('div', { class: 'ihint' }, `【纯冷却流】只减技能冷却、不加伤害。传说「时之沙漏」每件 -10%（2 / 3 / 5 件再各 -5% / -8% / -12%），${CDR60.cost[4]} 个宇宙灵魂；神器「流沙」每件 -6%，${CDR60.cost[3]} 个。冷却减少各来源相乘、不设上限（最低保底 5%）。Lv${CDR60.minLv} 以上地下城 / 深渊派对的领主也会小几率掉落。`));
      } else {
        const sets = Object.values(SETS).filter(X => X.job).sort((a, b) => (b.job === game.job) - (a.job === game.job));
        const g = h('div', { class: 'igrid exgrid', 'data-sk': 'abyo' }), sel = IW.abySel && ITEMS[IW.abySel] && ITEMS[IW.abySel].named ? IW.abySel : null;
        for (const X of sets) for (const k of X.pieces) g.append(itemSlot(codexItemOf(k), { cmp: true, sel: k === sel, onClick: () => { IW.abySel = k; sfx.click(); el._render(); } }));
        body = h('div', { class: 'col', style: 'gap:.4em' }, g,
          h('div', { class: 'exrow' }, sel ? h('b', { class: 'q4' }, ITEMS[sel].name) : h('span', { class: 'dim' }, '选择要兑换的异界套装部件（本转职的排在前面）'), h('span', { class: 'sp' }),
            sel ? h('span', { class: 'price' }, '浓密的异界精髓 ×6') : null, h('button', { class: 'btn sm' + (sel && ess >= 6 ? '' : ' off'), onclick: () => sel && abyssTrade(el, 'm_otherworld', 6, sel, 1) }, '兑换')),
          h('div', { class: 'ihint' }, '异界套装是各转职的专属套装（传说品级）：3 件套让本转职的招牌技能冷却更短、伤害更高。浓密的异界精髓由深渊领主掉落。'));
      }
      return [npc && npc.lines ? h('div', { style: 'color:#c8b890;font-size:.85em;font-style:italic' }, `“${pick(npc.lines)}”`) : null, head, tabs, body];
    }, { w: 36 });
    el.classList.add('abywin'); el._arg = npc;
    return el;
  },
});
function abyssBuyTicket(el) {
  const S = abyssDay(), price = abyssTicketPrice();
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

/* ---------------- 找得到深渊：开放提示（带“自动前往”）、总览里的“前往”、世界地图上的深渊标记 ----------------
   总览：menus.open('abyss') 不带 NPC = 只看信息（深渊列表 + 邀请函来源）；世界地图（N）里有“深渊派对总览”按钮 */
addStyle(`
#abynote{position:absolute;right:1em;top:calc(var(--u) * 190px);z-index:60;width:19em;padding:.6em .7em;border-radius:.4em;background:linear-gradient(135deg,rgba(80,20,120,.95),rgba(20,8,30,.95));border:.12em solid #b870ff;color:#f0dcff;font-size:.85em;box-shadow:0 0 1em rgba(170,70,255,.5)}
#abynote .row{display:flex;gap:.4em;margin-top:.4em;justify-content:flex-end}
.wm-node .wm-aby{font-size:.58em;font-weight:900;color:#fff;background:#9a3ad0;border-radius:.3em;padding:0 .3em;line-height:1.3;margin-top:.1em;box-shadow:0 0 .4em #c070ff}
`);
function abyssNotice(msg, qid) {
  document.getElementById('abynote')?.remove();
  const el = h('div', { id: 'abynote' }, h('b', {}, '深渊派对'), h('div', {}, msg),
    h('div', { class: 'row' },
      h('button', { class: 'btn sm', onclick: () => { el.remove(); abyssGoQuest(qid); } }, '自动前往'),
      h('button', { class: 'btn sm blue', onclick: () => { el.remove(); menus.open('abyss'); sfx.open(); } }, '深渊总览'),
      h('button', { class: 'btn sm', onclick: () => el.remove() }, '×')));
  dom.appendChild(el); setTimeout(() => el.remove(), 25000);
  return el;
}
function abyssGoQuest(qid) {
  if (typeof guide === 'undefined') return;
  if (game.scene !== 'town') { toastMsg('在城镇 / 区域地图里才能自动前往', '#ffb0a0'); sfx.error(); return; }
  abyssHookGuide(); guide.goTo(qid); menus.close('abyss');
}
function abyssGoGate(id) {
  if (typeof guide === 'undefined') return;
  if (game.scene !== 'town') { toastMsg('在城镇 / 区域地图里才能自动前往', '#ffb0a0'); sfx.error(); return; }
  abyssHookGuide(); guide.follow = null; guide.pin = null; guide.abyGate = id; guide.auto = true; guide.arrived = false; if (guide.el) guide.el._sig = null; menus.close('abyss');
}
// 指引走到深渊门口：guide 只认任务，这里给它加一个“去某扇门”的目标（ui/guide.js 在本文件之后加载，用到时再挂上）
function abyssHookGuide() {
  if (guide._aby) return; guide._aby = true;
  const bf = guide.focus.bind(guide), bg = guide.goTo.bind(guide);
  guide.goTo = id => { guide.abyGate = null; return bg(id); };
  guide.focus = function () {
    const id = this.abyGate, D = id && DUNGEONS[id];
    if (D) { const t = dungeonUnlocked(D) && this.gateT(id, `进入${D.name}`, { id: 'abyss:' + id, name: D.name }); if (t) return t; this.abyGate = null; }
    return bf();
  };
  bus.on('dungeonEnter', e => { if (guide.abyGate === e.id) guide.abyGate = null; });
}
// 世界地图：有（已出现的）深渊门的地点加一个紫色“深渊”标记；右下角“深渊派对总览”
bus.on('sceneEnter', () => {
  if (menus._abyWm || !menus.w_worldmap) return; menus._abyWm = true;
  const base = menus.w_worldmap;
  menus.w_worldmap = function (arg) {
    const el = base.call(this, arg); if (!el) return el;
    for (const [id, A] of Object.entries(ABYSS)) {
      const D = DUNGEONS[id], node = el.querySelector(`.wm-node[data-id="${A.scene}"]`);
      if (D && node && dungeonUnlocked(D) && !node.querySelector('.wm-aby')) node.append(h('span', { class: 'wm-aby' }, '深渊'));
    }
    const leg = el.querySelector('.wm-legend');
    if (leg) leg.append(h('button', { class: 'btn sm', style: 'margin-left:1em', 'data-sk': 'abyov', onclick: () => { menus.close('worldmap'); menus.open('abyss'); sfx.open(); } }, '深渊派对总览'));
    return el;
  };
});
