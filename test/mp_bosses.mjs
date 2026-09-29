// 联机领主自定义机制（REGION_HOOKS / 房间机关，net/coop_mech.js 的 hook 事件）：2 个真实客户端组队进比尔马克帝国试验场，
// 主机本人无敌站在最左边，所有怪盯队员；队员贴着站、不还手、不无敌（血低于 60% 补满）。每段对比：
//   主机发出的钩子事件和队员收到的一一对应（名字、次数，时间差 < 0.3 秒）、地面预警两边一一配对（同类型同半径、时间差 < 0.3 秒）、队员被机制打中
// 场景：MK 牛头械王（倒地起身三道落雷、罪恶之眼激光、保护模式的全屏吼叫 + 15 秒倒计时 + 机器人变牛头统帅）
//       SR 潜行者希洛克（凝视：面朝她挨打、背对没事，两边到点时间一致）+ 护盾：领主藏起来（记忆碎片阶段）再出来、队员那边傀儡重建以后护盾泡泡跟着新傀儡
//       RM 伊凡房（伊凡自爆、上校变红倒计时自爆、路障挡住队员、队员打路障不算伤害）
// 用法：node test/mp_bosses.mjs [MK,SR,RM]
import fs from 'node:fs';
import { startServer, launchPlayers, ok, result, sleep, until, uiRegister, uiCreateChar, dumpErrors } from './net_lib.mjs';
const SC = (process.argv[2] || 'MK,SR,RM').split(',');
const DG = 'bilmark', LV = 55;
const out = 'test/shots/mp_bosses'; fs.mkdirSync(out, { recursive: true });
const srv = await startServer();
const { players, close } = await launchPlayers(2);
const pages = players.map(p => p.page), names = ['alice', 'bob'], [H, G] = pages;
// 探针：地面预警（两边）、钩子事件（主机发 / 队员收）、机制启动、队员挨打（按 msNetSrc 分机制）、队员被上的异常状态、希洛克凝视的结算
const PROBE = () => {
  if (window.__q) return;
  const Q = window.__q = { on: false, seg: '', tg: [], hk: [], mech: [], hurt: [], st: [], gz: [] };
  const tg0 = window.telegraph; window.telegraph = function (o) { const g = tg0.apply(this, arguments); if (Q.on) Q.tg.push({ seg: Q.seg, T: Date.now(), kind: g.kind, r: Math.round(g.r), g }); return g; };
  const send0 = coop.send; coop.send = function (d, to) { if (Q.on && d && d.k === 'mech' && coop.role === 'host') { if (d.e === 'hook') Q.hk.push({ seg: Q.seg, h: d.d.h, T: Date.now() }); else if (d.e === 'start') Q.mech.push({ seg: Q.seg, id: d.use, T: Date.now() }); } return send0.call(this, d, to); };
  const cr0 = window.coopMechRecv; window.coopMechRecv = function (d) { if (Q.on && d) { if (d.e === 'hook') Q.hk.push({ seg: Q.seg, h: d.d && d.d.h, T: Date.now() }); else if (d.e === 'start') Q.mech.push({ seg: Q.seg, id: d.use, T: Date.now() }); } return cr0.apply(this, arguments); };
  const hu0 = game.onPlayerHurt; game.onPlayerHurt = function (p, dmg, a) { if (Q.on && p === game.player) Q.hurt.push({ seg: Q.seg, dmg: Math.round(dmg), mech: msNetSrc || null, kind: a && a.kind }); return hu0.call(this, p, dmg, a); };
  const as0 = window.addStatus; window.addStatus = function (t, kind) { if (Q.on && t === game.player && msNetSrc) Q.st.push({ seg: Q.seg, kind, src: msNetSrc }); return as0.apply(this, arguments); };
  const gz0 = window.sirocoGazeResolve; window.sirocoGazeResolve = function () { const me = game.player, hp0 = me.hp, r = gz0.apply(this, arguments); if (Q.on) Q.gz.push({ seg: Q.seg, T: Date.now(), res: me.hp < hp0 ? 'hit' : 'safe' }); return r; };
};
const DUMP = () => { const Q = window.__q; return { ...Q, tg: Q.tg.map(({ g, ...x }) => ({ ...x, mech: g.mech || null })) }; };
// 两边的地面预警一一配对：同类型、同半径、时间差最小（不超过 0.3 秒）；主机在段末 0.5 秒内放的不算（同 mp_abyss.mjs）
function matchTg(ht, gt, endT) {
  const used = new Set(), miss = [], dts = [];
  for (const a of ht.filter(x => x.T < endT - 500)) {
    let best = -1, bd = 1e9; gt.forEach((b, j) => { if (used.has(j) || b.kind !== a.kind || b.r !== a.r) return; const d = Math.abs(b.T - a.T); if (d < bd) { bd = d; best = j; } });
    if (best >= 0 && bd <= 300) { used.add(best); dts.push(bd); } else miss.push(`${a.kind}/${a.r}`);
  }
  return { host: ht.length, matched: dts.length, miss, maxDt: dts.length ? Math.max(...dts) : 0, guestMech: gt.filter(x => x.mech).length };
}
// 按名字把两边的事件（钩子 / 机制启动）按顺序配对，算最大时间差
function matchEv(hl, gl, key) {
  const A = {}, B = {}, dt = []; for (const x of hl) (A[x[key]] ??= []).push(x.T); for (const x of gl) (B[x[key]] ??= []).push(x.T);
  for (const k in A) A[k].forEach((T, i) => { if (B[k] && B[k][i] !== undefined) dt.push(Math.abs(B[k][i] - T)); });
  const cnt = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v.length]));
  return { host: cnt(A), guest: cnt(B), same: JSON.stringify(cnt(A)) === JSON.stringify(cnt(B)), maxDt: Math.max(0, ...dt) };
}
const tally = (L, f) => { const o = {}; for (const x of L) { const k = f(x); o[k] = (o[k] || 0) + 1; } return o; };
const segEnd = {};
async function seg(name, fn) {
  for (const P of pages) await P.evaluate(n => { window.__q.seg = n; window.__q.on = true; }, name);
  await fn();
  await sleep(800);
  segEnd[name] = Date.now();
  for (const P of pages) await P.evaluate(() => { window.__q.on = false; });
}
const hostWait = sec => H.evaluate(s => new Promise(res => { const t0 = game.t, iv = setInterval(() => { if (game.t - t0 >= s) { clearInterval(iv); res(); } }, 50); }), sec);
// 每段的公共检查：钩子事件、机制启动、地面预警两边对上；返回队员被机制打中的统计
async function checkSeg(sc, name, { hooks, minHookHurt = 1, tg = true }) {
  const h = await H.evaluate(DUMP), g = await G.evaluate(DUMP), f = x => x.seg === name;
  const hk = matchEv(h.hk.filter(f), g.hk.filter(f), 'h'), me = matchEv(h.mech.filter(f), g.mech.filter(f), 'id');
  const tm = matchTg(h.tg.filter(f), g.tg.filter(f), segEnd[name]);
  const mh = tally(g.hurt.filter(x => f(x) && x.mech), x => x.mech), st = tally(g.st.filter(f), x => x.src + '·' + x.kind);
  console.log(`  [${name}] 钩子事件 主机 ${JSON.stringify(hk.host)} / 队员 ${JSON.stringify(hk.guest)} 最大时间差 ${hk.maxDt}ms；机制启动 主机 ${JSON.stringify(me.host)} / 队员 ${JSON.stringify(me.guest)} ${me.maxDt}ms`);
  console.log(`        地面预警 主机 ${tm.host} 个，队员配上 ${tm.matched} 个（其中机制 ${tm.guestMech}），最大时间差 ${tm.maxDt}ms，没配上 ${JSON.stringify(tm.miss)}；队员被机制打中 ${JSON.stringify(mh)}，被上状态 ${JSON.stringify(st)}`);
  ok(hooks.every(k => hk.host[k] > 0) && hk.same && hk.maxDt < 300, `${sc}：钩子事件 ${hooks.join(' / ')} 队员这边一一收到（时间差 ${hk.maxDt}ms < 0.3 秒）`, hk);
  ok(me.same && me.maxDt < 300, `${sc}：领主机制启动两边一致（${JSON.stringify(me.host)}）`, me);
  if (tg) ok(tm.host > 0 && !tm.miss.length && tm.maxDt < 300, `${sc}：地面预警队员这边一个不少、时间差 < 0.3 秒（${tm.matched}/${tm.host}，最大 ${tm.maxDt}ms）`, tm);
  const hookHurt = Object.entries(mh).filter(([k]) => /^hook:|^explode/.test(k)).reduce((a, [, n]) => a + n, 0);
  ok(hookHurt >= minHookHurt, `${sc}：队员被自定义机制打中 ${hookHurt} 次（${JSON.stringify(mh)}）`, mh);
  return { h, g, mh, st };
}
// 刷一只领主（主机）：不出招、不走动（机制由测试直接触发）
const spawnLord = (k, x) => H.evaluate(async ([k, x]) => { await loadBundles(monBundles([k])); const dg = game.dungeon, b = spawnMonster(k, x, DEPTH / 2, { lvl: 50, boss: true, mul: dg.D.hp, atkMul: dg.D.atk }); b.speed = 0; window.__boss = b; return b.nid; }, [k, x]);
const dropLord = () => H.evaluate(() => { const b = window.__boss; if (!b) return; b.boss = false; b.invul = 0; b.hp = 0; if (b.msHidden) { b.msHidden = false; b.remove = false; if (!ents.includes(b)) ents.push(b); } killEnt(b, game.player, {}); window.__boss = null; });
const killAdds = f => H.evaluate(f => { for (const e of [...ents]) if (e.team === 'e' && !e.dead && e !== window.__boss && new Function('e', 'return ' + f)(e)) { e.invul = 0; e.hp = 0; killEnt(e, game.player, {}); } }, f || 'true');
try {
  for (let i = 0; i < 2; i++) {
    ok(await uiRegister(pages[i], srv.url, names[i]), `${names[i]} 注册`);
    ok(await uiCreateChar(pages[i], 0), `${names[i]} 建角色进城`);
    await pages[i].evaluate(lv => { testLoadout(lv); save.data.fatigue = 999; save.data.questDone.q_an01 = Date.now(); save.write(); netTown.hello(true); }, LV);
    await pages[i].evaluate(PROBE);
  }
  await H.evaluate(() => netPartyInvite(null, 'bob'));
  await until(G, () => menus.isOpen('nd_pinv'), null, 8000);
  await G.click('.netask button:has-text("加入队伍")');
  ok(await until(H, () => netParty.p && netParty.p.members.length === 2, null, 8000), '组队 2 人');
  const scene = await H.evaluate(id => { for (const s in SCENES) if (SCENES[s].gates.some(g => g.dungeon === id)) return s; }, DG);
  await H.evaluate(s => worldTravel(s), scene); await until(H, s => world && world.S.id === s, scene);
  await H.evaluate(id => enterDungeon(id, 0), DG);
  const allIn = await Promise.all(pages.map(P => until(P, () => game.scene === 'dungeon' && coop.state === 'play' && !game.dungeon.transition, null, 60000)));
  ok(allIn.every(Boolean), '全队进入比尔马克帝国试验场', allIn);
  ok(await H.evaluate(() => coop.role === 'host') && await G.evaluate(() => coop.role === 'guest'), 'alice 是主机');
  await sleep(1500);
  await killAdds();
  ok(await until(H, () => game.dungeon.doorsOpen, null, 10000), '第一个房间清完');
  // 主机：无敌站在最左边，所有怪盯队员、领主不出招；队员：贴着站（按测试的站位要求），站着时清掉起身无敌
  await H.evaluate(() => { bot.on = false; game.speedMul = 1; const p = game.player; p.invul = 1e9;
    window.__aim = setInterval(() => { const g = [...coop.mates.values()][0], p = game.player; p.hp = p.hpMax; p.invul = 1e9; if (p.x > 120) { p.x = 60; p.y = DEPTH / 2; }
      for (const m of ents) if (m.nid && !m.dead && m.team === 'e') { m.tgt = g; m.tgtT = game.t + 1e6; if (m === window.__boss) m.aiCd = Math.max(m.aiCd || 0, 1); } }, 250); });
  await G.evaluate(() => { bot.on = false; game.speedMul = 1; const p = game.player; p.invul = 0; window.__pos = null;
    window.__stick = setInterval(() => { const p = game.player, P = window.__pos; if (p.hp < p.hpMax * 0.6) p.hp = p.hpMax; if (p.st === 'idle' || p.st === 'walk') p.invul = 0;
      const B = [...coop.puppets.values()].find(m => m.boss && !m.dead && ents.includes(m));
      if (P && P.eye) { const g = groundFx.find(g => g.mech === 'hook:eyeL'); if (g && !p.act && p.st !== 'hit' && p.st !== 'down' && p.st !== 'air') { p.x = clamp(g.x + g.face * 160, 40, game.room.x1 - 40); p.y = g.y; } return; }
      if (P && P.near) { const T = ents.find(e => e.puppet && !e.dead && e.kind === P.near); if (T && (Math.abs(T.x - p.x) > 60 || Math.abs(T.y - p.y) > 20) && p.st !== 'hit' && p.st !== 'down' && p.st !== 'air') { p.x = clamp(T.x - 40, 40, game.room.x1 - 40); p.y = T.y; } return; }
      if (P && B && P.dx !== undefined && p.st !== 'hit' && p.st !== 'down' && p.st !== 'air' && !p.act) { p.x = clamp(B.x + P.dx, 40, game.room.x1 - 40); p.y = P.y ?? DEPTH / 2; }
      if (P && B && P.face) { const s = Math.sign(B.x - p.x) || 1; p.face = P.face === 'to' ? s : -s; } }, 100); });
  const pos = o => G.evaluate(o => { window.__pos = o; }, o);

  if (SC.includes('MK')) {
    console.log('\n== MK 牛头械王');
    const nid = await spawnLord('mechKing', 700);
    await H.evaluate(() => { window.__boss.anc.eye = 1e9; });   // 罪恶之眼由测试触发
    ok(await until(G, id => coop.puppets.has(id), nid, 8000), 'MK：队员这边有牛头械王的傀儡');
    await pos({ dx: 220 });
    await sleep(1500);
    await seg('mk', async () => {
      // 倒地起身 → 三道落雷（主机真的让它倒地再起身，钩子自己触发）
      await H.evaluate(() => { const b = window.__boss, g = [...coop.mates.values()][0]; b.face = g.x >= b.x ? 1 : -1; b.setState('down'); b.stT = 0; });
      await until(H, () => ANC.stats.lanes > 0, null, 8000);
      await hostWait(2.5);
      // 罪恶之眼：两只眼睛落在目标（队员）两边，队员走进激光的那一行
      await pos({ eye: true });
      await H.evaluate(() => { const b = window.__boss, g = [...coop.mates.values()][0], P = game.player; game.player = g; try { mechKingEyes(b); } finally { game.player = P; } });
      await hostWait(3.2);
      await pos({ dx: 220 });
      await hostWait(0.6);
      // 保护模式：血量压到 55% 进二阶段（全屏吼叫 + 无敌 + 机器人）
      await H.evaluate(() => { const b = window.__boss; b.hp = Math.round(b.hpMax * 0.55); });
      ok(await until(H, () => { const b = window.__boss; return (b.msMechs || []).some(s => s.id === 'invuln' && !s.done); }, null, 8000), 'MK：主机进入保护模式');
      await hostWait(2);
      const hud = { h: await H.evaluate(() => { const st = window.__boss.msMechs.find(s => s.id === 'invuln' && !s.done); return +st.ancT.toFixed(2); }),
        g: await G.evaluate(id => { const st = (coop.mechs.get(id) || []).find(s => s.id === 'invuln' && !s.done); return st && st.ancT !== undefined ? +st.ancT.toFixed(2) : null; }, nid) };
      ok(hud.g !== null && Math.abs(hud.h - hud.g) < 0.5, `MK：保护模式倒计时两边一致（主机 ${hud.h} / 队员 ${hud.g} 秒）`, hud);
      // 倒计时快进到 0：机器人变成牛头统帅
      await H.evaluate(() => { window.__boss.msMechs.find(s => s.id === 'invuln' && !s.done).ancT = 0.2; });
      await hostWait(1.5);
      const morph = await G.evaluate(id => { const st = (coop.mechs.get(id) || []).find(s => s.id === 'invuln' && !s.done); return { morph: !!(st && st.ancMorph), cmd: [...coop.puppets.values()].filter(m => m.kind === 'tauCommander' && !m.dead).length }; }, nid);
      ok(morph.morph && morph.cmd > 0, `MK：机器人变成牛头统帅，队员这边的 HUD 也切过去（统帅 ${morph.cmd} 只）`, morph);
      await hostWait(2);
      await killAdds();
      ok(await until(H, () => !(window.__boss.msMechs || []).some(s => s.id === 'invuln' && !s.done), null, 8000), 'MK：打完机器人，保护模式结束');
    });
    const r = await checkSeg('MK', 'mk', { hooks: ['lanes', 'eyes', 'eyeL', 'roar', 'morph'], minHookHurt: 2 });
    ok(r.mh['hook:lanes'] > 0, `MK：队员被落雷打中（${r.mh['hook:lanes'] || 0} 次）`, r.mh);
    ok(r.mh['hook:eyeL'] > 0, `MK：队员被罪恶之眼的激光打中（${r.mh['hook:eyeL'] || 0} 次）`, r.mh);
    ok(r.st['hook:roar·stun'] > 0, `MK：保护模式的吼叫把队员震晕（${JSON.stringify(r.st)}）`, r.st);
    const eyes = await G.evaluate(() => ents.filter(e => e.kind === 'bmEye' && !e.dead && !e.remove).length);
    ok(eyes === 0, `MK：激光射完，队员这边的罪恶之眼也消失了（剩 ${eyes}）`);
    await dropLord(); await killAdds(); await sleep(2000);
  }

  if (SC.includes('SR')) {
    console.log('\n== SR 潜行者希洛克');
    const nid = await spawnLord('siroco', 700);
    await H.evaluate(() => { window.__boss.gaze.next = 1e9; });   // 凝视由测试触发
    ok(await until(G, id => coop.puppets.has(id), nid, 8000), 'SR：队员这边有希洛克的傀儡');
    await pos({ dx: 200, face: 'to' });
    await sleep(1500);
    await seg('sr', async () => {
      await H.evaluate(() => sirocoGazeStart(window.__boss));   // 第一次：队员面朝她 → 恐惧
      await hostWait(3.5);
      await pos({ dx: 200, face: 'away' });
      await hostWait(0.8);
      await H.evaluate(() => { window.__boss.gaze.next = 1e9; sirocoGazeStart(window.__boss); });   // 第二次：背对 → 没事
      await hostWait(3);
    });
    const r = await checkSeg('SR', 'sr', { hooks: ['gaze'], tg: false });   // 凝视不是地面预警：下面按两边的结算时间对
    const gz = { h: r.h.gz.filter(x => x.seg === 'sr'), g: r.g.gz.filter(x => x.seg === 'sr') };
    const dts = gz.h.map((x, i) => gz.g[i] ? Math.abs(gz.g[i].T - x.T) : 1e9);
    console.log(`        凝视结算 主机 ${gz.h.length} 次 / 队员 ${JSON.stringify(gz.g.map(x => x.res))}，时间差 ${JSON.stringify(dts)}ms`);
    ok(gz.h.length === 2 && gz.g.length === 2 && Math.max(...dts) < 300, `SR：凝视两边都到点结算（${gz.g.length}/${gz.h.length}，时间差 ${Math.max(...dts)}ms < 0.3 秒）`, { gz, dts });
    ok(gz.g.map(x => x.res).join() === 'hit,safe', `SR：面朝希洛克被恐惧、背对没事（${gz.g.map(x => x.res).join(' / ')}）`, gz.g);
    ok(r.mh['hook:siroco'] > 0 && r.st['hook:siroco·slow'] > 0 && r.st['hook:siroco·blind'] > 0, `SR：队员挨了凝视（${JSON.stringify(r.mh)}，状态 ${JSON.stringify(r.st)}）`, r);
    const hudH = await H.evaluate(() => +window.__boss.gaze.next.toFixed(2)), hudG = await G.evaluate(id => { const m = coop.puppets.get(id); return m && m.gaze ? +m.gaze.next.toFixed(2) : null; }, nid);
    ok(hudG !== null && Math.abs(hudH - hudG) < 0.5, `SR：队员这边凝视的 HUD 倒计时跟着主机（主机 ${hudH} / 队员 ${hudG} 秒）`, { hudH, hudG });
    // 护盾 + 领主藏起来：护盾挂上 → 血量压到 70% 进“记忆碎片”（领主离场 2.5 秒，队员那边傀儡被移除）→ 打碎水晶 → 领主在主机身边重新出现（队员那边重建傀儡）
    await pos({ dx: 200 });
    await H.evaluate(() => msMechStart(window.__boss, { use: 'shield', hp: 0.9, dur: 0, col: '#7ae0c8', say: '护盾（测试）' }));
    await sleep(1200);
    const SH = () => { const f = fxList.find(f => f.st && f.st.id === 'shield' && !f.st.done), b = coop.role === 'guest' ? [...coop.puppets.values()].find(m => m.boss && !m.dead) : window.__boss;
      return f && b ? { fx: Math.round(f.x), b: Math.round(b.x), inEnts: ents.includes(b), mechs: (b.msMechs || []).some(s => s.id === 'shield' && !s.done) } : { fx: f ? Math.round(f.x) : null, b: b ? Math.round(b.x) : null }; };
    const s0 = await G.evaluate(SH);
    await G.evaluate(() => { window.__oldPuppet = [...coop.puppets.values()].find(m => m.boss && !m.dead); });
    ok(s0.fx !== null && Math.abs(s0.fx - s0.b) < 30, `SR：护盾泡泡挂在队员这边的希洛克身上（泡泡 ${s0.fx} / 领主 ${s0.b}）`, s0);
    await H.evaluate(() => { const b = window.__boss; b.hp = Math.round(b.hpMax * 0.7); });
    ok(await until(H, () => window.__boss.msHidden, null, 8000), 'SR：希洛克隐入黑暗（主机上藏起来了）');
    await hostWait(2.5);
    const gone = await G.evaluate(() => ({ removed: !ents.includes(window.__oldPuppet) }));
    ok(gone.removed, 'SR：队员这边的旧傀儡已经移除（快照里 1.5 秒没出现）', gone);
    await killAdds("e.kind === 'msCrystal'");
    ok(await until(H, () => !window.__boss.msHidden && ents.includes(window.__boss), null, 8000), 'SR：打碎记忆碎片，希洛克重新出现');
    await sleep(1500);
    const hb = await H.evaluate(SH), s1 = await G.evaluate(SH), rebuilt = await G.evaluate(() => { const m = [...coop.puppets.values()].find(m => m.boss && !m.dead); return !!m && m !== window.__oldPuppet; });
    console.log(`        护盾：藏之前 泡泡 ${s0.fx} / 领主 ${s0.b}；出来以后 主机 泡泡 ${hb.fx} / 领主 ${hb.b}，队员 泡泡 ${s1.fx} / 领主 ${s1.b}（傀儡重建 ${rebuilt}）`);
    ok(rebuilt && Math.abs(s1.b - s0.b) > 100, `SR：队员这边的希洛克是重建的傀儡，位置换了（${s0.b} → ${s1.b}）`, { s0, s1, rebuilt });
    ok(s1.fx !== null && Math.abs(s1.fx - s1.b) < 30 && s1.inEnts && s1.mechs, `SR：领主藏起来再出来以后，队员这边的护盾泡泡跟着新傀儡（泡泡 ${s1.fx} / 领主 ${s1.b}，HUD 有护盾 ${s1.mechs}）`, s1);
    ok(hb.fx !== null && Math.abs(hb.fx - hb.b) < 30, `SR：主机这边护盾泡泡也在领主身上（泡泡 ${hb.fx} / 领主 ${hb.b}）`, hb);
    await dropLord(); await killAdds(); await sleep(2000);
  }

  if (SC.includes('RM')) {
    console.log('\n== RM 伊凡房（房间机关）');
    await killAdds();
    await until(H, () => game.dungeon.doorsOpen, null, 10000);
    const go = await H.evaluate(() => { const dg = game.dungeon, d = Object.keys(dg.room.doors).find(d => dg.room.doors[d] && dg.room.doors[d].gx === 1); if (!d) return null; dg.go(d); return d; });
    ok(go, `RM：主机走进伊凡房（${go}）`);
    ok((await Promise.all(pages.map(P => until(P, () => game.dungeon.room.gx === 1 && !game.dungeon.transition, null, 15000)))).every(Boolean), 'RM：全队进入伊凡房');
    await until(G, () => ents.some(e => e.kind === 'bmBarricade' && !e.dead), null, 8000);
    // 路障挡住队员；队员打路障（主机上无敌）不算伤害
    const bar = await G.evaluate(() => { const b = ents.find(e => e.kind === 'bmBarricade' && !e.dead), p = game.player; p.x = b.x + 120; return Math.round(b.x); });
    await sleep(400);
    const px = await G.evaluate(() => Math.round(game.player.x));
    ok(px <= bar - 39, `RM：路障挡住队员（路障 ${bar}，队员被推回 ${px}）`, { bar, px });
    const hp0 = await H.evaluate(() => { const b = ents.find(e => e.kind === 'bmBarricade' && !e.dead); return b.hp; });
    await G.evaluate(() => { const b = ents.find(e => e.kind === 'bmBarricade' && !e.dead); coop.localHit(b, game.player, 5000, false, {}); });
    await sleep(800);
    const bh = await H.evaluate(hp0 => { const b = ents.find(e => e.kind === 'bmBarricade' && !e.dead); return { same: !!b && b.hp === hp0, drop: (coop.stats.hitDrop || {}).invul || 0 }; }, hp0);
    ok(bh.same && bh.drop > 0, `RM：队员打路障，主机不扣血（丢弃 ${bh.drop} 次）`, bh);
    await pos({ near: 'ivan' });
    await seg('rm', async () => {
      await hostWait(13);   // 伊凡：柱子召唤、8 秒没打死就追着人自爆
      // 伊凡上校：残血变红，6 秒后自爆
      await H.evaluate(() => { const R = game.dungeon.ancRoom; R.col = ancSpawn('ivanColonel', R.W * 0.4, DEPTH / 2, { elite: true, lvl: game.dungeon.def.lvl[1] + 1 }); R.col.hp = Math.round(R.col.hpMax * 0.3); R.col.speed = 0; });
      await pos({ near: 'ivanColonel' });
      await hostWait(7.5);
    });
    const r = await checkSeg('RM', 'rm', { hooks: ['ancFuse', 'ancBoom', 'ancRed'] });
    ok(r.mh['hook:ancBoom'] > 0, `RM：队员被伊凡 / 上校的自爆炸到（${r.mh['hook:ancBoom'] || 0} 次）`, r.mh);
  }
  for (const P of pages) await P.evaluate(() => { clearInterval(window.__aim); clearInterval(window.__stick); });
  await Promise.all(pages.map((P, i) => P.screenshot({ path: `${out}/end-${names[i]}.png` })));
  const fe = await Promise.all(pages.map(P => P.evaluate(() => frameErrs.map(e => `${e.where} ×${e.n}：${e.msg}`))));
  ok(fe.every(l => !l.length), '两边都没有逐帧报错', fe);
  await G.evaluate(() => { menus.closeAll(); goTown(); }); await H.evaluate(() => { menus.closeAll(); goTown(); });
  const errs = [...new Set(dumpErrors(players).map(s => s.slice(0, 300)))];
  ok(!errs.length, '页面没有报错', errs.slice(0, 5));
} catch (e) { ok(false, '异常：' + (e.stack || e)); }
await close(); await srv.stop();
const r = result(); console.log(`\n${r.total - r.fails}/${r.total} 通过`); process.exit(r.fails ? 1 : 0);
