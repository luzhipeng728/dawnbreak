// 安徒恩团本 UI 冒烟（浏览器，离线本地规则核心，不登录）：
//   入口窗口有「安徒恩攻坚战」卡片（人数文案 / 多队 4~16 人）→ 单人引导建团 → 开始 → 攻坚情况板有节点 + 区域名
//   → 进黑雾之源（吞噬魔精英 + 内尔贝领主的地下城）→ 精英房有精英、领主有机制脚本 → 打掉领主 → 回营地 → 攻坚商店（魔能矿 / 融合装备）
// 截图：test/shots/anton/*.png
// 用法：node test/anton_ui.mjs
import fs from 'fs';
import { launch, URL_BASE } from './lib.mjs';
const out = 'test/shots/anton'; fs.mkdirSync(out, { recursive: true });
let fail = 0, n = 0;
const ok = (c, msg, d) => { n++; if (c) console.log('✓', msg); else { fail++; console.log('✗', msg, d !== undefined ? JSON.stringify(d).slice(0, 500) : ''); } return c; };
const until = async (P, fn, arg, ms = 10000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await P.evaluate(fn, arg).catch(() => false)) return true; await P.waitForTimeout(120); } return false; };
const { browser, page: P, logs } = await launch({ width: 1280, height: 720 });
await P.goto(`${URL_BASE}?town&cls=sword&raidfast&mute`);
ok(await until(P, () => window.__READY && game.scene === 'town' && game.player && world, null, 60000), '进城');
await P.evaluate(() => { for (const n of ['help']) if (menus.isOpen(n)) menus.close(n); testLoadout(60); save.data.coins = 5; recalcStats(game.player); save.write(); menus.closeAll(); return worldTravel('siroco_town'); });
ok(await until(P, () => world.S.id === 'siroco_town' && game.scene === 'town', null, 20000), '到团本营地');
// 入口窗口
await P.evaluate(() => openNpc(NPCS.agonzo)); await until(P, () => menus.isOpen('npc'), null, 5000);
await P.click('[data-win="npc"] button:text-is("团本")');
ok(await until(P, () => menus.isOpen('raid') && !!document.querySelector('[data-win="raid"] .rcard[data-raid="anton"]'), null, 8000), '团本窗口里有「安徒恩攻坚战」卡片');
const card = await P.evaluate(() => { const c = document.querySelector('[data-win="raid"] .rcard[data-raid="anton"]'); return c && c.innerText; });
ok(/安徒恩/.test(card || '') && /多队 4~16 人/.test(card || '') && /Lv\.60/.test(card || ''), '卡片：名字 / Lv.60 / 多队 4~16 人', card);
await P.screenshot({ path: `${out}/01-entry.png` });
await P.click('[data-win="raid"] .rcard[data-raid="anton"] [data-act="guide"]');
ok(await until(P, () => raidNet.S && raidNet.S.raid === 'anton' && raidNet.S.st === 'lobby', null, 5000), '单人引导建团：anton 大厅');
await P.click('[data-win="raid"] [data-act="start"]');
ok(await until(P, () => raidNet.S.st === 'routes' && menus.isOpen('raidboard'), null, 5000), '开始：攻坚情况板打开');
await P.waitForTimeout(300);
const board = await P.evaluate(() => ({ nodes: [...document.querySelectorAll('[data-win="raidboard"] .rbnode')].map(e => e.dataset.node), txt: document.querySelector('[data-win="raidboard"]').innerText }));
ok(board.nodes.includes('fog_a') && board.nodes.includes('pillar_a2') && /黑雾之源/.test(board.txt), '情况板：节点和区域名（黑雾之源）', board);
await P.screenshot({ path: `${out}/02-board.png` });
// 进黑雾之源
await P.click('[data-win="raidboard"] .rbnode[data-node="fog_a"]');
await P.click('[data-win="raidboard"] .rbnd button[data-act="solo"]', { timeout: 8000 });
ok(await until(P, () => game.scene === 'dungeon' && game.dungeon && game.dungeon.raid && game.dungeon.boss && !game.dungeon.transition, null, 30000), '进入「黑雾之源」地下城');
const dg = await P.evaluate(() => { const D = game.dungeon, def = D.def, fx = (def.fixed || (DUNGEONS[def.id] || {}).fixed || {}), rm = (fx.rooms || D.rooms || []).find(r => r.type === 'elite') || {}; return { id: def.id, boss: D.boss.name, mech: (MON[def.boss.kind].msMechs || []).some(m => m.use === 'raidScript'), elite: (D.rooms || []).some(r => r.type === 'elite') }; });
ok(dg.id === 'raid_an_fog' && /内尔贝/.test(dg.boss) && dg.mech, '地下城：内尔贝领主 + 机制脚本（精英房结构在 anton_bosses 里验）', dg);
await P.waitForTimeout(800); await P.screenshot({ path: `${out}/03-boss.png` });
await P.evaluate(() => { const b = game.dungeon.boss; b.invul = 0; b.hp = 0; killEnt(b, game.player, {}); });
await until(P, () => menus.isOpen('result'), null, 15000);
for (let k = 0; k < 3 && await P.evaluate(() => menus.isOpen('result')); k++) { await P.click('#result button:has-text("进入翻牌结算"), #result button:has-text("返回营地")').catch(() => {}); await P.waitForTimeout(800); }
ok(await until(P, () => game.scene === 'town' && world.S.id === 'siroco_town' && menus.isOpen('raidboard') && ['cleared', 'done'].includes(((raidNet.S.nodes || {}).fog_a || {}).st || 'cleared'), null, 25000), '领主倒下：回营地，黑雾之源通关');
// 商店
const shop = await P.evaluate(() => { menus.closeAll(); const s = SHOPS && SHOPS.anton_raid; return s ? { tabs: s.tabs.map(t => [t.name, (typeof t.goods === 'function' ? t.goods() : t.goods).length]), ore: !!ITEMS.raid_magic_ore, core: !!ITEMS.raid_an_core } : null; });
ok(shop && shop.ore && shop.core && shop.tabs[1][1] === 12, '攻坚商店：魔能矿 / 荒古融合核 / 12 件融合装备', shop);
const svc = await P.evaluate(() => NPCS.raidOldman ? NPCS.raidOldman.services : null);
ok(svc && svc.includes('shop:anton_raid'), '营地老人提供安徒恩商店入口', svc);
const errs = logs.filter(l => /pageerror|TypeError|ReferenceError/i.test(l.text || l));
ok(errs.length === 0, '页面没有报错', errs.slice(0, 3));
console.log(`\n${n - fail}/${n} 通过`);
await browser.close();
process.exit(fail ? 1 : 0);
