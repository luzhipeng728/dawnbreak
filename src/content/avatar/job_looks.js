/* =====================================================================
   转职外观（转职后一眼看出是谁）：每个转职 = 一条数据 + 可选的绘制钩子。官方依据与配方见 docs/JOB_VISUALS.md
   渲染在 models/job_fx.js（外观层 AvatarLayer 的 under / over 里调用），所以城镇、地下城、选角、个人信息、决斗、
   其他玩家（look.job 随 look 一起发出去）、组队影子、AI 对手（kit.job）都一样；覆盖层叠在最上面，任何时装 / 混搭都能用。
   字段（全部可选；组件参数的详细说明在 job_fx.js 各组件函数的注释里）：
     col     这个转职的代表色（总览图 / 说明用）
     hair    发色（整头头发换成这个颜色、保留明暗；只有鬼剑士 / 魔法师能分出头发，见 job_fx.js 的 jlHair）
     acc     头部配件 key（AVATAR_ACC，按头部锚点叠加；和时装冲突的按 clash 让给时装，见下面的转职头饰）；noFace: 1 = 戴着它时不画时装眼镜
     常驻组件（城镇里也有）：
       arm     副手（鬼手）火舌，锚点 F.oh（art/tools/avatar_hands.py，目前只有鬼剑士）：{ col, h, n, a, motes, drip }
       eyes    眼睛发光（头部锚点 + JL_EYE[职业]）：{ col, r, trail 1 = 移动时往后拖一道光 }
       spirit  身后的小鬼神（fx/jv_wisp）：{ col, h, a }
       orbit   绕身体转的小东西（光剑 / 元素珠 / 追踪球 / 无人机…）：{ img, col, n, h, rx, ry, y, spd, side: 'back' }
       prop    身上的道具 [{ img（'weapon/<key>' 或特效名）, at: head | back | waist | hand, x, y, h, ang, front, noWpn }]
       pet     小伙伴（精灵帧：机器人 / 光精灵 / 人偶熊…）：{ spr, h, x, y, fly, hop, move, at, strings, hide(e) }
       ring    脚下的法阵 / 波纹：{ img, col, r, spin, a, n, spd, upright }
       motes   飘动的颗粒（花瓣 / 泡泡 / 火星 / 十字）：{ img, col, n, h, rise, life, y0 }
       aura    气场（外轮廓 + 光雾）：{ col, a, haze, tint }
       wtint   武器染色：颜色 或 { col, a }
     states  状态特效 [{ id, name 技能名, on(e) → 强度（0 = 没开）, demo(e) 测试 / 总览图里把它打开, fx }]；fx 里可以放上面任何组件（按强度放大），另有：
               ghost { col, a } 身后鬼影；trail { col, a } 移动残影；fade { a, col } 无敌时半透明；wisps { col, n } 环绕鬼火；burn { col, n, h } 全身燃烧；arcs { col, n } 身上电光
             状态里有的组件代替常驻的同名组件（例：元素师的小元素珠 → 元素点燃时的大元素珠）。
     draw    (c, L, F, f, back, e) → 自定义钩子（back = true 画在人物身后，false 画在身前；坐标见 job_fx.js 头注释）
   颜色 / 素材参数可以是数组（按编号轮流）或函数 (e, i) → 值（按实体状态变）。
   新增一个转职的外观：在 JOB_LOOKS 里加一条，需要特殊画法再写 draw；特效素材先找 art/final/fx 现成的，没有再用 art/tools/jobvis_art.py 出。
   ===================================================================== */
// 阿修罗的 X 形眼罩（原来在 sword_asura.js，只给自己看；挪到这里后其他玩家也看得到）
AVATAR_ACC.job_asura_eyes = { img: 'asura_face', face: 1, pos: { sword: [9, 25, 0, 0.66], 'sword@': [9, 25, 0, 0.66] } };
/* 转职头饰（每个转职一件，图 art/final/avatar/job_<id>.webp，art/tools/job_head_art.py 出图）：pos 同 AVATAR_ACC（looks.js 头注释）；
   神枪手 / 魔法师的默认造型自带帽子（报童帽 / 巫师帽），pos[职业] = 戴着默认帽子的头，pos[职业@] = 时装的头（没帽子）。
   clash：和时装的哪个部位冲突（'hat' 帽子 / 'hair' 发饰 / 'face' 脸部）→ 玩家戴着那件时装时这件不画（时装优先）；不写 = 一直画（眼镜 / 面罩 / 耳机这类不挡帽子的） */
