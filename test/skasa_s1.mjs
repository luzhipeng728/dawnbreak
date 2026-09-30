// S1 机制样板：斯卡萨之巢（docs/BOSS_PLAN.md §4.3）。node test/skasa_s1.mjs [sheet,run]
//   sheet  领主房里逐招放一遍（AI 不自己出招），每招在预警 / 生效最清楚的时刻截一帧，拼成总览图 test/shots/skasa_s1/contact.jpg
//          招式：前爪拍地（跳起躲）、咬、极寒龙息（扇形）、吹气（推开 + 眩晕）、龙蛋（孵化前打碎）、蓄力龙息（打断 → 破招 / 打不断 → 大范围龙息）、起飞（冰雨 + 落地）、场地缩小
//   run    同一个领主房让领主正常出招、机器人（Lv44 全身 +12 史诗）打 40 秒，每 4 秒一帧拼成 run.jpg，统计招式 / 机制 / 解开 / 失败（MS_EVENTS）
import { launch, URL_BASE } from './lib.mjs';
import { execFileSync } from 'child_process';
import fs from 'fs';
const parts = (process.argv[2] || 'sheet,run').split(',');
const out = 'test/shots/skasa_s1'; fs.mkdirSync(out, { recursive: true });
const speed = +(process.env.SPEED || 2);
let fail = 0;
const check = (ok, msg, d) => { console.log(ok ? '✓' : '✗', msg, !ok && d !== undefined ? JSON.stringify(d).slice(0, 300) : ''); if (!ok) fail++; return ok; };
const { browser, page, logs } = await launch({ width: 1280, height: 720 });
const simWait = s => page.waitForTimeout(Math.round(s * 1000 / speed) + 40);
// 把一组截图拼成总览图（每张下面写招式名）
function sheet(file, frames, cols = 3) {
  const py = `
import json, sys
from PIL import Image, ImageDraw, ImageFont
F = json.loads(sys.argv[1]); cols = int(sys.argv[3]); w, h = 640, 360
rows = (len(F) + cols - 1) // cols; S = Image.new('RGB', (cols * w, rows * (h + 34)), (16, 12, 20)); d = ImageDraw.Draw(S)
try: font = ImageFont.truetype('/System/Library/Fonts/Hiragino Sans GB.ttc', 22)
except Exception: font = ImageFont.load_default()
for i, (p, label) in enumerate(F):
  im = Image.open(p).convert('RGB').resize((w, h)); x, y = (i % cols) * w, (i // cols) * (h + 34); S.paste(im, (x, y)); d.text((x + 10, y + h + 4), label, fill=(255, 230, 150), font=font)
S.save(sys.argv[2], quality=82)`;
  execFileSync('python3', ['-c', py, JSON.stringify(frames), file, String(cols)]);
}
await page.goto(`${URL_BASE}?test&mute&mon=msLab`); await page.waitForFunction(() => window.__READY, null, { timeout: 30000 });
// 领主房：斯卡萨之巢的最后一个房间，Lv44 全身 +12 史诗（和 region.mjs bot 同一个口径）
const setup = async freeze => page.evaluate(async ({ s, freeze }) => {
  game.speedMul = s; const D = DUNGEONS.skasa_nest; await loadBundles(dungeonBundles(D));
  testLoadout(44); const p = game.player;
  for (const sl of Object.keys(SLOT_WEIGHT)) { const it = rollEquip({ slot: sl, lvl: 44, rar: 5, cls: p.cls }) || inv.equip[sl]; if (it) { it.enh = 12; inv.equip[sl] = it; } }
  recalcStats(p); save.data.fatigue = 999;
  const d = new Dungeon(D, 0); d.start(); d.enter(d.layout.boss, 'left');
  for (const e of ents) if (e.team === 'e' && e !== d.boss) e.remove = true;
  const b = window.__b = d.boss; b.x = 900; p.x = 640; p.y = 100;
  if (freeze) { const c = b.control; b.control = (e, dt) => { e.aiCd = 99; for (let i = 0; i < e.acd.length; i++) e.acd[i] = 99; if (c) c(e, dt); }; window.__keep = setInterval(() => { const q = game.player; q.hp = q.hpMax; q.mp = q.mpMax; q.dead = false; }, 50); }
  MS_EVENTS.length = 0; return { kind: b.kind, lvl: b.lvl, hp: b.hpMax, mechs: b.msMechs.map(x => x.id), skills: b.def_.attacks.map(a => a.msId || a.ms) };
}, { s: speed, freeze });

