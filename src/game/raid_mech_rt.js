/* =====================================================================
   团本领主机制运行时（docs/RAID_SIROCO.md §10）：把 RAID_MECH（game/raid_mech.js，纯逻辑）的领主脚本挂到领主身上。
   领主 spec 里写 mechs: [{ use: 'raidScript', intro, loop, weak: { at, pool }, onSolve, onFail, atk, lines }]（字段见 raid_mech.js 头部）。
   这里只做“世界 ↔ 事件”的翻译，所有谜题都走同一套：
     输入：本机玩家位置 / 朝向 / 是否蹲下（按住 ↓）/ 连打攻击、领主位置、打到物件 / 物件被打碎、被领主打中
     输出：谜题物件（msObjDef 程序画的水晶 / 心脏 / 图腾 / 墓碑）按 objs 生成和回收，地面标记（板 / 地砖 / 气泡 / 祭坛 / 光球 / 护罩圈）按 marks 画，
          挨打按最大 HP 结算（普通难度 ×0.6），状态翻译成异常（定身 / 减速 / 眩晕 / 失明），读条 / 虚弱 / 灭团 / 台词 / BGM 节拍
   只在主机（单人实例就是自己）跑；组队时队员那边看不到谜题（docs/RAID_SIROCO.md §10 “还没做”）。
   ===================================================================== */
Object.assign(MON, {
  rmObj_crystal: msObjDef('水晶', { shape: 'crystal', col: '#b890ff', h: 84 }),
  rmObj_heart: msObjDef('心脏', { shape: 'heart', col: '#ff6a8a', h: 76, botSkip: true }),
  rmObj_totem: msObjDef('分身', { shape: 'totem', col: '#a070ff', h: 116, botSkip: true }),
  rmObj_pillar: msObjDef('墓碑', { shape: 'pillar', col: '#b08a5a', h: 100, botSkip: true }),
});
const RM_EFF_DUR = 99;
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
    update() { if (!st.ended && (m.dead || (m.remove && !m.msHidden) || !ents.includes(m) && !m.msHidden)) { st.done = st.ended = true; BOSS_MECHS.raidScript.end(m, st); this.dur = 0; } },
    draw(c) {
    const S = this.st.S, L = []; if (S.cast && S.cast.marks) L.push(...S.cast.marks); for (const s of S.side) if (s.marks) L.push(...s.marks);
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
    for (const s of S.side.concat(S.cast ? [S.cast] : [])) if (s.id === 'tether' && P && s.anchor) { const near = gdistXY(P, s.anchor) < s.p.min; c.save(); c.strokeStyle = near ? '#ff4a4a' : '#7affd0'; c.lineWidth = 3; c.globalAlpha = 0.8; c.setLineDash([6, 6]); c.lineDashOffset = -now * 40; c.beginPath(); c.moveTo(sx(s.anchor.x), sy(s.anchor.y, 70)); c.lineTo(sx(P.x), sy(P.y, 50)); c.stroke(); c.restore(); }
  } });
}
const gdistXY = (a, b) => Math.hypot(a.x - b.x, (a.y - b.y) / GR);
function rmRaidMode() { return typeof raidNet !== 'undefined' && raidNet.S && raidNet.S.graph === 'guide' ? 'guide' : 'normal'; }

