/* =====================================================================
   物品库 · 史诗装备（固定名称 + 特效）与套装（2 / 3 / 5 件套效果）
   史诗：defineGear(key, { slot, wtype?/atype?, lvl, rar: 5, name, fx, desc })
   套装：defineSet(id, { name, bonus: { 2: { st, desc }, 3: {...}, 5: {...} } })，部件用 setPiece 注册
   ===================================================================== */
const defineEpic = (key, def) => defineGear(key, { rar: 5, ...def });
// ---- 史诗武器 ----
defineEpic('ep_katana', { slot: 'weapon', wtype: 'katana', lvl: 10, name: '破晓之刃·晨星', fx: { critDmg: 0.25, crit: 0.05, mcrit: 0.05 }, desc: '传说在黎明时分铸成的太刀，刀身会随着晨光发亮。' });
defineEpic('ep_greatsword', { slot: 'weapon', wtype: 'greatsword', lvl: 18, name: '裂地者·泰坦之怒', fx: { dmgUp: 0.1, hardness: 40 }, desc: '巨人族的遗物，一剑下去大地都会震动。' });
defineEpic('ep_lightsaber', { slot: 'weapon', wtype: 'lightsaber', lvl: 15, name: '光剑·雷鸣赤诚', fx: { aspd: 0.1, light: 30 }, desc: '雷光凝成的剑刃，挥动时噼啪作响。' });
defineEpic('ep_club', { slot: 'weapon', wtype: 'club', lvl: 13, name: '碎骨者·巨人之锤', fx: { stagger: 50, critDmg: 0.15 }, desc: '被它砸中的敌人，很久都爬不起来。' });
defineEpic('ep_revolver', { slot: 'weapon', wtype: 'revolver', lvl: 10, name: '沙漠之鹰·黄昏', fx: { critDmg: 0.2, crit: 0.08, mcrit: 0.08 }, desc: '黄昏时分最后一声枪响。' });
defineEpic('ep_handcannon', { slot: 'weapon', wtype: 'handcannon', lvl: 18, name: '天崩·歌利亚', fx: { dmgUp: 0.1, stagger: 40 }, desc: '一发就能轰塌城墙的巨炮。' });
defineEpic('ep_bowgun', { slot: 'weapon', wtype: 'bowgun', lvl: 15, name: '银月之翼', fx: { aspd: 0.12, mspd: 0.05 }, desc: '精灵工匠为月光下的猎手打造。' });
defineEpic('ep_staff', { slot: 'weapon', wtype: 'staff', lvl: 10, name: '星海之杖·永夜', fx: { critDmg: 0.2, mpRegen: 0.8 }, desc: '杖顶的水晶里，封着一整片星空。' });
defineEpic('ep_rod', { slot: 'weapon', wtype: 'rod', lvl: 18, name: '贤者之杖·阿斯特拉', fx: { cdr: 0.1, cspd: 0.1 }, desc: '伟大贤者留下的魔杖，咏唱变得轻而易举。' });
defineEpic('ep_broom', { slot: 'weapon', wtype: 'broom', lvl: 15, name: '夜之魔女的扫把', fx: { mspd: 0.12, cspd: 0.08, dark: 20 }, desc: '骑上它，连月亮都能追上。' });
// ---- 史诗防具 / 首饰 / 特殊装备 ----
defineEpic('ep_shoes', { slot: 'shoes', atype: 'light', lvl: 6, name: '疾风行者', fx: { mspd: 0.15, evade: 0.03 }, desc: '穿上它的人，脚下仿佛生了风。' });
defineEpic('ep_top', { slot: 'top', atype: 'plate', lvl: 8, name: '不灭者战甲', fx: { hpPct: 0.2, dmgReduce: 0.05 }, desc: '无论受了多重的伤，穿戴者都不会倒下。' });
defineEpic('ep_head', { slot: 'head', atype: 'cloth', lvl: 14, name: '智者的披肩', fx: { cdr: 0.08, mpPct: 0.1 }, desc: '据说是暗精灵大贤者的遗物。' });
defineEpic('ep_neck', { slot: 'neck', lvl: 10, name: '渊洋之心', fx: { cdr: 0.1 }, desc: '深海中沉睡了千年的宝石。' });
defineEpic('ep_ring', { slot: 'ring', lvl: 12, name: '时光之戒', fx: { aspd: 0.08, cspd: 0.08, crit: 0.05, mcrit: 0.05 }, desc: '戴上它，周围的时间都变慢了。' });
defineEpic('ep_bracelet', { slot: 'bracelet', lvl: 14, name: '炎龙之怒', fx: { atkPct: 0.1, fire: 20 }, desc: '炎龙的鳞片打磨成的手镯，摸上去还是烫的。' });
defineEpic('ep_stone', { slot: 'stone', lvl: 20, name: '晨星之眼', fx: { elemAll: 30, dmgUp: 0.05 }, desc: '晨星坠落时留下的眼泪。' });
defineEpic('ep_support', { slot: 'support', lvl: 20, name: '勇者的誓约', fx: { allStat: 25, critDmg: 0.1 }, desc: '初代勇者立下誓言时佩戴的护符。' });
/* ---- 套装 ---- */
function setPiece(setId, key, def) { const D = defineGear(key, { rar: 3, fx: {}, ...def, set: setId }); SETS[setId].pieces.push(key); return D; }
function armorSet(id, name, atype, lvl, rar, names, bonus) {
  defineSet(id, { name, bonus });
  ARMOR_SLOTS.forEach((s, i) => setPiece(id, `${id}_${s}`, { slot: s, atype, lvl, rar, name: names[i] }));
}
// Lv8 新手冒险家（稀有，3 件）
defineSet('set_novice', { name: '新手冒险家套装', bonus: { 2: { st: { hp: 300, mp: 150 }, desc: 'HP 上限 +300，MP 上限 +150' }, 3: { st: { mspd: 0.05, expUp: 0.05, str: 10, int: 10 }, desc: '移动速度 +5%，经验获得量 +5%，力量 / 智力 +10' } } });
setPiece('set_novice', 'set_novice_top', { slot: 'top', atype: 'light', lvl: 8, rar: 2, name: '冒险家的外套' });
setPiece('set_novice', 'set_novice_bottom', { slot: 'bottom', atype: 'light', lvl: 8, rar: 2, name: '冒险家的长裤' });
setPiece('set_novice', 'set_novice_shoes', { slot: 'shoes', atype: 'light', lvl: 8, rar: 2, name: '冒险家的旅行靴' });
// Lv12 三职业套装（神器，5 件）
armorSet('set_knight', '赫顿玛尔骑士团套装', 'heavy', 12, 3, ['骑士团胸甲', '骑士团护肩', '骑士团护腿', '骑士团腰带', '骑士团战靴'],
  { 2: { st: { defPct: 0.06, vit: 15 }, desc: '防御力 +6%，体力 +15' }, 3: { st: { hpPct: 0.08, str: 20 }, desc: 'HP 上限 +8%，力量 +20' }, 5: { st: { dmgUp: 0.06, hardness: 30, crit: 0.03 }, desc: '伤害增加 6%，硬直 +30，物理暴击 +3%' } });
