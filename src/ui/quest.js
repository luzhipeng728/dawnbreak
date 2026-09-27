/* =====================================================================
   任务界面：NPC 头顶标记、右侧任务追踪、任务日志（F1 / L，窗口 quests）、任务完成奖励弹窗（窗口 npcquest）
   ===================================================================== */
addStyle(`
.qico{display:inline-flex;align-items:center;justify-content:center;width:1.35em;height:1.35em;border-radius:50%;font:900 .95em "Arial Black",sans-serif;flex:none;
  background:radial-gradient(circle at 35% 30%,#fff3a8,#e8a820 60%,#8a5a08);color:#3a2204;box-shadow:0 0 .4em rgba(255,210,60,.6),inset 0 -.1em .15em rgba(0,0,0,.35)}
.qico.active{background:radial-gradient(circle at 35% 30%,#e8e8e8,#8a8a8a 60%,#3a3a3a);color:#1a1a1a;box-shadow:none}
.qico.soon{background:#2a2430;color:#6a6070;box-shadow:none}
.qico.done{background:#244a2a;color:#9aff9a;box-shadow:none}
.qtag{font-size:.72em;font-weight:900;padding:.05em .4em;border-radius:.2em;border:.08em solid currentColor;flex:none}
.qchips{display:flex;flex-wrap:wrap;gap:.35em}
.qchip{display:inline-flex;align-items:center;gap:.3em;padding:.2em .55em;border-radius:.3em;background:rgba(0,0,0,.35);border:.08em solid #5a4a36;font-size:.85em;font-weight:700}
.qchip img{width:1.6em;height:1.6em;object-fit:contain}
.qchip.exp{color:#9fe0ff}.qchip.gold{color:#ffd24a}.qchip.sp{color:#b8ff9a}.qchip.coin{color:#ffe8a0}.qchip.title{color:#ff9ad8}.qchip.unlock{color:#e0a0ff}.qchip.flag{color:#ff9a5a}
.qgoals{display:flex;flex-direction:column;gap:.2em;font-size:.92em}
.qgoal{display:flex;gap:.5em;align-items:center}.qgoal .v{margin-left:auto;font-weight:800;color:#ffe8a8}.qgoal.ok{color:#8aff9a}.qgoal.ok .v{color:#8aff9a}
.qgoal .qgi{width:1.5em;height:1.5em;border-radius:.2em;margin-right:-.2em}
.qgoal::before{content:'◆';color:#8a6a3a;font-size:.7em}.qgoal.ok::before{content:'✔';color:#8aff9a}
/* ---- 任务日志 ---- */
.qlog{display:flex;flex-direction:column;gap:.6em;width:48em}
.qtabs{display:flex;gap:.3em;border-bottom:.1em solid #5a4a36}
.qtab{padding:.35em 1.2em;cursor:pointer;border:.1em solid #5a4a36;border-bottom:none;border-radius:.3em .3em 0 0;background:#1a1420;color:#b8a888;font-weight:800;position:relative;top:.1em}
.qtab.sel{background:linear-gradient(180deg,#4a3620,#241a12);color:#ffe8a8;border-color:#a88040}
.qtab .n{font-size:.75em;color:#8aff9a;margin-left:.3em}
.qtab .dot{position:absolute;right:-.35em;top:-.45em;width:1.15em;height:1.15em;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff3a8,#e8a820 60%,#8a5a08);color:#3a2204;font:900 .75em/1.15em "Arial Black",sans-serif;text-align:center;box-shadow:0 0 .4em rgba(255,210,60,.6)}
.qbody{display:flex;gap:.8em;height:26em}
.qlist{width:17em;overflow-y:auto;display:flex;flex-direction:column;gap:.15em;padding-right:.3em;flex:none}
.qsec{font-size:.78em;color:#9a8f7c;font-weight:800;margin:.4em 0 .15em;letter-spacing:.1em}
.qli{display:flex;align-items:center;gap:.45em;padding:.3em .45em;border-radius:.25em;cursor:pointer;border:.08em solid transparent;font-size:.92em}
.qli:hover{background:rgba(255,230,160,.07)}.qli.sel{background:rgba(232,194,106,.15);border-color:#a88040}
.qli .nm{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:700}.qli .lv{font-size:.75em;color:#9a8f7c}
.qli.soon{opacity:.55}
.qdet{flex:1;display:flex;flex-direction:column;gap:.55em;overflow-y:auto;background:rgba(0,0,0,.22);border-radius:.3em;padding:.7em .9em}
.qdet h3{font-size:1.25em;color:#ffe8a8;display:flex;align-items:center;gap:.5em}
.qdet .chap{font-size:.78em;color:#c8a870}
.qdet .desc{line-height:1.65;color:#e0d6c4;font-size:.95em;white-space:pre-line}
.qdet .lbl{font-size:.8em;color:#c8a870;font-weight:800;border-bottom:.06em solid #3a3040;padding-bottom:.1em}
.qdet .who{font-size:.85em;color:#b8d8ff}
.qfoot{display:flex;align-items:center;gap:.6em;font-size:.82em;color:#9a8f7c}
/* ---- 奖励弹窗 ---- */
.qreward{position:absolute;left:50%;top:44%;transform:translate(-50%,-50%);width:30em;padding:1.2em 1.4em 1.1em;text-align:center;
  background:radial-gradient(ellipse at 50% 0%,rgba(120,90,30,.55),rgba(0,0,0,0) 60%),linear-gradient(180deg,rgba(34,26,20,.97),rgba(12,9,10,.98));
  border:.16em solid #c8a050;border-radius:.5em;box-shadow:0 0 0 .1em #2a1a08,0 0 3em rgba(255,200,80,.35),0 1em 3em rgba(0,0,0,.7);animation:qpop .45s cubic-bezier(.2,1.6,.4,1)}
@keyframes qpop{from{transform:translate(-50%,-50%) scale(.4);opacity:0}to{transform:translate(-50%,-50%) scale(1);opacity:1}}
.qreward .ttl{font:900 2.2em "Arial Black","PingFang SC",sans-serif;letter-spacing:.12em;background:linear-gradient(180deg,#fff8d0,#ffd23a 55%,#c07a10);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 .08em 0 #3a2000)}
.qreward .qn{margin:.3em 0 .8em;color:#ffe8c0;font-weight:800}
.qreward .qchips{justify-content:center;margin-bottom:1em}
.qreward .qchip{font-size:1em;animation:qchip .5s both}
@keyframes qchip{from{transform:translateY(.8em);opacity:0}to{transform:none;opacity:1}}
.qreward .rays{position:absolute;left:50%;top:1.6em;width:16em;height:16em;margin:-8em 0 0 -8em;pointer-events:none;z-index:-1;
  background:repeating-conic-gradient(rgba(255,220,120,.18) 0 8deg,rgba(0,0,0,0) 8deg 20deg);border-radius:50%;-webkit-mask:radial-gradient(circle,#000 20%,transparent 70%);mask:radial-gradient(circle,#000 20%,transparent 70%);animation:qspin 9s linear infinite}
@keyframes qspin{to{transform:rotate(360deg)}}
`);

