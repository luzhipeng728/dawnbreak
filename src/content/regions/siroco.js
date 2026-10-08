/* =====================================================================
   区域：魔界 · 潜行者希洛克（官方 Lv100「希洛克攻坚战」时代；2026-09-28 满级 30 → 60 后移到 Lv60 终局，原来是 Lv30 终局）
   官方依据：希洛克是来自魔界的第五使徒“潜行者”，拥有无数张脸孔的隐形者；攻坚战分「追逐战」（法则之门 / 知性之门 / 痛苦之门）
   与「讨伐战」（无形棺柩 · 希洛克的幻界）。奈克斯、暗杀者、守门人、卢克西都是攻坚战里的官方首领名；阿甘左是官方 NPC（卢克西是他的妻子）。
   本作原创：暗黑城的商人米拉、各种小怪的名字与造型、凝视机制的具体做法。
   这个文件是纯数据：代码由 game/region.js 的 defineRegion 展开，美术由 art/tools/region_art.py siroco 读同一份数据生成。
   入口：时空之门（x 1900 往上的次元裂缝，Lv.60）；主线接时空之门篇的最后一个任务 q_tg14（等级组约定，见 docs/GEAR.md「等级段」）。
     以前临时放在天帷巨兽 · 脊背（Lv.30），31~59 的区域做完后挪了过来。
   ===================================================================== */
