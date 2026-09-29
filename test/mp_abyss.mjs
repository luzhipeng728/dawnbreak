// 联机深渊回归（魔界深渊 abyss_siroco）：2 个真实客户端组队，Lv60 狂战士（三觉 / 技能学满 / 最强装备 +12），刷图冷却 ×0.34（冷却减少装备叠满后的实测值），
// 队长带队进图 → 穿门走到深渊柱房间 → 两边机器人正常速度一直放技能：打破深渊柱 → 第 1 轮 → 第 2 轮（深渊领主降临，按场景指定）→ 派对结束（深渊宝藏）
// 两边都采集：pageerror / console.error（带堆栈）、长任务、每帧耗时、requestAnimationFrame 有没有停、整帧出错没画出来的帧（step 抛错时 renderWorld 被跳过）、
//            roomEnter / 轮次开始 / 领主降临 / 轮次横幅的次数、怪物 / 特效 / 伤害数字 / 掉落数量随时间的变化
// 场景：A 队长 alice 做主机，领主奈克斯；B 队长移交给 bob（主机换成第二个页面），领主暗杀者，降临前后地上一直堆着 150 件掉落；C 守门人
//       HN / HA / HG 队员受击对照（奈克斯 / 暗杀者 / 守门人）：两边不开机器人，怪全盯队员，队员贴着站、不还手、不无敌；
//       逐招对比主机发出的出招和队员本地重播的出招（招式名 + 有没有判定），统计队员被普通怪 / 深渊领主 / 普通区域领主（HN 对照）打中的次数
// 用法：node test/mp_abyss.mjs [场景=A,B,C,HN,HA,HG]
import fs from 'node:fs';
import { startServer, launchPlayers, ok, result, sleep, until, uiRegister, uiCreateChar, dumpErrors } from './net_lib.mjs';
const SC = (process.argv[2] || 'A,B,C,HN,HA,HG').split(',');
const SCENARIOS = { A: { host: 0, lord: 'nex' }, B: { host: 1, lord: 'assassin', drops: 150 }, C: { host: 0, lord: 'gatekeeper' },
  HN: { host: 0, lord: 'nex', hit: true, cmp: true }, HA: { host: 0, lord: 'assassin', hit: true }, HG: { host: 0, lord: 'gatekeeper', hit: true } };
