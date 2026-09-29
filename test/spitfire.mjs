// 弹药专家（女）测试（docs/SKILLS_OFFICIAL_gun.md 第 7 节）：暂停游戏循环、逐帧推进，逐条验证
// 转职登记 / 任务线、单兵推进器（空中 C 上升、←→+C 冲刺、↓+C 空中后跳、Space 急降、7 次上限、落地回满、姿态恢复、地面普攻 C 取消）、
// 超负荷装填选属性、三种子弹互斥与普攻子弹改造、空中施放耗推进器、手雷装填 / 空中间隔、M18 / C4 再按引爆、感电 / 冰冻、凝固汽油弹地带、镭射狙击、
// 一觉 EMP、过电流、G-61 / 切利、二觉 / 三觉技能能放出来并造成伤害、空袭战略悬停与引爆。node test/spitfire.mjs
import { launch, URL_BASE } from './lib.mjs';
let fail = 0;
const report = (name, ok, info) => { if (!ok) fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${JSON.stringify(info)}`); };
const { browser, page, logs } = await launch({ width: 960, height: 540 });
await page.goto(`${URL_BASE}?rawcd&test&cls=gun&mobs=0&mute`); await page.waitForFunction(() => window.__READY, null, { timeout: 30000 });
await page.evaluate(() => {
  game.paused = true;
  window.T = {
    run(n) { for (let i = 0; i < n; i++) step(1 / 60); },
    tap(a) { input.virt[a] = 2; T.run(1); delete input.virt[a]; },
    hold(a) { input.virt[a] = 1; }, release(a) { delete input.virt[a]; },
    clear() { for (const e of ents) if (e !== game.player) e.remove = true; T.run(1); projs.length = 0; clearAllSummons('round'); },
    reset(p = game.player) { for (const k in input.virt) delete input.virt[k]; input.buf.length = 0; input.dirHist.length = 0; if (p.act) p.endAct();
      Object.assign(p, { x: 300, y: 100, z: 0, vx: 0, vy: 0, vz: 0, face: 1, act: null, invul: 0, superArmor: 0, hitstop: 0, dead: false, cool: {}, charges: {}, bsCd: 0, reboundCd: 0, techHold: false, stun: 0, nitro: undefined, nitroCd: 0 });
      for (const k in p.buffs) if (k !== 'gs_overcharge' && !k.startsWith('gs_elem') && k !== 'gs_pierce' && k !== 'gs_burst') delete p.buffs[k];
      p.hp = p.hpMax; p.mp = p.mpMax = 99999; p.setState('idle'); resetCmb(p); T.run(2); },
    mob(x = 400, y = 100) { const m = spawnMonster('goblin', x, y); m.control = null; m.invul = 0; m.z = 0; m.vz = 0; m.hp = m.hpMax = 1e9; m.setState('idle'); return m; },
    air(p = game.player) { p.vz = p.jumpV; p.z = 0.5; p.airAtk = 0; p.setState('jump'); T.run(12); },
    cast(id) { const p = game.player; p.cool = {}; return castSkill(p, id); },
    land(p = game.player) { for (let i = 0; i < 400 && (p.z > 0.01 || p.act); i++) T.run(1); },
  };
  game.job = 'spitfire'; if (save.data) { save.data.job = 'spitfire'; qdata().flags.awaken = qdata().flags.awaken2 = qdata().flags.awaken3 = true; }
  game.lvl = 30;
  const L = game.skillLv; for (const id of classSkills('gun', 'spitfire')) if (SKILLS[id]) L[id] = Math.min(SKILLS[id].maxLv, SKILLS[id].awaken ? 3 : 5);
  L.c_bsup = 0; L.gs_02x = 0;   // 02X（三觉被动）在最后一节再开：推进器次数按 7 次测
  game.skillBar = ['gs_overcharge', 'gs_elem', 'gs_m18', 'gs_cross', 'gs_g35', 'gs_g18', 'gs_buster', 'gs_c4', 'gs_napalm', 'gs_lockon', 'g_grenade', 'gs_emp', null, null];
  onJobChange(game.player, 'spitfire');
});
const R = await page.evaluate(() => {
  const out = {}, p = game.player; T.clear();
  // ---- 1) 转职登记 ----
  const J = CLASSES.gun.jobs.spitfire;
  out.reg = { n: J.skills.length, allDef: J.skills.every(id => SKILLS[id] && SKILLS[id].job === 'spitfire'), awaken: [J.awaken, J.awaken2, J.awaken3], armor: J.armor,
    quests: (J.quests || []).map(q => q[0]), trial: J.trial, questDefined: typeof QUESTS === 'undefined' ? null : !!QUESTS.q_job_spitfire_1,
    cmds: { m18: cmdTextOf('gs_m18'), g35: cmdTextOf('gs_g35'), emp: cmdTextOf('gs_emp'), final: cmdTextOf('gs_final') }, inClass: classSkills('gun', 'spitfire').includes('gs_emp') };
  // ---- 2) 单兵推进器 ----
  const hang = () => { if (p.act) p.endAct(); p.z = 90; p.vz = 0; p.setState('jump'); p.nitroCd = 0; T.run(1); };   // 每个动作前都把人放回空中
  T.reset(); T.tap('jump'); T.run(10); const n0 = nitroLeft(p);
  hang(); T.tap('jump'); const rise = { act: p.act && p.act.name, vz: Math.round(p.vz), n: p.nitro };
  hang(); T.hold('right'); T.tap('jump'); T.release('right'); const dash = { act: p.act && p.act.name, vx: Math.round(p.vx), n: p.nitro };
  hang(); T.hold('down'); T.tap('jump'); T.release('down'); const back = { act: p.act && p.act.name, n: p.nitro };
  hang(); T.tap('cmdB'); const dive = { act: p.act && p.act.name, vz: Math.round(p.vz), n: p.nitro };
  T.land(); T.run(2); out.nitro = { n0, rise, dash, back, dive, landed: nitroLeft(p) };
  // 7 次用完之后不能再用；冷却 0.5 秒内也不能连按
  T.reset(); T.air(); let uses = 0, quick = null;
  for (let i = 0; i < 9; i++) { const n = p.nitro; p.vz = Math.max(p.vz, 0); p.z = Math.max(p.z, 60); T.tap('jump'); if (i === 0) { T.run(3); const m = p.nitro; T.tap('jump'); quick = m - p.nitro; } if (p.nitro < n) uses++; T.run(32); }
  out.nitroCap = { uses, left: p.nitro, quick }; T.land();
  // 地面普攻中按 C = 跳跃（只有弹药专家）
  T.reset(); T.tap('attack'); T.run(3); T.tap('jump'); out.jumpCancel = { st: p.st, vz: Math.round(p.vz) }; T.land();
  game.job = 'ranger'; T.reset(); T.tap('attack'); T.run(3); T.tap('jump'); out.jumpCancelRanger = p.st; T.land(); game.job = 'spitfire';
  // 姿态恢复
  T.reset(); p.z = 80; p.vz = 100; p.setState('air'); T.tap('jump'); out.recover = { st: p.st, n: p.nitro, invul: p.invul > 0 }; T.land();
  // ---- 3) 超负荷装填 / 子弹 ----
  T.reset(); delete p.buffs.gs_overcharge; for (const k of ['gs_elem', 'gs_pierce', 'gs_burst']) delete p.buffs[k];
  T.cast('gs_elem'); T.run(30); out.needOver = !!p.buffs.gs_elem;
  T.cast('gs_overcharge'); T.run(5); T.tap('left'); T.run(40); const e1 = p.buffs.gs_overcharge && p.buffs.gs_overcharge.elem;
  T.cast('gs_overcharge'); T.run(45); const e2 = p.buffs.gs_overcharge.elem;
  T.cast('gs_overcharge'); T.run(5); T.tap('right'); T.run(40); const e3 = p.buffs.gs_overcharge.elem;
  out.over = { e1, e2, e3, dmg: p.buffs.gs_overcharge.dmg };
  T.cast('gs_elem'); T.run(30); T.cast('gs_pierce'); T.run(30); out.excl = ['gs_elem', 'gs_pierce', 'gs_burst'].filter(k => p.buffs[k]);
  // 贯穿弹 + 火：普攻子弹贯穿、火属性、更快；兵器研究：按独立攻击力
  T.reset(); projs.length = 0; T.tap('attack'); T.run(20); const b = projs.find(q => q.owner === p);
  out.pierceShot = b ? { pierce: b.pierce, elem: b.hit.elem, type: b.hit.type, vx: Math.round(Math.abs(b.vx)) } : null; T.run(60); projs.length = 0;
  T.cast('gs_burst'); T.run(30); T.reset(); T.tap('attack'); T.run(20); const b2 = projs.find(q => q.owner === p); out.burstShot = b2 ? { pierce: b2.pierce, onHit: !!b2.hit.onHit } : null; T.run(60); projs.length = 0;
  // 特性弹：冰 → 冰冻、光 → 感电（直接调子弹的命中回调 40 次，25% 几率）
  p.buffs.gs_overcharge.elem = 'ice'; T.cast('gs_elem'); T.run(30);
  const m0 = T.mob(420); const o1 = CLASSES.gun.shotMod(p, { basic: true, dmg: 0.5, hit: {} }); for (let i = 0; i < 40; i++) o1.hit.onHit(p, m0, 10);
  p.buffs.gs_overcharge.elem = 'light'; const m1 = T.mob(460); const o2 = CLASSES.gun.shotMod(p, { basic: true, dmg: 0.5, hit: {} }); for (let i = 0; i < 40; i++) o2.hit.onHit(p, m1, 10);
  out.elemStatus = { freeze: hasStatus(m0, 'freeze'), shock: hasStatus(m1, 'shock'), col: o2.col }; T.clear();
  // ---- 4) 空中施放：耗推进器、悬停；空中投手雷间隔 0.5 秒；G-14 在空中也能投 ----
  p.buffs.gs_overcharge.elem = 'fire'; T.reset(); T.air(); const na = p.nitro; const okAir = T.cast('gs_cross'); out.airCast = { ok: okAir, used: na - p.nitro, air: !!(p.act && p.act.air), lowGrav: p.act && p.act.lowGrav }; T.land();
  T.reset(); T.cast('gs_g35'); out.g35Ground = Math.round(p.cool.gs_g35 * 10) / 10; T.run(40); T.reset(); T.air(); const ng = p.nitro; p.charges = {}; const okG = castSkill(p, 'gs_g35'); out.g35Air = { ok: okG, cd: p.cool.gs_g35, used: ng - p.nitro }; T.land();
  T.reset(); T.air(); const n14 = p.nitro; const ok14 = T.cast('g_grenade'); out.g14Air = { ok: ok14, used: n14 - p.nitro, cd: p.cool.g_grenade }; T.land(); projs.length = 0;
  // ---- 5) M18：敌人进入感应区爆炸（眩晕），再按引爆 ----
  T.reset(); T.clear(); const mm = T.mob(700); T.cast('gs_m18'); T.run(40); const placed = summonsOf(p, 'gs_m18').length; const mine = summonsOf(p, 'gs_m18')[0];
  mm.x = mine.x + 70; mm.y = mine.y; T.run(40); out.m18 = { placed, after: summonsOf(p, 'gs_m18').length, stun: hasStatus(mm, 'stun'), dmg: mm.hp < mm.hpMax };
  T.clear(); T.reset(); T.cast('gs_m18'); T.run(40); const rc = castSkill(p, 'gs_m18'); T.run(40); out.m18Recast = { rc, left: summonsOf(p, 'gs_m18').length };
  // ---- 6) C4：贴上、再按引爆 ----
  T.clear(); T.reset(); const c1 = T.mob(390), c2 = T.mob(470, 110); T.cast('gs_c4'); T.run(70); const stuck = summonsOf(p, 'gs_c4').length;
  const hp1 = c1.hp; p.cool = {}; const rc4 = castSkill(p, 'gs_c4'); T.run(20); out.c4 = { stuck, rc4, left: summonsOf(p, 'gs_c4').length, boom: c1.hp < hp1, slow: hasStatus(c2, 'slow') };
  // ---- 7) 手雷：感电 + 暴击 BUFF；冰冻 ----
  T.clear(); T.reset(); const g1 = T.mob(520); p.charges = {}; T.cast('gs_g35'); T.run(60); out.g35 = { shock: hasStatus(g1, 'shock'), crit: p.buffs.gs_g35 && p.buffs.gs_g35.crit };
  T.clear(); T.reset(); const g2 = T.mob(520); p.charges = {}; T.cast('gs_g18'); T.run(60); out.g18 = { freeze: hasStatus(g2, 'freeze') };
  // ---- 8) 凝固汽油弹 / 聚合弹 / 交叉射击 / 镭射狙击 ----
  const dmgOf = (id, x = 400, frames = 120, y = 100) => { T.clear(); T.reset(); const m = T.mob(x, y); const ok = T.cast(id); T.run(frames); return { ok, dmg: Math.round(m.hpMax - m.hp), m }; };
  const nap = dmgOf('gs_napalm', 390, 30); out.napalm = { ok: nap.ok, field: summonsOf(p, 'gs_napalm').length }; T.run(150); out.napalm.dmg = Math.round(nap.m.hpMax - nap.m.hp);
  out.buster = dmgOf('gs_buster', 420, 80); out.cross = dmgOf('gs_cross', 380, 50); const lk = dmgOf('gs_lockon', 420, 170); out.lockon = { ok: lk.ok, dmg: lk.dmg, hits: lk.m.cmb.hits };
  for (const k of ['buster', 'cross']) delete out[k].m;
  // ---- 9) 一觉：EMP、过电流；G-61 吸怪、切利 ----
  const emp = dmgOf('gs_emp', 460, 330); out.emp = { ok: emp.ok, dmg: emp.dmg, invul: null };
  T.clear(); T.reset(); T.mob(460); T.cast('gs_emp'); T.run(90); out.emp.invul = p.invul > 1; T.run(300);
  T.clear(); T.reset(); const oc = T.mob(380); T.cast('gs_cross'); T.run(40); out.overcurrent = oc.buffs && oc.buffs.gs_oc ? oc.buffs.gs_oc.taken : 0;
  T.clear(); T.reset(); const gA = T.mob(500, 60), gB = T.mob(620, 140); T.cast('gs_g61'); T.run(70); const d0 = Math.hypot(gA.x - gB.x, gA.y - gB.y); T.run(120);
  out.g61 = { closer: Math.hypot(gA.x - gB.x, gA.y - gB.y) < d0 || gA.dead, dmg: gA.hp < gA.hpMax };
  T.clear(); T.reset(); const ch = T.mob(420); T.cast('gs_chelli'); T.run(30); const vac = summonsOf(p, { tag: 'vac' }).length; p.cool = {}; const rch = castSkill(p, 'gs_chelli'); T.run(20);
  out.chelli = { vac, rch, left: summonsOf(p, { tag: 'vac' }).length, dmg: ch.hp < ch.hpMax };
  // ---- 10) 二觉 / 三觉 ----
  game.skillLv.gs_02x = 5;
  out.openfire = dmgOf('gs_openfire', 440, 140); out.photon = dmgOf('gs_photon', 480, 160); out.dday = dmgOf('gs_dday', 460, 360); out.final = dmgOf('gs_final', 480, 320);
  for (const k of ['openfire', 'photon', 'dday', 'final', 'emp']) if (out[k]) delete out[k].m;
  T.clear(); T.reset(); T.mob(500); T.cast('gs_standby'); T.run(40); const sb = { z: Math.round(p.z), on: standbyOn(p) }; const nS = p.nitro; p.cool = {}; castSkill(p, 'gs_cross'); T.run(40);
  sb.noNitro = p.nitro === nS; sb.airMax = airMaxOf(p); p.cool = {}; const sm = summonsOf(p).length; castSkill(p, 'gs_standby'); T.run(5); sb.ended = !standbyOn(p); T.run(120); out.standby = sb; T.land();
  // ---- 11) 被动：空中射击常驻、兵器研究（步枪） ----
  T.reset(); inv.equip.weapon = { wtype: 'rifle', slot: 'weapon' }; T.run(30); out.passive = { aerial: !!p.buffs.g_aerial, aerialLv: p.buffs.g_aerial && p.buffs.g_aerial.lv, firearm: p.buffs.gs_firearm && p.buffs.gs_firearm.aspd }; inv.equip.weapon = null;
  return out;
});
report('转职登记：27 个技能、一觉 / 二觉 / 三觉、皮甲、4 步任务线', R.reg.n === 27 && R.reg.allDef && R.reg.awaken.join() === 'gs_emp,gs_dday,gs_final' && R.reg.armor === 'leather' && R.reg.quests.length === 4 && R.reg.trial === 'q_job_spitfire_4' && R.reg.inClass, R.reg);
report('指令：M18 ↓↓+Z、G-35L ←→→+Z、EMP ↑↑↓↓+Z、终解 ←↑→↓+Z', R.reg.cmds.m18 === '↓↓+Z' && R.reg.cmds.g35 === '←→→+Z' && R.reg.cmds.emp === '↑↑↓↓+Z' && R.reg.cmds.final === '←↑→↓+Z', R.reg.cmds);
const N = R.nitro;
report('推进器：空中 C 上升 / ←→+C 冲刺 / ↓+C 后跳 / Space 急降，各耗 1 次，落地回满', N.n0 === 7 && N.rise.act === 'sfRise' && N.rise.vz > 300 && N.rise.n === 6 && N.dash.act === 'sfDash' && N.dash.vx > 300 && N.dash.n === 5 && N.back.act === 'back' && N.back.n === 4 && N.dive.act === 'sfDive' && N.dive.vz < -500 && N.dive.n === 3 && N.landed === 7, N);
report('推进器：每跳 7 次、0.5 秒内不能连按', R.nitroCap.uses === 7 && R.nitroCap.quick === 0, R.nitroCap);
report('地面普攻中按 C 取消成跳跃（只有弹药专家）', R.jumpCancel.st === 'jump' && R.jumpCancel.vz > 0 && R.jumpCancelRanger !== 'jump', { sf: R.jumpCancel, ranger: R.jumpCancelRanger });
report('姿态恢复：被打浮空时按 C（耗 1 次）', R.recover.st === 'jump' && R.recover.n === 6 && R.recover.invul, R.recover);
report('超负荷装填：← 冰、不按轮换（冰 → 光）、→ 火；没开超负荷不能放特性弹', R.over.e1 === 'ice' && R.over.e2 === 'light' && R.over.e3 === 'fire' && R.over.dmg > 0 && R.needOver === false, { ...R.over, needOver: R.needOver });
report('三种子弹互斥', R.excl.join() === 'gs_pierce', R.excl);
report('贯穿弹：普攻贯穿、火属性、弹速 +50%、按独立攻击力（兵器研究）', !!R.pierceShot && R.pierceShot.pierce && R.pierceShot.elem === 'fire' && R.pierceShot.type === 'indep' && R.pierceShot.vx > 1300, R.pierceShot);
report('爆裂弹：普攻命中爆炸（不贯穿）', !!R.burstShot && !R.burstShot.pierce && R.burstShot.onHit, R.burstShot);
report('特性弹：冰 → 冰冻、光 → 感电；子弹染成属性色', R.elemStatus.freeze && R.elemStatus.shock && R.elemStatus.col === '#fff38a', R.elemStatus);
report('空中施放转职技能：耗 1 次推进器、短暂悬停', R.airCast.ok && R.airCast.used === 1 && R.airCast.air && R.airCast.lowGrav < 0.5, R.airCast);
report('手雷：地面间隔 3 秒（兵器研究 -5%）、空中 0.5 秒；G-14 空中也能投（耗推进器）', R.g35Ground >= 2.7 && R.g35Ground <= 3 && R.g35Air.ok && R.g35Air.cd <= 0.5 && R.g35Air.used === 1 && R.g14Air.ok && R.g14Air.used === 1 && R.g14Air.cd <= 0.5, { ground: R.g35Ground, air: R.g35Air, g14: R.g14Air });
report('M18：敌人进入感应区爆炸、眩晕；再按技能键引爆', R.m18.placed === 1 && R.m18.after === 0 && R.m18.stun && R.m18.dmg && R.m18Recast.rc && R.m18Recast.left === 0, { m18: R.m18, recast: R.m18Recast });
report('C4：贴上 2 个敌人（减速），再按引爆', R.c4.stuck === 2 && R.c4.rc4 && R.c4.left === 0 && R.c4.boom && R.c4.slow, R.c4);
report('G-35L 感电 + 暴击 BUFF；G-18C 冰冻', R.g35.shock && R.g35.crit === 0.1 && R.g18.freeze, { g35: R.g35, g18: R.g18 });
report('凝固汽油弹：爆炸 + 3 秒地带', R.napalm.ok && R.napalm.field === 1 && R.napalm.dmg > 0, R.napalm);
report('聚合弹 / 交叉射击 / 镭射狙击（5 次）造成伤害', R.buster.ok && R.buster.dmg > 0 && R.cross.ok && R.cross.dmg > 0 && R.lockon.ok && R.lockon.hits >= 5, { buster: R.buster, cross: R.cross, lockon: R.lockon });
report('一觉 EMP 磁暴：造成伤害，3 级起直到爆炸都无敌', R.emp.ok && R.emp.dmg > 0 && R.emp.invul, R.emp);
report('弹药强化：命中挂过电流（受到伤害提高）', R.overcurrent > 0.1, { taken: R.overcurrent });
report('G-61 吸怪 + 爆炸；切利：真空洞、再按引爆', R.g61.closer && R.g61.dmg && R.chelli.vac === 1 && R.chelli.rch && R.chelli.left === 0 && R.chelli.dmg, { g61: R.g61, chelli: R.chelli });
report('二觉 / 三觉：开火、光子霰雷、决战之日、终解·制空霸权 造成伤害', ['openfire', 'photon', 'dday', 'final'].every(k => R[k].ok && R[k].dmg > 0), { openfire: R.openfire, photon: R.photon, dday: R.dday, final: R.final });
report('空袭战略：悬停在轰炸高度、推进器不减、空中射击 +12、再按引爆结束', R.standby.on && R.standby.z > 100 && R.standby.noNitro && R.standby.airMax >= 16 && R.standby.ended, R.standby);
report('被动：空中射击常驻；兵器研究（步枪）加攻速', R.passive.aerial && R.passive.aerialLv >= 1 && R.passive.firearm > 0, R.passive);
const errs = logs.filter(l => l.type !== 'warning'); report('无报错', errs.length === 0, errs.slice(0, 3));
await browser.close();
console.log(fail ? `${fail} 项失败` : '全部通过');
process.exit(fail ? 1 : 0);