/* ---- NPC 头顶标记（world.js 在名牌上方调用）：浮动 + 光晕，主线任务的 ! 更大并带光芒 ---- */
function drawQuestMarker(c, X, Y, npcId) {
  const m = questMarkerInfo(npcId); if (!m) return false;
  const t = game.t, bob = Math.sin(t * 4 + X * 0.05) * 2.5, big = m.main && m.col !== '#9a9a9a', s = big ? 1.18 : 1, y = Y - 4 + bob;
  c.save();
  if (m.col !== '#9a9a9a') {   // 光晕（灰色的进行中标记不发光）
    c.globalCompositeOperation = 'lighter';
    const r = 17 * s + Math.sin(t * 6) * 2, g = c.createRadialGradient(X, y - 8, 1, X, y - 8, r);
    g.addColorStop(0, 'rgba(255,220,90,.55)'); g.addColorStop(1, 'rgba(255,180,0,0)');
    c.fillStyle = g; c.beginPath(); c.arc(X, y - 8, r, 0, TAU); c.fill();
    if (big) { c.translate(X, y - 8); c.rotate(t * 0.8); c.fillStyle = 'rgba(255,230,140,.22)'; for (let i = 0; i < 8; i++) { c.rotate(TAU / 8); c.beginPath(); c.moveTo(0, 0); c.lineTo(-2.5, -24); c.lineTo(2.5, -24); c.closePath(); c.fill(); } c.setTransform(RS, 0, 0, RS, 0, 0); }
    c.globalCompositeOperation = 'source-over';
  }
  c.font = `900 ${Math.round(20 * s)}px "Arial Black",Impact,sans-serif`; c.textAlign = 'center'; c.textBaseline = 'alphabetic';
  c.lineJoin = 'round'; c.lineWidth = 5; c.strokeStyle = '#2a1600'; c.strokeText(m.ch, X, y);
  const fg = c.createLinearGradient(0, y - 18 * s, 0, y);
  if (m.col === '#9a9a9a') { fg.addColorStop(0, '#e8e8e8'); fg.addColorStop(1, '#7a7a7a'); } else { fg.addColorStop(0, '#fffbd0'); fg.addColorStop(0.5, '#ffd23a'); fg.addColorStop(1, '#e08a10'); }
  c.fillStyle = fg; c.fillText(m.ch, X, y);
  c.restore();
  return true;
}

