// 团本精英原语单测（不开浏览器）：6 种破防条件的纯逻辑 + 精英倒下 → 规则核心全局效果
import fs from 'fs'; import vm from 'vm';

const read = f => fs.readFileSync(new URL('../src/game/' + f, import.meta.url), 'utf8');
const ctx = {}; vm.runInNewContext(read('raid_core.js') + '\n' + read('raid_elite.js') + '\nthis.RAID_CORE = RAID_CORE; this.RAID_DEFS = RAID_DEFS; this.RAID_ELITE = RAID_ELITE; this.RAID_ELITES = RAID_ELITES; this.defineRaidElite = defineRaidElite; this.raidEliteSpec = raidEliteSpec;', ctx);
const { RAID_CORE: R, RAID_ELITE: X } = ctx; let fail = 0;
const ok = (v, m, x) => { console.log(v ? '  ✓' : '  ✗', m, x || ''); if (!v) fail++; };
const run = (E, sec, dt = 0.5) => { const out = []; for (let t = 0; t < sec - 1e-9; t += dt) out.push(...X.tick(E, dt)); return out; };
const kinds = (out, k, what) => out.filter(o => o.k === k && (!what || o.what === what));

console.log('— 通用');
ok(Object.keys(X.TYPES).sort().join() === 'breakShell,counterBreak,elemBall,eyeGuard,intercept,killClone', '6 种破防条件');
try { X.create({ type: 'nope' }); ok(false, '未知类型应报错'); } catch (e) { ok(true, '未知破防类型报错'); }
{
  const E = X.create({ id: 'e', type: 'elemBall', p: { every: 2 } });
  ok(E.p.need === 2 && E.p.every === 2 && X.mul(E) === E.p.shieldMul, '默认参数 + 覆盖；平时受护盾倍率', JSON.stringify(E.p));
}

console.log('— elemBall 属性球');
{
  const E = X.create({ id: 'devour', type: 'elemBall', p: { every: 3, ballN: 2, need: 2, life: 5, weakDur: 4 } });
  let out = run(E, 3);
  const balls = kinds(out, 'spawn', 'ball');
  ok(balls.length === 2 && balls[0].elem !== balls[1].elem && balls[0].col, '到时间吐 2 个属性球（元素不同）', JSON.stringify(balls));
  out = X.on(E, { k: 'ball', i: balls[0].i }); ok(!kinds(out, 'break').length && X.view(E).bar.label.includes('1/2'), '打碎 1 个：进度 1/2');
  out = X.on(E, { k: 'ball', i: balls[1].i });
  ok(kinds(out, 'break').length === 1 && X.mul(E) === E.p.weakMul && X.view(E).weak, '打碎 need 个：破防，受伤 ×weakMul');
  out = run(E, 4.5); ok(kinds(out, 'unbreak').length === 1 && X.mul(E) === E.p.shieldMul, 'weakDur 到了：恢复护盾');
  // 不打：life 秒后被吸收回血
  const F = X.create({ id: 'f', type: 'elemBall', p: { every: 1, ballN: 1, life: 2 } });
  out = run(F, 3.5); ok(kinds(out, 'heal').length >= 1 && kinds(out, 'expire').length >= 1, '没打碎的球被精英吸收：回血', JSON.stringify(kinds(out, 'heal')));
  ok(X.on(F, { k: 'ball', i: 999 }).length === 0, '不存在的球忽略');
}

console.log('— intercept 拦截球');
{
  const E = X.create({ id: 'nel', type: 'intercept', p: { every: 2, orbN: 1, travel: 3, need: 2 } });
  let out = run(E, 2); const o1 = kinds(out, 'spawn', 'orb')[0];
  out = X.on(E, { k: 'intercept', i: o1.i }); ok(!kinds(out, 'break').length, '拦截 1 个：还没破防');
  out = run(E, 2); const o2 = kinds(out, 'spawn', 'orb')[0];
  out = X.on(E, { k: 'intercept', i: o2.i }); ok(kinds(out, 'break').length === 1, '连续拦截 2 个：破防');
  const F = X.create({ id: 'f', type: 'intercept', p: { every: 2, orbN: 1, travel: 1, need: 2 } });
  out = run(F, 2); const a = kinds(out, 'spawn', 'orb')[0]; X.on(F, { k: 'intercept', i: a.i });
  out = run(F, 3); ok(kinds(out, 'heal').length >= 1 && F.streak === 0, '漏球：回血并清零连续数', JSON.stringify(kinds(out, 'heal')));
}

