/* =====================================================================
   区域：时空之门（官方 80 版本 Lv70~77；满级 60 后放在 Lv55~59，希洛克 Lv60 的前一站）
   官方依据：三条龙被释放到阿拉德大陆，冒险家通过时空之门回到过去调查幕后黑手；前置任务在剑圣西岚那里。
     八张地下城：格兰之火（兽王乌塔拉，森林大火、“灭火”机制）、瘟疫之源（骷髅骑士，暗精灵村庄的瘟疫来自异次元裂缝、“治疗瘟疫”机制）、
     卡勒特之初（沙影贝利特，卡勒特成立之时的西部无法地带）、暗黑圣战（尼尔巴斯·格拉西亚，圣职者击退奥兹玛之后、小女孩寻找失踪的哥哥）、
     绝密区域（地狱三头犬，比尔马克帝国试验场最深处）、昔日悲鸣（凯恩，阿甘左的噩梦：当年在悲鸣洞穴和使徒希洛克的对决）、
     凛冬（年轻的斯卡萨，昔日的万年雪山）、谜之觉悟（攻坚，吟游诗人艾丽丝——所有线索指向的暗黑城使者）。
     时空之门深渊：打倒凯恩 / 年轻的斯卡萨 / 艾丽丝各一次后开启（这里写成资格任务的前置）。
   本作原创：入口放在鲁夫特港的灯塔（官方在素喃）、史诗「吟游诗人的竖琴」、深渊专属「时空旅者」。
     领主招式按官方招牌写；引擎没有的机制用最接近的原语，差距写在各领主注释里。
   入口：鲁夫特悬空海港（x 1900 往上，Lv.55）→ 时空之门（左：过去的回廊 · 前段；右：过去的回廊 · 后段 Lv.57；往上：魔界 Lv.60）
   ===================================================================== */
// 要被招式 / 进场重复引用的机制写成常量（定义时预编译，组队编号一致）
// 乌塔拉蓄力爆炸：没打断才放 onFail。官方写「打断也会炸」，引擎 stagger 打断成功不放 skill / onFail。
const TG_UTARA_BOOM = { use: 'stagger', windup: 3.2, need: 0.04, onBreak: 'groggy', clip: 'charge', col: '#ff6a2a',
  say: '兽王在蓄力——打断它！没打断就会爆炸，先跑远！',
  onFail: { use: 'aoe', shape: 'circle', at: 'self', r: 250, windup: 1.1, dmg: 1.7, down: true, col: '#ff6a2a', say: '爆炸了！' } };
// 年轻斯卡萨升空。官方空中龙息几乎全屏、只有龙身正下方是盲区；引擎没有这种吐息，飞着时用宽扇形 cone，生路是绕到侧面 / 身后。艺术沿用 snSkasa 换色。
const TG_SKASA_FLY = { use: 'form', name: '升空', art: ['snSkasa', { hue: 12, sat: 0.85, bright: 1.12 }], fly: 200, dur: 11, invulT: 1.2, col: '#bfe6ff',
  say: '年轻的斯卡萨飞起来了——空中龙息，绕到侧面！',
  skills: [{ use: 'cone', id: 'airBreath', clip: 'sigB', ang: 78, len: 480, windup: 1.1, dur: 1.5, tick: 0.2, dmg: 0.36, status: 'freeze', sdur: 0.8, col: '#9ad8ff', cd: [3.4, 4.6], say: '空中龙息——绕到侧面！' }],
  land: { use: 'aoe', shape: 'circle', at: 'self', r: 170, windup: 1.0, dmg: 1.3, jump: true, down: true, col: '#bfe6ff', say: '落地了——跳起来！' } };
// 艾丽丝木偶乐团。gauntlet 是一波接一波，不是同时在场的一整团；打完才解除无敌。window 内没清完的单只会复活，近似「木偶会复活」。结束不会额外大扣血。
const TG_IRIS_PUPPETS = { use: 'gauntlet', boss: 'watch', gap: 1.2, window: 14, reviveHp: 0.55, col: '#e0a0ff',
  say: '木偶乐团上场了——全灭之前，艾丽丝不会受伤！', done: '木偶倒了——现在打得到她了！',
  waves: [
    { kind: 'riftStalker', n: 2, name: '人偶潜行者', hp: 0.6, say: '人偶潜行者登场！' },
    { kind: 'riftCaster', n: 2, name: '人偶咏唱者', hp: 0.6, say: '人偶咏唱者登场！' }] };
// 尼尔巴斯领主房小护送。protect 刷的是打不动、也不会出手的物件，不是会打架的助战。官方是四名牧师护送到领主房后助战；这里只在领主房走一段，走到身边就破招。不改任务。
const TG_NILBAS_ESCORT = { use: 'protect', kind: 'graciaAcolyte', name: '格拉西亚的牧师', lives: 4, at: 'left', threat: 'chaosBeast',
  spawn: { kind: 'chaosBeast', n: 1, every: 11, first: 4 }, escort: { to: 'boss', speed: 34 }, onArrive: 'groggy', onTouch: 'heal', heal: 0.03, onLose: 'enrage',
  col: '#f0e6c8', say: '护送牧师到尼尔巴斯身边——别让混沌魔兽碰到他！' };
