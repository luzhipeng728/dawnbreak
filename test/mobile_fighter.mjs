// 手机操作 · 男格斗家（B9）：iPhone 13 横屏模拟 + CDP 真实触摸（不用 ?touch），网址带 ?fighter=1
// 覆盖：4 个转职的技能格（扇形 10 + 滑屏 4 + 觉醒键）都有图标、按钮不重叠不出屏、状态键列出本转职没放进技能栏的 Buff；
//       格斗家的指令在触屏上怎么放：空中 C（空中再点跳跃 = 空绞锤）、蹲伏（技能键）→ 攻击键肩撞 / 跳跃键起身、按住↑+Z 的前踢（技能键直接放）、
//       鹰踏（跳起后点技能键，再点一次第二踩）、跑攻中 X（推到底跑 + 攻击键 = 肩撞，再点攻击 = 疾风追击）、街霸装填数（按钮角标 ×N）、气功师风雷能量条不压住 BUFF 行
// 用法：node test/mobile_fighter.mjs [shots]（约 30 秒；shots 另出 test/shots/mobile_fighter/<转职>.png 给主线程看布局）
import { chromium, devices, URL_BASE } from './lib.mjs';
import fs from 'fs';
const out = 'test/shots/mobile_fighter'; fs.mkdirSync(out, { recursive: true });
const SHOTS = process.argv.includes('shots');
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--autoplay-policy=no-user-gesture-required', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ ...devices['iPhone 13 landscape'], viewport: { width: 844, height: 390 }, deviceScaleFactor: SHOTS ? 2 : 1 });
const page = await ctx.newPage();
const logs = [];
page.on('pageerror', e => logs.push(e.message + '\n' + (e.stack || '')));
const cdp = await ctx.newCDPSession(page);
const wait = ms => page.waitForTimeout(ms);
let fails = 0;
const check = (ok, name, info) => { console.log(`${ok ? '✓' : '✗'} ${name}${info !== undefined ? '  ' + (typeof info === 'string' ? info : JSON.stringify(info)) : ''}`); if (!ok) fails++; };
const ev = (fn, arg) => page.evaluate(fn, arg);
const fingers = {};
const send = type => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: Object.entries(fingers).map(([id, [x, y]]) => ({ x, y, id: +id, radiusX: 4, radiusY: 4, force: 1 })) });
const down = async (id, x, y) => { fingers[id] = [x, y]; await send('touchStart'); };
const move = async (id, x, y) => { fingers[id] = [x, y]; await send('touchMove'); };
const up = async id => { const pt = fingers[id]; delete fingers[id]; await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [{ x: pt[0], y: pt[1], id: +id }] }); };   // CDP 的 touchEnd 松开的是列出来的手指（列剩下的手指会把摇杆松掉）
const center = async sel => { const b = await page.locator(sel).first().boundingBox(); return b ? [b.x + b.width / 2, b.y + b.height / 2] : null; };
const tap = async (sel, ms = 60, id = 5) => { const c = await center(sel); await down(id, ...c); await wait(ms); await up(id); await wait(40); };
const P = () => ev(() => { const p = game.player; return { st: p.st, act: p.act && (p.act.skill ? p.act.skill + '/' + p.act.name : p.act.name), z: Math.round(p.z) }; });
// 等到出现某个动作（按 game.t 的帧推进，不靠墙钟）
const seen = async (re, ms = 1500) => { const t0 = Date.now(); const L = new Set(); while (Date.now() - t0 < ms) { const s = await P(); if (s.act) L.add(s.act); if (s.act && re.test(s.act)) return { ok: true, act: s.act }; await wait(25); } return { ok: false, seen: [...L] }; };

