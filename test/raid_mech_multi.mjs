// 团本领主机制多人化（src/game/raid_mech.js）的纯逻辑测试：哈妮尔传心、崔拉 & 昙娜各引一球、卢克西吸血挡位，以及人少时的降级。
// 用法：node test/raid_mech_multi.mjs
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const M = require('../src/game/raid_mech.js');
let fail = 0, n = 0;
const ok = (c, msg, d) => { n++; if (c) console.log('✓', msg); else { fail++; console.log('✗', msg, d !== undefined ? JSON.stringify(d).slice(0, 300) : ''); } };
const DT = 1 / 30, W = 1400, D = 196;
const ctx = players => ({ W, D, mode: 'normal', players });
const pos = (who, x, y, o = {}) => ({ k: 'pos', who, x, y, face: 1, z: 0, ...o });
function run(spec, players, each, { seed = 7, sec = 40 } = {}) {
  const C = ctx(players), R = M.rng(seed), st = M.puzNew(spec, R, C); if (!st) return { st: null, out: [] };
  const out = [...M.drain(st)];
  for (let i = 0; i < sec / DT && !st.ended; i++) { for (const e of each(st, i * DT, i) || []) M.puzEv(st, e); M.puzTick(st, DT, R, C); out.push(...M.drain(st)); }
  return { st, out, hurts: out.filter(o => o.k === 'hurt') };
}
const hold = (st, who) => st.heart && st.heart.who === who;

