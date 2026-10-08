/* =====================================================================
   队伍（最多 4 人）：邀请 / 接受 / 拒绝 / 离开 / 请离 / 移交队长；队伍窗口；组队邀请提示框
   城镇里左侧常驻队伍面板（社交按钮右边）：点队员弹出菜单（移交队长 / 请离 / 私聊），点自己打开队伍窗口；地下城里由 net/coop.js 画血条面板
   队伍状态以服务端为准（消息 party），组队刷图见 net/coop.js
   ===================================================================== */
const netParty = {
  p: null, lootMode: 'owner',
  has(id) { return !!this.p && this.p.members.some(m => m.id === id); },
  me() { return net.user && this.p && this.p.members.find(m => m.id === net.user.id); },
  isLeader() { return !!(this.p && net.user && this.p.leader === net.user.id); },
  leader() { return this.p && this.p.members.find(m => m.id === this.p.leader); },
  others() { return this.p && net.user ? this.p.members.filter(m => m.id !== net.user.id) : []; },
};
const PARTY_WHY = { leave: '你离开了队伍', kick: '你被队长请离了队伍', timeout: '掉线太久，已离开队伍', disband: '队伍解散了' };
net.on('party', m => {
  const was = netParty.p; netParty.p = m.party;
  if (m.party) netParty.prev = m.party; else if (m.why) netParty.prev = null;   // 正常离队 / 解散才忘掉；服务端重启时不会发这条，留着给恢复用
  if (m.why === 'restored' && m.party && m.party.members.length > 1 && !netParty.restoredNote) { netParty.restoredNote = true; chatSys('服务器重启后，队伍已恢复'); }
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
  w_loot(arg = {}) {
    const O = arg && arg.id && typeof coop !== 'undefined' && coop.lootOffers ? (coop.lootOffers.get(arg.id) || arg) : arg;
    if (!O || !O.item) return null;
    const D = ITEMS[O.item.key], itemName = O.item.name || (D && D.name) || O.item.key || '未知装备';
    const modeName = { owner: '归属拾取', leader: '队长分配', random: '随机分配', auction: '队内竞拍' }[O.mode] || O.mode;
    const body = h('div', { class: 'col', style: 'gap:.65em' },
      h('div', { class: 'loot-item' }, h('img', { src: itemIconSrc(O.item.key, 48), alt: '' }), h('div', { class: 'col', style: 'gap:.1em' }, h('b', {}, itemName), h('span', { class: 'small dim' }, `${modeName} · ${O.status === 'pending' ? '等待分配' : '已分配'}`))),
    );
    const close = () => { menus.close('loot'); sfx.click(); };
    if (O.status === 'pending' && O.mode === 'leader') {
      const lead = typeof netParty !== 'undefined' && netParty.isLeader() && typeof coop !== 'undefined' && coop.role === 'host';
      if (lead) {
        const rows = (coop.lootMembers ? coop.lootMembers() : []).map(uid => {
          const m = netParty.p && netParty.p.members.find(x => String(x.id) === String(uid));
          return h('button', { class: 'btn blue', onclick: () => coop.assignLoot(O.id, uid) }, `分给 ${m ? (m.char ? m.char.name : m.name) : `队员 ${uid}`}`);
        });
        body.append(h('div', { class: 'small dim' }, '队长选择这件装备的归属：'), h('div', { class: 'row', style: 'gap:.45em;flex-wrap:wrap' }, rows));
      } else body.append(h('div', { class: 'small dim' }, '等待队长分配这件装备…'));
    } else if (O.status === 'pending' && O.mode === 'auction') {
      const bids = Object.entries(O.bids || {}).map(([uid, n]) => `${uid}: ${Number(n).toLocaleString('en-US')} G`).join('、');
      const high = Object.values(O.bids || {}).reduce((m, n) => Math.max(m, Number(n) || 0), 0);
      const floor = Math.max(Number(O.minBid) || 1, high ? high + 1 : 1);
      const auto = high ? Math.max(floor, Math.ceil(high * 1.05)) : floor;
      const inp = h('input', { class: 'txt', type: 'number', min: String(floor), step: '1', value: String(floor), style: 'width:8em' });
      const bid = () => { const n = Math.floor(Number(inp.value)); if (n >= floor && coop.bidLoot(O.id, n, 'manual')) menus.refresh('loot', O); };
      const bidNow = () => { if (coop.bidLoot(O.id, auto, 'auto')) menus.refresh('loot', O); };
      body.append(h('div', { class: 'small dim' }, bids ? `当前竞价：${bids}` : `起拍价：${Number(O.minBid || 1).toLocaleString('en-US')} G`),
        h('div', { class: 'row', style: 'gap:.45em;align-items:center;flex-wrap:wrap' }, inp,
          h('button', { class: 'btn blue', onclick: bid }, '手动出价'),
          h('button', { class: 'btn gold', onclick: bidNow }, high ? `立即出价（+5%：${auto.toLocaleString('en-US')} G）` : `立即出价（${auto.toLocaleString('en-US')} G）`)));
      if (typeof netParty !== 'undefined' && netParty.isLeader() && typeof coop !== 'undefined' && coop.role === 'host') body.append(h('button', { class: 'btn gold', onclick: () => coop.resolveLoot(O.id) }, '结算竞拍'));
    } else if (O.status === 'destroyed') {
      body.append(h('div', { class: 'small dim' }, '无人出价，物品已销毁（官方竞拍规则）'));
    } else if (O.status === 'awarded') {
      const m = netParty && netParty.p && netParty.p.members.find(x => String(x.id) === String(O.winner));
      const settle = O.settlement || {};
      body.append(h('div', { class: 'small' }, `获得者：${m ? (m.char ? m.char.name : m.name) : O.winner}`),
        O.price ? h('div', { class: 'small dim' }, `成交价：${Number(O.price).toLocaleString('en-US')} G · 手续费 ${Number(O.fee || 0).toLocaleString('en-US')} G`) : null,
        O.price && settle.pool != null ? h('div', { class: 'small dim' }, `队伍分红：${Number(settle.pool).toLocaleString('en-US')} G（已通过邮件发放）`) : null);
    }
    body.append(h('div', { class: 'row', style: 'justify-content:flex-end' }, h('button', { class: 'btn', onclick: close }, '关闭')));
    return menus.win('队伍装备分配', body, { w: 25, at: 'center' });
  },
  w_party() {
    if (!netOn()) return null;
    const P = netParty.p, lead = netParty.isLeader(), me = net.user.id;
    const body = h('div', { class: 'col', style: 'gap:.5em' });
    if (!P) {
      body.append(h('div', { class: 'dim' }, '你还没有队伍。在城镇里点其他玩家选“邀请组队”，或者在下面输入账号名 / 角色名邀请。'), h('div', { class: 'small dim' }, '组队后：队长在地下城门口选图，全队一起进；掉落和翻牌各拿各的；怪物血量随人数提高。'));
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
      const lootNames = { owner: '归属拾取', leader: '队长分配', random: '随机分配', auction: '队内竞拍' };
      body.append(h('div', { class: 'row', style: 'gap:.45em;align-items:center' }, h('span', { class: 'small dim' }, '装备分配'), lead ? h('select', { class: 'txt', value: netParty.lootMode, onchange: ev => { const mode = ev.target.value; if (typeof coop !== 'undefined' && coop.setLootMode(mode)) { netParty.lootMode = mode; chatSys(`装备分配改为：${lootNames[mode]}`); } else { ev.target.value = netParty.lootMode; toastMsg('只有队长能在进图前修改分配', '#ffb08a'); } } }, Object.entries(lootNames).map(([k, v]) => h('option', { value: k }, v))) : h('span', {}, lootNames[netParty.lootMode])));
      body.append(h('div', { class: 'row', style: 'gap:.5em;justify-content:flex-end' }, h('button', { class: 'btn blue', onclick: () => { if (typeof coop !== 'undefined' && coop.active()) { toastMsg('地下城里不能离开队伍，请先回城', '#ffd0a0'); return; } net.send({ t: 'party:leave' }); } }, '离开队伍')));
    }
    const auctionMail = typeof coop !== 'undefined' && typeof coop.auctionMailPending === 'function' ? coop.auctionMailPending() : [];
    if (auctionMail.length) {
      const label = auctionMail.map(m => m.kind === 'item' ? `物品：${m.item && (m.item.name || m.item.key)}` : `金币：${Number(m.amount || 0).toLocaleString('en-US')} G`).join('、');
      body.append(h('div', { class: 'ptmail' },
        h('div', { class: 'small', style: 'color:#ffe8a8' }, `竞拍邮件（${auctionMail.length}）`),
        h('div', { class: 'small dim' }, label),
        h('button', { class: 'btn gold', onclick: () => { sfx.click(); const n = coop.claimAllAuctionMail(); if (n) toastMsg(`领取了 ${n} 封竞拍邮件`, '#bfe8bf'); menus.refresh('party'); } }, '领取竞拍邮件')));
    }
    if (!P || (lead && P.members.length < 4)) {
      const inp = h('input', { class: 'txt', placeholder: '账号名或角色名', maxlength: 16, spellcheck: 'false' });
      const go = () => { const n = inp.value.trim(); if (n) { netPartyInvite(null, n); inp.value = ''; } };
      inp.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') go(); if (e.key === 'Escape') this.close('party'); });
      body.append(h('div', { class: 'row', style: 'gap:.4em' }, inp, h('button', { class: 'btn', onclick: go }, '邀请')));
    }
    return this.win(P ? `队伍（${P.members.length}/4）` : '队伍', body, { w: 28, at: 'left' });
  },
});
// ---- 城镇里的队伍面板 ----
const ptJob = ch => { if (!ch) return ''; const C = CLASSES[ch.cls], J = ch.job && C && C.jobs && C.jobs[ch.job]; return J ? J.name : C ? C.name : ''; };
const partyHud = {
  el: null, sig: '',
  tick() {
    const P = netParty.p, show = !!P && netOn() && game.scene === 'town' && ui.panelOn() && !menus.hudHidden();
    if (!this.el) { this.el = h('div', { id: 'pthud', hidden: '' }); dom.prepend(this.el); }
    if (this.el.hidden === show) this.el.hidden = !show;
    if (!show) { this.sig = ''; return; }
    const me = net.user && net.user.id, sig = JSON.stringify([P.leader, P.members.map(m => [m.id, m.online, m.char && [m.char.name, m.char.lvl, m.char.cls, m.char.job]])]);
    if (sig === this.sig) return; this.sig = sig;
    this.el.replaceChildren(h('div', { class: 'hd', onclick: () => { sfx.click(); menus.show('party'); } }, `队伍 ${P.members.length}/4`, h('span', {}, '点队员可以移交队长 / 请离')),
      ...P.members.map(m => {
        const ch = m.char, isMe = m.id === me;
        return h('div', { class: 'pm' + (m.online ? '' : ' off') + (isMe ? ' me' : ''), title: isMe ? '打开队伍窗口' : '点击：移交队长 / 请离 / 私聊',
          onclick: ev => { sfx.click(); if (isMe) menus.show('party'); else netPlayerMenu(m, ev); } },
          h('span', { class: 'cr', title: m.id === P.leader ? '队长' : '' }, m.id === P.leader ? '♛' : ''),
          h('b', {}, ch ? `Lv.${ch.lvl} ${ch.name}` : m.name),
          h('span', { class: 'st' }, !m.online ? '掉线中' : isMe ? '你' : ptJob(ch)));
      }));
  },
};
{ const draw0 = ui.draw; ui.draw = function () { draw0.apply(this, arguments); partyHud.tick(); }; }
// 组队相关的提示（邀请已发出 / 没有这个玩家 / 已经有队伍了……）：除了聊天记录，也在画面中间提示，别让人以为没反应
net.on('party:note', m => toastMsg(m.text, '#9ad8ff'));
addStyle(`
#pthud[hidden]{display:none}
#pthud{position:absolute;left:calc(var(--u) * 142px);top:calc(var(--u) * 168px);width:calc(var(--u) * 260px);display:flex;flex-direction:column;gap:calc(var(--u) * 4px);z-index:1}
#pthud .hd{display:flex;align-items:baseline;gap:.5em;font-size:.8em;font-weight:900;color:#9ad8ff;cursor:pointer;text-shadow:0 0 .25em #000,0 0 .25em #000}
#pthud .hd span{font-size:.8em;font-weight:400;color:#c8d8e8;opacity:.8}
#pthud .pm{display:flex;align-items:center;gap:.35em;padding:.22em .5em;background:rgba(8,6,12,.66);border:.07em solid rgba(154,216,255,.35);border-radius:.25em;font-size:.82em;color:#f0dcb0;cursor:pointer;line-height:1.3}
#pthud .pm:hover{border-color:#9ad8ff;background:rgba(20,30,44,.8)}
#pthud .pm.off{opacity:.5}
#pthud .pm .cr{width:1em;color:#ffd23a;text-align:center;flex:none}
#pthud .pm b{color:#ffb24a;font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
#pthud .pm.me b{color:#ffe8a8}
#pthud .pm .st{margin-left:auto;font-size:.85em;color:#9ad0ff;white-space:nowrap;flex:none}
.ptrow{display:flex;align-items:center;gap:.45em;padding:.3em .4em;border-radius:.25em;background:rgba(255,255,255,.04)}
.ptrow.off{opacity:.55}.ptrow .btn{padding:.2em .55em;font-size:.85em}
.ptcrown{width:1.1em;color:#ffd23a;font-size:1.1em;text-align:center}
.ptmail{display:flex;flex-direction:column;gap:.25em;padding:.45em;background:rgba(120,80,20,.16);border:.07em solid rgba(255,210,100,.35);border-radius:.25em}
`);
