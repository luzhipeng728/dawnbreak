// 全流程测试：标题 → 选职业 → 艾尔文防线 → NPC 窗口 → 背包/技能/角色/系统 → 走出城到格兰之森 → 洛兰门口 → 机器人通关 → 结算翻牌 → 回到门口 → 刷新继续存档
import { launch, URL_BASE } from './lib.mjs';
import fs from 'fs';
const out = 'test/shots/flow'; fs.mkdirSync(out, { recursive: true });
const { browser, page, logs } = await launch({ width: 1280, height: 720 });
const wait = ms => page.waitForTimeout(ms), shot = n => page.screenshot({ path: `${out}/${n}.png` });
const key = async (k, ms = 60) => { await page.keyboard.down(k); await wait(ms); await page.keyboard.up(k); await wait(250); };
const step = (s) => console.log('·', s);
const world0Npcs = ['seria'];   // 出生点：赛丽亚的房间（出门后在艾尔文防线集市再找林纳斯）
const talk = async (n, name) => {
  await page.evaluate(id => { const e = world.npcs.find(x => x.npc.id === id); game.player.x = e.x - 40; game.player.y = e.y; }, n);
  await wait(200); await key('KeyX'); await wait(400);
  const open = await page.evaluate(() => menus.stack.slice());
  await shot(name); step(`NPC ${n} → ${open.join(',')}`);
  await page.evaluate(() => { while (menus.stack.length) menus.close(menus.stack[menus.stack.length - 1]); });
};
await page.goto(`${URL_BASE}?mute`);
await page.waitForFunction(() => window.__READY);
await wait(800); await shot('01-title'); step('标题');
await page.click('text=开始冒险'); await wait(600); await shot('02-newgame'); step('职业选择');
await page.click('.clscard >> nth=0'); await wait(1000); await shot('03-town-help'); step('进入城镇（操作说明）');
if (await page.evaluate(() => menus.isOpen('help'))) { await key('Escape'); }
step('出生点：' + await page.evaluate(() => world.S.id)); await shot('04-town');
for (const n of world0Npcs) await talk(n, `05-npc-${n}`);
for (const [k, n] of [['KeyI', 'inv'], ['KeyK', 'skills'], ['KeyM', 'status'], ['Escape', 'system']]) {
  await key(k); await wait(300); step(`${k} → ${await page.evaluate(() => menus.stack.join(','))}`); await shot(`06-${n}`);
  await page.evaluate(() => { while (menus.stack.length) menus.close(menus.stack[menus.stack.length - 1]); });
}
// 走出赛丽亚的房间（向右）→ 艾尔文防线集市，和林纳斯对话
await page.evaluate(() => { game.player.x = world.S.width - 90; game.player.y = 60; });
await page.keyboard.down('ArrowRight'); await wait(900); await page.keyboard.up('ArrowRight');
await page.waitForFunction(() => world.S.id === 'elvenguard', null, { timeout: 10000 }); await wait(400);
step('出门 → ' + await page.evaluate(() => `${world.S.id} x=${Math.round(game.player.x)}`)); await shot('06b-elvenguard');
await talk('linus', '06c-npc-linus');
// 向右走出艾尔文防线 → 洛兰（区域地图）
await page.evaluate(() => { game.player.x = world.S.width - 90; game.player.y = 40; });
await page.keyboard.down('ArrowRight'); await wait(900); await page.keyboard.up('ArrowRight');
await page.waitForFunction(() => world.S.id === 'gf_lorien', null, { timeout: 10000 }); await wait(400);
step('出城 → ' + await page.evaluate(() => `${world.S.id} x=${Math.round(game.player.x)}`)); await shot('07-field');
// 走到洛兰的门口（向上贴近后墙）
await page.evaluate(() => { const g = world.S.gates.find(g => g.dungeon === 'lorien'); game.player.x = g.x; game.player.y = 60; });
await page.keyboard.down('ArrowUp'); await wait(900); await page.keyboard.up('ArrowUp'); await wait(300);
step(`门口 → ${await page.evaluate(() => menus.stack.join(','))}`); await shot('07-dungeon-select');
await page.click('text=进入地下城'); await wait(1500); await shot('08-dungeon'); step('进入地下城');
await page.evaluate(() => { bot.on = true; game.speedMul = 3; });
await page.waitForFunction(() => window.__botDone, null, { timeout: 240000, polling: 1000 });
await wait(500); await shot('09-result'); step('结算：' + JSON.stringify(await page.evaluate(() => window.__botDone)));
await page.evaluate(() => { bot.on = false; game.speedMul = 1; });
await page.click('text=返回城镇'); await wait(1500); await shot('10-back-town');
step('回到：' + await page.evaluate(() => `${world.S.id} x=${Math.round(game.player.x)} y=${Math.round(game.player.y)} 窗口=${menus.stack.join(',')}`));
const mv0 = await page.evaluate(() => game.player.x); await page.keyboard.down('ArrowRight'); await wait(600); await page.keyboard.up('ArrowRight');
const mv1 = await page.evaluate(() => ({ x: game.player.x, paused: game.paused, scene: game.scene }));
step(`回城后能移动：${mv1.x - mv0 > 30 ? '是' : '否！'}（Δx=${Math.round(mv1.x - mv0)}, paused=${mv1.paused}）`);
const before = await page.evaluate(() => ({ lvl: game.lvl, gold: game.gold, exp: game.exp, items: inv.items.length, fatigue: save.data.fatigue, best: save.data.best, unlocked: save.data.unlocked }));
step('回城存档：' + JSON.stringify(before));
await page.reload(); await page.waitForFunction(() => window.__READY); await wait(600); await shot('11-title-continue');
await page.click('text=继续冒险'); await wait(1000);
const after = await page.evaluate(() => ({ at: world && world.S.id + ':' + Math.round(game.player.x), lvl: game.lvl, gold: game.gold, exp: game.exp, items: inv.items.length, fatigue: save.data.fatigue, scene: game.scene }));
step('读档：' + JSON.stringify(after)); await shot('12-continued');
console.log('LOGS', JSON.stringify(logs.filter(l => l.type !== 'warning'), null, 1));
await browser.close();
