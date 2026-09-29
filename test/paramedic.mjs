// 协战师（神枪手第 5 转职，辅助；docs/SKILLS_OFFICIAL_gun.md 第 8 节）：暂停游戏循环、逐帧推进，逐条验证
// 单机：只能学 5 个基础技能、强袭战斗服变身 + [SCQC] 普攻、战场信息（收集 / 上限 3 层 / 消耗）、无动作 BUFF（技能中施放不打断）、
//       保护罩（吸伤、叠加上限）、强化保护罩（减伤 + 霸体）、单人专属加成（独立 +32%、冷却 −20%、耗层激光轰炸）、全部技能能放、回城变回来、
//       神兵天降预输入一觉合并威力
// 联机（2 人组队刷图）：协战师的 BUFF / 保护罩 / 净化同步到队友（队友在别的房间也生效），队友的影子也穿战斗服
//   node test/paramedic.mjs          只跑单机部分：node test/paramedic.mjs solo
import { launch, URL_BASE } from './lib.mjs';
let fail = 0;
const report = (name, ok, info) => { if (!ok) fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${JSON.stringify(info)}`); };
const onlySolo = process.argv[2] === 'solo';

/* ================= 单机 ================= */
{
  const { browser, page, logs } = await launch({ width: 960, height: 540 });
  await page.goto(`${URL_BASE}?rawcd&test&cls=gun&mobs=0&mute`); await page.waitForFunction(() => window.__READY, null, { timeout: 30000 });
  await page.evaluate(() => new Promise(res => loadBundles(['spr:pmsuit']).then(res)));
  await page.evaluate(() => {
    game.paused = true;
    window.T = {
      run(n) { for (let i = 0; i < n; i++) step(1 / 60); },
      tap(a) { input.virt[a] = 2; T.run(1); delete input.virt[a]; },
      press(a) { input.virt[a] = 2; }, release(a) { delete input.virt[a]; },
      clear() { for (const e of ents) if (e !== game.player) e.remove = true; T.run(1); projs.length = 0; },
      reset(p = game.player) { for (const k in input.virt) delete input.virt[k]; input.buf.length = 0; input.dirHist.length = 0;
        Object.assign(p, { x: 300, y: 100, z: 0, vx: 0, vy: 0, vz: 0, face: 1, act: null, invul: 0, superArmor: 0, hitstop: 0, dead: false, cool: {}, buffs: {}, charges: {}, bsCd: 0, reboundCd: 0, stun: 0, pmInfo: 0 });
        p.hp = p.hpMax; p.mp = p.mpMax; p.setState('idle'); resetCmb(p); T.run(2); },
      mob(x = 400, y = 100, kind = 'goblin') { const m = spawnMonster(kind, x, y); m.control = null; m.invul = 0; m.z = 0; m.vz = 0; m.hp = m.hpMax = 1e9; m.setState('idle'); return m; },
    };
    game.job = 'paramedic'; save.data.job = 'paramedic'; game.lvl = 30; recalcStats(game.player); onJobChange(game.player, 'paramedic');
    const L = game.skillLv; for (const k in L) delete L[k];
    for (const id of classSkills('gun', 'paramedic')) if (SKILLS[id]) L[id] = SKILLS[id].awaken ? 1 : SKILLS[id].passive ? 1 : 5;
    game.skillBar = ['pm_lockshot', 'pm_assault', 'pm_strike', 'pm_evade', 'pm_mark', 'pm_raid', 'pm_bash', 'pm_ray', 'pm_arms', 'pm_armor', 'pm_mobility', 'pm_buffer', 'pm_awk1', 'g_knee'];
    Object.assign(save.data.flags ??= {}, { awaken: true, awaken2: false, awaken3: false });
  });
  const R = await page.evaluate(() => {
    const out = {}, p = game.player; T.clear(); T.reset(); T.run(20);
    // 1) 基础技能：只能学 5 个
    const base = CLASSES.gun.skills.filter(id => SKILLS[id] && SKILLS[id].cls === 'gun' && !SKILLS[id].job);
    out.base = { allowed: base.filter(id => skillAllowed(id, 'paramedic')).sort(), ranger: base.filter(id => skillAllowed(id, 'ranger')).length, total: base.length,
      jobList: classSkills('gun', 'paramedic').filter(id => SKILLS[id].job === 'paramedic').length, gatlingCast: (T.reset(), game.skillLv.g_gatling = 5, castSkill(p, 'g_gatling'), p.act && p.act.skill) || null };
    delete game.skillLv.g_gatling; T.run(30);
    // 2) 变身：测试场里穿战斗服（模型换成 pmsuit 帧集、没有外观层 = 不显示时装），普攻换成 [SCQC]
    T.reset(); T.run(20);
    out.suit = { on: !!p._pmSuit, key: p.model && p.model.key, av: !!p.model && (p.model.av === null || (!p.model.av.S2 && !p.model.av.parts && !p.model.av.acc.length)), acts: p.acts === PM_ACTS, sys: ['pm_suit', 'pm_sync', 'pm_info'].every(id => game.skillLv[id] > 0) };
    // 3) [SCQC] 普攻：按住 X 连出 4 段（横斩 → 上撩 → 回旋踢 → 贴身射击），命中收集信息（每段 +5%）
    T.clear(); T.reset(); const m = T.mob(350, 100); const hp0 = m.hp; p.pmInfo = 0; T.press('attack'); const names = [];
    for (let i = 0; i < 160; i++) { T.run(1); if (p.act && p.act.basic && names[names.length - 1] !== p.act.name) names.push(p.act.name); if (names.length >= 4 && !p.act) break; }
    T.release('attack'); T.run(30);
    out.combo = { names, hit: m.hp < hp0, info: Math.round(p.pmInfo), type: PM_ACTS.atk1.type, airMax: airMaxOf(p) };
    // 4) 技能命中收集信息（一次施放算一次）；上限 300% = 3 层
    T.reset(); p.pmInfo = 0; m.x = 360; m.y = 100; castSkill(p, 'pm_bash'); T.run(50); out.skillInfo = Math.round(p.pmInfo); p.pmInfo = 290; pmGain(p, 50); out.cap = { info: p.pmInfo, stacks: pmStacks(p) }; T.run(40);
    // 5) 无动作施放：技能动作中放 BUFF，不打断当前动作；空中也能放；军械强化 / 装甲强化给自己（单机）
    T.reset(); castSkill(p, 'pm_raid'); T.run(10); const act0 = p.act; const okArms = castSkill(p, 'pm_arms'); T.run(1); const hpMax0 = p.hpMax; const okArmor = castSkill(p, 'pm_armor'); T.run(1);
    out.instant = { same: p.act === act0 && !!act0 && act0.skill === 'pm_raid', okArms, okArmor, arms: !!p.buffs.pm_arms, armsT: p.buffs.pm_arms && Math.round(p.buffs.pm_arms.t), armor: !!p.buffs.pm_armor };
    T.run(90); out.instant.hpUp = Math.abs(p.hpMax / hpMax0 - (1 + p.buffs.pm_armor.hpPct)) < 0.01; out.instant.hpMax = [Math.round(hpMax0), Math.round(p.hpMax)];
    T.reset(); p.vz = p.jumpV; p.z = 5; p.setState('jump'); T.run(3); p.cool.pm_arms = 0; out.instant.air = castSkill(p, 'pm_arms') && p.st === 'jump'; T.run(60);
    // 通过按键施放（技能栏第 9 格 = 军械强化）：技能动作中按下去，技能不中断
    T.reset(); p.cool.pm_arms = 0; castSkill(p, 'pm_ray'); T.run(15); delete p.buffs.pm_arms; T.tap('s8'); T.run(1); out.instant.key = { act: p.act && p.act.skill, arms: !!p.buffs.pm_arms }; T.run(100);
    // 6) 战场信息不足时，机动强化放不出来；有 1 层：消耗、全队三速 +；单人时呼叫激光轰炸（打到敌人）
    T.clear(); T.reset(); const m3 = T.mob(420, 100); const hp1 = m3.hp; p.pmInfo = 50; out.noStack = castSkill(p, 'pm_mobility') && !!p.buffs.pm_mobility;
    p.pmInfo = 130; castSkill(p, 'pm_mobility'); out.mobility = { buff: !!p.buffs.pm_mobility, aspd: p.buffs.pm_mobility && p.buffs.pm_mobility.aspd, info: Math.round(p.pmInfo) };
    T.run(90); out.laser = { hit: m3.hp < hp1, dmg: Math.round(hp1 - m3.hp) };
    // 7) 单人专属加成：独立攻击 +32%（atk 对独立攻击生效）、冷却 −20%
    T.run(20); out.solo = { solo: soloPlay(), atk: p.buffs.pm_info && p.buffs.pm_info.atk, n: p.buffs.pm_info && p.buffs.pm_info.n, cdMul: +(p.cdMul || 1).toFixed(3) };
    T.reset(); p.cool = {}; castSkill(p, 'pm_lockshot'); out.solo.lockCd = +(p.cool.pm_lockshot || 0).toFixed(2); T.run(40);
    // 8) 保护罩（缓冲）：吸收伤害（HP 不掉），叠加总量不超过最大 HP 的 60%
    T.reset(); p.pmInfo = 300; castSkill(p, 'pm_buffer'); const ab1 = absorbOf(p); p.cool.pm_buffer = 0; castSkill(p, 'pm_buffer'); p.cool.pm_buffer = 0; p.pmInfo = 300; for (let i = 0; i < 8; i++) { p.cool.pm_buffer = 0; p.pmInfo = 300; castSkill(p, 'pm_buffer'); }
    const abMax = absorbOf(p), hpB = p.hp; const mob2 = T.mob(330, 100); mob2.atk = 200;
    applyHit(mob2, p, { dmg: 1, stun: 0.1, sure: true }); const afterHit = { hp: p.hp, ab: absorbOf(p) };
    out.shield = { one: Math.round(ab1 / p.hpMax * 100), cap: Math.round(abMax / p.hpMax * 100), hpSame: afterHit.hp >= hpB - 1, absorbed: Math.round(abMax - afterHit.ab) };
    T.run(30);
    // 9) 强化保护罩（强袭目标 / 护盾冲击）：受到的伤害 −20%、霸体
    T.reset(); castSkill(p, 'pm_assault'); T.run(60); out.red = { buff: !!p.buffs.pm_red, taken: p.buffs.pm_red && p.buffs.pm_red.taken, sa: p.superArmor > 0, shield: absorbOf(p) > 0 };
    // 10) 二觉 / 三觉：没完成对应觉醒任务放不出来（tier）；完成后全部技能都能放、不报错（BUFF 的层数先给满）
    T.clear(); T.reset(); out.tierLocked = { awk2: castSkill(p, 'pm_awk2') && !!p.act && p.act.skill === 'pm_awk2', awk3: castSkill(p, 'pm_awk3') && !!p.act && p.act.skill === 'pm_awk3' };
    Object.assign(save.data.flags, { awaken2: true, awaken3: true }); T.run(10);
    const casted = {}; for (const id of classSkills('gun', 'paramedic')) { const S = SKILLS[id]; if (!S || S.passive) continue; T.clear(); T.reset(); T.mob(380, 100); T.mob(460, 110); p.pmInfo = 300; p.mp = p.mpMax;
      casted[id] = castSkill(p, id) && (S.instant ? true : !!p.act && p.act.skill === id); T.run(240); }
    out.casted = casted; out.castFail = Object.keys(casted).filter(k => !casted[k]);
    // 11) 回城：变回原来的样子
    T.clear(); T.reset(); game.scene = 'town'; pmSuitSync(p); out.town = { on: !!p._pmSuit, acts: p.acts === GUN_ACTS }; game.scene = 'test'; pmSuitSync(p);
    // 12) 神兵天降：一觉本来是好的 → 升空阶段按一觉合并威力（伤害更高）；一觉在冷却中 → 按了也不合并
    const awk3 = pre => { T.clear(); T.reset(); const m = T.mob(420, 100); const hp0 = m.hp; game.skillBar[12] = 'pm_awk1'; if (!pre) p.cool.pm_awk1 = 99; castSkill(p, 'pm_awk3');
      T.run(70); T.tap('s12'); const a = p.act; T.run(260); return { merged: !!(a && a.merged), mul: +((a && a.mergeMul) || 1).toFixed(2), dmg: hp0 - m.hp, cd1: Math.round(p.cool.pm_awk1 || 0) }; };
    out.merge = awk3(true); out.noMerge = awk3(false); T.clear(); T.reset();
    return out;
  });
  report('基础技能只能学 5 个（后撩踢 / 浮空弹 / 钉刺射 / 刺踢 / 上旋踢），其他转职不受影响；学不了的放不出来', R.base.allowed.join() === 'g_flash,g_knee,g_launch,g_spin,g_stomp' && R.base.ranger === R.base.total && R.base.gatlingCast === null && R.base.jobList >= 19, R.base);
  report('强袭战斗服：测试场里自动变身（pmsuit 帧集、不显示时装，只有转职外观），系统被动自动学会', R.suit.on && R.suit.key === 'pmsuit' && R.suit.av && R.suit.acts && R.suit.sys, R.suit);
  report('[SCQC] 普攻：按住 X 连出 4 段、独立攻击、命中每段 +5% 信息、每跳 2 次跳攻', R.combo.names.join() === 'atk1,atk2,atk3,atk4' && R.combo.hit && R.combo.info >= 20 && R.combo.type === 'indep' && R.combo.airMax === 2, R.combo);
  report('技能命中收集信息（护盾冲击 25%），上限 3 层', R.skillInfo >= 25 && R.skillInfo < 40 && R.cap.info === 300 && R.cap.stacks === 3, { skill: R.skillInfo, cap: R.cap });
  report('无动作施放：技能中放 BUFF 不打断（直接调用 / 按技能栏键都一样）、空中也能放；装甲强化提高最大 HP', R.instant.same && R.instant.okArms && R.instant.okArmor && R.instant.arms && R.instant.armsT >= 299 && R.instant.armor && R.instant.hpUp && R.instant.air && R.instant.key.act === 'pm_ray' && R.instant.key.arms, R.instant);
  report('机动强化：信息不足放不出；消耗 1 层，三速提高', !R.noStack && R.mobility.buff && R.mobility.aspd > 0.07 && R.mobility.info === 30, { no: R.noStack, ...R.mobility });
  report('单人：每消耗 1 层信息呼叫激光轰炸（打到敌人）', R.laser.hit, R.laser);
  report('单人专属加成：独立攻击 +32%、冷却 −20%', R.solo.solo && R.solo.atk === 0.32 && Math.abs(R.solo.cdMul - 0.8) < 0.01 && Math.abs(R.solo.lockCd - 2.4) < 0.05, R.solo);
  report('保护罩：一层约 12%，叠加总量不超过最大 HP 的 60%，挨打时先扣护盾（HP 不掉）', R.shield.one >= 10 && R.shield.one <= 15 && R.shield.cap <= 70 && R.shield.cap >= 55 && R.shield.hpSame && R.shield.absorbed > 0, R.shield);
  report('强化保护罩：受到的伤害 −20%、霸体、外加小护盾', R.red.buff && R.red.taken <= -0.2 && R.red.sa && R.red.shield, R.red);
  report('二觉 / 三觉没完成觉醒任务时放不出来', !R.tierLocked.awk2 && !R.tierLocked.awk3, R.tierLocked);
  report('神兵天降：升空阶段预输入一觉合并威力（伤害更高、一觉进冷却）；一觉冷却中不合并', R.merge.merged && R.merge.mul > 1.2 && R.merge.dmg > R.noMerge.dmg * 1.2 && R.merge.cd1 > 100 && !R.noMerge.merged, { merge: R.merge, noMerge: R.noMerge });
  report('全部技能都能放', R.castFail.length === 0, R.castFail.length ? R.castFail : Object.keys(R.casted).length);
  report('回城变回原来的样子（原模型、原普攻）', !R.town.on && R.town.acts, R.town);
  const errs = logs.filter(l => l.type !== 'warning'); report('单机无报错', errs.length === 0, errs.slice(0, 3));
  await browser.close();
}

/* ================= 联机：2 人组队刷图，BUFF / 保护罩同步 ================= */
if (!onlySolo) {
  const { startServer, launchPlayers, ok, result, sleep, until, uiRegister, uiCreateChar, dumpErrors } = await import('./net_lib.mjs');
  const srv = await startServer();
  const { players, close } = await launchPlayers(2);
  const [A, B] = players.map(p => p.page);
  try {
    ok(await uiRegister(A, srv.url, 'alice'), 'alice 注册'); ok(await uiCreateChar(A, 1), 'alice 建神枪手');
    ok(await uiRegister(B, srv.url, 'bob'), 'bob 注册'); ok(await uiCreateChar(B, 0), 'bob 建鬼剑士');
    await A.evaluate(() => { testLoadout(20); game.job = save.data.job = 'paramedic'; onJobChange(game.player, 'paramedic');
      for (const id of classSkills('gun', 'paramedic')) if (SKILLS[id] && SKILLS[id].lvReq <= 20) game.skillLv[id] = SKILLS[id].passive ? 1 : 3; save.write(); });
    await B.evaluate(() => { testLoadout(20); save.write(); });
    await A.evaluate(() => netPartyInvite(null, 'bob')); await until(B, () => menus.isOpen('nd_pinv'), null, 5000); await B.click('.netask button:has-text("加入队伍")');
    ok(await until(A, () => netParty.p && netParty.p.members.length === 2, null, 8000), '组队 2 人');
    ok(await until(B, () => netParty.p && netParty.p.members.some(m => m.char && m.char.job === 'paramedic'), null, 8000), '队伍信息里有协战师');
    await A.evaluate(() => enterDungeon('lorien', 0));
    const allIn = await Promise.all([A, B].map(P => until(P, () => game.scene === 'dungeon' && coop.state === 'play' && coop.mates.size === 1, null, 30000)));
    ok(allIn.every(Boolean), '两人一起进入地下城', allIn);
    await sleep(800);
    // 队友看到的协战师影子也穿战斗服；组队时没有单人加成
    const vis = await B.evaluate(() => { const g = [...coop.mates.values()][0]; return { job: g.kit.job, suit: !!g._pmSuit, key: g.model && g.model.key }; });
    ok(vis.job === 'paramedic' && vis.suit && vis.key === 'pmsuit', '队友那边的协战师影子也穿战斗服', vis);
    const solo = await A.evaluate(() => ({ solo: soloPlay(), atk: game.player.buffs.pm_info ? game.player.buffs.pm_info.atk : null }));
    ok(!solo.solo && solo.atk === 0, '组队时没有单人专属加成', solo);
    // bob 换到别的房间（跨房间也要生效）
    const moved = await B.evaluate(() => { const dg = game.dungeon, other = dg.layout.rooms.find(r => r !== dg.room); dg.enter(other, null); return dg.room !== dg.layout.start; });
    ok(moved, 'bob 在别的房间');
    // alice 放军械强化 / 装甲强化（无动作）、缓冲保护罩（耗 1 层）；数一下 alice 自己收到的 pfx（应该是 0：服务端不回发，队友的影子重放也不再发）
    await A.evaluate(() => { window.__pfxIn = 0; net.on('r', m => { if (m.d && m.d.k === 'pfx') window.__pfxIn++; }); });
    await A.evaluate(() => { const p = game.player; p.cool = {}; p.mp = p.mpMax; p.pmInfo = 300; castSkill(p, 'pm_arms'); castSkill(p, 'pm_armor'); castSkill(p, 'pm_buffer'); });
    const got = await until(B, () => { const b = game.player.buffs; return b.pm_arms && b.pm_armor && absorbOf(game.player) > 0; }, null, 5000);
    const bb = await B.evaluate(() => { const p = game.player, b = p.buffs; return { arms: b.pm_arms && +b.pm_arms.atk.toFixed(3), armsT: b.pm_arms && Math.round(b.pm_arms.t), armor: b.pm_armor && +b.pm_armor.hpPct.toFixed(3), shield: Math.round(absorbOf(p)), hpMax: p.hpMax }; });
    ok(got && bb.arms > 0.08 && bb.armsT > 290 && bb.armor > 0.05 && bb.shield > 0, '队友（在别的房间）收到军械强化 / 装甲强化 / 保护罩', bb);
    // 保护罩在队友自己的客户端吸伤害
    const hit = await B.evaluate(() => { const p = game.player, m = spawnMonster('goblin', p.x + 30, p.y); m.control = null; const hp = p.hp, ab = absorbOf(p); applyHit(m, p, { dmg: 1, stun: 0.1, sure: true }); const r = { hpSame: p.hp >= hp - 1, used: Math.round(ab - absorbOf(p)) }; m.remove = true; return r; });
    ok(hit.hpSame && hit.used > 0, '队友挨打时先扣协战师的保护罩', hit);
    // 净化：解除队友的异常
    await B.evaluate(() => { addStatus(game.player, 'poison', 8, { dps: 1, force: true }); addStatus(game.player, 'slow', 8, { force: true }); });
    await A.evaluate(() => { const p = game.player; p.cool = {}; p.pmInfo = 100; castSkill(p, 'pm_purge'); });
    ok(await until(B, () => !game.player.status || Object.keys(game.player.status).length === 0, null, 5000), '净化解除队友的异常状态');
    // 强化保护罩（强袭目标，动作技能）：队友也拿到（减伤 + 霸体）
    await A.evaluate(() => { const p = game.player; p.cool = {}; p.mp = p.mpMax; castSkill(p, 'pm_assault'); });
    const red = await until(B, () => !!game.player.buffs.pm_red, null, 5000);
    const redV = await B.evaluate(() => ({ taken: game.player.buffs.pm_red && game.player.buffs.pm_red.taken, sa: game.player.superArmor > 0 }));
    ok(red && redV.taken <= -0.2, '队友收到强化保护罩', redV);
    // 影子重放协战师的动作技能时不会再发一次（不重复、不回环）：bob 身上的强化保护罩只有一份、alice 自己没有收到回传
    await sleep(600);
    const once = await A.evaluate(() => window.__pfxIn);
    ok(once === 0, '不回环：队友影子重放协战师的技能时不再发一次（alice 收到的 pfx = 0）', once);
    const errs = dumpErrors(players); ok(errs.length === 0, '联机无报错', errs.slice(0, 3));
  } catch (e) { console.log('✗ 联机测试异常', e.message); fail++; }
  finally { await close(); await srv.stop(); }
  const r = result(); fail += r.fails;
}
console.log(fail ? `${fail} 项失败` : '全部通过');
process.exit(fail ? 1 : 0);
