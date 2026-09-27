// 装备深化的强度 / 经济模拟：同一套刷图节奏跑两遍——「旧版」（只有原来的史诗、强化）和「新版」（新史诗、深渊派对、增幅、锻造、附魔、图鉴），
// 用真实的 recalcStats + 对比窗口的 gearMetrics 算出输出 / 生存，逐级比较，确认打造不会让现有地下城变得毫无挑战，也不会变难。
// 用法：node build.mjs --offline && node test/gear_sim.mjs [每种模拟次数=6] [职业=sword] [目标等级=30]
// 掉落用真实的 rollDrop（含 content/abyss.js 的额外掉落）——在页面里对假怪物调用 rollDrop，再把地上的掉落物收进背包
import { launch, URL_BASE } from './lib.mjs';
const N = +(process.argv[2] || 6), CLS = process.argv[3] || 'sword', TARGET = +(process.argv[4] || 30);
const OFF = (process.env.OFF || '').split(',');   // 调试：关掉新版的某些功能 OFF=forge,card,amp,codex,epic
const { browser, page, logs } = await launch({ width: 640, height: 360 });
await page.goto(`${URL_BASE}?town&fresh&cls=${CLS}&mute`);
await page.waitForFunction(() => window.__READY && game.player && game.scene === 'town', null, { timeout: 30000 });
const res = await page.evaluate(({ N, TARGET, OFF }) => {
  window.toastMsg = () => {}; bus.map.announce = []; save.write = () => {};
  const OLD_EPIC = k => /^ep_[a-z]+\d?$/.test(k);
  const NEW_EPICS = Object.keys(ITEMS).filter(k => ITEMS[k].rar === 5 && !OLD_EPIC(k));
  const origBoss = {}; for (const id in DROP_TABLES) origBoss[id] = DROP_TABLES[id].boss.slice();
  const extraDrops = window.abyssExtraDrops, codexBonus = window.codexBonusStats;
  function setMode(base) {
    for (const k of NEW_EPICS) ITEMS[k].noDrop = base ? true : ITEMS[k]._noDrop0 ?? (ITEMS[k]._noDrop0 = !!ITEMS[k].noDrop, ITEMS[k]._noDrop0);
    for (const id in DROP_TABLES) DROP_TABLES[id].boss = base ? origBoss[id].filter(([k]) => OLD_EPIC(k) || ITEMS[k].rar < 5) : origBoss[id].slice();
    window.abyssExtraDrops = base ? () => {} : extraDrops;
    window.codexBonusStats = base || OFF.includes('codex') ? () => ({}) : codexBonus;
    if (!base && OFF.includes('epic')) for (const k of NEW_EPICS) ITEMS[k].noDrop = true;
  }
  for (const k of NEW_EPICS) ITEMS[k]._noDrop0 = !!ITEMS[k].noDrop;
  const normalDgs = Object.values(DUNGEONS).filter(d => !d.hidden && !d.abyss).sort((a, b) => a.lvl[0] - b.lvl[0]);
  const LV = [5, 10, 12, 15, 18, 20, 22, 24, 26, 28, 30];
  function sim(base) {
    setMode(base);
    const p = game.player;
    game.lvl = 1; game.exp = 0; game.gold = 1500; game.job = null; inv.starter(p.cls); save.data.codex = {}; save.data.codexLog = []; save.data.abyss = null; save.data.questDone = {}; codexBonusCache = null;
    for (const id of CLASSES[p.cls].skills) game.skillLv[id] = 1;
    recalcStats(p);
    const log = { runs: 0, abyssRuns: 0, rooms: 0, byLv: {}, epics: 0, epicsAbyss: 0, exch: 0, amp: 0, forge: 0, cards: 0, tickets: 0, gold: {}, broke: 0 };
    const type = () => mainDmgType(p);
    const snap = () => { if (log.byLv[game.lvl]) return; const m = gearMetrics(p, type()); for (let l = 1; l < game.lvl; l++) if (!log.byLv[l]) log.byLv[l] = { off: m.off, ehp: m.ehp, run: log.runs, abyss: log.abyssRuns, gold: Math.round(game.gold), epicsWorn: 0, score: 0, w: '(跳级)' }; log.byLv[game.lvl] = { off: m.off, ehp: m.ehp, run: log.runs, abyss: log.abyssRuns, gold: Math.round(game.gold), epicsWorn: SLOTS.filter(s => inv.equip[s] && inv.equip[s].rar === 5).length, score: gearScore(), w: inv.equip.weapon ? `${inv.equip.weapon.name}+${inv.equip.weapon.enh}${inv.equip.weapon.dim ? '红' : ''}${inv.equip.weapon.forge ? ' 锻' + inv.equip.weapon.forge : ''}` : '-' }; };
    const sellAll = list => { for (const it of list) { game.gold += sellPrice(it); inv.remove(it); } };
    const town = () => {
      // 穿更好的装备（真实的综合对比），其余装备卖掉；材料留着
      for (let pass = 0; pass < 2; pass++) for (const it of inv.items.filter(x => x.kind === 'equip' && x.lvl <= game.lvl)) { const c = equipCompare(it); if (c && c.v === 'up' && c.total > 0.004) inv.wear(it); }
      sellAll(inv.items.filter(x => x.kind === 'equip'));
      sellAll(inv.items.filter(x => x.kind === 'mat' && !['crystal', 'm_contra', 'm_aura', 'amp_purify', 'amp_guard', 'amp_book', 'abyss_ticket', 'm_cosmos', 'm_otherworld', 'm_elem'].includes(x.key) && !ITEMS[x.key].orb));
      // 每 5 级在林纳斯买高级武器 / 防具（和 econ.mjs 一样）
      const T = TIER_LV.filter(t => t <= game.lvl).pop();
      if (T >= 5 && T > (log.tier || 0)) { log.tier = T; const w = CLASS_START_WEAPON[p.cls], m = masteryOf(p.cls, game.job); for (const key of [`${w}_${T}_1`, `${m}_top_${T}_1`, `${m}_bottom_${T}_1`]) { const it = makeItem(key, 1, { grade: 2 }); if (it && game.gold >= it.price) { const c = (inv.add(it), equipCompare(it)); if (c && c.v === 'up') { game.gold -= it.price; inv.wear(it); } else inv.remove(it); } } }
      // 强化武器（不带红字时）
      const tgt = game.lvl < 10 ? 4 : game.lvl < 15 ? 6 : 8, w = inv.equip.weapon;
      while (w && !w.dim && w.enh < tgt && game.gold > game.lvl * 500 + 2000) { const c = enhCost(w); const need = Math.max(0, c.crystal - inv.count('crystal')); if (need) { inv.add(makeItem('crystal', need)); game.gold -= need * 40; } if (game.gold < c.gold) break; const r = tryEnhance(w, false); if (r.broken) { log.broke++; break; } }
      if (base) return;
      // 附魔：每张卡片附到能附的、还没附魔（或附的卡更差）的身上装备
      for (const cd of OFF.includes('card') ? [] : inv.items.filter(x => ITEMS[x.key] && ITEMS[x.key].orb)) {
        const R = ITEMS[cd.key].rar; const t = SLOTS.map(s => inv.equip[s]).filter(it => it && canEnchant(cd.key, it) && (!it.orb || ((ITEMS[it.orb.key] || {}).rar || 0) < R))[0];
        if (t && enchantItem(t, cd).ok) log.cards++;
      }
      // 增幅（Lv15 起）：武器 + 防具，净化后增幅到 +7（+8 以上有归零风险就不冲），留足金币
      const reserve = game.lvl * 1500 + 5000;
      if (game.lvl >= 15 && !OFF.includes('amp')) for (const s of ['weapon', ...ARMOR_SLOTS, ...ACC_SLOTS]) {
        const it = inv.equip[s]; if (!it || !hasOtherworld(it)) continue;
        if (!it.dim) { if (!inv.count('amp_purify')) { if (game.gold < reserve + 6000) continue; game.gold -= 6000; inv.add(makeItem('amp_purify')); } if (ampConvert(it).err) continue; }
        while ((it.enh || 0) < 7 && game.gold > reserve) { const c = ampCost(it); if (inv.count('m_contra') < c.contra) break; const r = tryAmplify(it, {}); if (r.err) break; log.amp++; if (r.broken) { log.broke++; break; } }
      }
      // 锻造武器到 +5
      const W = inv.equip.weapon;
      while (!OFF.includes('forge') && W && (W.forge || 0) < 5 && game.gold > reserve) { const c = forgeCost(W); if (inv.count('m_aura') < c.aura) break; if (inv.count('crystal') < c.crystal) { inv.add(makeItem('crystal', c.crystal)); game.gold -= c.crystal * 40; } if (tryForge(W).err) break; log.forge++; }
      // 宇宙灵魂兑换：挑综合提升最大的一件史诗
      let soul = inv.count('m_cosmos');
      const cands = abyssExchangeKeys().filter(k => abyssEpicCost(k) <= soul && ITEMS[k].lvl <= game.lvl);
      if (cands.length) { let best = null, bv = 0.02; for (const k of cands) { const it = makeItem(k); const c = equipCompare(it); if (c && c.total > bv) { bv = c.total; best = it; } } if (best) { inv.take('m_cosmos', abyssEpicCost(best.key)); inv.add(best); inv.wear(best); log.exch++; } }
      // 邀请函：金币宽裕时每次买 1 张
      if (game.gold > game.lvl * 4000 + 20000 && abyssOpen()) { game.gold -= abyssTicketPrice(); inv.add(makeItem('abyss_ticket')); log.tickets++; }
    };
    const abyssOpen = () => base ? null : game.lvl >= 22 && log.skyUnlocked ? DUNGEONS.abyss_sky : game.lvl >= 15 && log.gfUnlocked ? DUNGEONS.abyss_gf : null;
    const collect = () => { for (const d of drops) if (d.item) { if (d.item.rar >= 5) { log.epics++; if (game.dungeon && game.dungeon.def.abyss) log.epicsAbyss++; } giveItem(d.item); } drops.length = 0; };
    while (game.lvl < TARGET && log.runs < 500) {
      town(); snap();
      // 资格任务：Lv15 通关过烈焰格拉卡 → 格兰之森深渊；Lv22 通关过城主宫殿 → 天空之城深渊（各送 3 张邀请函）
      if (!base && !log.gfUnlocked && game.lvl >= 15 && log.seen && log.seen.blazing_graca) { log.gfUnlocked = true; inv.add(makeItem('abyss_ticket', 3)); }
      if (!base && !log.skyUnlocked && game.lvl >= 22 && log.seen && log.seen.lord_palace) { log.skyUnlocked = true; inv.add(makeItem('abyss_ticket', 3)); }
      const ab = abyssOpen() && inv.count('abyss_ticket') > 0 ? abyssOpen() : null;
      const def = ab || normalDgs.filter(d => d.lvl[0] <= game.lvl).pop();
      if (ab) { inv.take('abyss_ticket', 1); def.boss = { kind: pick(ABYSS[def.id].lords), lvl: ABYSS[def.id].lordLvl }; log.abyssRuns++; }
      (log.seen = log.seen || {})[def.id] = 1;
      const dg = { def, D: DIFFS[0], diff: 0, state: 'play' }; game.dungeon = dg; game.scene = 'dungeon';
      let exp = 0;
      const kill = (kind, lv, o = {}) => {
        const M = MON[kind]; exp += Math.round(M.exp * (1 + (lv - 1) * 0.4));
        game.gold += Math.round(rndi(M.gold ? M.gold[0] : 5, M.gold ? M.gold[1] : 15) * (1 + lv * 0.15) * (o.elite ? 3 : 1) * (o.boss ? 8 : 1));
        rollDrop({ kind, lvl: lv, x: 500, y: 50, z: 0, boss: !!o.boss, elite: !!o.elite, guardian: !!o.guardian }, dg); collect();
      };
      const tot = def.mobs.reduce((s, m) => s + m[1], 0), pickMob = () => { let r = Math.random() * tot; for (const m of def.mobs) { r -= m[1]; if (r <= 0) return m[0]; } return def.mobs[0][0]; };
      const main = def.rooms, rooms = main + Math.round((def.branches ?? 1) / 2);
      for (let r = 0; r < rooms; r++) {
        const lv = rndi(def.lvl[0], def.lvl[1]), boss = r === main - 1, start = r === 0, elite = r >= main && Math.random() < 0.35;
        const cnt = start ? 3 + rndi(0, 1) : boss ? def.bossAdds || 2 : 4 + rndi(0, 3);
        for (let i = 0; i < cnt; i++) kill(pickMob(), lv);
        if (!start && !boss && Math.random() < 0.5) for (let i = 0; i < 3; i++) kill(pickMob(), lv);
        if (elite) kill(def.elite || pickMob(), lv + 1, { elite: true });
        if (boss && def.abyss) {   // 深渊之间：封印之门 + 堕落守护者 + 三波 + 深渊领主
          kill('abyssSeal', def.lvl[1]); kill(def.elite, def.lvl[1] + 2, { elite: true, guardian: true });
          for (let n = 1; n <= 3; n++) { for (let i = 0; i < 4 + n; i++) kill(pickMob(), def.lvl[1] + 1); for (let i = 0; i < (n === 3 ? 2 : 1); i++) kill(def.elite, def.lvl[1] + 2, { elite: true }); }
        }
        if (boss) kill(def.boss.kind, def.boss.lvl, { boss: true });
      }
      exp += Math.round((def.clearExp || 300)); exp += Math.round(exp * 0.15);
      gainExp(exp);
      dg.state = 'result'; const card = rollCardReward(dg, false); if (card.gold) game.gold += card.gold; else giveItem(card.item);
      game.dungeon = null; game.scene = 'town';
      log.runs++; log.rooms += rooms;
      for (const s of SLOTS) if (inv.equip[s] && inv.equip[s].durMax) inv.equip[s].dur = inv.equip[s].durMax;
      game.gold -= 3 * 200;   // 药剂与修理（粗略）
      if (!base && log.runs % 6 === 0 && abyssOpen()) inv.add(makeItem('abyss_ticket', 2));   // 每日任务「深渊的呼唤」（约 6 次地下城 = 1 天）
    }
    town(); snap();
    log.codex = codexStats().epic;
    return log;
  }
  const runAll = base => { const L = []; for (let i = 0; i < N; i++) L.push(sim(base)); return L; };
  const B = runAll(true), X = runAll(false);
  const avg = (L, f) => L.reduce((s, l) => s + (f(l) || 0), 0) / L.length;
  const rows = LV.filter(l => l <= TARGET).map(lv => {
    const b = { off: avg(B, l => l.byLv[lv] && l.byLv[lv].off), ehp: avg(B, l => l.byLv[lv] && l.byLv[lv].ehp), run: avg(B, l => l.byLv[lv] && l.byLv[lv].run) };
    const x = { off: avg(X, l => l.byLv[lv] && l.byLv[lv].off), ehp: avg(X, l => l.byLv[lv] && l.byLv[lv].ehp), run: avg(X, l => l.byLv[lv] && l.byLv[lv].run), ab: avg(X, l => l.byLv[lv] && l.byLv[lv].abyss), ep: avg(X, l => l.byLv[lv] && l.byLv[lv].epicsWorn), epB: avg(B, l => l.byLv[lv] && l.byLv[lv].epicsWorn), gold: avg(X, l => l.byLv[lv] && l.byLv[lv].gold), goldB: avg(B, l => l.byLv[lv] && l.byLv[lv].gold) };
    return { lv, run: +b.run.toFixed(1), runNew: +x.run.toFixed(1), abyss: +x.ab.toFixed(1), off: +(x.off / b.off).toFixed(3), ehp: +(x.ehp / b.ehp).toFixed(3), total: +(Math.pow(x.off / b.off, 0.7) * Math.pow(x.ehp / b.ehp, 0.3)).toFixed(3), epicsWorn: `${x.epB.toFixed(1)}→${x.ep.toFixed(1)}`, gold: `${Math.round(x.goldB)}→${Math.round(x.gold)}`, w: X[0].byLv[lv] && X[0].byLv[lv].w };
  });
  const sum = L => ({ runs: avg(L, l => l.runs), abyssRuns: avg(L, l => l.abyssRuns), epics: avg(L, l => l.epics), epicsAbyss: avg(L, l => l.epicsAbyss), exch: avg(L, l => l.exch), amp: avg(L, l => l.amp), forge: avg(L, l => l.forge), cards: avg(L, l => l.cards), codex: avg(L, l => l.codex), broke: avg(L, l => l.broke), tickets: avg(L, l => l.tickets) });
  return { rows, base: sum(B), neu: sum(X), sample: X[0].byLv[TARGET] };
}, { N, TARGET, OFF });
console.log('等级 | 到达该级的次数(旧→新, 其中深渊) | 输出倍率 | 生存倍率 | 综合 | 身上史诗件数 | 金币 | 武器（新版样本）');
for (const r of res.rows) console.log(`Lv${r.lv} | ${r.run}→${r.runNew}（深渊 ${r.abyss}） | ×${r.off} | ×${r.ehp} | ×${r.total} | ${r.epicsWorn} | ${r.gold} | ${r.w}`);
const f = o => Object.entries(o).map(([k, v]) => `${k} ${(+v).toFixed(1)}`).join('，');
console.log('旧版合计：' + f(res.base));
console.log('新版合计：' + f(res.neu));
const warn = [];
for (const r of res.rows) {
  if (r.lv <= 20 && r.total > 1.3) warn.push(`Lv${r.lv} 综合强度 ×${r.total}（> 1.3，现有地下城会变得太简单）`);
  if (r.lv <= 24 && r.total > 1.45) warn.push(`Lv${r.lv} 综合强度 ×${r.total}（> 1.45）`);
  if (r.total < 0.94) warn.push(`Lv${r.lv} 综合强度 ×${r.total}（比旧版弱，会变难；随机波动约 ±4%）`);
  if (r.runNew > r.run * 1.1 + 1) warn.push(`Lv${r.lv} 需要的地下城次数变多了（${r.run}→${r.runNew}）`);
}
console.log(warn.length ? '⚠ ' + warn.join('；') : '强度检查通过');
console.log('LOGS', JSON.stringify(logs.filter(l => l.type !== 'warning')).slice(0, 2000));
await browser.close();
process.exit(warn.length ? 1 : 0);
