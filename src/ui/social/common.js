/* =====================================================================
   社交窗口公共部分：样式、窗口外框（异步加载）、社交按钮条（屏幕左侧、任务指引下方竖排：签到 / 邮件 / 拍卖行 / 排行榜 / 管理）、
   NPC 功能（auction 拍卖行、mail 邮箱，挂在赫顿玛尔中央广场的诺顿身上）、拍卖行快捷键 B
   只在登录后出现（socialOn()）；单机模式下按钮条隐藏，NPC 按钮不显示，快捷键只提示“登录后可用”
   ===================================================================== */
addStyle(`
.sxw .bd{padding:.55em .75em .7em}
.sxw .sxbody{display:flex;flex-direction:column;gap:.45em;min-height:0}
.sxw .sxload{color:#8a806e;padding:1.2em;text-align:center}
.sxw .sxerr{color:#ff8a7a;padding:.6em;text-align:center}
.sxw input.sxi,.sxw select.sxi,.sxw textarea.sxi{background:#0c0a10;color:#fff;border:.1em solid #6a5436;border-radius:.2em;padding:.22em .4em;font-family:inherit;font-size:.92em;min-width:0}
.sxw textarea.sxi{resize:none;line-height:1.5}
.sxw select.sxi option{background:#1a1420}
.sxw .sxtbl{width:100%;border-collapse:collapse;font-size:.88em}
.sxw .sxtbl th{position:sticky;top:0;background:#241c2a;color:#c8a870;font-weight:800;text-align:left;padding:.3em .4em;border-bottom:.1em solid #4a3c2c;z-index:1;white-space:nowrap}
.sxw .sxtbl td{padding:.25em .4em;border-bottom:.06em solid #2a2230;vertical-align:middle}
.sxw .sxtbl tr.me td{background:rgba(255,210,60,.12)}
.sxw .sxtbl tr:hover td{background:rgba(120,90,40,.18)}
.sxw .sxtbl .num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
.sxw .sxscroll{overflow:auto;min-height:0;background:#0b090e;border:.1em solid #3a3040;border-radius:.25em}
.sxw .sxpager{display:flex;gap:.4em;align-items:center;justify-content:center;font-size:.88em}
.sxw .sxbox{background:rgba(0,0,0,.25);border:.08em solid #3a3040;border-radius:.3em;padding:.5em .6em}
.sxw .sxlbl{font-size:.78em;color:#c8a870;font-weight:900}
.sxw .sxchips{display:flex;flex-wrap:wrap;gap:.25em}
.sxw .sxchip{padding:.18em .6em;border-radius:1em;border:.08em solid #4a3c2c;background:#18121e;color:#b8a888;font-size:.84em;font-weight:800;cursor:pointer;white-space:nowrap}
.sxw .sxchip:hover{color:#fff2d0}.sxw .sxchip.on{border-color:#e8c26a;color:#ffe8a8;background:linear-gradient(#5a4222,#2a1c0e)}
.sxw .islot.sm{width:2.4em;height:2.4em}
.sxw .gold{color:#ffd24a}
.sxw .cera{color:#8fe8ff}
.sxw .rank1{color:#ffd23a;font-weight:900}.sxw .rank2{color:#d8e4f0;font-weight:900}.sxw .rank3{color:#e8a060;font-weight:900}
/* 屏幕左侧的社交按钮条（任务指引 #qguide 在它上面） */
#sxbar{position:absolute;left:calc(var(--u) * 14px);top:calc(var(--u) * 168px);display:flex;flex-direction:column;gap:calc(var(--u) * 6px);z-index:1}
#sxbar button{position:relative;width:calc(var(--u) * 118px);height:calc(var(--u) * 46px);padding:0 .5em;border:.08em solid #6a5436;border-radius:.3em;background:linear-gradient(#3a2e22,#1a130d);color:#f0dcb0;font-family:inherit;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:.3em;box-shadow:inset 0 .06em 0 rgba(255,230,170,.25),0 .1em .25em rgba(0,0,0,.6);font-weight:900;font-size:.95em;letter-spacing:.04em}
#sxbar button[hidden]{display:none}
#sxbar.dg button:not(.mailb){display:none}#sxbar.dg{top:calc(var(--u) * 120px)}
#sxbar button:hover{border-color:#e8c26a;color:#fff6d8;background:linear-gradient(#5a4428,#2a1d10)}
#sxbar button.on{border-color:#ffd23a;background:linear-gradient(#6a4e26,#2e2010)}
#sxbar button.hot{border-color:#ffd23a;color:#fff6c0;animation:sxhot 1.1s ease-in-out infinite alternate}
@keyframes sxhot{from{box-shadow:0 0 .2em rgba(255,210,60,.3),inset 0 .06em 0 rgba(255,230,170,.25)}to{box-shadow:0 0 1em rgba(255,210,60,.85),inset 0 .06em 0 rgba(255,230,170,.35)}}
#sxbar kbd{font-family:inherit;font-size:.72em;color:#ffd23a;background:rgba(0,0,0,.45);border-radius:.2em;padding:0 .3em}
#sxbar .badge{position:absolute;right:-.45em;top:-.45em;min-width:1.35em;height:1.35em;padding:0 .3em;border-radius:1em;background:#e0302a;color:#fff;font-size:.72em;line-height:1.35em;text-align:center;box-shadow:0 0 .3em #000}
#sxbar svg{width:1.3em;height:1em;flex:none}
#sxbar button.hot svg{animation:sxenv .6s ease-in-out infinite alternate}
@keyframes sxenv{to{transform:translateY(-.15em) rotate(-6deg)}}
`);
// 社交窗口外框：先显示“加载中”，数据到了再画；el._reload() 重新拉数据，el._render() 只重画
function sxWin(name, title, { load, render, w, at }) {
  const el = itemWin(name, title, el => {
    if (el._err) return h('div', { class: 'sxerr' }, el._err, h('div', { style: 'margin-top:.6em' }, h('button', { class: 'btn sm', onclick: () => el._reload() }, '重试')));
    if (el._data === undefined) return h('div', { class: 'sxload' }, '加载中……');
    return render(el, el._data);
  }, { w, at });
  el.classList.add('sxw');
  el._reload = async () => {
    const seq = el._seq = (el._seq || 0) + 1;
    try { const d = await load(el); if (seq !== el._seq || !el.isConnected) return; el._data = d; el._err = null; }
    catch (e) { if (seq !== el._seq || !el.isConnected) return; el._err = sxErrText(e); }
    el._render();
  };
  if (load) el._reload(); else { el._data = null; el._render(); }
  return el;
}
// 窗口在没登录时：不打开，提示“登录后可用”
function sxGate(label) {
  if (socialOn()) return true;
  toastMsg(`${label}：登录后可用`, '#ffd0a0'); sfx.error(); return false;
}
// 输入框：打字时不触发游戏快捷键；Esc 只是失去焦点
function sxInput(attrs = {}, tag = 'input') { const el = h(tag, { class: 'sxi', ...attrs }); el.addEventListener('keydown', ev => { ev.stopPropagation(); if (ev.key === 'Escape') el.blur(); }); return el; }
const sxDate = t => { const d = new Date(t), p = n => String(n).padStart(2, '0'); return `${d.getMonth() + 1}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`; };
const sxLeft = ms => { if (ms <= 0) return '已到期'; const m = Math.ceil(ms / 60000); return m >= 60 ? `${Math.floor(m / 60)} 小时${m % 60 ? ` ${m % 60} 分` : ''}` : `${m} 分钟`; };
// 附件 / 奖励条目 → 物品格子（{ key, n, opt } 用物品库生成预览，{ item } 直接显示）
function sxEntrySlot(e, opt = {}) {
  let it = null;
  if (e.item) it = normalizeItem(JSON.parse(JSON.stringify(e.item)));
  else if (ITEMS[e.key]) { it = makeItem(e.key, ITEMS[e.key].kind === 'equip' ? 1 : e.n || 1, e.opt || {}); if (it && ITEMS[e.key].kind === 'equip' && e.n > 1) it.n = e.n; }
  if (!it) { const el = itemSlot(null, { label: e.key }); el.title = `未知物品：${e.key}（请刷新页面更新游戏）`; return el; }
  const el = itemSlot(it, { cmp: false, ...opt });
  if (opt.sm) el.classList.add('sm');
  return el;
}
// 物品名（HTML，名字来自其他玩家，先转义）
const sxItemHtml = it => `<span class="q${(it.rar | 0)}">${escHtml(`${it.enh ? '+' + (it.enh | 0) + ' ' : ''}${it.name || ''}${it.n > 1 ? ' ×' + (it.n | 0) : ''}`)}</span>`;
// 金币 / 点券 条目
const sxMoney = (gold, cera) => [gold ? h('span', { class: 'gold', style: 'font-weight:900' }, `${fmtNum(gold)} G`) : null, cera ? h('span', { class: 'cera', style: 'font-weight:900' }, `点券 ${fmtNum(cera)}`) : null].filter(Boolean);

