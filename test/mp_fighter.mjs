// 组队刷图 · 男格斗家（B9）：鬼剑士当队长（主机）+ 柔道家当队员，一起进地下城
//   1) 队员抓主机的怪：抓住（主机挂到影子上）→ 抛投 throwArc（主机按同一条弧线飞到同一个落点）；抓倒地（gd）/ 一次抓多个（gm）的主机判定
//   2) 格斗家的职业状态同步到影子：可见 BUFF、念气珠、装填数；念气罩 party_sync（主机那边生成罩子、站在里面无敌）
//   3) 机器人一起清完地下城：命中 / 击杀两边一致、没有页面报错
// 用法：node test/mp_fighter.mjs [地下城=lorien] [等级=20] [转职=grappler]（约 1~2 分钟；网址带 ?fighter=1，格斗家没开放也能测）
import fs from 'node:fs';
import { startServer, launchPlayers, ok, result, sleep, until, uiRegister, uiCreateChar, dumpErrors } from './net_lib.mjs';
const DG = process.argv[2] || 'lorien', LV = +(process.argv[3] || 20), JOB = process.argv[4] || 'grappler';
const out = 'test/shots/mp_fighter'; fs.mkdirSync(out, { recursive: true });
const srv = await startServer();
const { players, close } = await launchPlayers(2);
const [A, B] = players.map(p => p.page);   // A = 鬼剑士队长（主机），B = 格斗家队员
const url = `${srv.url}?fighter=1&x=`;   // uiRegister 会在后面接 ?mute
try {
  ok(await uiRegister(A, url, 'alice'), 'alice（鬼剑士）注册');
  ok(await uiCreateChar(A, 0), 'alice 建鬼剑士进城');
  ok(await uiRegister(B, url, 'bob'), 'bob（格斗家）注册');
  ok(await uiCreateChar(B, 3), 'bob 建格斗家进城（?fighter=1 时选角第 4 张卡“格斗家”可选）');
  ok(await B.evaluate(() => game.player && game.player.cls === 'fighter'), 'bob 是格斗家');
  await A.evaluate(lv => { testLoadout(lv); save.write(); }, LV);
  await B.evaluate(({ lv, job }) => {
    testLoadout(lv); game.job = job; save.data.job = job; Object.assign((save.data.flags ??= {}), { awaken: lv >= 21 });
    const ids = CLASSES.fighter.jobs[job].skills.filter(id => SKILLS[id].lvReq <= lv); for (const id of ids) game.skillLv[id] = Math.max(game.skillLv[id] || 0, 3);
    game.skillBar = ids.filter(id => !SKILLS[id].passive).concat(['f_knee', 'f_highkick', 'f_seismic']).slice(0, 14); while (game.skillBar.length < 14) game.skillBar.push(null);
    recalcStats(game.player); game.player.hp = game.player.hpMax; game.player.mp = game.player.mpMax; save.write();
  }, { lv: LV, job: JOB });
  // 组队：alice 邀请 bob
  await A.evaluate(() => netPartyInvite(null, 'bob'));
  await until(B, () => menus.isOpen('nd_pinv'), null, 5000);
  await B.click('.netask button:has-text("加入队伍")');
  ok(await until(A, () => netParty.p && netParty.p.members.length === 2, null, 8000), '组队 2 人');
  const scene = await A.evaluate(id => { for (const s in SCENES) if (SCENES[s].gates.some(g => g.dungeon === id)) return s; }, DG);
  await A.evaluate(s => worldTravel(s), scene); await until(A, s => world && world.S.id === s, scene);
  await A.evaluate(id => enterDungeon(id, 0), DG);
  const allIn = await Promise.all([A, B].map(P => until(P, () => game.scene === 'dungeon' && coop.state === 'play', null, 30000)));
  ok(allIn.every(Boolean), '一起进入地下城', allIn);
  ok(await A.evaluate(() => coop.role === 'host') && await B.evaluate(() => coop.role === 'guest'), '鬼剑士是主机，格斗家是队员');
  await sleep(1200);
  // 主机上把怪定住（测试用：抓 / 扔的位置才比得了）
  await A.evaluate(() => { for (const m of ents) if (m.nid && m.team === 'e' && !m.dead) { m.control = () => {}; m.vx = m.vy = 0; } });
  const ghostOk = await A.evaluate(() => { const g = [...coop.mates.values()][0]; return !!g && g.cls === 'fighter' && jobOf(g); });
  ok(ghostOk === JOB, `主机看到的队友影子是格斗家（${ghostOk}）`, ghostOk);

  // ---- 1) 队员抓主机的怪 → 抛投 ----
  const pick = await B.evaluate(() => {
    const p = game.player, m = [...coop.puppets.values()].find(m => !m.dead && !m.noGrab && !m.boss && (m.weight || 1) <= 2.2 && ents.includes(m)); if (!m) return null;
    const R = game.room; p.x = clamp(m.x - 60, R.x0 + 30, R.x1 - 360); p.y = m.y; p.face = 1; m.x = p.x + 60; m.y = p.y;   // 本地先对齐（主机那边下一步也摆到同一个位置）
    return { id: m.nid, x: Math.round(m.x), y: Math.round(m.y), px: p.x };
  });
  ok(!!pick, '找到一只能抓的怪', pick);
  await A.evaluate(P => { const m = coop.puppets.get(P.id); if (m) { m.x = P.x; m.y = P.y; m.vx = m.vy = 0; m.hp = m.hpMax = 1e6; } }, pick);   // 血加厚：一脚踢不死才看得到飞行
  await sleep(400);
  const x0 = await A.evaluate(id => Math.round(coop.puppets.get(id).x), pick.id);
  const thrown = await B.evaluate(id => {
    const p = game.player, m = coop.puppets.get(id); p.mp = p.mpMax; p.cool = {};
    window.__arc = null;
    castSkill(p, 'fg_fling', false, null);
    return new Promise(res => { let n = 0; const iv = setInterval(() => { if (m.thrown && !window.__arc) window.__arc = { x1: Math.round(m.thrown.x1), y1: Math.round(m.thrown.y1) }; if (++n > 60 || (window.__arc && !m.thrown && p.st !== 'act')) { clearInterval(iv); res({ arc: window.__arc, sent: coop.stats.sentHits }); } }, 30); });
  }, pick.id);
  ok(!!(thrown && thrown.arc), '队员本地：抓住并踢飞（throwArc）', thrown);
  const host = await A.evaluate(({ id, x1 }) => new Promise(res => { const m = coop.puppets.get(id); let n = 0; const iv = setInterval(() => { if (++n > 80 || (!m.thrown && m.st !== 'held' && (coop.stats.throws || 0) > 0 && Math.abs(m.x - x1) < 80)) { clearInterval(iv); res({ grabs: coop.stats.grabs || 0, throws: coop.stats.throws || 0, rej: coop.stats.grabRej || [], x: Math.round(m.x), st: m.st, hp: m.hp, hpMax: m.hpMax }); } }, 50); }), { id: pick.id, x1: thrown.arc ? thrown.arc.x1 : 0 });
  ok(host.grabs >= 1 && !host.rej.length, `主机：怪被挂到队员的影子上（抓住 ${host.grabs} 次，没有被拒）`, host);
  ok(host.throws === 1, '主机：收到一次投掷（影子重放招式时不再自己扔）', host);
  ok(thrown.arc && Math.abs(host.x - thrown.arc.x1) < 70 && Math.abs(host.x - x0) > 150, `主机上的怪飞到同一个落点（主机 x=${host.x}，队员落点 ${thrown.arc && thrown.arc.x1}，起点 ${x0}）`, { host, thrown, x0 });
  ok(host.hp < host.hpMax, '抛投的伤害由队员结算后在主机扣血', host);
  // 抓倒地（gd）+ 一次抓多个（gm）：主机按同样的规则判定
  const multi = await A.evaluate(() => {
    const g = [...coop.mates.values()][0], uid = g.uid, L = [...coop.puppets.values()].filter(m => !m.dead && !m.noGrab && !m.boss && ents.includes(m) && !m.heldBy).slice(0, 2); if (L.length < 2) return { n: L.length };
    for (const m of L) { m.grabProt = 0; m.thrown = null; } L[0].setState('down'); L[0].z = 0;
    const out = {}; const sent = []; const s0 = coop.send; coop.send = function (m, to) { sent.push(m.k); return s0.call(this, m, to); };
    coop.remoteGrab(uid, { id: L[0].nid, g: 1, gm: 1 }); out.downNoGd = L[0].heldBy === g; out.gbx = sent.includes('gbx');
    coop.remoteGrab(uid, { id: L[0].nid, g: 1, gd: 1, gm: 5 }); coop.remoteGrab(uid, { id: L[1].nid, g: 1, gm: 5 });
    out.held = L.map(m => m.heldBy === g); out.n = grabsOf(g).length;
    for (const m of L) coop.remoteGrab(uid, { id: m.nid, g: 0 }); out.after = grabsOf(g).length;
    coop.send = s0; return out;
  });
  ok(multi.gbx && !multi.downNoGd, '倒地的怪：没带 gd（不能抓倒地）→ 主机拒绝并回 gbx', multi);
  ok(multi.held && multi.held.every(Boolean) && multi.n === 2 && multi.after === 0, '带 gd 抓倒地 + gm 一次抓两个：两只都挂到影子上，放开后清空', multi);

  // ---- 2) 职业状态同步到影子 ----
  await B.evaluate(() => { const p = game.player; p.buffs.fg_overgrab = { t: 60 }; p.buffs.fn_spiral = { t: 1e9, lv: 1 }; fnOrbs(p).on = [true, true, false, true, false]; const Q = chargesOf(p, 'fb_poison'); Q.n = 3; Q.cap = 10; Q.rl = false; });
  const vis = await until(A, () => { const g = [...coop.mates.values()][0]; return g.buffs.fg_overgrab && g.buffs.fn_spiral && fnOrbs(g).on.join() === 'true,true,false,true,false' && g.charges && g.charges.fb_poison && g.charges.fb_poison.n === 3; }, null, 4000);
  ok(vis, '影子：暴力抓取 / 念气环绕 BUFF、念气珠（5 颗里的第 1、2、4 颗）、毒瓶装填 3/10 和本人一致');
  await B.evaluate(() => { const p = game.player; delete p.buffs.fg_overgrab; delete p.buffs.fn_spiral; });
  ok(await until(A, () => { const g = [...coop.mates.values()][0]; return !g.buffs.fg_overgrab && !g.buffs.fn_spiral; }, null, 4000), '本人的 BUFF 没了，影子上的也跟着去掉（影子不会自己走时间）');
  // 念气罩：队员放 → 主机那边在同一个位置生成罩子，站在罩里无敌
  const gz = await B.evaluate(() => { const p = game.player; partyCast('fn_guard', { x: Math.round(p.x), y: Math.round(p.y), r: 180, t: 1.9, rk: fnRk() }, p); return { x: Math.round(p.x), y: Math.round(p.y) }; });
  const guard = await A.evaluate(G => new Promise(res => { let n = 0; const iv = setInterval(() => { const s = summonsOf(game.player, 'fn_guardzone')[0]; if (s || ++n > 60) { clearInterval(iv); if (!s) { res(null); return; } game.player.x = s.x; game.player.y = s.y; setTimeout(() => res({ x: Math.round(s.x), y: Math.round(s.y), invul: game.player.invul }), 120); } }, 50); }), gz);
  ok(guard && Math.abs(guard.x - gz.x) < 2 && guard.invul > 0, '念气罩（party_sync）：主机那边在同一位置生成罩子，站在里面无敌', { guard, gz });

  // ---- 3) 机器人一起清完地下城 ----
  await A.evaluate(() => { for (const m of ents) if (m.nid && m.team === 'e' && !m.dead) m.control = monsterAI; });
  const exp0 = await Promise.all([A, B].map(P => P.evaluate(() => game.exp)));
  await Promise.all([A, B].map(P => P.evaluate(() => { bot.on = true; game.speedMul = 2; window.__botDone = null; })));
  const t0 = Date.now(), done = [];
  for (let k = 0; k < 300 && done.filter(Boolean).length < 2; k++) {
    await sleep(1000);
    for (let i = 0; i < 2; i++) if (!done[i]) done[i] = await [A, B][i].evaluate(() => window.__botDone || (game.dungeon && game.dungeon.state === 'failed' ? { failed: true } : null)).catch(() => null);
    if (k === 8) await Promise.all([A, B].map((P, i) => P.screenshot({ path: `${out}/fight-${i ? 'fighter' : 'sword'}.png` })));
  }
  ok(done.every(d => d && d.rank), `一起通关、各自结算（${Math.round((Date.now() - t0) / 1000)} 秒）`, done);
  const st = await Promise.all([A, B].map(P => P.evaluate(() => ({ stats: coop.stats, kills: game.dungeon && game.dungeon.kills, exp: game.exp, state: coop.state }))));
  ok(st[0].stats.remoteHits > 0 && st[1].stats.sentHits > 0, `主机收到格斗家的命中 ${st[0].stats.remoteHits} 次（队员发出 ${st[1].stats.sentHits}）`, st.map(s => s.stats));
  const drop = st[0].stats.hitDrop || {};
  ok(!drop.none && !drop.gone && !drop.nomate, '格斗家的命中没有因为主机找不到怪而丢掉', drop);
  ok(st[0].kills === st[1].kills && st[1].stats.kills > 0, `击杀数一致（${st[0].kills}）`, st.map(s => s.kills));
  ok(st.every((s, i) => s.exp !== exp0[i]), '两个人都拿到经验');
  ok(st.every(s => s.stats.mateActs > 0), '互相看到队友出招（影子重放）', st.map(s => s.stats.mateActs));
  const errs = dumpErrors(players);
  ok(!errs.length, '页面没有报错', errs.slice(0, 5));
} catch (e) { ok(false, '异常：' + (e.stack || e)); }
await close(); await srv.stop();
const r = result(); console.log(`\n${r.total - r.fails}/${r.total} 通过`); process.exit(r.fails ? 1 : 0);
