// 圣骑士（男圣职者转职 crusader）机制测试。node test/crusader.mjs [mech,coop]（默认 mech；coop 要起本地服务端：worktree 里先软链 server/node_modules）
//   mech  路线开关（默认战斗 / 守护路线切换、互斥技能）、单刷守护路线的队伍原语（徽章 / 荣誉祝福 / 圣光守护护盾 / 圣愈之风 / 快速愈合 / 生命源泉要队友）、
//         光之复仇雷击、胜利之矛贯穿钉住 + 爆炸 + 神之代行者再按引爆、圣光沁盾挡子弹 / 推人、双子沁盾相撞、圣光球 15 段 + 眩晕 / 神圣琉璃球、圣光聚合吸怪、
//         忏悔之锤忏悔、正义审判（16 刃 + 天使长矛 / 跳跃键直接召唤天使）、圣光十字加速法阵、圣灵之槌 / 神罚之锤改普攻、落凤锤雷霆重击、
//         天启之珠（战斗 135 秒无 BUFF / 守护 BUFF）、神圣洗礼圣力层数、惩罚（无敌 + 激光 + 跳跃键终结，和信仰之翼共用冷却）、三觉联动冷却、觉醒自动学会（0 SP、进技能栏）
//   coop  2 个玩家真联机：A = 守护路线圣骑士，B = 队友。荣誉祝福 / 守护徽章 / 圣光守护护盾 / 生命源泉（B 致命伤害后复活）/ 圣愈之风回复 / 天启之珠祝福都作用到 B 身上
//   shots 守护路线辅助技能连拍（skillshots 在默认战斗路线下拍不到）→ test/shots/crusader/support.jpg
import { launch, URL_BASE } from './lib.mjs';
const MODES = (process.argv[2] || 'mech').split(',');
let fail = 0;
const report = (name, ok, info) => { if (!ok) fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${JSON.stringify(info)}`); };
const noErr = (logs, tag) => { const e = logs.filter(l => l.type === 'pageerror' || l.type === 'error'); report(`无报错（${tag}）`, e.length === 0, e.slice(0, 3)); };
function pageSetup() {
  game.paused = true; window.toastMsg = () => {};
  const p = game.player, run = n => { for (let i = 0; i < n; i++) step(1 / 60); };
  game.job = 'crusader'; Object.assign((save.data.flags ??= {}), { awaken: true, awaken2: true, awaken3: true });
  onJobChange(p, 'crusader');
  for (const id of classSkills('priest', 'crusader')) game.skillLv[id] = Math.max(1, Math.min(SKILLS[id] ? SKILLS[id].maxLv || 5 : 1, 5));
  p._psvT = 0; tickPassives(p, 0.3);
  const sw = () => (save.data.opts.swOff ??= {});
  window.T = {
    p, run,
    guard(on) { if (on) delete sw().pc_guard; else sw().pc_guard = true; p._psvT = 0; tickPassives(p, 0.3); },
    opt(id, on) { if (on) delete sw()[id]; else sw()[id] = true; },
    reset(keep) { for (const e of ents) if (e.team === 'e') e.remove = true; run(1); if (typeof clearAllSummons === 'function') clearAllSummons('round'); projs.length = 0; game.timers.length = 0; game.timeStop = 0; game.cutin = null;
      Object.assign(p, { x: 400, y: 100, z: 0, vz: 0, vx: 0, vy: 0, face: 1, cool: {}, mp: 1e6, mpMax: 1e6, mpRegen: 1e-9, invul: 0, superArmor: 0, lastHurtT: 1e9 }); if (!keep) p.buffs = {}; p.hp = p.hpMax; p.act = null; p.setState('idle'); p._psvT = 0; tickPassives(p, 0.3); run(2); },
    mob(dx, o = {}, dy = 0) { const m = spawnMonster('goblin', p.x + dx, p.y + dy); m.control = null; m.hp = m.hpMax = 1e9; m.invul = 0; m.evade = 0; Object.assign(m, o); return m; },
    dmg: m => m.hpMax - m.hp,
    until(f, n = 600) { for (let i = 0; i < n && !f(); i++) step(1 / 60); return !!f(); },
    idle(n = 600) { T.until(() => p.st !== 'act' && !game.timers.length && !(game.timeStop > 0), n); run(2); },
    hits(m) { let n = 0; const o = m.onHurt; m.onHurt = function () { n++; if (o) return o.apply(this, arguments); }; return () => n; },
  };
}

// ---------------- mech ----------------
if (MODES.includes('mech')) {
  const { browser, page, logs } = await launch({ width: 960, height: 540 });
  await page.goto(`${URL_BASE}?test&cls=priest&priest=1&mobs=0&mute&rawcd`); await page.waitForFunction(() => window.__READY, null, { timeout: 30000 });
  await page.evaluate(pageSetup);
  // 1) 路线开关
  const A = await page.evaluate(() => {
    const { p, reset } = T, o = {};
    reset(); o.default = pcGuard(p); o.courage = !!p.buffs.pc_courage; o.mace = castSkill(p, 'pc_mace') && !!p.buffs.pc_mace; o.signNo = SKILLS.pc_sign.req(p); o.fountNo = SKILLS.pc_fountain.req(p);
    T.guard(true); o.guard = pcGuard(p); o.maceGone = !p.buffs.pc_mace; o.maceNo = SKILLS.pc_mace.req(p); o.guardBuff = !!p.buffs.pc_guard && !p.buffs.pc_courage; o.btn = SKILLS.pc_guard.switchOpt;
    o.fountSolo = SKILLS.pc_fountain.req(p);
    T.guard(false); o.back = pcGuard(p);
    return o;
  });
  report('路线：转职后默认战斗路线（勇气恩赐生效、圣灵之槌能放、守护系技能放不出）', A.default === false && A.courage && A.mace && typeof A.signNo === 'string' && typeof A.fountNo === 'string', A);
  report('路线：开启守护恩赐（switchOpt）→ 守护路线（圣灵之槌失效且放不出、守护恩赐 BUFF）；关闭回到战斗路线；生命源泉单刷放不出', A.guard && A.maceGone && typeof A.maceNo === 'string' && A.guardBuff && !A.back && /队友/.test(A.fountSolo), A);
  // 2) 单刷守护路线：队伍原语作用在自己身上
  const B = await page.evaluate(() => {
    const { p, run, reset, idle } = T, o = {}; T.guard(true);
    reset(); const hp0 = p.hpMax; castSkill(p, 'pc_sign'); idle(); o.sign = p.buffs.pc_sign ? { hpPct: p.buffs.pc_sign.hpPct, taken: p.buffs.pc_sign.taken, t: Math.round(p.buffs.pc_sign.t) } : null; o.hpUp = p.hpMax > hp0;
    reset(); castSkill(p, 'pc_honor'); idle(); o.honor = p.buffs.pc_honor ? +p.buffs.pc_honor.dmg.toFixed(3) : null; o.honorSelfNoAtk = !(p.buffs.pc_honor && p.buffs.pc_honor.atk);
    reset(); castSkill(p, 'pc_light'); idle(); o.shield = Math.round(absorbOf(p)); o.shieldWant = Math.round(p.hpMax * (0.07 + 0.005 * game.skillLv.pc_light));
    reset(); p.hp = Math.round(p.hpMax * 0.3); const h1 = p.hp; castSkill(p, 'pc_wind'); run(60 * 1.6); o.wind = { gain: +((p.hp - h1) / p.hpMax).toFixed(2), shield: absorbOf(p) > 0 };
    reset(); p.hp = Math.round(p.hpMax * 0.3); const h2 = p.hp; castSkill(p, 'p_slowheal'); o.fastDur = +(p.act.dur).toFixed(2); run(60 * 1.8); o.fast = +((p.hp - h2) / p.hpMax).toFixed(3); o.fastWant = +(pHealPct(p, game.skillLv.p_slowheal) * 1.35).toFixed(3);
    reset(); castSkill(p, 'pc_spear'); o.soloCd = +(p.cool.pc_spear / SKILLS.pc_spear.cd).toFixed(2);
    T.guard(false); return o;
  });
  report('守护徽章：自己 300 秒最大 HP 提高、受到伤害降低；荣誉祝福：自己技能攻击力提高（不加攻击力）', !!B.sign && B.sign.t > 290 && B.hpUp && B.sign.taken < 0 && B.honor > 0.1 && B.honorSelfNoAtk, B);
  report('圣光守护：护盾 = 圣骑士最大 HP × (7%+0.5%/级)；圣愈之风：回复 ≥ 20% 并给护盾', Math.abs(B.shield - B.shieldWant) <= 2 && B.wind.gain >= 0.2 && B.wind.shield, { shield: B.shield, want: B.shieldWant, wind: B.wind });
  report('快速愈合：缓慢愈合 0.5 秒放完、1 秒内回复 135%；守护路线单刷冷却 −20%', B.fastDur === 0.5 && Math.abs(B.fast - B.fastWant) < 0.03 && B.soloCd === 0.8, { dur: B.fastDur, gain: B.fast, want: B.fastWant, cd: B.soloCd });
  // 3) 攻击技能机制
  const C = await page.evaluate(() => {
    const { p, run, reset, mob, dmg, until, idle } = T, o = {};
    // 光之复仇：攻击时落雷（0.2 秒最多一次）；学了神罚之锤后不能手动放
    const lvJ = game.skillLv.pc_jupiter; game.skillLv.pc_jupiter = 0; reset(); castSkill(p, 'pc_revenge'); idle(); o.revenge = !!p.buffs.pc_revenge && p.buffs.pc_revenge.t > 1e5;
    const m0 = mob(80), hits0 = T.hits(m0); p.doAct(p.acts.atk1); run(30); o.bolt = hits0() >= 2; game.skillLv.pc_jupiter = lvJ; o.revengeLocked = typeof SKILLS.pc_revenge.req(p) === 'string';
    // 胜利之矛：一排 3 个都被贯穿、钉在落点（强制硬直）、约 1 秒后爆炸
    reset(); game.skillLv.pc_agent = 0; const s1 = mob(100), s2 = mob(160), s3 = mob(240); const x1 = s1.x; castSkill(p, 'pc_spear'); run(30);
    o.spear = { pinned: [s1, s2, s3].filter(m => m.status && m.status.hold).length, dragged: Math.round(s1.x - x1) }; const d0 = dmg(s1); run(60); o.spear.boom = dmg(s1) > d0 * 1.5;
    // 神之代行者：直接满蓄、再按技能键立即引爆
    reset(); game.skillLv.pc_agent = 1; game.skillBar[0] = 'pc_spear'; const s4 = mob(120); castSkill(p, 'pc_spear'); run(24); const sp = summonsOf(p, 'pc_spear_f')[0]; o.agent = { full: !!(sp && sp.full), cap: sp && sp.cap };
    run(20); const d1 = dmg(s4); p.cool.pc_spear = 0; castSkill(p, 'pc_spear'); run(2); o.agent.detonate = dmg(s4) > d1 * 1.5 && summonsOf(p, 'pc_spear_f').every(s => s.boomed); game.skillLv.pc_agent = 1;
    // 圣光沁盾：敌人的投射物过不去、敌人被挡在墙外
    reset(); T.opt('pc_pwall', false); const shooter = mob(420); castSkill(p, 'pc_wall'); run(30); const w = summonsOf(p, 'pc_wall_f')[0];
    const pr = spawnProj({ owner: shooter, x: shooter.x - 10, y: p.y, z: 60, vx: -500, face: -1, life: 2, w: 8, d: 10, h: 16, hit: { dmg: 1 } }); let reached = false; const hp0 = p.hp;
    for (let i = 0; i < 90; i++) { run(1); if (Math.abs(pr.x - p.x) < 20 && projs.includes(pr)) reached = true; } o.wall = { blocked: !reached && p.hp === hp0, hp: w ? w.hp : null };
    reset(); const walker = mob(320); castSkill(p, 'pc_wall'); run(30); for (let i = 0; i < 40; i++) { walker.x -= 5; run(1); } const ww = summonsOf(p, 'pc_wall_f')[0]; o.wallPush = ww ? Math.round((walker.x - ww.x) * p.face) : null;
    // 双子沁盾：两面墙相向移动相撞爆炸
    reset(); T.opt('pc_pwall', true); const between = mob(200); castSkill(p, 'pc_wall'); run(30); o.pwall = summonsOf(p, 'pc_wall_f').length; run(140); o.pwallBoom = dmg(between) > 0 && summonsOf(p, 'pc_wall_f').length === 0; T.opt('pc_pwall', false);
    // 圣光球：15 段 + 消失时眩晕；神圣琉璃球：碰到就爆
    reset(); T.opt('pc_shrapnel', false); const o1 = mob(140), n1 = T.hits(o1); castSkill(p, 'pc_sphere'); run(60 * 3.7); o.sphere = { hits: n1(), stun: !!(o1.status && o1.status.stun) };
    reset(); T.opt('pc_shrapnel', true); const o2 = mob(260), n2 = T.hits(o2); castSkill(p, 'pc_sphere'); run(80); o.shrapnel = { hits: n2(), stun: !!(o2.status && o2.status.stun) }; T.opt('pc_shrapnel', false);
    // 圣光聚合：把 200px 的敌人吸过来
    reset(); const far = mob(190); castSkill(p, 'pc_haptism'); run(40); o.hapt = Math.round(far.x - p.x);
    // 忏悔之锤：忏悔（混乱）、身后也打得到
    reset(); const hm = mob(120), hb = mob(-40); const r0 = Math.random; Math.random = () => 0.01; castSkill(p, 'pc_hammer'); run(50); Math.random = r0; o.hammer = { repent: !!(hm.status && hm.status.confuse), back: dmg(hb) > 0 };
    // 正义审判：16 刃 + 天使长矛；落刃中按跳跃键直接召唤天使
    reset(); const jm = mob(200), jn = T.hits(jm); castSkill(p, 'pc_judge'); idle(); o.judge = jn();
    reset(); const jm2 = mob(200), jn2 = T.hits(jm2); castSkill(p, 'pc_judge'); run(46); input.virt.jump = 2; run(1); delete input.virt.jump; idle(); o.judgeSkip = jn2();
    // 圣光十字：打中 → 自己脚下法阵、15 秒加速
    reset(); mob(160); castSkill(p, 'pc_cross'); run(40); o.cross = p.buffs.pc_cross ? { aspd: p.buffs.pc_cross.aspd, t: Math.round(p.buffs.pc_cross.t) } : null;
    return o;
  });
  report('光之复仇：永久 BUFF，攻击时落下圣光雷击；学了神罚之锤后改为自动施放（不能手动放）', C.revenge && C.bolt && C.revengeLocked, { revenge: C.revenge, bolt: C.bolt, locked: C.revengeLocked });
  report('胜利之矛：一排 3 个敌人被贯穿、拖到落点钉住（强制硬直），约 1 秒后爆炸', C.spear.pinned === 3 && C.spear.dragged > 60 && C.spear.boom, C.spear);
  report('神之代行者：胜利之矛直接满蓄（贯穿 16 个）、矛插在地上时再按技能键立即引爆', C.agent.full && C.agent.cap === 16 && C.agent.detonate, C.agent);
  report('圣光沁盾：敌人的投射物过不去（墙扣耐久）、敌人被挡在墙外；双子沁盾：两面墙相撞爆炸', C.wall.blocked && C.wallPush > 0 && C.pwall === 2 && C.pwallBoom, { wall: C.wall, push: C.wallPush, pwall: C.pwall, boom: C.pwallBoom });
  report('圣光球：15 段、消失时眩晕；神圣琉璃球：碰到就爆（1 段）并眩晕', C.sphere.hits >= 14 && C.sphere.stun && C.shrapnel.hits <= 3 && C.shrapnel.hits >= 1 && C.shrapnel.stun, { sphere: C.sphere, shrapnel: C.shrapnel });
  report('圣光聚合：190px 外的敌人被吸到身边；忏悔之锤：忏悔（混乱）、身后也打得到', C.hapt < 120 && C.hammer.repent && C.hammer.back, { hapt: C.hapt, hammer: C.hammer });
  report('正义审判：16 刃 + 天使长矛（17 段）；落刃中按跳跃键直接召唤天使（段数变少、长矛照样落下）', C.judge >= 17 && C.judgeSkip >= 2 && C.judgeSkip < C.judge, { full: C.judge, skip: C.judgeSkip });
  report('圣光十字：打中后自己脚下生成法阵，15 秒加速', !!C.cross && C.cross.aspd >= 0.05 && C.cross.t >= 14, C.cross);
  // 4) 普攻改写 / 基础技能改写 / 觉醒
  const D = await page.evaluate(() => {
    const { p, run, reset, mob, dmg, until, idle } = T, o = {};
    reset(); castSkill(p, 'pc_mace'); idle(); p._psvT = 0; tickPassives(p, 0.3); run(1); const macePick = p.acts === pcActsFor(wtypeOf(p), false);
    const far = mob(170); p.doAct(p.acts.atk3); run(40); o.mace = { pick: macePick, shock: dmg(far) > 0 };
    reset(); castSkill(p, 'pc_jupiter'); idle(); p._psvT = 0; tickPassives(p, 0.3); run(1); o.jup = { buff: !!p.buffs.pc_jupiter, revenge: !!p.buffs.pc_revenge, elem: p.acts.atk1.hits[0].elem, type: p.acts.atk1.hits[0].type };
    const dm = mob(120), dn = T.hits(dm); p.doAct(p.acts.dash); run(50); o.jup.dash = dn();
    const keep = p.buffs; reset(true); p.buffs = keep; const pm = mob(150), pn = T.hits(pm); castSkill(p, 'p_phoenix'); idle(); o.jup.crush = pn();
    // 天启之珠：战斗路线冷却 135、没有 BUFF；守护路线有祝福
    reset(); castSkill(p, 'pc_awaken'); const cdB = Math.round(p.cool.pc_awaken); idle(); o.apocB = { cd: cdB, buff: !!p.buffs.pc_apoc };
    T.guard(true); reset(); castSkill(p, 'pc_awaken'); const cdG = Math.round(p.cool.pc_awaken); idle(); o.apocG = { cd: cdG, buff: p.buffs.pc_apoc ? { spd: +p.buffs.pc_apoc.aspd.toFixed(3), t: Math.round(p.buffs.pc_apoc.t), atk: p.buffs.pc_apoc.atk || 0 } : null };
    // 神圣洗礼：信仰之翼 → 圣力；辅助技能 +1 层；荣誉祝福吃层数；惩罚一起进冷却
    reset(); castSkill(p, 'pc_awaken2'); idle(); const n0 = p.buffs.pc_holy ? p.buffs.pc_holy.n : 0; castSkill(p, 'pc_sign'); idle(); castSkill(p, 'pc_honor'); idle();
    o.holy = { n0, n: p.buffs.pc_holy ? p.buffs.pc_holy.n : 0, share: p.cool.pc_punish > 100, honor: p.buffs.pc_honor ? +p.buffs.pc_honor.dmg.toFixed(3) : 0, base: +pcHonorVal(game.skillLv.pc_honor, 0).dmg.toFixed(3) };
    T.guard(false);
    // 惩罚：升空无敌、激光多段、落地终结；跳跃键提前终结
    reset(); const km = mob(250), kn = T.hits(km); castSkill(p, 'pc_punish'); let inv = true, zMax = 0; for (let i = 0; i < 280 && p.st === 'act'; i++) { run(1); if (p.act && p.act.skill === 'pc_punish' && p.actT > 0 && !(p.invul > 0)) inv = false; zMax = Math.max(zMax, p.z); } idle();
    o.punish = { hits: kn(), inv, zMax: Math.round(zMax), share: p.cool.pc_awaken2 > 100 };
    reset(); const km2 = mob(250), kn2 = T.hits(km2); castSkill(p, 'pc_punish'); run(36 + 60); input.virt.jump = 2; run(1); delete input.virt.jump; idle(); o.punishSkip = kn2();
    // 三觉：联动天启之珠的冷却；天启之珠冷却中三觉放不出
    reset(); castSkill(p, 'pc_awaken3'); o.link = { apoc: Math.round(p.cool.pc_awaken || 0) }; idle();
    reset(); p.cool.pc_awaken = 50; o.link.blocked = SKILLS.pc_awaken3.req(p); p.cool = {}; p.cool.pc_awaken3 = 50; o.link.back = SKILLS.pc_awaken.req(p);
    T.opt('pc_awaken3', false); p.cool = { pc_awaken: 50 }; o.link.toPunish = SKILLS.pc_awaken3.req(p) === true; T.opt('pc_awaken3', true);
    reset(); const am = mob(300), an = T.hits(am); castSkill(p, 'pc_awaken3'); idle(); o.awk3 = an();
    return o;
  });
  report('圣灵之槌：普攻换成战槌连击（距离更长），第 3 下震出圣光冲击打到 170px', D.mace.pick && D.mace.shock, D.mace);
  report('神罚之锤：永久装备、自动施放光之复仇、普攻变光属性独立攻击、跑攻 3 段圣光雷枪、落凤锤变雷霆重击', D.jup.buff && D.jup.revenge && D.jup.elem === 'light' && D.jup.type === 'indep' && D.jup.dash >= 3 && D.jup.crush >= 3, D.jup);
  report('天启之珠：战斗路线冷却 135 秒、不给祝福；守护路线冷却 160 秒、33 秒所有速度提高（自己不加攻击力）', D.apocB.cd === 135 && !D.apocB.buff && D.apocG.cd === 160 && !!D.apocG.buff && D.apocG.buff.t >= 31 && !D.apocG.buff.atk, { B: D.apocB, G: D.apocG });
  report('神圣洗礼：信仰之翼：圣力 1 层起、辅助技能 +1 层、荣誉祝福吃层数加成、惩罚一起进冷却', D.holy.n0 === 1 && D.holy.n >= 3 && D.holy.honor > D.holy.base && D.holy.share, D.holy);
  report('惩罚：升空、全程无敌、20+ 段激光 + 落地终结，和信仰之翼共用冷却；跳跃键提前终结', D.punish.hits >= 20 && D.punish.inv && D.punish.zMax > 100 && D.punish.share && D.punishSkip >= 2 && D.punishSkip < D.punish.hits, { punish: D.punish, skip: D.punishSkip });
  report('生命礼赞：神威：8 段；放了之后联动的天启之珠一起进冷却；天启之珠冷却中三觉放不出（反过来也一样）；改成联动惩罚后不看天启之珠', D.awk3 >= 8 && D.link.apoc >= 100 && typeof D.link.blocked === 'string' && typeof D.link.back === 'string' && D.link.toPunish, { hits: D.awk3, link: D.link });
  // 5) 觉醒自动学会
  const W = await page.evaluate(() => {
    const { p } = T, o = {}, f = save.data.flags, lv0 = game.lvl, bar0 = [...game.skillBar];
    const clear = () => { for (const id of ['pc_awaken', 'pc_awaken2', 'pc_punish', 'pc_awaken3']) delete game.skillLv[id]; game.skillBar = game.skillBar.map(() => null); };
    const tick = () => { p._psvT = 0; tickPassives(p, 0.3); };
    clear(); f.awaken = false; f.awaken2 = false; f.awaken3 = false; game.lvl = 30; tick(); o.locked = !game.skillLv.pc_awaken;
    f.awaken = true; tick(); o.a1 = { lv: game.skillLv.pc_awaken, bar: game.skillBar.includes('pc_awaken'), sp: SKILLS.pc_awaken.sp };
    f.awaken2 = true; tick(); o.a2 = { lv: game.skillLv.pc_awaken2 || 0, punish: game.skillLv.pc_punish || 0, punishBar: game.skillBar.includes('pc_punish'), wingsBar: game.skillBar.includes('pc_awaken2') };
    f.awaken3 = true; tick(); o.a3 = { lv: game.skillLv.pc_awaken3 || 0, bar: game.skillBar.includes('pc_awaken3') };
    game.lvl = 21; clear(); tick(); o.lv21 = game.skillLv.pc_awaken;
    clear(); const sp0 = game.sp; game.sp = 0; skillAutoLearn(); o.oneClick = game.skillLv.pc_awaken || 0; game.sp = sp0;
    o.cmd = [cmdTextOf('pc_awaken'), cmdTextOf('pc_awaken2'), cmdTextOf('pc_punish'), cmdTextOf('pc_awaken3')];
    game.lvl = lv0; game.skillBar = bar0; Object.assign(f, { awaken: true, awaken2: true, awaken3: true }); for (const id of ['pc_awaken', 'pc_awaken2', 'pc_punish', 'pc_awaken3']) game.skillLv[id] = 1;
    return o;
  });
  report('觉醒技自动学会：一觉前不给；天启之珠 / 惩罚 / 生命礼赞 0 SP 自动学会并进技能栏（战斗路线下信仰之翼学会但不占技能栏），等级随角色等级；一键加点也会学',
    W.locked && W.a1.lv === 3 && W.a1.bar && W.a1.sp === 0 && W.a2.lv >= 1 && W.a2.punish >= 1 && W.a2.punishBar && !W.a2.wingsBar && W.a3.lv >= 1 && W.a3.bar && W.lv21 === 1 && W.oneClick >= 1
    && W.cmd.join() === '↑↑↓↓+Z,↓↑→→+Z,↑↑+Z,←↑→↓+Z', W);
  noErr(logs, 'mech');
  await browser.close();
}

// ---------------- coop ----------------
if (MODES.includes('coop')) {
  const { startServer, launchPlayers, until, uiRegister, sleep } = await import('./net_lib.mjs');
  const srv = await startServer({ lagMs: 30, jitterMs: 5 });
  const { players, close } = await launchPlayers(2);
  const [PA, PB] = players.map(x => x.page);
  const create = async (P, cls) => {
    if (await P.evaluate(() => menus.isOpen('ask'))) await P.click('.askwin button:has-text("暂不上传")').catch(() => {});
    if (!(await P.evaluate(() => menus.isOpen('charselect')))) { await P.click('text=进入游戏').catch(() => {}); await until(P, () => menus.isOpen('charselect'), null, 8000); }
    await P.click('#charsel button:has-text("创建角色")'); await P.click(`.clscard[data-cls="${cls}"]`); await P.click('text=创建并开始');
    const ok = await until(P, () => game.scene === 'town' && world && game.player, null, 20000); await P.evaluate(() => { if (menus.isOpen('help')) menus.close('help'); }); return ok;
  };
  try {
    await uiRegister(PA, `${srv.url}?priest=1&x=`, 'crus'); report('A 注册（priest=1）', await create(PA, 'priest'), {});
    await uiRegister(PB, srv.url, 'mate'); report('B 注册', await create(PB, 'sword'), {});
    for (const P of [PA, PB]) await P.evaluate(() => { testLoadout(30); save.write(); });
    await PA.evaluate(() => netPartyInvite(null, 'mate')); await until(PB, () => menus.isOpen('nd_pinv')); await PB.click('.netask button:has-text("加入队伍")');
    await until(PA, () => netParty.p && netParty.p.members.length === 2);
    await PA.evaluate(() => { const s = Object.keys(SCENES).find(s => SCENES[s].gates.some(g => g.dungeon === 'lorien')); return worldTravel(s); });
    await until(PA, () => world && world.S.gates.some(g => g.dungeon === 'lorien'));
    await PA.evaluate(() => enterDungeon('lorien', 0));
    report('组队进图', await until(PB, () => coop.state === 'play' && game.scene === 'dungeon', null, 30000) && await until(PA, () => partyMates().length === 1, null, 20000), {});
    await sleep(1200);
    await PA.evaluate(() => { window.toastMsg = () => {}; const p = game.player; game.job = 'crusader'; save.data.job = 'crusader'; Object.assign(save.data.flags ??= {}, { awaken: true, awaken2: true, awaken3: true });
      onJobChange(p, 'crusader'); for (const id of classSkills('priest', 'crusader')) game.skillLv[id] = SKILLS[id].maxLv === 1 ? 1 : 5;
      const O = save.data.opts; O.pcRouteInit = 1; if (O.swOff) delete O.swOff.pc_guard; p.mpMax = p.mp = 1e6; p._psvT = 0; tickPassives(p, 0.3); });
    await PB.evaluate(() => { window.toastMsg = () => {}; const p = game.player; p.x = 300; p.hpMax = Math.max(p.hpMax, 3000); p.hp = Math.round(p.hpMax * 0.4); });
    await PA.evaluate(() => { const p = game.player, g = partyMates()[0]; p.x = g ? g.x - 60 : p.x; });
    await sleep(600);
    const cast = id => PA.evaluate(id => { const p = game.player; p.cool = {}; p.act = null; p.setState('idle'); p.mp = p.mpMax; const g = partyMates()[0]; if (g) { p.x = g.x - 60; p.y = g.y; } const ok = castSkill(p, id); return { ok, req: SKILLS[id].req ? SKILLS[id].req(p) : true }; }, id);
    const waitB = (fn, arg) => until(PB, fn, arg, 8000);
    const r1 = await cast('pc_honor'); report('荣誉祝福 → 队友 B 攻击力提高（队友拿到的是 pc_honor_p，不是自己的技能攻击力）', r1.ok && await waitB(() => !!(game.player.buffs.pc_honor_p && game.player.buffs.pc_honor_p.atk > 0)), r1);
    await sleep(900); const r2 = await cast('pc_sign'); report('守护徽章 → B 最大 HP 提高、受到伤害降低', r2.ok && await waitB(() => !!(game.player.buffs.pc_sign && game.player.buffs.pc_sign.hpPct > 0 && game.player.buffs.pc_sign.taken < 0)), r2);
    await sleep(900); const r3 = await cast('pc_light'); report('圣光守护 → HP 比例最低的 B 得到护盾（圣骑士 HP 的比例）', r3.ok && await waitB(() => absorbOf(game.player) > 0), { ...r3, b: await PB.evaluate(() => Math.round(absorbOf(game.player))) });
    await sleep(900); const r4 = await cast('pc_fountain'); report('生命源泉：组队时能放 → B 身上生命源泉（持续回复 + 免死）', r4.req === true && r4.ok && await waitB(() => !!(game.player.buffs.pc_fountain && game.player.buffs.pc_fountain.life > 0)), r4);
    const rev = await PB.evaluate(() => { const p = game.player, m = ents.find(e => e.team === 'e' && !e.dead) || { x: p.x + 50, y: p.y, z: 0, face: -1, team: 'e', buffs: {}, act: null }; for (const k of Object.keys(p.buffs)) if (p.buffs[k].absorb > 0) delete p.buffs[k]; p.invul = 0;
      applyHit(m, p, { dmg: 1e7, sure: true, knock: 0 }); return { dead: p.dead, hp: +(p.hp / p.hpMax).toFixed(2), used: !p.buffs.pc_fountain }; });
    report('生命源泉：B 受到致命伤害 → 不死、回复约 25%、BUFF 用掉（复活）', !rev.dead && rev.hp >= 0.2 && rev.used, rev);
    await PB.evaluate(() => { const p = game.player; p.hp = Math.round(p.hpMax * 0.3); p.lastHurtT = 1e9; }); await sleep(500);
    const hb = await PB.evaluate(() => game.player.hp / game.player.hpMax);
    const r5 = await cast('pc_wind'); await sleep(2000); const ha = await PB.evaluate(() => ({ hp: game.player.hp / game.player.hpMax, sh: absorbOf(game.player) > 0 }));
    report('圣愈之风 → B 回复 HP（≥ 15%）并得到护盾', r5.ok && ha.hp - hb >= 0.15 && ha.sh, { before: +hb.toFixed(2), after: +ha.hp.toFixed(2), shield: ha.sh });
    await sleep(500); await PA.evaluate(() => { game.player.cool = {}; }); const r6 = await cast('pc_awaken');
    report('天启之珠（守护路线）→ B 得到祝福（所有速度 + 攻击力）', r6.ok && await until(PB, () => !!(game.player.buffs.pc_apoc && game.player.buffs.pc_apoc.atk > 0 && game.player.buffs.pc_apoc.aspd > 0), null, 10000), r6);
    const errs = players.flatMap(x => x.logs.filter(l => l.type === 'pageerror').map(l => l.text.slice(0, 200)));
    report('无报错（coop）', errs.length === 0, errs.slice(0, 3));
  } catch (e) { report('coop 异常', false, String(e && e.stack || e).slice(0, 400)); }
  await close(); await srv.stop();
}

// ---------------- shots ----------------
if (MODES.includes('shots')) {
  const fs = await import('fs'), { execFileSync } = await import('child_process');
  const dir = 'test/shots/crusader/support', N = 5; fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  const { browser, page, logs } = await launch({ width: 1280, height: 720 });
  await page.goto(`${URL_BASE}?test&cls=priest&priest=1&mobs=0&mute`); await page.waitForFunction(() => window.__READY, null, { timeout: 30000 });
  await page.evaluate(() => { const p = game.player; window.toastMsg = () => {}; game.job = 'crusader'; Object.assign((save.data.flags ??= {}), { awaken: true, awaken2: true, awaken3: true }); onJobChange(p, 'crusader');
    for (const id of classSkills('priest', 'crusader')) game.skillLv[id] = Math.max(1, Math.min(SKILLS[id].maxLv || 5, 5));
    const O = save.data.opts; O.pcRouteInit = 1; if (O.swOff) delete O.swOff.pc_guard; p._psvT = 0; tickPassives(p, 0.3); p.mpMax = p.mp = 99999; setInterval(() => { p.mp = p.mpMax; }, 200); });
  await page.waitForTimeout(1500); await page.evaluate(() => { window.__base = Object.keys(game.player.buffs); });
  const rows = [];
  for (const id of ['pc_sign', 'pc_honor', 'pc_light', 'pc_wind', 'pc_sanct', 'pc_awaken', 'pc_awaken2', 'pc_awaken3']) {
    const r = await page.evaluate(id => { const p = game.player; Object.assign(p, { x: 380, y: 100, z: 0, vz: 0, face: 1, cool: {}, buffs: {} }); p.act = null; p.setState('idle'); p.hp = Math.round(p.hpMax * 0.5);
      const req = SKILLS[id].req ? SKILLS[id].req(p) : true, ok = castSkill(p, id); return { ok, req, name: SKILLS[id].name, dur: Math.min(3.8, Math.max(0.6, p.act ? p.act.dur || 0.6 : 0.6)), t0: game.t }; }, id);
    const frames = [];
    for (let i = 0; i < N; i++) {
      await page.waitForFunction(at => game.t >= at, r.t0 + r.dur * (i + 0.5) / N, { timeout: 6000 }).catch(() => { });
      const pos = await page.evaluate(() => { const p = game.player; return { x: (p.x - cam.x) * 1280 / 960, y: (FLOOR_Y + p.y - p.z) * 720 / 540 }; });
      const f = `${dir}/${id}-${i}.png`; frames.push(f);
      await page.screenshot({ path: f, clip: { x: Math.max(0, Math.min(1280 - 480, pos.x - 170)), y: Math.max(0, Math.min(720 - 320, pos.y - 250)), width: 480, height: 320 } });
    }
    await page.waitForTimeout(1200);
    const bf = await page.evaluate(() => { const p = game.player; return { buffs: Object.keys(p.buffs).filter(k => /^pc_/.test(k) && !window.__base.includes(k)), shield: Math.round(absorbOf(p)), hp: +(p.hp / p.hpMax).toFixed(2) }; });
    rows.push({ id, name: r.name, frames, flags: [r.ok && r.req === true ? '施放' : '✗放不出 ' + r.req, bf.buffs.join(' ').slice(0, 22), `护盾 ${bf.shield} HP ${bf.hp}`], ok: r.ok && r.req === true });
  }
  await browser.close();
  const py = `
import json, sys
from PIL import Image, ImageDraw, ImageFont
rows = json.load(open(sys.argv[1])); N = int(sys.argv[3]); W, H, LW = 240, 160, 250
try: font = ImageFont.truetype('/System/Library/Fonts/STHeiti Medium.ttc', 18); small = ImageFont.truetype('/System/Library/Fonts/STHeiti Medium.ttc', 14)
except Exception: font = small = ImageFont.load_default()
sheet = Image.new('RGB', (LW + W * N, H * len(rows)), '#15131a'); d = ImageDraw.Draw(sheet)
for r, row in enumerate(rows):
    y = r * H; d.rectangle([0, y, LW - 4, y + H - 4], fill='#1f1c26' if row['ok'] else '#3a1414')
    d.text((8, y + 8), row['name'], fill='#ffe8a8', font=font); d.text((8, y + 34), row['id'], fill='#9a8f7c', font=small)
    for k, f in enumerate(row['flags']): d.text((8, y + 58 + k * 19), f, fill='#ffd27a', font=small)
    for i, fp in enumerate(row['frames']): sheet.paste(Image.open(fp).convert('RGB').resize((W - 4, H - 4)), (LW + i * W, y))
sheet.save(sys.argv[2], quality=80)
`;
  fs.writeFileSync(`${dir}/rows.json`, JSON.stringify(rows));
  execFileSync('python3', ['-c', py, `${dir}/rows.json`, 'test/shots/crusader/support.jpg', String(N)]);
  report('守护路线连拍（test/shots/crusader/support.jpg）：辅助技能全部能放', rows.every(r => r.ok), rows.map(r => `${r.id}:${r.flags.join('/')}`));
  noErr(logs, 'shots');
}

console.log(fail ? `\n${fail} 项失败` : '\n全部通过');
process.exit(fail ? 1 : 0);
