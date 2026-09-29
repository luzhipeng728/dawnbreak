/* =====================================================================
   商城目录（商城组）：商品与价格、礼包内容、箱子奖池、兑换商店、不放回抽奖、多买多送、限时特惠、点券产出、成就
   数值依据见 docs/SHOP.md 第 9 节（经济模拟 test/shop_econ.mjs 直接读这里的 CASH_EARN）
   奖励写法（礼包 / 奖池 / 兑换通用）：{ key, n }；n 可以写 [最小, 最大]；{ equip: true, rar } 本级随机装备；{ epic: true } 本级随机史诗；
     { gold: [每级最小, 每级最大] }；{ cera: [a, b] } 点券
   奖池里的物品还不存在时（例如装备深化组的增幅保护券还没合并）这一项自动去掉，概率按剩下的归一，概率公示同步
   ===================================================================== */
/* ---- 商城页签 ---- */
const CASH_TABS = [['rec', '推荐'], ['avatar', '时装'], ['weapon', '武器装扮'], ['sky', '天空'], ['pet', '宠物'], ['aura', '光环'], ['use', '消耗品'], ['pack', '礼包'], ['box', '魔盒']];
/* ---- 商品：pid → { key, n, price, cur, tab, sub?, tag?, limit?: { per: 'day'|'week'|'life', n }, lvl?, whole?（整套时装）, need? } ---- */
const CASH_GOODS = {};
function defGoods(pid, def) { CASH_GOODS[pid] = { pid, n: 1, cur: 'cera', ...def }; }
// 时装：整套（9 折）+ 单件
for (const set of CASH_ADV_SETS) {
  defGoods('set:' + set, { key: avKey(set, 'av_top'), whole: set, price: 11800, tab: 'avatar', sub: set, tag: '整套 9 折', name: `${CASH_SETS[set].name} 整套（8 件）` });
  for (const slot of AV_PIECE_SLOTS) defGoods('av:' + avKey(set, slot), { key: avKey(set, slot), price: CASH_SLOT_PRICE[slot], tab: 'avatar', sub: set });
}
defGoods('av_weapon_spring', { key: 'av_weapon_spring', price: 2400, tab: 'weapon' });
defGoods('av_weapon_summer', { key: 'av_weapon_summer', price: 2400, tab: 'weapon' });
defGoods('tk_avopt', { key: 'tk_avopt', price: 100, tab: 'avatar', sub: 'etc' });
defGoods('box_avatar', { key: 'box_avatar', price: 900, tab: 'avatar', sub: 'etc', tag: '合成材料' });
// 天空（天空套本身不直接出售：合成 / 兑换券）
defGoods('synth_basic', { key: 'synth_basic', price: 150, tab: 'sky' });
defGoods('synth_basic5', { key: 'synth_basic', n: 5, price: 700, tab: 'sky', tag: '热卖' });
defGoods('synth_gold', { key: 'synth_gold', price: 600, tab: 'sky' });
defGoods('synth_dream', { key: 'synth_dream', price: 1200, tab: 'sky', tag: '保底' });
defGoods('box_avatar_sky', { key: 'box_avatar', price: 900, tab: 'sky', tag: '合成材料' });
defGoods('box_avatar_sky5', { key: 'box_avatar', n: 5, price: 4200, tab: 'sky', tag: '合成材料' });
// 宠物
for (const k of ['pet_lion', 'pet_seal', 'pet_owl', 'pet_panda']) defGoods(k, { key: k, price: 3800, tab: 'pet' });
defGoods('egg_pet', { key: 'egg_pet', price: 1800, tab: 'pet', tag: '惊喜' });
defGoods('box_petgear', { key: 'box_petgear', price: 1200, tab: 'pet' });
for (const k of ['petR_1', 'petB_1', 'petG_1']) defGoods(k, { key: k, price: 2000, tab: 'pet' });
// 光环
for (const k of ['aura_spring', 'aura_summer', 'aura_academy']) defGoods(k, { key: k, price: 3000, tab: 'aura' });
// 消耗品
defGoods('coin5', { key: 'coin', n: 5, price: 300, tab: 'use' });
defGoods('fatigue', { key: 'fatigue', price: 200, tab: 'use', limit: { per: 'day', n: 3 } });
defGoods('guard', { key: 'guard', price: 400, tab: 'use' });
defGoods('tk_enh7', { key: 'tk_enh7', price: 1500, tab: 'use', limit: { per: 'week', n: 3 } });
defGoods('elixir3', { key: 'elixir', n: 3, price: 150, tab: 'use' });
defGoods('box_supply', { key: 'box_supply', price: 300, tab: 'use' });
defGoods('box_gold', { key: 'box_gold', price: 400, tab: 'use' });
defGoods('abyss_ticket', { key: 'abyss_ticket', n: 1, price: 150, tab: 'use', limit: { per: 'day', n: 1 } });   // 装备深化组：深渊派对邀请函
defGoods('amp_guard', { key: 'amp_guard', price: 600, tab: 'use' });
defGoods('amp_book', { key: 'amp_book', price: 800, tab: 'use' });
// 礼包
defGoods('pkg_spring', { key: 'pkg_spring', price: 15800, tab: 'pack', tag: '多买多送', fest: true });
defGoods('pkg_summer', { key: 'pkg_summer', price: 15800, tab: 'pack', tag: '多买多送', fest: true });
defGoods('pkg_academy', { key: 'pkg_academy', price: 13800, tab: 'pack', tag: '多买多送', fest: true });
defGoods('pkg_newbie', { key: 'pkg_newbie', price: 0, tab: 'pack', tag: '免费', limit: { per: 'life', n: 1 } });
for (const L of [10, 20, 30]) defGoods('pkg_lv' + L, { key: 'pkg_lv' + L, price: 0, tab: 'pack', tag: '免费', lvl: L, limit: { per: 'life', n: 1 } });
defGoods('pkg_ltd_box', { key: 'pkg_ltd_box', price: 2980, tab: 'pack', tag: '限时', ltd: true, limit: { per: 'week', n: 2 } });
defGoods('pkg_ltd_enh', { key: 'pkg_ltd_enh', price: 3980, tab: 'pack', tag: '限时', ltd: true, limit: { per: 'week', n: 2 } });
defGoods('pkg_ltd_pet', { key: 'pkg_ltd_pet', price: 3480, tab: 'pack', tag: '限时', ltd: true, limit: { per: 'week', n: 2 } });
defGoods('pkg_ltd_synth', { key: 'pkg_ltd_synth', price: 2980, tab: 'pack', tag: '限时', ltd: true, limit: { per: 'week', n: 2 } });
const CASH_LTD = ['pkg_ltd_box', 'pkg_ltd_enh', 'pkg_ltd_pet', 'pkg_ltd_synth'];   // 每周轮换 1 个
// 魔盒 / 箱子
defGoods('box_magic', { key: 'box_magic', price: 300, tab: 'box', tag: '保底' });
defGoods('box_magic10', { key: 'box_magic', n: 10, price: 3000, tab: 'box', tag: '十连' });
defGoods('box_equip', { key: 'box_equip', price: 500, tab: 'box' });
defGoods('box_orb', { key: 'box_orb', price: 800, tab: 'box' });
defGoods('egg_pet_b', { key: 'egg_pet', price: 1800, tab: 'box' });
defGoods('box_mystery', { key: 'box_mystery', price: 600, tab: 'box', tag: '惊喜' });
defGoods('box_supply_b', { key: 'box_supply', price: 300, tab: 'box' });
defGoods('box_gold_b', { key: 'box_gold', price: 400, tab: 'box' });

