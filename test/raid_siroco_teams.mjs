// 希洛克多队版（16 人 4 队）的规则测试（纯规则核心）：参数随队数缩放、守门人顺序对应 4 队、倒计时节点由不同队分担、真理之棺三队共用一条血；两人版数值不变
// 用法：node test/raid_siroco_teams.mjs
import fs from 'fs'; import vm from 'vm';
const src = fs.readFileSync(new URL('../src/game/raid_core.js', import.meta.url), 'utf8') + '\nthis.RAID_CORE = RAID_CORE;';
const ctx = {}; vm.runInNewContext(src, ctx); const R = ctx.RAID_CORE;
let fail = 0, n = 0;
const ok = (v, m, x) => { n++; console.log(v ? '  ✓' : '  ✗', m, v ? '' : JSON.stringify(x ?? '').slice(0, 400)); if (!v) fail++; };
const sec = s => s * 1000;
let T = 1000;
const E = (S, uid, ev, dt = 0) => { T += dt; return R.event(S, { uid, ...ev }, T); };
const tick = (S, dt) => { T += dt; return R.tick(S, T); };
const st = (S, id) => S.nodes[id].st;
const Q = {};
const evr = (S, uid, run, t, v, dt = 0) => { Q[run] = (Q[run] || 0) + 1; return E(S, uid, { t, run, q: Q[run] * 100 + uid, v }, dt); };
function lobby(n) {
  const ms = Array.from({ length: n }, (_, i) => ({ uid: i + 1, cid: 'c' + (i + 1), name: 'P' + (i + 1) }));
  const S = R.init('siroco', [ms[0]], 'normal', T, { sid: 'teams' + n, seed: 5, team: true, guard: { minClear: 0, maxDrop: 0 } });
  for (const m of ms.slice(1)) R.event(S, { t: 'join', ...m }, T);
  for (const m of S.members) m.ready = true;
  const o = E(S, 1, { t: 'start' }); if (o.err) throw new Error(JSON.stringify(o.err));
  return S;
}
const TM = (S, i) => S.teams[i].members;
const enterT = (S, i, node) => E(S, TM(S, i)[0], { t: 'enter', node, with: TM(S, i).slice(1) });
function clearT(S, i, node, dt = 25) { const e = enterT(S, i, node); if (e.err) return e; const run = e.ack.run, u = TM(S, i)[0]; evr(S, u, run, 'down', null, sec(dt)); const c = evr(S, u, run, 'clear'); c.run = run; return c; }

console.log('— 多队版数值随队数缩放');
const S = lobby(16);
{
  const sc = R.scale(S, 'law_a', 4), D = R.defOf('siroco');
  ok(S.tier === 'team' && S.nTeams === 4 && S.teams.every(t => t.members.length === 4), '16 人 = 4 队 × 4 人');
  ok(sc.teams === 4 && sc.pen === 1 && sc.par === 0.5, '4 队：跨图惩罚 ×1、并行时限 ×0.5', sc);
  ok(S.lives === 12, '全团复活次数随队数（4 队 12，两队 6）', S.lives);
  ok(S.deadline - T === sec(2400) + 0 || Math.abs(S.deadline - T - sec(2400)) < 5, '阻截战 40 分钟（官方），不是两人版的 80 分钟', (S.deadline - T) / 1000);
  const S2 = R.init('siroco', [{ uid: 1, cid: 'a', name: 'a' }, { uid: 2, cid: 'b', name: 'b' }], 'normal', T, { sid: 'duo', seed: 5 });
  R.event(S2, { t: 'ready', uid: 2, on: true }, T); R.event(S2, { t: 'start', uid: 1 }, T);
  const s2 = R.scale(S2, 'law_a', 1);
  ok(s2.pen === 0.5 && s2.par === 1 && S2.lives === 6 && S2.deadline - T === sec(4800), '两人版不变：惩罚 ×0.5、时限 80 分钟、复活 6', [s2.pen, s2.par, S2.lives]);
}

console.log('— 守门人顺序 1~4 对应 4 队');
{
  const ids = ['law_a', 'law_b', 'law_c', 'law_d'], by = ids.slice().sort((a, b) => S.nodes[a].order - S.nodes[b].order);
  ok(by.map(id => S.nodes[id].order).join() === '1,2,3,4', '4 扇门的击杀顺序 1~4');
  const runs = by.map((id, i) => enterT(S, i, id));
  ok(runs.every(r => !r.err) && !!S.glim.law, '4 队同时进 4 扇门', runs.map(r => r.err));
  const lim = S.glim.law.until;
  const o = tick(S, sec(1)); void o;
  ok(lim - (T - sec(1)) <= sec(300) && lim - (T - sec(1)) > sec(290), '共享时限 5 分钟（官方 5 分钟，不再 ×2）', (lim - T) / 1000);
  for (let i = 0; i < 4; i++) { const r = runs[i].ack.run, u = TM(S, i)[0]; evr(S, u, r, 'down', null, sec(25)); const c = evr(S, u, r, 'clear'); ok(!c.err, `第 ${i + 1} 个打倒：${by[i]}`, c.err); }
  ok(!S.glim.law && st(S, 'wit_dawn') === 'open', '全部按序通关：黎明开放');
}

