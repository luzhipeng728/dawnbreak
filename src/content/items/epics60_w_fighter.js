/* =====================================================================
   装备 2.0 · 格斗家武器（手套 knuckle / 拳套 boxing（只有散打）/ 爪 claw / 东方棍 tonfa / 臂铠 gauntlet）——B8 二期：具名史诗 + 领主神器
   只写本块的物品；掉落 / 深渊归属一律用 gear60_api.js 的接口（docs/GEAR_PLAN_60.md §6.1）；清单和数值见 docs/GEAR.md §10.1「格斗家」、审计 docs/FIGHTER_GEAR_AUDIT.md。
   注释只放在行尾或单独一行（一行中间的 // 会吞掉后面的字段）。
   官方名单（国服数据库，2026-09-30 查）：
     dnfziliao.com/item/{shoutao,quantao,zhua,dongfanggun,bikai}.asp（= dnf.db.gamessage.com/item/<同名>.html）：五类武器的史诗 / 神器 / 领主神器和等级
     dnf.17173.com/zt/70zt/60ss-gdj.shtml：70 版 Lv60 史诗（苍穹之尖啸 / 血蝎之尖尾 / 巨象之獠牙 / 英雄之荣耀）的属性和特效
     dnf.52pk.com/jingy/1762971.shtml：60 版 Lv55 史诗（瞬杀 / 极皇拳套 / 泯灭之幽灵…）的特效
     wiki.dfo.world/view/Knuckle、/view/Boxing_Glove：领主神器的英文名（Raging Titan's / Goliath's / Atlas's Fist、Ruger's Ice Gloves）
   官方格斗家武器史诗从 Lv55 开始（国服库里没有 Lv50 的），所以 Lv1~50 全部是本作原创；官方 Lv65 → 本作 Lv60 T2、官方 Lv70 → T3（GEAR_PLAN_60 D1）。
   格斗家没有老的 1~30 史诗（职业是新做的），所以没有搬家 / 继承装备；老存档不受影响。
   属性：两个转职是魔法职业（气功师、街霸），所以力智一起给（手套偏智力、臂铠 / 拳套偏力量），暴击 / 速度也物理魔法都给，四个转职用哪把都不吃亏。
   拿在手里的外观：格斗家的拳上武器按类型画（品级 / 装扮靠换色），具名史诗不另画武器图，而是在物品上登记配色 pal = { main 主色, trim 镶边, glow 光 }，
     渲染层按「<类型>_r4（领主神器 _r3）+ pal 换色」画；还没接配色之前 weaponArtOf 照旧回退到 <类型>_r4 / _r3。图标：art/tools/gear_icons_pink60_fighter.py。
   ===================================================================== */
{
// 史诗的 2 条随机属性按种子固定：抽到力量 / 智力（攻击 +0.4%/点）、暴击、HP、体力会让同级强弱乱掉 → 换种子到没有这几种为止（同 epics60_w_gun.js 的 calm，格斗家两种伤害类型都要看，所以智力也避开）
const calm = (key, def) => { for (let i = 0; i < 60; i++) { const seed = i ? `${key}#${i}` : key, st = gearStats({ kind: 'equip', rar: 5, ...def }, mulberry(keySeed(seed))); if (!st.str && !st.int && !st.crit && !st.hp && !st.vit) return seed; } return key; };
const EP = (key, def) => defineEpic(key, { slot: 'weapon', seed: calm(key, { slot: 'weapon', ...def }), ...def });
const NM = (key, def) => defineNamed(key, { slot: 'weapon', seed: calm(key, { slot: 'weapon', ...def, rar: 3 }), ...def });
const SI = (str, int = str) => ({ str, int });
const P = (main, trim, glow) => ({ main, trim, glow });
const ORIG = '（本作原创）';
// 暴击 / 速度两种都给（魔法职业看魔法暴击 / 施放速度）
const CR = v => ({ crit: v, mcrit: v }), SP = v => ({ aspd: v, cspd: v });

/* ---------------- 1. Lv1~10（每类 1 件） ---------------- */
EP('ep_kn_dawn', { wtype: 'knuckle', lvl: 10, name: '晨练缠手·初心', fx: { dmgUp: 0.05, ...SP(0.05), ...CR(0.02) }, pal: P('#e8dcc0', '#8a5a2a', '#fff0c0'),
  desc: '风振道场的新弟子每天清晨缠上的布手套，缠得越紧，出拳越稳。' + ORIG });
EP('ep_tf_oak', { wtype: 'tonfa', lvl: 6, name: '林卫的橡木棍', fx: { dmgUp: 0.04, hpPct: 0.04, aspd: 0.03 }, pal: P('#8a6a3a', '#5aa04a', '#b8f0a0'),
  desc: '洛兰林卫巡夜用的橡木东方棍，棍身上刻着守护森林的符文。' + ORIG });
EP('ep_bx_redstar', { wtype: 'boxing', lvl: 7, name: '红星拳击手套', fx: { dmgUp: 0.04, ...CR(0.03) }, pal: P('#d83a3a', '#ffd24a', '#ffe070'),
  desc: '赫顿玛尔地下拳场的新人冠军奖品，手背绣着一颗红星。' + ORIG });
EP('ep_cl_goblin', { wtype: 'claw', lvl: 8, name: '哥布林的骨爪', fx: { dmgUp: 0.04, stagger: 20, ...CR(0.02) }, pal: P('#d8c8a0', '#6a8a3a', '#c8e070'),
  desc: '哥布林萨满用野狼骨头磨的爪子，歪歪扭扭，可是很锋利。' + ORIG });
EP('ep_ga_tau', { wtype: 'gauntlet', lvl: 9, name: '牛头兵的铁护臂', fx: { dmgUp: 0.06, critDmg: 0.06, hardness: 20 }, pal: P('#7a7a82', '#8a4a2a', '#ffb070'),
  desc: '从牛头兵身上扒下来的铁护臂，捶一拳牛都要晃三晃。' + ORIG });

/* ---------------- 2. Lv11~20（每类 2 件：Lv14 / Lv18，格兰之森后段 / 天空之城前段的领主） ---------------- */
EP('ep_kn_blaze', { wtype: 'knuckle', lvl: 14, name: '烈焰念珠手套', st: SI(0, 10), fx: { dmgUp: 0.06, fire: 15, cspd: 0.04 }, pal: P('#c83a1a', '#ffb040', '#ff7030'),
  desc: '手背嵌着一串火红的念珠，念气一聚就烧得发烫。' + ORIG });
EP('ep_kn_puppet', { wtype: 'knuckle', lvl: 18, name: '人偶师的丝线手套', fx: { dmgUp: 0.06, ...SP(0.05), ...CR(0.02) }, pal: P('#6a4a8a', '#e0d0ff', '#d8b0ff'),
  proc: { chance: 0.06, cd: 1, act: 'strike', mul: 1.2, vis: 'petal', col: '#d8b0ff', name: '牵丝！', desc: '攻击时 6% 几率扯动丝线：追加 120% 伤害（冷却 1 秒）。' },
  desc: '人偶之王道格里的手套，指尖垂着看不见的丝线，敌人会被扯得踉跄。' + ORIG });
EP('ep_bx_tauking', { wtype: 'boxing', lvl: 14, name: '蛮牛拳套', fx: { dmgUp: 0.06, stagger: 30 }, pal: P('#8a3a1a', '#e8d0a0', '#ff9a50'),
  desc: '用牛头王萨乌塔的皮缝的拳套，戴上以后连呼吸都带着牛劲。' + ORIG });
EP('ep_bx_golem', { wtype: 'boxing', lvl: 18, name: '石巨人之拳', fx: { dmgUp: 0.06, hardness: 20, critDmg: 0.1 }, pal: P('#9a8a6a', '#ffd070', '#ffe0a0'),
  proc: { chance: 0.05, cd: 2, act: 'strike', mul: 1.4, aoe: 100, vis: 'nova', col: '#d8b070', name: '碎岩！', desc: '攻击时 5% 几率砸碎地面：周围敌人受到 140% 伤害（冷却 2 秒）。' },
  desc: '石巨人塔里捡到的一对石拳套，砸下去地面都会裂开。' + ORIG });
EP('ep_cl_dragonkin', { wtype: 'claw', lvl: 14, name: '龙人的逆鳞爪', fx: { dmgUp: 0.05, fire: 10, ...CR(0.03) }, pal: P('#3a8a5a', '#ffb040', '#ff8a4a'),
  desc: '龙人喉下那片逆鳞磨成的利爪，碰一下就会让它发狂。' + ORIG });
EP('ep_cl_bone', { wtype: 'claw', lvl: 18, name: '骨狱魔爪', fx: { dmgUp: 0.06, dark: 15, critDmg: 0.1 }, pal: P('#e8e0d0', '#6a3a8a', '#b070ff'),
  proc: [{ chance: 0.05, act: 'status', status: 'bleed', dur: 4, dps: 0.1, name: '撕裂', desc: '攻击时 5% 几率使敌人出血 4 秒，' }, { vs: 'bleed', act: 'extra', frac: 0.1, desc: '攻击出血中的敌人附加 10% 伤害。' }],
  desc: '盗尸者骨狱息的指骨做成的爪子，划过的伤口久久不愈。' + ORIG });
EP('ep_tf_thunder', { wtype: 'tonfa', lvl: 14, name: '雷鸣东方棍', fx: { dmgUp: 0.05, light: 15, aspd: 0.05 }, pal: P('#3a4a6a', '#ffe060', '#9ad8ff'),
  desc: '暗黑雷鸣废墟的落雷劈过的铁木棍，握柄还在噼啪作响。' + ORIG });
EP('ep_tf_amber', { wtype: 'tonfa', lvl: 18, name: '琥珀东方棍', fx: { dmgUp: 0.06, defPct: 0.04, hpPct: 0.05 }, pal: P('#d89a2a', '#6a4a2a', '#ffd070'),
  proc: { on: 'hurt', chance: 0.1, cd: 15, act: 'shield', amt: 0.12, dur: 6, name: '琥珀护体', desc: '被击时 10% 几率获得护盾：6 秒内吸收最多 12% HP 上限的伤害（冷却 15 秒）。' },
  desc: '黄金巨人普拉塔尼身上敲下的琥珀，里面裹着一只千年前的小虫。' + ORIG });
EP('ep_ga_lava', { wtype: 'gauntlet', lvl: 14, name: '熔岩臂铠', fx: { dmgUp: 0.06, fire: 15, hardness: 20 }, pal: P('#3a2a2a', '#ff6a1a', '#ff9a3a'),
  desc: '在烈焰格拉卡的熔岩里淬过火的臂铠，打出去带着火星。' + ORIG });
EP('ep_ga_bonedragon', { wtype: 'gauntlet', lvl: 18, name: '骨龙臂铠', fx: { dmgUp: 0.07, critDmg: 0.12, stagger: 20 }, pal: P('#d8d0c0', '#3a3a4a', '#9ad0ff'),
  desc: '骨龙的前爪整根装在手臂上，关节一动就咔咔作响。' + ORIG });

/* ---------------- 3. Lv21~30（每类 2 件：Lv24 天空之城 / 天帷巨兽领主，Lv30 天空之城深渊专属） ---------------- */
EP('ep_kn_windbell', { wtype: 'knuckle', lvl: 24, name: '悬空城的风铃手套', st: SI(0, 12), fx: { dmgUp: 0.07, cspd: 0.05, light: 15 }, pal: P('#e8f0ff', '#6ab0e0', '#bfe6ff'),
  proc: { chance: 0.05, cd: 1.5, act: 'strike', mul: 1.5, elem: 'light', vis: 'holy', name: '风铃！', desc: '攻击时 5% 几率摇响风铃：追加 150% 光属性伤害（冷却 1.5 秒）。' },
  desc: '手腕上挂着悬空城的风铃，出拳的时候叮当作响。' + ORIG });
EP('ep_kn_heaven', { wtype: 'knuckle', lvl: 30, name: '天穹念珠·万象', st: SI(5, 30), fx: { dmgUp: 0.12, light: 25, cspd: 0.05, ...CR(0.03) }, pal: P('#f0e0a0', '#ffffff', '#fff0a0'),
  proc: { chance: 0.06, cd: 1.5, act: 'strike', mul: 2.0, aoe: 130, elem: 'light', vis: 'nova', col: '#fff0a0', name: '万象归一！', desc: '攻击时 6% 几率念珠共鸣：周围敌人受到 200% 光属性伤害（冷却 1.5 秒）。' },
  desc: '天空之城深处供奉的念珠，一百零八颗珠子各自映着一片天空。' + ORIG });
EP('ep_bx_champion', { wtype: 'boxing', lvl: 24, name: '天空斗技场的冠军拳套', fx: { dmgUp: 0.07, ...CR(0.03), aspd: 0.04 }, pal: P('#2a5ad8', '#ffd24a', '#8ac8ff'),
  desc: '天空斗技场连赢一百场才能拿到的冠军拳套，蓝底金边，谁见了都要让三分。' + ORIG });
EP('ep_bx_sinfist', { wtype: 'boxing', lvl: 30, name: '罪恶之拳', st: SI(30, 0), fx: { dmgUp: 0.12, dark: 25, critDmg: 0.12 }, pal: P('#3a1a4a', '#c03040', '#ff4a6a'),
  proc: { on: 'crit', chance: 0.1, cd: 1.5, act: 'strike', mul: 2.0, elem: 'dark', vis: 'dark', col: '#ff4a6a', name: '罪恶之拳！', desc: '暴击时 10% 几率追加一拳：200% 暗属性伤害（冷却 1.5 秒）。' },
  desc: '拳套正中睁着一只罪恶之眼，被它盯上的敌人会先软了腿。' + ORIG });
EP('ep_cl_stigma', { wtype: 'claw', lvl: 24, name: 'GBL教的圣痕爪', fx: { dmgUp: 0.07, light: 15, ...CR(0.03) }, pal: P('#e8e0c0', '#c0a040', '#fff2b0'),
  desc: 'GBL教大主教的仪式用爪，三道刃上各刻着一句经文。' + ORIG });
EP('ep_cl_wyvern', { wtype: 'claw', lvl: 30, name: '翼龙之爪', st: SI(20), fx: { dmgUp: 0.12, critDmg: 0.12, ...CR(0.03) }, pal: P('#4a7ac0', '#e0e8f0', '#8ad8ff'),
  proc: [{ chance: 0.06, act: 'status', status: 'bleed', dur: 5, dps: 0.15, name: '撕裂', desc: '攻击时 6% 几率使敌人出血 5 秒，' }, { vs: 'bleed', act: 'extra', frac: 0.15, desc: '攻击出血中的敌人附加 15% 伤害。' }],
  desc: '天空之城的蓝翼龙褪下的爪子，挥起来带着风声。' + ORIG });
EP('ep_tf_vine', { wtype: 'tonfa', lvl: 24, name: '树精的古藤棍', fx: { dmgUp: 0.07, hpPct: 0.06, aspd: 0.05 }, pal: P('#5a7a3a', '#b0e070', '#c8ff90'),
  proc: { chance: 0.05, cd: 8, act: 'heal', hp: 0.04, name: '古藤之息', desc: '攻击时 5% 几率恢复 4% HP（冷却 8 秒）。' },
  desc: '树精丛林的古藤自己缠成的东方棍，折断了还会重新长出来。' + ORIG });
EP('ep_tf_seraph', { wtype: 'tonfa', lvl: 30, name: '圣翼东方棍', st: SI(20), fx: { dmgUp: 0.12, light: 25, aspd: 0.05, defPct: 0.04 }, pal: P('#ffffff', '#ffd24a', '#fff0b0'),
  proc: { chance: 0.05, cd: 1.5, act: 'strike', mul: 2.0, aoe: 130, elem: 'light', vis: 'holy', name: '圣翼！', desc: '攻击时 5% 几率展开圣翼：周围敌人受到 200% 光属性伤害（冷却 1.5 秒）。' },
  desc: '侧柄两边各长着一片白色羽翼，挥动时会洒下光点。' + ORIG });
EP('ep_ga_silverguard', { wtype: 'gauntlet', lvl: 24, name: '光之城卫的圣银臂铠', fx: { dmgUp: 0.07, light: 15, hardness: 30 }, pal: P('#d8e0f0', '#ffd24a', '#fff2b0'),
  desc: '光之城主赛格哈特的近卫臂铠，圣银打造，一尘不染。' + ORIG });
EP('ep_ga_titan', { wtype: 'gauntlet', lvl: 30, name: '泰坦之臂', st: SI(30, 5), fx: { dmgUp: 0.12, fire: 25, critDmg: 0.12, stagger: 30 }, pal: P('#6a3a2a', '#ff8a2a', '#ffb040'),
  proc: { chance: 0.05, cd: 2, act: 'strike', mul: 2.2, aoe: 140, elem: 'fire', vis: 'fire', name: '泰坦之怒！', desc: '攻击时 5% 几率泰坦之怒：周围敌人受到 220% 火属性伤害（冷却 2 秒）。' },
  desc: '据说是远古泰坦留在天空之城的一条手臂，戴上的人力气会大得吓人。' + ORIG });

/* ---------------- 4. Lv34（暗精灵领主）+ Lv38 暗黑城深渊专属 ---------------- */
EP('ep_kn_moonshade', { wtype: 'knuckle', lvl: 34, name: '暗精灵的月影手套', st: SI(20, 55), fx: { dmgUp: 0.11, dark: 26, cspd: 0.04 }, pal: P('#2a2a4a', '#c0c8ff', '#8a8aff'),
  desc: '暗精灵祭司练念用的手套，手背的月牙在黑暗里会发光。' + ORIG });
EP('ep_kn_diregie', { wtype: 'knuckle', lvl: 38, name: '狄瑞吉的毒雾手套', st: SI(15, 50), fx: { dmgUp: 0.11, dark: 28, ...CR(0.03), cspd: 0.04 }, pal: P('#3a5a2a', '#b070ff', '#9ad070'),
  proc: [{ chance: 0.06, act: 'status', status: 'poison', dur: 4, dps: 0.15, vis: 'dark', col: '#9ad070', name: '毒雾', desc: '攻击时 6% 几率放出毒雾（中毒 4 秒），' }, { vs: 'poison', act: 'extra', frac: 0.15, desc: '攻击中毒的敌人附加 15% 伤害。' }],
  desc: '诺伊佩拉的狄瑞吉吐出的毒雾凝在手套上，一握拳就往外冒紫烟。' + ORIG });
EP('ep_bx_spider', { wtype: 'boxing', lvl: 34, name: '蛛后的丝缚拳套', st: SI(50, 0), fx: { dmgUp: 0.11, dark: 25, aspd: 0.04 }, pal: P('#4a2a4a', '#e0e0e0', '#c080ff'),
  desc: '拳套外面缠着蛛后艾克洛索的银丝，打中的敌人会被粘住。' + ORIG });
EP('ep_bx_headless', { wtype: 'boxing', lvl: 38, name: '无头骑士的铁拳', st: SI(50, 0), fx: { dmgUp: 0.11, dark: 28, critDmg: 0.1, ...CR(0.03) }, pal: P('#2a2a30', '#6a8aa0', '#9ad8ff'),
  proc: { chance: 0.05, cd: 1.5, act: 'strike', mul: 1.9, aoe: 130, elem: 'dark', vis: 'dark', col: '#7fb0ff', name: '亡骑冲锋！', desc: '攻击时 5% 几率召来亡灵骑兵：周围敌人受到 190% 暗属性伤害（冷却 1.5 秒）。' },
  desc: '无头骑士的铁手套，里面空空的，却还会自己握拳。' + ORIG });
EP('ep_cl_lava', { wtype: 'claw', lvl: 34, name: '熔岩巨人的焦爪', st: SI(30), fx: { dmgUp: 0.11, fire: 26, ...CR(0.03) }, pal: P('#2a1a1a', '#ff5a1a', '#ff9a3a'),
  desc: '熔岩穴的歌利亚身上剥下的焦黑指甲，刃口还泛着红光。' + ORIG });
EP('ep_cl_raven', { wtype: 'claw', lvl: 38, name: '暗夜渡鸦之爪', st: SI(25), fx: { dmgUp: 0.11, dark: 28, critDmg: 0.1, ...CR(0.03) }, pal: P('#1a1a2a', '#6a4a9a', '#b080ff'),
  proc: { chance: 0.05, cd: 1.5, act: 'strike', mul: 1.9, aoe: 130, elem: 'dark', vis: 'swords', col: '#b080ff', name: '鸦羽乱舞！', desc: '攻击时 5% 几率卷起鸦羽：周围敌人受到 190% 暗属性伤害（冷却 1.5 秒）。' },
  desc: '暗黑城的渡鸦只在月亮最暗的夜里落下这样的爪子。' + ORIG });
EP('ep_tf_silvermoon', { wtype: 'tonfa', lvl: 34, name: '暗精灵的银月东方棍', st: SI(25), fx: { dmgUp: 0.11, dark: 26, aspd: 0.04, defPct: 0.03 }, pal: P('#3a3a5a', '#e0e8ff', '#c0c8ff'),
  desc: '暗精灵守卫的银月棍，侧柄是一弯月牙。' + ORIG });
EP('ep_tf_gravekeeper', { wtype: 'tonfa', lvl: 38, name: '守墓人的镇魂棍', st: SI(30), fx: { dmgUp: 0.11, dark: 28, ...CR(0.03), aspd: 0.04 }, pal: P('#4a4a4a', '#9ad0a0', '#b0ffc0'),
  proc: { chance: 0.05, cd: 1.5, act: 'strike', mul: 1.9, aoe: 130, elem: 'dark', vis: 'dark', col: '#9ad0a0', name: '镇魂！', desc: '攻击时 5% 几率敲响镇魂钟：周围敌人受到 190% 暗属性伤害（冷却 1.5 秒）。' },
  desc: '暗黑城墓园守墓人的棍子，棍头挂着一只小铜钟。' + ORIG });
EP('ep_ga_boroding', { wtype: 'gauntlet', lvl: 34, name: '锤王的碎岩臂铠', st: SI(40, 10), fx: { dmgUp: 0.11, hardness: 30, critDmg: 0.1 }, pal: P('#5a4a3a', '#c0a060', '#ffd070'),
  desc: '锤王波罗丁的锻铁臂铠，指节是四块磨平的铁锤头。' + ORIG });
EP('ep_ga_darklord', { wtype: 'gauntlet', lvl: 38, name: '黑暗城主的臂铠', st: SI(40, 10), fx: { dmgUp: 0.11, dark: 28, critDmg: 0.1, stagger: 30 }, pal: P('#1a1a1a', '#c02a3a', '#ff4a5a'),
  proc: { chance: 0.05, cd: 1.5, act: 'strike', mul: 2.0, aoe: 140, elem: 'dark', vis: 'dark', col: '#ff4a5a', name: '黑暗君临！', desc: '攻击时 5% 几率黑暗君临：周围敌人受到 200% 暗属性伤害（冷却 1.5 秒）。' },
  desc: '暗黑城历代城主传下来的臂铠，铠甲的缝里渗着暗红的光。' + ORIG });

/* ---------------- 5. Lv45（牛头 / 盗贼 / 哈穆林）+ Lv48（根特 / 虫穴）：官方没有 Lv50 的格斗家史诗，用原创补 ---------------- */
EP('ep_kn_piper', { wtype: 'knuckle', lvl: 45, name: '魔笛手的指挥手套', st: SI(0, 30), fx: { dmgUp: 0.11, cspd: 0.06, ...CR(0.03), dark: 25 }, pal: P('#6a2a6a', '#ffd24a', '#ff9ae0'),
  proc: [{ chance: 0.04, cd: 6, act: 'status', status: 'stun', dur: 1, name: '迷乱之音', desc: '攻击时 4% 几率奏响迷乱之音（眩晕 1 秒，冷却 6 秒），' }, { vs: 'stun', act: 'extra', frac: 0.2, desc: '攻击眩晕中的敌人附加 20% 伤害。' }],
  desc: '哈穆林的魔笛手戴过的白手套，指挥棒一样一挥，敌人就跟着节拍乱转。' + ORIG });
EP('ep_kn_gentmage', { wtype: 'knuckle', lvl: 48, name: '根特魔导团的念力手套', st: SI(0, 35), fx: { dmgUp: 0.12, light: 30, cspd: 0.05 }, pal: P('#2a4a8a', '#ffd24a', '#9fc8ff'),
  proc: { chance: 0.05, cd: 1.5, act: 'strike', mul: 1.9, aoe: 130, elem: 'light', vis: 'bolt', col: '#9fc8ff', name: '念力增幅！', desc: '攻击时 5% 几率念力增幅：周围敌人受到 190% 光属性伤害（冷却 1.5 秒）。' },
  desc: '根特魔导团给念术士特制的手套，手背嵌着一块增幅念力的蓝晶。' + ORIG });
EP('ep_bx_piston', { wtype: 'boxing', lvl: 45, name: '牛头械王的活塞拳套', st: SI(30, 0), fx: { dmgUp: 0.11, critDmg: 0.12, stagger: 30 }, pal: P('#6a6a6a', '#ff8a2a', '#ffb070'),
  proc: { chance: 0.05, cd: 1.5, act: 'strike', mul: 1.8, aoe: 120, vis: 'nova', col: '#ffc070', name: '蒸汽重拳！', desc: '攻击时 5% 几率活塞全开：周围敌人受到 180% 伤害（冷却 1.5 秒）。' },
  desc: '比尔马克帝国试验场的活塞改成的拳套，每出一拳都喷一口白汽。' + ORIG });
EP('ep_bx_gentguard', { wtype: 'boxing', lvl: 48, name: '根特近卫的铁拳套', st: SI(35, 0), fx: { dmgUp: 0.12, light: 30, critDmg: 0.12 }, pal: P('#2a3a7a', '#ffd24a', '#ffe070'),
  proc: { chance: 0.05, cd: 1.5, act: 'strike', mul: 1.9, aoe: 130, elem: 'light', vis: 'holy', name: '近卫铁拳！', desc: '攻击时 5% 几率打出近卫铁拳：周围敌人受到 190% 光属性伤害（冷却 1.5 秒）。' },
  desc: '根特皇家近卫队格斗教官的拳套，蓝金两色，手背是皇家纹章。' + ORIG });
EP('ep_cl_goldhook', { wtype: 'claw', lvl: 45, name: '盗贼王的金钩爪', st: SI(20), fx: { dmgUp: 0.11, ...CR(0.04), critDmg: 0.12, goldUp: 0.05 }, pal: P('#6a4a2a', '#ffd24a', '#ffe070'),
  proc: { chance: 0.1, act: 'extra', frac: 0.3, col: '#ffd24a', desc: '攻击时 10% 几率附加 30% 伤害。' },
  desc: '堕落盗贼团团长的金钩爪，钩尖专挑钱袋子下手。' + ORIG });
EP('ep_cl_chitin', { wtype: 'claw', lvl: 48, name: '虫王的甲壳爪', st: SI(25), fx: { dmgUp: 0.12, critDmg: 0.14, ...CR(0.03) }, pal: P('#4a5a2a', '#c0e070', '#9ad070'),
  proc: [{ chance: 0.06, act: 'status', status: 'poison', dur: 4, dps: 0.12, vis: 'dark', col: '#9ad070', name: '虫毒', desc: '攻击时 6% 几率使敌人中毒 4 秒，' }, { vs: 'poison', act: 'extra', frac: 0.15, desc: '攻击中毒的敌人附加 15% 伤害。' }],
  desc: '悲鸣洞穴虫王戮蛊的前肢，刃背上还带着倒钩。' + ORIG });
EP('ep_tf_steam', { wtype: 'tonfa', lvl: 45, name: '比尔马克的蒸汽警棍', st: SI(25), fx: { dmgUp: 0.11, ...SP(0.05), critDmg: 0.1, defPct: 0.03 }, pal: P('#5a5a6a', '#ffb040', '#9ad8ff'),
  proc: { chance: 0.05, cd: 1.5, act: 'strike', mul: 1.8, aoe: 120, elem: 'light', vis: 'bolt', col: '#7fd8ff', name: '过载！', desc: '攻击时 5% 几率能量过载：周围敌人受到 180% 光属性伤害（冷却 1.5 秒）。' },
  desc: '帝国试验场的看守用的蒸汽警棍，侧柄里藏着一个小锅炉。' + ORIG });
EP('ep_tf_gentwatch', { wtype: 'tonfa', lvl: 48, name: '根特守备队的铁棍', st: SI(30), fx: { dmgUp: 0.12, fire: 30, aspd: 0.05, hpPct: 0.04 }, pal: P('#3a3a3a', '#ff6a3a', '#ff9a5a'),
  proc: { chance: 0.06, act: 'status', status: 'burn', dur: 3, dps: 0.12, vis: 'fire', name: '余烬', desc: '攻击时 6% 几率点燃敌人（灼伤 3 秒）。' },
  desc: '根特守备队巷战用的铁棍，棍头烧得发黑，是从火场里抢出来的。' + ORIG });
EP('ep_ga_testsubject', { wtype: 'gauntlet', lvl: 45, name: '帝国试验体的动力臂铠', st: SI(35, 10), fx: { dmgUp: 0.11, hardness: 30, critDmg: 0.12 }, pal: P('#4a5a6a', '#7fd8ff', '#9ae8ff'),
  proc: { chance: 0.05, cd: 1.5, act: 'strike', mul: 1.8, aoe: 120, vis: 'nova', col: '#7fd8ff', name: '动力全开！', desc: '攻击时 5% 几率动力全开：周围敌人受到 180% 伤害（冷却 1.5 秒）。' },
  desc: '比尔马克帝国给试验体装的动力臂，关节里嗡嗡作响。' + ORIG });
EP('ep_ga_gt', { wtype: 'gauntlet', lvl: 48, name: 'GT-9600 试作臂铠', st: SI(40, 10), fx: { dmgUp: 0.12, fire: 30, critDmg: 0.12, stagger: 30 }, pal: P('#5a5a5a', '#ff4a2a', '#ff8a4a'),
  proc: { chance: 0.05, cd: 1.5, act: 'strike', mul: 1.9, aoe: 140, elem: 'fire', vis: 'fire', name: '火箭拳！', desc: '攻击时 5% 几率发射火箭拳：周围敌人受到 190% 火属性伤害（冷却 1.5 秒）。' },
  desc: '天界的工程师照着 GT-9600 的手臂做的试作品，手肘上装着推进器。' + ORIG });

/* ---------------- 6. 官方 Lv55（60 版）：每类 2 件 ---------------- */
EP('ep_kn_tiger', { wtype: 'knuckle', lvl: 55, name: '狂虎啸 - 冥火', st: SI(15, 55), fx: { dmgUp: 0.115, dark: 30, cspd: 0.05 }, pal: P('#2a1a3a', '#6a4aff', '#9a7aff'),
  proc: { chance: 0.06, cd: 1.5, act: 'strike', mul: 2.0, aoe: 130, elem: 'dark', vis: 'dark', col: '#9a7aff', name: '冥火虎啸！', desc: '攻击时 6% 几率放出冥火虎啸：周围敌人受到 200% 暗属性伤害（冷却 1.5 秒）。' },
  desc: '手背是一只张嘴咆哮的虎头，虎口里烧着幽蓝的冥火。（官方 60 版 Lv55 史诗手套）' });
EP('ep_kn_lotus', { wtype: 'knuckle', lvl: 55, name: '千莲护元', st: SI(15, 50), fx: { dmgUp: 0.115, light: 30, ...CR(0.04), dmgReduce: 0.04 }, pal: P('#f0d0e0', '#ffd24a', '#ffe0f0'),
  proc: { on: 'hurt', chance: 0.1, cd: 15, act: 'shield', amt: 0.2, dur: 6, name: '千莲护体', desc: '被击时 10% 几率千莲护体：6 秒内吸收最多 20% HP 上限的伤害（冷却 15 秒）。' },
  desc: '手背绣着千瓣莲花，念气流过时莲花会一瓣瓣张开护住身体。（官方 60 版 Lv55 史诗手套）' });
EP('ep_bx_flash', { wtype: 'boxing', lvl: 55, name: '瞬杀', st: SI(45, 0), fx: { dmgUp: 0.1, ...CR(0.04), aspd: 0.05 }, pal: P('#1a1a1a', '#e0e0e0', '#ffffff'),
  proc: [{ chance: 0.02, cd: 4, act: 'status', status: 'stun', dur: 1, name: '瞬杀', desc: '攻击时 2% 几率眩晕敌人 1 秒；' }, { chance: 0.02, cd: 6, act: 'cut', cut: 0.2, boss: false, name: '瞬杀', desc: '2% 几率削减敌人 20% 当前 HP（对领主无效）。' }],
  desc: '快到看不见的拳套，被打中的人往往要过一会儿才倒下。（官方 60 版 Lv55 史诗拳套）' });
EP('ep_bx_emperor', { wtype: 'boxing', lvl: 55, name: '极皇拳套', st: SI(40, 0), fx: { dmgUp: 0.1, critDmg: 0.15, stagger: 30 }, pal: P('#d8a02a', '#ffffff', '#ffe070'),
  proc: [{ chance: 0.04, cd: 6, act: 'status', status: 'stun', dur: 1, name: '破招', desc: '攻击时 4% 几率破招（眩晕 1 秒，冷却 6 秒），' }, { vs: 'stun', act: 'extra', frac: 0.3, desc: '攻击眩晕中的敌人附加 30% 伤害。' }],
  desc: '极武皇亲手缝制的金色拳套，专打对手出招的破绽。（官方 60 版 Lv55 史诗拳套）' });
EP('ep_cl_zixiao', { wtype: 'claw', lvl: 55, name: '光之爪 - 紫霄', st: SI(20), fx: { dmgUp: 0.11, light: 30, ...CR(0.04), stagger: 30 }, pal: P('#6a3ac0', '#e0d0ff', '#c0a0ff'),
  proc: { chance: 0.06, cd: 1.5, act: 'strike', mul: 1.9, aoe: 120, elem: 'light', vis: 'bolt', col: '#c0a0ff', name: '紫霄雷！', desc: '攻击时 6% 几率降下紫霄雷：周围敌人受到 190% 光属性伤害（冷却 1.5 秒）。' },
  desc: '三道刃上缠着紫色的雷光，一挥就是一道闪电。（官方 60 版 Lv55 史诗爪）' });
EP('ep_cl_venomdragon', { wtype: 'claw', lvl: 55, name: '迷殇之毒龙', st: SI(30), fx: { dmgUp: 0.11, dark: 30, critDmg: 0.12 }, pal: P('#2a5a3a', '#c070ff', '#9ad070'),
  proc: [{ chance: 0.07, act: 'status', status: 'poison', dur: 5, dps: 0.18, vis: 'dark', col: '#9ad070', name: '龙毒', desc: '攻击时 7% 几率使敌人中毒 5 秒，' }, { vs: 'poison', act: 'extra', frac: 0.15, desc: '攻击中毒的敌人附加 15% 伤害。' }],
  desc: '毒龙的獠牙做成的爪刃，闻一下都会头晕。（官方 60 版 Lv55 史诗爪）' });
EP('ep_tf_shadow', { wtype: 'tonfa', lvl: 55, name: '极影天玄棍', st: SI(30), fx: { dmgUp: 0.1, dark: 30, ...SP(0.05) }, pal: P('#1a1a2a', '#8a6aff', '#a080ff'),
  proc: { chance: 0.06, cd: 1.5, act: 'strike', mul: 1.9, aoe: 130, elem: 'dark', vis: 'swords', col: '#a080ff', name: '极影！', desc: '攻击时 6% 几率化作极影：周围敌人受到 190% 暗属性伤害（冷却 1.5 秒）。' },
  desc: '通体漆黑的东方棍，挥动时连影子都追不上。（官方 60 版 Lv55 史诗东方棍）' });
EP('ep_tf_wushen', { wtype: 'tonfa', lvl: 55, name: '武神断魔棍', st: SI(30), fx: { dmgUp: 0.1, light: 30, critDmg: 0.12, defPct: 0.03 }, pal: P('#c0302a', '#ffd24a', '#ffe070'),
  proc: { chance: 0.06, cd: 1.5, act: 'strike', mul: 1.9, aoe: 130, elem: 'light', vis: 'holy', name: '断魔！', desc: '攻击时 6% 几率降下断魔之光：周围敌人受到 190% 光属性伤害（冷却 1.5 秒）。' },
  desc: '武神庙里供了百年的朱漆金箍棍，专打妖魔。（官方 60 版 Lv55 史诗东方棍）' });
EP('ep_ga_dragon', { wtype: 'gauntlet', lvl: 55, name: '怒叱狂龙臂铠', st: SI(45, 10), fx: { dmgUp: 0.1, fire: 30, critDmg: 0.12 }, pal: P('#8a1a1a', '#ffb040', '#ff7030'),
  proc: { chance: 0.05, cd: 1.5, act: 'strike', mul: 2.0, aoe: 140, elem: 'fire', vis: 'fire', name: '狂龙怒叱！', desc: '攻击时 5% 几率狂龙怒叱：周围敌人受到 200% 火属性伤害（冷却 1.5 秒）。' },
  desc: '一条红龙从肩头盘到拳头，出拳时会跟着一起咆哮。（官方 60 版 Lv55 史诗臂铠）' });
EP('ep_ga_rage', { wtype: 'gauntlet', lvl: 55, name: '暴躁铁拳', st: SI(50, 10), fx: { dmgUp: 0.1, hardness: 40, critDmg: 0.12 }, pal: P('#4a4a4a', '#ff3a2a', '#ff6a4a'),
  proc: [{ chance: 0.04, cd: 6, act: 'status', status: 'stun', dur: 1.2, name: '暴躁', desc: '攻击时 4% 几率一拳砸晕敌人（眩晕 1.2 秒，冷却 6 秒），' }, { vs: 'stun', act: 'extra', frac: 0.25, desc: '攻击眩晕中的敌人附加 25% 伤害。' }],
  desc: '脾气比主人还暴的铁拳，一碰就想揍人。（官方 60 版 Lv55 史诗臂铠）' });

/* ---------------- 7. 官方 Lv60 T1（70 版 Lv60）/ T2（官方 Lv65）/ T3（80 版 Lv70，时空之门深渊专属 + 攻坚低概率） ---------------- */
// T1
EP('ep_kn_skyroar', { wtype: 'knuckle', lvl: 60, tier: 1, name: '苍穹之尖啸', st: SI(10, 40), fx: { dmgUp: 0.1, cspd: 0.06, light: 30 }, pal: P('#2a6ad8', '#ffffff', '#9ad8ff'),
  proc: [{ chance: 0.05, cd: 20, act: 'buff', buff: { aspd: 0.12, cspd: 0.12, mspd: 0.12 }, dur: 20, key: 'skyroar', name: '苍穹', col: '#9ad8ff', desc: '攻击时 5% 几率 20 秒内攻击 / 施放 / 移动速度 +12%（冷却 20 秒）；' },
    { chance: 0.05, cd: 1.5, act: 'strike', mul: 2.1, aoe: 140, elem: 'light', vis: 'bolt', name: '尖啸！', desc: '5% 几率念气尖啸：周围敌人受到 210% 光属性伤害（冷却 1.5 秒）。' }],
  desc: '一拳划破苍穹的手套，出拳的破风声像鹰的尖啸。（官方 70 版 Lv60 史诗手套）' });
EP('ep_bx_phantom', { wtype: 'boxing', lvl: 60, tier: 1, name: '泯灭之幽灵', st: SI(40, 0), fx: { dmgUp: 0.1, light: 30, ...CR(0.04), aspd: 0.05 }, pal: P('#e0f0ff', '#6a8aff', '#bfe6ff'),
  proc: [{ chance: 0.02, cd: 4, act: 'status', status: 'stun', dur: 1, name: '泯灭', desc: '攻击时 2% 几率眩晕敌人 1 秒；' },
    { chance: 0.05, cd: 1.5, act: 'strike', mul: 2.1, aoe: 130, elem: 'light', vis: 'moon', col: '#bfe6ff', name: '幽灵拳！', desc: '5% 几率打出幽灵拳：周围敌人受到 210% 光属性伤害（冷却 1.5 秒）。' }],
  desc: '半透明的拳套，打出去的时候连自己都看不清拳头。（官方 70 版 Lv60 史诗拳套）' });
EP('ep_cl_scorpion', { wtype: 'claw', lvl: 60, tier: 1, name: '血蝎之尖尾', st: SI(20), fx: { dmgUp: 0.105, critDmg: 0.15, ...CR(0.03) }, pal: P('#8a1a2a', '#2a1a1a', '#ff4a5a'),
  proc: [{ chance: 0.05, act: 'status', status: 'bleed', dur: 5, dps: 0.2, name: '血蝎', desc: '攻击时 5% 几率使敌人出血 5 秒，' }, { vs: 'bleed', act: 'extra', frac: 0.15, desc: '攻击出血中的敌人附加 15% 伤害。' }],
  desc: '三道刃是一根血红的蝎尾分出来的，毒液顺着刃槽往下滴。（官方 70 版 Lv60 史诗爪）' });
EP('ep_cl_wuxuan', { wtype: 'claw', lvl: 60, tier: 1, name: '无轩之斩魄', st: SI(25), fx: { dmgUp: 0.105, dark: 30, ...CR(0.03) }, pal: P('#2a2a3a', '#7fe0ff', '#9ae8ff'),
  proc: { chance: 0.05, cd: 1.5, act: 'strike', mul: 2.1, aoe: 140, elem: 'dark', vis: 'swords', col: '#7fe0ff', name: '斩魄！', desc: '攻击时 5% 几率斩出魂魄：周围敌人受到 210% 暗属性伤害（冷却 1.5 秒）。' },
  desc: '「无轩」系列的爪，刃上寄宿着被斩下的魂魄。（官方 70 版 Lv60 史诗爪）' });
EP('ep_tf_mammoth', { wtype: 'tonfa', lvl: 60, tier: 1, name: '巨象之獠牙', st: SI(25), fx: { dmgUp: 0.105, aspd: 0.03, ice: 30, critDmg: 0.12 }, pal: P('#f0e8d8', '#6a4a3a', '#bfe6ff'),
  proc: [{ chance: 0.05, act: 'status', status: 'bleed', dur: 4, dps: 0.15, name: '獠牙', desc: '攻击时 5% 几率使敌人出血 4 秒，' }, { vs: 'bleed', act: 'extra', frac: 0.15, desc: '攻击出血中的敌人附加 15% 伤害。' }],
  desc: '用猛犸的獠牙整根削成的东方棍，砸在冰原上能听见回响。（官方 70 版 Lv60 史诗东方棍）' });
EP('ep_ga_hero', { wtype: 'gauntlet', lvl: 60, tier: 1, name: '英雄之荣耀', st: SI(45, 10), fx: { dmgUp: 0.1, aspd: 0.02, critDmg: 0.12, hardness: 30 }, pal: P('#c0c8d8', '#ffd24a', '#ffe070'),
  proc: [{ chance: 0.05, cd: 20, act: 'buff', buff: { aspd: 0.12, cspd: 0.12, mspd: 0.12 }, dur: 20, key: 'herog', name: '荣耀', col: '#ffe070', desc: '攻击时 5% 几率 20 秒内攻击 / 施放 / 移动速度 +12%（冷却 20 秒）；' },
    { chance: 0.05, cd: 1.5, act: 'strike', mul: 2.1, aoe: 130, vis: 'nova', col: '#ffe070', name: '英雄之拳！', desc: '5% 几率打出英雄之拳：周围敌人受到 210% 伤害（冷却 1.5 秒）。' }],
  desc: '无双的勇士戴过的铁臂，贴身近战时越打越勇。（官方 70 版 Lv60 史诗臂铠）' });
// T2
EP('ep_kn_evilend', { wtype: 'knuckle', lvl: 60, tier: 2, name: '邪恶终结者', st: SI(10, 45), fx: { dmgUp: 0.11, light: 35, cspd: 0.06, ...CR(0.03) }, pal: P('#f0f0f0', '#ffd24a', '#fff2b0'),
  proc: { chance: 0.05, cd: 1.5, act: 'strike', mul: 2.3, aoe: 140, elem: 'light', vis: 'holy', name: '终结！', desc: '攻击时 5% 几率降下终结之光：周围敌人受到 230% 光属性伤害（冷却 1.5 秒）。' },
  desc: '专门为终结邪恶而打造的白银手套，拳面刻着驱魔的十字。（官方 Lv65 史诗手套）' });
EP('ep_bx_dragonrage', { wtype: 'boxing', lvl: 60, tier: 2, name: '狂龙之怒拳套', st: SI(45, 0), fx: { dmgUp: 0.105, fire: 35, critDmg: 0.15 }, pal: P('#c02a1a', '#ffd24a', '#ff8a3a'),
  proc: { chance: 0.05, cd: 1.5, act: 'strike', mul: 2.3, aoe: 140, elem: 'fire', vis: 'fire', name: '狂龙之怒！', desc: '攻击时 5% 几率打出狂龙之怒：周围敌人受到 230% 火属性伤害（冷却 1.5 秒）。' },
  desc: '拳套上盘着一条火龙，越打越烫。（官方 Lv65 史诗拳套「狂龙之怒」，和巨剑同名，本作加「拳套」区分）' });
EP('ep_cl_nightraid', { wtype: 'claw', lvl: 60, tier: 2, name: '帝国的夜袭', st: SI(25), fx: { dmgUp: 0.115, ice: 35, critDmg: 0.15, ...CR(0.03) }, pal: P('#1a2a4a', '#9ad8ff', '#bfe6ff'),
  proc: [{ chance: 0.05, cd: 1.5, act: 'strike', mul: 2.3, aoe: 140, elem: 'ice', vis: 'ice', name: '夜袭！', desc: '攻击时 5% 几率发动夜袭：周围敌人受到 230% 冰属性伤害（冷却 1.5 秒），' },
    { chance: 0.04, cd: 5, act: 'status', status: 'freeze', dur: 1, name: '冰封', desc: '4% 几率冰冻敌人 1 秒（冷却 5 秒）。' }],
  desc: '帝国夜袭部队的制式爪，刃上涂了一层消光的霜。（官方 Lv65 史诗爪）' });
EP('ep_tf_butterfly', { wtype: 'tonfa', lvl: 60, tier: 2, name: '蝶血之怒', st: SI(25), fx: { dmgUp: 0.115, dark: 35, aspd: 0.05, critDmg: 0.12 }, pal: P('#6a1a3a', '#ff6a9a', '#ff9ac0'),
  proc: [{ chance: 0.05, cd: 1.5, act: 'strike', mul: 2.3, aoe: 140, elem: 'dark', vis: 'petal', col: '#ff6a9a', name: '血蝶乱舞！', desc: '攻击时 5% 几率放出血蝶：周围敌人受到 230% 暗属性伤害（冷却 1.5 秒），' },
    { chance: 0.05, act: 'status', status: 'bleed', dur: 4, dps: 0.15, name: '蝶血', desc: '5% 几率使敌人出血 4 秒。' }],
  desc: '侧柄停着一只血红的蝴蝶，棍子一挥它就散成一群。（官方 Lv65 史诗东方棍）' });
EP('ep_ga_icesoul', { wtype: 'gauntlet', lvl: 60, tier: 2, name: '冰魄之魂', st: SI(45, 10), fx: { dmgUp: 0.11, ice: 35, critDmg: 0.15, stagger: 30 }, pal: P('#9ad8ff', '#ffffff', '#bfe6ff'),
  proc: [{ chance: 0.05, cd: 1.5, act: 'strike', mul: 2.3, aoe: 140, elem: 'ice', vis: 'ice', name: '冰魄！', desc: '攻击时 5% 几率唤出冰魄：周围敌人受到 230% 冰属性伤害（冷却 1.5 秒），' },
    { chance: 0.04, cd: 5, act: 'status', status: 'freeze', dur: 1, name: '冰封', desc: '4% 几率冰冻敌人 1 秒（冷却 5 秒）。' }],
  desc: '整条臂铠是一块不化的寒冰，打中的地方会结霜。（官方 Lv65 史诗臂铠）' });
// T3（官方 Lv70）
EP('ep_kn_bonesoul', { wtype: 'knuckle', lvl: 60, tier: 3, name: '碎骨裂魂拳套', st: SI(10, 45), fx: { dmgUp: 0.125, light: 40, cspd: 0.06, ...CR(0.03) }, pal: P('#f0e0a0', '#6a4aff', '#fff0a0'),
  proc: [{ chance: 0.06, cd: 1.2, act: 'strike', mul: 2.6, aoe: 150, elem: 'light', vis: 'nova', col: '#fff0a0', name: '裂魂！', desc: '攻击时 6% 几率念气裂魂：周围敌人受到 260% 光属性伤害（冷却 1.2 秒）；' },
    { on: 'skill', chance: 0.08, cd: 12, act: 'buff', buff: { cspd: 0.15, aspd: 0.15 }, dur: 8, key: 'bonesoul', col: '#fff0a0', name: '念帝', desc: '施放技能时 8% 几率攻击 / 施放速度 +15%，持续 8 秒（冷却 12 秒）。' }],
  desc: '念帝的手套，一拳下去碎骨，念气一震裂魂。（官方 80 版 Lv70 史诗手套）' });
EP('ep_bx_warsoul', { wtype: 'boxing', lvl: 60, tier: 3, name: '不灭之战魂拳套', st: SI(50, 0), fx: { dmgUp: 0.115, fire: 40, critDmg: 0.15 }, pal: P('#c0302a', '#ffd24a', '#ffb040'),
  proc: [{ chance: 0.05, cd: 1.5, act: 'strike', mul: 2.7, aoe: 160, elem: 'fire', vis: 'fire', col: '#ffb040', name: '战魂不灭！', desc: '攻击时 5% 几率燃起战魂：周围敌人受到 270% 火属性伤害（冷却 1.5 秒）；' },
    { on: 'lowhp', chance: 1, cd: 45, act: 'shield', amt: 0.3, dur: 8, name: '不灭', desc: 'HP 低于 30% 时获得护盾：8 秒内吸收最多 30% HP 上限的伤害（冷却 45 秒）。' }],
  desc: '拳套里住着一位不肯倒下的老拳手的战魂。（官方 80 版 Lv70 史诗拳套）' });
EP('ep_cl_slaughter', { wtype: 'claw', lvl: 60, tier: 3, name: '杀戮之王', st: SI(25), fx: { dmgUp: 0.125, dark: 40, critDmg: 0.15, ...CR(0.03) }, pal: P('#1a1a1a', '#c0202a', '#ff3a4a'),
  proc: [{ chance: 0.05, cd: 1.5, act: 'strike', mul: 2.7, aoe: 160, elem: 'dark', vis: 'swords', col: '#ff3a4a', name: '杀戮！', desc: '攻击时 5% 几率挥出杀戮之刃：周围敌人受到 270% 暗属性伤害（冷却 1.5 秒）；' },
    { on: 'kill', chance: 0.5, cd: 10, act: 'buff', buff: { atk: 0.12 }, dur: 8, key: 'slaughter', col: '#ff3a4a', name: '杀戮之王', desc: '击杀敌人时 50% 几率攻击力 +12%，持续 8 秒（冷却 10 秒）。' }],
  desc: '三道血红的刃，每一道都饮过上千人的血。（官方 80 版 Lv70 史诗爪）' });
EP('ep_tf_hurricane', { wtype: 'tonfa', lvl: 60, tier: 3, name: '飓风之袭东方棍', st: SI(30), fx: { dmgUp: 0.125, light: 40, ...SP(0.06), critDmg: 0.12 }, pal: P('#3a8a7a', '#e0fff0', '#9affe0'),
  proc: [{ chance: 0.06, cd: 1.2, act: 'strike', mul: 2.6, aoe: 160, elem: 'light', vis: 'nova', col: '#9affe0', name: '飓风！', desc: '攻击时 6% 几率卷起飓风：周围敌人受到 260% 光属性伤害（冷却 1.2 秒）；' },
    { on: 'crit', chance: 0.1, cd: 8, act: 'buff', buff: { aspd: 0.1, mspd: 0.1 }, dur: 6, key: 'hurricane', col: '#9affe0', name: '疾风', desc: '暴击时 10% 几率攻击 / 移动速度 +10%，持续 6 秒（冷却 8 秒）。' }],
  desc: '棍子一转就是一阵旋风，站得近的敌人会被卷上天。（官方 80 版 Lv70 史诗东方棍）' });
EP('ep_ga_brute', { wtype: 'gauntlet', lvl: 60, tier: 3, name: '怪力臂铠', st: SI(55, 10), fx: { dmgUp: 0.115, fire: 40, critDmg: 0.15, hardness: 40 }, pal: P('#6a2a1a', '#ffd24a', '#ff9a3a'),
  proc: [{ chance: 0.05, cd: 1.5, act: 'strike', mul: 2.7, aoe: 160, elem: 'fire', vis: 'fire', col: '#ff9a3a', name: '怪力！', desc: '攻击时 5% 几率使出怪力：周围敌人受到 270% 火属性伤害（冷却 1.5 秒）；' },
    { chance: 0.04, cd: 6, act: 'status', status: 'stun', dur: 1, name: '震地', desc: '4% 几率震晕敌人 1 秒（冷却 6 秒）。' }],
  desc: '只有力气大到能单手举起牛头械王的人才戴得动。（官方 80 版 Lv70 史诗臂铠）' });
EP('ep_ga_wailstar', { wtype: 'gauntlet', lvl: 60, tier: 3, name: '哀嚎之星臂铠', st: SI(50, 15), fx: { dmgUp: 0.115, dark: 40, critDmg: 0.12, ...CR(0.03) }, pal: P('#2a1a4a', '#c0a0ff', '#b080ff'),
  proc: [{ chance: 0.05, cd: 1.5, act: 'strike', mul: 2.6, aoe: 160, elem: 'dark', vis: 'dark', col: '#b080ff', name: '哀嚎之星！', desc: '攻击时 5% 几率砸下哀嚎之星：周围敌人受到 260% 暗属性伤害（冷却 1.5 秒）；' },
    { chance: 0.06, cd: 6, act: 'debuff', taken: 0.1, dur: 5, vis: 'dark', col: '#b080ff', name: '星陨', desc: '6% 几率让敌人 5 秒内受到的伤害 +10%（冷却 6 秒）。' }],
  desc: '崩拳·赫罗菲在深渊里留下的臂铠，拳心嵌着一颗还在哀嚎的星星。（官方 80 版 Lv70 史诗臂铠）' });

/* ---------------- 8. 领主神器 / Lv55 粉装（粉色，只在指定领主身上掉；拿在手里用 <类型>_r3 + pal 配色） ---------------- */
NM('nm_kn_kaino', { wtype: 'knuckle', lvl: 9, lord: 'goblinShaman', name: '凯诺的落雷手套', fx: { dmgUp: 0.03, light: 10 }, pal: P('#3a3a5a', '#ffe060', '#fff070'),
  proc: { chance: 0.05, cd: 2, act: 'strike', mul: 1.3, elem: 'light', vis: 'bolt', name: '落雷！', desc: '攻击时 5% 几率招来落雷（130% 光属性伤害，冷却 2 秒）。' }, desc: '落雷凯诺念咒时戴的手套，指尖总是噼啪冒火花。（本作原创领主神器，落雷凯诺）' });
NM('nm_ga_sauta', { wtype: 'gauntlet', lvl: 14, lord: 'tauKing', name: '萨乌塔的牛角臂铠', fx: { dmgUp: 0.03, stagger: 20, hardness: 20 }, pal: P('#6a3a1a', '#e8d8b0', '#ffc080'),
  proc: { chance: 0.05, cd: 3, act: 'strike', mul: 1.4, aoe: 100, vis: 'nova', col: '#ffc080', name: '蛮牛冲撞！', desc: '攻击时 5% 几率蛮牛冲撞（周围 140% 伤害，冷却 3 秒）。' }, desc: '牛头王萨乌塔的断角绑在铁臂上做成的臂铠。（本作原创领主神器，牛头王萨乌塔）' });
NM('nm_cl_lotus', { wtype: 'claw', lvl: 30, lord: 'lotus', name: '魂灵之爪', fx: { dmgUp: 0.05, dark: 15, ...CR(0.02) }, pal: P('#e0e8f0', '#6ab0e0', '#9ad8ff'),
  proc: { chance: 0.04, cd: 2, act: 'strike', mul: 1.5, aoe: 110, elem: 'dark', vis: 'dark', col: '#9ad8ff', name: '魂灵！', desc: '攻击时 4% 几率放出魂灵（周围 150% 暗属性伤害，冷却 2 秒）。' }, desc: '长脚罗特斯吞下的魂灵聚成的爪子，和魂灵法杖、魂灵手弩是一套。（本作原创领主神器，长脚罗特斯）' });
NM('nm_cl_morgan', { wtype: 'claw', lvl: 32, lord: 'morgan', name: '摩根之爪', fx: { dmgUp: 0.05, dark: 18 }, pal: P('#3a2a3a', '#9a6aff', '#b080ff'),
  proc: { chance: 0.05, cd: 6, act: 'status', status: 'slow', dur: 3, name: '怨恨', desc: '攻击时 5% 几率让怨气缠住敌人（减速 3 秒，冷却 6 秒）。' }, desc: '怨恨之摩根的指甲，怨气重得能拖慢敌人的脚步。（官方 60 版 Lv50 神器爪，暗属性）' });
NM('nm_kn_spiz', { wtype: 'knuckle', lvl: 34, lord: 'spiz', name: '邪龙的尸毒手套', fx: { dmgUp: 0.06, dark: 18 }, pal: P('#2a3a2a', '#c0304a', '#9ad070'),
  proc: { chance: 0.05, act: 'status', status: 'poison', dur: 4, dps: 0.12, vis: 'dark', col: '#9ad070', name: '尸毒', desc: '攻击时 5% 几率使敌人中毒 4 秒。' }, desc: '邪龙斯皮兹的尸毒浸透了这副手套。（官方领主神器，邪龙斯皮兹）' });
NM('nm_kn_goliath', { wtype: 'knuckle', lvl: 35, lord: 'goliath', name: '歌利亚手套', fx: { dmgUp: 0.06, fire: 18 }, pal: P('#5a2a1a', '#ff6a1a', '#ff9a3a'),
  proc: { chance: 0.05, cd: 2, act: 'strike', mul: 1.5, aoe: 110, elem: 'fire', vis: 'fire', name: '巨人之拳！', desc: '攻击时 5% 几率挥出巨人之拳（周围 150% 火属性伤害，冷却 2 秒）。' }, desc: '熔岩巨人歌利亚的手套，大得能当盾牌。（官方 60 版 Lv50 领主神器「歌利亚手套」，火属性）' });
NM('nm_ga_lik', { wtype: 'gauntlet', lvl: 38, lord: 'lik', name: '利库的霜寒臂铠', fx: { dmgUp: 0.06, ice: 20, hardness: 20 }, pal: P('#9ad8ff', '#3a5a8a', '#bfe6ff'),
  proc: { chance: 0.04, cd: 5, act: 'status', status: 'freeze', dur: 1, name: '霜寒', desc: '攻击时 4% 几率冰冻敌人 1 秒（冷却 5 秒）。' }, desc: '寒冰巨人利库的冰臂，戴上以后手指头都是凉的。（官方 60 版 Lv50 领主神器，冰属性）' });
NM('nm_bx_ruug', { wtype: 'boxing', lvl: 39, lord: 'ruug', name: '鲁乌格的寒冰拳套', fx: { dmgUp: 0.06, ice: 20 }, pal: P('#bfe6ff', '#3a6ab0', '#e0f4ff'),
  proc: { chance: 0.05, cd: 6, act: 'status', status: 'slow', dur: 3, name: '寒冰', desc: '攻击时 5% 几率冻住敌人的脚（减速 3 秒，冷却 6 秒）。' }, desc: '野兽师鲁乌格训兽时戴的冰拳套。（官方 60 版 Lv50 领主神器，冰属性）' });
NM('nm_kn_mozhen', { wtype: 'knuckle', lvl: 45, lord: 'mozhen', name: '魔震的锋牙手套', fx: { dmgUp: 0.07, dark: 20, ...CR(0.03) }, pal: P('#3a2a2a', '#e0e0e0', '#ff6a5a'),
  proc: { chance: 0.05, act: 'status', status: 'bleed', dur: 4, dps: 0.12, name: '锋牙', desc: '攻击时 5% 几率使敌人出血 4 秒。' }, desc: '犬使魔震的獠牙嵌在指节上的手套。（官方 60 版 Lv55 领主神器「摩震的锋牙手套」）' });
NM('nm_tf_suleide', { wtype: 'tonfa', lvl: 50, lord: 'suleide', name: '龙旋破军棍', fx: { dmgUp: 0.07, light: 20, defPct: 0.03 }, pal: P('#2a3a6a', '#ffd24a', '#9ad8ff'),
  proc: { chance: 0.05, cd: 2, act: 'strike', mul: 1.6, aoe: 120, elem: 'light', vis: 'bolt', name: '破军！', desc: '攻击时 5% 几率龙旋破军（周围 160% 光属性伤害，冷却 2 秒）。' }, desc: '机动队长苏雷德的特制警棍，一转就像一条游龙。（官方 60 版 Lv50 神器东方棍）' });
NM('nm_bx_mobeni', { wtype: 'boxing', lvl: 55, lord: 'mobeni', name: '钢铁之鳞拳', fx: { dmgUp: 0.08, critDmg: 0.1, stagger: 30 }, pal: P('#2a3a3a', '#9ad0c0', '#bfffe0'),
  proc: { chance: 0.04, cd: 6, act: 'status', status: 'stun', dur: 1, name: '铁鳞', desc: '攻击时 4% 几率眩晕敌人 1 秒（冷却 6 秒）。' }, desc: '黑鳞莫贝尼的鳞片一层层钉成的拳套。（官方领主神器，黑鳞莫贝尼）' });
NM('nm_ga_podir', { wtype: 'gauntlet', lvl: 55, lord: 'podir', name: '烈焰盾波迪尔的臂铠', fx: { dmgUp: 0.08, fire: 25, hardness: 30 }, pal: P('#6a1a1a', '#ffb040', '#ff7030'),
  proc: { on: 'hurt', chance: 0.12, cd: 12, act: 'shield', amt: 0.15, dur: 6, name: '烈焰盾', desc: '被击时 12% 几率举起烈焰盾：6 秒内吸收最多 15% HP 上限的伤害（冷却 12 秒）。' }, desc: '烈焰盾波迪尔的臂铠，肘上还连着半面烧红的盾。（官方领主神器，烈焰盾波迪尔）' });
NM('nm_kn_utara', { wtype: 'knuckle', lvl: 55, lord: 'utara', name: '御兽之王手套', fx: { dmgUp: 0.08, ...CR(0.04), cspd: 0.05 }, pal: P('#6a4a2a', '#ffd24a', '#ffc070'),
  proc: { on: 'hurt', chance: 0.1, cd: 15, act: 'shield', amt: 0.15, dur: 6, name: '兽王之盾', desc: '被击时 10% 几率兽王之盾：6 秒内吸收最多 15% HP 上限的伤害（冷却 15 秒）。' }, desc: '兽王乌塔拉驯兽时戴的手套，猛兽闻到它的味道就趴下。（官方领主神器，兽王乌塔拉）' });
NM('nm_tf_utara', { wtype: 'tonfa', lvl: 55, lord: 'utara', name: '火焰之源 - 东方棍', fx: { dmgUp: 0.08, fire: 25, aspd: 0.05 }, pal: P('#8a2a1a', '#ffb040', '#ff7030'),
  proc: { chance: 0.06, act: 'status', status: 'burn', dur: 3, dps: 0.15, vis: 'fire', name: '火焰之源', desc: '攻击时 6% 几率点燃敌人（灼伤 3 秒）。' }, desc: '格兰之火的火种封在棍芯里，永远不会熄。（官方领主神器，兽王乌塔拉）' });
NM('nm_cl_ranzhan', { wtype: 'claw', lvl: 55, lord: 'cerberus', name: '乱斩之袭', fx: { dmgUp: 0.08, critDmg: 0.12, ...CR(0.03) }, pal: P('#3a1a1a', '#ff6a3a', '#ff9a6a'),
  proc: { chance: 0.1, act: 'extra', frac: 0.25, col: '#ff9a6a', desc: '攻击时 10% 几率附加 25% 伤害。' }, desc: '三头犬的三颗头各咬过一次的爪，刃口参差不齐。（官方 60 版 Lv55 神器爪）' });
NM('nm_tf_satan', { wtype: 'tonfa', lvl: 55, lord: 'anzu', name: '撒旦的堕落之尘', fx: { dmgUp: 0.08, dark: 25, aspd: 0.04 }, pal: P('#2a1a2a', '#c0a0ff', '#a080ff'),
  proc: { chance: 0.05, cd: 6, act: 'status', status: 'slow', dur: 3, name: '堕落之尘', desc: '攻击时 5% 几率扬起堕落之尘，敌人看不清方向（减速 3 秒，冷却 6 秒）。' }, desc: '棍头装着一撮撒旦堕落时落下的灰。（官方 60 版 Lv55 神器东方棍）' });
NM('nm_ga_chaos', { wtype: 'gauntlet', lvl: 55, lord: 'belit', name: '混沌支配者', fx: { dmgUp: 0.08, elemAll: 20, critDmg: 0.1 }, pal: P('#3a2a4a', '#ffd24a', '#c0a0ff'),
  proc: { chance: 0.05, cd: 2, act: 'strike', mul: 1.7, aoe: 120, vis: 'nova', col: '#c0a0ff', name: '混沌！', desc: '攻击时 5% 几率引爆混沌（周围 170% 伤害，冷却 2 秒）。' }, desc: '四种元素在臂铠的宝石里互相撕咬，谁也压不住谁。（官方 60 版 Lv55 神器臂铠）' });
monDrop('goblinShaman', [['nm_kn_kaino', 0.025]]);
monDrop('tauKing', [['nm_ga_sauta', 0.025]]);
monDrop('lotus', [['nm_cl_lotus', 0.02]]);
monDrop('morgan', [['nm_cl_morgan', 0.02]]);
monDrop('spiz', [['nm_kn_spiz', 0.02]]);
monDrop('goliath', [['nm_kn_goliath', 0.02]]);
monDrop('lik', [['nm_ga_lik', 0.02]]);
monDrop('ruug', [['nm_bx_ruug', 0.02]]);
monDrop('mozhen', [['nm_kn_mozhen', 0.02]]);
monDrop('suleide', [['nm_tf_suleide', 0.02]]);
monDrop('mobeni', [['nm_bx_mobeni', 0.02]]);
monDrop('podir', [['nm_ga_podir', 0.02]]);
monDrop('utara', [['nm_kn_utara', 0.02], ['nm_tf_utara', 0.02]]);
monDrop('cerberus', [['nm_cl_ranzhan', 0.02]]);
monDrop('anzu', [['nm_tf_satan', 0.02]]);
monDrop('belit', [['nm_ga_chaos', 0.02]]);

/* ---------------- 9. 掉落 / 深渊归属 ---------------- */
// Lv1~10
gearDrop('dark_woods', [['ep_tf_oak', 0.008]]);
gearDrop('dark_woods_deep', [['ep_tf_oak', 0.008], ['ep_bx_redstar', 0.008]]);
gearDrop('thunder_ruins', [['ep_cl_goblin', 0.008], ['ep_bx_redstar', 0.008]]);
gearDrop('venom_ruins', [['ep_ga_tau', 0.008], ['ep_cl_goblin', 0.008], ['ep_kn_dawn', 0.008]]);
gearDrop('frozen_woods', [['ep_ga_tau', 0.008], ['ep_kn_dawn', 0.008]]);
// Lv11~20
gearDrop('graca', [['ep_bx_tauking', 0.01]]);
gearDrop('blazing_graca', [['ep_kn_blaze', 0.01], ['ep_ga_lava', 0.01]]);
gearDrop('dark_thunder', [['ep_tf_thunder', 0.01], ['ep_cl_bone', 0.008], ['ep_ga_bonedragon', 0.008]]);
gearDrop('dragon_tower', [['ep_cl_dragonkin', 0.01]]);
gearDrop('puppet_hall', [['ep_kn_puppet', 0.01]]);
gearDrop('golem_tower', [['ep_bx_golem', 0.01], ['ep_tf_amber', 0.01]]);
gearDrop('dark_corridor', [['ep_kn_puppet', 0.008], ['ep_cl_bone', 0.008], ['ep_ga_bonedragon', 0.008], ['ep_tf_amber', 0.008]]);
// Lv21~30（Lv30 = 天空之城深渊专属）
gearDrop('lord_palace', [['ep_ga_silverguard', 0.008], ['ep_kn_windbell', 0.008]]);
gearDrop('floating_castle', [['ep_kn_windbell', 0.01], ['ep_bx_champion', 0.01]]);
gearDrop('temple_outskirts', [['ep_cl_stigma', 0.008], ['ep_bx_champion', 0.008]]);
gearDrop('treant_jungle', [['ep_tf_vine', 0.008], ['ep_cl_stigma', 0.008]]);
gearDrop('purgatory', [['ep_tf_vine', 0.008], ['ep_ga_silverguard', 0.008]]);
abyssClaim('sky_castle', ['ep_kn_heaven', 'ep_bx_sinfist', 'ep_cl_wyvern', 'ep_tf_seraph', 'ep_ga_titan']);
// Lv34（暗精灵领主）；Lv38 = 暗黑城深渊专属
gearDrop('spider_cave', [['ep_bx_spider', 0.01]]);
gearDrop('darkelf_tomb', [['ep_kn_moonshade', 0.008], ['ep_tf_silvermoon', 0.008]]);
gearDrop('lava_cave', [['ep_cl_lava', 0.01], ['ep_bx_spider', 0.008]]);
gearDrop('king_ruins', [['ep_ga_boroding', 0.01], ['ep_tf_silvermoon', 0.008], ['ep_kn_moonshade', 0.008]]);
gearDrop('frozen_heart', [['ep_cl_lava', 0.008], ['ep_ga_boroding', 0.008]]);
abyssClaim('darkelf', ['ep_kn_diregie', 'ep_bx_headless', 'ep_cl_raven', 'ep_tf_gravekeeper', 'ep_ga_darklord']);
// Lv45（牛头 / 盗贼 / 哈穆林）、Lv48（根特 / 虫穴）
gearDrop('bilmark', [['ep_bx_piston', 0.01], ['ep_tf_steam', 0.01], ['ep_ga_testsubject', 0.01]]);
gearDrop('fallen_bandits', [['ep_cl_goldhook', 0.01], ['ep_ga_testsubject', 0.008]]);
gearDrop('hamelin', [['ep_kn_piper', 0.01], ['ep_cl_goldhook', 0.008], ['ep_tf_steam', 0.008]]);
gearDrop('gent_outskirts', [['ep_kn_gentmage', 0.008], ['ep_tf_gentwatch', 0.008], ['ep_bx_gentguard', 0.008]]);
gearDrop('gent_east', [['ep_bx_gentguard', 0.008], ['ep_kn_gentmage', 0.008], ['ep_ga_gt', 0.008]]);
gearDrop('wailing_cave', [['ep_cl_chitin', 0.01], ['ep_ga_gt', 0.008], ['ep_tf_gentwatch', 0.008]]);
// Lv55（海上列车 / 时空之门前段）
gearDrop('sea_pirates', [['ep_bx_flash', 0.008], ['ep_cl_venomdragon', 0.008]]);
gearDrop('west_line', [['ep_ga_dragon', 0.008], ['ep_kn_tiger', 0.008], ['ep_tf_wushen', 0.008]]);
gearDrop('heis', [['ep_kn_lotus', 0.008], ['ep_cl_zixiao', 0.008], ['ep_tf_shadow', 0.008]]);
gearDrop('grand_fire', [['ep_ga_rage', 0.008], ['ep_bx_emperor', 0.008]]);
gearDrop('plague_source', [['ep_cl_venomdragon', 0.008], ['ep_tf_shadow', 0.008], ['ep_kn_tiger', 0.008]]);
gearDrop('kartel_origin', [['ep_bx_flash', 0.008], ['ep_ga_dragon', 0.008], ['ep_cl_zixiao', 0.008]]);
gearDrop('holy_war', [['ep_kn_lotus', 0.008], ['ep_tf_wushen', 0.008], ['ep_bx_emperor', 0.008], ['ep_ga_rage', 0.008]]);
// Lv60 T1（时空之门后段 / 希洛克）
gearDrop('secret_zone', [['ep_kn_skyroar', 0.008], ['ep_cl_scorpion', 0.008]]);
gearDrop('old_wail', [['ep_bx_phantom', 0.008], ['ep_tf_mammoth', 0.008]]);
gearDrop('old_winter', [['ep_ga_hero', 0.008], ['ep_cl_wuxuan', 0.008]]);
gearDrop('law_gate', [['ep_kn_skyroar', 0.006], ['ep_ga_hero', 0.006]]);
gearDrop('wit_gate', [['ep_cl_scorpion', 0.006], ['ep_bx_phantom', 0.006]]);
gearDrop('pain_gate', [['ep_tf_mammoth', 0.006], ['ep_cl_wuxuan', 0.006]]);
// Lv60 T2（攻坚：谜之觉悟、无形棺柩；阿登高地低概率）
const T2 = ['ep_kn_evilend', 'ep_bx_dragonrage', 'ep_cl_nightraid', 'ep_tf_butterfly', 'ep_ga_icesoul'];
gearDrop('iris_raid', T2.map(k => [k, 0.006]));
gearDrop('siroco_coffin', T2.map(k => [k, 0.006]));
gearDrop('arden', T2.map(k => [k, 0.002]));
// Lv60 T3（时空之门深渊专属；攻坚 0.3%）
const T3 = ['ep_kn_bonesoul', 'ep_bx_warsoul', 'ep_cl_slaughter', 'ep_tf_hurricane', 'ep_ga_brute', 'ep_ga_wailstar'];
abyssClaim('timegate', T3);
gearDrop('iris_raid', T3.map(k => [k, 0.003]));
gearDrop('siroco_coffin', T3.map(k => [k, 0.003]));
}
