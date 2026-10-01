/* =====================================================================
   物品库 · 消耗品 / 材料 / 罐子 / 称号
   消耗品 use 字段：hp / mp（按上限比例瞬间恢复）、fatigue（恢复疲劳）、buff（地下城内 BUFF：atk 攻击 %、spd 速度 %、crit 暴击、mpr MP 恢复，t 秒）、
   open(lv)（罐子 / 礼盒：返回 [{ key, n } | { equip: true, rar, slot? } | { gold }]）、dungeonOnly、cd
   ===================================================================== */
/* ---- 药剂（旧 key 保留：hpS hpM hpL mpS mpM elixir） ---- */
defineItem('hpS', { kind: 'use', name: '新手 HP 药剂', rar: 0, price: 60, col: '#e83a3a', icon: 'item_hp_s', use: { hp: 0.25 }, desc: '立即恢复 25% 的 HP。' });
defineItem('hpM', { kind: 'use', name: '普通 HP 药剂', rar: 0, price: 160, col: '#e83a3a', icon: 'item_hp_m', use: { hp: 0.45 }, desc: '立即恢复 45% 的 HP。' });
defineItem('hpL', { kind: 'use', name: '熟练 HP 药剂', rar: 1, price: 400, col: '#e83a3a', icon: 'item_hp_l', use: { hp: 0.7 }, desc: '立即恢复 70% 的 HP。' });
defineItem('mpS', { kind: 'use', name: '新手 MP 药剂', rar: 0, price: 60, col: '#3a78ff', icon: 'item_mp_s', use: { mp: 0.25 }, desc: '立即恢复 25% 的 MP。' });
defineItem('mpM', { kind: 'use', name: '普通 MP 药剂', rar: 0, price: 160, col: '#3a78ff', icon: 'item_mp_m', use: { mp: 0.45 }, desc: '立即恢复 45% 的 MP。' });
defineItem('mpL', { kind: 'use', name: '熟练 MP 药剂', rar: 1, price: 400, col: '#3a78ff', icon: 'item_mp_l', use: { mp: 0.7 }, desc: '立即恢复 70% 的 MP。' });
defineItem('elixir', { kind: 'use', name: '天堂的痊愈药剂', rar: 3, price: 1500, col: '#ffd23a', icon: 'item_elixir', use: { hp: 1, mp: 1 }, desc: '来自天界的灵药，HP 和 MP 全部恢复。' });
defineItem('essence', { kind: 'use', name: '精灵香精', rar: 2, price: 700, col: '#9ae8ff', icon: 'item_essence', use: { mp: 1 }, desc: '精灵们珍藏的香精，MP 全部恢复。' });
defineItem('bread', { kind: 'use', name: '香喷喷的面包', rar: 0, price: 90, col: '#e8b060', icon: 'item_bread', use: { hp: 0.3, mp: 0.15 }, desc: '奥兰奶奶亲手烤的面包。恢复 30% HP、15% MP。' });
defineItem('meat', { kind: 'use', name: '烤肉串', rar: 1, price: 260, col: '#c86a3a', icon: 'item_meat', use: { hp: 0.55 }, desc: '外焦里嫩，吃完浑身是劲。恢复 55% HP。' });
/* ---- 地下城 BUFF 药剂（进地下城后使用） ---- */
defineItem('potStr', { kind: 'use', name: '力量秘药', rar: 1, price: 900, col: '#ff6a3a', icon: 'item_pot_str', use: { buff: { atk: 0.08, t: 300 }, dungeonOnly: true }, desc: '5 分钟内攻击力 +8%。（地下城内使用）' });
defineItem('potSpd', { kind: 'use', name: '疾风秘药', rar: 1, price: 700, col: '#6aff9a', icon: 'item_pot_spd', use: { buff: { spd: 0.1, t: 300 }, dungeonOnly: true }, desc: '5 分钟内移动速度 +10%。（地下城内使用）' });
defineItem('potCrit', { kind: 'use', name: '鹰眼秘药', rar: 2, price: 1600, col: '#ffd23a', icon: 'item_pot_crit', use: { buff: { crit: 0.05, t: 300 }, dungeonOnly: true }, desc: '5 分钟内暴击率 +5%。（地下城内使用）' });
/* ---- 疲劳 / 复活 / 强化 ---- */
defineItem('fatigue', { kind: 'use', name: '抗疲劳秘药', rar: 2, price: 6000, col: '#6ad06a', icon: 'item_fatigue', use: { fatigue: 50, fatigueBelow: 50, perDay: 3 }, desc: '疲劳值低于 50 时可以使用，恢复 50 点疲劳值。每天最多使用 3 次。' });
defineItem('coin', { kind: 'use', name: '复活币', rar: 2, price: 3000, col: '#ffd23a', icon: 'item_coin', desc: '在地下城里倒下时，可以原地满状态复活。获得后自动放进复活币栏。' });
defineItem('guard', { kind: 'use', name: '装备强化保护券', rar: 3, price: 12000, col: '#6ad0ff', icon: 'item_guard', desc: '在强化界面勾选使用：强化失败本应破碎时，装备不会破碎，但强化等级归零。' });
/* ---- 罐子（土罐） ---- */
var itemPotRoll = (lv, W) => { let r = Math.random() * W.reduce((a, b) => a + b[0], 0); for (const [w, f] of W) { r -= w; if (r <= 0) return f(lv); } return W[0][1](lv); };
defineItem('pot', { kind: 'use', name: '袖珍罐', rar: 1, price: 800, icon: 'item_pot', desc: '土罐亲手烧制的小罐子，打开能得到与自己等级相符的随机物品。',
  use: { open: lv => [itemPotRoll(lv, [[30, () => ({ key: pick(['hpM', 'mpM', 'hpL', 'bread', 'meat']), n: rndi(2, 5) })], [22, () => ({ key: 'crystal', n: rndi(8, 25) })], [30, () => ({ equip: true, rar: pick([1, 1, 2]) })], [12, () => ({ equip: true, rar: 3 })], [5, () => ({ equip: true, rar: 4 })], [1, () => ({ key: 'elixir', n: 1 })]])] } });
