// 复仇者（圣职者转职 avenger，P-avenger）机制测试 + 画面截图 + 组队可见性。node test/avenger.mjs [mech,shots,coop]（默认 mech,shots，约 1 分钟）
//   mech   恶魔能量（进图 200、普攻 / 技能回能量、恶魔唤醒额外加）、恶魔之力（技能中按 X / Z 放残影耗 30、普攻 / 魔化中不行）、半魔化（门槛 200、流失、归零解除、冷却结束后才转）、
//          魔化（变身：体型 / 普攻 / 霸体 / 不能被抓 / 外观；空斩打键 → 恶魔之爪、禁用基础技能、审判 / 屏障只在魔化中；恶魔版技能伤害 / 冷却；化魔续时 / 自动施放；再按解除 / 重置；恶之再临）、
//          厄运之轮空中施放、复仇之刺受击中施放、审判拖行、HUD 能量条、觉醒自动学会
//   shots  游戏内截图 → test/shots/avenger/*.png + 总览 test/shots/avenger.jpg；魔化变身连拍 → test/shots/avenger_transform.jpg
//   coop   两个客户端组队（主机鬼剑士 + 队员复仇者）：队员魔化 → 主机那边的影子变身（BUFF / 体型 / 外观），解除后影子也变回来；地狱之门在影子前面出现（要先软链 server/node_modules）
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
  game.job = 'avenger'; Object.assign((save.data.flags ??= {}), { awaken: true, awaken2: true, awaken3: true }); onJobChange(p, 'avenger');
  for (const id of classSkills('priest', 'avenger')) game.skillLv[id] = Math.max(1, Math.min(SKILLS[id] ? SKILLS[id].maxLv || 5 : 1, 5));
  const cx = R ? (R.x0 + R.x1) / 2 : 700;
  window.T = { p, run, cx,
    reset(keep) { for (const k in input.virt) delete input.virt[k]; input.buf.length = 0; clearAllSummons('audit'); for (const e of ents) if (e !== p) e.remove = true; run(1); game.timeStop = 0; game.cutin = null;
      if (!keep) { if (p.buffs.pa_demon) paDemonEnd(p); p.buffs = {}; p._paAuto = 0; p.scale = 1; p._paD = 0; }
      Object.assign(p, { x: cx - 200, y: 100, z: 0, vz: 0, vx: 0, vy: 0, face: 1, cool: {}, mp: 1e6, mpMax: 1e6, superArmor: 0, invul: 0, hp: 1e6, hpMax: 1e6, _paE: 400 });
      p.act = null; p.setState('idle'); p.acts = priestActs(p); run(2); },
    mob(dx, o = {}, dy = 0) { const m = spawnMonster('goblin', p.x + dx, p.y + dy); m.control = null; m.hp = m.hpMax = 1e9; m.invul = 0; m.evade = 0; Object.assign(m, o); return m; },
    dmg: m => m.hpMax - m.hp, hits: m => m.__n || 0,
    until(f, n = 600) { for (let i = 0; i < n && !f(); i++) step(1 / 60); return f(); },
    idle(n = 600) { T.until(() => p.st !== 'act' && p.z <= 0 && !(game.timeStop > 0), n); run(2); },
    tick() { p._psvT = 0; tickPassives(p, 0.3); },
    demon() { castSkill(p, 'pa_awaken'); T.until(() => p.buffs.pa_demon, 200); T.idle(); p.cool = {}; },
    four() { T.mob(140); T.mob(240, {}, 40); T.mob(340, {}, -30); T.mob(440, {}, 20); },
    at: () => ({ x: (p.x - cam.x) * 1280 / 960, y: (FLOOR_Y + p.y - p.z) * 720 / 540 }) };
  const ah = window.applyHit; window.applyHit = function (a, t, h, o) { const r = ah.apply(this, arguments); if (r && t) t.__n = (t.__n || 0) + 1; return r; };
}

