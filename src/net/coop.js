/* =====================================================================
   组队刷图（最多 4 人）：队长主机权威 + 各自结算自己
   - 进图：队长在地下城门口点“进入地下城”→ 开房间 → 把地图种子发给队员（全队同一张图）→ 大家加载完一起开始
   - 怪物：只在队长（主机）那边模拟（AI、血量、死亡、清房、开门）。主机 20Hz 广播怪物快照（位置 / 状态 / 血量），
     生成、出招、死亡、换房间、清房作为事件单独发。怪物血量按人数提高（COOP_HP）
   - 队员那边的怪物是“傀儡”：位置按快照插值；主机上怪物出招时，队员这边的傀儡播同一个招式（特效、投射物、预警都一样），
     只判定打没打中“我自己”（谁挨打谁结算：在自己屏幕上躲开了就是躲开了）
   - 打怪：每个人在自己的客户端判定命中（打的是屏幕上看到的位置），队员把伤害和受击反应（浮空 / 击退 / 硬直）发给主机，主机扣血并做受击反应
   - 队友：各自 20Hz 广播自己的位置 / 动作 / 血量；别人那边用“影子”显示（同样的职业模型和外观），出招时影子重放同一个技能（只有特效，不造成伤害）
   - 掉落、经验、翻牌：主机广播击杀事件，每个人在自己的客户端各拿各的（rollDrop / 金币 / 经验 / 任务计数）
   - 断线：队员掉线 → 宽限期后离队（主机继续）；队长掉线超时 → 房间关闭，队员回城（奖励保留）
   ===================================================================== */
