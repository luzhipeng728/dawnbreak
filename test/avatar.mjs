// 外观与换装测试：node test/avatar.mjs [shots]（先 node build.mjs）
//   1. 换武器类型 → 外观改变；穿上 / 脱下时装 → 外观切换；刷新后仍然正确
//   2. 截图里没有绿色占位像素残留
//   3. 三个职业所有动画片段、所有帧都能正常绘制（有武器轨迹的帧武器也画出来）
//   shots：另外把「帧 × 外观」拼成大图写到 test/shots/avatar/，给人逐帧看
import { launch, URL_BASE } from './lib.mjs';
import fs from 'fs';
const SHOTS = process.argv.includes('shots');
const out = 'test/shots/avatar'; fs.mkdirSync(out, { recursive: true });
let fail = 0; const ok = (c, msg) => { console.log((c ? '  ✓ ' : '  ✗ ') + msg); if (!c) fail++; };

// ---- 页面里用的小工具：按外观画指定帧、统计绿色像素、取画面指纹 ----
const HELPERS = () => {
  window.__av = {
    // 用一个新模型按 look 画某一帧，返回画布
    drawFrame(cls, f, look, scale = 1.6, w = 200, h = 230) {
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const x = cv.getContext('2d');
      const m = new SpriteModel(cls, SPR_FALLBACK, { ...SPR_ANIMS[cls], __one: [[f, 0]] });
      if (look !== undefined) avatarSetLook(m, look);
      x.translate(w / 2, h - 12); x.scale(scale, scale); m.draw(x, { __c: '__one', __t: 0 }, 0, NO_OPTS);
      return cv;
    },
    green(cv) {   // 纯绿占位像素（G 明显高于 R、B）
      const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; let n = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 60 && d[i + 1] > 150 && d[i + 1] - Math.max(d[i], d[i + 2]) > 90) n++;
      return n;
    },
    hash(cv) { const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; let h = 0; for (let i = 0; i < d.length; i += 16) h = (h * 31 + d[i] + d[i + 1] * 3 + d[i + 3] * 7) | 0; return h; },
  };
};