await page.goto(`${URL_BASE}?dungeon=lorien&lv=30&cls=fighter&fighter=1&mute`);
await page.waitForFunction(() => window.__READY && game.player && game.scene === 'dungeon', null, { timeout: 40000 });
await wait(500);
check(await ev(() => touch.on && game.player.cls === 'fighter'), '格斗家进地下城，手机按键自动启用');
await ev(() => { for (const e of ents) if (e.team === 'e') { e.x += 3000; e.hitstop = 1e9; } Object.assign((save.data.flags ??= {}), { awaken: true, awaken2: true, awaken3: true }); game.player.mpMax = game.player.mp = 99999; });
// 按转职摆技能栏：本转职主动技能 + 基础技能，觉醒放最后两格（和玩家自己学技能时自动填空格一样）
const setJob = (job, first = []) => ev(({ job, first }) => {
  const p = game.player; game.job = job; save.data.job = job;
  const ok = id => { const S = SKILLS[id]; return S && S.cls === 'fighter' && !S.passive && (!S.job || S.job === job) && S.lvReq <= game.lvl && (S.act || S.instant); };
  for (const id of Object.keys(SKILLS)) if (ok(id)) game.skillLv[id] = Math.max(game.skillLv[id] || 0, 1);
  const aw = Object.keys(SKILLS).filter(id => ok(id) && SKILLS[id].awaken && SKILLS[id].job === job).slice(0, 2);
  const rest = Object.keys(SKILLS).filter(id => ok(id) && !SKILLS[id].awaken && !SKILLS[id].buff && !first.includes(id)).sort((a, b) => (SKILLS[b].job ? 1 : 0) - (SKILLS[a].job ? 1 : 0));   // 转职技能在前
  game.skillBar = [...first, ...rest].slice(0, 14 - aw.length).concat(aw); while (game.skillBar.length < 14) game.skillBar.push(null);
  p.cool = {}; p.buffs = {}; p.act = null; p.setState('idle'); if (typeof applyBuffs === 'function') applyBuffs(p); p.acts = fighterActs(p); touch.refresh();
  return game.skillBar.slice();
}, { job, first });
const layout = () => ev(() => {
  const vis = [...document.querySelectorAll('#touch .tbtn')].filter(b => !b.classList.contains('hidden') && b.offsetParent !== null && getComputedStyle(b).display !== 'none');
  const R = vis.map(b => ({ id: b.dataset.id || b.textContent, r: b.getBoundingClientRect() }));
  const off = R.filter(({ r }) => r.left < -1 || r.top < -1 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1).map(x => x.id);
  const lap = []; for (let i = 0; i < R.length; i++) for (let j = i + 1; j < R.length; j++) { const a = R[i].r, b = R[j].r, w = Math.min(a.right, b.right) - Math.max(a.left, b.left), h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top); if (w > 3 && h > 3) lap.push(R[i].id + '×' + R[j].id); }
  const faces = touch.skillBtns.filter(b => !b.classList.contains('hidden')).map(b => b._id || null), pts = touch.skillBtns.find(b => b._pts)._pts.map(p => p._id || null);
  return { n: R.length, off, lap, faces, pts, aw: touch.awSlots.length, buffs: touch.buffBtns.filter(b => !b.classList.contains('hidden')).map(b => b._id) };
});

for (const job of ['grappler', 'brawler', 'nenmaster', 'striker']) {
  const bar = await setJob(job); await wait(250);
  const L = await layout();
  const own = await ev(job => Object.keys(SKILLS).filter(id => SKILLS[id].job === job && (SKILLS[id].buff) && !SKILLS[id].passive && !game.skillBar.includes(id)), job);
  check(!L.off.length && !L.lap.length, `${job}：${L.n} 个按键都在屏幕里、互不重叠`, { off: L.off, lap: L.lap.slice(0, 4) });
  check(L.faces.filter(Boolean).length >= 11 && L.pts.every(Boolean) && L.aw >= 1, `${job}：扇形 / 滑屏 4 格 / 觉醒键都有技能图标（觉醒键 ${L.aw} 个）`, { faces: L.faces, pts: L.pts });
  check(own.slice(0, 5).every(id => L.buffs.includes(id)), `${job}：状态键列出本转职没放进技能栏的 Buff（${L.buffs.join(' / ')}）`, { own, buffs: L.buffs });
  if (SHOTS) await page.screenshot({ path: `${out}/${job}.png` });
}

