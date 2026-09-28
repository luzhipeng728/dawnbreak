// 洋葱皮对照（人工验收用）：原装帧（青色半透明）叠在时装帧（原色）下面，都按脚底锚点放在同一点。
//   node test/avatar_onion.mjs <职业> <帧,帧,...> <套装,套装,...> <输出png> [倍数]
//   人对得上 = 换时装后人不会在原地挪动 / 变大变小；每格下方的白十字 = 脚底锚点
import { launch, URL_BASE } from './lib.mjs';
import fs from 'fs';
const [cls = 'sword', fr = 'idle', sets = 'festival', outp = 'test/shots/avatar/onion.png'] = process.argv.slice(2);
const S = +(process.argv[6] || 1.6);
fs.mkdirSync(outp.replace(/\/[^/]*$/, ''), { recursive: true });
const { browser, page, logs } = await launch({ width: 1600, height: 900 });
await page.goto(`${URL_BASE}?art&m=${cls}`);
await page.waitForFunction(() => window.__ART_READY, null, { timeout: 30000 });
const url = await page.evaluate(async ({ cls, fr, sets, S }) => {
  const frames = fr.split(','), setl = sets.split(',');
  for (const s of setl) await loadBundles([`spr:${cls}@${s}`]);
  const cw = Math.round(150 * S), ch = Math.round(150 * S);
  const cv = document.createElement('canvas'); cv.width = cw * frames.length; cv.height = ch * setl.length; const x = cv.getContext('2d');
  x.fillStyle = '#2c3440'; x.fillRect(0, 0, cv.width, cv.height);
  const draw = (key, f, cx, cy, tint) => {
    const F = SPR_DATA[key].frames[f], im = IMG[`spr/${key}/${f}`]; if (!F || !im) return;
    const k = S / SPR_DATA[key].res;
    if (tint) {   // 原装：青色剪影
      const [c2, x2] = offCanvas(im.width, im.height); x2.drawImage(im, 0, 0); x2.globalCompositeOperation = 'source-in'; x2.fillStyle = '#35e0ff'; x2.fillRect(0, 0, im.width, im.height);
      x.globalAlpha = 0.55; x.drawImage(c2, cx - F.ax * k, cy - F.ay * k, im.width * k, im.height * k); x.globalAlpha = 1;
    } else { x.globalAlpha = 0.8; x.drawImage(im, cx - F.ax * k, cy - F.ay * k, im.width * k, im.height * k); x.globalAlpha = 1; }
  };
  setl.forEach((sid, i) => frames.forEach((f, j) => {
    const cx = cw * j + cw / 2, cy = ch * i + ch - 14;
    draw(cls, f, cx, cy, true); draw(`${cls}@${sid}`, f, cx, cy, false);
    x.strokeStyle = '#fff'; x.beginPath(); x.moveTo(cx - 6, cy); x.lineTo(cx + 6, cy); x.moveTo(cx, cy - 6); x.lineTo(cx, cy + 6); x.stroke();
    x.fillStyle = '#ffe28a'; x.font = '13px sans-serif'; x.fillText(`${f} @${sid}`, cw * j + 4, ch * i + 14);
  }));
  return cv.toDataURL('image/png');
}, { cls, fr, sets, S });
fs.writeFileSync(outp, Buffer.from(url.split(',')[1], 'base64'));
console.log(outp, JSON.stringify(logs.filter(l => l.type !== 'warning').slice(0, 3)));
await browser.close();
