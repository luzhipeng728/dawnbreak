/* =====================================================================
   小地图
   - 城镇 / 区域地图：右上角区域名下方的横条小地图（出口、门、地下城门、NPC 与任务标记、任务指引目标、玩家）
     点击 = 打开世界地图（N）
   - 地下城：右上角的房间小地图可以点击，打开放大的地下城地图（地下城里按 N 也是它）
   ===================================================================== */
const MM = { x0: 1500, x1: 1900, y0: 106, y1: 200 };   // 城镇小地图面板（UI 逻辑坐标 1920×1080）
const townTrackerTop = () => (game.scene === 'town' && world && uiPref('minimap') !== false ? MM.y1 + 14 : 128);   // 任务追踪栏让位
function drawTownMinimap(c) {
  const S = world && world.S; if (!S || uiPref('minimap') === false) return;
  const { x0, x1, y0, y1 } = MM, sx0 = x0 + 14, sx1 = x1 - 14, top = y0 + 26, bot = y1 - 16, W = S.width;
  const mx = x => sx0 + clamp(x / W, 0, 1) * (sx1 - sx0), my = y => top + clamp(y / DEPTH, 0, 1) * (bot - top), t = performance.now() / 1000;
  c.save();
  c.fillStyle = MM.hover ? 'rgba(20,16,10,.84)' : 'rgba(8,6,10,.72)'; c.fillRect(x0, y0, x1 - x0, y1 - y0);
  c.strokeStyle = MM.hover ? '#ffd23a' : 'rgba(200,160,80,.55)'; c.lineWidth = 2; c.strokeRect(x0 + 1, y0 + 1, x1 - x0 - 2, y1 - y0 - 2);
  uiText('小地图', x0 + 10, y0 + 19, { size: 15, color: '#c8b890', sw: 3 });
  uiText(`${keyName('map')} 世界地图`, x1 - 10, y0 + 19, { size: 14, align: 'right', color: '#9a8f7c', sw: 3 });
  // 地面带：上沿是后墙（门都在后墙上）
  const g = c.createLinearGradient(0, top, 0, bot); g.addColorStop(0, '#4a3e32'); g.addColorStop(1, '#2a2420'); c.fillStyle = g; c.fillRect(sx0, top, sx1 - sx0, bot - top);
  c.fillStyle = '#6a5a44'; c.fillRect(sx0, top - 3, sx1 - sx0, 3);
  // 出口
  for (const ex of S.exits) {
    const T = SCENES[ex.to], name = T ? (T.area && T.area !== T.name ? T.area : T.name) : '？', off = !!ex.locked || !T || (ex.minLv && game.lvl < ex.minLv);
    c.fillStyle = off ? '#8a8070' : '#ffe8a8';
    if (ex.side === 'left' || ex.side === 'right') {
      const X = ex.side === 'left' ? sx0 - 2 : sx1 + 2, d = ex.side === 'left' ? -1 : 1, Y = (top + bot) / 2;
      c.beginPath(); c.moveTo(X + d * 9, Y); c.lineTo(X, Y - 7); c.lineTo(X, Y + 7); c.closePath(); c.fill();
      uiText(name, ex.side === 'left' ? sx0 + 4 : sx1 - 4, bot + 13, { size: 12, align: ex.side === 'left' ? 'left' : 'right', color: off ? '#8a8070' : '#d8c8a0', sw: 3 });
    } else {
      const X = mx(ex.x), Y = ex.side === 'up' ? top - 2 : bot; c.fillRect(X - 5, Y - 4, 10, 7);
    }
  }
  // 地下城门
  for (const gt of S.gates) {
    if (!gateVisible(gt)) continue; const X = mx(gt.x), ab = DUNGEONS[gt.dungeon] && DUNGEONS[gt.dungeon].abyss;   // 深渊门：粉紫色菱形 + “深渊”
    c.fillStyle = ab ? '#ff5ae0' : '#b070ff'; c.beginPath(); if (ab) { c.moveTo(X, top - 5); c.lineTo(X + 7, top + 3); c.lineTo(X, top + 11); c.lineTo(X - 7, top + 3); c.closePath(); } else c.arc(X, top + 3, 5, 0, TAU);
    c.fill(); c.strokeStyle = '#e0c0ff'; c.lineWidth = 1.5; c.stroke();
    if (ab) uiText('深渊', X, top - 8, { size: 11, align: 'center', color: '#ffb0f0', sw: 3 });
  }
  // NPC（有任务标记的用标记颜色，并画上 ! / ?）
  for (const e of world.npcs || []) {
    const m = typeof questMarkerInfo === 'function' ? questMarkerInfo(e.npc.id) : null, X = mx(e.x), Y = my(e.y);
    c.fillStyle = m ? m.col : '#e8c26a'; c.beginPath(); c.arc(X, Y, m ? 4.5 : 3.2, 0, TAU); c.fill();
    if (m) uiText(m.ch, X, Y - 7, { size: 13, align: 'center', color: m.col, sw: 3 });
  }
  // 任务指引目标（在本场景）或通往目标的出口：金色闪烁圈
  const P = typeof guide !== 'undefined' && guide.cur, n = P && P.next;
  if (n) { const X = mx(n.x), Y = my(n.y), r = 7 + Math.sin(t * 5) * 2; c.strokeStyle = '#ffd23a'; c.lineWidth = 2.5; c.beginPath(); c.arc(X, Y, r, 0, TAU); c.stroke(); }
  // 玩家
  const p = game.player; if (p) { const X = mx(p.x), Y = my(p.y); c.fillStyle = '#fff'; c.strokeStyle = '#3a8aff'; c.lineWidth = 2; c.beginPath(); c.arc(X, Y, 4.5, 0, TAU); c.fill(); c.stroke(); c.fillStyle = '#fff'; c.beginPath(); c.moveTo(X + p.face * 9, Y); c.lineTo(X + p.face * 4, Y - 3); c.lineTo(X + p.face * 4, Y + 3); c.closePath(); c.fill(); }
  c.restore();
}
// 点击区域（DOM 透明层，只负责点击 / 悬停提示；画面仍然画在 UI 画布上）
const minimapHit = {
  el: null,
  sync() {
    if (!this.el) {
      this.el = h('div', { id: 'mmhit', hidden: '', style: 'position:absolute;cursor:pointer;z-index:1' });
      this.el.addEventListener('mouseenter', () => { MM.hover = true; }); this.el.addEventListener('mouseleave', () => { MM.hover = false; });
      this.el.addEventListener('click', () => { if (game.scene === 'dungeon' && game.dungeon) { if (!menus.isOpen('dgmap')) { menus.open('dgmap'); sfx.open(); } } else if (menus.w_worldmap) { menus.open('worldmap'); sfx.open(); } });
      dom.prepend(this.el);
    }
    let r = null;
    if (game.scene === 'town' && world && ui.panelOn() && uiPref('minimap') !== false) r = MM;
    else if (game.scene === 'dungeon' && game.dungeon && game.dungeon.layout && !menus.hudHidden()) { const L = game.dungeon.layout, cs = 34, x0 = 1880 - L.cols * cs; r = { x0: x0 - 12, x1: 1892, y0: 18, y1: 70 + L.rows * cs + 12 }; }
    const show = !!r; if (this.el.hidden === show) this.el.hidden = !show;
    if (!show) { MM.hover = false; return; }
    const k = `${r.x0},${r.y0},${r.x1},${r.y1}`; if (this.el._k === k) return; this.el._k = k;
    Object.assign(this.el.style, { left: `calc(var(--u) * ${r.x0}px)`, top: `calc(var(--u) * ${r.y0}px)`, width: `calc(var(--u) * ${r.x1 - r.x0}px)`, height: `calc(var(--u) * ${r.y1 - r.y0}px)` });
    this.el.title = game.scene === 'dungeon' ? `点击查看地下城地图（${keyName('map')}）` : `点击打开世界地图（${keyName('map')}）`;
  },
};
// 放大的地下城地图（房间类型、清理状态、领主房、当前位置）
Object.assign(menus, {
  w_dgmap() {
    const D = game.dungeon; if (!D || !D.layout) return null;
    const L = D.layout, cs = 64, pad = 24, cv = h('canvas', { width: L.cols * cs + pad * 2, height: L.rows * cs + pad * 2, style: 'display:block;margin:0 auto;max-width:100%' });
    const c = cv.getContext('2d');
    c.fillStyle = '#0c0a10'; c.fillRect(0, 0, cv.width, cv.height);
    for (const r of L.rooms) {
      const x = pad + r.gx * cs, y = pad + r.gy * cs;
      for (const d of ['right', 'down']) if (r.doors[d]) { c.fillStyle = r.visited || r.doors[d].visited ? '#c8b080' : '#4a4038'; if (d === 'right') c.fillRect(x + cs - 10, y + cs / 2 - 4, 20, 8); else c.fillRect(x + cs / 2 - 4, y + cs - 10, 8, 20); }
      c.fillStyle = r === D.room ? '#ffd23a' : r.visited ? (r.cleared ? '#8a7a5a' : '#c8a060') : '#2c2620';
      c.fillRect(x + 8, y + 8, cs - 16, cs - 16);
      c.strokeStyle = r.type === 'boss' ? '#ff4a3a' : r.type === 'start' ? '#6ab0ff' : '#0a0806'; c.lineWidth = 3; c.strokeRect(x + 8, y + 8, cs - 16, cs - 16);
      c.font = '900 22px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      if (r.type === 'boss') { c.fillStyle = '#ff5a4a'; c.fillText('☠', x + cs / 2, y + cs / 2); }
      else if (r.type === 'start') { c.fillStyle = '#9ad0ff'; c.fillText('起', x + cs / 2, y + cs / 2); }
      if (r === D.room) { c.fillStyle = '#fff'; c.beginPath(); c.arc(x + cs / 2, y + cs / 2 + (r.type === 'boss' || r.type === 'start' ? 16 : 0), 7, 0, TAU); c.fill(); }
    }
    const lg = (col, t, border) => h('span', { style: 'display:inline-flex;align-items:center;gap:.3em;margin-right:1em' }, h('i', { style: `display:inline-block;width:.9em;height:.9em;background:${col};border:.12em solid ${border || '#0a0806'}` }), t);
    const cleared = L.rooms.filter(r => r.cleared).length;
    const body = h('div', { class: 'col', style: 'gap:.5em' },
      h('div', { class: 'row', style: 'justify-content:space-between' }, h('b', { style: 'color:#ffe8a8' }, `${D.def.name} · ${D.D.name}`), h('span', { class: 'small dim' }, `已清理 ${cleared}/${L.rooms.length} 个房间 · 疲劳 ${save.data.fatigue}`)),
      cv,
      h('div', { class: 'small', style: 'color:#c8b890' }, lg('#ffd23a', '当前位置'), lg('#8a7a5a', '已清理'), lg('#c8a060', '已进入'), lg('#2c2620', '未探索'), lg('#2c2620', '领主房', '#ff4a3a'), lg('#2c2620', '起点', '#6ab0ff')));
    return this.win('地下城地图', body, { w: Math.max(22, L.cols * 4.6 + 4) });
  },
});
// 地下城里按 N（地图）= 地下城地图
{ const uk0 = uiKey; uiKey = function (a) { if (a === 'map' && game.scene === 'dungeon' && game.dungeon) { const was = menus.isOpen('dgmap'); menus.open('dgmap'); if (!was) sfx.open(); else sfx.click(); return; } return uk0.apply(this, arguments); }; }
// 城镇：区域名下画小地图；每帧同步点击层
{ const wui0 = worldUI; worldUI = function (c) { wui0.apply(this, arguments); if (ui.panelOn()) drawTownMinimap(c); }; }
{ const draw0 = ui.draw; ui.draw = function () { draw0.apply(this, arguments); minimapHit.sync(); }; }
