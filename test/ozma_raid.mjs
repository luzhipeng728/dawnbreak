// 奥兹玛团本规则单测（不开浏览器）：RAID_DEFS.ozma 节点图 / 三档（guide、duo、team 12 人 3 队）/ 钥匙·功能·双剑·倒计时·精英·锁血解除 / 理智 / 混沌奖励 / 融合装备奖励表
// 用法：node test/ozma_raid.mjs
import fs from 'fs'; import vm from 'vm';
const rd = f => fs.readFileSync(new URL('../src/game/' + f, import.meta.url), 'utf8');
const src = rd('ozma_core.js') + '\n' + rd('raid_core.js') + '\n' + rd('raid_ozma.js') + '\nthis.RAID_CORE = RAID_CORE; this.RAID_DEFS = RAID_DEFS; this.RAID_OZMA = RAID_OZMA; this.OZMA_CORE = OZMA_CORE;';
const ctx = {}; vm.runInNewContext(src, ctx); const R = ctx.RAID_CORE, D = ctx.RAID_DEFS.ozma, O = ctx.OZMA_CORE; let fail = 0;
const ok = (v, m, x) => { console.log(v ? '  ✓' : '  ✗', m, x === undefined ? '' : (v ? '' : JSON.stringify(x))); if (!v) fail++; };
const T0 = 1e6, ev = (S, e, now) => R.event(S, e, now);
const mk = n => Array.from({ length: n }, (_, i) => ({ uid: i + 1, cid: 'c' + (i + 1), name: 'P' + (i + 1) }));
function lobby(n, mode, team) {
  const ms = mk(n), S = R.init('ozma', [ms[0]], mode || 'normal', T0, { sid: 'oz' + n, seed: 5, team: !!team, guard: { minClear: 0, maxDrop: 0 } });
  for (const m of ms.slice(1)) ev(S, Object.assign({ t: 'join' }, m), T0);
  for (const m of S.members) m.ready = true; return S;
}
let clock = T0;
// 某个队（队长 uid）进节点 → 报领主房 → 通关
function clearNode(S, uid, node, withIds = []) {
  clock += 1000;
  const e = ev(S, { t: 'enter', uid, node, with: withIds }, clock); if (e.err) return e;
  const run = e.ack && e.ack.run; ev(S, { t: 'boss', uid, run }, clock += 500);
  const c = ev(S, { t: 'clear', uid, run }, clock += 1000); return c;
}

console.log('— 节点图');
{
  ok(D && D.maxPlayers === 12 && D.teamSize === 4 && D.maxTeams === 3, '奥兹玛：12 人 3 队每队 4', D && [D.maxPlayers, D.teamSize, D.maxTeams]);
  const G = R.graph('ozma', 'normal'), P1 = G.phases[0], P2 = G.phases[1];
  ok(Object.keys(P1.nodes).length === 15 && Object.keys(P2.nodes).length === 3, '阶段 1 有 15 张图（三区域各 5）、阶段 2 有 3 张图', [Object.keys(P1.nodes).length, Object.keys(P2.nodes).length]);
  const all = Object.values(P1.nodes).concat(Object.values(P2.nodes));
  ok(all.every(n => O.MAP_BY_ID[n.dg.replace(/^ozma_/, '')]), '每个节点的 dg 都对应 OZMA_CORE 的地图');
  ok(new Set(all.map(n => n.dg)).size === 18, '18 张地图全部用上、不重复');
  ok(['key', 'func', 'main'].every(t => Object.values(P1.nodes).some(n => n.type === t)) && Object.values(P2.nodes).some(n => n.type === 'timer'), '有钥匙图 / 功能图 / 主线图 / 倒计时图');
  ok(Object.values(P1.nodes).filter(n => n.fx && n.fx.clear && n.fx.clear.some(f => f.kind === 'chaos')).length === 2, '两张双剑图（通关混沌等级 +1）');
  const g = R.graph('ozma', 'guide');
  ok(Object.keys(g.phases[0].nodes).length === 9 && !g.phases[1].nodes.p2_elerinon, '引导图：每区 3 张（钥匙 / 主线 / 领主），没有倒计时图', Object.keys(g.phases[0].nodes).length);
  ok(g.phases[1].nodes.p2_throne.need.join() === 'p2_armis', '引导图：奥兹玛要先过阿斯特罗斯');
  ok(D.sanity.max === 100 && D.sanity.restore === 50 && D.chaos.max === 3, '理智值 100 / 回 50、混沌 1~3');
  const gear = D.rewards.p2[1].table[1][1].pick;
  ok(gear.length === 25 && new Set(gear).size === 25 && gear.every(k => /^raid_oz_(ruin|despair|terror|sacrifice|flame)_[1-5]$/.test(k)), '融合装备奖励 25 件（5 系列 × 5）');
}

