/* =====================================================================
   区域：暗精灵地区 · 阿法利亚营地与暗黑城（官方 60 版本 Lv38~55 的「暗黑城」；满级 60 后放在 Lv31~38，天帷巨兽之后的第一段）
   官方依据（国服 60 版本）：传染病传进了暗精灵的城镇诺伊佩拉，暗精灵以为是人类带来的灾难，向贝尔玛尔公国宣战；冒险家从阿法利亚营地山脚的入口
   进入地下的暗黑城，想去暗精灵的首都安达夫多澄清误会。地下城与领主都是官方的：浅栖之地（怨恨之摩根）、蜘蛛洞穴（艾克洛索）、暗精灵墓地（邪龙斯皮兹）、
   熔岩穴（歌利亚 / 泰坦 / 阿特拉斯）、王的遗迹（隐藏，不灭之王 波罗丁与王的五骑士）、暗黑城入口（无头骑士，谨慎的仃高 / 沉默的亨普利）、远古诺伊佩拉（狄瑞吉的幻影）。
   小怪也是官方名：盗尸者、骸骨投掷兵、鬼魂、冰奈斯、冤魂、毒蜘蛛、凶残僵尸、墓地骷髅、岩石骷髅、吞灵者、熔岩盗尸者、燃烧之赫拉、油桶欧力克、暗精灵护卫……
   任务名多数取自官方主线（前往阿法利亚营地 / 没有送出的信 / 调查蜘蛛洞穴 / 失踪的大使 / 存在的邪龙 / 通向暗黑城之路 / 王的五骑士 / 伟大的波罗丁王 / 最后的决斗）。
   本作原创：各怪物 / 领主的具体招式与机制组合、区域的史诗（摩根的炼金毒瓶），格拉西亚家族遗物做成首饰（官方是诺伊佩拉兑换的防具套）。
   这个文件是纯数据：代码由 game/region.js 的 defineRegion 展开，深渊由 content/abyss.js 展开，美术由 art/tools/region_art.py darkelf 读同一份数据生成。
   入口：西海岸（x 1800 往上，Lv.31）
   领主机制（docs/BOSS_PLAN.md §2 暗精灵，R2 块）：写成常量的是要被阶段进场 + 按冷却重放的机制（组队时嵌套招式靠定义时预编译编号，docs/BOSS_SPEC.md §7）；
   分裂（split）和无头骑士的回血狂奔是区域钩子，在 darkelf_bosses.js
   ===================================================================== */
// 怨恨之摩根：调配禁忌药剂（读条 3 秒，打够伤害打断 → 破招；打不断就炸开一大片毒）
const DE_MORGAN_BREW = { use: 'stagger', windup: 3, need: 0.03, onBreak: 'groggy', col: '#c8e070', say: '摩根在调配禁忌药剂——打断他！',
  skill: { use: 'aoe', shape: 'circle', at: 'self', r: 230, windup: 0.5, dmg: 1.6, status: 'poison', linger: 6, zone: 'poison', col: '#c8e070', say: '禁忌药剂炸开了！' } };
// 艾克洛索：蛛网茧里积蓄毒液（打断 → 破招；打不断 → 毒液喷发，跳起来躲）
const DE_EKLOSO_VENOM = { use: 'stagger', windup: 3.2, need: 0.035, onBreak: 'groggy', col: '#c8e070', say: '艾克洛索在蛛网茧里积蓄毒液——打断它！',
  skill: { use: 'aoe', shape: 'circle', at: 'self', r: 270, windup: 0.6, dmg: 1.5, jump: true, status: 'poison', col: '#c8e070', say: '毒液喷发——跳起来！' } };
const DE_EKLOSO_BOUNCE = (stun, dmg) => ({ use: 'dash', wallStun: stun, speed: 960, windup: 0.9, hw: 26, dmg, col: '#c8e070' });
// 邪龙斯皮兹的头部：咆哮（站进光圈）
const DE_SPIZ_ROAR = { use: 'safezone', windup: 3.2, n: 2, r: 80, frac: 0.3, col: '#8a5aff', say: '邪龙的咆哮——站进光圈！' };
// 熔岩穴：歌利亚捶开地面，熔岩地砖（闪烁的格子马上变烫，至少留一半安全）
const DE_LAVA_FLOOR = { use: 'arena', kind: 'tiles', cols: 7, hot: 0.43, every: 5, warn: 1.3, frac: 0.03, tick: 0.8, dur: 12, col: '#ff6a2a', say: '熔岩地砖——闪烁的格子马上会变烫！' };
// 王的遗迹：王的五骑士车轮战（官方顺序：风 → 守护 → 冰 → 炎 → 光），各带一个招牌；打完波罗丁才亲自出手
const DE_BORO_KNIGHTS = { use: 'gauntlet', boss: 'watch', gap: 1.5, col: '#d8c0ff', say: '王的五骑士依次上前——打倒他们，不灭之王才会亲自出手！', done: '不灭之王 波罗丁亲自出手了！',
  waves: [
    { kind: 'knightWind', name: '风之涡苏', hp: 1, say: '风之骑士涡苏——隐身时伤害降低，看准影子打！',
      mechs: [{ use: 'stance', every: [5, 6], modes: [{ id: 'hide', name: '隐身', invis: 0.85, dmgTaken: 0.5, col: '#9aff9a', say: '风之涡苏隐身了！' }, { id: 'show', name: '现身', col: '#9aff9a', aura: false }] }] },
    { kind: 'knightGuard', name: '守护之迈拉', hp: 1, say: '守护骑士迈拉——红光反弹物理，蓝光反弹魔法！',
      mechs: [{ use: 'stance', every: [6, 6], modes: [{ id: 'red', name: '赤之守护（反弹物理）', reflect: 'phys', col: '#ff5a5a', say: '赤之守护——物理攻击会被反弹！' }, { id: 'blue', name: '蓝之守护（反弹魔法）', reflect: 'magic', col: '#6ab0ff', say: '蓝之守护——魔法攻击会被反弹！' }] }] },
    { kind: 'knightIce', name: '冰之埃斯顿', hp: 1, say: '冰之骑士埃斯顿——地上的冰刃会冻住脚，站进没亮的那一排！' },
    { kind: 'knightFire', name: '炎之古拉德', hp: 1, say: '炎之骑士古拉德——打它会在你身上叠炸弹，叠满会爆！' },
    { kind: 'knightLight', name: '光之沃德咯斯', hp: 1, say: '光之骑士沃德咯斯——全屏闪电，找没亮的那一排！' }] };
const DE_BORO_UNDYING = { use: 'shield', hp: 0.05, dur: 14, punish: 'nova', onBreak: 'groggy', col: '#c8a0ff', say: '不灭之王——打碎护盾！' };
// 无头骑士：低血梦魇狂奔（回血，钩子 REGION_HOOKS.headless）↔ 喘息（受到的伤害 +30%）轮换；狂奔时只放自己的两招
const DE_HEADLESS_GALLOP = { use: 'stance', sig: '梦魇狂奔 ↔ 喘息', every: [9, 11], modes: [
  { id: 'gallop', name: '梦魇狂奔（回血）', col: '#b890ff', speed: 1.7, replace: true, say: '无头骑士开始满场狂奔——梦魇之力在回复它的伤口！',
    skills: [{ use: 'dash', carry: true, speed: 820, windup: 0.9, hw: 26, dmg: 1.2, col: '#b890ff', cd: [6, 8], w: 2 },
      { use: 'lanes', kind: 'runner', runner: 'nightmareShade', lanes: 5, hit: 4, speed: 950, windup: 1.0, dmg: 1.1, col: '#b890ff', cd: [8, 10], w: 1.4, then: { use: 'hold', dur: 1.8, clip: 'roar', col: '#b890ff' } }] },
  { id: 'rest', name: '喘息', col: '#ffe070', dmgTaken: 1.3, say: '无头骑士停下来喘息——趁现在！' }] };
// 诺伊佩拉：搜捕团祭司（两个一起上，8 秒内没一起倒下就互相复活；狄瑞吉这时裹在瘟疫里打不动）、瘟疫爆发（远离）、分裂（钩子 split）
const DE_NEIPERA_PRIESTS = { use: 'gauntlet', boss: 'watch', window: 8, reviveHp: 0.6, gap: 1, col: '#d8c880', say: '狄瑞吉裹进了瘟疫——搜捕团祭司会互相复活，8 秒内把两个都打倒！', done: '瘟疫散开了——狄瑞吉的幻影又动了！',
  waves: [{ kind: 'searchPriest', n: 2, hp: 1.6, name: '搜捕团祭司', say: '搜捕团的两名祭司——8 秒内一起打倒！' }] };