Object.assign(AVATAR_ACC, {
  // 鬼剑士（头心 = 头部中心，眼睛约在 [15, 21]）
  job_blade_band: { img: 'job_blade_band', clash: ['hat'], pos: { sword: [-2, 2, -0.12, 1] } },
  job_soulbender_charm: { img: 'job_soulbender_charm', pos: { sword: [-2, 16, 0.05, 1.45] } },
  job_berserker_bandage: { img: 'job_berserker_bandage', clash: ['hat'], pos: { sword: [-2, 2, -0.12, 1] } },
  job_ghostblade_mask: { img: 'job_ghostblade_mask', face: 1, pos: { sword: [12, 32, 0, 0.8] } },
  // 神枪手（默认头心在报童帽上，眼睛约在 [21, 14]；时装头 [24, 9]）
  job_ranger_hat: { img: 'job_ranger_hat', clash: ['hat'], pos: { gun: [2, -26, -0.08, 1.05], 'gun@': [2, -24, -0.08, 0.95] } },
  job_launcher_goggles: { img: 'job_launcher_goggles', clash: ['hat'], pos: { gun: [8, -14, -0.2, 0.72], 'gun@': [10, -10, -0.15, 0.72] } },
  job_mechanic_cap: { img: 'job_mechanic_cap', clash: ['hat'], pos: { gun: [4, -18, -0.05, 1.05], 'gun@': [4, -18, -0.05, 0.95] } },
  job_spitfire_bandana: { img: 'job_spitfire_bandana', clash: ['hat'], pos: { gun: [0, -16, -0.05, 1.05], 'gun@': [0, -14, -0.05, 0.95] } },
  job_paramedic_headset: { img: 'job_paramedic_headset', pos: { gun: [-6, 2, 0, 0.95], 'gun@': [-6, -2, 0, 0.95] } },
  // 魔法师（默认头心在巫师帽的帽带上，眼睛约在 [18, 38]；时装头 [21, 6]）
  job_elemental_tiara: { img: 'job_elemental_tiara', pos: { mage: [10, 19, -0.1, 1.15], 'mage@': [8, -13, -0.1, 1.15] } },
  job_battlemage_band: { img: 'job_battlemage_band', clash: ['hat'], pos: { mage: [4, 27, -0.1, 0.9], 'mage@': [2, -6, -0.1, 0.9] } },
  job_summoner_horns: { img: 'job_summoner_horns', clash: ['hat'], pos: { mage: [0, 36, 0, 0.9], 'mage@': [2, 4, 0, 0.9] } },
  job_witch_glasses: { img: 'job_witch_glasses', face: 1, clash: ['face'], pos: { mage: [17, 40, 0, 0.78], 'mage@': [20, 8, 0, 0.78] } },
  job_enchantress_bow: { img: 'job_enchantress_bow', clash: ['hair'], pos: { mage: [-30, 40, 0, 1], 'mage@': [-32, 14, 0, 1] } },
});
const jlBuff = id => e => e.buffs && e.buffs[id] ? 1 : 0;              // 有这个 BUFF → 强度 1
const jlDemo = (id, o = {}) => e => { e.buffs[id] = { t: 9999, ...o }; };
const JL_SF_COL = { fire: '#ff6a2a', ice: '#6ad8ff', light: '#ffe45a' };   // 弹药专家超负荷装填的属性色（无属性 = 白）
const jlSfCol = e => (e && e.buffs && e.buffs.gs_overcharge && JL_SF_COL[e.buffs.gs_overcharge.elem]) || '#f4f4ff';

