// 触屏测试：iPhone 13 横屏模拟（hasTouch / isMobile），用 CDP Input.dispatchTouchEvent 发真实触摸（多指、按住、滑动），不用 ?touch
// 覆盖：摇杆走 / 跑、按住攻击连打、14 个技能格（扇形 10 个 + 滑屏键 4 个方向）、觉醒键、按住蓄力、后跳键、跳跃下滑后跳、倒地点跳跃受身、
//       物品栏开 / 关（✕）、窗口拖动 / 滚动、设置 → 手机按钮（大小 / 拖动编辑）、竖屏提示暂停、双指清完一个房间、CPU 降速 ×4 的帧率
// 用法：node test/mobile.mjs [shots]   （shots：另外出一张总览图 test/shots/mobile/sheet.jpg，给主线程审）
import { chromium, devices, URL_BASE } from './lib.mjs';
import fs from 'fs';
import { execSync } from 'child_process';
const out = 'test/shots/mobile'; fs.mkdirSync(out, { recursive: true });
const SHOTS = process.argv.includes('shots');
if (SHOTS) for (const f of fs.readdirSync(out)) if (/\.(png|jpg)$/.test(f)) fs.unlinkSync(`${out}/${f}`);
const T0 = Date.now();
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--autoplay-policy=no-user-gesture-required', '--ignore-gpu-blocklist'] });
const dev = devices['iPhone 13 landscape'];
const ctx = await browser.newContext({ ...dev, viewport: { width: 844, height: 390 }, deviceScaleFactor: SHOTS ? 2 : 1 });
const page = await ctx.newPage();
const logs = [];
page.on('pageerror', e => logs.push({ type: 'pageerror', text: e.message }));
page.on('console', m => { if (m.type() === 'error') logs.push({ type: 'error', text: m.text() }); });
const cdp = await ctx.newCDPSession(page);
const wait = ms => page.waitForTimeout(ms);
let fails = 0;
const check = (ok, name, info = '') => { console.log(`${ok ? '✓' : '✗'} ${name}${info ? '  ' + info : ''}`); if (!ok) fails++; };
const ev = (fn, arg) => page.evaluate(fn, arg);
// 触摸：pts = { id: [x, y] }，每次发送当前所有按着的手指
const fingers = {};
const touch = (type) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: Object.entries(fingers).map(([id, [x, y]]) => ({ x, y, id: +id, radiusX: 4, radiusY: 4, force: 1 })) });
const down = async (id, x, y) => { fingers[id] = [x, y]; await touch('touchStart'); };
const move = async (id, x, y) => { fingers[id] = [x, y]; await touch('touchMove'); };
const up = async (id) => { const rest = { ...fingers }; delete rest[id]; for (const k in fingers) delete fingers[k]; await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: Object.entries(rest).map(([i, [x, y]]) => ({ x, y, id: +i })) }); Object.assign(fingers, rest); };
const center = async sel => { const b = await page.locator(sel).first().boundingBox(); return b ? [b.x + b.width / 2, b.y + b.height / 2] : null; };
const tap = async (sel, ms = 60, id = 5) => { const c = await center(sel); await down(id, ...c); await wait(ms); await up(id); await wait(60); };
const shot = async name => { if (SHOTS) await page.screenshot({ path: `${out}/${name}.png` }); };
const P = () => ev(() => { const p = game.player; return { x: Math.round(p.x), y: Math.round(p.y), st: p.st, act: p.act && p.act.name, face: p.face }; });

