/* =====================================================================
   决斗场排位赛（客户端）：P 键 / 维尔·克鲁的决斗场窗口多一个“排位赛”页（段位、积分、今日奖励、排行榜、开始匹配）
   - 服务端 server/modules/arena.js 负责匹配 / 积分 / 奖励；真人对手走好友决斗的同一套联机流程（net/pvp.js，房间 meta.arena = 对局 id）
   - 等太久没有真人：服务端派一个 AI 对手，这边用 game/duel.js 的 AI 在本地打（公正决斗规则一样），打完上报结果
   - 名牌：打过排位的角色在城镇名牌前面显示段位小徽章（hello 的 title 字段带“段位·xx”）
   ===================================================================== */
const ARENA_TIERS = [[0, '青铜', '#d09060'], [1100, '白银', '#d8e0e8'], [1300, '黄金', '#ffd24a'], [1500, '白金', '#7ae8d8'], [1700, '钻石', '#8ab8ff'], [1900, '斗神', '#ff6a5a']];
const arenaTier = r => { let t = ARENA_TIERS[0]; for (const T of ARENA_TIERS) if (r >= T[0]) t = T; return { name: t[1], col: t[2] }; };
const arenaTierCol = name => (ARENA_TIERS.find(t => t[1] === name) || ARENA_TIERS[0])[2];
const arena = {
  st: null, q: null, cur: null, saved: null, top: null, box: null,
  on() { return typeof netOn === 'function' && !!netOn() && !!net.user && !!save.data; },
  cid() { return save.data ? String(save.data.created) : '0'; },
  games() { const s = this.st; return s ? s.win + s.lose + s.draw + s.aiWin + s.aiLose : 0; },
  async load() {
    if (!this.on()) return null;
    try { this.st = await net.api('GET', '/api/arena?cid=' + encodeURIComponent(this.cid())); } catch (e) { return null; }
    if (typeof netTown !== 'undefined' && netTown.hello) try { netTown.hello(); } catch (e) { /* 名牌下次再发 */ }
    this.draw(); return this.st;
  },
  canQueue() {
    if (!this.on() || !net.connected) return '没有连上服务器';
    if (!game.player || game.scene !== 'town' || !save.live) return '在城镇里才能排队';
    if (netDuel.active() || this.cur) return '正在决斗中';
    if (typeof coop !== 'undefined' && coop.active()) return '组队地下城中不能排队';
    return null;
  },
  join() {
    const why = this.canQueue(); if (why) { toastMsg(why, '#ffd0a0'); return; }
    const d = save.data, p = game.player;
    net.send({ t: 'arena:join', cid: this.cid(), char: { name: d.name || CLASSES[p.cls].name, cls: p.cls, job: game.job || null } });
  },
  leave() { if (this.q) net.send({ t: 'arena:leave' }); this.q = null; this.draw(); },
  /* ---------------- AI 对局（本地模拟） ---------------- */
  startAi(m) {
    const busy = !game.player || game.scene !== 'town' || !save.live || netDuel.active() || (typeof coop !== 'undefined' && coop.active());
    if (busy) { net.send({ t: 'arena:end', id: m.id, abort: 1 }); this.cur = null; return; }
    const V = m.vs, cls = CLASSES[V.cls] ? V.cls : 'sword', job = V.job && CLASSES[cls].jobs && CLASSES[cls].jobs[V.job] ? V.job : null;
    const mine = netDuel.kit();
    menus.closeAll(); input.clearAll();
    this.cur.state = 'load';
    withLoading(netDuel.bundles(mine, { cls, look: null }), () => {
      const C = this.cur; if (!C || C.id !== m.id || C.state !== 'load') return;
      if (game.scene !== 'town' || !save.live) { net.send({ t: 'arena:end', id: m.id, abort: 1 }); this.cur = null; return; }
      netDuel.freeze.call(this);   // 和好友决斗一样：先存档、停写、清空消耗品快捷栏
      duel.start({ a: mine.cls, b: cls, ja: mine.job, jb: job, lv: DUEL_CFG.lv, ai: V.lvl || 2, auto: false, theme: DUEL_THEME, nameA: mine.name, nameB: V.name + '「AI」', me: { skillBar: mine.bar } });
      if (typeof avatarSetLook === 'function' && mine.look) avatarSetLook(duel.a.model, mine.look);
      C.state = 'fight';
      chatSys(`排位赛开始：你 vs ${V.name}（${V.tier} · ${arenaJobName(cls, job)}）「AI」`);
    });
  },
  tick() {
    const C = this.cur;
    if (C && C.ai && C.state === 'fight' && duel.state === 'result' && duel.result) {
      C.state = 'end'; const w = duel.result.winner;
      net.send({ t: 'arena:end', id: C.id, win: w === 0, draw: w < 0 });
      setTimeout(() => this.back(), 3500);
    }
  },
  back() {
    const S = this.saved;
    game.pvp = false; game.pvpNet = false; game.duel = null; game.timeStop = 0; game.cutin = null; game.slowmo = false; duel.state = 'none';
    ents.length = 0; projs.length = 0; fxList.length = 0; groundFx.length = 0; numList.length = 0;
    if (S) inv.quick = S.quick;
    this.saved = null; if (this.cur && this.cur.ai) this.cur = null;
    if (save.data) return startGameNow(save.data.cls);
  },
  aiFight() { return !!(this.cur && this.cur.ai && (this.cur.state === 'fight' || this.cur.state === 'end')); },
  /* ---------------- 窗口：排位赛页 ---------------- */
  draw() {
    const B = this.box; if (!B) return;   // 窗口刚建好时还没挂到页面上，照样画
    const s = this.st;
    if (!this.on()) { B.replaceChildren(h('div', { class: 'small dim' }, '登录后才能打排位赛（练习赛不用登录）。')); return; }
    if (!s) { B.replaceChildren(h('div', { class: 'small dim' }, '读取中…')); return; }
    const T = arenaTier(s.rating), n = s.win + s.lose + s.draw;
    const badge = h('div', { class: 'arbadge', style: `border-color:${T.col};color:${T.col}` }, T.name);
    const info = h('div', { class: 'col', style: 'gap:.15em;flex:1' },
      h('div', {}, h('b', { style: `color:${T.col};font-size:1.25em` }, `${T.name}  ${s.rating}`), h('span', { class: 'small dim' }, `  最高 ${s.best}`)),
      h('div', { class: 'small' }, `真人 ${s.win} 胜 ${s.lose} 负${s.draw ? ` ${s.draw} 平` : ''}${n ? `（胜率 ${Math.round(s.win / n * 100)}%）` : ''} · AI ${s.aiWin} 胜 ${s.aiLose} 负`),
      h('div', { class: 'small' }, `今日：${s.today.first ? '首胜已领取' : '首胜未完成'} · 胜利点券 ${s.today.cera}/${s.reward.ceraCap}`));
    const wait = this.q ? Math.floor((Date.now() - this.q.t0) / 1000) : 0;
    const btn = h('button', { class: 'btn big', onclick: () => { sfx.click && sfx.click(); this.q ? this.leave() : this.join(); } }, this.q ? `取消匹配（已等待 ${wait} 秒）` : this.cur ? '对局进行中…' : '开始匹配（排位赛）');
    if (this.cur) btn.disabled = true;
    this.btn = btn;
    const R = s.reward, rules = h('div', { class: 'dueltip' },
      `自动匹配积分相近的玩家；等待 ${Math.round(s.aiAfter / 1000)} 秒还没有人时匹配 AI 对手（AI 局积分减半，${arenaTier(s.aiCap).name}以上赢 AI 不加分）。`,
      h('br'), `每胜：金币 ${fmtNum(R.gold)}（AI 局 ${fmtNum(R.aiGold)}，每天前 ${R.goldWins} 胜）、点券 +${R.cera}（每天最多 ${R.ceraCap}）；每日首胜再加 ${fmtNum(R.first.gold)} 金币 + ${R.first.cera} 点券。开打后逃跑判负。`);
    const tiers = h('div', { class: 'artiers' }, ...ARENA_TIERS.map(([lo, nm, col]) => h('span', { style: `color:${col}` }, `${nm} ${lo}+`)));
    const top = h('div', { class: 'col artop' }, h('b', {}, '排行榜'), ...(this.top ? this.top.slice(0, 8).map(e => h('div', { class: 'row', style: 'gap:.5em' },
      h('span', { style: 'width:1.6em;opacity:.7' }, e.rank), h('span', { style: 'flex:1' }, e.char || e.user, h('span', { class: 'small dim' }, '  ' + arenaJobName(e.cls, e.job))),
      h('span', { style: `color:${arenaTierCol(e.tier)}` }, `${e.tier} ${e.rating}`))) : [h('div', { class: 'small dim' }, '读取中…')]),
    h('button', { class: 'btn', onclick: () => { if (typeof SXR !== 'undefined') SXR.board = 'arena'; menus.close('duel'); menus.open('rank'); } }, '完整排行榜'));
    if (this.top && !this.top.length) top.insertBefore(h('div', { class: 'small dim' }, '还没有人打过排位赛'), top.lastChild);
    B.replaceChildren(h('div', { class: 'row', style: 'gap:.8em;align-items:center' }, badge, info), btn, tiers, rules, top);
  },
  async loadTop() { try { const r = await net.api('GET', '/api/rank?board=arena&scope=all'); this.top = r.list || []; } catch (e) { this.top = []; } this.draw(); },
};
const arenaJobName = (cls, job) => { const C = CLASSES[cls]; if (!C) return ''; const J = job && C.jobs && C.jobs[job]; return J ? J.name : C.name; };
/* ---- 服务端消息 ---- */
net.on('arena:queued', m => { arena.q = { t0: arena.q ? arena.q.t0 : Date.now(), aiAfter: m.aiAfter }; if (arena.st) { arena.st.rating = m.rating; } toastMsg(`开始匹配排位赛（${m.tier} ${m.rating}）…`, '#ffe8a8'); arena.draw(); });
net.on('arena:left', m => { arena.q = null; if (m.why === 'busy') chatSys('你进入了地下城或决斗，已退出排位匹配'); arena.draw(); });
net.on('arena:note', m => { toastMsg(m.text, '#ffd0a0'); chatSys(m.text); });
net.on('arena:match', m => {
  arena.q = null; arena.cur = { id: m.id, ai: m.ai, vs: m.vs, state: 'wait', t: Date.now() };
  const V = m.vs, t = `匹配成功！对手：${V.name}（${V.tier} ${V.rating} · ${arenaJobName(V.cls, V.job)}）${m.ai ? '「AI」' : ''}`;
  toastMsg(t, '#ffe08a'); chatSys(t); sfx.open && sfx.open();
  if (m.ai) arena.startAi(m);
  arena.draw();
});
net.on('arena:result', m => {
  if (arena.cur && arena.cur.id === m.id && !arena.cur.ai) arena.cur = null;
  if (arena.cur && arena.cur.id === m.id && arena.cur.ai && !arena.aiFight()) arena.cur = null;
  let t;
  if (m.void) t = `排位赛不计分（${m.why === 'disputed' ? '双方结果不一致' : m.why === 'cancel' ? '对局没有开始' : '对局取消'}）`;
  else {
    const T = arenaTier(m.rating), rw = m.reward;
    t = `排位赛${m.draw ? '平局' : m.win ? '胜利' : '失败'}${m.why === 'forfeit' ? (m.win ? '（对方逃跑）' : '（逃跑判负）') : m.why === 'escape' || m.why === 'timeout' ? '（中途离开判负）' : ''}：积分 ${m.delta >= 0 ? '+' : ''}${m.delta} → ${m.rating}（${T.name}）` +
      (rw && (rw.gold || rw.cera) ? `，奖励 ${rw.gold ? fmtNum(rw.gold) + ' 金币' : ''}${rw.gold && rw.cera ? ' + ' : ''}${rw.cera ? rw.cera + ' 点券' : ''}${rw.first ? '（含今日首胜）' : ''}已发到邮箱` : '');
  }
  chatSys(t); toastMsg(t, m.win ? '#ffe08a' : '#cfd8e0');
  arena.lastResult = m; arena.load();
});
// 真人排位：好友决斗那套流程结束时上报结果（双方各报一次）
bus.on('pvpResult', e => {
  const id = netDuel.room && netDuel.room.meta && netDuel.room.meta.arena;
  if (id && e) net.send({ t: 'arena:end', id, win: !!e.win, draw: !!e.draw });
});
// 离开城镇 / 断线：退出队列（服务端断线时也会自动移出）
bus.on('dungeonEnter', () => { if (arena.q) arena.leave(); });
bus.on('netClose', () => { arena.q = null; });
bus.on('netOpen', () => { arena.q = null; if (arena.on()) arena.load(); });
bus.on('netLogout', () => { arena.q = null; arena.st = null; arena.cur = null; });
bus.on('sceneEnter', () => { if (arena.on() && (!arena.st || arena.stCid !== arena.cid())) { arena.stCid = arena.cid(); arena.load(); } });
// AI 对局中关页面 / 系统菜单“离开决斗场”：尽量告诉服务端（中途离开判负）
addEventListener('beforeunload', () => { const C = arena.cur; if (C && C.ai && C.state === 'fight' && net.connected) net.send({ t: 'arena:end', id: C.id, abort: 2 }); });
setInterval(() => { arena.tick(); if (arena.q && arena.btn && arena.btn.isConnected) arena.btn.textContent = `取消匹配（已等待 ${Math.floor((Date.now() - arena.q.t0) / 1000)} 秒）`; }, 200);
// AI 对局结算画面：不“再来一局”，自动回城
{ const up0 = duel.update; duel.update = function (dt) { if (arena.aiFight() && this.state === 'result') { this.t += dt; return; } return up0.call(this, dt); }; }
{ const dr0 = duel.drawOverlay; duel.drawOverlay = function (c) {
  if (!arena.aiFight() || this.state !== 'result') return dr0.call(this, c);
  const s = this.state, mt = this.msgT, md = this.msgDur; this.state = 'ko'; this.msgT = 99; this.msgDur = 99;
  try { dr0.call(this, c); } finally { this.state = s; this.msgT = mt; this.msgDur = md; }
  c.save(); c.textAlign = 'center'; c.font = 'bold 16px "PingFang SC",sans-serif'; c.lineWidth = 4; c.strokeStyle = '#1a0806';
  const t = `${this.wins[0]} : ${this.wins[1]}　即将返回城镇…`; c.strokeText(t, WW / 2, 268); c.fillStyle = '#fff'; c.fillText(t, WW / 2, 268); c.restore();
}; }
// 排队中：屏幕上方提示
netUiHooks.push(c => {
  if (!arena.q || game.duel) return;
  uiText(`排位赛匹配中… ${Math.floor((Date.now() - arena.q.t0) / 1000)} 秒（P 键取消）`, 960, 128, { size: 20, align: 'center', color: '#ffe08a', sw: 3 });
});
/* ---- 决斗场窗口：排位赛 / 练习赛两页 + 公正决斗说明 ---- */
{ const w0 = menus.w_duel; menus.w_duel = function (arg) {
  const el = w0.call(this, arg); if (!el) return el;
  const bd = el.querySelector('.duelwin'); if (!bd) return el;
  const practice = h('div', { class: 'col', style: 'gap:.5em' }, ...bd.childNodes);
  const ranked = h('div', { class: 'col', style: 'gap:.55em' });
  const note = h('div', { class: 'arfair' }, '决斗场内属性统一，装备与强化不影响胜负');
  let tab = arena.on() ? (arena.tab || 'rank') : 'practice';
  const tabs = h('div', { class: 'itabs' });
  const show = () => { arena.tab = tab; tabs.replaceChildren(...[['rank', '排位赛'], ['practice', '练习赛（AI）']].map(([id, nm]) => h('div', { class: 'itab' + (tab === id ? ' on' : ''), onclick: () => { tab = id; show(); } }, nm))); ranked.hidden = tab !== 'rank'; practice.hidden = tab !== 'practice'; };
  bd.replaceChildren(note, tabs, ranked, practice); show();
  arena.box = ranked; arena.draw();
  if (arena.on()) { arena.load(); arena.loadTop(); }
  return el;
}; }
addStyle('.arfair{font-size:.85em;color:#9fe8b0;background:rgba(80,200,120,.08);border:.06em solid rgba(120,220,150,.35);border-radius:.25em;padding:.25em .6em}' +
  '.arbadge{width:3.2em;height:3.2em;border:.14em solid;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:900;background:rgba(0,0,0,.35)}' +
  '.artiers{display:flex;gap:.7em;flex-wrap:wrap;font-size:.8em}.artop{gap:.2em;border-top:.06em solid rgba(232,194,106,.3);padding-top:.4em;font-size:.9em}');
