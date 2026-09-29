/* =====================================================================
   装备 2.0 · B1b 神枪手武器（左轮 / 自动手枪 / 步枪 / 手炮 / 手弩）
   只写本块的物品；搬家 / 继承 / 领主神器 / 掉落 / 深渊归属一律用 gear60_api.js 的接口（用法见 docs/GEAR_PLAN_60.md §6）。
   注释只放在行尾或单独一行（一行中间的 // 会吞掉后面的字段）。
   内容（docs/GEAR.md §10.1 神枪手）：
     搬家 17 件（官方 60 版 Lv50 / 55、70 版 Lv60 T1、80 版 Lv70 → 本作 Lv60 T3）+ 继承装备 17 件（1~30 原位，只换名字外观）
     Lv1~10 每类 1 件（左轮已有沙漠之鹰-黄昏，补 4 件）；原创 Lv34 ×5、Lv38 暗黑城深渊 ×5、Lv45 ×5、Lv48 ×5
     官方新增 10 件（70 版 Lv60 ×2、官方 Lv65 → T2 ×5、80 版 Lv70 → T3 ×3）；领主神器 5 件 + 60 版 Lv55 粉装 6 件（只做图标，拿在手里用神器外观）
   外观：art/tools/wdesign_gun.py（weapon_gen.py 一把一张）；领主神器图标：art/tools/gear_icons_pink60_gun.py
   ===================================================================== */
{
// 史诗的 2 条随机属性按种子固定；抽到力量（攻击力 +0.4%/点）、暴击、HP、体力时整件会偏离 §2.3 预算（同级强弱、T1 < T2 < T3 被随机属性打乱）：本块新做 / 搬家的物品换种子到没有这几种为止（继承装备不动，沿用老物品的种子）
const calm = (key, def) => { for (let i = 0; i < 40; i++) { const seed = i ? `${key}#${i}` : key, st = gearStats({ kind: 'equip', rar: 5, ...def }, mulberry(keySeed(seed))); if (!st.str && !st.crit && !st.hp && !st.vit) return seed; } return key; };
const EP = (key, def) => defineEpic(key, { slot: 'weapon', seed: calm(key, { slot: 'weapon', ...def }), ...def });
const MV = (key, o) => moveEpic(key, { seed: calm(key, { ...ITEMS[key]._def, ...o }), ...o });
const INH = (old, key, name, desc) => inheritEpic(old, key, { name, desc: `${desc}（本作原创，继承自「${ITEMS[old].name}」）` });

/* ---------------- 继承装备（先登记：名字取搬家前的） ---------------- */
INH('ep_rv_sunset', 'ep_rv_rider', '荒原骑手', '在荒原上追了三天三夜的赏金猎人，最后一枪总在日落时响起。');
INH('ep_rv_enazma', 'ep_rv_scarlet', '绯刃左轮-莉赛', '枪管下挂着一片绯红长刃，女枪手莉赛靠它在近身时也不吃亏。');
INH('ep_rv_bone', 'ep_rv_frostfang', '霜牙', '枪口是一只咆哮的冰狼，子弹带着彻骨的寒意。');
INH('ep_rv_python', 'ep_rv_cobra', '赤鳞眼镜蛇-45MM', '天空之城深渊里找到的赤鳞左轮，蛇冠张开的时候，刚用过的技能会立刻重新就绪。');
INH('ep_ap_viper', 'ep_ap_rattler', '毒牙-响尾蛇', '握把下挂着一串响尾，开火之前会先沙沙作响。');
INH('ep_ap_flash', 'ep_ap_gale', '疾风之枪-岚', '燕子一样轻快的手枪，扣扳机的手指比风还快。');
INH('ep_ap_heckler', 'ep_ap_forge', '焚炉之心', '枪身里真的烧着一炉炭火，枪管永远是烫的。');
INH('ep_rf_death', 'ep_rf_verdict', '无声的判决', '加长消音管下的一枪，没有声音，只有判决。');
INH('ep_rf_howl', 'ep_rf_thunderhorn', '雷霆号角', '枪口是一只黄铜号角，开火时像雷声一样震慑敌人。');
INH('ep_rf_zombie', 'ep_rf_frostgrave', '霜冢猎人', '枪托做成了一口小棺材，专为冰封亡者而造。');
INH('ep_hc_meteor', 'ep_hc_twinstar', '双子焰星', '星形炮口喷出的火球，会在敌群里炸成两颗焰星。');
INH('ep_hc_breaker', 'ep_hc_rockcrush', '裂岩重炮', '用山岩和铁箍拼成的手炮，一炮就能震碎盔甲。');
INH('ep_hc_aqua', 'ep_hc_tide', '潮汐守望者', '海螺炮口里总能听见潮声。');
INH('ep_hc_wing', 'ep_hc_bell', '圣钟礼炮', '祭典的圣钟改成的礼炮，每一发都像钟声一样响彻天空。');
INH('ep_bg_headless', 'ep_bg_raven', '夜鸦之弩', '弩臂是一对张开的鸦羽，夜里射出的弩箭没有一点声音。');
INH('ep_bg_red', 'ep_bg_phoenix', '炎凰弩', '凤凰的火羽化成了弩臂，箭矢出膛即燃。');
INH('ep_bg_satan', 'ep_bg_whisper', '深渊低语', '弩臂上的触手会在你耳边低语；扣下扳机的那一刻，诅咒已经落下。');

/* ---------------- Lv1~10（P2：每类 1 件；左轮已有沙漠之鹰-黄昏 Lv10） ---------------- */
EP('ep_bg_feather', { wtype: 'bowgun', lvl: 5, name: '翠羽猎弩', fx: { aspd: 0.06, dmgUp: 0.04 }, desc: '洛兰的猎人用翠鸟羽毛扎成的弩臂，轻得像没拿东西。（本作原创）' });
EP('ep_ap_dawn', { wtype: 'autopistol', lvl: 7, name: '晨星之枪-破晓', fx: { dmgUp: 0.05, crit: 0.03, mcrit: 0.03 }, desc: '新人枪手的护身符，枪身上刻着一轮初升的太阳。（本作原创）' });
EP('ep_rf_falcon', { wtype: 'rifle', lvl: 8, name: '猎鹰之眼', fx: { crit: 0.04, mcrit: 0.04, hit: 0.03, dmgUp: 0.03 }, desc: '枪管下系着一束鹰羽，据说能让子弹像猎鹰一样俯冲。（本作原创）' });
EP('ep_hc_firework', { wtype: 'handcannon', lvl: 9, name: '庆典烟花炮', fx: { dmgUp: 0.05, fire: 15, stagger: 20 },
  proc: { chance: 0.04, cd: 2, act: 'strike', mul: 0.8, aoe: 110, elem: 'fire', vis: 'fire', col: '#ffb24a', name: '烟花！', desc: '攻击时 4% 几率炸开烟花：周围敌人受到 80% 火属性伤害（冷却 2 秒）。' },
  desc: '节日里放烟花用的手炮，打在怪物身上也一样好看。（本作原创）' });

/* ---------------- Lv34 原创（暗精灵地区普通掉落） ---------------- */
EP('ep_rv_moonshade', { wtype: 'revolver', lvl: 34, name: '月影银弹', fx: { dmgUp: 0.09, dark: 25, crit: 0.04, mcrit: 0.04 },
  proc: { on: 'crit', chance: 0.06, cd: 1.5, act: 'strike', mul: 1.2, elem: 'dark', vis: 'moon', col: '#bcd4ff', name: '月影！', desc: '暴击时 6% 几率追加一发月影银弹（120% 暗属性伤害，冷却 1.5 秒）。' },
  desc: '暗精灵的枪匠在月蚀之夜铸成，银弹在黑暗里拖出一道月光。（本作原创）' });
EP('ep_ap_weaver', { wtype: 'autopistol', lvl: 34, name: '蛛丝-织网者', fx: { dmgUp: 0.09, crit: 0.04, mcrit: 0.04, critDmg: 0.08 },
  proc: { chance: 0.05, act: 'status', status: 'slow', dur: 3, name: '蛛网', desc: '攻击时 5% 几率用蛛丝缠住敌人（减速 3 秒）。' },
  desc: '蜘蛛洞穴深处的织网者吐出的丝，被缠进了枪膛。（本作原创）' });
EP('ep_rf_magma', { wtype: 'rifle', lvl: 34, name: '熔岩穿刺者', fx: { dmgUp: 0.09, fire: 26, crit: 0.03, mcrit: 0.03 },
  proc: { chance: 0.04, act: 'status', status: 'burn', dur: 3, dps: 0.1, name: '熔岩', desc: '攻击时 4% 几率使敌人灼伤 3 秒。' },
  desc: '熔岩穴的黑曜石磨成的枪管，子弹出膛时还是红的。（本作原创）' });
EP('ep_hc_goliath', { wtype: 'handcannon', lvl: 34, name: '巨人之锤', fx: { dmgUp: 0.09, fire: 25, crit: 0.03, mcrit: 0.03, stagger: 30 },
  proc: { chance: 0.04, cd: 2, act: 'strike', mul: 1.2, aoe: 120, vis: 'nova', name: '巨锤！', desc: '攻击时 4% 几率震地：周围敌人受到 120% 伤害（冷却 2 秒）。' },
  desc: '用巨人歌利亚的战锤锤头改成的手炮，炮口就开在锤面上。（本作原创）' });
EP('ep_bg_graveward', { wtype: 'bowgun', lvl: 34, name: '墓园守夜人', fx: { dmgUp: 0.09, dark: 25, crit: 0.03, mcrit: 0.03 },
  proc: { on: 'kill', chance: 0.3, act: 'heal', hp: 0.02, name: '守夜', desc: '击杀敌人时 30% 几率恢复 2% HP。' },
  desc: '暗精灵墓地的守墓人留下的弩，弩前挂着一盏长明灯。（本作原创）' });

/* ---------------- Lv38 原创（暗黑城深渊专属） ---------------- */
EP('ep_rv_plague', { wtype: 'revolver', lvl: 38, name: '瘟疫医生', fx: { dmgUp: 0.12, dark: 27, crit: 0.04, mcrit: 0.04 },
  proc: [{ chance: 0.06, act: 'status', status: 'poison', dur: 5, dps: 0.12, name: '疫弹', desc: '攻击时 6% 几率让敌人中毒 5 秒，' },
    { vs: 'poison', chance: 0.12, cd: 1.5, act: 'strike', mul: 1.9, aoe: 130, elem: 'dark', vis: 'dark', col: '#c8c070', name: '瘟疫爆发！', desc: '攻击中毒的敌人时 12% 几率引爆瘟疫：周围敌人受到 190% 暗属性伤害（冷却 1.5 秒）。' }],
  desc: '诺伊佩拉的瘟疫医生到最后也没放下这把枪，鸟嘴面具上的红镜片至今还盯着病人。（本作原创）' });
EP('ep_ap_soullantern', { wtype: 'autopistol', lvl: 38, name: '冥灯-引魂者', fx: { dmgUp: 0.12, ice: 27, crit: 0.04, mcrit: 0.04 },
  proc: { on: 'crit', chance: 0.1, cd: 1.5, act: 'strike', mul: 1.9, aoe: 120, elem: 'ice', vis: 'ice', col: '#9fd8ff', name: '引魂！', desc: '暴击时 10% 几率放出冥灯里的鬼火：周围敌人受到 190% 冰属性伤害（冷却 1.5 秒）。' },
  desc: '暗黑城的引魂人提着的冥灯，灯里的蓝火从来不会熄。（本作原创）' });
EP('ep_rf_bloodmoon', { wtype: 'rifle', lvl: 38, name: '血月猎手', fx: { dmgUp: 0.12, fire: 27, crit: 0.04, mcrit: 0.04 },
  proc: { chance: 0.05, cd: 1.5, act: 'strike', mul: 2.0, elem: 'fire', vis: 'fire', col: '#ff5a4a', name: '血月！', desc: '攻击时 5% 几率射出血月之弹（200% 火属性伤害，冷却 1.5 秒）。' },
  desc: '只在血月之夜狩猎的猎人，枪上的红月会随着月相盈亏。（本作原创）' });
EP('ep_hc_cathedral', { wtype: 'handcannon', lvl: 38, name: '血色圣堂', fx: { dmgUp: 0.12, light: 27, crit: 0.04, mcrit: 0.04, stagger: 30 },
  proc: { chance: 0.05, cd: 1.5, act: 'strike', mul: 1.9, aoe: 150, elem: 'light', vis: 'holy', col: '#ffb0a0', name: '圣堂钟鸣！', desc: '攻击时 5% 几率降下圣光：周围敌人受到 190% 光属性伤害（冷却 1.5 秒）。' },
  desc: '诺伊佩拉大圣堂的尖塔被瘟疫染红之后，有人把它铸成了一门手炮。（本作原创）' });
EP('ep_bg_spiderqueen', { wtype: 'bowgun', lvl: 38, name: '毒蛛女王', fx: { dmgUp: 0.12, dark: 27, crit: 0.04, mcrit: 0.04 },
  proc: [{ chance: 0.06, act: 'status', status: 'poison', dur: 5, dps: 0.12, name: '蛛毒', desc: '攻击时 6% 几率让敌人中毒 5 秒，' },
    { vs: 'poison', chance: 0.12, cd: 1.5, act: 'strike', mul: 1.85, aoe: 110, vis: 'dark', col: '#c070ff', name: '毒蛛之吻！', desc: '攻击中毒的敌人时 12% 几率追加 185% 伤害（小范围，冷却 1.5 秒）。' }],
  desc: '蜘蛛洞穴最深处的女王，八条腿化成了弩臂。（本作原创）' });

/* ---------------- Lv45 原创（牛头 / 根特外围普通掉落） ---------------- */
EP('ep_rv_glacier', { wtype: 'revolver', lvl: 45, name: '冰川执法者', fx: { dmgUp: 0.1, ice: 30, critDmg: 0.13 },
  proc: [{ chance: 0.04, act: 'status', status: 'freeze', dur: 1.5, name: '冰封', desc: '攻击时 4% 几率冰冻敌人 1.5 秒，' }, { vs: 'freeze', act: 'extra', frac: 0.15, desc: '攻击冰冻中的敌人时附加 15% 伤害。' }],
  desc: '万年雪山的执法官配枪，冰晶枪管在极寒里反而更坚硬。（本作原创）' });
EP('ep_ap_gear', { wtype: 'autopistol', lvl: 45, name: '机械之心-齿轮', fx: { dmgUp: 0.1, fire: 30, critDmg: 0.13 },
  proc: { combo: 15, chance: 0.12, cd: 2, act: 'strike', mul: 1.8, vis: 'bolt', col: '#ffc070', name: '过载！', desc: '连击数达到 15 时，攻击有 12% 几率让齿轮过载：追加 180% 伤害（冷却 2 秒）。' },
  desc: '比尔马克试验场流出来的样品，齿轮转得越快，子弹越狠。（本作原创）' });
EP('ep_rf_snowhunter', { wtype: 'rifle', lvl: 45, name: '雪原猎手', fx: { dmgUp: 0.1, ice: 30, critDmg: 0.13 },
  proc: { on: 'crit', chance: 0.08, cd: 1.5, act: 'strike', mul: 1.85, elem: 'ice', vis: 'ice', name: '雪原猎杀！', desc: '暴击时 8% 几率追加 185% 冰属性伤害（冷却 1.5 秒）。' },
  desc: '雪原上的猎人只开一枪。（本作原创）' });
EP('ep_hc_ironbull', { wtype: 'handcannon', lvl: 45, name: '钢铁牛魔炮', fx: { dmgUp: 0.1, fire: 30, critDmg: 0.12 },
  proc: { chance: 0.05, cd: 2, act: 'strike', mul: 1.9, aoe: 140, elem: 'fire', vis: 'fire', name: '牛魔烈焰！', desc: '攻击时 5% 几率喷出牛魔烈焰：周围敌人受到 190% 火属性伤害（冷却 2 秒）。' },
  desc: '仿照牛头械王打造的手炮，炮口的牛头会跟着开火一起怒吼。（本作原创）' });
EP('ep_bg_icestring', { wtype: 'bowgun', lvl: 45, name: '冰晶之弦', fx: { dmgUp: 0.1, ice: 30, critDmg: 0.12 },
  proc: [{ chance: 0.06, act: 'status', status: 'slow', dur: 4, name: '霜冻', desc: '攻击时 6% 几率冻伤敌人（减速 4 秒），' }, { vs: 'slow', act: 'extra', frac: 0.14, desc: '攻击减速中的敌人时附加 14% 伤害。' }],
  desc: '冰雪宫殿的冰晶磨成的弩臂，弦一拉开，四周就开始下雪。（本作原创）' });

/* ---------------- Lv48 原创（根特、悲鸣洞穴普通掉落；神枪手 60 版 Lv50 史诗名单没查到，用原创补） ---------------- */
EP('ep_rv_gendarme', { wtype: 'revolver', lvl: 48, name: '根特宪兵', fx: { dmgUp: 0.11, dark: 30, critDmg: 0.14 },
  proc: { on: 'crit', chance: 0.08, cd: 1.5, act: 'strike', mul: 1.9, vis: 'slash', col: '#ffd070', name: '执法射击！', desc: '暴击时 8% 几率追加一发执法射击（190% 伤害，冷却 1.5 秒）。' },
  desc: '根特宪兵队的制式左轮，枪柄上挂着红金色的绶带。（本作原创）' });
EP('ep_ap_bulwark', { wtype: 'autopistol', lvl: 48, name: '防线守望者', fx: { dmgUp: 0.11, light: 30, critDmg: 0.13 },
  proc: [{ on: 'hurt', chance: 0.2, cd: 10, act: 'shield', amt: 0.08, dur: 5, name: '守望', desc: '被击时 20% 几率获得 8% HP 上限的护盾（5 秒，冷却 10 秒）；' },
    { on: 'crit', chance: 0.08, cd: 1.5, act: 'strike', mul: 1.8, elem: 'light', vis: 'holy', name: '守望之光！', desc: '暴击时 8% 几率追加 180% 光属性伤害（冷却 1.5 秒）。' }],
  desc: '根特城墙上的皇家卫队配枪，直到城门被攻破都没有停过火。（本作原创）' });
EP('ep_rf_beacon', { wtype: 'rifle', lvl: 48, name: '烽火之眼', fx: { dmgUp: 0.11, fire: 30, critDmg: 0.14 },
  proc: { on: 'crit', chance: 0.08, cd: 1.5, act: 'strike', mul: 1.9, aoe: 120, elem: 'fire', vis: 'fire', name: '烽火！', desc: '暴击时 8% 几率点燃烽火：周围敌人受到 190% 火属性伤害（冷却 1.5 秒）。' },
  desc: '根特东门烽火台上架着的步枪，瞄准镜里映着火光。（本作原创）' });
EP('ep_hc_siege', { wtype: 'handcannon', lvl: 48, name: '攻城塔-破门', fx: { dmgUp: 0.11, fire: 30, critDmg: 0.14 },
  proc: [{ chance: 0.03, act: 'debuff', taken: 0.12, dur: 6, key: 'siege', vis: 'nova', col: '#ffc070', name: '破门！', desc: '攻击时 3% 几率破开防线：目标受到的伤害 +12%，持续 6 秒；' },
    { chance: 0.05, cd: 2, act: 'strike', mul: 1.8, aoe: 150, vis: 'fire', name: '攻城炮！', desc: '5% 几率轰出攻城炮：周围敌人受到 180% 伤害（冷却 2 秒）。' }],
  desc: '根特防御战里从城墙上拆下来的炮塔，被改成了单手也扛得动的手炮。（本作原创）' });
EP('ep_bg_hivesting', { wtype: 'bowgun', lvl: 48, name: '虫后之刺', fx: { dmgUp: 0.11, crit: 0.04, mcrit: 0.04, critDmg: 0.12 },
  proc: [{ chance: 0.06, act: 'status', status: 'poison', dur: 5, dps: 0.14, name: '虫毒', desc: '攻击时 6% 几率让敌人中毒 5 秒，' }, { vs: 'poison', act: 'extra', frac: 0.15, desc: '攻击中毒的敌人时附加 15% 伤害。' }],
  desc: '悲鸣洞穴里虫后的毒刺，射进去就拔不出来。（本作原创）' });

/* ---------------- 搬家：官方物品回到官方等级 ---------------- */
// 60 版 Lv50：无头之魂（官方是无头骑士的领主神器，本作保持史诗）
MV('ep_bg_headless', { lvl: 50, fx: { dmgUp: 0.11, dark: 30, aspd: 0.06 },
  proc: { on: 'crit', chance: 0.08, cd: 1.5, act: 'strike', mul: 1.9, aoe: 130, elem: 'dark', vis: 'dark', col: '#ff9a3c', name: '无头骑士的怒吼！', desc: '暴击时 8% 几率唤来无头骑士的怨魂：周围敌人受到 190% 暗属性伤害（冷却 1.5 秒）。' },
  desc: '无头骑士留下的手弩，弩臂像一件破烂的披风。（官方 60 版 Lv50：无头骑士的领主神器；本作是 Lv50 史诗，无头骑士掉落）' });
// 60 版 Lv55
MV('ep_rv_enazma', { lvl: 55, fx: { dmgUp: 0.11, crit: 0.05, mcrit: 0.05, critDmg: 0.12 },
  proc: [{ chance: 0.08, act: 'status', status: 'bleed', dur: 5, dps: 0.15, name: '双刃撕裂', desc: '攻击时 8% 几率使敌人出血 5 秒，' }, { vs: 'bleed', act: 'extra', frac: 0.15, desc: '攻击出血中的敌人时附加 15% 伤害。' }],
  desc: '枪管上下各装一片弯刃，贴身也能把敌人撕开。（官方 60 版 Lv55 史诗左轮枪）' });
MV('ep_rv_sunset', { lvl: 55, fx: { dmgUp: 0.11, light: 32, crit: 0.05, mcrit: 0.05 },
  proc: [{ chance: 0.015, act: 'cut', cut: 0.3, boss: false, name: '夕阳！', desc: '攻击时 1.5% 几率削减敌人 30% 的当前 HP（对领主无效）；' },
    { on: 'crit', chance: 0.08, cd: 1.5, act: 'strike', mul: 1.9, elem: 'light', vis: 'holy', col: '#ffb870', name: '落日！', desc: '暴击时 8% 几率追加 190% 光属性伤害（冷却 1.5 秒）。' }],
  desc: '夕阳下的最后一枪，从不落空。（官方 60 版 Lv55 史诗左轮枪）' });
MV('ep_ap_flash', { lvl: 55, fx: { dmgUp: 0.11, aspd: 0.08, crit: 0.05, mcrit: 0.05 },
  proc: { on: 'crit', chance: 0.08, cd: 10, act: 'buff', buff: { aspd: 0.12, dmg: 0.08 }, dur: 6, key: 'flash', name: '闪！', col: '#9fe3ff', desc: '暴击时 8% 几率进入“闪”状态：6 秒内攻击速度 +12%、伤害 +8%（冷却 10 秒）。' },
  desc: '被称作“枪械之神”的传奇枪匠的作品，快得只剩一道闪光。（官方 60 版 Lv55 史诗自动手枪）' });
MV('ep_ap_viper', { lvl: 55, fx: { dmgUp: 0.12, aspd: 0.05, crit: 0.04, mcrit: 0.04 },
  proc: [{ chance: 0.07, act: 'status', status: 'poison', dur: 5, dps: 0.15, name: '蝮蛇之毒', desc: '攻击时 7% 几率让敌人中毒 5 秒，' }, { vs: 'poison', act: 'extra', frac: 0.14, desc: '攻击中毒的敌人时附加 14% 伤害。' }],
  desc: '贴身开火时威力惊人。（官方 60 版 Lv55 史诗自动手枪）' });
MV('ep_rf_death', { lvl: 55, fx: { dmgUp: 0.11, dark: 30, critDmg: 0.18, hit: 0.03 },
  proc: { on: 'crit', chance: 0.1, act: 'extra', frac: 0.1, exec: 0.3, name: '死亡宣告', desc: '暴击时 10% 几率附加伤害：目标 HP 越低越高（10%~40%）。' },
  desc: '瞄准镜里的人，没有一个活下来。（官方 60 版 Lv55 史诗步枪）' });
MV('ep_rf_howl', { lvl: 55, fx: { dmgUp: 0.12, critDmg: 0.12, stagger: 30 },
  proc: [{ chance: 0.05, act: 'status', status: 'stun', dur: 1, name: '戾啸', desc: '攻击时 5% 几率用枪声震慑敌人（眩晕 1 秒）；' },
    { chance: 0.05, cd: 1.5, act: 'strike', mul: 1.8, aoe: 140, vis: 'nova', col: '#8fe0d0', name: '狼啸！', desc: '5% 几率发出狼啸：周围敌人受到 180% 伤害（冷却 1.5 秒）。' }],
  desc: '开火时枪口会发出狼一样的啸声。（官方 60 版 Lv55 史诗步枪）' });
MV('ep_hc_meteor', { lvl: 55, fx: { dmgUp: 0.11, fire: 32, critDmg: 0.12, stagger: 40 },
  proc: { chance: 0.06, cd: 1.5, act: 'strike', mul: 2.0, aoe: 150, elem: 'fire', vis: 'fire', name: '双陨星！', desc: '攻击时 6% 几率引爆双陨星：对周围敌人造成 200% 火属性伤害（冷却 1.5 秒）。' },
  desc: '两根炮管同时开火，像两颗陨星一起坠地。（官方 60 版 Lv55 史诗手炮）' });
MV('ep_hc_breaker', { lvl: 55, fx: { dmgUp: 0.12, critDmg: 0.14, stagger: 40 },
  desc: '一炮就能掀掉巨人的盔甲。（官方 60 版 Lv55 史诗手炮）' });
MV('ep_bg_red', { lvl: 55, fx: { dmgUp: 0.05, fire: 30, atkElem: 'fire', aspd: 0.05 },
  proc: [{ chance: 0.05, act: 'status', status: 'burn', dur: 4, dps: 0.14, vis: 'fire', name: '爆炎', desc: '火属性攻击；攻击时 5% 几率使敌人灼伤 4 秒，' }, { vs: 'burn', act: 'extra', frac: 0.14, desc: '攻击灼伤中的敌人时附加 14% 伤害。' }],
  desc: '赤帝的火焰凝成了箭矢。（官方 60 版 Lv55 史诗手弩）' });
// 70 版 Lv60（T1）：深渊专属的几件改成普通掉落（时空之门后段、希洛克）
MV('ep_rv_bone', { lvl: 60, tier: 1, fx: { dmgUp: 0.12, ice: 35, critDmg: 0.16 },
  proc: [{ chance: 0.02, cd: 20, act: 'buff', buff: { aspd: 0.15, dmg: 0.1 }, dur: 20, key: 'bone', name: '刺骨', col: '#bfe8ff', desc: '攻击时 2% 几率进入刺骨状态：20 秒内攻速 +15%、伤害 +10%（冷却 20 秒）；' },
    { on: 'crit', chance: 0.08, cd: 1.5, act: 'strike', mul: 2.1, elem: 'ice', vis: 'ice', name: '彻骨！', desc: '暴击时 8% 几率追加 210% 冰属性伤害（冷却 1.5 秒）。' }],
  desc: '子弹带着彻骨的寒意。（官方 70 版 Lv60 史诗左轮枪）' });
MV('ep_ap_heckler', { lvl: 60, tier: 1, abyss: false, fx: { dmgUp: 0.05, fire: 25, atkElem: 'fire', critDmg: 0.1 },
  proc: [{ chance: 0.06, act: 'status', status: 'burn', dur: 4, dps: 0.15, name: '灼伤', desc: '火属性攻击；攻击时 6% 几率使敌人灼伤，' }, { vs: 'burn', act: 'extra', frac: 0.16, desc: '攻击灼伤中的敌人时附加 16% 伤害。' }],
  desc: '枪管永远是烫的。（官方 70 版 Lv60 史诗自动手枪）' });
MV('ep_rf_zombie', { lvl: 60, tier: 1, abyss: false, fx: { dmgUp: 0.05, ice: 25, atkElem: 'ice', crit: 0.03, mcrit: 0.03 },
  proc: [{ chance: 0.04, act: 'status', status: 'freeze', dur: 1.8, name: '冰冻', desc: '冰属性攻击；攻击时 4% 几率冰冻敌人 1.8 秒，' }, { vs: 'freeze', act: 'extra', frac: 0.18, desc: '攻击冰冻中的敌人时附加 18% 伤害。' }],
  desc: '专为猎杀僵尸打造，子弹里灌了冰晶。（官方 70 版 Lv60 史诗步枪）' });
MV('ep_hc_aqua', { lvl: 60, tier: 1, fx: { dmgUp: 0.09, ice: 35, hpPct: 0.06, dmgReduce: 0.03 },
  proc: [{ on: 'hurt', chance: 0.2, cd: 12, act: 'shield', amt: 0.12, dur: 6, name: '圣水护盾', desc: '被击时 20% 几率获得 12% HP 上限的护盾（6 秒，冷却 12 秒）；' },
    { on: 'crit', chance: 0.08, cd: 1.5, act: 'strike', mul: 2.0, aoe: 130, elem: 'ice', vis: 'ice', name: '圣水倾泻！', desc: '暴击时 8% 几率倾倒圣水：周围敌人受到 200% 冰属性伤害（冷却 1.5 秒）。' }],
  desc: '炮口雕着一只倾倒圣水的宝瓶。（官方 70 版 Lv60 史诗手炮）' });
MV('ep_bg_satan', { lvl: 60, tier: 1, abyss: false, fx: { dmgUp: 0.09, dark: 35, aspd: 0.05 },
  proc: [{ chance: 0.05, act: 'status', status: 'slow', dur: 4, name: '诅咒', desc: '攻击时 5% 几率诅咒敌人（减速 4 秒），' }, { vs: 'slow', act: 'extra', frac: 0.18, desc: '攻击被诅咒的敌人时附加 18% 伤害。' }],
  desc: '扣下扳机的那一刻，你就已经被诱惑了。（官方 70 版 Lv60 史诗手弩）' });
// 80 版 Lv70 → 本作 Lv60 T3（时空之门深渊专属 + 攻坚低概率）
MV('ep_rv_python', { lvl: 60, tier: 3, fx: { dmgUp: 0.15, light: 40, critDmg: 0.18 },
  proc: [{ on: 'skill', chance: 0.2, act: 'reset', name: '无冷却！', desc: '施放技能时 20% 几率立即重置这个技能的冷却；' },
    { on: 'crit', chance: 0.08, cd: 1.5, act: 'strike', mul: 2.6, aoe: 150, elem: 'light', vis: 'holy', col: '#ffd84a', name: '金蟒噬咬！', desc: '暴击时 8% 几率唤出金蟒：周围敌人受到 260% 光属性伤害（冷却 1.5 秒）。' }],
  desc: '黄金打造的蟒蛇左轮，据说有 33% 的几率……不对，这里是 20%。（官方 80 版 Lv70 史诗左轮枪；本作 Lv60 T3）' });
MV('ep_hc_wing', { lvl: 60, tier: 3, fx: { dmgUp: 0.15, light: 40, critDmg: 0.18 },
  proc: [{ on: 'crit', chance: 0.08, cd: 1.5, act: 'strike', mul: 2.7, aoe: 160, elem: 'light', vis: 'holy', name: '翼弹！', desc: '暴击时 8% 几率发射光之翼弹：周围敌人受到 270% 光属性伤害（冷却 1.5 秒）；' },
    { on: 'skill', chance: 0.1, cd: 15, act: 'buff', buff: { dmg: 0.1 }, dur: 10, key: 'wing', col: '#fff2b0', name: '天使祝福', desc: '施放技能时 10% 几率获得天使祝福：10 秒内伤害 +10%（冷却 15 秒）。' }],
  desc: '祭典上鸣放的礼炮，每一发都带着光之羽翼。（官方 80 版 Lv70 史诗手炮；本作 Lv60 T3）' });

/* ---------------- 官方新增：70 版 Lv60（T1）/ 官方 Lv65（T2）/ 80 版 Lv70（T3） ---------------- */
EP('ep_rv_belit', { wtype: 'revolver', lvl: 60, tier: 1, name: '贝利特印痕左轮枪', fx: { dmgUp: 0.12, dark: 35, critDmg: 0.16 },
  proc: { on: 'crit', chance: 0.08, cd: 1.5, act: 'strike', mul: 2.1, aoe: 130, elem: 'dark', vis: 'dark', col: '#e8b860', name: '沙影印痕！', desc: '暴击时 8% 几率留下沙影印痕：周围敌人受到 210% 暗属性伤害（冷却 1.5 秒）。' },
  desc: '沙影贝利特在时空的缝隙里留下的印痕，被刻进了这把左轮的枪身。（官方 70 版 Lv60 史诗左轮枪）' });
EP('ep_bg_tianxuan', { wtype: 'bowgun', lvl: 60, tier: 1, name: '天轩之湮魄', fx: { dmgUp: 0.12, light: 35, critDmg: 0.16 },
  proc: { on: 'crit', chance: 0.08, cd: 1.5, act: 'strike', mul: 2.1, elem: 'light', vis: 'holy', col: '#bff4ff', name: '湮魄！', desc: '暴击时 8% 几率射出湮魄之矢：追加 210% 光属性伤害（冷却 1.5 秒）。' },
  desc: '天轩与无轩两位工匠留下的杰作之一，弩前的魂珠能吞下敌人的魂魄。（官方 70 版 Lv60 史诗手弩）' });
EP('ep_rv_firesnake', { wtype: 'revolver', lvl: 60, tier: 2, name: '终极火蛇', fx: { dmgUp: 0.13, fire: 35, critDmg: 0.17 },
  proc: { on: 'crit', chance: 0.08, cd: 1.5, act: 'strike', mul: 2.3, aoe: 140, elem: 'fire', vis: 'fire', name: '火蛇！', desc: '暴击时 8% 几率放出火蛇：周围敌人受到 230% 火属性伤害（冷却 1.5 秒）。' },
  desc: '火蛇系列左轮的最终型，枪身像一条烧红的蛇。（官方 Lv65 史诗左轮枪；本作 Lv60 T2）' });
EP('ep_ap_energy', { wtype: 'autopistol', lvl: 60, tier: 2, name: '麦加的能量手枪', fx: { dmgUp: 0.13, light: 35, critDmg: 0.17 },
  proc: { on: 'crit', chance: 0.08, cd: 1.5, act: 'strike', mul: 2.3, elem: 'light', vis: 'bolt', col: '#7fd0ff', name: '能量过载！', desc: '暴击时 8% 几率释放能量核心：追加 230% 光属性伤害（冷却 1.5 秒）。' },
  desc: '天才枪匠麦加用能量核心代替了火药。（官方 Lv65 史诗自动手枪；本作 Lv60 T2）' });
EP('ep_rf_mechgod', { wtype: 'rifle', lvl: 60, tier: 2, name: '机械战神的战斗步枪', fx: { dmgUp: 0.13, fire: 35, critDmg: 0.17 },
  proc: { on: 'crit', chance: 0.08, cd: 1.5, act: 'strike', mul: 2.3, aoe: 140, vis: 'bolt', col: '#ffb060', name: '战神炮击！', desc: '暴击时 8% 几率发动战神炮击：周围敌人受到 230% 伤害（冷却 1.5 秒）。' },
  desc: '机械战神的制式装备，两根枪管会轮流开火。（官方 Lv65 史诗步枪；本作 Lv60 T2）' });
EP('ep_hc_dragon', { wtype: 'handcannon', lvl: 60, tier: 2, name: '奇迹之巨龙手炮', fx: { dmgUp: 0.13, fire: 35, critDmg: 0.17, stagger: 40 },
  proc: { chance: 0.06, cd: 1.5, act: 'strike', mul: 2.4, aoe: 160, elem: 'fire', vis: 'fire', name: '巨龙吐息！', desc: '攻击时 6% 几率喷出龙息：周围敌人受到 240% 火属性伤害（冷却 1.5 秒）。' },
  desc: '炮身是一只张开大嘴的巨龙，开火时喉咙里亮得像熔炉。（官方 Lv65 史诗手炮；本作 Lv60 T2）' });
EP('ep_bg_doom', { wtype: 'bowgun', lvl: 60, tier: 2, name: '末日惩戒', fx: { dmgUp: 0.13, dark: 35, critDmg: 0.17 },
  proc: { on: 'crit', chance: 0.08, cd: 1.5, act: 'strike', mul: 2.3, aoe: 140, elem: 'dark', vis: 'dark', name: '末日惩戒！', desc: '暴击时 8% 几率降下末日惩戒：周围敌人受到 230% 暗属性伤害（冷却 1.5 秒）。' },
  desc: '处刑人的两把巨刃做成了弩臂。（官方 Lv65 史诗手弩；本作 Lv60 T2）' });
EP('ep_ap_reaper', { wtype: 'autopistol', lvl: 60, tier: 3, name: '沙漠死神', fx: { dmgUp: 0.15, dark: 40, critDmg: 0.18 },
  proc: [{ on: 'crit', chance: 0.08, cd: 1.5, act: 'strike', mul: 2.6, aoe: 150, elem: 'dark', vis: 'dark', col: '#e8c070', name: '死神之镰！', desc: '暴击时 8% 几率挥出死神之镰：周围敌人受到 260% 暗属性伤害（冷却 1.5 秒）；' },
    { on: 'kill', chance: 0.3, act: 'heal', hp: 0.02, desc: '击杀敌人时 30% 几率恢复 2% HP。' }],
  desc: '沙漠里的旅人最怕听见的，是死神的枪声。（官方 80 版 Lv70 史诗自动手枪；本作 Lv60 T3）' });
EP('ep_rf_ninedragon', { wtype: 'rifle', lvl: 60, tier: 3, name: '九龙破煞步枪', fx: { dmgUp: 0.15, fire: 40, critDmg: 0.18 },
  proc: [{ on: 'crit', chance: 0.08, cd: 1.5, act: 'strike', mul: 2.7, aoe: 160, elem: 'fire', vis: 'fire', col: '#ffd070', name: '九龙破煞！', desc: '暴击时 8% 几率放出九龙：周围敌人受到 270% 火属性伤害（冷却 1.5 秒）；' },
    { chance: 0.03, act: 'debuff', taken: 0.12, dur: 6, key: 'ninedragon', vis: 'nova', col: '#ffd070', name: '破煞！', desc: '攻击时 3% 几率破煞：目标受到的伤害 +12%，持续 6 秒。' }],
  desc: '九条金龙盘在枪身上，枪口的龙珠专破邪煞。（官方 80 版 Lv70 史诗步枪；本作 Lv60 T3）' });
EP('ep_bg_sky', { wtype: 'bowgun', lvl: 60, tier: 3, name: '苍穹惩戒者', fx: { dmgUp: 0.15, ice: 40, critDmg: 0.18 },
  proc: [{ on: 'crit', chance: 0.08, cd: 1.5, act: 'strike', mul: 2.6, aoe: 150, elem: 'ice', vis: 'holy', col: '#bfe4ff', name: '苍穹惩戒！', desc: '暴击时 8% 几率降下苍穹之矢：周围敌人受到 260% 冰属性伤害（冷却 1.5 秒）；' },
    { chance: 0.03, act: 'debuff', taken: 0.1, dur: 6, key: 'sky', vis: 'nova', col: '#bfe4ff', name: '惩戒印记', desc: '攻击时 3% 几率留下惩戒印记：目标受到的伤害 +10%，持续 6 秒。' }],
  desc: '天空本身降下的惩戒。（官方 80 版 Lv70 史诗手弩；本作 Lv60 T3）' });

/* ---------------- 领主神器 / 60 版 Lv55 粉装（只在对应怪物身上掉；拿在手里用 <类型>_r3 外观） ---------------- */
const NM = (key, lord, def, p = 0.02) => { defineNamed(key, { slot: 'weapon', lord, ...def }); monDrop(lord, [[key, p]]); };
NM('nm_hc_seghart', 'seghart', { wtype: 'handcannon', lvl: 23, name: '精铸的流光异体加农炮', fx: { dmgUp: 0.05, light: 18 },
  proc: { chance: 0.04, cd: 2, act: 'strike', mul: 1.3, aoe: 110, elem: 'light', vis: 'holy', name: '流光！', desc: '攻击时 4% 几率发射流光炮弹：周围敌人受到 130% 光属性伤害（冷却 2 秒）。' },
  desc: '光之城主赛格哈特的异体加农炮，经过重新精铸。（官方：赛格哈特的领主神器；本作城主宫殿的赛格哈特掉落）' });
NM('nm_bg_lotus', 'lotus', { wtype: 'bowgun', lvl: 30, name: '魂灵手弩', fx: { dmgUp: 0.06, dark: 20 },
  proc: { on: 'crit', chance: 0.06, cd: 1.5, act: 'strike', mul: 1.4, elem: 'dark', vis: 'dark', name: '魂灵！', desc: '暴击时 6% 几率射出魂灵之矢（140% 暗属性伤害，冷却 1.5 秒）。' },
  desc: '长脚罗特斯吞下的冒险者留下的手弩，弩臂上缠着一缕魂灵。（官方：罗特斯的领主神器；本作第二脊椎的长脚罗特斯掉落）' });
NM('nm_ap_spiz', 'spiz', { wtype: 'autopistol', lvl: 34, name: '硫云石手枪', fx: { dmgUp: 0.06, fire: 20 },
  proc: { chance: 0.04, act: 'status', status: 'burn', dur: 3, dps: 0.1, name: '硫火', desc: '攻击时 4% 几率使敌人灼伤 3 秒。' },
  desc: '用邪龙巢穴里的硫云石打磨的手枪。（官方：邪龙斯皮兹的领主神器；本作暗精灵墓地的斯皮兹掉落）' });
NM('nm_rv_suleide', 'suleide', { wtype: 'revolver', lvl: 50, name: '改良的银光枪', fx: { dmgUp: 0.07, crit: 0.03, mcrit: 0.03 },
  proc: { on: 'crit', chance: 0.06, cd: 1.5, act: 'strike', mul: 1.5, vis: 'bolt', col: '#cfe8ff', name: '银光！', desc: '暴击时 6% 几率追加 150% 伤害（冷却 1.5 秒）。' },
  desc: '机动队长苏雷德亲手改良的配枪。（官方：苏雷德的领主神器；本作根特东门的苏雷德掉落）' });
NM('nm_ap_gt9600', 'gt9600', { wtype: 'autopistol', lvl: 52, name: 'GT-9600机械自动枪', fx: { dmgUp: 0.07, aspd: 0.06 },
  proc: { combo: 10, chance: 0.1, cd: 2, act: 'strike', mul: 1.5, vis: 'bolt', name: '扫射！', desc: '连击数达到 10 时，攻击有 10% 几率追加 150% 伤害（冷却 2 秒）。' },
  desc: '从 GT-9600 的机械臂上拆下来的自动枪。（官方：GT-9600 的领主神器；本作根特南门的 GT-9600 掉落）' });
NM('nm_rv_duke', 'cerberus', { wtype: 'revolver', lvl: 55, name: '毁灭公爵', fx: { dmgUp: 0.08, dark: 24 },
  proc: { on: 'crit', chance: 0.06, cd: 1.5, act: 'strike', mul: 1.6, elem: 'dark', vis: 'dark', name: '毁灭！', desc: '暴击时 6% 几率追加 160% 暗属性伤害（冷却 1.5 秒）。' },
  desc: '一位没落公爵的决斗左轮。（官方 60 版 Lv55 神器左轮枪；本作绝密区域的地狱三头犬掉落）' });
NM('nm_ap_curio', 'mobeni', { wtype: 'autopistol', lvl: 55, name: '库里欧的传承', fx: { dmgUp: 0.08, critDmg: 0.1 },
  proc: { on: 'crit', chance: 0.08, cd: 12, act: 'buff', buff: { aspd: 0.08 }, dur: 6, key: 'curio', col: '#ffb4d8', name: '传承', desc: '暴击时 8% 几率 6 秒内攻击速度 +8%（冷却 12 秒）。' },
  desc: '枪匠库里欧一脉相传的手枪。（官方 60 版 Lv55 神器自动手枪；本作列车上的海贼、黑鳞莫贝尼掉落）' });
NM('nm_rf_dawn', 'anzu', { wtype: 'rifle', lvl: 55, name: '黎明之瞳', fx: { dmgUp: 0.08, light: 24 },
  proc: { on: 'crit', chance: 0.06, cd: 1.5, act: 'strike', mul: 1.6, elem: 'light', vis: 'holy', name: '黎明！', desc: '暴击时 6% 几率追加 160% 光属性伤害（冷却 1.5 秒）。' },
  desc: '「黎明之眼」安祖·塞弗的狙击步枪。（官方 60 版 Lv55 神器步枪「黎明之眼」，和魔法石重名，本作改名；阿登高地的安祖·塞弗掉落）' });
NM('nm_hc_brood', 'utara', { wtype: 'handcannon', lvl: 55, name: '暴戾冥思者', fx: { dmgUp: 0.08, fire: 24, stagger: 30 },
  proc: { chance: 0.05, cd: 2, act: 'strike', mul: 1.6, aoe: 130, elem: 'fire', vis: 'fire', name: '暴戾！', desc: '攻击时 5% 几率轰出暴戾之炮：周围敌人受到 160% 火属性伤害（冷却 2 秒）。' },
  desc: '冥思越久，开火时越暴戾。（官方 60 版 Lv55 神器手炮；本作格兰之火的兽王乌塔拉掉落）' });
NM('nm_bg_blood', 'nilbas', { wtype: 'bowgun', lvl: 55, name: '血之审判者', fx: { dmgUp: 0.08, crit: 0.03, mcrit: 0.03 },
  proc: { chance: 0.05, act: 'status', status: 'bleed', dur: 4, dps: 0.1, name: '血之审判', desc: '攻击时 5% 几率使敌人出血 4 秒。' },
  desc: '以血为誓的审判者手弩。（官方 60 版 Lv55 神器手弩；本作暗黑圣战的尼尔巴斯·格拉西亚掉落）' });
NM('nm_bg_raid', 'fladin', { wtype: 'bowgun', lvl: 55, name: '野战队长的奇袭手弩', fx: { dmgUp: 0.08, aspd: 0.06 },
  proc: { on: 'crit', chance: 0.06, cd: 1.5, act: 'strike', mul: 1.5, vis: 'slash', name: '奇袭！', desc: '暴击时 6% 几率追加 150% 伤害（冷却 1.5 秒）。' },
  desc: '野战队长奇袭时用的轻便手弩。（官方 60 版 Lv55 神器手弩；本作雾都赫伊斯的范·弗拉丁掉落）' });

/* ---------------- 掉落 / 深渊归属（apply 时生效；1~30 的老掉落表由 B0 自动换成继承装备） ---------------- */
// Lv1~10
gearDrop('dark_woods_deep', [['ep_bg_feather', 0.01]]);
gearDrop('thunder_ruins', [['ep_ap_dawn', 0.008], ['ep_rf_falcon', 0.008]]);
gearDrop('venom_ruins', [['ep_rf_falcon', 0.008], ['ep_hc_firework', 0.01]]);
// Lv34：暗精灵地区；Lv38：暗黑城深渊专属
gearDrop('darkelf_tomb', [['ep_rv_moonshade', 0.01], ['ep_ap_weaver', 0.01]]);
gearDrop('lava_cave', [['ep_rf_magma', 0.01], ['ep_hc_goliath', 0.01]]);
gearDrop('king_ruins', [['ep_bg_graveward', 0.01], ['ep_rv_moonshade', 0.008]]);
gearDrop('darkcity_gate', [['ep_ap_weaver', 0.008], ['ep_rf_magma', 0.008], ['ep_hc_goliath', 0.008], ['ep_bg_graveward', 0.008]]);
abyssClaim('darkelf', ['ep_rv_plague', 'ep_ap_soullantern', 'ep_rf_bloodmoon', 'ep_hc_cathedral', 'ep_bg_spiderqueen']);
// Lv45：牛头械王、堕落的盗贼、哈穆林
gearDrop('fallen_bandits', [['ep_rv_glacier', 0.01], ['ep_rf_snowhunter', 0.01]]);
gearDrop('bilmark', [['ep_ap_gear', 0.01], ['ep_hc_ironbull', 0.01]]);
gearDrop('hamelin', [['ep_bg_icestring', 0.01], ['ep_rv_glacier', 0.008], ['ep_ap_gear', 0.008]]);
// Lv48 / 50：根特、悲鸣洞穴；无头之魂 = 无头骑士（暗黑城入口 / 暗黑城深渊）+ 瘟疫之源的染疫无头骑士
gearDrop('gent_outskirts', [['ep_rv_gendarme', 0.01], ['ep_hc_siege', 0.01]]);
gearDrop('gent_east', [['ep_ap_bulwark', 0.01], ['ep_rf_beacon', 0.01], ['ep_bg_headless', 0.008]]);
gearDrop('wailing_cave', [['ep_bg_hivesting', 0.01], ['ep_rv_gendarme', 0.008], ['ep_rf_beacon', 0.008]]);
monDrop('headlessKnight', [['ep_bg_headless', 0.015]]);
monDrop('plagueHeadless', [['ep_bg_headless', 0.03]]);
// Lv55：海上列车、时空之门前段
gearDrop('sea_pirates', [['ep_rv_enazma', 0.01], ['ep_ap_viper', 0.01]]);
gearDrop('west_line', [['ep_rf_death', 0.01], ['ep_hc_breaker', 0.01]]);
gearDrop('heis', [['ep_rv_sunset', 0.01], ['ep_bg_red', 0.01]]);
gearDrop('grand_fire', [['ep_hc_meteor', 0.01], ['ep_ap_flash', 0.008]]);
gearDrop('plague_source', [['ep_rf_howl', 0.01], ['ep_bg_red', 0.008]]);
gearDrop('holy_war', [['ep_ap_flash', 0.01], ['ep_rv_enazma', 0.008]]);
// Lv60 T1：时空之门后段、希洛克（宝瓶之守护者原本就在痛苦之门）
gearDrop('kartel_origin', [['ep_rv_belit', 0.012]]);
gearDrop('secret_zone', [['ep_ap_heckler', 0.01], ['ep_rv_bone', 0.01]]);
gearDrop('old_wail', [['ep_rf_zombie', 0.01], ['ep_hc_aqua', 0.008]]);
gearDrop('old_winter', [['ep_bg_satan', 0.01], ['ep_bg_tianxuan', 0.01]]);
gearDrop('law_gate', [['ep_rv_bone', 0.008], ['ep_ap_heckler', 0.008]]);
gearDrop('wit_gate', [['ep_rf_zombie', 0.008], ['ep_bg_tianxuan', 0.008], ['ep_rv_belit', 0.008]]);
gearDrop('pain_gate', [['ep_bg_satan', 0.008]]);
// Lv60 T2：攻坚（谜之觉悟、无形棺柩；阿登高地低概率）+ Lv58+ 深渊的随机一半
const T2 = ['ep_rv_firesnake', 'ep_ap_energy', 'ep_rf_mechgod', 'ep_hc_dragon', 'ep_bg_doom'];
gearDrop('iris_raid', T2.map(k => [k, 0.006]));
gearDrop('siroco_coffin', T2.map(k => [k, 0.008]));
gearDrop('arden', T2.map(k => [k, 0.003]));
// Lv60 T3：时空之门深渊专属 + 攻坚 0.3%
const T3 = ['ep_rv_python', 'ep_ap_reaper', 'ep_rf_ninedragon', 'ep_hc_wing', 'ep_bg_sky'];
abyssClaim('timegate', T3);
gearDrop('iris_raid', T3.map(k => [k, 0.003]));
gearDrop('siroco_coffin', T3.map(k => [k, 0.003]));
}
