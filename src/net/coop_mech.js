/* =====================================================================
   组队刷图 · 领主机制同步（领主机制库 BOSS_MECHS，game/mon_skills.js）
   - 主机：机制启动 / 结束 / 关键时刻（msNetEv：一轮落石的位置、护盾惩罚、破招、属性切换、分身惩罚……）→ 可靠消息
       { k: 'mech', id: 怪物编号, u: 机制编号, e: 'start' | 'end' | 's'（HUD 数值）| 事件名, use?, p?, d? }
     破招槽 / 护盾值这类 HUD 数值变了才发（最快 200ms 一次）；队员重连时随 sync 补发还在进行的机制
   - 队员：按各机制的 mirror 重放同样的预警、文字、攻击（打的是队员自己，谁挨打谁结算）；
     结果（护盾破没破、水晶 / 小怪打完没有、无敌解除、属性切换）只认主机。本地的傀儡不启动机制（msMechStart 里挡掉）
   - 领主钩子（REGION_HOOKS）/ 房间机关的一次性事件：{ k: 'mech', id, e: 'hook', d: { h, … } } → 队员调 REGION_HOOKS[钩子].mirror[h] 或 MS_MIRROR[h]；
     钩子的本地计时（凝视、钻地、保护模式倒计时）每步调 mirror.tick
   ===================================================================== */