if (MODES.includes('mech')) {
  const { browser, page, logs } = await launch({ width: 960, height: 540 });
  await page.goto(`${URL_BASE}?test&cls=priest&priest=1&mobs=0&mute&rawcd`); await ready(page);
  await page.evaluate(pageSetup);
  // 1) 能量 / 恶魔之力 / 半魔化
  const E = await page.evaluate(() => {
    const { p, run, reset, mob } = T, o = {};
    reset(); delete p._paE; o.e0 = paE(p);
    reset(); p._paE = 100; game.skillLv.pa_nightmare = 0; const m = mob(80); p.doAct(p.acts.atk1); run(12); o.atkGain = +(p._paE - 100).toFixed(1); T.idle();
    game.skillLv.pa_nightmare = 5; p._paE = 100; castSkill(p, 'pa_mine'); o.mineGain = +(p._paE - 100).toFixed(1); T.idle();
    // 恶魔之力：技能中按 X → 残影（−30、打中木桩）；普攻中按 X 不放
    reset(); const d = mob(90); castSkill(p, 'pa_render'); run(8); const e1 = p._paE, h1 = T.hits(d); input.virt.attack = 2; run(1); delete input.virt.attack; run(4); o.devil = { cost: Math.round(e1 - p._paE), hit: T.hits(d) > h1 }; T.idle();
    reset(); p.doAct(p.acts.atk1); run(4); const e2 = p._paE; input.virt.attack = 2; run(1); delete input.virt.attack; run(3); o.devilBasic = Math.round(e2 - p._paE); T.idle();
    // 半魔化：能量不足 200 放不了；放了以后流失、普攻换表；归零解除、冷却才开始转
    reset(); p._paE = 150; o.metaLow = SKILLS.pa_meta.req(p); p._paE = 400; castSkill(p, 'pa_meta'); run(40); T.tick(); o.half = !!p.buffs.pa_half && p.acts.atk1 === PA_ACTS_HALF.atk1; o.metaCdOn = p.cool.pa_meta > 100;
    const e3 = p._paE; for (let i = 0; i < 11; i++) { run(15); T.tick(); } o.drain = Math.round(e3 - p._paE);
    castSkill(p, 'pa_render'); run(8); const e4 = p._paE; input.virt.attack = 2; run(1); delete input.virt.attack; run(4); o.halfFree = Math.round(e4 - p._paE); T.idle();
    p._paE = 5; for (let i = 0; i < 8; i++) { run(15); T.tick(); } o.halfEnd = { on: !!p.buffs.pa_half, cd: +(p.cool.pa_meta || 0).toFixed(1) };
    return o;
  });
  report('恶魔能量：进图 200；普攻命中 +4；技能施放回能量（裂地锤 30 + 恶魔唤醒额外）', E.e0 === 200 && E.atkGain === 4 && E.mineGain > 30, E);
  report('恶魔之力：复仇者技能中按 X 放残影（−30、打中）；普攻中不放', E.devil.cost === 30 && E.devil.hit && E.devilBasic === 0, { devil: E.devil, basic: E.devilBasic });
  report('半魔化：能量不足 200 放不了；变身后普攻换表、冷却暂停；能量每 1.29 秒 −15；恶魔之力免费；归零解除后冷却才开始转', typeof E.metaLow === 'string' && E.half && E.metaCdOn && E.drain >= 30 && E.drain <= 45 && E.halfFree === 0 && !E.halfEnd.on && E.halfEnd.cd > 2.5, E);
  // 2) 魔化
  const D = await page.evaluate(() => {
    const { p, run, reset, mob } = T, o = {};
    reset(); castSkill(p, 'pa_awaken'); run(10); o.invulCast = p.act && p.act.invul === true; T.until(() => p.buffs.pa_demon, 200); T.idle(); T.tick();
    const B = p.buffs.pa_demon; o.form = { t: Math.round(B.t), scale: p.scale, acts: p.acts.atk1 === PA_ACTS_DEMON.atk1, sa: p.superArmor > 0, fx: !!(p._paDemonFx && fxList.includes(p._paDemonFx[1])), aspd: B.aspd, taken: B.taken };
    const g = mob(60); o.grab = applyHit(g, p, { dmg: 10, grab: true }) === false;
    p.cool = {}; castSkill(p, 'p_launcher'); o.claw = p.act && p.act.skill; T.idle();
    o.ban = SKILLS.p_smasher.req(p); o.grabOk = SKILLS.p_grab.req ? SKILLS.p_grab.req(p) : true; o.exec = SKILLS.pa_execute.req(p);
    castSkill(p, 'pa_barrier'); o.barrier = p.buffs.pa_barrier && p.buffs.pa_barrier.taken; castSkill(p, 'pa_barrier'); o.barrierOff = !p.buffs.pa_barrier;
    // 恶魔版技能：死亡切割 ×2.25、冷却 ×1.6
    const rnd0 = Math.random; Math.random = () => 0.5;
    const cut = demon => { if (!demon) paDemonEnd(p); p.cool = {}; const m = mob(90); castSkill(p, 'pa_render'); const cd = p.cool.pa_render; T.idle(); m.remove = true; run(1); return [T.dmg(m), cd]; };
    const dd = cut(true); const hd = cut(false); Math.random = rnd0; o.demonRender = { dmg: +(dd[0] / hd[0]).toFixed(2), cd: +(dd[1] / hd[1]).toFixed(2) };
    o.human = { scale: p.scale, acts: p.acts.atk1 === PA_ACTS_HUMAN.atk1 };
    return o;
  });
  report('魔化：变身动画无敌；变身后 50 秒、体型 ×1.22、普攻变巨爪、全程霸体、外观特效、攻速 / 减伤', D.invulCast && D.form.t >= 49 && D.form.scale === 1.22 && D.form.acts && D.form.sa && D.form.fx && D.form.aspd > 0 && D.form.taken < 0, D.form);
  report('魔化：不能被抓；空斩打键 → 恶魔之爪；虎袭等基础技能不能用、恶魔之手能用；审判能用；恶魔屏障 −60% / 再按取消', D.grab && D.claw === 'pa_claw' && typeof D.ban === 'string' && D.grabOk === true && D.exec === true && D.barrier === -0.6 && D.barrierOff, D);
  report('恶魔版技能：死亡切割伤害 ×2.25、冷却 ×1.6；解除后体型 / 普攻复原', Math.abs(D.demonRender.dmg - 2.25) < 0.1 && Math.abs(D.demonRender.cd - 1.6) < 0.02 && D.human.scale === 1 && D.human.acts, { render: D.demonRender, human: D.human });
  // 3) 化魔改写 / 再按魔化 / 恶之再临
  const R = await page.evaluate(() => {
    const { p, run, reset, mob } = T, o = {};
    reset(); T.demon(); p.buffs.pa_demon.t = 30; p.cool.pa_awaken = 100; castSkill(p, 'p_rapture'); run(1); o.rapture = { t: +p.buffs.pa_demon.t.toFixed(1), cd: Math.round(p.cool.pa_awaken), auto: p._paAuto };
    const e0 = p._paE = 100; for (let i = 0; i < 40; i++) { run(15); T.tick(); } o.autoGain = Math.round(p._paE - e0) > 60;   // 10 秒里自动施放 1 次（第一次手动放完冷却 8 秒）
    // 冷却中再按魔化 = 解除
    p.cool.pa_awaken = 50; castSkill(p, 'pa_awaken'); run(2); o.cancel = !p.buffs.pa_demon && p.scale === 1;
    // 冷却好了再按 = 周身伤害 + 时间重置
    reset(); T.demon(); p.buffs.pa_demon.t = 10; const m = mob(120); castSkill(p, 'pa_awaken'); T.idle(); o.reset = { t: Math.round(p.buffs.pa_demon.t), cd: Math.round(p.cool.pa_awaken), hit: T.dmg(m) > 0 };
    // 恶之再临：魔化中受到致命伤害 → 变回人形、回复 30%
    p.hp = p.hpMax * 0.1; const k = mob(60); applyHit(k, p, { dmg: 1e9, sure: true }); run(2); o.rebirth = { dead: p.dead, demon: !!p.buffs.pa_demon, hp: +(p.hp / p.hpMax).toFixed(2), cd: Math.round(p.cool.pa_rebirth || 0) };
    return o;
  });
  report('化魔（复仇者）：魔化 +7.3 秒、魔化冷却 −21 秒；第一次手动放完以后每 8 秒自动（能量一直涨）', Math.abs(R.rapture.t - 37.3) < 0.2 && R.rapture.cd === 79 && R.rapture.auto && R.autoGain, R);
  report('魔化：冷却中再按 = 解除；冷却好了再按 = 周身伤害并把时间重置到 50 秒', R.cancel && R.reset.t >= 49 && R.reset.cd > 100 && R.reset.hit, R);
  report('恶之再临：魔化中受到致命伤害不死、变回人形、HP 回到 30%、冷却 145 秒', !R.rebirth.dead && !R.rebirth.demon && R.rebirth.hp >= 0.3 && R.rebirth.cd === 145, R.rebirth);
  // 4) 杂项：空中厄运之轮、受击中复仇之刺、审判拖行、HUD、觉醒自动学会
  const M = await page.evaluate(() => {
    const { p, run, reset, mob } = T, o = {};
    reset(); p.z = 80; p.vz = 0; p.setState('jump'); o.wheelAir = castSkill(p, 'pa_wheel') && p.act && p.act.skill === 'pa_wheel'; T.idle();
    reset(); p.setState('hit'); p.stun = 0.6; o.thornHit = castSkill(p, 'pa_thorn') && p.act && p.act.skill === 'pa_thorn'; T.idle();
    reset(); T.demon(); const m = mob(90); const x0 = m.x; input.virt.right = 1; castSkill(p, 'pa_execute'); delete input.virt.right; T.until(() => !p.act, 400); run(40); o.exec = { moved: Math.round(Math.abs(m.x - x0)), dmg: T.dmg(m) > 0, cost: Math.round(400 - p._paE) };
    o.hud = paHudHook.on === true; const cv = document.createElement('canvas'); cv.width = 1920; cv.height = 1080; let err = null; try { paDrawGauge(cv.getContext('2d')); } catch (e) { err = String(e); } o.hudErr = err;
    const f = save.data.flags, lv0 = game.lvl, bar0 = [...game.skillBar]; const clear = () => { for (const id of ['pa_awaken', 'pa_execute', 'pa_barrier', 'pa_rebirth', 'pa_awaken2', 'pa_awaken3']) delete game.skillLv[id]; game.skillBar = game.skillBar.map(() => null); };
    reset(); clear(); f.awaken = f.awaken2 = f.awaken3 = false; game.lvl = 30; T.tick(); o.locked = !game.skillLv.pa_awaken;
    f.awaken = true; T.tick(); o.a1 = ['pa_awaken', 'pa_execute', 'pa_barrier', 'pa_rebirth'].map(id => game.skillLv[id] || 0); o.bar1 = ['pa_awaken', 'pa_execute', 'pa_barrier'].every(id => game.skillBar.includes(id));
    f.awaken2 = f.awaken3 = true; T.tick(); o.a23 = [game.skillLv.pa_awaken2, game.skillLv.pa_awaken3]; o.sp = [SKILLS.pa_awaken.sp, SKILLS.pa_awaken2.sp, SKILLS.pa_awaken3.sp];
    game.lvl = lv0; game.skillBar = bar0; for (const id of classSkills('priest', 'avenger')) game.skillLv[id] = Math.max(1, Math.min(SKILLS[id].maxLv || 5, 5));
    return o;
  });
  report('厄运之轮空中能放；复仇之刺受击中能放；审判（按住 →）抓住拖着跑 > 300px、耗 100 能量；HUD 恶魔能量条', M.wheelAir && M.thornHit && M.exec.moved > 300 && M.exec.dmg && M.exec.cost >= 100 && M.hud && !M.hudErr, M);
  report('觉醒：一觉前不给；一觉自动学会 魔化（Lv30 满 3 级）/ 审判 / 恶魔屏障 / 恶之再临 并放进技能栏；二 / 三觉同样；都不花 SP', M.locked && M.a1[0] === 3 && M.a1.slice(1).every(v => v === 1) && M.bar1 && M.a23.every(v => v >= 1) && M.sp.every(v => v === 0), M);
  noErr(logs, 'mech');
  await browser.close();
}