/* ---- 限时特惠：每天 3 个（按日期种子轮换），每周 1 个 ---- */
const CASH_DEALS_DAY = [
  { key: 'box_magic', n: 5, base: 1500, off: 0.7, limit: 1 }, { key: 'synth_gold', n: 2, base: 1200, off: 0.6, limit: 1 }, { key: 'box_avatar', n: 2, base: 1800, off: 0.7, limit: 2 },
  { key: 'egg_pet', n: 1, base: 1800, off: 0.6, limit: 1 }, { key: 'box_mystery', n: 3, base: 1800, off: 0.5, limit: 1 }, { key: 'tk_enh7', n: 1, base: 1500, off: 0.6, limit: 1 },
  { key: 'box_orb', n: 2, base: 1600, off: 0.7, limit: 1 }, { key: 'fatigue', n: 2, base: 400, off: 0.5, limit: 1 }, { key: 'box_magic2', n: 1, base: 2400, off: 0.7, limit: 1 },
  { key: 'coin', n: 10, base: 600, off: 0.5, limit: 1 }, { key: 'synth_basic', n: 5, base: 750, off: 0.6, limit: 1 }, { key: 'box_petgear', n: 1, base: 1200, off: 0.6, limit: 1 },
];
const CASH_DEALS_WEEK = [
  { key: 'tk_sky', n: 1, base: 12000, off: 0.75, limit: 1 }, { key: 'synth_dream', n: 2, base: 2400, off: 0.7, limit: 1 },
  { key: 'box_magic2', n: 3, base: 7200, off: 0.6, limit: 1 }, { key: 'box_petgear2', n: 1, base: 5000, off: 0.7, limit: 1 },
];

