// 浮空（juggle）定量测试：无渲染快进，直接对目标调 applyHit，量滞空时间 / 高度 / 追加浮空 / 弹地 / 重怪 / 刷图一级二级保护 / 倒地追击 / 扣地 / 决斗浮空保护
//   刷图回归（docs/COMBAT_JUGGLE.md §5，2026-10 修复）：起身后再挑满高度、没有浮空时限、非追击打倒地只扣血、多段追击打得完、扣地砸倒站着的目标
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
    let lv1 = -1, lv2 = -1, pre = [], cur = 0, seg = 0;   // 进一级 / 二级的时间；一级之前每次再挑后的最高点
    const r3 = J.run(m, 20, (T, i) => { if (m.st !== 'air') return; const lv = m.js ? m.js.lv : 0; if (lv1 < 0 && lv >= 1) lv1 = T; if (lv2 < 0 && lv >= 2) lv2 = T; cur = Math.max(cur, m.z);
      if (i % 6 === 0) J.hit(a, m, { dmg: 0.01, airLift: 150 }); if (i % 54 === 0) { if (i && !lv) pre.push(Math.round(cur)); cur = 0; J.hit(a, m, { dmg: 0.01, launch: 480 }); } });
    R.ceil = JUGGLE.pveCeil; R.pveJuggle = +r3.landT.toFixed(2); R.maxZ = Math.round(r3.maxZ); R.lv1 = +lv1.toFixed(2); R.lv2 = +lv2.toFixed(2); R.prePeaks = pre;
    const PN = JUGGLE_PROT.normal, rate = 10 * JUGGLE_PROT.common.pt.hit + JUGGLE_PROT.common.pt.launch / 0.9; R.expLv1 = +(PN.p1 / rate).toFixed(2); R.expLv2 = +(PN.p2 / rate).toFixed(2);
    // 领主：同样的满连更早进保护
    fresh(1); m.boss = true; J.hit(a, m, { dmg: 0.01, launch: 520 }); let b1 = -1, b2 = -1;
    const rb = J.run(m, 20, (T, i) => { if (m.st !== 'air') return; const lv = m.js ? m.js.lv : 0; if (b1 < 0 && lv >= 1) b1 = T; if (b2 < 0 && lv >= 2) b2 = T; if (i % 6 === 0) J.hit(a, m, { dmg: 0.01, airLift: 150 }); if (i % 54 === 0) J.hit(a, m, { dmg: 0.01, launch: 480 }); });
    m.boss = false; R.boss = { lv1: +b1.toFixed(2), lv2: +b2.toFixed(2), land: +rb.landT.toFixed(2) };
    // 倒地追击次数有限
    fresh(1); J.hit(a, m, { dmg: 0.01, launch: 300 }); J.run(m, 1.2); let otg = 0;
    for (let i = 0; i < 12 && (m.st === 'down' || m.st === 'air'); i++) { if (m.st === 'down') { J.hit(a, m, { dmg: 0.01, downHit: true }); otg++; } J.run(m, 0.25); }
    R.otg = otg; R.otgEnd = m.st;
    return R;
  });
  console.log('刷图', JSON.stringify(pve)); const JUGGLE_CEIL = pve.ceil;
  ok(pve.hang520.hang >= 0.85 && pve.hang520.hang <= 1.35 && pve.hang520.apex >= 95 && pve.hang520.apex <= 170, '普通重量挑空（浮空力 520）：滞空 0.85~1.35 秒、高 95~170', pve.hang520);
  ok(pve.hang300.apex < pve.hang520.apex * 0.55, '浮空力小的技能挑得低', pve.hang300);
  ok(pve.heavy520.apex < pve.hang520.apex * 0.5 && pve.heavy520.hang < pve.hang520.hang * 0.75, '重怪（重量 3）挑得更低、掉得更快', pve.heavy520);
  const P = pve.relaunch;
  ok(P.length >= 4 && P.every(v => v >= P[0] * 0.95), '追加浮空：一级保护之前再挑不递减（官方：保护线之前怎么连都一样）', P);   // 以前 111 / 81 / 59 / 43 / 32
  ok(pve.riseHit >= pve.hang520.apex * 0.85, '上升中被普攻打到不会打断浮空', { riseHit: pve.riseHit, base: pve.hang520.apex });
  ok(pve.spikeBounce >= 1 && pve.fallBounce >= 1, '砸地 / 高处落地会弹地一次', { spike: pve.spikeBounce, fall: pve.fallBounce });
  ok(Math.abs(pve.lv1 - pve.expLv1) < 0.6 && Math.abs(pve.lv2 - pve.expLv2) < 0.6, '刷图满连：进一级 / 二级保护的时间点和参数表（JUGGLE_PROT）算出来的一致', { lv1: pve.lv1, lv2: pve.lv2, exp: [pve.expLv1, pve.expLv2] });
  ok(pve.prePeaks.length >= 3 && pve.prePeaks.every(v => v >= pve.prePeaks[0] * 0.95), '一级保护之前：每次再挑的最高点不递减', pve.prePeaks);
  ok(pve.pveJuggle > pve.lv2 && pve.pveJuggle < pve.lv2 + 4.5, '刷图：连招能一直打到二级保护（没有 5 秒时限），过了二级很快掉下来（不会无限浮空）', { land: pve.pveJuggle, lv2: pve.lv2 });   // 打击停顿占了一大半时间，掉下来的 1~3 秒大部分是停顿
  ok(pve.maxZ <= JUGGLE_CEIL + 15, `满连不会把怪顶出屏幕（最高 ≤${JUGGLE_CEIL + 15} 像素，JUGGLE.pveCeil）`, pve.maxZ);
  ok(pve.boss.lv1 > 0 && pve.boss.lv1 < pve.lv1 && pve.boss.lv2 < pve.lv2 && pve.boss.land < pve.pveJuggle, '领主：同样的满连更早进保护、更早掉下来', { boss: pve.boss, normal: [pve.lv1, pve.lv2, pve.pveJuggle] });
  ok(pve.otg >= 1 && pve.otg <= 5 && pve.otgEnd !== 'down', '倒地追击次数有限，之后强制起身', { otg: pve.otg, end: pve.otgEnd });

  /* ---------------- 刷图回归（审查报告 B1~B5 的复现场景）---------------- */
  const reg = await page.evaluate(() => {
    const a = game.player, m = ents.find(e => e.team === 'e' && !e.fighter), R = {}, dt = J.dt;
    const fresh = () => { J.prep(a, m, { weight: 1 }); m.freeT = 0; m.x = 460; a.x = 400; };
    const tick = n => { for (let i = 0; i < n; i++) { step(dt); m.x = 460; a.x = 400; } };
    const until = (f, max = 6) => { let T = 0; while (!f() && T < max) { tick(1); T += dt; } return T; };
    const apex = () => { let z = 0, T = 0; while ((m.st === 'air' || m.z > 0.5) && T < 8) { tick(1); z = Math.max(z, m.z); T += dt; } return Math.round(z); };
    const raw = h => applyHit(a, m, { dmg: 0.01, ...h });   // 像职业文件那样直接调用（不经过 canHit）
    // B1：挑空 → 落地 → 起身 → 0.3 秒后再挑，连续 4 轮（以前 111 / 82 / 60 / 44）
    fresh(); R.rounds = []; for (let k = 0; k < 4; k++) { J.hit(a, m, { launch: 520 }); R.rounds.push(apex()); until(() => m.st === 'idle'); tick(18); }
    // B2：6.5 秒浮空连 → 起身 → 站着挨打 3 秒 → 再挑（以前 1 像素）
    fresh(); J.hit(a, m, { launch: 520 }); { let i = 0; while (i < 390 && m.st === 'air') { if (i % 6 === 0) J.hit(a, m, { airLift: 150 }); if (i % 54 === 0) J.hit(a, m, { launch: 480 }); tick(1); i++; } }
    until(() => m.st === 'idle'); for (let i = 0; i < 12; i++) { J.hit(a, m, { stun: 0.3 }); tick(15); }
    R.afterLong = (J.hit(a, m, { launch: 520 }), apex()); fresh(); J.hit(a, m, { launch: 520 }); R.freshApex = apex();
    // 没有时限：每次快落地（下落中低于 40）就再挑一次，连挑 7 秒以上：最后一次多挑的高度和第一次一样（以前过了 5 秒挑空 ×0.3）
    fresh(); J.hit(a, m, { launch: 520 }); { const pk = []; let cur = 0, base = 0, T = 0;
      while (T < 9 && (m.st === 'air' || m.z > 0.5)) { cur = Math.max(cur, m.z); if (m.vz < 0 && m.z < 40) { pk.push(Math.round(cur - base)); base = m.z; cur = 0; J.hit(a, m, { launch: 520 }); } tick(1); T += dt; }
      R.longJ = { T: +T.toFixed(2), gains: pk, lv: m.js ? m.js.lv : 0 }; }
    // B3：直接 applyHit 一个非追击判定打倒地的目标：不托起、不吃追击额度、不重置倒地时间（以前被托起，5 下强制起身 + 无敌）
    fresh(); J.hit(a, m, { launch: 300 }); until(() => m.st === 'down'); tick(6); { const st0 = m.stT, hp0 = m.hp;
      raw({ stun: 0.3, launch: 400 }); const st1 = m.st, z1 = +m.z.toFixed(1); tick(10); const one = { st: st1, z: z1, downHits: m.downHits, stT: +(m.stT - st0).toFixed(2), dmg: hp0 > m.hp };   // 倒地计时接着走（被重置的话 stT 会回到 0 附近）
      for (let i = 0; i < 4; i++) { tick(3); raw({ stun: 0.3 }); } R.rawDown = { ...one, after5: m.st, inv: +m.invul.toFixed(2) };
      R.rawDownT = +until(() => m.st !== 'down').toFixed(2) + 0.1 + 0.2; }   // 自然起身的时间（≈ 倒地时间，没有被延长）
    // B4：一招 6 段的打地技能（同一次出招）：6 段都打得到，中途不强制起身；4 招之后第 5 招才强制起身
    fresh(); J.hit(a, m, { launch: 300 }); until(() => m.st === 'down'); { const segs = []; let getup = false;
      for (let k = 0; k < 5; k++) { a.doAct({ name: 'otg' + k, dur: 3, hits: [] }); const L = [];
        for (let s = 0; s < 6; s++) { until(() => m.st === 'down', 1); const st = m.st; const okHit = hittable(a, m) && canHit(a, m, { downHit: true }) && J.hit(a, m, { downHit: true }); L.push(okHit ? st + '>' + m.st : 'miss:' + m.st); if (m.st === 'getup') { getup = k; break; } tick(4); }
        segs.push(L); a.endAct(); if (getup !== false) break; m.invul = 0; }
      R.otgSegs = segs; R.otgGetup = getup; }
    // B5：扣地打站着的目标 → 砸倒（弹一下再倒地）
    fresh(); raw({ spike: 420, bounce: 0.5, stun: 0.3 }); { const st0 = m.st; let down = false, bounce = 0; for (let i = 0; i < 90; i++) { tick(1); bounce = Math.max(bounce, m.cmb.bounce || 0); if (m.st === 'down') { down = true; break; } } R.slam = { st0, down, bounce }; }
    fresh(); raw({ spike: 420, stun: 0.3 }); R.slamNoBounce = m.st;
    return R;
  });
  console.log('刷图回归', JSON.stringify(reg));
  const rr = reg.rounds;
  ok(rr.every(v => Math.abs(v - rr[0]) <= rr[0] * 0.05), 'B1 起身后马上再挑：每轮最高点一样（以前 111 / 82 / 60 / 44）', rr);
  ok(reg.afterLong >= reg.freshApex * 0.9, 'B2 长浮空连 → 起身 → 站立连 3 秒 → 再挑：满高度（以前 1 像素）', { after: reg.afterLong, fresh: reg.freshApex });
  const G = reg.longJ.gains;
  ok(reg.longJ.T > 7 && G.length >= 6 && G.slice(-2).every(v => v >= G[0] * 0.9), '没有浮空时限：连挑 7 秒以上，最后几次再挑仍然满高度（以前过 5 秒只剩 ×0.3）', reg.longJ);
  ok(reg.rawDown.st === 'down' && reg.rawDown.z === 0 && reg.rawDown.downHits === 0 && reg.rawDown.dmg && reg.rawDown.stT > 0.04 && reg.rawDown.after5 === 'down', 'B3 非追击判定直接打倒地目标：照常扣血，不托起、不吃追击额度、倒地时间不重置，5 下也不强制起身', reg.rawDown);
  ok(reg.rawDownT < 1.3, 'B3 被非追击判定打着的倒地目标按正常倒地时间起身（没有被一直按在地上）', reg.rawDownT);
  const os = reg.otgSegs;
  ok(os.length === 5 && os.slice(0, 4).every(L => L.length === 6 && L.every(x => !x.startsWith('miss') && !x.endsWith('getup'))) && reg.otgGetup === 4, 'B4 多段打地按招算：4 招 × 6 段全部打到，第 5 招才强制起身', { getupAt: reg.otgGetup, segs: os.map(L => L.length) });
  ok(reg.slam.st0 === 'air' && reg.slam.down && reg.slam.bounce >= 1 && reg.slamNoBounce === 'air', 'B5 扣地打站着的目标：砸倒在地并弹一下（以前只有普通硬直）', { slam: reg.slam, noBounce: reg.slamNoBounce });

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