COOP_RELIABLE.add('mech');
Object.assign(coop, { mechs: new Map(), mechLast: new Map(), mechU: 0, mechStT: 0 });   // mechLast：最后一次见到的傀儡（领主藏起来以后傀儡会被移除，机制的攻击照样要有出手的人）
coop.stats.mechEv = 0; coop.stats.mechHurt = {};
// 主机：发机制事件（先把排队的生成信息发出去：机制刷的水晶 / 暗影 / 搭档要先于机制事件到）
msNet = (m, st, ev, d) => {
  if (coop.role !== 'host' || coop.state !== 'play' || game.dungeon !== coop.dg) return;
  if (ev === 'hook') {   // 领主钩子（REGION_HOOKS）的一次性事件：目标换成玩家编号（主机本人 = 主机的编号，队员那边是主机的影子）
    const { tgE, ...o } = d || {}; if (tgE) o.tg = tgE.uid || coop.me();
    coop.flushSpawns(); coop.send({ k: 'mech', id: m.nid, e: 'hook', d: o }); coop.stats.mechEv++; return;
  }
  st.u ??= ++coop.mechU;
  coop.flushSpawns();
  const o = { k: 'mech', id: m.nid, u: st.u, e: ev };
  if (ev === 'start') { o.use = st.id; o.p = st.p; }
  if (d) o.d = d;
  coop.send(o); coop.stats.mechEv++;
};
msNetEnt = id => coop.puppets.get(id) || null;
const coopMechSnap = (m, st) => { const M = BOSS_MECHS[st.id]; return { k: 'mech', id: m.nid, u: st.u, e: 'start', use: st.id, p: st.p, d: M.net ? M.net(m, st, st.p) : null, t: +st.t.toFixed(2), s: M.netState ? M.netState(st) : null }; };
// 主机：HUD 数值（破招槽 / 护盾值）变了才发
function coopMechState() {
  const now = performance.now(); if (now - coop.mechStT < 200) return; coop.mechStT = now;
  for (const m of coop.puppets.values()) {
    if (m.dead || !m.msMechs) continue;
    for (const st of m.msMechs) {
      const M = BOSS_MECHS[st.id]; if (!st.u || st.done || !M.netState) continue;
      const v = M.netState(st), k = JSON.stringify(v); if (k === st.nsLast) continue;
      st.nsLast = k; coop.send({ k: 'mech', id: m.nid, u: st.u, e: 's', d: v });
    }
  }
}
// 队员：某只怪的机制镜像列表（和傀儡的 msMechs 是同一个数组，HUD 照常画）
function coopMechList(id) {
  let L = coop.mechs.get(id); if (!L) { L = []; coop.mechs.set(id, L); }
  const m = coop.puppets.get(id); if (m) { if (m.msMechs !== L) m.msMechs = L; coop.mechLast.set(id, m); }
  return L;
}
// 队员：调机制的 mirror（这期间新放的地面预警标上机制名，打中自己时记进 stats.mechHurt）
function coopMechCall(id, st, kind, d, ev) {
  const M = BOSS_MECHS[st.id], fn = M && M.mirror && M.mirror[kind]; if (!fn) return;
  const m = coop.puppets.get(id) || coop.mechLast.get(id) || null, n0 = groundFx.length, s0 = msNetSrc; msNetSrc = st.id;
  try { if (kind === 'ev') fn(m, st, st.p, ev, d || {}); else fn(m, st, st.p, d || {}); }
  catch (e) { console.error('领主机制镜像出错', st.id, kind, e); }
  finally { msNetSrc = s0; }
  for (let i = n0; i < groundFx.length; i++) coopMechTag(groundFx[i], st.id);
}
function coopMechTag(g, id) {
  if (g.mech) return; g.mech = id; const f = g.fire; if (!f) return;
  g.fire = function (...a) { const s0 = msNetSrc; msNetSrc = id; try { return f.apply(this, a); } finally { msNetSrc = s0; } };
}
function coopMechRecv(d) {
  if (d.e === 'all') { coopMechClear(); for (const o of d.l || []) coopMechRecv(o); return; }
  if (d.e === 'hook') {
    const m = coop.puppets.get(d.id), D = d.d || {}, H = m && m.def_ && m.def_.hook && REGION_HOOKS[m.def_.hook], fn = (H && H.mirror && H.mirror[D.h]) || MS_MIRROR[D.h]; if (!fn || !m || m.dead) return;
    const tgE = D.tg === coop.me() ? game.player : coop.mates.get(D.tg) || game.player, n0 = groundFx.length, s0 = msNetSrc; msNetSrc = 'hook:' + D.h;
    try { fn(m, { ...D, tgE }); } catch (e) { console.error('领主钩子镜像出错', D.h, e); } finally { msNetSrc = s0; }
    for (let i = n0; i < groundFx.length; i++) coopMechTag(groundFx[i], 'hook:' + D.h);
    return;
  }
  const L = coopMechList(d.id);
  if (d.e === 'start') {
    if (!BOSS_MECHS[d.use] || L.some(s => s.u === d.u)) return;
    const st = { id: d.use, p: d.p || {}, t: +d.t || 0, done: false, mirror: true, u: d.u };
    L.push(st); coopMechCall(d.id, st, 'start', d.d);
    if (d.s) Object.assign(st, d.s);
    return;
  }
  const st = L.find(s => s.u === d.u); if (!st) return;
  if (d.e === 's') Object.assign(st, d.d);
  else if (d.e === 'end') { st.done = true; coopMechCall(d.id, st, 'end', d.d); L.splice(L.indexOf(st), 1); }
  else coopMechCall(d.id, st, 'ev', d.d, d.e);
}
function coopMechClear() { for (const L of coop.mechs.values()) for (const st of L) st.done = true; coop.mechs.clear(); coop.mechLast.clear(); }
function coopMechDrop(id) { const L = coop.mechs.get(id); coop.mechLast.delete(id); if (!L) return; for (const st of L) st.done = true; coop.mechs.delete(id); }
// 队员：每个逻辑步推进镜像（倒计时、场地缩小、属性法阵站位），傀儡的受伤倍率按镜像算（本地伤害数字对得上）
function coopMechTick(dt) {
  for (const [id, L] of coop.mechs) {
    const m = coop.puppets.get(id) || null; if (m) { if (m.msMechs !== L) m.msMechs = L; coop.mechLast.set(id, m); }
    for (const st of L) { if (st.done) continue; st.t += dt; coopMechCall(id, st, 'update', dt); }
    if (m && m.msMul) { let mul = 1; for (const k in m.msMul) mul *= m.msMul[k]; m.dmgTakenMul = mul; }
  }
}
// 队员：领主钩子的本地计时（REGION_HOOKS[名字].mirror.tick：凝视 / 钻地 / 保护模式倒计时给 HUD，凝视到点按自己的朝向判定自己）
function coopHookTick(dt) {
  for (const m of coop.puppets.values()) {
    if (m.dead || !m.boss || !m.def_ || !m.def_.hook) continue;
    const H = REGION_HOOKS[m.def_.hook], fn = H && H.mirror && H.mirror.tick; if (!fn) continue;
    const s0 = msNetSrc; msNetSrc = 'hook:' + m.def_.hook;
    try { fn(m, dt); } catch (e) { console.error('领主钩子镜像出错', m.def_.hook, e); } finally { msNetSrc = s0; }
  }
}
// 接线：收消息、每步推进、换房间 / 击杀 / 结束时清理、傀儡重建时接回镜像、重连补发
const _cmRelay = coop.onRelay;
coop.onRelay = function (from, d) {
  if (d && d.k === 'mech') { if (this.role === 'guest' && from === this.hostId && this.state === 'play') { try { coopMechRecv(d); } catch (e) { console.error('领主机制同步出错', e); } } return; }
  return _cmRelay.call(this, from, d);
};
const _cmTick = coop.tick;
coop.tick = function () { _cmTick.call(this); if (this.role === 'host' && this.state === 'play' && net.connected) coopMechState(); };
const _cmGround = updateGroundFx;
updateGroundFx = function (dt) { _cmGround(dt); if (coop.role === 'guest' && coop.state === 'play') { if (coop.mechs.size) coopMechTick(dt); coopHookTick(dt); } };
// 击杀：清掉这只怪的机制镜像；带死亡爆炸特性的怪（区域怪 onDeath: 'explode'，比如爆裂暗影）在傀儡的位置也炸一次（打的是自己）
const _cmKill = coop.onKill;
coop.onKill = function (d) {
  const m0 = this.puppets.get(d.id), live = !!(m0 && !m0.dead && ents.includes(m0));
  _cmKill.call(this, d); coopMechDrop(d.id);
  const X = live && m0.def_ && typeof msDeathExplode === 'function' ? msDeathExplode(m0.def_) : null;
  if (X) { const n0 = groundFx.length; msExplodeAt(m0, m0.x, m0.y, X, null); for (let i = n0; i < groundFx.length; i++) coopMechTag(groundFx[i], 'explode'); }
};
const _cmRoom = coop.onRoom;
coop.onRoom = function (d) { const r0 = this.dg && this.dg.room; _cmRoom.call(this, d); if (this.dg && this.dg.transition && this.dg.room === r0) coopMechClear(); };
const _cmClean = coop.cleanup;
coop.cleanup = function () { coopMechClear(); return _cmClean.apply(this, arguments); };
// 主机：出场就带的机制（破招槽、狂暴计时……）在编号之前就启动了，登记编号后补发
const _cmHost = coop.hostMonster;
coop.hostMonster = function (m) { _cmHost.call(this, m); if (m.msMechs) for (const st of m.msMechs) if (!st.done && !st.u) { const M = BOSS_MECHS[st.id]; msNet(m, st, 'start', M.net ? M.net(m, st, st.p) : null); } };
const _cmPuppet = coop.makePuppet;
coop.makePuppet = function (s) {   // 新建的傀儡：生成时本地自带启动的机制（出场的破招槽、属性法阵……）作废，换成主机那边的镜像
  const had = this.puppets.has(s.id); _cmPuppet.call(this, s); const m = this.puppets.get(s.id); if (!m || had) return;
  for (const st of m.msMechs || []) if (!st.mirror) st.done = st.ended = true;
  if (m.msMul) m.msMul = {}; m.dmgTakenMul = 1; m.msMechs = coop.mechs.get(s.id);
};
const _cmSync = coop.sendSync;
coop.sendSync = function (to) {
  _cmSync.call(this, to);
  if (this.role !== 'host' || !this.dg || this.dg.transition) return;
  const l = []; for (const m of this.puppets.values()) if (!m.dead && m.msMechs) for (const st of m.msMechs) if (st.u && !st.done) l.push(coopMechSnap(m, st));
  this.send({ k: 'mech', e: 'all', l }, to);
};
const _cmHurt = game.onPlayerHurt;
game.onPlayerHurt = function (p, dmg, a) { if (msNetSrc && coop.role === 'guest' && p === game.player) coop.stats.mechHurt[msNetSrc] = (coop.stats.mechHurt[msNetSrc] || 0) + 1; return _cmHurt.call(this, p, dmg, a); };
// 领主差异化 P0（docs/BOSS_SPEC.md §7）：
// - 队员按生成信息建傀儡时（allowSpawn）不启动机制、不刷搭档（出场就带连线 / duo 的领主，以前会在队员本地多刷一只真怪）
// - 特性要分“近战 / 远程 / 抓取”（saVsRanged、reflectRanged、grabOnly）：队员的命中包带上 mel / grb 两个标记，主机那边的 h 里也有
// - 傀儡建好后按特性补一次本地表现（hitHp 的伤害恒为 1 等）
msGuestSpawn = () => coop.role === 'guest' && !!coop.allowSpawn;
COOP_HIT_KEYS.push('mel', 'grb');
const _cmLocal = coop.localHit;
coop.localHit = function (t, a, dmg, crit, h) {
  const n = this.hitQ.length, r = _cmLocal.call(this, t, a, dmg, crit, h), q = this.hitQ[this.hitQ.length - 1];
  if (this.hitQ.length > n && q && q.h && h) { if (h.box) q.h.mel = 1; if (h.grab) q.h.grb = 1; }
  return r;
};
const _cmPuppet2 = coop.makePuppet;
coop.makePuppet = function (s) {
  const had = this.puppets.has(s.id); _cmPuppet2.call(this, s); const m = this.puppets.get(s.id); if (!m || had) return;
  try { msTraitCall(m, 'puppet'); } catch (e) { console.error('傀儡特性出错', e); }
};
