// 「同级最好的一套史诗」搜索（页面里跑）：test/gear60.mjs power 和 test/region.mjs 的 GEAR=epic 共用
// 用法：await page.evaluate(BEST_KIT_SRC); 之后页面里有 g60BestKit(L) → { best, base, baseKit, bestKit, cand }（对 game.player 当前职业 / 转职，game.lvl 要先设成 L）
//   综合分 = 输出^0.7 × 生存^0.3（gearMetrics，按职业 / 转职的伤害类型：魔法师、气功师、街霸 = 魔法）；对照 = 全身同级稀有（T = L 向下取整到 5）
//   候选 = 等级在 (L-12, L] 的史诗（武器只要本职业的）；逐部位爬山 + 整套试穿，每把候选武器各起步一次（先锁住武器爬一轮，再全放开爬一轮）
export const BEST_KIT_SRC = `window.g60BestKit = L => {
  const p = game.player, cls = p.cls, M = masteryOf(cls, game.job), W = game.job === 'crusader' ? 'cross' : game.job === 'monk' ? 'totem' : game.job === 'exorcist' ? 'battleaxe' : game.job === 'avenger' ? 'scythe' : CLASS_START_WEAPON[cls];
  // 转职的伤害类型优先（气功师 / 街霸 = 魔法）
  const J = game.job && CLASSES[cls].jobs && CLASSES[cls].jobs[game.job], TYPE = game.job === 'crusader' ? 'indep' : (J && J.dmgType) || p.dmgType || 'phys', score = () => { const m = gearMetrics(p, TYPE); return Math.pow(m.off, 0.7) * Math.pow(m.ehp, 0.3); };
  const GEARS = SLOTS.filter(s => !s.startsWith('av_') && s !== 'title'), T = Math.floor(L / 5) * 5;
  const wear = kit => { for (const s of GEARS) { if (kit[s]) inv.equip[s] = kit[s]; else delete inv.equip[s]; } };
  // 对照的稀有件去掉它那 1 条随机属性：每个部位 / 类型 / 等级只有一件稀有，随机属性抽到力量 / 智力就让对照组平白强 5~9%（Lv45 的稀有重甲两件都是力量），曲线会跟着对照组的运气跳
  const rareIt = D => { const it = makeItem(D.key, 1, { grade: 2 }), R = mulberry(keySeed((D._def && D._def.seed) || D.key));
    const k = ['str', 'int', 'vit', 'spr', 'hp', 'mp', 'crit', 'hit', 'evade'][Math.floor(R() * 9)], L = D.lvl, m = RAR_MUL[D.rar], st = { ...D.st };
    if (k === 'crit') { st.crit = +(st.crit - 0.01 * D.rar).toFixed(3); st.mcrit = +(st.mcrit - 0.01 * D.rar).toFixed(3); }
    else if (k === 'hit' || k === 'evade') st[k] = +(st[k] - (0.01 + 0.005 * D.rar)).toFixed(3);
    else st[k] -= Math.round(k === 'hp' ? L * 8 * m : k === 'mp' ? L * 5 * m : (2 + L * 0.5) * m);
    const g = gradeMul(it.grade); it.st = {}; for (const x in st) if (st[x]) it.st[x] = FLAT_STATS.includes(x) ? Math.round(st[x] * g) : st[x];
    return it; };
  for (const s of GEARS) delete inv.equip[s];
  for (const s of GEARS) { const D = GEAR.find(D => D.slot === s && D.rar === 2 && D.lvl === T && !D.set && !D.named && (s !== 'weapon' || D.wtype === W) && (!ARMOR_SLOTS.includes(s) || D.atype === M)); if (D) inv.equip[s] = rareIt(D); }
  recalcStats(p); const base = score(), baseKit = { ...inv.equip };
  // 转职专用的武器（拳套）只给那个转职
  const cand = {}; for (const s of GEARS) cand[s] = Object.values(ITEMS).filter(D => D.kind === 'equip' && D.rar === 5 && D.slot === s && D.lvl <= L && D.lvl > L - 12 && (s !== 'weapon' || (D.cls === cls && wtypeJobOk(D.wtype, game.job) && (!(cls === 'priest' && game.job) || D.wtype === W)))).map(D => makeItem(D.key));
  const climb = lock => { recalcStats(p); let best = score();
    for (let pass = 0; pass < 4; pass++) { let ch = false;
      for (const s of GEARS) if (s !== lock) for (const it of cand[s]) { const prev = inv.equip[s]; inv.equip[s] = it; recalcStats(p); const v = score(); if (v > best * 1.0001) { best = v; ch = true; } else { inv.equip[s] = prev; } }
      for (const sid in SETS) { const pcs = SETS[sid].pieces.map(k => GEARS.map(s => cand[s].find(x => x.key === k)).find(Boolean)).filter(Boolean); if (pcs.length < 2 || pcs.some(x => x.slot === lock)) continue; const prev = {}; for (const it of pcs) { prev[it.slot] = inv.equip[it.slot]; inv.equip[it.slot] = it; } recalcStats(p); const v = score(); if (v > best * 1.0001) { best = v; ch = true; } else for (const s in prev) inv.equip[s] = prev[s]; }
      if (!ch) break; }
    return best; };
  let best = climb(), bestKit = { ...inv.equip };
  for (const w of cand.weapon) { wear(baseKit); inv.equip.weapon = w; climb('weapon'); const v = climb(); if (v > best * 1.0001) { best = v; bestKit = { ...inv.equip }; } }
  wear(bestKit); recalcStats(p);
  return { best, base, baseKit, bestKit, cand, GEARS };
};`;