if (MODES.includes('shots')) {
  const dir = 'test/shots/avenger'; fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  const { browser, page, logs } = await launch({ width: 1280, height: 720 });
  await page.goto(`${URL_BASE}?test&cls=priest&priest=1&mobs=0&mute`); await ready(page);
  await page.evaluate(pageSetup);
  await page.evaluate(() => { for (const id of ['#ui', '#dom']) { const el = document.querySelector(id); if (el) el.style.visibility = 'hidden'; } });
  const shot = async (d, name, f, arg) => { const pos = await page.evaluate(f, arg); await page.waitForTimeout(120);
    await page.screenshot({ path: `${d}/${name}.png`, clip: { x: Math.max(0, Math.min(1280 - 640, pos.x - 220)), y: Math.max(0, Math.min(720 - 400, pos.y - 300)), width: 640, height: 400 } }); };
  // [名字, 技能, 魔化?, 等待]
  const SHOTS = [['01-devil', 'pa_render', 0, 'devil'], ['02-half', 'pa_meta', 0, 'r60'], ['03-mine-demon', 'pa_mine', 1, 'r20'], ['04-cutter', 'pa_cutter', 0, 'r50'], ['05-thorn-demon', 'pa_thorn', 1, 'r20'],
    ['06-fist', 'pa_fist', 0, 'r56'], ['07-reaper', 'pa_reaper', 0, 'r36'], ['08-gate', 'pa_gate', 0, 'r60'], ['09-disaster', 'pa_disaster', 0, 'crash'], ['10-howl-demon', 'pa_howl', 1, 'r30'],
    ['11-smite', 'pa_smite', 0, 'boom'], ['12-execute', 'pa_execute', 1, 'drag'], ['13-awaken2', 'pa_awaken2', 1, 'fin'], ['14-stream', 'pa_stream', 0, 'r88'], ['15-awaken3', 'pa_awaken3', 0, 'scythe'], ['16-demon-claw', 'atk4', 1, 'r14']];
  for (const [name, id, demon, wait] of SHOTS) await shot(dir, name, ({ id, demon, wait }) => { const { p, run, reset } = T; reset(); if (demon) T.demon(); T.four();
    if (id === 'atk4') p.doAct(p.acts.atk4); else { if (wait === 'drag') input.virt.right = 1; castSkill(p, id); delete input.virt.right; } T.until(() => !(game.timeStop > 0), 120);
    if (wait === 'devil') { run(10); input.virt.cmd = 2; run(1); delete input.virt.cmd; run(4); }
    else if (wait === 'crash') { T.until(() => p.act && p.act.boom, 400); run(4); } else if (wait === 'boom') { T.until(() => p.act && p.act.boom, 200); run(5); }
    else if (wait === 'drag') { T.until(() => p.act && p.act.gT !== undefined, 60); run(40); } else if (wait === 'fin') { T.until(() => p.act && p.act.fin, 400); run(6); }
    else if (wait === 'scythe') { T.until(() => p.act && p.act.scythe, 400); run(6); } else run(+wait.slice(1));
    return T.at(); }, { id, demon, wait });
  await page.evaluate(() => { for (const id of ['#ui', '#dom']) { const el = document.querySelector(id); if (el) el.style.visibility = ''; } });
  await shot(dir, '17-hud', () => { const { p, run, reset } = T; reset(); T.demon(); p._paE = 260; run(10); return { x: 900, y: 700 }; });
  // 魔化变身连拍（蓄力 → 插图 → 十字疤吸光 → 嘶吼炸开 → 变身完成 → 走动 → 巨爪连击 → 恶魔版技能）
  const tdir = 'test/shots/avenger_t'; fs.rmSync(tdir, { recursive: true, force: true }); fs.mkdirSync(tdir, { recursive: true });
  await page.evaluate(() => { for (const id of ['#ui', '#dom']) { const el = document.querySelector(id); if (el) el.style.visibility = 'hidden'; } T.reset(); T.mob(170); T.mob(250, {}, 40); castSkill(T.p, 'pa_awaken'); });
  const T8 = [['t1-cutin', 'r2'], ['t2-gather', 'ts'], ['t3-roar', 'buff4'], ['t4-burst', 'r14'], ['t5-demon', 'idle'], ['t6-walk', 'walk'], ['t7-claws', 'claws'], ['t8-render', 'render']];
  for (const [name, w] of T8) await shot(tdir, name, w => { const { p, run } = T;
    if (w === 'r2') run(2); else if (w === 'ts') { T.until(() => !(game.timeStop > 0), 120); run(6); } else if (w === 'buff4') { T.until(() => p.buffs.pa_demon, 60); run(3); } else if (w === 'r14') run(14);
    else if (w === 'idle') { T.idle(); run(30); } else if (w === 'walk') { for (let i = 0; i < 30; i++) { p.x -= 4; p.face = -1; run(1); } p.face = 1; run(2); }
    else if (w === 'claws') { p.doAct(p.acts.atk3); run(12); } else { T.idle(); p.cool = {}; castSkill(p, 'pa_render'); run(24); }
    return T.at(); }, w);
  try {
    const sheet = (out, d, W, H) => execFileSync('python3', ['-c', `
import sys, os
from PIL import Image, ImageDraw, ImageFont
out, W, H = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]); fs = sys.argv[4:]; cols = 4; rows = (len(fs) + cols - 1) // cols
img = Image.new('RGB', (W * cols, (H + 26) * rows), (24, 22, 30)); d = ImageDraw.Draw(img)
try: font = ImageFont.truetype('/System/Library/Fonts/STHeiti Medium.ttc', 18)
except Exception: font = None
for i, f in enumerate(fs):
    im = Image.open(f).convert('RGB'); x, y = (i % cols) * W, (i // cols) * (H + 26)
    img.paste(im, (x, y + 26)); d.text((x + 8, y + 3), f.split('/')[-1][:-4], fill=(255, 220, 150), font=font)
img.save(out, quality=82)`, out, String(W), String(H), ...fs.readdirSync(d).filter(f => f.endsWith('.png')).sort().map(f => `${d}/${f}`)]);
    sheet('test/shots/avenger.jpg', dir, 640, 400); sheet('test/shots/avenger_transform.jpg', tdir, 640, 400);
    report('截图总览 test/shots/avenger.jpg + 魔化变身连拍 test/shots/avenger_transform.jpg', fs.existsSync('test/shots/avenger.jpg') && fs.existsSync('test/shots/avenger_transform.jpg'), {});
  } catch (e) { report('截图总览', false, String(e).slice(0, 200)); }
  noErr(logs, 'shots');
  await browser.close();
}