const DE_NEIPERA_BURST = { use: 'safezone', mode: 'far', r: 240, windup: 3.2, frac: 0.35, col: '#c8b860', say: '瘟疫爆发——远离狄瑞吉！' };
const DE_DIREGIE_SPLIT = { use: 'split', n: 3, kind: 'diregieShard', window: 10, reviveHp: 0.5, col: '#c0a0ff', say: '狄瑞吉的幻影分裂了——10 秒内把三块碎片全部打倒！' };
defineRegion({
  id: 'darkelf', name: '暗精灵地区 · 暗黑城', lvl: 31, lvlMax: 38, power: 1.25, bossPower: 1, atkPower: 1.1,   // 难度：稀有装备的机器人在各地下城的等级对照调（见 docs/PLAYBOOK.md §2.3）
  entry: { scene: 'west_coast', side: 'up', x: 1800, to: 'aferia_camp', minLv: 31, label: '阿法利亚营地' },

  /* ---- 场景主题 ---- */
  themes: {
    deCamp: { grade: { tint: 'rgba(120,80,40,0.08)', fog: 'rgba(255,200,140,0.06)' }, ambient: 'motes', rgb: '255,210,150', floorW: 1700,
      pal: { sky: ['#2a2038', '#5a4058', '#c08a6a'], haze: '#ffb888' },
      bg: ['Aferia Camp, a human military camp of the Bellmare duchy at the foot of a steep mountain: canvas tents with blue and gold banners, wooden watchtowers, a huge dark cave mouth in the cliff lit by torches leading down to the dark elf underground, pine trees, warm evening sky.',
        'packed dirt camp ground with wooden plank walkways, trampled grass and wagon wheel tracks',
        'a low wooden palisade fence with torches, stacked supply barrels, crates and small banners'] },
    deCave: { grade: { tint: 'rgba(40,60,110,0.14)', fog: 'rgba(120,170,255,0.08)' }, ambient: 'motes', rgb: '150,200,255', floorW: 1700,
      pal: { sky: ['#0a1020', '#162440', '#2a3a60'], haze: '#6aa0ff', floor: ['#1e2430', '#262e3c', '#181c26'] },
      bg: ['Shallow Haunt, the upper caverns of the dark elf underground: a vast dim cave with pale blue glowing mushrooms, half-buried ancient dark elf stone arches with crescent moon carvings, thick spider webs between stalactites, a faint underground river.',
        'damp dark stone cave floor with patches of glowing blue moss, small puddles and pebbles',
        'a rocky cave ledge with glowing blue mushrooms, short stalagmites and old dusty spider webs'] },
    deTomb: { edgeHoles: true, grade: { tint: 'rgba(70,40,110,0.14)', fog: 'rgba(170,130,255,0.09)' }, ambient: 'wisps', rgb: '190,160,255', floorW: 1700,
      pal: { sky: ['#100a1c', '#221638', '#3a2a58'], haze: '#9a78ff', floor: ['#241f30', '#2c263a', '#1c1826'] },
      bg: ['The Dark Elf Graveyard deep underground: rows of tall pointed black tombstones, elegant crumbling mausoleums with silver crescent moon carvings, pale violet ghost lights floating in the air, the giant bones of an ancient dragon half buried in the far background.',
        'a cracked dark flagstone path with violet moss, fallen pale petals and small bone fragments',
        'short crooked tombstones, withered violet flowers and a broken iron grave fence'] },
    deLava: { edgeHoles: true, grade: { tint: 'rgba(150,50,20,0.14)', fog: 'rgba(255,120,60,0.08)' }, ambient: 'wisps', rgb: '255,140,80', floorW: 1600,
      pal: { sky: ['#1a0804', '#40140a', '#7a2a10'], haze: '#ff7a3a', floor: ['#2a1c18', '#34221c', '#221612'], line: 'rgba(255,120,50,.45)' },
      bg: ['The Lava Cave, a volcanic cavern connected to the fire lands: slow rivers of glowing orange lava, tall black basalt columns, giant broken iron chains and colossal ancient tools left by giants, red heat haze.',
        'black cooled lava rock floor with thin glowing orange cracks and scattered ash',
        'jagged basalt rocks with small bubbling lava pools and a few charred bones'] },
    deGate: { grade: { tint: 'rgba(60,40,100,0.12)', fog: 'rgba(160,130,255,0.08)' }, ambient: 'motes', rgb: '200,170,255', floorW: 1800,
      pal: { sky: ['#0c0818', '#1c1434', '#34285a'], haze: '#a88aff' },
      bg: ['The Gate of the Dark City: the grand entrance to the dark elf capital deep underground, a colossal carved obsidian gate with silver crescent moon ornaments, elegant slender dark elf towers with violet lanterns beyond it, tall stone guardian statues holding spears, a starless cavern ceiling.',
        'polished dark grey stone pavement with inlaid silver crescent moon patterns',
        'a row of low carved stone balustrades with violet crystal lanterns and empty statue pedestals'] },
    // 王的遗迹 · 王座厅（领主房单独的背景，bossTheme；美术队列出图前用程序兜底画面）
    deKingBoss: { edgeHoles: true, grade: { tint: 'rgba(80,50,120,0.16)', fog: 'rgba(190,150,255,0.10)' }, ambient: 'wisps', rgb: '200,170,255', floorW: 1700,
      pal: { sky: ['#0e0a1a', '#221838', '#40305e'], haze: '#b890ff', wall: ['#2a2238', '#1e1828'], floor: ['#2a2434', '#322a3e', '#221c2c'], line: 'rgba(200,160,255,.4)' },
      bg: ['The throne hall of the ancient dark elf kingdom in the King\'s Ruins: a vast ruined royal hall of black stone, a tall crumbling throne on a raised dais under a torn royal purple banner with a hammer and crown crest, five huge stone knight statues with spears and shields lining the walls, pale violet ghost lights, cracked high arches.',
        'a cracked black marble royal floor with faded silver inlays of crescent moons and a long torn purple carpet',
        'broken stone balustrades, fallen banners, scattered old knight helmets and cracked shields'] },
    deNeipera: { grade: { tint: 'rgba(80,60,110,0.16)', fog: 'rgba(200,180,120,0.10)' }, ambient: 'wisps', rgb: '220,200,140', floorW: 1800,
      pal: { sky: ['#140e18', '#2c2234', '#4a3a48'], haze: '#d0b880' },
      bg: ['Noiphera, the once beautiful dark elf town now stricken by a terrible plague: elegant dark elf houses with violet pointed roofs covered by sickly purple and yellow fungus, drifting plague spores, abandoned market stalls, a huge corrupted pulsing tree in the distance under a dark cavern sky.',
        'dark cobblestone street with creeping purple fungus and scattered abandoned belongings',
        'broken wooden fences, an overturned cart and fungus-covered barrels'] },
  },

  /* ---- 怪物 ---- */
  monsters: {
    corpseThief: { name: '盗尸者', tier: 'normal', arch: 'aggressive', size: [13, 12, 96], art: 'deGhoul',
      skills: [{ use: 'swipe', n: 2, dmg: 1.0, cd: [1.5, 2.5], w: 2 }, { use: 'grab', reach: 60, hold: 0.7, throwDmg: 1.3, cd: [7, 9] }] },
    lavaThief: { name: '熔岩盗尸者', tier: 'normal', arch: 'aggressive', size: [13, 12, 96], elem: 'fire', art: ['deGhoul', { hue: -30, sat: 1.4, bright: 0.9 }],
      traits: { onDeath: 'explode', explode: { r: 70, windup: 0.8, dmg: 0.9 } },
      skills: [{ use: 'swipe', n: 2, dmg: 1.0, cd: [1.5, 2.5], w: 2 }, { use: 'dash', len: 260, speed: 600, windup: 0.8, dmg: 1.1, status: 'burn', cd: [5, 7] }] },
    headlessThief: { name: '无头盗尸者', tier: 'normal', arch: 'aggressive', size: [13, 12, 96], elem: 'dark', art: ['deGhoul', { hue: 200, sat: 0.6, bright: 0.72 }],
      skills: [{ use: 'swipe', n: 3, dmg: 0.9, cd: [1.6, 2.6], w: 2 }, { use: 'dash', len: 300, speed: 640, windup: 0.8, dmg: 1.1, cd: [5, 7] }] },
    boneThrower: { name: '骸骨投掷兵', tier: 'caster', arch: 'kiter', size: [13, 12, 98], art: 'deSkel',
      skills: [{ use: 'swipe', dmg: 0.8, reach: 60, cd: [2, 3] }, { use: 'shot', clip: 'throw', mode: 'arc', r: 46, dmg: 0.9, cd: [3.5, 5], w: 2 }, { use: 'shot', clip: 'throw', mode: 'spread', n: 3, spread: 50, speed: 280, dmg: 0.7, cd: [5, 7] }] },
    tombSkeleton: { name: '墓地骷髅', tier: 'normal', arch: 'aggressive', size: [13, 12, 98], elem: 'dark', art: ['deSkel', { hue: 60, sat: 0.7 }],
      skills: [{ use: 'swipe', n: 2, dmg: 1.0, cd: [1.5, 2.5], w: 2 }, { use: 'shot', clip: 'throw', mode: 'straight', speed: 320, dmg: 0.8, cd: [4, 6] }] },
    rockSkeleton: { name: '岩石骷髅', tier: 'brute', arch: 'guard', size: [16, 13, 108], scale: 1.1, weight: 2.5, hardness: 30, art: ['deSkel', { sat: 0.25, bright: 0.8 }], traits: { sa: 'cast' },
      skills: [{ use: 'swipe', clip: 'slam', reach: 92, width: 30, windup: 0.62, dmg: 1.3, down: true, knock: 180, sa: true, cd: [2.4, 3.6], w: 2 },
        { use: 'guard', dur: 2.0, reduce: 0.8, cd: [8, 11], counter: { use: 'aoe', shape: 'circle', at: 'self', r: 110, windup: 0.45, dmg: 1.2 } }] },
    headlessSkel: { name: '无头骷髅', tier: 'normal', arch: 'aggressive', size: [13, 12, 98], elem: 'dark', art: ['deSkel', { hue: 220, sat: 0.8, bright: 0.7 }],
      skills: [{ use: 'swipe', n: 3, dmg: 0.9, cd: [1.6, 2.6], w: 2 }, { use: 'seq', cd: [6, 8], steps: [{ use: 'blink', to: 'behind', dist: 70 }, { use: 'swipe', n: 2, dmg: 0.9, windup: 0.3 }] }] },
    ghost: { name: '鬼魂', tier: 'flier', arch: 'flier', size: [14, 12, 80], elem: 'dark', art: 'deGhost',
      skills: [{ use: 'shot', mode: 'homing', speed: 220, dmg: 0.8, cd: [3.5, 5], w: 1.5 }, { use: 'seq', cd: [6, 8], steps: [{ use: 'blink', to: 'behind', dist: 60 }, { use: 'swipe', dmg: 0.9, windup: 0.3 }] }] },
    binness: { name: '冰奈斯', tier: 'flier', arch: 'flier', size: [14, 12, 80], elem: 'ice', art: ['deGhost', { hue: -40, sat: 1.2, bright: 1.1 }],
      skills: [{ use: 'shot', mode: 'spread', n: 3, spread: 50, speed: 260, dmg: 0.7, status: 'slow', cd: [4, 5.5], w: 1.4 }, { use: 'aoe', shape: 'circle', at: 'target', r: 60, windup: 1.1, dmg: 0.9, status: 'freeze', sdur: 1.2, cd: [7, 9] }] },
    wraith: { name: '冤魂', tier: 'flier', arch: 'flier', size: [14, 12, 84], elem: 'dark', art: ['deGhost', { hue: 70, sat: 1.2, bright: 0.85 }],
      skills: [{ use: 'shot', mode: 'homing', n: 2, spread: 50, speed: 210, dmg: 0.75, cd: [4, 5.5], w: 1.4 }, { use: 'aoe', shape: 'ring', at: 'self', r: 120, r0: 45, windup: 1.1, dmg: 1.0, status: 'blind', cd: [7, 9] }] },
    soulEater: { name: '吞灵者', tier: 'elite', arch: 'flier', size: [18, 14, 96], scale: 1.3, weight: 1.6, elem: 'dark', art: ['deGhost', { hue: 110, sat: 1.4, bright: 0.55 }], traits: { immune: ['stun'] },
      skills: [{ use: 'laser', windup: 1.1, dur: 1.0, sweep: 60, dmg: 0.45, cd: [6, 8], w: 1.4 }, { use: 'shot', mode: 'homing', n: 3, spread: 60, speed: 220, dmg: 0.8, cd: [5, 7] },
        { use: 'buff', kind: 'heal', target: 'self', amt: 0.08, cd: [14, 18], w: 0.6, say: '吞噬灵魂' }] },
    burningHera: { name: '燃烧之赫拉', tier: 'swarm', arch: 'swarm', size: [12, 10, 70], scale: 0.85, elem: 'fire', art: ['deGhost', { hue: 145, sat: 2.2, bright: 1.1 }],
      traits: { onDeath: 'explode', explode: { r: 80, windup: 0.8, dmg: 1.0 } },
      skills: [{ use: 'swipe', dmg: 0.7, reach: 50, cd: [1.6, 2.6] }, { use: 'explode', r: 95, windup: 1.0, dmg: 1.3, cd: [5, 7], w: 0.6 }] },
    smallSpider: { name: '小型蜘蛛', tier: 'swarm', arch: 'swarm', size: [12, 10, 40], scale: 0.6, art: ['deSpider', { hue: 30, bright: 1.1 }],
      skills: [{ use: 'swipe', clip: 'bite', reach: 48, dmg: 0.7, status: 'poison', cd: [1.4, 2.4] }] },
    poisonSpider: { name: '毒蜘蛛', tier: 'normal', arch: 'aggressive', size: [18, 13, 60], weight: 1.2, speed: 120, art: 'deSpider', noGrab: false,
      skills: [{ use: 'swipe', clip: 'bite', reach: 62, dmg: 0.95, status: 'poison', cd: [1.4, 2.4], w: 2 }, { use: 'shot', mode: 'spread', n: 3, spread: 50, speed: 260, dmg: 0.6, status: 'slow', cd: [5, 7], col: '#e8e0ff' },
        { use: 'dash', clip: 'pounce', len: 240, speed: 620, windup: 0.7, dmg: 1.0, cd: [5, 7] }] },
    fierceZombie: { name: '凶残僵尸', tier: 'brute', arch: 'aggressive', size: [14, 12, 100], weight: 2, art: ['zombie', { hue: 40, sat: 0.9, bright: 0.85 }],
      skills: [{ use: 'swipe', n: 2, reach: 70, dmg: 1.1, cd: [1.8, 2.8], w: 2 }, { use: 'grab', reach: 62, hold: 0.8, throwDmg: 1.4, cd: [7, 9] }] },
    barrelOrik: { name: '油桶欧力克', tier: 'elite', arch: 'kiter', size: [13, 11, 72], scale: 1.25, elem: 'fire', art: ['goblin', { hue: -25, sat: 1.2, bright: 0.9 }],
      skills: [{ use: 'shot', clip: 'throw', mode: 'arc', r: 60, dmg: 1.1, status: 'burn', cd: [3, 4.5], w: 2, col: '#ff8a3a' }, { use: 'rain', kind: 'hex', n: 3, r: 50, windup: 1.2, dmg: 1.0, col: '#ff8a3a', cd: [8, 11], say: '油桶炸弹！' }] },
    darkElfGuard: { name: '暗精灵护卫', tier: 'normal', arch: 'aggressive', size: [13, 12, 104], elem: 'dark', art: 'deElf',
      skills: [{ use: 'swipe', n: 2, reach: 92, width: 22, dmg: 1.0, cd: [1.6, 2.6], w: 2 }, { use: 'dash', len: 300, speed: 640, windup: 0.8, dmg: 1.1, cd: [5, 7] }, { use: 'guard', dur: 1.6, reduce: 0.7, cd: [10, 13], w: 0.6 }] },
    tinggao: { name: '谨慎的仃高', tier: 'elite', arch: 'guard', size: [14, 12, 108], elem: 'dark', art: ['deElf', { hue: 40, sat: 1.1 }], traits: { sa: 'cast' },
      skills: [{ use: 'swipe', n: 3, reach: 96, dmg: 1.0, cd: [1.8, 2.8], w: 2 }, { use: 'guard', dur: 2.4, reduce: 0.85, cd: [7, 9], counter: { use: 'aoe', shape: 'circle', at: 'self', r: 130, windup: 0.45, dmg: 1.3 } },
        { use: 'aoe', shape: 'cross', at: 'target', hw: 22, windup: 1.2, dmg: 1.2, cd: [8, 11] }] },
    hempley: { name: '沉默的亨普利', tier: 'elite', arch: 'kiter', size: [14, 12, 108], elem: 'dark', art: ['deElf', { hue: 90, sat: 1.1, bright: 0.85 }],
      skills: [{ use: 'shot', mode: 'homing', n: 3, spread: 60, speed: 240, dmg: 0.85, cd: [4, 5.5], w: 1.5 }, { use: 'aoe', shape: 'line', at: 'front', len: 380, hw: 26, windup: 1.1, dmg: 1.2, cd: [6, 8] },
        { use: 'blink', to: 'away', dist: 200, cd: [8, 11], w: 0.6 }] },
    brokenGoliath: { name: '残缺的歌利亚', tier: 'elite', arch: 'guard', size: [22, 16, 150], scale: 0.9, weight: 5, hardness: 40, art: ['deGiant', { sat: 0.3, bright: 0.8 }], traits: { sa: 'cast' },
      skills: [{ use: 'swipe', clip: 'slam', reach: 110, width: 32, windup: 0.7, dmg: 1.3, down: true, sa: true, cd: [2.4, 3.6], w: 2 }, { use: 'grab', reach: 76, hold: 0.9, throwDmg: 1.5, cd: [8, 10] }] },
    // 王的五骑士（王的遗迹，领主房里按官方顺序车轮战）：暗精灵护卫的五种属性染色，各带一个招牌（风 = 隐身、守护 = 反弹，写在车轮战的波次里；冰刃 / 炸弹 / 全屏闪电写在这里）
    knightWind: { name: '风之涡苏', tier: 'elite', arch: 'aggressive', size: [14, 12, 110], speed: 130, art: ['deElf', { hue: -80, sat: 1.1, bright: 1.05 }],
      skills: [{ use: 'swipe', n: 3, reach: 92, dmg: 0.95, cd: [1.6, 2.4], w: 2 }, { use: 'dash', len: 420, speed: 780, windup: 0.8, dmg: 1.2, cd: [4, 6] }] },
    knightGuard: { name: '守护之迈拉', tier: 'elite', arch: 'guard', size: [14, 12, 110], art: ['deElf', { sat: 0.35, bright: 1.1 }], traits: { sa: 'cast' },
      skills: [{ use: 'swipe', n: 2, reach: 92, dmg: 1.0, cd: [1.8, 2.8], w: 2 }, { use: 'guard', dur: 2.6, reduce: 0.85, cd: [7, 9] }, { use: 'buff', kind: 'shield', target: 'allies', amt: 0.15, dur: 8, cd: [16, 22], w: 0.6 }] },
    knightIce: { name: '冰之埃斯顿', tier: 'elite', arch: 'kiter', size: [14, 12, 110], elem: 'ice', art: ['deElf', { hue: -55, sat: 0.8, bright: 1.2 }],
      skills: [{ use: 'shot', mode: 'spread', n: 3, spread: 55, speed: 280, dmg: 0.8, status: 'slow', cd: [4, 5.5], w: 1.5 }, { use: 'aoe', shape: 'circle', at: 'target', r: 70, windup: 1.1, dmg: 1.0, status: 'freeze', sdur: 1.2, cd: [7, 9] },
        { use: 'lanes', kind: 'wave', lanes: 4, hit: 3, windup: 1.1, speed: 600, dmg: 0.9, status: 'freeze', sdur: 1, down: false, col: '#8ad8ff', cd: [10, 13], w: 1.2, say: '冰刃——站进没亮的那一排！' }] },
    knightFire: { name: '炎之古拉德', tier: 'elite', arch: 'aggressive', size: [14, 12, 110], elem: 'fire', art: ['deElf', { hue: 150, sat: 1.4 }], traits: { stacks: { n: 15, dur: 6, r: 100, frac: 0.06, col: '#ff7a3a' } },
      skills: [{ use: 'swipe', n: 2, reach: 92, dmg: 1.0, status: 'burn', cd: [1.8, 2.8], w: 2 }, { use: 'rain', kind: 'hex', n: 3, r: 46, windup: 1.2, dmg: 1.0, col: '#ff7a3a', cd: [8, 11] }] },
    knightLight: { name: '光之沃德咯斯', tier: 'elite', arch: 'guard', size: [14, 12, 110], elem: 'light', art: ['deElf', { hue: 155, sat: 0.7, bright: 1.35 }], traits: { sa: 'cast' },
      skills: [{ use: 'swipe', n: 2, reach: 92, dmg: 1.0, cd: [1.8, 2.8], w: 2 }, { use: 'laser', windup: 1.1, dur: 1.0, sweep: 60, dmg: 0.45, col: '#ffe070', cd: [6, 8] },
        { use: 'lanes', kind: 'bolt', lanes: 6, hit: 5, windup: 1.2, dmg: 1.0, col: '#ffe070', cd: [11, 14], w: 1.2, say: '全屏闪电——找没亮的那一排！' },
        { use: 'summon', kind: 'tombSkeleton', n: 5, max: 5, cd: [18, 24], w: 0.6, say: '光之骑士唤来了五名部下！' }] },
    // 领主机制用的物件 / 小怪（程序画或借已有精灵染色，不用出图）
    morganSkull: { name: '怨念骷髅头', tier: 'swarm', size: [14, 10, 46], obj: { shape: 'bomb', col: '#d8ccb0', h: 46 } },
    spizVictim: { name: '邪龙的牺牲者', tier: 'swarm', arch: 'swarm', size: [12, 10, 88], speed: 165, elem: 'dark', art: ['deGhoul', { hue: 120, sat: 0.45, bright: 0.72 }],
      skills: [{ use: 'explode', r: 85, windup: 0.9, dmg: 1.2, cd: [0.6, 1.2], w: 2 }] },
    nightmareShade: { name: '影之梦魇', tier: 'swarm', arch: 'swarm', size: [18, 13, 72], speed: 170, elem: 'dark', art: ['snTiger', { hue: 200, sat: 0.25, bright: 0.35 }],   // 无头骑士梦魇奔袭的影子（lanes 的 runner），不单独刷
      skills: [{ use: 'dash', clip: 'pounce', len: 320, speed: 720, windup: 0.8, dmg: 1.0, cd: [3, 5] }] },
    searchPriest: { name: '搜捕团祭司', tier: 'elite', arch: 'kiter', size: [14, 12, 104], elem: 'dark', art: ['deElf', { hue: 170, sat: 0.6, bright: 0.75 }],
      skills: [{ use: 'shot', mode: 'homing', n: 2, spread: 50, speed: 230, dmg: 0.85, cd: [3.5, 5], w: 1.6, say: '虚无球', col: '#b890ff' }, { use: 'aoe', shape: 'circle', at: 'target', r: 70, windup: 1.1, dmg: 1.0, status: 'curse', col: '#b890ff', cd: [7, 9] },
        { use: 'buff', kind: 'heal', target: 'allies', r: 500, amt: 0.05, cd: [9, 12], w: 0.8, say: '祭司的祈祷' }] },
    diregieShard: { name: '狄瑞吉的碎片', tier: 'elite', arch: 'aggressive', size: [14, 12, 100], speed: 115, elem: 'dark', art: ['deDiregie', { hue: -30, sat: 1.3, bright: 0.85 }], scale: 0.95, traits: { sa: 'cast' },
      skills: [{ use: 'swipe', n: 2, reach: 100, windup: 0.8, dmg: 1.0, cd: [1.8, 2.8], w: 2 }, { use: 'shot', mode: 'homing', n: 2, spread: 40, speed: 220, dmg: 0.8, status: 'poison', col: '#c0a0ff', cd: [5, 7] }] },
  },

  /* ---- 领主（docs/BOSS_PLAN.md §2 暗精灵：每个领主 ≥2 个官方招牌；大招预警 ≥0.9 秒，都有生路）---- */
  bosses: {
    // 怨恨之摩根（官方 HK66）：死亡诅咒（头顶骷髅标记，1.5 秒后一大片——跳起来 / 离队友远一点）、连扔 3 个骷髅头（到点爆炸，打碎就没事）、
    // 起身震击、被背击喷毒雾；血量过半调配禁忌药剂（打断 → 破招）
    morgan: { name: '怨恨之摩根', lvl: 32, power: 1.35, size: [14, 12, 112], elem: 'dark', art: 'deMorgan', pref: 160,
      traits: { back: { do: { use: 'pool', zone: 'poison', at: 'self', r: 100, windup: 0.9, linger: 5, col: '#c8e070', say: '背后挨打——喷出毒雾！' }, cd: 7 },
        onGetup: { use: 'aoe', shape: 'circle', at: 'self', r: 150, windup: 0.9, dmg: 1.1, col: '#c8e070', say: '起身震击！' } },
      mechs: [{ use: 'groggy', max: 90, dur: 6 }],
      phases: [
        { at: 1, skills: [
          { use: 'swipe', n: 2, reach: 84, windup: 0.95, dmg: 1.0, cd: [1.8, 2.8], w: 2 },
          { use: 'shot', clip: 'throw', mode: 'arc', n: 3, r: 50, dmg: 0.9, status: 'poison', cd: [5, 7], w: 1.4, say: '炼金毒瓶！', col: '#c8e070' },
          { use: 'mark', id: 'curse', clip: 'sigA', mode: 'burst', delay: 1.5, r: 170, dmg: 1.6, jump: true, col: '#b070ff', cd: [11, 14], w: 1.5, say: '死亡诅咒——跳起来，或者离队友远一点！' },
          { use: 'plant', id: 'skulls', clip: 'sigB', kind: 'morganSkull', n: 3, at: 'target', spread: 170, fuse: 4.5, hits: 3, onFuse: 'explode', r: 90, dmg: 1.2, max: 6, label: '骷髅头', col: '#d8ccb0', cd: [15, 19], w: 1.2, say: '骷髅头炸弹——在爆炸前打碎它们！' },
          { use: 'summon', kind: 'corpseThief', n: 2, max: 3, cd: [16, 20], w: 0.7, say: '起来吧，我的仆从……' }] },
        { at: 0.5, enter: { say: '摩根拿出了禁忌药剂！地上冒出了毒沼！', col: '#d8f080', mechs: [DE_MORGAN_BREW, { use: 'hazard', kind: 'fire', every: 5, n: 2, col: '#c8e070' }] },
          skills: [{ use: 'mech', mech: DE_MORGAN_BREW, cd: [24, 30], gap: 14, w: 0.8 }, { use: 'buff', kind: 'haste', target: 'self', dur: 8, cd: [16, 20], say: '更快……更快！' },
            { use: 'summon', kind: 'boneThrower', n: 2, max: 3, cd: [16, 20], w: 0.7 }] },
      ] },
    // 艾克洛索（官方 HK68）：升天后追踪落下（黄圈 + 电流）、弹珠式连续弹射（撞墙反弹，最后一下撞晕自己）、喷网 3 连（束缚）、蜘蛛导弹（跳起躲）、召小蜘蛛
    ekloso: { name: '艾克洛索', lvl: 33, power: 1.5, variantOf: 'poisonSpider', size: [26, 16, 90], weight: 4, speed: 105, art: ['deSpider', { hue: 80, sat: 1.2, bright: 0.8, only: [230, 330] }], scale: 1.9, pref: 110,
      mechs: [{ use: 'groggy', max: 100, dur: 6 }],
      phases: [
        { at: 1, skills: [
          { use: 'swipe', clip: 'bite', reach: 110, width: 30, windup: 0.95, dmg: 1.2, status: 'poison', cd: [1.8, 2.8], w: 2 },
          { use: 'seq', id: 'web3', cd: [8, 11], w: 1.2, say: '喷网三连——被网住就动不了！', steps: [0, 1, 2].map(() => ({ use: 'shot', mode: 'straight', speed: 380, dmg: 0.55, status: 'bind', sdur: 0.8, size: 30, col: '#e8e0ff' })) },
          { use: 'leap', id: 'ascend', clip: 'sigA', crouch: 0.25, up: 0.35, track: 0.5, fall: 0.5, r: 120, hover: 560, dmg: 1.5, status: 'shock', sdur: 3, col: '#ffe070', cd: [12, 15], w: 1.3, say: '艾克洛索升天了——锁定后跑出黄圈！' },
          { use: 'lanes', id: 'missile', kind: 'shot', lanes: 5, hit: 4, windup: 1.0, speed: 900, jump: true, dmg: 1.1, col: '#c8e070', cd: [10, 13], w: 1, say: '蜘蛛导弹——跳起来！', then: { use: 'hold', dur: 1.9, clip: 'roar', col: '#c8e070' } },
          { use: 'summon', kind: 'smallSpider', n: 3, max: 4, cd: [13, 17], w: 0.7 }] },
        { at: 0.65, enter: { say: '艾克洛索躲进了蛛网——击破蜘蛛卵！', col: '#e8e0ff', mechs: [{ use: 'invuln', until: 'crystals', n: 3, name: '蜘蛛卵', hpFrac: 0.03 }] },
          skills: [{ use: 'seq', id: 'pinball', clip: 'sigB', cd: [13, 16], w: 1.3, say: '弹珠弹射——看着红线躲开！', steps: [DE_EKLOSO_BOUNCE(0.2, 1.0), DE_EKLOSO_BOUNCE(0.2, 1.0), DE_EKLOSO_BOUNCE(2, 1.2)] }] },
        { at: 0.35, enter: { col: '#c8e070', mechs: [DE_EKLOSO_VENOM] }, skills: [{ use: 'mech', mech: DE_EKLOSO_VENOM, cd: [22, 28], gap: 12, w: 0.8 }] },
      ] },
    // 邪龙斯皮兹的头部（官方 HK69：被锁链缚住的骨龙巨首，固定不动）：吐“邪龙的牺牲者”（追人自爆）、嘴边毒雾（残留）、锁链成排横扫、吼叫眩晕
    spiz: { name: '邪龙斯皮兹的头部', lvl: 34, power: 1.3, size: [26, 16, 120], weight: 6, speed: 60, elem: 'dark', art: 'deSpiz', scale: 1.3, pref: 150, traits: { sa: 'cast', rooted: true },
      mechs: [{ use: 'groggy', max: 110, dur: 6 }],
      phases: [
        { at: 1, skills: [
          { use: 'swipe', clip: 'bite', reach: 170, width: 38, windup: 0.95, dmg: 1.3, down: true, cd: [2.2, 3.2], w: 2 },
          { use: 'pool', id: 'fog', clip: 'sigB', zone: 'poison', at: 'front', r: 120, windup: 1.0, linger: 7, dmg: 0.8, col: '#b0d060', cd: [9, 12], w: 1.4, say: '邪龙吐出了毒雾——别站在雾里！' },
          { use: 'summon', id: 'victims', clip: 'sigA', kind: 'spizVictim', n: 3, max: 4, cd: [12, 15], w: 1.2, say: '邪龙的牺牲者——在它们扑上来之前打倒！' },
          { use: 'lanes', id: 'chains', kind: 'wave', lanes: 5, hit: 4, windup: 1.1, speed: 900, dmg: 1.2, col: '#a8a8c0', cd: [11, 14], w: 1, say: '锁链横扫——站进没亮的那一排！', then: { use: 'hold', dur: 2.0, clip: 'roar', col: '#a8a8c0' } }] },
        { at: 0.6, enter: { col: '#e8d8ff', mechs: [DE_SPIZ_ROAR] },
          skills: [{ use: 'mech', mech: DE_SPIZ_ROAR, cd: [24, 30], w: 0.8 },
            { use: 'pull', id: 'roar', mode: 'out', r: 320, force: 240, windup: 1.0, dur: 0.8, status: 'stun', sdur: 1, dmg: 0.5, col: '#e8d8ff', cd: [13, 16], say: '邪龙的吼叫——眩晕！' }] },
        { at: 0.3, enter: { say: '墓室里弥漫起瘴气……', col: '#9a80c0', mechs: [{ use: 'arena', kind: 'fog', r: 300, dur: 20, col: '#9a80c0', say: '瘴气遮住了视线——邪龙就在锁链中间！' }] } },
      ] },
    // 熔岩穴三兄弟（官方 HK67）：歌利亚（火，低血召吞灵者 / 燃烧之赫拉）、泰坦（眩晕，低血钢铁之躯）、阿特拉斯（撒网束缚 / 减速，低血暴走）同场，
    // 三条血条，倒下一个其余暴怒（duo）；歌利亚捶开地面 → 熔岩地砖
    goliath: { name: '歌利亚', lvl: 35, size: [22, 16, 150], weight: 6, speed: 70, elem: 'fire', art: 'deGiant', scale: 1.2, pref: 110, traits: { sa: 'cast' },
      mechs: [{ use: 'groggy', max: 110, dur: 6 }, { use: 'duo', with: ['titan', 'atlas'], hp: 0.4, onPartnerDown: 'enrage', atk: 1.25, speed: 1.2, col: '#ff8a4a', say: '熔岩三兄弟一起上了——倒下一个，剩下的就会暴怒！' }],
      phases: [
        { at: 1, skills: [
          { use: 'swipe', clip: 'slam', reach: 124, width: 34, windup: 0.95, dmg: 1.4, down: true, sa: true, cd: [2.2, 3.2], w: 2 },
          { use: 'grab', reach: 84, hold: 0.9, windup: 0.95, throwDmg: 1.6, cd: [8, 10] },
          { use: 'pool', id: 'magma', clip: 'sigA', zone: 'fire', at: 'target', n: 3, scatter: 150, r: 64, windup: 1.1, linger: 4, dmg: 1.0, frac: 0.015, tick: 0.6, col: '#ff7a2a', cd: [9, 12], w: 1.3, say: '熔岩喷涌——别踩进岩浆！' },
          { use: 'aoe', shape: 'circle', at: 'self', r: 170, windup: 1.2, dmg: 1.3, jump: true, col: '#ff8a4a', cd: [10, 13], say: '震地——跳起来！' }] },
        { at: 0.55, enter: { say: '歌利亚捶开了地面——熔岩在沸腾！', col: '#ff8a4a', mechs: [DE_LAVA_FLOOR] }, skills: [{ use: 'mech', mech: DE_LAVA_FLOOR, cd: [30, 36], gap: 14, w: 0.6 }] },
        { at: 0.3, enter: { say: '歌利亚召来了火焰的仆从！', col: '#ff6a3a', summon: { kind: 'soulEater', n: 1 } }, skills: [{ use: 'summon', kind: 'burningHera', n: 2, max: 3, cd: [13, 17], w: 0.7 }] },
      ] },
    titan: { name: '泰坦', lvl: 35, size: [22, 16, 150], weight: 6, speed: 80, elem: 'fire', art: ['deGiant', { hue: 25, sat: 1.1 }], scale: 1.1, pref: 90, traits: { sa: 'cast' },
      mechs: [{ use: 'groggy', max: 70, dur: 5 }],
      phases: [
        { at: 1, skills: [
          { use: 'swipe', clip: 'slam', reach: 112, width: 32, windup: 0.95, dmg: 1.3, down: true, status: 'stun', sdur: 1, cd: [2.4, 3.4], w: 2 },
          { use: 'pull', id: 'titanRoar', mode: 'out', r: 300, force: 260, windup: 1.0, dur: 0.8, status: 'stun', sdur: 1.2, dmg: 0.5, col: '#ffb070', cd: [12, 15], w: 1.4, say: '泰坦的怒吼——眩晕！' }] },
        { at: 0.4, enter: { col: '#ffb070', mechs: [{ use: 'stance', every: [999, 999], modes: [{ id: 'iron', name: '钢铁之躯', col: '#ffb070', dmgTaken: 0.75, say: '泰坦进入了钢铁之躯——受到的伤害降低！' }] }] } },
      ] },
    atlas: { name: '阿特拉斯', lvl: 35, size: [22, 16, 150], weight: 6, speed: 75, elem: 'fire', art: ['deGiant', { hue: 190, sat: 0.5, bright: 0.8 }], scale: 1.05, pref: 150, traits: { sa: 'cast' },
      mechs: [{ use: 'groggy', max: 70, dur: 5 }],
      phases: [
        { at: 1, skills: [
          { use: 'swipe', clip: 'slam', reach: 110, width: 32, windup: 0.95, dmg: 1.3, down: true, cd: [2.4, 3.4], w: 2 },
          { use: 'aoe', id: 'net', shape: 'circle', at: 'target', r: 90, windup: 1.0, dmg: 0.6, status: 'bind', sdur: 1.8, col: '#c8b890', cd: [9, 12], w: 1.4, say: '阿特拉斯撒网——被网住就动不了！' },
          { use: 'pool', zone: 'slow', at: 'target', n: 2, scatter: 120, r: 70, windup: 1.0, linger: 6, dmg: 0.5, col: '#c8b890', cd: [12, 15], say: '满地都是网！' }] },
        { at: 0.35, enter: { col: '#ff5a3a', mechs: [{ use: 'enrage', t: 1, atk: 1.3, speed: 1.35, say: '暴走了！' }] } },
      ] },
    // 不灭之王 波罗丁（官方 HK72）：王的五骑士车轮战（风 隐身 / 守护 红蓝反弹 / 冰 冰刃 / 炎 叠炸弹 / 光 全屏闪电）→ 本人：眩晕连击、三连震（跳三次）、
    // 炎与冰的法阵、不灭之王护盾
    boroding: { name: '不灭之王 波罗丁', lvl: 36, power: 1.4, size: [18, 14, 132], weight: 5, speed: 115, elem: 'dark', art: 'deBoroding', scale: 1.15, pref: 100, traits: { sa: 'cast' },
      mechs: [{ use: 'groggy', max: 110, dur: 6 }, DE_BORO_KNIGHTS],
      phases: [
        { at: 1, skills: [
          { use: 'swipe', clip: 'slam', n: 2, reach: 120, width: 34, windup: 0.95, gap: 0.3, dmg: 1.2, status: 'stun', sdur: 0.6, sa: true, cd: [2.4, 3.4], w: 2 },
          { use: 'seq', id: 'quake3', cd: [11, 14], w: 1.4, say: '三连震——跳三次！', steps: [
            { use: 'aoe', sig: '三连震', clip: 'sigA', shape: 'circle', at: 'self', r: 190, windup: 1.0, dmg: 1.1, jump: true, col: '#c8a0ff' },
            { use: 'aoe', sig: '三连震', clip: 'sigA', shape: 'circle', at: 'self', r: 250, windup: 0.6, dmg: 1.1, jump: true, col: '#c8a0ff' },
            { use: 'aoe', sig: '三连震', clip: 'sigA', shape: 'circle', at: 'self', r: 310, windup: 0.6, dmg: 1.2, jump: true, col: '#c8a0ff' }] },
          { use: 'aoe', clip: 'sigB', shape: 'cross', at: 'target', hw: 26, windup: 1.2, dmg: 1.3, col: '#c8a0ff', cd: [7, 9], w: 1.3, say: '裂地锤' }] },
        { at: 0.6, enter: { say: '波罗丁唤醒了炎与冰的骑士之力——站进相反颜色的法阵再打！', mechs: [{ use: 'element', modes: ['fire', 'ice'], every: 12, mul: 0.4 }] } },
        { at: 0.3, enter: { col: '#c8a0ff', mechs: [DE_BORO_UNDYING] } },
      ] },
    // 无头骑士（官方 HK70）：全程霸体；影之梦魇沿纵深奔袭（留一排缺口）；冲撞把人顶到墙边多段；低血满图狂奔回血（输出检查）↔ 喘息；濒死几秒打不动
    // 骑乘图已接上，步战 deHeadless 仍留给瘟疫精英。
    headlessKnight: { name: '无头骑士', lvl: 37, power: 1.5, size: [16, 14, 128], speed: 125, elem: 'dark', art: 'deHeadless_rider', scale: 1.15, pref: 150, hook: 'headless', traits: { sa: 'always' },
      mechs: [{ use: 'groggy', max: 120, dur: 5 }],
      phases: [
        { at: 1, skills: [
          { use: 'swipe', n: 2, reach: 108, width: 24, windup: 0.95, dmg: 1.1, cd: [1.8, 2.6], w: 2 },
          { use: 'dash', id: 'ram', clip: 'sigA', carry: true, speed: 760, windup: 1.0, hw: 26, dmg: 1.3, col: '#b890ff', cd: [8, 11], w: 1.4, say: '冲锋——别被顶到墙上！' },
          { use: 'lanes', id: 'nightmare', clip: 'sigB', kind: 'runner', runner: 'nightmareShade', lanes: 5, hit: 4, speed: 900, windup: 1.1, dmg: 1.3, col: '#b890ff', cd: [12, 15], w: 1.2, say: '影之梦魇奔袭——站进没亮的那一排！', then: { use: 'hold', dur: 2.0, clip: 'roar', col: '#b890ff' } }] },
        { at: 0.6, enter: { say: '无头骑士召来了更多的梦魇！', col: '#b890ff' },
          skills: [{ use: 'lanes', id: 'nightmare2', kind: 'runner', runner: 'nightmareShade', lanes: 6, hit: 5, speed: 950, windup: 1.1, dmg: 1.2, col: '#b890ff', cd: [16, 20], w: 1, say: '梦魇群奔袭——只剩一排缺口！', then: { use: 'hold', dur: 1.9, clip: 'roar', col: '#b890ff' } }] },
        { at: 0.35, enter: { col: '#b890ff', mechs: [DE_HEADLESS_GALLOP] } },
        { at: 0.15, enter: { say: '无头骑士在濒死中挣扎——几秒内打不动它！', col: '#e8d8ff', mechs: [{ use: 'invuln', until: 'survive', survive: 3.5, hide: false, col: '#e8d8ff' }] } },
      ] },
    // 狄瑞吉的幻影（官方 HK73）：流动之躯（吞噬 → 爆开）、瘟疫孢子；搜捕团祭司（两个互相复活）；瘟疫爆发（远离）；低血分裂成 3 块（共享击杀，钩子 split）
    diregie: { name: '狄瑞吉的幻影', tier: 'raid', lvl: 39, power: 1.8, size: [18, 15, 130], speed: 95, elem: 'dark', art: 'deDiregie', scale: 1.4, pref: 140,
      mechs: [{ use: 'groggy', max: 120, dur: 7, mul: 1.6 }],
      phases: [
        { at: 1, skills: [
          { use: 'swipe', n: 2, reach: 116, width: 28, windup: 0.95, dmg: 1.1, cd: [1.8, 2.6], w: 1.6 },
          { use: 'pull', id: 'engulf', clip: 'sigA', mode: 'in', r: 420, force: 230, windup: 1.1, dur: 1.4, dmg: 0.4, col: '#b890ff', cd: [13, 16], w: 1.4, say: '流体吞噬——往外跑！',
            then: { use: 'aoe', shape: 'circle', at: 'self', r: 160, windup: 0.9, dmg: 1.5, status: 'poison', col: '#b890ff' } },
          { use: 'pool', id: 'spores', clip: 'sigB', zone: 'poison', at: 'target', n: 3, scatter: 160, r: 70, windup: 1.1, linger: 7, dmg: 0.8, col: '#c8b860', cd: [10, 13], w: 1.2, say: '瘟疫孢子——别站在毒雾里！' },
          { use: 'summon', kind: 'fierceZombie', n: 2, max: 3, cd: [16, 20], w: 0.7, say: '被感染的人们……' }] },
        { at: 0.72, enter: { col: '#d8c880', mechs: [DE_NEIPERA_PRIESTS] } },
        { at: 0.5, enter: { col: '#d8c880', mechs: [DE_NEIPERA_BURST] },
          skills: [{ use: 'mech', mech: DE_NEIPERA_BURST, cd: [24, 30], w: 0.7 }] },
        { at: 0.28, enter: { col: '#c0a0ff', mechs: [DE_DIREGIE_SPLIT] } },
      ] },
  },

  /* ---- 史诗（区域掉落）+ 深渊专属（abyss: true）---- */
  items: {
    epics: [
      { key: 'ep_de_morgan', slot: 'support', lvl: 32, name: '摩根的炼金毒瓶', fx: { dmgUp: 0.11, allStat: 18 },
        proc: { chance: 0.06, cd: 2, act: 'status', status: 'poison', dur: 4, name: '炼金剧毒', desc: '攻击时 6% 几率让敌人中毒 4 秒。' }, desc: '怨恨之摩根到死都攥在手里的毒瓶。他本想用它找出传染病的解药。',
        look: 'a round alchemist flask with a long thin neck full of bubbling violet liquid, a skull-shaped cork and a small brass label, dark elf style silver filigree' },
      { key: 'ep_de_cross', slot: 'stone', lvl: 38, name: '燃烧之血十字架', fx: { fire: 30, dark: 20, dmgUp: 0.08 }, desc: '诺伊佩拉的祭坛上燃烧的血色十字架（官方远古地下城「诺伊佩拉」的专属神器）。',
        look: 'a small blood red crystal cross wrapped in dark flames at its edges, set in a blackened silver frame' },
    ],
    sets: [
      // 深渊专属（暗黑城深渊）：官方诺伊佩拉用格拉西亚家族徽章兑换的「格拉西亚家族遗物」（官方是防具套，本作做成首饰）
      { id: 'set_gracia', name: '格拉西亚家族遗物', lvl: 38, abyss: true, desc: '诺伊佩拉的名门格拉西亚家族留下的遗物，家徽是一头獠牙野猪。',
        bonus: { 2: { st: { crit: 0.05, mcrit: 0.05, aspd: 0.05, cspd: 0.05 }, desc: '暴击率 +5%，攻击 / 施放速度 +5%' },
          3: { st: { dmgUp: 0.13, critDmg: 0.1 }, desc: '【家族荣耀】伤害增加 13%，暴击伤害 +10%；攻击时 5% 几率唤来格拉西亚家族的守护灵（周围 150% 光属性伤害）',
            proc: { chance: 0.05, cd: 1.5, act: 'strike', mul: 1.5, aoe: 110, elem: 'light', vis: 'holy', name: '家族守护灵' } } },
        pieces: [
          { key: 'ep_de_gracia_neck', slot: 'neck', name: '格拉西亚家族项链', look: 'an old silver necklace with a round pendant engraved with a tusked boar crest and a violet gem' },
          { key: 'ep_de_gracia_bracelet', slot: 'bracelet', name: '格拉西亚家族手镯', look: 'a wide dark silver bangle engraved with a tusked boar crest and small violet gems' },
          { key: 'ep_de_gracia_ring', slot: 'ring', name: '格拉西亚家族戒指', look: 'a heavy silver signet ring with a tusked boar crest on a violet stone' },
        ] },
    ],
    quest: [{ key: 'q_de_letter', look: 'a sealed old letter with a broken dark violet wax seal and smudged unreadable ink' }],
  },

  /* ---- 地下城 ---- */
  dungeons: {
    shallow_haunt: { name: '浅栖之地', lvl: [31, 32], theme: 'deCave', layout: 'standard', mobs: [['corpseThief', 3], ['boneThrower', 2], ['ghost', 2], ['binness', 1.5]], elite: 'boneThrower', boss: 'morgan', bgm: 'dungeon2', bossBgm: 'boss',
      gate: { x: 420, col: '140,190,255' }, desc: '暗精灵的炼金大师摩根为了找出传染病的来源独自进了这里，再也没有回来。头顶出现骷髅诅咒时跳起来或离队友远一点；骷髅头炸弹要在爆炸前打碎；从背后打他会喷毒雾。血量过半后他会调配禁忌药剂——打断他。',
      drops: { boss: [['ep_de_morgan', 0.03]], mats: [['crystal', 0.1, 8], ['m_bone', 0.03, 2], ['c_blue', 0.02, 1]] } },
    spider_cave: { name: '蜘蛛洞穴', lvl: [32, 33], theme: 'deCave', layout: 'long', mobs: [['poisonSpider', 3], ['smallSpider', 2], ['wraith', 1.5], ['fierceZombie', 1.5], ['corpseThief', 1], ['binness', 1]], elite: 'poisonSpider', boss: 'ekloso', bgm: 'dungeon3', bossBgm: 'boss',
      gate: { x: 900, col: '200,190,255' }, desc: '被传染病感染的巨大蜘蛛盘踞的洞穴。艾克洛索升天后会追着你落下（锁定后跑出黄圈），蜘蛛导弹要跳起来躲；它躲进蛛网时先击破蜘蛛卵；之后会像弹珠一样撞墙反弹。',
      drops: { boss: [['ep_de_morgan', 0.012]], mats: [['crystal', 0.1, 8], ['m_leather', 0.03, 2], ['c_white', 0.02, 1]] } },
    darkelf_tomb: { name: '暗精灵墓地', lvl: [33, 34], theme: 'deTomb', layout: 'standard', mobs: [['tombSkeleton', 3], ['rockSkeleton', 1.5], ['ghost', 1.5], ['wraith', 1.5], ['soulEater', 0.6]], elite: 'rockSkeleton', boss: 'spiz', bgm: 'dungeon2', bossBgm: 'boss',
      gate: { x: 1380, col: '190,160,255' }, desc: '暗精灵的墓地，贝尔玛尔公国的大使在这里失踪了。墓地深处，邪龙斯皮兹的头被锁链缚在墓室里，一步也动不了：它吐出的牺牲者会追着人自爆，毒雾会留在地上；锁链横扫时站进没亮的那一排，咆哮时站进白色光圈。',
      bossProps: [{ kind: 'chain', x: 0.66, y: 0.2, col: '#8a8aa0' }, { kind: 'chain', x: 0.9, y: 0.2, col: '#8a8aa0' }, { kind: 'chain', x: 0.7, y: 0.86, h: 120, col: '#8a8aa0' }, { kind: 'bones', x: 0.55, y: 0.12 }],
      drops: { boss: [['ep_de_morgan', 0.008]], mats: [['crystal', 0.11, 9], ['m_bone', 0.04, 2], ['c_black', 0.02, 1]] } },
    lava_cave: { name: '熔岩穴', lvl: [34, 35], theme: 'deLava', layout: 'long', mobs: [['lavaThief', 2.5], ['boneThrower', 1.5], ['fierceZombie', 1.5], ['burningHera', 2], ['soulEater', 0.5]], elite: 'barrelOrik', boss: 'goliath',
      bgm: 'dungeon', bossBgm: 'boss', preBoss: { kind: 'barrelOrik', say: '油桶欧力克扛着油桶冲出来了！' },
      gate: { x: 1860, col: '255,140,90' }, desc: '和火焰圣地的地脉相连的熔岩洞穴。歌利亚、泰坦、阿特拉斯三兄弟一起守在最深处（三条血条，全部打倒才算赢）：倒下一个，剩下的就会暴怒——尽量一起打低再收掉。泰坦的怒吼会眩晕，阿特拉斯会撒网；歌利亚捶开地面后，闪烁的地砖马上会变烫。',
      drops: { boss: [['ep_de_morgan', 0.012]], mats: [['crystal', 0.11, 9], ['c_red', 0.03, 2], ['m_iron', 0.03, 2]] } },
    king_ruins: { name: '王的遗迹', lvl: [35, 36], theme: 'deTomb', layout: 'raid', hidden: true, unlock: { quest: 'q_de09' },
      mobs: [['tombSkeleton', 2], ['rockSkeleton', 1], ['wraith', 1.5], ['knightWind', 0.3], ['knightGuard', 0.3], ['knightIce', 0.3], ['knightFire', 0.3]], elite: 'knightLight', boss: 'boroding', bossAdds: 0,
      bossTheme: 'deKingBoss', bossProps: [{ kind: 'throne', x: 0.9, y: 0.12, h: 190, col: '#6a5a8a' }, { kind: 'pillar', x: 0.1, y: 0.1, h: 200, col: '#5a5070' }, { kind: 'pillar', x: 0.5, y: 0.1, h: 200, col: '#5a5070' }],
      bgm: 'dungeon3', bossBgm: 'boss', preBoss: { kind: 'rockSkeleton', say: '岩石骷髅守着王座厅的大门……' },
      gate: { x: 2340, col: '200,160,255' }, desc: '【隐藏】暗精灵古代王国的遗迹。不灭之王 波罗丁坐在王座上，先让王的五骑士轮流上前：风之骑士会隐身，守护骑士的红光反弹物理、蓝光反弹魔法，冰之骑士的冰刃会冻住脚，打炎之骑士会在自己身上叠炸弹，光之骑士会降下全屏闪电。波罗丁亲自出手后，三连震要跳三次；他在炎与冰之间切换时站进相反颜色的法阵里打；“不灭之王”的护盾要尽快打碎。',
      drops: { boss: [['ep_de_cross', 0.012]], mats: [['crystal', 0.12, 10], ['m_soul', 0.003, 1], ['m_obsidian', 0.006, 1]] } },
    darkcity_gate: { name: '暗黑城入口', lvl: [36, 37], theme: 'deGate', layout: 'long', mobs: [['darkElfGuard', 3], ['headlessThief', 2], ['headlessSkel', 2], ['brokenGoliath', 0.6]], elite: 'tinggao', boss: 'headlessKnight',
      bgm: 'dungeon2', bossBgm: 'boss', preBoss: { kind: 'hempley', say: '沉默的亨普利挡住了去路。' },
      gate: { x: 2820, col: '170,140,255' }, desc: '暗精灵首都的大门。无头骑士一直霸体：冲锋前地上有红线，被撞中会被一路顶到墙上；影之梦魇奔袭时站进没亮的那一排。血量很低时它会满场狂奔回血——打得比它回得快，它停下来喘息时是好机会。',
      drops: { boss: [['ep_de_cross', 0.01], ['ep_de_morgan', 0.01]], mats: [['crystal', 0.12, 10], ['m_elem2', 0.01, 1], ['c_black', 0.03, 2]] } },
    neipera: { name: '诺伊佩拉', lvl: [38, 38], bossLvl: 40, theme: 'deNeipera', layout: 'raid', mobs: [['fierceZombie', 2], ['wraith', 1.5], ['soulEater', 1], ['poisonSpider', 1], ['darkElfGuard', 1]], elite: 'soulEater', boss: 'diregie', bossAdds: 0,
      bgm: 'abyss', bossBgm: 'boss', preBoss: { kind: 'brokenGoliath', say: '被感染的巨人守着城镇的深处……' },
      gate: { x: 3300, col: '220,200,140' }, desc: '【远古】被瘟疫吞没的暗精灵城镇。狄瑞吉的幻影会把人吸过去再炸开（往外跑），孢子会在地上留下毒雾；搜捕团的两名祭司会互相复活，要在 8 秒内一起打倒；“瘟疫爆发”时远离它。血量很低时它会分裂成三块碎片——10 秒内全部打倒，否则会重新凝聚。',
      drops: { boss: [['ep_de_cross', 0.04], ['ep_de_morgan', 0.02]], mats: [['crystal', 0.14, 12], ['m_soul', 0.004, 1], ['m_diamond', 0.01, 1]] } },
  },

  /* ---- 深渊派对（content/abyss.js 展开，见 docs/REGION_PIPELINE.md §2.1）---- */
  abyss: {
    abyss_darkelf: { name: '暗黑城深渊', from: 'darkcity_gate', theme: 'abyssDarkelf', tint: 'rgba(80,10,120,0.34)', lvl: [37, 38], lordLvl: 40, cost: 1, pity: 7,
      lords: ['morgan', 'ekloso', 'spiz', 'headlessKnight'], gate: { x: 4060, scene: 'darkelf_field' }, clearExp: 16000,
      waves: [
        { n: 6, mobs: [['headlessThief', 1], ['headlessSkel', 1], ['corpseThief', 1]], elite: 1, say: '无头的尸群涌上来了！' },
        { n: 5, mobs: [['ghost', 1], ['wraith', 1], ['binness', 1]], elites: ['soulEater'], say: '吞灵者在吸取灵魂——先打它！' },
        { n: 6, mobs: [['darkElfGuard', 2], ['poisonSpider', 1]], elites: ['tinggao', 'hempley'], say: '仃高和亨普利也来了！' },
      ],
      lord: { mechs: [{ use: 'enrage', t: 220 }], cycle: [{ every: [22, 28], at: 0.8, say: '深渊护盾！', mech: { use: 'shield', hp: 0.05, dur: 12, punish: 'heal', onBreak: 'groggy', col: '#c890ff' } },
        { every: [28, 34], at: 0.5, mech: { use: 'safezone', windup: 3.2, frac: 0.35, say: '深渊之力——站进光圈！' } }] },
      desc: '【深渊派对】暗黑城入口背后的深渊裂缝。需要消耗 1 张深渊派对邀请函。深渊领主是暗黑城的四个领主之一（每次随机），会张开深渊护盾——打破护盾就能破招。「格拉西亚家族遗物」只在这里出现。',
      quest: { name: '暗黑城的深渊', lvl: 37, clear: 'darkcity_gate', pre: ['q_abyss_gf'], gold: 6000, desc: '暗黑城入口的背后也裂开了深渊。通关暗黑城入口，歌兰蒂斯就会告诉你暗黑城深渊的入口。',
        offer: ['暗精灵的地下王国……深渊也渗进去了。', '听说诺伊佩拉的名门格拉西亚家族的遗物，就沉在那道深渊里。', '先去通关暗黑城入口吧。'],
        done: ['你回来了。暗精灵地区的最右边，深渊之门已经打开。'] } },
  },

  /* ---- NPC / 场景 ---- */
  npcs: {
    kurent: { name: '克伦特', title: '暗精灵使者', h: 120, services: ['quest'],
      greet: ['人类的冒险家……你愿意听一个暗精灵说话吗？'], lines: ['传染病不是人类带来的。我必须让王国明白这一点。', '暗黑城的怪物和我们签过契约，它们只认力量。', '战争一旦开始，就停不下来了。'],
      look: 'Kurent, a calm dark elf envoy man in his thirties: grey-violet skin, long pointed ears, long silver hair tied back, golden eyes, an elegant long dark indigo coat with silver crescent moon embroidery, a short cape, holding a rolled scroll' },
    bryce: { name: '布莱斯', title: '暗精灵战士 · 修理 / 仓库', h: 112, services: ['repair', 'storage'],
      greet: ['要下暗黑城？装备先修好再说。'], lines: ['我姐姐加尔在前线。我替她守着营地。', '熔岩穴的地面会烫伤人，别在熔岩上停太久。'],
      look: 'Bryce, a young dark elf warrior woman: grey-violet skin, long pointed ears, short white hair, amber eyes, practical dark leather armor with a violet scarf, a curved sword at her hip, a confident smile' },
  },
  scenes: {
    aferia_camp: { name: '阿法利亚营地', area: '营地', kind: 'town', width: 2400, theme: 'deCamp', bgm: 'westcoast', ambient: 'magic', map: [14, 33],
      props: [{ art: 'world/p_crates', x: 420, h: 80, y: 30 }, { art: 'world/p_magiclamp', x: 700, h: 110, y: 20 }, { art: 'world/p_magiclamp', x: 1700, h: 110, y: 20 }, { art: 'world/p_crates', x: 2040, h: 80, y: 40 }],
      npcs: [{ npc: 'kurent', x: 980, y: 50 }, { npc: 'bryce', x: 1420, y: 60 }],
      exits: [{ side: 'left', to: 'west_coast' }, { side: 'right', to: 'darkelf_field' }] },
    darkelf_field: { name: '暗精灵地区', area: '暗黑城', kind: 'field', width: 4300, theme: 'deCave', bgm: 'field', map: [3, 38],
      exits: [{ side: 'left', to: 'aferia_camp' }] },
  },

  /* ---- 主线 ---- */
  story: { chapter: '暗黑城篇 · 暗精灵的传染病', prefix: 'q_de', pre: 'q_b09', npc: 'kurent', scene: 'aferia_camp', steps: [
    { t: 'arrive', npc: 'sharan', to: 'kurent', name: '前往阿法利亚营地', lvl: 31, scene: 'aferia_camp', reward: { exp: 0.05, gold: 1500 },
      desc: '暗精灵向贝尔玛尔公国宣战了。去西海岸北边的阿法利亚营地，找暗精灵的使者克伦特。',
      talk: { offer: ['暗精灵的城镇爆发了传染病……他们认为那是人类带来的，已经向公国宣战了。', '阿法利亚营地有一位暗精灵的使者，叫克伦特。他想阻止这场战争。去帮帮他吧。'], doing: ['阿法利亚营地在西海岸的北边，Lv.31 才能过去。'], done: ['……莎兰派你来的？', '我是克伦特。暗精灵和人类的战争一触即发——我需要一个能在暗黑城里活下来的人。'] } },
    { t: 'clear', dungeon: 'shallow_haunt', lvl: 31, name: '浅栖之地', reward: { exp: 0.09, gold: 2500 },
      desc: '暗黑城的第一层是「浅栖之地」。通关它，证明你能在地下活下来。',
      talk: { offer: ['暗黑城的入口就在营地后面的山洞里。第一层叫浅栖之地。', '我们的炼金大师摩根为了找出传染病的来源，一个人进去了……再也没有回来。'], doing: ['浅栖之地在暗精灵地区的最左边。'], done: ['你活着回来了。……里面有摩根的气息吗？'] } },
    { t: 'boss', dungeon: 'shallow_haunt', lvl: 32, name: '没有送出的信', collect: { key: 'q_de_letter', item: '无法读取的摩根信函', icon: 'q_de_letter', desc: '封蜡碎了一半，字迹被毒液晕开的信。' }, reward: { exp: 0.1, gold: 3000 },
      desc: '摩根被感染成了“怨恨之摩根”。打倒他，把他身上那封没有送出的信带回来。',
      talk: { offer: ['摩根……他被感染了。现在只剩下怨恨。', '他身上应该有一封信——他一直想把研究结果送出来。'], doing: ['他会扔毒瓶。看到地上发绿就走开。', '头顶冒出骷髅的时候，跳起来。'], done: ['信上的字被毒液晕开了……但我认得这几个词：“蜘蛛”“污染”。'] } },
    { t: 'clear', dungeon: 'spider_cave', lvl: 32, name: '调查蜘蛛洞穴', reward: { exp: 0.09, gold: 2500 },
      desc: '摩根的信里提到了蜘蛛。通关「蜘蛛洞穴」。',
      talk: { offer: ['信里提到了蜘蛛洞穴。那里的蜘蛛……最近变得很奇怪。'], doing: ['蛛网会让你变慢，别站在原地。'], done: ['洞穴深处有一只巨大的蜘蛛——艾克洛索。'] } },
    { t: 'boss', dungeon: 'spider_cave', lvl: 33, name: '被污染的艾克洛索', reward: { exp: 0.1, gold: 3000 },
      desc: '蜘蛛洞穴深处的艾克洛索被传染病污染了。打倒它。',
      talk: { offer: ['艾克洛索是和我们签过契约的守护兽……它被污染了。', '它躲进蛛网的时候，先打碎蜘蛛卵。'], doing: ['它在蛛网茧里积蓄毒液的时候，全力打断它；打不断就跳起来。'], done: ['它身上的毒……和城镇里的传染病一模一样。'] } },
    { t: 'clear', dungeon: 'darkelf_tomb', lvl: 33, name: '失踪的大使', reward: { exp: 0.09, gold: 2500 },
      desc: '贝尔玛尔公国派来的大使在暗精灵墓地失踪了。通关「暗精灵墓地」，找到他的踪迹。',
      talk: { offer: ['公国派来谈和的大使在墓地失踪了。', '如果他死在暗精灵的地盘上……战争就再也停不下来了。'], doing: ['墓地里的骷髅会架起盾牌，别打它的正面。'], done: ['大使还活着……他躲在墓地深处，说是被一条邪龙逼进去的。'] } },
    { t: 'boss', dungeon: 'darkelf_tomb', lvl: 34, name: '存在的邪龙', reward: { exp: 0.1, gold: 3000 },
      desc: '墓地深处，被锁链缚住的邪龙斯皮兹的头部挡住了大使回来的路。打倒它。',
      talk: { offer: ['邪龙斯皮兹……传说中它的身体被封印在更深的地方，露出来的只是一部分。', '它咆哮的时候，站进白色的光圈。'], doing: ['龙息会横扫整个房间。'], done: ['大使回来了。……他说，传染病是从熔岩穴的方向传过来的。'] } },
    { t: 'clear', dungeon: 'lava_cave', lvl: 34, name: '通向暗黑城之路', reward: { exp: 0.09, gold: 2500 },
      desc: '通往暗精灵首都的路要经过「熔岩穴」。通关它。',
      talk: { offer: ['要去首都，得穿过熔岩穴。那里和火焰圣地的地脉相连。'], doing: ['别在熔岩上停太久。'], done: ['最深处……有三个巨人。'] } },
    { t: 'boss', dungeon: 'lava_cave', lvl: 35, name: '强悍的证明', reward: { exp: 0.1, gold: 3000 },
      desc: '熔岩穴深处的巨人三兄弟——歌利亚、泰坦、阿特拉斯挡住了去路。打倒他们。',
      talk: { offer: ['三兄弟会一起上：歌利亚、泰坦、阿特拉斯。', '倒下一个，剩下的就会暴怒——别只盯着一个打死，尽量一起打低再收掉。'], doing: ['震地的时候跳起来。地砖一闪就换个地方站。'], done: ['巨人倒下了。……王国的古老传说里，还有一位“不灭之王”。'] } },
    { t: 'clear', dungeon: 'king_ruins', lvl: 35, name: '王的五骑士', reward: { exp: 0.1, gold: 3500 },
      desc: '暗精灵古代王国的遗迹出现了。除掉守在遗迹里的王的五骑士，通关「王的遗迹」。',
      talk: { offer: ['古代王国的遗迹……王的五骑士还守在那里。', '暗精灵的冤魂都在遗迹里游荡，这是它们的王留下的诅咒。'], doing: ['遗迹的入口是隐藏的——在暗精灵地区，靠右的地方。'], done: ['五骑士的影子还守在王座厅里……不灭之王 波罗丁也还在。'] } },
    { t: 'boss', dungeon: 'king_ruins', lvl: 36, name: '伟大的波罗丁王', reward: { exp: 0.12, gold: 4000 },
      desc: '打倒不灭之王 波罗丁，让遗迹里的冤魂安息。',
      talk: { offer: ['他会先让王的五骑士一个一个上前。', '波罗丁会在炎与冰之间切换。站进相反颜色的法阵里再打。', '他喊出“不灭之王”的时候会张开护盾——快打碎它。'], doing: ['他的锤子砸下来之前，地上会出现十字。三连震要跳三次。'], done: ['冤魂安息了。……首都的大门，就在前面。'] } },
    { t: 'clear', dungeon: 'darkcity_gate', lvl: 36, name: '调查暗黑城入口', reward: { exp: 0.09, gold: 3000 },
      desc: '通关「暗黑城入口」。',
      talk: { offer: ['暗黑城入口的守卫都被感染了。仃高和亨普利……他们曾经是我的战友。'], doing: ['亨普利会瞬移到远处放魔法，贴上去打。'], done: ['大门前面站着一个没有头的骑士。'] } },
    { t: 'boss', dungeon: 'darkcity_gate', lvl: 37, name: '最后的决斗', reward: { exp: 0.12, gold: 4000 },
      desc: '无头骑士守着暗黑城的大门。打倒它，开启暗黑城之门。',
      talk: { offer: ['无头骑士一直是霸体。冲锋之前地上有红线——看准了再躲。', '它召来的影之梦魇会一排一排地冲过来——站进没亮的那一排。'], doing: ['别在它冲锋的直线上停留。它狂奔回血的时候别停手。'], done: ['门开了。……可是首都里，一个人都没有。', '所有人都逃到了诺伊佩拉——传染病最早爆发的地方。'] } },
    { t: 'raid', dungeon: 'neipera', lvl: 38, name: '狄瑞吉的幻影', reward: { exp: 0.18, gold: 7000, coins: 2 },
      desc: '传染病的源头在诺伊佩拉。进入被瘟疫吞没的城镇，打倒狄瑞吉的幻影。',
      talk: { offer: ['传染病的源头……是使徒狄瑞吉留下的幻影。', '搜捕团的祭司会互相复活——两个要一起打倒。', '“瘟疫爆发”的时候，离它越远越好。'], doing: ['孢子落地的地方别站。', '它分裂的时候，把碎片一起打倒。'], done: ['幻影消散了……瘟疫也在退去。', '谢谢你，冒险家。战争——停下来了。'] } },
    { t: 'handin', to: 'kurent', lvl: 38, name: '和平的约定', reward: { exp: 0.08, gold: 4000, items: [{ key: 'ep_de_morgan', n: 1 }] },
      desc: '回阿法利亚营地，把好消息告诉克伦特。',
      talk: { offer: ['诺伊佩拉的瘟疫退去了。'], done: ['王国和公国签下了停战的约定。', '这是摩根留下的毒瓶……他一直想找出解药。你收下吧，这是他的心愿。', '——暗黑城篇 · 完——'] } },
  ] },

  /* ---- 美术设定（art/tools/region_art.py 用）---- */
  art: {
    chars: {
      deGhoul: { h: 96, hold: 'holding a rusty short shovel', desc: 'A grave robber ghoul monster of the dark elf underground: a hunched thin undead thief with grey-violet skin, a long crooked nose and pointed ears, stringy white hair, a ragged hooded brown cloak and patched trousers, a lumpy sack on its back, holding a rusty short shovel.',
        atk: 'the rusty shovel', cast: 'raising the shovel overhead with both hands', low: 'crouching low and scooping forward with the shovel' },
      deSkel: { h: 98, hold: 'holding a large bone ready to throw', desc: 'A skeleton bone-thrower soldier of the dark elf underground: a skinny bleached skeleton wearing a dented bronze helmet and a torn dark violet tabard with a crescent moon emblem, a quiver full of bones on its back, holding a large bone ready to throw.',
        atk: 'the large bone', cast: 'raising a bone overhead to throw it', low: 'crouching low and swinging the bone sideways' },
      deGhost: { h: 80, hold: null, fly: true, hover: 26, desc: 'A ghost monster of the dark elf graveyard: a small floating pale blue-white spirit with a round head, big hollow dark eyes, a sad open mouth, wispy short arms and a long tattered tail instead of legs, a torn dark elf cloth hood on its head. No legs, floating in the air.',
        atk: 'its wispy clawed hands', cast: 'spreading its arms wide and wailing', low: 'swooping forward low with its hands reaching out' },
      deSpider: { h: 60, hold: null, cycle: 'crawl', desc: 'A giant poison spider monster of the dark elf caves: a big eight-legged spider with a round dark purple abdomen marked with a yellow skull-like pattern, hairy striped legs, a cluster of glowing red eyes and small curved fangs.',
        atk: 'its curved fangs', cast: 'rearing up on its back legs with the front legs raised', low: 'crouching flat and lunging forward low',
        // 招牌动作（艾克洛索用：升天追踪落下 / 弹珠弹射；小蜘蛛不放招牌招式，共用这张表没关系）
        sig: ['ascending: crouching flat, then springing straight up with all eight legs tucked in, then plunging down belly-first with the legs spread wide to crush the ground', 'pinball: curling the legs in tightly and rolling forward like a spinning ball that ricochets, body tilted by the spin'] },
      deElf: { h: 104, hold: 'holding a long spear with a crescent blade', desc: 'A dark elf royal guard soldier: a slim dark elf man with grey-violet skin, long pointed ears and white hair, wearing dark indigo scale armor with silver crescent moon trims, a closed-face helmet with a crescent crest, a short violet cape, holding a long spear with a crescent-shaped blade.',
        atk: 'the crescent spear', cast: 'raising the spear overhead with both hands', low: 'lunging forward low with the spear thrust out' },
      deGiant: { h: 150, hold: 'holding a huge stone hammer', desc: 'A lava giant monster of the lava cave: a huge hulking bald giant with dark reddish-brown rocky skin, glowing orange cracks on the arms, a thick short beard, a heavy iron collar with a broken chain, a leather loincloth over black trousers, holding a huge crude stone hammer.',
        atk: 'the huge stone hammer', cast: 'raising the hammer high with both hands', low: 'hunching forward with the shoulder lowered to charge',
        // 招牌动作（歌利亚：熔岩喷涌；三兄弟同一个模型）
        sig: ['lava burst: raising the stone hammer high with both hands, then smashing it down into the ground so hard the body bends forward, then pulling it out of the cracked ground', 'giant grab: reaching forward with one huge open hand, closing the fist, lifting it high overhead and hurling it forward'] },
      deMorgan: { h: 112, boss: true, hold: 'holding a glass flask of violet liquid', desc: 'Morgan the Resentful, a boss of the dark elf underground: a dark elf alchemist turned undead by the plague, gaunt grey-violet skin with sickly purple blotches, long messy white hair, glowing yellow eyes, a long torn alchemist coat with many pockets and belts full of glass vials, cracked round goggles on his forehead, holding a glass flask of violet liquid.',
        atk: 'the glass flask swung forward', cast: 'raising the flask high as it bubbles', low: 'crouching low and flinging a vial forward',
        sig: ['death curse: pointing a bony finger forward while holding the flask up, cursing with the mouth wide open and the coat flaring', 'skull bombs: pulling three small skulls from the coat and hurling them forward in a wide overhand throw'] },
      deSpiz: { h: 120, boss: true, cycle: 'trot', desc: 'Spiz the evil dragon, a boss of the dark elf graveyard: a big undead dragon on four clawed legs, a huge horned dragon skull head with glowing violet eyes, dark purple scaly hide with exposed ribs and bones, tattered folded bat wings, a long bony tail with spikes.',
        atk: 'its huge skull jaws biting', cast: 'rearing its head up and roaring', low: 'lowering its head and lunging forward',
        // 官方是锁链缚住的龙首（领主固定不动）：可选出一个“头部”形态（BOSS_PLAN §3.3 可选：斯皮兹的头部 3 张）
        sig: ['spitting victims: rearing the skull head back, then thrusting it forward with the jaws wide open as if spitting out small creatures', 'poison fog: lowering the skull head close to the ground and exhaling a long breath with the jaws half open'] },
      deBoroding: { h: 132, boss: true, hold: 'holding a giant two-handed war hammer', desc: 'Hammer King Boroding, the undying king of the ancient dark elf kingdom: a tall undead dark elf king with pale grey-violet skin and hollow glowing blue eyes, a long white beard, a tall spiked black iron crown, heavy dark royal plate armor with gold trims and a tattered royal purple cape, holding a giant two-handed war hammer.',
        atk: 'the giant war hammer', cast: 'raising the war hammer high over his head', low: 'dragging the hammer low and charging forward',
        sig: ['triple quake: leaping slightly and slamming the war hammer head-first into the ground with both hands, knees bent, shoulders hunched from the impact', 'splitting cross: swinging the war hammer down vertically in a huge arc from behind the back to the ground in front'] },
      deHeadless: { h: 128, boss: true, hold: 'holding a long black lance', desc: 'The Headless Knight, guardian of the Dark City gate: a tall armored knight with no head, violet ghost fire flickering from the empty neck of the armor, heavy black plate armor with silver crescent moon trims, a long tattered dark violet cape, a round shield on the back, holding a long black lance.',
        atk: 'the long black lance', cast: 'raising the lance high with ghost fire flaring', low: 'leaning forward low with the lance couched for a charge',
        sig: ['wall ram: lance couched low under the arm, body leaning far forward in a full-speed charge', 'nightmare stampede: raising the lance high and sweeping it forward to command, cape whipping back'],
        // 领主已用 deHeadless_rider。步战 deHeadless 留给瘟疫之源的精英。
        forms: { rider: { h: 170, cycle: 'trot', hold: 'holding a long black lance', desc: 'The Headless Knight riding a huge black nightmare horse, guardian of the Dark City gate: a tall armored knight with no head and violet ghost fire flickering from the empty neck, heavy black plate armor with silver crescent moon trims, a long tattered dark violet cape, a long black lance couched under the arm; the nightmare horse is jet black with a flaming violet mane and tail, glowing violet eyes, black barding with silver crescent trims.',
          atk: 'the long black lance thrust forward from horseback', cast: 'the horse rearing up on its hind legs while the knight raises the lance', low: 'the horse galloping low with the lance couched for a charge',
          sig: ['wall ram: the horse at full gallop, the knight leaning forward with the lance couched', 'nightmare stampede: the horse rearing up, the knight raising the lance high to command'] } } },
      deDiregie: { h: 130, boss: true, hold: 'with long clawed hands', desc: 'The Phantom of Diregie, a boss of the plague-stricken town Noiphera: a tall gaunt shadowy figure in a long ragged dark violet hooded robe, a pale cracked porcelain-like face with glowing yellow eyes, sickly purple fungus and spore sacs growing on its shoulders, long thin clawed hands, the robe hem dissolving into shadowy tendrils.',
        atk: 'its long clawed hands', cast: 'raising both hands as spores swirl around', low: 'gliding forward low with claws reaching out',
        sig: ['engulf: spreading the robe and long arms wide as the fluid shadow body stretches out like a whirlpool, then snapping shut', 'plague spores: hunching forward and shaking the spore sacs on its shoulders, clawed hands pointing at the ground'],
        rage: 'splitting apart: the body stretched and torn into three pieces, arms thrown wide, head thrown back' },
    },
    gates: {
      shallow_haunt: 'a cave entrance framed by an ancient dark elf stone arch with crescent moon carvings, glowing blue mushrooms and hanging spider webs, a pale blue portal',
      spider_cave: 'a cave mouth thickly covered in white spider webs with a few wrapped cocoons hanging, glowing red spider eyes painted around it, a pale violet portal',
      darkelf_tomb: 'a gothic dark elf mausoleum door with pointed arches, silver crescent moons and violet ghost lanterns, a violet portal',
      lava_cave: 'a jagged basalt cave entrance with glowing lava dripping down the sides and a giant broken chain across the top, an orange portal',
      king_ruins: 'a ruined ancient royal gate of dark stone with a huge carved hammer and crown on top and five knight statues along the sides, a deep violet portal',
      darkcity_gate: 'a colossal carved obsidian city gate with silver crescent moon ornaments and two spear-holding guardian statues, a violet portal',
      neipera: 'an elegant dark elf town gate with a violet pointed roof overgrown with sickly purple fungus and spore sacs, a pale yellow-violet portal',
    },
  },
});