armorSet('set_sage', '暗精灵贤者套装', 'cloth', 12, 3, ['贤者长袍', '贤者披肩', '贤者长裙', '贤者束带', '贤者便鞋'],
  { 2: { st: { int: 20, mpPct: 0.08 }, desc: '智力 +20，MP 上限 +8%' }, 3: { st: { cspd: 0.06, mcrit: 0.03 }, desc: '施放速度 +6%，魔法暴击 +3%' }, 5: { st: { cdr: 0.08, dmgUp: 0.05, elemAll: 12 }, desc: '技能冷却 -8%，伤害增加 5%，所有属性强化 +12' } });
armorSet('set_hunter', '荒野猎人套装', 'leather', 12, 3, ['猎人皮衣', '猎人皮护肩', '猎人皮裤', '猎人皮带', '猎人皮靴'],
  { 2: { st: { crit: 0.03, mcrit: 0.03 }, desc: '暴击率 +3%' }, 3: { st: { critDmg: 0.1, str: 15, int: 15 }, desc: '暴击伤害 +10%，力量 / 智力 +15' }, 5: { st: { aspd: 0.08, dmgUp: 0.05, hit: 0.05 }, desc: '攻击速度 +8%，伤害增加 5%，命中率 +5%' } });
// Lv18 进阶套装（神器，5 件）
armorSet('set_wind', '疾风游侠套装', 'light', 18, 3, ['游侠轻甲', '游侠轻护肩', '游侠轻护腿', '游侠轻腰带', '游侠轻靴'],
  { 2: { st: { mspd: 0.05, evade: 0.02 }, desc: '移动速度 +5%，回避率 +2%' }, 3: { st: { aspd: 0.05, cspd: 0.05, str: 20, int: 20 }, desc: '攻击 / 施放速度 +5%，力量 / 智力 +20' }, 5: { st: { dmgUp: 0.08, evade: 0.05, crit: 0.03, mcrit: 0.03 }, desc: '伤害增加 8%，回避率 +5%，暴击率 +3%' } });
armorSet('set_titan', '巨神要塞套装', 'plate', 18, 3, ['要塞板甲', '要塞板甲护肩', '要塞板甲护腿', '要塞板甲腰带', '要塞板甲战靴'],
  { 2: { st: { defPct: 0.06, vit: 20 }, desc: '防御力 +6%，体力 +20' }, 3: { st: { hpPct: 0.1, hardness: 30 }, desc: 'HP 上限 +10%，硬直 +30' }, 5: { st: { dmgReduce: 0.08, dmgUp: 0.06, str: 25, int: 25 }, desc: '受到的伤害 -8%，伤害增加 6%，力量 / 智力 +25' } });
// Lv16 首饰套装（神器，3 件）
defineSet('set_elf', { name: '精灵王的祝福', bonus: { 2: { st: { allStat: 15 }, desc: '四维 +15' }, 3: { st: { critDmg: 0.12, elemAll: 15, mpRegen: 0.3 }, desc: '暴击伤害 +12%，所有属性强化 +15，MP 恢复 +30%' } } });
setPiece('set_elf', 'set_elf_neck', { slot: 'neck', lvl: 16, name: '精灵王的项链' });
setPiece('set_elf', 'set_elf_bracelet', { slot: 'bracelet', lvl: 16, name: '精灵王的手镯' });
setPiece('set_elf', 'set_elf_ring', { slot: 'ring', lvl: 16, name: '精灵王的戒指' });
