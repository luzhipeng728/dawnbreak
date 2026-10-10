/* =====================================================================
   安徒恩攻坚战（Neo 版，Lv60）→ 团本体系的接入层（docs/RAID_ANTON.md；框架见 docs/RAID_FRAMEWORK.md）
   只登记规则：节点图 + 计时 + 复活 + 奖励表，登记进 RAID_DEFS.anton。纯数据，没有任何游戏全局，
   所以浏览器（src/ORDER 里在 raid_core.js 后面）和服务端 loadRaidCore（node:vm）加载同一个文件。
   节点地下城 / 领主 / 精英在 src/content/raids/anton_raid.js（只在客户端），dg 字段与那里的 defineDungeon id 对应。
   来源标注：[研] = 调研资料（多数未核实）；【原创】= 没有可靠资料、按官方风格补的设计；【存疑】= 数字 / 顺序没有确认。
   两个阶段：
   · P1 阻截战：黑雾之源 ×4 → 震颤的大地 A/B（倒计时，没压住 = 回退）+ 舰炮防御战 → 擎天之柱 A/B（各打 2 次）
   · P2 焦杀战：能量阻截战（杀厄伽勒开四角孵化所，各一个精英玩法；紫色感染孵化场加速火山护盾）→ 黑色火山（玛特伽）→ 安徒恩的心脏 ×5
   ===================================================================== */
