// 混搭时装样例（游戏里真的穿上物品，用玩家自己的模型画）：node test/avatar_mix.mjs [职业] [输出png] '[部位=物品key,...]'
//   默认 = 用户存档里的神枪手：头部 / 帽子 / 脸部 / 胸部 / 腰带 = 天穹圣翼，上衣 = 星辉学院，下装 / 鞋 = 炎龙之魂
import { launch, URL_BASE } from './lib.mjs';
import fs from 'fs';
const cls = process.argv[2] || 'gun', outp = process.argv[3] || `test/shots/avatar/mix_${cls}_game.png`;
const keys = (process.argv[4] || 'av_hair_sky1,av_hat_sky1,av_face_sky1,av_chest_sky1,av_belt_sky1,av_top_academy,av_bottom_sky2,av_shoes_sky2').split(',');
const frames = (process.argv[5] || 'idle,walk1,walk3,walk5,walk7,run2,run6').split(',');
fs.mkdirSync(outp.replace(/\/[^/]*$/, ''), { recursive: true });
const { browser, page, logs } = await launch({ width: 1280, height: 720 });
await page.goto(`${URL_BASE}?town&cls=${cls}&mute&fresh`);
await page.waitForFunction(() => window.__READY, null, { timeout: 30000 });
const r = await page.evaluate(async ({ keys, frames, cls }) => {
  game.lvl = 30;
  for (const k of keys) { const it = makeItem(k); if (!it) return { err: 'no item ' + k }; inv.add(it); if (!inv.wear(it)) return { err: 'wear ' + k }; }
  const p = game.player, L = p.model.av; L.sync();
  const look = L.look;
  await new Promise(res => setTimeout(res, 800));   // 等分包加载
  const extra = { ...SPR_ANIMS[cls] }; p.model.anims = extra;
  const S = 2.4, cw = Math.round(120 * S), ch = Math.round(130 * S);
  const cv = document.createElement('canvas'); cv.width = cw * frames.length; cv.height = ch; const x = cv.getContext('2d');
  x.fillStyle = '#46505e'; x.fillRect(0, 0, cv.width, cv.height);
  frames.forEach((f, j) => {
    extra.__one = [[f, 0]];
    x.save(); x.translate(cw * j + cw / 2, ch - 8); x.scale(S, S); p.model.draw(x, { __c: '__one', __t: 0 }, 0, NO_OPTS); x.restore();
    x.fillStyle = '#ffe28a'; x.font = '15px sans-serif'; x.fillText(f, cw * j + 6, 18);
  });
  return { look: { set: look.set, parts: look.parts, acc: look.acc, wpn: look.wpn }, url: cv.toDataURL('image/png') };
}, { keys, frames, cls });
if (r.err) { console.log('ERR', r.err); process.exit(1); }
fs.writeFileSync(outp, Buffer.from(r.url.split(',')[1], 'base64'));
console.log(outp, JSON.stringify(r.look), JSON.stringify(logs.filter(l => l.type !== 'warning').slice(0, 3)));
await browser.close();
