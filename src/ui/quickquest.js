/* =====================================================================
   低等级任务直接完成（官方也有类似设计：等级超过任务后可以立即完成）
   - 条件：任务等级低于当前等级的主线 / 支线 / 隐藏任务（已接或可接都行）
     不包括每日任务（每天的奖励），不包括含“完成转职”目标的任务（转职要自己选方向）
   - 奖励照常发放；前置任务先完成，后面的任务才解锁（批量时按顺序一路完成下去）
   - 批量只处理点击那一刻低于等级的任务：中途升级不会连锁完成更高等级的任务
   ===================================================================== */
function questQuickOk(q, L = game.lvl) {
  if (!q || q.type === 'daily' || q.goals.some(g => g.type === 'job')) return false;
  if (!(q.lvl < L)) return false;
  return ['avail', 'active', 'ready'].includes(questState(q.id));
}
// 直接完成：跳过目标检查，走和正常交付一样的收尾（奖励、完成记录、questDone 事件）
function questQuickComplete(id, batch) {
  const q = QUESTS[id], d = qdata(); if (!questQuickOk(q, batch ? batch.L : game.lvl)) return null;
  questItemsTake(q);
  delete d.quests[id]; d.questTrack = d.questTrack.filter(x => x !== id);
  d.questDone[id] = Date.now(); questDirty();
  const got = giveQuestRewards(q);
  bus.emit('questDone', { id, quick: true });
  if (!batch) { sfxQuest('done'); if (game.player) recalcStats(game.player); save.write(); }
  return got;
}
const questQuickList = (L = game.lvl) => questList(q => questQuickOk(q, L));
function questQuickAll() {
  const L = game.lvl, done = [], got = [];
  for (let guard = 0; guard < 50; guard++) {   // 完成一批后会解锁后续任务，重复到没有新任务为止
    const list = questQuickList(L); if (!list.length) break;
    for (const q of list) { const g = questQuickComplete(q.id, { L }); if (g) { done.push(q); got.push(...g); } }
  }
  if (!done.length) return null;
  sfxQuest('done'); if (game.player) { recalcStats(game.player); if (typeof fxAura === 'function') fxAura(game.player, '#ffd23a', 1.2); }
  save.write();
  return { done, got };
}
// 批量结果汇总成奖励条：经验 / 金币 / SP / 复活币合并，物品逐件（太多时折叠）
function questQuickSummary(got) {
  const num = (kind, re) => got.filter(r => r.kind === kind).reduce((s, r) => s + (+(String(r.label).replace(/[,，]/g, '').match(re) || [0, 0])[1] || 0), 0);
  const exp = num('exp', /\+(\d+)/), gold = num('gold', /\+(\d+)/), sp = num('sp', /\+(\d+)/), coin = num('coin', /×(\d+)/);
  const out = [];
  if (exp) out.push({ kind: 'exp', label: `经验值 +${fmtNum(exp)}` });
  if (gold) out.push({ kind: 'gold', label: `金币 +${fmtNum(gold)} G` });
  if (sp) out.push({ kind: 'sp', label: `SP +${sp}` });
  if (coin) out.push({ kind: 'coin', label: `复活币 ×${coin}` });
  const rest = got.filter(r => !['exp', 'gold', 'sp', 'coin'].includes(r.kind));
  out.push(...rest.slice(0, 12));
  if (rest.length > 12) out.push({ kind: 'item', label: `…等 ${rest.length - 12} 项` });
  return out;
}
function questQuickAllAsk() {
  const list = questQuickList(); if (!list.length) { toastMsg('没有可以直接完成的低等级任务', '#c8b8a0'); sfx.error(); return; }
  const byType = {}; for (const q of list) byType[q.type] = (byType[q.type] || 0) + 1;
  const parts = Object.entries(byType).map(([t, n]) => `${QTYPES[t].name} ${n} 个`).join('、');
  menus.ask({ title: '一键完成低等级任务', okText: '全部完成',
    text: `低于当前等级（Lv.${game.lvl}）的任务共 <b style="color:#ffd23a">${list.length}</b> 个（${parts}），将直接完成并领取奖励。<br><span class="small dim">完成后会解锁的后续任务，只要也低于 Lv.${game.lvl}，会一并完成。每日任务和转职任务不包括在内。</span>`,
    ok: () => {
      const r = questQuickAll(); if (!r) return;
      if (menus.isOpen('quests')) menus.refresh('quests');
      menus.open('qquick', { n: r.done.length, got: questQuickSummary(r.got) });
    } });
}
Object.assign(menus, {
  w_qquick(arg) {
    const el = h('div', { class: 'qreward', 'data-block': '1', 'data-hud': 'hide' },
      h('div', { class: 'rays' }), h('div', { class: 'ttl' }, 'QUEST CLEAR'),
      h('div', { class: 'qn' }, `一键完成了 ${arg.n} 个任务`),
      h('div', { class: 'qchips' }, arg.got.map((r, i) => questChip(r, i))),
      h('button', { class: 'btn big', onclick: () => { sfx.click(); this.close('qquick'); } }, '确定'));
    el._arg = arg; return el;
  },
});
// 任务日志：选中的任务加“立即完成”，底部加“一键完成低等级任务（N）”
{
  const w0 = menus.w_quests;
  menus.w_quests = function (arg) {
    const el = w0.call(this, arg); if (!el) return el;
    const ui = this.qlog, q = ui && QUESTS[ui.sel], btns = el.querySelector('.qdet .row'), foot = el.querySelector('.qfoot');
    if (q && btns && questQuickOk(q)) {
      btns.prepend(h('button', { class: 'btn', style: 'border-color:#ffd23a;color:#ffe070', title: `任务等级 Lv.${q.lvl} 低于当前等级，可以直接完成并领取奖励`, onclick: () => {
        const got = questQuickComplete(q.id); if (!got) return;
        this.refresh('quests'); menus.open('npcquest', { q, got });
      } }, '立即完成'));
    }
    const n = questQuickList().length;
    if (foot && n) foot.append(h('button', { class: 'btn', style: 'margin-left:.8em;border-color:#ffd23a;color:#ffe070', onclick: () => { sfx.click(); questQuickAllAsk(); } }, `一键完成低等级任务（${n}）`));
    return el;
  };
}
// 升级后提醒一次：有多少低等级任务可以一键完成
bus.on('levelUp', () => { const n = questQuickList().length; if (n) setTimeout(() => toastMsg(`有 ${n} 个低等级任务可以直接完成（${keyName('quests')} 打开任务日志）`, '#ffd23a'), 1200); });