const JOB_LOOKS = {
  /* ================= 鬼剑士 ================= */
  // 剑魂：武器精通 —— 刀身一圈淡青剑气、身后悬着两把光剑；破极兵刃 = 五把光剑绕身 + 刀身白光 + 青色剑气
  blade: {
    col: '#8fe0ff', hair: '#9a6038', acc: ['job_blade_band'],
    wtint: { col: '#9fe8ff', a: 0.55 },
    orbit: { img: 'swordrain', col: '#9fe8ff', n: 2, h: 22, rx: 9, ry: 3, x: -16, y: 0.72, spd: 0.5, a: 0.8, add: 1, side: 'back' },
    motes: { img: 'dot', col: '#bff4ff', n: 4, h: 1.8, rise: 26, life: 1.4, a: 0.8 },
    states: [{ id: 'edge', name: '破极兵刃', on: jlBuff('wm_edge'), demo: jlDemo('wm_edge'),
      fx: { wtint: { col: '#e8fbff', a: 1.3 }, orbit: { img: 'swordrain', col: '#aef0ff', n: 5, h: 28, rx: 30, ry: 8, y: 0.5, spd: 1.6, a: 0.95, add: 1 }, aura: { col: '#7ad8ff', a: 0.28, haze: 0.18 } } }],
  },
  // 鬼泣：左臂鬼手冒紫色鬼火、身后跟着一只小鬼神；残影之凯贾（俗称鬼影步）= 身后鬼影 + 残影 + 前冲无敌时半透明；阵在场时身边鬼火环绕（鬼影重重）
  soulbender: {
    col: '#9a6aff', hair: '#9a8cc0', acc: ['job_soulbender_charm'],
    arm: { col: '#8a5cff', h: 30, n: 2, a: 0.95, motes: '#c8b0ff' },
    spirit: { col: '#9a7aff', h: 38, a: 0.8 },
    states: [
      { id: 'kaiga', name: '残影之凯贾（鬼影步）', on: jlBuff('sb_kaiga'), demo: jlDemo('sb_kaiga'), fx: { ghost: { col: '#7a6aff', a: 0.42 }, trail: { col: '#9a8aff', a: 0.45 }, fade: { a: 0.45, col: '#b8a8ff' } } },
      { id: 'field', name: '阵（鬼影重重）', on: e => typeof summonsOf === 'function' ? Math.min(3, summonsOf(e, { tag: 'field' }).length) : 0, demo: e => summon(e, 'sb_plemon_f', { x: e.x + 30, y: e.y + 50, lv: 1 }), fx: { wisps: { col: '#9a7aff', n: 1 } } },
    ],
  },
  // 狂战士（红眼）：眼睛红光 + 移动时拖出红色光带、鬼手滴血冒血气；狂暴之力 = 全身血焰 + 双刀染红；暴走再叠一层（火更大更多）
  berserker: {
    col: '#e01020', hair: '#962430', acc: ['job_berserker_bandage'],
    arm: { col: '#ff1a30', h: 26, n: 2, a: 0.9, motes: '#ff7a6a', drip: '#9a0018' },
    eyes: { col: '#ff1a28', r: 3.2, trail: 1 },
    states: [
      { id: 'burn', name: '狂暴之力（+ 暴走）', on: e => e.buffs ? (e.buffs.frenzy ? 1 : 0) + (e.buffs.rampage ? 1 : 0) : 0, demo: jlDemo('frenzy'), fx: { burn: { col: '#ff2a2a', n: 8, h: 34 } } },
      { id: 'frenzy', name: '狂暴之力（血色双刀）', on: jlBuff('frenzy'), demo: jlDemo('frenzy'), fx: { wtint: '#ff2030' } },
    ],
  },
  // 阿修罗：X 形眼罩下透出波动之光、脚下一圈圈扩散的波动；杀意波动（无尽波动）= 大范围波动 + 全身蓝紫波动之焰；波动刻印 = 身边绕着波动印（几个印就几颗）
  asura: {
    col: '#8a7aff', acc: ['job_asura_eyes'], noFace: 1,
    eyes: { col: '#8ab0ff', r: 2.6 },
    ring: { col: '#8a9aff', r: 26, n: 2, spd: 0.5, a: 0.5 },
    states: [
      { id: 'aura', name: '杀意波动（无尽波动）', on: jlBuff('as_aura'), demo: jlDemo('as_aura'), fx: { ring: { col: '#7a8aff', r: 70, n: 4, spd: 0.9, a: 0.95 }, burn: { col: '#6a7aff', n: 6, h: 26 } } },
      { id: 'mark', name: '波动刻印', on: e => e.buffs && e.buffs.as_mark ? e.buffs.as_mark.n || 0 : 0, demo: jlDemo('as_mark', { n: 3 }), fx: { orbit: { img: 'dot', col: '#b0a0ff', n: 1, nLv: 1, h: 4, rx: 24, ry: 6, y: 0.5, spd: 1.8 } } },
    ],
  },
  // 剑影：身后跟着半透明的幻鬼（幻鬼真的现身时不画）、灵魂之手冒蓝色魂火；双魂共鸣 = 幻鬼亮起 + 移动残影 + 蓝色魂气 + 刀身蓝光
  ghostblade: {
    col: '#6aa8ff', hair: '#343848', acc: ['job_ghostblade_mask'],
    arm: { col: '#5a9aff', h: 22, n: 2, a: 0.85, motes: '#bfe0ff' },
    pet: { spr: 'phantom', idle: 'pfloat', h: 66, x: -36, y: -16, fly: 3, a: 0.5, tint: '#6a9aff', hide: e => typeof summonsOf === 'function' && summonsOf(e, 'gb_phantom').length > 0 },
    states: [{ id: 'resonance', name: '双魂共鸣', on: jlBuff('gb_resonance'), demo: jlDemo('gb_resonance'),
      fx: { pet: { spr: 'phantom', idle: 'pfloat', h: 72, x: -38, y: -18, fly: 3, a: 0.8, tint: '#8ab8ff', hide: e => typeof summonsOf === 'function' && summonsOf(e, 'gb_phantom').length > 0 }, trail: { col: '#7ab0ff', a: 0.4 }, aura: { col: '#5a9aff', a: 0.3 }, wtint: '#8ac8ff' } }],
  },
  /* ================= 神枪手 ================= */
  // 漫游枪手（沾血蔷薇）：黑色牛仔帽上一朵血色蔷薇、身边飘落蔷薇花瓣；死亡左轮 = 双枪血光 + 血色气场 + 身边绕着一圈子弹
  ranger: {
    col: '#d8203a', acc: ['job_ranger_hat'],
    motes: { img: 'petal', col: '#e0304a', n: 4, h: 7, rise: -20, life: 2.2, y0: 0.9, a: 0.85, spin: 0.6 },
    states: [{ id: 'revolver', name: '死亡左轮', on: jlBuff('g_buff'), demo: jlDemo('g_buff'),
      fx: { wtint: '#ff3a4a', aura: { col: '#ff2a3a', a: 0.3 }, orbit: { img: 'dot', col: '#ffd24a', n: 6, h: 2.6, rx: 28, ry: 7, y: 0.5, spd: 2.4 } } }],
  },
  // 枪炮师：背上扛着一门重炮；潜能爆发 = 全身橙色热浪（火苗）+ 武器过热发光
  launcher: {
    col: '#ffa040', acc: ['job_launcher_goggles'],
    prop: [{ img: 'weapon/handcannon_r4', at: 'back', x: -4, y: 4, h: 44, ang: -0.55 }],
    states: [{ id: 'miracle', name: '潜能爆发', on: jlBuff('gl_miracle'), demo: jlDemo('gl_miracle'),
      fx: { aura: { col: '#ff8a2a', a: 0.32 }, burn: { col: '#ff9a3a', n: 5, h: 22 }, wtint: '#ffb040' } }],
  },
  // 机械师：脚边跟着一台小机器人（RX-78）；机械改良 = 两架小无人机绕身 + 身上蓝色电光
  mechanic: {
    col: '#ffb040', acc: ['job_mechanic_cap'],
    pet: { spr: 'mech_rx78', h: 24, x: -30, y: 2, move: ['run1', 'run2', 'run3'], hop: 1 },
    states: [{ id: 'robotics', name: '机械改良', on: jlBuff('gm_robotics'), demo: jlDemo('gm_robotics'),
      fx: { orbit: { img: 'pm_minidrone', n: 2, h: 10, rx: 30, ry: 6, y: 0.95, spd: 1.4 }, arcs: { col: '#6ac8ff', n: 2 } } }],
  },
  // 弹药专家：背后一对喷射翼；超负荷装填 = 身边绕着属性色的子弹 + 属性色气场 + 武器发光（火红 / 冰蓝 / 光黄 / 无属性白）
  spitfire: {
    col: '#ff7a2a', acc: ['job_spitfire_bandana'],
    prop: [{ img: 'sf_wings', at: 'back', x: -14, y: -6, h: 62, a: 0.95 }],
    states: [{ id: 'overcharge', name: '超负荷装填', on: jlBuff('gs_overcharge'), demo: jlDemo('gs_overcharge', { elem: 'fire' }),
      fx: { orbit: { img: 'dot', col: jlSfCol, n: 6, h: 3.6, rx: 28, ry: 7, y: 0.5, spd: 2.2 }, aura: { col: jlSfCol, a: 0.45, haze: 0.3 }, motes: { img: 'dot', col: jlSfCol, n: 6, h: 2.2, rise: 30, life: 1.2 }, wtint: jlSfCol } }],
  },
  // 协战师：肩膀旁边跟着一架分析无人机（城镇；地下城换成战斗服也有）；战场信息（1~3 层）= 脚下青色战术法阵 + 往上飘的数据十字
  paramedic: {
    col: '#6ad8ff', acc: ['job_paramedic_headset'],
    orbit: { img: 'pm_drone', n: 1, h: 11, rx: 20, ry: 5, y: 1.1, spd: 0.8 },
    states: [{ id: 'info', name: '战场信息', on: e => typeof pmStacks === 'function' ? pmStacks(e) : 0, demo: e => { e.pmInfo = 300; },
      fx: { ring: { img: 'rune', col: '#6ad8ff', r: 32, rLv: 0.15, spin: 0.8, a: 0.75 }, motes: { img: 'cross', col: '#6ad8ff', n: 3, nLv: 2, h: 3.4, rise: 30 } } }],
  },
  /* ================= 魔法师 ================= */
  // 元素师：火 / 冰 / 光 / 暗四颗小元素珠绕身；元素点燃 / 圣灵符文 = 四颗大元素球 + 脚下六芒星法阵（圣灵符文更大）
  elemental: {
    col: '#b08aff', hair: '#b8d8ff', acc: ['job_elemental_tiara'],
    orbit: { img: 'dot', col: ['#ff6a2a', '#6ad0ff', '#ffe25a', '#a060ff'], n: 4, h: 4.6, rx: 24, ry: 6, y: 0.6, spd: 0.9 },
    states: [{ id: 'burn', name: '元素点燃 / 圣灵符文', on: e => e.buffs && (e.buffs.el_burn || e.buffs.el_rune) ? 1 + (e.buffs.el_rune ? 1 : 0) : 0, demo: jlDemo('el_burn', { marks: { fire: 1, ice: 1, light: 1, dark: 1 } }),
      fx: { orbit: { img: ['orb', 'quantum', 'chaser', 'darkorb'], col: ['#ff6a2a', null, null, null], n: 4, h: 16, hLv: 0.2, rx: 32, ry: 8, y: 0.55, spd: 1.4, add: 1 }, ring: { img: 'hexagram', col: '#c8a8ff', r: 34, rLv: 0.3, spin: 0.5, a: 0.55 } } }],
  },
  // 战斗法师：两颗金色追踪球绕身；战斗本能 = 红色电光气场 + 五颗追踪球
  battlemage: {
    col: '#ffc84a', hair: '#ff9a48', acc: ['job_battlemage_band'],
    orbit: { img: 'chaser', n: 2, h: 11, rx: 22, ry: 5, y: 0.7, spd: 1.6, glow: '#ffd24a' },
    states: [{ id: 'instinct', name: '战斗本能', on: jlBuff('bm_instinct'), demo: jlDemo('bm_instinct'),
      fx: { arcs: { col: '#ff4a3a', n: 3 }, aura: { col: '#ff3a2a', a: 0.3 }, orbit: { img: 'chaser', n: 5, h: 13, rx: 30, ry: 8, y: 0.55, spd: 2.2, glow: '#ffd24a' } } }],
  },
  // 召唤师：肩膀旁边飘着一只契约光精灵、脚下淡淡的契约印；召唤兽狂化 = 脚下大号赤紫契约法阵 + 紫色气场
  summoner: {
    col: '#c07aff', hair: '#6cd0a8', acc: ['job_summoner_horns'],
    pet: { spr: 'wisp', h: 20, x: -24, y: -66, fly: 3 },
    ring: { img: 'hexagram', col: '#b07aff', r: 20, spin: 0.3, a: 0.3 },
    states: [{ id: 'frenzy', name: '召唤兽狂化', on: jlBuff('sm_frenzy'), demo: jlDemo('sm_frenzy'),
      fx: { ring: { img: 'hexagram', col: '#ff5a8a', r: 46, spin: 1.2, a: 0.85 }, aura: { col: '#d05aff', a: 0.3 } } }],
  },
  // 魔道学者：背着扫把（手里拿的就是扫把时不背）、身边冒药水泡泡；远古魔法书 = 背后竖着一面旋转的魔法阵 + 闪光
  witch: {
    col: '#ff9ac0', hair: '#b8805a', acc: ['job_witch_glasses'],
    prop: [{ img: 'weapon/broom', at: 'back', x: -4, y: 6, h: 60, ang: -0.95, noWpn: 'broom' }],
    motes: { img: 'bubble', col: ['#5ad8a0', '#ff8ac8', '#5ab8ff'], n: 5, h: 4.4, rise: 26, life: 1.8, y0: 0.45, a: 1 },
    states: [{ id: 'book', name: '远古魔法书', on: jlBuff('wt_book'), demo: jlDemo('wt_book'),
      fx: { ring: { img: 'rune', col: '#ff7ac0', r: 30, spin: 0.7, a: 1, upright: 1 }, motes: { img: 'spark', col: '#ffc0e8', n: 7, h: 8, rise: 30 }, aura: { col: '#ff8ac8', a: 0.25, haze: 0.15 } } }],
  },
  // 小魔女：手上用红线吊着疯疯熊人偶；禁忌诅咒 = 脚下暗红诅咒法阵 + 暗紫气场 + 飘落的蔷薇
  enchantress: {
    col: '#c0304a', hair: '#f07890', acc: ['job_enchantress_bow'],
    pet: { spr: 'madbear', h: 28, at: 'hand', x: 5, y: 32, fly: 2.5, strings: '#ff4a5a', front: 1 },
    states: [{ id: 'curse', name: '禁忌诅咒', on: jlBuff('en_forbidden'), demo: jlDemo('en_forbidden'),
      fx: { aura: { col: '#9a2a6a', a: 0.35 }, ring: { img: 'rune', col: '#c0305a', r: 38, spin: -0.6, a: 0.7 }, motes: { img: 'enRose', n: 4, h: 7, rise: -18, life: 2.2, y0: 0.95, a: 0.9, spin: 0.4 } } }],
  },
};
// look.acc 里加上转职配件（戴眼罩的转职去掉时装眼镜；和身上时装冲突的头饰不加，时装优先，见 AVATAR_ACC 的 clash）
function jobLookAcc(job, acc) {
  const J = job && JOB_LOOKS[job]; if (!J || !J.acc) return acc || [];
  const a = (acc || []).filter(k => !(J.noFace && AVATAR_ACC[k] && AVATAR_ACC[k].face) && !J.acc.includes(k));
  const worn = s => a.some(k => k.startsWith('av_' + s + '_'));   // 时装配件的 key：av_hat_* / av_hair_* / av_face_*
  return a.concat(J.acc.filter(k => !((AVATAR_ACC[k] && AVATAR_ACC[k].clash) || []).some(worn)));
}
