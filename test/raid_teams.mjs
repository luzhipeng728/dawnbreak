// 团本多队模型规则单测（不开浏览器）：人数档位、分队、按队数缩放、solo / 带队进图、补位、
// 通用节点类型（功能图 / 钥匙图 / 倒计时 / 精英击杀 / 理智值 / 混沌等级）、可注册第二个团本
import fs from 'fs'; import vm from 'vm';

const src = fs.readFileSync(new URL('../src/game/raid_core.js', import.meta.url), 'utf8') + '\nthis.RAID_CORE = RAID_CORE; this.RAID_DEFS = RAID_DEFS;';
const ctx = {}; vm.runInNewContext(src, ctx); const R = ctx.RAID_CORE; let fail = 0;
const ok = (v, m, x) => { console.log(v ? '  ✓' : '  ✗', m, x || ''); if (!v) fail++; };
const mk = (n, party) => Array.from({ length: n }, (_, i) => ({ uid: i + 1, cid: 'c' + (i + 1), name: 'P' + (i + 1), party: party ? party(i) : undefined }));
const ev = (S, e, now) => R.event(S, e, now);
const T0 = 1e6;
// 团队版：团长建团后其余人 join，全部准备 → 开始
function lobby(raid, n, opt, party) {
  const ms = mk(n, party), S = R.init(raid, [ms[0]], 'normal', T0, Object.assign({ sid: 't' + n, seed: 11, team: true, guard: { minClear: 0, maxDrop: 0 } }, opt));
  const errs = []; for (const m of ms.slice(1)) { const o = ev(S, Object.assign({ t: 'join' }, m), T0); if (o.err) errs.push(o.err); }
  for (const m of S.members) m.ready = true;
  return { S, errs };
}

console.log('— 人数档位');
{
  const D = R.defOf('siroco');
  ok(D.maxPlayers === 16 && D.teamSize === 4 && D.maxTeams === 4 && D.minPlayers === 4, '希洛克：16 人 / 每队 4 / 4 队 / ≥4 人起开');
  const duo = R.init('siroco', mk(1), 'normal', T0, { sid: 'duo' });
  ok(duo.tier === 'duo' && R.capacity(duo) === 2, '默认两人版：上限 2');
  ev(duo, Object.assign({ t: 'join' }, mk(2)[1]), T0);
  const o3 = ev(duo, Object.assign({ t: 'join' }, mk(3)[2]), T0);
  ok(o3.err && o3.err.code === 'full' && /最多 2 人/.test(o3.err.text), '两人版第 3 人被拒：这个团本最多 2 人', o3.err);
  const g = R.init('siroco', mk(1), 'guide', T0, { sid: 'guide' });
  ok(g.tier === 'guide' && R.canStart(g, 1) === null, '引导：1 人直接能开');
  const { S, errs } = lobby('siroco', 16);
  ok(S.tier === 'team' && S.members.length === 16 && !errs.length, '多队版：16 人都能进大厅', errs);
  const o17 = ev(S, { t: 'join', uid: 17, cid: 'x', name: 'x' }, T0);
  ok(o17.err && o17.err.code === 'full', '第 17 人：满员');
  const s3 = lobby('siroco', 3).S;
  ok(R.canStart(s3, 1) && R.canStart(s3, 1).code === 'count', '多队版 3 人：人数不够 (≥4)', R.canStart(s3, 1));
}

