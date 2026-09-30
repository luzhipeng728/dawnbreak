// 一键满级券账号共享：老存档背包里的券收进账号；任何角色都能在物品栏 / 选角界面用；邮件领取直接进账号
// 用法：node build.mjs && node test/maxlv_acct.mjs
import { launch, URL_BASE } from './lib.mjs';
const { browser, page, logs } = await launch({ width: 1280, height: 720 });
let fails = 0; const check = (ok, msg, x = '') => { console.log(ok ? '  ✓' : '  ✗', msg, x); if (!ok) fails++; };
await page.goto(`${URL_BASE}?mute`); await page.waitForFunction(() => window.__READY, null, { timeout: 30000 });
// 造一个老存档：角色 0 背包里有 6 张满级券，角色 1 是 Lv30
const r0 = await page.evaluate(async () => {
  const mk = (name, cls, lvl) => ({ name, cls, lvl, exp: 0, sp: 0, gold: 0, created: Date.now() + Math.random(), inv: [], storage: [], equip: {}, skillLv: {}, skillBar: [] });
  const a = mk('甲', 'sword', 30), b = mk('乙', 'gun', 30); a.inv.push({ key: 'tk_maxlv', n: 6, id: 1, kind: 'use' });
  localStorage.setItem(save.key, JSON.stringify({ v: SAVE_V, cur: 0, chars: [a, b], acct: { cera: 0 } }));
  save.loadAll(); return { acct: save.acct.maxlv, bagLeft: save.chars[0].inv.filter(i => i.key === 'tk_maxlv').length };
});
check(r0.acct === 6 && r0.bagLeft === 0, `老存档背包里的 6 张券收进账号（账号 ${r0.acct}，背包剩 ${r0.bagLeft}）`);
// 角色 1（乙）进游戏，物品栏按钮用 1 张
const r1 = await page.evaluate(async () => { save.select(1); await startGameNow(save.data.cls); while (menus.stack.length) menus.close(menus.stack[menus.stack.length - 1]); menus.open('inv'); await new Promise(r => setTimeout(r, 300));
  const sp0 = game.sp || 0, b = document.querySelector('[data-maxlv]'); const txt = b && b.textContent; b && b.click(); return { txt, lvl: game.lvl, left: save.acct.maxlv, sp: game.sp - sp0 }; });
let sp = 0; for (let l = 31; l <= 60; l++) sp += 6 * (28 + l);   // SP_MUL = 6
check(r1.txt === '一键满级 ×6' && r1.lvl === 60 && r1.left === 5 && r1.sp === sp, `另一个角色在物品栏也能用：${r1.txt} → Lv.${r1.lvl}，剩 ${r1.left}`, JSON.stringify(r1));
// 邮件领取：券直接进账号
const r2 = await page.evaluate(() => { const got = sxApplyClaim({ items: [{ key: 'tk_maxlv', n: 3 }] }); return { got, left: save.acct.maxlv, bag: inv.items.filter(i => i.key === 'tk_maxlv').length }; });
check(r2.left === 8 && r2.bag === 0, `邮件领取的券进账号（${r2.got.join('、')}，账号 ${r2.left}）`);
check(!logs.some(l => /error/i.test(l)), '没有报错');
await browser.close(); console.log(fails ? `✗ ${fails} 项失败` : '✓ 全部通过'); process.exit(fails ? 1 : 0);
