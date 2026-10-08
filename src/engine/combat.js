/* =====================================================================
   10b. 战斗结算：命中判定、伤害公式、受击反应（硬直 / 浮空 / 倒地 / 追击）、破招 / 背击、霸体与抓取、决斗场保护
   ---------------------------------------------------------------------
   伤害 = 攻击力(物理 atk / 魔法 matk / 独立 indep) × 技能倍率 × 防御减免(def / mdef) × 属性修正 × 浮动(±5%)
          × 暴击(critDmg) × 破招(1.25) × 决斗场修正 × 受伤倍率
     属性修正 = 1 + (攻击方属性强化 elem[e] − 受击方属性抗性 res[e]) / 220（与原作一致）
   命中：Miss 率 = 受击方回避 evade − 攻击方命中 hitRate（0..0.6）；抓取 / 觉醒等 sure 攻击必中
   硬直：stun × 僵直度修正（攻击方 stagger − 受击方 hardness，每 250 点 ±100%，限制在 0.5..1.6 倍）× 破招 1.5 倍
   浮空：见下面的 JUGGLE 参数表（docs/COMBAT_JUGGLE.md）：浮空力 ÷ 重量^0.5，同一轮连击里追加浮空逐次递减，空中普通受击“接住”下落，
         越连越沉；落地速度大就弹地一次；决斗场浮空保护（累计 20% 起加速下落，每 +5% 加重一级，35% 强制空中受身）
   倒地：只有 downHit 攻击能打到倒地目标（追击）；怪物被追击 4 次 / 决斗场倒地累计 20% 伤害 → 强制起身 + 无敌
   ===================================================================== */
/* 浮空参数表（刷图 + 决斗共用；技能里的写法：launch 挑空力 / airLift 空中托力 / spike 向下砸 + bounce 弹地倍率 / down 击倒 + downLift / otgLift 倒地追击托力）
   高度 ≈ (launch × 递减 ÷ 重量^0.5)² ÷ (2 × grav)：launch 520 打普通怪 ≈ 118 像素、滞空约 1 秒 */
