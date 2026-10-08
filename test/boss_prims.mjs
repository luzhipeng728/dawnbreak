// 领主差异化 P0 原语的实验室测试（docs/BOSS_SPEC.md）：node test/boss_prims.mjs [skills,mechs,traits,engine,dungeon]
//   skills  每个新技能：站在预警里挨打、站到生路上没事（扇形背后、跳砸跑开、分道的安全道、掩体、一直移动、残留区外面、吸 / 推的方向、冲刺变体）
//   mechs   新机制：stagger（打断 → 破招 / 没打断 → 放大招）、form（浮空 / 体型 / 招式子集 / 落地一招）、stance（模式轮换、受伤倍率、反伤）、
//           duo（搭档也是领主、倒一个其余狂暴、限时复活）、gauntlet（车轮战）、arena（地砖 / 风）、protect（摸到扣命、命没了失败）、facing（背对 / 面朝）
//   traits  hitHp saVsRanged reflectRanged rooted back onGetup grabOnly stacks substitute trail
//   engine  defineBossKit（老领主挂阶段 / 机制 / 技能库招式）、bossPhaseSet、monForceSkill(spec)、MS_EVENTS、sig 动作兜底
//   bot     机器人（game/bot.js）怎么应对新原语：扇形 / 分道 / 能跳的圈 / 双环 / 跳砸 / 安全区 / 地砖 / 凝视 / 吸人 / 标记，先打引信在走的物件
//   dungeon 领主房：bossTheme / bossProps / bossAlt、多领主同场（倒一个不结算，最后一个倒下才结算）
// 截图在 test/shots/boss_prims/
import { launch, URL_BASE } from './lib.mjs';
import fs from 'fs';
const parts = (process.argv[2] || 'skills,mechs,traits,engine,bot,dungeon').split(',');
const out = 'test/shots/boss_prims'; fs.mkdirSync(out, { recursive: true });
const speed = +(process.env.SPEED || 3);
let fail = 0; const rows = [];
const check = (ok, msg, d) => { rows.push({ ok: ok ? '✓' : '✗', msg }); if (!ok) { fail++; console.log('✗', msg, d !== undefined ? JSON.stringify(d).slice(0, 400) : ''); } return ok; };
const { browser, page, logs } = await launch({ width: 1280, height: 720 });
await page.goto(`${URL_BASE}?test&mute&mon=msLab`); await page.waitForFunction(() => window.__READY, null, { timeout: 30000 });
await page.evaluate(async s => { game.speedMul = s; await loadBundles(monBundles(['msLab', 'skasa', 'babySkasa', 'aquiles', 'tauKing', 'siroco'])); }, speed);
// 确定性：游戏主循环暂停（game.paused），测试里用 SIM(秒) / SIMU(条件, 最长秒) 按固定 1/60 秒一步步推进，随机数种子固定，不看墙钟（机器忙也一样）
const simWait = s => page.evaluate(s => SIM(s), s);
const until = (fn, arg, ms = 8000) => page.waitForFunction(fn, arg, { timeout: ms }).then(() => true).catch(() => false);
const shot = n => page.screenshot({ path: `${out}/${n}.png` });
// 页面里的公共工具：清场、刷一只（默认不自己出招）、玩家摆位、打一下
await page.evaluate(() => {
  window.__keepOn = true;
  const keep = () => { if (!window.__keepOn) return; const q = game.player; q.hp = q.hpMax; q.mp = q.mpMax; q.dead = false; };
  setInterval(keep, 40);
  game.paused = true; Math.random = mulberry(20260930);
  window.SIM = (sec, each) => { const n = Math.round(sec * 60); for (let i = 0; i < n; i++) { if (each) each(i); step(1 / 60); keep(); } };
  window.SIMU = (cond, sec, each) => { for (let i = 0; i < sec * 60; i++) { if (cond()) return true; if (each) each(i); step(1 / 60); keep(); } return !!cond(); };
  window.T = {
    clear() { for (let k = ents.length - 1; k >= 0; k--) if (ents[k].team === 'e') ents.splice(k, 1); groundFx.length = 0; projs.length = 0; game.timers.length = 0; MS_POOLS.length = 0; const p = game.player; if (p.heldBy) releaseHeld(p); if (p.act) p.endAct(); p.status = {}; p.invul = 0; p.grabProt = 0; p.msMarkMove = 0; p.msMarkCover = null; p.x = 300; p.y = 100; p.z = 0; p.vx = p.vy = p.vz = 0; p.face = 1; p.setState('idle'); },
    spawn(kind, x = 520, o = {}) { const m = window.__m = spawnMonster(kind, x, o.y ?? 100, { lvl: o.lvl || 40, boss: !!o.boss }); m.invul = 0; m.z = 0; m.vz = 0; m.setState('idle'); if (o.idle !== false) { const c = m.control; m.control = (e, dt) => { e.aiCd = 99; if (c) c(e, dt); }; } return m; },
    put(x, y = 100, face) { const p = game.player; if (p.act) p.endAct(); p.x = x; p.y = y; p.z = 0; p.vx = p.vy = 0; p.setState('idle'); if (face) p.face = face; p.invul = 0; p.status = {}; },
    hp() { return game.player.hp; }, full() { const p = game.player; p.hp = p.hpMax; p.invul = 0; },
    hit(t, h = {}, opt = { proj: true }) { t.invul = 0; return applyHit(game.player, t, { dmg: 20, sure: true, knock: 0, stun: 0.05, hs: 0, ...h }, opt); },
    idx(m, id) { return m.def_.attacks.findIndex(a => a.msId === id || a.ms === id); },
    ev(type, id) { return MS_EVENTS.filter(e => e.ev === type && (!id || e.id === id)).length; },
  };
});
// 在“挨打 / 没事”两种站位下各放一次：setup(m) 在页面里摆位（施法之后调用），返回玩家掉的血
async function dodge(label, spec, { before, after, wait, x = 520, boss = false }) {
  const r = await page.evaluate(async ({ spec, before, after, x, boss, wait, speed }) => {
    T.clear(); const m = T.spawn('msLab', x, { boss }); window.__keepOn = false; T.full();
    if (before) new Function('m', 'p', before)(m, game.player);
    const hp0 = game.player.hp; monForceSkill(m, spec);
    if (after) { SIM(0.05); new Function('m', 'p', after)(m, game.player); }
    SIM(wait);
    const d = hp0 - game.player.hp; window.__keepOn = true; return { d, st: Object.keys(game.player.status || {}) };
  }, { spec, before, after, x, boss, wait, speed });
  return r;
}

