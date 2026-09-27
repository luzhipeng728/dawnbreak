// 外观放大图（人工验收用）：node test/avatar_zoom.mjs <帧,帧,...> '<looks JSON>' <输出png> [职业] [倍数]
//   例：node test/avatar_zoom.mjs idle,walk1,a1_1 '[{"wpn":"katana"},{"wpn":"greatsword"}]' test/shots/avatar/zoom.png sword 3
import { launch, URL_BASE } from './lib.mjs';
import fs from 'fs';
const frames = (process.argv[2] || 'idle,walk1,walk4,a1_1,a2_2,a3_2').split(',');
const looks = JSON.parse(process.argv[3] || '[{"wpn":"katana"},{"wpn":"greatsword"},{"wpn":"lightsaber"}]');
const outp = process.argv[4] || 'test/shots/avatar/zoom.png';
const cls = process.argv[5] || 'sword', S = +(process.argv[6] || 3.2);
fs.mkdirSync(outp.replace(/\/[^/]*$/, ''), { recursive: true });
const { browser, page, logs } = await launch({ width: 1600, height: 900 });
await page.goto(`${URL_BASE}?art&m=${cls}`);
await page.waitForFunction(() => window.__ART_READY, null, { timeout: 30000 });
const url = await page.evaluate(({ frames, looks, cls, S }) => {
  const cw = Math.round(130 * S), ch = Math.round(140 * S);
  const cv = document.createElement('canvas'); cv.width = cw * frames.length; cv.height = ch * looks.length; const x = cv.getContext('2d');
  x.fillStyle = '#46505e'; x.fillRect(0, 0, cv.width, cv.height);
  looks.forEach((look, i) => frames.forEach((f, j) => {
    const m = new SpriteModel(cls, SPR_FALLBACK, { ...SPR_ANIMS[cls], __one: [[f, 0]] }); avatarSetLook(m, { set: null, acc: [], ...look });
    x.save(); x.translate(cw * j + cw / 2, ch * i + ch - 8); x.scale(S, S); m.draw(x, { __c: '__one', __t: 0 }, 0, NO_OPTS); x.restore();
    x.fillStyle = '#ffe28a'; x.font = '16px sans-serif'; x.fillText(f + ' ' + (look.wpn || '空手') + (look.set ? ' @' + look.set : ''), cw * j + 6, ch * i + 18);
  }));
  return cv.toDataURL('image/png');
}, { frames, looks, cls, S });
fs.writeFileSync(outp, Buffer.from(url.split(',')[1], 'base64'));
console.log(outp, JSON.stringify(logs.slice(0, 3)));
await browser.close();