await page.goto(`${URL_BASE}?dungeon=path&lv=60&mute`);
await page.waitForFunction(() => window.__READY && game.player && game.scene === 'dungeon', null, { timeout: 30000 });
await wait(500);
check(await ev(() => touch.on && document.body.classList.contains('touchui') && !touch.el.classList.contains('hidden')), '手机自动启用触屏按键（没加 ?touch）');
// 测试用技能栏：本职业 14 个能直接放的主动技能；再备一个觉醒技能
const setup = await ev(() => {
  const p = game.player, lv = game.lvl, C = CLASSES[p.cls];
  Object.assign((save.data.flags ??= {}), { awaken: true, awaken2: true, awaken3: true });
  const ok = (id, job) => { const S = SKILLS[id]; return S && S.cls === p.cls && !S.passive && (!S.job || S.job === job) && !S.awaken && !S.airOnly && !S.whenHit && !S.req && !S.recast && !S.morph && !(S.noWtype && S.noWtype.includes(wtypeOf(p))) && S.lvReq <= lv; };
  const all = Object.keys(SKILLS), job = Object.keys(C.jobs || {}).find(j => all.filter(id => ok(id, j)).length >= 14) || null;
  const ids = all.filter(id => ok(id, job));
  game.job = job;
  ids.forEach(id => { game.skillLv[id] = Math.max(game.skillLv[id] || 0, 1); });
  game.skillBar = ids.slice(0, 14);
  while (game.skillBar.length < 14) game.skillBar.push(null);
  window.__casts = []; bus.on('skillUse', e => window.__casts.push(e.id));
  return { cls: p.cls, job, n: ids.length, bar: game.skillBar.slice() };
});
console.log('skills', setup.cls, setup.job, setup.n);
await ev(() => { for (const e of __G.ents) if (e.team === 'e') { e._x0 = e.x; e.x += 3000; e.hitstop = 1e9; } });
await wait(250);

// ---- 摇杆：轻推 = 走，推到底 = 跑 ----
const zone = await ev(() => { const r = touch.zone.getBoundingClientRect(); return [r.left + r.width * 0.45, r.top + r.height * 0.6]; });
let a = await P();
await down(1, ...zone); await move(1, zone[0] + 22, zone[1]); await wait(500);
const walk = await P();
check(walk.st === 'walk' && walk.x > a.x, '摇杆轻推 = 走', JSON.stringify(walk));
await move(1, zone[0] + 60, zone[1]); await wait(500);
const run = await P();
check(run.st === 'run', '摇杆推到底 = 跑', JSON.stringify(run));
await up(1); await wait(150);
check((await P()).st === 'idle', '松开摇杆停下');
// 快速拨两下 = 跑
await down(1, ...zone); await move(1, zone[0] - 25, zone[1]); await wait(60); await move(1, zone[0], zone[1]); await wait(60); await move(1, zone[0] - 25, zone[1]); await wait(300);
check((await P()).st === 'run', '摇杆快速拨两下 = 跑');
await up(1); await wait(150);

// ---- 按住攻击 = 连续普攻 ----
await ev(() => { window.__atk = new Set(); const p = game.player; const f = () => { if (p.act && p.act.basic) __atk.add(p.act.name); if (window.__atk) requestAnimationFrame(f); }; f(); });
const atk = await center('#touch [data-id=atk]');
await down(2, ...atk); await wait(1200); await up(2); await wait(200);
const atks = await ev(() => { const s = [...__atk]; window.__atk = null; return s; });
check(atks.length >= 2, '按住攻击 = 连续普攻', atks.join(','));

