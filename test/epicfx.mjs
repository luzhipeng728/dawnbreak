// 史诗掉落演出：落地金色闪屏 + 光柱爆闪 + 星芒 + 专属音效（带混响）；设置 → 声音 → 史诗掉落音效（本地自定义文件）
// 用法：node build.mjs && node test/epicfx.mjs
import { launch, URL_BASE } from './lib.mjs';
import fs from 'fs';
const out = 'test/shots/epicfx'; fs.mkdirSync(out, { recursive: true });
const { browser, page, logs } = await launch({ width: 1280, height: 720 });
const wait = ms => page.waitForTimeout(ms), ev = (fn, arg) => page.evaluate(fn, arg);
let fails = 0;
const check = (ok, msg, extra = '') => { console.log(ok ? '  ✓' : '  ✗', msg, extra); if (!ok) fails++; };
await page.goto(`${URL_BASE}?town&fresh&cls=sword`);
await page.waitForFunction(() => window.__READY && game.player && game.scene === 'town', null, { timeout: 30000 });
await page.mouse.click(640, 360); await wait(300);   // 让浏览器允许出声（sfx.ok）
await ev(() => { sfx.init(); while (menus.stack.length) menus.close(menus.stack[menus.stack.length - 1]); save.data.fatigue = FATIGUE_MAX; return enterDungeon('lorien', 0); });
await page.waitForFunction(() => game.scene === 'dungeon' && game.room, null, { timeout: 20000 });
await wait(600);
// 1. 内置：出现时上冲音、落地时闪屏 + 大音效（统计实际发声的声部数）
const r1 = await ev(async () => {
  for (const m of game.monsters || []) m.hp = 0;
  const p = game.player, D = Object.values(ITEMS).find(D => D.kind === 'equip' && D.rar === 5);
  let voices = 0; const t0 = sfx.tone.bind(sfx), n0 = sfx.noise.bind(sfx);
  sfx.tone = (...a) => { voices++; return t0(...a); }; sfx.noise = (...a) => { voices++; return n0(...a); };
  const d = spawnDrop({ item: makeItem(D.key), x: p.x + 120, y: p.y, z: 30 }); d.vx = 0; d.vy = 0;
  const rise = voices; let flash = 0;
  for (let i = 0; i < 80 && d.landT == null; i++) await new Promise(r => setTimeout(r, 16));
  flash = cam.flash;
  return { ok: sfx.ok, rise, total: voices, landed: d.landT != null, flash, col: cam.flashCol, rev: !!sfx.revIn };
});
check(r1.ok, '音频已启用');
check(r1.rise >= 3, `史诗蹦出时播上冲音（${r1.rise} 个声部）`);
check(r1.landed && r1.total - r1.rise >= 20 && r1.rev, `落地播史诗音效（${r1.total - r1.rise} 个声部，带混响）`);
check(r1.flash > 0.05 && r1.col === '#ffe7a0', `落地金色闪屏 flash=${r1.flash.toFixed(2)}`);
await page.screenshot({ path: `${out}/1_land.png` });
await wait(700); await page.screenshot({ path: `${out}/2_pillar.png` });
// 2. 一次爆多件只响一次
const r2 = await ev(() => { let n = 0; const t0 = sfx.tone.bind(sfx); sfx.tone = (...a) => { n++; return t0(...a); }; gearSfx.lastEpic = 0; gearSfx.epicDrop(); const a = n; gearSfx.epicDrop(); gearSfx.epicDrop(); return { a, b: n }; });
check(r2.a > 10 && r2.b === r2.a, `连续三件只响一次（${r2.a} → ${r2.b}）`);
// 3. 设置里的自定义音效：写入本地 wav → 解码 → 落地时播放它，不再播内置
await ev(() => menus.open('settings', { tab: 'sound' })); await wait(300);
check(await page.locator('[data-epicsnd]').count() === 1, '设置 → 声音 有“史诗掉落音效”一行');
await page.screenshot({ path: `${out}/3_settings.png` });
const r3 = await ev(async () => {
  const sr = 8000, n = 1600, b = new ArrayBuffer(44 + n * 2), v = new DataView(b), w = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.sin(i / sr * 2 * Math.PI * 880) * 8000, true);
  let s = ''; new Uint8Array(b).forEach(x => s += String.fromCharCode(x));
  localStorage.setItem(EPIC_SND_KEY, 'data:audio/wav;base64,' + btoa(s)); localStorage.setItem(EPIC_SND_KEY + '_name', 'test.wav');
  epicSnd.load(); for (let i = 0; i < 50 && !epicSnd.buf; i++) await new Promise(r => setTimeout(r, 20));
  let n2 = 0, played = 0; const t0 = sfx.tone.bind(sfx), p0 = epicSnd.play.bind(epicSnd);
  sfx.tone = (...a) => { n2++; return t0(...a); }; epicSnd.play = () => { played++; return p0(); };
  gearSfx.lastEpic = 0; gearSfx.epicRise(); gearSfx.epicDrop();
  const r = { buf: !!epicSnd.buf, dur: epicSnd.buf && epicSnd.buf.duration, played, synth: n2 };
  epicSnd.clear(); r.cleared = !epicSnd.load(); return r;
});
check(r3.buf && Math.abs(r3.dur - 0.2) < 0.02, `本地音频解码成功（${r3.dur && r3.dur.toFixed(2)} 秒）`);
check(r3.played === 1 && r3.synth === 0, `落地改播自定义音效，不再播内置（自定义 ${r3.played} 次，内置声部 ${r3.synth}）`);
check(r3.cleared, '恢复内置后清掉本地文件');
const errs = logs.filter(l => /error/i.test(l)); check(errs.length === 0, '没有报错', errs.slice(0, 3).join(' | '));
await browser.close();
console.log(fails ? `✗ ${fails} 项失败` : '✓ 全部通过'); process.exit(fails ? 1 : 0);
