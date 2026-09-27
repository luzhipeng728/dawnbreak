/* =====================================================================
   队伍（最多 4 人）：邀请 / 接受 / 拒绝 / 离开 / 请离 / 移交队长；队伍窗口；组队邀请提示框
   队伍状态以服务端为准（消息 party），组队刷图见 net/coop.js
   ===================================================================== */
const netParty = {
  p: null,
  has(id) { return !!this.p && this.p.members.some(m => m.id === id); },
  me() { return net.user && this.p && this.p.members.find(m => m.id === net.user.id); },
  isLeader() { return !!(this.p && net.user && this.p.leader === net.user.id); },
  leader() { return this.p && this.p.members.find(m => m.id === this.p.leader); },
  others() { return this.p && net.user ? this.p.members.filter(m => m.id !== net.user.id) : []; },
};
const PARTY_WHY = { leave: '你离开了队伍', kick: '你被队长请离了队伍', timeout: '掉线太久，已离开队伍', disband: '队伍解散了' };
net.on('party', m => {
  const was = netParty.p; netParty.p = m.party;
  if (!m.party && was && m.why) chatSys(PARTY_WHY[m.why] || '你离开了队伍');
  if (m.party && !was && m.party.id !== netParty.lastPid) chatSys('已加入队伍（聊天框切到“队伍”频道和队友说话）');
  if (m.party) netParty.lastPid = m.party.id;
  if (m.party && m.party.members.length > 1) {   // 队友页面版本不一致：提醒刷新
    const mine = netBuild(), diff = m.party.members.filter(x => x.online && x.build && x.build !== mine && x.id !== (net.user && net.user.id));
    const sig = diff.map(x => x.id).join(',');
    if (sig && sig !== netParty.buildWarn) { netParty.buildWarn = sig; chatSys(`注意：${diff.map(x => x.name).join('、')} 的游戏版本和你不一样，组队刷图前请大家都刷新页面`); }
  }
  menus.refresh('party');
  bus.emit('partyChange', { party: m.party, why: m.why });
});
net.on('party:invited', m => {
  const f = m.from, mine = netBuild(), warn = f.build && f.build !== mine;
  sfx.open && sfx.open();
  chatSys(`${f.name} 邀请你组队`);
  netAsk('pinv', { title: '组队邀请', block: false, timeout: 28000,
    text: `<b>${escHtml(f.char ? f.char.name : f.name)}</b>（${escHtml(f.char ? netCharLine(f.char) : f.name)}，账号 ${escHtml(f.name)}）邀请你加入队伍（当前 ${m.size}/4 人）。` +
      (warn ? '<br><span style="color:#ffb08a">对方的游戏版本和你不一样，加入后请双方刷新页面再一起刷图。</span>' : ''),
    okText: '加入队伍', cancelText: '拒绝',
    ok: () => net.send({ t: 'party:accept', from: f.id }), cancel: () => net.send({ t: 'party:decline', from: f.id }) });
});
net.on('party:declined', m => { chatSys(m.why === 'busy' ? `${m.by} 现在很忙，没法组队` : `${m.by} 拒绝了组队邀请`); toastMsg(`${m.by} 拒绝了组队邀请`, '#ffb08a'); });
bus.on('netLogout', () => { netParty.p = null; });
// 重连（包括服务端重启）：先清空，服务端如果还记得这个队伍会马上补发 party 消息
bus.on('netOpen', () => { netParty.p = null; menus.refresh('party'); });
function netPartyInvite(id, name) {
  if (!net.connected) { toastMsg('没有连上服务器', '#ff9a6a'); return; }
  if (netParty.p && !netParty.isLeader()) { toastMsg('只有队长可以邀请队员', '#ffb08a'); return; }
  if (netParty.p && netParty.p.members.length >= 4) { toastMsg('队伍已满（最多 4 人）', '#ffb08a'); return; }
  net.send({ t: 'party:invite', to: id || name });
}
Object.assign(menus, {
  w_party() {
    if (!netOn()) return null;
    const P = netParty.p, lead = netParty.isLeader(), me = net.user.id;
    const body = h('div', { class: 'col', style: 'gap:.5em' });
    if (!P) {
      body.append(h('div', { class: 'dim' }, '你还没有队伍。在城镇里点其他玩家选“邀请组队”，或者在下面输入用户名邀请。'), h('div', { class: 'small dim' }, '组队后：队长在地下城门口选图，全队一起进；掉落和翻牌各拿各的；怪物血量随人数提高。'));
    } else {
      for (const m of P.members) {
        const ch = m.char, isL = m.id === P.leader;
        body.append(h('div', { class: 'ptrow' + (m.online ? '' : ' off') },
          h('span', { class: 'ptcrown', title: isL ? '队长' : '' }, isL ? '♛' : ''),
          h('div', { class: 'col', style: 'gap:0;flex:1;min-width:0' },
            h('b', { class: 'frname', onclick: ev => { if (m.id !== me) netPlayerMenu(m, ev); } }, ch ? ch.name : m.name, m.id === me ? h('span', { class: 'small dim' }, '（你）') : null),
            h('span', { class: 'small dim' }, ch ? netCharLine(ch).split(' · ')[1] : '', ` · 账号 ${m.name}`, m.online ? '' : ' · 掉线中')),
          lead && m.id !== me ? h('button', { class: 'btn', onclick: () => net.send({ t: 'party:lead', id: m.id }) }, '移交队长') : null,
          lead && m.id !== me ? h('button', { class: 'btn red', onclick: () => net.send({ t: 'party:kick', id: m.id }) }, '请离') : null));
      }
      body.append(h('div', { class: 'row', style: 'gap:.5em;justify-content:flex-end' }, h('button', { class: 'btn blue', onclick: () => { if (typeof coop !== 'undefined' && coop.active()) { toastMsg('地下城里不能离开队伍，请先回城', '#ffd0a0'); return; } net.send({ t: 'party:leave' }); } }, '离开队伍')));
    }
    if (!P || (lead && P.members.length < 4)) {
      const inp = h('input', { class: 'txt', placeholder: '输入用户名邀请组队', maxlength: 16, spellcheck: 'false' });
      const go = () => { const n = inp.value.trim(); if (n) { netPartyInvite(null, n); inp.value = ''; } };
      inp.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') go(); if (e.key === 'Escape') this.close('party'); });
      body.append(h('div', { class: 'row', style: 'gap:.4em' }, inp, h('button', { class: 'btn', onclick: go }, '邀请')));
    }
    return this.win(P ? `队伍（${P.members.length}/4）` : '队伍', body, { w: 28, at: 'left' });
  },
});
addStyle(`
.ptrow{display:flex;align-items:center;gap:.45em;padding:.3em .4em;border-radius:.25em;background:rgba(255,255,255,.04)}
.ptrow.off{opacity:.55}.ptrow .btn{padding:.2em .55em;font-size:.85em}
.ptcrown{width:1.1em;color:#ffd23a;font-size:1.1em;text-align:center}
`);
