// 奥兹玛团本地图单测（不开浏览器）：P1 三域各 5 张图的进图 / 小怪波次 / Boss 攻击与机制阶段 / 通关，及 P2 三个终局 Boss 的阶段清单
import fs from 'fs';
import vm from 'vm';

const src = fs.readFileSync(new URL('../src/game/ozma_core.js', import.meta.url), 'utf8') + '\nthis.OZMA_CORE = OZMA_CORE;';
const ctx = {};
vm.runInNewContext(src, ctx);
const O = ctx.OZMA_CORE;
let failed = 0;
const ok = (v, msg) => { if (!v) { failed++; console.error('  ✗', msg); } else console.log('  ✓', msg); };
const members = Array.from({ length: 6 }, (_, i) => ({ uid: i + 1, name: `P${i + 1}`, role: i < 2 ? 'support' : 'dps' }));
const S = O.init(members, 0, { seed: 77, difficulty: 'heroic' });
S.members.forEach(m => { m.ready = true; });
O.event(S, { t: 'start' }, 1);
ok(O.CONTENT.areas.ruin.maps.length === 5 && O.CONTENT.areas.despair.maps.length === 5 && O.CONTENT.areas.terror.maps.length === 5, 'P1 三个区域各有完整逐图清单');
ok(O.CONTENT.final.length === 3 && O.CONTENT.final.every(m => m.phases.length >= 2), 'P2 埃利诺 / 阿尔米斯 / 王座逐阶段清单');
for (const M of O.MAPS) {
  if (M.id.startsWith('p2_')) continue;
  S.maps[M.id].st = 'open';
  ok(O.event(S, { t: 'enterMap', id: M.id }, 2).out.some(x => x.kind === 'mapEnter'), `${M.name} 可进入（小怪 / 门将 / 主 Boss）`);
  for (let w = 0; w < M.waves.length; w++) ok(!O.event(S, { t: 'mapWave', id: M.id }, 3 + w).err, `${M.name} 小怪波次 ${w + 1}`);
  for (let p = 0; p < M.phases.length; p++) {
    ok(O.event(S, { t: 'bossAttack', id: M.id }, 10 + p).out.some(x => x.kind === 'bossAttack'), `${M.name} 攻击阶段 ${p + 1}`);
    ok(!O.event(S, { t: 'bossPhase', id: M.id, mechanic: p % M.mechanics.length }, 20 + p).err, `${M.name} 机制阶段 ${p + 1}`);
  }
  ok(O.event(S, { t: 'mapClear', id: M.id }, 40).out.some(x => x.kind === 'mapClear'), `${M.name} 通过失败条件后可通关`);
}
ok(S.phase2, 'P1 三域逐图清除后解锁 P2');
for (const M of O.CONTENT.final) {
  ok(O.event(S, { t: 'enterMap', id: M.id }, 50).out.some(x => x.kind === 'mapEnter'), `${M.name} 最终地图可进入`);
  for (let w = 0; w < M.waves.length; w++) O.event(S, { t: 'mapWave', id: M.id }, 51 + w);
  for (let p = 0; p < M.phases.length; p++) { O.event(S, { t: 'bossAttack', id: M.id }, 60 + p); O.event(S, { t: 'bossPhase', id: M.id, mechanic: p % M.mechanics.length }, 70 + p); }
  ok(O.event(S, { t: 'mapClear', id: M.id }, 80).out.some(x => x.kind === 'mapClear'), `${M.name} 最终地图通关`);
}
O.event(S, { t: 'groggy', seconds: 10 }, 90); O.event(S, { t: 'bossDamage', amount: 1 }, 91);
ok(S.st === 'cleared', '王座共享血量归零完成团本');

const F = O.init(members.slice(0, 2), 0); F.members.forEach(m => { m.ready = true; }); O.event(F, { t: 'start' }, 1);
F.maps.ruin_path.st = 'open'; O.event(F, { t: 'enterMap', id: 'ruin_path' }, 2);
for (let i = 0; i < 3; i++) { O.event(F, { t: 'mapFail', id: 'ruin_path', reason: 'wipe' }, 3 + i); if (i < 2) O.event(F, { t: 'enterMap', id: 'ruin_path' }, 4 + i); }
ok(F.maps.ruin_path.wipes === 3 && F.regions.ruin.chaos === 1, '地图连续团灭提高区域 Chaos 并重置地图');
const L = O.init(members.slice(0, 2), 0, { difficulty: 'legend' });
ok(L.scale.hp === 1.75 && L.scale.sanity === 1.5, '高难度提高血量和理智惩罚');
console.log(failed ? `✗ ${failed} 项失败` : '全部通过');
process.exit(failed ? 1 : 0);
