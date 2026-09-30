// 格斗家转职测试：街霸（brawler，B6，docs/CLASS_PLAN_FIGHTER.md §4）。node test/fighter_brawler.mjs（约 10 秒，quick.sh g2 / all.sh）
// 查：转职登记（精通 / 伤害类型）、技能 id 都在 FIGHTER_IDS.brawler 里且都有定义、主动技能逐个对着木桩能放出来、伤害技能都打得中、
//     投掷物消耗（普通 1 / 强化 4 / 两连投 2）、异常个数加伤上限、不报错。机制细节（装填冷却 / 抓取 / 锁链 / 觉醒 / 连拍）在 test/brawler.mjs。
// 开放时（J.ready 去掉）再加进 all.sh 的 classes / skillaudit 行（`fighter:brawler`）
import { launch, URL_BASE } from './lib.mjs';
const JOB = 'brawler';
let fail = 0;
const report = (name, ok, info) => { if (!ok) fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${JSON.stringify(info)}`); };
const { browser, page, logs } = await launch({ width: 960, height: 540 });
await page.goto(`${URL_BASE}?test&cls=fighter&fighter=1&mobs=0&mute`); await page.waitForFunction(() => window.__READY, null, { timeout: 30000 });
const R = await page.evaluate(JOB => {
  game.paused = true; window.toastMsg = () => {};
  const p = game.player, J = CLASSES.fighter.jobs[JOB], run = n => { for (let i = 0; i < n; i++) step(1 / 60); };
  game.job = JOB; Object.assign((save.data.flags ??= {}), { awaken: true, awaken2: true, awaken3: true });
  if (typeof onJobChange === 'function') onJobChange(p, JOB);
  for (const id of classSkills('fighter', JOB)) game.skillLv[id] = Math.max(1, Math.min(SKILLS[id] ? SKILLS[id].maxLv || 5 : 1, 5));
  const stray = J.skills.filter(id => !FIGHTER_IDS[JOB].includes(id)), undef = J.skills.filter(id => !SKILLS[id]);
  const bad = [];
  for (const id of J.skills.filter(id => SKILLS[id] && (SKILLS[id].act || SKILLS[id].instant) && !SKILLS[id].passive)) {
    for (const e of ents) if (e.team === 'e') e.remove = true; run(1);
    const m = spawnMonster('goblin', p.x + 70, p.y); m.control = null; m.hp = m.hpMax = 1e9; m.invul = 0;
    Object.assign(p, { z: 0, vz: 0, vx: 0, cool: {}, mp: 1e6, mpMax: 1e6, buffs: {} }); p.act = null; p.setState('idle');
    const ok = castSkill(p, id); run(1);
    if (!ok || !(p.act || typeof SKILLS[id].instant === 'function')) bad.push(id);
    run(240);
  }
  return { reg: !!J, ready: J.ready, armor: J.armor, dmg: J.dmgType || 'phys', n: J.skills.length, stray, undef, bad };
}, JOB);
report('转职登记（精通 heavy、伤害 mag）', R.reg && R.armor === 'heavy' && R.dmg === 'mag', { ready: R.ready, armor: R.armor, dmg: R.dmg });
report(`技能 id 都在预留表 FIGHTER_IDS.${JOB} 里、都有定义（${R.n} 个）`, !R.stray.length && !R.undef.length, { stray: R.stray, undef: R.undef });
report('主动技能逐个对着木桩能放出来', !R.bad.length, R.bad);
// ---------------- 转职专属（B6）：每个伤害技能对着木桩都打得中；投掷物装填 / 强化投掷 / 两连投 / 异常加伤的快速检查（详细的在 test/brawler.mjs）----------------
const X = await page.evaluate(JOB => {
  const p = game.player, run = n => { for (let i = 0; i < n; i++) step(1 / 60); };
  const reset = () => { clearAllSummons(); for (const e of ents) if (e.team === 'e') e.remove = true; projs.length = 0; run(1); Object.assign(p, { x: 500, z: 0, vz: 0, vx: 0, face: 1, cool: {}, mp: 1e6, mpMax: 1e6, buffs: {}, charges: {}, invul: 0 }); p.act = null; p.setState('idle'); run(2); fbReloadTick(p); };
  const dummy = dx => { const m = spawnMonster('goblin', p.x + dx, p.y); m.control = null; m.hp = m.hpMax = 1e9; m.invul = 0; return m; };
  const miss = [];
  for (const id of CLASSES.fighter.jobs[JOB].skills) { const S = SKILLS[id]; if (S.passive || S.buff || id === 'fb_strong') continue;
    reset(); const m = dummy(90); castSkill(p, id); run(260); if (m.hp >= m.hpMax) miss.push(id); }
  reset(); const Q = chargesOf(p, 'fb_needle'), n0 = Q.n; castSkill(p, 'fb_needle'); run(30); const one = n0 - Q.n;
  reset(); castSkill(p, 'fb_strong'); run(3); const Q2 = chargesOf(p, 'fb_needle'), m0 = Q2.n; castSkill(p, 'fb_needle'); run(30); const four = m0 - Q2.n;
  reset(); castSkill(p, 'fb_backstreet'); run(40); const B = { ...p.buffs }; reset(); p.buffs = B; const Q3 = chargesOf(p, 'fb_poison'), k0 = Q3.n; castSkill(p, 'fb_poison'); run(60); const two = k0 - Q3.n;
  reset(); const m = dummy(90); addStatus(m, 'poison', 9); addStatus(m, 'bleed', 9); addStatus(m, 'slow', 9); addStatus(m, 'blind', 9); const n4 = fbN(m), mul = fbAbnMul(m, 0.2);
  return { miss, one, four, two, n4, mul };
}, JOB);
report('伤害技能对着木桩都打得中（觉醒 / 投掷 / 锁链 / 抓取）', !X.miss.length, X.miss);
report('毒针耗 1、强化投掷耗 4、后街战术毒瓶两连投耗 2', X.one === 1 && X.four === 4 && X.two === 2, { one: X.one, four: X.four, two: X.two });
report('异常个数加伤：4 个异常按 3 个算（+60%）', X.n4 === 4 && Math.abs(X.mul - 1.6) < 1e-9, { n: X.n4, mul: X.mul });

const errs = logs.filter(l => l.type === 'pageerror' || l.type === 'error'); report('无报错', errs.length === 0, errs.slice(0, 3));
await browser.close();
console.log(fail ? `${fail} 项失败` : '全部通过');
process.exit(fail ? 1 : 0);
