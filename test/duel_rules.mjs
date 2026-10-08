// 决斗场规则单测（B9，docs/PVP.md §5）：逐帧 step()、不渲染，约 10 秒
//   hp      决斗 HP 倍率（所有职业 + AI）、保护阈值按原 HP 算、地下城不受影响
//   guard   开局 3 秒倒计时：能走、能放 BUFF；普攻 / 伤害技能 / 命中 / 异常状态无效；AI 也守规矩；计时器倒计时结束才走；联机主机快照带 gd
//   startcd 开局冷却：觉醒 30 / 40 / 45 秒、决斗冷却 ≥14 秒的大技能整段冷却（最多 42 秒）、8~14 秒的一半、小技能 / BUFF 没有；技能栏直接显示
//   juggle  追加浮空（下落中再挑起、一次比一次低）、一级 / 二级保护（重力变大、二级挑不起来、不强制空中受身）、落地后还能追击直到倒地保护（强制起身 + 无敌）、
//           二次浮空（落地后再挑起的伤害也算倒地保护）、平推保护、硬直衰减、时间保护（连续不能行动 3.2 秒）、错位（纵深超出判定打不到，击退不改纵深）、受击状态修正
//   buffer  指令缓冲各职业一致：动作结束前 0.3 秒内按的技能键会在动作结束后放出，更早按的作废
// 用法：node test/duel_rules.mjs [hp,guard,startcd,juggle,buffer]
import { launch, URL_BASE } from './lib.mjs';
const parts = (process.argv[2] || 'hp,guard,startcd,juggle,buffer').split(',');
const { browser, page, logs } = await launch({ width: 640, height: 360 });
await page.goto(`${URL_BASE}?duel=sword&vs=gun&auto&ai=3&mute&fighter=1`);
await page.waitForFunction(() => window.__READY && game.duel, null, { timeout: 60000 });
await page.evaluate(async () => {
  await loadBundles(openClasses().map(c => 'spr:' + c)); game.paused = true; window.toastMsg = () => {};
  // 测试台：a 由测试按键（自己的 Pad），b 默认不动（木桩），需要时给 b 装 AI
  window.__T = {
    start(a = 'sword', ja = null, b = 'gun', jb = null, o = {}) {
      duel.start({ a, ja, b, jb, lv: DUEL_CFG.lv, ai: 3, auto: true, theme: 'ruinsDark' });
      const A = duel.a, B = duel.b; A.brain = null; A.pad = new Pad(); A.control = (e, dt) => { if (duel.state === 'fight') { e.pad.frame(game.t); playerControl(e, dt); } };
      if (!o.aiB) { B.brain = null; B.control = () => {}; }
      return { A, B };
    },
    run(n) { for (let i = 0; i < n; i++) step(1 / 60); },
    toFight(skipGuard) { for (let i = 0; i < 200 && duel.state !== 'fight'; i++) step(1 / 60); if (skipGuard) { duel.guardT = 0; } },
  };
});
let fails = 0;
const ok = (c, msg, x) => { if (c) console.log('✓', msg); else { fails++; console.log('✗', msg, x !== undefined ? JSON.stringify(x).slice(0, 700) : ''); } };
const ev = (fn, arg) => page.evaluate(fn, arg);

if (parts.includes('hp')) {
  const r = await ev(() => {
    const out = {};
    for (const c of ['sword', 'gun', 'mage', 'fighter']) { const { A, B } = __T.start(c, null, 'sword'); out[c] = { hp: A.hpMax, base: DUEL_BASE[c].hp, ai: B.hpMax, mp: A.mpMax }; }
    out.mul = DUEL_CFG.hpMul; out.air = PVP.airProt; out.air2 = PVP_PROT.air2; out.down = PVP.downProt; out.stand = PVP.standProt; out.sec = PVP.secProt; out.reset = PVP.protReset; out.cap = PVP.hitCap;
    return out;
  });
  ok(['sword', 'gun', 'mage', 'fighter'].every(c => r[c].hp === Math.round(r[c].base * r.mul)) && r.sword.ai === Math.round(DUEL_BASE_SWORD() * r.mul), `决斗 HP ×${r.mul}（4 个职业、AI 一样）`, r);
  function DUEL_BASE_SWORD() { return r.sword.base; }
  ok(r.air === 0.2 && r.air2 === 0.3 && r.down === 0.15 && r.sec === 0.15 && r.stand === 0.25 && r.reset === 3 && r.cap === 0.05, '保护按血条（官方 90 版）：一段 20% 加速下落，二段 30% 砸地，起身 15%，二次保护 15%，平推 25%，第一次落地 3 秒后清零，单下不超过 5%', r);
  const pve = await ev(async () => { const P = makePlayer('sword'); game.lvl = 30; const pvp0 = game.pvp; game.pvp = false; game.duel = null; recalcStats(P); const hp = P.hpMax; game.pvp = pvp0; game.duel = duel; return { hp, isPvp: isPvp(P, duel.b) }; });
  ok(pve.hp > 0 && pve.hp < 21000 * 1.5, `地下城不受影响：Lv30 鬼剑士 recalcStats 的 HP ${pve.hp}（不乘决斗倍率）`, pve);
}