console.log('— killClone 击杀分身');
{
  const E = X.create({ id: 'frey', type: 'killClone', p: { every: 3, cast: 4, cloneN: 2, punish: 0.5 } });
  let out = run(E, 3); const cl = kinds(out, 'spawn', 'clone');
  ok(cl.length === 2 && kinds(out, 'cast').length === 1, '读条开始 + 刷 2 个分身');
  X.on(E, { k: 'cloneDead', i: cl[0].i }); out = X.on(E, { k: 'cloneDead', i: cl[1].i });
  ok(kinds(out, 'interrupt').length === 1 && kinds(out, 'break').length === 1, '读条前杀光：打断 + 破防');
  const F = X.create({ id: 'f', type: 'killClone', p: { every: 1, cast: 2, cloneN: 1, punish: 0.4 } });
  out = run(F, 3.5); const pun = kinds(out, 'punish');
  ok(pun.length === 1 && pun[0].frac === 0.4 && kinds(out, 'expire', 'clone').length === 1, '没杀完：读条结束 → 惩罚，分身消失', JSON.stringify(pun));
}

console.log('— breakShell 破壳');
{
  const E = X.create({ id: 'hatch', type: 'breakShell', p: { shells: 2, hits: 3, regen: 5, weakDur: 3 } });
  let out = X.tick(E, 0); const sh = kinds(out, 'spawn', 'shell');
  ok(sh.length === 2 && sh[0].hits === 3, '开场带 2 个龟壳（每个 3 下）', JSON.stringify(sh));
  ok(X.mul(E) === E.p.shieldMul && X.view(E).bar.label.includes('2/2'), '壳在：护盾');
  X.on(E, { k: 'shellBroken', i: sh[0].i }); out = X.on(E, { k: 'shellBroken', i: sh[1].i });
  ok(kinds(out, 'break').length === 1 && X.mul(E) === E.p.weakMul, '全碎：破防');
  out = run(E, 3.5); ok(kinds(out, 'unbreak').length === 1, '破防结束');
  out = run(E, 5.5); ok(kinds(out, 'spawn', 'shell').length === 2, 'regen 秒后龟壳重新长出来');
}

console.log('— eyeGuard 睁眼禁攻');
{
  const E = X.create({ id: 'agnes', type: 'eyeGuard', p: { closed: 2, open: 4, cloneN: 2, reflect: 0.2, punish: 0.5 } });
  let out = X.on(E, { k: 'hitEye' }); ok(out.length === 0, '闭眼时攻击没事');
  out = run(E, 2);
  ok(kinds(out, 'reflect')[0].on === true && kinds(out, 'spawn', 'clone').length === 2, '睁眼 + 刷分身');
  out = X.on(E, { k: 'hitEye', who: 'u7' }); ok(out[0].k === 'punish' && out[0].id === 'eyeReflect' && out[0].who === 'u7' && out[0].frac === 0.2, '睁眼期间攻击：反伤（点名攻击者）', JSON.stringify(out));
  const cl = [...E.objs]; X.on(E, { k: 'cloneDead', i: cl[0].i }); out = X.on(E, { k: 'cloneDead', i: cl[1].i });
  ok(kinds(out, 'reflect')[0].on === false && kinds(out, 'break').length === 1, '杀光分身：闭眼 + 破防');
  const F = X.create({ id: 'f', type: 'eyeGuard', p: { closed: 1, open: 2, cloneN: 1, punish: 0.5 } });
  out = run(F, 3.5); ok(kinds(out, 'punish').some(o => o.id === 'eyeOpen' && o.frac === 0.5) && kinds(out, 'reflect').some(o => o.on === false), '睁眼时间到还有分身：全团惩罚并闭眼');
}