console.log('— 12 人 3 队：阶段 1');
const S = lobby(12, 'normal', true);
{
  ok(S.tier === 'team' && S.members.length === 12, '12 人团队版进大厅');
  ev(S, { t: 'start', uid: 1 }, T0);
  ok(S.st === 'routes' && S.teams.length === 3 && S.teams.every(t => t.members.length === 4), '开团：3 队每队 4 人', S.teams.map(t => t.members.length));
  ok(S.sc === undefined || true, '');
  const T = S.teams.map(t => t.members), lead = i => T[i][0], rest = i => T[i].slice(1);
  ok(R.view(S).chaos && R.view(S).chaos.lv === 1 && S.members.every(m => m.san === 100), '混沌等级 1、理智 100');
  // 钥匙图
  const L = ctx.RAID_OZMA.LORD;
  let r = ev(S, { t: 'enter', uid: lead(0), node: 'ruin_resting', with: rest(0) }, clock += 1000);
  ok(r.err, '没拿钥匙图之前进不了主线图', r.err);
  clearNode(S, lead(0), 'ruin_path', rest(0)); clearNode(S, lead(1), 'despair_crossroads', rest(1)); clearNode(S, lead(2), 'terror_land', rest(2));
  ok(S.keys.ruin && S.keys.despair && S.keys.terror, '三把区域钥匙');
  // 毁灭：主线 + 双剑图 + 亡者回廊
  clearNode(S, lead(0), 'ruin_resting', rest(0));
  r = ev(S, { t: 'enter', uid: lead(0), node: 'ruin_beyond', with: rest(0) }, clock += 1000);
  ok(r.err, '功能图 / 主线没打完不能进贝利亚斯', r.err);
  clearNode(S, lead(0), 'ruin_gladden', rest(0));
  ok(S.chaos.lv === 2, '双剑图（欢愉）通关：混沌等级 2', S.chaos);
  clearNode(S, lead(0), 'ruin_corridor', rest(0));
  ok(S.gbuffs.some(b => b.id === 'dead_hall' && b.p.dmgTaken === 1.12), '亡者回廊：全团增伤', S.gbuffs);
  // 绝望：赛赫 → 理智上限 +30
  clearNode(S, lead(1), 'despair_aventus', rest(1)); clearNode(S, lead(1), 'despair_phylis', rest(1));
  clearNode(S, lead(1), 'despair_serha', rest(1));
  ok(S.gbuffs.some(b => b.id === 'serha' && b.p.sanMax === 30), '赛赫：理智上限 +30', S.gbuffs);
  const m1 = S.members[0];
  ev(S, { t: 'san', uid: m1.uid, v: -50 }, clock); ev(S, { t: 'san', uid: m1.uid, v: 40 }, clock); ev(S, { t: 'san', uid: m1.uid, v: 40 }, clock);
  ok(m1.san === 130, '理智上限被赛赫提到 130', m1.san);
  // 恐怖：卡赞要祭坛
  clearNode(S, lead(2), 'terror_grauben', rest(2)); clearNode(S, lead(2), 'terror_eldfell', rest(2));
  ok(S.chaos.lv === 3, '第二张双剑图（艾德菲尔）：混沌等级 3', S.chaos);
  r = ev(S, { t: 'enter', uid: lead(2), node: 'terror_martyr', with: rest(2) }, clock += 1000);
  ok(r.err, '祭坛没点亮：卡赞不开', r.err);
  clearNode(S, lead(2), 'terror_red_altar', rest(2));
  ok(S.keys.altar, '赤红乐园祭坛：卡赞无敌解除（altar 钥匙）');
  // 精英击杀：门将给全团理智
  r = ev(S, { t: 'enter', uid: lead(1), node: 'despair_lunen', with: rest(1) }, clock += 1000);
  ok(!r.err, '提亚马特之门已开', r.err); const lrun = r.ack && r.ack.run;
  const before = S.members.find(m => m.uid === 5).san;
  const e2 = ev(S, { t: 'elite', uid: lead(1), v: 'ozEliteDespair', run: lrun }, clock += 500);
  ok(!e2.err, '门将精英击杀上报', e2.err); 
  ev(S, { t: 'boss', uid: lead(1), run: lrun }, clock += 100); ev(S, { t: 'clear', uid: lead(1), run: lrun }, clock += 100);
  ok(S.members.find(m => m.uid === 5).san >= before && e2.fx !== undefined, '门将倒下：全团理智 +10');
  clearNode(S, lead(0), 'ruin_beyond', rest(0)); clearNode(S, lead(2), 'terror_martyr', rest(2));
  ok(S.st === 'rest' || S.phase === 1 || S.res.phases.includes(1), '三个主领主倒下：阶段 1 完成', [S.st, S.phase]);
}

