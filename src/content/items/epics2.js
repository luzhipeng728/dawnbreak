/* =====================================================================
   物品库 · 装备深化：更多史诗（覆盖 15 种武器与全部部位，按等级段分布到 Lv30）、史诗套装、异界套装（传说）
   名字用国服经典版（60 / 70 版，个别 80 版）的官方史诗名，等级按本作满级 30 压缩，效果按本作数值重新设计；
   官方没有对应物品的地方按官方命名风格补齐，desc 里注明“（本作原创）”。依据见 docs/GEAR.md。
   - abyss: true = 深渊专属（只在深渊派对里掉落 / 兑换，普通地下城和礼盒不出）；abyssFrom 写在 tooltip 的获取途径里
   - proc：专属特效（game/gear_fx.js），desc 写给玩家看
   ===================================================================== */
{
const EP = (key, def) => defineEpic(key, def);
const GF = '格兰之森深渊', SKY = '天空之城深渊';
/* ---------------- 鬼剑士武器 ---------------- */
// 短剑：无影剑-艾雷诺（Lv15，已有）→ 雷鸣剑-坎亚 → 破碎之命运 → 修罗之戮
EP('ep_ss_kanya', { slot: 'weapon', wtype: 'shortsword', lvl: 22, name: '雷鸣剑-坎亚', fx: { light: 22, atkElem: 'light', aspd: 0.04 },
  proc: [{ chance: 0.04, act: 'strike', mul: 1.6, elem: 'light', vis: 'bolt', name: '落雷！', desc: '光属性攻击；攻击时 4% 几率召唤落雷（160% 伤害），' }, { chance: 0.03, act: 'status', status: 'stun', dur: 1.2, name: '感电', desc: '3% 几率使敌人感电（眩晕 1.2 秒）。' }],
  desc: '剑身里封着一场永不停歇的雷暴。' });
EP('ep_ss_fate', { slot: 'weapon', wtype: 'shortsword', lvl: 27, name: '破碎之命运', st: { str: 30, int: 30 }, fx: { critDmg: 0.16, dmgUp: 0.08 }, desc: '据说握住它的人，能亲手斩断既定的命运。' });
EP('ep_ss_shura', { slot: 'weapon', wtype: 'shortsword', lvl: 30, abyss: true, abyssFrom: SKY, name: '修罗之戮', fx: { dmgUp: 0.12, dark: 25, critDmg: 0.1 },
  proc: { on: 'crit', chance: 0.1, cd: 1.5, act: 'strike', mul: 2.2, aoe: 130, elem: 'dark', vis: 'dark', name: '修罗波动！', desc: '暴击时 10% 几率释放修罗波动：对周围敌人造成 220% 暗属性伤害（冷却 1.5 秒）。' }, desc: '修罗的波动在剑身里低吼。' });
// 太刀：月之光芒（10）→ 屠戮之刃 → 十字斩刀-者（20）→ 艾兰德拉的终极太刀 → 九龙护魂刀
EP('ep_kt_slaughter', { slot: 'weapon', wtype: 'katana', lvl: 15, name: '屠戮之刃', fx: { crit: 0.03, mcrit: 0.03, dmgUp: 0.05 },
  proc: [{ chance: 0.05, act: 'status', status: 'bleed', dur: 4, dps: 0.1, name: '出血', desc: '攻击时 5% 几率使敌人出血 4 秒，' }, { vs: 'bleed', act: 'extra', frac: 0.2, desc: '攻击出血中的敌人时附加 20% 伤害。' }], desc: '饮过无数鲜血的太刀，闻到血腥味就会发出嗡鸣。' });
EP('ep_kt_andra', { slot: 'weapon', wtype: 'katana', lvl: 26, name: '艾兰德拉的终极太刀', fx: { aspd: 0.05, crit: 0.04, mcrit: 0.04 },
  proc: { chance: 0.05, cd: 20, act: 'buff', buff: { dmg: 0.15 }, dur: 20, key: 'andra', name: '终极太刀', col: '#9ad8ff', desc: '攻击时 5% 几率觉醒刀魂：20 秒内伤害 +15%（冷却 20 秒）。' }, desc: '刀匠艾兰德拉毕生的最后一件作品。' });
EP('ep_kt_ninedragon', { slot: 'weapon', wtype: 'katana', lvl: 30, abyss: true, abyssFrom: SKY, name: '九龙护魂刀', fx: { dmgUp: 0.12, cdr: 0.06, crit: 0.03 },
  proc: { on: 'skill', chance: 0.08, act: 'reset', name: '九龙护魂！', desc: '施放技能时 8% 几率立即重置这个技能的冷却。' }, desc: '九条龙魂缠绕刀身，守护着持刀之人。' });
// 钝器：地狱邪目（13）→ 修罗吞灵槌 → 灵魂伴侣-雷电 → 怒雷麒麟 → 心脏粉碎者
EP('ep_cb_devour', { slot: 'weapon', wtype: 'club', lvl: 17, name: '修罗吞灵槌', fx: { stagger: 40, critDmg: 0.12, dark: 15 },
  proc: { chance: 0.05, act: 'strike', mul: 1.5, elem: 'dark', vis: 'dark', name: '邪光斩！', desc: '攻击时 5% 几率打出邪光斩（150% 暗属性伤害）。' }, desc: '吞食灵魂的巨槌，越打越重。' });
EP('ep_cb_soulmate', { slot: 'weapon', wtype: 'club', lvl: 22, name: '灵魂伴侣-雷电', fx: { light: 20, dmgUp: 0.06, aspd: 0.03 },
  proc: { on: 'crit', chance: 0.12, act: 'strike', mul: 1.2, elem: 'light', vis: 'bolt', name: '雷电！', desc: '暴击时 12% 几率追加一道雷电（120% 光属性伤害）。' }, desc: '雷电的精灵住在锤头里，是个话痨。' });
EP('ep_cb_kirin', { slot: 'weapon', wtype: 'club', lvl: 27, name: '怒雷麒麟', fx: { stagger: 50, dmgUp: 0.08, light: 15 },
  proc: [{ chance: 0.05, act: 'status', status: 'stun', dur: 1, name: '感电', desc: '攻击时 5% 几率使敌人感电，' }, { vs: 'stun', act: 'extra', frac: 0.25, desc: '攻击感电（眩晕）中的敌人时附加 25% 伤害。' }], desc: '麒麟之怒化作雷霆，劈开一切。' });
EP('ep_cb_heart', { slot: 'weapon', wtype: 'club', lvl: 30, abyss: true, abyssFrom: SKY, name: '心脏粉碎者', fx: { dmgUp: 0.1, critDmg: 0.12, hardness: 30 },
  proc: { act: 'extra', frac: 0.05, exec: 0.25, desc: '敌人剩余 HP 越低，附加伤害越高（5% ~ 30%）。' }, desc: '专门对付垂死挣扎的敌人。' });
// 巨剑：地灵绝魂剑 → 狂龙之怒（18，已有）→ 邪龙魔剑 → 守护战士
EP('ep_gs_earth', { slot: 'weapon', wtype: 'greatsword', lvl: 12, name: '地灵绝魂剑', fx: { hardness: 30, dmgUp: 0.06, hpPct: 0.05 }, desc: '剑身沉得出奇，仿佛整片大地都压在上面。' });
EP('ep_gs_evildragon', { slot: 'weapon', wtype: 'greatsword', lvl: 24, name: '邪龙魔剑', st: { atk: 160, matk: 60 }, fx: { dmgUp: 0.08, stagger: 40 },
  proc: { on: 'kill', chance: 0.25, act: 'buff', buff: { atk: 0.03 }, dur: 10, stack: 5, key: 'evildragon', name: '邪龙之血', col: '#a03aff', desc: '击杀敌人时 25% 几率吸收邪龙之血：攻击力 +3%，最多 5 层，持续 10 秒。' }, desc: '邪龙的心脏被铸进了剑柄。' });
EP('ep_gs_guardian', { slot: 'weapon', wtype: 'greatsword', lvl: 30, abyss: true, abyssFrom: SKY, name: '守护战士', fx: { dmgUp: 0.1, dmgReduce: 0.06, hardness: 40 },
  proc: { on: 'hurt', chance: 0.25, cd: 2, act: 'strike', mul: 2.2, aoe: 140, vis: 'nova', name: '守护反击！', desc: '被击时 25% 几率反击：对周围敌人造成 220% 伤害（冷却 2 秒）。' }, desc: '为守护而挥动的巨剑，从不先出手。' });
// 光剑：光炎剑-烈日裁决 → 光剑-雷鸣赤诚（22，已有）→ 千年之光 → 血之挽歌
EP('ep_ls_sun', { slot: 'weapon', wtype: 'lightsaber', lvl: 14, name: '光炎剑-烈日裁决', fx: { light: 18, aspd: 0.04 },
  proc: { chance: 0.08, act: 'strike', mul: 1.0, elem: 'light', vis: 'holy', name: '光炎！', desc: '攻击时 8% 几率发射光炎（100% 光属性伤害）。' }, desc: '烈日的裁决，从剑尖倾泻而下。' });
EP('ep_ls_millennium', { slot: 'weapon', wtype: 'lightsaber', lvl: 26, name: '千年之光', fx: { light: 30, aspd: 0.06, dmgUp: 0.08 }, desc: '一千年前点亮的光，至今没有熄灭。' });
EP('ep_ls_elegy', { slot: 'weapon', wtype: 'lightsaber', lvl: 30, abyss: true, abyssFrom: SKY, name: '血之挽歌', fx: { crit: 0.05, mcrit: 0.05, critDmg: 0.2, aspd: 0.05 },
  proc: { on: 'crit', chance: 0.08, act: 'status', status: 'bleed', dur: 5, dps: 0.15, name: '挽歌', desc: '暴击时 8% 几率使敌人大出血 5 秒（每秒 15% 攻击力）。' }, desc: '为倒下的敌人奏响的挽歌。' });
/* ---------------- 神枪手武器 ---------------- */
// 左轮：沙漠之鹰-黄昏（10）→ 夕阳骑士 → 刺骨 → 金狂蟒-33MM
EP('ep_rv_sunset', { slot: 'weapon', wtype: 'revolver', lvl: 20, name: '夕阳骑士', fx: { crit: 0.05, mcrit: 0.05, critDmg: 0.1 },
  proc: { chance: 0.015, act: 'cut', cut: 0.3, boss: false, name: '夕阳！', desc: '攻击时 1.5% 几率削减敌人 30% 的当前 HP（对领主无效）。' }, desc: '夕阳下的最后一枪，从不落空。' });
EP('ep_rv_bone', { slot: 'weapon', wtype: 'revolver', lvl: 26, name: '刺骨', fx: { dmgUp: 0.08, aspd: 0.05 },
  proc: { chance: 0.02, cd: 20, act: 'buff', buff: { aspd: 0.15, dmg: 0.1 }, dur: 20, key: 'bone', name: '刺骨', col: '#bfe8ff', desc: '攻击时 2% 几率进入刺骨状态：20 秒内攻速 +15%、伤害 +10%（冷却 20 秒）。' }, desc: '子弹带着彻骨的寒意。' });
EP('ep_rv_python', { slot: 'weapon', wtype: 'revolver', lvl: 30, abyss: true, abyssFrom: SKY, name: '金狂蟒-33MM', fx: { dmgUp: 0.12, crit: 0.05, mcrit: 0.05 },
  proc: { on: 'skill', chance: 0.2, act: 'reset', name: '无冷却！', desc: '施放技能时 20% 几率立即重置这个技能的冷却。' }, desc: '黄金打造的蟒蛇左轮，据说有 33% 的几率……不对，这里是 20%。' });
// 自动手枪：绝杀-蝮蛇 → 萤火之光（24，已有）→ 炙炎之海克勒
EP('ep_ap_viper', { slot: 'weapon', wtype: 'autopistol', lvl: 14, name: '绝杀-蝮蛇', fx: { dmgUp: 0.08, aspd: 0.04, crit: 0.02, mcrit: 0.02 }, desc: '贴身开火时威力惊人。' });
EP('ep_ap_heckler', { slot: 'weapon', wtype: 'autopistol', lvl: 28, abyss: true, abyssFrom: SKY, name: '炙炎之海克勒', fx: { fire: 25, atkElem: 'fire', dmgUp: 0.08 },
  proc: [{ chance: 0.05, act: 'status', status: 'burn', dur: 4, dps: 0.12, name: '灼伤', desc: '火属性攻击；攻击时 5% 几率使敌人灼伤，' }, { vs: 'burn', act: 'extra', frac: 0.12, desc: '攻击灼伤中的敌人时附加 12% 伤害。' }], desc: '枪管永远是烫的。' });
// 步枪：死亡步枪 → 贯穿之眼（24，已有）→ 僵尸猎手
EP('ep_rf_death', { slot: 'weapon', wtype: 'rifle', lvl: 15, name: '死亡步枪', fx: { critDmg: 0.3, hit: 0.03 }, desc: '瞄准镜里的人，没有一个活下来。' });
EP('ep_rf_zombie', { slot: 'weapon', wtype: 'rifle', lvl: 28, abyss: true, abyssFrom: SKY, name: '僵尸猎手', fx: { ice: 25, atkElem: 'ice', dmgUp: 0.1, crit: 0.03 },
  proc: { chance: 0.03, act: 'status', status: 'freeze', dur: 1.8, name: '冰冻', desc: '冰属性攻击；攻击时 3% 几率冰冻敌人 1.8 秒。' }, desc: '专为猎杀僵尸打造，子弹里灌了冰晶。' });
// 手炮：吞日者（18，已有）→ 破极卸甲手炮 → 宝瓶之守护者 → 翼弹之祭手炮
EP('ep_hc_breaker', { slot: 'weapon', wtype: 'handcannon', lvl: 24, name: '破极卸甲手炮', fx: { stagger: 40, dmgUp: 0.06 },
  proc: [{ chance: 0.06, cd: 8, act: 'buff', buff: { atk: 0.3 }, dur: 8, key: 'breaker', name: '破极', col: '#ff9a4a', desc: '攻击时 6% 几率攻击力 +30%，持续 8 秒；' }, { chance: 0.02, act: 'debuff', taken: 0.15, dur: 6, key: 'armor', vis: 'nova', col: '#ff9a4a', name: '破甲！', desc: '2% 几率破甲：目标受到的伤害 +15%，持续 6 秒。' }], desc: '一炮就能掀掉巨人的盔甲。' });
EP('ep_hc_aqua', { slot: 'weapon', wtype: 'handcannon', lvl: 27, name: '宝瓶之守护者', fx: { ice: 25, hpPct: 0.08, dmgUp: 0.08, dmgReduce: 0.03 }, desc: '炮口雕着一只倾倒圣水的宝瓶。' });
EP('ep_hc_wing', { slot: 'weapon', wtype: 'handcannon', lvl: 30, abyss: true, abyssFrom: SKY, name: '翼弹之祭手炮', fx: { light: 25, critDmg: 0.17, dmgUp: 0.12 },
  proc: { on: 'crit', chance: 0.08, cd: 1.5, act: 'strike', mul: 2.0, aoe: 120, elem: 'light', vis: 'holy', name: '翼弹！', desc: '暴击时 8% 几率发射光之翼弹：周围敌人受到 200% 光属性伤害（冷却 1.5 秒）。' }, desc: '祭典上鸣放的礼炮，每一发都带着光之羽翼。' });
// 手弩：银月之翼（15，已有）→ 赤帝弩 → 撒旦之诱惑
EP('ep_bg_red', { slot: 'weapon', wtype: 'bowgun', lvl: 22, name: '赤帝弩', fx: { fire: 22, atkElem: 'fire', aspd: 0.05 },
  proc: { chance: 0.03, act: 'status', status: 'burn', dur: 3, dps: 0.12, vis: 'fire', name: '爆炎', desc: '火属性攻击；攻击时 3% 几率使敌人灼伤。' }, desc: '赤帝的火焰凝成了箭矢。' });
EP('ep_bg_satan', { slot: 'weapon', wtype: 'bowgun', lvl: 28, abyss: true, abyssFrom: SKY, name: '撒旦之诱惑', fx: { aspd: 0.08, dmgUp: 0.08, dark: 20 },
  proc: [{ chance: 0.04, act: 'status', status: 'slow', dur: 4, name: '诅咒', desc: '攻击时 4% 几率诅咒敌人（减速 4 秒），' }, { vs: 'slow', act: 'extra', frac: 0.15, desc: '攻击被诅咒的敌人时附加 15% 伤害。' }], desc: '扣下扳机的那一刻，你就已经被诱惑了。' });
/* ---------------- 魔法师武器 ---------------- */
// 矛：却邪战矛 → 龙人之枪（24，已有）→ 地狱熔岩
EP('ep_sp_evil', { slot: 'weapon', wtype: 'spear', lvl: 14, name: '却邪战矛', st: { atk: 70, matk: 40 }, fx: { stagger: 30, dmgUp: 0.06 }, desc: '专门驱邪的战矛，矛尖挂着一串铜铃。' });
EP('ep_sp_lava', { slot: 'weapon', wtype: 'spear', lvl: 28, abyss: true, abyssFrom: SKY, name: '地狱熔岩', fx: { fire: 25, dmgUp: 0.1, stagger: 40 },
  proc: { chance: 0.02, cd: 3, act: 'strike', mul: 2.6, aoe: 150, elem: 'fire', vis: 'fire', name: '熔岩地带！', desc: '攻击时 2% 几率喷出熔岩：周围敌人受到 260% 火属性伤害（冷却 3 秒）。' }, desc: '矛尖滴下的不是血，是岩浆。' });
// 棍棒：格雷安的战棍 → 破极卸刃棍 → 天穹之棍（24，已有）→ 无轩之幻魄
EP('ep_pl_grian', { slot: 'weapon', wtype: 'pole', lvl: 13, name: '格雷安的战棍', fx: { dmgUp: 0.07, aspd: 0.04, cspd: 0.04 }, desc: '武斗家格雷安用了一辈子的战棍。' });
EP('ep_pl_breaker', { slot: 'weapon', wtype: 'pole', lvl: 20, name: '破极卸刃棍', fx: { dmgUp: 0.05, crit: 0.03, mcrit: 0.03 },
  proc: { chance: 0.03, cd: 8, act: 'buff', buff: { atk: 0.3 }, dur: 8, key: 'polebreaker', name: '破极', col: '#ff9a4a', desc: '攻击时 3% 几率攻击力 +30%，持续 8 秒（冷却 8 秒）。' }, desc: '棍梢开了刃，打在身上像刀割。' });
EP('ep_pl_phantom', { slot: 'weapon', wtype: 'pole', lvl: 28, abyss: true, abyssFrom: SKY, name: '无轩之幻魄', fx: { dmgUp: 0.1, cdr: 0.06, aspd: 0.04, cspd: 0.04 },
  proc: { chance: 0.03, cd: 20, act: 'shield', amt: 0.3, dur: 10, name: '幻魄护体', desc: '攻击时 3% 几率获得护盾：10 秒内吸收最多 30% HP 上限的伤害（冷却 20 秒）。' }, desc: '棍中寄宿着一缕不肯离去的幻魄。' });
// 魔杖：切希尔笑脸猫 → 贤者之杖-阿斯特拉（18，已有）→ 喵喵魔杖
EP('ep_rd_cheshire', { slot: 'weapon', wtype: 'rod', lvl: 12, name: '切希尔笑脸猫', fx: { cdr: 0.06, cspd: 0.06 }, desc: '杖头的猫咪一直在笑，笑得人心里发毛。' });
EP('ep_rd_meow', { slot: 'weapon', wtype: 'rod', lvl: 27, name: '喵喵魔杖', fx: { cspd: 0.1, mcrit: 0.05, crit: 0.03, dmgUp: 0.08 },
  proc: { chance: 0.05, act: 'strike', mul: 1.3, vis: 'petal', col: '#ffb0e0', name: '喵～！', desc: '攻击时 5% 几率召唤猫咪扑击（130% 伤害）。' }, desc: '魔女伊伽贝拉最宠爱的猫咪化成的魔杖。' });
// 法杖：星海之杖-永夜（10）→ 威利的戒言法杖 → 大贤者法杖 → 溯月流光法杖
EP('ep_st_willy', { slot: 'weapon', wtype: 'staff', lvl: 20, name: '威利的戒言法杖', fx: { mcrit: 0.04, crit: 0.02, mpRegen: 0.5, dmgReduce: 0.03 },
  proc: { chance: 0.02, cd: 15, act: 'shield', amt: 0.25, dur: 7, name: '戒言', desc: '攻击时 2% 几率获得戒言护盾：7 秒内吸收最多 25% HP 上限的伤害（冷却 15 秒）。' }, desc: '法杖上刻满了威利的戒言，念一句就护一身。' });
EP('ep_st_sage', { slot: 'weapon', wtype: 'staff', lvl: 26, name: '大贤者法杖', st: { int: 40 }, fx: { dmgUp: 0.08, cspd: 0.05 },
  proc: { chance: 0.05, cd: 20, act: 'buff', buff: { cspd: 0.15, atk: 0.1 }, dur: 20, key: 'sage', name: '大贤者', col: '#b0a0ff', desc: '攻击时 5% 几率进入大贤者状态：20 秒内施放速度 +15%、攻击力 +10%（冷却 20 秒）。' }, desc: '大贤者晚年用的法杖，杖身磨得发亮。' });
EP('ep_st_moon', { slot: 'weapon', wtype: 'staff', lvl: 30, abyss: true, abyssFrom: SKY, name: '溯月流光法杖', fx: { dmgUp: 0.12, light: 25, cspd: 0.06 },
  proc: { chance: 0.06, cd: 1.2, act: 'strike', mul: 1.8, aoe: 130, elem: 'light', vis: 'bolt', name: '雷光链！', desc: '攻击时 6% 几率释放雷光链：周围敌人受到 180% 光属性伤害（冷却 1.2 秒）。' }, desc: '逆着月光流淌的光，汇成了一根法杖。' });
// 扫把：领悟者的涂鸦笔 → 夜之魔女的扫把（22，已有）→ 幸运护身符
EP('ep_br_scribble', { slot: 'weapon', wtype: 'broom', lvl: 13, name: '领悟者的涂鸦笔', fx: { cspd: 0.05, mspd: 0.04 },
  proc: { chance: 0.1, act: 'extra', frac: 0.3, col: '#ff9ad8', desc: '攻击时 10% 几率附加 30% 伤害。' }, desc: '一支会自己画画的巨大画笔，画什么就变成什么。' });
EP('ep_br_lucky', { slot: 'weapon', wtype: 'broom', lvl: 27, name: '幸运护身符', fx: { crit: 0.04, mcrit: 0.04, goldUp: 0.1, dmgUp: 0.08, mspd: 0.05 }, desc: '魔法实验大成功的几率提高了！（至少大家都这么说）' });

/* ---------------- 单件史诗防具 ---------------- */
EP('ep_head_campaign', { slot: 'head', atype: 'heavy', lvl: 11, name: '征战护肩', fx: { hardness: 20, hpPct: 0.05, aspd: 0.03 }, desc: '久经沙场的护肩，刻着数不清的刀痕。' });
EP('ep_head_skull', { slot: 'head', atype: 'plate', lvl: 18, name: '暗黑骷髅头盔', fx: { dmgReduce: 0.05, dark: 15, hpPct: 0.06 }, desc: '戴上它，连亡灵都会把你当成同伴。' });
EP('ep_head_jeno', { slot: 'head', atype: 'cloth', lvl: 25, name: '杰诺的诅咒头盔', fx: { dmgUp: 0.06, dark: 20 },
  proc: { chance: 0.04, cd: 1, act: 'strike', mul: 1.4, elem: 'dark', vis: 'dark', name: '骷髅召唤', desc: '攻击时 4% 几率召唤骷髅扑向敌人（140% 暗属性伤害）。' }, desc: '被诅咒的头盔，骷髅们会回应主人的召唤。' });
EP('ep_bottom_tiger', { slot: 'bottom', atype: 'light', lvl: 12, name: '伏虎胫甲', fx: { crit: 0.03, mcrit: 0.03, hpPct: 0.06, mspd: 0.04 }, desc: '用猛虎皮镶边的胫甲，走起路来虎虎生风。' });
EP('ep_shoes_sky', { slot: 'shoes', atype: 'plate', lvl: 12, name: '盖天战靴', fx: { dmgReduce: 0.03, mspd: 0.05, hardness: 20 }, desc: '一脚下去，地动山摇。' });
EP('ep_shoes_rabina', { slot: 'shoes', atype: 'leather', lvl: 18, name: '拉比纳的雪崩长靴', fx: { ice: 20, mspd: 0.08, aspd: 0.03 }, desc: '走过的地方会留下一串结霜的脚印。' });
EP('ep_shoes_pisco', { slot: 'shoes', atype: 'light', lvl: 24, name: '彼斯科的寒光长靴', fx: { ice: 25, mspd: 0.1, crit: 0.03, mcrit: 0.03 }, desc: '靴刃上闪着寒光。' });
EP('ep_belt_oath', { slot: 'belt', atype: 'heavy', lvl: 16, name: '誓约者腰带', fx: { hpPct: 0.08, dmgReduce: 0.03, str: 10, int: 10 }, desc: '骑士立誓时系上的腰带，一生只解下一次。（本作原创）' });
EP('ep_belt_storm', { slot: 'belt', atype: 'leather', lvl: 24, name: '风暴行者腰带', fx: { aspd: 0.05, cspd: 0.05, mspd: 0.06, dmgUp: 0.04 }, desc: '系上它，风暴都追不上你。（本作原创）' });
// 狂龙赫斯（官方胸甲 / 胫甲一对）：本作做成 2 件套
defineSet('set_hes', { name: '狂龙赫斯的龙骨', epic: true, bonus: { 2: { st: { dmgUp: 0.08, fire: 15 }, desc: '伤害增加 8%，火属性强化 +15；攻击时 5% 几率龙息喷射（150% 火属性伤害）', proc: { chance: 0.05, cd: 1, act: 'strike', mul: 1.5, elem: 'fire', vis: 'fire', name: '龙息！' } } } });
const epicPiece = (setId, key, def) => { const D = defineGear(key, { rar: 5, fx: {}, icon: 'item_' + key, ...def, set: setId }); SETS[setId].pieces.push(key); return D; };
epicPiece('set_hes', 'ep_top_hes', { slot: 'top', atype: 'heavy', lvl: 22, name: '狂龙赫斯的龙骨胸甲', fx: { hpPct: 0.06, str: 15, int: 15 }, desc: '狂龙赫斯的胸骨磨成的胸甲，还带着余温。' });
epicPiece('set_hes', 'ep_bottom_hes', { slot: 'bottom', atype: 'heavy', lvl: 22, name: '狂龙赫斯的龙骨胫甲', fx: { hpPct: 0.06, hardness: 20 }, desc: '狂龙赫斯的腿骨做成的胫甲。' });

/* ---------------- 单件史诗首饰 / 特殊装备 ---------------- */
EP('ep_neck_hunter', { slot: 'neck', lvl: 20, name: '灵魂猎者', fx: { dmgUp: 0.04, cdr: 0.04 },
  proc: { on: 'kill', chance: 0.1, cd: 30, act: 'buff', buff: { atk: 0.2 }, dur: 20, key: 'soulhunter', name: '灵魂猎者', col: '#c080ff', desc: '击杀敌人时 10% 几率吞噬灵魂：20 秒内攻击力 +20%（冷却 30 秒）。' }, desc: '吊坠里关着猎来的灵魂。' });
EP('ep_brace_wave', { slot: 'bracelet', lvl: 20, name: '波动之魂', fx: { stagger: 30, elemAll: 10, dmgUp: 0.04 }, desc: '戴上它，能感觉到空气里的波动。' });
EP('ep_ring_devour', { slot: 'ring', lvl: 18, name: '噬灵之戒', fx: { rdark: 23, dmgUp: 0.06, crit: 0.02, mcrit: 0.02 }, desc: '专门吞噬恶魔之灵的戒指。' });
EP('ep_ring_ice', { slot: 'ring', lvl: 16, name: '冰精灵之戒', fx: { ice: 18, crit: 0.03, mcrit: 0.03 },
  proc: { on: 'hurt', chance: 0.2, cd: 3, act: 'strike', mul: 1.2, elem: 'ice', vis: 'ice', name: '冰精灵', desc: '被击时 20% 几率召唤冰精灵反击（120% 冰属性伤害，冷却 3 秒）。' }, desc: '冰之精灵祝福过的戒指。' });
EP('ep_ring_fire', { slot: 'ring', lvl: 20, name: '火精灵之戒', fx: { fire: 20, crit: 0.03, mcrit: 0.03 },
  proc: { on: 'hurt', chance: 0.2, cd: 3, act: 'strike', mul: 1.3, elem: 'fire', vis: 'fire', name: '火精灵', desc: '被击时 20% 几率召唤火精灵反击（130% 火属性伤害，冷却 3 秒）。' }, desc: '火之精灵祝福过的戒指。' });
EP('ep_sup_michel', { slot: 'support', lvl: 16, name: '米歇尔的祝福', fx: { resAll: 15, dmgReduce: 0.04, allStat: 10 }, desc: '圣职者米歇尔亲手祝福过的护符。' });
EP('ep_sup_paris', { slot: 'support', lvl: 26, name: '帕丽丝的家族象征', fx: { dmgUp: 0.08, allStat: 20 },
  proc: { vs: 'any', act: 'extra', frac: 0.15, desc: '攻击处于异常状态（灼伤、中毒、出血、冰冻、眩晕、减速）的敌人时附加 15% 伤害。' }, desc: '帕丽丝家族代代相传的徽记。' });
EP('ep_stone_platani', { slot: 'stone', lvl: 22, noDrop: true, src: '石巨人塔的领主（黄金巨人 普拉塔尼）', name: '普拉塔尼的黄金石', fx: { allStat: 30, hpPct: 0.04 }, desc: '黄金巨人普拉塔尼的核心碎片。只有石巨人塔的领主会掉落它。' });
EP('ep_stone_grelin', { slot: 'stone', lvl: 28, abyss: true, abyssFrom: SKY, name: '极光格雷林之泪', fx: { light: 35, dmgUp: 0.05 }, desc: '极光龙格雷林的眼泪，凝成了永不融化的晶石。' });
EP('ep_stone_herik', { slot: 'stone', lvl: 28, abyss: true, abyssFrom: SKY, name: '火焰赫瑞克的眼泪', fx: { fire: 35, dmgUp: 0.05 }, desc: '火龙赫瑞克的眼泪，握在手里会发烫。' });
EP('ep_stone_aqui', { slot: 'stone', lvl: 28, abyss: true, abyssFrom: SKY, name: '冰影阿奎利斯之泪', fx: { ice: 35, dmgUp: 0.05 }, desc: '冰龙阿奎利斯的眼泪，里面封着一片雪原。' });
EP('ep_stone_merkel', { slot: 'stone', lvl: 28, abyss: true, abyssFrom: SKY, name: '亡魂默克尔之泪', fx: { dark: 35, dmgUp: 0.05 }, desc: '亡魂默克尔的眼泪，夜里会发出幽光。' });

/* ---------------- Lv20 史诗三件套（上衣 / 下装 / 腰带，格兰之森深渊）：官方 70 版 Lv60 的五个三件小套 ---------------- */
function epicSet3(id, name, atype, names, bonus, extra = {}) {
  defineSet(id, { name, bonus, epic: true });
  ['top', 'bottom', 'belt'].forEach((s, i) => epicPiece(id, `${id}_${s}`, { slot: s, atype, lvl: 20, abyss: true, abyssFrom: GF, name: names[i], ...extra }));
}
epicSet3('set_witch', '愤怒魔女的炙焰战袍', 'cloth', ['炙焰魔女的长袍', '炙焰魔女的长裙', '炙焰魔女的束带'], {
  2: { st: { fire: 20, int: 20, str: 20 }, desc: '火属性强化 +20，力量 / 智力 +20' },
  3: { st: { cspd: 0.08, dmgUp: 0.08, fire: 15 }, desc: '【属性流】施放速度 +8%，伤害增加 8%，火属性强化 +15；攻击时 6% 几率引发炙焰爆裂（周围 150% 火属性伤害）', proc: { chance: 0.06, cd: 1, act: 'strike', mul: 1.5, aoe: 120, elem: 'fire', vis: 'fire', name: '炙焰爆裂！' } } }, { desc: '愤怒的魔女留下的战袍，火焰从未熄灭。' });
epicSet3('set_ironbeast', '千年玄铁兽', 'leather', ['玄铁兽皮甲', '玄铁兽皮裤', '玄铁兽皮带'], {
  2: { st: { crit: 0.04, mcrit: 0.04 }, desc: '暴击率 +4%' },
  3: { st: { critDmg: 0.2, dmgUp: 0.06 }, desc: '【暴击流】暴击伤害 +20%，伤害增加 6%；暴击时 8% 几率撕咬（130% 伤害）', proc: { on: 'crit', chance: 0.08, act: 'strike', mul: 1.3, vis: 'slash', col: '#c8d0dc', name: '玄铁獠牙' } } }, { desc: '千年玄铁兽的皮，刀枪不入。' });
epicSet3('set_krom', '克罗姆的生命', 'light', ['克罗姆的生命胸甲', '克罗姆的生命绑腿', '克罗姆的生命腰带'], {
  2: { st: { hpPct: 0.08, aspd: 0.04, cspd: 0.04 }, desc: 'HP 上限 +8%，攻击 / 施放速度 +4%' },
  3: { st: { aspd: 0.06, cspd: 0.06, mspd: 0.06, dmgUp: 0.06 }, desc: '【攻速流】攻击 / 施放 / 移动速度 +6%，伤害增加 6%；击杀敌人时 30% 几率恢复 3% HP', proc: { on: 'kill', chance: 0.3, act: 'heal', hp: 0.03 } } }, { desc: '克罗姆用生命之树的藤蔓编成的轻甲。' });
epicSet3('set_xuanming', '玄冥精灵', 'heavy', ['玄冥精灵胸甲', '玄冥精灵绑腿', '玄冥精灵腰带'], {
  2: { st: { cdr: 0.05, dark: 12, ice: 12 }, desc: '技能冷却 -5%，暗 / 冰属性强化 +12' },
  3: { st: { cdr: 0.07, dmgUp: 0.08 }, desc: '【冷却流】技能冷却 -7%，伤害增加 8%；施放技能时 6% 几率重置冷却', proc: { on: 'skill', chance: 0.06, act: 'reset', name: '玄冥！' } } }, { desc: '北方玄冥之地的精灵守护着这身重甲。' });
epicSet3('set_ruins', '古代遗迹守护者', 'plate', ['遗迹守护者胸甲', '遗迹守护者护腿', '遗迹守护者腰带'], {
  2: { st: { defPct: 0.08, hpPct: 0.08 }, desc: '防御力 +8%，HP 上限 +8%' },
  3: { st: { dmgReduce: 0.08, dmgUp: 0.05, hardness: 30 }, desc: '【生存流】受到的伤害 -8%，伤害增加 5%，硬直 +30；HP 低于 30% 时获得吸收 25% HP 上限伤害的护盾（冷却 45 秒）', proc: { on: 'lowhp', cd: 45, act: 'shield', amt: 0.25, dur: 8, name: '遗迹守护' } } }, { desc: '古代遗迹的守护者代代穿着的板甲。' });

/* ---------------- Lv28 史诗五件套（天空之城深渊）：官方 70 级五件套 ---------------- */
function epicSet5(id, name, atype, names, bonus, desc) {
  defineSet(id, { name, bonus, epic: true });
  ARMOR_SLOTS.forEach((s, i) => epicPiece(id, `${id}_${s}`, { slot: s, atype, lvl: 28, abyss: true, abyssFrom: SKY, name: names[i], desc }));
}
epicSet5('set_tremor', '战场颤栗者', 'cloth', ['凝血神咒胸甲', '畏惧者的丝绸护肩', '颤栗者的裂心护腿', '神咒之丝绸腰带', '杀手之潜行短靴'], {
  2: { st: { cspd: 0.08, mspd: 0.05 }, desc: '施放速度 +8%，移动速度 +5%' },
  3: { st: { str: 40, int: 40, dmgUp: 0.06 }, desc: '力量 / 智力 +40，伤害增加 6%' },
  5: { st: { dmgUp: 0.12, cspd: 0.06 }, desc: '【群战流】伤害增加 12%，施放速度 +6%；每击杀 1 个敌人攻击力 +3%，最多叠加 10 层，持续 8 秒', proc: { on: 'kill', act: 'buff', buff: { atk: 0.03 }, dur: 8, stack: 10, key: 'tremor', name: '颤栗', col: '#c05aff' } } }, '战场上让敌人颤栗的丝绸战衣。');
epicSet5('set_reaper', '心脏收割者', 'leather', ['冥王之预言胸甲', '冥王之诡术护肩', '冥王之破魔绑腿', '冥王之幻影腰带', '龙光隐翼短靴'], {
  2: { st: { crit: 0.05, mcrit: 0.05 }, desc: '暴击率 +5%' },
  3: { st: { str: 40, int: 40, critDmg: 0.15 }, desc: '力量 / 智力 +40，暴击伤害 +15%' },
  5: { st: { critDmg: 0.2, dmgUp: 0.1 }, desc: '【暴击流】暴击伤害 +20%，伤害增加 10%；暴击时 15% 几率降下红色闪电（80% 伤害）并使敌人出血', proc: [{ on: 'crit', chance: 0.15, cd: 0.5, act: 'strike', mul: 0.8, vis: 'bolt', col: '#ff3a3a', name: '红色闪电' }, { on: 'crit', chance: 0.15, act: 'status', status: 'bleed', dur: 4, dps: 0.12 }] } }, '冥王的眷属穿过的皮甲，专收敌人的心脏。');
epicSet5('set_arad', '阿拉德之息', 'light', ['阿法利亚之息胸甲', '斯顿雪域冰霜护肩', '海岸三番街之息绑腿', '西海岸之息腰带', '赫顿玛尔之息短靴'], {
  2: { st: { aspd: 0.06, cspd: 0.06 }, desc: '攻击 / 施放速度 +6%' },
  3: { st: { mspd: 0.08, dmgReduce: 0.05 }, desc: '移动速度 +8%，受到的伤害 -5%' },
  5: { st: { dmgUp: 0.1, aspd: 0.05, cspd: 0.05 }, desc: '【攻速流】伤害增加 10%，攻击 / 施放速度 +5%；每次命中获得 1 层疾风之息（攻速 / 施放 +1.5%、移速 +1%），最多 10 层，3 秒不命中消失', proc: { act: 'buff', buff: { aspd: 0.015, cspd: 0.015, mspd: 0.01 }, dur: 3, stack: 10, key: 'arad', name: '疾风之息', col: '#8affc8' } } }, '吹遍阿拉德大陆的风，凝成了这身轻甲。');
epicSet5('set_evilgod', '邪神之怒', 'heavy', ['邪神之怒胸甲', '邪神之怒护肩', '邪神之怒绑腿', '邪神之怒腰带', '邪神之怒长靴'], {
  2: { st: { hp: 990, aspd: 0.05, resAll: 13 }, desc: 'HP 上限 +990，攻击速度 +5%，所有属性抗性 +13' },
  3: { st: { str: 40, int: 40, hpPct: 0.1 }, desc: '力量 / 智力 +40，HP 上限 +10%' },
  5: { st: { dmgUp: 0.1, hardness: 40 }, desc: '【残血流】伤害增加 10%，硬直 +40；HP 低于 30% 时恢复 30% HP，并在 10 秒内伤害 +50%（冷却 60 秒）', proc: [{ on: 'lowhp', cd: 60, act: 'heal', hp: 0.3, name: '邪神之怒！', txtCol: '#ff3a3a' }, { on: 'lowhp', cd: 60, act: 'buff', buff: { dmg: 0.5 }, dur: 10, key: 'evilgod', name: '邪神之怒', col: '#ff3a3a' }] } }, '邪神的怒火灌注在这身重甲里。（各件名字本作原创）');
epicSet5('set_kingtear', '王者之泪', 'plate', ['领主的灭魂胸甲', '血武之魂护肩', '皮埃罗的复仇护腿', '圣战之威腰带', '夜神的探索短靴'], {
  2: { st: { defPct: 0.1, vit: 30, spr: 30 }, desc: '防御力 +10%，体力 / 精神 +30' },
  3: { st: { hpPct: 0.12, hardness: 40, str: 30, int: 30 }, desc: 'HP 上限 +12%，硬直 +40，力量 / 智力 +30' },
  5: { st: { dmgUp: 0.1, dmgReduce: 0.08 }, desc: '【守护流】伤害增加 10%，受到的伤害 -8%；攻击时 8% 几率削弱敌人：目标受到的伤害 +12%，持续 6 秒', proc: { chance: 0.08, act: 'debuff', taken: 0.12, dur: 6, key: 'kingtear', vis: 'holy', col: '#ffe8a0', name: '王者之威' } } }, '为守护王座流下的泪，铸成了最坚固的板甲。');

/* ---------------- 史诗首饰套装（项链 / 手镯 / 戒指） ---------------- */
function epicAcc3(id, name, lvl, names, bonus, extra = {}) {
  defineSet(id, { name, bonus, epic: true });
  ACC_SLOTS.forEach((s, i) => epicPiece(id, `${id}_${s}`, { slot: s, lvl, abyss: true, name: names[i], ...extra }));
}
epicAcc3('set_wargod', '战神的天袭', 24, ['战神的项链', '战神的手镯', '战神的戒指'], {
  2: { st: { str: 25, int: 25, elemAll: 10 }, desc: '力量 / 智力 +25，所有属性强化 +10' },
  3: { st: { dmgUp: 0.08 }, desc: '【连击流】伤害增加 8%；连击达到 50 时攻击 / 施放 / 移动速度 +10%，达到 100 时攻击力 +10%（各持续 10 秒）', proc: [{ combo: 50, cd: 10, act: 'buff', buff: { aspd: 0.1, cspd: 0.1, mspd: 0.1 }, dur: 10, key: 'wargod1', name: '战神·疾', col: '#ffd23a' }, { combo: 100, cd: 10, act: 'buff', buff: { atk: 0.1 }, dur: 10, key: 'wargod2', name: '战神·怒', col: '#ff6a3a' }] } }, { abyssFrom: '深渊派对', desc: '战神从天而降时佩戴的首饰。' });
epicAcc3('set_timelord', '时空主宰者', 28, ['时空主宰者的项链', '时空主宰者的手镯', '时空主宰者的戒指'], {
  2: { st: { cdr: 0.06, cspd: 0.05 }, desc: '技能冷却 -6%，施放速度 +5%' },
  3: { st: { cdr: 0.08, dmgUp: 0.08 }, desc: '【冷却流】技能冷却 -8%，伤害增加 8%；施放技能时 10% 几率重置冷却', proc: { on: 'skill', chance: 0.1, act: 'reset', name: '时空回溯' } } }, { abyssFrom: SKY, desc: '主宰时空的人，从不等待冷却。' });
epicAcc3('set_otherstone', '精炼的异界魔石', 30, ['异界魔石项链', '异界魔石手镯', '异界魔石戒指'], {
  2: { st: { elemAll: 17, crit: 0.06, mcrit: 0.06 }, desc: '所有属性强化 +17，暴击率 +6%' },
  3: { st: { dmgUp: 0.15, elemAll: 10, resAll: -24 }, desc: '【属性流】伤害增加 15%，所有属性强化 +10，但所有属性抗性 -24' } }, { abyssFrom: SKY, desc: '从异界带回来的魔石，力量强大但并不稳定。' });

/* ---------------- 异界套装（传说，Lv22，每个转职一套：项链 / 手镯 / 戒指）：官方异界套的技能特化，在深渊派对掉落 / 歌兰蒂斯处兑换 ----------------
   技能冷却减少与技能伤害加成用 skillUse 事件实现（施放后立刻减冷却；伤害加成是施放后 2 秒内的 BUFF） */
function otherSet(id, name, job, skill, names, sec, dmg, extra2, origin) {
  const skName = () => (SKILLS[skill] || {}).name || skill;
  defineSet(id, { name, job, bonus: {
    2: { st: extra2, desc: Object.keys(extra2).map(k => statLine(k, extra2[k])).join('，') },
    3: { st: {}, get desc() { return `【${(CLASSES && Object.values(CLASSES).map(C => C.jobs && C.jobs[job]).find(Boolean) || {}).name || job}】${skName()} 冷却时间 -${sec} 秒，施放后 2 秒内伤害 +${Math.round(dmg * 100)}%`; }, proc: [{ on: 'skill', skill, act: 'skillcd', sec }, { on: 'skill', skill, act: 'buff', buff: { dmg }, dur: 2, key: id, name: skName(), col: '#ff9a4a' }] } } });
  ACC_SLOTS.forEach((s, i) => defineGear(`${id}_${s}`, { slot: s, lvl: 22, rar: 4, fx: {}, named: true, noDrop: true, set: id, name: names[i], abyss: true, src: '深渊派对掉落；歌兰蒂斯处用浓密的异界精髓兑换', desc: origin }) && SETS[id].pieces.push(`${id}_${s}`));
}
otherSet('set_ow_blade', '秘技传授者', 'blade', 'rise', ['秘技传授者的项链', '秘技传授者的手镯', '秘技传授者的戒指'], 3, 0.12, { str: 25, crit: 0.03 }, '剑魂的秘技传承。官方异界套：破军升龙击冷却 -3 秒、攻击 +12%。');
otherSet('set_ow_berserker', '终极鲁莽', 'berserker', 'outrage', ['终极鲁莽的项链', '终极鲁莽的手镯', '终极鲁莽的戒指'], 6, 0.15, { str: 25, hpPct: 0.05 }, '狂战士的鲁莽之力。官方异界套：怒气爆发冷却 -6 秒。');
otherSet('set_ow_ranger', '爆裂信徒', 'ranger', 'g_multi', ['爆裂信徒的项链', '爆裂信徒的手镯', '爆裂信徒的戒指'], 6, 0.15, { str: 25, aspd: 0.04 }, '漫游枪手的爆裂信仰。官方异界套：多重爆头冷却 -6 秒、发射数 +1。');
otherSet('set_ow_launcher', '歼灭突击', 'launcher', 'gl_cannon', ['歼灭突击的项链', '歼灭突击的手镯', '歼灭突击的戒指'], 1.5, 0.3, { str: 25, stagger: 30 }, '枪炮师的歼灭火力。官方异界套：加农炮冷却 -1.5 秒、攻击 +30%。');
otherSet('set_ow_elemental', '元素的低语', 'elemental', 'mg_hole', ['元素低语项链', '元素低语手镯', '元素低语戒指'], 4, 0.15, { int: 25, elemAll: 10 }, '元素师的元素之力。（本作原创：湮灭黑洞冷却 -4 秒）');
otherSet('set_ow_battlemage', '炫纹大师', 'battlemage', 'bm_press', ['炫纹大师的项链', '炫纹大师的手镯', '炫纹大师的戒指'], 3, 0.15, { int: 20, str: 20, aspd: 0.03 }, '战斗法师的炫纹奥义。（本作原创：炫纹强压冷却 -3 秒）');
/* ---------------- 天帷巨兽的名品（传说，Lv25~30）：只在对应领主的掉落表里（content/items/droptables.js），不随机掉落；分配按官方（地下城内容组确认） ---------------- */
const LG = (key, def) => defineGear(key, { rar: 4, named: true, noDrop: true, fx: {}, ...def });
LG('lg_sage_ring', { slot: 'ring', lvl: 29, name: '贤者之戒', fx: { cdr: 0.05, mpRegen: 0.5, crit: 0.03, mcrit: 0.03 }, st: { int: 20, str: 20 },
  proc: { on: 'skill', chance: 0.1, act: 'heal', mp: 0.05, desc: '施放技能时 10% 几率恢复 5% MP。' }, desc: '一位不知名的贤者留下的戒指，戴上后思绪格外清明。' });
LG('lg_karo_eye', { slot: 'stone', lvl: 30, name: '卡罗蛇眼', fx: { crit: 0.04, mcrit: 0.04, critDmg: 0.1, elemAll: 12 }, desc: '巨蛇卡罗的眼睛化成的宝石，能看穿敌人的破绽。' });
LG('lg_fan_robe', { slot: 'top', atype: 'cloth', lvl: 25, name: '梵风衣', fx: { mspd: 0.08, cspd: 0.08, evade: 0.03 },
  proc: { on: 'hurt', chance: 0.12, cd: 6, act: 'buff', buff: { mspd: 0.15, aspd: 0.05 }, dur: 5, key: 'fanrobe', name: '梵风', col: '#9affd8', desc: '被击时 12% 几率乘风：5 秒内移动速度 +15%、攻击速度 +5%（冷却 6 秒）。' }, desc: '随风飘扬的法衣，据说能让穿的人像风一样轻。' });
LG('lg_light_dance', { slot: 'bracelet', lvl: 26, name: '光之舞手镯', fx: { light: 25, aspd: 0.05, cspd: 0.05 },
  proc: { chance: 0.05, cd: 1, act: 'strike', mul: 1.2, elem: 'light', vis: 'holy', name: '光之舞', desc: '攻击时 5% 几率降下光之舞（120% 光属性伤害）。' }, desc: '手镯上的光点会随着主人的动作起舞。' });
LG('lg_holy_pendant', { slot: 'neck', lvl: 28, name: '圣灵战士项坠', fx: { allStat: 25, dmgReduce: 0.05, dmgUp: 0.05 },
  proc: { on: 'lowhp', cd: 60, act: 'shield', amt: 0.3, dur: 8, name: '圣灵守护', desc: 'HP 低于 30% 时获得圣灵守护：8 秒内吸收最多 30% HP 上限的伤害（冷却 60 秒）。' }, desc: '圣灵战士代代相传的项坠，危急时刻会发出光芒。' });
}
