// 格斗家拳上武器近景对照（B2 修“双手”：手套盖不住拳头 / 远侧手套压在脸上）：node test/fighter_gloves.mjs [输出名=gloves] [帧,...]
//   每行一种武器外观（5 类 × 普通 / 传说 + 满级角色实际拿到的那把），每列一个帧（站立 / 走 / 跑 / 刺拳 / 踢 / 转职姿势），4 倍放大，裁到两只拳头附近；
//   第一行是空手（看原来的拳头在哪）。改前：GAME_URL=file://<旧构建>.html node test/fighter_gloves.mjs before
//   输出 test/shots/fighter_looks/<名>.jpg；SET=summer 等 = 穿着这套时装，JOB=striker 等 = 转职外观；外观可以写物品 key（ep_bx_warsoul：具名史诗按 pal 配色）
import { launch, URL_BASE } from './lib.mjs';
import fs from 'fs';
import { execFileSync } from 'child_process';
const name = process.argv[2] || 'gloves', out = 'test/shots/fighter_looks'; fs.mkdirSync(out, { recursive: true });
const FR = (process.argv[3] || 'idle,walk3,run3,run7,f_jab1,f_jab2,f_mid2,f_high1,fn_thrust2,fs_dashpunch,fb_throw1,fg_swing1').split(',');
const WL = process.argv[4] ? process.argv[4].split(',').map(k => k === 'none' ? null : k) : null;   // 只出这几种武器外观（逗号分隔，none = 空手）
const CMP = process.argv[5];   // 改前那张图的名字：出完后按行交错拼成 <名>_cmp.jpg（每种外观：改前一行、改后一行）
const { browser, page, logs } = await launch({ width: 960, height: 540 });
await page.goto(`${URL_BASE}?town&mute&cls=fighter&fighter=1&fresh`); await page.waitForFunction(() => window.__READY, null, { timeout: 120000 }); await page.waitForTimeout(500);
// 满级角色（admin maxout，Lv60 +12）拿到的武器：按同一套指标挑最强
const maxW = await page.evaluate(() => {
  const L = Object.keys(ITEMS).filter(k => ITEMS[k].slot === 'weapon' && ITEMS[k].cls === 'fighter' && (ITEMS[k].lvl || 1) <= 60 && !(WTYPES[ITEMS[k].wtype].jobs));
  L.sort((a, b) => (ITEMS[b].lvl || 0) - (ITEMS[a].lvl || 0) || (ITEMS[b].rar || 0) - (ITEMS[a].rar || 0)); const k = L[0];
  return { key: k, wtype: ITEMS[k].wtype, rar: ITEMS[k].rar, name: ITEMS[k].name, art: weaponArtOf({ key: k, wtype: ITEMS[k].wtype, rar: ITEMS[k].rar, cls: 'fighter' }, 'fighter') };
});
console.log('满级格斗家（基础职业）拿到的武器：', JSON.stringify(maxW));
const url = await page.evaluate(async ([FR, maxW, WL, SET, JOB, ZZ]) => {
  const W = WL || [null, maxW.art, 'knuckle', 'knuckle_r4', 'boxing', 'boxing_r4', 'claw', 'claw_r4', 'tonfa', 'tonfa_r4', 'gauntlet', 'gauntlet_r4', 'summer_boxing', 'gothic_gauntlet'];
  const look = w => {
    if (w && ITEMS[w]) { const eq = { weapon: makeItem(w, 1) }; if (SET) for (const s of ['av_top', 'av_bottom', 'av_shoes']) eq[s] = { set: 'av_' + SET }; const L = lookFromEquip('fighter', eq, undefined, JOB); return L; }   // 物品 key（具名史诗带 pal 配色）
    if (!w) return { wpn: null, set: SET, acc: [], job: JOB }; const A = WEAPON_IMG[w]; return { wpn: w, set: SET, acc: [], glow: null, job: JOB, parts: null, _t: A && A.type }; };
  for (const w of W) if (w && ITEMS[w]) await loadArtKey('weapon/' + weaponArtOf(makeItem(w, 1), 'fighter'));
  if (SET) await loadBundles(['spr:fighter@' + SET]);
  for (const w of W) if (w) await loadArtKey('weapon/' + w);
  const Z = ZZ, CW = Math.round(250 * Z / 4), CH = Math.round(210 * Z / 4), LW = 120, TH = 22, S = SPR_DATA.fighter, res = S.res;
  const [cv, x] = offCanvas(LW + FR.length * CW, TH + W.length * CH);
  const draw = () => {
    x.fillStyle = '#2a2630'; x.fillRect(0, 0, cv.width, cv.height); x.font = 'bold 13px sans-serif';
    FR.forEach((f, i) => { x.fillStyle = '#ffe2a0'; x.fillText(f, LW + i * CW + 6, 16); });
    W.forEach((w, r) => {
      x.fillStyle = '#fff0d0'; x.fillText(w ? (w === maxW.art ? `满级：${w}` : w) : '空手', 6, TH + r * CH + CH / 2);
      const m = new SpriteModel('fighter', SPR_FALLBACK, SPR_ANIMS.fighter); avatarSetLook(m, look(w));
      FR.forEach((f, i) => {
        const F = S.frames[f]; if (!F) return;
        const P = [F.wpn, F.wpn2].filter(Boolean), cx = P.length ? P.reduce((s, p) => s + p.gx, 0) / P.length : F.ax, cy = P.length ? P.reduce((s, p) => s + p.gy, 0) / P.length : F.ay - F.h * 0.55;
        const X = LW + i * CW, Y = TH + r * CH; x.save(); x.beginPath(); x.rect(X + 1, Y + 1, CW - 2, CH - 2); x.clip(); x.fillStyle = '#c89a68'; x.fillRect(X, Y, CW, CH);
        m.frameOf = () => f; x.translate(X + CW / 2 - (cx - F.ax) * Z / res, Y + CH / 2 - (cy - F.ay) * Z / res); x.scale(Z, Z); x.imageSmoothingEnabled = true;
        m.draw(x, { __c: 'idle', __t: 0 }, 0, NO_OPTS); x.restore();
      });
    });
  };
  draw(); await new Promise(r => setTimeout(r, 1500)); draw();
  return cv.toDataURL('image/png');
}, [FR, maxW, WL, process.env.SET || null, process.env.JOB || null, +(process.env.Z || 4)]);
fs.writeFileSync(`${out}/${name}.png`, Buffer.from(url.split(',')[1], 'base64'));
execFileSync('python3', ['-c', `from PIL import Image; Image.open('${out}/${name}.png').convert('RGB').save('${out}/${name}.jpg', quality=86)`]); fs.rmSync(`${out}/${name}.png`);
console.log('  ', `${out}/${name}.jpg`, logs.filter(l => l.type === 'pageerror').length ? 'pageerror!' : '');
if (CMP) {
  execFileSync('python3', ['-c', `from PIL import Image, ImageDraw
A=Image.open('${out}/${CMP}.jpg'); B=Image.open('${out}/${name}.jpg'); TH,CH=22,round(210*${+(process.env.Z || 4)}/4); n=(B.height-TH)//CH
O=Image.new('RGB',(B.width,TH+2*n*CH+n*6),(20,20,24)); O.paste(B.crop((0,0,B.width,TH)),(0,0)); d=ImageDraw.Draw(O); y=TH
for r in range(n):
  for lab,I in (('BEFORE',A),('AFTER',B)):
    O.paste(I.crop((0,TH+r*CH,I.width,TH+(r+1)*CH)),(0,y)); d.rectangle([2,y+4,62,y+18],fill=(170,40,40) if lab=='BEFORE' else (40,140,60)); d.text((6,y+5),lab,fill=(255,255,255)); y+=CH
  y+=6
O.save('${out}/${name}_cmp.jpg',quality=86)`]);
  console.log('  ', `${out}/${name}_cmp.jpg`);
}
await browser.close();
