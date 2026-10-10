// 安徒恩团本领主 / 精英逐个测试（浏览器）：领主 = 出场无敌 → 虚弱池逐项按解法解开 → 不操作 = 灭团 → 定时机制招按解法没事 → AI 开着正常打；
//   精英 = 6 种破防条件按条件解开（普通 + 引导变体：机制球 4→2 等）+ 精英挂到怪身上跑 6 秒不报错；内尔贝电球数 / 玛特伽机制球随人数 / 模式变化；每个地下城能进（图 / 精英 / 领主都登记了）
// 用法：node test/anton_bosses.mjs [领主id,…]
import { launch, URL_BASE } from './lib.mjs';
import { setupRaidLab } from './lib_raidmech.mjs';
import fs from 'fs';
const out = 'test/shots/anton_bosses'; fs.mkdirSync(out, { recursive: true });
let fail = 0, n = 0;
const ok = (c, msg, d) => { n++; if (c) console.log('✓', msg); else { fail++; console.log('✗', msg, d !== undefined ? JSON.stringify(d).slice(0, 500) : ''); } return c; };
const { browser, page, logs } = await launch({ width: 1280, height: 720 });
await page.goto(`${URL_BASE}?test&mute&mon=msLab`); await page.waitForFunction(() => window.__READY, null, { timeout: 30000 });
const all = await page.evaluate(() => Object.keys(ANTON_RAID_SCRIPTS));
const ids = process.argv[2] ? process.argv[2].split(',') : all;
ok(all.length === 14, `${all.length} 个安徒恩领主挂了机制脚本`, all);
await page.evaluate(async ids => { await loadBundles(monBundles(['msLab', ...ids])); }, ids);
await setupRaidLab(page);
await page.evaluate(() => {
  window.B = {
    spawn(kind, ai = false) { T.clear(); T.put(300); const m = window.__m = spawnMonster(kind, 900, 100, { lvl: 64, boss: true }); m.z = 0; m.setState('idle'); if (!ai) { const c = m.control; m.control = (e, dt) => { e.aiCd = 99; if (c) c(e, dt); }; } window.__st = rmScriptOf(m); return m; },
    // 跑一个读条 / 机制招直到结束：solve = 按解法操作
    // 等当前读条 / 虚弱结束（按解法），好强制下一个
    idle(S) { let f = 0, t = 0; while ((S.cast || S.ph === 'break' || S.ph === 'intro') && t < 80) { SIM(0.5, () => { if (S.cast && SOLVE[S.cast.id]) SOLVE[S.cast.id](S.cast, f++); }); t += 0.5; } T.put(300); },
    run(S, solve, sec = 45) { let f = 0; SIM(sec, () => { const c = S.cast || S.side[0]; if (c && solve && SOLVE[c.id]) SOLVE[c.id](c, f++); }); },
  };
});
const shots = [];
for (const id of ids) {
  const r = await page.evaluate(id => {
    const R = { id }, m = B.spawn(id), st = window.__st; if (!st) return { id, err: '没有 raidScript' };
    const S = st.S, spec = S.spec;
    SIM(0.3); R.intro = { dur: spec.intro.dur, inv: m.invul > 0, ph: S.ph };
    SIM(spec.intro.dur + 0.2); R.fight = S.ph;
    // 虚弱池：每个谜题解一次
    R.pool = [];
    for (let i = 0; i < ((spec.weak && spec.weak.pool) || []).length; i++) {
      const L0 = st.log.length, e = spec.weak.pool[i], brkDur = (e.onSolve && e.onSolve.dur != null ? e.onSolve.dur : spec.onSolve.dur);
      B.idle(S); R.forced = (R.forced || []).concat(RAID_MECH.forceCast(S, i)); B.run(S, true, (e.dur || 30) + 4);
      const log = st.log.slice(L0).map(x => x.k);
      R.pool.push({ i, use: e.use, name: e.name, solve: log.includes('solve'), fail: log.includes('fail'), brk: log.includes('break'), wantBrk: brkDur > 0 });
      SIM((brkDur || 0) + 0.5);
    }
    // 不操作 = 失败（灭团 / 强制苏醒掉血）
    if (spec.weak && spec.weak.pool) {
      const p = game.player; window.__keepOn = false; p.hp = p.hpMax; p.invul = 0; p.status = {}; B.idle(S); T.put(760); p.hp = p.hpMax; p.invul = 0; p.status = {}; p.raidCrouch = false; const L0 = st.log.length;
      R.forced0 = RAID_MECH.forceCast(S, 0); B.run(S, false, (spec.weak.pool[0].dur || 30) + 4);
      R.wipe = { forced: R.forced0, ph: S.ph, log: st.log.slice(L0).map(x => x.k).filter(k => k === 'fail' || k === 'wipe').join(), lost: +(1 - p.hp / p.hpMax).toFixed(2) };
      window.__keepOn = true; T.clear(); T.put(300);
    }
    // 定时机制招：按解法没事
    R.atk = [];
    for (let i = 0; i < (spec.atk || []).length; i++) {
      const p = game.player; window.__keepOn = false; p.hp = p.hpMax; p.invul = 0; p.status = {}; p.raidCrouch = false; T.put(300);
      B.spawn(id); SIM(spec.intro.dur + 0.2);
      const S2 = window.__st.S; S2.side.length = 0; RAID_MECH.forceAtk(S2, i); const s = S2.side[S2.side.length - 1], A = spec.atk[i].puzzle;
      let f = 0, t = 0; while (!s.res && t < (A.dur || 12) + 2) { SIM(0.1, () => { if (!s.res && SOLVE[s.id]) SOLVE[s.id](s, f++); }); t += 0.1; }   // 只看这一次（之后定时器自己再放的不算）
      R.atk.push({ i, use: A.use, name: A.name, lost: +(1 - p.hp / p.hpMax).toFixed(2), res: s.res || null });
      window.__keepOn = true; p.raidCrouch = false; T.clear();
    }
    return R;
  }, id);
  if (r.err) { ok(false, `${id}：${r.err}`); continue; }
  ok(r.intro.inv && r.intro.ph === 'intro' && r.intro.dur <= 3 && /fight|cast/.test(r.fight), `${id}：出场无敌 ${r.intro.dur} 秒（≤ 3）→ 开打`, r.intro);
  for (const q of r.pool) ok(q.solve && !q.fail && q.brk === q.wantBrk, `${id}：虚弱池「${q.name}」（${q.use}）按解法解开${q.wantBrk ? ' → 虚弱' : '（官方没有破防：只化解）'}`, q);
  if (r.wipe) ok(/fail/.test(r.wipe.log) && r.wipe.lost >= 0.25, `${id}：不操作 → 失败，掉了 ${Math.round(r.wipe.lost * 100)}% 血`, r.wipe);
  for (const q of r.atk) ok(q.res === 'solve' && (q.use === 'gauge' ? q.lost < 0.4 : q.lost === 0), `${id}：定时机制招「${q.name}」（${q.use}）按解法没事`, q);
  // 正常打 8 秒（AI 开着、脚本照常），中途截一张
  const e = await page.evaluate(id => { const m = B.spawn(id, true); window.__keepOn = true; let err = null; try { SIM(5); if (window.__st.S.spec.weak && window.__st.S.spec.weak.pool) RAID_MECH.forceCast(window.__st.S, 0); else if ((window.__st.S.spec.atk || []).length) RAID_MECH.forceAtk(window.__st.S, 0); SIM(1.5); } catch (x) { err = String(x.stack).slice(0, 300); } game.paused = false; return { err, dead: m.dead }; }, id);
  await page.waitForTimeout(150); await page.screenshot({ path: `${out}/${id}.png` }); shots.push(`${out}/${id}.png`); await page.evaluate(() => { game.paused = true; });
  ok(!e.err, `${id}：AI 开着正常打 + 读条，不报错`, e);
}

