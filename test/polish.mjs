// 收尾打磨的回归：提示横幅排队 / 任务与获得类消息只进系统消息、1280 宽 I/M/K 并排、路人名牌不重叠、NPC 眨眼、隐藏门、决斗后回城
import { launch, URL_BASE } from './lib.mjs';
const { browser, page, logs } = await launch({ width: 1280, height: 720 });
const wait = ms => page.waitForTimeout(ms), ev = (f, a) => page.evaluate(f, a);
let fail = 0; const ok = (c, m, d = '') => { console.log(`  ${c ? '✓' : '✗'} ${m}${d ? '  ' + d : ''}`); if (!c) fail++; };
await page.goto(`${URL_BASE}?town&cls=sword&mute&fresh`); await page.waitForFunction(() => window.__READY); await wait(600);
if (await ev(() => menus.isOpen('help'))) await page.keyboard.press('Escape');
await ev(() => setPref('winPos', {}));

console.log('· 提示消息');
const t = await ev(async () => {
  toastList.length = 0; const log0 = ui.log.length;
  toastMsg('获得 测试物品', '#fff'); toastMsg('接受任务：测试', '#fff'); toastMsg('任务目标达成：测试', '#fff');
  const logOnly = toastList.length === 0 && ui.log.length === log0 + 3;
  toastMsg('横幅一'); toastMsg('横幅二'); toastMsg('横幅一');
  const queued = toastList.map(m => m.msg);
  await new Promise(r => setTimeout(r, 200));
  const bar = document.getElementById('toastbar'), vis = bar && !bar.hidden ? bar.textContent : null;
  return { logOnly, queued, vis, count: document.querySelectorAll('#toastbar').length };
});
ok(t.logOnly, '获得 / 接受任务 / 目标达成 只进左下系统消息，不上横幅');
ok(t.queued.join() === '横幅一,横幅二', '横幅排队、同样的消息不重复排', t.queued.join());
ok(t.vis === '横幅一' && t.count === 1, '同一时间只显示一条横幅', String(t.vis));
await wait(3200);
ok(await ev(() => toastList.length <= 1), '横幅按顺序播完');

console.log('· 1280 宽同时打开 I / M / K');
for (const k of ['KeyI', 'KeyM', 'KeyK']) { await page.keyboard.press(k); await wait(250); }
const W = await ev(() => ['inv', 'status', 'skills'].map(n => { const e = menus.wins[n]; return e && { n, x: e.offsetLeft, w: e.offsetWidth, compact: e.classList.contains('compact') }; }));
const sorted = W.filter(Boolean).sort((a, b) => a.x - b.x), overlap = sorted.some((w, i) => i && sorted[i - 1].x + sorted[i - 1].w > w.x + 1);
ok(sorted.length === 3 && !overlap && sorted.at(-1).x + sorted.at(-1).w <= 1280, '三个窗口并排、互不重叠、都在屏幕内', JSON.stringify(sorted));
ok(W[2] && W[2].compact, '技能窗口自动切成紧凑版');
await ev(() => { menus.close('inv'); menus.close('status'); }); await wait(200);
ok(await ev(() => !menus.wins.skills.classList.contains('compact')), '其它窗口关掉后技能窗口恢复完整版');
await ev(() => menus.closeAll());

console.log('· 路人名牌 / NPC 眨眼');
await ev(() => enterScene('hm_plaza', { x: 1200, y: 80 })); await wait(1500);
const L = await ev(() => {
  const k = world.npcs.find(e => e.npc.id === 'kiri'); game.player.x = k.x - 120; cam.x = clamp(game.player.x - WW / 2, 0, world.S.width - WW);
  const used = new Set(world.crowd.map(c => c.name)); while (world.crowd.length < 8) world.crowd.push(makePasserby(world.S, used, 0.3));
  world.crowd.forEach((w, i) => { w.x = k.x - 90 + (i % 4) * 30; w.y = 40 + Math.floor(i / 4) * 14; w.st = 'idle'; w.wait = 99; w.a = 1; w.fade = 1; });
  const drawn = []; const o = Passerby.prototype.drawLabel; Passerby.prototype.drawLabel = function (c, X, ny) { drawn.push({ X, ny, half: 30, top: this.guild ? 20 : 10 }); };
  renderScene(wctx); Passerby.prototype.drawLabel = o;
  const hit = drawn.some((a, i) => drawn.some((b, j) => j > i && Math.abs(a.X - b.X) < 20 && Math.abs(a.ny - b.ny) < 8));
  const e = world.npcs.find(e => e.model.eyes); let err = null; if (e) { e.model.blinkT = 0.1; try { renderScene(wctx); } catch (x) { err = x.message; } }
  return { n: drawn.length, hit, blinkNpcs: world.npcs.filter(e => e.model.eyes).length, err };
});
ok(L.n > 0 && L.n < 8 && !L.hit, `8 个路人挤在一起：画出 ${L.n} 个名牌，互不重叠（放不下的先不显示）`);
ok(L.blinkNpcs > 0 && !L.err, `NPC 眨眼（这里 ${L.blinkNpcs} 个 NPC 有眼睛数据，绘制无报错）`, L.err || '');

console.log('· 决斗场回城');
await ev(() => save.write());
await page.goto(`${URL_BASE}?duel=sword&vs=gun&mute`); await page.waitForFunction(() => window.__READY); await wait(800);
await page.keyboard.press('Escape'); await wait(300);
ok(await page.locator('.sysmenu .btn:has-text("离开决斗场")').count() === 1, '决斗场的系统菜单有“离开决斗场，回到城镇”');
ok(await ev(() => { questUI.trackRect = null; ui.draw(); return !questUI.trackRect; }), '决斗场里不画任务追踪栏');

const errs = logs.filter(l => l.type === 'pageerror'); ok(!errs.length, '没有页面错误', JSON.stringify(errs.slice(0, 2)));
console.log(fail ? `\n失败 ${fail} 项` : '\n全部通过');
await browser.close();
process.exit(fail ? 1 : 0);
