/* =====================================================================
   拖放（背包 ↔ 装备栏 ↔ 快捷栏 ↔ 仓库 ↔ 商店，技能窗口 → 技能栏）
   鼠标和触屏通用，不用 HTML5 原生拖放（原生拖放在画布和触屏上都不好用）
     dnd.source(el, () => payload, ghostSrc?)     让一个 DOM 元素可以被拖起；payload 如 { type: 'item', item, from: 'inv' }、{ type: 'skill', id }
     dnd.target(el, { accept(p), drop(p) })       让一个 DOM 元素接收拖放
     dnd.canvas(fn)                               画布上的落点（HUD 的快捷栏 / 技能栏是画在 ucan 上的）：fn(p, x, y)，x/y 为 UW×UH 逻辑坐标，返回 true 表示接住了
     拖到空处松手：调用 payload.onVoid?.()（比如把快捷栏里的东西拖走 = 清空这一格）
   ===================================================================== */
const dnd = {
  cur: null, canvasFns: [],
  source(el, getPayload, ghostSrc) {
    el.addEventListener('pointerdown', ev => {
      if (ev.button !== 0) return;
      const x0 = ev.clientX, y0 = ev.clientY;
      const move = e => { if (!this.cur && Math.hypot(e.clientX - x0, e.clientY - y0) > 6) { const p = getPayload(); if (p) this.begin(p, e, ghostSrc || (el.querySelector('img') || {}).src); } if (this.cur) this.moveTo(e); };
      const up = e => { removeEventListener('pointermove', move); removeEventListener('pointerup', up); if (this.cur) { this.end(e); el._dndJustDropped = true; setTimeout(() => { el._dndJustDropped = false; }, 0); } };
      addEventListener('pointermove', move); addEventListener('pointerup', up);
    });
  },
  target(el, t) { el._dnd = t; el.classList.add('dnd-target'); },
  canvas(fn) { this.canvasFns.push(fn); },
  begin(p, e, src) {
    this.cur = p; menus.hideTip && menus.hideTip();
    const g = this.ghost = h('div', { class: 'dnd-ghost' }, src ? h('img', { src }) : h('span', {}, p.label || ''));
    document.body.appendChild(g); document.body.classList.add('dnd-on'); this.moveTo(e);
  },
  moveTo(e) {
    this.ghost.style.left = e.clientX + 'px'; this.ghost.style.top = e.clientY + 'px';
    const t = this.hitTarget(e); document.querySelectorAll('.dnd-hot').forEach(x => x !== t && x.classList.remove('dnd-hot'));
    if (t) t.classList.add('dnd-hot');
  },
  hitTarget(e) {
    this.ghost.style.display = 'none'; let el = document.elementFromPoint(e.clientX, e.clientY); this.ghost.style.display = '';
    while (el && !el._dnd) el = el.parentElement;
    return el && el._dnd.accept(this.cur) ? el : null;
  },
  end(e) {
    const p = this.cur, t = this.hitTarget(e);
    this.ghost.remove(); this.ghost = null; this.cur = null; document.body.classList.remove('dnd-on');
    document.querySelectorAll('.dnd-hot').forEach(x => x.classList.remove('dnd-hot'));
    if (t) { t._dnd.drop(p); return; }
    const r = stage.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * UW, y = (e.clientY - r.top) / r.height * UH;   // HUD 画布（ucan）的逻辑坐标
    for (const fn of this.canvasFns) if (fn(p, x, y)) return;
    if (p.onVoid) p.onVoid();
  },
};
addStyle(`
.dnd-ghost{position:fixed;z-index:999;pointer-events:none;transform:translate(-50%,-50%);width:2.6em;height:2.6em;display:grid;place-items:center;opacity:.85;filter:drop-shadow(0 2px 6px #000)}
.dnd-ghost img{width:100%;height:100%;object-fit:contain}
body.dnd-on .dnd-target{outline:1px dashed #ffd23a55}
.dnd-hot{outline:2px solid #ffd23a !important;background:#ffd23a22 !important}
`);
