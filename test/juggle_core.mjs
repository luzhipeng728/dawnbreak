// 刷图浮空保护核心（src/engine/juggle_core.js）的纯逻辑单元测试：node:vm 加载，不开浏览器，毫秒级跑完。用法：node test/juggle_core.mjs
import fs from 'node:fs';
import vm from 'node:vm';
let fails = 0, n = 0;
const ok = (c, msg, x) => { n++; if (c) console.log('✓', msg, x !== undefined ? JSON.stringify(x) : ''); else { fails++; console.log('✗', msg, x !== undefined ? JSON.stringify(x) : ''); } };
const f = new URL('../src/engine/juggle_core.js', import.meta.url);
const { JUGGLE_PROT: PROT, JUGGLE_CORE: J } = vm.runInContext('"use strict";\n' + fs.readFileSync(f, 'utf8') + '\n;({ JUGGLE_PROT, JUGGLE_CORE })', vm.createContext({}), { filename: f.pathname });
const N = J.profile('normal'), E = J.profile('elite'), B = J.profile('boss');
// 参数表：档位越高越早进保护；二级在一级之后；单个怪物可以覆盖
ok(B.p1 < E.p1 && E.p1 < N.p1 && N.p2 > N.p1 && E.p2 > E.p1 && B.p2 > B.p1, '参数表：领主 < 精英 < 普通，二级在一级之后', { normal: [N.p1, N.p2], elite: [E.p1, E.p2], boss: [B.p1, B.p2] });
const O = J.profile('normal', { p1: 10, pt: { launch: 5 } });
ok(O.p1 === 10 && O.pt.launch === 5 && O.pt.hit === PROT.common.pt.hit && O.lv1.grav === PROT.common.lv1.grav, '怪物可以单独覆盖参数（其余沿用公共值）', { p1: O.p1, pt: O.pt });
// 站着挨打不算浮空点数
{ const S = J.session(); for (let i = 0; i < 200; i++) J.hit(S, N, { kind: 'stand', w: 1 }); ok(S.phase === 'stand' && S.pts === 0 && S.lv === 0, '站着挨打不累计浮空点数（平推再挑，挑空照样满高度）', S); }
// 保护线之前：再挑 / 接住 / 重力都不衰减（官方：保护线之前下落速度一样）
{ const S = J.session(); const ks = []; for (let i = 0; i < 6; i++) { const r = J.hit(S, N, { kind: 'launch', w: 1 }); ks.push(r.launchK); for (let k = 0; k < 5; k++) J.hit(S, N, { kind: 'air', w: 1 }); }
  ok(ks.every(k => k === 1) && J.grav(S, N, 1) === 1 && J.mods(S, N).catchK === 1 && S.lv === 0, '一级保护之前：连续 6 次再挑都是满浮空力，重力 ×1、接住 ×1', { ks, pts: S.pts, lv: S.lv }); }
// 满连：每 0.1 秒一下空中攻击 + 每 0.9 秒再挑 → 进一级 / 二级的时间点落在参数表算出来的区间
function fullCombo(P, w = 1) { const S = J.session(); let t1 = -1, t2 = -1; J.hit(S, P, { kind: 'launch', w });
  for (let i = 1; i <= 400; i++) { const T = i * 0.1; J.hit(S, P, { kind: 'air', w }); if (i % 9 === 0) J.hit(S, P, { kind: 'launch', w }); if (t1 < 0 && S.lv >= 1) t1 = +T.toFixed(1); if (t2 < 0 && S.lv >= 2) { t2 = +T.toFixed(1); break; } }
  return { t1, t2, S }; }
const rate = 10 * N.pt.hit + N.pt.launch / 0.9;   // 每秒点数
{ const r = fullCombo(N), e1 = N.p1 / rate, e2 = N.p2 / rate;
  ok(Math.abs(r.t1 - e1) < 0.35 && Math.abs(r.t2 - e2) < 0.35, `普通怪满连：约 ${e1.toFixed(1)} 秒进一级、${e2.toFixed(1)} 秒进二级`, { t1: r.t1, t2: r.t2 });
  const rb = fullCombo(B), re = fullCombo(E);
  ok(rb.t1 < re.t1 && re.t1 < r.t1 && rb.t2 < re.t2 && re.t2 < r.t2, '同样的连招：领主最早进保护，其次精英，普通怪最晚', { boss: [rb.t1, rb.t2], elite: [re.t1, re.t2], normal: [r.t1, r.t2] });
  const rh = fullCombo(N, 4); ok(rh.t1 < r.t1 * 0.6, '重怪（重量 4）更早进保护（阈值 ÷ 重量^0.5）', { heavy: rh.t1, normal: r.t1 }); }
