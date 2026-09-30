/* =====================================================================
   好友决斗（1v1 PK）：发起方当主机，双方角色都在主机上模拟（沿用决斗场 game/duel.js 的规则：三局两胜、每局 60 秒、天平属性、PvP 伤害修正与保护机制）
   - 对方（队员）每帧记录手柄输入（按住 + 按下），30Hz 打包发给主机，主机按帧放进对方角色的 Pad（保留按键顺序，↓→Z 这类指令照样能搓出来）
   - 主机 30Hz 下发快照（双方位置 / 状态 / 动画 / 血蓝 / 保护条 / 回合与计时）+ 出招事件；对方那边两个角色都是“影子”，重放招式特效
   - 对方自己的角色在本地模拟（按键当帧就出招 / 移动，不等主机），主机仍然裁决命中和受击：快照带上“主机处理到第几帧输入”（iq），
     对方拿本地同一帧的位置比对、慢慢收敛；主机发来的自己的出招事件本地已经出过就不重播，没出过（判断不一致）就以主机为准补上；
     被打中 / 倒地 / 回合之间跟随主机的快照（docs/NETWORK.md「决斗的操作延迟」）；对手按快照插值
   - 决斗不改存档：开始前存一次档并停写，结束后按存档重新进城；消耗品快捷栏在决斗中禁用
   - 结束：bus.emit('pvpResult', { win, vs, wins, draw })（社交组的胜场排行用）
   入口：点其他玩家 / 好友列表的“决斗”，或者维尔·克鲁的决斗场窗口里的“好友决斗”
   ===================================================================== */
