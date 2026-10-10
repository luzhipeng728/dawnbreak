/*
 * 奥兹玛攻坚战运行时内容。
 *
 * OZMA_CORE 负责可重放的攻坚板状态（区域解锁、Chaos、Sanity、王座共享血量），
 * 这里把同一份地图清单展开成项目真正的 DUNGEONS/MON：普通副本、联机副本和
 * 机器人都会走现有 Dungeon / monster 引擎，不再把奥兹玛只留在规则测试里。
 * 官方 Dark Side 是毁灭、绝望、恐怖三个区域；每个区域一个 Area Dungeon 加
 * Major / Liberation / Chaos / Side 四张图，Elerinon 阶段再进入三张终局图。
 */

const OZMA_PALETTES = {
  ruin: { sky: ['#160b25', '#38205a', '#70438e'], haze: '#a56be0', floor: ['#30203c', '#402850', '#21152c'], line: 'rgba(190,120,255,.48)', rgb: '190,140,255' },
  despair: { sky: ['#210b18', '#5a1e34', '#a14a58'], haze: '#f08a9a', floor: ['#3a1b28', '#512537', '#24121d'], line: 'rgba(255,130,150,.48)', rgb: '255,150,170' },
  terror: { sky: ['#251406', '#693018', '#bf6427'], haze: '#ffb060', floor: ['#462415', '#65321b', '#2b170d'], line: 'rgba(255,170,80,.48)', rgb: '255,180,100' },
  elerinon: { sky: ['#090b20', '#202b62', '#5364b2'], haze: '#91a8ff', floor: ['#171b3a', '#232b58', '#0f1228'], line: 'rgba(130,170,255,.55)', rgb: '150,180,255' },
};
// 本作的等级上限是 Lv.60；官方奥兹玛的等级压缩到终局 Lv.60，保留区域、机制和两阶段结构。
const OZMA_LEVEL = 60;

const ozmaTheme = (id, p) => ({
  grade: { tint: `rgba(${p.rgb},.14)`, fog: `rgba(${p.rgb},.09)` },
  ambient: 'wisps', rgb: p.rgb,
  pal: { sky: p.sky, haze: p.haze, floor: p.floor, line: p.line },
  bg: [`${id} Ozma Raid battlefield: a stylized chibi dark-fantasy battlefield with colossal broken cathedral ruins, floating black stones, violet chaos flames and dramatic moonlight.`,
    'cracked stone floor engraved with large chaos sigils, scattered banners, ash and glowing embers',
    'broken pillars, chained ruins and small crystals along the edge of the battlefield'],
});

const OZMA_MOB_SKILLS = {
  cultist: [{ use: 'shot', mode: 'homing', speed: 240, turn: 2, dmg: .82, col: '#b070ff', cd: [3.2, 4.8] }, { use: 'buff', kind: 'heal', target: 'allies', r: 260, amt: .08, cd: [8, 11] }],
  knight: [{ use: 'swipe', n: 2, reach: 78, dmg: 1, cd: [1.6, 2.5], w: 2 }, { use: 'dash', len: 310, speed: 680, windup: .7, dmg: 1.05, cd: [4.5, 6] }],
  wisp: [{ use: 'shot', mode: 'spread', n: 3, spread: 55, speed: 280, dmg: .75, col: '#c0b0ff', cd: [3.5, 5] }, { use: 'blink', to: 'behind', dist: 70, cd: [6, 8] }],
  hound: [{ use: 'swipe', clip: 'bite', reach: 60, dmg: .9, cd: [1.4, 2.2], w: 2 }, { use: 'dash', clip: 'pounce', len: 300, speed: 720, windup: .65, dmg: 1.05, cd: [4, 5.5] }],
  golem: [{ use: 'swipe', clip: 'slam', reach: 94, width: 30, dmg: 1.22, down: true, sa: true, cd: [2.4, 3.6], w: 2 }, { use: 'aoe', shape: 'ring', at: 'self', r: 145, r0: 48, windup: 1.1, dmg: 1.05, cd: [7, 9] }],
  archer: [{ use: 'shot', mode: 'arc', n: 3, speed: 320, spread: 88, r: 60, dmg: .85, col: '#ffb070', cd: [3.8, 5.3] }, { use: 'laser', windup: 1, dur: .8, sweep: 70, dmg: .38, cd: [7, 9] }],
  eye: [{ use: 'laser', windup: 1.1, dur: .9, sweep: 65, dmg: .42, col: '#c080ff', cd: [6, 8] }, { use: 'rain', kind: 'bolt', n: 3, r: 46, windup: 1.1, dmg: .9, cd: [5, 7] }],
  priest: [{ use: 'aoe', shape: 'circle', at: 'target', r: 72, windup: 1, dmg: .85, status: 'curse', sdur: 2, cd: [5, 7] }, { use: 'summon', kind: 'ozma_hound', n: 2, max: 3, cd: [12, 16] }],
};

