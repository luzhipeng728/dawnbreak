/* =====================================================================
   区域：天界 · 海上列车（官方 70 版本 Lv65~74；满级 60 后放在 Lv52~56）
   官方依据：天界的海上列车重新运行，卡勒特雇佣的「铁鳞海贼团」（突变的海洋生物 / 鱼人海盗）不断袭击铁道车站，想控制所有海上列车。
     区域在天界「鲁夫特悬空海港」。地下城：列车上的海贼（领主黑鳞莫贝尼：召唤鳄鱼、鳄鱼图腾定身后爆炸、起跳砸地、远程标枪；
     蓝色人鱼回血 / 水柱追踪 / 泡沫护甲，副船长鳄鱼扔标枪、舱门里跳出鳄鱼，海盗船开炮；约一成换成小人鱼空空）、夺回西部线（烈焰盾波迪尔：无敌冲锋、身后喷火、跳躲开重拳）、
     雾都赫伊斯（范·弗拉丁；中途兜风皮埃尔 / 派普·乔 / 狙击手艾丽格；满图雾气、掩体、皮埃尔冲车道、炸弹）、
     决战阿登高地（攻坚，黎明之眼 安祖·赛弗：突刺、黑洞再落雷、低血机械武装；中途双枪哈斯 / 狂徒伯纳 / 告密者特雷克）。
   本作原创：鲁夫特港站长哈兰德、各招式与机制组合（图腾 = 定身 + 延时爆炸、过热的锅炉、雾里的掩体、机械武装）、
     史诗「黎明之眼」、深渊专属「铁鳞海贼团的宝藏」。
   入口：天界之门（x 1700 往上，Lv.52）→ 鲁夫特悬空海港 → 海上铁道（四个地下城 + 深渊）
   ===================================================================== */