if (parts.includes('sheet')) {
  const info = await setup(true);
  console.log('斯卡萨：', JSON.stringify(info));
  check(info.kind === 'skasa' && ['claw', 'breath', 'blow', 'eggs'].every(k => info.skills.includes(k)), '领主房刷出斯卡萨，招式表有 claw / breath / blow / eggs', info);
  const frames = [];
  const cap = async (name, label) => { const f = `${out}/${name}.png`; await page.screenshot({ path: f }); frames.push([f, label]); };
  const force = (id, at = 200) => page.evaluate(({ id, at }) => { const b = __b, p = game.player; if (b.act) b.endAct(); b.stun = 0; b.setState('idle'); b.x = 900; b.z = 0; p.x = 900 - at; p.y = 100; p.status = {}; if (p.act) p.endAct(); p.setState('idle'); const i = b.def_.attacks.findIndex(a => a.msId === id || a.clip === id || a.ms === id); return monForceSkill(b, i); }, { id, at });
  const reset = () => page.evaluate(() => { groundFx.length = 0; for (const e of ents) if (e.team === 'e' && e !== __b) e.remove = true; });
  check(await force('claw', 130), '前爪拍地'); await simWait(0.6); await cap('01-claw', '前爪拍地：跳起来躲（aoe jump, sigA）'); await simWait(1.2); await reset();
  check(await force('bite', 110), '咬'); await simWait(0.5); await cap('02-bite', '咬（swipe bite）'); await simWait(1.0);
  check(await force('breath', 220), '极寒龙息'); await simWait(0.6); await cap('03-breath-tele', '极寒龙息：扇形预警（cone, sigB）'); await simWait(0.9); await cap('04-breath', '极寒龙息：喷射中，绕到侧面 / 背后躲'); await simWait(1.2); await reset();
  check(await force('blow', 160), '吹气'); await simWait(0.55); await cap('05-blow-tele', '吹气：预警圈（pull out）'); await simWait(0.6); await cap('06-blow', '吹气：推开 + 眩晕'); await simWait(1.0); await reset();
  check(await force('eggs', 300), '龙蛋'); await simWait(1.6); await cap('07-eggs', '龙蛋：12 秒内打碎，不然孵出幼龙（plant）');
  const eggs = await page.evaluate(() => ents.filter(e => e.kind === 'skasaEgg' && !e.dead).length);
  check(eggs === 3, `龙蛋 ${eggs} 个`);
  await page.evaluate(() => { const L = ents.filter(e => e.kind === 'skasaEgg' && !e.dead); L.slice(1).forEach(o => { o.invul = 0; o.hp = 1; applyHit(game.player, o, { dmg: 99, sure: true }, { proj: true }); }); L[0].msFuseT = 11.9; });
  await simWait(1.6); const hatch = await page.evaluate(() => ({ baby: ents.filter(e => e.kind === 'babySkasa' && !e.dead).length, eggs: ents.filter(e => e.kind === 'skasaEgg' && !e.dead).length }));
  await cap('08-hatch', '没打碎的龙蛋孵出了幼龙');
  await reset();
  // 第 1 阶段 → 蓄力龙息（stagger）：先打断一次，再放一次不打，看大招
  const ph1 = await page.evaluate(() => bossPhaseSet(__b, 1)); await simWait(1.2);
  await page.evaluate(() => { const st = __b.msMechs.find(s => s.id === 'stagger' && !s.done); if (st) for (let i = 0; i < 3; i++) { __b.invul = 0; applyHit(game.player, __b, { dmg: 0.2, sure: true, knock: 0, stun: 0.05, hs: 0 }, { proj: true }); } });
  await simWait(0.3); await cap('09-stagger', '蓄力龙息：头顶的打断条，打够伤害就打断（stagger）');
  const brk = await page.evaluate(async () => { const st = __b.msMechs.find(s => s.id === 'stagger' && !s.done); let n = 0; while (st && !st.done && n++ < 600) { __b.invul = 0; applyHit(game.player, __b, { dmg: 0.5, sure: true, knock: 0, stun: 0.05, hs: 0 }, { proj: true }); } await new Promise(r => setTimeout(r, 150)); return { broken: !!(st && st.broken), groggy: (__b.msMechs.find(s => s.id === 'groggy') || {}).stun > 0 }; });
  await simWait(0.4); await cap('10-stagger-break', '打断了 → 破招（眩晕 7 秒，受伤 ×1.6）');
  check(ph1 === 1 && brk.broken && brk.groggy, `蓄力龙息：打断 → 破招 ${JSON.stringify(brk)}`);
  await page.evaluate(() => { const g = __b.msMechs.find(s => s.id === 'groggy'); if (g) { g.stun = 0.01; } }); await simWait(0.5);
  const c0 = await page.evaluate(() => MS_STATS.cast.cone || 0);
  check(await force('mech', 260), '再蓄力一次（不打）'); await simWait(3.9); await cap('11-stagger-fail', '没打断 → 绝对零度龙息（120° 大扇形）');
  const c1 = await page.evaluate(() => MS_STATS.cast.cone || 0); check(c1 > c0, `没打断放出大招（扇形 +${c1 - c0}）`); await simWait(1.6); await reset();
  // 第 2 阶段 → 起飞（form）：空中冰雨，落地砸一下
  await page.evaluate(() => { const g = __b.msMechs.find(s => s.id === 'groggy'); if (g) g.stun = 0.01; });
  const ph2 = await page.evaluate(() => bossPhaseSet(__b, 2)); await simWait(1.6);
  const fly = await page.evaluate(() => ({ z: Math.round(__b.z), form: (__b.msMechs.find(s => s.id === 'form' && !s.done) || {}).id || null }));
  await page.evaluate(() => { const A = __b.def_.attacks.find(a => a.ms === 'rain' && a.msGateTok); game.player.x = __b.x - 150; monForceSkill(__b, __b.def_.attacks.indexOf(A)); }); await simWait(1.0);
  await cap('12-fly', '起飞：飞在空中放冰雨（form fly + rain）');
  check(ph2 === 2 && fly.z > 120 && fly.form === 'form', `起飞 ${JSON.stringify(fly)}`);
  await page.evaluate(() => { const st = __b.msMechs.find(s => s.id === 'form' && !s.done); if (st) st.t = st.p.dur - 0.05; }); await simWait(1.0);
  await cap('13-land', '落地：身边一圈冲击（form land）'); await simWait(1.4); await reset();
  const ph3 = await page.evaluate(() => bossPhaseSet(__b, 3)); await simWait(2.5); await cap('14-shrink', '最后阶段：巢穴崩塌，场地缩小');
  check(ph3 === 3, '第 3 阶段：场地缩小');
  sheet(`${out}/contact.jpg`, frames);
  console.log(`总览图：${out}/contact.jpg（${frames.length} 帧）`);
  console.log('孵化：', JSON.stringify(hatch)); check(hatch.baby >= 1, '到点的龙蛋孵出幼龙');
  await page.evaluate(() => clearInterval(window.__keep));
}

