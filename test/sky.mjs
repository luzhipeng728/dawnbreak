// 天空之城测试：数据完整性 + 每种新怪物都能生成 / 会出手 / 能被打死；每个领主的每一招都强制放一遍（看有没有报错、有没有地面预警）
// 用法：node build.mjs --offline && node test/sky.mjs [怪物id,...]
// 截图：test/shots/sky/<怪物>.png（请人工看图）；机器人通关另用 test/botrun.mjs（见 docs/CONTENT_GUIDE.md）
import { regionMonsterTest } from './region_monsters.mjs';
const fail = await regionMonsterTest({
  name: 'sky',
  normal: ['wyvern', 'wyvernBlue', 'dragonman', 'minius', 'puppeteer', 'puppeteerRock', 'puppeteerIce', 'golem', 'golemBronze', 'golemMaster', 'kargo', 'kargoGoggle', 'expeller', 'expellerAxe', 'knight', 'hughes', 'lucasClone', 'dragonStatue'],
  boss: ['lucas', 'dogrey', 'platani', 'skyExpeller', 'seghart', 'sinEye'],
  dungeons: ['dragon_tower', 'puppet_hall', 'golem_tower', 'dark_corridor', 'lord_palace', 'floating_castle'],
  scenes: ['sky_castle'],
  only: process.argv[2] ? process.argv[2].split(',') : null,
  setup: { dragonStatue: 'm => { m.control = skyStatueAI; m.aiCd = 0.5; }' },
});
process.exit(fail ? 1 : 0);
