// 联机：领主差异化 P0 的新原语（docs/BOSS_SPEC.md §7）——2 个真实客户端组队进比尔马克帝国试验场，第一个房间清完后由主机刷领主、强制出招 / 启动机制。
// 主机本人无敌站在最左边，所有怪盯队员；队员贴着领主站、不还手（血低于 60% 补满）。每段对比（做法同 mp_bosses.mjs）：
//   主机发出的钩子事件（msLeap / msLanes / msMark / msPool / msPlant / msFuse）队员一一收到、时间差 < 0.3 秒；机制启动两边一致；
//   地面预警两边一一配对（同类型同半径、时间差 < 0.3 秒）；队员被新原语打中（按 msNetSrc 统计）；两边都没有报错
// 场景：SK 斯卡萨（S1 样板：前爪拍地、极寒龙息、吹气、龙蛋、蓄力龙息 stagger、起飞 form）
//       LB 技能样品 msLab（leap 跳砸、lanes 分道、mark 标记、pool 毒区、plant 炸弹）——招式按编号重播，随机结果走 hook
//       MX 机制镜像（arena / facing / stance / duo / gauntlet / protect）：队员这边按主机的参数显示、按自己的站位 / 朝向结算
// 用法：node test/mp_bossprims.mjs [SK,LB,MX]
import fs from 'node:fs';
import { startServer, launchPlayers, ok, result, sleep, until, uiRegister, uiCreateChar, dumpErrors } from './net_lib.mjs';
const SC = (process.argv[2] || 'SK,LB,MX').split(',');
const DG = 'bilmark', LV = 55;
const out = 'test/shots/mp_bossprims'; fs.mkdirSync(out, { recursive: true });
const srv = await startServer();
const { players, close } = await launchPlayers(2);
const pages = players.map(p => p.page), names = ['alice', 'bob'], [H, G] = pages;
const PROBE = () => {
  if (window.__q) return;
  const Q = window.__q = { on: false, seg: '', tg: [], hk: [], mech: [], hurt: [], st: [] };
  const tg0 = window.telegraph; window.telegraph = function (o) { const g = tg0.apply(this, arguments); if (Q.on) Q.tg.push({ seg: Q.seg, T: Date.now(), kind: g.kind, r: Math.round(g.r), g }); return g; };
  const send0 = coop.send; coop.send = function (d, to) { if (Q.on && d && d.k === 'mech' && coop.role === 'host') { if (d.e === 'hook') Q.hk.push({ seg: Q.seg, h: d.d.h, T: Date.now() }); else if (d.e === 'start') Q.mech.push({ seg: Q.seg, id: d.use, T: Date.now() }); } return send0.call(this, d, to); };
  const cr0 = window.coopMechRecv; window.coopMechRecv = function (d) { if (Q.on && d) { if (d.e === 'hook') Q.hk.push({ seg: Q.seg, h: d.d && d.d.h, T: Date.now() }); else if (d.e === 'start') Q.mech.push({ seg: Q.seg, id: d.use, T: Date.now() }); } return cr0.apply(this, arguments); };
  const hu0 = game.onPlayerHurt; game.onPlayerHurt = function (p, dmg, a) { if (Q.on && p === game.player) Q.hurt.push({ seg: Q.seg, dmg: Math.round(dmg), mech: msNetSrc || null, kind: a && a.kind }); return hu0.call(this, p, dmg, a); };
};
const DUMP = () => { const Q = window.__q; return { ...Q, tg: Q.tg.map(({ g, ...x }) => ({ ...x, mech: g.mech || null })) }; };
function matchTg(ht, gt, endT) {
  const used = new Set(), miss = [], dts = [];
  for (const a of ht.filter(x => x.T < endT - 500)) {
    let best = -1, bd = 1e9; gt.forEach((b, j) => { if (used.has(j) || b.kind !== a.kind || b.r !== a.r) return; const d = Math.abs(b.T - a.T); if (d < bd) { bd = d; best = j; } });
    if (best >= 0 && bd <= 300) { used.add(best); dts.push(bd); } else miss.push(`${a.kind}/${a.r}`);
  }
  return { host: ht.length, matched: dts.length, miss, maxDt: dts.length ? Math.max(...dts) : 0 };
}
function matchEv(hl, gl, key) {
  const A = {}, B = {}, dt = []; for (const x of hl) (A[x[key]] ??= []).push(x.T); for (const x of gl) (B[x[key]] ??= []).push(x.T);
  for (const k in A) A[k].forEach((T, i) => { if (B[k] && B[k][i] !== undefined) dt.push(Math.abs(B[k][i] - T)); });
  const cnt = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v.length]));
  return { host: cnt(A), guest: cnt(B), same: JSON.stringify(cnt(A)) === JSON.stringify(cnt(B)), maxDt: Math.max(0, ...dt) };
}
const tally = (L, f) => { const o = {}; for (const x of L) { const k = f(x); o[k] = (o[k] || 0) + 1; } return o; };
const segEnd = {};
async function seg(name, fn) { for (const P of pages) await P.evaluate(n => { window.__q.seg = n; window.__q.on = true; }, name); await fn(); await sleep(900); segEnd[name] = Date.now(); for (const P of pages) await P.evaluate(() => { window.__q.on = false; }); }
const hostWait = sec => H.evaluate(s => new Promise(res => { const t0 = game.t, iv = setInterval(() => { if (game.t - t0 >= s) { clearInterval(iv); res(); } }, 50); }), sec);
async function checkSeg(sc, name, hooks, mechs) {
  const h = await H.evaluate(DUMP), g = await G.evaluate(DUMP), f = x => x.seg === name;
  const hk = matchEv(h.hk.filter(f), g.hk.filter(f), 'h'), me = matchEv(h.mech.filter(f), g.mech.filter(f), 'id'), tm = matchTg(h.tg.filter(f), g.tg.filter(f), segEnd[name]);
  const mh = tally(g.hurt.filter(f), x => x.mech || ('hit:' + (x.kind || '?')));
  console.log(`  [${name}] 钩子 主机 ${JSON.stringify(hk.host)} / 队员 ${JSON.stringify(hk.guest)} ${hk.maxDt}ms；机制 主机 ${JSON.stringify(me.host)} / 队员 ${JSON.stringify(me.guest)} ${me.maxDt}ms`);
  console.log(`        预警 主机 ${tm.host}，队员配上 ${tm.matched}，最大时间差 ${tm.maxDt}ms，没配上 ${JSON.stringify(tm.miss)}；队员挨打 ${JSON.stringify(mh)}`);
  ok(hooks.every(k => hk.host[k] > 0) && hk.same && hk.maxDt < 300, `${sc}：钩子 ${hooks.join(' / ')} 队员一一收到（${hk.maxDt}ms）`, hk);
  ok(mechs.every(k => me.host[k] > 0) && me.same && me.maxDt < 300, `${sc}：机制启动两边一致（${JSON.stringify(me.host)}）`, me);
  ok(tm.host > 0 && !tm.miss.length && tm.maxDt < 300, `${sc}：地面预警队员这边一个不少（${tm.matched}/${tm.host}，最大 ${tm.maxDt}ms）`, tm);
  return { mh };
}
const spawnLord = (k, x) => H.evaluate(async ([k, x]) => { await loadBundles(monBundles([k])); const dg = game.dungeon, b = spawnMonster(k, x, DEPTH / 2, { lvl: 50, boss: true, mul: dg.D.hp, atkMul: dg.D.atk }); b.speed = 0; window.__boss = b; return b.nid; }, [k, x]);
const dropLord = () => H.evaluate(() => { const b = window.__boss; if (!b) return; b.boss = false; b.invul = 0; b.hp = 0; killEnt(b, game.player, {}); window.__boss = null; });
const killAdds = () => H.evaluate(() => { for (const e of [...ents]) if (e.team === 'e' && !e.dead && e !== window.__boss) { e.invul = 0; e.hp = 0; killEnt(e, game.player, {}); } });
// 主机：让领主朝队员出招（出招期间 game.player 换成队员的影子：技能里的“目标”就是队员）
const force = id => H.evaluate(id => { const b = window.__boss, g = [...coop.mates.values()][0], P = game.player; b.tgt = g; b.stun = 0; if (b.act) b.endAct(); b.setState('idle'); const i = b.def_.attacks.findIndex(a => a.msId === id || a.ms === id); game.realPlayer = P; game.player = g; try { return monForceSkill(b, i); } finally { game.player = P; game.realPlayer = null; } }, id);
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
  ok(allIn.every(Boolean), '全队进图', allIn);
  await sleep(1500); await killAdds();
  ok(await until(H, () => game.dungeon.doorsOpen, null, 10000), '第一个房间清完');
  await H.evaluate(() => { bot.on = false; game.speedMul = 1; window.__aim = setInterval(() => { const g = [...coop.mates.values()][0], p = game.player; p.hp = p.hpMax; p.invul = 1e9; if (p.x > 120) { p.x = 60; p.y = DEPTH / 2; }
    for (const m of ents) if (m.nid && !m.dead && m.team === 'e') { m.tgt = g; m.tgtT = game.t + 1e6; if (m === window.__boss) m.aiCd = Math.max(m.aiCd || 0, 1); } }, 250); });
  await G.evaluate(() => { bot.on = false; game.speedMul = 1; window.__stick = setInterval(() => { const p = game.player; if (p.hp < p.hpMax * 0.6) p.hp = p.hpMax; if (p.st === 'idle' || p.st === 'walk') p.invul = 0; if (p.status) delete p.status.freeze;
    const B = [...coop.puppets.values()].find(m => m.boss && !m.dead && ents.includes(m)); if (B && p.st !== 'hit' && p.st !== 'down' && p.st !== 'air' && p.st !== 'held' && !p.act && Math.abs(p.x - (B.x - 150)) > 90) { p.x = B.x - 150; p.y = B.y; } }, 150); });

  if (SC.includes('SK')) {
    console.log('\n== SK 斯卡萨（S1）');
    const nid = await spawnLord('skasa', 800);
    ok(await until(G, id => coop.puppets.has(id), nid, 8000), 'SK：队员这边有斯卡萨的傀儡');
    await sleep(1200);
    await seg('sk', async () => {
      await force('claw'); await hostWait(2.2);
      await force('breath'); await hostWait(3.2);
      await force('blow'); await hostWait(2.4);
      await force('eggs'); await hostWait(1.5);
      await H.evaluate(() => { for (const o of ents.filter(e => e.kind === 'skasaEgg' && !e.dead)) o.msFuseT = 11.8; }); await hostWait(1.2);
      await H.evaluate(() => msMechStart(window.__boss, SKASA_CHARGE)); await hostWait(5.5);   // 斯卡萨自己的两个机制（定义时预编译，两边编号一致）：蓄力龙息不打断 → 大范围龙息
      await H.evaluate(() => { const st = msMechStart(window.__boss, SKASA_FLY); st.t = st.p.dur - 2.5; });
      await hostWait(1.2); const gz = await G.evaluate(id => { const m = coop.puppets.get(id); return m ? Math.round(m.z) : -1; }, nid);
      ok(gz > 100, `SK：队员这边的斯卡萨也飞起来了（z = ${gz}）`);
      await hostWait(3.5);
    });
    const r = await checkSeg('SK', 'sk', ['msPlant'], ['stagger', 'form']);
    const hb = await G.evaluate(() => [...coop.puppets.values()].filter(m => m.kind === 'babySkasa' && !m.dead).length);
    ok(hb > 0, `SK：龙蛋到点孵出的幼龙队员那边也有（${hb}）`);
    ok(Object.keys(r.mh).length >= 2, `SK：队员被斯卡萨的招式打中（${JSON.stringify(r.mh)}）`, r.mh);
    await G.screenshot({ path: `${out}/sk-guest.png` });
    await dropLord(); await killAdds(); await sleep(1500);
  }

  if (SC.includes('LB')) {
    console.log('\n== LB 技能样品（hook 同步的技能）');
    const nid = await spawnLord('msLab', 700);
    ok(await until(G, id => coop.puppets.has(id), nid, 8000), 'LB：队员这边有样品怪的傀儡');
    await sleep(1000);
    await seg('lb', async () => {
      await force('leap'); await hostWait(2.8);
      await force('lanes'); await hostWait(2.6);
      await force('mark'); await hostWait(1.8);
      await force('pool'); await hostWait(1.8);
      await force('plant'); await hostWait(2.6);
    });
    const r = await checkSeg('LB', 'lb', ['msLeap', 'msLanes', 'msMark', 'msPool', 'msPlant', 'msFuse'], []);
    const hookHurt = Object.entries(r.mh).filter(([k]) => /^hook:ms|^pool/.test(k)).reduce((a, [, n]) => a + n, 0);
    ok(hookHurt >= 2, `LB：队员被 hook 同步的技能打中 ${hookHurt} 次（${JSON.stringify(r.mh)}）`, r.mh);
    await G.screenshot({ path: `${out}/lb-guest.png` });
    await dropLord(); await killAdds();
  }
  if (SC.includes('MX')) {
    console.log('\n== MX 机制镜像（arena 地砖、facing 凝视、stance 模式、duo 搭档、gauntlet 车轮战、protect 保护）');
    const nid = await spawnLord('msLab', 700);
    ok(await until(G, id => coop.puppets.has(id), nid, 8000), 'MX：队员这边有领主傀儡');
    await sleep(800);
    await seg('mx', async () => {
      await H.evaluate(() => { const b = window.__boss; msMechStart(b, { use: 'arena', kind: 'tiles', cols: 4, hot: 0.75, every: 1.2, warn: 0.3, frac: 0.03, tick: 0.3, dur: 4.5 }); msMechStart(b, { use: 'stance', every: [1, 1], modes: [{ id: 'a', col: '#ffb030', dmgTaken: 0.5 }, { id: 'b', col: '#6ab0ff' }] }); });
      await hostWait(1.2); await H.evaluate(() => msMechStart(window.__boss, { use: 'facing', mode: 'toward', windup: 1.0, frac: 0.05 }));
      await hostWait(3.6);
      await H.evaluate(() => { const b = window.__boss; msMechStart(b, { use: 'duo', with: ['msLab'] }); msMechStart(b, { use: 'protect', kind: 'msHeart', lives: 3, threat: 'msLab', at: 0.2 }); msMechStart(b, { use: 'gauntlet', gap: 0.3, waves: [{ kind: 'msLab', name: '测试骑士' }] }); });
      await hostWait(2.5);
    });
    await checkSeg('MX', 'mx', [], ['arena', 'stance', 'facing', 'duo', 'protect', 'gauntlet']).catch(() => {});
    const g = await G.evaluate(() => ({ hurt: window.__q.hurt.filter(x => x.seg === 'mx' && (x.mech === 'arena' || x.mech === 'facing')).length, gates: [...coop.puppets.values()].filter(m => m.kind === 'msHeart').length, stance: [...coop.puppets.values()].some(m => m.msStanceSt) }));
    ok(g.hurt > 0 && g.gates > 0 && g.stance, `MX：队员被地砖 / 凝视按自己的位置结算（${g.hurt} 次）、保护物件 ${g.gates}、架势光环 ${g.stance}`, g);
    await dropLord(); await killAdds();
  }
  for (const P of pages) await P.evaluate(() => { clearInterval(window.__aim); clearInterval(window.__stick); });
  const fe = await Promise.all(pages.map(P => P.evaluate(() => frameErrs.map(e => `${e.where} ×${e.n}：${e.msg}`))));
  ok(fe.every(l => !l.length), '两边都没有逐帧报错', fe);
  await G.evaluate(() => { menus.closeAll(); goTown(); }); await H.evaluate(() => { menus.closeAll(); goTown(); });
  const errs = [...new Set(dumpErrors(players).map(s => s.slice(0, 300)))];
  ok(!errs.length, '页面没有报错', errs.slice(0, 5));
} catch (e) { ok(false, '异常：' + (e.stack || e)); }
await close(); await srv.stop();
const r = result(); console.log(`\n${r.total - r.fails}/${r.total} 通过`); process.exit(r.fails ? 1 : 0);
