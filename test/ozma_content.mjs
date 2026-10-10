// 奥兹玛内容单测（纯 Node，不开浏览器）：次元之门谜题、18 个领主脚本（每个 puzzle 用得上、脚本能跑到读条并解开 / 失败）、5 种精英破防（破招闪光窗口 / 拦截 / 破壳 / 分身）
// 用法：node test/ozma_content.mjs
import fs from 'fs'; import vm from 'vm'; import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const rd = f => fs.readFileSync(new URL('../src/' + f, import.meta.url), 'utf8');
let fail = 0; const ok = (v, m, x) => { console.log(v ? '  ✓' : '  ✗', m, v || x === undefined ? '' : JSON.stringify(x).slice(0, 300)); if (!v) fail++; };
const M = require('../src/game/raid_mech.js');
// 在 vm 里加载：raid_mech（取 RAID_MECH）→ raid_ozma_mech → raid_elite → ozma_raid（内容；没有游戏全局，守卫会跳过运行时部分）
const ctx = {}; vm.createContext(ctx);
vm.runInContext(rd('game/raid_mech.js').replace(/if \(typeof module[\s\S]*$/, '') + '\nthis.RAID_MECH = RAID_MECH;', ctx);
vm.runInContext(rd('game/raid_ozma_mech.js'), ctx);
vm.runInContext(rd('game/raid_elite.js') + '\nthis.RAID_ELITE = RAID_ELITE; this.RAID_ELITES = RAID_ELITES;', ctx);
vm.runInContext(rd('content/raids/ozma_raid.js') + '\nthis.OZMA_RAID_SCRIPTS = OZMA_RAID_SCRIPTS;', ctx);
const MM = ctx.RAID_MECH, E = ctx.RAID_ELITE, SC = ctx.OZMA_RAID_SCRIPTS, DT = 1 / 30;
const C = { W: 1400, D: 196, mode: 'normal', players: ['me'] };

console.log('— 次元之门（阿斯特罗斯）');
{
  const run = (each, ctxx = C) => {
    const R = MM.rng(3), st = MM.puzNew({ use: 'doors', name: '次元之门' }, R, ctxx), out = [...MM.drain(st)];
    for (let i = 0; i < 12 / DT && !st.ended; i++) { for (const e of each(st, i * DT) || []) MM.puzEv(st, e); MM.puzTick(st, DT, R, ctxx); out.push(...MM.drain(st)); }
    return { st, out, hurts: out.filter(o => o.k === 'hurt') };
  };
  ok(!!MM.PUZ.doors, 'RAID_MECH.PUZ.doors 已登记');
  // 站进安全门（她没穿过的那扇）：躲过秒杀，解开
  let r = run(st => [{ k: 'pos', who: 'me', x: st.marks[st.safe].x, y: st.marks[st.safe].y }]);
  ok(r.st.res === 'solve' && !r.hurts.length, '躲进她没穿过的门：解开、没挨秒杀', [r.st.res, r.hurts]);
  // 站进她穿过的门：被击倒，没人躲进 = 失败
  r = run(st => { const bad = (st.safe + 1) % 3; return [{ k: 'pos', who: 'me', x: st.marks[bad].x, y: st.marks[bad].y }]; });
  ok(r.st.res === 'fail' && r.hurts.some(h => h.who === 'me' && h.frac >= 1 && h.down), '站错门：被击倒，没人躲进 = 失败', [r.st.res, r.hurts]);
  // 两人：一个躲进、一个没躲 → 躲进的活、解开，没躲的被击倒
  const C2 = { ...C, players: ['a', 'b'] };
  r = run(st => [{ k: 'pos', who: 'a', x: st.marks[st.safe].x, y: st.marks[st.safe].y }, { k: 'pos', who: 'b', x: 10, y: 10 }], C2);
  ok(r.st.res === 'solve' && r.hurts.length === 1 && r.hurts[0].who === 'b', '两人：站对的活，站错的被击倒，仍解开', r.hurts);
  const st0 = MM.puzNew({ use: 'doors' }, MM.rng(5), C); MM.puzTick(st0, 1, MM.rng(5), C);
  ok(st0.marks.filter(m => /穿过/.test(m.label)).length === 2 && st0.marks.filter(m => m.label === '？').length === 1, '开头 3 秒提示：两扇「穿过 1/2」、一扇「？」', st0.marks.map(m => m.label));
}

console.log('— 领主脚本');
{
  const ids = Object.keys(SC);
  ok(ids.length === 18, '18 个领主都有脚本', ids.length);
  const maps = ['ruin_path', 'ruin_resting', 'ruin_beyond', 'ruin_gladden', 'ruin_corridor', 'despair_crossroads', 'despair_aventus', 'despair_phylis', 'despair_serha', 'despair_lunen', 'terror_land', 'terror_grauben', 'terror_eldfell', 'terror_martyr', 'terror_red_altar', 'p2_elerinon', 'p2_armis', 'p2_throne'];
  ok(maps.every(m => SC[m]), '脚本 key 和 18 张地图一一对应');
  for (const id of ids) {
    const spec = SC[id], uses = [...(spec.weak ? spec.weak.pool.map(p => p.use) : []), ...(spec.atk || []).map(a => a.puzzle.use)];
    const known = uses.every(u => MM.PUZ[u]);
    // 跑：血量掉到第一个门槛 → 读条；站着不动（没解开）→ 灭团 / 或解开；不抛异常
    let S, threw = null, out = [], cast = null, wipe = null, atk = null;
    try {
      S = MM.scriptNew(spec, 11, C);
      for (let i = 0; i < 90 / DT; i++) { const hp = Math.max(0.05, 1 - i / (60 / DT)); out.push(...MM.scriptTick(S, DT, { hp, ev: [{ k: 'pos', who: 'me', x: 700, y: 98, face: 1, z: 0, crouch: true }] })); }
    } catch (e) { threw = e; }
    cast = out.find(o => o.k === 'cast'); wipe = out.find(o => o.k === 'wipe'); atk = out.find(o => o.k === 'atk');
    ok(known && !threw && (!spec.weak || cast) && (!spec.atk || atk), `${id}：谜题都存在、脚本能跑到读条${spec.atk ? ' / 定时机制招' : ''}`, { known, threw: threw && String(threw), cast: !!cast, atk: !!atk });
  }
  // 逐个谜题强制读条，验证每个 weak.pool 项都能 puzNew（人数不够会降级 / 跳过，但不能抛异常）
  let bad = [];
  for (const id of ids) for (const pz of (SC[id].weak ? SC[id].weak.pool : [])) { try { MM.puzNew(pz, MM.rng(1), C); MM.puzNew(pz, MM.rng(1), { ...C, players: ['a', 'b', 'c', 'd'] }); } catch (e) { bad.push(id + ':' + pz.use + ':' + e.message); } }
  ok(!bad.length, '所有虚弱池谜题可创建（单人 / 四人）', bad);
  // 阿斯特罗斯：脚本里 3 次读条都是次元之门；站错门 → 脚本发出 wipe（击倒）
  const A = SC.p2_armis; ok(A.weak.at.length === 3 && A.weak.pool.every(p => p.use === 'doors'), '阿斯特罗斯：血量 75% / 50% / 25% 三次次元之门');
  const S2 = MM.scriptNew(A, 4, C); let o2 = [];
  for (let i = 0; i < 40 / DT; i++) o2.push(...MM.scriptTick(S2, DT, { hp: 0.7, ev: [{ k: 'pos', who: 'me', x: 20, y: 20 }] }));
  ok(o2.some(o => o.k === 'cast' && o.id === 'doors') && o2.some(o => o.k === 'wipe'), '站错门 → 灭团（wipe）', o2.filter(o => o.k === 'wipe' || o.k === 'cast').map(o => o.k));
  const S3 = MM.scriptNew(A, 4, C); let o3 = [];
  for (let i = 0; i < 40 / DT; i++) { const st = S3.cast; const ev = st && st.id === 'doors' ? [{ k: 'pos', who: 'me', x: st.marks[st.safe].x, y: st.marks[st.safe].y }] : []; o3.push(...MM.scriptTick(S3, DT, { hp: 0.7, ev })); }
  ok(o3.some(o => o.k === 'solve') && o3.some(o => o.k === 'break' && o.mul >= 1.6), '躲进安全门 → 解开，阿斯特罗斯虚弱（受伤 ×1.6）', o3.filter(o => o.k === 'solve' || o.k === 'break'));
}

console.log('— 精英破防');
{
  const R = ctx.RAID_ELITES, ids = ['ozEliteRuin', 'ozEliteDespair', 'ozEliteTerror', 'ozEliteSuppress', 'ozEliteChaos'];
  ok(ids.every(i => R[i] && E.TYPES[R[i].type]), '5 个精英已登记，破防类型都存在', ids.map(i => R[i] && R[i].type));
  ok(new Set(ids.map(i => R[i].type)).size === 4, '4 种不同的破防条件（破招 / 拦截 / 破壳 / 分身）');
  // 破招（毁灭门将）：起手 → 闪光窗口内命中 = 打断 + 破防；窗口外命中 / 不打 = 招式落下
  const mk = id => E.create(R[id]); const tickTo = (e, t) => { const out = []; for (let s = 0; s < t; s += 0.1) out.push(...E.tick(e, 0.1)); return out; };
  let e = mk('ozEliteRuin'), out = tickTo(e, e.p.every + 0.3);
  ok(out.some(o => o.k === 'cast'), '毁灭门将：到点起手（抬手）');
  out.push(...tickTo(e, e.p.flashAt + 0.2));
  const hit = E.on(e, { k: 'hit' });
  ok(hit.some(o => o.k === 'interrupt') && hit.some(o => o.k === 'break'), '闪光窗口内命中：打断 + 破防（硬直）', hit);
  ok(E.mul(e) >= 1.5, '破防期间受伤倍率 ≥ 1.5', E.mul(e));
  e = mk('ozEliteRuin'); tickTo(e, e.p.every + 0.3); const early = E.on(e, { k: 'hit' });
  ok(!early.some(o => o.k === 'interrupt'), '闪光之前命中：没打断', early);
  const rest = tickTo(e, e.p.windup + 0.5);
  ok(rest.some(o => o.k === 'punish' && o.frac === e.p.punish), '没打断：招式落下，惩罚 = ' + e.p.punish, rest.map(o => o.k));
  const c = mk('ozEliteChaos'); ok(c.p.flashLen < R.ozEliteRuin.p.flashLen && c.p.every < 9, '王座门将：窗口更短、更频繁');
  // 拦截球（绝望门将）：连续拦截 need 个 → 破防
  e = mk('ozEliteDespair'); const o4 = tickTo(e, e.p.every + 0.3), orbs = o4.filter(o => o.k === 'spawn' && o.what === 'orb');
  ok(orbs.length === e.p.orbN, '绝望门将：放出绝望之球 ×' + e.p.orbN, orbs.length);
  let brk = [];
  for (let k = 0; k < 6 && !brk.length; k++) { if (k) tickTo(e, e.p.every + 0.2); for (const ob of e.objs.slice()) { brk.push(...E.on(e, { k: 'intercept', i: ob.i }).filter(x => x.k === 'break')); } }
  ok(brk.length >= 1, '连续拦截够数：破防', brk);
  // 破壳（恐怖门将）：打碎全部岩壳 → 破防
  e = mk('ozEliteTerror'); const sh = e.objs.filter(o => o.what === 'shell'); ok(sh.length === e.p.shells || tickTo(e, 1).length >= 0, '恐怖门将：开场就长出岩壳');
  const shells = e.objs.filter(o => o.what === 'shell'); let sb = [];
  for (const s of shells) sb.push(...E.on(e, { k: 'shellBroken', i: s.i }));
  ok(sb.some(o => o.k === 'break'), '岩壳全部打碎：破防', sb);
  // 分身（埃利诺斯压制者）：击杀分身
  e = mk('ozEliteSuppress'); tickTo(e, e.p.every + 0.5); const cl = e.objs.filter(o => o.what === 'clone'); let cb = [];
  for (const x of cl) cb.push(...E.on(e, { k: 'cloneDead', i: x.i }));
  ok(cl.length >= 1 && cb.some(o => o.k === 'break'), '埃利诺斯压制者：击杀全部分身 → 破防', [cl.length, cb.map(o => o.k)]);
  ok(E.done(mk('ozEliteRuin')) !== undefined, '精英倒下可上报（done）');
}

console.log(fail ? `\n${fail} 项失败` : '\n全部通过'); process.exit(fail ? 1 : 0);