const OZMA_MOBS = {
  ozma_cultist: { name: '奥兹玛混沌信徒', tier: 'caster', arch: 'kiter', elem: 'dark', art: ['raidOzCinderImp'], skills: OZMA_MOB_SKILLS.cultist },
  ozma_knight: { name: '堕落混沌骑士', tier: 'brute', arch: 'aggressive', elem: 'dark', art: ['raidOzBogCrawler'], size: [17, 13, 118], skills: OZMA_MOB_SKILLS.knight },
  ozma_wisp: { name: '黑雾残灵', tier: 'flier', arch: 'flier', elem: 'dark', art: ['raidOzMourner'], skills: OZMA_MOB_SKILLS.wisp },
  ozma_hound: { name: '混沌猎犬', tier: 'normal', arch: 'aggressive', elem: 'dark', art: ['raidOzEmberHound'], skills: OZMA_MOB_SKILLS.hound },
  ozma_golem: { name: '黑焰混沌魔像', tier: 'brute', arch: 'guard', elem: 'fire', art: ['raidOzMagmaGolem'], size: [20, 15, 126], skills: OZMA_MOB_SKILLS.golem },
  ozma_archer: { name: '黑焰弓手', tier: 'caster', arch: 'kiter', elem: 'fire', art: ['raidOzSporeling'], skills: OZMA_MOB_SKILLS.archer },
  ozma_eye: { name: '混沌之眼', tier: 'flier', arch: 'flier', elem: 'dark', art: ['raidOzDroneFish'], skills: OZMA_MOB_SKILLS.eye },
  ozma_priest: { name: '奥兹玛黑暗祭司', tier: 'elite', arch: 'kiter', elem: 'dark', art: ['raidOzRotShaman'], size: [15, 12, 112], skills: OZMA_MOB_SKILLS.priest },
};

// 门将：每个区域一组专属技能（docs/RAID_OZMA.md §5）；破防机制在 raid_elite 的 eliteSpec（ozma_raid.js 的 defineRaidElite），技能的抬手 / 前冲就是破招要打断的东西
const OZMA_GATE_BASE = [{ use: 'guard', dur: 2.2, reduce: .8, cd: [7, 10], w: 1.4 }, { use: 'swipe', clip: 'slam', reach: 110, width: 30, dmg: 1.28, down: true, sa: true, cd: [2.5, 3.7], w: 2 }];
const OZMA_GATEKEEPERS = {
  ruin: { name: '毁灭门将', art: ['raidOzEmberKnight'], elem: 'dark',   // 前冲 + 黑焰扇射：抬手时闪光，被打断就硬直
    skills: [...OZMA_GATE_BASE, { use: 'dash', len: 380, speed: 760, windup: 1, dmg: 1.3, down: true, cd: [6, 8], col: '#ff8060' }, { use: 'shot', mode: 'spread', n: 5, spread: 70, speed: 300, dmg: .8, col: '#ff8060', cd: [5, 7] }] },
  despair: { name: '绝望门将', art: ['raidOzTearMage'], elem: 'dark',   // 召唤残灵 + 追踪弹 + 十字光柱：绝望之球要拦截
    skills: [...OZMA_GATE_BASE, { use: 'shot', mode: 'homing', n: 3, spread: 50, speed: 240, turn: 1.8, dmg: .85, col: '#c090ff', cd: [4, 6] }, { use: 'aoe', shape: 'cross', at: 'target', hw: 26, windup: 1.1, dmg: 1.15, cd: [6, 8], col: '#c080ff' }, { use: 'summon', kind: 'ozma_wisp', n: 2, max: 4, cd: [12, 15] }] },
  terror: { name: '恐怖门将', art: ['raidOzSwampHorror'], elem: 'fire',   // 震地环 + 岩刺雨 + 冲锋：破壳后才吃得到伤害
    skills: [...OZMA_GATE_BASE, { use: 'aoe', shape: 'ring', at: 'self', r: 170, r0: 60, windup: 1.2, dmg: 1.15, cd: [7, 9], col: '#ffa050' }, { use: 'rain', kind: 'bolt', n: 4, r: 52, windup: 1.1, dmg: 1, cd: [8, 10] }, { use: 'dash', len: 340, speed: 720, windup: .9, dmg: 1.2, down: true, cd: [6, 9] }] },
};