defineRegion({
  id: 'timegate', name: '时空之门', lvl: 55, lvlMax: 59, power: 1.3, bossPower: 1, atkPower: 1.12,
  entry: { scene: 'luft_port', side: 'up', x: 1900, to: 'time_gate', minLv: 55, label: '时空之门' },

  themes: {
    tgTown: { grade: { tint: 'rgba(70,60,130,0.10)', fog: 'rgba(190,180,255,0.08)' }, ambient: 'motes', rgb: '215,205,255', floorW: 1700,
      pal: { sky: ['#1a1838', '#40407a', '#8a86c0'], haze: '#c8c0ff' },
      bg: ['The Gate of Time and Space: an ancient stone plaza on a floating island at the edge of the sky, a giant ring-shaped portal gate of carved stone and brass clockwork gears with a swirling blue-violet void inside, floating clock faces and hourglasses, stone pillars with runes, a twilight sky with drifting stars.',
        'ancient stone floor tiles engraved with clock dial patterns and runes',
        'broken stone pillars, small brass gears and hourglass statues along a low stone wall'] },
    tgFire: { edgeHoles: true, grade: { tint: 'rgba(150,60,20,0.14)', fog: 'rgba(255,150,80,0.08)' }, ambient: 'wisps', rgb: '255,170,110', floorW: 1700,
      pal: { sky: ['#2a1008', '#6a2a10', '#c06030'], haze: '#ff9a5a' },
      bg: ['The Grand Flores forest of the past on fire: huge ancient trees burning, a red-orange sky with dark smoke clouds, fallen burning logs, a ruined elf shrine of white stone, the whole great forest turning to ash.',
        'scorched forest ground with grey ash, charred roots and fallen dry leaves',
        'burnt tree stumps, charred fallen logs and blackened bushes'] },
    tgPlague: { edgeHoles: true, grade: { tint: 'rgba(90,100,40,0.14)', fog: 'rgba(200,210,120,0.10)' }, ambient: 'wisps', rgb: '210,220,150', floorW: 1700,
      pal: { sky: ['#1a1a20', '#3a3a2a', '#6a6a40'], haze: '#c8d090' },
      bg: ['The dark elf village of the past struck by a plague: dark elf houses carved into a huge violet cavern, a sickly yellow miasma drifting between the houses, abandoned market stalls, cloth masks on the ground, a jagged glowing dimensional rift crack in the cave wall.',
        'cracked cave stone floor with scattered bones, spilled potion bottles and purple fungus',
        'broken crates, plague warning cloth signs and piles of bones along a low cave wall'] },
    tgDesert: { grade: { tint: 'rgba(160,120,60,0.10)', fog: 'rgba(255,220,150,0.10)' }, ambient: 'motes', rgb: '255,225,160', floorW: 1700,
      pal: { sky: ['#6a4a2a', '#c08a50', '#f0d098'], haze: '#ffe0a8' },
      bg: ['The western lawless desert in the days when the Kartel was founded: endless golden sand dunes, a small frontier outpost of wooden shacks and a water tower, a sandstorm on the horizon, a blazing sun, bleached animal skulls, a crude Kartel flag on a pole.',
        'hard packed desert sand with footprints, pebbles and dry grass tufts',
        'wooden fence posts, cactus, bleached cow skulls and sand-covered crates'] },
    tgHoly: { edgeHoles: true, grade: { tint: 'rgba(80,70,120,0.14)', fog: 'rgba(220,210,255,0.08)' }, ambient: 'motes', rgb: '230,220,255', floorW: 1700,
      pal: { sky: ['#14121e', '#34304a', '#8a84a8'], haze: '#d8d0ff' },
      bg: ['The battlefield of the Dark Holy War of the past: a ruined grand cathedral with broken stained glass windows and toppled statues of saints, a dark stormy sky split by a beam of pale light, scattered shields and banners of the holy army, a crater of dark chaos in the distance.',
        'cracked white marble cathedral floor with scattered broken shields and torn banners',
        'toppled saint statues, broken wooden pews and fallen marble pillars'] },
    tgRift: { edgeHoles: true, grade: { tint: 'rgba(90,40,130,0.16)', fog: 'rgba(200,160,255,0.08)' }, ambient: 'motes', rgb: '220,190,255', floorW: 1800,
      pal: { sky: ['#0e0818', '#2a1644', '#6a4a9a'], haze: '#c8a8ff' },
      bg: ['The Mysterious Realization, a dreamlike dimensional rift beyond time: fragments of past places floating in a dark violet void (a piece of burning forest, a desert dune, a snowy peak, a cave mouth), giant broken clock gears and hourglasses, an old moonlit theater stage with heavy curtains, eerie starlight.',
        'a floating stone stage floor engraved with clock patterns and scattered sheet music pages',
        'broken clock gears, cracked hourglasses and old theater footlights along the stage edge'] },
  },

  monsters: {
    // 格兰之火
    fireGoblin: { name: '燃烧的哥布林', tier: 'normal', arch: 'aggressive', size: [13, 11, 84], elem: 'fire', art: ['goblin', { hue: -85, sat: 1.1, bright: 0.8, only: [60, 170] }],
      skills: [{ use: 'swipe', n: 2, reach: 64, dmg: 1.0, cd: [1.4, 2.4], w: 2 }, { use: 'shot', clip: 'throw', mode: 'arc', r: 56, dmg: 0.9, status: 'burn', col: '#ff8a3a', cd: [3.5, 5] }] },
    fireTreant: { name: '燃烧的树精', tier: 'brute', arch: 'guard', size: [20, 14, 124], weight: 4, hardness: 30, elem: 'fire', art: ['treant', { hue: -80, sat: 1.2, bright: 0.7, only: [60, 170] }], traits: { sa: 'cast' },
      skills: [{ use: 'swipe', clip: 'slam', reach: 96, width: 30, windup: 0.7, dmg: 1.2, down: true, cd: [2.4, 3.4], w: 2 }, { use: 'aoe', shape: 'ring', at: 'self', r: 150, r0: 50, windup: 1.1, dmg: 0.9, status: 'root', sdur: 1.2, col: '#c08a4a', cd: [8, 10], say: '燃烧的树根' }] },
    fireSpirit: { name: '火焰精灵', tier: 'swarm', arch: 'guard', size: [12, 10, 70], speed: 120, elem: 'fire', art: ['ador', { hue: -10, sat: 1.1 }], traits: { onDeath: 'explode', explode: { r: 70, windup: 0.7, dmg: 0.8 } },
      skills: [{ use: 'shot', mode: 'homing', speed: 220, turn: 2.0, dmg: 0.75, status: 'burn', col: '#ffaa4a', cd: [3, 4.5] }] },
    fireSeed: { name: '燃烧的火种', tier: 'swarm', arch: 'guard', size: [14, 12, 80], weight: 99, speed: 1, elem: 'fire', art: ['ador', { hue: 15, sat: 1.3, bright: 1.1 }], traits: { immune: ['stun', 'freeze'] },
      skills: [{ use: 'shot', mode: 'homing', speed: 200, turn: 1.8, dmg: 0.7, status: 'burn', col: '#ffaa4a', cd: [4, 6] }] },
    lavaGolem: { name: '熔岩巨人', tier: 'brute', arch: 'aggressive', size: [20, 15, 128], scale: 1.1, weight: 5, elem: 'fire', art: ['flamehulk', { hue: -10, sat: 1.0, bright: 0.8 }], traits: { sa: 'cast' },
      skills: [{ use: 'swipe', clip: 'slam', n: 2, reach: 92, width: 30, dmg: 1.15, cd: [2, 3], w: 2 }, { use: 'rain', kind: 'hex', n: 3, r: 46, windup: 1.2, dmg: 1.0, col: '#ff6a2a', cd: [7, 9], say: '熔岩喷发' }] },
    fireChief: { name: '焚烬的哥布林酋长', tier: 'elite', arch: 'aggressive', size: [16, 13, 110], scale: 1.2, weight: 3, elem: 'fire', art: ['goblinChief', { hue: -85, sat: 1.1, bright: 0.8, only: [60, 170] }], traits: { sa: 'cast' },
      skills: [{ use: 'swipe', n: 3, reach: 90, dmg: 1.05, cd: [1.8, 2.6], w: 2 }, { use: 'dash', len: 340, speed: 720, windup: 0.6, dmg: 1.2, cd: [4.5, 6] }, { use: 'buff', kind: 'enrage', target: 'allies', r: 320, dur: 8, cd: [16, 20], say: '吼——！' }] },
    // 瘟疫之源
    plagueGhoul: { name: '染疫的食尸鬼', tier: 'normal', arch: 'aggressive', size: [14, 12, 100], elem: 'dark', art: ['deGhoul', { hue: 55, sat: 1.2, bright: 0.9 }],
      skills: [{ use: 'swipe', clip: 'scratch', n: 2, reach: 66, dmg: 1.0, status: 'poison', cd: [1.4, 2.4], w: 2 }, { use: 'dash', clip: 'pounce', len: 280, speed: 680, windup: 0.6, dmg: 1.05, cd: [4.5, 6] }] },
    plagueSkel: { name: '瘟疫骷髅兵', tier: 'normal', arch: 'aggressive', size: [13, 12, 104], elem: 'dark', art: ['deSkel', { hue: 60, sat: 1.1, bright: 0.85 }],
      skills: [{ use: 'swipe', n: 3, reach: 74, dmg: 0.9, cd: [1.6, 2.6], w: 2 }, { use: 'guard', dur: 1.8, reduce: 0.7, cd: [8, 10] }] },
    plagueGhost: { name: '瘟疫之灵', tier: 'flier', arch: 'flier', size: [14, 12, 80], elem: 'dark', art: ['deGhost', { hue: -150, sat: 1.2, bright: 0.95 }],
      skills: [{ use: 'shot', mode: 'homing', speed: 230, turn: 2.2, dmg: 0.85, status: 'poison', col: '#d8e070', cd: [3, 4.5], w: 2 }, { use: 'blink', to: 'behind', dist: 80, cd: [6, 8], w: 0.6 }] },
    plagueSpider: { name: '变异的洞穴蜘蛛', tier: 'swarm', arch: 'swarm', size: [16, 12, 56], speed: 150, elem: 'dark', art: ['deSpider', { hue: -40, sat: 0.7, bright: 0.85 }],
      skills: [{ use: 'swipe', clip: 'bite', reach: 56, dmg: 0.75, status: 'poison', cd: [1.2, 2.2] }] },
    plagueHeadless: { name: '染疫的无头骑士', tier: 'elite', arch: 'aggressive', size: [16, 13, 116], scale: 1.15, elem: 'dark', art: ['deHeadless', { hue: 140, sat: 1.0, bright: 0.85 }], traits: { sa: 'cast' },
      skills: [{ use: 'swipe', n: 3, reach: 92, dmg: 1.05, cd: [1.6, 2.4], w: 2 }, { use: 'dash', len: 360, speed: 760, windup: 0.6, dmg: 1.2, cd: [4.5, 6] }, { use: 'aoe', shape: 'circle', at: 'target', r: 80, n: 2, scatter: 120, windup: 1.1, dmg: 0.9, status: 'curse', sdur: 2, col: '#c8d070', cd: [8, 10], say: '瘟疫诅咒' }] },
    plagueHeart: { name: '瘟疫之源', tier: 'flier', arch: 'guard', size: [16, 13, 90], weight: 99, speed: 1, elem: 'dark', art: ['deGhost', { hue: -140, sat: 1.6, bright: 0.7 }], traits: { immune: ['stun', 'freeze'] },
      skills: [{ use: 'aoe', shape: 'circle', at: 'target', r: 70, windup: 1.2, dmg: 0.8, status: 'poison', col: '#d8e070', cd: [4, 6] }] },
    // 卡勒特之初
    desertBandit: { name: '沙漠盗贼', tier: 'normal', arch: 'aggressive', size: [13, 12, 100], art: ['nmBandit', { hue: 30, sat: 1.2, bright: 1.1 }],
      skills: [{ use: 'swipe', n: 2, reach: 70, dmg: 1.0, cd: [1.4, 2.4], w: 2 }, { use: 'dash', len: 300, speed: 700, windup: 0.7, dmg: 1.1, cd: [4.5, 6] }] },
    youngKartel: { name: '卡勒特的创始成员', tier: 'caster', arch: 'kiter', size: [13, 12, 104], art: ['gtSoldier', { hue: 25, sat: 2.3, bright: 1.1 }],
      skills: [{ use: 'shot', mode: 'straight', speed: 480, dmg: 0.85, cd: [1.6, 2.6], w: 2.5, col: '#ffd070' }, { use: 'shot', clip: 'throw', mode: 'arc', r: 56, dmg: 0.9, col: '#ffb050', cd: [4, 6] }] },
    sandSpider: { name: '沙漠毒蛛', tier: 'swarm', arch: 'swarm', size: [16, 12, 56], speed: 155, art: ['deSpider', { hue: 125, sat: 0.7, bright: 1.1 }],
      skills: [{ use: 'swipe', clip: 'bite', reach: 56, dmg: 0.75, status: 'poison', cd: [1.2, 2.2] }, { use: 'dash', clip: 'pounce', len: 220, speed: 620, windup: 0.5, dmg: 0.8, cd: [5, 7] }] },
    desertRider: { name: '沙漠骑手', tier: 'elite', arch: 'aggressive', size: [20, 14, 110], speed: 160, art: ['gtSuleide', { hue: 30, sat: 1.1, bright: 1.1 }], traits: { sa: 'cast' },
      skills: [{ use: 'dash', len: 480, speed: 860, windup: 0.6, dmg: 1.2, cd: [3, 4.5], w: 2, say: '驾！' }, { use: 'aoe', shape: 'circle', at: 'self', r: 120, windup: 0.6, dmg: 1.0, status: 'blind', sdur: 1.5, col: '#e8c890', cd: [6, 8], say: '扬沙！' }] },
    // 暗黑圣战
    ozmaCultist: { name: '奥兹玛的信徒', tier: 'caster', arch: 'kiter', size: [13, 12, 100], elem: 'dark', art: ['gbl', { hue: 160, sat: 1.3, bright: 0.65 }],
      skills: [{ use: 'shot', clip: 'cast', mode: 'homing', speed: 240, turn: 2.2, dmg: 0.85, col: '#b070ff', cd: [3, 4.5], w: 2 }, { use: 'buff', clip: 'cast', kind: 'heal', target: 'allies', r: 280, amt: 0.1, cd: [7, 9], say: '混沌的祝福' }] },
    fallenPaladin: { name: '堕落的圣骑士', tier: 'brute', arch: 'guard', size: [17, 13, 118], scale: 1.1, weight: 3, hardness: 40, elem: 'dark', art: ['gatekeeper', { hue: 200, sat: 0.7, bright: 0.6 }], traits: { sa: 'cast' },
      skills: [{ use: 'guard', dur: 2.4, reduce: 0.85, cd: [6, 8], w: 1.5, counter: { use: 'aoe', shape: 'cross', at: 'self', len: 180, hw: 26, windup: 0.4, dmg: 1.1, col: '#b070ff' } }, { use: 'swipe', clip: 'slam', reach: 90, dmg: 1.15, down: true, cd: [2.4, 3.4], w: 2 }] },
    chaosBeast: { name: '混沌魔兽', tier: 'normal', arch: 'aggressive', size: [16, 12, 90], speed: 135, elem: 'dark', art: ['stalker', { hue: -80, sat: 0.9, bright: 0.85 }],
      skills: [{ use: 'swipe', clip: 'scratch', n: 2, reach: 66, dmg: 1.0, cd: [1.4, 2.2], w: 2 }, { use: 'dash', clip: 'pounce', len: 320, speed: 740, windup: 0.6, dmg: 1.1, cd: [4, 6] }] },
    chaosEye: { name: '混沌之眼', tier: 'flier', arch: 'flier', size: [14, 12, 70], elem: 'dark', art: ['gazer', { hue: 90, sat: 1.0, bright: 0.8 }],
      skills: [{ use: 'laser', windup: 1.2, dur: 0.9, sweep: 40, dmg: 0.45, col: '#c890ff', cd: [6, 8], w: 1.4 }, { use: 'shot', mode: 'spread', n: 3, spread: 40, speed: 300, dmg: 0.7, col: '#b070ff', cd: [3.5, 5] }] },
    chaosPriest: { name: '混沌祭司', tier: 'elite', arch: 'kiter', size: [15, 12, 116], scale: 1.1, elem: 'dark', art: ['archbishop', { hue: 170, sat: 1.3, bright: 0.55 }],
      skills: [{ use: 'rain', kind: 'hex', n: 4, r: 48, windup: 1.2, dmg: 1.0, col: '#b070ff', cd: [7, 9], w: 1.5, say: '混沌降临' }, { use: 'summon', kind: 'chaosBeast', n: 2, max: 3, cd: [14, 18] }, { use: 'shot', mode: 'homing', n: 2, spread: 40, speed: 240, dmg: 0.8, col: '#b070ff', cd: [3.5, 5] }] },
    // 绝密区域
    labRobot: { name: '试验型战斗机器人', tier: 'normal', arch: 'aggressive', size: [14, 12, 92], art: ['bmRobot', { hue: -40, sat: 1.2, bright: 0.9 }],
      skills: [{ use: 'swipe', n: 2, reach: 64, dmg: 1.0, cd: [1.4, 2.4], w: 2 }, { use: 'laser', windup: 1.0, dur: 0.5, hw: 12, dmg: 0.9, col: '#ff6a6a', cd: [5, 7] }] },
    labIvan: { name: '失控的伊凡', tier: 'swarm', arch: 'swarm', size: [12, 10, 80], speed: 145, art: ['bmIvan', { hue: 180, sat: 0.8 }], traits: { onDeath: 'explode', explode: { r: 80, windup: 0.8, dmg: 1.0 } },
      skills: [{ use: 'swipe', reach: 54, dmg: 0.75, cd: [1.2, 2.2] }] },
    labMechTau: { name: '机械牛头试验体', tier: 'brute', arch: 'aggressive', size: [18, 14, 120], scale: 1.05, weight: 4, art: ['bmMechTau', { hue: 180, sat: 0.9, bright: 0.85 }], traits: { sa: 'cast' },
      skills: [{ use: 'swipe', clip: 'axe', reach: 92, width: 30, dmg: 1.15, down: true, cd: [2, 3], w: 2 }, { use: 'dash', clip: 'charge', len: 360, speed: 760, windup: 0.7, dmg: 1.2, cd: [4.5, 6] }] },
    labHound: { name: '试验体猎犬', tier: 'normal', arch: 'aggressive', size: [16, 12, 72], speed: 140, elem: 'fire', art: ['hound', { hue: -150, sat: 1.3, bright: 0.75 }],
      skills: [{ use: 'swipe', clip: 'bite', reach: 62, dmg: 0.95, cd: [1.4, 2.4], w: 2 }, { use: 'dash', clip: 'chargeW', len: 340, speed: 720, windup: 0.7, dmg: 1.1, cd: [4, 6] }] },
    labWalker: { name: '试验型战斗兵器', tier: 'elite', arch: 'guard', size: [22, 16, 120], scale: 0.95, weight: 6, speed: 70, hardness: 50, art: ['gtMech', { hue: 120, sat: 0.7, bright: 0.85 }], traits: { sa: 'always', immune: ['stun', 'freeze'] },
      skills: [{ use: 'swipe', clip: 'slam', reach: 110, width: 34, windup: 0.7, dmg: 1.2, down: true, cd: [2.4, 3.4], w: 2 }, { use: 'rain', kind: 'hex', n: 4, r: 50, windup: 1.2, dmg: 1.0, col: '#ffb050', cd: [7, 9], say: '导弹发射' },
        { use: 'laser', windup: 1.2, dur: 1.0, sweep: 40, dmg: 0.5, col: '#ff6a6a', cd: [8, 10] }] },
    // 昔日悲鸣
    pastLarva: { name: '悲鸣洞穴的幼虫', tier: 'swarm', arch: 'swarm', size: [18, 12, 50], speed: 120, elem: 'dark', art: ['wcLarva', { hue: 40, sat: 1.0, bright: 0.85 }],
      skills: [{ use: 'swipe', clip: 'bite', reach: 56, dmg: 0.75, status: 'poison', cd: [1.2, 2.2] }, { use: 'shot', mode: 'arc', r: 48, dmg: 0.7, status: 'poison', col: '#c0d070', cd: [4, 6] }] },
    caveSpider: { name: '悲鸣洞穴的蜘蛛', tier: 'normal', arch: 'aggressive', size: [16, 12, 60], speed: 140, elem: 'dark', art: ['deSpider', { hue: -40, sat: 1.1, bright: 0.8 }],
      skills: [{ use: 'swipe', clip: 'bite', n: 2, reach: 62, dmg: 0.95, cd: [1.4, 2.4], w: 2 }, { use: 'shot', mode: 'straight', speed: 380, dmg: 0.75, status: 'slow', col: '#e0e0e8', cd: [4, 6], say: '' }] },
    siroShade: { name: '希洛克的残影', tier: 'flier', arch: 'flier', size: [14, 12, 100], elem: 'dark', art: ['siPhantom', { hue: -30, sat: 0.9, bright: 0.85 }],
      skills: [{ use: 'seq', cd: [5, 7], w: 1.5, steps: [{ use: 'blink', to: 'behind', dist: 70 }, { use: 'swipe', n: 2, reach: 70, dmg: 0.9 }] }, { use: 'shot', mode: 'homing', speed: 240, turn: 2.2, dmg: 0.8, col: '#b890ff', cd: [3.5, 5] }] },
    nightmareBlade: { name: '噩梦中的剑士', tier: 'elite', arch: 'aggressive', size: [15, 12, 116], scale: 1.1, elem: 'dark', art: ['sandor', { hue: -30, sat: 1.2, bright: 0.8 }], traits: { sa: 'cast' },
      skills: [{ use: 'swipe', n: 3, reach: 92, dmg: 1.05, cd: [1.6, 2.4], w: 2 }, { use: 'aoe', shape: 'line', at: 'front', len: 300, hw: 30, windup: 0.8, dmg: 1.15, col: '#c890ff', cd: [5, 7], say: '剑气！' }, { use: 'blink', to: 'behind', dist: 80, cd: [7, 9], w: 0.6 }] },
    // 凛冬
    pastYeti: { name: '昔日的雪人', tier: 'brute', arch: 'aggressive', size: [18, 14, 110], weight: 3, elem: 'ice', art: ['snYeti', { hue: 20, sat: 0.9, bright: 0.95 }], traits: { sa: 'cast' },
      skills: [{ use: 'swipe', clip: 'slam', n: 2, reach: 86, dmg: 1.1, cd: [2, 3], w: 2 }, { use: 'shot', clip: 'throw', mode: 'arc', r: 60, dmg: 1.0, status: 'freeze', sdur: 1.2, col: '#bfe6ff', cd: [5, 7], say: '雪球！' }] },
    pastTiger: { name: '昔日的冰虎', tier: 'normal', arch: 'aggressive', size: [18, 12, 72], speed: 145, elem: 'ice', art: ['snTiger', { hue: 15, sat: 1.0, bright: 0.95 }],
      skills: [{ use: 'swipe', clip: 'scratch', n: 2, reach: 64, dmg: 1.0, cd: [1.4, 2.2], w: 2 }, { use: 'dash', clip: 'pounce', len: 320, speed: 740, windup: 0.6, dmg: 1.1, cd: [4, 6] }] },
    pastBantu: { name: '昔日的班图战士', tier: 'caster', arch: 'kiter', size: [13, 12, 104], elem: 'ice', art: ['snBantu', { hue: 25, sat: 1.1 }],
      skills: [{ use: 'shot', clip: 'throw', mode: 'straight', speed: 500, dmg: 0.85, col: '#e0f0ff', cd: [2, 3], w: 2 }, { use: 'aoe', shape: 'circle', at: 'target', r: 70, n: 2, scatter: 110, windup: 1.1, dmg: 0.9, status: 'slow', col: '#9ad8ff', cd: [6, 8] }] },
    iceWyvern: { name: '冰霜飞龙', tier: 'flier', arch: 'flier', size: [16, 12, 90], elem: 'ice', art: ['wyvern', { hue: 60, sat: 0.8, bright: 1.15 }],
      skills: [{ use: 'aoe', shape: 'line', at: 'front', len: 240, hw: 28, windup: 0.9, dmg: 0.95, status: 'freeze', sdur: 1, col: '#9ad8ff', cd: [5, 7], w: 1.5, say: '冰之吐息' }, { use: 'swipe', clip: 'bite', reach: 64, dmg: 0.9, cd: [2, 3] }] },
    frostApe: { name: '冰原巨猿', tier: 'elite', arch: 'aggressive', size: [20, 15, 124], scale: 1.25, weight: 5, elem: 'ice', art: ['snYeti', { hue: -20, sat: 0.8, bright: 0.8 }], traits: { sa: 'cast' },
      skills: [{ use: 'swipe', clip: 'slam', n: 3, reach: 96, dmg: 1.1, cd: [1.8, 2.6], w: 2 }, { use: 'grab', reach: 66, hold: 0.8, throwDmg: 1.4, cd: [7, 9] }, { use: 'aoe', shape: 'ring', at: 'self', r: 170, r0: 50, windup: 1.1, dmg: 1.0, jump: true, col: '#9ad8ff', cd: [8, 10], say: '震地——跳起来！' }] },
    // 谜之觉悟
    riftGazer: { name: '时空的凝视者', tier: 'flier', arch: 'flier', size: [14, 12, 70], elem: 'dark', art: ['gazer', { hue: -60, sat: 1.1, bright: 0.95 }],
      skills: [{ use: 'laser', windup: 1.2, dur: 0.9, sweep: 40, dmg: 0.45, col: '#c890ff', cd: [6, 8], w: 1.4 }, { use: 'shot', mode: 'homing', speed: 230, turn: 2.2, dmg: 0.8, col: '#c890ff', cd: [3.5, 5] }] },
    riftStalker: { name: '时空潜行者', tier: 'normal', arch: 'aggressive', size: [16, 12, 90], speed: 140, elem: 'dark', art: ['stalker', { hue: -50, sat: 1.0, bright: 0.85 }],
      skills: [{ use: 'seq', cd: [5, 7], w: 1.5, steps: [{ use: 'blink', to: 'behind', dist: 70 }, { use: 'swipe', clip: 'scratch', n: 2, reach: 66, dmg: 0.9 }] }, { use: 'swipe', clip: 'bite', reach: 62, dmg: 0.95, cd: [1.6, 2.6], w: 2 }] },
    riftCaster: { name: '时空咏唱者', tier: 'caster', arch: 'kiter', size: [13, 12, 100], elem: 'dark', art: ['voidcaster', { hue: -40, sat: 1.1 }],
      skills: [{ use: 'rain', kind: 'bolt', n: 3, r: 44, windup: 1.1, dmg: 0.95, col: '#c8a0ff', cd: [6, 8], w: 1.5 }, { use: 'shot', mode: 'spread', n: 3, spread: 40, speed: 300, dmg: 0.75, col: '#c8a0ff', cd: [3, 4.5], w: 2 }] },
    riftEcho: { name: '过去的回响', tier: 'elite', arch: 'aggressive', size: [15, 12, 116], scale: 1.15, elem: 'dark', art: ['merkle', { hue: -50, sat: 1.0, bright: 0.85 }], traits: { sa: 'cast' },
      skills: [{ use: 'swipe', n: 3, reach: 90, dmg: 1.05, cd: [1.6, 2.4], w: 2 }, { use: 'mech', mech: { use: 'shield', hp: 0.12, dur: 8, punish: 'heal', col: '#c8a0ff' }, cd: [16, 20], say: '时间停滞' }, { use: 'blink', to: 'behind', dist: 80, cd: [7, 9], w: 0.6 }] },
    riftKeeper: { name: '时空守门人', tier: 'elite', arch: 'guard', size: [17, 13, 120], scale: 1.15, weight: 4, hardness: 40, art: ['gatekeeper', { hue: 170, sat: 0.9, bright: 0.8 }], traits: { sa: 'cast' },
      skills: [{ use: 'guard', dur: 2.4, reduce: 0.85, cd: [6, 8], w: 1.5, counter: { use: 'aoe', shape: 'ring', at: 'self', r: 150, r0: 40, windup: 0.4, dmg: 1.1, col: '#c8a0ff' } }, { use: 'swipe', clip: 'slam', reach: 96, dmg: 1.15, down: true, cd: [2.2, 3.2], w: 2 }] },
    // 领主物件（程序画，不进地下城 mobs）。没有火堆 / 笼子外形：火堆用图腾，试验笼用桶。
    tgBonfire: { name: '火堆', tier: 'swarm', size: [16, 12, 78], obj: { shape: 'totem', col: '#ff6a2a', h: 78, botSkip: true } },
    belitRock: { name: '岩石', tier: 'swarm', size: [22, 14, 72], obj: { shape: 'block', col: '#c8a060', h: 72 } },
    cerbCage: { name: '试验笼', tier: 'swarm', size: [20, 14, 76], obj: { shape: 'barrel', col: '#8a9098', h: 76 } },
    youngIce: { name: '冰晶', tier: 'swarm', size: [16, 12, 68], obj: { shape: 'crystal', col: '#cfeeff', h: 68 } },
    graciaAcolyte: { name: '格拉西亚的牧师', tier: 'swarm', size: [14, 12, 96], obj: { shape: 'dummy', col: '#f4ecd4', h: 96, botSkip: true } },
  },

  bosses: {
    // 招牌：咆哮推向火堆（sigA）、三连地锤（sigB）。蓄力爆炸见 TG_UTARA_BOOM。火种无敌保留。
    // 火堆是 plant 的图腾物件：站上去不会持续烧，引信到点才炸。官方火堆是持续伤害区。圈外是生路。
    utara: { name: '兽王乌塔拉', lvl: 56, size: [22, 16, 136], weight: 6, speed: 110, elem: 'fire', art: 'tgUtara', scale: 1.25, pref: 110, traits: { sa: 'cast' },
      mechs: [{ use: 'groggy', max: 100, dur: 6 }],
      phases: [
        { at: 1, skills: [{ use: 'swipe', clip: 'slam', n: 2, reach: 112, width: 34, dmg: 1.15, down: true, cd: [1.8, 2.6], w: 2 },
          { use: 'seq', id: 'roar', cd: [14, 18], w: 1.4, say: '咆哮——被吹向火堆！跑出圈！', steps: [
            { use: 'plant', kind: 'tgBonfire', n: 2, at: 'spots', fuse: 7, hp: 0.02, onFuse: 'explode', r: 100, dmg: 1.1, label: '火堆', col: '#ff6a2a' },
            { use: 'pull', clip: 'sigA', mode: 'toward:tgBonfire', r: 420, force: 250, windup: 1.2, dur: 1.4, dmg: 0.35, col: '#ff8a3a' }] },
          { use: 'leap', id: 'hammers', clip: 'sigB', n: 3, jump: true, crouch: 0.3, up: 0.4, track: 1.0, fall: 0.7, r: 120, dmg: 1.35, col: '#ff8a3a', cd: [11, 14], w: 1.5, say: '三连地锤——锁定后跑出圈，或者跳起来！' },
          { use: 'mech', id: 'boom', mech: TG_UTARA_BOOM, cd: [24, 30], gap: 14, w: 0.9 }] },
        { at: 0.6, enter: { say: '大火烧到了兽王身上——扑灭火种！火种不灭，它不会受伤！', col: '#ff8a3a', mechs: [{ use: 'invuln', until: 'crystals', kind: 'fireSeed', name: '燃烧的火种', n: 4, hpFrac: 0.02, col: '#ff8a3a' }, { use: 'hazard', kind: 'fire', every: 3.5, n: 2, col: '#ff6a2a' }] } },
      ] },
    // 招牌：旋转枪矛（sigA）、地面残骸（sigB）。BOSS_SPEC 没有 debuff / 捡针管。
    // 瘟疫倒计时用 safezone 的读条 + 毒池：站进圈算这一轮净化，毒池是拖久了还在地上的瘟疫。不是 2 分 30 秒捡针管。
    skelKnight: { name: '骷髅骑士', lvl: 56, size: [18, 14, 134], weight: 5, speed: 95, elem: 'dark', art: 'tgSkelKnight', scale: 1.2, pref: 110, traits: { sa: 'cast' },
      mechs: [{ use: 'groggy', max: 100, dur: 6 }],
      phases: [
        { at: 1, skills: [{ use: 'swipe', clip: 'axe', n: 2, reach: 116, width: 34, dmg: 1.15, cd: [1.8, 2.6], w: 2 },
          { use: 'dash', id: 'spin', clip: 'sigA', spin: true, len: 500, speed: 760, windup: 1.0, hw: 26, dmg: 1.15, cd: [8, 11], w: 1.6, say: '旋转枪矛——红线上别站！',
            then: { use: 'summon', kind: 'plagueSkel', n: 1, max: 3 } },
          { use: 'pool', id: 'debris', clip: 'sigB', zone: 'slow', at: 'target', n: 3, r: 72, windup: 1.0, linger: 7, dmg: 0.55, scatter: 160, col: '#6a8ab0', cd: [10, 13], w: 1.3, say: '地面残骸——别踩上去！' },
          { use: 'pool', id: 'miasma', zone: 'poison', at: 'target', n: 2, r: 78, windup: 1.0, linger: 8, dmg: 0.35, col: '#d8e070', cd: [12, 15], w: 1.1, say: '瘟疫雾——别站在雾里！' },
          { use: 'mech', id: 'plague', mech: { use: 'safezone', mode: 'zone', n: 2, r: 74, windup: 3.2, frac: 0.28, say: '瘟疫倒计时——站进净化圈！', col: '#d8e070', safeCol: '#e8f4c0' }, cd: [20, 26], gap: 8, w: 1.2 }] },
      ] },
    // 招牌：追踪旋风（sigA）、爆头标记（sigB）。低血沙暴隐身是 stance.invis，不是分身。
    // 引擎 plant 被打掉只取消引信，不会结束 stance / hazard。官方是两块岩石都毁掉沙暴才停。
    // 这里没打掉则 onFuse 给贝利特狂暴；沙暴隐身按血量切，不由岩石解除。
    belit: { name: '沙影贝利特', lvl: 57, size: [15, 12, 122], speed: 140, art: 'tgBelit', scale: 1.2, pref: 120, traits: { sa: 'cast' },
      mechs: [{ use: 'groggy', max: 100, dur: 6 },
        { use: 'stance', at: [0.4], modes: [
          { id: 'open', name: '沙影', col: '#e8c890', skills: ['whirl', 'headshot'] },
          { id: 'storm', name: '沙暴', col: '#c8a060', invis: 0.88, dmgTaken: 0.45, skills: ['whirl'], say: '沙暴——贝利特隐进沙子里了！打掉岩石，不然他会狂暴！' }] }],
      phases: [
        { at: 1, skills: [{ use: 'swipe', n: 2, reach: 78, dmg: 1.0, cd: [1.6, 2.4], w: 2 },
          { use: 'shot', id: 'whirl', clip: 'sigA', mode: 'homing', n: 2, speed: 260, turn: 1.5, life: 2.6, dmg: 0.8, col: '#e8c890', cd: [5, 7], w: 1.5, say: '追踪旋风——拐弯躲开！' },
          { use: 'mark', id: 'headshot', clip: 'sigB', mode: 'burst', delay: 1.6, r: 110, dmg: 1.7, jump: true, col: '#ffd070', cd: [12, 16], w: 1.3, say: '爆头标记——跳起来，别和队友挤在一起！' },
          { use: 'plant', id: 'rocks', kind: 'belitRock', n: 2, at: 'spots', fuse: 16, hits: 5, onFuse: 'buff', max: 2, label: '岩石', col: '#c8a878', cd: [18, 24], w: 1.1, say: '两块岩石在卷沙——打掉它们！' }] },
      ] },
    // 招牌：地雷阵（sigA，lanes 整条纵深落雷，不是踩上去才炸的地雷）、处刑（sigB）。
    // 官方处刑是发光时玩家放觉醒会吃伤害。没有检测玩家放技能的原语，用 stance 切到发光 + safezone（站进圈才安全）。
    nilbas: { name: '尼尔巴斯·格拉西亚', lvl: 57, size: [16, 13, 130], speed: 110, elem: 'dark', art: 'tgNilbas', scale: 1.2, pref: 120, traits: { sa: 'cast' },
      mechs: [{ use: 'groggy', max: 100, dur: 6 }, TG_NILBAS_ESCORT,
        { use: 'stance', every: [14, 18], modes: [
          { id: 'war', name: '圣战', col: '#b070ff', skills: ['mines'] },
          { id: 'execute', name: '处刑', col: '#ffe070', skills: ['execute'], say: '他在发光——站进光圈！先别莽。' }] }],
      phases: [
        { at: 1, skills: [{ use: 'swipe', n: 3, reach: 112, width: 34, dmg: 1.1, cd: [1.8, 2.6], w: 2 },
          { use: 'lanes', id: 'mines', clip: 'sigA', kind: 'bolt', lanes: 6, hit: 5, windup: 1.1, dmg: 1.15, launch: 260, col: '#b070ff', cd: [10, 13], w: 1.5, say: '地雷阵——找没亮的那一排！' },
          { use: 'mech', id: 'execute', clip: 'sigB', mech: { use: 'safezone', mode: 'zone', n: 2, r: 78, windup: 2.6, frac: 0.3, say: '处刑之光——站进光圈！', col: '#ffe070', safeCol: '#fff0c0' }, cd: [8, 11], gap: 6, w: 1.4 }] },
      ] },
    // 招牌：注视者之眼（sigA，站着掉血）、三连扑（sigB）。笼子到点 release 已有的试验体猎犬；没有笼子外形，物件是桶。
    cerberus: { name: '地狱三头犬', lvl: 58, size: [28, 17, 120], weight: 7, speed: 130, elem: 'fire', art: 'tgCerberus', scale: 1.35, pref: 120, traits: { sa: 'cast', immune: ['stun'] },
      mechs: [{ use: 'groggy', max: 110, dur: 6 }],
      phases: [
        { at: 1, skills: [{ use: 'swipe', clip: 'bite', n: 3, reach: 104, width: 36, gap: 0.24, dmg: 0.95, cd: [1.8, 2.6], w: 2 },
          { use: 'mark', id: 'eye', clip: 'sigA', mode: 'move', delay: 1.2, dur: 4, tick: 0.5, frac: 0.03, still: 18, col: '#ff5a3a', cd: [16, 20], w: 1.3, say: '注视者之眼——别停下！' },
          { use: 'seq', id: 'pounce3', cd: [11, 14], w: 1.6, say: '三连扑——看红线躲开！', steps: [
            { use: 'dash', clip: 'sigB', len: 440, speed: 860, windup: 1.0, hw: 30, dmg: 1.05 },
            { use: 'dash', clip: 'sigB', len: 420, speed: 880, windup: 0.9, hw: 30, dmg: 1.05 },
            { use: 'dash', clip: 'sigB', len: 420, speed: 900, windup: 0.9, hw: 30, dmg: 1.15 }] },
          { use: 'plant', id: 'cage', kind: 'cerbCage', n: 1, at: 'spots', fuse: 14, hits: 8, onFuse: 'release:labHoundx4', max: 1, label: '笼子', col: '#ffb070', cd: [20, 26], w: 1.1, say: '试验笼在倒计时——打掉它，不然猎犬要放出来！' }] },
      ] },
    // 招牌：幻影直线冲击（sigA）、欲望沼泽（sigB）。异界之风是 arena wind。换色 wcKain 不动。
    // runner 借本文件已有精灵的 siroShade，是一道冲锋，不是能打掉的分身。
    kainPast: { name: '凯恩', lvl: 58, size: [18, 14, 130], weight: 5, speed: 115, elem: 'dark', art: ['wcKain', { hue: -15, sat: 1.25, bright: 0.85 }], scale: 1.55, pref: 110, traits: { sa: 'cast' },
      mechs: [{ use: 'groggy', max: 100, dur: 6 }, { use: 'arena', kind: 'wind', vx: -80, say: '异界之风——会被吹向左侧！', col: '#c8d0ff' }],
      phases: [
        { at: 1, skills: [{ use: 'swipe', clip: 'axe', n: 2, reach: 124, width: 36, dmg: 1.2, down: true, cd: [2, 2.8], w: 2 },
          { use: 'lanes', id: 'phantoms', clip: 'sigA', kind: 'runner', runner: 'siroShade', lanes: 4, hit: 2, speed: 700, windup: 1.1, dmg: 1.3, col: '#c05aff', cd: [12, 16], w: 1.5, say: '幻影冲击——站进没亮的那一排！' },
          { use: 'pool', id: 'swamp', clip: 'sigB', zone: 'slow', at: 'target', n: 3, r: 80, windup: 1.0, linger: 8, dmg: 0.5, scatter: 150, col: '#6a4a8a', cd: [10, 13], w: 1.3, say: '欲望的沼泽——别踩进去！' }] },
        { at: 0.35, enter: { say: '凯恩的必杀连斩！', col: '#c05aff' },
          skills: [{ use: 'seq', id: 'finisher', cd: [11, 14], w: 1.4, say: '必杀连斩——看红线！', steps: [
            { use: 'dash', len: 460, speed: 900, windup: 1.0, hw: 24, dmg: 1.1 },
            { use: 'dash', len: 420, speed: 920, windup: 0.9, hw: 24, dmg: 1.1 },
            { use: 'aoe', shape: 'circle', at: 'self', r: 150, windup: 0.95, dmg: 1.25, col: '#c05aff' }] }] },
      ] },
    // 招牌：三连锤（sigA）、地面龙息（sigB，lanes wave + plant 冰晶）。空中龙息是 TG_SKASA_FLY。换色 snSkasa 不动。免疫眩晕、冰冻。
    // 冰晶刷在全场均匀点，不是严格沿被扫的那一排。官方冰晶阵跟在龙息扫过的那条上。
    youngSkasa: { name: '年轻的斯卡萨', lvl: 59, size: [26, 16, 120], weight: 7, speed: 90, elem: 'ice', art: ['snSkasa', { hue: 12, sat: 0.85, bright: 1.12 }], scale: 1.1, pref: 140, traits: { sa: 'cast', immune: ['stun', 'freeze'] },
      mechs: [{ use: 'groggy', max: 110, dur: 6 }],
      phases: [
        { at: 1, skills: [{ use: 'swipe', clip: 'bite', n: 2, reach: 110, width: 36, dmg: 1.1, cd: [2, 2.8], w: 2 },
          { use: 'seq', id: 'slams', clip: 'sigA', cd: [12, 16], w: 1.5, say: '三连锤——跳起来！', steps: [
            { use: 'aoe', clip: 'sigA', shape: 'circle', at: 'self', r: 150, windup: 1.0, dmg: 1.05, jump: true, col: '#bfe6ff' },
            { use: 'aoe', clip: 'sigA', shape: 'circle', at: 'self', r: 210, windup: 0.95, dmg: 1.15, jump: true, col: '#bfe6ff' },
            { use: 'aoe', clip: 'sigA', shape: 'circle', at: 'self', r: 270, windup: 0.95, dmg: 1.3, jump: true, col: '#bfe6ff' }] },
          { use: 'lanes', id: 'groundBreath', clip: 'sigB', kind: 'wave', lanes: 5, hit: 4, from: 'boss', windup: 1.15, speed: 640, dmg: 1.2, status: 'freeze', sdur: 0.8, col: '#9ad8ff', cd: [11, 14], w: 1.4, say: '地面龙息——站进没亮的那一排！',
            then: { use: 'plant', kind: 'youngIce', n: 3, at: 'spots', fuse: 9, hits: 4, onFuse: 'explode', r: 90, dmg: 1.05, label: '冰晶', col: '#bfe6ff', say: '冰晶留下了——打碎它们！' } },
          { use: 'mech', id: 'fly', mech: TG_SKASA_FLY, cd: [24, 30], gap: 10, w: 1.0 }] },
      ] },
    // 招牌：水龙之歌（sigA）、雷鸣之歌（sigB）。火怪之歌换的是招和颜色，没有第三套招牌帧。木偶见 TG_IRIS_PUPPETS，不是分身加光圈。
    irisBard: { name: '吟游诗人艾丽丝', tier: 'raid', lvl: 59, power: 0.75, size: [15, 12, 128], weight: 5, speed: 105, elem: 'dark', art: 'tgIris', scale: 1.3, pref: 200, traits: { sa: 'cast', immune: ['stun', 'freeze'] },
      mechs: [{ use: 'groggy', max: 130, dur: 6, mul: 1.6 }, { use: 'enrage', t: 300 }, TG_IRIS_PUPPETS,
        { use: 'stance', every: [13, 17], modes: [
          { id: 'water', name: '水龙之歌', col: '#6ad0ff', skills: ['songWater'], say: '水龙之歌。' },
          { id: 'fire', name: '火怪之歌', col: '#ff7a3a', skills: ['songFire'], say: '火怪之歌。' },
          { id: 'thunder', name: '雷鸣之歌', col: '#ffe070', skills: ['songThunder'], say: '雷鸣之歌。' }] }],
      phases: [
        { at: 1, skills: [{ use: 'swipe', n: 2, reach: 84, dmg: 0.95, cd: [1.8, 2.6], w: 1.4 },
          { use: 'cone', id: 'songWater', clip: 'sigA', ang: 64, len: 360, windup: 1.0, dur: 1.2, tick: 0.25, dmg: 0.32, status: 'slow', elem: 'ice', col: '#6ad0ff', cd: [8, 11], w: 1.5, say: '水龙之歌——绕到侧面！' },
          { use: 'pool', id: 'songFire', clip: 'cast', zone: 'fire', at: 'target', n: 3, r: 68, windup: 1.0, linger: 5, dmg: 0.6, frac: 0.015, scatter: 140, col: '#ff7a3a', cd: [9, 12], w: 1.4, say: '火怪之歌——别踩进火里！' },
          { use: 'lanes', id: 'songThunder', clip: 'sigB', kind: 'bolt', lanes: 5, hit: 4, windup: 1.1, dmg: 1.1, col: '#ffe070', cd: [10, 13], w: 1.5, say: '雷鸣之歌——找没亮的那一排！' }] },
      ] },
  },

  items: {
    epics: [
      { key: 'ep_tg_harp', slot: 'support', lvl: 59, name: '吟游诗人的竖琴', fx: { dmgUp: 0.1, dark: 18, cdr: 0.04 }, desc: '暗黑城的使者艾丽丝弹过的竖琴。弹响它的时候，好像能听见过去的声音。',
        look: 'an ornate small golden lyre harp with dark violet strings, a crescent moon and clock gear motif on the frame, a tiny violet ribbon' },
    ],
    sets: [
      // 深渊专属（时空之门深渊）：本作原创，手镯 + 魔法石两件套
      { id: 'set_timeslip', name: '时空旅者', lvl: 58, abyss: true, desc: '穿过时空之门的旅人留下的东西。它们记得每一个过去。',
        bonus: { 2: { st: { dmgUp: 0.12, cspd: 0.06, aspd: 0.06 }, desc: '【时空】伤害增加 12%，攻击 / 施放速度 +6%；攻击时 6% 几率撕开一道时空裂隙（周围 170% 暗属性伤害）',
          proc: { chance: 0.06, cd: 1.5, act: 'strike', mul: 1.7, aoe: 120, elem: 'dark', vis: 'nova', name: '时空裂隙' } } },
        pieces: [
          { key: 'ep_tg_hourglass', slot: 'bracelet', name: '逆流的沙漏手镯', look: 'a bronze bangle with a tiny hourglass charm whose violet sand flows upward, engraved clock numerals' },
          { key: 'ep_tg_shard', slot: 'stone', name: '过去的碎片', look: 'a jagged violet crystal shard reflecting a tiny burning forest and a snowy peak inside, set in a bronze gear frame' },
        ] },
    ],
  },

  dungeons: {
    grand_fire: { name: '格兰之火', lvl: [55, 56], theme: 'tgFire', layout: 'standard', mobs: [['fireGoblin', 3], ['fireTreant', 1.5], ['fireSpirit', 1.5], ['lavaGolem', 1]], elite: 'fireChief', boss: 'utara', bgm: 'dungeon2', bossBgm: 'boss',
      gate: { scene: 'tg_past_a', x: 520, col: '255,150,90' }, desc: '过去的格兰之森燃起了大火。兽王乌塔拉血量过半后会被大火包住——先扑灭四个燃烧的火种，它才会受伤。咆哮会把人推向火堆；三连地锤要跳。蓄力没打断就会爆炸。',
      drops: { boss: [['ep_tg_harp', 0.006]], mats: [['crystal', 0.12, 10], ['c_red', 0.03, 2], ['m_leather', 0.03, 2]] } },
    plague_source: { name: '瘟疫之源', lvl: [55, 56], theme: 'tgPlague', layout: 'standard', mobs: [['plagueGhoul', 3], ['plagueSkel', 2], ['plagueGhost', 1.5], ['plagueSpider', 1.5]], elite: 'plagueHeadless', boss: 'skelKnight', bgm: 'dungeon3', bossBgm: 'boss',
      gate: { scene: 'tg_past_a', x: 1160, col: '220,220,140' }, desc: '暗精灵村庄的瘟疫，是从异次元裂缝里来的。骷髅骑士的旋转枪矛沿红线扫过，地上会留下残骸。瘟疫倒计时站进净化圈。',
      drops: { boss: [['ep_tg_harp', 0.006]], mats: [['crystal', 0.12, 10], ['m_bone', 0.03, 2], ['c_black', 0.02, 1]] } },
    kartel_origin: { name: '卡勒特之初', lvl: [56, 57], theme: 'tgDesert', layout: 'standard', mobs: [['desertBandit', 3], ['youngKartel', 2.5], ['sandSpider', 1.5]], elite: 'desertRider', boss: 'belit', bgm: 'dungeon', bossBgm: 'boss',
      gate: { scene: 'tg_past_a', x: 1800, col: '255,220,150' }, desc: '卡勒特刚成立的时候，西部的无法地带。沙影贝利特的旋风会拐弯追人，爆头标记要跳起来。两块岩石不打掉他会狂暴；血量低了会隐进沙暴。',
      drops: { boss: [['ep_tg_harp', 0.008]], mats: [['crystal', 0.12, 10], ['m_iron', 0.03, 2], ['c_white', 0.02, 1]] } },
    holy_war: { name: '暗黑圣战', lvl: [56, 57], theme: 'tgHoly', layout: 'standard', mobs: [['ozmaCultist', 2.5], ['fallenPaladin', 1.5], ['chaosBeast', 2.5], ['chaosEye', 1.2]], elite: 'chaosPriest', boss: 'nilbas', bgm: 'dungeon2', bossBgm: 'boss',
      gate: { scene: 'tg_past_a', x: 2440, col: '220,200,255' }, desc: '圣职者击退混沌之神奥兹玛之后的战场。格拉西亚家族的小女孩在找她失踪的哥哥——尼尔巴斯。地雷阵留一条安全排；他发光时站进光圈。领主房里把牧师护到他身边。',
      drops: { boss: [['ep_tg_harp', 0.008]], mats: [['crystal', 0.12, 10], ['c_black', 0.03, 2], ['m_elem2', 0.01, 1]] } },
    secret_zone: { name: '绝密区域', lvl: [57, 58], theme: 'bmLab', layout: 'standard', mobs: [['labRobot', 3], ['labIvan', 2], ['labMechTau', 1.2], ['labHound', 2]], elite: 'labWalker', boss: 'cerberus', bgm: 'dungeon', bossBgm: 'boss',
      gate: { scene: 'tg_past_b', x: 520, col: '255,120,110' }, desc: '比尔马克帝国试验场最深处的秘密。地狱三头犬注视时别站着不动，三连扑看红线躲开。试验笼到点会放出猎犬，先打掉。',
      drops: { boss: [['ep_tg_harp', 0.01]], mats: [['crystal', 0.12, 10], ['m_iron', 0.03, 2], ['m_elem2', 0.01, 1]] } },
    old_wail: { name: '昔日悲鸣', lvl: [57, 58], theme: 'wcCave', layout: 'long', mobs: [['pastLarva', 2.5], ['caveSpider', 2], ['siroShade', 1.5]], elite: 'nightmareBlade', boss: 'kainPast', bgm: 'dungeon3', bossBgm: 'boss',
      gate: { scene: 'tg_past_b', x: 1160, col: '200,120,255' }, desc: '阿甘左的噩梦：当年在悲鸣洞穴和使徒希洛克的对决。异界之风往左吹。幻影冲击留安全排，欲望的沼泽别踩进去。',
      drops: { boss: [['ep_tg_harp', 0.01]], mats: [['crystal', 0.12, 10], ['m_bone', 0.03, 2], ['m_soul', 0.003, 1]] } },
    old_winter: { name: '凛冬', lvl: [58, 59], theme: 'snRidge', layout: 'long', mobs: [['pastYeti', 1.5], ['pastTiger', 2.5], ['pastBantu', 2], ['iceWyvern', 1.2]], elite: 'frostApe', boss: 'youngSkasa', bgm: 'dungeon2', bossBgm: 'boss',
      gate: { scene: 'tg_past_b', x: 1800, col: '170,220,255' }, desc: '昔日的万年雪山，冰龙斯卡萨还年轻的时候。地面龙息扫过几排并留下冰晶，打碎冰晶。它飞起来时绕到侧面，三连锤要跳。',
      drops: { boss: [['ep_tg_harp', 0.012]], mats: [['crystal', 0.12, 10], ['c_blue', 0.03, 2], ['m_diamond', 0.006, 1]] } },
    iris_raid: { name: '谜之觉悟', lvl: [58, 59], bossLvl: 60, theme: 'tgRift', layout: 'raid', mobs: [['riftGazer', 2], ['riftStalker', 2.5], ['riftCaster', 2], ['riftEcho', 0.4], ['riftKeeper', 0]], elite: 'riftEcho', boss: 'irisBard', bossAdds: 0,
      bgm: 'abyss', bossBgm: 'boss', preBoss: { kind: 'riftKeeper', say: '时空守门人：再往前，就是“她”的舞台了。' },
      gate: { scene: 'tg_past_b', x: 2440, col: '210,160,255' }, desc: '【攻坚】所有线索都指向了暗黑城的使者——吟游诗人艾丽丝。木偶乐团没清完之前她不会受伤。三首歌会换招、换颜色。',
      drops: { boss: [['ep_tg_harp', 0.04]], mats: [['crystal', 0.14, 12], ['m_soul', 0.005, 1], ['m_diamond', 0.012, 1]] } },
  },

  abyss: {
    abyss_timegate: { name: '时空之门深渊', from: 'old_wail', themeFrom: 'tgRift', theme: 'abyssTimegate', tint: 'rgba(60,10,120,0.34)', lvl: [58, 59], lordLvl: 60, cost: 1, pity: 7,
      lords: ['kainPast', 'youngSkasa', 'nilbas'], gate: { scene: 'tg_past_b', x: 2950 }, clearExp: 24000,
      waves: [{ n: 7, mobs: [['riftStalker', 2], ['siroShade', 1], ['pastTiger', 1], ['riftCaster', 1]], elite: 1, say: '过去的影子从裂缝里涌出来了！' }, { elites: ['nightmareBlade', 'frostApe'], say: '噩梦中的剑士和冰原巨猿！' }],
      lord: { mechs: [{ use: 'enrage', t: 220 }], cycle: [{ every: [22, 28], at: 0.8, say: '深渊护盾！', mech: { use: 'shield', hp: 0.05, dur: 12, punish: 'heal', onBreak: 'groggy', col: '#c890ff' } },
        { every: [28, 34], at: 0.5, mech: { use: 'safezone', windup: 3.2, frac: 0.35, say: '深渊之力——站进光圈！' } }] },
      desc: '【深渊派对】时空之门的缝隙里裂开了深渊。需要消耗 1 张深渊派对邀请函。深渊领主是凯恩 / 年轻的斯卡萨 / 尼尔巴斯之一（每次随机）。「时空旅者」只在这里出现。',
      quest: { name: '时空之门的深渊', lvl: 59, clear: 'iris_raid', pre: ['q_abyss_gf', 'q_tg11', 'q_tg12'], gold: 10000, desc: '打倒过凯恩和年轻的斯卡萨之后，再通关一次「谜之觉悟」，歌兰蒂斯就会告诉你时空之门深渊的入口。',
        offer: ['时空之门……连深渊都能连到过去。', '先在过去打倒凯恩、年轻的斯卡萨，再去见一见那个吟游诗人。'],
        done: ['过去的回廊 · 后段的最右边，深渊之门已经打开。'] } },
  },

  npcs: {
    silan: { name: '西岚', title: '剑圣 · 修理 / 仓库', h: 120, services: ['quest', 'repair', 'storage'],
      greet: ['时空之门已经打开了。年轻人，你准备好去看一看过去了吗？'], lines: ['三条龙被放到了阿拉德大陆……背后一定有人。', '答案藏在过去。格兰之森、暗精灵的村子、西部的沙漠……', '阿甘左的噩梦，也在门的另一边。'],
      look: 'Silan, the legendary Sword Saint: a dignified elderly swordmaster with long white hair tied in a topknot and a long white beard, calm sharp eyes, a dark blue and white martial arts robe with a black sash, a long sheathed katana at the waist, hands clasped behind his back' },
  },
  scenes: {
    time_gate: { name: '时空之门', area: '时空之门', kind: 'town', width: 2400, theme: 'tgTown', bgm: 'guild', ambient: 'magic', map: [46, -3],
      props: [{ art: 'world/p_magiclamp', x: 520, h: 110, y: 20 }, { art: 'world/p_magiclamp', x: 1700, h: 110, y: 20 }],
      npcs: [{ npc: 'silan', x: 1150, y: 50 }],
      exits: [{ side: 'down', x: 300, to: 'luft_port' }, { side: 'left', to: 'tg_past_a' }, { side: 'right', to: 'tg_past_b', minLv: 57, label: '过去的回廊 · 后段' }] },
    tg_past_a: { name: '时空之门', area: '过去的回廊 · 前段', kind: 'field', width: 3200, theme: 'tgTown', bgm: 'field', map: [38, -6],
      exits: [{ side: 'right', to: 'time_gate' }] },
    tg_past_b: { name: '时空之门', area: '过去的回廊 · 后段', kind: 'field', width: 3200, theme: 'tgRift', bgm: 'field', map: [54, -6],
      exits: [{ side: 'left', to: 'time_gate' }] },
  },

  story: { chapter: '时空之门篇 · 谜之觉悟', prefix: 'q_tg', pre: 'q_tr09', npc: 'silan', scene: 'time_gate', steps: [
    { t: 'arrive', npc: 'harland', to: 'silan', name: '时空之门', lvl: 55, scene: 'time_gate', reward: { exp: 0.05, gold: 5000 },
      desc: '鲁夫特港的灯塔旁出现了一扇奇怪的门。从海港往上走，穿过时空之门，去找等在那里的剑圣西岚。',
      talk: { offer: ['灯塔那边的光……果然是一扇门。', '有个拿刀的老先生一直站在门口，说在等一个“打倒过卡勒特总指挥的人”。去看看吧。'], doing: ['门在海港往上走，Lv.55 才能过去。'], done: ['你来了。我是西岚。', '三条龙被放到了阿拉德大陆——斯卡萨、希尔德……背后一定有人在推动。答案，藏在过去。'] } },
    { t: 'clear', dungeon: 'grand_fire', name: '格兰之火', lvl: 55, reward: { exp: 0.08, gold: 5000 },
      desc: '穿过时空之门，回到格兰之森燃起大火的那一天。通关「格兰之火」。',
      talk: { offer: ['格兰之森那场大火，精灵们全都消失了。', '回到那一天，看看是谁放的火。'], doing: ['火焰精灵死的时候会爆炸，别贴着打。'], done: ['森林深处，有一头发狂的兽王。'] } },
    { t: 'boss', dungeon: 'grand_fire', name: '兽王乌塔拉', lvl: 56, reward: { exp: 0.09, gold: 6000 },
      desc: '打倒被大火逼疯的兽王乌塔拉。',
      talk: { offer: ['乌塔拉血量过半后，大火会护住它——先扑灭四个燃烧的火种。'], doing: ['咆哮会把人推向火堆。三连地锤跳起来。蓄力没打断就会爆炸，先跑远。'], done: ['大火里……有人留下了一片紫色的羽毛。', '这羽毛，我在暗精灵的村子里也见过。'] } },
    { t: 'clear', dungeon: 'plague_source', name: '瘟疫之源', lvl: 55, reward: { exp: 0.08, gold: 5000 },
      desc: '暗精灵村庄的瘟疫是从哪里来的？回到过去，通关「瘟疫之源」。',
      talk: { offer: ['暗精灵村庄的瘟疫……据说来自一道异次元裂缝。', '去过去的村子看看。'], doing: ['食尸鬼和蜘蛛都带毒，别被围住。'], done: ['裂缝旁边，站着一个骷髅骑士。'] } },
    { t: 'boss', dungeon: 'plague_source', name: '骷髅骑士', lvl: 56, reward: { exp: 0.09, gold: 6000 },
      desc: '打倒守着瘟疫之源的骷髅骑士。',
      talk: { offer: ['旋转枪矛沿红线扫过，地上会留下残骸。', '瘟疫倒计时站进净化圈。'], doing: [], done: ['瘟疫停下了。裂缝边上……又是那种紫色的羽毛。'] } },
    { t: 'clear', dungeon: 'kartel_origin', name: '卡勒特之初', lvl: 56, reward: { exp: 0.08, gold: 5000 },
      desc: '卡勒特是怎么成立的？回到西部的无法地带，通关「卡勒特之初」。',
      talk: { offer: ['你在天界打过的卡勒特……它刚成立的时候，只是一群沙漠里的亡命之徒。'], doing: ['沙漠骑手扬沙的时候会看不清，别慌。'], done: ['那群人的头领……是一个年轻的刺客。'] } },
    { t: 'boss', dungeon: 'kartel_origin', name: '沙影贝利特', lvl: 57, reward: { exp: 0.1, gold: 6000 },
      desc: '打倒年轻时的沙影贝利特。',
      talk: { offer: ['贝利特的旋风会拐弯追人，爆头标记要跳起来。', '两块岩石不打掉，他会狂暴。血量低了会隐进沙暴。'], doing: [], done: ['贝利特说，卡勒特成立的那天，有个唱歌的女人来过。'] } },
    { t: 'clear', dungeon: 'holy_war', name: '暗黑圣战', lvl: 56, reward: { exp: 0.08, gold: 5000 },
      desc: '圣职者击退混沌之神奥兹玛之后的战场。通关「暗黑圣战」。',
      talk: { offer: ['暗黑圣战结束以后，有个小女孩一直在找她失踪的哥哥。', '她姓格拉西亚——和诺伊佩拉的格拉西亚家族是同一家。'], doing: ['信徒会给同伴回血，先打他们。'], done: ['战场尽头……那个人，就是她的哥哥。'] } },
    { t: 'boss', dungeon: 'holy_war', name: '尼尔巴斯·格拉西亚', lvl: 57, reward: { exp: 0.1, gold: 6000 },
      desc: '打倒被混沌侵蚀的尼尔巴斯·格拉西亚。',
      talk: { offer: ['尼尔巴斯已经被混沌侵蚀了。', '地雷阵留一条没亮的安全排。他发光的时候站进光圈。领主房里把牧师护到他身边。'], doing: [], done: ['他最后说了一个名字……“艾丽丝”。'] } },
    { t: 'boss', dungeon: 'secret_zone', name: '地狱三头犬', lvl: 57, reward: { exp: 0.1, gold: 6000 },
      desc: '比尔马克帝国试验场的最深处，藏着一个秘密。打倒「绝密区域」的地狱三头犬。',
      talk: { offer: ['比尔马克帝国的试验场，你去过吧？最深处还有一扇门。', '里面关着一头三个头的狗。'], doing: ['注视者之眼亮着的时候别站着。试验笼到点会放出猎犬。'], done: ['试验记录上写着：“资助人：艾丽丝”。'] } },
    { t: 'boss', dungeon: 'old_wail', name: '凯恩', lvl: 58, reward: { exp: 0.11, gold: 7000 },
      desc: '阿甘左的噩梦：当年在悲鸣洞穴和使徒希洛克的对决。打倒「昔日悲鸣」的凯恩。',
      talk: { offer: ['阿甘左……到现在还会梦见悲鸣洞穴。', '那天，他和使徒希洛克交过手。凯恩是守在洞口的骷髅剑士。'], doing: ['异界之风往左吹。幻影冲击站进没亮的那一排，沼泽别踩。'], done: ['噩梦散了。……希洛克的影子里，也有那个唱歌的女人。'] } },
    { t: 'boss', dungeon: 'old_winter', name: '年轻的斯卡萨', lvl: 58, reward: { exp: 0.11, gold: 7000 },
      desc: '冰龙斯卡萨还年轻的时候，昔日的万年雪山。打倒「凛冬」的年轻的斯卡萨。',
      talk: { offer: ['三条龙里的斯卡萨，你在万年雪山打倒过。', '去看看它年轻的时候——是谁把它从沉睡里叫醒的。'], doing: ['地面龙息留一条安全排，冰晶要打碎。它飞起来时绕到侧面。'], done: ['冰龙的记忆里……有一首歌。唱歌的人，是暗黑城的使者。'] } },
    { t: 'raid', dungeon: 'iris_raid', name: '吟游诗人艾丽丝', lvl: 59, reward: { exp: 0.16, gold: 10000, coins: 2 },
      desc: '所有的线索都指向同一个人——暗黑城的使者，吟游诗人艾丽丝。打倒她。',
      talk: { offer: ['羽毛、瘟疫、卡勒特、三条龙……全都是她。', '木偶乐团没清完，艾丽丝不会受伤。三首歌会换招、换颜色。'], doing: ['时空守门人在她的舞台前面。'], done: ['艾丽丝消失前笑着说：“魔界的第五使徒，正在等你哦。”'] } },
    { t: 'handin', to: 'silan', name: '谜之觉悟', lvl: 59, reward: { exp: 0.08, gold: 8000, items: [{ key: 'ep_tg_harp', n: 1 }] },
      desc: '回时空之门，把艾丽丝留下的话告诉西岚。',
      talk: { offer: ['艾丽丝……消失了。'], done: ['这把竖琴留在了她的舞台上——拿去吧。', '魔界的第五使徒……潜行者希洛克。阿甘左的妻子卢克西，就是被她带走的。', '等你到了 Lv.60，从时空之门往上走，穿过次元裂缝，去魔界找阿甘左。', '——时空之门篇 · 完——'] } },
  ] },

  art: {
    chars: {
      tgUtara: { h: 136, boss: true, hold: 'holding a giant bone and stone war club', desc: 'Utara the Beast King, lord of the Grand Flores forest and a menacing boss: a huge hulking beast-man with the head of a snarling lion-boar with big curved tusks, a thick dark brown mane, a muscular body covered in dark fur with red tribal war paint, a necklace of big fangs and bones, rough leather and wooden plate armor, a torn loincloth, clawed feet, holding a giant bone and stone war club. Savage, roaring and fierce.',
        atk: 'the giant war club smashed down', cast: 'beating its chest and roaring', low: 'charging forward low on all fours',
        sig: ['plants both feet wide, throws the head back with the chest thrust out, then sweeps the war club sideways in a big shoving arc', 'leaps with the war club cocked overhead in both hands, crashes down club-first until the knees buckle, then coils straight into another jump'] },
      tgSkelKnight: { h: 134, boss: true, hold: 'holding a large rusted halberd and a round shield', desc: 'The Skeleton Knight guarding the source of the plague, a menacing boss: a tall undead skeleton knight in corroded dull bronze plate armor tinged with olive rot, a tattered moss-brown cape, a cracked skull with glowing pale yellow eye lights inside a pointed open helm with a broken plume, holding a large rusted halberd and a round shield with a rotten skull emblem. Dreadful and fierce.',
        atk: 'the halberd swung in a wide arc', cast: 'raising the halberd as the eye lights flare', low: 'lunging forward low with the halberd',
        sig: ['holds the halberd straight out and spins the whole body in a full horizontal whirl with the shield tucked, then lunges out of the spin', 'drives the halberd point-down into the floor with both hands and drags it through a short arc, shoulders hunched'] },
      tgBelit: { h: 122, boss: true, hold: 'holding two curved daggers', desc: 'Belit the Sand Shadow in his youth, a founding member of the Kartel and a menacing boss: a lean agile desert assassin in his early twenties with a menacing glare, narrowed sharp amber eyes, furrowed brows and a cruel sneer showing his teeth, a scar on the cheek, dark tan skin, a sand-colored hooded scarf wrapped over the lower face, layered desert cloth armor with leather straps and a red sash, bandaged forearms, holding two curved daggers in reverse grip. Deadly, hostile and fierce, clearly a villain.',
        atk: 'both curved daggers slashing', cast: 'crossing the daggers in front of the face', low: 'dashing forward low with both daggers',
        sig: ['crosses both daggers in front of his chest and spins them, then flicks one dagger forward while the other arm stays extended', 'raises one dagger beside his eye like a sight and points the other arm straight forward, weight on the back foot'] },
      tgNilbas: { h: 130, boss: true, holes: false, outline: '#2a1a3a', hold: 'holding a huge black greatsword', desc: 'Nilbas Gracia, the lost elder brother of the Gracia family corrupted during the Dark Holy War, a menacing boss: a tall young dark elf knight with dark grey skin, long white hair and long pointed ears, glowing red eyes and a furious anguished expression, black and violet plate armor engraved with a tusked boar crest, a torn dark cape, holding a huge black greatsword with violet rune engravings. Tragic, corrupted and fierce.',
        atk: 'the black greatsword swung down', cast: 'raising the greatsword overhead with a furious shout', low: 'charging forward low with the greatsword',
        sig: ['slams the greatsword tip into the ground and rakes it sideways, body leaning into the drag', 'raises the greatsword overhead with both hands and holds still, head thrown back, feet planted wide'] },
      tgCerberus: { h: 120, boss: true, hold: null, cycle: 'trot', desc: 'Cerberus, the hellhound locked in the deepest secret area of the Bilmark Empire test site, a menacing boss: a huge four-legged dog monster with three snarling heads side by side, sharp fangs and glowing red eyes, dark charcoal fur with steel armor plates bolted onto the back and legs, heavy iron collars with broken chains and experiment number tags, big claws and a spiked tail. Ferocious.',
        atk: 'all three heads biting forward', cast: 'rearing up with all three heads howling', low: 'crouching low ready to pounce',
        sig: ['all three heads lift and stare forward while the body stays planted, shoulders low, front paws braced', 'crouches until the belly nearly touches the ground, lunges with all three heads stretched forward, then coils to pounce again'] },
      tgIris: { h: 128, boss: true, hold: 'holding an ornate golden lyre harp', desc: 'Iris the Bard, the mysterious envoy of the Dark City behind every clue and a menacing raid boss: a slender elegant woman with long wavy lavender hair, pale skin, wide-open piercing violet eyes with a cold menacing stare and a sinister crooked smirk, dark plum lipstick, a long modest dark violet and black gothic dress with a high collar and gold trims, a wide feathered bard hat, holding an ornate golden lyre harp with dark strings. Beautiful but clearly a sinister, threatening villain, not cute.',
        atk: 'the lyre swung like a blade', cast: 'playing the lyre with eyes closed', low: 'gliding forward low with the lyre held out',
        sig: ['leans forward and draws both hands in a long sweep across the lyre, one foot sliding ahead', 'lifts the lyre high overhead with both hands and brings it down in a sharp conducting strike, knees bending'] },
      // wcKain、snSkasa 的精灵在别的区域。这里不建同名 art.chars，避免和 ancient / snow 撞精灵目录。
      // 换色凯恩 sigA: leans low, thrusts the sword straight ahead, free hand pointing down the charge, then snaps upright.
      // 换色凯恩 sigB: drives the sword point down and drags it through a slow half-circle, the other arm held out for balance.
      // 年轻斯卡萨 sigA: rears on the hind legs, both foreclaws crash down, then coils to rise again.
      // 年轻斯卡萨 sigB: drops the head, jaws wide, neck stretched forward, wings half open.
    },
    gates: {
      grand_fire: 'a charred wooden forest archway with burnt leaves and a white stone elf shrine, an orange-red portal',
      plague_source: 'a dark elf cave entrance with plague warning cloth banners and bones, a pale olive-yellow portal',
      kartel_origin: 'a desert frontier outpost gate of wooden logs with a crude Kartel flag and a cow skull, a sandy gold portal',
      holy_war: 'a ruined cathedral doorway with broken stained glass and a toppled saint statue, a pale white-violet portal',
      secret_zone: 'a heavy steel blast door of the Bilmark test site with hazard stripes and a TOP SECRET plate, a red portal',
      old_wail: 'a dark wailing cave mouth with stalactites and scattered bones, a deep violet portal',
      old_winter: 'an icy mountain pass gate of snow-covered stone with icicles and an old tribal banner, an icy blue portal',
      iris_raid: 'an ornate old theater stage gate with heavy violet curtains, broken clock gears and a golden lyre emblem, a dark violet portal',
    },
  },
});
