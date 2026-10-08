// 无形之希洛克团本的官方规则（纯规则核心，不开浏览器、不连服务端）：破坏之门共享时限、知性之境跨图惩罚（噩梦之夜叠层 / 幻影之界 / 归还之昼）、
//   黎明失败踢人、痛苦之镜重置、无形之门各打各的 + 幻影之城叠伤、第 2 界扭曲（只在领主房生效）、真理之棺共享血量 / 退回 / 旋转 / 共鸣合并 / 阴影之棺 / 否定重置 / 时限失败
// 用法：node test/raid_siroco_rules.mjs
import fs from 'fs'; import vm from 'vm';

const src = fs.readFileSync(new URL('../src/game/raid_core.js', import.meta.url), 'utf8') + '\nthis.RAID_CORE = RAID_CORE;';
const ctx = {}; vm.runInNewContext(src, ctx); const R = ctx.RAID_CORE;
let fail = 0, n = 0;
const ok = (v, m, x) => { n++; console.log(v ? '  ✓' : '  ✗', m, v ? '' : JSON.stringify(x ?? '').slice(0, 400)); if (!v) fail++; };
const sec = s => s * 1000;
let T = 0;
const E = (S, uid, ev, dt = 0) => { T += dt; return R.event(S, { uid, ...ev }, T); };
const tick = (S, dt) => { T += dt; return R.tick(S, T); };
const fxOf = (o, kind, uid) => o.fx.filter(f => f.kind === kind && (uid == null || f.to === 'all' || (Array.isArray(f.to) && f.to.includes(uid))));
const st = (S, id) => S.nodes[id].st;
const Q = {};
const enter = (S, uid, node, w) => { const o = E(S, uid, { t: 'enter', node, with: w }); return o; };
const ev = (S, uid, run, t, v, dt = 0) => { Q[run] = (Q[run] || 0) + 1; return E(S, uid, { t, run, q: Q[run] * 10 + uid, v }, dt); };
// 一个人通关一个节点：进 → 25 秒后报倒下 → 通关
function clear(S, uid, node, dt = 25) {
  const e = enter(S, uid, node); if (e.err) return e;
  const run = e.ack.run, d = ev(S, uid, run, 'down', null, sec(dt));
  if (d.err) return d;
  const c = ev(S, uid, run, 'clear'); c.run = run; c.fx = d.fx.concat(c.fx); return c;
}
const members = [{ uid: 1, cid: 'a', name: '甲' }, { uid: 2, cid: 'b', name: '乙' }];
function begin(mode = 'normal') {
  T = 1000;
  const S = R.init('siroco', members, mode, T, { sid: 'rules', seed: 11 });
  E(S, 2, { t: 'ready', on: true });
  const o = E(S, 1, { t: 'start' });
  if (o.err) throw new Error(JSON.stringify(o.err));
  return S;
}
const byOrder = S => ['law_a', 'law_b', 'law_c', 'law_d'].sort((a, b) => S.nodes[a].order - S.nodes[b].order);

console.log('— 节点图');
{
  const G = R.graph('siroco', 'normal'), Gg = R.graph('siroco', 'guide');
  ok(Object.keys(G.phases[0].nodes).length === 16 && Object.keys(G.phases[1].nodes).length === 15, '普通：阻截战 16 个节点、讨伐战 15 个节点（官方全图）', [Object.keys(G.phases[0].nodes).length, Object.keys(G.phases[1].nodes).length]);
  ok(Object.keys(Gg.phases[0].nodes).join() === 'law_a,wit_dawn,pain_mem,gate_l' && Object.keys(Gg.phases[1].nodes).join() === 'sub_a,con_hall,coffin', '引导：每层一张图', Object.keys(Gg.phases[0].nodes));
  ok(Gg.phases[1].nodes.coffin.need.join() === 'con_hall' && !Gg.phases[1].nodes.coffin.manual && !Gg.phases[1].nodes.coffin.pool, '引导的最终战是普通的意识之棺（不用合并）');
  ok(!Gg.phases[1].rot && G.phases[1].rot.forms.length === 3, '旋转只在普通图里');
}

