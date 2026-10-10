/* =====================================================================
   团本领主机制运行时（docs/RAID_SIROCO.md §10）：把 RAID_MECH（game/raid_mech.js，纯逻辑）的领主脚本挂到领主身上。
   领主 spec 里写 mechs: [{ use: 'raidScript', intro, loop, weak: { at, pool }, onSolve, onFail, atk, lines }]（字段见 raid_mech.js 头部）。
   这里只做“世界 ↔ 事件”的翻译，所有谜题都走同一套：
     输入：本机玩家位置 / 朝向 / 是否蹲下（按住 ↓）/ 连打攻击、领主位置、打到物件 / 物件被打碎、被领主打中
     输出：谜题物件（msObjDef 程序画的水晶 / 心脏 / 图腾 / 墓碑）按 objs 生成和回收，地面标记（板 / 地砖 / 气泡 / 祭坛 / 光球 / 护罩圈）按 marks 画，
          挨打按最大 HP 结算（普通难度 ×0.6），状态翻译成异常（定身 / 减速 / 眩晕 / 失明），读条 / 虚弱 / 灭团 / 台词 / BGM 节拍
    只在主机跑（单人实例就是自己）；同房全部玩家都是输入：本机 = 'me'、组队队员 = 他的 uid（主机上的影子位置 / 队员自己上报的蹲下·连打·受击 rmin）。
    组队：主机每 200ms 把物件 / 地面标记 / HUD 数据（netState）镜像给队员，挨打 / 状态 / 传送 / 台词用 msNetEv 发给对应的人，队员自己结算（mirror）。
    只有一个人时自动降级：哈妮尔传心 / 崔拉&昙娜各引一球 / 卢克西吸血挡位这些多人机制回到简化版（raid_mech.js 里的 minPlayers / alt）。
   ===================================================================== */
