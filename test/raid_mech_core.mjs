// 团本领主机制核心（src/game/raid_mech.js）的纯逻辑测试：不开浏览器，固定种子。
//   每个谜题原语：解法能解开、错法会失败 / 挨打；玩家状态（叠层、计时、满层触发）；领主脚本（出场无敌 → 门槛读条 → 解开虚弱 / 没解开灭团、
//   引导模式减伤、固定出招循环、定时机制招、同一种子结果一致）
// 用法：node test/raid_mech_core.mjs
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const M = require('../src/game/raid_mech.js');
let fail = 0, n = 0;
const ok = (c, msg, d) => { n++; if (c) console.log('✓', msg); else { fail++; console.log('✗', msg, d !== undefined ? JSON.stringify(d).slice(0, 300) : ''); } };
const C = { W: 1400, D: 196, mode: 'normal', players: ['me'] };
const DT = 1 / 30;
// 跑一个谜题：each(st, t) 返回这一步的输入事件；返回 { st, out }
function run(spec, each, { seed = 7, sec = 40, ctx = C } = {}) {
  const R = M.rng(seed), st = M.puzNew(spec, R, ctx), out = [...M.drain(st)];
  for (let i = 0; i < sec / DT && !st.ended; i++) { for (const e of each(st, i * DT) || []) M.puzEv(st, e); M.puzTick(st, DT, R, ctx); out.push(...M.drain(st)); }
  return { st, out, hurts: out.filter(o => o.k === 'hurt') };
}
const pos = (x, y, o = {}) => ({ k: 'pos', who: 'me', x, y, face: 1, z: 0, ...o });
const center = m => pos(m.x, m.y);

