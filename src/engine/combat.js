/* =====================================================================
   10b. 战斗结算：命中判定、伤害公式、受击反应（硬直 / 浮空 / 倒地 / 追击）、破招 / 背击、霸体与抓取、决斗场保护
   ---------------------------------------------------------------------
   伤害 = 攻击力(物理 atk / 魔法 matk / 独立 indep) × 技能倍率 × 防御减免(def / mdef) × 属性修正 × 浮动(±5%)
          × 暴击(critDmg) × 破招(1.25) × 决斗场修正 × 受伤倍率
     属性修正 = 1 + (攻击方属性强化 elem[e] − 受击方属性抗性 res[e]) / 220（与原作一致）
   命中：Miss 率 = 受击方回避 evade − 攻击方命中 hitRate（0..0.6）；抓取 / 觉醒等 sure 攻击必中
   硬直：stun × 僵直度修正（攻击方 stagger − 受击方 hardness，每 250 点 ±100%，限制在 0.5..1.6 倍）× 破招 1.5 倍
   浮空：每次空中受击浮空力 × 0.9^n（n = 本轮浮空受击次数），浮空重力随 n 增加（每次 +3.5%）；
         决斗场：本轮浮空累计受到 20% 最大 HP 伤害后加速下落，之后每多 5% 再加重一级
   倒地：只有 downHit 攻击能打到倒地目标（追击）；怪物被追击 4 次 / 决斗场倒地累计 20% 伤害 → 强制起身 + 无敌
   ===================================================================== */
const COMBAT = {
  airGravStep: 0.035,        // 每次浮空受击重力 +3.5%
  launchDecay: 0.9,          // 浮空力衰减（PvE）
  pveAirMax: 26,             // 怪物单次浮空受击超过这个次数后快速下落（防止无限浮空）
  pveOtgMax: 4,              // 怪物倒地被追击次数上限 → 强制起身
  protReset: 1.0,            // 可行动这么久后本轮连击统计清零
  counterMul: 1.25, counterStun: 1.5,
  backCrit: 0.1,             // 背击暴击率加成
};
// 决斗场（玩家对玩家）规则
const PVP = {
  dmg: 0.6,                  // 全局伤害修正（技能可用 pvp 字段单独修正）
  stun: 0.85,                // 硬直修正
  airProt: 0.2, airStep: 0.05,     // 浮空保护：本轮浮空累计伤害 ≥20% 最大 HP 开始加速下落，之后每 +5% 加重一级
  downProt: 0.2,             // 倒地保护：倒地后累计伤害 ≥20% → 强制起身
  getupInvul: 0.7, techInvul: 0.6,
  grabProt: 1.5,             // 被抓取释放后这段时间不能再被抓
  downTime: 0.7,
};
const isPvp = (a, t) => !!(a && t && a.fighter && t.fighter && a.team !== t.team);
const hasSA = e => e.superArmor > 0 || !!(e.st === 'act' && e.act && e.act.superArmor === true);
const isCounter = t => t.st === 'act' && !!t.act && !t.act.noCounter && t.actT < t.act.counterEnd;
const foe = (e, t) => t !== e && t.team !== e.team && t.team !== 'n' && !t.dead && !t.remove;
const hittable = (e, t) => foe(e, t) && t.invul <= 0;
function resetCmb(e) { const c = e.cmb; c.air = 0; c.airDmg = 0; c.down = 0; c.downDmg = 0; c.hits = 0; c.dmg = 0; c.bounce = 0; e.juggle = 0; e.downHits = 0; }
// 决斗场浮空保护等级（0 = 未触发）
function airProtLv(e) {
  if (!e.fighter || !game.pvp) return 0;
  const r = e.cmb.airDmg / e.hpMax; return r < PVP.airProt ? 0 : 1 + Math.floor((r - PVP.airProt) / PVP.airStep);
}
function airGravity(e) {
  const c = e.cmb;
  let g = 1 + Math.min(c.air, 20) * COMBAT.airGravStep;
  if (Math.abs(e.vz) < 70) g *= 0.8;                                  // 最高点略微停顿，方便追击
  const pl = airProtLv(e); if (pl) g *= 1 + 0.45 * pl;
  if (!e.fighter && c.air > COMBAT.pveAirMax) g *= 1.8;
  return g * (e.gravMul || 1);
}
function downTimeOf(e) { if (e.fighter) return game.pvp ? PVP.downTime : 0.55; return e.boss ? 0.5 : (e.def_ && e.def_.downTime) || 0.75; }
function getupInvulOf(e, tech) { if (e.fighter) return game.pvp ? (tech ? PVP.techInvul : PVP.getupInvul) : (tech ? 1.2 : 1.1); return 0.55; }
// 攻击 / 防御 / 暴击读取（带回退值：没有魔攻就用物攻；BUFF 的攻击加成对魔攻 / 独立同样生效）
function atkOf(e, type) {
  if (type === 'mag') return e.matk !== undefined ? e.matk * (1 + buffVal(e, 'atk')) : e.atk;
  if (type === 'indep') return e.indep !== undefined ? e.indep * (1 + buffVal(e, 'atk')) : e.atk;
  return e.atk;
}
const defOf = (e, type) => type === 'mag' ? (e.mdef ?? e.def) : e.def;
const critOf = (e, type) => type === 'mag' && e.mcrit !== undefined ? e.mcrit + buffVal(e, 'crit') : (e.crit || 0);
function elemMul(a, t, elem) { if (!elem) return 1; return clamp(1 + (((a.elem && a.elem[elem]) || 0) - ((t.res && t.res[elem]) || 0)) / 220, 0.3, 3); }
const stunMul = (a, t) => clamp(1 + ((a.stagger || 0) - (t.hardness || 0)) / 250, 0.5, 1.6);
const ELEM_COL = { fire: '#ff9a50', ice: '#9fe6ff', light: '#fff38a', dark: '#c79aff' };