const OZMA_BOSS_ART = ['siroco', 'gatekeeper', 'assassin', 'boneLord', 'tauKing', 'nex'];
const OZMA_ATTACKS = [
  { use: 'swipe', n: 3, reach: 108, width: 28, dmg: 1.2, cd: [1.8, 2.8], w: 2 },
  { use: 'dash', len: 390, speed: 760, windup: .72, dmg: 1.2, cd: [4.5, 6.5], w: 1.5 },
  { use: 'shot', mode: 'homing', n: 4, spread: 58, speed: 250, turn: 1.8, dmg: .9, col: '#c090ff', cd: [5, 7] },
  { use: 'aoe', shape: 'cross', at: 'target', hw: 25, windup: 1.15, dmg: 1.25, cd: [7, 9], col: '#ff8060' },
  { use: 'rain', kind: 'hex', n: 5, r: 48, windup: 1.1, dmg: 1.05, col: '#b070ff', cd: [8, 11] },
];

// 团本里的领主名（docs/RAID_OZMA.md §3）：规则清单（ozma_core）里的原名保留给它自己的测试，这里按团本流程改成官方领主名
const OZMA_LORD_NAME = { ruin_beyond: '贝利亚斯', despair_lunen: '提亚马特', terror_martyr: '卡赞', p2_armis: '阿斯特罗斯', p2_throne: '奥兹玛', p2_elerinon: '埃利诺斯', despair_serha: '赛赫', ruin_corridor: '亡者回廊守卫', ruin_path: '卡赞的幻影' };
const OZMA_LORD_ART = {
  ruin_beyond: 'raidOzBelias',
  despair_lunen: 'raidOzTiamat',
  terror_martyr: 'raidOzKazan',
  p2_armis: 'raidOzAstros',
  p2_throne: 'raidOzOzma',
  p2_elerinon: 'raidOzEllinos',
  despair_serha: 'raidOzSehet',
  ruin_corridor: 'raidOzDeadKeeper',
  ruin_path: 'raidOzKazan',
  ruin_resting: 'raidOzFrostWraith',
  ruin_gladden: 'raidOzRotShaman',
  despair_crossroads: 'raidOzTearMage',
  despair_aventus: 'raidOzMagmaGolem',
  despair_phylis: 'raidOzFrostWraith',
  terror_land: 'raidOzBogCrawler',
  terror_grauben: 'raidOzEmberKnight',
  terror_eldfell: 'raidOzMagmaGolem',
  terror_red_altar: 'raidOzSwampHorror',
};
const OZMA_ELITE_OF = { ruin: 'ozEliteRuin', despair: 'ozEliteDespair', terror: 'ozEliteTerror', p2_elerinon: 'ozEliteSuppress', p2_armis: 'ozEliteChaos', p2_throne: 'ozEliteChaos' };
const ozmaBoss = (M, region, i, final = false) => {
  const gate = OZMA_GATEKEEPERS[region] || { name: '王座门将' };
  const colors = { ruin: '#bf82ff', despair: '#ff8ca8', terror: '#ffad5e', elerinon: '#9eb7ff' };
  const col = colors[region] || colors.elerinon;
  const phase2 = i % 4 === 0 ? { use: 'invuln', until: 'crystals', n: 3, name: '混沌碎片', hpFrac: .018, col, say: '混沌屏障展开——击破碎片！' }
    : i % 4 === 1 ? { use: 'safezone', windup: 3.2, n: 2, r: 72, frac: .42, col, say: '毁灭冲击——站进安全区！' }
      : i % 4 === 2 ? { use: 'shield', hp: .045, dur: 14, punish: 'heal', onBreak: 'groggy', col, say: '混沌护盾——在读条结束前击破！' }
        : { use: 'hazard', kind: 'fire', every: 3.6, n: 2, r: 54, dmg: 1.05, col, say: '黑焰地火蔓延——移动！' };
  const phase3 = final ? { at: .25, enter: { say: '王座终焉读条——分队同时打断！', mechs: [{ use: 'stagger', windup: 3.6, need: .05, onBreak: 'groggy', col }] }, skills: [{ ...OZMA_ATTACKS[4], dmg: 1.2, cd: [5.5, 7.5] }, { use: 'mech', mech: { use: 'safezone', windup: 2.8, n: 3, r: 68, frac: .45, col }, cd: [19, 24] }] } : null;
  return {
    name: OZMA_LORD_NAME[M.id] || M.boss, tier: 'raid', lvl: final ? 65 : 64, art: OZMA_LORD_ART[M.id] || OZMA_BOSS_ART[i % OZMA_BOSS_ART.length], size: [20, 16, 138], scale: final ? 1.42 : 1.26,
    elem: region === 'terror' || final ? 'fire' : 'dark', pref: 150, hook: null,
    mechs: [{ use: 'groggy', max: final ? 125 : 110, dur: final ? 8 : 6, mul: final ? 1.65 : 1.5 }, { use: 'enrage', t: final ? 360 : 240, atk: 1.7, speed: 1.25 }],
    phases: [
      { at: 1, skills: OZMA_ATTACKS.slice(i % 2, i % 2 + 3).map((s, n) => ({ ...s, col, cd: s.cd && [s.cd[0] + n * .25, s.cd[1] + n * .25] })) },
      { at: final ? .62 : .56, enter: { say: `${M.boss}释放了${phase2.use === 'safezone' ? '毁灭冲击' : '混沌机制'}！`, col, mechs: [phase2] }, skills: [{ ...OZMA_ATTACKS[(i + 2) % OZMA_ATTACKS.length], col, dmg: 1.2 }, { use: 'mech', mech: phase2, cd: [26, 32], col }] },
      ...(phase3 ? [phase3] : []),
    ],
    _ozmaGatekeeper: gate.name,
    _ozmaContent: { map: M.id, phases: M.phases, mechanics: M.mechanics, fail: M.fail },
  };
};

