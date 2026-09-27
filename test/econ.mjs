// 经济模拟：按正常节奏从 Lv1 玩到 Lv20，统计金币收入（怪物金币 / 翻牌 / 卖装备）与支出（药剂 / 修理 / 买装备 / 强化），验证价格是否平衡
// 用法：node build.mjs --offline && node test/econ.mjs [模拟次数=20] [难度=0]
// 模型（都用游戏里的真实数据：DUNGEONS / MON / 掉落表 / 物品价格 / 强化成功率与费用 / 修理费）：
//   - 每次选能打的最高等级地下城（普通难度，难度参数可改）；走主路 + 一半支路；房间怪物数量、精英、领主、第二波按 dungeon.js 的规则
//   - 怪物金币、经验按 monsters.js / dungeon.js 的公式；装备掉落按 rollDrop 的规则（用 rollEquip 生成真实物品）
//   - 每次结算翻 1 张免费牌（rollCardReward）；不买黄金卡牌
//   - 玩家策略：掉落的装备比身上好就换上，其余卖掉；到 Lv5/10/15/20 在林纳斯买一把高级武器 + 两件高级防具（如果身上的更差）；
//     每次进图消耗 2~4 瓶等级合适的药；被击 ≈ 房间数 × 4 次 → 耐久损耗 → 回城修理；
//     手里金币超过“保底”（等级 × 1500）时，把武器强化到目标等级（Lv10 前 +4，Lv15 前 +6，之后 +8），晶块不够就按 40 G 买
import { launch, URL_BASE } from './lib.mjs';
const N = +(process.argv[2] || 20), DIFF = +(process.argv[3] || 0), EXPK = +(process.argv[4] || 1), QUEST = process.argv[5] === 'q';   // EXPK：把升级所需经验再放大几倍（评估等级曲线用）；q：算上任务奖励
// 任务奖励（任务组分支 test/qbalance.mjs 生成的汇总：任务等级 → [该等级段所有任务经验合计占升级所需的比例, 金币合计]；每日任务未计入）
const QUESTS = {"1":[0.41,600],"2":[0.5,1000],"3":[0.49,2450],"4":[0.4,1540],"5":[0.39,2150],"6":[0.49,2550],"7":[0.38,2670],"8":[0.5,5850],"9":[0.49,4640],"10":[0.34,5050],"11":[0.46,5760],"12":[0.34,5250],"13":[0.5,7230],"14":[0.3,2450],"15":[0.4,4200],"16":[0.29,5000],"17":[0.25,2000],"18":[0.5,10500]};
// 环境变量：TARGET=24 模拟到几级（默认 20）；SKY=1 在页面里临时加上地下城内容组的天空之城 6 图（合并前用他们给的数值估算，怪物用数值接近的现有怪代替）
const TARGET = +(process.env.TARGET || 20), SKY = !!process.env.SKY, SKY_BOSS = +(process.env.SKY_BOSS || 1);   // SKY_BOSS：领主经验倍率（调参用）
const { browser, page, logs } = await launch({ width: 640, height: 360 });
await page.goto(`${URL_BASE}?town&fresh&cls=sword&mute`);
await page.waitForFunction(() => window.__READY && game.player && game.scene === 'town', null, { timeout: 30000 });
const res = await page.evaluate(({ N, DIFF, EXPK, QUEST, QUESTS, TARGET, SKY, SKY_BOSS }) => {
  if (SKY && !DUNGEONS.dragon_tower) {
    // 地下城内容组 09-27 定稿的数值（分支 worktree-agent-ad901f306653d77bb 提交 6e75218，src/content/monsters/sky_castle.js）；合并后删掉这段也能直接跑
    const mon = (id, exp, gold, base = MON.zombieRed) => { if (!MON[id]) MON[id] = { ...base, exp, gold }; };
    for (const [id, e, g] of [['wyvern', 100, [22, 45]], ['wyvernBlue', 108, [24, 48]], ['dragonman', 112, [25, 50]], ['minius', 120, [26, 52]], ['puppeteer', 105, [22, 44]], ['puppeteerRock', 115, [24, 46]], ['puppeteerIce', 160, [40, 80]],
      ['golem', 125, [28, 56]], ['golemBronze', 130, [30, 60]], ['golemMaster', 160, [40, 80]], ['kargo', 110, [26, 50]], ['kargoGoggle', 115, [28, 52]], ['expeller', 125, [28, 56]], ['expellerAxe', 130, [30, 58]], ['knight', 130, [30, 60]], ['hughes', 180, [40, 80]]]) mon(id, e, g);
    for (const [id, e, g] of [['lucas', 1600, [220, 420]], ['dogrey', 1900, [240, 450]], ['platani', 2300, [280, 520]], ['skyExpeller', 2700, [320, 580]], ['seghart', 3200, [360, 660]], ['sinEye', 3400, [380, 700]]]) mon(id, e * SKY_BOSS, g, MON.boneLord);
    const D6 = (id, name, lvl, bl, rooms, branches, bossAdds, clearExp, mobs, boss, o = {}) => defineDungeon(id, { name, lvl, rooms, branches, bossAdds, clearExp, mobs, boss: { kind: boss, lvl: bl }, ...o });
    D6('dragon_tower', '龙人之塔', [14, 16], 17, 6, 2, 2, 4800, [['wyvern', 3], ['wyvernBlue', 2], ['dragonman', 3], ['minius', 1]], 'lucas');
    D6('puppet_hall', '人偶玄关', [15, 17], 18, 6, 2, 2, 5400, [['puppeteer', 3], ['puppeteerRock', 2], ['dragonman', 2], ['minius', 1], ['puppeteerIce', 0.4]], 'dogrey');
    D6('golem_tower', '石巨人塔', [16, 19], 20, 7, 3, 2, 6400, [['golem', 3], ['golemBronze', 2], ['puppeteer', 2], ['puppeteerRock', 1]], 'platani', { elite: 'golemMaster' });
    D6('dark_corridor', '黑暗玄廊', [18, 21], 22, 7, 3, 3, 7600, [['kargo', 3], ['kargoGoggle', 1.5], ['expeller', 3], ['expellerAxe', 1.5]], 'skyExpeller', { elite: 'hughes' });
    D6('lord_palace', '城主宫殿', [20, 23], 24, 8, 3, 3, 9000, [['minius', 2], ['puppeteerRock', 2], ['golemBronze', 2], ['expeller', 2], ['expellerAxe', 1], ['kargoGoggle', 1]], 'seghart', { elite: 'knight' });
    D6('floating_castle', '悬空城', [21, 24], 25, 7, 3, 3, 10000, [['expeller', 2], ['knight', 2], ['golemBronze', 2]], 'sinEye', { hidden: true });
  }

  const toastMsg0 = window.toastMsg; window.toastMsg = () => {};
  const D = DIFFS[DIFF], dgs = Object.values(DUNGEONS).filter(d => !d.hidden).sort((a, b) => a.lvl[0] - b.lvl[0]);
  const all = [];
  for (let sim = 0; sim < N; sim++) {
    game.lvl = 1; game.exp = 0; game.gold = 1500; inv.starter('sword'); recalcStats(game.player);
    const log = { runs: 0, rooms: 0, perDg: {}, qDone: 0, inc: { mob: 0, card: 0, sell: 0, quest: 0 }, out: { pot: 0, repair: 0, gear: 0, enh: 0 }, byLv: {}, maxEnh: 0, broke: 0, bought: [], minGold: 1e9 };
    const snap = () => { if (!log.byLv[game.lvl]) log.byLv[game.lvl] = { run: log.runs, gold: Math.round(game.gold), enh: inv.equip.weapon ? inv.equip.weapon.enh : 0, wlv: inv.equip.weapon ? inv.equip.weapon.lvl : 0, wr: inv.equip.weapon ? inv.equip.weapon.rar : 0 }; };
    const better = (it) => { const c = inv.equip[it.slot]; if (it.lvl > game.lvl || (it.cls && it.cls !== 'sword')) return false; if (!c) return true; const sc = x => x.lvl * RAR_MUL[x.rar] * (1 + enhBonus(x.enh || 0) * 0.5); return sc(it) > sc(c) * 1.05; };
    const take = (it) => { if (it.kind !== 'equip') { if (it.key === 'crystal') inv.add(it); else if (ITEMS[it.key].kind === 'use') inv.add(it); else { log.inc.sell += sellPrice(it); game.gold += sellPrice(it); } return; }
      if (better(it)) { const old = inv.equip[it.slot]; inv.equip[it.slot] = it; if (old) { log.inc.sell += sellPrice(old); game.gold += sellPrice(old); } } else { log.inc.sell += sellPrice(it); game.gold += sellPrice(it); } };
    let tierBought = 0;
    while (game.lvl < TARGET && log.runs < 400) {
      // 在城里：到了新等级段就买装备
      const T = TIER_LV.filter(t => t <= game.lvl).pop();
      if (T >= 5 && T > tierBought) {
        tierBought = T;
        for (const key of [`katana_${T}_1`, `heavy_top_${T}_1`, `heavy_bottom_${T}_1`]) { const it = makeItem(key, 1, { grade: 2 }); if (better(it) && game.gold >= it.price) { game.gold -= it.price; log.out.gear += it.price; log.bought.push(`Lv${game.lvl}:${it.name}`); take(it); } }
      }
      // 强化武器
      const tgt = game.lvl < 10 ? 4 : game.lvl < 15 ? 6 : 8, w = inv.equip.weapon;
      while (w && w.enh < tgt && game.gold > game.lvl * 500 + 2000) {
        const c = enhCost(w); const need = Math.max(0, c.crystal - inv.count('crystal')); if (need) { inv.add(makeItem('crystal', need)); game.gold -= need * 40; log.out.enh += need * 40; }
        if (game.gold < c.gold) break;
        const g0 = game.gold; const r = tryEnhance(w, false); log.out.enh += g0 - game.gold;
        if (r.broken) { log.broke++; inv.equip.weapon = makeItem(`katana_${T}_0`, 1, { grade: 2 }); break; }
      }
      log.maxEnh = Math.max(log.maxEnh, inv.equip.weapon.enh); snap();
      // 进图
      const dg = dgs.filter(d => d.lvl[0] <= game.lvl).pop(), dgObj = { def: dg, D, diff: DIFF };
      log.perDg[dg.id] = (log.perDg[dg.id] || 0) + 1;
      const main = dg.rooms, br = Math.round((dg.branches ?? Math.floor(dg.rooms / 3)) / 2), rooms = main + br;
      // 药剂
      const pots = rndi(2, 4), potKey = game.lvl < 6 ? 'hpS' : game.lvl < 14 ? 'hpM' : 'hpL'; log.out.pot += pots * ITEMS[potKey].price; game.gold -= pots * ITEMS[potKey].price;
      let exp = 0;
      const kill = (kind, lv, o = {}) => {
        const M = MON[kind]; exp += Math.round(M.exp * (1 + (lv - 1) * 0.4) * D.exp);
        const g = Math.round(rndi(M.gold ? M.gold[0] : 5, M.gold ? M.gold[1] : 15) * (1 + lv * 0.15) * (o.elite ? 3 : 1) * (o.boss ? 8 : 1)); game.gold += g; log.inc.mob += g;
        const n = o.boss ? 2 + (Math.random() < 0.5 ? 1 : 0) : o.elite ? (Math.random() < 0.6 ? 1 : 0) : (Math.random() < 0.07 ? 1 : 0);
        for (let i = 0; i < n; i++) { const rar = rollRarity(D.drop, o.boss), l = clamp(rndi(dg.lvl[0], dg.lvl[1] + (o.boss ? 1 : 0)), 1, Math.max(dg.lvl[1] + 1, game.lvl + 2)); const it = rar === 5 ? rollEpic(l) || rollEquip({ lvl: l, rar: 4 }) : rollEquip({ lvl: l, rar }); if (it) take(it); }
        const TB = autoDropTable(dg); if (o.boss && TB) for (const [key, p] of TB.boss) if (Math.random() < p * (1 + D.drop * 2)) take(makeItem(key));
      };
      const pickMob = () => { const tot = dg.mobs.reduce((s, m) => s + m[1], 0); let r = Math.random() * tot; for (const m of dg.mobs) { r -= m[1]; if (r <= 0) return m[0]; } return dg.mobs[0][0]; };
      for (let r = 0; r < rooms; r++) {
        const lv = rndi(dg.lvl[0], dg.lvl[1]), boss = r === main - 1, start = r === 0, elite = r >= main && Math.random() < 0.35;
        const cnt = start ? 3 + rndi(0, 1) : boss ? dg.bossAdds || 2 : 4 + rndi(0, 3);
        for (let i = 0; i < cnt; i++) kill(pickMob(), lv);
        if (!start && !boss && Math.random() < 0.5) for (let i = 0; i < 3 + rndi(0, 1); i++) kill(pickMob(), lv);
        if (elite) kill(dg.elite || pickMob(), lv + 1, { elite: true });
        if (boss) kill(dg.boss.kind, dg.boss.lvl, { boss: true });
      }
      const clearExp = Math.round((dg.clearExp || 300) * D.exp); exp += clearExp; exp += Math.round(exp * 0.15);   // S 评价 +15%
      gainExp(exp / EXPK);
      const card = rollCardReward(dgObj, false); if (card.gold) { game.gold += card.gold; log.inc.card += card.gold; } else take(card.item);
      // 耐久与修理
      let pts = Math.round(rooms * 4 / 4); while (pts-- > 0) { const L = durItems(); if (L.length) { const it = pick(L); it.dur = Math.max(0, it.dur - 1); } }
      const rc = repairCost(); game.gold -= rc; log.out.repair += rc;
      log.runs++; log.rooms += rooms; log.minGold = Math.min(log.minGold, game.gold);
      // 任务：到了任务等级就交（假设主线 + 支线都做）
      if (QUEST) for (let q = log.qDone + 1; q <= game.lvl; q++) { log.qDone = q; const Q = QUESTS[q]; if (!Q) continue; gainExp(expNeed(q) * Q[0] / EXPK); game.gold += Q[1]; log.inc.quest += Q[1]; }
    }
    snap();
    log.final = Math.round(game.gold); log.run14 = (log.byLv[14] || {}).run; log.days = +(log.rooms / FATIGUE_MAX).toFixed(1);
    all.push(log);
  }
  window.toastMsg = toastMsg0;
  const avg = f => Math.round(all.reduce((s, l) => s + f(l), 0) / all.length);
  const lv = {}; for (const L of [3, 5, 8, 10, 12, 14, 15, 18, 20, 22, 24]) lv[L] = { run: avg(l => (l.byLv[L] || {}).run || 0), gold: avg(l => (l.byLv[L] || {}).gold || 0), enh: +(all.reduce((s, l) => s + ((l.byLv[L] || {}).enh || 0), 0) / all.length).toFixed(1) };
  const perDg = {}; for (const l of all) for (const k in l.perDg) perDg[k] = (perDg[k] || 0) + l.perDg[k] / all.length;
  for (const k in perDg) perDg[k] = +perDg[k].toFixed(1);
  return { N, diff: D.name, quests: QUEST, target: TARGET, run14: avg(l => l.run14 || 0), perDg, runs: avg(l => l.runs), days: +(all.reduce((s, l) => s + l.days, 0) / all.length).toFixed(1), inc: { mob: avg(l => l.inc.mob), card: avg(l => l.inc.card), sell: avg(l => l.inc.sell), quest: avg(l => l.inc.quest) }, out: { pot: avg(l => l.out.pot), repair: avg(l => l.out.repair), gear: avg(l => l.out.gear), enh: avg(l => l.out.enh) }, final: avg(l => l.final), minGold: avg(l => l.minGold), maxEnh: avg(l => l.maxEnh), broke: avg(l => l.broke * 100) / 100, lv, bought: all[0].bought };
}, { N, DIFF, EXPK, QUEST, QUESTS, TARGET, SKY, SKY_BOSS });
console.log(JSON.stringify(res, null, 1));
const tot = res.inc.mob + res.inc.card + res.inc.sell + res.inc.quest, spend = res.out.pot + res.out.repair + res.out.gear + res.out.enh;
console.log(`${res.runs} 次地下城到 Lv${res.target}（${res.days} 天疲劳，Lv14 时已打 ${res.run14} 次）；每个地下城次数 ${JSON.stringify(res.perDg)}`);
console.log(`收入 ${tot}（怪物 ${Math.round(res.inc.mob / tot * 100)}%、翻牌 ${Math.round(res.inc.card / tot * 100)}%、卖装备 ${Math.round(res.inc.sell / tot * 100)}%、任务 ${Math.round(res.inc.quest / tot * 100)}%），支出 ${spend}（药 ${res.out.pot}、修理 ${res.out.repair}、买装备 ${res.out.gear}、强化 ${res.out.enh}），Lv${res.target} 时余额 ${res.final}`);
const warn = [];
if (res.minGold < 0) warn.push('有模拟出现金币为负（药剂 / 修理付不起）');
if (res.final > 400000) warn.push('Lv20 时金币过多（> 40 万），价格偏低或产出偏高');
if (res.lv[10] && res.lv[10].enh < 3) warn.push('Lv10 时武器强化等级偏低，强化费用偏贵');
if (res.out.repair > tot * 0.2) warn.push('修理费占收入 20% 以上，偏贵');
console.log(warn.length ? '⚠ ' + warn.join('；') : '平衡检查通过');
console.log('LOGS', JSON.stringify(logs.filter(l => l.type !== 'warning')));
await browser.close();