/* ================= skills ================= */
if (parts.includes('skills')) {
  // cone：正面挨打（冰冻只上一次），出手后绕到背后没事
  let a = await dodge('cone', { use: 'cone', ang: 70, len: 300, windup: 0.6, dur: 1.0, dmg: 0.3, status: 'freeze', sdur: 0.5 }, { before: 'm.face=-1; p.x=340; p.y=100;', wait: 2.0 });
  let b = await dodge('cone', { use: 'cone', ang: 70, len: 300, windup: 0.6, dur: 1.0, dmg: 0.3 }, { before: 'p.x=340;', after: 'p.x=m.x+160; p.y=100;', wait: 2.0 });
  check(a.d > 0 && b.d === 0, `cone：正面挨打 ${a.d}、绕到背后没事 ${b.d}`, { a, b });
  await page.evaluate(() => { T.clear(); const m = T.spawn('msLab', 520); T.put(360); monForceSkill(m, { use: 'cone', windup: 1, dur: 1, len: 320 }); }); await simWait(0.5); await shot('skill-cone-tele'); await simWait(0.7); await shot('skill-cone-live');
  // leap：站着不动挨打；锁定以后跑开没事
  a = await dodge('leap', { use: 'leap', track: 0.6, fall: 0.6, r: 100 }, { before: 'p.x=380;', wait: 2.6 });
  b = await page.evaluate(async speed => {
    T.clear(); const m = T.spawn('msLab', 520); T.put(380); window.__keepOn = false; T.full(); const hp0 = T.hp(); monForceSkill(m, { use: 'leap', track: 0.6, fall: 0.6, r: 100 });
    SIMU(() => m.msLeap && m.msLeap.locked, 4);
    T.put(game.player.x + 260); SIM(1.56); const d = hp0 - T.hp(); window.__keepOn = true; return { d };
  }, speed);
  check(a.d > 0 && b.d === 0, `leap：站着不动挨打 ${a.d}、锁定后跑开没事 ${b.d}`, { a, b });
  await page.evaluate(() => { T.clear(); const m = T.spawn('msLab', 520); T.put(380); monForceSkill(m, { use: 'leap', track: 1.0, fall: 0.6, r: 110, ring: [50, 130] }); }); await simWait(1.4); await shot('skill-leap');
  // lanes：安全的那条纵深没事，别的挨打
  const lane = async safe => page.evaluate(async ({ safe, speed }) => {
    T.clear(); const m = T.spawn('msLab', 900); T.put(300); window.__keepOn = false; T.full(); const hp0 = T.hp();
    monForceSkill(m, { use: 'lanes', lanes: 4, hit: 3, windup: 0.8, kind: 'wave', speed: 900 });
    SIM(0.45);
    const ys = groundFx.filter(g => g.kind === 'line').map(g => g.y), bw = DEPTH / 4, all = [0, 1, 2, 3].map(i => bw * (i + 0.5)), free = all.filter(y => !ys.some(v => Math.abs(v - y) < 1));
    T.put(300, safe ? free[0] : ys[0]); SIM(2.6);
    const d = hp0 - T.hp(); window.__keepOn = true; return { d, lines: ys.length, free: free.length };
  }, { safe, speed });
  a = await lane(false); b = await lane(true);
  check(a.lines === 3 && b.free === 1 && a.d > 0 && b.d === 0, `lanes：4 条挑 3 条（留 1 条），站进危险道挨打 ${a.d}、站安全道没事 ${b.d}`, { a, b });
  await page.evaluate(() => { T.clear(); const m = T.spawn('msLab', 900); T.put(300); monForceSkill(m, { use: 'lanes', lanes: 4, hit: 3, windup: 1.2, kind: 'runner', runner: 'babySkasa', speed: 500 }); }); await simWait(0.9); await shot('skill-lanes-tele'); await simWait(0.9); await shot('skill-lanes-run');
  // mark：burst 挨打；cover 有掩体没事、没掩体挨打；move 站着掉血、一直走没事
  a = await dodge('mark', { use: 'mark', delay: 0.8, r: 100, mode: 'burst', dmg: 1.2 }, { before: 'p.x=300;', wait: 1.6 });
  check(a.d > 0, `mark burst：被标记的人到点挨炸 ${a.d}`, a);
  const cover = async withCover => page.evaluate(async ({ withCover, speed }) => {
    T.clear(); const m = T.spawn('msLab', 700); T.put(300); if (withCover) spawnMonster('msCover', 500, 100, { lvl: 40 }); window.__keepOn = false; T.full(); const hp0 = T.hp();
    monForceSkill(m, { use: 'mark', mode: 'cover', delay: 0.8, frac: 0.2 }); SIM(1.8); const d = hp0 - T.hp(); window.__keepOn = true; return { d };
  }, { withCover, speed });
  a = await cover(true); b = await cover(false);
  check(a.d === 0 && b.d > 0, `mark cover：躲在掩体后没事 ${a.d}、没掩体挨狙 ${b.d}`, { a, b });
  const move = async moving => page.evaluate(async ({ moving, speed }) => {
    T.clear(); const m = T.spawn('msLab', 700); T.put(300); window.__keepOn = false; T.full(); const hp0 = T.hp(); let dir = 1;
    const mv = moving ? () => { const p = game.player; p.x += dir * 3; if (p.x > 600 || p.x < 250) dir = -dir; } : null;
    monForceSkill(m, { use: 'mark', mode: 'move', delay: 0.4, dur: 1.5, tick: 0.3, frac: 0.03 }); SIM(2.4, mv); const d = hp0 - T.hp(); window.__keepOn = true; return { d };
  }, { moving, speed });
  a = await move(false); b = await move(true);
  check(a.d > 0 && b.d === 0, `mark move：站着不动掉血 ${a.d}、一直移动没事 ${b.d}`, { a, b });
  await page.evaluate(() => { T.clear(); const m = T.spawn('msLab', 700); T.put(300); spawnMonster('msCover', 500, 100, { lvl: 40 }); monForceSkill(m, { use: 'mark', mode: 'cover', delay: 1.5, frac: 0.2 }); }); await simWait(0.8); await shot('skill-mark-cover');
  // plant：打掉的没事；到点的爆炸 / 孵化；root 定住目标，打掉物件就解开
  const pl = await page.evaluate(async speed => {
    T.clear(); const m = T.spawn('msLab', 700); T.put(300); const s0 = { ...MS_STATS.mech };
    monForceSkill(m, { use: 'plant', n: 2, at: 'spots', fuse: 1.2, r: 90, onFuse: 'explode' }); SIM(0.9);
    const objs = ents.filter(e => e.kind === 'msPlant' && !e.dead); if (objs[0]) T.hit(objs[0], { dmg: 99 });
    SIM(2);
    monForceSkill(m, { use: 'plant', n: 1, at: 'self', fuse: 0.6, onFuse: 'hatch:msCrystal' }); SIM(1.8);
    const hatched = ents.filter(e => e.kind === 'msCrystal' && !e.dead).length;
    monForceSkill(m, { use: 'plant', n: 1, at: 'target', root: true, fuse: 3, hits: 3 }); SIM(0.9);
    const rooted = hasStatus(game.player, 'root'), o = ents.find(e => e.kind === 'msPlant' && !e.dead); let hits = 0; while (o && !o.dead && hits < 10) { T.hit(o, { dmg: 99999 }); hits++; }
    SIM(0.3);
    return { spawned: objs.length, broken: (MS_STATS.mech.plantBroken || 0) - (s0.plantBroken || 0), fused: (MS_STATS.mech.plantFuse || 0) - (s0.plantFuse || 0), hatched, rooted, hits, unrooted: !hasStatus(game.player, 'root') };
  }, speed);
  check(pl.spawned === 2 && pl.broken >= 1 && pl.fused >= 2 && pl.hatched === 1 && pl.rooted && pl.hits === 3 && pl.unrooted, `plant：刷 ${pl.spawned} 个、打掉 ${pl.broken}、到点 ${pl.fused}、孵化 ${pl.hatched}、定身 ${pl.rooted} → 打 ${pl.hits} 下解开 ${pl.unrooted}`, pl);
  await page.evaluate(() => { T.clear(); const m = T.spawn('msLab', 700); T.put(300); monForceSkill(m, { use: 'plant', n: 3, at: 'spots', fuse: 6, kind: 'skasaEgg', onFuse: 'hatch:babySkasa', label: '孵化' }); }); await simWait(2.0); await shot('skill-plant');
  // pool：站在毒区里中毒、外面没事；油被火点着连环爆
  const pool = await page.evaluate(async speed => {
    T.clear(); const m = T.spawn('msLab', 700); T.put(300); monForceSkill(m, { use: 'pool', zone: 'poison', windup: 0.5, linger: 3, r: 80 });
    SIM(1.5); const inside = hasStatus(game.player, 'poison');
    game.player.status = {}; T.put(600, 40); SIM(0.9); const outside = hasStatus(game.player, 'poison');
    MS_POOLS.length = 0; const P1 = msPoolAt(m, 400, 100, { ...MON_SKILLS.pool.defaults, zone: 'oil', r: 60, linger: 5 }), P2 = msPoolAt(m, 500, 100, { ...MON_SKILLS.pool.defaults, zone: 'oil', r: 60, linger: 5 });
    const s0 = MS_STATS.mech.poolIgnite || 0; msArea(m, 400, 100, 50, { dmg: 1, elem: 'fire' });
    SIM(0.9); msPoolIgnite(m, P1.x, P1.y, 60);
    return { inside, outside, ignite: (MS_STATS.mech.poolIgnite || 0) - s0, left: MS_POOLS.length };
  }, speed);
  check(pool.inside && !pool.outside && pool.ignite >= 1, `pool：毒区里中毒 ${pool.inside}、外面没事 ${!pool.outside}、火点着油 ${pool.ignite} 块`, pool);
  await page.evaluate(() => { T.clear(); const m = T.spawn('msLab', 700); T.put(300); monForceSkill(m, { use: 'pool', zone: 'poison', n: 3, windup: 0.5, linger: 5, r: 80 }); msPoolAt(m, 900, 60, { ...MON_SKILLS.pool.defaults, zone: 'oil', r: 70, linger: 5 }); }); await simWait(1.2); await shot('skill-pool');
  // pull：out 把人推远并眩晕；in 把人吸近
  const pu = async mode => page.evaluate(async ({ mode, speed }) => { T.clear(); const m = T.spawn('msLab', 600); T.put(420); const d0 = Math.abs(game.player.x - m.x); monForceSkill(m, { use: 'pull', mode, r: 360, force: 300, windup: 0.4, dur: 1.0, status: mode === 'out' ? 'stun' : null }); SIM(0.7); const st = hasStatus(game.player, 'stun'); SIM(0.9); return { d0, d1: Math.abs(game.player.x - m.x), st }; }, { mode, speed });
  a = await pu('out'); b = await pu('in');
  check(a.d1 > a.d0 + 60 && a.st && b.d1 < b.d0 - 60, `pull：out 推开 ${a.d0}→${Math.round(a.d1)}（眩晕 ${a.st}），in 吸近 ${b.d0}→${Math.round(b.d1)}`, { a, b });
  // dash 变体：bounce + wallStun（撞墙自己晕）、carry（被顶着走）、frac（按最大 HP）
  const da = await page.evaluate(async speed => {
    T.clear(); let m = T.spawn('msLab', 600); T.put(400); monForceSkill(m, { use: 'dash', bounces: 1, wallStun: 1.5, speed: 1400, windup: 0.4 });
    const stun = SIMU(() => hasStatus(m, 'stun'), 4);
    T.clear(); m = T.spawn('msLab', 600); T.put(480); let held = false; monForceSkill(m, { use: 'dash', carry: true, speed: 900, windup: 0.4 });
    held = SIMU(() => game.player.st === 'held', 3);
    const free = SIMU(() => game.player.st !== 'held', 3);
    T.clear(); m = T.spawn('msLab', 600); T.put(500); window.__keepOn = false; T.full(); const hp0 = T.hp(); monForceSkill(m, { use: 'dash', frac: 0.2, windup: 0.4 }); SIM(1.2); const d = hp0 - T.hp(); window.__keepOn = true;
    return { stun, held, free, frac: +(d / game.player.hpMax).toFixed(3) };
  }, speed);
  check(da.stun && da.held && da.free && Math.abs(da.frac - 0.2) < 0.03, `dash 变体：撞墙自晕 ${da.stun}、顶着走 ${da.held} 后放开 ${da.free}、按最大 HP 结算 ${da.frac}`, da);
  await page.evaluate(() => { T.clear(); const m = T.spawn('msLab', 600); T.put(300); monForceSkill(m, { use: 'dash', spin: true, len: 400, windup: 0.8 }); }); await simWait(0.5); await shot('skill-dash-spin');
}

