// 格斗家（男）原装帧的游戏内连拍（docs/FIGHTER_ART_SAMPLES.md）：测试房间 ?fighter=1，左边站一个鬼剑士，两人喂同一套输入（站立 / 双击跑 / 普攻 4 段 / 跳 + 空中踢），比比例和节奏。
// 停掉 rAF，逐个 60Hz 逻辑步驱动，从世界画布（RS 倍分辨率）裁图，每格标出两人当前画的帧名。先 node build.mjs --offline。
//   node art/tools/fighter_shots.mjs [输出目录，默认 art/work/fighter_samples]   → engine_{idle,run,combo,jump,clips}.jpg
//   node art/tools/fighter_shots.mjs --town [输出目录]   城镇（赫顿玛尔）里走路：格斗家 / 鬼剑士各开一个页面、同一个位置同一套输入，每 5 步（走路 12fps 一帧）截一格（1 倍像素）
//                                                      → <输出目录>/.town/{f,s}<i>.png，再 python3 art/tools/fighter_art.py town <前缀> 拼成 1 倍 / 4 倍对比图
import { launch, URL_BASE } from '../../test/lib.mjs';
import fs from 'fs';
const TOWN = process.argv.includes('--town'), argv = process.argv.slice(2).filter(a => a !== '--town');
const out = argv[0] || new URL('../work/fighter_samples', import.meta.url).pathname; fs.mkdirSync(out, { recursive: true });
if (TOWN) {
  const shoot = async cls => {
    const { browser, page, logs } = await launch({ width: 1280, height: 720 });
    await page.goto(`${URL_BASE}?town&mute&cls=${cls}&fighter=1`); await page.waitForFunction(() => window.__READY, null, { timeout: 180000 });
    const urls = await page.evaluate(async () => {
      if (game.scene === 'town') { await enterScene('hendon_myre', { x: 1100, y: 110, face: 1 }); await new Promise(r => setTimeout(r, 300)); }
      window.requestAnimationFrame = () => 0; await new Promise(r => setTimeout(r, 150));
      if (typeof menus !== 'undefined') for (const k of ['help', 'title']) if (menus.isOpen && menus.isOpen(k)) menus.close(k);
      const p = game.player; p.x = 1100; p.y = 110; p.face = 1; const L = [];
      const st = (held) => { input.virt = {}; for (const k of held) input.virt[k] = 1; step(1 / 60); renderWorld(); };
      for (let i = 0; i < 20; i++) st([]);
      for (let i = 0; i < 80; i++) {
        st(['right']);
        if (i >= 40 && i % 5 === 0) {
          const X = sx(p.x), Y = sy(p.y, 0), cw = 110, ch = 150, [cv, x] = offCanvas(cw, ch);
          x.drawImage(wcan, (X - 55) * RS, (Y - 136) * RS, cw * RS, ch * RS, 0, 0, cw, ch); L.push(cv.toDataURL('image/png'));
        }
      }
      return L;
    });
    const errs = logs.filter(l => l.type === 'pageerror'); await browser.close(); return { urls, errs: errs.length };
  };
  const F = await shoot('fighter'), S = await shoot('sword');
  const tmp = `${out}/.town`; fs.mkdirSync(tmp, { recursive: true });
  [['f', F.urls], ['s', S.urls]].forEach(([k, L]) => L.forEach((u, i) => fs.writeFileSync(`${tmp}/${k}${i}.png`, Buffer.from(u.split(',')[1], 'base64'))));
  console.log(JSON.stringify({ fighter: F.urls.length, sword: S.urls.length, errors: F.errs + S.errs, tmp }));
  process.exit(0);
}
const { browser, page, logs } = await launch({ width: 1280, height: 720 });
await page.goto(`${URL_BASE}?test&mute&cls=fighter&fighter=1&mobs=0`); await page.waitForFunction(() => window.__READY, null, { timeout: 180000 });
const info = await page.evaluate(async () => {
  window.requestAnimationFrame = () => 0; await new Promise(r => setTimeout(r, 150));
  if (typeof menus !== 'undefined') for (const k of ['help', 'title']) if (menus.isOpen && menus.isOpen(k)) menus.close(k);
  await loadBundles(['spr:sword']);
  for (const e of ents) if (e.team === 'e') e.remove = true;
  const p = game.player; p.x = 520; p.y = 110; p.face = 1; p.mpMax = p.mp = 9999;
  const g = makePlayer('sword', { team: 'p', pad: new Pad(), kit: { bar: [], lv: {}, job: null, wtype: null }, name: '鬼剑士' });
  g.x = p.x - 95; g.y = p.y - 2; g.face = 1; g.hp = g.hpMax = 99999; g.control = (e, dt) => { e.pad.frame(game.t); playerControl(e, dt); };
  ents.push(g); window.__g = g; window.__crops = {};
  cam.x = clamp(p.x - WW / 2, game.room.x0, game.room.x1 - WW);
  window.__st = (held, press, gheld, gpress, seg) => {
    input.virt = {}; for (const k of held) input.virt[k] = 1; for (const k of press) input.virt[k] = 2;
    for (const k of gheld) __g.pad.hold(k); for (const k of gpress) __g.pad.tap(k);
    step(1 / 60); renderWorld();
    if (!seg) return;
    const p = game.player, x0 = Math.min(sx(p.x), sx(__g.x)) - 70, y0 = sy(p.y, 0) - 150, cw = 300, ch = 170;
    const [cv, x] = offCanvas(cw * RS, ch * RS); x.drawImage(wcan, x0 * RS, y0 * RS, cw * RS, ch * RS, 0, 0, cw * RS, ch * RS);
    x.fillStyle = 'rgba(0,0,0,.55)'; x.fillRect(0, 0, cw * RS, 22); x.fillStyle = '#fff'; x.font = `${11 * RS}px sans-serif`;
    const m = p.model, f = m.frameOf ? m.frameOf(p.pose) : '?', gf = __g.model.frameOf ? __g.model.frameOf(__g.pose) : '?';
    x.fillText(`fighter:${f}  sword:${gf}`, 4, 10 * RS);
    (__crops[seg] = __crops[seg] || []).push(cv);
  };
  window.__sheet = (seg, cols) => {
    const L = __crops[seg] || []; const cw = L[0].width, ch = L[0].height, rows = Math.ceil(L.length / cols), [cv, x] = offCanvas(cw * Math.min(cols, L.length), ch * rows);
    L.forEach((c, i) => x.drawImage(c, (i % cols) * cw, Math.floor(i / cols) * ch)); return cv.toDataURL('image/jpeg', 0.84);
  };
  return { spr: !!SPR_DATA.fighter, frames: SPR_DATA.fighter ? Object.keys(SPR_DATA.fighter.frames).length : 0, model: p.model.constructor.name, RS };
});
console.log(info);
const S = (n, o = {}) => page.evaluate(({ n, o }) => {
  for (let i = 0; i < n; i++) __st(o.held || [], i === 0 ? (o.press || []) : [], o.gheld || [], i === 0 ? (o.gpress || []) : [], o.every && i % o.every === (o.at || 0) ? o.seg : null);
}, { n, o });
await S(30);
await S(1, { seg: 'idle', every: 1 });
await S(1, { press: ['right'], gpress: ['right'] }); await S(3);
await S(36, { held: ['right'], press: ['right'], gheld: ['right'], gpress: ['right'], seg: 'run', every: 3, at: 2 });
await S(30);
for (let i = 0; i < 4; i++) await S(10, { press: ['attack'], gpress: ['attack'], seg: 'combo', every: 2 });
await S(20, { seg: 'combo', every: 4 });
await S(20);
await S(1, { press: ['jump'], gpress: ['jump'] }); await S(9);
await S(1, { press: ['attack'], gpress: ['attack'], seg: 'jump', every: 1 }); await S(40, { seg: 'jump', every: 5 });
for (const [seg, cols] of [['idle', 1], ['run', 6], ['combo', 6], ['jump', 5]]) {
  const url = await page.evaluate(({ seg, cols }) => __sheet(seg, cols), { seg, cols });
  fs.writeFileSync(`${out}/engine_${seg}.jpg`, Buffer.from(url.split(',')[1], 'base64'));
}
// 全部片段：SPR_ANIMS.fighter 的每个片段按时间轴（循环片段按帧）让真正的 SpriteModel 选帧，查“选到的帧 = 表里写的帧、帧图已加载”，并画一张总览（一行一个片段）
const clips = await page.evaluate(() => {
  const A = SPR_ANIMS.fighter, S = SPR_DATA.fighter, names = Object.keys(A), rows = [], bad = [], used = new Set();
  for (const c of names) {
    const a = A[c], want = a.frames ? a.frames.map((f, i) => [f, (i + 0.5) / a.fps]) : a.map(([f, t0], i) => [f, t0 + 0.001]);
    const got = want.map(([f, t]) => { const m = new SpriteModel('fighter', SPR_FALLBACK, A); return [f, m.frameOf({ __c: c, __t: t, __n: c }), m, t]; });
    for (const [f, g] of got) { used.add(g); if (f !== g || !S.frames[g] || !IMG[`spr/fighter/${g}`]) bad.push(`${c}:${f}→${g}`); }
    rows.push([c, got]);
  }
  const cw = 170, ch = 170, cols = Math.max(...rows.map(r => r[1].length)) + 1, [cv, x] = offCanvas(cw * cols, ch * rows.length);
  x.fillStyle = '#3a3e48'; x.fillRect(0, 0, cv.width, cv.height); x.font = '13px sans-serif';
  rows.forEach(([c, got], r) => {
    x.fillStyle = '#ffe070'; x.fillText(c, 6, r * ch + 20);
    got.forEach(([f, g, m, t], i) => {
      x.save(); x.translate((i + 1) * cw + cw / 2, r * ch + ch - 14); x.scale(S.res * 0.75, S.res * 0.75); m.draw(x, { __c: c, __t: t, __n: c }, t); x.restore();
      x.fillStyle = f === g ? '#cfe' : '#f66'; x.fillText(g, (i + 1) * cw + 4, r * ch + 16);
    });
  });
  const all = Object.keys(S.frames), unused = all.filter(f => !used.has(f));
  return { clips: names.length, frames: all.length, bad, unused, url: cv.toDataURL('image/jpeg', 0.84) };
});
fs.writeFileSync(`${out}/engine_clips.jpg`, Buffer.from(clips.url.split(',')[1], 'base64'));
console.log(JSON.stringify({ clips: clips.clips, frames: clips.frames, bad: clips.bad, unusedByBaseClips: clips.unused }));
const errs = logs.filter(l => l.type === 'pageerror' || l.type === 'error');
console.log('errors', errs.length, errs.slice(0, 3).map(e => e.text.slice(0, 200)));
await browser.close();