defineItem('potGold', { kind: 'use', name: '黄金袖珍罐', rar: 3, price: 6000, icon: 'item_pot_gold', desc: '金光闪闪的罐子，必定开出稀有以上的装备，极低几率开出史诗。',
  use: { open: lv => { const r = Math.random(); if (r < 0.02) { const E = rollEpic(lv); if (E) return [{ key: E.key }]; } return [{ equip: true, rar: r < 0.12 ? 4 : r < 0.45 ? 3 : 2 }]; } } });
/* ---- 材料 ---- */
defineItem('crystal', { kind: 'mat', name: '无色小晶块', rar: 0, price: 40, sellMul: 0.25, col: '#dfe8f0', icon: 'item_crystal', desc: '强化装备必需的材料。分解装备可以得到。' });
defineItem('c_red', { kind: 'mat', name: '红色小晶块', rar: 1, price: 120, col: '#ff5a4a', icon: 'item_crystal_red', desc: '蕴含火之力的晶块。' });
defineItem('c_blue', { kind: 'mat', name: '蓝色小晶块', rar: 1, price: 120, col: '#4a8aff', icon: 'item_crystal_blue', desc: '蕴含冰之力的晶块。' });
defineItem('c_white', { kind: 'mat', name: '白色小晶块', rar: 1, price: 120, col: '#fff6c0', icon: 'item_crystal_white', desc: '蕴含光之力的晶块。' });
defineItem('c_black', { kind: 'mat', name: '黑色小晶块', rar: 1, price: 120, col: '#6a3a8a', icon: 'item_crystal_black', desc: '蕴含暗之力的晶块。' });
defineItem('m_cloth', { kind: 'mat', name: '碎布片', rar: 0, price: 30, col: '#c8b090', icon: 'item_mat_cloth', desc: '分解布甲得到的碎布。' });
defineItem('m_leather', { kind: 'mat', name: '破旧的皮革', rar: 0, price: 30, col: '#8a5a30', icon: 'item_mat_leather', desc: '分解皮甲、轻甲得到的皮革。' });
defineItem('m_iron', { kind: 'mat', name: '生锈的铁片', rar: 0, price: 30, col: '#9a8a7a', icon: 'item_mat_iron', desc: '从武器、重甲、板甲上拆下来的铁片。' });
defineItem('m_bone', { kind: 'mat', name: '风化的碎骨', rar: 0, price: 30, col: '#e8e0c8', icon: 'item_mat_bone', desc: '分解首饰得到的碎骨。' });
defineItem('m_elem', { kind: 'mat', name: '下级元素结晶', rar: 2, price: 400, col: '#b36bff', icon: 'item_mat_elem', desc: '分解稀有、套装装备得到的元素结晶。' });
defineItem('m_elem2', { kind: 'mat', name: '上级元素结晶', rar: 3, price: 1600, col: '#ff6bd0', icon: 'item_mat_elem2', desc: '分解神器以上的装备得到的高纯度元素结晶。' });
defineItem('m_obsidian', { kind: 'mat', name: '黑曜石', rar: 3, price: 2000, col: '#3a2a4a', icon: 'item_mat_obsidian', desc: '暗黑雷鸣废墟深处偶尔能找到的黑色宝石。' });
/* ---- 装备深化：增幅 / 锻造 / 深渊派对的材料（规则见 game/gear.js、content/abyss.js） ---- */
defineItem('m_contra', { kind: 'mat', name: '矛盾的结晶体', rar: 3, price: 3000, sellMul: 0.1, col: '#ff5a8a', icon: 'item_m_contra', src: '深渊派对、Lv15 以上地下城的领主；凯丽处购买；分解增幅过的装备', desc: '增幅装备必需的结晶体，里面同时存在着两种互相排斥的力量。' });
defineItem('amp_purify', { kind: 'mat', name: '异界气息净化书', rar: 3, price: 6000, sellMul: 0.1, col: '#c080ff', icon: 'item_amp_purify', src: '凯丽处购买；深渊派对', desc: '净化装备上的“异界气息”，随机赋予一种异次元属性（红字），之后才能增幅。已有红字的装备可以重新净化（换一种红字，增幅等级不变）。只对 Lv15 以上、稀有品级以上的装备有效。' });
defineItem('amp_guard', { kind: 'mat', name: '增幅保护券', rar: 3, price: 20000, sellMul: 0.05, col: '#ff8ab0', icon: 'item_amp_guard', src: '凯丽处购买；商城', desc: '在增幅界面勾选使用：增幅失败时装备不会破碎、不会归零，只降 1 级（券被消耗）。' });
defineItem('amp_book', { kind: 'mat', name: '黄金增幅书', rar: 4, price: 30000, sellMul: 0.05, col: '#ffd23a', icon: 'item_amp_book', src: '商城；深渊派对', desc: '在增幅界面勾选使用：本次增幅成功率 +15%（最高 100%）。' });
defineItem('m_aura', { kind: 'mat', name: '强烈的气息', rar: 2, price: 600, sellMul: 0.2, col: '#ffb24a', icon: 'item_m_aura', src: 'Lv10 以上地下城的领主和精英；深渊派对', desc: '锻造武器用的材料，从强大的敌人身上散逸出来的气息。' });
defineItem('abyss_ticket', { kind: 'mat', name: '深渊派对邀请函', rar: 2, price: 4000, sellMul: 0.1, col: '#c05aff', icon: 'item_abyss_ticket', src: 'Lv12 以上地下城掉落（领主为主）；歌兰蒂斯处购买 / 兑换；每天第 3 次通关地下城时歌兰蒂斯赠送', desc: '进入深渊派对（格兰之森深渊、天空之城深渊）需要消耗 1 张。' });
defineItem('m_cosmos', { kind: 'mat', name: '宇宙灵魂', rar: 4, price: 5000, sellMul: 0.05, col: '#8ae0ff', icon: 'item_m_cosmos', src: '深渊派对（通关必得）', desc: '深渊派对里收集到的灵魂结晶。可以在歌兰蒂斯处兑换史诗装备。' });
defineItem('m_otherworld', { kind: 'mat', name: '浓密的异界精髓', rar: 3, price: 3000, sellMul: 0.1, col: '#6ad0a0', icon: 'item_m_otherworld', src: '深渊派对的深渊领主', desc: '异界气息浓缩成的精髓。可以在歌兰蒂斯处兑换异界套装。' });
defineItem('m_diamond', { kind: 'mat', name: '金刚石', rar: 3, price: 2500, col: '#bfefff', icon: 'item_mat_diamond', desc: '分解传说以上的装备得到的宝石，价值不菲。' });
defineItem('m_soul', { kind: 'mat', name: '灵魂之石', rar: 5, price: 15000, col: '#e080ff', icon: 'item_mat_soul', desc: '分解史诗装备得到的结晶，寄宿着装备的灵魂。' });
/* ---- 希洛克攻坚战 ---- */
defineItem('raid_petal', { kind: 'mat', name: '紫英花瓣', rar: 4, price: 1200, sellMul: 0.05, col: '#d8a0ff', icon: 'item_raid_petal', noSell: true, desc: '希洛克幻界中凝结的紫色花瓣。完成攻坚阶段后获得，可用于后续团本兑换。' });
defineItem('raid_immaterial', { kind: 'mat', name: '无形之息', rar: 4, price: 1800, sellMul: 0.05, col: '#b98cff', icon: 'item_raid_immaterial', noSell: true, desc: '无形之棺中凝结的融合材料，可在攻坚商店兑换希洛克融合装备。' });
/* ---- 称号（帕丽丝出售 / 任务奖励）：slot 'title'，没有耐久，不能强化 ----
   任务组发称号：giveItem(makeItem('title_xxx')) */
