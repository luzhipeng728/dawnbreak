/* =====================================================================
   商店：每个 NPC 一套货架（NPC 的 services 里写 'shop:<id>'）
   defineShop(id, { name, markup?, tabs: [{ name, goods: [key...] | (lvl, cls) => [key...] , cls? }] })
   - goods 写成函数时按玩家等级段生成（升级后自动刷新库存）；cls: true 表示可以勾“只看本职业”
   - 没定义的 shop id 会回退到通用杂货店（SHOPS._default）
   ===================================================================== */
const SHOPS = {};
function defineShop(id, def) { SHOPS[id] = { id, markup: 1, ...def }; }
// 按等级段挑装备：等级段 = [lvl - 8, lvl + 4]（显示下一段的装备，等级不够的标红）
function gearGoods({ slots, rars = [0, 1], wtypes, atypes, lo = -8, hi = 4, min = 1, max = 99 }) {
  return lvl => GEAR.filter(D => (!slots || slots.includes(D.slot)) && rars.includes(D.rar) && D.slot !== 'title' && !D.set && D.rar < 5
    && (!wtypes || wtypes.includes(D.wtype)) && (!atypes || atypes.includes(D.atype)) && D.lvl >= Math.max(min, lvl + lo) && D.lvl <= Math.min(max, lvl + hi) && (!D.cls || clsOpen(D.cls)))   // 还没开放的职业（格斗家 ready:false）的武器不上架
    .sort((a, b) => SLOTS.indexOf(a.slot) - SLOTS.indexOf(b.slot) || (a.wtype || a.atype || '').localeCompare(b.wtype || b.atype || '') || a.lvl - b.lvl || a.rar - b.rar).map(D => D.key);
}
defineShop('seria', { name: '赛丽亚的杂货', greet: '需要补给的话，随时来找我哦。', tabs: [
  { name: '药剂', goods: ['hpS', 'hpM', 'hpL', 'mpS', 'mpM', 'mpL'] },
  { name: '冒险用品', goods: ['coin', 'crystal', 'bread'] }] });
defineShop('linus', { name: '林纳斯的铁匠铺', greet: '看看吧，都是我亲手打的。', tabs: [
  { name: '武器', cls: true, goods: gearGoods({ slots: ['weapon'] }) },
  { name: '防具', goods: gearGoods({ slots: ARMOR_SLOTS }) },
  { name: '材料', goods: ['crystal'] }] });
defineShop('kiri', { name: '凯丽的枪械', greet: '天界的枪械技术，要不要试试？', tabs: [
  { name: '神枪手武器', goods: gearGoods({ slots: ['weapon'], wtypes: CLASS_WTYPES('gun'), rars: [0, 1, 2] }) },
  { name: '增幅材料', goods: ['m_contra', 'amp_purify', 'amp_guard'] }] });
// 格斗家武器（风振，赫顿玛尔中央广场）：格斗家开放后风振才挂出商店（content/world/towns.js）
defineShop('fengzhen', { name: '风振的拳脚铺', greet: '拳脚的家伙，要趁手才行。', tabs: [
  { name: '格斗家武器', goods: gearGoods({ slots: ['weapon'], wtypes: CLASS_WTYPES('fighter'), rars: [0, 1, 2] }) }] });
// 圣职者武器（歌兰蒂斯，赫顿玛尔市政街 · 大圣堂）：圣职者开放后歌兰蒂斯才挂出商店（content/world/towns.js）
defineShop('grandis', { name: '大圣堂的巨兵库', greet: '愿神的光辉，寄宿在你的巨兵之上。', tabs: [
  { name: '圣职者武器', goods: gearGoods({ slots: ['weapon'], wtypes: CLASS_WTYPES('priest'), rars: [0, 1, 2] }) }] });
defineShop('lorian', { name: '罗莉安的魔法用品', markup: 1.1, greet: '魔法师的东西，这里都有。', tabs: [
  { name: '魔法师武器', goods: gearGoods({ slots: ['weapon'], wtypes: CLASS_WTYPES('mage'), rars: [0, 1, 2] }) },
  { name: '首饰', goods: gearGoods({ slots: ACC_SLOTS, rars: [1, 2] }) },
  { name: '药剂', goods: ['mpS', 'mpM', 'mpL'] }] });