defineBossMech('raidScript', { defaults: {},
  start(m, st, p) {
    st.S = RAID_MECH.scriptNew(p, Math.floor(Math.random() * 1e9), { W: msRoomW(), D: DEPTH, mode: p.mode || rmRaidMode(), players: ['me'] });
    st.ents = {}; st.q = []; st.ps = {}; st.php = null; st.intro = false; st.brk = 0; st.log = [];
    st.fx = rmMarksFx(m, st);
    rmApply(m, st, RAID_MECH.scriptTick(st.S, 0, { hp: m.hp / m.hpMax }));
  },
  update(m, st, p, dt) {
    const P = msSelf(), ev = st.q.splice(0);
    if (P && !P.dead) {
      ev.push({ k: 'pos', who: 'me', x: P.x, y: P.y, face: P.face, z: P.z || 0, crouch: rmCrouch(P) });
      if (RAID_MECH.stHas(st.ps, 'buried') && (P.raidMash || (typeof input !== 'undefined' && input.hit('attack')))) { P.raidMash = false; ev.push({ k: 'mash', who: 'me' }); }
      if (st.php != null && P.hp < st.php - 0.5) ev.push({ k: 'hurt', who: 'me' });
      st.php = P.hp;
    }
    ev.push({ k: 'anchor', x: m.x, y: m.y, face: m.face });
    for (const key of Object.keys(st.ents)) {
      const e = st.ents[key], [tag, i] = key.split(':');
      if (e.dead || e.remove || e.hp <= 0) { if (!e.__rmGone) ev.push({ k: 'kill', tag, i: +i, who: 'me' }); delete st.ents[key]; continue; }
      if (e.hp < e.__rmHp) { ev.push({ k: 'hit', tag, i: +i, who: 'me' }); if (e.__rmKeep) e.hp = e.hpMax; }
      e.__rmHp = e.hp;
    }
    rmApply(m, st, RAID_MECH.scriptTick(st.S, dt, { hp: m.hp / m.hpMax, ev }));
    rmSyncObjs(m, st);
    for (const id of RAID_MECH.stTick(st.ps, dt)) rmStatusOff(st, id);
    // 出场 / 读条 / 虚弱时领主站着不动（读条是引导，不追人）
    const hold = st.intro || st.S.ph === 'cast' || st.brk > 0;
    if (hold && m.__rmSpd == null) { m.__rmSpd = m.speed; m.speed = 0; } else if (!hold && m.__rmSpd != null) { m.speed = m.__rmSpd; m.__rmSpd = null; }
    if (st.intro) { m.invul = Math.max(m.invul, 0.2); m.aiCd = Math.max(m.aiCd || 0, 0.2); }
    if (st.S.ph === 'cast') { m.aiCd = Math.max(m.aiCd || 0, 0.3); if (Math.random() < 0.25) fxCharge(m, '#c080ff'); }
    if (st.brk > 0) { st.brk -= dt; m.stun = Math.max(m.stun || 0, Math.min(0.3, st.brk)); m.aiCd = Math.max(m.aiCd || 0, 0.3); if (m.st !== 'hit' && m.st !== 'air' && m.st !== 'down') m.setState('hit'); }
  },
  onHit(m, st, dmg, a) { if (a && (a.team === 'p' || (a.owner && a.owner.team === 'p'))) st.q.push({ k: 'hit', tag: 'boss', who: 'me' }); },
  end(m, st) {
    for (const e of Object.values(st.ents)) { e.__rmGone = true; e.remove = true; }
    st.ents = {}; if (st.fx) st.fx.dur = 0;
    for (const id of Object.keys(st.ps)) rmStatusOff(st, id);
    if (m.msMul) { delete m.msMul.raidBreak; delete m.msMul.raidReflect; }
    if (m.__rmSpd != null) { m.speed = m.__rmSpd; m.__rmSpd = null; }
  },
  hud(c, m, st, x, y, w) {
    const V = RAID_MECH.view(st.S); let h = 0;
    if (V.ph === 'intro') { msBar(c, x, y, w, 1 - V.phT / (st.S.spec.intro.dur || 1), '#b890ff', '出场 · 无敌'); h += 16; }
    if (V.cast) { const k = V.cast.dur ? 1 - V.cast.t / V.cast.dur : 1; msBar(c, x, y + h, w, k, '#ff7a5a', `${(st.S.spec.cast && st.S.spec.cast.name) || '读条'} · ${V.cast.name}`); uiText(`${V.cast.hint}${V.cast.text ? '　' + V.cast.text : ''}`, x + w / 2, y + h + 32, { size: 14, align: 'center', color: '#ffe0c0', sw: 3 }); h += 36; }
    if (V.ph === 'break') { msBar(c, x, y + h, w, 1 - V.phT / st.S.spec.onSolve.dur, '#7aff9a', `虚弱！受到伤害 ×${st.S.spec.onSolve.mul}`); h += 16; }
    for (const s of V.side) { uiText(`${s.name}：${s.hint}${s.text ? '　' + s.text : ''}`, x + w / 2, y + h + 14, { size: 14, align: 'center', color: '#ffb0a0', sw: 3 }); h += 18; }
    const B = st.S.cast && st.S.cast.id === 'breath' ? st.S.cast : st.S.side.find(s => s.id === 'breath');
    if (B && B.g.me != null) { msBar(c, x, y + h, w, B.g.me / B.p.max, '#6ab0ff', '呼吸'); h += 16; }
    return h;
  },
  test: { solve: null } });