const DUEL_NET_ACTS = ['left', 'right', 'up', 'down', 'attack', 'jump', 'cmd', 'cmdB', 's0', 's1', 's2', 's3', 's4', 's5', 's6', 's7', 's8', 's9', 's10', 's11', 's12', 's13'];
const DUEL_THEME = 'ruinsDark';
const netDuel = {
  asking: null, role: null, state: 'none', room: null, peer: null, inQ: [], inDone: 0, inN: 0, lastHeld: 0, recs: [], saved: null, view: null, lastSnap: 0, endT: 0, result: null, t0: 0,
  active() { return this.state !== 'none'; },
  send(d) { return net.send({ t: 'r', d }); },
  kit() { const d = save.data, p = game.player; return { cls: p.cls, job: game.job || null, lv: { ...game.skillLv }, bar: game.skillBar.slice(0, SKILL_SLOTS), name: d.name || CLASSES[p.cls].name, look: netCharInfo() ? netCharInfo().look : null }; },
  // 房间建好了（双方都会收到）
  onRoom(m) {
    const R = m.room; if (R.kind !== 'duel') return;
    if (m.resume) {
      if (!this.active()) { net.send({ t: 'room:leave' }); return; }
      this.room = R; this.resumed = true; this.peerLag = false; clearTimeout(this.restoreT);   // 服务端重启后恢复的房间 id 是新的
      chatSys(m.restored ? '服务器重启后，决斗已恢复' : '已恢复和对手的连接'); return;
    }
    if (!game.player || game.scene !== 'town' || !save.live) { net.send({ t: 'room:leave' }); return; }
    this.room = R; this.role = R.host === net.user.id ? 'host' : 'guest'; this.state = 'setup'; this.t0 = performance.now();
    const other = R.members.find(x => x.id !== net.user.id); this.peer = { id: other.id, name: other.name };
    this.asking = null; menus.closeAll(); input.clearAll();
    toastMsg(`和 ${other.name} 的决斗即将开始…`, '#ffe8a8');
    if (this.role === 'guest') this.send({ k: 'dk', kit: this.kit() });
    this.setupT = setTimeout(() => { if (this.state === 'setup') this.abort('对方迟迟没有准备好，决斗取消'); }, 25000);
  },
  bundles(a, b) {
    const L = ['spr:' + a.cls, 'spr:' + b.cls, 'bg:' + DUEL_THEME];
    for (const k of [a, b]) if (k.look && k.look.set) L.push(`spr:${k.cls}@${k.look.set}`);
    return L;
  },
  // 决斗期间：先存档、停写、禁用消耗品快捷栏
  freeze() {
    const p = game.player; if (save.data && game.scene === 'town' && world.S && p) save.data.loc = { scene: world.S.id, x: Math.round(p.x), y: Math.round(p.y), face: p.face };   // 决斗完回到开打前站的位置
    if (save.data && save.live) save.write();
    this.saved = { quick: inv.quick.slice(), cls: game.player.cls };
    save.live = false; inv.quick = [null, null, null, null, null, null];
    game.pvpNet = true;
  },
  /* ---------------- 主机 ---------------- */
  onGuestKit(k) {
    if (this.role !== 'host' || this.state !== 'setup') return;
    this.peerKit = k; const mine = this.kit();
    this.myKit = mine;
    withLoading(this.bundles(mine, k), () => { if (this.state === 'setup') this.send({ k: 'dstart', a: mine, b: k, theme: DUEL_THEME }); });
  },
  hostStart() {
    if (this.role !== 'host' || this.state !== 'setup') return;
    clearTimeout(this.setupT);
    const mine = this.myKit, k = this.peerKit;
    this.freeze();
    const o = { a: mine.cls, b: k.cls, ja: mine.job, jb: k.job, lv: DUEL_CFG.lv, ai: 2, auto: false, theme: DUEL_THEME, nameA: mine.name, me: { skillLv: mine.lv, skillBar: mine.bar } };
    duel.start(o);
    const b = duel.b;
    b.brain = null; b.kit = duelKit(k.cls, k.job, k.bar); b.name = k.name;   // 公正决斗：标准技能等级（和对方的加点无关）
    b.pad = new Pad();
    b.control = (e, dt) => { if (duel.state === 'fight') { netDuel.feed(e); playerControl(e, dt); } else { netDuel.inDone += netDuel.inQ.length; netDuel.inQ.length = 0; e.pad.frame(game.t); } };
    if (typeof avatarSetLook === 'function' && k.look) avatarSetLook(b.model, k.look);
    for (const [w, p] of [[0, duel.a], [1, duel.b]]) p.doAct = function (def, extra) { const prev = this.act; Ent.prototype.doAct.call(this, def, extra); netDuel.hostAct(w, this, def, extra, prev); };
    this.state = 'fight'; this.inQ = []; this.inDone = 0; this.lastHeld = 0;
    chatSys(`决斗开始：你 vs ${k.name}（账号 ${this.peer.name}）`);
  },
  // 把对方的一帧输入放进 Pad（队列里保留 2~3 帧缓冲；积压太多时丢掉只有“按住”的帧追上）
  feed(e) {
    const Q = this.inQ;
    while (Q.length > 8) { const i = Q.findIndex(r => !r[1]); if (i < 0 || i >= Q.length - 1) break; Q.splice(i, 1); this.inDone++; }
    const r = Q.shift(); if (r) this.inDone++;   // inDone：对方的第几帧输入已经处理过（快照里带给对方，对方拿本地同一帧的位置比对）
    const held = r ? r[0] : this.lastHeld, taps = r ? r[1] : 0;
    this.lastHeld = held;
    for (let i = 0; i < DUEL_NET_ACTS.length; i++) { const bit = 1 << i; if (taps & bit) e.pad.tap(DUEL_NET_ACTS[i]); else if (held & bit) e.pad.hold(DUEL_NET_ACTS[i]); }
    e.pad.frame(game.t);
  },
  hostAct(w, p, def, extra, prev) {
    if (this.role !== 'host' || this.state !== 'fight') return;
    const m = { k: 'da', w, f: p.face };
    if (extra && extra.skill) { m.s = extra.skill; m.lv = extra.lv || 1; if (prev && prev.skill === extra.skill && prev.follow) m.fo = 1; if (typeof extra.speed === 'number') m.sp = +extra.speed.toFixed(2); }
    else if (def === BACKSTEP || (p.acts && def === p.acts.back)) m.b = 'back';
    else { let key = null; if (p.acts) for (const k in p.acts) if (p.acts[k] === def) { key = k; break; } if (key) m.b = key; else { m.c = def.clip || def.name; m.du = +(def.dur || 0.5).toFixed(2); } }
    this.send(m);
  },
  hostSnap() {
    const f = p => [Math.round(p.x), Math.round(p.y), Math.round(p.z), p.face < 0 ? -1 : 1, Math.max(0, COOP_ST.indexOf(p.st)), p.clipName, +p.animT.toFixed(2), Math.round(p.hp), Math.round(p.mp), p.invul > 0 ? 1 : 0, hasSA(p) ? 1 : 0, p.burning ? 1 : 0, Math.round(p.cmb.airDmg), Math.round(p.cmb.downDmg), p.dead ? 1 : 0, Math.round(p.hpMax), Math.round(p.mpMax), +(p.reboundCd || 0).toFixed(1), p.techHold ? 1 : 0];
    const cool = {}; for (const k in duel.b.cool) if (duel.b.cool[k] > 0.05) cool[k] = +duel.b.cool[k].toFixed(1);
    this.send({ k: 'ds', ck: Math.round(lastT), iq: this.inDone, a: f(duel.a), b: f(duel.b), tm: +duel.timer.toFixed(1), st: duel.state, r: duel.round, w: duel.wins, msg: duel.msg, mt: +Math.max(0, duel.msgT).toFixed(2), md: duel.msgDur || 1, cool, ts: game.timeStop > 0 ? 1 : 0, gd: +Math.max(0, duel.guardT || 0).toFixed(2) });   // gd：开局倒计时还剩几秒（对方那边也不能攻击）
  },
  /* ---------------- 对方（队员）：两个影子 + 预测 ---------------- */
  guestStart(d) {
    if (this.role !== 'guest' || this.state !== 'setup') return;
    withLoading(this.bundles(d.a, d.b), () => {
      if (this.state !== 'setup') return;
      clearTimeout(this.setupT);
      this.freeze();
      ents.length = 0; projs.length = 0; fxList.length = 0; drops.length = 0; groundFx.length = 0; numList.length = 0;
      game.scene = 'test'; game.pvp = true; game.dungeon = null; game.lvl = DUEL_CFG.lv; game.timeStop = 0; game.cutin = null; game.slowmo = false;
      game.room = { x0: 0, x1: 1120, theme: d.theme || DUEL_THEME, seed: 11 }; buildRoomArt(game.room);
      const mk = (k, team) => {
        const p = makePlayer(k.cls, { team, kit: duelKit(k.cls, k.job, k.bar), name: k.name, pad: new Pad() });
        duelStats(p); p.ghost = true; p.control = null; p.netBuf = []; p.netClip = 'idle'; p.netT = 0; p.update = duelViewUpdate;
        if (typeof avatarSetLook === 'function' && k.look) avatarSetLook(p.model, k.look);
        return p;
      };
      const A = mk(d.a, 'e'), B = mk(d.b, 'p');
      // 自己的角色：本地模拟（键盘直接操作），不是影子——对手是影子，applyHit 两边都不结算，伤害 / 受击以主机为准
      Object.assign(B, { ghost: false, pad: input, control: duelSelfControl, update: duelSelfUpdate, self: { mode: 'follow', hist: [], log: [], pend: [0, 0], corr: [0, 0], base: 0 } });
      const doAct0 = B.doAct;
      B.doAct = function (def, extra) { doAct0.call(this, def, extra); const S = this.self; if (S.mode === 'local' && !S.adopt) S.log.push({ k: duelActKey(this, def, extra), f: netDuel.inN, t: performance.now(), act: this.act }); };
      A.x = 330; A.y = B.y = DEPTH / 2; B.x = 790; A.face = 1; B.face = -1;
      ents.push(A, B); game.player = B; cmdLabel(d.b.cls);
      const V = this.view = { a: A, b: B, timer: DUEL_CFG.time, wins: [0, 0], round: 1, state: 'intro', msg: 'ROUND 1', msgT: 1, msgDur: 1,
        focusX() { return (this.a.x + this.b.x) / 2; }, update() { }, onKill() { }, drawOverlay(c) { duel.drawOverlay.call(this, c); } };
      game.duel = V; music.play('boss');
      this.state = 'fight'; this.recs = []; this.inN = 0;
      this.send({ k: 'dready' });
    });
  },
  // 每个逻辑帧记录自己的按键（step 之前）
  record() {
    if (this.role !== 'guest' || this.state !== 'fight') return;
    let held = 0, taps = 0;
    for (let i = 0; i < DUEL_NET_ACTS.length; i++) { const a = DUEL_NET_ACTS[i]; if (input.is(a)) held |= 1 << i; if (input.hit(a)) taps |= 1 << i; }
    if (isTyping()) held = taps = 0;
    this.recs.push([held, taps]); this.inN++;
    const B = this.view && this.view.b, S = B && B.self;   // 这一帧输入之前本地的位置（= 用到上一帧为止的输入）：主机处理完第 inN 帧时应该在这里
    if (S && S.mode === 'local') { S.hist.push([this.inN, B.x, B.y, S.corr[0], S.corr[1]]); if (S.hist.length > 180) S.hist.splice(0, S.hist.length - 180); }
    if (this.recs.length >= 2) { this.send({ k: 'in', l: this.recs }); this.recs = []; }
  },
  onSnap(d) {
    const V = this.view; if (!V) return;
    const now = performance.now();
    const B = V.b, local = B.self.mode === 'local', mp0 = B.mp, t = netClock(this.clk || (this.clk = {}), d.ck, now, 33);   // ck：快照是主机哪一帧的（主机时钟）
    for (const [p, r] of [[V.a, d.a], [V.b, d.b]]) {
      const [x, y, z, f, st, clip, at, hp, mp, inv, sa, burn, ad, dd, dead, hpMax, mpMax, rcd, th] = r;
      p.reboundCd = rcd || 0; p.techHold = !!th; if (th && now - (p._crFx || 0) > 220) { p._crFx = now; fxAura(p, '#8fd8ff', 0.28); }   // 受身蹲伏：冷却 / 蹲伏提示
      p.netBuf.push({ t, x, y, z, f }); p.netDelay = this.clk.delay; if (p.netBuf.length > 20) p.netBuf.splice(0, p.netBuf.length - 20);
      p.netSt = COOP_ST[st] || 'idle'; p.netClip = clip; p.netT = at; p.netT0 = now;
      p.hp = hp; p.mp = mp; p.hpMax = hpMax; p.mpMax = mpMax; p.invul = inv ? 0.05 : 0; p.superArmor = sa ? 0.05 : 0; p.burning = !!burn; p.cmb.airDmg = ad; p.cmb.downDmg = dd;
      p.dead = !!dead; p.last = { x, y, z, f, t: now };
    }
    V.timer = d.tm; V.round = d.r; V.wins = d.w; V.state = d.st; V.guardT = +d.gd || 0;
    const msg = this.flip(d.msg);
    if (msg !== V.msg || d.mt > V.msgT + 0.3) { V.msg = msg; V.msgT = d.mt; V.msgDur = d.md; }
    if (!local) { B.cool = {}; for (const k in d.cool) B.cool[k] = d.cool[k]; }
    else {   // 本地模拟中：冷却取两边较长的、MP 取较少的（主机的数据晚一个往返，本地刚放的技能它还不知道）
      for (const k in d.cool) B.cool[k] = Math.max(B.cool[k] || 0, d.cool[k]);
      B.mp = Math.min(mp0, B.mp);
      if (d.st !== 'fight' || DUEL_HURT_ST.has(B.netSt) || B.dead) duelSelfFollow(B);
      else if (d.iq !== undefined) this.reconcile(B, d.iq);
    }
    if (d.st === 'result' && !this.resultShown) { this.resultShown = true; V.msgT = 99; }
  },
  flip(m) { return m === 'YOU WIN' ? 'YOU LOSE' : m === 'YOU LOSE' ? 'YOU WIN' : m; },   // 主机的输赢文字是从主机角度写的
  onAct(d) {
    const V = this.view; if (!V) return;
    const g = d.w === 0 ? V.a : V.b, S = g.self;
    if (S && S.mode === 'local') {   // 自己的出招：本地已经先出过（同一招、还没对上号的）就不重播；没出过 = 本地判断和主机不一致，以主机为准现在补上
      const now = performance.now(), key = d.s || d.b || d.c; S.log = S.log.filter(e => now - e.t < 3000);
      const e = S.log.find(e => !e.ok && e.k === key); if (e) { e.ok = true; return; }
      S.adopt = true;
    }
    g.face = d.f < 0 ? -1 : 1; g.replayT = performance.now();
    try {
      let def = null, extra;
      if (d.s && SKILLS[d.s] && SKILLS[d.s].act) { g.kit.lv[d.s] = d.lv || 1; extra = { skill: d.s, lv: d.lv || 1, type: SKILLS[d.s].type || g.dmgType, speed: d.sp || (SKILLS[d.s].cast ? 'cspd' : 1) }; def = d.fo && g.act && g.act.follow ? g.act.follow(g) : SKILLS[d.s].act(d.lv || 1, g); }
      else if (d.b) def = d.b === 'back' ? (g.acts && g.acts.back) || BACKSTEP : g.acts && g.acts[d.b];
      if (!def) def = { name: d.c || 'idle', clip: d.c || 'idle', dur: d.du || 0.4 };
      g.doAct(def, extra);   // 决斗里觉醒的定格 / 插图两边都要看到：这里不屏蔽 timeStop / cutin
    } catch (e) { console.error('决斗动作重放出错', e); }
    if (S) S.adopt = false;
  },
  // 本地模拟的自己 vs 主机：主机处理完第 iq 帧输入时的位置 − 本地同一帧的位置（扣掉那之后已经做过的校正）= 还差多少，接下来几帧慢慢补上；差太多直接对齐
  // 本地先出的招，主机处理完那帧之后 15 帧（0.25 秒）还没出（被打断 / 判断不一致），本地收回
  reconcile(B, iq) {
    const S = B.self, h = S.hist.find(e => e[0] === iq); if (!h) return;
    const ex = B.last.x - h[1] - (S.corr[0] - h[3]), ey = B.last.y - h[2] - (S.corr[1] - h[4]);
    if (Math.hypot(ex, ey) > 150) { B.x += ex; B.y += ey; S.corr[0] += ex; S.corr[1] += ey; S.pend = [0, 0]; } else S.pend = [ex, ey];
    const cur = B.act && S.log.find(e => e.act === B.act && !e.ok);
    if (cur && iq >= cur.f + 15 && B.netSt !== 'act') { cur.ok = true; B.interrupt(); B.setState('idle'); }
  },
  /* ---------------- 结束 ---------------- */
  onEnd(d) {
    if (!this.active()) return;
    const meIdx = this.role === 'host' ? 0 : 1, w = d.w || [0, 0], win = d.winner === meIdx, draw = d.winner < 0;
    this.result = { win, draw, wins: [w[meIdx], w[1 - meIdx]] };
    this.state = 'end'; this.endT = performance.now();
    chatSys(`决斗结束：${draw ? '平局' : win ? '你赢了' : '你输了'}（${this.result.wins[0]} : ${this.result.wins[1]}）`);
    bus.emit('pvpResult', { win, vs: this.peer.name, wins: this.result.wins, draw });
    setTimeout(() => this.backToTown(), 1500);
  },
  abort(msg) {
    if (!this.active()) return;
    const inDuel = this.state === 'fight' || this.state === 'end';
    if (msg) { chatSys(msg); toastMsg(msg, '#ffb08a'); }
    if (this.room) net.send({ t: this.role === 'host' ? 'room:close' : 'room:leave' });
    if (inDuel) this.backToTown(); else this.reset();
  },
  backToTown() {
    if (!this.saved && this.state === 'none') return;
    const S = this.saved;
    if (this.room && this.role === 'host') net.send({ t: 'room:close', why: 'end' });
    else if (this.room) net.send({ t: 'room:leave' });
    game.pvp = false; game.pvpNet = false; game.duel = null; game.timeStop = 0; game.cutin = null; game.slowmo = false; duel.state = 'none';
    ents.length = 0; projs.length = 0; fxList.length = 0; groundFx.length = 0; numList.length = 0;
    if (S) inv.quick = S.quick;
    this.reset();
    if (save.data) return startGameNow(save.data.cls);
  },
  reset() { clearTimeout(this.setupT); clearTimeout(this.restoreT); if (this.netWait) { this.netWait = false; game.paused = false; } Object.assign(this, { peerLag: false, resumed: false, role: null, state: 'none', room: null, peer: null, inQ: [], recs: [], clk: null, saved: null, view: null, result: null, resultShown: false, peerKit: null, myKit: null }); },
  tick() {
    // 主机：自己断线或对方断线时暂停决斗（对方没法操作，不能白挨打），恢复后继续
    if (this.role === 'host' && this.state === 'fight') { const wait = !net.connected || !!this.peerLag; if (wait !== !!this.netWait) { this.netWait = wait; game.paused = wait; } }
    if (this.role === 'host' && this.state === 'fight') {
      const now = performance.now();
      if (now - this.lastSnap >= 33) { this.lastSnap = now; this.hostSnap(); }
      if (duel.state === 'result' && !this.sentEnd) {
        this.sentEnd = true; const R = duel.result || { winner: -1, wins: duel.wins };
        this.send({ k: 'dend', winner: R.winner, w: R.wins }); this.onEnd({ winner: R.winner, w: R.wins });
      }
    }
  },
};
// 对方那边的影子（决斗）：位置按快照（对手插值，自己预测），动作重放
function duelViewUpdate(dt) {
  if (this.flash > 0) this.flash -= dt;
  this.stT += dt;
  let spd = 1;
  if (this.act) { try { spd = coopActStep(this, dt); } catch (e) { this.act = null; } }
  if (this.act && this.netSt !== 'act' && performance.now() - (this.replayT || 0) > 200) { const a = this.act; this.act = null; try { if (a.onEnd) a.onEnd(this, true); } catch (e) { /* */ } }
  coopInterp(this, dt, 22);
  if (this.act) { this.animT += dt * spd; this.animate(dt); return; }
  const want = this.netSt || 'idle'; if (this.st !== want) this.setState(want);
  const clip = this.clips[this.netClip] ? this.netClip : 'idle';
  if (this.clipName !== clip) { this.clipName = clip; this.animT = this.netT || 0; }
  else { this.animT += dt; const w2 = (this.netT || 0) + (performance.now() - (this.netT0 || 0)) / 1000; if (Math.abs(this.animT - w2) > 0.25) this.animT = w2; }
  samplePose(this.clips[this.clipName] || this.clips.idle, this.animT, this.pose);
}
// 对方页面上自己的角色：local = 本地模拟（键盘直接操作，按下当帧出招），follow = 跟随主机快照（被打中 / 倒地 / 被抓 / 回合之间 / 刚开场）
const DUEL_HURT_ST = new Set(['hit', 'air', 'down', 'getup', 'held', 'dead']), DUEL_FREE_ST = new Set(['idle', 'walk', 'run']);
function duelSelfControl(e, dt) { if (e.self.mode === 'local') playerControl(e, dt); }
function duelSelfUpdate(dt) {
  const S = this.self;
  if (S.mode === 'follow') {
    duelViewUpdate.call(this, dt);
    if (game.duel && game.duel.state === 'fight' && !this.dead && !this.act && DUEL_FREE_ST.has(this.netSt)) duelSelfLocal(this);   // 主机那边能自由行动了：接着本地模拟
    return;
  }
  Ent.prototype.update.call(this, dt);
  const k = 1 - Math.exp(-10 * dt), dx = S.pend[0] * k, dy = S.pend[1] * k;   // 往主机的位置收敛（误差在 reconcile 里算）
  S.pend[0] -= dx; S.pend[1] -= dy; S.corr[0] += dx; S.corr[1] += dy; this.x += dx; this.y += dy;
}
function duelSelfLocal(p) { const S = p.self; S.mode = 'local'; S.hist.length = 0; S.log.length = 0; S.pend = [0, 0]; p.vx = p.vy = p.vz = 0; p.z = 0; p.setState('idle'); }
function duelSelfFollow(p) { const S = p.self; S.mode = 'follow'; S.pend = [0, 0]; if (p.act) p.interrupt(); p.vx = p.vy = p.vz = 0; p.setState(p.netSt || 'idle'); }
// 出招的名字，和主机的出招事件（hostAct → da）同一套：技能 id / acts 里的键（普攻 atk1…、后跳 back）/ 片段名
function duelActKey(p, def, extra) {
  if (extra && extra.skill) return extra.skill;
  if (def === BACKSTEP || (p.acts && def === p.acts.back)) return 'back';
  if (p.acts) for (const k in p.acts) if (p.acts[k] === def) return k;
  return def.clip || def.name;
}
// 每个逻辑帧之前：记录对方的输入
const _duelStep = step;
step = function (dt) { if (netDuel.role === 'guest' && netDuel.state === 'fight') netDuel.record(); return _duelStep(dt); };
setInterval(() => netDuel.tick(), 16);
/* ---------------- 邀请 ---------------- */
function netDuelAsk(p) {
  if (!p || !net.connected) { toastMsg('没有连上服务器', '#ff9a6a'); return; }
  if (game.scene !== 'town') { toastMsg('在城镇里才能发起决斗', '#ffd0a0'); return; }
  if (typeof coop !== 'undefined' && coop.active()) { toastMsg('地下城里不能发起决斗', '#ffd0a0'); return; }
  netDuel.asking = { id: p.id, name: p.name, t: Date.now() };
  net.send({ t: 'duel:ask', to: p.id });
}
net.on('duel:asked', m => {
  const f = m.from, busy = game.scene !== 'town' || (typeof coop !== 'undefined' && coop.active()) || !game.player || netDuel.active();
  if (busy) { net.send({ t: 'duel:decline', from: f.id, why: 'busy' }); chatSys(`${f.name} 向你发起了决斗（你正忙，已自动拒绝）`); return; }
  const warn = f.build && f.build !== netBuild();
  sfx.open && sfx.open();
  netAsk('duelask', { title: '决斗邀请', block: false, timeout: 19000,
    text: `<b>${escHtml(f.char ? f.char.name : f.name)}</b>（${escHtml(f.char ? netCharLine(f.char) : '')}，账号 ${escHtml(f.name)}）向你发起决斗！<br><span class="small dim">三局两胜，每局 60 秒；双方属性由天平系统统一，不影响装备和存档。</span>` +
      (warn ? '<br><span style="color:#ffb08a">对方的游戏版本和你不一样，请双方刷新页面后再决斗。</span>' : ''),
    okText: '接受决斗', cancelText: '拒绝',
    ok: () => net.send({ t: 'duel:accept', from: f.id }), cancel: () => net.send({ t: 'duel:decline', from: f.id }) });
});
net.on('duel:cancelled', () => { if (menus.isOpen('nd_duelask')) menus.close('nd_duelask'); chatSys('对方取消了决斗邀请'); });
net.on('duel:declined', m => { netDuel.asking = null; const t = m.why === 'timeout' ? `${m.by} 没有回应决斗邀请` : m.why === 'busy' ? `${m.by} 正忙，没法决斗` : `${m.by} 拒绝了决斗`; chatSys(t); toastMsg(t, '#ffb08a'); });
net.on('room', m => netDuel.onRoom(m));
const netDuelRanked = () => !!(netDuel.room && netDuel.room.meta && netDuel.room.meta.arena);   // 决斗场排位赛：中途掉线 / 离开按逃跑判负（服务端结算，见 server/modules/arena.js）
net.on('room:closed', m => {
  if (!netDuel.room || m.id !== netDuel.room.id) return;
  const ranked = netDuelRanked(); netDuel.room = null;
  if (netDuel.state === 'end' || netDuel.state === 'none') return;
  netDuel.abort(m.why === 'host-lost' || m.why === 'peer-left' || m.why === 'timeout' ? `对方掉线了，决斗结束${ranked ? '（排位赛按对方逃跑结算）' : '（不计胜负）'}` : '对方离开了决斗');
});
net.on('room:left', m => { if (netDuel.room && m.id === netDuel.room.id && netDuel.state !== 'end') netDuel.abort(`对方掉线了，决斗结束${netDuelRanked() ? '（排位赛按对方逃跑结算）' : '（不计胜负）'}`); });
net.on('room:lag', m => { if (netDuel.room && m.id === netDuel.room.id && netDuel.active()) { netDuel.peerLag = m.on; chatSys(m.on ? '对方的连接中断了，决斗暂停，等待重连…' : '对方重新连上了，决斗继续'); } });
net.on('r', m => {
  if (!netDuel.room || !netDuel.peer || m.f !== netDuel.peer.id) return;
  const d = m.d;
  if (netDuel.role === 'host') {
    if (d.k === 'dk') netDuel.onGuestKit(d.kit);
    else if (d.k === 'dready') netDuel.hostStart();
    else if (d.k === 'in' && netDuel.state === 'fight') { for (const r of d.l) if (Array.isArray(r)) netDuel.inQ.push([r[0] | 0, r[1] | 0]); if (netDuel.inQ.length > 40) netDuel.inDone += netDuel.inQ.splice(0, netDuel.inQ.length - 40).length; }
  } else {
    if (d.k === 'dstart') netDuel.guestStart(d);
    else if (d.k === 'ds' && netDuel.state === 'fight') netDuel.onSnap(d);
    else if (d.k === 'da' && netDuel.state === 'fight') netDuel.onAct(d);
    else if (d.k === 'dend') netDuel.onEnd(d);
  }
});
// 断线：自己重连回来时如果房间已经没了（超时），结束决斗
// 重连后等服务端补发房间（resume）；服务端重启过就多等一会儿（要等双方重新登记）
bus.on('netOpen', e => {
  if (!netDuel.active() || netDuel.state === 'end') return;
  netDuel.resumed = false; clearTimeout(netDuel.restoreT);
  netDuel.restoreT = setTimeout(() => { if (netDuel.active() && netDuel.state !== 'end' && !netDuel.resumed) netDuel.abort(e && e.restarted ? '服务器重启了，决斗没能恢复，返回城镇' : '和对手的连接断开太久，决斗结束'); }, e && e.restarted ? 25000 : 4000);
});
bus.on('netClose', () => { if (netDuel.active()) chatSys('和服务器的连接断开了，正在重连…'); });
// 决斗中：主机那边的结算界面不要“按 X 再来一局”（结束后双方自动回城）
const _duelUpdate = duel.update;
duel.update = function (dt) { if (netDuel.role === 'host' && this.state === 'result') { this.t += dt; return; } return _duelUpdate.call(this, dt); };
// 结算画面：联机决斗不显示“按 X 再来一局”，改成“即将返回城镇”
const _duelDraw = duel.drawOverlay;
duel.drawOverlay = function (c) {
  if (!netDuel.active() || this.state !== 'result') return _duelDraw.call(this, c);
  const s = this.state, mt = this.msgT, md = this.msgDur; this.state = 'ko'; this.msgT = 99; this.msgDur = 99;
  try { _duelDraw.call(this, c); } finally { this.state = s; this.msgT = mt; this.msgDur = md; }
  c.save(); c.textAlign = 'center'; c.font = 'bold 16px "PingFang SC",sans-serif'; c.lineWidth = 4; c.strokeStyle = '#1a0806';
  const t = `${this.wins[0]} : ${this.wins[1]}　即将返回城镇…`; c.strokeText(t, WW / 2, 268); c.fillStyle = '#fff'; c.fillText(t, WW / 2, 268); c.restore();
};
// 决斗场窗口（维尔·克鲁 / P 键）：登录后多一栏“好友决斗”
const _wDuel = menus.w_duel;
menus.w_duel = function (arg) {
  const el = _wDuel.call(this, arg);
  if (!netOn() || !el) return el;
  const bd = el.querySelector('.duelwin'); if (!bd) return el;
  const box = h('div', { class: 'col', style: 'gap:.35em;margin-top:.4em;padding-top:.5em;border-top:.06em solid rgba(232,194,106,.3)' }, h('b', {}, '好友决斗（真人对战）'));
  const on = netFriends.list.filter(f => f.online);
  if (!on.length) box.append(h('div', { class: 'small dim' }, '没有在线的好友。也可以在城镇里点其他玩家选“发起决斗”。'));
  for (const f of on) box.append(h('div', { class: 'row', style: 'gap:.5em;align-items:center' }, h('span', { style: 'flex:1' }, f.name, f.char ? h('span', { class: 'small dim' }, '  ' + netCharLine(f.char)) : null),
    h('button', { class: 'btn', onclick: () => { this.close('duel'); netDuelAsk({ id: f.id, name: f.name, char: f.char }); } }, '发起决斗')));
  bd.append(box);
  return el;
};
// 决斗中聊天框是隐藏的：在右下角显示到服务器的延迟
netUiHooks.push(c => {
  if (!netDuel.active() || !game.duel) return;
  const r = net.connected ? Math.round(net.rtt) : -1;
  uiText(r < 0 ? '● 连接中断' : `● 延迟 ${r} ms`, 1900, 1066, { size: 18, align: 'right', color: r < 0 ? '#ff6a5a' : r < 100 ? '#6aff8a' : r < 300 ? '#ffd24a' : '#ff8a4a', sw: 3 });
});
