/* =====================================================================
   菜单按钮栏（官方式：屏幕右下角一排菜单按钮，每个按钮标出快捷键）
   点击 = 按对应快捷键（走同一个 uiKey 入口）；快捷键改了以后标注会跟着变。触屏模式下不显示（触屏有自己的按钮）
   ===================================================================== */
addStyle(`
#menubar{position:absolute;right:calc(var(--u) * 8px);bottom:calc(var(--u) * 6px);display:grid;grid-template-columns:repeat(3,calc(var(--u) * 86px));gap:calc(var(--u) * 4px);z-index:1}
#menubar button{height:calc(var(--u) * 58px);padding:0;border:.08em solid #6a5436;border-radius:.3em;background:linear-gradient(#3a2e22,#1a130d);color:#f0dcb0;font-family:inherit;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.05em;box-shadow:inset 0 .06em 0 rgba(255,230,170,.25),0 .1em .25em rgba(0,0,0,.6)}
#menubar button:hover{border-color:#e8c26a;color:#fff6d8;background:linear-gradient(#5a4428,#2a1d10)}
#menubar button.on{border-color:#ffd23a;background:linear-gradient(#6a4e26,#2e2010)}
#menubar b{font-size:1.02em;font-weight:900;letter-spacing:.05em}
#menubar kbd{font-family:inherit;font-size:.72em;font-weight:900;color:#ffd23a;background:rgba(0,0,0,.45);border-radius:.2em;padding:0 .3em;min-width:1.2em;text-align:center}
`);
const MENUBAR = [
  ['inv', '物品'], ['status', '个人'], ['skills', '技能'],
  ['quests', '任务'], ['map', '地图'], ['settings', '设置'],
  ['pvp', '决斗'], ['help', '说明'], ['menu', '菜单'],
];
const MB_WIN = { ...UI_WIN, help: 'help', menu: 'system' };
const menubar = {
  el: null, btns: {}, t: 0,
  build() {
    this.el = h('div', { id: 'menubar', hidden: '' });
    for (const [a, name] of MENUBAR) {
      const kb = h('kbd', {}, '');
      const b = h('button', { title: name, onclick: e => { e.currentTarget.blur(); this.click(a); } }, h('b', {}, name), kb);
      b._kb = kb; this.btns[a] = b; this.el.append(b);
    }
    dom.prepend(this.el);   // 放在最底层：窗口永远盖在它上面
  },
  click(a) {
    if (a === 'help') { const was = menus.isOpen('help'); menus.open('help'); if (!was) sfx.open(); return; }
    if (a === 'menu') { if (!menus.top()) { menus.open('system'); sfx.open(); } else { menus.closeTop(); sfx.click(); } return; }
    uiKey(a);
  },
  labels() { for (const [a] of MENUBAR) this.btns[a]._kb.textContent = a === 'help' ? '?' : keyName(a); },
  // 每帧由 ui.draw 调用：只在显示状态变化时改 DOM；标注和“已打开”高亮每 0.5 秒刷新一次
  tick() {
    if (!this.el) this.build();
    const show = ui.panelOn() && !(typeof touch !== 'undefined' && touch.on) && game.scene !== 'title' && !game.duel;
    if (this.el.hidden === show) this.el.hidden = !show;
    if (!show) return;
    const now = performance.now(); if (now - this.t < 500) return; this.t = now;
    this.labels();
    for (const [a] of MENUBAR) this.btns[a].classList.toggle('on', !!MB_WIN[a] && menus.isOpen(MB_WIN[a]));
  },
};
{ const draw0 = ui.draw; ui.draw = function () { draw0.apply(this, arguments); menubar.tick(); }; }
