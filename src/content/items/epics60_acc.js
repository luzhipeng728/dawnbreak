/* =====================================================================
   装备 2.0 · B3 首饰 / 辅助装备 / 魔法石（含首饰 / 特殊领主神器）
   只写本块的物品；搬家 / 继承 / 领主神器 / 掉落 / 深渊归属一律用 gear60_api.js 的接口（用法见 docs/GEAR_PLAN_60.md §6）。
   注释只放在行尾或单独一行（一行中间的 // 会吞掉后面的字段）。
   数值（§2.3）：首饰 / 特殊单件 dmgUp .06（Lv33）→ .08（Lv57）；Lv60 T1 .07~.09、T2 .07~.08 + 高属强、T3 .11 + 招牌特效；
   3 件首饰套 Lv40 / 45 / 48 的 3 件效果 dmgUp .12~.13（和格拉西亚 .13 同档），战神 T1 .15、时空主宰者 T3 .18。
   ===================================================================== */
{
const B3 = (key, def) => { if (ITEMS[key]) g60Problem(`B3：${key} 已经存在`); return defineGear(key, { rar: 5, icon: 'item_' + key, ...def }); };
function acc3(id, name, lvl, names, bonus, extra = {}) {
  if (SETS[id]) g60Problem(`B3：套装 ${id} 已经存在`);
  defineSet(id, { name, bonus, epic: true });
  ACC_SLOTS.forEach((s, i) => { B3(`${id}_${s}`, { slot: s, lvl, name: names[i], fx: {}, ...extra, set: id }); SETS[id].pieces.push(`${id}_${s}`); });
}
const T1 = '官方 70 版 Lv60 史诗', T2 = '官方 Lv65 史诗（本作 Lv60 T2）', T3 = '官方 80 版 Lv70 史诗（本作 Lv60 T3）';

/* ---------------- 继承装备（先继承：inheritSet 会复制套装当时的件数效果）---------------- */
inheritSet('set_wargod', 'set_ac_skysoul', { name: '苍穹战魂', pieces: { neck: '苍穹战魂项链', bracelet: '苍穹战魂手镯', ring: '苍穹战魂戒指' },
  desc: '天空之城的守卫仿照战神的首饰打的信物，戴上它连击越打越顺手。（本作原创，继承自「战神的天袭」）' });
inheritSet('set_timelord', 'set_ac_chrono', { name: '刻时者', pieces: { neck: '刻时者的怀表项链', bracelet: '刻时者的齿轮手镯', ring: '刻时者的指针戒指' },
  desc: '天空之城的钟楼匠人留下的首饰，指针走得比别人快一点。（本作原创，继承自「时空主宰者」）' });
inheritEpic('ep_sup_michel', 'ep_sup_prayer', { name: '修女的祈祷符', desc: '见习修女一针一线缝出来的祈祷符，缝进了整整一年的祷词。（本作原创，继承自「米歇尔的祝福」）' });
inheritEpic('ep_sup_paris', 'ep_sup_crest', { name: '没落贵族的家徽', desc: '家族早已没落，家徽却还擦得锃亮。（本作原创，继承自「帕丽丝的家族象征」）' });
inheritEpic('ep_stone_platani', 'ep_stone_golem', { name: '石巨人的琥珀核', desc: '石巨人胸口的琥珀色核心，敲一敲还会嗡嗡作响。只有石巨人塔的领主会掉落它。（本作原创，继承自「普拉塔尼的黄金石」）' });
inheritEpic('ep_stone_grelin', 'ep_stone_dawnheart', { name: '光辉之心', desc: '天空之城最高的塔尖上结出的心形晶石。（本作原创，继承自「极光格雷林之泪」）' });
inheritEpic('ep_stone_herik', 'ep_stone_flameheart', { name: '烈焰之心', desc: '在天空之城的熔炉里烧了一百年的心形晶石。（本作原创，继承自「火焰赫瑞克的眼泪」）' });
inheritEpic('ep_stone_aqui', 'ep_stone_frostheart', { name: '霜冻之心', desc: '天空之城背阴处的冰壁里挖出来的心形晶石。（本作原创，继承自「冰影阿奎利斯之泪」）' });
inheritEpic('ep_stone_merkel', 'ep_stone_nightheart', { name: '暗夜之心', desc: '只在没有月亮的夜里发光的心形晶石。（本作原创，继承自「亡魂默克尔之泪」）' });

/* ---------------- 搬家：官方物品回到官方等级 ---------------- */
// 战神的天袭：官方 70 版 Lv60 首饰套装 → Lv60 T1（普通掉落：时空之门后段、希洛克）
moveSet('set_wargod', { lvl: 60, tier: 1, abyss: false, desc: `战神从天而降时佩戴的首饰，连击越长越勇猛。（${T1}首饰套装）`,
  bonus: {
    2: { st: { str: 60, int: 60, elemAll: 15 }, desc: '力量 / 智力 +60，所有属性强化 +15' },
    3: { st: { dmgUp: 0.15 }, desc: '【连击流】伤害增加 15%；连击达到 50 时攻击 / 施放 / 移动速度 +10%，达到 100 时攻击力 +12%（各持续 10 秒）',
      proc: [{ combo: 50, cd: 10, act: 'buff', buff: { aspd: 0.1, cspd: 0.1, mspd: 0.1 }, dur: 10, key: 'wargod1', name: '战神·疾', col: '#ffd23a' }, { combo: 100, cd: 10, act: 'buff', buff: { atk: 0.12 }, dur: 10, key: 'wargod2', name: '战神·怒', col: '#ff6a3a' }] } } });
// 时空主宰者：官方 80 版 Lv70 首饰套装 → Lv60 T3（魔界深渊专属 + 谜之觉悟 / 无形棺柩攻坚 0.3%）
moveSet('set_timelord', { lvl: 60, tier: 3, desc: `主宰时空的人，从不等待冷却。（${T3}首饰套装）`,
  bonus: {
    2: { st: { cdr: 0.08, cspd: 0.06, aspd: 0.06 }, desc: '技能冷却 -8%，攻击 / 施放速度 +6%' },
    3: { st: { cdr: 0.1, dmgUp: 0.18 }, desc: '【冷却流】技能冷却 -10%，伤害增加 18%；施放技能时 12% 几率重置冷却，10% 几率撕开时间裂隙（周围 260% 伤害）',
      proc: [{ on: 'skill', chance: 0.12, act: 'reset', name: '时空回溯' }, { on: 'skill', chance: 0.1, cd: 2, act: 'strike', mul: 2.6, aoe: 130, vis: 'nova', col: '#7ad8ff', name: '时间裂隙' }] } } });
moveEpic('ep_sup_michel', { lvl: 60, tier: 1, fx: { dmgUp: 0.07, allStat: 24, resAll: 12, dmgReduce: 0.03 }, desc: `圣职者米歇尔亲手祝福过的护符，替主人挡下一半的厄运。（${T1}辅助装备）` });
moveEpic('ep_sup_paris', { lvl: 60, tier: 1, fx: { dmgUp: 0.09, allStat: 24 },
  proc: { vs: 'any', act: 'extra', frac: 0.15, desc: '攻击处于异常状态（灼伤、中毒、出血、冰冻、眩晕、减速）的敌人时附加 15% 伤害。' }, desc: `帕丽丝家族代代相传的徽记。（${T1}辅助装备）` });
moveEpic('ep_stone_platani', { lvl: 60, tier: 2, noDrop: false, src: undefined, fx: { allStat: 36, hpPct: 0.05, dmgUp: 0.07 }, desc: `黄金巨人普拉塔尼的核心碎片，沉得要两只手才捧得住。（${T2}魔法石）` });
moveEpic('ep_stone_grelin', { lvl: 60, tier: 2, fx: { light: 36, dmgUp: 0.08 }, desc: `极光龙格雷林的眼泪，凝成了永不融化的晶石。（${T2}魔法石「龙之泪」）` });
moveEpic('ep_stone_herik', { lvl: 60, tier: 2, fx: { fire: 36, dmgUp: 0.08 }, desc: `火龙赫瑞克的眼泪，握在手里会发烫。（${T2}魔法石「龙之泪」）` });
moveEpic('ep_stone_aqui', { lvl: 60, tier: 2, fx: { ice: 36, dmgUp: 0.08 }, desc: `冰龙阿奎利斯的眼泪，里面封着一片雪原。（${T2}魔法石「龙之泪」）` });
moveEpic('ep_stone_merkel', { lvl: 60, tier: 2, fx: { dark: 36, dmgUp: 0.08 }, desc: `亡魂默克尔的眼泪，夜里会发出幽光。（${T2}魔法石「龙之泪」）` });

/* ---------------- 官方新增：Lv60 辅助装备（T1 ×2、T3 ×4）+ Lv65 魔法石（T2 ×2）---------------- */
B3('ep_sup_orca', { slot: 'support', lvl: 60, tier: 1, name: '奥尔卡的头盔', fx: { dmgUp: 0.08, allStat: 24, hardness: 30 },
  proc: { on: 'hurt', chance: 0.15, cd: 10, act: 'shield', amt: 0.1, dur: 5, name: '奥尔卡的守护', desc: '被击时 15% 几率获得吸收 10% HP 上限伤害的护盾（5 秒，冷却 10 秒）。' },
  desc: `老水手奥尔卡戴了一辈子的铁盔，被海浪砸出了好几个坑。（${T1}辅助装备）` });
B3('ep_sup_bwanga', { slot: 'support', lvl: 60, tier: 1, name: '布万加的族长臂章', fx: { dmgUp: 0.09, allStat: 22, aspd: 0.04 },
  proc: { on: 'kill', act: 'buff', buff: { atk: 0.04 }, dur: 8, stack: 3, key: 'bwanga', name: '族长的战吼', col: '#ffb24a', desc: '击杀敌人时攻击力 +4%，最多叠加 3 层，持续 8 秒。' },
  desc: `雪山部族的族长布万加佩戴的臂章，只有打赢了族长的人才有资格戴上。（${T1}辅助装备）` });
B3('ep_sup_owen', { slot: 'support', lvl: 60, tier: 3, name: '欧文的诅咒', fx: { dmgUp: 0.11, dark: 34, critDmg: 0.1 },
  proc: { chance: 0.08, cd: 3, act: 'debuff', taken: 0.12, dur: 6, key: 'owen', vis: 'dark', col: '#9a4aff', name: '欧文的诅咒', desc: '攻击时 8% 几率诅咒敌人：6 秒内受到的伤害 +12%（冷却 3 秒）。' },
  desc: `被诅咒的骑士欧文的护手，诅咒没能杀死他，反倒成了他的武器。（${T3}辅助装备）` });
B3('ep_sup_xinzang', { slot: 'support', lvl: 60, tier: 3, name: '信奘的药丸', fx: { dmgUp: 0.11, allStat: 30, hpPct: 0.05 },
  proc: [{ on: 'lowhp', cd: 50, act: 'heal', hp: 0.25, name: '信奘的药丸', txtCol: '#8aff9a', desc: 'HP 低于 30% 时吞下药丸：恢复 25% HP，并在 8 秒内伤害 +20%（冷却 50 秒）。' }, { on: 'lowhp', cd: 50, act: 'buff', buff: { dmg: 0.2 }, dur: 8, key: 'xinzang', name: '药力', col: '#8aff9a' }],
  desc: `云游僧人信奘炼的药丸，一颗能顶三天的饭。（${T3}辅助装备）` });
B3('ep_sup_goldmedal', { slot: 'support', lvl: 60, tier: 3, name: '龙之金章', fx: { dmgUp: 0.11, elemAll: 18, crit: 0.03, mcrit: 0.03 },
  proc: { on: 'crit', chance: 0.08, cd: 1.5, act: 'strike', mul: 2.4, aoe: 110, elem: 'fire', vis: 'fire', col: '#ffc83a', name: '金龙咆哮', desc: '暴击时 8% 几率召出金龙咆哮（周围 240% 火属性伤害，冷却 1.5 秒）。' },
  desc: `屠龙者的勋章，纯金打造，龙鳞纹路一片一片都看得清。（${T3}辅助装备）` });
B3('ep_sup_heaven', { slot: 'support', lvl: 60, tier: 3, name: '天之印记', fx: { dmgUp: 0.11, light: 28, cdr: 0.04 },
  proc: { on: 'skill', chance: 0.12, cd: 2, act: 'strike', mul: 2.5, aoe: 120, elem: 'light', vis: 'holy', name: '天之印记', desc: '施放技能时 12% 几率降下天之印记（周围 250% 光属性伤害，冷却 2 秒）。' },
  desc: `天界使者留在人间的印记，在手背上烫出一枚发光的纹章。（${T3}辅助装备）` });
B3('ep_stone_elftear', { slot: 'stone', lvl: 60, tier: 2, name: '融合之高级精灵的眼泪', fx: { elemAll: 26, dmgUp: 0.07, mpRegen: 0.3 },
  desc: `光、火、冰、暗四位高级精灵的眼泪融在一起，颜色一直在变。（${T2}魔法石）` });
B3('ep_stone_xinzang', { slot: 'stone', lvl: 60, tier: 2, name: '信奘的宝珠', fx: { allStat: 34, dmgUp: 0.07, cdr: 0.03 },
  desc: `信奘念了九百九十九遍经的宝珠，据说能让人心静如水。（${T2}魔法石）` });

/* ---------------- 原创补缺：1~30（每个等级段每个部位都有史诗）---------------- */
B3('ep_brace_thunder', { slot: 'bracelet', lvl: 8, name: '落雷铜手镯', fx: { light: 10, aspd: 0.03, cspd: 0.03 },
  proc: { chance: 0.05, cd: 2, act: 'strike', mul: 0.8, elem: 'light', vis: 'bolt', name: '落雷', desc: '攻击时 5% 几率引下落雷（80% 光属性伤害，冷却 2 秒）。' },
  desc: '凯诺的落雷劈中过的铜手镯，从那以后自己也会引雷。（本作原创）' });
B3('ep_ring_catseye', { slot: 'ring', lvl: 9, name: '毒猫王的猫眼戒指', fx: { crit: 0.03, mcrit: 0.03, dark: 8 },
  proc: { chance: 0.05, cd: 2, act: 'status', status: 'poison', dur: 3, dps: 0.1, name: '猫爪毒', desc: '攻击时 5% 几率使敌人中毒 3 秒（冷却 2 秒）。' },
  desc: '毒猫王额头上的那颗猫眼石，夜里会眯起来。（本作原创）' });
B3('ep_neck_dragonscale', { slot: 'neck', lvl: 15, name: '龙人鳞片坠', fx: { fire: 14, hpPct: 0.04, dmgUp: 0.03 }, desc: '龙人之塔的鲁卡斯脱下的鳞片，串成吊坠还带着体温。（本作原创）' });
B3('ep_stone_puppet', { slot: 'stone', lvl: 16, name: '人偶的玻璃眼珠', fx: { elemAll: 14, cdr: 0.03 }, desc: '人偶之王道格里最喜欢的一对玻璃眼珠之一，另一颗至今下落不明。（本作原创）' });
B3('ep_sup_scripture', { slot: 'support', lvl: 24, name: 'GBL教的圣典残页', fx: { allStat: 18, dmgUp: 0.04, mpRegen: 0.3 }, desc: '神殿里抢救出来的半页圣典，字迹还在慢慢变化。（本作原创）' });

/* ---------------- 原创补缺：31~40（暗精灵、万年雪山）---------------- */
B3('ep_brace_spider', { slot: 'bracelet', lvl: 33, name: '蛛后的丝缚手环', fx: { dmgUp: 0.06, dark: 18, aspd: 0.03 },
  proc: { chance: 0.06, cd: 2, act: 'status', status: 'slow', dur: 2, name: '蛛丝缠绕', desc: '攻击时 6% 几率用蛛丝缠住敌人（减速 2 秒，冷却 2 秒）。' },
  desc: '艾克洛索吐的丝一圈一圈缠成的手环，刀砍不断。（本作原创）' });
B3('ep_ring_goliath', { slot: 'ring', lvl: 35, name: '熔岩巨人的指节环', fx: { fire: 24, dmgUp: 0.06, crit: 0.02, mcrit: 0.02 }, desc: '歌利亚指节上套着的铁环，被熔岩泡得通红，现在也没凉。（本作原创）' });
B3('ep_sup_anvil', { slot: 'support', lvl: 36, name: '锤王的铁砧徽', fx: { dmgUp: 0.07, allStat: 20, hardness: 20 },
  proc: { chance: 0.04, cd: 2, act: 'strike', mul: 1.5, aoe: 90, vis: 'nova', col: '#ffb070', name: '锻打！', desc: '攻击时 4% 几率砸出一记锻打（周围 150% 伤害，冷却 2 秒）。' },
  desc: '锤王波罗丁用了一辈子的铁砧上敲下来的一块，还留着锤痕。（本作原创）' });
B3('ep_stone_yeti', { slot: 'stone', lvl: 39, name: '雪怪的冰核', fx: { elemAll: 20, dmgUp: 0.06, hpPct: 0.04 }, desc: '白色废墟的雪怪塞斯奇体内结出的冰核，冷得发烫。（本作原创）' });
// 白狼猎团（Lv40，万年雪山普通掉落）：【狼群流】暴击时狼牙追咬，击杀越多越快
acc3('set_ac_whitewolf', '白狼猎团', 40, ['白狼牙项链', '白狼皮护腕', '狼王的银戒'], {
  2: { st: { crit: 0.04, mcrit: 0.04, mspd: 0.05 }, desc: '暴击率 +4%，移动速度 +5%' },
  3: { st: { dmgUp: 0.12, critDmg: 0.08 }, desc: '【狼群流】伤害增加 12%，暴击伤害 +8%；暴击时 10% 几率狼牙追咬（100% 伤害）；每击杀 1 个敌人攻击 / 施放 / 移动速度 +2%，最多 5 层，持续 6 秒',
    proc: [{ on: 'crit', chance: 0.1, cd: 0.8, act: 'strike', mul: 1, vis: 'slash', col: '#dff4ff', name: '狼牙' }, { on: 'kill', act: 'buff', buff: { aspd: 0.02, cspd: 0.02, mspd: 0.02 }, dur: 6, stack: 5, key: 'whitewolf', name: '狼群', col: '#cfe8ff' }] } },
  { desc: '山脊上的猎人们代代相传的信物：白狼的牙、白狼的皮、狼王的戒指。（本作原创）' });

/* ---------------- 原创补缺：41~50（冰雪宫殿、比尔马克、哈穆林、根特）---------------- */
B3('ep_neck_rose', { slot: 'neck', lvl: 42, name: '冰雪女王的泪坠', fx: { ice: 26, dmgUp: 0.07, mpRegen: 0.3 },
  proc: { chance: 0.03, cd: 4, act: 'status', status: 'freeze', dur: 1.2, vis: 'ice', name: '冰封', desc: '攻击时 3% 几率冰冻敌人 1.2 秒（冷却 4 秒）。' },
  desc: '洛丝唯一一次流泪时落下的冰晶，被做成了吊坠。（本作原创）' });
B3('ep_brace_ratbell', { slot: 'bracelet', lvl: 47, name: '哈穆林的鼠铃手镯', fx: { dmgUp: 0.07, dark: 24, aspd: 0.04 },
  proc: { chance: 0.05, cd: 2, act: 'status', status: 'poison', dur: 4, dps: 0.15, name: '鼠疫', desc: '攻击时 5% 几率让鼠群啃咬敌人（中毒 4 秒，冷却 2 秒）。' },
  desc: '一串小铃铛，一摇就能听见墙里窸窸窣窣的声音。（本作原创）' });
B3('ep_stone_ember', { slot: 'stone', lvl: 49, name: '纵火犯的火种', fx: { fire: 32, dmgUp: 0.07 },
  proc: { chance: 0.05, cd: 2, act: 'status', status: 'burn', dur: 3, dps: 0.15, vis: 'fire', name: '点燃', desc: '攻击时 5% 几率点燃敌人（灼伤 3 秒，冷却 2 秒）。' },
  desc: '本汀克装在玻璃瓶里的火种，他说这是根特烧不完的原因。（本作原创）' });
// 帝国试验体（Lv45，比尔马克 / 堕落的盗贼普通掉落）：【过载流】每放一个技能伤害 +2%，叠满 5 层
acc3('set_ac_imperial', '帝国试验体', 45, ['试验体的识别牌', '帝国抑制环', '过载核心指环'], {
  2: { st: { aspd: 0.05, cspd: 0.05, elemAll: 12 }, desc: '攻击 / 施放速度 +5%，所有属性强化 +12' },
  3: { st: { dmgUp: 0.12 }, desc: '【过载流】伤害增加 12%；每施放 1 个技能伤害 +2%，最多 5 层，持续 6 秒',
    proc: { on: 'skill', act: 'buff', buff: { dmg: 0.02 }, dur: 6, stack: 5, key: 'imperial', name: '过载', col: '#7affe0' } } },
  { desc: '比尔马克帝国试验场的试验体身上拆下来的东西，抑制环一摘，力量就停不下来。（本作原创）' });
// 根特守备队（Lv48，根特外围 / 东门普通掉落）：【坚守流】标记集火 + 残血护盾
acc3('set_ac_gentguard', '根特守备队', 48, ['守备队的银哨', '守备队臂环', '守备队长的印戒'], {
  2: { st: { hpPct: 0.06, dmgReduce: 0.04, str: 40, int: 40 }, desc: 'HP 上限 +6%，受到的伤害 -4%，力量 / 智力 +40' },
  3: { st: { dmgUp: 0.13, hardness: 30 }, desc: '【坚守流】伤害增加 13%，硬直 +30；攻击时 7% 几率标记敌人（5 秒内受到的伤害 +10%）；HP 低于 30% 时获得吸收 20% HP 上限伤害的护盾（冷却 45 秒）',
    proc: [{ chance: 0.07, cd: 2, act: 'debuff', taken: 0.1, dur: 5, key: 'gentmark', vis: 'holy', col: '#ffe08a', name: '集火标记' }, { on: 'lowhp', cd: 45, act: 'shield', amt: 0.2, dur: 6, name: '守备队的誓言' }] } },
  { desc: '根特陷落前最后一支守备队的装备。银哨一响，全城的弓都对准同一个方向。（本作原创）' });

/* ---------------- 原创补缺：51~60（海上列车、时空之门）---------------- */
B3('ep_neck_gaslamp', { slot: 'neck', lvl: 54, name: '雾都的煤气灯吊坠', fx: { dmgUp: 0.08, fire: 25, cdr: 0.03 }, desc: '赫伊斯街角的煤气灯里取出来的灯芯，雾再大也照得见路。（本作原创）' });
B3('ep_brace_quicksand', { slot: 'bracelet', lvl: 56, name: '沙影的流沙手镯', fx: { dmgUp: 0.07, dark: 20, aspd: 0.04, cspd: 0.04 },
  proc: { chance: 0.06, cd: 2, act: 'status', status: 'slow', dur: 2, name: '流沙', desc: '攻击时 6% 几率让敌人陷进流沙（减速 2 秒，冷却 2 秒）。' },
  desc: '贝利特的手镯里装着一小把永远流不完的沙。（本作原创）' });
B3('ep_ring_cerberus', { slot: 'ring', lvl: 57, name: '三头犬的项圈指环', fx: { dmgUp: 0.07, fire: 20 },
  proc: { on: 'crit', chance: 0.08, cd: 1, act: 'strike', mul: 1.6, elem: 'fire', vis: 'fire', name: '地狱三咬', desc: '暴击时 8% 几率让三头犬扑咬（160% 火属性伤害，冷却 1 秒）。' },
  desc: '地狱三头犬项圈上的一节铁环，缩小成了戒指还在发烫。（本作原创）' });

/* ---------------- 领主神器（粉色，只在那个领主身上掉，2%）---------------- */
defineNamed('nm_neck_spiz', { slot: 'neck', lvl: 34, lord: 'spiz', name: '邪龙斯皮兹的逆鳞坠', fx: { dark: 16, dmgUp: 0.03 },
  proc: { chance: 0.04, cd: 2, act: 'strike', mul: 1.3, elem: 'dark', vis: 'dark', name: '邪龙吐息', desc: '攻击时 4% 几率喷出邪龙吐息（130% 暗属性伤害，冷却 2 秒）。' },
  desc: '邪龙斯皮兹喉咙下那片倒着长的鳞。（本作原创领主神器：暗精灵墓地 · 邪龙斯皮兹）' });
defineNamed('nm_sup_headless', { slot: 'support', lvl: 37, lord: 'headlessKnight', name: '无头骑士的断缰', fx: { allStat: 16, mspd: 0.05, dmgUp: 0.03 },
  proc: { on: 'kill', chance: 0.12, cd: 8, act: 'buff', buff: { mspd: 0.1, aspd: 0.05 }, dur: 5, key: 'headless', name: '幽灵战马', col: '#9ae8ff', desc: '击杀敌人时 12% 几率唤来幽灵战马：5 秒内移动速度 +10%、攻击速度 +5%（冷却 8 秒）。' },
  desc: '无头骑士的战马跑丢以后，只剩下这截缰绳。（本作原创领主神器：暗黑城入口 · 无头骑士）' });
defineNamed('nm_brace_hanik', { slot: 'bracelet', lvl: 45, lord: 'mechKing', name: '哈尼克之牙', fx: { crit: 0.03, mcrit: 0.03, dmgUp: 0.03 },
  proc: [{ chance: 0.08, cd: 1, act: 'status', status: 'bleed', dur: 4, dps: 0.15, name: '撕裂', desc: '攻击时 8% 几率使敌人出血 4 秒；攻击出血的敌人时附加 8% 伤害。' }, { vs: 'bleed', act: 'extra', frac: 0.08 }],
  desc: '牛头统帅哈尼克被打落的獠牙，磨成了手镯，狂战士们最爱它。（官方 60 版比尔马克帝国试验场的领主神器）' });
defineNamed('nm_ring_ivan', { slot: 'ring', lvl: 45, lord: 'mechKing', name: '疯狂伊凡的避火装置', fx: { fire: 18, rfire: 25, dmgUp: 0.02 },
  proc: { on: 'hurt', chance: 0.2, cd: 5, act: 'strike', mul: 1.2, aoe: 90, elem: 'fire', vis: 'fire', name: '反向喷火', desc: '被击时 20% 几率从避火装置里反喷火焰（周围 120% 火属性伤害，冷却 5 秒）。' },
  desc: '疯狂伊凡给自己做的避火装置，结果它更擅长喷火。（官方 60 版比尔马克帝国试验场的领主神器）' });
defineNamed('nm_neck_wail', { slot: 'neck', lvl: 50, lord: 'bugKing', name: '窒息的悲鸣项链', fx: { dmgUp: 0.06, hit: 0.02 },
  proc: { chance: 0.03, cd: 4, act: 'status', status: 'stun', dur: 0.6, name: '窒息', desc: '攻击时 3% 几率让敌人窒息（眩晕 0.6 秒，冷却 4 秒）。' },
  desc: '悲鸣洞穴深处的哭声凝成的项链，戴上以后耳边总有人在叹气。（官方悲鸣洞穴的神器首饰「窒息的悲鸣」）' });
defineNamed('nm_sup_skelknight', { slot: 'support', lvl: 56, lord: 'skelKnight', name: '骷髅骑士拳套', fx: { allStat: 22, atkPct: 0.04 },
  proc: { on: 'kill', chance: 0.15, cd: 6, act: 'buff', buff: { aspd: 0.05, cspd: 0.05 }, dur: 6, key: 'skelknight', name: '骷髅之怒', col: '#e0e0c0', desc: '击杀敌人时 15% 几率：6 秒内攻击 / 施放速度 +5%（冷却 6 秒）。' },
  desc: '瘟疫之源的骷髅骑士戴着的铁拳套，骨头早就散了，拳套还攥得紧紧的。（官方 80 版阿登高地的领主神器）' });
monDrop('spiz', [['nm_neck_spiz', 0.02]], { dungeons: ['darkelf_tomb'] });
monDrop('headlessKnight', [['nm_sup_headless', 0.02]], { dungeons: ['darkcity_gate'] });
monDrop('mechKing', [['nm_brace_hanik', 0.02], ['nm_ring_ivan', 0.02]], { dungeons: ['bilmark'] });
monDrop('bugKing', [['nm_neck_wail', 0.02]], { dungeons: ['wailing_cave'] });
monDrop('skelKnight', [['nm_sup_skelknight', 0.02]], { dungeons: ['plague_source'] });

/* ---------------- 掉落 / 深渊归属 ---------------- */
const pieces = id => SETS[id].pieces;
gearDrop('thunder_ruins', [['ep_brace_thunder', 0.01]]);
gearDrop('venom_ruins', [['ep_ring_catseye', 0.01]]);
gearDrop('dragon_tower', [['ep_neck_dragonscale', 0.01]]);
gearDrop('puppet_hall', [['ep_stone_puppet', 0.01]]);
gearDrop('temple_outskirts', [['ep_sup_scripture', 0.01]]);
gearDrop('spider_cave', [['ep_brace_spider', 0.012]]);
gearDrop('lava_cave', [['ep_ring_goliath', 0.012]]);
gearDrop('king_ruins', [['ep_sup_anvil', 0.012]]);
gearDrop('white_ruins', [['ep_stone_yeti', 0.012]]);
for (const dg of ['ridge', 'white_ruins', 'bwanga_dojo']) gearDrop(dg, pieces('set_ac_whitewolf').map(k => [k, 0.008]));
gearDrop('ice_palace', [['ep_neck_rose', 0.012]]);
for (const dg of ['bilmark', 'fallen_bandits']) gearDrop(dg, pieces('set_ac_imperial').map(k => [k, 0.008]));
gearDrop('hamelin', [['ep_brace_ratbell', 0.012]]);
for (const dg of ['gent_outskirts', 'gent_east']) gearDrop(dg, pieces('set_ac_gentguard').map(k => [k, 0.008]));
gearDrop('gent_outskirts', [['ep_stone_ember', 0.012]]);
gearDrop('heis', [['ep_neck_gaslamp', 0.01]]);
gearDrop('kartel_origin', [['ep_brace_quicksand', 0.01]]);
gearDrop('secret_zone', [['ep_ring_cerberus', 0.01]]);
// Lv60 T1：时空之门后段 + 希洛克的三扇门
for (const dg of ['secret_zone', 'old_wail', 'old_winter', 'law_gate', 'wit_gate', 'pain_gate']) gearDrop(dg, [...pieces('set_wargod').map(k => [k, 0.006]), ['ep_sup_michel', 0.006], ['ep_sup_paris', 0.006], ['ep_sup_orca', 0.006], ['ep_sup_bwanga', 0.006]]);
// Lv60 T2 魔法石：深渊专属（龙之泪 → 海上列车深渊；普拉塔尼 / 高级精灵 → 时空之门深渊；信奘的宝珠 → 魔界深渊）+ 攻坚 1%
abyssClaim('train', ['ep_stone_grelin', 'ep_stone_herik', 'ep_stone_aqui', 'ep_stone_merkel']);
abyssClaim('timegate', ['ep_stone_platani', 'ep_stone_elftear']);
abyssClaim('siroco', ['ep_stone_xinzang']);
// Lv60 T3：魔界深渊专属 + 攻坚 0.3%
abyssClaim('siroco', ['set_timelord', 'ep_sup_owen', 'ep_sup_xinzang', 'ep_sup_goldmedal', 'ep_sup_heaven']);
for (const dg of ['iris_raid', 'siroco_coffin']) gearDrop(dg, [
  ...['ep_stone_grelin', 'ep_stone_herik', 'ep_stone_aqui', 'ep_stone_merkel', 'ep_stone_platani', 'ep_stone_elftear', 'ep_stone_xinzang'].map(k => [k, 0.01]),
  ...[...pieces('set_timelord'), 'ep_sup_owen', 'ep_sup_xinzang', 'ep_sup_goldmedal', 'ep_sup_heaven'].map(k => [k, 0.003])]);
}