/* ---- 礼包内容 ---- */
const CASH_PACKS = {
  pkg_spring: [{ set: 'av_spring' }, { key: 'pet_lion' }, { key: 'aura_spring' }, { key: 'title_spring' }, { key: 'orb_spring' }, { key: 'av_weapon_spring' }, { key: 'tk_enh7' }, { key: 'synth_basic', n: 2 }, { key: 'coin', n: 5 }, { key: 'tk_lotto', n: 2 }, { key: 'coin_gift', n: 10 }],
  pkg_summer: [{ set: 'av_summer' }, { key: 'pet_seal' }, { key: 'aura_summer' }, { key: 'title_summer' }, { key: 'orb_summer' }, { key: 'av_weapon_summer' }, { key: 'box_petgear' }, { key: 'synth_basic', n: 2 }, { key: 'fatigue', n: 2 }, { key: 'tk_lotto', n: 2 }, { key: 'coin_gift', n: 10 }],
  pkg_academy: [{ set: 'av_academy' }, { key: 'pet_owl' }, { key: 'aura_academy' }, { key: 'title_academy' }, { key: 'orb_academy' }, { key: 'box_orb' }, { key: 'synth_basic', n: 2 }, { key: 'box_magic', n: 3 }, { key: 'tk_lotto', n: 2 }, { key: 'coin_gift', n: 10 }],
  pkg_newbie: [{ key: 'coin', n: 10 }, { key: 'fatigue', n: 2 }, { key: 'guard' }, { key: 'box_magic', n: 3 }, { key: 'box_equip' }, { key: 'box_avatar', n: 2 }, { key: 'cera', n: 500 }],
  pkg_lv10: [{ key: 'box_equip', n: 2 }, { key: 'box_magic', n: 5 }, { key: 'tk_enh7' }, { key: 'cera', n: 1000 }],
  pkg_lv20: [{ key: 'egg_pet' }, { key: 'box_orb', n: 2 }, { key: 'box_magic', n: 10 }, { key: 'box_petgear2' }, { key: 'cera', n: 2000 }],
  pkg_lv30: [{ key: 'box_epic' }, { key: 'box_magic', n: 20 }, { key: 'synth_gold', n: 3 }, { key: 'cera', n: 3000 }],
  pkg_ltd_box: [{ key: 'box_magic', n: 10 }, { key: 'box_magic2' }, { key: 'box_mystery' }],
  pkg_ltd_enh: [{ key: 'tk_enh7' }, { key: 'guard', n: 3 }, { key: 'crystal', n: 200 }, { key: 'amp_guard', n: 2 }, { key: 'amp_book' }, { key: 'm_contra', n: 30 }],
  pkg_ltd_pet: [{ key: 'egg_pet' }, { key: 'box_petgear', n: 2 }, { key: 'orb_pet1' }],
  pkg_ltd_synth: [{ key: 'box_avatar', n: 3 }, { key: 'synth_basic', n: 3 }, { key: 'synth_gold' }],
};
/* ---- 多买多送：三种节日礼包合计 ---- */
const CASH_MULTI = [
  { n: 2, reward: [{ key: 'aura_supreme' }], name: '至尊·天界圣环' },
  { n: 3, reward: [{ key: 'title_supreme' }], name: '至尊·破晓之光' },
  { n: 5, reward: [{ key: 'pet_pegasus' }], name: '至尊·金翼天马' },
  { n: 7, reward: [{ key: 'sel_petgear2', n: 3 }], name: '神器宠物装备自选 ×3' },
];
/* ---- 破晓启示（不放回抽奖）：20 个奖励，★ 为大奖 ---- */
const CASH_LOTTO = [
  { key: 'orb_title_supreme', star: 1 }, { key: 'orb_pet_supreme', star: 1 }, { key: 'tk_sky', star: 1 }, { key: 'tk_sky', star: 1 }, { key: 'tk_enh10', star: 1 },
  { key: 'box_petgear2' }, { key: 'box_petgear2' }, { key: 'box_petgear2' }, { key: 'synth_gold', n: 3 }, { key: 'synth_dream' },
  { key: 'tk_avatar', n: 2 }, { key: 'box_orb', n: 3 }, { key: 'box_magic', n: 10 }, { key: 'box_magic', n: 5 }, { key: 'tk_enh7', n: 2 },
  { key: 'egg_pet' }, { key: 'cera_m', n: 2 }, { key: 'fatigue', n: 5 }, { key: 'coin', n: 10 }, { key: 'coin_gift', n: 10 },
];
const CASH_LOTTO_DONE = [{ key: 'tk_sky', n: 2 }, { key: 'coin_gift', n: 20 }];
const CASH_LOTTO_RESETS = 3;

