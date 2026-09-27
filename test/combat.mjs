// 战斗机制测试：暂停游戏循环、手动逐帧推进，逐条验证伤害公式 / 属性 / Miss / 破招 / 背击 / 浮空衰减与重力 / 倒地追击与强制起身 /
// 霸体与抓取 / 格挡 / 技能取消规则 / 蓄力 / 攻速 / 指令输入 / 受身 / 僵直度与硬直 / 决斗场保护。node test/combat.mjs
import { launch, URL_BASE } from './lib.mjs';
let fail = 0;
const report = (name, ok, info) => { if (!ok) fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${JSON.stringify(info)}`); };
async function open(q) {
  const { browser, page, logs } = await launch({ width: 960, height: 540 });
  await page.goto(`${URL_BASE}?${q}&mute`); await page.waitForFunction(() => window.__READY, null, { timeout: 30000 });
  await page.evaluate(() => {
    game.paused = true;
    window.T = {
      run(n) { for (let i = 0; i < n; i++) { input.frame(game.t); step(1 / 60); } },
      mob(kind = 'goblin', x = 400, y = 100, o = {}) { const m = spawnMonster(kind, x, y, o); m.control = null; m.invul = 0; m.z = 0; m.vz = 0; m.setState('idle'); Object.assign(m, o.set || {}); return m; },
      clear() { for (const e of ents) if (e !== game.player) e.remove = true; T.run(1); projs.length = 0; },
      reset(p = game.player) { Object.assign(p, { x: 300, y: 100, z: 0, vx: 0, vy: 0, vz: 0, face: 1, act: null, invul: 0, superArmor: 0, hitstop: 0, dead: false, cool: {}, buffs: {} }); p.hp = p.hpMax; p.mp = p.mpMax; p.setState('idle'); resetCmb(p); },
      key(a, hold) { input.virt[a] = hold ? 1 : 2; }, release(a) { delete input.virt[a]; },
    };
  });
  return { browser, page, logs };
}
// ---------------- PvE / 通用机制（剑士测试房间） ----------------
{
  const { browser, page, logs } = await open('test&cls=sword&mobs=0');
  const R = await page.evaluate(() => {
    const out = {}, p = game.player; T.clear(); T.reset();
    for (const id of classSkills('sword', 'blade').concat(classSkills('sword', 'berserker'))) game.skillLv[id] = 5;
    game.job = 'blade'; game.skillBar = ['upslash', 'ghost', 'iai', 'rip', 'guard', 'awaken', 'wave', 'slam', 'triple', 'cross', null, null];
    const avg = (f, n = 60) => { let s = 0; for (let i = 0; i < n; i++) s += f(); return s / n; };
    // 1) 伤害类型：物理读 atk/def，魔法读 matk/mdef；属性强化 / 抗性
    Object.assign(p, { atk: 1000, matk: 2000, crit: 0, mcrit: 0, dmgUp: 0, elem: { fire: 110 }, res: null });
    const m = T.mob('goblin', 900, 100); Object.assign(m, { def: 0, mdef: 1200, hp: 1e9, hpMax: 1e9, evade: 0 });
    const hit = h => { const hp = m.hp; m.setState('idle'); m.act = null; applyHit(p, m, { dmg: 1, sure: true, ...h }, { proj: true }); return hp - m.hp; };
    out.phys = Math.round(avg(() => hit({ type: 'phys' })));
    out.mag = Math.round(avg(() => hit({ type: 'mag' })));
    out.fire = Math.round(avg(() => hit({ type: 'phys', elem: 'fire' })));
    // 2) 破招：目标出招中（攻击判定还没结束）伤害 ×1.25
    out.counter = Math.round(avg(() => { m.doAct({ name: 'club', dur: 1, hits: [{ t0: 0.5, t1: 0.6, box: [0, 50, 20, 0, 60], dmg: 1 }] }); m.actT = 0.1; const hp = m.hp; applyHit(p, m, { dmg: 1, sure: true, type: 'phys' }, { proj: true }); return hp - m.hp; }));
    // 3) Miss：回避 0.6、命中 0 → 约 60% Miss
    m.evade = 0.6; let miss = 0; for (let i = 0; i < 400; i++) { m.setState('idle'); if (!applyHit(p, m, { dmg: 1, type: 'phys' }, { proj: true })) miss++; } out.missRate = miss / 400; m.evade = 0;
    // 4) 暴击：暴击率 1 → ×critDmg
    p.crit = 1; out.crit = Math.round(avg(() => hit({ type: 'phys' }))); p.crit = 0;
    // 5) 背击：目标背对攻击者，暴击率 +10%
    m.face = 1; p.x = m.x - 50; let crits = 0; p.crit = 0; for (let i = 0; i < 2000; i++) { m.setState('idle'); const hp = m.hp; applyHit(p, m, { dmg: 1, sure: true, type: 'phys' }, { proj: true }); if (hp - m.hp > 1300) crits++; } out.backCritRate = crits / 2000; T.reset();
    // 6) 浮空：挑空后连续空中受击，重力逐次加重、浮空力衰减
    T.clear(); const j = T.mob('goblin', 360, 100, { set: { hp: 1e9, hpMax: 1e9, def: 0 } });
    applyHit(p, j, { dmg: 0.1, launch: 500, sure: true }, { proj: true }); const v1 = j.vz, g0 = airGravity(j);
    for (let i = 0; i < 8; i++) applyHit(p, j, { dmg: 0.1, launch: 500, sure: true }, { proj: true });
    out.juggle = { firstLaunchVz: Math.round(v1), ninthLaunchVz: Math.round(j.vz), gravity1: +g0.toFixed(3), gravity9: +airGravity(j).toFixed(3), airHits: j.cmb.air };
    // 7) 落地 → 倒地；非追击攻击打不到倒地目标；追击攻击可以，4 次后强制起身（带无敌）
    for (let i = 0; i < 200 && j.st !== 'down'; i++) T.run(1); out.downState = j.st;
    out.canHitDownNormal = canHit(p, j, {}); out.canHitDownOtg = canHit(p, j, { downHit: true });
    const sts = []; for (let i = 0; i < 6; i++) { if (j.st !== 'down') { j.z = 0; j.vz = 0; j.setState('down'); j.downTime = 5; } if (canHit(p, j, { downHit: true })) applyHit(p, j, { dmg: 0.1, downHit: true, sure: true }, { proj: true }); sts.push(j.st); T.run(1); }
    out.otgSeq = sts; out.otgInvul = +j.invul.toFixed(2);
    // 8) 霸体：普通攻击只掉血不硬直；抓取可以抓住霸体；领主抓不住
    T.clear(); const sa = T.mob('goblin', 360, 100, { set: { hp: 1e9, hpMax: 1e9 } }); sa.superArmor = 5;
    applyHit(p, sa, { dmg: 0.1, stun: 0.5, sure: true }, { proj: true }); out.saHit = sa.st;
    p.x = 300; p.face = 1; p.doAct({ name: 'g', dur: 1, hits: [] }); applyHit(p, sa, { dmg: 0.1, grab: true }, {}); out.saGrab = sa.st; out.grabbed = p.grabbed === sa;
    p.endAct(); T.run(1); out.afterRelease = sa.st;
    const boss = T.mob('goblin', 360, 60, { boss: true, set: { hp: 1e9, hpMax: 1e9 } }); p.doAct({ name: 'g', dur: 1, hits: [] }); applyHit(p, boss, { dmg: 0.1, grab: true }, {}); out.bossGrab = boss.st; p.endAct();
    // 9) 僵直度 / 硬直：攻方 stagger 250 → 硬直 ×1.6（上限）；守方 hardness 250 → ×0.5（下限）
    T.clear(); const s1 = T.mob('goblin', 360, 100, { set: { hp: 1e9, hpMax: 1e9, weight: 1 } });
    applyHit(p, s1, { dmg: 0.01, stun: 0.4, sure: true }, { proj: true }); const base = s1.stun; s1.setState('idle');
    p.stagger = 250; applyHit(p, s1, { dmg: 0.01, stun: 0.4, sure: true }, { proj: true }); const up = s1.stun; p.stagger = 0; s1.setState('idle');
    s1.hardness = 250; applyHit(p, s1, { dmg: 0.01, stun: 0.4, sure: true }, { proj: true }); const dn = s1.stun;
    out.stun = { base: +base.toFixed(3), stagger250: +up.toFixed(3), hardness250: +dn.toFixed(3) };
    // 10) 取消规则：普攻 → 技能随时可取消；技能后摇前不能取消，cancelFrom 之后可以；觉醒不能取消
    T.clear(); T.reset(); p.doAct(p.acts.atk1); T.run(1); T.key('s0'); T.run(1); T.release('s0'); out.basicCancel = p.act && p.act.skill;
    T.reset(); p.cool = {}; castSkill(p, 'ghost'); T.run(2); T.key('s0'); T.run(1); T.release('s0'); out.skillEarly = p.act && p.act.skill;
    T.run(25); T.key('s0'); T.run(1); T.release('s0'); out.skillLate = p.act && p.act.skill;
    T.reset(); castSkill(p, 'awaken'); game.timeStop = 0; for (let i = 0; i < 60; i++) { T.key('s1'); T.run(1); T.release('s1'); T.run(1); } out.awakenCancel = p.act && p.act.skill; T.run(200);
    // 11) 蓄力：按住技能键蓄力（拔刀斩），松开或蓄满释放；倍率随蓄力提高
    T.reset(); p.cool = {}; T.key('s2'); T.run(2); T.run(52); const held = p.act && { name: p.act.name, t: +p.actT.toFixed(2), charging: p.act.charging, k: p.act.chargeK, mul: +p.act.dmgMul.toFixed(2) }; T.release('s2'); T.run(80);
    T.reset(); p.cool = {}; T.key('s2'); T.run(1); T.release('s2'); T.run(40); const tap = p.act && { k: p.act.chargeK, mul: +p.act.dmgMul.toFixed(2) };
    out.charge = { held, tap }; T.run(60);
    // 12) 攻速：aspd 1.5 → 普攻动作速度 ×1.5
    T.reset(); p.aspd = 1.5; p.doAct(p.acts.atk1); out.aspd = p.act.spd; let n = 0; while (p.act && n < 60) { T.run(1); n++; } out.atk1Frames = n; p.aspd = 1;
    // 13) 格挡：正面攻击吸收大部分伤害、不硬直
    T.reset(); castSkill(p, 'guard', false, 's4'); T.key('s4', true); T.run(5); const g = T.mob('goblin', 360, 100); g.face = -1; const hp0 = p.hp;
    applyHit(g, p, { dmg: 5, stun: 0.5, sure: true, type: 'phys' }, {}); out.guard = { st: p.st, act: p.act && p.act.name, taken: hp0 - p.hp }; T.release('s4'); T.run(30);
    T.reset(); const hp1 = p.hp; applyHit(g, p, { dmg: 5, stun: 0.5, sure: true, type: 'phys' }, {}); out.noGuardTaken = hp1 - p.hp; out.noGuardSt = p.st;
    // 14) 抓取技能：裂波斩抓住目标 → held → 结束后被击飞
    T.clear(); T.reset(); p.cool = {}; const r = T.mob('goblin', 350, 100, { set: { hp: 1e9, hpMax: 1e9 } }); r.superArmor = 5; castSkill(p, 'rip'); T.run(14); out.ripHeld = r.st; T.run(60); out.ripAfter = r.st;
    return out;
  });
  report('物理 / 魔法伤害分别读 atk-def / matk-mdef', Math.abs(R.phys - 1000) < 40 && Math.abs(R.mag - 1000) < 40, { phys: R.phys, mag: R.mag });
  report('属性强化 110 → 伤害 ×1.5', Math.abs(R.fire / R.phys - 1.5) < 0.06, { fire: R.fire });
  report('破招伤害 ×1.25', Math.abs(R.counter / R.phys - 1.25) < 0.06, { counter: R.counter });
  report('回避 0.6 → Miss 约 60%', Math.abs(R.missRate - 0.6) < 0.08, { missRate: R.missRate });
  report('暴击 ×1.5', Math.abs(R.crit / R.phys - 1.5) < 0.06, { crit: R.crit });
  report('背击暴击率 +10%', Math.abs(R.backCritRate - 0.1) < 0.03, { backCritRate: R.backCritRate });
  report('浮空衰减与重力加重', R.juggle.ninthLaunchVz < R.juggle.firstLaunchVz * 0.6 && R.juggle.gravity9 > R.juggle.gravity1 * 1.2, R.juggle);
  report('落地倒地；普通攻击打不到倒地目标，追击可以', R.downState === 'down' && !R.canHitDownNormal && R.canHitDownOtg, { st: R.downState });
  report('倒地追击 4 次后强制起身（带无敌）', R.otgSeq.includes('getup') && R.otgInvul > 0, { seq: R.otgSeq, invul: R.otgInvul });
  report('霸体不硬直、抓取能抓霸体、领主抓不住', R.saHit !== 'hit' && R.saGrab === 'held' && R.grabbed && R.afterRelease !== 'held' && R.bossGrab !== 'held', { saHit: R.saHit, saGrab: R.saGrab, after: R.afterRelease, boss: R.bossGrab });
  report('僵直度 / 硬直修正', R.stun.stagger250 > R.stun.base * 1.5 && R.stun.hardness250 < R.stun.base * 0.6, R.stun);
  report('普攻可被技能取消', R.basicCancel === 'upslash', { got: R.basicCancel });
  report('技能后摇前不能取消，cancelFrom 后可以', R.skillEarly === 'ghost' && R.skillLate === 'upslash', { early: R.skillEarly, late: R.skillLate });
  report('觉醒不能被取消', R.awakenCancel === 'awaken', { got: R.awakenCancel });
  report('按住蓄力：蓄满倍率提高，点按不蓄', R.charge.held && R.charge.held.k > 0.9 && R.charge.held.mul > 1.4 && R.charge.tap && R.charge.tap.k < 0.2, R.charge);
  report('攻速 1.5 → 普攻动作更快', R.aspd === 1.5 && R.atk1Frames <= 14, { spd: R.aspd, frames: R.atk1Frames });
  report('格挡吸收正面伤害且不硬直', R.guard.st === 'act' && R.guard.act === 'guard' && R.guard.taken < R.noGuardTaken * 0.6 && R.noGuardSt === 'hit', { guard: R.guard, noGuard: R.noGuardTaken });
  report('裂波斩抓取（可抓霸体），结束后击飞', R.ripHeld === 'held' && (R.ripAfter === 'air' || R.ripAfter === 'down'), { held: R.ripHeld, after: R.ripAfter });
  const errs = logs.filter(l => l.type !== 'warning'); report('无报错（PvE）', errs.length === 0, errs.slice(0, 3));
  await browser.close();
}
// ---------------- 指令输入 / 受身（真实按键） ----------------
{
  const { browser, page, logs } = await open('test&cls=sword&mobs=0');
  await page.evaluate(() => { game.paused = false; for (const id of classSkills('sword', 'blade')) game.skillLv[id] = 5; game.job = 'blade'; const p = game.player; p.mpMax = p.mp = 99999; setInterval(() => { p.mp = p.mpMax; for (const k in p.cool) p.cool[k] = 0; }, 100); });
  const kb = page.keyboard, wait = ms => page.waitForTimeout(ms), tap = async (k, ms = 35) => { await kb.down(k); await wait(ms); await kb.up(k); };
  const skill = () => page.evaluate(() => { const p = game.player; return p.act && (p.act.skill || p.act.name); });
  const res = {};
  await wait(300); await tap('ArrowDown'); await tap('ArrowRight'); await tap('KeyZ'); await wait(60); res.df = await skill(); await wait(700);
  await tap('ArrowRight'); await tap('ArrowDown'); await tap('KeyZ'); await wait(60); res.fd = await skill(); await wait(1500);
  await tap('ArrowDown'); await tap('ArrowDown'); await tap('KeyX'); await wait(60); res.ddX = await skill(); await wait(600);
  await tap('KeyZ'); await wait(60); res.z = await skill(); await wait(700);
  await tap('ArrowLeft'); await tap('ArrowRight'); await tap('ArrowRight'); await tap('KeyZ'); await wait(60); res.bff = await skill(); await wait(1400);
  await page.waitForFunction(() => { const p = game.player; return p.z === 0 && p.free; }); await page.evaluate(() => { const p = game.player; p.face = 1; });
  await kb.down('ArrowUp'); await tap('KeyZ'); await kb.up('ArrowUp'); await wait(60); res.u = await skill(); await wait(800);
  report('指令：↓→+Z 地裂·波动剑 / →↓+Z 崩山击 / ↓↓+X 格挡 / Z 上挑 / ←→→+Z 破军升龙击 / ↑+Z 鬼斩', res.df === 'wave' && res.fd === 'slam' && res.ddX === 'guard' && res.z === 'upslash' && res.bff === 'rise' && res.u === 'ghost', res);
  // 连招：X×3 → 上挑（技能取消普攻）→ 跳起 X（空中追击）→ 落地后鬼斩；木桩全程浮空 / 倒地，连击数 ≥ 7
  await page.waitForFunction(() => { const p = game.player; return p.z === 0 && p.free; });
  await page.evaluate(() => { const p = game.player; p.x = 300; p.face = 1; game.combo = 0; game.maxCombo = 0; for (const e of ents) if (e.team === 'e') e.remove = true;
    const m = spawnMonster('goblin', 360, p.y); m.control = null; m.hp = m.hpMax = 1e9; m.invul = 0; window.__m = m; window.__airMax = 0; setInterval(() => { window.__airMax = Math.max(window.__airMax, __m.z); }, 16); });
  for (let i = 0; i < 3; i++) { await tap('KeyX'); await wait(110); }
  await tap('KeyA'); await page.waitForFunction(() => game.player.act && game.player.act.skill === 'upslash'); await page.waitForFunction(() => game.player.free);
  await tap('KeyC'); await wait(120); await tap('KeyX'); await page.waitForFunction(() => game.player.z === 0 && game.player.st !== 'jump'); await tap('KeyS'); await wait(700);
  const combo = await page.evaluate(() => ({ maxCombo: game.maxCombo, airMax: Math.round(window.__airMax), juggle: __m.cmb.air, st: __m.st }));
  report('连招：普攻×3 → 上挑取消 → 空中追击', combo.maxCombo >= 5 && combo.airMax > 80 && combo.juggle >= 2, combo);
  // 受身：被打倒后按 C
  await page.evaluate(() => { const p = game.player; p.reboundCd = 0; p.setState('down'); p.stT = 0.2; p.downTime = 3; });
  await tap('KeyC'); await wait(50);
  const tech = await page.evaluate(() => { const p = game.player; return { st: p.st, tech: p.tech, invul: +p.invul.toFixed(2) }; });
  report('倒地按 C 受身（起身 + 无敌）', tech.st === 'getup' && tech.tech && tech.invul > 0.3, tech);
  // 后跳 ↓+C（带无敌窗口）
  await wait(900); await kb.down('ArrowDown'); await tap('KeyC'); await kb.up('ArrowDown'); await wait(40);
  const bs = await page.evaluate(() => { const p = game.player; return { act: p.act && p.act.name, invul: p.invul > 0 }; });
  report('↓+C 后跳（起跳无敌）', bs.act === 'back' && bs.invul, bs);
  const errs = logs.filter(l => l.type !== 'warning'); report('无报错（按键）', errs.length === 0, errs.slice(0, 3));
  await browser.close();
}
// ---------------- 决斗场保护机制 ----------------
{
  const { browser, page, logs } = await open('duel=sword&vs=gun&auto');
  const R = await page.evaluate(() => {
    const out = {}, A = duel.a, B = duel.b; duel.state = 'fight'; A.control = B.control = null;
    B.x = A.x + 60; B.y = A.y; B.hp = B.hpMax; resetCmb(B); A.face = 1; A.crit = A.mcrit = B.crit = B.mcrit = 0;
    out.pvp = game.pvp && isPvp(A, B);
    // 伤害修正：同一攻击在决斗场里 × PVP.dmg
    const hp0 = B.hp; B.setState('idle'); applyHit(A, B, { dmg: 1, sure: true, type: 'phys' }, { proj: true }); const d1 = hp0 - B.hp;
    const pv = game.pvp; game.pvp = false; A.fighter = false; const hp1 = B.hp; B.setState('idle'); applyHit(A, B, { dmg: 1, sure: true, type: 'phys' }, { proj: true }); const d2 = hp1 - B.hp; A.fighter = true; game.pvp = pv;
    out.pvpRatio = +(d1 / d2).toFixed(2);
    // 浮空保护：浮空中累计伤害超过 20% → 加速下落、挑空力下降
    B.hp = B.hpMax; resetCmb(B); B.setState('idle'); applyHit(A, B, { dmg: 0.1, launch: 500, sure: true }, { proj: true }); const g1 = airGravity(B);
    let k = 0; while (B.cmb.airDmg < B.hpMax * 0.26 && k++ < 200) applyHit(A, B, { dmg: 1.5, airLift: 200, sure: true }, { proj: true });
    out.air = { lv: airProtLv(B), g1: +g1.toFixed(2), g2: +airGravity(B).toFixed(2) };
    // 倒地保护：倒地后累计伤害超过 20% → 强制起身 + 0.7 秒无敌
    B.hp = B.hpMax; resetCmb(B); B.vz = 0; B.z = 0; B.setState('down'); B.downTime = 9; let st = [];
    for (let i = 0; i < 60 && B.st !== 'getup'; i++) { if (B.st === 'air') { B.z = 0; B.vz = 0; B.setState('down'); B.downTime = 9; } applyHit(A, B, { dmg: 1.5, downHit: true, sure: true }, { proj: true }); st.push(B.st); }
    out.down = { st: B.st, invul: +B.invul.toFixed(2), ratio: +(B.cmb.downDmg / B.hpMax).toFixed(2) };
    // 抓取保护：被抓释放后 1.5 秒内不能再被抓
    B.invul = 0; B.setState('idle'); resetCmb(B); A.doAct({ name: 'g', dur: 1, hits: [] }); applyHit(A, B, { dmg: 0.1, grab: true }, {}); const held = B.st; A.endAct(); T.run(2);
    A.doAct({ name: 'g', dur: 1, hits: [] }); applyHit(A, B, { dmg: 0.1, grab: true }, {}); out.grab = { first: held, second: B.st, prot: +B.grabProt.toFixed(2) }; A.endAct();
    // 平推保护：站着连续挨打累计超过 22% → 强制击倒
    B.hp = B.hpMax; resetCmb(B); B.invul = 0; B.grabProt = 0; B.z = 0; B.vz = 0; B.setState('idle'); let st2 = [];
    for (let i = 0; i < 80 && B.st !== 'air'; i++) { B.setState('idle'); applyHit(A, B, { dmg: 0.8, stun: 0.3, sure: true, type: 'phys' }, { proj: true }); st2.push(B.st); }
    out.stand = { st: B.st, ratio: +((B.hpMax - B.hp) / B.hpMax).toFixed(2) };
    // 被格斗者打中不再给 0.2 秒保护无敌（否则连不上招）
    A.invul = 0; A.setState('idle'); applyHit(B, A, { dmg: 0.1, sure: true }, { proj: true }); out.noMercyInvul = A.invul <= 0;
    return out;
  });
  report('决斗场判定 + 伤害修正', R.pvp && Math.abs(R.pvpRatio - 0.35) < 0.05, { pvp: R.pvp, ratio: R.pvpRatio });
  report('浮空保护（20% 后加速下落）', R.air.lv >= 2 && R.air.g2 > R.air.g1 * 1.5, R.air);
  report('倒地保护（20% 后强制起身 + 无敌）', R.down.st === 'getup' && R.down.invul >= 0.6 && R.down.ratio >= 0.2 && R.down.ratio < 0.35, R.down);
  report('抓取保护', R.grab.first === 'held' && R.grab.second !== 'held' && R.grab.prot > 1, R.grab);
  report('平推保护（站立挨打 22% 后强制击倒）', R.stand.st === 'air' && R.stand.ratio >= 0.22 && R.stand.ratio < 0.3, R.stand);
  report('决斗场里挨打不给怜悯无敌', R.noMercyInvul, {});
  const errs = logs.filter(l => l.type !== 'warning'); report('无报错（决斗场）', errs.length === 0, errs.slice(0, 3));
  await browser.close();
}
console.log(fail ? `${fail} 项失败` : '全部通过');
process.exit(fail ? 1 : 0);
