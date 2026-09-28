// 武器外观测试：node test/weapons.mjs（先 node build.mjs）
//   1. 每件史诗武器、每种武器类型 × 品级外观（_r2 稀有 / _r3 神器 / _r4 传说）都有图，握点在武器上、长度合理
//   2. 品级选择：普通 / 高级 → 基础外观，稀有 / 神器 / 传说 → 品级外观，史诗 → 专属外观，武器装扮优先
//   3. 联机外观：自己的 look.wpn 经服务端清洗后不变，别人的模型按这个 key 画出同一把武器
// 审图：node test/weapons.mjs shots <key,key,...|all|epics|tiers> [输出.jpg] —— 每把武器拿在对应职业手里（游戏内大小 + 放大）拼成一张总览图
import { launch, URL_BASE } from './lib.mjs';
import { cleanChar } from '../server/core/social.js';
import fs from 'fs';
let fail = 0; const ok = (c, msg, x = '') => { console.log((c ? '  ✓ ' : '  ✗ ') + msg, x); if (!c) fail++; };
const WT = ['shortsword', 'katana', 'club', 'greatsword', 'lightsaber', 'revolver', 'autopistol', 'rifle', 'handcannon', 'bowgun', 'spear', 'pole', 'rod', 'staff', 'broom'];

if (process.argv[2] === 'shots') {
  const sel = process.argv[3] || 'all', outp = process.argv[4] || 'test/shots/weapons/weapons.png', one = process.argv[5] === '1x';   // 1x：只画游戏内大小的攻击帧（全量总览用）
  fs.mkdirSync(outp.replace(/\/[^/]*$/, ''), { recursive: true });
  const { browser, page, logs } = await launch({ width: 1600, height: 900 });
  await page.goto(`${URL_BASE}?art&m=sword`);
  await page.waitForFunction(() => window.__ART_READY, null, { timeout: 30000 });
  const url = await page.evaluate(async ({ sel, WT, one }) => {
    const all = Object.keys(WEAPON_IMG).filter(k => WEAPON_IMG[k].type && !/^(spring|summer)_/.test(k));
    const byType = t => [t, `${t}_r2`, `${t}_r3`, `${t}_r4`, ...all.filter(k => k.startsWith('ep_') && WEAPON_IMG[k].type === t).sort((a, b) => ((ITEMS[a] || {}).lvl || 0) - ((ITEMS[b] || {}).lvl || 0))];
    const keys = sel === 'all' ? WT.flatMap(t => { const L = byType(t); return [...L, ...Array(Math.max(0, 11 - L.length)).fill(null)]; }) : sel === 'epics' ? all.filter(k => k.startsWith('ep_')) : sel === 'tiers' ? WT.flatMap(t => [t, `${t}_r2`, `${t}_r3`, `${t}_r4`]) : sel.split(',');
    const FR = { sword: ['idle', 'a1_2'], gun: ['idle', 'shoot2'], mage: ['idle', 'm1_2'] };
    const TIER = ['', '', '稀有', '神器', '传说'];
    const label = k => { const m = k.match(/_r(\d)$/); if (m) return `${WTYPES[WEAPON_IMG[k].type].name}·${TIER[m[1]]}`; const D = ITEMS[k]; return D ? D.name : k === WEAPON_IMG[k].type ? `${WTYPES[k].name}·普通` : k; };
    for (const c of ['gun', 'mage']) if (!IMG[`spr/${c}/idle`]) await loadBundles(['spr:' + c]);
    await Promise.all(keys.map(k => loadArtKey('weapon/' + k)));
    const cols = Math.min(one ? 11 : 6, keys.length), cw = one ? 172 : 330, ch = one ? 150 : 330, rows = Math.ceil(keys.length / cols);
    const cv = document.createElement('canvas'); cv.width = cw * cols; cv.height = ch * rows; const x = cv.getContext('2d');
    x.fillStyle = '#3c4452'; x.fillRect(0, 0, cv.width, cv.height);
    const draw = (cls, look, f, X, Y, S) => {
      const m = new SpriteModel(cls, SPR_FALLBACK, { ...SPR_ANIMS[cls], __one: [[f, 0]] }); avatarSetLook(m, { set: null, acc: [], ...look });
      x.save(); x.translate(X, Y); x.scale(S, S); m.draw(x, { __c: '__one', __t: 0 }, 0, NO_OPTS); x.restore();
    };
    keys.forEach((k, i) => {
      const A = k && WEAPON_IMG[k]; if (!A) return;
      const cls = WTYPES[A.type].cls, X = (i % cols) * cw, Y = Math.floor(i / cols) * ch, look = { wpn: k };
      if (i % cols) { x.fillStyle = '#2c323d'; x.fillRect(X, Y, 2, ch); }
      if (one) draw(cls, look, FR[cls][1], X + 55, Y + ch - 8, 1);
      else {
        FR[cls].forEach((f, j) => draw(cls, look, f, X + 60 + j * 150, Y + 140, 1));           // 游戏内大小（1 倍）
        draw(cls, look, FR[cls][1], X + 105, Y + ch - 10, 1.6);                                // 放大 1.6 倍
      }
      x.fillStyle = k.startsWith('ep_') ? '#ffcf5a' : /_r4$/.test(k) ? '#ff9a3c' : /_r3$/.test(k) ? '#ff7ad9' : /_r2$/.test(k) ? '#c49bff' : '#e8e8e8';
      x.font = `bold ${one ? 13 : 15}px "PingFang SC",sans-serif`; x.fillText(label(k), X + 6, Y + (one ? 16 : 20));
    });
    return cv.toDataURL('image/jpeg', 0.88);
  }, { sel, WT, one });
  fs.writeFileSync(outp, Buffer.from(url.split(',')[1], 'base64'));
  console.log(outp, logs.length ? JSON.stringify(logs.slice(0, 3)) : '');
  await browser.close(); process.exit(0);
}

