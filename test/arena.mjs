// 决斗场排位赛（2 个玩家）：窗口里点“开始匹配” → 两个真人互相匹配 → 好友决斗同一套联机流程 → 结算积分 → 回城；
// 公正决斗：一个全身 +12 史诗 + 技能加满、一个新手装，决斗里两端算出来的属性 / 技能等级 / 装备特效完全一样；
// 刚打过的不再匹配 → 超时后匹配 AI（本地打，积分减半）；退出队列；排队中断线
import fs from 'node:fs';
import { startServer, launchPlayers, ok, result, sleep, until, uiRegister, uiCreateChar, dumpErrors } from './net_lib.mjs';
const out = 'test/shots/arena'; fs.mkdirSync(out, { recursive: true });
const srv = await startServer({ arenaAiMs: 4000, arenaMinMs: 2000, arenaForfeitMs: 5000, arenaRematchMs: 60_000 });
const AR = srv.app.ctx.mods.arena;
const { players, close } = await launchPlayers(2);
const [A, B] = players.map(p => p.page);
// 快速打完：主机 / 本地这边每局把对面血量压到一半、计时归零（时间到按剩余血量判，我方赢）
const winFast = P => P.evaluate(() => new Promise(res => { const iv = setInterval(() => { if (duel.state === 'fight') { duel.b.hp = duel.b.hpMax * 0.5; duel.a.hp = duel.a.hpMax; duel.timer = 0.05; } if (duel.state === 'result' || !game.duel) { clearInterval(iv); res(duel.result); } }, 50); }));
try {
  for (const [i, P] of [A, B].entries()) {
    ok(await uiRegister(P, srv.url, ['alice', 'bob'][i]), `${['alice', 'bob'][i]} 注册`);
    ok(await uiCreateChar(P, 0), '建角色（鬼剑士）进城');
    await P.evaluate(() => { window.__ar = []; net.on('arena:result', m => window.__ar.push(m)); });
  }
  for (const P of [A, B]) await P.evaluate(() => worldTravel('elvenguard'));
  // alice：满级、全身最强装备 +12、技能全部加满、觉醒全开
  const gap = await A.evaluate(() => {
    const p = game.player; game.lvl = 30; const fl = save.data.flags ??= {}; fl.awaken = fl.awaken2 = fl.awaken3 = true;
    game.sp = 1e6; for (let pass = 0; pass < 12; pass++) { let n = 0; for (const id in SKILLS) while (!skillUpBlock(id) && n < 5000) { skillUp(id); n++; } if (!n) break; } game.sp = 0;
    for (const s of SLOTS.filter(s => !s.startsWith('av_'))) {
      const L = Object.keys(ITEMS).filter(k => { const D = ITEMS[k]; return D.kind === 'equip' && D.slot === s && (D.lvl || 1) <= 30; }).sort((a, b) => (ITEMS[b].rar || 0) - (ITEMS[a].rar || 0) || (ITEMS[b].lvl || 0) - (ITEMS[a].lvl || 0));
      for (const k of L) { const it = makeItem(k, 1); if (!it || (it.slot === 'weapon' && it.cls && it.cls !== p.cls) || !inv.canWear(it, true)) continue; if (!ITEMS[k].noEnhance && it.slot !== 'title') it.enh = 12; normalizeItem(it); inv.equip[s] = it; break; }
    }
    recalcStats(p); save.write();
    return { hp: p.hpMax, atk: Math.round(p.baseStats.atk), procs: (p.gearProcs || []).length, skills: Object.values(game.skillLv).reduce((a, b) => a + b, 0) };
  });
  const weak = await B.evaluate(() => { const p = game.player; return { hp: p.hpMax, atk: Math.round(p.baseStats.atk), skills: Object.values(game.skillLv).reduce((a, b) => a + b, 0) }; });
  ok(gap.hp > weak.hp * 2 && gap.atk > weak.atk * 2 && gap.skills > weak.skills * 3, '城镇里 alice（+12 史诗、技能满）远强于 bob（新手装）', { gap, weak });
  // ---- 窗口：排位赛页 → 开始匹配 ----
  for (const P of [A, B]) {
    await P.evaluate(() => menus.open('duel'));
    await until(P, () => !!document.querySelector('.arbadge'), null, 8000);
    ok(await P.evaluate(() => /决斗场内属性统一，装备与强化不影响胜负/.test(document.querySelector('.duelwin').textContent)), '窗口里有“属性统一”说明');
  }
  await Promise.all([A, B].map(P => P.click('.duelwin button:has-text("开始匹配")')));   // 同时点，免得先点的人等太久被派 AI
  await A.screenshot({ path: `${out}/01-queue.png` });
  ok(await until(A, () => netDuel.state === 'fight' && game.duel === duel, null, 25000), 'alice 和 bob 匹配成功，进入决斗（alice 当主机）');
  ok(await until(B, () => netDuel.state === 'fight' && game.duel && game.duel.a, null, 20000), 'bob 进入决斗');
  const meta = await A.evaluate(() => netDuel.room && netDuel.room.meta);
  ok(meta && meta.arena, '决斗房间带排位对局 id', meta);
  // ---- 公正决斗：两端算出的 4 份属性完全一样（同职业）----
  const host = await A.evaluate(() => [duelFairSnap(duel.a), duelFairSnap(duel.b)]), guest = await B.evaluate(() => [duelFairSnap(game.duel.a), duelFairSnap(game.duel.b)]);
  const same = [host[1], guest[0], guest[1]].every(x => JSON.stringify(x) === JSON.stringify(host[0]));
  ok(same, '公正决斗：+12 史诗和新手装在决斗里的 HP / 攻击 / 防御 / 暴击 / 攻速 / 技能等级 / 装备特效完全一样（两端一致）', { host, guest });
  ok(host[0].procs === 0 && host[0].sets === 0 && host[0].hpMax === 21000 && host[0].lvl === 30, '决斗里没有装备特效 / 套装，属性是天平值', host[0]);
  await A.screenshot({ path: `${out}/02-duel-host.png` }); await B.screenshot({ path: `${out}/03-duel-guest.png` });
  await winFast(A);
  const res = [await until(A, () => window.__ar.length > 0, null, 20000), await until(B, () => window.__ar.length > 0, null, 20000)];
  const [ra, rb] = [await A.evaluate(() => window.__ar[0]), await B.evaluate(() => window.__ar[0])];
  ok(res.every(Boolean) && ra.win && !rb.win && ra.delta === 16 && rb.delta === -16 && ra.rating === 1016, '排位结算：alice +16，bob −16', { ra, rb });
  ok(ra && ra.reward && ra.reward.first, '胜者拿到今日首胜奖励（邮件）', ra && ra.reward);
  const back = [await until(A, () => game.scene === 'town' && !game.pvp && netDuel.state === 'none', null, 15000), await until(B, () => game.scene === 'town' && !game.pvp && netDuel.state === 'none', null, 15000)];
  ok(back.every(Boolean), '双方自动回城');
  ok(await A.evaluate(() => game.player.hpMax > 5000 && save.live), 'alice 回城后装备属性恢复、存档正常写入');
  // ---- 名牌段位徽章 ----
  ok(await until(B, () => [...netTown.peers.values()].some(p => p.char && p.char.title === '段位·青铜'), null, 10000), 'bob 看到 alice 的名牌带段位（青铜）');
  // ---- 刚打过不再匹配 → AI 补位（本地打，积分减半）----
  await A.evaluate(() => arena.join()); await B.evaluate(() => arena.join());
  ok(await until(B, () => arena.aiFight() && game.duel === duel, null, 15000), 'bob 没有再匹配到 alice，超时后匹配到 AI 对手并开打', await B.evaluate(() => ({ q: arena.q, cur: arena.cur, scene: game.scene, live: save.live, nd: netDuel.state, duel: !!game.duel, why: arena.canQueue() })), srv.app.ctx.db.all('SELECT id, a, b, ai IS NOT NULL AS ai, result, winner, created FROM arena_match'));
  const ai = await B.evaluate(() => ({ name: duel.b.name, a: duelFairSnap(duel.a), b: duelFairSnap(duel.b), cls: duel.b.cls }));
  ok(/「AI」$/.test(ai.name) && ai.a.hpMax === 21000 && ai.b.lvl === 30 && ai.b.procs === 0, 'AI 对手：名字带「AI」，同样用公正属性', ai);
  await until(A, () => arena.aiFight(), null, 8000);
  const [aiRes] = await Promise.all([winFast(B), winFast(A)]);
  ok(aiRes && aiRes.winner === 0, 'bob 打赢 AI');
  ok(await until(B, () => window.__ar.length > 1, null, 15000), 'AI 局结算');
  const rai = await B.evaluate(() => window.__ar[1]);
  ok(rai && rai.ai && rai.win && rai.delta > 0 && rai.delta <= 10, `赢 AI 积分减半（+${rai && rai.delta}，同分真人局是 +16 左右）`, rai);
  ok(await until(B, () => game.scene === 'town' && !game.pvp && !arena.cur, null, 15000) && await until(A, () => game.scene === 'town' && !game.pvp && !arena.cur, null, 15000), 'AI 局结束后自动回城');
  // ---- 退出队列 ----
  await B.evaluate(() => menus.open('duel')); await until(B, () => !!document.querySelector('.arbadge'), null, 8000);
  await B.click('.duelwin button:has-text("开始匹配")');
  ok(await until(B, () => !!arena.q, null, 5000) && AR.queue.size === 1, 'bob 进队列');
  await B.click('.duelwin button:has-text("取消匹配")');
  await sleep(500);
  ok(AR.queue.size === 0 && await B.evaluate(() => !arena.q), '点“取消匹配”退出队列');
  // ---- 排队中断线 ----
  await A.evaluate(() => arena.join()); await until(A, () => !!arena.q, null, 5000);
  const aid = await A.evaluate(() => net.user.id);
  ok(AR.queue.has(aid), 'alice 进队列');
  await players[0].ctx.close(); await sleep(800);
  ok(!AR.queue.has(aid), '排队中断线：服务端移出队列');
  await sleep(4500);
  ok(!srv.app.ctx.db.get('SELECT id FROM arena_match WHERE a = ? AND done IS NULL', aid), '断线的人没有被派 AI 对局');
  const lb = await B.evaluate(() => net.api('GET', '/api/rank?board=arena'));
  ok(lb.list.length === 2 && lb.list[0].tier && lb.list.some(e => e.char), '排行榜有决斗场榜', lb.list);
  const errs = dumpErrors(players);
  ok(!errs.length, '页面没有报错', errs.slice(0, 5));
} catch (e) { ok(false, '异常：' + (e.stack || e)); }
await close(); await srv.stop();
const r = result(); console.log(`\n${r.total - r.fails}/${r.total} 通过`); process.exit(r.fails ? 1 : 0);
