// 商城经济模拟：按 CASH_EARN（真实数据）算不同玩家每天 / 每周的点券产出，检查“认真玩约 1 周买一套节日时装、天空套要多次合成”，
// 并用个人信息的 gearMetrics（真实 recalcStats）估算商城物品对输出的提升，确认不会让装备系统失去意义
// 用法：node build.mjs --offline && node test/shop_econ.mjs
import { launch, URL_BASE } from './lib.mjs';
const { browser, page, logs } = await launch({ width: 640, height: 360 });
await page.goto(`${URL_BASE}?town&fresh&cls=sword&mute`);
await page.waitForFunction(() => window.__READY && game.player && game.scene === 'town', null, { timeout: 30000 });
let fails = 0;
const check = (ok, msg) => { console.log(ok ? '  ✓' : '  ✗', msg); if (!ok) fails++; };
const r = await page.evaluate(() => {
  const E = CASH_EARN, dailies = Object.values(QUESTS).filter(Q => Q.type === 'daily');
  const rankEv = (dist, diff) => Object.entries(dist).reduce((s, [k, p]) => s + (E.rank[k] || 0) * p, 0) * (1 + diff * 0.25);
  // 玩家模型：每天地下城次数（疲劳 156 / 约 7 个房间 ≈ 20 次）、难度、评价分布、每日任务个数、金币兑换
  const P = {
    serious: { runs: 20, diff: 1, dist: { SSS: 0.15, SS: 0.35, S: 0.4, A: 0.1 }, daily: Math.min(dailies.length, E.dailyMax), exch: E.exch.cap },
    casual: { runs: 6, diff: 0, dist: { S: 0.3, A: 0.5, B: 0.2 }, daily: 2, exch: 0 },
  };
  const day = {};
  for (const k in P) { const p = P[k], rank = Math.min(E.rankCap, rankEv(p.dist, p.diff) * p.runs); day[k] = { rank: Math.round(rank), daily: p.daily * E.daily, exch: p.exch, total: Math.round(rank + p.daily * E.daily + p.exch) }; }
  // 新手第一周：Lv1→20，首通 Lv20 以下的普通地下城 + 一半的冒险首通，成就（击杀 500、强化 +7、转职、觉醒、开魔盒、完美演出）
  let lvl = 0; for (let l = 2; l <= 20; l++) lvl += l * E.lvl;
  const dg = Object.values(DUNGEONS).filter(D => !D.hidden && D.lvl && D.lvl[0] <= 20);
  const first = dg.length * E.first + Math.round(dg.length / 2) * E.firstDiff[1];
  // 成就：社交组的成就系统（149 个，含商城原来的 14 个）按他们的估算，认真玩第一周约 53 个 / 3590 点券；没有成就系统时按商城自己的 6 个估算
  const ach = typeof ACHIEVEMENTS !== 'undefined' ? 3590 : ['kill500', 'enh7', 'job', 'awaken', 'box', 'sss'].reduce((s, id) => s + CASH_ACH.find(A => A.id === id).cera, 0);
  const newbie = { lvl, first, ach, daily: day.serious.total * 7, total: lvl + first + ach + day.serious.total * 7, dungeons: dg.length };
  // 价格
  const setPrice = CASH_GOODS['set:av_spring'].price, packPrice = CASH_GOODS.pkg_spring.price, piece = CASH_GOODS.box_avatar.price;
  const skyCost = (key, price) => { const Y = ITEMS[key].synth, att = 1 / Y.rate; return Y.any ? Y.need * piece + price : att * price + (2 * att - (att - 1)) * piece; };
  const sky = { basic: Math.round(skyCost('synth_basic', CASH_GOODS.synth_basic.price)), gold: Math.round(skyCost('synth_gold', CASH_GOODS.synth_gold.price)), dream: Math.round(skyCost('synth_dream', CASH_GOODS.synth_dream.price)) };
  sky.set8 = Math.min(sky.basic, sky.gold) * 8;
  const magic = { pity: CASH_BOXES.box_magic.pity * CASH_GOODS.box_magic.price, jack: cashBoxOdds('box_magic').filter(o => o.jackpot).reduce((s, o) => s + o.p, 0) };
  // 商城物品对输出的影响（Lv20 鬼剑士，一身随机的 Lv20 稀有装备 +7 武器；只比较输出 off）
  const R0 = Math.random; Math.random = mulberry(20260928);   // 固定随机装备，结果可复现
  game.lvl = 20; const p = game.player; inv.equip = {};
  for (const s of ['weapon', 'top', 'head', 'bottom', 'belt', 'shoes', 'neck', 'bracelet', 'ring', 'support', 'stone']) { const it = rollEquip({ slot: s, lvl: 20, rar: 2, cls: 'sword', strict: true }); if (it) inv.equip[s] = it; }
  inv.equip.weapon.enh = 7; inv.equip.title = makeItem('title_hero');
  const type = 'phys', base = gearMetrics(p, type).off;
  const wear = keys => { for (const k of keys) { const it = makeItem(k); if (ITEMS[k].avOpt) { it.opt = { av_hair: 'str', av_hat: 'str', av_face: 'aspd', av_chest: 'aspd', av_top: 'str', av_bottom: 'hp', av_belt: 'str', av_shoes: 'str' }[it.slot]; normalizeItem(it); } inv.equip[it.slot] = it; } return gearMetrics(p, type).off / base - 1; };
  const steps = {};
  steps.festival = wear(AV_PIECE_SLOTS.map(s => avKey('av_spring', s)));
  steps.pack = wear(['pet_lion', 'aura_spring', 'title_spring', 'av_weapon_spring']);
  steps.sky = wear(AV_PIECE_SLOTS.map(s => avKey('av_sky1', s)));
  steps.max = wear(['title_supreme', 'pet_pegasus', 'aura_supreme', 'petR_2', 'petB_2', 'petG_2']);
  // 对照：把武器换成同级史诗
  inv.equip = {}; for (const s of ['top', 'head', 'bottom', 'belt', 'shoes', 'neck', 'bracelet', 'ring', 'support', 'stone']) { const it = rollEquip({ slot: s, lvl: 20, rar: 2, cls: 'sword', strict: true }); if (it) inv.equip[s] = it; }
  const w0 = rollEquip({ slot: 'weapon', lvl: 20, rar: 2, cls: 'sword', strict: true }); w0.enh = 7; inv.equip.weapon = w0; inv.equip.title = makeItem('title_hero');
  const b2 = gearMetrics(p, type).off; const ep = EPICS.filter(E => E.slot === 'weapon' && E.cls === 'sword' && E.lvl <= 23).sort((a, b) => b.lvl - a.lvl)[0];
  let epic = null; if (ep) { const it = makeItem(ep.key); it.enh = 7; inv.equip.weapon = it; epic = gearMetrics(p, type).off / b2 - 1; }
  Math.random = R0;
  return { day, newbie, setPrice, packPrice, sky, magic, steps, epic, epicName: ep && ep.name };
});
const W = n => (n / (r.day.serious.total * 7)).toFixed(1);
console.log('每天点券：', JSON.stringify(r.day));
console.log(`认真玩家每周 ${r.day.serious.total * 7}（前 6~8 周另有成就约 +3500 / 周，逐周减少）；休闲玩家每周 ${r.day.casual.total * 7}`);
console.log(`新手第一周：升级 ${r.newbie.lvl} + 首通 ${r.newbie.first}（${r.newbie.dungeons} 个地下城）+ 成就 ${r.newbie.ach} + 日常 ${r.newbie.daily} = ${r.newbie.total}`);
console.log(`节日时装整套 ${r.setPrice}（认真玩 ${W(r.setPrice)} 周）；节日礼包 ${r.packPrice}（${W(r.packPrice)} 周）`);
console.log(`天空每件期望：普通 ${r.sky.basic} / 黄金 ${r.sky.gold} / 梦想 ${r.sky.dream}；整套 8 件约 ${r.sky.set8}（${W(r.sky.set8)} 周）`);
console.log(`魔盒保底 100 个 ${r.magic.pity}（${W(r.magic.pity)} 周）；大奖概率 ${(r.magic.jack * 100).toFixed(2)}%`);
const pct = v => (v * 100).toFixed(1) + '%';
console.log(`输出提升（Lv20 鬼剑士，稀有装 +7 武器为基准，逐步累加）：节日时装 8 件 ${pct(r.steps.festival)} → + 礼包宠物 / 光环 / 称号 / 武器装扮 ${pct(r.steps.pack)} → 换天空 8 件 ${pct(r.steps.sky)} → 满配至尊 + 神器宠物装备 ${pct(r.steps.max)}`);
console.log(`对照：武器换成同级史诗「${r.epicName}」+7 ${r.epic == null ? '-' : pct(r.epic)}`);
check(r.setPrice / (r.day.serious.total * 7) >= 0.6 && r.setPrice / (r.day.serious.total * 7) <= 1.3, '认真玩约 1 周买一套节日时装');
check(r.sky.set8 / (r.day.serious.total * 7) >= 2 && r.sky.set8 / (r.day.serious.total * 7) <= 5, '天空套整套需要 2~5 周（多次合成）');
check(r.magic.pity / (r.day.serious.total * 7) >= 1 && r.magic.pity / (r.day.serious.total * 7) <= 3, '魔盒 100 次保底约 1~3 周');
check(r.steps.max < 0.55 && (r.epic == null || r.steps.max < r.epic), `满配商城物品的输出提升 ${pct(r.steps.max)} < 55%，也小于换一把同级史诗武器（装备仍是主体）`);
check(r.steps.festival < 0.25, `一套节日时装提升 ${pct(r.steps.festival)} < 25%`);
const errs = logs.filter(l => l.type === 'pageerror');
check(!errs.length, '页面没有报错');
await browser.close();
process.exit(fails ? 1 : 0);