// ---- 精英：逐个 ----
{
  const ELITES = ['devour', 'egale', 'ioliOrb', 'freinesClone', 'agnesEye', 'worm', 'meltha', 'atol', 'wraith'];
  const TYPE = { devour: 'elemBall', egale: 'elemBall', ioliOrb: 'intercept', freinesClone: 'killClone', agnesEye: 'eyeGuard', worm: 'breakShell', meltha: 'intercept', atol: 'counterBreak', wraith: 'killClone' };
  const r = await page.evaluate(({ ELITES, TYPE }) => {
    const out = {}, X = RAID_ELITE, run = (E, sec, dt = 0.25) => { const o = []; for (let t = 0; t < sec - 1e-9; t += dt) o.push(...X.tick(E, dt)); return o; };
    const kinds = (o, k, w) => o.filter(x => x.k === k && (!w || x.what === w));
    // 通用解法：看当前类型需要什么，按条件做，直到 break（上限 120 秒）
    const solve = E => {
      let broke = false, t = 0;
      while (!broke && t < 120) {
        const o = run(E, 1); t++;
        if (E.type === 'elemBall') for (const s of kinds(o, 'spawn', 'ball')) if (kinds(X.on(E, { k: 'ball', i: s.i }), 'break').length) broke = true;
        if (E.type === 'intercept') for (const s of kinds(o, 'spawn', 'orb')) if (kinds(X.on(E, { k: 'intercept', i: s.i }), 'break').length) broke = true;
        if (E.type === 'killClone') { const cl = kinds(o, 'spawn', 'clone'); for (const s of cl) if (kinds(X.on(E, { k: 'cloneDead', i: s.i }), 'break').length) broke = true; }
        if (E.type === 'breakShell') { for (const s of E.objs.slice()) if (s.what === 'shell' && kinds(X.on(E, { k: 'shellBroken', i: s.i }), 'break').length) broke = true; }
        if (E.type === 'eyeGuard') { for (const s of E.objs.slice()) if (s.what === 'clone' && kinds(X.on(E, { k: 'cloneDead', i: s.i }), 'break').length) broke = true; }
        if (E.type === 'counterBreak') { if (E.wind && E.wt >= E.p.flashAt && E.wt <= E.p.flashAt + E.p.flashLen) { if (kinds(X.on(E, { k: 'hit' }), 'break').length) broke = true; } }
      }
      return broke ? t : -1;
    };
    for (const id of ELITES) {
      const sp = RAID_ELITES[id]; if (!sp) { out[id] = { err: '没登记' }; continue; }
      const R = { type: sp.type, mon: !!MON[sp.mon], eliteMon: MON[sp.mon] && MON[sp.mon].name };
      for (const g of [false, true]) {
        raidNet.S = g ? { graph: 'guide', members: [{ uid: 1 }] } : { graph: 'normal', members: [{ uid: 1 }, { uid: 2 }, { uid: 3 }, { uid: 4 }] };
        const E = X.create(RAID_ELITES[id]); R[g ? 'g' : 'n'] = { p: JSON.stringify(E.p), t: solve(E), mul: X.mul(E) };
      }
      raidNet.S = null; out[id] = R;
    }
    // 不处理 = 惩罚 / 回血（以 killClone 为例）
    const E = X.create(RAID_ELITES.freinesClone); const o = run(E, 40); out.__pun = { punish: kinds(o, 'punish').length };
    // 数量随人数 / 模式
    raidNet.S = { graph: 'normal', members: Array.from({ length: 8 }, (_, i) => ({ uid: i })) }; out.__n8 = anOrbN(); raidNet.S = { graph: 'normal', members: [{ uid: 1 }, { uid: 2 }] }; out.__n2 = anOrbN();
    raidNet.S = { graph: 'guide', members: [{ uid: 1 }] }; out.__ng = anOrbN(); out.__ballG = anBallN(); raidNet.S = { graph: 'normal', members: [{ uid: 1 }, { uid: 2 }] }; out.__ballN = anBallN(); raidNet.S = null;
    const pz = ANTON_RAID_SCRIPTS.anBoss_nelbe.atk[0].puzzle; raidNet.S = { graph: 'guide', members: [{ uid: 1 }] }; out.__pzG = { ...pz }.n; raidNet.S = { graph: 'normal', members: Array.from({ length: 6 }, (_, i) => ({ uid: i })) }; out.__pzN = { ...pz }.n; raidNet.S = null;
    return out;
  }, { ELITES, TYPE });
  for (const id of ELITES) {
    const q = r[id]; if (q.err) { ok(false, `精英 ${id}：${q.err}`); continue; }
    ok(q.type === TYPE[id] && q.mon, `精英 ${id}（${q.eliteMon}）：破防条件 ${q.type}，专属怪已登记`, q);
    ok(q.n.t > 0 && q.n.mul > 1, `精英 ${id}：普通版按条件能破防（${q.n.t} 秒内）`, q.n);
    ok(q.g.t > 0, `精英 ${id}：引导版能破防（${q.g.t} 秒内），参数削弱`, q.g);
    ok(q.n.p !== q.g.p, `精英 ${id}：引导版参数与普通版不同（削弱）`, [q.n.p, q.g.p]);
  }
  ok(r.__pun.punish >= 1, '精英不处理 → 惩罚（击杀分身读条结束）', r.__pun);
  ok(r.__n2 === 3 && r.__n8 === 4 && r.__ng === 2, `内尔贝电球数与人数挂钩（2 人 ${r.__n2} / 8 人 ${r.__n8} / 引导 ${r.__ng}）`, r);
  ok(r.__ballN === 4 && r.__ballG === 2, `玛特伽「打字」机制球：普通 ${r.__ballN} → 引导 ${r.__ballG}`, r);
  ok(r.__pzG === 2 && r.__pzN === 3, '领主脚本里的 getter 实例化时才取值（引导 2 / 6 人 3）', r);
  // 精英挂到怪身上跑一会儿不报错
  const e = await page.evaluate(async () => {
    await loadBundles(monBundles(['anElite_devour', 'anElite_worm', 'anElite_wraith', 'anElite_agnes']));
    const errs = [];
    for (const [mon, spec] of [['anElite_devour', 'devour'], ['anElite_worm', 'worm'], ['anElite_wraith', 'wraith'], ['anElite_agnes', 'agnesEye']]) {
      try { T.clear(); T.put(300); const m = spawnMonster(mon, 900, 100, { lvl: 60, elite: true }); const E = raidEliteAttach(m, spec, {}); SIM(12); if (!E) errs.push(spec + ' attach 返回空'); } catch (x) { errs.push(spec + ':' + (x.message || x)); }
    }
    return errs;
  });
  ok(e.length === 0, '精英挂到怪身上（刷物件 / HUD / 破防）跑 12 秒不报错', e);
}
// ---- 地下城：每张图的结构 / 精英 / 领主都登记了 ----
{
  const r = await page.evaluate(() => {
    const bad = [], list = Object.values(DUNGEONS).filter(d => /^raid_an_/.test(d.id));
    for (const d of list) {
      if (!d.raid) bad.push(d.id + ' 没有 raid:true'); if (!MON[d.boss.kind]) bad.push(d.id + ' 领主没登记 ' + d.boss.kind);
      for (const rm of (d.fixed && d.fixed.rooms) || []) if (rm.type === 'elite') { if (!MON[rm.elite]) bad.push(d.id + ' 精英怪没登记 ' + rm.elite); if (!RAID_ELITES[rm.eliteSpec]) bad.push(d.id + ' 破防条件没登记 ' + rm.eliteSpec); }
    }
    const dgs = new Set(); for (const P of RAID_DEFS.anton.phases) for (const nd of Object.values(P.nodes)) { dgs.add(nd.dg); if (!DUNGEONS[nd.dg]) bad.push('节点 dg 不存在 ' + nd.dg); }
    return { n: list.length, bad, nodesDg: dgs.size, gear: ANTON_RAID_GEAR.length };
  });
  ok(r.n === 17 && !r.bad.length, `${r.n} 张安徒恩节点地下城：领主 / 精英 / 破防条件都登记了，节点 dg 都存在`, r);
  ok(r.gear === 12, '融合装备 12 件已注册', r);
}
const errs = logs.filter(l => /pageerror|TypeError|ReferenceError/i.test(l));
ok(errs.length === 0, '页面没有报错', errs.slice(0, 3));
fs.writeFileSync(`${out}/list.json`, JSON.stringify(shots));
console.log(`\n${n - fail}/${n} 通过`);
await browser.close();
process.exit(fail ? 1 : 0);