console.log('— 法则之境：破坏之门共享 10 分钟（两人 ×2）');
let S = begin();
{
  ok(['law_a', 'law_b', 'law_c', 'law_d'].every(id => st(S, id) === 'open') && st(S, 'wit_dawn') === 'locked', '开局 4 扇破坏之门开放');
  const [a] = byOrder(S);
  const e = enter(S, 1, a);
  ok(S.glim.law && S.glim.law.until === T + sec(600), '第一次有人进门开始共享计时', S.glim);
  const before = byOrder(S).map(id => S.nodes[id].order).join();
  const o = tick(S, sec(601));
  ok(fxOf(o, 'closed', 1).some(f => f.p.why === 'reset') && S.members[0].at === 'camp', '到点：门里的人被送回营地', o.fx);
  ok(fxOf(o, 'reset').length === 1 && !S.glim.law && S.stats.penalties === 1, '整组重置、重新分配顺序', S.stats);
  ok(['law_a', 'law_b', 'law_c', 'law_d'].every(id => st(S, id) === 'open'), '4 扇门重新开放');
  void before; void e;
  for (const id of byOrder(S)) { const c = clear(S, id === byOrder(S)[0] ? 1 : 2, id); ok(!c.err, `按顺序打倒 ${id}`, c.err); }
  ok(!S.glim.law, '全部通关后共享计时结束');
  ok(st(S, 'wit_dawn') === 'open' && ['wit_night', 'wit_phantom', 'wit_day'].every(id => st(S, id) === 'locked'), '黎明开放；夜 / 幻影 / 昼要等有人进了黎明');
}

console.log('— 知性之境：进黎明打开另外 3 张，未通关的图每 30 秒给别的图叠惩罚');
let dawn;
{
  const T0 = T;
  dawn = enter(S, 1, 'wit_dawn').ack.run;
  ok(['wit_night', 'wit_phantom', 'wit_day'].every(id => st(S, id) === 'open'), '进了黎明：另外 3 张开放');
  ok(S.runs[dawn].limit === T0 + sec(420), '黎明单次限时 7 分钟');
  const night = enter(S, 2, 'wit_night').ack.run;
  let o = tick(S, sec(30));
  const b1 = fxOf(o, 'buff', 1).find(f => f.p.id === 'night_haniel');
  ok(b1 && b1.p.n === 1 && b1.p.p.atk === 0.05 && b1.p.p.def === 0.05, '30 秒：哈妮尔攻防 +10% × 两人系数 0.5', o.fx.map(f => f.kind + ':' + (f.p && f.p.id)));
  ok(fxOf(o, 'buff', 1).some(f => f.p.id === 'phantom_adds') && fxOf(o, 'buff', 1).some(f => f.p.id === 'day_genbu'), '同时：幻影之界给黎明加幻影、归还之昼召唤玄武');
  ok(fxOf(o, 'buff', 2).some(f => f.p.id === 'phantom_whirl'), '噩梦之夜里出现黑色旋风（幻影之界没通关）');
  o = tick(S, sec(300));
  ok(S.buffs.find(b => b.id === 'night_haniel').n === 10 && S.buffs.find(b => b.id === 'night_haniel').p.atk === 0.5, '叠到 10 层封顶', S.buffs.find(b => b.id === 'night_haniel'));
  ok(R.view(S).aura.wit_dawn >= 10, 'view 里能看到层数');
  o = ev(S, 2, night, 'down', null, sec(5)); ev(S, 2, night, 'clear');
  ok(st(S, 'wit_night') === 'cool' && !S.buffs.some(b => b.id === 'night_haniel'), '噩梦之夜通关：哈妮尔的叠层立刻消失', S.buffs.map(b => b.id));
  // 幻影之界通关：黎明 +100%，不重生
  const ph = clear(S, 2, 'wit_phantom', 21);
  ok(!ph.err && st(S, 'wit_phantom') === 'cool' && S.nodes.wit_phantom.until === 0, '幻影之界通关后不重生', S.nodes.wit_phantom);
  ok(S.buffs.some(b => b.id === 'phantom_bless' && b.node === 'wit_dawn' && b.until === 0 && b.p.dmgTaken === 2), '黎明伤害 +100%（持续到黎明结束）');
  ok(!S.buffs.some(b => b.id === 'phantom_adds'), '幻影之界的惩罚撤掉了');
  const day = enter(S, 2, 'wit_day').ack.run;
  o = tick(S, Math.max(0, S.runs[dawn].limit - T) + 1);
  ok(fxOf(o, 'closed', 1).some(f => f.p.why === 'limit'), '黎明 7 分钟到：送回营地', o.fx.filter(f => f.kind === 'closed'));
  ok(fxOf(o, 'closed', 2).some(f => f.p.why === 'kick') && S.runs[day].end === 'kick', '黎明失败：归还之昼里的人也被踢回营地');
  ok(st(S, 'wit_phantom') === 'open' && !S.buffs.some(b => b.id === 'phantom_bless'), '幻影之界的进度和效果清零（要重打）');
  const d2 = clear(S, 1, 'wit_dawn');
  ok(!d2.err && st(S, 'wit_dawn') === 'cleared', '再打黎明并通关');
  ok(['wit_night', 'wit_phantom', 'wit_day'].every(id => st(S, id) === 'off'), '黎明通关后另外 3 张关闭');
  ok(['pain_mem', 'pain_mem2', 'pain_mirror', 'pain_mirror2'].every(id => st(S, id) === 'open') && S.nodes.pain_mirror.timer === T + sec(300), '苦难之境开放，痛苦之镜开始 5 分钟倒计时');
}