/* ---- 命中判定：每帧检查所有激活中的攻击框 ---- */
function atkBox(a, h, out = {}) {
  const b = h.box; out.x0 = a.face > 0 ? a.x + b[0] : a.x - b[1]; out.x1 = a.face > 0 ? a.x + b[1] : a.x - b[0];
  out.y0 = a.y - b[2]; out.y1 = a.y + b[2]; out.z0 = a.z + b[3]; out.z1 = a.z + b[4]; return out;
}
function overlaps(B, t) {
  return B.x1 >= t.x - t.w && B.x0 <= t.x + t.w && B.y1 >= t.y - t.d && B.y0 <= t.y + t.d && B.z1 >= t.z && B.z0 <= t.z + t.hurtH();
}
// 能否打到：倒地目标只有追击判定（downHit）能打到；被别人抓住的目标也能打（只受伤不反应）
const canHit = (a, t, h) => foe(a, t) && t.invul <= 0 && (t.st !== 'down' || !!h.downHit);
const BOX = {};
function resolveHits() {
  for (const a of ents) {
    if (a.st !== 'act' || !a.act || !a.act.hits || a.hitstop > 0) continue;
    const act = a.act;
    for (let hi = 0; hi < act.hits.length; hi++) {
      const h = act.hits[hi];
      if (a.actT < h.t0 || a.actT >= h.t1 || (h.grab && a.grabbed)) continue;
      const B = atkBox(a, h, BOX);
      for (const t of ents) {
        if (!canHit(a, t, h) || !overlaps(B, t)) continue;
        const key = t.id * 100 + hi, last = a.hitsDone.get(key);
        if (last !== undefined) {
          if (!h.rep || a.actT - last < h.rep) continue;
          if (h.max) { const nk = key + 50, n = a.hitsDone.get(nk) || 1; if (n >= h.max) continue; a.hitsDone.set(nk, n + 1); }
        }
        a.hitsDone.set(key, a.actT);
        applyHit(a, t, h);
        if (a.act !== act || (h.grab && a.grabbed)) break;
      }
      if (a.act !== act) break;
    }
  }
}
// 立即判定（不依赖动作的命中窗口）：冲击波、拔刀等
function instantHit(e, h) {
  const B = atkBox(e, h); let n = 0;
  for (const t of ents) if (canHit(e, t, h) && overlaps(B, t)) { applyHit(e, t, h); n++; if (h.grab && e.grabbed) break; }
  return n;
}

