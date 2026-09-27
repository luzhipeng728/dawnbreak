/* =====================================================================
   NPC 对话窗口（参照 DNF：左侧立绘，中间台词，右侧功能列表）
   功能由 NPC 定义里的 services 决定，每个功能对应一个处理函数（NPC_SERVICES），新增功能只要在这里注册
   ===================================================================== */
const NPC_SERVICES = {
  quest: { label: '任务', show: N => typeof questsOfNpc === 'function' && questsOfNpc(N.id).length > 0, run: (N) => menus.open('npcquest', N) },
  shop: { label: '商店', run: (N, arg) => menus.open('shop', { shop: arg, npc: N }) },
  storage: { label: '仓库', run: () => menus.open('storage') },
  repair: { label: '修理', run: () => repairAll(true) },
  enhance: { label: '强化', run: (N) => menus.open('enhance', N) },
  disassemble: { label: '分解', run: () => menus.open('disassemble') },
  job: { label: '转职', show: N => typeof jobAvailable === 'function', run: (N) => menus.open('job', N) },
  cure: { label: '解除虚弱', show: () => !!(save.data.weak > Date.now()), run: () => cureWeak() },
};
function openNpc(N) {
  sfx.open(); menus.open('npc', N);
  if (typeof questsOnTalk === 'function') questsOnTalk(N.id);
  bus.emit('npcTalk', { id: N.id });
}
const npcPortrait = (N, cls = 'npcpt') => IMG[N.art] ? h('img', { class: cls, src: IMG[N.art].src }) : h('div', { class: cls });
Object.assign(menus, {
  w_npc(N) {
    const list = h('div', { class: 'npcmenu' });
    for (const s of N.services) {
      const [id, arg] = s.split(':'), S = NPC_SERVICES[id];
      if (!S || (S.show && !S.show(N))) continue;
      list.append(h('button', { class: 'btn', onclick: () => { sfx.click(); this.close('npc'); S.run(N, arg); } }, S.label + (id === 'quest' && typeof questsOfNpc === 'function' ? `（${questsOfNpc(N.id).length}）` : '')));
    }
    list.append(h('button', { class: 'btn', onclick: () => { sfx.click(); this.refresh('npc', N); } }, '闲聊'), h('button', { class: 'btn blue', onclick: () => { sfx.click(); this.close('npc'); } }, '离开'));
    const el = h('div', { class: 'npcwin' },
      npcPortrait(N),
      h('div', { class: 'npctalk' }, h('div', { class: 'npcname' }, N.name, N.title ? h('span', { class: 'npctitle' }, N.title) : null), h('div', { class: 'npcline' }, pick(N.lines))),
      list);
    el._arg = N; return el;
  },
});
/* ---- 修理 / 解除虚弱 ---- */
function repairCost() { let c = 0; for (const s of SLOTS) { const it = inv.equip[s]; if (it && it.durMax && it.dur < it.durMax) c += Math.ceil((it.durMax - it.dur) * (8 + it.lvl * 3) * (1 + it.rar * 0.4)); } return c; }
function repairAll(verbose) {
  const c = repairCost();
  if (!c) { if (verbose) toastMsg('装备都很完好，不需要修理', '#bfe8bf'); return; }
  if (game.gold < c) { toastMsg(`金币不足，修理需要 ${fmtNum(c)} G`, '#ff6a6a'); sfx.error(); return; }
  game.gold -= c; for (const s of SLOTS) { const it = inv.equip[s]; if (it && it.durMax) it.dur = it.durMax; }
  recalcStats(game.player); sfx.coin(); save.write(); toastMsg(`修理完成，花费 ${fmtNum(c)} G`, '#ffd23a');
}
function cureWeak() {
  const cost = 200 + game.lvl * 60;
  if (game.gold < cost) { toastMsg(`金币不足，需要 ${fmtNum(cost)} G`, '#ff6a6a'); sfx.error(); return; }
  game.gold -= cost; save.data.weak = 0; recalcStats(game.player); sfx.buff(); save.write(); toastMsg(`神的光辉驱散了虚弱（花费 ${fmtNum(cost)} G）`, '#8aff9a');
}
