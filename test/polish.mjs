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

console.log('· 装备特效 Buff 图标 / 小屏字号');
const B = await ev(() => {
  const px = cv => { const d = cv.getContext('2d').getImageData(0, 0, 64, 64).data, set = new Set(); for (let i = 0; i < d.length; i += 16) set.add(d[i] >> 4 << 8 | d[i + 1] >> 4 << 4 | d[i + 2] >> 4); return set.size; };
  const item = Object.keys(ITEMS).find(k => ITEMS[k].proc && [].concat(ITEMS[k].proc).some(x => x.act === 'buff'));
  return { item: px(buffIcon('gear_t1', { src: item, col: '#ff8a4a' })), shield: px(buffIcon('gear_shield', { col: '#6ad0ff' })), atk: px(buffIcon('gear_t2', { atk: 0.1, col: '#ff8a4a' })), pot: px(buffIcon('item_potStr', { atk: 0.08 })) };
});
ok(Object.values(B).every(n => n > 12), '装备特效 / 护盾 / 秘药的 Buff 图标是正经图标（不是纯色方块）', JSON.stringify(B));
await page.setViewportSize({ width: 844, height: 390 }); await wait(300);
await ev(() => menus.open('cash')); await wait(500);
const S = await ev(() => { const q = s => { const e = menus.wins.cash.querySelector(s); return e ? parseFloat(getComputedStyle(e).fontSize) : 99; }; const mb = document.querySelector('#menubar button'); return { small: document.body.classList.contains('smallui'), lim: q('.ccard .lim'), note: q('.cash-note'), mbOk: !mb || mb.querySelector('b').getBoundingClientRect().height <= mb.getBoundingClientRect().height }; });
ok(S.small && S.lim >= 7.5 && S.note >= 7.5, '手机横屏大小（非触屏）：商城小字不小于 7.5px', JSON.stringify(S));
ok(S.mbOk, '小屏：右下菜单按钮的字不溢出按钮');
await ev(() => menus.closeAll()); await page.setViewportSize({ width: 1280, height: 720 }); await wait(300);

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
