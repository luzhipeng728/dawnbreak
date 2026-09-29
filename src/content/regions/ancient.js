/* =====================================================================
   远古地下城：比尔马克帝国试验场（玩家叫「牛头 / 机械牛」）与 悲鸣洞穴（「虫穴」）—— 官方 60 版本最有名的两张机制图
   官方依据（国服 60 版本，远古地下城）：
   - 比尔马克帝国试验场：洛兰深处的隐藏地下城，Lv48 起找土罐接任务开启；领主牛头械王。房间：嗜血猫妖 → 疯狂伊凡上校（柱子召唤会自爆的伊凡，
     清光才炸开路障）→ 牛头统帅（柱子召唤幼小牛头，回血牛）→ 倔强的哈尼克与善变猫妖 → 嗜血猫妖 → 牛头械王（挑飞、喷火、倒地起身三道落雷、
     罪恶之眼激光、保护模式：全屏吼叫 + 无敌护罩 + 机器人，限时没清掉机器人会变成牛头统帅）。
   - 悲鸣洞穴：暗黑城的远古地下城，领主虫王戮蛊。60 版原版房间：丛林僵尸 → 法布罗队长（紫色法阵里打不到、队长活着队员会回血，先杀队长队员就散）
     → 骷髅凯恩 → 戮蛊幼虫（法阵保护，幼虫互相吞噬变成成虫）→ 虫王戮蛊（喷毒、钻地破土卷起旋风、转圈、甩针、吐幼虫，幼虫爬到它身边会被吃掉回血）。
     70 版加的「魔剑阿波菲斯」房（盗墓者挖出魔剑，限时没打掉它，盗墓者回满血狂暴）也做进来，魔剑掉落 epics3.js 的「魔剑-阿波菲斯」。
   这个文件只放外壳（怪物数值 / 招式、领主、掉落、门、任务）；每个房间的机关和领主的专属机制在 content/regions/ancient_rooms.js（手写钩子）。
   等级（满级 60 后）：牛头 Lv44~45（洛兰的隐藏门），虫穴 Lv49~50（暗精灵地区的隐藏门），都算远古地下城。
   ===================================================================== */
