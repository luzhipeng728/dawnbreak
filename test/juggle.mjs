// 浮空（juggle）定量测试：无渲染快进，直接对目标调 applyHit，量滞空时间 / 高度 / 追加浮空递减 / 弹地 / 重怪 / 刷图连击上限 / 决斗浮空保护
// 用法：node test/juggle.mjs            参数表见 engine/combat.js 的 JUGGLE（docs/COMBAT_JUGGLE.md）
import { launch, URL_BASE } from './lib.mjs';
let fails = 0, n = 0;
const ok = (c, msg, x) => { n++; if (c) console.log('✓', msg, x !== undefined ? JSON.stringify(x) : ''); else { fails++; console.log('✗', msg, x !== undefined ? JSON.stringify(x) : ''); } };
const { browser, page, logs } = await launch({ width: 640, height: 360 });
// 页面里的公共工具：只留攻击者 + 目标，逐帧 step
const HELPERS = () => {
  window.J = {
    dt: 1 / 60,
    prep(a, t, o = {}) {
      game.paused = true; window.toastMsg = () => {};
      ents.length = 0; projs.length = 0; ents.push(a, t);
      for (const e of [a, t]) { e.control = () => {}; e.brain = null; e.act = null; e.hitstop = 0; e.invul = 0; e.stun = 0; e.z = 0; e.vz = 0; e.vx = 0; e.dead = false; e.setState('idle'); resetCmb(e); e.status = {}; e.buffs = {}; }
      a.x = 400; t.x = 460; a.y = t.y = DEPTH / 2; a.face = 1; t.face = -1;
      a.invul = 999; t.weight = o.weight ?? t.weight; if (!o.keepHp) { t.hpMax = t.hp = 1e9; }
      return t;
    },
    run(t, secs, each) { const out = { maxZ: 0, airT: 0, landT: -1, bounces: 0, st: [] }; let T = 0;
      for (let i = 0; i < secs * 60; i++) { if (each) each(T, i); step(J.dt); T += J.dt; if (t.st === 'air' || t.z > 0.5) out.airT += J.dt; out.maxZ = Math.max(out.maxZ, t.z); out.bounces = Math.max(out.bounces, t.cmb.bounce || 0); if (out.landT < 0 && (t.st === 'down' || t.st === 'getup' || t.st === 'idle') && T > 0.05) out.landT = T; }
      return out; },
    // 发射后到落地（down / getup）的时间和最高点
    hit(a, t, h) { return hittable(a, t) ? applyHit(a, t, { dmg: 0.01, ...h }) : false; },   // 和真实碰撞一样：无敌中打不到
    hang(a, t, h) { applyHit(a, t, { dmg: 0.01, ...h }); const r = J.run(t, 4); return { hang: +r.landT.toFixed(2), apex: Math.round(r.maxZ) }; },
  };
};
try {
  /* ---------------- 刷图（PvE）---------------- */
  await page.goto(`${URL_BASE}?test&mute`); await page.waitForFunction(() => window.__READY && game.player && ents.some(e => e.team === 'e'), null, { timeout: 60000 });
  await page.evaluate(HELPERS);
  const pve = await page.evaluate(() => {
    const a = game.player, m = ents.find(e => e.team === 'e' && !e.fighter), R = {};
    const fresh = w => J.prep(a, m, { weight: w });
    fresh(1); R.hang520 = J.hang(a, m, { launch: 520 });
    fresh(1); R.hang300 = J.hang(a, m, { launch: 300 });
    fresh(3); R.heavy520 = J.hang(a, m, { launch: 520 });
    // 追加浮空：每次落到 40 以下（下落中）再挑一次，记每次的最高点
    fresh(1); J.hit(a, m, { dmg: 0.01, launch: 520 }); const peaks = [0], base = [0]; let k = 0;   // 每次再挑多挑了多高（最高点 − 再挑时的高度）
    J.run(m, 8, () => { if (m.st !== 'air') return; peaks[k] = Math.max(peaks[k], m.z); if (m.vz < 0 && m.z < 40 && k < 4) { k++; peaks[k] = 0; base[k] = m.z; J.hit(a, m, { dmg: 0.01, launch: 520 }); } });
    R.relaunch = peaks.map((p, i) => Math.round(p - base[i]));
    // 上升中被普通攻击打到：不应该把浮空打断
    fresh(1); J.hit(a, m, { dmg: 0.01, launch: 520 }); let hit = false;
    const r1 = J.run(m, 4, T => { if (!hit && T > 0.08) { hit = true; J.hit(a, m, { dmg: 0.01, airLift: 120 }); } });
    R.riseHit = Math.round(r1.maxZ);
    // 砸地：空中被向下砸 → 弹地
    fresh(1); J.hit(a, m, { dmg: 0.01, launch: 520 }); let sp = false;
    const r2 = J.run(m, 4, T => { if (!sp && T > 0.35) { sp = true; J.hit(a, m, { dmg: 0.01, spike: 420, bounce: 0.5 }); } });
    R.spikeBounce = r2.bounces;
    // 自然落地（高处落下）也弹一下
    fresh(1); J.hit(a, m, { dmg: 0.01, launch: 720 }); R.fallBounce = J.run(m, 4).bounces;
    // 刷图无限连：挑起后每 0.1 秒一下空中攻击（浮空力 150），每 0.9 秒再挑一次 → 多久掉下来
    fresh(1); J.hit(a, m, { dmg: 0.01, launch: 520 });
    const r3 = J.run(m, 20, (T, i) => { if (m.st !== 'air') return; if (i % 6 === 0) J.hit(a, m, { dmg: 0.01, airLift: 150 }); if (i % 54 === 0) J.hit(a, m, { dmg: 0.01, launch: 480 }); });
    R.pveJuggle = +r3.landT.toFixed(2);
    // 倒地追击次数有限
    fresh(1); J.hit(a, m, { dmg: 0.01, launch: 300 }); J.run(m, 1.2); let otg = 0;
    for (let i = 0; i < 12 && (m.st === 'down' || m.st === 'air'); i++) { if (m.st === 'down') { J.hit(a, m, { dmg: 0.01, downHit: true }); otg++; } J.run(m, 0.25); }
    R.otg = otg; R.otgEnd = m.st;
    return R;
  });
  console.log('刷图', JSON.stringify(pve));
  ok(pve.hang520.hang >= 0.85 && pve.hang520.hang <= 1.35 && pve.hang520.apex >= 95 && pve.hang520.apex <= 170, '普通重量挑空（浮空力 520）：滞空 0.85~1.35 秒、高 95~170', pve.hang520);
  ok(pve.hang300.apex < pve.hang520.apex * 0.55, '浮空力小的技能挑得低', pve.hang300);
  ok(pve.heavy520.apex < pve.hang520.apex * 0.5 && pve.heavy520.hang < pve.hang520.hang * 0.75, '重怪（重量 3）挑得更低、掉得更快', pve.heavy520);
  const P = pve.relaunch;
  ok(P.length >= 4 && P.every((v, i) => !i || v < P[i - 1]) && P[P.length - 1] >= P[0] * 0.25, '追加浮空：每次再挑高度递减，但不会一下子挑不起来', P);
  ok(pve.riseHit >= pve.hang520.apex * 0.85, '上升中被普攻打到不会打断浮空', { riseHit: pve.riseHit, base: pve.hang520.apex });
  ok(pve.spikeBounce >= 1 && pve.fallBounce >= 1, '砸地 / 高处落地会弹地一次', { spike: pve.spikeBounce, fall: pve.fallBounce });
  ok(pve.pveJuggle > 3 && pve.pveJuggle < 10, '刷图：连续空中连击能打一阵（>3 秒），但不会无限（<10 秒掉下来）', pve.pveJuggle);
  ok(pve.otg >= 1 && pve.otg <= 5 && pve.otgEnd !== 'down', '倒地追击次数有限，之后强制起身', { otg: pve.otg, end: pve.otgEnd });

  /* ---------------- 决斗（PvP）---------------- */
  await page.goto(`${URL_BASE}?duel=sword&vs=sword&auto&mute`); await page.waitForFunction(() => window.__READY && game.duel && duel.b, null, { timeout: 60000 });
  await page.evaluate(HELPERS);
  const pvp = await page.evaluate(() => {
    const a = duel.a, t = duel.b, R = {};
    const fresh = () => { duel.state = 'fight'; duel.timer = 999; J.prep(a, t, { keepHp: true }); t.hp = t.hpMax; a.invul = 999; };
    fresh(); R.hang520 = J.hang(a, t, { launch: 520 });
    // 满连：挑起后每 0.1 秒一下（伤害 2），每 0.8 秒再挑 → 多久被保护掉下来、落地后能不能继续打
    fresh(); J.hit(a, t, { dmg: 2, launch: 520 }); let firstLand = -1, protSeen = 0;
    const r = J.run(t, 12, (T, i) => { if (airProtLv(t) > 0) protSeen = 1; if (firstLand < 0 && t.st !== 'air' && t.z <= 0.5) firstLand = T; if (firstLand >= 0) return; if (i % 6 === 0) J.hit(a, t, { dmg: 2, airLift: 150 }); if (i % 48 === 0) J.hit(a, t, { dmg: 2, launch: 520 }); });
    R.firstLand = +firstLand.toFixed(2); R.prot = protSeen; R.lostPct = Math.round((1 - t.hp / t.hpMax) * 100);
    // 落地后（倒地 / 受身）继续追击：应该很快站起来并短暂无敌
    let otgHits = 0; for (let i = 0; i < 20 && t.st === 'down'; i++) { if (J.hit(a, t, { dmg: 2, downHit: true })) otgHits++; J.run(t, 0.1); }
    R.afterLand = t.st; R.otgAfter = otgHits;
    // 15 秒不停地挑 + 空中攻击（落地后立刻再挑）：统计浮空时间占比和最长一段
    fresh(); let cur = 0, longest = 0, air = 0, relaunch = 0;
    J.run(t, 15, (T, i) => { const inAir = t.st === 'air' || t.z > 0.5; if (inAir) { cur += J.dt; air += J.dt; longest = Math.max(longest, cur); } else cur = 0;
      if (i % 6 === 0) { if (inAir) J.hit(a, t, { dmg: 2, airLift: 150 }); else if (t.st === 'idle' || t.st === 'hit' || t.st === 'down') { if (J.hit(a, t, { dmg: 2, launch: 520, downHit: true })) relaunch++; } }
      if (t.hp < t.hpMax * 0.3) t.hp = t.hpMax; });
    R.longest = +longest.toFixed(2); R.airShare = Math.round(air / 15 * 100); R.relaunches = relaunch;
    // ---- 受身蹲伏（被打倒的一方用手柄按 C）----
    const want = { tap: false, hold: false };
    const knock = () => { fresh(); t.pad = new Pad(); t.control = (e, dt) => { if (want.tap) { e.pad.tap('jump'); want.tap = false; } else if (want.hold) e.pad.hold('jump'); e.pad.frame(game.t); playerControl(e, dt); }; J.hit(a, t, { dmg: 0.5, launch: 300 }); for (let i = 0; i < 300 && t.st !== 'down'; i++) step(J.dt); };
    const crouch = holdS => { want.tap = true; want.hold = holdS > 0; let T = 0, inv = 0, st0 = null; for (let i = 0; i < 240; i++) { if (T >= holdS) want.hold = false; step(J.dt); T += J.dt; if (i === 8) st0 = t.st + (t.techHold ? ':hold' : ''); if (t.invul > 0) inv = T; } return { st0, inv: +inv.toFixed(2) }; };
    knock(); t.reboundCd = 0; R.down = t.st; R.tap = crouch(0);
    knock(); t.reboundCd = 0; R.hold = crouch(3);
    knock(); t.reboundCd = 0; want.tap = true; want.hold = true; for (let i = 0; i < 20; i++) step(J.dt);
    R.otgWhiff = !J.hit(a, t, { dmg: 2, downHit: true }) && t.techHold; want.hold = false; for (let i = 0; i < 60; i++) step(J.dt);
    knock(); R.cdLeft = +t.reboundCd.toFixed(1); want.tap = true; for (let i = 0; i < 10; i++) step(J.dt); R.cdBlocked = t.st === 'down' && !t.techHold;
    return R;
  });
  // AI 对打：会用受身蹲伏（有时多蹲一会儿），进攻方会压起身
  const ai = await page.evaluate(() => {
    const S = { tech: 0, long: 0, meaty: 0, rounds: 0 }; const t0 = window.tryTech; window.tryTech = p => { const r = t0(p); if (r) S.tech++; return r; };
    for (let n = 0; n < 9; n++) {   // 决斗改成一局定胜负后，打 9 场凑够原来 3 场 × 3 局的样本
      duel.start({ a: 'sword', ja: 'blade', b: 'gun', jb: 'ranger', lv: 30, ai: 3, auto: true, theme: 'ruinsDark' });
      for (let i = 0; i < 60 * 60 * 3.6 && duel.state !== 'result'; i++) { step(1 / 60); for (const p of [duel.a, duel.b]) { if (p.techHold) p._hT = (p._hT || 0) + 1 / 60; else if (p._hT) { if (p._hT > 0.4) S.long++; p._hT = 0; } } }
      S.meaty += (duel.a.brain.meaty || 0) + (duel.b.brain.meaty || 0); S.rounds += (duel.roundLog || []).length; duel.roundLog = [];
    }
    window.tryTech = t0; return S;
  });
  console.log('受身蹲伏', JSON.stringify({ tap: pvp.tap, hold: pvp.hold, otgWhiff: pvp.otgWhiff, cdLeft: pvp.cdLeft, cdBlocked: pvp.cdBlocked, ai }));
  console.log('决斗', JSON.stringify(pvp));
  ok(pvp.hang520.hang >= 0.85 && pvp.hang520.hang <= 1.35, '决斗里挑空的滞空和刷图一致', pvp.hang520);
  ok(pvp.prot && pvp.firstLand > 0 && pvp.firstLand <= 4.5, '决斗浮空保护：满连也会在 4.5 秒内掉下来', pvp);
  ok(pvp.lostPct <= 45, '一套浮空连不会打掉太多血（≤45%）', pvp.lostPct);
  ok(pvp.afterLand !== 'down' && pvp.otgAfter <= 3, '保护掉下来后强制起身，不能一直追击', { st: pvp.afterLand, otg: pvp.otgAfter });
  ok(pvp.longest <= 5 && pvp.airShare <= 70, '决斗没有无限浮空：最长一段 ≤5 秒，15 秒里浮空时间 ≤70%', { longest: pvp.longest, share: pvp.airShare });
  ok(pvp.down === 'down' && pvp.tap.st0.startsWith('getup') && pvp.tap.inv >= 0.4 && pvp.tap.inv <= 0.9, '倒地按 C：受身蹲伏，短暂无敌（0.4~0.9 秒）', pvp.tap);
  ok(pvp.hold.inv >= 1.4 && pvp.hold.inv <= 2.0, '按住 C 延长蹲伏，决斗最长约 1.5 秒（+起身）', pvp.hold);
  ok(pvp.otgWhiff, '蹲伏中被追击打不到');
  ok(pvp.cdLeft > 10 && pvp.cdBlocked, '决斗冷却 20 秒：冷却中按 C 不能蹲伏', { cd: pvp.cdLeft, blocked: pvp.cdBlocked });
  ok(ai.tech >= 2 && ai.long >= 1 && ai.meaty >= 1, 'AI 会用受身蹲伏（有时多蹲一会儿），也会压起身', ai);
  const errs = logs.filter(l => l.type === 'pageerror');
  ok(!errs.length, '页面没有报错', errs.slice(0, 3));
} catch (e) { ok(false, '异常：' + (e.stack || e)); }
await browser.close();
console.log(`\n${n - fails}/${n} 通过`); process.exit(fails ? 1 : 0);
