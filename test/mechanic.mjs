// 机械师（女）测试（docs/SKILLS_OFFICIAL_gun.md 第 6 节）：暂停游戏循环、逐帧推进，逐条验证
// 转职登记与魔攻、RX-78 走召唤框架（追击自爆）、EZ-8（按住延长引信）、机械引爆（点按就地 / 按住准星冲锋）、
// G 系列（G-1 自动射击与连按、改装共用时间与冷却、G-2 充电与电磁波、G-3 缠绕与召回、G 系扩张叠层）、Ex-S 上限 9、机械指令停火、
// 机械改良开关、危机追击者、伪装、狂风（再按自爆）、G-磁力弹、空投支援、拦截机工厂与光反应能量模块、G-0 战争领主、换房间、指令、转职任务线。
// node test/mechanic.mjs
import { launch, URL_BASE } from './lib.mjs';
let fail = 0;
const report = (name, ok, info) => { if (!ok) fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${JSON.stringify(info)}`); };
const { browser, page, logs } = await launch({ width: 960, height: 540 });
await page.goto(`${URL_BASE}?test&cls=gun&mobs=0&mute`); await page.waitForFunction(() => window.__READY, null, { timeout: 30000 });
await page.evaluate(() => {
  game.paused = true;
  window.T = {
    run(n) { for (let i = 0; i < n; i++) step(1 / 60); },
    sec(s) { T.run(Math.round(s * 60)); },
    hold(a) { input.virt[a] = 1; }, press(a) { input.virt[a] = 2; }, release(a) { delete input.virt[a]; },
    tap(a) { input.virt[a] = 2; T.run(1); delete input.virt[a]; },
    clear() { clearAllSummons('test'); for (const e of ents) if (e !== game.player) e.remove = true; T.run(1); projs.length = 0; const p = game.player; p.gs = null; p.gsTfT = 0; p.mechHold = false; p.cloakT = 0; },
    reset(p = game.player) { for (const k in input.virt) delete input.virt[k]; input.buf.length = 0; input.dirHist.length = 0;
      Object.assign(p, { x: 300, y: 100, z: 0, vx: 0, vy: 0, vz: 0, face: 1, act: null, invul: 0, superArmor: 0, hitstop: 0, dead: false, cool: {}, buffs: {}, charges: {}, bsCd: 0, stun: 0 });
      p.hp = p.hpMax; p.mp = p.mpMax; p.setState('idle'); resetCmb(p); T.run(2); },
    mob(x = 480, y = 100, kind = 'goblin') { const m = spawnMonster(kind, x, y); m.control = null; m.invul = 0; m.z = 0; m.vz = 0; m.hp = m.hpMax = 1e9; m.evade = 0; m.setState('idle'); return m; },
    cast(id) { const p = game.player; p.cool[id] = 0; p.mp = p.mpMax; const slot = game.skillBar.indexOf(id); return castSkill(p, id, false, slot >= 0 ? 's' + slot : null); },
    castHeld(id) { const p = game.player; p.cool[id] = 0; p.mp = p.mpMax; const slot = game.skillBar.indexOf(id); input.virt['s' + slot] = 1; return castSkill(p, id, false, 's' + slot); },
    rel(id) { delete input.virt['s' + game.skillBar.indexOf(id)]; },
    n(key) { return summonsOf(game.player, key).length; },
  };
  const p = game.player;
  game.job = 'mechanic'; if (save.data) save.data.job = 'mechanic'; onJobChange(p, 'mechanic');
  const L = game.skillLv; for (const id of CLASSES.gun.skills.concat(CLASSES.gun.jobs.mechanic.skills)) if (SKILLS[id]) L[id] = SKILLS[id].passive ? 1 : 5;
  for (const id of ['gm_hitech', 'gm_convert', 'gm_solar', 'gm_gext', 'gm_backup', 'gm_gop', 'gm_micro']) L[id] = 0;
  L.gm_g0 = 1; L.gm_bolt = 1; L.gm_stardust = 1;
  const F = save.data.flags ??= {}; F.awaken = F.awaken2 = F.awaken3 = true;   // 测试：三次觉醒都已完成
  game.skillBar = ['gm_ez8', 'gm_detonate', 'gm_g1', 'gm_g2', 'gm_g3', 'gm_viper', 'gm_gale', 'gm_magnet', 'gm_drop', 'gm_factory', 'gm_g0', 'g_rx78', 'gm_hold', 'gm_camo'];
  recalcStats(p); p.hp = p.hpMax; p.mp = p.mpMax;
});
const R = await page.evaluate(() => {
  const out = {}, p = game.player; T.clear(); T.reset();
  const dealt = (m, hp0) => Math.round(hp0 - m.hp);
  // 0) 转职登记：魔法伤害职业（魔攻不再是物攻的 55%）
  const J = CLASSES.gun.jobs.mechanic; game.job = null; recalcStats(p); const mPhys = p.matk; game.job = 'mechanic'; recalcStats(p);
  out.reg = { job: !!J, skills: J.skills.every(id => SKILLS[id] && SKILLS[id].job === 'mechanic'), dmgType: p.stats.dmgType, matkUp: +(p.matk / mPhys).toFixed(2), quests: J.quests.length, trial: J.trial, awaken: J.awaken };
  T.reset();
  // 1) RX-78：召唤框架的 follower，追着敌人跑、贴上自爆
  let m = T.mob(520); let hp0 = m.hp; T.cast('g_rx78'); T.run(20);
  const rx = summonsOf(p, 'mech_rx78')[0]; out.rx = { summoned: !!rx, invul: rx && rx.invul === Infinity }; const x0 = rx ? rx.x : 0;
  T.sec(2.5); out.rx.moved = rx ? Math.round(rx.x - x0) : 0; out.rx.gone = rx ? rx.gone : null; out.rx.dmg = dealt(m, hp0);
  T.clear(); T.reset();
  // 2) EZ-8：3 秒引信；按住技能键蓄力延长引信
  m = T.mob(360); hp0 = m.hp; T.cast('gm_ez8'); T.run(30); let ez = summonsOf(p, 'mech_ez8')[0]; out.ez = { life: ez ? +ez.life.toFixed(2) : null };
  T.sec(2.0); out.ez.before = dealt(m, hp0); T.sec(1.5); out.ez.after = dealt(m, hp0); out.ez.gone = ez && ez.gone;
  T.clear(); T.reset(); T.castHeld('gm_ez8'); T.sec(1.2); T.rel('gm_ez8'); T.run(20); ez = summonsOf(p, 'mech_ez8')[0]; out.ez.heldLife = ez ? +ez.life.toFixed(2) : null;
  T.clear(); T.reset();
  // 3) 机械引爆（点按）：范围内的 RX-78 / EZ-8 就地爆炸，范围外的不炸
  p.mechHold = true;   // 先停火，让 RX-78 待在原地
  const a1 = mechRx78(p, 5, { x: 380, y: 100 }), a2 = mechRx78(p, 5, { x: 1400, y: 100 }); const e1 = summon(p, 'mech_ez8', { lv: 5, x: 420, y: 100, life: 99 }); e1.base = 1;
  T.run(2); p.mechHold = false; T.cast('gm_detonate'); T.sec(0.5);
  out.detTap = { nearRx: a1.gone, nearEz: e1.gone, farRx: a2.gone };
  T.clear(); T.reset();
  // 4) 机械引爆（按住）：出准星，方向键移动，松开后 RX-78 冲到准星处爆炸
  p.mechHold = true; const r1 = mechRx78(p, 5, { x: 340, y: 60 }); const e2 = summon(p, 'mech_ez8', { lv: 5, x: 330, y: 140, life: 99 }); e2.base = 1; T.run(2); p.mechHold = false;
  m = T.mob(600, 100); hp0 = m.hp; m.hp = m.hpMax = 1e9;
  T.castHeld('gm_detonate'); T.run(15); const aim0 = p.act && p.act.aim ? Math.round(p.act.aim.x) : null; T.hold('right'); T.sec(0.4); T.release('right');
  const aim1 = p.act && p.act.aim ? { x: Math.round(p.act.aim.x), y: Math.round(p.act.aim.y) } : null;
  T.rel('gm_detonate'); T.run(3); const rushing = !!r1.rush, leaping = !!e2.leap; let rxAt = null; for (let i = 0; i < 90 && !r1.gone; i++) { T.run(1); rxAt = Math.round(r1.x); }
  T.sec(0.8);
  out.detHold = { aim0, aim1, rushing, leaping, rxGone: r1.gone, ezGone: e2.gone, rxAt, dmg: dealt(m, hp0) };
  T.clear(); T.reset();
  // 5) G-1：身后浮空炮台，自动射击；再按技能键立刻补射
  m = T.mob(560); hp0 = m.hp; T.cast('gm_g1'); T.run(40); const g1 = summonsOf(p, 'mech_g1')[0];
  out.g1 = { n: T.n('mech_g1'), behind: g1 ? Math.round(p.x - g1.x) : null, life: g1 && g1.life };
  T.sec(2.4); out.g1.dmg = dealt(m, hp0);
  let shots = projs.filter(q => q.owner === g1).length, s0 = 0; const fire = window.g1Fire; window.__g1n = 0; window.g1Fire = (s, t, b) => { window.__g1n++; return fire(s, t, b); };
  T.sec(1.0); s0 = window.__g1n; window.__g1n = 0; for (let i = 0; i < 3; i++) { p.cool['gm_g1~'] = 0; T.cast('gm_g1'); T.sec(0.34); } out.g1.rapid = { auto: s0, pressed: window.__g1n };
  window.g1Fire = fire;
  // 6) 改装：G-2（3 台），持续 +10 秒（不超过 20 秒），改装冷却 5 秒
  T.sec(12); const left0 = gsLeft(p); T.cast('gm_g2'); T.run(30);
  out.tf = { form: gsForm(p), n: T.n('mech_g2'), left0: +left0.toFixed(1), left1: +gsLeft(p).toFixed(1) };
  p.cool.gm_g3 = 0; const blocked = SKILLS.gm_g3.req(p); out.tf.blockedMsg = blocked;
  // G-2 充电 1.5 秒后电磁波
  T.sec(1.6); m.hp = 1e9; hp0 = m.hp; const pr0 = projs.length; p.cool['gm_g2~'] = 0; T.cast('gm_g2'); T.run(2); const waves = projs.length - pr0; T.sec(0.8);
  out.g2 = { charged: true, waves, dmg: dealt(m, hp0), chgAfter: p.gs.chg };
  // G-3（冷却好了）：6 台；再按缠绕，敌人持续挨打；再按召回
  p.gsTfT = 0; p.cool.gm_g3 = 0; T.cast('gm_g3'); T.run(30); out.g3 = { n: T.n('mech_g3'), form: gsForm(p) };
  m.hp = 1e9; hp0 = m.hp; p.cool['gm_g3~'] = 0; T.cast('gm_g3'); T.sec(2.5); out.g3.on = p.gs.g3on; out.g3.stuck = summonsOf(p, 'mech_g3').filter(s => s.stuck).length; out.g3.dmg = dealt(m, hp0);
  p.cool['gm_g3~'] = 0; T.cast('gm_g3'); T.sec(1.0); out.g3.recalled = !p.gs.g3on && summonsOf(p, 'mech_g3').every(s => !s.tgt);
  // G-1 键 = 改装回 G-1
  p.gsTfT = 0; p.cool['gm_g1~'] = 0; T.cast('gm_g1'); T.run(30); out.back = gsForm(p);
  T.clear(); T.reset();
  // 7) G 系扩张：改装冷却 0，每次改装叠一层（最多 5）
  game.skillLv.gm_gext = 1; T.cast('gm_g1'); T.run(30); for (let i = 0; i < 7; i++) { const id = i % 2 ? 'gm_g2' : 'gm_g3'; T.cast(id); T.run(30); }
  out.gext = { stacks: p.gs.stacks, form: gsForm(p), tfReady: tfReady(p) }; game.skillLv.gm_gext = 0;
  T.clear(); T.reset();
  // 8) Ex-S 毒蛇炮：最多 9 台（第 10 台挤掉最早的），会打人，6 秒后自爆
  m = T.mob(600); hp0 = m.hp; const vs = []; for (let i = 0; i < 10; i++) { T.cast('gm_viper'); T.run(30); vs.push(summonsOf(p, 'mech_viper').slice(-1)[0]); }
  out.viper = { n: T.n('mech_viper'), firstGone: vs[0].gone }; T.sec(1); out.viper.dmg = dealt(m, hp0) > 0; T.sec(6); out.viper.after = T.n('mech_viper');
  T.clear(); T.reset();
  // 9) 机械指令：停火（RX-78 不追、科罗纳不开火），再放一次恢复
  T.cast('gm_hold'); T.run(20); out.hold = { on: !!p.mechHold }; m = T.mob(600); const rh = mechRx78(p, 5, { x: 360, y: 100 }); T.cast('gm_g1'); T.run(30); const g1h = summonsOf(p, 'mech_g1')[0]; hp0 = m.hp;
  T.sec(1.5); out.hold.rxStill = Math.abs(rh.x - 360) < 4; out.hold.noDmg = dealt(m, hp0) === 0;
  T.cast('gm_hold'); T.run(20); T.sec(2); out.hold.off = !p.mechHold; out.hold.dmgAfter = dealt(m, hp0) > 0;
  T.clear(); T.reset();
  // 10) 机械改良：开关 BUFF（技能攻击力、机器人移速），耗 MP，再放关闭
  T.cast('gm_robotics'); T.run(40); const rb = p.buffs.gm_robotics; out.robotics = { on: !!rb, spd: +robSpd(p).toFixed(2) };
  T.cast('gm_robotics'); T.run(40); out.robotics.off = !p.buffs.gm_robotics;
  T.cast('gm_robotics'); T.run(40); const rg = p.mpRegen; p.mpRegen = 1e-6; p.mp = 0.1; T.sec(0.6); out.robotics.mpOut = !p.buffs.gm_robotics; p.mpRegen = rg; p.mp = p.mpMax;
  T.clear(); T.reset();
  // 11) 危机追击者（10 级 = 100%）：被打时放出 RX-78，有冷却
  game.skillLv.gm_backup = 10; const atk = T.mob(330); p.invul = 0; applyHit(atk, p, { dmg: 0.01, sure: true }, { proj: true }); T.run(2); const b1 = T.n('mech_rx78');
  p.setState('idle'); p.invul = 0; applyHit(atk, p, { dmg: 0.01, sure: true }, { proj: true }); T.run(2); out.backup = { first: b1, cd: T.n('mech_rx78') === b1 }; game.skillLv.gm_backup = 0;
  T.clear(); T.reset();
  // 12) 伪装：隐身（cloakT）、出招时暂时现形、被打中解除；常驻减伤
  T.cast('gm_camo'); T.sec(1); out.camo = { cloak: p.cloakT > game.t, shown: !(p.cloakRevT > game.t) }; T.cast('gm_ez8'); T.run(10); out.camo.revealed = p.cloakRevT > game.t;
  T.sec(1); const hurtMob = T.mob(340); p.invul = 0; let blocked2 = 0; for (let i = 0; i < 40 && p.cloakT > game.t; i++) { const hp = p.hp; p.setState('idle'); p.invul = 0; applyHit(hurtMob, p, { dmg: 0.01 }, { proj: true }); if (p.hp === hp) blocked2++; }
  out.camo.broken = !(p.cloakT > game.t); out.camo.missed = blocked2;
  T.clear(); T.reset();
  // 13) 狂风：跟着飞、会打人；再按技能键立即冲向敌人自爆
  m = T.mob(620); hp0 = m.hp; T.cast('gm_gale'); T.run(40); const gl = summonsOf(p, 'mech_gale')[0]; T.sec(4); out.gale = { alive: gl && !gl.gone, dmg: dealt(m, hp0) > 0 };
  p.cool['gm_gale~'] = 0; hp0 = m.hp; T.cast('gm_gale'); T.sec(2); out.gale.dove = gl.gone; out.gale.boom = dealt(m, hp0);
  T.clear(); T.reset();
  // 14) G-磁力弹：没有 G 系列时顺便放出 G-1；磁场把敌人托起，结束时打倒
  m = T.mob(520, 100); hp0 = m.hp; T.cast('gm_magnet'); T.run(40); out.magnet = { g1: T.n('mech_g1'), g1cd: (p.cool.gm_g1 || 0) > 0 }; T.sec(1.5);
  out.magnet.lifted = Math.round(m.z); out.magnet.pulled = !!summonsOf(p, 'mech_magfield').length; T.sec(2.2); out.magnet.dmg = dealt(m, hp0) > 0; out.magnet.st = m.st;
  T.clear(); T.reset();
  // 15) 空投支援：轰炸机投下 12 台银色破坏者，追着敌人自爆
  m = T.mob(560); hp0 = m.hp; const sm0 = window.summon; let nb = 0; window.summon = (o, k, x) => { if (k === 'mech_buster') nb++; return sm0(o, k, x); };
  T.cast('gm_drop'); T.sec(2.6); window.summon = sm0; out.drop = { busters: nb }; T.sec(5); out.drop.dmg = dealt(m, hp0); out.drop.left = T.n('mech_buster');
  T.clear(); T.reset();
  // 16) 拦截机工厂：最多 6 架，工厂到时剩下的冲向敌人自爆；光反应能量模块：一次性光束
  m = T.mob(620); hp0 = m.hp; T.cast('gm_factory'); T.sec(4.5); out.factory = { sparrows: T.n('mech_sparrow'), max6: T.n('mech_sparrow') <= 6 }; T.sec(3.5); out.factory.dmg = dealt(m, hp0); out.factory.left = T.n('mech_sparrow');
  T.clear(); T.reset(); game.skillLv.gm_solar = 1; m = T.mob(800); hp0 = m.hp; T.cast('gm_factory'); T.sec(3); out.solar = { dmg: dealt(m, hp0), sparrows: T.n('mech_sparrow') }; game.skillLv.gm_solar = 0;
  T.clear(); T.reset();
  // 17) G-0 战争领主：没有 G 系列放不出；有 G 系列时锁定、合体、三重轰炸，G 系列消失并重置 G-1 冷却
  out.g0 = { noG: SKILLS.gm_g0.req(p) }; const boss = T.mob(560, 100); boss.boss = true; const add = T.mob(640, 60); hp0 = boss.hp; const hpA = add.hp;
  T.cast('gm_g1'); T.run(30); p.cool.gm_g1 = 20; T.cast('gm_g0'); T.run(2); out.g0.locks = p.act && p.act.locks ? p.act.locks.length : 0; T.sec(1.5);
  out.g0.gs = gsUnits(p).length; out.g0.g1cd = p.cool.gm_g1 || 0; out.g0.mech = T.n('mech_g0'); T.sec(5); out.g0.dmgBoss = dealt(boss, hp0); out.g0.dmgAdd = Math.round(hpA - add.hp); out.g0.gone = T.n('mech_g0') === 0;
  T.clear(); T.reset();
  // 18) 换房间：G 系列跟过去，RX-78 / Ex-S 清掉
  T.cast('gm_g1'); T.run(30); mechRx78(p, 5); T.cast('gm_viper'); T.run(30); game.room = { ...game.room }; T.run(3);
  out.room = { g1: T.n('mech_g1'), rx: T.n('mech_rx78'), viper: T.n('mech_viper') };
  T.clear(); T.reset();
  // 19) 指令：←→+Z = G-1，↓↓+Z = EZ-8，←→+Space = 机械引爆
  const cmd = (dirs, key) => { T.reset(); for (const d of dirs) { T.tap(d); T.run(2); } T.tap(key); T.run(3); const id = p.act && p.act.skill; T.sec(1); return id; };
  out.cmd = { g1: cmd(['left', 'right'], 'cmd'), ez: cmd(['down', 'down'], 'cmd'), det: cmd(['left', 'right'], 'cmdB'), viper: cmd(['right', 'down', 'right'], 'cmd') };
  T.clear(); T.reset();
  // 20) 电能转换：RX-78 改成光属性
  game.skillLv.gm_convert = 1; out.convert = mElem(p, 'fire'); game.skillLv.gm_convert = 0;
  // ---- 第 B 阶段：二觉 / 三觉 ----
  T.clear(); T.reset();
  // 21) HS-12：锁定、飞过去自爆
  m = T.mob(560); hp0 = m.hp; T.cast('gm_hs12'); T.run(20); const hs = summonsOf(p, 'mech_hs12')[0]; T.sec(3); out.hs12 = { spawned: !!hs, gone: hs && hs.gone, dmg: dealt(m, hp0) > 0 };
  T.clear(); T.reset();
  // 22) G-4 雷行者：绕身回旋多段；方向键 + 再按 = 派出，只按 = 召回；到时爆炸
  m = T.mob(370); hp0 = m.hp; T.cast('gm_frisbee'); T.run(30); const fr = summonsOf(p, 'mech_frisbee')[0]; T.sec(1.5); out.frisbee = { spawned: !!fr, dmg: dealt(m, hp0) > 0 };
  T.hold('right'); p.cool['gm_frisbee~'] = 0; T.cast('gm_frisbee'); T.release('right'); out.frisbee.sent = !!(fr.goal && fr.goal.x > p.x + 200); out.frisbee.noAct = !p.act || p.act.skill !== 'gm_frisbee';
  p.cool['gm_frisbee~'] = 0; T.cast('gm_frisbee'); out.frisbee.recalled = !fr.goal; T.sec(6); out.frisbee.gone = fr.gone;
  T.clear(); T.reset();
  // 23) G-X 主宰者：旋雷者 4 台 / 捕食者 7 台、改装无动作（再按分支）、Buff On!、冷却 -15%
  game.skillLv.gm_gop = 1; T.cast('gm_g1'); T.run(30); T.run(40); T.cast('gm_g2'); T.run(2);
  out.gop = { form: gsForm(p), n2: T.n('mech_g2'), noAct: !p.act, buffOn: !!p.buffs.gm_gop };
  p.gsTfT = 0; p.cool['gm_g3~'] = 0; T.cast('gm_g3'); T.run(2); out.gop.n3 = T.n('mech_g3');
  T.cast('gm_viper'); out.gop.cd = +(p.cool.gm_viper || 0).toFixed(2); game.skillLv.gm_gop = 0;
  T.clear(); T.reset();
  // 24) G-超级猎鹰：3 次充能；科罗纳形态大范围爆炸 / 旋雷者形态 3 道激光 / 捕食者形态 25 段
  m = T.mob(500); hp0 = m.hp; out.falcon = { charges: SKILLS.gm_falcon.charges }; T.cast('gm_falcon'); T.sec(0.9); out.falcon.co = dealt(m, hp0);
  T.cast('gm_g1'); T.run(30); p.gsTfT = 0; T.cast('gm_g2'); T.run(30); hp0 = m.hp; T.cast('gm_falcon'); T.sec(0.6); out.falcon.rt = dealt(m, hp0);
  p.gsTfT = 0; p.cool.gm_g3 = 0; T.cast('gm_g3'); T.run(30); hp0 = m.hp; T.cast('gm_falcon'); T.sec(2.6); out.falcon.rp = dealt(m, hp0);
  T.clear(); T.reset();
  // 25) 高压电磁场：飞 220 px 后展开，15 段
  m = T.mob(520); hp0 = m.hp; let nf = 0; const sh0 = window.summonHit; window.summonHit = (s, t, h, o) => { if (s.skey === 'mech_emfield' && t === m) nf++; return sh0(s, t, h, o); };
  T.cast('gm_field'); T.sec(2.8); window.summonHit = sh0; out.field = { hits: nf, dmg: dealt(m, hp0) > 0 };
  T.clear(); T.reset();
  // 26) 二觉 博尔特 MX：天降、回旋炮 → 步枪 → 激光剑 → 自爆
  m = T.mob(520); m.boss = true; hp0 = m.hp; T.cast('gm_bolt'); T.sec(1.2); const bolt = summonsOf(p, 'mech_bolt')[0]; T.sec(6.5);
  out.bolt = { spawned: !!bolt, gone: bolt && bolt.gone, dmg: dealt(m, hp0), rifle: bolt && bolt.nR, blade: bolt && bolt.nB };
  T.clear(); T.reset();
  // 27) 微型制导：技能攻击力；超时空光耀加农炮：能量弹 + 4 次大爆炸
  game.skillLv.gm_micro = 1; T.run(20); out.micro = +(((p.buffs.gm_micro || {}).dmg) || 0).toFixed(2); game.skillLv.gm_micro = 0;
  m = T.mob(500); hp0 = m.hp; T.cast('gm_hyper'); T.sec(2.2); out.hyper = { dmg: dealt(m, hp0) > 0, sa: true };
  T.clear(); T.reset();
  // 28) 三觉 星尘天穹：要 G 系列；G-0 冷却中不能用；用了 G-0 进冷却、G-1 冷却重置
  out.sd = { noG: SKILLS.gm_stardust.req(p) }; T.cast('gm_g1'); T.run(30); p.cool.gm_g0 = 10; out.sd.g0cd = SKILLS.gm_stardust.req(p); p.cool.gm_g0 = 0; p.cool.gm_g1 = 20;
  m = T.mob(560); hp0 = m.hp; T.cast('gm_stardust'); T.sec(1.5); out.sd.g0 = Math.round(p.cool.gm_g0 || 0); out.sd.g1 = p.cool.gm_g1 || 0; out.sd.gs = gsUnits(p).length; T.sec(3.5); out.sd.dmg = dealt(m, hp0) > 0;
  T.clear(); T.reset();
  // 29) 转职任务线：quests/job.js 按 J.quests 登记，选了机械师才开放
  out.quest = { q1: !!QUESTS.q_jl_mechanic_1, q3: !!QUESTS.q_jl_mechanic_3, pre: QUESTS.q_jl_mechanic_1 && QUESTS.q_jl_mechanic_1.pre.join(), items: QUESTS.q_jl_mechanic_2 && QUESTS.q_jl_mechanic_2.goals.map(g => g.key + ':' + g.n).join() };
  return out;
});
const o = R;
report('转职登记：机械师存在、技能齐、魔法伤害职业（魔攻不再打 55 折）', o.reg.job && o.reg.skills && o.reg.dmgType === 'mag' && o.reg.matkUp > 1.3 && o.reg.quests === 3 && o.reg.awaken === 'gm_g0', o.reg);
report('RX-78：召唤框架、不可被攻击、追着敌人跑并自爆', o.rx.summoned && o.rx.invul && o.rx.moved > 30 && o.rx.gone && o.rx.dmg > 0, o.rx);
report('EZ-8：3 秒引信后爆炸；按住技能键延长引信', o.ez.life >= 3 && o.ez.life < 3.1 && o.ez.before === 0 && o.ez.after > 0 && o.ez.gone && o.ez.heldLife > 3.8, o.ez);
report('机械引爆（点按）：范围内的 RX-78 / EZ-8 就地爆炸，范围外的不炸', o.detTap.nearRx && o.detTap.nearEz && !o.detTap.farRx, o.detTap);
report('机械引爆（按住）：准星可移动，松开后 RX-78 冲过去、EZ-8 跳过去爆炸', o.detHold.aim1 && o.detHold.aim1.x > o.detHold.aim0 + 60 && o.detHold.rushing && o.detHold.leaping && o.detHold.rxGone && o.detHold.ezGone && o.detHold.dmg > 0, o.detHold);
report('G-1：身后浮空炮台、自动射击命中；再按技能键补射', o.g1.n === 1 && o.g1.behind > 20 && o.g1.dmg > 0 && o.g1.rapid.pressed >= 3, o.g1);
report('改装：G-2 三台，持续 +10 秒不超过 20 秒；改装冷却 5 秒挡住 G-3', o.tf.form === 'g2' && o.tf.n === 3 && o.tf.left1 > o.tf.left0 && o.tf.left1 <= 20 && o.tf.blockedMsg === '改装冷却中', o.tf);
report('G-2：充满电后再按发射 3 道电磁波，电量清零', o.g2.waves === 3 && o.g2.dmg > 0 && o.g2.chgAfter < 1, o.g2);
report('G-3：6 台；再按缠到敌人身上持续电击（同一个敌人最多 2 台），再按召回', o.g3.n === 6 && o.g3.form === 'g3' && o.g3.on && o.g3.stuck === 2 && o.g3.dmg > 0 && o.g3.recalled, o.g3);
report('G-1 键在其他形态下 = 改装回 G-1', o.back === 'g1', o.back);
report('G 系扩张：改装冷却 0，叠层最多 5', o.gext.stacks === 5 && o.gext.tfReady, o.gext);
report('Ex-S：最多 9 台（第 10 台挤掉最早的），会打人，6 秒后自爆', o.viper.n === 9 && o.viper.firstGone && o.viper.dmg && o.viper.after === 0, o.viper);
report('机械指令：停火（RX-78 不动、科罗纳不打），再放一次恢复', o.hold.on && o.hold.rxStill && o.hold.noDmg && o.hold.off && o.hold.dmgAfter, o.hold);
report('机械改良：开关 BUFF、机器人移速提高、耗 MP、再放关闭', o.robotics.on && o.robotics.spd > 1.5 && o.robotics.off && o.robotics.mpOut, o.robotics);
report('危机追击者：被打时放出 RX-78，有冷却', o.backup.first === 1 && o.backup.cd, o.backup);
report('伪装：隐身、出招暂时现形、被打中解除', o.camo.cloak && o.camo.shown && o.camo.revealed && o.camo.broken, o.camo);
report('狂风：跟着打；再按技能键冲向敌人自爆', o.gale.alive && o.gale.dmg && o.gale.dove && o.gale.boom > 0, o.gale);
report('G-磁力弹：顺便放出 G-1（进冷却），把敌人托起，结束时打倒', o.magnet.g1 === 1 && o.magnet.g1cd && o.magnet.lifted > 20 && o.magnet.dmg, o.magnet);
report('空投支援：投下 12 台银色破坏者，追着敌人自爆', o.drop.busters === 12 && o.drop.dmg > 0 && o.drop.left === 0, o.drop);
report('拦截机工厂：最多 6 架，到时冲向敌人自爆', o.factory.sparrows >= 4 && o.factory.max6 && o.factory.dmg > 0 && o.factory.left === 0, o.factory);
report('光反应能量模块：一次性光束打到远处的敌人', o.solar.dmg > 0 && o.solar.sparrows === 0, o.solar);
report('G-0 战争领主：要有 G 系列；锁定、合体轰炸，G 系列消失、G-1 冷却重置', typeof o.g0.noG === 'string' && o.g0.locks === 2 && o.g0.gs === 0 && o.g0.g1cd === 0 && o.g0.mech === 1 && o.g0.dmgBoss > 0 && o.g0.dmgAdd > 0 && o.g0.gone, o.g0);
report('换房间：G 系列跟过去，RX-78 / Ex-S 清掉', o.room.g1 === 1 && o.room.rx === 0 && o.room.viper === 0, o.room);
report('指令：←→+Z G-1、↓↓+Z EZ-8、←→+Space 机械引爆、→↓→+Z Ex-S', o.cmd.g1 === 'gm_g1' && o.cmd.ez === 'gm_ez8' && o.cmd.det === 'gm_detonate' && o.cmd.viper === 'gm_viper', o.cmd);
report('电能转换：RX-78 改成光属性', o.convert === 'light', o.convert);
report('HS-12：锁定后飞过去自爆', o.hs12.spawned && o.hs12.gone && o.hs12.dmg, o.hs12);
report('G-4 雷行者：回旋多段、方向键派出（不打断动作）、召回、到时爆炸', o.frisbee.spawned && o.frisbee.dmg && o.frisbee.sent && o.frisbee.noAct && o.frisbee.recalled && o.frisbee.gone, o.frisbee);
report('G-X 主宰者：旋雷者 4 / 捕食者 7、改装无动作、Buff On!、冷却 -15%', o.gop.form === 'g2' && o.gop.n2 === 4 && o.gop.noAct && o.gop.buffOn && o.gop.n3 === 7 && Math.abs(o.gop.cd - 3.5 * 0.85) < 0.05, o.gop);
report('G-超级猎鹰：3 次充能；三种形态各自的攻击都打到', o.falcon.charges === 3 && o.falcon.co > 0 && o.falcon.rt > 0 && o.falcon.rp > 0, o.falcon);
report('高压电磁场：15 段', o.field.hits === 15 && o.field.dmg, o.field);
report('二觉 博尔特 MX：步枪 4 发、激光剑 3 次、自爆', o.bolt.spawned && o.bolt.gone && o.bolt.dmg > 0 && o.bolt.rifle === 4 && o.bolt.blade === 3, o.bolt);
report('微型制导 / 超时空光耀加农炮', o.micro >= 0.2 && o.hyper.dmg, { micro: o.micro, hyper: o.hyper });
report('三觉 星尘天穹：要 G 系列、G-0 冷却中不能用、用后 G-0 冷却 / G-1 重置', typeof o.sd.noG === 'string' && typeof o.sd.g0cd === 'string' && o.sd.g0 > 100 && o.sd.g1 === 0 && o.sd.gs === 0 && o.sd.dmg, o.sd);
report('转职任务线：3 步，接在职业试炼之后，60 白色小晶块 + 2 火种', o.quest.q1 && o.quest.q3 && o.quest.pre === 'q_job_gun_final' && o.quest.items === 'c_white:60,q_magic_tinder:2', o.quest);
// 机器人精灵在游戏里的样子（一张截图，看比例和悬浮高度）：test/shots/mechanic_robots.png
const art = await page.evaluate(async () => {
  const p = game.player; T.clear(); T.reset(); p.x = 260; mechArtLoad(); if (typeof loadBundles === 'function') await loadBundles(MECH_ART.map(k => 'spr:mech_' + k));
  T.mob(900, 60); T.cast('gm_g1'); T.run(40); mechRx78(p, 5, { x: 340, y: 130 }); summon(p, 'mech_ez8', { lv: 5, x: 400, y: 70, life: 99 }); T.cast('gm_viper'); T.run(30);
  summon(p, 'mech_gale', { lv: 5, x: 380, y: 100 }); const f = summon(p, 'mech_factory', { lv: 5, x: 540, y: 60 }); if (f) f.life = 99; summon(p, 'mech_sparrow', { lv: 5, x: 600, y: 120 });
  p.mechHold = true; T.run(20); game.paused = false; return MECH_ART.filter(k => IMG[`spr/mech_${k}/idle`]).length;
});
await page.waitForTimeout(400); await page.screenshot({ path: 'test/shots/mechanic_robots.png' });
report('机器人精灵都加载了', art >= 11, art);
const errs = logs.filter(l => l.type === 'pageerror' || l.type === 'error');
report('没有页面错误', errs.length === 0, errs.slice(0, 5));
await browser.close();
console.log(fail ? `✗ ${fail} 项失败` : '全部通过');
process.exit(fail ? 1 : 0);
