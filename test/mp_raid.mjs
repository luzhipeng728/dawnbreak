// 两人团本（RA2）：2 个真实客户端（alice 队长、bob），普通模式从头打到尾（本地服务端 DNF_RAID_FAST=1 + 页面 ?raidfast）
// 组队 → 队长在阿甘左那里建团 → bob 收到邀请点加入 → 准备 → 开始 →
//   破坏之门 A / B 分头打（错序：两边守门人回满血；数字小的先倒 → 通关）→ 梦幻之黎明 + 噩梦之夜 并行（跨节点 BUFF < 0.5 秒到达，领主受伤倍率生效）→
//   记忆的碎片 + 痛苦之镜（镜子到 0：回满血 + 全团 −2 分钟；bob 断线时打完镜子，上报排队，重连后补发，进度不丢）→
//   无形之门 1 / 2（各打各的，两扇都通关 = 追逐战完成）→ 休整、两人各领 P1 → 讨伐战（变异的潜意识之厅 → 幻影破防）→
//   最终战队长带队一起进（组队房间，room:open meta 带团本信息）→ 通关 → 两人各领 P2（重复领不重复入账）→ 次数 今天 0 / 本周剩 1
// 服务端时间用 cfg.raidShift 平移（镜子倒计时不用真等）。截图：test/shots/raid/mp-*.png
// 用法：node test/mp_raid.mjs
import fs from 'node:fs';
import { startServer, launchPlayers, ok, result, sleep, until, uiRegister, uiCreateChar, dumpErrors } from './net_lib.mjs';
process.env.DNF_RAID_FAST = '1';
const out = 'test/shots/raid'; fs.mkdirSync(out, { recursive: true });
const srv = await startServer({ graceMs: 20000 });
const { players, close } = await launchPlayers(2);
const [A, B] = players.map(p => p.page);
const shift = ms => { const C = srv.app.ctx.cfg; C.raidShift = (C.raidShift || 0) + ms; srv.app.ctx.mods.raid.tick(); };
const PREP = () => { testLoadout(60); const d = qdata(); for (const id in QUESTS) if (/^q_si\d+$/.test(id)) { d.questDone[id] = Date.now(); delete d.quests[id]; } save.data.coins = 5; recalcStats(game.player); save.write(); netTown.hello(true);
  const f = raidNet.onFx; raidNet.onFx = function (m) { (window.__fx = window.__fx || []).push({ kind: m.kind, node: m.node, id: m.p && m.p.id, T: Date.now() }); return f.call(this, m); }; return game.lvl; };
