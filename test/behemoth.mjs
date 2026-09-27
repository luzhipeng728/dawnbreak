// 天帷巨兽测试：数据完整性 + 每种新怪物都能生成 / 会出手 / 能被打死；每个领主的每一招都强制放一遍（看有没有报错、有没有地面预警）
// 用法：node build.mjs --offline && node test/behemoth.mjs [怪物id,...]
// 截图：test/shots/behemoth/<怪物>.png（请人工看图）；路线测试 test/behemoth_route.mjs；机器人通关 test/botrun.mjs
import { regionMonsterTest } from './region_monsters.mjs';
const fail = await regionMonsterTest({
  name: 'behemoth',
  normal: ['gblBeliever', 'gblPriest', 'gblShaman', 'gblBishop', 'gblRevPriest', 'gblRevShaman', 'gblRevBishop', 'octopus', 'octopusBlue', 'babyOcto', 'yaksha', 'treant', 'treantDark', 'flower',
    'dragonCannon', 'fireCannon', 'laserCannon', 'sawCart', 'donnier', 'gardenerRul', 'blackOctopus', 'gblHighPriest'],
  boss: ['gblArchbishop', 'rodin', 'yakshaKing', 'donnierEX', 'lotus', 'marcel'],
  dungeons: ['temple_outskirts', 'treant_jungle', 'purgatory', 'polar_day', 'second_spine', 'forbidden_land'],
  scenes: ['behemoth', 'behemoth_spine'],
  near: ['flower'],   // 扎根不动的怪：生成在玩家身边
  only: process.argv[2] ? process.argv[2].split(',') : null,
});
process.exit(fail ? 1 : 0);
