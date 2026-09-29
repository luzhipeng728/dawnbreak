/* =====================================================================
   装备 2.0 · 统一生效（ORDER：所有区域 spec 和 content/abyss.js 之后）
   1. 继承装备接过老物品的深渊归属（老区域的 poolFrom / 区域 spec 的 pool 在 abyss.js 里已经标到老物品上）
   2. 掉落表里被搬走的老 key：低等级地下城换成继承装备（几率不变），和新等级相近的地下城保留，其余去掉
   3. 执行 B1~B3 排队的 gearDrop / dropRemove / abyssClaim / g60Later（按登记顺序）
   4. 检查：搬家的物品有没有继承装备、深渊专属能不能在某个深渊里出（等级够得着）→ G60.problems
   ===================================================================== */
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
