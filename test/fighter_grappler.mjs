// 格斗家转职测试：柔道家（grappler，B7）。node test/fighter_grappler.mjs（约 20 秒）
// 查：转职登记（精通 / 伤害类型 / 自动学会 / 一二三觉）、28 个技能 id 都在 FIGHTER_IDS.grappler 里且都有定义、主动技能逐个对着木桩能放出来（空中技能先起跳）、
//     技能窗口文字（说明 / 指令）、觉醒阶段、动作片段并进动画表、不报错。机制（抓轰炮 / 暴力抓取 / 滑行 · 连环抓取 / 预约 / 领主不卡死）在 test/grappler.mjs。
// 开放时（J.ready 去掉）再加进 all.sh 的 classes / skillaudit 行（`fighter:grappler`）
import { launch, URL_BASE } from './lib.mjs';
const JOB = 'grappler';
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
    if (SKILLS[id].airOnly) { p.z = 70; p.vz = 200; p.setState('jump'); }   // 空中技能（空绞锤 / 裂石破天）：先跳起来
    const ok = castSkill(p, id); run(1);
    if (!ok || !(p.act || typeof SKILLS[id].instant === 'function')) bad.push(id);
    run(240);
  }
  return { reg: !!J, ready: J.ready, armor: J.armor, dmg: J.dmgType || 'phys', n: J.skills.length, stray, undef, bad };
}, JOB);
report('转职登记（精通 light、伤害 phys）', R.reg && R.armor === 'light' && R.dmg === 'phys', { ready: R.ready, armor: R.armor, dmg: R.dmg });
report(`技能 id 都在预留表 FIGHTER_IDS.${JOB} 里、都有定义（${R.n} 个）`, !R.stray.length && !R.undef.length, { stray: R.stray, undef: R.undef });
report('主动技能逐个对着木桩能放出来', !R.bad.length, R.bad);
// ---------------- 转职专属（B7）：登记细节；机制测试在 test/grappler.mjs ----------------
const X = await page.evaluate(JOB => {
  const J = CLASSES.fighter.jobs[JOB], L = J.skills.map(id => SKILLS[id]);
  const cmd = id => cmdTextOf(id);
  return { auto: (J.auto || []).map(id => game.skillLv[id] || 0), awk: [J.awaken, J.awaken2, J.awaken3], tiers: [1, 2, 3].map(n => L.filter(S => S.tier === n || (n === 1 && S.awaken && !S.tier)).length),
    noDesc: L.filter(S => !S.desc || S.desc.length < 20).map(S => S.id), noCmd: L.filter(S => !S.passive && !S.buff && !cmd(S.id)).map(S => S.id),
    cmds: { air: cmd('fg_airsteiner'), spike: cmd('fg_cannonspike'), awk2: cmd('fg_awaken2') }, grab: L.filter(S => S.grab).length,
    icons: L.filter(S => IMG['icon/' + S.id]).length, anims: Object.keys(J.anims).filter(k => !SPR_ANIMS.fighter[k] || !CLIPS.fighter[k]) };
}, JOB);
report('转职自动学会 抓轰炮 / 臂铠精通；一 / 二 / 三觉登记', X.auto.every(v => v >= 1) && X.awk.join() === 'fg_awaken,fg_awaken2,fg_awaken3', { auto: X.auto, awk: X.awk });
report('技能窗口：每个技能都有说明、主动技能都有指令（空中 C / 空中 ←→+C）', !X.noDesc.length && !X.noCmd.length && X.cmds.air === '空中 C' && X.cmds.spike === '空中 ←→+C', { noDesc: X.noDesc, noCmd: X.noCmd, cmds: X.cmds });
report('觉醒阶段：一觉 4（含死亡旋律）/ 二觉 4 / 三觉 3；抓取技能 11 个', X.tiers.join() === '4,4,3' && X.grab === 11, { tiers: X.tiers, grab: X.grab, icons: X.icons });
report('动作片段都并进了 SPR_ANIMS.fighter 和 CLIPS.fighter', !X.anims.length, X.anims);

const errs = logs.filter(l => l.type === 'pageerror' || l.type === 'error'); report('无报错', errs.length === 0, errs.slice(0, 3));
await browser.close();
console.log(fail ? `${fail} 项失败` : '全部通过');
process.exit(fail ? 1 : 0);
