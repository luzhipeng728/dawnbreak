/* =====================================================================
   任务线路指引 + 自动前往
   - 目标：任务日志里点了“自动前往”的任务（guide.goTo）> 追踪栏第一个进行中的任务（没有追踪就取进行中的主线，再没有就取下一个可接主线）
     可交付 → 交付 NPC；否则第一个没完成的目标：对话 → NPC，到达 → 场景，通关 / 击杀 / 收集 → 地下城的门
   - 路线：沿场景出口（城镇 / 区域地图的连接）做最短路径；当前画面里的下一站头顶有跳动的金色箭头，画面外在屏幕边缘指方向
   - 左上角的指引条显示完整路线，点“自动前往”角色会自己走过去（模拟按方向键，走到 NPC 身边自动对话，走到门口弹出地下城窗口）；按任意方向键取消
   ===================================================================== */
addStyle(`
#qguide{position:absolute;left:calc(var(--u) * 14px);top:calc(var(--u) * 14px);max-width:calc(var(--u) * 560px);background:linear-gradient(90deg,rgba(20,14,8,.86),rgba(20,14,8,.55));border:.08em solid rgba(232,194,106,.55);border-left:.25em solid #ffd23a;border-radius:.3em;padding:.35em .6em;color:#f0dcb0;font-size:.92em;line-height:1.45;z-index:1;box-shadow:0 .2em .6em rgba(0,0,0,.5)}
body.touchui #qguide{top:12vh}
#qguide .t{color:#ffd23a;font-weight:900;margin-right:.4em}
#qguide .tgt{font-weight:800;color:#fff2d0}
#qguide .rt{font-size:.86em;color:#c8b890}
#qguide .rt b{color:#8fe8ff;font-weight:800}
#qguide button{margin-left:.5em;font-family:inherit;font-size:.82em;font-weight:900;padding:.1em .55em;border-radius:.25em;border:.08em solid #b89450;background:linear-gradient(#6a4e26,#2e2010);color:#ffe8a8;cursor:pointer}
#qguide button:hover{border-color:#ffd23a;color:#fff}
#qguide button.stop{background:linear-gradient(#6a2a22,#2e100c);border-color:#c86a50}
`);
const guide = {
  el: null, t: 0, cur: null, auto: false, autoT: 0, arrived: false, pin: null,
  // 任务日志里点“自动前往”：指引切到这个任务并开始走
  goTo(id) { this.pin = id; this.auto = true; this.arrived = false; if (this.el) this.el._sig = null; },
  // ---- 目标 ----
  focus() {
    const d = typeof qdata === 'function' && qdata(); if (!d) return null;
    const pq = this.pin && QUESTS[this.pin];
    if (pq) { const st = questState(pq.id), t = st === 'avail' ? pq.npc && this.npcT(pq.npc, `接取「${pq.name}」`, pq) : st === 'active' || st === 'ready' ? this.targetOf(pq) : null; if (t) return t; this.pin = null; }
    const act = activeQuests(), tracked = (d.questTrack || []).map(id => QUESTS[id]).filter(q => q && d.quests[q.id]);
    const list = tracked.length ? tracked : act.slice().sort((a, b) => (a.type === 'main' ? 0 : 1) - (b.type === 'main' ? 0 : 1));
    for (const q of list) { const t = this.targetOf(q); if (t) return t; }
    const nm = questNextMain(); if (nm && questState(nm.id) === 'avail' && nm.npc) return this.npcT(nm.npc, `接取主线「${nm.name}」`, nm);
    return null;
  },
  targetOf(q) {
    const rec = questRec(q.id); if (!rec) return null;
    if (questReady(q.id)) return q.to ? this.npcT(q.to, `交付「${q.name}」`, q) : null;
    for (let i = 0; i < q.goals.length; i++) {
      const g = q.goals[i]; if (goalVal(q, rec, i) >= g.n) continue;
      const txt = goalText(g);
      if (g.type === 'talk' && g.npc) return this.npcT(g.npc, txt, q);
      if (g.type === 'job') return this.npcT(q.npc, txt, q);   // 转职：去导师那里
      if (g.type === 'reach' && SCENES[g.scene]) return { scene: g.scene, what: txt, q, kind: 'scene' };
      if (['clear', 'kill', 'collect'].includes(g.type)) { const dg = this.dungeonFor(g); if (dg) return this.gateT(dg, txt, q); }
      return { none: true, what: txt, q };   // 升级、穿装备之类没有地点的目标
    }
    return null;
  },
  npcT(npcId, what, q) { const S = qSceneOfNpc(npcId); if (!S) return null; const n = S.npcs.find(x => x.npc === npcId); const name = qNpcName(npcId); return { scene: S.id, x: n.x, y: n.y ?? 40, npc: npcId, what: what.includes(name) ? what : `${what} · 找 ${name}`, q, kind: 'npc', name }; },
  gateT(dg, what, q) {
    for (const S of Object.values(SCENES)) { const g = S.gates.find(x => x.dungeon === dg); if (g && gateVisible(g)) return { scene: S.id, x: g.x, y: 20, gate: dg, what, q, kind: 'gate', name: qDgName(dg) + ' 门口' }; }
    return null;
  },
  // 目标要去的地下城：写了 dungeon 就用（多个时取第一个门可见的），否则按怪物 / 等级挑一个合适的
  dungeonFor(g) {
    const vis = id => DUNGEONS[id] && Object.values(SCENES).some(S => S.gates.some(x => x.dungeon === id && gateVisible(x)));
    if (g.dungeon && g.dungeon !== 'any') { const l = [].concat(g.dungeon).filter(vis); if (l.length) return l[0]; }
    const kinds = [].concat(g.kind || g.from || []), L = game.lvl;
    const cand = Object.values(DUNGEONS).filter(D => vis(D.id) && (!kinds.length || kinds.some(k => D.mobs.some(m => m[0] === k) || D.boss.kind === k || D.elite === k)));
    cand.sort((a, b) => Math.abs((a.lvl[0] + a.lvl[1]) / 2 - L) - Math.abs((b.lvl[0] + b.lvl[1]) / 2 - L));
    return cand[0] ? cand[0].id : null;
  },
  // ---- 路线：场景出口的最短路径（BFS），返回经过的出口列表 ----
  route(from, to) {
    if (from === to) return [];
    const prev = { [from]: null }, q = [from];
    while (q.length) {
      const s = q.shift(); if (s === to) break;
      for (const ex of (SCENES[s] || {}).exits || []) { if (!SCENES[ex.to] || ex.locked || ex.to in prev) continue; prev[ex.to] = { s, ex }; q.push(ex.to); }
    }
    if (!(to in prev)) return null;
    const path = []; for (let s = to; prev[s]; s = prev[s].s) path.unshift(prev[s].ex);
    return path;
  },
  exitPos(S, ex) {
    if (ex.side === 'left') return { x: EXIT_ZONE + 10, y: DEPTH / 2 };
    if (ex.side === 'right') return { x: S.width - EXIT_ZONE - 10, y: DEPTH / 2 };
    return { x: ex.x, y: ex.side === 'up' ? 4 : DEPTH - 4 };
  },
  // 当前场景里的下一站
  plan() {
    const T = this.focus(); if (!T || T.none || !world || !world.S) return { T, next: null };
    const path = this.route(world.S.id, T.scene); if (!path) return { T, next: null, blocked: true };
    if (!path.length) return { T, path, next: T.kind === 'scene' ? null : { x: T.x, y: T.y, label: T.name || '', final: true } };
    const ex = path[0], p = this.exitPos(world.S, ex), lock = ex.minLv && game.lvl < ex.minLv;
    return { T, path, next: { ...p, ex, label: sceneTitle(SCENES[ex.to]), lock } };
  },
  // ---- 指引条（DOM） ----
  bar() {
    if (!this.el) { this.el = h('div', { id: 'qguide', hidden: '' }); dom.prepend(this.el); }
    const P = this.cur, T = P && P.T, show = !!T && game.scene === 'town' && ui.panelOn() && !menus.hudHidden() && uiPref('questGuide') !== false;
    if (this.el.hidden === show) this.el.hidden = !show;
    if (!show) return;
    const where = T.none ? '' : T.scene === world.S.id ? (T.kind === 'scene' ? '已到达' : '就在这里') : (P.path ? P.path.map(ex => sceneTitle(SCENES[ex.to])).join(' → ') : '暂时去不了');
    const lock = P.next && P.next.lock ? `（需要 Lv.${P.next.ex.minLv}）` : '';
    const sig = `${T.q.id}|${T.what}|${where}|${lock}|${this.auto}`; if (this.el._sig === sig) return; this.el._sig = sig;
    const canGo = !T.none && P.next && !P.next.lock;
    this.el.replaceChildren(
      h('div', {}, h('span', { class: 't' }, '任务指引'), h('span', { class: 'tgt' }, T.what),
        canGo ? h('button', { class: this.auto ? 'stop' : '', onclick: e => { e.currentTarget.blur(); this.toggleAuto(); } }, this.auto ? '停止' : '自动前往') : null),
      T.none ? h('div', { class: 'rt' }, `「${T.q.name}」`) : h('div', { class: 'rt' }, T.scene === world.S.id ? '目标在当前区域 · ' : '路线：', h('b', {}, where), lock));
  },
  toggleAuto() { this.auto = !this.auto; this.arrived = false; if (!this.auto) this.release(); sfx.click(); this.el._sig = null; },
  release() { const V = input.virt; for (const k of ['left', 'right', 'up', 'down']) delete V[k]; input.runDir = 0; },
  // ---- 自动前往：模拟按方向键 ----
  drive(dt) {
    if (!this.auto) return;
    const p = game.player, P = this.cur, n = P && P.next;
    const cancel = ['left', 'right', 'up', 'down'].some(a => (KEYMAP[a] || []).some(k => input.down.has(k)));
    if (cancel || !n || n.lock || !p) { this.auto = false; this.release(); if (this.el) this.el._sig = null; return; }
    if (menus.modal() || menus.isOpen('dungeon')) { this.release(); if (menus.isOpen('dungeon') || menus.isOpen('npc')) { this.auto = false; if (this.el) this.el._sig = null; } return; }
    const V = input.virt; this.release();
    let tx = n.x, ty = n.y;
    if (n.final && P.T.kind === 'npc') {   // 走到 NPC 身边：站在 NPC 靠近玩家的一侧
      tx = n.x + (p.x < n.x ? -46 : 46); ty = n.y;
      if (Math.abs(p.x - tx) < 18 && Math.abs(p.y - ty) < 14) { this.auto = false; this.release(); this.el._sig = null; const e = world.npcs.find(x => x.npc.id === P.T.npc); if (e) openNpc(e.npc); return; }
    }
    const dx = tx - p.x, dy = ty - p.y, ex = n.ex;
    // 出口：到了边缘继续往外推，触发换场景
    const push = ex && ((ex.side === 'left' && p.x <= EXIT_ZONE + 60) || (ex.side === 'right' && p.x >= world.S.width - EXIT_ZONE - 60) || ((ex.side === 'up' || ex.side === 'down') && Math.abs(dx) < 30));
    if (push) { V[ex.side] = 1; if (ex.side === 'up' || ex.side === 'down') { if (Math.abs(dx) > 8) V[dx < 0 ? 'left' : 'right'] = 1; } return; }
    if (Math.abs(dx) > 10) { V[dx < 0 ? 'left' : 'right'] = 1; if (Math.abs(dx) > 160) input.runDir = dx < 0 ? -1 : 1; }
    if (Math.abs(dy) > 6) V[dy < 0 ? 'up' : 'down'] = 1;
  },
  // ---- 屏幕上的箭头（UI 画布，逻辑坐标 1920×1080；世界层 960×540 → ×2） ----
  draw(c) {
    const P = this.cur, n = P && P.next; if (!n || game.scene !== 'town' || !ui.panelOn() || uiPref('questGuide') === false) return;
    const k = UW / WW, X = sx(n.x) * k, t = performance.now() / 1000, bob = Math.sin(t * 5) * 8;
    const npcE = n.final && P.T.kind === 'npc' ? world.npcs.find(x => x.npc.id === P.T.npc) : null;
    const headY = npcE ? sy(n.y, npcE.npc.h + 58) * k : n.final ? sy(n.y, 150) * k : sy(n.y, 70) * k;
    c.save();
    if (X > 60 && X < UW - 60) {   // 画面里：头顶跳动的金色箭头 + 名字
      const y = Math.max(90, headY) + bob;
      c.fillStyle = n.lock ? '#b0a090' : '#ffd23a'; c.strokeStyle = '#3a2208'; c.lineWidth = 4;
      c.beginPath(); c.moveTo(X, y + 26); c.lineTo(X - 20, y); c.lineTo(X - 8, y); c.lineTo(X - 8, y - 22); c.lineTo(X + 8, y - 22); c.lineTo(X + 8, y); c.lineTo(X + 20, y); c.closePath(); c.stroke(); c.fill();
      const lx = clamp(X, 190, UW - 190), al = X > UW - 190 ? 'right' : X < 190 ? 'left' : 'center';   // 靠近屏幕边缘时文字往里收，不被裁掉
      if (!n.final && !(n.ex && (n.ex.side === 'left' || n.ex.side === 'right' || n.ex.side === 'down'))) uiText(`${n.label}${n.lock ? `（Lv.${n.ex.minLv}）` : ''}`, al === 'right' ? UW - 24 : al === 'left' ? 24 : lx, y - 34, { size: 22, align: al, color: '#ffe8a8', sw: 5 });
    } else {   // 画面外：屏幕边缘的方向箭头
      const left = X <= 60, ex = left ? 34 : UW - 34, y = 540;
      c.translate(ex, y); if (left) c.scale(-1, 1);
      c.globalAlpha = 0.75 + Math.sin(t * 6) * 0.25; c.fillStyle = '#ffd23a'; c.strokeStyle = '#3a2208'; c.lineWidth = 4;
      c.beginPath(); c.moveTo(22, 0); c.lineTo(-10, -26); c.lineTo(-10, 26); c.closePath(); c.stroke(); c.fill();
      c.setTransform(uiScale, 0, 0, uiScale, 0, 0); c.globalAlpha = 1;
      uiText(`${n.final ? P.T.name || '目标' : n.label}`, left ? 64 : UW - 64, y + 8, { size: 22, align: left ? 'left' : 'right', color: '#ffe8a8', sw: 5 });
    }
    c.restore();
  },
  tick() {
    const now = performance.now();
    if (now - this.t > 250 || this.auto) { this.t = now; this.cur = game.scene === 'town' && world ? this.plan() : null; }
    this.bar();
  },
};
// 每帧：先算指引、驱动自动前往（在玩家读输入之前），画面上的箭头画在 HUD 之后
{ const wu0 = worldUpdate; worldUpdate = function (dt) { guide.tick(); guide.drive(dt); return wu0.apply(this, arguments); }; }
{ const draw0 = ui.draw; ui.draw = function () { draw0.apply(this, arguments); if (game.scene === 'town') { uctx.setTransform(uiScale, 0, 0, uiScale, 0, 0); guide.draw(uctx); } else guide.bar(); }; }
