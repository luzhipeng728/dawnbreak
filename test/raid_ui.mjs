// 团本界面 + 客户端流程（RA2）：1 个客户端，单人引导从头打到尾（本地服务端 DNF_RAID_FAST=1 + 页面 ?raidfast：节点直达领主、领主血量 ×0.05）
// 在线：阿甘左「团本」窗口（列表 / 次数）→ 单人引导建团 → 开始 → 攻坚情况板点节点 → 单独进 → 机器人打第一个领主 → 返回营地自动打开情况板 →
//       复活要全团次数（3 → 2）→ 倒下 = 侵蚀（进不了节点）→ 追逐战完成 → 阶段结算领奖（翻 1 张，货币 ×0.6，物品没登记先记账）→ 团长提前开始讨伐战 →
//       最终战（存档点上报）→ 团本通关 → 领 P2（2 张）→ 重复领不重复入账 → 次数 今天 0 / 本周剩 1
// 离线（手机横屏模拟，不登录）：本地规则核心跑引导全流程，刷新页面接着打，领奖只入账一次
// 截图：test/shots/raid/*.png（入口窗口、大厅、情况板、局内 HUD、阶段结算、手机版情况板）
// 用法：node test/raid_ui.mjs
import fs from 'node:fs';
import { startServer, launchPlayers, ok, result, sleep, until, uiRegister, uiCreateChar, dumpErrors } from './net_lib.mjs';
process.env.DNF_RAID_FAST = '1';
const out = 'test/shots/raid'; fs.mkdirSync(out, { recursive: true });
const srv = await startServer();
const { players, close } = await launchPlayers(1);
const A = players[0].page;
// Lv60 + 希洛克主线做完（团本门槛）+ 复活币
const PREP = () => { testLoadout(60); const d = qdata(); for (const id in QUESTS) if (/^q_si\d+$/.test(id)) { d.questDone[id] = Date.now(); delete d.quests[id]; } save.data.coins = 5; recalcStats(game.player); save.write(); if (typeof netTown !== 'undefined' && netOn()) netTown.hello(true); return game.lvl; };
const toCamp = async P => { await P.evaluate(() => { menus.closeAll(); return worldTravel('siroco_town'); }); return until(P, () => world && world.S.id === 'siroco_town' && game.scene === 'town'); };
async function openRaidNpc(P) {
  await P.evaluate(() => openNpc(NPCS.agonzo)); await until(P, () => menus.isOpen('npc'), null, 5000);
  await P.click('[data-win="npc"] button:text-is("团本")');
  return until(P, () => menus.isOpen('raid') && !!document.querySelector('[data-win="raid"] .rcard .lim b'), null, 8000);
}
async function enterNode(P, id, together) {
  if (!(await P.evaluate(() => menus.isOpen('raidboard')))) await P.evaluate(() => menus.show('raidboard'));
  if ((await P.evaluate(() => raidUi.sel)) !== id) await P.click(`[data-win="raidboard"] .rbnode[data-node="${id}"]`);
  await P.click(`[data-win="raidboard"] .rbnd button[data-act="${together ? 'together' : 'solo'}"]`, { timeout: 8000 });
  return until(P, () => game.scene === 'dungeon' && game.dungeon && game.dungeon.raid && game.dungeon.boss && !game.dungeon.transition, null, 30000);
}
const killBoss = P => P.evaluate(() => { const b = game.dungeon.boss; b.invul = 0; b.hp = 0; killEnt(b, game.player, {}); return !!(raidNet.ctx && raidNet.ctx.held); });
async function backToCamp(P) {
  if (!(await until(P, () => menus.isOpen('result'), null, 15000))) return false;
  for (let k = 0; k < 3 && await P.evaluate(() => menus.isOpen('result')); k++) {
    await P.click('#result button:has-text("返回营地")').catch(() => {});
    await until(P, () => !menus.isOpen('result'), null, 2000);
  }
  const r = await until(P, () => game.scene === 'town' && world && world.S.id === 'siroco_town' && menus.isOpen('raidboard'), null, 20000);
  if (!r) { console.log('  backToCamp 失败：', JSON.stringify(await P.evaluate(() => ({ scene: game.scene, w: world && world.S.id, stack: menus.stack, st: raidNet.S && raidNet.S.st, ctx: !!raidNet.ctx, back: raidNet.back })))); await P.screenshot({ path: `${out}/zz-back.png` }); }
  return r;
}
const st = (P, id) => P.evaluate(i => raidNet.S && raidNet.S.nodes[i] && raidNet.S.nodes[i].st, id);
try {
  // ================= 在线：单人引导 =================
  ok(await uiRegister(A, srv.url + '?raidfast&', 'alice'), 'alice 注册');
  ok(await uiCreateChar(A, 0, '阿丽'), 'alice 建角色进城');
  ok(await A.evaluate(PREP) === 60, 'Lv60、希洛克主线已完成');
  ok(await toCamp(A), '到暗黑城（营地）');
  ok(await openRaidNpc(A), '阿甘左「团本」→ 团本窗口（列表 + 次数）');
  const lim0 = await A.evaluate(() => raidNet.limits);
  ok(lim0 && lim0.dayLeft === 1 && lim0.weekLeft === 2, '次数：今天 1 / 本周 2（GET /api/raid）', lim0);
  ok(await A.evaluate(() => document.querySelector('[data-win="raid"] [data-act="normal"]').classList.contains('off') === false && !!document.querySelector('[data-win="raid"] [data-act="guide"]')), '没组队：可以建普通团 / 单人引导');
  await A.screenshot({ path: `${out}/01-npc-window.png` });
  await A.click('[data-win="raid"] [data-act="guide"]');
  ok(await until(A, () => raidNet.S && raidNet.S.st === 'lobby' && !!document.querySelector('[data-win="raid"] [data-act="start"]'), null, 5000), '建团（引导）：大厅');
  await A.screenshot({ path: `${out}/02-lobby.png` });
  await A.click('[data-win="raid"] [data-act="start"]');
  ok(await until(A, () => raidNet.S.st === 'routes' && menus.isOpen('raidboard'), null, 5000), '开始：追逐战，自动打开攻坚情况板');
  const g = await A.evaluate(() => ({ nodes: Object.keys(raidNet.S.nodes).join(), lives: raidNet.S.lives, graph: raidNet.S.graph, law: raidNet.S.nodes.law_a.st, pill: !!document.getElementById('raidpill') }));
  ok(g.nodes === 'law_a,wit_dawn,pain_mem,gate_l' && g.lives === 3 && g.graph === 'guide' && g.law === 'open', '引导图：每层一个节点，全团 3 次复活', g);
  await A.click('[data-win="raidboard"] .rbnode[data-node="law_a"]');
  await sleep(300);
  await A.screenshot({ path: `${out}/03-board-p1.png` });
  ok(await A.evaluate(() => !!document.querySelector('.rbnd button[data-act="solo"]') && !document.querySelector('.rbnd button[data-act="together"]')), '点节点：详情里有“单独进”（引导没有一起进）');
  // 第一个节点：机器人真的打（领主血量 ×0.05）
  ok(await enterNode(A, 'law_a'), '单独进「破坏之门」：进入本地实例（直达领主房）');
  const e1 = await A.evaluate(() => ({ raid: !!game.dungeon.raid, fat: save.data.fatigue, D: game.dungeon.D.name, hp: game.dungeon.boss.hpMax, lvl: game.dungeon.boss.lvl, host: raidNet.ctx.isHost, run: raidNet.ctx.run }));
  ok(e1.raid && e1.D === '团本 · 引导' && e1.lvl === 62 && e1.host, '节点实例：团本数值（引导）、领主 Lv62', e1);
  await A.evaluate(() => { bot.on = true; game.speedMul = 2; window.__botDone = null; });
  const botOk = await until(A, () => raidNet.S.nodes.law_a.st === 'cleared', null, 90000);
  ok(botOk, '机器人打倒守门人：节点通关（会话里 cleared）');
  if (!botOk) await killBoss(A);
  await A.evaluate(() => { bot.on = false; game.speedMul = 1; });
  const fat = await A.evaluate(() => save.data.fatigue);
  ok(fat === e1.fat, `团本节点不耗疲劳（${e1.fat} → ${fat}）`);
  ok(await backToCamp(A), '结算 → 返回营地：回到暗黑城、自动打开情况板');
  ok(await A.evaluate(() => !document.querySelector('#result') || !menus.isOpen('result')), '节点结算没有翻牌 / 再次挑战');
  ok((await st(A, 'wit_dawn')) === 'open', '下一层开放');
  // 复活要全团次数
  ok(await enterNode(A, 'wit_dawn'), '进「梦幻之黎明」');
  const rv = await A.evaluate(async () => {
    const dg = game.dungeon, p = game.player; save.data.coins = 3; p.hp = 0; p.dead = true;
    for (let i = 0; i < 40 && dg.state !== 'dead'; i++) await new Promise(r => setTimeout(r, 50));
    const st0 = dg.state; dg.revive();
    for (let i = 0; i < 40 && dg.state !== 'play'; i++) await new Promise(r => setTimeout(r, 50));
    return { st0, st: dg.state, lives: raidNet.S.lives, coins: save.data.coins };
  });
  ok(rv.st0 === 'dead' && rv.st === 'play' && rv.lives === 2 && rv.coins === 2, '倒下用复活币：先向会话要次数（全团 3 → 2），批准后复活', rv);
  const dead = await A.evaluate(async () => {
    const dg = game.dungeon, p = game.player; p.hp = 0; p.dead = true;
    for (let i = 0; i < 40 && dg.state !== 'dead'; i++) await new Promise(r => setTimeout(r, 50));
    dg.fail(); return dg.state;
  });
  ok(dead === 'failed' && await until(A, () => game.scene === 'town' && raidNet.mine() && raidNet.mine().ero > raidNet.now() && raidNet.mine().at === 'camp', null, 15000), '倒下不复活：回营地、被侵蚀（引导 10 秒）');
  ok(await until(A, () => menus.isOpen('raidboard'), null, 5000), '回营地后情况板自动打开');
  if ((await A.evaluate(() => raidUi.sel)) !== 'wit_dawn') await A.click('[data-win="raidboard"] .rbnode[data-node="wit_dawn"]');
  ok(await A.evaluate(() => !document.querySelector('.rbnd button[data-act="solo"]') && /侵蚀/.test(document.querySelector('.rbnd .why').textContent)), '侵蚀中：情况板上不能进，写着剩几秒');
  await A.screenshot({ path: `${out}/04-board-erosion.png` });
  await A.evaluate(() => raidNet.enter('wit_dawn'));
  ok(await until(A, () => raidNet.feed.some(f => /侵蚀/.test(f.text) && /秒/.test(f.text)), null, 3000), '强行进：服务端拒绝（侵蚀）');
  await until(A, () => !(raidNet.mine().ero > raidNet.now()), null, 14000);
  ok(await enterNode(A, 'wit_dawn'), '侵蚀结束后再进');
  await killBoss(A); ok(await backToCamp(A), '「梦幻之黎明」通关回营地');
  // 局内 HUD 截图
  ok(await enterNode(A, 'pain_mem'), '进「记忆的碎片」');
  await sleep(1200);
  await A.evaluate(() => { const b = game.dungeon.boss; game.lastTarget = b; game.lastTargetT = game.t; });
  await sleep(200);
  await A.screenshot({ path: `${out}/05-hud.png` });
  ok(await A.evaluate(() => raidNet.queue.length === 0), '上报都收到了回执（队列清空）');
  await killBoss(A); ok(await backToCamp(A), '「记忆的碎片」通关');
  ok(await enterNode(A, 'gate_l'), '进「无形之门」（引导：一个房间的双领主）');
  await killBoss(A);
  ok(await until(A, () => raidNet.S.st === 'rest', null, 8000), '追逐战完成 → 休整');
  ok(await backToCamp(A), '回营地');
  ok(await until(A, () => menus.isOpen('raidres'), null, 8000), '阶段结算自动弹出');
  await A.screenshot({ path: `${out}/06-result-p1.png` });
  await A.click('[data-win="raidres"] [data-act="claim"]');
  ok(await until(A, () => { const k = raidNet.S.sid + ':1'; return !!raidNet.claims[k] && document.querySelectorAll('[data-win="raidres"] .card.flip').length === 1; }, null, 6000), '领 P1 奖励：翻开 1 张');
  const own1 = await A.evaluate(() => ({ owed: { ...(save.data.raidOwed || {}) }, got: Object.keys(save.data.raidGot || {}).length, rw: raidNet.claims[raidNet.S.sid + ':1'] }));
  ok(own1.owed.raid_petal === 2 && own1.got === 1, '引导货币 ×0.6（3~4 → 2 花瓣）；物品还没登记（RA3）先记账', own1);
  await sleep(700);
  await A.screenshot({ path: `${out}/07-result-p1-flip.png` });
  await A.evaluate(() => raidNet.claim(1));
  await sleep(600);
  ok((await A.evaluate(() => save.data.raidOwed.raid_petal)) === 2, '重复领：服务端返回同一份（dup），不重复入账');
  await A.click('[data-win="raidres"] [data-act="close"]');
  await A.evaluate(() => menus.show('raidboard'));
  await A.click('[data-win="raidboard"] [data-act="next"]');
  ok(await until(A, () => raidNet.S.st === 'routes' && raidNet.S.phase === 2, null, 5000), '团长提前结束休整：讨伐战开始');
  const p2 = await A.evaluate(() => ({ nodes: Object.keys(raidNet.S.nodes).join(), lives: raidNet.S.lives }));
  ok(p2.nodes === 'sub_a,con_hall,coffin' && p2.lives === 3, '讨伐战：复活次数重置', p2);
  await A.screenshot({ path: `${out}/08-board-p2.png` });
  for (const nd of ['sub_a', 'con_hall']) { ok(await enterNode(A, nd), `进「${nd}」`); await killBoss(A); ok(await backToCamp(A), `「${nd}」通关`); }
  ok((await A.evaluate(() => raidNet.S.st)) === 'final' && await A.evaluate(() => !!document.querySelector('.rbbanner')), '最终领主的门开了（情况板横幅）');
  ok(await enterNode(A, 'coffin'), '引导：最终战一个人进');
  const cp = await A.evaluate(async () => { const b = game.dungeon.boss; b.hp = Math.round(b.hpMax * 0.6); await new Promise(r => setTimeout(r, 3400)); return raidNet.S.cp && raidNet.S.cp.coffin; });
  ok(cp && Math.abs(cp.hp - 0.6) < 0.02, '最终战：主机每 3 秒报存档点（血量 60%）', cp);
  await killBoss(A);
  ok(await until(A, () => raidNet.S.st === 'cleared', null, 8000), '最终领主倒下：团本通关');
  ok(await backToCamp(A), '回营地');
  ok(await until(A, () => menus.isOpen('raidres'), null, 8000), '通关结算自动弹出');
  const rq = await A.evaluate(async () => {
    const sid = raidNet.S.sid; raidNet.S = null; raidNet.lastSt = null; net.disconnect(); net.stopped = false; net.connect();
    for (let i = 0; i < 80 && !(raidNet.S && raidNet.S.sid === sid); i++) await new Promise(r => setTimeout(r, 100));
    await new Promise(r => setTimeout(r, 500)); return { same: !!raidNet.S && raidNet.S.sid === sid, st: raidNet.S && raidNet.S.st };
  });
  ok(rq.same && rq.st === 'cleared', '重连（刷新）后按存档里的 raidLast 找回结束了的团本（还有没领的奖励）', rq);
  await A.click('[data-win="raidres"] [data-act="claim"]');
  ok(await until(A, () => document.querySelectorAll('[data-win="raidres"] .card.flip').length === 2, null, 6000), '领 P2 奖励：翻开 2 张');
  await sleep(800);
  await A.screenshot({ path: `${out}/09-result-final.png` });
  const fin = await A.evaluate(async () => { const r = await raidNet.fetch(); return { lim: r && r.limits, owed: save.data.raidOwed.raid_petal, got: Object.keys(save.data.raidGot).length }; });
  ok(fin.lim && fin.lim.dayLeft === 0 && fin.lim.weekLeft === 1 && fin.owed >= 2 + 2 + 3 && fin.got === 2, '次数：今天 0 / 本周剩 1；两阶段奖励都入账一次', fin);
  await A.click('[data-win="raidres"] [data-act="close"]');
  await A.evaluate(() => menus.show('raidboard'));
  await A.screenshot({ path: `${out}/10-board-cleared.png` });
  await A.click('[data-win="raidboard"] [data-act="dismiss"]');
  ok(await until(A, () => !raidNet.S && !menus.isOpen('raidboard'), null, 3000), '关闭团本');
  // 次数用完：练习
  await openRaidNpc(A);
  ok(await A.evaluate(() => /练习/.test(document.querySelector('[data-win="raid"] .rcard').textContent)), '今天的次数用完：窗口里写着“练习（没有奖励）”');
  await A.evaluate(() => menus.closeAll());

  // ================= 离线（不登录，手机横屏）：本地规则核心 =================
  const browser = players[0].ctx.browser();
  const ctxM = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
  const M = await ctxM.newPage(), mlogs = [];
  M.on('pageerror', e => mlogs.push({ type: 'pageerror', text: e.message }));
  M.on('console', m => { if (m.type() === 'error') mlogs.push({ type: 'error', text: m.text() }); });
  players.push({ i: 1, page: M, logs: mlogs });
  await M.goto(srv.url + '?town&cls=sword&raidfast&mute');
  ok(await until(M, () => window.__READY && game.scene === 'town' && game.player && world, null, 60000), '离线：不登录直接进城');
  await M.evaluate(() => { for (const n of ['help']) if (menus.isOpen(n)) menus.close(n); });
  await M.evaluate(PREP);
  ok(await M.evaluate(() => raidNet.local()), '没登录 = 本地模式');
  await toCamp(M);
  ok(await openRaidNpc(M), '离线：团本窗口（本地次数）');
  await M.click('[data-win="raid"] [data-act="guide"]');
  await until(M, () => raidNet.S && raidNet.S.st === 'lobby', null, 5000);
  await M.click('[data-win="raid"] [data-act="start"]');
  ok(await until(M, () => raidNet.S.st === 'routes' && menus.isOpen('raidboard') && /^local_/.test(raidNet.S.sid), null, 5000), '离线：本地会话开始（引导）');
  await sleep(300);
  await M.screenshot({ path: `${out}/11-mobile-board.png` });
  for (const nd of ['law_a', 'wit_dawn', 'pain_mem', 'gate_l']) { ok(await enterNode(M, nd), `离线：进「${nd}」`); if (nd === 'pain_mem') await M.screenshot({ path: `${out}/12-mobile-hud.png` }); await killBoss(M); ok(await backToCamp(M), `离线：「${nd}」通关`); }
  ok(await until(M, () => raidNet.S.st === 'rest' && menus.isOpen('raidres'), null, 8000), '离线：追逐战完成、结算弹出');
  await M.click('[data-win="raidres"] [data-act="claim"]');
  ok(await until(M, () => !!raidNet.claims[raidNet.S.sid + ':1'], null, 4000), '离线：领 P1 奖励');
  const sid = await M.evaluate(() => raidNet.S.sid);
  await M.reload();
  ok(await until(M, () => window.__READY && game.scene === 'town' && raidNet.S && raidNet.S.st === 'rest', null, 60000), '离线：刷新页面后会话还在（存档里）');
  ok((await M.evaluate(() => raidNet.S.sid)) === sid, '同一个会话');
  await M.evaluate(() => { menus.closeAll(); raidNet.claim(1); });
  await sleep(500);
  ok((await M.evaluate(() => save.data.raidOwed.raid_petal)) === 2, '离线：刷新后再领不重复入账');
  await M.evaluate(() => { if (menus.isOpen('raidres')) menus.close('raidres'); menus.show('raidboard'); });
  await M.click('[data-win="raidboard"] [data-act="next"]');
  ok(await until(M, () => raidNet.S.phase === 2 && raidNet.S.st === 'routes', null, 5000), '离线：讨伐战');
  for (const nd of ['sub_a', 'con_hall', 'coffin']) { ok(await enterNode(M, nd), `离线：进「${nd}」`); await killBoss(M); ok(await backToCamp(M), `离线：「${nd}」通关`); }
  ok(await until(M, () => raidNet.S.st === 'cleared' && save.data.raidRun && save.data.raidRun.st === 'cleared', null, 5000), '离线：团本通关（存档里的会话也是通关）');
  await M.evaluate(() => { if (menus.isOpen('raidres')) menus.close('raidres'); });
  await ctxM.close();
  const errs = dumpErrors(players);
  ok(!errs.length, '页面没有报错', errs.slice(0, 5));
} catch (e) { ok(false, '异常：' + (e.stack || e)); await A.screenshot({ path: `${out}/zz-fail.png` }).catch(() => {}); }
await close(); await srv.stop();
const r = result(); console.log(`\n${r.total - r.fails}/${r.total} 通过`); process.exit(r.fails ? 1 : 0);
