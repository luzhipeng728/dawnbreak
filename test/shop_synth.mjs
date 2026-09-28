// 装扮合成：自动放入（优先目标天空套还缺的部位）+ 一键合成（用完合成器 / 没有能配对的为止，已有天空的部位跳过）
import { launch, URL_BASE } from './lib.mjs';
import fs from 'fs';
const out = 'test/shots/shop'; fs.mkdirSync(out, { recursive: true });
let fail = 0; const ok = (c, m, x = '') => { console.log(c ? '  ✓' : '  ✗', m, x); if (!c) fail++; };
const { browser, page, logs } = await launch({ width: 1280, height: 720 });
await page.goto(`${URL_BASE}?town&mute&cls=gun&fresh`); await page.waitForFunction(() => window.__READY); await page.waitForTimeout(800);
const S0 = await page.evaluate(() => {
  while (menus.stack.length) menus.close(menus.stack[menus.stack.length - 1]);
  const adv = CASH_ADV_SETS[0], set = CASH_SKY_SETS[0];
  inv.items = [];
  const put = (slot, n) => { for (let i = 0; i < n; i++) inv.add(makeItem(avKey(adv, slot))); };
  put('av_top', 3); put('av_bottom', 2); put('av_hat', 1); put('av_shoes', 4); put('av_belt', 2);
  inv.add(makeItem(avKey(set, 'av_belt')));   // 腰带的天空已经有了：应当跳过
  inv.add(makeItem('synth_basic', 10));
  return { set, adv, pool: cashSynthPool().length };
});
await page.evaluate(() => menus.open('synth', { key: 'synth_basic' })); await page.waitForTimeout(400);
await page.click('[data-win="synth"] button:has-text("自动放入")'); await page.waitForTimeout(300);
const a = await page.evaluate(() => ({ n: CSY.ins.length, slots: [...new Set(CSY.ins.map(x => x.slot))] }));
ok(a.n === 2 && a.slots.length === 1 && a.slots[0] !== 'av_belt', `自动放入：2 件同部位（${a.slots[0]}），跳过已有天空的腰带`);
await page.screenshot({ path: `${out}/synth-auto.png` });
await page.click('[data-win="synth"] button:has-text("一键合成")'); await page.waitForTimeout(300);
await page.click('[data-win="ask"] button:has-text("开始合成")'); await page.waitForTimeout(800);
await page.screenshot({ path: `${out}/synth-batch.png` });
const b = await page.evaluate(set => {
  const g = cashSynthGroups(), left = inv.count('synth_basic');
  const pairsLeft = AV_PIECE_SLOTS.filter(s => g[s].length >= 2 && !cashSkyOwned(set, s));
  return { left, used: 10 - left, beltAdv: g.av_belt.length, pairsLeft, sky: inv.items.filter(it => CASH_SKY_SETS.some(st => AV_PIECE_SLOTS.some(sl => it.key === avKey(st, sl)))).map(it => it.slot) };
}, S0.set);
ok(b.used >= 3, `一键合成用掉了 ${b.used} 个合成器（失败退回的装扮继续参与）`, JSON.stringify(b));
ok(b.left === 0 || b.pairsLeft.length === 0, '结束条件：合成器用完，或者没有能配对的部位了', `剩余合成器 ${b.left}，可配对部位 ${b.pairsLeft.join(',') || '无'}`);
ok(b.beltAdv === 2, '已有天空的腰带没被拿去合成（2 件高级腰带还在）');
const errs = logs.filter(l => l.type === 'pageerror'); ok(!errs.length, '没有页面错误', errs.length ? errs[0].text.slice(0, 200) : '');
await browser.close();
console.log(fail ? `${fail} 项失败` : '全部通过'); process.exit(fail ? 1 : 0);