/* ================= mechs ================= */
if (parts.includes('mechs')) {
  // stagger：打够 → 打断 + 破招；不打 → 放出大招（扇形）
  const sg = await page.evaluate(async speed => {
    T.clear(); let m = T.spawn('skasa', 700, { boss: true }); T.put(560); const e0 = T.ev('solve', 'stagger'), g0 = MS_STATS.mech.groggyBreak || 0;
    let st = msMechStart(m, { use: 'stagger', windup: 2, need: 0.02, onBreak: 'groggy', skill: { use: 'cone', windup: 0.3, dur: 0.6 } });
    const hold = !!(m.act && m.act.msHold); let n = 0; while (!st.done && n++ < 400) T.hit(m, { dmg: 60 });
    SIM(0.2);
    const broke = { hold, broken: !!st.broken, groggy: (MS_STATS.mech.groggyBreak || 0) - g0, ev: T.ev('solve', 'stagger') - e0 };
    T.clear(); m = T.spawn('skasa', 700, { boss: true }); T.put(560); const c0 = MS_STATS.cast.cone || 0, f0 = T.ev('fail', 'stagger');
    st = msMechStart(m, { use: 'stagger', windup: 1, need: 0.5, skill: { use: 'cone', windup: 0.3, dur: 0.6 } });
    SIM(1.7);
    return { broke, fail: { cast: (MS_STATS.cast.cone || 0) - c0, ev: T.ev('fail', 'stagger') - f0 } };
  }, speed);
  check(sg.broke.hold && sg.broke.broken && sg.broke.groggy > 0 && sg.broke.ev > 0 && sg.fail.cast > 0 && sg.fail.ev > 0, `stagger：读条 ${sg.broke.hold} → 打断破招 ${sg.broke.groggy}；没打断放出大招 ${sg.fail.cast}`, sg);
  await page.evaluate(() => { T.clear(); const m = T.spawn('skasa', 700, { boss: true }); T.put(520); msMechStart(m, { use: 'stagger', windup: 3, need: 0.05, skill: { use: 'cone' } }); for (let i = 0; i < 20; i++) T.hit(m, { dmg: 30 }); }); await simWait(0.6); await shot('mech-stagger');
  // form：浮空、体型、招式子集（replace）、到时间变回 + 落地一招
  const fm = await page.evaluate(async speed => {
    T.clear(); const m = T.spawn('skasa', 700, { boss: true }); T.put(400); const sc0 = m.scale, a0 = MS_STATS.cast.aoe || 0;
    const st = msMechStart(m, { use: 'form', fly: 160, dur: 1.4, scale: 1.2, skills: [{ use: 'rain', n: 2, id: 'formRain' }], land: { use: 'aoe', at: 'self', r: 120, windup: 0.4 } });
    SIM(0.9);
    const A = m.def_.attacks, rainA = A.find(a => a.msId === 'formRain'), baseA = A.find(a => a.msId === 'claw');
    const mid = { z: Math.round(m.z), scale: +(m.scale / sc0).toFixed(2), rain: msGateOk(m, rainA), base: msGateOk(m, baseA) };
    SIM(1.8);
    return { mid, after: { ended: !!st.ended, scale: +(m.scale / sc0).toFixed(2), rain: msGateOk(m, rainA), base: msGateOk(m, baseA), land: (MS_STATS.cast.aoe || 0) - a0 } };
  }, speed);
  check(fm.mid.z > 100 && fm.mid.scale === 1.2 && fm.mid.rain && !fm.mid.base && fm.after.ended && fm.after.scale === 1 && !fm.after.rain && fm.after.base && fm.after.land > 0, `form：浮空 ${fm.mid.z}、体型 ×${fm.mid.scale}、只放形态招式、变回后恢复并落地一招 ${fm.after.land}`, fm);
  await page.evaluate(() => { T.clear(); const m = T.spawn('skasa', 700, { boss: true }); T.put(400); msMechStart(m, { use: 'form', fly: 190, dur: 9, say: '斯卡萨飞上了天空！' }); }); await simWait(1.2); await shot('mech-form');
  // stance：模式轮换（受伤倍率、招式子集）、反伤模式打人
  const sn = await page.evaluate(async speed => {
    T.clear(); const m = T.spawn('msLab', 600, { boss: true }); T.put(560, 100, 1); window.__keepOn = false; T.full();
    const st = msMechStart(m, { use: 'stance', every: [0.8, 0.8], modes: [{ id: 'orange', name: '橙', col: '#ffb030', dmgTaken: 0.5, skills: ['dashCarry'] }, { id: 'blue', name: '蓝', col: '#6ab0ff', reflect: 'phys', skills: [{ use: 'swipe', id: 'blueSwipe' }] }] });
    SIM(0.2); const A = m.def_.attacks, carry = A.find(a => a.msId === 'dashCarry');
    const s1 = { i: st.i, mul: m.dmgTakenMul, carry: msGateOk(m, carry) };
    SIM(0.9); const hp0 = T.hp(); T.hit(m, { dmg: 40, box: [0, 60, 20, 0, 100] }, {});
    const s2 = { i: st.i, mul: m.dmgTakenMul, carry: msGateOk(m, carry), refl: hp0 - T.hp() }; window.__keepOn = true; return { s1, s2 };
  }, speed);
  check(sn.s1.i === 0 && sn.s1.mul === 0.5 && sn.s1.carry && sn.s2.i === 1 && sn.s2.mul === 1 && !sn.s2.carry && sn.s2.refl > 0, `stance：橙（受伤 ×${sn.s1.mul}、点名招式可用）→ 蓝（反伤 ${sn.s2.refl}、橙的招式停用）`, sn);
  // duo：搭档也是领主；倒一个其余狂暴；window 秒内没一起倒下就复活
  const du = await page.evaluate(async speed => {
    T.clear(); const m = T.spawn('siroco', 800, { boss: true }); T.put(300); const atk0 = m.atk;
    const st = msMechStart(m, { use: 'duo', with: ['msLab'], window: 0.8, reviveHp: 0.5 }); SIM(0.2);
    const pt = st.group[1]; const first = { boss: !!(pt && pt.boss), n: ents.filter(e => e.boss && !e.dead).length };
    pt.invul = 0; pt.hp = 1; T.hit(pt, { dmg: 999 }); SIM(0.4);
    const rage = { atk: m.atk > atk0, dead: pt.dead };
    SIMU(() => st.group[1] !== pt, 5);
    const nw = st.group[1];
    return { first, rage, revived: nw !== pt && !nw.dead && Math.abs(nw.hp / nw.hpMax - 0.5) < 0.02 };
  }, speed);
  check(du.first.boss && du.first.n === 2 && du.rage.dead && du.rage.atk && du.revived, `duo：搭档是领主（同场 ${du.first.n}）、倒一个其余狂暴、限时没一起倒 → 复活`, du);
  await page.evaluate(() => { T.clear(); const m = T.spawn('siroco', 800, { boss: true }); T.put(300); msMechStart(m, { use: 'duo', with: ['aquiles'] }); game.lastTarget = m; game.lastTargetT = game.t; }); await simWait(1.0); await shot('mech-duo');
  // gauntlet：一波一波上，领主无敌观战，打完才下场
  const ga = await page.evaluate(async speed => {
    T.clear(); const m = T.spawn('siroco', 900, { boss: true }); T.put(300);
    const st = msMechStart(m, { use: 'gauntlet', gap: 0.2, waves: [{ kind: 'msLab', name: '风之骑士' }, { kind: 'msLab', n: 2, name: '冰之骑士' }] });
    const waveN = []; for (let w = 0; w < 2; w++) { SIMU(() => st.cur.some(o => !o.dead), 3); waveN.push({ n: st.cur.length, name: st.cur[0] && st.cur[0].name, mul: m.dmgTakenMul }); for (const o of st.cur) { o.hp = 1; T.hit(o, { dmg: 999 }); } }
    SIM(0.8); return { waveN, ended: !!st.ended, mul: m.dmgTakenMul, idle: !!m.msIdle };
  }, speed);
  check(ga.waveN.length === 2 && ga.waveN[0].n === 1 && ga.waveN[1].n === 2 && ga.waveN[0].mul === 0 && ga.ended && ga.mul === 1 && !ga.idle, `gauntlet：第 1 波 ${ga.waveN[0] && ga.waveN[0].n} 只、第 2 波 ${ga.waveN[1] && ga.waveN[1].n} 只，领主无敌到打完`, ga);
  // arena：地砖（热格挨烫、冷格没事）、风（被推）
  const ar = await page.evaluate(async speed => {
    T.clear(); const m = T.spawn('siroco', 900, { boss: true }); T.put(300); const W = game.room.x1;
    const st = msMechStart(m, { use: 'arena', kind: 'tiles', cols: 4, hot: 0.5, every: 99, warn: 0.2, frac: 0.05, tick: 0.2 });
    const hotI = st.mask.indexOf(1), coldI = st.mask.indexOf(0), w = W / 4;
    window.__keepOn = false; T.full(); T.put(w * (hotI + 0.5)); const h0 = T.hp(); SIM(1); const dHot = h0 - T.hp();
    T.full(); T.put(w * (coldI + 0.5)); const h1 = T.hp(); SIM(0.8); const dCold = h1 - T.hp(); window.__keepOn = true;
    msMechEnd(m, st); const s2 = msMechStart(m, { use: 'arena', kind: 'wind', vx: -120 }); T.put(700); const x0 = game.player.x; SIM(0.9); const dx = game.player.x - x0; msMechEnd(m, s2);
    return { mask: st.mask, dHot, dCold, dx: Math.round(dx) };
  }, speed);
  check(ar.dHot > 0 && ar.dCold === 0 && ar.dx < -40, `arena：热格挨烫 ${ar.dHot}、冷格没事 ${ar.dCold}、风把人往左吹 ${ar.dx}`, ar);
  await page.evaluate(() => { T.clear(); const m = T.spawn('siroco', 900, { boss: true }); T.put(300); msMechStart(m, { use: 'arena', kind: 'tiles', cols: 6, every: 99, warn: 0 }); msMechStart(m, { use: 'arena', kind: 'fog', r: 240 }); }); await simWait(0.5); await shot('mech-arena');
  // protect：小怪摸到心脏 → 扣命 + 领主回血；命没了 → 失败（狂暴）
  const pr = await page.evaluate(async speed => {
    T.clear(); const m = T.spawn('siroco', 900, { boss: true }); T.put(300); m.hp = Math.round(m.hpMax * 0.5); const hp0 = m.hp, atk0 = m.atk, f0 = T.ev('fail', 'protect');
    const st = msMechStart(m, { use: 'protect', kind: 'msHeart', lives: 2, at: 0.3, threat: 'msLab', heal: 0.05, onLose: 'enrage' });
    const heart = st.obj; const a = spawnMonster('msLab', heart.x + 4, heart.y, { lvl: 40 }); a.invul = 0;
    SIM(0.3); const one = { lives: st.lives, healed: m.hp > hp0, heartHit: !(heart.invul > 5) || heart.dead };
    const b = spawnMonster('msLab', heart.x - 4, heart.y, { lvl: 40 }); b.invul = 0; SIM(0.3);
    return { one, lives: st.lives, ended: !!st.ended, rage: m.atk > atk0, fail: T.ev('fail', 'protect') - f0, taunted: true };
  }, speed);
  check(pr.one.lives === 1 && pr.one.healed && !pr.one.heartHit && pr.ended && pr.rage && pr.fail > 0, `protect：摸到心脏扣命（剩 ${pr.one.lives}）领主回血、玩家打不坏心脏、命没了 → 狂暴`, pr);
  await page.evaluate(() => { T.clear(); const m = T.spawn('siroco', 1000, { boss: true }); T.put(300); msMechStart(m, { use: 'protect', kind: 'msHeart', lives: 5, at: 0.35, threat: 'msLab', name: '查理的心脏' }); game.lastTarget = m; game.lastTargetT = game.t; }); await simWait(0.5); await shot('mech-protect');
  // facing：背对没事、面朝挨打；toward 模式反过来
  const fa = async (mode, face) => page.evaluate(async ({ mode, face, speed }) => { T.clear(); const m = T.spawn('msLab', 700, { boss: true }); T.put(400, 100, face); window.__keepOn = false; T.full(); const h0 = T.hp(); msMechStart(m, { use: 'facing', mode, windup: 0.8, frac: 0.1 }); SIM(1.3, () => { game.player.face = face; }); const d = h0 - T.hp(); window.__keepOn = true; return d; }, { mode, face, speed });
  const f1 = await fa('away', 1), f2 = await fa('away', -1), f3 = await fa('toward', -1);
  check(f1 > 0 && f2 === 0 && f3 > 0, `facing：away 面朝挨打 ${f1}、背对没事 ${f2}；toward 背对挨打 ${f3}`, { f1, f2, f3 });
}

