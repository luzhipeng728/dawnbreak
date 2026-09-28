// 远古地下城的机制测试（content/regions/ancient_rooms.js）：每个房间的机关都要能触发、也要能解开
//   node test/ancient.mjs [bilmark,wailing]      截图在 test/shots/ancient/
// 比尔马克帝国试验场（牛头）：伊凡召唤 / 引信自爆 / 路障挡人 / 清完 12 只路障炸开 / 上校变红自爆；统帅房柱子召唤 + 减伤 + 拆柱子；哈尼克倔强；猫妖狂暴；
//   牛头械王：倒地起身三道落雷（打中 + 感电）、罪恶之眼激光、保护模式（无敌 + 机器人 + 吼叫眩晕 / 跳起来躲开 + 超时变牛头统帅 + 清完解除）
// 悲鸣洞穴（虫穴）：法阵保护（打不到）+ 队长活着队员回血 + 队长倒下队员逃散；魔剑出土、超时盗墓者发狂 / 限时打掉；凯恩的跟随光阵；
//   幼虫吞噬 → 成虫、法阵核心打碎；虫王钻地破土的旋风、进食阶段（无敌 + 幼虫爬到洞口被吃掉回血 + 清完幼虫解除）
import { launch, URL_BASE } from './lib.mjs';
import fs from 'fs';
const parts = (process.argv[2] || 'bilmark,wailing').split(',');
const out = 'test/shots/ancient'; fs.mkdirSync(out, { recursive: true });
const speed = 3;
let fail = 0;
const check = (ok, msg, extra = '') => { console.log(ok ? '  ✓' : '  ✗', msg, ok ? '' : extra); if (!ok) fail++; return ok; };
const { browser, page, logs } = await launch({ width: 1280, height: 720 });
const ev = (f, a) => page.evaluate(f, a);
const wait = ms => page.waitForTimeout(ms);
const simWait = s => wait(Math.round(s * 1000 / speed) + 60);
const shot = n => page.screenshot({ path: `${out}/${n}.png` });
const S = () => ev(() => ({ ...ANC.stats }));
async function enter(id) {
  await page.goto(`${URL_BASE}?town&mute&cls=sword`); await page.waitForFunction(() => window.__READY && game.player && game.scene === 'town', null, { timeout: 30000 });
  await ev(({ id, speed }) => {
    game.speedMul = speed; for (const w of ['help', 'guide']) if (menus.isOpen(w)) menus.close(w);
    testLoadout(DUNGEONS[id].lvl[1]); save.data.fatigue = 999; save.data.questDone[DUNGEONS[id].unlock.quest] = Date.now();
    window.__keep = setInterval(() => { const q = game.player; if (window.__noKeep) return; q.hp = q.hpMax; q.mp = q.mpMax; q.dead = false; }, 40);
    enterDungeon(id, 0);
  }, { id, speed });
  await page.waitForFunction(id => game.scene === 'dungeon' && game.dungeon && game.dungeon.def.id === id, id, { timeout: 20000 });
  await simWait(0.5);
}
// 直接进第 gx 个房间（前面的房间算作清过）
const toRoom = gx => ev(gx => { const dg = game.dungeon, r = dg.layout.rooms.find(r => r.gx === gx); for (const o of dg.layout.rooms) if (o.gx < gx) { o.visited = true; o.cleared = true; } const p = game.player; p.invul = 0; dg.enter(r, 'left'); return { type: r.type, W: game.room.x1 }; }, gx);
const kinds = () => ev(() => ents.filter(e => e.team === 'e' && !e.dead && !e.remove).map(e => e.kind));
const killAll = (f = '') => ev(f => { const test = f ? new Function('e', 'return ' + f) : () => true; for (const e of [...ents]) if (e.team === 'e' && !e.dead && !e.remove && !e.boss && test(e)) { e.invul = 0; e.hp = 0; killEnt(e, game.player, {}); } drops.length = 0; }, f);
const R = () => game.dungeon.ancRoom;

