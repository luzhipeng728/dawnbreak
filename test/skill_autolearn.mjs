// 一键加点 / 自动学前置 / 升级 SP 够把每个职业当前能学的技能加满（老角色补差额，只补一次；新角色不重复补）
// 用法：node test/skill_autolearn.mjs
import { launch, URL_BASE } from './lib.mjs';
const { browser, page, logs } = await launch({ width: 1280, height: 720 });
let fail = 0; const ok = (c, m, d = '') => { console.log(`${c ? '  ✓' : '  ✗'} ${m} ${c ? '' : JSON.stringify(d).slice(0, 400)}`); if (!c) fail++; };
const ready = () => page.waitForFunction(() => window.__READY, null, { timeout: 30000 });

await page.goto(`${URL_BASE}?mute`); await ready();
const mig = await page.evaluate(() => {
  const c = { ...save.defaults('sword', '老角色'), v: SAVE_V, lvl: 60, sp: 777 }; delete c.spMul; delete c.spVer;
  localStorage.setItem(save.key, JSON.stringify({ v: SAVE_V, cur: 0, chars: [c], acct: {} }));
  save.live = false; save.loadAll(); const a = save.chars[save.chars.length - 1]; const sp1 = a.sp, ver = a.spVer; save.persist();
  save.loadAll(); const sp2 = save.chars[save.chars.length - 1].sp;
  save.newGame('gun', '新角色');
  return { sp1, sp2, ver, want: 777 + spTotalAt(60) - spLegacyTotal(60, 1), newVer: save.data.spVer, newSp: save.data.sp };
});
ok(mig.sp1 === mig.want && mig.sp2 === mig.sp1 && mig.ver === 2, `老角色 Lv60 补发 SP 差额 ${mig.want - 777}，只补一次`, mig);
ok(mig.newVer === 2 && mig.newSp === 150, '新角色一开始就按新规则（不会被重复补发）', mig);
const fit = await page.evaluate(() => {
  const bad = [];
  let tight = null;
  for (const cls of Object.keys(CLASSES)) for (const job of Object.keys(CLASSES[cls].jobs || {})) {
    for (let L = 1; L <= 60; L++) {
      const cost = skillSpToMax(cls, job, L), sp = spTotalAt(L);
      if (cost > sp) bad.push({ cls, job, L, cost, sp });
      const gap = sp - cost;
      if (!tight || gap < tight.gap) tight = { cls, job, name: CLASSES[cls].jobs[job].name, L, cost, sp, gap };
    }
  }
  return { bad: bad.slice(0, 6), nBad: bad.length, tight, at60: spTotalAt(60) };
});
ok(!fit.nBad, `每个职业 1~60 级的累计 SP 都够加满当前能学的技能（Lv60 共 ${fit.at60}）`, fit);

const jobs = { sword: ['blade', 'berserker'], mage: ['summoner'], fighter: ['striker', 'grappler'], priest: ['monk', 'crusader'] };
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
await page.goto(`${URL_BASE}?test&cls=${fit.tight.cls}&mobs=0&mute`); await ready();
const mid = await page.evaluate(t => {
  game.lvl = t.L; game.job = t.job; game.player.cls = t.cls;
  Object.assign((save.data.flags ??= {}), { awaken: true, awaken2: true, awaken3: true });
  const C = CLASSES[t.cls], J = C.jobs[t.job];
  game.skillLv = {}; for (const id of C.start || []) game.skillLv[id] = 1; for (const id of (J.auto || [])) game.skillLv[id] = 1;
  game.sp = spTotalAt(t.L);
  skillAutoLearn();
  const { base, job: Js } = skillPages();
  const notMax = [...base, ...Js].filter(id => { const S = SKILLS[id], lv = game.skillLv[id] || 0; return lv < skillMaxLv(S) && skillLvReq(S, lv + 1) <= t.L; });
  return { left: game.sp, notMax };
}, fit.tight);
ok(!mid.notMax.length && mid.left >= 0, `${fit.tight.cls}:${fit.tight.job} Lv${fit.tight.L}（最紧的一级）一键加点全部学满，剩 SP ${mid.left}`, mid);

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
