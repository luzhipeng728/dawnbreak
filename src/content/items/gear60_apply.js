/* =====================================================================
   装备 2.0 · 统一生效（ORDER：所有区域 spec 和 content/abyss.js 之后）
   1. 继承装备接过老物品的深渊归属（老区域的 poolFrom / 区域 spec 的 pool 在 abyss.js 里已经标到老物品上）
   2. 掉落表里被搬走的老 key：低等级地下城换成继承装备（几率不变），和新等级相近的地下城保留，其余去掉
   3. 执行 B1~B3 排队的 gearDrop / dropRemove / abyssClaim / g60Later（按登记顺序）
   4. 检查：搬家的物品有没有继承装备、深渊专属能不能在某个深渊里出（等级够得着）→ G60.problems
   5. 随机属性（g60CalmLines，平衡见 docs/GEAR.md §10.4）：Lv31~60 的史诗防具 / 首饰 / 辅助 / 魔法石（不含武器、继承装备）
      两条随机属性最多一条是力量 / 智力 / 暴击（两条都是就换种子）；Lv55~60 的一条都不抽力量 / 智力 / 暴击——这一段每个部位候选 10 件以上，
      最好的一套总能凑出 3~5 条力量，强弱由运气而不是档位（T1 < T2 < T3）决定。换种子 = `${key}#n` 里第一个合格的（和 moveEpic 的 seed 写法一样），
      新种子也不重复、不会两条都是力量 / 智力 / 暴击
   ===================================================================== */
const G60_LINE_POOL = ['str', 'int', 'vit', 'spr', 'hp', 'mp', 'crit', 'hit', 'evade'], G60_MAIN = ['str', 'int', 'crit'];
const g60Lines = seed => { const R = mulberry(keySeed(seed)); return [G60_LINE_POOL[Math.floor(R() * 9)], G60_LINE_POOL[Math.floor(R() * 9)]]; };
function g60Reseed(D, ok) {
  for (let i = 1; i < 100; i++) {
    const seed = `${D.key}#${i}`; if (!ok(g60Lines(seed))) continue;
    const def = D._def || {}, st = gearStats(D, mulberry(keySeed(seed)));
    if (def.st) for (const k in def.st) st[k] = +((st[k] || 0) + def.st[k]).toFixed(3);
    D.st = st; D._def = { ...def, seed };
    return seed;
  }
  g60Problem(`g60CalmLines：${D.key} 找不到合格的种子`);
}
function g60CalmLines() {
  const bad = k => G60_MAIN.includes(k);
  for (const k in ITEMS) {
    const D = ITEMS[k]; if (D.kind !== 'equip' || D.rar !== 5 || D.lvl <= 30 || D.slot === 'weapon' || G60.pred[k]) continue;
    const l = g60Lines((D._def && D._def.seed) || k);
    if (bad(l[0]) && bad(l[1])) g60Reseed(D, x => x[0] !== x[1] && !(bad(x[0]) && bad(x[1])));
    if (D.lvl >= 55) { const m = g60Lines((D._def && D._def.seed) || k); if (m.some(bad) || m[0] === m[1]) g60Reseed(D, x => !x.some(bad) && x[0] !== x[1]); }
  }
}
{
  for (const [K, S] of Object.entries(G60.succ)) {
    const A = ITEMS[K], B = ITEMS[S]; if (!A || !B) continue;
    if (B.abyss && !B.abyssRegion && A.abyssRegion) Object.assign(B, { abyssRegion: A.abyssRegion, abyssFrom: A.abyssFrom });   // 区域 spec 的 pool 只点了老 key
  }
  // 深渊归属：老物品搬到高等级后，原来那张深渊的保底池里它已经够不着了——归属交给继承装备，老物品等 B1~B3 的 abyssClaim 重新认领
  for (const K in G60.moved) { const S = G60.succ[K], A = ITEMS[K]; if (S && A.abyssRegion && ITEMS[S].abyssRegion === A.abyssRegion) { const lord = Math.max(0, ...Object.values(ABYSS).filter(x => x.region === A.abyssRegion).map(x => x.lordLvl || 0)); if (A.lvl > lord + 3) delete A.abyssRegion; } }
  g60SwapDrops();
  for (const fn of G60.queue) { try { fn(); } catch (e) { g60Problem('排队的操作出错：' + (e && e.message)); } }
  G60.queue = []; G60.applied = true;
  g60CalmLines();
  if (typeof itemSrcIndex !== 'undefined') itemSrcIndex = null;
  if (typeof codexKeysCache !== 'undefined') codexKeysCache = null;
  // 检查
  for (const K in G60.moved) if (G60.moved[K].from <= 30 && !G60.succ[K]) g60Problem(`${K} 从 Lv${G60.moved[K].from} 搬到 Lv${G60.moved[K].to}，但没有继承装备（inheritEpic / inheritSet）`);
  for (const k in ITEMS) {
    const D = ITEMS[k]; if (D.kind !== 'equip' || D.rar !== 5 || !D.abyss || D.lvl <= 30) continue;
    const As = Object.values(ABYSS).filter(A => A.region === D.abyssRegion);
    if (!D.abyssRegion || !As.some(A => D.lvl <= (A.lordLvl || 0) + 3)) g60Problem(`深渊专属 ${k}（Lv${D.lvl}）没有够得着的深渊（abyssRegion = ${D.abyssRegion || '无'}）→ abyssClaim`);
  }
}