if (parts.includes('run')) {
  await setup(false);
  await page.evaluate(() => { bot.on = true; });
  const frames = [], T = +(process.env.RUN || 40);
  for (let t = 0; t < T; t += 4) {
    await simWait(4);
    if (t === 12) await page.evaluate(() => { __b.hp = Math.min(__b.hp, Math.round(__b.hpMax * 0.69)); });   // 推到蓄力龙息阶段
    if (t === 24) await page.evaluate(() => { __b.hp = Math.min(__b.hp, Math.round(__b.hpMax * 0.44)); });   // 推到起飞阶段
    const f = `${out}/run-${String(t + 4).padStart(2, '0')}.png`; await page.screenshot({ path: f });
    const s = await page.evaluate(() => ({ hp: Math.round(__b.hp / __b.hpMax * 100), ph: __b.msPhase, me: Math.round(game.player.hp / game.player.hpMax * 100), dead: game.dungeon.state }));
    frames.push([f, `${t + 4}s：领主 ${s.hp}%  阶段 ${s.ph}  自己 ${s.me}%  ${s.dead === 'dead' ? '倒下' : ''}`]);
  }
  const E = await page.evaluate(() => { const c = (ev, k) => { const o = {}; for (const e of MS_EVENTS) if (e.ev === ev) { const x = e[k] || '?'; o[x] = (o[x] || 0) + 1; } return o; }; return { cast: c('cast', 'sid'), castUse: c('cast', 'id'), mech: c('mech', 'id'), solve: c('solve', 'id'), fail: c('fail', 'id'), hurt: MS_EVENTS.filter(e => e.ev === 'hurt' && e.me).length, deaths: bot.deaths }; });
  sheet(`${out}/run.jpg`, frames, 5);
  console.log('实机 40 秒：', JSON.stringify(E));
  check(Object.keys(E.castUse).length >= 4, `领主自己放出 ${Object.keys(E.castUse).length} 种招式`, E);
  console.log(`实机帧：${out}/run.jpg`);
}
const errs = logs.filter(l => l.type !== 'warning' && !/素材加载失败/.test(l.text));
for (const e of errs.slice(0, 10)) console.log('ERR', e.text.slice(0, 300));
check(!errs.length, `页面报错 ${errs.length} 条`);
const fe = await page.evaluate(() => (typeof frameErrs !== 'undefined' ? frameErrs.map(e => `${e.where} ×${e.n}：${e.msg}`) : []));
check(!fe.length, `逐帧报错 ${fe.length} 条`, fe);
await browser.close();
console.log(fail ? `skasa_s1: ${fail} 项失败` : 'skasa_s1: 全部通过');
process.exit(fail ? 1 : 0);
