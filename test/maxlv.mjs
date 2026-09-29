// 一键满级券：Lv.30 用了 → Lv.60、SP 按每级 28+n 累加、只提示一次、券扣掉；满级再用会被拒绝
// 用法：node build.mjs && node test/maxlv.mjs
import { launch, URL_BASE } from './lib.mjs';
const { browser, page, logs } = await launch({});
let fails = 0; const check = (ok, msg, x = '') => { console.log(ok ? '  ✓' : '  ✗', msg, x); if (!ok) fails++; };
await page.goto(`${URL_BASE}?town&fresh&mute&cls=sword`);
await page.waitForFunction(() => window.__READY && game.player && game.scene === 'town', null, { timeout: 30000 });
const r = await page.evaluate(() => {
  game.lvl = 30; game.exp = 0; game.sp = 0; recalcStats(game.player);
  inv.add(makeItem('tk_maxlv', 2)); const hp0 = game.player.hpMax; let ev = 0; bus.on('levelUp', () => ev++);
  const ok1 = inv.useItem(inv.items.find(i => i.key === 'tk_maxlv'));
  const after = { lvl: game.lvl, sp: game.sp, n: inv.count('tk_maxlv'), ev, hpUp: game.player.hpMax > hp0 };
  const ok2 = inv.useItem(inv.items.find(i => i.key === 'tk_maxlv'));
  return { ok1, after, ok2, left: inv.count('tk_maxlv') };
});
let sp = 0; for (let l = 31; l <= 60; l++) sp += 28 + l;
check(r.after.lvl === 60, `升到 Lv.${r.after.lvl}`);
check(r.after.sp === sp, `SP ${r.after.sp}（应为 ${sp}）`);
check(r.after.n === 1 && r.after.ev === 1 && r.after.hpUp, '券扣 1 张、升级事件只发 1 次、属性重算', JSON.stringify(r.after));
check(!r.ok2 && r.left === 1, '满级再用被拒绝、不扣券');
check(!logs.some(l => /error/i.test(l)), '没有报错');
await browser.close(); console.log(fails ? `✗ ${fails} 项失败` : '✓ 全部通过'); process.exit(fails ? 1 : 0);