console.log('— 苦难之境：痛苦之镜到 0 = 重置当前层');
{
  const m = enter(S, 2, 'pain_mem').ack.run;
  const o = tick(S, sec(301));
  ok(fxOf(o, 'closed', 2).some(f => f.p.why === 'reset') && S.runs[m].end === 'reset', '镜子到点：记忆的碎片里的人被送回营地（不算侵蚀）');
  ok(fxOf(o, 'reset').some(f => f.p.area === 3) && st(S, 'pain_mem') === 'open', '苦难之境Ⅰ 进度重置（重新开放）');
  // 压镜子：通关后修复 90 秒、倒计时暂停；另一面照常
  ok(!clear(S, 2, 'pain_mirror').err && st(S, 'pain_mirror') === 'cool' && S.nodes.pain_mirror.timer === 0, '通关痛苦之镜：修复中，暂停倒计时');
  ok(!clear(S, 2, 'pain_mirror2').err, '另一面也压住');
  ok(!clear(S, 1, 'pain_mem').err && !clear(S, 2, 'pain_mem2').err, '记忆的碎片 / 碎片的记忆通关');
  ok(st(S, 'gate_l') === 'open' && st(S, 'gate_r') === 'open' && st(S, 'castle_l') === 'locked', '无形之门开放；幻影之城要等门的队伍到领主房');
}

