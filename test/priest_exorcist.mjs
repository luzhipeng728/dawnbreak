// 圣职者转职测试：驱魔师（exorcist，P-exorcist）。node test/priest_exorcist.mjs（约 20 秒）
// 查：转职登记（板甲 / 物理 / 三次觉醒技 id / 转职立绘 / 插图）、技能 id 都是 pe_ 前缀且都有定义、官方指令文字、
//     主动技能逐个对着木桩：放得出 / 打得中 / 冷却 = 官方值（?rawcd）/ MP = 表里的值、不报错。
// 完整机制 + 游戏内截图：node test/exorcist.mjs
import { launch, URL_BASE } from './lib.mjs';
const JOB = 'exorcist';
let fail = 0;
const report = (name, ok, info) => { if (!ok) fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${JSON.stringify(info)}`); };
const { browser, page, logs } = await launch({ width: 960, height: 540 });
await page.goto(`${URL_BASE}?test&cls=priest&priest=1&mobs=0&mute&rawcd`); await page.waitForFunction(() => window.__READY, null, { timeout: 30000 });
const R = await page.evaluate(JOB => {
  game.paused = true; window.toastMsg = () => {};
  const p = game.player, J = CLASSES.priest.jobs[JOB], run = n => { for (let i = 0; i < n; i++) step(1 / 60); };
  game.job = JOB; Object.assign((save.data.flags ??= {}), { awaken: true, awaken2: true, awaken3: true });
  onJobChange(p, JOB);
  for (const id of classSkills('priest', JOB)) game.skillLv[id] = Math.max(1, Math.min(SKILLS[id] ? SKILLS[id].maxLv || 5 : 1, 5));
  const bad = J.skills.filter(id => !id.startsWith('pe_') || !SKILLS[id] || SKILLS[id].job !== JOB);
  const cmd = Object.fromEntries(['pe_lotus', 'pe_gale', 'pe_star', 'pe_suzaku', 'pe_genbu', 'pe_byakko', 'pe_chaos', 'pe_spin', 'pe_atomic', 'pe_awaken', 'pe_seiryu', 'pe_quake', 'pe_seven', 'pe_pentacle', 'pe_awaken2', 'pe_blitz', 'pe_awaken3'].map(id => [id, cmdTextOf(id)]));
  const out = {}, noHit = new Set(['pe_lotus']); game.skillLv.pe_book = 0;   // 驱魔之书（冷却 −10%）另测
  for (const id of J.skills.filter(id => SKILLS[id] && !SKILLS[id].passive)) {
    clearAllSummons('audit'); for (const e of ents) if (e !== p) e.remove = true; run(1);
    Object.assign(p, { x: 300, y: 100, z: 0, vz: 0, vx: 0, vy: 0, face: 1, cool: {}, mp: 99999, mpMax: 99999, buffs: {}, invul: 0, superArmor: 0, act: null }); p.setState('idle'); game.timeStop = 0; game.cutin = null;
    const m = spawnMonster('goblin', 380, 100); m.control = null; m.hp = m.hpMax = 1e9; m.invul = 0; m.evade = 0;
    const S = SKILLS[id], mp0 = p.mp, ok = castSkill(p, id), cd = +(p.cool[id] || 0).toFixed(2), mp = mp0 - p.mp; run(1);
    const cast = ok && !!p.act && p.act.skill === id;
    for (let i = 0; i < 360 && (p.st === 'act' || summonsOf(p).length || game.timeStop > 0); i++) run(1); run(30);
    out[id] = { cast, hit: m.hp < m.hpMax, cd, mp, want: [S.cd, S.mp], noHit: noHit.has(id) };
  }
  return { reg: [J.armor, J.dmgType, J.awaken, J.awaken2, J.awaken3, J.awakenName, J.awakenName2, J.awakenName3, J.art, J.ready], n: J.skills.length, bad, cmd, out,
    art: { job: !!IMG['job/exorcist'] || ASSET_SRC['job/exorcist'] !== undefined, cutin: ['exorcist', 'exorcist2', 'exorcist3'].every(k => !!IMG['cutin/' + k]), icons: J.skills.filter(id => !IMG['icon/' + id]) } };
}, JOB);
report('转职登记：板甲 / 物理、觉醒技 pe_awaken{,2,3}、觉醒名（四座千泰门的一觉 = 龙斗士，三觉 = 光启·驱魔师）、ready:false', R.reg.join() === 'plate,phys,pe_awaken,pe_awaken2,pe_awaken3,龙斗士,真龙星君,光启·驱魔师,job/exorcist,false', R.reg);
report(`技能 id 都是 pe_ 前缀、都有定义、都属于驱魔师（${R.n} 个）`, !R.bad.length && R.n >= 26, R.bad);
const WANT = { pe_lotus: '↓→+Space', pe_gale: '→↑+Z', pe_star: '↑↑+Z', pe_suzaku: '↑→→+Z', pe_genbu: '↑→+Z', pe_byakko: '↓←+Z', pe_chaos: '↓↓+Z', pe_spin: '←↓→+Z', pe_atomic: '→←→+Z',
  pe_awaken: '↑↑↓↓+Z', pe_seiryu: '←↓→+Space', pe_quake: '→←↑→+Z', pe_seven: '↓↑→+Z', pe_pentacle: '←→→+Z', pe_awaken2: '↓↑→→+Z', pe_blitz: '↑↓→→+Z', pe_awaken3: '←→→↑+Z' };
const badCmd = Object.entries(WANT).filter(([k, v]) => R.cmd[k] !== v);
report('官方指令文字', !badCmd.length, badCmd.map(([k, v]) => `${k}:${R.cmd[k]}≠${v}`));
const badCast = Object.entries(R.out).filter(([, r]) => !r.cast || (!r.noHit && !r.hit) || Math.abs(r.cd - r.want[0]) > 0.01 || r.mp !== r.want[1]);
report(`主动技能逐个：放得出、打得中木桩（封魔莲华除外）、冷却 = 官方值、MP = 表里的值（${Object.keys(R.out).length} 个）`, !badCast.length, badCast.length ? Object.fromEntries(badCast) : Object.fromEntries(Object.entries(R.out).map(([k, r]) => [k, [r.cd, r.mp, r.hit]])));
report('美术：转职立绘、3 张觉醒插图、每个技能都有图标', R.art.job && R.art.cutin && !R.art.icons.length, R.art);
const errs = logs.filter(l => l.type === 'pageerror' || l.type === 'error'); report('无报错', errs.length === 0, errs.slice(0, 3));
await browser.close();
console.log(fail ? `${fail} 项失败` : '全部通过');
process.exit(fail ? 1 : 0);