const JUGGLE = {
  grav: 1150,                // 浮空状态的重力（跳跃等其他状态还是 GRAV 1500）
  apexV: 80, apexFloat: 0.75,     // 最高点附近（|vz| < 80）重力 ×0.75：顶点停一下，方便追击
  weightExp: 0.5, bossRes: 0.7,   // 浮空力 ÷ 重量^0.5；领主再 ×0.7
  relaunch: 0.87, relaunchMin: 0.4,  // 追加浮空：同一轮连击第 n 次挑空 × 0.87^n（最低 40%）
  airLift: 160, airDecay: 0.93, airMin: 0.2,   // 空中普通受击：接住下落，力度 k = 0.93^空中受击次数（最低 20%）：托力 × k，下落速度按 k 拉回托力
  riseKeep: 0.96,            // 上升中被普通攻击打到：保留 96% 上升速度（不会把挑空打断）
  gravStep: 0.03, gravMax: 0.9,   // 每次空中受击重力 +3%，最多 +90%（越连越沉）
  // 刷图没有浮空时限（官方也没有）：以前“同一轮浮空超过 5 秒 → 重力 ×2、挑空 ×0.3、不再接住”的断崖已取消，连招长度只由浮空保护决定
  duelSumLateT: 5, duelSumLate: 0.3,   // 只剩决斗里召唤物 / 场地打决斗玩家（不按玩家对玩家结算）沿用的旧时限：浮空超过 5 秒后挑空 ×0.3、不再接住
  bounceImp: 330, bounceK: 0.32,  // 落地速度 > 330 且这轮没弹过 → 弹地一次（速度 × 0.32）；bounce: k 强制弹（速度 × k，至少 260）
  otgMax: 4, otgLift: 110,        // 倒地追击：怪物被追击超过 4 次强制起身；追击把目标轻轻托起
  pvpGrav: 0.6, pvpLaunch: 0.55, pvpRecover: 4,   // 决斗一段保护每级：重力 +60%、浮空力 ×0.55。二段（30%）不在这里强制受身，由 duel.js 直接砸地
  pvpFloatK: 0.4, pvpFloatG: 0.26,  // 决斗未进保护时：挑空压低（站立技能整段都打得到）、下落放慢，上挑之后还能接第二下、第三下。一段保护之后这两项取消，人变沉
  pvpAirT: 3, pvpAirRamp: 0.8,    // 决斗：同一轮浮空超过 3 秒，重力每秒再 +80%
  pvpOtgPop: 240, pvpSweepPop: 210,   // 倒地被扫地托起的高度；二段保护之后再托，只给一小节，马上落回地上
};
const COMBAT = {
  pveOtgMax: JUGGLE.otgMax,   // 怪物倒地被追击次数上限 → 强制起身
  protReset: 1.0,            // 可行动这么久后本轮连击统计清零
  counterMul: 1.25, counterStun: 1.5,
  backCrit: 0.1,             // 背击暴击率加成
};
// 决斗场（玩家对玩家）规则
const PVP = {
  dmg: 0.35,                 // 全局伤害修正（技能可用 pvp 字段单独修正）
  stun: 0.85,                // 硬直修正
  airProt: 0.2, airStep: 0.05,     // 浮空保护：本轮浮空累计伤害 ≥20% 最大 HP 开始加速下落，之后每 +5% 加重一级
  downProt: 0.2,             // 倒地保护：倒地后累计伤害 ≥20% → 强制起身
  standProt: 0.22,           // 平推保护：站立挨打累计伤害 ≥22% → 强制击倒
  getupInvul: 0.7, techInvul: 0.6,
  grabProt: 1.5,             // 被抓取释放后这段时间不能再被抓
  downTime: 1.35,            // 决斗被砸倒后先躺这么久：够对手扫地，也够自己按跳跃受身蹲伏。连着被扫时 duel.js 会把起身再往后推
  hitCap: 0,                 // 决斗单下伤害上限（占最大 HP 的比例）。0 = 不封顶；duel.js 设成 0.09，避免一发大技能跨过两段保护
  stunDecay: 0.025, stunMin: 0.6,   // 连击硬直衰减：同一轮连击每多挨一下，硬直 −2.5%，最低 60%（官方“连招越长硬直越短”）
};
const isPvp = (a, t) => !!(a && t && a.fighter && t.fighter && a.team !== t.team);
// 地下城里玩家的技能释放期间自带霸体（后来的官方版本也是大部分技能有霸体；用户反馈技能总被打断）。
// 普攻 / 跳跃攻击 / 冲刺攻击不带；决斗场保持技能原本的霸体设定；技能定义里写 noSA: true 可以单独关掉。
const skillSA = e => !game.pvp && e.team === 'p' && e.st === 'act' && !!e.act && !!e.act.skill && !e.act.noSA && !(SKILLS[e.act.skill] && SKILLS[e.act.skill].noSA);
const hasSA = e => e.superArmor > 0 || !!(e.st === 'act' && e.act && (e.act.superArmor === true || skillSA(e)));
const isCounter = t => t.st === 'act' && !!t.act && !t.act.noCounter && t.actT < t.act.counterEnd;
const foe = (e, t) => t !== e && t.team !== e.team && t.team !== 'n' && !t.dead && !t.remove;
const hittable = (e, t) => foe(e, t) && t.invul <= 0;
function resetCmb(e) { const c = e.cmb; c.air = 0; c.airDmg = 0; c.down = 0; c.downDmg = 0; c.standDmg = 0; c.hits = 0; c.dmg = 0; c.bounce = 0; c.launch = 0; c.airT = 0; e.juggle = 0; e.downHits = 0; e.recoverLand = false; e._plShown = 0; }
// 决斗场浮空保护等级（0 = 未触发）
function airProtLv(e) {
  if (!e.fighter || !game.pvp) return 0;
  const r = e.cmb.airDmg / e.hpMax; return r < PVP.airProt ? 0 : 1 + Math.floor((r - PVP.airProt) / PVP.airStep);
}
function airGravity(e) {
  const c = e.cmb;
  let g = JUGGLE.grav / GRAV * (1 + Math.min(JUGGLE.gravMax, (c.air || 0) * JUGGLE.gravStep));
  if (Math.abs(e.vz) < JUGGLE.apexV) g *= JUGGLE.apexFloat;          // 最高点略微停顿，方便追击
  const pl = airProtLv(e), T = c.airT || 0;
  if (e.fighter && game.pvp && !pl) g *= JUGGLE.pvpFloatG;   // 还没到一段：下落慢，给连招留时间
  if (pl) g *= 1 + JUGGLE.pvpGrav * pl;
  if (e.fighter && game.pvp && T > JUGGLE.pvpAirT) g *= 1 + (T - JUGGLE.pvpAirT) * JUGGLE.pvpAirRamp;
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
const stunMul = (a, t) => clamp(1 + ((a.stagger || 0) + buffVal(a, 'stagger') - (t.hardness || 0)) / 250, 0.5, 1.6);
const ELEM_COL = { fire: '#ff9a50', ice: '#9fe6ff', light: '#fff38a', dark: '#c79aff' };

/* ---- 命中判定：每帧检查所有激活中的攻击框 ---- */
// 技能攻击范围倍率（a.rngMul，默认没有 = 1；战斗法师装矛 +20%）：只对带技能 id 的非觉醒技能生效，普攻和觉醒不受影响
const rngOf = a => a.rngMul && a.act && a.act.skill && !(SKILLS[a.act.skill] || {}).awaken ? a.rngMul : 1;
function atkBox(a, h, out = {}) {
  const m = rngOf(a), b = m === 1 ? h.box : [h.box[0] * m, h.box[1] * m, h.box[2] * m, h.box[3], h.box[4]]; out.x0 = a.face > 0 ? a.x + b[0] : a.x - b[1]; out.x1 = a.face > 0 ? a.x + b[1] : a.x - b[0];
  out.y0 = a.y - b[2]; out.y1 = a.y + b[2]; out.z0 = a.z + b[3]; out.z1 = a.z + b[4]; return out;
}
function overlaps(B, t) {
  return B.x1 >= t.x - t.w && B.x0 <= t.x + t.w && B.y1 >= t.y - t.d && B.y0 <= t.y + t.d && B.z1 >= t.z && B.z0 <= t.z + t.hurtH();
}
// 决斗扫地：倒地的人除了追击 / 抓倒地，低段（判定贴地、带 down / launch）也打得到。高段打空，所以要选低招。地下城仍只有 downHit
function pvpOtg(h) {
  if (!h) return false;
  if (h.downHit || h.grabDown || h.down || h.launch) return true;
  const b = h.box;
  return !!(b && b.length >= 4 && b[3] <= 28);
}
// 能否打到：倒地目标只有追击判定（downHit）或能抓倒地的抓取（grabDown）能打到；决斗里低段也能扫地。被别人抓住的目标也能打（只受伤不反应）
const canHit = (a, t, h) => foe(a, t) && t.invul <= 0 && (t.st !== 'down' || !!h.downHit || !!h.grabDown || !!(game.pvp && t.fighter && pvpOtg(h)));
const BOX = {};
function resolveHits() {
  for (const a of ents) {
    if (a.st !== 'act' || !a.act || !a.act.hits || a.hitstop > 0) continue;
    const act = a.act;
    for (let hi = 0; hi < act.hits.length; hi++) {
      const h = act.hits[hi];
      if (a.actT < h.t0 || a.actT >= h.t1 || (h.grab && grabFull(a, h))) continue;
      const B = atkBox(a, h, BOX);
      for (const t of ents) {
        if (!canHit(a, t, h) || !overlaps(B, t)) continue;
        const key = t.id * 100 + hi, last = a.hitsDone.get(key);
        if (last !== undefined && (!h.rep || a.actT - last < h.rep)) continue;
        const G = act.hitGroup;   // 共享“已命中”表（召唤框架 hitGroup：本体和召唤物同时出招，同一目标只结算一次）；在 max 计数之前判断，被去重的那一下不占次数
        if (G) { const l = G.last.get(t.id); if (l !== undefined && game.t - l < G.win) continue; }
        if (last !== undefined && h.max) { const nk = key + 50, n = a.hitsDone.get(nk) || 1; if (n >= h.max) continue; a.hitsDone.set(nk, n + 1); }
        if (G) G.last.set(t.id, game.t);
        a.hitsDone.set(key, a.actT);
        applyHit(a, t, h);
        if (a.act !== act || (h.grab && grabFull(a, h))) break;
      }
      if (a.act !== act) break;
    }
  }
}
// 立即判定（不依赖动作的命中窗口）：冲击波、拔刀等
function instantHit(e, h) {
  const B = atkBox(e, h); let n = 0;
  for (const t of ents) if (canHit(e, t, h) && overlaps(B, t)) { applyHit(e, t, h); n++; if (h.grab && grabFull(e, h)) break; }
  return n;
}

/* ---- 伤害与受击反应 ---- */
function applyHit(a, t, h, opt = {}) {
  if (a.ghost || t.ghost) return false;   // 组队刷图：队友的影子（net/coop.js）只做表现，不造成也不承受伤害（伤害由各自的客户端结算）
  const src = opt.src || a, act = a.act;
  // 受击前钩子（职业）：CLASSES[cls].beforeHurt(t, a, h, opt) → { block, mul, minHp, noStun, noStatus }（鬼剑士 自动格挡 / 心眼 / 狂气涌动……）
  const Ct = t.fighter && CLASSES[t.cls], bh = Ct && Ct.beforeHurt ? Ct.beforeHurt(t, a, h, opt) : null;
  if (bh && bh.block) return false;
  if (bh && bh.noStatus) t._noStatusT = game.t;
  const type = h.type || opt.type || (act && act.type) || a.dmgType || 'phys';
  const elem = h.elem || opt.elem || (act && act.elem) || a.atkElem || null;   // 没有指定属性时用武器附带属性
  const pvp = isPvp(a, t);
  // ---- 命中 / 回避 ----
  if (!h.sure && !h.grab) {
    const miss = clamp((t.evade || 0) + buffVal(t, 'evade') - (a.hitRate || 0), 0, 0.6);
    if (miss > 0 && Math.random() < miss) { fxText('MISS', t.x, t.y, t.z, { col: '#d8d8d8', size: 12, dur: 0.5 }); return false; }
  }
  const counter = !h.noCounterBonus && isCounter(t);
  const back = Math.sign(src.x - t.x || 1) !== t.face && t.st !== 'down' && t.st !== 'air' && t.st !== 'held';
  const crit = Math.random() < critOf(a, type) + (back ? COMBAT.backCrit : 0) + (h.critBonus || 0);
  const defV = Math.max(0, defOf(t, h.defType || type) || 0);
  let dmg = atkOf(a, type) * (h.dmg ?? 1) * (opt.mul || (act && !opt.proj ? act.dmgMul : 1) || 1) * (1 - defV / (defV + 1200)) * elemMul(a, t, elem) * rnd(0.95, 1.05);
  if (crit) dmg *= (a.critDmg || 1.5) + buffVal(a, 'critDmg');
  if (counter) dmg *= COMBAT.counterMul;
  if (pvp) dmg *= PVP.dmg * (h.pvp ?? (act && act.pvp) ?? 1);
  if (h.dmgKey) dmg *= 1 + 0.08 * Math.max(0, skLv(a, h.dmgKey) - 1);   // 普攻追加段按对应技能等级成长（里·鬼剑术、连突刺）
  dmg *= 1 + buffVal(a, 'dmg');                                      // 技能 BUFF / 被动的伤害加成
  if (a.dmgUp) dmg *= 1 + a.dmgUp;                                   // 额外伤害（装备词条）
  dmg *= (t.dmgTaken ?? 1) * (t.dmgTakenMul || 1) * (1 + buffVal(t, 'taken'));
  if (bh && bh.mul !== undefined) dmg *= bh.mul;
  if (t.status || a.status) dmg *= statusDmgMul(a, t);   // 异常状态：诅咒 / 睡眠唤醒（content/monsters/bestiary.js）
  // 格挡：正面的非抓取攻击被吸收大部分伤害，不硬直（被打会后退）
  const guard = t.st === 'act' && t.act && t.act.guard && !h.grab && !h.unblockable && Math.sign(src.x - t.x || 1) === t.face;
  if (guard) dmg *= 1 - t.act.guard;
  // 魔法护盾：一部分伤害改由 MP 承担
  const sh = buffVal(t, 'shield'); if (sh > 0 && t.mp > 0) { const take = Math.min(t.mp, dmg * sh); t.mp -= take; dmg -= take; }
  if (typeof absorbHit === 'function' && t.buffs) dmg = absorbHit(t, dmg, a, h);   // 吸收护盾（BUFF 上的 absorb 点数：协战师 / 小魔女的保护罩等，src/net/party.js 提供）
  dmg = Math.max(1, Math.round(dmg));
  if (pvp && PVP.hitCap) dmg = Math.min(dmg, Math.max(1, Math.round(t.hpMax * PVP.hitCap)));   // 决斗：单下封顶，大技能不能一击跨过两段保护
  t.hp -= dmg; t.lastDmg = dmg; t.lastHitBy = a;
  if (bh && bh.minHp !== undefined && t.hp < bh.minHp) t.hp = bh.minHp;
  const c = t.cmb; c.hits++; c.dmg += dmg;
  if (t.st === 'air' || t.z > 2) c.airDmg += dmg;
  if (t.st === 'down') c.downDmg += dmg;
  else if (t.st !== 'air' && t.z <= 2) c.standDmg = (c.standDmg || 0) + dmg;
  // ---- 表现 ----
  const hx = (Math.max(Math.min(t.x + t.w, src.x + (h.box ? h.box[1] : 20) * src.face), t.x - t.w) + t.x) / 2;
  const hz = clamp(src.z + (h.box ? (h.box[3] + h.box[4]) / 2 : 40), t.z + 10, t.z + t.hurtH() - 8);
  addNumber(dmg, t.x, t.y, t.z, { crit, player: t.team === 'p' && !t.summon });
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
  if (t.team === 'p' && !t.summon) game.onPlayerHurt(t, dmg, a);   // 召唤物挨打不算玩家被击
  if (h.onHit) h.onHit(a, t, dmg);
  const Ca = a.fighter && CLASSES[a.cls]; if (Ca && Ca.onHit) Ca.onHit(a, t, h, dmg, opt.proj ? null : act, opt);   // 职业命中钩子（狂暴出血、炫纹……）
  if (t.onDamaged) t.onDamaged(t, a, dmg, crit, h);
  if (t.status) statusOnHit(t, a, dmg, h);   // 感电追加伤害、睡眠被打醒
  if (elem === 'fire' && t.status && t.status.freeze) { delete t.status.freeze; if (t.st === 'hit') t.stun = Math.min(t.stun, 0.2); }   // 火属性攻击解冻
  // ---- 死亡 ----
  if (t.hp <= 0) {
    t.hp = 0;
    if (dmg > t.hpMax * 0.3 && !t.fighter) fxText('OVER KILL', t.x, t.y, t.z + 14, { col: '#ffe070', size: 13 });
    killEnt(t, a, h); return true;
  }
  if (guard) { t.vx = -t.face * (h.knock ?? 80) * 0.8; fxGuard(t); if (t.onHurt) t.onHurt(a, h); return true; }
  if ((bh && bh.noStun) || (statusRooted(t) && !h.grab)) t.flash = 0.1;   // 按霸体处理（钩子）/ 定身：只受伤，不击退、不浮空
  else react(a, t, h, src, counter, pvp);
  if (t.onHurt) t.onHurt(a, h);
  return true;
}
function react(a, t, h, src, counter, pvp) {
  if (t.st === 'held') return;                                      // 被抓住：只受伤不反应
  // 怪物蓄力招式：被打出足够伤害 → 破招
  if (t.act && t.act.breakable && a.team !== t.team) { t.breakDmg = (t.breakDmg || 0) + t.lastDmg; if (t.breakDmg > t.hpMax * t.act.breakable) { breakAct(t); return; } }
  if (h.grab) { if (canGrab(a, t, h)) { startGrab(a, t, h); return; } if (h.onGrabFail) { h.onGrabFail(a, t, h); return; } if (hasSA(t)) { t.flash = 0.1; return; } }
  else if (hasSA(t) && !h.throwHit) { t.flash = 0.1; return; }      // 霸体：照常受伤，不硬直不浮空（抓取技的投掷无视霸体）
  t.interrupt();
  const dir = h.radial ? Math.sign(t.x - src.x || src.face) : h.pull ? -src.face : src.face;
  const kb = (h.knock ?? 80) / Math.max(0.5, t.weight), c = t.cmb;
  const airborne = t.st === 'air' || t.z > 2, sw = Math.sqrt(t.weight);
  // ---- 倒地追击 ----
  if (t.st === 'down') {
    t.downHits++; c.down++;
    const prot = pvp ? c.downDmg >= t.hpMax * PVP.downProt : !t.fighter && t.downHits > COMBAT.pveOtgMax;
    if (prot) { t.startGetup(); t.invul = Math.max(t.invul, pvp ? PVP.getupInvul : 0.7); fxText(pvp ? '倒地保护' : '起身', t.x, t.y, t.z, { col: '#9fe8ff', size: 10 }); return; }
    if (!h.launch) {
      const heavy = pvp && typeof duelAirLv === 'function' && duelAirLv(t) >= 2;   // 二段已经砸过地：扫地只托一点点
      const pop = heavy ? JUGGLE.pvpSweepPop : (pvp ? JUGGLE.pvpOtgPop : (h.otgLift ?? JUGGLE.otgLift));
      t.vz = (heavy ? pop : (h.otgLift ?? pop)) / sw; t.z = 1; t.vx = dir * kb * 0.3; t.setState('air'); t.bounced = true; return;
    }
  }
  const pl = airProtLv(t), pk = pl ? Math.pow(JUGGLE.pvpLaunch, pl) : 1;
  if (pvp && pl > (t._plShown || 0)) { t._plShown = pl; if (pl === 1) fxText('浮空保护', t.x, t.y, t.z + 30, { col: '#8ac8ff', size: 10 }); fxAura(t, '#6ab0ff', 0.35); }
  if (pvp && pl >= JUGGLE.pvpRecover && (airborne || t.st === 'down')) { airRecover(t); return; }   // 保护到顶：强制空中受身
  if (h.launch || airborne || t.st === 'down') {
    const res = Math.pow(Math.max(0.5, t.weight), JUGGLE.weightExp) / (t.boss ? JUGGLE.bossRes : 1);
    const late = !pvp && t.fighter && game.pvp && (c.airT || 0) > JUGGLE.duelSumLateT;   // 决斗里被召唤物打、浮空太久：挑不高、接不住（刷图没有时限）
    let vz;
    if (h.launch) {   // 挑空 / 追加浮空：同一轮连击里逐次递减；目标已经在更快地上升就不减速
      vz = h.launch * Math.max(JUGGLE.relaunchMin, Math.pow(JUGGLE.relaunch, c.launch || 0)) * pk / res * (late ? JUGGLE.duelSumLate : 1);
      if (pvp) vz *= JUGGLE.pvpFloatK;   // 压到站立判定打得到的高度；追加浮空仍一次比一次低
      if (airborne && t.vz > vz) vz = t.vz;
      c.launch = (c.launch || 0) + 1;
    } else {          // 空中普通受击：下落中接住（托一下），上升中基本不影响
      const k = late ? 0 : Math.max(JUGGLE.airMin, Math.pow(JUGGLE.airDecay, c.air));   // 接住的力度：越连越弱
      const lift = (h.airLift ?? JUGGLE.airLift) * k * pk / res;
      vz = t.vz > 0 ? Math.max(t.vz * JUGGLE.riseKeep, lift) : t.vz + (lift - t.vz) * k;   // 下落中：按力度把下落速度拉回托力（连得越久越接不住）
    }
    if (h.spike) vz = -h.spike;                                       // 向下砸地
    t.vz = vz; t.z = Math.max(t.z, 1); t.vx = dir * kb * (airborne ? 0.6 : 0.8); c.air++; t.juggle++; t.bouncing = false;
    if (!airborne) t.bounced = false;
    if (h.bounce) t.bounceNext = h.bounce;
    t.setState('air'); t.play(t.clipOr(vz > 80 ? 'airUp' : 'air', 'air'), true);
  } else if (h.down) {
    t.vz = (h.downLift ?? 230) / sw; t.z = 1; t.vx = dir * kb; t.setState('air'); t.bounced = false; c.air++; t.juggle++;
    if (h.bounce) t.bounceNext = h.bounce;
    t.play(t.clipOr('airUp', 'air'), true);
  } else if (pvp && (c.standDmg || 0) >= t.hpMax * PVP.standProt) {   // 平推保护：强制击倒
    c.standDmg = 0; t.vz = 200; t.z = 1; t.vx = dir * 160; t.setState('air'); t.bounced = true; c.air++;
    fxText('平推保护', t.x, t.y, t.z, { col: '#ff9a9a', size: 10 });
  } else {
    const stun = (h.stun ?? 0.32) * stunMul(a, t) * (counter ? COMBAT.counterStun : 1) * (pvp ? PVP.stun * Math.max(PVP.stunMin, 1 - PVP.stunDecay * (c.hits || 0)) : 1) / sw;
    t.setState('hit'); t.stun = stun; t.vx = dir * kb;
    t.hitHeavy = !!h.heavy || stun > 0.46 || kb > 190;
    t.play(t.hitHeavy ? t.clipOr('hit2', 'hit') : 'hit', true);
  }
}
// 决斗浮空保护到顶：强制空中受身——马上无敌、不再被托起，落地直接受身站起（不倒地、不能追击）
function airRecover(t) {
  if (t.recoverLand) return;
  t.recoverLand = true; t.invul = Math.max(t.invul, PVP.techInvul + 0.4); t.vz = Math.min(t.vz, 60); t.bounceNext = 0; t.bounced = true;
  if (t.st === 'down') { t.recoverLand = false; t.startGetup(true); }
  fxText('受身', t.x, t.y, t.z + 30, { col: '#9fe8ff', size: 11 }); fxAura(t, '#9fe8ff', 0.5);
}
function killEnt(t, a, h) {
  if (t.fighter && !t.dead && !t.ghost && lifeSave(t)) return;   // 免死 BUFF（life）：不死、回复一部分 HP
  t.interrupt(); if (t.heldBy) { ungrab(t.heldBy, t); t.heldBy = null; } t.thrown = null;
  t.dead = true; t.setState('dead'); t.deadT = 0; t.act = null;
  t.vz = Math.max(t.vz, t.z > 2 ? 120 : 260); t.vx = (a ? a.face : -t.face) * 120; t.z = Math.max(t.z, 1);
  t.hitstop = 0.12;
  if (t.onDeath) t.onDeath(a);
  game.onKill(t, a);
}

/* ---- 抓取：抓取判定（hit.grab）可以抓住霸体目标；体型过大（noGrab / 领主）抓不住 ----
   抓住后目标进入 held 状态，位置跟随抓取者（act.hold(e, t, i) 可自定义，i = 第几个目标），抓取者的动作结束 / 被打断即释放；
   throwGrab(e, hit) 用一次攻击把目标扔出（必中，带正常的受击反应）
   格斗家组扩展（B0-E，docs/CLASS_PLAN_FIGHTER.md §2.4；字段不写 = 原来的行为）：
     h.grabInvul         抓住期间施放者无敌（官方：格斗家的抓取技抓住时自己无敌）
     h.grabMax           这一下最多抓几个（默认 1）。多目标：第一个是 a.grabbed（老代码照旧能用），其余在 a.grabMore；grabsOf(a) 取全部
     h.grabRange         抓住第一个之后，把周围 grabRange 像素内能抓的敌人一起卷过来（范围抓取；没写 grabMax 时最多 5 个）
     h.grabDown          能抓倒地的目标（也能打到倒地目标）
     h.grabAir           'only' = 只抓空中的目标（空中投）；false = 只抓地面上的；不写 = 不限（原来的行为）
     h.onGrabFail(a,t,h) 打中了但抓不住（领主 / noGrab / 太重 / 刚被抓过）时调用，之后不走普通受击反应（柔道家 抓轰炮：冲击波 + addStatus(t, 'hold')）
   throwGrab 只扔主目标（其余的顺延成主目标），throwAll 全部扔出；throwArc(a, t, o) 把人当投射物扔出去（见下方） */
function canGrab(a, t, h) {
  if (t.noGrab || (t.boss && !h.grabBoss) || t.grabProt > 0 || t.heldBy || t.dead || t.weight > (h.grabMaxW ?? 2.2)) return false;
  if (t.st === 'down' && !h.grabDown) return false;
  if (h.grabAir !== undefined) { const air = t.st === 'air' || t.z > 2; if (h.grabAir === 'only' ? !air : h.grabAir === false && air) return false; }
  return true;
}
const grabCap = h => h.grabMax || (h.grabRange ? 5 : 1);
const grabFull = (a, h) => !!a.grabbed && 1 + (a.grabMore ? a.grabMore.length : 0) >= grabCap(h);
const holdsGrab = (a, t) => a.grabbed === t || !!(a.grabMore && a.grabMore.includes(t));
function grabsOf(a) { return a.grabbed ? (a.grabMore && a.grabMore.length ? [a.grabbed, ...a.grabMore] : [a.grabbed]) : []; }
// 从抓取者的抓取列表里去掉 t（主目标去掉后，其余的顺延成主目标）
function ungrab(a, t) {
  if (!a) return;
  if (a.grabMore) { const i = a.grabMore.indexOf(t); if (i >= 0) a.grabMore.splice(i, 1); }
  if (a.grabbed === t) a.grabbed = a.grabMore && a.grabMore.length ? a.grabMore.shift() : null;
}
function startGrab(a, t, h) {
  t.interrupt(); t.setState('held'); t.heldBy = a; t.vx = t.vy = t.vz = 0; t.heldT = 0; t.rot = 0; t.thrown = null; t.play(t.clipOr('held', 'hit2', 'hit'), true);
  const more = !!(a.grabbed && a.grabbed !== t && h && grabCap(h) > 1);   // 多目标：已经抓着别人 → 追加
  if (more) (a.grabMore || (a.grabMore = [])).push(t); else a.grabbed = t;
  t.face = -a.face; t.hitHeavy = true;
  if (h && h.grabInvul && a.act) a.act.grabInvul = true;
  sfx.hit('blunt', false); fxText('抓取', t.x, t.y, t.z + 10, { col: '#ffcf6a', size: 10, dur: 0.5 });
  if (a.act && a.act.onGrab) a.act.onGrab(a, t);
  if (!more && h && h.grabRange) grabSweep(a, t, h);
  holdGrabbed(a);
}
// 范围抓取：离抓取者 grabRange 以内（纵深减半）能抓的敌人，由近到远卷过来
function grabSweep(a, t0, h) {
  const cap = grabCap(h), sub = { ...h, grabRange: 0, grabMax: cap };
  const L = ents.filter(t => t !== t0 && foe(a, t) && t.invul <= 0 && canGrab(a, t, h) && Math.abs(t.x - a.x) <= h.grabRange && Math.abs(t.y - a.y) <= h.grabRange * 0.5)
    .sort((p, q) => Math.abs(p.x - a.x) - Math.abs(q.x - a.x));
  for (const t of L) { if (grabFull(a, sub)) break; startGrab(a, t, sub); }
}
function holdGrabbed(a) {
  let t = a.grabbed; while (t && t.heldBy !== a) { ungrab(a, t); t = a.grabbed; }
  if (!t) return;
  if (a.act && a.act.grabInvul) a.invul = Math.max(a.invul, 0.05);   // 抓住期间无敌（h.grabInvul）
  const L = a.grabMore;
  if (a.act && a.act.hold) { a.act.hold(a, t, 0); if (L) L.forEach((x, i) => { if (x.heldBy === a) a.act.hold(a, x, i + 1); }); return; }
  const g = a.act && a.act.grabAt || GRAB_AT;
  t.x = a.x + a.face * g[0]; t.y = a.y + 0.5; t.z = Math.max(0, a.z + g[1]); t.face = -a.face;
  if (L) L.forEach((x, i) => { if (x.heldBy !== a) return; x.x = t.x + a.face * 12 * (i + 1); x.y = clamp(t.y + (i % 2 ? 7 : -7), 4, DEPTH - 4); x.z = t.z; x.face = -a.face; });   // 其余目标挤在主目标后面
}
const GRAB_AT = [34, 18];
function updateHeld(t, dt) {
  t.heldT += dt;
  const a = t.heldBy;
  if (!a || a.dead || !holdsGrab(a, t) || a.st !== 'act' || t.heldT > 4) releaseHeld(t);
}
function releaseHeld(t) {
  const a = t.heldBy; t.heldBy = null; t.heldClip = null; ungrab(a, t);
  t.grabProt = isPvp(a, t) ? PVP.grabProt : 0.3;
  if (t.z > 2) { t.setState('air'); t.vz = 0; t.bounced = false; } else { t.setState('hit'); t.stun = 0.15; }
}
function dropGrab(a) {
  const L = a.grabMore, t = a.grabbed; a.grabMore = null; a.grabbed = null;
  if (t && t.heldBy === a) releaseHeld(t);
  if (L) for (const x of L) if (x.heldBy === a) releaseHeld(x);
}
function throwGrab(a, h) {
  const t = a.grabbed; if (!t) return null;
  ungrab(a, t); t.heldBy = null; t.heldClip = null; t.setState('hit'); t.grabProt = isPvp(a, t) ? PVP.grabProt : 0.3;
  applyHit(a, t, { sure: true, noCounterBonus: true, throwHit: true, ...h }, { proj: !!h.proj });
  return t;
}
// 多目标：全部扔出（每个目标同一个攻击）
function throwAll(a, h) { const out = []; for (let n = 0; a.grabbed && n < 32; n++) { const t = throwGrab(a, h); if (t) out.push(t); } return out; }
/* ---- 投掷：throwArc(a, t, o) 把目标当投射物扔出去（格斗家 背摔 / 柔道家 / 街霸，B0-E） ----
   o = { dx 水平距离（默认 180）, dy 纵深位移（0）, h 弧线最高点（90）, dur 飞行秒数（0.45）, dir 方向（默认 a.face；-a.face = 往身后摔，方向键选摔向由技能自己算）,
         other 路上撞到别的敌人时对它的攻击（applyHit 的 h，每个敌人一次；默认 { dmg: 0.5, down: true, knock: 120 }；false = 不撞人），
         hit 落地时对被扔的人的攻击（默认 { dmg: 0.2, spike: 300 } 砸地倒下；写 bounce: k 强制弹地；false = 只是落地），
         onHitOther(a, t, o2) / onLand(a, t) 额外回调 }
   被扔的人：先从抓取里放开，飞行中是浮空状态、位置按弧线走（不受重力 / AI，撞墙停在墙边），落地结算 hit；返回 t。
   组队：队员扔主机的怪（傀儡）目前只在本地飞（主机那边照常放开），联机同步留给 B9 */
function throwArc(a, t, o = {}) {
  if (!t || t.dead) return null;
  if (t.heldBy) releaseHeld(t);
  const dir = o.dir ?? a.face, R = game.room;
  let x1 = t.x + dir * (o.dx ?? 180); if (R) x1 = clamp(x1, R.x0 + t.w, R.x1 - t.w);
  t.interrupt(); t.setState('air'); t.vx = t.vy = t.vz = 0; t.bounced = true; t.bouncing = false;
  t.thrown = { src: a, dir, x0: t.x, y0: t.y, z0: t.z, x1, y1: clamp(t.y + (o.dy || 0), 4, DEPTH - 4), h: o.h ?? 90, dur: Math.max(0.05, o.dur ?? 0.45), k: 0, hitSet: new Set(), o };
  t.play(t.clipOr('air'), true);
  return t;
}
// 被扔出去的目标每帧（entity.update 调用）：沿弧线移动、撞人、落地
function updateThrown(t, dt) {
  const A = t.thrown, o = A.o, a = A.src;
  A.k = Math.min(1, A.k + dt / A.dur); const k = A.k;
  t.x = A.x0 + (A.x1 - A.x0) * k; t.y = A.y0 + (A.y1 - A.y0) * k; t.z = Math.max(0, A.z0 * (1 - k) + 4 * A.h * k * (1 - k));
  t.rot = -A.dir * 0.5 * Math.sin(k * Math.PI);
  if (o.other !== false) for (const e of ents) {   // 路上撞到的敌人（每个一次）
    if (e === t || A.hitSet.has(e) || !foe(a, e) || e.invul > 0 || e.st === 'down' || e.heldBy || e.thrown) continue;
    if (Math.abs(e.x - t.x) > e.w + t.w || Math.abs(e.y - t.y) > e.d + t.d || t.z > e.z + e.hurtH() || t.z + t.h * 0.55 < e.z) continue;
    A.hitSet.add(e); applyHit(a, e, { sure: true, dmg: 0.5, down: true, knock: 120, hs: 0.05, radial: true, ...(o.other || {}) }, { proj: true, src: t });   // radial：从飞过来的人身上往外撞开
    if (o.onHitOther) o.onHitOther(a, t, e);
  }
  if (k < 1 || t.thrown !== A) return;
  t.thrown = null; t.z = 0.5; t.vz = -60; t.rot = 0;
  if (o.hit !== false) applyHit(a, t, { sure: true, noCounterBonus: true, throwHit: true, dmg: 0.2, spike: 300, hs: 0.08, snd: 'blunt', shake: 3, ...(o.hit || {}) }, { proj: true, src: { x: t.x - A.dir * 10, y: t.y, z: 0, face: A.dir } });   // 击退方向 = 扔的方向
  fxDust(t.x, t.y, 6, 18);
  if (o.onLand) o.onLand(a, t);
}
