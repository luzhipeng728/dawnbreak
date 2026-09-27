/* =====================================================================
   物品库 · 史诗装备（固定名称 + 特效）与套装（2 / 3 / 5 件套效果）
   官方 60/70 版本最低的史诗是 Lv45 起；本作满级 30，所以把官方史诗的名字移到低等级段，效果按本作数值重新设计。
   没有对应官方史诗的部位按官方命名风格补齐。
   史诗：defineEpic(key, { slot, wtype?/atype?, lvl, name, fx, desc, proc? })
     proc：命中时的特殊效果（需要 bus 'playerHit' 事件）{ chance, cut?（削减目标当前 HP 比例）, burn?（灼伤秒数）, boss?（对领主是否生效） }
   套装：defineSet(id, { name, bonus: { 2: { st, desc }, 3: {...}, 5: {...} } })，部件用 setPiece / armorSet 注册
   ===================================================================== */
const defineEpic = (key, def) => defineGear(key, { rar: 5, ...def });
// ---- 史诗武器（名字来自官方史诗） ----
defineEpic('ep_shortsword', { slot: 'weapon', wtype: 'shortsword', lvl: 15, name: '无影剑-艾雷诺', st: { int: 19 }, fx: { crit: 0.04, mcrit: 0.04, critDmg: 0.12 }, desc: '传说中的名剑，剑身薄得几乎看不见。' });
defineEpic('ep_katana', { slot: 'weapon', wtype: 'katana', lvl: 10, name: '月之光芒', fx: { critDmg: 0.25, crit: 0.05, mcrit: 0.05 }, desc: '刀身映着月光，挥动时留下银色的残影。' });
defineEpic('ep_katana2', { slot: 'weapon', wtype: 'katana', lvl: 20, name: '十字斩刀-者', fx: { dmgUp: 0.08, crit: 0.03 }, proc: { chance: 0.03, cut: 0.3, boss: false }, desc: '攻击时有 3% 几率削减敌人 30% 的当前 HP（对领主无效）。' });
defineEpic('ep_club', { slot: 'weapon', wtype: 'club', lvl: 13, name: '地狱邪目', fx: { stagger: 50, critDmg: 0.15, dark: 20 }, desc: '钝器上镶着一只永不闭合的邪眼。' });
defineEpic('ep_greatsword', { slot: 'weapon', wtype: 'greatsword', lvl: 18, name: '屠戮之刃', fx: { dmgUp: 0.1, hardness: 40 }, desc: '饮过无数鲜血的巨刃。' });
defineEpic('ep_lightsaber', { slot: 'weapon', wtype: 'lightsaber', lvl: 22, name: '光剑-雷鸣赤诚', fx: { aspd: 0.08, light: 30, critDmg: 0.1 }, desc: '雷光凝成的剑刃，挥动时噼啪作响。' });
defineEpic('ep_revolver', { slot: 'weapon', wtype: 'revolver', lvl: 10, name: '沙漠之鹰-黄昏', fx: { critDmg: 0.2, crit: 0.08, mcrit: 0.08 }, desc: '黄昏时分最后一声枪响。' });
defineEpic('ep_handcannon', { slot: 'weapon', wtype: 'handcannon', lvl: 18, name: '吞日者', fx: { dmgUp: 0.08, fire: 30, stagger: 30 }, proc: { chance: 0.04, burn: 3 }, desc: '攻击时有 4% 几率使敌人灼伤。' });
defineEpic('ep_bowgun', { slot: 'weapon', wtype: 'bowgun', lvl: 15, name: '银月之翼', fx: { aspd: 0.1, mspd: 0.05 }, desc: '精灵工匠为月光下的猎手打造。' });
defineEpic('ep_staff', { slot: 'weapon', wtype: 'staff', lvl: 10, name: '星海之杖-永夜', fx: { critDmg: 0.2, mpRegen: 0.8 }, desc: '杖顶的水晶里，封着一整片星空。' });
defineEpic('ep_rod', { slot: 'weapon', wtype: 'rod', lvl: 18, name: '贤者之杖-阿斯特拉', fx: { cdr: 0.1, cspd: 0.1 }, desc: '伟大贤者留下的魔杖，咏唱变得轻而易举。' });
defineEpic('ep_broom', { slot: 'weapon', wtype: 'broom', lvl: 22, name: '夜之魔女的扫把', fx: { mspd: 0.1, cspd: 0.08, dark: 20 }, desc: '骑上它，连月亮都能追上。' });
// ---- 史诗防具 / 首饰 / 特殊装备 ----
defineEpic('ep_shoes', { slot: 'shoes', atype: 'light', lvl: 6, name: '疾风行者', fx: { mspd: 0.15, evade: 0.03 }, desc: '穿上它的人，脚下仿佛生了风。' });
defineEpic('ep_shoes2', { slot: 'shoes', atype: 'cloth', lvl: 16, name: '凯蒂的魔道短靴', st: { int: 20 }, fx: { cspd: 0.1, mspd: 0.06 }, desc: '魔道学者凯蒂最喜欢的短靴。' });
defineEpic('ep_top', { slot: 'top', atype: 'plate', lvl: 8, name: '不灭者战甲', fx: { hpPct: 0.2, dmgReduce: 0.05 }, desc: '无论受了多重的伤，穿戴者都不会倒下。' });
defineEpic('ep_head', { slot: 'head', atype: 'heavy', lvl: 14, name: '古拉德的火焰肩甲', fx: { fire: 25, hpPct: 0.08, cdr: 0.05 }, desc: '火焰领主古拉德的肩甲，至今仍在燃烧。' });
defineEpic('ep_head2', { slot: 'head', atype: 'light', lvl: 20, name: '地灵绝魂护肩', fx: { aspd: 0.06, cspd: 0.06, dmgUp: 0.05 }, desc: '寄宿着大地之灵的护肩。' });
defineEpic('ep_neck', { slot: 'neck', lvl: 10, name: '苍穹之影', fx: { cdr: 0.1 }, desc: '仰望天空时，吊坠里映出流动的云影。' });
defineEpic('ep_ring', { slot: 'ring', lvl: 12, name: '光精灵之戒', fx: { aspd: 0.08, cspd: 0.08, crit: 0.05, mcrit: 0.05, light: 15 }, desc: '光之精灵祝福过的戒指。' });
defineEpic('ep_bracelet', { slot: 'bracelet', lvl: 14, name: '骸德的水晶手镯', fx: { atkPct: 0.1, elemAll: 15 }, desc: '巨人骸德用水晶雕成的手镯。' });
defineEpic('ep_stone', { slot: 'stone', lvl: 20, name: '晨星之眼', fx: { elemAll: 30, dmgUp: 0.05 }, desc: '晨星坠落时留下的眼泪。' });
defineEpic('ep_support', { slot: 'support', lvl: 20, name: '勇者的誓约', fx: { allStat: 25, critDmg: 0.1 }, desc: '初代勇者立下誓言时佩戴的护符。' });
/* ---- 套装（官方 60 版有同名套装的用官方名；件数效果按本作数值设计） ---- */
function setPiece(setId, key, def) { const D = defineGear(key, { rar: 3, fx: {}, ...def, set: setId }); SETS[setId].pieces.push(key); return D; }
function armorSet(id, name, atype, lvl, rar, names, bonus) {
  defineSet(id, { name, bonus });
  ARMOR_SLOTS.forEach((s, i) => setPiece(id, `${id}_${s}`, { slot: s, atype, lvl, rar, name: names[i] }));
}
// Lv8 哥布林综合礼物套装（官方：皮甲 5 件）
armorSet('set_goblin', '哥布林综合礼物套装', 'leather', 8, 2, ['哥布林礼物皮衣', '哥布林礼物护肩', '哥布林礼物皮裤', '哥布林礼物皮带', '哥布林礼物皮鞋'],
  { 2: { st: { hp: 300 }, desc: 'HP 上限 +300' }, 3: { st: { def: 200, mdef: 200 }, desc: '物理 / 魔法防御 +200' }, 5: { st: { mspd: 0.05, expUp: 0.05, str: 12, int: 12 }, desc: '移动速度 +5%，经验获得量 +5%，力量 / 智力 +12' } });