Object.assign(MON, {
  rmObj_crystal: msObjDef('水晶', { shape: 'crystal', col: '#b890ff', h: 84 }),
  rmObj_heart: msObjDef('心脏', { shape: 'heart', col: '#ff6a8a', h: 76, botSkip: true }),
  rmObj_totem: msObjDef('分身', { shape: 'totem', col: '#a070ff', h: 116, botSkip: true }),
  rmObj_pillar: msObjDef('墓碑', { shape: 'pillar', col: '#b08a5a', h: 100, botSkip: true }),
});
const RM_EFF_DUR = 99;
// ---- 多人：谁在这个房间里 ----
// 主机 / 单机：[['me', 本机玩家], [队员 uid, 队员影子]…]；队员客户端不跑脚本（只镜像）
function rmRoster() {
  const L = [['me', msSelf()]];
  if (typeof coop !== 'undefined' && coop.role === 'host' && coop.state === 'play') for (const [uid, g] of coop.mates) L.push([String(uid), g]);
  return L.filter(([, e]) => e && !e.dead && !e.away);
}
const rmWho = e => (e && e.ghost ? String(e.uid) : 'me');
function rmEnt(who) {
  if (who === 'me') return msSelf();
  if (typeof coop === 'undefined') return null;
  for (const [uid, g] of coop.mates) if (String(uid) === who) return g;
  return null;
}
// 按人结算挨打：本机直接扣，队员由主机发消息、队员自己算（队友的影子由队友自己的客户端结算）
//   rmHurtWho(m, who, frac, down) / rmWipeAll(m, frac, down) 任何带 nid 的怪（领主 / 精英）都能调，走钩子通道（MS_MIRROR.rmHurt），不需要机制实例
function rmHurtWho(m, who, frac, down) {
  if (frac <= 0) return;
  if (who === 'me') { rmHurt(m, msSelf(), frac, down); return; }
  const e = rmEnt(who); if (!e || e.dead || e.away) return;
  msNetEv(m, null, 'hook', { h: 'rmHurt', w: who, f: +frac.toFixed(4), d: down ? 1 : 0 });
}
// 灭团：同房每个人都挨一遍
function rmWipeAll(m, frac, down) { for (const [who] of rmRoster()) rmHurtWho(m, who, frac, down); }
// 队员那边（钩子通道）：只有目标是自己才结算
MS_MIRROR.rmHurt = (m, D) => { if (typeof coop !== 'undefined' && D.w === String(coop.me()) && game.player) rmHurt(m, game.player, D.f, !!D.d); };
// 队员上报（只发给主机）：蹲下 / 连打 / 被打中。队员客户端在 mirror.update 里发，主机在 coop.onRelay 里收
let rmRelayHooked = false;
function rmNetInit() {
  if (rmRelayHooked || typeof coop === 'undefined') return; rmRelayHooked = true;
  const prev = coop.onRelay;
  coop.onRelay = function (from, d) {
    if (d && d.k === 'rmin') { if (this.role === 'host') rmMateIn(from, d); return; }
    return prev.call(this, from, d);
  };
}
const rmMateBuf = {};   // uid → { c: 蹲下, t: 收到的时间, m: 连打次数, h: 被打中次数 }
function rmMateIn(uid, d) { const b = rmMateBuf[uid] ??= { c: 0, t: 0, m: 0, h: 0 }; b.c = d.c ? 1 : 0; b.t = game.t || 0; b.m += Math.min(5, d.m | 0); b.h += Math.min(5, d.h | 0); }
function rmMateGet(uid) { const b = rmMateBuf[uid]; return b && (game.t || 0) - b.t < 0.7 ? b : null; }
// 本机玩家是否蹲下：按住 ↓ 0.12 秒以上、在地上（机器人 / 测试可以直接设 p.raidCrouch）
const rmCrouch = p => !!(p && (p.raidCrouch || (typeof input !== 'undefined' && p === (game.realPlayer || game.player) && input.heldFor('down') > 0.12)) && (p.z || 0) < 4);
// 按最大 HP 结算的伤害（down = 打倒）
function rmHurt(m, t, frac, down) {
  if (!t || t.dead || t.ghost || frac <= 0) return;
  if (down) { t.invul = 0; msTrueHit(m, t, frac); return; }
  if (t.invul > 0) return;
  const d = Math.max(1, Math.round(t.hpMax * frac)); t.hp -= d; addNumber(d, t.x, t.y, t.z, { player: t.team === 'p' });
  if (t.team === 'p' && !t.summon) game.onPlayerHurt(t, d, m);
  if (t.hp <= 0) { t.hp = 0; killEnt(t, m, {}); }
}
// BGM 节拍：领主曲上叠一记钟声 + 鼓点、屏幕闪一下（守门人之魂只在节拍后的窗口里能打碎）
function rmCue(m) {
  cam.flash = Math.max(cam.flash || 0, 0.12); cam.flashCol = '#c8a0ff'; cam.shake = Math.max(cam.shake, 3);
  if (m) fxText('♪', m.x, m.y, m.z + m.h * (m.scale || 1) + 40, { col: '#e0c0ff', size: 26, dur: 0.9 });
  try { if (sfx.ctx && !sfx.muted && typeof MI !== 'undefined') { const t = sfx.ctx.currentTime + 0.01; MI.bell(t, 72, 0.12, 1.2); MI.bell(t, 79, 0.08, 1.2); } sfx.boom(0.35); } catch (e) { /* 没有音频也照样跑 */ }
}
// 地面标记：一个常驻特效（y 很小 → 画在所有人下面）
function rmMarksFx(m, st) {
  return addFx({ x: 0, y: -1e5, z: 0, dur: 1e9, st,
    // 领主倒下 / 被移走：机制不会再 update，这里收尾（谜题物件也算房间里的怪，不收会卡住通关）
    update() { if (st.mirror) { if (st.done) this.dur = 0; return; } if (!st.ended && (m.dead || (m.remove && !m.msHidden) || !ents.includes(m) && !m.msHidden)) { st.done = st.ended = true; BOSS_MECHS.raidScript.end(m, st); this.dur = 0; } },
    draw(c) {
    const L = rmMarkList(this.st);
    const P = msSelf(), now = game.t || 0;
    for (const mk of L) {
      const X = sx(mk.x), Y = sy(mk.y, 0), on = !!mk.on, a = on ? 0.5 + 0.2 * Math.sin(now * 6) : 0.3;
      c.save(); c.globalCompositeOperation = 'lighter';
      if (mk.shape === 'tile') {   // 地砖 / 全屏警告
        if (mk.w >= msRoomW() * 0.9) { if (!on) { c.restore(); continue; } c.globalAlpha = 0.18 + 0.12 * Math.sin(now * 12); c.fillStyle = mk.col; c.fillRect(sx(0), sy(DEPTH, 0) - 4, sx(msRoomW()) - sx(0), sy(0, 0) - sy(DEPTH, 0) + 8); }
        else { const w = sx(mk.x + mk.w / 2) - sx(mk.x - mk.w / 2), h = (sy(mk.y - mk.h / 2, 0) - sy(mk.y + mk.h / 2, 0)) || mk.h * 0.5; c.globalAlpha = on ? 0.35 : 0.16; c.fillStyle = mk.col; c.fillRect(X - w / 2 + 2, Y - h / 2 + 1, w - 4, h - 2); c.globalAlpha = on ? 0.8 : 0.3; c.strokeStyle = mk.col; c.lineWidth = 1.5; c.strokeRect(X - w / 2 + 2, Y - h / 2 + 1, w - 4, h - 2); }
      } else if (mk.shape === 'ring') {   // 护罩 / 连线的最小距离圈
        if (!on && !mk.r) { c.restore(); continue; }
        c.translate(X, Y); c.scale(1, GR); c.globalAlpha = on ? 0.7 : 0.35; c.strokeStyle = mk.col; c.lineWidth = 3; c.setLineDash([10, 8]); c.lineDashOffset = -now * 30; c.beginPath(); c.arc(0, 0, mk.r, 0, TAU); c.stroke();
      } else {   // 板 / 气泡 / 祭坛 / 光球 / 剑
        const R = mk.r || 20; c.globalCompositeOperation = 'source-over'; c.translate(X, Y); c.scale(1, GR);
        c.globalAlpha = 0.75; c.strokeStyle = 'rgba(10,6,16,.9)'; c.lineWidth = 7; c.beginPath(); c.arc(0, 0, R, 0, TAU); c.stroke();   // 深色描边：亮背景上也看得清
        c.globalAlpha = a; c.fillStyle = mk.col; c.beginPath(); c.arc(0, 0, R, 0, TAU); c.fill();
        c.globalAlpha = 1; c.strokeStyle = shade(mk.col, on ? 0.35 : 0, 1); c.lineWidth = mk.shape === 'orb' ? 5 : 3.5; c.beginPath(); c.arc(0, 0, R, 0, TAU); c.stroke();
      }
      c.restore();
      if (mk.shape === 'orb') { c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = shade(mk.col, 0.3, 0.8); c.beginPath(); c.arc(X, Y - 26 - 4 * Math.sin(now * 4 + mk.x), 9, 0, TAU); c.fill(); c.restore(); }
      if (mk.label) { const ly = Y - (mk.shape === 'orb' ? 42 : 4); if (mk.label.length <= 2) uiTextWorld(c, mk.label, X, ly + 10, on ? '#fff6c0' : '#e8e0f8'); else uiTextWorld2(c, mk.label, X, ly, on ? '#fff6c0' : '#d8d0e8'); }
    }
    // 连线：领主 → 本机玩家（太近变红）
    const TT = rmTether(this.st); if (TT && P) { const near = gdistXY(P, TT) < TT.min; c.save(); c.strokeStyle = near ? '#ff4a4a' : '#7affd0'; c.lineWidth = 3; c.globalAlpha = 0.8; c.setLineDash([6, 6]); c.lineDashOffset = -now * 40; c.beginPath(); c.moveTo(sx(TT.x), sy(TT.y, 70)); c.lineTo(sx(P.x), sy(P.y, 50)); c.stroke(); c.restore(); }
  } });
}
function rmMarkList(st) {
  if (!st.S) return st.M || [];
  const S = st.S, L = []; if (S.cast && S.cast.marks) L.push(...S.cast.marks); for (const s of S.side) if (s.marks) L.push(...s.marks); return L;
}
function rmTether(st) {
  if (!st.S) return st.tt || null;
  const S = st.S; for (const s of S.side.concat(S.cast ? [S.cast] : [])) if (s.id === 'tether' && s.anchor) return { x: s.anchor.x, y: s.anchor.y, min: s.p.min };
  return null;
}
const gdistXY = (a, b) => Math.hypot(a.x - b.x, (a.y - b.y) / GR);
function rmRaidMode() { return typeof raidNet !== 'undefined' && raidNet.S && raidNet.S.graph === 'guide' ? 'guide' : 'normal'; }