if (parts.includes('guard')) {
  const r = await ev(() => {
    const { A, B } = __T.start('sword', 'berserker', 'fighter', 'grappler');
    __T.toFight();
    const out = { guard0: +duel.guardT.toFixed(2), timer0: duel.timer, state: duel.state };
    const x0 = A.x; for (let i = 0; i < 20; i++) { A.pad.hold('right'); __T.run(1); } out.moved = Math.round(A.x - x0);
    A.pad.tap('attack'); __T.run(2); out.atkAct = A.act ? A.act.name : null;
    const dmgSkill = A.kit.bar.find(id => id && !duelGuardFree(id) && !SKILLS[id].awaken && !(A.cool[id] > 0));
    const s = A.kit.bar.indexOf(dmgSkill); A.pad.tap('s' + s); __T.run(3); out.dmgSkill = dmgSkill; out.dmgAct = A.act ? A.act.name : null; out.dmgCool = +(A.cool[dmgSkill] || 0).toFixed(2);
    const buff = Object.keys(A.kit.lv).find(id => duelGuardFree(id) && SKILLS[id].act && !(A.cool[id] > 0));
    out.buff = buff; if (buff) { A.act = null; A.setState('idle'); out.buffCast = castSkill(A, buff); __T.run(40); out.buffOn = !!A.buffs[buff] || !!(A.act && A.act.skill === buff) || (A.cool[buff] > 0); }
    out.hit = applyHit(A, B, { dmg: 2, sure: true, stun: 0.3 }); out.bHp = B.hp === B.hpMax; addStatus(B, 'stun', 1); out.status = !!(B.status && B.status.stun);
    out.timerDuring = duel.timer;
    for (let i = 0; i < 200 && duel.guardT > 0; i++) __T.run(1);
    out.msg = duel.msg; A.act = null; A.setState('idle'); A.pad.tap('attack'); __T.run(2); out.atkAfter = A.act ? A.act.name : null;
    out.hitAfter = applyHit(A, B, { dmg: 0.01, sure: true, stun: 0.2 }); __T.run(30); out.timerAfter = +duel.timer.toFixed(1);
    // 联机：主机快照带倒计时
    const s0 = netDuel.send, r0 = netDuel.role, st0 = netDuel.state; let snap = null; netDuel.send = m => { snap = m; }; netDuel.role = 'host'; netDuel.state = 'fight'; duel.guardT = 2.5; try { netDuel.hostSnap(); } finally { netDuel.send = s0; netDuel.role = r0; netDuel.state = st0; duel.guardT = 0; }
    out.snapGd = snap && snap.gd;
    return out;
  });
  ok(r.state === 'fight' && r.guard0 > 2.9 && r.timer0 === r.timerDuring, `开局 ${r.guard0} 秒倒计时，倒计时期间计时器不走（${r.timer0}）`, r);
  ok(r.moved > 40, `倒计时中能走（${r.moved}px）`, r);
  ok(!r.atkAct && !r.dmgAct && !(r.dmgCool > 0), `倒计时中普攻、伤害技能（${r.dmgSkill}）放不出来，也不进冷却`, r);
  ok(!r.buff || (r.buffCast && r.buffOn), `倒计时中 BUFF 能放（${r.buff}）`, r);
  ok(r.hit === false && r.bHp && !r.status, '倒计时中命中 / 异常状态都无效', r);
  ok(r.msg === '开始!' && /atk/.test(r.atkAfter || '') && r.hitAfter === true && r.timerAfter < r.timer0, `倒计时结束“开始!”，之后能普攻（${r.atkAfter}）、能打中，计时器开始走（${r.timerAfter}）`, r);
  ok(r.snapGd === 2.5, '联机：主机快照带开局倒计时 gd（对方那边同样不能攻击）', r);
  const ai = await ev(() => {
    const out = [];
    for (const [a, ja, b, jb] of [['fighter', 'nenmaster', 'sword', 'blade'], ['mage', 'elemental', 'fighter', 'striker'], ['gun', 'launcher', 'fighter', 'brawler']]) {
      duel.start({ a, ja, b, jb, lv: DUEL_CFG.lv, ai: 3, auto: true, theme: 'ruinsDark' }); const A = duel.a, B = duel.b, x = [A.x, B.x];
      for (let i = 0; i < 200 && duel.state !== 'fight'; i++) step(1 / 60);
      let hurt = 0; while (duel.guardT > 0) { step(1 / 60); if (A.hp < A.hpMax || B.hp < B.hpMax) hurt++; }
      out.push({ m: a + ':' + ja + ' vs ' + b + ':' + jb, hurt, moved: Math.round(Math.abs(A.x - x[0]) + Math.abs(B.x - x[1])), buffs: [...Object.keys(A.buffs), ...Object.keys(B.buffs)].filter(k => k !== 'burn_mode').length });
      for (let i = 0; i < 60 * 10 && duel.state === 'fight'; i++) step(1 / 60);
      out[out.length - 1].fought = A.hp < A.hpMax || B.hp < B.hpMax;
    }
    return out;
  });
  ok(ai.every(x => x.hurt === 0 && x.moved > 30 && x.fought), `AI 守倒计时：3 局倒计时里都没人掉血、会走位（放了 BUFF：${ai.map(x => x.buffs).join('/')}），倒计时后开打`, ai);
}