// ---- 14 个技能格：点扇形按钮 / 滑屏键四个方向 ----
const ready = () => ev(() => { const p = game.player; p.cool = {}; p.charges = {}; p.mp = p.mpMax; if (p.st !== 'idle') { p.act = null; p.setState('idle'); } p.z = 0; p.vz = 0; window.__casts = []; });
const cast = async (slot, id) => { try { await page.waitForFunction(id => __casts.includes(id), id, { timeout: 1500 }); return true; } catch { return false; } };
let castOk = 0, chargeSlot = -1;
for (let i = 0; i < 14; i++) {
  const id = setup.bar[i]; if (!id) { console.log('  slot', i, '空'); continue; }
  await ready(); await wait(80);
  if (i < 10) await tap(`#touch [data-id=k${i}]`);
  else {
    const c = await center('#touch [data-id=slide]'), d = [[0, -40], [40, 0], [0, 40], [-40, 0]][i - 10];
    await down(3, ...c); await wait(40); await move(3, c[0] + d[0] / 2, c[1] + d[1] / 2); await move(3, c[0] + d[0], c[1] + d[1]); await wait(80);
    if (i === 10) await shot('03-slide');
    await up(3);
  }
  const ok = await cast(i, id); if (ok) castOk++;
  if (ok && chargeSlot < 0 && i < 10 && await ev(() => !!(game.player.act && game.player.act.charge))) chargeSlot = i;
  if (!ok) console.log('  ✗ slot', i, id, JSON.stringify(await P()), await ev(i => { const m = ui.slotMsg[i]; return m && m.msg; }, i));
  await wait(300);
}
const used = setup.bar.filter(Boolean).length;
check(castOk === used, `点技能直接放（${castOk}/${used}，含滑屏键 4 个方向）`);
// 滑屏键：点一下 = 上次滑的方向
await ready(); await wait(80); await tap('#touch [data-id=slide]');
check(await cast(13, setup.bar[13]), '滑屏键点一下 = 上次的方向（左 = s13）');
await wait(300);

// ---- 按住技能 = 蓄力：点一下只蓄一点点，按住蓄满 ----
if (chargeSlot >= 0) {
  const sel = `#touch [data-id=k${chargeSlot}]`, K = () => ev(() => { const a = game.player.act; return a && a.charge ? +(a.chargeK || 0).toFixed(2) : null; }), k = async hold => {
    await ready(); await wait(80);
    const c = await center(sel); await down(4, ...c); await wait(hold); const k1 = await K(); await up(4); await wait(150); const k2 = await K();
    await wait(1200); return Math.max(k1 ?? -1, k2 ?? -1);
  };
  const kt = await k(30), kh = await k(500);
  check(kt >= 0 && kh > kt + 0.3, `按住技能键 = 蓄力（${setup.bar[chargeSlot]}：点一下 ${kt}，按住 ${kh}）`);
} else { console.log('  ✗ 技能栏里没有蓄力技能'); fails++; }

// ---- 冷却转圈 / MP 不足 ----
const ui = await ev(() => {
  const p = game.player, id = game.skillBar[1]; p.cool = {}; p.cool[id] = SKILLS[id].cd * 0.5; p.mp = 0; touch.refresh();
  const b = touch.el.querySelector('[data-id=k1]'), c = touch.el.querySelector('[data-id=k2]');
  return { cd: b.style.getPropertyValue('--cd'), txt: b.querySelector('.cn').textContent, nomp: c.classList.contains('nomp') || !SKILLS[game.skillBar[2]].mp, icon: /url/.test(c.style.backgroundImage) };
});
check(/[1-9]/.test(ui.cd) && ui.txt !== '' && ui.nomp && ui.icon, '按钮图标 / 冷却转圈 / MP 不足变蓝', JSON.stringify(ui));
await ev(() => { const p = game.player; p.cool = {}; p.mp = p.mpMax; });

// ---- 后跳键、跳跃下滑 = 后跳、倒地点跳跃 = 受身 ----
await ready(); await wait(80);
await tap('#touch [data-id=bs]', 60); await wait(40);
check((await P()).act === 'back', '后跳键 = 后跳');
await wait(500); await ready(); await wait(80);
const jc = await center('#touch [data-id=jump]');
await ev(() => { touch.jumpWait = 400; });   // CDP 发事件有延迟，测试里放宽判定窗口（真机 90ms）
await down(5, ...jc); await move(5, jc[0], jc[1] + 25); await wait(60); await up(5); await wait(40);
await ev(() => { touch.jumpWait = 90; });
check((await P()).act === 'back', '跳跃键往下滑 = 后跳');
await wait(500); await ready(); await wait(80);
await tap('#touch [data-id=jump]', 50); await wait(60);
check((await P()).st === 'jump', '点跳跃 = 跳');
await wait(700);
await ev(() => { const p = game.player; p.reboundCd = 0; p.act = null; p.setState('down'); p.z = 0; p.vz = 0; });
await wait(120); await tap('#touch [data-id=jump]', 50); await wait(60);
check(await ev(() => game.player.reboundCd > 0), '倒地时点跳跃 = 受身');
await wait(600);