defineBossMech('raidScript', { defaults: {},
  start(m, st, p) {
    st.S = RAID_MECH.scriptNew(p, Math.floor(Math.random() * 1e9), { W: msRoomW(), D: DEPTH, mode: p.mode || rmRaidMode(), players: rmRoster().map(r => r[0]) });
    rmNetInit(); st.known = new Set(['me']); st.ents = {}; st.q = []; st.ps = {}; st.php = null; st.intro = false; st.brk = 0; st.rest = 0; st.restWait = null; st.p = p; st.log = [];
    st.fx = rmMarksFx(m, st);
    if (p.orderCue) { const k = rmRaidOrder(); if (k) { msSay(m, `吸入了 ${k} 个灵魂`, '#e0c0ff', 15); for (let i = 0; i < k; i++) rmSoulFx(m, i); } }
    rmApply(m, st, RAID_MECH.scriptTick(st.S, 0, { hp: m.hp / m.hpMax }));
  },
  update(m, st, p, dt) {
    if (!st.S) return;   // 组队队员那边是傀儡（不跑 start），脚本只在主机跑
    // 子弹时间里领主的 dt 已经变慢（谜题时限 / 虚弱跟着延长 = 官方“用无之轨迹延长机制时间”）；rdt = 真实时间（玩家的状态、子弹时间本身）
    const rdt = rmBtRealDt(m, dt), sdt = st.S.ph === 'break' && p.btNoBreak ? rdt : dt;   // btNoBreak：子弹时间不能延长虚弱（维塔 [NAMU-PAIN]）
    rmBtTick(m, st, rdt);
    const ev = st.q.splice(0), roster = rmRoster(), alive = new Set();
    for (const [who, e] of roster) {
      alive.add(who);
      if (who === 'me') {
        ev.push({ k: 'pos', who, x: e.x, y: e.y, face: e.face, z: e.z || 0, crouch: rmCrouch(e) });
        if (RAID_MECH.stHas(st.ps, 'buried') && (e.raidMash || (typeof input !== 'undefined' && input.hit('attack')))) { e.raidMash = false; ev.push({ k: 'mash', who }); }
        if (st.php != null && e.hp < st.php - 0.5) ev.push({ k: 'hurt', who });
        st.php = e.hp;
      } else {
        const b = rmMateGet(who);
        ev.push({ k: 'pos', who, x: e.x, y: e.y, face: e.face, z: e.z || 0, crouch: !!(b && b.c) });
        const bb = rmMateBuf[who]; if (bb) { for (; bb.m > 0; bb.m--) ev.push({ k: 'mash', who }); for (; bb.h > 0; bb.h--) ev.push({ k: 'hurt', who }); }
      }
    }
    for (const w of [...st.known]) if (!alive.has(w)) { st.known.delete(w); ev.push({ k: 'leave', who: w }); }
    for (const w of alive) st.known.add(w);
    st.S.C.players = [...alive];
    ev.push({ k: 'anchor', x: m.x, y: m.y, face: m.face });
    for (const key of Object.keys(st.ents)) {
      const e = st.ents[key], [tag, i] = key.split(':');
      const by = rmWho(e.lastHitBy);
      if (e.dead || e.remove || e.hp <= 0) { if (!e.__rmGone) ev.push({ k: 'kill', tag, i: +i, who: by }); delete st.ents[key]; continue; }
      if (e.hp < e.__rmHp) { ev.push({ k: 'hit', tag, i: +i, who: by }); e.lastHitBy = null; if (e.__rmKeep) e.hp = e.hpMax; }
      e.__rmHp = e.hp;
    }
    rmApply(m, st, RAID_MECH.scriptTick(st.S, sdt, { hp: m.hp / m.hpMax, ev }));
    if (p.orderCue && !st.cued && st.S.t >= p.orderCue.at) { st.cued = true; rmOrderCue(m, p.orderCue); }
    rmSyncObjs(m, st);
    for (const id of RAID_MECH.stTick(st.ps, rdt)) rmStatusOff(st, id);
    // rest：固定出招循环里每招放完回到中央、脚下黑雾站着（受伤 ×mul）——蕾娜 [91-夜]
    if (st.restWait != null && !m.act && (game.t || 0) - st.restWait > 0.3) { st.restWait = null; st.rest = p.rest.dur; m.x = msRoomW() / 2; m.y = DEPTH / 2; m.vx = m.vy = 0; fxBurst(m.x, m.y, 60, 160, '#4a3a6a'); msMulSet(m, 'raidRest', p.rest.mul || 1.3); }
    if (st.rest > 0) { st.rest -= dt; m.aiCd = Math.max(m.aiCd || 0, 0.3); if (Math.random() < 0.4) fxCharge(m, '#3a2a4a'); if (st.rest <= 0) msMulSet(m, 'raidRest', null); }
    // 出场 / 读条 / 虚弱 / 黑雾时领主站着不动（读条是引导，不追人）
    const hold = st.intro || st.S.ph === 'cast' || st.brk > 0 || st.rest > 0;
    if (hold && m.__rmSpd == null) { m.__rmSpd = m.speed; m.speed = 0; } else if (!hold && m.__rmSpd != null) { m.speed = m.__rmSpd; m.__rmSpd = null; }
    if (st.intro) { m.invul = Math.max(m.invul, 0.2); m.aiCd = Math.max(m.aiCd || 0, 0.2); }
    if (st.S.ph === 'cast') { m.aiCd = Math.max(m.aiCd || 0, 0.3); if (Math.random() < 0.25) fxCharge(m, '#c080ff'); }
    if (st.brk > 0) { st.brk -= sdt; m.stun = Math.max(m.stun || 0, Math.min(0.3, st.brk)); m.aiCd = Math.max(m.aiCd || 0, 0.3); if (m.st !== 'hit' && m.st !== 'air' && m.st !== 'down') m.setState('hit'); }
  },
  onHit(m, st, dmg, a) { if (st.q && a && (a.team === 'p' || (a.owner && a.owner.team === 'p'))) { const who = rmWho(a.ghost ? a : a.owner && a.owner.ghost ? a.owner : null); st.q.push({ k: 'hit', tag: 'boss', who }, { k: 'dmg', frac: (dmg || 0) / m.hpMax, who }); } },
  end(m, st) {
    if (!st.S) return;
    for (const e of Object.values(st.ents)) { e.__rmGone = true; e.remove = true; }
    st.ents = {}; if (st.fx) st.fx.dur = 0;
    for (const id of Object.keys(st.ps)) rmStatusOff(st, id);
    if (m.msMul) { delete m.msMul.raidBreak; delete m.msMul.raidReflect; msMulSet(m, 'raidRest', null); }
    if (m.__rmSpd != null) { m.speed = m.__rmSpd; m.__rmSpd = null; }
  },
  hud(c, m, st, x, y, w) {
    let V, B, cn, idur;
    if (st.S) { V = RAID_MECH.view(st.S); B = st.S.brkSpec || st.S.spec.onSolve; cn = st.S.spec.cast && st.S.spec.cast.name; idur = st.S.spec.intro.dur || 1; }
    else if (st.V) { V = st.V; B = st.B || { dur: 1, mul: 1 }; cn = st.cn; idur = st.idur || 1; }   // 队员：主机发来的 HUD 数据
    else return 0;
    let h = 0;
    if (V.ph === 'intro') { msBar(c, x, y, w, 1 - V.phT / idur, '#b890ff', '出场 · 无敌'); h += 16; }
    if (V.cast) { const k = V.cast.dur ? 1 - V.cast.t / V.cast.dur : 1; msBar(c, x, y + h, w, k, '#ff7a5a', `${cn || '读条'} · ${V.cast.name}`); uiText(`${V.cast.hint}${V.cast.text ? '　' + V.cast.text : ''}`, x + w / 2, y + h + 32, { size: 14, align: 'center', color: '#ffe0c0', sw: 3 }); h += 36; }
    if (V.ph === 'break') { msBar(c, x, y + h, w, 1 - V.phT / B.dur, '#7aff9a', `虚弱！受到伤害 ×${B.mul}`); h += 16; }
    for (const s of V.side) { uiText(`${s.name}：${s.hint}${s.text ? '　' + s.text : ''}`, x + w / 2, y + h + 14, { size: 14, align: 'center', color: '#ffb0a0', sw: 3 }); h += 18; }
    for (const b of [V.cast && V.cast.bar, ...V.side.map(s => s.bar)]) if (b) { msBar(c, x, y + h, w, b.k, b.col, b.label); h += 16; }   // 谜题自己的条：呼吸 / 护盾 / 聚集 / 吸入
    h += rmPoolHud(c, x, y + h, w);
    h += rmBtHud(c, x, y + h, w);
    return h;
  },
  // 组队同步：主机把 HUD / 地面标记 / 物件外观每 200ms 镜像给队员（coop_mech 的 netState），事件（挨打 / 状态 / 传送 / 台词）走 msNetEv
  net(m, st) { return { r: 1 }; },
  netState(st) {
    const S = st.S; if (!S) return null;
    const r = v => Math.round(v), mk = rmMarkList(st).map(q => ({ x: r(q.x), y: r(q.y), r: r(q.r || 0), w: q.w ? r(q.w) : undefined, h: q.h ? r(q.h) : undefined, col: q.col, label: q.label || '', on: q.on ? 1 : 0, shape: q.shape })), TT = rmTether(st);
    return { V: RAID_MECH.view(S), B: S.brkSpec || S.spec.onSolve, cn: S.spec.cast && S.spec.cast.name, idur: S.spec.intro.dur || 1, M: mk, tt: TT && { x: r(TT.x), y: r(TT.y), min: TT.min },
      O: Object.values(st.ents).filter(e => e.nid).map(e => ({ n: e.nid, s: e.__rmShape, c: e.__rmCol, l: e.name, g: e.__rmGlow ? 1 : 0 })) };
  },
  mirror: {
    start(m, st) {
      rmNetInit(); st.ps = {}; st.php = null; st.cin = 0; st.crc = false; st.fx = rmMarksFx(m, st);
    },
    update(m, st, p, dt) {
      const P = game.player; if (!P) return;
      for (const id of RAID_MECH.stTick(st.ps, dt)) rmStatusOff(st, id);
      // 上报给主机：蹲下（变化或蹲着时每 0.2 秒一次）、连打、被打中
      const crouch = rmCrouch(P), mash = RAID_MECH.stHas(st.ps, 'buried') && typeof input !== 'undefined' && input.hit('attack') ? 1 : 0, hurt = st.php != null && P.hp < st.php - 0.5 ? 1 : 0; st.php = P.hp;
      st.cin = (st.cin || 0) - dt; st.mi = (st.mi || 0) + mash; st.hi = (st.hi || 0) + hurt;
      if (typeof coop !== 'undefined' && (crouch !== st.crc || st.mi || st.hi || (crouch && st.cin <= 0))) { coop.send({ k: 'rmin', c: crouch ? 1 : 0, m: st.mi, h: st.hi }); st.crc = crouch; st.cin = 0.2; st.mi = st.hi = 0; }
      // 物件外观（颜色 / 标签 / 发光）以主机为准
      for (const o of st.O || []) { const e = typeof coop !== 'undefined' && coop.puppets.get(o.n); if (!e || e.dead) continue; if (o.l) e.name = o.l; e.__rmGlow = !!o.g; if (o.s && (e.__rmCol !== o.c || e.__rmShape !== o.s) && typeof MsObjModel !== 'undefined') { e.__rmCol = o.c; e.__rmShape = o.s; e.model = new MsObjModel(o.s, o.c, (MON['rmObj_' + o.s] || {}).h || 80); e.model.ent = e; } }
    },
    ev(m, st, p, e, d) {
      const P = game.player, mine = typeof coop !== 'undefined' && d.w === String(coop.me());
      switch (e) {
        case 'stOn': if (mine) rmStatusOn(st, d.id, d); break;
        case 'stOff': if (mine) { RAID_MECH.stDel(st.ps, d.id); rmStatusOff(st, d.id); } break;
        case 'tp': if (mine && P) { if (P.act) P.endAct(); P.x = clamp(d.x, 30, msRoomW() - 30); P.y = clamp(d.y, 0, DEPTH); P.vx = P.vy = 0; fxBurst(P.x, P.y, 30, 120, '#7affd0'); } break;
        case 'say': if (P) fxText(d.t, P.x, P.y, P.z + P.h + 30, { col: d.c || '#ffe070', size: 14, dur: 1.4 }); break;
        case 'cast': if (m) msSay(m, d.n, '#ff9a7a', 16); toastMsg(`${d.p}：${d.h}`, '#ffb08a'); sfx.boom(0.6); break;
        case 'cue': rmCue(m); break;
        case 'line': if (m) msSay(m, `「${d.t}」`, '#ffe8c0', 15); if (typeof chatSys === 'function') chatSys(`【${m ? m.name : '领主'}】${d.t}`); break;
        case 'wipe': cam.flash = 0.35; cam.flashCol = '#ff4a4a'; cam.shake = Math.max(cam.shake, 14); sfx.boom(1.4); toastMsg('没能解开——灭团攻击！', '#ff6a6a'); break;
      }
    },
    end(m, st) { if (st.fx) st.fx.dur = 0; if (st.ps) for (const id of Object.keys(st.ps)) rmStatusOff(st, id); },
  },
  test: { solve: null } });