const DG = 'abyss_siroco', CDMUL = 0.34, FIGHT_MS = +(process.env.FIGHT_MS || 150000);
const out = 'test/shots/mp_abyss'; fs.mkdirSync(out, { recursive: true });
const srv = await startServer();
const { players, close } = await launchPlayers(2);
const pages = players.map(p => p.page), names = ['alice', 'bob'];
// 满级狂战士（同 test/mp_perf.mjs 的 MAX_CHAR）：Lv60、三觉、技能学满、每个部位挑最强、全身 +12；冷却倍率固定 ×cd（recalcStats 之后覆盖）
const MAX_CHAR = ({ job, cd }) => {
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
    if (!ch) break; }
  const r0 = recalcStats; recalcStats = function (q, ...a) { const r = r0.call(this, q, ...a); if (q === game.player) q.cdMul = cd; return r; };
  inv.add(makeConsumable('hpM', 20)); inv.add(makeConsumable('mpM', 20)); inv.quick = ['hpM', 'mpM', null, null, null, null];
  save.data.fatigue = FATIGUE_MAX; recalcStats(p); p.hp = p.hpMax; p.mp = p.mpMax; save.write();
  netTown.hello(true);
  return { job: game.job, lvl: game.lvl, cdMul: p.cdMul, bar: game.skillBar.filter(Boolean).length, wpn: inv.equip.weapon && inv.equip.weapon.name + '+' + inv.equip.weapon.enh };
};
// 页面探针：包住全局函数（拼接的全局脚本，其他代码按全局名调用，替换 window 上的同名函数就能截到）
const PROBE = () => {
  if (window.__pr) return;
  const P = window.__pr = { frames: 0, render: 0, stepErr: 0, raf: 0, gapMax: 0, ft: [], lt: [], errs: [], roomEnter: {}, rounds: [], lords: [], banners: [], samples: [], peak: { mon: 0, fx: 0, ground: 0, nums: 0, drops: 0, projs: 0 } };
  const ce = console.error; console.error = function (...a) { if (P.errs.length < 60) P.errs.push(a.map(x => x && x.stack ? x.stack : String(x)).join(' ').slice(0, 1600)); return ce.apply(this, a); };
  const s0 = window.step; window.step = function (dt) { try { return s0(dt); } catch (e) { P.stepErr++; throw e; } };
  const r0 = window.renderWorld; window.renderWorld = function () { P.render++; return r0.apply(this, arguments); };
  const f0 = window.frameBody; window.frameBody = function (now) { const t = performance.now(); P.frames++; try { return f0(now); } finally { const d = performance.now() - t; if (P.on) P.ft.push(d); } };
  let last = performance.now(); const loop = now => { P.raf++; const d = now - last; last = now; if (P.on && d > P.gapMax) P.gapMax = d; requestAnimationFrame(loop); }; requestAnimationFrame(loop);
  try { new PerformanceObserver(l => { for (const e of l.getEntries()) if (P.on) P.lt.push(Math.round(e.duration)); }).observe({ type: 'longtask' }); } catch (e) { /* 不支持 */ }
  bus.on('roomEnter', e => { const k = e.room.gx + ',' + e.room.gy; P.roomEnter[k] = (P.roomEnter[k] || 0) + 1; });
  const ar = window.abyssRound; window.abyssRound = function (dg, n) { P.rounds.push({ n, t: +game.t.toFixed(2) }); if (P.onRound) P.onRound(n); return ar.apply(this, arguments); };
  const al = window.abyssLord; window.abyssLord = function (dg) { const r = al.apply(this, arguments); P.lords.push({ kind: dg.abyssRun.lord && dg.abyssRun.lord.kind, t: +game.t.toFixed(2) }); return r; };
  const tm = window.toastMsg; window.toastMsg = function (msg) { if (/深渊派对 第|降临了|深渊柱被打破/.test(msg)) P.banners.push(msg); return tm.apply(this, arguments); };
  setInterval(() => {
    if (!P.on || game.scene !== 'dungeon') return;
    const mon = ents.filter(e => e.team === 'e' && !e.dead).length, pk = P.peak, dg = game.dungeon, R = dg && dg.abyssRun;
    pk.mon = Math.max(pk.mon, mon); pk.fx = Math.max(pk.fx, fxList.length); pk.ground = Math.max(pk.ground, groundFx.length); pk.nums = Math.max(pk.nums, numList.length); pk.drops = Math.max(pk.drops, drops.length); pk.projs = Math.max(pk.projs, projs.length);
    if (P.samples.length < 400) P.samples.push([Math.round(performance.now() / 100) / 10, mon, fxList.length, numList.length, drops.length, R ? R.phase + (R.round || '') : '-', P.frames, P.render]);
  }, 500);
};
// 回城（先队员再主机），准备下一个场景
async function leave(H, G, sc) {
  await G.evaluate(() => { menus.closeAll(); goTown(); }); await H.evaluate(() => { menus.closeAll(); goTown(); });
  ok((await Promise.all([H, G].map(P => until(P, () => game.scene === 'town' && coop.state === 'none', null, 20000)))).every(Boolean), `场景 ${sc}：全员回城`);
}
// 受击探针：主机记发出去的怪物出招（ma：招式序号 i / 自带 AI 名 / 招式名 / 这一招有没有判定），队员记收到后本地重播出来的动作和自己挨的打（谁挨打谁结算）
const HITPROBE = () => {
  if (window.__hp) return;
  const Q = window.__hp = { on: false, seg: '', ma: [], rx: [], hurt: [], mech: [], def: null };
  const ms0 = window.msMechStart; window.msMechStart = function (m, spec) { if (Q.on && m && m.boss) Q.mech.push({ seg: Q.seg, id: spec.use, puppet: !!m.puppet }); return ms0.apply(this, arguments); };
  const ma0 = coop.monAct; coop.monAct = function (m, def) { Q.def = def; try { return ma0.call(this, m, def); } finally { Q.def = null; } };
  const send0 = coop.send; coop.send = function (d, to) {
    if (Q.on && d && d.k === 'ma') { const m = coop.puppets.get(d.id), D = Q.def || {}; Q.ma.push({ seg: Q.seg, id: d.id, kind: m && m.kind, lord: !!(m && m.abyssLord), boss: !!(m && m.boss), i: d.i, mi: d.mi, ph: d.ph, ai: d.ai || null, nm: d.nm, hits: (D.hits || []).length, ev: (D.events || []).length }); }
    return send0.call(this, d, to); };
  const rx0 = coop.onMonAct; coop.onMonAct = function (d) {
    const m = this.puppets.get(d.id), was = m && m.act; rx0.call(this, d);
    if (!Q.on) return; const a = m && m.act && m.act !== was ? m.act : null;
    Q.rx.push({ seg: Q.seg, id: d.id, kind: m && m.kind, boss: !!(m && m.boss), i: d.i, ai: d.ai || null, nm: d.nm, played: a ? a.name || a.clip : null, hits: a && a.hits ? a.hits.length : 0, ev: a && a.events ? a.events.length : 0 }); };
  const hu0 = game.onPlayerHurt; game.onPlayerHurt = function (p, dmg, a) { if (Q.on && p === game.player) Q.hurt.push({ seg: Q.seg, dmg: Math.round(dmg), id: a && a.nid, kind: a && a.kind, boss: !!(a && a.boss) }); return hu0.call(this, p, dmg, a); };
};
const tally = (L, f) => { const o = {}; for (const x of L) { const k = f(x); o[k] = (o[k] || 0) + 1; } return o; };
// 受击对照：两边都不开机器人；主机本人无敌、站在最左边，所有怪固定盯住队员（同 mp_coop.mjs）；队员贴着目标站、不还手、不无敌（血低于 60% 才补满，接着测）
// 分段：mob = 第 1 轮的普通深渊怪 + 房间里原有的小怪；lord = 深渊领主（其他怪一出来就清掉，只留领主；12 秒后血量压到 55% 进二阶段）；boss = 同一个房间里再刷一只普通（非深渊）的区域领主做对照
async function hitTest(H, G, sc, S) {
  for (const P of [H, G]) await P.evaluate(HITPROBE);
  await H.evaluate(() => { bot.on = false; game.speedMul = 1; const p = game.player; p.invul = 1e9;
    window.__aim = setInterval(() => { const g = [...coop.mates.values()][0], p = game.player; p.hp = p.hpMax; if (p.x > 120) { p.x = 60; p.y = DEPTH / 2; }
      for (const m of ents) if (m.nid && !m.dead && m.team === 'e' && m.kind !== 'abyssBlock' && m.kind !== 'abyssPillar') { m.tgt = g; m.tgtT = game.t + 1e6; if (window.__killAdds && !m.boss) { m.invul = 0; m.hp = 0; killEnt(m, p, {}); } } }, 250); });
  await G.evaluate(() => { bot.on = false; game.speedMul = 1; const p = game.player; p.invul = 0;
    window.__stick = setInterval(() => { const p = game.player, Q = window.__hp; if (p.hp < p.hpMax * 0.6) p.hp = p.hpMax;
      let T = null, bd = 1e9; for (const m of coop.puppets.values()) if (!m.dead && ents.includes(m) && m.kind !== 'abyssBlock' && m.kind !== 'abyssPillar' && (Q.seg === 'mob' || m.boss)) { const d = Math.abs(m.x - p.x) + Math.abs(m.y - p.y); if (d < bd) { bd = d; T = m; } }
      if (T && (Math.abs(T.x - p.x) > 90 || Math.abs(T.y - p.y) > 30) && !p.act && p.st !== 'hit' && p.st !== 'air' && p.st !== 'down') { p.x = clamp(T.x + (p.x < T.x ? -60 : 60), 40, game.room.x1 - 40); p.y = T.y; } }, 500); });
  const seg = async (name, sec, mid) => {
    for (const P of [H, G]) await P.evaluate(n => { window.__hp.seg = n; window.__hp.on = true; }, name);
    const t0 = await H.evaluate(() => game.t);
    if (mid) { await until(H, ([t, s]) => game.t - t > s, [t0, sec / 2], sec * 3000); await H.evaluate(mid); }
    await until(H, ([t, s]) => game.t - t > s, [t0, sec], sec * 3000);
  };
  const kill = f => H.evaluate(f => { for (const e of [...ents]) if (e.team === 'e' && !e.dead && e.kind !== 'abyssBlock' && new Function('e', 'return ' + f)(e)) { e.invul = 0; e.hp = 0; killEnt(e, game.player, {}); } }, f);
  await kill("e.kind === 'abyssPillar'");
  ok(await until(H, () => game.dungeon.abyssRun.round === 1, null, 8000), `场景 ${sc}：打破深渊柱，第 1 轮`);
  await seg('mob', 8);
  await H.evaluate(() => { window.__killAdds = true; });
  await kill('!e.boss');
  ok(await until(H, () => game.dungeon.abyssRun.lord && ents.includes(game.dungeon.abyssRun.lord), null, 10000), `场景 ${sc}：第 2 轮，深渊领主降临`);
  await sleep(1500);
  await seg('lord', 24, () => { const b = game.dungeon.abyssRun.lord; b.hp = Math.round(b.hpMax * 0.55); });
  if (S.cmp) {
    await kill('e.abyssLord');
    await sleep(3500);   // 领主死后 2.6 秒如果按领主结算就会出结算界面
    const st = await G.evaluate(() => ({ state: coop.state, dg: game.dungeon && game.dungeon.state, result: menus.isOpen('result') }));
    ok(st.state === 'play' && st.dg === 'play' && !st.result, `场景 ${sc}：深渊领主死后队员还在地下城里（不按领主结算）`, st);
    await H.evaluate(k => { const dg = game.dungeon, b = spawnMonster(k, 420, DEPTH / 2, { lvl: 62, boss: true, mul: dg.D.hp, atkMul: dg.D.atk }); window.__cmpBoss = b; }, S.lord);
    await sleep(1000);
    await seg('boss', 24, () => { const b = window.__cmpBoss; b.hp = Math.round(b.hpMax * 0.55); });
  }
  await H.evaluate(() => { clearInterval(window.__aim); window.__killAdds = false; window.__hp.on = false; });
  await G.evaluate(() => { clearInterval(window.__stick); window.__hp.on = false; });
  const h = await H.evaluate(() => window.__hp), g = await G.evaluate(() => window.__hp);
  for (const P of [H, G]) await P.evaluate(() => { const Q = window.__hp; Q.ma = []; Q.rx = []; Q.hurt = []; Q.mech = []; });
  const R = {};
  for (const sg of S.cmp ? ['mob', 'lord', 'boss'] : ['mob', 'lord']) {
    const isT = x => sg === 'mob' ? !x.boss : x.boss;
    const hm = h.ma.filter(x => x.seg === sg && isT(x)), gr = g.rx.filter(x => x.seg === sg && isT(x)), gh = g.hurt.filter(x => x.seg === sg && (sg === 'mob' ? !x.boss : x.boss));
    const r = R[sg] = { hostActs: hm.length, hostTbl: hm.filter(x => x.i >= 0).length, hostAi: tally(hm.filter(x => x.i < 0), x => x.ai ? 'AI ' + x.ai : x.mi !== undefined ? '按编号' : x.ph !== undefined ? '阶段咆哮' : '通用动作'), hostLive: hm.filter(x => x.hits || x.ev).length,
      guestActs: gr.length, guestLive: gr.filter(x => x.hits || x.ev).length, guestGeneric: gr.filter(x => x.played && !x.hits && !x.ev).length, guestSkip: gr.filter(x => !x.played).length,
      hurt: gh.length, dmg: gh.reduce((a, x) => a + x.dmg, 0),
      names: { host: tally(hm, x => x.nm), guest: tally(gr, x => x.played ? x.nm + (x.hits || x.ev ? '' : '(空)') : x.nm + '(没播)') } };
    const seqH = hm.map(x => x.nm + (x.hits || x.ev ? '' : '(空)')).join(), seqG = gr.map(x => (x.played || '没播') + (x.hits || x.ev ? '' : '(空)')).join();
    r.same = seqH === seqG; r.mech = { host: tally(h.mech.filter(x => x.seg === sg), x => x.id), guest: tally(g.mech.filter(x => x.seg === sg), x => x.id) };
    const who = { mob: '普通怪', lord: `深渊领主 ${S.lord}`, boss: `普通区域领主 ${S.lord}（对照）` }[sg];
    ok(r.hostActs > 0 && r.same, `场景 ${sc}：${who} 的出招，队员这边逐招重播、招式名和判定都和主机一致（${r.hostActs} 招）`, { host: seqH, guest: seqG });
    ok(r.hurt > 0, `场景 ${sc}：队员被${who}打中 ${r.hurt} 次（共 ${r.dmg} 伤害）`);
    console.log(`  [${sg}] 主机出招 ${r.hostActs}（招式表 ${r.hostTbl}，表外 ${JSON.stringify(r.hostAi)}，带判定 ${r.hostLive}）→ 队员重播 ${r.guestActs}（带判定 ${r.guestLive}，空动作 ${r.guestGeneric}，没播 ${r.guestSkip}）；队员被打 ${r.hurt} 次 共 ${r.dmg}`);
    console.log(`        招式 主机 ${JSON.stringify(r.names.host)}\n        招式 队员 ${JSON.stringify(r.names.guest)}\n        领主机制启动 主机 ${JSON.stringify(r.mech.host)} / 队员傀儡 ${JSON.stringify(r.mech.guest)}`);
  }
  fs.writeFileSync(`${out}/${sc}-hits.json`, JSON.stringify({ host: h, guest: g }, null, 1));
  return R;
}
const stats = a => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y); return { avg: +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(1), p99: +s[Math.floor(s.length * 0.99)].toFixed(1), max: +s[s.length - 1].toFixed(1), n: a.length }; };
const GET = () => { const P = window.__pr, dg = game.dungeon, R = dg && dg.abyssRun, L = R && R.lord;
  return { frames: P.frames, render: P.render, stepErr: P.stepErr, raf: P.raf, gapMax: Math.round(P.gapMax), errs: P.errs.slice(), roomEnter: P.roomEnter, rounds: P.rounds, lords: P.lords, banners: P.banners, peak: P.peak,
    phase: R && R.phase, round: R && R.round, lord: L ? { kind: L.kind, hp: Math.round(L.hp), hpMax: Math.round(L.hpMax), dead: !!L.dead } : null, aroom: dg && dg.abyssRoom ? dg.abyssRoom.gx + ',' + dg.abyssRoom.gy : '', room: dg && dg.room ? dg.room.gx + ',' + dg.room.gy : '',
    ferrs: frameErrs.map(e => `${e.where} ×${e.n}：${e.msg}`), mon: ents.filter(e => e.team === 'e' && !e.dead).length, fx: fxList.length, nums: numList.length, drops: drops.length, flash: +(cam.flash || 0).toFixed(2), role: coop.role, state: coop.state, dgState: dg && dg.state, cards: document.querySelectorAll('#abytreasure .card').length }; };