const OZMA_AREA_DEFS = [
  { id: 'ruin', label: '毁灭区域', theme: 'ozmaRuin', camp: '毁灭营地' },
  { id: 'despair', label: '绝望区域', theme: 'ozmaDespair', camp: '绝望营地' },
  { id: 'terror', label: '恐怖区域', theme: 'ozmaTerror', camp: '恐怖营地' },
];
const OZMA_MOB_LIST = [
  ['ozma_cultist', 2.4], ['ozma_knight', 1.8], ['ozma_wisp', 1.2], ['ozma_hound', 1.8], ['ozma_golem', .9], ['ozma_archer', 1.2], ['ozma_eye', .8], ['ozma_priest', .7],
];
const OZMA_CORE_MAPS = typeof OZMA_CORE !== 'undefined' && OZMA_CORE.MAPS ? OZMA_CORE.MAPS : [];
const OZMA_BOSSES = {};
const OZMA_DUNGEONS = {};
const OZMA_GATE = { ruin: 480, despair: 1180, terror: 1880 };
for (const A of OZMA_AREA_DEFS) {
  const maps = OZMA_CORE_MAPS.filter(M => (OZMA_CORE.REGION_BY_MAP && OZMA_CORE.REGION_BY_MAP[M.id] === A.id) || M.id.startsWith(A.id + '_'));
  maps.forEach((M, i) => {
    const boss = `ozma_boss_${M.id}`, gate = `ozma_gate_${A.id}`;
    OZMA_BOSSES[boss] = ozmaBoss(M, A.id, i);
    OZMA_DUNGEONS[`ozma_${M.id}`] = {
      name: `奥兹玛 · ${M.name}`, lvl: [OZMA_LEVEL, OZMA_LEVEL], theme: A.theme, layout: 'raid', rooms: 4, branches: 0, rows: 1, cols: 4,
      mobs: OZMA_MOB_LIST, elite: gate, eliteSpec: OZMA_ELITE_OF[A.id], boss: boss, bossAdds: 0, bossLvl: OZMA_LEVEL, bgm: 'dungeon', bossBgm: 'boss', raid: true, hidden: false,
      gate: { scene: 'ozma_field', x: OZMA_GATE[A.id] + i * 145, col: '170,120,255' }, preBoss: { kind: gate, say: `${M.gatekeeper}挡住了通往领主房的路！` },
      desc: `${M.name}：清理小怪波次，击败门将与${M.boss}。Boss 攻击、阶段和失败机制按奥兹玛攻坚清单执行。`,
      drops: { boss: [['crystal', .04]], mats: [['crystal', .09, 6], ['m_soul', .004, 1]] },
      ozma: { coreMap: M.id, area: A.id, role: i === 0 ? 'area' : i === 1 ? 'major' : i === 2 ? 'liberation' : i === 3 ? 'chaos' : 'side', gatekeeper: gate, boss, waves: M.waves, phases: M.phases, mechanics: M.mechanics, fail: M.fail },
    };
  });
}
for (const [i, M] of (OZMA_CORE_MAPS.filter(M => M.id.startsWith('p2_'))).entries()) {
  const boss = `ozma_boss_${M.id}`;
  OZMA_BOSSES[boss] = ozmaBoss(M, 'elerinon', i + 20, true);
  OZMA_DUNGEONS[`ozma_${M.id}`] = {
      name: `奥兹玛 · ${M.name}`, lvl: [OZMA_LEVEL, OZMA_LEVEL], theme: 'ozmaElerinon', layout: 'raid', rooms: 5, branches: 0, rows: 1, cols: 5,
    mobs: OZMA_MOB_LIST, elite: 'ozma_gate_terror', eliteSpec: OZMA_ELITE_OF[M.id], boss, bossAdds: 0, bossLvl: OZMA_LEVEL, bgm: 'abyss', bossBgm: 'boss', raid: true, hidden: false,
    gate: { scene: 'ozma_field', x: 2360 + i * 150, col: '120,160,255' }, preBoss: { kind: 'ozma_gate_terror', say: '王座门将出现了！' },
    desc: `${M.name}：终局地图。队伍共享奥兹玛王座血量，失败会触发狂暴/终焉机制。`,
    drops: { boss: [['crystal', .06]], mats: [['crystal', .12, 8], ['m_soul', .006, 1]] },
    ozma: { coreMap: M.id, area: 'elerinon', role: 'final', gatekeeper: 'ozma_gate_terror', boss, waves: M.waves, phases: M.phases, mechanics: M.mechanics, fail: M.fail },
  };
}