console.log('— 分队');
{
  const { S } = lobby('siroco', 8);
  const p = R.planTeams(S);
  ok(p.ok && p.teams.length === 2 && p.teams.every(t => t.length === 4), '8 人自动分 2 队 × 4', JSON.stringify(p.teams));
  const q = lobby('siroco', 4).S, pq = R.planTeams(q);
  ok(pq.ok && pq.teams.length === 2 && pq.teams.every(t => t.length === 2), '4 人：至少 2 队（不会只有 1 队）', JSON.stringify(pq.teams));
  // 队伍（party）优先凑一队：1~4 一队、5~8 一队，9 / 10 单人
  const r = lobby('siroco', 10, {}, i => i < 4 ? 'A' : i < 8 ? 'B' : 'C' + i), pr = R.planTeams(r.S);
  const has = (ids) => pr.teams.some(t => ids.every(u => t.includes(u)));
  ok(pr.ok && has([1, 2, 3, 4]) && has([5, 6, 7, 8]), '同一个队伍的人尽量分在一队', JSON.stringify(pr.teams));
  // 团长手动分队
  const m = lobby('siroco', 6).S;
  ok(ev(m, { t: 'team', uid: 2, to: 3, team: 0 }, T0).err.code === 'leader', '队员不能分队');
  for (const u of [1, 2, 3, 4]) ev(m, { t: 'team', uid: 1, to: u, team: 1 }, T0);
  ok(ev(m, { t: 'team', uid: 1, to: 5, team: 1 }, T0).err.code === 'size', '一队最多 4 人');
  ok(ev(m, { t: 'team', uid: 1, to: 5, team: 4 }, T0).err.code === 'team', '最多 4 队');
  ev(m, { t: 'team', uid: 1, to: 5, team: 0 }, T0);
  const v0 = R.view(m);
  ok(v0.teams.length === 2 && v0.teams.find(t => t.id === 1).members.join() === '1,2,3,4' && v0.unassigned.join() === '6', '大厅视图：已分的队 + 未分配的人', JSON.stringify([v0.teams, v0.unassigned]));
  const pm = R.planTeams(m);
  ok(pm.ok && pm.teams.length === 2 && pm.teams.flat().length === 6, '手动 + 自动补齐（6 补进人少的队）', JSON.stringify(pm.teams));
  const one = lobby('siroco', 5).S; for (const u of [1, 2, 3, 4, 5]) ev(one, { t: 'team', uid: 1, to: u, team: u === 5 ? 1 : 0 }, T0);
  ok(R.planTeams(one).ok, '5 人分成 4 + 1 可以');
  const bad = lobby('siroco', 4).S; for (const u of [1, 2, 3, 4]) ev(bad, { t: 'team', uid: 1, to: u, team: 0 }, T0);
  ok(!R.planTeams(bad).ok && R.planTeams(bad).code === 'teams', '全部手动塞进 1 队：至少要 2 队', R.planTeams(bad));
  ok(m.members.every(x => x.team >= -1) && !ev(m, { t: 'team', uid: 1, to: 1, team: -1 }, T0).err, '取消分队 -1');
}

console.log('— 开始后：按队数缩放');
{
  const { S } = lobby('siroco', 8);
  const o = ev(S, { t: 'start', uid: 1 }, T0);
  ok(!o.err && S.st === 'routes' && S.graph === 'normal' && S.nTeams === 2 && S.teams.length === 2, '8 人开始：2 队', o.err);
  ok(S.members.every(x => x.team === (S.teams.find(t => t.members.includes(x.uid)) || {}).id), '成员记着自己的队');
  ok(S.deadline - T0 === 4800000, '2 队：阶段 80 分钟（和两人版一致）', S.deadline - T0);
  ok(R.scale(S, 'law_a', 4).pen === 0.5 && R.scale(S, 'law_a', 4).par === 1, '2 队：惩罚 ×0.5、时限 ×1');
  const four = lobby('siroco', 16).S; ev(four, { t: 'start', uid: 1 }, T0);
  ok(four.nTeams === 4 && four.deadline - T0 === 2400000, '4 队：阶段 40 分钟（官方）', four.deadline - T0);
  ok(R.scale(four, 'law_a', 4).pen === 1 && R.scale(four, 'law_a', 4).par === 0.5, '4 队：惩罚 ×1、时限 ×0.5');
  const duo = R.init('siroco', mk(2), 'normal', T0, { sid: 'd2', seed: 3 }); duo.members.forEach(m => { m.ready = true; }); ev(duo, { t: 'start', uid: 1 }, T0);
  ok(duo.nTeams === 2 && duo.teams.length === 2 && duo.deadline - T0 === 4800000 && R.scale(duo, 'law_a', 1).pen === 0.5, '两人版：2 个单人队，数值不变');
  // 破坏之门共享时限：4 队 = 300 秒
  const t4 = four.teams[0].members; const e1 = ev(four, { t: 'enter', uid: t4[0], node: 'law_a', with: t4.slice(1) }, T0 + 1000);
  ok(!e1.err && four.glim.law.until - (T0 + 1000) === 300000, '破坏之门共享时限 4 队 = 5 分钟', e1.err || four.glim.law.until - T0 - 1000);
}

