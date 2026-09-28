// 时装外观（混搭按件数最多的一套）+ 天空套收集引导（部位状态 / 一键穿整套 / 合成器提示）
// + 转职任务“去转职”按钮 + 任务日志“自动前往” + 单独按 Ctrl 才切换掉落物名称
import { launch, URL_BASE } from './lib.mjs';
import fs from 'fs';
const out = 'test/shots/skyguide'; fs.mkdirSync(out, { recursive: true });
let fail = 0; const ok = (c, m, x = '') => { console.log(c ? '  ✓' : '  ✗', m, x); if (!c) fail++; };
const { browser, page, logs } = await launch({ width: 1280, height: 720 });
await page.goto(`${URL_BASE}?town&mute&cls=gun&fresh`); await page.waitForFunction(() => window.__READY); await page.waitForTimeout(800);
const closeAll = () => page.evaluate(() => { while (menus.stack.length) menus.close(menus.stack[menus.stack.length - 1]); });
await closeAll();
// ---- 外观：玩家实际的混搭（天穹 5 件 + 学院上衣 + 炎龙下装 / 鞋）→ 天穹圣翼 ----
const look = await page.evaluate(() => {
  const W = { av_hair: 'av_sky1', av_hat: 'av_sky1', av_face: 'av_sky1', av_chest: 'av_sky1', av_top: 'av_academy', av_bottom: 'av_sky2', av_belt: 'av_sky1', av_shoes: 'av_sky2' };
  for (const s in W) inv.equip[s] = makeItem(avKey(W[s], s));
  recalcStats(game.player);
  const L = lookFromEquip('gun', inv.equip), only = lookFromEquip('gun', { av_top: makeItem(avKey('av_academy', 'av_top')) }), tryOn = lookFromEquip('gun', inv.equip, 'av_sky2');
  return { set: L.set, acc: L.acc, only: only.set, tryOn: tryOn.set };
});
ok(look.set === 'sky1' && look.acc.includes('av_hat_sky1'), `混搭：身体按件数最多的天穹圣翼，神枪手的帽子也显示（${look.set} / ${look.acc.join(',')}）`);
ok(look.only === 'academy', `只穿一件上衣也会变（${look.only}）`);
ok(look.tryOn === 'sky2', `商城试穿：正在试的那套优先（${look.tryOn}）`);
await page.waitForTimeout(600);
const m = await page.evaluate(() => { const L = game.player.model.av; return L && L.setKey; });
ok(m === 'gun@sky1', `场景里的角色换成了时装帧（${m}）`);
// ---- 天空套收集 ----
await page.evaluate(() => { inv.add(makeItem(avKey('av_sky1', 'av_top'))); menus.open('cash', { tab: 'sky' }); CW.sel = 'sky:av_sky1'; menus.refresh('cash'); });
await page.waitForTimeout(800);
const g = await page.evaluate(() => ({ cells: [...document.querySelectorAll('[data-win="cash"] .csky .cs')].map(c => c.className.split(' ')[1]).join(','), st: document.querySelector('[data-win="cash"] .cash-side .st').textContent }));
ok(g.cells === 'worn,worn,worn,worn,bag,miss,worn,miss' && /缺：下装、鞋/.test(g.st), `8 个部位状态：${g.cells}（${g.st}）`);
await page.screenshot({ path: `${out}/21-guide.png` });
await page.evaluate(() => [...document.querySelectorAll('[data-win="cash"] .btn')].find(b => b.textContent.startsWith('穿上这套')).click()); await page.waitForTimeout(400);
const w = await page.evaluate(() => ({ want: avKey('av_sky1', 'av_top'), top: inv.equip.av_top.key, backInBag: inv.items.some(it => it.key === avKey('av_academy', 'av_top')), st: cashSkyState('av_sky1').filter(s => s.st === 'worn').length }));
ok(w.top === w.want && w.backInBag && w.st === 6, '一键穿上这套：天穹上衣穿上，学院上衣回到背包', JSON.stringify(w));
await page.evaluate(() => [...document.querySelectorAll('[data-win="cash"] .btn')].find(b => b.textContent.startsWith('合成缺的')).click()); await page.waitForTimeout(500);
const sy = await page.evaluate(() => ({ open: menus.isOpen('synth'), set: CSY.set, hint: [...document.querySelectorAll('[data-win="synth"] .small')].map(x => x.textContent).find(t => t.startsWith('已收集')) }));
ok(sy.open && sy.set === 'av_sky1' && /缺：下装、鞋/.test(sy.hint || ''), `“合成缺的”：打开合成器并选好目标套装（${sy.hint}）`);
await closeAll();
// ---- 转职任务：NPC 对话里直接有“去转职” ----
const j = await page.evaluate(() => {
  testLoadout(16);
  const d = qdata(); for (const id in QUESTS) { const q = QUESTS[id]; if (q.type === 'job' && (!q.cls || q.cls === 'gun') && id !== 'q_job_gun_change' && !id.startsWith('q_awaken')) d.questDone[id] = Date.now(); }
  questAccept('q_job_gun_change'); questDirty();
  openNpc(NPCS.kiri); npcSet(NPCS.kiri, 'doing', 'q_job_gun_change'); npcUI.page = npcUI.pages.length - 1; menus.refresh('npc', NPCS.kiri);
  const b = [...document.querySelectorAll('[data-win="npc"] .qbtns .btn')].find(x => x.textContent === '去转职'); if (b) b.click();
  return { btn: !!b, job: menus.isOpen('job') };
});
ok(j.btn && j.job, '转职任务对话里有“去转职”，点了打开转职窗口', JSON.stringify(j));
await closeAll();
// ---- 任务日志：自动前往 ----
const a = await page.evaluate(() => {
  const q = questList(x => questState(x.id) === 'avail' && x.npc && x.type === 'main')[0] || questList(x => questState(x.id) === 'avail' && x.npc)[0];
  menus.open('quests'); menus.qlog.sel = q.id; menus.refresh('quests');
  const b = [...document.querySelectorAll('[data-win="quests"] .btn')].find(x => x.textContent === '自动前往'); if (b) b.click();
  return { q: q.id, btn: !!b, pin: guide.pin, auto: guide.auto, closed: !menus.isOpen('quests') };
});
ok(a.btn && a.pin === a.q && a.auto && a.closed, `任务日志“自动前往”：指引切到这个任务并开始走（${a.q}）`);
await page.evaluate(() => { guide.auto = false; guide.release(); guide.pin = null; });
// ---- Ctrl：单独按才切换；Ctrl+Shift+Cmd+4（Mac 截图）不切换 ----
const d0 = await page.evaluate(() => uiPref('dropNames'));
await page.keyboard.down('Control'); await page.keyboard.down('Shift'); await page.keyboard.down('Meta'); await page.keyboard.press('Digit4'); await page.keyboard.up('Meta'); await page.keyboard.up('Shift'); await page.keyboard.up('Control');
const d1 = await page.evaluate(() => uiPref('dropNames'));
await page.keyboard.press('ControlLeft');
const d2 = await page.evaluate(() => uiPref('dropNames'));
ok(d1 === d0 && d2 === !d0, `组合键不触发，单独按 Ctrl 才切换（${d0} → ${d1} → ${d2}）`);
const banner = await page.evaluate(() => { const b = document.getElementById('toastbar'); return b && !b.hidden ? b.textContent : ''; });
ok(!/掉落物名称/.test(banner), '切换提示不再用大横幅盖住画面', banner);
const errs = logs.filter(l => l.type === 'pageerror'); ok(!errs.length, '没有页面错误', errs.length ? errs[0].text.slice(0, 300) : '');
await browser.close();
console.log(fail ? `${fail} 项失败` : '全部通过'); process.exit(fail ? 1 : 0);