// ================= 1. 美术实验室：图齐全、握点 / 长度合理 =================
{
  const { browser, page, logs } = await launch({ width: 1280, height: 720 });
  await page.goto(`${URL_BASE}?art&m=sword`);
  await page.waitForFunction(() => window.__ART_READY, null, { timeout: 30000 });
  const r = await page.evaluate(async (WT) => {
    const epics = Object.keys(ITEMS).filter(k => ITEMS[k].rar === 5 && ITEMS[k].slot === 'weapon');
    const tiers = WT.flatMap(t => [2, 3, 4].map(n => `${t}_r${n}`));
    const keys = [...WT, ...epics, ...tiers];
    const miss = keys.filter(k => !WEAPON_IMG[k] || !ASSET_SRC['weapon/' + k]);
    const wrongType = epics.filter(k => WEAPON_IMG[k] && WEAPON_IMG[k].type !== ITEMS[k].wtype);
    await Promise.all(keys.map(k => loadArtKey('weapon/' + k)));
    const bad = [];
    for (const k of keys) {
      const A = WEAPON_IMG[k], im = IMG['weapon/' + k]; if (!A || !im) continue;
      const base = WEAPON_IMG[A.type], ratio = A.size / base.size;
      if (ratio < 0.99 || ratio > 1.35) bad.push(`${k} 长度 ×${ratio.toFixed(2)}`);
      if (Math.abs(im.width - A.w) > 1 || Math.abs(im.height - A.h) > 1) bad.push(`${k} 图片尺寸和数据不符`);
      const cv = document.createElement('canvas'); cv.width = A.w; cv.height = A.h; const c = cv.getContext('2d'); c.drawImage(im, 0, 0);
      const a = c.getImageData(0, 0, A.w, A.h).data, al = (x, y) => x < 0 || y < 0 || x >= A.w || y >= A.h ? 0 : a[(y * A.w + x) * 4 + 3];
      const near = (px, py, r) => { for (let y = Math.round(py) - r; y <= Math.round(py) + r; y++) for (let x = Math.round(px) - r; x <= Math.round(px) + r; x++) if (al(x, y) > 100) return true; return false; };
      if (A.kind === 'pole') { if (!near(A.tx - 4, A.ty, 6)) bad.push(`${k} 杖头不在尖端`); }
      else if (!near(A.gx, A.gy, 3)) bad.push(`${k} 握点 (${A.gx},${A.gy}) 不在武器上`);
      if (A.tx - A.gx < A.w * 0.4) bad.push(`${k} 握点太靠右`);
    }
    // 拿在手里：握点画到帧的握点上，握点附近一定有武器像素（武器贴着手）
    const hand = [];
    for (const [cls, f, k] of [['sword', 'a1_2', 'ep_gs_apophis'], ['sword', 'a1_2', 'katana_r4'], ['gun', 'shoot2', 'revolver_r3'], ['mage', 'm1_2', 'staff_r2']]) {
      if (!IMG[`spr/${cls}/idle`]) await loadBundles(['spr:' + cls]);
      const F = SPR_DATA[cls].frames[f], w = F && F.wpn; if (!w || !WEAPON_IMG[k]) { hand.push(`${cls}/${f}/${k} 没有武器轨迹`); continue; }
      const m = new SpriteModel(cls, SPR_FALLBACK, { ...SPR_ANIMS[cls], __one: [[f, 0]] }); avatarSetLook(m, { wpn: k, set: null, acc: [] });
      const L = m.av; L.sync && L.sync(); if (!L.wim) await loadArtKey('weapon/' + k), (L.wim = IMG['weapon/' + k]);
      const cv = document.createElement('canvas'); cv.width = F.w; cv.height = F.h; const c = cv.getContext('2d'); c.translate(F.ax, F.ay); L.weapon(c, w, F);
      const d = c.getImageData(0, 0, F.w, F.h).data; let n = 0, tot = 0;
      for (let y = 0; y < F.h; y++) for (let x = 0; x < F.w; x++) if (d[(y * F.w + x) * 4 + 3] > 100) { tot++; if (Math.hypot(x - w.gx, y - w.gy) < 14) n++; }
      if (!n || tot < 80) hand.push(`${cls}/${f}/${k} 握点附近 ${n} 像素，武器共 ${tot}`);
    }
    return { n: keys.length, epics: epics.length, miss, wrongType, bad, hand };
  }, WT);
  ok(r.miss.length === 0, `史诗 ${r.epics} 件 + 15 种类型 × 4 个品级外观都有武器图`, r.miss.join(' '));
  ok(r.wrongType.length === 0, '史诗武器图的类型和物品一致', r.wrongType.join(' '));
  ok(r.bad.length === 0, `握点在武器上、长度合理（${r.n} 张）`, r.bad.join('；'));
  ok(r.hand.length === 0, '拿在手里：武器贴着手（三职业抽查）', r.hand.join('；'));
  ok(!logs.some(l => l.type === 'pageerror'), '没有页面错误', JSON.stringify(logs.filter(l => l.type === 'pageerror').slice(0, 2)));
  await browser.close();
}