const COOP_HP = [1, 1, 1.6, 2.2, 2.8];          // 怪物血量倍率（按人数，可调）
const COOP_SNAP_MS = 50;                        // 快照 / 自身状态发送间隔（20Hz）
const COOP_INTERP = 100;                        // 傀儡 / 影子的插值延迟（毫秒）
const COOP_ST = ['idle', 'walk', 'run', 'jump', 'act', 'hit', 'air', 'down', 'getup', 'held', 'dead'];
const coop = {
  role: null, room: null, state: 'none', dg: null, def: null, diff: 0, hostId: 0, mates: new Map(), puppets: new Map(), spawnInfo: new Map(),
  nid: 0, spawnQ: [], dmgQ: [], hitQ: [], pendingRel: [], relLog: [], sq: 0, lastSq: 0, stats: { remoteHits: 0, sentHits: 0, snaps: 0, kills: 0, mateActs: 0, monActs: 0 }, lastSnap: 0, lastSelf: 0, prep: null, waitT: 0, hostLag: false, lagSince: 0,
  active() { return !!this.role && (this.state === 'play' || this.state === 'prep' || this.state === 'load'); },
  isGuest() { return this.role === 'guest' && this.state !== 'none'; },
  me() { return net.user ? net.user.id : 0; },
  // 主机的关键事件（生成 / 击杀 / 换房间 / 清房）在断线期间先排队，重连后补发，免得队员漏掉奖励或卡在旧房间
  send(d, to) {
    if (this.role === 'host' && COOP_LOGGED.has(d.k) && to === undefined) { d.sq = ++this.sq; this.relLog.push(d); if (this.relLog.length > 600) this.relLog.splice(0, 200); }
    const m = to === undefined ? { t: 'r', d } : { t: 'r', d, to };
    if (net.send(m)) return true;
    if (this.role === 'host' && COOP_RELIABLE.has(d.k) && this.pendingRel.length < 500) this.pendingRel.push(m);
    return false;
  },
  flushPending() { const L = this.pendingRel; this.pendingRel = []; for (const m of L) net.send(m); },
  // 断线重连后让队员对齐：当前房间、清过的房间、当前房间里还活着的怪
  sendSync(to) {
    const dg = this.dg; if (!dg || this.role !== 'host') return;
    const rows = dg.transition ? [] : ents.filter(m => m.nid && !m.dead && m.team === 'e').map(m => this.spawnRow(m));
    const R = dg.transition ? dg.transition.room : dg.room;   // 正在换房间：直接告诉目标房间（怪物随后的生成事件会补上）
    this.send({ k: 'sync', gx: R.gx, gy: R.gy, cl: dg.layout.rooms.filter(r => r.cleared).map(r => r.gx + ',' + r.gy), vi: dg.layout.rooms.filter(r => r.visited).map(r => r.gx + ',' + r.gy), l: rows }, to);
  },
  // 队员重连后：把错过的生成 / 击杀补上（奖励不丢），再对齐房间
  onResync(uid, last) {
    const miss = this.relLog.filter(d => d.sq > last && (d.k === 'spawn' || d.k === 'kill'));
    if (miss.length) this.send({ k: 'replay', l: miss }, uid);
    this.sendSync(uid);
  },
  onReplay(d) {
    for (const e of d.l) { if (e.sq <= this.lastSq) continue; if (e.k === 'spawn') this.onSpawn(e, true); else if (e.k === 'kill') this.onKill(e); }
  },
  onSync(d) {
    const dg = this.dg; if (!dg) return;
    for (const r of dg.layout.rooms) { const k = r.gx + ',' + r.gy; if (d.cl.includes(k)) r.cleared = true; if (d.vi.includes(k)) r.visited = true; }
    const here = dg.room.gx === d.gx && dg.room.gy === d.gy;
    for (const s of d.l) { s.rk = d.gx + ',' + d.gy; this.spawnInfo.set(s.id, s); }
    if (!here) { this.onRoom({ gx: d.gx, gy: d.gy, from: null }); return; }
    const alive = new Set(d.l.map(s => s.id));
    for (const [id, m] of this.puppets) if (!alive.has(id) && !m.dead) { const i = ents.indexOf(m); if (i >= 0) ents.splice(i, 1); this.puppets.delete(id); }
    for (const s of d.l) this.makePuppet(s);
    if (dg.room.cleared && !dg.doorsOpen) dg.onCleared(true);
  },
  rk(r = this.dg && this.dg.room) { return r ? r.gx + ',' + r.gy : ''; },
  /* ---------------- 进图 ---------------- */
  // 队长：从地下城门口开始
  lead(id, diff) {
    const def = DUNGEONS[id]; if (!def) return false;
    save.daily();
    if (save.data.fatigue < def.rooms) { toastMsg(`疲劳值不足：${def.name} 至少需要 ${def.rooms} 点疲劳`, '#ff6a6a'); sfx.error(); return false; }
    const cost = coopEntryCost(() => typeof def.beforeEnter === 'function' ? def.beforeEnter(diff) : true);
    if (cost === false) return false;
    const others = netParty.others().filter(m => m.online);
    this.reset(); this.entryCost = cost; this.role = 'host'; this.state = 'prep'; this.def = def; this.diff = diff; this.hostId = this.me();
    const seed = (Math.random() * 1e9) | 0, tmp = genLayout(def, seed);
    this.prep = { id, diff, seed, rs: tmp.rooms.map(() => (Math.random() * 1e9) | 0), resp: new Map(), mem: others.map(m => m.id) };
    net.send({ t: 'room:open', kind: 'dungeon', meta: { id, diff } });
    this.waitDialog();
    this.waitT = setTimeout(() => this.goNow(), 25000);
    // 服务端没有建好房间（例如刚好不再是队长 / 网络断了）：别一直卡在等待框
    this.roomT = setTimeout(() => { if (this.state === 'prep' && !this.room) this.abort('组队房间没有建好（网络不稳定，或者你已经不是队长），请再试一次'); }, 6000);
    return true;
  },
  waitDialog() {
    const P = this.prep; if (!P || this.role !== 'host') return;
    const names = id => { const m = netParty.p && netParty.p.members.find(x => x.id === id); return m ? (m.char ? m.char.name : m.name) : '?'; };
    const st = P.mem.map(id => { const r = P.resp.get(id); return `${escHtml(names(id))}：${r === undefined ? '加载中…' : r === true ? '<span style="color:#8aff9a">准备好了</span>' : `<span style="color:#ff9a7a">${escHtml(r)}</span>`}`; }).join('<br>');
    netAsk('coopwait', { title: `组队进入 · ${this.def.name}`, block: false, text: `等队友加载完一起进（最多等 25 秒）<br><br>${st}`, okText: '不等了，现在进', cancelText: '取消',
      ok: () => this.goNow(), cancel: () => { this.abort('队长取消了进图'); } });
  },
  // 收到队员的“准备好了 / 进不了”
  onResp(uid, ok, why) {
    const P = this.prep; if (!P || this.state !== 'prep') return;
    P.resp.set(uid, ok ? true : why || '进不了');
    if (!ok) chatSys(`${this.nameOf(uid)} 无法进入：${why}`);
    if (P.mem.every(id => P.resp.has(id)) && P.selfReady) this.goNow(); else if (menus.isOpen('nd_coopwait')) this.waitDialog();
  },
  goNow() {
    const P = this.prep; if (!P || this.state !== 'prep' || this.role !== 'host') return;
    if (!P.selfReady) { P.goWhenReady = true; return; }
    clearTimeout(this.waitT); if (menus.isOpen('nd_coopwait')) menus.close('nd_coopwait');
    const go = P.mem.filter(id => P.resp.get(id) === true);
    for (const id of P.mem) if (!go.includes(id)) this.send({ k: 'drop', why: P.resp.get(id) || '加载超时' }, id);
    if (!go.length) { toastMsg('没有队友能一起进，按单人进入', '#ffb08a'); this.entryCost = null; this.end('solo'); return withLoading(dungeonBundles(this.def), () => new Dungeon(this.def, this.diff).start()); }
    const n = go.length + 1, mul = COOP_HP[n] || 2.8;
    this.send({ k: 'go', mem: [this.me(), ...go], mul, seed: P.seed, rs: P.rs, id: P.id, diff: P.diff });
    this.start({ seed: P.seed, roomSeeds: P.rs, hpMul: mul }, [this.me(), ...go]);
  },
  // 队员：收到队长的准备消息
  onPrep(d, from) {
    const def = DUNGEONS[d.id];
    const no = why => { this.send({ k: 'nope', why }); chatSys(`无法跟随队长进入地下城：${why}`); net.send({ t: 'room:leave' }); this.reset(); };
    if (!def) return no('没有这个地下城（请刷新页面更新版本）');
    if (game.scene !== 'town' || !game.player || !save.live || game.duel) return no(game.scene === 'dungeon' ? '正在别的地下城里' : '现在不在城镇里');
    save.daily();
    if (save.data.fatigue < def.rooms) return no(`疲劳不足（需要 ${def.rooms}）`);
    const cost = coopEntryCost(() => typeof def.beforeEnter === 'function' ? def.beforeEnter(d.diff) : true);
    if (cost === false) return no('没有入场道具');
    if (d.boss && MON[d.boss.kind]) def.boss = { ...d.boss };   // 深渊领主等“进图时随机”的设定以队长为准（素材也按它加载）
    const room = this.room; this.reset(); this.room = room; this.entryCost = cost; this.role = 'guest'; this.state = 'load'; this.def = def; this.diff = d.diff; this.hostId = from;
    menus.closeAll(); input.clearAll();
    toastMsg(`队长带队进入 ${def.name}（${DIFFS[d.diff].name}）`, '#ffe8a8');
    this.gateLoc(def.id);
    withLoading(this.bundles(def), () => { if (this.state === 'load') this.send({ k: 'ready' }); });
  },
  // 回城时站在这个地下城的门口（和队长一样）
  gateLoc(id) {
    for (const sid in SCENES) { const g = SCENES[sid].gates.find(x => x.dungeon === id); if (g) { save.data.loc = { scene: sid, x: Math.round(g.x), y: 34 }; return; } }
  },
  bundles(def) {
    const list = [...dungeonBundles(def)];
    if (netParty.p) for (const m of netParty.p.members) if (m.char) { list.push('spr:' + m.char.cls); if (m.char.look && m.char.look.set) list.push(`spr:${m.char.cls}@${m.char.look.set}`); }
    return list;
  },
  // 全队开始（主机和队员都走这里）
  start(o, mem) {
    const guest = this.role === 'guest';
    this.entryCost = null;   // 真的进去了：入场道具不退
    this.state = 'play'; this.mem = mem;
    game.maxCombo = 0; game.combo = 0;
    const dg = new Dungeon(this.def, this.diff, { ...o, guest });
    this.dg = dg;
    this.hookDungeon(dg);
    dg.start();
    this.baseAttackers = game.maxAttackers; game.maxAttackers = 2 + mem.length - 1;
    for (const uid of mem) if (uid !== this.me()) this.addMate(uid);
    this.hookPlayer(game.player);
    chatSys(`组队进入 ${this.def.name}：${mem.map(id => this.nameOf(id)).join('、')}（怪物血量 ×${o.hpMul}）`);
    bus.emit('coopStart', { role: this.role, n: mem.length });
  },
  /* ---------------- 地下城钩子 ---------------- */
  hookDungeon(dg) {
    const C = this;
    if (this.role === 'host') {
      const go0 = dg.go.bind(dg);
      dg.go = function (dir) { const next = this.room.doors[dir]; go0(dir); if (this.transition && this.transition.room === next) C.send({ k: 'room', gx: next.gx, gy: next.gy, from: this.transition.from }); };
      const onCleared0 = dg.onCleared.bind(dg);
      dg.onCleared = function (silent) { onCleared0(silent); if (!silent) C.send({ k: 'clear', rk: C.rk() }); };
      const onKill0 = dg.onKill.bind(dg);
      dg.onKill = function (t, a) { if (t.nid) C.send({ k: 'kill', id: t.nid, a: a && a.uid ? a.uid : a === game.player ? C.me() : 0, ld: Math.round(t.lastDmg || 0) }); onKill0(t, a); };
    } else {
      dg.go = dir => { if (!this.doorAsk || performance.now() - this.doorAsk > 800) { this.doorAsk = performance.now(); this.send({ k: 'door', dir }); } };
    }
    const fin0 = dg.finish.bind(dg);
    dg.finish = function () { fin0(); C.state = 'result'; };
    const fail0 = dg.fail.bind(dg);
    dg.fail = function () { C.end(C.role === 'host' ? 'host-dead' : 'dead'); fail0(); };
  },
  // 本地玩家：出招时广播给队友（队友那边的影子重放同一个动作）
  hookPlayer(p) {
    const C = this;
    p.doAct = function (def, extra) {
      const prev = this.act;
      Ent.prototype.doAct.call(this, def, extra);
      if (C.state === 'play') C.onLocalAct(this, def, extra, prev);
    };
  },
  unhookPlayer(p) { if (p && Object.prototype.hasOwnProperty.call(p, 'doAct')) delete p.doAct; },
  onLocalAct(p, def, extra, prev) {
    const m = { k: 'a', f: p.face };
    if (extra && extra.skill) { m.s = extra.skill; m.lv = extra.lv || 1; if (prev && prev.skill === extra.skill && prev.follow) m.fo = 1; if (typeof extra.speed === 'number') m.sp = +extra.speed.toFixed(2); }
    else if (def === BACKSTEP || (p.acts && def === p.acts.back)) m.b = 'back';
    else { let key = null; if (p.acts) for (const k in p.acts) if (p.acts[k] === def) { key = k; break; } if (key) m.b = key; else { m.c = def.clip || def.name; m.du = +(def.dur || 0.5).toFixed(2); } }
    this.send(m, 'all');
  },
  /* ---------------- 队友影子 ---------------- */
  addMate(uid) {
    const info = netParty.p && netParty.p.members.find(m => m.id === uid), ch = info && info.char || { cls: 'sword', name: this.nameOf(uid), lvl: 1 };
    const cls = CLASSES[ch.cls] && SPR_DATA[ch.cls] ? ch.cls : 'sword';
    const g = makePlayer(cls, { team: 'p', kit: { bar: [], lv: {}, job: ch.job || null, wtype: null }, name: ch.name || this.nameOf(uid), pad: new Pad() });
    g.ghost = true; g.uid = uid; g.control = null; g.netBuf = []; g.netClip = 'idle'; g.netT = 0; g.lvl = ch.lvl || 1; g.char = ch;
    g.hp = g.hpMax = 1000; g.mp = g.mpMax = 1000; g.mpFrac = 1;
    g.update = coopGhostUpdate; g.draw = coopGhostDraw; g.drawShadow = function (c) { if (!this.away) Ent.prototype.drawShadow.call(this, c); };
    if (typeof avatarSetLook === 'function' && ch.look) avatarSetLook(g.model, ch.look);
    if (typeof cashAttach === 'function' && ch.look) { try { cashAttach(g, ch.look.cash || null); } catch (e) { /* 商城外观可选 */ } }
    const p = game.player; g.x = p.x - 40 * (this.mates.size + 1); g.y = p.y; g.away = false;
    this.mates.set(uid, g); ents.push(g);
    return g;
  },
  removeMate(uid, why) {
    const g = this.mates.get(uid); if (!g) return;
    this.mates.delete(uid); const i = ents.indexOf(g); if (i >= 0) ents.splice(i, 1);
    for (const m of ents) if (m.tgt === g) m.tgt = null;
    if (why) chatSys(`${this.nameOf(uid)} ${why}`);
  },
  nameOf(uid) { if (uid === this.me()) return net.user.name; const m = netParty.p && netParty.p.members.find(x => x.id === uid); return m ? (m.char ? m.char.name : m.name) : '队友'; },
  /* ---------------- 主机：怪物 ---------------- */
  // 主机上生成的怪物：编号、广播、换目标（game.player 在怪物 AI / 动作期间临时换成它的目标）
  hostMonster(m) {
    m.nid = ++this.nid; m.nrk = this.rk(); this.puppets.set(m.nid, m);
    const C = this, upd = m.update;
    // AI：每次都先在全队活着的人里选目标，AI 执行期间 game.player 临时换成目标。
    // 用访问器包住 control：生成之后再换 AI 的怪（龙之雕像 m.control = skyStatueAI 等）也照样走这一层，不会只盯着队长
    let ctl = m.control;
    const wrapped = function (e, dt) { const P = game.player, tg = C.pickTarget(e); if (tg) game.player = tg; try { if (ctl) ctl(e, dt); } finally { game.player = P; } };
    Object.defineProperty(m, 'control', { configurable: true, enumerable: true, get() { return ctl ? wrapped : null; }, set(f) { ctl = f; } });
    Object.defineProperty(m, 'aiInner', { configurable: true, get() { return ctl; } });
    m.update = function (dt) { const P = game.player, tg = this.tgt && !this.tgt.dead ? this.tgt : null; if (tg) game.player = tg; try { (upd || Ent.prototype.update).call(this, dt); } finally { game.player = P; } };
    m.doAct = function (def, extra) { Ent.prototype.doAct.call(this, def, extra); this.actSeq = (this.actSeq || 0) + 1; C.monAct(this, def); };
    this.spawnQ.push(this.spawnRow(m));
  },
  spawnRow(m) { m._sent = m.hpMax + '|' + m.name + '|' + (m.scale || 1); return { id: m.nid, rk: this.rk(), kind: m.kind, lvl: m.lvl, boss: m.boss ? 1 : 0, elite: m.elite ? 1 : 0, hp: Math.round(m.hp), hpMax: Math.round(m.hpMax), atk: Math.round(m.atk), def: Math.round(m.def), exp: m.exp, sc: +(m.scale || 1).toFixed(3), x: Math.round(m.x), y: Math.round(m.y), z: Math.round(m.z), f: m.face, name: m.name }; },
  pickTarget(m) {
    const now = game.t, cur = m.tgt;
    const ok = e => e && !e.dead && e.hp > 0 && !e.away && !e.lag && !(e.ghost && !net.connected);   // 自己断线期间队友的影子是旧的，不当目标
    if (ok(cur) && now - (m.tgtT || 0) < 2.2) return cur;
    const list = [game.player, ...this.mates.values()].filter(ok);
    if (!list.length) return cur && !cur.dead ? cur : game.player;
    // 队友用最新收到的位置（插值显示的位置慢 100ms，按它算距离会让怪总是先找队长）；已经被别的怪盯上的人稍微减分，怪物会分散到全队
    const busy = new Map(); for (const e of ents) if (e !== m && e.tgt && e.team === 'e' && !e.dead) busy.set(e.tgt, (busy.get(e.tgt) || 0) + 1);
    let best = list[0], bd = 1e9;
    for (const e of list) {
      const L = e.netBuf && e.netBuf[e.netBuf.length - 1], x = L ? L.x : e.x, y = L ? L.y : e.y;
      const d = Math.abs(x - m.x) + Math.abs(y - m.y) * 1.5 + (e === cur ? -60 : 0) + (busy.get(e) || 0) * 70 + rnd(0, 60);
      if (d < bd) { bd = d; best = e; }
    }
    m.tgt = best; m.tgtT = now;
    return best;
  },
  monAct(m, def) {
    if (!m.nid || this.state !== 'play') return;
    const D = m.def_, i = D && D.attacks ? D.attacks.findIndex(A => A.clip === def.clip && A.act.dur === def.dur) : -1;
    const tg = m.tgt && m.tgt.uid ? m.tgt.uid : this.me();
    // 自带 AI 的怪（龙之雕像等）的招式不在招式表里：告诉队员是哪个 AI 函数，队员那边用同一个函数现场出招（事件、投射物都一样）
    const f = i < 0 ? m.aiInner : null, ai = f && f !== monsterAI && f.name && typeof globalThis[f.name] === 'function' ? f.name : undefined;
    this.send({ k: 'ma', id: m.nid, i, ai, c: def.clip || def.name, nm: def.name, du: +Math.min(999, def.dur || 1).toFixed(2), sa: def.superArmor === true ? 1 : 0, f: m.face, tg, sq: m.actSeq, x: Math.round(m.x), y: Math.round(m.y) });
  },
  // 队员打中了怪（队员客户端算好的伤害和受击反应）→ 主机扣血、做受击反应
  remoteHit(uid, r) {
    const m = this.puppets.get(r.id), g = this.mates.get(uid);
    if (!m || m.dead || !g || !ents.includes(m)) { const S = this.stats; S.hitDrop = S.hitDrop || {}; const k = !m ? 'none' : m.dead ? 'dead' : !g ? 'nomate' : 'gone'; S.hitDrop[k] = (S.hitDrop[k] || 0) + 1; return; }
    const h = coopCleanHit(r.h), tm = clamp(+r.tm || 1, 0.05, 20), dmg = clamp(Math.round((+r.dmg || 0) * coopTakenMul(m) / tm), 1, 5e7); this.stats.remoteHits++;
    m.hp -= dmg; m.lastDmg = dmg; m.lastHitBy = g;
    const c = m.cmb; c.hits++; c.dmg += dmg; if (m.st === 'air' || m.z > 2) c.airDmg += dmg; if (m.st === 'down') c.downDmg += dmg;
    addNumber(dmg, m.x, m.y, m.z, { crit: !!r.cr });
    m.flash = 0.08; m.hitstop = Math.max(m.hitstop, (h.hs ?? 0.06) + 0.01);
    this.dmgQ.push([m.nid, dmg, r.cr ? 1 : 0, uid]);
    if (m.onDamaged) { try { m.onDamaged(m, g, dmg, !!r.cr, h); } catch (e) { console.error(e); } }
    if (m.hp <= 0) { m.hp = 0; killEnt(m, g, h); return; }
    if (m.invul > 0 || (m.st === 'down' && !h.downHit)) return;
    const P = game.player; game.player = g;
    try { react(g, m, h, { x: +r.x || g.x, y: m.y, z: +r.z || 0, face: r.f < 0 ? -1 : 1 }, !!r.co, false); } finally { game.player = P; }
    if (m.onHurt) { try { m.onHurt(g, h); } catch (e) { /* */ } }
  },
  // 队员抓住 / 放开了怪：主机把怪挂到这个队员的影子上（被抓状态照样同步给其他人）；抓取规则（领主、体重、刚被抓过、倒地）在主机上再判一次
  remoteGrab(uid, r) {
    const m = this.puppets.get(r.id), g = this.mates.get(uid);
    if (!m || m.dead || !g || !ents.includes(m)) return;
    if (r.g) {
      const h = { grabBoss: !!r.bw, grabMaxW: clamp(+r.mw || 2.2, 0.5, 9) };
      if (m.heldBy === g) return;
      if (m.heldBy || !canGrab(g, m, h)) { this.send({ k: 'gbx', id: m.nid }, uid); return; }
      if (g.grabbed && g.grabbed !== m) dropGrab(g);
      startGrab(g, m, h); this.stats.grabs = (this.stats.grabs || 0) + 1;
    } else if (m.heldBy === g) releaseHeld(m);
  },
  snapshot() {
    const rows = [];
    for (const m of ents) {
      if (!m.nid || m.dead || m.team !== 'e') continue;
      if (m._sent !== m.hpMax + '|' + m.name + '|' + (m.scale || 1)) this.spawnQ.push(this.spawnRow(m));   // 血量上限 / 名字 / 体型变了（深渊领主降临等）：重发一次生成信息
      rows.push([m.nid, Math.round(m.x), Math.round(m.y), Math.round(m.z), m.face < 0 ? -1 : 1, Math.max(0, COOP_ST.indexOf(m.st)), Math.max(0, Math.round(m.hp)), m.actSeq || 0]);
    }
    const d = { k: 's', rk: this.rk(), m: rows };
    if (this.dmgQ.length) { d.d = this.dmgQ; this.dmgQ = []; }
    this.send(d);
  },
  flushSpawns() { if (!this.spawnQ.length) return; this.send({ k: 'spawn', rk: this.rk(), l: this.spawnQ }); this.spawnQ = []; },
  /* ---------------- 队员：怪物傀儡 ---------------- */
  onSpawn(d, replay) {
    for (const s of d.l) {
      s.rk = s.rk || d.rk; this.spawnInfo.set(s.id, s);
      const m = this.puppets.get(s.id); if (m && !m.dead) Object.assign(m, { hpMax: s.hpMax, name: s.name, scale: s.sc, lvl: s.lvl, atk: s.atk, boss: !!s.boss });   // 已有的傀儡：更新属性
    }
    if (!replay && this.dg && !this.dg.transition) for (const s of d.l) if (s.rk === this.rk()) this.makePuppet(s);
  },
  makePuppet(s) {
    if (this.puppets.has(s.id) || !MON[s.kind]) return;
    this.allowSpawn = true;
    let m; try { m = spawnMonster(s.kind, s.x, s.y, { lvl: s.lvl, boss: !!s.boss, elite: !!s.elite }); } finally { this.allowSpawn = false; }
    Object.assign(m, { nid: s.id, puppet: true, lvl: s.lvl, hp: s.hp, hpMax: s.hpMax, atk: s.atk, def: s.def, exp: s.exp, scale: s.sc, name: s.name, z: s.z, face: s.f, control: null, netBuf: [], netSt: 'idle', invul: 0 });
    m.update = coopPuppetUpdate;
    const od = m.onDamaged, C = this;
    // 本地打中傀儡：报给主机；怪物自带的受击效果（冰冻反击、毒雾、放电……）也在本地跑一遍，打到的是我自己（谁挨打谁结算）
    m.onDamaged = function (t, a, dmg, crit, h) { C.localHit(t, a, dmg, crit, h); if (od && a === game.player) { try { od(t, a, dmg, crit, h); } catch (e) { /* 表现用 */ } } };
    m.onHurt = null; m.onDeath = null;
    const need = typeof monBundles === 'function' ? monBundles([s.kind]).filter(b => !IMG[b.replace(/^spr:/, 'spr/') + '/idle']) : [];
    if (need.length) loadBundles(need).then(() => { if (!m.dead && MON[s.kind]) { const md = MON[s.kind].model(); if (md) m.model = md; } });   // 队长那边房间机关刷出来的怪（素材没预载）
    if (m.boss && this.dg) { this.dg.boss = m; game.lastTarget = m; game.lastTargetT = game.t; }
    this.puppets.set(s.id, m);
  },
  localHit(t, a, dmg, crit, h) {
    if (a !== game.player && !(a && a.owner === game.player)) return;
    t.hp = Math.max(1, t.hp);   // 傀儡不在本地死亡，等主机的击杀事件
    const now = performance.now();
    t.lockSt = now + Math.max(200, net.rtt + 100);
    // 本地预测：打中以后傀儡立刻按单机的受击规则动起来（浮空 / 弹地 / 倒地 / 起身），不等主机快照；恢复行动后再平滑回主机的位置
    if (!t.pred) t.predMax = now + 4000;
    t.pred = now + 350 + Math.min(300, net.rtt || 60);
    const H = {}; for (const k of COOP_HIT_KEYS) if (h[k] !== undefined && h[k] !== null) H[k] = typeof h[k] === 'boolean' ? (h[k] ? 1 : 0) : h[k];
    if (h.grab) H.stun = Math.max(H.stun || 0, 0.6);
    const counter = isCounter(t); this.stats.sentHits++;
    this.hitQ.push({ id: t.nid, dmg, cr: crit ? 1 : 0, co: counter ? 1 : 0, x: Math.round(a.x), z: Math.round(a.z || 0), f: a.face, h: H, tm: +coopTakenMul(t).toFixed(3) });   // 每 25ms 打包发一次
  },
  onSnap(d, recvT) {
    if (!this.dg || this.dg.transition) { this.misT = 0; return; }
    if (d.rk !== this.rk()) {   // 主机在别的房间（漏了换房间事件）：1.5 秒后自己跟过去，并要一次补发
      if (!this.misT) this.misT = recvT;
      else if (recvT - this.misT > 1500 && this.dg.state !== 'result') { this.misT = 0; const [gx, gy] = d.rk.split(',').map(Number); this.onRoom({ gx, gy, from: null }); this.send({ k: 'resync', last: this.lastSq }); }
      return;
    }
    this.misT = 0;
    this.stats.snaps++;
    const seen = new Set();
    for (const r of d.m) {
      const [id, x, y, z, f, sti, hp, sq] = r; seen.add(id);
      let m = this.puppets.get(id);
      if (!m) { const s = this.spawnInfo.get(id); if (s && s.rk === d.rk) { this.makePuppet({ ...s, x, y, z, f, hp }); m = this.puppets.get(id); } if (!m) continue; }
      if (m.dead) continue;
      m.netBuf.push({ t: recvT, x, y, z, f }); if (m.netBuf.length > 20) m.netBuf.splice(0, m.netBuf.length - 20); m.seenT = recvT;
      m.hp = hp; m.netSt = COOP_ST[sti] || 'idle'; m.netSq = sq;
      if (m.act && m.netSt !== 'act' && sq >= (m.replaySq || 0)) { const a = m.act; m.act = null; if (a.onEnd) { const P = game.player; if (m.tgt) game.player = m.tgt; try { a.onEnd(m, true); } finally { game.player = P; } } }
      if (m.statue && m.statueLive && m.netSt !== 'act') { m.model = m.statueLive; m.statue = false; m.noGrab = false; m.statueLive = null; }
    }
    if (d.d) for (const [id, dmg, cr, uid] of d.d) { if (uid === this.me()) continue; const m = this.puppets.get(id); if (m && !m.dead) { addNumber(dmg, m.x, m.y, m.z, { crit: !!cr }); m.flash = 0.06; } }
  },
  onMonAct(d) {
    const m = this.puppets.get(d.id); if (!m || m.dead) return;
    // 我刚把它打飞 / 打倒（本地预测中）：主机那边这一招会被我的命中打断，不在空中 / 地上重播
    if (m.pred && (m.st === 'air' || m.st === 'down' || m.st === 'hit' || m.z > 2) && !d.sa) return;
    this.stats.monActs++; if (d.tg === this.me()) this.stats.monActsMe = (this.stats.monActsMe || 0) + 1; m.face = d.f; m.tgt = d.tg === this.me() ? game.player : (this.mates.get(d.tg) || game.player);
    if (d.c === 'idle' && d.nm === 'statue' && typeof skyMakeStatue === 'function') {   // 石像：用同一套表现（灰色石像，本地按最近的人苏醒）
      const live = m.model; skyMakeStatue(m); m.statueLive = live; m.replaySq = d.sq; return;
    }
    if (d.i < 0 && d.ai && typeof globalThis[d.ai] === 'function' && /AI$/.test(d.ai)) {   // 自带 AI：让同一个 AI 函数在傀儡身上立刻出一招
      const P = game.player; game.player = m.tgt;
      const was = m.act, aiCd = m.aiCd;
      try { if (m.act) { m.act = null; } m.setState('idle'); m.aiCd = 0; globalThis[d.ai](m, 1 / 60); } catch (e) { console.error('傀儡自带 AI 出招出错', e); } finally { game.player = P; }
      m.vx = m.vy = 0; if (aiCd !== undefined && m.act === was) m.aiCd = aiCd;
      if (m.act && m.act !== was) { m.replaySq = d.sq; m.lockSt = 0; return; }
    }
    const A = d.i >= 0 && m.def_ && m.def_.attacks ? m.def_.attacks[d.i] : null;
    const def = A ? { name: A.clip, clip: A.clip, ...A.act, hits: A.act.hits && A.act.hits.map(h => ({ ...h })) } : { name: d.c, clip: d.c, dur: d.du, superArmor: !!d.sa, noCounter: true };
    const P = game.player; game.player = m.tgt;
    try { Ent.prototype.doAct.call(m, def); } catch (e) { console.error('傀儡出招出错', e); m.act = null; }
    finally { game.player = P; }
    m.replaySq = d.sq; m.lockSt = 0;
    if (m.boss || m.elite || def.superArmor) warnMark(m, def.superArmor === true ? '#ff3a2a' : '#ffc02a');
  },
  onKill(d) {
    let m = this.puppets.get(d.id);
    if (!m) { const s = this.spawnInfo.get(d.id); if (!s || !MON[s.kind]) return; this.makePuppet(s); m = this.puppets.get(d.id); if (!m) return; }
    if (m._rewarded) return; m._rewarded = true; this.stats.kills++;
    m.lastDmg = d.ld || 0;
    const a = d.a === this.me() ? game.player : (this.mates.get(d.a) || game.player);
    if (!m.dead) { m.dead = true; m.setState('dead'); m.deadT = 0; m.act = null; m.vz = 0; }
    this.spawnInfo.delete(d.id);
    if (this.dg && this.dg.state !== 'failed') this.dg.onKill(m, a);
  },
  onRoom(d) {
    const dg = this.dg; if (!dg) return;
    const next = dg.layout.rooms.find(r => r.gx === d.gx && r.gy === d.gy); if (!next || next === dg.room) return;
    if (dg.state === 'result') return;
    lootAll(); projs.length = 0; groundFx.length = 0;
    dg.transition = { phase: 'out', t: 0, room: next, from: d.from }; sfx.door();
    // 进新房间：清掉旧傀儡，建新房间已知的怪（快照 / 生成事件可能比换房间事件先到）
    this.afterEnter = () => { for (const [id, m] of this.puppets) if (!ents.includes(m)) this.puppets.delete(id); const rk = this.rk(); for (const s of this.spawnInfo.values()) if (s.rk === rk) this.makePuppet(s); };
  },
  onClear(d) { const dg = this.dg; if (!dg || d.rk !== this.rk()) return; if (!dg.room.cleared) { dg.room.cleared = true; dg.onCleared(false); } },
  /* ---------------- 自己的状态（20Hz 发给所有队友） ---------------- */
  sendSelf() {
    const p = game.player; if (!p || !this.dg) return;
    const st = COOP_ST.indexOf(p.st);
    this.send({ k: 'p', rk: this.rk(), x: Math.round(p.x), y: Math.round(p.y), z: Math.round(p.z), f: p.face < 0 ? -1 : 1, st: st < 0 ? 0 : st, c: p.clipName, t: +p.animT.toFixed(2),
      hp: +clamp(p.hp / p.hpMax, 0, 1).toFixed(3), mp: +clamp(p.mp / p.mpMax, 0, 1).toFixed(3), dd: p.dead ? 1 : 0, lv: game.lvl }, 'all');
  },
  onMateState(uid, d, recvT) {
    const g = this.mates.get(uid); if (!g) return;
    g.away = d.rk !== this.rk() || (this.dg && !!this.dg.transition);
    g.netBuf.push({ t: recvT, x: d.x, y: d.y, z: d.z, f: d.f }); if (g.netBuf.length > 20) g.netBuf.splice(0, g.netBuf.length - 20);
    const st = COOP_ST[d.st] || 'idle';
    g.netSt = st; g.netClip = d.c; g.netT = d.t; g.netT0 = performance.now();
    g.hp = d.hp * g.hpMax; g.mpFrac = d.mp; g.lvl = d.lv || g.lvl;
    if (d.dd && !g.dead) { g.dead = true; g.deadT = 0; } else if (!d.dd && g.dead) { g.dead = false; g.deadT = 0; }
    if (g.act && st !== 'act' && performance.now() - (g.replayT || 0) > 250) { const a = g.act; g.act = null; coopSafe(() => { if (a.onEnd) a.onEnd(g, true); }); }
  },
  onMateAct(uid, d) {
    const g = this.mates.get(uid); if (!g || g.away) return;
    g.face = d.f < 0 ? -1 : 1; g.replayT = performance.now(); this.stats.mateActs++;
    coopSafe(() => {
      let def = null, extra;
      if (d.s && SKILLS[d.s] && SKILLS[d.s].act) {
        g.kit.lv[d.s] = d.lv || 1; extra = { skill: d.s, lv: d.lv || 1, type: SKILLS[d.s].type || g.dmgType, speed: d.sp || (SKILLS[d.s].cast ? 'cspd' : 1) };
        if (d.fo && g.act && g.act.follow) def = g.act.follow(g); else def = SKILLS[d.s].act(d.lv || 1, g);
      } else if (d.b) def = d.b === 'back' ? (g.acts && g.acts.back) || BACKSTEP : g.acts && g.acts[d.b];
      if (!def) def = { name: d.c || 'idle', clip: d.c || 'idle', dur: d.du || 0.4 };
      g.doAct(def, extra);
    });
  },
  /* ---------------- 每 50ms：发快照 / 自己的状态；主机切到后台时靠这里推进模拟 ---------------- */
  tick() {
    if (this.state !== 'play' || !net.connected) return;
    const now = performance.now();
    if (this.role === 'host') {
      if (document.hidden) this.bgStep();
      // 队长倒下（复活倒计时）时 Dungeon.update 不判定清房：这里补上，别让队友干等
      const dg = this.dg;
      if (dg && dg.state === 'dead' && !dg.room.cleared && dg.room.type !== 'boss' && !(dg.waves && dg.waves.length) && !ents.some(e => e.team === 'e' && !e.dead)) { dg.room.cleared = true; dg.onCleared(false); }
      this.flushSpawns();
      if (now - this.lastSnap >= COOP_SNAP_MS - 5) { this.lastSnap = now; this.snapshot(); }
    }
    if (this.hitQ.length) { this.send({ k: 'hb', l: this.hitQ }); this.hitQ = []; }
    if (now - this.lastSelf >= COOP_SNAP_MS - 5) { this.lastSelf = now; this.sendSelf(); }
    // 队员：主机那边已经没有了的怪（快照里 1.5 秒没出现）→ 移除
    if (this.role === 'guest' && this.dg && !this.dg.transition && !this.hostLag) for (const [id, m] of this.puppets) {
      if (m.dead || !m.seenT || now - m.seenT < 1500) continue;
      const i = ents.indexOf(m); if (i >= 0) ents.splice(i, 1); this.puppets.delete(id);
    }
  },
  // 主机页面在后台时浏览器不画帧：靠收到的消息 / 定时器补跑逻辑（不渲染），队友那边的怪物照常动
  bgStep() {
    if (this.role !== 'host' || this.state !== 'play' || !document.hidden) return;
    const now = performance.now(), dt = Math.min(0.5, (now - (this.bgLast || lastT)) / 1000);
    if (dt < 1 / 60) return;
    this.bgLast = now; lastT = now;
    const n = Math.min(30, Math.floor(dt * 60));
    for (let i = 0; i < n; i++) { try { step(1 / 60); } catch (e) { console.error(e); break; } }
    this.flushSpawns(); this.snapshot(); this.lastSnap = now;
  },
  /* ---------------- 收消息 ---------------- */
  onRelay(from, d) {
    const recvT = performance.now();
    if (this.role === 'host') {
      if (d.k === 'ready') this.onResp(from, true);
      else if (d.k === 'nope') this.onResp(from, false, d.why);
      else if (d.k === 'hb' && this.state === 'play' && Array.isArray(d.l)) { for (const r of d.l.slice(0, 80)) if (r.g !== undefined) this.remoteGrab(from, r); else this.remoteHit(from, r); }
      else if (d.k === 'resync' && this.state === 'play') this.onResync(from, +d.last || 0);
      else if (d.k === 'st' && this.state === 'play') { const m = this.puppets.get(d.id); if (m && !m.dead && ents.includes(m) && STATUS_COL[d.kind]) _coopAddStatus(m, d.kind, clamp(+d.dur || 0, 0, 30), { dps: clamp(+d.dps || 0, 0, 1e7), src: this.mates.get(from) || null, force: !!d.fo }); }
      else if (d.k === 'door' && this.state === 'play' && this.dg && this.dg.doorsOpen && !this.dg.transition && this.dg.room.doors[d.dir]) this.dg.go(d.dir);
      if (document.hidden) this.bgStep();
    } else if (from === this.hostId) {
      if (d.sq) this.lastSq = Math.max(this.lastSq, d.sq);
      if (d.k === 'prep') this.onPrep(d, from);
      else if (d.k === 'go' && this.state === 'load') this.start({ seed: d.seed, roomSeeds: d.rs, hpMul: d.mul }, d.mem);
      else if (d.k === 'drop') { chatSys(`没能跟上队伍：${d.why}`); net.send({ t: 'room:leave' }); this.reset(); }
      else if (this.state === 'play') {
        if (d.k === 's') this.onSnap(d, recvT);
        else if (d.k === 'spawn') this.onSpawn(d);
        else if (d.k === 'ma') this.onMonAct(d);
        else if (d.k === 'kill') this.onKill(d);
        else if (d.k === 'room') this.onRoom(d);
        else if (d.k === 'clear') this.onClear(d);
        else if (d.k === 'sync') this.onSync(d);
        else if (d.k === 'gbx') { const t = this.puppets.get(d.id); if (t && t.heldBy === game.player) dropGrab(game.player); }   // 主机那边抓不住（领主 / 刚被抓过等）：本地也放开
        else if (d.k === 'replay') this.onReplay(d);
      }
    }
    if (this.state === 'play') { if (d.k === 'p') this.onMateState(from, d, recvT); else if (d.k === 'a') this.onMateAct(from, d); }
  },
  onRoomMsg(m) {
    const R = m.room;
    if (R.kind !== 'dungeon') return;
    if (m.resume && this.state === 'none') { net.send({ t: 'room:leave' }); return; }   // 刷新过页面：服务端还记着旧房间，离开它
    this.room = R;
    if (m.resume) {
      this.hostLag = false; clearTimeout(this.resumeT);
      if (this.state === 'play') { chatSys('已恢复和队伍的连接'); if (this.role === 'host') { this.flushPending(); this.sendSync(); } else this.send({ k: 'resync', last: this.lastSq }); }
      return;
    }
    if (this.role === 'host' && this.state === 'prep' && R.host === this.me()) {
      const P = this.prep; P.mem = R.members.map(x => x.id).filter(id => id !== this.me());
      this.send({ k: 'prep', id: P.id, diff: P.diff, boss: this.def.boss ? { ...this.def.boss } : null });
      withLoading(this.bundles(this.def), () => { P.selfReady = true; if (P.goWhenReady || P.mem.every(id => P.resp.has(id))) this.goNow(); else this.waitDialog(); });
      if (!P.mem.length) this.goNow();
    } else if (R.host !== this.me()) { this.hostId = R.host; }
  },
  onRoomClosed(m) {
    if (!this.room || m.id !== this.room.id) return;
    const why = m.why;
    this.room = null;
    if (this.state === 'result' || this.state === 'none') { this.reset(); return; }
    if (this.role === 'guest' && this.state === 'load') { chatSys(why === 'host-lost' ? '队长掉线了，没能进图' : '队长取消了进图'); this.reset(); }
    else if (this.role === 'guest' && this.state === 'play') {
      const text = why === 'host-lost' ? '队长掉线了，地下城结束' : why === 'host-dead' ? '队长倒下了，地下城结束' : '队长离开了地下城';
      this.leaveToTown(`${text}，返回城镇（这次拿到的经验和物品都保留）`);
    } else if (this.role === 'host' && this.state === 'play') { chatSys('房间已关闭，队友和你断开了联机，地下城继续（单人）'); this.detach(); }
    else this.reset();
  },
  onRoomLeft(m) {
    if (!this.room || m.id !== this.room.id) return;
    if (this.state === 'prep') { if (this.prep && !this.prep.resp.has(m.user)) this.onResp(m.user, false, '离开了'); return; }
    this.removeMate(m.user, m.why === 'timeout' ? '掉线，离开了地下城' : '离开了地下城');
  },
  onRoomLag(m) {
    if (!this.room || m.id !== this.room.id) return;
    const g = this.mates.get(m.user); if (g) g.lag = m.on;
    if (m.user === this.hostId && this.role === 'guest') { this.hostLag = m.on; this.lagSince = performance.now(); if (m.on) chatSys('队长的连接中断了，正在等待重连…'); }
    else if (g) chatSys(`${this.nameOf(m.user)} ${m.on ? '连接中断，等待重连…' : '重新连上了'}`);
  },
  // 自己掉线重连后：服务端会补发 room { resume }；没有就说明房间已经没了
  onReconnect(restarted) {
    if (this.state === 'prep' || this.state === 'load') { if (restarted) this.abort('服务器重启了，这次进图取消了（入场道具已退还），请重新带队进入'); return; }
    if (this.state !== 'play') return;
    clearTimeout(this.resumeT);
    if (restarted) { chatSys(this.role === 'host' ? '服务器重启了，正在把队伍重新登记回服务器…' : '服务器重启了，正在重新加入队伍，稍等…'); this.hostLag = this.role === 'guest'; this.lagSince = performance.now(); }
    this.resumeT = setTimeout(() => {
      if (!this.room || this.state === 'none') return;
      if (this.role === 'guest') this.leaveToTown(restarted ? '服务器重启后没能重新加入队伍，返回城镇（这次拿到的经验和物品都保留）' : '和队伍的连接断开太久，已离开队伍，返回城镇（奖励保留）');
      else { chatSys(restarted ? '服务器重启后队友没有回来，地下城继续（单人）' : '和队友的联机断开太久，地下城继续（单人）'); this.detach(); }
    }, restarted ? 30000 : 4000);
  },
  leaveToTown(msg) {
    const dg = this.dg;
    toastMsg(msg, '#ffb08a'); chatSys(msg);
    this.end('left');
    if (dg && game.dungeon === dg && dg.state !== 'result') { menus.closeAll(); game.paused = false; lootAll(); goTown(); }
  },
  // 主机：断开联机但继续单人（队友全没了）
  detach() { for (const uid of [...this.mates.keys()]) this.removeMate(uid); this.cleanup(); this.role = null; this.state = 'none'; },
  // 结束组队刷图（回城 / 失败 / 放弃）
  end(why) {
    if (this.state === 'none' && !this.role) return;
    if (this.room) { if (this.role === 'host') net.send({ t: 'room:close', why: why === 'host-dead' ? 'host-dead' : 'end' }); else net.send({ t: 'room:leave' }); }
    this.cleanup(); this.reset();
  },
  cleanup() {
    for (const g of this.mates.values()) { const i = ents.indexOf(g); if (i >= 0) ents.splice(i, 1); }
    this.mates.clear();
    if (game.player) this.unhookPlayer(game.player);
    if (this.baseAttackers !== undefined) { game.maxAttackers = this.baseAttackers; this.baseAttackers = undefined; }
    if (menus.isOpen('nd_coopwait')) menus.close('nd_coopwait');
  },
  abort(msg) { if (msg) chatSys(msg); this.end('abort'); },
  reset() {
    if (this.entryCost && (this.state === 'prep' || this.state === 'load')) coopRefund(this.entryCost);   // 进图没成功：退还入场道具（深渊邀请函）
    this.entryCost = null;
    clearTimeout(this.waitT); clearTimeout(this.resumeT); clearTimeout(this.roomT);
    Object.assign(this, { role: null, room: null, state: 'none', dg: null, def: null, prep: null, hostLag: false, nid: 0, spawnQ: [], dmgQ: [], hitQ: [], pendingRel: [], relLog: [], sq: 0, lastSq: 0, mem: null });
    this.mates.clear(); this.puppets.clear(); this.spawnInfo.clear();
  },
};
// 入场消耗（深渊邀请函等）：对比 beforeEnter 前后的背包，记下扣掉了什么；进图没成功就原样退还
function coopEntryCost(fn) {
  const cnt = () => { const m = {}; for (const it of inv.items || []) if (it && it.key) m[it.key] = (m[it.key] || 0) + (it.n || 1); return m; };
  const a = cnt(), r = fn(); if (r === false) return false;
  const b = cnt(), used = [];
  for (const k in a) if ((b[k] || 0) < a[k]) used.push([k, a[k] - (b[k] || 0)]);
  return used.length ? used : null;
}
function coopRefund(list) {
  for (const [k, n] of list) { try { giveItem(makeItem(k, n)); toastMsg(`没有进入地下城：已退还 ${ITEMS[k] ? ITEMS[k].name : k} ×${n}`, '#bfe8ff'); } catch (e) { console.error('退还入场道具失败', e); } }
  if (save.data && save.live) save.write();
}
// 怪物当前的受伤倍率（圣光护盾、过热等临时效果）：队员看不到的由主机按比例补上
const coopTakenMul = t => (t.dmgTaken ?? 1) * (t.dmgTakenMul || 1) * (1 + buffVal(t, 'taken'));
const COOP_RELIABLE = new Set(['spawn', 'kill', 'room', 'clear', 'go', 'drop']);
const COOP_LOGGED = new Set(['spawn', 'kill', 'room', 'clear']);   // 带序号、主机保留最近的记录，给重连的队员补发
const COOP_HIT_KEYS = ['stun', 'knock', 'launch', 'airLift', 'down', 'downHit', 'spike', 'bounce', 'heavy', 'hs', 'radial', 'pull', 'otgLift', 'downLift', 'throwHit'];
function coopCleanHit(H) {
  const h = {}; if (!H || typeof H !== 'object') return h;
  for (const k of COOP_HIT_KEYS) { const v = H[k]; if (typeof v === 'number' && Number.isFinite(v)) h[k] = clamp(v, -2000, 2000); }
  for (const k of ['down', 'downHit', 'heavy', 'radial', 'pull', 'throwHit']) if (h[k] !== undefined) h[k] = !!h[k];
  return h;
}
// 影子重放技能时的保护：别让队友的觉醒冻住我的画面、抢我的镜头
function coopSafe(fn) {
  const s = { ts: game.timeStop, cut: game.cutin, sm: game.slowmo, sh: cam.shake, fl: cam.flash };
  try { fn(); } catch (e) { console.error('队友动作重放出错', e); }
  game.timeStop = s.ts; game.cutin = s.cut; game.slowmo = s.sm; cam.shake = Math.max(s.sh, Math.min(cam.shake, 3)); cam.flash = s.fl;
}
// 按插值缓冲取位置（renderT = 现在 − 插值延迟）
function coopInterp(e, dt, k = 18) {
  const B = e.netBuf; if (!B || !B.length) return;
  const rt = performance.now() - COOP_INTERP;
  while (B.length > 2 && B[1].t <= rt) B.shift();
  const A = B[0], N = B[1];
  let tx, ty, tz;
  if (N && rt > A.t) { const u = clamp((rt - A.t) / Math.max(1, N.t - A.t), 0, 1.5); tx = lerp(A.x, N.x, u); ty = lerp(A.y, N.y, u); tz = Math.max(0, lerp(A.z, N.z, Math.min(1, u))); }
  else { tx = A.x; ty = A.y; tz = A.z; }
  if (Math.abs(tx - e.x) > 260 || Math.abs(ty - e.y) > 120) { e.x = tx; e.y = ty; e.z = tz; }
  else { e.x = damp(e.x, tx, k, dt); e.y = damp(e.y, ty, k, dt); e.z = damp(e.z, tz, k, dt); }
  const L = B[B.length - 1]; if (!e.act) e.face = L.f;
}
// 动作推进（傀儡 / 影子共用）：时间窗内的霸体 / 无敌、update、事件，没有物理（位置来自网络）
function coopActStep(e, dt) {
  const a = e.act; if (e.st !== 'act' || !a) return 1;
  const spd = a.spd || 1;
  if (a.invul && inWin(a.invul, a.actT)) e.invul = Math.max(e.invul, 0.02);
  if (a.superArmor && a.superArmor !== true && inWin(a.superArmor, a.actT)) e.superArmor = Math.max(e.superArmor, 0.02);
  if (a.charge && !a.chargeDone && e.actT >= a.charge.at) { a.chargeDone = true; if (a.charge.onRelease) a.charge.onRelease(e, 0); }
  e.actT += dt * spd;
  if (a.update) a.update(e, dt);
  if (a.events && e.act === a) for (const ev of a.events) if (!ev.done && e.actT >= ev.t) { ev.done = true; ev.fn(e); if (e.act !== a) break; }
  if (e.act === a && e.actT >= a.dur) { e.act = null; if (a.onEnd) a.onEnd(e); }
  return spd;
}
// 队员这边的怪物傀儡
function coopPuppetUpdate(dt) {
  if (this.flash > 0 && !this.pred) this.flash -= dt;
  if (this.dead) { this.deadT = (this.deadT || 0) + dt; this.animate(dt); return; }
  if (this.heldBy) { this.stT += dt; this.animT += dt; updateHeld(this, dt); this.animate(dt); return; }   // 被我抓住：位置由我的抓取动作决定
  if (this.pred) {   // 本地预测中：完整跑一遍单机的实体逻辑（重力、浮空、落地、倒地起身），位置暂时不跟快照
    const P = game.player; if (this.tgt) game.player = this.tgt;
    try { Ent.prototype.update.call(this, dt); } catch (e) { console.error('傀儡预测出错', e); this.pred = 0; } finally { game.player = P; }
    const now = performance.now();
    if ((now > this.pred && this.z <= 0 && (this.free || this.st === 'act')) || now > this.predMax) { this.pred = 0; this.settle = now + 450; this.vx = this.vy = this.vz = 0; }
    return;
  }
  let spd = 1;
  if (this.hitstop > 0) this.hitstop -= dt;
  else {
    this.stT += dt;
    if (this.invul > 0) this.invul -= dt;
    if (this.superArmor > 0) this.superArmor -= dt;
    const P = game.player; if (this.tgt) game.player = this.tgt;
    try { spd = coopActStep(this, dt); } catch (e) { console.error('傀儡动作出错', e); this.act = null; } finally { game.player = P; }
    this.animT += dt * spd;
  }
  const settling = this.settle > performance.now();
  coopInterp(this, dt, settling ? 7 : 16);
  // 状态：本地出招中 / 刚被我打中（先显示本地的受击反应）时不覆盖，其余跟着主机；
  // 预测刚结束的一小段时间里，快照里“还在浮空 / 倒地”的是主机那边晚一拍的同一次受击，不再重播一遍
  const echo = settling && (this.netSt === 'air' || this.netSt === 'down' || this.netSt === 'getup' || this.netSt === 'hit');
  if (!this.act && !(this.lockSt > performance.now()) && !echo) { const s = this.netSt || 'idle'; if (this.st !== s) this.setState(s); }
  else if (!this.act && this.st === 'act') this.setState(this.netSt || 'idle');
  this.animate(dt);
}
// 队友影子
function coopGhostUpdate(dt) {
  if (this.flash > 0) this.flash -= dt;
  if (this.dead) this.deadT = (this.deadT || 0) + dt;
  this.stT += dt;
  if (this.invul > 0) this.invul -= dt;
  if (this.superArmor > 0) this.superArmor -= dt;
  let spd = 1;
  if (this.act) coopSafe(() => { spd = coopActStep(this, dt); });
  coopInterp(this, dt, 18);
  if (this.grabbed) holdGrabbed(this);   // 主机上：队员抓住的怪跟着队员的影子走
  if (this.act) { this.animT += dt * spd; this.animate(dt); return; }
  // 没在重放动作：动画直接用队友那边的片段和时间
  const want = this.dead ? 'dead' : this.netSt || 'idle';
  if (this.st !== want) this.setState(want);
  const clip = this.clips[this.netClip] ? this.netClip : 'idle';
  if (this.clipName !== clip) { this.clipName = clip; this.animT = this.netT || 0; }
  else { this.animT += dt; const want2 = (this.netT || 0) + (performance.now() - (this.netT0 || 0)) / 1000; if (Math.abs(this.animT - want2) > 0.25) this.animT = want2; }
  samplePose(this.clips[this.clipName] || this.clips.idle, this.animT, this.pose);
}
function coopGhostDraw(c) {
  if (this.away) return;
  if (this.dead && this.deadT > 1.2) return;
  Ent.prototype.draw.call(this, c);
}
// 队员：地下城里不自己刷怪（深渊波次、领主召唤等都以主机为准）
const _coopSpawnMonster = spawnMonster;
spawnMonster = function (kind, x, y, o) {
  const m = _coopSpawnMonster(kind, x, y, o);
  if (coop.state === 'play' || coop.state === 'result') {
    if (coop.role === 'guest' && !coop.allowSpawn) { const i = ents.indexOf(m); if (i >= 0) ents.splice(i, 1); m.remove = true; m.dead = true; return m; }
    if (coop.role === 'host' && game.dungeon === coop.dg) coop.hostMonster(m);
  }
  return m;
};
function netIsGuest() { return coop.isGuest(); }
// 队员的抓取：抓住 / 放开（含投掷）都按顺序排进命中包，主机照做
const _coopStartGrab = startGrab, _coopReleaseHeld = releaseHeld, _coopThrowGrab = throwGrab;
const coopGrabMine = (a, t) => coop.role === 'guest' && coop.state === 'play' && t && t.puppet && a === game.player;
startGrab = function (a, t, h) { _coopStartGrab(a, t, h); if (coopGrabMine(a, t) && t.heldBy === a) coop.hitQ.push({ id: t.nid, g: 1, bw: h && h.grabBoss ? 1 : 0, mw: h && h.grabMaxW !== undefined ? h.grabMaxW : 2.2 }); };
releaseHeld = function (t) { const a = t.heldBy; _coopReleaseHeld(t); if (coopGrabMine(a, t)) coop.hitQ.push({ id: t.nid, g: 0 }); };
throwGrab = function (a, h) { const t = a.grabbed; if (coopGrabMine(a, t)) coop.hitQ.push({ id: t.nid, g: 0 }); return _coopThrowGrab(a, h); };
// 队员给傀儡上的异常状态（灼烧 / 眩晕等）：转给主机结算，本地只保留表现（持续伤害由主机扣）
const _coopAddStatus = addStatus;
addStatus = function (t, kind, dur, o = {}) {
  if (t && t.ghost) return;   // 队友影子：异常状态由队友自己的客户端结算
  if (t && t.puppet && coop.role === 'guest' && coop.state === 'play') {
    coop.send({ k: 'st', id: t.nid, kind, dur: +(+dur || 0).toFixed(2), dps: Math.round(o.dps || 0), fo: o.force ? 1 : 0 });
    return _coopAddStatus(t, kind, dur, { ...o, dps: 0 });
  }
  return _coopAddStatus(t, kind, dur, o);
};
// 队员：傀儡被本地击杀（例如领主死亡时本地清场）不发奖励，奖励只认主机的击杀事件
const _coopOnKill = game.onKill;
game.onKill = function (t, a) {
  if (t && t.puppet && coop.role === 'guest') { if (!t.dead) { t.dead = true; t.deadT = 0; } return; }
  return _coopOnKill.call(this, t, a);
};
// 进地下城：在队伍里（有在线队友）时走组队流程
const _coopEnterDungeon = enterDungeon;
enterDungeon = function (id, diff) {
  const P = netParty.p, online = P ? P.members.filter(m => m.online && m.id !== coop.me()).length : 0;
  if (!netOn() || !net.connected || !P || !online || coop.state !== 'none') return _coopEnterDungeon(id, diff);
  if (!netParty.isLeader()) {
    netAsk('solo', { title: '单独进入？', text: '你在队伍里，组队刷图要由队长在地下城门口带队进入。<br>要自己单独进入这个地下城吗？', okText: '单独进入', cancelText: '取消', ok: () => { if (_coopEnterDungeon(id, diff)) menus.close('dungeon'); } });
    return false;
  }
  return coop.lead(id, diff);
};
// 组队时打开窗口不暂停（别人还在打）
const _coopMenusOpen = menus.open;
menus.open = function (name, arg) { const r = _coopMenusOpen.call(this, name, arg); if (coop.state === 'play' && game.dungeon && game.dungeon.state !== 'result') game.paused = false; return r; };
// 结算：组队时没有“再次挑战”（大家各自回城，队长在门口重新带队）
const _coopResult = menus.w_result;
menus.w_result = function (dg) {
  const el = _coopResult.call(this, dg);
  if (coop.role && el) { const b = [...el.querySelectorAll('button')].find(x => x.textContent === '再次挑战'); if (b) b.remove(); }
  return el;
};
// 回城 / 换场景：组队刷图结束
bus.on('sceneEnter', () => { if (coop.state !== 'none' && coop.state !== 'load' && coop.state !== 'prep') coop.end('town'); });
bus.on('charLeave', () => { if (coop.state !== 'none') coop.end('leave'); });
bus.on('partyChange', e => {
  if (e.party || coop.state === 'none' || coop.state === 'result') return;
  if (coop.role === 'guest') coop.leaveToTown('你已经不在队伍里了');
  else if (coop.state === 'play') { chatSys('队伍解散了，地下城继续（单人）'); coop.end('solo'); }
});
net.on('r', m => { if (coop.role || m.d.k === 'prep') coop.onRelay(m.f, m.d); });
net.on('room', m => coop.onRoomMsg(m));
net.on('room:closed', m => coop.onRoomClosed(m));
net.on('room:left', m => coop.onRoomLeft(m));
net.on('room:lag', m => coop.onRoomLag(m));
bus.on('netOpen', e => coop.onReconnect(e && e.restarted));
// 服务端重启后：队长 / 决斗发起方把队伍和房间重新登记回去，其他人认领自己的队长（服务端两边都对上才算数）
function netRestore() {
  if (!net.user) return;
  const me = net.user.id, P = netParty.prev;
  let room = null, host = 0;
  if (coop.state === 'play' && coop.room) {
    if (coop.role === 'host') room = { kind: 'dungeon', meta: coop.room.meta || {}, members: [...coop.mates.keys()] };
    else host = coop.hostId;
  } else if (netDuel.active() && netDuel.room && netDuel.peer) {
    if (netDuel.role === 'host') room = { kind: 'duel', meta: {}, members: [netDuel.peer.id] };
    else host = netDuel.room.host;
  }
  // 队友回来之前先当作“断线中”（怪物不追旧影子；决斗暂停）
  if (room && room.kind === 'dungeon') for (const g of coop.mates.values()) g.lag = true;
  if (room && room.kind === 'duel') netDuel.peerLag = true;
  const lead = P && P.leader === me;
  if (room || lead) net.send({ t: 'restore:host', party: lead ? P.members.map(m => m.id).filter(id => id !== me) : [], room });
  else if (host || P) net.send({ t: 'restore:claim', host: host || P.leader });
  netParty.restoredNote = false;
}
bus.on('netRestart', () => netRestore());
setInterval(() => coop.tick(), 25);
// 换房间以后（本地 enter 执行完）补建新房间的傀儡
const _coopDgEnter = Dungeon.prototype.enter;
Dungeon.prototype.enter = function (room, from) {
  _coopDgEnter.call(this, room, from);
  if (coop.dg === this && coop.role === 'guest' && coop.afterEnter) { const f = coop.afterEnter; coop.afterEnter = null; f(); }
  if (coop.dg === this) for (const g of coop.mates.values()) { g.x = game.player.x; g.y = game.player.y; g.netBuf.length = 0; }
  // 主机：清掉别的房间 / 已死的怪的登记（不能按“在不在 ents 里”判断：深渊领主会先藏起来，派对结束后才回到 ents）
  if (coop.dg === this && coop.role === 'host') { const rk = coop.rk(); for (const [id, m] of coop.puppets) if (m.dead || m.nrk !== rk) coop.puppets.delete(id); }
};
/* ---------------- 界面：队友头顶名字和血条、左侧队伍血条、队长掉线提示 ---------------- */
netUiHooks.push((c) => {
  if (coop.state !== 'play' && coop.state !== 'result') return;
  const inDg = game.scene === 'dungeon';
  if (inDg) for (const g of coop.mates.values()) {
    if (g.away || (g.dead && g.deadT > 1.2)) continue;
    const X = sx(g.x) * 2, Y = sy(g.y, g.z + (g.h || 104) + 18) * 2;
    if (X < -100 || X > 2020) continue;
    const w = 110, f = clamp(g.hp / g.hpMax, 0, 1);
    c.fillStyle = 'rgba(0,0,0,.6)'; c.fillRect(X - w / 2 - 2, Y + 6, w + 4, 10);
    c.fillStyle = f > 0.3 ? '#4ae05a' : '#ff4a3a'; c.fillRect(X - w / 2, Y + 8, w * f, 6);
    uiText(`${g.name}${g.lag ? '（连接中断）' : ''}`, X, Y, { size: 20, align: 'center', color: g.lag ? '#aaa' : '#ffb24a', sw: 4 });
  }
  // 左侧队伍面板
  const list = [{ me: true, name: save.data ? save.data.name : '', lvl: game.lvl, hp: game.player ? game.player.hp / game.player.hpMax : 1, mp: game.player ? game.player.mp / game.player.mpMax : 1, dead: game.player && game.player.dead, host: coop.role === 'host' },
    ...[...coop.mates.values()].map(g => ({ name: g.name, lvl: g.lvl, hp: g.hp / g.hpMax, mp: g.mpFrac ?? 1, dead: g.dead, lag: g.lag, host: g.uid === coop.hostId, away: g.away }))];
  let y = 150;
  for (const m of list) {
    c.fillStyle = 'rgba(8,6,12,.62)'; c.fillRect(16, y, 250, 54);
    uiText(`${m.host ? '♛ ' : ''}Lv.${m.lvl} ${m.name}${m.me ? '（你）' : ''}`, 26, y + 22, { size: 18, color: m.me ? '#ffe8a8' : '#ffb24a', sw: 3 });
    c.fillStyle = '#300'; c.fillRect(26, y + 30, 230, 9); c.fillStyle = m.dead ? '#555' : '#e83a3a'; c.fillRect(26, y + 30, 230 * clamp(m.hp, 0, 1), 9);
    c.fillStyle = '#012'; c.fillRect(26, y + 42, 230, 5); c.fillStyle = '#3a8aff'; c.fillRect(26, y + 42, 230 * clamp(m.mp, 0, 1), 5);
    if (m.dead || m.lag || m.away) uiText(m.dead ? '倒下' : m.lag ? '断线中' : '在别的房间', 256, y + 22, { size: 15, align: 'right', color: '#ff9a8a', sw: 3 });
    y += 60;
  }
  if (coop.hostLag && coop.role === 'guest') {
    const s = Math.max(0, 20 - Math.floor((performance.now() - coop.lagSince) / 1000));
    uiText(`队长的连接中断了，等待重连…（${s}）`, 960, 300, { size: 34, align: 'center', color: '#ffb08a', sw: 6 });
  }
});