/* ---- 伤害与受击反应 ---- */
function applyHit(a, t, h, opt = {}) {
  const src = opt.src || a, act = a.act;
  const type = h.type || opt.type || (act && act.type) || a.dmgType || 'phys';
  const elem = h.elem || opt.elem || (act && act.elem) || null;
  const pvp = isPvp(a, t);
  // ---- 命中 / 回避 ----
  if (!h.sure && !h.grab) {
    const miss = clamp((t.evade || 0) - (a.hitRate || 0), 0, 0.6);
    if (miss > 0 && Math.random() < miss) { fxText('MISS', t.x, t.y, t.z, { col: '#d8d8d8', size: 12, dur: 0.5 }); return false; }
  }
  const counter = !h.noCounterBonus && isCounter(t);
  const back = Math.sign(src.x - t.x || 1) !== t.face && t.st !== 'down' && t.st !== 'air' && t.st !== 'held';
  const crit = Math.random() < critOf(a, type) + (back ? COMBAT.backCrit : 0) + (h.critBonus || 0);
  const defV = Math.max(0, defOf(t, h.defType || type) || 0);
  let dmg = atkOf(a, type) * (h.dmg ?? 1) * (opt.mul || (act && !opt.proj ? act.dmgMul : 1) || 1) * (1 - defV / (defV + 1200)) * elemMul(a, t, elem) * rnd(0.95, 1.05);
  if (crit) dmg *= a.critDmg || 1.5;
  if (counter) dmg *= COMBAT.counterMul;
  if (pvp) dmg *= PVP.dmg * (h.pvp ?? (act && act.pvp) ?? 1);
  if (t.dmgTakenMul) dmg *= t.dmgTakenMul;
  dmg = Math.max(1, Math.round(dmg));
  t.hp -= dmg; t.lastDmg = dmg; t.lastHitBy = a;
  const c = t.cmb; c.hits++; c.dmg += dmg;
  if (t.st === 'air' || t.z > 2) c.airDmg += dmg;
  if (t.st === 'down') c.downDmg += dmg;
  // ---- 表现 ----
  const hx = (Math.max(Math.min(t.x + t.w, src.x + (h.box ? h.box[1] : 20) * src.face), t.x - t.w) + t.x) / 2;
  const hz = clamp(src.z + (h.box ? (h.box[3] + h.box[4]) / 2 : 40), t.z + 10, t.z + t.hurtH() - 8);
  addNumber(dmg, t.x, t.y, t.z, { crit, player: t.team === 'p' });
  fxHit(hx, t.y, hz, src.face, { col: h.col || (elem && ELEM_COL[elem]) || (a.team === 'p' ? '#bfe8ff' : '#ffd0a0'), big: h.big || 1, crit });
  if (counter) fxText('COUNTER', t.x, t.y, t.z, { col: '#ff4a2a' });
  else if (back && a.fighter) fxText('BACK ATTACK', t.x, t.y, t.z, { col: '#ffb030', size: 11 });
  t.flash = 0.08;
  const hs = (h.hs ?? 0.06) + (crit ? 0.02 : 0) + (counter ? 0.03 : 0);
  if (!opt.proj) a.hitstop = Math.max(a.hitstop, hs);
  t.hitstop = Math.max(t.hitstop, hs + 0.01);
  if (h.shake) cam.shake = Math.max(cam.shake, h.shake * (crit ? 1.4 : 1));
  sfx.hit(h.snd || (crit ? 'crit' : 'slash'), crit);
  if (a.team === 'p') game.onPlayerHit(t, dmg, crit, counter, back);
  if (t.team === 'p') game.onPlayerHurt(t, dmg, a);
  if (h.onHit) h.onHit(a, t, dmg);
  if (t.onDamaged) t.onDamaged(t, a, dmg, crit, h);
  if (elem === 'fire' && t.status && t.status.freeze) { delete t.status.freeze; if (t.st === 'hit') t.stun = Math.min(t.stun, 0.2); }   // 火属性攻击解冻
  // ---- 死亡 ----
  if (t.hp <= 0) {
    t.hp = 0;
    if (dmg > t.hpMax * 0.3 && !t.fighter) fxText('OVER KILL', t.x, t.y, t.z + 14, { col: '#ffe070', size: 13 });
    killEnt(t, a, h); return true;
  }
  react(a, t, h, src, counter, pvp);
  if (t.onHurt) t.onHurt(a, h);
  return true;
}
function react(a, t, h, src, counter, pvp) {
  if (t.st === 'held') return;                                      // 被抓住：只受伤不反应
  // 怪物蓄力招式：被打出足够伤害 → 破招
  if (t.act && t.act.breakable && a.team !== t.team) { t.breakDmg = (t.breakDmg || 0) + t.lastDmg; if (t.breakDmg > t.hpMax * t.act.breakable) { breakAct(t); return; } }
  if (h.grab) { if (canGrab(a, t, h)) { startGrab(a, t, h); return; } if (hasSA(t)) { t.flash = 0.1; return; } }
  else if (hasSA(t)) { t.flash = 0.1; return; }                     // 霸体：照常受伤，不硬直不浮空
  t.interrupt();
  const dir = h.radial ? Math.sign(t.x - src.x || src.face) : h.pull ? -src.face : src.face;
  const kb = (h.knock ?? 80) / Math.max(0.5, t.weight), c = t.cmb;
  const airborne = t.st === 'air' || t.z > 2, sw = Math.sqrt(t.weight);
  // ---- 倒地追击 ----
  if (t.st === 'down') {
    t.downHits++; c.down++;
    const prot = pvp ? c.downDmg >= t.hpMax * PVP.downProt : !t.fighter && t.downHits > COMBAT.pveOtgMax;
    if (prot) { t.startGetup(); t.invul = Math.max(t.invul, pvp ? PVP.getupInvul : 0.7); fxText(pvp ? '倒地保护' : '起身', t.x, t.y, t.z, { col: '#9fe8ff', size: 10 }); return; }
    if (!h.launch) { t.vz = (h.otgLift ?? 110) / sw; t.z = 1; t.vx = dir * kb * 0.3; t.setState('air'); t.bounced = true; return; }
  }
  const pl = airProtLv(t), pk = pl ? Math.pow(0.55, pl) : 1;
  if (h.launch || airborne || t.st === 'down') {
    const decay = Math.max(0.3, Math.pow(COMBAT.launchDecay, c.air));
    let vz = (h.launch || (airborne ? h.airLift ?? 180 : 160)) * decay * pk / sw;
    if (airborne && !h.launch) vz = Math.max(t.vz * 0.3, vz);
    if (h.spike) vz = -h.spike;                                       // 向下砸地
    t.vz = vz; t.z = Math.max(t.z, 1); t.vx = dir * kb * (airborne ? 0.6 : 0.8); c.air++; t.juggle++;
    if (!airborne) t.bounced = false;
    if (h.bounce) t.bounceNext = h.bounce;
    t.setState('air'); t.play(t.clipOr(vz > 80 ? 'airUp' : 'air', 'air'), true);
  } else if (h.down) {
    t.vz = (h.downLift ?? 230) / sw; t.z = 1; t.vx = dir * kb; t.setState('air'); t.bounced = false; c.air++; t.juggle++;
    if (h.bounce) t.bounceNext = h.bounce;
    t.play(t.clipOr('airUp', 'air'), true);
  } else {
    const stun = (h.stun ?? 0.32) * stunMul(a, t) * (counter ? COMBAT.counterStun : 1) * (pvp ? PVP.stun : 1) / sw;
    t.setState('hit'); t.stun = stun; t.vx = dir * kb;
    t.hitHeavy = !!h.heavy || stun > 0.46 || kb > 190;
    t.play(t.hitHeavy ? t.clipOr('hit2', 'hit') : 'hit', true);
  }
}
function killEnt(t, a, h) {
  t.interrupt(); if (t.heldBy) { if (t.heldBy.grabbed === t) t.heldBy.grabbed = null; t.heldBy = null; }
  t.dead = true; t.setState('dead'); t.deadT = 0; t.act = null;
  t.vz = Math.max(t.vz, t.z > 2 ? 120 : 260); t.vx = (a ? a.face : -t.face) * 120; t.z = Math.max(t.z, 1);
  t.hitstop = 0.12;
  if (t.onDeath) t.onDeath(a);
  game.onKill(t, a);
}