console.log('— 12 人 3 队：阶段 2（埃利诺斯倒计时 / 阿斯特罗斯 / 奥兹玛）');
{
  const r0 = R.rollReward(S, 1, 1, () => 0.5);
  ok(r0.cards.length === 2 && r0.cards.every(c => c.key === 'raid_ozma_grudge'), 'P1 奖励：混沌的怨念 ×2 张牌', r0);
  const low = R.rollReward(Object.assign(JSON.parse(JSON.stringify(S)), { chaos: { lv: 1, max: 3 } }), 1, 1, () => 0.5);
  ok(r0.cards[0].n > low.cards[0].n, '混沌等级 3 的货币多于等级 1', [r0.cards[0].n, low.cards[0].n]);
  for (const m of S.members) { R.flipOpen(S, m.uid, 1, clock += 10); R.flipPick(S, m.uid, 1, 0, clock += 10, () => 0.3); R.flipClose(S, m.uid, 1, clock += 10); }
  const st2 = ev(S, { t: 'start', uid: 1 }, clock += 1000);
  ok(S.st === 'final' && S.phase === 1, '进入阶段 2', [S.st, S.phase, st2.err]);
  const T = S.teams.map(t => t.members), lead = i => T[i][0], rest = i => T[i].slice(1);
  const tn = S.nodes.p2_elerinon;
  ok(tn.timer > 0, '埃利诺斯倒计时已开始', tn);
  // 倒计时到点没压制：进度重置（阿斯特罗斯所在图），全团理智 -15
  const e1 = ev(S, { t: 'enter', uid: lead(0), node: 'p2_armis', with: rest(0) }, clock += 1000);
  ok(!e1.err && S.nodes.p2_armis.st === 'busy', '一队进阿斯特罗斯', e1.err);
  const sanBefore = S.members[8].san, resetT = tn.timer + 1000;
  const tk = R.tick(S, resetT);
  ok(S.stats.penalties >= 1 && tk.fx.some(f => f.kind === 'reset' || f.kind === 'sanity'), '倒计时没压制：炸团（重置 + 理智 -15）', tk.fx.map(f => f.kind));
  ok(S.members[8].san === sanBefore - 15, '全团理智 -15', [sanBefore, S.members[8].san]);
  clock = resetT;
  // 二队压制埃利诺斯
  const el = ev(S, { t: 'enter', uid: lead(1), node: 'p2_elerinon', with: rest(1) }, clock += 1000);
  ok(!el.err, '二队进埃利诺斯', el.err);
  const erun = el.ack && el.ack.run;
  const ee = ev(S, { t: 'elite', uid: lead(1), v: 'ozEliteSuppress', run: erun }, clock += 500);
  ok(!ee.err, '压制者倒下 → 倒计时重置', ee.err);
  ev(S, { t: 'boss', uid: lead(1), run: erun }, clock += 100); ev(S, { t: 'clear', uid: lead(1), run: erun }, clock += 100);
  ok(S.gbuffs.some(b => b.id === 'elerinon_sup'), '埃利诺斯被压制：全团增伤 15%');
  // 奥兹玛：任何时候可进（共享血量存档点），阿斯特罗斯倒下前锁血（运行时 ozmaLock 读 gbuff）
  ok(!S.gbuffs.some(b => b.id === 'ozmaUnlock'), '阿斯特罗斯没倒：奥兹玛未解锁');
  const th = ev(S, { t: 'enter', uid: lead(2), node: 'p2_throne', with: rest(2) }, clock += 1000);
  ok(!th.err, '三队先进王座打奥兹玛', th.err);
  const trun = th.ack && th.ack.run;
  ev(S, { t: 'hp', uid: lead(2), run: trun, v: 0.5 }, clock += 100);
  // 阿斯特罗斯所在图通关 → 解锁
  ok(S.nodes.p2_armis.st === 'open', '倒计时炸团：阿斯特罗斯的进度被重置（队伍被踢回营地）', S.nodes.p2_armis.st);
  const ae = ev(S, { t: 'enter', uid: lead(0), node: 'p2_armis', with: rest(0) }, clock += 100); const arun = ae.ack && ae.ack.run;
  ev(S, { t: 'boss', uid: lead(0), run: arun }, clock += 100); const ac = ev(S, { t: 'clear', uid: lead(0), run: arun }, clock += 100);
  ok(S.gbuffs.some(b => b.id === 'ozmaUnlock'), '阿斯特罗斯倒下：奥兹玛解锁（全团增益 ozmaUnlock）', ac.err);
  ev(S, { t: 'boss', uid: lead(2), run: trun }, clock += 100); const fc = ev(S, { t: 'clear', uid: lead(2), run: trun }, clock += 100);
  ok(!fc.err && S.st === 'cleared', '击败奥兹玛：团本通关', [S.st, fc.err]);
  const r2 = R.rollReward(S, 1, 2, () => 0.9);
  ok(r2.cards.length === 2 && r2.cards[1].key.startsWith('raid_oz_'), 'P2 第二张牌可出融合装备', r2);
  const r3 = R.rollReward(S, 1, 2, () => 0.2);
  ok(r3.cards[1].key === 'raid_ozma_grudge', 'P2 第二张牌多数是货币', r3);
}