/* ================= traits ================= */
if (parts.includes('traits')) {
  const tr = await page.evaluate(async speed => {
    const mk = (name, traits) => { MON['tl_' + name] = { ...MON.msLab, name, msTraits: traits, attacks: MON.msLab.attacks.slice(0, 2) }; msTraitPrecompile(MON['tl_' + name]); return 'tl_' + name; };
    const R = {};
    T.clear(); let m = T.spawn(mk('hitHp', { hitHp: 5 }), 600); let n = 0; while (!m.dead && n < 20) { T.hit(m, { dmg: 5000 }); n++; } R.hitHp = { hits: n, max: m.hpMax };
    T.clear(); m = T.spawn(mk('sav', { saVsRanged: 1.5 }), 600); T.hit(m, { box: [0, 60, 20, 0, 100] }, {}); const saMelee = m.superArmor > 0; T.hit(m, {}); R.saVsRanged = { melee: saMelee, ranged: m.superArmor > 0 };
    T.clear(); m = T.spawn(mk('refl', { reflectRanged: { on: 3, off: 3, k: 0.5, mul: 0.2 } }), 600, { idle: true }); m.msReflT = 0; SIM(0.2); window.__keepOn = false; T.full(); const h0 = T.hp(); T.hit(m, { dmg: 60 }); R.reflect = { on: !!m.msReflOn, mul: m.dmgTakenMul, hurt: h0 - T.hp() }; window.__keepOn = true;
    T.clear(); m = T.spawn(mk('rooted', { rooted: true }), 600, { idle: false }); T.put(300); const x0 = m.x; for (let i = 0; i < 5; i++) T.hit(m, { knock: 300 }); SIM(1.2); R.rooted = { dx: Math.round(Math.abs(m.x - x0)) };
    T.clear(); m = T.spawn(mk('back', { back: 'interrupt' }), 600); T.put(700, 100, -1); monForceSkill(m, { use: 'hold', dur: 3 }); m.face = -1; game.player.x = m.x + 60; const actB = !!m.act; T.hit(m, {}, {}); R.back = { acting: actB, broke: !m.act || m.act.name !== 'charge', stun: hasStatus(m, 'stun') };
    T.clear(); m = T.spawn(mk('getup', { onGetup: { use: 'aoe', shape: 'circle', at: 'self', r: 90, windup: 0.3 } }), 600); const g0 = MS_STATS.mech.onGetup || 0; m.setState('down'); m.stT = 0; m.downTime = 0.2; SIM(1.6); R.onGetup = { fired: (MS_STATS.mech.onGetup || 0) - g0 };
    T.clear(); m = T.spawn(mk('grab', { grabOnly: true }), 600, { idle: false }); SIM(0.2); const sa0 = m.superArmor > 0; T.hit(m, { grab: true }); R.grabOnly = { sa: sa0, open: m.msGrabOpen > game.t, sa1: m.superArmor };
    T.clear(); m = T.spawn(mk('stk', { stacks: { n: 3, dur: 5, r: 90, frac: 0.1 } }), 600); T.put(560); window.__keepOn = false; T.full(); const h1 = T.hp(); for (let i = 0; i < 3; i++) T.hit(m, { dmg: 5 }); SIM(1.3); R.stacks = { hurt: h1 - T.hp() }; window.__keepOn = true;
    T.clear(); m = T.spawn(mk('sub', { substitute: { cd: 5, heavy: 0.02 } }), 600); T.put(500); const sx0 = m.x; T.hit(m, { dmg: 3000, down: true }); R.substitute = { decoy: ents.filter(e => e.kind === 'msDecoy' && !e.dead).length, moved: Math.round(Math.abs(m.x - sx0)) };
    T.clear(); m = T.spawn(mk('trail', { trail: { zone: 'oil', every: 0.2, r: 30, linger: 4 } }), 400, { idle: false }); MS_POOLS.length = 0; SIM(1.5, () => { m.x += 2.5; }); R.trail = { pools: MS_POOLS.length };
    return R;
  }, speed);
  check(tr.hitHp.hits === 5 && tr.hitHp.max === 5, `hitHp：固定 ${tr.hitHp.hits} 下打碎`, tr.hitHp);
  check(!tr.saVsRanged.melee && tr.saVsRanged.ranged, `saVsRanged：近战不霸体、远程打中霸体`, tr.saVsRanged);
  check(tr.reflect.on && tr.reflect.mul === 0.2 && tr.reflect.hurt > 0, `reflectRanged：反射罩亮着受伤 ×${tr.reflect.mul}、远程攻击者被反弹 ${tr.reflect.hurt}`, tr.reflect);
  check(tr.rooted.dx < 3, `rooted：被打也不动（位移 ${tr.rooted.dx}）`, tr.rooted);
  check(tr.back.acting && tr.back.broke && tr.back.stun, `back：背击打断霸体读条并眩晕`, tr.back);
  check(tr.onGetup.fired > 0, `onGetup：起身反击 ${tr.onGetup.fired}`, tr.onGetup);
  check(tr.grabOnly.sa && tr.grabOnly.open && !tr.grabOnly.sa1, `grabOnly：平时霸体、抓取打破霸体`, tr.grabOnly);
  check(tr.stacks.hurt > 0, `stacks：打满 3 层自己脚下爆炸 ${tr.stacks.hurt}`, tr.stacks);
  check(tr.substitute.decoy === 1 && tr.substitute.moved > 60, `substitute：挨重击留替身（${tr.substitute.decoy}）闪走 ${tr.substitute.moved}`, tr.substitute);
  check(tr.trail.pools >= 3, `trail：走过的地方留下 ${tr.trail.pools} 块油`, tr.trail);
}