/* ---- 兑换商店 ---- */
const CASH_EXCH = {
  shard: { name: '魔盒碎片', goods: [
    { key: 'coin', n: 3, cost: 8 }, { key: 'fatigue', n: 1, cost: 10, limit: { per: 'day', n: 3 } }, { key: 'synth_basic', n: 2, cost: 10 }, { key: 'box_avatar', n: 1, cost: 25 },
    { key: 'box_orb', n: 1, cost: 30 }, { key: 'egg_pet', n: 1, cost: 40 }, { key: 'synth_gold', n: 1, cost: 40 }, { key: 'tk_avatar', n: 1, cost: 50 },
    { key: 'tk_enh10', n: 1, cost: 120, limit: { per: 'week', n: 1 } }, { key: 'tk_sky', n: 1, cost: 150, limit: { per: 'week', n: 1 } }, { key: 'box_epic', n: 1, cost: 200, limit: { per: 'week', n: 1 } }] },
  gcoin: { name: '礼包币', goods: [
    { key: 'tk_lotto', n: 1, cost: 5 }, { key: 'tk_avopt', n: 1, cost: 2 }, { key: 'box_petgear', n: 1, cost: 8 }, { key: 'sel_petgear2', n: 1, cost: 30 },
    { key: 'tk_sky', n: 1, cost: 30 }, { key: 'orb_title_supreme', n: 1, cost: 40 }, { key: 'orb_pet_supreme', n: 1, cost: 40 }] },
};