/* ---- 右侧任务追踪（城镇由 world.js 调用，地下城由 hud.js 调用；hud 还没接上时下面有同帧去重的兜底） ---- */
function qtFit(c, s, w) { if (c.measureText(s).width <= w) return s; while (s.length > 1 && c.measureText(s + '…').width > w) s = s.slice(0, -1); return s + '…'; }
function drawQuestTracker(c) {
  questUI.drawn = true;
  const d = qdata(); if (!d || !game.player) return;
  const dg = game.scene === 'dungeon' ? game.dungeon : null;
  if (dg && dg.state !== 'play') return;
  const ids = d.questTrack.filter(id => d.quests[id] && QUESTS[id]).slice(0, dg ? 4 : QUEST_TRACK_MAX);
  const hint = !dg && questNextMain();
  if (!ids.length && !hint) { questUI.trackRect = null; return; }
  const W = 420, x1 = 1900, x0 = x1 - W, y0 = dg ? 330 : 128, font = '"PingFang SC","Microsoft YaHei",sans-serif';
  // 先量高度
  const rows = [];
  for (const id of ids) {
    const q = QUESTS[id], rec = d.quests[id], ready = questReady(id);
    rows.push({ q, head: true, ready });
    if (ready) rows.push({ q, txt: q.to ? `找 ${qNpcName(q.to)} 交付` : '目标达成', ok: true, turnIn: true });
    else q.goals.forEach((g, i) => { const v = goalVal(q, rec, i); rows.push({ q, txt: goalText(g), val: goalProgText(q, rec, i), ok: v >= g.n, icon: g.type === 'collect' && g.key && IMG['icon/' + (g.icon || g.key)] }); });
  }
  if (hint) { rows.push({ q: hint, head: true, hint: true }); rows.push({ q: hint, txt: hint.lvl > game.lvl ? `Lv.${hint.lvl} 后可接取` : `去找 ${qNpcWhere(hint.npc)} 接取`, hintRow: true }); }
  const H = 40 + rows.reduce((s, r) => s + (r.head ? 36 : 28), 0) + 6;
  questUI.trackRect = { x: x0 - 30, y: y0, w: W + 30, h: H };
  // 城镇里右侧 NPC 的名字 / 头顶任务标记被追踪栏盖住时，追踪栏淡出（NPC 离开这块区域后恢复）
  const cover = !dg && game.scene === 'town' && world && world.npcs.some(e => { const X = sx(e.x) * 2, Y = sy(e.y, e.npc.h + 16) * 2; return X + 60 > x0 - 30 && X - 60 < x1 && Y + 10 > y0 && Y - 90 < y0 + H; });
  const now = performance.now(), fdt = Math.min(0.1, (now - (questUI.fadeT || now)) / 1000); questUI.fadeT = now;
  questUI.fade = clamp((questUI.fade ?? 1) + (cover ? -fdt * 5 : fdt * 3), 0.1, 1);
  c.save(); c.globalAlpha = questUI.fade;
  const bg = c.createLinearGradient(x0, 0, x1, 0); bg.addColorStop(0, 'rgba(10,8,14,0)'); bg.addColorStop(0.18, 'rgba(10,8,14,.55)'); bg.addColorStop(1, 'rgba(10,8,14,.7)');
  c.fillStyle = bg; c.fillRect(x0 - 30, y0, W + 30, H);
  c.fillStyle = 'rgba(232,194,106,.5)'; c.fillRect(x0 + 40, y0, W - 40, 2);
  uiText('任务追踪', x0 + 8, y0 + 27, { size: 19, color: '#e8c26a', sw: 3 });
  uiText(`${typeof keyName === 'function' ? keyName('quests') : 'F1 / L'} 任务日志`, x1 - 6, y0 + 26, { size: 14, align: 'right', color: '#9a8f7c', sw: 3 });
  let y = y0 + 40;
  for (const r of rows) {
    if (r.head) {
      const T = QTYPES[r.q.type], fl = questUI.flash[r.q.id], hot = fl != null && game.t - fl < 1.6;
      if (hot) { c.fillStyle = `rgba(255,210,80,${0.25 * (1 - (game.t - fl) / 1.6)})`; c.fillRect(x0 - 10, y - 2, W + 10, 34); }
      c.font = `800 21px ${font}`;
      const tag = `[${r.hint ? '主线' : T.name}]`;
      uiText(tag, x0 + 8, y + 24, { size: 19, color: r.hint ? '#c8a870' : T.col, sw: 4 });
      c.font = `800 21px ${font}`; const tw = c.measureText(tag).width * 19 / 21;
      const name = qtFit(c, r.q.name, W - tw - 30);
      uiText(name, x0 + 14 + tw, y + 24, { size: 21, color: r.ready ? '#ffe070' : r.hint ? '#b8b0a0' : '#fff2d8', sw: 4 });
      y += 36;
    } else {
      c.font = `700 17px ${font}`;
      const valW = r.val ? c.measureText(r.val).width + 12 : 0, txt = qtFit(c, (r.icon ? (r.ok ? '✔ ' : '') : r.turnIn ? '▶ ' : r.hintRow ? '· ' : r.ok ? '✔ ' : '· ') + r.txt, W - 30 - valW - (r.icon ? 26 : 0));
      const col = r.turnIn ? (Math.sin(game.t * 5) > -0.2 ? '#ffd23a' : '#fff6c0') : r.hintRow ? '#a8a090' : r.ok ? '#8aff9a' : '#e8e0d0';
      if (r.icon) { c.drawImage(r.icon, x0 + 20, y + 2, 22, 22); }
      uiText(txt, x0 + (r.icon ? 48 : 22), y + 20, { size: 17, color: col, sw: 3 });
      if (r.val) uiText(r.val, x1 - 6, y + 20, { size: 17, align: 'right', color: r.ok ? '#8aff9a' : '#ffe8a8', sw: 3 });
      y += 28;
    }
  }
  c.restore();
}
// 点击追踪栏 → 打开任务日志（手机上没有 F1 / L 键时也能打开）
wcan.addEventListener('click', ev => {
  const R = questUI.trackRect; if (!R || !game.player || !['town', 'dungeon'].includes(game.scene) || menus.modal() || (questUI.fade < 0.5 && game.scene === 'town' && world && world.hover)) return;   // 淡出时点到下面的 NPC：交给 NPC 对话
  const r = wcan.getBoundingClientRect(), x = (ev.clientX - r.left) / r.width * 1920, y = (ev.clientY - r.top) / r.height * 1080;
  if (x >= R.x && x <= R.x + R.w && y >= R.y && y <= R.y + R.h) { menus.open('quests'); sfx.open(); }
});
// 兜底：界面组在 hud.js 接上调用之前，地下城里也画追踪栏（同一帧已经画过就跳过）
{ const orig = ui.draw; ui.draw = function () { questUI.drawn = false; orig.apply(this, arguments); if (!questUI.drawn && game.scene === 'dungeon' && game.player) { uctx.setTransform(uiScale, 0, 0, uiScale, 0, 0); drawQuestTracker(uctx); } }; }