// ---------- 哈妮尔传心 ----------
{
  const spec = { use: 'clear', n: 2, hold: 1, grow: 0, dur: 20, heart: true };
  // 非持心者站进阵里没用；持心者站进去 → 清掉
  const wrong = run(spec, ['a', 'b'], st => { const mk = st.marks.find(q => q.on); const o = hold(st, 'a') ? 'b' : 'a'; return mk ? [pos(o, mk.x, mk.y), pos(hold(st, 'a') ? 'a' : 'b', 5, 5)] : []; }, { sec: 8 });
  ok(wrong.st.res !== 'solve' && wrong.st.left === 2, '传心：没拿红心的人站进阵里不算', { left: wrong.st.left, res: wrong.st.res });
  const right = run(spec, ['a', 'b'], st => { const mk = st.marks.find(q => q.on); return mk ? [pos(st.heart.who, mk.x, mk.y), pos(st.heart.who === 'a' ? 'b' : 'a', 5, 5)] : []; });
  ok(right.st.res === 'solve' && right.out.some(o => o.k === 'status' && o.id === 'heart') && right.out.some(o => o.k === 'unstatus' && o.id === 'heart'), '传心：持心者站进阵里清掉（红心状态加上 / 结束时收回）', right.st.res);
  // 传心：持心者碰到队友，红心传过去
  const pass = run(spec, ['a', 'b'], (st, t) => { const h = st.heart.who, o = h === 'a' ? 'b' : 'a'; return [pos(h, 300, 100), pos(o, t > 1.5 ? 310 : 900, 100)]; }, { sec: 3 });
  const st0 = M.puzNew(spec, M.rng(7), ctx(['a', 'b'])), first = st0.heart.who;
  ok(pass.out.some(o => o.k === 'status' && o.id === 'heart' && o.who !== first) || pass.out.filter(o => o.k === 'say' && o.text === '传心！').length >= 1, '传心：红心碰到队友就传过去', pass.out.filter(o => o.k === 'status'));
  // 降级：一个人时谁都能消
  const solo = run(spec, ['me'], st => { const mk = st.marks.find(q => q.on); return mk ? [pos('me', mk.x, mk.y)] : []; });
  ok(solo.st.res === 'solve' && !solo.st.heart && !solo.out.some(o => o.id === 'heart'), '传心：一个人时降级（不用红心，谁都能消）');
  // 持心者离开 → 红心自动换给还在的人
  const lv = run(spec, ['a', 'b'], (st, t) => { const h = st.heart.who, o = h === 'a' ? 'b' : 'a'; return t < 0.3 ? [pos('a', 100, 100), pos('b', 900, 100)] : t < 0.4 ? [{ k: 'leave', who: h }] : [pos(o, 900, 100)]; }, { sec: 2 });
  ok(lv.st.heart && !!lv.st.pl[lv.st.heart.who] && lv.out.filter(o => o.k === 'status' && o.id === 'heart').length >= 2, '传心：持心者离开后红心换给还在的人', lv.st.heart);
}
// ---------- 崔拉 & 昙娜：各引一个球 ----------
{
  const spec = { use: 'guide', n: 2, dur: 30, each: true };
  const st = M.puzNew(spec, M.rng(3), ctx(['a', 'b']));
  ok(st.bind && st.bind[0] === 'a' && st.bind[1] === 'b' && st.orbs[0].col !== st.orbs[1].col, '双球：两个球分别认两个人（黑白两色）', st.bind);
  const lead = (who, orbIdx) => (st, t) => { const o = st.orbs[orbIdx]; if (o.on) return []; const g = st.goal, dx = g.x - o.x, dy = (g.y - o.y) / 0.45, L = Math.hypot(dx, dy) || 1; return [pos(who, o.x + dx / L * 44, o.y + dy / L * 44 * 0.45)]; };
  const onlyA = run(spec, ['a', 'b'], (st, t, i) => lead('a', 0)(st, t).concat(lead('a', 1)(st, t)), { sec: 30 });
  ok(onlyA.st.res !== 'solve' && onlyA.st.done <= 1, '双球：一个人想把两个球都引走不行（每个球只跟自己的人）', { done: onlyA.st.done, res: onlyA.st.res });
  const both = run(spec, ['a', 'b'], (st, t, i) => lead('a', 0)(st, t).concat(lead('b', 1)(st, t)), { sec: 30 });
  ok(both.st.res === 'solve' && both.st.done === 2, '双球：两个人各引一个 → 都到中间解开', { done: both.st.done, res: both.st.res });
  const solo = run(spec, ['me'], (st, t) => { const o = st.orbs.find(q => !q.on); if (!o) return []; const g = st.goal, dx = g.x - o.x, dy = (g.y - o.y) / 0.45, L = Math.hypot(dx, dy) || 1; return [pos('me', o.x + dx / L * 44, o.y + dy / L * 44 * 0.45)]; });
  ok(solo.st.res === 'solve' && !solo.st.bind, '双球：一个人时降级（谁都能引、一个人引两个）');
}
// ---------- 卢克西吸血挡位 ----------
{
  const spec = { use: 'leech', dur: 10 };
  const anchor = { k: 'anchor', x: 1000, y: 100, face: -1 };
  const st0 = M.puzNew(spec, M.rng(5), ctx(['a', 'b'])), tgt = st0.target, oth = tgt === 'a' ? 'b' : 'a';
  const stand = (block) => (st, t) => [anchor, pos(st.target, 300, 100), pos(st.target === 'a' ? 'b' : 'a', block ? 650 : 300, block ? 100 : 160)];
  const open = run(spec, ['a', 'b'], stand(false), { sec: 12, seed: 5 });
  ok(open.hurts.length > 5 && open.hurts.every(h => h.why === 'leech') && open.hurts.some(h => h.who === tgt), '吸血：没人挡 → 被连线的人持续挨打', open.hurts.length);
  const blocked = run(spec, ['a', 'b'], stand(true), { sec: 12, seed: 5 });
  ok(blocked.st.res === 'solve' && !blocked.hurts.some(h => h.who === tgt && h.why === 'leech' && blocked.st.target === tgt) , '吸血：队友站到连线中间挡住 → 被吸的人没事', { tgtHurts: blocked.hurts.filter(h => h.who === tgt).length });
  ok(blocked.hurts.some(h => h.who !== blocked.st.target && h.frac > 0 && h.frac < 0.06), '吸血：挡住的人分担一半伤害', blocked.hurts.slice(0, 2));
  ok(open.out.some(o => o.k === 'status' && o.id === 'leeched'), '吸血：被连线的人有「被吸血」状态');
  ok(run(spec, ['a', 'b'], stand(false), { sec: 12, seed: 5 }).st.res === 'fail', '吸血：一直没人挡 → 失败');
  // 降级
  ok(M.puzNew(spec, M.rng(5), ctx(['me'])) === null, '吸血：一个人时没有 alt 就不出');
  const alt = M.puzNew({ ...spec, alt: { use: 'tether', dur: 8 } }, M.rng(5), ctx(['me']));
  ok(alt && alt.id === 'tether', '吸血：一个人时降级成 alt（连线拉开距离）');
}
// ---------- 脚本层：人数 / 离开 / 降级 ----------
{
  const spec = { intro: { dur: 0.1 }, atk: [{ every: [99, 99], first: 0.3, puzzle: { use: 'leech', alt: { use: 'tether', name: '吸血' } } }], weak: { every: 0.5, pool: [{ use: 'guide', n: 2, each: true }] } };
  const play = players => { const S = M.scriptNew(spec, 9, { W, D, mode: 'normal', players }); const out = []; for (let i = 0; i < 90; i++) out.push(...M.scriptTick(S, DT, { hp: 1, ev: [] })); return { S, out }; };
  const two = play(['a', 'b']), one = play(['me']);
  ok(two.S.side.some(s => s.id === 'leech') && two.S.cast && two.S.cast.bind, '脚本：两个人时放出吸血挡位 + 双球', two.S.side.map(s => s.id));
  ok(one.S.side.some(s => s.id === 'tether') && one.S.cast && !one.S.cast.bind, '脚本：一个人时自动降级（连线 + 一个人引球）', one.S.side.map(s => s.id));
  const S = M.scriptNew({ intro: { dur: 0 }, weak: { every: 0.2, pool: [{ use: 'clear', n: 1, hold: 99, dur: 30 }] } }, 1, { W, D, mode: 'normal', players: ['a', 'b'] });
  for (let i = 0; i < 40 && !S.cast; i++) M.scriptTick(S, 0.1, { hp: 1 });
  M.scriptTick(S, 0.1, { hp: 1, ev: [pos('a', 1, 1), pos('b', 2, 2)] });
  M.scriptTick(S, 0.1, { hp: 1, ev: [{ k: 'leave', who: 'b' }] });
  ok(S.cast && S.cast.pl && !S.cast.pl.b && S.cast.pl.a, '脚本：leave 事件把离开的人从谜题里移除', S.cast && S.cast.pl);
  // 多人：谁打的物件谁的名字进事件（hit 带 who）
  const c = M.puzNew({ use: 'heartbeat' }, M.rng(1), ctx(['a', 'b'])); let t = 0; const R = M.rng(2);
  while (!M.PUZ.heartbeat.beat(c, c.p)) { M.puzTick(c, DT, R, ctx(['a', 'b'])); t += DT; }
  M.puzEv(c, { k: 'hit', tag: 'heart', i: 0, who: 'b' }); M.puzTick(c, DT, R, ctx(['a', 'b']));
  ok(c.n === 1, '多人：任何一个人打心脏都算一拍');
}
console.log(`\n${n - fail}/${n} 通过`);
process.exit(fail ? 1 : 0);