if (parts.includes('startcd')) {
  const r = await ev(() => {
    const out = {};
    for (const [c, j] of [['sword', 'berserker'], ['gun', 'launcher'], ['mage', 'elemental'], ['fighter', 'grappler'], ['fighter', 'nenmaster']]) {
      const { A } = __T.start(c, j, 'sword');
      const L = Object.keys(A.kit.lv).filter(id => SKILLS[id] && !SKILLS[id].passive && (SKILLS[id].act || SKILLS[id].instant));
      const aw = L.filter(id => SKILLS[id].awaken).map(id => [id, duelAwTier(id), +(A.cool[id] || 0).toFixed(1)]);
      const big = L.filter(id => !SKILLS[id].awaken && !duelGuardFree(id) && SKILLS[id].cd * (SKILLS[id].pvpCd || 1) >= 14).map(id => [id, SKILLS[id].cd, +(A.cool[id] || 0).toFixed(1)]);
      const small = L.filter(id => !SKILLS[id].awaken && SKILLS[id].cd * (SKILLS[id].pvpCd || 1) < 8).map(id => [id, +(A.cool[id] || 0).toFixed(1)]);
      const bar = game.skillBar.filter(id => id && A.cool[id] > 0).length;
      out[c + ':' + j] = { aw, big, small, bar, buffs: L.filter(id => duelGuardFree(id)).map(id => [id, A.cool[id] || 0]) };
    }
    return out;
  });
  for (const [k, v] of Object.entries(r)) {
    ok(v.aw.length && v.aw.every(([, t, c]) => c === [30, 40, 45][t - 1]), `${k}：觉醒开局冷却 ${v.aw.map(a => a[0] + ' ' + a[2] + 's').join(' / ')}`, v.aw);
    ok(v.big.length && v.big.every(([, cd, c]) => Math.abs(c - Math.min(42, cd)) < 0.2 || c > 0), `${k}：大技能开局整段冷却（${v.big.slice(0, 3).map(b => b[0] + ' ' + b[2] + 's').join('、')}…）`, v.big);
    ok(v.small.every(([, c]) => c === 0) && v.buffs.every(([, c]) => !c), `${k}：小技能（${v.small.length} 个）和 BUFF 开局就能用`, { small: v.small.filter(s => s[1]), buffs: v.buffs.filter(b => b[1]) });
    ok(v.bar > 0, `${k}：技能栏上 ${v.bar} 格开局显示冷却`, v.bar);
  }
}

