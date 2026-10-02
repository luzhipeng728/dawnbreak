// 决斗“一定站得起来”（2026-09-30 线上反馈：靠近阿修罗就一直被打在地上站不起来）：逐帧 step()、不渲染
//   asura  玩家（狂战士，只会往前走 + 普攻）走进开着无尽波动的阿修罗 AI，量“倒地后连续躺着的时间”和“连续不能行动的时间”
//   aura   无尽波动的周期伤害打倒地 / 起身无敌中的目标：不再把人托起、不重置倒地时间；倒地时挂上的眩晕不拖延起身；硬控结束后同一种短时间内挂不上
//   all    23 种职业 / 转职的 AI 轮流打一个 AI 对手：倒地最长 ≤ 1.6 秒 + 起身，连续不能行动 ≤ 4 秒（受身蹲伏是自己选择多蹲、无敌，不算被锁）
// 用法：node test/duel_wakeup.mjs [asura,aura,all] ；ALL=每种打几场（默认 2）
import { launch, URL_BASE } from './lib.mjs';
const parts = (process.argv[2] || 'asura,aura,all').split(',');
const { browser, page, logs } = await launch({ width: 640, height: 360 });
await page.goto(`${URL_BASE}?duel=sword&vs=gun&auto&ai=3&mute`);
await page.waitForFunction(() => window.__READY && game.duel, null, { timeout: 60000 });
await page.evaluate(async () => {
  await loadBundles(openClasses().map(c => 'spr:' + c)); game.paused = true; window.toastMsg = () => {};
  // 受害者的计时：躺着（倒地 / 落地后被托起又落下）连续多久、连续不能行动多久（觉醒定格不算）
  window.__W = { mk() { return { down: 0, downMax: 0, lock: 0, lockMax: 0, landT: 0, getups: 0, st0: null, log: [] }; },
    tick(V, M, dt) {
      if (duel.state !== 'fight' || game.timeStop > 0) return;
      const lying = !V.dead && (V.st === 'down' || (V.cmb && V.cmb.landed && V.st === 'air'));
      M.down = lying ? M.down + dt : 0; M.downMax = Math.max(M.downMax, M.down);
      const locked = !V.dead && !(V.free || V.st === 'act' || V.techHold); M.lock = locked ? M.lock + dt : 0; M.lockMax = Math.max(M.lockMax, M.lock);
      if (V.st === 'getup' && M.st0 !== 'getup') M.getups++; M.st0 = V.st;
    } };
});
let fails = 0;
const ok = (c, msg, x) => { if (c) console.log('✓', msg); else { fails++; console.log('✗', msg, x !== undefined ? JSON.stringify(x).slice(0, 700) : ''); } };
const ev = (fn, arg) => page.evaluate(fn, arg);
const LIM = await ev(() => ({ down: PVP_PROT.downMax ?? 99, lock: PVP_PROT.lockMax }));

