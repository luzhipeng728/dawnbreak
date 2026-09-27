// 天帷巨兽整条路线：西海岸的船（Lv.24 限制）→ 神殿之路 →（Lv.27）脊背 → 走到每个地下城门口弹出选择窗口 → 点“进入地下城”
// → 地下城用的是天帷巨兽的背景和精灵 → 领主房（神殿外围：大祭司 + 圣光护盾；第二脊椎：领主房前一定有巨型黑章鱼）→ 回城站在门口
// 隐藏图天帷禁地在任务 q_hidden_forbidden 完成前看不到门
// 用法：node build.mjs --offline && node test/behemoth_route.mjs
import { launch, URL_BASE } from './lib.mjs';
import fs from 'fs';
const out = 'test/shots/behemoth'; fs.mkdirSync(out, { recursive: true });
let fail = 0;
const ok = (c, msg) => { console.log(`  ${c ? '✓' : '✗'} ${msg}`); if (!c) fail++; };
const wait = ms => new Promise(r => setTimeout(r, ms));
const { browser, page, logs } = await launch({ width: 1280, height: 720 });
await page.goto(`${URL_BASE}?town&fresh&cls=sword&mute`);
await page.waitForFunction(() => window.__READY && game.scene === 'town', null, { timeout: 30000 });
const closeAll = () => page.evaluate(() => { if (menus.closeAll) menus.closeAll(); else for (const n of [...(menus.stack || [])]) menus.close(n); });
await closeAll();
const enter = (id, spawn) => page.evaluate(([id, spawn]) => enterScene(id, spawn), [id, spawn]);
async function hold(key, until, ms = 2500) {
  await page.keyboard.down(key);
  await page.waitForFunction(until, null, { timeout: ms }).catch(() => {});
  await page.keyboard.up(key); await wait(300);
}
const at = () => page.evaluate(() => world.S.id);

console.log('· 西海岸的船 → 天帷巨兽（Lv.24 限制）');
await page.evaluate(() => { game.lvl = 20; recalcStats(game.player); });
await enter('west_coast', { x: 1040, y: 30 }); await closeAll(); await wait(300);
await hold('ArrowUp', () => world.S.id === 'behemoth', 1500);
ok(await at() === 'west_coast', 'Lv.20 上不了船（还在西海岸）');
await page.evaluate(() => { testLoadout(25); world.exitLock = 0; });
await enter('west_coast', { x: 1040, y: 30 }); await closeAll(); await wait(300);
await hold('ArrowUp', () => world.S.id === 'behemoth', 4000);
ok(await at() === 'behemoth', 'Lv.25 坐船到达天帷巨兽 · 神殿之路');
await wait(800); await page.screenshot({ path: `${out}/route-field.png` });

console.log('· 神殿之路 → 脊背（Lv.27 限制）');
await page.evaluate(() => { world.exitLock = 0; game.player.x = world.S.width - 70; game.player.y = 100; });
await hold('ArrowRight', () => world.S.id === 'behemoth_spine', 1500);
ok(await at() === 'behemoth', 'Lv.25 过不去脊背');
await page.evaluate(() => { testLoadout(28); world.exitLock = 0; game.player.x = world.S.width - 70; game.player.y = 100; });
await hold('ArrowRight', () => world.S.id === 'behemoth_spine', 4000);
ok(await at() === 'behemoth_spine', 'Lv.28 走到脊背');
await wait(800); await page.screenshot({ path: `${out}/route-spine.png` });
await page.evaluate(() => { world.exitLock = 0; game.player.x = 70; game.player.y = 100; });
await hold('ArrowLeft', () => world.S.id === 'behemoth', 4000);
ok(await at() === 'behemoth', '从脊背往左走回神殿之路');

console.log('· 区域地图上的门');
const gates = await page.evaluate(() => ['behemoth', 'behemoth_spine'].flatMap(s => SCENES[s].gates.filter(g => DUNGEONS[g.dungeon] && ['temple_outskirts', 'treant_jungle', 'purgatory', 'polar_day', 'second_spine', 'forbidden_land'].includes(g.dungeon)).map(g => ({ scene: s, id: g.dungeon, x: g.x, hidden: !!DUNGEONS[g.dungeon].hidden, visible: gateVisible(g) }))));
ok(gates.length === 6, `6 个门（${gates.length}）`);
for (const g of gates) ok(g.hidden ? !g.visible : g.visible, `${g.id}：${g.hidden ? '隐藏图，任务完成前看不到门' : '门可见'}`);
await page.evaluate(() => { (save.data.questDone ??= {}).q_hidden_forbidden = true; });
ok(await page.evaluate(() => gateVisible(SCENES.behemoth_spine.gates.find(g => g.dungeon === 'forbidden_land'))), '完成 q_hidden_forbidden 后天帷禁地的门出现');