// ================= 2. 品级选择 + 3. 联机外观 =================
{
  const { browser, page, logs } = await launch({ width: 1280, height: 720 });
  await page.goto(`${URL_BASE}?town&mute&cls=sword`); await page.waitForFunction(() => window.__READY);
  const r = await page.evaluate(() => {
    const pickKey = (w, rar) => Object.keys(ITEMS).find(k => ITEMS[k].wtype === w && ITEMS[k].rar === rar && !ITEMS[k].named);
    const sel = {};
    for (const [w, cls] of [['katana', 'sword'], ['greatsword', 'sword'], ['revolver', 'gun'], ['staff', 'mage']]) for (const rar of [0, 1, 2, 3, 4]) {
      const k = pickKey(w, rar); sel[`${w}/${rar}`] = k ? weaponArtOf(makeItem(k), cls) : 'no-item';
    }
    const ep = weaponArtOf(makeItem('ep_gs_apophis'), 'sword'), skin = weaponArtOf(makeItem(pickKey('katana', 4)), 'sword', { skin: 'spring' });
    const noRar = weaponArtOf({ key: pickKey('katana', 3), wtype: 'katana' }, 'sword');   // 旧存档里没存 rar：按物品库补
    // 联机：自己装备稀有太刀 → look.wpn → 服务端清洗 → 别人的模型
    inv.equip.weapon = makeItem(pickKey('katana', 3));
    const mine = (typeof netCharInfo === 'function' && netCharInfo()) || { name: 'me', cls: 'sword', look: lookFromEquip('sword', inv.equip) };
    const m = new SpriteModel('sword', SPR_FALLBACK, SPR_ANIMS.sword); avatarSetLook(m, mine.look);
    const L = m.av; L.sync && L.sync();
    return { sel, ep, skin, noRar, mine, drawn: L.A === WEAPON_IMG[mine.look.wpn] };
  });
  const exp = { 0: '', 1: '', 2: '_r2', 3: '_r3', 4: '_r4' };
  const wrong = Object.entries(r.sel).filter(([k, v]) => { const [w, rar] = k.split('/'); return v !== w + exp[rar]; });
  ok(wrong.length === 0, '品级外观：普通 / 高级 = 基础，稀有 / 神器 / 传说 = _r2 / _r3 / _r4', JSON.stringify(wrong));
  ok(r.ep === 'ep_gs_apophis', '史诗用专属外观（魔剑-阿波菲斯）', r.ep);
  ok(r.skin === 'spring_katana', '武器装扮优先于品级外观', r.skin);
  ok(r.noRar === 'katana_r3', '物品上没存品级时按物品库补上', r.noRar);
  const net = cleanChar(r.mine);
  ok(r.mine.look.wpn === 'katana_r3' && net.look.wpn === 'katana_r3', '联机：look.wpn 经服务端清洗后仍是品级外观', `${r.mine.look.wpn} → ${net.look.wpn}`);
  ok(r.drawn, '别的玩家的模型按这个 key 画同一把武器');
  ok(!logs.some(l => l.type === 'pageerror'), '没有页面错误', JSON.stringify(logs.filter(l => l.type === 'pageerror').slice(0, 2)));
  await browser.close();
}
console.log(fail ? `✗ ${fail} 项失败` : '武器外观测试全部通过');
process.exit(fail ? 1 : 0);
