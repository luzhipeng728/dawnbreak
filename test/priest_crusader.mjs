// 圣职者转职测试：圣骑士（crusader，P-crusader）。node test/priest_crusader.mjs（约 20 秒）
// 查：转职登记（板甲 / 独立攻击 / 三次觉醒 / ready:false）、技能 id 都是 pc_ 前缀且有定义、每个主动技能对着木桩放得出来（战斗路线 + 守护路线各跑一遍）、
//     冷却 = 表里的值（?rawcd）、MP = 表里的值、伤害类技能打得中、指令文字、不报错。完整机制 + 截图 + 联机：node test/crusader.mjs
import { launch, URL_BASE } from './lib.mjs';
const JOB = 'crusader';
let fail = 0;
const report = (name, ok, info) => { if (!ok) fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${JSON.stringify(info)}`); };
const { browser, page, logs } = await launch({ width: 960, height: 540 });
await page.goto(`${URL_BASE}?test&cls=priest&priest=1&mobs=0&mute&rawcd`); await page.waitForFunction(() => window.__READY, null, { timeout: 30000 });
const R = await page.evaluate(JOB => {
  game.paused = true; window.toastMsg = () => {};
  const p = game.player, J = CLASSES.priest.jobs[JOB], run = n => { for (let i = 0; i < n; i++) step(1 / 60); };
  game.job = JOB; Object.assign((save.data.flags ??= {}), { awaken: true, awaken2: true, awaken3: true });
  if (typeof onJobChange === 'function') onJobChange(p, JOB);
  for (const id of classSkills('priest', JOB)) game.skillLv[id] = Math.max(1, Math.min(SKILLS[id] ? SKILLS[id].maxLv || 5 : 1, 5));
  p._psvT = 0; tickPassives(p, 0.3);
  const stray = J.skills.filter(id => !id.startsWith('pc_')), undef = J.skills.filter(id => !SKILLS[id]), cmdless = J.skills.filter(id => SKILLS[id] && !SKILLS[id].passive && !cmdTextOf(id));
  const routeDefault = pcGuard(p);
  const bad = {}, ok = {};
  const tryAll = guard => {
    const O = (save.data.opts.swOff ??= {}); if (guard) delete O.pc_guard; else O.pc_guard = true;
    for (const id of J.skills.filter(id => SKILLS[id] && (SKILLS[id].act || SKILLS[id].instant) && !SKILLS[id].passive)) {
      const S = SKILLS[id];
      for (const e of ents) if (e.team === 'e') e.remove = true; run(1); if (typeof clearAllSummons === 'function') clearAllSummons('round'); projs.length = 0; game.timers.length = 0;
      const m = spawnMonster('goblin', p.x + 90, p.y); m.control = null; m.hp = m.hpMax = 1e9; m.invul = 0; m.evade = 0;
      Object.assign(p, { z: 0, vz: 0, vx: 0, cool: {}, mp: 1e6, mpMax: 1e6, mpRegen: 1e-9, buffs: {}, invul: 0 }); p.act = null; p.setState('idle'); game.timeStop = 0; game.cutin = null;
      if (id === 'pc_astrape') p.buffs.pc_jupiter = { t: 1e6, dmg: 0.1 };
      const lvJ = game.skillLv.pc_jupiter; if (id === 'pc_revenge') game.skillLv.pc_jupiter = 0;
      const req = S.req ? S.req(p) : true;
      if (req !== true) { game.skillLv.pc_jupiter = lvJ; (req === '需要队友（组队才能用）' || /守护路线|需要开启守护恩赐/.test(req) ? ok : bad)[id + (guard ? '@守护' : '@战斗')] = req; continue; }
      const mp0 = p.mp, hp0 = m.hp, cast = castSkill(p, id), mp = Math.round(mp0 - p.mp); run(1);
      const cd = +(p.cool[id] || 0).toFixed(2), want = S.cd * (guard && soloPlay() && !S.awaken ? 0.8 : 1) * (id === 'pc_awaken' && !guard ? 135 / 160 : 1);
      let t = 0; while (t++ < 420 && (p.st === 'act' || game.timers.length || game.timeStop > 0)) run(1); run(30);
      game.skillLv.pc_jupiter = lvJ;
      const noHit = S.buff || S.noHitCheck, hit = m.hp < hp0, r = { cast, cd, want: +want.toFixed(2), mp, mpWant: S.mp, hit };
      if (!cast || Math.abs(cd - want) > 0.06 || mp !== S.mp || (!noHit && !hit)) bad[id + (guard ? '@守护' : '@战斗')] = r; else ok[id] = r;
    }
  };
  tryAll(false); tryAll(true);
  return { reg: !!J, ready: J.ready, armor: J.armor, dmg: J.dmgType, aw: [J.awaken, J.awaken2, J.awaken3], names: [J.awakenName, J.awakenName2, J.awakenName3], art: J.art, n: J.skills.length, stray, undef, cmdless, routeDefault, bad, okN: Object.keys(ok).length };
}, JOB);
report('转职登记（板甲、伤害 mag / 技能独立攻击、ready:false、转职立绘）', R.reg && R.armor === 'plate' && R.dmg === 'mag' && R.ready === false && R.art === 'job/crusader', { armor: R.armor, dmg: R.dmg, ready: R.ready });
report('觉醒：天启者 天启之珠 / 神思者 神圣洗礼：信仰之翼 / 神启·圣骑士 生命礼赞：神威', R.aw.join() === 'pc_awaken,pc_awaken2,pc_awaken3' && R.names.join() === '天启者,神思者,神启·圣骑士', { aw: R.aw, names: R.names });
report(`技能 id 都是 pc_ 前缀、都有定义（${R.n} 个），主动技能都有指令`, !R.stray.length && !R.undef.length && !R.cmdless.length && R.n >= 30, { stray: R.stray, undef: R.undef, cmdless: R.cmdless });
report('转职后默认战斗路线（守护恩赐关闭）', R.routeDefault === false, { guard: R.routeDefault });
report(`主动技能（战斗 + 守护两条路线）放得出、打得中、冷却 / MP = 表里的值（${R.okN} 项通过）`, !Object.keys(R.bad).length, R.bad);
const errs = logs.filter(l => l.type === 'pageerror' || l.type === 'error'); report('无报错', errs.length === 0, errs.slice(0, 3));
await browser.close();
console.log(fail ? `${fail} 项失败` : '全部通过');
process.exit(fail ? 1 : 0);
