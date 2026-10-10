// 安徒恩攻坚战规则测试（纯规则核心，不开浏览器）：节点图 / 引导削弱 / 震颤倒计时回退 / 精英解锁孵化所 / 擎天之柱 ×2 / 火山 → 心脏 → 通关 / 奖励表 / 服务端同款 vm 加载
// 用法：node test/anton_rules.mjs
import fs from 'fs'; import vm from 'vm';

const rd = f => fs.readFileSync(new URL('../src/game/' + f, import.meta.url), 'utf8');
const ctx = {}; vm.runInNewContext(rd('raid_core.js') + '\n;\n' + rd('raid_anton.js') + '\nthis.RAID_CORE = RAID_CORE; this.RAID_DEFS = RAID_DEFS;', ctx);
const R = ctx.RAID_CORE, DEFS = ctx.RAID_DEFS;
let fail = 0, n = 0;
const ok = (v, m, x) => { n++; console.log(v ? '  ✓' : '  ✗', m, v ? '' : JSON.stringify(x ?? '').slice(0, 400)); if (!v) fail++; };
const sec = s => s * 1000;
let T = 0;
const E = (S, uid, ev, dt = 0) => { T += dt; return R.event(S, { uid, ...ev }, T); };
const tick = (S, dt) => { T += dt; return R.tick(S, T); };
const st = (S, id) => S.nodes[id].st;
const Q = {};
const enter = (S, uid, node) => E(S, uid, { t: 'enter', node });
const ev = (S, uid, run, t, v, dt = 0) => { Q[run] = (Q[run] || 0) + 1; return E(S, uid, { t, run, q: Q[run] * 10 + uid, v }, dt); };
function clear(S, uid, node, dt = 25) {
  const e = enter(S, uid, node); if (e.err) return e;
  const run = e.ack.run, d = ev(S, uid, run, 'down', null, sec(dt)); if (d.err) return d;
  const c = ev(S, uid, run, 'clear'); c.run = run; c.fx = d.fx.concat(c.fx); return c;
}
const members = [{ uid: 1, cid: 'a', name: '甲' }, { uid: 2, cid: 'b', name: '乙' }];
function begin(mode = 'normal') {
  T = 1000;
  const S = R.init('anton', members, mode, T, { sid: 'anton', seed: 7 });
  E(S, 2, { t: 'ready', on: true });
  const o = E(S, 1, { t: 'start' }); if (o.err) throw new Error(JSON.stringify(o.err));
  return S;
}
const ids = (G, p) => Object.keys(G.phases[p].nodes);

console.log('— 定义 / 节点图');
{
  const D = DEFS.anton, G = R.graph('anton', 'normal'), Gg = R.graph('anton', 'guide');
  ok(D && D.maxPlayers === 16 && D.teamSize === 4 && D.duoMax === 2 && D.minLvl === 60, '登记 RAID_DEFS.anton：16 人 / 4 队 / 两人版 / Lv60');
  ok(ids(G, 0).length === 11 && ids(G, 1).length === 12, '普通：阻截战 11 节点、焦杀战 12 节点', [ids(G, 0).length, ids(G, 1).length]);
  ok(ids(Gg, 0).join() === 'fog_a,quake_a,cannon,pillar_a1,pillar_a2' && ids(Gg, 1).join() === 'egale,hatch_1,volcano,heart_1,heart_5', '引导图：节点精简', [ids(Gg, 0), ids(Gg, 1)]);
  ok(G.phases[0].goal.join() === 'pillar_a2,pillar_b2' && G.phases[1].goal.join() === 'heart_5', '阶段目标：擎天之柱 A/B 第 2 次 / 心脏 ×5 的最后一颗');
  const need = (p, id) => G.phases[p].nodes[id].need.join();
  ok(need(0, 'quake_a') === 'fog_a,fog_b,fog_c,fog_d' && need(0, 'pillar_a2') === 'pillar_a1' && need(0, 'pillar_a1') === 'cannon' && need(1, 'volcano') === 'hatch_1,hatch_2,hatch_3,hatch_4' && need(1, 'heart_5') === 'heart_1,heart_2,heart_3,heart_4', '前置关系');
  ok(Gg.phases[1].nodes.hatch_1.need.join() === 'egale' && Gg.phases[1].nodes.heart_5.need.join() === 'heart_1' && !Gg.phases[1].nodes.heart_5.together, '引导图：孵化所 / 心脏前置被精简');
  ok(G.phases[0].nodes.quake_a.type === 'timer' && Gg.phases[0].nodes.quake_a.type === 'main', '震颤的大地：普通 = 倒计时，引导 = 普通节点');
  for (const [p, P] of D.phases.entries()) for (const [id, nd] of Object.entries(P.nodes)) ok(typeof nd.dg === 'string' && /^raid_an_/.test(nd.dg), `节点 ${id} 有 dg`, nd.dg);
  // 奖励里的物品都在命名规则内
  const picks = D.rewards.p2[1].table[1][1].pick;
  ok(picks.length === 12 && picks.every(k => /^raid_an_(gluttony|primeval|mana)_[1-4]$/.test(k)) && D.rewards.cur === 'raid_magic_ore', '奖励：魔能矿 + 12 个融合装备 key', picks);
}