console.log('— 带队进图（solo / 跨队）');
{
  const S = lobby('siroco', 8).S; ev(S, { t: 'start', uid: 1 }, T0);
  const a = S.teams[0].members, b = S.teams[1].members;
  const e1 = ev(S, { t: 'enter', uid: a[0], node: 'law_a', with: a.slice(1) }, T0 + 1000);
  ok(!e1.err && R.view(S).nodes.law_a.by.length === 4, '整队 4 人一起进 solo 节点（一支队）', e1.err);
  const e2 = ev(S, { t: 'enter', uid: b[0], node: 'law_b', with: b.slice(1) }, T0 + 1000);
  ok(!e2.err && S.nodes.law_b.st === 'busy', '另一队同时进另一张图');
  const c = ev(S, { t: 'enter', uid: a[0], node: 'law_c', with: [b[0]] }, T0 + 1000);
  ok(c.err, '已经在节点里 / 跨队带人被拒', c.err);
  const S2 = lobby('siroco', 8).S; ev(S2, { t: 'start', uid: 1 }, T0);
  const x = S2.teams[0].members, y = S2.teams[1].members;
  const cr = ev(S2, { t: 'enter', uid: x[0], node: 'law_a', with: [y[0]] }, T0 + 1000);
  ok(cr.err && (cr.err.code === 'solo'), '分头节点不能混两队', cr.err);
  const ent = R.view(S).teams;
  ok(ent[0].color && ent[0].color !== ent[1].color && ent[0].leader === a[0], '视图：每队颜色不同、队长 = 队首', JSON.stringify(ent[0]));
  ok(e1.fx.some(f => f.kind === 'entered' && f.p.team === S.members.find(m => m.uid === a[0]).team), 'entered 带队序号');
  const mk1 = ev(S, { t: 'mark', uid: 1, team: S.members.find(m => m.uid === b[0]).team, node: 'law_d' }, T0 + 1500);
  ok(!mk1.err && b.every(u => S.marks[u] === 'law_d'), '团长标记：整队指向一个节点', mk1.err);
}

console.log('— 补位：整队离线');
{
  const S = lobby('siroco', 8).S; ev(S, { t: 'start', uid: 1 }, T0);
  const b = S.teams[1].members;
  for (const u of b) ev(S, { t: 'online', uid: u, on: false }, T0 + 1000);
  R.tick(S, T0 + 1000 + 60000); ok(!S.sub, '队内全员离线不到 3 分钟：没补位');
  R.tick(S, T0 + 1000 + 181000); ok(S.sub === true, '一整队离线超过 3 分钟：补位规则');
  ev(S, { t: 'online', uid: b[0], on: true }, T0 + 200000); R.tick(S, T0 + 201000); ok(S.sub === false, '回来一个人就恢复（这队又有人了）');
  const S3 = lobby('siroco', 8).S; ev(S3, { t: 'start', uid: 1 }, T0);
  ev(S3, { t: 'online', uid: S3.teams[0].members[1], on: false }, T0 + 1000); R.tick(S3, T0 + 300000);
  ok(!S3.sub, '队里只有一个人离线：不补位');
}

