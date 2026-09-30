// 一键加点 / 自动学前置 / SP ×SP_MUL（老角色补发差额，只补一次；新角色不重复补）
// 用法：node test/skill_autolearn.mjs
import { launch, URL_BASE } from './lib.mjs';
const { browser, page, logs } = await launch({ width: 1280, height: 720 });
let fail = 0; const ok = (c, m, d = '') => { console.log(`${c ? '  ✓' : '  ✗'} ${m} ${c ? '' : JSON.stringify(d).slice(0, 400)}`); if (!c) fail++; };
const ready = () => page.waitForFunction(() => window.__READY, null, { timeout: 30000 });

await page.goto(`${URL_BASE}?mute`); await ready();
const mig = await page.evaluate(() => {
  const c = { ...save.defaults('sword', '老角色'), v: SAVE_V, lvl: 60, sp: 777 }; delete c.spMul;
  localStorage.setItem(save.key, JSON.stringify({ v: SAVE_V, cur: 0, chars: [c], acct: {} }));
  save.live = false; save.loadAll(); const a = save.chars[save.chars.length - 1]; const sp1 = a.sp, mul = a.spMul; save.persist();
  save.loadAll(); const sp2 = save.chars[save.chars.length - 1].sp;
  return { sp1, sp2, mul, want: 777 + spTotalAt(60, SP_MUL) - spTotalAt(60, 1), newMul: (() => { save.newGame('gun', '新角色'); return save.data.spMul; })() };
});
ok(mig.sp1 === mig.want && mig.sp2 === mig.sp1 && mig.mul === 6, `老角色 Lv60 补发 SP 差额 ${mig.want - 777}，只补一次`, mig);
ok(mig.newMul === 6, '新角色一开始就按新规则（不会被重复补发）', mig);

const jobs = { sword: ['blade', 'berserker'], mage: ['summoner'], fighter: ['striker', 'grappler'] };
for (const [cls, list] of Object.entries(jobs)) for (const job of list) {
  await page.goto(`${URL_BASE}?test&cls=${cls}&mobs=0&mute`); await ready();
  const r = await page.evaluate(job => {
    game.lvl = 60; game.job = job; Object.assign((save.data.flags ??= {}), { awaken: true, awaken2: true, awaken3: true });
    resetSkills(); game.sp = spTotalAt(60) - 0;   // 只用 Lv60 的 SP 总量（不算任务奖励）
    const n = skillAutoLearn(), { base, job: J } = skillPages();
    const notMax = [...base, ...J].filter(id => { const S = SKILLS[id], lv = game.skillLv[id] || 0; return lv < skillMaxLv(S) && skLvReq(S, lv + 1) <= 60; });
    return { n, left: game.sp, notMax, bar: game.skillBar.filter(Boolean).length };
  }, job);
  ok(r.n > 0 && !r.notMax.length && r.left >= 0, `${cls}:${job} Lv60 一键加点：全部学满，剩 SP ${r.left}`, r);
}

await page.goto(`${URL_BASE}?test&cls=fighter&mobs=0&mute`); await ready();
const pre = await page.evaluate(() => {
  game.lvl = 60; game.job = 'striker'; resetSkills(); game.sp = 5000;
  const id = Object.keys(SKILLS).find(k => SKILLS[k].job === 'striker' && Object.keys(SKILLS[k].pre || {}).length && !(game.skillLv[k] > 0));
  const S = SKILLS[id], pid = Object.keys(S.pre)[0]; game.skillLv[pid] = 0;
  const before = skillUpBlock(id), okUp = skillUp(id);
  return { id, pid, before, okUp, lv: game.skillLv[id], plv: game.skillLv[pid], need: S.pre[pid] };
});
ok(/^需要/.test(pre.before) && pre.okUp && pre.lv === 1 && pre.plv >= pre.need, `缺前置时点 +：先自动学会前置（${pre.pid} → ${pre.id}）`, pre);
const ui = await page.evaluate(async () => { menus.open('skills'); await new Promise(r => setTimeout(r, 300)); return !!document.querySelector('[data-autolearn]'); });
ok(ui, '技能窗口有「一键加点」按钮');
await page.screenshot({ path: 'test/shots/skill_autolearn.png' });
const errs = logs.filter(l => l.type === 'pageerror'); ok(!errs.length, '没有页面错误', errs[0]);
await browser.close();
console.log(fail ? `${fail} 项失败` : '全部通过'); process.exit(fail ? 1 : 0);