/* ======================= 比尔马克帝国试验场 ======================= */
if (parts.includes('bilmark')) {
  console.log('· 比尔马克帝国试验场');
  await enter('bilmark');
  const lay = await ev(() => ({ n: game.dungeon.layout.rooms.length, line: game.dungeon.layout.rooms.every(r => r.gy === game.dungeon.layout.rooms[0].gy), boss: game.dungeon.layout.boss.gx }));
  check(lay.n === 6 && lay.line && lay.boss === 5, `一条直线 6 个房间（${JSON.stringify(lay)}）`);
  const k0 = await kinds();
  check(k0.length === 6 && k0.every(k => k === 'bloodCat'), `R0：嗜血猫妖 ×6（${k0}）`);
  // R1 伊凡房
  await toRoom(1); await simWait(0.3);
  const r1 = await ev(() => { const r = game.dungeon.ancRoom; return { pillars: r.pillars.length, inv: r.pillars.every(p => p.invul > 1e6 && p.botSkip), bar: !!r.bar && r.bar.invul > 1e6 }; });
  check(r1.pillars === 4 && r1.inv && r1.bar, 'R1：4 根打不动的召唤柱 + 路障');
  await ev(() => { const p = game.player; p.x = game.dungeon.ancRoom.bar.x + 120; });
  await simWait(0.2);
  check(await ev(() => game.player.x <= game.dungeon.ancRoom.bar.x - 39), '路障挡住玩家');
  await ev(() => { game.player.x = 200; });
  await simWait(4);
  let s = await S();
  check((s.ivanSummon || 0) >= 2, `柱子召唤疯狂伊凡（${s.ivanSummon}）`);
  await ev(() => { const v = game.dungeon.ancRoom.ivans.find(v => !v.dead); v.ancFuse = 0.05; game.player.x = v.x + 40; game.player.y = v.y; window.__noKeep = true; window.__hp0 = game.player.hp = game.player.hpMax; });
  await simWait(1.2);
  s = await S(); const hurt = await ev(() => { window.__noKeep = false; return __hp0 - game.player.hp; });
  check((s.ivanBoom || 0) >= 1 && hurt > 0, `伊凡引信到时自爆（伤害 ${Math.round(hurt)}）`);
  await shot('b1-ivan');
  await ev(() => { const r = game.dungeon.ancRoom; r.summoned = r.quota; });
  await killAll("e.kind === 'ivan'"); await simWait(0.6);
  s = await S();
  const r1b = await ev(() => { const r = game.dungeon.ancRoom; return { pillarsDown: r.pillars.every(p => p.dead), bar: !!r.bar.dead, col: !!r.col && !r.col.dead }; });
  check(s.barricadeOpen === 1 && r1b.pillarsDown && r1b.bar && r1b.col, `12 只清完：柱子熄灭、路障炸开、伊凡上校出场 ${JSON.stringify(r1b)}`);
  await ev(() => { const c = game.dungeon.ancRoom.col; c.hp = Math.round(c.hpMax * 0.3); }); await simWait(0.3);
  s = await S(); check(s.colonelRed === 1, '上校残血变红开始倒计时');
  await ev(() => { game.dungeon.ancRoom.col.ancFuse = 0.05; }); await simWait(1.2);
  s = await S(); check(s.colonelBoom === 1 && await ev(() => game.dungeon.ancRoom.col.dead), '倒计时到了上校自爆');
  await killAll(); await simWait(0.8);
  check(await ev(() => game.dungeon.room.cleared), 'R1 清房');
  // R2 统帅房
  await toRoom(2); await simWait(3);
  s = await S();
  const r2 = await ev(() => { const r = game.dungeon.ancRoom; return { mul: r.cmd.dmgTakenMul, pillars: r.pillars.filter(p => !p.dead).length }; });
  check((s.calfSummon || 0) >= 1 && r2.pillars === 2 && r2.mul === 0.3, `R2：柱子召唤幼小牛头（${s.calfSummon}），两根柱子都在时统帅伤害 ×${r2.mul}`);
  await killAll("e.kind !== 'bmPillarB'"); await simWait(0.6);
  check(!(await ev(() => game.dungeon.room.cleared)), '柱子还在：房间不算清完（门不开）');
  await killAll("e.kind === 'bmPillarB' && e.x < game.room.x1 / 2"); await simWait(0.3);
  check(await ev(() => game.dungeon.ancRoom.cmd.dead || game.dungeon.ancRoom.cmd.dmgTakenMul === 0.6), '拆掉一根：减伤变弱');
  await killAll(); await simWait(0.8);
  s = await S(); check(s.pillarBroken === 2 && await ev(() => game.dungeon.room.cleared), '拆掉两根柱子 + 清怪 → 清房');
  // R3 哈尼克
  await toRoom(3); await simWait(0.3);
  await ev(() => { const H = game.dungeon.ancRoom.boss; H.hp = Math.round(H.hpMax * 0.35); }); await simWait(0.4);
  s = await S(); const r3 = await ev(() => { const H = game.dungeon.ancRoom.boss; return { sa: H.superArmor > 0, cats: ents.filter(e => e.kind === 'fickleCat' && !e.dead).length }; });
  check(s.hanikStubborn === 1 && r3.sa && r3.cats >= 8, `R3：哈尼克残血倔强（霸体、叫来猫妖 ${r3.cats}）`);
  await killAll(); await simWait(0.8);
  // R4 猫妖狂暴
  await toRoom(4); await simWait(0.3);
  await killAll("e === game.dungeon.ancRoom.cats[0]"); await simWait(0.3);
  s = await S(); check(s.catFrenzy === 1 && await ev(() => game.dungeon.ancRoom.cats[1].ancRage === 1), 'R4：同伴倒下，其他嗜血猫妖狂暴');
  await killAll(); await simWait(0.8);
  // R5 牛头械王
  await toRoom(5); await simWait(1.5);
  const b0 = await ev(() => { const b = game.dungeon.boss; return { kind: b.kind, hook: b.def_.hook }; });
  check(b0.kind === 'mechKing' && b0.hook === 'mechKing', '领主牛头械王（手写钩子）');
  await shot('b5-boss');
  // 倒地起身 → 三道落雷（站在它前面挨打 + 感电）
  await ev(() => { const b = game.dungeon.boss, p = game.player; b.x = 500; b.face = 1; b.aiCd = 99; p.x = 700; p.y = DEPTH * 0.5; p.status = {}; b.setState('down'); });
  await simWait(1.2); await ev(() => { const b = game.dungeon.boss; b.setState('idle'); });
  await simWait(0.3); const tele = await ev(() => groundFx.filter(g => g.kind === 'line').length);
  await simWait(1.3);
  s = await S(); const shock = await ev(() => !!(game.player.status && game.player.status.shock));
  const pl = await ev(() => { const p = game.player; return { x: Math.round(p.x), y: Math.round(p.y), st: p.st, inv: p.invul, bx: Math.round(game.dungeon.boss.x), face: game.dungeon.boss.face }; });
  check(s.lanes >= 1 && tele >= 3 && s.laneHit >= 1 && shock, `倒地起身：三道落雷（预警 ${tele}），前方的人被打中并感电`, JSON.stringify({ ...pl, lanes: s.lanes, hit: s.laneHit, shock }));
  await ev(() => { const p = game.player; p.status = {}; p.x = 300; const b = game.dungeon.boss; b.anc.eye = 0; });
  await simWait(3.2);
  s = await S(); check(s.eyes >= 1 && s.eyeLaser >= 2, `罪恶之眼：两只眼睛放激光（${s.eyeLaser}）`);
  await shot('b5-eye');
  // 保护模式
  await ev(() => { const b = game.dungeon.boss, p = game.player; p.z = 0; p.vz = 0; p.status = {}; b.hp = Math.round(b.hpMax * 0.58); });
  await simWait(0.8);
  s = await S();
  const pm = await ev(() => { const b = game.dungeon.boss, st = b.msMechs.find(s => s.id === 'invuln' && !s.done); const h0 = b.hp; b.invul = 0; applyHit(game.player, b, { dmg: 30, sure: true }, { proj: true }); return { on: !!st, robots: st ? st.objs.filter(o => !o.dead && o.kind === 'bmRobot').length : 0, dmg: h0 - b.hp, skip: !!b.botSkip }; });
  check(s.protectMode === 1 && pm.on && pm.robots === 3 && pm.dmg <= 0 && pm.skip, `保护模式：无敌（伤害 ${pm.dmg}）、召出 3 个机器人`);
  check(s.roarStun >= 1, '全屏吼叫：站在地上的人被眩晕');
  await shot('b5-protect');
  await ev(() => { const st = game.dungeon.boss.msMechs.find(s => s.id === 'invuln' && !s.done); st.ancT = 0.05; });
  await simWait(0.6);
  s = await S(); const morph = await ev(() => { const st = game.dungeon.boss.msMechs.find(s => s.id === 'invuln' && !s.done); return { on: !!st, cmd: ents.filter(e => e.kind === 'tauCommander' && !e.dead).length }; });
  check(s.robotMorph === 3 && morph.on && morph.cmd === 3, `超时没清掉：机器人变成牛头统帅（${morph.cmd}），保护模式还在`);
  await killAll(); await simWait(0.8);
  const off = await ev(() => { const b = game.dungeon.boss, h0 = b.hp; b.invul = 0; applyHit(game.player, b, { dmg: 30, sure: true }, { proj: true }); return { on: b.msMechs.some(s => s.id === 'invuln' && !s.done), dmg: h0 - b.hp }; });
  check(!off.on && off.dmg > 0, `清掉以后保护模式解除（伤害 ${off.dmg}）`);
  // 第二次保护模式：跳起来躲开吼叫
  await ev(() => { const b = game.dungeon.boss, p = game.player; p.status = {}; p.z = 60; p.vz = 300; p.setState('air'); b.hp = Math.round(b.hpMax * 0.2); });
  await simWait(0.5);
  s = await S(); check(s.protectMode === 2 && s.roarDodge >= 1, '第二次保护模式：跳在空中躲开了吼叫');
  await killAll(); await simWait(0.6);
  await ev(() => { const b = game.dungeon.boss; for (const s of b.msMechs) msMechEnd(b, s); b.invul = 0; b.hp = 1; applyHit(game.player, b, { dmg: 50, sure: true }, { proj: true }); });
  await simWait(3);
  check(await ev(() => game.dungeon.state === 'result' || menus.isOpen('result')), '打倒牛头械王 → 通关');
}

