// 格斗家转职测试：气功师（nenmaster）—— B0 生成的模板，B4 接着写（docs/CLASS_PLAN_FIGHTER.md §4）。node test/fighter_nenmaster.mjs
// 现在查：转职登记（精通 / 伤害类型）、技能 id 都在 FIGHTER_IDS.nenmaster 里且都有定义、主动技能逐个对着木桩能放出来、不报错。
// B4：在下面“转职专属”一节加本转职的机制测试（念气环绕 / 龙虎啸换普攻（FIGHTER_ACT_PICK）/ 风雷能量槽 / 念气罩队伍无敌 / 金雷虎骑乘）；做完把这个文件加进 test/quick.sh 的 g2 和 test/all.sh，
//     开放时（J.ready 去掉）再加进 all.sh 的 classes / skillaudit 行（`fighter:nenmaster`）
import { launch, URL_BASE } from './lib.mjs';
const JOB = 'nenmaster';
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
report('转职登记（精通 cloth、伤害 mag）', R.reg && R.armor === 'cloth' && R.dmg === 'mag', { ready: R.ready, armor: R.armor, dmg: R.dmg });
report(`技能 id 都在预留表 FIGHTER_IDS.${JOB} 里、都有定义（${R.n} 个）`, !R.stray.length && !R.undef.length, { stray: R.stray, undef: R.undef });
report('主动技能逐个对着木桩能放出来', !R.bad.length, R.bad);
// ---------------- 转职专属（B4 往这里加）----------------

const errs = logs.filter(l => l.type === 'pageerror' || l.type === 'error'); report('无报错', errs.length === 0, errs.slice(0, 3));
await browser.close();
console.log(fail ? `${fail} 项失败` : '全部通过');
process.exit(fail ? 1 : 0);
