// 外观放大图（人工验收用）：node test/avatar_zoom.mjs <帧,帧,...|ALL|ALL:前缀> '<looks JSON>' <输出png> [职业] [倍数] [每行几格]
//   例：node test/avatar_zoom.mjs idle,walk1,a1_1 '[{"wpn":"katana"},{"wpn":"greatsword"}]' test/shots/avatar/zoom.png sword 3
//       node test/avatar_zoom.mjs ALL '[{"wpn":"staff"}]' test/shots/avatar/mage_all.png mage 1.6 12   （全部帧，按行折）
import { launch, URL_BASE } from './lib.mjs';
import fs from 'fs';
const fr = process.argv[2] || 'idle,walk1,walk4,a1_1,a2_2,a3_2';
const looks = JSON.parse(process.argv[3] || '[{"wpn":"katana"},{"wpn":"greatsword"},{"wpn":"lightsaber"}]');
const outp = process.argv[4] || 'test/shots/avatar/zoom.png';
const cls = process.argv[5] || 'sword', S = +(process.argv[6] || 3.2), per = +(process.argv[7] || 0);
fs.mkdirSync(outp.replace(/\/[^/]*$/, ''), { recursive: true });
const { browser, page, logs } = await launch({ width: 1600, height: 900 });
await page.goto(`${URL_BASE}?art&m=${cls}`);
await page.waitForFunction(() => window.__ART_READY, null, { timeout: 30000 });
const url = await page.evaluate(async ({ fr, looks, cls, S, per }) => {
  const all = Object.keys(SPR_DATA[cls].frames).sort();
  const frames = fr.startsWith('ALL') ? all.filter(f => f.startsWith(fr.slice(4))) : fr.split(',');
  for (const L of looks) if (L.set && !IMG[`spr/${cls}@${L.set}/idle`]) await loadBundles(['spr:' + cls + '@' + L.set]);
  const cells = []; looks.forEach(look => frames.forEach(f => cells.push([look, f])));
  const cols = per || frames.length, rows = Math.ceil(cells.length / cols);
  const cw = Math.round(130 * S), ch = Math.round(140 * S);
  const cv = document.createElement('canvas'); cv.width = cw * cols; cv.height = ch * rows; const x = cv.getContext('2d');
  x.fillStyle = '#46505e'; x.fillRect(0, 0, cv.width, cv.height);
  cells.forEach(([look, f], i) => {
    const cx = (i % cols) * cw, cy = Math.floor(i / cols) * ch;
    const m = new SpriteModel(cls, SPR_FALLBACK, { ...SPR_ANIMS[cls], __one: [[f, 0]] }); avatarSetLook(m, { set: null, acc: [], ...look });
    x.save(); x.translate(cx + cw / 2, cy + ch - 8); x.scale(S, S); m.draw(x, { __c: '__one', __t: 0 }, 0, NO_OPTS); x.restore();
    const F = SPR_DATA[cls].frames[f] || {};
    x.fillStyle = F.wpn ? '#ffe28a' : '#9aa'; x.font = `${Math.max(11, Math.round(5 * S))}px sans-serif`; x.fillText(f + (F.wpn2 ? ' ×2' : '') + ' ' + (look.wpn || '空手') + (look.set ? ' @' + look.set : ''), cx + 4, cy + 14);
  });
  return cv.toDataURL('image/png');
}, { fr, looks, cls, S, per });
fs.writeFileSync(outp, Buffer.from(url.split(',')[1], 'base64'));
console.log(outp, JSON.stringify(logs.slice(0, 3)));
await browser.close();
