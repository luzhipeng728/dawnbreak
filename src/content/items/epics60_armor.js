/* =====================================================================
   装备 2.0 · B2 防具（散件、套装、防具领主神器）
   只写本块的物品；搬家 / 继承 / 领主神器 / 掉落 / 深渊归属一律用 gear60_api.js 的接口（用法见 docs/GEAR_PLAN_60.md §6）。
   注释只放在行尾或单独一行（一行中间的 // 会吞掉后面的字段）。
   落位（每个等级段每种材质都有一套史诗）：
     Lv10 原创两件套 ×5（Lv4~14 地下城的领主掉落，不进随机池）
     Lv20 三件套 ×5：老 key 原地改名成原创继承套（格兰之森深渊不变）；官方三件套按官方部位新建 key 到 Lv60 T1
     Lv28 五件套 ×5：整套搬到 Lv60 T3（魔界深渊 + 攻坚 0.3%），留原创继承套在 Lv28（天空之城深渊）
     Lv40 原创五件套 ×5（万年雪山深渊）、Lv48 原创五件套 ×5（诺斯玛尔深渊）
     官方 60 版 Lv50 散件（搬家 4 + 新增 9）、Lv55 散件 12；原创补缺 Lv45 ×7、Lv57 ×6；防具领主神器 ×14
   ===================================================================== */
{
const EP = (key, def) => defineEpic(key, def);
const piece = (setId, key, def) => { const D = defineGear(key, { rar: 5, fx: {}, icon: 'item_' + key, ...def, set: setId }); SETS[setId].pieces.push(key); return D; };
const ORIG = '（本作原创）';
const SNOW = '万年雪山深渊', NORSE = '诺斯玛尔深渊';
// 按部位建一套：slots = { <部位>: 名字 }
function armorSet(id, name, atype, lvl, slots, bonus, extra = {}) {
  defineSet(id, { name, bonus, epic: true });
  for (const s of ARMOR_SLOTS) if (slots[s]) piece(id, `${id}_${s}`, { slot: s, atype, lvl, name: slots[s], ...extra });
}

/* ---------------- Lv10 原创两件套（1~10 段每种材质一套；只在低级地下城的领主表里掉（noDrop：不进随机池，不稀释 11~20 的随机史诗）） ---------------- */
armorSet('set_ar_sprout', '林语学徒', 'cloth', 10, { head: '林语学徒的兜帽', bottom: '林语学徒的长裙' }, {
  2: { st: { dmgUp: 0.04, str: 10, int: 10 }, desc: '【林语】伤害增加 4%，力量 / 智力 +10；击杀敌人时 25% 几率恢复 4% MP', proc: { on: 'kill', chance: 0.25, act: 'heal', mp: 0.04 } } },
  { noDrop: true, desc: '洛兰的树精教会学徒的第一套法衣，衣角还冒着嫩芽。' + ORIG });
armorSet('set_ar_goblin', '哥布林猎手', 'leather', 10, { bottom: '哥布林猎手的皮裤', belt: '哥布林猎手的战利品腰带' }, {
  2: { st: { dmgUp: 0.04, crit: 0.02, mcrit: 0.02 }, desc: '【猎手】伤害增加 4%，暴击率 +2%；暴击时 10% 几率补上一刀（100% 伤害）', proc: { on: 'crit', chance: 0.1, cd: 1, act: 'strike', mul: 1.0, vis: 'slash', col: '#d8b070', name: '补刀！' } } },
  { noDrop: true, desc: '腰带上挂满了哥布林的獠牙和耳朵——猎手的战利品。' + ORIG });
armorSet('set_ar_thunder', '雷鸣哨兵', 'light', 10, { head: '雷鸣哨兵护肩', belt: '雷鸣哨兵腰带' }, {
  2: { st: { dmgUp: 0.04, aspd: 0.03, cspd: 0.03 }, desc: '【落雷】伤害增加 4%，攻击 / 施放速度 +3%；攻击时 5% 几率召唤落雷（110% 光属性伤害）', proc: { chance: 0.05, cd: 1, act: 'strike', mul: 1.1, elem: 'light', vis: 'bolt', name: '落雷！' } } },
  { noDrop: true, desc: '雷鸣废墟的哨兵留下的轻甲，铆钉上还跳着电火花。' + ORIG });
armorSet('set_ar_tauhorn', '牛角破阵', 'heavy', 10, { head: '牛角破阵肩甲', bottom: '牛角破阵胫甲' }, {
  2: { st: { dmgUp: 0.03, hpPct: 0.05, stagger: 20 }, desc: '【冲撞】伤害增加 3%，HP 上限 +5%，僵直度 +20；被击时 12% 几率撞开周围的敌人（120% 伤害，冷却 3 秒）', proc: { on: 'hurt', chance: 0.12, cd: 3, act: 'strike', mul: 1.2, aoe: 110, vis: 'nova', col: '#e08050', name: '牛角冲撞！' } } },
  { noDrop: true, desc: '用牛头怪的角镶边的重甲，冲进人群时谁也拦不住。' + ORIG });
armorSet('set_ar_oakguard', '橡木守卫', 'plate', 10, { head: '橡木守卫头盔', belt: '橡木守卫腰带' }, {
  2: { st: { dmgUp: 0.03, dmgReduce: 0.03, defPct: 0.05 }, desc: '【橡木】伤害增加 3%，受到的伤害 -3%，防御力 +5%；HP 低于 30% 时获得吸收 15% HP 上限伤害的护盾（冷却 45 秒）', proc: { on: 'lowhp', cd: 45, act: 'shield', amt: 0.15, dur: 6, name: '橡木之心' } } },
  { noDrop: true, desc: '洛兰守林人用千年橡木和铁箍打成的板甲。' + ORIG });

/* ---------------- Lv20 三件套：老 key 原地改名成原创继承套（数值 / 特效 / 深渊归属不变），官方三件套回到 Lv60 ---------------- */
const RENAME20 = {
  set_witch: ['绯焰祭司', ['绯焰祭司的法袍', '绯焰祭司的长裙', '绯焰祭司的饰带'], '侍奉太阳的祭司穿的法袍，橙红的火纹一年四季都在发烫。', '愤怒魔女的炙焰战袍'],
  set_ironbeast: ['铁鬃猎手', ['铁鬃猎手皮甲', '铁鬃猎手皮裤', '铁鬃猎手皮带'], '用铁鬃野猪的皮缝的猎装，鬃毛硬得像钢针。', '千年玄铁兽'],
  set_krom: ['琥珀蜂刺', ['琥珀蜂刺胸甲', '琥珀蜂刺绑腿', '琥珀蜂刺腰带'], '琥珀色的轻甲上画着黑色条纹，穿上它出手像蜂刺一样快。', '克罗姆的生命'],
  set_xuanming: ['暮钟守卫', ['暮钟守卫胸甲', '暮钟守卫绑腿', '暮钟守卫腰带'], '钟楼守卫的青铜重甲，每一次钟响都能让人重新站起来。', '玄冥精灵'],
  set_ruins: ['灰岩壁垒', ['灰岩壁垒胸甲', '灰岩壁垒护腿', '灰岩壁垒腰带'], '从格兰之森的灰岩山里凿出来的板甲，长满了青苔。', '古代遗迹守护者'],
};
for (const id in RENAME20) {
  const [name, names, desc, from] = RENAME20[id];
  SETS[id].name = name;
  ['top', 'bottom', 'belt'].forEach((s, i) => redefEpic(`${id}_${s}`, { name: names[i], desc: `${desc}（本作原创，继承自「${from}」）` }));
}
// 官方 70 版 Lv60 三件套（官方部位，Lv60 T1）：时空之门后段 / 希洛克的领主掉落
function set60(id, name, atype, slots, bonus, desc) { armorSet(id, name, atype, 60, slots, bonus, { tier: 1, desc }); }
set60('set_ar_witch', '愤怒魔女的炙焰战袍', 'cloth', { head: '炙焰魔女的斗篷', top: '炙焰魔女的长袍', bottom: '炙焰魔女的长裤' }, {
  2: { st: { fire: 20, str: 28, int: 28 }, desc: '火属性强化 +20，力量 / 智力 +28' },
  3: { st: { cspd: 0.06, dmgUp: 0.06, fire: 14 }, desc: '【属性流】施放速度 +6%，伤害增加 6%，火属性强化 +14；攻击时 7% 几率引发炙焰爆裂（周围 210% 火属性伤害）', proc: { chance: 0.07, cd: 1, act: 'strike', mul: 2.1, aoe: 140, elem: 'fire', vis: 'fire', name: '炙焰爆裂！' } } },
  '愤怒的魔女留下的战袍，火焰从未熄灭。（官方 70 版 Lv60 布甲三件套：斗篷 / 长袍 / 长裤）');
set60('set_ar_ironbeast', '千年玄铁兽', 'leather', { top: '千年玄铁兽胸甲', bottom: '千年玄铁兽护腿', belt: '千年玄铁兽腰带' }, {
  2: { st: { crit: 0.05, mcrit: 0.05, str: 28, int: 28 }, desc: '暴击率 +5%，力量 / 智力 +28' },
  3: { st: { critDmg: 0.22, dmgUp: 0.08 }, desc: '【暴击流】暴击伤害 +22%，伤害增加 8%；暴击时 10% 几率撕咬（200% 伤害）', proc: { on: 'crit', chance: 0.1, cd: 0.5, act: 'strike', mul: 2.0, vis: 'slash', col: '#c8d0dc', name: '玄铁獠牙' } } },
  '千年玄铁兽的皮，刀枪不入。（官方 70 版 Lv60 皮甲三件套：胸甲 / 护腿 / 腰带）');
set60('set_ar_krom', '克罗姆的生命', 'light', { head: '克罗姆的生命护肩', top: '克罗姆的生命护甲', bottom: '克罗姆的生命护腿' }, {
  2: { st: { hpPct: 0.1, aspd: 0.05, cspd: 0.05, str: 28, int: 28 }, desc: 'HP 上限 +10%，攻击 / 施放速度 +5%，力量 / 智力 +28' },
  3: { st: { aspd: 0.07, cspd: 0.07, mspd: 0.07, dmgUp: 0.08 }, desc: '【攻速流】攻击 / 施放 / 移动速度 +7%，伤害增加 8%；攻击时 5% 几率长出生命之藤（200% 伤害）；击杀敌人时 30% 几率恢复 4% HP',
    proc: [{ chance: 0.05, cd: 1, act: 'strike', mul: 2.0, vis: 'petal', col: '#8aff9a', name: '生命之藤' }, { on: 'kill', chance: 0.3, act: 'heal', hp: 0.04 }] } },
  '克罗姆用生命之树的藤蔓编成的轻甲。（官方 70 版 Lv60 轻甲三件套：护肩 / 护甲 / 护腿）');
set60('set_ar_xuanming', '玄冥精灵', 'heavy', { head: '时间支配者斗篷', top: '空间支配者胸甲', belt: '记忆支配者腰带' }, {
  2: { st: { cdr: 0.06, dark: 13, ice: 13, str: 28, int: 28 }, desc: '技能冷却 -6%，暗 / 冰属性强化 +13，力量 / 智力 +28' },
  3: { st: { cdr: 0.08, dmgUp: 0.09 }, desc: '【冷却流】技能冷却 -8%，伤害增加 9%；施放技能时 6% 几率重置冷却，10% 几率呼出玄冥寒息（周围 200% 冰属性伤害，冷却 2 秒）',
    proc: [{ on: 'skill', chance: 0.06, act: 'reset', name: '玄冥！' }, { on: 'skill', chance: 0.1, cd: 2, act: 'strike', mul: 2.0, aoe: 130, elem: 'ice', vis: 'ice', name: '玄冥寒息' }] } },
  '支配时间、空间与记忆的玄冥精灵守护着这身重甲。（官方 70 版 Lv60 重甲三件套：时间支配者斗篷 / 空间支配者胸甲 / 记忆支配者腰带）');
set60('set_ar_ruins', '古代遗迹守护者', 'plate', { top: '古代遗迹守护者胸甲', bottom: '古代遗迹守护者护腿', shoes: '古代遗迹守护者战靴' }, {
  2: { st: { defPct: 0.1, hpPct: 0.1, str: 28, int: 28 }, desc: '防御力 +10%，HP 上限 +10%，力量 / 智力 +28' },
  3: { st: { dmgReduce: 0.1, dmgUp: 0.08, hardness: 40 }, desc: '【生存流】受到的伤害 -10%，伤害增加 8%，硬直 +40；被击时 12% 几率遗迹反击（周围 200% 伤害，冷却 2 秒）；HP 低于 30% 时获得吸收 30% HP 上限伤害的护盾（冷却 45 秒）',
    proc: [{ on: 'hurt', chance: 0.12, cd: 2, act: 'strike', mul: 2.0, aoe: 140, vis: 'holy', col: '#7fe8d8', name: '遗迹反击' }, { on: 'lowhp', cd: 45, act: 'shield', amt: 0.3, dur: 8, name: '遗迹守护' }] } },
  '古代遗迹的守护者代代穿着的板甲。（官方 70 版 Lv60 板甲三件套：胸甲 / 护腿 / 战靴）');

/* ---------------- Lv28 五件套 → Lv60 T3（官方 80 版 Lv70）；原创继承套留在 Lv28（天空之城深渊） ----------------
   先继承（inheritSet 复制的是当时的件数效果），再搬家换成 T3 的件数效果 */
const INH28 = {
  set_tremor: ['set_ar_nightsilk', '夜幕织咒', { top: '夜幕织咒长袍', head: '夜幕织咒披肩', bottom: '夜幕织咒长裙', belt: '夜幕织咒束带', shoes: '夜幕织咒软靴' }, '用夜空里抽出来的丝线织成的法衣，星星在袖口上一闪一闪。'],
  set_reaper: ['set_ar_crimsonfang', '猩红猎牙', { top: '猩红猎牙皮甲', head: '猩红猎牙护肩', bottom: '猩红猎牙皮裤', belt: '猩红猎牙腰带', shoes: '猩红猎牙短靴' }, '缀满白狼獠牙的猩红皮甲，猎人从不空手而归。'],
  set_arad: ['set_ar_cloudwing', '云翼巡礼', { top: '云翼巡礼胸甲', head: '云翼巡礼护肩', bottom: '云翼巡礼绑腿', belt: '云翼巡礼腰带', shoes: '云翼巡礼短靴' }, '天空之城巡礼者的轻甲，金色的小翅膀托着云朵。'],
  set_evilgod: ['set_ar_lavaforge', '熔狱铁卫', { top: '熔狱铁卫胸甲', head: '熔狱铁卫肩甲', bottom: '熔狱铁卫胫甲', belt: '熔狱铁卫腰带', shoes: '熔狱铁卫战靴' }, '在熔岩里淬火的黑铁重甲，裂缝里还流着岩浆。'],
  set_kingtear: ['set_ar_oathshield', '圣誓壁垒', { top: '圣誓壁垒胸甲', head: '圣誓壁垒肩甲', bottom: '圣誓壁垒护腿', belt: '圣誓壁垒腰带', shoes: '圣誓壁垒战靴' }, '立下守护誓言的骑士才能穿上的钴蓝板甲。'],
};
for (const id in INH28) { const [nid, name, pieces, desc] = INH28[id]; inheritSet(id, nid, { name, pieces, desc: `${desc}（本作原创，继承自「${SETS[id].name}」）` }); }
// 老部件的定义是 fx: {}（defineGear 之后变成 undefined），继承部件也留一个空 fx，和快照逐字一致（test/gear60.mjs 的继承一致检查）
for (const id in INH28) for (const k of SETS[INH28[id][0]].pieces) ITEMS[k].fx = ITEMS[k].fx || {};
const T3 = { lvl: 60, tier: 3 };
moveSet('set_tremor', { ...T3, bonus: {
  2: { st: { cspd: 0.06, mspd: 0.06 }, desc: '施放速度 +6%，移动速度 +6%' },
  3: { st: { str: 56, int: 56, dmgUp: 0.05 }, desc: '力量 / 智力 +56，伤害增加 5%' },
  5: { st: { dmgUp: 0.12, cspd: 0.05 }, desc: '【群战流】伤害增加 12%，施放速度 +5%；每击杀 1 个敌人攻击力 +4%（最多 10 层，持续 8 秒），并有 15% 几率让周围的敌人颤栗（260% 暗属性伤害）',
    proc: [{ on: 'kill', act: 'buff', buff: { atk: 0.04 }, dur: 8, stack: 10, key: 'tremor', name: '颤栗', col: '#c05aff' }, { on: 'kill', chance: 0.15, cd: 1, act: 'strike', mul: 2.6, aoe: 160, elem: 'dark', vis: 'dark', col: '#c05aff', name: '战场颤栗！' }] } },
  desc: '战场上让敌人颤栗的丝绸战衣。（官方 80 版 Lv70 布甲五件套）' });
moveSet('set_reaper', { ...T3, pieces: { shoes: { name: '龙光银翼短靴' } }, bonus: {
  2: { st: { crit: 0.06, mcrit: 0.06 }, desc: '暴击率 +6%' },
  3: { st: { str: 56, int: 56, critDmg: 0.18 }, desc: '力量 / 智力 +56，暴击伤害 +18%' },
  5: { st: { critDmg: 0.22, dmgUp: 0.13 }, desc: '【暴击流】暴击伤害 +22%，伤害增加 13%；暴击时 15% 几率降下红色闪电（260% 伤害）并使敌人出血',
    proc: [{ on: 'crit', chance: 0.15, cd: 0.5, act: 'strike', mul: 2.6, vis: 'bolt', col: '#ff3a3a', name: '红色闪电' }, { on: 'crit', chance: 0.15, act: 'status', status: 'bleed', dur: 4, dps: 0.2 }] } },
  desc: '冥王的眷属穿过的皮甲，专收敌人的心脏。（官方 80 版 Lv70 皮甲五件套）' });
moveSet('set_arad', { ...T3, bonus: {
  2: { st: { aspd: 0.08, cspd: 0.08 }, desc: '攻击 / 施放速度 +8%' },
  3: { st: { str: 56, int: 56, mspd: 0.1, dmgReduce: 0.05 }, desc: '力量 / 智力 +56，移动速度 +10%，受到的伤害 -5%' },
  5: { st: { dmgUp: 0.15, aspd: 0.06, cspd: 0.06 }, desc: '【攻速流】伤害增加 15%，攻击 / 施放速度 +6%；每次命中获得 1 层疾风之息（攻速 / 施放 +2%、移速 +1%），最多 10 层，3 秒不命中消失；攻击时 4% 几率刮起阿拉德之风（周围 250% 伤害）',
    proc: [{ act: 'buff', buff: { aspd: 0.02, cspd: 0.02, mspd: 0.01 }, dur: 3, stack: 10, key: 'arad', name: '疾风之息', col: '#8affc8' }, { chance: 0.04, cd: 1, act: 'strike', mul: 2.5, aoe: 150, vis: 'nova', col: '#8affc8', name: '阿拉德之风！' }] } },
  desc: '吹遍阿拉德大陆的风，凝成了这身轻甲。（官方 80 版 Lv70 轻甲五件套）' });
moveSet('set_evilgod', { ...T3, pieces: { bottom: { name: '邪神之怒胫甲' }, shoes: { name: '邪神之怒短靴' } }, bonus: {
  2: { st: { hp: 1500, aspd: 0.06, resAll: 20 }, desc: 'HP 上限 +1500，攻击速度 +6%，所有属性抗性 +20' },
  3: { st: { str: 56, int: 56, hpPct: 0.1 }, desc: '力量 / 智力 +56，HP 上限 +10%' },
  5: { st: { dmgUp: 0.15, hardness: 50 }, desc: '【残血流】伤害增加 15%，硬直 +50；攻击时 5% 几率喷出邪神之焰（周围 260% 火属性伤害）；HP 低于 30% 时恢复 30% HP，并在 10 秒内伤害 +50%（冷却 60 秒）',
    proc: [{ chance: 0.05, cd: 1, act: 'strike', mul: 2.6, aoe: 150, elem: 'fire', vis: 'fire', col: '#ff3a3a', name: '邪神之焰' }, { on: 'lowhp', cd: 60, act: 'heal', hp: 0.3, name: '邪神之怒！', txtCol: '#ff3a3a' }, { on: 'lowhp', cd: 60, act: 'buff', buff: { dmg: 0.5 }, dur: 10, key: 'evilgod', name: '邪神之怒', col: '#ff3a3a' }] } },
  desc: '邪神的怒火灌注在这身重甲里。（官方 80 版 Lv70 重甲五件套）' });
moveSet('set_kingtear', { ...T3, bonus: {
  2: { st: { defPct: 0.12, vit: 40, spr: 40 }, desc: '防御力 +12%，体力 / 精神 +40' },
  3: { st: { hpPct: 0.14, hardness: 50, str: 56, int: 56 }, desc: 'HP 上限 +14%，硬直 +50，力量 / 智力 +56' },
  5: { st: { dmgUp: 0.15, dmgReduce: 0.1 }, desc: '【守护流】伤害增加 15%，受到的伤害 -10%；攻击时 8% 几率削弱敌人：目标受到的伤害 +15%，持续 6 秒；被击时 12% 几率落下王者之泪（周围 250% 光属性伤害，冷却 3 秒）',
    proc: [{ chance: 0.08, act: 'debuff', taken: 0.15, dur: 6, key: 'kingtear', vis: 'holy', col: '#ffe8a0', name: '王者之威' }, { on: 'hurt', chance: 0.12, cd: 3, act: 'strike', mul: 2.5, aoe: 160, elem: 'light', vis: 'holy', col: '#a0d8ff', name: '王者之泪' }] } },
  desc: '为守护王座流下的泪，铸成了最坚固的板甲。（官方 80 版 Lv70 板甲五件套）' });

/* ---------------- 官方 60 版 Lv50 散件：搬家 4 件（留继承装备）+ 新增 9 件 ---------------- */
inheritEpic('ep_head', 'ep_head_emberwolf', { name: '余烬狼首肩甲', desc: '雕成狼头的重肩甲，獠牙缝里一直闷着余烬。（本作原创，继承自「古拉德的火焰肩甲」）' });
inheritEpic('ep_head2', 'ep_head_stonespirit', { name: '岩灵低语护肩', desc: '长着青苔的石质护肩，贴耳能听见大地之灵的低语。（本作原创，继承自「地灵绝魂护肩」）' });
inheritEpic('ep_shoes2', 'ep_shoes_starwalk', { name: '星尘漫步短靴', desc: '每走一步都会洒下一点星尘的紫色短靴。（本作原创，继承自「凯蒂的魔道短靴」）' });
inheritEpic('ep_shoes_pisco', 'ep_shoes_frostglide', { name: '霜刃滑行长靴', desc: '靴底装着冰刃，在雪地上能像滑冰一样飞驰。（本作原创，继承自「彼斯科的寒光长靴」）' });
const O50 = '（官方 60 版 Lv50 史诗）', O55 = '（官方 60 版 Lv55 史诗）';
moveEpic('ep_head', { lvl: 50, fx: { fire: 15, cdr: 0.05, dmgUp: 0.015 }, desc: '火焰领主古拉德的肩甲，至今仍在燃烧。' + O50 });
moveEpic('ep_head2', { lvl: 50, fx: { aspd: 0.02, cspd: 0.02, dmgUp: 0.015 }, desc: '寄宿着大地之灵的护肩。' + O50 });
moveEpic('ep_shoes2', { lvl: 50, st: { int: 30 }, fx: { cspd: 0.03, mspd: 0.08, dmgUp: 0.015 }, desc: '魔道学者凯蒂最喜欢的短靴。' + O50 });
moveEpic('ep_shoes_pisco', { lvl: 50, fx: { ice: 15, mspd: 0.1, crit: 0.03, mcrit: 0.03, dmgUp: 0.01 }, desc: '靴刃上闪着寒光。' + O50 });
EP('ep_belt_earthsoul', { slot: 'belt', atype: 'light', lvl: 50, name: '地灵绝魂腰带', fx: { aspd: 0.015, cspd: 0.015, hardness: 20, dmgUp: 0.015 }, desc: '系着大地之灵的腰带，脚下再滑也站得稳。' + O50 });
EP('ep_shoes_earthsoul', { slot: 'shoes', atype: 'light', lvl: 50, name: '地灵绝魂长靴', fx: { mspd: 0.1, aspd: 0.01, cspd: 0.01, dmgUp: 0.01 }, desc: '踏过的地面会微微隆起，替主人托住脚步。' + O50 });
EP('ep_belt_gurad', { slot: 'belt', atype: 'heavy', lvl: 50, name: '古拉德的火焰腰带', fx: { fire: 15, hpPct: 0.04, dmgUp: 0.01 }, desc: '火焰领主古拉德的腰带，扣环是一团不灭的火。' + O50 });
EP('ep_shoes_gurad', { slot: 'shoes', atype: 'heavy', lvl: 50, name: '古拉德的火焰短靴', fx: { fire: 14, mspd: 0.08, dmgUp: 0.01 },
  proc: { on: 'kill', chance: 0.2, cd: 2, act: 'strike', mul: 1.7, aoe: 130, elem: 'fire', vis: 'fire', name: '余火', desc: '击杀敌人时 20% 几率在脚下引燃余火（周围 170% 火属性伤害，冷却 2 秒）。' }, desc: '走过的地方会留下一串燃烧的脚印。' + O50 });
EP('ep_head_borodin', { slot: 'head', atype: 'plate', lvl: 50, name: '波罗丁的天祈头盔', fx: { light: 15, dmgReduce: 0.04, dmgUp: 0.01 },
  proc: { on: 'hurt', chance: 0.12, cd: 3, act: 'strike', mul: 1.6, aoe: 130, elem: 'light', vis: 'holy', name: '天祈', desc: '被击时 12% 几率降下天祈之光（周围 160% 光属性伤害，冷却 3 秒）。' }, desc: '圣骑士波罗丁向天祈祷时戴的头盔。' + O50 });
EP('ep_shoes_borodin', { slot: 'shoes', atype: 'plate', lvl: 50, name: '波罗丁的天祈长靴', fx: { light: 14, mspd: 0.08, hpPct: 0.04, dmgUp: 0.01 }, desc: '圣骑士波罗丁的长靴，据说从没后退过一步。' + O50 });
EP('ep_head_xuanwu', { slot: 'head', atype: 'heavy', lvl: 50, name: '玄武护魂肩甲', fx: { ice: 15, defPct: 0.06, dmgUp: 0.01 },
  proc: { on: 'lowhp', cd: 50, act: 'shield', amt: 0.2, dur: 8, name: '玄武护魂', desc: 'HP 低于 30% 时玄武显灵：8 秒内吸收最多 20% HP 上限的伤害（冷却 50 秒）。' }, desc: '龟甲纹的重肩甲，里面沉睡着玄武的魂。' + O50 });
EP('ep_belt_monica', { slot: 'belt', atype: 'cloth', lvl: 50, name: '莫妮卡的复古腰带', fx: { cspd: 0.025, cdr: 0.05, dmgUp: 0.01 }, desc: '莫妮卡从祖母的衣柜里翻出来的腰带，样式老但很好用。' + O50 });
EP('ep_shoes_atlas', { slot: 'shoes', atype: 'leather', lvl: 50, name: '阿特拉斯的七宗长靴', fx: { crit: 0.03, mcrit: 0.03, mspd: 0.08, dmgUp: 0.015 },
  proc: { on: 'crit', chance: 0.07, cd: 1, act: 'strike', mul: 1.7, elem: 'dark', vis: 'dark', name: '七宗之罚', desc: '暴击时 7% 几率降下七宗之罚（170% 暗属性伤害）。' }, desc: '阿特拉斯用七种罪孽缝成的长靴。' + O50 });

/* ---------------- 官方 60 版 Lv55 散件（上衣 / 下装） ---------------- */
EP('ep_top_earthsoul', { slot: 'top', atype: 'light', lvl: 55, name: '地灵绝魂胸甲', fx: { aspd: 0.02, cspd: 0.02, dmgUp: 0.015 }, desc: '大地之灵栖身的胸甲，心跳和大地一个节拍。' + O55 });
EP('ep_bottom_earthsoul', { slot: 'bottom', atype: 'light', lvl: 55, name: '地灵绝魂绑腿', fx: { aspd: 0.01, cspd: 0.01, mspd: 0.06, dmgUp: 0.015 }, desc: '大地之灵托着双腿，跑起来一点也不累。' + O55 });
EP('ep_top_gurad', { slot: 'top', atype: 'heavy', lvl: 55, name: '古拉德的火焰胸甲', fx: { fire: 12, hpPct: 0.04, dmgUp: 0.015 },
  proc: { chance: 0.05, cd: 1.5, act: 'strike', mul: 1.8, aoe: 140, elem: 'fire', vis: 'fire', name: '火焰领主', desc: '攻击时 5% 几率喷出领主之火（周围 180% 火属性伤害，冷却 1.5 秒）。' }, desc: '火焰领主古拉德的胸甲，胸口的火种从未熄灭。' + O55 });
EP('ep_bottom_gurad', { slot: 'bottom', atype: 'heavy', lvl: 55, name: '古拉德的火焰胫甲', fx: { fire: 12, hardness: 30, dmgUp: 0.015 }, desc: '火焰领主古拉德的胫甲，踢出去带着火星。' + O55 });
EP('ep_top_xuanwu', { slot: 'top', atype: 'heavy', lvl: 55, name: '玄武护魂胸甲', fx: { ice: 12, defPct: 0.05, dmgUp: 0.015 }, desc: '龟甲一样厚实的胸甲，玄武的魂守着主人的心脏。' + O55 });
EP('ep_bottom_xuanwu', { slot: 'bottom', atype: 'heavy', lvl: 55, name: '玄武护魂绑腿', fx: { ice: 12, hpPct: 0.04, dmgUp: 0.015 }, desc: '玄武护魂的绑腿，站桩时稳如磐石。' + O55 });
EP('ep_top_borodin', { slot: 'top', atype: 'plate', lvl: 55, name: '波罗丁的天祈胸甲', fx: { light: 12, dmgReduce: 0.03, dmgUp: 0.015 },
  proc: { on: 'lowhp', cd: 60, act: 'heal', hp: 0.25, name: '天祈', desc: 'HP 低于 30% 时天祈之光恢复 25% HP（冷却 60 秒）。' }, desc: '圣骑士波罗丁的胸甲，胸前刻着祈祷文。' + O55 });
EP('ep_bottom_borodin', { slot: 'bottom', atype: 'plate', lvl: 55, name: '波罗丁的天祈绑腿', fx: { light: 12, hpPct: 0.04, dmgUp: 0.015 }, desc: '圣骑士波罗丁的绑腿，跪下祈祷时也不会磨破。' + O55 });
EP('ep_top_iris', { slot: 'top', atype: 'cloth', lvl: 55, name: '艾丽丝的貂绒长袍', fx: { cspd: 0.03, mpPct: 0.1, dmgUp: 0.02 }, desc: '贵族小姐艾丽丝的貂绒长袍，暖和得让人不想脱。' + O55 });
EP('ep_bottom_nivu', { slot: 'bottom', atype: 'cloth', lvl: 55, name: '尼巫的索菲短裙', fx: { cdr: 0.06, cspd: 0.025, dmgUp: 0.02 }, desc: '巫女尼巫最喜欢的短裙，裙摆上绣着咒文。' + O55 });
EP('ep_top_titan', { slot: 'top', atype: 'leather', lvl: 55, name: '泰坦的蛇眼胸甲', fx: { crit: 0.04, mcrit: 0.04, critDmg: 0.08, dmgUp: 0.015 }, desc: '胸前镶着一只蛇眼，能替主人盯住敌人的破绽。' + O55 });
EP('ep_bottom_goliath', { slot: 'bottom', atype: 'leather', lvl: 55, name: '歌利亚的火焰绑腿', fx: { fire: 12, aspd: 0.015, dmgUp: 0.015 }, desc: '巨人歌利亚的皮绑腿，烫得能煎蛋。' + O55 });

/* ---------------- 原创补缺：Lv45 各部位、Lv57 头肩 / 腰带 / 鞋 ---------------- */
EP('ep_top_moonveil', { slot: 'top', atype: 'leather', lvl: 45, name: '月纱夜行衣', fx: { crit: 0.03, mcrit: 0.03, evade: 0.04, dmgUp: 0.05 }, desc: '用月光纱织的夜行衣，在暗处几乎看不见。' + ORIG });
EP('ep_top_steamcore', { slot: 'top', atype: 'heavy', lvl: 45, name: '蒸汽核心胸甲', fx: { hpPct: 0.05, hardness: 30, dmgUp: 0.05 },
  proc: { on: 'hurt', chance: 0.12, cd: 3, act: 'strike', mul: 1.5, aoe: 140, vis: 'nova', col: '#ffc070', name: '泄压！', desc: '被击时 12% 几率泄压喷出蒸汽（周围 150% 伤害，冷却 3 秒）。' }, desc: '比尔马克试验场的试作装甲，胸口的锅炉一直在咕嘟作响。' + ORIG });
EP('ep_bottom_ashwalker', { slot: 'bottom', atype: 'light', lvl: 45, name: '灰烬行者绑腿', fx: { fire: 14, mspd: 0.06, dmgUp: 0.05 }, desc: '穿过战火的斥候留下的绑腿，沾满了灰烬。' + ORIG });
EP('ep_bottom_runeweave', { slot: 'bottom', atype: 'cloth', lvl: 45, name: '符文织锦长裙', fx: { cspd: 0.025, elemAll: 8, dmgUp: 0.05 }, desc: '一针一线都是符文，裙摆会随着咒语亮起来。' + ORIG });
EP('ep_head_brass', { slot: 'head', atype: 'light', lvl: 45, name: '黄铜观测头盔', fx: { hit: 0.03, crit: 0.02, mcrit: 0.02, dmgUp: 0.05 }, desc: '比尔马克帝国工程师的头盔，黄铜镜片能把远处的敌人看得一清二楚。' + ORIG });
EP('ep_belt_bandit', { slot: 'belt', atype: 'leather', lvl: 45, name: '堕落盗贼的弹药腰带', fx: { aspd: 0.015, mspd: 0.04, dmgUp: 0.05 }, desc: '堕落的盗贼团用来挂飞刀和火药的宽腰带。' + ORIG });
EP('ep_shoes_hamelin', { slot: 'shoes', atype: 'cloth', lvl: 45, name: '迷乱舞步长靴', fx: { mspd: 0.1, cspd: 0.02, dmgUp: 0.05 }, desc: '哈穆林的村民跟着笛声跳舞时穿的长靴，停不下来。' + ORIG });
EP('ep_head_chrono', { slot: 'head', atype: 'plate', lvl: 57, name: '时隙巡守头盔', fx: { dmgReduce: 0.04, cdr: 0.05, dmgUp: 0.02 }, desc: '在时空裂隙里巡逻的守卫戴的头盔，面甲上刻着不停转动的时针。' + ORIG });
EP('ep_belt_railway', { slot: 'belt', atype: 'heavy', lvl: 57, name: '钢轨工匠腰带', fx: { hpPct: 0.05, hardness: 30, dmgUp: 0.02 }, desc: '海上列车的老工匠的腰带，挂满了扳手和铆钉。' + ORIG });
EP('ep_belt_seasalt', { slot: 'belt', atype: 'leather', lvl: 57, name: '海盐漂流者腰带', fx: { crit: 0.03, mcrit: 0.03, aspd: 0.015, dmgUp: 0.015 }, desc: '在海上漂了三年的皮腰带，结满了盐霜。' + ORIG });
EP('ep_shoes_mistwalk', { slot: 'shoes', atype: 'cloth', lvl: 57, name: '雾都潜行短靴', fx: { mspd: 0.12, cspd: 0.025, dmgUp: 0.02 }, desc: '雾都赫伊斯的密探穿的软底短靴，走路没有一点声音。' + ORIG });
EP('ep_shoes_ardent', { slot: 'shoes', atype: 'light', lvl: 57, name: '阿登突击战靴', fx: { mspd: 0.1, aspd: 0.015, dmgUp: 0.02 }, desc: '决战阿登高地时突击队穿的战靴，鞋钉深深咬进泥里。' + ORIG });
EP('ep_shoes_timestep', { slot: 'shoes', atype: 'heavy', lvl: 57, name: '时轮踏步战靴', fx: { mspd: 0.08, cdr: 0.04, dmgUp: 0.02 },
  proc: { on: 'skill', chance: 0.1, cd: 8, act: 'buff', buff: { mspd: 0.15, cspd: 0.08 }, dur: 5, key: 'timestep', name: '时轮', col: '#9ad0ff', desc: '施放技能时 10% 几率踏上时轮：5 秒内移动速度 +15%、施放速度 +8%（冷却 8 秒）。' }, desc: '鞋跟嵌着一枚时轮，踏一步就像跳过一小段时间。' + ORIG });

/* ---------------- Lv40 原创五件套（万年雪山深渊） ---------------- */
const S5 = (top, head, bottom, belt, shoes) => ({ top, head, bottom, belt, shoes });
armorSet('set_ar_snowmoon', '雪月祈咒', 'cloth', 40, S5('雪月祈咒长袍', '雪月祈咒披肩', '雪月祈咒长裙', '雪月祈咒束带', '雪月祈咒软靴'), {
  2: { st: { cdr: 0.05, cspd: 0.06 }, desc: '技能冷却 -5%，施放速度 +6%' },
  3: { st: { str: 50, int: 50, cdr: 0.08 }, desc: '力量 / 智力 +50，技能冷却 -8%' },
  5: { st: { cdr: 0.1, dmgUp: 0.08 }, desc: '【冷却流】技能冷却 -10%，伤害增加 8%；攻击时 5% 几率冰冻敌人 1.2 秒，攻击冰冻中的敌人附加 15% 伤害；施放技能时 10% 几率降下雪月冰晶（周围 190% 冰属性伤害，冷却 2 秒）',
    proc: [{ chance: 0.05, act: 'status', status: 'freeze', dur: 1.2 }, { vs: 'freeze', act: 'extra', frac: 0.15 }, { on: 'skill', chance: 0.1, cd: 2, act: 'strike', mul: 1.9, aoe: 140, elem: 'ice', vis: 'ice', name: '雪月冰晶！' }] } },
  { abyss: true, abyssFrom: SNOW, desc: '雪山巫女对着满月祈祷时穿的法衣，雪花落在上面不会融化。' + ORIG });
armorSet('set_ar_frostwolf', '霜牙狼王', 'leather', 40, S5('霜牙狼王皮甲', '霜牙狼王护肩', '霜牙狼王皮裤', '霜牙狼王皮带', '霜牙狼王短靴'), {
  2: { st: { crit: 0.03, mcrit: 0.03, mspd: 0.05 }, desc: '暴击率 +3%，移动速度 +5%' },
  3: { st: { str: 50, int: 50, critDmg: 0.08 }, desc: '力量 / 智力 +50，暴击伤害 +8%' },
  5: { st: { dmgUp: 0.12 }, desc: '【狩猎流】伤害增加 12%；暴击时叠加 1 层狼群（暴击伤害 +3%，最多 8 层，持续 6 秒），8% 几率霜牙撕咬（180% 冰属性伤害）；击杀敌人时 20% 几率恢复 2% HP',
    proc: [{ on: 'crit', act: 'buff', buff: { critDmg: 0.03 }, dur: 6, stack: 8, key: 'frostwolf', name: '狼群', col: '#bfe6ff' }, { on: 'crit', chance: 0.08, cd: 1, act: 'strike', mul: 1.8, elem: 'ice', vis: 'slash', col: '#bfe6ff', name: '霜牙撕咬' }, { on: 'kill', chance: 0.2, act: 'heal', hp: 0.02 }] } },
  { abyss: true, abyssFrom: SNOW, desc: '雪山狼王的皮毛做的猎装，獠牙上结着霜。' + ORIG });
armorSet('set_ar_aurora', '极光猎风', 'light', 40, S5('极光猎风胸甲', '极光猎风护肩', '极光猎风绑腿', '极光猎风腰带', '极光猎风短靴'), {
  2: { st: { aspd: 0.05, cspd: 0.05 }, desc: '攻击 / 施放速度 +5%' },
  3: { st: { str: 50, int: 50, mspd: 0.06 }, desc: '力量 / 智力 +50，移动速度 +6%' },
  5: { st: { dmgUp: 0.12, light: 15 }, desc: '【连击流】伤害增加 12%，光属性强化 +15；连击达到 30 时伤害 +10%（8 秒，冷却 12 秒）；连击达到 60 时降下极光帷幕（周围 200% 光属性伤害，冷却 6 秒）',
    proc: [{ combo: 30, cd: 12, act: 'buff', buff: { dmg: 0.1 }, dur: 8, key: 'aurora', name: '极光', col: '#8affe0' }, { combo: 60, cd: 6, act: 'strike', mul: 2.0, aoe: 150, elem: 'light', vis: 'holy', col: '#b08aff', name: '极光帷幕！' }] } },
  { abyss: true, abyssFrom: SNOW, desc: '追着极光奔跑的猎人穿的轻甲，甲片会随着光带变色。' + ORIG });
armorSet('set_ar_glacier', '冰川巨像', 'heavy', 40, S5('冰川巨像胸甲', '冰川巨像肩甲', '冰川巨像胫甲', '冰川巨像腰带', '冰川巨像战靴'), {
  2: { st: { hp: 1000, hpPct: 0.06, hardness: 20 }, desc: 'HP 上限 +1000，HP 上限 +6%，硬直 +20' },
  3: { st: { str: 50, int: 50, defPct: 0.08 }, desc: '力量 / 智力 +50，防御力 +8%' },
  5: { st: { dmgUp: 0.12, dmgReduce: 0.05 }, desc: '【反击流】伤害增加 12%，受到的伤害 -5%；被击时 20% 几率冰川反震（周围 180% 冰属性伤害，冷却 2 秒）；HP 低于 30% 时获得吸收 25% HP 上限伤害的冰川之壁（冷却 50 秒）',
    proc: [{ on: 'hurt', chance: 0.2, cd: 2, act: 'strike', mul: 1.8, aoe: 150, elem: 'ice', vis: 'ice', name: '冰川反震' }, { on: 'lowhp', cd: 50, act: 'shield', amt: 0.25, dur: 8, name: '冰川之壁' }] } },
  { abyss: true, abyssFrom: SNOW, desc: '从万年冰川里凿出来的重甲，冰里冻着远古的石头。' + ORIG });
armorSet('set_ar_snowfort', '雪原城垒', 'plate', 40, S5('雪原城垒胸甲', '雪原城垒肩甲', '雪原城垒护腿', '雪原城垒腰带', '雪原城垒战靴'), {
  2: { st: { defPct: 0.08, hpPct: 0.06 }, desc: '防御力 +8%，HP 上限 +6%' },
  3: { st: { str: 50, int: 50, dmgReduce: 0.05 }, desc: '力量 / 智力 +50，受到的伤害 -5%' },
  5: { st: { dmgUp: 0.12, hardness: 40 }, desc: '【守城流】伤害增加 12%，硬直 +40；攻击时 8% 几率吹响破城号角：目标受到的伤害 +10%，持续 6 秒；被击时 10% 几率获得吸收 12% HP 上限伤害的城垒护盾（冷却 20 秒）',
    proc: [{ chance: 0.08, act: 'debuff', taken: 0.1, dur: 6, key: 'snowfort', vis: 'holy', col: '#ff8a7a', name: '破城号角' }, { on: 'hurt', chance: 0.1, cd: 20, act: 'shield', amt: 0.12, dur: 6, name: '城垒' }] } },
  { abyss: true, abyssFrom: SNOW, desc: '雪原要塞的守军穿的板甲，肩上还积着雪、插着红旗。' + ORIG });

/* ---------------- Lv48 原创五件套（诺斯玛尔深渊） ---------------- */
armorSet('set_ar_alchemy', '翠焰炼金', 'cloth', 48, S5('翠焰炼金长袍', '翠焰炼金披肩', '翠焰炼金长裙', '翠焰炼金束带', '翠焰炼金软靴'), {
  2: { st: { cspd: 0.06, mpPct: 0.08 }, desc: '施放速度 +6%，MP 上限 +8%' },
  3: { st: { str: 55, int: 55, dmgUp: 0.07 }, desc: '力量 / 智力 +55，伤害增加 7%' },
  5: { st: { dmgUp: 0.13, elemAll: 12 }, desc: '【异常流】伤害增加 13%，所有属性强化 +12；攻击时 8% 几率使敌人中毒 4 秒，攻击异常状态的敌人附加 12% 伤害；施放技能时 8% 几率砸出翠焰药剂（周围 200% 伤害，冷却 2 秒）',
    proc: [{ chance: 0.08, act: 'status', status: 'poison', dur: 4, dps: 0.15 }, { vs: 'any', act: 'extra', frac: 0.12 }, { on: 'skill', chance: 0.08, cd: 2, act: 'strike', mul: 2.0, aoe: 140, vis: 'nova', col: '#6aff8a', name: '翠焰药剂！' }] } },
  { abyss: true, abyssFrom: NORSE, desc: '根特炼金术士的工作服，口袋里的药瓶冒着翠绿的火。' + ORIG });
armorSet('set_ar_nightraid', '夜袭者', 'leather', 48, S5('夜袭者皮甲', '夜袭者护肩', '夜袭者皮裤', '夜袭者腰带', '夜袭者短靴'), {
  2: { st: { crit: 0.05, mcrit: 0.05 }, desc: '暴击率 +5%' },
  3: { st: { str: 55, int: 55, critDmg: 0.15 }, desc: '力量 / 智力 +55，暴击伤害 +15%' },
  5: { st: { dmgUp: 0.13 }, desc: '【暗杀流】伤害增加 13%；攻击附加 5% 伤害，目标 HP 越低附加越多（最多 20%）；暴击时 12% 几率影袭（200% 暗属性伤害）',
    proc: [{ act: 'extra', frac: 0.05, exec: 0.15 }, { on: 'crit', chance: 0.12, cd: 0.5, act: 'strike', mul: 2.0, elem: 'dark', vis: 'dark', col: '#b03aff', name: '影袭' }] } },
  { abyss: true, abyssFrom: NORSE, desc: '夜里潜进根特的刺客穿的黑皮甲，护目镜在暗处泛着红光。' + ORIG });
armorSet('set_ar_scout', '疾风斥候', 'light', 48, S5('疾风斥候胸甲', '疾风斥候护肩', '疾风斥候绑腿', '疾风斥候腰带', '疾风斥候短靴'), {
  2: { st: { mspd: 0.08, aspd: 0.04, cspd: 0.04 }, desc: '移动速度 +8%，攻击 / 施放速度 +4%' },
  3: { st: { str: 55, int: 55, aspd: 0.05, cspd: 0.05 }, desc: '力量 / 智力 +55，攻击 / 施放速度 +5%' },
  5: { st: { dmgUp: 0.13 }, desc: '【机动流】伤害增加 13%；击杀敌人时 30% 几率突进：6 秒内攻击 / 施放 / 移动速度 +10%（冷却 6 秒）；攻击时 5% 几率游击射击（200% 伤害）',
    proc: [{ on: 'kill', chance: 0.3, cd: 6, act: 'buff', buff: { aspd: 0.1, cspd: 0.1, mspd: 0.1 }, dur: 6, key: 'scout', name: '斥候突进', col: '#ffd070' }, { chance: 0.05, cd: 1, act: 'strike', mul: 2.0, vis: 'swords', col: '#ffd070', name: '游击射击' }] } },
  { abyss: true, abyssFrom: NORSE, desc: '根特防卫军斥候的轻甲，红围巾是他们的记号。' + ORIG });
armorSet('set_ar_ironcannon', '铁炮堡垒', 'heavy', 48, S5('铁炮堡垒胸甲', '铁炮堡垒肩甲', '铁炮堡垒胫甲', '铁炮堡垒腰带', '铁炮堡垒战靴'), {
  2: { st: { hp: 1200, hpPct: 0.06, stagger: 30 }, desc: 'HP 上限 +1200，HP 上限 +6%，僵直度 +30' },
  3: { st: { str: 55, int: 55, hardness: 40 }, desc: '力量 / 智力 +55，硬直 +40' },
  5: { st: { dmgUp: 0.13, fire: 15 }, desc: '【爆破流】伤害增加 13%，火属性强化 +15；攻击时 6% 几率肩炮齐射（周围 220% 火属性伤害，冷却 1.5 秒）；被击时 10% 几率开启蒸汽装甲（吸收 12% HP 上限伤害，冷却 20 秒）',
    proc: [{ chance: 0.06, cd: 1.5, act: 'strike', mul: 2.2, aoe: 150, elem: 'fire', vis: 'fire', name: '肩炮齐射！' }, { on: 'hurt', chance: 0.1, cd: 20, act: 'shield', amt: 0.12, dur: 6, name: '蒸汽装甲' }] } },
  { abyss: true, abyssFrom: NORSE, desc: '卡勒特工兵的蒸汽重甲，两边肩膀上各架着一门小炮。' + ORIG });
armorSet('set_ar_gentguard', '根特守备', 'plate', 48, S5('根特守备胸甲', '根特守备肩甲', '根特守备护腿', '根特守备腰带', '根特守备战靴'), {
  2: { st: { defPct: 0.1, hpPct: 0.06 }, desc: '防御力 +10%，HP 上限 +6%' },
  3: { st: { str: 55, int: 55, dmgReduce: 0.06 }, desc: '力量 / 智力 +55，受到的伤害 -6%' },
  5: { st: { dmgUp: 0.13, hardness: 40 }, desc: '【坚守流】伤害增加 13%，硬直 +40；攻击时 8% 几率下达守备号令：目标受到的伤害 +12%，持续 6 秒；HP 低于 30% 时获得吸收 30% HP 上限伤害的根特城墙（冷却 45 秒）',
    proc: [{ chance: 0.08, act: 'debuff', taken: 0.12, dur: 6, key: 'gentguard', vis: 'holy', col: '#9ad0ff', name: '守备号令' }, { on: 'lowhp', cd: 45, act: 'shield', amt: 0.3, dur: 8, name: '根特城墙' }] } },
  { abyss: true, abyssFrom: NORSE, desc: '根特城守备队的蓝银板甲，胸前是根特的狮子徽记。' + ORIG });

/* ---------------- 防具领主神器（粉色，只在对应领主身上掉） ---------------- */
const NM = (key, kind, dg, p, def) => { defineNamed(key, def); monDrop(kind, [[key, p]], { dungeons: [dg] }); };
NM('nm_top_kaino', 'goblinShaman', 'thunder_ruins', 0.025, { slot: 'top', atype: 'leather', lvl: 9, name: '凯诺的银光护甲', fx: { light: 10, aspd: 0.03 },
  proc: { chance: 0.04, cd: 1, act: 'strike', mul: 1.1, elem: 'light', vis: 'bolt', name: '银光', desc: '攻击时 4% 几率落下银光雷（110% 光属性伤害）。' }, desc: '落雷凯诺的银光护甲，摸上去会被电一下。（官方领主神器：雷鸣废墟 · 落雷凯诺）' });
NM('nm_bottom_kaino', 'goblinShaman', 'thunder_ruins', 0.025, { slot: 'bottom', atype: 'leather', lvl: 9, name: '凯诺的银光腿甲', fx: { light: 8, mspd: 0.05 },
  proc: { on: 'hurt', chance: 0.12, cd: 3, act: 'strike', mul: 1.0, elem: 'light', vis: 'bolt', name: '银光反击', desc: '被击时 12% 几率放电反击（100% 光属性伤害，冷却 3 秒）。' }, desc: '落雷凯诺的银光腿甲。（官方领主神器：雷鸣废墟 · 落雷凯诺）' });
NM('nm_top_sauta', 'tauKing', 'graca', 0.025, { slot: 'top', atype: 'heavy', lvl: 14, name: '血饮战甲', fx: { hpPct: 0.06, dmgUp: 0.02 },
  proc: { on: 'kill', chance: 0.25, act: 'heal', hp: 0.02, desc: '击杀敌人时 25% 几率饮血，恢复 2% HP。' }, desc: '牛头王萨乌塔的战甲，渗着洗不掉的血。（官方领主神器：格拉卡 · 牛头王萨乌塔）' });
NM('nm_bottom_sauta', 'tauKing', 'graca', 0.025, { slot: 'bottom', atype: 'heavy', lvl: 14, name: '血饮护腿', fx: { hardness: 20, dmgUp: 0.02 },
  proc: { chance: 0.05, act: 'status', status: 'bleed', dur: 3, dps: 0.08, desc: '攻击时 5% 几率使敌人出血 3 秒。' }, desc: '牛头王萨乌塔的护腿，踩过的地方会留下血印。（官方领主神器：格拉卡 · 牛头王萨乌塔）' });
NM('nm_bottom_lotus', 'lotus', 'second_spine', 0.02, { slot: 'bottom', atype: 'plate', lvl: 30, name: '巨兽之魂胫甲', fx: { hpPct: 0.06, dmgReduce: 0.04, dmgUp: 0.03 },
  proc: { on: 'hurt', chance: 0.1, cd: 3, act: 'strike', mul: 1.3, aoe: 130, vis: 'nova', col: '#d8a0ff', name: '巨兽之魂', desc: '被击时 10% 几率唤醒巨兽之魂（周围 130% 伤害，冷却 3 秒）。' }, desc: '天帷巨兽的魂寄宿在这副胫甲里。（官方领主神器：第二脊椎 · 长脚罗特斯）' });
NM('nm_top_spiz', 'spiz', 'darkelf_tomb', 0.02, { slot: 'top', atype: 'light', lvl: 34, name: '暗精灵亡灵的诅咒胸甲', fx: { dark: 20, dmgUp: 0.04 },
  proc: { chance: 0.05, act: 'debuff', taken: 0.08, dur: 5, key: 'spizcurse', vis: 'dark', col: '#a060ff', name: '亡灵诅咒', desc: '攻击时 5% 几率诅咒敌人：5 秒内受到的伤害 +8%。' }, desc: '暗精灵亡灵的诅咒附在这件胸甲上，穿的人却能驱使它。（官方领主神器：暗精灵墓地 · 邪龙斯皮兹）' });
NM('nm_top_headless', 'headlessKnight', 'darkcity_gate', 0.02, { slot: 'top', atype: 'heavy', lvl: 37, name: '幽魂胸甲', fx: { dark: 18, hpPct: 0.06, dmgUp: 0.03 },
  proc: { on: 'lowhp', cd: 50, act: 'shield', amt: 0.2, dur: 8, name: '幽魂', desc: 'HP 低于 30% 时幽魂护体：吸收 20% HP 上限的伤害（冷却 50 秒）。' }, desc: '无头骑士的胸甲，里面空荡荡的，只有幽魂。（官方领主神器：暗黑城入口 · 无头骑士）' });
NM('nm_bottom_headless', 'headlessKnight', 'darkcity_gate', 0.02, { slot: 'bottom', atype: 'heavy', lvl: 37, name: '幽魂腿甲', fx: { dark: 15, mspd: 0.05, dmgUp: 0.03 },
  proc: { on: 'kill', chance: 0.2, act: 'heal', hp: 0.02, desc: '击杀敌人时 20% 几率吸取亡魂，恢复 2% HP。' }, desc: '无头骑士的腿甲，走路时带着一阵阴风。（官方领主神器：暗黑城入口 · 无头骑士）' });
NM('nm_bottom_lik', 'lik', 'lik_well', 0.02, { slot: 'bottom', atype: 'plate', lvl: 38, name: '霜降护腿', fx: { ice: 18, hpPct: 0.06, dmgReduce: 0.04 },
  proc: { on: 'hurt', chance: 0.12, cd: 3, act: 'strike', mul: 1.4, aoe: 130, elem: 'ice', vis: 'ice', name: '霜降', desc: '被击时 12% 几率降霜反击（周围 140% 冰属性伤害，冷却 3 秒）。' }, desc: '寒冰巨人利库的护腿，一跺脚就下霜。（官方领主神器：利库天井 · 寒冰巨人利库）' });
NM('nm_top_ruug', 'ruug', 'ridge', 0.02, { slot: 'top', atype: 'cloth', lvl: 39, name: '兽灵夹克', fx: { cspd: 0.05, dmgUp: 0.04 },
  proc: { on: 'skill', chance: 0.06, cd: 2, act: 'strike', mul: 1.5, vis: 'slash', col: '#c8a070', name: '兽灵', desc: '施放技能时 6% 几率召来兽灵扑咬（150% 伤害，冷却 2 秒）。' }, desc: '野兽师鲁乌格的夹克，野兽们认得这个味道。（官方领主神器：山脊 · 野兽师鲁乌格）' });
NM('nm_head_sabertooth', 'sabertooth', 'ridge', 0.02, { slot: 'head', atype: 'leather', lvl: 39, name: '冰锥护肩', fx: { ice: 18, crit: 0.03, mcrit: 0.03, dmgUp: 0.03 },
  proc: { on: 'crit', chance: 0.08, cd: 1, act: 'strike', mul: 1.5, elem: 'ice', vis: 'ice', name: '冰锥', desc: '暴击时 8% 几率射出冰锥（150% 冰属性伤害）。' }, desc: '用冰齿沙凡特的獠牙做的护肩。（官方领主神器：山脊 · 冰齿沙凡特）' });
NM('nm_head_seski', 'seski', 'white_ruins', 0.02, { slot: 'head', atype: 'light', lvl: 40, name: '雪灵护肩', fx: { ice: 20, aspd: 0.04, dmgUp: 0.03 },
  proc: { chance: 0.05, act: 'status', status: 'freeze', dur: 1, desc: '攻击时 5% 几率冰冻敌人 1 秒。' }, desc: '塞斯奇身边的雪灵凝成的护肩。（官方领主神器：白色废墟 · 塞斯奇）' });
NM('nm_top_suleide', 'suleide', 'gent_east', 0.02, { slot: 'top', atype: 'leather', lvl: 50, name: '苏雷德的机车胸甲', fx: { mspd: 0.06, aspd: 0.05, dmgUp: 0.04 },
  proc: { on: 'kill', chance: 0.25, cd: 6, act: 'buff', buff: { mspd: 0.15, aspd: 0.06 }, dur: 5, key: 'suleide', name: '油门到底', col: '#ffb070', desc: '击杀敌人时 25% 几率油门到底：5 秒内移动速度 +15%、攻击速度 +6%（冷却 6 秒）。' }, desc: '机动队长苏雷德的机车皮甲，还带着机油味。（官方领主神器：根特东门 · 机动队长苏雷德）' });
NM('nm_bottom_gt9600', 'gt9600', 'gent_south', 0.02, { slot: 'bottom', atype: 'plate', lvl: 52, name: 'GT-9600之先锋护腿', fx: { light: 22, hpPct: 0.06, dmgUp: 0.04 },
  proc: { chance: 0.05, cd: 1, act: 'strike', mul: 1.7, elem: 'light', vis: 'bolt', col: '#7fe0ff', name: '先锋激光', desc: '攻击时 5% 几率发射先锋激光（170% 光属性伤害）。' }, desc: 'GT-9600 的腿部装甲，拆下来还能自己走两步。（官方领主神器：根特南门 · GT-9600）' });

/* ---------------- 掉落与深渊归属（apply 时生效） ---------------- */
const G = (dg, keys, p = 0.008) => gearDrop(dg, keys.map(k => [k, p]));
// Lv10 两件套：幽暗密林深处、雷鸣废墟、猛毒雷鸣废墟、冰霜幽暗密林、格拉卡（1%）
const P10 = s => SETS[s].pieces;
G('dark_woods_deep', [...P10('set_ar_sprout'), ...P10('set_ar_oakguard')], 0.01);
G('thunder_ruins', [...P10('set_ar_thunder'), ...P10('set_ar_goblin')], 0.01);
G('venom_ruins', [...P10('set_ar_goblin'), ...P10('set_ar_sprout')], 0.01);
G('frozen_woods', [...P10('set_ar_oakguard'), ...P10('set_ar_thunder')], 0.01);
G('graca', P10('set_ar_tauhorn'), 0.012);
G('dark_woods_deep', P10('set_ar_tauhorn'), 0.008);
// Lv45 原创 / Lv50 官方：牛头械王（比尔马克）、根特、虫穴（悲鸣洞穴）
G('bilmark', ['ep_top_steamcore', 'ep_bottom_runeweave', 'ep_head_xuanwu', 'ep_belt_monica', 'ep_head_brass']);
G('fallen_bandits', ['ep_top_moonveil', 'ep_bottom_ashwalker', 'ep_head_borodin', 'ep_shoes_atlas', 'ep_belt_bandit']);
G('hamelin', ['ep_top_moonveil', 'ep_bottom_runeweave', 'ep_shoes2', 'ep_belt_monica', 'ep_shoes_gurad', 'ep_shoes_hamelin']);
G('gent_outskirts', ['ep_head', 'ep_belt_gurad', 'ep_shoes_gurad', 'ep_shoes_earthsoul']);
G('gent_east', ['ep_head2', 'ep_belt_earthsoul', 'ep_shoes_pisco', 'ep_shoes_borodin']);
G('gent_south', ['ep_head_borodin', 'ep_shoes_borodin', 'ep_head_xuanwu', 'ep_shoes_atlas']);
G('wailing_cave', ['ep_head', 'ep_head2', 'ep_shoes2', 'ep_shoes_pisco', 'ep_belt_earthsoul', 'ep_top_steamcore', 'ep_bottom_ashwalker']);
// Lv55 官方：海上列车、时空之门前段
G('sea_pirates', ['ep_top_titan', 'ep_bottom_goliath', 'ep_top_iris']);
G('west_line', ['ep_top_gurad', 'ep_bottom_gurad', 'ep_bottom_nivu']);
G('heis', ['ep_top_iris', 'ep_bottom_nivu', 'ep_top_earthsoul', 'ep_bottom_earthsoul']);
G('arden', ['ep_top_borodin', 'ep_bottom_borodin', 'ep_top_titan']);
G('grand_fire', ['ep_top_gurad', 'ep_bottom_goliath', 'ep_bottom_gurad']);
G('plague_source', ['ep_top_xuanwu', 'ep_bottom_xuanwu', 'ep_top_borodin']);
G('kartel_origin', ['ep_top_earthsoul', 'ep_bottom_earthsoul', 'ep_head_chrono', 'ep_belt_railway']);
G('holy_war', ['ep_top_xuanwu', 'ep_bottom_xuanwu', 'ep_bottom_borodin', 'ep_belt_seasalt', 'ep_shoes_ardent']);
// Lv57 原创 + Lv60 T1 三件套：时空之门后段、希洛克
G('secret_zone', ['ep_shoes_mistwalk', 'ep_shoes_timestep', ...SETS.set_ar_witch.pieces, ...SETS.set_ar_ironbeast.pieces]);
G('old_wail', ['ep_head_chrono', 'ep_belt_seasalt', ...SETS.set_ar_krom.pieces, ...SETS.set_ar_xuanming.pieces]);
G('old_winter', ['ep_belt_railway', 'ep_shoes_ardent', 'ep_shoes_mistwalk', ...SETS.set_ar_ruins.pieces, ...SETS.set_ar_witch.pieces]);
G('law_gate', [...SETS.set_ar_witch.pieces, ...SETS.set_ar_krom.pieces, 'ep_shoes_timestep']);
G('wit_gate', [...SETS.set_ar_ironbeast.pieces, ...SETS.set_ar_xuanming.pieces]);
G('pain_gate', [...SETS.set_ar_ruins.pieces, ...SETS.set_ar_krom.pieces]);
// Lv60 T3 五件套：魔界深渊专属 + 攻坚（谜之觉悟、无形棺柩）各 0.3%
const T3SETS = ['set_tremor', 'set_reaper', 'set_arad', 'set_evilgod', 'set_kingtear'];
abyssClaim('siroco', T3SETS);
for (const dg of ['iris_raid', 'siroco_coffin']) G(dg, T3SETS.flatMap(s => SETS[s].pieces), 0.003);
abyssClaim('snow', ['set_ar_snowmoon', 'set_ar_frostwolf', 'set_ar_aurora', 'set_ar_glacier', 'set_ar_snowfort']);
abyssClaim('gent', ['set_ar_alchemy', 'set_ar_nightraid', 'set_ar_scout', 'set_ar_ironcannon', 'set_ar_gentguard']);
}