// 一级：变沉、挑空 / 接住变弱，越接近二级越重；二级：挑不起来、接不住
{ const S = J.session(); J.hit(S, B, { kind: 'launch', w: 1 }); while (S.lv < 1) J.hit(S, B, { kind: 'air', w: 1 });
  const g1 = J.grav(S, B, 1), m1 = J.mods(S, B); while (J.level({ pts: S.pts + 1 }, B, 1) < 2) J.hit(S, B, { kind: 'air', w: 1 }); const g1b = J.grav(S, B, 1);
  ok(g1 >= 1.5 && g1b > g1 && m1.launchK < 1 && m1.catchK < 1 && m1.canLaunch, '一级保护：重力 ×1.6 起越来越重，挑空 / 接住变弱，还能再挑', { g1, g1b, m1 });
  const r = J.hit(S, B, { kind: 'launch', w: 1 });
  ok(r.lv === 2 && r.up && !r.canLaunch && r.catchK === 0 && J.grav(S, B, 1) >= 2.5, '二级保护：挑不起来、接不住、重力 ×3', { r, g: J.grav(S, B, 1) }); }
// 多段（rep）每段算半点；技能可以用 jp 指定
{ const S = J.session(); J.hit(S, N, { kind: 'launch', w: 1 }); const p0 = S.pts; J.hit(S, N, { kind: 'air', rep: true, w: 1 }); const pr = S.pts - p0; J.hit(S, N, { kind: 'air', jp: 4, w: 1 }); const pj = S.pts - p0 - pr;
  ok(pr === N.pt.rep && pj === 4, '多段每段算 0.5 点，jp 可以覆盖', { rep: pr, jp: pj }); }
// 倒地追击：按“一招”算，同一招的多段都打得完；第 5 招强制起身
{ const S = J.session(); J.land(S); const acts = [];
  for (let k = 1; k <= 4; k++) for (let s = 0; s < 6; s++) acts.push(J.otg(S, N, 100 + k).act);
  const fifth = J.otg(S, N, 105);
  ok(S.phase === 'ground' && acts.every(a => a === 'pop') && acts.length === 24 && fifth.act === 'getup', '追击按招数算：4 招 × 6 段全部托起，第 5 招才强制起身', { pops: acts.filter(a => a === 'pop').length, fifth: fifth.act }); }
{ const S = J.session(); J.land(S); const L = []; for (let i = 0; i < 5; i++) L.push(J.otg(S, N, null).act);
  ok(L.slice(0, 4).every(a => a === 'pop') && L[4] === 'getup', '没有出招标识（直接调用）的每下各算一招：第 5 下强制起身（和以前一样）', L); }
{ const S = J.session(); J.land(S); const L = [], K = []; for (let i = 0; i < 14; i++) { const r = J.otg(S, N, 7); L.push(r.act); K.push(+r.liftK.toFixed(2)); }
  ok(L.slice(0, N.otgSegMax).every(a => a === 'pop') && L.slice(N.otgSegMax).every(a => a === 'dmg'), `同一招最多托 ${N.otgSegMax} 段，之后只扣血不托`, L);
  ok(K.slice(1, N.otgSegMax).every((k, i) => k <= K[i]) && K[0] === 1 && Math.min(...K.slice(0, N.otgSegMax)) >= N.otgLiftMin, '追击托起越打越低（官方：最后只在地上抽动），不低于下限', K.slice(0, N.otgSegMax)); }
// 强制弹地一套最多 2 次
{ const S = J.session(); const L = [J.bounce(S, N), J.bounce(S, N), J.bounce(S, N)]; ok(L[0] && L[1] && !L[2], '技能强制弹地一套最多 2 次', L); }
// 倒地后被重新挑起：进 air2，点数接着算
{ const S = J.session(); J.hit(S, N, { kind: 'launch', w: 1 }); J.land(S); const p = S.pts; J.hit(S, N, { kind: 'launch', w: 1, ground: true }); ok(S.phase === 'air2' && S.pts > p, '倒地后再挑：进入二次浮空（air2），浮空点数接着累计', S); }
// 会话是纯 JSON
{ const S = J.session(); J.hit(S, N, { kind: 'launch', w: 1 }); J.otg(S, N, 3); ok(JSON.stringify(JSON.parse(JSON.stringify(S))) === JSON.stringify(S), '会话状态是纯 JSON（可以同步 / 存档）'); }
console.log(`\n${n - fails}/${n} 通过`); process.exit(fails ? 1 : 0);
