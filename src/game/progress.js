/* =====================================================================
   17. 成长：经验 / 等级 / SP / 四维与属性计算（recalcStats）
   属性语义见协作板“战斗与动作 第 4 节”：面板值写到玩家实体上，伤害结算读取
   ===================================================================== */
// 满级：2026-09-28 从 30 提到 60（官方 1~100 压缩进 1~30 的老内容不动，31~60 是官方 60 版本区域的新成长段；觉醒仍是 21 / 26 / 30）
const MAX_LVL = 60, OLD_CAP = 30;
// 升级所需经验（2026-09-27 主线程拍板 ×1.8：每个地下城约打 1.5~2 次，Lv1→20 约 15 次，见 test/econ.mjs）
const EXP_CURVE_MUL = 1.8, EXP_HI_POW = 1.25;
const expNeedLo = lv => Math.round((200 * Math.pow(lv, 1.85) + 300) * EXP_CURVE_MUL);
// Lv30 以后：从 Lv30 的值接着按 (lv / 30)^EXP_HI_POW 平滑增长（31~60 约是 1~30 的 1.5~2 倍时间，推算见 docs/GEAR.md「等级段」）
const expNeed = lv => lv < OLD_CAP ? expNeedLo(lv) : Math.round(expNeedLo(OLD_CAP) * Math.pow(lv / OLD_CAP, EXP_HI_POW));
// 技能等级上限随满级继续涨（SKILLS_OFFICIAL_common.md 的 lvStep 规则往 Lv60 延伸）：普通主动技能（maxLv ≥ 5，不含被动 / BUFF / 觉醒）
// Lv30 以后每 3 级上限 +1（Lv60 时 +10）；第 n 级（n > maxLv）的学习等级 = max(lvReq + (n−1)×lvStep, 30 + 3×(n − maxLv))。
// 决斗按固定 Lv30 + S.maxLv（fighter_ai.js），不受影响
const SKILL_HI_STEP = 3;
const skillGrows = S => !!S && (S.maxLv || 1) >= 5 && !S.passive && !S.buff && !S.awaken;
function skillLvReq(S, lv) {
  const base = (S.lvReq || 1) + (lv > 1 && S.lvStep ? (lv - 1) * S.lvStep : 0), m = S.maxLv || 1;
  return lv > m && skillGrows(S) ? Math.max(base, OLD_CAP + SKILL_HI_STEP * (lv - m)) : base;
}
function skillMaxLv(S) {
  const m = S.maxLv || 1; if (!skillGrows(S)) return m;
  let n = m; while (n < m + (MAX_LVL - OLD_CAP) / SKILL_HI_STEP && skillLvReq(S, n + 1) <= MAX_LVL) n++;
  return n;
}
function gainExp(n) {
  if (game.lvl >= MAX_LVL) return;
  const p = game.player;
  game.exp += Math.round(n * (1 + (p && p.expUp || 0)));
  while (game.exp >= expNeed(game.lvl) && game.lvl < MAX_LVL) { game.exp -= expNeed(game.lvl); game.lvl++; onLevelUp(); }
}
function onLevelUp() {
  const p = game.player;
  game.sp = (game.sp || 0) + 28 + game.lvl;   // 原作：第 n 级获得 28+n 点 SP
  sfx.levelUp();
  if (p) { recalcStats(p); p.hp = p.hpMax; p.mp = p.mpMax;
    (fxAura(p, '#ffd23a', 1.6), fxBurst(p.x, p.y, p.z + 60, 200, '#ffd23a'));
  }
  toastMsg(`等级提升到 Lv.${game.lvl}！获得 SP ${28 + game.lvl}${game.lvl >= MAX_LVL ? '（已达到满级）' : ''}`, '#ffe070');
  bus.emit('levelUp', { lvl: game.lvl });
}
// 勇者加成：整体降低难度（2026-09-27 调整）
const HERO_BONUS = { hp: 1.6, mp: 1.25, def: 1.3, atk: 1.2, spd: 1.12 };
/* ---- 四维：职业初始值与每级成长（官方初始：鬼剑士 力7 智4 体7 精4、神枪手 6/5/6/5、魔法师 4/8/4/7、格斗家 8/4/7/4、圣职者 6/4/6/6） ---- */
const CLASS_BASE4 = {
  sword: { str: [7, 2.2], int: [4, 1.2], vit: [7, 2.0], spr: [4, 1.2], mdefK: 0.8 },
  gun: { str: [6, 2.0], int: [5, 1.5], vit: [6, 1.8], spr: [5, 1.5], mdefK: 0.9 },
  mage: { str: [4, 1.1], int: [8, 1.9], vit: [4, 1.2], spr: [7, 1.8], mdefK: 1.15 },
  fighter: { str: [8, 2.3], int: [4, 1.1], vit: [7, 2.0], spr: [4, 1.2], mdefK: 0.85 },
  priest: { str: [6, 2.0], int: [4, 1.2], vit: [6, 2.0], spr: [6, 1.6], mdefK: 1.0 },
};
// 转职后的四维成长倍率（CLASSES[cls].jobs[job].growth 有就以它为准）
const JOB_GROWTH = {
  blade: { str: 1.06, spr: 1.02 }, berserker: { str: 1.1, vit: 1.08 },
  ranger: { str: 1.06, int: 1.03 }, launcher: { str: 1.08, vit: 1.06 },
  elemental: { int: 1.1, spr: 1.05 }, battlemage: { str: 1.1, int: 1.04, vit: 1.04 },
};
/* ---- 防具精通（官方）：转职前 鬼剑士重甲 / 神枪手皮甲 / 魔法师布甲 / 格斗家轻甲 / 圣职者重甲 ---- */
const CLASS_ARMOR = { sword: 'heavy', gun: 'leather', mage: 'cloth', fighter: 'light', priest: 'heavy' };
// 官方资料站：剑魂轻甲、狂战士重甲、鬼泣布甲、阿修罗板甲；漫游枪手皮甲、枪炮师重甲、机械师布甲、弹药专家皮甲；元素师 / 召唤师布甲、战斗法师 / 魔道学者皮甲
const JOB_ARMOR = { blade: 'light', berserker: 'heavy', soulbender: 'cloth', asura: 'plate', ranger: 'leather', launcher: 'heavy', mechanic: 'cloth', spitfire: 'leather', elemental: 'cloth', summoner: 'cloth', battlemage: 'leather', witch: 'leather' };
function masteryOf(cls, job) {
  const J = job && CLASSES[cls] && CLASSES[cls].jobs && CLASSES[cls].jobs[job];
  return (J && J.armor) || (job && JOB_ARMOR[job]) || CLASS_ARMOR[cls] || 'light';
}
// 每件精通防具的加成（官方精通：布甲 MP / 智力 / 施放，皮甲 攻速 / 物暴，轻甲 力量 / 硬直，重甲 力量 / 物防，板甲 物防 / HP；L = 这件防具的等级）
const MASTERY_BONUS = {
  cloth: L => ({ int: Math.round(2 + L * 0.3), mpPct: 0.02, cspd: 0.012, mcrit: 0.004 }),
  leather: L => ({ aspd: 0.012, crit: 0.008, mcrit: 0.008, str: Math.round(1 + L * 0.2), int: Math.round(1 + L * 0.2) }),
  light: L => ({ str: Math.round(2 + L * 0.3), int: Math.round(1 + L * 0.2), hardness: 6, aspd: 0.006, mspd: 0.006 }),
  heavy: L => ({ str: Math.round(2 + L * 0.3), defPct: 0.02, hpPct: 0.01 }),
  plate: L => ({ defPct: 0.03, hpPct: 0.015, hardness: 6, str: Math.round(1 + L * 0.2) }),
};
// 官方：不精通的职业穿重甲 / 板甲，攻速、施放速度、MP 恢复会降低（每件）
const HEAVY_PENALTY = { aspd: -0.01, cspd: -0.01, mpRegen: -0.03 };
function classBase4(cls, L, job) {
  const B = CLASS_BASE4[cls] || CLASS_BASE4.sword, J = job && CLASSES[cls] && CLASSES[cls].jobs && CLASSES[cls].jobs[job];
  const G = (J && J.growth) || (job && JOB_GROWTH[job]) || {}, o = {};
  for (const k of ['str', 'int', 'vit', 'spr']) o[k] = Math.round((B[k][0] + B[k][1] * (L - 1)) * (G[k] || 1));
  return o;
}
// 身上装备的属性合计（耐久为 0 的装备不算），含强化、特效词条、精通、套装、称号
function equipTotals(cls = game.player ? game.player.cls : 'sword', job = game.job) {
  inv.ensure();
  const t = {}, add = (k, v) => { if (v) t[k] = (t[k] || 0) + v; };
  const mastery = masteryOf(cls, job), sets = {};
  let masteryN = 0;
  for (const s of SLOTS) {
    const it = inv.equip[s]; if (!it || it.slot !== s || !itemActive(it)) continue;   // 部位不对的（别的代码直接往 equip 里塞的）不算
    for (const k in it.st) add(k, it.st[k]);
    const e = enhStats(it); for (const k in e) add(k, e[k]);
    const x = gearExtraStats(it); for (const k in x) add(k, x[k]);   // 锻造 + 宝珠（game/gear.js）
    if (it.fx) for (const k in it.fx) if (typeof it.fx[k] === 'number') add(k, it.fx[k]);
    if (it.fx && it.fx.atkElem) t.atkElem = it.fx.atkElem;
    if (it.atype && ARMOR_SLOTS.includes(s)) {
      if (it.atype === mastery) { masteryN++; const M = MASTERY_BONUS[mastery](it.lvl); for (const k in M) add(k, M[k]); }
      else if (it.atype === 'heavy' || it.atype === 'plate') for (const k in HEAVY_PENALTY) add(k, HEAVY_PENALTY[k]);
    }
    if (it.set) sets[it.set] = (sets[it.set] || 0) + 1;
  }
  const activeSets = [];
  for (const id in sets) {
    const S = SETS[id]; if (!S) continue;
    const on = [];
    for (const n in S.bonus) if (sets[id] >= +n) { on.push(+n); const B = S.bonus[n]; for (const k in B.st || {}) add(k, B.st[k]); }
    activeSets.push({ id, n: sets[id], on });
  }
  const cb = codexBonusStats(); for (const k in cb) add(k, cb[k]);   // 装备图鉴的收集加成
  if (t.allStat) for (const k of ['str', 'int', 'vit', 'spr']) add(k, t.allStat);
  return { t, mastery, masteryN, sets: activeSets };
}
// 基础属性随等级成长 + 装备加成 → 面板属性
function recalcStats(p) {
  if (!p) return;
  const L = game.lvl, C = CLASSES[p.cls], B = CLASS_BASE4[p.cls] || CLASS_BASE4.sword, HB = HERO_BONUS;
  const E = equipTotals(p.cls, game.job), eq = E.t, g = k => eq[k] || 0;
  const base4 = classBase4(p.cls, L, game.job);
  const str = base4.str + g('str'), int = base4.int + g('int'), vit = base4.vit + g('vit'), spr = base4.spr + g('spr');
  const gearVit = vit - base4.vit, gearSpr = spr - base4.spr;
  const w = inv.equip.weapon && itemActive(inv.equip.weapon) ? inv.equip.weapon : null, WT = (w && WTYPES[w.wtype]) || {};
  const J = game.job && C.jobs && C.jobs[game.job];
  const dmgType = (J && J.dmgType) || C.dmgType || (p.cls === 'mage' ? 'mag' : 'phys');   // 转职可以改伤害类型（机械师：神枪手里的魔法职业）
  const lvAtk = C.atk0 + C.atkPer * (L - 1), atkPct = 1 + g('atkPct');
  const atk = (lvAtk * (dmgType === 'phys' ? 1 : 0.55) + g('atk')) * (1 + str * 0.004) * atkPct * HB.atk;
  const matk = (lvAtk * (dmgType === 'mag' ? 1 : 0.55) + g('matk')) * (1 + int * 0.004) * atkPct * HB.atk;
  const indep = (lvAtk + g('indep')) * (1 + Math.max(str, int) * 0.004) * atkPct * HB.atk;
  const hpMax = Math.round((C.hp0 + C.hpPer * (L - 1) + g('hp') + gearVit * 9) * (1 + g('hpPct')) * HB.hp);
  const mpMax = Math.round((C.mp0 + C.mpPer * (L - 1) + g('mp') + gearSpr * 7) * (1 + g('mpPct')) * HB.mp);
  const lvDef = C.def0 + C.defPer * (L - 1);
  const def = (lvDef + g('def') + gearVit * 3) * (1 + g('defPct')) * HB.def;
  const mdef = (lvDef * (B.mdefK || 1) + g('mdef') + gearSpr * 3) * (1 + g('defPct')) * HB.def;
  const hf = p.hpMax ? p.hp / p.hpMax : 1, mf = p.mpMax ? p.mp / p.mpMax : 1;
  // 写到实体上（语义见协作板）
  Object.assign(p, { str, int, vit, spr, lvl: L });
  p.baseStats = { atk, matk, indep, speed: C.speed * HB.spd, runSpeed: C.runSpeed * HB.spd };
  p.matk = matk; p.indep = indep;
  p.hpMax = hpMax; p.mpMax = mpMax; p.hp = Math.round(hpMax * hf); p.mp = Math.round(mpMax * mf);
  p.def = def; p.mdef = mdef;
  p.crit = p.baseCrit = C.crit + g('crit') + (WT.crit || 0);
  p.mcrit = p.baseMcrit = C.crit + g('mcrit') + (WT.mcrit || 0);
  p.critDmg = 1.5 + g('critDmg');
  p.aspd = clamp(1 + (WT.aspd || 0) + g('aspd'), 0.5, 2.5); p.cspd = clamp(1 + (WT.cspd || 0) + g('cspd'), 0.5, 2.5); p.mspd = clamp(1 + (WT.mspd || 0) + g('mspd'), 0.5, 2.5);
  p.hitRate = (WT.hit || 0) + g('hit'); p.evade = Math.min(0.5, g('evade'));
  const ea = g('elemAll'), ra = g('resAll');
  p.elem = { fire: g('fire') + ea, ice: g('ice') + ea, light: g('light') + ea, dark: g('dark') + ea };
  p.res = { fire: g('rfire') + ra, ice: g('rice') + ra, light: g('rlight') + ra, dark: g('rdark') + ra };
  p.hardness = g('hardness') + (WT.hardness || 0); p.stagger = g('stagger') + (WT.stagger || 0);
  p.atkElem = WT.elem || eq.atkElem || null;
  p.dmgUp = g('dmgUp'); p.dmgTaken = 1 - Math.min(0.5, g('dmgReduce'));
  p.cdMul = 1 - Math.min(0.4, g('cdr')); p.mpRegen = 1 + g('mpRegen');
  p.killHeal = g('killHeal'); p.killMp = g('killMp'); p.goldUp = g('goldUp'); p.expUp = g('expUp');
  p.mastery = E.mastery; p.masteryN = E.masteryN; p.sets = E.sets; p.gearProcs = gearProcList(E);   // 装备特效（game/gear_fx.js）
  // 冒险失败后的虚弱：攻击 / 防御 / HP 上限 -25%
  p.weak = !!(save.data && save.data.weak > Date.now());
  if (p.weak) { for (const k of ['atk', 'matk', 'indep']) p.baseStats[k] *= 0.75; p.matk *= 0.75; p.indep *= 0.75; p.def *= 0.75; p.mdef *= 0.75; p.hpMax = Math.round(p.hpMax * 0.75); p.hp = Math.min(p.hp, p.hpMax); }
  p.stats = { str, int, vit, spr, atk: p.baseStats.atk, matk: p.matk, indep: p.indep, def: p.def, mdef: p.mdef, crit: p.crit, mcrit: p.mcrit, critDmg: p.critDmg, aspd: p.aspd, cspd: p.cspd, mspd: p.mspd,
    hitRate: p.hitRate, evade: p.evade, elem: p.elem, res: p.res, hardness: p.hardness, stagger: p.stagger, hpMax: p.hpMax, mpMax: p.mpMax, dmgUp: p.dmgUp, dmgTaken: p.dmgTaken, cdr: 1 - p.cdMul, dmgType, weak: p.weak };
  applyBuffs(p);
}
// 击杀回复（装备词条“击杀敌人时恢复 HP / MP”）
bus.on('kill', () => { const p = game.player; if (!p || p.dead) return; if (p.killHeal) p.hp = Math.min(p.hpMax, p.hp + Math.round(p.hpMax * p.killHeal)); if (p.killMp) p.mp = Math.min(p.mpMax, p.mp + Math.round(p.mpMax * p.killMp)); });
