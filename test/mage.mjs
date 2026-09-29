// 魔法师（女）基础技能行为回归（docs/skills/mage_behavior.md 基础部分）：
//   跑攻打空扑倒 / 打中不扑倒、落花掌按住后方向原地出掌 / 满蓄突进更远、赫德尔自我加速、杰克爆弹纵深追踪
// 转职遗留项（09-29）：煌龙乱舞、强化-天雷、移动施法满蓄保持 + 带进下一个房间、杰克降临换表情、魔道学者机械 HP、冰霜钻孔车过门
// 用法：node test/mage.mjs（约 30 秒）
import { launch, URL_BASE } from './lib.mjs';
const { browser, page, logs } = await launch();
await page.goto(`${URL_BASE}?rawcd&test&mute&cls=mage&mobs=0`); await page.waitForFunction(() => window.__READY, null, { timeout: 30000 });
const r = await page.evaluate(() => {
  game.paused = true; const p = game.player, out = {};
  const stepN = n => { for (let i = 0; i < n; i++) step(1 / 60); };
  const reset = () => { for (const k in input.virt) delete input.virt[k]; input.buf.length = 0; input.dirHist.length = 0; input.down.clear();
    clearAllSummons('t'); for (const e of ents) if (e !== p) e.remove = true; stepN(1); projs.length = 0; groundFx.length = 0;
    Object.assign(p, { x: 300, y: 100, z: 0, vx: 0, vy: 0, vz: 0, face: 1, act: null, cool: {}, buffs: {}, invul: 0 }); p.mp = p.mpMax = 99999; p.setState('idle'); stepN(2); };
  const dummy = (x, y = 100) => { const m = spawnMonster('goblin', x, y); m.control = null; m.act = null; m.hp = m.hpMax = 1e9; m.evade = 0; m.invul = 0; m.face = -1; m.setState('idle'); return m; };
  // 1) 跑攻打空 → 扑倒
  reset(); p.doAct(p.acts.dash); let trip = false; for (let i = 0; i < 60; i++) { stepN(1); if (p.act && p.act.name === 'mg_trip') trip = true; } out.dashMissTrip = trip;
  // 2) 跑攻打中 → 不扑倒
  reset(); const d2 = dummy(350); let nh = 0; const ah = window.applyHit; window.applyHit = function (a, t) { if (t === d2) nh++; return ah.apply(this, arguments); };
  p.doAct(p.acts.dash); trip = false; for (let i = 0; i < 60; i++) { stepN(1); if (p.act && p.act.name === 'mg_trip') trip = true; } out.dashHitTrip = trip; out.dashHits = nh; window.applyHit = ah;
  // 3) 落花掌：点按 / 满蓄 / 按住后方向（原地）
  const palm = (dir, hold) => { reset(); game.skillLv.mg_palm = 5; game.skillBar[0] = 'mg_palm'; input.virt.s0 = 2; stepN(1); if (!hold) delete input.virt.s0;
    if (dir) input.virt[dir] = 2; const x0 = p.x; let x1 = p.x; for (let i = 0; i < 60; i++) { stepN(1); if (hold && i === 24) delete input.virt.s0; if (p.act && p.act.name === 'mg_palm') x1 = p.x; } if (dir) delete input.virt[dir]; return Math.round(x1 - x0); };
  out.palmTap = palm(null, false); out.palmFull = palm(null, true); out.palmBack = palm('left', false);
  // 4) 赫德尔：自我加速
  reset(); dummy(500); const s = summon(p, 'hodor', { lv: 5 }); let haste = false; for (let i = 0; i < 60 * 30 && !haste; i++) { stepN(1); if (s.buffs && s.buffs.haste) haste = true; } out.hodorHaste = haste;
  // 5) 杰克爆弹：目标偏离纵深 40px 也能追上
  reset(); const m = dummy(560, 140); game.skillLv.mg_jack = 5; game.skillBar[0] = 'mg_jack'; const hp0 = m.hp; input.virt.s0 = 2; stepN(1); delete input.virt.s0; stepN(90); out.jackHoming = m.hp < hp0;
  return out;
});
console.log(JSON.stringify(r));
let fail = 0;
const report = (name, ok, info) => { if (!ok) fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${JSON.stringify(info)}`); };
report('基础：跑攻打空扑倒、落花掌、赫德尔、杰克爆弹', r.dashMissTrip && !r.dashHitTrip && r.palmBack < 20 && r.palmFull > r.palmTap && r.hodorHaste && r.jackHoming, r);
// ---- 2026-09-29 补做的遗留项（转职）：煌龙乱舞、强化-天雷、移动施法满蓄保持、魔道学者机械有 HP、杰克降临换表情 ----
const J = await page.evaluate(() => {
  const p = game.player, out = {};
  const stepN = n => { for (let i = 0; i < n; i++) step(1 / 60); };
  const job = j => { game.job = j; Object.assign((save.data.flags ??= {}), { awaken: true, awaken2: true, awaken3: true }); try { onJobChange(p, j); } catch (e) { }
    for (const id of classSkills('mage', j)) if (SKILLS[id]) game.skillLv[id] = SKILLS[id].maxLv || (SKILLS[id].passive ? 1 : 10); recalcStats(p); };
  const reset = () => { for (const k in input.virt) delete input.virt[k]; input.buf.length = 0; input.dirHist.length = 0; input.down.clear();
    clearAllSummons('t'); for (const e of ents) if (e !== p) e.remove = true; if (p.act) p.interrupt(); stepN(1); projs.length = 0; groundFx.length = 0; game.timers.length = 0;
    Object.assign(p, { x: 300, y: 100, z: 0, vx: 0, vy: 0, vz: 0, face: 1, act: null, cool: {}, buffs: {}, invul: 0 }); p.mp = p.mpMax = 99999; p.hp = p.hpMax; p.setState('idle'); stepN(2); };
  const dummy = (x, y = 100) => { const m = spawnMonster('goblin', x, y); m.control = null; m.act = null; m.hp = m.hpMax = 1e9; m.evade = 0; m.invul = 0; m.face = -1; m.setState('idle'); return m; };
  // 1) 煌龙乱舞：6 次横扫、不推到刀尖；连按 X 更快；按住 → 边走边打
  job('battlemage'); game.skillBar[0] = 'bm_dragon';
  const dance = (mash, fwd) => { reset(); const m = dummy(380); let n = 0; const ah = window.applyHit; window.applyHit = function (a, t, h) { if (t === m && a === p) n++; return ah.apply(this, arguments); };
    input.virt.s0 = 2; stepN(1); delete input.virt.s0; const isDance = !!(p.act && p.act.dance), x0 = p.x, mx0 = m.x; let f = 0;
    for (; f < 200 && p.st === 'act'; f++) { if (mash && f % 5 === 0) input.virt.attack = 2; else delete input.virt.attack; if (fwd) input.virt.right = 1; stepN(1); }
    delete input.virt.right; delete input.virt.attack; window.applyHit = ah; return { dance: isDance, hits: n, frames: f, moved: Math.round(p.x - x0), pushed: Math.round(m.x - mx0) }; };
  out.dance = dance(false, false); out.danceMash = dance(true, false); out.danceWalk = dance(false, true);
  game.skillLv.bm_dragondance = 0; reset(); game.skillBar[0] = 'bm_dragon'; input.virt.s0 = 2; stepN(1); delete input.virt.s0; out.dragonBase = !!(p.act && p.act.name === 'bm_dragon' && !p.act.dance); stepN(150);
  // 2) 强化-天雷：伤害 +55%、落雷间隔减半、冷却 20 秒
  job('elemental');
  const R0 = Math.random, seed = n => { let a = n >>> 0; Math.random = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  const thunder = up => { game.skillLv.el_thunderup = up ? 1 : 0; reset(); seed(7); const m = dummy(480); const hp0 = m.hp; game.skillBar[0] = 'mg_thunder'; input.virt.s0 = 2; stepN(1); delete input.virt.s0;
    const T = []; let f = 0; for (; f < 400 && p.st === 'act'; f++) { const n0 = p.act && p.act.n; stepN(1); if (p.act && p.act.n > (n0 || 0)) T.push(f); }
    return { dmg: Math.round(hp0 - m.hp), strikes: T.length, gap: T.length > 1 ? T[1] - T[0] : null, cd: Math.round((p.cool.mg_thunder || 0) + f / 60) }; };
  out.thunderUp = thunder(true); out.thunderBase = thunder(false); game.skillLv.el_thunderup = 1; Math.random = R0;
  // 3) 移动施法：蓄满后按住一直保持满蓄（能走动），松开才发射；没学时蓄满自动发射
  reset(); game.skillBar[0] = 'mg_void'; input.virt.s0 = 2; stepN(1); input.virt.s0 = 1; stepN(90); const held = !!(p.act && p.act.charging); input.virt.right = 1; const x0 = p.x; stepN(30); delete input.virt.right;
  out.holdCharge = { held, walked: Math.round(p.x - x0), still: !!(p.act && p.act.charging) }; delete input.virt.s0; stepN(3); out.holdCharge.fired = !!(p.act && p.act.chargeDone); stepN(60);
  game.skillLv.el_movecast = 0; reset(); input.virt.s0 = 2; stepN(1); input.virt.s0 = 1; stepN(90); out.holdCharge.noMove = !!(p.act && p.act.charging); delete input.virt.s0; stepN(60); game.skillLv.el_movecast = 1;
  // 4) 杰克降临：每次换一张表情，不和上一次重复
  const faces = []; for (let i = 0; i < 12; i++) faces.push(jackFace(p)); out.faces = { distinct: new Set(faces).size, repeat: faces.some((f, i) => i && f === faces[i - 1]) };
  // 5) 魔道学者：搭乘的机械被打坏 → 技能提前结束（主角跳下来、不爆炸）
  job('witch'); reset(); const mob = dummy(600); game.skillBar[0] = 'wt_furnace'; p.wtForce = 'ok'; input.virt.s0 = 2; stepN(1); delete input.virt.s0; stepN(60);
  const mach = summonsOf(p, 'wt_furnace')[0]; out.mach = { hp: mach ? Math.round(mach.hpMax / p.hpMax * 100) : 0, riding: !!(p.act && p.act.name === 'wt_furnace'), sa: !!mach && mach.superArmor > 0 };
  if (mach) { applyHit(mob, mach, { dmg: 1e8, type: 'phys', sure: true }, {}); stepN(20); out.mach.broken = mach.gone; out.mach.ended = !(p.act && p.act.name === 'wt_furnace'); }
  delete p.wtForce; stepN(120);
  return out;
});
report('煌龙乱舞：6 次横扫、不推到刀尖；连按 X 更快；按住 → 边走边打；没学是原来的推刺', J.dance.dance && J.dance.hits === 6 && J.danceMash.frames < J.dance.frames - 10 && J.danceWalk.moved > 100 && J.dance.moved < 10 && J.dragonBase, { d: J.dance, mash: J.danceMash, walk: J.danceWalk, base: J.dragonBase });
report('强化-天雷：伤害 +55%、落雷间隔减半、冷却 20 秒', J.thunderUp.strikes === 3 && J.thunderUp.dmg > J.thunderBase.dmg * 1.4 && J.thunderUp.gap < J.thunderBase.gap && Math.abs(J.thunderUp.cd - 20) <= 1 && Math.abs(J.thunderBase.cd - 15) <= 1, { up: J.thunderUp, base: J.thunderBase });
report('移动施法：蓄满后按住保持满蓄（能走动），松开发射；没学时蓄满自动发射', J.holdCharge.held && J.holdCharge.walked > 40 && J.holdCharge.still && J.holdCharge.fired && !J.holdCharge.noMove, J.holdCharge);
report('杰克降临：每次换表情（4 种，不连续重复）', J.faces.distinct >= 3 && !J.faces.repeat, J.faces);
report('魔道学者：机械有 HP（挨打不硬直），被打坏时技能提前结束', J.mach.hp >= 50 && J.mach.riding && J.mach.sa && J.mach.broken && J.mach.ended, J.mach);
const errs = logs.filter(l => l.type === 'error');
if (errs.length) { fail++; console.log('页面报错：', errs.slice(0, 3)); }
await browser.close();
// ---- 地下城：蓄好的技能 / 开着的载具带进下一个房间 ----
{
  const second = await launch();
  const pg = second.page;
  await pg.goto(`${URL_BASE}?dungeon=lorien&cls=mage&mute`); await pg.waitForFunction(() => window.__READY && game.dungeon && game.scene === 'dungeon', null, { timeout: 60000 });
  const D = await pg.evaluate(() => {
    game.paused = true; if (menus.isOpen('help')) menus.close('help');
    const p = game.player, out = {}, stepN = n => { for (let i = 0; i < n; i++) step(1 / 60); };
    Object.assign((save.data.flags ??= {}), { awaken: true, awaken2: true, awaken3: true }); save.data.fatigue = 999;
    const job = j => { game.job = j; try { onJobChange(p, j); } catch (e) { } for (const id of classSkills('mage', j)) if (SKILLS[id]) game.skillLv[id] = SKILLS[id].maxLv || (SKILLS[id].passive ? 1 : 10); recalcStats(p); p.mp = p.mpMax = 99999; };
    // 清掉当前房间、开门，把人放到一扇门前面（面朝门），返回门的方向
    const atDoor = (off = 90) => { const G = game.dungeon; for (const e of ents) if (e.team === 'e') e.remove = true; stepN(1); G.room.cleared = true; G.doorsOpen = true;
      const ds = Object.keys(G.room.doors), d = ds.find(k => k === 'left' || k === 'right') || ds[0], W = game.room.x1; Object.assign(p, { vx: 0, vy: 0, vz: 0, z: 0 });
      if (d === 'right') { p.x = W - off; p.y = DEPTH / 2; p.face = 1; } else if (d === 'left') { p.x = off; p.y = DEPTH / 2; p.face = -1; } else if (d === 'up') { p.x = W / 2; p.y = 40; } else { p.x = W / 2; p.y = DEPTH - 40; }
      return d; };
    const through = (d, n = 150) => { const r0 = game.dungeon.room; input.virt[d] = 1; let f = 0; for (; f < n && (game.dungeon.room === r0 || game.dungeon.transition); f++) stepN(1); delete input.virt[d]; stepN(2); return game.dungeon.room !== r0; };
    // 1) 元素师：蓄满的虚无之球走进下一个房间，松开才发射
    job('elemental'); game.skillBar[0] = 'mg_void'; let d = atDoor(); p.cool = {};
    input.virt.s0 = 2; stepN(1); input.virt.s0 = 1; stepN(70); const charged = !!(p.act && p.act.charging);
    const moved = through(d); out.charge = { dir: d, charged, moved, still: !!(p.act && p.act.charging && p.act.name === 'mg_void') }; delete input.virt.s0; stepN(3); out.charge.fired = !!(p.act && p.act.chargeDone); stepN(60);
    // 2) 魔道学者：开着冰霜钻孔车过门，进门后还坐在车上、车在人身边
    job('witch'); game.skillBar[0] = 'wt_drill'; p.wtForce = 'ok'; if (p.act) p.interrupt(); p.setState('idle'); d = atDoor(260); p.cool = {};
    input.virt.s0 = 2; stepN(1); delete input.virt.s0; stepN(70); const seated = !!(p.act && p.act.name === 'wt_drill' && p.act.seated);
    const moved2 = through(d, 240); const a = p.act, m = a && a.m;
    out.drill = { dir: d, seated, moved: moved2, riding: !!(a && a.name === 'wt_drill' && m && !m.gone), near: m ? Math.round(Math.abs(m.x - p.x)) : null }; delete p.wtForce; stepN(400);
    return out;
  });
  report('移动施法：蓄满的技能带进下一个房间，松开才发射', D.charge.charged && D.charge.moved && D.charge.still && D.charge.fired, D.charge);
  report('冰霜钻孔车：开着车过门，进门后还在车上', D.drill.seated && D.drill.moved && D.drill.riding && D.drill.near < 60, D.drill);
  const e2 = second.logs.filter(l => l.type === 'error' || l.type === 'pageerror'); if (e2.length) { fail++; console.log('地下城页面报错：', e2.slice(0, 3)); }
  await second.browser.close();
}
console.log(fail ? 'FAIL 魔法师行为' : 'OK 魔法师行为');
process.exit(fail ? 1 : 0);

