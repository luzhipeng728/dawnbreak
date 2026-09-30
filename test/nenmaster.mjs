// 气功师（格斗家 nenmaster，B4）机制测试：逐帧 step（确定性），约 30 秒。node test/nenmaster.mjs [shots]
//   orbs     念气环绕：0.5 秒内长满 5 颗、持续耗 MP、碰到敌人打中并补珠、每颗减伤；御：半径变大；再按关闭；MP 不够自动关
//   tiger    龙虎啸：普攻换成 5 段魔法（第 5 段感电）、跑攻 / 跳攻也换、移速 +15%；进地下城自动开龙虎啸 + 念气环绕、能量 500
//   gauge    风雷能量：技能命中按表积攒（每次施放只算一次）、≥500 才能开风雷啸、开启后狮子吼霸体 + 螺旋球 + 扣 200、耗尽自动关；HUD 小条挂上并画得出来
//   guard    念气罩：走 partyCast（联机同步）、罩内自己无敌 1.9 秒、走出罩就没有；队友收到别的房间的罩不生效
//   cannon   蓄念炮：点按 = 念气波（冷却 2.5 秒、不穿透）、按住蓄满 = 大念气团（冷却 6.5 秒、穿透 + 击倒）
//   blast    幻影爆碎：分身冲向敌人碰到就炸；再按（无动作）收回合体爆炸
//   awaken   金雷虎：骑乘升高、无敌、方向键改方向、落地 3 次冲击波；月华万象：吸怪 + 连按加段 + 之后能量锁满、风雷啸自动开；归一：升空、无敌、光轮爆炸
//   blade    奔雷螺旋击：钉住目标 1.5 秒后引爆；风雷啸 + 按住技能键延长（耗能量）；冲云念气场：← → 调落点
//   shots    关键技能的实机截图 → test/shots/nenmaster/*.png + 一张总览 contact.jpg
import { launch, URL_BASE } from './lib.mjs';
import fs from 'fs';
import { execFileSync } from 'child_process';
const arg = process.argv[2] || 'orbs,tiger,gauge,guard,cannon,blast,awaken,blade';
const want = new Set(arg.split(','));
let fail = 0;
const report = (name, ok, info) => { if (!ok) fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${JSON.stringify(info)}`); };
const { browser, page, logs } = await launch({ width: 1280, height: 720 });
await page.goto(`${URL_BASE}?test&cls=fighter&fighter=1&mobs=0&mute`); await page.waitForFunction(() => window.__READY, null, { timeout: 30000 });
await page.evaluate(() => {
  const p = game.player; game.job = 'nenmaster'; Object.assign((save.data.flags ??= {}), { awaken: true, awaken2: true, awaken3: true });
  onJobChange(p, 'nenmaster'); for (const id of classSkills('fighter', 'nenmaster')) game.skillLv[id] = Math.max(1, Math.min(SKILLS[id].maxLv || 5, 5)); cmdLabel('fighter');
  window.toastMsg = () => {}; game.skillLv.fn_nature = 0;   // 禅意·万象（能量回复 / 蓄念炮必满蓄）默认不学，单独测
  window.NT = {
    run: n => { for (let i = 0; i < n; i++) step(1 / 60); },
    reset(o = {}) { const p = game.player, R = game.room; for (const e of ents) if (e.team === 'e') e.remove = true; NT.run(1); clearAllSummons(); projs.length = 0; for (const k in input.virt) delete input.virt[k];
      Object.assign(p, { x: R ? (R.x0 + R.x1) / 2 - 150 : 300, y: 100, z: 0, vz: 0, vx: 0, vy: 0, cool: {}, mp: 1e5, mpMax: 1e5, mpRegen: 1, face: 1, invul: 0, hp: p.hpMax, _fnE: 500, superArmor: 0, ...o }); p.buffs = {}; p.act = null; p.setState('idle'); p.acts = fighterActs(p); },
    dummy(dx = 80, o = {}) { const p = game.player, m = spawnMonster('goblin', p.x + dx, p.y + (o.dy || 0)); m.control = null; m.hp = m.hpMax = 1e9; m.invul = 0; Object.assign(m, o.set || {}); return m; },
    hits: [], watch() { const o1 = window.applyHit; NT.hits = []; window.applyHit = function (a, t, h, o) { const r = o1.apply(this, arguments); if (r && a === game.player) NT.hits.push({ id: t.id, sk: h.fnSk || (a.act && a.act.skill) || (a.act && a.act.name), type: h.type || (o && o.type) || (a.act && a.act.type) || a.dmgType }); return r; }; NT.unwatch = () => { window.applyHit = o1; }; },
  };
});
if (want.has('orbs')) {
  const R = await page.evaluate(() => {
    game.paused = true; NT.reset(); const p = game.player;
    castSkill(p, 'fn_spiral'); NT.run(40);
    p.mpRegen = 1e-9; p.mp = 5000; const S = fnOrbs(p), n1 = S.n, mp0 = p.mp; NT.run(60); const drain = +(mp0 - p.mp).toFixed(1);
    NT.run(20); const taken = p.buffs.fn_spiral.taken;
    const m = NT.dummy(40); NT.watch(); NT.run(90); NT.unwatch(); const orbHits = NT.hits.filter(h => h.sk === 'fn_spiral').length, n2 = S.n;
    const r0 = fnOrbR(p); p.cool = {}; castSkill(p, 'fn_stone'); NT.run(40); const r1 = fnOrbR(p);
    p.cool = {}; castSkill(p, 'fn_spiral'); NT.run(20); const offByRecast = !p.buffs.fn_spiral;
    p.cool = {}; castSkill(p, 'fn_spiral'); NT.run(30); p.mp = 1; NT.run(40); const offByMp = !p.buffs.fn_spiral;
    return { n1, drain, taken, orbHits, n2, r0, r1, offByRecast, offByMp, allMag: true };
  });
  report('念气环绕：0.5 秒长满 5 颗、每秒耗 MP、每颗减伤 1.2%', R.n1 === 5 && R.drain > 2 && R.drain < 6 && Math.abs(R.taken + 0.06) < 1e-6, R);
  report('念气环绕：碰到敌人打中（1.5 秒 ≥3 次）、打完补满；御：半径 52 → 78', R.orbHits >= 3 && R.n2 >= 4 && R.r1 > R.r0 * 1.4, { orbHits: R.orbHits, n2: R.n2, r0: R.r0, r1: R.r1 });
  report('念气环绕：再按关闭、MP 不够自动关闭', R.offByRecast && R.offByMp, R);
}
if (want.has('tiger')) {
  const R = await page.evaluate(() => {
    game.paused = true; NT.reset(); const p = game.player, before = p.acts.atk1.hits[0].type || null;
    castSkill(p, 'fn_tiger'); NT.run(70); NT.run(20);
    const A = p.acts, chain = []; let a = A.atk1; while (a && chain.length < 8) { chain.push(a.name); a = a.next && A[a.next]; }
    const m = NT.dummy(70); NT.watch(); const st = [];
    for (const k of ['atk1', 'atk2', 'atk3', 'atk4', 'atk5']) { p.doAct(p.acts[k]); NT.run(40); }
    const shock5 = hasStatus(m, 'shock');
    NT.unwatch(); const types = [...new Set(NT.hits.map(h => h.type))];
    const mspd = +mspdOf(p).toFixed(2), dashTiger = !!p.acts.dash.fnTiger, jatkTiger = !!p.acts.jatk.fnTiger;
    // 进地下城：自动开龙虎啸 + 念气环绕，能量 500
    NT.reset({ _fnE: 20 }); fnEnter(p); NT.run(20); const enter = { tiger: !!p.buffs.fn_tiger, spiral: !!p.buffs.fn_spiral, e: p._fnE };
    NT.reset({ _fnE: 20 }); game.skillLv.fn_nature = 5; fnEnter(p); enter.eNature = p._fnE; game.skillLv.fn_nature = 0;
    return { before, chain, nHits: NT.hits.length, types, shock5, mspd, dashTiger, jatkTiger, enter };
  });
  report('龙虎啸：普攻 5 段、全部魔法、第 5 段感电、跑攻 / 跳攻也换、移速 +15%', R.chain.join() === 'atk1,atk2,atk3,atk4,atk5' && R.nHits >= 5 && R.types.join() === 'mag' && R.shock5 && R.dashTiger && R.jatkTiger && R.mspd >= 1.15, R);
  report('进地下城：自动开龙虎啸 + 念气环绕、风雷能量重置为 500（禅意·万象：1000）', R.enter.tiger && R.enter.spiral && R.enter.e === 500 && R.enter.eNature === 1000, R.enter);
}
if (want.has('gauge')) {
  const R = await page.evaluate(() => {
    game.paused = true; NT.reset({ _fnE: 0 }); const p = game.player;
    const m = NT.dummy(80); const g = [];
    castSkill(p, 'fn_legstrike'); NT.run(60); g.push(p._fnE);
    p.cool = {}; castSkill(p, 'fn_nencannon2'); NT.run(60); g.push(p._fnE);
    p.cool = {}; castSkill(p, 'fn_roar'); NT.run(70); g.push(p._fnE);
    const low = p._fnE; p.cool = {}; castSkill(p, 'fn_windstorm'); const wsLow = fnWS(p);
    p._fnE = 600; p.cool = {}; castSkill(p, 'fn_windstorm'); const wsOn = fnWS(p);
    p.cool = {}; castSkill(p, 'fn_roar'); const sa = p.act && p.act.superArmor === true, eAfter = p._fnE; NT.run(30); const balls = summonsOf(p, 'fn_wsball').length; NT.run(60);
    p._fnE = 100; p.cool = {}; castSkill(p, 'fn_roar'); const offByCost = !fnWS(p); NT.run(60);
    // HUD：小条挂到 ui.drawPanel 上，画一帧不报错
    fnPassive(p); let hudErr = null; try { ui.drawPanel(uctx); } catch (e) { hudErr = String(e); }
    return { g, low, wsLow, wsOn, sa, eAfter, balls, offByCost, hook: !!fnHudHook.on, hudErr };
  });
  report('风雷能量：命中按表积攒（雷霆踏 +70、雷霆念炮 +70、狮子吼 +100，每次施放只算一次）', R.g.join() === '70,140,240', R);
  report('风雷啸：<500 开不了、≥500 开启；狮子吼霸体 + 螺旋球 + 扣 200；不够扣自动关', !R.wsLow && R.wsOn && R.sa && R.eAfter === 400 && R.balls >= 1 && R.offByCost, R);
  report('HUD 风雷能量条挂上、画得出来', R.hook && !R.hudErr, { hook: R.hook, hudErr: R.hudErr });
}
if (want.has('guard')) {
  const R = await page.evaluate(() => {
    game.paused = true; NT.reset(); const p = game.player; let sent = null; const pc = window.partyCast; window.partyCast = function (k, d, src) { if (k === 'fn_guard') sent = { ...d }; return pc.apply(this, arguments); };
    castSkill(p, 'fn_guard'); NT.run(30); window.partyCast = pc;
    const zones = summonsOf(p, 'fn_guardzone').length; p.invul = 0; NT.run(2); const inv1 = p.invul > 0;
    p.x += 400; p.invul = 0; NT.run(2); const invOut = p.invul > 0; p.x -= 400;
    NT.run(120); p.invul = 0; NT.run(2); const invAfter = p.invul > 0;
    clearAllSummons(); partyOn.fx.fn_guard(p, { x: p.x, y: p.y, r: 180, t: 1.9, rk: '9,9' }); const other = summonsOf(p, 'fn_guardzone').length;
    partyOn.fx.fn_guard(p, { x: p.x, y: p.y, r: 180, t: 1.9, rk: fnRk() }); const same = summonsOf(p, 'fn_guardzone').length;
    return { sent, zones, inv1, invOut, invAfter, other, same };
  });
  report('念气罩：走 partyCast 同步（位置 / 半径 / 1.9 秒 / 房间）、罩内无敌、罩外 / 结束后没有', !!R.sent && R.sent.t === 1.9 && R.sent.r >= 178 && R.zones === 1 && R.inv1 && !R.invOut && !R.invAfter, R);
  report('念气罩：队友收到别的房间的罩不生效、同房间生效', R.other === 0 && R.same === 1, R);
}
if (want.has('cannon')) {
  const R = await page.evaluate(() => {
    game.paused = true; NT.reset(); const p = game.player; NT.dummy(80); NT.dummy(160);
    castSkill(p, 'fn_cannon', true, 'cmd'); NT.run(9); const tapProj = projs.filter(q => q.owner === p).map(q => ({ w: q.w, pierce: q.pierce })), tapCd = +p.cool.fn_cannon.toFixed(2); NT.run(40);
    NT.reset(); NT.dummy(80); NT.dummy(160); NT.watch(); input.virt.cmd = 1; castSkill(p, 'fn_cannon', true, 'cmd'); NT.run(70); delete input.virt.cmd; NT.run(4);
    const bigProj = projs.filter(q => q.owner === p).map(q => ({ w: Math.round(q.w), pierce: q.pierce })), fullCd = +(p.cool.fn_cannon + 74 / 60).toFixed(2); NT.run(60); NT.unwatch();
    const tgts = new Set(NT.hits.filter(h => h.sk === 'fn_cannon').map(h => h.id)).size;
    NT.reset(); game.skillLv.fn_nature = 5; castSkill(p, 'fn_cannon', true, 'cmd'); NT.run(9); const natProj = projs.filter(q => q.owner === p).map(q => ({ w: Math.round(q.w), pierce: q.pierce })); game.skillLv.fn_nature = 0;
    return { tapProj, tapCd, bigProj, tgts, fullCd, natProj, cdMul: +(p.cdMul || 1).toFixed(3) };
  });
  report('蓄念炮：点按 = 念气波（不穿透、冷却 2.5 秒）', R.tapProj.length === 1 && !R.tapProj[0].pierce && Math.abs(R.tapCd - 2.5 * R.cdMul) < 0.15, R);
  report('蓄念炮：按住蓄满 = 大念气团（穿透打到 2 个、冷却 6.5 秒）；禅意·万象：点按也满蓄', R.bigProj.length === 1 && R.bigProj[0].pierce && R.bigProj[0].w > 20 && R.tgts === 2 && Math.abs(R.fullCd - 6.5 * R.cdMul) < 0.15 && R.natProj.length === 1 && R.natProj[0].pierce, R);
}
if (want.has('blast')) {
  const R = await page.evaluate(() => {
    game.paused = true; NT.reset(); const p = game.player; NT.dummy(260); NT.watch();
    castSkill(p, 'fn_blast'); NT.run(10); const clones = fnClones(p).length; NT.run(120); const hit1 = NT.hits.filter(h => h.sk === 'fn_blast').length;
    NT.reset(); NT.dummy(500); p.cool = {}; castSkill(p, 'fn_blast'); NT.run(6); const alive = fnClones(p).length; NT.hits = []; const act0 = p.act;
    const recastOk = SKILLS.fn_blast.recast.ok(p), ok = castSkill(p, 'fn_blast'), actNone = p.act === act0; NT.dummy(30); NT.run(40); NT.unwatch();
    return { clones, hit1, alive, recastOk, ok, actNone, left: fnClones(p).length, merged: NT.hits.filter(h => h.sk === 'fn_blast').length };
  });
  report('幻影爆碎：分身冲向敌人、碰到就炸', R.clones >= 1 && R.hit1 >= 1, R);
  report('幻影爆碎：再按（无动作、不打断当前动作）收回分身、在身边合体爆炸', R.alive >= 1 && R.recastOk && R.ok && R.actNone && R.left === 0 && R.merged >= 1, R);
}
if (want.has('awaken')) {
  const R = await page.evaluate(() => {
    game.paused = true; NT.reset(); const p = game.player; const m = NT.dummy(120); NT.watch();
    const x0 = p.x; castSkill(p, 'fn_awaken'); let zMax = 0, invul = true, lands = 0; const cut = !!game.cutin;
    for (let i = 0; i < 240; i++) { NT.run(1); if (p.act && p.act.skill === 'fn_awaken' && p.actT > 0.6 && p.actT < 3.3) { zMax = Math.max(zMax, p.z); if (p.invul <= 0) invul = false; } if (i === 192) input.virt.left = 1; }
    delete input.virt.left; NT.run(90);
    const ride = { zMax: Math.round(zMax), invul, cut, hits: NT.hits.filter(h => h.sk === 'fn_awaken').length, turned: p.face === -1, endZ: Math.round(p.z) };
    // 月华万象：吸怪 + 连按 + 能量锁满 / 风雷啸
    NT.reset({ _fnE: 100 }); const far = NT.dummy(330); const d0 = Math.abs(far.x - (p.x + 180)); NT.hits = [];
    castSkill(p, 'fn_awaken2'); for (let i = 0; i < 175; i++) { if (i % 6 === 0 && i > 60) input.virt.attack = 2; NT.run(1); delete input.virt.attack; }
    const d1 = Math.abs(far.x - p.act.cx), mash = p.act.mash; NT.run(40);
    const sph = { d0: Math.round(d0), d1: Math.round(d1), mash, sparks: NT.hits.filter(h => h.sk === 'fn_awaken2').length, radiant: !!p.buffs.fn_radiant, e: p._fnE, ws: fnWS(p) };
    // 禅意·归一
    NT.reset(); NT.dummy(150); NT.hits = []; castSkill(p, 'fn_awaken3'); let z3 = 0, inv3 = true;
    for (let i = 0; i < 330; i++) { NT.run(1); if (p.act && p.act.skill === 'fn_awaken3' && p.actT > 0.2 && p.actT < 3.6) { z3 = Math.max(z3, p.z); if (p.invul <= 0) inv3 = false; } }
    NT.unwatch(); const zen = { z3: Math.round(z3), inv3, hits: NT.hits.filter(h => h.sk === 'fn_awaken3').length, endZ: Math.round(p.z) };
    return { ride, sph, zen };
  });
  report('金雷虎：骑乘升高（≥ 96）、骑乘无敌、插图、身体 + 落地 + 爆炸命中、方向键改方向、结束落回地面', R.ride.zMax >= 96 && R.ride.invul && R.ride.cut && R.ride.hits >= 6 && R.ride.turned && R.ride.endZ === 0, R.ride);
  report('月华万象：吸怪、连按加段（5 → 11）、之后能量锁满 + 风雷啸自动开', R.sph.d1 < R.sph.d0 * 0.5 && R.sph.mash >= 4 && R.sph.sparks >= 9 && R.sph.radiant && R.sph.e === 1000 && R.sph.ws, R.sph);
  report('禅意·归一：升空打坐、全程无敌、6 段 + 光轮爆炸', R.zen.z3 >= 80 && R.zen.inv3 && R.zen.hits >= 7 && R.zen.endZ === 0, R.zen);
}
if (want.has('blade')) {
  const R = await page.evaluate(() => {
    game.paused = true; NT.reset(); const p = game.player; const m = NT.dummy(80); NT.watch();
    castSkill(p, 'fn_blade'); NT.run(30); const held = hasStatus(m, 'hold'), x1 = m.x; NT.run(60); const still = Math.abs(m.x - x1) < 4; NT.run(60);
    const boom1 = NT.hits.filter(h => h.sk === 'fn_blade').length; NT.run(40);
    NT.reset({ _fnE: 900 }); const m2 = NT.dummy(80); p.cool = {}; castSkill(p, 'fn_windstorm'); p.cool = {}; input.virt.cmd = 1; castSkill(p, 'fn_blade', true, 'cmd'); const sa = p.act.superArmor === true;
    let dur = 0; for (let i = 0; i < 360 && p.act && p.act.skill === 'fn_blade'; i++) { NT.run(1); dur = p.actT; } delete input.virt.cmd;
    const ext = { dur: +dur.toFixed(2), e: Math.round(p._fnE) };
    // 冲云念气场：← → 调落点
    NT.reset(); p.cool = {}; castSkill(p, 'fn_pillar'); const px0 = p.act.px; input.virt.right = 1; NT.run(20); delete input.virt.right; const px1 = p.act.px; NT.run(60); NT.unwatch();
    return { held, still, boom1, sa, ext, px0: Math.round(px0), px1: Math.round(px1) };
  });
  report('奔雷螺旋击：钉住目标、1.5 秒后引爆', R.held && R.still && R.boom1 >= 1, R);
  report('奔雷螺旋击：风雷啸霸体 + 按住延长（耗能量）；冲云念气场：→ 把落点往前挪', R.sa && R.ext.dur > 4 && R.ext.e <= 900 - 200 && R.px1 > R.px0 + 50, R);
}
if (want.has('shots')) {
  const dir = 'test/shots/nenmaster'; fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  await page.evaluate(() => { game.paused = false; document.getElementById('ui') && (document.getElementById('ui').style.opacity = 1); });
  // [名字, 准备（在页面里执行的函数）, 施放后等多少秒截图, 截图方式]
  const SHOTS = [
    ['spiral', () => { NT.reset(); castSkill(game.player, "fn_spiral"); castSkill(game.player, "fn_tiger"); }, 1.4, null],
    ['tiger5', () => { NT.reset(); fnTigerOn(game.player, 5); NT.dummy(70); game.player.doAct(game.player.acts.atk5); }, 0.1, null],
    ['guard', () => { NT.reset(); NT.dummy(90); castSkill(game.player, "fn_guard"); }, 0.5, null],
    ['nencannon2', () => { NT.reset(); NT.dummy(160); castSkill(game.player, "fn_nencannon2"); }, 0.34, null],
    ['roar', () => { NT.reset(); NT.dummy(200); castSkill(game.player, "fn_roar"); }, 0.42, null],
    ['field', () => { NT.reset(); NT.dummy(90); castSkill(game.player, "fn_field"); }, 0.8, null],
    ['haitai', () => { NT.reset(); NT.dummy(360); castSkill(game.player, "fn_haitai"); }, 0.46, null],
    ['awaken', () => { NT.reset(); NT.dummy(200); castSkill(game.player, "fn_awaken"); }, 2.0, 'ride'],
    ['pillar', () => { NT.reset(); NT.dummy(150); castSkill(game.player, "fn_pillar"); }, 0.8, null],
    ['blade', () => { NT.reset({ _fnE: 900 }); NT.dummy(80); castSkill(game.player, "fn_windstorm"); game.player.cool = {}; castSkill(game.player, "fn_blade"); }, 0.9, null],
    ['moon', () => { NT.reset(); NT.dummy(160); castSkill(game.player, "fn_moon"); }, 0.7, null],
    ['awaken2', () => { NT.reset(); NT.dummy(260); NT.dummy(330, { dy: 40 }); castSkill(game.player, "fn_awaken2"); }, 1.9, null],
    ['tigerblast', () => { NT.reset(); NT.dummy(190); castSkill(game.player, "fn_tigerblast"); }, 1.0, null],
    ['awaken3', () => { NT.reset(); NT.dummy(160); castSkill(game.player, "fn_awaken3"); }, 2.5, null],
    ['gauge', () => { NT.reset({ _fnE: 760 }); game.player.cool = {}; castSkill(game.player, "fn_spiral"); castSkill(game.player, "fn_windstorm"); }, 0.8, 'hud'],
  ];
  const files = [];
  for (const [name, code, wait, mode] of SHOTS) {
    await page.evaluate(() => { game.paused = true; }); await page.evaluate(code); await page.evaluate(() => { game.paused = false; });
    const t0 = await page.evaluate(() => game.t);
    await page.waitForFunction(at => game.t >= at && !(game.timeStop > 0), t0 + wait, { timeout: 10000 }).catch(() => { });
    await page.evaluate(() => { game.paused = true; });
    const pos = await page.evaluate(() => { const p = game.player; return { x: (p.x - cam.x) * 1280 / 960, y: (FLOOR_Y + p.y - p.z) * 720 / 540 }; });
    const f = `${dir}/${name}.png`;
    const clip = mode === 'hud' ? { x: 0, y: 0, width: 1280, height: 720 } : { x: Math.max(0, Math.min(1280 - 640, pos.x - 200)), y: Math.max(0, Math.min(720 - 400, pos.y - (mode === 'ride' ? 240 : 300))), width: 640, height: 400 };
    await page.screenshot({ path: f, clip }); files.push(f);
    await page.evaluate(() => { game.paused = false; });
    await page.waitForTimeout(200);
  }
  try { execFileSync('python3', ['-c', `
import sys
from PIL import Image, ImageDraw
fs = sys.argv[1:]; W, H, cols = 480, 300, 4; rows = (len(fs) + cols - 1) // cols
sheet = Image.new('RGB', (cols * W, rows * H), (20, 20, 24)); d = ImageDraw.Draw(sheet)
for i, f in enumerate(fs):
    im = Image.open(f).convert('RGB'); im.thumbnail((W, H)); x, y = (i % cols) * W, (i // cols) * H; sheet.paste(im, (x, y)); d.text((x + 6, y + 4), f.split('/')[-1][:-4], fill=(255, 230, 120))
sheet.save('${dir}/contact.jpg', quality=82)
`, ...files]); console.log('shots →', `${dir}/contact.jpg`); } catch (e) { console.log('contact sheet failed', String(e).slice(0, 200)); }
}
const errs = logs.filter(l => l.type === 'pageerror' || l.type === 'error'); report('无报错', errs.length === 0, errs.slice(0, 3));
await browser.close();
console.log(fail ? `${fail} 项失败` : '全部通过');
process.exit(fail ? 1 : 0);
