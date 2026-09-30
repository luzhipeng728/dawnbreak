// 柔道家（男格斗家转职 grappler，B7）机制测试：暂停循环、逐帧推进（确定性）。node test/grappler.mjs [mech,boss,shots]（默认 mech,boss，约 40 秒）
//   mech  抓住无敌 / 抛投踢飞 + 撞墙 / 暴力抓取范围抓 / 滑行抓取 / 连环抓取（取消 + 加伤）/ 二觉预约（终结伤害先打完）/ 霹雳旋踢只抓倒地 /
//         空绞锤（空中抓 → 砸地 → 弹起）/ 折颈（转身 + 强制硬直 3 秒）/ 膝击柔道家版（3 下 + ↓ 摔地）/ 臂铠精通 / 决斗场抓轰炮不给硬直
//   boss  抓轰炮：领主抓不住 → 伤害 + 强制硬直 ×0.3、动作很快结束；无情摔击撞领主继续冲（神怡气静：停下出冲击波）；所有主动技能对领主放完都能回到可行动（不卡死）、都打得到
//   shots 实机截图（test/shots/grappler/*.png）：抓轰炮、暴力抓取、死亡旋律、三觉
import { launch, URL_BASE } from './lib.mjs';
import fs from 'fs';
const MODES = (process.argv[2] || 'mech,boss').split(',');
let fail = 0;
const report = (name, ok, info) => { if (!ok) fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${JSON.stringify(info)}`); };
const { browser, page, logs } = await launch({ width: 960, height: 540 });
await page.goto(`${URL_BASE}?test&cls=fighter&fighter=1&mobs=0&mute`); await page.waitForFunction(() => window.__READY, null, { timeout: 30000 });
await page.evaluate(() => {
  game.paused = true; window.toastMsg = () => {};
  let sd = 0x5eed; Math.random = () => { sd = (sd + 0x6D2B79F5) >>> 0; let t = sd; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };   // 固定随机种子（暴击 / 浮动）
  const p = game.player; game.job = 'grappler'; Object.assign((save.data.flags ??= {}), { awaken: true, awaken2: true, awaken3: true });
  onJobChange(p, 'grappler');
  if (!SKILLS.f_knee) defSkill('f_knee', { name: '膝击', cls: 'fighter', lvReq: 5, mp: 10, cd: 5, type: 'phys', grab: true, pow: lv => skillDmg(1.8, 0.18, lv), act: () => ({ name: 'f_knee', dur: 0.5, hits: [HB(0.04, 0.16, [0, 90, 34, 0, 110], 0.5, { grab: true })] }) });   // B3 的膝击还没合进来时用的替身（只为测柔道家版的包装）
  fgWrapBase();
  for (const id of classSkills('fighter', 'grappler').concat(['f_knee'])) game.skillLv[id] = Math.min(SKILLS[id].maxLv || 5, 5);
  window.GT = {
    run(n) { for (let i = 0; i < n; i++) { input.frame(game.t); step(1 / 60); } },
    mob(x = 380, y = 100, o = {}) { const m = spawnMonster(o.kind || 'goblin', x, y, o); m.control = null; m.invul = 0; m.z = 0; m.vz = 0; m.act = null; m.setState('idle'); m.hp = m.hpMax = 1e9; m.evade = 0; m.face = -1; Object.assign(m, o.set || {}); return m; },
    clear() { for (const e of ents) if (e !== p) e.remove = true; GT.run(1); projs.length = 0; game.timers.length = 0; game.timeStop = 0; game.cutin = null; },
    reset() { GT.clear(); for (const k in input.virt) delete input.virt[k]; input.buf.length = 0; input.dirHist.length = 0;
      if (p.act) p.interrupt(); Object.assign(p, { x: 300, y: 100, z: 0, vx: 0, vy: 0, vz: 0, face: 1, act: null, invul: 0, superArmor: 0, hitstop: 0, dead: false, cool: {}, buffs: {}, rot: 0, grabbed: null, grabMore: null, _fgChain: null, _fgResv: null });
      p.hpMax = p.hp = 1e7; p.mpMax = p.mp = 1e6; p.baseCrit = 0; p.crit = 0; p.setState('idle'); resetCmb(p); GT.run(2); },
    cast(id) { return castSkill(p, id, false, null); },
    key(a, hold) { input.virt[a] = hold ? 1 : 2; }, release(a) { delete input.virt[a]; },
    idle() { for (let i = 0; i < 600 && !(p.free && p.z <= 0.5 && !game.timeStop); i++) GT.run(1); return p.free; },
  };
});

// ---------------- mech ----------------
if (MODES.includes('mech')) {
  const R = await page.evaluate(() => {
    const p = game.player, out = {};
    // 1) 抛投：抓住期间无敌；不按方向 → 往前踢飞 ~300，路上撞到别人；撞墙那一下更痛
    GT.reset(); let m = GT.mob(370), o = GT.mob(560); GT.cast('fg_fling'); GT.run(12);
    out.flingHeld = { held: m.st === 'held', invul: p.invul > 0 };
    const x0 = m.x, hpO = o.hp; GT.run(20); out.flingThrown = !!m.thrown; for (let i = 0; i < 60 && m.thrown; i++) GT.run(1);
    out.fling = { dx: Math.round(m.x - x0), other: o.hp < hpO, st: m.st };
    GT.reset(); const Rm = game.room; p.x = Rm.x1 - 150; m = GT.mob(Rm.x1 - 80); const hp0 = m.hp; GT.cast('fg_fling'); GT.run(80); const wall = hp0 - m.hp;
    GT.reset(); m = GT.mob(370); const hp1 = m.hp; GT.cast('fg_fling'); GT.run(80); const ground = hp1 - m.hp;
    out.wall = { wall: Math.round(wall), ground: Math.round(ground), inRoom: m.x <= Rm.x1 };
    // 2) 暴力抓取：开着时抛投把周围 190 以内的一起卷过来（最多 5 个），更远的不管
    GT.reset(); GT.cast('fg_overgrab'); GT.run(40); out.og = !!p.buffs.fg_overgrab; p.cool = {};
    const L = [GT.mob(370), GT.mob(240, 110), GT.mob(470, 90), GT.mob(760)]; GT.cast('fg_fling'); GT.run(12);
    out.ogHeld = L.map(x => x.st === 'held'); out.ogMul = +(p.act.dmgMul || 1).toFixed(3); GT.run(80);
    // 3) 滑行抓取：冲刺中放 → 先滑过去再抓（目标在 200 外也抓得到）
    GT.reset(); m = GT.mob(510); p.setState('run'); p.vx = 300; GT.cast('fg_fling'); const slide = !!(p.act && p.act.fgSlide); GT.run(24);
    out.slide = { slide, held: m.st === 'held', moved: Math.round(p.x - 300) }; GT.run(80);
    GT.reset(); m = GT.mob(510); GT.cast('fg_fling'); GT.run(24); out.noSlideHeld = m.st === 'held'; GT.run(60);
    // 4) 连环抓取：野蛮冲撞命中后可以取消接抛投，接上的那一下伤害提高
    GT.reset(); m = GT.mob(360, 100, { set: { weight: 9 } }); GT.cast('fg_tackle'); GT.run(20);
    out.chain = { hit: p.hitsDone.size > 0, can: canCancelInto(p, 'fg_fling') }; GT.cast('fg_fling'); out.chain.cast = p.act && p.act.skill; out.chain.mul = +(p.act.dmgMul || 1).toFixed(3); GT.run(80);
    // 5) 二觉预约：浮空凌云踢抓住跳起来后按二觉 → 先把下劈 + 落地冲击波打完，再放二觉
    GT.reset(); m = GT.mob(370); GT.cast('fg_slamkick'); GT.run(16); const up = { held: m.st === 'held', z: Math.round(p.z) }, hpR = m.hp;
    GT.cast('fg_awaken2'); out.resv = { up, awk: p.act && p.act.skill, resv: !!(p.act && p.act.fgResv), dmg: Math.round(hpR - m.hp), spiked: m.vz < 0 || m.st === 'down' };
    for (let i = 0; i < 600 && (p.st === 'act' || game.timeStop > 0); i++) { if (game.timeStop > 0) { game.timeStop = 0; } GT.run(1); } out.resv.end = p.st;
    // 6) 霹雳旋踢：只抓倒地的；站着的抓不到（很快收招）
    GT.reset(); m = GT.mob(340); GT.cast('fg_snapshot'); GT.run(10); out.snapStand = { st: m.st, dur: +p.act.dur.toFixed(2) }; GT.run(60);
    GT.reset(); m = GT.mob(340); m.setState('down'); m.downTime = 9; GT.cast('fg_snapshot'); GT.run(10); const hs = m.st; GT.run(20); out.snapDown = { held: hs, st: m.st, z: Math.round(m.z) }; GT.run(60);
    // 7) 空绞锤：空中抓住前下方的敌人 → 一起砸地（倒地）→ 自己弹起来（算跳跃状态）
    GT.reset(); m = GT.mob(360); p.z = 70; p.vz = 100; p.setState('jump'); GT.cast('fg_airsteiner'); GT.run(10); const as1 = m.st;
    for (let i = 0; i < 90 && !(p.act && p.act.bounced); i++) GT.run(1); GT.run(2); out.steiner = { grabbed: as1, bounced: !!(p.act && p.act.bounced), z: Math.round(p.z), st: m.st }; GT.run(80);
    // 8) 折颈：打得转过身（背对自己）+ 强制硬直 3 秒
    GT.reset(); m = GT.mob(360); m.face = -1; GT.cast('fg_necksnap'); GT.run(14); out.neck = { face: m.face, hold: m.status && m.status.hold ? +m.status.hold.t.toFixed(2) : 0, st: m.st }; GT.run(120); out.neck.mid = m.st; GT.run(60);
    // 9) 膝击（柔道家版）：3 下 + 按 ↓ 摔地出冲击波；抓住期间无敌
    GT.reset(); m = GT.mob(350); const o2 = GT.mob(450); GT.cast('f_knee'); GT.run(8); const kinv = p.invul > 0; GT.key('down', true); GT.run(50); GT.release('down');
    out.knee = { invul: kinv, kn: p.act ? p.act.kn : null, st: m.st, other: o2.hp < o2.hpMax }; GT.run(60);
    // 10) 臂铠精通：转职技能冷却 ×0.9；装臂铠时 MP ×0.8（抓取技能不吃臂铠惩罚）
    GT.reset(); GT.cast('fg_fling'); out.cd = +(p.cool.fg_fling / (SKILLS.fg_fling.cd * (p.cdMul || 1))).toFixed(3); p.interrupt(); p.setState('idle');
    const W = inv.equip.weapon, w0 = W && W.wtype; if (W) W.wtype = 'gauntlet'; out.mp = { grab: CLASSES.fighter.mpMul(p, 'fg_fling'), phys: +CLASSES.fighter.mpMul(p, 'fg_tackle').toFixed(2) }; if (W) W.wtype = w0;
    // 11) 决斗场：对手刚被抓过（抓取保护）→ 抓轰炮有伤害但不给强制硬直
    GT.reset(); const q = makePlayer('sword', { team: 'e', pad: new Pad(), control: () => {}, kit: { bar: [], lv: {}, job: null, wtype: null } }); q.x = 360; q.y = 100; q.face = -1; ents.push(q); q.hp = q.hpMax = 1e6; q.grabProt = 1.5;
    const hq = q.hp; GT.cast('fg_fling'); GT.run(12); out.pvp = { held: q.st === 'held', dmg: q.hp < hq, hold: !!(q.status && q.status.hold), cannon: !!(p.act && p.act.fgCannoned) || p.st !== 'act' }; GT.run(60);
    // 12) 多目标流程：死亡旋律（吸过来抓住 3 个、领主只挨打、7 连击、终结）、疾风闪电（连续抓）、彗星冲击（拖着走）、武莲华（12 连打）、黑震旋风（倒插 → 爆炸弹出）
    const skip = n => { for (let i = 0; i < n; i++) { if (game.timeStop > 0) game.timeStop = 0; GT.run(1); } };
    GT.reset(); let L2 = [GT.mob(420), GT.mob(520, 80), GT.mob(200, 120)]; let bb = GT.mob(360, 100, { boss: true, set: { superArmor: 99 } }); GT.cast('fg_awaken'); skip(40);
    out.awk = { held: L2.filter(x => x.st === 'held').length, boss: bb.st !== 'held' }; let mx = 0; for (let i = 0; i < 300 && p.st === 'act'; i++) { skip(1); mx = Math.max(mx, (p.act && p.act.n) || 0); }
    out.awk.n = mx; out.awk.hit = [...L2, bb].every(x => x.hp < x.hpMax); out.awk.end = p.st; out.awk.left = L2.filter(x => x.st === 'held').length;
    GT.reset(); L2 = [GT.mob(360), GT.mob(560, 80), GT.mob(180, 120), GT.mob(640, 110)]; GT.cast('fg_stormdiver'); let most = 0; for (let i = 0; i < 200 && p.st === 'act'; i++) { GT.run(1); most = Math.max(most, grabsOf(p).length); }
    out.storm = { most, hit: L2.filter(x => x.hp < x.hpMax).length, end: p.st };
    GT.reset(); L2 = [GT.mob(380), GT.mob(480, 106)]; GT.cast('fg_pierce'); let drag = 0; for (let i = 0; i < 40; i++) { GT.run(1); drag = Math.max(drag, (p.act && p.act.drag || []).length); } GT.run(30);
    out.pierce = { drag, st: L2.map(x => x.st), moved: Math.round(p.x - 300) }; GT.idle();
    GT.reset(); m = GT.mob(360); GT.cast('fg_fury'); let fn = 0; for (let i = 0; i < 300 && p.st === 'act'; i++) { GT.run(1); fn = Math.max(fn, (p.act && p.act.n) || 0); } out.fury = { n: fn, hit: m.hp < m.hpMax, end: p.st };
    GT.reset(); m = GT.mob(360); GT.cast('fg_blacktornado'); GT.run(50); out.bt = { held: m.st === 'held', rot: +Math.abs(m.rot).toFixed(2) }; GT.run(70); out.bt.after = m.st; out.bt.z = Math.round(m.z); GT.idle();
    return out;
  });
  report('抛投：抓住期间无敌、往前踢飞 ~300 并撞到路上的敌人', R.flingHeld.held && R.flingHeld.invul && R.flingThrown && Math.abs(R.fling.dx - 300) < 40 && R.fling.other, { held: R.flingHeld, fling: R.fling });
  report('抛投撞墙：比落地更痛，人不出房间', R.wall.wall > R.wall.ground * 1.06 && R.wall.inRoom, R.wall);
  report('暴力抓取：开关 BUFF；抛投把 190 内的 3 个一起抓住、远的不抓；抓取伤害提高', R.og && R.ogHeld.join() === 'true,true,true,false' && R.ogMul > 1.1, { og: R.og, held: R.ogHeld, mul: R.ogMul });
  report('滑行抓取：冲刺中放先滑过去抓住 200 外的敌人（不冲刺抓不到）', R.slide.slide && R.slide.held && R.slide.moved > 90 && !R.noSlideHeld, { ...R.slide, noSlide: R.noSlideHeld });
  report('连环抓取：野蛮冲撞命中后能取消接抛投，接上的伤害提高', R.chain.hit && R.chain.can && R.chain.cast === 'fg_fling' && R.chain.mul > 1.08, R.chain);
  report('二觉预约：浮空凌云踢中按二觉 → 终结伤害先打完再放二觉，放完回到可行动', R.resv.up.held && R.resv.up.z > 20 && R.resv.awk === 'fg_awaken2' && R.resv.resv && R.resv.dmg > 0 && R.resv.spiked && R.resv.end !== 'act', R.resv);
  report('霹雳旋踢：站着的抓不到（很快收招），倒地的拉起来踢飞', R.snapStand.st !== 'held' && R.snapStand.dur < 0.5 && R.snapDown.held === 'held' && R.snapDown.st === 'air', { stand: R.snapStand, down: R.snapDown });
  report('空绞锤：空中抓住 → 一起砸地 → 自己弹起', R.steiner.grabbed === 'held' && R.steiner.bounced && R.steiner.z > 0 && ['air', 'down'].includes(R.steiner.st), R.steiner);
  report('折颈：敌人转过身（背对）+ 强制硬直 3 秒', R.neck.face === 1 && R.neck.hold > 2.5 && R.neck.st === 'hit' && R.neck.mid === 'hit', R.neck);
  report('膝击（柔道家版）：抓住无敌、3 下、↓ 摔地冲击波打到旁边的', R.knee.invul && R.knee.kn === 3 && R.knee.other, R.knee);
  report('臂铠精通：转职技能冷却 ×0.9；装臂铠 MP ×0.8（抓取不吃臂铠惩罚）', Math.abs(R.cd - 0.9) < 0.005 && Math.abs(R.mp.grab - 0.8) < 1e-6 && R.mp.phys < 1.2, { cd: R.cd, mp: R.mp });
  report('死亡旋律：吸过来抓住 3 个（领主不抓、照样挨打）、7 连击、终结后放开', R.awk.held === 3 && R.awk.boss && R.awk.n === 7 && R.awk.hit && R.awk.end !== 'act' && R.awk.left === 0, R.awk);
  report('疾风闪电：连续抓（同时抓着 ≥3 个）、终结打到全部', R.storm.most >= 3 && R.storm.hit === 4 && R.storm.end !== 'act', R.storm);
  report('彗星冲击：拖着路上的 2 个走，冲到尽头踢飞；突进 ≥300', R.pierce.drag === 2 && R.pierce.st.every(x => x === 'air' || x === 'down') && R.pierce.moved >= 300, R.pierce);
  report('武莲华：12 连打 → 摔 → 压，放完回到可行动', R.fury.n === 12 && R.fury.hit && R.fury.end !== 'act', R.fury);
  report('黑震旋风：倒插进地里（倒过来）→ 爆炸弹出', R.bt.held && R.bt.rot > 3 && (R.bt.after === 'air' || R.bt.after === 'down'), R.bt);
  report('决斗场：抓取保护中的对手 → 抓轰炮有伤害、不给强制硬直', !R.pvp.held && R.pvp.dmg && !R.pvp.hold, R.pvp);
}

// ---------------- boss ----------------
if (MODES.includes('boss')) {
  const R = await page.evaluate(() => {
    const p = game.player, out = {}, boss = () => GT.mob(370, 100, { boss: true, set: { superArmor: 99, weight: 3 } });
    // 1) 抓轰炮：抛投抓领主 → 伤害 ≈ 剩下的伤害、强制硬直（领主 ×0.3）、动作 0.4 秒内收招
    GT.reset(); let b = boss(); const h0 = b.hp; GT.cast('fg_fling'); let hold = 0; for (let i = 0; i < 16; i++) { GT.run(1); if (!hold && b.status && b.status.hold) hold = b.status.hold.t; }
    out.cannon = { held: b.st === 'held', hold: +hold.toFixed(2), dmg: Math.round(h0 - b.hp), cannoned: !!(p.act && p.act.fgCannoned) };
    let n = 0; while (p.st === 'act' && n < 120) { GT.run(1); n++; } out.cannon.endIn = +(n / 60).toFixed(2);
    // 2) 无情摔击撞领主：伤害 + 强制硬直、继续往前冲；学了神怡气静：原地停下出冲击波
    GT.reset(); b = boss(); const bx = p.x; const eq0 = game.skillLv.fg_equanimity; game.skillLv.fg_equanimity = 0; GT.cast('fg_breakdown'); GT.run(40); out.bd = { hold: !!(b.status && b.status.hold), moved: Math.round(p.x - bx), dmg: b.hp < b.hpMax }; GT.idle();
    GT.reset(); b = boss(); game.skillLv.fg_equanimity = 1; GT.cast('fg_breakdown'); GT.run(40); out.bdEq = { moved: Math.round(p.x - 300), hold: !!(b.status && b.status.hold) }; game.skillLv.fg_equanimity = eq0; GT.idle();
    // 3) 每个主动技能对着领主（霸体、抓不住）放：打得到、不卡死（6 秒内回到可行动）、不报错
    const ids = classSkills('fighter', 'grappler').filter(id => SKILLS[id].act && !SKILLS[id].passive && !SKILLS[id].buff), bad = [], noHit = [];
    for (const id of ids) {
      GT.reset(); b = boss(); if (id === 'fg_snapshot') { b.setState('down'); b.downTime = 9; }
      if (SKILLS[id].airOnly) { p.z = 80; p.vz = 100; p.setState('jump'); }
      const hb = b.hp; if (!GT.cast(id)) { bad.push(id + ':cast'); continue; }
      let t = 0; for (; t < 480 && !(p.free && p.z <= 0.5 && game.timeStop <= 0); t++) { if (game.timeStop > 0) game.timeStop = 0; GT.run(1); }
      if (!p.free) bad.push(`${id}:${p.st}/${p.act && p.act.name}`);
      if (b.hp >= hb) noHit.push(id);
      if (p.grabbed || b.heldBy) bad.push(id + ':grabLeft');
    }
    out.all = { n: ids.length, bad, noHit };
    return out;
  });
  report('抓轰炮：领主抓不住 → 伤害 + 强制硬直（×0.3 ≈ 0.45 秒）、0.4 秒内收招', !R.cannon.held && R.cannon.cannoned && R.cannon.dmg > 0 && Math.abs(R.cannon.hold - 0.45) < 0.1 && R.cannon.endIn <= 0.45, R.cannon);
  report('无情摔击撞领主：伤害 + 强制硬直后继续冲；神怡气静：原地停下', R.bd.hold && R.bd.dmg && R.bd.moved > 150 && R.bdEq.moved < R.bd.moved - 40 && R.bdEq.hold, { bd: R.bd, eq: R.bdEq });
  report(`全部主动技能对领主：不卡死、抓取不残留（${R.all.n} 个）`, !R.all.bad.length, R.all.bad);
  report('全部主动技能对领主都打得到（分身 / 瞬步 / 蹲伏这类不攻击的基础技能除外）', !R.all.noHit.filter(id => !['f_clone', 'f_flash', 'f_crouch'].includes(id)).length, R.all.noHit);
}

// ---------------- shots ----------------
if (MODES.includes('shots')) {
  const dir = 'test/shots/grappler'; fs.mkdirSync(dir, { recursive: true });
  const shot = async (name, setup, frames) => {
    await page.evaluate(setup);
    for (const [n, f] of frames.entries()) {
      await page.evaluate(f => { for (let i = 0; i < f; i++) { if (game.timeStop > 0) game.timeStop = 0; GT.run(1); } }, f);
      await page.waitForTimeout(80);
      const pos = await page.evaluate(() => { const p = game.player; return { x: (p.x - cam.x), y: (FLOOR_Y + p.y - p.z) }; });
      await page.screenshot({ path: `${dir}/${name}-${n}.png`, clip: { x: Math.max(0, Math.min(960 - 480, pos.x - 200)), y: Math.max(0, Math.min(540 - 300, pos.y - 220)), width: 480, height: 300 } });
    }
  };
  await shot('cannon', () => { GT.reset(); GT.mob(370, 100, { boss: true, set: { superArmor: 99 } }); GT.cast('fg_fling'); }, [14, 4]);
  await shot('overgrab', () => { GT.reset(); GT.cast('fg_overgrab'); GT.run(40); game.player.cool = {}; GT.mob(370); GT.mob(250, 115); GT.mob(460, 90); GT.cast('fg_fling'); }, [14, 12]);
  await shot('awaken', () => { GT.reset(); GT.mob(420); GT.mob(480, 80); GT.mob(470, 120); GT.cast('fg_awaken'); }, [30, 50, 50, 20]);
  await shot('awaken3', () => { GT.reset(); GT.mob(420, 100, { boss: true, set: { superArmor: 99 } }); GT.mob(360, 80); GT.cast('fg_awaken3'); }, [30, 60, 50, 40, 30]);
  console.log('截图：' + dir);
}
const errs = logs.filter(l => l.type === 'pageerror' || l.type === 'error'); report('无报错', errs.length === 0, errs.slice(0, 3));
await browser.close();
console.log(fail ? `${fail} 项失败` : '全部通过');
process.exit(fail ? 1 : 0);
