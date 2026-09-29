/* =====================================================================
   装备 2.0 · B1c 魔法师武器（矛 / 棍棒 / 魔杖 / 法杖 / 扫把）
   只写本块的物品；搬家 / 继承 / 领主神器 / 掉落 / 深渊归属一律用 gear60_api.js 的接口（用法见 docs/GEAR_PLAN_60.md §6）。
   注释只放在行尾或单独一行（一行中间的 // 会吞掉后面的字段）。
   数值预算：GEAR_PLAN_60 §2.3（Lv34 .09 / Lv38 深渊 .12 / Lv45 .10 / Lv48 .11 / Lv55 .11~.12 / Lv60 T1 .12、T2 .13、T3 .15）；清单见 docs/GEAR.md §10.1「B1c」。
   ===================================================================== */
{
const EP = (key, def) => defineEpic(key, { slot: 'weapon', ...def });
const NM = (key, def) => defineNamed(key, { slot: 'weapon', ...def });
const SI = (int, str = int) => str ? { int, str } : { int };
const ORIG = '（本作原创）';
const inh = from => `（本作原创，继承自「${ITEMS[from].name}」）`;

/* ---------------- 1. 官方物品回到官方等级 + 继承装备（1~30 原地留下同数值的原创武器） ---------------- */
// 矛
inheritEpic('ep_sp_evil', 'ep_sp_bronze', { name: '青铜镇魂矛', desc: '古墓里挖出的青铜矛，矛刃上贴满了黄符，游魂见了都绕道走。' + inh('ep_sp_evil') });
moveEpic('ep_sp_evil', { lvl: 55, st: SI(50), fx: { dmgUp: 0.11, light: 30, stagger: 40 },
  proc: { chance: 0.06, cd: 1, act: 'strike', mul: 1.9, aoe: 130, elem: 'light', vis: 'holy', col: '#ffe9a0', name: '却邪铃音！', desc: '攻击时 6% 几率摇响铜铃：周围敌人受到 190% 光属性伤害（冷却 1 秒）。' },
  desc: '专门驱邪的战矛，矛尖挂着一串铜铃。（官方 60 版 Lv55 史诗矛）' });
inheritEpic('ep_sp_lava', 'ep_sp_trident', { name: '炎魔三叉戟', desc: '从炎魔手里夺来的三叉戟，三根叉尖终年烧得通红。' + inh('ep_sp_lava') });
moveEpic('ep_sp_lava', { lvl: 60, tier: 1, abyss: false, fx: { dmgUp: 0.12, fire: 30, stagger: 40 },
  proc: { chance: 0.03, cd: 3, act: 'strike', mul: 2.1, aoe: 160, elem: 'fire', vis: 'fire', name: '熔岩地带！', desc: '攻击时 3% 几率喷出熔岩：周围敌人受到 210% 火属性伤害（冷却 3 秒）。' },
  desc: '矛尖滴下的不是血，是岩浆。（官方 70 版 Lv60 史诗矛）' });
// 棍棒
inheritEpic('ep_pl_breaker', 'ep_pl_tiger', { name: '猛虎啸月棍', desc: '两端各铸一颗铜虎头，舞起来虎啸声不绝。' + inh('ep_pl_breaker') });
moveEpic('ep_pl_breaker', { lvl: 55, st: SI(25), fx: { dmgUp: 0.11, crit: 0.04, mcrit: 0.04, critDmg: 0.12 },
  proc: { chance: 0.03, cd: 8, act: 'buff', buff: { atk: 0.3 }, dur: 8, key: 'polebreaker', name: '破极', col: '#ff9a4a', desc: '攻击时 3% 几率攻击力 +30%，持续 8 秒（冷却 8 秒）。' },
  desc: '棍梢开了刃，打在身上像刀割。（官方 60 版 Lv55 史诗棍棒）' });
inheritEpic('ep_pl_phantom', 'ep_pl_lantern', { name: '引魂提灯棍', desc: '棍头挂着一盏青色魂灯，迷路的亡魂会跟着灯光走。' + inh('ep_pl_phantom') });
moveEpic('ep_pl_phantom', { lvl: 60, tier: 1, abyss: false, fx: { dmgUp: 0.12, cdr: 0.08, aspd: 0.05, cspd: 0.05 },
  proc: [{ chance: 0.03, cd: 20, act: 'shield', amt: 0.3, dur: 10, name: '幻魄护体', desc: '攻击时 3% 几率获得护盾：10 秒内吸收最多 30% HP 上限的伤害（冷却 20 秒）；' },
    { chance: 0.05, cd: 1.5, act: 'strike', mul: 2.0, aoe: 130, elem: 'dark', vis: 'dark', col: '#7fe0ff', name: '幻魄冲击！', desc: '5% 几率放出幻魄：周围敌人受到 200% 暗属性伤害（冷却 1.5 秒）。' }],
  desc: '棍中寄宿着一缕不肯离去的幻魄。（官方 70 版 Lv60 史诗棍棒）' });
// 魔杖
inheritEpic('ep_rd_thunder', 'ep_rd_aria', { name: '雷鸣咏叹魔杖', desc: '杖头是一支银音叉，轻轻一敲，雷声就跟着唱起来。' + inh('ep_rd_thunder') });
moveEpic('ep_rd_thunder', { lvl: 55, fx: { dmgUp: 0.11, light: 20, atkElem: 'light', cspd: 0.06, cdr: 0.05 },
  proc: { on: 'skill', chance: 0.1, cd: 2, act: 'strike', mul: 1.9, elem: 'light', vis: 'bolt', name: '雷芒！', desc: '光属性攻击；施放技能时 10% 几率降下雷芒（190% 光属性伤害，冷却 2 秒）。' },
  desc: '杖头是一本写满雷系咒文的魔典。（官方 60 版 Lv55 史诗魔杖）' });
inheritEpic('ep_rd_cheshire', 'ep_rd_jester', { name: '小丑的恶作剧', desc: '杖头的小丑帽叮当作响，没人知道下一个戏法会变出什么。' + inh('ep_rd_cheshire') });
moveEpic('ep_rd_cheshire', { lvl: 55, st: SI(10, 0), fx: { dmgUp: 0.11, cdr: 0.08, cspd: 0.08, dark: 30 },
  proc: { chance: 0.05, cd: 5, act: 'debuff', taken: 0.1, dur: 5, vis: 'dark', col: '#c080ff', name: '猫的微笑', desc: '攻击时 5% 几率让敌人看见那张笑脸：5 秒内受到的伤害 +10%（冷却 5 秒）。' },
  desc: '杖头的猫咪一直在笑，笑得人心里发毛。（官方 60 版 Lv55 史诗魔杖）' });
inheritEpic('ep_rd_meow', 'ep_rd_owl', { name: '夜枭的絮语', desc: '杖头的雪枭半夜会睁开眼睛，小声念出下一句咒语。' + inh('ep_rd_meow') });
moveEpic('ep_rd_meow', { lvl: 60, tier: 1, fx: { dmgUp: 0.12, cspd: 0.08, mcrit: 0.03, crit: 0.03, critDmg: 0.12 },
  proc: { chance: 0.06, cd: 1, act: 'strike', mul: 2.1, aoe: 110, vis: 'petal', col: '#ffb0e0', name: '喵～！', desc: '攻击时 6% 几率召唤猫咪扑击：周围敌人受到 210% 伤害（冷却 1 秒）。' },
  desc: '魔女伊伽贝拉最宠爱的猫咪化成的魔杖。（官方 70 版 Lv60 史诗魔杖）' });
// 法杖
inheritEpic('ep_st_willy', 'ep_st_candela', { name: '守誓者的烛台杖', desc: '三支蓝焰蜡烛从不熄灭，照着持杖人许下的誓言。' + inh('ep_st_willy') });
moveEpic('ep_st_willy', { lvl: 55, st: SI(30, 0), fx: { dmgUp: 0.11, mcrit: 0.05, crit: 0.03, dmgReduce: 0.04, mpRegen: 0.5 },
  proc: { chance: 0.02, cd: 15, act: 'shield', amt: 0.3, dur: 7, name: '戒言', desc: '攻击时 2% 几率获得戒言护盾：7 秒内吸收最多 30% HP 上限的伤害（冷却 15 秒）。' },
  desc: '法杖上刻满了威利的戒言，念一句就护一身。（官方 60 版 Lv55 史诗法杖）' });
inheritEpic('ep_st_sage', 'ep_st_hourglass', { name: '时之贤者的沙漏杖', desc: '杖头的金沙漏倒过来，咏唱就会快上一拍。' + inh('ep_st_sage') });
moveEpic('ep_st_sage', { lvl: 60, tier: 1, st: SI(40, 0), fx: { dmgUp: 0.12, cspd: 0.06, critDmg: 0.15 },
  proc: [{ chance: 0.05, cd: 20, act: 'buff', buff: { cspd: 0.15, atk: 0.1 }, dur: 20, key: 'sage', name: '大贤者', col: '#b0a0ff', desc: '攻击时 5% 几率进入大贤者状态：20 秒内施放速度 +15%、攻击力 +10%（冷却 20 秒）；' },
    { chance: 0.05, cd: 1.5, act: 'strike', mul: 2.1, aoe: 130, vis: 'nova', col: '#b0a0ff', name: '贤者之光！', desc: '5% 几率放出贤者之光：周围敌人受到 210% 伤害（冷却 1.5 秒）。' }],
  desc: '大贤者晚年用的法杖，杖身磨得发亮。（官方 70 版 Lv60 史诗法杖）' });
inheritEpic('ep_st_witchgold', 'ep_st_pumpkin', { name: '南瓜魔女的提灯杖', desc: '万圣夜魔女最爱的南瓜灯，据说里面的火苗会自己找金币。' + inh('ep_st_witchgold') });
moveEpic('ep_st_witchgold', { lvl: 60, tier: 2, st: SI(30, 0), fx: { dmgUp: 0.13, mcrit: 0.06, crit: 0.04, critDmg: 0.17, goldUp: 0.1 },
  proc: { chance: 0.05, cd: 1.5, act: 'strike', mul: 2.3, aoe: 140, vis: 'petal', col: '#ffd24a', name: '黄金魔咒！', desc: '攻击时 5% 几率念出黄金魔咒：周围敌人受到 230% 伤害（冷却 1.5 秒）。' },
  desc: '女巫用黄金铸成的法杖，据说连好运也能一起召来。（官方 Lv65 史诗法杖）' });
inheritEpic('ep_st_moon', 'ep_st_dawn', { name: '晨曦流辉法杖', desc: '杖头托着一轮小太阳，天亮之前它就先亮了。' + inh('ep_st_moon') });
moveEpic('ep_st_moon', { lvl: 60, tier: 3, fx: { dmgUp: 0.15, light: 40, cspd: 0.08, mcrit: 0.03 },
  proc: [{ chance: 0.06, cd: 1.2, act: 'strike', mul: 2.6, aoe: 150, elem: 'light', vis: 'bolt', name: '雷光链！', desc: '攻击时 6% 几率释放雷光链：周围敌人受到 260% 光属性伤害（冷却 1.2 秒）；' },
    { on: 'crit', chance: 0.12, cd: 4, act: 'strike', mul: 1.4, aoe: 170, elem: 'light', vis: 'moon', col: '#bfe6ff', name: '溯月！', desc: '暴击时 12% 几率追加一道月光：周围敌人受到 140% 光属性伤害（冷却 4 秒）。' }],
  desc: '逆着月光流淌的光，汇成了一根法杖。（官方 80 版 Lv70 史诗法杖）' });
// 扫把
inheritEpic('ep_br_scribble', 'ep_br_mop', { name: '魔法学徒的拖把', desc: '学徒偷懒施了清扫咒，结果拖把自己学会了打架。' + inh('ep_br_scribble') });
moveEpic('ep_br_scribble', { lvl: 55, st: SI(10, 0), fx: { dmgUp: 0.11, cspd: 0.07, mspd: 0.06, elemAll: 20 },
  proc: { chance: 0.12, act: 'extra', frac: 0.35, col: '#ff9ad8', desc: '攻击时 12% 几率附加 35% 伤害。' },
  desc: '一支会自己画画的巨大画笔，画什么就变成什么。（官方 60 版 Lv55 史诗扫把）' });
inheritEpic('ep_br_lucky', 'ep_br_goldbell', { name: '招福金铃扫把', desc: '红漆扫柄挂满金铃，扫一下门口，财神就进门了。' + inh('ep_br_lucky') });
moveEpic('ep_br_lucky', { lvl: 60, tier: 1, fx: { crit: 0.03, mcrit: 0.03, goldUp: 0.12, dmgUp: 0.12, critDmg: 0.1, mspd: 0.06 },
  proc: { on: 'crit', chance: 0.12, cd: 1.5, act: 'strike', mul: 2.0, aoe: 120, vis: 'petal', col: '#9fe870', name: '大成功！', desc: '暴击时 12% 几率魔法实验大成功：周围敌人受到 200% 伤害（冷却 1.5 秒）。' },
  desc: '魔法实验大成功的几率提高了！（至少大家都这么说）（官方 70 版 Lv60 史诗扫把）' });

/* ---------------- 2. Lv1~10（每类 1 件；法杖已有星海之杖-永夜） ---------------- */
EP('ep_rd_firefly', { wtype: 'rod', lvl: 5, name: '萤火虫魔杖', fx: { cspd: 0.06, mcrit: 0.03, light: 10 }, desc: '杖头的玻璃灯罩里住着一窝萤火虫，夜里走路不用点灯。' + ORIG });
EP('ep_pl_sprout', { wtype: 'pole', lvl: 7, name: '林间精灵的橡木棍', fx: { dmgUp: 0.04, aspd: 0.04, cspd: 0.04 },
  proc: { chance: 0.05, cd: 6, act: 'heal', hp: 0.03, name: '森之息', desc: '攻击时 5% 几率恢复 3% HP（冷却 6 秒）。' }, desc: '橡木棍两头还在发芽，抱在怀里能闻到森林的味道。' + ORIG });
EP('ep_br_cloud', { wtype: 'broom', lvl: 8, name: '棉花云扫把', fx: { mspd: 0.06, cspd: 0.04, dmgUp: 0.03 }, desc: '扫把头是一朵揪下来的云，骑上去软绵绵的。' + ORIG });
EP('ep_sp_tassel', { wtype: 'spear', lvl: 9, name: '赤缨破阵枪', fx: { dmgUp: 0.05, stagger: 20, fire: 10 }, desc: '枪头下一大团赤红长缨，冲进敌阵时像一团火。' + ORIG });

/* ---------------- 3. Lv34 普通（暗精灵 / 万年雪山领主）+ Lv38 暗黑城深渊 ---------------- */
EP('ep_sp_silverleaf', { wtype: 'spear', lvl: 34, name: '暗精灵的银叶长枪', st: SI(45), fx: { dmgUp: 0.09, dark: 26, crit: 0.03, mcrit: 0.03 }, desc: '暗精灵卫士的制式长枪，枪头是一片磨得发亮的银叶。' + ORIG });
EP('ep_pl_obsidian', { wtype: 'pole', lvl: 34, name: '熔岩穴的黑曜石棍', st: SI(10), fx: { dmgUp: 0.09, fire: 26, crit: 0.03, mcrit: 0.03 }, desc: '熔岩穴深处挖出的黑曜石，两端的岩浆纹路还在发烫。' + ORIG });
EP('ep_rd_spider', { wtype: 'rod', lvl: 34, name: '蛛后的织网魔杖', st: SI(45, 0), fx: { dmgUp: 0.09, dark: 25, mcrit: 0.04, crit: 0.02 }, desc: '蛛后用银丝织成的网，中间嵌着一颗紫色的蛛眼。' + ORIG });
EP('ep_st_frostfist', { wtype: 'staff', lvl: 34, name: '利库的冰霜法杖', st: SI(55, 0), fx: { dmgUp: 0.09, ice: 28 }, desc: '寒冰巨人利库掰下的一块冰晶，插在杖头上就再也没化过。' + ORIG });
EP('ep_br_frostfox', { wtype: 'broom', lvl: 34, name: '雪狐尾扫把', fx: { dmgUp: 0.09, ice: 25, mcrit: 0.03, crit: 0.03, mspd: 0.04 }, desc: '万年雪山雪狐的尾巴，扫过的地方会结一层薄霜。' + ORIG });
EP('ep_sp_abyssfang', { wtype: 'spear', lvl: 38, name: '深渊獠牙枪', st: SI(55), fx: { dmgUp: 0.12, dark: 28, critDmg: 0.08, crit: 0.03, mcrit: 0.03 },
  proc: { chance: 0.05, cd: 1.5, act: 'strike', mul: 1.9, aoe: 130, elem: 'dark', vis: 'dark', name: '獠牙贯穿！', desc: '攻击时 5% 几率刺出深渊獠牙：周围敌人受到 190% 暗属性伤害（冷却 1.5 秒）。' }, desc: '用深渊巨兽的獠牙磨成的枪头，刺进去就拔不出来。' + ORIG });
EP('ep_pl_chains', { wtype: 'pole', lvl: 38, name: '黑暗城卫的锁链棍', st: SI(50), fx: { dmgUp: 0.12, crit: 0.03, mcrit: 0.03, critDmg: 0.06, dark: 25 },
  proc: { chance: 0.05, cd: 1.5, act: 'strike', mul: 1.85, aoe: 130, elem: 'dark', vis: 'swords', col: '#b08cff', name: '锁链横扫！', desc: '攻击时 5% 几率甩出锁链：周围敌人受到 185% 暗属性伤害（冷却 1.5 秒）。' }, desc: '暗黑城守卫的铁棍，缠着锁住过无数囚徒的锁链。' + ORIG });
EP('ep_rd_skullcandle', { wtype: 'rod', lvl: 38, name: '亡灵烛台魔杖', st: SI(55, 0), fx: { dmgUp: 0.12, dark: 28, cspd: 0.05, mcrit: 0.04, critDmg: 0.08 },
  proc: { on: 'skill', chance: 0.1, cd: 2, act: 'strike', mul: 1.9, aoe: 110, elem: 'dark', vis: 'dark', col: '#c080ff', name: '冥火！', desc: '施放技能时 10% 几率烧起冥火：周围敌人受到 190% 暗属性伤害（冷却 2 秒）。' }, desc: '骷髅头上点着一支紫焰蜡烛，烛光照到的亡灵都会低头。' + ORIG });
EP('ep_st_darkpriest', { wtype: 'staff', lvl: 38, name: '暗精灵大祭司之杖', st: SI(55, 0), fx: { dmgUp: 0.12, mcrit: 0.04, crit: 0.03, critDmg: 0.1, dark: 25 },
  proc: { chance: 0.05, cd: 1.5, act: 'strike', mul: 2.0, aoe: 140, elem: 'dark', vis: 'nova', col: '#a080ff', name: '暗月祷言！', desc: '攻击时 5% 几率念出暗月祷言：周围敌人受到 200% 暗属性伤害（冷却 1.5 秒）。' }, desc: '暗精灵大祭司世代相传的法杖，紫水晶里映着地底的月亮。' + ORIG });
EP('ep_br_midnight', { wtype: 'broom', lvl: 38, name: '蝙蝠翼的午夜扫把', st: SI(45, 0), fx: { dmgUp: 0.12, dark: 26, mcrit: 0.03, crit: 0.03, mspd: 0.05 },
  proc: { chance: 0.05, cd: 1.5, act: 'strike', mul: 1.8, aoe: 130, elem: 'dark', vis: 'dark', col: '#ff5a7a', name: '夜翼！', desc: '攻击时 5% 几率召来蝙蝠群：周围敌人受到 180% 暗属性伤害（冷却 1.5 秒）。' }, desc: '一到午夜，扫把两侧的蝙蝠翅膀就会自己扇起来。' + ORIG });

/* ---------------- 4. Lv45（牛头 / 盗贼 / 哈穆林）+ Lv48（根特 / 虫穴）：官方 60 版 Lv50 的魔法师武器名单没查到，用原创补 ---------------- */
EP('ep_sp_piston', { wtype: 'spear', lvl: 45, name: '比尔马克的打桩长枪', st: SI(25), fx: { dmgUp: 0.1, critDmg: 0.12, stagger: 30 },
  proc: { chance: 0.05, cd: 1.5, act: 'strike', mul: 1.8, aoe: 120, vis: 'slash', col: '#ffc070', name: '蒸汽打桩！', desc: '攻击时 5% 几率启动蒸汽打桩：周围敌人受到 180% 伤害（冷却 1.5 秒）。' }, desc: '帝国试验场的打桩机改成的长枪，枪头每刺一下都喷一口蒸汽。' + ORIG });
EP('ep_pl_coin', { wtype: 'pole', lvl: 45, name: '盗贼王的金币棍', fx: { dmgUp: 0.1, crit: 0.04, mcrit: 0.04, critDmg: 0.12, goldUp: 0.05 },
  proc: { chance: 0.1, act: 'extra', frac: 0.3, col: '#ffd24a', desc: '攻击时 10% 几率附加 30% 伤害。' }, desc: '两头箍满了抢来的金币，敲人的时候叮叮当当。' + ORIG });
EP('ep_rd_baton', { wtype: 'rod', lvl: 45, name: '魔笛手的指挥棒', fx: { dmgUp: 0.1, cspd: 0.06, mcrit: 0.04, dark: 30 },
  proc: [{ chance: 0.04, cd: 6, act: 'status', status: 'stun', dur: 1, name: '迷乱之音', desc: '攻击时 4% 几率奏响迷乱之音（眩晕 1 秒，冷却 6 秒），' }, { vs: 'stun', act: 'extra', frac: 0.2, desc: '攻击眩晕中的敌人附加 20% 伤害。' }], desc: '哈穆林的魔笛手留下的指挥棒，一挥就有音符跟着飞。' + ORIG });
EP('ep_st_steam', { wtype: 'staff', lvl: 45, name: '试验体的蒸汽法杖', fx: { dmgUp: 0.1, light: 25 },
  proc: { chance: 0.05, cd: 1.5, act: 'strike', mul: 1.9, aoe: 130, elem: 'light', vis: 'bolt', col: '#7fd8ff', name: '过载！', desc: '攻击时 5% 几率能量过载：周围敌人受到 190% 光属性伤害（冷却 1.5 秒）。' }, desc: '比尔马克帝国的试验品，玻璃罐里的蓝色液体一直在冒泡。' + ORIG });
EP('ep_br_scarecrow', { wtype: 'broom', lvl: 45, name: '稻草人的迷途扫把', fx: { dmgUp: 0.1, critDmg: 0.1, mspd: 0.05 },
  proc: { chance: 0.04, act: 'status', status: 'slow', dur: 3, name: '迷途', desc: '攻击时 4% 几率让敌人迷路（减速 3 秒）。' }, desc: '迷乱之村田里的稻草人，被魔笛声吵醒后跟着冒险家走了。' + ORIG });
EP('ep_sp_gentguard', { wtype: 'spear', lvl: 48, name: '根特皇家近卫长枪', st: SI(35), fx: { dmgUp: 0.11, light: 30, critDmg: 0.12 },
  proc: { chance: 0.05, cd: 1.5, act: 'strike', mul: 1.9, aoe: 130, elem: 'light', vis: 'holy', name: '近卫冲锋！', desc: '攻击时 5% 几率发起冲锋：周围敌人受到 190% 光属性伤害（冷却 1.5 秒）。' }, desc: '根特皇家近卫队的仪仗长枪，枪下挂着蓝金两色的军旗。' + ORIG });
EP('ep_pl_chitin', { wtype: 'pole', lvl: 48, name: '虫王的甲壳棍', st: SI(50), fx: { dmgUp: 0.11, critDmg: 0.14, crit: 0.03, mcrit: 0.03 },
  proc: [{ chance: 0.06, act: 'status', status: 'poison', dur: 4, dps: 0.12, vis: 'dark', col: '#9ad070', name: '虫毒', desc: '攻击时 6% 几率使敌人中毒 4 秒，' }, { vs: 'poison', act: 'extra', frac: 0.15, desc: '攻击中毒的敌人附加 15% 伤害。' }], desc: '悲鸣洞穴虫王脱下的甲壳，一头还留着带毒的尾刺。' + ORIG });
EP('ep_rd_gear', { wtype: 'rod', lvl: 48, name: '天界工匠的齿轮魔杖', st: SI(55, 0), fx: { dmgUp: 0.11, cspd: 0.07, cdr: 0.05, mcrit: 0.04 },
  proc: { on: 'skill', chance: 0.1, cd: 2, act: 'strike', mul: 1.9, aoe: 110, vis: 'bolt', col: '#7fd8ff', name: '齿轮咬合！', desc: '施放技能时 10% 几率释放齿轮能量：周围敌人受到 190% 伤害（冷却 2 秒）。' }, desc: '天界工匠把一整座钟楼的齿轮塞进了杖头。' + ORIG });
EP('ep_st_astrolabe', { wtype: 'staff', lvl: 48, name: '根特魔导团的星盘杖', st: SI(60, 0), fx: { dmgUp: 0.11, mcrit: 0.05, elemAll: 20 },
  proc: { chance: 0.05, cd: 1.5, act: 'strike', mul: 2.0, aoe: 140, vis: 'nova', col: '#9fc8ff', name: '星位校准！', desc: '攻击时 5% 几率校准星位：周围敌人受到 200% 伤害（冷却 1.5 秒）。' }, desc: '根特魔导团团长的星盘，三道铜环转个不停。' + ORIG });
EP('ep_br_chimney', { wtype: 'broom', lvl: 48, name: '烟囱清扫者', st: SI(35, 0), fx: { dmgUp: 0.11, fire: 30, mspd: 0.06, critDmg: 0.12 },
  proc: { chance: 0.06, act: 'status', status: 'burn', dur: 3, dps: 0.12, vis: 'fire', name: '余烬', desc: '攻击时 6% 几率扬起余烬（灼伤 3 秒）。' }, desc: '根特城里清扫烟囱的圆刷子，炭灰里还埋着火星。' + ORIG });

/* ---------------- 5. 官方新增（游戏里原来没有） ---------------- */
// Lv55（60 版）
EP('ep_pl_duck', { wtype: 'pole', lvl: 55, name: '疯狂的鸭子', st: SI(20), fx: { dmgUp: 0.11, aspd: 0.06, cspd: 0.06, critDmg: 0.12 },
  proc: { chance: 0.08, cd: 1, act: 'strike', mul: 1.8, aoe: 100, vis: 'petal', col: '#ffe060', name: '嘎！', desc: '攻击时 8% 几率让鸭子发疯：周围敌人受到 180% 伤害（冷却 1 秒）。' }, desc: '棍头的鸭子一挨打就嘎嘎乱叫，谁也不知道它为什么这么生气。（官方 60 版 Lv55 史诗棍棒）' });
EP('ep_st_willyrage', { wtype: 'staff', lvl: 55, name: '怒之威利的戒言法杖', st: SI(30, 0), fx: { dmgUp: 0.12, fire: 32, mcrit: 0.04 },
  proc: { chance: 0.06, cd: 1.5, act: 'strike', mul: 1.9, aoe: 140, elem: 'fire', vis: 'fire', name: '怒之戒言！', desc: '攻击时 6% 几率吼出怒之戒言：周围敌人受到 190% 火属性伤害（冷却 1.5 秒）。' }, desc: '威利发怒时烧掉了一半经卷，剩下的戒言字字带火。（官方 60 版 Lv55 史诗法杖）' });
// Lv60 T1（70 版 Lv60）
EP('ep_pl_elandra', { wtype: 'pole', lvl: 60, tier: 1, name: '艾兰德拉的终极战棍', fx: { dmgUp: 0.12, critDmg: 0.16, aspd: 0.05, cspd: 0.05 },
  proc: { chance: 0.05, cd: 1.5, act: 'strike', mul: 2.1, aoe: 140, elem: 'light', vis: 'swords', col: '#bfe6ff', name: '终极乱舞！', desc: '攻击时 5% 几率使出终极乱舞：周围敌人受到 210% 光属性伤害（冷却 1.5 秒）。' }, desc: '铁匠艾兰德拉晚年打造的战棍，两端的银翼一碰就响。（官方 70 版 Lv60 史诗棍棒）' });
// Lv60 T2（官方 Lv65）
EP('ep_sp_snowwhite', { wtype: 'spear', lvl: 60, tier: 2, name: '纯白之矛', st: SI(30), fx: { dmgUp: 0.13, light: 35, critDmg: 0.16, stagger: 40 },
  proc: { chance: 0.05, cd: 1.5, act: 'strike', mul: 2.3, aoe: 140, elem: 'light', vis: 'holy', name: '纯白审判！', desc: '攻击时 5% 几率降下纯白审判：周围敌人受到 230% 光属性伤害（冷却 1.5 秒）。' }, desc: '一尘不染的白矛，据说沾不上任何污秽。（官方 Lv65 史诗矛）' });
EP('ep_pl_reaper', { wtype: 'pole', lvl: 60, tier: 2, name: '死神之诱惑', fx: { dmgUp: 0.13, dark: 35, critDmg: 0.15, cdr: 0.05 },
  proc: [{ chance: 0.05, cd: 1.5, act: 'strike', mul: 2.3, aoe: 140, elem: 'dark', vis: 'dark', name: '死神低语！', desc: '攻击时 5% 几率听见死神低语：周围敌人受到 230% 暗属性伤害（冷却 1.5 秒），' },
    { chance: 0.08, act: 'extra', frac: 0.1, exec: 0.2, col: '#b060ff', desc: '8% 几率附加伤害（敌人 HP 越低越多，最多 30%）。' }], desc: '握住它的人会听见一个温柔的声音：再多打一下吧。（官方 Lv65 史诗棍棒）' });
EP('ep_rd_icedragon', { wtype: 'rod', lvl: 60, tier: 2, name: '冰龙魔杖', fx: { dmgUp: 0.13, ice: 35, cspd: 0.08, mcrit: 0.05, critDmg: 0.15 },
  proc: [{ chance: 0.05, cd: 1.5, act: 'strike', mul: 2.3, aoe: 140, elem: 'ice', vis: 'ice', name: '冰龙吐息！', desc: '攻击时 5% 几率唤出冰龙吐息：周围敌人受到 230% 冰属性伤害（冷却 1.5 秒），' },
    { chance: 0.04, cd: 5, act: 'status', status: 'freeze', dur: 1, name: '冰封', desc: '4% 几率冰冻敌人 1 秒（冷却 5 秒）。' }], desc: '一条小冰龙盘在杖头，打个喷嚏都是冰碴。（官方 Lv65 史诗魔杖）' });
EP('ep_br_rescue', { wtype: 'broom', lvl: 60, tier: 2, name: '危机拯救者', fx: { dmgUp: 0.13, critDmg: 0.16, mspd: 0.08, cspd: 0.08 },
  proc: [{ on: 'lowhp', chance: 1, cd: 30, act: 'shield', amt: 0.3, dur: 8, name: '紧急救援', desc: 'HP 低于 30% 时获得护盾：8 秒内吸收最多 30% HP 上限的伤害（冷却 30 秒）；' },
    { chance: 0.05, cd: 1.5, act: 'strike', mul: 2.2, aoe: 130, vis: 'nova', col: '#ff8080', name: '警笛！', desc: '攻击时 5% 几率拉响警笛：周围敌人受到 220% 伤害（冷却 1.5 秒）。' }], desc: '救援队的红白扫把，警灯一亮就是有人要倒霉了——反正不是你。（官方 Lv65 史诗扫把）' });
// Lv60 T3（官方 Lv70，时空之门深渊专属 + 攻坚低概率）
EP('ep_sp_tianjiao', { wtype: 'spear', lvl: 60, tier: 3, name: '天骄战矛', st: SI(30), fx: { dmgUp: 0.15, fire: 40, critDmg: 0.18, aspd: 0.05 },
  proc: [{ chance: 0.05, cd: 1.5, act: 'strike', mul: 2.7, aoe: 160, elem: 'fire', vis: 'fire', col: '#ffb040', name: '天骄破军！', desc: '攻击时 5% 几率横扫千军：周围敌人受到 270% 火属性伤害（冷却 1.5 秒）；' },
    { on: 'kill', chance: 0.5, cd: 10, act: 'buff', buff: { atk: 0.12 }, dur: 8, key: 'tianjiao', col: '#ffb040', name: '天骄', desc: '击杀敌人时 50% 几率攻击力 +12%，持续 8 秒（冷却 10 秒）。' }], desc: '天之骄子的金色战矛，矛锋所指之处无人敢挡。（官方 80 版 Lv70 史诗矛）' });
EP('ep_sp_lance1893', { wtype: 'spear', lvl: 60, tier: 3, name: 'M1893骑士之矛', st: SI(60), fx: { dmgUp: 0.15, light: 40, critDmg: 0.16, stagger: 60 },
  proc: [{ chance: 0.05, cd: 1.5, act: 'strike', mul: 2.6, aoe: 150, elem: 'light', vis: 'swords', col: '#ffd070', name: '骑士冲锋！', desc: '攻击时 5% 几率发动骑士冲锋：周围敌人受到 260% 光属性伤害（冷却 1.5 秒），' },
    { chance: 0.04, cd: 6, act: 'status', status: 'stun', dur: 1, name: '重击', desc: '4% 几率击晕敌人 1 秒（冷却 6 秒）。' }], desc: '海上列车时代的骑士长枪，枪身里装着一台小型蒸汽机。（官方 80 版 Lv70 史诗矛）' });
EP('ep_pl_frost', { wtype: 'pole', lvl: 60, tier: 3, name: '极寒水晶棍', fx: { dmgUp: 0.15, ice: 35, critDmg: 0.08, aspd: 0.04, cspd: 0.04 },
  proc: [{ chance: 0.05, cd: 1.5, act: 'strike', mul: 2.7, aoe: 160, elem: 'ice', vis: 'ice', name: '绝对零度！', desc: '攻击时 5% 几率释放绝对零度：周围敌人受到 270% 冰属性伤害（冷却 1.5 秒），' },
    { chance: 0.04, cd: 5, act: 'status', status: 'freeze', dur: 1.2, name: '冰封', desc: '4% 几率冰冻敌人 1.2 秒（冷却 5 秒）。' }], desc: '整根棍子是一块万年不化的寒冰水晶，握久了手会冻住。（官方 80 版 Lv70 史诗棍棒）' });
EP('ep_rd_rabbit', { wtype: 'rod', lvl: 60, tier: 3, name: '灵兔魔杖', st: SI(25, 0), fx: { dmgUp: 0.15, light: 40, cspd: 0.1, mcrit: 0.06 },
  proc: [{ chance: 0.06, cd: 1.2, act: 'strike', mul: 2.6, aoe: 150, elem: 'light', vis: 'moon', col: '#fff0b0', name: '玉兔捣药！', desc: '攻击时 6% 几率召唤玉兔：周围敌人受到 260% 光属性伤害（冷却 1.2 秒）；' },
    { on: 'skill', chance: 0.08, cd: 12, act: 'buff', buff: { cspd: 0.15 }, dur: 8, key: 'rabbit', col: '#fff0b0', name: '月兔', desc: '施放技能时 8% 几率施放速度 +15%，持续 8 秒（冷却 12 秒）。' }], desc: '月亮上的玉兔坐在杖头，一蹦就是一道月光。（官方 80 版 Lv70 史诗魔杖）' });
EP('ep_br_wargod', { wtype: 'broom', lvl: 60, tier: 3, name: '战神之眉', st: SI(10, 0), fx: { dmgUp: 0.15, critDmg: 0.18, fire: 35, mspd: 0.06 },
  proc: [{ chance: 0.05, cd: 1.5, act: 'strike', mul: 2.7, aoe: 160, elem: 'fire', vis: 'fire', col: '#ff6040', name: '战神怒目！', desc: '攻击时 5% 几率战神怒目：周围敌人受到 270% 火属性伤害（冷却 1.5 秒）；' },
    { on: 'crit', chance: 0.1, cd: 8, act: 'buff', buff: { crit: 0.05 }, dur: 6, key: 'wargod', col: '#ff6040', name: '战意', desc: '暴击时 10% 几率暴击率 +5%，持续 6 秒（冷却 8 秒）。' }], desc: '扫把头是战神头盔上的赤红盔缨，一挥就是一面战旗。（官方 80 版 Lv70 史诗扫把）' });
EP('ep_br_dink', { wtype: 'broom', lvl: 60, tier: 3, name: '丁克蛇的魔术扫把', fx: { dmgUp: 0.15, dark: 40, cspd: 0.1, mspd: 0.06 },
  proc: [{ chance: 0.06, act: 'status', status: 'poison', dur: 4, dps: 0.2, vis: 'dark', col: '#9ad070', name: '蛇毒', desc: '攻击时 6% 几率使敌人中毒 4 秒，' }, { vs: 'poison', act: 'extra', frac: 0.2, desc: '攻击中毒的敌人附加 20% 伤害；' },
    { chance: 0.04, cd: 1.5, act: 'strike', mul: 2.5, aoe: 150, elem: 'dark', vis: 'dark', col: '#b070ff', name: '魔术秀！', desc: '4% 几率上演魔术秀：周围敌人受到 250% 暗属性伤害（冷却 1.5 秒）。' }], desc: '魔术师丁克蛇的道具扫把，一挥就能从帽子里变出毒蛇。（官方 80 版 Lv70 史诗扫把）' });

/* ---------------- 6. 领主神器 / Lv55 粉装（粉色，只在指定领主身上掉；拿在手里用 <类型>_r3 外观，只做图标） ---------------- */
NM('nm_pole_kaino', { wtype: 'pole', lvl: 9, lord: 'goblinShaman', name: '幻影雷光电棍', fx: { dmgUp: 0.03, light: 10 },
  proc: { chance: 0.05, cd: 2, act: 'strike', mul: 1.3, elem: 'light', vis: 'bolt', name: '雷光！', desc: '攻击时 5% 几率落下雷光（130% 光属性伤害，冷却 2 秒）。' }, desc: '落雷凯诺手里那根噼啪作响的电棍。（官方领主神器，落雷凯诺）' });
NM('nm_staff_lotus', { wtype: 'staff', lvl: 30, lord: 'lotus', name: '魂灵法杖', fx: { dmgUp: 0.05, mcrit: 0.03, dark: 15 },
  proc: { chance: 0.04, cd: 2, act: 'strike', mul: 1.5, aoe: 110, elem: 'dark', vis: 'dark', name: '魂灵！', desc: '攻击时 4% 几率放出魂灵（周围 150% 暗属性伤害，冷却 2 秒）。' }, desc: '长脚罗特斯吞下的魂灵聚成的法杖。（官方领主神器，长脚罗特斯）' });
NM('nm_staff_spiz', { wtype: 'staff', lvl: 34, lord: 'spiz', name: '邪龙之脊', fx: { dmgUp: 0.06, dark: 18 },
  proc: { chance: 0.04, cd: 2, act: 'strike', mul: 1.5, aoe: 110, elem: 'dark', vis: 'dark', col: '#c0304a', name: '邪龙之息！', desc: '攻击时 4% 几率喷出邪龙之息（周围 150% 暗属性伤害，冷却 2 秒）。' }, desc: '邪龙斯皮兹的一节脊骨。（官方领主神器，邪龙斯皮兹）' });
NM('nm_spear_headless', { wtype: 'spear', lvl: 37, lord: 'headlessKnight', name: '无头骑士的喧灵战矛', fx: { dmgUp: 0.06, dark: 18, stagger: 30 },
  proc: { chance: 0.05, cd: 6, act: 'status', status: 'slow', dur: 3, name: '喧灵', desc: '攻击时 5% 几率让亡灵缠住敌人（减速 3 秒，冷却 6 秒）。' }, desc: '无头骑士冲锋时举着的战矛，矛上的亡灵一刻不停地哭喊。（官方领主神器，无头骑士）' });
NM('nm_staff_sabertooth', { wtype: 'staff', lvl: 39, lord: 'sabertooth', name: '沙凡特的霜灵法杖', fx: { dmgUp: 0.06, ice: 20 },
  proc: { chance: 0.04, cd: 5, act: 'status', status: 'freeze', dur: 1, name: '霜灵', desc: '攻击时 4% 几率冰冻敌人 1 秒（冷却 5 秒）。' }, desc: '冰齿沙凡特的獠牙上凝出的霜灵。（官方领主神器，冰齿沙凡特）' });
NM('nm_broom_seski', { wtype: 'broom', lvl: 40, lord: 'seski', name: '塞斯奇的霜灵扫把', fx: { dmgUp: 0.06, ice: 20, mspd: 0.04 },
  proc: { chance: 0.05, cd: 6, act: 'status', status: 'slow', dur: 3, name: '霜灵', desc: '攻击时 5% 几率冻住敌人的脚（减速 3 秒，冷却 6 秒）。' }, desc: '塞斯奇骑着在雪原上巡逻的扫把。（官方领主神器，塞斯奇）' });
NM('nm_spear_thor', { wtype: 'spear', lvl: 55, lord: 'podir', name: '雷神的永恒战戟', fx: { dmgUp: 0.08, light: 25, stagger: 30 },
  proc: { chance: 0.05, cd: 2, act: 'strike', mul: 1.7, aoe: 120, elem: 'light', vis: 'bolt', name: '永恒雷鸣！', desc: '攻击时 5% 几率降下雷鸣（周围 170% 光属性伤害，冷却 2 秒）。' }, desc: '雷神留在人间的战戟，雷声从来没停过。（官方 60 版 Lv55 神器矛）' });
NM('nm_pole_flute', { wtype: 'pole', lvl: 55, lord: 'fladin', name: '万波息笛', fx: { dmgUp: 0.08, cspd: 0.05, aspd: 0.05 },
  proc: { chance: 0.05, cd: 10, act: 'heal', hp: 0.04, mp: 0.04, name: '息笛', desc: '攻击时 5% 几率吹响息笛：恢复 4% HP 和 MP（冷却 10 秒）。' }, desc: '吹一声，万顷波涛都会平息的笛子，也能当棍子用。（官方 60 版 Lv55 神器棍棒）' });
NM('nm_rod_dawn', { wtype: 'rod', lvl: 55, lord: 'utara', name: '黎明之息', fx: { dmgUp: 0.08, light: 25, cspd: 0.05 },
  proc: { on: 'skill', chance: 0.08, cd: 2, act: 'strike', mul: 1.6, elem: 'light', vis: 'holy', name: '晨光！', desc: '施放技能时 8% 几率洒下晨光（160% 光属性伤害，冷却 2 秒）。' }, desc: '黎明第一缕光凝成的魔杖。（官方 60 版 Lv55 神器魔杖）' });
NM('nm_staff_harmony', { wtype: 'staff', lvl: 55, lord: 'belit', name: '元素谐音', fx: { dmgUp: 0.08, elemAll: 20 },
  proc: { chance: 0.05, cd: 2, act: 'strike', mul: 1.7, aoe: 120, vis: 'nova', name: '谐音！', desc: '攻击时 5% 几率四元素齐鸣（周围 170% 伤害，冷却 2 秒）。' }, desc: '火、冰、光、暗四颗宝珠绕着杖头转，发出和谐的共鸣。（官方 60 版 Lv55 神器法杖）' });
NM('nm_staff_lynn', { wtype: 'staff', lvl: 55, lord: 'nilbas', name: '琳恩的第二个法杖', fx: { dmgUp: 0.08, mcrit: 0.04, cspd: 0.04 },
  proc: { chance: 0.04, cd: 15, act: 'shield', amt: 0.2, dur: 6, name: '琳恩的守护', desc: '攻击时 4% 几率获得护盾：6 秒内吸收最多 20% HP 上限的伤害（冷却 15 秒）。' }, desc: '魔法师琳恩做坏了第一根之后，认认真真做的第二根。（官方 60 版 Lv55 神器法杖）' });
NM('nm_broom_bone', { wtype: 'broom', lvl: 55, lord: 'skelKnight', name: '永恒的骨弹扫把', fx: { dmgUp: 0.08, dark: 25, mspd: 0.05 },
  proc: { chance: 0.05, cd: 2, act: 'strike', mul: 1.7, aoe: 120, elem: 'dark', vis: 'dark', name: '骨弹！', desc: '攻击时 5% 几率射出骨弹（周围 170% 暗属性伤害，冷却 2 秒）。' }, desc: '扫把头里藏着射不完的骨弹。（官方 60 版 Lv55 神器扫把）' });
monDrop('goblinShaman', [['nm_pole_kaino', 0.025]]);
monDrop('lotus', [['nm_staff_lotus', 0.02]]);
monDrop('spiz', [['nm_staff_spiz', 0.02]]);
monDrop('headlessKnight', [['nm_spear_headless', 0.02]]);
monDrop('sabertooth', [['nm_staff_sabertooth', 0.02]]);
monDrop('seski', [['nm_broom_seski', 0.02]]);
monDrop('podir', [['nm_spear_thor', 0.02]]);
monDrop('fladin', [['nm_pole_flute', 0.02]]);
monDrop('utara', [['nm_rod_dawn', 0.02]]);
monDrop('belit', [['nm_staff_harmony', 0.02]]);
monDrop('nilbas', [['nm_staff_lynn', 0.02]]);
monDrop('skelKnight', [['nm_broom_bone', 0.02]]);

/* ---------------- 7. 掉落 / 深渊归属 ---------------- */
// Lv1~10
gearDrop('dark_woods', [['ep_rd_firefly', 0.008]]);
gearDrop('dark_woods_deep', [['ep_pl_sprout', 0.008]]);
gearDrop('thunder_ruins', [['ep_br_cloud', 0.008]]);
gearDrop('venom_ruins', [['ep_sp_tassel', 0.008]]);
// Lv34（暗精灵 / 万年雪山领主表）；Lv38 = 暗黑城深渊专属
gearDrop('darkelf_tomb', [['ep_pl_obsidian', 0.008], ['ep_st_frostfist', 0.008]]);
gearDrop('lava_cave', [['ep_sp_silverleaf', 0.008], ['ep_pl_obsidian', 0.008], ['ep_rd_spider', 0.008]]);
gearDrop('king_ruins', [['ep_sp_silverleaf', 0.008], ['ep_st_frostfist', 0.008], ['ep_br_frostfox', 0.008]]);
gearDrop('frozen_heart', [['ep_rd_spider', 0.008], ['ep_br_frostfox', 0.008]]);
abyssClaim('darkelf', ['ep_sp_abyssfang', 'ep_pl_chains', 'ep_rd_skullcandle', 'ep_st_darkpriest', 'ep_br_midnight']);
// Lv45（牛头 / 盗贼 / 哈穆林）、Lv48（根特 / 虫穴）
gearDrop('bilmark', [['ep_sp_piston', 0.01], ['ep_st_steam', 0.01]]);
gearDrop('fallen_bandits', [['ep_pl_coin', 0.01], ['ep_br_scarecrow', 0.008]]);
gearDrop('hamelin', [['ep_rd_baton', 0.01], ['ep_br_scarecrow', 0.008], ['ep_sp_piston', 0.008]]);
gearDrop('gent_outskirts', [['ep_sp_gentguard', 0.008], ['ep_br_chimney', 0.008], ['ep_st_astrolabe', 0.008]]);
gearDrop('gent_east', [['ep_sp_gentguard', 0.008], ['ep_rd_gear', 0.008], ['ep_st_astrolabe', 0.008]]);
gearDrop('wailing_cave', [['ep_pl_chitin', 0.01], ['ep_rd_gear', 0.008], ['ep_br_chimney', 0.008]]);
// Lv55（海上列车 / 时空之门前段）
gearDrop('west_line', [['ep_sp_evil', 0.008], ['ep_pl_duck', 0.008], ['ep_rd_cheshire', 0.008]]);
gearDrop('heis', [['ep_st_willy', 0.008], ['ep_rd_thunder', 0.008], ['ep_br_scribble', 0.008]]);
gearDrop('grand_fire', [['ep_pl_breaker', 0.008], ['ep_st_willyrage', 0.008]]);
gearDrop('plague_source', [['ep_sp_evil', 0.008], ['ep_br_scribble', 0.008]]);
gearDrop('kartel_origin', [['ep_rd_thunder', 0.008], ['ep_pl_duck', 0.008], ['ep_rd_cheshire', 0.008]]);
gearDrop('holy_war', [['ep_st_willyrage', 0.008], ['ep_pl_breaker', 0.008], ['ep_st_willy', 0.008]]);
// Lv60 T1（时空之门后段 / 希洛克）
gearDrop('secret_zone', [['ep_sp_lava', 0.008], ['ep_st_sage', 0.008]]);
gearDrop('old_wail', [['ep_pl_phantom', 0.008], ['ep_br_lucky', 0.008]]);
gearDrop('old_winter', [['ep_pl_elandra', 0.008], ['ep_rd_meow', 0.008]]);
gearDrop('law_gate', [['ep_sp_lava', 0.006], ['ep_pl_elandra', 0.006]]);
gearDrop('wit_gate', [['ep_st_sage', 0.006], ['ep_br_lucky', 0.006]]);
gearDrop('pain_gate', [['ep_pl_phantom', 0.006], ['ep_rd_meow', 0.006]]);
// Lv60 T2（攻坚：谜之觉悟、无形棺柩；阿登高地低概率）
const T2 = ['ep_sp_snowwhite', 'ep_pl_reaper', 'ep_rd_icedragon', 'ep_st_witchgold', 'ep_br_rescue'];
gearDrop('iris_raid', T2.map(k => [k, 0.006]));
gearDrop('siroco_coffin', T2.map(k => [k, 0.006]));
gearDrop('arden', T2.map(k => [k, 0.002]));
// Lv60 T3（时空之门深渊专属；攻坚 0.3%）
const T3 = ['ep_sp_tianjiao', 'ep_sp_lance1893', 'ep_pl_frost', 'ep_rd_rabbit', 'ep_st_moon', 'ep_br_wargod', 'ep_br_dink'];
abyssClaim('timegate', T3);
gearDrop('iris_raid', T3.map(k => [k, 0.003]));
gearDrop('siroco_coffin', T3.map(k => [k, 0.003]));
}
