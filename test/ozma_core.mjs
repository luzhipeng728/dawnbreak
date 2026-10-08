// 奥兹玛团本核心规则单测（不开浏览器）：src/game/ozma_core.js 的 12 人队伍、阶段计时与事件
import fs from 'fs'; import vm from 'vm';
const src = fs.readFileSync(new URL('../src/game/ozma_core.js', import.meta.url), 'utf8') + '\nthis.OZMA_CORE = OZMA_CORE;';
const ctx = {}; vm.runInNewContext(src, ctx); const O = ctx.OZMA_CORE; let fail = 0;
const ok = (v, m, x) => { console.log(v ? '  ✓' : '  ✗', m, x || ''); if (!v) fail++; };
const ms = Array.from({ length: 12 }, (_, i) => ({ uid: 'u' + i, name: 'P' + i }));
const S = O.init(ms, 0, { seed: 7, rewardSeed: 'test' });
ok(S.members.length === 12, '12 人队伍'); S.members.forEach(m => { m.ready = true; });
let r = O.event(S, { t: 'start' }, 1); ok(S.phase === 0 && S.deadline === 1800001, 'P1 30 分钟计时');
for (const id of O.REGIONS) O.event(S, { t: 'clearRegion', id, chaos: 3 }, 2);
ok(S.phase2 && S.phase === 1, '三区域清除后解锁 P2');
O.event(S, { t: 'sanity', n: 100 }, 3); ok(S.inner && S.sanity === 50 && S.innerCount === 1, 'Sanity 归零进入 Inner World 并恢复 50');
O.event(S, { t: 'recover', n: 20 }, 4); ok(!S.inner && S.sanity === 70, '队伍协作恢复理智');
O.event(S, { t: 'oracle' }, 5); O.event(S, { t: 'oracle' }, 6); O.event(S, { t: 'oracle' }, 7); ok(S.oracle.uses === 3 && S.regions.ruin.st === 'open', 'Oracle 最多三次，第三次重置进度');
O.event(S, { t: 'bossDamage', amount: 0.5 }, 8); ok(S.throne.hp < 1, '共享王座血量');
O.event(S, { t: 'bossDamage', amount: 1 }, 9); ok(S.st === 'cleared', 'Boss 击破完成团本');
for (let i = 0; i < 3; i++) O.event(S, { t: 'flip' }, 10 + i); ok(S.flips.length === 3 && S.flips.every(x => x.pool), '三张翻牌奖励');
const T = O.init(ms.slice(0, 2), 0); T.members.forEach(m => { m.ready = true; }); O.event(T, { t: 'start' }, 1); O.event(T, { t: 'sanity', n: 100 }, 2); O.event(T, { t: 'recover', n: 50 }, 3); O.event(T, { t: 'sanity', n: 100 }, 4); ok(T.st === 'failed' && T.innerCount === 2, 'Sanity 二次归零团灭');
console.log(fail ? `✗ ${fail} 项失败` : '全部通过'); process.exit(fail ? 1 : 0);