try {
  for (let i = 0; i < 2; i++) {
    ok(await uiRegister(pages[i], srv.url, names[i]), `${names[i]} 注册`);
    ok(await uiCreateChar(pages[i], 0), `${names[i]} 建角色进城`);
    const r = await pages[i].evaluate(MAX_CHAR, { job: 'berserker', cd: CDMUL }); console.log(`  ${names[i]}：${JSON.stringify(r)}`);
    ok(r.job === 'berserker' && r.lvl === 60 && Math.abs(r.cdMul - CDMUL) < 1e-9, `${names[i]}：Lv60 狂战士，冷却 ×${CDMUL}`, r);
    await pages[i].evaluate(PROBE);
  }
  await pages[0].evaluate(() => netPartyInvite(null, 'bob'));
  await until(pages[1], () => menus.isOpen('nd_pinv'), null, 8000);
  await pages[1].click('.netask button:has-text("加入队伍")');
  ok(await until(pages[0], () => netParty.p && netParty.p.members.length === 2, null, 8000), '组队 2 人');
  for (const sc of SC) {
    const S = SCENARIOS[sc]; if (!S) { ok(false, `没有场景 ${sc}`); continue; }
    const H = pages[S.host], G = pages[1 - S.host], hn = names[S.host];
    console.log(`\n== 场景 ${sc}：主机 ${hn}，深渊领主 ${S.lord}${S.drops ? `，地上保持 ${S.drops} 件掉落` : ''}`);
    if (!(await H.evaluate(() => netParty.isLeader()))) {
      const id = await H.evaluate(() => net.user.id);
      await G.evaluate(id => net.send({ t: 'party:lead', id }), id);
      ok(await until(H, () => netParty.isLeader(), null, 8000), `队长移交给 ${hn}`);
    }
    for (const P of pages) await P.evaluate(() => { inv.add(makeItem('abyss_ticket', 4)); save.data.fatigue = FATIGUE_MAX; save.write(); const p = game.player; p.hp = p.hpMax; p.mp = p.mpMax; });
    const scene = await H.evaluate(id => { for (const s in SCENES) if (SCENES[s].gates.some(g => g.dungeon === id)) return s; }, DG);
    await H.evaluate(s => worldTravel(s), scene); await until(H, s => world && world.S.id === s, scene);
    await H.evaluate(id => enterDungeon(id, 0), DG);
    const allIn = await Promise.all([H, G].map(P => until(P, () => game.scene === 'dungeon' && coop.state === 'play' && game.dungeon.abyssRoom, null, 60000)));
    ok(allIn.every(Boolean), `场景 ${sc}：全队进入魔界深渊`, allIn);
    ok(await H.evaluate(() => coop.role === 'host') && await G.evaluate(() => coop.role === 'guest'), `场景 ${sc}：${hn} 是主机`);
    // 指定深渊领主（第 2 轮降临时读 dg.def.abyssLord）；清零计数
    await H.evaluate(k => { game.dungeon.def.abyssLord = k; }, S.lord);
    for (const P of pages) await P.evaluate(() => { const P = window.__pr; Object.assign(P, { stepErr: 0, gapMax: 0, ft: [], lt: [], errs: [], roomEnter: {}, rounds: [], lords: [], banners: [], samples: [], peak: { mon: 0, fx: 0, ground: 0, nums: 0, drops: 0, projs: 0 } }); P.f0 = P.frames; P.r0 = P.render; P.on = true; });
    // 穿门走到深渊柱房间（主机清房、开门、走门；队员收换房间事件跟进）
    const walk = await H.evaluate(async () => {
      const dg = game.dungeon, target = dg.abyssRoom, wait = (f, ms) => new Promise(res => { const t0 = performance.now(), iv = setInterval(() => { if (f() || performance.now() - t0 > ms) { clearInterval(iv); res(f()); } }, 100); });
      const route = () => { const prev = new Map([[dg.room, null]]), q = [dg.room]; while (q.length) { const r = q.shift(); if (r === target) break; for (const d in r.doors) { const n = r.doors[d]; if (n && !prev.has(n) && n.type !== 'boss') { prev.set(n, { r, d }); q.push(n); } } }
        const dirs = []; for (let c = target; prev.get(c); c = prev.get(c).r) dirs.unshift(prev.get(c).d); return dirs; };
      const log = [];
      for (const dir of route()) {
        await wait(() => !dg.transition, 5000);
        const ok = await wait(() => { if (!dg.doorsOpen) for (const e of [...ents]) if (e.team === 'e' && !e.dead && !e.abyssMob) { e.invul = 0; e.hp = 0; killEnt(e, game.player, {}); } return dg.doorsOpen; }, 15000);
        if (!ok) return { stuck: dg.room.gx + ',' + dg.room.gy, log };
        const next = dg.room.doors[dir]; dg.go(dir); log.push(dir);
        await wait(() => !dg.transition && dg.room === next, 5000);
      }
      return { at: dg.room === target, log };
    });
    ok(walk.at, `场景 ${sc}：主机走到深渊柱房间（${walk.log.join('→') || '起点就是'}）`, walk);
    ok(await until(G,() => game.dungeon && game.dungeon.room === game.dungeon.abyssRoom && !game.dungeon.transition, null, 15000), `场景 ${sc}：队员跟进深渊柱房间`);
    ok(await until(H, () => game.dungeon.abyssRun.phase === 'pillar' && ents.some(e => e.kind === 'abyssPillar' && !e.dead), null, 8000), `场景 ${sc}：深渊柱出现`);
    if (S.hit) { await hitTest(H, G, sc, S); await leave(H, G, sc); continue; }
    // 两边机器人一起打（正常速度），血蓝保持满（只测卡顿 / 报错，不测难度）；场景 B：地上一直保持很多掉落
    for (const P of pages) await P.evaluate(n => {
      bot.on = true; game.speedMul = 1;
      window.__keep = setInterval(() => { const p = game.player; if (!p || game.scene !== 'dungeon') return; p.hp = p.hpMax; p.mp = p.mpMax; if (p.dead) p.dead = false;
        if (n && drops.length < n) for (let i = drops.length; i < n; i++) spawnDrop(i % 3 ? { kind: 'gold', amount: 100 + i, x: rnd(game.room.x0 + 80, game.room.x1 - 80), y: rnd(10, DEPTH - 10), z: 20 } : { kind: 'item', item: makeItem('m_cosmos', 1), x: rnd(game.room.x0 + 80, game.room.x1 - 80), y: rnd(10, DEPTH - 10), z: 20 }); }, 400);
    }, S.drops || 0);
    const t0 = Date.now(); let shot = 0, lastLog = 0, fin = false;
    while (Date.now() - t0 < FIGHT_MS) {
      await sleep(1000);
      const h = await H.evaluate(GET).catch(e => ({ err: String(e) }));
      if (Date.now() - lastLog > 10000) { lastLog = Date.now(); const g = await G.evaluate(GET).catch(e => ({ err: String(e) }));
        console.log(`  ${Math.round((Date.now() - t0) / 1000)}s 主机 ${h.phase}${h.round || ''} 怪${h.mon} 特效${h.fx} 数字${h.nums} 掉落${h.drops} 帧${h.frames} 画${h.render} step出错${h.stepErr} 报错${(h.errs || []).length} 领主${h.lord ? `${h.lord.kind} ${h.lord.hp}/${h.lord.hpMax}` : '-'} | 队员 怪${g.mon} 特效${g.fx} 帧${g.frames} 画${g.render} step出错${g.stepErr} 报错${(g.errs || []).length}`); }
      if (!shot && h.lords && h.lords.length) { shot = 1; await sleep(1500); await Promise.all([H, G].map((P, i) => P.screenshot({ path: `${out}/${sc}-lord-${i ? 'guest' : 'host'}.png` }))); }
      if (h.phase === 'done' && h.cards) { fin = true; break; }
    }
    for (const P of pages) await P.evaluate(() => { bot.on = false; clearInterval(window.__keep); window.__pr.on = false; });
    const [h, g] = await Promise.all([H, G].map(P => P.evaluate(GET)));
    const perf = await Promise.all([H, G].map(P => P.evaluate(() => { const P = window.__pr, s = P.ft.slice().sort((a, b) => a - b); return { ft: s.length ? { avg: +(s.reduce((a, b) => a + b, 0) / s.length).toFixed(1), p99: +s[Math.floor(s.length * 0.99)].toFixed(1), max: +s[s.length - 1].toFixed(1) } : null, lt: { n: P.lt.length, max: Math.max(0, ...P.lt), total: P.lt.reduce((a, b) => a + b, 0) }, frames: P.frames - P.f0, render: P.render - P.r0, samples: P.samples }; })));
    await Promise.all([H, G].map((P, i) => P.screenshot({ path: `${out}/${sc}-end-${i ? 'guest' : 'host'}.png` })));
    for (const [who, x, pf] of [['主机', h, perf[0]], ['队员', g, perf[1]]]) {
      console.log(`  ${who}：帧 ${pf.frames}（画出 ${pf.render}）step 出错 ${x.stepErr} 次  帧耗时 ${JSON.stringify(pf.ft)}  rAF 最长间隔 ${x.gapMax}ms  长任务 ${JSON.stringify(pf.lt)}  峰值 ${JSON.stringify(x.peak)}`);
      console.log(`        roomEnter ${JSON.stringify(x.roomEnter)}  轮次 ${JSON.stringify(x.rounds)}  领主 ${JSON.stringify(x.lords)}  横幅 ${JSON.stringify(x.banners)}`);
      if (x.errs.length) console.log(`        报错（前 3 条，共 ${x.errs.length}）：\n          ` + x.errs.slice(0, 3).map(s => s.split('\n').slice(0, 8).join('\n          ')).join('\n          ---\n          '));
    }
    fs.writeFileSync(`${out}/${sc}-samples.json`, JSON.stringify({ host: perf[0].samples, guest: perf[1].samples }));
    ok(fin, `场景 ${sc}：打完两轮 + 深渊领主，派对结束（深渊宝藏 ${h.cards} 张牌，用时 ${Math.round((Date.now() - t0) / 1000)} 秒）`, { phase: h.phase, round: h.round, lord: h.lord });
    ok(h.roomEnter[h.aroom] === 1, `场景 ${sc}：主机进入深渊柱房间的 roomEnter 只有 1 次`, h.roomEnter);
    ok(Object.values(h.roomEnter).every(n => n === 1) && Object.values(g.roomEnter).every(n => n === 1), `场景 ${sc}：每个房间的 roomEnter 两边都只有 1 次`, { host: h.roomEnter, guest: g.roomEnter });
    ok(h.rounds.map(r => r.n).join() === '1,2' && !g.rounds.length, `场景 ${sc}：每轮只开始一次（主机 ${h.rounds.map(r => r.n).join()}，队员不跑轮次逻辑）`, { host: h.rounds, guest: g.rounds });
    ok(h.lords.length === 1 && h.lords[0].kind === S.lord && !g.lords.length, `场景 ${sc}：深渊领主 ${S.lord} 只降临一次`, { host: h.lords, guest: g.lords });
    const bn = k => h.banners.filter(s => s.includes(k)).length;
    ok(bn('第 1/2 轮') === 1 && bn('第 2/2 轮') === 1 && bn('降临了') === 1 && !g.banners.length, `场景 ${sc}：轮次 / 降临横幅各只出现一次`, { host: h.banners, guest: g.banners });
    ok(h.peak.mon <= 30 && g.peak.mon <= 30, `场景 ${sc}：怪物数量有界（主机峰值 ${h.peak.mon} / 队员 ${g.peak.mon}）`);
    ok(!h.stepErr && !g.stepErr && !h.errs.length && !g.errs.length && !h.ferrs.length && !g.ferrs.length, `场景 ${sc}：两边都没有逐帧报错（主机 step 出错 ${h.stepErr} 次、错误记录 ${h.ferrs.length} 种 / 队员 ${g.stepErr} 次、${g.ferrs.length} 种）`, [...h.ferrs, ...g.ferrs, ...[...h.errs, ...g.errs].slice(0, 2).map(s => s.split('\n').slice(0, 5).join(' | '))]);
    ok(perf.every(p => p.render >= p.frames * 0.97), `场景 ${sc}：每帧都画出来了（主机 ${perf[0].render}/${perf[0].frames}，队员 ${perf[1].render}/${perf[1].frames}）`);
    ok(h.gapMax < 3000 && g.gapMax < 3000 && perf.every(p => p.lt.max < 3000), `场景 ${sc}：没有卡死（rAF 最长间隔 ${h.gapMax} / ${g.gapMax}ms，最长任务 ${perf[0].lt.max} / ${perf[1].lt.max}ms）`);
    ok(g.state === 'play' && g.dgState === 'play', `场景 ${sc}：派对结束后队员还在地下城里（深渊领主死了不按领主结算）`, { state: g.state, dg: g.dgState });
    ok(h.flash < 0.3 && g.flash < 0.3, `场景 ${sc}：屏幕闪光正常衰减（${h.flash} / ${g.flash}）`);
    await leave(H, G, sc);
  }
  const errs = [...new Set(dumpErrors(players).map(s => s.slice(0, 300)))];
  ok(!errs.length, '页面没有报错', errs.slice(0, 5));
  // 安全网（game.js frameErr）：怪物 AI 每帧抛错、特效画到一半抛错（留下 save + 叠加模式）→ 游戏照常跑、每帧照常画；错误只 console.error 一次、记进 frameErrs 并上报服务端
  const A = pages[0];
  await A.evaluate(() => { const P = window.__pr; P.errs = []; P.on = true; P.r1 = P.render; P.s1 = game.t; startTestRoom(); game.speedMul = 1;
    const m = spawnMonster('goblin', 700, 80); m.control = () => { throw new Error('安全网探针：AI 出错'); };
    addFx({ x: 600, y: 80, z: 0, dur: 0.6, draw(c) { c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.3; throw new Error('安全网探针：画特效出错'); } }); });
  await until(A, () => game.t - window.__pr.s1 > 1.5, null, 15000);
  const net1 = await A.evaluate(async () => { const P = window.__pr, list = (await net.api('GET', '/api/admin/cerr')).list;
    return { rendered: P.render - P.r1, dt: +(game.t - P.s1).toFixed(2), ferrs: frameErrs.map(e => ({ where: e.where, n: e.n, msg: e.msg })), logged: P.errs.filter(s => s.includes('安全网探针')).length, comp: wctx.globalCompositeOperation, alpha: wctx.globalAlpha,
      server: list.filter(e => e.msg.includes('安全网探针')).map(e => e.place + ' ' + e.user), goblin: ents.filter(e => e.kind === 'goblin').length }; });
  console.log('  安全网：' + JSON.stringify(net1));
  const fe = w => net1.ferrs.find(e => e.where === w && e.msg.includes('安全网探针'));
  ok(net1.rendered > 30 && fe('control:goblin') && fe('control:goblin').n > 30, `安全网：AI 每帧抛错时游戏照常跑、每帧照常画（${net1.dt} 秒画了 ${net1.rendered} 帧，记录 ${fe('control:goblin') ? fe('control:goblin').n : 0} 次）`, net1);
  ok(fe('render') && net1.comp === 'source-over' && net1.alpha === 1, `安全网：画到一半抛错后画布状态复位（${net1.comp} / ${net1.alpha}）`, net1);
  ok(net1.logged === 2, `安全网：同一个错误只 console.error 一次（两种错误共 ${net1.logged} 条）`, net1);
  ok(net1.server.length === 2, `安全网：错误上报到服务端（${net1.server.join('、')}）`, net1);
} catch (e) { ok(false, '异常：' + (e.stack || e)); }
await close(); await srv.stop();
const r = result(); console.log(`\n${r.total - r.fails}/${r.total} 通过`); process.exit(r.fails ? 1 : 0);
