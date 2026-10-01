// 蓝拳圣使（男圣职者转职 monk / Infighter）机制测试。node test/infighter.mjs（约 40 秒）
//   意念驱动（进房间自动插、光环 BUFF、冷却 −10%、按住收回 / 点一下重插、插着时拳击普攻、空斩打不能用）、俯冲 / 摆动（位移、无敌、X / ↑X / ↓X 派生、跳跃键停下、互相取消）、
//   神圣反击（正面挨打 −90% + 反击、技巧精通主动冲出）、幻影化身 / 双重幻影追加打击、急速闪避、干涸之泉取消规则、瞬拳追加拽人、刺拳猛击 15 段 + 终结 + 追加上勾拳、
//   旋涡重拳 / 极速飓风拳吸怪、神圣组合拳纵深聚怪、绝对正义的破碎之锤（插巨兵爆炸）、泯灭神击 4 段、制裁：怒火疾风穿梭多个敌人、三觉联动冷却、觉醒自动学会
import { launch, URL_BASE } from './lib.mjs';
let fail = 0;
const report = (name, ok, info) => { if (!ok) fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${JSON.stringify(info)}`); };
const { browser, page, logs } = await launch({ width: 960, height: 540 });
await page.goto(`${URL_BASE}?test&cls=priest&priest=1&mobs=0&mute&rawcd`); await page.waitForFunction(() => window.__READY, null, { timeout: 30000 });
await page.evaluate(() => {
  game.paused = true; window.toastMsg = () => {};
  const p = game.player, run = n => { for (let i = 0; i < n; i++) step(1 / 60); };
  game.job = 'monk'; Object.assign((save.data.flags ??= {}), { awaken: true, awaken2: true, awaken3: true }); onJobChange(p, 'monk');
  for (const id of classSkills('priest', 'monk')) game.skillLv[id] = Math.max(1, Math.min(SKILLS[id] ? SKILLS[id].maxLv || 5 : 1, 5));
  delete game.skillLv.pi_one; p._psvT = 0; tickPassives(p, 0.3);
  window.T = { p, run,
    reset(keep) { for (const k in input.virt) delete input.virt[k]; input.buf.length = 0; input.dirHist.length = 0;
      for (const e of ents) if (e.team === 'e') e.remove = true; run(1); projs.length = 0; game.timers.length = 0; game.timeStop = 0; game.cutin = null;
      Object.assign(p, { x: 400, y: 100, z: 0, vz: 0, vx: 0, vy: 0, face: 1, cool: {}, mp: 1e6, mpMax: 1e6, mpRegen: 1e-9, invul: 0, superArmor: 0, alpha: 1, hidden: false, _piDryT: -99 }); if (!keep) p.buffs = {}; p.hp = p.hpMax; p.act = null; p.setState('idle');
      piPlant(p, p.x - 40, p.y, true); p._psvT = 0; tickPassives(p, 0.3); run(2); },
    mob(dx, o = {}, dy = 0) { const m = spawnMonster('goblin', p.x + dx, p.y + dy); m.control = null; m.hp = m.hpMax = 1e9; m.invul = 0; m.evade = 0; Object.assign(m, o); return m; },
    dmg: m => m.hpMax - m.hp,
    until(f, n = 600) { for (let i = 0; i < n && !f(); i++) step(1 / 60); return !!f(); },
    idle(n = 600) { T.until(() => p.st !== 'act' && !game.timers.length && !(game.timeStop > 0), n); run(2); },
    hits(m) { let n = 0; const o = m.onHurt; m.onHurt = function () { n++; if (o) return o.apply(this, arguments); }; return () => n; },
    tap(k) { input.virt[k] = 2; run(1); delete input.virt[k]; },
  };
});
// 1) 意念驱动
const A = await page.evaluate(() => {
  const { p, run, reset, idle, tap } = T, o = {};
  reset(); o.auto = piWillOn(p); o.acts = p.acts === piFistActs(p); o.launcher = SKILLS.p_launcher.req(p); o.buff = p.buffs.pi_will ? { crit: +p.buffs.pi_will.crit.toFixed(3), critDmg: +p.buffs.pi_will.critDmg.toFixed(3) } : null;
  castSkill(p, 'pi_crush'); o.cdr = +(p.cool.pi_crush / SKILLS.pi_crush.cd).toFixed(2); idle();
  castSkill(p, 'pi_awaken'); o.cdrAwk = +(p.cool.pi_awaken / SKILLS.pi_awaken.cd).toFixed(2); idle();
  // 点一下：在脚下重插；按住：收回（幻影化身解除）
  reset(); p.x = 600; game.skillBar[0] = 'pi_will'; tap('s0'); run(30); o.replant = Math.round(p.piWill.x - p.x);
  reset(); castSkill(p, 'pi_shadow'); idle(); p.cool = {}; game.skillBar[0] = 'pi_will'; input.virt.s0 = 2; run(1); input.virt.s0 = 1; run(30); delete input.virt.s0; idle(); p._psvT = 0; tickPassives(p, 0.3); run(1);
  o.retrieve = { will: piWillOn(p), shadow: !!p.buffs.pi_shadow, need: SKILLS.pi_gorgeous.req(p), launcher: SKILLS.p_launcher.req(p), acts: p.acts === piFistActs(p) };
  game.skillBar[0] = null; return o;
});
report('意念驱动：进测试房间自动插好巨兵，插着时普攻变拳击、空斩打不能用、光环里暴击 / 暴击伤害提高、转职技能冷却 −10%（觉醒不减）',
  A.auto && A.acts && typeof A.launcher === 'string' && !!A.buff && A.buff.crit > 0 && A.cdr === 0.9 && A.cdrAwk === 1, A);
report('意念驱动：插着时点一下 = 在脚下重插；按住技能键 = 收回（幻影化身解除、转职技能放不出、普攻换回巨兵、空斩打能用）',
  Math.abs(A.replant - 24) < 12 && !A.retrieve.will && !A.retrieve.shadow && typeof A.retrieve.need === 'string' && A.retrieve.launcher === true && !A.retrieve.acts, { replant: A.replant, retrieve: A.retrieve });
// 2) 俯冲 / 摆动
const B = await page.evaluate(() => {
  const { p, run, reset, mob, dmg, idle, tap } = T, o = {};
  reset(); const x0 = p.x; tap('cmd'); o.duckAct = p.act && p.act.skill; let inv = 0; for (let i = 0; i < 40; i++) { run(1); if (p.invul > 0) inv++; } o.duck = { dx: Math.round(p.x - x0), invF: inv }; idle();
  reset(); const x1 = p.x; castSkill(p, 'pi_sway'); run(40); o.sway = Math.round(p.x - x1); idle();
  const follow = (first, keys, d = 170) => { reset(); const m = mob(d); castSkill(p, first); run(6); for (const k of keys) input.virt[k] = k === 'attack' ? 2 : 1; run(2); for (const k of keys) delete input.virt[k]; const s = p.act && p.act.skill; run(60); const r = { s, dmg: dmg(m) > 0, air: m.z > 20 || m.st === 'air', stun: m.st === 'hit' || !!(m.status && m.status.stun) }; idle(); return r; };
  o.dX = follow('pi_duck', ['attack']); o.dUX = follow('pi_duck', ['up', 'attack'], 130); o.dDX = follow('pi_duck', ['down', 'attack'], 130); o.sX = follow('pi_sway', ['attack']);
  reset(); castSkill(p, 'pi_sway'); run(5); tap('cmd'); o.swayDuck = p.act && p.act.skill;
  reset(); const x2 = p.x; castSkill(p, 'pi_duck'); run(8); input.virt.jump = 2; run(2); delete input.virt.jump; o.stop = { st: p.st, dx: Math.round(p.x - x2) }; idle();
  return o;
});
report('俯冲（Z）：前冲约 150px、开头 0.25 秒无敌；摆动：后撤约 150px', B.duckAct === 'pi_duck' && B.duck.dx > 120 && B.duck.dx < 200 && B.duck.invF >= 12 && B.duck.invF <= 18 && B.sway < -110, B);
report('俯冲中 X / ↑X / ↓X = 俯冲直拳 / 翔拳（挑空）/ 腹拳（长硬直）；摆动中 X = 破碎之锤、Z = 俯冲；跳跃键立即停下',
  B.dX.s === 'pi_dstraight' && B.dX.dmg && B.dUX.s === 'pi_dupper' && B.dUX.air && B.dDX.s === 'pi_dbody' && B.dDX.dmg && B.dDX.stun && B.sX.s === 'pi_chop' && B.sX.dmg && B.swayDuck === 'pi_duck' && B.stop.dx < 90, B);
// 3) 神圣反击 / 幻影化身 / 急速闪避 / 干涸之泉
const C = await page.evaluate(() => {
  const { p, run, reset, mob, dmg, idle, tap } = T, o = {};
  reset(); const e1 = mob(70); castSkill(p, 'pi_counter'); run(10); const hp0 = p.hp; applyHit(e1, p, { dmg: 1, sure: true, knock: 0 }); const taken = hp0 - p.hp; run(40); o.counter = { taken, dmgUnit: Math.round(atkOf(e1, 'phys') * 0.9), hit: dmg(e1) > 0 }; idle();
  reset(); const e2 = mob(200); game.skillBar[0] = 'pi_counter'; castSkill(p, 'pi_counter'); p.act.key = 's0'; run(10); tap('s0'); run(30); o.manual = dmg(e2) > 0; idle(); game.skillBar[0] = null;
  // 幻影化身：追加打击（双重幻影再多一个）
  const count = (dbl) => { reset(); game.skillLv.pi_double = dbl ? 1 : 0; if (castSkill(p, 'pi_shadow')) idle(); const m = mob(90), n = T.hits(m); castSkill(p, 'pi_dstraight'); idle(); return n(); };
  delete game.skillLv.pi_tech; const base = (() => { reset(); const m = mob(90), n = T.hits(m); castSkill(p, 'pi_dstraight'); idle(); return n(); })();
  o.shadow = { base, one: count(false), two: count(true) }; game.skillLv.pi_tech = 5; game.skillLv.pi_double = 1;
  // 急速闪避：起手回避（固定随机数）
  reset(); const e3 = mob(70); const r0 = Math.random; Math.random = () => 0.1; castSkill(p, 'pi_gorgeous'); run(2); const h1 = p.hp; applyHit(e3, p, { dmg: 5, knock: 0 }); Math.random = r0; o.parry = { dodged: p.hp === h1, buff: !!p.buffs.pi_parry }; idle();
  // 干涸之泉：圣拳连击 → 神圣组合拳（取消，3.5 秒一次）；不能取消进俯冲直拳；仲裁怒击放出来后不能取消
  reset(); mob(80); castSkill(p, 'pi_gorgeous'); run(6); o.dry = { toHeav: canCancelInto(p, 'pi_heavenly'), toDuckAtk: canCancelInto(p, 'pi_dstraight') }; castSkill(p, 'pi_heavenly'); run(6); o.dry.again = canCancelInto(p, 'pi_mgjab'); idle();
  reset(); mob(80); castSkill(p, 'pi_nuke'); run(6); o.dry.nukeOut = canCancelInto(p, 'pi_gorgeous'); idle();
  return o;
});
report('神圣反击：祈祷中正面挨打受到的伤害 −90% 并冲出反击；技巧精通：再按技能键主动冲出', C.counter.taken <= C.counter.dmgUnit * 0.2 && C.counter.hit && C.manual, { counter: C.counter, manual: C.manual });
report('幻影化身：直接打中时分身追加打击；双重幻影再多一个分身', C.shadow.one > C.shadow.base && C.shadow.two > C.shadow.one, C.shadow);
report('急速闪避：神击技能起手时回避攻击并得到暴击 BUFF', C.parry.dodged && C.parry.buff, C.parry);
report('干涸之泉：神击技能互相取消（3.5 秒一次）；俯冲系不能被取消进去；仲裁怒击放出后不能取消', C.dry.toHeav && !C.dry.toDuckAtk && !C.dry.again && !C.dry.nukeOut, C.dry);
// 4) 攻击技能机制
const D = await page.evaluate(() => {
  const { p, run, reset, mob, dmg, idle, tap } = T, o = {};
  reset(); const s1 = mob(230); game.skillBar[0] = 'pi_side'; castSkill(p, 'pi_side'); p.act.key = 's0'; run(14); tap('s0'); run(20); o.side = { pulled: Math.round(s1.x - p.x), dmg: dmg(s1) > 0 }; idle();
  reset(); const j1 = mob(90), jn = T.hits(j1), j2 = mob(210, {}, 40); game.skillBar[0] = 'pi_mgjab'; castSkill(p, 'pi_mgjab'); p.act.key = 's0'; T.until(() => p.act && p.act.fin, 200); run(12); tap('s0'); idle();
  o.mg = { hits: jn(), pulled: Math.round(j2.x - p.x), launched: j1.st === 'air' || j1.z > 20 };
  reset(); const c1 = mob(160, {}, 40); castSkill(p, 'pi_cork'); run(40); o.cork = { dx: Math.round(c1.x - p.x), dy: Math.round(Math.abs(c1.y - p.y)), hold: !!(c1.status && c1.status.hold) }; idle();
  reset(); const h1 = mob(700), hn = T.hits(h1); castSkill(p, 'pi_hurricane'); run(90); o.hurr = { pulled: Math.round(h1.x - p.x) }; input.virt.jump = 2; run(1); delete input.virt.jump; idle(); o.hurr.hits = hn(); o.hurr.up = h1.z > 30 || h1.st === 'air' || h1.st === 'down';
  reset(); const y1 = mob(90, {}, 50); castSkill(p, 'pi_heavenly'); run(20); o.heav = Math.round(Math.abs(y1.y - p.y)); idle();
  // 绝对正义：破碎之锤在落点插下巨兵爆炸（不打中也爆）
  reset(); game.skillLv.pi_one = 1; const w0 = p.piWill.x; const o1 = mob(300); castSkill(p, 'pi_chop'); idle(); o.one = { moved: Math.round(p.piWill.x - w0) }; delete game.skillLv.pi_one;
  // 泯灭神击 4 段；制裁：怒火疾风穿梭多个敌人；三觉联动冷却
  reset(); const b1 = mob(110), bn = T.hits(b1); castSkill(p, 'pi_awaken'); idle(); o.bigbang = { hits: bn(), crit: !!p.buffs.pi_bigbang };
  reset(); const w1 = mob(150), w2 = mob(-260), w3 = mob(420, {}, 60); castSkill(p, 'pi_awaken2'); idle(); o.wrath = { all: [w1, w2, w3].every(m => dmg(m) > 0), hidden: !!p.hidden, alpha: p.alpha };
  reset(); castSkill(p, 'pi_awaken3'); o.link = { cd: Math.round(p.cool.pi_awaken || 0) }; idle(); reset(); p.cool.pi_awaken = 30; o.link.blocked = SKILLS.pi_awaken3.req(p);
  return o;
});
report('瞬拳：伸很远的弹击拳（230px 外打得到），再按技能键追加一击把敌人拽到身前', D.side.dmg && D.side.pulled < 120, D.side);
report('刺拳猛击：15 段连打 + 下砸终结 + 追加上勾拳（挑空）；技巧精通把周围的敌人吸过来', D.mg.hits >= 17 && D.mg.launched && D.mg.pulled < 200, D.mg);
report('旋涡重拳：把前方敌人吸到拳前并控制；极速飓风拳：把 700px 外的敌人吸过来，跳跃键立即出上勾拳', D.cork.dx < 120 && D.cork.dy < 30 && D.cork.hold && D.hurr.pulled < 400 && D.hurr.hits >= 2 && D.hurr.up, { cork: D.cork, hurr: D.hurr });
report('神圣组合拳：钩拳把纵深上的敌人拢到一条线上', D.heav < 25, { dy: D.heav });
report('绝对正义：破碎之锤在落点插下巨兵引发爆炸（意念驱动跟着移过来）', D.one.moved > 60, D.one);
report('泯灭神击：4 段 + 暴击 BUFF；制裁：怒火疾风穿梭打到身前 / 身后 / 远处的敌人、结束后人物显示正常；正义执行联动泯灭神击冷却',
  D.bigbang.hits >= 4 && D.bigbang.crit && D.wrath.all && !D.wrath.hidden && D.wrath.alpha === 1 && D.link.cd >= 100 && typeof D.link.blocked === 'string', { bigbang: D.bigbang, wrath: D.wrath, link: D.link });
// 5) 觉醒自动学会
const W = await page.evaluate(() => {
  const { p } = T, o = {}, f = save.data.flags, lv0 = game.lvl, bar0 = [...game.skillBar];
  const clear = () => { for (const id of ['pi_awaken', 'pi_awaken2', 'pi_awaken3', 'pi_dry']) delete game.skillLv[id]; game.skillBar = game.skillBar.map(() => null); };
  const tick = () => { p._psvT = 0; tickPassives(p, 0.3); };
  clear(); f.awaken = f.awaken2 = f.awaken3 = false; game.lvl = 30; tick(); o.locked = !game.skillLv.pi_awaken;
  f.awaken = true; tick(); o.a1 = { lv: game.skillLv.pi_awaken, dry: game.skillLv.pi_dry, bar: game.skillBar.includes('pi_awaken'), sp: SKILLS.pi_awaken.sp };
  f.awaken2 = true; f.awaken3 = true; tick(); o.a23 = [game.skillLv.pi_awaken2 || 0, game.skillLv.pi_awaken3 || 0, game.skillBar.includes('pi_awaken2'), game.skillBar.includes('pi_awaken3')];
  o.cmd = [cmdTextOf('pi_awaken'), cmdTextOf('pi_awaken2'), cmdTextOf('pi_awaken3')];
  game.lvl = lv0; game.skillBar = bar0; Object.assign(f, { awaken: true, awaken2: true, awaken3: true });
  return o;
});
report('觉醒技自动学会（0 SP、进技能栏）：泯灭神击 + 干涸之泉 Lv1 / 制裁：怒火疾风 / 正义执行', W.locked && W.a1.lv === 3 && W.a1.dry === 1 && W.a1.bar && W.a1.sp === 0 && W.a23[0] >= 1 && W.a23[1] >= 1 && W.a23[2] && W.a23[3] && W.cmd.join() === '↑↑↓↓+Z,↓↑→→+Z,←↑→↓+Z', W);
const errs = logs.filter(l => l.type === 'pageerror' || l.type === 'error'); report('无报错', errs.length === 0, errs.slice(0, 3));
await browser.close();
console.log(fail ? `\n${fail} 项失败` : '\n全部通过');
process.exit(fail ? 1 : 0);