defineRegion({
  id: 'ancient', name: '远古地下城', lvl: 44, lvlMax: 50, power: 1.4, bossPower: 1.1, atkPower: 1.15,

  themes: {
    bmLab: { edgeHoles: true, grade: { tint: 'rgba(90,80,60,0.12)', fog: 'rgba(255,220,160,0.06)' }, ambient: 'motes', rgb: '255,220,170', floorW: 1700,
      pal: { sky: ['#1a1610', '#3a3020', '#5a4a30'], haze: '#ffcf8a', floor: ['#3a3430', '#443c36', '#2e2a26'], line: 'rgba(255,200,120,.35)' },
      bg: ['The Bilmark Empire proving ground, a secret imperial military test facility hidden deep in the Lorien forest: rusty iron walls and riveted steel gates, huge glass test tanks, cages for experimental monsters, brass pipes and gauges, warning lamps, a dim yellow light.',
        'riveted steel floor plates with yellow and black hazard stripes, scratch marks and a few oil stains',
        'broken iron cages, wooden barrels, crates and a low steel railing with warning lamps'] },
    wcCave: { edgeHoles: true, grade: { tint: 'rgba(70,40,90,0.16)', fog: 'rgba(170,120,200,0.10)' }, ambient: 'wisps', rgb: '190,150,220', floorW: 1700,
      pal: { sky: ['#0c0810', '#20142a', '#3a2444'], haze: '#b890d8', floor: ['#241c28', '#2c2230', '#1c1620'] },
      bg: ['The Wailing Cave, a deep underground cavern beneath the dark elf lands: walls covered in giant insect burrow holes and sticky resin, huge shed insect husks, faint wailing ghost lights, old graves and broken coffins, pale violet mist.',
        'a dark cave floor of packed earth and bones with sticky resin patches and insect burrow holes',
        'jagged rocks, broken coffins, old bones and translucent insect egg clusters'] },
  },

  /* ---- 怪物（每个房间怎么刷、有什么机关在 ancient_rooms.js）---- */
  monsters: {
    // 比尔马克帝国试验场
    bloodCat: { name: '嗜血猫妖', tier: 'normal', arch: 'aggressive', size: [13, 11, 76], speed: 150, art: ['cat', { hue: -25, sat: 1.7, bright: 0.8 }],
      skills: [{ use: 'swipe', clip: 'scratch', n: 2, reach: 58, dmg: 1.0, cd: [1.2, 2.0], w: 2 }, { use: 'dash', clip: 'pounce', len: 260, speed: 720, windup: 0.5, dmg: 1.1, cd: [3.5, 5] }] },
    fickleCat: { name: '善变猫妖', tier: 'normal', arch: 'aggressive', size: [13, 11, 76], speed: 140, art: ['cat', { hue: 120, sat: 1.4 }],
      skills: [{ use: 'swipe', clip: 'scratch', n: 2, reach: 58, dmg: 1.0, cd: [1.2, 2.0], w: 2 }, { use: 'seq', cd: [4, 6], steps: [{ use: 'blink', to: 'random' }, { use: 'swipe', clip: 'scratch', n: 2, reach: 58, windup: 0.3, dmg: 0.9 }] }] },
    hanik: { name: '倔强的哈尼克', tier: 'elite', arch: 'aggressive', size: [16, 13, 100], scale: 1.2, weight: 2.5, art: ['catKing', { hue: -70, sat: 1.3 }],
      skills: [{ use: 'swipe', clip: 'scratch', n: 3, reach: 76, dmg: 1.0, cd: [1.6, 2.4], w: 2 }, { use: 'dash', clip: 'pounce', len: 320, speed: 700, windup: 0.6, dmg: 1.2, cd: [4, 6] },
        { use: 'aoe', shape: 'circle', at: 'self', r: 120, windup: 0.9, dmg: 1.2, cd: [8, 10] }] },
    ivan: { name: '疯狂伊凡', tier: 'swarm', arch: 'aggressive', size: [12, 10, 80], speed: 125, art: 'bmIvan',
      skills: [{ use: 'swipe', n: 2, reach: 56, dmg: 0.8, cd: [1.4, 2.4] }] },
    ivanColonel: { name: '疯狂伊凡上校', tier: 'elite', arch: 'aggressive', size: [14, 12, 96], scale: 1.25, speed: 120, art: ['bmIvan', { hue: -15, sat: 1.25, bright: 0.85 }],
      skills: [{ use: 'swipe', n: 3, reach: 70, dmg: 1.0, cd: [1.6, 2.4], w: 2 }, { use: 'dash', len: 320, speed: 680, windup: 0.7, dmg: 1.2, cd: [4.5, 6] }, { use: 'shot', clip: 'throw', mode: 'arc', r: 56, dmg: 1.0, cd: [5, 7] }] },
    tauCalf: { name: '幼小牛头', tier: 'swarm', arch: 'swarm', size: [13, 11, 80], scale: 0.72, speed: 160, art: ['tau', { hue: 10, bright: 1.1 }],
      skills: [{ use: 'swipe', clip: 'axe', reach: 56, dmg: 0.8, cd: [1.4, 2.4], w: 2 }, { use: 'dash', clip: 'charge', len: 260, speed: 720, windup: 0.6, dmg: 0.9, cd: [4, 6] }] },
    tauCommander: { name: '牛头统帅', tier: 'elite', arch: 'aggressive', size: [18, 14, 124], scale: 1.25, weight: 3, art: ['tauArmored', { hue: -20, sat: 1.3, bright: 0.85 }], traits: { sa: 'cast' },
      skills: [{ use: 'swipe', clip: 'axe', reach: 100, width: 30, windup: 0.6, dmg: 1.3, cd: [2, 3], w: 2 }, { use: 'dash', clip: 'charge', len: 480, speed: 760, windup: 0.8, dmg: 1.2, status: 'stun', sdur: 1.2, cd: [5, 7], say: '冲锋！' },
        { use: 'buff', kind: 'heal', target: 'self', amt: 0.1, cd: [12, 15], w: 0.8, say: '回血……' }] },
    bmRobot: { name: '实验机器人', tier: 'normal', arch: 'swarm', size: [12, 10, 66], speed: 110, art: 'bmRobot',
      skills: [{ use: 'swipe', reach: 56, dmg: 0.8, cd: [1.6, 2.6] }, { use: 'shot', mode: 'straight', speed: 380, dmg: 0.7, cd: [3.5, 5] }] },
    // 悲鸣洞穴
    jungleZombie: { name: '丛林僵尸', tier: 'normal', arch: 'aggressive', size: [14, 12, 100], speed: 70, art: ['zombie', { hue: 55, sat: 0.9, bright: 0.8 }],
      skills: [{ use: 'swipe', n: 2, reach: 64, dmg: 1.0, cd: [1.8, 2.8], w: 2 }, { use: 'grab', reach: 58, hold: 0.8, throwDmg: 1.3, cd: [8, 10] }] },
    fabroMember: { name: '法布罗队员', tier: 'normal', arch: 'aggressive', size: [15, 12, 104], art: ['tau', { hue: -150, sat: 0.5, bright: 0.75 }],
      skills: [{ use: 'swipe', clip: 'axe', n: 2, reach: 72, dmg: 1.0, cd: [1.6, 2.6], w: 2 }, { use: 'dash', clip: 'charge', len: 300, speed: 640, windup: 0.8, dmg: 1.1, cd: [5, 7] }] },
    fabroCaptain: { name: '法布罗队长', tier: 'elite', arch: 'guard', size: [18, 14, 120], scale: 1.2, weight: 3, art: ['tauArmored', { hue: -150, sat: 0.6, bright: 0.8 }], traits: { sa: 'cast' },
      skills: [{ use: 'swipe', clip: 'axe', reach: 96, width: 30, windup: 0.6, dmg: 1.3, down: true, cd: [2, 3], w: 2 }, { use: 'buff', kind: 'enrage', target: 'allies', r: 320, dur: 8, cd: [14, 18], say: '冲啊！' }] },
    graveDigger: { name: '盗墓者', tier: 'normal', arch: 'aggressive', size: [13, 12, 96], art: ['deGhoul', { hue: 30, sat: 0.8, bright: 0.8 }],
      skills: [{ use: 'swipe', n: 2, dmg: 1.0, cd: [1.5, 2.5], w: 2 }, { use: 'grab', reach: 60, hold: 0.7, throwDmg: 1.3, cd: [7, 9] }] },
    apophis: { name: '魔剑阿波菲斯', tier: 'elite', arch: 'flier', size: [14, 12, 110], scale: 1.1, weight: 2, elem: 'dark', power: 1.3, traits: { immune: ['stun', 'freeze'] },
      skills: [{ use: 'swipe', reach: 100, width: 30, windup: 0.5, dmg: 1.2, cd: [1.6, 2.4], w: 2 }, { use: 'dash', len: 420, speed: 820, windup: 0.6, dmg: 1.3, cd: [4, 6], say: '' },
        { use: 'aoe', shape: 'line', at: 'front', len: 420, hw: 26, windup: 1.0, dmg: 1.3, col: '#c050ff', cd: [6, 8] }] },
    kain: { name: '骷髅凯恩', tier: 'elite', arch: 'aggressive', size: [15, 12, 118], scale: 1.15, weight: 2.5, speed: 120, elem: 'dark', art: 'wcKain', power: 1.6, traits: { sa: 'cast' },
      skills: [{ use: 'swipe', n: 4, reach: 96, width: 26, windup: 0.35, gap: 0.26, dmg: 0.85, cd: [1.4, 2.2], w: 2.5 }, { use: 'dash', clip: 'pounce', len: 380, speed: 760, windup: 0.6, dmg: 1.3, down: true, cd: [4, 6] },
        { use: 'aoe', shape: 'circle', at: 'target', r: 64, windup: 1.4, follow: true, dmg: 0.9, status: 'stun', sdur: 1.2, col: '#fff0a0', cd: [5, 7], say: '光阵' }] },
    larva: { name: '戮蛊幼虫', tier: 'swarm', arch: 'swarm', size: [14, 10, 44], scale: 0.62, speed: 95, art: 'wcLarva',
      skills: [{ use: 'swipe', clip: 'bite', reach: 48, dmg: 0.7, status: 'poison', cd: [1.4, 2.4] }] },
    adultBug: { name: '戮蛊成虫', tier: 'elite', arch: 'aggressive', size: [20, 14, 70], scale: 1.1, weight: 2, art: ['wcLarva', { hue: -50, sat: 1.2, bright: 0.8 }],
      skills: [{ use: 'swipe', clip: 'bite', reach: 76, dmg: 1.1, status: 'poison', cd: [1.6, 2.4], w: 2 }, { use: 'shot', mode: 'spread', n: 4, spread: 60, speed: 300, dmg: 0.7, cd: [4, 6], say: '甩针' },
        { use: 'dash', clip: 'pounce', len: 300, speed: 700, windup: 0.6, dmg: 1.1, cd: [5, 7] }] },
  },

  /* ---- 领主（专属机制：REGION_HOOKS.mechKing / bugKing，在 ancient_rooms.js）---- */
  bosses: {
    mechKing: { name: '牛头械王', lvl: 46, size: [22, 16, 150], weight: 7, speed: 80, elem: 'fire', art: 'bmMechTau', scale: 1.3, pref: 120, hook: 'mechKing', traits: { sa: 'cast' },
      mechs: [{ use: 'groggy', max: 110, dur: 5 }],
      phases: [
        { at: 1, skills: [{ use: 'swipe', clip: 'axe', reach: 120, width: 34, windup: 0.6, dmg: 1.1, launch: 620, cd: [2.4, 3.4], w: 2, say: '' },
          { use: 'aoe', shape: 'line', at: 'front', len: 300, hw: 34, windup: 0.8, dmg: 0.9, status: 'stun', sdur: 1.4, col: '#ff8a3a', cd: [6, 8], say: '喷火！', then: { use: 'swipe', clip: 'axe', reach: 130, width: 36, windup: 0.5, dmg: 1.6, down: true } },
          { use: 'dash', clip: 'charge', len: 420, speed: 720, windup: 0.8, dmg: 1.2, cd: [6, 8] }] },
        { at: 0.6, enter: { say: '启动保护模式！', col: '#8ad8ff', mechs: [{ use: 'invuln', until: 'adds', kind: 'bmRobot', n: 3, hide: false }] } },
        { at: 0.25, enter: { say: '启动保护模式！', col: '#8ad8ff', mechs: [{ use: 'invuln', until: 'adds', kind: 'bmRobot', n: 4, hide: false }] },
          skills: [{ use: 'rain', kind: 'bolt', n: 5, r: 44, windup: 1.0, dmg: 1.0, status: 'shock', col: '#fff38a', cd: [8, 10] }] },
      ] },
    bugKing: { name: '虫王戮蛊', lvl: 51, size: [46, 22, 130], weight: 8, speed: 75, elem: 'dark', art: 'wcBugKing', scale: 2.2, pref: 170, hook: 'bugKing', traits: { sa: 'cast' },   // 远古最难的最终领主：画面约 240 高、300 长
      mechs: [{ use: 'groggy', max: 110, dur: 5 }],
      phases: [
        { at: 1, skills: [{ use: 'swipe', clip: 'bite', reach: 190, width: 44, dmg: 1.2, cd: [2, 3], w: 2 },
          { use: 'aoe', shape: 'line', at: 'front', len: 480, hw: 40, windup: 0.9, dmg: 1.0, status: 'poison', col: '#b07aff', cd: [6, 8], say: '喷毒' },
          { use: 'shot', mode: 'spread', n: 5, spread: 90, speed: 320, dmg: 0.8, cd: [5, 7], say: '甩针' },
          { use: 'aoe', shape: 'circle', at: 'self', r: 220, windup: 1.0, dmg: 1.2, jump: true, cd: [8, 11], say: '转圈——跳起来！' },
          { use: 'rain', kind: 'hex', n: 4, r: 50, windup: 1.2, dmg: 1.0, col: '#5a2a6a', cd: [9, 12], say: '黑色炸弹' },
          { use: 'summon', kind: 'larva', n: 3, max: 6, cd: [14, 18], w: 0.8, say: '吐出幼虫' }] },
        { at: 0.6, enter: { say: '虫王钻进了地下——别让幼虫爬到它身边！', col: '#d0a0ff', mechs: [{ use: 'invuln', until: 'adds', kind: 'larva', n: 6 }] } },
        { at: 0.3, enter: { say: '虫王又钻进了地下！', col: '#d0a0ff', mechs: [{ use: 'invuln', until: 'adds', kind: 'larva', n: 8 }] } },
      ] },
  },

  items: {
    epics: [
      { key: 'ep_an_bullcore', slot: 'support', lvl: 45, name: '牛头械王的动力核心', fx: { dmgUp: 0.1, fire: 11, hardness: 20 },
        proc: { chance: 0.05, cd: 3, act: 'strike', mul: 1.8, aoe: 120, elem: 'light', vis: 'bolt', name: '三道落雷' }, desc: '比尔马克帝国拿来驱动牛头械王的核心，拆下来以后还在嗡嗡作响。',
        look: 'a heavy brass and steel machine core with a glowing orange furnace window, small pipes and a bull horn emblem' },
      { key: 'ep_an_bugfang', slot: 'ring', lvl: 50, name: '虫王戮蛊的毒牙', fx: { dmgUp: 0.07, dark: 14, crit: 0.03 },
        proc: { chance: 0.06, cd: 2, act: 'status', status: 'poison', dur: 5, name: '戮蛊之毒', desc: '攻击时 6% 几率让敌人中毒 5 秒。' }, desc: '悲鸣洞穴最深处的虫王留下的毒牙，做成了戒指。',
        look: 'a dark silver ring set with a curved violet insect fang dripping a tiny drop of glowing poison' },
    ],
  },

  dungeons: {
    bilmark: { name: '比尔马克帝国试验场', lvl: [44, 45], bossLvl: 46, theme: 'bmLab', layout: 'ancient', hidden: true, unlock: { quest: 'q_an01' },
      mobs: [['bloodCat', 3], ['fickleCat', 1], ['tauCalf', 1], ['ivan', 1], ['ivanColonel', 0], ['hanik', 0]], elite: 'tauCommander', boss: 'mechKing', bossAdds: 0, bgm: 'dungeon3', bossBgm: 'boss',
      gate: { scene: 'gf_lorien', x: 1980, col: '255,190,110' },
      desc: '【远古】洛兰深处的帝国秘密试验场（俗称「牛头 / 机械牛」）。伊凡房：清光柱子召唤的伊凡，路障才会炸开；统帅房：先拆掉召唤小牛的柱子；牛头械王倒地起身会朝前方落三道雷，「保护模式」时必须在限时内打掉机器人，否则它们会变成牛头统帅。',
      drops: { boss: [['ep_an_bullcore', 0.05]], mats: [['crystal', 0.12, 10], ['m_iron', 0.05, 2], ['m_obsidian', 0.008, 1]] } },
    wailing_cave: { name: '悲鸣洞穴', lvl: [49, 50], bossLvl: 51, theme: 'wcCave', layout: 'ancient', hidden: true, unlock: { quest: 'q_an03' },
      mobs: [['jungleZombie', 3], ['graveDigger', 1], ['larva', 1], ['fabroMember', 1], ['fabroCaptain', 0], ['adultBug', 0]], elite: 'kain', boss: 'bugKing', bossAdds: 0, bgm: 'abyss', bossBgm: 'boss',
      gate: { scene: 'darkelf_field', x: 3780, col: '200,150,255' },
      desc: '【远古】暗黑城地下的虫王巢穴（俗称「虫穴」）。紫色法阵里的怪打不到——引出来或打碎法阵；先杀法布罗队长；限时打掉魔剑阿波菲斯；幼虫会互相吞噬变成成虫，爬到虫王身边会被吃掉给它回血。',
      drops: { boss: [['ep_an_bugfang', 0.05], ['ep_gs_apophis', 0.03], ['ep_an_bullcore', 0.01]], mats: [['crystal', 0.12, 10], ['m_bone', 0.05, 2], ['m_soul', 0.004, 1]] } },
  },

  story: { chapter: '远古 · 机制地下城', prefix: 'q_an', pre: 'q_sn14', npc: 'tuguan', scene: 'gf_lorien', steps: [
    { t: 'talk', with: 'tuguan', name: '比尔马克试验场', lvl: 44, reward: { exp: 0.03, gold: 1500 },
      desc: '土罐在洛兰深处捡到了一块刻着帝国纹章的铁片。去问问他。',
      talk: { offer: ['嘘——小声点。我在洛兰深处的树林里，捡到了这个。', '比尔马克帝国的纹章……那里有一座帝国的秘密试验场，传说关着一头机械做的牛头王。'], done: ['入口我已经帮你找到了，就在洛兰的最右边。', '那里的机关可不是光靠蛮力能过的——看清楚再打。'] } },
    { t: 'boss', dungeon: 'bilmark', name: '牛头械王', lvl: 44, reward: { exp: 0.12, gold: 5000 },
      desc: '闯过比尔马克帝国试验场，打倒牛头械王。',
      talk: { offer: ['伊凡会自爆——在它们爆炸之前清掉；柱子会一直召唤，路障要清光伊凡才会炸开。', '牛头械王被打倒爬起来的时候，千万别站在它前面。', '它喊「保护模式」的时候，赶紧打掉机器人。'], doing: ['跳起来能躲它的全屏吼叫。'], done: ['你真的把那头机械牛拆了？！', '暗精灵那边……也有一个我一直不敢提的地方。'] } },
    { t: 'talk', npc: 'tuguan', with: 'kurent', name: '悲鸣洞穴', lvl: 49, reward: { exp: 0.03, gold: 1500 },
      desc: '土罐说暗黑城的地下还有一个叫「悲鸣洞穴」的地方。去阿法利亚营地问问克伦特。',
      talk: { offer: ['暗黑城的地下有个洞穴，一到晚上就传出哭声。暗精灵叫它「悲鸣洞穴」。', '去阿法利亚营地问问克伦特吧。'], done: ['……你想去悲鸣洞穴？', '那里是虫王戮蛊的巢穴。它的幼虫什么都吃——包括彼此。入口在暗精灵地区的最右边，我替你打开。'] } },
    { t: 'boss', dungeon: 'wailing_cave', name: '虫王戮蛊', npc: 'kurent', lvl: 49, reward: { exp: 0.14, gold: 6000 },
      desc: '深入悲鸣洞穴，打倒虫王戮蛊。',
      talk: { offer: ['紫色法阵里的东西打不到——把它们引出来，或者打碎法阵。', '魔剑阿波菲斯一出土就要马上打掉，拖久了盗墓者会发狂。', '虫王钻进地下的时候，别让幼虫爬到它身边。'], doing: ['幼虫凑在一起会互相吞噬，长成成虫就麻烦了。'], done: ['……悲鸣停了。', '这颗毒牙你收着吧。'] } },
  ] },

  art: {
    chars: {
      bmIvan: { h: 80, hold: 'with a big round bomb strapped to his back', desc: 'Crazy Ivan, an experimental soldier of the Bilmark Empire proving ground: a short stocky bald man with wild crazed eyes and a toothy grin, wearing a torn grey prisoner jumpsuit with a number patch, a metal collar with a blinking lamp, heavy boots, a big round black bomb with a fuse strapped to his back.',
        atk: 'his fists', cast: 'raising both fists and laughing madly', low: 'running forward low with arms spread' },
      bmRobot: { h: 66, hold: null, desc: 'A small experimental robot of the Bilmark Empire: a squat round steel robot on two short stubby legs, a dome head with one big round red lens eye, riveted brass plates, a small antenna, little claw arms and a bull horn emblem on its chest.',
        atk: 'its little claw arm', cast: 'raising both claw arms with the antenna up', low: 'crouching and rolling forward low' },
      bmMechTau: { h: 150, boss: true, hold: 'holding a giant mechanical battle axe', desc: 'The Mechanical Tau King, the ultimate experiment of the Bilmark Empire: a huge minotaur warrior rebuilt with machine parts, a bull head with big curved horns and one glowing mechanical eye, steel armor plates bolted onto dark fur, pistons and pipes on the arms and legs, a small furnace grate in the chest, holding a giant mechanical battle axe.',
        atk: 'the giant mechanical axe', cast: 'raising the axe high as steam bursts from the pipes', low: 'lowering the horns and charging forward' },
      wcKain: { h: 118, hold: 'holding a huge cursed dark greatsword', desc: 'Kain the Skeleton, an elite of the Wailing Cave: a tall armored skeleton knight in rusty black plate armor with a torn dark red cape, a horned helmet over a grinning skull with glowing blue eyes, holding a huge cursed dark greatsword with a violet edge.',
        atk: 'the huge cursed greatsword', cast: 'raising the greatsword overhead with both hands', low: 'lunging forward low with the greatsword held back' },
      wcLarva: { h: 44, hold: null, cycle: 'crawl', desc: 'A Lugu larva monster of the Wailing Cave: a fat segmented grub-like insect larva with a pale violet body and darker stripes, many short stubby legs, a round head with small mandibles and two tiny black eyes.',
        atk: 'its small mandibles', cast: 'rearing its front half up', low: 'lunging forward low' },
      wcBugKing: { h: 110, boss: true, cycle: 'crawl', desc: 'Lugu the Bug King, the boss of the Wailing Cave: a gigantic armored centipede-like insect king with a long segmented dark violet carapace, many sharp legs, a big horned head with huge mandibles and glowing red compound eyes, spiky needle rows along its back and a stinger tail.',
        atk: 'its huge mandibles biting', cast: 'rearing its head up high with mandibles open', low: 'lowering its head and lunging forward' },
    },
    gates: {
      bilmark: 'a hidden riveted steel bunker door of the Bilmark Empire half overgrown by forest roots and moss, a bull head emblem and warning lamps, a warm orange portal',
      wailing_cave: 'a dark cave mouth ringed with huge insect mandible-like rocks, sticky resin and shed insect husks, faint violet ghost lights, a deep violet portal',
    },
  },
});