// ---- 觉醒键：技能栏里有觉醒技能时出现（金框），按下 = 那一格 ----
const aw = await ev(() => {
  const p = game.player, id = Object.keys(SKILLS).find(k => SKILLS[k].awaken && SKILLS[k].cls === p.cls && (!SKILLS[k].job || SKILLS[k].job === game.job)); if (!id) return null;
  game.skillLv[id] = 1; (save.data.flags ??= {}).awaken = true; game.skillBar[9] = id;
  return id;
});
if (aw) {
  await wait(250); await ready(); await wait(80);
  const vis = await ev(() => !touch.el.querySelector('[data-id=aw0]').classList.contains('hidden'));
  await tap('#touch [data-id=aw0]');
  const ok = await cast(9, aw);
  check(vis && ok, '觉醒键出现并能放觉醒', aw);
  await wait(2500); await ev(() => { game.cutin = null; });
}

// ---- 菜单：物品栏打开 / 触屏按键隐藏 / 拖动窗口 / ✕ 关闭；技能窗口触摸滚动 ----
await ev(() => { const p = game.player; if (p.st !== 'idle') { p.act = null; p.setState('idle'); } });
await tap('#touch .tcol >> nth=1');
await wait(200);
check(await ev(() => menus.isOpen('inv') && touch.el.classList.contains('hidden')), '点「物品」打开物品栏，虚拟按键隐藏');
const hd = await center('.win .hd');
const w0 = await ev(() => document.querySelector('.win').getBoundingClientRect().left);
await down(6, hd[0] - 40, hd[1]); await move(6, hd[0] - 80, hd[1] + 10); await move(6, hd[0] - 140, hd[1] + 20); await up(6); await wait(100);
const w1 = await ev(() => document.querySelector('.win').getBoundingClientRect().left);
check(Math.abs(w1 - w0) > 40, '手指拖动窗口标题栏', `${Math.round(w0)} → ${Math.round(w1)}`);
await shot('04-bag');
await tap('.win .hd .x'); await wait(200);
check(await ev(() => !menus.isOpen('inv') && menus.stack.length === 0), '点 ✕ 关闭物品栏');
await wait(150);
check(await ev(() => !touch.el.classList.contains('hidden')), '关掉窗口后虚拟按键回来');
await tap('#touch .tcol >> nth=2'); await wait(300);
const sc = await ev(() => { const L = [...document.querySelectorAll('.win *')].filter(e => e.scrollHeight > e.clientHeight + 20 && /auto|scroll/.test(getComputedStyle(e).overflowY)); const e = L[0]; if (!e) return null; e.scrollTop = 0; const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height * 0.7, cls: e.className }; });
if (sc) {
  await down(7, sc.x, sc.y); for (let k = 1; k <= 6; k++) await move(7, sc.x, sc.y - k * 20); await up(7); await wait(300);
  const st = await ev(cls => { const e = [...document.querySelectorAll('.win *')].find(e => e.className === cls); return e ? e.scrollTop : 0; }, sc.cls);
  check(st > 20, '技能窗口可以用手指滚动', `${sc.cls} scrollTop=${st}`);
} else console.log('  （技能窗口没有需要滚动的列表，跳过滚动项）');
await ev(() => menus.closeAll()); await wait(150);