(() => {
  if (typeof RAID_DEFS === 'undefined') return;
  const FOG = ['fog_a', 'fog_b', 'fog_c', 'fog_d'], HATCH = ['hatch_1', 'hatch_2', 'hatch_3', 'hatch_4'], HEART = ['heart_1', 'heart_2', 'heart_3', 'heart_4'];
  // 吞噬魔 [研]：黑雾之源二图的精英，打碎它吐的属性球使其破防；击杀给全团一小段攻击增益（【原创】数值）
  // 融合装备 key（content/items/raid_anton.js 按同一份命名注册；服务端没有物品库，所以写在规则里）：贪食（下装）/ 荒古（戒指）/ 魔能（辅助）各 4 个词条
  const ANTON_GEAR = ['gluttony', 'primeval', 'mana'].flatMap(s => [1, 2, 3, 4].map(i => `raid_an_${s}_${i}`));
  const devour = n => ({ devour: { fx: [{ kind: 'gbuff', id: 'devour_' + n, p: { atk: 0.04 }, dur: 0 }], text: '吞噬魔倒下：黑雾稀薄了一点，全团攻击小幅提升' } });
  RAID_DEFS.anton = {
    id: 'anton', name: '团本 · 安徒恩攻坚战', minLvl: 60, orderMax: 4,
    // 人数：引导 1 人 / 两人版（duoMax，每人一支单人队）/ 多队版（最多 16 人 = 4 队 × 4 人）
    duoMax: 2, teamSize: 4, minPlayers: 4, minTeams: 2, maxTeams: 4, maxPlayers: 16,
    blurb: '安徒恩（Neo 版）：潜入苍穹贵族号撞开的黑雾巨兽体内。阻截战打黑雾之源、震颤的大地、舰炮防御与擎天之柱；焦杀战清能量孵化所、击破黑色火山，最后摧毁安徒恩的心脏。',
    reqQuest: '', reqName: '',
    par: nt => nt >= 2 ? 2 / nt : 1,
    limits: { day: 1, week: 2 },
    lives: { normal: 6, guide: 3 }, perNode: { normal: 6, guide: 4 },
    erosion: { normal: 60, guide: 10 },
    rest: 300, subAfter: 180, subWindow: 90,
    guard: { minClear: 20, maxDrop: 0.05 },
    lvl: { node: 60, final: 62 },
    // mech：机制强度（引导模式 0.6 = 机制球 4→2、内尔贝电球数 / 惩罚减半）；pen：本团本没有跨图惩罚，保留默认
    scale: {
      normal: { hp: 1, atk: 1, mech: 1, cur: 1, gear: 1, penalty: true, pen: nt => Math.min(1, nt / 4) },
      guide: { hp: 0.85, atk: 0.85, mech: 0.6, cur: 0.6, gear: 0.6, penalty: false, pen: 0 },
    },
    phases: [
      { id: 1, name: '阻截战', limit: { normal: 4200, guide: 2400 }, goal: ['pillar_a2', 'pillar_b2'], nodes: {
        // ---- 黑雾之源 ×4：二图精英吞噬魔 + 领主歼灭之内尔贝（电球数与人数挂钩）[研] ----
        fog_a: { name: '黑雾之源 1', type: 'main', area: 1, pos: [0.1, 0.14], need: [], dg: 'raid_an_fog', boss: 'nelbe', elites: devour(1), guide: { name: '黑雾之源', pos: [0.1, 0.5] } },
        fog_b: { name: '黑雾之源 2', type: 'main', area: 1, pos: [0.1, 0.38], need: [], dg: 'raid_an_fog', boss: 'nelbe', elites: devour(2), guide: false },
        fog_c: { name: '黑雾之源 3', type: 'main', area: 1, pos: [0.1, 0.62], need: [], dg: 'raid_an_fog', boss: 'nelbe', elites: devour(3), guide: false },
        fog_d: { name: '黑雾之源 4', type: 'main', area: 1, pos: [0.1, 0.86], need: [], dg: 'raid_an_fog', boss: 'nelbe', elites: devour(4), guide: false },
        // ---- 震颤的大地 A / B：开放就开始倒计时，到 0 = 阶段回退（第 2 层进度清零，时间不退）；通关修复 120 秒再继续 [研] ----
        quake_a: { name: '震颤的大地 A', type: 'timer', area: 2, pos: [0.36, 0.14], need: FOG, solo: true, timer: 360, repair: 120, dg: 'raid_an_quake_a', boss: 'ioli',
          fx: { expire: [{ kind: 'reset', areas: [2, 3], text: '震颤的大地 A 没压住：最靠后的一层进度回退了（时间不退）' }] },
          elites: { ioliOrb: { once: false, fx: [{ kind: 'countdown', to: 'quake_a', sec: 360 }], text: '加血球被打掉：震颤延缓' } }, guide: { type: 'main', pos: [0.36, 0.3] } },
        quake_b: { name: '震颤的大地 B', type: 'timer', area: 2, pos: [0.36, 0.38], need: FOG, solo: true, timer: 360, repair: 120, dg: 'raid_an_quake_b', boss: 'freines',
          fx: { expire: [{ kind: 'reset', areas: [2, 3], text: '震颤的大地 B 没压住：最靠后的一层进度回退了（时间不退）' }] }, guide: false },
        // 舰炮防御战：守右侧炮充能 3 次（3 次输出窗口），屏幕变红时禁用无色技能（用「舰炮故障 = 全屏灭团」表现）[研]
        cannon: { name: '舰炮防御战', type: 'main', area: 2, pos: [0.36, 0.7], need: FOG, dg: 'raid_an_cannon', boss: 'boarder' },
        // ---- 擎天之柱 A / B：炽炎之艾格尼丝，各通关 2 次 [研] ----
        pillar_a1: { name: '擎天之柱 A-1', type: 'main', area: 3, pos: [0.62, 0.14], need: ['cannon'], solo: true, dg: 'raid_an_pillar', boss: 'agnes', guide: { name: '擎天之柱 1', pos: [0.62, 0.3] } },
        pillar_a2: { name: '擎天之柱 A-2', type: 'main', area: 3, pos: [0.8, 0.14], need: ['pillar_a1'], solo: true, dg: 'raid_an_pillar', boss: 'agnes', guide: { name: '擎天之柱 2', pos: [0.8, 0.3] } },
        pillar_b1: { name: '擎天之柱 B-1', type: 'main', area: 3, pos: [0.62, 0.62], need: ['cannon'], solo: true, dg: 'raid_an_pillar', boss: 'agnes', guide: false },
        pillar_b2: { name: '擎天之柱 B-2', type: 'main', area: 3, pos: [0.8, 0.62], need: ['pillar_b1'], solo: true, dg: 'raid_an_pillar', boss: 'agnes', guide: false },
      } },
      { id: 2, name: '焦杀战', limit: { normal: 3600, guide: 1800 }, goal: ['heart_5'], nodes: {
        // ---- 能量阻截战：先杀黄色精英吞噬之厄伽勒 → 四角孵化所 + 紫色感染孵化场开放 [研] ----
        egale: { name: '能量阻截战', type: 'main', area: 1, pos: [0.1, 0.5], need: [], dg: 'raid_an_egale', boss: 'egaleCore',
          elites: { egale: { fx: [...HATCH.map(h => ({ kind: 'unlock', to: h })), { kind: 'unlock', to: 'infect' }], text: '吞噬之厄伽勒倒下：四个孵化所和紫色感染孵化场开启了' } } },
        hatch_1: { name: '孵化所 · 熔岩怪虫', type: 'main', area: 2, pos: [0.34, 0.14], need: [], manual: true, solo: true, dg: 'raid_an_hatch_worm', boss: 'hatchGuard', guide: { name: '孵化所', manual: false, need: ['egale'], pos: [0.34, 0.5] } },
        hatch_2: { name: '孵化所 · 巡视者梅尔塔', type: 'main', area: 2, pos: [0.34, 0.38], need: [], manual: true, solo: true, dg: 'raid_an_hatch_meltha', boss: 'hatchGuard', guide: false },
        hatch_3: { name: '孵化所 · 粉碎者阿托尔', type: 'main', area: 2, pos: [0.34, 0.62], need: [], manual: true, solo: true, dg: 'raid_an_hatch_atol', boss: 'hatchGuard', guide: false },
        hatch_4: { name: '孵化所 · 恐怖邪念体', type: 'main', area: 2, pos: [0.34, 0.86], need: [], manual: true, solo: true, dg: 'raid_an_hatch_wraith', boss: 'hatchGuard', guide: false },
        // 紫色感染孵化场：没通关期间每 30 秒给火山叠一层护盾（受伤降低，最多 6 层）；通关撤掉 [研]（数值【原创】）
        infect: { name: '紫色感染孵化场', type: 'buff', area: 2, pos: [0.34, 0.3], need: [], manual: true, solo: true, respawn: 0, stopWhen: 'volcano', dg: 'raid_an_infect', boss: 'infectGuard',
          aura: [{ to: 'volcano', every: 30, id: 'infect_shield', p: { def: 0.08 }, max: 6, text: '紫色感染孵化场未清除：火山的护盾在加厚' }], guide: false },
        // ---- 黑色火山：全能之玛特伽（破招破防输出）[研] ----
        volcano: { name: '黑色火山', type: 'main', area: 3, pos: [0.6, 0.5], need: HATCH, dg: 'raid_an_volcano', boss: 'mateka' },
        // ---- 安徒恩的心脏 ×5：前 4 张各自分头打，最后一颗要整队一起进（招式【原创】）----
        heart_1: { name: '心脏 · 左心房', type: 'main', area: 4, pos: [0.88, 0.14], need: ['volcano'], solo: true, dg: 'raid_an_heart_1', boss: 'heart1', guide: { name: '心脏 · 左心房', pos: [0.88, 0.3] } },
        heart_2: { name: '心脏 · 右心房', type: 'main', area: 4, pos: [0.88, 0.34], need: ['volcano'], solo: true, dg: 'raid_an_heart_2', boss: 'heart2', guide: false },
        heart_3: { name: '心脏 · 主动脉', type: 'main', area: 4, pos: [0.88, 0.54], need: ['volcano'], solo: true, dg: 'raid_an_heart_3', boss: 'heart3', guide: false },
        heart_4: { name: '心脏 · 静脉丛', type: 'main', area: 4, pos: [0.88, 0.74], need: ['volcano'], solo: true, dg: 'raid_an_heart_4', boss: 'heart4', guide: false },
        heart_5: { name: '安徒恩的心脏', type: 'final', area: 4, pos: [0.88, 0.92], need: HEART, together: true, dg: 'raid_an_heart_5', boss: 'heart5', guide: { pos: [0.88, 0.5], together: false } },
      } },
    ],
    // 奖励：货币 = 魔能矿（raid_magic_ore）；材料 = 荒古融合核（raid_an_core）；融合装备在 content/items/raid_anton.js（ANTON_RAID_GEAR，加载后补进奖励表）
    rewards: { cur: 'raid_magic_ore', p1: [{ cur: [3, 4] }, { key: 'raid_an_core', n: [1, 2] }], p2: [{ cur: [12, 16] }, { table: [[82, { key: 'raid_an_core', n: [2, 4] }], [18, { pick: ANTON_GEAR, n: 1, gear: true }]] }] },
  };
})();