// ---- 柔道家：空中 C / 蹲伏 / 前踢 / 鹰踏 / 跑攻中 X ----
await setJob('grappler', ['f_crouch', 'f_hammer', 'f_airwalk', 'f_chain']); await wait(200);
await tap('#touch [data-id=jump]', 60, 3); await wait(160);
await tap('#touch [data-id=jump]', 60, 3);
const airC = await seen(/fg_airsteiner/);
check(airC.ok, '空中 C：跳起后再点跳跃键 = 空绞锤（指令 [\'\', fg_airsteiner, \'jump\']）', airC);
await wait(1500); await ev(() => { const p = game.player; p.cool = {}; p.act = null; p.z = 0; p.setState('idle'); });
await tap('#touch [data-id=k0]', 60, 4);
const cr = await seen(/f_crouch/);
await wait(150); await tap('#touch [data-id=atk]', 60, 4);
const crx = await seen(/f_crouchX/);
check(cr.ok && crx.ok, '蹲伏：点技能键蹲下，蹲着点攻击键 = 肩撞', { cr, crx });
await wait(700); await ev(() => { const p = game.player; p.cool = {}; });
await tap('#touch [data-id=k0]', 60, 4); await seen(/f_crouch/); await wait(150);
await tap('#touch [data-id=jump]', 60, 3); await wait(250);
check(!/f_crouch/.test((await P()).act || ''), '蹲伏：点跳跃键起身', await P());
await wait(400); await ev(() => { game.player.cool = {}; });
await tap('#touch [data-id=k1]', 60, 4);
const ham = await seen(/f_hammer/);
check(ham.ok, '前踢（键盘是按住↑+Z）：手机上点技能键直接放', ham);
await wait(700); await ev(() => { game.player.cool = {}; });
await tap('#touch [data-id=jump]', 60, 3); await wait(160);
await tap('#touch [data-id=k2]', 60, 4);
const aw = await seen(/f_airwalk/);
check(aw.ok, '鹰踏：跳起后点技能键（键盘是空中 Z）', aw);
await wait(1600); await ev(() => { const p = game.player; p.cool = {}; p.act = null; p.z = 0; p.setState('idle'); p.x = game.room.x0 + 120; });
const zone = await ev(() => { const r = touch.zone.getBoundingClientRect(); return [r.left + r.width * 0.45, r.top + r.height * 0.6]; });
await down(1, ...zone); await move(1, zone[0] + 60, zone[1]); await wait(450);
const running = (await P()).st === 'run';
await tap('#touch [data-id=atk]', 50, 4);
const dash = await seen(/dash/, 800);
await wait(90); await tap('#touch [data-id=atk]', 50, 4);
const chain = await seen(/fchain/, 900);
await up(1); await wait(300);
check(running && dash.ok && chain.ok, '跑攻中 X：推到底跑 + 攻击键 = 肩撞，再点攻击键 = 疾风追击', { running, dash, chain });

// ---- 街霸：装填数角标 ----
await setJob('brawler', ['fb_poison']); await wait(250);
const q0 = await ev(() => touch.skillBtns[0]._ch.textContent);
await tap('#touch [data-id=k0]', 60, 4); await wait(700); await ev(() => touch.refresh());
const q1 = await ev(() => touch.skillBtns[0]._ch.textContent);
check(/^×\d+$/.test(q0) && q1 !== q0 && +q1.slice(1) === +q0.slice(1) - 1, `街霸：毒瓶按钮显示装填数，投一次 ${q0} → ${q1}`, { q0, q1 });

// ---- 气功师：风雷能量条（触屏左上角）不压住 BUFF 行 ----
await setJob('nenmaster'); await ev(() => { game.skillLv.fn_absorb = 1; const p = game.player; p._fnE = 700; p.buffs.fn_stone = { t: 80, name: '御' }; });
await wait(400);
const gauge = await ev(() => {
  const c = document.createElement('canvas').getContext('2d'), rects = [], texts = [];
  const fr = c.fillRect.bind(c); c.fillRect = (x, y, w, h) => { rects.push([x, y, w, h]); fr(x, y, w, h); };
  const it = uiText; window.uiText = (s, x, y, o = {}) => { texts.push([s, x, y, o.size || 16]); return it(s, x, y, o); };
  const n0 = rects.length; ui.drawTouchPanel(c, game.player); const nPanel = rects.length, nt = texts.length; fnDrawGauge(c); window.uiText = it;
  const g = rects.slice(nPanel)[0], label = texts.slice(nt).find(t => /风雷/.test(t[0])), buffTimers = texts.slice(0, nt).filter(t => /^\d+$/.test(t[0]) && t[2] > 100);
  return { g, label: label && [label[1], label[2], label[3]], timers: buffTimers.map(t => [t[1], t[2], t[3]]), panelRects: nPanel - n0 };
});
const gTop = gauge.label ? gauge.label[1] - gauge.label[2] : gauge.g ? gauge.g[1] : 0, timerBottom = Math.max(134, ...gauge.timers.map(t => t[1] + 3));
check(gauge.g && gauge.label && gTop >= timerBottom, `气功师：风雷能量条和“风雷 N”字（最上 y=${gTop}）在 BUFF 行 / 倒计时（到 y≈${timerBottom}）下面，不重叠`, gauge);
if (SHOTS) await page.screenshot({ path: `${out}/nenmaster-gauge.png` });

check(!logs.length, '没有页面报错', logs.slice(0, 3));
await browser.close();
console.log(fails ? `\n${fails} 项失败` : '\n全部通过');
process.exit(fails ? 1 : 0);