defineShop('sherlock', { name: '夏洛克的杂货铺', markup: 1.15, greet: '嘿嘿，都是好东西，便宜卖啦！', tabs: [
  { name: '武器', cls: true, goods: gearGoods({ slots: ['weapon'], rars: [1, 2], min: 10 }) },
  { name: '首饰', goods: gearGoods({ slots: ACC_SLOTS, rars: [1, 2], min: 10 }) },
  { name: '消耗品', goods: ['hpM', 'hpL', 'mpM', 'mpL', 'potStr', 'potSpd'] }] });
defineShop('kakun', { name: '卡坤的武器店', markup: 1.2, greet: '暗精灵的锻造工艺，你们人类可比不上。', tabs: [
  { name: '武器', cls: true, goods: gearGoods({ slots: ['weapon'], rars: [1, 2, 3], lo: -6, hi: 2 }) },
  { name: '材料', goods: ['crystal', 'm_elem', 'c_red', 'c_blue', 'c_white', 'c_black'] }] });
defineShop('kanina', { name: '卡妮娜的防具店', greet: '穿得结实一点，才能活着回来。', tabs: [
  { name: '防具', goods: gearGoods({ slots: ARMOR_SLOTS, rars: [0, 1, 2], min: 10, max: 25 }) }] });
defineShop('ophelia', { name: '奥菲利亚的防具店', markup: 1.25, greet: '只有经验丰富的冒险家才配得上这些。', tabs: [
  { name: '高级防具', goods: gearGoods({ slots: ARMOR_SLOTS, rars: [1, 2, 3], min: 20, lo: -10, hi: 6 }) }] });
defineShop('sinda', { name: '辛达的材料铺', greet: '防具和材料，按需购买。', tabs: [
  { name: '防具', goods: gearGoods({ slots: ARMOR_SLOTS, rars: [1] }) },
  { name: '材料', goods: ['crystal', 'm_cloth', 'm_leather', 'm_iron', 'm_bone', 'm_elem'] }] });
defineShop('daphne', { name: '达芙妮的首饰店', markup: 1.1, greet: '闪闪发光的首饰，一定很适合你。', tabs: [
  { name: '首饰', goods: gearGoods({ slots: ACC_SLOTS, rars: [0, 1, 2] }) },
  { name: '特殊装备', goods: gearGoods({ slots: SPECIAL_SLOTS, rars: [1, 2], lo: -10, hi: 5 }) }] });
defineShop('norton', { name: '诺顿的商店', greet: '用不上的装备拿来分解吧，材料也在这儿买。', tabs: [
  { name: '消耗品', goods: ['hpS', 'hpM', 'mpS', 'mpM', 'bread'] },
  { name: '材料', goods: ['crystal', 'm_elem', 'guard'] }] });
defineShop('sosia', { name: '索西雅的药剂', greet: '受伤了就要好好治疗哦。', tabs: [
  { name: '药剂', goods: ['hpS', 'hpM', 'hpL', 'mpS', 'mpM', 'mpL', 'elixir'] },
  { name: '秘药', goods: ['potStr', 'potSpd', 'potCrit'] }] });
defineShop('olan', { name: '奥兰奶奶的杂货', greet: '孩子，饿了吧？来点吃的。', tabs: [
  { name: '食物', goods: ['bread', 'meat'] },
  { name: '杂货', goods: ['hpS', 'mpS', 'crystal', 'coin'] }] });
defineShop('tuguan', { name: '土罐的罐子', greet: '罐子里装着什么，打开才知道！', tabs: [
  { name: '罐子', goods: ['pot', 'potGold'] }] });
defineShop('paris', { name: '帕丽丝的时装店', greet: '勇士也要穿得漂亮才行！', tabs: [
  { name: '称号', goods: ['title_novice', 'title_learner', 'title_forest', 'title_rich', 'title_brave', 'title_iron', 'title_sea', 'title_wind', 'title_flame', 'title_hero', 'title_tiger', 'title_king', 'title_star'] },
  { name: '时装', goods: () => AV_SLOTS.map(s => `${s}_festival`) }] });
defineShop('roget', { name: '罗杰的港口货栈', markup: 1.1, greet: '船上刚到的稀罕货，要不要看看？', tabs: [
  { name: '稀有物资', goods: ['elixir', 'fatigue', 'guard', 'potCrit', 'potStr', 'potGold'] },
  { name: '稀有材料', goods: ['m_elem', 'c_red', 'c_blue', 'c_white', 'c_black', 'm_diamond'] }] });
defineShop('_default', { name: '杂货店', greet: '随便看看吧。', tabs: [
  { name: '药剂', goods: ['hpS', 'hpM', 'mpS', 'mpM'] }, { name: '杂货', goods: ['crystal', 'bread'] }] });
