// 街霸（男格斗家转职 brawler，B6）机制测试：node test/brawler.mjs [load,throws,status,grab,chain,awaken,shots]（默认除 shots 以外全部，约 1 分钟）
//   load    页面加载无报错、30 个技能都定义了、指令表 / 动画片段 / 觉醒登记、图标 / 觉醒插图 / 转职立绘都在
//   throws  4 种投掷物装填：每投耗 1、再投间隔、用完进入装填冷却后自动装满（扣 MP）；强化投掷多耗（毒瓶 2 / 砖块 3 / 毒针 4 / 罗网 2）、
//           后街战术一次扔两个（耗 2，罗网除外）、强化投掷优先；千手奥义加装填数；诡诈之道：从毒雷取消接投掷不耗投掷物且霸体
//   status  异常：毒瓶中毒、毒针出血、罗网强制硬直 + 束缚；按异常个数加伤（擒月炎 3 个异常 ≈ 1.6 倍）；挑衅光环 / 伤害加深；剧毒抵抗
//   grab    擒月炎抓起引爆、伏虎霸王拳（骑乘 3 拳、全程无敌、按跳跃直接终结、能抓倒地）、狂·霸王拳（1 拳 + 冲击波，领主也能打）、暗街夺命锁（多目标抓起摔下，↑ 扔最远）
//   chain   极恶飞锁（8 段、终结拉到身前）、千锁乱舞（远处的敌人拉到身前）、飞沙走石（设置型，放完能行动、碎石继续落）
//   awaken  三个觉醒：有插图名、无敌、打中、天崩地裂留下火焰地带并装满投掷物、燃火轰天炮按压制时的异常数加伤
//   shots   逐技能连拍（测试房间 + 冻结木桩，先开后街战术）→ test/shots/brawler/<技能>_<0~4>.png（给人看，不判定）；node test/brawler.mjs shots fb_hook,fb_mount 只拍几个
import { launch, URL_BASE } from './lib.mjs';
import fs from 'fs';
const MODES = (process.argv[2] || 'load,throws,status,grab,chain,awaken').split(',');
let fail = 0;
const report = (name, ok, info) => { if (!ok) fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${JSON.stringify(info)}`); };
const { browser, page, logs } = await launch({ width: 960, height: 540 });
await page.goto(`${URL_BASE}?test&cls=fighter&fighter=1&mobs=0&mute`); await page.waitForFunction(() => window.__READY, null, { timeout: 60000 });
// 公共：转职街霸、全部技能 5 级（觉醒 3 级）、MP 无限；T.dummy(dx, o) 放一个冻结的木桩；T.run(n) 逐帧；T.reset() 复原人物
await page.evaluate(() => {
  game.paused = true; window.toastMsg = () => {};
  const p = game.player; game.job = 'brawler'; Object.assign((save.data.flags ??= {}), { awaken: true, awaken2: true, awaken3: true });
  onJobChange(p, 'brawler');
  for (const id of classSkills('fighter', 'brawler')) game.skillLv[id] = Math.max(1, Math.min(SKILLS[id].maxLv || 5, 5));
  const T = window.T = {
    p, run: n => { for (let i = 0; i < n; i++) step(1 / 60); },
    clear() { for (const e of ents) if (e.team === 'e') e.remove = true; projs.length = 0; step(1 / 60); },
    dummy(dx = 80, o = {}) { const m = spawnMonster(o.kind || 'goblin', p.x + p.face * dx, p.y + (o.dy || 0)); m.control = null; m.hp = m.hpMax = 1e9; m.invul = 0; Object.assign(m, o.set || {}); return m; },
    reset(o = {}) { clearAllSummons(); T.clear(); Object.assign(p, { x: 500, y: 100, z: 0, vz: 0, vx: 0, vy: 0, face: 1, cool: {}, mp: 1e6, mpMax: 1e6, buffs: {}, status: {}, invul: 0, dead: false, hp: p.hpMax }); p.act = null; p.grabbed = null; p.grabMore = null; p.setState('idle'); if (!o.keepCharges) p.charges = {}; T.run(2); },
    cast(id) { const ok = castSkill(p, id); return ok; },
    key(a, hold) { input.virt[a] = hold ? 1 : 2; }, release(a) { delete input.virt[a]; },
    dmgLog() { const L = []; const oh = game.onPlayerHit; game.onPlayerHit = function (t, d) { L.push({ id: t.id, d }); return oh.apply(this, arguments); }; return { L, stop() { game.onPlayerHit = oh; } }; },
  };
  T.reset();
});

// ---------------- load ----------------
if (MODES.includes('load')) {
  await page.evaluate(() => typeof loadBundles === 'function' ? loadBundles(['job']) : null);   // 转职立绘是分包按需加载的
  const R = await page.evaluate(() => {
    const J = CLASSES.fighter.jobs.brawler, ids = FIGHTER_IDS.brawler;
    const cmdIds = CLASSES.fighter.cmds.map(c => c[1]).filter(id => id.startsWith('fb_'));
    const actives = J.skills.filter(id => SKILLS[id] && !SKILLS[id].passive);
    return { n: J.skills.length, missing: ids.filter(id => !J.skills.includes(id) || !SKILLS[id]), noCmd: actives.filter(id => !cmdIds.includes(id)), awk: [J.awaken, J.awaken2, J.awaken3].map(id => !!(SKILLS[id] && SKILLS[id].awaken)),
      ready: J.ready, dmg: J.dmgType, armor: J.armor, anims: Object.keys(J.anims || {}).length, clips: Object.keys(J.anims || {}).filter(k => !CLIPS.fighter[k]),
      noIcon: J.skills.filter(id => !IMG['icon/' + id]), art: ['cutin/brawler', 'cutin/brawler2', 'cutin/brawler3', 'job/brawler'].filter(k => !IMG[k]),
      mag: J.skills.filter(id => SKILLS[id] && SKILLS[id].type !== 'mag'), txt: J.skills.filter(id => !SKILLS[id].desc || SKILLS[id].desc.length < 20), cmdTxt: SKILLS.fb_strong.cmdTxt, auto: J.auto, learned: J.auto.every(id => game.skillLv[id] > 0) };
  });
  report('30 个技能都定义了且都在转职技能表里', R.n === 30 && !R.missing.length, { n: R.n, missing: R.missing });
  report('主动技能都有指令（强化投掷 ←→+C）', !R.noCmd.length && R.cmdTxt === '指令：←→+C', { noCmd: R.noCmd, cmd: R.cmdTxt });
  report('一 / 二 / 三觉登记、已开放、魔法 / 重甲', R.awk.every(Boolean) && R.ready === true && R.dmg === 'mag' && R.armor === 'heavy', R);
  report('动作片段都有矢量占位', R.anims >= 10 && !R.clips.length, { anims: R.anims, clips: R.clips });
  report('美术：30 个技能图标、三张觉醒插图、转职立绘都在', !R.noIcon.length && !R.art.length, { noIcon: R.noIcon, art: R.art });
  report('技能都是魔法、都有说明；转职自动学会 4 个被动', !R.mag.length && !R.txt.length && R.learned, { mag: R.mag, txt: R.txt, auto: R.auto });
}

// ---------------- throws ----------------
if (MODES.includes('throws')) {
  const R = await page.evaluate(() => {
    const p = T.p, out = {};
    const Q = id => chargesOf(p, id);
    // 毒瓶：10 瓶；投 1 次剩 9，再投间隔 2 秒 × 刷图冷却基准
    T.reset(); T.dummy(200); T.cast('fb_poison'); T.run(40);
    out.poison1 = { n: Q('fb_poison').n, cap: fbCap(p, 'fb_poison'), cd: +(p.cool.fb_poison || 0).toFixed(2), want: +(fbRethrow(p, 'fb_poison') - 40 / 60).toFixed(2) };
    // 连投到空：进入装填冷却；冷却结束后被动刷新装满（扣 30 MP）
    T.reset(); let casts = 0; for (let i = 0; i < 16; i++) { if (!(Q('fb_poison').rl)) p.cool.fb_poison = 0; const n0 = Q('fb_poison').n; T.cast('fb_poison'); if (Q('fb_poison').n < n0 || Q('fb_poison').rl && n0 > 0) casts++; T.run(20); }
    out.empty = { casts, cap: fbCap(p, 'fb_poison'), n: Q('fb_poison').n, rl: !!Q('fb_poison').rl, cd: +(p.cool.fb_poison || 0).toFixed(2), want: +fbReloadT(p, 'fb_poison').toFixed(2) };
    const rg = p.mpRegen; p.mpRegen = 1e-9; const mp0 = p.mp; T.run(Math.ceil((p.cool.fb_poison + 0.6) * 60)); out.refill = { n: Q('fb_poison').n, rl: !!Q('fb_poison').rl, mp: Math.round(mp0 - p.mp) }; p.mpRegen = rg;
    // 强化投掷：毒瓶 2 / 砖块 3 / 毒针 4 / 罗网 2；只强化一次
    const strong = {}; for (const id of FB_THROWS) { T.reset(); T.dummy(200); const n0 = fbCap(p, id); castSkill(p, 'fb_strong'); const had = !!p.buffs.fb_strong; T.run(5); T.cast(id); T.run(80); strong[id] = { used: n0 - Q(id).n, had, left: !!p.buffs.fb_strong }; }
    out.strong = strong;
    // 强化毒针一次扔 4 根，普通 1 根
    T.reset(); T.dummy(200); let n0 = projs.length; T.cast('fb_needle'); T.run(8); out.needle1 = projs.length - n0;
    T.reset(); T.dummy(200); castSkill(p, 'fb_strong'); T.run(3); n0 = projs.length; T.cast('fb_needle'); T.run(8); out.needle4 = projs.length - n0;
    // 后街战术：两连投（耗 2）；罗网不连投；强化投掷优先（只耗强化的数量、只扔一次）
    T.reset(); T.cast('fb_backstreet'); T.run(40); out.bs = !!p.buffs.fb_backstreet;
    const bsKeep = { ...p.buffs }; const bsCast = id => { T.reset(); p.buffs = { ...bsKeep }; T.dummy(220); const n0 = fbCap(p, id), m0 = projs.length; T.cast(id); let mx = 0; for (let i = 0; i < 40; i++) { T.run(1); mx = Math.max(mx, projs.length - m0); } T.run(60); return { used: n0 - Q(id).n, proj: mx }; };
    out.bsPoison = bsCast('fb_poison'); out.bsNeedle = bsCast('fb_needle'); out.bsNet = bsCast('fb_net');
    T.reset(); p.buffs = { ...bsKeep }; castSkill(p, 'fb_strong'); T.run(3); T.dummy(220); T.cast('fb_poison'); T.run(80); out.bsStrong = { used: fbCap(p, 'fb_poison') - Q('fb_poison').n };
    // 千手奥义：装填数 +1
    T.reset(); const c0 = fbCap(p, 'fb_needle'); const th = game.skillLv.fb_thousand; game.skillLv.fb_thousand = 0; const c1 = fbCap(p, 'fb_needle'); game.skillLv.fb_thousand = th; out.thousand = [c1, c0];
    // 强化投掷：没有后备口袋时动作中不能按；有后备口袋时普攻中能按
    T.reset(); const pk = game.skillLv.fb_pocket; game.skillLv.fb_pocket = 0; p.doAct(p.acts.atk1); T.run(2); out.noPocket = SKILLS.fb_strong.req(p); game.skillLv.fb_pocket = pk; out.pocket = SKILLS.fb_strong.req(p); T.run(40);
    // 诡诈之道：毒雷引爆中取消接毒针 → 不耗投掷物、霸体
    T.reset(); T.dummy(200); T.cast('fb_mine'); T.run(24); const nb = Q('fb_needle').n; const can = canCancelInto(p, 'fb_needle'); T.cast('fb_needle'); T.run(1);
    out.rb = { can, act: p.act && p.act.skill, same: Q('fb_needle').n === nb, sa: !!(p.act && p.act.superArmor) };
    return out;
  });
  report('毒瓶：装填数（10 + 千手奥义），投 1 次少 1，再投间隔 2 秒（× 冷却基准 × 千手奥义）', R.poison1.n === R.poison1.cap - 1 && Math.abs(R.poison1.cd - R.poison1.want) < 0.03, R.poison1);
  report('投空后进入装填冷却（7 秒 × 冷却基准），之后自动装满并扣 30 MP', R.empty.casts === R.empty.cap && R.empty.n === 0 && R.empty.rl && R.refill.n === R.empty.cap && !R.refill.rl && R.refill.mp === 30, { ...R.empty, refill: R.refill });
  report('强化投掷多耗：毒瓶 2 / 砖块 3 / 毒针 4 / 罗网 2，只强化一次', R.strong.fb_poison.used === 2 && R.strong.fb_brick.used === 3 && R.strong.fb_needle.used === 4 && R.strong.fb_net.used === 2 && Object.values(R.strong).every(s => s.had && !s.left), R.strong);
  report('毒针：普通 1 根，强化扇形 4 根', R.needle1 === 1 && R.needle4 === 4, { n1: R.needle1, n4: R.needle4 });
  report('后街战术：毒瓶 / 毒针一次扔 2 个（耗 2），罗网不连投；强化投掷优先', R.bs && R.bsPoison.used === 2 && R.bsPoison.proj >= 2 && R.bsNeedle.used === 2 && R.bsNeedle.proj >= 2 && R.bsNet.used === 1 && R.bsStrong.used === 2, { poison: R.bsPoison, needle: R.bsNeedle, net: R.bsNet, strong: R.bsStrong });
  report('千手奥义：装填数增加（5 级 +2）', R.thousand[0] === 10 && R.thousand[1] === 12, R.thousand);
  report('强化投掷：没后备口袋动作中不能按，有后备口袋普攻中能按', R.noPocket !== true && R.pocket === true, { noPocket: R.noPocket, pocket: R.pocket });
  report('诡诈之道：毒雷中取消接毒针，不耗投掷物、霸体', R.rb.can && R.rb.act === 'fb_needle' && R.rb.same && R.rb.sa, R.rb);
}

// ---------------- status ----------------
if (MODES.includes('status')) {
  const R = await page.evaluate(() => {
    const p = T.p, out = {};
    const st = m => Object.keys(m.status || {}).sort();
    T.reset(); let m = T.dummy(200); T.cast('fb_poison'); T.run(60); out.poison = st(m);
    T.reset(); m = T.dummy(160); T.cast('fb_needle'); T.run(40); out.needle = st(m);
    T.reset(); m = T.dummy(160); T.cast('fb_net'); T.run(40); out.net = st(m);
    // 擒月炎：0 个异常 vs 3 个异常（中毒 / 出血 / 减速）的伤害比
    const hook = pre => { T.reset(); p.mcrit = p.crit = p.baseCrit = 0; const m = T.dummy(70); if (pre) { addStatus(m, 'poison', 30); addStatus(m, 'bleed', 30); addStatus(m, 'slow', 30); } const h0 = m.hp; const L = T.dmgLog(); Math.random = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })(); T.cast('fb_hook'); T.run(70); L.stop(); return { dmg: h0 - m.hp, hits: L.L.map(x => Math.round(x.d)) }; };
    const r0 = Math.random; const a = hook(false), b = hook(true); Math.random = r0; out.hook = { a, b, ratio: +(b.dmg / a.dmg).toFixed(2) };
    // 挑衅：光环内的敌人异常持续时间变长；被打中的敌人受到伤害加深
    T.reset(); m = T.dummy(90); T.cast('fb_taunt'); T.run(40); out.taunt = { buff: !!p.buffs.fb_taunt, taunted: !!(m.status && m.status.taunt), aura: m._fbAura > game.t };
    T.cast('fb_needle'); T.run(30); out.taunt.ti = !!(m.buffs && m.buffs.fb_ti && m.buffs.fb_ti.taken > 0);
    // 剧毒抵抗：自己中毒 dps ×0.75
    T.reset(); addStatus(p, 'poison', 5, { dps: 100 }); T.run(20); out.res = p.status.poison ? p.status.poison.dps : null;
    return out;
  });
  report('毒瓶中毒、毒针出血、罗网强制硬直 + 束缚', R.poison.includes('poison') && R.needle.includes('bleed') && R.net.includes('hold') && R.net.includes('bind'), { poison: R.poison, needle: R.needle, net: R.net });
  report('擒月炎：3 个异常时伤害提高（官方每个 +20%，后踢 + 爆炸 ×1.6，扫腿不加）', R.hook.ratio > 1.3 && R.hook.ratio < 1.75, R.hook);
  report('挑衅：BUFF、嘲讽、光环、伤害加深', R.taunt.buff && R.taunt.taunted && R.taunt.aura && R.taunt.ti, R.taunt);
  report('剧毒抵抗：中毒伤害 -25%', R.res === 75, { dps: R.res });
}

// ---------------- grab ----------------
if (MODES.includes('grab')) {
  const R = await page.evaluate(() => {
    const p = T.p, out = {};
    // 擒月炎：抓住一个敌人挑到空中再引爆
    T.reset(); let m = T.dummy(70); T.cast('fb_hook'); let maxZ = 0, held = false; for (let i = 0; i < 60; i++) { T.run(1); maxZ = Math.max(maxZ, m.z); held = held || m.st === 'held'; } out.hook = { held, maxZ: Math.round(maxZ) };
    // 伏虎霸王拳：抓住、全程无敌、3 拳 + 终结；按跳跃直接终结
    game.skillLv.fb_vulcan = 0;
    T.reset(); m = T.dummy(60); const L = T.dmgLog(); T.cast('fb_mount'); let inv = true, heldN = 0; for (let i = 0; i < 110; i++) { T.run(1); if (p.act && p.act.skill === 'fb_mount' && p.invul <= 0) inv = false; if (m.st === 'held') heldN++; } L.stop();
    out.mount = { inv, heldN, hits: L.L.length, end: p.st };
    T.reset(); m = T.dummy(60); T.cast('fb_mount'); T.run(24); T.key('jump'); T.run(1); T.release('jump'); let fr = 0; while (p.act && p.act.skill === 'fb_mount' && fr < 200) { T.run(1); fr++; }
    out.skip = { left: fr, z: p.z, st: p.st };
    // 能抓倒地的敌人
    T.reset(); m = T.dummy(60); m.setState('down'); m.stT = 0; m.downTime = 9; T.cast('fb_mount'); T.run(12); out.mountDown = m.st === 'held';
    // 狂·霸王拳：1 拳 + 冲击波；领主抓不住也打得到
    game.skillLv.fb_vulcan = 3;
    T.reset(); m = T.dummy(60, { set: { boss: true } }); const m2 = T.dummy(130, { dy: 20 }); const h1 = m.hp, h2 = m2.hp; T.cast('fb_mount'); T.run(80); out.vulcan = { boss: h1 - m.hp > 0, near: h2 - m2.hp > 0, bossHeld: m.st === 'held' };
    // 暗街夺命锁：3 个敌人一起抓起来摔；按住 ↑ 扔到最远
    const cd = up => { T.reset(); const L = [T.dummy(170), T.dummy(210, { dy: 20 }), T.dummy(240, { dy: -20 })]; T.cast('fb_chaindrive'); let maxHeld = 0;
      for (let i = 0; i < 130; i++) { if (up && i === 60) T.key('up', true); T.run(1); maxHeld = Math.max(maxHeld, L.filter(q => q.st === 'held').length); }
      T.release('up'); T.run(40); return { maxHeld, xs: L.map(q => Math.round(q.x - p.x)) }; };
    out.chaindrive = { a: cd(false), b: cd(true) };
    return out;
  });
  report('擒月炎：抓住一个敌人踢到空中再引爆', R.hook.held && R.hook.maxZ > 40, R.hook);
  report('伏虎霸王拳：抓住骑乘，全程无敌，3 拳 + 终结（≥ 5 次命中）', R.mount.inv && R.mount.heldN > 40 && R.mount.hits >= 5, R.mount);
  report('伏虎霸王拳：骑乘中按跳跃直接终结', R.skip.left < 40, R.skip);
  report('伏虎霸王拳：能抓倒地的敌人', R.mountDown, { down: R.mountDown });
  report('狂·霸王拳：领主抓不住也吃到拳和冲击波，旁边的敌人吃冲击波', R.vulcan.boss && R.vulcan.near && !R.vulcan.bossHeld, R.vulcan);
  report('暗街夺命锁：多个敌人一起抓起摔下；按 ↑ 扔得更远', R.chaindrive.a.maxHeld >= 2 && Math.max(...R.chaindrive.b.xs) > Math.max(...R.chaindrive.a.xs) + 100, R.chaindrive);
}

// ---------------- chain ----------------
if (MODES.includes('chain')) {
  const R = await page.evaluate(() => {
    const p = T.p, out = {};
    T.reset(); let m = T.dummy(180); const back = T.dummy(-150); let L = T.dmgLog(); T.cast('fb_lariat'); T.run(150); L.stop();
    out.lariat = { hitsFront: L.L.filter(x => x.id === m.id).length, hitsBack: L.L.filter(x => x.id === back.id).length, pulled: Math.round(Math.abs(m.x - p.x)), bleed: !!(m.status && m.status.bleed) };
    T.reset(); m = T.dummy(450); L = T.dmgLog(); T.cast('fb_chain'); T.run(120); L.stop(); out.chain = { pulled: Math.round(Math.abs(m.x - p.x)), hits: L.L.length };
    T.reset(); m = T.dummy(250); L = T.dmgLog(); T.cast('fb_cavein'); T.run(50); const freeAt = p.free; T.run(130); L.stop(); out.cavein = { freeAt, hits: L.L.length, stun: !!(m.status && m.status.stun) || m.st === 'hit' || m.st === 'air' || m.st === 'down' };
    return out;
  });
  report('极恶飞锁：前后都打得到、8 段 + 终结、出血、终结拉到身前', R.lariat.hitsFront >= 8 && R.lariat.hitsBack >= 4 && R.lariat.pulled < 110 && R.lariat.bleed, R.lariat);
  report('千锁乱舞：450px 外的敌人被拉到身前', R.chain.pulled < 140 && R.chain.hits >= 1, R.chain);
  report('飞沙走石：设置型（0.8 秒后能行动），碎石继续落下打中', R.cavein.freeAt && R.cavein.hits >= 3, R.cavein);
}

// ---------------- awaken ----------------
if (MODES.includes('awaken')) {
  const R = await page.evaluate(() => {
    const p = T.p, out = {};
    for (const id of ['fb_awaken', 'fb_awaken2', 'fb_awaken3']) {
      T.reset(); const m = T.dummy(200), h0 = m.hp; if (id === 'fb_awaken') { const Q = chargesOf(p, 'fb_needle'); Q.n = 3; }
      T.cast(id); const cut = game.cutin && game.cutin.name; let inv = true, n = 0;
      for (let i = 0; i < 260; i++) { T.run(1); if (p.act && p.act.skill === id) { n++; if (p.invul <= 0 && game.timeStop <= 0) inv = false; } }
      out[id] = { cut, inv, frames: n, dmg: h0 - m.hp > 0, zone: id === 'fb_awaken' ? SUMMONS.some(s => s.skey === 'fb_firezone' && !s.gone) : undefined, needle: id === 'fb_awaken' ? chargesOf(p, 'fb_needle').n : undefined };
    }
    // 燃火轰天炮：压制时 3 个异常 → 伤害 ×1.75 左右
    const r0 = Math.random; const aw2 = pre => { T.reset(); p.mcrit = p.crit = p.baseCrit = 0; const m = T.dummy(160); if (pre) { addStatus(m, 'poison', 30); addStatus(m, 'bleed', 30); addStatus(m, 'slow', 30); } const h0 = m.hp; Math.random = () => 0.5; T.cast('fb_awaken2'); T.run(200); return h0 - m.hp; };
    const a = aw2(false), b = aw2(true); Math.random = r0; out.aw2 = +(b / a).toFixed(2);
    return out;
  });
  for (const id of ['fb_awaken', 'fb_awaken2', 'fb_awaken3']) report(`${id}：插图名、全程无敌、打中`, !!R[id].cut && R[id].inv && R[id].dmg, R[id]);
  report('天崩地裂：留下火焰地带、装满投掷物', R.fb_awaken.zone && R.fb_awaken.needle >= 10, { zone: R.fb_awaken.zone, needle: R.fb_awaken.needle });
  report('燃火轰天炮：3 个异常 → 伤害约 ×1.75（官方每个 +25%）', R.aw2 > 1.6 && R.aw2 < 1.9, { ratio: R.aw2 });
}

// ---------------- shots ----------------
if (MODES.includes('shots')) {
  const dir = 'test/shots/brawler'; fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  await page.evaluate(() => { game.paused = true; document.querySelectorAll('#ui,#dom').forEach(e => { e.style.visibility = 'hidden'; }); });
  const ids = (process.argv[3] || '').split(',').filter(Boolean);
  const list = ids.length ? ids : await page.evaluate(() => CLASSES.fighter.jobs.brawler.skills.filter(id => !SKILLS[id].passive));
  for (const id of list) {
    const frames = await page.evaluate(id => { T.reset(); T.dummy(90); T.dummy(220, { dy: 30 }); T.dummy(-120, { dy: -20 }); game.cutin = null; if (id !== 'fb_strong') { castSkill(T.p, 'fb_backstreet'); T.run(40); T.p.cool = {}; }
      if (['fb_poison', 'fb_needle', 'fb_brick', 'fb_net'].includes(id) && id !== 'fb_net') delete T.p.buffs.fb_backstreet;
      castSkill(T.p, id); const S = SKILLS[id], dur = Math.min(3.2, Math.max(0.6, (T.p.act ? T.p.act.dur : 0.6) + 0.5)); return Math.round(dur * 60); }, id);
    const shots = 5, every = Math.max(1, Math.floor(frames / shots));
    for (let i = 0; i < shots; i++) {
      await page.evaluate(n => { T.run(n); game.timeStop = 0; game.cutin = null; }, every);
      await page.waitForTimeout(80);
      const pos = await page.evaluate(() => { const p = T.p; return { x: p.x - cam.x, y: FLOOR_Y + p.y - p.z }; });
      await page.screenshot({ path: `${dir}/${id}_${i}.png`, clip: { x: Math.max(0, Math.min(960 - 640, pos.x - 220)), y: Math.max(0, Math.min(540 - 320, pos.y - 250)), width: 640, height: 320 } });
    }
  }
  console.log('shots', list.length, dir);
}

const errs = logs.filter(l => l.type === 'pageerror' || l.type === 'error'); report('无报错', errs.length === 0, errs.slice(0, 3));
await browser.close();
console.log(fail ? `${fail} 项失败` : '全部通过');
process.exit(fail ? 1 : 0);
