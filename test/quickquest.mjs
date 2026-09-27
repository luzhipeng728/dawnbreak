// 低等级任务直接完成（单个 / 一键批量）+ 对话里按 Esc 跳到最后一页
import { launch, URL_BASE } from './lib.mjs';
import fs from 'fs';
const out = 'test/shots/quickquest'; fs.mkdirSync(out, { recursive: true });
let fail = 0; const ok = (c, m, x = '') => { console.log(c ? '  ✓' : '  ✗', m, x); if (!c) fail++; };
const { browser, page, logs } = await launch({ width: 1280, height: 720 });
await page.goto(`${URL_BASE}?town&mute&cls=sword&fresh`); await page.waitForFunction(() => window.__READY); await page.waitForTimeout(1000);
const closeAll = () => page.evaluate(() => { while (menus.stack.length) menus.close(menus.stack[menus.stack.length - 1]); });
await closeAll();
// ---- Esc 跳过剧情 ----
const e0 = await page.evaluate(() => { const e = world.npcs.find(x => x.npc.id === 'seria'); openNpc(e.npc); const id = questsOfNpc('seria').find(x => questState(x) === 'avail'); npcSet(e.npc, 'offer', id); menus.refresh('npc', e.npc); return { pages: npcUI.pages.length, page: npcUI.page, id }; });
await page.waitForTimeout(300);
await page.keyboard.press('Escape'); await page.waitForTimeout(300);
const e1 = await page.evaluate(() => ({ open: menus.isOpen('npc'), page: npcUI.page, last: npcUI.pages.length - 1, accept: !![...document.querySelectorAll('[data-win="npc"] .qbtns .btn')].find(b => b.textContent === '接受') }));
ok(e0.pages > 1 ? e1.open && e1.page === e1.last && e1.accept : true, `对话 ${e0.pages} 页：按 Esc 直接跳到最后一页（出现“接受”），窗口不关`, JSON.stringify(e1));
await page.screenshot({ path: `${out}/01-esc-skip.png` });
await page.keyboard.press('Escape'); await page.waitForTimeout(300);
ok(!(await page.evaluate(() => menus.isOpen('npc'))), '最后一页再按 Esc：关闭对话');
// ---- 升到 12 级 ----
const L = 12;
await page.evaluate(L => { testLoadout(L); questDirty(); }, L);
const before = await page.evaluate(L => { const d = qdata(); return { list: questQuickList().map(q => ({ id: q.id, lvl: q.lvl, type: q.type })), hiDone: Object.keys(d.questDone).filter(id => QUESTS[id] && QUESTS[id].lvl >= L) }; }, L);
ok(before.list.length > 0 && before.list.every(q => q.lvl < L && q.type !== 'daily'), `Lv.${L}：可以直接完成的低等级任务 ${before.list.length} 个（都低于 Lv.${L}，没有每日任务）`);
// 单个：任务日志里选一个，点“立即完成”
await page.keyboard.press('KeyL'); await page.waitForTimeout(400);
const one = before.list[0];
await page.evaluate(id => { menus.qlog.sel = id; menus.refresh('quests'); }, one.id); await page.waitForTimeout(300);
const hasBtn = await page.evaluate(() => [...document.querySelectorAll('[data-win="quests"] .qdet .btn')].some(b => b.textContent === '立即完成'));
ok(hasBtn, '任务详情里有“立即完成”');
await page.screenshot({ path: `${out}/02-log.png` });
await page.click('[data-win="quests"] .qdet .btn:has-text("立即完成")'); await page.waitForTimeout(500);
const s1 = await page.evaluate(id => ({ done: questState(id) === 'done', popup: menus.isOpen('npcquest') }), one.id);
ok(s1.done && s1.popup, '点“立即完成”：任务完成并弹出奖励', JSON.stringify(s1));
await page.evaluate(() => menus.close('npcquest'));
// 批量
const foot = await page.evaluate(() => { const b = [...document.querySelectorAll('[data-win="quests"] .qfoot .btn')].find(x => x.textContent.startsWith('一键完成')); return b ? b.textContent : null; });
ok(!!foot, '任务日志底部有“一键完成低等级任务（N）”', foot || '');
await page.click('[data-win="quests"] .qfoot .btn:has-text("一键完成")'); await page.waitForTimeout(400);
await page.screenshot({ path: `${out}/03-ask.png` });
await page.click('[data-win="ask"] .btn:has-text("全部完成")'); await page.waitForTimeout(800);
await page.screenshot({ path: `${out}/04-summary.png` });
const after = await page.evaluate(L => { const d = qdata(); return { left: questQuickList(L).length, popup: menus.isOpen('qquick'), n: menus.wins.qquick && menus.wins.qquick._arg.n, hiDone: Object.keys(d.questDone).filter(id => QUESTS[id] && QUESTS[id].lvl >= L), lvl: game.lvl, daily: Object.keys(d.questDone).filter(id => QUESTS[id] && QUESTS[id].type === 'daily').length, job: Object.keys(d.questDone).filter(id => QUESTS[id] && QUESTS[id].goals.some(g => g.type === 'job')).length }; }, L);
ok(after.popup && after.n >= before.list.length - 1, `一键完成：弹出汇总（完成 ${after.n} 个）`);
ok(after.left === 0, '点击时低于等级的任务全部完成（包括解锁出来的后续任务）', `剩余 ${after.left}`);
ok(JSON.stringify(after.hiDone) === JSON.stringify(before.hiDone), `中途升级（现在 Lv.${after.lvl}）也没有连锁完成 Lv.${L} 以上的任务`);
ok(after.daily === 0 && after.job === 0, '每日任务、转职任务没有被完成');
await page.goto(`${URL_BASE}?town&mute&cls=sword`); await page.waitForFunction(() => window.__READY); await page.waitForTimeout(800);   // 不带 fresh：读回刚才的存档
const kept = await page.evaluate(id => questState(id), one.id);
ok(kept === 'done', '刷新后完成记录还在', kept);
const errs = logs.filter(l => l.type === 'pageerror'); ok(!errs.length, '没有页面错误', errs.length ? errs[0].text.slice(0, 300) : '');
await browser.close();
console.log(fail ? `${fail} 项失败` : '全部通过'); process.exit(fail ? 1 : 0);