// ---- 设置 → 手机按钮：大小滑块 / 拖动编辑位置 ----
await ev(() => { menus.setTab = 'touch'; menus.open('settings'); }); await wait(250);
await shot('05-settings');
const s0 = await ev(() => touch.el.querySelector('[data-id=atk]').style.width);
await ev(() => { const r = document.querySelector('input[data-pref=touchSize]'); r.value = 1.3; r.dispatchEvent(new Event('input')); });
const s1 = await ev(() => touch.el.querySelector('[data-id=atk]').style.width);
check(parseFloat(s1) > parseFloat(s0) * 1.2, '设置里调按钮大小', `${s0} → ${s1}`);
await ev(() => { const r = document.querySelector('input[data-pref=touchSize]'); r.value = 1; r.dispatchEvent(new Event('input')); });
await tap('[data-act=touch-edit]'); await wait(200);
check(await ev(() => touch.editing && !menus.stack.length && !touch.el.classList.contains('hidden')), '「拖动调整按钮位置」进入编辑模式');
const ac = await center('#touch [data-id=atk]');
await down(8, ...ac); await move(8, ac[0] - 20, ac[1] - 10); await move(8, ac[0] - 40, ac[1] - 20); await up(8); await wait(100);
const ac2 = await center('#touch [data-id=atk]');
await tap('#touch .tedit [data-act=done]'); await wait(100);
const saved = await ev(() => uiPref('touchPos').atk);
check(ac2[0] < ac[0] - 30 && saved && !(await ev(() => touch.editing)), '编辑模式拖动攻击键并保存', JSON.stringify(saved));
await ev(() => { setPref('touchPos', {}); touch.applyPrefs(); });

// ---- 竖屏：提示横屏，游戏暂停 ----
await page.setViewportSize({ width: 390, height: 844 }); await wait(300);
const t1 = await ev(() => game.t); await wait(300);
const rot = await ev(t1 => ({ show: getComputedStyle(document.getElementById('rotate')).display !== 'none', paused: game.t === t1 }), t1);
check(rot.show && rot.paused, '竖屏显示“请横过来”并暂停', JSON.stringify(rot));
await shot('06-portrait');
await page.setViewportSize({ width: 844, height: 390 }); await wait(300);

// ---- 双指清完一个房间：左手摇杆追最近的怪，右手按住攻击 / 点技能 ----
await ev(() => { for (const e of __G.ents) if (e.team === 'e' && e._x0 !== undefined) { e.x = e._x0; e.hitstop = 0; } const p = game.player; p.hp = p.hpMax; });
const t0 = Date.now(); let atkDown = false, stickOn = false;
while (Date.now() - t0 < 25000) {
  const s = await ev(() => { const p = game.player, L = __G.ents.filter(e => e.team === 'e' && !e.dead && e.hp > 0); if (!L.length || game.dungeon.room.cleared) return null; L.sort((a, b) => Math.abs(a.x - p.x) - Math.abs(b.x - p.x)); const e = L[0]; p.hp = p.hpMax; p.mp = p.mpMax; return { dx: e.x - p.x, dy: e.y - p.y, n: L.length }; });
  if (!s) break;
  const near = Math.abs(s.dx) < 70 && Math.abs(s.dy) < 18;
  const jx = near ? 0 : Math.sign(s.dx) * 45, jy = Math.abs(s.dy) > 12 ? Math.sign(s.dy) * 30 : 0;
  if (jx || jy) { if (!stickOn) { await down(1, ...zone); stickOn = true; } await move(1, zone[0] + jx, zone[1] + jy); }
  else if (stickOn) { await up(1); stickOn = false; }
  if (near && !atkDown) { if (Math.random() < 0.3) { const k = Math.floor(Math.random() * 10); const c = await center(`#touch [data-id=k${k}]`); await down(9, ...c); await wait(50); await up(9); } await down(2, ...atk); atkDown = true; }
  else if (!near && atkDown) { await up(2); atkDown = false; }
  if (near && stickOn === false && atkDown) { const f = await ev(() => game.player.face); if (Math.sign(s.dx) !== f) { await down(1, ...zone); await move(1, zone[0] + Math.sign(s.dx) * 20, zone[1]); await wait(50); await up(1); } }
  await wait(120);
  if (SHOTS && !fs.existsSync(`${out}/02-fight.png`) && Date.now() - t0 > 1500) await shot('02-fight');
}
if (atkDown) await up(2); if (stickOn) await up(1);
check(await ev(() => game.dungeon.room.cleared), `双指（摇杆 + 攻击）清完房间`, `${((Date.now() - t0) / 1000).toFixed(1)}s`);