/* ================= engine ================= */
if (parts.includes('engine')) {
  const en = await page.evaluate(async speed => {
    const R = {};
    defineBossKit('tauKing', { mechs: [{ use: 'groggy', max: 60 }], traits: { back: 'interrupt' }, phases: [{ at: 0.5, say: '萨乌塔举起了巨斧！', mechs: [{ use: 'enrage', t: 999 }], skills: [{ use: 'cone', id: 'kitCone', windup: 0.4, dur: 0.5 }] }] });
    T.clear(); const plain = spawnMonster('tauKing', 600, 100, { lvl: 20 }); R.plain = { mechs: (plain.msMechs || []).length, kitSkill: plain.def_.attacks.find(a => a.msId === 'kitCone').cond(plain) };
    T.clear(); const m = T.spawn('tauKing', 600, { boss: true, idle: false }); let f = m.aiInner || m.control; const chain = []; while (f) { chain.push(f.name || 'ctl'); f = f.aiBase; }
    R.kit = { mechs: m.msMechs.map(s => s.id), drive: !!m.msDrive, chain, phase0: m.msPhase, kitBefore: m.def_.attacks.find(a => a.msId === 'kitCone').cond(m) };
    R.kit.phase = bossPhaseSet(m, 1); R.kit.mechs2 = m.msMechs.filter(s => !s.done).map(s => s.id); SIM(1.5);
    const c0 = MS_STATS.cast.cone || 0; R.kit.force = monForceSkill(m, 'kitCone'); R.kit.cast = (MS_STATS.cast.cone || 0) - c0;
    let n = 0; const st = m.msMechs.find(s => s.id === 'groggy'); while (!(st.stun > 0) && n++ < 500) T.hit(m, { dmg: 40 }); R.kit.groggy = st.stun > 0;
    const k0 = MS_EVENTS.length; T.clear(); const lab = T.spawn('msLab', 600), n0 = Object.keys(lab.def_.msForce || {}).length; R.spec = monForceSkill(lab, { use: 'aoe', at: 'self', r: 81, windup: 0.3 }); R.again = Object.keys(lab.def_.msForce || {}).length - n0; monForceSkill(lab, { use: 'aoe', at: 'self', r: 81, windup: 0.3 }); R.again2 = Object.keys(lab.def_.msForce || {}).length - n0;
    SIM(0.8);
    R.events = [...new Set(MS_EVENTS.map(e => e.ev))].sort(); R.newEvents = MS_EVENTS.length - k0;
    R.sig = { anims: !!msMonAnims('snSkasa').sigA, clip: !!BEAST_CLIPS.sigA, data: SPR_ANIMS.monster.sigB.length };
    return R;
  }, speed);
  check(en.plain.mechs === 0 && !en.plain.kitSkill, `defineBossKit：不当领主刷出来时不挂机制、不放套件招式`, en.plain);
  check(en.kit.mechs.includes('groggy') && en.kit.drive && en.kit.chain.includes('monsterAI') && en.kit.phase0 === 0 && !en.kit.kitBefore, `defineBossKit：当领主时挂上破招槽、手写 AI 包一层（${en.kit.chain.join(' → ')}）`, en.kit);
  check(en.kit.phase === 1 && en.kit.mechs2.includes('enrage') && en.kit.force && en.kit.cast > 0 && en.kit.groggy, `bossPhaseSet → 第 1 阶段（进场机制 ${en.kit.mechs2}）、套件招式能放、破招槽能破`, en.kit);
  check(en.spec && en.again === 1 && en.again2 === 1 && en.newEvents > 0, `monForceSkill(spec)：现场编译一次（重复放不再编译）`, en);
  check(['cast', 'end', 'hurt', 'mech', 'phase', 'solve', 'tele'].every(k => en.events.includes(k)), `MS_EVENTS 有 ${en.events.join(' ')}`, en.events);
  check(en.sig.anims && en.sig.clip && en.sig.data === 4, `sig 动作：没有 sig 帧的精灵退回 atk / cast 帧`, en.sig);
}