// ---------- 玩家状态 ----------
{
  const S = {};
  ok(M.stAdd(S, 'erode') === null && M.stN(S, 'erode') === 1, '状态：侵蚀叠 1 层');
  for (let i = 0; i < 3; i++) M.stAdd(S, 'erode');
  ok(M.stN(S, 'erode') === 4 && M.stAdd(S, 'erode') === 'petrify' && M.stHas(S, 'petrify') && !M.stHas(S, 'erode'), '状态：侵蚀叠满 5 层 → 石化（侵蚀清掉）');
  const gone = M.stTick(S, 3.1); ok(gone.includes('petrify') && !M.stHas(S, 'petrify'), '状态：石化 3 秒后到期');
  M.stAdd(S, 'buried'); M.stTick(S, 100); ok(M.stHas(S, 'buried') && M.stDel(S, 'buried') && !M.stHas(S, 'buried'), '状态：dur 0 = 一直有效，直到移除');
}
// ---------- 谜题 ----------
{ // pads
  const a = run({ use: 'pads' }, st => { const k = st.i; if (st.t < 5) return []; const m = st.marks[st.seq[k]]; return [pos(m.x, m.y), pos(0, 0)]; });
  ok(a.st.res === 'solve' && a.hurts.length === 0, '顺序踩板：按序号踩 → 解开、没挨打', a.st.res);
  const b = run({ use: 'pads' }, st => { const wrong = st.marks.findIndex((_, i) => i !== st.seq[st.i]); const m = st.marks[wrong]; return [pos(m.x, m.y), pos(0, 0)]; });
  ok(b.st.res === 'fail' && b.hurts.length === 4, '顺序踩板：一直踩错 → 第 4 次失败（每次挨打）', { r: b.st.res, h: b.hurts.length });
  const c = run({ use: 'pads', peek: 4 }, () => []); ok(c.st.res === 'fail' && c.st.marks.every(m => m.label === '?'), '顺序踩板：超时失败；peek 之后序号藏起来');
}
{ // heartbeat
  const a = run({ use: 'heartbeat' }, st => (M.PUZ.heartbeat.beat(st, st.p) ? [{ k: 'hit', tag: 'heart', i: 0, who: 'me' }] : []));
  ok(a.st.res === 'solve' && a.hurts.length === 0 && a.st.n === 4, '心跳：亮的时候打（每拍一下）→ 4 拍解开', a.st);
  const b = run({ use: 'heartbeat' }, st => (!M.PUZ.heartbeat.beat(st, st.p) && Math.round(st.t * 30) % 15 === 0 ? [{ k: 'hit', tag: 'heart', i: 0, who: 'me' }] : []));
  ok(b.st.res === 'fail' && b.hurts.length > 3, '心跳：不亮的时候打 → 挨打，超时失败', { r: b.st.res, h: b.hurts.length });
}
{ // realBody
  const a = run({ use: 'realBody' }, st => { const o = st.objs.find(q => q.glow); return o ? [{ k: 'hit', tag: 'clone', i: o.i, who: 'me' }] : []; });
  ok(a.st.res === 'solve' && a.hurts.length === 0, '真身：打闪光的那个 → 解开');
  const b = run({ use: 'realBody' }, st => { const o = st.objs.find(q => q.alive && q.i !== st.real); return o ? [{ k: 'hit', tag: 'clone', i: o.i, who: 'me' }] : []; });
  ok(b.st.res === 'fail' && b.hurts.length === 2 && b.st.objs.filter(o => !o.alive).length === 2, '真身：连打两个假的 → 失败（假的消失）', b.st.res);
}
{ // orbs
  const a = run({ use: 'orbs' }, st => { const i = st.objs.findIndex(o => o.alive && o.elem === st.seq[st.k]); return i >= 0 ? [{ k: 'kill', tag: 'orb', i, who: 'me' }] : []; });
  ok(a.st.res === 'solve' && a.hurts.length === 0, '属性球：按顺序打碎 → 解开');
  let once = false; const b = run({ use: 'orbs' }, st => { if (once) return []; once = true; const i = st.objs.findIndex(o => o.elem !== st.seq[0]); return [{ k: 'kill', tag: 'orb', i, who: 'me' }]; });
  ok(b.st.res === 'fail' && b.hurts.length === 1 && b.st.objs.every(o => o.alive), '属性球：先打错 → 挨打、全部复原；超时失败');
  ok(/→/.test(M.puzText(M.puzNew({ use: 'orbs' }, M.rng(1), C))), '属性球：提示里有顺序');
}
{ // path
  const walk = st => { // 沿路线一格一格走
    st._k = (st._k || 0) + 0.25; const p = st.p, cells = st.cells.map(s => s.split(',').map(Number)).sort((a, b) => a[0] - b[0] || 0);
    const c = cells[Math.min(cells.length - 1, Math.floor(st._k))]; return [pos(st.W * p.x0 + st.cw * (c[0] + 0.5), st.ch * (c[1] + 0.5))]; };
  const a = run({ use: 'path' }, walk);
  ok(a.st.res === 'solve' && a.hurts.length === 0, '地板路线：沿发光的格子走到对面 → 解开', a.st.res);
  const b = run({ use: 'path' }, st => { const bad = st.marks.find(m => !m.on); return [pos(bad.x, bad.y)]; });
  ok(b.st.res === 'fail' && b.out.some(o => o.k === 'tp') && b.hurts.length === 3, '地板路线：踩到暗格 → 挨打、送回起点，第 3 次失败');
}
{ // guide
  const a = run({ use: 'guide' }, st => { const o = st.orbs.find(q => !q.on); if (!o) return []; const g = st.goal; const near = M.gdist(st.pl && st.pl.me || { x: -999, y: 0 }, o) < 60; return [near ? pos(o.x + Math.sign(g.x - o.x) * 40, o.y + Math.sign(g.y - o.y) * 10) : pos(o.x + Math.sign(g.x - o.x) * 40, o.y)]; });
  ok(a.st.res === 'solve' && a.st.done === 3, '引导光球：走近光球带它进祭坛 ×3 → 解开', { r: a.st.res, d: a.st.done });
  const b = run({ use: 'guide' }, () => [pos(10, 10)]); ok(b.st.res === 'fail', '引导光球：不管它 → 超时失败');
}
{ // burial
  const a = run({ use: 'burial' }, (st, t) => (Math.round(t * 30) % 6 === 0 ? [{ k: 'mash', who: 'me' }] : []));
  ok(a.st.res === 'solve' && a.out.some(o => o.k === 'status' && o.id === 'buried') && a.out.some(o => o.k === 'unstatus' && o.id === 'buried') && a.hurts.length === 0, '掩埋：被埋（定身）→ 连打挣脱 → 解开、解除定身');
  const b = run({ use: 'burial' }, () => []); ok(b.st.res === 'fail' && b.hurts.length === 1 && b.hurts[0].frac === 0.45 && b.out.some(o => o.k === 'unstatus'), '掩埋：不挣扎 → 到点重伤（45%）也解除定身');
}
{ // tether
  const anchor = { k: 'anchor', x: 700, y: 98 };
  const a = run({ use: 'tether' }, () => [anchor, pos(100, 98)]); ok(a.st.res === 'solve' && a.hurts.length === 0, '连线：离领主够远撑过 8 秒 → 解开');
  const b = run({ use: 'tether' }, () => [anchor, pos(720, 98)]); ok(b.st.res === 'fail' && b.hurts.length === 7, '连线：贴着领主 → 每 0.5 秒挨一下，第 7 下失败', b.hurts.length);
}
{ // breath
  const a = run({ use: 'breath' }, st => [center(st.marks[0])]); ok(a.st.res === 'solve' && a.hurts.length === 0, '呼吸：跟着气泡走 → 撑过 16 秒');
  const b = run({ use: 'breath' }, () => [pos(5, 5)]); ok(b.st.res === 'fail' && b.out.some(o => o.k === 'status' && o.id === 'suffocate'), '呼吸：一直在外面 → 窒息两次失败');
  ok(run({ use: 'breath' }, () => [pos(5, 5)], { ctx: { ...C, mode: 'guide' } }).st.p.hurt === 0.075, '引导模式：谜题挨打减半');
}
{ // reflect
  const a = run({ use: 'reflect' }, st => (!st.up ? [{ k: 'hit', tag: 'boss', who: 'me' }] : [])); ok(a.st.res === 'solve' && a.hurts.length === 0, '反射：护罩关着时打 → 撑过 14 秒没事');
  const b = run({ use: 'reflect' }, st => (st.up && Math.round(st.t * 30) % 10 === 0 ? [{ k: 'hit', tag: 'boss', who: 'me' }] : [])); ok(b.st.res === 'fail' && b.hurts.length === 6, '反射：护罩亮着还打 → 反伤，第 6 下失败');
}
{ // gem
  const a = run({ use: 'gem' }, st => { const g = st.carry.me; if (g != null) return [center(st.altar)]; const q = st.gems.find(x => !x.on); return q ? [center(q)] : []; });
  ok(a.st.res === 'solve' && a.out.filter(o => o.k === 'status' && o.id === 'carry').length === 2, '搬宝石：捡起（减速）搬到祭坛 ×2 → 解开');
  let hit = false; const b = run({ use: 'gem' }, st => { if (st.carry.me != null && !hit) { hit = true; return [{ k: 'hurt', who: 'me' }]; } const q = st.gems[0]; return st.carry.me == null && !hit ? [center(q)] : []; });
  ok(b.st.res === 'fail' && b.out.some(o => o.k === 'unstatus' && o.id === 'carry'), '搬宝石：被打中 → 宝石掉了；超时失败');
}
{ // crystals
  const a = run({ use: 'crystals' }, st => { const o = st.objs.find(q => q.alive); return o ? [{ k: 'kill', tag: 'crystal', i: o.i, who: 'me' }] : []; }); ok(a.st.res === 'solve', '水晶：全部打碎 → 解开');
  ok(run({ use: 'crystals' }, () => []).st.res === 'fail', '水晶：不打 → 超时失败');
}
{ // swords
  const a = run({ use: 'swords' }, st => { const m = st.marks.find(q => q.on) || st.marks[0]; return [center(m)]; }); ok(a.st.res === 'solve' && a.hurts.length === 0, '日月之剑：每轮站到亮出来的那边 → 3 轮没事');
  const b = run({ use: 'swords' }, st => { const m = st.marks.find(q => !q.on && st.sign) || st.marks[0]; return [center(st.sign ? st.marks.find(q => q.side !== st.sign) : m)]; }); ok(b.st.res === 'fail' && b.hurts.length === 2, '日月之剑：站反 → 第 2 次失败');
}
{ // facing
  const a = run({ use: 'facing', mode: 'away' }, () => [{ k: 'anchor', x: 700 }, pos(400, 98, { face: -1 })]); ok(a.st.res === 'solve', '凝视：背对领主 → 没事');
  const b = run({ use: 'facing', mode: 'away' }, () => [{ k: 'anchor', x: 700 }, pos(400, 98, { face: 1 })]); ok(b.st.res === 'fail' && b.hurts.length === 1, '凝视：面朝领主 → 挨打');
  const c = run({ use: 'facing', mode: 'toward' }, () => [{ k: 'anchor', x: 700 }, pos(400, 98, { face: 1 })]); ok(c.st.res === 'solve', '凝视（toward）：面朝领主 → 没事');
}
{ // soulSwap
  const a = run({ use: 'soulSwap' }, (st, t) => { if (Math.round(t * 30) % 20) return []; const o = st.objs.find(q => q.alive && q.side === st.soul.me); return o ? [{ k: 'kill', tag: 'soul', i: o.i, who: 'me' }] : []; });
  ok(a.st.res === 'solve' && a.hurts.length === 0 && a.st.swapped && a.out.filter(o => o.k === 'status').length === 2, '灵魂互换：只打同色（中途换色跟着换）→ 解开', { r: a.st.res, h: a.hurts.length, s: a.st.swapped });
  const b = run({ use: 'soulSwap' }, (st, t) => { if (Math.round(t * 30) % 20) return []; const o = st.objs.find(q => q.alive && q.side !== st.soul.me); return o ? [{ k: 'kill', tag: 'soul', i: o.i, who: 'me' }] : []; });
  ok(b.st.res === 'fail' && b.hurts.length > 3, '灵魂互换：打异色 → 挨打、魂复原；超时失败');
}
{ // souls + BGM cue
  const a = run({ use: 'souls' }, st => (st.open ? st.objs.filter(o => o.alive).slice(0, 1).map(o => ({ k: 'hit', tag: 'soul', i: o.i, who: 'me' })) : []));
  ok(a.st.res === 'solve' && a.hurts.length === 0 && a.out.filter(o => o.k === 'cue').length >= 1 && a.st.t > a.st.p.cue, '守门人之魂：鼓点后的窗口里打 → 全部打碎（鼓点前打不碎、有节拍事件）', { r: a.st.res, c: a.out.filter(o => o.k === 'cue').length });
  const b = run({ use: 'souls' }, (st, t) => (!st.open && Math.round(t * 30) % 15 === 0 ? [{ k: 'hit', tag: 'soul', i: 0, who: 'me' }] : []));
  ok(b.st.res === 'fail' && b.hurts.length > 5 && b.st.left === 4, '守门人之魂：节拍外打 → 被反伤、打不碎');
}
{ // crouch
  const a = run({ use: 'crouch' }, () => [pos(500, 98, { crouch: true })]); ok(a.st.res === 'solve' && a.hurts.length === 0, '全屏击倒：蹲下 → 没事');
  const b = run({ use: 'crouch' }, () => [pos(500, 98, { z: 40 })]); ok(b.st.res === 'fail' && b.hurts[0].down, '全屏击倒：跳起来也会被打倒');
  const c = run({ use: 'crouch' }, () => [pos(500, 98)]); ok(c.st.res === 'fail', '全屏击倒：站着 → 被打倒');
}
// ---------- 领主脚本 ----------
function script(spec, { seed = 3, mode = 'normal', solve = true, hpAt = t => Math.max(0.05, 1 - t / 60), sec = 70 } = {}) {
  const S = M.scriptNew(spec, seed, { ...C, mode }), out = [];
  out.push(...M.scriptTick(S, 0, { hp: 1 }));
  for (let i = 0; i < sec / DT; i++) {
    const ev = []; if (S.cast && solve) { if (S.cast.id === 'crystals') { const o = S.cast.objs.find(q => q.alive); if (o) ev.push({ k: 'kill', tag: 'crystal', i: o.i, who: 'me' }); } if (S.cast.id === 'heartbeat' && M.PUZ.heartbeat.beat(S.cast, S.cast.p)) ev.push({ k: 'hit', tag: 'heart', i: 0, who: 'me' }); }
    for (const s of S.side) if (s.id === 'crouch') ev.push(pos(400, 98, { crouch: true }));
    const o = M.scriptTick(S, DT, { hp: hpAt(i * DT), ev }); out.push(...o.map(x => ({ ...x, T: +(i * DT).toFixed(2) })));
  }
  return { S, out, of: k => out.filter(o => o.k === k) };
}
{
  const spec = { intro: { dur: 2.5, say: '入场' }, weak: { at: [0.7, 0.4], pool: [{ use: 'crystals' }, { use: 'heartbeat' }] }, onSolve: { dur: 6, mul: 1.6 }, loop: ['a', 'b', 'c'], gap: [3, 3], lines: { intro: '哈', cast: '读条台词', solve: '不可能……', low: '残血台词' } };
  const a = script(spec);
  const inv = a.of('invul');
  ok(inv.length === 2 && inv[0].on && !inv[1].on && Math.abs(inv[1].T - 2.5) < 0.05, '脚本：出场无敌 2.5 秒', inv);
  const casts = a.of('cast');
  ok(casts.length === 2 && casts[0].id === 'crystals' && casts[1].id === 'heartbeat', '脚本：血量 70% / 40% 各读条一次，虚弱池按顺序抽', casts.map(c => c.id));
  const br = a.of('break'); ok(br.length === 2 && br[0].mul === 1.6 && a.of('unbreak').length === 2 && a.of('wipe').length === 0, '脚本：解开 → 虚弱 6 秒（受伤 ×1.6）→ 恢复');
  const sk = a.of('skill'); ok(sk.length > 5 && sk.slice(0, 3).map(s => s.id).join() === 'a,b,c' && !sk.some(s => s.T > casts[0].T && s.T < br[0].T), '脚本：固定出招循环 a → b → c，读条时不出招');
  ok(a.of('line').map(l => l.id).join() === 'intro,cast,solve,cast,solve,low', '脚本：台词（入场 / 读条 / 解开 / 残血）', a.of('line').map(l => l.id));
  const b = script(spec, { solve: false });
  const w = b.of('wipe'); ok(w.length === 2 && w[0].frac === 1 && w[0].down && b.of('break').length === 0, '脚本：没解开 → 灭团（普通模式 100% 最大 HP）');
  const g = script(spec, { solve: false, mode: 'guide' }); ok(g.of('wipe')[0].frac === 0.3, '脚本：引导模式灭团只扣 30%');
  const d1 = JSON.stringify(script({ ...spec, weak: { ...spec.weak, pick: 'random' } }, { seed: 11 }).out), d2 = JSON.stringify(script({ ...spec, weak: { ...spec.weak, pick: 'random' } }, { seed: 11 }).out);
  ok(d1 === d2, '脚本：同一个种子结果完全一样');
  const e = script({ intro: { dur: 1 }, weak: { every: 20, pool: [{ use: 'crystals' }] }, atk: [{ every: [12, 12], first: 5, puzzle: { use: 'crouch' } }] }, { hpAt: () => 1, sec: 60 });
  ok(e.of('cast').length === 2 && Math.abs(e.of('cast')[0].T - 21) < 0.1, '脚本：按时间读条（战斗时间每 20 秒，虚弱期间不计）', e.of('cast').map(c => c.T));
  ok(e.of('atk').length === 4 && e.of('hurt').length === 0, '脚本：定时机制招（全屏击倒，每 12 秒，虚弱期间暂停），蹲下没事', e.of('atk').map(c => c.T));
  const v = M.view(e.S); ok(v.ph && 'cast' in v && Array.isArray(v.side), '脚本：view 给 HUD 用');
}
console.log(`\n${n - fail}/${n} 通过`);
process.exit(fail ? 1 : 0);
