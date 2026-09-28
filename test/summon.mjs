// 召唤物框架 + 新异常状态 + 受击前钩子（魔法师对齐组）：暂停游戏循环、手动逐帧推进验证。node test/summon.mjs
// 召唤：上限与挤掉最旧的、不可被攻击、伤害按 owner 面板、field 按间隔结算、hitGroup 去重、换房间（follower 跟随 / field 清掉）、
//       宿主死亡清掉 attach、owner 死亡清场、赫德尔会出手、决斗换回合清场
// 状态：定身不被击退 / 挑空、睡眠被打醒且伤害 ×1.5、感电追加伤害、诅咒增伤、挑衅换目标、束缚不能移动、免疫；beforeHurt 的 block / mul / minHp / noStun
import { launch, URL_BASE } from './lib.mjs';
let fail = 0;
const report = (name, ok, info) => { if (!ok) fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${JSON.stringify(info)}`); };
const { browser, page, logs } = await launch({ width: 960, height: 540 });
await page.goto(`${URL_BASE}?test&cls=mage&mobs=0&mute`); await page.waitForFunction(() => window.__READY, null, { timeout: 30000 });
const R = await page.evaluate(() => {
  game.paused = true;
  const run = n => { for (let i = 0; i < n; i++) { input.frame(game.t); step(1 / 60); } };
  const mob = (x = 420, y = 100) => { const m = spawnMonster('goblin', x, y); m.control = null; m.invul = 0; m.hp = m.hpMax = 1e9; m.evade = 0; m.def = 0; m.mdef = 0; return m; };
  const clear = () => { clearAllSummons('test'); for (const e of ents) if (e !== game.player) e.remove = true; run(1); projs.length = 0; };
  const p = game.player, out = {};
  Object.assign(p, { x: 300, y: 100, face: 1, matk: 1000, atk: 1000, mcrit: 0, crit: 0, dmgUp: 0, buffs: {} });
  // ---- 1. 上限：max 2，第 3 只挤掉最早的（剩余时间最短） ----
  defSummon('t_fol', { kind: 'follower', model: () => buildGoblin(), clips: BEAST_CLIPS, max: 2, life: 30, speed: 150, attacks: [] });
  const a = summon(p, 't_fol'); run(5); const b = summon(p, 't_fol'); run(5); const c = summon(p, 't_fol'); run(1);
  out.cap = { n: summonsOf(p, 't_fol').length, firstGone: a.gone && a.why === 'replaced', bAlive: !b.gone, cAlive: !c.gone };
  // ---- 2. 不可被攻击 / 攻击属性读 owner ----
  const m0 = mob(360); out.untargetable = !canHit(m0, c, {});
  p.buffs.t = { t: 10, atk: 0.5 }; out.matk = Math.round(c.matk); delete p.buffs.t;
  out.dmgType = c.dmgType;
  clear();
  // ---- 3. field：按间隔结算、hitGroup 去重 ----
  let ticks = 0; defSummon('t_field', { kind: 'field', r: 80, tick: 0.2, life: 1.0, onTick(s, foes) { ticks++; for (const t of foes) summonHit(s, t, { dmg: 1, type: 'mag', sure: true }); } });
  const m1 = mob(420); const f = summon(p, 't_field', { x: 420, y: 100 }); const hp0 = m1.hp; run(61);
  out.field = { ticks, dealt: hp0 - m1.hp > 0, gone: f.gone };
  const G = hitGroup(), m2 = mob(430); const hp1 = m2.hp; const s2 = summon(p, 't_field', { x: 430, y: 100 });
  summonHit(s2, m2, { dmg: 1, sure: true }, { hitGroup: G }); const d1 = hp1 - m2.hp; summonHit(s2, m2, { dmg: 1, sure: true }, { hitGroup: G }); out.hitGroup = { first: d1 > 0, second: hp1 - m2.hp === d1 };
  // ---- 4. 换房间：follower 跟过去、field 清掉 ----
  const fo = summon(p, 't_fol', { x: 900 }); const fi = summon(p, 't_field', { x: 500, y: 100, life: 30 });
  game.room = { ...game.room }; run(2);
  out.room = { followerKept: !fo.gone && Math.abs(fo.x - p.x) < 150, fieldCleared: fi.gone && fi.why === 'room' };
  clear();
  // ---- 5. attach：宿主死亡结束；owner 死亡清场 ----
  defSummon('t_att', { kind: 'attach', host: 'target', life: 30, tick: 0.3, onTick() { } });
  const host = mob(450); const at = summon(p, 't_att', { target: host }); run(2); host.hp = 1; applyHit(p, host, { dmg: 99, sure: true }, { proj: true }); run(2);
  out.attach = { removed: at.gone };
  const fo2 = summon(p, 't_fol'); p.dead = true; run(2); out.ownerDead = fo2.gone && fo2.why === 'owner'; p.dead = false; p.hp = p.hpMax; p.setState('idle');
  clear();
  // ---- 6. 赫德尔：会走过去出手、伤害按主人面板 ----
  const m3 = mob(560); const hp3 = m3.hp; const h = summon(p, 'hodor', { lv: 5, mul: 1.4 }); run(360);
  out.hodor = { alive: !h.gone, dealt: hp3 - m3.hp > 0, invul: h.invul === Infinity };
  clearAllSummons('round'); out.clearAll = SUMMONS.length === 0 && h.gone;
  clear();
  // ---- 7. 异常状态 ----
  const hitOnce = (t, hh = {}) => { const hp = t.hp; t.setState('idle'); t.act = null; applyHit(p, t, { dmg: 1, sure: true, type: 'mag', ...hh }, { proj: true }); return hp - t.hp; };
  const avg = (fn, n = 40) => { let s = 0; for (let i = 0; i < n; i++) s += fn(); return s / n; };
  const r = mob(420); r.weight = 1;
  addStatus(r, 'root', 3, { force: true }); run(1); r.z = 0; hitOnce(r, { launch: 500, knock: 300 });
  out.root = { st: r.st, z: Math.round(r.z), vx: Math.round(r.vx) }; delete r.status.root; r.setState('idle'); run(1);
  const base = avg(() => hitOnce(r));
  addStatus(r, 'curse', 5, { amt: 0.2 }); const cursed = avg(() => hitOnce(r)); delete r.status.curse;
  out.curse = +(cursed / base).toFixed(2);
  addStatus(r, 'sleep', 5, { force: true }); run(1); const slept = hitOnce(r); out.sleep = { mul: +(slept / base).toFixed(2), woke: !r.status.sleep };
  addStatus(r, 'shock', 5, { hitDmg: 777 }); game.t += 1; const shocked = hitOnce(r); out.shock = Math.round(shocked - base);
  r.status = {};
  r.statusImmune = { blind: true }; addStatus(r, 'blind', 3); out.immune = !r.status.blind; r.statusImmune = null;
  // 挑衅：怪物的目标换成施加者（离玩家很远、贴着诱饵）
  const bait = summon(p, 't_fol', { x: 900, y: 100 }); run(1); const tm = spawnMonster('goblin', 960, 100); tm.acd = tm.acd.map(() => 99); tm.aiCd = 99;
  addStatus(tm, 'taunt', 5, { src: bait }); for (let i = 0; i < 30; i++) { tm.think = 0; run(1); }
  out.taunt = { faceBait: tm.face === -1, movedTowardBait: Math.abs(tm.x - bait.x) < Math.abs(960 - bait.x) + 1 };
  addStatus(tm, 'bind', 5, { force: true }); const bx = tm.x; for (let i = 0; i < 30; i++) { tm.think = 0; run(1); } out.bind = Math.abs(tm.x - bx) < 1;
  clear();
  // ---- 8. 受击前钩子 ----
  const C = CLASSES.mage, old = C.beforeHurt, e = mob(360); p.st = 'idle'; p.invul = 0; p.hp = p.hpMax = 100000; p.fighter = true;
  const hurt = hh => { const hp = p.hp; p.setState('idle'); p.act = null; p.invul = 0; applyHit(e, p, { dmg: 1, sure: true, knock: 200, ...hh }, { proj: true }); return hp - p.hp; };
  C.beforeHurt = () => ({ block: true }); out.block = hurt() === 0;
  const plain = (C.beforeHurt = null, avg(() => hurt(), 20));
  C.beforeHurt = () => ({ mul: 0.5 }); out.mul = +(avg(() => hurt(), 20) / plain).toFixed(2);
  C.beforeHurt = () => ({ minHp: 99999 }); p.hp = 100000; hurt({ dmg: 50 }); out.minHp = p.hp;
  C.beforeHurt = () => ({ noStun: true }); p.hp = p.hpMax; hurt(); out.noStun = p.st === 'idle';
  C.beforeHurt = old;
  return out;
});
const o = R;
report('召唤：上限 2，第 3 只挤掉最早的', o.cap.n === 2 && o.cap.firstGone && o.cap.bAlive && o.cap.cAlive, o.cap);
report('召唤：地下城里不可被攻击', o.untargetable, o.untargetable);
report('召唤：魔攻读 owner（含 BUFF 攻击 +50%）', o.matk === 1500, o.matk);
report('召唤：伤害类型跟随 owner（魔法）', o.dmgType === 'mag', o.dmgType);
report('field：每 0.2 秒结算、到期消失', o.field.ticks >= 4 && o.field.ticks <= 6 && o.field.dealt && o.field.gone, o.field);
report('hitGroup：同组同一目标只结算一次', o.hitGroup.first && o.hitGroup.second, o.hitGroup);
report('换房间：follower 跟到 owner 身边，field 清掉', o.room.followerKept && o.room.fieldCleared, o.room);
report('attach：宿主死亡后结束', o.attach.removed, o.attach);
report('owner 死亡：召唤物全部消失', o.ownerDead, o.ownerDead);
report('赫德尔：走过去出手、打得出伤害、不可被攻击', o.hodor.alive && o.hodor.dealt && o.hodor.invul, o.hodor);
report('clearAllSummons 清场', o.clearAll, o.clearAll);
report('定身：挨打不浮空、不击退', o.root.z === 0 && Math.abs(o.root.vx) < 1, o.root);
report('诅咒：受到的伤害 +20%', o.curse >= 1.1 && o.curse <= 1.3, o.curse);
report('睡眠：唤醒一击 ×1.5 并醒来', o.sleep.mul >= 1.3 && o.sleep.mul <= 1.7 && o.sleep.woke, o.sleep);
report('感电：挨打追加伤害', o.shock >= 700 && o.shock <= 860, o.shock);
report('免疫：statusImmune 挡住失明', o.immune, o.immune);
report('挑衅：怪物转向施加者', o.taunt.faceBait && o.taunt.movedTowardBait, o.taunt);
report('束缚：不能移动', o.bind, o.bind);
report('受击前钩子 block：不掉血', o.block, o.block);
report('受击前钩子 mul：伤害 ×0.5', o.mul >= 0.4 && o.mul <= 0.6, o.mul);
report('受击前钩子 minHp：HP 保底', o.minHp === 99999, o.minHp);
report('受击前钩子 noStun：不硬直', o.noStun, o.noStun);
const errs = logs.filter(l => /error|Error/.test(l)); report('无报错', errs.length === 0, errs.slice(0, 3));
await browser.close();
console.log(fail ? `${fail} 项失败` : '全部通过'); process.exit(fail ? 1 : 0);
