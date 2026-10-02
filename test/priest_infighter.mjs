// 圣职者转职测试：蓝拳圣使（转职 id monk，技能前缀 pi_ = Infighter，P-infighter）。node test/priest_infighter.mjs（约 15 秒）
// 查：转职登记（轻甲 / 物理 / 三次觉醒 / ready:true）、技能 id 都是 pi_ 前缀且有定义、每个主动技能对着木桩放得出来、冷却 = 表里的值（?rawcd，
//     插着巨兵时转职技能冷却 −10%，觉醒除外）、MP = 表里的值、伤害类技能打得中、指令文字、进测试房间自动插好巨兵、不报错。完整机制 + 截图：node test/infighter.mjs
import { launch, URL_BASE } from './lib.mjs';
const JOB = 'monk';
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
  p._psvT = 0; tickPassives(p, 0.3); run(2);
  const willAuto = piWillOn(p);
  const stray = J.skills.filter(id => !id.startsWith('pi_')), undef = J.skills.filter(id => !SKILLS[id]), cmdless = J.skills.filter(id => SKILLS[id] && !SKILLS[id].passive && !cmdTextOf(id));
  const bad = {}, ok = {}, noHit = new Set(['pi_counter']);
  for (const id of J.skills.filter(id => SKILLS[id] && (SKILLS[id].act || SKILLS[id].instant) && !SKILLS[id].passive)) {
    const S = SKILLS[id];
    for (const e of ents) if (e.team === 'e') e.remove = true; run(1); if (typeof clearAllSummons === 'function') clearAllSummons('round'); projs.length = 0; game.timers.length = 0;
    Object.assign(p, { x: 400, y: 100, z: 0, vz: 0, vx: 0, cool: {}, mp: 1e6, mpMax: 1e6, mpRegen: 1e-9, buffs: {}, invul: 0, alpha: 1, hidden: false }); p.act = null; p.setState('idle'); game.timeStop = 0; game.cutin = null;
    piPlant(p, p.x - 40, p.y, true);
    const m = spawnMonster('goblin', p.x + 90, p.y); m.control = null; m.hp = m.hpMax = 1e9; m.invul = 0; m.evade = 0;
    const req = S.req ? S.req(p) : true;
    if (req !== true) { bad[id] = req; continue; }
    const mp0 = p.mp, hp0 = m.hp, cast = castSkill(p, id), mp = Math.round(mp0 - p.mp); run(1);
    const cd = +(p.cool[id] || 0).toFixed(2), want = S.cd * (S.awaken ? 1 : 0.9);
    let t = 0; while (t++ < 480 && (p.st === 'act' || game.timers.length || game.timeStop > 0)) run(1); run(30);
    const hit = m.hp < hp0, r = { cast, cd, want: +want.toFixed(2), mp, mpWant: S.mp, hit };
    if (!cast || Math.abs(cd - want) > 0.06 || mp !== S.mp || (!(S.buff || S.noHitCheck || noHit.has(id)) && !hit)) bad[id] = r; else ok[id] = r;
  }
  return { reg: !!J, ready: J.ready, armor: J.armor, dmg: J.dmgType, aw: [J.awaken, J.awaken2, J.awaken3], names: [J.awakenName, J.awakenName2, J.awakenName3], art: J.art, n: J.skills.length, stray, undef, cmdless, willAuto, bad, okN: Object.keys(ok).length,
    cmd: { duck: cmdTextOf('pi_duck'), sway: cmdTextOf('pi_sway'), ds: cmdTextOf('pi_dstraight'), chop: cmdTextOf('pi_chop'), demo: cmdTextOf('pi_demo'), awk3: cmdTextOf('pi_awaken3') } };
}, JOB);
report('转职登记（轻甲、物理、ready:true、转职立绘 job/monk）', R.reg && R.armor === 'light' && R.dmg === 'phys' && R.ready === true && R.art === 'job/monk', { armor: R.armor, dmg: R.dmg, ready: R.ready });
report('觉醒：神之手 泯灭神击 / 正义仲裁者 制裁：怒火疾风 / 神启·蓝拳圣使 正义执行', R.aw.join() === 'pi_awaken,pi_awaken2,pi_awaken3' && R.names.join() === '神之手,正义仲裁者,神启·蓝拳圣使', { aw: R.aw, names: R.names });
report(`技能 id 都是 pi_ 前缀、都有定义（${R.n} 个），主动技能都有指令`, !R.stray.length && !R.undef.length && !R.cmdless.length && R.n >= 30, { stray: R.stray, undef: R.undef, cmdless: R.cmdless, cmd: R.cmd });
report('进测试房间自动插好巨兵（意念驱动）', R.willAuto, { will: R.willAuto });
const PVP = await page.evaluate(() => {
  const p = game.player;
  p.piWill = null; p.piWillOff = null; p._piDuelRound = undefined;
  game.pvp = true; game.duel = { round: 1, state: 'fight' };
  p._psvT = 0; tickPassives(p, 0.3);
  const planted = piWillOn(p);
  piRetrieve(p); p._psvT = 0; tickPassives(p, 0.3);
  const stayOff = !piWillOn(p);
  game.duel.round = 2; p._psvT = 0; tickPassives(p, 0.3);
  const round2 = piWillOn(p);
  const need = SKILLS.pi_gorgeous.req(p);
  game.pvp = false; game.duel = null;
  return { planted, stayOff, round2, need };
});
report('决斗开局自动插巨兵；本局收回后不再插；下一局重新插，转职技能放得出', PVP.planted && PVP.stayOff && PVP.round2 && PVP.need === true, PVP);
report(`主动技能放得出、打得中、冷却（插着巨兵 −10%）/ MP = 表里的值（${R.okN} 项通过）`, !Object.keys(R.bad).length, R.bad);
const lay = async (w, h) => {
  await page.setViewportSize({ width: w, height: h });
  await page.waitForFunction(vw => { const s = document.querySelector('#stage'); return s && s.clientWidth >= vw * 0.9; }, w);
  return page.evaluate(() => {
    const box = el => el ? { x: el.scrollWidth - el.clientWidth, y: el.scrollHeight - el.clientHeight, w: el.clientWidth, h: el.clientHeight } : null;
    const open = id => { menus.close('skills'); menus.skTab = 'job'; menus.skSel = id; menus.open('skills'); };
    const read = () => {
      const win = document.querySelector('.win');
      const list = win.querySelector('.sklist2'), bd = win.querySelector('.bd'), desc = win.querySelector('.skdesc'), det = win.querySelector('.skdetail'), sw = win.querySelector('.sksw'), nm = win.querySelector('.sknm');
      const sr = sw && sw.getBoundingClientRect(), dr = det.getBoundingClientRect();
      const names = [...list.querySelectorAll('.ski2 b')].map(b => ({ t: b.textContent, cut: b.scrollWidth > b.clientWidth + 1 }));
      return { list: box(list), bd: box(bd), desc: box(desc), det: box(det), name: nm && nm.textContent, nameCut: nm && nm.scrollWidth > nm.clientWidth + 1, stray: /\bnull\b/.test(det.innerText), tail: desc && desc.textContent.slice(-18), stage: document.querySelector('#stage').clientWidth, shortCut: names.filter(n => n.t.length <= 4 && n.cut).map(n => n.t), sw: sw && { t: sw.textContent, w: Math.round(sr.width), h: Math.round(sr.height), in: sr.top >= dr.top - 1 && sr.bottom <= dr.bottom + 1 && sr.left >= dr.left - 1 && sr.right <= dr.right + 1 } };
    };
    open('pi_will'); const will = read(); open('pi_awaken3'); const awk = read(); menus.close('skills');
    return { will, awk };
  });
};
const L960 = await lay(960, 540), L1600 = await lay(1600, 900);
const fit = (o, sw) => o.list && o.list.x <= 1 && o.bd && o.bd.x <= 1 && o.desc && o.desc.x <= 1 && !o.nameCut && !o.stray && (!sw || (o.sw && o.sw.w > 160 && o.sw.h * 2.2 < o.sw.w && o.sw.in && o.sw.t.includes('点击改为')));
report('技能窗不左右滚动，说明和联动按钮的字完整（960 与 1600）', fit(L960.will, false) && fit(L960.awk, true) && fit(L1600.will, false) && fit(L1600.awk, true) && !L1600.will.shortCut.length && L1600.will.tail.includes('不再自动插') && L1600.awk.name.includes('雷米迪奥斯的圣座'), { L960, L1600 });
await page.setViewportSize({ width: 1680, height: 945 });
await page.waitForFunction(() => document.querySelector('#stage').clientWidth >= 1500);
await page.evaluate(() => { menus.close('skills'); menus.skTab = 'job'; menus.skSel = 'pi_awaken3'; menus.open('skills'); });
await page.locator('.win').screenshot({ path: '/tmp/sk-awk-win.png' });
await page.evaluate(() => { menus.close('skills'); menus.skSel = 'pi_will'; menus.open('skills'); });
await page.locator('.win').screenshot({ path: '/tmp/sk-will-win.png' });
const errs = logs.filter(l => l.type === 'pageerror' || (l.type === 'error' && !/Failed to load resource/.test(l.text))); report('无报错', errs.length === 0, errs.slice(0, 3));
await browser.close();
console.log(fail ? `${fail} 项失败` : '全部通过');
process.exit(fail ? 1 : 0);
