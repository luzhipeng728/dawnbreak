// 联机卡顿排查（docs/PERF.md）：本地服务端 + 2 个真实客户端组队进 Lv60 地下城，满级转职 / 三觉 / 最强史诗 + 武器 +13~16，
// 队长把房间一直补满怪，两边机器人正常速度一起打；统计每个页面的帧率（平均 / 1% low / 最长帧）、逻辑 / 世界层 / 界面层耗时、长任务、
// 每类 WS 消息的条数和字节（发 / 收，按 t 和房间转发里的 d.k 分）、快照大小；PROF=1 时对队长页面做 CPU 采样，列出自身耗时最多的函数。
// 用法：node test/mp_perf.mjs [秒=12]
//   环境变量：CPU=4（CPU 降速倍数）GPU=metal（真实 GPU，默认无头默认值）MOBS=20（房间里保持的怪数）DG=law_gate
//             JOBS=sword:berserker:16,mage:elemental:13（职业:转职:武器强化，最多 4 个）TOWN=elvenguard（改测城镇：所有人进这个场景来回走）PROF=1 BREAK=1（世界层分项耗时）STATIC=<dist/web 目录>LAG=80（下行延迟）OUT=文件（结果 JSON）
import fs from 'node:fs';
import { startServer, ok, result, sleep, until, uiRegister, uiCreateChar, dumpErrors } from './net_lib.mjs';
import { chromium } from './lib.mjs';
const SECS = +(process.argv[2] || 12), CPU = +(process.env.CPU || 1), MOBS = +(process.env.MOBS || 20), DG = process.env.DG || 'law_gate', TOWN = process.env.TOWN || '';
const JOBS = (process.env.JOBS || 'sword:berserker:16,mage:elemental:13').split(',').map(s => { const [cls, job, enh] = s.split(':'); return { cls, job, enh: +enh || 13 }; });
const N = JOBS.length, CLS_IDX = { sword: 0, gun: 1, mage: 2 };
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const args = ['--autoplay-policy=no-user-gesture-required', '--ignore-gpu-blocklist', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'];
if (process.env.GPU === 'metal') args.push('--use-angle=metal', '--enable-gpu');
const srv = await startServer(process.env.STATIC ? { static: process.env.STATIC } : {});   // STATIC=目录：测另一份构建（改前 / 改后对照）
const browser = await chromium.launch({ headless: true, executablePath: CHROME, args });
const players = [];
// 页面里的 WS 统计：包住 WebSocket（发 / 收都按 t、房间转发按 r:<k> 记条数 / 字节 / 最大一条）
const NET_HOOK = () => {
  const S = window.__ns = { on: false, t0: 0, out: {}, in: {} }, enc = new TextEncoder();
  const rec = (dir, data) => {
    if (!S.on || typeof data !== 'string') return null;
    let k = '?'; try { const m = JSON.parse(data); k = m.t === 'r' && m.d ? 'r:' + m.d.k : m.t; } catch (e) { /* 非 JSON */ }
    const b = enc.encode(data).length, R = S[dir][k] || (S[dir][k] = { n: 0, b: 0, max: 0, ms: 0, msMax: 0 }); R.n++; R.b += b; if (b > R.max) R.max = b;
    return R;
  };
  const WS = window.WebSocket, send0 = WS.prototype.send;
  WS.prototype.send = function (d) { rec('out', d); return send0.call(this, d); };
  // 收到的消息：连同客户端处理耗时（net.js 的 onmessage）一起记
  window.WebSocket = function (u, p) { const ws = p ? new WS(u, p) : new WS(u); let h = null;
    Object.defineProperty(ws, 'onmessage', { get: () => h, set: fn => { h = fn; } });
    ws.addEventListener('message', ev => { const R = rec('in', ev.data), t = performance.now(); if (h) h.call(ws, ev); if (R) { const d = performance.now() - t; R.ms += d; if (d > R.msMax) R.msMax = d; S.frameMs = (S.frameMs || 0) + d; } });
    return ws; };
  Object.assign(window.WebSocket, { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 }); window.WebSocket.prototype = WS.prototype;
};
for (let i = 0; i < N; i++) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  await ctx.addInitScript(NET_HOOK);
  const page = await ctx.newPage(), logs = [];
  page.on('console', m => { if (m.type() === 'error') logs.push({ type: 'error', text: m.text() }); });
  page.on('pageerror', e => logs.push({ type: 'pageerror', text: e.message + '\n' + (e.stack || '') }));
  players.push({ i, ctx, page, logs });
}
const pages = players.map(p => p.page), [A] = pages, names = ['alice', 'bob', 'carol', 'dave'].slice(0, N);
// 满级角色：Lv60、三觉、转职、技能学满、每个部位挑最强（同 tools/admin/maxout.mjs 的打分）、全身 +12、武器 +enh
const MAX_CHAR = async ({ job, enh }) => {
  window.toastMsg = () => {};
  const p = game.player, cls = p.cls; game.lvl = 60; game.exp = 0;
  const fl = save.data.flags ??= {}; fl.awaken = fl.awaken2 = fl.awaken3 = true;
  const d = qdata(); for (const id in QUESTS) { const q = QUESTS[id]; if (q.type === 'daily' || (q.cls && q.cls !== cls)) continue; d.questDone[id] = Date.now(); delete d.quests[id]; }
  if (!game.job && !doJobChange(job)) return 'job change failed';
  game.sp = 1e6; for (let pass = 0; pass < 12; pass++) { let n = 0; for (const id in SKILLS) while (!skillUpBlock(id)) { skillUp(id); if (++n > 5000) break; } if (!n) break; } game.sp = 0;
  const actives = Object.keys(game.skillLv).filter(id => game.skillLv[id] > 0 && SKILLS[id] && !SKILLS[id].passive);
  const aw = actives.filter(id => SKILLS[id].awaken), rest = actives.filter(id => !SKILLS[id].awaken).sort((a, b) => (SKILLS[b].job ? 1000 : 0) + (SKILLS[b].lvReq || 0) - (SKILLS[a].job ? 1000 : 0) - (SKILLS[a].lvReq || 0));
  const Nb = game.skillBar.length; game.skillBar = rest.slice(0, Nb - aw.length).concat(Array(Nb).fill(null)).slice(0, Nb - aw.length).concat(aw).slice(0, Nb);
  const type = mainDmgType(p), GEAR = SLOTS.filter(s => !s.startsWith('av_'));
  const mk = k => { const it = makeItem(k, 1); if (!it) return null; if (!ITEMS[k].noEnhance && it.slot !== 'title') it.enh = 12; normalizeItem(it); if (it.durMax) it.dur = it.durMax; return it; };
  const cand = {}; for (const s of GEAR) cand[s] = [];
  for (const k in ITEMS) { const D = ITEMS[k]; if (D.kind !== 'equip' || !GEAR.includes(D.slot) || (D.lvl || 1) > 60 || (D.rar || 0) < 4) continue; if (D.set && SETS[D.set] && SETS[D.set].job && SETS[D.set].job !== game.job) continue;
    const it = mk(k); if (!it || (it.slot === 'weapon' && it.cls && it.cls !== cls) || !inv.canWear(it, true)) continue; cand[it.slot].push(it); }
  const score = () => { const m = gearMetrics(p, type); return m.off * Math.pow(m.ehp, 0.2); };
  for (const s of GEAR) delete inv.equip[s];
  let best = score();
  for (let pass = 0; pass < 3; pass++) { let ch = false;
    for (const s of GEAR) for (const it of cand[s]) { const prev = inv.equip[s]; inv.equip[s] = it; const v = score(); if (v > best * 1.0001) { best = v; ch = true; } else if (prev) inv.equip[s] = prev; else delete inv.equip[s]; }
    for (const sid in SETS) { const pcs = SETS[sid].pieces.map(k => GEAR.map(s => cand[s].find(x => x.key === k)).find(Boolean)).filter(Boolean); if (pcs.length < 2) continue;
      const prev = {}; for (const it of pcs) prev[it.slot] = inv.equip[it.slot]; for (const it of pcs) inv.equip[it.slot] = it;
      const v = score(); if (v > best * 1.0001) { best = v; ch = true; } else for (const s in prev) { if (prev[s]) inv.equip[s] = prev[s]; else delete inv.equip[s]; } }
    if (!ch) break; }
  if (inv.equip.weapon) inv.equip.weapon.enh = enh;
  inv.add(makeConsumable('hpM', 20)); inv.add(makeConsumable('mpM', 20)); inv.quick = ['hpM', 'mpM', null, null, null, null];
  save.data.fatigue = FATIGUE_MAX; recalcStats(p); p.hp = p.hpMax; p.mp = p.mpMax; save.write();
  netTown.hello(true);
  return { job: game.job, lvl: game.lvl, sets: (p.gearSets || p.sets || []).length, procs: (p.gearProcs || []).length, wpn: inv.equip.weapon && inv.equip.weapon.name + '+' + inv.equip.weapon.enh, bar: game.skillBar.filter(Boolean).length };
};
// 测量窗口：rAF 间隔、step / renderWorld / ui.draw 耗时、长任务、实体 / 特效峰值；WS 统计清零后开始记
const MEASURE = async ({ secs, brk }) => {
  const T = { step: [], world: [], ui: [], iv: [], lt: [] };
  // BREAK=1：世界层各部分的耗时（毫秒 / 帧）；实体按“直接画 / 受击闪白·霸体离屏合成”分开
  const B = {}, undo = [], tm = (k, f) => function (...a) { const t = performance.now(); try { return f.apply(this, a); } finally { const d = performance.now() - t; B[k] = (B[k] || 0) + d; FR[k] = (FR[k] || 0) + d; } };
  let FR = {}; const slow = [];   // 每帧的分项（慢帧 > 33ms 时记下来）
  if (brk) {
    for (const n of ['drawRoomBack', 'drawRoomFore', 'drawGroundFx', 'drawNumbers', 'drawStatus', 'drawDropShadows', 'drawProjShadows', 'drawBlind']) if (typeof window[n] === 'function') { const f = window[n]; window[n] = tm(n, f); undo.push(() => { window[n] = f; }); }
    const d0 = Ent.prototype.draw; Ent.prototype.draw = function (c) { const k = (this.flash > 0 || (!this.dead && hasSA(this))) ? 'ent:flash/sa' : 'ent:plain'; return tm(k, d0).call(this, c); }; undo.push(() => { Ent.prototype.draw = d0; });
    const s0 = Ent.prototype.drawShadow; Ent.prototype.drawShadow = tm('ent:shadow', s0); undo.push(() => { Ent.prototype.drawShadow = s0; });
    const a0 = window.addFx; window.addFx = f => { if (f && f.draw) f.draw = tm('fx', f.draw); return a0(f); }; undo.push(() => { window.addFx = a0; });
    for (const d of drops) if (d.draw) d.draw = tm('drops', d.draw);
  }
  const s0 = window.step, r0 = window.renderWorld, u0 = ui.draw;
  window.step = dt => { const t = performance.now(); s0(dt); const d = performance.now() - t; T.step.push(d); FR.step = (FR.step || 0) + d; };
  window.renderWorld = () => { const t = performance.now(); r0(); const d = performance.now() - t; T.world.push(d); FR.world = d; };
  ui.draw = function () { const t = performance.now(); u0.call(this); const d = performance.now() - t; T.ui.push(d); FR.ui = d; };
  const po = new PerformanceObserver(l => { for (const e of l.getEntries()) T.lt.push(e.duration); }); try { po.observe({ type: 'longtask' }); } catch (e) { /* 不支持 */ }
  const ns = window.__ns; ns.out = {}; ns.in = {}; ns.on = true; const t0 = performance.now();
  const peak = { ents: 0, mon: 0, fx: 0, projs: 0, ground: 0, drops: 0, nums: 0 };
  let last = t0;
  await new Promise(res => { const f = now => { T.iv.push(now - last); if (now - last > 33.4 && T.iv.length > 3) { const o = { iv: +(now - last).toFixed(1), msg: +(ns.frameMs || 0).toFixed(1) }; for (const k in FR) o[k] = +FR[k].toFixed(1); slow.push(o); } FR = {}; ns.frameMs = 0; last = now;
    peak.ents = Math.max(peak.ents, ents.length); peak.mon = Math.max(peak.mon, ents.filter(e => e.team === 'e' && !e.dead).length); peak.fx = Math.max(peak.fx, fxList.length); peak.projs = Math.max(peak.projs, projs.length); peak.ground = Math.max(peak.ground, groundFx.length); peak.drops = Math.max(peak.drops, drops.length); peak.nums = Math.max(peak.nums, numList.length);
    if (now - t0 < secs * 1000) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); });
  ns.on = false; po.disconnect(); window.step = s0; window.renderWorld = r0; ui.draw = u0;
  for (const f of undo) f(); const brkOut = {}; for (const k in B) brkOut[k] = +(B[k] / Math.max(1, T.world.length)).toFixed(2);
  const dur = (performance.now() - t0) / 1000;
  const st = a => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y), q = k => +s[Math.min(s.length - 1, Math.floor(s.length * k))].toFixed(2); return { avg: +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(2), p99: q(0.99), max: +s[s.length - 1].toFixed(1), n: a.length }; };
  const iv = T.iv.slice(3), sorted = iv.slice().sort((x, y) => y - x), worst = sorted.slice(0, Math.max(1, Math.ceil(iv.length / 100)));
  const net = {}; for (const dir of ['out', 'in']) { const o = {}; let n = 0, b = 0; for (const [k, R] of Object.entries(ns[dir]).sort((x, y) => y[1].b - x[1].b)) { o[k] = { n: +(R.n / dur).toFixed(1), B: Math.round(R.b / dur), avg: Math.round(R.b / R.n), max: R.max, ms: +(R.ms / dur).toFixed(2), msMax: +R.msMax.toFixed(1) }; n += R.n; b += R.b; } net[dir] = { msgs: +(n / dur).toFixed(1), Bps: Math.round(b / dur), by: o }; }
  return { fps: +(1000 / (iv.reduce((a, b) => a + b, 0) / iv.length)).toFixed(1), low1: +(1000 / (worst.reduce((a, b) => a + b, 0) / worst.length)).toFixed(1), frameP99: st(iv).p99, frameMax: st(iv).max, jank33: iv.filter(x => x > 33.4).length, frames: iv.length,
    step: st(T.step), world: st(T.world), ui: st(T.ui), longTasks: { n: T.lt.length, total: Math.round(T.lt.reduce((a, b) => a + b, 0)), max: Math.round(Math.max(0, ...T.lt)) }, peak, net, rtt: Math.round(net.rtt || 0), heapMB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1e6) : null, brk: brk ? brkOut : undefined, slow: slow.sort((a, b) => b.iv - a.iv).slice(0, 6) };
};
const out = { secs: SECS, cpu: CPU, gpu: process.env.GPU || 'default', mobs: MOBS, dg: DG, jobs: JOBS, pages: [] };
try {
  for (let i = 0; i < N; i++) {
    ok(await uiRegister(pages[i], srv.url, names[i]), `${names[i]} 注册`);
    ok(await uiCreateChar(pages[i], CLS_IDX[JOBS[i].cls]), `${names[i]} 建角色进城`);
    const r = await pages[i].evaluate(MAX_CHAR, JOBS[i]); console.log(`  ${names[i]}：${JSON.stringify(r)}`);
  }
  if (TOWN) {   // 城镇同屏：所有人进同一个场景，随机来回走
    for (const P of pages) await P.evaluate(sc => worldTravel(sc), TOWN);
    ok((await Promise.all(pages.map(P => until(P, n => netTown.peers.size === n, N - 1, 20000)))).every(Boolean), `城镇里互相看到（${N} 人）`);
    await Promise.all(pages.map(P => P.evaluate(() => { window.__walk = setInterval(() => { const V = input.virt; for (const k of ['left', 'right', 'up', 'down']) delete V[k]; const r = Math.random(); if (r < 0.4) V.left = 1; else if (r < 0.8) V.right = 1; if (Math.random() < 0.3) V[Math.random() < 0.5 ? 'up' : 'down'] = 1; }, 600); })));
  } else {
    for (let i = 1; i < N; i++) {
      await A.evaluate(n => netPartyInvite(null, n), names[i]);
      await until(pages[i], () => menus.isOpen('nd_pinv'), null, 8000);
      await pages[i].click('.netask button:has-text("加入队伍")');
    }
    ok(await until(A, n => netParty.p && netParty.p.members.length === n, N, 8000), `组队 ${N} 人`);
    await A.evaluate(id => enterDungeon(id, 0), DG);
    const allIn = await Promise.all(pages.map(P => until(P, () => game.scene === 'dungeon' && coop.state === 'play', null, 60000)));
    ok(allIn.every(Boolean), '全队进入地下城', allIn);
    // 队长：房间里一直保持 MOBS 只怪（本地下城的小怪），满血满蓝不死；两边机器人正常速度打
    await A.evaluate(MOBS => {
      const kinds = [...new Set(ents.filter(e => e.team === 'e').map(e => e.kind))].filter(k => MON[k] && !MON[k].boss); if (!kinds.length) kinds.push('goblin');
      window.__fill = setInterval(() => { if (!game.dungeon || game.dungeon.transition || game.dungeon.state === 'result') return; const alive = ents.filter(e => e.team === 'e' && !e.dead).length, p = game.player;
        for (let j = alive; j < MOBS; j++) spawnMonster(kinds[j % kinds.length], clamp(p.x + (j % 2 ? 1 : -1) * (120 + (j * 37) % 260), game.room.x0 + 40, game.room.x1 - 40), 20 + (j * 53) % 160); }, 400);
    }, MOBS);
    await Promise.all(pages.map(P => P.evaluate(() => { bot.on = true; game.speedMul = 1; window.__keep = setInterval(() => { const p = game.player; if (p) { p.hp = p.hpMax; p.mp = p.mpMax; } if (drops.length > 40) drops.splice(0, drops.length - 40); }, 300); })));   // 怪一直补：地上的掉落按玩家顺手捡的量封顶（一个房间约 40 件）
  }
  if (CPU > 1) for (const P of pages) { const s = await P.context().newCDPSession(P); await s.send('Emulation.setCPUThrottlingRate', { rate: CPU }); }
  await sleep(4000);
  let prof = null;
  const cdp = process.env.PROF ? await A.context().newCDPSession(A) : null;
  if (cdp) { await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 200 }); await cdp.send('Profiler.start'); }
  const res = await Promise.all(pages.map(P => P.evaluate(MEASURE, { secs: SECS, brk: !!process.env.BREAK })));
  if (cdp) {
    // 两张表：① 自身耗时（画布这类原生调用算到调用它的 JS 函数头上）② 含子调用的总耗时；空闲不计
    const { profile } = await cdp.send('Profiler.stop'), byId = new Map(profile.nodes.map(n => [n.id, n])), par = new Map();
    for (const n of profile.nodes) for (const c of n.children || []) par.set(c, n.id);
    const key = n => `${n.callFrame.functionName || '(anon)'}:${n.callFrame.lineNumber + 1}`, isJs = n => !!n.callFrame.url;
    const self = new Map(), incl = new Map(); let busy = 0;
    for (const sid of profile.samples) {
      let n = byId.get(sid); if (n.callFrame.functionName === '(idle)') continue; busy++;
      let j = n; while (j && !isJs(j) && par.has(j.id)) j = byId.get(par.get(j.id));
      const k = j && isJs(j) ? key(j) : n.callFrame.functionName; self.set(k, (self.get(k) || 0) + 1);
      const seen = new Set(); for (let a = n; a; a = par.has(a.id) ? byId.get(par.get(a.id)) : null) if (isJs(a)) { const ka = key(a); if (!seen.has(ka)) { seen.add(ka); incl.set(ka, (incl.get(ka) || 0) + 1); } }
    }
    const top = (M, n) => [...M.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, c]) => `${(c / busy * 100).toFixed(1)}% ${k}`);
    prof = { busyPct: +(busy / profile.samples.length * 100).toFixed(1), self: top(self, 25), incl: top(incl, 25) };
  }
  for (let i = 0; i < N; i++) { const r = res[i]; r.rtt = await pages[i].evaluate(() => Math.round(net.rtt || 0)); out.pages.push({ who: names[i], role: i ? 'guest' : 'host', ...r }); }
  if (prof) out.prof = prof;
  for (const P of out.pages) {
    console.log(`\n== ${P.who}（${P.role}）fps ${P.fps}  1%low ${P.low1}  帧 p99 ${P.frameP99}ms  最长 ${P.frameMax}ms  >33ms ${P.jank33}/${P.frames}  rtt ${P.rtt}ms  堆 ${P.heapMB}MB`);
    console.log(`   step ${JSON.stringify(P.step)}  world ${JSON.stringify(P.world)}  ui ${JSON.stringify(P.ui)}  长任务 ${JSON.stringify(P.longTasks)}  峰值 ${JSON.stringify(P.peak)}`);
    if (P.brk) console.log(`   分项（毫秒/帧）${JSON.stringify(P.brk)}`);
    if (P.slow && P.slow.length) console.log(`   最慢的帧（间隔 / 这一帧里各部分的毫秒，msg = 收消息处理）${JSON.stringify(P.slow)}`);
    for (const dir of ['out', 'in']) { const D = P.net[dir]; console.log(`   ${dir === 'out' ? '发' : '收'} ${D.msgs} 条/秒 ${(D.Bps / 1024).toFixed(1)} KB/s  ` + Object.entries(D.by).slice(0, 10).map(([k, R]) => `${k}:${R.n}/s ${(R.B / 1024).toFixed(1)}KB/s avg${R.avg}B max${R.max}B` + (dir === 'in' ? ` 处理${R.ms}ms/s 最长${R.msMax}ms` : '')).join('  ')); }
  }
  if (prof) console.log(`\nCPU 采样（队长，忙碌 ${prof.busyPct}%，占忙碌时间的比例）\n 自身（含原生调用）：\n  ` + prof.self.join('\n  ') + '\n 含子调用：\n  ' + prof.incl.join('\n  '));
  const errs = dumpErrors(players); ok(!errs.length, '页面没有报错', errs.slice(0, 5));
} catch (e) { ok(false, '异常：' + (e.stack || e)); }
if (process.env.OUT) fs.writeFileSync(process.env.OUT, JSON.stringify(out, null, 1));
await browser.close(); await srv.stop();
const r = result(); console.log(`\n${r.total - r.fails}/${r.total} 通过`); process.exit(r.fails ? 1 : 0);