/* ---- 箱子奖池：tiers 按权重（%），jackpot 档出货发全服公告；pity：连续 n-1 次不出大奖，第 n 次必出 ---- */
const CASH_BOXES = {
  box_magic: { shard: 1, pity: 100, tiers: [
    { name: '大奖', jackpot: true, items: [[0.5, { key: 'tk_sky' }], [0.5, { epic: true }], [0.4, { key: 'aura_box' }], [0.4, { key: 'title_box' }], [0.3, { key: 'tk_enh10' }], [0.3, { key: 'orb_pet_supreme' }], [0.3, { key: 'cera_l' }], [0.3, { key: 'pet_fox' }]] },
    { name: '稀有', items: [[3, { key: 'box_equip' }], [2.5, { key: 'box_orb' }], [2.5, { key: 'tk_enh7' }], [1.5, { key: 'egg_pet' }], [2, { key: 'tk_avatar' }], [2, { key: 'synth_gold' }], [1.5, { key: 'box_petgear2' }], [1.5, { key: 'cera_m' }], [0.5, { key: 'amp_purify' }]] },
    { name: '普通', items: [[10, { key: 'box_supply' }], [10, { key: 'coin', n: 2 }], [8, { key: 'synth_basic', n: 2 }], [8, { key: 'box_gold' }], [7, { key: 'fatigue' }], [5, { key: 'elixir', n: 2 }], [6, { key: 'box_avatar' }],
      [4, { key: 'crystal', n: 60 }], [2, { key: 'm_contra', n: 20 }], [5, { key: 'guard' }], [5, { key: 'cera_s' }], [3, { key: 'amp_guard' }], [3, { key: 'abyss_ticket', n: 2 }], [2, { key: 'amp_book' }], [2, { key: 'm_elem2', n: 3 }]] },
  ] },
  box_magic2: { shard: 3, pityOf: 'box_magic', tiers: [
    { name: '大奖', jackpot: true, items: [[3, { key: 'tk_sky' }], [2.5, { epic: true }], [2, { key: 'aura_box' }], [2, { key: 'title_box' }], [2, { key: 'tk_enh10' }], [1.5, { key: 'orb_pet_supreme' }], [2, { key: 'cera_l' }], [1.5, { key: 'pet_fox' }]] },
    { name: '稀有', items: [[16, { key: 'box_equip' }], [12, { key: 'box_orb' }], [12, { key: 'tk_enh7' }], [10, { key: 'egg_pet' }], [10, { key: 'tk_avatar' }], [10, { key: 'synth_gold' }], [7, { key: 'box_petgear2' }], [8, { key: 'cera_m' }]] },
  ] },
  box_equip: { tiers: [{ name: '装备', items: [[50, { equip: true, rar: 1 }], [30, { equip: true, rar: 2 }], [14, { equip: true, rar: 3 }], [5, { equip: true, rar: 4 }], [1, { epic: true }]] }] },
  box_orb: { tiers: [{ name: '宝珠', items: [...ORB_TIER.rare.map(k => [70 / ORB_TIER.rare.length, { key: k }]), ...ORB_TIER.art.map(k => [27 / ORB_TIER.art.length, { key: k }]), ...ORB_TIER.supreme.map(k => [3 / ORB_TIER.supreme.length, { key: k }])] }] },
  egg_pet: { tiers: [{ name: '宠物', items: [[22.5, { key: 'pet_lion' }], [22.5, { key: 'pet_seal' }], [22.5, { key: 'pet_owl' }], [22.5, { key: 'pet_panda' }], [5, { key: 'box_petgear2' }], [3, { key: 'pet_fox' }], [2, { key: 'pet_pegasus' }]] }] },
  box_petgear: { tiers: [{ name: '宠物装备', items: [[26, { key: 'petR_1' }], [26, { key: 'petB_1' }], [26, { key: 'petG_1' }], [22 / 3, { key: 'petR_2' }], [22 / 3, { key: 'petB_2' }], [22 / 3, { key: 'petG_2' }]] }] },
  box_petgear2: { tiers: [{ name: '神器宠物装备', items: [[1, { key: 'petR_2' }], [1, { key: 'petB_2' }], [1, { key: 'petG_2' }]] }] },
  box_supply: { rolls: 3, tiers: [{ name: '补给', items: [[18, { key: 'hpL', n: 5 }], [18, { key: 'mpL', n: 5 }], [18, { key: 'potStr', n: 2 }], [12, { key: 'elixir' }], [12, { key: 'essence', n: 2 }], [8, { key: 'coin' }], [7, { key: 'fatigue' }], [7, { key: 'abyss_ticket' }]] }] },
  box_gold: { tiers: [{ name: '金币', items: [[94, { gold: [600, 1800] }], [5, { gold: [600, 1800], mul: 5 }], [1, { gold: [600, 1800], mul: 20 }]] }] },
  box_avatar: { tiers: [{ name: '高级装扮', items: CASH_ADV_SETS.flatMap(set => AV_PIECE_SLOTS.map(slot => [1, { key: avKey(set, slot) }])) }] },
  box_mystery: { tiers: [{ name: '箱子', items: [[30, { key: 'box_magic' }], [18, { key: 'box_equip' }], [14, { key: 'box_supply' }], [12, { key: 'box_orb' }], [10, { key: 'box_gold' }], [8, { key: 'egg_pet' }], [6, { key: 'box_avatar' }], [2, { key: 'box_magic2' }]] }] },
};
// 自选类礼盒：打开时弹出选择
const CASH_SELECT = {
  box_epic: () => (typeof epicChoiceKeys === 'function' ? epicChoiceKeys(game.lvl, game.player.cls) : EPICS.filter(E => E.lvl <= game.lvl + 3 && (!E.cls || E.cls === game.player.cls) && !(ITEMS[E.key] && (ITEMS[E.key].noDrop || ITEMS[E.key].set))).map(E => E.key)),
  sel_petgear2: () => ['petR_2', 'petB_2', 'petG_2'],
};