console.log('— counterBreak 破招');
{
  const E = X.create({ id: 'ozma', type: 'counterBreak', p: { every: 2, windup: 2.4, flashAt: 1.4, flashLen: 0.7, punish: 0.3 } });
  let out = run(E, 2); ok(kinds(out, 'cast').length === 1, '起手');
  out = X.on(E, { k: 'hit' }); ok(!kinds(out, 'break').length && E.wind, '窗口前命中：没用');
  run(E, 1.5); ok(X.view(E).bar.label.includes('闪光'), '闪光窗口显示');
  out = X.on(E, { k: 'hit' }); ok(kinds(out, 'interrupt').length === 1 && kinds(out, 'break').length === 1, '窗口内命中：打断 + 破防');
  const F = X.create({ id: 'f', type: 'counterBreak', p: { every: 1, windup: 2 } });
  out = run(F, 3.5); ok(kinds(out, 'punish').length === 1, '没打断：招式落下');
}

console.log('— 登记表 + 击杀影响团本全局');
{
  ctx.defineRaidElite('testGate', { name: '门之精英', mon: 'x', type: 'breakShell', p: { shells: 1 } });
  ok(ctx.raidEliteSpec('testGate').type === 'breakShell' && ctx.raidEliteSpec({ type: 'eyeGuard' }).type === 'eyeGuard' && ctx.raidEliteSpec('nope') === null, '登记 / 按 id 或内联取 spec');
  try { ctx.defineRaidElite('bad', { type: 'zzz' }); ok(false, '登记未知类型应报错'); } catch (e) { ok(true, '登记未知类型报错'); }
  // 用一个测试团本：精英房击杀 → 打开隐藏图、全团增益、倒计时
  ctx.RAID_DEFS.edef = { id: 'edef', name: '精英测试', minLvl: 1, orderMax: 4, limits: { day: 9, week: 9 }, duoMax: 2, teamSize: 2, minPlayers: 4, maxTeams: 2, maxPlayers: 4, lives: { normal: 6, guide: 3 }, perNode: { normal: 6, guide: 4 }, erosion: { normal: 60, guide: 10 }, rest: 300,
    subAfter: 180, subWindow: 90, guard: { minClear: 0, maxDrop: 0 }, lvl: { node: 1, final: 1 },
    phases: [{ id: 1, name: 'P', limit: { normal: 600, guide: 600 }, goal: ['fin'], nodes: {
      room: { name: '精英房', type: 'main', area: 1, pos: [0.1, 0.5], need: [], elites: { devour: { fx: [{ kind: 'unlock', to: 'secret' }, { kind: 'gbuff', id: 'devour', p: { atk: 0.3 }, dur: 20 }, { kind: 'countdown', to: 'cd', sec: 40 }] } } },
      secret: { name: '隐藏', type: 'main', area: 2, pos: [0.5, 0.2], need: ['room'] },
      cd: { name: '倒计时', type: 'timer', area: 2, pos: [0.5, 0.8], need: [], timer: 100, repair: 10 },
      fin: { name: '终', type: 'main', area: 3, pos: [0.9, 0.5], need: ['secret'] } } }], rewards: { cur: 'x', p1: [{ cur: [1, 1] }] } };
  const S = R.init('edef', [{ uid: 1, name: 'A' }], 'guide', 0, { sid: 'e1', seed: 1, guard: { minClear: 0, maxDrop: 0 } });
  R.event(S, { t: 'start', uid: 1 }, 1000);
  let o = R.event(S, { t: 'enter', uid: 1, node: 'room' }, 2000); const run1 = o.ack.run;
  const E = X.create({ id: 'devour', type: 'elemBall' }), rep = X.done(E);
  ok(rep.e === 'elite' && rep.v === 'devour' && E.dead, '精英倒下 → 上报 { e: elite, v: id }');
  o = R.event(S, { t: rep.e, uid: 1, run: run1, node: 'room', v: rep.v }, 3000);
  ok(!o.err && S.nodes.secret.st === 'open' && S.gbuffs.some(b => b.id === 'devour') && S.nodes.cd.timer === 3000 + 40000, '击杀精英：开隐藏图 + 全团增益 + 倒计时', o.err || JSON.stringify(S.nodes.cd));
  ok(R.view(S).keys !== undefined && R.view(S).gbuffs[0].p.atk === 0.3, '视图里能看到全团增益');
}

console.log(fail ? `✗ ${fail} 项失败` : '全部通过'); process.exit(fail ? 1 : 0);
