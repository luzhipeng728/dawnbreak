// 驱魔师（圣职者转职 exorcist，P-exorcist）机制测试 + 画面截图 + 组队可见性。node test/exorcist.mjs [mech,shots,coop]（默认 mech,shots，约 1 分钟）
//   mech   驱魔震慑（普攻换战斧 3 段、聚怪、第 3 段蓄力、移速）、空斩打蓄力、升天阵 / 落凤锤强化与落凤锤后接巨兵系、潜龙减伤、
//          式神（朱雀带着敌人冲 / 玄武区域强制硬直 + 10 段 / 白虎 8 道落雷分配 / 青龙 4 段）、共鸣（式神之悟：巨兵系施放中瞬发式神、2 次、3 秒恢复）、
//          无双击卷人、逆龙七杀（第一斧没中就结束）、驱魔之书冷却、真龙全队三速、封魔莲华属性、法阵：万悟、觉醒自动学会（0 SP、放进技能栏）
//   shots  游戏内截图 → test/shots/exorcist/*.png + 总览 test/shots/exorcist.jpg（四只式神、升龙·开阵、三个觉醒、普攻重砸）
//   coop   两个客户端组队（主机鬼剑士 + 队员驱魔师）：队员放式神，主机那边的影子旁边出现同一只式神（要先软链 server/node_modules）
import { launch, URL_BASE } from './lib.mjs';
import fs from 'fs';
import { execFileSync } from 'child_process';
const MODES = (process.argv[2] || 'mech,shots').split(',');
let fail = 0;
const report = (name, ok, info) => { if (!ok) fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${JSON.stringify(info)}`); };
const noErr = (logs, tag) => { const e = logs.filter(l => l.type === 'pageerror' || l.type === 'error'); report(`无报错（${tag}）`, e.length === 0, e.slice(0, 3)); };
const ready = page => page.waitForFunction(() => window.__READY, null, { timeout: 30000 });
function pageSetup() {
  game.paused = true; window.toastMsg = () => {};
  const p = game.player, R = game.room, run = n => { for (let i = 0; i < n; i++) step(1 / 60); };
  game.job = 'exorcist'; Object.assign((save.data.flags ??= {}), { awaken: true, awaken2: true, awaken3: true }); onJobChange(p, 'exorcist');
  for (const id of classSkills('priest', 'exorcist')) game.skillLv[id] = Math.max(1, Math.min(SKILLS[id] ? SKILLS[id].maxLv || 5 : 1, 5));
  const cx = R ? (R.x0 + R.x1) / 2 : 700;
  window.T = { p, run, cx,
    reset(keep) { for (const k in input.virt) delete input.virt[k]; input.buf.length = 0; clearAllSummons('audit'); for (const e of ents) if (e !== p) e.remove = true; run(1); game.timeStop = 0; game.cutin = null;
      Object.assign(p, { x: cx - 200, y: 100, z: 0, vz: 0, vx: 0, vy: 0, face: 1, cool: {}, mp: 1e6, mpMax: 1e6, superArmor: 0, invul: 0, hp: 1e6, hpMax: 1e6, _peRes: null });
      if (!keep) p.buffs = {}; p.act = null; p.setState('idle'); run(2); },
    mob(dx, o = {}, dy = 0) { const m = spawnMonster('goblin', p.x + dx, p.y + dy); m.control = null; m.hp = m.hpMax = 1e9; m.invul = 0; m.evade = 0; Object.assign(m, o); return m; },
    dmg: m => m.hpMax - m.hp, hits: m => m.__n || 0,
    until(f, n = 600) { for (let i = 0; i < n && !f(); i++) step(1 / 60); return f(); },
    summonDone(n = 600) { T.until(() => summonsOf(p).length > 0, 60); T.until(() => !summonsOf(p).length, n); },
    idle(n = 600) { T.until(() => p.st !== 'act' && p.z <= 0 && !(game.timeStop > 0), n); run(2); },
    tick() { p._psvT = 0; tickPassives(p, 0.3); },
    four() { T.mob(160); T.mob(260, {}, 40); T.mob(360, {}, -30); T.mob(460, {}, 20); },
    at: () => ({ x: (p.x - cam.x) * 1280 / 960, y: (FLOOR_Y + p.y - p.z) * 720 / 540 }) };
  const ah = window.applyHit; window.applyHit = function (a, t, h, o) { const r = ah.apply(this, arguments); if (r && t) t.__n = (t.__n || 0) + 1; return r; };
}

if (MODES.includes('mech')) {
  const { browser, page, logs } = await launch({ width: 960, height: 540 });
  await page.goto(`${URL_BASE}?test&cls=priest&priest=1&mobs=0&mute&rawcd`); await ready(page);
  await page.evaluate(pageSetup);
  // 1) 驱魔震慑 / 空斩打蓄力 / 升天阵 / 落凤锤 / 潜龙
  const A = await page.evaluate(() => {
    const { p, run, reset, mob } = T, o = {};
    reset(); T.tick(); o.acts = p.acts.atk1 === PE_ACTS.atk1 && p.acts.atk3 === PE_ACTS.atk3; o.mspd = p.buffs.pe_force && p.buffs.pe_force.mspd;
    const m = mob(150); p.doAct(p.acts.atk1); run(14); o.gather = Math.round(m.x - p.x);
    reset(); p.doAct(p.acts.atk3); input.virt.attack = 1; run(30); o.chargeAtk3 = !!(p.act && p.act.charging); delete input.virt.attack; run(40);
    reset(); game.skillBar[0] = 'p_launcher'; input.virt.s0 = 2; run(1); input.virt.s0 = 1; run(20); o.launcherCharge = !!(p.act && p.act.charging) && p.superArmor > 0; delete input.virt.s0; run(40);
    game.job = 'monk'; reset(); input.virt.s0 = 2; run(1); input.virt.s0 = 1; run(20); o.monkNoCharge = !(p.act && p.act.charging); delete input.virt.s0; game.job = 'exorcist'; run(40);
    o.emblem = pMod(p, 'p_emblem'); o.phoenix = pMod(p, 'p_phoenix');
    game.skillLv.pe_general = 0; reset(); castSkill(p, 'p_phoenix'); run(10); o.cancelAir = canCancelInto(p, 'pe_gale'); T.until(() => p.act && !p.act.onLand, 120); run(3); o.cancelLanded = canCancelInto(p, 'pe_gale') && SKILLS.pe_suzaku.req(p) !== true; T.idle();   // 式神是 instant（canCancelInto 恒真），没学式神之悟时靠 req 挡住
    // 潜龙：狂乱锤击（霸体）中受到的伤害 ×0.75
    const rnd0 = Math.random; Math.random = () => 0.5; game.skillLv.pe_general = 5; reset(); const e1 = mob(60); const h0 = p.hp; applyHit(e1, p, { dmg: 1000, sure: true }); const d0 = h0 - p.hp; T.idle(); reset(); const e2 = mob(60); castSkill(p, 'pe_chaos'); run(10); const h1 = p.hp; applyHit(e2, p, { dmg: 1000, sure: true }); o.lurk = +((h1 - p.hp) / d0).toFixed(2); Math.random = rnd0;
    return o;
  });
  report('驱魔震慑：普攻换成战斧 3 段、把敌人往身前带、第 3 段按住 X 蓄力；移速 +10%', A.acts && A.mspd === 0.1 && A.gather < 150 && A.chargeAtk3, A);
  report('空斩打：驱魔师按住技能键蓄力（霸体），别的转职不能蓄力', A.launcherCharge && A.monkNoCharge, A);
  report('升天阵 / 落凤锤：驱魔强化（伤害 ×1.2、范围更大、升天阵聚怪、落凤锤跳得更高）；落凤锤砸地后才能接巨兵系（式神不行）', A.emblem.dmg === 1.2 && A.emblem.range > 1.2 && A.emblem.pull && A.phoenix.jump > 1 && !A.cancelAir && A.cancelLanded, { emblem: A.emblem, phoenix: A.phoenix, air: A.cancelAir, landed: A.cancelLanded });
  report('潜龙：技能霸体中受到的伤害 ×0.75', Math.abs(A.lurk - 0.75) < 0.03, A.lurk);
  // 2) 式神
  const B = await page.evaluate(() => {
    const { p, run, reset, mob } = T, o = {};
    reset(); const s1 = mob(90); castSkill(p, 'pe_suzaku'); T.summonDone(200); o.suzaku = { hits: T.hits(s1), moved: Math.round(s1.x - p.x) };
    reset(); const g1 = mob(200), g2 = mob(280, {}, 40), g3 = mob(600); castSkill(p, 'pe_genbu'); T.until(() => g1.status && g1.status.hold, 120); o.genbuHold = [!!(g1.status && g1.status.hold), !!(g2.status && g2.status.hold), !!(g3.status && g3.status.hold)]; T.until(() => !summonsOf(p).length, 400); o.genbuHits = T.hits(g1);
    reset(); const b1 = mob(220), b2 = mob(300, {}, 30); castSkill(p, 'pe_byakko'); T.summonDone(400); o.byakko = [T.hits(b1), T.hits(b2)];
    reset(); const q1 = mob(120); castSkill(p, 'pe_seiryu'); T.summonDone(300); o.seiryu = T.hits(q1);
    reset(); const u1 = mob(200); castSkill(p, 'pe_pentacle'); T.summonDone(300); o.pentacle = T.hits(u1);
    // 共鸣：没学式神之悟 → 巨兵系施放中放不出式神；学了 → 瞬发（不打断当前技能）、2 次、3 秒恢复 1 次
    game.skillLv.pe_general = 0; reset(); mob(80); castSkill(p, 'pe_chaos'); run(10); castSkill(p, 'pe_suzaku'); o.noRes = { act: p.act && p.act.skill, n: summonsOf(p, 'pe_suzaku_s').length }; T.idle();
    game.skillLv.pe_general = 1; reset(); mob(80); castSkill(p, 'pe_chaos'); run(10); castSkill(p, 'pe_suzaku'); const n1 = peRes(p).n; p.cool = {}; castSkill(p, 'pe_byakko'); const n2 = peRes(p).n; p.cool = {}; const third = castSkill(p, 'pe_genbu') && summonsOf(p, 'pe_genbu_s').length;
    o.res = { act: p.act && p.act.skill, suzaku: summonsOf(p, 'pe_suzaku_s').length, byakko: summonsOf(p, 'pe_byakko_s').length, n1, n2, third: !!third }; run(185); o.res.recover = peRes(p).n; T.idle();
    return o;
  });
  report('式神：热炎朱雀 —— 带着敌人往前冲 4 段 + 爆炸（共 5 段）', B.suzaku.hits === 5 && B.suzaku.moved > 250, B.suzaku);
  report('式神：地之玄武 —— 区域里的敌人强制硬直（区域外的不会），碎石 10 段', B.genbuHold[0] && B.genbuHold[1] && !B.genbuHold[2] && B.genbuHits === 10, { hold: B.genbuHold, hits: B.genbuHits });
  report('式神：空之白虎 —— 8 道落雷在两个敌人之间轮流（4 / 4）', B.byakko[0] === 4 && B.byakko[1] === 4, B.byakko);
  report('式神：幻海青龙 4 段（3 砍 + 终结）、升龙·开阵 21 段（上升 20 + 砸回 1）', B.seiryu === 4 && B.pentacle === 21, { seiryu: B.seiryu, pentacle: B.pentacle });
  report('共鸣（式神之悟）：没学时巨兵系施放中放不出式神；学了以后瞬发、不打断当前技能、2 次用完就不行、3 秒恢复 1 次', B.noRes.act === 'pe_chaos' && B.noRes.n === 0 && B.res.act === 'pe_chaos' && B.res.suzaku === 1 && B.res.byakko === 1 && B.res.n1 === 1 && B.res.n2 === 0 && !B.res.third && B.res.recover === 1, B);
  // 3) 巨兵系：无双击卷人 / 七杀 / 驱魔之书 / 真龙 / 莲华 / 万悟
  const C = await page.evaluate(() => {
    const { p, run, reset, mob } = T, o = {};
    reset(); const a1 = mob(-240), a2 = mob(320, {}, 60); castSkill(p, 'pe_atomic'); run(40); const gx = p.x + p.face * 110; o.atomic = [Math.round(Math.abs(a1.x - gx)), Math.round(Math.abs(a2.x - gx))]; T.idle(); o.atomicHit = T.dmg(a1) > 0 && T.dmg(a2) > 0;
    reset(); const s = mob(110); castSkill(p, 'pe_seven'); T.until(() => !p.act, 400); o.seven = T.hits(s);
    reset(); castSkill(p, 'pe_seven'); let t = 0; while (p.act && t < 200) { run(1); t++; } o.sevenMiss = +(t / 60).toFixed(2);
    reset(); castSkill(p, 'pe_chaos'); o.book = +(p.cool.pe_chaos / SKILLS.pe_chaos.cd).toFixed(2); T.idle(); reset(); castSkill(p, 'pe_awaken'); o.bookAwk = +(p.cool.pe_awaken / SKILLS.pe_awaken.cd).toFixed(2); T.idle();
    reset(); run(70); o.kouryu = p.buffs.pe_kouryuA ? [p.buffs.pe_kouryuA.aspd, p.buffs.pe_kouryuA.cspd, p.buffs.pe_kouryuA.mspd] : null;
    reset(); castSkill(p, 'pe_lotus'); run(60); T.tick(); o.lotus = { buff: !!p.buffs.pe_lotus, elem: p.atkElem };
    reset(); const atk0 = p.atk; p.matk = p.atk * 2; T.tick(); o.zen = p.dmgType; p.matk = atk0 * 0.5; T.tick(); o.zen2 = p.dmgType;
    return o;
  });
  report('无双击：把身后 240px / 前方 320px 的敌人卷到身前一处再重砸', C.atomic.every(d => d < 150) && C.atomicHit, C.atomic);
  report('逆龙七杀：第一斧打中 → 7 击；没打中 → 很快结束', C.seven === 7 && C.sevenMiss < 0.9, { seven: C.seven, miss: C.sevenMiss });
  report('驱魔之书：驱魔技能冷却 ×0.9，觉醒不算；真龙：自己三速 +10%；封魔莲华：武器附带火 / 光属性；法阵：万悟 按更高的攻击方式结算', C.book === 0.9 && C.bookAwk === 1 && C.kouryu && C.kouryu.every(v => v === 0.1) && C.lotus.buff && ['fire', 'light'].includes(C.lotus.elem) && C.zen === 'mag' && C.zen2 === 'phys', C);
  // 4) 觉醒：自动学会（0 SP、随角色等级升级、放进技能栏）；觉醒中无敌；插图
  const W = await page.evaluate(() => {
    const { p, run, reset, mob } = T, o = {}, f = save.data.flags, lv0 = game.lvl, bar0 = [...game.skillBar];
    const clear = () => { for (const id of ['pe_awaken', 'pe_awaken2', 'pe_awaken3', 'pe_kouryu']) delete game.skillLv[id]; game.skillBar = game.skillBar.map(() => null); };
    clear(); f.awaken = f.awaken2 = f.awaken3 = false; game.lvl = 30; T.tick(); o.locked = !game.skillLv.pe_awaken;
    f.awaken = true; T.tick(); o.a1 = { lv: game.skillLv.pe_awaken, bar: game.skillBar.includes('pe_awaken'), sp: SKILLS.pe_awaken.sp, a2: game.skillLv.pe_awaken2 || 0 };
    f.awaken2 = true; T.tick(); o.a2 = { lv: game.skillLv.pe_awaken2, kouryu: game.skillLv.pe_kouryu, bar: game.skillBar.includes('pe_awaken2') };
    f.awaken3 = true; T.tick(); o.a3 = { lv: game.skillLv.pe_awaken3, bar: game.skillBar.includes('pe_awaken3') };
    clear(); game.lvl = 21; T.tick(); o.lv21 = game.skillLv.pe_awaken;
    game.lvl = lv0; game.skillBar = bar0; for (const id of classSkills('priest', 'exorcist')) game.skillLv[id] = Math.max(1, Math.min(SKILLS[id].maxLv || 5, 5));
    reset(); castSkill(p, 'pe_awaken'); T.until(() => !(game.timeStop > 0), 120); run(10); o.inv = p.invul > 0; o.cutin = !!(game.cutin && IMG['cutin/' + game.cutin.who.cls]); T.idle();
    o.desc = /自动学会/.test(SKILLS.pe_awaken.desc) && cmdTextOf('pe_awaken') === '↑↑↓↓+Z';
    return o;
  });
  report('觉醒：一觉前不给；一 / 二 / 三觉完成后自动学会（0 SP、Lv30 满 3 级、Lv21 1 级）并放进技能栏；二觉同时给 真龙；觉醒中无敌、有插图', W.locked && W.a1.lv === 3 && W.a1.bar && W.a1.sp === 0 && !W.a1.a2 && W.a2.lv >= 1 && W.a2.kouryu === 1 && W.a2.bar && W.a3.lv >= 1 && W.a3.bar && W.lv21 === 1 && W.inv && W.cutin && W.desc, W);
  noErr(logs, 'mech');
  await browser.close();
}

if (MODES.includes('shots')) {
  const dir = 'test/shots/exorcist'; fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  const { browser, page, logs } = await launch({ width: 1280, height: 720 });
  await page.goto(`${URL_BASE}?test&cls=priest&priest=1&mobs=0&mute`); await ready(page);
  await page.evaluate(pageSetup);
  await page.evaluate(() => { for (const id of ['#ui', '#dom']) { const el = document.querySelector(id); if (el) el.style.visibility = 'hidden'; } });
  const shot = async (name, f, arg) => { const pos = await page.evaluate(f, arg); await page.waitForTimeout(120);
    await page.screenshot({ path: `${dir}/${name}.png`, clip: { x: Math.max(0, Math.min(1280 - 640, pos.x - 200)), y: Math.max(0, Math.min(720 - 400, pos.y - 280)), width: 640, height: 400 } }); };
    const SHOTS = [['1-suzaku', 'pe_suzaku', 'T.run(24)'], ['2-genbu', 'pe_genbu', 'T.run(70)'], ['3-byakko', 'pe_byakko', 'T.run(80)'], ['4-seiryu', 'pe_seiryu', 'T.run(45)'], ['5-pentacle', 'pe_pentacle', 'T.run(75)'],
    ['6-awaken-gate', 'pe_awaken', 'gate14'], ['7-awaken-bird', 'pe_awaken', 'gateBig'], ['8-awaken2-dragon', 'pe_awaken2', 'act1'], ['9-awaken2-swing', 'pe_awaken2', 'swing'],
    ['10-awaken3-sea', 'pe_awaken3', 'act095'], ['11-awaken3-axe', 'pe_awaken3', 'smash'], ['12-atk3-slam', 'atk3', 'T.run(18)']];
  for (const [name, id, wait] of SHOTS) await shot(name, ({ id, wait }) => { const { p, run, reset } = T; reset(); T.four();
    if (id === 'atk3') p.doAct(p.acts.atk3); else castSkill(p, id); T.until(() => !(game.timeStop > 0), 120);
    const gate = () => summonsOf(p, 'pe_gate_s')[0];
    if (wait === 'gate14') T.until(() => gate() && gate().lifeT > 1.4, 300); else if (wait === 'gateBig') { T.until(() => gate() && gate().big, 400); run(6); }
    else if (wait === 'act1') T.until(() => p.act && p.actT > 1.0, 200); else if (wait === 'swing') { T.until(() => p.act && p.act.swing, 300); run(5); }
    else if (wait === 'act095') T.until(() => p.act && p.actT > 0.95, 200); else if (wait === 'smash') { T.until(() => p.act && p.act.smash, 400); run(8); }
    else run(+wait.match(/\d+/)[0]);
    return T.at(); }, { id, wait });
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.png')).sort((a, b) => parseInt(a) - parseInt(b));
  try {
    execFileSync('python3', ['-c', `
import sys
from PIL import Image, ImageDraw, ImageFont
fs = sys.argv[2:]; W, H = 640, 400; cols = 4; rows = (len(fs) + cols - 1) // cols
out = Image.new('RGB', (W * cols, (H + 26) * rows), (24, 22, 30)); d = ImageDraw.Draw(out)
try: font = ImageFont.truetype('/System/Library/Fonts/STHeiti Medium.ttc', 18)
except Exception: font = None
for i, f in enumerate(fs):
    im = Image.open(f).convert('RGB'); x, y = (i % cols) * W, (i // cols) * (H + 26)
    out.paste(im, (x, y + 26)); d.text((x + 8, y + 3), f.split('/')[-1][:-4], fill=(255, 220, 150), font=font)
out.save(sys.argv[1], quality=82)`, 'test/shots/exorcist.jpg', ...files.map(f => `${dir}/${f}`)]);
    report('截图总览 test/shots/exorcist.jpg', fs.existsSync('test/shots/exorcist.jpg'), { n: files.length });
  } catch (e) { report('截图总览', false, String(e).slice(0, 200)); }
  noErr(logs, 'shots');
  await browser.close();
}

if (MODES.includes('coop')) {
  const { coopCheck } = await import('./priest_coop_lib.mjs');
  const r = await coopCheck('exorcist', async (A, B) => {
    const cast = await B.evaluate(() => { const p = game.player; p.mp = p.mpMax; p.cool = {}; return castSkill(p, 'pe_byakko'); });
    const seen = await A.evaluate(() => new Promise(res => { let n = 0; const iv = setInterval(() => { const g = [...coop.mates.values()][0], s = g && summonsOf(g, 'pe_byakko_s')[0]; if (s || ++n > 60) { clearInterval(iv); res(s ? { key: s.skey, dx: Math.round(s.x - g.x) } : null); } }, 50); }));
    await new Promise(r => setTimeout(r, 400));
    const cast2 = await B.evaluate(() => { const p = game.player; p.mp = p.mpMax; p.cool = {}; p.act = null; p.setState('idle'); return castSkill(p, 'pe_genbu'); });
    const seen2 = await A.evaluate(() => new Promise(res => { let n = 0; const iv = setInterval(() => { const g = [...coop.mates.values()][0], s = g && summonsOf(g, 'pe_genbu_s')[0]; if (s || ++n > 60) { clearInterval(iv); res(s ? s.skey : null); } }, 50); }));
    return [['队员放式神：空之白虎 → 主机那边的队友影子前方出现同一只白虎（只是表现，不结算伤害）', cast && !!seen, { cast, seen }], ['队员放式神：地之玄武 → 主机那边也出现', cast2 && seen2 === 'pe_genbu_s', { cast2, seen2 }]];
  });
  for (const [name, ok, info] of r) report(name, ok, info);
}
console.log(fail ? `${fail} 项失败` : '全部通过');
process.exit(fail ? 1 : 0);