const defineTitle = (key, def) => defineItem(key, { kind: 'equip', slot: 'title', icon: def.rar >= 4 ? 'item_title3' : def.rar >= 3 ? 'item_title' : 'item_title2', durMax: 0, noEnhance: true, noDisassemble: true, ...def });
defineTitle('title_novice', { name: '初出茅庐', lvl: 1, rar: 1, price: 1500, st: { str: 3, int: 3, vit: 3, spr: 3 }, desc: '每个勇士都是从这里开始的。' });
defineTitle('title_learner', { name: '好学的冒险家', lvl: 5, rar: 1, price: 3000, st: { str: 5, int: 5, vit: 5, spr: 5 }, fx: { expUp: 0.03 }, desc: '经验获得量 +3%。' });
defineTitle('title_forest', { name: '格兰之森的守护者', lvl: 5, rar: 2, price: 6000, st: { str: 6, int: 6, vit: 6, spr: 6 }, fx: { mspd: 0.03 }, desc: '守护森林的勇士。' });
defineTitle('title_rich', { name: '黄金猎人', lvl: 8, rar: 2, price: 9000, st: { str: 4, int: 4, vit: 4, spr: 4 }, fx: { goldUp: 0.08 }, desc: '金币获得量 +8%。' });
defineTitle('title_brave', { name: '勇敢的冒险家', lvl: 10, rar: 2, price: 12000, st: { str: 10, int: 10, vit: 10, spr: 10, crit: 0.01, mcrit: 0.01 }, desc: '无所畏惧地踏入地下城。' });
defineTitle('title_iron', { name: '钢铁意志', lvl: 10, rar: 2, price: 12000, st: { vit: 12, spr: 12, hardness: 20 }, fx: { dmgReduce: 0.03 }, desc: '被攻击时的硬直更短。' });
defineTitle('title_wind', { name: '疾风之影', lvl: 12, rar: 3, price: 22000, st: { str: 8, int: 8, vit: 8, spr: 8 }, fx: { mspd: 0.05, aspd: 0.02, cspd: 0.02 }, desc: '快如疾风。' });
defineTitle('title_flame', { name: '炎之意志', lvl: 15, rar: 3, price: 28000, st: { str: 12, int: 12, vit: 12, spr: 12, fire: 12 }, fx: { dmgUp: 0.02 }, desc: '心中燃烧着不灭的火焰。' });
defineTitle('title_hero', { name: '赫顿玛尔的英雄', lvl: 15, rar: 3, price: 30000, st: { str: 15, int: 15, vit: 15, spr: 15 }, fx: { aspd: 0.02, cspd: 0.02 }, desc: '全城都在传颂你的名字。' });
defineTitle('title_sea', { name: '海之勇者', lvl: 10, rar: 3, price: 18000, st: { str: 10, int: 10, vit: 10, spr: 10, ice: 10 }, fx: { mspd: 0.02 }, desc: '乘风破浪的勇者。' });
defineTitle('title_tiger', { name: '白虎之魂', lvl: 15, rar: 3, price: 32000, st: { str: 14, int: 14, vit: 8, spr: 8 }, fx: { aspd: 0.025, cspd: 0.025, mspd: 0.025 }, desc: '攻击速度、施放速度、移动速度 +2.5%。' });
defineTitle('title_king', { name: '王之守护·风', lvl: 18, rar: 4, price: 45000, st: { str: 16, int: 16, vit: 16, spr: 16 }, fx: { aspd: 0.02, cspd: 0.02, mspd: 0.03 }, desc: '攻击速度 +2%，移动速度 +3%。' });
defineTitle('title_star', { name: '闪耀之星', lvl: 20, rar: 4, price: 60000, st: { str: 20, int: 20, vit: 20, spr: 20, crit: 0.02, mcrit: 0.02 }, fx: { mspd: 0.03, dmgUp: 0.03 }, desc: '帕丽丝的镇店之宝。' });
// 任务奖励专用称号（商店不卖）
defineTitle('title_goblin', { name: '哥布林克星', lvl: 3, rar: 2, noSell: false, shopOnly: true, noDrop: true, st: { str: 5, int: 5 }, fx: { dmgUp: 0.02 }, desc: '哥布林们听到你的名字就发抖。' });
defineTitle('title_slayer', { name: '格兰之森的解放者', lvl: 18, rar: 4, noDrop: true, st: { str: 18, int: 18, vit: 18, spr: 18 }, fx: { dmgUp: 0.04, critDmg: 0.05 }, desc: '将格兰之森从黑暗中解放的英雄。' });
defineTitle('title_kanina', { name: '卡妮娜的希望☆', lvl: 10, rar: 3, noDrop: true, st: { str: 8, int: 8, vit: 8, spr: 8 }, fx: { mspd: 0.02 }, desc: '收集了四色小晶块送给卡妮娜的冒险家。移动速度 +2%。' });
defineTitle('title_hunter', { name: '怪兽猎杀者', lvl: 12, rar: 3, noDrop: true, st: { str: 12, int: 12 }, fx: { dmgUp: 0.03 }, desc: '讨伐了无数怪物的猎手。' });
defineTitle('title_skycastle', { name: '天空之城的解放者', lvl: 23, rar: 4, noDrop: true, st: { str: 22, int: 22, vit: 22, spr: 22 }, fx: { dmgUp: 0.05, mspd: 0.03 }, desc: '登上天空之城、击败城主的英雄。移动速度 +3%。' });
defineTitle('title_basic', { name: '基础精通者', lvl: 5, rar: 2, noDrop: true, st: { str: 5, int: 5, vit: 5, spr: 5 }, fx: { cdr: 0.02 }, desc: '掌握了战斗的基础。' });
defineTitle('title_awaken', { name: '觉醒者', lvl: 18, rar: 4, noDrop: true, st: { str: 16, int: 16, vit: 16, spr: 16 }, fx: { cdr: 0.04 }, desc: '跨越了极限的勇士。' });
/* ---- 时装（帕丽丝）：官方 8 部位，同一套集齐有套装效果 ---- */
{
const AV_STAT = { av_hair: { cspd: 0.02 }, av_hat: { cspd: 0.02 }, av_face: { aspd: 0.02 }, av_chest: { aspd: 0.02 }, av_top: { str: 10, int: 10, vit: 10, spr: 10 }, av_bottom: { hp: 250, mp: 150 }, av_belt: { evade: 0.02 }, av_shoes: { mspd: 0.04 } };
const AV_NAME = { av_hair: '庆典发饰', av_hat: '庆典小礼帽', av_face: '庆典圆框眼镜', av_chest: '庆典领结', av_top: '庆典外套', av_bottom: '庆典短裙', av_belt: '庆典缎带腰带', av_shoes: '庆典小皮鞋' };
defineSet('av_festival', { name: '庆典时装套装', bonus: { 3: { st: { str: 8, int: 8, vit: 8, spr: 8 }, desc: '四维 +8' }, 5: { st: { mspd: 0.03, hp: 300 }, desc: '移动速度 +3%，HP 上限 +300' }, 8: { st: { aspd: 0.03, cspd: 0.03, dmgUp: 0.03 }, desc: '攻击 / 施放速度 +3%，伤害增加 3%' } } });
for (const s of AV_SLOTS) { defineItem(`${s}_festival`, { kind: 'equip', slot: s, lvl: 1, rar: 2, price: s === 'av_top' || s === 'av_bottom' ? 6000 : 3500, name: AV_NAME[s], set: 'av_festival', st: AV_STAT[s], icon: 'item_' + s, durMax: 0, noEnhance: true, noDisassemble: true, noDrop: true, desc: '帕丽丝精心设计的节日时装。' }); SETS.av_festival.pieces.push(`${s}_festival`); }
}