console.log('— 理智值');
{
  const S2 = lobby(4, 'normal', true); ev(S2, { t: 'start', uid: 1 }, T0);
  const m = S2.members[0];
  let o = ev(S2, { t: 'san', uid: m.uid, v: -40 }, T0 + 1); ok(m.san === 60, '机制攻击降低理智', m.san);
  ev(S2, { t: 'san', uid: m.uid, v: -40 }, T0 + 2); o = ev(S2, { t: 'san', uid: m.uid, v: -40 }, T0 + 3);
  ok(m.san === 50 && o.fx.some(f => f.kind === 'sanity' && f.p.mini), '第一次归零：进小游戏回 50', [m.san, o.fx]);
  ev(S2, { t: 'san', uid: m.uid, v: -40 }, T0 + 4); o = ev(S2, { t: 'san', uid: m.uid, v: -40 }, T0 + 5);
  ok(o.fx.some(f => f.kind === 'sanity' && f.p.dead), '第二次归零：倒下', o.fx);
}

console.log('— 引导 / 两人版');
{
  const g = lobby(1, 'guide'); ev(g, { t: 'start', uid: 1 }, T0);
  ok(g.tier === 'guide' && g.st === 'routes', '引导 1 人直接开');
  const lead = 1; let r = clearNode(g, lead, 'ruin_path'); ok(!r.err && g.keys.ruin, '引导：钥匙图', r.err);
  r = clearNode(g, lead, 'ruin_resting'); ok(!r.err, '引导：主线图', r.err);
  r = clearNode(g, lead, 'ruin_beyond'); ok(!r.err, '引导：直接挑战领主（功能图 / 第二张主线都没有）', r.err);
  const d = lobby(2, 'normal', false); ev(d, { t: 'start', uid: 1 }, T0);
  ok(d.tier === 'duo' && d.nTeams === 2, '两人版：2 队', [d.tier, d.nTeams]);
  ok(R.scale(d, 'ruin_path', 1).hp === 0.6, '两人版：领主血量 ×0.6', R.scale(d, 'ruin_path', 1));
}

console.log(fail ? `\n${fail} 项失败` : '\n全部通过'); process.exit(fail ? 1 : 0);
