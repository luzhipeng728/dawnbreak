/* =====================================================================
   22. 界面窗口框架（DOM）+ 通用窗口：系统菜单 / 操作说明；（旧的背包 / 商店 / 强化 / 地下城选择 / 结算窗口暂留在这里，
       由各自负责人在自己的文件里用 Object.assign(menus, {...}) 覆盖）
   窗口框架（官方式）：
     - menus.open(名字, 参数) → 调用 menus['w_' + 名字](参数) 生成 DOM；再按一次同名快捷键 = 关闭
     - menus.win(标题, 内容, { w, onClose, block, at, drag })：通用外框。标题栏可拖动，点击置顶，位置记在本机
         block: true  对话类窗口，城镇里打开时阻挡移动（默认 false：城镇里 I / M / K 可以同时开着边走边看）
         at: 'left' | 'right' | 'center'  首次打开的位置
     - 自己拼 DOM 的窗口：根元素 data-block="1" 表示阻挡；data-hud="hide" 表示打开时隐藏 HUD 底栏
     - menus.modal()：是否阻挡玩家操作（标题 / 选角、阻挡窗口、输入框聚焦）；地下城里开任何窗口都会暂停
     - menus.tipOn(el, 内容)：统一的提示框（鼠标悬停 / 触屏长按）；menus.ask({...})：通用确认框
   ===================================================================== */