if (parts.includes('asura')) {
  const r = await ev(() => {
    const out = [];
    for (let k = 0; k < 4; k++) {
      duel.start({ a: 'sword', ja: 'berserker', b: 'sword', jb: 'asura', lv: DUEL_CFG.lv, ai: 3, auto: true, theme: 'ruinsDark' });
      const A = duel.a, B = duel.b; A.brain = null; A.pad = new Pad(); A.control = (e, dt) => { if (duel.state !== 'fight') return; const P = e.pad; P.hold(B.x > e.x ? 'right' : 'left'); if (Math.abs(B.y - e.y) > 6) P.hold(B.y > e.y ? 'down' : 'up'); if (Math.random() < 0.08) P.tap('attack'); P.frame(game.t); playerControl(e, dt); };
      for (let i = 0; i < 200 && duel.state !== 'fight'; i++) step(1 / 60);
      duel.guardT = 0; toggleBuff(B, 'as_aura', 9999, { atk: 0.05, lv: 5, tick: 0 }); B.mp = B.mpMax = 1e6; A.hp = A.hpMax = 1e7;   // 狂战士只量“站不站得起来”，不会被打死
      const M = __W.mk();
      for (let i = 0; i < 60 * 45 && duel.state === 'fight'; i++) { step(1 / 60); __W.tick(A, M, 1 / 60); if (!B.buffs.as_aura) toggleBuff(B, 'as_aura', 9999, { atk: 0.05, lv: 5, tick: 0 }); }
      out.push({ downMax: +M.downMax.toFixed(2), lockMax: +M.lockMax.toFixed(2), getups: M.getups });
    }
    return out;
  });
  const dm = Math.max(...r.map(x => x.downMax)), lm = Math.max(...r.map(x => x.lockMax));
  console.log('  狂战士走进阿修罗（4 局 × 45 秒）：' + JSON.stringify(r));
  ok(dm <= LIM.down + 0.35, `一直往阿修罗身上走：每次倒地最多躺 ${dm} 秒就起身（上限 ${LIM.down} 秒）`, r);
  ok(lm <= LIM.lock + 0.6, `连续不能行动最长 ${lm} 秒（上限 ${LIM.lock} 秒）`, r);
  ok(r.every(x => x.getups >= 1), '每局都能站起来', r);
}

if (parts.includes('aura')) {
  const r = await ev(() => {
    duel.start({ a: 'sword', ja: 'berserker', b: 'sword', jb: 'asura', lv: DUEL_CFG.lv, ai: 3, auto: true, theme: 'ruinsDark' });
    const A = duel.a, B = duel.b; for (const p of [A, B]) { p.brain = null; p.control = () => {}; }
    for (let i = 0; i < 200 && duel.state !== 'fight'; i++) step(1 / 60); duel.guardT = 0;
    A.x = B.x - 60; A.y = B.y; toggleBuff(B, 'as_aura', 9999, { atk: 0.05, lv: 5, tick: 0 }); B.mp = 1e6;
    const out = {};
    // 1) 打倒在地 → 无尽波动每 0.5 秒一跳：不托起、不重置倒地时间，照常起身
    applyHit(B, A, { dmg: 0.2, down: true, knock: 60, sure: true }); for (let i = 0; i < 120 && A.st !== 'down'; i++) step(1 / 60);
    const tDown = game.t; let lifted = 0, z = 0; while (A.st === 'down' && game.t - tDown < 5) { step(1 / 60); if (A.st === 'air') lifted++; z = Math.max(z, A.z); }
    out.down = { lay: +(game.t - tDown).toFixed(2), lifted, z: Math.round(z), st: A.st };
    // 起身无敌中：什么都打不中、挂不上状态
    out.getupInvul = A.st === 'getup' ? { invul: +A.invul.toFixed(2), hit: applyHit(B, A, { dmg: 1, sure: true, stun: 0.5 }), st: (addStatus(A, 'stun', 2), !!(A.status && A.status.stun)) } : null;
    for (let i = 0; i < 120 && !(A.free || A.st === 'act'); i++) step(1 / 60);
    // 2) 倒地时挂上 2 秒眩晕：不拖延起身（起身后不会再被眩晕钉住）
    A.status = {}; A.invul = 0; applyHit(B, A, { dmg: 0.2, down: true, knock: 60, sure: true }); for (let i = 0; i < 120 && A.st !== 'down'; i++) step(1 / 60);
    addStatus(A, 'stun', 2, { src: B }); const t2 = game.t; for (let i = 0; i < 300 && !A.free; i++) step(1 / 60);
    out.stunDown = { freeAfter: +(game.t - t2).toFixed(2), stun: !!(A.status && A.status.stun) };
    // 3) 站着：眩晕封顶 + 结束后同一种 2.5 秒内挂不上
    A.status = {}; A.invul = 0; step(1 / 60); addStatus(A, 'stun', 5, { src: B }); const S1 = (A.status || {}).stun, s1 = S1 ? +S1.t.toFixed(2) : 0, why1 = { st: A.st, invul: A.invul, imm: A.pvpImm, lying: duelLying(A) };
    for (let i = 0; i < 200 && A.status && A.status.stun; i++) step(1 / 60);
    addStatus(A, 'stun', 2, { src: B }); const again = !!(A.status && A.status.stun);
    for (let i = 0; i < 60 * 3; i++) step(1 / 60); A.invul = 0; addStatus(A, 'stun', 1, { src: B }); const later = !!(A.status && A.status.stun);
    out.stunCap = { first: s1, again, later, cap: PVP_CTRL.cap.stun, why1 };
    return out;
  });
  ok(r.down.lifted === 0 && r.down.lay <= LIM.down + 0.2, `无尽波动打倒地的人：不再托起（${r.down.lifted} 帧）、${r.down.lay} 秒后起身`, r.down);
  ok(r.getupInvul && r.getupInvul.invul > 0.3 && r.getupInvul.hit === false && !r.getupInvul.st, '起身无敌中：打不中、挂不上状态', r.getupInvul);
  ok(r.stunDown.freeAfter <= LIM.down + 1.0 && !r.stunDown.stun, `倒地时挂的眩晕不拖延起身（${r.stunDown.freeAfter} 秒后能行动）`, r.stunDown);
  ok(r.stunCap.first <= r.stunCap.cap + 0.01 && !r.stunCap.again && r.stunCap.later, `硬控封顶 ${r.stunCap.cap} 秒，结束后同一种短时间内挂不上、过后又能挂`, r.stunCap);
}

