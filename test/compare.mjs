// 装备好坏对比：背包格子角标 ▲▼=× 与 tooltip 总结；模拟穿戴不能改动玩家真实属性
import { launch, URL_BASE, openLists } from './lib.mjs';
import fs from 'fs';
const out = 'test/shots/compare'; fs.mkdirSync(out, { recursive: true });
let fail = 0; const ok = (c, m, x = '') => { console.log(c ? '  ✓' : '  ✗', m, x); if (!c) fail++; };
for (const cls of (await openLists()).classes) {   // 已开放的职业（读 CLASSES，跳过 ready:false）
  const { browser, page, logs } = await launch({ width: 1280, height: 720 });
  await page.goto(`${URL_BASE}?town&mute&cls=${cls}`); await page.waitForFunction(() => window.__READY);
  await page.waitForTimeout(800);
  const r = await page.evaluate((cls) => {
    if (menus.isOpen('help')) menus.close('help');
    testLoadout(10);
    const other = cls === 'sword' ? 'gun' : 'sword';
    // 高品级的随机武器可能是别的职业的（和官方一样会掉别职业装备），测试用的武器只取本职业能用的
    // 本职业的武器还要当前转职能装（格斗家的拳套只有散打能装）
    const mk = (slot, lvl, rar, c) => { for (let i = 0; i < 80; i++) { const it = makeEquip(slot, lvl, rar, c); if (slot !== 'weapon' || !it.cls || (it.cls === c && (c !== cls || inv.canWear(it, true) === true))) return it; } return makeEquip(slot, lvl, rar, c); };
    const better = mk('weapon', 14, 4, cls), worse = mk('weapon', 1, 0, cls), otherW = mk('weapon', 10, 3, other); otherW.cls = other;   // 随机名品可能不带职业，这里固定成别的职业
    const topBetter = mk('top', 15, 4), topWorse = mk('top', 1, 0), broken = mk('weapon', 20, 4, cls); broken.durMax = broken.durMax || 30; broken.dur = 0;
    inv.items = [better, worse, otherW, topBetter, topWorse, broken];
    const before = JSON.stringify(game.player.stats), hpBefore = game.player.hp;
    const res = inv.items.map(it => { const c = equipCompare(it); return { name: it.name, v: c && c.v, total: c && c.total != null ? +(c.total * 100).toFixed(1) : null }; });
    const after = JSON.stringify(game.player.stats);
    return { res, same: before === after && game.player.hp === hpBefore, type: mainDmgType(game.player) };
  }, cls);
  console.log(`== ${cls}（主要伤害类型 ${r.type}）`, JSON.stringify(r.res));
  const v = r.res.map(x => x.v);
  ok(v[0] === 'up', '高级武器 → ▲'); ok(v[1] === 'down', '低级武器 → ▼'); ok(v[2] === 'na', '别的职业的武器 → ×');
  ok(v[3] === 'up', '高级上衣 → ▲'); ok(v[4] === 'down', '低级上衣 → ▼'); ok(v[5] === 'down', '耐久 0 的武器 → ▼（没有属性）');
  ok(r.same, '模拟对比没有改动玩家真实属性');
  await page.keyboard.press('KeyI'); await page.waitForTimeout(500);
  const badges = await page.evaluate(() => [...document.querySelectorAll('[data-win="inv"] .islot .cmp')].map(e => e.className.replace('cmp ', '') + e.textContent));
  ok(badges.length === 6, '物品栏里 6 件装备都有角标', JSON.stringify(badges));
  const slot = page.locator('[data-win="inv"] .islot').first(); await slot.hover(); await page.waitForTimeout(300);
  const tip = await page.evaluate(() => { const t = document.querySelector('#itip .cmpsum'); return t ? t.textContent : null; });
  ok(tip && tip.includes('换上后综合'), 'tooltip 显示换上后的综合变化', tip || '');
  await page.screenshot({ path: `${out}/${cls}.png` });
  const errs = logs.filter(l => l.type === 'pageerror'); ok(!errs.length, '没有页面错误', errs.length ? errs[0].text.slice(0, 200) : '');
  await browser.close();
}
console.log(fail ? `${fail} 项失败` : '全部通过'); if (fail) process.exitCode = 1;
// ---- 套装：身上的部件绿框 + 件数 + 生效流光；背包里的部件“套”；换上会激活新档位时提示 ----
{
  let f2 = 0; const ok2 = (c, m, x = '') => { console.log(c ? '  ✓' : '  ✗', m, x); if (!c) f2++; };
  const { browser, page, logs } = await launch({ width: 1280, height: 720 });
  await page.goto(`${URL_BASE}?town&mute&cls=sword`); await page.waitForFunction(() => window.__READY); await page.waitForTimeout(800);
  const r = await page.evaluate(() => {
    if (menus.isOpen('help')) menus.close('help');
    testLoadout(20);
    // 找一个有 2 件套和 3 件套效果、部件不是武器的套装
    const id = Object.keys(SETS).find(k => { const S = SETS[k]; return S.bonus[2] && S.bonus[3] && S.pieces.length >= 3 && S.pieces.every(p => ITEMS[p] && ITEMS[p].slot !== 'weapon'); });
    const S = SETS[id], its = S.pieces.slice(0, 3).map(k => makeItem(k));
    for (const it of its) it.lvl = Math.min(it.lvl, game.lvl);
    inv.equip[its[0].slot] = its[0]; inv.equip[its[1].slot] = its[1]; recalcStats(game.player);
    inv.items = [its[2]];
    const c = equipCompare(its[2]);
    return { set: S.name, pieces: S.pieces.length, gained: c.gained, v: c.v };
  });
  console.log('== 套装', JSON.stringify(r));
  ok2(r.gained && r.gained.some(x => x.includes('3 件套')), '背包里的第 3 件：提示“激活 3 件套”', JSON.stringify(r.gained));
  await page.keyboard.press('KeyM'); await page.waitForTimeout(400); await page.keyboard.press('KeyI'); await page.waitForTimeout(500);
  const d = await page.evaluate(() => ({
    doll: [...document.querySelectorAll('[data-win="status"] .doll .islot.set')].map(e => ({ tag: (e.querySelector('.settag') || {}).textContent, on: e.classList.contains('seton') })),
    inv: [...document.querySelectorAll('[data-win="inv"] .islot.set .settag')].map(e => e.textContent) }));
  ok2(d.doll.length === 2 && d.doll.every(x => x.tag === `2/${r.pieces}` && x.on), `纸娃娃上 2 件套装：绿框、角标 2/${r.pieces}、生效流光`, JSON.stringify(d.doll));
  ok2(d.inv.length === 1 && d.inv[0] === '套', '背包里的套装部件标“套”', JSON.stringify(d.inv));
  const first = page.locator('[data-win="status"] .doll .islot.set').first(); await first.hover(); await page.waitForTimeout(250);
  const hl = await page.evaluate(() => document.querySelectorAll('[data-win="status"] .doll .islot.sethl').length);
  ok2(hl === 2, '悬停一件套装，同套部件一起高亮', String(hl));
  await page.screenshot({ path: `${out}/sets.png` });
  const invSlot = page.locator('[data-win="inv"] .islot.set').first(); await invSlot.hover(); await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/sets-tip.png` });
  const errs = logs.filter(l => l.type === 'pageerror'); ok2(!errs.length, '没有页面错误', errs.length ? errs[0].text.slice(0, 200) : '');
  await browser.close();
  console.log(f2 ? `套装 ${f2} 项失败` : '套装全部通过'); if (f2) process.exitCode = 1;
}
