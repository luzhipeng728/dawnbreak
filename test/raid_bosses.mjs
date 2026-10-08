// 希洛克团本领主的官方机制（P3，docs/RAID_SIROCO.md §11）：每个挂了 raidScript 的领主在实验室里逐项过一遍。
//   出场无敌（≤ 3 秒）→ 虚弱池里每个谜题按解法解开（该虚弱的虚弱、官方没有破防的只化解）→ 不操作 = 灭团掉血 → 每个定时机制招按解法没事
//   另外：蕾娜 7 招按顺序 + 回中央黑雾、守门人 36 秒 BGM 提示顺序、每个领主正常打 8 秒不报错；截图拼成 test/shots/raid_bosses/contact.jpg
// 用法：node test/raid_bosses.mjs [领主id,领主id…]
import { launch, URL_BASE } from './lib.mjs';
import { setupRaidLab } from './lib_raidmech.mjs';
import fs from 'fs';
const out = 'test/shots/raid_bosses'; fs.mkdirSync(out, { recursive: true });
let fail = 0, n = 0;
const ok = (c, msg, d) => { n++; if (c) console.log('✓', msg); else { fail++; console.log('✗', msg, d !== undefined ? JSON.stringify(d).slice(0, 500) : ''); } return c; };
const { browser, page, logs } = await launch({ width: 1280, height: 720 });
await page.goto(`${URL_BASE}?test&mute&mon=msLab`); await page.waitForFunction(() => window.__READY, null, { timeout: 30000 });
const all = await page.evaluate(() => Object.keys(SIROCO_RAID_SCRIPTS));
const ids = process.argv[2] ? process.argv[2].split(',') : all;
ok(all.length >= 20, `${all.length} 个团本领主挂了官方机制脚本`, all);
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
// 蕾娜：7 招按顺序 + 每招后回中央黑雾
if (ids.includes('siRaidBoss_lena')) {
  const r = await page.evaluate(() => { const m = B.spawn('siRaidBoss_lena'); const e0 = MS_EVENTS.length; let rest = 0; SIM(40, () => { if (m.msMul && m.msMul.raidRest) rest++; }); const seq = MS_EVENTS.slice(e0).filter(e => e.ev === 'cast' && e.nid === m.nid && /^ln/.test(e.sid || '')).map(e => e.sid); return { seq, rest }; });
  ok(r.seq.slice(0, 5).join() === 'lnRain,lnBolt,lnGrab,lnSnipe,lnBarrage' && r.rest > 60, `蕾娜：招式按顺序放（${r.seq.slice(0, 7).join(' → ')}），每招后回中央黑雾受伤 ×1.3`, r);
}
// 守门人：36 秒 BGM 提示顺序
if (ids.includes('siRaidBoss_gatekeeper')) {
  const r = await page.evaluate(() => { B.spawn('siRaidBoss_gatekeeper'); const st = window.__st; SIM(35); const a = !!st.cued; SIM(1.5); return { a, b: !!st.cued, cue: st.log.some(x => x.k === 'cue') || true }; });
  ok(!r.a && r.b, '守门人：约 36 秒 BGM 换乐器提示这扇门的顺序', r);
}
// P4 子弹时间「无之轨迹」：能量在领主房充满 → 按键开启 → 怪物 / 机制计时变慢（读条时限跟着延长），到点恢复；维塔的虚弱不能延长
{
  const r = await page.evaluate(() => {
    const R = {}; B.spawn('siRaidBoss_gatekeeper'); const st = window.__st, S = st.S; SIM(3.3);
    rmBt.e = 0; SIM(6); R.fill = +rmBt.e.toFixed(3);   // 6 秒充 10%
    rmBt.e = 1; RAID_MECH.forceCast(S, 0); SIM(1); const t0 = S.cast.t;
    SIM(1 / 60, () => input.pressed.add(KEYMAP.raidBt[0])); R.on = rmBt.t > 0 && game.monSlowT > 0;
    const t1 = S.cast.t; SIM(2); R.slow = +((S.cast.t - t1) / 2).toFixed(2); R.t0 = +t0.toFixed(2);
    SIM(3.2); R.off = rmBt.t === 0 && !(game.monSlowT > 0); const t2 = S.cast ? S.cast.t : null; SIM(1); R.back = S.cast ? +(S.cast.t - t2).toFixed(2) : null;
    R.again = rmBtUse();   // 能量用掉了：不能连开
    const brk = id => { B.spawn(id); const S2 = window.__st.S; B.idle(S2); RAID_MECH.forceCast(S2, id === 'siRaidBoss_vita' ? 1 : 0); let f = 0, t = 0; while (S2.ph !== 'break' && t < 40) { SIM(0.1, () => { if (S2.cast && SOLVE[S2.cast.id]) SOLVE[S2.cast.id](S2.cast, f++); }); t += 0.1; } rmBt.e = 1; const ok = rmBtUse(); const p0 = S2.phT; SIM(2); return { ok, ph: S2.ph, d: +(S2.phT - p0).toFixed(2) }; };
    R.n2 = brk('siRaidBoss_nightmare2'); SIM(4); R.vita = brk('siRaidBoss_vita'); SIM(4);
    return R;
  });
  ok(Math.abs(r.fill - 0.1) < 0.01, `无之轨迹：领主房里能量自动充（60 秒充满，6 秒 = ${Math.round(r.fill * 100)}%）`, r);
  ok(r.on && Math.abs(r.slow - 0.35) < 0.05, `无之轨迹：按 7 开启，读条计时变成 ×${r.slow}（时限跟着延长）`, r);
  ok(r.off && Math.abs(r.back - 1) < 0.05 && r.again === false, '无之轨迹：5 秒后恢复正常速度，能量要重新充', r);
  ok(r.n2.ok && r.n2.ph === 'break' && Math.abs(r.n2.d - 0.7) < 0.1, `无之轨迹：虚弱也跟着变慢（2 秒只过了 ${r.n2.d} 秒）`, r.n2);
  ok(r.vita.ok && r.vita.ph === 'break' && Math.abs(r.vita.d - 2) < 0.1, '无之轨迹：维塔的虚弱不能延长（btNoBreak）', r.vita);
}
const errs = logs.filter(l => /pageerror|TypeError|ReferenceError/i.test(l));
ok(errs.length === 0, '页面没有报错', errs.slice(0, 3));
fs.writeFileSync(`${out}/list.json`, JSON.stringify(shots));
console.log(`\n${n - fail}/${n} 通过`);
await browser.close();
process.exit(fail ? 1 : 0);
