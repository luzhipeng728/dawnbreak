// 联机 M3：组队刷图（默认 2 人，N=3 / N=4 可以多开）：组队 → 队长在门口进图 → 队员自动跟进 → 机器人一起清房 → 领主死亡 → 各自结算翻牌 → 回城
// 用法：node test/mp_coop.mjs [人数] [地下城] [等级]
import fs from 'node:fs';
import { startServer, launchPlayers, ok, result, sleep, until, uiRegister, uiCreateChar, dumpErrors } from './net_lib.mjs';
const N = Math.min(4, +(process.argv[2] || 2)), DG = process.argv[3] || 'lorien', LV = +(process.argv[4] || 6);
const out = 'test/shots/mp_coop'; fs.mkdirSync(out, { recursive: true });
const srv = await startServer();
const { players, close } = await launchPlayers(N);
const pages = players.map(p => p.page), [A] = pages;
const names = ['alice', 'bob', 'carol', 'dave'].slice(0, N);
try {
  for (let i = 0; i < N; i++) {
    ok(await uiRegister(pages[i], srv.url, names[i]), `${names[i]} 注册`);
    ok(await uiCreateChar(pages[i], i % 3), `${names[i]} 建角色进城`);
    await pages[i].evaluate(lv => { testLoadout(lv); save.write(); }, LV);
  }
  // 组队：alice 邀请其他人
  for (let i = 1; i < N; i++) {
    await A.evaluate(n => netPartyInvite(null, n), names[i]);
    await until(pages[i], () => menus.isOpen('nd_pinv'), null, 5000);
    await pages[i].click('.netask button:has-text("加入队伍")');
  }
  ok(await until(A, n => netParty.p && netParty.p.members.length === n, N, 8000), `组队 ${N} 人`);
  // 队员在别的城镇也能被拉进来；队长走到地下城门口
  const scene = await A.evaluate(id => { for (const s in SCENES) if (SCENES[s].gates.some(g => g.dungeon === id)) return s; }, DG);
  await A.evaluate(s => worldTravel(s), scene); await until(A, s => world && world.S.id === s, scene);
  await A.evaluate(id => { const g = world.S.gates.find(g => g.dungeon === id); game.player.x = g.x; game.player.y = 60; }, DG);
  await A.keyboard.down('ArrowUp'); await sleep(900); await A.keyboard.up('ArrowUp');
  ok(await until(A, () => menus.isOpen('dungeon'), null, 5000), '队长走到门口弹出地下城选择');
  await A.click('text=进入地下城');
  ok(await until(A, () => menus.isOpen('nd_coopwait') || coop.state === 'play', null, 5000), '等待队友加载');
  await A.screenshot({ path: `${out}/01-wait.png` });
  const allIn = await Promise.all(pages.map(P => until(P, () => game.scene === 'dungeon' && coop.state === 'play', null, 30000)));
  ok(allIn.every(Boolean), '全队一起进入地下城', allIn);
  const seeds = await Promise.all(pages.map(P => P.evaluate(() => ({ seed: game.dungeon.seed, rooms: game.dungeon.layout.rooms.map(r => r.seed).join(','), role: coop.role, mul: game.dungeon.hpMul }))));
  ok(seeds.every(s => s.seed === seeds[0].seed && s.rooms === seeds[0].rooms), '全队同一张地图（种子一致）');
  ok(seeds[0].role === 'host' && seeds.slice(1).every(s => s.role === 'guest'), '队长是主机，其他人是队员');
  ok(Math.abs(seeds[0].mul - [1, 1, 1.6, 2.2, 2.8][N]) < 1e-6, `怪物血量倍率 ×${seeds[0].mul}`);
  await sleep(1500);
  const cnt = await Promise.all(pages.map(P => P.evaluate(() => ({ mon: ents.filter(e => e.team === 'e' && !e.dead).length, mates: coop.mates.size, visible: [...coop.mates.values()].filter(g => !g.away).length }))));
  ok(cnt.every(c => c.mon === cnt[0].mon && c.mon > 0), '队员看到的怪物数量和主机一致', cnt);
  ok(cnt.every(c => c.mates === N - 1 && c.visible === N - 1), '每个人都看到队友', cnt);
  await Promise.all(pages.map((P, i) => P.screenshot({ path: `${out}/02-in-${names[i]}.png` })));
  // 血量一致：主机上第一只怪 vs 队员的傀儡
  const hpA = await A.evaluate(() => ents.filter(e => e.nid).map(e => [e.nid, Math.round(e.hpMax)]));
  const hpB = await pages[1].evaluate(() => ents.filter(e => e.nid).map(e => [e.nid, Math.round(e.hpMax)]));
  ok(JSON.stringify(hpA.sort()) === JSON.stringify(hpB.sort()), '怪物编号和最大血量一致');
  // 机器人一起打（2 倍速）
  const exp0 = await Promise.all(pages.map(P => P.evaluate(() => ({ exp: game.exp, lvl: game.lvl, items: inv.items.length }))));
  await Promise.all(pages.map(P => P.evaluate(() => { bot.on = true; game.speedMul = 2; window.__botDone = null; })));
  const t0 = Date.now();
  let shotMid = false;
  const done = [];
  for (let k = 0; k < 360 && done.filter(Boolean).length < N; k++) {
    await sleep(1000);
    for (let i = 0; i < N; i++) if (!done[i]) done[i] = await pages[i].evaluate(() => window.__botDone || (game.dungeon && game.dungeon.state === 'failed' ? { failed: true } : null)).catch(() => null);
    if (!shotMid && Date.now() - t0 > 6000) { shotMid = true; await Promise.all(pages.map((P, i) => P.screenshot({ path: `${out}/03-fight-${names[i]}.png` }))); }
  }
  ok(done.every(d => d && d.rank), `全队通关、各自结算（${Math.round((Date.now() - t0) / 1000)} 秒）`, done);
  const st = await Promise.all(pages.map(P => P.evaluate(() => ({ stats: coop.stats, kills: game.dungeon && game.dungeon.kills, hurt: game.dungeon && game.dungeon.hurt, exp: game.exp, lvl: game.lvl, items: inv.items.length, gold: game.gold, result: menus.isOpen('result'), state: coop.state }))));
  console.log(JSON.stringify(st));
  ok(st[0].stats.remoteHits > 0, `主机收到队员的命中 ${st[0].stats.remoteHits} 次`);
  ok(st.slice(1).every(s => s.stats.sentHits > 0 && s.stats.kills > 0 && s.stats.monActs > 0), '队员：自己打中傀儡、收到击杀事件、看到怪物出招', st.slice(1).map(s => s.stats));
  ok(st.every(s => s.kills === st[0].kills), `击杀数一致（${st[0].kills}）`, st.map(s => s.kills));
  ok(st.every((s, i) => s.exp !== exp0[i].exp || s.lvl > exp0[i].lvl), '每个人都拿到了经验');
  ok(st.slice(1).reduce((n, s) => n + (s.stats.monActsMe || 0), 0) > 0, '怪物也会去打队员（队员客户端收到以自己为目标的出招）', st.map(s => s.stats.monActsMe || 0));
  console.log('  各自被击次数（谁挨打谁结算）：' + st.map(s => s.hurt).join(' / '));
  ok(st.every(s => s.stats.mateActs > 0), '看到队友出招（影子重放）', st.map(s => s.stats.mateActs));
  ok(st.every(s => s.result && s.state === 'result'), '每个人都在结算界面（各自翻牌）');
  await Promise.all(pages.map((P, i) => P.screenshot({ path: `${out}/04-result-${names[i]}.png` })));
  // 回城：先队员再队长
  for (let i = N - 1; i >= 0; i--) { await pages[i].evaluate(() => { bot.on = false; game.speedMul = 1; }); await pages[i].click('#result button:has-text("返回城镇")'); }
  const back = await Promise.all(pages.map(P => until(P, () => game.scene === 'town' && coop.state === 'none', null, 15000)));
  ok(back.every(Boolean), '全员回城，组队状态清理干净', back);
  const partyStill = await A.evaluate(() => netParty.p && netParty.p.members.length);
  ok(partyStill === N, '回城后队伍还在');
  const errs = dumpErrors(players);
  ok(!errs.length, '页面没有报错', errs.slice(0, 5));
} catch (e) { ok(false, '异常：' + (e.stack || e)); }
await close(); await srv.stop();
const r = result(); console.log(`\n${r.total - r.fails}/${r.total} 通过`); process.exit(r.fails ? 1 : 0);
