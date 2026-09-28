// 魔道学者（mage_witch.js）：暂停游戏循环、手动逐帧推进验证。node test/witch.mjs（阶段交付时再跑一次 node test/classes.mjs mage:witch：按键放技能栏上的技能）
// 转职登记 / 指令 / 任务；成功率（基础、被动、贤者之石、糖果、强制失败）；扫把飞行（6 连击、冲刺、缓降、没扫把不能飞）；
// 每个主动技能都放一遍（伤害、召唤物 / 机械的生命周期、搭乘时免疫与减伤、引爆实验、苦涩的棒棒糖）；三个觉醒；转职送扫把
import { launch, URL_BASE } from './lib.mjs';
import fs from 'fs';
const SHOTS = process.argv.includes('--shots'), out = 'test/shots/witch'; if (SHOTS) fs.mkdirSync(out, { recursive: true });
let fail = 0;
const report = (name, ok, info) => { if (!ok) fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${JSON.stringify(info)}`); };
const { browser, page, logs } = await launch({ width: 960, height: 540 });
await page.goto(`${URL_BASE}?test&cls=mage&mobs=0&mute`); await page.waitForFunction(() => window.__READY, null, { timeout: 30000 });
await page.evaluate(() => loadBundles(['spr:shululu', 'spr:furnace', 'spr:drill', 'spr:tesla', 'spr:antigrav', 'spr:goblin', 'spr:tau'].filter(b => Object.values(ASSET_BUNDLE).includes(b))));
const R = await page.evaluate(() => {
  game.paused = true;
  const run = n => { for (let i = 0; i < n; i++) { input.frame(game.t); step(1 / 60); } };
  const p = game.player, out = {};
  const mob = (x = 420, y = 100, kind = 'goblin') => { const m = spawnMonster(kind, x, y); m.control = null; m.invul = 0; m.hp = m.hpMax = 1e9; m.evade = 0; m.def = 0; m.mdef = 0; m.acd = m.acd.map(() => 99); return m; };
  const clear = () => { clearAllSummons('test'); for (const e of ents) if (e !== p) e.remove = true; run(1); projs.length = 0; p.act = null; p.setState('idle'); p.z = 0; p.vz = 0; p.x = 300; p.y = 100; p.face = 1; p.scale = 1; p.drawFlip = false; for (const k in p.cool) p.cool[k] = 0; p.mp = p.mpMax = 99999; p.hp = p.hpMax; p.invul = 0; };
  // ---- 1. 转职登记 / 指令 / 任务 ----
  const J = CLASSES.mage.jobs.witch;
  out.job = { ok: !!J, n: J && J.skills.length, missing: J ? J.skills.filter(id => !SKILLS[id]) : ['job'], awaken: J && J.awaken, trial: J && J.trial,
    cmds: CLASSES.mage.cmds.filter(c => SKILLS[c[1]] && SKILLS[c[1]].job === 'witch').length, quests: !!QUESTS.q_job_witch_1 && !!QUESTS.q_job_witch_2 };
  // 转职：送扫把、切换普攻表
  game.job = 'witch'; const nInv = inv.items.length; bus.emit('jobChange', { job: 'witch' }); if (typeof onJobChange === 'function') onJobChange(p, 'witch');
  const broom = inv.items.find(it => it && it.wtype === 'broom'); out.gift = { got: !!broom, name: broom && broom.name, added: inv.items.length - nInv };
  for (const id in SKILLS) if (SKILLS[id].job === 'witch') game.skillLv[id] = SKILLS[id].maxLv >= 10 ? 10 : SKILLS[id].maxLv;
  const P1PASSIVE = ['wt_helper', 'wt_pink', 'wt_stone']; for (const id of P1PASSIVE) game.skillLv[id] = 0;   // 这三个会改变别的技能的行为，后面单独测
  Object.assign(p, { matk: 1000, atk: 1000, indep: 1000, crit: 0, mcrit: 0, dmgUp: 0, hitRate: 1, buffs: {} });
  p.mp = p.mpMax = 99999;
  // ---- 2. 成功率 ----
  const dist = (n = 3000) => { const c = { fail: 0, ok: 0, great: 0, super: 0 }; for (let i = 0; i < n; i++) c[rollCraft(p, 'jack')]++; fxList.length = 0; for (const k in c) c[k] = +(c[k] / n).toFixed(3); return c; };
  const sv = { ...game.skillLv }; game.skillLv.wt_affinity = 0; game.skillLv.wt_lucky = 0; game.skillLv.wt_stone = 0; game.skillLv.wt_premonition = 0;
  out.oddsBase = dist();
  game.skillLv.wt_affinity = 10; game.skillLv.wt_lucky = 10; out.oddsMax = dist();
  game.skillLv.wt_stone = 1; out.oddsStone = dist();
  game.skillLv.wt_stone = 0; p.buffs.wt_candy = { t: 30 }; out.candy = { r: rollCraft(p, 'eel'), used: !p.buffs.wt_candy };
  out.force = rollCraft(p, 'jack', { force: 'fail' });
  Object.assign(game.skillLv, sv); delete p.buffs.wt_candy;
  // ---- 3. 扫把飞行 ----
  inv.equip.weapon = broom; if (typeof recalcStats === 'function') recalcStats(p); Object.assign(p, { indep: 1000, matk: 1000, atk: 1000, buffs: {}, crit: 0, mcrit: 0, hitRate: 1 }); p._psvT = 0; tickPassives(p, 0.3);
  out.ride = { ride: p._ride, airMax: airMaxOf(p), acts: p.acts === WITCH_ACTS };
  clear(); p.vz = p.jumpV; p.z = 0.5; p.setState('jump'); run(8);
  const fake = (o = {}) => ({ hit: k => k === o.hit, runDir: o.runDir || 0, is: k => !!(o.is && o.is[k]), dx: () => 0, dy: () => 0, buffered: () => false, consume: () => false });
  const z0 = p.z; witchAir(p, fake({ hit: 'right', runDir: 1 }), 1 / 60, false); run(6); out.dash = { dashing: p._airDashT > 0 || Math.abs(p.vx) > 300, vx: Math.round(p.vx), n: p._dashN };
  witchAir(p, fake({ hit: 'right', runDir: 1 }), 1 / 60, false); p._airDashT = 0; witchAir(p, fake({ hit: 'right', runDir: 1 }), 1 / 60, false); out.dash.cap = p._dashN;
  p._airDashT = 0; run(20); p.vz = -300; witchAir(p, fake({ is: { jump: true } }), 1 / 60, false); out.glide = { vz: Math.round(p.vz), n: p._glideN };
  // 6 连击：连续空中攻击
  clear(); p.setState('jump'); p.airAtk = 0; let n6 = 0; for (let i = 0; i < 8; i++) { p.z = 150; p.vz = 0; if (p.st !== 'act') p.setState('jump'); if (p.airAtk < airMaxOf(p)) { p.airAtk++; p.doAct(p.acts.jatk); n6++; } run(20); }
  out.air6 = n6;
  // 没有扫把：不能飞
  inv.equip.weapon = null; p._psvT = 0; tickPassives(p, 0.3); out.noBroom = { ride: p._ride, airMax: airMaxOf(p) }; inv.equip.weapon = broom; p._psvT = 0; tickPassives(p, 0.3);
  // ---- 4. 每个主动技能 ----
  const skills = {}, stub = Math.random;
  const cast = (id, o = {}) => { clear(); const ms = (o.mobs || [[420, 100]]).map(([x, y]) => mob(x, y)); if (o.air) { p.z = 120; p.vz = 0; p.setState('jump'); }
    if (o.force) p.wtForce = o.force; const hp0 = ms.map(m => m.hp); const ok = castSkill(p, id, false, null); const st = { ok, act: p.act && p.act.name };
    if (o.during) o.during(st); run(o.frames || 240); if (o.after) o.after(st);
    st.dmg = Math.round(ms.reduce((s, m, i) => s + (hp0[i] - m.hp), 0)); delete p.wtForce; skills[o.tag || id] = st; st.ms = ms; return st; };
  cast('wt_book', { frames: 40, after: s => { s.buff = !!p.buffs.wt_book; } });
  cast('wt_powder', { frames: 40, after: s => { s.kind = p.buffs.wt_powder && p.buffs.wt_powder.kind; p._psvT = 0; tickPassives(p, 0.3); s.acts = p.acts === WITCH_ACTS_P; } });
  // 扫把粉末：普攻变成独立攻击 + 中毒
  clear(); const pm = mob(360); p.doAct(p.acts.atk1); run(30); out.powderHit = { poison: !!(pm.status && pm.status.poison), type: WITCH_ACTS_P.atk1.hits[0].type };
  delete p.buffs.wt_powder; p._psvT = 0; tickPassives(p, 0.3);
  cast('wt_shululu', { force: 'great', frames: 60, after: s => { const sh = summonsOf(p, 'wt_shululu')[0]; s.alive = !!sh; s.taunt = ents.some(e => e.team === 'e' && e.status && e.status.taunt); } });
  { const S0 = skills.wt_shululu, hp = S0.ms[0].hp; S0.recast = castSkill(p, 'wt_shululu'); run(20); S0.boomed = summonsOf(p, 'wt_shululu').length === 0; S0.dmg = Math.round(hp - S0.ms[0].hp); }
  cast('wt_missile', { force: 'great', mobs: [[420, 100], [520, 110], [600, 90]], frames: 150, after: s => { s.shock = ents.filter(e => e.status && e.status.shock).length; } });
  cast('wt_missile', { force: 'ok', air: true, frames: 120, tag: 'wt_missile_air' });
  cast('wt_cloak', { mobs: [[360, 100]], frames: 70, during: s => { run(12); s.grab = !!p.grabbed; s.invul = p.invul > 0 ? true : { invul: p.invul, actT: p.actT, act: p.act && p.act.name, st: p.st, hs: p.hitstop }; } });
  Math.random = () => 0.01; cast('wt_swatter', { force: 'ok', mobs: [[350, 100]], frames: 50, after: s => { s.mutant = summonsOf(p, 'wt_mut_gob').length; } }); Math.random = stub;
  Math.random = () => 0.01; cast('wt_swatter', { force: 'fail', tag: 'wt_swatter_fail', mobs: [[350, 100]], frames: 50, after: s => { s.enemyGoblin = ents.filter(e => e.team === 'e' && e.name === '变异哥布林').length; } }); Math.random = stub;
  cast('wt_swatter', { force: 'ok', air: true, tag: 'wt_swatter_air', mobs: [[350, 100]], frames: 60 });
  cast('wt_lava', { force: 'great', mobs: [[470, 100]], frames: 420, during: s => { run(60); s.field = summonsOf(p, 'wt_lava').length; } });
  cast('wt_lava', { force: 'fail', tag: 'wt_lava_fail', mobs: [[330, 100]], frames: 60, during: s => { run(20); s.sooty = p.clipName === 'sooty'; } });
  cast('wt_acid', { force: 'great', mobs: [[470, 100]], frames: 400 });
  cast('wt_spin', { force: 'ok', mobs: [[330, 100], [380, 110]], frames: 100 });
  cast('wt_spin', { force: 'ok', air: true, tag: 'wt_spin_air', mobs: [[380, 100]], frames: 200, during: s => { run(150); s.landed = p.z === 0; } });
  const rideCheck = s => { run(60); const m = p.act && p.act.m; s.machine = !!m && !m.gone; s.immune = !!(p.statusImmune && p.statusImmune.stun); s.taken = p.buffs.wt_ride && p.buffs.wt_ride.taken; s.pinned = !!m && Math.abs(p.x - m.x) < 60; };
  const rideAfter = s => { s.ended = !p.act || !p.act.m; s.cleaned = !p.buffs.wt_ride && !(p.statusImmune && p.statusImmune.stun); s.gone = summonsOf(p, { tag: 'machine' }).length === 0; };
  cast('wt_tesla', { force: 'great', mobs: [[450, 100], [520, 90]], frames: 480, during: rideCheck, after: rideAfter });
  cast('wt_furnace', { force: 'ok', mobs: [[480, 100]], frames: 360, during: rideCheck, after: rideAfter });
  cast('wt_drill', { force: 'great', mobs: [[420, 100]], frames: 480, during: rideCheck, after: rideAfter });
  // 引爆实验：搭乘中按跳跃
  cast('wt_furnace', { force: 'ok', mobs: [[480, 100]], frames: 30, during: s => { run(50); input.buf.push({ a: 'jump', t: game.t }); run(3); s.detonated = !p.act || p.act.name !== 'wt_furnace'; }, tag: 'wt_detonate' });
  // 苦涩的棒棒糖：按住技能键 → 强制失败（失败伤害 +50%）
  clear(); const bm = mob(340); const hb = bm.hp; p.doAct(SKILLS.wt_lava.act(10, p), { skill: 'wt_lava', lv: 10, key: 's0', type: 'indep' }); input.virt.s0 = true; run(20); input.virt.s0 = false; run(40);
  out.bitter = { craft: p._craft, dmg: Math.round(hb - bm.hp) };
  cast('wt_antigrav', { force: 'great', mobs: [[450, 100]], frames: 150, during: s => { run(40); s.lifted = ents.some(e => e.team === 'e' && e.z > 20); } });
  // ---- 5. 觉醒段 ----
  cast('wt_superswat', { force: 'great', mobs: [[360, 100], [420, 100]], frames: 60 });
  cast('wt_rabbit', { force: 'ok', mobs: [[450, 100]], frames: 330, during: rideCheck, after: rideAfter });
  cast('wt_shaved', { force: 'ok', mobs: [[480, 100], [520, 130]], frames: 420, during: s => { rideCheck(s); s.invul = p.invul > 0; }, after: rideAfter });
  cast('wt_lollipop', { force: 'ok', mobs: [[380, 100], [420, 110], [460, 90]], frames: 40, after: s => { s.dolls = summonsOf(p, 'wt_candy').length; } });
  run(300); skills.wt_lollipop.popped = summonsOf(p, 'wt_candy').length;
  cast('wt_trickjack', { force: 'ok', mobs: [[250, 100], [420, 100]], frames: 200, after: s => { const t = summonsOf(p, 'wt_trickjack')[0]; s.alive = !!t; s.dir0 = t && t.dir; castSkill(p, 'wt_trickjack'); run(5); s.dir1 = t && t.dir; } });
  for (const id of P1PASSIVE) game.skillLv[id] = 1;
  // 魔道学助手：电塔由助手放置（自己不上去）
  cast('wt_tesla', { force: 'ok', tag: 'wt_tesla_helper', mobs: [[450, 100]], frames: 450, during: s => { run(30); s.riding = !!p._wtRide; s.placed = summonsOf(p, 'wt_tesla').length; } });
  // 粉红糖果：夜猫助手 / 冰霜云
  cast('wt_cloak', { force: 'ok', tag: 'wt_cloak_pink', mobs: [[400, 100], [480, 100]], frames: 70 });
  cast('wt_acid', { force: 'ok', tag: 'wt_acid_pink', mobs: [[520, 100]], frames: 60, after: s => { const f = summonsOf(p, 'wt_acid')[0]; s.frost = !!(f && f.frost); } });
  for (const [id, fr] of [['wt_awaken', 330], ['wt_awaken2', 480], ['wt_awaken3', 360]]) { cast(id, { mobs: [[450, 100], [560, 120], [650, 90]], frames: fr, during: s => { run(80); s.invul = p.invul > 0; }, after: s => { s.done = !p.act; } }); }
  for (const k in skills) delete skills[k].ms; out.skills = skills;
  // 魔法秀：学了贤者之石后永久
  clear(); game.skillLv.mg_showtime = 5; castSkill(p, 'mg_showtime'); run(60); out.showtime = p.buffs.mg_showtime && p.buffs.mg_showtime.t;
  return out;
});
const o = R, S = o.skills;
report('转职登记：31 个技能都有定义、有觉醒、有专属试炼', o.job.ok && o.job.n === 31 && !o.job.missing.length && o.job.awaken === 'wt_awaken' && o.job.trial, o.job);
report('指令：主动技能都有指令', o.job.cmds >= 20, o.job.cmds);
report('转职任务：魔道学概论 / 魔道学者的试炼', o.job.quests, o.job.quests);
report('转职送扫把', o.gift.got, o.gift);
report('成功率（基础）：失败 25% / 成功 50% / 大成功 25%', Math.abs(o.oddsBase.fail - 0.25) < 0.04 && Math.abs(o.oddsBase.great - 0.25) < 0.04 && o.oddsBase.super === 0, o.oddsBase);
report('成功率（亲和 + 幸运 满级）：几乎不失败', o.oddsMax.fail < 0.04 && o.oddsMax.great > 0.55, o.oddsMax);
report('贤者之石：没有“成功”档，出现超大成功', o.oddsStone.ok === 0 && o.oddsStone.super > 0.4, o.oddsStone);
report('糖果：下一个技能必定成功并消耗', o.candy.r !== 'fail' && o.candy.used, o.candy);
report('强制失败', o.force === 'fail', o.force);
report('扫把：装备扫把时骑扫把、空中 6 连击', o.ride.ride && o.ride.airMax === 6 && o.ride.acts && o.air6 === 6, { ...o.ride, air6: o.air6 });
report('扫把：空中冲刺（每次跳跃 2 次）', o.dash.dashing && o.dash.cap === 2, o.dash);
report('扫把：按住跳跃缓降', o.glide.vz >= -80 && o.glide.n === 1, o.glide);
report('没装备扫把：不能飞', !o.noBroom.ride && o.noBroom.airMax === 1, o.noBroom);
const dealt = id => S[id] && S[id].ok && S[id].dmg > 0;
for (const id of ['wt_shululu', 'wt_missile', 'wt_missile_air', 'wt_cloak', 'wt_swatter', 'wt_swatter_air', 'wt_lava', 'wt_lava_fail', 'wt_acid', 'wt_spin', 'wt_spin_air', 'wt_tesla', 'wt_furnace', 'wt_drill', 'wt_antigrav',
  'wt_superswat', 'wt_rabbit', 'wt_shaved', 'wt_lollipop', 'wt_trickjack', 'wt_tesla_helper', 'wt_cloak_pink', 'wt_awaken', 'wt_awaken2', 'wt_awaken3']) report(`技能出伤：${id}`, dealt(id), S[id]);
report('远古魔法书 / 扫把粉末：BUFF 生效、普攻换成粉末版', S.wt_book.buff && S.wt_powder.kind === 'poison' && S.wt_powder.acts, [S.wt_book, S.wt_powder]);
report('扫把粉末：普攻变独立攻击并附带中毒', o.powderHit.poison && o.powderHit.type === 'indep', o.powderHit);
report('舒露露：嘲讽敌人、再按一次引爆', S.wt_shululu.alive && S.wt_shululu.taunt && S.wt_shululu.recast && S.wt_shululu.boomed, S.wt_shululu);
report('改良魔法星弹：大成功附加感电、连锁跳到多个敌人', S.wt_missile.shock >= 2, S.wt_missile);
report('暗影斗篷：抓取 + 无敌', S.wt_cloak.grab && S.wt_cloak.invul, S.wt_cloak);
report('苍蝇拍：成功召出友方哥布林弓手、失败召出敌方哥布林', S.wt_swatter.mutant === 1 && S.wt_swatter_fail.enemyGoblin === 1, { ok: S.wt_swatter, fail: S.wt_swatter_fail, air: S.wt_swatter_air });
report('熔岩药瓶：成功生成熔岩；失败熏黑', S.wt_lava.field === 1 && S.wt_lava_fail.sooty, [S.wt_lava, S.wt_lava_fail]);
report('旋转扫把（空中）：落地', S.wt_spin_air.landed, S.wt_spin_air);
for (const id of ['wt_tesla', 'wt_furnace', 'wt_drill', 'wt_rabbit', 'wt_shaved']) report(`搭乘：${id} 机械在场、坐在上面、免疫异常、减伤 60%、结束后清理`, S[id].machine && S[id].pinned && S[id].immune && S[id].taken === -0.6 && S[id].ended && S[id].cleaned && S[id].gone, S[id]);
report('引爆实验：搭乘中按跳跃当场引爆', S.wt_detonate.detonated, S.wt_detonate);
report('苦涩的棒棒糖：按住技能键强制失败', o.bitter.craft === 'fail' && o.bitter.dmg > 0, o.bitter);
report('反重力装置：把敌人抬到空中', S.wt_antigrav.lifted, S.wt_antigrav);
report('雪人刨冰：搭乘中无敌', S.wt_shaved.invul, S.wt_shaved);
report('超级棒棒糖：每命中一个敌人生成一个糖果人偶，人偶会自爆', S.wt_lollipop.dolls === 3 && S.wt_lollipop.popped < 3, S.wt_lollipop);
report('捣蛋杰克：跟随、再按一次转身', S.wt_trickjack.alive && S.wt_trickjack.dir0 === -S.wt_trickjack.dir1, S.wt_trickjack);
report('魔道学助手：电塔由助手放置', !S.wt_tesla_helper.riding && S.wt_tesla_helper.placed === 1, S.wt_tesla_helper);
report('粉红糖果：冰霜云', S.wt_acid_pink.frost, S.wt_acid_pink);
for (const id of ['wt_awaken', 'wt_awaken2', 'wt_awaken3']) report(`觉醒 ${id}：无敌、结束`, S[id].invul && S[id].done, S[id]);
report('贤者之石：魔法秀永久', o.showtime > 1e6, o.showtime);
const errs = logs.filter(l => l.type === 'pageerror' || /error/i.test(l.text)); report('无报错', errs.length === 0, errs.slice(0, 4));
await browser.close();
console.log(fail ? `${fail} 项失败` : '全部通过'); process.exit(fail ? 1 : 0);