console.log('— P1：黑雾之源 → 震颤 / 舰炮 → 擎天之柱');
{
  const S = begin();
  ok(S.phase === 0 && ['fog_a', 'fog_b', 'fog_c', 'fog_d'].every(id => st(S, id) === 'open') && st(S, 'quake_a') === 'locked' && st(S, 'cannon') === 'locked', '开局：4 个黑雾之源开放，其余上锁');
  // 精英：吞噬魔击杀给全团增益，一次一回
  const e1 = enter(S, 1, 'fog_a'), r1 = e1.ack.run;
  let o = ev(S, 1, r1, 'elite', 'devour');
  ok(!o.err && S.gbuffs.some(b => b.id === 'devour_1' && b.p.atk === 0.04), '吞噬魔击杀：全团攻击增益', S.gbuffs);
  ok(ev(S, 1, r1, 'elite', 'devour').ack?.dup === true, '同一只精英不重复生效');
  ok(ev(S, 1, r1, 'elite', 'nope').err, '未登记的精英被拒绝');
  ev(S, 1, r1, 'down', null, sec(25)); ev(S, 1, r1, 'clear');
  for (const id of ['fog_b', 'fog_c']) ok(!clear(S, 2, id).err, id + ' 通关');
  ok(st(S, 'quake_a') === 'locked', '还差一个黑雾之源：震颤仍上锁');
  ok(!clear(S, 1, 'fog_d').err, 'fog_d 通关');
  ok(['quake_a', 'quake_b', 'cannon'].every(id => st(S, id) === 'open') && S.nodes.quake_a.timer > 0 && S.nodes.quake_b.timer > 0, '4 个黑雾之源通关：震颤 A/B（倒计时）+ 舰炮开放', ['quake_a', 'quake_b', 'cannon'].map(id => [id, st(S, id), S.nodes[id].timer]));
  // 舰炮通关：擎天之柱开
  ok(!clear(S, 1, 'cannon').err && st(S, 'pillar_a1') === 'open' && st(S, 'pillar_b1') === 'open' && st(S, 'pillar_a2') === 'locked', '舰炮防御通关：擎天之柱 A-1 / B-1 开放，第 2 次要等第 1 次');
  // 震颤到点：回退第 2 层（舰炮重开，擎天之柱回锁），时间不退
  const before = S.deadline;
  const m = enter(S, 2, 'pillar_a1').ack.run;
  o = tick(S, sec(361));
  ok(o.fx.some(f => f.kind === 'reset') && st(S, 'cannon') === 'cleared' && st(S, 'pillar_a1') === 'open' && S.runs[m].end === 'reset' && S.deadline === before, '震颤到 0：擎天之柱进度回退（最靠后已开放的一层）、擎天之柱退回（里面的人送回营地）、阶段时间不退', { cannon: st(S, 'cannon'), pa: st(S, 'pillar_a1'), end: S.runs[m].end });
  // 重来：压住震颤（通关暂停计时）
  ok(!clear(S, 1, 'quake_a').err && st(S, 'quake_a') === 'cool' && S.nodes.quake_a.timer === 0, '通关震颤 A：修复中、倒计时暂停');
  ok(!clear(S, 2, 'quake_b').err, '震颤 B 也压住');
  for (const id of ['pillar_a1', 'pillar_b1']) ok(!clear(S, 1, id).err, id);
  ok(st(S, 'pillar_a2') === 'open' && st(S, 'pillar_b2') === 'open' && S.phase === 0, '各通关 1 次：第 2 次开放，阶段未完成');
  ok(!clear(S, 1, 'pillar_a2').err && S.phase === 0, 'A-2 通关：还差 B-2');
  ok(!clear(S, 2, 'pillar_b2').err, 'B-2 通关');
  ok(S.st === 'rest', '阻截战完成 → 休整', { phase: S.phase, st: S.st });
}