for (const g of gates) {
  await closeAll(); await page.evaluate(() => { save.data.fatigue = 156; (save.data.hiddenSeen ??= {}).forbidden_land = 1; });
  await enter(g.scene, { x: g.x, y: 60 }); await closeAll(); await wait(400);
  await hold('ArrowUp', () => menus.isOpen('dungeon'), 3000);
  const win = await page.evaluate(() => menus.isOpen('dungeon'));
  ok(win, `${g.id}：走到门口弹出地下城选择`);
  if (!win) continue;
  if (g.id === 'temple_outskirts') await page.screenshot({ path: `${out}/route-gate.png` });
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => b.textContent === '进入地下城'); b && b.click(); });
  const inDg = await page.waitForFunction(id => game.scene === 'dungeon' && game.dungeon && game.dungeon.def.id === id, g.id, { timeout: 15000 }).then(() => true, () => false);
  ok(inDg, `${g.id}：点“进入地下城”进入了地下城`);
  if (!inDg) continue;
  await wait(1200);
  const r = await page.evaluate(() => { const mons = ents.filter(e => e.team === 'e'); return { art: !!game.room.art, theme: game.room.theme, mons: mons.length, spr: mons.filter(m => m.model.constructor.name === 'SpriteModel').length }; });
  ok(r.art && r.theme.startsWith('bh'), `${g.id}：手绘背景 ${r.theme}`);
  ok(r.mons > 0 && r.spr === r.mons, `${g.id}：怪物 ${r.mons} 只，逐帧精灵 ${r.spr} 只`);
  await page.screenshot({ path: `${out}/route-${g.id}.png` });
  if (g.id === 'second_spine') {   // 通往领主房的前一个房间：一定有巨型黑章鱼
    const o = await page.evaluate(() => { const D = game.dungeon, L = D.layout, pre = L.rooms.find(rm => rm !== L.boss && Object.values(rm.doors).includes(L.boss)); D.enter(pre, 'left'); return ents.filter(e => e.kind === 'blackOctopus' && !e.dead).length; });
    ok(o === 1, `second_spine：领主房前的房间里有巨型黑章鱼（${o}）`);
    await wait(900); await page.screenshot({ path: `${out}/route-second_spine-octo.png` });
  }
  const bossRoom = await page.evaluate(() => { const D = game.dungeon; D.enter(D.layout.boss, 'left'); const E = ents.filter(e => e.team === 'e' && !e.dead); const b = E.find(e => e.boss); return { boss: b ? b.kind : '', shield: b ? b.dmgTakenMul || 1 : 0, priest: E.filter(e => e.kind === 'gblHighPriest').length, adds: E.filter(e => !e.boss && e.kind !== 'gblHighPriest').length }; });
  const bossKind = await page.evaluate(id => DUNGEONS[id].boss.kind, g.id);
  ok(bossRoom.boss === bossKind && bossRoom.adds > 0, `${g.id}：领主房有 ${bossRoom.boss} 和 ${bossRoom.adds} 只小怪`);
  if (g.id === 'temple_outskirts') {
    ok(bossRoom.priest === 1 && bossRoom.shield === 0.6, `temple_outskirts：领主房有大祭司，大主教有护盾（受到伤害 ×${bossRoom.shield}）`);
    await wait(1500); await page.screenshot({ path: `${out}/route-temple_outskirts-shield.png` });
    const off = await page.evaluate(() => { const pr = ents.find(e => e.kind === 'gblHighPriest'); pr.hp = 1; applyHit(game.player, pr, { dmg: 50, sure: true }, { proj: true }); return new Promise(res => setTimeout(() => res(game.dungeon.boss.dmgTakenMul || 1), 600)); });
    ok(off === 1, `temple_outskirts：打倒大祭司后护盾消失（×${off}）`);
  }
  await wait(900);
  await page.screenshot({ path: `${out}/route-${g.id}-boss.png` });
  await page.evaluate(() => { game.dungeon = null; return goTown(); }); await wait(800); await closeAll();
  const back = await page.evaluate(() => ({ id: world.S.id, x: Math.round(game.player.x) }));
  ok(back.id === g.scene && Math.abs(back.x - g.x) < 10, `${g.id}：回城站在门口（${back.id} @${back.x}）`);
}
// 深渊派对的门（装备深化组在脊背上加的，content/abyss.js）：完成资格任务后出现，带邀请函能进
console.log('· 脊背上的深渊门（装备深化组）');
const abyss = await page.evaluate(() => (SCENES.behemoth_spine.gates || []).filter(g => DUNGEONS[g.dungeon] && DUNGEONS[g.dungeon].abyss).map(g => ({ id: g.dungeon, x: g.x, q: DUNGEONS[g.dungeon].unlock.quest })));
if (!abyss.length) console.log('  （这个版本没有天帷深渊，跳过）');
for (const a of abyss) {
  await closeAll();
  const hidden = await page.evaluate(id => !gateVisible(SCENES.behemoth_spine.gates.find(g => g.dungeon === id)), a.id);
  ok(hidden, `${a.id}：资格任务完成前看不到门`);
  await page.evaluate(a => { save.data.questDone[a.q] = true; (save.data.hiddenSeen ??= {})[a.id] = 1; save.data.fatigue = 156; if (typeof makeItem === 'function' && ITEMS.abyss_ticket) giveItem(makeItem('abyss_ticket', 2)); }, a);
  await enter('behemoth_spine', { x: a.x, y: 60 }); await closeAll(); await wait(400);
  await hold('ArrowUp', () => menus.isOpen('dungeon'), 3000);
  ok(await page.evaluate(() => menus.isOpen('dungeon')), `${a.id}：走到深渊门口弹出地下城选择`);
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => b.textContent === '进入地下城'); b && b.click(); });
  const inDg = await page.waitForFunction(id => game.scene === 'dungeon' && game.dungeon && game.dungeon.def.id === id, a.id, { timeout: 15000 }).then(() => true, () => false);
  ok(inDg, `${a.id}：带着邀请函进入了深渊`);
  if (inDg) { await wait(1200); await page.screenshot({ path: `${out}/route-${a.id}.png` }); }
  await page.evaluate(() => { game.dungeon = null; return goTown(); }); await wait(800);
}
const errs = logs.filter(l => l.type !== 'warning');
for (const e of errs.slice(0, 6)) console.log('ERR', e.text.slice(0, 300));
ok(!errs.length, `没有报错（${errs.length}）`);
await browser.close();
console.log(fail ? `\n${fail} 项失败` : '\n全部通过');
process.exit(fail ? 1 : 0);