// Lv12 三职业套装（神器）
armorSet('set_knight', '赫顿玛尔骑士团套装', 'heavy', 12, 3, ['骑士团胸甲', '骑士团护肩', '骑士团绑腿', '骑士团腰带', '骑士团长靴'],
  { 2: { st: { defPct: 0.06, vit: 15 }, desc: '防御力 +6%，体力 +15' }, 3: { st: { hpPct: 0.08, str: 20 }, desc: 'HP 上限 +8%，力量 +20' }, 5: { st: { dmgUp: 0.06, hardness: 30, crit: 0.03 }, desc: '伤害增加 6%，硬直 +30，物理暴击 +3%' } });
armorSet('set_sage', '暗精灵贤者套装', 'cloth', 12, 3, ['贤者衬衫', '贤者肩甲', '贤者短裤', '贤者腰带', '贤者短靴'],
  { 2: { st: { int: 20, mpPct: 0.08 }, desc: '智力 +20，MP 上限 +8%' }, 3: { st: { cspd: 0.06, mcrit: 0.03 }, desc: '施放速度 +6%，魔法暴击 +3%' }, 5: { st: { cdr: 0.08, dmgUp: 0.05, elemAll: 12 }, desc: '技能冷却 -8%，伤害增加 5%，所有属性强化 +12' } });
