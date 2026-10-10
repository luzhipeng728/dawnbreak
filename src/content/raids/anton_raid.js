/* =====================================================================
   安徒恩攻坚战（Neo 版）· 节点地下城（docs/RAID_ANTON.md）
   规则（节点图 / 计时 / 奖励）在 src/game/raid_anton.js；这里只有客户端内容：场景主题、小怪、精英（破防条件）、领主 + 机制脚本、固定房间结构、地下城。
   来源标注：[研] = 调研资料（多数未核实）；【原创】= 没有可靠资料、按官方风格补的设计。
   美术：已有的精灵直接用，没有的先用现有精灵换色占位（art 字段），出图后改 art 即可（登记在 docs/RAID_ART_MANIFEST.json）。
   ===================================================================== */
const ANTON_RAID_SPEC = { id: 'antonRaid', lvl: 60, power: 1.1, bossPower: 1.2, atkPower: 1.06 };
// 三套体内色调（plan §4.2）：冷灰蓝（苍穹贵族号 / 黑雾）→ 红黑岩浆（腿 / 火山）→ 红色肉质（心脏）
regionTheme('anRaidHull', { grade: { tint: 'rgba(70,120,170,0.14)', fog: 'rgba(150,190,230,0.1)' }, ambient: 'wisps', rgb: '150,190,230', pal: { sky: ['#0a121c', '#1c3248', '#3a5a78'], far: '#060b12', haze: '#8fb8e0', floor: ['#16222f', '#26394a', '#0e1822'], line: 'rgba(160,200,235,.45)' } });
regionTheme('anRaidMagma', { grade: { tint: 'rgba(210,70,30,0.16)', fog: 'rgba(255,140,70,0.1)' }, ambient: 'motes', rgb: '255,130,60', pal: { sky: ['#1a0804', '#4a1608', '#a03a14'], far: '#0e0402', haze: '#ff8a46', floor: ['#2e1208', '#5a2410', '#1c0a04'], line: 'rgba(255,150,80,.5)' } });
regionTheme('anRaidFlesh', { grade: { tint: 'rgba(190,30,50,0.18)', fog: 'rgba(255,100,120,0.1)' }, ambient: 'wisps', rgb: '255,90,110', pal: { sky: ['#1c0409', '#58101e', '#a8283c'], far: '#0e0206', haze: '#ff6a7e', floor: ['#34080f', '#661624', '#220509'], line: 'rgba(255,110,130,.5)' } });
// ---- 小怪【原创】（官方资料没有逐个小怪的技能表；定位：苍穹贵族号被侵蚀的船员 / 黑雾 / 熔岩 / 肉质增生）----
const ANTON_RAID_MOB_DEFS = {
  anMob_crawler: { name: '船体爬行者', tier: 'swarm', arch: 'swarm', size: [13, 11, 70], elem: 'dark', art: ['raidAnHullCrawler'], skills: [{ use: 'swipe', n: 2, reach: 64, dmg: 0.8, cd: [1.6, 2.4] }, { use: 'dash', len: 240, speed: 620, windup: 0.5, dmg: 0.9, cd: [4, 6] }] },
  anMob_fogling: { name: '黑雾幼体', tier: 'caster', arch: 'kiter', elem: 'dark', art: ['voidcaster', { hue: 200, sat: 0.6, bright: 0.7 }], skills: [{ use: 'shot', mode: 'spread', n: 3, spread: 40, speed: 270, dmg: 0.7, cd: [3.5, 5] }, { use: 'mark', delay: 0.9, r: 56, dmg: 0.95, cd: [5, 7] }] },
  anMob_slag: { name: '熔渣巨像', tier: 'brute', arch: 'aggressive', size: [19, 16, 110], weight: 4, elem: 'fire', art: ['golem', { hue: -20, sat: 1.2, bright: 0.85 }], skills: [{ use: 'swipe', clip: 'slam', reach: 100, width: 32, windup: 0.7, dmg: 1.2, cd: [2.4, 3.4] }, { use: 'aoe', shape: 'circle', at: 'self', r: 120, windup: 1, dmg: 1.1, cd: [6, 8] }] },
  anMob_larva: { name: '孵化幼虫', tier: 'swarm', arch: 'swarm', size: [12, 10, 54], elem: 'fire', art: ['wcLarva', { hue: -30, sat: 1.1, bright: 0.9 }], skills: [{ use: 'dash', len: 260, speed: 660, windup: 0.5, dmg: 0.85, cd: [3, 5] }, { use: 'explode', r: 70, windup: 0.8, dmg: 1, cd: [6, 8] }] },
  anMob_flesh: { name: '肉质增生体', tier: 'normal', arch: 'guard', size: [16, 14, 96], speed: 60, elem: 'dark', art: ['octopus', { hue: -80, sat: 1.1, bright: 0.8 }], skills: [{ use: 'aoe', shape: 'ring', at: 'self', r: 170, r0: 70, windup: 1, dmg: 1.05, cd: [5, 7] }, { use: 'shot', mode: 'homing', n: 2, speed: 220, turn: 2, dmg: 0.8, cd: [4, 6] }] },
};
for (const [id, M] of Object.entries(ANTON_RAID_MOB_DEFS)) regionMonster(ANTON_RAID_SPEC, id, M, false);
// ---- 精英：每个精英 = 一个专属技能组 + 一个破防条件（raid_elite.js）。登记 id 与节点 elites 的 key 一一对应 ----
// 引导模式削弱（plan §4.2）：机制球 4→2、电球数减半、分身 / 龟壳减半、惩罚减半；精英的“护盾”本来就是减伤（不是无敌）= 官方引导的“霸体护甲”思路
const anGuide = () => typeof rmRaidMode === 'function' && rmRaidMode() === 'guide';
function anElite(id, spec, guideP) {
  const E = defineRaidElite(id, spec);
  if (guideP) { const base = spec.p || {}; Object.defineProperty(E, 'p', { enumerable: true, configurable: true, get: () => anGuide() ? { ...base, ...guideP } : base }); }
  return E;
}
const ANTON_RAID_ELITE_MOBS = {
  anElite_devour: { name: '吞噬魔', tier: 'elite', arch: 'aggressive', size: [20, 16, 120], weight: 7, elem: 'dark', art: ['octopus', { hue: 200, sat: 0.8, bright: 0.75 }], skills: [{ use: 'swipe', n: 2, reach: 100, windup: 0.6, dmg: 1.1, cd: [2.5, 3.5] }, { use: 'aoe', shape: 'circle', at: 'self', r: 140, windup: 1, dmg: 1.15, cd: [6, 8] }] },
  anElite_egale: { name: '吞噬之厄伽勒', tier: 'elite', arch: 'aggressive', size: [22, 17, 126], weight: 8, elem: 'dark', art: ['gazer', { hue: 40, sat: 1.2, bright: 1 }], skills: [{ use: 'dash', len: 320, speed: 700, windup: 0.7, dmg: 1.15, cd: [5, 7] }, { use: 'aoe', shape: 'ring', at: 'self', r: 220, r0: 90, windup: 1, dmg: 1.15, cd: [7, 9] }] },
  anElite_ioli: { name: '毁灭之塔伊奥利的炽核', tier: 'elite', arch: 'guard', size: [20, 16, 118], weight: 8, speed: 70, elem: 'fire', art: ['flamehulk', { hue: -10, sat: 1, bright: 0.9 }], skills: [{ use: 'aoe', shape: 'circle', at: 'self', r: 150, windup: 1.1, dmg: 1.2, cd: [5, 7] }, { use: 'shot', mode: 'spread', n: 4, spread: 90, speed: 280, dmg: 0.8, cd: [4, 6] }] },
  anElite_freines: { name: '湮灭之弗雷伊内斯的残像', tier: 'elite', arch: 'kiter', size: [18, 15, 116], weight: 6, elem: 'dark', art: ['phantom', { hue: 260, sat: 1, bright: 0.85 }], skills: [{ use: 'seq', cd: [6, 8], steps: [{ use: 'blink', to: 'behind', dist: 80 }, { use: 'swipe', n: 2, reach: 96, dmg: 1.1 }] }, { use: 'rain', kind: 'hex', n: 4, r: 48, spread: 180, windup: 1, dmg: 1, cd: [7, 9] }] },
  anElite_agnes: { name: '炽炎之艾格尼丝的灼眼', tier: 'elite', arch: 'kiter', size: [18, 15, 120], weight: 6, elem: 'fire', art: ['flameMage', { hue: 0, sat: 1.1, bright: 1 }], skills: [{ use: 'shot', mode: 'homing', n: 3, speed: 240, turn: 2.2, dmg: 0.85, cd: [4, 6] }, { use: 'aoe', shape: 'cross', at: 'self', hw: 28, windup: 1, dmg: 1.2, cd: [7, 9] }] },
  anElite_worm: { name: '熔岩怪虫', tier: 'elite', arch: 'aggressive', size: [24, 18, 90], weight: 8, elem: 'fire', art: ['wcLarva', { hue: -20, sat: 1.3, bright: 1 }], scale: 1.5, skills: [{ use: 'dash', len: 380, speed: 740, windup: 0.8, dmg: 1.25, cd: [5, 7] }, { use: 'aoe', shape: 'circle', at: 'self', r: 130, windup: 1, dmg: 1.1, cd: [6, 8] }] },
  anElite_meltha: { name: '巡视者梅尔塔', tier: 'elite', arch: 'kiter', size: [18, 15, 118], weight: 6, elem: 'light', art: ['gazer', { hue: 160, sat: 1, bright: 1 }], skills: [{ use: 'laser', windup: 0.9, dur: 1, sweep: 60, dmg: 0.45, cd: [5, 7] }, { use: 'shot', mode: 'spread', n: 5, spread: 60, speed: 300, dmg: 0.75, cd: [4, 6] }] },
  anElite_atol: { name: '粉碎者阿托尔', tier: 'elite', arch: 'aggressive', size: [22, 18, 128], weight: 9, elem: 'fire', art: ['golem', { hue: 20, sat: 1.2, bright: 0.95 }], skills: [{ use: 'swipe', clip: 'slam', n: 2, reach: 110, width: 34, windup: 0.7, dmg: 1.25, cd: [3, 4] }, { use: 'leap', r: 120, dmg: 1.25, cd: [6, 8] }] },
  anElite_wraith: { name: '恐怖邪念体', tier: 'elite', arch: 'kiter', size: [17, 14, 112], weight: 6, elem: 'dark', art: ['phantom', { hue: -30, sat: 0.7, bright: 0.6 }], skills: [{ use: 'pool', at: 'target', r: 80, windup: 0.9, linger: 4, zone: 'blind', dmg: 0.3, cd: [7, 9] }, { use: 'shot', mode: 'homing', n: 2, speed: 230, turn: 2.2, dmg: 0.85, cd: [4, 6] }] },
};
for (const [id, M] of Object.entries(ANTON_RAID_ELITE_MOBS)) regionMonster(ANTON_RAID_SPEC, id, M, false);
// 吞噬魔 [研]：打碎它吐出的火 / 冰 / 光 / 暗属性球 → 弱点；没打碎的球被它吸回去回血
anElite('devour', { name: '吞噬魔', mon: 'anElite_devour', type: 'elemBall', p: { every: 7, ballN: 2, need: 4, life: 9 } }, { need: 2 });
// 吞噬之厄伽勒 [研]：黄色精英，杀掉才开启四角孵化所；玩法同样走属性球【原创取舍】
anElite('egale', { name: '吞噬之厄伽勒', mon: 'anElite_egale', type: 'elemBall', p: { every: 8, ballN: 3, need: 3, life: 10, weakDur: 9 } }, { need: 2, ballN: 2 });
// 毁灭之塔伊奥利 [研]：红色加血球爆炸前击杀（= 拦截）
anElite('ioliOrb', { name: '毁灭之塔伊奥利', mon: 'anElite_ioli', type: 'intercept', p: { every: 8, orbN: 3, travel: 6, need: 3, healPct: 0.06 } }, { orbN: 2, need: 2, healPct: 0.03 });
// 湮灭之弗雷伊内斯 [研]：玩家幻影读条前必须杀完，否则全屏秒杀（= 击杀分身；惩罚按团本规则的 punish 比例）
anElite('freinesClone', { name: '湮灭之弗雷伊内斯', mon: 'anElite_freines', type: 'killClone', p: { every: 14, cast: 9, cloneN: 3, punish: 0.5 } }, { cloneN: 2, punish: 0.25 });
// 炽炎之艾格尼丝 [研]：头顶睁眼禁止攻击（反伤），杀分身 / 闭眼进输出窗口
anElite('agnesEye', { name: '炽炎之艾格尼丝', mon: 'anElite_agnes', type: 'eyeGuard', p: { closed: 12, open: 10, cloneN: 3, reflect: 0.12, punish: 0.4 } }, { cloneN: 2, reflect: 0.06, punish: 0.2 });
// 四个孵化所精英 [研]：熔岩怪虫（破龟壳）/ 巡视者梅尔塔（引导球体破坏发电机 → 拦截球）/ 粉碎者阿托尔（领域战 → 破招）/ 恐怖邪念体（找实体 → 击杀分身）
anElite('worm', { name: '熔岩怪虫', mon: 'anElite_worm', type: 'breakShell', p: { shells: 3, hits: 4, regen: 20 } }, { shells: 2, hits: 3 });
anElite('meltha', { name: '巡视者梅尔塔', mon: 'anElite_meltha', type: 'intercept', p: { every: 7, orbN: 3, travel: 6, need: 4, healPct: 0.05 } }, { orbN: 2, need: 2, healPct: 0.025 });
anElite('atol', { name: '粉碎者阿托尔', mon: 'anElite_atol', type: 'counterBreak', p: { every: 9, windup: 2.4, punish: 0.3 } }, { punish: 0.15 });
anElite('wraith', { name: '恐怖邪念体', mon: 'anElite_wraith', type: 'killClone', p: { every: 12, cast: 8, cloneN: 3, punish: 0.45 } }, { cloneN: 2, punish: 0.2 });
// ---- 领主模板：两阶段（100% / 50%），虚弱只来自各自的机制（raidScript，同希洛克）----
const anBoss = (id, name, art, elem, first, second, extra = {}) => regionMonster(ANTON_RAID_SPEC, id, { name, lvl: extra.lvl || 60, size: extra.size || [20, 16, 128], speed: extra.speed || 100, scale: extra.scale ?? 0.9, elem, art, hook: extra.hook, mechs: extra.mechs || [], phases: [{ at: 1, skills: first }, { at: 0.5, enter: extra.enter || { say: `${name}进入第二阶段！` }, skills: second }] }, true);
// 歼灭之内尔贝 [研]：大范围雷阵（撤离）、蓝色电球、落雷电晕（躲角落的罩子）
anBoss('anBoss_nelbe', '歼灭之内尔贝', ['tesla', { hue: 190, sat: 1.1, bright: 1 }], 'light', [{ use: 'rain', clip: 'sigA', kind: 'bolt', n: 6, r: 52, spread: 200, windup: 1, dmg: 1.1, cd: [6, 8] }, { use: 'swipe', clip: 'sigB', n: 3, reach: 110, dmg: 1.1, cd: [3, 4.5] }, { use: 'aoe', clip: 'sigA', shape: 'ring', at: 'self', r: 260, r0: 100, windup: 1.1, dmg: 1.2, cd: [8, 10] }], [{ use: 'laser', clip: 'sigB', windup: 0.9, dur: 1.2, sweep: 90, dmg: 0.45, cd: [7, 9] }, { use: 'mark', clip: 'sigA', delay: 1, r: 70, dmg: 1.1, status: 'stun', cd: [8, 10] }], { scale: 0.85 });
// 毁灭之塔伊奥利 [研]：冲击波（躲）、红色加血球
anBoss('anBoss_ioli', '毁灭之塔伊奥利', ['flamehulk', { hue: -10, sat: 1.1, bright: 1 }], 'fire', [{ use: 'aoe', clip: 'sigA', shape: 'line', at: 'target', hw: 34, windup: 0.9, dmg: 1.25, cd: [4, 6] }, { use: 'leap', clip: 'sigB', r: 120, dmg: 1.3, cd: [6, 8] }], [{ use: 'aoe', clip: 'rage', shape: 'ring', at: 'self', r: 280, r0: 110, windup: 1.1, dmg: 1.25, cd: [8, 10] }, { use: 'rain', clip: 'sigA', kind: 'bolt', n: 5, r: 54, spread: 180, windup: 1, dmg: 1.1, cd: [7, 9] }], { scale: 0.95 });
// 湮灭之弗雷伊内斯 [研]：炔药柱眩晕、玩家幻影
anBoss('anBoss_freines', '湮灭之弗雷伊内斯', ['phantom', { hue: 250, sat: 1.1, bright: 0.9 }], 'dark', [{ use: 'seq', clip: 'atk1', cd: [6, 8], steps: [{ use: 'blink', to: 'behind', dist: 90 }, { use: 'swipe', n: 2, reach: 104, dmg: 1.15 }] }, { use: 'pool', clip: 'sigB', at: 'target', r: 84, windup: 0.9, linger: 4, zone: 'slow', dmg: 0.3, cd: [7, 9] }], [{ use: 'rain', clip: 'sigA', kind: 'hex', n: 6, r: 50, spread: 200, windup: 1, dmg: 1.1, cd: [8, 10] }], { scale: 0.85 });
// 舰炮防御战 [研]：怪物从左往右涌来；守右侧炮充能 3 次，屏幕变红时禁用无色技能 → 做成“守炮读条 ×3 + 红色警报全屏冲击”【原创改编】
anBoss('anBoss_boarder', '登舰突击队长', ['gtTank', { hue: 200, sat: 0.7, bright: 0.85 }], 'dark', [{ use: 'dash', clip: 'sigA', len: 360, speed: 700, windup: 0.8, dmg: 1.2, cd: [5, 7] }, { use: 'shot', clip: 'sigB', mode: 'straight', n: 3, speed: 520, dmg: 0.9, cd: [4, 6] }, { use: 'summon', kind: 'anMob_crawler', n: 2, max: 6, lvlOff: -1, cd: [8, 10] }], [{ use: 'aoe', clip: 'sigA', shape: 'cross', at: 'self', hw: 28, windup: 1, dmg: 1.25, cd: [7, 9] }], { scale: 0.85 });
// 炽炎之艾格尼丝 [研]：睁眼禁攻、分身
anBoss('anBoss_agnes', '炽炎之艾格尼丝', ['flameMage', { hue: 0, sat: 1.2, bright: 1.05 }], 'fire', [{ use: 'shot', clip: 'sigA', mode: 'spread', n: 5, spread: 70, speed: 320, dmg: 0.8, cd: [4, 6] }, { use: 'rain', clip: 'sigB', kind: 'bolt', n: 5, r: 52, spread: 190, windup: 1, dmg: 1.1, cd: [7, 9] }, { use: 'aoe', clip: 'sigA', shape: 'circle', at: 'self', r: 160, windup: 1, dmg: 1.2, cd: [6, 8] }], [{ use: 'laser', clip: 'sigB', windup: 0.8, dur: 1.4, sweep: 100, dmg: 0.45, cd: [7, 9] }], { scale: 0.88 });
// 能量阻截战的守卫【原创】/ 孵化所守卫【原创】/ 感染孵化场守卫【原创】
anBoss('anBoss_egaleCore', '能量核心守卫', ['golem', { hue: 40, sat: 1.3, bright: 1 }], 'light', [{ use: 'swipe', n: 3, reach: 110, dmg: 1.15, cd: [3, 4.5] }, { use: 'aoe', shape: 'ring', at: 'self', r: 240, r0: 100, windup: 1.1, dmg: 1.2, cd: [8, 10] }], [{ use: 'rain', kind: 'bolt', n: 6, r: 50, spread: 200, windup: 1, dmg: 1.1, cd: [7, 9] }], { scale: 0.85 });
anBoss('anBoss_hatchGuard', '孵化所守卫', ['wcBugKing', { hue: -20, sat: 1.2, bright: 0.95 }], 'fire', [{ use: 'dash', len: 380, speed: 740, windup: 0.7, dmg: 1.2, cd: [5, 7] }, { use: 'summon', kind: 'anMob_larva', n: 3, max: 8, lvlOff: -1, cd: [8, 10] }], [{ use: 'aoe', shape: 'circle', at: 'self', r: 200, windup: 1.2, dmg: 1.3, cd: [9, 11] }], { scale: 0.8 });
anBoss('anBoss_infectGuard', '感染孵化场之主', ['octopus', { hue: 270, sat: 1.2, bright: 0.9 }], 'dark', [{ use: 'pool', at: 'target', r: 90, windup: 1, linger: 4, zone: 'slow', dmg: 0.3, cd: [7, 9] }, { use: 'shot', mode: 'homing', n: 3, speed: 230, turn: 2.2, dmg: 0.85, cd: [4, 6] }], [{ use: 'rain', kind: 'hex', n: 6, r: 50, spread: 200, windup: 1, dmg: 1.05, cd: [8, 10] }], { scale: 0.85 });
// 全能之玛特伽 [研]：常驻无敌反伤罩（上勾拳瞬间消失 → 打它吐出金 / 土 / 血 / 风珠 → 引到魔法阵 → 召唤对应精英 → 虚弱）；第二阶段随机火 / 冰 / 光 / 暗属性技能
anBoss('anBoss_mateka', '全能之玛特伽', ['golem', { hue: -10, sat: 1.3, bright: 0.8 }], 'fire',
  [{ use: 'swipe', clip: 'sigA', n: 2, reach: 128, width: 38, windup: 0.6, dmg: 1.3, cd: [3, 4.5] }, { use: 'leap', clip: 'sigB', r: 130, dmg: 1.3, cd: [6, 8] }],
  [{ use: 'rain', clip: 'sigA', kind: 'bolt', n: 6, r: 54, spread: 220, windup: 1, dmg: 1.15, cd: [7, 9] }, { use: 'aoe', clip: 'sigB', shape: 'ring', at: 'self', r: 280, r0: 110, windup: 1, dmg: 1.25, cd: [8, 10] }, { use: 'laser', clip: 'sigA', windup: 0.8, dur: 1.4, sweep: 100, dmg: 0.45, cd: [7, 9] }], { scale: 1.1, size: [26, 20, 150] });
