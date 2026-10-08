// 技能页签布局回归：转职技能较多时，每行不能被网格压扁，觉醒技能必须能滚动到并选中。
import { launch, URL_BASE } from './lib.mjs';

const { browser, page, logs } = await launch({ width: 1280, height: 720 });
let fail = 0;
const ok = (cond, name, detail = '') => { console.log(`${cond ? '  ✓' : '  ✗'} ${name}${cond ? '' : ` ${JSON.stringify(detail).slice(0, 500)}`}`); if (!cond) fail++; };

await page.goto(`${URL_BASE}?test&cls=priest&priest=1&mobs=0&mute`);
await page.waitForFunction(() => window.__READY, null, { timeout: 30000 });

const R = await page.evaluate(async () => {
  game.player.cls = 'priest'; game.job = 'monk';
  Object.assign((save.data.flags ??= {}), { awaken: true, awaken2: true, awaken3: true });
  if (typeof onJobChange === 'function') onJobChange(game.player, 'monk');
  menus.closeAll(); menus.skTab = 'job'; menus.skSel = 'pi_awaken3'; menus.open('skills');
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const root = menus.wins.skills, list = root && root.querySelector('.sklist2');
  const rect = e => { const b = e.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height, right: b.right, bottom: b.bottom }; };
  if (!list) return { missing: true };
  const lr = rect(list), rows = [...list.querySelectorAll('.ski2')];
  const rowData = rows.map(row => {
    const rr = rect(row), ic = row.querySelector('.skic'), ir = ic && rect(ic);
    return { id: row.querySelector('.skic')?.dataset.id, rr, ir, inRow: !!ir && ir.y >= rr.y - 1 && ir.bottom <= rr.bottom + 1, h: rr.h };
  });
  const ids = ['pi_awaken', 'pi_awaken2', 'pi_awaken3'];
  const aw = rowData.filter(x => ids.includes(x.id));
  const before = { top: list.scrollTop, height: list.scrollHeight, client: list.clientHeight };
  list.scrollTop = list.scrollHeight;
  const after = { top: list.scrollTop };
  const visible = aw.map(x => {
    const row = rows.find(r => r.querySelector('.skic')?.dataset.id === x.id), rr = row && rect(row);
    return { id: x.id, y: rr?.y, bottom: rr?.bottom, visible: !!rr && rr.bottom > lr.y && rr.y < lr.bottom };
  });
  const target = rows.find(x => x.querySelector('.skic')?.dataset.id === 'pi_awaken3');
  target?.click();
  return { missing: false, n: rows.length, lr, rowData, aw, before, after, visible, selected: menus.skSel, overflowX: list.scrollWidth - list.clientWidth };
});

ok(!R.missing, '转职技能页签正常渲染');
ok(R.n >= 30, `蓝拳转职技能完整显示（${R.n} 项）`, R.n);
ok(R.rowData?.every(x => x.inRow && x.h >= (x.ir?.h || 0) - 1), '技能图标和加减按钮都在各自行内，没有上下重叠', R.rowData?.filter(x => !x.inRow).slice(0, 3));
ok(R.overflowX <= 1, '技能列表没有横向溢出', R.overflowX);
ok(R.before?.height > R.before?.client && R.after?.top > 0, '技能较多时列表可滚动');
ok(R.visible?.every(x => x.visible), '滚动到底部后三个觉醒技能都可见', R.visible);
ok(R.selected === 'pi_awaken3', '觉醒技能可以点击选中', R.selected);
const errs = logs.filter(x => x.type === 'pageerror' || x.type === 'error');
ok(!errs.length, '技能窗口无页面错误', errs.slice(0, 3));

await browser.close();
console.log(fail ? `失败 ${fail} 项` : '全部通过');
process.exit(fail ? 1 : 0);