console.log('— 注册第二个团本 + 通用节点类型');
{
  const nodes = {
    key_a: { name: '钥匙图', type: 'key', area: 1, pos: [0.1, 0.2], need: [], fx: { clear: [{ kind: 'key', id: 'k1', text: '拿到钥匙' }] } },
    door: { name: '锁着的门', type: 'main', area: 2, pos: [0.4, 0.2], need: [], needKey: ['k1'] },
    func_a: { name: '功能图', type: 'func', area: 1, pos: [0.1, 0.5], need: [], respawn: 60, fx: { clear: [{ kind: 'gbuff', id: 'dmg', p: { dmgDealt: 0.2 }, dur: 30, text: '全团增伤' }, { kind: 'chaos', v: 1 }, { kind: 'sanity', v: -30 }] } },
    tm: { name: '倒计时图', type: 'timer', area: 1, pos: [0.1, 0.8], need: ['key_a'], timer: 100, repair: 30 },
    elite_room: { name: '精英房', type: 'main', area: 1, pos: [0.3, 0.8], need: [], elites: { e1: { fx: [{ kind: 'unlock', to: 'hidden' }, { kind: 'countdown', to: 'tm', sec: 50 }], text: '精英倒下：隐藏图开了' }, e2: { once: false, fx: [{ kind: 'chaos', v: 1 }] } } },
    hidden: { name: '隐藏图', type: 'main', area: 2, pos: [0.4, 0.6], need: ['door'] },
    boss: { name: '领主', type: 'final', area: 3, pos: [0.8, 0.5], need: ['door', 'hidden', 'func_a'] },
  };
  ctx.RAID_DEFS.tdef = { id: 'tdef', name: '测试团本', minLvl: 1, orderMax: 4, limits: { day: 9, week: 9 }, duoMax: 2, teamSize: 2, minPlayers: 4, minTeams: 2, maxTeams: 3, maxPlayers: 6,
    par: nt => 2 / nt, lives: { normal: 6, guide: 3 }, perNode: { normal: 6, guide: 4 }, erosion: { normal: 60, guide: 10 }, rest: 300, subAfter: 180, subWindow: 90, guard: { minClear: 0, maxDrop: 0 },
    lvl: { node: 1, final: 1 }, sanity: { max: 100, restore: 50 }, chaos: { max: 3, cur: [1, 1.5, 2] },
    scale: { normal: { hp: nt => 1 + 0.1 * nt, atk: 1, mech: 1, cur: 1, gear: 1, penalty: true, pen: nt => nt / 3 }, guide: { hp: 1, atk: 1, mech: 1, cur: 1, gear: 1, penalty: false, pen: 0 } },
    phases: [{ id: 1, name: '测试阶段', limit: { normal: 1200, guide: 600 }, goal: ['boss'], nodes }], rewards: { cur: 'tcur', p1: [{ cur: [10, 10] }] } };
  ok(!!R.defOf('tdef') && R.defOf('siroco') !== R.defOf('tdef'), '第二个团本注册成功（核心里没有写死 siroco）');
  const S = lobby('tdef', 4).S;
  ok(S.tier === 'team' && S.chaos.lv === 1 && S.members.every(m => m.san === 100), '新团本大厅：多队版、混沌 1、理智满');
  ev(S, { t: 'start', uid: 1 }, T0);
  ok(S.nTeams === 2 && S.nodes.key_a.st === 'open' && S.nodes.door.st === 'locked' && S.nodes.tm.st === 'locked', '钥匙图 / 功能图开放，需要钥匙的门没开');
  ok(R.scale(S, 'door', 1).hp === 1.2 && R.scale(S, 'door', 1).pen === 2 / 3, '数值按队数缩放（函数字段）');
  const [ta, tb] = S.teams.map(t => t.members);
  let o = ev(S, { t: 'enter', uid: ta[0], node: 'key_a', with: ta.slice(1) }, T0 + 1000); const r1 = o.ack.run;
  ok(!o.err, '一队进钥匙图', o.err);
  o = ev(S, { t: 'clear', uid: ta[0], node: 'key_a', run: r1 }, T0 + 2000);
  ok(!o.err && S.keys.k1 === true && S.nodes.door.st === 'open' && S.nodes.tm.st === 'open', '钥匙图通关：钥匙到手、需要钥匙的门开放、倒计时图开放', o.err);
  ok(S.nodes.tm.timer === T0 + 2000 + 100000, '倒计时图开放即开始倒计时', S.nodes.tm.timer);
  o = ev(S, { t: 'enter', uid: tb[0], node: 'func_a', with: tb.slice(1) }, T0 + 3000); const r2 = o.ack.run;
  o = ev(S, { t: 'clear', uid: tb[0], node: 'func_a', run: r2 }, T0 + 4000);
  ok(!o.err && S.gbuffs.length === 1 && S.gbuffs[0].p.dmgDealt === 0.2 && R.view(S).gbuffs[0].id === 'dmg', '功能图通关：全团增益', o.err);
  ok(S.chaos.lv === 2 && R.view(S).chaos.lv === 2, '功能图通关：混沌等级 +1');
  ok(S.members.every(m => m.san === 70) && o.fx.filter(f => f.kind === 'sanity').length === 4, '理智值 −30（全员），按人发 fx');
  o = ev(S, { t: 'enter', uid: ta[0], node: 'elite_room', with: ta.slice(1) }, T0 + 5000); const r3 = o.ack.run;
  ok(o.fx.find(f => f.kind === 'entered').p.gbuffs.length === 1, 'entered 带上全团增益');
  const bad = ev(S, { t: 'elite', uid: ta[0], run: r3, v: 'nope' }, T0 + 5500);
  ok(bad.err && bad.err.code === 'elite', '未知精英被拒');
  const nonHost = ev(S, { t: 'elite', uid: ta[1], run: r3, v: 'e1' }, T0 + 5500);
  ok(nonHost.err && nonHost.err.code === 'host', '只有主机能报精英');
  o = ev(S, { t: 'elite', uid: ta[0], run: r3, v: 'e1' }, T0 + 6000);
  ok(!o.err && S.nodes.hidden.st === 'open' && S.nodes.door.st === 'open', '精英 e1：强制打开隐藏图（不管前置）', o.err);
  ok(S.nodes.tm.timer === T0 + 6000 + 50000, '精英击杀触发倒计时 50 秒', S.nodes.tm.timer);
  o = ev(S, { t: 'elite', uid: ta[0], run: r3, v: 'e1' }, T0 + 6500); ok(o.ack && o.ack.dup, '同一精英只认一次 (dup)');
  o = ev(S, { t: 'elite', uid: ta[0], run: r3, v: 'e2' }, T0 + 6600); o = ev(S, { t: 'elite', uid: ta[0], run: r3, v: 'e2' }, T0 + 6700);
  ok(S.chaos.lv === 3, 'once:false 的精英每次都生效，混沌夹在上限 3', S.chaos.lv);
  // 理智值
  const u = ta[0];
  o = ev(S, { t: 'san', uid: u, v: -40 }, T0 + 7000); o = ev(S, { t: 'san', uid: u, v: -40 }, T0 + 7100);
  const mm = S.members.find(x => x.uid === u);
  ok(mm.san === 50 && mm.sanZ === 1 && o.fx.some(f => f.p.mini), '理智归零第一次：回到 50（小游戏）', mm.san);
  ev(S, { t: 'san', uid: u, v: -40 }, T0 + 7200); o = ev(S, { t: 'san', uid: u, v: -40 }, T0 + 7300);
  ok(mm.sanZ === 2 && o.fx.some(f => f.p.dead), '再次归零：倒下', JSON.stringify(o.fx.map(f => f.p)));
  ok(ev(S, { t: 'san', uid: u, v: -999 }, T0 + 7400).err === null && true, '单次限幅');
  // 倒计时到点
  R.tick(S, T0 + 6000 + 50001);
  ok(S.nodes.tm.timer === T0 + 6000 + 50001 + 100000, '倒计时到点后按 timer 重新开始（惩罚计数）', S.stats.penalties);
  // 奖励随混沌等级
  const rw = R.rollReward(S, 1, 1, () => 0);
  ok(rw.cards[0].n === 20, '混沌 3：货币 ×2', JSON.stringify(rw));
  // 功能图 buff 到期
  R.tick(S, T0 + 4000 + 31000); ok(S.gbuffs.length === 0, '全团增益到期撤掉');
  // 存档兼容：删掉多队字段当旧会话
  const old = JSON.parse(JSON.stringify(S)); for (const k of ['tier', 'nTeams', 'teams', 'keys', 'gbuffs', 'chaos']) delete old[k]; old.members.forEach(m => { delete m.team; delete m.party; delete m.san; });
  old.raid = 'tdef'; old.graph = 'normal'; R.tick(old, T0 + 40000);
  ok(old.tier === 'duo' && old.nTeams === 2 && old.members[1].team === 1, '旧会话缺字段：按两人版补齐');
}

console.log(fail ? `✗ ${fail} 项失败` : '全部通过'); process.exit(fail ? 1 : 0);