function h(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const k in attrs) { if (k === 'class') e.className = attrs[k]; else if (k === 'html') e.innerHTML = attrs[k]; else if (k.startsWith('on')) e.addEventListener(k.slice(2), attrs[k]); else if (k === 'style') e.style.cssText = attrs[k]; else e.setAttribute(k, attrs[k]); }
  for (const c of kids.flat()) if (c != null) e.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
  return e;
}
// 各模块自带样式：addStyle(css)（新窗口的 CSS 写在自己的 JS 文件里，不用都挤进 shell_top.html）
function addStyle(css) { document.head.appendChild(h('style', {}, css)); }
// 手机（触屏字体有最小值，窗口相对屏幕更大）：结算画面整体收紧，保证“再次挑战 / 返回城镇”在屏幕里
addStyle(`body.touchui #result{gap:.3em;justify-content:safe center;overflow-y:auto}body.touchui #result .ttl{font-size:2em}body.touchui #result .rank{font-size:4.6em}
body.touchui #result .line{font-size:1em;gap:1.2em}body.touchui .cards{grid-template-columns:repeat(2,6.4em);gap:.5em;margin-top:.2em}body.touchui .card{width:6.4em;height:7.6em}body.touchui .card .f img{width:2.6em;height:2.6em}`);
addStyle('[hidden]{display:none!important}');
// 标题画面的说明小字：背景是明亮的天空，原来几乎看不见——加深色描边和底
addStyle('#title .small.dim{color:#efe4c8;text-shadow:0 0 .25em #000,0 0 .5em #000,0 .08em .1em #000;background:rgba(8,6,10,.45);border-radius:.3em;padding:.15em .7em}');
// 小屏（手机横屏 / 很小的浏览器窗口，不管是不是触屏模式）：窗口和提示框的文字和触屏模式一样有最小字号（右下菜单栏、指引条这些 HUD 元素保持原比例，不然会挤爆）；
// 商城这类小字很多的窗口，小字再托底
addStyle(`body.smallui:not(.touchui) :is(.win,#tip){font-size:max(calc(var(--u) * 18.4px), 9.9px)}
#menubar button,#sxbar button{font-size:calc(var(--u) * 20px)}body.smallui #menubar button{font-size:calc(var(--u) * 24px)}body.smallui #menubar kbd{display:none}
:is(body.smallui,body.touchui) .cashwin :is(.ccard .lim,.ccard .tag,.cash-pv .cls){font-size:max(.6em,7.5px)}
:is(body.smallui,body.touchui) .cashwin :is(.ccard.big .ds,.cash-note,.cxrow .sub){font-size:max(.7em,7.5px)}
:is(body.smallui,body.touchui) .cashwin :is(.cpack,.codds,.cash-side .st,.cash-side .err){font-size:max(.72em,7.5px)}`);
{ const small = () => document.body.classList.toggle('smallui', stageH < 560); addEventListener('resize', small); small(); }
// 屏幕中间的提示横幅（drops.js 的 drawToastBanner）：在所有窗口之上，不挡鼠标
addStyle(`#toastbar{position:absolute;left:0;right:0;z-index:99990;pointer-events:none;text-align:center}
#toastbar span{display:inline-block;padding:.35em 5em;font-size:1.75em;font-weight:700;background:linear-gradient(90deg,rgba(8,6,12,0),rgba(8,6,12,.62) 20%,rgba(8,6,12,.62) 80%,rgba(8,6,12,0));-webkit-text-stroke:.16em rgba(0,0,0,.85);paint-order:stroke fill;max-width:80%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}`);
const escHtml = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
// 快捷键 → 窗口名（窗口名分配见 docs/ARCHITECTURE.md）
const UI_WIN = { inv: 'inv', status: 'status', skills: 'skills', quests: 'quests', map: 'worldmap', settings: 'settings', pvp: 'duel' };
const UI_ACTIONS = new Set(['menu', 'confirm', 'uiMode', 'dropNames', 'hideRank', 'tipDetail', 'shot', ...Object.keys(UI_WIN)]);
const menus = {
  stack: [], wins: {}, tip: null, sel: null, z: 10,
  // 默认阻挡移动的窗口（对话 / NPC 服务 / 全屏界面）；别人的窗口也可以用 win({ block }) 或 data-block 自己声明
  BLOCK: new Set(['title', 'charselect', 'newgame', 'npc', 'npcquest', 'job', 'dungeon', 'result', 'loot', 'system', 'shop', 'enhance', 'inherit', 'storage', 'disassemble', 'sell', 'repair', 'keyconfig', 'ask', 'duel']),
  // 打开时隐藏 HUD 底栏的窗口（NPC 对话在屏幕下方，和底栏重叠）
  HUD_HIDE: new Set(['npc', 'npcquest', 'title', 'charselect', 'newgame']),
  // 首次打开的默认位置（官方：物品栏在右、个人信息在左）
  AT: { inv: 'right', status: 'left', quests: 'left', storage: 'left', shop: 'left', sell: 'left' },
  blocking(n) { const el = this.wins[n]; if (el && el.dataset.block) return el.dataset.block !== '0'; return this.BLOCK.has(n); },
  modal() { return game.scene === 'title' || isTyping() || this.stack.some(n => this.blocking(n)); },
  hudHidden() { return this.stack.some(n => this.HUD_HIDE.has(n) || (this.wins[n] && this.wins[n].dataset.hud === 'hide')); },
  isOpen(n) { return this.stack.includes(n); },
  top() { return this.stack[this.stack.length - 1]; },
  open(name, arg) {
    if (this.isOpen(name)) { this.close(name); return null; }
    const fn = this['w_' + name];
    if (typeof fn !== 'function') { toastMsg('该功能暂未开放', '#ffd0a0'); return null; }
    const el = fn.call(this, arg); if (!el) return null;
    if (el._arg === undefined) el._arg = arg;
    this.mount(name, el);
    if (game.scene === 'dungeon') game.paused = true;
    if (this.blocking(name) || game.scene === 'dungeon') input.clearAll();
    return el;
  },
  // 已经开着就置顶，不会关掉
  show(name, arg) { if (this.isOpen(name)) { this.focus(name); return this.wins[name]; } return this.open(name, arg); },
  mount(name, el) {
    el.dataset.win = name; dom.appendChild(el); this.wins[name] = el; this.stack.push(name);
    el.addEventListener('pointerdown', () => this.focus(el.dataset.win), true);
    if (el.classList.contains('win')) { this.place(name, el); this.makeDraggable(el); this.pack(); }
    this.focus(name);
  },
  // 自动并排：同时开着的几个窗口（都没被玩家拖过）左右放得下就并排（M 左、K 中、I 右）；
  // 放不下时技能窗口 K 改成紧凑版（隐藏右侧详情，悬停图标看说明），1280 宽也能同时摆下 I / M / K
  pack() {
    const wp = uiPref('winPos') || {}, W = dom.clientWidth, H = dom.clientHeight, sk = this.wins.skills;
    const list = this.stack.filter(n => this.wins[n] && this.wins[n].classList.contains('win') && this.wins[n].dataset.drag !== '0');
    const rank = n => ({ left: 0, center: 1, right: 2 })[this.wins[n].dataset.at || this.AT[n] || 'center'] ?? 1;
    const els = list.sort((a, b) => rank(a) - rank(b)).map(n => this.wins[n]);
    const total = () => els.reduce((s, e) => s + e.offsetWidth, 0), fits = () => total() + 8 * (els.length + 1) <= W;
    if (sk) {   // 紧凑版只在“完整版放不下、紧凑版放得下”时使用；切换后按记住的位置 / 当前位置重新摆一次（宽度变了）
      const was = sk.classList.contains('compact');
      sk.classList.remove('compact'); if (list.length >= 2 && !fits()) { sk.classList.add('compact'); if (!fits()) sk.classList.remove('compact'); }
      if (was !== sk.classList.contains('compact')) { if (wp.skills) this.place('skills', sk); else this.moveWin(sk, sk.offsetLeft, sk.offsetTop); }
    }
    if (list.length < 2 || list.some(n => wp[n]) || !fits()) return;
    const gap = Math.min(40, (W - total()) / (els.length + 1));
    let x = (W - total() - gap * (els.length - 1)) / 2;
    for (const e of els) { this.moveWin(e, x, Math.max(0, (H - e.offsetHeight) * 0.3)); x += e.offsetWidth + gap; }
  },
  close(name) {
    const el = this.wins[name]; if (!el && !this.isOpen(name)) return;
    const wasBlocking = this.blocking(name);
    if (el) el.remove(); delete this.wins[name];
    this.stack = this.stack.filter(n => n !== name); this.hideTip();
    if (this.wins.skills && this.wins.skills.classList.contains('compact')) this.pack();   // 技能窗口是紧凑版：别的窗口关了就看看能不能恢复完整版
    if (!this.stack.length && game.scene === 'dungeon' && !(game.dungeon && game.dungeon.state === 'result')) game.paused = false;
    if (wasBlocking || game.scene === 'dungeon') input.clearAll();
  },
  closeAll() { for (const n of [...this.stack]) this.close(n); },
  // Esc：先关最上层窗口；没有窗口时打开系统菜单（官方）
  closeTop() {
    const n = this.top();
    if (!n) { this.open('system'); return; }
    if (n === 'result' || n === 'title') return;
    if (n === 'ask') { if (this._askNo) this._askNo(); return; }
    if (n === 'newgame') { this.close('newgame'); this.open('charselect'); return; }
    if (n === 'charselect') { this.close('charselect'); this.open('title'); return; }
    this.close(n);
  },
  focus(name) {
    const el = this.wins[name]; if (!el) return;
    if (this.top() !== name) { this.stack = this.stack.filter(n => n !== name); this.stack.push(name); }
    el.style.zIndex = ++this.z;
  },
  refresh(name, arg) {
    if (!this.isOpen(name)) return;
    this.hideTip(); const old = this.wins[name];
    const el = this['w_' + name](arg ?? old._arg); if (!el) return;
    // 保留滚动位置（点 + / 改键等操作会整窗重画）
    const SCR = '.bd, .keygrid, .sklist2, .dglist, .ngjobs, [data-scroll]', olds = [...old.querySelectorAll(SCR)].map(e => e.scrollTop);
    requestAnimationFrame(() => [...el.querySelectorAll(SCR)].forEach((e, i) => { if (olds[i]) e.scrollTop = olds[i]; }));
    if (el._arg === undefined) el._arg = arg ?? old._arg;
    el.dataset.win = name; el.style.zIndex = old.style.zIndex;
    if (old.classList.contains('compact')) el.classList.add('compact');
    if (old.dataset.placed) { el.style.left = old.style.left; el.style.top = old.style.top; el.style.transform = 'none'; el.dataset.placed = '1'; }
    old.replaceWith(el); this.wins[name] = el;
    el.addEventListener('pointerdown', () => this.focus(el.dataset.win), true);
    if (el.classList.contains('win')) { if (!el.dataset.placed) this.place(name, el); else this.moveWin(el, el.offsetLeft, el.offsetTop); this.makeDraggable(el); }
  },
  drawUI() { },
  win(title, body, { w, onClose, id, block, at, drag } = {}) {
    const el = h('div', { class: 'win', style: w ? `width:${w}em` : '' },
      h('div', { class: 'hd' }, h('span', { class: 'tt' }, title), h('span', { class: 'x', title: '关闭（Esc）', onclick: () => { if (onClose) onClose(); else this.close(el.dataset.win); sfx.click(); } }, '✕')),
      h('div', { class: 'bd' }, body));
    if (id) el.id = id;
    if (block !== undefined) el.dataset.block = block ? '1' : '0';
    if (at) el.dataset.at = at;
    if (drag === false) el.dataset.drag = '0';
    return el;
  },
  /* ---- 窗口位置：首次按 at 放置，之后记住玩家拖到的位置（按舞台比例保存，换分辨率也不会跑出屏幕） ---- */
  place(name, el) {
    const W = dom.clientWidth, H = dom.clientHeight, w = el.offsetWidth, hh = el.offsetHeight, pos = (uiPref('winPos') || {})[name];
    let x, y;
    if (pos && el.dataset.drag !== '0') { x = pos.x * W; y = pos.y * H; }
    else {
      // 默认位置（at）；如果和已经打开的窗口重叠，就在 左 / 中 / 右 里挑重叠最少的位置（官方：I、M、K 同时开时各占一边）
      const at = el.dataset.at || this.AT[name] || 'center', xs = { left: W * 0.03, right: W * 0.97 - w, center: (W - w) / 2 };
      y = Math.max(0, (H - hh) * (at === 'center' ? 0.42 : 0.3));
      const others = this.stack.filter(n => n !== name && this.wins[n] && this.wins[n].classList.contains('win')).map(n => this.wins[n]);
      const overlap = cx => others.reduce((s, o) => s + Math.max(0, Math.min(cx + w, o.offsetLeft + o.offsetWidth) - Math.max(cx, o.offsetLeft)) * Math.max(0, Math.min(y + hh, o.offsetTop + o.offsetHeight) - Math.max(y, o.offsetTop)), 0);
      x = xs[at] ?? xs.center;
      if (others.length && overlap(x) > 0) for (const k of [at, 'center', 'left', 'right']) if (overlap(xs[k]) < overlap(x) - 1) x = xs[k];
      // 实在放不下时错开（阶梯式），保证每个窗口的标题栏都露出来
      for (let k = 0; k < 8 && others.some(o => Math.abs(o.offsetLeft - x) < w * 0.5 && Math.abs(o.offsetTop - y) < 36); k++) { y += 38; x += (x + w + 30 < W ? 30 : -30); }
    }
    this.moveWin(el, x, y); el.dataset.placed = '1';
  },
  moveWin(el, x, y) {
    const W = dom.clientWidth, H = dom.clientHeight, w = el.offsetWidth, hh = el.offsetHeight;   // 整个窗口保持在屏幕内（官方）
    x = clamp(x, 0, Math.max(0, W - w)); y = clamp(y, 0, Math.max(0, H - hh));
    el.style.left = Math.round(x) + 'px'; el.style.top = Math.round(y) + 'px'; el.style.transform = 'none';
  },
  makeDraggable(el) {
    const hd = el.querySelector(':scope > .hd'); if (!hd || el.dataset.drag === '0' || hd._drag) return;
    hd._drag = true; hd.classList.add('drag');
    hd.addEventListener('pointerdown', ev => {
      if (ev.button !== 0 || ev.target.closest('.x, button, input, select')) return;
      ev.preventDefault(); hd.setPointerCapture(ev.pointerId);
      const x0 = el.offsetLeft, y0 = el.offsetTop, px = ev.clientX, py = ev.clientY;
      const mv = e => this.moveWin(el, x0 + e.clientX - px, y0 + e.clientY - py);
      const up = () => { hd.removeEventListener('pointermove', mv); hd.removeEventListener('pointerup', up); hd.removeEventListener('pointercancel', up); this.rememberPos(el); };
      hd.addEventListener('pointermove', mv); hd.addEventListener('pointerup', up); hd.addEventListener('pointercancel', up);
    });
  },
  rememberPos(el) {
    const n = el.dataset.win; if (!n) return;
    const wp = { ...(uiPref('winPos') || {}) }; wp[n] = { x: +(el.offsetLeft / dom.clientWidth).toFixed(4), y: +(el.offsetTop / dom.clientHeight).toFixed(4) };
    setPref('winPos', wp);
  },
  /* ---- 提示框：内容可以是 html 字符串 / DOM / 返回它们的函数 ---- */
  showTip(content, ev) {
    if (typeof content === 'function') content = content();
    if (content == null || content === '') { this.hideTip(); return; }
    if (!this.tip) { this.tip = h('div', { id: 'tip' }); dom.appendChild(this.tip); }
    if (content instanceof Node) this.tip.replaceChildren(content); else this.tip.innerHTML = content;
    this.tip.classList.remove('hidden');
    const r = stage.getBoundingClientRect(), x = ev.clientX - r.left + 16, y = ev.clientY - r.top + 12;
    const tw = this.tip.offsetWidth, th = this.tip.offsetHeight;
    this.tip.style.left = Math.max(4, Math.min(x, r.width - tw - 8)) + 'px'; this.tip.style.top = Math.max(4, Math.min(y, r.height - th - 8)) + 'px';
  },
  hideTip() { if (this.tip) this.tip.classList.add('hidden'); },
  tipOn(el, content) {
    el.addEventListener('mousemove', ev => { if (typeof dnd !== 'undefined' && dnd.cur) return; if (ev.sourceCapabilities && ev.sourceCapabilities.firesTouchEvents) return; this.showTip(content, ev); });
    el.addEventListener('mouseleave', () => this.hideTip());
    let tm = 0;   // 触屏：长按 0.4 秒显示，松手 1.5 秒后收起
    el.addEventListener('pointerdown', ev => { if (ev.pointerType !== 'touch') return; clearTimeout(tm); const e0 = { clientX: ev.clientX, clientY: ev.clientY - 60 }; tm = setTimeout(() => { el._tipT = Date.now(); this.showTip(content, e0); }, 400); });
    const end = () => { clearTimeout(tm); if (el._tipT) { el._tipT = 0; setTimeout(() => this.hideTip(), 1500); } };
    el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
    return el;
  },
  /* ---- 通用确认框：menus.ask({ title, text, ok(v), cancel(), okText, cancelText, danger, input: { placeholder, value, max, check(v) → 错误文字|null } }) ---- */
  ask(o) {
    if (this.isOpen('ask')) this.close('ask');
    this._ask = o; this.open('ask');
    const f = this.wins.ask && this.wins.ask.querySelector('input'); if (f) setTimeout(() => { f.focus(); f.select(); }, 30);
  },
  w_ask() {
    const o = this._ask || {}, I = o.input;
    const err = h('div', { class: 'askerr' });
    const field = I ? h('input', { class: 'txt', type: 'text', placeholder: I.placeholder || '', maxlength: I.max || 24, autocomplete: 'off', spellcheck: 'false' }) : null;
    const go = () => {
      const v = field ? field.value.trim() : true, msg = I && I.check ? I.check(v) : null;
      if (msg) { err.textContent = msg; sfx.error(); if (field) field.focus(); return; }
      this._askNo = null; this.close('ask'); sfx.click(); if (o.ok) o.ok(v);
    };
    const no = () => { this._askNo = null; this.close('ask'); sfx.click(); if (o.cancel) o.cancel(); };
    this._askNo = no;
    if (field) {
      if (I.value) field.value = I.value;
      field.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); go(); } else if (e.key === 'Escape') { e.preventDefault(); no(); } });
      field.addEventListener('input', () => { err.textContent = ''; });
    }
    const txt = h('div', { class: 'asktxt' }); if (o.text instanceof Node) txt.append(o.text); else txt.innerHTML = o.text || '';   // 字符串按 html 处理：玩家输入的内容请先 escHtml
    const body = h('div', { class: 'col askbd' }, txt, field, err,
      h('div', { class: 'row', style: 'justify-content:flex-end;margin-top:.4em' }, h('button', { class: 'btn' + (o.danger ? ' red' : ''), onclick: go }, o.okText || '确定'), h('button', { class: 'btn blue', onclick: no }, o.cancelText || '取消')));
    const el = this.win(o.title || '确认', body, { block: true, onClose: no, drag: false });
    el.classList.add('askwin'); el._onConfirm = go;
    return el;
  },
  /* ---------------- 地下城选择 / 结算（背包、商店、强化等物品窗口在 ui/items/*） ---------------- */
  w_dungeon(arg = {}) {
    // 从区域地图的门口进入：只显示这一个地下城（官方做法）；arg.dungeon 缺省时显示当前场景的全部门
    const S = SCENES[arg.scene || (world && world.S.id)] || {}, ids = arg.dungeon ? [arg.dungeon] : (S.gates || []).filter(gateVisible).map(g => g.dungeon);
    let sel = DUNGEONS[ids.includes(this.dgSel) ? this.dgSel : ids[0]];
    if (!sel) return null;
    let diff = Math.min(this.dgDiff ?? 0, save.data.unlocked[sel.id] || 0);
    const body = h('div', { class: 'row', style: 'align-items:stretch;gap:1em' });
    const detail = h('div', { class: 'col', style: 'width:26em' });
    const render = () => {
      this.dgSel = sel.id; this.dgDiff = diff;
      if (listEl) listEl.querySelectorAll('.dgi').forEach(e => e.classList.toggle('sel', e.dataset.id === sel.id));
      const un = save.data.unlocked[sel.id] || 0, best = save.data.best[sel.id + ':' + diff], low = game.lvl < sel.lvl[0] - 2;
      detail.replaceChildren(...[
        h('div', { style: 'font-size:1.6em;font-weight:900;color:#ffe8a8' }, sel.name, sel.hidden ? h('span', { class: 'small', style: 'color:#e0a0ff;margin-left:.6em' }, '隐藏地下城') : null),
        h('div', { class: 'dim small' }, `推荐等级 Lv.${sel.lvl[0]}~${sel.lvl[1]} · 领主：${MON[sel.boss.kind].name}（Lv.${sel.boss.lvl}）· 房间 ${sel.rooms}（最少消耗疲劳 ${sel.rooms}）`),
        h('div', { style: 'line-height:1.6;min-height:4.5em' }, sel.desc),
        low ? h('div', { class: 'small', style: 'color:#ff9a8a' }, `等级偏低（当前 Lv.${game.lvl}），怪物会非常强，建议先去前面的地下城练级`) : null,
        h('div', { class: 'diffs' }, DIFFS.map((D, i) => h('div', { class: 'diff' + (i === diff ? ' sel' : '') + (i > un ? ' lock' : ''), style: `color:${D.col}`, onclick: () => { if (i > un) { sfx.error(); return; } diff = i; sfx.click(); render(); } }, D.name, i > un ? h('div', { class: 'small dim' }, '🔒') : null))),
        h('div', { class: 'small dim' }, un < 3 ? `解锁下一难度：${['通关普通', '冒险难度评价 B 以上', '勇士难度评价 S 以上'][un]}` : '已解锁全部难度'),
        h('div', { class: 'row' }, h('span', {}, '最佳评价：'), h('b', { style: `color:${best ? RANK_COL[best] : '#777'};font-size:1.4em` }, best || '—'), h('span', { class: 'sp' }), h('span', { class: 'small' }, `疲劳 ${save.data.fatigue}/${typeof fatigueMax === 'function' ? fatigueMax() : FATIGUE_MAX}`)),
        h('div', { class: 'row' }, h('button', { class: 'btn big' + (save.data.fatigue < sel.rooms ? ' off' : ''), onclick: () => { sfx.click(); if (enterDungeon(sel.id, diff)) this.close('dungeon'); } }, '进入地下城'), h('button', { class: 'btn', onclick: () => { sfx.click(); this.close('dungeon'); } }, '取消')),
      ].filter(Boolean));
    };
    const listEl = ids.length > 1 ? h('div', { class: 'dglist' }, ids.map(id => { const d = DUNGEONS[id]; return h('div', { class: 'dgi', 'data-id': d.id, onclick: () => { sel = d; diff = Math.min(diff, save.data.unlocked[d.id] || 0); sfx.click(); render(); } }, h('b', {}, d.name), h('small', {}, `Lv.${d.lvl[0]}~${d.lvl[1]}`)); })) : null;
    if (listEl) body.append(listEl); body.append(detail); render();
    return this.win(S.name && S.name !== sel.name ? `${S.name} · ${sel.name}` : sel.name, body, { w: listEl ? 44 : 32 });
  },

  /* ---------------- 结算 + 翻牌 ---------------- */
  w_result(dg) {
    const R = dg.result, col = RANK_COL[R.rank];
    const lvCost = 400 + game.lvl * 150;
    const reward = gold => rollCardReward(dg, gold);   // 掉落表统一在 drops.js
    const freeCount = typeof vipActive === 'function' && vipActive() ? 3 : 2;
    const rewards = Array.from({ length: freeCount + 2 }, (_, i) => reward(i >= freeCount));
    let freePicked = false;
    const give = (rw) => { if (rw.gold) { game.gold += rw.gold; sfx.coin(); } else if (!giveItem(rw.item)) { /* 已自动出售 */ } else if ((rw.item.rar || 0) >= 5) sfx.epic(); save.write(); };
    const faceOf = (rw) => rw.gold ? [h('div', { style: 'font-size:2.2em' }, '💰'), h('b', { class: 'gold' }, `${fmtNum(rw.gold)} G`)] : [h('img', { src: itemIconURL(rw.item) }), h('b', { class: `r${rw.item.rar || 0}`, style: 'font-size:.85em' }, (rw.item.n > 1 ? rw.item.n + '× ' : '') + rw.item.name)];
    const cardEls = rewards.map((rw, i) => {
      const gold = i >= freeCount;
      const c = h('div', { class: 'card' + (gold ? ' goldc' : '') }, h('div', { class: 'in' }, h('div', { class: 'b' }, gold ? '★' : '?', gold ? h('div', { style: 'font-size:.35em' }, `${fmtNum(lvCost)} G`) : null), h('div', { class: 'f' }, ...faceOf(rw))));
      c.addEventListener('click', () => {
        if (c.classList.contains('flip')) return;
        if (!gold) {
          if (freePicked) return; freePicked = true; dg.result.freeCard = i; dg.result.cards.push({ kind: 'free', index: i, reward: rw }); dg.flipStage = 'revealed'; c.classList.add('flip'); sfx.card(); give(rw);
          const other = cardEls.find((x, j) => j < freeCount && j !== i); if (other) setTimeout(() => { other.classList.add('flip', 'used'); other.style.opacity = 0.55; }, 600);
          btns.classList.remove('hidden'); goldHint.classList.remove('hidden');
        } else {
          if (!freePicked) { toastMsg('先从上排选择一张免费卡牌'); sfx.error(); return; }
          if (game.gold < lvCost) { toastMsg('金币不足'); sfx.error(); return; }
          game.gold -= lvCost; dg.result.goldCards.push(i); c.classList.add('flip', 'used'); sfx.card(); give(rw);
        }
      });
      return c;
    });
    const goldHint = h('div', { class: 'cardlbl hidden' }, `下排为黄金卡牌，每张 ${fmtNum(lvCost)} G`);
    const btns = h('div', { class: 'row hidden', style: 'margin-top:.8em' },
      h('button', { class: 'btn big', onclick: () => { if (!freePicked) return; sfx.click(); dg.finishFlip(); this.close('result'); lootAll(); const id = dg.def.id, d = dg.diff; if (!enterDungeon(id, d)) goTown(); } }, '再次挑战'),
      h('button', { class: 'btn big blue', onclick: () => { if (!freePicked) return; sfx.click(); dg.finishFlip(); this.close('result'); lootAll(); goTown(); } }, '返回城镇'));
    const el = h('div', { id: 'result' },
      h('div', { class: 'ttl' }, 'DUNGEON CLEAR!'),
      h('div', { class: 'dim' }, `${dg.def.name} · ${dg.D.name} · 用时 ${Math.floor(R.time / 60)}分${Math.floor(R.time % 60)}秒`),
      h('div', { class: 'rank', style: `color:${col}` }, R.rank),
      h('div', { class: 'line' }, h('span', {}, '操作 ', h('b', {}, R.S.ops)), h('span', {}, '技巧 ', h('b', {}, R.S.tech)), h('span', {}, '被击 ', h('b', { style: 'color:#ff8a8a' }, dg.hurt)), h('span', {}, '最高连击 ', h('b', {}, game.maxCombo))),
      h('div', { class: 'line' }, h('span', {}, '击杀经验 ', h('b', {}, fmtNum(dg.expGot))), h('span', {}, '通关经验 ', h('b', {}, fmtNum(R.clearExp))), h('span', {}, '评价加成 ', h('b', {}, `+${fmtNum(R.bonus)}`))),
      h('div', { class: 'cardlbl' }, '选择一张卡牌'),
      h('div', { class: 'cards' }, cardEls), goldHint, btns);
    game.paused = true;
    setTimeout(() => sfx.clear(), 200);
    return el;
  },

  /* ---------------- 系统菜单（Esc） ---------------- */
  w_system() {
    const town = game.scene === 'town', dg = game.scene === 'dungeon';
    const B = (label, cls, fn, hint) => h('button', { class: 'btn' + (cls ? ' ' + cls : ''), onclick: () => { sfx.click(); fn(); } }, label, hint ? h('span', { class: 'kbd' }, hint) : null);
    const body = h('div', { class: 'col sysmenu' },
      B('继续游戏', 'big', () => this.close('system'), 'Esc'),
      B('游戏设置', '', () => { this.close('system'); this.show('settings'); }, keyName('settings')),
      B('操作说明', '', () => { this.close('system'); this.show('help'); }),
      B('全屏切换', '', () => { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen().catch(() => {}); }),
      B('截图', '', () => { this.close('system'); setTimeout(takeScreenshot, 60); }, keyName('shot')),
      dg ? B('放弃并返回城镇', 'red', () => { this.close('system'); game.paused = false; if (game.dungeon && game.dungeon.state === 'dead') { game.dungeon.fail(); return; } lootAll(); goTown(); }) : null,
      game.duel ? B('离开决斗场，回到城镇', 'blue', () => { this.close('system'); location.href = location.pathname + '?resume' + (PARAMS.has('mute') ? '&mute' : ''); }) : null,
      B('返回角色选择', 'blue' + (town ? '' : ' off'), () => backToCharSelect()),
      dg ? h('div', { class: 'small dim', style: 'text-align:center' }, '地下城里不能切换角色，请先返回城镇') : null,
      B('返回标题画面', '', () => { save.write(); this.close('system'); location.href = location.pathname + (PARAMS.has('mute') ? '?mute' : ''); }));
    return this.win('系统菜单', body, { w: 20 });
  },
  /* ---------------- 操作说明（按当前键位生成） ---------------- */
  w_help() {
    const cls = game.player ? game.player.cls : 'sword', C = CLASSES[cls] || CLASSES.sword;
    const K = a => keyName(a, true);
    const cmds = (C.cmds || []).filter(c => SKILLS[c[1]] && (!SKILLS[c[1]].job || SKILLS[c[1]].job === game.job) && (game.skillLv[c[1]] || 0) > 0)
      .map(([seq, id, key]) => `${typeof cmdTextOf === 'function' ? cmdTextOf(id) : (seq === '' ? '' : cmdText(seq) + '+') + keyName({ attack: 'attack', buff: 'cmdB', jump: 'jump' }[key] || 'cmd')}：${SKILLS[id].name}`).join('　') || '（学会技能后，这里会列出可以用指令释放的技能）';
    const row = (k, t) => [h('b', {}, k), h('span', {}, t)];
    const sec = t => h('div', { class: 'helpsec' }, t);
    const body = h('div', { class: 'help' },
      sec('移动与战斗'),
      row(`${K('left')} ${K('right')} ${K('up')} ${K('down')}`, '移动（↑↓ 在纵深方向移动），快速双击 ←/→ 奔跑'),
      row(K('attack'), '普通攻击（连按出连段）／奔跑中攻击 = 冲刺攻击／站在物品上拾取'),
      row(K('jump'), '跳跃（空中按攻击 = 跳跃攻击）；↓ + 跳跃 = 后跳（普攻中随时可以后跳）；倒地后按跳跃 = 受身蹲伏（蹲着时无敌，按住可以多蹲一会、慢慢挪，松开起身；冷却 5 秒，决斗场 20 秒）'),
      row(`↓ + ${K('jump')}`, '后跳-强化（10 级通用技能）：放技能时（觉醒除外）强制后跳，冷却 40 秒；被打中 / 倒地时后跳脱身，冷却 30 秒；两种共用冷却'),
      row(`方向 + ${K('cmd')} / ${K('cmdB')}`, cmds),
      row(`${['s0', 's1', 's2', 's3', 's4', 's5', 's12'].map(a => keyName(a)).join(' ')} / ${['s6', 's7', 's8', 's9', 's10', 's11', 's13'].map(a => keyName(a)).join(' ')}`, '两排技能栏，每排 7 格（在技能窗口把技能图标拖到屏幕下方的技能栏）'),
      row(['i0', 'i1', 'i2', 'i3', 'i4', 'i5'].map(a => keyName(a)).join(' '), '消耗品快捷栏（药剂等，从物品栏拖进去）'),
      sec('界面快捷键'),
      row(K('inv'), '物品栏'), row(K('status'), '个人信息'), row(K('skills'), '技能（右键技能图标可以锁定 / 解锁指令释放）'),
      row(K('quests'), '任务'), row(K('map'), '地图'), row(K('settings'), '游戏设置（音量、画面、按键设置、手机按钮）'),
      row('Esc', '关闭最上层窗口；没有窗口时打开系统菜单'),
      row(K('uiMode'), '切换界面显示（完整 / 简洁）'), row(K('dropNames'), '显示 / 隐藏地面掉落物名称'), row(K('hideRank'), '隐藏右下角实时评价'),
      row(K('tipDetail'), '技能 / 装备说明 详细 ↔ 简略'), row(K('shot'), '截图（保存为图片）'),
      row('鼠标', '城镇里点击 NPC 对话；窗口按标题栏拖动，点击置顶；技能图标、消耗品可以拖到屏幕下方的快捷栏，拖出或右键清空'),
      sec('技巧'),
      row('躲避', '领主头顶出现红色“!”是霸体重招，赶紧后跳或拉开距离；地上的黄圈 / 红色六芒星 / 冲撞路线是预警；地震、陨石、爆炸这类地面攻击可以跳起来躲；4 秒没挨打会自动回血。'),
      row('连招', '攻击类技能可以随时取消普攻（Buff 类不行），技能之间只有特定的衔接能互相取消；打断正在出招的敌人触发 COUNTER（伤害 ×1.25）；从背后攻击触发 BACK ATTACK；把敌人挑到空中连击可以提高评价。'));
    return this.win('操作说明', body, { w: 56 });
  },
};
const cmdText = seq => seq === '' ? '' : seq === 'hold' ? '按住→' : seq.split('').map(ch => ({ f: '→', b: '←', d: '↓', u: '↑' })[ch]).join('');
const skillCost = (S, lv) => Math.round((S.spBase || (S.awaken ? 120 : 20)) * (1 + lv * 0.25));
function applyVolumes() { if (!sfx.ctx) return; sfx.bus.gain.value = uiPref('sfx'); sfx.mus.gain.value = uiPref('music'); }
function lootAll() { let n = 0; for (const d of drops) { if (d.kind === 'gold') { game.gold += d.amount; n++; } else { giveItem(d.item); n++; } } drops.length = 0; if (n) toastMsg(`自动拾取了 ${n} 件掉落物`, '#ffe8a8'); }
/* ---- 截图（F12）：把世界层和 HUD 层合成一张 PNG 下载 ---- */
function takeScreenshot() {
  try {
    const cv = document.createElement('canvas'); cv.width = ucan.width; cv.height = ucan.height;
    const c = cv.getContext('2d'); c.drawImage(wcan, 0, 0, cv.width, cv.height); c.drawImage(ucan, 0, 0);
    const d = new Date(), p2 = n => String(n).padStart(2, '0');
    const a = h('a', { href: cv.toDataURL('image/png'), download: `破晓地下城_${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}_${p2(d.getHours())}${p2(d.getMinutes())}${p2(d.getSeconds())}.png` });
    document.body.appendChild(a); a.click(); a.remove();
    cam.flash = Math.max(cam.flash, 0.08); cam.flashCol = '#fff'; sfx.click(); toastMsg('截图已保存', '#bfe8ff');
    menus.lastShot = a.download;
  } catch (e) { toastMsg('截图失败', '#ff6a6a'); }
}
/* ---- 界面快捷键：按 KEYMAP 查动作 → 打开窗口 / 切换选项。窗口还没实现时提示“暂未开放” ---- */
function uiKey(a) {
  if (a === 'shot') { takeScreenshot(); return; }
  const top = menus.top();
  if (a === 'confirm') { const el = top && menus.wins[top]; if (el && el._onConfirm) el._onConfirm(); return; }
  if (top === 'ask') { if (a === 'menu') menus.closeTop(); return; }
  if (game.scene === 'title' || !game.player) {   // 标题 / 选角：只有 Esc 和设置
    if (a === 'menu') { if (top) { menus.closeTop(); sfx.click(); } } else if (a === 'settings') { menus.open('settings'); sfx.open(); }   // 加载中（没有窗口）按 Esc 不弹系统菜单
    return;
  }
  if (menus.isOpen('result')) return;
  if (a === 'menu') { menus.closeTop(); sfx.click(); return; }
  let w = UI_WIN[a];
  if (w) {
    if (typeof menus['w_' + w] !== 'function') { toastMsg(`${ACTION_NAME[a]}：暂未开放`, '#ffd0a0'); sfx.error(); return; }
    const was = menus.isOpen(w); menus.open(w); if (was) sfx.click(); else sfx.open();
    return;
  }
  const flip = (k, on, off) => { setPref(k, !uiPref(k)); toastMsg(uiPref(k) ? on : off, '#bfe8ff', 'log'); sfx.click(); };   // 设置切换只记到系统消息，不用大横幅盖住画面
  if (a === 'uiMode') { setPref('hudMode', uiPref('hudMode') === 'full' ? 'lite' : 'full'); toastMsg(uiPref('hudMode') === 'full' ? '界面：完整显示' : '界面：简洁显示', '#bfe8ff', 'log'); sfx.click(); }
  else if (a === 'dropNames') flip('dropNames', '显示掉落物名称', '隐藏掉落物名称');
  else if (a === 'hideRank') flip('hideRank', '隐藏实时评价', '显示实时评价');
  else if (a === 'tipDetail') flip('tipDetail', '说明：详细', '说明：简略');
}
// 兼容旧调用（触屏按钮等）：按键码触发界面动作
function menuKey(code) { const a = actionsOf(code).find(x => UI_ACTIONS.has(x)) || { Escape: 'menu', KeyI: 'inv', KeyK: 'skills', KeyM: 'status' }[code]; if (a) uiKey(a); }
// 修饰键（Ctrl / Shift / Alt / Cmd）绑定的界面动作：单独按下再松开才算，和别的键一起按（Mac 截图 Ctrl+Shift+Cmd+4、复制粘贴等）不触发
const MOD_KEY = /^(Control|Shift|Alt|Meta)(Left|Right)$/;
let modSolo = null;
addEventListener('keydown', e => {
  if (e.repeat || isTyping() || menus.capturing) return;
  if (MOD_KEY.test(e.code)) {
    const combo = (e.metaKey && !e.code.startsWith('Meta')) || (e.ctrlKey && !e.code.startsWith('Control')) || (e.shiftKey && !e.code.startsWith('Shift')) || (e.altKey && !e.code.startsWith('Alt'));
    modSolo = combo ? null : e.code; return;
  }
  modSolo = null;
  for (const a of actionsOf(e.code)) if (UI_ACTIONS.has(a)) { uiKey(a); break; }
});
addEventListener('keyup', e => {
  if (e.code !== modSolo) return; modSolo = null;
  if (isTyping() || menus.capturing) return;
  for (const a of actionsOf(e.code)) if (UI_ACTIONS.has(a)) { uiKey(a); break; }
});
addEventListener('blur', () => { modSolo = null; });
// 窗口里的右键不弹浏览器菜单（右键是游戏操作：锁定指令、清空快捷栏等）
dom.addEventListener('contextmenu', ev => { if (!ev.target.closest('input, textarea')) ev.preventDefault(); });