const toCamp = async P => { await P.evaluate(() => { menus.closeAll(); return worldTravel('siroco_town'); }); return until(P, () => world && world.S.id === 'siroco_town' && game.scene === 'town'); };
async function sel(P, id) {
  if (!(await P.evaluate(() => menus.isOpen('raidboard')))) await P.evaluate(() => menus.show('raidboard'));
  if ((await P.evaluate(() => raidUi.sel)) !== id) await P.click(`[data-win="raidboard"] .rbnode[data-node="${id}"]`);
}
async function enterNode(P, id, together) {
  await sel(P, id);
  await P.click(`[data-win="raidboard"] .rbnd button[data-act="${together ? 'together' : 'solo'}"]`, { timeout: 8000 });
  return until(P, i => game.scene === 'dungeon' && game.dungeon && game.dungeon.raid && game.dungeon.raid.node === i && game.dungeon.boss && !game.dungeon.transition, id, 40000);
}
const killBoss = P => P.evaluate(() => { const b = game.dungeon.boss; b.invul = 0; b.hp = 0; killEnt(b, game.player, {}); window.__killT = Date.now(); return !!(raidNet.ctx && raidNet.ctx.held); });
async function backToCamp(P) {
  if (!(await until(P, () => menus.isOpen('result'), null, 15000))) return false;
  for (let k = 0; k < 3 && await P.evaluate(() => menus.isOpen('result')); k++) { await P.click('#result button:has-text("进入翻牌结算"), #result button:has-text("返回营地")').catch(() => {}); await until(P, () => !menus.isOpen('result'), null, 2000); }
  return until(P, () => game.scene === 'town' && world && world.S.id === 'siroco_town' && menus.isOpen('raidboard'), null, 20000);
}
const nst = (P, id) => P.evaluate(i => raidNet.S && raidNet.S.nodes[i] && raidNet.S.nodes[i].st, id);
const boss = P => P.evaluate(() => { const C = raidNet.ctx, b = C && C.boss; return b ? { hp: +(b.hp / b.hpMax).toFixed(3), held: !!C.held, dead: !!b.dead, mul: { ...(b.msMul || {}) }, ai: +(b.aiCd || 0).toFixed(1) } : null; });
const claim = async (P, ph) => {
  if (!(await until(P, () => menus.isOpen('raidres'), null, 8000))) await P.evaluate(p => menus.show('raidres', p), ph);
  await P.click('[data-win="raidres"] [data-act="claim"]');
  const got = await until(P, p => !!raidNet.claims[raidNet.S.sid + ':' + p], ph, 6000);
  if (!got) return false;
  const limit = ph === 1 ? 1 : 2;
  if (!(await until(P, p => raidNet.flipState && raidNet.flipState.phase === p && raidNet.flipState.state === 'open', ph, 8000))) return false;
  if (!(await until(P, n => document.querySelectorAll('[data-win="raidres"] .card').length >= n, limit, 8000))) return false;
  let picked = await P.evaluate(p => raidNet.flipState && raidNet.flipState.phase === p && raidNet.flipState.picks ? raidNet.flipState.picks.length : 0, ph);
  while (picked < limit) {
    const card = P.locator('[data-win="raidres"] .card:not(.flip)').first();
    if (!(await card.count())) return false;
    await card.click({ force: true });
    if (!(await until(P, o => raidNet.flipState && raidNet.flipState.phase === o.phase && raidNet.flipState.picks && raidNet.flipState.picks.length >= o.n, { phase: ph, n: picked + 1 }, 8000))) return false;
    picked++;
  }
  await sleep(500);
  await P.click('[data-win="raidres"] [data-act="close"]').catch(() => {});
  return got;
};
try {
  ok(await uiRegister(A, srv.url + '?raidfast&', 'alice'), 'alice 注册'); ok(await uiCreateChar(A, 0, '阿丽'), 'alice 建角色');
  ok(await uiRegister(B, srv.url + '?raidfast&', 'bobby'), 'bob 注册'); ok(await uiCreateChar(B, 1, '小鲍'), 'bob 建角色');
  for (const P of [A, B]) { await P.evaluate(PREP); await toCamp(P); }
  await A.evaluate(() => netPartyInvite(null, 'bobby'));
  await until(B, () => menus.isOpen('nd_pinv'), null, 8000); await B.click('.netask button:has-text("加入队伍")');
  ok(await until(A, () => netParty.p && netParty.p.members.length === 2, null, 8000), '组队 2 人');
  // ---- 建团 / 加入 / 准备 / 开始 ----
  await A.evaluate(() => openNpc(NPCS.agonzo)); await until(A, () => menus.isOpen('npc'));
  await A.click('[data-win="npc"] button:text-is("团本")');
  await until(A, () => menus.isOpen('raid') && !!document.querySelector('[data-win="raid"] [data-act="normal"]'), null, 8000);
  await A.click('[data-win="raid"] [data-act="normal"]');
  ok(await until(A, () => raidNet.S && raidNet.S.st === 'lobby' && raidNet.S.mode === 'normal', null, 5000), '队长建团（普通）');
  ok(await until(B, () => menus.isOpen('nd_raidinv'), null, 8000), 'bob 收到团本邀请');
  await B.click('.netask button:has-text("加入")');
  ok(await until(B, () => raidNet.S && raidNet.S.members.length === 2 && !!document.getElementById('raidpill') && !document.getElementById('raidpill').hidden, null, 8000), 'bob 加入团本（城镇顶上出现团本条）');
  await B.click('#raidpill');
  await until(B, () => menus.isOpen('raidboard') && !!document.querySelector('[data-win="raidboard"] [data-act="ready"]'), null, 5000);
  await B.click('[data-win="raidboard"] [data-act="ready"]');
  ok(await until(A, () => raidNet.S.members.every(m => m.ready) && !document.querySelector('[data-win="raid"] [data-act="start"]').classList.contains('off'), null, 5000), 'bob 准备好了：队长的“开始”可以点');
  await A.screenshot({ path: `${out}/mp-01-lobby.png` });
  await A.click('[data-win="raid"] [data-act="start"]');
  ok((await Promise.all([A, B].map(P => until(P, () => raidNet.S.st === 'routes' && raidNet.S.graph === 'normal' && menus.isOpen('raidboard'), null, 6000)))).every(Boolean), '追逐战开始：两边都打开情况板（普通图）');
  const lives = await A.evaluate(() => raidNet.S.lives);
  ok(lives === 6, '全团 6 次复活', lives);
  await sel(A, 'law_a');
  ok(await A.evaluate(() => !document.querySelector('.rbnd button[data-act="together"]') && /分头/.test(document.querySelector('.rbnd').textContent)), '破坏之门：必须分头（没有“一起进”）');
  await A.screenshot({ path: `${out}/mp-02-board-start.png` });
  // ---- 破坏之门：顺序 ----
  const ins = await Promise.all([enterNode(A, 'law_a'), enterNode(B, 'law_b')]);
  ok(ins.every(Boolean), '两人各进一张破坏之门');
  const [oa, ob] = await Promise.all([A, B].map(P => P.evaluate(() => raidNet.ctx.order)));
  ok(oa && ob && oa !== ob, `各拿到一个顺序数字（alice ${oa} / bob ${ob}）`);
  const [S1, L1] = oa < ob ? [A, B] : [B, A];
  await L1.evaluate(() => { const b = game.dungeon.boss; b.hp = Math.round(b.hpMax * 0.06); });
  ok(await until(L1, () => raidNet.feed.some(f => /还没轮到你/.test(f.text)), null, 4000), '数字大的一边压到 10% 以下：提示“还没轮到你”');
  ok(await killBoss(L1), '数字大的先打倒：领主先按住（等裁决）');
  ok(await until(L1, () => { const C = raidNet.ctx; return C && !C.held && C.boss.hp === C.boss.hpMax; }, null, 4000) && await until(S1, () => raidNet.ctx.boss.hp === raidNet.ctx.boss.hpMax, null, 4000), '错序：两边的守门人都回满血（按住的那个也起来接着打）');
  ok(await killBoss(S1) && await until(S1, () => raidNet.ctx.cleared, null, 4000), '数字小的先倒：裁决通过、真的倒下');
  ok(await killBoss(L1) && await until(L1, () => raidNet.ctx.cleared, null, 4000), '数字大的后倒：通关');
  ok((await Promise.all([backToCamp(A), backToCamp(B)])).every(Boolean), '两人回营地');
  ok((await nst(A, 'wit_dawn')) === 'open' && (await nst(A, 'wit_night')) === 'open', '第二层开放（主线 + 增益）');
  // ---- 梦幻之黎明（alice）+ 噩梦之夜（bob）并行：跨节点 BUFF ----
  ok((await Promise.all([enterNode(A, 'wit_dawn'), enterNode(B, 'wit_night')])).every(Boolean), '并行：alice 主线、bob 增益');
  await killBoss(B);
  ok(await until(A, () => (window.__fx || []).some(f => f.kind === 'buff' && f.id === 'haniel_weak'), null, 4000), 'alice 收到跨节点 BUFF');
  const tB = await B.evaluate(() => window.__killT), tA = await A.evaluate(() => window.__fx.find(f => f.kind === 'buff' && f.id === 'haniel_weak').T);
  ok(tA - tB < 500, `跨节点效果到达用时 ${tA - tB}ms（< 0.5 秒）`);
  const ba = await boss(A);
  ok(ba && ba.mul.raid_haniel_weak === 1.3, '领主受伤 ×1.3 生效（msMul）', ba);
  await A.screenshot({ path: `${out}/mp-03-hud-buff.png` });
  ok(await backToCamp(B), 'bob 回营地');
  ok((await nst(B, 'wit_night')) === 'cool', '噩梦之夜进入重生');
  await killBoss(A); ok(await backToCamp(A), 'alice 通关梦幻之黎明');
  ok((await nst(A, 'wit_night')) === 'off' && (await nst(A, 'pain_mirror')) === 'open', '主线通关：增益节点关闭，第三层开放（镜子开始倒计时）');
  // ---- 记忆的碎片 + 痛苦之镜：倒计时到 0；bob 断线时打完镜子 ----
  ok(await enterNode(A, 'pain_mem'), 'alice 进记忆的碎片');
  const dl0 = await A.evaluate(() => raidNet.S.deadline);
  await A.evaluate(() => { const b = raidNet.ctx.boss; b.hp = Math.round(b.hpMax * 0.5); });
  await sleep(400);
  shift(241000);
  ok(await until(A, () => (window.__fx || []).some(f => f.kind === 'heal' && f.node === 'pain_mem') && raidNet.ctx.boss.hp === raidNet.ctx.boss.hpMax, null, 4000), '没人压镜子、倒计时到 0：记忆的碎片的领主回满血');
  ok(await until(B, d => raidNet.S.deadline === d - 120000, dl0, 4000), '全团计时 −2 分钟（bob 那边也看到）');
  await A.screenshot({ path: `${out}/mp-04-hud-mirror.png` });
  ok(await enterNode(B, 'pain_mirror'), 'bob 进痛苦之镜');
  await B.evaluate(() => net.disconnect());
  ok(await until(A, () => raidNet.S.members.some(m => m.uid !== raidNet.me() && !m.online), null, 6000), 'bob 断线：alice 那边显示离线');
  await killBoss(B);
  ok(await until(B, () => raidNet.ctx.cleared && raidNet.queue.length > 0 && raidNet.queue.some(x => !x.sent), null, 4000), '断线中打完镜子：上报排队（没发出去）');
  await sleep(3000);
  ok((await nst(A, 'pain_mirror')) === 'busy', '断线期间服务端还不知道');
  await B.evaluate(() => { net.stopped = false; net.connect(); });
  ok(await until(B, () => net.connected && raidNet.queue.length === 0, null, 10000), 'bob 重连：补发上报、收到回执（队列清空）');
  ok(await until(A, () => raidNet.S.nodes.pain_mirror.st === 'cool' && raidNet.S.members.every(m => m.online), null, 6000), '进度不丢：镜子修复中、bob 在线');
  ok(await backToCamp(B), 'bob 回营地');
  await killBoss(A); ok(await backToCamp(A), 'alice 通关记忆的碎片');
  ok((await nst(A, 'gate_l')) === 'open' && (await nst(A, 'gate_r')) === 'open', '无形之门左右开放');
  // ---- 无形之门：各打各的（没有同步窗口）----
  ok((await Promise.all([enterNode(A, 'gate_l'), enterNode(B, 'gate_r')])).every(Boolean), 'alice 维塔 / bob 奈克斯');
  ok(await killBoss(A) === false && await until(A, () => raidNet.ctx.cleared, null, 4000), 'alice 打倒维塔：直接通关（不用等另一边）');
  await sleep(300);
  await B.screenshot({ path: `${out}/mp-05-hud-gate.png` });
  ok((await nst(A, 'gate_l')) === 'cleared' && (await nst(A, 'gate_r')) === 'busy', '一扇门通关、另一扇还在打');
  await killBoss(B);
  ok(await until(B, () => raidNet.ctx.cleared, null, 5000), 'bob 打倒奈克斯：通关');
  ok(await until(A, () => raidNet.S.st === 'rest', null, 5000), '追逐战完成 → 休整');
  ok((await Promise.all([backToCamp(A), backToCamp(B)])).every(Boolean), '两人回营地');
  ok((await Promise.all([claim(A, 1), claim(B, 1)])).every(Boolean), '两人各领 P1 奖励');
  await A.evaluate(() => menus.show('raidboard'));
  await A.screenshot({ path: `${out}/mp-07-board-rest.png` });
  await A.click('[data-win="raidboard"] [data-act="next"]');
  ok((await Promise.all([A, B].map(P => until(P, () => raidNet.S.phase === 2 && raidNet.S.st === 'routes', null, 5000)))).every(Boolean), '团长提前开始讨伐战');
  // ---- 讨伐战 ----
  ok((await Promise.all([enterNode(A, 'sub_a'), enterNode(B, 'sub_b')])).every(Boolean), '潜意识之厅 A / B 分头');
  await killBoss(A); await killBoss(B);
  ok((await Promise.all([backToCamp(A), backToCamp(B)])).every(Boolean), '两边通关回营地');
  ok((await Promise.all([enterNode(A, 'con_hall'), enterNode(B, 'con_mut')])).every(Boolean), 'alice 意识之厅 / bob 变异的潜意识之厅');
  await killBoss(B);
  ok(await until(A, () => { const b = raidNet.ctx.boss; return b.msMul && b.msMul.raid_phantom_groggy === 1.6 && b.aiCd > 10; }, null, 4000), '变异的潜意识之厅通关 → 幻影破防（受伤 ×1.6、停手）', await boss(A));
  ok(await backToCamp(B), 'bob 回营地');
  await killBoss(A); ok(await backToCamp(A), 'alice 通关意识之厅');
  ok((await A.evaluate(() => raidNet.S.st)) === 'final', '最终领主的门开了');
  await sel(B, 'coffin');
  ok(await B.evaluate(() => !document.querySelector('.rbnd button[data-act="solo"]') && /队长/.test(document.querySelector('.rbnd .why').textContent)), 'bob（队员）：最终战不能单独进，写着等队长带队');
  await sel(A, 'coffin');
  ok(await A.evaluate(() => !!document.querySelector('.rbnd button[data-act="together"]') && !document.querySelector('.rbnd button[data-act="solo"]')), '队长：最终战只有“一起进”');
  await A.screenshot({ path: `${out}/mp-08-board-final.png` });
  await A.click('[data-win="raidboard"] .rbnd button[data-act="together"]');
  const bothIn = await Promise.all([A, B].map(P => until(P, () => game.scene === 'dungeon' && coop.state === 'play' && game.dungeon && game.dungeon.raid && game.dungeon.raid.node === 'coffin', null, 40000)));
  ok(bothIn.every(Boolean), '一起进最终战：组队房间（两人同一张图）');
  const rm = await A.evaluate(() => ({ meta: coop.room && coop.room.meta, role: coop.role, host: raidNet.ctx.isHost }));
  ok(rm.meta && rm.meta.raid && rm.meta.node === 'coffin' && rm.meta.run && rm.role === 'host' && rm.host, '房间 meta 带团本信息（raid / node / run），队长是主机', rm);
  await until(A, () => !!raidNet.ctx.boss, null, 10000);
  await sleep(3500);
  ok(await A.evaluate(() => !!(raidNet.S.cp && raidNet.S.cp.coffin)), '主机报存档点');
  await A.screenshot({ path: `${out}/mp-09-final-host.png` }); await B.screenshot({ path: `${out}/mp-10-final-guest.png` });
  await killBoss(A);
  ok((await Promise.all([A, B].map(P => until(P, () => raidNet.S.st === 'cleared' && menus.isOpen('result'), null, 15000)))).every(Boolean), '最终领主倒下：团本通关（两边都看到结算）');
  ok((await Promise.all([backToCamp(A), backToCamp(B)])).every(Boolean), '两人回营地');
  ok((await Promise.all([claim(A, 2), claim(B, 2)])).every(Boolean), '两人各领 P2 奖励（翻 2 张）');
  const own = await Promise.all([A, B].map(P => P.evaluate(async () => { const count = () => inv.items.filter(x => x.key === 'raid_petal').reduce((n, x) => n + x.n, 0); const o = count(); raidNet.claim(2); raidNet.claim(1); await new Promise(r => setTimeout(r, 800)); const r = await raidNet.fetch(); return { o, o2: count(), got: Object.keys(save.data.raidGot).length, lim: r.limits }; })));
  // 新翻牌流程只把玩家明确选择的牌入账：P1 选 1 张、P2 选 2 张；
  // 检查每个阶段的最低货币奖励和重复领取不重复入账。
  ok(own.every(x => x.o === x.o2 && x.o >= 3 + 12 && x.got === 2), '重复领：选择的奖励只入账一次（每人 P1 + P2）', own);
  ok(own.every(x => x.lim.dayLeft === 0 && x.lim.weekLeft === 1), '次数 −1：今天 0 / 本周剩 1', own.map(x => x.lim));
  await A.evaluate(() => { menus.closeAll(); menus.show('raidboard'); }); await sleep(300);
  await A.screenshot({ path: `${out}/mp-11-board-cleared.png` });
  const errs = dumpErrors(players);
  ok(!errs.length, '页面没有报错', errs.slice(0, 5));
} catch (e) { ok(false, '异常：' + (e.stack || e)); await Promise.all([A, B].map((P, i) => P.screenshot({ path: `${out}/mp-zz-fail${i}.png` }).catch(() => {}))); }
await close(); await srv.stop();
const r = result(); console.log(`\n${r.total - r.fails}/${r.total} 通过`); process.exit(r.fails ? 1 : 0);