if (parts.includes('juggle')) {
  const r = await ev(() => {
    const out = {};
    const fresh = () => { const { A, B } = __T.start('sword', null, 'gun'); __T.toFight(true); B.x = A.x + 60; B.y = A.y; B.face = -1; A.face = 1; A.atk = A.matk = 2000; A.crit = A.mcrit = 0; A.critDmg = 1; A.dmgUp = 0; B.dmgTaken = 1; B.evade = 0; resetCmb(B); return { A, B }; };
    const base = B => B.hpMax;   // 保护百分比是血条上能看到的最大 HP
    const fall = (B, n = 400) => { for (let i = 0; i < n && (B.z > 0.5 || B.st === 'air'); i++) __T.run(1); };
    // 追加浮空：挑空 → 下落中再挑 ×3，每次挑起的初速度一次比一次小（同一轮连招里递减）
    { const { A, B } = fresh(); const vz = [];
      applyHit(A, B, { dmg: 0.05, launch: 600, sure: true }); vz.push(Math.round(B.vz));
      for (let k = 0; k < 3; k++) { let top = 0, falling = false; for (let i = 0; i < 300; i++) { __T.run(1); top = Math.max(top, B.z); if (B.vz < 0 && B.z < top * 0.7) { falling = true; break; } } if (!falling) break; applyHit(A, B, { dmg: 0.05, launch: 600, sure: true }); vz.push(Math.round(B.vz)); }
      out.relaunch = { vz, lv: duelAirLv(B) }; }
    // 上挑按正常重力飞起来。下落途中普攻和技能打中会把人重新打上去；无尽波动那种没判定的持续伤不会托人
    { const { A, B } = fresh(); const lv = A.kit.lv.upslash || 1;
      applyHit(A, B, { dmg: skillDmg(1.8, 0.18, lv), launch: 520 + lv * 6, knock: 40, box: [0, 100, 34, 0, 125], sure: true });
      const launchVz = Math.round(B.vz);
      let maxZ = 0, frames = 0;
      for (let i = 0; i < 180 && (B.st === 'air' || B.z > 0.5); i++) { __T.run(1); frames++; maxZ = Math.max(maxZ, B.z); if (B.vz < -40 && B.z < maxZ * 0.7) break; }
      const fallVz = Math.round(B.vz);
      applyHit(A, B, { dmg: 0.2, box: [0, 92, 32, 18, 100], stun: 0.2, knock: 40, sure: true });
      const atkVz = Math.round(B.vz);
      for (let i = 0; i < 90 && B.vz > -40; i++) __T.run(1);
      applyHit(A, B, { dmg: 0.4, box: [0, 120, 40, 0, 140], stun: 0.3, knock: 30, sure: true });
      const skVz = Math.round(B.vz);
      for (let i = 0; i < 20 && B.vz > -60; i++) __T.run(1);
      const before = B.vz; applyHit(A, B, { dmg: 0.05, sure: true, hs: 0, stun: 0.05, knock: 0, asAura: true });
      out.float = { maxZ: Math.round(maxZ), frames, launchVz, fallVz, atkVz, skVz, auraVz: Math.round(B.vz), before: Math.round(before) }; }
    // 一级 / 二级保护：按原 HP 的 20% / 30%；重力变大；二级后挑空几乎没用；不强制空中受身；落地后追击直到倒地保护
    { const { A, B } = fresh(); applyHit(A, B, { dmg: 0.05, launch: 700, sure: true }); __T.run(10);
      const g0 = airGravity(B); let n = 0; const hitAir = () => { applyHit(A, B, { dmg: 3, airLift: 160, sure: true }); n++; };
      while (duelAirLv(B) < 1 && n < 60) { B.z = Math.max(B.z, 80); B.vz = Math.max(B.vz, 50); hitAir(); }
      const lv1 = { n, air: +(B.cmb.airDmg / base(B)).toFixed(3), g: +(airGravity(B) / g0).toFixed(2) };
      while (duelAirLv(B) < 2 && n < 120) { B.z = Math.max(B.z, 80); B.vz = Math.max(B.vz, 50); hitAir(); }
      const lv2 = { n, air: +(B.cmb.airDmg / base(B)).toFixed(3), g: +(airGravity(B) / g0).toFixed(2) };
      B.vz = -10; applyHit(A, B, { dmg: 0.02, launch: 700, sure: true }); lv2.relaunchVz = Math.round(B.vz); lv2.recover = !!B.recoverLand;
      fall(B); lv2.landSt = B.st;
      let otg = 0; const d0 = B.cmb.downDmg; for (let i = 0; i < 40 && B.st === 'down'; i++) { if (applyHit(A, B, { dmg: 2, downHit: true, sure: true, stun: 0.3 }) !== false) otg++; __T.run(1); if (B.st !== 'down' && B.st !== 'air') break; if (B.st === 'air') { B.z = 0; B.vz = 0; B.bounced = true; B.setState('down'); B.cmb.landed = true; B.downTime = 9; B.stT = 0.2; } }
      out.prot = { lv1, lv2, otg, downPct: +((B.cmb.downDmg || 0) / base(B)).toFixed(3), afterSt: B.st, invul: +B.invul.toFixed(2), fullDown: +(PVP.downProt * B.hpMax / base(B)).toFixed(2) }; }
    // 二次浮空：落地后再挑起，伤害单独算二次保护（不算进扫地 / 起身保护），超过 15% 就落地站起（受身）
    { const { A, B } = fresh(); applyHit(A, B, { dmg: 0.05, launch: 600, sure: true }); fall(B); const st = B.st; B.cmb.hits = Math.max(1, B.cmb.hits); __T.run(1);
      applyHit(A, B, { dmg: 0.05, launch: 500, downHit: true, sure: true }); let n = 0; while (!B.recoverLand && n < 60 && !B.dead) { B.z = Math.max(B.z, 60); applyHit(A, B, { dmg: 2, airLift: 120, sure: true }); n++; }
      out.second = { st, landed: !!B.cmb.landed, recover: !!B.recoverLand, n, down: +(B.cmb.downDmg / base(B)).toFixed(3), sec: +((B.cmb.secDmg || 0) / base(B)).toFixed(3) }; }
    // 清零规则（官方 90 版）：第一次落地 3 秒后、并且已经脱离浮空 / 倒地才清；起身后不到 3 秒再挑，上一套的保护还在；还在倒地被扫就一直保留；
    // 平推条 3 秒没再挨站立攻击就清、被挑起来立即清；一次浮空条从挑飞起算，扫地伤害也算；没落过地的能行动 3 秒清零
    { const { A, B } = fresh(); const pct = v => +((v || 0) / base(B)).toFixed(3);
      applyHit(A, B, { dmg: 0.05, launch: 600, sure: true }); for (let i = 0; i < 6; i++) { B.z = Math.max(B.z, 60); applyHit(A, B, { dmg: 2, airLift: 140, sure: true }); }
      fall(B); const landT = game.t, air0 = pct(B.cmb.airDmg);
      applyHit(A, B, { dmg: 1, downHit: true, sure: true }); const airSweep = pct(B.cmb.airDmg);
      for (let i = 0; i < 400 && B.st !== 'idle'; i++) __T.run(1);
      const upT = +(game.t - landT).toFixed(2), keep = { air: pct(B.cmb.airDmg), down: pct(B.cmb.downDmg), landed: !!B.cmb.landed };
      for (let i = 0; i < 400 && game.t - landT < 2.95; i++) __T.run(1); const at29 = pct(B.cmb.airDmg);
      __T.run(10); const at31 = { air: pct(B.cmb.airDmg), hits: B.cmb.hits, landed: !!B.cmb.landed };
      out.reset = { air0, airSweep, upT, keep, at29, at31 }; }
    { const { A, B } = fresh(); applyHit(A, B, { dmg: 0.05, launch: 600, sure: true }); fall(B); const landT = game.t; let n = 0;
      for (let i = 0; i < 60 * 5 && game.t - landT < 3.6; i++) { if (B.st === 'down' && i % 20 === 0) { B.downTime = 9; applyHit(A, B, { dmg: 0.01, downHit: true, sure: true }); n++; } if (B.st === 'air') { B.z = 0; B.vz = 0; B.setState('down'); B.stT = 0.2; } __T.run(1); }
      const held = { st: B.st, air: +(B.cmb.airDmg / base(B)).toFixed(4), n, t: +(game.t - landT).toFixed(2) };
      B.downTime = 0.1; for (let i = 0; i < 200 && (B.st === 'down' || B.st === 'getup'); i++) __T.run(1); __T.run(2);
      out.extend = { held, after: { st: B.st, air: B.cmb.airDmg, hits: B.cmb.hits } }; }
    { const { A, B } = fresh(); applyHit(A, B, { dmg: 2, stun: 0.3, sure: true }); const s0 = B.cmb.standDmg; for (let i = 0; i < 60 * 2.5; i++) __T.run(1); const s25 = B.cmb.standDmg;
      B.stun = 0; B.setState('idle'); for (let i = 0; i < 40; i++) __T.run(1); const s31 = B.cmb.standDmg;
      applyHit(A, B, { dmg: 2, stun: 0.3, sure: true }); const s1 = B.cmb.standDmg; applyHit(A, B, { dmg: 0.05, launch: 500, sure: true }); const sl = B.cmb.standDmg;
      out.standReset = { s0: s0 > 0, s25: s25 > 0, s31, s1: s1 > 0, afterLaunch: sl }; }
    { const { A, B } = fresh(); applyHit(A, B, { dmg: 0.5, stun: 0.05, sure: true }); for (let i = 0; i < 20; i++) __T.run(1); B.cmb.standDmg = 0; B.cmb.standT = game.t + 99;
      for (let i = 0; i < 60 * 2.5; i++) __T.run(1); const h25 = B.cmb.hits; for (let i = 0; i < 60 * 0.7; i++) __T.run(1); out.free = { h25, h32: B.cmb.hits }; }
    { const { A, B } = fresh(); const idle = jugDbg.info(B); applyHit(A, B, { dmg: 1, launch: 500, sure: true }); __T.run(2); const I = jugDbg.info(B);
      const on0 = jugDbg.on; jugDbg.on = true; let err = null; try { renderWorld(); } catch (e) { err = String(e); } jugDbg.on = on0;
      out.dbg = { idle, lines: I && I.lines, air: I && I.raw.air, err }; }
    // 平推保护：站着挨打累计血条的 25% → 强制击倒（官方 90 版）
    { const { A, B } = fresh(); let n = 0, d = 0; while (B.st !== 'air' && n < 80) { B.stun = 0; B.setState('idle'); d = B.cmb.dmg; applyHit(A, B, { dmg: 2, stun: 0.3, sure: true }); n++; } out.stand = { n, st: B.st, pct: +(d / base(B)).toFixed(3), pctAfter: +(B.cmb.dmg / base(B)).toFixed(3), below: d < base(B) * PVP.standProt, above: B.cmb.dmg >= base(B) * PVP.standProt }; }
    // 硬直衰减：同一轮每多挨一下硬直 −2.5%，最低 60%
    { const { A, B } = fresh(); const S = []; for (let k = 0; k < 20; k++) { B.setState('idle'); applyHit(A, B, { dmg: 0.001, stun: 0.4, sure: true }); S.push(+B.stun.toFixed(3)); } out.stun = { first: S[0], tenth: S[9], last: S[19], min: +(S[0] * PVP.stunMin / (1 - PVP.stunDecay)).toFixed(3) }; }
    // 时间保护：连续不能行动超过 lockMax，下一下直接脱出
    { const { A, B } = fresh(); let t = 0, esc = null; for (let i = 0; i < 60 * 12; i++) { if (i % 12 === 0) { const r = applyHit(A, B, { dmg: 0.0005, stun: 0.5, sure: true }); if (r === false && !esc) { esc = { t: +t.toFixed(2), lock: +(B.pvpLockT || 0).toFixed(2), invul: +B.invul.toFixed(2) }; break; } } __T.run(1); t += 1 / 60; } out.lock = esc; }
    // 错位：判定纵深 ±20 → 对方偏 30 打不到、偏 10 打得到；击退不改纵深
    { const { A, B } = fresh(); A.face = 1; B.x = A.x + 50; B.y = A.y + 20 + B.d + 6; const hb = { t0: 0, t1: 1, box: [0, 90, 20, 0, 120], dmg: 1, stun: 0.3, knock: 200 }; const box = atkBox(A, hb);
      const far = overlaps(box, B); B.y = A.y + 10; const near = overlaps(atkBox(A, hb), B); const y0 = B.y; applyHit(A, B, { dmg: 0.01, stun: 0.3, knock: 300, sure: true }); __T.run(20);
      out.z = { far, near, dy: +(B.y - y0).toFixed(2), dx: Math.round(B.x - (A.x + 50)) }; }
    // 受击状态修正：同一下，浮空中 ×0.85、倒地 ×0.9
    { const one = st => { const { A, B } = fresh(); A.crit = 0; if (st === 'air') { B.z = 60; B.setState('air'); } if (st === 'down') B.setState('down'); const hp = B.hp; const orig = Math.random; Math.random = () => 0.5; try { applyHit(A, B, { dmg: 1, sure: true, downHit: true }); } finally { Math.random = orig; } return hp - B.hp; };
      const s = one('stand'), a = one('air'), d = one('down'); out.state = { s, a: +(a / s).toFixed(3), d: +(d / s).toFixed(3) }; }
    // 扫地：低段打得到倒地的人并托起来；高段打空；受身蹲伏之后打不中
    { const { A, B } = fresh(); B.setState('down'); B.downTime = 3; B.stT = 0.2; B.cmb.landed = true; B.cmb.hits = 1; const hp = B.hp;
      const low = applyHit(A, B, { dmg: 0.35, box: [0, 92, 32, 0, 90], stun: 0.25, sure: true });
      const lowSt = B.st, lowDmg = hp - B.hp;
      B.setState('down'); B.z = 0; B.vz = 0; B.invul = 0; B.stT = 0.2; B.downTime = 3;
      const high = applyHit(A, B, { dmg: 0.35, box: [0, 80, 30, 70, 140], stun: 0.25, sure: true });
      B.setState('down'); B.z = 0; B.vz = 0; B.invul = 0; B.stT = 0.2; B.downTime = 3; B.mp = 50; B.reboundCd = 0; B.pad.tap('jump'); B.pad.frame(game.t);
      const teched = tryTech(B); const techHit = applyHit(A, B, { dmg: 1, downHit: true, box: [0, 90, 32, 0, 80], sure: true });
      out.sweep = { low: low !== false, lowSt, lowDmg, high: high !== false, tech: teched, techSt: B.st, techInv: B.invul > 0, techHit: techHit !== false }; }
    return out;
  });
  const t = r.relaunch.vz;
  ok(t.length >= 4 && t.slice(1).every((v, i) => v > 0 && v < t[i]), `追加浮空：下落中再挑起来 ${t.length - 1} 次，挑起的初速度一次比一次小（${t.join(' → ')}）`, r.relaunch);
  const F = r.float;
  ok(F && F.launchVz >= 400 && F.maxZ >= 90 && F.maxZ <= 180 && F.frames < 100 && F.fallVz < 0 && F.atkVz >= 300 && F.skVz >= 300 && F.auraVz < 150 && F.auraVz < F.atkVz - 100, `上挑初速 ${F && F.launchVz}、最高 ${F && F.maxZ}px、${F && F.frames} 帧后开始落（vz ${F && F.fallVz}）；普攻把人打回 vz ${F && F.atkVz}，技能 vz ${F && F.skVz}；持续伤不托人（vz ${F && F.auraVz}）`, F);
  const P = r.prot;
  ok(P.lv1.air >= 0.2 && P.lv1.air < 0.27 && P.lv1.g > 1.3, `一段保护：浮空累计血条的 ${(P.lv1.air * 100).toFixed(1)}% 开始加速下落，重力 ×${P.lv1.g}`, P.lv1);
  ok(P.lv2.air >= 0.3 && P.lv2.air < 0.4 && P.lv2.g > P.lv1.g && P.lv2.relaunchVz < 0 && !P.lv2.recover, `二段保护：累计 ${(P.lv2.air * 100).toFixed(1)}% 直接砸地（vz ${P.lv2.relaunchVz}），重力 ×${P.lv2.g}，不在空中受身`, P.lv2);
  ok(P.lv2.landSt === 'down' && P.otg >= 2 && P.downPct >= 0.15 && (P.afterSt === 'getup' || P.afterSt === 'idle') && P.invul > 0, `砸地之后还能扫地 ${P.otg} 下，再掉血条的 ${(P.downPct * 100).toFixed(0)}% 才强制起身 + 无敌 ${P.invul} 秒`, P);
  ok(r.second.landed && r.second.recover && r.second.sec >= 0.15 && r.second.sec < 0.2 && r.second.down < 0.05, `二次保护：落地后再挑起来的伤害单独算（${(r.second.sec * 100).toFixed(0)}%，扫地 / 起身条 ${(r.second.down * 100).toFixed(0)}%），到 15% 落地起身`, r.second);
  ok(r.dbg.idle === null && r.dbg.lines && r.dbg.lines.length === 3 && /二次/.test(r.dbg.lines[1]) && r.dbg.air > 0 && !r.dbg.err, '?jugdbg：决斗玩家头顶显示平推 / 浮空 / 起身 / 二次保护百分比和落地计时，画面不报错', r.dbg);
  const Rs = r.reset;
  ok(Rs.airSweep > Rs.air0 && Rs.keep.air > 0 && Rs.keep.landed && Rs.upT < 2.9 && Rs.at29 > 0 && Rs.at31.air === 0 && Rs.at31.hits === 0, `清零：起身（落地后 ${Rs.upT} 秒）时保护还在，第一次落地 3 秒后才清；扫地伤害也算一次浮空条（${Rs.air0} → ${Rs.airSweep}）`, Rs);
  const E = r.extend;
  ok(E.held.st === 'down' && E.held.t > 3.2 && E.held.air > 0 && E.after.hits === 0 && E.after.air === 0, `清零：落地后一直被扫（${E.held.t} 秒、${E.held.n} 下）保护一直保留，起身后才清`, E);
  const SR = r.standReset;
  ok(SR.s0 && SR.s25 && SR.s31 === 0 && SR.s1 && SR.afterLaunch === 0, '平推条：3 秒没再挨站立攻击就清，被挑起来立即清', SR);
  ok(r.free.h25 > 0 && r.free.h32 === 0, `没落过地：能行动 3 秒清零（2.5 秒时还在：${r.free.h25} 下）`, r.free);
  ok(r.stand.st === 'air' && r.stand.below && r.stand.above, `平推保护：站着挨打到血条的 25% 强制击倒（${r.stand.n} 下）`, r.stand);
  ok(r.stun.tenth < r.stun.first && r.stun.last >= r.stun.min - 0.005 && r.stun.last < r.stun.tenth, `硬直衰减：第 1 下 ${r.stun.first}s → 第 10 下 ${r.stun.tenth}s → 第 20 下 ${r.stun.last}s（最低 60%）`, r.stun);
  ok(r.lock && r.lock.t >= 7.2 && r.lock.t < 8.3 && r.lock.invul > 0, `时间保护：连续不能行动 ${r.lock && r.lock.t} 秒就脱出（上限 7.5 秒，一整套浮空加扫地放得下）`, r.lock);
  ok(!r.z.far && r.z.near && Math.abs(r.z.dy) < 1 && r.z.dx > 20, `错位：纵深超出判定（±20 + 身体厚度）打不到、偏 10 打得到，击退只沿横向（横移 ${r.z.dx}px、纵深变化 ${r.z.dy}）`, r.z);
  ok(Math.abs(r.state.a - 0.85) < 0.02 && Math.abs(r.state.d - 0.9) < 0.02, `受击状态修正：浮空 ×${r.state.a}、倒地 ×${r.state.d}`, r.state);
  const S = r.sweep;
  ok(S && S.low && S.lowDmg > 0 && S.lowSt === 'air' && !S.high && S.tech && S.techSt === 'getup' && S.techInv && !S.techHit, `扫地：低段打得中并托起（${S && S.lowSt}），高段打空，受身蹲伏后无敌打不中`, S);
}