console.log('— 知性之境：4 队同时分头打（惩罚强度 ×1）');
{
  const d = enterT(S, 0, 'wit_dawn'), ni = enterT(S, 1, 'wit_night'), ph = enterT(S, 2, 'wit_phantom'), dy = enterT(S, 3, 'wit_day');
  ok([d, ni, ph, dy].every(x => !x.err), '黎明 / 夜 / 幻影 / 昼 四队各一张', [d, ni, ph, dy].map(x => x.err));
  const o = tick(S, sec(30)), b = o.fx.find(f => f.kind === 'buff' && f.p.id === 'night_haniel');
  ok(b && b.p.p.atk === 0.1 && b.p.p.def === 0.1, '30 秒：哈妮尔攻防 +10%（4 队满强度，两人版是 5%）', b && b.p);
  const sameTeam = enterT(S, 1, 'wit_night');
  ok(sameTeam.err && sameTeam.err.code, 'solo 节点：同一张图不能同时进两队', sameTeam.err);
  evr(S, TM(S, 1)[0], ni.ack.run, 'down', null, sec(5)); evr(S, TM(S, 1)[0], ni.ack.run, 'clear');
  evr(S, TM(S, 2)[0], ph.ack.run, 'down', null, sec(5)); evr(S, TM(S, 2)[0], ph.ack.run, 'clear');
  evr(S, TM(S, 3)[0], dy.ack.run, 'down', null, sec(5)); evr(S, TM(S, 3)[0], dy.ack.run, 'clear');
  evr(S, TM(S, 0)[0], d.ack.run, 'down', null, sec(20)); const c = evr(S, TM(S, 0)[0], d.ack.run, 'clear');
  ok(!c.err && st(S, 'wit_dawn') === 'cleared', '黎明通关', c.err);
}

console.log('— 苦难之境：倒计时节点由不同队分担');
{
  ok(['pain_mem', 'pain_mem2', 'pain_mirror', 'pain_mirror2'].every(id => st(S, id) === 'open') && S.nodes.pain_mirror.timer === S.nodes.pain_mirror2.timer && S.nodes.pain_mirror.timer > 0, '两面痛苦之镜同时 5 分钟倒计时');
  const m1 = enterT(S, 0, 'pain_mirror'), m2 = enterT(S, 1, 'pain_mirror2'), a = enterT(S, 2, 'pain_mem'), b = enterT(S, 3, 'pain_mem2');
  ok([m1, m2, a, b].every(x => !x.err), '4 队各占一张：2 队压镜子、2 队打记忆', [m1, m2, a, b].map(x => x.err));
  for (const [i, x] of [[0, m1], [1, m2], [2, a], [3, b]]) { evr(S, TM(S, i)[0], x.ack.run, 'down', null, sec(22)); const c = evr(S, TM(S, i)[0], x.ack.run, 'clear'); ok(!c.err, `队 ${i + 1} 通关`, c.err); }
  ok(st(S, 'pain_mirror') === 'cool' && st(S, 'pain_mirror2') === 'cool' && S.nodes.pain_mirror.timer === 0, '两面镜子都压住：倒计时暂停');
  ok(st(S, 'gate_l') === 'open' && st(S, 'gate_r') === 'open', '无形之门开放');
  ok(!clearT(S, 0, 'gate_l').err && !clearT(S, 1, 'gate_r').err, '两队各打一扇门');
  ok(S.st === 'rest', '阻截战完成 → 等待室', S.st);
}

console.log('— 讨伐战：真理之棺三队共用一条血、倒计时节点分担');
{
  tick(S, sec(301)); if (S.st === 'rest') { S.flip.state = 'closed'; tick(S, sec(1)); }
  ok(S.phase === 1 && S.st === 'routes', '进入讨伐战', [S.phase, S.st]);
  for (const id of ['sub_a', 'sub_b', 'sub_c', 'sub_d']) ok(!clearT(S, 0, id).err, `无欲之棺 ${id}`);
  ok(!clearT(S, 0, 'con_hall').err && !clearT(S, 1, 'con_hall2').err, '意识之棺 ×2');
  const ents = [0, 1, 2].map(i => enterT(S, i, ['truth_a', 'truth_b', 'truth_c'][i]));
  ok(ents.every(x => !x.err), '3 个队分别进 3 个真理之棺', ents.map(x => x.err));
  ok(S.pools.truth.until > 0 && S.pools.truth.until - T <= sec(480) && S.pools.truth.until - T > sec(470), '共享血量 8 分钟（官方，不再 ×2）', (S.pools.truth.until - T) / 1000);
  const forms = ents.map(x => R.view(S) && x.fx.find(f => f.kind === 'entered').p.form);
  ok(new Set(forms).size === 3, '三个队三个不同形态', forms);
  const lead = i => TM(S, i)[0];
  evr(S, lead(0), ents[0].ack.run, 'boss', null, sec(3));
  ok(['deny', 'suppress', 'forget'].every(id => st(S, id) === 'open'), '遇到希洛克：否定 / 压抑 / 忘却开放');
  const dn = enterT(S, 3, 'deny');
  ok(!dn.err, '第 4 队去压否定（倒计时节点分担）', dn.err);
  evr(S, lead(0), ents[0].ack.run, 'hp', 0.9, sec(5)); evr(S, lead(1), ents[1].ack.run, 'hp', 0.8, sec(5)); const o = evr(S, lead(2), ents[2].ack.run, 'hp', 0.7, sec(5));
  ok(Math.abs(S.pools.truth.hp - 0.7) < 1e-6 && Object.keys(S.pools.truth.by).length === 3, '三队各打一刀：共享血量 70%（各队各自掉 10%），按队伍记录', S.pools.truth);
  ok(o.fx.filter(f => f.kind === 'pool').length >= 2, '血量差值推给另外几队');
}

console.log(fail ? `✗ ${fail}/${n} 项失败` : `全部通过（${n} 项）`); process.exit(fail ? 1 : 0);
