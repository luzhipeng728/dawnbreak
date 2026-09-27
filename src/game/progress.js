/* =====================================================================
   17. 成长：经验 / 等级 / SP / 属性计算
   ===================================================================== */
const MAX_LVL = 30;
const expNeed = lv => Math.round(200 * Math.pow(lv, 1.85) + 300);
function gainExp(n) {
  if (game.lvl >= MAX_LVL) return;
  game.exp += Math.round(n);
  while (game.exp >= expNeed(game.lvl) && game.lvl < MAX_LVL) { game.exp -= expNeed(game.lvl); game.lvl++; onLevelUp(); }
}
function onLevelUp() {
  const p = game.player;
  game.sp = (game.sp || 0) + 28 + game.lvl;   // 原作：第 n 级获得 28+n 点 SP
  sfx.levelUp();
  if (p) { recalcStats(p); p.hp = p.hpMax; p.mp = p.mpMax;
    (fxAura(p, '#ffd23a', 1.6), fxBurst(p.x, p.y, p.z + 60, 200, '#ffd23a'));
  }
  toastMsg(`等级提升到 Lv.${game.lvl}！获得 SP ${28 + game.lvl}`, '#ffe070');
}
// 勇者加成：整体降低难度（2026-09-27 调整）
const HERO_BONUS = { hp: 1.6, mp: 1.25, def: 1.3, atk: 1.2, spd: 1.12 };
// 基础属性随等级成长 + 装备加成
function recalcStats(p) {
  const L = game.lvl, C = CLASSES[p.cls];
  const eq = inv.equipStats();
  const str = C.str0 + C.strPer * (L - 1) + (eq.str || 0);
  const baseAtk = C.atk0 + C.atkPer * (L - 1) + eq.atk;
  const HB = HERO_BONUS;
  p.baseStats = { atk: baseAtk * (1 + str * 0.004) * HB.atk, speed: C.speed * (1 + (eq.spd || 0)) * HB.spd, runSpeed: C.runSpeed * (1 + (eq.spd || 0)) * HB.spd };
  const hpMax = Math.round((C.hp0 + C.hpPer * (L - 1) + eq.hp) * HB.hp), mpMax = Math.round((C.mp0 + C.mpPer * (L - 1) + eq.mp) * HB.mp);
  const hf = p.hpMax ? p.hp / p.hpMax : 1, mf = p.mpMax ? p.mp / p.mpMax : 1;
  p.hpMax = hpMax; p.mpMax = mpMax; p.hp = Math.round(hpMax * hf); p.mp = Math.round(mpMax * mf);
  p.def = (C.def0 + C.defPer * (L - 1) + eq.def) * HB.def; p.crit = p.baseCrit = C.crit + (eq.crit || 0); p.critDmg = 1.5 + (eq.critDmg || 0); p.lvl = L;
  p.cdMul = 1 - Math.min(0.4, eq.cdr || 0); p.mpRegen = 1 + (eq.mpRegen || 0);
  // 冒险失败后的虚弱：攻击 / 防御 / HP 上限 -25%
  p.weak = !!(save.data && save.data.weak > Date.now());
  if (p.weak) { p.baseStats.atk *= 0.75; p.def *= 0.75; p.hpMax = Math.round(p.hpMax * 0.75); p.hp = Math.min(p.hp, p.hpMax); }
  applyBuffs(p);
}
