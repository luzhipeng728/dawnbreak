/* =====================================================================
   好友：好友列表窗口（在线状态、在哪、私聊 / 邀请组队 / 决斗 / 删除）、好友申请、按名字加好友
   玩家菜单：城镇里点其他玩家（或好友列表 / 队伍窗口里的名字）弹出：查看信息、私聊、加好友、邀请组队、发起决斗
   ===================================================================== */
const netFriends = {
  list: [], incoming: [], outgoing: [], ids: new Set(), loaded: false,
  isFriend(id) { return this.ids.has(id); },
  byId(id) { return this.list.find(f => f.id === id); },
  async load() {
    if (!netOn()) return;
    try {
      const r = await net.api('GET', '/api/friends');
      this.list = r.friends; this.incoming = r.incoming; this.outgoing = r.outgoing; this.ids = new Set(r.friends.map(f => f.id)); this.loaded = true;
      menus.refresh('friends');
    } catch (e) { /* 断网时保留旧列表 */ }
  },
  async add(name) {
    try { const r = await net.api('POST', '/api/friends', { user: name }); toastMsg(r.state === 'ok' ? `你和 ${name} 成为了好友` : `已向 ${name} 发送好友申请`, '#8aff9a'); this.load(); return true; }
    catch (e) { toastMsg(e.message, '#ff9a6a'); return false; }
  },
  async accept(name) { try { await net.api('POST', '/api/friends/accept', { user: name }); toastMsg(`你和 ${name} 成为了好友`, '#8aff9a'); this.load(); } catch (e) { toastMsg(e.message, '#ff9a6a'); } },
  async remove(name) { try { await net.api('DELETE', '/api/friends/' + encodeURIComponent(name)); this.load(); } catch (e) { toastMsg(e.message, '#ff9a6a'); } },
};
net.on('friend:req', m => {
  netFriends.load(); sfx.open && sfx.open();
  chatSys(`${m.from.name} 想加你为好友（在好友窗口里同意）`);
  netAsk('freq' + m.from.id, { title: '好友申请', text: `<b>${escHtml(m.from.name)}</b> 想加你为好友。`, okText: '同意', cancelText: '拒绝', block: false,
    ok: () => netFriends.accept(m.from.name), cancel: () => netFriends.remove(m.from.name), timeout: 60000, onTimeout: () => {} });
});
net.on('friend:ok', m => { netFriends.load(); chatSys(`你和 ${m.user.name} 成为了好友`); });
net.on('friend:del', () => netFriends.load());
net.on('friend:on', m => {
  const f = netFriends.byId(m.id); if (!f) return;
  f.online = m.on; if (m.char) f.char = m.char;
  if (!m.on) f._offT = Date.now();
  else if (!f._offT || Date.now() - f._offT > 30000) chatSys(`好友 ${f.name} 上线了`);   // 短暂断线重连不刷屏
  menus.refresh('friends');
});
bus.on('netOpen', () => netFriends.load());
bus.on('netLogout', () => { netFriends.list = []; netFriends.ids = new Set(); });
// 场景名（好友在哪）
const netSceneName = id => { if (!id) return ''; const S = SCENES[id]; return S ? sceneTitle(S) : ''; };
const netCharLine = ch => { if (!ch) return ''; const J = ch.job && CLASSES[ch.cls] && CLASSES[ch.cls].jobs && CLASSES[ch.cls].jobs[ch.job]; return `${ch.name} · Lv.${ch.lvl} ${J ? J.name : (CLASSES[ch.cls] ? CLASSES[ch.cls].name : '')}`; };
Object.assign(menus, {
  w_friends() {
    if (!netOn()) return null;
    if (!netFriends.loaded) netFriends.load();
    const addIn = h('input', { class: 'txt', placeholder: '输入用户名加好友', maxlength: 16, spellcheck: 'false' });
    const doAdd = () => { const n = addIn.value.trim(); if (!n) return; netFriends.add(n).then(ok => { if (ok) addIn.value = ''; }); };
    addIn.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') doAdd(); if (e.key === 'Escape') this.close('friends'); });
    const rows = [];
    if (netFriends.incoming.length) {
      rows.push(h('div', { class: 'frsec' }, `好友申请（${netFriends.incoming.length}）`));
      for (const f of netFriends.incoming) rows.push(h('div', { class: 'frrow' }, h('b', {}, f.name), h('span', { class: 'sp' }),
        h('button', { class: 'btn', onclick: () => netFriends.accept(f.name) }, '同意'), h('button', { class: 'btn blue', onclick: () => netFriends.remove(f.name) }, '拒绝')));
    }
    const fl = netFriends.list.slice().sort((a, b) => (b.online - a.online) || a.name.localeCompare(b.name));
    rows.push(h('div', { class: 'frsec' }, `好友（在线 ${fl.filter(f => f.online).length} / ${fl.length}）`));
    if (!fl.length) rows.push(h('div', { class: 'dim small' }, '还没有好友。在城镇里点其他玩家，或者在上面输入用户名添加。'));
    for (const f of fl) {
      const where = f.online ? (f.scene ? netSceneName(f.scene) : '地下城 / 决斗中') : '离线';
      rows.push(h('div', { class: 'frrow' + (f.online ? ' on' : '') },
        h('span', { class: 'frdot' }),
        h('div', { class: 'col', style: 'gap:0;min-width:0;flex:1' },
          h('span', {}, h('b', { class: 'frname', onclick: ev => netPlayerMenu({ id: f.id, name: f.name, char: f.char }, ev) }, f.name), f.char ? h('span', { class: 'small dim' }, '  ' + netCharLine(f.char)) : null),
          h('span', { class: 'small', style: `color:${f.online ? '#8aff9a' : '#8a8a8a'}` }, where)),
        f.online ? h('button', { class: 'btn', title: '私聊', onclick: () => chat.whisper(f.name) }, '私聊') : null,
        f.online ? h('button', { class: 'btn', title: '邀请组队', onclick: () => netPartyInvite(f.id, f.name) }, '组队') : null,
        f.online ? h('button', { class: 'btn', title: '好友决斗', onclick: () => netDuelAsk({ id: f.id, name: f.name, char: f.char }) }, '决斗') : null,
        h('button', { class: 'btn red', title: '删除好友', onclick: () => netAsk('frdel', { title: '删除好友', text: `确定把 <b>${escHtml(f.name)}</b> 从好友列表里删除吗？`, okText: '删除', danger: true, ok: () => netFriends.remove(f.name) }) }, '✕')));
    }
    if (netFriends.outgoing.length) rows.push(h('div', { class: 'small dim', style: 'margin-top:.4em' }, '等待对方同意：' + netFriends.outgoing.map(f => f.name).join('、')));
    const body = h('div', { class: 'col', style: 'gap:.45em' }, h('div', { class: 'row', style: 'gap:.4em' }, addIn, h('button', { class: 'btn', onclick: doAdd }, '加好友')),
      h('div', { class: 'frlist' }, rows));
    return this.win('好友', body, { w: 30, at: 'left' });
  },
  // 玩家菜单（点城镇里的其他玩家）
  w_pmenu(p) {
    if (!p) return null;
    const B = (label, fn, cls = '') => h('button', { class: 'btn ' + cls, onclick: () => { sfx.click(); this.close('pmenu'); fn(); } }, label);
    const inParty = netParty.has(p.id), friend = netFriends.isFriend(p.id);
    const body = h('div', { class: 'col pmenu' },
      p.char ? h('div', { class: 'small', style: 'text-align:center;color:#ffe8a8' }, netCharLine(p.char)) : null,
      h('div', { class: 'small dim', style: 'text-align:center' }, `账号 ${p.name}${friend ? ' · 好友' : ''}${inParty ? ' · 队友' : ''}`),
      B('查看信息', () => this.show('pinfo', p)),
      B('私聊', () => chat.whisper(p.name)),
      friend ? null : B('加为好友', () => netFriends.add(p.name)),
      inParty ? null : B('邀请组队', () => netPartyInvite(p.id, p.name)),
      B('发起决斗', () => netDuelAsk(p)));
    return this.win(p.char ? p.char.name : p.name, body, { w: 12, drag: false });
  },
  w_pinfo(p) {
    if (!p) return null;
    const ch = p.char, box = h('div', { class: 'row', style: 'gap:1em;align-items:flex-start' });
    if (ch && typeof avatarCanvas === 'function') { const cv = avatarCanvas(ch.cls, ch.look, 150, 200, 1.6); cv.className = 'pinfocv'; box.append(cv); }
    const J = ch && ch.job && CLASSES[ch.cls] && CLASSES[ch.cls].jobs && CLASSES[ch.cls].jobs[ch.job];
    const info = h('div', { class: 'col', style: 'gap:.3em' },
      h('div', { style: 'font-size:1.3em;font-weight:900;color:#ffe8a8' }, ch ? ch.name : p.name),
      ch ? h('div', {}, `Lv.${ch.lvl} ${CLASSES[ch.cls] ? CLASSES[ch.cls].name : ''}${J ? ' · ' + J.name : ''}`) : null,
      h('div', { class: 'small dim' }, `账号：${p.name}`),
      h('div', { class: 'small' }, netFriends.isFriend(p.id) ? '好友' : '', netParty.has(p.id) ? ' 队友' : ''),
      h('div', { class: 'row', style: 'gap:.4em;margin-top:.5em;flex-wrap:wrap' },
        h('button', { class: 'btn', onclick: () => chat.whisper(p.name) }, '私聊'),
        netFriends.isFriend(p.id) ? null : h('button', { class: 'btn', onclick: () => netFriends.add(p.name) }, '加好友'),
        netParty.has(p.id) ? null : h('button', { class: 'btn', onclick: () => netPartyInvite(p.id, p.name) }, '组队'),
        h('button', { class: 'btn', onclick: () => netDuelAsk(p) }, '决斗')));
    box.append(info);
    return this.win('玩家信息', box, { w: 26 });
  },
});
// 在鼠标位置弹出玩家菜单
function netPlayerMenu(p, ev) {
  if (!p || (net.user && p.id === net.user.id)) return;
  if (menus.isOpen('pmenu')) menus.close('pmenu');
  const el = menus.open('pmenu', p); if (!el) return;
  if (ev && ev.clientX !== undefined) { const r = dom.getBoundingClientRect(); menus.moveWin(el, ev.clientX - r.left + 12, ev.clientY - r.top - 20); }
}
// 点地面其他地方：收起玩家菜单
wcan.addEventListener('pointerdown', () => { if (menus.isOpen('pmenu')) menus.close('pmenu'); });
addStyle(`
.frlist{display:flex;flex-direction:column;gap:.3em;max-height:24em;overflow-y:auto;padding-right:.2em}
.frsec{font-weight:900;color:var(--gold);margin-top:.3em;border-bottom:.06em solid rgba(232,194,106,.25)}
.frrow{display:flex;align-items:center;gap:.4em;padding:.25em .35em;border-radius:.25em;background:rgba(255,255,255,.03)}
.frrow .btn{padding:.2em .55em;font-size:.85em}
.frrow .frdot{width:.55em;height:.55em;border-radius:50%;background:#555;flex:none}.frrow.on .frdot{background:#5aff7a;box-shadow:0 0 .35em #5aff7a}
.frrow .frname{cursor:pointer}.frrow .frname:hover{text-decoration:underline}
.frrow:not(.on){opacity:.75}
.pmenu{gap:.35em}.pmenu .btn{padding:.35em .8em}
.pinfocv{width:9em;height:12em;background:radial-gradient(ellipse at 50% 80%,rgba(255,220,150,.15),rgba(0,0,0,0) 70%);border-radius:.3em}
`);