// ---- 性能：CPU 降速 ×4 打怪时的帧率（下一个房间） ----
await ev(() => { const p = game.player; for (let i = 0; i < 6; i++) spawnMonster('goblin', p.x + 150 + i * 30, 40 + (i % 3) * 40); });
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
await down(2, ...atk); await wait(800);
const f0 = await ev(() => { window.__fr = 0; const t = performance.now(); const f = () => { window.__fr++; if (performance.now() - t < 3000) requestAnimationFrame(f); }; requestAnimationFrame(f); return t; });
await wait(3100);
const fr = await ev(() => window.__fr / 3);
await up(2);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
console.log(`fps（iPhone 13 横屏模拟，CPU ×4 降速，${SHOTS ? 'DPR 2' : 'DPR 1'}，按住攻击打 6 个哥布林）: ${fr.toFixed(1)}`);
check(fr >= 25, 'CPU ×4 降速下帧率 ≥ 25', fr.toFixed(1));

if (SHOTS) {
  // 城镇截图 + 拼总览图
  await page.goto(`${URL_BASE}?town&mute`); await page.waitForFunction(() => window.__READY && game.scene === 'town', null, { timeout: 30000 }); await wait(1200);
  await shot('01-town');
  const files = ['01-town', '02-fight', '03-slide', '05-settings', '06-portrait'].map(n => `${out}/${n}.png`).filter(f => fs.existsSync(f));
  execSync(`python3 - ${files.join(' ')} <<'EOF'
import sys
from PIL import Image, ImageDraw, ImageFont
fs = sys.argv[1:]; ims = [Image.open(f).convert('RGB') for f in fs]
W = 844; rows = []
for im in ims:
    if im.width < im.height: im = im.resize((int(390 * im.width / im.height), 390))
    else: im = im.resize((W, int(W * im.height / im.width)))
    rows.append(im)
land = [r for r in rows if r.width >= r.height]; port = [r for r in rows if r.width < r.height]
cols = 2; lh = land[0].height; n = len(land); rw = (n + cols - 1) // cols
sheet = Image.new('RGB', (cols * W + (port[0].width + 10 if port else 0) + 10, rw * (lh + 26) + 10), (20, 16, 12))
d = ImageDraw.Draw(sheet); font = ImageFont.truetype('/System/Library/Fonts/STHeiti Medium.ttc', 18)
names = {'01-town': '城镇', '02-fight': '地下城战斗', '03-slide': '滑屏键（技能 11-14）', '05-settings': '设置 → 手机按钮', '06-portrait': '竖屏提示'}
li = 0
for f, im in zip(fs, rows):
    key = f.split('/')[-1][:-4]
    if im.width >= im.height:
        x = 5 + (li % cols) * (W + 5); y = 5 + (li // cols) * (lh + 26); sheet.paste(im, (x, y + 22)); d.text((x + 4, y), names.get(key, key), fill=(255, 232, 168), font=font); li += 1
    else:
        x = cols * (W + 5) + 5; sheet.paste(im, (x, 27)); d.text((x + 4, 5), names.get(key, key), fill=(255, 232, 168), font=font)
sheet.save('${out}/sheet.jpg', quality=85)
EOF`);
  console.log('总览图', `${out}/sheet.jpg`);
}
const errs = logs.filter(l => l.type === 'pageerror');
check(!errs.length, '没有页面报错', errs.slice(0, 3).map(e => e.text).join(' | '));
console.log(`用时 ${((Date.now() - T0) / 1000).toFixed(1)}s，${fails ? fails + ' 项失败' : '全部通过'}`);
await browser.close();
process.exit(fails ? 1 : 0);
