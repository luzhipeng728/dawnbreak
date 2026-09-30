// 调拳头区域（avatar.js avFists）用：node test/fighter_fists_debug.mjs [帧,...] → test/shots/fighter_looks/fists_debug.jpg
//   每帧三格（5 倍）：原帧 + 锚点（红 = 近侧 / 蓝 = 远侧，线 = 前臂方向）｜抹掉拳头后的帧 + 找到的拳头区域（绿）+ 拳心（黄圈，半径 = 拳头高 / 2）｜套上臂铠
import { launch, URL_BASE } from './lib.mjs';
import fs from 'fs';
import { execFileSync } from 'child_process';
const FR = (process.argv[2] || 'idle,walk3,run3,f_jab1,f_jab2,f_mid2').split(','), out = 'test/shots/fighter_looks'; fs.mkdirSync(out, { recursive: true });
const { browser, page } = await launch({ width: 800, height: 600 });
await page.goto(`${URL_BASE}?town&mute&cls=fighter&fresh`); await page.waitForFunction(() => window.__READY, null, { timeout: 120000 });
const url = await page.evaluate(async FR => {
  await loadArtKey('weapon/gauntlet');
  const S = SPR_DATA.fighter, Z = 5, cells = [];
  for (const f of FR) {
    const F = S.frames[f], im = IMG['spr/fighter/' + f], o = avFists(im, F);
    const mk = () => { const [cv, x] = offCanvas(F.w * Z, F.h * Z); x.imageSmoothingEnabled = false; return [cv, x]; };
    const [a, ax] = mk(); ax.drawImage(im, 0, 0, F.w * Z, F.h * Z);
    const [b, bx] = mk(); bx.drawImage(o ? o.im : im, 0, 0, F.w * Z, F.h * Z);
    for (const k of ['wpn', 'wpn2']) {
      const w = F[k]; if (!w) continue; const col = w.side === 'f' ? '#40a0ff' : '#ff4040';
      for (const x of [ax, bx]) { x.strokeStyle = col; x.lineWidth = 3; x.beginPath(); x.arc(w.gx * Z, w.gy * Z, 6, 0, TAU); x.moveTo(w.gx * Z, w.gy * Z); x.lineTo((w.gx + Math.cos(w.ang) * 18) * Z, (w.gy + Math.sin(w.ang) * 18) * Z); x.stroke(); }
      const t = o && o.fit[k]; if (!t) continue;
      bx.strokeStyle = '#ffe040'; bx.lineWidth = 3; bx.beginPath(); bx.arc(t.cx * Z, t.cy * Z, t.h / 2 * Z, 0, TAU); bx.stroke();
      if (t.mask) { bx.globalAlpha = 0.45; bx.drawImage(t.mask.cv, t.mask.x0 * Z, t.mask.y0 * Z, t.mask.w * Z, t.mask.h * Z); bx.globalAlpha = 1; }
    }
    const m = new SpriteModel('fighter', SPR_FALLBACK, SPR_ANIMS.fighter); avatarSetLook(m, { wpn: 'gauntlet', set: null, acc: [] }); m.frameOf = () => f;
    const [c, cx] = mk(); cx.fillStyle = '#c89a68'; cx.fillRect(0, 0, F.w * Z, F.h * Z); cx.translate(F.ax * Z, F.ay * Z); cx.scale(Z * S.res, Z * S.res); m.draw(cx, { __c: 'idle', __t: 0 }, 0, NO_OPTS);
    await new Promise(r => setTimeout(r, 50)); cx.setTransform(1, 0, 0, 1, 0, 0); cx.fillStyle = '#c89a68'; cx.fillRect(0, 0, F.w * Z, F.h * Z); cx.translate(F.ax * Z, F.ay * Z); cx.scale(Z * S.res, Z * S.res); m.draw(cx, { __c: 'idle', __t: 0 }, 0, NO_OPTS);
    cells.push([f, a, b, c]);
  }
  const W = Math.max(...cells.map(([, a]) => a.width)) * 3 + 40, H = cells.reduce((s, [, a]) => s + a.height + 24, 0);
  const [cv, x] = offCanvas(W, H); x.fillStyle = '#3a3a44'; x.fillRect(0, 0, W, H); let y = 0; x.font = 'bold 16px sans-serif';
  for (const [f, a, b, c] of cells) { x.fillStyle = '#ffe2a0'; x.fillText(f, 6, y + 17); x.drawImage(a, 0, y + 22); x.drawImage(b, a.width + 20, y + 22); x.drawImage(c, a.width * 2 + 40, y + 22); y += a.height + 24; }
  return cv.toDataURL('image/png');
}, FR);
fs.writeFileSync(`${out}/fists_debug.png`, Buffer.from(url.split(',')[1], 'base64'));
execFileSync('python3', ['-c', `from PIL import Image; im=Image.open('${out}/fists_debug.png').convert('RGB'); im.save('${out}/fists_debug.jpg', quality=85)`]); fs.rmSync(`${out}/fists_debug.png`);
console.log(`${out}/fists_debug.jpg`); await browser.close();
