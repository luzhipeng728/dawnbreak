/* =====================================================================
   聊天框（官方式，左下角）：世界 / 队伍 / 私聊；回车打开输入框，回车发送，Esc 收起
   - 输入框聚焦时游戏按键全部失效（core.js 的 isTyping()），打开时清掉已按住的方向键，角色不会自己走
   - 命令：/w 名字 内容（私聊）、/r 内容（回复最近的私聊）、/p 内容（队伍）、/s 内容（世界）
   - 点消息里的名字 = 对他私聊；顶部一行是联机按钮：好友、队伍、延迟
   ===================================================================== */
const CHAT_CH = { world: ['世界', '#f0e6d0'], party: ['队伍', '#8ad8ff'], whisper: ['私聊', '#ff9ad8'], sys: ['系统', '#ffd86a'] };
const chat = {
  el: null, logEl: null, bar: null, inp: null, toEl: null, chBtn: null, ch: 'world', to: '', lastFrom: '', open: false, lines: 0, idleT: 0, shown: false,
  build() {
    this.logEl = h('div', { class: 'chatlog' });
    this.chBtn = h('button', { class: 'chatch', title: '切换频道（Tab）', onclick: () => this.cycle() }, '世界');
    this.toEl = h('input', { class: 'chatto', placeholder: '私聊对象', maxlength: 16, spellcheck: 'false', autocomplete: 'off' });
    this.inp = h('input', { class: 'chatinp', placeholder: '回车发送，Esc 收起', maxlength: 100, spellcheck: 'false', autocomplete: 'off' });
    for (const el of [this.inp, this.toEl]) el.addEventListener('keydown', e => this.key(e));
    this.inp.addEventListener('focus', () => { this.open = true; input.clearAll(); this.el.classList.add('open'); });
    const blur = () => setTimeout(() => { if (document.activeElement !== this.inp && document.activeElement !== this.toEl && this.open) { this.open = false; this.el.classList.remove('open'); this.idleT = 0; } }, 0);
    this.inp.addEventListener('blur', blur); this.toEl.addEventListener('blur', blur);
    this.bar = h('div', { class: 'chatbar' }, this.chBtn, this.toEl, this.inp);
    this.top = h('div', { class: 'chattop' });
    this.el = h('div', { id: 'chatbox', hidden: '' }, this.top, this.logEl, this.bar);
    this.el.addEventListener('pointerdown', e => { if (!e.target.closest('button, input, .chatname')) setTimeout(() => this.focus(), 0); });
    this.el.addEventListener('mouseenter', () => this.el.classList.add('hover'));
    this.el.addEventListener('mouseleave', () => this.el.classList.remove('hover'));
    dom.appendChild(this.el);
    this.setCh('world');
    this.drawTop();
  },
  available() { return netOn() && !!game.player && game.scene !== 'title' && !game.pvpNet; },
  // 每帧：显示 / 隐藏（在 menus.drawUI 钩子里调用）
  tick(dt) {
    if (!this.el) { if (!netOn()) return; this.build(); }
    const show = this.available() && (typeof ui === 'undefined' || ui.panelOn() || this.open);
    if (this.shown !== show) { this.shown = show; this.el.hidden = !show; if (!show && this.open) this.close(); }
    if (!show) return;
    this.idleT += dt;
    const quiet = !this.open && this.idleT > 12;
    if (this.el.classList.contains('quiet') !== quiet) this.el.classList.toggle('quiet', quiet);
    if ((this.topT = (this.topT || 0) + dt) > 1) { this.topT = 0; this.drawTop(); }
  },
  drawTop() {
    if (!this.top) return;
    const fr = typeof netFriends !== 'undefined' ? netFriends.list.filter(f => f.online).length : 0, P = typeof netParty !== 'undefined' && netParty.p;
    const rtt = net.connected ? Math.round(net.rtt) : -1, col = rtt < 0 ? '#ff6a5a' : rtt < 100 ? '#6aff8a' : rtt < 300 ? '#ffd24a' : '#ff8a4a';
    const sig = `${fr}|${P ? P.members.length : 0}|${rtt}|${typeof netFriends !== 'undefined' ? netFriends.incoming.length : 0}`;
    if (sig === this.topSig) return; this.topSig = sig;
    this.top.replaceChildren(
      h('button', { class: 'chatbtn', onclick: () => { sfx.click(); menus.show('friends'); } }, '好友', h('span', { class: 'n' }, `${fr}`), typeof netFriends !== 'undefined' && netFriends.incoming.length ? h('span', { class: 'dot' }) : null),
      h('button', { class: 'chatbtn', onclick: () => { sfx.click(); menus.show('party'); } }, '队伍', h('span', { class: 'n' }, P ? `${P.members.length}/4` : '—')),
      h('span', { class: 'chatping', style: `color:${col}`, title: '到服务器的延迟' }, rtt < 0 ? '● 未连接' : `● ${rtt} ms`));
  },
  focus() { if (!this.shown) return; this.el.classList.add('open'); this.inp.focus(); },   // 输入行平时是 display:none，先展开才能聚焦
  close() { this.open = false; this.inp.blur(); this.toEl.blur(); this.el.classList.remove('open'); this.idleT = 0; input.clearAll(); },
  setCh(ch) {
    this.ch = ch; const [n, col] = CHAT_CH[ch];
    this.chBtn.textContent = n; this.chBtn.style.color = col;
    this.toEl.hidden = ch !== 'whisper'; this.inp.style.color = col;
  },
  cycle() { const L = ['world', 'party', 'whisper']; this.setCh(L[(L.indexOf(this.ch) + 1) % L.length]); if (this.ch === 'whisper' && !this.toEl.value) setTimeout(() => this.toEl.focus(), 0); else this.inp.focus(); },
  whisper(name) { this.setCh('whisper'); this.toEl.value = name; this.focus(); },
  key(e) {
    e.stopPropagation();
    if (e.key === 'Escape') { e.preventDefault(); this.close(); return; }
    if (e.key === 'Tab') { e.preventDefault(); this.cycle(); return; }
    if (e.key !== 'Enter' || e.isComposing) return;
    e.preventDefault();
    if (e.target === this.toEl) { this.inp.focus(); return; }
    const text = this.inp.value.trim(); this.inp.value = '';
    this.sendText(text); this.close();   // 官方：回车发送后收起输入框
  },
  sendText(text) {
    let ch = this.ch, to = this.toEl.value.trim(), m;
    if ((m = /^\/w\s+(\S+)\s+(.+)$/i.exec(text))) { ch = 'whisper'; to = m[1]; text = m[2]; this.setCh('whisper'); this.toEl.value = to; }
    else if ((m = /^\/r\s+(.+)$/i.exec(text))) { if (!this.lastFrom) { this.add({ ch: 'sys', text: '还没有人私聊过你' }); return; } ch = 'whisper'; to = this.lastFrom; text = m[1]; }
    else if ((m = /^\/p\s+(.+)$/i.exec(text))) { ch = 'party'; text = m[1]; }
    else if ((m = /^\/s\s+(.+)$/i.exec(text))) { ch = 'world'; text = m[1]; }
    if (ch === 'whisper' && !to) { this.add({ ch: 'sys', text: '请先填写私聊对象（或用 /w 名字 内容）' }); this.toEl.focus(); return; }
    if (ch === 'party' && !(typeof netParty !== 'undefined' && netParty.p)) { this.add({ ch: 'sys', text: '你还没有队伍' }); return; }
    if (!net.send({ t: 'chat', ch, text, to })) this.add({ ch: 'sys', text: '没有连上服务器，消息没有发出去' });
  },
  // 加一条消息
  add(m) {
    if (!this.el) this.build();
    const [chn, col] = CHAT_CH[m.ch] || CHAT_CH.sys, me = net.user && m.from && m.from.id === net.user.id;
    const who = m.from ? (m.from.cname || m.from.name) : '';
    const nameEl = n => h('span', { class: 'chatname', title: `对 ${n} 私聊`, onclick: e => { e.stopPropagation(); this.whisper(n); } }, who);
    let line;
    if (m.ch === 'whisper') {
      if (me) line = [`[私聊] 你对 `, h('span', { class: 'chatname', onclick: e => { e.stopPropagation(); this.whisper(m.to.name); } }, m.to.name), ` 说：`, m.text];
      else { this.lastFrom = m.from.name; line = [`[私聊] `, nameEl(m.from.name), ` 对你说：`, m.text]; }
    } else if (m.from) line = [`[${chn}] `, me ? h('span', { class: 'chatname me' }, who) : nameEl(m.from.name), '：', m.text];
    else line = [`[${chn}] `, m.text];
    const at = m.at ? new Date(m.at) : new Date();
    const el = h('div', { class: 'chatline', style: `color:${col}`, title: at.toLocaleTimeString('zh-CN', { hour12: false }) }, ...line);
    const stick = this.logEl.scrollHeight - this.logEl.scrollTop - this.logEl.clientHeight < 30;
    this.logEl.appendChild(el);
    while (this.logEl.childElementCount > 80) this.logEl.firstChild.remove();
    if (stick) this.logEl.scrollTop = this.logEl.scrollHeight;
    this.idleT = 0; this.el.classList.remove('quiet');
    if (m.ch === 'whisper' && !me && typeof sfx !== 'undefined' && sfx.click) sfx.click();
  },
};
const chatSys = text => chat.add({ ch: 'sys', text });
net.on('chat', m => chat.add(m));
net.on('chatlog', m => { if (chat.logEl && chat.logEl.childElementCount) return; for (const x of m.list) chat.add(x); });
net.on('party:note', m => chatSys(m.text));
net.on('duel:note', m => chatSys(m.text));
bus.on('netOpen', () => { if (chat.el && chat.reconnected) chatSys('已重新连接服务器'); chat.reconnected = true; });
bus.on('netClose', () => { if (netOn()) chatSys('和服务器的连接断开了，正在重连…'); });
// 回车打开聊天（没有窗口要用回车确认时）
addEventListener('keydown', e => {
  if ((e.code !== 'Enter' && e.code !== 'NumpadEnter') || isTyping() || e.repeat) return;
  if (!chat.shown) return;
  const top = menus.top(), el = top && menus.wins[top];
  if (el && el._onConfirm) return;
  e.preventDefault(); chat.focus();
});
// 每帧钩子：UI 画布画完之后（menus.drawUI 原本是空函数，联机的 HUD 元素都挂在这里）
const netUiHooks = [];
const _menusDrawUI = menus.drawUI;
let netUiLast = 0;
menus.drawUI = function (c) {
  _menusDrawUI.call(this, c);
  const now = performance.now(), dt = Math.min(0.1, (now - (netUiLast || now)) / 1000); netUiLast = now;
  chat.tick(dt);
  for (const f of netUiHooks) { try { f(c, dt); } catch (e) { console.error('联机界面绘制出错', e); } }
};
addStyle(`
#chatbox{position:absolute;left:.8%;bottom:39.5%;width:27%;max-width:30em;pointer-events:auto;display:flex;flex-direction:column;gap:.2em;font-size:.82em;z-index:2;transition:opacity .4s}
#chatbox.quiet:not(.hover):not(.open){opacity:.45}
#chatbox .chattop{display:flex;gap:.3em;align-items:center}
#chatbox .chatbtn{font:inherit;font-weight:800;color:#f0dcb0;background:rgba(20,14,10,.78);border:.08em solid #6a5436;border-radius:.25em;padding:.1em .55em;cursor:pointer;display:inline-flex;gap:.35em;align-items:center;position:relative}
#chatbox .chatbtn:hover{border-color:#e8c26a;color:#fff}
#chatbox .chatbtn .n{color:#ffd23a}
#chatbox .chatbtn .dot{position:absolute;right:-.25em;top:-.25em;width:.55em;height:.55em;border-radius:50%;background:#ff4a3a;box-shadow:0 0 .3em #ff4a3a}
#chatbox .chatping{font-weight:800;margin-left:auto;text-shadow:0 0 .2em #000,0 0 .2em #000}
#chatbox .chatlog{max-height:9.6em;overflow-y:auto;overflow-x:hidden;padding:.25em .45em;border-radius:.25em;background:rgba(8,6,12,.42);scrollbar-width:thin;line-height:1.45;text-shadow:0 .06em .1em #000;user-select:text;-webkit-user-select:text}
#chatbox .chatlog:empty{display:none}
#chatbox.open .chatlog,#chatbox.hover .chatlog{max-height:16em;background:rgba(8,6,12,.72)}
#chatbox .chatline{word-break:break-all}
#chatbox .chatname{color:#fff3b0;cursor:pointer;font-weight:800}#chatbox .chatname:hover{text-decoration:underline}#chatbox .chatname.me{cursor:default;text-decoration:none;color:#ffe08a}
#chatbox .chatbar{display:none;gap:.25em}
#chatbox.open .chatbar{display:flex}
#chatbox .chatch{font:inherit;font-weight:900;background:#1a130d;border:.08em solid #8a6a3a;border-radius:.25em;padding:.2em .5em;cursor:pointer;flex:none}
#chatbox input{font:inherit;background:rgba(12,10,16,.92);color:#fff2d0;border:.08em solid #8a6a3a;border-radius:.25em;padding:.25em .45em;outline:none;min-width:0;user-select:text;-webkit-user-select:text}
#chatbox input:focus{border-color:#ffd23a}
#chatbox .chatto{width:6.5em;flex:none;color:#ff9ad8}#chatbox .chatinp{flex:1}
#chatbox:not(.open) .chatlog:hover{cursor:text}
`);
