// 复现用户截图：Lv60 基础格斗家在城镇站着，拿满级角色的武器（+12）→ 游戏画面裁到人物、放大 4 倍
//   node test/fighter_gloves_town.mjs <输出名> [武器物品 key,...]；改前：GAME_URL=file://<旧构建>.html；JOB=striker SET=sky1 = 转职 + 整套时装（含帽子 / 发饰）
import { launch, URL_BASE } from './lib.mjs';
import fs from 'fs';
import { execFileSync } from 'child_process';
const name = process.argv[2] || 'town', out = 'test/shots/fighter_looks'; fs.mkdirSync(out, { recursive: true });
const keys = (process.argv[3] || 'knuckle_60_3,knuckle_60_1,boxing_60_3,claw_60_3,gauntlet_60_3').split(',');
const { browser, page } = await launch({ width: 960, height: 540 });
await page.goto(`${URL_BASE}?town&mute&cls=fighter&fighter=1&fresh`); await page.waitForFunction(() => window.__READY, null, { timeout: 120000 });
await page.evaluate(async () => { enterScene('hm_plaza'); for (let i = 0; i < 60 && world.S.id !== 'hm_plaza'; i++) await new Promise(r => setTimeout(r, 100)); while (menus.stack.length) menus.close(menus.stack[menus.stack.length - 1]); world.crowd.length = 0; document.querySelectorAll('#ui,#dom').forEach(e => { e.style.visibility = 'hidden'; }); });
const shots = [];
for (const k of keys) {
  const box = await page.evaluate(async ([k, OPT]) => {
    game.lvl = 60; game.job = OPT.job; const it = makeItem(k, 1); if (!it) return null; it.enh = 12; inv.equip.weapon = it;
    if (OPT.set) { for (const s of ['av_top', 'av_bottom', 'av_shoes', 'av_chest', 'av_belt']) inv.equip[s] = { key: s + '_' + OPT.set, set: 'av_' + OPT.set, slot: s }; for (const s of ['av_hat', 'av_hair', 'av_face']) if (AVATAR_ACC[s + '_' + OPT.set]) inv.equip[s] = { key: s + '_' + OPT.set, set: 'av_' + OPT.set, slot: s }; await loadBundles(['spr:fighter@' + OPT.set]); }
    const p = game.player; p.setState('idle'); p.face = -1; world.crowd.length = 0;
    await loadArtKey('weapon/' + weaponArtOf(it, 'fighter')); await new Promise(r => setTimeout(r, 900));
    const cv = document.querySelector('canvas'), r = cv.getBoundingClientRect(), k2 = r.width / WW;
    return { x: r.left + (sx(p.x) - 50) * k2, y: r.top + (sy(p.y, 0) - 118) * k2, w: 100 * k2, h: 128 * k2, art: weaponArtOf(it, 'fighter') };
  }, [k, { job: process.env.JOB || null, set: process.env.SET || null }]);
  if (!box) { console.log('没有物品', k); continue; }
  const f = `${out}/_${name}_${k}.png`; await page.screenshot({ path: f, clip: { x: box.x, y: box.y, width: box.w, height: box.h } }); shots.push([k, box.art, f]);
}
await browser.close();
execFileSync('python3', ['-c', `from PIL import Image, ImageDraw
S=${JSON.stringify(shots)}
ims=[Image.open(f).convert('RGB') for _,_,f in S]; ims=[i.resize((i.width*4,i.height*4),Image.LANCZOS) for i in ims]
O=Image.new('RGB',(sum(i.width+8 for i in ims),ims[0].height+24),(20,20,24)); d=ImageDraw.Draw(O); x=0
for (k,a,_),i in zip(S,ims): O.paste(i,(x,24)); d.text((x+4,5),k+' -> '+a,fill=(255,230,120)); x+=i.width+8
O.save('${out}/${name}.jpg',quality=88)
import os
for _,_,f in S: os.remove(f)`]);
console.log(`${out}/${name}.jpg`);