defineRegion({
  id: 'siroco', name: '魔界 · 潜行者希洛克', lvl: 60, power: 6.5, bossPower: 0.75, atkPower: 3.2,   // 难度：按 Lv30 全身 +12 史诗调（机器人实测见 docs/REGION_PIPELINE.md）；移到 Lv60 后靠怪物等级公式（game/monsters.js monLvScale）保持同样手感
  entry: { scene: 'time_gate', side: 'up', x: 1900, to: 'siroco_town', minLv: 60, label: '次元裂缝 · 魔界（Lv.60）' },

  /* ---- 场景主题（pal = 程序兜底画面的配色；bg = 手绘背景的远景 / 地面 / 交界带描述）---- */
  themes: {
    siroTown: { grade: { tint: 'rgba(80,50,130,0.10)', fog: 'rgba(190,150,255,0.08)' }, ambient: 'motes', rgb: '220,190,255', floorW: 1700,
      pal: { sky: ['#1a1030', '#3a2458', '#7a5a9a'], haze: '#b890ff' },
      bg: ['The Dark City, the only town of the demon realm (Makai): crooked gothic stone houses with glowing violet windows, lantern-lit streets, a huge pale moon behind dark spires, floating purple crystals, a cozy but eerie night market atmosphere.',
        'dark cobblestone street tiles with violet moss in the cracks, a few fallen lantern petals, soft moonlight',
        'a low wrought-iron fence with crooked lanterns, potted night flowers and small glowing violet crystals'] },
    siroLaw: { edgeHoles: true, grade: { tint: 'rgba(60,40,120,0.14)', fog: 'rgba(150,120,255,0.10)' }, ambient: 'wisps', rgb: '170,140,255', floorW: 1700,
      pal: { sky: ['#120a24', '#2a1a4a', '#4a3a7a'], haze: '#8a6aff', floor: ['#262036', '#302840', '#1e1a2c'] },
      bg: ['The Gate of Law in the illusion world of the apostle Siroco: a vast dark hall of judgement with giant floating stone scales, runic chains hanging from an endless ceiling, tall black pillars with glowing indigo runes, violet mist.',
        'a polished black marble floor with inlaid glowing indigo rune circles and thin gold lines',
        'a row of broken black pillars wrapped in heavy iron chains with glowing indigo rune stones'] },
    siroWit: { grade: { tint: 'rgba(40,70,140,0.14)', fog: 'rgba(140,190,255,0.10)' }, ambient: 'motes', rgb: '160,210,255', floorW: 1600,
      pal: { sky: ['#0e1430', '#1e2a5a', '#3a4a8a'], haze: '#6aa8ff', floor: ['#1e2438', '#262e44', '#181c2e'] },
      bg: ['The Gate of Wisdom: an endless library of illusions floating in a starry void, towering bookshelves bending into the sky, open books drifting like birds, cracked mirrors showing other places, soft blue candlelight.',
        'dark blue wooden library floor boards with scattered loose pages and a faded star-pattern carpet',
        'low stacks of old books, small reading desks with candles and a few cracked standing mirrors'] },
    siroPain: { edgeHoles: true, grade: { tint: 'rgba(130,30,40,0.16)', fog: 'rgba(255,110,90,0.08)' }, ambient: 'wisps', rgb: '255,120,100', floorW: 1600,
      pal: { sky: ['#1a0608', '#3a0e14', '#6a1e22'], haze: '#ff5a4a', floor: ['#2a1a1c', '#342022', '#221416'], line: 'rgba(255,90,70,.45)' },
      bg: ['The Gate of Pain: a crimson underground prison of the demon realm, rusty iron cages hanging on chains, thorny black vines climbing dark stone walls, dim red torchlight, a blood-red sky seen through a broken ceiling.',
        'dark red-brown flagstones with rusty iron grates and a few thorny vines, dim red light',
        'broken iron cage bars, rusty chains on the ground and thorny black vines with small red flowers'] },
    siroCoffin: { grade: { tint: 'rgba(70,30,110,0.16)', fog: 'rgba(200,150,255,0.10)' }, ambient: 'wisps', rgb: '200,150,255', floorW: 1800,
      pal: { sky: ['#0a0614', '#241040', '#4a2a6a'], haze: '#a070ff' },
      bg: ["The Invisible Coffin, the dream-like illusion world of Siroco: a violet starry void with floating black coffins and shattered mirror shards, a giant faint masked face in the purple nebula, ribbons of shadow drifting, eerie and majestic.",
        'a floor of dark violet glassy stone like a frozen night lake, faint star reflections and thin cracks glowing lilac',
        'floating broken mirror shards, small black coffins half sunk in the ground and pale porcelain masks scattered around'] },
  },

  /* ---- 怪物：tier 数值档 | arch 行为原型 | size [宽, 纵深, 高] | traits 特性 | skills 技能库（参数见 docs/REGION_PIPELINE.md）| art 精灵 [名字, 染色] ---- */
  monsters: {
    phantomBlade: { name: '幻影剑士', tier: 'normal', arch: 'aggressive', size: [13, 12, 100], elem: 'dark', art: 'siPhantom',
      skills: [{ use: 'swipe', n: 2, dmg: 1.0, cd: [1.5, 2.5], w: 2 }, { use: 'dash', len: 300, speed: 620, windup: 0.8, dmg: 1.1, cd: [4.5, 6.5] }] },
    phantomStalker: { name: '暗影潜伏者', tier: 'normal', arch: 'aggressive', size: [13, 12, 100], elem: 'dark', art: ['siPhantom', { hue: 115, only: [200, 300], sat: 1.3 }], traits: { immune: ['freeze'] },
      skills: [{ use: 'swipe', n: 1, dmg: 1.1, cd: [1.6, 2.6], w: 2 }, { use: 'seq', cd: [6, 8], steps: [{ use: 'blink', to: 'behind', dist: 70 }, { use: 'swipe', n: 2, dmg: 0.9, windup: 0.3 }] }] },
    voidCaster: { name: '虚空咏唱者', tier: 'caster', arch: 'kiter', size: [13, 12, 96], elem: 'dark', art: 'voidcaster',
      skills: [{ use: 'swipe', dmg: 0.8, reach: 60, cd: [2, 3] }, { use: 'shot', mode: 'homing', n: 2, spread: 50, speed: 230, dmg: 0.8, cd: [4, 5.5], w: 1.5 }, { use: 'aoe', shape: 'circle', at: 'target', r: 60, windup: 1.0, dmg: 1.0, cd: [6, 8] }] },
    soulBinder: { name: '灵魂拘束者', tier: 'caster', arch: 'kiter', size: [13, 12, 96], elem: 'dark', art: ['voidcaster', { hue: 115, only: [200, 300], sat: 1.1 }],
      skills: [{ use: 'swipe', dmg: 0.8, reach: 60, cd: [2, 3] }, { use: 'shot', mode: 'spread', n: 3, spread: 55, speed: 280, dmg: 0.75, status: 'slow', cd: [4.5, 6], w: 1.4 },
        { use: 'aoe', shape: 'ring', at: 'self', r: 130, r0: 50, windup: 1.1, dmg: 1.0, cd: [7, 9] }, { use: 'buff', kind: 'shield', target: 'allies', amt: 0.15, dur: 8, cd: [16, 22], w: 0.6 }] },
    hellHound: { name: '魔界猎犬', tier: 'normal', arch: 'aggressive', size: [16, 12, 72], weight: 1, speed: 125, elem: 'fire', art: 'hound', noGrab: false,
      skills: [{ use: 'swipe', clip: 'bite', reach: 62, dmg: 0.95, cd: [1.4, 2.4], w: 2 }, { use: 'dash', clip: 'chargeW', len: 340, speed: 700, windup: 0.75, dmg: 1.1, status: 'burn', cd: [4, 6] }] },
    burstShade: { name: '爆裂残影', tier: 'swarm', arch: 'swarm', size: [11, 10, 56], scale: 0.78, elem: 'dark', art: ['hound', { hue: -150, sat: 0.8, bright: 0.7 }],
      traits: { onDeath: 'explode', explode: { r: 80, windup: 0.8, dmg: 1.0 } },
      skills: [{ use: 'swipe', clip: 'bite', reach: 50, dmg: 0.7, cd: [1.6, 2.6] }, { use: 'explode', r: 95, windup: 1.0, dmg: 1.4, cd: [5, 7], w: 0.6 }] },
    jailer: { name: '碎颅狱卒', tier: 'brute', arch: 'guard', size: [20, 15, 124], weight: 3, scale: 1.05, hardness: 40, elem: 'fire', art: 'jailer',
      skills: [{ use: 'swipe', clip: 'slam', reach: 96, width: 30, windup: 0.62, dmg: 1.3, down: true, knock: 200, sa: true, cd: [2.4, 3.6], w: 2 },
        { use: 'guard', dur: 2.2, reduce: 0.8, cd: [8, 11], counter: { use: 'aoe', shape: 'circle', at: 'self', r: 120, windup: 0.45, dmg: 1.3 } },
        { use: 'grab', reach: 66, hold: 0.8, throwDmg: 1.5, cd: [7, 9] }, { use: 'aoe', shape: 'cross', at: 'target', hw: 22, windup: 1.2, dmg: 1.2, cd: [8, 11] }] },
    gazer: { name: '深渊眼魔', tier: 'flier', arch: 'flier', size: [15, 12, 70], weight: 1.4, elem: 'dark', art: 'gazer', traits: { immune: ['stun'] },
      skills: [{ use: 'laser', windup: 1.1, dur: 1.0, sweep: 70, dmg: 0.45, cd: [6, 8], w: 1.4 }, { use: 'shot', mode: 'spread', n: 3, spread: 60, speed: 300, dmg: 0.8, cd: [4, 5.5] }] },
    luxi: { name: '被操纵的卢克西', tier: 'elite', arch: 'aggressive', size: [13, 12, 108], speed: 120, elem: 'fire', art: ['assassin', { hue: 100, only: [200, 300], sat: 1.3 }], traits: { sa: 'cast' },
      skills: [{ use: 'swipe', n: 3, dmg: 0.9, reach: 80, cd: [1.8, 2.8], w: 2 }, { use: 'dash', len: 380, speed: 720, windup: 0.75, dmg: 1.2, cd: [4, 6] }, { use: 'rain', kind: 'hex', n: 3, r: 46, windup: 1.2, dmg: 1.0, col: '#ff7a3a', cd: [8, 11] }] },
    lawOrb: { name: '紫球', tier: 'swarm', size: [16, 12, 70], obj: { shape: 'crystal', col: '#b070ff', h: 70 }, traits: { hitHp: 4 } },   // 法则之门的顺序球，不进任何地下城的小兵名单
  },

  /* ---- 领主：mechs 出场就有的机制 | phases 按血量切阶段（at = 血量比例），enter = 进阶段时的动作 | hook = 自定义钩子（content/regions/siroco_bosses.js）---- */
  bosses: {
    nex: { name: '奈克斯', lvl: 62, size: [16, 14, 122], elem: 'dark', art: 'nex', pref: 150,
      mechs: [{ use: 'groggy', max: 100, dur: 6 }],
      phases: [
        { at: 1, skills: [{ use: 'swipe', reach: 120, width: 28, dmg: 1.2, cd: [1.6, 2.6], w: 2, say: '' }, { use: 'shot', mode: 'homing', n: 3, spread: 60, speed: 240, turn: 2.0, dmg: 1.0, cd: [5, 7], w: 1.4, say: '锁链球！', col: '#7ae0c8' },
          { use: 'aoe', shape: 'circle', at: 'self', r: 300, windup: 1.5, dmg: 1.3, jump: true, status: 'slow', cd: [10, 13], say: '全屏抓取——跳起来！', col: '#7ae0c8' },
          { use: 'summon', kind: 'hellHound', n: 2, max: 2, cd: [18, 24], w: 0.7 }] },
        { at: 0.6, enter: { say: '奈克斯张开了护盾！', col: '#7ae0c8', mechs: [{ use: 'shield', hp: 0.035, dur: 16, punish: 'heal', onBreak: 'groggy', col: '#7ae0c8' }] },
          skills: [{ use: 'mech', mech: { use: 'shield', hp: 0.035, dur: 16, punish: 'heal', onBreak: 'groggy', col: '#7ae0c8' }, cd: [26, 32], say: '护盾！' },
            { use: 'rain', kind: 'bolt', n: 5, r: 44, windup: 1.1, dmg: 1.1, col: '#7ae0c8', cd: [7, 9] }] },
      ] },
    assassin: { name: '暗杀者', lvl: 62, size: [14, 12, 112], speed: 125, elem: 'dark', art: 'assassin', pref: 90,
      mechs: [{ use: 'groggy', max: 100, dur: 6 }, { use: 'enrage', t: 240 }],
      phases: [
        { at: 1, skills: [{ use: 'swipe', n: 3, reach: 86, dmg: 0.9, cd: [1.6, 2.4], w: 2 }, { use: 'dash', len: 420, speed: 760, windup: 0.75, dmg: 1.3, cd: [4.5, 6] },
          { use: 'shot', mode: 'spread', n: 3, spread: 70, speed: 340, dmg: 0.8, cd: [4, 5.5], col: '#d0c8ff' },
          { use: 'seq', cd: [8, 11], w: 1.2, say: '', steps: [{ use: 'blink', to: 'behind', dist: 70 }, { use: 'swipe', n: 2, reach: 86, windup: 0.3, dmg: 1.0 }, { use: 'aoe', shape: 'circle', at: 'self', r: 110, windup: 0.6, dmg: 1.2 }] }] },
        { at: 0.6, enter: { say: '暗杀者分出了影子——找出本体！', mechs: [{ use: 'clones', n: 3, dur: 12, punish: 'nova' }] },
          skills: [{ use: 'mech', mech: { use: 'clones', n: 3, dur: 12, punish: 'nova' }, cd: [20, 26], say: '影分身！' }] },
      ] },
    gatekeeper: { name: '守门人', lvl: 62, size: [20, 15, 132], weight: 5, speed: 80, art: 'gatekeeper', pref: 110, traits: { sa: 'cast' },
      mechs: [{ use: 'groggy', max: 110, dur: 6 }, { use: 'element', modes: ['light', 'dark'], every: 12, mul: 0.4 }],
      phases: [
        { at: 1, skills: [{ use: 'swipe', clip: 'slam', reach: 120, width: 34, windup: 0.7, dmg: 1.4, down: true, sa: true, cd: [2, 3], w: 2 },
          { use: 'guard', dur: 2.4, reduce: 0.85, cd: [9, 12], counter: { use: 'aoe', shape: 'circle', at: 'self', r: 140, windup: 0.5, dmg: 1.4 } },
          { use: 'aoe', shape: 'cross', at: 'target', hw: 24, windup: 1.2, dmg: 1.3, cd: [7, 9] }, { use: 'laser', windup: 1.2, dur: 1.2, sweep: 60, dmg: 0.5, cd: [8, 10], col: '#ffe070' }] },
        { at: 0.5, enter: { say: '幻灭——站进光圈！', col: '#e8f4ff', mechs: [{ use: 'safezone', windup: 3.4, n: 2, r: 72, frac: 0.4, say: '幻灭——站进光圈！' }] },
          skills: [{ use: 'mech', mech: { use: 'safezone', windup: 3.4, n: 2, r: 72, frac: 0.4, say: '幻灭——站进光圈！' }, cd: [26, 32] }] },
      ] },
    siroco: { name: '潜行者 希洛克', tier: 'raid', lvl: 63, size: [18, 15, 126], speed: 105, elem: 'dark', art: 'siroco', pref: 120, hook: 'siroco', scale: 1.5,   // 攻坚最终领主：画面高约 190
      mechs: [{ use: 'groggy', max: 120, dur: 8, mul: 1.6 }, { use: 'enrage', t: 300 }],
      phases: [
        { at: 1, skills: [{ use: 'swipe', n: 3, reach: 96, width: 26, dmg: 1.0, cd: [1.6, 2.4], w: 2 },
          { use: 'seq', cd: [7, 10], w: 1.2, steps: [{ use: 'blink', to: 'behind', dist: 70 }, { use: 'swipe', n: 2, reach: 96, windup: 0.3, dmg: 1.1 }] },
          { use: 'shot', mode: 'homing', n: 4, spread: 50, speed: 220, turn: 1.8, dmg: 0.9, cd: [5, 7], say: '暗影之球' },
          { use: 'rain', kind: 'hex', n: 5, r: 48, windup: 1.2, dmg: 1.1, col: '#a070ff', cd: [8, 11] },
          { use: 'mech', mech: { use: 'clones', n: 3, dur: 12, punish: 'nova' }, cd: [22, 28], say: '无数张脸孔……' }] },
        { at: 0.72, enter: { say: '希洛克隐入了黑暗——击破记忆碎片！', mechs: [{ use: 'invuln', until: 'crystals', n: 4, name: '记忆碎片', hpFrac: 0.02 }] },
          skills: [{ use: 'laser', windup: 1.1, dur: 1.3, sweep: 80, dmg: 0.5, cd: [7, 9]}, { use: 'aoe', shape: 'cross', at: 'target', hw: 24, windup: 1.2, dmg: 1.3, cd: [7, 9]},
            { use: 'mech', mech: { use: 'safezone', windup: 3.4, n: 2, r: 72, frac: 0.4, say: '灵魂拘束——站进光圈！' }, cd: [26, 32]}] },
        { at: 0.45, enter: { say: '卢克西被希洛克操纵了——先救下卢克西！', col: '#ff9ab0', mechs: [{ use: 'tether', kind: 'luxi', mode: 'guard', mul: 0.35, hp: 0.12, onBreak: 'groggy' }, { use: 'hazard', kind: 'debris', every: 5, n: 3 }] } },
        { at: 0.2, enter: { say: '无形之棺在崩塌！', mechs: [{ use: 'hazard', kind: 'shrink', minW: 620, speed: 20 }] },
          skills: [{ use: 'rain', kind: 'bolt', n: 7, r: 44, interval: 0.25, windup: 1.0, dmg: 1.1, col: '#c8a0ff', cd: [7, 9] }] },
      ] },
    // 故事关领主是另一套 kind（lawWarden / witCharm / painNex+painVita / sirocoLord）。上面四个旧 kind 会被团本浅拷贝，attacks / mechs / hook 不要改。
    lawWarden: { name: '遗忘姓名的守门人', lvl: 62, size: [20, 15, 132], weight: 5, speed: 80, art: 'gatekeeper', pref: 110, hook: 'lawWarden', traits: { sa: 'cast' },
      mechs: [{ use: 'groggy', max: 110, dur: 6 }],
      phases: [
        { at: 1, skills: [{ use: 'swipe', clip: 'slam', reach: 120, width: 34, windup: 0.7, dmg: 1.3, down: true, sa: true, cd: [2.2, 3.2], w: 2 },
          { use: 'hold', id: 'lawCall', clip: 'sigA', sig: '召出紫球', dur: 1.1, phase: 99, cd: [999, 999] },
          { use: 'cone', clip: 'sigB', ang: 78, len: 360, windup: 1.0, dur: 0.9, dmg: 0.4, col: '#c080ff', cd: [7, 10], w: 1.5, say: '裁决横扫——绕到侧面！' }] },
      ] },
    witCharm: { name: '魅惑之哈妮尔', lvl: 62, size: [14, 12, 112], speed: 125, elem: 'dark', art: 'assassin', pref: 90,
      mechs: [{ use: 'groggy', max: 100, dur: 6 }, SI_WIT_STANCE,
        // 精英不在领主房。invuln until adds 会另刷一波并全程无敌，enrage 只是计时。用 tether guard 召一只灵魂拘束者近似：它活着伤害 ×0.4，打倒后破招。
        { use: 'tether', kind: 'soulBinder', mode: 'guard', mul: 0.4, hp: 0.14, onBreak: 'groggy', say: '灵魂拘束者还活着——哈妮尔受到的伤害降低了，先打倒拘束者！', col: '#c080ff' }],
      phases: [
        { at: 1, skills: [{ use: 'swipe', n: 2, reach: 86, dmg: 0.85, cd: [2.2, 3.2], w: 1.2 },
          { use: 'dash', id: 'witDash', len: 340, speed: 840, windup: 0.65, dmg: 1.1, status: 'bleed', sdur: 3, cd: [5, 7], w: 1.5, say: '刃舞突刺——出血了！' },
          { use: 'swipe', id: 'witSeq', n: 4, reach: 94, windup: 0.32, gap: 0.18, dmg: 0.7, cd: [7, 10], w: 1.6, say: '刃舞连斩！' }] },
      ] },
    painVita: { name: '慈悲之维塔', lvl: 62, size: [16, 14, 122], elem: 'light', art: ['nex', { sat: 0.15, bright: 1.5 }], variantOf: 'nex', scale: 0.96, pref: 140,
      mechs: [{ use: 'groggy', max: 100, dur: 6 }],
      phases: [
        { at: 1, skills: [
          { use: 'buff', id: 'mercy', kind: 'heal', target: 'allies', r: 560, amt: 0.05, cd: [9, 12], w: 1.3, say: '慈悲——同伴恢复了体力！' },
          { use: 'pool', id: 'whiteMist', zone: 'slow', at: 'target', n: 2, r: 80, windup: 1.0, linger: 6, dmg: 0.4, col: '#f4f4ff', cd: [8, 11], w: 1.3, say: '白雾沉下来了——别站进去！' },
          { use: 'rain', clip: 'sigB', kind: 'hex', n: 4, r: 42, windup: 1.2, dmg: 1.0, col: '#f4f4ff', cd: [7, 10], w: 1.7, say: '头顶的白球落下了——散开！' }] },
      ] },
    painNex: { name: '公义之奈克斯', lvl: 62, size: [16, 14, 122], elem: 'dark', art: 'nex', scale: 1.32, pref: 150,
      mechs: [{ use: 'groggy', max: 100, dur: 6 },
        { use: 'duo', with: ['painVita'], hp: 0.75, window: 0, onPartnerDown: 'enrage', say: '公义与慈悲一起现身了！' },
        { use: 'arena', kind: 'tiles', cols: 6, hot: 0.45, every: 6, warn: 1.2, frac: 0.05, tick: 0.55, col: '#ff4a3a', say: '断层地板——闪烁的地砖马上塌，站到暗的格子上！' }],
      phases: [
        { at: 1, skills: [{ use: 'swipe', id: 'chain', clip: 'slam', n: 2, reach: 120, width: 28, windup: 0.55, gap: 0.28, dmg: 1.05, cd: [2.2, 3.2], w: 1.6, say: '锁链抽打！' },
          { use: 'mark', clip: 'sigA', mode: 'burst', delay: 1.5, r: 110, n: 1, dmg: 1.4, col: '#2a2a32', cd: [8, 11], w: 1.6, say: '头顶的黑球——散开！' }] },
        { at: 0.6, enter: { say: '奈克斯苏醒了——撑过这几秒！', col: '#e8e8ff',
          // 官方苏醒是交互读条，机制库没有可打断的读条。用 invuln until survive（留在场上、伤害无效）近似：撑过这几秒才解开。
          mechs: [{ use: 'invuln', until: 'survive', survive: 8, hide: false, col: '#e8e8ff', say: '苏醒读条——她现在无敌，撑过这几秒！' }] },
          skills: [{ use: 'aoe', clip: 'sigB', shape: 'circle', at: 'self', r: 200, windup: 1.0, dmg: 1.15, col: '#e8e8ff', cd: [10, 14], w: 1.4, say: '链子爆开了！' }] },
      ] },
    sirocoLord: { name: '潜行者 希洛克', tier: 'raid', lvl: 63, size: [18, 15, 126], speed: 105, elem: 'dark', art: 'siroco', pref: 120, hook: 'sirocoLord', scale: 1.5,
      mechs: [{ use: 'groggy', max: 120, dur: 8, mul: 1.6 }],
      phases: [
        { at: 1, skills: [{ use: 'cone', id: 'wisp', ang: 48, len: 340, windup: 0.95, dur: 0.9, dmg: 0.36, col: '#c8a0ff', cd: [6, 8], w: 1.5, say: '残影吐息——绕到侧面！' },
          { use: 'pull', id: 'dominate', mode: 'in', r: 400, force: 210, windup: 1.05, dur: 1.3, status: 'slow', sdur: 1.6, dmg: 0.3, col: '#c8a0ff', cd: [11, 14], w: 1.3, say: '精神支配——往外挣开！' },
          { use: 'lanes', id: 'faces', kind: 'wave', lanes: 4, hit: 3, windup: 1.1, dmg: 1.15, col: '#c8a0ff', cd: [10, 13], w: 1.3, say: '脸孔排过来了——站进没亮的那一排！' },
          { use: 'hold', id: 'lordFace', clip: 'sigA', sig: '三张脸孔', dur: 1.0, phase: 99, cd: [999, 999] },
          { use: 'hold', id: 'lordGaze', clip: 'sigB', sig: '凝视', dur: 1.2, phase: 99, cd: [999, 999] },
          { use: 'mech', id: 'formParkLavice', mech: SI_LAVICE, phase: 99, cd: [999, 999] },
          { use: 'mech', id: 'formParkLester', mech: SI_LESTER, phase: 99, cd: [999, 999] },
          { use: 'mech', id: 'formParkGiri', mech: SI_GIRI, phase: 99, cd: [999, 999] }] },
        { at: 0.55, enter: { say: '卢克西被希洛克操纵了——先打倒卢克西！', col: '#ff9ab0', mechs: [{ use: 'tether', kind: 'luxi', mode: 'guard', mul: 0.35, hp: 0.12, onBreak: 'groggy' }] } },
        { at: 0.25, enter: { say: '无数张脸孔叠在了一起' } },
      ] },
  },

  /* ---- 史诗（Lv60；原来是 Lv30、比当时的 Lv30 史诗略强一档，见 docs/REGION_PIPELINE.md 的数值说明）；look = 图标描述 ---- */
  items: {
    epics: [
      { key: 'ep_si_nex', slot: 'support', lvl: 60, name: '奈克斯的锁链', fx: { dmgUp: 0.09, allStat: 19 },
        proc: { chance: 0.05, cd: 2, act: 'status', status: 'slow', dur: 2, name: '锁链束缚', desc: '攻击时 5% 几率用锁链束缚敌人（减速 2 秒）。' }, desc: '奈克斯的锁链球上拆下来的一截，还在轻轻颤动。',
        look: 'a coiled black iron chain with a small spiked chain ball and teal glowing rune links' },
      { key: 'ep_si_gate', slot: 'stone', lvl: 60, name: '守门人的幻灭之石', fx: { light: 21, dark: 21, dmgUp: 0.06 }, desc: '一半发光一半漆黑的魔石，守门人用它分辨光与暗。',
        look: 'a round magic gem split into a glowing golden half and a deep violet half, set in a silver frame' },
    ],
    sets: [
      { id: 'set_siroco', name: '潜行者希洛克的残香', lvl: 60, desc: '希洛克留在幻界里的残香凝成的首饰。',
        bonus: { 2: { st: { elemAll: 11, crit: 0.05, mcrit: 0.05 }, desc: '所有属性强化 +11，暴击率 +5%' },
          3: { st: { dmgUp: 0.15, elemAll: 6 }, desc: '【残影流】伤害增加 15%，所有属性强化 +6；攻击时 6% 几率召出希洛克的残影（周围 160% 暗属性伤害）', proc: { chance: 0.06, cd: 1, act: 'strike', mul: 1.6, aoe: 110, elem: 'dark', vis: 'dark', name: '残影！' } } },
        pieces: [
          { key: 'ep_si_neck', slot: 'neck', name: '希洛克的残香项链', look: 'a dark violet pendant shaped like a small porcelain mask with a glowing lilac gem, black silk cord' },
          { key: 'ep_si_bracelet', slot: 'bracelet', name: '希洛克的残香手镯', look: 'a black and silver bangle wrapped with wisps of violet shadow and tiny mask charms' },
          { key: 'ep_si_ring', slot: 'ring', name: '希洛克的残香戒指', look: 'a silver ring with a violet eye-shaped gem that seems to look around' },
        ] },
      // 深渊专属（abyss: true → 只在本区域的深渊派对掉落 / 宇宙灵魂兑换）：官方 Lv100 特殊装备套「军神的隐秘遗产」（本作没有耳环栏位，做成辅助装备 + 魔法石两件套）
      { id: 'set_armygod', name: '军神的隐秘遗产', lvl: 60, abyss: true, desc: '沉在魔界深渊里的军神遗物。据说它的主人一生从未败过。',
        bonus: { 2: { st: { dmgUp: 0.12, cdr: 0.06, elemAll: 8 }, desc: '【军神】伤害增加 12%，技能冷却 -6%，所有属性强化 +8；攻击时 5% 几率插下军神的战旗（周围 180% 伤害）',
          proc: { chance: 0.05, cd: 2, act: 'strike', mul: 1.8, aoe: 120, vis: 'holy', name: '军神的战旗' } } },
        pieces: [
          { key: 'ep_si_armygod_gem', slot: 'support', name: '军神的庇护宝石', look: 'an old bronze military medal shaped like a shield with a glowing amber gem in the middle and a torn red ribbon' },
          { key: 'ep_si_armygod_heart', slot: 'stone', name: '军神的心之所念', look: 'a heart-shaped dark red magic stone wrapped in a thin gold wire with a tiny war banner engraved inside, soft golden glow' },
        ] },
    ],
    quest: [{ key: 'q_si_memory', look: 'a glowing lilac crystal shard with a faint face reflected inside' }],
  },

  /* ---- 地下城：layout 房间模板 short / standard / long / raid | gate = 区域地图上门的位置 | drops 领主掉落 ---- */
  dungeons: {
    law_gate: { name: '法则之门', lvl: [60, 61], theme: 'siroLaw', layout: 'standard', mobs: [['phantomBlade', 3], ['hellHound', 2], ['voidCaster', 2], ['burstShade', 1]], elite: 'jailer', boss: 'lawWarden', bgm: 'dungeon2', bossBgm: 'boss',
      gate: { x: 620, col: '160,140,255' }, desc: '希洛克幻界的第一道门。遗忘姓名的守门人会召出四颗紫球——按头顶的 1、2、3、4 打碎，打错会重置并受罚；顺序对了它会破招。裁决横扫要绕到侧面。',
      drops: { boss: [['ep_si_nex', 0.02], ['ep_si_bracelet', 0.012], ['ep_ss_fate', 0.008], ['ep_rd_meow', 0.008]], mats: [['crystal', 0.12, 10], ['m_diamond', 0.008, 1], ['m_soul', 0.002, 1]] } },
    wit_gate: { name: '知性之门', lvl: [60, 61], theme: 'siroWit', layout: 'long', mobs: [['phantomStalker', 3], ['voidCaster', 2], ['soulBinder', 2], ['gazer', 1.5]], elite: 'soulBinder', boss: 'witCharm', bgm: 'dungeon3', bossBgm: 'boss',
      gate: { x: 1280, col: '140,200,255' }, desc: '幻象组成的图书馆。魅惑之哈妮尔会在魅惑和刃舞之间换招，魅惑时方向会乱。灵魂拘束者还活着时她受到的伤害会降低——先打倒拘束者。',
      drops: { boss: [['ep_si_ring', 0.012], ['ep_si_nex', 0.01], ['ep_ls_millennium', 0.008], ['ep_kt_andra', 0.008]], mats: [['crystal', 0.12, 10], ['c_blue', 0.03, 2], ['m_elem2', 0.01, 1]] } },
    pain_gate: { name: '痛苦之门', lvl: [60, 61], theme: 'siroPain', layout: 'long', mobs: [['jailer', 2], ['hellHound', 2], ['burstShade', 2], ['gazer', 1.5], ['phantomBlade', 1]], elite: 'hellHound', boss: 'painNex', bgm: 'dungeon', bossBgm: 'boss',
      gate: { x: 1940, col: '255,120,110' }, desc: '魔界的地下监狱。公义之奈克斯用锁链抽打，头顶黑球落下前要散开；慈悲之维塔会给同伴回血，脚下留白雾，白球从天上掉下来。闪烁的地砖是会塌的断层。奈克斯苏醒读条时无敌，撑过那几秒才会解开。',
      drops: { boss: [['ep_si_gate', 0.02], ['ep_si_neck', 0.012], ['ep_hc_aqua', 0.008], ['ep_sup_paris', 0.008]], mats: [['crystal', 0.12, 10], ['c_red', 0.03, 2], ['m_obsidian', 0.006, 1]] } },
    siroco_coffin: { name: '无形棺柩', lvl: [61, 62], bossLvl: 63, theme: 'siroCoffin', layout: 'raid', mobs: [['phantomStalker', 2], ['soulBinder', 1.5], ['gazer', 1.5], ['jailer', 1], ['burstShade', 1]], elite: 'jailer', boss: 'sirocoLord', bossAdds: 0,
      bgm: 'abyss', bossBgm: 'boss', preBoss: { kind: 'jailer', say: '狱卒守着希洛克的幻界……' },
      gate: { x: 2620, col: '200,150,255' }, desc: '【攻坚】希洛克的幻界。本体会喷残影、把人往身边拖，脸孔还会排成一列扫过来。她在拉维切（左右次元）、莱斯特（频繁无敌）和吉里（换色缩小、扑击吐息）之间轮换。看到「凝视」就背对她；卢克西被连上时先打倒卢克西。',
      drops: { boss: [['ep_si_neck', 0.04], ['ep_si_bracelet', 0.04], ['ep_si_ring', 0.04], ['ep_si_gate', 0.02], ['ep_si_nex', 0.02], ['lg_karo_eye', 0.02]], mats: [['crystal', 0.14, 12], ['m_soul', 0.004, 1], ['m_diamond', 0.012, 1]] } },
  },

  /* ---- 深渊派对（content/abyss.js 展开，字段见 docs/REGION_PIPELINE.md §2.1）：资格任务 → 隐藏门 → 深渊柱（随机一个普通房间）→ 两轮派对（waves 第一项 / 最后一项）→ 深渊领主（lords 随机，lord.mechs / cycle 加领主机制）
          cost 每次消耗的邀请函；pity 保底次数；seal 深渊柱血量倍率；items 里标了 abyss 的套装 / 史诗是本区域的深渊专属 ---- */
  abyss: {
    abyss_siroco: { name: '魔界深渊', lvl: [60, 61], lordLvl: 63, cost: 2, pity: 8, seal: 4, themeFrom: 'siroPain', theme: 'abyssSiroco', tint: 'rgba(90,10,110,0.34)',
      mobs: [['phantomBlade', 2], ['phantomStalker', 2], ['voidCaster', 1.5], ['hellHound', 2], ['burstShade', 1], ['gazer', 1]], elite: 'jailer',
      lords: ['nex', 'assassin', 'gatekeeper'], gate: { scene: 'siroco_field', x: 2880 }, clearExp: 37000,
      waves: [
        { n: 6, mobs: [['phantomBlade', 1], ['phantomStalker', 1], ['burstShade', 1]], elite: 1, say: '幻影从碎镜子里涌出来了！' },
        { n: 5, mobs: [['voidCaster', 1], ['soulBinder', 1], ['gazer', 1]], elites: ['soulBinder'], say: '咏唱者躲在后排——先打它们！' },
        { n: 7, mobs: [['hellHound', 2], ['burstShade', 1], ['phantomBlade', 1]], elites: ['jailer', 'jailer'], say: '魔界狱卒闯进了派对！' },
      ],
      lord: { hp: 1.3, atk: 1.1, mechs: [{ use: 'enrage', t: 210 }], cycle: [
        { every: [20, 26], mech: { use: 'hazard', kind: 'debris', every: 3.5, n: 3, dur: 10, col: '#b070ff' } },
        { every: [30, 36], at: 0.6, mech: { use: 'safezone', windup: 3.2, n: 2, r: 72, frac: 0.4, say: '深渊的凝视——站进光圈！' } }] },
      desc: '【深渊派对】希洛克消散之后，魔界深处裂开了一道深渊。每次消耗 2 张深渊派对邀请函。深渊领主是幻界的三个首领之一（每次随机），降临后会引发落石，血量过半时用「深渊的凝视」逼你站进光圈。魔界专属史诗「军神的隐秘遗产」只在这里出现。',
      quest: { name: '魔界的深渊', lvl: 60, clear: 'siroco_coffin', pre: ['q_abyss_gf'], gold: 10000, desc: '希洛克的幻界崩塌后，魔界深处也裂开了深渊。讨伐一次潜行者希洛克（无形棺柩），歌兰蒂斯就会告诉你魔界深渊的入口。',
        offer: ['……魔界那边传来了很重的深渊气息。', '希洛克的幻界崩塌以后，她留下的首领们都被深渊吞了进去。', '先去无形棺柩讨伐一次希洛克。回来我告诉你入口——那里的深渊，要 2 张邀请函才打得开。'],
        done: ['你真的从希洛克的幻界回来了……', '魔界地图的最右边，深渊之门已经为你打开。听说那里沉睡着「军神」的遗物。'] } },
  },

  /* ---- NPC / 场景（区域地图的门按 dungeons[*].gate 自动摆）---- */
  npcs: {
    agonzo: { name: '阿甘左', title: '剑圣 · 魔界向导', h: 124, services: ['quest'],
      greet: ['……你也是来找希洛克的？'], lines: ['卢克西……我的妻子，被那个使徒带走了。', '希洛克没有固定的脸。别相信你看到的第一个它。', '背对她的凝视。那是我唯一能教你的。'],
      look: 'Agonzo, a legendary wandering swordsman in his forties, messy long dark hair tied back, a short stubble beard, calm tired eyes, a long dark grey travel coat over a simple black outfit, a katana at his hip, bandaged hands' },
    mira: { name: '米拉', title: '魔界商人 · 修理 / 仓库', h: 110, services: ['repair', 'storage'],
      greet: ['欢迎来到暗黑城！修理、寄存，找米拉就对了~'], lines: ['在魔界做生意？只要你付得起金币，恶魔也是客人。', '最近幻界那边的门一直在响……可别迷路哦。'],
      look: 'Mira, a cheerful young demon-realm merchant girl with short lilac hair, two tiny curved horns, a big fluffy scarf, a purple apron full of tools and keys, carrying a lantern on a long pole' },
    raidOldman: { name: '攻坚商店老人', title: '希洛克攻坚商人 · 融合装备', art: 'world/npc_agonzo', h: 112, services: ['shop:siroco_raid', 'repair'],
      greet: ['年轻人，辛苦从幻界回来了。花瓣和无形之息，换些真正能用的东西吧。'],
      lines: ['希洛克的奖励要在翻牌阶段确认，不能离开副本后再补领。', '融合装备有三种部位，先看清楚自己的装备空位再兑换。'],
      look: 'An old demon-realm raid quartermaster with long silver hair, a dark violet hooded coat, round spectacles, a brass ledger and a lantern, standing beside crates of purple raid materials' },
  },
  scenes: {
    siroco_town: { name: '暗黑城', area: '魔界入口', kind: 'town', width: 2400, theme: 'siroTown', bgm: 'guild', ambient: 'magic', map: [6, -6],
      props: [{ art: 'world/b_teleporter', x: 260, h: 230 }, { art: 'world/p_magiclamp', x: 560, h: 110, y: 20 }, { art: 'world/p_crystal', x: 1250, h: 90, y: 150 }, { art: 'world/p_magiclamp', x: 1700, h: 110, y: 20 }, { art: 'world/p_crates', x: 1960, h: 80, y: 30 }],
      npcs: [{ npc: 'agonzo', x: 900, y: 50 }, { npc: 'mira', x: 1480, y: 60 }, { npc: 'raidOldman', x: 1860, y: 54 }],
      exits: [{ side: 'left', to: 'time_gate' }, { side: 'right', to: 'siroco_field' }] },
    siroco_field: { name: '魔界', area: '希洛克的幻界', kind: 'field', width: 3000, theme: 'siroCoffin', bgm: 'field', map: [20, -7],
      exits: [{ side: 'left', to: 'siroco_town' }] },
  },

  /* ---- 主线（任务模板）：arrive 到达 | talk 对话 | clear 通关 | boss 打倒领主（collect = 顺便收集任务道具）| raid | handin 交付 ---- */
  story: { chapter: '第七章 · 潜行者希洛克', prefix: 'q_si', pre: 'q_tg14', npc: 'agonzo', scene: 'siroco_town', steps: [
    { t: 'arrive', npc: 'silan', to: 'agonzo', name: '来自魔界的求援', scene: 'siroco_town', reward: { exp: 0.05, gold: 2000 },
      desc: '时空之门的上方裂开了一道通往魔界的次元裂缝。穿过裂缝，去暗黑城找剑圣阿甘左。',
      talk: { offer: ['时空之门的上方……裂开了一道次元裂缝。', '有人从那边传来了求援——是剑圣阿甘左。去魔界的暗黑城找他吧。'], doing: ['裂缝在时空之门往上走，Lv.60 才能过去。'], done: ['……西岚让你来的？', '我是阿甘左。我的妻子卢克西，被魔界的第五使徒——潜行者希洛克带走了。'] } },
    { t: 'clear', dungeon: 'law_gate', name: '法则之门', reward: { exp: 0.1, gold: 3000 },
      desc: '希洛克的幻界有三道门。先通关「法则之门」。',
      talk: { offer: ['希洛克躲在她的幻界里，入口有三道门：法则、知性、痛苦。', '先去法则之门。那里的狱卒会抓人，看到它伸手就后撤。'], doing: ['法则之门在幻界入口的最左边。'], done: ['你回来了。……门后面还有东西在守着。'] } },
    { t: 'boss', dungeon: 'law_gate', name: '奈克斯的锁链', collect: { key: 'q_si_memory', item: '记忆碎片', icon: 'q_si_memory', desc: '映着一张陌生脸孔的淡紫色碎片。' }, reward: { exp: 0.12, gold: 4000 },
      desc: '法则之门的守护者奈克斯身上带着希洛克的记忆碎片。打倒她，把碎片带回来。',
      talk: { offer: ['法则之门的主人叫奈克斯。她的锁链球会追着你跑。', '她读条“全屏抓取”的时候，跳起来。别犹豫。'], doing: ['她张开护盾以后，把护盾打碎她就会破招。'], done: ['这块碎片里……有卢克西的脸。', '她还活着。'] } },
    { t: 'clear', dungeon: 'wit_gate', name: '知性之门', reward: { exp: 0.1, gold: 3000 },
      desc: '第二道门是「知性之门」，一座由幻象组成的图书馆。',
      talk: { offer: ['第二道门是知性之门。那里的东西会瞬移到你背后。'], doing: ['别背对着空地站。'], done: ['……图书馆的尽头有人。'] } },
    { t: 'boss', dungeon: 'wit_gate', name: '暗杀者', reward: { exp: 0.12, gold: 4000 },
      desc: '知性之门的尽头守着希洛克的暗杀者。打倒她。',
      talk: { offer: ['暗杀者会分出影子。打中本体，影子就会散掉；打错了会被炸。'], doing: ['冲刺之前地上有红线。'], done: ['好身手。……我年轻的时候也没你这么快。'] } },
    { t: 'clear', dungeon: 'pain_gate', name: '痛苦之门', reward: { exp: 0.1, gold: 3000 },
      desc: '最后一道门是「痛苦之门」——魔界的地下监狱。',
      talk: { offer: ['最后一道门，痛苦之门。卢克西就是在那里被带走的。'], doing: ['狱卒进入格挡架势的时候别打它正面，它会反击。'], done: ['监狱的最深处……有一扇一直关着的门。'] } },
    { t: 'boss', dungeon: 'pain_gate', name: '守门人', reward: { exp: 0.12, gold: 4000 },
      desc: '痛苦之门的守门人挡在希洛克的幻界之前。打倒它。',
      talk: { offer: ['守门人会在光与暗之间切换。亮破暗，暗破亮——站进相反颜色的法阵里再打。', '它念“幻灭”的时候，站进白色的光圈。'], doing: ['光圈只有两个，别走远。'], done: ['门开了。无形棺柩……希洛克就在里面。'] } },
    { t: 'raid', dungeon: 'siroco_coffin', name: '潜行者希洛克', reward: { exp: 0.2, gold: 8000, coins: 2 },
      desc: '进入无形棺柩，讨伐潜行者希洛克。',
      talk: { offer: ['希洛克会隐入黑暗——打碎记忆碎片，逼她现身。', '她会操纵卢克西。先打倒卢克西……别手下留情，那样才能把她从控制里拉出来。', '还有——看到“凝视”的提示，就背对她。'], doing: ['她没有固定的脸。别被暗影骗了。'], done: ['……卢克西醒了。', '谢谢你，冒险家。'] } },
    { t: 'handin', to: 'agonzo', name: '潜行者的残香', reward: { exp: 0.1, gold: 5000, items: [{ key: 'ep_si_neck', n: 1 }] },
      desc: '希洛克消散之后，幻界里只留下了淡淡的残香。回去和阿甘左谈谈。',
      talk: { offer: ['希洛克消散的地方，留下了这个。'], done: ['这是希洛克的残香凝成的项链。你收下吧。', '还有六个使徒……但今天，就让我和卢克西好好休息一下。', '——潜行者希洛克篇 · 完——'] } },
  ] },

  /* ---- 美术设定（art/tools/region_art.py 用；游戏代码不读）：h 站立高度（世界单位），fly 悬浮，cycle 没有腿的走路循环，outline 描边颜色 ---- */
  art: {
    chars: {
      siPhantom: { h: 100, hold: 'holding a curved black sword', desc: 'A phantom swordsman monster from the illusion world of the demon apostle Siroco: a slim humanoid made of dark indigo shadow with a white porcelain theatre mask for a face, a tattered black hooded cloak, violet glowing cracks on the mask, pale thin hands, holding a curved black sword.',
        atk: 'the curved black sword', cast: 'raising the sword overhead as shadows swirl', low: 'lunging forward low with the sword held back' },
      voidcaster: { h: 96, hold: 'holding a crooked staff topped with a floating eye orb', desc: 'A void chanter monster of the demon realm: a small hunched caster in a deep indigo robe with gold trim, a tall pointed hood hiding the face except two glowing lilac eyes, long sleeves, holding a crooked dark wooden staff with a floating glowing eye orb on top.',
        atk: 'the crooked staff', cast: 'raising the staff with both hands, the eye orb glowing', low: 'crouching low and touching the ground with the staff' },
      hound: { h: 72, hold: null, cycle: 'trot', desc: 'A demon-realm hellhound monster: a lean four-legged dog-like beast with dark charcoal fur, a white bone mask over its face with glowing orange eyes, small curved horns, ember-orange fur tips on the tail and paws, sharp claws.',
        atk: 'its snapping jaws', cast: 'rearing up on its hind legs and howling', low: 'crouching low ready to pounce' },
      jailer: { h: 124, hold: 'holding a giant iron key-shaped mace', desc: 'A skull-crusher jailer monster of the demon prison: a huge hulking brute in rusty dark iron armor with a bucket-like iron helmet with a narrow eye slit, a thick leather apron, heavy chains with a ring of big keys around the belt, huge gauntlets, holding a giant iron mace shaped like a key.',
        atk: 'the giant key-shaped mace', cast: 'raising the mace high with both hands', low: 'hunching forward with the shoulder lowered to charge' },
      gazer: { h: 70, hold: null, fly: true, hover: 30, desc: 'An abyss gazer monster: a floating round eyeball demon the size of a big pumpkin, one huge violet iris eye, dark purple leathery skin with small bat wings, a few short curling tentacles hanging below, a tiny toothy mouth under the eye. No legs, hovering in the air.',
        atk: 'its tentacles lashing forward', cast: 'opening its huge eye wide and glowing', low: 'squinting its eye and diving forward low' },
      nex: { h: 122, boss: true, hold: 'with spiked chain balls floating around her', desc: 'Nex, a boss of the Siroco raid: an elegant demon noblewoman with long silver hair, glowing teal eyes, a black and dark teal gothic dress with a high collar, heavy iron chains wrapped around both arms ending in spiked chain balls, a small dark crown.',
        atk: 'the chain on her arm whipping forward', cast: 'spreading both arms as the chains rise', low: 'leaning forward low with the chains dragging',
        sig: ['falling orbs: spreading both arms so the spiked chain balls rise overhead, then snapping the arms down as the balls drop straight onto the ground', 'awakening: kneeling with the chains pulled tight around the body, then standing as the chains burst outward and the small crown flares'] },
      assassin: { h: 112, boss: true, hold: 'holding two short curved daggers', desc: "The Assassin, a boss of the Siroco raid: an agile female assassin in a tight black and dark violet suit, a black half mask over the lower face, long dark ponytail, a long flowing violet scarf, light armor plates on the shoulders and shins, holding a short curved dagger in each hand.",
        atk: 'the two curved daggers', cast: 'crossing both daggers in front of her face', low: 'dashing forward very low with both daggers held back',
        sig: ['charm: crossing both daggers under the chin and leaning forward as the violet scarf whips out like a kiss of light', 'confusion spin: dropping low and spinning with both daggers extended, the scarf wrapping tight and then snapping open'] },
      gatekeeper: { h: 132, boss: true, hold: 'holding a halberd and a tower shield', desc: 'The Gatekeeper, a boss of the Siroco raid: a giant armored guardian knight, heavy plate armor whose left half is polished gold-white and right half is black-violet, a closed helmet with a glowing visor, a tall tower shield painted half light and half dark, holding a long halberd.',
        atk: 'the long halberd', cast: 'raising the tower shield high as it glows', low: 'crouching behind the tower shield',
        sig: ['calling the orbs: planting the halberd, raising the half-light half-dark shield, and lifting the free hand as four violet orbs bloom in a row in front of the visor', 'judgement sweep: winding the halberd far behind the hip, then sweeping it in a huge horizontal arc that leans the whole armor into the swing'] },
      siroco: { h: 126, boss: true, hold: 'with clawed shadowy hands', desc: 'Siroco the Stalker, the fifth apostle of the demon realm: a tall mysterious woman with very long flowing black-violet hair, pale grey skin, glowing violet eyes, a tattered black hooded cloak covered with many small white porcelain masks, shadowy wisps at the hem instead of feet, long dark clawed gloves, calm and eerie.',
        atk: 'her clawed shadowy hands', cast: 'raising both hands as masks swirl around her', low: 'gliding forward low with claws reaching out',
        sig: ['three faces: one hand covering the face while the porcelain masks on the cloak lift and the body leans into a new silhouette, the other clawed hand reaching forward', 'gaze: opening both violet eyes wide and raising both clawed hands as the many small masks turn to look straight ahead'] },
    },
    gates: {
      law_gate: 'a gothic black stone gate with heavy iron chains and floating stone scales of judgement on top, indigo runes, an indigo portal',
      wit_gate: 'a gate made of two towering bent bookshelves joined by an arch of floating open books and a cracked mirror, a pale blue portal',
      pain_gate: 'a rusty iron prison gate with thorny black vines, hanging chains and small red lanterns, a crimson portal',
      siroco_coffin: 'a giant upright black coffin standing open as a gate, covered in white porcelain masks and violet shadow ribbons, a deep violet portal',
    },
  },
});