/* ---- NPC 功能：拍卖行 / 邮箱（没登录时按钮不显示） ---- */
NPC_SERVICES.auction ??= { label: '拍卖行', show: () => socialOn(), run: () => menus.show('auction') };
NPC_SERVICES.mail ??= { label: '邮箱', show: () => socialOn(), run: () => menus.show('mail') };

/* ---- 快捷键（加进按键设置的“窗口”组，可以改键）：拍卖行 B、公会 J、成就 U ---- */
function sxAddKey(a, code, name, win = a) {
  KEYMAP_DEFAULT[a] = [code];
  if (!KEYMAP[a]) {
    KEYMAP[a] = [code];
    try { const k = (JSON.parse(localStorage.getItem(UI_PREF_KEY) || '{}').keys || {})[a]; if (Array.isArray(k)) KEYMAP[a] = k.filter(c => typeof c === 'string').slice(0, 2); } catch (e) { /* 用默认键 */ }
    for (const b in KEYMAP) if (b !== a && KEYMAP[a].some(c => KEYMAP[b].includes(c))) KEYMAP[a] = KEYMAP[a].filter(c => !KEYMAP[b].includes(c));   // 被别的动作占用了就让出来
  }
  ACTION_NAME[a] = name;
  const g = KEY_GROUPS.find(x => x[0] === '窗口'); if (g && !g[1].includes(a)) g[1].push(a);
  UI_WIN[a] = win; UI_ACTIONS.add(a);
  if (typeof MB_WIN !== 'undefined') MB_WIN[a] = win;
}
sxAddKey('auction', 'KeyB', '拍卖行');
sxAddKey('guild', 'KeyJ', '公会');