/* ================= bot：机器人怎么应对新原语（msBotThreat / msBotTarget，game/bot.js 在用） ================= */
if (parts.includes('bot')) {
  const bt = await page.evaluate(async speed => {
    const R = {}, p = game.player, W = game.room.x1, wait = s => SIM(s);
    const threat = () => { const T = msBotThreat(p); return T ? { ...T, x: T.x !== undefined ? Math.round(T.x) : undefined, y: T.y !== undefined ? Math.round(T.y) : undefined } : null; };
    // 扇形：站在里面 → 走出扇形（目标点不在扇形里）
    T.clear(); let m = T.spawn('msLab', 700); T.put(560, 100); m.face = -1; monForceSkill(m, { use: 'cone', ang: 60, len: 320, windup: 1.2, dur: 1 }); await wait(0.2);
    let t = threat(), C = m.msCone; R.cone = { why: t && t.why, out: !!(t && t.x !== undefined && !msInCone(C, 0, C.p, { x: t.x, y: t.y, w: p.w })) };
    // 分道：站在危险道 → 去没有预警的纵深
    T.clear(); m = T.spawn('msLab', 900); T.put(300, 100); monForceSkill(m, { use: 'lanes', lanes: 4, hit: 3, windup: 1.5 }); await wait(0.45);
    const ys = groundFx.filter(g => g.kind === 'line').map(g => g.y); p.y = ys[0]; t = threat(); R.lanes = { why: t && t.why, free: !!(t && t.y !== undefined && ys.every(y => Math.abs(y - t.y) > DEPTH / 8)) };
    // 能跳的圈：还早 → 原地等；快落下 → 跳
    T.clear(); m = T.spawn('msLab', 700); T.put(500, 100); monForceSkill(m, { use: 'aoe', at: 'target', r: 90, windup: 1.2, jump: true, follow: false }); await wait(0.4);
    const t1 = threat(); const g = groundFx.find(q => q.jump); if (g) g.t = g.dur - 0.2; const t2 = threat(); R.jump = { early: t1 && t1.why, late: !!(t2 && t2.jump) };
    // 双环：站在外圈 → 进内圈
    T.clear(); m = T.spawn('msLab', 700); T.put(500, 100); monForceSkill(m, { use: 'aoe', shape: 'ring', at: 'target', r: 150, r0: 70, windup: 1.2, follow: false }); await wait(0.4);
    const ring = groundFx.find(q => q.r0); if (ring) { p.x = ring.x + 110; p.y = ring.y; } t = threat(); R.ring = { why: t && t.why, inner: !!(t && ring && Math.abs(t.x - ring.x) < 5) };
    // 跳砸：还在跟人时不跑，锁定后跑
    T.clear(); m = T.spawn('msLab', 700); T.put(560, 100); monForceSkill(m, { use: 'leap', track: 1.2, fall: 0.8, r: 100 }); await wait(0.5);
    const tk = threat(); SIMU(() => m.msLeap && m.msLeap.locked, 4);
    const Lg = groundFx.find(q => q.r === 100); if (Lg) { p.x = Lg.x; p.y = Lg.y; } const tl = threat(); const legacy = groundFx.some(q => q.fire && !q.track && q.r > 0 && q.kind !== 'line' && inGround(p, q.x, q.y, q.r + 10));
    R.leap = { tracking: tk ? tk.why : null, locked: !!(tl && tl.x !== undefined) || legacy };
    // 安全区：去光圈、在里面就原地
    T.clear(); m = T.spawn('siroco', 900, { boss: true }); T.put(300, 100); let st = msMechStart(m, { use: 'safezone', windup: 3, n: 1, r: 80 }); t = threat(); const z = st.zones[0]; p.x = z.x; p.y = z.y; const t3 = threat();
    R.safezone = { go: !!(t && Math.abs(t.x - z.x) < 2), stay: !!(t3 && t3.stay) }; msMechEnd(m, st);
    // 地砖：站在热格 → 去最近的冷格；凝视：最后 0.5 秒转身
    st = msMechStart(m, { use: 'arena', kind: 'tiles', cols: 4, every: 99, warn: 0 }); const w = W / 4, hot = st.mask.indexOf(1); p.x = w * (hot + 0.5); t = threat(); R.tiles = !!(t && t.why === 'tiles' && !st.mask[Math.floor(t.x / w)]); msMechEnd(m, st);
    st = msMechStart(m, { use: 'facing', mode: 'away', windup: 1.0 }); st.t = 0.7; p.x = 500; t = threat(); R.facing = !!(t && t.face === -(Math.sign(m.x - p.x) || 1)); msMechEnd(m, st);
    // 吸人：往外走
    T.clear(); m = T.spawn('msLab', 700); T.put(560, 100); monForceSkill(m, { use: 'pull', mode: 'in', r: 360, windup: 0.3, dur: 1.5 }); await wait(0.6); t = threat(); R.pull = !!(t && t.why === 'pull' && t.x < 560);
    // 标记：move 一直走、cover 躲到掩体后
    T.clear(); m = T.spawn('msLab', 800); T.put(400, 100); monForceSkill(m, { use: 'mark', mode: 'move', delay: 0.3, dur: 2 }); await wait(0.5); t = threat(); R.markMove = !!(t && t.why === 'markMove' && t.x !== p.x);
    T.clear(); m = T.spawn('msLab', 800); T.put(300, 100); const cv = spawnMonster('msCover', 500, 60, { lvl: 40 }); monForceSkill(m, { use: 'mark', mode: 'cover', delay: 1.5 }); await wait(0.5); t = threat(); R.markCover = !!(t && t.why === 'cover' && t.x < cv.x && Math.abs(t.y - cv.y) < 2);
    // 先打谁：引信在走的蛋 > 领主
    T.clear(); m = T.spawn('skasa', 900, { boss: true }); T.put(300, 100); monForceSkill(m, { use: 'plant', kind: 'skasaEgg', n: 1, at: 'spots', fuse: 9, hp: 0.01 }); await wait(0.8);
    const tg = msBotTarget(p); R.target = tg ? tg.kind : null;
    return R;
  }, speed);
  check(bt.cone.why === 'cone' && bt.cone.out, `机器人 · 扇形：走出扇形`, bt.cone);
  check(bt.lanes.why === 'line' && bt.lanes.free, `机器人 · 分道：去没有预警的那条纵深`, bt.lanes);
  check(bt.jump.early === 'jump' && bt.jump.late, `机器人 · 能跳的圈：先等、快落下时跳`, bt.jump);
  check(bt.ring.why === 'ring' && bt.ring.inner, `机器人 · 双环：进内圈`, bt.ring);
  check(!bt.leap.tracking && bt.leap.locked, `机器人 · 跳砸：跟人时不跑、锁定后跑开`, bt.leap);
  check(bt.safezone.go && bt.safezone.stay, `机器人 · 安全区：走进光圈、进去后原地`, bt.safezone);
  check(bt.tiles && bt.facing && bt.pull, `机器人 · 地砖找冷格 ${bt.tiles}、凝视转身 ${bt.facing}、被吸往外走 ${bt.pull}`, bt);
  check(bt.markMove && bt.markCover, `机器人 · 标记：一直走 ${bt.markMove}、躲到掩体后 ${bt.markCover}`, bt);
  check(bt.target === 'skasaEgg', `机器人 · 先打引信在走的龙蛋（${bt.target}）`, bt);
}

