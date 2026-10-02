// 神枪手（女）+ 通用操作的官方对齐测试（docs/SKILLS_OFFICIAL_common.md / SKILLS_OFFICIAL_gun.md）：暂停游戏循环、逐帧推进，逐条验证
// 普攻（拔枪 → 按武器连射 → 收枪、按住 X 自动下一轮、没有 ↑X 上射、手炮范围判定、跳射按武器定上限 + 空中射击）、
// Z / Space 分开、按住 ↓+Z、取消白名单、后跳 / 后跳-强化、受身蹲伏、起身上旋踢、G-14 装填、银弹按发数、格林机枪射速、v5 存档迁移。node test/gunner.mjs
import { launch, URL_BASE } from './lib.mjs';
let fail = 0;
const report = (name, ok, info) => { if (!ok) fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${JSON.stringify(info)}`); };
const { browser, page, logs } = await launch({ width: 960, height: 540 });
await page.goto(`${URL_BASE}?test&cls=gun&mobs=0&mute`); await page.waitForFunction(() => window.__READY, null, { timeout: 30000 });
await page.evaluate(() => {
  game.paused = true;
  window.T = {
    // 逐帧推进（step 内部会调 input.frame / endFrame）
    run(n) { for (let i = 0; i < n; i++) step(1 / 60); },
    tap(a) { input.virt[a] = 2; T.run(1); delete input.virt[a]; },
    hold(a) { input.virt[a] = 1; }, press(a) { input.virt[a] = 2; }, release(a) { delete input.virt[a]; },   // press：按下并一直按着（下一帧起算按住）
    clear() { for (const e of ents) if (e !== game.player) e.remove = true; T.run(1); projs.length = 0; },
    reset(p = game.player) { for (const k in input.virt) delete input.virt[k]; input.buf.length = 0; input.dirHist.length = 0;
      Object.assign(p, { x: 300, y: 100, z: 0, vx: 0, vy: 0, vz: 0, face: 1, act: null, invul: 0, superArmor: 0, hitstop: 0, dead: false, cool: {}, buffs: {}, charges: {}, bsCd: 0, reboundCd: 0, techHold: false, stun: 0 });
      p.hp = p.hpMax; p.mp = p.mpMax; p.setState('idle'); resetCmb(p); T.run(2); },
    mob(x = 400, y = 100) { const m = spawnMonster('goblin', x, y); m.control = null; m.invul = 0; m.z = 0; m.vz = 0; m.hp = m.hpMax = 1e9; m.setState('idle'); return m; },
    weapon(w) { inv.equip.weapon = w ? { wtype: w, slot: 'weapon' } : null; },
  };
  const L = game.skillLv; for (const id of CLASSES.gun.skills) if (SKILLS[id]) L[id] = SKILLS[id].passive ? 1 : 5; L.c_bsup = 0;
  game.skillBar = ['g_knee', 'g_launch', 'g_gatling', 'g_silver', 'g_rx78', 'g_spin', 'g_stomp', 'g_slide', 'g_m3', 'g_dust', 'g_aerial', 'g_flash', 'g_bbq', 'g_grenade'];
  // 统计射出的子弹
  window.__shots = 0; const fb = window.fireBullet; window.fireBullet = (e, o) => { if (e === game.player) window.__shots++; return fb(e, o); };
});
const R = await page.evaluate(() => {
  const out = {}, p = game.player; T.clear();
  // 1) 普攻：一轮发数随武器，第一发在拔枪之后，打完进入收枪；按住 X 会自动开下一轮
  const round = w => { T.weapon(w); T.reset(); window.__shots = 0; T.press('attack'); let firstAt = -1, holster = false, again = false, t = 0;
    for (let i = 0; i < 200; i++) { T.run(1); t++; if (firstAt < 0 && window.__shots > 0) firstAt = t; if (p.act && p.act.name === 'holster') holster = true; if (holster && p.act && p.act.name === 'shot1') { again = true; break; } }
    T.release('attack'); const n = window.__shots; T.run(60); return { n, firstAt, holster, again }; };
  out.rev = round(null); out.auto = round('autopistol'); out.rifle = round('rifle'); out.bow = round('bowgun');
  // 手炮：不打子弹，是前方范围判定
  T.clear(); T.weapon('handcannon'); T.reset(); const hm = T.mob(380, 100); const hp0 = hm.hp; window.__shots = 0; const pr0 = projs.length;
  T.tap('attack'); T.run(40); out.cannon = { bullets: window.__shots, projs: projs.length - pr0, hit: hm.hp < hp0 }; T.run(60); T.clear();
  // 2) 没有 ↑X 上射：按住 ↑ 普攻，子弹是平飞的
  T.weapon(null); T.reset(); T.hold('up'); T.tap('attack'); T.run(12); T.release('up'); out.upShotVz = projs.filter(q => q.owner === p).map(q => Math.round(q.vz)); T.run(60); projs.length = 0;
  // 3) 跳射：每跳上限随武器（左轮 4），空中射击 Buff 后增加（1 级 +4）
  const airShots = () => { T.reset(); p.vz = p.jumpV; p.z = 0.5; p.airAtk = 0; p.setState('jump'); window.__shots = 0; T.press('attack'); for (let i = 0; i < 120 && (p.z > 0.1 || i < 5); i++) T.run(1); T.release('attack'); T.run(10); return window.__shots; };
  out.air = airShots(); game.skillLv.g_aerial = 1; out.airCapBuff = (() => { T.reset(); p.buffs.g_aerial = { t: 25, lv: 1 }; return airMaxOf(p); })(); game.skillLv.g_aerial = 5;
  p.buffs = {}; out.airCap = { rev: (T.weapon(null), airMaxOf(p)), cannon: (T.weapon('handcannon'), airMaxOf(p)), bow: (T.weapon('bowgun'), airMaxOf(p)) }; T.weapon(null);
  // 4) Z / Space 分开：单按 Space 不会放出 Z 技能；↓→+Space = 银弹、↓→+Z = 刺踢
  T.reset(); T.tap('cmdB'); T.run(2); out.spaceAlone = p.act && p.act.skill || null; T.run(40);
  T.reset(); T.tap('down'); T.tap('right'); T.tap('cmdB'); T.run(2); out.dfSpace = p.act && p.act.skill || null; T.run(40);
  T.reset(); T.tap('down'); T.tap('right'); T.tap('cmd'); T.run(2); out.dfZ = p.act && p.act.skill || null; T.run(60);
  // 5) 按住 ↓ + Z = RX-78；快速点 ↓ 再按 Z 不是 RX-78（是单按 Z 的后撩踢）
  T.reset(); T.hold('down'); T.run(20); T.tap('cmd'); T.release('down'); T.run(2); out.holdDZ = p.act && p.act.skill || null; T.run(60); projs.length = 0;
  T.reset(); T.hold('down'); T.run(2); T.release('down'); T.tap('cmd'); T.run(2); out.tapDZ = p.act && p.act.skill || null; T.run(60);
  // 6) 取消规则：普攻 → 攻击技能（强制）可以；Buff（银弹）不能取消普攻；技能 → 其他技能不行（白名单外）
  T.reset(); T.tap('attack'); T.run(3); T.tap('s0'); T.run(1); out.basicToSkill = p.act && p.act.skill || null; T.run(60);
  T.reset(); T.tap('attack'); T.run(3); T.tap('s3'); T.run(1); out.basicToBuff = p.act && (p.act.skill || p.act.name); T.run(80);
  T.reset(); castSkill(p, 'g_knee'); T.run(20); T.tap('s11'); T.run(1); out.skillToSkill = p.act && p.act.skill || null; T.run(60);
  // 7) 后跳：普攻中随时可以；技能中没学后跳-强化不行；学了可以（冷却 40）；受击中学了可以脱身（冷却 30，无敌）
  const bs = () => { T.hold('down'); T.tap('jump'); T.release('down'); T.run(1); return p.act && p.act.name; };
  T.reset(); T.tap('attack'); T.run(3); out.bsFromBasic = bs(); T.run(40);
  T.reset(); castSkill(p, 'g_flash'); T.run(8); out.bsFromSkillNoUp = bs(); T.run(40);
  game.skillLv.c_bsup = 1; T.reset(); castSkill(p, 'g_flash'); T.run(8); out.bsFromSkillUp = { act: bs(), cd: Math.round(p.bsCd) }; T.run(40);
  T.reset(); p.setState('hit'); p.stun = 1; out.bsFromHit = { act: bs(), cd: Math.round(p.bsCd), invul: p.invul > 0 }; for (let i = 0; i < 60 && p.act; i++) T.run(1); out.bsLandInvul = p.invul > 0.5; T.run(80);
  T.reset(); p.setState('hit'); p.stun = 1; p.bsCd = 10; out.bsFromHitOnCd = bs(); T.run(80); game.skillLv.c_bsup = 0;
  // 8) 受身蹲伏：倒地后按 C → 蹲伏（无敌），按住一直蹲，松开起身 + 霸体；冷却 5 秒
  T.reset(); p.setState('down'); p.downTime = 5; T.run(6); T.press('jump'); T.run(1); const t0 = { st: p.st, tech: p.tech, hold: p.techHold, invul: p.invul > 0 };
  T.run(60); const t1 = { st: p.st, invul: p.invul > 0 }; T.release('jump'); T.run(12); const t2 = { st: p.st, sa: p.superArmor > 0.05 };
  out.tech = { start: t0, held1s: t1, released: t2, cd: Math.round(p.reboundCd) }; T.run(40);
  T.reset(); p.setState('air'); p.z = 10; p.vz = -100; T.tap('jump'); T.run(1); out.techInAir = p.st; T.run(80);
  // 9) 起身上旋踢：倒地时按 X；滑铲（跑攻）中按 X
  T.reset(); p.setState('down'); p.downTime = 5; T.run(8); T.tap('attack'); T.run(1); out.getupSpin = p.act && p.act.skill || null; T.run(60);
  T.reset(); p.doAct(p.acts.dash); T.run(8); T.tap('attack'); T.run(1); out.dashSpin = p.act && p.act.skill || null; T.run(60);
  // 10) G-14：装填 3 颗，第 4 次没弹；每 2 秒补 1 颗
  T.reset(); const thr = []; for (let i = 0; i < 4; i++) { p.cool.g_grenade = 0; const before = p.act; castSkill(p, 'g_grenade'); thr.push(!!p.act && p.act !== before && p.act.skill === 'g_grenade'); T.run(5); }
  const n0 = p.charges.g_grenade.n; T.run(125); out.grenade = { casts: thr, left: n0, after2s: p.charges.g_grenade.n }; T.run(60);
  // 11) 银弹：25 发，普攻每发消耗 1
  T.reset(); castSkill(p, 'g_silver'); T.run(30); const s0 = p.buffs.g_silver && p.buffs.g_silver.n; T.press('attack'); for (let i = 0; i < 90 && !(p.act && p.act.name === 'holster'); i++) T.run(1); T.release('attack'); T.run(30); out.silver = { start: s0, after: p.buffs.g_silver && p.buffs.g_silver.n }; T.run(40);
  // 12) 格林机枪：每秒 7 发
  T.reset(); window.__shots = 0; castSkill(p, 'g_gatling'); T.run(12 + 60); out.gatling1s = window.__shots; T.run(120);
  // 13) 通用技能：后跳-强化在技能表里，10 级学、50 SP
  out.common = { inList: classSkills('gun', null).includes('c_bsup'), lvReq: SKILLS.c_bsup.lvReq, sp: SKILLS.c_bsup.spCost(0) };
  out.lvStep = { knee: skLvReqOf('g_knee', 4), gat: skLvReqOf('g_gatling', 3) };
  // 14) v4 → v5 迁移：技能重置、SP 全额返还、技能栏 14 格且保留原来的位置
  const d = save.migrate({ ...save.defaults('gun'), v: 4, lvl: 20, sp: 3, skillLv: { g_knee: 5, g_spin: 7 }, skillBar: ['g_spin', 'g_knee', null, null, 'nope', null, null, null, null, null, null, 'g_launch'], opts: { cmdLock: { g_knee: true } } });
  const sp = spTotalAt(20);   // v5 先按 28+n 洗点，spMigrate 补到当前曲线
  out.migrate = { v: d.v, lv: d.skillLv, sp: d.sp, want: sp, bar: d.skillBar, len: d.skillBar.length, lock: d.opts.cmdLock };
  return out;
  function skLvReqOf(id, lv) { const S = SKILLS[id]; return S.lvReq + (lv - 1) * S.lvStep; }
});
report('普攻：左轮一轮 4 发、先拔枪、打完收枪、按住 X 自动下一轮', R.rev.n === 4 && R.rev.firstAt >= 4 && R.rev.holster && R.rev.again, R.rev);
report('普攻：自动手枪 6 发 / 步枪 3 发 / 手弩 7 发', R.auto.n === 6 && R.rifle.n === 3 && R.bow.n === 7 && R.rifle.firstAt > R.auto.firstAt, { auto: R.auto, rifle: R.rifle, bow: R.bow });
report('手炮普攻：不打子弹，前方范围判定', R.cannon.bullets === 0 && R.cannon.projs === 0 && R.cannon.hit, R.cannon);
report('没有 ↑X 上射（按住 ↑ 子弹仍然平飞）', R.upShotVz.length > 0 && R.upShotVz.every(v => v === 0), R.upShotVz);
report('跳射：左轮每跳 4 发；手炮 1 发、手弩 7 发；空中射击 1 级 +4', R.air === 4 && R.airCap.rev === 4 && R.airCap.cannon === 1 && R.airCap.bow === 7 && R.airCapBuff === 8, { air: R.air, cap: R.airCap, buff: R.airCapBuff });
report('Z / Space 分开：单按 Space 不放 Z 技能；↓→+Space 银弹、↓→+Z 刺踢', R.spaceAlone === null && R.dfSpace === 'g_silver' && R.dfZ === 'g_flash', { space: R.spaceAlone, dfSpace: R.dfSpace, dfZ: R.dfZ });
report('按住 ↓+Z = RX-78；快速点 ↓ 再 Z 不是 RX-78', R.holdDZ === 'g_rx78' && R.tapDZ !== 'g_rx78', { hold: R.holdDZ, tap: R.tapDZ });
report('取消：普攻 → 攻击技能可以；Buff 不能取消普攻；技能 → 技能不行', R.basicToSkill === 'g_knee' && R.basicToBuff !== 'g_silver' && R.skillToSkill === 'g_knee', { b2s: R.basicToSkill, b2buff: R.basicToBuff, s2s: R.skillToSkill });
report('后跳：普攻中可以；技能中没学后跳-强化不行', R.bsFromBasic === 'back' && R.bsFromSkillNoUp !== 'back', { basic: R.bsFromBasic, skillNoUp: R.bsFromSkillNoUp });
report('后跳-强化：技能中后跳（冷却 40）；受击中脱身（冷却 30、无敌、落地后 1 秒无敌）；冷却中不能再用', R.bsFromSkillUp.act === 'back' && R.bsFromSkillUp.cd === 40 && R.bsFromHit.act === 'back' && R.bsFromHit.cd === 30 && R.bsFromHit.invul && R.bsLandInvul && R.bsFromHitOnCd !== 'back', { up: R.bsFromSkillUp, hit: R.bsFromHit, land: R.bsLandInvul, onCd: R.bsFromHitOnCd });
report('受身蹲伏：蹲着无敌、按住一直蹲、松开起身 + 霸体、冷却 5 秒；空中不能受身', R.tech.start.st === 'getup' && R.tech.start.tech && R.tech.start.hold && R.tech.start.invul && R.tech.held1s.st === 'getup' && R.tech.held1s.invul && R.tech.released.st !== 'getup' && R.tech.released.sa && R.tech.cd >= 4 && R.techInAir !== 'getup', { ...R.tech, air: R.techInAir });
report('起身上旋踢：倒地时 X / 滑铲中 X', R.getupSpin === 'g_spin' && R.dashSpin === 'g_spin', { down: R.getupSpin, dash: R.dashSpin });
report('G-14：装填 3 颗、第 4 次没弹、2 秒补 1 颗', R.grenade.casts.join() === 'true,true,true,false' && R.grenade.left === 0 && R.grenade.after2s === 1, R.grenade);
report('银弹按发数：25 发，普攻一轮扣 4 发', R.silver.start === 25 && R.silver.after === 21, R.silver);
report('格林机枪每秒 7 发', R.gatling1s >= 6 && R.gatling1s <= 8, { shots: R.gatling1s });
report('通用技能 后跳-强化（10 级 / 50 SP）在技能表里；学习间隔 lvStep', R.common.inList && R.common.lvReq === 10 && R.common.sp === 50 && R.lvStep.knee === 10 && R.lvStep.gat === 9, { ...R.common, ...R.lvStep });
report('v4 → v5 迁移：技能重置、SP 全额返还、技能栏 14 格保留位置、清指令锁定', R.migrate.v === 5 && R.migrate.sp === R.migrate.want && R.migrate.lv.g_knee === 1 && !R.migrate.lv.g_spin && R.migrate.len === 14 && R.migrate.bar[0] === 'g_spin' && R.migrate.bar[1] === 'g_knee' && R.migrate.bar[4] === null && R.migrate.bar[11] === 'g_launch' && !R.migrate.lock.g_knee, R.migrate);
const errs = logs.filter(l => l.type !== 'warning'); report('无报错', errs.length === 0, errs.slice(0, 3));
await browser.close();
console.log(fail ? `${fail} 项失败` : '全部通过');
process.exit(fail ? 1 : 0);
