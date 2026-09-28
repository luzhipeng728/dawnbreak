/* =====================================================================
   召唤物框架 v1.1（魔法师对齐组维护；设计见 docs/SKILLS_OFFICIAL_mage.md 第 6 节）
   三种形态：
     follower  有身体、有动作、有 AI 的伙伴实体（Ent，放进 ents，和别的实体一起按 y 排序绘制）
     field     地面上的定点区域，按间隔结算（地面层绘制；drawUpright 的站立形象按 y 排序）
     attach    挂在某个实体（敌人或自己）身上的持续效果，宿主死亡 / 离场自动结束
   伤害一律按 owner 的面板实时结算：follower 的攻击属性是读 owner 的 getter；
   field / attach 走 applyHit(owner, t, h, { proj: true, src: s })。
   每帧更新 / 绘制不改 game.js：包一层 updateGroundFx（只在地下城 / 测试场景调用）和 drawGroundFx（地面层）。
   ===================================================================== */
const SUMMON_DEFS = {};
const SUMMONS = [];   // 活着的召唤物句柄（follower 同时在 ents 里）
let summonSeq = 1;
const NO_MODE = {};
function defSummon(key, def) {
  const D = SUMMON_DEFS[key] = { key, kind: 'follower', max: 1, over: 'oldest', life: 20, tags: [], ...def };
  if (D.keepRoom === undefined) D.keepRoom = D.kind === 'follower';
  return D;
}
const summonDef = key => SUMMON_DEFS[key] || null;   // 决斗场 AI（fighter_ai.js）读上限用
// ---- 查询 ----
const summonMatch = (s, q) => q === undefined || q === null ? true : typeof q === 'string' ? s.skey === q : q.tag ? (q.tag === '*' || s.sdef.tags.includes(q.tag)) : false;
function summonsOf(owner, q) { return SUMMONS.filter(s => s.owner === owner && !s.gone && summonMatch(s, q)); }
function summonsIn(owner, x, y, r, q) { return summonsOf(owner, q).filter(s => Math.hypot(s.x - x, (s.y - y) * 2.2) < r); }
// ---- 生成 ----
// o: { x, y, at: 'front' | 'feet', target, lv, life, mul }
function summon(owner, key, o = {}) {
  const D = SUMMON_DEFS[key]; if (!D || !owner || owner.dead) return null;
  // 上限：同 key 的 max、同 tag 的 tagMax；到上限时 over 决定挤掉谁
  const limits = [[summonsOf(owner, key), D.max]];
  if (D.tagMax) for (const tg in D.tagMax) limits.push([summonsOf(owner, { tag: tg }), D.tagMax[tg]]);
  for (const [L, max] of limits) {
    if (max === undefined || L.length < max) continue;
    if (D.over === 'deny') return null;
    if (D.over === 'refresh') { const s = L[0]; s.lifeT = 0; s.life = o.life ?? D.life; if (o.lv) s.lv = o.lv; return s; }
    const old = L.slice().sort((a, b) => (a.life - a.lifeT) - (b.life - b.lifeT)); for (let i = 0; i <= L.length - max; i++) dismissOne(old[i], 'replaced');
  }
  const at = o.at === 'feet' ? 0 : 50, x = o.x ?? owner.x + owner.face * at, y = clamp(o.y ?? owner.y, 4, DEPTH - 4);
  const base = { sid: summonSeq++, skey: key, sdef: D, owner, kind: D.kind, lv: o.lv || 1, mul: o.mul || 1, life: o.life ?? D.life, lifeT: 0, tickT: 0, hits: 0, gone: false, target: o.target || null };
  let s;
  if (D.kind === 'follower') {
    s = new Ent({ team: owner.team, name: D.name || key, model: D.model ? D.model(owner) : buildGoblin(), clips: (typeof D.clips === 'function' ? D.clips() : D.clips) || summonClips(),
      x, y, face: owner.face, w: D.w || 12, d: D.d || 11, h: D.h || 70, weight: D.weight || 1, speed: D.speed ?? 170, shadowR: D.shadowR || 14, scale: D.scale || 1 });
    Object.assign(s, base, { summon: true, control: summonControl, aiCd: rnd(0.2, 0.5), think: 0, acd: (D.attacks || []).map(() => 0), buffs: {}, slot: summonsOf(owner).length });
    summonStats(s);
    if (D.hp) { s.hp = s.hpMax = Math.max(1, Math.round(D.hp(owner))); s.def = owner.def; s.mdef = owner.mdef; }
    else s.invul = Infinity;
    if (D.bundle) summonLoadArt(s);
    s.hasRun = !!(typeof SPR_DATA !== 'undefined' && D.bundle && SPR_DATA[D.bundle] && SPR_DATA[D.bundle].frames.run1);
    ents.push(s);
  } else {
    s = { ...base, x, y, z: 0, face: owner.face, host: D.kind === 'attach' ? (D.host === 'owner' ? owner : o.target) : null };
    if (D.kind === 'attach' && !s.host) return null;
    if (s.host) { s.x = s.host.x; s.y = s.host.y; }
  }
  SUMMONS.push(s);
  if (D.onSpawn) D.onSpawn(s);
  return s;
}
// follower 的攻击属性：实时读 owner（已折进 owner 的 BUFF）；召唤物自己的 buffs 只放作用在召唤物身上的增益
function summonStats(s) {
  const o = s.owner, def = (k, get) => Object.defineProperty(s, k, { get, set() { }, configurable: true });
  def('atk', () => o.atk);
  def('matk', () => o.matk !== undefined ? o.matk * (1 + buffVal(o, 'atk')) : undefined);
  def('indep', () => o.indep !== undefined ? o.indep * (1 + buffVal(o, 'atk')) : undefined);
  def('crit', () => o.crit || 0);
  def('mcrit', () => o.mcrit !== undefined ? o.mcrit + buffVal(o, 'crit') : undefined);
  def('critDmg', () => (o.critDmg || 1.5) + buffVal(o, 'critDmg'));
  def('hitRate', () => o.hitRate || 0);
  def('stagger', () => o.stagger || 0);
  def('dmgUp', () => (1 + (o.dmgUp || 0)) * (1 + buffVal(o, 'dmg')) - 1);
  def('elem', () => o.elem);
  def('atkElem', () => o.atkElem);
  def('lvl', () => o.lvl || game.lvl || 1);
  def('dmgType', () => s.sdef.type || o.dmgType || 'mag');
}
// 召唤兽的精灵模型：和怪物同一套 spr.json 帧（art/final/spr/<id>/）；素材还没加载好时先画一个发光的小光球
// anims：自定义帧名的召唤兽（卡西利亚斯等）传自己的动画表，片段用 summonClipsFor(同一张表)
function summonSprite(id, o = {}, col, anims) {
  if (typeof SPR_DATA !== 'undefined' && SPR_DATA[id] && IMG[`spr/${id}/idle`]) return new SpriteModel(id, { ...SPR_FALLBACK, cast: 'cast1', roar: 'cast2', crouch: 'low1' }, anims || SPR_ANIMS.monster, o);
  return orbModel(col || '#d8c0ff');
}
function orbModel(col) { const img = fxTint('orb', col); return { draw(c, pose, t) { drawSpr(c, img, 0, -40 + Math.sin(t * 4) * 3, 30, 30, {}); } }; }
// 召唤兽的动作片段：怪物片段（BEAST_CLIPS）+ 逐帧动画表里有、骨骼片段里没有的（cast / slam / bite / atk1……）自动补一个
let SUMMON_CLIPS = null;
function summonClips() { return SUMMON_CLIPS || (SUMMON_CLIPS = summonClipsFor(typeof SPR_ANIMS !== 'undefined' ? SPR_ANIMS.monster : {})); }
function summonClipsFor(A) {
  const C = { ...BEAST_CLIPS };
  for (const n in A) if (!C[n]) { const a = A[n]; C[n] = a.frames ? { dur: a.frames.length / a.fps, loop: true, keys: [k(0, POSE.idle)] } : { dur: a[a.length - 1][1] + 0.5, keys: [k(0, POSE.idle)] }; Object.defineProperty(C[n], '__name', { value: n }); }
  return C;
}
// 召唤物用怪物素材（spr 分包）时按需加载，加载好之后换模型
function summonLoadArt(s) {
  const D = s.sdef, b = D.bundle; if (IMG[`spr/${b}/idle`] || typeof loadBundles !== 'function') return;
  loadBundles(['spr:' + b]).then(() => { if (!s.gone && D.model) s.model = D.model(s.owner); }).catch(() => { });
}
// ---- 结束 ----
function dismissOne(s, why) {
  if (!s || s.gone) return;
  s.gone = true; s.why = why;
  const D = s.sdef;
  if (D.onEnd) D.onEnd(s, why);
  if (s.kind === 'follower') {
    if (!s.dead) fxBurst(s.x, s.y, s.z + (s.h || 60) * 0.5, 70, D.col || '#d8c0ff');
    s.remove = true; if (s.grabbed) dropGrab(s);
  }
  if (s.px) s.px.t = s.px.dur;
}
function dismissSummons(owner, q, why = 'cmd') { for (const s of summonsOf(owner, q)) dismissOne(s, why); }
function clearAllSummons(why = 'round') { for (const s of SUMMONS.slice()) dismissOne(s, why); SUMMONS.length = 0; }
// ---- 命令 ----
function summonCmd(owner, q, cmd, arg) {
  let n = 0;
  for (const s of summonsOf(owner, q)) { const f = s.sdef.cmds && s.sdef.cmds[cmd]; if (f && !s.dead && s.st !== 'held') { f(s, arg); n++; } }
  return n;
}
// 打断当前动作再出招（命令用）
function summonAct(s, act) { if (s.act) { const a = s.act; s.act = null; if (a.onEnd) a.onEnd(s, true); } s.setState('idle'); s.doAct({ name: act.clip, ...act }); }
// 瞬移（清掉速度）
Ent.prototype.warp = function (x, y, z = 0) { const R = game.room; this.x = R ? clamp(x, R.x0 + this.w, R.x1 - this.w) : x; this.y = clamp(y, 4, DEPTH - 4); this.z = z; this.vx = this.vy = this.vz = 0; };
// ---- 伤害（field / attach 的入口；follower 自己的动作判定照常走 resolveHits） ----
function hitGroup(win = Infinity) { return { win, last: new Map() }; }
function summonHit(s, t, h, o = {}) {
  if (!t || t.dead || t.invul > 0 || t.remove || !foe(s.owner, t)) return false;
  const G = o.hitGroup; if (G) { const l = G.last.get(t.id); if (l !== undefined && game.t - l < G.win) return false; G.last.set(t.id, game.t); }
  const src = { x: s.x - (s.face || 1) * 10, y: s.y, z: s.z || 0, face: s.face || 1 };
  applyHit(s.owner, t, { ...h, box: null, dmg: (h.dmg ?? 1) * (s.mul || 1) }, { proj: true, src, type: h.type || s.sdef.type || s.owner.dmgType, elem: h.elem || s.sdef.elem });
  return true;
}
function summonArea(s, x, y, r, h, o = {}) {
  let n = 0;
  for (const t of ents) if (foe(s.owner, t) && t.invul <= 0 && inGround(t, x, y, r) && t.z < (o.zMax ?? 30) + (o.z || 0) && (t.st !== 'down' || h.downHit)) {
    if (summonHit(s, t, h, o)) { n++; if (o.status) addStatus(t, o.status, o.sdur || 2, { dps: o.dps ? atkOf(s.owner, s.sdef.type || s.owner.dmgType) * o.dps : 0, src: s.owner }); }
  }
  return n;
}
function strongestFoe(s, range = 800) {
  let best = null, bh = -1;
  for (const o of ents) if (foe(s, o) && Math.abs(o.x - s.x) < range && Math.abs(o.y - s.y) < range * 0.4) { const v = o.hp + (o.boss ? 1e9 : o.elite ? 1e8 : 0); if (v > bh) { bh = v; best = o; } }
  return best;
}
// ---- follower 的默认 AI ----
function summonControl(s, dt) {
  if (s.gone || s.dead) return;
  const D = s.sdef;
  s.aiCd -= dt; s.think -= dt; for (let i = 0; i < s.acd.length; i++) s.acd[i] -= dt;
  if (s.busy) return;
  if (D.ai) { D.ai(s, dt); return; }
  summonAI(s, dt);
}
function summonTarget(s) {
  const o = s.owner, M = o.summonMode || NO_MODE, D = s.sdef;
  if (M.hold) return null;
  if (s.target && !s.target.dead && !s.target.remove && foe(s, s.target)) return s.target;
  if (M.mark && !M.mark.dead && !M.mark.remove && foe(s, M.mark) && Math.abs(M.mark.x - s.x) < (M.markR || 600)) return M.mark;
  const t = nearestFoe(s, D.sight || 560);
  if (t && M.follow && Math.abs(t.x - o.x) > 200) return null;
  return t;
}
function summonAI(s, dt) {
  const D = s.sdef, o = s.owner, M = o.summonMode || NO_MODE, R = game.room;
  const t = summonTarget(s);
  // 出招：在距离内、冷却好的招式里按权重随机
  if (t && s.aiCd <= 0 && D.attacks && D.attacks.length) {
    const dx = t.x - s.x, adx = Math.abs(dx), ady = Math.abs(t.y - s.y);
    const ok = D.attacks.filter((A, i) => adx >= A.range[0] && adx <= A.range[1] && ady <= A.dy && s.acd[i] <= 0 && (!A.cond || A.cond(s, t)));
    if (ok.length) {
      let r = rnd(0, ok.reduce((a, A) => a + (A.w || 1), 0)), A = ok[ok.length - 1];
      for (const x of ok) { r -= x.w || 1; if (r <= 0) { A = x; break; } }
      s.acd[D.attacks.indexOf(A)] = rnd(A.cd[0], A.cd[1]);
      s.aiCd = rnd(0.25, 0.6) / (D.aggro || 1) / (1 + buffVal(s, 'aspd'));
      s.face = dx >= 0 ? 1 : -1; s.vx = s.vy = 0;
      const events = (A.act.events || []).map(ev => ({ ...ev, done: false }));
      s.doAct({ name: A.clip, clip: A.clip, ...A.act, events, hits: A.act.hits && A.act.hits.map(h => ({ ...h, dmg: (h.dmg ?? 1) * s.mul * (A.lvDmg ? A.lvDmg(s.lv) : 1) })) });
      return;
    }
  }
  if (!D.speed) { if (t) s.face = t.x >= s.x ? 1 : -1; s.setState('idle'); return; }   // 固定不动（袄索）
  // 走位：有目标就走到 pref 距离并对齐纵深；没有就跟在 owner 身后
  if (s.think <= 0) {
    s.think = rnd(0.2, 0.45);
    // 围着目标错开站位：按 slot 分到不同纵深（不超出最短招式的纵深判定）和前后距离，十几只同时在场时不叠成一坨
    if (t) { const L = D.attacks && D.attacks.length ? D.attacks : null, dyMax = L ? Math.min(...L.map(A => A.dy)) * 0.7 : 10, lane = ((s.slot % 5) - 2) / 2;
      const dist = Math.min((D.pref ?? 50) + (s.slot % 3) * 10, L ? Math.max((D.pref ?? 50), Math.min(...L.map(A => A.range[1])) * 0.8) : Infinity);
      s.goalX = t.x - Math.sign(t.x - s.x || 1) * dist + rnd(-6, 6); s.goalY = clamp(t.y + lane * dyMax + rnd(-3, 3), 8, DEPTH - 8); }
    else { const back = M.follow ? 40 : 55 + (s.slot % 4) * 16; s.goalX = o.x - o.face * back; s.goalY = clamp(o.y + ((s.slot % 3) - 1) * 20, 8, DEPTH - 8); }
    if (R) s.goalX = clamp(s.goalX, R.x0 + 20, R.x1 - 20);
  }
  // 离 owner 太远：直接闪现到身边
  if (!t && Math.abs(s.x - o.x) > 520) { s.warp(o.x - o.face * 50, o.y); fxBurst(s.x, s.y, 40, 50, D.col || '#d8c0ff'); return; }
  const gx = s.goalX - s.x, gy = s.goalY - s.y, far = Math.abs(gx) > 160 || (!t && (o.st === 'run'));
  if (Math.abs(gx) > 6 || Math.abs(gy) > 4) {
    const l = Math.hypot(gx, gy * 1.3) || 1, sp = (far ? (D.runSpeed || D.speed * 1.9) : D.speed) * (1 + buffVal(s, 'mspd'));
    s.vx = gx / l * sp; s.vy = gy / l * sp * 0.8; s.face = s.vx >= 0 ? 1 : -1;
    s.setState(far && s.hasRun ? 'run' : 'walk');
  } else {
    s.vx = s.vy = 0; s.setState('idle');
    s.face = t ? (t.x >= s.x ? 1 : -1) : o.face;
  }
}
// ---- 每帧更新 ----
let summonRoom = null;
function updateSummons(dt) {
  if (!SUMMONS.length) { summonRoom = game.room; return; }
  const roomChanged = game.room !== summonRoom; summonRoom = game.room;
  const list = SUMMONS.slice();   // 遍历快照：onTick 里新增 / 删除都安全（新增的下一帧才 tick）
  for (const s of list) {
    if (s.gone) continue;
    const D = s.sdef, o = s.owner;
    if (!o || o.dead || o.remove || ents.indexOf(o) < 0) { dismissOne(s, 'owner'); continue; }
    if (roomChanged) {
      if (!D.keepRoom) { dismissOne(s, 'room'); continue; }
      if (s.kind === 'follower') {
        const front = D.enterAt === 'front';
        s.warp(o.x + o.face * (front ? 60 : -50 - (s.slot % 4) * 14), o.y + ((s.slot % 3) - 1) * 16);
        if (s.act) s.endAct(); s.setState('idle'); s.face = o.face;
        if (ents.indexOf(s) < 0) ents.push(s);
      }
    }
    s.lifeT += dt;
    if (s.lifeT >= s.life) { dismissOne(s, 'life'); continue; }
    if (s.kind === 'follower') {
      if (s.dead) { dismissOne(s, 'dead'); continue; }
      for (const k in s.buffs) { s.buffs[k].t -= dt; if (s.buffs[k].t <= 0) delete s.buffs[k]; }
      if (D.update) D.update(s, dt);
      continue;
    }
    if (s.kind === 'attach') {
      const h = s.host;
      if (!h || h.dead || h.remove || ents.indexOf(h) < 0) { dismissOne(s, 'dead'); continue; }
      s.x = h.x; s.y = h.y; s.z = h.z; s.face = h.face;
    }
    if (D.update) D.update(s, dt);
    if (D.tick && D.onTick) {
      s.tickT += dt;
      while (s.tickT >= D.tick && !s.gone) {
        s.tickT -= D.tick;
        if (s.kind === 'field') D.onTick(s, ents.filter(t => foe(o, t) && t.invul <= 0 && inGround(t, s.x, s.y, D.r || 60) && t.z < (D.zMax ?? 40)));
        else D.onTick(s, s.host);
        if (D.hits && ++s.hits >= D.hits) dismissOne(s, 'life');
      }
    }
    // 按 y 排序的绘制代理（attach 画在宿主上、field 的站立形象）；换房间清空 fxList 后自动补回
    if (!s.gone && (s.kind === 'attach' ? D.draw : D.drawUpright)) {
      if (!s.px || fxList.indexOf(s.px) < 0) s.px = addFx({ y: s.y + 0.5, dur: 1e9, s, update() { this.y = this.s.y + 0.5; }, draw(c) { const S = this.s; if (S.gone) return; (S.kind === 'attach' ? S.sdef.draw : S.sdef.drawUpright)(c, S); } });
    }
  }
  for (let i = SUMMONS.length - 1; i >= 0; i--) if (SUMMONS[i].gone) SUMMONS.splice(i, 1);
}
function drawSummonGround(c) {
  for (const s of SUMMONS) if (!s.gone && s.kind === 'field' && s.sdef.draw) s.sdef.draw(c, s);
}
// 挂进主循环：updateGroundFx 只在地下城 / 测试场景调用；drawGroundFx 在实体之前画（地面层）
{ const u0 = updateGroundFx; updateGroundFx = function (dt) { u0(dt); try { updateSummons(dt); } catch (e) { console.error('召唤物', e); } }; }
{ const d0 = drawGroundFx; drawGroundFx = function (c) { d0(c); if (SUMMONS.length) drawSummonGround(c); }; }
// 离开地下城（回城 / 进新地下城 / 决斗重开）时 ents 会被清空：没有 owner 的召唤物在下一次更新时清理；这里再兜一次底
if (typeof bus !== 'undefined') { bus.on('dungeonEnter', () => clearAllSummons('room')); bus.on('sceneEnter', () => clearAllSummons('room')); }
