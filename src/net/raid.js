/* =====================================================================
   团本客户端（RA2，docs/RAID_PLAN.md §3~§4.2；消息表见 docs/NETWORK.md「团本」）：会话状态、进节点、局内上报、跨节点效果、离线单人
   - 会话以服务端为准（raid 全量 / raid:d 增量）。没登录（离线单文件 / 不登录直接玩）时在本地跑同一份规则核心
     （raidInit / raidEvent / raidTick），只能打引导（单人），会话存在存档 save.data.raidRun 里，刷新后接着打
   - 进节点：raid:enter → raid:entered（dg 节点地下城、scale 数值、hpStart / cp 存档点、buffs 已经生效的效果）
       单独进 = 本地单人实例；一起进 = 队长走组队房间（coop.lead 的 meta 带 { raid, node, run }），队员按组队流程跟进
   - 上报 raid:ev（q = 这次挑战里自己的序号，从 1 递增）：hp（主机，血量每变 5%）/ down / clear / fail / death / revive / cp（存档点，主机每 3 秒）
       没收到 raid:ack 的留在队列里，断线重连后原样补发（服务端按 q 去重），回执到了才删；刷新页面也不丢（localStorage）
   - 顺序 / 同步节点（守门人、维塔 / 奈克斯）：领主血量打空时先“按住”（1 血、无敌、倒地、不动），报 down 等服务端裁决：
       clear / done → 真的倒下；heal（错序）→ 回满血接着打；revive（双生没同步）→ 按比例复活。断线时一直按住，重连后按会话状态对齐
   - 节点不耗疲劳；复活要先向会话要次数（revive → life）；倒下且不复活 = death（侵蚀）；打完 / 倒下都回营地（v1 = 暗黑城）并打开情况板
   - 界面在 ui/raid.js（入口窗口、攻坚情况板、局内 HUD、阶段结算）
   ===================================================================== */
