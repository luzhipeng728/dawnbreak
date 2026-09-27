// 长时间测试：机器人连续多次通关同一地下城（结算后点“再次挑战”），每轮强制 GC 后记录堆内存、实体/特效数量、帧率
import { launch, URL_BASE } from './lib.mjs';
const id = process.argv[2] || 'abyss', rounds = +(process.argv[3] || 3), lv = +(process.argv[4] || 21);
const { browser, page, logs } = await launch({ width: 1280, height: 720 });
await page.goto(`${URL_BASE}?dungeon=${id}&bot&mute&lv=${lv}&cls=${process.env.CLS || 'sword'}`);
await page.waitForFunction(() => window.__READY);
await page.evaluate(() => { game.speedMul = 3; });
const mem = () => page.evaluate(() => { if (window.gc) gc(); return { heapMB: +(performance.memory.usedJSHeapSize / 1048576).toFixed(1), ents: ents.length, fx: fxList.length, projs: projs.length, drops: drops.length, ground: groundFx.length, dom: document.getElementsByTagName('*').length, fps: Math.round(fps), voices: sfx.voices }; });
console.log('start', JSON.stringify(await mem()));
for (let r = 0; r < rounds; r++) {
  for (let i = 0; i < 200 && !(await page.evaluate(() => window.__botDone)); i++) { await page.waitForTimeout(3000); if (i % 10 === 9) console.log('  …', JSON.stringify(await page.evaluate(() => { const D = game.dungeon; return D ? { st: D.state, room: D.layout.rooms.indexOf(D.room), boss: D.boss ? Math.round(D.boss.hp / D.boss.hpMax * 100) : null, t: Math.round(D.t), hp: Math.round(game.player.hp), menus: menus.stack.join(','), mobs: ents.filter(e => e.team === 'e' && !e.dead).length, doors: D.doorsOpen, px: Math.round(game.player.x), py: Math.round(game.player.y) } : { scene: game.scene, menus: menus.stack.join(',') }; }))); }
  const d = await page.evaluate(() => window.__botDone);
  console.log('round', r + 1, JSON.stringify(d), JSON.stringify(await mem()));
  await page.evaluate(() => { window.__botDone = null; bot.flipped = false; bot.resT = 0; save.data.fatigue = FATIGUE_MAX; });
  await page.click('text=再次挑战'); await page.waitForTimeout(1500);
}
console.log('LOGS', JSON.stringify(logs.filter(l => l.type !== 'warning').slice(0, 5)));
await browser.close();