// 安徒恩的心脏 ×5【原创】：左心房（掩埋）/ 右心房（聚集槽）/ 主动脉（朝向）/ 静脉丛（路线）/ 核心（全部 + 输出窗口）
const anHeart = (n, name, elem, first, second, extra = {}) => anBoss('anBoss_heart' + n, name, ['octopus', { hue: -80 - n * 6, sat: 1.2, bright: 0.85 }], elem, first, second, { scale: 1.1, size: [26, 20, 140], ...extra });
anHeart(1, '安徒恩的左心房', 'dark', [{ use: 'shot', mode: 'spread', n: 6, spread: 80, speed: 300, dmg: 0.8, cd: [4, 6] }, { use: 'aoe', shape: 'circle', at: 'self', r: 150, windup: 1, dmg: 1.2, cd: [6, 8] }], [{ use: 'rain', kind: 'bolt', n: 6, r: 50, spread: 200, windup: 1, dmg: 1.1, cd: [8, 10] }]);
anHeart(2, '安徒恩的右心房', 'fire', [{ use: 'swipe', n: 3, reach: 112, dmg: 1.2, cd: [3, 4.5] }, { use: 'aoe', shape: 'ring', at: 'self', r: 230, r0: 90, windup: 1, dmg: 1.2, cd: [7, 9] }], [{ use: 'pull', mode: 'in', r: 300, force: 280, dur: 1, windup: 0.8, dmg: 0.4, cd: [9, 12] }]);
anHeart(3, '安徒恩的主动脉', 'light', [{ use: 'laser', windup: 0.9, dur: 1.2, sweep: 70, dmg: 0.45, cd: [5, 7] }, { use: 'dash', len: 360, speed: 720, windup: 0.7, dmg: 1.2, cd: [6, 8] }], [{ use: 'rain', kind: 'hex', n: 6, r: 50, spread: 200, windup: 1, dmg: 1.1, cd: [8, 10] }]);
anHeart(4, '安徒恩的静脉丛', 'dark', [{ use: 'pool', at: 'target', r: 90, windup: 0.9, linger: 4, zone: 'blind', dmg: 0.3, cd: [7, 9] }, { use: 'shot', mode: 'homing', n: 3, speed: 240, turn: 2.2, dmg: 0.85, cd: [4, 6] }], [{ use: 'aoe', shape: 'cross', at: 'self', hw: 28, windup: 1, dmg: 1.25, cd: [7, 9] }]);
anHeart(5, '安徒恩的心脏', 'fire', [{ use: 'swipe', n: 4, reach: 130, width: 40, windup: 0.55, dmg: 1.35, cd: [2.4, 3.6] }, { use: 'shot', mode: 'arc', n: 4, speed: 300, spread: 120, r: 72, dmg: 0.88, cd: [5, 7] }], [{ use: 'laser', windup: 0.8, dur: 1.6, sweep: 110, dmg: 0.5, cd: [7, 9] }, { use: 'rain', kind: 'bolt', n: 7, r: 50, spread: 220, windup: 0.9, dmg: 1.2, cd: [8, 10] }], { lvl: 62, scale: 1.25, size: [30, 22, 160], speed: 108 });
// ---- 机制数量随人数 / 模式变化（引导 = 机制球 4→2、电球数少）：puzzle 里写 getter，机制实例化时才取值 ----
const anMembers = () => (typeof raidNet !== 'undefined' && raidNet.S && raidNet.S.members ? raidNet.S.members.filter(m => !m.left).length : 2);
const anOrbN = () => anGuide() ? 2 : Math.max(3, Math.min(6, Math.ceil(anMembers() / 2)));   // 内尔贝电球：每人拦一颗（【原创】上限 6）
const anBallN = () => anGuide() ? 2 : 4;   // 玛特伽「打字」机制球 4 → 2
// ---- 领主机制脚本（raid_mech_rt 的 raidScript，同希洛克的数据格式；出场无敌 ≤ 3 秒）----
const AN_CROUCH = (name, o = {}) => ({ use: 'crouch', name, windup: 2.0, hurt: 0.3, ...o });
const ANTON_RAID_SCRIPTS = {
  // 内尔贝：蓝色电球（每人拦一颗，漏了回血 → 用 clear 法阵表示拦截）；落雷电晕后躲角落罩子（蹲伏 / 躲开）[研]
  anBoss_nelbe: { intro: { dur: 2.5, say: '歼灭之内尔贝：黑雾之源的领主' },
    atk: [{ every: [26, 32], first: 14, puzzle: { use: 'clear', name: '蓝色电球拦截', get n() { return anOrbN(); }, hold: 0.8, grow: 0, r: 46, dur: 14, col: '#6ab8ff', label: '电球', failHurt: 0.2 } }, { every: [34, 40], first: 28, puzzle: AN_CROUCH('落雷 · 躲进角落的罩子') }],
    weak: { at: [0.6, 0.25], pool: [{ use: 'dps', name: '雷阵过载', need: 0.06, dur: 12 }] }, onSolve: { dur: 8, mul: 1.5 }, onFail: { frac: 1, down: true },
    lines: { intro: '雷霆，将这里夷为平地。', cast: '落雷！', solve: '电流……乱了？' } },
  anBoss_ioli: { intro: { dur: 2.5 }, atk: [{ every: [24, 30], first: 12, puzzle: AN_CROUCH('冲击波') }],
    weak: { at: [0.65, 0.3], pool: [{ use: 'clear', name: '炽热核心', n: 3, hold: 1, grow: 0, r: 46, dur: 16, col: '#ff7a4a', label: '核心' }] }, onSolve: { dur: 8, mul: 1.5 }, lines: { intro: '毁灭——一切。', solve: '核心……熄了。' } },
  anBoss_freines: { intro: { dur: 2.5 }, atk: [{ every: [26, 32], first: 14, puzzle: { use: 'burial', name: '炔药柱眩晕', hits: 9, dur: 6, hurt: 0.3 } }],
    weak: { at: [0.65, 0.3], pool: [{ use: 'realBody', name: '玩家幻影', n: 4, rounds: 2, dur: 22, every: 2.2, col: '#c090ff', maxWrong: 2 }] }, onSolve: { dur: 8, mul: 1.5 }, onFail: { frac: 1, down: true, say: '幻影读条完成：全屏湮灭！' }, lines: { intro: '湮灭……', cast: '看着你的影子。' } },
  anBoss_boarder: { intro: { dur: 2 }, atk: [{ every: [30, 36], first: 18, puzzle: AN_CROUCH('红色警报 · 舰炮齐射') }],
    weak: { at: [0.75, 0.5, 0.25], pool: [{ use: 'dps', name: '舰炮充能', need: 0.05, dur: 14, onSolve: { dur: 0, say: '右舷炮充能 +1！' }, cast: { name: '舰炮充能（守右侧炮）' } }] }, onFail: { frac: 1, down: true, say: '舰炮故障！' } },
  anBoss_agnes: { intro: { dur: 2.5 }, atk: [{ every: [22, 28], first: 10, puzzle: { use: 'reflect', name: '睁眼 · 禁止攻击', dur: 14, on: 3, off: 3, hurt: 0.04, maxBad: 5 } }],
    weak: { at: [0.7, 0.4, 0.15], pool: [{ use: 'realBody', name: '炽炎分身', n: 4, rounds: 2, dur: 22, every: 2.2, col: '#ff8a4a', maxWrong: 2 }] }, onSolve: { dur: 8, mul: 1.5 }, lines: { intro: '看着我，然后燃烧。', cast: '别睁眼看——不，别动手！', solve: '眼睛……闭上了。' } },
  anBoss_egaleCore: { intro: { dur: 2.5 }, atk: [{ every: [28, 34], first: 14, puzzle: AN_CROUCH('能量过载') }], weak: { at: [0.6], pool: [{ use: 'dps', name: '核心裸露', need: 0.06, dur: 12 }] }, onSolve: { dur: 8, mul: 1.5 } },
  anBoss_hatchGuard: { intro: { dur: 2 }, atk: [{ every: [28, 34], first: 14, puzzle: AN_CROUCH('孵化冲击') }], weak: { at: [0.6], pool: [{ use: 'dps', name: '破壳', need: 0.06, dur: 12 }] }, onSolve: { dur: 8, mul: 1.5 } },
  anBoss_infectGuard: { intro: { dur: 2 }, atk: [{ every: [36, 40], first: 8, puzzle: { use: 'gauge', name: '紫色感染', dur: 24, rate: 4.5, bump: 14, hurt: 0.3, maxBad: 9 } }] },
  // 玛特伽：反伤罩常驻；上勾拳后罩子消失（虚弱池里的「破招」= dps 窗口）→ 打字机制（属性球 = 金土血风，机制球 4→2）→ 精英合围后虚弱 [研][存疑]
  anBoss_mateka: { intro: { dur: 3, say: '全能之玛特伽：反伤罩展开' }, atk: [{ every: [24, 30], first: 12, puzzle: AN_CROUCH('上勾拳 · 震地') }],
    weak: { at: [0.75, 0.5, 0.25], pool: [{ use: 'orbs', name: '打字：金 · 土 · 血 · 风', get hits() { return anGuide() ? 2 : 3; }, dur: 22 }, { use: 'dps', name: '破招：上勾拳', need: 0.06, dur: 12 }] },
    onSolve: { dur: 9, mul: 1.6 }, onFail: { frac: 1, down: true, say: '反伤罩爆发！' }, lines: { intro: '全能……是我。', cast: '字，落下。', solve: '罩子……碎了？' } },
  // 心脏【原创】
  anBoss_heart1: { intro: { dur: 2 }, atk: [{ every: [26, 32], first: 14, puzzle: { use: 'burial', name: '血栓掩埋', hits: 9, dur: 6 } }], weak: { at: [0.6], pool: [{ use: 'dps', name: '搏动停顿', need: 0.06, dur: 12 }] }, onSolve: { dur: 8, mul: 1.5 } },
  anBoss_heart2: { intro: { dur: 2 }, atk: [{ every: [34, 40], first: 6, puzzle: { use: 'gauge', name: '血压升高', dur: 24, rate: 4.5, bump: 14, hurt: 0.3, maxBad: 9 } }], weak: { at: [0.6], pool: [{ use: 'dps', name: '瓣膜裸露', need: 0.06, dur: 12 }] }, onSolve: { dur: 8, mul: 1.5 } },
  anBoss_heart3: { intro: { dur: 2 }, atk: [{ every: [26, 32], first: 14, puzzle: { use: 'facing', name: '血流冲击', mode: 'random', windup: 2.4, hurt: 0.2 } }], weak: { at: [0.6], pool: [{ use: 'dps', name: '血管破裂', need: 0.06, dur: 12 }] }, onSolve: { dur: 8, mul: 1.5 } },
  anBoss_heart4: { intro: { dur: 2 }, atk: [{ every: [30, 36], first: 14, puzzle: { use: 'path', name: '静脉迷宫', cols: 6, rows: 3, dur: 12, hurt: 0.15, maxFalls: 99 } }], weak: { at: [0.6], pool: [{ use: 'clear', name: '栓塞清除', n: 3, hold: 1, grow: 0, r: 44, dur: 16, col: '#ff6a8a', label: '栓塞' }] }, onSolve: { dur: 8, mul: 1.5 } },
  anBoss_heart5: { intro: { dur: 3, say: '安徒恩的心脏开始搏动' }, atk: [{ every: [24, 30], first: 12, puzzle: AN_CROUCH('心跳震荡') }, { every: [34, 40], first: 26, puzzle: { use: 'burial', name: '血潮吞没', hits: 9, dur: 6 } }],
    weak: { at: [0.7, 0.4, 0.15], pool: [{ use: 'dps', name: '心跳停顿', need: 0.06, dur: 12 }, { use: 'clear', name: '栓塞清除', n: 4, hold: 1, grow: 0, r: 44, dur: 16, col: '#ff6a8a', label: '栓塞' }] }, onSolve: { dur: 9, mul: 1.6 }, onFail: { frac: 1, down: true, say: '心脏爆裂！' }, lines: { intro: '咚——咚——', low: '安徒恩……不会停。' } },
};
for (const [id, spec] of Object.entries(ANTON_RAID_SCRIPTS)) { const D = MON[id]; if (D) (D.msMechs ??= []).push({ use: 'raidScript', ...spec }); }
// ---- 固定房间结构：准备房 / 小怪 / 精英 / 小怪 / 领主（精英房写 eliteSpec = 破防条件登记 id）----
const ANTON_RAID_COMMON = { raid: true, hidden: true, layout: 'raid', branches: 0, cols: 5, rows: 1, rooms: 5, bossAdds: 0, lvl: [58, 60], clearExp: 0, bgm: 'dungeon', bossBgm: 'boss' };
const anLine = (n, o = {}) => ({ cols: n, rows: 1, rooms: Array.from({ length: n }, (_, i) => ({ at: [i, 0], ...(i === 0 ? { prep: true } : {}), ...(i === n - 1 ? { type: 'boss' } : {}), ...((o.rooms || {})[i] || {}) })), start: 0, boss: n - 1 });
const anElRoom = (mon, spec) => ({ type: 'elite', elite: mon, eliteSpec: spec });
const ANTON_RAID_MOBS = {
  hull: [['anMob_crawler', 3], ['anMob_fogling', 2]],
  magma: [['anMob_slag', 2], ['anMob_larva', 3], ['anMob_fogling', 1]],
  flesh: [['anMob_flesh', 2], ['anMob_larva', 2], ['anMob_crawler', 2]],
};
const defineAntonRaid = (id, name, theme, mobs, elite, boss, extra = {}) => defineDungeon(id, { ...ANTON_RAID_COMMON, ...extra, id, name, theme, mobs: ANTON_RAID_MOBS[mobs] || mobs, elite, boss: { kind: boss, lvl: extra.bossLvl || 60 }, desc: `【安徒恩攻坚】${name}。团本节点专用地图，不消耗疲劳。` });
const anEl = (mon, spec) => anLine(5, { rooms: { 2: anElRoom(mon, spec) } });
// P1 阻截战
defineAntonRaid('raid_an_fog', '黑雾之源', 'anRaidHull', 'hull', 'anElite_devour', 'anBoss_nelbe', { fixed: anEl('anElite_devour', 'devour') });
defineAntonRaid('raid_an_quake_a', '震颤的大地 A', 'anRaidHull', 'hull', 'anElite_ioli', 'anBoss_ioli', { fixed: anEl('anElite_ioli', 'ioliOrb') });
defineAntonRaid('raid_an_quake_b', '震颤的大地 B', 'anRaidHull', 'hull', 'anElite_freines', 'anBoss_freines', { fixed: anEl('anElite_freines', 'freinesClone') });
defineAntonRaid('raid_an_cannon', '舰炮防御战', 'anRaidHull', 'hull', 'anMob_crawler', 'anBoss_boarder', { fixed: anLine(4) });
defineAntonRaid('raid_an_pillar', '擎天之柱', 'anRaidMagma', 'magma', 'anElite_agnes', 'anBoss_agnes', { fixed: anEl('anElite_agnes', 'agnesEye') });
// P2 焦杀战
defineAntonRaid('raid_an_egale', '能量阻截战', 'anRaidMagma', 'magma', 'anElite_egale', 'anBoss_egaleCore', { fixed: anEl('anElite_egale', 'egale') });
defineAntonRaid('raid_an_hatch_worm', '孵化所 · 熔岩怪虫', 'anRaidMagma', 'magma', 'anElite_worm', 'anBoss_hatchGuard', { fixed: anEl('anElite_worm', 'worm') });
defineAntonRaid('raid_an_hatch_meltha', '孵化所 · 巡视者梅尔塔', 'anRaidMagma', 'magma', 'anElite_meltha', 'anBoss_hatchGuard', { fixed: anEl('anElite_meltha', 'meltha') });
defineAntonRaid('raid_an_hatch_atol', '孵化所 · 粉碎者阿托尔', 'anRaidMagma', 'magma', 'anElite_atol', 'anBoss_hatchGuard', { fixed: anEl('anElite_atol', 'atol') });
defineAntonRaid('raid_an_hatch_wraith', '孵化所 · 恐怖邪念体', 'anRaidMagma', 'magma', 'anElite_wraith', 'anBoss_hatchGuard', { fixed: anEl('anElite_wraith', 'wraith') });
defineAntonRaid('raid_an_infect', '紫色感染孵化场', 'anRaidFlesh', 'flesh', 'anMob_flesh', 'anBoss_infectGuard', { fixed: anLine(4) });
defineAntonRaid('raid_an_volcano', '黑色火山', 'anRaidMagma', 'magma', 'anMob_slag', 'anBoss_mateka', { fixed: anLine(3), bgm: 'abyss', bossLvl: 61 });
for (let i = 1; i <= 5; i++) defineAntonRaid('raid_an_heart_' + i, `安徒恩的心脏 ${i}`, 'anRaidFlesh', 'flesh', 'anMob_flesh', 'anBoss_heart' + i, { fixed: i === 5 ? anLine(2) : anLine(3), bgm: 'abyss', bossLvl: i === 5 ? 62 : 61 });
// 奖励表里的融合装备以 raid_anton.js（规则）写死的 key 为准；这里只做一致性校验（物品文件加载后）
if (typeof ANTON_RAID_GEAR !== 'undefined' && RAID_DEFS.anton) { const want = RAID_DEFS.anton.rewards.p2[1].table[1][1].pick; for (const k of want) if (!ANTON_RAID_GEAR.includes(k)) console.warn('安徒恩奖励 key 没有对应物品：' + k); }
