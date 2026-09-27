// 时装样例图（人工验收 / 发给商城组）：三职业 × 4 个动作（待机、走路、普攻两帧），穿整套 + 配件
//   node test/avatar_sample.mjs <套装id> [输出png] [倍数]
//   配件自动取 AVATAR_ACC 里以 _<套装id> 结尾的全部；武器用职业默认（太刀 / 左轮 / 法杖）
import { launch, URL_BASE } from './lib.mjs';
import fs from 'fs';
const sid = process.argv[2] || 'festival', outp = process.argv[3] || `test/shots/avatar/${sid}_sample.png`, S = +(process.argv[4] || 2.6);
fs.mkdirSync(outp.replace(/\/[^/]*$/, ''), { recursive: true });
const { browser, page, logs } = await launch({ width: 1600, height: 900 });
await page.goto(`${URL_BASE}?art&m=sword`);
await page.waitForFunction(() => window.__ART_READY, null, { timeout: 30000 });
const url = await page.evaluate(async ({ sid, S }) => {
  const rows = [['sword', 'katana', ['idle', 'walk3', 'a1_2', 'a3_1']], ['gun', 'revolver', ['idle', 'walk3', 'shoot2', 'kick2']], ['mage', 'staff', ['idle', 'walk3', 'm1_2', 'cast2']]];
  const acc = Object.keys(AVATAR_ACC).filter(k => k.endsWith('_' + sid));
  for (const [cls] of rows) if (SPR_DATA[`${cls}@${sid}`]) await loadBundles([`spr:${cls}@${sid}`]);
  for (const k of acc) await loadArtKey('avatar/' + AVATAR_ACC[k].img);
  const cw = Math.round(130 * S), ch = Math.round(140 * S);
  const cv = document.createElement('canvas'); cv.width = cw * 4; cv.height = ch * rows.length; const x = cv.getContext('2d');
  x.fillStyle = '#46505e'; x.fillRect(0, 0, cv.width, cv.height);
  rows.forEach(([cls, wpn, frames], i) => frames.forEach((f, j) => {
    const m = new SpriteModel(cls, SPR_FALLBACK, { ...SPR_ANIMS[cls], __one: [[f, 0]] }); avatarSetLook(m, { wpn, set: sid, acc });
    x.save(); x.translate(cw * j + cw / 2, ch * i + ch - 8); x.scale(S, S); m.draw(x, { __c: '__one', __t: 0 }, 0, NO_OPTS); x.restore();
    x.fillStyle = '#ffe28a'; x.font = '16px sans-serif'; x.fillText(`${f} ${wpn} @${sid}`, cw * j + 6, ch * i + 18);
  }));
  return cv.toDataURL('image/png');
}, { sid, S });
fs.writeFileSync(outp, Buffer.from(url.split(',')[1], 'base64'));
console.log(outp, JSON.stringify(logs.filter(l => l.type !== 'warning').slice(0, 3)));
await browser.close();