console.log('— 苦难之境Ⅱ：无形之门 + 幻影之城');
{
  const g = enter(S, 1, 'gate_l').ack.run;
  ev(S, 1, g, 'boss', null, sec(5));
  ok(st(S, 'castle_l') === 'open' && st(S, 'castle_r') === 'locked', '门 1 到领主房：幻影之城开放（城之幻影不开）');
  let c = clear(S, 2, 'castle_l', 21);
  ok(!c.err && fxOf(c, 'buff', 1).some(f => f.p.id === 'castle_l' && f.p.p.dmgTaken === 1.8 && f.p.n === 1), '幻影之城通关：门 1 伤害 +80%', c.fx);
  tick(S, sec(11));
  c = clear(S, 2, 'castle_l', 21);
  ok(!c.err && S.buffs.find(b => b.id === 'castle_l').p.dmgTaken === 2.1, '60 秒内再通关：叠到 +110%', S.buffs);
  tick(S, sec(11));
  const cs = enter(S, 2, 'castle_l').ack.run;
  const f = ev(S, 1, g, 'fail', 'retreat', sec(2));
  ok(fxOf(f, 'closed', 2).some(x => x.p.why === 'kick') && S.runs[cs].end === 'kick', '门 1 的队伍撤退：幻影之城里的人被踢回营地');
  ok(st(S, 'castle_l') === 'locked' && !S.buffs.some(b => b.id === 'castle_l'), '幻影之城重新上锁、叠伤清零');
  tick(S, sec(61));   // 撤退的侵蚀
  c = clear(S, 1, 'gate_l');
  ok(!c.err && st(S, 'gate_l') === 'cleared' && st(S, 'castle_l') === 'off', '门 1 单独通关（不用等门 2）', c.err);
  // 镜子在第Ⅱ层到点：重置门（最靠后开放的一层）
  const g2 = enter(S, 2, 'gate_r').ack.run;
  const o = tick(S, Math.min(...['pain_mirror', 'pain_mirror2'].map(id => S.nodes[id].timer || Infinity)) - T + 1);
  ok(S.runs[g2].end === 'reset' && fxOf(o, 'reset').some(x => x.p.area === 4) && st(S, 'gate_l') === 'open' && st(S, 'pain_mem') === 'cleared', '镜子在苦难之境Ⅱ到点：只重置第Ⅱ层（门 1 也要重打）', o.fx.filter(x => x.kind === 'reset'));
  for (const id of ['pain_mirror', 'pain_mirror2']) if (st(S, id) === 'open') ok(!clear(S, 2, id).err, '先把镜子压住（修复 90 秒内打门）');
  const c1 = clear(S, 1, 'gate_l'), c2 = clear(S, 2, 'gate_r');
  ok(!c1.err && !c2.err, '两扇门都通关', [c1.err, c2.err]);
  ok(S.st === 'rest', '阻截战完成 → 休整', S.st);
}

console.log('— 讨伐战：第 3 / 2 界');
{
  S.flip.state = 'closed';
  tick(S, sec(301));
  ok(S.st === 'routes' && S.phase === 1, '讨伐战开始', S.st);
  for (const id of ['sub_a', 'sub_b', 'sub_c', 'sub_d']) ok(!clear(S, 1, id).err, `${id} 通关`);
  ok(['con_hall', 'con_hall2', 'con_mut', 'con_mut2'].every(id => st(S, id) === 'open'), '第 2 界开放');
  const h = enter(S, 1, 'con_hall').ack.run;
  let c = clear(S, 2, 'con_mut');
  ok(!c.err && !S.buffs.some(b => b.id === 'con_weak') && fxOf(c, 'note').some(f => /还没到领主房/.test(f.p.text)), '意识之棺的队伍还没到领主房：扭曲没有效果');
  ev(S, 1, h, 'boss', null, sec(1));
  tick(S, sec(91));
  c = clear(S, 2, 'con_mut');
  ok(fxOf(c, 'groggy', 1).some(f => f.p.id === 'con_weak' && f.p.dur === 10), '到领主房以后：希洛克虚弱 10 秒', c.fx.map(f => f.kind));
  ev(S, 1, h, 'down', null, sec(20)); ev(S, 1, h, 'clear');
  ok(!clear(S, 2, 'con_hall2').err && ['truth_a', 'truth_b', 'truth_c'].every(id => st(S, id) === 'open'), '第 1 界：3 个真理的意识之棺开放');
  ok(['deny', 'suppress', 'forget', 'coffin'].every(id => st(S, id) === 'locked'), '否定 / 压抑 / 忘却要等有人遇到希洛克');
}