// 输出事件 → 世界
function rmApply(m, st, out) {
  const P = msSelf();
  for (const o of out) {
    st.log.push({ k: o.k, id: o.id, t: +(game.t || 0).toFixed(2) }); if (st.log.length > 200) st.log.splice(0, 100);
    switch (o.k) {
      case 'invul': st.intro = o.on; if (o.on) { m.invul = Math.max(m.invul, 0.5); msSay(m, '出场 · 无敌', '#d8c0ff', 14); } else m.invul = 0; break;
      case 'cast': m.msQueue = []; msSay(m, o.name, '#ff9a7a', 16); toastMsg(`${o.puzzle}：${o.hint}`, '#ffb08a'); sfx.boom(0.6); msLog('mech', m, { id: 'raid:' + o.id }); msNetEv(m, st, 'cast', { n: o.name, p: o.puzzle, h: o.hint }); break;
      case 'atk': msSay(m, o.name, '#ffb0a0', 14); toastMsg(`${o.name}：${o.hint}`, '#ffb0a0'); break;
      case 'break': st.brk = o.dur; m.msMul.raidBreak = o.mul; if (m.act) m.endAct(); m.superArmor = 0; m.setState('hit'); msGroggyFx(m); break;
      case 'unbreak': st.brk = 0; delete m.msMul.raidBreak; msSay(m, '虚弱结束', '#ffd8a0', 12); break;
      case 'wipe': cam.flash = 0.35; cam.flashCol = '#ff4a4a'; cam.shake = Math.max(cam.shake, 14); sfx.boom(1.4); rmWipeAll(m, o.frac, o.down); toastMsg('没能解开——灭团攻击！', '#ff6a6a'); msNetEv(m, st, 'wipe', {}); break;
      case 'hurt': rmHurtWho(m, o.who, o.frac * msPunishK(), o.down); break;
      case 'status': if (o.who === 'me') rmStatusOn(st, o.id, o); else if (rmEnt(o.who)) msNetEv(m, st, 'stOn', { w: o.who, id: o.id, n: o.n, dur: o.dur }); break;
      case 'unstatus': if (o.who === 'me') { RAID_MECH.stDel(st.ps, o.id); rmStatusOff(st, o.id); } else if (rmEnt(o.who)) msNetEv(m, st, 'stOff', { w: o.who, id: o.id }); break;
      case 'tp': if (o.who !== 'me') { if (rmEnt(o.who)) msNetEv(m, st, 'tp', { w: o.who, x: Math.round(o.x), y: Math.round(o.y) }); } else if (P) { if (P.act) P.endAct(); P.x = clamp(o.x, 30, msRoomW() - 30); P.y = clamp(o.y, 0, DEPTH); P.vx = P.vy = 0; fxBurst(P.x, P.y, 30, 120, '#7affd0'); } break;
      case 'say': if (P) fxText(o.text, P.x, P.y, P.z + P.h + 30, { col: o.col || '#ffe070', size: 14, dur: 1.4 }); msNetEv(m, st, 'say', { t: o.text, c: o.col }); break;
      case 'line': msSay(m, `「${o.text}」`, '#ffe8c0', 15); if (typeof chatSys === 'function') chatSys(`【${m.name}】${o.text}`); msNetEv(m, st, 'line', { t: o.text }); break;
      case 'cue': rmCue(m); msNetEv(m, st, 'cue', {}); break;
      case 'skill': if (!m.act && !m.dead && monForceSkill(m, o.id) && st.p.rest) { st.restWait = game.t || 0; } break;
      case 'solve': case 'fail': msLog(o.k, m, { id: 'raid:' + o.id }); MS_STATS.mech['raid:' + o.id + (o.k === 'solve' ? 'Solve' : 'Fail')] = (MS_STATS.mech['raid:' + o.id + (o.k === 'solve' ? 'Solve' : 'Fail')] || 0) + 1; break;
    }
  }
  // 反射罩亮着：领主只受 30% 伤害
  const R = st.S.cast && st.S.cast.id === 'reflect' ? st.S.cast : st.S.side.find(s => s.id === 'reflect');
  if (R && R.up) m.msMul.raidReflect = 0.3; else delete m.msMul.raidReflect;
}
// 状态：记在 st.ps（RAID_MECH 的状态表），效果翻译成游戏异常
function rmStatusOn(st, id, o = {}) {
  const P = msSelf(), hit = RAID_MECH.stAdd(st.ps, id, o), ids = hit ? [hit] : [id];
  for (const k of ids) { const D = RAID_MECH.STATUS[k] || {}; if (P && D.eff && D.eff !== 'none') addStatus(P, D.eff, D.dur || RM_EFF_DUR, { force: true }); if (P) fxText(D.name || k, P.x, P.y, P.z + P.h + 14, { col: D.col || '#fff', size: 12, dur: 1.2 }); }
}
function rmStatusOff(st, id) { const P = msSelf(), D = RAID_MECH.STATUS[id] || {}; if (P && P.status && D.eff && D.eff !== 'none' && !Object.keys(st.ps).some(k => (RAID_MECH.STATUS[k] || {}).eff === D.eff)) delete P.status[D.eff]; }
// 谜题物件：objs 里 alive 的生成、不 alive 的收走（at: 'me' = 生成在本机玩家脚下）
function rmSyncObjs(m, st) {
  const L = []; if (st.S.cast && st.S.cast.objs) L.push(...st.S.cast.objs); for (const s of st.S.side) if (s.objs) L.push(...s.objs);
  const want = new Set();
  for (const o of L) {
    const key = o.tag + ':' + o.i; if (!o.alive) continue; want.add(key);
    let e = st.ents[key];
    if (!e) {
      const P = o.at && o.at !== true ? (rmEnt(o.at) || msSelf()) : msSelf(), x = o.at ? (P ? P.x : m.x) : o.x, y = o.at ? (P ? P.y + 2 : m.y) : o.y;
      e = spawnMonster('rmObj_' + o.shape, clamp(x, 40, msRoomW() - 40), clamp(y, 4, DEPTH - 4), { lvl: m.lvl });
      e.model = new MsObjModel(o.shape, o.col, (MON['rmObj_' + o.shape] || {}).h || 80); e.model.ent = e;
      e.hp = e.hpMax = o.hits || 3; msMulSet(e, 'hitHp', 1e-9); e.__rmHp = e.hp; e.__rmKeep = !!o.keep; e.invul = 0; e.aiCd = 1e9;
      if (o.label) e.name = o.label;
      e.__rmShape = o.shape; e.__rmCol = o.col; e.lastHitBy = null;
      st.ents[key] = e;
    }
    e.__rmGlow = !!o.glow;
    if (o.glow && Math.random() < 0.3) fxCharge(e, o.col);
    if (o.label && e.name !== o.label) e.name = o.label;
  }
  for (const key of Object.keys(st.ents)) if (!want.has(key)) { const e = st.ents[key]; e.__rmGone = true; e.remove = true; delete st.ents[key]; }
}
// 灵魂球从场边飞进领主身体（守门人进场）
function rmSoulFx(m, i) { const sx0 = i % 2 ? msRoomW() * 0.9 : msRoomW() * 0.1; addFx({ x: sx0, y: 30 + i * 40, z: 80, dur: 1.2 + i * 0.25, x0: sx0, y0: 30 + i * 40, draw(c) { const k = easeOut(Math.min(1, this.t / this.dur)); this.x = this.x0 + (m.x - this.x0) * k; this.y = this.y0 + (m.y - this.y0) * k; c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = 'rgba(200,160,255,.85)'; c.beginPath(); c.arc(sx(this.x), sy(this.y, 80 + 30 * Math.sin(k * 3.1)), 9, 0, TAU); c.fill(); c.restore(); } }); }
// 守门人：进场吸入的灵魂数 = 这扇门的击杀顺序（raid_core 的 order），约 36 秒后 BGM 换乐器提示顺序：咏叹调 = 1、钢琴 = 2、吉他 = 3、合成器 = 4 [NAMU-LAW]
const RM_ORDER_INST = ['咏叹调', '钢琴', '吉他', '合成器'];
function rmRaidOrder() { const C = typeof raidNet !== 'undefined' && raidNet.ctx, N = C && raidNet.S && raidNet.S.nodes[C.node]; return N && N.order || 0; }
function rmOrderCue(m, o) {
  const k = rmRaidOrder(); rmCue(m);
  if (!k) { toastMsg('BGM 换了乐器……', '#e0c0ff'); return; }
  const inst = RM_ORDER_INST[k - 1] || RM_ORDER_INST[3];
  toastMsg(`BGM：${inst} —— 这扇破坏之门要第 ${k} 个打倒`, '#e0c0ff'); if (typeof chatSys === 'function') chatSys(`【团本】BGM 换成了${inst}：这扇门是第 ${k} 个`);
  try { if (sfx.ctx && !sfx.muted && typeof MI !== 'undefined') { const t = sfx.ctx.currentTime + 0.05, ins = [MI.flute, MI.piano, MI.pluck, MI.synlead][k - 1] || MI.synlead; [72, 76, 79, 84].forEach((n, i) => ins(t + i * 0.18, n, 0.12, 0.3)); } } catch (e) { /* 没有音频 */ }
}
// ===================== 子弹时间「无之轨迹」（P4，docs/RAID_SIROCO.md §12）=====================
// 官方：小队队长按 Tab，能量在领主房积累，开启后除本队以外的一切都变慢 [QQ][233-黎]。两人版每个人都是自己小队的队长：
// 有团本脚本的领主房里能量自动充（RAID_BT.fill 秒充满），按 7（可改键）→ RAID_BT.dur 秒内怪物 / 领主 / 机制计时 × RAID_BT.mon（引擎 game.monSlow）。
// 组队同房（raid 一起进 / coop）不能用（要主机同步，以后做）。已经飞出来的怪物弹道和地面预警不变慢。
const RAID_BT = { fill: 60, dur: 5, mon: 0.35, key: 'Digit7' };
const rmBt = { e: 0, t: 0, dg: null, owner: null };
(function rmBtKey() {   // 按键设置“其他”组里加一项（和 social 的 sxAddKey 同一套写法）
  const a = 'raidBt', code = RAID_BT.key; KEYMAP_DEFAULT[a] = [code];
  if (!KEYMAP[a]) {
    KEYMAP[a] = [code];
    try { const k = (JSON.parse(localStorage.getItem(UI_PREF_KEY) || '{}').keys || {})[a]; if (Array.isArray(k)) KEYMAP[a] = k.filter(c => typeof c === 'string').slice(0, 2); } catch (e) { /* 用默认键 */ }
    for (const b in KEYMAP) if (b !== a && KEYMAP[a].some(c => KEYMAP[b].includes(c))) KEYMAP[a] = KEYMAP[a].filter(c => !KEYMAP[b].includes(c));
  }
  ACTION_NAME[a] = '团本：无之轨迹（子弹时间）';
  const g = KEY_GROUPS.find(x => x[0] === '其他'); if (g && !g[1].includes(a)) g[1].push(a);
})();
function rmBtOK() {
  if (typeof coop !== 'undefined' && coop.state === 'play') return false;
  if (typeof raidNet !== 'undefined' && raidNet.ctx && raidNet.ctx.together) return false;
  return true;
}
const rmBtOn = () => game.monSlowT > 0 && rmBt.t > 0;
function rmBtRealDt(m, dt) { return rmBtOn() && m.team === 'e' ? dt / clamp(game.monSlow || 1, 0.05, 1) : dt; }
// 每帧只由一个有脚本的领主推进（同房多个领主时不重复充能）
function rmBtTick(m, st, rdt) {
  if (rmBt.dg !== game.dungeon) { rmBt.dg = game.dungeon; rmBt.e = 0; rmBt.t = 0; rmBt.owner = null; }
  const O = rmBt.owner; if (O && O !== m && !O.dead && !O.remove && ents.includes(O) && rmScriptOf(O)) return;
  rmBt.owner = m;
  if (!rmBtOK()) return;
  if (rmBt.t > 0) { rmBt.t -= rdt; if (rmBt.t <= 0) { rmBt.t = 0; game.monSlowT = 0; toastMsg('无之轨迹结束', '#c8b0ff'); } return; }
  if (st.S.ph !== 'intro') rmBt.e = Math.min(1, rmBt.e + rdt / RAID_BT.fill);
  const P = msSelf();
  if (rmBt.e >= 1 && P && !P.dead && typeof input !== 'undefined' && input.hit('raidBt')) rmBtUse();
}
function rmBtUse() {
  if (rmBt.e < 1 || rmBt.t > 0 || !rmBtOK()) return false;
  rmBt.e = 0; rmBt.t = RAID_BT.dur; game.monSlow = RAID_BT.mon; game.monSlowT = RAID_BT.dur;
  toastMsg('无之轨迹：除了你以外的一切都慢下来了', '#e0d0ff'); cam.flash = Math.max(cam.flash || 0, 0.2); cam.flashCol = '#b8a0ff';
  try { if (sfx.ctx && !sfx.muted && typeof MI !== 'undefined') { const t = sfx.ctx.currentTime + 0.02; MI.bell(t, 60, 0.14, 2); MI.bell(t + 0.15, 55, 0.1, 2); } } catch (e) { /* 没有音频 */ }
  addFx({ x: 0, y: 1e5, z: 0, dur: RAID_BT.dur, draw(c) {   // 全屏偏紫的冷色 + 四角暗角
    if (!rmBtOn()) { this.dur = 0; return; }
    const k = Math.min(1, this.t / 0.3, (this.dur - this.t) / 0.4); c.save(); c.globalAlpha = 0.3 * k; c.fillStyle = '#40287a'; c.fillRect(0, 0, WW, WH);
    const g = c.createRadialGradient(WW / 2, WH / 2, WH * 0.35, WW / 2, WH / 2, WW * 0.62); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(10,0,30,0.9)'); c.globalAlpha = 0.65 * k; c.fillStyle = g; c.fillRect(0, 0, WW, WH); c.restore(); } });
  return true;
}
function rmBtHud(c, x, y, w) {
  if (!rmBtOK() || game.dungeon !== rmBt.dg) return 0;
  const on = rmBt.t > 0, k = on ? rmBt.t / RAID_BT.dur : rmBt.e;
  msBar(c, x, y, w, k, on ? '#d0b0ff' : rmBt.e >= 1 ? '#ffe070' : '#8a7ab0', on ? `无之轨迹 ${rmBt.t.toFixed(1)} 秒` : rmBt.e >= 1 ? `无之轨迹 就绪：按 ${keyName('raidBt')}` : `无之轨迹 ${Math.floor(rmBt.e * 100)}%`);
  return 16;
}
// 共享血量按队伍颜色（P4，[QQ]“领主血条按小队颜色显示各队输出”）：你 = 金色、队友 = 蓝色，剩下的血是暗红；数据是服务端的 pools[k].by（队伍 = 挑战的主机）
const RM_TEAM_COL = ['#ffd040', '#5ac8ff', '#ff8ad8', '#8aff9a'];
function rmPoolHud(c, x, y, w) {
  const C = typeof raidNet !== 'undefined' && raidNet.ctx, Q = C && C.pool; if (!Q || C.done) return 0;
  const by = Q.by || {}, me = String(raidNet.me()), S = raidNet.S, ids = ((S && S.members) || []).map(m => String(m.uid));
  for (const k of Object.keys(by)) if (!ids.includes(k)) ids.push(k);
  ids.sort((a, b) => (a === me ? -1 : b === me ? 1 : 0));
  const h = 12, tot = Object.values(by).reduce((a, b) => a + b, 0) + Math.max(0, Q.hp ?? 1), sc = tot > 0 ? w / Math.max(1, tot) : 0;
  c.fillStyle = 'rgba(0,0,0,.6)'; c.fillRect(x - 1, y - 1, w + 2, h + 2);
  let xx = x; const parts = [];
  ids.forEach((u, i) => { const v = by[u] || 0; if (v <= 0) return; const col = RM_TEAM_COL[Math.min(i, RM_TEAM_COL.length - 1)]; c.fillStyle = col; c.fillRect(xx, y, v * sc, h); xx += v * sc; const M = S && S.members.find(m => String(m.uid) === u); parts.push([`${u === me ? '你' : (M && M.name) || '队友'} ${Math.round(v * 100)}%`, col]); });
  c.fillStyle = '#7a1a3a'; c.fillRect(xx, y, Math.max(0, (Q.hp ?? 1) * sc), h);
  let tx = x + 4; uiText('共享血量', tx, y + h - 1, { size: 12, color: '#fff', sw: 3 }); tx += 64;
  for (const [t, col] of parts) { uiText(t, tx, y + h - 1, { size: 12, color: col, sw: 3 }); tx += uctx.measureText(t).width + 14; }
  uiText(`剩 ${Math.round((Q.hp ?? 1) * 100)}%`, x + w - 4, y + h - 1, { size: 12, align: 'right', color: '#ffb0c0', sw: 3 });
  return h + 4;
}
// 测试 / 调试：现在跑着的团本脚本状态
function rmScriptOf(m) { const st = m && m.msMechs && m.msMechs.find(s => s.id === 'raidScript' && !s.done); return st || null; }