/* ---- 屏幕左侧的社交按钮条 ---- */
const SX_BAR = [
  ['friends', '好友'], ['signin', '签到'], ['mail', '邮件'], ['guild', '公会'], ['auction', '拍卖行'], ['rank', '排行榜'], ['gm', '管理'],
];
const SX_ENV_SVG = '<svg viewBox="0 0 24 18"><rect x="1" y="1" width="22" height="16" rx="2" fill="#f4e6c0" stroke="#3a2a1a" stroke-width="1.6"/><path d="M1.8 2.4 12 10.2 22.2 2.4" fill="none" stroke="#a0302a" stroke-width="1.8"/></svg>';
const sxbar = {
  el: null, btns: {}, t: 0,
  build() {
    this.el = h('div', { id: 'sxbar', hidden: '' });
    for (const [w, name] of SX_BAR) {
      const b = h('button', { title: name, onclick: e => { e.currentTarget.blur(); sfx.click(); menus.open(w); } });
      if (w === 'mail') { b.innerHTML = SX_ENV_SVG; b.classList.add('mailb'); }
      b.append(h('span', {}, name));
      if (w === 'auction' || w === 'guild') { b._kb = h('kbd', {}, ''); b.append(b._kb); }
      b._badge = h('span', { class: 'badge', hidden: '' }); b.append(b._badge);
      this.btns[w] = b; this.el.append(b);
    }
    dom.prepend(this.el);
  },
  tick() {
    if (!this.el) this.build();
    // 城镇：整条社交按钮；地下城里只在有新邮件 / 待领取附件时显示信封（点开会暂停游戏）
    const dg = game.scene === 'dungeon', show = socialOn() && ui.panelOn() && !game.duel && (game.scene === 'town' || (dg && SX.unread + SX.pending > 0));
    if (this.el.hidden === show) this.el.hidden = !show;
    if (this.el.classList.contains('dg') !== dg) this.el.classList.toggle('dg', dg);
    if (!show) return;
    const now = performance.now();
    if (now - SX.pollAt > 90000) { SX.pollAt = now; sxMailCounts(); }   // 兜底轮询（新邮件平时靠 WS 推送）
    if (now - this.t < 500) return; this.t = now;
    const B = this.btns;
    B.gm.hidden = !sxAdmin();
    if (B.friends && typeof netFriends !== 'undefined') { const n = (netFriends.incoming || []).length; B.friends._badge.hidden = !n; B.friends._badge.textContent = n ? String(n) : ''; B.friends.title = n ? `好友（${n} 个好友申请待处理）` : '好友：加好友、查看在线好友'; }   // 有好友申请时亮红点
    if (B.auction._kb) B.auction._kb.textContent = keyName('auction');
    const n = SX.unread + (SX.unread ? 0 : SX.pending);
    B.mail._badge.hidden = !n; B.mail._badge.textContent = n > 99 ? '99+' : String(n);
    B.mail.classList.toggle('hot', SX.unread > 0);
    B.signin.classList.toggle('hot', !SX.signed);
    const gd = typeof GD !== 'undefined' && GD.data, gn = gd ? (gd.guild ? (gd.reqs || []).length : (gd.invites || []).length) : 0;
    B.guild._badge.hidden = !gn; B.guild._badge.textContent = String(gn); B.guild.classList.toggle('hot', gn > 0);
    if (B.guild._kb) B.guild._kb.textContent = keyName('guild');
    for (const [w] of SX_BAR) B[w].classList.toggle('on', menus.isOpen(w));
  },
};
{ const draw0 = ui.draw; ui.draw = function () { draw0.apply(this, arguments); sxbar.tick(); }; }