/* ---- 城镇名牌上的段位徽章 ---- */
{ const ci0 = netCharInfo; netCharInfo = function () { const r = ci0(); if (r && !r.title && arena.st && arena.games() > 0) r.title = '段位·' + arenaTier(arena.st.rating).name; return r; }; }
{ const np0 = netNamePlate; netNamePlate = function (c, X, ny, ch, acct, id, a = 1, hot = false) {
  np0.call(this, c, X, ny, ch, acct, id, a, hot);
  const m = ch && typeof ch.title === 'string' && /^段位·(.+)$/.exec(ch.title); if (!m) return;
  c.save(); c.globalAlpha = a; c.font = 'bold 10px "PingFang SC","Microsoft YaHei",sans-serif';
  const w = c.measureText(`Lv.${ch.lvl} ${ch.name}`).width, bx = X - w / 2 - 9, by = ny - 4;
  c.fillStyle = 'rgba(10,8,14,.85)'; c.beginPath(); c.arc(bx, by, 6.5, 0, TAU); c.fill();
  c.strokeStyle = arenaTierCol(m[1]); c.lineWidth = 1.5; c.stroke();
  c.fillStyle = arenaTierCol(m[1]); c.font = 'bold 8px "PingFang SC","Microsoft YaHei",sans-serif'; c.textAlign = 'center'; c.fillText(m[1][0], bx, by + 3);
  c.restore();
}; }