const OZMA_SPEC = {
  id: 'ozma', name: '奥兹玛攻坚战 · 黑暗一侧', lvl: OZMA_LEVEL, lvlMax: OZMA_LEVEL, power: 8.2, bossPower: .9, atkPower: 3.8,
  entry: { scene: 'siroco_town', side: 'up', x: 1640, to: 'ozma_town', minLv: OZMA_LEVEL, label: `奥兹玛攻坚战（Lv.${OZMA_LEVEL}）` },
  themes: Object.fromEntries(Object.entries(OZMA_PALETTES).map(([id, p]) => [`ozma${id[0].toUpperCase()}${id.slice(1)}`, ozmaTheme(id, p)])),
  monsters: { ...OZMA_MOBS, ...Object.fromEntries(Object.entries(OZMA_GATEKEEPERS).map(([id, G]) => [`ozma_gate_${id}`, { name: G.name, tier: 'elite', arch: 'guard', elem: G.elem, art: G.art, size: [20, 15, 130], traits: { sa: 'cast' }, skills: G.skills }])) },
  bosses: OZMA_BOSSES,
  dungeons: OZMA_DUNGEONS,
  scenes: {
    ozma_town: { name: '圣者之地', area: '奥兹玛攻坚营地', kind: 'town', width: 2800, theme: 'ozmaElerinon', bgm: 'guild', ambient: 'magic', map: [32, -12], npcs: [{ npc: 'ozmaQuarter', x: 1180, y: 54 }], exits: [{ side: 'down', x: 1400, to: 'siroco_town' }, { side: 'right', to: 'ozma_field' }] },
    ozma_field: { name: '黑暗一侧', area: '奥兹玛攻坚地图', kind: 'field', width: 3000, theme: 'ozmaRuin', bgm: 'field', ambient: 'wisps', map: [35, -16], exits: [{ side: 'left', to: 'ozma_town' }] },
  },
  npcs: {
    ozmaQuarter: { name: '混沌军需官', title: '奥兹玛攻坚商人 · 融合装备', art: 'world/npc_agonzo', h: 112, services: ['shop:ozma_raid', 'repair'],
      greet: ['混沌的怨念，换成称手的融合装备吧。'],
      lines: ['理智归零别慌：第一次会被拉进小游戏，稳住心神就能回来；第二次就真的倒下了。', '混沌等级越高，翻出来的怨念越多——双剑图可以把它推高。'],
      look: 'A grizzled raid quartermaster in dark crimson-violet armor with a tattered cloak, a brass ledger and a lantern, standing beside crates of glowing violet chaos shards' },
  },
  story: null,
};