if (parts.includes('all')) {
  const N = +(process.env.ALL || 2);
  const r = await ev(N => {
    const combos = openClasses().flatMap(c => [c + ':', ...openJobs(c).map(j => c + ':' + j)]), vict = ['sword:berserker', 'gun:ranger', 'mage:elemental', 'fighter:grappler'], out = {};
    for (const a of combos) {
      const M = __W.mk();
      for (let k = 0; k < N; k++) {
        const [ca, ja] = a.split(':'), [cv, jv] = vict[k % vict.length].split(':');
        duel.start({ a: ca, ja: ja || null, b: cv, jb: jv || null, lv: DUEL_CFG.lv, ai: 3, auto: true, theme: 'ruinsDark' });
        const V = duel.b; V.hp = V.hpMax = 1e7;   // 受害者不死，量满一整局
        for (let i = 0; i < 60 * 50 && duel.state !== 'result' && duel.state !== 'done'; i++) { step(1 / 60); __W.tick(V, M, 1 / 60); }
        duel.roundLog = [];
      }
      out[a] = { down: +M.downMax.toFixed(2), lock: +M.lockMax.toFixed(2) };
    }
    return out;
  }, N);
  const worstD = Object.entries(r).sort((x, y) => y[1].down - x[1].down).slice(0, 4), worstL = Object.entries(r).sort((x, y) => y[1].lock - x[1].lock).slice(0, 4);
  console.log('  躺得最久：' + worstD.map(([k, v]) => `${k} ${v.down}s`).join('、') + '；连续不能行动最久：' + worstL.map(([k, v]) => `${k} ${v.lock}s`).join('、'));
  ok(worstD[0][1].down <= LIM.down + 0.35, `23 种职业的 AI 打人：倒地最多躺 ${worstD[0][1].down} 秒就起身`, r);
  ok(worstL[0][1].lock <= 4.2, `23 种职业的 AI 打人：连续不能行动最长 ${worstL[0][1].lock} 秒（≤ 4 秒）`, r);
}

const errs = logs.filter(l => l.type === 'pageerror');
ok(!errs.length, '没有页面报错', errs.slice(0, 3));
await browser.close();
console.log(fails ? `\n${fails} 项失败` : '\n全部通过');
process.exit(fails ? 1 : 0);
