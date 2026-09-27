/* =====================================================================
   NPC 对话窗口（参照 DNF：左侧立绘，中间台词分页推进，右侧列出该 NPC 的任务和功能按钮）
   - 任务：可交付（黄 ?）/ 可接（黄 !）/ 进行中（灰 ?），点一下进入任务对话：接受 / 拒绝 / 完成
   - 功能按钮由 NPC 定义里的 services 决定，每个功能对应一个处理函数（NPC_SERVICES），新增功能只要在这里注册
   ===================================================================== */
const NPC_SERVICES = {
  quest: { label: '任务', show: () => false, run: () => {} },   // 任务直接列在右侧列表里，不需要单独的按钮
  shop: { label: '商店', run: (N, arg) => menus.open('shop', { shop: arg, npc: N }) },
  storage: { label: '仓库', run: () => menus.open('storage') },
  repair: { label: '修理', run: () => { if (menus.w_repair) menus.open('repair'); else repairAll(true); } },
  enhance: { label: '强化', run: (N) => menus.open('enhance', N) },
  disassemble: { label: '分解', run: () => menus.open('disassemble') },
  job: { label: '转职', show: N => typeof jobAvailable === 'function' && jobAvailable(N), run: (N) => menus.open('job', N) },
  cure: { label: '解除虚弱', show: () => !!(save.data.weak > Date.now()), run: () => cureWeak() },
};
// 对话状态：mode = greet（寒暄）/ talk（任务里的“与我对话”）/ offer（接任务）/ doing（进行中）/ done（交任务）/ after（刚接下）
const npcUI = { N: null, mode: 'greet', qid: null, pages: [], page: 0, typing: null, talks: [] };
function openNpc(N) {
  sfx.open();
  // 先记下“与此 NPC 对话”的任务目标，再发 npcTalk 事件（任务引擎监听它推进进度），窗口里播放这些目标的台词
  const talks = typeof questTalksFor === 'function' ? questTalksFor(N.id) : [];
  npcSet(N, talks.length ? 'talk' : 'greet', null, talks.length ? talks.flatMap(t => (t.g.lines && t.g.lines.length ? t.g.lines : [`（关于「${t.q.name}」）……原来如此，我知道了。`]).map(questFmt)) : null);
  npcUI.talks = talks;
  if (typeof questsOnTalk === 'function') questsOnTalk(N.id);
  bus.emit('npcTalk', { id: N.id });
  if (menus.isOpen('npc')) menus.refresh('npc', N); else menus.open('npc', N);
}
function npcGreet(N) { const L = N.greet && N.greet.length ? N.greet : N.lines; return questFmt(pick(L)); }
function npcSet(N, mode, qid, pages) {
  npcUI.N = N; npcUI.mode = mode; npcUI.qid = qid; npcUI.page = 0;
  if (pages) npcUI.pages = pages;
  else if (mode === 'greet') npcUI.pages = [npcGreet(N)];
  else {
    const q = QUESTS[qid], T = q.talk;
    const src = mode === 'offer' ? (T.offer.length ? T.offer : [q.desc || '有件事想拜托你。'])
      : mode === 'doing' ? (T.doing.length ? T.doing : ['事情办得怎么样了？'])
      : mode === 'done' ? (T.done.length ? T.done : ['辛苦了，这是给你的谢礼。'])
      : [T.accept || '那就拜托你了。'];
    npcUI.pages = src.map(questFmt);
  }
}
const npcPortrait = (N, cls = 'npcpt') => IMG[N.art] ? h('img', { class: cls, src: IMG[N.art].src }) : h('div', { class: cls });
// 台词前缀：「我：」是玩家说的；「@npcId：」是别的 NPC 说的
function npcSpeaker(N, line) {
  if (line.startsWith('我：')) return { who: (save.data && save.data.name) || '我', me: true, text: line.slice(2) };
  const m = line.match(/^@(\w+)：/); if (m && NPCS[m[1]]) return { who: NPCS[m[1]].name, text: line.slice(m[0].length) };
  return { who: N.name, text: line };
}
addStyle(`
.npcwin{align-items:stretch}
.npcwin .npctalk{min-width:0}
.npcwin .qline{cursor:pointer;position:relative;min-height:5.2em;white-space:pre-line}
.npcwin .qline .spk{display:block;font-size:.8em;font-weight:900;color:#ffd24a;margin-bottom:.2em}.npcwin .qline .spk.me{color:#8fd8ff}
.npcwin .qline .more{position:absolute;right:.6em;bottom:.3em;color:#ffd24a;font-size:.8em;animation:npcmore .8s ease-in-out infinite alternate}
@keyframes npcmore{to{transform:translateY(.25em);opacity:.5}}
.npcwin .qextra{display:flex;flex-direction:column;gap:.4em;background:rgba(0,0,0,.2);border-radius:.3em;padding:.5em .7em}
.npcwin .qextra .lbl{font-size:.78em;color:#c8a870;font-weight:900}
.npcwin .qbtns{display:flex;gap:.5em;justify-content:flex-end;min-height:2.3em}
.npcwin .qhead{display:flex;align-items:center;gap:.5em;font-weight:900;color:#ffe8a8}
.npcmenu{width:14em!important;align-self:stretch!important;justify-content:flex-end}
.npcmenu .qitems{display:flex;flex-direction:column;gap:.25em;max-height:14em;overflow-y:auto;margin-bottom:.4em}
.npcmenu .qitem{display:flex;align-items:center;gap:.4em;padding:.35em .5em;border-radius:.25em;cursor:pointer;background:rgba(0,0,0,.3);border:.08em solid #4a3a2a;font-size:.9em;font-weight:700}
.npcmenu .qitem:hover{border-color:#c8a050;background:rgba(80,60,20,.35)}.npcmenu .qitem.sel{border-color:#ffd23a;background:rgba(120,90,20,.35)}
.npcmenu .btn.hot{border-color:#ffd23a;color:#fff6c0;box-shadow:0 0 .8em rgba(255,210,60,.55),inset 0 .08em 0 rgba(255,230,160,.35);animation:npchot 1.2s ease-in-out infinite alternate}
@keyframes npchot{to{box-shadow:0 0 1.4em rgba(255,210,60,.85),inset 0 .08em 0 rgba(255,230,160,.35)}}
.npcmenu .qitem .nm{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
`);
Object.assign(menus, {
  w_npc(N) {
    if (npcUI.N !== N) npcSet(N, 'greet');
    if (npcUI.typing) { clearInterval(npcUI.typing); npcUI.typing = null; }
    const U = npcUI, q = U.qid && QUESTS[U.qid], last = U.page >= U.pages.length - 1;
    const quests = typeof questsOfNpc === 'function' ? questsOfNpc(N.id) : [];
    // 右侧：任务列表 + 功能按钮
    const list = h('div', { class: 'npcmenu' });
    if (quests.length) list.append(h('div', { class: 'qitems' }, quests.map(id => {
      const Q = QUESTS[id], st = questState(id);
      return h('div', { class: 'qitem' + (U.qid === id ? ' sel' : ''), onclick: () => { sfx.click(); npcSet(N, st === 'ready' ? 'done' : st === 'avail' ? 'offer' : 'doing', id); this.refresh('npc', N); } },
        questIco(st), h('span', { class: 'nm', style: `color:${QTYPES[Q.type].col}` }, Q.name));
    })));
    for (const s of N.services) {
      const [id, arg] = s.split(':'), S = NPC_SERVICES[id];
      if (!S || (S.show && !S.show(N))) continue;
      list.append(h('button', { class: 'btn' + (id === 'job' ? ' hot' : ''), onclick: () => { sfx.click(); this.close('npc'); S.run(N, arg); } }, S.label));
    }
    list.append(h('button', { class: 'btn', onclick: () => { sfx.click(); npcSet(N, 'greet'); this.refresh('npc', N); } }, '闲聊'), h('button', { class: 'btn blue', onclick: () => { sfx.click(); this.close('npc'); } }, '离开'));
    // 中间：台词（打字机效果，点击 / X / 空格 / 回车推进）
    const sp = npcSpeaker(N, U.pages[U.page] || '……');
    const txt = h('span'), more = h('span', { class: 'more' }, '▼');
    const line = h('div', { class: 'npcline qline', onclick: () => npcAdvance() }, h('span', { class: 'spk' + (sp.me ? ' me' : '') }, sp.who), txt, last ? null : more);
    let k = 0; const full = sp.text;
    const tick = () => { k = Math.min(full.length, k + 2); txt.textContent = full.slice(0, k); if (k >= full.length && npcUI.typing) { clearInterval(npcUI.typing); npcUI.typing = null; } };
    if (PARAMS.has('bot') || PARAMS.has('notype')) txt.textContent = full; else { tick(); npcUI.typing = setInterval(() => { if (!line.isConnected) { clearInterval(npcUI.typing); npcUI.typing = null; return; } tick(); }, 28); }
    npcUI.finishTyping = () => { if (!npcUI.typing) return false; clearInterval(npcUI.typing); npcUI.typing = null; txt.textContent = full; return true; };
    // 最后一页：目标 / 奖励 / 按钮
    const extra = h('div', { class: 'qextra' }), btns = h('div', { class: 'qbtns' });
    let showExtra = false;
    if (q && last && (U.mode === 'offer' || U.mode === 'doing' || U.mode === 'done')) {
      showExtra = true;
      extra.append(h('div', { class: 'qhead' }, questTag(q), q.name, q.to !== q.npc && U.mode === 'offer' ? h('span', { class: 'small dim' }, `（完成后找 ${npcName(q.to)}）`) : null));
      if (U.mode !== 'done') extra.append(h('div', { class: 'lbl' }, '任务目标'), questGoalsEl(q));
      extra.append(h('div', { class: 'lbl' }, '任务奖励'), questRewardsEl(q));
    }
    if (!last) btns.append(h('button', { class: 'btn', onclick: () => npcAdvance() }, '下一页 ▶'));
    else if (q && U.mode === 'offer') btns.append(h('button', { class: 'btn big', onclick: () => { if (questAccept(q.id)) { npcSet(N, 'after', q.id); this.refresh('npc', N); } } }, '接受'), h('button', { class: 'btn blue', onclick: () => { sfx.click(); npcSet(N, 'greet', null, ['……是吗，那等你改变主意了再来找我吧。']); this.refresh('npc', N); } }, '拒绝'));
    else if (q && U.mode === 'done') btns.append(h('button', { class: 'btn big', onclick: () => npcFinish(N, q) }, '完成任务'));
    else if (U.mode !== 'greet') btns.append(h('button', { class: 'btn', onclick: () => { sfx.click(); npcSet(N, 'greet'); this.refresh('npc', N); } }, '确定'));
    const el = h('div', { class: 'npcwin', 'data-block': '1', 'data-hud': 'hide' },
      npcPortrait(N),
      h('div', { class: 'npctalk' }, h('div', { class: 'npcname' }, N.name, N.title ? h('span', { class: 'npctitle' }, N.title) : null), line, showExtra ? extra : null, btns),
      list);
    el._arg = N; return el;
  },
});
function npcAdvance() {
  if (!menus.isOpen('npc') || !npcUI.N) return;
  if (npcUI.finishTyping && npcUI.finishTyping()) return;   // 先把这一页的字显示完
  if (npcUI.page < npcUI.pages.length - 1) { npcUI.page++; sfx.click(); menus.refresh('npc', npcUI.N); return; }
  if (npcUI.mode === 'talk' || npcUI.mode === 'after') { npcSet(npcUI.N, 'greet', null, [npcUI.mode === 'talk' ? '还有别的事吗？' : npcGreet(npcUI.N)]); menus.refresh('npc', npcUI.N); }
}
function npcFinish(N, q) {
  const got = questComplete(q.id); if (!got) { sfx.error(); return; }
  const next = typeof questsOfNpc === 'function' ? questsOfNpc(N.id).find(id => questState(id) === 'avail' && QUESTS[id].pre.includes(q.id)) : null;
  // 有后续任务：直接接着说下一段（官方连续剧情的感觉）
  if (next) npcSet(N, 'offer', next); else npcSet(N, 'greet', null, [q.talk.thanks ? questFmt(q.talk.thanks) : npcGreet(N)]);
  menus.refresh('npc', N);
  menus.open('npcquest', { q, got });
}
// 键盘：X / 空格 / 回车 推进对话；最后一页时触发主按钮（接受 / 完成 / 确定）
addEventListener('keydown', e => {
  if (e.repeat || !menus.isOpen('npc') || menus.stack[menus.stack.length - 1] !== 'npc') { if (!e.repeat && menus.isOpen('npcquest') && ['KeyX', 'Space', 'Enter', 'NumpadEnter'].includes(e.code) && menus.stack[menus.stack.length - 1] === 'npcquest') { e.preventDefault(); const b = menus.wins.npcquest.querySelector('.btn'); if (b) b.click(); } return; }
  if (!['KeyX', 'Space', 'Enter', 'NumpadEnter'].includes(e.code)) return;
  e.preventDefault();
  if (npcUI.finishTyping && npcUI.finishTyping()) return;
  if (npcUI.page < npcUI.pages.length - 1 || npcUI.mode === 'talk') { npcAdvance(); return; }
  const b = menus.wins.npc && menus.wins.npc.querySelector('.qbtns .btn'); if (b) b.click();
});

/* ---- 修理 / 解除虚弱（repairCost / repairAll 归装备与经济维护） ---- */
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