// 输出事件 → 世界
function rmApply(m, st, out) {
  const P = msSelf();
  for (const o of out) {
    st.log.push({ k: o.k, id: o.id, t: +(game.t || 0).toFixed(2) }); if (st.log.length > 200) st.log.splice(0, 100);
    switch (o.k) {
      case 'invul': st.intro = o.on; if (o.on) { m.invul = Math.max(m.invul, 0.5); msSay(m, '出场 · 无敌', '#d8c0ff', 14); } else m.invul = 0; break;
      case 'cast': m.msQueue = []; msSay(m, o.name, '#ff9a7a', 16); toastMsg(`${o.puzzle}：${o.hint}`, '#ffb08a'); sfx.boom(0.6); msLog('mech', m, { id: 'raid:' + o.id }); break;
      case 'atk': msSay(m, o.name, '#ffb0a0', 14); toastMsg(`${o.name}：${o.hint}`, '#ffb0a0'); break;
      case 'break': st.brk = o.dur; m.msMul.raidBreak = o.mul; if (m.act) m.endAct(); m.superArmor = 0; m.setState('hit'); msGroggyFx(m); break;
      case 'unbreak': st.brk = 0; delete m.msMul.raidBreak; msSay(m, '虚弱结束', '#ffd8a0', 12); break;
      case 'wipe': cam.flash = 0.35; cam.flashCol = '#ff4a4a'; cam.shake = Math.max(cam.shake, 14); sfx.boom(1.4); if (P) rmHurt(m, P, o.frac, o.down); toastMsg('没能解开——灭团攻击！', '#ff6a6a'); break;
      case 'hurt': if (o.who === 'me' && P) rmHurt(m, P, o.frac * msPunishK(), o.down); break;
      case 'status': if (o.who === 'me') rmStatusOn(st, o.id, o); break;
      case 'unstatus': if (o.who === 'me') { RAID_MECH.stDel(st.ps, o.id); rmStatusOff(st, o.id); } break;
      case 'tp': if (o.who === 'me' && P) { if (P.act) P.endAct(); P.x = clamp(o.x, 30, msRoomW() - 30); P.y = clamp(o.y, 0, DEPTH); P.vx = P.vy = 0; fxBurst(P.x, P.y, 30, 120, '#7affd0'); } break;
      case 'say': if (P) fxText(o.text, P.x, P.y, P.z + P.h + 30, { col: o.col || '#ffe070', size: 14, dur: 1.4 }); break;
      case 'line': msSay(m, `「${o.text}」`, '#ffe8c0', 15); if (typeof chatSys === 'function') chatSys(`【${m.name}】${o.text}`); break;
      case 'cue': rmCue(m); break;
      case 'skill': if (!m.act && !m.dead) monForceSkill(m, o.id); break;
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
      const P = msSelf(), x = o.at ? (P ? P.x : m.x) : o.x, y = o.at ? (P ? P.y + 2 : m.y) : o.y;
      e = spawnMonster('rmObj_' + o.shape, clamp(x, 40, msRoomW() - 40), clamp(y, 4, DEPTH - 4), { lvl: m.lvl });
      e.model = new MsObjModel(o.shape, o.col, (MON['rmObj_' + o.shape] || {}).h || 80); e.model.ent = e;
      e.hp = e.hpMax = o.hits || 3; msMulSet(e, 'hitHp', 1e-9); e.__rmHp = e.hp; e.__rmKeep = !!o.keep; e.invul = 0; e.aiCd = 1e9;
      if (o.label) e.name = o.label;
      st.ents[key] = e;
    }
    e.__rmGlow = !!o.glow;
    if (o.glow && Math.random() < 0.3) fxCharge(e, o.col);
    if (o.label && e.name !== o.label) e.name = o.label;
  }
  for (const key of Object.keys(st.ents)) if (!want.has(key)) { const e = st.ents[key]; e.__rmGone = true; e.remove = true; delete st.ents[key]; }
}
// 测试 / 调试：现在跑着的团本脚本状态
function rmScriptOf(m) { const st = m && m.msMechs && m.msMechs.find(s => s.id === 'raidScript' && !s.done); return st || null; }
