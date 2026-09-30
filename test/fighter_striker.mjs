// 格斗家转职测试：散打（striker，B5）。node test/fighter_striker.mjs（约 10 秒；quick.sh g2）
// 查：转职登记（精通 / 伤害类型）、技能 id 都在 FIGHTER_IDS.striker 里且都有定义、主动技能逐个对着木桩能放出来、柔化肌肉 / 焚步双重施放 / 拳套的快速检查、不报错。
// 完整机制 + 游戏内截图：node test/striker.mjs（all.sh）；开放时（J.ready 去掉）再加进 all.sh 的 classes / skillaudit 行（`fighter:striker`）
import { launch, URL_BASE } from './lib.mjs';
const JOB = 'striker';
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
report('转职登记（精通 light、伤害 phys）', R.reg && R.armor === 'light' && R.dmg === 'phys', { ready: R.ready, armor: R.armor, dmg: R.dmg });
report(`技能 id 都在预留表 FIGHTER_IDS.${JOB} 里、都有定义（${R.n} 个）`, !R.stray.length && !R.undef.length, { stray: R.stray, undef: R.undef });
report('主动技能逐个对着木桩能放出来', !R.bad.length, R.bad);
// ---------------- 转职专属（B5；完整的机制测试和截图在 test/striker.mjs）----------------
const X = await page.evaluate(() => {
  const p = game.player, run = n => { for (let i = 0; i < n; i++) step(1 / 60); }, o = {};
  const reset = () => { for (const e of ents) if (e.team === 'e') e.remove = true; run(1); Object.assign(p, { z: 0, vz: 0, vx: 0, cool: {}, mp: 1e6, mpMax: 1e6, buffs: {} }); p.act = null; p.setState('idle'); p._fsm = null; };
  // 柔化肌肉：肘击中接铁山靠，扣 1 次
  reset(); castSkill(p, 'fs_elbow'); run(8); const n0 = fsShiftOf(p).n; o.shift = canCancelInto(p, 'fs_pusher') && castSkill(p, 'fs_pusher') && p.act.skill === 'fs_pusher' && fsShiftOf(p).n === n0 - 1;
  // 双重施放只能在烈焰焚步中放；焚步是变身 BUFF
  reset(); castSkill(p, 'fs_dual'); o.dualNo = !p.buffs.fs_dual;
  castSkill(p, 'fs_awaken'); for (let i = 0; i < 200 && !p.buffs.fs_awaken; i++) run(1); run(60); o.awk = !!p.buffs.fs_awaken;
  const b = p.buffs; p.act = null; p.setState('idle'); p.cool = {}; castSkill(p, 'fs_dual'); o.dualYes = !!b.fs_dual;
  // 拳套：散打能装，自动学会拳套掌握 / 散打轻甲专精
  o.box = inv.canWear(makeItem('boxing_1_0'), true); o.auto = game.skillLv.fs_glove > 0 && game.skillLv.fs_light > 0;
  return o;
});
report('柔化肌肉：武术技能之间强制中断扣 1 次', X.shift, X);
report('烈焰焚步（变身 BUFF）中才能双重施放；拳套能装、拳套掌握自动学会', X.dualNo && X.awk && X.dualYes && X.box && X.auto, X);

const errs = logs.filter(l => l.type === 'pageerror' || l.type === 'error'); report('无报错', errs.length === 0, errs.slice(0, 3));
await browser.close();
console.log(fail ? `${fail} 项失败` : '全部通过');
process.exit(fail ? 1 : 0);