console.log('— P2：能量阻截 → 孵化所 → 火山 → 心脏');
{
  const S = begin();
  // 快速打完 P1
  const seq = ['fog_a', 'fog_b', 'fog_c', 'fog_d', 'cannon', 'pillar_a1', 'pillar_b1', 'pillar_a2', 'pillar_b2'];
  for (const id of seq) { const c = clear(S, 1, id); if (c.err) throw new Error(id + JSON.stringify(c.err)); }
  ok(S.st === 'rest', 'P1 打完进入休整', S.st);
  S.flip.state = 'closed'; tick(S, sec(301));
  ok(S.phase === 1 && S.st === 'routes', '进入焦杀战', { phase: S.phase, st: S.st });
  ok(st(S, 'egale') === 'open' && ['hatch_1', 'hatch_2', 'hatch_3', 'hatch_4', 'infect'].every(id => st(S, id) === 'locked'), '能量阻截战开放；孵化所 / 感染孵化场上锁', ['hatch_1', 'infect'].map(id => st(S, id)));
  const r = enter(S, 1, 'egale').ack.run;
  const o = ev(S, 1, r, 'elite', 'egale');
  ok(!o.err && ['hatch_1', 'hatch_2', 'hatch_3', 'hatch_4', 'infect'].every(id => st(S, id) === 'open'), '杀吞噬之厄伽勒：四个孵化所 + 紫色感染孵化场开放', ['hatch_1', 'infect'].map(id => st(S, id)));
  ev(S, 1, r, 'down', null, sec(25)); ev(S, 1, r, 'clear');
  ok(st(S, 'volcano') === 'locked', '孵化所没清完：火山上锁');
  for (const id of ['hatch_1', 'hatch_2', 'hatch_3']) ok(!clear(S, 1, id).err, id);
  ok(st(S, 'volcano') === 'locked', '还差 1 个孵化所');
  ok(!clear(S, 2, 'hatch_4').err && st(S, 'volcano') === 'open', '四个孵化所清完：黑色火山开放');
  // 感染孵化场没清：有人在火山里打时，每 30 秒叠一层护盾（最多 6 层）
  const vr = enter(S, 1, 'volcano').ack.run;
  tick(S, sec(31));
  const sh = S.buffs.find(b => b.id === 'infect_shield');
  ok(sh && sh.node === 'volcano' && sh.n >= 1 && sh.p.def > 0, '感染孵化场未清除：火山护盾叠层', S.buffs);
  tick(S, sec(300));
  ok(S.buffs.find(b => b.id === 'infect_shield').n === 6, '护盾最多 6 层');
  ok(!clear(S, 2, 'infect').err && !S.buffs.some(b => b.id === 'infect_shield'), '清除感染孵化场：火山护盾撤掉', S.buffs.map(b => b.id));
  ev(S, 1, vr, 'down', null, sec(25)); const vc = ev(S, 1, vr, 'clear');
  ok(!vc.err && ['heart_1', 'heart_2', 'heart_3', 'heart_4'].every(id => st(S, id) === 'open') && st(S, 'heart_5') === 'locked', '火山通关：4 颗心脏开放，最后一颗要等', vc.err);
  for (const id of ['heart_1', 'heart_2', 'heart_3']) ok(!clear(S, 1, id).err, id);
  ok(st(S, 'heart_5') === 'locked', '差 1 颗：核心上锁');
  ok(!clear(S, 2, 'heart_4').err && st(S, 'heart_5') === 'open', '4 颗清完：安徒恩的心脏开放');
  const fe = E(S, 1, { t: 'enter', node: 'heart_5', with: [2] }), fr = fe.ack && fe.ack.run;
  ev(S, 1, fr, 'down', null, sec(30)); const f = ev(S, 1, fr, 'clear');
  ok(S.st === 'cleared', '摧毁安徒恩的心脏：团本通关', { st: S.st, err: f.err });
}

console.log('— 引导模式');
{
  const S = begin('guide');
  ok(S.graph === 'guide' && st(S, 'fog_a') === 'open' && !S.nodes.fog_b, '引导图只有一个黑雾之源');
  for (const id of ['fog_a', 'quake_a', 'cannon', 'pillar_a1', 'pillar_a2']) { const c = clear(S, 1, id); ok(!c.err, '引导：' + id, c.err); }
  const sc = R.scale(S, 'fog_a', 1) || R.scale(S, 'fog_a');
  ok(sc && (sc.mech === 0.6 || (sc.mech < 1)), '引导：机制强度 ×0.6（机制球 4→2 / 电球减半的依据）', sc);
}

console.log('— 服务端同款加载（raid_core + raid_anton，空 vm 上下文）');
{
  const c2 = vm.createContext({}), core = vm.runInContext('"use strict";\n' + rd('raid_core.js') + '\n;\n' + rd('raid_anton.js') + '\n;RAID_CORE', c2);
  ok(core.graph('anton', 'normal') && core.limits, '严格模式下加载不报错，能取到 anton 节点图');
}

console.log(fail ? `✗ ${fail} / ${n} 项失败` : `全部通过（${n} 项）`); process.exit(fail ? 1 : 0);