/* ---- 共用 DOM 片段 ---- */
function questIco(st) { return h('span', { class: 'qico ' + (st === 'ready' ? '' : st) }, st === 'ready' ? '?' : st === 'avail' ? '!' : st === 'done' ? '✔' : st === 'soon' ? '!' : '?'); }
function questTag(q) { const T = QTYPES[q.type]; return h('span', { class: 'qtag', style: `color:${T.col}` }, T.name); }
function questGoalsEl(q) {
  const rec = questRec(q.id);
  if (!q.goals.length) return h('div', { class: 'qgoals' }, h('div', { class: 'qgoal' + (rec ? ' ok' : '') }, h('span', {}, `去找 ${qNpcWhere(q.to)}`)));
  return h('div', { class: 'qgoals' }, q.goals.map((g, i) => {
    const v = rec ? goalVal(q, rec, i) : 0;
    const ic = g.type === 'collect' && g.key && IMG['icon/' + (g.icon || g.key)];
    return h('div', { class: 'qgoal' + (rec && v >= g.n ? ' ok' : '') }, ic ? h('img', { class: 'qgi', src: ic.src }) : null, h('span', {}, goalText(g)), rec ? h('span', { class: 'v' }, goalProgText(q, rec, i)) : (goalCounted(g) && g.n > 1 ? h('span', { class: 'v' }, `×${g.n}`) : null));
  }));
}
const REWARD_ICON = { exp: 'icon/x_trophy', gold: 'icon/gold', sp: 'icon/x_scroll', coin: 'icon/coin', title: 'icon/x_card', unlock: 'icon/x_key', flag: 'icon/x_map' };
function questChip(r, i = 0) {
  let src = null;
  if (r.item && typeof itemIconSrc === 'function') { try { src = itemIconSrc(r.item); } catch (e) { src = null; } }
  if (!src && r.item) src = itemIconURL(r.item);
  if (!src && r.spec) { try { const it = r.spec.equip ? { kind: 'equip', slot: r.spec.equip === 'rand' ? 'top' : r.spec.equip, rar: r.spec.rar ?? 1, cls: qPlayerCls() } : { kind: 'use', key: r.spec.key, rar: 0 }; src = typeof itemIconSrc === 'function' && !r.spec.equip ? itemIconSrc(r.spec.key) : itemIconURL(it); } catch (e) { src = null; } }
  if (!src && IMG[REWARD_ICON[r.kind]]) src = IMG[REWARD_ICON[r.kind]].src;
  const el = h('span', { class: 'qchip ' + r.kind, style: `animation-delay:${0.15 + i * 0.08}s` }, src ? h('img', { src }) : null, r.label);
  if (r.item) { el.addEventListener('mousemove', ev => menus.showTip(menus.itemTip(r.item), ev)); el.addEventListener('mouseleave', () => menus.hideTip()); }
  return el;
}
const questRewardsEl = q => h('div', { class: 'qchips' }, questRewardList(q).map((r, i) => questChip(r, i)));

