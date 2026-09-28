// 神枪手（女）转职的官方对齐测试（docs/SKILLS_OFFICIAL_gun.md 第 4、5 节）：暂停游戏循环、逐帧推进
// 漫游枪手：双枪极舞刃 4 个派生（C C / 空中 Z / 滑铲 Z / 上旋踢 Z）、上旋踢中 X = 音速劫击、花式枪术（柔化次数、免费衔接）、心灵反击（被击时 Z）、
//   锁链截击 3 段、双鹰回旋接枪再掷、移动射击弹数、隐匿切割、觉醒阶段门槛；
// 枪炮师：重火器奥义 +1 级、重火器精通（MP、叠层）、重火器拔击、蓄电激光炮、FM-92 分裂、反坦克炮 3 爆、PT-15 三种形态、二觉 / 三觉；二觉 / 三觉任务。node test/gunner_jobs.mjs
import { launch, URL_BASE } from './lib.mjs';
let fail = 0;
const report = (name, ok, info) => { if (!ok) fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${JSON.stringify(info)}`); };
const { browser, page, logs } = await launch({ width: 960, height: 540 });
await page.goto(`${URL_BASE}?test&cls=gun&mobs=0&mute`); await page.waitForFunction(() => window.__READY, null, { timeout: 30000 });
await page.evaluate(() => {
  game.paused = true;
  window.T = {
    run(n) { for (let i = 0; i < n; i++) step(1 / 60); },
    tap(a) { input.virt[a] = 2; T.run(1); delete input.virt[a]; },
    press(a) { input.virt[a] = 2; }, hold(a) { input.virt[a] = 1; }, release(a) { delete input.virt[a]; },
    clear() { for (const e of ents) if (e !== game.player) e.remove = true; T.run(1); projs.length = 0; },
    reset(p = game.player) { for (const k in input.virt) delete input.virt[k]; input.buf.length = 0; input.dirHist.length = 0;
      Object.assign(p, { x: 300, y: 100, z: 0, vx: 0, vy: 0, vz: 0, face: 1, act: null, invul: 0, superArmor: 0, hitstop: 0, dead: false, cool: {}, buffs: {}, charges: {}, bsCd: 0, reboundCd: 0, techHold: false, stun: 0, _sty: null, _hawk: null });
      p.hp = p.hpMax; p.mp = p.mpMax = 99999; p.setState('idle'); resetCmb(p); T.run(2); },
    mob(x = 400, y = 100) { const m = spawnMonster('goblin', x, y); m.control = null; m.invul = 0; m.z = 0; m.vz = 0; m.hp = m.hpMax = 1e9; m.setState('idle'); return m; },
    job(j) { game.job = j; const L = game.skillLv; for (const id of classSkills('gun', j)) if (SKILLS[id]) L[id] = SKILLS[id].maxLv > 1 ? 5 : 1; onJobChange(game.player, j); },
    act() { const p = game.player; return p.act && (p.act.skill || p.act.name) || null; },
  };
});
const R = await page.evaluate(() => {
  const out = {}, p = game.player; T.clear(); T.job('ranger');
  // 1) 双枪极舞刃：转职自动学会；C C = 飞燕射击；空中 Z = 俯冲斩
  out.auto = game.skillLv.g_blade;
  T.reset(); T.tap('jump'); T.run(4); T.tap('jump'); T.run(1); out.flip = p.act && p.act.name; T.run(90);
  T.reset(); T.tap('jump'); T.run(14); T.tap('cmd'); T.run(1); out.dive = p.act && p.act.name; T.run(90);
  // 滑铲中 Z = 起身斩，再按 Z = 挑飞；上旋踢中 Z = 翻腾攻击、X = 音速劫击
  T.reset(); p.doAct(p.acts.dash); T.run(8); T.tap('cmd'); T.run(1); const r1 = p.act && p.act.name; T.run(12); T.tap('cmd'); T.run(1); out.rush = [r1, p.act && p.act.name]; T.run(60);
  T.reset(); castSkill(p, 'g_spin'); T.run(10); T.tap('cmd'); T.run(1); out.spinZ = T.act(); T.run(60);
  T.reset(); castSkill(p, 'g_spin'); T.run(10); T.tap('attack'); T.run(1); out.spinX = T.act(); T.run(60);
  // 2) 花式枪术：技能 → 技能 可以柔化（扣次数）；次数用完不行；刺踢 → 上旋踢 免费
  T.reset(); const s0 = stylishOf(p).n; castSkill(p, 'g_head'); T.run(8); game.skillBar[0] = 'g_launch'; T.tap('s0'); T.run(1); out.soft1 = { act: T.act(), before: s0, after: stylishOf(p).n };
  p._sty.n = 0; p._sty.last = game.t; p.cool = {}; castSkill(p, 'g_head'); T.run(8); T.tap('s0'); T.run(1); out.softEmpty = T.act(); T.run(60);
  T.reset(); p._sty = { n: 0, last: game.t }; castSkill(p, 'g_flash'); T.run(10); game.skillBar[1] = 'g_spin'; T.tap('s1'); T.run(1); out.softFree = T.act(); T.run(60);
  // 3) 心灵反击：被打中后 1 秒内按 Z
  T.reset(); const g = T.mob(360, 100); g.face = -1; applyHit(g, p, { dmg: 0.1, stun: 0.5, sure: true }, {}); T.run(2); T.tap('cmd'); T.run(6); out.revenge = T.act(); T.run(60);   // 按键先缓冲，受击的顿帧（hitstop）过了才放出来
  T.reset(); T.tap('cmd'); T.run(1); out.plainZ = T.act(); T.run(60); T.clear();
  // 4) 锁链截击 3 段（再按技能键追加）
  T.reset(); game.skillBar[2] = 'g_chain'; castSkill(p, 'g_chain', false, 's2'); const st = []; for (let i = 0; i < 3; i++) { T.run(26); st.push(p.act && p.act.name); T.tap('s2'); T.run(1); st.push(p.act && p.act.name); } out.chain = st; T.run(60);
  // 5) 双鹰回旋：枪飞回来接住后可以再掷，最多 3 掷
  T.reset(); game.skillBar[3] = 'g_hawk'; const hw = []; castSkill(p, 'g_hawk', false, 's3'); hw.push(p.act && p.act.name);
  for (let i = 0; i < 3; i++) { for (let k = 0; k < 120 && !p._hawk; k++) T.run(1); T.run(20); T.tap('s3'); T.run(1); hw.push(p.act && p.act.name); } out.hawk = hw; T.run(120); projs.length = 0;
  // 6) 移动射击：弹数用完就结束（左轮 30 发）
  T.reset(); window.__n = 0; const fb = fireBullet; window.fireBullet = (e, o) => { window.__n++; return fb(e, o); };
  castSkill(p, 'g_moving'); T.press('attack'); let k = 0; while (p.act && p.act.name === 'g_moving' && k++ < 800) T.run(1); T.release('attack'); window.fireBullet = fb; out.moving = { shots: window.__n, frames: k }; T.run(30);
  // 7) 隐匿切割：体术命中追加一次切割 + 出血
  T.reset(); const m = T.mob(340, 100); const hp0 = m.hp; castSkill(p, 'g_flash'); T.run(20); out.hidecut = { hits: hp0 - m.hp > 0, bleed: !!(m.status && m.status.bleed) }; T.clear();
  // 二觉 / 三觉：放得出来；锁链花园、飞散枪刃这些代码画的特效边推进边画一遍（不报错）
  const awk = id => { T.reset(); for (let i = 0; i < 4; i++) T.mob(420 + i * 50, 80 + i * 20); castSkill(p, id); const a = T.act(); game.timeStop = 0;
    for (let i = 0; i < 290; i++) { T.run(1); if (i % 6 === 0) { renderWorld(); ui.draw(); } } T.clear(); return a; };
  out.rAwk = [awk('g_awaken2'), awk('g_awaken3')];
  // 8) 觉醒阶段：没完成二觉任务时，二觉技能不能学、不能放
  const f = save.data.flags; f.awaken2 = false; T.reset(); const lv2 = game.skillLv.g_awaken2, L0 = game.lvl; game.skillLv.g_awaken2 = 0; game.lvl = 30; const learn = skillUpBlock('g_awaken2'); game.skillLv.g_awaken2 = lv2; game.lvl = L0;
  out.tier2Blocked = { learn, cast: (castSkill(p, 'g_awaken2'), T.act()) }; f.awaken2 = true; T.run(30);
  // ---- 枪炮师 ----
  T.job('launcher'); T.reset();
  out.hwlore = { lv: game.skillLv.gl_laser, eff: skillLvOf(p, 'gl_laser'), base: skillLvOf(p, 'g_knee') };
  const mp0 = p.mp; castSkill(p, 'gl_laser'); out.hwMp = { cost: mp0 - p.mp, mp: SKILLS.gl_laser.mp }; out.stack1 = p.buffs.gl_hwstack && p.buffs.gl_hwstack.n; T.run(50);
  p.cool = {}; castSkill(p, 'gl_cannon'); out.stack2 = p.buffs.gl_hwstack && p.buffs.gl_hwstack.n; T.run(80);
  // 重火器拔击：起手判定
  T.reset(); const d = T.mob(350, 100); const dh = d.hp; castSkill(p, 'gl_fm31'); T.run(4); out.draw = dh - d.hp > 0; T.clear();
  // 蓄电激光炮：按住攻击键充电，伤害更高、有后坐
  const laser = charge => { T.reset(); const t = T.mob(600, 100); t.def = 0; const h0 = t.hp, x0 = p.x; p.crit = 0; if (charge) T.hold('attack'); castSkill(p, 'gl_laser'); T.run(charge ? 30 : 12); T.release('attack'); T.run(40); const r = { dmg: h0 - t.hp, moved: Math.round(x0 - p.x) }; T.clear(); return r; };
  out.laser = { plain: laser(false), charged: laser(true) };
  // FM-92：空中分裂成 10 个爆弹
  T.reset(); const pr0 = projs.length; castSkill(p, 'gl_fm92'); T.run(24); out.fm92 = projs.length - pr0; T.run(120); projs.length = 0;   // 分裂后 0.35~0.6 秒内落地，要在落地前数
  // PT-15：按住 ↑ 前后两发、按住 ↓ 对地
  const pt = dir => { T.reset(); p.cool = {}; if (dir) T.hold(dir); const n0 = projs.length; castSkill(p, 'gl_pt15'); T.run(16); if (dir) T.release(dir); const n = projs.length - n0; const c = p.act && p.act.clip; T.run(120); projs.length = 0; return [n, c]; };
  out.pt15 = { fwd: pt(null), both: pt('up'), down: pt('down') };
  // 二觉 / 三觉
  T.reset(); castSkill(p, 'gl_awaken2'); out.awk2 = T.act(); game.timeStop = 0; T.run(300);
  T.reset(); castSkill(p, 'gl_awaken3'); out.awk3 = T.act(); game.timeStop = 0; T.run(320);
  // 二觉 / 三觉任务
  out.quests = ['sword', 'gun', 'mage'].map(c => [`q_awaken2_${c}_2`, `q_awaken3_${c}_2`].map(id => QUESTS[id] ? QUESTS[id].lvl : null));
  return out;
});
report('双枪极舞刃：转职自动学会；C C 飞燕射击；空中 Z 俯冲斩', R.auto === 1 && R.flip === 'g_bl_flip' && R.dive === 'g_bl_dive', { auto: R.auto, flip: R.flip, dive: R.dive });
report('滑铲中 Z 起身斩 → 再按 Z 挑飞；上旋踢中 Z 翻腾攻击、X 音速劫击', R.rush[0] === 'g_bl_rush' && R.rush[1] === 'g_bl_rush2' && R.spinZ === 'g_bl_up' && R.spinX === 'g_sonic', { rush: R.rush, spinZ: R.spinZ, spinX: R.spinX });
report('花式枪术：柔化扣 1 次；次数用完不能柔化；刺踢 → 上旋踢免费', R.soft1.act === 'g_launch' && R.soft1.after === R.soft1.before - 1 && R.softEmpty === 'g_head' && R.softFree === 'g_spin', { soft1: R.soft1, empty: R.softEmpty, free: R.softFree });
report('心灵反击：被打中后按 Z；平时按 Z 是后撩踢', R.revenge === 'g_revenge' && R.plainZ === 'g_knee', { revenge: R.revenge, plainZ: R.plainZ });
report('锁链截击：3 段（聚 / 推 / 拉）', R.chain[1] === 'g_chain2' && R.chain[3] === 'g_chain3', R.chain);
report('双鹰回旋：接枪后再掷，最多 3 掷', R.hawk[0] === 'g_hawk1' && R.hawk[1] === 'g_hawk2' && R.hawk[2] === 'g_hawk3' && R.hawk[3] !== 'g_hawk4', R.hawk);
report('移动射击：左轮 30 发打完就结束', R.moving.shots === 30 && R.moving.frames < 800, R.moving);
report('隐匿切割：体术命中追加切割 + 出血', R.hidecut.hits && R.hidecut.bleed, R.hidecut);
report('漫游二觉 / 三觉能放（锁链花园特效画一遍）', R.rAwk[0] === 'g_awaken2' && R.rAwk[1] === 'g_awaken3', R.rAwk);
report('觉醒阶段：没完成二觉任务不能学、不能放二觉技能', /二次觉醒/.test(R.tier2Blocked.learn || '') && R.tier2Blocked.cast !== 'g_awaken2', R.tier2Blocked);
report('重火器奥义：重火器技能 +1 级（非重火器不加）', R.hwlore.eff === R.hwlore.lv + 1 && R.hwlore.base === 5, R.hwlore);
report('重火器精通：MP 减少、连续使用叠层', R.hwMp.cost < R.hwMp.mp && R.stack1 === 1 && R.stack2 === 2, { mp: R.hwMp, s1: R.stack1, s2: R.stack2 });
report('重火器拔击：起手有判定', R.draw, {});
report('蓄电激光炮：充电伤害更高、有后坐', R.laser.charged.dmg > R.laser.plain.dmg * 1.3 && R.laser.charged.moved > 20, R.laser);
report('FM-92 mk2：分裂成 10 个爆弹', R.fm92 >= 10, { projs: R.fm92 });
report('PT-15：前方 1 发 / 按住 ↑ 前后 2 发 / 按住 ↓ 对地', R.pt15.fwd[0] === 1 && R.pt15.both[0] === 2 && R.pt15.down[1] === 'ptDown', R.pt15);
report('枪炮师二觉 / 三觉能放', R.awk2 === 'gl_awaken2' && R.awk3 === 'gl_awaken3', { awk2: R.awk2, awk3: R.awk3 });
report('二觉（26 级）/ 三觉（30 级）任务，三个职业都有', R.quests.every(q => q[0] === 26 && q[1] === 30), R.quests);
const errs = logs.filter(l => l.type !== 'warning'); report('无报错', errs.length === 0, errs.slice(0, 3));
await browser.close();
console.log(fail ? `${fail} 项失败` : '全部通过');
process.exit(fail ? 1 : 0);