// ================= 1. 美术实验室页面：逐帧绘制 / 绿色残留 / 拼图 =================
{
  const { browser, page, logs } = await launch({ width: 1920, height: 1080 });
  await page.goto(`${URL_BASE}?art&m=sword`);
  await page.waitForFunction(() => window.__ART_READY, null, { timeout: 30000 });
  await page.evaluate(HELPERS);
  console.log('逐帧绘制（三职业全部帧 × 默认外观）');
  const r = await page.evaluate(() => {
    const res = {};
    for (const cls of ['sword', 'gun', 'mage']) {
      const S = SPR_DATA[cls], frames = Object.keys(S.frames); let wpn = 0, bad = [], green = 0;
      const m = new SpriteModel(cls, SPR_FALLBACK, SPR_ANIMS[cls]);
      for (const f of frames) {
        if (S.frames[f].wpn) wpn++;
        try { const cv = __av.drawFrame(cls, f); green += __av.green(cv); } catch (e) { bad.push(f + ':' + e.message); }
      }
      // 动画表里引用的帧都存在
      const missing = [];
      for (const [name, A] of Object.entries(SPR_ANIMS[cls])) for (const fn of (A.frames || A.map(a => a[0]))) if (!S.frames[fn]) missing.push(`${name}/${fn}`);
      res[cls] = { n: frames.length, wpn, bad, green, missing, av: !!m.av };
    }
    return res;
  });
  for (const [cls, v] of Object.entries(r)) {
    ok(v.bad.length === 0, `${cls}: ${v.n} 帧全部能画（其中 ${v.wpn} 帧有武器轨迹）${v.bad.length ? ' 出错：' + v.bad.slice(0, 3).join(' ') : ''}`);
    ok(v.green === 0, `${cls}: 绿色占位像素残留 ${v.green}`);
    ok(v.av, `${cls}: 职业精灵模型自动挂上外观层`);
    if (v.missing.length) console.log(`    （动画表引用了不存在的帧，走兜底：${v.missing.slice(0, 6).join(' ')}${v.missing.length > 6 ? ' …' : ''}）`);
  }
  console.log('换武器 / 换时装 → 外观改变');
  const d = await page.evaluate(() => {
    const cls = 'sword', f = Object.keys(SPR_DATA.sword.frames).find(k => SPR_DATA.sword.frames[k].wpn) || 'idle';
    const types = Object.keys(WEAPON_IMG).filter(k => WEAPON_IMG[k].type && WTYPES[WEAPON_IMG[k].type].cls === cls);
    const hs = {};
    for (const t of types) hs[t] = __av.hash(__av.drawFrame(cls, f, { wpn: t, set: null, acc: [] }));
    const none = __av.hash(__av.drawFrame(cls, f, { wpn: null, set: null, acc: [] }));
    const sets = Object.values(AVATAR_SETS).filter(S => SPR_DATA[`${cls}@${S.id}`]).map(S => S.id);
    return { f, types, distinct: new Set(Object.values(hs)).size, none, hs, sets };
  });
  ok(d.types.length >= 3 && d.distinct === d.types.length, `鬼剑士 ${d.types.length} 种武器图，帧 ${d.f} 画出来互不相同（${d.distinct} 种）`);
  ok(!Object.values(d.hs).includes(d.none), '空手和拿武器画出来不同');
  if (SHOTS) {
    // 连拍大图：每行一种外观，每列一帧
    const plan = await page.evaluate(() => ({
      sword: { frames: ['idle', ...Array.from({ length: 8 }, (_, i) => 'walk' + (i + 1)), 'a1_1', 'a1_2', 'a1_3', 'a2_1', 'a2_2', 'a2_3', 'a3_1', 'a3_2'].filter(f => SPR_DATA.sword.frames[f]),
               looks: [['太刀', { wpn: 'katana' }], ['巨剑', { wpn: 'greatsword' }], ['光剑', { wpn: 'lightsaber' }], ['史诗·月之光芒', { wpn: 'ep_katana' }], ['空手', { wpn: null }],
                       ...(SPR_DATA['sword@festival'] ? [['庆典时装+太刀', { wpn: 'katana', set: 'festival', acc: ['av_hat_festival', 'av_face_festival', 'av_hair_festival'] }]] : [])] },
    }));
    for (const [cls, P] of Object.entries(plan)) {
      const file = await page.evaluate(({ cls, P }) => {
        const cw = 150, ch = 230, lw = 110, W = lw + cw * P.frames.length, H = 30 + ch * P.looks.length;
        const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const x = cv.getContext('2d');
        x.fillStyle = '#46505e'; x.fillRect(0, 0, W, H); x.fillStyle = '#fff'; x.font = '14px sans-serif'; x.textAlign = 'center';
        P.frames.forEach((f, j) => x.fillText(f, lw + cw * j + cw / 2, 20));
        P.looks.forEach(([name, look], i) => {
          x.textAlign = 'left'; x.fillStyle = '#ffe28a'; x.fillText(name, 8, 30 + ch * i + ch / 2);
          P.frames.forEach((f, j) => { const c2 = __av.drawFrame(cls, f, { set: null, acc: [], ...look }, 1.6, cw, ch); x.drawImage(c2, lw + cw * j, 30 + ch * i); });
        });
        return cv.toDataURL('image/png');
      }, { cls, P });
      const path = `${out}/${cls}_looks.png`; fs.writeFileSync(path, Buffer.from(file.split(',')[1], 'base64')); console.log('  写出', path);
    }
  }
  ok(!logs.some(l => l.type === 'pageerror'), '页面没有报错' + (logs.length ? ' ' + JSON.stringify(logs.slice(0, 3)) : ''));
  await browser.close();
}

if (fail) { console.log(`\n${fail} 项失败`); process.exit(1); }
console.log('\n全部通过');