/* ======================= 悲鸣洞穴 ======================= */
if (parts.includes('wailing')) {
  console.log('· 悲鸣洞穴');
  await enter('wailing_cave');
  const k0 = await kinds();
  check(k0.length === 8 && k0.every(k => k === 'jungleZombie'), `R0：丛林僵尸 ×8（${k0.length}）`);
  // R1 法布罗
  await toRoom(1); await simWait(0.4);
  const r1 = await ev(() => { const r = game.dungeon.ancRoom, C = r.circles[0], m = r.mem[0]; m.x = C.x; m.y = C.y; const out = r.mem[1]; out.x = 200; out.y = DEPTH / 2; return { cap: !!r.cap, mem: r.mem.length, core: !!C.core }; });
  await simWait(0.2);
  const inv = await ev(() => { const r = game.dungeon.ancRoom, a = r.mem[0], b = r.mem[1]; return { a: !!a.ancShield && a.invul > 0 && !!a.botSkip, b: !b.ancShield && b.invul <= 0 }; });
  check(r1.cap && r1.mem === 4 && r1.core && inv.a && inv.b, `R1：紫色法阵里的队员打不到（无敌 + 机器人不打），法阵外的能打 ${JSON.stringify(inv)}`);
  const h0 = await ev(() => { const b = game.dungeon.ancRoom.mem[1]; b.hp = Math.round(b.hpMax * 0.5); return b.hp; });
  await simWait(1.5);
  check(await ev(h0 => game.dungeon.ancRoom.mem[1].hp > h0, h0), '队长活着：队员回血');
  await killAll("e === game.dungeon.ancRoom.cap"); await simWait(0.4);
  let s = await S(); check(s.captainDown === 1 && s.circleBroken === 1, '队长倒下：法阵核心碎掉');
  await simWait(2.8);
  s = await S(); check((s.memberFled || 0) >= 1 && (await kinds()).filter(k => k === 'fabroMember').length === 0, `队员四散逃跑（${s.memberFled}）`);
  await killAll(); await simWait(0.8);
  check(await ev(() => game.dungeon.room.cleared), 'R1 清房');
  // R2 魔剑阿波菲斯：超时 → 盗墓者发狂
  await toRoom(2); await simWait(3.6);
  s = await S(); check(s.apophisRise === 1 && await ev(() => !!game.dungeon.ancRoom.sword && !game.dungeon.ancRoom.sword.dead), 'R2：盗墓者挖出了魔剑阿波菲斯');
  await shot('w2-apophis');
  await ev(() => { const r = game.dungeon.ancRoom; for (const e of r.diggers) e.hp = Math.round(e.hpMax * 0.3); r.swordT = 0.05; }); await simWait(0.4);
  s = await S(); const rage = await ev(() => game.dungeon.ancRoom.diggers.filter(e => !e.dead).every(e => e.hp === e.hpMax));
  check(s.diggerRage === 1 && rage, '20 秒没打掉魔剑：盗墓者回满血发狂');
  await killAll(); await simWait(0.8);
  // R3 凯恩：跟着人走的光阵
  await toRoom(3); await simWait(0.4);
  const kn = await ev(() => { const k = game.dungeon.ancRoom.kain; k.x = game.player.x + 150; const n0 = groundFx.length; monForceSkill(k, 'aoe'); return { kind: k.kind, n0 }; });
  await simWait(1.2);
  const fol = await ev(() => groundFx.some(g => g.follow));
  check(kn.kind === 'kain' && fol, 'R3：骷髅凯恩的光阵跟着玩家走');
  await killAll(); await simWait(0.8);
  // R4 幼虫吞噬 → 成虫
  await toRoom(4); await simWait(0.3);
  const r4 = await ev(() => { const r = game.dungeon.ancRoom; return { circles: r.circles.length, larvae: ents.filter(e => e.kind === 'larva' && !e.dead).length }; });
  check(r4.circles === 2 && r4.larvae === 10, `R4：两个法阵 + 10 只幼虫`);
  await ev(() => { const L = ents.filter(e => e.kind === 'larva' && !e.dead && !e.remove); for (const e of L) { e.control = m => { m.vx = m.vy = 0; }; } const [a, b, c] = L; a.x = b.x = c.x = 700; a.y = b.y = c.y = 150; for (const e of L.slice(3)) { e.x = 200 + Math.random() * 100; e.y = 40 + Math.random() * 200; } });
  await simWait(4.5);
  s = await S(); check((s.larvaEat || 0) >= 2 && (s.larvaAdult || 0) >= 1 && (await kinds()).includes('adultBug'), `幼虫互相吞噬（${s.larvaEat}），吃满两只长成戮蛊成虫`);
  await shot('w4-adult');
  await killAll("e.kind === 'wcCore'"); await simWait(0.3);
  s = await S(); check(s.circleBroken >= 2, '打碎两个法阵核心');
  await killAll(); await simWait(0.8);
  check(await ev(() => game.dungeon.room.cleared), 'R4 清房');
  // R5 虫王戮蛊
  await toRoom(5); await simWait(1.2);
  await ev(() => { const b = game.dungeon.boss; b.aiCd = 99; b.anc.burrow = 0; game.player.x = 500; game.player.y = DEPTH / 2; });
  await simWait(0.6);
  s = await S(); check(s.burrow === 1 && await ev(() => game.dungeon.boss.msHidden), 'R5：虫王钻进地下');
  await simWait(3);
  s = await S(); check(await ev(() => !game.dungeon.boss.msHidden) && (s.burrowHit || 0) >= 1, `破土而出的旋风打中了原地不动的人（${s.burrowHit}）`);
  await shot('w5-burrow');
  // 进食阶段
  await ev(() => { const b = game.dungeon.boss; b.hp = Math.round(b.hpMax * 0.58); }); await simWait(1);
  const feed = await ev(() => { const b = game.dungeon.boss, st = b.msMechs.find(s => s.id === 'invuln' && !s.done); return { on: !!st, hidden: !!b.msHidden, larvae: st ? st.objs.filter(o => !o.dead && !o.remove).length : 0, hole: !!game.dungeon.ancRoom.hole }; });
  check(feed.on && feed.hidden && feed.larvae >= 4 && feed.hole, `进食阶段：虫王钻进洞里（无敌），幼虫爬向洞口 ${JSON.stringify(feed)}`);
  const hp1 = await ev(() => { const b = game.dungeon.boss, st = b.msMechs.find(s => s.id === 'invuln' && !s.done), o = st.objs.find(o => !o.dead && !o.remove), H = game.dungeon.ancRoom.hole; o.x = H.x; o.y = H.y; return b.hp; });
  await simWait(0.3);
  s = await S(); const hp2 = await ev(() => game.dungeon.boss.hp);
  check(s.bugEat >= 1 && hp2 > hp1, `幼虫爬到洞口被吃掉：虫王回血（${hp1} → ${hp2}）`);
  await shot('w5-feed');
  await killAll("e.kind === 'larva'"); await simWait(0.8);
  check(await ev(() => !game.dungeon.boss.msHidden && !game.dungeon.boss.msMechs.some(s => s.id === 'invuln' && !s.done)), '幼虫清完：虫王被逼出地面，无敌解除');
  await ev(() => { const b = game.dungeon.boss; for (const s of b.msMechs) msMechEnd(b, s); b.invul = 0; b.hp = 1; applyHit(game.player, b, { dmg: 50, sure: true }, { proj: true }); });
  await simWait(3);
  check(await ev(() => game.dungeon.state === 'result' || menus.isOpen('result')), '打倒虫王戮蛊 → 通关');
  // 另一趟：限时内打掉魔剑（解法）
  await enter('wailing_cave'); await toRoom(2); await simWait(3.6);
  await killAll("e.kind === 'apophis'"); await simWait(0.4);
  s = await S(); check(s.swordSlain === 1 && !s.diggerRage, '限时内打掉魔剑：盗墓者不会发狂');
}

const errs = logs.filter(l => l.type === 'pageerror' || (l.type === 'error' && !/favicon|ERR_FILE|素材加载失败/.test(l.text)));
for (const e of errs.slice(0, 5)) console.log('ERR', e.text.slice(0, 300));
check(!errs.length, `没有页面错误（${errs.length}）`);
await browser.close();
console.log(fail ? `ancient: ${fail} 项失败` : 'ancient: 全部通过');
process.exit(fail ? 1 : 0);
