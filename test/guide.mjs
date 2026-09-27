// 任务线路指引 + 自动前往：新角色在赛丽亚的房间 → 指引到赛丽亚 → 自动前往并对话 → 接主线 → 指引切到下一个目标 → 自动跨场景前往
import { launch, URL_BASE } from './lib.mjs';
import fs from 'fs';
const out = 'test/shots/guide'; fs.mkdirSync(out, { recursive: true });
let fail = 0; const ok = (c, m, x = '') => { console.log(c ? '  ✓' : '  ✗', m, x); if (!c) fail++; };
const { browser, page, logs } = await launch({ width: 1280, height: 720 });
await page.goto(`${URL_BASE}?town&mute&cls=sword&fresh`); await page.waitForFunction(() => window.__READY); await page.waitForTimeout(1000);
const closeAll = () => page.evaluate(() => { while (menus.stack.length) menus.close(menus.stack[menus.stack.length - 1]); });
await closeAll(); await page.waitForTimeout(600);
const g0 = await page.evaluate(() => ({ scene: world.S.id, vis: !document.getElementById('qguide').hidden, text: document.getElementById('qguide').textContent, next: guide.cur && guide.cur.next }));
ok(g0.vis && g0.text.includes('赛丽亚'), '新角色：左上角指引指向赛丽亚', g0.text);
await page.screenshot({ path: `${out}/01-room.png` });
await page.click('#qguide button'); 
await page.waitForFunction(() => menus.isOpen('npc'), null, { timeout: 20000 }).catch(() => {});
const t1 = await page.evaluate(() => ({ npc: menus.isOpen('npc'), who: menus.wins.npc && menus.wins.npc._arg && menus.wins.npc._arg.id }));
ok(t1.npc && t1.who === 'seria', '自动前往：走到赛丽亚身边并打开对话', JSON.stringify(t1));
await page.screenshot({ path: `${out}/02-talk.png` });
// 接下主线后，指引切到下一个目标
const q = await page.evaluate(() => { const nm = questNextMain(); questAccept(nm.id); while (menus.stack.length) menus.close(menus.stack[menus.stack.length - 1]); return nm.name; });
await page.waitForTimeout(800);
const g1 = await page.evaluate(() => ({ text: document.getElementById('qguide').textContent, T: guide.cur && guide.cur.T && { scene: guide.cur.T.scene, kind: guide.cur.T.kind, name: guide.cur.T.name }, path: guide.cur && guide.cur.path && guide.cur.path.map(e => e.to) }));
ok(g1.T && g1.text.length > 4, `接了「${q}」后指引更新`, `${g1.text} ${JSON.stringify(g1.T)} 路线 ${JSON.stringify(g1.path)}`);
await page.screenshot({ path: `${out}/03-next.png` });
if (g1.T && g1.T.scene !== 'seria_room') {
  await page.click('#qguide button');
  const target = g1.T;
  await page.waitForFunction(T => world.S.id === T.scene && (T.kind !== 'npc' || menus.isOpen('npc')) && (T.kind !== 'gate' || menus.isOpen('dungeon')), target, { timeout: 60000 }).catch(() => {});
  const t2 = await page.evaluate(() => ({ scene: world.S.id, open: menus.stack.join(','), auto: guide.auto }));
  ok(t2.scene === target.scene && (target.kind === 'scene' || t2.open), '自动前往：跨场景走到目标并触发（对话 / 门口）', JSON.stringify(t2));
  await page.screenshot({ path: `${out}/04-arrived.png` });
}
// 取消：自动前往中按方向键
await closeAll(); await page.evaluate(() => { guide.auto = true; }); await page.waitForTimeout(300);
await page.keyboard.down('ArrowDown'); await page.waitForTimeout(200); await page.keyboard.up('ArrowDown');
ok(await page.evaluate(() => !guide.auto), '按方向键取消自动前往');
// 屏幕外的目标：边缘箭头（把镜头挪开检查一下不报错）
await page.evaluate(() => { game.player.x = world.S.width - 60; }); await page.waitForTimeout(500);
await page.screenshot({ path: `${out}/05-edge.png` });
const errs = logs.filter(l => l.type === 'pageerror'); ok(!errs.length, '没有页面错误', errs.length ? errs[0].text.slice(0, 300) : '');
await browser.close();
console.log(fail ? `${fail} 项失败` : '全部通过'); process.exit(fail ? 1 : 0);