/* ---- 点券产出（经济模拟 test/shop_econ.mjs 读这一段） ---- */
const CASH_EARN = {
  lvl: 40,                                            // 升级：新等级 × 40
  first: 300, firstDiff: [0, 200, 300, 500],          // 首次通关：普通 300；首次通关冒险 / 勇士 / 王者再 +200 / +300 / +500
  rank: { SSS: 80, SS: 60, S: 40, A: 20, B: 10 },     // 通关评价（× (1 + 难度 × 0.25)）
  rankCap: 1000,                                      // 评价点券每天上限
  daily: 150,                                         // 每完成一个每日任务
  exch: { rate: 50, cap: 500 },                       // 金币兑换：50 金币 = 1 点券，每天最多 500 点券
};
/* ---- 成就（一次性点券）：ev 为统计项，n 为目标 ---- */
const CASH_ACH = [
  { id: 'kill500', name: '百战勇士', desc: '累计击杀 500 只怪物', stat: 'kill', n: 500, cera: 200 },
  { id: 'kill3000', name: '千人斩', desc: '累计击杀 3000 只怪物', stat: 'kill', n: 3000, cera: 600 },
  { id: 'kill10000', name: '万夫莫敌', desc: '累计击杀 10000 只怪物', stat: 'kill', n: 10000, cera: 1500 },
  { id: 'clear50', name: '地下城常客', desc: '累计通关 50 次地下城', stat: 'clear', n: 50, cera: 500 },
  { id: 'clear200', name: '老练的冒险家', desc: '累计通关 200 次地下城', stat: 'clear', n: 200, cera: 1500 },
  { id: 'sss', name: '完美演出', desc: '打出 SSS 评价', stat: 'sss', n: 1, cera: 500 },
  { id: 'enh7', name: '锋芒初露', desc: '强化成功到 +7', stat: 'enh', n: 7, cera: 300 },
  { id: 'enh10', name: '神兵利器', desc: '强化成功到 +10', stat: 'enh', n: 10, cera: 800 },
  { id: 'enh12', name: '登峰造极', desc: '强化成功到 +12', stat: 'enh', n: 12, cera: 2000 },
  { id: 'epic', name: '天选之人', desc: '第一次获得史诗装备', stat: 'epic', n: 1, cera: 1000 },
  { id: 'job', name: '新的道路', desc: '完成转职', stat: 'job', n: 1, cera: 500 },
  { id: 'awaken', name: '觉醒', desc: '解锁觉醒', stat: 'awaken', n: 1, cera: 1000 },
  { id: 'box', name: '开箱达人', desc: '第一次打开魔盒', stat: 'box', n: 1, cera: 100 },
  { id: 'sky', name: '天空之上', desc: '第一次合成出稀有装扮', stat: 'sky', n: 1, cera: 1000 },
];