armorSet('set_hunter', '荒野猎人套装', 'leather', 12, 3, ['猎人皮衣', '猎人护肩', '猎人皮裤', '猎人皮带', '猎人皮鞋'],
  { 2: { st: { crit: 0.03, mcrit: 0.03 }, desc: '暴击率 +3%' }, 3: { st: { critDmg: 0.1, str: 15, int: 15 }, desc: '暴击伤害 +10%，力量 / 智力 +15' }, 5: { st: { aspd: 0.08, dmgUp: 0.05, hit: 0.05 }, desc: '攻击速度 +8%，伤害增加 5%，命中率 +5%' } });
// Lv18 巴尔克套装（官方：轻甲 5 件）、伽毕斯之力量套装（官方：布甲 5 件）
armorSet('set_balk', '巴尔克套装', 'light', 18, 3, ['巴尔克胸甲', '巴尔克护肩', '巴尔克绑腿', '巴尔克腰带', '巴尔克长靴'],
  { 2: { st: { mspd: 0.05, rdark: 11 }, desc: '移动速度 +5%，暗属性抗性 +11' }, 3: { st: { aspd: 0.05, cspd: 0.05, str: 20, int: 20 }, desc: '攻击 / 施放速度 +5%，力量 / 智力 +20' }, 5: { st: { dmgUp: 0.08, evade: 0.05, crit: 0.03, mcrit: 0.03 }, desc: '伤害增加 8%，回避率 +5%，暴击率 +3%' } });
armorSet('set_gabis', '伽毕斯之力量套装', 'cloth', 18, 3, ['伽毕斯衬衫', '伽毕斯肩甲', '伽毕斯短裤', '伽毕斯腰带', '伽毕斯短靴'],
  { 2: { st: { mpRegen: 0.3, int: 20 }, desc: 'MP 恢复速度 +30%，智力 +20' }, 3: { st: { cspd: 0.06, fire: 15, ice: 15 }, desc: '施放速度 +6%，火 / 冰属性强化 +15' }, 5: { st: { dmgUp: 0.08, cdr: 0.06, light: 15, dark: 15 }, desc: '伤害增加 8%，技能冷却 -6%，光 / 暗属性强化 +15' } });
