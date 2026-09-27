// 天空之城整条路线：西海岸云梯（Lv.14 限制）→ 天空之城区域地图 → 走到每个地下城门口弹出选择窗口 → 点“进入地下城”
// → 地下城用的是天空之城的背景和精灵 → 回城站在门口；隐藏图悬空城在任务完成前看不到门
// 用法：node build.mjs --offline && node test/sky_route.mjs
import { launch, URL_BASE } from './lib.mjs';
import fs from 'fs';
const out = 'test/shots/sky'; fs.mkdirSync(out, { recursive: true });
let fail = 0;
const ok = (c, msg) => { console.log(`  ${c ? '✓' : '✗'} ${msg}`); if (!c) fail++; };
const wait = ms => new Promise(r => setTimeout(r, ms));
const { browser, page, logs } = await launch({ width: 1280, height: 720 });
await page.goto(`${URL_BASE}?town&fresh&cls=sword&mute`);
await page.waitForFunction(() => window.__READY && game.scene === 'town', null, { timeout: 30000 });
const closeAll = () => page.evaluate(() => { if (menus.closeAll) menus.closeAll(); else for (const n of [...(menus.stack || [])]) menus.close(n); });
await closeAll();
const enter = (id, spawn) => page.evaluate(([id, spawn]) => enterScene(id, spawn), [id, spawn]);
// 按住方向键走过去（和 test/world.mjs 一样）
async function hold(key, until, ms = 2500) {
  await page.keyboard.down(key);
  await page.waitForFunction(until, null, { timeout: ms }).catch(() => {});
  await page.keyboard.up(key); await wait(300);
}

console.log('· 西海岸 → 天空之城（Lv.14 限制）');
await page.evaluate(() => { game.lvl = 10; recalcStats(game.player); });
await enter('west_coast', { x: 2600, y: 30 }); await closeAll(); await wait(300);
await hold('ArrowUp', () => world.S.id === 'sky_castle', 1500);
ok(await page.evaluate(() => world.S.id === 'west_coast'), 'Lv.10 走不上云梯（还在西海岸）');
await page.evaluate(() => { testLoadout(16); world.exitLock = 0; });
await enter('west_coast', { x: 2600, y: 30 }); await closeAll(); await wait(300);
await hold('ArrowUp', () => world.S.id === 'sky_castle', 4000);
ok(await page.evaluate(() => world.S.id === 'sky_castle'), 'Lv.16 走上云梯到达天空之城');
await page.screenshot({ path: `${out}/route-field.png` });

console.log('· 区域地图上的门');
const gates = await page.evaluate(() => SCENES.sky_castle.gates.filter(g => !DUNGEONS[g.dungeon].abyss).map(g => ({ id: g.dungeon, x: g.x, hidden: !!DUNGEONS[g.dungeon].hidden, visible: gateVisible(g) })));
for (const g of gates) ok(g.hidden ? !g.visible : g.visible, `${g.id}：${g.hidden ? '隐藏图，任务完成前看不到门' : '门可见'}`);
await page.evaluate(() => { (save.data.questDone ??= {}).q_hidden_floating = true; (save.data.hiddenSeen ??= {}).floating_castle = 1; });   // 现身特效由世界组负责（test/world.mjs 已测），这里直接标记为已出现
ok(await page.evaluate(() => gateVisible(SCENES.sky_castle.gates.find(g => g.dungeon === 'floating_castle'))), '完成 q_hidden_floating 后悬空城的门出现');

for (const g of gates) {
  await closeAll(); await page.evaluate(() => { save.data.fatigue = 156; });
  await enter('sky_castle', { x: g.x, y: 60 }); await closeAll(); await wait(400);
  await hold('ArrowUp', () => menus.isOpen('dungeon'), 3000);
  const win = await page.evaluate(() => menus.isOpen('dungeon'));
  ok(win, `${g.id}：走到门口弹出地下城选择`);
  if (!win) continue;
  if (g.id === 'dragon_tower') await page.screenshot({ path: `${out}/route-gate.png` });
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => b.textContent === '进入地下城'); b && b.click(); });
  const inDg = await page.waitForFunction(id => game.scene === 'dungeon' && game.dungeon && game.dungeon.def.id === id, g.id, { timeout: 15000 }).then(() => true, () => false);
  ok(inDg, `${g.id}：点“进入地下城”进入了地下城`);
  if (!inDg) continue;
  await wait(1200);
  const r = await page.evaluate(() => {
    const D = game.dungeon.def, mons = ents.filter(e => e.team === 'e');
    return { art: !!game.room.art, theme: game.room.theme, mons: mons.length, spr: mons.filter(m => m.model.constructor.name === 'SpriteModel').length };
  });
  ok(r.art && r.theme.startsWith('sky'), `${g.id}：手绘背景 ${r.theme}`);
  ok(r.mons > 0 && r.spr === r.mons, `${g.id}：怪物 ${r.mons} 只，逐帧精灵 ${r.spr} 只`);
  await page.screenshot({ path: `${out}/route-${g.id}.png` });
  // 房间机关：悬空城的侍剑骑兵开局是石像；龙人之塔的领主房有两座龙之雕像
  if (g.id === 'floating_castle') {
    const k = await page.evaluate(() => { const L = ents.filter(e => e.kind === 'knight' && !e.dead && !e.elite); return { n: L.length, statue: L.filter(e => e.statue).length }; });
    ok(k.statue === k.n, `floating_castle：侍剑骑兵 ${k.n} 只，石像 ${k.statue} 只`);
  }
  const bossRoom = await page.evaluate(() => { const D = game.dungeon; D.enter(D.layout.boss, 'left'); const E = ents.filter(e => e.team === 'e' && !e.dead); return { boss: E.filter(e => e.boss).map(e => e.kind).join(','), statues: E.filter(e => e.kind === 'dragonStatue').length, adds: E.filter(e => !e.boss && e.kind !== 'dragonStatue').length }; });
  const bossKind = await page.evaluate(id => DUNGEONS[id].boss.kind, g.id);
  ok(bossRoom.boss === bossKind && bossRoom.adds > 0, `${g.id}：领主房有 ${bossRoom.boss} 和 ${bossRoom.adds} 只小怪`);
  if (g.id === 'dragon_tower') ok(bossRoom.statues === 2, `dragon_tower：领主房两侧有龙之雕像（${bossRoom.statues}）`);
  await wait(900);
  await page.screenshot({ path: `${out}/route-${g.id}-boss.png` });
  // 回城：记下的位置就是门口
  await page.evaluate(() => { game.dungeon = null; return goTown(); }); await wait(800); await closeAll();
  const back = await page.evaluate(() => ({ id: world.S.id, x: Math.round(game.player.x) }));
  ok(back.id === 'sky_castle' && Math.abs(back.x - g.x) < 10, `${g.id}：回城站在门口（${back.id} @${back.x}）`);
}
const errs = logs.filter(l => l.type !== 'warning');
for (const e of errs.slice(0, 6)) console.log('ERR', e.text.slice(0, 300));
ok(!errs.length, `没有报错（${errs.length}）`);
await browser.close();
console.log(fail ? `\n${fail} 项失败` : '\n全部通过');
process.exit(fail ? 1 : 0);