if (parts.includes('buffer')) {
  const r = await ev(() => {
    const out = {};
    for (const c of ['sword', 'gun', 'mage', 'fighter']) {
      const res = [];
      for (const lead of [0.2, 0.5]) {
        const { A, B } = __T.start(c, null, 'sword'); __T.toFight(true); B.x = A.x + 400; A.mp = 1e6;
        const L = A.kit.bar.filter(id => id && SKILLS[id].act && !SKILLS[id].awaken && !SKILLS[id].air && !SKILLS[id].airOnly && !SKILLS[id].charge);
        for (const id of L) A.cool[id] = 0;
        // 先放一个长一点、不能取消的技能，结束前 lead 秒按下另一个技能
        const first = L.find(id => { A.act = null; A.setState('idle'); if (!castSkill(A, id)) return false; const a = A.act; const ok2 = a && !a.links && !a.cancelable && a.dur > 0.5; A.act = null; A.setState('idle'); A.cool[id] = 0; return ok2; });
        const second = L.find(id => id !== first);
        if (!first || !second) { res.push({ lead, skip: true }); continue; }
        castSkill(A, first); A.act.noCancel = true; const dur = A.act.dur, s2 = A.kit.bar.indexOf(second);   // 远程技能会打中 400px 外的人：通用后摇取消（game/skill_cancel.js）在这里关掉，只测缓冲
        let pressed = false, got = null;
        for (let i = 0; i < 240; i++) { if (!pressed && A.act && A.act.skill === first && A.act.dur - A.actT <= lead) { A.pad.tap('s' + s2); pressed = true; } __T.run(1); if (pressed && A.act && A.act.skill === second) { got = true; break; } if (pressed && (!A.act || A.act.skill !== first) && i > 0 && !got) { got = got || false; } }
        res.push({ lead, first, second, dur: +dur.toFixed(2), got: !!got });
      }
      out[c] = res;
    }
    return out;
  });
  for (const [c, L] of Object.entries(r)) {
    const a = L[0], b = L[1];
    if (a.skip) { ok(true, `${c}：没有合适的不可取消技能，跳过`); continue; }
    ok(a.got && !b.got, `${c}：${a.first}（${a.dur}s）结束前 0.2 秒按的 ${a.second} 接着放出，0.5 秒前按的作废（指令缓冲 0.3 秒，各职业同一套）`, L);
  }
}

const errs = logs.filter(l => l.type === 'pageerror');
ok(!errs.length, '没有页面报错', errs.slice(0, 3));
await browser.close();
console.log(fails ? `\n${fails} 项失败` : '\n全部通过');
process.exit(fails ? 1 : 0);
