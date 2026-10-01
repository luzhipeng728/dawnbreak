// 圣职者转职测试：复仇者（avenger，P-avenger）。node test/priest_avenger.mjs（约 25 秒）
// 查：转职登记（重甲 / 魔法 / 三次觉醒技 id / 转职立绘 / 插图）、技能 id 都是 pa_ 前缀且都有定义、官方指令文字、
//     主动技能逐个对着木桩（人形放一遍；魔化专属的恶魔之爪 / 审判 / 恶魔屏障在魔化中放）：放得出 / 打得中 / 冷却 = 官方值（?rawcd）/ MP = 表里的值、不报错。
// 完整机制（恶魔能量 / 半魔化 / 魔化变身 / 恶魔版技能 / 恶之再临 / 化魔改写）+ 游戏内截图：node test/avenger.mjs
import { launch, URL_BASE } from './lib.mjs';
const JOB = 'avenger';
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
  const bad = J.skills.filter(id => !id.startsWith('pa_') || !SKILLS[id] || SKILLS[id].job !== JOB);
  const ids = ['pa_meta', 'pa_render', 'pa_mine', 'pa_cutter', 'pa_thorn', 'pa_wheel', 'pa_fist', 'pa_reaper', 'pa_authority', 'pa_fall', 'pa_awaken', 'pa_execute', 'pa_barrier', 'pa_gate', 'pa_disaster', 'pa_howl', 'pa_smite', 'pa_awaken2', 'pa_stream', 'pa_awaken3'];
  const cmd = Object.fromEntries(ids.map(id => [id, cmdTextOf(id)]));
  const DEMON = new Set(['pa_claw', 'pa_execute', 'pa_barrier']), noHit = new Set(['pa_meta', 'pa_fall', 'pa_barrier', 'pa_rapture']), out = {};
  for (const id of J.skills.filter(id => SKILLS[id] && !SKILLS[id].passive)) {
    clearAllSummons('audit'); for (const e of ents) if (e !== p) e.remove = true; run(1);
    Object.assign(p, { x: 300, y: 100, z: 0, vz: 0, vx: 0, vy: 0, face: 1, cool: {}, mp: 99999, mpMax: 99999, buffs: {}, invul: 0, superArmor: 0, act: null, scale: 1, _paD: 0, _paE: 400 }); p.setState('idle'); game.timeStop = 0; game.cutin = null;
    if (DEMON.has(id)) { p.buffs.pa_demon = { t: 50, name: '魔化' }; }
    const m = spawnMonster('goblin', 380, 100); m.control = null; m.hp = m.hpMax = 1e9; m.invul = 0; m.evade = 0;
    const S = SKILLS[id], mp0 = p.mp, key = id === 'pa_claw' ? 'p_launcher' : id === 'pa_rapture' ? 'p_rapture' : id, ok = castSkill(p, key), cd = +(p.cool[id] || 0).toFixed(2), mp = mp0 - p.mp; run(1);
    const cast = ok && (S.instant ? true : !!p.act && p.act.skill === id);
    for (let i = 0; i < 360 && (p.st === 'act' || summonsOf(p).length || game.timeStop > 0); i++) run(1); run(30);
    out[id] = { cast, hit: m.hp < m.hpMax, cd, mp, want: [S.cd, S.mp], noHit: noHit.has(id) };
  }
  return { reg: [J.armor, J.dmgType, J.awaken, J.awaken2, J.awaken3, J.awakenName, J.awakenName2, J.awakenName3, J.art, J.ready], n: J.skills.length, bad, cmd, out,
    art: { job: ASSET_SRC['job/avenger'] !== undefined, cutin: ['avenger', 'avenger2', 'avenger3'].every(k => !!IMG['cutin/' + k]), fx: ['pa_wings', 'pa_horns', 'pa_demon', 'pa_lightscythe', 'pa_lightwing'].filter(k => !IMG['fx/' + k]),
      icons: J.skills.filter(id => !IMG['icon/' + (SKILLS[id].icon || id)]) } };
}, JOB);
report('转职登记：重甲 / 魔法、觉醒技 pa_awaken{,2,3}、觉醒名、ready:true', R.reg.join() === 'heavy,mag,pa_awaken,pa_awaken2,pa_awaken3,末日审判者,永生者,神启·复仇者,job/avenger,true', R.reg);
report(`技能 id 都是 pa_ 前缀、都有定义、都属于复仇者（${R.n} 个）`, !R.bad.length && R.n >= 28, R.bad);
const WANT = { pa_meta: '↓→+Space', pa_render: '↓→↑←+Space', pa_mine: '→↑+Z', pa_cutter: '↑←↓→+Space', pa_thorn: '↑↑+Z', pa_wheel: '↑→+Z', pa_fist: '↓↓+Z', pa_reaper: '↓←+Z', pa_authority: '→←→+Z',
  pa_fall: '→↓+Space', pa_awaken: '↑↑↓↓+Z', pa_execute: '←→+Z', pa_barrier: '↓↓+X', pa_gate: '→←↓→+Z', pa_disaster: '→←↑→+Z', pa_howl: '↓↑→+Z', pa_smite: '↓→→+Z', pa_awaken2: '↓↑→→+Z', pa_stream: '↑→→+Z', pa_awaken3: '←↑→↓+Z' };
const badCmd = Object.entries(WANT).filter(([k, v]) => R.cmd[k] !== v);
report('官方指令文字', !badCmd.length, badCmd.map(([k, v]) => `${k}:${R.cmd[k]}≠${v}`));
const badCast = Object.entries(R.out).filter(([, r]) => !r.cast || (!r.noHit && !r.hit) || Math.abs(r.cd - r.want[0]) > 0.01 || r.mp !== r.want[1]);
report(`主动技能逐个：放得出、打得中木桩（半魔化 / 堕落之魂 / 屏障 / 化魔除外）、冷却 = 官方值、MP = 表里的值（${Object.keys(R.out).length} 个）`, !badCast.length, badCast.length ? Object.fromEntries(badCast) : Object.fromEntries(Object.entries(R.out).map(([k, r]) => [k, [r.cd, r.mp, r.hit]])));
report('美术：转职立绘、3 张觉醒插图、魔化部件（翼 / 角 / 虚影 / 光镰 / 光翼）、每个技能都有图标', R.art.job && R.art.cutin && !R.art.fx.length && !R.art.icons.length, R.art);
const errs = logs.filter(l => l.type === 'pageerror' || l.type === 'error'); report('无报错', errs.length === 0, errs.slice(0, 3));
await browser.close();
console.log(fail ? `${fail} 项失败` : '全部通过');
process.exit(fail ? 1 : 0);
