// 强化 / 增幅不设上限：+16 以后还能继续冲，成功率递减（最低 1%），加成继续变大；界面打开 +20 的装备不报错
import { launch, URL_BASE } from './lib.mjs';
const { browser, page, logs } = await launch({ width: 1280, height: 720 });
let fail = 0; const ok = (c, m, d = '') => { console.log(`${c ? '  ✓' : '  ✗'} ${m} ${c ? '' : JSON.stringify(d).slice(0, 300)}`); if (!c) fail++; };
await page.goto(`${URL_BASE}?town&cls=sword&mute`); await page.waitForFunction(() => window.__READY && game.player, null, { timeout: 30000 });
const r = await page.evaluate(async () => {
  const w = makeItem('katana_60_3') || rollEquip({ slot: 'weapon', lvl: 60, cls: 'sword', rar: 3 });
  const rates = [15, 16, 20, 30, 60].map(enhRate), bon = [15, 16, 17, 20, 25].map(enhBonus);
  w.enh = 16; inv.add(w); game.gold = 1e12; inv.add(makeItem('crystal', 99999)); const before = JSON.stringify(enhStats(w));
  const r16 = tryEnhance(w, false, 0);   // 随机数 0 = 必定成功：+16 → +17 能冲
  const a = rollEquip({ slot: 'top', lvl: 60, rar: 3 }); a.enh = 0; a.dim = null;
  const setOk = ampSetLevel(a, 20, { stat: 'str' }); const red = [16, 17, 20, 25].map(l => ampStatVal(a, l));
  inv.add(a); IW.enhSel = a; menus.open('amplify'); await new Promise(r => setTimeout(r, 300));
  return { r16: r16 && r16.ok, lv17: w.enh, rates, bon, before, after: JSON.stringify(enhStats({ ...w, enh: 20 })), setOk, aEnh: a.enh, red, ampRates: [15, 16, 20, 40].map(ampRate), win: !!menus.wins.amplify };
});
ok(r.rates.every((v, i) => i === 0 || v <= r.rates[i - 1]) && r.rates.at(-1) >= 0.01 && r.rates[2] > 0, `强化成功率递减、最低 1%：${r.rates.map(v => (v * 100).toFixed(1) + '%').join(' / ')}`, r.rates);
ok(r.bon.every((v, i) => i === 0 || v > r.bon[i - 1]), `强化加成继续变大：${r.bon.map(v => v.toFixed(2)).join(' / ')}`, r.bon);
ok(r.setOk && r.aEnh === 20 && r.red.every((v, i) => i === 0 || v > r.red[i - 1]), `增幅能到 +20，红字继续变大：${r.red.join(' / ')}`, r);
ok(r.ampRates.every(v => v >= 0.01), `增幅成功率最低 1%：${r.ampRates.map(v => (v * 100).toFixed(1) + '%').join(' / ')}`, r.ampRates);
ok(r.win, '增幅窗口打开 +20 的装备正常');
ok(r.r16 && r.lv17 === 17, '+16 还能继续强化到 +17', r);
const errs = logs.filter(l => l.type === 'pageerror'); ok(!errs.length, '没有页面错误', errs[0]);
await browser.close(); console.log(fail ? `${fail} 项失败` : '全部通过'); process.exit(fail ? 1 : 0);
