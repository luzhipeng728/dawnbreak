/* =====================================================================
   91b. 格斗者 AI：决斗场对手（以及自动测试里的“玩家”）。只通过虚拟手柄 Pad 按键，走的是和键盘玩家完全相同的角色逻辑
   - 防守：看到对手出招（有反应延迟）→ 后跳 / 纵深走位躲投射物 / 格挡 / 抢招破招；倒地按 C 受身；长时间挨打用后跳-强化脱身（官方没有闪避键）
   - 进攻：对齐纵深 → 近身 / 保持射程 → 普攻起手 → 技能取消普攻 → 浮空追击（跳攻 / 射击托空 / 再次挑空）→ 终结技；有觉醒时找机会放
   - 难度 1..3：反应时间、进攻欲望、防守概率、受身概率、连招完整度
   ===================================================================== */
const AI_LEVELS = {
  1: { react: 0.36, think: 0.26, aggr: 0.45, def: 0.25, tech: 0.35, combo: 0.45, escape: 0.1, awaken: 0.3 },
  2: { react: 0.24, think: 0.17, aggr: 0.65, def: 0.45, tech: 0.65, combo: 0.75, escape: 0.25, awaken: 0.55 },
  3: { react: 0.15, think: 0.11, aggr: 0.8, def: 0.65, tech: 0.9, combo: 0.95, escape: 0.4, awaken: 0.8 },
};
// 技能种类优先级（组 AI 的技能栏用）
const AI_KIND_RANK = { launch: 0, grab: 1, awaken: 2, burst: 3, gap: 4, aoe: 5, poke: 6, proj: 7, buff: 8, stance: 9, air: 10, mode: 11, guard: 12, escape: 13 };
function aiKit(cls, job, lv = 30) {
  const ids = classSkills(cls, job).filter(id => { const S = SKILLS[id]; return S && !S.passive && (S.act || S.instant) && S.lvReq <= lv && S.ai; });
  ids.sort((a, b) => (SKILLS[b].ai.core ? 1 : 0) - (SKILLS[a].ai.core ? 1 : 0) || (AI_KIND_RANK[SKILLS[a].ai.kind] ?? 20) - (AI_KIND_RANK[SKILLS[b].ai.kind] ?? 20) || (SKILLS[b].job ? 1 : 0) - (SKILLS[a].job ? 1 : 0));
  const bar = ids.slice(0, SKILL_SLOTS); while (bar.length < SKILL_SLOTS) bar.push(null);
  const L = {}; for (const id of classSkills(cls, job)) { const S = SKILLS[id]; if (S.lvReq <= lv) L[id] = Math.max(1, Math.min(S.maxLv, 1 + Math.floor((lv - S.lvReq) / 3))); }
  return { bar, lv: L, job: job || null, wtype: null };
}
const AI_CHARGE = new Set(['iai', 'gl_cannon', 'bm_raid', 'gl_x1', 'mg_jack', 'mg_snowman', 'mg_orb', 'mg_vortex', 'slam']);   // 可以按住蓄力的技能
class FighterBrain {
  constructor(p, level = 2) { this.p = p; this.L = AI_LEVELS[level] || AI_LEVELS[2]; this.t = 0; this.nextThink = 0; this.seenAct = null; this.seenT = 0; this.hold = null; this.holdUntil = 0; this.follow = null; this.yWob = 0; this.techRoll = null; }
  reset() { this.t = 0; this.nextThink = 0; this.seenAct = null; this.seenT = 0; this.hold = null; this.holdUntil = 0; this.follow = null; this.techRoll = null; }   // 新回合
  target() { let best = null, bd = 1e9; for (const o of ents) if (foe(this.p, o)) { const d = Math.abs(o.x - this.p.x) + Math.abs(o.y - this.p.y) * 2 + (o.fighter ? -300 : 0); if (d < bd) { bd = d; best = o; } } return best; }
  ready(id) {
    const p = this.p, S = SKILLS[id]; if (!S || !skillUsable(p, id) || barOf(p).indexOf(id) < 0) return false;
    const recast = S.recast && S.recast.ok(p);
    // 召唤类（ai.summon = 召唤物 key）：在场数量到上限就不再放，能再按就改用再按（召唤框架见 docs/SKILLS_OFFICIAL_mage.md 第 6 节）
    if (S.ai && S.ai.summon && typeof summonsOf === 'function') { const max = S.ai.summonMax ?? (typeof summonDef === 'function' && summonDef(S.ai.summon) ? summonDef(S.ai.summon).max : Infinity); if (summonsOf(p, S.ai.summon).length >= (max ?? Infinity)) return !!recast; }
    if (recast) return !((p.cool[id + '~'] || 0) > 0);
    const q = p.charges && p.charges[id]; if (S.charges && q && q.n < 1) return false;
    return !(p.cool[id] > 0) && p.mp >= S.mp;
  }
  // 从技能栏里挑一个满足条件的技能
  pickSkill(kinds, adx, ady, inAir) {
    const p = this.p, bar = barOf(p), L = [];
    for (const id of bar) { if (!id || !this.ready(id)) continue; const S = SKILLS[id], ai = S.ai;
      if (!kinds.includes(ai.kind)) continue; if (inAir ? !S.air : S.airOnly) continue;
      if (ai.r && (adx < ai.r[0] - 10 || adx > ai.r[1] + 10)) continue; if (ai.dy && ady > ai.dy) continue;
      L.push(id); }
    return L.length ? pick(L) : null;
  }
  cast(id, dir) {
    const P = this.p.pad, slot = barOf(this.p).indexOf(id); if (slot < 0) return false;
    if (dir) P.hold(dir > 0 ? 'right' : 'left');
    P.tap('s' + slot);
    const S = SKILLS[id];
    if (AI_CHARGE.has(id)) { this.hold = 's' + slot; this.holdUntil = this.t + rnd(0.2, 0.7); }
    if (id === 'g_m3' || id === 'gl_flame' || id === 'guard') { this.hold = 's' + slot; this.holdUntil = this.t + rnd(0.6, 1.4); }
    if (id === 'flow') this.follow = { t: this.t + 0.12, key: pick(['attack', 'jump', 'cmd']) };
    this.lastCast = id; return true;
  }
  tick(dt) {
    const p = this.p, P = p.pad, L = this.L; this.t += dt;
    if (p.dead || game.timeStop > 0) return;
    if (this.hold && this.t < this.holdUntil) P.hold(this.hold); else this.hold = null;
    if (this.follow && this.t >= this.follow.t) { P.tap(this.follow.key); this.follow = null; }
    const o = this.target(); if (!o) return;
    const dx = o.x - p.x, adx = Math.abs(dx), dy = o.y - p.y, ady = Math.abs(dy), dir = Math.sign(dx) || p.face;
    // ---- 受身蹲伏：倒地后按 C；挨了长连段就用后跳-强化脱身 ----
    if (p.st === 'down' || (p.st === 'air' && p.z < 24 && p.vz < 0)) {
      if (p.st === 'down' && bsupReady(p) && p.cmb.hits >= 5 && Math.random() < L.escape) { P.hold('down'); P.tap('jump'); return; }
      if (this.techRoll === null) this.techRoll = Math.random() < L.tech;
      if (this.techRoll && p.reboundCd <= 0 && p.stT > L.react * 0.4) P.tap('jump');
      return;
    }
    this.techRoll = null;
    // ---- 挨打中：连段太长就用后跳-强化脱身（↓+C，冷却 30 秒）----
    if (p.st === 'hit') { if (bsupReady(p) && p.cmb.hits >= 4 && Math.random() < L.escape * dt * 6) { P.hold('down'); P.tap('jump'); } return; }
    if (!p.free && p.st !== 'act') return;
    // ---- 防守：对手出招（反应延迟后）或飞行道具逼近 ----
    if (o.st === 'act' && o.act !== this.seenAct) { this.seenAct = o.act; this.seenT = this.t; this.defRoll = Math.random(); }
    if (o.st !== 'act') this.seenAct = null;
    const reach = this.reachOf(o);
    const meleeThreat = o.st === 'act' && this.seenAct && this.t - this.seenT >= L.react && adx < reach + 30 && ady < 34 && (o.x < p.x) === (o.face > 0) && o.actT < o.act.counterEnd + 0.05;
    const projThreat = this.projThreat(p);
    if ((meleeThreat || projThreat) && this.defRoll < L.def && (p.free || canBackstep(p))) { if (this.defend(o, dir, meleeThreat, projThreat, adx)) return; }
    // ---- 进攻 ----
    if (this.t < this.nextThink) { this.move(o, dx, dy, adx, ady, dir); return; }
    this.nextThink = this.t + L.think * rnd(0.7, 1.3);
    this.attack(o, dx, dy, adx, ady, dir);
  }
  reachOf(o) {
    const a = o.act; if (!a) return 70;
    if (a.skill && SKILLS[a.skill] && SKILLS[a.skill].ai && SKILLS[a.skill].ai.r) return SKILLS[a.skill].ai.r[1];
    let r = 60; if (a.hits) for (const h of a.hits) r = Math.max(r, h.box[1]); return r;
  }
  projThreat(p) { for (const pr of projs) if (pr.team !== p.team && pr.hit && Math.abs(pr.y - p.y) < 22 && Math.abs(pr.z - p.z) < 80 && Math.sign(p.x - pr.x) === Math.sign(pr.vx || 0) && Math.abs(p.x - pr.x) < 200) return pr; return null; }
  defend(o, dir, melee, proj, adx) {
    const p = this.p, P = p.pad, r = Math.random();
    // 破招：对手还在起手、自己离得近并且有快速挑空技 → 抢招
    if (melee && o.actT < o.act.counterEnd * 0.5 && adx < 80 && r < 0.3) { const id = this.pickSkill(['launch', 'grab'], adx, Math.abs(o.y - p.y), false); if (id && this.cast(id, dir)) return true; }
    if (proj && !melee) { const up = p.y > DEPTH / 2 ? 'up' : 'down'; P.hold(up); if (r < 0.5 && p.free) P.tap('jump'); return true; }
    if (hasSkill(p, 'guard') && this.ready('guard') && r < 0.3) return this.cast('guard', dir);
    const bm = backstepMode(p);
    if (bm === 'free' && r < 0.75) { P.hold('down'); P.tap('jump'); return true; }
    if (bm === 'up' && r < 0.4) { P.hold('down'); P.tap('jump'); return true; }   // 技能中：后跳-强化（冷却 40 秒，省着用）
    if (p.free) { P.hold(Math.random() < 0.5 ? 'up' : 'down'); P.hold(dir > 0 ? 'left' : 'right'); return true; }   // 纵深走位
    return false;
  }
  move(o, dx, dy, adx, ady, dir) {
    const p = this.p, P = p.pad; if (!p.free) return;
    const ranged = p.cls !== 'sword' && !(p.cls === 'mage' && jobOf(p) === 'battlemage');
    let want = ranged ? 200 : 62; if (o.st === 'down' || o.st === 'getup') want = ranged ? 160 : 110;
    if (this.yWob <= 0 || Math.random() < 0.01) this.yWob = rnd(-1, 1) * (ranged ? 30 : 8);
    const gx = o.x - dir * want, gy = clamp(o.y + (adx > 150 ? this.yWob : 0), 8, DEPTH - 8), ex = gx - p.x, ey = gy - p.y;
    if (Math.abs(ex) > 14) { const d = Math.sign(ex); P.hold(d > 0 ? 'right' : 'left'); if (Math.abs(ex) > 180) P.runDir = d; }
    else if (p.face !== dir && adx > 20) P.hold(dir > 0 ? 'right' : 'left');
    if (Math.abs(ey) > 5) P.hold(ey > 0 ? 'down' : 'up');
  }
  attack(o, dx, dy, adx, ady, dir) {
    const p = this.p, P = p.pad, L = this.L;
    const inAir = p.st === 'jump' || p.z > 2, busySkill = p.st === 'act' && !canSkillCancel(p);
    if (busySkill) return;
    // BUFF：开局 / 过期后补上
    if (p.free && Math.random() < 0.5) { const b = this.pickSkill(['buff'], adx, ady, false); if (b && !p.buffs[b]) { this.cast(b, dir); return; } }
    // 觉醒：对手在范围内、血量不低
    // 觉醒：开局一段时间后，对手被打中（硬直 / 浮空 / 被抓）或就在身边出招时才放；对手血量太低不浪费
    const openAwk = o.st === 'hit' || o.st === 'air' || o.st === 'held' || (adx < 140 && o.st === 'act');
    if (!inAir && this.t > 6 && openAwk && o.hp > o.hpMax * 0.2 && Math.random() < L.awaken * 0.5) { const a = this.pickSkill(['awaken'], adx, ady, false); if (a && this.cast(a, dir)) return; }
    const oAir = o.st === 'air' || o.z > 6, oStun = o.st === 'hit' || o.st === 'held', oDown = o.st === 'down' || o.st === 'getup';
    const melee = adx < 90 && ady < 22;
    // ---- 浮空追击 ----
    if (oAir && o.lastHitBy === p && Math.random() < L.combo) {
      if (p.cls === 'gun' && adx < 380 && ady < 20) { P.hold(dir > 0 ? 'right' : 'left'); P.tap('attack'); return; }
      if (adx < 90 && ady < 24) {
        if (o.z < 55 && o.cmb.air < 7) { const id = this.pickSkill(['launch', 'burst', 'aoe'], adx, ady, inAir); if (id && Math.random() < 0.55) { this.cast(id, dir); return; } }
        if (o.z > 60 && p.free && p.cls !== 'gun' && Math.random() < 0.4) { P.hold(dir > 0 ? 'right' : 'left'); P.tap('jump'); this.follow = { t: this.t + 0.14, key: 'attack' }; return; }
        P.hold(dir > 0 ? 'right' : 'left'); P.tap('attack'); return;
      }
    }
    // ---- 对手硬直中：普攻连段 → 技能取消 ----
    if (oStun && melee && o.lastHitBy === p) {
      if (p.st === 'act' && p.act.basic && Math.random() < L.combo * 0.6) { const id = this.pickSkill(['launch', 'grab', 'burst', 'aoe', 'poke'], adx, ady, inAir); if (id && this.cast(id, dir)) return; }
      P.hold(dir > 0 ? 'right' : 'left'); P.tap('attack'); return;
    }
    // ---- 对手倒地：枪手低射追击，其他职业站位等起身 ----
    if (oDown) { if (p.cls === 'gun' && adx < 300 && ady < 16 && o.st === 'down' && Math.random() < 0.5) { P.hold(dir > 0 ? 'right' : 'left'); P.hold('down'); P.tap('attack'); } else this.move(o, dx, dy, adx, ady, dir); return; }
    // ---- 立回：在距离内按欲望出手 ----
    if (Math.random() > L.aggr) { this.move(o, dx, dy, adx, ady, dir); return; }
    if (ady > 26) { this.move(o, dx, dy, adx, ady, dir); return; }
    if (melee && adx < 70) {
      const id = Math.random() < 0.45 ? this.pickSkill(['launch', 'grab', 'poke', 'burst', 'aoe'], adx, ady, inAir) : null;
      if (id && this.cast(id, dir)) return;
      P.hold(dir > 0 ? 'right' : 'left'); P.tap('attack'); return;
    }
    const id = this.pickSkill(['gap', 'proj', 'poke', 'burst', 'aoe', 'launch', 'grab'], adx, ady, inAir);
    if (id && Math.random() < 0.6) { this.cast(id, dir); return; }
    if (p.cls === 'gun' && adx < 360 && Math.random() < 0.6) { P.hold(dir > 0 ? 'right' : 'left'); P.tap('attack'); return; }
    if (p.cls === 'mage' && adx < 360 && Math.random() < 0.3 && this.ready('mg_orb')) { this.cast('mg_orb', dir); return; }
    this.move(o, dx, dy, adx, ady, dir);
  }
}
// AI 格斗者的控制函数：先由大脑写入本帧按键，再结算虚拟手柄，最后走通用的角色逻辑
function aiFighterControl(p, dt) { p.brain.tick(dt); p.pad.frame(game.t); playerControl(p, dt); }