const OZMA_REGION_SPEC = OZMA_SPEC;
const OZMA_REGION = typeof defineRegion === 'function' ? defineRegion(OZMA_REGION_SPEC) : null;

// 奥兹玛专属手绘背景尚未单独分包时，沿用已有的深渊/圣战背景作为可玩的视觉兜底。
// 仍保留 ozma* 主题和区域色调；把素材别名登记到自己的 bundle，离线包和网页版都能按需加载。
const OZMA_BG_FALLBACK = { ozmaRuin: 'raidOzRuin', ozmaDespair: 'raidOzDespair', ozmaTerror: 'raidOzHorror', ozmaElerinon: 'raidOzThrone' };
if (typeof ASSET_SRC !== 'undefined' && typeof ASSET_BUNDLE !== 'undefined') for (const [dst, src] of Object.entries(OZMA_BG_FALLBACK)) {
  for (const suf of ['far', 'floor', 'edge', 'mid', 'fore']) {
    const from = `bg/${src}_${suf}`, to = `bg/${dst}_${suf}`;
    if (ASSET_SRC[from] && !ASSET_SRC[to]) { ASSET_SRC[to] = ASSET_SRC[from]; ASSET_BUNDLE[to] = 'bg:' + dst; }
  }
}

/* 保留清单元数据，供状态板 / 联机入口 / 测试读取；DUNGEONS 仍是唯一的刷图入口。 */
const OZMA_RUNTIME = {
  region: OZMA_REGION_SPEC.id,
  maps: Object.freeze(Object.fromEntries(Object.entries(OZMA_DUNGEONS).map(([id, d]) => [id, Object.freeze({ ...d.ozma })]))),
  resolve(id) { return this.maps[id] || Object.values(this.maps).find(d => d.coreMap === id) || null; },
  map(id) { const d = this.resolve(id); return d ? { ...d } : null; },
  core(id) { const d = this.resolve(id); return d && typeof OZMA_CORE !== 'undefined' && OZMA_CORE.MAP_BY_ID ? OZMA_CORE.MAP_BY_ID[d.coreMap] || null : null; },
  content(id) { const d = this.resolve(id), c = d && this.core(d.coreMap); return c ? { ...c, waves: c.waves.map(w => w.slice()), phases: c.phases.map(p => ({ ...p, attacks: p.attacks.slice() })), mechanics: c.mechanics.map(m => ({ ...m })), fail: { ...c.fail } } : null; },
  /* 规则核心仍是纯函数，但运行时入口统一从这里创建 / 推进，
     这样单人、组队和服务端重放用的是同一份地图与阶段语义。 */
  create(members, now = Date.now(), opt = {}) { return typeof OZMA_CORE !== 'undefined' && OZMA_CORE.init ? OZMA_CORE.init(members, now, opt) : null; },
  apply(state, event, now = Date.now()) { return typeof OZMA_CORE !== 'undefined' && OZMA_CORE.event ? OZMA_CORE.event(state, event, now) : { out: [], err: '奥兹玛规则核心未加载' }; },
  tick(state, now = Date.now()) { return typeof OZMA_CORE !== 'undefined' && OZMA_CORE.tick ? OZMA_CORE.tick(state, now) : { out: [], err: '奥兹玛规则核心未加载' }; },
  reward(state, index = 0) { return typeof OZMA_CORE !== 'undefined' && OZMA_CORE.reward ? OZMA_CORE.reward(state, index) : null; },
};
for (const [id, meta] of Object.entries(OZMA_RUNTIME.maps)) {
  const D = typeof DUNGEONS !== 'undefined' && DUNGEONS[id];
  if (!D) continue;
  D.raid = true; D.ozma = meta;
  const before = D.beforeEnter;
  D.beforeEnter = function (diff) {
    if (before && before(diff) === false) return false;
    if (typeof game !== 'undefined') game.ozmaRuntime = { mapId: id, ...meta };
    return true;
  };
}
if (typeof bus !== 'undefined' && typeof bus.on === 'function') bus.on('dungeonEnter', d => {
  const meta = d && OZMA_RUNTIME.maps[d.id];
  if (meta && typeof game !== 'undefined') game.ozmaRuntime = { mapId: d.id, ...meta };
});