// ---- 兼容对照：旧版本或热更新漏文件时仍能安全进入；正式 RA3 节点优先使用 DUNGEONS['raid_si_*'] ----
const RAID_FALLBACK_DG = {
  raid_si_law: 'pain_gate', raid_si_dawn: 'wit_gate', raid_si_night: 'wit_gate', raid_si_memory: 'pain_gate', raid_si_mirror: 'law_gate',
  raid_si_gate_l: 'law_gate', raid_si_gate_r: 'law_gate', raid_si_gate_duo: 'law_gate',
  raid_si_sub: 'siroco_coffin', raid_si_con: 'siroco_coffin', raid_si_mutant: 'wit_gate', raid_si_coffin: 'siroco_coffin',
};
const RAID_CAMP = { scene: 'siroco_town', x: 1040, y: 60 };   // 营地：v1 就是暗黑城（阿甘左旁边）
const RAID_ITEM_NAME = { raid_petal: '紫英花瓣' };   // 兼容旧存档里尚未登记的奖励 key
const RAID_TZ = 480;   // 每天 / 每周次数按北京时间（和服务端一致）
// 节点地下城：正式 RA3 定义直接用；仅在旧客户端缺少节点定义时回退到兼容地图。
function raidNodeDef(dg, e) {
  const real = DUNGEONS[dg];
  if (real && !real.raidFallback) {
    if (raidNet.fast && !real.raidFast) DUNGEONS[dg] = { ...real, fixed: null, rooms: 1, branches: 0, bossAdds: 0, raidFast: true };   // 测试直达：固定房间结构也跳过
    return DUNGEONS[dg];
  }
  const base = DUNGEONS[RAID_FALLBACK_DG[dg]] || DUNGEONS.siroco_coffin;
  if (!base) return null;
  const lvl = e && e.scale && e.scale.lvl;
  const D = { ...base, id: dg, name: (e && e.name) || base.name, raid: true, raidFallback: base.id, beforeEnter: undefined, preBoss: undefined, hidden: true,
    desc: `【团本节点】临时使用「${base.name}」的地图（RA3 做好团本地下城后替换）`, boss: { ...base.boss, lvl: lvl || base.boss.lvl } };
  if (raidNet.fast) Object.assign(D, { rooms: 1, branches: 0, bossAdds: 0 });
  DUNGEONS[dg] = D;
  return D;
}
const raidNet = {
  S: null, off: 0, limits: null, invite: null, L: null, ctx: null, queue: [], feed: [], claims: {}, lastSt: null, markFor: null, back: false, flipState: null,
  fast: PARAMS.has('raidfast'),   // 测试：节点直达领主房、领主血量 ×0.05（服务端要 DNF_RAID_FAST=1，不然“太快”会被拒）
  local() { return !netOn(); },
  me() { return this.local() ? 1 : net.user ? net.user.id : 0; },
  now() { return Date.now() + this.off; },
  cid() { return save.data ? String(save.data.created) : '0'; },
  char() { const d = save.data || {}, p = game.player; return { name: d.name || '', cls: p ? p.cls : d.cls, job: game.job || null, lvl: game.lvl }; },
  def() { return RAID_DEFS[(this.S && this.S.raid) || 'siroco']; },
  graph() { return this.S ? RAID_CORE.graph(this.S.raid, this.S.graph) : null; },
  phase(id) { const G = this.graph(), k = id || (this.S && this.S.phase); return G && k ? G.phases.find(P => P.id === k) || null : null; },
  node(id) { const P = this.phase(); return P && Object.prototype.hasOwnProperty.call(P.nodes, id) ? P.nodes[id] : null; },
  mine() { return this.S ? this.S.members.find(m => m.uid === this.me()) || null : null; },
  mate() { return this.S ? this.S.members.find(m => m.uid !== this.me() && !m.left) || null : null; },
  live() { return !!this.S && !!RAID_CORE.LIVE[this.S.st]; },
  flipRecord(sid, phase) {
    const key = `${sid}:${phase}`, d = save.data || {};
    return d.raidFlipState && d.raidFlipState[key] || null;
  },
  flipClosed(sid, phase) {
    const F = this.flipRecord(sid, phase);
    if (F && (F.closed || F.state === 'closed')) return true;
    const S = this.S;
    // 全员都已关牌时，服务端公开的阶段状态足以证明当前角色也已完成。
    return !!(S && S.sid === sid && S.flip && S.flip.phase === phase && S.flip.state === 'closed');
  },
  pendingFlip() {
    const S = this.S, M = this.mine();
    if (!S || !M || M.rw === false) return false;
    return (S.res && S.res.phases || []).some(ph => !this.flipClosed(S.sid, ph));
  },
  inNode() { const C = this.ctx; return !!(C && C.started && !C.done && game.dungeon && game.dungeon.raid === C); },
  say(text, col) { this.feed.unshift({ t: Date.now(), text, col: col || '#e8d8ff' }); if (this.feed.length > 40) this.feed.length = 40; },
  changed() { bus.emit('raidChange', {}); },
  /* ---------------- 发给会话（在线走 WS，离线走本地规则核心）---------------- */
  send(t, o = {}) {
    if (this.local()) { this.localSend(t, o); return true; }
    if (!net.send({ t, ...o })) { toastMsg('没有连上服务器，稍后再试', '#ff9a6a'); return false; }
    return true;
  },
  create(mode) { return this.send('raid:create', { raid: 'siroco', mode, cid: this.cid(), char: this.char() }); },
  join(sid) { return this.send('raid:join', { sid, cid: this.cid(), char: this.char() }); },
  ready(on) { return this.send('raid:ready', { on }); },
  start() { return this.send('raid:start'); },
  leave() { return this.send('raid:leave'); },
  enter(node, together) { const M = this.mate(); return this.send('raid:enter', { node, with: together && M ? [M.uid] : undefined }); },
  mark(uid, node) { return this.send('raid:mark', { uid, node }); },
  claim(phase) { return this.S && this.send('raid:claim', { sid: this.S.sid, phase }); },
  setLootMode(mode) { return this.S && this.send('raid:loot', { sid: this.S.sid, mode }); },
  flip(op, phase, index) { return this.S && this.send('raid:flip', { sid: this.S.sid, op, phase, index }); },
  // 不再看这个会话（结束了 / 离开了）：情况板关掉，本地存的也清掉
  dismiss() {
    if (this.pendingFlip()) { toastMsg('请先完成所有阶段翻牌，再关闭团本', '#ffd0a0'); return false; }
    if (this.L && !RAID_CORE.LIVE[this.L.S.st]) { this.L = null; if (save.data) { save.data.raidRun = null; save.write(); } }
    if (!this.live()) { this.S = null; this.lastSt = null; if (save.data) save.data.raidLast = null; }
    this.changed();
    return true;
  },
  async fetch() {
    if (this.local()) { this.limits = RAID_CORE.limits('siroco', save.data && save.data.raidWeek, Date.now(), RAID_TZ); this.changed(); return this.limits; }
    try {
      const r = await net.api('GET', '/api/raid?raid=siroco&cid=' + encodeURIComponent(this.cid()));
      this.limits = r.limits; this.limitsT = Date.now(); this.invite = r.invite; this.off = r.now - Date.now();
      if (r.run) this.S = r.run; else if (this.live()) this.S = null;
      this.changed(); return r;
    } catch (e) { return null; }
  },
  /* ---------------- 实例上报（带序号排队，回执到了才删）---------------- */
  evc(C, e, v) {
    if (!C || (!C.isHost && (e === 'hp' || e === 'down' || e === 'clear' || e === 'cp' || e === 'boss'))) return;
    const m = { t: 'raid:ev', sid: C.sid, node: C.node, run: C.run, q: ++C.q, e };
    if (v !== undefined) m.v = v;
    if (e === 'hp' || e === 'cp') this.queue = this.queue.filter(x => x.sent || x.m.run !== m.run || x.m.e !== e);   // 没发出去的旧血量 / 存档点不用补发了
    const it = { m, sent: false }; this.queue.push(it);
    this.persist();
    if (this.local()) { it.sent = true; this.localSend('raid:ev', m); } else it.sent = net.send(m);
  },
  ev(e, v) { this.evc(this.ctx, e, v); },
  flush() { if (this.local() || !net.connected) return; for (const it of this.queue) it.sent = net.send(it.m) || it.sent; },
  // 刷新页面也不丢：排队的上报 + 当前挑战（刷新后发现自己还挂在节点里，就报 lost 把节点放出来）
  pkey() { return net.user ? 'dawnbreak_raid_' + net.user.id : null; },
  persist() {
    const k = this.pkey(); if (!k) return;
    const C = this.ctx, v = { ctx: C && !C.done ? { sid: C.sid, run: C.run, node: C.node, q: C.q, isHost: C.isHost } : null, queue: this.queue.map(x => x.m) };
    try { if (v.ctx || v.queue.length) localStorage.setItem(k, JSON.stringify(v)); else localStorage.removeItem(k); } catch (e) { /* 无痕模式 */ }
  },
  restore() {
    const k = this.pkey(); if (!k) return;
    let v = null; try { v = JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { v = null; }
    if (!v) return;
    for (const m of v.queue || []) if (!this.queue.some(x => x.m.run === m.run && x.m.q === m.q)) this.queue.push({ m, sent: false });
    const P = v.ctx, me = this.mine();
    if (P && (!this.ctx || this.ctx.run !== P.run) && this.S && this.S.sid === P.sid && me && me.at === P.node) this.evc({ ...P, isHost: true }, 'fail', 'lost');
    this.persist();
  },
  /* ---------------- 收消息 ---------------- */
  recv(m) { const f = this.H[m.t]; if (f) { try { f.call(this, m); } catch (e) { console.error('团本消息处理出错', m.t, e); } } },
  H: {
    raid(m) {
      if (!m.run) return;
      if (this.quiet === m.run.sid && RAID_CORE.LIVE[m.run.st]) this.quiet = null;
      if (!this.S || this.S.sid !== m.run.sid) this.flipState = null;
      this.S = m.run; this.off = m.now - Date.now();
      if (save.data && !this.local()) save.data.raidLast = { sid: m.run.sid, t: Date.now() };
      if (m.resume) { this.restore(); this.flush(); }
      this.stateChanged(); this.reconcile(); this.changed();
    },
    'raid:d'(m) {
      if (!this.S || this.S.sid !== m.sid) return;
      Object.assign(this.S, m.set || {});
      for (const id in m.nodes || {}) this.S.nodes[id] = m.nodes[id];
      this.off = m.now - Date.now();
      this.stateChanged(); this.reconcile(); this.changed();
    },
    'raid:entered'(m) { this.onEntered(m); },
    'raid:ack'(m) { this.onAck(m); },
    'raid:fx'(m) { this.onFx(m); },
    'raid:note'(m) {
      const mine = this.ctx && m.node && m.node === this.ctx.node;
      this.say(m.text, m.bad ? '#ffa08a' : mine ? '#ffe070' : null);
      if (m.bad || mine || !this.inNode()) toastMsg(m.text, m.bad ? '#ff9a7a' : '#e0c0ff');
      if (!m.bad) chatSys('【团本】' + m.text);
      if (m.bad && m.code === 'flip') bus.emit('raidFlipError', m);
      this.changed();
    },
    'raid:end'(m) {
      if (this.S && m.sid && this.S.sid !== m.sid) return;
      if (this.quiet && m.sid === this.quiet && m.why !== 'left' && m.why !== 'gone') {   // 登录时找回的上一次团本：不再提示，奖励都领过了就直接忘掉
        this.quiet = null;
        const S = this.S, me = this.mine(), todo = S && me && me.rw !== false && (S.res.phases || []).some(ph => !this.flipClosed(S.sid, ph));
        if (!todo) { this.S = null; this.lastSt = null; if (save.data) save.data.raidLast = null; }
        this.changed(); return;
      }
      if (m.why === 'left' || m.why === 'gone') { if (this.ctx) this.leaveNode(null); this.S = null; this.lastSt = null; if (save.data) save.data.raidLast = null; this.changed(); return; }
      if (this.S && RAID_CORE.LIVE[this.S.st]) { this.S.st = m.ok ? 'cleared' : 'failed'; this.S.why = m.why; }
      const txt = m.ok ? '团本通关！' : { timeout: '团本失败：超时了', abandon: '团本结束：大家都离开了', stale: '团本解散：大厅太久没开始', disband: '团本解散了' }[m.why] || '团本结束了';
      this.say(txt, m.ok ? '#8aff9a' : '#ffa08a'); chatSys('【团本】' + txt);
      if (this.ctx && !m.ok) this.leaveNode(txt); else toastMsg(txt, m.ok ? '#8aff9a' : '#ffb08a');   // 通关（最终战）不踢人：让结算照常出来（组队的队员可能先收到这条、后收到击杀）
      if (m.ok) this.resultDue = 2;
      this.changed();
    },
    'raid:open'(m) {
      this.invite = { sid: m.sid, raid: m.raid, mode: m.mode, leader: m.leader && m.leader.id };
      chatSys(`【团本】${m.leader ? m.leader.name : '队长'} 建了团本，去暗黑城找阿甘左加入（或者按情况板的“加入”）`);
      bus.emit('raidInvite', m); this.changed();
    },
    'raid:claimed'(m) { this.onClaimed(m); },
    'raid:flip'(m) {
      if (this.S && m.sid && this.S.sid !== m.sid) return;
      const key = `${m.sid}:${m.phase}`, saved = this.flipRecord(m.sid, m.phase), prev = this.flipState && this.flipState.sid === m.sid && this.flipState.phase === m.phase ? this.flipState : saved;
      const picks = (m.picks || (prev && prev.picks) || []).map(x => ({ index: x.index, reward: x.reward }));
      // close 的回执代表“我”已关牌；m.closed 只表示全团是否都关牌，不能拿它判断本人的锁定。
      const closed = !!(prev && prev.closed) || m.op === 'close' || (m.op === 'resume' && m.closed === true);
      m.state = closed ? 'closed' : (m.state || (m.op === 'close' ? 'open' : (prev && prev.state) || 'open'));
      m.picks = picks;
      m.closed = closed;
      this.flipState = m;
      // 奖励在明确翻开卡牌后才入包；claim 只建立待翻牌记录，避免领奖即吞下整组奖励。
      if (save.data) {
        const FS = save.data.raidFlipState || (save.data.raidFlipState = {});
        FS[key] = { phase: m.phase, state: m.state, closed, picks: picks.map(x => ({ index: x.index })) };
      }
      let credited = false;
      const creditPick = (index, reward) => {
        if (!save.data || !reward || !reward.key) return;
        const gotKey = `${m.sid}:${m.phase}:${index}`;
        const G = save.data.raidFlipGot || (save.data.raidFlipGot = {});
        if (G[gotKey]) return;
        G[gotKey] = Date.now(); this.credit(reward.key, reward.n); credited = true;
      };
      if (m.op === 'pick') creditPick(m.index, m.reward);
      // resume 也带回已翻开的牌；断在服务端已提交、客户端尚未收到 pick 回执时，
      // 刷新后的第一次 resume 必须把奖励补入包，raidFlipGot 保证重复 resume 不重复发放。
      if (m.op === 'resume') for (const pick of picks) creditPick(pick.index, pick.reward);
      if (credited) save.write();
      // raidGot 只在规定数量的牌真正翻开后记录，claim 回执本身不再提前吞掉未翻牌会话。
      if (save.data && (m.op === 'pick' || m.op === 'close' || m.op === 'resume')) {
        const limit = RAID_CORE.flipLimit ? RAID_CORE.flipLimit(m.phase) : (Number(m.phase) === 1 ? 1 : 2);
        if (picks.length >= limit) {
          const G = save.data.raidGot || (save.data.raidGot = {});
          if (!G[key]) { G[key] = Date.now(); const ks = Object.keys(G); if (ks.length > 40) for (const k of ks.sort((a, b) => G[a] - G[b]).slice(0, ks.length - 40)) delete G[k]; }
        }
        save.write();
      }
      this.changed();
    },
  },
  stateChanged() {
    const S = this.S, st = S && S.st; if (st === this.lastSt) return;
    const was = this.lastSt; this.lastSt = st;
    if (!S || !was) return;
    if (was === 'lobby' && st === 'routes') { toastMsg(`${this.phase() ? this.phase().name : '团本'}开始！`, '#ffe070'); bus.emit('raidStarted', {}); }
    if (st === 'rest') this.resultDue = 1;
  },
  /* ---------------- 进节点 ---------------- */
  onEntered(m) {
    if (this.S && m.sid !== this.S.sid) return;
    if (this.ctx && !this.ctx.done) this.ctx.done = true;
    const me = this.me(), mm = this.mine(), nd = this.node(m.node) || {};
    const def = raidNodeDef(m.dg, m);
    const C = this.ctx = { sid: m.sid, run: m.run, node: m.node, name: m.name, type: m.type, dg: def ? def.id : null, boss: null, host: m.host, by: m.by || [me], isHost: m.host === me,
      together: (m.by || []).length > 1, scale: m.scale || {}, buffs: (m.buffs || []).map(b => ({ ...b })), cp: m.cp || null, hpStart: m.hpStart || 0, order: m.order || 0,
      orderTurn: m.orderTurn !== false, sub: !!m.sub, cpNode: !!nd.cp, q: 0, hpSent: 1, cpT: 0, t0: Date.now(), practice: !!(mm && mm.rw === false),
      started: false, done: false, cleared: false, held: null, win: 0 };
    this.persist();
    const bail = why => { this.evc(C, 'fail', 'lost'); C.done = true; this.persist(); toastMsg(why, '#ff9a7a'); };
    if (!def) return bail('这个节点的地下城还没有做好');
    if (game.scene !== 'town' || !game.player || game.dungeon) return bail('现在不在城镇里，没法进节点');
    if (save.data) save.data.loc = { ...RAID_CAMP };
    menus.closeAll(); sfx.door();
    this.say(`进入「${m.name}」${C.together ? '（一起打）' : ''}`, '#ffe070');
    if (C.together) {
      if (C.isHost) {
        const lootMode = this.S && this.S.loot && this.S.loot.mode;
        if (!coop.lead(def.id, 0, { raid: m.sid, node: m.node, run: m.run, lootMode })) bail('没能开组队房间');
      }
      else setTimeout(() => { if (this.ctx === C && !C.started && !C.done) bail('没能跟上队长进入节点'); }, 30000);
      return;
    }
    withLoading(dungeonBundles(def), () => { if (this.ctx === C && !C.done && game.scene === 'town' && !game.dungeon) new Dungeon(def, 0).start(); });
  },
  // 节点里的领主刷出来：团本数值、存档点血量、已经生效的效果；顺序 / 同步节点的领主倒下要先等裁决
  bossSetup(dg, b) {
    const C = dg.raid; if (!C || b.raidSet) return;
    b.raidSet = true; C.boss = b;
    if (this.fast) { b.hpMax = Math.max(1, Math.round(b.hpMax * 0.05)); b.hp = b.hpMax; }
    const h0 = C.cp && C.cp.hp > 0 ? C.cp.hp : C.hpStart;
    if (h0 > 0 && h0 < 1) b.hp = Math.max(1, Math.round(b.hpMax * h0));
    C.hpSent = b.hp / b.hpMax;
    b.raidHold = !C.together && (C.type === 'order' || C.type === 'sync');
    for (const f of C.buffs) if (!f.until || f.until > this.now()) this.buffOn(b, f);
  },
  buffOn(b, f) {
    if (!b || b.dead) return;
    const p = f.p || {};
    if (typeof msMulSet === 'function' && p.dmgTaken) msMulSet(b, 'raid_' + f.id, p.dmgTaken);
    if (f.kind === 'groggy') { const dur = Math.max(1, ((f.until || 0) - this.now()) / 1000); b.aiCd = Math.max(b.aiCd || 0, dur); if (b.act && !b.act.superArmor) b.act = null; fxText('破防！', b.x, b.y, b.z + 150, { col: '#ffe070', size: 16, dur: 1.6 }); }
  },
  buffOff(b, id) { if (b && typeof msMulSet === 'function') msMulSet(b, 'raid_' + id, null); },
  hold(b) {
    const C = this.ctx; if (!C || b !== C.boss || C.done) return false;
    b.hp = 1; b.status = {};
    if (C.held) return true;
    C.held = { t: Date.now() }; b.raidHeld = true; b.invul = 1e9; b.raidCtl = b.control; b.control = null; b.act = null; b.vx = b.vy = 0;
    if (b.st !== 'down') b.setState('down');
    fxText('倒下了……', b.x, b.y, b.z + 150, { col: '#ffd8a0', size: 15, dur: 2 });
    this.say(`「${C.name}」的领主倒下了：等待团本裁决`, '#ffd8a0');
    this.ev('down');
    return true;
  },
  release() {
    const C = this.ctx, b = C && C.boss; if (!C || !C.held) return;
    C.held = null; if (!b || b.dead) return;
    b.raidOk = true; b.raidHeld = false; b.invul = 0; b.hp = 0; killEnt(b, game.player || b, {});
  },
  unhold(hp) {
    const C = this.ctx, b = C && C.boss; if (!C || !C.held) return;
    C.held = null; if (!b || b.dead) return;
    b.raidHeld = false; b.invul = 1.5; b.status = {};
    if (b.raidCtl !== undefined) { b.control = b.raidCtl; b.raidCtl = undefined; }
    b.hp = Math.max(1, Math.round(b.hpMax * clamp(hp || 1, 0.01, 1))); b.setState('idle'); C.hpSent = b.hp / b.hpMax;
    fxText(hp >= 1 ? '回满了血！' : `以 ${Math.round(hp * 100)}% 血复活了！`, b.x, b.y, b.z + 150, { col: '#ff8a8a', size: 16, dur: 2 });
  },
  // 会话状态和本地实例对齐（断线期间错过了裁决、被放出节点……）
  reconcile() {
    const C = this.ctx, S = this.S; if (!C || !S || S.sid !== C.sid || C.done) return;
    const N = S.nodes[C.node], me = this.mine();
    if (C.held && N && !this.queue.some(x => x.m.run === C.run && x.m.e === 'down')) {
      if (N.st === 'cleared' || N.st === 'cool' || N.st === 'off') this.release();
      else if (N.st === 'busy' || N.st === 'open') this.unhold(N.hp || 1);
    }
    if (C.started && !C.cleared && me && me.at !== C.node && !this.queue.some(x => x.m.run === C.run)) this.leaveNode('这次挑战已经结束了（离线太久或者房间没了），回到营地');
  },
  onBossDown(dg) {
    const C = dg.raid; if (!C || C.cleared || C.done) return;
    C.cleared = true; C.held = null;
    this.say(`通关「${C.name}」`, '#8aff9a');
    this.evc(C, 'clear');
  },
  onAck(m) {
    this.queue = this.queue.filter(x => !(x.m.run === m.run && x.m.q === m.q));
    this.persist();
    const C = this.ctx; if (!C || C.run !== m.run) return;
    if (m.e === 'down' && C.held) {
      if (m.ok && m.res === 'clear') this.release();
      else if (m.ok && m.res === 'heal') this.unhold(1);
      else if (!m.ok && m.code === 'fast') this.unhold(0.05);
      else if (!m.ok) this.release();
    } else if (m.e === 'revive') {
      const dg = game.dungeon; C.reviveWait = false;
      if (m.ok && m.res === 'life') { if (dg && dg.raid === C && dg.state === 'dead') { C.reviveOk = true; dg.revive(); } }
      else { C.noLife = true; toastMsg(m.res === 'nolife' ? '复活次数用完了（全团次数 / 这个节点每人 2 次）' : '现在没法复活', '#ff9a7a'); }
    }
    this.changed();
  },
  onFx(m) {
    const C = this.ctx, here = C && m.node && m.node === C.node, b = C && C.boss, p = m.p || {};
    switch (m.kind) {
      case 'buff': case 'groggy':
        if (here) { C.buffs = C.buffs.filter(x => x.id !== p.id); const f = { id: p.id, kind: m.kind, p: p.p || {}, until: p.until || 0 }; C.buffs.push(f); if (C.isHost) this.buffOn(b, f); }
        if (p.id === 'twin_guard' && here) this.say('两边血量差太大：你这边的领主减伤 50%（先把血量拉平）', '#ffb08a');
        break;
      case 'unbuff': if (here) { C.buffs = C.buffs.filter(x => x.id !== p.id); if (C.isHost) this.buffOff(b, p.id); } break;
      case 'heal':
        if (here) { if (C.held) this.unhold(1); else if (b && !b.dead && C.isHost) { b.hp = b.hpMax; C.hpSent = 1; fxText('回满了血！', b.x, b.y, b.z + 150, { col: '#ff8a8a', size: 16, dur: 2 }); } toastMsg(p.why === 'order' ? '顺序错了：守门人回满了血' : '领主回满了血！', '#ff9a8a'); }
        break;
      case 'revive': if (here) { this.unhold(p.hp || 0.5); toastMsg(`没能同时打倒：领主以 ${Math.round((p.hp || 0.5) * 100)}% 血复活了`, '#ff9a8a'); } break;
      case 'window': if (here) { C.win = p.until || 0; toastMsg(`另一边的领主倒下了：${Math.round((p.left || 30000) / 1000)} 秒内打倒你的！`, '#ffe070'); } break;
      case 'done': if (here && C.held) this.release(); break;
      case 'erosion': this.say(`被侵蚀了：${Math.max(1, Math.round((p.until - this.now()) / 1000))} 秒内不能进节点`, '#ffa08a'); break;
      case 'closed': if (here) this.leaveNode(p.why === 'host' ? '主机离开了：这次挑战结束，回到营地（存档点保留）' : '这次挑战结束了，回到营地'); break;
      case 'phase': if (p.ok) { this.say(`${(this.phase(p.phase) || {}).name || '阶段'}完成！`, '#8aff9a'); } break;
      case 'sub': this.say(p.on ? '切换到补位规则' : '恢复正常规则', '#bfe8ff'); break;
      case 'mark': this.markFor = m.node; if (m.node) { const n = this.node(m.node); toastMsg(`团长标记：去「${n ? n.name : m.node}」`, '#ffe070'); } break;
      case 'life': break;
    }
    this.changed();
  },
  // 离开节点回营地（被放出 / 团本结束 / 主机走了）
  leaveNode(msg) {
    const C = this.ctx; if (!C || C.done || C.cleared) return;
    C.done = true; this.persist();
    if (!C.started) return;
    if (msg) chatSys('【团本】' + msg);
    if (typeof coop !== 'undefined' && coop.state !== 'none' && coop.dg) { coop.leaveToTown(msg || '回到营地'); return; }
    const dg = game.dungeon;
    if (msg) toastMsg(msg, '#ffb08a');
    if (dg && dg.raid === C && game.scene === 'dungeon') { menus.closeAll(); game.paused = false; dg.state = 'failed'; game.dungeon = null; lootAll(); goTown(); }
  },
  /* ---------------- 领奖 ---------------- */
  onClaimed(m) {
    const key = m.sid + ':' + m.phase, d = save.data;
    if (m.limits) this.limits = m.limits;
    this.claims[key] = m.reward;
    if (d) {
      const F = d.raidFlipState && d.raidFlipState[key], picks = F && F.picks || [];
      if (!F) {
        const FS = d.raidFlipState || (d.raidFlipState = {});
        FS[key] = { phase: m.phase, state: 'open', closed: false, picks: [] };
      }
      if (!this.flipState || this.flipState.sid !== m.sid || this.flipState.phase !== m.phase) this.flipState = { sid: m.sid, phase: m.phase, state: F && F.state || 'open', closed: !!(F && F.closed), picks };
      save.write();
    }
    bus.emit('raidClaimed', m); this.changed();
  },
  credit(key, n) {
    if (ITEMS[key]) { giveItem(makeItem(key, n)); return; }
    const O = save.data.raidOwed || (save.data.raidOwed = {}); O[key] = (O[key] || 0) + n;   // 物品还没登记（RA3）：先记账，登记以后自动发
  },
  flushOwed() {
    const O = save.data && save.data.raidOwed; if (!O) return;
    let n = 0; for (const k of Object.keys(O)) if (ITEMS[k]) { giveItem(makeItem(k, O[k])); delete O[k]; n++; }
    if (n) { toastMsg('团本奖励到账了', '#ffe070'); save.write(); }
  },
  got(sid, phase) { return !!(save.data && save.data.raidGot && save.data.raidGot[sid + ':' + phase]); },
  itemName(k) { return ITEMS[k] ? ITEMS[k].name : RAID_ITEM_NAME[k] || k; },
  /* ---------------- 离线单人：本地跑同一份规则核心（只能引导）---------------- */
  localLoad() {
    if (this.L || !save.data || !save.data.raidRun) return;
    const S = save.data.raidRun; if (!S || !RAID_DEFS[S.raid]) return;
    this.L = { S, last: '' };
    for (const R of Object.values(S.runs || {})) if (!R.end) this.localSend('raid:ev', { node: R.node, run: R.id, e: 'fail', v: 'lost', q: ((R.q && R.q[1]) || 0) + 1 });   // 刷新前挂在节点里：放出来
    this.localOut({ S, fx: [], err: null, ack: null });
  },
  localOut(o, ev) {
    const S = o.S, me = this.me();
    this.L.last = JSON.stringify(RAID_CORE.view(S));
    this.recv({ t: 'raid', run: RAID_CORE.view(S), now: Date.now() });
    for (const f of o.fx) {
      if (f.to !== 'all' && !(f.to || []).includes(me)) continue;
      this.recv(f.kind === 'note' ? { t: 'raid:note', sid: S.sid, text: f.p.text, node: f.node } : f.kind === 'end' ? { t: 'raid:end', sid: S.sid, ...f.p }
        : f.kind === 'entered' ? { t: 'raid:entered', sid: S.sid, ...f.p } : { t: 'raid:fx', sid: S.sid, kind: f.kind, node: f.node, p: f.p });
    }
    if (ev) this.recv({ t: 'raid:ack', sid: S.sid, run: ev.run, q: ev.q, e: ev.e, ok: !o.err, ...(o.err ? { code: o.err.code, text: o.err.text } : o.ack || {}) });
    else if (o.err) this.recv({ t: 'raid:note', sid: S.sid, text: o.err.text, code: o.err.code, bad: true });
    if (save.data) { save.data.raidRun = S; save.write(); }
  },
  localSend(t, o) {
    const now = Date.now(), me = 1, bad = text => this.recv({ t: 'raid:note', text, bad: true });
    if (t === 'raid:create') {
      if (this.L && RAID_CORE.LIVE[this.L.S.st]) return bad('你已经在团本里了');
      const ch = this.char(), D = RAID_DEFS[o.raid] || RAID_DEFS.siroco;
      if (ch.lvl < D.minLvl) return bad(`需要 ${D.minLvl} 级`);
      if (o.mode !== 'guide') this.recv({ t: 'raid:note', text: '没有登录：只能打引导模式（单人）' });
      const S = RAID_CORE.init(D.id, [{ uid: me, cid: this.cid(), name: ch.name, cls: ch.cls, job: ch.job }], 'guide', now, { sid: 'local_' + now.toString(36), guard: { minClear: 0, maxDrop: 0 } });
      this.L = { S, last: '' }; this.localOut({ S, fx: [], err: null, ack: null });
      return;
    }
    if (!this.L) return t === 'raid:ev' ? this.recv({ t: 'raid:ack', run: o.run, q: o.q, e: o.e, ok: false, code: 'member' }) : bad('你不在团本里');
    const S = this.L.S;
    if (t === 'raid:ev') return this.localOut(RAID_CORE.event(S, { t: o.e, uid: me, node: o.node, run: o.run, q: o.q, v: o.v }, now), o);
    if (t === 'raid:start') {
      let rw = true;
      if (S.st === 'lobby') { const nx = RAID_CORE.consume(S.raid, save.data.raidWeek || null, now, RAID_TZ); rw = !!nx; if (nx) save.data.raidWeek = nx; this.limits = RAID_CORE.limits(S.raid, save.data.raidWeek, now, RAID_TZ); }
      return this.localOut(RAID_CORE.event(S, { t: 'start', uid: me, rw: { [me]: rw } }, now));
    }
    if (t === 'raid:leave') { this.localOut(RAID_CORE.event(S, { t: 'leave', uid: me }, now)); this.recv({ t: 'raid:end', sid: S.sid, ok: false, why: 'left' }); this.L = null; save.data.raidRun = null; save.write(); return; }
    if (t === 'raid:enter') return this.localOut(RAID_CORE.event(S, { t: 'enter', uid: me, node: o.node, with: [] }, now));
    if (t === 'raid:ready') return this.localOut(RAID_CORE.event(S, { t: 'ready', uid: me, on: o.on }, now));
    if (t === 'raid:mark') return this.localOut(RAID_CORE.event(S, { t: 'mark', uid: me, to: o.uid, node: o.node }, now));
    if (t === 'raid:resume') return this.localOut({ S, fx: [], err: null, ack: null });
    if (t === 'raid:claim') {
      const ph = o.phase | 0, C = save.data.raidClaims || (save.data.raidClaims = {}), key = S.sid + ':' + ph, lim = RAID_CORE.limits(S.raid, save.data.raidWeek, now, RAID_TZ);
    if (C[key]) { RAID_CORE.flipOpen(S, me, ph, now); RAID_CORE.flipSetReward(S, me, ph, C[key]); return this.recv({ t: 'raid:claimed', sid: S.sid, phase: ph, reward: C[key], dup: true, limits: lim }); }
      if (!S.res.phases.includes(ph)) return bad('这个阶段还没通关');
      if (!S.members[0].rw) return bad('这次是练习（本周 / 今天的次数已经用完了），没有奖励');
      const opened = RAID_CORE.flipOpen(S, me, ph, now); if (!opened.ok) return bad(opened.text);
      C[key] = RAID_CORE.rollReward(S, me, ph, Math.random);
      RAID_CORE.flipSetReward(S, me, ph, C[key]);
      return this.recv({ t: 'raid:claimed', sid: S.sid, phase: ph, reward: C[key], limits: lim });
    }
    if (t === 'raid:loot') {
      const out = RAID_CORE.setLootMode(S, me, o.mode); if (!out.ok) return bad(out.text); return this.localOut({ S, fx: [], err: null, ack: null });
    }
    if (t === 'raid:flip') {
      const ph = o.phase | 0, out = o.op === 'pick' ? RAID_CORE.flipPick(S, me, ph, o.index | 0, now, Math.random) : o.op === 'close' ? RAID_CORE.flipClose(S, me, ph, now) : RAID_CORE.flipOpen(S, me, ph, now);
      if (!out.ok) return bad(out.text); return this.recv({ t: 'raid:flip', sid: S.sid, phase: ph, op: o.op, ...out });
    }
  },
  localTick() {
    const L = this.L; if (!L || !RAID_CORE.LIVE[L.S.st] || !this.local()) return;
    const o = RAID_CORE.tick(L.S, Date.now());
    if (o.fx.length || JSON.stringify(RAID_CORE.view(L.S)) !== L.last) this.localOut(o);
  },
  /* ---------------- 每 100 毫秒：主机报血量 / 存档点；本地到期的效果撤掉 ---------------- */
  pulse() {
    const C = this.ctx, dg = game.dungeon;
    if (!C || !C.started || C.done || !dg || dg.raid !== C) return;
    const b = C.boss;
    if (C.isHost && b && !b.dead && !C.held && !C.cleared && b.hpMax > 0) {
      const f = clamp(b.hp / b.hpMax, 0, 1), r = Math.round(f * 1000) / 1000;
      if (Math.abs(f - C.hpSent) >= 0.05) { C.hpSent = f; this.ev('hp', r); }
      if (C.cpNode && Date.now() - C.cpT >= 3000) { C.cpT = Date.now(); this.ev('cp', { hp: r, ph: Number.isInteger(b.msPhase) ? clamp(b.msPhase, 0, 9) : 0 }); }
    }
    for (const f of C.buffs) if (f.until && f.until <= this.now() && !f.off) { f.off = true; if (C.isHost) this.buffOff(b, f.id); }
  },
};
/* ---------------- 地下城的包装（不改 dungeon.js）：团本节点不耗疲劳、领主数值、倒下裁决、复活次数、结算回营地 ---------------- */
const _raidDgStart = Dungeon.prototype.start;
Dungeon.prototype.start = function () {
  const C = raidNet.ctx;
  if (this.def.raid && C && !C.started && !C.done && C.dg === this.def.id) {
    C.started = true; this.raid = C; raidNet.persist();
    const sc = C.scale || {};
    this.D = { ...DIFFS[0], name: sc.guide ? '团本 · 引导' : '团本', hp: sc.hp || 1, atk: sc.atk || 1 };
  }
  return _raidDgStart.call(this);
};
const _raidSpawnRoom = Dungeon.prototype.spawnRoom;
Dungeon.prototype.spawnRoom = function (room, W, first) {
  _raidSpawnRoom.call(this, room, W, first);
  if (this.raid && !this.guest && room.type === 'boss' && this.boss) raidNet.bossSetup(this, this.boss);
};
const _raidBossDown = Dungeon.prototype.bossDown;
Dungeon.prototype.bossDown = function (b) { _raidBossDown.call(this, b); if (this.raid) raidNet.onBossDown(this); };
// 换房间的疲劳检查：团本节点不看疲劳
const _raidDgGo = Dungeon.prototype.go;
Dungeon.prototype.go = function (dir) {
  if (!this.def.raid || save.data.fatigue > 0) return _raidDgGo.call(this, dir);
  const f = save.data.fatigue; save.data.fatigue = 1;
  try { return _raidDgGo.call(this, dir); } finally { save.data.fatigue = f; }
};
const _raidUseFatigue = save.useFatigue;
save.useFatigue = function (n) { if (game.dungeon && game.dungeon.def && game.dungeon.def.raid) return; return _raidUseFatigue.call(this, n); };
// 复活：先向会话要一次（全团每阶段的次数 + 每人每节点 2 次），批下来才用复活币
const _raidRevive = Dungeon.prototype.revive;
Dungeon.prototype.revive = function () {
  const C = this.raid;
  if (!C || C.reviveOk) { if (C) C.reviveOk = false; return _raidRevive.call(this); }
  if (C.reviveWait || C.noLife || C.done) return;
  C.reviveWait = true; this.deadT = Math.max(this.deadT, 4);
  raidNet.ev('revive');
};
// 倒下且没复活：报 death（侵蚀），回营地（不给“虚弱”，团本用侵蚀代替）
const _raidFail = Dungeon.prototype.fail;
Dungeon.prototype.fail = function () {
  const C = this.raid; if (!C) return _raidFail.call(this);
  if (!C.done && !C.cleared) { raidNet.ev('death'); C.done = true; raidNet.persist(); }
  this.state = 'failed'; game.dungeon = null; recalcStats(game.player); goTown();
  toastMsg('倒下了……回到营地（被侵蚀的这段时间不能进节点）', '#ff6a6a');
};
// 顺序 / 同步节点的领主：血量打空时先按住，等会话裁决
const _raidKillEnt = killEnt;
killEnt = function (t, a, h) {
  if (t && t.raidHold && !t.raidOk && !t.dead && raidNet.hold(t)) return;
  return _raidKillEnt(t, a, h);
};
// 练习（次数用完）的节点：不掉装备
const _raidRollDrop = rollDrop;
rollDrop = function (t, dg) { if (dg && dg.raid && dg.raid.practice) return; return _raidRollDrop(t, dg); };
// 节点结算：结果层持续暂停移动；最终节点完成后才允许进入阶段翻牌。
const _raidResult = menus.w_result;
menus.w_result = function (dg) {
  const el = _raidResult.call(this, dg);
  if (el && dg && dg.raid) {
    for (const x of el.querySelectorAll('.cards, .cardlbl')) x.remove();
    const row = el.querySelector('.row.hidden'); if (row) row.classList.remove('hidden');
    const final = dg.raid.type === 'final';
    for (const b of [...el.querySelectorAll('button')]) {
      if (b.textContent === '再次挑战') b.remove();
      else if (b.textContent === '返回城镇') {
        b.textContent = final ? '进入翻牌结算' : '返回营地';
        // 原版按钮闭包要求先点免费卡；团本节点不使用本地卡牌，改为显式回营地。
        b.onclick = () => {
          const S = raidNet.S;
          if (final && (!S || S.st !== 'cleared')) { toastMsg('最终节点尚未完成，等待团本结算后才能翻牌', '#ffd0a0'); sfx.error(); return; }
          sfx.click(); dg.finishFlip(); this.close('result'); game.paused = false; lootAll(); goTown();
        };
      }
    }
    const ttl = el.querySelector('.ttl'); if (ttl) ttl.textContent = final ? 'RAID NODE CLEAR!' : 'NODE CLEAR!';
    const dim = el.querySelector('.dim'); if (dim) dim.after(h('div', { class: 'cardlbl', style: 'color:#e0c0ff' }, `团本节点「${dg.raid.name}」通关${dg.raid.practice ? '（练习）' : ''}——${final ? '完成团本后进入翻牌阶段' : '回营地看攻坚情况板'}`));
  }
  return el;
};
/* ---------------- 事件 ---------------- */
for (const t of ['raid', 'raid:d', 'raid:entered', 'raid:ack', 'raid:fx', 'raid:note', 'raid:end', 'raid:open', 'raid:claimed', 'raid:flip']) net.on(t, m => raidNet.recv(m));
bus.on('netOpen', () => {
  raidNet.flush();
  const d = save.data, L = d && d.raidLast;
  if (!raidNet.S && L && L.sid && Date.now() - L.t < 7 * 86400000) { raidNet.quiet = L.sid; net.send({ t: 'raid:resume', sid: L.sid }); }   // 刷新前的团本（结束了也能领没领的奖励）
});
bus.on('netLogout', () => { raidNet.S = null; raidNet.lastSt = null; raidNet.flipState = null; raidNet.queue = []; raidNet.changed(); });
bus.on('charLeave', () => { if (raidNet.L) { raidNet.L = null; raidNet.S = null; raidNet.lastSt = null; raidNet.flipState = null; } raidNet.changed(); });
// 回到城镇：节点结束（没打完 = 撤退），回营地后打开情况板
bus.on('sceneEnter', () => {
  raidNet.flushOwed();
  if (raidNet.local()) raidNet.localLoad();
  const C = raidNet.ctx;
  if (C && C.started) {
    if (!C.done && !C.cleared) raidNet.evc(C, 'fail', 'retreat');
    C.done = true; raidNet.ctx = null; raidNet.persist();
    if (raidNet.S) raidNet.back = true;
  }
  raidNet.changed();
});
setInterval(() => raidNet.pulse(), 100);
setInterval(() => raidNet.localTick(), 1000);