/* ---- 抓取：抓取判定（hit.grab）可以抓住霸体目标；体型过大（noGrab / 领主）抓不住 ----
   抓住后目标进入 held 状态，位置跟随抓取者（act.hold(e, t) 可自定义），抓取者的动作结束 / 被打断即释放；
   throwGrab(e, hit) 用一次攻击把目标扔出（必中，带正常的受击反应） */
function canGrab(a, t, h) { return !t.noGrab && !(t.boss && !h.grabBoss) && t.grabProt <= 0 && !t.heldBy && t.st !== 'down' && t.weight <= (h.grabMaxW ?? 2.2) && !t.dead; }
function startGrab(a, t, h) {
  t.interrupt(); t.setState('held'); t.heldBy = a; t.vx = t.vy = t.vz = 0; t.heldT = 0; t.rot = 0; t.play(t.clipOr('held', 'hit2', 'hit'), true);
  a.grabbed = t; t.face = -a.face; t.hitHeavy = true;
  sfx.hit('blunt', false); fxText('抓取', t.x, t.y, t.z + 10, { col: '#ffcf6a', size: 10, dur: 0.5 });
  if (a.act && a.act.onGrab) a.act.onGrab(a, t);
  holdGrabbed(a);
}
function holdGrabbed(a) {
  const t = a.grabbed; if (!t || t.heldBy !== a) { a.grabbed = null; return; }
  if (a.act && a.act.hold) { a.act.hold(a, t); return; }
  const g = a.act && a.act.grabAt || GRAB_AT;
  t.x = a.x + a.face * g[0]; t.y = a.y + 0.5; t.z = Math.max(0, a.z + g[1]); t.face = -a.face;
}
const GRAB_AT = [34, 18];
function updateHeld(t, dt) {
  t.heldT += dt;
  const a = t.heldBy;
  if (!a || a.dead || a.grabbed !== t || a.st !== 'act' || t.heldT > 4) releaseHeld(t);
}
function releaseHeld(t) {
  const a = t.heldBy; t.heldBy = null; if (a && a.grabbed === t) a.grabbed = null;
  t.grabProt = isPvp(a, t) ? PVP.grabProt : 0.3;
  if (t.z > 2) { t.setState('air'); t.vz = 0; t.bounced = false; } else { t.setState('hit'); t.stun = 0.15; }
}
function dropGrab(a) { const t = a.grabbed; a.grabbed = null; if (t && t.heldBy === a) releaseHeld(t); }
function throwGrab(a, h) {
  const t = a.grabbed; if (!t) return null;
  a.grabbed = null; t.heldBy = null; t.setState('hit'); t.grabProt = isPvp(a, t) ? PVP.grabProt : 0.3;
  applyHit(a, t, { sure: true, noCounterBonus: true, ...h }, { proj: !!h.proj });
  return t;
}
