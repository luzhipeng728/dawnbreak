// 两人团本（RA2）：2 个真实客户端（alice 队长、bob），普通模式从头打到尾（本地服务端 DNF_RAID_FAST=1 + 页面 ?raidfast）
// 组队 → 队长在阿甘左那里建团 → bob 收到邀请点加入 → 准备 → 开始 →
// 组队 → 队长在阿甘左那里建团 → bob 收到邀请点加入 → 准备 → 开始 →
//   破坏之门 ×4 按顺序（错序：守门人回满血）→ 梦幻之黎明 + 噩梦之夜 并行（没通关的图每 30 秒叠惩罚：哈妮尔攻防、黎明刷怪；通关后 < 0.5 秒撤掉）→
//   苦难之境（镜子到 0：重置、alice 被送回营地；bob 断线时打完镜子，上报排队，重连后补发，进度不丢）→
//   无形之门 1 / 2（各打各的；到领主房 → 幻影之城开放）→ 休整、两人各领 P1 → 讨伐战（扭曲 → 意识之棺虚弱；真理之棺共享血量 / 撤退退回 / 压抑旋转 / 忘却共鸣）→
//   阴影之棺队长带队一起进（组队房间，room:open meta 带团本信息）→ 共享血量打空 = 通关 → 两人各领 P2（重复领不重复入账）→ 次数 今天 0 / 本周剩 1
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
  ok((await Promise.all([A, B].map(P => until(P, () => raidNet.S.st === 'routes' && raidNet.S.graph === 'normal' && menus.isOpen('raidboard'), null, 6000)))).every(Boolean), '阻截战开始：两边都打开情况板（普通图）');
  const lives = await A.evaluate(() => raidNet.S.lives);
  ok(lives === 6, '全团 6 次复活', lives);
  await sel(A, 'law_a');
  ok(await A.evaluate(() => !document.querySelector('.rbnd button[data-act="together"]') && /分头/.test(document.querySelector('.rbnd').textContent)), '破坏之门：必须分头（没有“一起进”）');
  await A.screenshot({ path: `${out}/mp-02-board-start.png` });
  // ---- 破坏之门 ×4：顺序（共享时限）----
  const laws = await A.evaluate(() => ['law_a', 'law_b', 'law_c', 'law_d'].sort((x, y) => raidNet.S.nodes[x].order - raidNet.S.nodes[y].order));
  const ins = await Promise.all([enterNode(A, laws[0]), enterNode(B, laws[1])]);
  ok(ins.every(Boolean), '两人各进一张破坏之门（顺序 1 / 2）');
  const [oa, ob] = await Promise.all([A, B].map(P => P.evaluate(() => raidNet.ctx.order)));
  ok(oa === 1 && ob === 2 && await A.evaluate(() => !!raidNet.S.glim.law), `顺序数字 alice ${oa} / bob ${ob}；破坏之门开始共享时限`);
  await B.evaluate(() => { const b = game.dungeon.boss; b.hp = Math.round(b.hpMax * 0.06); });
  ok(await until(B, () => raidNet.feed.some(f => /还没轮到你/.test(f.text)), null, 4000), '数字大的一边压到 10% 以下：提示“还没轮到你”');
  ok(await killBoss(B), '数字大的先打倒：领主先按住（等裁决）');
  ok(await until(B, () => { const C = raidNet.ctx; return C && !C.held && C.boss.hp === C.boss.hpMax; }, null, 4000) && await until(A, () => raidNet.ctx.boss.hp === raidNet.ctx.boss.hpMax, null, 4000), '错序：守门人回满血（按住的那个也起来接着打）');
  ok(await killBoss(A) && await until(A, () => raidNet.ctx.cleared, null, 4000), '数字 1 先倒：裁决通过、真的倒下');
  ok(await killBoss(B) && await until(B, () => raidNet.ctx.cleared, null, 4000), '轮到数字 2：通关');
  ok((await Promise.all([backToCamp(A), backToCamp(B)])).every(Boolean), '两人回营地');
  ok((await Promise.all([enterNode(A, laws[2]), enterNode(B, laws[3])])).every(Boolean), '再进顺序 3 / 4');
  ok(await killBoss(A) && await until(A, () => raidNet.ctx.cleared, null, 4000) && await killBoss(B) && await until(B, () => raidNet.ctx.cleared, null, 4000), '按顺序打倒 3、4');
  ok((await Promise.all([backToCamp(A), backToCamp(B)])).every(Boolean), '两人回营地');
  ok((await nst(A, 'wit_dawn')) === 'open' && (await nst(A, 'wit_night')) === 'locked', '知性之境：黎明开放，另外 3 张要等有人进黎明');
  // ---- 梦幻之黎明（alice）+ 噩梦之夜（bob）：噩梦之夜没通关 → 哈妮尔每 30 秒叠攻防、幻影之界 / 归还之昼往黎明里刷怪 ----
  ok(await enterNode(A, 'wit_dawn'), 'alice 进黎明');
  ok(await until(B, () => raidNet.S.nodes.wit_night.st === 'open', null, 4000) && await enterNode(B, 'wit_night'), '黎明有人进了：bob 进噩梦之夜');
  const atk0 = await A.evaluate(() => raidNet.ctx.boss.atk);
  shift(30500);
  ok(await until(A, () => (window.__fx || []).some(f => f.kind === 'buff' && f.id === 'night_haniel'), null, 4000), 'alice 收到“噩梦之夜未通关”的叠层');
  const ba = await A.evaluate(() => { const b = raidNet.ctx.boss; return { atk: b.atk, def: b.msMul && b.msMul.raid_def_night_haniel, adds: ents.filter(e => !e.dead && (e.kind === 'siRaidMob_phantomAdd' || e.kind === 'siRaidMob_genbu')).length }; });
  ok(ba.atk === Math.round(atk0 * 1.05) && Math.abs(ba.def - 1 / 1.05) < 1e-6 && ba.adds >= 1, '哈妮尔攻击 +5% / 防御 +5%（两人系数），黎明里刷出了幻影 / 玄武', { atk0, ...ba });
  await A.screenshot({ path: `${out}/mp-03-hud-aura.png` });
  await killBoss(B);
  ok(await until(A, () => (window.__fx || []).some(f => f.kind === 'unbuff' && f.id === 'night_haniel'), null, 4000), '噩梦之夜通关：叠层撤掉');
  const tB = await B.evaluate(() => window.__killT), tA = await A.evaluate(() => window.__fx.find(f => f.kind === 'unbuff' && f.id === 'night_haniel').T);
  ok(tA - tB < 500 && (await A.evaluate(a => raidNet.ctx.boss.atk === a, atk0)), `跨图效果到达用时 ${tA - tB}ms（< 0.5 秒），哈妮尔攻击恢复`);
  ok(await backToCamp(B), 'bob 回营地');
  ok((await nst(B, 'wit_night')) === 'cool', '噩梦之夜进入重生');
  await killBoss(A); ok(await backToCamp(A), 'alice 通关梦幻之黎明');
  ok((await nst(A, 'wit_night')) === 'off' && (await nst(A, 'pain_mirror')) === 'open' && (await nst(A, 'pain_mirror2')) === 'open', '黎明通关：另外 3 张关闭，苦难之境开放（两面镜子开始倒计时）');
  // ---- 苦难之境：镜子到 0 → 重置；bob 断线时打完镜子 ----
  ok(await enterNode(A, 'pain_mem'), 'alice 进记忆的碎片');
  const dl0 = await A.evaluate(() => raidNet.S.deadline);
  shift(301000);
  ok(await until(A, () => (window.__fx || []).some(f => f.kind === 'reset') && game.scene === 'town' && (!raidNet.ctx || raidNet.ctx.done), null, 8000), '没人压镜子、倒计时到 0：苦难之境Ⅰ 重置，alice 被送回营地');
  ok(await until(B, d => raidNet.S.deadline === d && raidNet.S.nodes.pain_mem.st === 'open', dl0, 4000), '时间不退（bob 那边也看到进度重置）');
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
  ok((await Promise.all([enterNode(A, 'pain_mem'), enterNode(B, 'pain_mem2')])).every(Boolean), 'alice 记忆的碎片 / bob 碎片的记忆');
  await killBoss(A); await killBoss(B);
  ok((await Promise.all([backToCamp(A), backToCamp(B)])).every(Boolean), '两边通关回营地');
  ok((await nst(A, 'gate_l')) === 'open' && (await nst(A, 'gate_r')) === 'open' && (await nst(A, 'castle_l')) === 'locked', '无形之门 ×2 开放（幻影之城还没开）');
  // ---- 无形之门：各打各的；门的队伍到领主房 → 幻影之城开放 ----
  ok((await Promise.all([enterNode(A, 'gate_l'), enterNode(B, 'gate_r')])).every(Boolean), 'alice 维塔 / bob 奈克斯');
  ok(await until(A, () => raidNet.S.nodes.castle_l.st === 'open' && raidNet.S.nodes.castle_r.st === 'open', null, 4000), '两边都到了领主房：幻影之城 / 城之幻影开放');
  ok(await killBoss(A) === false && await until(A, () => raidNet.ctx.cleared, null, 4000), 'alice 打倒维塔：直接通关（不用等另一边）');
  await sleep(300);
  await B.screenshot({ path: `${out}/mp-05-hud-gate.png` });
  ok((await nst(A, 'gate_l')) === 'cleared' && (await nst(A, 'gate_r')) === 'busy', '一扇门通关、另一扇还在打');
  await killBoss(B);
  ok(await until(B, () => raidNet.ctx.cleared, null, 5000), 'bob 打倒奈克斯：通关');
  ok(await until(A, () => raidNet.S.st === 'rest', null, 5000), '阻截战完成 → 休整');
  ok((await Promise.all([backToCamp(A), backToCamp(B)])).every(Boolean), '两人回营地');
  ok((await Promise.all([claim(A, 1), claim(B, 1)])).every(Boolean), '两人各领 P1 奖励');
  await A.evaluate(() => menus.show('raidboard'));
  await A.screenshot({ path: `${out}/mp-07-board-rest.png` });
  await A.click('[data-win="raidboard"] [data-act="next"]');
  ok((await Promise.all([A, B].map(P => until(P, () => raidNet.S.phase === 2 && raidNet.S.st === 'routes', null, 5000)))).every(Boolean), '团长提前开始讨伐战');
  // ---- 讨伐战：第 3 / 2 界 ----
  for (const [a, b] of [['sub_a', 'sub_b'], ['sub_c', 'sub_d']]) {
    ok((await Promise.all([enterNode(A, a), enterNode(B, b)])).every(Boolean), `无欲之棺 ${a} / ${b} 分头`);
    await killBoss(A); await killBoss(B);
    ok((await Promise.all([backToCamp(A), backToCamp(B)])).every(Boolean), '两边通关回营地');
  }
  ok(await enterNode(A, 'con_hall') && await until(A, () => raidNet.S.nodes.con_hall.boss, null, 4000), 'alice 进意识之棺 1（到领主房）');
  ok(await enterNode(B, 'con_mut'), 'bob 进扭曲的无欲之棺 1');
  await killBoss(B);
  ok(await until(A, () => { const b = raidNet.ctx.boss; return (window.__fx || []).some(f => f.kind === 'groggy' && f.id === 'con_weak') && b.aiCd > 8; }, null, 4000), '扭曲通关 → 意识之棺的希洛克虚弱 10 秒（停手）', await boss(A));
  ok(await backToCamp(B), 'bob 回营地');
  await killBoss(A); ok(await backToCamp(A), 'alice 通关意识之棺 1');
  ok(await enterNode(B, 'con_hall2'), 'bob 进意识之棺 2'); await killBoss(B); ok(await backToCamp(B), 'bob 通关意识之棺 2');
  // ---- 第 1 界：共享血量、压抑旋转、忘却共鸣 → 阴影之棺 ----
  ok(await enterNode(A, 'truth_a'), 'alice 进真理的意识之棺 1');
  ok(await until(A, () => raidNet.S.nodes.deny.st === 'open' && raidNet.S.nodes.suppress.st === 'open', null, 4000), '遇到希洛克：否定 / 压抑 / 忘却开放');
  await A.evaluate(() => { const b = raidNet.ctx.boss; b.hp = Math.round(b.hpMax * 0.6); });
  ok(await until(A, () => Math.abs(raidNet.S.pools.truth.hp - 0.6) < 0.02, null, 4000), 'alice 打到 60%：共享血量跟着掉');
  ok(await enterNode(B, 'truth_b'), 'bob 进真理的意识之棺 2');
  ok(Math.abs((await boss(B)).hp - 0.6) < 0.02, 'bob 那边的希洛克也是 60%', await boss(B));
  await B.evaluate(() => { const b = raidNet.ctx.boss; b.hp = Math.round(b.hpMax * 0.5); });
  ok(await until(A, () => Math.abs(raidNet.ctx.boss.hp / raidNet.ctx.boss.hpMax - 0.5) < 0.02, null, 4000), 'bob 打掉的 10% 同步到 alice 那边', await boss(A));
  { const by = await A.evaluate(() => { const Q = raidNet.ctx.pool || {}, me = String(raidNet.me()), M = raidNet.mate(); return { me: (Q.by || {})[me] || 0, mate: M ? (Q.by || {})[String(M.uid)] || 0 : 0 }; });
    ok(Math.abs(by.me - 0.4) < 0.03 && Math.abs(by.mate - 0.1) < 0.03, `共享血量按队伍颜色：alice 那边看到自己 ${Math.round(by.me * 100)}%、bob ${Math.round(by.mate * 100)}%`, by); }
  await A.screenshot({ path: `${out}/mp-06-hud-pool.png` });
  await B.evaluate(() => { raidNet.ev('fail', 'retreat'); raidNet.leaveNode('撤退'); });
  ok(await until(A, () => Math.abs(raidNet.ctx.boss.hp / raidNet.ctx.boss.hpMax - 0.6) < 0.02, null, 4000), 'bob 撤退：这次的伤害退回（alice 那边回到 60%）', await boss(A));
  ok(await until(B, () => game.scene === 'town', null, 8000), 'bob 回营地');
  shift(61000);
  for (let k = 0; k < 3 && (await A.evaluate(() => !raidNet.S.rot.res)); k++) {
    ok(await until(B, () => raidNet.S.nodes.suppress.st === 'open' && raidNet.mine().ero <= raidNet.now(), null, 6000) && await enterNode(B, 'suppress'), 'bob 进压抑');
    await killBoss(B); ok(await backToCamp(B), '压抑通关：真理之棺旋转');
    shift(31000);
  }
  ok(await A.evaluate(() => raidNet.S.rot.res), '转到共鸣位置');
  ok(await until(B, () => raidNet.S.nodes.forget.st === 'open', null, 4000) && await enterNode(B, 'forget'), 'bob 进忘却');
  await killBoss(B);
  ok(await until(A, () => game.scene === 'town' && raidNet.S.st === 'final' && raidNet.S.nodes.coffin.st === 'open', null, 8000), '共鸣时通关忘却：alice 被收回营地，阴影之棺开了');
  ok(await backToCamp(B), 'bob 回营地');
  await sel(B, 'coffin');
  ok(await B.evaluate(() => !document.querySelector('.rbnd button[data-act="solo"]') && /队长/.test(document.querySelector('.rbnd .why').textContent)), 'bob（队员）：阴影之棺不能单独进，写着等队长带队');
  await sel(A, 'coffin');
  ok(await A.evaluate(() => !!document.querySelector('.rbnd button[data-act="together"]') && !document.querySelector('.rbnd button[data-act="solo"]')), '队长：阴影之棺只有“一起进”');
  await A.screenshot({ path: `${out}/mp-08-board-final.png` });
  await A.click('[data-win="raidboard"] .rbnd button[data-act="together"]');
  const bothIn = await Promise.all([A, B].map(P => until(P, () => game.scene === 'dungeon' && coop.state === 'play' && game.dungeon && game.dungeon.raid && game.dungeon.raid.node === 'coffin', null, 40000)));
  ok(bothIn.every(Boolean), '一起进阴影之棺：组队房间（两人同一张图）');
  const rm = await A.evaluate(() => ({ meta: coop.room && coop.room.meta, role: coop.role, host: raidNet.ctx.isHost }));
  ok(rm.meta && rm.meta.raid && rm.meta.node === 'coffin' && rm.meta.run && rm.role === 'host' && rm.host, '房间 meta 带团本信息（raid / node / run），队长是主机', rm);
  await until(A, () => !!raidNet.ctx.boss, null, 10000);
  const fb = await boss(A);
  ok(fb && Math.abs(fb.hp - 0.6) < 0.02 && fb.ai > 20, '阴影之棺：希洛克接着共享的 60%，进门就虚弱', fb);
  await A.screenshot({ path: `${out}/mp-09-final-host.png` }); await B.screenshot({ path: `${out}/mp-10-final-guest.png` });
  await killBoss(A);
  ok((await Promise.all([A, B].map(P => until(P, () => raidNet.S.st === 'cleared' && menus.isOpen('result'), null, 15000)))).every(Boolean), '共享血量打空：团本通关（两边都看到结算）');
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