console.log('— 第 1 界：共享血量、旋转、共鸣合并');
let save;
{
  const P = R.graph('siroco', 'normal').phases[1];
  const e = enter(S, 1, 'truth_a'), a = e.ack.run, en = fxOf(e, 'entered', 1)[0].p;
  ok(en.dg === P.rot.dgs[S.rot] && en.form === P.rot.forms[S.rot], '真理之棺 1 按当前旋转进对应形态', en);
  ok(S.pools.truth.until === T + sec(960), '共享血量开始计时 16 分钟（官方 8 分钟 ×2）');
  ev(S, 1, a, 'boss', null, sec(3));
  ok(['deny', 'suppress', 'forget'].every(id => st(S, id) === 'open') && S.nodes.deny.timer === T + sec(300), '遇到希洛克：否定（5 分钟）/ 压抑 / 忘却开放');
  ev(S, 1, a, 'hp', 0.8, sec(5));
  ok(Math.abs(S.pools.truth.hp - 0.8) < 1e-9, '共享血量跟着掉', S.pools);
  const b = enter(S, 2, 'truth_b'), br = b.ack.run;
  ok(fxOf(b, 'entered', 2)[0].p.hpStart === 0.8, '另一边进来时血量是共享的 80%');
  const o = ev(S, 2, br, 'hp', 0.7, sec(5));
  ok(fxOf(o, 'pool', 1).some(f => Math.abs(f.p.d + 0.1) < 1e-9), '乙打掉的 10% 同步给甲那边', o.fx);
  const r = ev(S, 2, br, 'fail', 'retreat', sec(1));
  ok(Math.abs(S.pools.truth.hp - 0.8) < 1e-9 && fxOf(r, 'pool', 1).some(f => Math.abs(f.p.d - 0.1) < 1e-9), '乙撤退：这次的伤害退回（官方：退出 = 伤害无效）', S.pools);
  save = JSON.parse(JSON.stringify(S));
  tick(S, sec(61));   // 撤退的侵蚀
  const rot0 = S.rot;
  const s1 = clear(S, 2, 'suppress');
  ok(S.rot === (rot0 + 1) % 3 && fxOf(s1, 'rotate').length === 1, '压抑通关：顺时针旋转一格', [rot0, S.rot]);
  while (S.rot !== P.rot.resonance) { tick(S, sec(31)); ok(!clear(S, 2, 'suppress').err, '再压一次'); }
  if (S.rot === P.rot.resonance) {
    // 先演示没共鸣：转过头再转回来太长，这里直接改状态验证 miss 分支
    const C = JSON.parse(JSON.stringify(S)); C.rot = (P.rot.resonance + 1) % 3;
    const m = clear(C, 2, 'forget');
    ok(!m.err && C.buffs.filter(x => x.id === 'luxi_miss').length === 3 && st(C, 'coffin') === 'locked', '没共鸣：卢克西逃走，真理之棺受伤 +30%（30 秒），不合并');
  }
  const fg = clear(S, 2, 'forget');
  ok(!fg.err && fxOf(fg, 'closed', 1).some(f => f.p.why === 'merge') && S.runs[a].end === 'merge', '共鸣时通关忘却：真理之棺里的人被收进合并', fg.err || fg.fx.map(f => f.kind));
  ok(st(S, 'coffin') === 'open' && S.nodes.coffin.until === T + sec(60) && S.st === 'final', '阴影之棺开 60 秒');
  ok(Math.abs(S.pools.truth.hp - 0.8) < 1e-9, '合并不退伤害');
  const bad = enter(S, 1, 'coffin');
  ok(bad.err && bad.err.code === 'together', '阴影之棺要一起进');
  const cf = enter(S, 1, 'coffin', [2]), cr = cf.ack.run, ce = fxOf(cf, 'entered', 2)[0].p;
  ok(ce.buffs.some(x => x.id === 'shadow_weak' && x.p.weak === 1) && ce.hpStart === 0.8, '进去立刻虚弱 30 秒，血量接着共享的 80%', ce);
  ev(S, 1, cr, 'hp', 0.5, sec(10));
  const lim = tick(S, sec(24));
  ok(fxOf(lim, 'closed', 2).some(f => f.p.why === 'limit') && S.members.every(m => m.ero > T), '33 秒到：全员送回营地并侵蚀', lim.fx.filter(f => f.kind === 'closed'));
  ok(st(S, 'coffin') === 'locked' && st(S, 'forget') === 'open' && S.st === 'routes', '阴影之棺关闭，忘却立刻重新开放');
  ok(Math.abs(S.pools.truth.hp - 0.5) < 1e-9, '阴影之棺里打掉的血算进共享血量（时间到不退）', S.pools);
  // 再合并一次，这次打空
  S.nodes.deny.timer = T + sec(600);   // 测试捷径：假设这段时间有人压着否定（否定到点的重置在下面单独测）
  tick(S, sec(151));   // 侵蚀 150 秒
  const dn = clear(S, 2, 'deny');
  ok(!dn.err && st(S, 'deny') === 'cool' && S.nodes.deny.timer === 0, '压住否定：修复中，倒计时暂停', [dn.err, S.nodes.deny, T]);
  const fg2 = clear(S, 2, 'forget');
  ok(!fg2.err && st(S, 'coffin') === 'open', '再次共鸣合并', fg2.err);
  const cf2 = enter(S, 1, 'coffin', [2]), cr2 = cf2.ack.run;
  const cheat = ev(S, 1, cr2, 'hp', 0, sec(5));
  ok(Math.abs(S.pools.truth.hp - 0.25) < 1e-6 && fxOf(cheat, 'pool', 1).some(f => f.p.d > 0), '防作弊：5 秒打掉 50% 被按掉血速度封顶（5%/秒），多报的血补回给客户端', S.pools);
  const end = ev(S, 1, cr2, 'hp', 0, sec(10));
  ok(['truth_a', 'truth_b', 'truth_c', 'coffin'].every(id => st(S, id) === 'cleared') && S.st === 'cleared', '共享血量打空：讨伐完成、团本通关', [S.st, end.err]);
}

