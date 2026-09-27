/* =====================================================================
   全服公告条（官方式）：屏幕上方居中的暗色横条，金色文字从右向左滚动，多条排队依次播放；同时写进左下角系统消息
   DOM + CSS transform 动画（不在画布上逐帧绘制）。地下城里下移一点，避开领主血条
   noticeShow({ kind, text, item: { name, rar }, at }) —— 由 net/social.js 收到 WS 'notice:show' 时调用
   ===================================================================== */
addStyle(`
#sxnotice{position:absolute;left:22%;right:22%;top:calc(var(--u) * 22px);height:calc(var(--u) * 40px);overflow:hidden;pointer-events:none!important;z-index:5;
  background:linear-gradient(90deg,rgba(12,8,4,0),rgba(12,8,4,.78) 12%,rgba(12,8,4,.78) 88%,rgba(12,8,4,0));border-top:.08em solid rgba(232,194,106,.45);border-bottom:.08em solid rgba(232,194,106,.45)}
#sxnotice.dg{top:calc(var(--u) * 104px)}
#sxnotice .run{position:absolute;left:100%;top:0;height:100%;display:flex;align-items:center;white-space:nowrap;font-size:1.2em;font-weight:900;color:#ffe8a8;text-shadow:0 0 .2em #000,0 0 .2em #000;will-change:transform}
#sxnotice .tag{color:#ff6a3a;margin-right:.4em}
#sxnotice .it{margin:0 .1em}
#sxnotice .gm{color:#8fe8ff}
`);
const sxNotice = { el: null, q: [], busy: false, seen: new Set() };
function noticeHtml(m) {
  // 文案是纯文本：先整体转义，再把 [物品名] 按品级上色
  let s = escHtml(m.text || '');
  if (m.item && m.item.name) { const nm = escHtml(m.item.name); s = s.split(`[${nm}]`).join(`<span class="it q${(m.item.rar | 0)}">[${nm}]</span>`); }
  return `<span class="tag">【${m.kind === 'custom' ? '系统公告' : '公告'}】</span>${m.kind === 'custom' ? `<span class="gm">${s}</span>` : s}`;
}
function noticeShow(m) {
  if (!m || !m.text) return;
  if (m.id != null) { if (sxNotice.seen.has(m.id)) return; if (sxNotice.seen.size > 500) sxNotice.seen.clear(); sxNotice.seen.add(m.id); }
  sxNotice.q.push(m);
  if (sxNotice.q.length > 12) sxNotice.q.shift();
  if (typeof ui !== 'undefined' && ui.pushLog) ui.pushLog(`【公告】${m.text}`, m.kind === 'custom' ? '#8fe8ff' : '#ffd23a');
  if (!sxNotice.busy) noticeNext();
}
function noticeNext() {
  const m = sxNotice.q.shift();
  if (!m) { sxNotice.busy = false; if (sxNotice.el) sxNotice.el.hidden = true; return; }
  sxNotice.busy = true;
  if (!sxNotice.el || !sxNotice.el.isConnected) { sxNotice.el = h('div', { id: 'sxnotice' }); dom.appendChild(sxNotice.el); }
  const box = sxNotice.el; box.hidden = false; box.classList.toggle('dg', game.scene === 'dungeon' || game.scene === 'test');
  const run = h('div', { class: 'run', html: noticeHtml(m) });
  box.replaceChildren(run);
  // 速度固定（约 170 逻辑像素 / 秒），长文字滚得久一点；最少停留 7 秒
  requestAnimationFrame(() => {
    const W = box.clientWidth, w = run.scrollWidth, u = W / (UW * 0.56), dur = Math.max(7000, (W + w) / (170 * Math.max(0.3, u)) * 1000);
    const a = run.animate([{ transform: 'translateX(0)' }, { transform: `translateX(${-(W + w)}px)` }], { duration: dur, easing: 'linear' });
    a.onfinish = () => noticeNext(); a.oncancel = () => noticeNext();
  });
}