defineRegion({
  id: 'train', name: '天界 · 海上列车', lvl: 52, lvlMax: 56, power: 1.3, bossPower: 1, atkPower: 1.12,
  entry: { scene: 'heaven_gate', side: 'up', x: 1700, to: 'luft_port', minLv: 52, label: '鲁夫特悬空海港' },

  themes: {
    trPort: { grade: { tint: 'rgba(70,110,150,0.08)', fog: 'rgba(210,235,255,0.08)' }, ambient: 'motes', rgb: '225,240,255', floorW: 1700,
      pal: { sky: ['#2a4a70', '#6a9ac0', '#c8e0f0'], haze: '#d8ecf8' },
      bg: ['Luft Harbor, a floating sky harbor of the Heavenly Realm built over the sea: steampunk sea train station platforms on wooden piers, iron railway bridges running over the water toward the horizon, a brass clock tower, a lighthouse, moored airships above, seagulls, bright sea and sky.',
        'wooden dock planks with a pair of iron rails, rivets and coiled ropes',
        'a brass railing with lifebuoys, coiled ropes, luggage trunks and crates along the pier edge'] },
    trDeck: { edgeHoles: true, grade: { tint: 'rgba(40,90,130,0.10)', fog: 'rgba(190,225,255,0.08)' }, ambient: 'motes', rgb: '210,235,255', floorW: 1700,
      pal: { sky: ['#1e3a58', '#4a7898', '#a8c8dc'], haze: '#c0dcf0' },
      bg: ['On top of a speeding sea train: a line of steampunk freight cars racing over a long stone railway bridge across the open sea, a pirate ship with torn black sails and a crocodile skull figurehead sailing alongside, big ocean waves and sea spray, a cloudy sky.',
        'the riveted steel roof and deck of a freight car with wooden planks, metal hatches and bolts',
        'a freight car railing with barrels, coiled ropes, cargo nets and a torn pirate flag'] },
    trCar: { grade: { tint: 'rgba(110,80,50,0.10)', fog: 'rgba(255,220,170,0.06)' }, ambient: 'motes', rgb: '255,225,180', floorW: 1700,
      pal: { sky: ['#2a1c14', '#5a3e2a', '#9a7450'], haze: '#e8c898' },
      bg: ['Inside the Western Line sea train: a long steampunk cargo car interior with brass lamps, wood-paneled walls, round windows showing the sea outside, steam pipes along the ceiling, Kartel supply crates and stacked oil drums.',
        'a wooden train car floor with metal plates, a worn red runner carpet and scattered bolts',
        'rows of cargo crates, oil drums and a brass steam pipe along the car wall'] },
    trHeis: { edgeHoles: true, grade: { tint: 'rgba(120,130,140,0.18)', fog: 'rgba(225,230,238,0.26)' }, ambient: 'wisps', rgb: '230,235,240', floorW: 1700,
      pal: { sky: ['#3a4048', '#6a7078', '#a8aeb4'], haze: '#dfe4ea' },
      bg: ['Heis, the misty city: a steampunk harbor city in thick grey-white fog, tall soot-stained brick buildings, iron bridges and chimneys, dim gas lamps glowing through the mist, Kartel searchlight towers, a clock tower silhouette.',
        'wet dark cobblestone street with puddles and a drain grate',
        'a wrought-iron railing with gas lamp posts, stacked crates and a Kartel checkpoint barrier'] },
    trArden: { grade: { tint: 'rgba(150,110,70,0.10)', fog: 'rgba(255,220,170,0.08)' }, ambient: 'motes', rgb: '255,225,180', floorW: 1800,
      pal: { sky: ['#3a2a3a', '#a06a5a', '#f0c890'], haze: '#ffd8a8' },
      bg: ['Arden Highland, a windswept rocky plateau above the clouds at dawn: the fortified main camp of the Kartel army with big cannons, war banners, watchtowers and barbed wire, a fleet of Kartel airships in a golden dawn sky, tall grass and rocks.',
        'rocky highland ground with tall grass, trenches, tire tracks and shell craters',
        'a sandbag trench line with barbed wire, a broken cannon and big rocks'] },
  },

  monsters: {
    // 铁鳞海贼团
    seaPirate: { name: '铁鳞海贼', tier: 'normal', arch: 'aggressive', size: [14, 12, 102], art: 'trFishman',
      skills: [{ use: 'swipe', reach: 76, dmg: 1.0, launch: 380, cd: [1.6, 2.6], w: 2, say: '' }, { use: 'dash', len: 300, speed: 700, windup: 0.7, dmg: 1.1, cd: [4.5, 6] }] },
    spearPirate: { name: '投枪海贼', tier: 'caster', arch: 'kiter', size: [14, 12, 100], art: ['trFishman', { hue: 30, sat: 1.0, bright: 0.95 }],
      skills: [{ use: 'shot', clip: 'throw', mode: 'straight', speed: 520, dmg: 0.85, pierce: true, cd: [2, 3], w: 2, col: '#c8d8e8' },
        { use: 'aoe', clip: 'throw', shape: 'circle', at: 'target', r: 52, n: 2, scatter: 90, windup: 1.1, dmg: 0.6, status: 'stun', sdur: 0.8, col: '#8ad0ff', cd: [6, 8], say: '小鱼！' }] },
    bleedPirate: { name: '鱼弹海贼', tier: 'caster', arch: 'kiter', size: [14, 12, 100], art: ['trFishman', { hue: -170, sat: 0.9, bright: 0.85 }],
      skills: [{ use: 'shot', mode: 'spread', n: 3, spread: 40, speed: 380, dmg: 0.75, status: 'bleed', cd: [3, 4.5], w: 2, col: '#ff7a7a' }, { use: 'swipe', dmg: 0.8, reach: 60, cd: [2, 3] }] },
    blueMermaid: { name: '蓝色人鱼', tier: 'caster', arch: 'kiter', size: [14, 12, 100], elem: 'ice', art: 'trMermaid',
      skills: [{ use: 'buff', clip: 'cast', kind: 'heal', target: 'allies', r: 300, amt: 0.1, cd: [7, 9], w: 1.5, say: '人鱼之歌' },
        { use: 'shot', clip: 'cast', mode: 'homing', speed: 240, turn: 2.2, dmg: 0.85, cd: [3.5, 5], w: 2, col: '#6ad0ff' },
        { use: 'buff', clip: 'cast', kind: 'shield', target: 'allies', r: 260, amt: 0.25, dur: 6, cd: [12, 15], say: '泡沫护甲！' }] },
    kongkong: { name: '小人鱼空空', tier: 'swarm', arch: 'swarm', size: [12, 10, 70], scale: 0.7, speed: 150, elem: 'ice', art: ['trMermaid', { hue: -150, sat: 1.2, bright: 1.1 }],
      skills: [{ use: 'swipe', reach: 52, dmg: 0.7, cd: [1.2, 2.2] }, { use: 'shot', mode: 'straight', speed: 360, dmg: 0.6, cd: [3, 4], col: '#8ae0ff' }] },
    crocPirate: { name: '鳄鱼海贼', tier: 'brute', arch: 'aggressive', size: [16, 12, 110], weight: 2, art: 'trCroc',
      skills: [{ use: 'swipe', clip: 'bite', n: 2, reach: 80, dmg: 1.05, cd: [1.8, 2.8], w: 2 }, { use: 'shot', clip: 'throw', mode: 'straight', speed: 560, dmg: 0.95, cd: [4, 6], col: '#d8c8a0', say: '标枪！' }] },
    crocMate: { name: '副船长鳄鱼', tier: 'elite', arch: 'aggressive', size: [17, 13, 118], scale: 1.2, art: ['trCroc', { sat: 0.85, bright: 0.75 }], traits: { sa: 'cast' },
      skills: [{ use: 'swipe', n: 3, reach: 90, dmg: 1.05, cd: [1.6, 2.4], w: 2 }, { use: 'shot', clip: 'throw', mode: 'spread', n: 3, spread: 36, speed: 560, dmg: 0.9, cd: [4, 6], say: '标枪齐射！' },
        { use: 'summon', kind: 'crocPirate', n: 2, max: 3, cd: [14, 18], say: '舱门里的，都出来！' }] },
    pirateCannon: { name: '海盗船炮', tier: 'normal', arch: 'guard', size: [24, 16, 80], weight: 8, speed: 30, hardness: 40, art: ['dragonCannon', { hue: 170, sat: 0.6, bright: 0.7 }], traits: { sa: 'always', immune: ['stun', 'freeze'] },
      skills: [{ use: 'rain', kind: 'hex', n: 3, r: 50, windup: 1.3, dmg: 1.0, col: '#ffb050', cd: [5, 7], w: 2, say: '开炮！' }, { use: 'shot', mode: 'arc', r: 60, dmg: 0.95, cd: [3, 4.5], col: '#ffb050' }] },
    // 卡勒特（西部线 / 赫伊斯 / 阿登高地）
    ktMarine: { name: '卡勒特海兵', tier: 'caster', arch: 'kiter', size: [13, 12, 104], art: ['gtSoldier', { hue: 170, sat: 2.2, bright: 0.9 }],
      skills: [{ use: 'shot', mode: 'straight', speed: 480, dmg: 0.85, cd: [1.6, 2.6], w: 2.5, col: '#ffd070' }, { use: 'shot', mode: 'spread', n: 3, spread: 30, speed: 460, dmg: 0.7, cd: [4, 6] }, { use: 'swipe', dmg: 0.8, reach: 56, cd: [2, 3] }] },
    ktFlamer: { name: '卡勒特火焰兵', tier: 'normal', arch: 'aggressive', size: [14, 12, 104], elem: 'fire', art: ['gtSoldier', { hue: -35, sat: 2.6, bright: 0.9 }], traits: { sa: 'cast' },
      skills: [{ use: 'aoe', shape: 'line', at: 'front', len: 220, hw: 30, windup: 0.8, dmg: 1.0, status: 'burn', col: '#ff7a3a', cd: [4, 6], w: 1.5, say: '火焰喷射！' }, { use: 'swipe', dmg: 0.9, reach: 60, cd: [1.8, 2.8], w: 2 }] },
    ktShield: { name: '卡勒特盾卫', tier: 'brute', arch: 'guard', size: [17, 13, 116], scale: 1.1, weight: 3, hardness: 40, art: 'gtShield', traits: { sa: 'cast' },
      skills: [{ use: 'guard', dur: 2.4, reduce: 0.85, cd: [6, 8], w: 1.5, counter: { use: 'aoe', shape: 'line', at: 'front', len: 150, hw: 30, windup: 0.4, dmg: 1.15, knock: 300 } }, { use: 'swipe', clip: 'slam', reach: 88, dmg: 1.15, down: true, cd: [2.4, 3.4], w: 2 }] },
    ktGunner: { name: '卡勒特机枪手', tier: 'elite', arch: 'kiter', size: [15, 12, 110], scale: 1.15, art: 'gtGunner',
      skills: [{ use: 'laser', windup: 1.6, dur: 1.4, sweep: 40, dmg: 0.5, col: '#ffd070', cd: [5, 7], w: 1.5, say: '机枪扫射！' }, { use: 'shot', mode: 'spread', n: 5, spread: 50, speed: 460, dmg: 0.6, cd: [4, 6] }] },
    steamBoiler: { name: '过热的锅炉', tier: 'swarm', arch: 'guard', size: [22, 14, 90], weight: 99, speed: 1, art: ['furnace', { hue: -20, sat: 0.8, bright: 0.85 }], traits: { immune: ['stun', 'freeze'] },
      skills: [{ use: 'explode', range: [0, 260], dy: 90, r: 120, windup: 2.6, dmg: 1.4, cd: [1, 2], say: '锅炉要炸了！快打坏它！', col: '#ff8a3a' }] },
    // 赫伊斯的中途精英
    pierre: { name: '兜风皮埃尔', tier: 'elite', arch: 'aggressive', size: [20, 14, 110], speed: 160, art: ['gtSuleide', { hue: -160, sat: 1.3, bright: 0.95 }], traits: { sa: 'cast' },
      skills: [{ use: 'dash', len: 480, speed: 860, windup: 0.6, dmg: 1.2, cd: [3, 4.5], w: 2, say: '兜风时间！' }, { use: 'aoe', shape: 'circle', at: 'self', r: 120, windup: 0.5, dmg: 1.0, cd: [6, 8] }] },
    pipeJoe: { name: '派普·乔', tier: 'elite', arch: 'aggressive', size: [18, 14, 120], scale: 1.25, weight: 4, art: ['gtSoldier', { hue: -30, sat: 1.6, bright: 0.7 }], traits: { sa: 'cast' },
      skills: [{ use: 'swipe', clip: 'slam', n: 2, reach: 96, width: 30, dmg: 1.15, down: true, cd: [2, 3], w: 2 }, { use: 'grab', reach: 66, hold: 0.8, throwDmg: 1.4, cd: [7, 9], say: '抓住你了！' },
        { use: 'aoe', shape: 'circle', at: 'target', r: 90, windup: 1.2, dmg: 0.8, status: 'blind', sdur: 2, col: '#b8b8c0', cd: [8, 10], say: '烟斗的浓烟' }] },
    sniperAlleg: { name: '狙击手艾丽格', tier: 'elite', arch: 'kiter', size: [14, 12, 106], art: 'gtSniper',
      skills: [{ use: 'laser', windup: 1.4, dur: 0.4, hw: 12, dmg: 1.4, col: '#ff6a6a', cd: [4.5, 6], w: 2, say: '瞄准……' }, { use: 'shot', mode: 'straight', speed: 720, dmg: 0.9, cd: [2, 3] }, { use: 'blink', to: 'away', dist: 240, cd: [8, 11], w: 0.6 }] },
    // 阿登高地的中途精英
    haas: { name: '双枪哈斯', tier: 'elite', arch: 'kiter', size: [14, 12, 108], art: ['gtSoldier', { hue: 120, sat: 1.9, bright: 0.85 }],
      skills: [{ use: 'shot', mode: 'spread', n: 4, spread: 24, speed: 560, dmg: 0.7, cd: [2.5, 3.5], w: 2, say: '' }, { use: 'seq', cd: [7, 9], say: '双枪乱射！', steps: [{ use: 'blink', to: 'behind', dist: 90 }, { use: 'aoe', shape: 'circle', at: 'self', r: 120, windup: 0.5, dmg: 1.0 }] }] },
    berner: { name: '狂徒伯纳', tier: 'elite', arch: 'aggressive', size: [18, 14, 118], scale: 1.2, speed: 130, art: ['nmBandit', { hue: 160, sat: 1.2, bright: 0.8 }], traits: { sa: 'cast' },
      skills: [{ use: 'swipe', n: 4, reach: 84, gap: 0.26, dmg: 0.9, cd: [1.8, 2.6], w: 2 }, { use: 'dash', len: 380, speed: 780, windup: 0.6, dmg: 1.2, cd: [4, 6], say: '哈哈哈！' }, { use: 'buff', kind: 'enrage', target: 'self', dur: 8, cd: [16, 20] }] },
    trek: { name: '告密者特雷克', tier: 'elite', arch: 'kiter', size: [14, 12, 100], art: ['nmBandit', { hue: -110, sat: 1.0, bright: 0.9 }],
      skills: [{ use: 'shot', clip: 'throw', mode: 'arc', n: 2, r: 60, dmg: 0.8, status: 'blind', sdur: 1.5, cd: [4, 5.5], w: 2, col: '#a0a0b0', say: '烟雾弹！' }, { use: 'summon', kind: 'rx78', n: 2, max: 3, cd: [12, 16], say: '长官！在这里！' },
        { use: 'blink', to: 'away', dist: 260, cd: [7, 10], w: 0.8 }] },
    // 领主机制物件，不进房间怪表。图腾定身到被打掉或引信结束；炸弹到点爆炸。
    crocPillar: { name: '鳄鱼图腾', tier: 'swarm', size: [16, 12, 110], obj: { shape: 'totem', col: '#6a8a48', h: 110 } },
    fladinBomb: { name: '弗拉丁的炸弹', tier: 'swarm', size: [16, 12, 70], obj: { shape: 'barrel', col: '#c45a28', h: 70 } },
  },

  bosses: {
    // 莫贝尼：鳄鱼图腾定在脚下并延时爆炸（打掉就解定身）；起跳砸地要在落地瞬间跳；免疫冰冻。空空伊是 sea_pirates 的 10% 替换，沿用小人鱼空空的招。
    mobeni: { name: '黑鳞莫贝尼', lvl: 53, size: [20, 15, 134], weight: 5, speed: 100, art: 'trMobeni', scale: 1.2, pref: 120, traits: { sa: 'cast', immune: ['freeze'] },
      mechs: [{ use: 'groggy', max: 100, dur: 6 }],
      phases: [
        { at: 1, skills: [
          { use: 'swipe', clip: 'slam', n: 2, reach: 110, width: 34, dmg: 1.15, cd: [1.8, 2.6], w: 1.6 },
          { use: 'dash', id: 'spin', spin: true, len: 300, speed: 460, windup: 0.9, hw: 40, dmg: 1.15, cd: [7, 9], w: 1.6, say: '旋转斩——他转起来了，别贴着站！' },
          { use: 'plant', id: 'totem', clip: 'sigB', kind: 'crocPillar', n: 1, at: 'target', root: true, fuse: 4.2, hits: 4, onFuse: 'explode', r: 120, dmg: 1.5, max: 2, label: '图腾', col: '#8aa05a', cd: [12, 15], w: 1.3, say: '鳄鱼图腾——被定住了，先打掉它！' },
          { use: 'leap', id: 'slam', clip: 'sigA', crouch: 0.25, up: 0.35, track: 0.55, fall: 0.45, r: 160, hover: 560, jump: true, dmg: 1.7, col: '#8aa05a', cd: [10, 13], w: 1.4, say: '起跳砸地——落地的瞬间跳起来！' }] },
        { at: 0.55, enter: { say: '铁鳞海贼团，全员开炮！', col: '#ffb050', summon: { kind: 'crocPirate', n: 2 } },
          skills: [{ use: 'summon', kind: 'crocPirate', n: 2, max: 4, cd: [16, 20], say: '上来吧，小的们！' }] },
      ] },
    // 波迪尔：冲锋前先无敌（dash 本身没有无敌参数，所以用一段撑秒无敌再接冲锋）；闪到身后喷扇形火；全屏重拳用跳躲开。
    podir: { name: '烈焰盾波迪尔', lvl: 54, size: [20, 15, 130], weight: 6, speed: 90, elem: 'fire', art: 'trPodir', scale: 1.2, pref: 110, traits: { sa: 'cast' },
      mechs: [{ use: 'groggy', max: 110, dur: 6 }],
      phases: [
        { at: 1, skills: [
          { use: 'aoe', shape: 'line', at: 'front', len: 280, hw: 34, windup: 0.9, dmg: 1.1, status: 'burn', col: '#ff7a3a', cd: [4, 6], w: 1.6, say: '火焰长枪' },
          { use: 'seq', id: 'fireCharge', clip: 'sigA', cd: [9, 12], w: 1.4, say: '烈焰冲锋——他无敌了，躲开这一撞！', steps: [
            { use: 'mech', mech: { use: 'invuln', until: 'survive', survive: 2.6, hide: false, col: '#ff7a3a', say: '波迪尔点着了自己——这下打不动！' } },
            { use: 'dash', len: 520, speed: 780, windup: 0.95, dmg: 1.4, status: 'burn', knock: 380, col: '#ff7a3a' }] },
          { use: 'seq', id: 'blinkCone', clip: 'sigB', cd: [8, 11], w: 1.3, say: '波迪尔闪到身后喷火——绕开扇形！', steps: [
            { use: 'blink', to: 'behind', dist: 80, col: '#ff7a3a' },
            { use: 'cone', ang: 70, len: 340, windup: 0.95, dur: 1.1, tick: 0.2, dmg: 0.32, status: 'burn', col: '#ff7a3a' }] },
          { use: 'aoe', id: 'punch', clip: 'slam', shape: 'circle', at: 'self', r: 320, windup: 1.05, dmg: 1.35, jump: true, down: true, col: '#ff7a3a', cd: [11, 14], w: 1.2, say: '烈焰重拳——跳起来！' }] },
        { at: 0.5, enter: { say: '波迪尔的冲锋更猛了——无敌的时候别硬接！', col: '#ff7a3a' } },
      ] },
    // 弗拉丁：整场雾 + 掩体。被瞄准要躲到掩体后面（和施法者、自己不在一条纵深）。皮埃尔沿纵深冲。炸弹打掉就没事。
    fladin: { name: '范·弗拉丁', lvl: 55, size: [16, 13, 126], speed: 105, art: 'trFladin', scale: 1.2, pref: 190, traits: { sa: 'cast' },
      mechs: [{ use: 'groggy', max: 100, dur: 6 },
        { use: 'arena', kind: 'fog', r: 220, dur: 0, col: '#c8ccd4', say: '赫伊斯的雾笼罩了全场——视野变窄了！' },
        { use: 'arena', kind: 'cover', n: 3, cover: 'msCover', dur: 0 }],
      phases: [
        { at: 1, skills: [
          { use: 'laser', windup: 1.5, dur: 1.2, sweep: 40, dmg: 0.5, col: '#ffd070', cd: [6, 8], w: 1.5, say: '机枪扫射——看到细线就躲开！' },
          { use: 'swipe', n: 2, reach: 86, dmg: 1.0, cd: [2, 3], w: 1.5 },
          { use: 'lanes', id: 'ride', clip: 'sigA', kind: 'runner', runner: 'pierre', lanes: 4, hit: 3, speed: 900, windup: 1.1, dmg: 1.25, col: '#ffd070', cd: [11, 14], w: 1.3, say: '兜风皮埃尔冲过来了——站进没亮的那一排！' },
          { use: 'mark', id: 'snipe', clip: 'sigB', mode: 'cover', delay: 1.6, cover: 'msCover', dmg: 1.6, cd: [9, 12], w: 1.3, say: '被瞄准了——躲到掩体后面！', col: '#ff6a6a' },
          { use: 'plant', id: 'bombs', kind: 'fladinBomb', n: 2, at: 'spots', fuse: 5, hits: 3, onFuse: 'explode', r: 100, dmg: 1.25, max: 4, label: '炸弹', col: '#ff8a3a', cd: [13, 16], w: 1, say: '炸弹——引信走完会炸，先拆掉！' }] },
      ] },
    // 人形：步枪、枪托挑飞后扫射、斜向突刺。低血机械武装换掉这套招，换成火箭感电、黑洞落雷、导弹。
    anzu: { name: '黎明之眼 安祖·赛弗', tier: 'raid', lvl: 56, power: 0.85, size: [18, 14, 134], weight: 7, speed: 100, art: 'trAnzu', scale: 1.3, pref: 150, traits: { sa: 'cast', immune: ['stun', 'freeze'] },
      mechs: [{ use: 'groggy', max: 130, dur: 6, mul: 1.6 }, { use: 'enrage', t: 300 }],
      phases: [
        { at: 1, skills: [
          { use: 'shot', id: 'rifle', mode: 'straight', speed: 540, dmg: 0.85, cd: [1.5, 2.3], w: 2, col: '#ffd890' },
          { use: 'seq', id: 'butt', cd: [6, 8], w: 1.5, say: '枪托挑飞——接着扫射，别站成一条线！', steps: [
            { use: 'swipe', reach: 96, windup: 0.45, dmg: 1.05, launch: 300 },
            { use: 'shot', mode: 'spread', n: 5, spread: 26, speed: 500, dmg: 0.5, col: '#ffd890' }] },
          { use: 'dash', id: 'thrust', clip: 'sigA', len: 480, speed: 860, windup: 0.95, dmg: 1.35, cd: [5, 7], w: 1.5, say: '突刺——别站在直线上！', col: '#ffd890' }] },
        { at: 0.35, enter: { say: '安祖·赛弗展开了机械武装！', col: '#ffd890', mechs: [{ use: 'form', name: '机械武装', art: 'trAnzu_mech', dur: 0, scale: 1.12, invulT: 1.2, col: '#e8d8a0', say: '机械武装——火箭、黑洞、导弹！',
          skills: [
            { use: 'shot', id: 'rocket', clip: 'sigA', mode: 'homing', n: 3, spread: 40, speed: 280, turn: 1.6, dmg: 0.75, status: 'shock', sdur: 2, col: '#ffd890', cd: [5, 7], w: 1.6, say: '火箭感电——拐弯躲开！' },
            { use: 'seq', id: 'hole', clip: 'sigB', cd: [12, 15], w: 1.4, say: '磁场黑洞——先被吸过去，再躲开落雷！', steps: [
              { use: 'pull', mode: 'in', r: 460, force: 260, windup: 1.0, dur: 1.3, dmg: 0.3, col: '#2a2438' },
              { use: 'rain', kind: 'bolt', n: 7, r: 42, spread: 280, windup: 0.9, dmg: 1.0, col: '#ffd890' }] },
            { use: 'rain', id: 'missiles', kind: 'hex', n: 6, r: 48, spread: 300, windup: 1.15, dmg: 1.05, col: '#ffb050', cd: [8, 11], w: 1.3, say: '导弹齐射——看落点躲开！' },
          ] }] } },
      ] },
  },

  items: {
    epics: [
      { key: 'ep_tr_dawneye', slot: 'stone', lvl: 56, name: '黎明之眼', fx: { dmgUp: 0.075, light: 11, crit: 0.03 }, desc: '卡勒特总指挥安祖·赛弗的机械义眼。据说它看得见黎明前最暗的那一刻。',
        look: 'a round golden mechanical eye gem with a glowing warm amber iris, brass gears and tiny rivets around it, set in a sunburst shaped gold frame' },
    ],
    sets: [
      // 深渊专属（海上列车深渊）：本作原创，戒指 + 项链两件套
      { id: 'set_ironscale', name: '铁鳞海贼团的宝藏', lvl: 55, abyss: true, desc: '铁鳞海贼团从海上列车抢来、藏在深渊里的宝藏。',
        bonus: { 2: { st: { cdr: 0.08, dmgUp: 0.08, aspd: 0.06 }, desc: '【冷却流】技能冷却 -8%，伤害增加 8%，攻击速度 +6%；攻击时 6% 几率召来一发海盗炮弹（周围 160% 火属性伤害）',
          proc: { chance: 0.06, cd: 1.5, act: 'strike', mul: 1.6, aoe: 110, elem: 'fire', vis: 'fire', name: '海盗炮击' } } },
        pieces: [
          { key: 'ep_tr_blackscale', slot: 'ring', name: '莫贝尼的黑鳞戒指', look: 'a heavy dark iron ring set with a single glossy black crocodile scale and small gold rivets' },
          { key: 'ep_tr_doubloon', slot: 'neck', name: '海贼船长的金币项链', look: 'a necklace of old gold pirate doubloons with a crocodile skull stamp on a tarred rope cord' },
        ] },
    ],
  },

  dungeons: {
    sea_pirates: { name: '列车上的海贼', lvl: [52, 53], theme: 'trDeck', layout: 'standard', mobs: [['seaPirate', 3], ['spearPirate', 2], ['bleedPirate', 1.5], ['blueMermaid', 1], ['kongkong', 1], ['crocPirate', 1], ['pirateCannon', 0.6]], elite: 'crocMate', boss: 'mobeni', bossAlt: { kind: 'kongkong', chance: 0.1, say: '稀有领主 空空伊 出现了！' }, bgm: 'dungeon2', bossBgm: 'boss',
      gate: { x: 520, col: '120,190,255' }, desc: '铁鳞海贼团跳上了海上列车。蓝色人鱼会给海贼回血、套上泡沫护甲——先打人鱼。黑鳞莫贝尼的旋转斩会多段打中贴身的人；鳄鱼图腾会把你定在脚下再爆炸，先打掉图腾；它起跳砸地时，在落地的瞬间跳起来。',
      drops: { boss: [['ep_tr_dawneye', 0.006]], mats: [['crystal', 0.12, 10], ['m_bone', 0.03, 2], ['c_blue', 0.02, 1]] } },
    west_line: { name: '夺回西部线', lvl: [53, 54], theme: 'trCar', layout: 'long', mobs: [['ktMarine', 3], ['ktFlamer', 2], ['ktShield', 1.2], ['kartelMedic', 1], ['steamBoiler', 0.8], ['seaPirate', 1]], elite: 'ktShield', boss: 'podir', bgm: 'dungeon', bossBgm: 'boss',
      gate: { x: 1160, col: '255,170,110' }, desc: '卡勒特占领了西部线的列车。车厢里过热的锅炉会爆炸——趁它读条打坏它，或者跑远。烈焰盾波迪尔冲锋前会点着自己、打不动，躲开这一撞；他闪到身后喷火时绕开扇形；烈焰重拳要跳起来。',
      drops: { boss: [['ep_tr_dawneye', 0.008]], mats: [['crystal', 0.12, 10], ['c_red', 0.03, 2], ['m_iron', 0.03, 2]] } },
    heis: { name: '雾都赫伊斯', lvl: [54, 55], theme: 'trHeis', layout: 'long', mobs: [['ktMarine', 2.5], ['ktGunner', 1], ['ktFlamer', 1.5], ['kartelMedic', 1], ['pipeJoe', 0.3], ['pierre', 0]], elite: 'sniperAlleg', boss: 'fladin', bgm: 'dungeon3', bossBgm: 'boss',
      preBoss: { kind: 'pierre', say: '兜风皮埃尔：雾里兜风，最痛快了！' },
      gate: { x: 1800, col: '220,225,235' }, desc: '满城的浓雾挡住了视线。机枪手扫射前会先瞄准很久，看到细线就躲开。范·弗拉丁的雾里有掩体，被瞄准就躲到掩体后面；皮埃尔沿亮着的纵深冲过来，站进没亮的那一排；炸弹在引信走完前拆掉。',
      drops: { boss: [['ep_tr_dawneye', 0.01]], mats: [['crystal', 0.12, 10], ['m_elem2', 0.01, 1], ['m_iron', 0.03, 2]] } },
    arden: { name: '决战阿登高地', lvl: [55, 56], bossLvl: 57, theme: 'trArden', layout: 'raid', mobs: [['ktMarine', 2], ['ktFlamer', 1.5], ['ktShield', 1], ['ktGunner', 0.6], ['kartelMedic', 1], ['trek', 0.4], ['berner', 0]], elite: 'haas', boss: 'anzu', bossAdds: 0,
      bgm: 'abyss', bossBgm: 'boss', preBoss: { kind: 'berner', say: '狂徒伯纳挡在了阿登高地的山口！' },
      gate: { x: 2440, col: '255,210,140' }, desc: '【攻坚】卡勒特的总指挥「黎明之眼」安祖·赛弗亲自坐镇阿登高地。他用步枪射击，枪托挑飞之后接着扫射；突刺沿直线，别站在他面前。血量很低时展开机械武装：火箭带电，黑洞把人吸进去再落雷，导弹看落点躲开。',
      drops: { boss: [['ep_tr_dawneye', 0.04]], mats: [['crystal', 0.14, 12], ['m_soul', 0.004, 1], ['m_diamond', 0.01, 1]] } },
  },

  abyss: {
    abyss_train: { name: '海上列车深渊', from: 'heis', theme: 'abyssTrain', tint: 'rgba(40,20,110,0.32)', lvl: [55, 56], lordLvl: 58, cost: 1, pity: 7,
      lords: ['mobeni', 'podir', 'fladin'], gate: { scene: 'sea_rail', x: 2950 }, clearExp: 21000,
      waves: [{ n: 7, mobs: [['seaPirate', 2], ['spearPirate', 1], ['ktMarine', 1], ['blueMermaid', 0.6]], elite: 1, say: '铁鳞海贼和卡勒特一起冲上来了！' }, { elites: ['crocMate', 'pierre'], say: '副船长鳄鱼和兜风皮埃尔！' }],
      lord: { mechs: [{ use: 'enrage', t: 220 }], cycle: [{ every: [22, 28], at: 0.8, say: '深渊护盾！', mech: { use: 'shield', hp: 0.05, dur: 12, punish: 'heal', onBreak: 'groggy', col: '#c890ff' } },
        { every: [28, 34], at: 0.5, mech: { use: 'safezone', windup: 3.2, frac: 0.35, say: '深渊之力——站进光圈！' } }] },
      desc: '【深渊派对】海上铁道的尽头裂开了深渊。需要消耗 1 张深渊派对邀请函。深渊领主是海上列车的领主之一（每次随机）。「铁鳞海贼团的宝藏」只在这里出现。',
      quest: { name: '海上列车的深渊', lvl: 55, clear: 'heis', pre: ['q_abyss_gf'], gold: 8000, desc: '海上铁道的尽头裂开了深渊。通关「雾都赫伊斯」，歌兰蒂斯就会告诉你入口。',
        offer: ['天界的海上……也有深渊？', '铁鳞海贼团把抢来的宝藏藏进了深渊。先去通关雾都赫伊斯吧。'],
        done: ['海上铁道地图的最右边，深渊之门已经打开。'] } },
  },

  npcs: {
    harland: { name: '哈兰德', title: '鲁夫特港站长 · 修理 / 仓库', h: 118, services: ['quest', 'repair', 'storage'],
      greet: ['欢迎来到鲁夫特悬空海港！海上列车……总算又跑起来了。'], lines: ['铁鳞海贼团天天袭击车站，乘客都不敢上车了。', '那些海贼背后，是卡勒特的钱。', '西部线、赫伊斯、阿登高地……一站一站地夺回来吧。'],
      look: 'Harland, the station master of Luft Harbor: a sturdy middle-aged man with a thick grey beard and kind eyes, a navy blue railway uniform with brass buttons and a peaked conductor cap, a pocket watch chain on the vest, holding a small brass signal lantern, a warm smile' },
  },
  scenes: {
    luft_port: { name: '天界', area: '鲁夫特悬空海港', kind: 'town', width: 2400, theme: 'trPort', bgm: 'westcoast', ambient: 'gulls', map: [70, 4],
      props: [{ art: 'world/p_anchor', x: 460, h: 66 }, { art: 'world/p_buoy', x: 820, h: 34 }, { art: 'world/p_crates', x: 1700, h: 80, y: 30 }, { art: 'world/p_bollard', x: 2000, h: 30 }],
      npcs: [{ npc: 'harland', x: 1150, y: 50 }],
      exits: [{ side: 'down', x: 300, to: 'heaven_gate' }, { side: 'right', to: 'sea_rail' }] },
    sea_rail: { name: '天界', area: '海上铁道', kind: 'field', width: 3200, theme: 'trDeck', bgm: 'field', map: [60, 8],
      exits: [{ side: 'left', to: 'luft_port' }] },
  },

  story: { chapter: '天界篇 · 海上列车', prefix: 'q_tr', pre: 'q_gt12', npc: 'harland', scene: 'luft_port', steps: [
    { t: 'arrive', npc: 'kishika', to: 'harland', name: '重新运行的海上列车', lvl: 52, scene: 'luft_port', reward: { exp: 0.05, gold: 4000 },
      desc: '天界的海上列车重新运行了，可是铁鳞海贼团一直在袭击车站。从天界之门往上走，去鲁夫特悬空海港找站长哈兰德。',
      talk: { offer: ['皇都守住了，可卡勒特换了个法子——他们雇了海贼。', '铁鳞海贼团天天袭击海上列车的车站。去鲁夫特悬空海港，找站长哈兰德。'], doing: ['海港在天界之门往上走，Lv.52 才能过去。'], done: ['玛琳让你来的？太好了！', '我是站长哈兰德。海贼们……现在就在列车顶上！'] } },
    { t: 'clear', dungeon: 'sea_pirates', name: '列车上的海贼', lvl: 52, reward: { exp: 0.09, gold: 5000 },
      desc: '铁鳞海贼团跳上了正在行驶的海上列车。通关「列车上的海贼」。',
      talk: { offer: ['鱼人、人鱼、还有鳄鱼……铁鳞海贼团什么怪物都有。', '蓝色的人鱼会给同伴回血、套上泡沫护甲，先打她们。'], doing: ['海盗船会从海上开炮，看到地上的圈就躲开。'], done: ['车顶清干净了！可是船长……那条黑鳞的鳄鱼还在。'] } },
    { t: 'boss', dungeon: 'sea_pirates', name: '黑鳞莫贝尼', lvl: 53, reward: { exp: 0.1, gold: 6000 },
      desc: '打倒铁鳞海贼团的船长——黑鳞莫贝尼。',
      talk: { offer: ['莫贝尼会把鳄鱼图腾插在你脚下，定住你，过一会儿爆炸——先打掉图腾。', '它起跳砸地的时候，在落地的瞬间跳起来。'], doing: ['它还会把鳄鱼海贼叫上来。冰冻对它没用。'], done: ['莫贝尼倒下了……可它身上有一封卡勒特的信。', '“西部线的列车，交给波迪尔。”'] } },
    { t: 'clear', dungeon: 'west_line', name: '夺回西部线', lvl: 53, reward: { exp: 0.09, gold: 5000 },
      desc: '卡勒特占领了西部线的列车。通关「夺回西部线」。',
      talk: { offer: ['西部线的列车被卡勒特占了，车厢里全是他们的兵。', '车上的锅炉被他们烧到过热，随时会炸——看到它读条，要么打坏，要么跑远。'], doing: ['先打医疗兵。'], done: ['车厢夺回来了！可是车头那里……有一面烧着的盾。'] } },
    { t: 'boss', dungeon: 'west_line', name: '烈焰盾波迪尔', lvl: 54, reward: { exp: 0.1, gold: 6000 },
      desc: '打倒卡勒特的指挥官——烈焰盾波迪尔。',
      talk: { offer: ['波迪尔冲锋前会先把自己点着，那一会儿打不动，躲开这一撞。', '他闪到你身后喷火，绕开那道扇形；全屏重拳要跳起来。'], doing: ['车厢里的锅炉过热会炸，趁读条打坏，或者跑远。'], done: ['西部线夺回来了！', '俘虏说，卡勒特的指挥部在雾都赫伊斯。'] } },
    { t: 'clear', dungeon: 'heis', name: '雾都赫伊斯', lvl: 54, reward: { exp: 0.09, gold: 5000 },
      desc: '卡勒特的指挥部藏在满城浓雾的赫伊斯。通关「雾都赫伊斯」。',
      talk: { offer: ['赫伊斯一年到头都是雾，什么都看不清。', '卡勒特的机枪手瞄准得很久——看到细线就躲。'], doing: ['兜风皮埃尔、派普·乔、狙击手艾丽格……都是范·弗拉丁的手下。'], done: ['雾里……有一个拿着拐杖的男人。'] } },
    { t: 'boss', dungeon: 'heis', name: '范·弗拉丁', lvl: 55, reward: { exp: 0.11, gold: 7000 },
      desc: '打倒赫伊斯的卡勒特指挥官——范·弗拉丁。',
      talk: { offer: ['雾里有掩体。被瞄准的时候躲到掩体后面，别和他站在同一条纵深。', '皮埃尔会沿亮着的几排冲过来，站进没亮的那一排；地上的炸弹先拆掉。'], doing: ['机枪扫射前会先亮细线。'], done: ['范·弗拉丁说，卡勒特的总指挥“黎明之眼”在阿登高地等着你。'] } },
    { t: 'raid', dungeon: 'arden', name: '黎明之眼', lvl: 55, reward: { exp: 0.16, gold: 9000, coins: 2 },
      desc: '卡勒特的总指挥「黎明之眼」安祖·赛弗在阿登高地集结了全部兵力。打倒他。',
      talk: { offer: ['阿登高地是卡勒特最后的据点。双枪哈斯、狂徒伯纳、告密者特雷克都在路上。', '安祖的突刺沿直线，别站在他面前；黑洞会先把人吸过去，再躲开落雷。'], doing: ['血量很低的时候他会展开机械武装，一直打到倒下。'], done: ['黎明之眼……闭上了。', '卡勒特的军队撤出了天界的海上！'] } },
    { t: 'handin', to: 'harland', name: '海上列车的守护者', lvl: 56, reward: { exp: 0.08, gold: 6000, items: [{ key: 'ep_tr_dawneye', n: 1 }] },
      desc: '回鲁夫特悬空海港，把好消息告诉站长哈兰德。',
      talk: { offer: ['阿登高地拿下了。'], done: ['这是安祖的机械义眼，“黎明之眼”——你留着吧。', '对了，灯塔那边这几天一直有奇怪的光……像是一扇门。', '——天界篇 · 海上列车 · 完——'] } },
  ] },

  art: {
    chars: {
      trFishman: { h: 104, hold: 'holding a rusty harpoon spear', desc: 'A fishman pirate of the Iron Scale Pirates: a hunched humanoid fish mutant with blue-grey scales, big bulging yellow eyes, fin-shaped ears and a wide mouth with small sharp teeth, a torn striped sailor shirt, a red pirate bandana, a leather belt with a cutlass sheath, bare webbed feet, holding a rusty harpoon spear.',
        atk: 'the harpoon spear thrust', cast: 'raising the harpoon high and croaking', low: 'lunging forward low with the harpoon' },
      trMermaid: { h: 104, hold: 'holding a coral staff', fly: true, hover: 18, desc: 'A blue mermaid of the Iron Scale Pirates: a sea maiden with long wavy teal hair and a starfish hair clip, pale blue skin with small scales on the cheeks, a modest dark blue sailor-style blouse with a pearl brooch, a long shimmering dark blue fish tail with a fan fin instead of legs, floating upright above the ground, holding a coral staff.',
        atk: 'the coral staff swung forward', cast: 'raising the coral staff and singing', low: 'swooping forward low with the tail curled' },
      trMobeni: { h: 132, boss: true, hold: 'holding a huge rusty anchor', desc: 'Mobeni the Black Scale, captain of the Iron Scale Pirates and a menacing boss: a huge hulking crocodile man with thick black armored scales, a long snout full of jagged teeth, glowing yellow slit eyes and battle scars, a battered dark red pirate captain coat with gold trim and a tricorn hat with a skull emblem, a thick iron chain across the chest, clawed feet, holding a huge rusty anchor as a weapon. Fierce, brutal and snarling.',
        atk: 'the huge anchor swung down', cast: 'raising the anchor overhead and roaring', low: 'charging forward low with the anchor dragged behind' },
      trPodir: { h: 128, boss: true, hold: 'holding a massive tower shield and a lance', desc: 'Podir the Flame Shield, a Kartel commander and a menacing boss: a towering soldier in heavy dark iron plate armor with red trims and a Kartel eagle insignia, a horned full helmet with a narrow orange visor slit, a torn red cape, holding a massive riveted tower shield engraved with a flame emblem in the left hand and a heavy steel war lance with a fuel tank in the right hand. Imposing, fierce and threatening.',
        atk: 'the heavy lance thrust', cast: 'slamming the tower shield into the ground', low: 'charging forward low behind the tower shield' },
      trFladin: { h: 124, boss: true, hold: 'holding a sword cane', desc: 'Van Fladin, the Kartel commander of the misty city Heis and a menacing boss: a tall gaunt older officer with a sinister scowling face, narrowed cruel eyes, deep frown lines, slicked back grey hair and a thin mustache, a red mechanical monocle eye, a long black greatcoat with a high collar and gold Kartel epaulettes, a bulky mechanical right arm ending in a rotary gatling gun, holding a thin sword cane in the left hand. Cruel, sneering and intimidating, clearly a villain.',
        atk: 'the sword cane thrust', cast: 'raising the gatling arm and aiming', low: 'lunging forward low with the sword cane' },
      trAnzu: { h: 132, boss: true, holes: false, outline: '#3a2a1a', hold: 'holding a long rifle lance', desc: 'Anzu Saifer, the Eye of Dawn, the supreme commander of the Kartel army and a menacing raid boss: a battle-hardened broad-shouldered middle-aged commander (not young, not cute) with a grim fierce scowl, a heavy jaw with stubble, long silver hair tied back, a scar across the face, a golden mechanical sun-shaped eyepiece over the left eye, a white and gold military greatcoat with a dark fur collar and rows of medals, black armored gauntlets and boots, holding a long brass and steel rifle lance with a bayonet blade. Arrogant, fierce and threatening.',
        atk: 'the rifle lance bayonet thrust', cast: 'raising the rifle lance to the sky and shouting orders', low: 'lunging forward low with the rifle lance' },
    },
    gates: {
      sea_pirates: 'a sea train station platform gate with a torn pirate skull flag hung on it, anchors, ropes and barrels, a sea blue portal',
      west_line: 'a steel railway tunnel entrance with red signal lights and a Western Line sign, oil drums on both sides, an orange portal',
      heis: 'a foggy wrought-iron city gate of Heis with gas lamps and a clock on top, a pale grey portal',
      arden: 'a fortified highland camp gate of the Kartel army with cannons, war banners and barbed wire, a golden dawn portal',
    },
  },
});