/* ================= dungeon ================= */
if (parts.includes('dungeon')) {
  const dg = await page.evaluate(async speed => {
    const D0 = DUNGEONS.skasa_nest, def = { ...D0, id: 'skasa_nest', bossTheme: 'snRidge', bossProps: [{ kind: 'throne', x: 0.85, y: 0.1, col: '#bfe6ff' }, { kind: 'chain', x: 0.2 }, { kind: 'msTotem', x: 0.5, y: 0.8 }], bossAlt: { kind: 'aquiles', chance: 1, say: '稀有领主！' } };
    await loadBundles(['bg:snRidge', ...monBundles(['skasa', 'aquiles', 'babySkasa'])]);
    save.data.fatigue = 999; const d = new Dungeon(def, 0); d.start(); d.enter(d.layout.boss, 'left');
    const b = d.boss, R = { theme: game.room.theme, props: fxList.filter(f => f.dur === 1e9 && f.x > 0).length, totem: ents.some(e => e.kind === 'msTotem'), alt: b.kind };
    for (const e of ents) if (e.team === 'e' && e !== b) e.remove = true;
    const st = msMechStart(b, { use: 'duo', with: ['babySkasa'] }); SIM(0.3);
    const pt = st.group[1]; pt.invul = 0; pt.hp = 1; T.hit(pt, { dmg: 999 }); SIM(0.4);
    R.afterPartner = { state: d.state, cleared: !!d.room.cleared, bossAlive: !b.dead };
    b.invul = 0; b.hp = 1; T.hit(b, { dmg: 999 }); SIM(0.4);
    R.afterBoss = { cleared: !!d.room.cleared };
    return R;
  }, speed);
  await shot('dungeon-boss-room');
  check(dg.theme === 'snRidge' && dg.props >= 2 && dg.totem && dg.alt === 'aquiles', `领主房：单独背景 ${dg.theme}、摆设 ${dg.props}（+ 怪物摆设 ${dg.totem}）、稀有领主替换 ${dg.alt}`, dg);
  check(!dg.afterPartner.cleared && dg.afterPartner.bossAlive && dg.afterBoss.cleared, `多领主同场：倒一个不结算（${JSON.stringify(dg.afterPartner)}），最后一个倒下才结算`, dg);
}

const errs = logs.filter(l => l.type !== 'warning' && !/素材加载失败/.test(l.text));
for (const e of errs.slice(0, 10)) console.log('ERR', e.text.slice(0, 300));
check(!errs.length, `页面报错 ${errs.length} 条`);
const fe = await page.evaluate(() => (typeof frameErrs !== 'undefined' ? frameErrs.map(e => `${e.where} ×${e.n}：${e.msg}`) : []));
check(!fe.length, `逐帧报错 ${fe.length} 条`, fe);
console.table(rows);
await browser.close();
console.log(fail ? `boss_prims: ${fail} 项失败` : 'boss_prims: 全部通过');
process.exit(fail ? 1 : 0);