console.log('— 否定到点 / 共享血量超时');
{
  const S2 = JSON.parse(JSON.stringify(save));
  const t0 = S2.nodes.deny.timer; T = t0 - 1000;
  const a = Object.values(S2.runs).find(x => !x.end && x.node === 'truth_a');
  const o = tick(S2, 2000);
  ok(fxOf(o, 'reset').some(f => f.p.area === 3) && S2.runs[a.id].end === 'reset' && S2.pools.truth.hp === 1, '否定没压住：第 1 界初始化、共享血量回满', o.fx.filter(f => f.kind === 'reset'));
  ok(['suppress', 'forget'].every(id => st(S2, id) === 'locked') && st(S2, 'truth_a') === 'open', '否定 / 压抑 / 忘却要重新遇到希洛克才开');
  const S3 = JSON.parse(JSON.stringify(save)); T = S3.pools.truth.until + 1; S3.nodes.deny.timer = T + sec(100);   // 否定一直压着
  tick(S3, 0);
  ok(S3.st === 'failed' && S3.why === 'pool', '共享血量 16 分钟没打空：攻坚失败', [S3.st, S3.why]);
}

console.log('— 引导模式没有跨图惩罚');
{
  const G = begin('guide');
  ok(!G.glim.law && G.nodes.law_a.st === 'open', '引导开局');
  const c = clear(G, 1, 'law_a');
  ok(!c.err && !G.glim.law && st(G, 'wit_dawn') === 'open', '引导没有共享时限');
}

console.log(fail ? `✗ ${fail}/${n} 项失败` : `全部通过（${n} 项）`); process.exit(fail ? 1 : 0);
