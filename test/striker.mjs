// 散打（男格斗家转职 striker，B5）机制测试 + 画面截图。node test/striker.mjs [mech,shots]（默认全部，约 40 秒）
//   mech   柔化肌肉（次数 / 恢复 / 白名单 / 常驻增伤 / 霸体护甲续时）、霸体护甲、强拳、拳套掌握冷却、烈焰焚步（冷却 −15%、后摇、双脚火焰、地面火）、
//          双重施放（只在焚步中、追加段伤害、没打中时消耗与否 / 千锤百炼）、强袭拳 / 闪步改基础技能（基础技能没定义时用替身）、
//          炼狱坠星腿 / 焚火逐日拳锁定最强敌人、几个大范围技能的判定距离
//   shots  游戏内截图 → test/shots/striker/*.png + 总览 test/shots/striker.jpg（焚步双脚火焰 / 地面火、闪电之舞、极武霸皇踢、焚火逐日拳、柔化次数 HUD）
import { launch, URL_BASE } from './lib.mjs';
import fs from 'fs';
import { execFileSync } from 'child_process';
const MODES = (process.argv[2] || 'mech,shots').split(',');
let fail = 0;
const report = (name, ok, info) => { if (!ok) fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${JSON.stringify(info)}`); };
const noErr = (logs, tag) => { const e = logs.filter(l => l.type === 'pageerror' || l.type === 'error'); report(`无报错（${tag}）`, e.length === 0, e.slice(0, 3)); };
const ready = page => page.waitForFunction(() => window.__READY, null, { timeout: 30000 });
// 页面里的公共准备：转职散打、全部觉醒、技能等级、木桩、逐帧推进
function pageSetup() {
  game.paused = true; window.toastMsg = () => {};
  const p = game.player, R = game.room, run = n => { for (let i = 0; i < n; i++) step(1 / 60); };
  game.job = 'striker'; Object.assign((save.data.flags ??= {}), { awaken: true, awaken2: true, awaken3: true });
  if (typeof onJobChange === 'function') onJobChange(p, 'striker');
  for (const id of classSkills('fighter', 'striker')) game.skillLv[id] = Math.max(1, Math.min(SKILLS[id] ? SKILLS[id].maxLv || 5 : 1, 5));
  // 基础技能（B3）还没合进来时，给强袭拳 / 闪步 / 前置用的基础技能一个替身，只测散打这边的改形逻辑
  const stub = (id, o) => { if (SKILLS[id]) return; defSkill(id, { name: id, cls: 'fighter', lvReq: 1, mp: 0, cd: o.cd || 3, type: 'phys', air: o.air, airOnly: o.air, act: () => ({ name: id, dur: 0.3, airOnly: o.air, hits: [] }) }); };
  stub('f_airwalk', { air: true, cd: 7 }); stub('f_flash', { cd: 5 });
  game.skillLv.f_airwalk = game.skillLv.f_flash = 1; fsPatchBase();
  const cx = R ? (R.x0 + R.x1) / 2 : 700;
  window.T = {
    p, run, cx,
    reset(keepBuffs) { for (const e of ents) if (e.team === 'e') e.remove = true; run(1); Object.assign(p, { x: cx - 200, y: 100, z: 0, vz: 0, vx: 0, vy: 0, face: 1, cool: {}, mp: 1e6, mpMax: 1e6, superArmor: 0, invul: 0, hp: 1e6, hpMax: 1e6 });
      if (!keepBuffs) p.buffs = {}; p.act = null; p.setState('idle'); p._fsm = null; p.baseCrit = -1; if (p.pad && p.pad.virt) p.pad.virt = {}; run(2); },
    mob(dx, o = {}, dy = 0) { const m = spawnMonster('goblin', p.x + dx, p.y + dy); m.control = null; m.hp = m.hpMax = 1e9; m.invul = 0; Object.assign(m, o); return m; },
    dmg: m => m.hpMax - m.hp,
    until(f, n = 600) { for (let i = 0; i < n && !f(); i++) step(1 / 60); return f(); },
    at: () => ({ x: (p.x - cam.x) * 1280 / 960, y: (FLOOR_Y + p.y - p.z) * 720 / 540 }),   // 人物在 1280×720 截图里的位置
  };
}

// ---------------- mech ----------------
if (MODES.includes('mech')) {
  const { browser, page, logs } = await launch({ width: 960, height: 540 });
  await page.goto(`${URL_BASE}?test&cls=fighter&fighter=1&mobs=0&mute`); await ready(page);
  await page.evaluate(pageSetup);
  // 1) 柔化肌肉
  const S = await page.evaluate(() => {
    const { p, run, reset, mob } = T, o = {};
    delete game.skillLv.fs_fire; reset(); mob(80); castSkill(p, 'fs_elbow'); run(12);   // 打中有 hitstop：多推几帧
    o.max = fsShiftMax(p); o.n0 = fsShiftOf(p).n;
    o.toPower = canCancelInto(p, 'fs_power'); p._soft = null;                      // 强拳不是武术技能
    o.toPusher = canCancelInto(p, 'fs_pusher'); castSkill(p, 'fs_pusher'); o.act = p.act && p.act.skill; o.n1 = fsShiftOf(p).n; o.soft = !!(p.act && p.act.fsSoft);
    run(4); p._fsm.n = 0; o.zero = canCancelInto(p, 'fs_bone'); p._soft = null;       // 次数用完
    o.awk = canCancelInto(p, 'fs_awaken3'); p._soft = null;                          // 觉醒随时能切（引擎规则）
    p._fsm.n = 0; p._fsm.last = game.t; const per = fsShiftPer(p); run(Math.ceil(per * 60) + 2); o.per = +per.toFixed(2); o.rec = fsShiftOf(p).n;
    game.skillLv.fs_fire = 1; o.maxFire = fsShiftMax(p);
    reset(); p._psvT = 0; tickPassives(p, 0.3); o.dmg = p.buffs.fs_shift && p.buffs.fs_shift.dmg; o.lab = p.buffs.fs_shift && p.buffs.fs_shift.lab;
    // 普攻不能被柔化“中断”（普攻本来就能被技能强制中断，柔化不扣次数）
    reset(); p.doAct(p.acts.atk1); run(3); const n = fsShiftOf(p).n; castSkill(p, 'fs_elbow'); o.basicNoCost = fsShiftOf(p).n === n;
    // 霸体护甲：施放后 BUFF + 霸体；柔化放出的技能打中时 +2 秒
    reset(); castSkill(p, 'fs_sa'); run(50); p._psvT = 0; tickPassives(p, 0.3); o.saT = +(p.buffs.fs_sa ? p.buffs.fs_sa.t : 0).toFixed(1); o.saArmor = p.superArmor > 0;
    p.buffs.fs_sa.t = 10; const m = mob(70); castSkill(p, 'fs_elbow'); run(12); const t1 = p.buffs.fs_sa.t; canCancelInto(p, 'fs_pusher'); castSkill(p, 'fs_pusher'); run(20); o.saExt = +(p.buffs.fs_sa.t - t1).toFixed(2); o.saHit = m.hpMax - m.hp > 0;
    // 强拳：永久暴击伤害 + 硬直
    reset(); castSkill(p, 'fs_power'); run(40); o.power = p.buffs.fs_power ? { crit: p.buffs.fs_power.critDmg, stagger: p.buffs.fs_power.stagger, perm: p.buffs.fs_power.t > 1e5 } : null;
    return o;
  });
  report('柔化肌肉：武术技能之间能中断并扣 1 次（5+Lv 次），BUFF 技能不能，次数用完不能，觉醒随时能切', S.toPusher && S.act === 'fs_pusher' && S.soft && S.n1 === S.n0 - 1 && S.max === 10 && !S.toPower && !S.zero && S.awk, S);
  report('柔化肌肉：定时恢复 1 次、烈火支配 +4 次、常驻增伤（HUD 显示次数）、普攻不扣次数', S.rec === 1 && S.maxFire === 14 && S.dmg > 0.09 && /^×\d+$/.test(S.lab || '') && S.basicNoCost, { per: S.per, rec: S.rec, maxFire: S.maxFire, dmg: S.dmg, lab: S.lab, basic: S.basicNoCost });
  report('霸体护甲：60 秒霸体，柔化施放的技能打中 +2 秒', S.saT > 55 && S.saArmor && S.saHit && Math.abs(S.saExt - 2) < 0.4, { t: S.saT, armor: S.saArmor, ext: S.saExt });
  report('强拳：永久暴击伤害提高、硬直 130%', !!S.power && S.power.crit > 0.1 && S.power.stagger === 75 && S.power.perm, S.power);

  // 2) 冷却：拳套掌握 / 拳套武器 / 焚步；焚步后摇、双脚火焰、地面火
  const B = await page.evaluate(() => {
    const { p, run, reset, mob } = T, o = {}, base = id => SKILLS[id].cd * (p.cdMul || 1);
    game.skillLv.fs_glove = 10;
    reset(); castSkill(p, 'fs_elbow'); o.glove = +(p.cool.fs_elbow / base('fs_elbow')).toFixed(3);
    reset(); castSkill(p, 'fs_awaken2'); o.gloveAwk = +(p.cool.fs_awaken2 / base('fs_awaken2')).toFixed(3); run(200);
    inv.equip.weapon = makeItem('boxing_1_0'); recalcStats(p); run(20);
    reset(); castSkill(p, 'fs_elbow'); o.boxing = +(p.cool.fs_elbow / base('fs_elbow')).toFixed(3);
    inv.equip.weapon = null; recalcStats(p); run(20);
    reset(); castSkill(p, 'fs_awaken'); T.until(() => p.buffs.fs_awaken, 200); run(80); const A = p.buffs.fs_awaken;
    o.awk = A ? { t: Math.round(A.t), dmg: +A.dmg.toFixed(3), rec: +A.rec.toFixed(3), stagger: A.stagger } : null;
    p._psvT = 0; tickPassives(p, 0.3); o.feet = !!(p._fsFeet && fxList.includes(p._fsFeet));
    const keep = p.buffs; T.reset(true); p.buffs = keep; castSkill(p, 'fs_elbow'); o.awkCd = +(p.cool.fs_elbow / base('fs_elbow')).toFixed(3); o.recMul = p.act && p.act.recMul;
    o.per = +fsShiftPer(p).toFixed(2);
    // 焚步中跑动：身后的地面着火，烫伤踩到的敌人
    T.reset(true); p.buffs = keep; const m = mob(-12); const fx0 = fxList.length; p.setState('run'); p.vx = 300; for (let i = 0; i < 3; i++) { p._psvT = 0; tickPassives(p, 0.3); } o.trail = T.dmg(m) > 0; o.trailFx = fxList.length - fx0;
    p.setState('idle'); p.vx = 0;
    // MP：烈焰燃烧（焚步中消耗减少）
    game.skillLv.fs_burn = 5; T.reset(true); p.buffs = keep; const mp0 = p.mp; castSkill(p, 'fs_close'); o.mpCut = +(1 - (mp0 - p.mp) / SKILLS.fs_close.mp).toFixed(2);
    game.skillLv.fs_glove = 5;
    return o;
  });
  report('冷却：拳套掌握 Lv10 散打技能 −10%（觉醒不算），装拳套再 ×0.9', Math.abs(B.glove - 0.9) < 0.01 && Math.abs(B.gloveAwk - 1) < 0.01 && Math.abs(B.boxing - 0.81) < 0.01, { glove: B.glove, awk: B.gloveAwk, boxing: B.boxing });
  report('烈焰焚步：变身 BUFF（技能攻击 / 硬直 / 后摇）、双脚火焰、武术技能冷却再 ×0.85、柔化恢复快 1 秒', !!B.awk && B.awk.t > 40 && B.awk.dmg > 0 && B.awk.rec > 0 && B.feet && Math.abs(B.awkCd - 0.9 * 0.85) < 0.01 && B.recMul < 1, { awk: B.awk, feet: B.feet, cd: B.awkCd, recMul: B.recMul, per: B.per });
  report('烈焰焚步：跑过的地面着火烫伤敌人；烈焰燃烧减少焚步中的 MP 消耗', B.trail && B.trailFx > 0 && B.mpCut > 0.2, { trail: B.trail, fx: B.trailFx, mpCut: B.mpCut });

  // 3) 双重施放
  const D = await page.evaluate(() => {
    const { p, run, reset, mob } = T, o = {}; delete game.skillLv.fs_limit;
    const dragon = (dual, withMob = true) => { reset(); if (dual) { castSkill(p, 'fs_awaken'); T.until(() => p.buffs.fs_awaken, 200); run(60); const b = p.buffs; reset(true); p.buffs = b; castSkill(p, 'fs_dual'); run(30); }
      const m = withMob ? mob(160) : null; castSkill(p, 'fs_dragon'); T.until(() => !p.act, 200); run(30); return { d: m ? T.dmg(m) : 0, left: !!p.buffs.fs_dual }; };
    reset(); castSkill(p, 'fs_dual'); o.noAwk = !!p.buffs.fs_dual;
    const a = dragon(false), b = dragon(true); o.ratio = +(b.d / a.d).toFixed(2); o.consumed = !b.left;
    o.missBase = dragon(true, false).left;                                  // 没学千锤百炼：放出来就消耗（没打中也消耗）
    game.skillLv.fs_limit = 1; o.missLimit = dragon(true, false).left;       // 千锤百炼：没打中不消耗
    // 千锤百炼：别的技能施放中也能用（无动作，不打断当前动作）
    reset(); castSkill(p, 'fs_awaken'); T.until(() => p.buffs.fs_awaken, 200); run(60); const bb = p.buffs; reset(true); p.buffs = bb; castSkill(p, 'fs_close'); run(4);
    o.midOk = canCancelInto(p, 'fs_dual') && castSkill(p, 'fs_dual') && p.act && p.act.skill === 'fs_close' && !!p.buffs.fs_dual;
    delete game.skillLv.fs_limit;
    reset(); castSkill(p, 'fs_awaken'); T.until(() => p.buffs.fs_awaken, 200); run(60); const b2 = p.buffs; reset(true); p.buffs = b2; castSkill(p, 'fs_close'); run(4); o.midNo = castSkill(p, 'fs_dual') && !p.buffs.fs_dual;
    return o;
  });
  report('双重施放：焚步外放不出；瞬影连环踢追加一段同等威力（总伤害 ≥1.8 倍）并消耗', !D.noAwk && D.ratio >= 1.8 && D.consumed, D);
  report('双重施放：没学千锤百炼时放出就消耗 / 不能在技能中用；学了以后打中才消耗、能在别的技能中用', !D.missBase && D.missLimit && D.midOk && D.midNo, { missBase: D.missBase, missLimit: D.missLimit, midOk: D.midOk, midNo: D.midNo });

  // 4) 强袭拳 / 闪步（基础技能改形）
  const M = await page.evaluate(() => {
    const { p, run, reset, mob } = T, o = {};
    reset(); p.z = 90; p.vz = 0; p.setState('jump'); const m = mob(90); castSkill(p, 'f_airwalk'); o.raid = p.act && p.act.name; T.until(() => !p.act, 200); o.raidHit = T.dmg(m) > 0; run(20);
    delete game.skillLv.fs_raid; reset(); p.z = 90; p.setState('jump'); castSkill(p, 'f_airwalk'); o.noRaid = p.act && p.act.name; game.skillLv.fs_raid = 1; run(60);
    reset(); castSkill(p, 'f_flash'); o.step = p.act && p.act.name; o.stepCd = p.cool.fs_stepp > 0; run(40);
    reset(); mob(80); castSkill(p, 'fs_elbow'); run(12); const x0 = p.x; p.pad.virt = { left: true }; const ok = canCancelInto(p, 'f_flash'); castSkill(p, 'f_flash'); o.softStep = ok && p.act && p.act.name === 'fs_stepp' && !(p.cool.fs_stepp > 0);
    run(3); p.pad.virt = {}; run(17); o.back = { face: p.face, dx: Math.round(p.x - x0) };
    return o;
  });
  report('强袭拳：学了以后空中 Z（鹰踏）变成俯冲拳 + 落地爆炸；没学是原来的鹰踏', M.raid === 'fs_raidp' && M.raidHit && M.noRaid !== 'fs_raidp', M);
  report('闪步：瞬步改成闪步；柔化施放不进冷却，按 ← 面朝前向后退', M.step === 'fs_stepp' && M.stepCd && M.softStep && M.back.face === 1 && M.back.dx < -120, { step: M.step, cd: M.stepCd, soft: M.softStep, back: M.back });

  // 5) 锁定最强敌人 / 判定距离
  const L = await page.evaluate(() => {
    const { p, run, reset, mob } = T, o = {};
    reset(); mob(80); mob(150, {}, 30); const boss = mob(330, { boss: true }, -40); castSkill(p, 'fs_mortal'); T.until(() => p.act && p.act.drop, 120); o.mortal = Math.round(Math.abs(p.x - boss.x)); T.until(() => !p.act, 200); o.mortalHit = T.dmg(boss) > 0; run(30);
    reset(); mob(90); const el = mob(460, { elite: true }, 40); castSkill(p, 'fs_awaken3'); run(2); o.awk3 = Math.round(Math.abs(p.x - el.x)); T.until(() => !p.act, 400); o.awk3Hit = T.dmg(el) > 0; run(30);
    // 冲膝：踢中身前的敌人后，冲击波打到它身后 300px 的敌人（被直接踢中的不吃冲击波）
    reset(); const a = mob(70), b = mob(370); castSkill(p, 'fs_close'); T.until(() => !p.act, 200); run(30); o.close = { front: T.dmg(a) > 0, far: T.dmg(b) > 0, knock: Math.round(b.x - p.x) };
    // 旋风碎心踢：身后也打得到；飞燕旋风：300px 内的敌人被扫过来
    reset(); const c = mob(-100), d = mob(120); castSkill(p, 'fs_spin'); T.until(() => !p.act, 200); o.spin = { back: T.dmg(c) > 0, front: T.dmg(d) > 0 };
    reset(); const f = mob(290); const x0 = f.x; castSkill(p, 'fs_whirl'); run(30); o.whirl = { hit: T.dmg(f) > 0, pulled: Math.round(x0 - f.x) }; T.until(() => !p.act, 200);
    // 闪电之舞：3 个敌人都被踢、被赶到第一次踢中的位置附近，终结后解除强制硬直
    reset(); const g = [mob(80), mob(300, {}, 60), mob(-200, {}, -40)]; castSkill(p, 'fs_dance'); T.until(() => p.act && p.act.fin, 300); const gx = p.act && p.act.gx;
    o.dance = { all: g.every(m => T.dmg(m) > 0), spread: Math.round(Math.max(...g.map(m => Math.abs(m.x - gx)))) }; T.until(() => !p.act, 200); o.danceHold = g.some(m => m.status && m.status.hold);
    // 极武霸皇踢：聚到一点 + 贯穿飞踢（身前 450px 内都吃到终结）
    reset(); const h = [mob(120), mob(420, {}, 50)]; castSkill(p, 'fs_awaken2'); T.until(() => !p.act, 400); o.awk2 = h.map(m => T.dmg(m) > 0);
    return o;
  });
  report('炼狱坠星腿 / 焚火逐日拳：锁定周围最强的敌人（领主 / 精英）', L.mortal < 60 && L.mortalHit && L.awk3 < 110 && L.awk3Hit, { mortal: L.mortal, awk3: L.awk3 });
  report('范围：冲膝冲击波打到身后 300px、旋风碎心踢打到身后、飞燕旋风把 300px 的敌人扫过来', L.close.front && L.close.far && L.close.knock > 300 && L.spin.back && L.spin.front && L.whirl.hit && L.whirl.pulled > 30, { close: L.close, spin: L.spin, whirl: L.whirl });
  report('闪电之舞：周围敌人都被踢并赶到一处，终结后解除强制硬直；极武霸皇踢打到前方 420px', L.dance.all && L.dance.spread < 120 && !L.danceHold && L.awk2.every(Boolean), { dance: L.dance, hold: L.danceHold, awk2: L.awk2 });
  noErr(logs, 'mech');
  await browser.close();
}

// ---------------- shots：游戏内截图 ----------------
if (MODES.includes('shots')) {
  const dir = 'test/shots/striker'; fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  const { browser, page, logs } = await launch({ width: 1280, height: 720 });
  await page.goto(`${URL_BASE}?test&cls=fighter&fighter=1&mobs=0&mute`); await ready(page);
  await page.evaluate(pageSetup);
  await page.evaluate(() => { for (const id of ['#ui', '#dom']) { const el = document.querySelector(id); if (el) el.style.visibility = 'hidden'; } });
  const shot = async (name, f) => {
    const pos = await page.evaluate(f);
    await page.waitForTimeout(120);
    await page.screenshot({ path: `${dir}/${name}.png`, clip: { x: Math.max(0, Math.min(1280 - 560, pos.x - 260)), y: Math.max(0, Math.min(720 - 360, pos.y - 250)), width: 560, height: 360 } });
  };
  await shot('1-burning-feet', () => { const { p, run, reset, mob } = T; reset(); mob(160); castSkill(p, 'fs_awaken'); T.until(() => p.buffs.fs_awaken, 200); run(70); p.setState('run'); p.vx = 280; for (let i = 0; i < 8; i++) { run(8); p._psvT = 0; tickPassives(p, 0.14); } p.setState('idle'); p.vx = 0; run(3); return T.at(); });
  await shot('2-flamekick', () => { const { p, run, reset, mob } = T; reset(); mob(80); mob(160, {}, 30); castSkill(p, 'fs_flamekick'); run(18); return T.at(); });
  await shot('3-dance', () => { const { p, run, reset, mob } = T; reset(); mob(80); mob(260, {}, 60); mob(-180, {}, -40); mob(360, {}, -30); castSkill(p, 'fs_dance'); run(40); return T.at(); });
  await shot('4-dragon-dual', () => { const { p, run, reset, mob } = T; reset(); castSkill(p, 'fs_awaken'); T.until(() => p.buffs.fs_awaken, 200); run(60); const b = p.buffs; reset(true); p.buffs = b; castSkill(p, 'fs_dual'); run(30); mob(200); castSkill(p, 'fs_dragon'); T.until(() => p.act && p.act.fsDualDone, 90); run(9); return T.at(); });
  await shot('5-awaken2-kick', () => { const { p, run, reset, mob } = T; reset(); mob(160); mob(360, {}, 50); mob(80, {}, -40); castSkill(p, 'fs_awaken2'); T.until(() => p.act && p.act.boom, 300); run(16); return T.at(); });
  await shot('6-awaken3-final', () => { const { p, run, reset, mob } = T; reset(); mob(160, { elite: true }); mob(260, {}, 50); castSkill(p, 'fs_awaken3'); T.until(() => p.act && p.act.fin, 300); run(16); return T.at(); });
  await shot('7-descent', () => { const { p, run, reset, mob } = T; reset(); mob(120); mob(200, {}, 40); castSkill(p, 'fs_descent'); T.until(() => p.act && p.act.slam, 200); run(6); return T.at(); });
  await page.evaluate(() => { for (const id of ['#ui', '#dom']) { const el = document.querySelector(id); if (el) el.style.visibility = ''; } });
  // 最后一张拍 HUD 左下角的 BUFF 图标（柔化次数 ×n、霸体护甲）
  await shot('8-hud-shift', () => { const { p, run, reset, mob } = T; reset(); castSkill(p, 'fs_sa'); run(50); p._fsm = null; mob(80); castSkill(p, 'fs_elbow'); run(6); canCancelInto(p, 'fs_bone'); castSkill(p, 'fs_bone'); run(6); canCancelInto(p, 'fs_close'); castSkill(p, 'fs_close'); run(8); p._psvT = 0; tickPassives(p, 0.3); run(2); return { x: 260, y: 610 }; });
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.png')).sort();
  try {
    execFileSync('python3', ['-c', `
import sys
from PIL import Image, ImageDraw, ImageFont
fs = sys.argv[2:]; W, H = 560, 360; cols = 4; rows = (len(fs) + cols - 1) // cols
out = Image.new('RGB', (W * cols, (H + 26) * rows), (24, 22, 30)); d = ImageDraw.Draw(out)
try: font = ImageFont.truetype('/System/Library/Fonts/STHeiti Medium.ttc', 18)
except Exception: font = None
for i, f in enumerate(fs):
    im = Image.open(f).convert('RGB'); x, y = (i % cols) * W, (i // cols) * (H + 26)
    out.paste(im, (x, y + 26)); d.text((x + 8, y + 3), f.split('/')[-1][:-4], fill=(255, 220, 150), font=font)
out.save(sys.argv[1], quality=82)`, 'test/shots/striker.jpg', ...files.map(f => `${dir}/${f}`)]);
    report('截图总览 test/shots/striker.jpg', fs.existsSync('test/shots/striker.jpg'), { n: files.length });
  } catch (e) { report('截图总览', false, String(e).slice(0, 200)); }
  noErr(logs, 'shots');
  await browser.close();
}
console.log(fail ? `${fail} 项失败` : '全部通过');
process.exit(fail ? 1 : 0);