/* ---- 任务日志（F1 / L） ---- */
Object.assign(menus, {
  w_quests(arg = {}) {
    const d = qdata(); if (!d) return null;
    const ui = this.qlog || (this.qlog = { tab: 'main', sel: null, ask: null });
    if (arg.tab) ui.tab = arg.tab; if (arg.sel) ui.sel = arg.sel;
    const TAB = QUEST_TABS.find(t => t.id === ui.tab) || QUEST_TABS[0];
    const inTab = (t, st) => questList(q => t.types.includes(q.type) && st.includes(questState(q.id)));
    const tabs = h('div', { class: 'qtabs' }, QUEST_TABS.map(t => {
      const n = inTab(t, ['active', 'ready']).length, a = inTab(t, ['avail']).length;
      return h('div', { class: 'qtab' + (t === TAB ? ' sel' : ''), title: `进行中 ${n} · 可接 ${a}`, onclick: () => { ui.tab = t.id; ui.sel = null; ui.ask = null; sfx.click(); this.refresh('quests'); } }, t.name, n ? h('span', { class: 'n' }, `(${n})`) : null, a ? h('span', { class: 'dot' }, '!') : null);
    }));
    const secs = [['进行中', inTab(TAB, ['ready', 'active'])], ['可接任务', inTab(TAB, ['avail'])], ['即将开放', inTab(TAB, ['soon']).slice(0, 6)], ['已完成', inTab(TAB, ['done'])]];
    const all = secs.flatMap(s => s[1]);
    let q = all.find(x => x.id === ui.sel) || all[0] || null; ui.sel = q && q.id;
    const list = h('div', { class: 'qlist' });
    for (const [title, qs] of secs) {
      if (!qs.length) continue;
      list.append(h('div', { class: 'qsec' }, `${title}（${qs.length}）`));
      for (const x of qs) { const st = questState(x.id); list.append(h('div', { class: 'qli' + (x === q ? ' sel' : '') + (st === 'soon' ? ' soon' : ''), onclick: () => { ui.sel = x.id; ui.ask = null; sfx.click(); this.refresh('quests'); } }, questIco(st), h('span', { class: 'nm', style: x.type === 'hidden' ? 'color:#e0a0ff' : '' }, x.name), h('span', { class: 'lv' }, `Lv.${x.lvl}`))); }
    }
    if (!all.length) list.append(h('div', { class: 'dim small', style: 'padding:1em .5em;line-height:1.7' }, TAB.id === 'job' ? '到 15 级后去找职业导师，就能开始转职的试炼。' : TAB.id === 'daily' ? '每日任务在 Lv.5 后开放，每天 06:00 重置。' : '暂时没有任务。'));
    const det = h('div', { class: 'qdet' });
    if (q) {
      const st = questState(q.id), rec = questRec(q.id);
      det.append(...[
        h('h3', {}, questTag(q), q.name),
        q.chapter ? h('div', { class: 'chap' }, q.chapter) : null,
        h('div', { class: 'who' }, `接取：${qNpcWhere(q.npc)}` + (q.to !== q.npc ? `　交付：${qNpcWhere(q.to)}` : '') + `　等级 Lv.${q.lvl}`),
        h('div', { class: 'desc' }, questFmt(q.desc || (q.talk.offer[0] || '').replace(/^我：/, ''))),
        h('div', { class: 'lbl' }, '任务目标'), questGoalsEl(q),
        h('div', { class: 'lbl' }, '任务奖励'), questRewardsEl(q)].filter(Boolean));
      const btns = h('div', { class: 'row', style: 'margin-top:auto;flex-wrap:wrap' });
      if (rec) {
        const on = d.questTrack.includes(q.id);
        btns.append(h('button', { class: 'btn' + (on ? '' : ' blue'), onclick: () => { if (on) d.questTrack = d.questTrack.filter(x => x !== q.id); else { d.questTrack.unshift(q.id); d.questTrack.length = Math.min(d.questTrack.length, QUEST_TRACK_MAX); } sfx.click(); save.write(); this.refresh('quests'); } }, on ? '取消追踪' : '追踪'));
        if (st === 'ready') btns.append(h('span', { class: 'gold small' }, `目标已达成，去找 ${qNpcWhere(q.to)} 交付`));
        if (ui.ask === q.id) btns.append(h('span', { class: 'small', style: 'color:#ffb0a0' }, '确定要放弃吗？进度会清空'), h('button', { class: 'btn red', onclick: () => { ui.ask = null; questAbandon(q.id); this.refresh('quests'); } }, '放弃'), h('button', { class: 'btn', onclick: () => { ui.ask = null; sfx.click(); this.refresh('quests'); } }, '取消'));
        else btns.append(h('span', { class: 'sp' }), h('button', { class: 'btn red', onclick: () => { ui.ask = q.id; sfx.click(); this.refresh('quests'); } }, '放弃任务'));
      } else if (st === 'avail') btns.append(h('span', { class: 'small', style: 'color:#ffd23a' }, `去找 ${qNpcWhere(q.npc)} 接取这个任务`));
      else if (st === 'soon') btns.append(h('span', { class: 'small dim' }, `需要等级 Lv.${q.lvl}（当前 Lv.${game.lvl}）`));
      else if (st === 'done') btns.append(h('span', { class: 'small', style: 'color:#8aff9a' }, q.type === 'daily' ? '今天已经完成，明天 06:00 后可以再接' : '✔ 已完成'));
      det.append(btns);
    } else det.append(h('div', { class: 'dim' }, '选择左侧的任务查看详情'));
    const nAct = Object.keys(d.quests).length;
    const body = h('div', { class: 'qlog' }, tabs, h('div', { class: 'qbody' }, list, det),
      h('div', { class: 'qfoot' }, `进行中的任务 ${nAct}/${QUEST_MAX_ACTIVE}`,
        TAB.id === 'main' ? h('span', { style: 'color:#ffd23a;margin-left:1em' }, `主线进度 ${questList(x => x.type === 'main' && questState(x.id) === 'done').length}/${questList(x => x.type === 'main').length}`) : null,
        h('span', { class: 'sp' }), TAB.id === 'daily' ? '每日任务每天 06:00 重置' : '追踪中的任务会显示在画面右侧（点击可打开任务日志）'));
    const el = this.win('任务', body, { w: 50, at: 'center' }); el._arg = {}; return el;
  },
  // 任务完成奖励弹窗
  w_npcquest(arg) {
    if (!arg || !arg.q) return null;
    const { q, got } = arg;
    const el = h('div', { class: 'qreward', 'data-block': '1', 'data-hud': 'hide' },
      h('div', { class: 'rays' }),
      h('div', { class: 'ttl' }, 'QUEST CLEAR'),
      h('div', { class: 'qn' }, '【', QTYPES[q.type].name, '】', q.name, '  完成！'),
      h('div', { class: 'qchips' }, (got || []).map((r, i) => questChip(r, i))),
      h('button', { class: 'btn big', onclick: () => { sfx.click(); this.close('npcquest'); if (arg.after) arg.after(); } }, '确定'));
    el._arg = arg; return el;
  },
});
// F1 / L：界面组在 KEYMAP 里分配了 quests 之后由他们负责，没分配时这里兜底
addEventListener('keydown', e => {
  if (e.code === 'F1') e.preventDefault();
  if (e.repeat || (typeof KEYMAP !== 'undefined' && KEYMAP.quests)) return;
  if ((e.code === 'F1' || e.code === 'KeyL') && save.data && game.player && (game.scene === 'town' || game.scene === 'dungeon') && !menus.isOpen('result') && !menus.isOpen('title')) { menus.open('quests'); sfx.open(); }
});
// 任务状态变化时，刷新开着的任务日志
for (const ev of ['questAccept', 'questDone', 'questAbandon', 'questReady']) bus.on(ev, () => { if (menus.isOpen('quests')) menus.refresh('quests'); });