if (MODES.includes('coop')) {
  const { coopCheck } = await import('./priest_coop_lib.mjs');
  const r = await coopCheck('avenger', async (A, B) => {
    const out = [];
    await B.evaluate(() => { const p = game.player; p.mp = p.mpMax; p.cool = {}; castSkill(p, 'pa_awaken'); });
    const on = await A.evaluate(() => new Promise(res => { let n = 0; const iv = setInterval(() => { const g = [...coop.mates.values()][0]; if ((g && g.buffs.pa_demon && g.scale > 1.2) || ++n > 80) { clearInterval(iv);
      res(g ? { demon: !!g.buffs.pa_demon, scale: g.scale, fx: !!(g._paDemonFx && fxList.includes(g._paDemonFx[1])) } : null); } }, 50); }));
    out.push(['队员魔化 → 主机那边的影子也变身（魔化 BUFF、体型 ×1.22、翼 / 角 / 暗色身体的外观）', on && on.demon && on.scale === 1.22 && on.fx, on]);
    await new Promise(r => setTimeout(r, 1500));
    await B.evaluate(() => { const p = game.player; p.cool.pa_awaken = 60; castSkill(p, 'pa_awaken'); });   // 冷却中再按 = 解除
    const off = await A.evaluate(() => new Promise(res => { let n = 0; const iv = setInterval(() => { const g = [...coop.mates.values()][0]; if ((g && !g.buffs.pa_demon) || ++n > 60) { clearInterval(iv); res(g ? { demon: !!g.buffs.pa_demon, scale: g.scale } : null); } }, 50); }));
    out.push(['队员解除魔化（没出招，靠状态同步）→ 影子也变回人形', off && !off.demon && off.scale === 1, off]);
    await B.evaluate(() => { const p = game.player; p.mp = p.mpMax; p.cool = {}; p.act = null; p.setState('idle'); castSkill(p, 'pa_gate'); });
    const gate = await A.evaluate(() => new Promise(res => { let n = 0; const iv = setInterval(() => { const g = [...coop.mates.values()][0], s = g && summonsOf(g, 'pa_gate_s')[0]; if (s || ++n > 60) { clearInterval(iv); res(s ? s.skey : null); } }, 50); }));
    out.push(['队员放地狱之门 → 主机那边的影子前面也打开地狱之门', gate === 'pa_gate_s', gate]);
    return out;
  });
  for (const [name, ok, info] of r) report(name, ok, info);
}
console.log(fail ? `${fail} 项失败` : '全部通过');
process.exit(fail ? 1 : 0);