// Lv22 暴龙重甲套装（官方：重甲 5 件）、巨神要塞套装（板甲）
armorSet('set_rex', '暴龙重甲套装', 'heavy', 22, 3, ['暴龙胸甲', '暴龙护肩', '暴龙绑腿', '暴龙腰带', '暴龙长靴'],
  { 2: { st: { hp: 600, defPct: 0.05 }, desc: 'HP 上限 +600，防御力 +5%' }, 3: { st: { str: 25, hardness: 30 }, desc: '力量 +25，硬直 +30' }, 5: { st: { dmgUp: 0.1, atkPct: 0.05 }, desc: '伤害增加 10%，攻击力 +5%' } });
armorSet('set_titan', '巨神要塞套装', 'plate', 22, 3, ['要塞胸甲', '要塞护肩', '要塞护腿', '要塞腰带', '要塞长靴'],
  { 2: { st: { defPct: 0.06, vit: 20 }, desc: '防御力 +6%，体力 +20' }, 3: { st: { hpPct: 0.1, hardness: 30 }, desc: 'HP 上限 +10%，硬直 +30' }, 5: { st: { dmgReduce: 0.08, dmgUp: 0.06, str: 25, int: 25 }, desc: '受到的伤害 -8%，伤害增加 6%，力量 / 智力 +25' } });
// Lv20 传承套装（官方：3 件 上衣 / 下装 / 鞋）
defineSet('set_throne', { name: '传承:神圣之斯罗尼骨质套装', bonus: { 2: { st: { allStat: 15, hp: 300 }, desc: '四维 +15，HP 上限 +300' }, 3: { st: { dmgUp: 0.06, critDmg: 0.08, mspd: 0.04 }, desc: '伤害增加 6%，暴击伤害 +8%，移动速度 +4%' } } });
setPiece('set_throne', 'set_throne_top', { slot: 'top', atype: 'light', lvl: 20, rar: 2, name: '传承:神圣之斯罗尼骨质上衣' });
setPiece('set_throne', 'set_throne_bottom', { slot: 'bottom', atype: 'light', lvl: 20, rar: 2, name: '传承:神圣之斯罗尼骨质下装' });
setPiece('set_throne', 'set_throne_shoes', { slot: 'shoes', atype: 'light', lvl: 20, rar: 2, name: '传承:神圣之斯罗尼骨质鞋' });
// Lv16 首饰套装（神器，3 件）
defineSet('set_elf', { name: '精灵王的祝福', bonus: { 2: { st: { allStat: 15 }, desc: '四维 +15' }, 3: { st: { critDmg: 0.12, elemAll: 15, mpRegen: 0.3 }, desc: '暴击伤害 +12%，所有属性强化 +15，MP 恢复 +30%' } } });
setPiece('set_elf', 'set_elf_neck', { slot: 'neck', lvl: 16, name: '精灵王的项链' });
setPiece('set_elf', 'set_elf_bracelet', { slot: 'bracelet', lvl: 16, name: '精灵王的手镯' });
setPiece('set_elf', 'set_elf_ring', { slot: 'ring', lvl: 16, name: '精灵王的戒指' });
/* ---- 史诗的命中特效（proc）：需要 bus 'playerHit' 事件 { target, dmg, crit } ---- */
bus.on('playerHit', e => {
  const w = inv.equip.weapon, t = e && e.target; if (!w || !t || t.dead || t.hp <= 0 || !itemActive(w)) return;
  if (t.team === 'p' || t.cls || (game.scene !== 'dungeon' && game.scene !== 'test')) return;   // 决斗场（PvP）不触发装备特效
  // 只直接改 target.hp（不走伤害函数，避免递归），并且不会把目标打死
  const P = (ITEMS[w.key] || {}).proc; if (!P || Math.random() >= P.chance) return;
  if (P.cut && !(t.boss && P.boss === false)) { const d = Math.max(1, Math.round(t.hp * P.cut)); t.hp = Math.max(1, t.hp - d); addNumber(d, t.x, t.y, t.z + 20, { col: '#ff4a8a' }); fxText('十字斩！', t.x, t.y, t.z + 30, { col: '#ff4a8a', size: 12 }); }
  if (P.burn && typeof addStatus === 'function') addStatus(t, 'burn', P.burn, { dps: (game.player.atk || 500) * 0.12, src: game.player });
});
