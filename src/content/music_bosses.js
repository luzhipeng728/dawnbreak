/* =====================================================================
   领主曲（BOSS_PLAN B12）：每个区域一首程序合成的领主房曲 + 攻坚一首，复用 engine/music.js 的编曲零件（partMel / partChug / partDrums …）
   选曲：领主房进场时 bossTrack(def)（game/dungeon.js、content/abyss.js 调用）：
     def.bossBgm 写了具体曲目（不是通用的 'boss'）就用它 → 攻坚（region spec 的 layout: 'raid'）→ 深渊 → 区域 id / 老世界的地下城表 → 通用 'boss'
   新区域想要自己的领主曲：SONGS 里加 boss_<区域 id>，或者 spec 里写 bossBgm。
   ===================================================================== */
Object.assign(SONGS, {
  boss_grand: { bpm: 146, root: 53, scale: MINOR, chords: [[0, 'm'], [8, 'M'], [10, 'M'], [7, 'M'], [0, 'm'], [5, 'm'], [8, 'M'], [7, 'M']],   // 格兰之森：粗犷的森林战鼓 + 号角
    parts: [partBass('x..x..x.x..x..5.', 'sawbass', -12, 0.09), partArp([0, 2, 1, 2], 2, 'pluck', -12, 0.05),
      partMel('0 . 2 . 4 . 3 2 0 . . . 2 . 4 . 7 . 6 . 4 . 3 . 2 . . . - . 4 . 7 . 9 . 8 . 7 . 4 . 6 . 4 . 2 . 3 . 0 . . -', 'horn', 12, 0.075),
      partDrums({ t: 'l.hl..l.l.hl.m..', k: 'x..x..x.x.......', s: '............x...', crash: 4 }, 1.05)] },
  boss_sky: { bpm: 158, root: 57, scale: MINOR, wet: 1.3, chords: [[0, 'm'], [10, 'M'], [8, 'M'], [7, 'M'], [0, 'm'], [3, 'M'], [8, 'M'], [7, 'M']],   // 天空之城：云端的急促竖琴 + 弦乐
    parts: [partArp([0, 1, 2, 3, 4, 3, 2, 1], 1, 'bell', 12, 0.02), partPad('strings', -12, 0.02, 8), partBass('x.x.x.x.x.x.x.x.', 'bass', -12, 0.1),
      partMel('7 . 9 . 11 . 9 7 8 . . . 7 . 5 . 4 . 5 . 7 . 8 9 11 . . . 9 . 7 . 12 . 11 . 9 . 11 . 14 . 12 . 11 . 9 . 7 . . -', 'synlead', 12, 0.05),
      partDrums({ k: 'x...x...x...x.x.', s: '....x.......x...', h: 'x.x.x.x.x.x.x.xo', crash: 2 }, 0.9)] },
  boss_behemoth: { bpm: 108, root: 43, scale: MINOR, wet: 1.2, chords: [[0, 'm'], [1, 'M'], [0, 'm'], [6, 'd'], [0, 'm'], [1, 'M'], [10, 'M'], [6, 'd']],   // 天帷巨兽：缓慢沉重的心跳，不协和的低音
    parts: [partBass('x.......x.......', 'sawbass', -12, 0.13), partPad('pad', -12, 0.026, 16), partBells(0.05),
      partMel('0 . . . 1 . . . 0 . . . 3 . 2 . 1 . . . 0 . . . 6 . . . 5 . . .', 'horn', 0, 0.09, 4),
      partDrums({ t: 'l.......l...l...', k: 'x.......x..x....', s: '............x...', crash: 4 }, 1.1)] },
  boss_darkelf: { bpm: 138, root: 48, scale: MINOR, wet: 1.2, chords: [[0, 'm'], [7, 'M'], [5, 'm'], [7, 'M'], [0, 'm'], [8, 'M'], [7, 'M'], [0, 'm']],   // 暗精灵：诡异的和声小调，短促的弦乐
    parts: [partChug('x.x.xx..x.x.xx..', -12, 0.045), partBass('x.x.x.x.x.x.x.x.', 'bass', -12, 0.1), partArp([0, 3, 1, 4], 1, 'pluck', 12, 0.03),
      partMel('4 . 3 . 4 . 6# . 7 . 6# . 4 . 3 . 0 . 2 . 3 . 4 . 3 . . . 2 . . . 4 . 6# . 7 . 9 . 8 . 7 . 6# . 4 . 3 . 4 . . -', 'lead', 12, 0.05),
      partDrums({ k: 'x..x..x.x..x..x.', s: '....x.......x...', h: 'x.xxx.xxx.xxx.xx', crash: 4 }, 0.95)] },
  boss_snow: { bpm: 126, root: 59, scale: MINOR, wet: 1.5, chords: [[0, 'm'], [8, 'M'], [3, 'M'], [10, 'M'], [0, 'm'], [5, 'm'], [8, 'M'], [7, 'M']],   // 万年雪山：冰晶般的钢琴 + 铃 + 宽阔的弦乐
    parts: [partArp([0, 2, 4, 2], 2, 'piano', 0, 0.05), partPad('strings', -12, 0.022, 8), partBass('x.......x.....5.', 'bass', -24, 0.12), partBells(0.045),
      partMel('4 . . 3 4 . 7 . 9 . 7 . 4 . . - 5 . 4 . 3 . 4 . 7 . . . - . 9 . 11 . 12 . 11 . 9 . 7 . 9 . 8 . 7 . 4 . . -', 'synlead', 12, 0.05),
      partDrums({ k: 'x.....x.x.......', s: '....x.......x...', h: 'x...x...x...x...', crash: 4 }, 0.85)] },
  boss_ancient: { bpm: 116, root: 40, scale: MINOR, chords: [[0, 'm'], [0, 'm'], [10, 'M'], [0, 'm'], [0, 'm'], [8, 'M'], [10, 'M'], [7, 'M']],   // 远古：原始的鼓阵 + 低沉的号角
    parts: [partChug('x..x..x.x..x..x.', -12, 0.07), partBass('x..x..x.x..x..x.', 'sawbass', -12, 0.1),
      partMel('0 . . . 0 . 2 . 3 . . . 2 . 0 . 0 . . . 3 . 4 . 5 . . . 4 . 3 .', 'horn', 12, 0.09, 4),
      partDrums({ t: 'l.hl.hl.l.hl.hl.', k: 'x..x..x.x..x..x.', s: '....x.......x...', crash: 2 }, 1.15)] },
  boss_gent: { bpm: 152, root: 45, scale: MINOR, chords: [[0, 'm'], [0, 'm'], [8, 'M'], [10, 'M'], [0, 'm'], [3, 'M'], [8, 'M'], [7, 'M']],   // 根特：卡勒特的军乐 + 蒸汽机械的铜管
    parts: [partChug('x.x.x.x.x.x.x.xX', -12, 0.05), partBass('x.xxx.xxx.xxx.xx', 'sawbass', -12, 0.085), partPad('strings', -12, 0.014, 8),
      partMel('0 . 0 . 2 . 3 . 4 . . . 3 . 2 . 0 . 0 . 4 . 5 . 7 . . . 5 . 4 . 7 . 7 . 8 . 7 . 5 . 4 . 3 . 2 . 4 . . -', 'brass', 12, 0.06),
      partDrums({ k: 'x...x...x...x...', s: '..x.x.x...x.x.x.', h: 'xxxxxxxxxxxxxxxx', crash: 2 }, 0.95)] },
  boss_train: { bpm: 164, root: 55, scale: MINOR, chords: [[0, 'm'], [10, 'M'], [8, 'M'], [10, 'M'], [0, 'm'], [3, 'M'], [10, 'M'], [7, 'M']],   // 海上列车：车轮般的切分节奏 + 失真吉他
    parts: [partChug('xx.xx.xxx.xx.xx.', -12, 0.055), partBass('x.x.x.x.x.x.x.x.', 'sawbass', -12, 0.08), partArp([0, 1, 2, 1], 1, 'pluck', 12, 0.025),
      partMel('0 . 2 . 4 . 4 . 3 . 2 . 4 . . . 7 . 5 . 4 . 2 . 4 . 3 . 0 . . . 0 . 2 . 4 . 7 . 9 . 7 . 5 . 4 . 3 . 4 . . -', 'lead', 12, 0.055),
      partDrums({ k: 'x.x.x.x.x.x.x.x.', s: '....x.......x.x.', h: 'xxxxxxxxxxxxxxxx', crash: 4 }, 1)] },
  boss_timegate: { bpm: 136, root: 52, scale: MINOR, wet: 1.3, chords: [[0, 'm'], [8, 'M'], [10, 'M'], [7, 'M'], [0, 'm'], [3, 'M'], [5, 'm'], [7, 'M']],   // 时空之门：时钟般的钟琴琶音 + 宏大的弦乐
    parts: [partArp([0, 2, 4, 2, 3, 1, 4, 1], 1, 'bell', 12, 0.024), partPad('strings', -12, 0.02, 8), partBass('x..x..x.x..x..x.', 'bass', -12, 0.1),
      partMel('7 . . 6 7 . 9 . 11 . . 9 7 . . - 8 . 7 . 5 . 7 . 9 . . . 12 . 11 .', 'horn', 12, 0.07, 2),
      partDrums({ k: 'x...x...x...x...', s: '....x.......x...', sh: 'x.x.x.x.x.x.x.x.', crash: 4 }, 0.9)] },
  boss_siroco: { bpm: 100, root: 46, scale: MINOR, wet: 1.6, chords: [[0, 'm'], [0, 'd'], [1, 'M'], [6, 'd'], [0, 'm'], [3, 'M'], [1, 'M'], [0, 'd']],   // 希洛克：缓慢逼近的不协和合唱式长音
    parts: [partPad('strings', 0, 0.026, 16), partPad('pad', -12, 0.02, 16), partBass('x...............', 'bass', -24, 0.14), partBells(0.06),
      partMel('4 . . . . . 3 . . . . . 1 . . . 0 . . . 6 . . . 4 . . . - . . .', 'horn', 12, 0.08, 4),
      partDrums({ t: 'l.......l.......', k: 'x.......x..x....', crash: 4 }, 1.05)] },
  boss_abyss: { bpm: 90, root: 44, scale: MINOR, wet: 1.8, chords: [[0, 'm'], [1, 'M'], [0, 'd'], [6, 'M'], [0, 'm'], [1, 'M'], [10, 'M'], [0, 'd']],   // 深渊：低频脉动 + 阴森的钟声，鼓点渐密
    parts: [partBass('x..x..x.x..x..x.', 'sawbass', -24, 0.14), partPad('pad', -12, 0.022, 16), partBells(0.07), partArp([0, 1, 2, 3], 4, 'bell', 0, 0.03),
      partDrums({ k: 'x..x..x.x..x..x.', t: '......l.......l.', s: '............x...', crash: 4 }, 1)] },
  boss_raid: { bpm: 168, root: 47, scale: MINOR, chords: [[0, 'm'], [1, 'M'], [0, 'm'], [10, 'M'], [8, 'M'], [10, 'M'], [0, 'm'], [7, 'M']],   // 攻坚：全乐队——失真吉他 + 铜管 + 弦乐 + 战鼓
    parts: [partChug('xxxxxxxxX.x.x.xX', -12, 0.06), partBass('xxxxxxxxxxxxxxxx', 'sawbass', -12, 0.09), partPad('strings', -12, 0.018, 8),
      partMel('7 . 7 6 7 . 9 . 8b . 7 . 8b . 11 . 12 . 11 . 9 . 8b . 7 . . . - . 11 . 12 . 14 . 12 . 11 . 12 . 14 . 16 . 14 . 12 . 11 . . -', 'brass', 12, 0.065),
      partMel('7 . . . 8b . . . 7 . . . 4 . . . 5 . . . 8b . . . 10 . . . 7 . . .', 'horn', 0, 0.06, 4),
      partDrums({ k: 'x.x.x.x.x.x.x.x.', s: '....x.......x...', h: 'xxxxxxxxxxxxxxxx', t: '..............hl', crash: 2 }, 1.1)] },
});
const BOSS_TRACK_OF = {
  lorien: 'grand', lorien_deep: 'grand', dark_woods: 'grand', dark_woods_deep: 'grand', thunder_ruins: 'grand', venom_ruins: 'grand', frozen_woods: 'grand', graca: 'grand', blazing_graca: 'grand', dark_thunder: 'grand',
  dragon_tower: 'sky', puppet_hall: 'sky', golem_tower: 'sky', dark_corridor: 'sky', lord_palace: 'sky', floating_castle: 'sky',
  temple_outskirts: 'behemoth', treant_jungle: 'behemoth', purgatory: 'behemoth', polar_day: 'behemoth', second_spine: 'behemoth', forbidden_land: 'behemoth',
};
function bossTrack(def) {
  if (def.bossBgm && def.bossBgm !== 'boss' && SONGS[def.bossBgm]) return def.bossBgm;
  const G = def.region && typeof REGIONS !== 'undefined' && REGIONS[def.region] && REGIONS[def.region].spec.dungeons[def.id];
  if (G && G.layout === 'raid') return 'boss_raid';
  if (def.abyss) return 'boss_abyss';
  const k = def.region || BOSS_TRACK_OF[def.id];
  return k && SONGS['boss_' + k] ? 'boss_' + k : def.bossBgm || 'boss';
}
