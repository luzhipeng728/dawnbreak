/* =====================================================================
   开箱与合成（商城组）：箱子奖池抽取、魔盒保底与碎片、全服公告；装扮合成器（天空套）
   只管结果（先检查背包空间，再扣箱子、发奖励），演出在 ui/cash/box.js
   ===================================================================== */
// 奖池里真正能出的条目（物品还不存在的去掉），按档返回 [{ tier, items: [[权重, 奖励]], sum }]
function cashBoxTiers(key) {
  const B = CASH_BOXES[key]; if (!B) return [];
  return B.tiers.map(T => { const items = T.items.filter(([, r]) => cashRewardOk(r)); return { ...T, items, sum: items.reduce((s, x) => s + x[0], 0) }; }).filter(T => T.items.length);
}
// 概率公示：[{ tier, name, p（0~1）, rar, jackpot }]
function cashBoxOdds(key) {
  const tiers = cashBoxTiers(key), all = tiers.reduce((s, T) => s + T.sum, 0), out = [];
  for (const T of tiers) for (const [w, r] of T.items) out.push({ tier: T.name, name: cashRewardName(r), p: w / all, rar: cashRewardRar(r), jackpot: !!T.jackpot, r });
  return out;
}
function cashRollTier(tiers, forceJackpot) {
  let pool = tiers;
  if (forceJackpot) { const J = tiers.filter(T => T.jackpot); if (J.length) pool = J; }
  const all = pool.reduce((s, T) => s + T.sum, 0);
  let x = cashRng() * all;
  for (const T of pool) for (const e of T.items) { x -= e[0]; if (x <= 0) return { T, r: e[1] }; }
  const T = pool[pool.length - 1]; return { T, r: T.items[T.items.length - 1][1] };
}
// 开 count 个箱子：先全部抽好、检查背包，再扣箱子发奖励。返回 { results: [{ items, jackpot, tier, pity }], best, shards } 或 { err }
function cashOpenBoxes(key, count = 1) {
  const S = cashData(), B = CASH_BOXES[key], D = ITEMS[key];
  if (!B || !D) return { err: '这个箱子打不开' };
  count = Math.max(1, count | 0);
  if (inv.count(key) < count) return { err: `${D.name}不够（需要 ${count} 个）` };
  const tiers = cashBoxTiers(key), pk = B.pity ? key : B.pityOf, pityN = pk && CASH_BOXES[pk].pity;
  let pity = pk ? S.pity[pk] || 0 : 0;
  const results = [];
  for (let i = 0; i < count; i++) {
    const rolls = B.rolls || 1, items = []; let jackpot = false, tier = null, forced = false;
    for (let k = 0; k < rolls; k++) {
      forced = !!(pityN && pity >= pityN - 1);
      const { T, r } = cashRollTier(tiers, forced);
      items.push(...cashRewardItems(r).filter(Boolean)); if (T.jackpot) jackpot = true; tier = T.name;
    }
    if (pk) pity = jackpot ? 0 : pity + 1;
    results.push({ items, jackpot, tier, forced: forced && jackpot, pity });
  }
  const all = results.flatMap(R => R.items);
  const room = cashRoomFor(all); if (room) return { err: room };
  // 提交
  inv.take(key, count);
  if (pk) S.pity[pk] = pity;
  const shards = (B.shard || 0) * count; if (shards) cashAdd('shard', shards);
  cashGive(all);
  S.opened += count; S.openedBy ??= {}; S.openedBy[key] = (S.openedBy[key] || 0) + count;
  if (key === 'box_magic' || key === 'box_magic2') cashStat('box', 1, true);
  for (const R of results) for (const it of R.items) if (R.jackpot || (it.rar >= 5 && it.kind === 'equip') || it.key === 'tk_sky') {
    bus.emit('announce', { kind: 'box', box: D.name, item: it });
    toastMsg(`【公告】勇士 ${save.data.name} 从${D.name}中开出了 ${it.name}！`, '#ffd23a');
  }
  bus.emit('boxOpen', { key, items: all, jackpot: results.some(R => R.jackpot) });
  save.write();
  return { results, best: all.reduce((m, it) => Math.max(m, it.rar || 0), 0), shards };
}
// 自选礼盒（史诗自选 / 神器宠物装备自选）：先列出选项，选好后再开
const cashSelectKeys = key => (CASH_SELECT[key] ? CASH_SELECT[key]() : []).filter(k => ITEMS[k]);
function cashOpenSelect(key, pickKey) {
  if (!inv.count(key)) return { err: '没有这个礼盒了' };
  if (!cashSelectKeys(key).includes(pickKey)) return { err: '不能选这件' };
  const it = makeItem(pickKey), room = cashRoomFor([it]); if (room) return { err: room };
  inv.take(key, 1); cashGive([it]); save.write();
  return { results: [{ items: [it], jackpot: it.rar >= 5 }], best: it.rar };
}

/* ---- 装扮合成器：2 件同部位高级装扮 → 天空（失败得 1 件随机同部位高级装扮）；梦想：任意 8 件 → 指定部位天空 ---- */
const isAdvAvatar = it => !!it && it.kind === 'equip' && ITEMS[it.key] && ITEMS[it.key].avSet && CASH_SETS[ITEMS[it.key].avSet].tier === 'adv';
const cashSynthPool = () => { inv.ensure(); return inv.items.filter(isAdvAvatar); };   // 只用背包里的（身上穿着的要先脱下）
// o = { synth: 合成器 key, inputs: [物品], set: 目标天空套, slot?（梦想用）, opt? }
function cashSynth(o) {
  const D = ITEMS[o.synth], Y = D && D.synth; if (!Y) return { err: '请选择合成器' };
  if (!inv.count(o.synth)) return { err: `没有${D.name}` };
  if (!CASH_SKY_SETS.includes(o.set)) return { err: '请选择要合成的天空套' };
  const ins = [...new Set(o.inputs || [])];
  if (ins.length !== Y.need || !ins.every(it => isAdvAvatar(it) && inv.items.includes(it))) return { err: `请放入 ${Y.need} 件${Y.any ? '' : '同部位的'}高级装扮（背包里的）` };
  const slot = Y.any ? o.slot : ins[0].slot;
  if (!Y.any && ins.some(it => it.slot !== slot)) return { err: '两件高级装扮的部位必须相同' };
  if (!AV_PIECE_SLOTS.includes(slot)) return { err: '请选择部位' };
  const ok = cashRng() < Y.rate;
  const out = ok ? makeItem(avKey(o.set, slot)) : makeItem(avKey(cashPick(CASH_ADV_SETS), slot));
  if (ok && o.opt) { out.opt = o.opt; out.optLock = true; normalizeItem(out); }
  inv.take(o.synth, 1); for (const it of ins) inv.remove(it);
  cashGive([out]);
  const S = cashData(); S.synth ??= { n: 0, ok: 0 }; S.synth.n++; if (ok) S.synth.ok++;
  if (ok) { cashStat('sky', 1, true); bus.emit('announce', { kind: 'skyset', item: out }); toastMsg(`【公告】勇士 ${save.data.name} 合成出了稀有装扮 ${out.name}！`, '#ffd23a'); }
  bus.emit('skySynth', { ok, item: out });
  save.write();
  return { ok, item: out, rate: Y.rate };
}
