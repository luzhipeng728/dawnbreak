/* =====================================================================
   装备 2.0 · B1a 鬼剑士武器（短剑 / 太刀 / 钝器 / 巨剑 / 光剑）
   只写本块的物品；搬家 / 继承 / 领主神器 / 掉落 / 深渊归属一律用 gear60_api.js 的接口（用法见 docs/GEAR_PLAN_60.md §6）。
   注释只放在行尾或单独一行（一行中间的 // 会吞掉后面的字段）。
   数值按 GEAR_PLAN_60.md §2.3：Lv34 .09 / Lv38 深渊 .12 / Lv45 .10 / Lv50 .11 / Lv55 .115~.12（阿波菲斯 .13）/ Lv60 T1 .12、T2 .13、T3 .15，
   再按实测校准（「史诗武器 / 同级稀有武器」综合分倍率，Lv30 最好的是 1.44；Lv34 / 38 在 power 测试的 Lv35 / 40 上量）：Lv35 ≈1.40、Lv40 / 45 / 50 ≈1.43、Lv55 ≈1.45（阿波菲斯 1.53 最高）、
   Lv60 T1 ≈1.45 < T2 ≈1.48 < T3 ≈1.52。随机基础属性太好 / 太差的用 seed 重抽（'<key>#n'）；光剑自带高攻速、属性攻击（atkElem）很值钱，这两类 fx 低一档；平加力量 / 智力也很值钱，少给。
   外观：art/tools/wdesign_sword.py；领主神器只有图标（art/tools/gear_icons_pink60_sword.py），拿在手里是 <类型>_r3
   ===================================================================== */
{
const W = (key, def) => defineEpic(key, { slot: 'weapon', ...def });
const INH = (old, key, name, desc) => inheritEpic(old, key, { name, desc: `${desc}（本作原创，继承自「${ITEMS[old].name}」）` });

/* ---------------- 1. 继承装备（Lv1~30：接替搬走的官方史诗，数值 / 特效 / 掉落 / 深渊归属原样，只换名字外观）---------------- */
// 先登记继承（快照是搬家前的定义），再搬家；十字斩刀-者 在 3. 里改正名字为「十字斩刀-闪」
INH('ep_shortsword', 'ep_ss_pearl', '幻光剑-希尔维娅', '珍珠母贝磨成的细剑，换个角度就换一种颜色，敌人总是看错它的位置。');
INH('ep_ss_gsd', 'ep_ss_hourglass', '流沙短剑-刻时', '剑身里的金沙永远在流动，据说握着它的人能多争取一点点时间。');
INH('ep_ss_kanya', 'ep_ss_violet', '紫电剑-岚', '紫色的雷光顺着剑脊奔走，挥动时空气里满是焦味。');
INH('ep_ss_fate', 'ep_ss_starvow', '星轨之誓', '剑上刻着一整片星空，每一条星轨都是一句誓言。');
INH('ep_ss_shura', 'ep_ss_cobra', '赤鳞蛇牙', '蛇王褪下的毒牙打成的短剑，剑鞘一打开就能听见嘶嘶声。');
INH('ep_katana', 'ep_kt_sakura', '樱吹雪', '刀身上落满了樱花，挥刀时花瓣像雪一样散开。');
INH('ep_kt_slaughter', 'ep_kt_redflame', '赤焰断罪刀', '刀纹像一道烧红的火焰，被它斩中的伤口很难愈合。');
INH('ep_katana2', 'ep_kt_falcon', '裂空斩刀-隼', '快得像俯冲的猎隼。攻击时有 3% 几率削减敌人 30% 的当前 HP（对领主无效）。');
INH('ep_kt_andra', 'ep_kt_damascus', '无铭-百炼', '一位无名刀匠百炼而成的太刀，没有刻名字，只刻了一圈金色的纹。');
INH('ep_kt_ninedragon', 'ep_kt_phoenix', '凤翎护魂刀', '凤凰的尾羽化成刀纹，守护持刀之人的魂魄。');
INH('ep_club', 'ep_cb_darkmoon', '暗月星锤', '锤头是一弯暗月托着一颗星，砸下去的时候星光会一闪。');
INH('ep_cb_devour', 'ep_cb_wolf', '冥狼噬魂锤', '冥界狼王的头颅铸成的锤子，眼睛里的紫光从来没有熄灭过。');
INH('ep_cb_ghost', 'ep_cb_urn', '封魂坛锤', '坛子里封着上百个游魂，每砸一下，裂缝里的魂光就亮一下。');
INH('ep_cb_soulmate', 'ep_cb_bell', '雷鸣钟锤', '古寺的铜钟改成的战锤，钟声一响，雷就跟着落下来。');
INH('ep_cb_kirin', 'ep_cb_whitetiger', '白虎震天锤', '白虎一啸，天雷应声。');
INH('ep_cb_heart', 'ep_cb_anvil', '裁决之砧', '铁匠之神的砧台，敌人越虚弱，落下的裁决越重。');
INH('ep_greatsword', 'ep_gs_glacier', '冰川之怒', '从万年冰川里凿出来的巨剑，砍下去连地面都会结霜。');
INH('ep_gs_conqueror', 'ep_gs_cleaver', '开山巨刃', '一块门板那么宽的巨刃，据说是开山修路时用的。');
INH('ep_gs_evildragon', 'ep_gs_bonedragon', '骨龙之脊', '骨龙的脊椎一节节熔在一起，杀得越多，龙骨越烫。');
INH('ep_gs_apophis', 'ep_gs_ruby', '赤晶魔剑-奈落', '从奈落深处长出来的血色晶簇，被它吸走的灵魂会让晶体更红。');
INH('ep_gs_guardian', 'ep_gs_lionheart', '狮心守望者', '狮心骑士团团长的佩剑，从不先出手。');
INH('ep_ls_sun', 'ep_ls_dawn', '晨曦光剑-破晓', '第一缕晨光凝成的光刃，颜色像天刚亮时的云。');
INH('ep_ls_breaker', 'ep_ls_prism', '棱镜光剑-折光者', '棱镜把光拆成七种颜色，也能把幻术拆得一干二净。');
INH('ep_ls_millennium', 'ep_ls_aurora', '极光之辉', '极地夜空里的极光被收进了剑柄。');
INH('ep_ls_elegy', 'ep_ls_requiem', '安魂夜曲', '剑柄是一把小提琴的琴颈，挥动时会拉出一段安魂曲。');

/* ---------------- 2. Lv1~10 每类一件（P2；太刀已有「樱吹雪」Lv10）---------------- */
W('ep_ss_greenleaf', { wtype: 'shortsword', lvl: 5, name: '翠叶短剑', st: { int: 8 }, fx: { dmgUp: 0.04, crit: 0.02, mcrit: 0.02 },
  proc: { chance: 0.06, act: 'strike', mul: 1.0, vis: 'petal', col: '#9be07a', name: '叶刃！', desc: '攻击时 6% 几率卷起叶刃（100% 伤害）。' },
  desc: '洛兰的精灵用一片永不凋零的叶子磨成的短剑。（本作原创）' });
W('ep_ls_firefly', { wtype: 'lightsaber', lvl: 6, name: '萤火光剑', fx: { light: 10, aspd: 0.03, dmgUp: 0.03 },
  proc: { chance: 0.07, act: 'strike', mul: 0.9, elem: 'light', vis: 'holy', col: '#ffe28a', name: '萤火！', desc: '攻击时 7% 几率放出萤火（90% 光属性伤害）。' },
  desc: '剑柄是一盏小灯笼，夏夜的萤火虫会自己飞进去。（本作原创）' });
W('ep_cb_oakfang', { wtype: 'club', lvl: 7, name: '橡木狼牙棒-林卫', fx: { stagger: 25, dmgUp: 0.04, hpPct: 0.03 },
  proc: { chance: 0.05, act: 'status', status: 'stun', dur: 0.8, name: '当头一棒', desc: '攻击时 5% 几率打晕敌人 0.8 秒。' },
  desc: '洛兰守林人的狼牙棒，上面挂着的兽牙都是它的战绩。（本作原创）' });
W('ep_gs_oak', { wtype: 'greatsword', lvl: 8, name: '巨木之剑-林心', fx: { dmgUp: 0.05, hardness: 20, hpPct: 0.03 },
  proc: { on: 'hurt', chance: 0.15, cd: 6, act: 'shield', amt: 0.05, dur: 4, name: '林心护体', desc: '被击时 15% 几率得到 5% HP 上限的护盾，持续 4 秒（冷却 6 秒）。' },
  desc: '千年古树的树心削成的巨剑，比铁还硬。（本作原创）' });

/* ---------------- 3. 官方史诗回到官方等级（D1）---------------- */
// 60 版 Lv50
moveEpic('ep_shortsword', { lvl: 50, st: { int: 55 }, fx: { dmgUp: 0.11, crit: 0.05, mcrit: 0.05, critDmg: 0.12 },
  proc: { on: 'crit', chance: 0.12, cd: 1.5, act: 'strike', mul: 1.8, vis: 'slash', col: '#bfe8ff', name: '无影斩！', desc: '暴击时 12% 几率挥出看不见的一剑（180% 伤害，冷却 1.5 秒）。' },
  desc: '传说中的名剑，剑身薄得几乎看不见。（官方 60 版 Lv50 史诗短剑）' });
moveEpic('ep_ss_gsd', { lvl: 50, st: { int: 55 }, fx: { dmgUp: 0.11, cdr: 0.06 },
  proc: { on: 'skill', chance: 0.12, cd: 3, act: 'strike', mul: 1.9, aoe: 150, vis: 'nova', col: '#7fe0ff', name: '波动爆发！', desc: '施放技能时 12% 几率引发波动爆发：对周围敌人造成 190% 伤害（冷却 3 秒）。' },
  desc: '剑圣 G.S.D 亲手打造的波动之刃，挥动时空气会一圈圈荡开。（官方 60 版 Lv50 史诗短剑）' });
moveEpic('ep_katana', { lvl: 50, fx: { dmgUp: 0.11, critDmg: 0.16, crit: 0.05, mcrit: 0.05 },
  proc: { on: 'crit', chance: 0.1, cd: 2, act: 'strike', mul: 1.8, vis: 'moon', name: '月光斩！', desc: '暴击时 10% 几率斩出一道月光（180% 伤害，冷却 2 秒）。' },
  desc: '刀身映着月光，挥动时留下银色的残影。（官方 60 版 Lv50 史诗太刀）' });
moveEpic('ep_cb_devour', { lvl: 50, fx: { dmgUp: 0.11, stagger: 50, critDmg: 0.13, dark: 30 },
  proc: { chance: 0.06, act: 'strike', mul: 1.8, elem: 'dark', vis: 'dark', name: '邪光斩！', desc: '攻击时 6% 几率打出邪光斩（180% 暗属性伤害）。' },
  desc: '吞食灵魂的巨槌，越打越重。（官方 60 版 Lv50 史诗钝器）' });
moveEpic('ep_cb_ghost', { lvl: 50, seed: 'ep_cb_ghost#8', fx: { dmgUp: 0.11, stagger: 50, dark: 30, hpPct: 0.07 },
  proc: [{ chance: 0.05, cd: 1, act: 'strike', mul: 1.7, elem: 'dark', vis: 'dark', name: '恶鬼啃噬！', desc: '攻击时 5% 几率让恶鬼咬上一口（170% 暗属性伤害），' },
    { on: 'kill', chance: 0.3, act: 'heal', hp: 0.03, name: '噬魂', desc: '击杀敌人时 30% 几率吞噬灵魂，恢复 3% HP。' }],
  desc: '槌头是一只恶鬼的头骨，据说夜里还会咬牙。（官方 60 版 Lv50 史诗钝器）' });
moveEpic('ep_greatsword', { lvl: 50, st: { str: 50 }, fx: { dmgUp: 0.11, hardness: 50, fire: 30 },
  proc: { chance: 0.05, cd: 1, act: 'strike', mul: 1.9, aoe: 150, elem: 'fire', vis: 'fire', name: '狂龙咆哮！', desc: '攻击时 5% 几率放出龙啸：对周围敌人造成 190% 火属性伤害。' },
  desc: '狂龙的怒吼封在剑里，挥动时会发出龙啸。（官方 60 版 Lv50 史诗巨剑）' });
moveEpic('ep_gs_conqueror', { lvl: 50, st: { str: 50 }, fx: { dmgUp: 0.11, stagger: 40, mspd: 0.05, critDmg: 0.12 },
  proc: { on: 'kill', chance: 0.3, cd: 8, act: 'buff', buff: { aspd: 0.12, mspd: 0.12, dmg: 0.06 }, dur: 6, key: 'conqueror', name: '征服者之翼', col: '#ffd070', desc: '击杀敌人时 30% 几率展开征服者之翼：6 秒内攻击 / 移动速度 +12%、伤害 +6%（冷却 8 秒）。' },
  desc: '剑身像一只收拢的巨翼，挥下时羽刃层层展开。（官方 60 版 Lv50 史诗巨剑）' });
moveEpic('ep_ls_sun', { lvl: 50, seed: 'ep_ls_sun#3', fx: { dmgUp: 0.11, light: 30, aspd: 0.05 },
  proc: { chance: 0.08, act: 'strike', mul: 1.7, elem: 'light', vis: 'holy', name: '光炎！', desc: '攻击时 8% 几率发射光炎（170% 光属性伤害）。' },
  desc: '烈日的裁决，从剑尖倾泻而下。（官方 60 版 Lv50 史诗光剑）' });
moveEpic('ep_ls_breaker', { lvl: 50, fx: { dmgUp: 0.11, light: 30, aspd: 0.05, hit: 0.04 },
  proc: { chance: 0.07, act: 'debuff', taken: 0.12, dur: 5, name: '破幻', desc: '攻击时 7% 几率破除敌人的护体幻象：5 秒内受到的伤害 +12%。' },
  desc: '把光聚成一点，能刺穿一切幻术。（官方 60 版 Lv50 史诗光剑）' });
// 60 版 Lv55
moveEpic('ep_ss_kanya', { lvl: 55, fx: { dmgUp: 0.08, light: 28, atkElem: 'light' },
  proc: [{ chance: 0.045, act: 'strike', mul: 2.0, elem: 'light', vis: 'bolt', name: '落雷！', desc: '光属性攻击；攻击时 4.5% 几率召唤落雷（200% 伤害），' },
    { chance: 0.03, act: 'status', status: 'stun', dur: 1.2, name: '感电', desc: '3% 几率使敌人感电（眩晕 1.2 秒）。' }],
  desc: '剑身里封着一场永不停歇的雷暴。（官方 60 版 Lv55 史诗短剑）' });
moveEpic('ep_kt_slaughter', { lvl: 55, seed: 'ep_kt_slaughter#3', fx: { dmgUp: 0.115, crit: 0.05, mcrit: 0.05, critDmg: 0.12 },
  proc: [{ chance: 0.06, act: 'status', status: 'bleed', dur: 4, dps: 0.18, name: '出血', desc: '攻击时 6% 几率使敌人出血 4 秒，' }, { vs: 'bleed', act: 'extra', frac: 0.22, desc: '攻击出血中的敌人时附加 22% 伤害。' }],
  desc: '饮过无数鲜血的太刀，闻到血腥味就会发出嗡鸣。（官方 60 版 Lv55 史诗太刀）' });
moveEpic('ep_katana2', { lvl: 55, seed: 'ep_katana2#27', name: '十字斩刀-闪', fx: { dmgUp: 0.12, crit: 0.05, mcrit: 0.05, aspd: 0.05 },
  proc: [{ chance: 0.03, act: 'cut', cut: 0.3, boss: false, name: '十字斩！', desc: '攻击时 3% 几率削减敌人 30% 的当前 HP（对领主无效），' },
    { on: 'crit', chance: 0.1, cd: 1.5, act: 'strike', mul: 1.9, vis: 'slash', name: '闪！', desc: '暴击时 10% 几率追加一记十字闪（190% 伤害，冷却 1.5 秒）。' }],
  desc: '十字斩刀系列里最快的一把。（官方 60 版 Lv55 史诗太刀；原名写成了「十字斩刀-者」，已改正）' });
moveEpic('ep_club', { lvl: 55, seed: 'ep_club#22', fx: { dmgUp: 0.115, stagger: 60, dark: 32, critDmg: 0.12 },
  proc: { chance: 0.06, act: 'debuff', taken: 0.12, dur: 5, name: '邪目凝视', desc: '攻击时 6% 几率被邪眼盯上：敌人 5 秒内受到的伤害 +12%。' },
  desc: '钝器上镶着一只永不闭合的邪眼。（官方 60 版 Lv55 史诗钝器）' });
moveEpic('ep_cb_soulmate', { lvl: 55, seed: 'ep_cb_soulmate#24', fx: { dmgUp: 0.115, light: 32, aspd: 0.05 },
  proc: { on: 'crit', chance: 0.14, act: 'strike', mul: 2.0, elem: 'light', vis: 'bolt', name: '雷电！', desc: '暴击时 14% 几率追加一道雷电（200% 光属性伤害）。' },
  desc: '雷电的精灵住在锤头里，是个话痨。（官方 60 版 Lv55 史诗钝器）' });
moveEpic('ep_gs_evildragon', { lvl: 55, fx: { dmgUp: 0.115, stagger: 50, dark: 30 },
  proc: { on: 'kill', chance: 0.25, act: 'buff', buff: { atk: 0.04 }, dur: 10, stack: 5, key: 'evildragon', name: '邪龙之血', col: '#a03aff', desc: '击杀敌人时 25% 几率吸收邪龙之血：攻击力 +4%，最多 5 层，持续 10 秒。' },
  desc: '邪龙的心脏被铸进了剑柄。（官方 60 版 Lv55 史诗巨剑）' });
// 魔剑-阿波菲斯：按用户要求保持史诗，Lv55 最强巨剑；悲鸣洞穴 · 骷髅凯恩专属掉落 + 海上列车深渊（见 5.）
moveEpic('ep_gs_apophis', { lvl: 55, fx: { dmgUp: 0.13, dark: 16, atkElem: 'dark', hardness: 30 },
  proc: [{ chance: 0.06, cd: 1, act: 'strike', mul: 2.2, aoe: 150, elem: 'dark', vis: 'dark', col: '#c0304a', name: '魔剑吞噬！', desc: '暗属性攻击；攻击时 6% 几率释放魔剑之力：对周围敌人造成 220% 暗属性伤害，' },
    { on: 'kill', chance: 0.25, act: 'heal', hp: 0.02, desc: '击杀敌人时 25% 几率吞噬灵魂，恢复 2% HP。' }],
  desc: '被诅咒的魔剑，只有精神足够强大、不被反噬的人才能驾驭。（官方：悲鸣洞穴特产的 Lv55 神器巨剑，外观风靡多年；进化后为 Lv74 史诗「真·魔剑-阿波菲斯」。本作是史诗，骷髅凯恩专属掉落）' });
moveEpic('ep_ls_millennium', { lvl: 55, seed: 'ep_ls_millennium#1', fx: { dmgUp: 0.09, light: 28 },
  proc: { chance: 0.06, cd: 1, act: 'strike', mul: 1.9, elem: 'light', vis: 'holy', col: '#fff4c8', name: '千年之光！', desc: '攻击时 6% 几率降下千年之光（190% 光属性伤害）。' },
  desc: '一千年前点亮的光，至今没有熄灭。（官方 60 版 Lv55 史诗光剑）' });
// 70 版 Lv60（T1）
moveEpic('ep_ss_fate', { lvl: 60, tier: 1, st: { str: 65, int: 65 }, fx: { dmgUp: 0.12, critDmg: 0.17 },
  proc: { on: 'crit', chance: 0.1, cd: 2, act: 'strike', mul: 2.1, aoe: 120, vis: 'swords', name: '命运断裂！', desc: '暴击时 10% 几率斩断命运：对周围敌人造成 210% 伤害（冷却 2 秒）。' },
  desc: '据说握住它的人，能亲手斩断既定的命运。（官方 70 版 Lv60 史诗短剑）' });
moveEpic('ep_kt_andra', { lvl: 60, tier: 1, seed: 'ep_kt_andra#21', fx: { dmgUp: 0.12, crit: 0.05, mcrit: 0.05, aspd: 0.06 },
  proc: { chance: 0.05, cd: 20, act: 'buff', buff: { dmg: 0.2 }, dur: 20, key: 'andra', name: '终极太刀', col: '#9ad8ff', desc: '攻击时 5% 几率觉醒刀魂：20 秒内伤害 +20%（冷却 20 秒）。' },
  desc: '刀匠艾兰德拉毕生的最后一件作品。（官方 70 版 Lv60 史诗太刀）' });
moveEpic('ep_cb_kirin', { lvl: 60, tier: 1, fx: { dmgUp: 0.12, stagger: 60, light: 35, critDmg: 0.15 },
  proc: [{ chance: 0.06, act: 'status', status: 'stun', dur: 1.2, name: '感电', desc: '攻击时 6% 几率使敌人感电，' }, { vs: 'stun', act: 'extra', frac: 0.3, desc: '攻击感电（眩晕）中的敌人时附加 30% 伤害。' }],
  desc: '麒麟之怒化作雷霆，劈开一切。（官方 70 版 Lv60 史诗钝器）' });
moveEpic('ep_ls_elegy', { lvl: 60, tier: 1, abyss: false, seed: 'ep_ls_elegy#1', fx: { dmgUp: 0.1, crit: 0.05, mcrit: 0.05, critDmg: 0.15 },
  proc: { on: 'crit', chance: 0.1, act: 'status', status: 'bleed', dur: 5, dps: 0.22, name: '挽歌', desc: '暴击时 10% 几率使敌人大出血 5 秒（每秒 22% 攻击力）。' },
  desc: '为倒下的敌人奏响的挽歌。（官方 70 版 Lv60 史诗光剑）' });
// 80 版 Lv70 → Lv60 T3（时空之门深渊专属 + 谜之觉悟 / 无形棺柩 0.3%）
moveEpic('ep_ss_shura', { lvl: 60, tier: 3, seed: 'ep_ss_shura#13', fx: { dmgUp: 0.15, dark: 40, critDmg: 0.15 },
  proc: [{ on: 'crit', chance: 0.12, cd: 1.5, act: 'strike', mul: 2.6, aoe: 150, elem: 'dark', vis: 'dark', name: '修罗波动！', desc: '暴击时 12% 几率释放修罗波动：对周围敌人造成 260% 暗属性伤害（冷却 1.5 秒）；' },
    { on: 'skill', chance: 0.08, cd: 10, act: 'buff', buff: { critDmg: 0.2 }, dur: 8, key: 'shura', name: '修罗之怒', col: '#c040ff', desc: '施放技能时 8% 几率进入修罗之怒：8 秒内暴击伤害 +20%（冷却 10 秒）。' }],
  desc: '修罗的波动在剑身里低吼。（官方 80 版 Lv70 史诗短剑）' });
moveEpic('ep_kt_ninedragon', { lvl: 60, tier: 3, seed: 'ep_kt_ninedragon#16', fx: { dmgUp: 0.15, cdr: 0.08, crit: 0.06, mcrit: 0.06 },
  proc: [{ on: 'skill', chance: 0.1, act: 'reset', name: '九龙护魂！', desc: '施放技能时 10% 几率立即重置这个技能的冷却；' },
    { on: 'crit', chance: 0.1, cd: 1.5, act: 'strike', mul: 2.6, aoe: 150, vis: 'swords', col: '#6fe0a8', name: '九龙啸！', desc: '暴击时 10% 几率九龙齐啸：对周围敌人造成 260% 伤害（冷却 1.5 秒）。' }],
  desc: '九条龙魂缠绕刀身，守护着持刀之人。（官方 80 版 Lv70 史诗太刀）' });
moveEpic('ep_cb_heart', { lvl: 60, tier: 3, seed: 'ep_cb_heart#1', fx: { dmgUp: 0.15, critDmg: 0.16, hardness: 40, dark: 40 },
  proc: [{ act: 'extra', frac: 0.06, exec: 0.3, desc: '敌人剩余 HP 越低，附加伤害越高（6% ~ 36%）；' },
    { on: 'crit', chance: 0.1, cd: 1.5, act: 'strike', mul: 2.6, elem: 'dark', vis: 'dark', col: '#ff3050', name: '心脏粉碎！', desc: '暴击时 10% 几率粉碎心脏（260% 暗属性伤害，冷却 1.5 秒）。' }],
  desc: '专门对付垂死挣扎的敌人。（官方 80 版 Lv70 史诗钝器）' });
moveEpic('ep_gs_guardian', { lvl: 60, tier: 3, fx: { dmgUp: 0.15, dmgReduce: 0.08, hardness: 50, light: 40 },
  proc: [{ on: 'hurt', chance: 0.25, cd: 2, act: 'strike', mul: 2.7, aoe: 160, vis: 'nova', name: '守护反击！', desc: '被击时 25% 几率反击：对周围敌人造成 270% 伤害（冷却 2 秒）；' },
    { on: 'lowhp', chance: 1, cd: 30, act: 'shield', amt: 0.15, dur: 6, name: '守护之誓', desc: 'HP 低于 30% 时得到 15% HP 上限的护盾，持续 6 秒（冷却 30 秒）。' }],
  desc: '为守护而挥动的巨剑，从不先出手。（官方 80 版 Lv70 史诗巨剑）' });

/* ---------------- 4. 新增：31~49 原创 + 官方 Lv50~60 ---------------- */
// Lv34 原创（暗精灵地下城领主表）
W('ep_ss_widow', { wtype: 'shortsword', lvl: 34, name: '蛛丝影刃', st: { str: 40, int: 40 }, fx: { dmgUp: 0.12, crit: 0.03, mcrit: 0.03 },
  proc: { chance: 0.05, act: 'status', status: 'slow', dur: 3, name: '蛛网缠绕', desc: '攻击时 5% 几率用蛛丝缠住敌人（减速 3 秒）。' },
  desc: '蜘蛛洞穴的女王吐出的丝，比钢还韧。（本作原创）' });
W('ep_kt_moonshadow', { wtype: 'katana', lvl: 34, name: '暗精灵的月影刀', st: { str: 30 }, fx: { dmgUp: 0.12, crit: 0.04, mcrit: 0.04, dark: 25 },
  desc: '暗精灵在没有月亮的地底，仿照传说里的月亮打出的太刀。（本作原创）' });
W('ep_cb_tombstone', { wtype: 'club', lvl: 34, name: '墓碑重锤', st: { str: 45 }, fx: { dmgUp: 0.12, stagger: 40, dark: 25 },
  desc: '暗精灵墓地里一块没有名字的墓碑，被人拴上铁链当成了锤子。（本作原创）' });
W('ep_gs_lavafang', { wtype: 'greatsword', lvl: 34, name: '熔岩巨牙剑', st: { str: 40 }, fx: { dmgUp: 0.12, fire: 28, hardness: 30 },
  desc: '熔岩穴深处的黑曜石，裂缝里的岩浆一直没有冷却。（本作原创）' });
W('ep_ls_elfstar', { wtype: 'lightsaber', lvl: 34, name: '暗精灵的星辉剑', fx: { dmgUp: 0.12, light: 28, aspd: 0.04, crit: 0.03, mcrit: 0.03, critDmg: 0.1 },
  desc: '暗精灵的工匠把地底晶石的微光收进了剑柄。（本作原创）' });
// Lv38 原创（暗黑城深渊专属）
W('ep_ss_raven', { wtype: 'shortsword', lvl: 38, name: '渡鸦之吻', st: { str: 45, int: 45 }, fx: { dmgUp: 0.13, dark: 28 },
  proc: { on: 'crit', chance: 0.1, cd: 1.5, act: 'strike', mul: 1.9, aoe: 120, elem: 'dark', vis: 'dark', name: '鸦羽乱舞！', desc: '暴击时 10% 几率掀起鸦羽：对周围敌人造成 190% 暗属性伤害（冷却 1.5 秒）。' },
  desc: '诺伊佩拉的渡鸦只亲吻将死之人。（本作原创）' });
W('ep_kt_ferryman', { wtype: 'katana', lvl: 38, seed: 'ep_kt_ferryman#18', name: '冥河摆渡刀', st: { str: 35 }, fx: { dmgUp: 0.13, crit: 0.04, mcrit: 0.04, ice: 28 },
  proc: { chance: 0.06, cd: 1, act: 'strike', mul: 1.9, elem: 'ice', vis: 'ice', col: '#9fe8e0', name: '冥河寒流！', desc: '攻击时 6% 几率掀起冥河寒流（190% 冰属性伤害）。' },
  desc: '摆渡人的刀上挂着一盏小灯，照着亡魂过河。（本作原创）' });
W('ep_cb_plague', { wtype: 'club', lvl: 38, name: '狄瑞吉的毒瓶锤', st: { str: 45 }, fx: { dmgUp: 0.13, stagger: 40, critDmg: 0.1 },
  proc: [{ chance: 0.06, cd: 1, act: 'strike', mul: 1.8, aoe: 120, vis: 'dark', col: '#a8c840', name: '毒瓶炸裂！', desc: '攻击时 6% 几率砸碎毒瓶：对周围敌人造成 180% 伤害，' },
    { chance: 0.05, act: 'status', status: 'poison', dur: 5, dps: 0.12, name: '瘟疫', desc: '5% 几率使敌人中毒 5 秒。' }],
  desc: '瘟疫之源狄瑞吉装毒的瓶子，瓶塞是一颗小骷髅。（本作原创）' });
W('ep_gs_blackknight', { wtype: 'greatsword', lvl: 38, name: '黑暗骑士之誓', st: { str: 45 }, fx: { dmgUp: 0.13, dark: 28, hardness: 40 },
  proc: { chance: 0.05, cd: 1, act: 'strike', mul: 2.0, aoe: 150, elem: 'dark', vis: 'dark', name: '黑骑士斩！', desc: '攻击时 5% 几率挥出黑骑士斩：对周围敌人造成 200% 暗属性伤害。' },
  desc: '无头骑士生前立誓守护暗黑城时佩的剑。（本作原创）' });
W('ep_ls_void', { wtype: 'lightsaber', lvl: 38, seed: 'ep_ls_void#6', name: '虚空光刃', fx: { dmgUp: 0.13, light: 28 },
  proc: { on: 'crit', chance: 0.1, cd: 1.5, act: 'strike', mul: 1.9, aoe: 120, elem: 'light', vis: 'nova', col: '#b98cff', name: '虚空裂隙！', desc: '暴击时 10% 几率撕开虚空裂隙：对周围敌人造成 190% 光属性伤害（冷却 1.5 秒）。' },
  desc: '光刃里是一片没有星星的夜空，边缘却亮得刺眼。（本作原创）' });
// Lv45 原创（根特外围 / 比尔马克 / 哈穆林）
W('ep_ss_lion', { wtype: 'shortsword', lvl: 45, seed: 'ep_ss_lion#5', name: '皇家近卫短剑-荣光', st: { str: 50, int: 50 }, fx: { dmgUp: 0.13, critDmg: 0.13 },
  proc: { on: 'skill', chance: 0.1, cd: 3, act: 'strike', mul: 1.8, aoe: 130, vis: 'swords', col: '#ffe08a', name: '荣光之剑！', desc: '施放技能时 10% 几率召唤荣光之剑：对周围敌人造成 180% 伤害（冷却 3 秒）。' },
  desc: '根特皇家近卫队的佩剑，剑格上是皇室的狮子纹章。（本作原创）' });
W('ep_kt_whitenight', { wtype: 'katana', lvl: 45, seed: 'ep_kt_whitenight#25', name: '雪原寒刃-白夜', fx: { dmgUp: 0.13, ice: 30, crit: 0.04, mcrit: 0.04 },
  proc: [{ chance: 0.05, act: 'status', status: 'freeze', dur: 1.5, name: '冰封', desc: '攻击时 5% 几率冰冻敌人 1.5 秒，' }, { vs: 'freeze', act: 'extra', frac: 0.25, desc: '攻击冰冻中的敌人时附加 25% 伤害。' }],
  desc: '万年雪山的白夜里锻成的太刀，刀纹像结冰的湖面。（本作原创）' });
W('ep_cb_gear', { wtype: 'club', lvl: 45, name: '齿轮破甲锤', st: { str: 55 }, fx: { dmgUp: 0.13, stagger: 50, critDmg: 0.12 },
  proc: { chance: 0.06, act: 'debuff', taken: 0.12, dur: 5, name: '破甲', desc: '攻击时 6% 几率击碎护甲：敌人 5 秒内受到的伤害 +12%。' },
  desc: '比尔马克试验场的工程师做的破甲锤，锤头里的活塞一直在动。（本作原创）' });
W('ep_gs_siege', { wtype: 'greatsword', lvl: 45, name: '破城者', st: { str: 50 }, fx: { dmgUp: 0.13, critDmg: 0.14, hardness: 40 },
  proc: { chance: 0.05, cd: 1, act: 'strike', mul: 1.9, aoe: 160, vis: 'nova', col: '#ffa050', name: '攻城锤击！', desc: '攻击时 5% 几率打出攻城锤击：对周围敌人造成 190% 伤害。' },
  desc: '卡勒特攻城用的蒸汽巨剑，剑脊上装着活塞和锅炉。（本作原创）' });
W('ep_ls_coil', { wtype: 'lightsaber', lvl: 45, seed: 'ep_ls_coil#2', name: '电磁光剑-根特试作型', fx: { dmgUp: 0.12, light: 28, crit: 0.03, mcrit: 0.03, critDmg: 0.1 },
  proc: [{ chance: 0.05, act: 'status', status: 'stun', dur: 1, name: '电磁脉冲', desc: '攻击时 5% 几率放出电磁脉冲（眩晕 1 秒），' }, { vs: 'stun', act: 'extra', frac: 0.2, desc: '攻击眩晕中的敌人时附加 20% 伤害。' }],
  desc: '根特技术部的试作品，电池一次能用三天。（本作原创）' });
// 官方 60 版 Lv50（新增）
W('ep_ss_barn', { wtype: 'shortsword', lvl: 50, name: '巴恩的短剑', st: { str: 55, int: 55 }, fx: { dmgUp: 0.11, critDmg: 0.14 },
  proc: { chance: 0.06, cd: 1, act: 'strike', mul: 1.9, vis: 'swords', name: '剑圣之意！', desc: '攻击时 6% 几率引出剑圣之意（190% 伤害）。' },
  desc: '传说中的剑士巴恩年轻时用过的短剑。（官方 60 版 Lv50 史诗短剑）' });
W('ep_ss_hundred', { wtype: 'shortsword', lvl: 50, name: '双剑-百鬼乱舞', fx: { dmgUp: 0.11, dark: 30, aspd: 0.05 },
  proc: { chance: 0.1, cd: 1.2, act: 'strike', mul: 1.8, aoe: 120, elem: 'dark', vis: 'swords', col: '#9ab0ff', name: '百鬼夜行！', desc: '攻击时 10% 几率放出百鬼：对周围敌人造成 180% 暗属性伤害（冷却 1.2 秒）。' },
  desc: '剑身里关着一百只小鬼，每砍一刀就放出去几只。（官方 60 版 Lv50 史诗短剑）' });
W('ep_kt_bloodmoon', { wtype: 'katana', lvl: 50, seed: 'ep_kt_bloodmoon#40', name: '血舞旋月刀', fx: { dmgUp: 0.11, crit: 0.05, mcrit: 0.05, critDmg: 0.12 },
  proc: [{ chance: 0.06, act: 'status', status: 'bleed', dur: 4, dps: 0.15, name: '血舞', desc: '攻击时 6% 几率使敌人出血 4 秒，' }, { vs: 'bleed', act: 'extra', frac: 0.2, desc: '攻击出血中的敌人时附加 20% 伤害。' }],
  desc: '血月之夜，刀光像一轮旋转的红月。（官方 60 版 Lv50 史诗太刀）' });
W('ep_kt_siran', { wtype: 'katana', lvl: 50, seed: 'ep_kt_siran#22', name: '西岚的武士刀', fx: { dmgUp: 0.11, crit: 0.05, mcrit: 0.05, aspd: 0.05 },
  proc: { on: 'crit', chance: 0.12, cd: 1.5, act: 'strike', mul: 1.8, vis: 'slash', name: '一闪！', desc: '暴击时 12% 几率拔刀一闪（180% 伤害，冷却 1.5 秒）。' },
  desc: '剑术大师西岚的佩刀，出鞘即收。（官方 60 版 Lv50 史诗太刀）' });
W('ep_kt_crossdou', { wtype: 'katana', lvl: 50, seed: 'ep_kt_crossdou#31', name: '十字斩刀-斗', fx: { dmgUp: 0.11, crit: 0.04, mcrit: 0.04, critDmg: 0.12 },
  proc: { chance: 0.025, act: 'cut', cut: 0.25, boss: false, name: '十字斩！', desc: '攻击时 2.5% 几率削减敌人 25% 的当前 HP（对领主无效）。' },
  desc: '十字斩刀系列里最擅长缠斗的一把。（官方 60 版 Lv50 史诗太刀）' });
W('ep_cb_siran', { wtype: 'club', lvl: 50, name: '西岚的倒刺棒', st: { str: 55 }, fx: { dmgUp: 0.11, stagger: 50, critDmg: 0.14 },
  proc: [{ chance: 0.06, act: 'status', status: 'bleed', dur: 4, dps: 0.15, name: '倒刺', desc: '攻击时 6% 几率用倒刺撕开伤口（出血 4 秒），' }, { vs: 'bleed', act: 'extra', frac: 0.2, desc: '攻击出血中的敌人时附加 20% 伤害。' }],
  desc: '西岚年轻时的兵器，棒身上的倒刺一根根都是手工打的。（官方 60 版 Lv50 史诗钝器）' });
W('ep_gs_yilong', { wtype: 'greatsword', lvl: 50, name: '逸龙剑-抉择', st: { str: 55 }, fx: { dmgUp: 0.11, critDmg: 0.15, hardness: 40 },
  proc: { chance: 0.05, cd: 1, act: 'strike', mul: 1.9, aoe: 150, vis: 'swords', col: '#8fe0c0', name: '逸龙斩！', desc: '攻击时 5% 几率放出逸龙：对周围敌人造成 190% 伤害。' },
  desc: '剑身上游着一条银龙，据说它会替持剑人做出抉择。（官方 60 版 Lv50 史诗巨剑）' });
W('ep_ls_tianji', { wtype: 'lightsaber', lvl: 50, seed: 'ep_ls_tianji#2', name: '天脊乾坤剑', fx: { dmgUp: 0.11, light: 30, crit: 0.04, mcrit: 0.04 },
  proc: { on: 'crit', chance: 0.12, cd: 1.5, act: 'strike', mul: 1.8, elem: 'light', vis: 'holy', name: '乾坤一剑！', desc: '暴击时 12% 几率降下乾坤一剑（180% 光属性伤害，冷却 1.5 秒）。' },
  desc: '天脊山的道士把乾坤八卦刻进了光刃里。（官方 60 版 Lv50 史诗光剑）' });
// 官方 60 版 Lv55（新增）
W('ep_ss_westflame', { wtype: 'shortsword', lvl: 55, seed: 'ep_ss_westflame#6', name: '万剑之王-西方之焰', fx: { dmgUp: 0.09, fire: 28, atkElem: 'fire' },
  proc: { on: 'skill', chance: 0.1, cd: 3, act: 'strike', mul: 2.0, aoe: 150, elem: 'fire', vis: 'fire', name: '西方之焰！', desc: '火属性攻击；施放技能时 10% 几率燃起西方之焰：对周围敌人造成 200% 火属性伤害（冷却 3 秒）。' },
  desc: '万剑之王的王冠化成了剑格，剑身永远烧得通红。（官方 60 版 Lv55 史诗短剑）' });
W('ep_gs_ziwu', { wtype: 'greatsword', lvl: 55, seed: 'ep_gs_ziwu#7', name: '子午七星剑', fx: { dmgUp: 0.12, light: 30, crit: 0.05, mcrit: 0.05 },
  proc: { chance: 0.05, cd: 1, act: 'strike', mul: 2.0, aoe: 150, elem: 'light', vis: 'swords', col: '#ffe98a', name: '七星剑阵！', desc: '攻击时 5% 几率布下七星剑阵：对周围敌人造成 200% 光属性伤害。' },
  desc: '剑上嵌着北斗七星，子时和午时最亮。（官方 60 版 Lv55 史诗巨剑）' });
W('ep_ls_bonejail', { wtype: 'lightsaber', lvl: 55, name: '天脊骨狱息', fx: { dmgUp: 0.115, ice: 32, atkElem: 'ice', aspd: 0.05 },
  proc: [{ chance: 0.05, act: 'status', status: 'freeze', dur: 1.2, name: '骨狱寒息', desc: '冰属性攻击；攻击时 5% 几率冰冻敌人 1.2 秒，' }, { vs: 'freeze', act: 'extra', frac: 0.2, desc: '攻击冰冻中的敌人时附加 20% 伤害。' }],
  desc: '天脊山骨狱里吹出来的寒气，被收进了一截脊骨做的剑柄。（官方 60 版 Lv55 史诗光剑）' });
// 官方 70 版 Lv60（T1，新增）
W('ep_gs_survivor', { wtype: 'greatsword', lvl: 60, tier: 1, seed: 'ep_gs_survivor#3', name: '幸存者的奥秘', fx: { dmgUp: 0.12, critDmg: 0.16, hpPct: 0.06 },
  proc: [{ chance: 0.05, cd: 1, act: 'strike', mul: 2.1, aoe: 150, vis: 'nova', name: '幸存者之怒！', desc: '攻击时 5% 几率爆发：对周围敌人造成 210% 伤害；' },
    { on: 'lowhp', chance: 1, cd: 30, act: 'shield', amt: 0.12, dur: 6, name: '求生本能', desc: 'HP 低于 30% 时得到 12% HP 上限的护盾，持续 6 秒（冷却 30 秒）。' }],
  desc: '伤痕累累的巨剑，每一道缺口都是一次死里逃生。（官方 70 版 Lv60 史诗巨剑）' });
W('ep_ls_wuxuan', { wtype: 'lightsaber', lvl: 60, tier: 1, seed: 'ep_ls_wuxuan#2', name: '无轩之散魄', fx: { dmgUp: 0.07, light: 28 },
  proc: { chance: 0.06, cd: 1, act: 'strike', mul: 2.1, aoe: 130, elem: 'light', vis: 'nova', col: '#9ec8ff', name: '散魄！', desc: '攻击时 6% 几率散出魂魄：对周围敌人造成 210% 光属性伤害。' },
  desc: '无轩系列的光剑，光刃里飘着散开的魂魄。（官方 70 版 Lv60 史诗光剑）' });
// 官方 Lv65 → Lv60 T2（新增；谜之觉悟 / 无形棺柩领主表 + 随机史诗）
W('ep_ss_bluewraith', { wtype: 'shortsword', lvl: 60, tier: 2, name: '布鲁之怨灵短剑', st: { str: 65, int: 65 }, fx: { dmgUp: 0.13, dark: 35, critDmg: 0.15 },
  proc: { on: 'crit', chance: 0.1, cd: 1.5, act: 'strike', mul: 2.3, aoe: 130, elem: 'dark', vis: 'dark', col: '#7fe8ff', name: '怨灵哀嚎！', desc: '暴击时 10% 几率放出怨灵：对周围敌人造成 230% 暗属性伤害（冷却 1.5 秒）。' },
  desc: '布鲁的怨灵被锁在剑里，铁链一松就会哀嚎。（官方 Lv65 史诗短剑）' });
W('ep_kt_arona', { wtype: 'katana', lvl: 60, tier: 2, name: '阿罗那的拥抱', fx: { dmgUp: 0.14, crit: 0.05, mcrit: 0.05, critDmg: 0.16 },
  proc: { on: 'crit', chance: 0.1, cd: 1.5, act: 'strike', mul: 2.3, aoe: 120, vis: 'petal', col: '#ffb0c8', name: '阿罗那之拥！', desc: '暴击时 10% 几率落下花雨：对周围敌人造成 230% 伤害（冷却 1.5 秒）。' },
  desc: '阿罗那留给爱人的太刀，刀格是一对抱着心的翅膀。（官方 Lv65 史诗太刀）' });
W('ep_cb_dwarf', { wtype: 'club', lvl: 60, tier: 2, name: '矮人的巨力黄金锤', st: { str: 70 }, fx: { dmgUp: 0.13, stagger: 70, critDmg: 0.16 },
  proc: { chance: 0.05, cd: 1, act: 'strike', mul: 2.4, aoe: 170, vis: 'nova', col: '#ffd24a', name: '巨力震地！', desc: '攻击时 5% 几率震裂大地：对周围敌人造成 240% 伤害。' },
  desc: '矮人族长用纯金打的战锤，重得只有矮人抡得动。（官方 Lv65 史诗钝器）' });
W('ep_gs_demonslave', { wtype: 'greatsword', lvl: 60, tier: 2, seed: 'ep_gs_demonslave#6', name: '恶魔的奴隶', fx: { dmgUp: 0.13, dark: 35, hardness: 40, critDmg: 0.15 },
  proc: [{ chance: 0.05, cd: 1, act: 'strike', mul: 2.3, aoe: 160, elem: 'dark', vis: 'dark', name: '恶魔契约！', desc: '攻击时 5% 几率履行恶魔契约：对周围敌人造成 230% 暗属性伤害；' },
    { on: 'kill', chance: 0.25, act: 'buff', buff: { atk: 0.03 }, dur: 10, stack: 5, key: 'demonslave', name: '奴役', col: '#ff3040', desc: '击杀敌人时 25% 几率：攻击力 +3%，最多 5 层，持续 10 秒。' }],
  desc: '剑身上还扣着没解开的镣铐，谁握住它，谁就成了恶魔的奴隶。（官方 Lv65 史诗巨剑）' });
W('ep_ls_branz', { wtype: 'lightsaber', lvl: 60, tier: 2, seed: 'ep_ls_branz#11', name: '火焰刃-布兰兹', fx: { dmgUp: 0.13, fire: 35, atkElem: 'fire', aspd: 0.05 },
  proc: [{ chance: 0.06, cd: 1, act: 'strike', mul: 2.3, aoe: 130, elem: 'fire', vis: 'fire', name: '布兰兹之焰！', desc: '火属性攻击；攻击时 6% 几率喷出烈焰：对周围敌人造成 230% 火属性伤害，' },
    { chance: 0.06, act: 'status', status: 'burn', dur: 4, dps: 0.15, name: '灼烧', desc: '6% 几率灼烧敌人 4 秒。' }],
  desc: '布兰兹的火焰光刃，连剑柄都是烫的。（官方 Lv65 史诗光剑）' });
// 官方 80 版 Lv70 → Lv60 T3（新增）
W('ep_ss_hurricane', { wtype: 'shortsword', lvl: 60, tier: 3, name: '巴恩的飓风短剑', st: { str: 70, int: 70 }, fx: { dmgUp: 0.15, critDmg: 0.18, aspd: 0.06 },
  proc: [{ on: 'skill', chance: 0.12, cd: 3, act: 'strike', mul: 2.7, aoe: 180, vis: 'swords', col: '#9ff0d0', name: '飓风斩！', desc: '施放技能时 12% 几率卷起飓风：对周围敌人造成 270% 伤害（冷却 3 秒）；' },
    { on: 'crit', chance: 0.08, cd: 12, act: 'buff', buff: { aspd: 0.12, mspd: 0.12 }, dur: 6, key: 'hurricane', name: '疾风', col: '#9ff0d0', desc: '暴击时 8% 几率：6 秒内攻击 / 移动速度 +12%（冷却 12 秒）。' }],
  desc: '巴恩晚年的佩剑，挥一下就是一阵飓风。（官方 80 版 Lv70 史诗短剑）' });
W('ep_ls_icedragon', { wtype: 'lightsaber', lvl: 60, tier: 3, seed: 'ep_ls_icedragon#1', name: '冰龙之愤怒', fx: { dmgUp: 0.15, ice: 40, aspd: 0.06, crit: 0.04, mcrit: 0.04 },
  proc: [{ on: 'crit', chance: 0.1, cd: 1.5, act: 'strike', mul: 2.7, aoe: 160, elem: 'ice', vis: 'ice', name: '冰龙吐息！', desc: '暴击时 10% 几率喷出冰龙吐息：对周围敌人造成 270% 冰属性伤害（冷却 1.5 秒）；' },
    { chance: 0.05, act: 'status', status: 'freeze', dur: 1.5, name: '冰封', desc: '攻击时 5% 几率冰冻敌人 1.5 秒。' }],
  desc: '冰龙张开的嘴里吐出的就是光刃。（官方 80 版 Lv70 史诗光剑）' });

/* ---------------- 5. 掉落 / 深渊归属 ---------------- */
// Lv1~10
gearDrop('dark_woods', [['ep_ss_greenleaf', 0.012]]);
gearDrop('dark_woods_deep', [['ep_ss_greenleaf', 0.01], ['ep_ls_firefly', 0.012], ['ep_cb_oakfang', 0.01]]);
gearDrop('thunder_ruins', [['ep_ls_firefly', 0.01], ['ep_cb_oakfang', 0.012], ['ep_gs_oak', 0.012]]);
gearDrop('venom_ruins', [['ep_gs_oak', 0.01]]);
// Lv34（暗精灵）
gearDrop('spider_cave', [['ep_ss_widow', 0.01], ['ep_ls_elfstar', 0.01]]);
gearDrop('darkelf_tomb', [['ep_ss_widow', 0.01], ['ep_kt_moonshadow', 0.01], ['ep_cb_tombstone', 0.01]]);
gearDrop('lava_cave', [['ep_cb_tombstone', 0.01], ['ep_gs_lavafang', 0.01]]);
gearDrop('king_ruins', [['ep_kt_moonshadow', 0.01], ['ep_gs_lavafang', 0.01], ['ep_ls_elfstar', 0.01]]);
// Lv38：暗黑城深渊专属
abyssClaim('darkelf', ['ep_ss_raven', 'ep_kt_ferryman', 'ep_cb_plague', 'ep_gs_blackknight', 'ep_ls_void']);
// Lv45（根特前线 / 比尔马克 / 哈穆林）
gearDrop('fallen_bandits', [['ep_ss_lion', 0.01], ['ep_kt_whitenight', 0.01], ['ep_gs_siege', 0.01]]);
gearDrop('bilmark', [['ep_cb_gear', 0.012], ['ep_ls_coil', 0.012]]);
gearDrop('hamelin', [['ep_ss_lion', 0.008], ['ep_kt_whitenight', 0.008], ['ep_cb_gear', 0.008], ['ep_gs_siege', 0.008], ['ep_ls_coil', 0.008]]);
// Lv50（根特 / 悲鸣洞穴）：搬来的 9 件 + 新增 8 件
gearDrop('gent_outskirts', [['ep_shortsword', 0.008], ['ep_katana', 0.008], ['ep_greatsword', 0.008], ['ep_ls_sun', 0.008], ['ep_ss_barn', 0.008], ['ep_kt_siran', 0.008]]);
gearDrop('gent_east', [['ep_ss_gsd', 0.008], ['ep_cb_devour', 0.008], ['ep_gs_conqueror', 0.008], ['ep_ls_breaker', 0.008], ['ep_kt_bloodmoon', 0.008], ['ep_cb_siran', 0.008]]);
gearDrop('wailing_cave', [['ep_cb_ghost', 0.01], ['ep_ss_hundred', 0.01], ['ep_kt_crossdou', 0.008], ['ep_gs_yilong', 0.008], ['ep_ls_tianji', 0.008]]);
gearDrop('gent_south', [['ep_ss_barn', 0.006], ['ep_kt_bloodmoon', 0.006], ['ep_cb_ghost', 0.006], ['ep_gs_yilong', 0.006], ['ep_ls_tianji', 0.006]]);
// 魔剑-阿波菲斯：从虫王戮蛊的领主表拿掉，改成悲鸣洞穴 · 骷髅凯恩（精英）专属掉落 + 海上列车深渊
dropRemove('wailing_cave', 'ep_gs_apophis');
monDrop('kain', [['ep_gs_apophis', 0.08]], { dungeons: ['wailing_cave'] });
abyssClaim('train', ['ep_gs_apophis']);
// Lv55（海上列车 / 时空之门前段）
gearDrop('sea_pirates', [['ep_ss_kanya', 0.008], ['ep_kt_slaughter', 0.008], ['ep_club', 0.008]]);
gearDrop('west_line', [['ep_katana2', 0.008], ['ep_cb_soulmate', 0.008], ['ep_gs_evildragon', 0.008]]);
gearDrop('heis', [['ep_ls_millennium', 0.008], ['ep_ss_westflame', 0.008], ['ep_gs_ziwu', 0.008]]);
gearDrop('arden', [['ep_ls_bonejail', 0.01], ['ep_ss_westflame', 0.006], ['ep_gs_ziwu', 0.006], ['ep_gs_evildragon', 0.006]]);
gearDrop('grand_fire', [['ep_ss_kanya', 0.006], ['ep_katana2', 0.006], ['ep_cb_soulmate', 0.006]]);
gearDrop('plague_source', [['ep_kt_slaughter', 0.006], ['ep_club', 0.006], ['ep_ls_bonejail', 0.006], ['ep_ls_millennium', 0.006]]);
// Lv60 T1（时空之门后段 / 希洛克）
gearDrop('kartel_origin', [['ep_gs_survivor', 0.008], ['ep_cb_kirin', 0.008]]);
gearDrop('holy_war', [['ep_ls_elegy', 0.008], ['ep_ls_wuxuan', 0.008]]);
gearDrop('secret_zone', [['ep_ss_fate', 0.008], ['ep_kt_andra', 0.008]]);
gearDrop('old_wail', [['ep_gs_survivor', 0.008], ['ep_ls_elegy', 0.008]]);
gearDrop('old_winter', [['ep_cb_kirin', 0.008], ['ep_ls_wuxuan', 0.008]]);
gearDrop('pain_gate', [['ep_gs_survivor', 0.008], ['ep_cb_kirin', 0.008], ['ep_ls_elegy', 0.008]]);
// Lv60 T2：攻坚（谜之觉悟 / 无形棺柩）
for (const dg of ['iris_raid', 'siroco_coffin']) gearDrop(dg, ['ep_ss_bluewraith', 'ep_kt_arona', 'ep_cb_dwarf', 'ep_gs_demonslave', 'ep_ls_branz'].map(k => [k, 0.006]));
// Lv60 T3：时空之门深渊专属 + 攻坚 0.3%
const T3 = ['ep_ss_shura', 'ep_ss_hurricane', 'ep_kt_ninedragon', 'ep_cb_heart', 'ep_gs_guardian', 'ep_ls_icedragon'];
abyssClaim('timegate', T3);
for (const dg of ['iris_raid', 'siroco_coffin']) gearDrop(dg, T3.map(k => [k, 0.003]));

/* ---------------- 6. 领主神器（粉色，只在那个领主身上掉；拿在手里用 <类型>_r3 外观）---------------- */
const NM = (key, lord, dgs, p, def) => { defineNamed(key, { slot: 'weapon', lord, ...def }); monDrop(lord, [[key, p]], { dungeons: dgs }); };
NM('nm_ss_kino', 'goblinShaman', ['thunder_ruins'], 0.03, { wtype: 'shortsword', lvl: 9, name: '雷饮电光剑', fx: { dmgUp: 0.04, light: 12 },
  proc: { chance: 0.05, act: 'strike', mul: 1.0, elem: 'light', vis: 'bolt', name: '雷饮！', desc: '攻击时 5% 几率引下一道小雷（100% 光属性伤害）。' },
  desc: '落雷凯诺用来引雷的短剑，剑身总是噼啪作响。（官方：雷鸣废墟 · 落雷凯诺的领主神器）' });
NM('nm_gs_sauta', 'tauKing', ['graca'], 0.03, { wtype: 'greatsword', lvl: 14, name: '萨乌塔的兽角巨剑', st: { str: 15 }, fx: { dmgUp: 0.05, hardness: 25 },
  proc: { chance: 0.05, act: 'status', status: 'stun', dur: 0.8, name: '冲撞', desc: '攻击时 5% 几率撞晕敌人 0.8 秒。' },
  desc: '牛头王萨乌塔把自己折断的角磨成了巨剑。（官方：格拉卡 · 牛头王萨乌塔的领主神器）' });
NM('nm_ls_seghart', 'seghart', ['lord_palace'], 0.025, { wtype: 'lightsaber', lvl: 23, name: '精铸的翼影之光', fx: { dmgUp: 0.06, light: 18, aspd: 0.03 },
  proc: { chance: 0.06, act: 'strike', mul: 1.2, elem: 'light', vis: 'holy', name: '翼影！', desc: '攻击时 6% 几率降下翼影之光（120% 光属性伤害）。' },
  desc: '光之城主赛格哈特的佩剑，精铸的剑柄上刻着一对光翼。（官方：城主宫殿 · 光之城主赛格哈特的领主神器）' });
NM('nm_gs_lotus', 'lotus', ['second_spine', 'abyss_spine'], 0.02, { wtype: 'greatsword', lvl: 30, name: '罗特斯的足灵剑', fx: { dmgUp: 0.07, hpPct: 0.05 },
  proc: { chance: 0.05, cd: 3, act: 'heal', hp: 0.02, name: '足灵再生', desc: '攻击时 5% 几率恢复 2% HP（冷却 3 秒）。' },
  desc: '长脚罗特斯一条触足化成的巨剑，断了也能长回来。（官方：天帷巨兽 · 长脚罗特斯的领主神器）' });
NM('nm_gs_spiz', 'spiz', ['darkelf_tomb'], 0.02, { wtype: 'greatsword', lvl: 34, name: '邪龙的灵角巨剑', fx: { dmgUp: 0.07, dark: 18 },
  proc: { chance: 0.05, cd: 1, act: 'strike', mul: 1.4, elem: 'dark', vis: 'dark', name: '灵角！', desc: '攻击时 5% 几率放出邪龙之力（140% 暗属性伤害）。' },
  desc: '邪龙斯皮兹的角做成的巨剑。（官方：暗精灵墓地 · 邪龙斯皮兹的领主神器）' });
NM('nm_kt_spiz', 'spiz', ['darkelf_tomb'], 0.02, { wtype: 'katana', lvl: 34, name: '邪龙的骨角太刀', fx: { dmgUp: 0.07, crit: 0.03, mcrit: 0.03 },
  proc: { chance: 0.05, act: 'status', status: 'bleed', dur: 4, dps: 0.1, name: '骨刺', desc: '攻击时 5% 几率使敌人出血 4 秒。' },
  desc: '邪龙斯皮兹的骨角磨成的太刀。（官方：暗精灵墓地 · 邪龙斯皮兹的领主神器）' });
NM('nm_ls_bentink', 'bentink', ['gent_outskirts'], 0.02, { wtype: 'lightsaber', lvl: 49, name: '本汀克的喷火器', fx: { dmgUp: 0.08, fire: 22 },
  proc: { chance: 0.06, act: 'status', status: 'burn', dur: 4, dps: 0.12, name: '纵火', desc: '攻击时 6% 几率点燃敌人 4 秒。' },
  desc: '纵火犯本汀克改装的喷火器，喷出来的火焰凝成了剑刃。（官方：根特外围 · 纵火犯本汀克的领主神器）' });
}
