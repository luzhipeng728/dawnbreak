// 外观与换装测试：node test/avatar.mjs [shots]（先 node build.mjs）
//   1. 换武器类型 → 外观改变；穿上 / 脱下时装 → 外观切换；刷新后仍然正确
//   2. 截图里没有绿色占位像素残留
//   3. 三个职业所有动画片段、所有帧都能正常绘制（有武器轨迹的帧武器也画出来）
//   shots：另外把「帧 × 外观」拼成大图写到 test/shots/avatar/，给人逐帧看
import { launch, URL_BASE } from './lib.mjs';
import fs from 'fs';
const SHOTS = process.argv.includes('shots');
const out = 'test/shots/avatar'; fs.mkdirSync(out, { recursive: true });
let fail = 0; const ok = (c, msg, x = '') => { console.log((c ? '  ✓ ' : '  ✗ ') + msg, x); if (!c) fail++; };

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
  console.log('逐帧绘制（三职业全部帧 × 每种武器 × 时装）+ 全部动画片段');
  const r = await page.evaluate(async () => {
    const res = {};
    for (const cls of ['sword', 'gun', 'mage']) {
      const S = SPR_DATA[cls], frames = Object.keys(S.frames); let wpn = 0, bad = [], green = {}, draws = 0;
      const m = new SpriteModel(cls, SPR_FALLBACK, SPR_ANIMS[cls]);
      const sets = Object.values(AVATAR_SETS).map(X => X.id).filter(id => SPR_DATA[`${cls}@${id}`]);
      for (const id of sets) await loadBundles(['spr:' + cls + '@' + id]);
      const looks = [...Object.keys(WEAPON_IMG).filter(k => WTYPES[WEAPON_IMG[k].type].cls === cls).map(w => ({ wpn: w, set: null, acc: [] })), { wpn: null, set: null, acc: [] },
                     ...sets.map(id => ({ wpn: defaultLook(cls).wpn, set: id, acc: Object.keys(AVATAR_ACC) }))];
      for (const f of frames) if (S.frames[f].wpn) wpn++;
      for (const look of looks) for (const f of frames) {
        try { __av.drawFrame(cls, f, look); draws++; } catch (e) { bad.push(f + ':' + e.message); }
      }
      // 绿色占位残留：只看帧本身（空手画；有些武器图本身就是绿色的，比如椰子杖、蝮蛇手枪）
      for (const set of [null, ...sets]) for (const f of frames) {
        const F = (set && SPR_DATA[`${cls}@${set}`].frames[f]) || S.frames[f]; if (!F.wpn) continue;
        const g = __av.green(__av.drawFrame(cls, f, { wpn: null, set, acc: [] })); if (g) green[f + (set ? '@' + set : '')] = g;
      }
      // 动画表里的每个片段按时间走一遍（用游戏里的选帧逻辑）
      let clips = 0;
      for (const [name, A] of Object.entries(SPR_ANIMS[cls])) {
        const dur = A.frames ? A.frames.length / A.fps : A[A.length - 1][1] + 0.1;
        for (let t = 0; t <= dur; t += 0.05) { try { m.draw(document.createElement('canvas').getContext('2d'), { __c: name, __t: t }, t, NO_OPTS); } catch (e) { bad.push(name + ':' + e.message); } }
        clips++;
      }
      const missing = [];
      for (const [name, A] of Object.entries(SPR_ANIMS[cls])) for (const fn of (A.frames || A.map(a => a[0]))) if (!S.frames[fn]) missing.push(`${name}/${fn}`);
      const setMissing = sets.flatMap(id => frames.filter(f => !SPR_DATA[`${cls}@${id}`].frames[f]).map(f => `${id}/${f}`));
      res[cls] = { n: frames.length, wpn, bad, green, missing, setMissing, av: !!m.av, looks: looks.length, draws, clips, sets };
    }
    return res;
  });
  for (const [cls, v] of Object.entries(r)) {
    ok(v.bad.length === 0, `${cls}: ${v.n} 帧 × ${v.looks} 种外观（${v.draws} 次）+ ${v.clips} 个动画片段全部能画（${v.wpn} 帧有武器轨迹）${v.bad.length ? ' 出错：' + v.bad.slice(0, 3).join(' ') : ''}`);
    const gk = Object.keys(v.green);
    ok(gk.length === 0, `${cls}: 绿色占位像素残留 ${gk.length ? gk.map(k => k + ':' + v.green[k]).join(' ') : '0'}`);
    ok(v.av, `${cls}: 职业精灵模型自动挂上外观层`);
    if (v.sets.length) ok(v.setMissing.length === 0, `${cls}: 时装 ${v.sets.join(' ')} 帧齐全${v.setMissing.length ? '，缺 ' + v.setMissing.slice(0, 8).join(' ') : ''}`);
    if (v.missing.length) console.log(`    （动画表引用了不存在的帧，走兜底：${v.missing.slice(0, 6).join(' ')}${v.missing.length > 6 ? ' …' : ''}）`);
  }
  console.log('性能：外观层每帧的额外开销');
  const perf = await page.evaluate(() => {
    const cv = document.createElement('canvas'); cv.width = 400; cv.height = 400; const x = cv.getContext('2d');
    const run = (look, n = 3000) => {
      const m = new SpriteModel('sword', SPR_FALLBACK, SPR_ANIMS.sword); if (look) avatarSetLook(m, look); else m.av = null;
      const frames = Object.keys(SPR_DATA.sword.frames).filter(f => SPR_DATA.sword.frames[f].wpn);
      const A = { ...SPR_ANIMS.sword, __all: { fps: 60, frames } }; m.anims = A;
      for (let i = 0; i < 200; i++) m.draw(x, { __c: '__all', __t: i / 60 }, 0, NO_OPTS);   // 预热（握拳小图第一次用到时生成）
      const t = performance.now(); for (let i = 0; i < n; i++) { x.setTransform(1, 0, 0, 1, 200, 380); m.draw(x, { __c: '__all', __t: i / 60 }, 0, NO_OPTS); }
      return (performance.now() - t) / n;
    };
    const base = run(null), wpn = run({ wpn: 'katana', set: null, acc: [] }), all = run({ wpn: 'katana', set: 'festival', acc: Object.keys(AVATAR_ACC) });
    return { base: +base.toFixed(4), wpn: +wpn.toFixed(4), all: +all.toFixed(4) };
  });
  console.log(`    每次绘制：原帧 ${perf.base} ms，+武器 ${perf.wpn} ms，+时装 + 3 件配件 ${perf.all} ms`);
  ok(perf.all - perf.base < 0.25, `外观层每个角色每帧多花 ${(perf.all - perf.base).toFixed(3)} ms（< 0.25 ms，远小于 16.7 ms 的帧预算）`);
  console.log('武器装扮（时装栏 av_weapon）');
  const sk = await page.evaluate(() => {
    const W = (wtype, cls) => ({ key: `${wtype}_1_0`, wtype, cls }), skin = s => ({ key: 'av_weapon_' + s, skin: s });
    const r = {};
    for (const s of Object.values(WEAPON_SKINS)) {
      const types = Object.keys(WTYPES), have = types.filter(t => WEAPON_IMG[`${s}_${t}`]);
      r[s] = { n: have.length, ok: have.every(t => lookFromEquip(WTYPES[t].cls, { weapon: W(t, WTYPES[t].cls), av_weapon: skin(s) }).wpn === `${s}_${t}`) };
    }
    r.noWeapon = lookFromEquip('sword', { av_weapon: skin('spring') }).wpn;
    r.overEpic = lookFromEquip('sword', { weapon: { key: 'ep_katana', wtype: 'katana' }, av_weapon: skin('spring') }).wpn;
    r.byKey = lookFromEquip('gun', { weapon: W('rifle', 'gun'), av_weapon: { key: 'av_weapon_summer' } }).wpn;
    r.dual = WEAPON_IMG.summer_rifle && WEAPON_IMG.summer_rifle.dual === 0 && WEAPON_IMG.spring_revolver.dual !== 0;
    return r;
  });
  for (const s of ['spring', 'summer']) if (sk[s]) ok(sk[s].n === 15 && sk[s].ok, `${s} 装扮覆盖 ${sk[s].n}/15 种武器类型，装上后换成对应的图`);
  ok(sk.noWeapon === null, '只装武器装扮、没装武器：空手');
  ok(sk.overEpic === 'spring_katana', '装扮优先于史诗专属外观');
  ok(sk.byKey === 'summer_rifle', '物品没有 skin 字段时按 key 查表');
  ok(sk.dual, '步枪装扮不双持，左轮装扮双持');
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
                       ...(SPR_DATA['sword@festival'] ? [['庆典时装+太刀', { wpn: 'katana', set: 'festival', acc: ['av_hat_festival', 'av_face_festival', 'av_hair_festival'] }],
                                                        ['庆典时装+光剑', { wpn: 'lightsaber', set: 'festival', acc: [] }]] : [])] },
    }));
    for (const [cls, P] of Object.entries(plan)) {
      const file = await page.evaluate(({ cls, P }) => {
        const cw = 190, ch = 240, lw = 120, W = lw + cw * P.frames.length, H = 30 + ch * P.looks.length;
        const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const x = cv.getContext('2d');
        x.fillStyle = '#46505e'; x.fillRect(0, 0, W, H); x.fillStyle = '#fff'; x.font = '14px sans-serif'; x.textAlign = 'center';
        P.frames.forEach((f, j) => x.fillText(f, lw + cw * j + cw / 2, 20));
        P.looks.forEach(([name, look], i) => {
          x.textAlign = 'left'; x.fillStyle = '#ffe28a'; x.fillText(name, 8, 30 + ch * i + ch / 2);
          P.frames.forEach((f, j) => { const c2 = __av.drawFrame(cls, f, { set: null, acc: [], ...look }, 1.45, cw, ch); x.drawImage(c2, lw + cw * j, 30 + ch * i); });
        });
        return cv.toDataURL('image/png');
      }, { cls, P });
      const path = `${out}/${cls}_looks.png`; fs.writeFileSync(path, Buffer.from(file.split(',')[1], 'base64')); console.log('  写出', path);
    }
  }
  { const errs = logs.filter(l => l.type !== 'warning'); ok(!errs.length, '页面没有报错' + (errs.length ? ' ' + JSON.stringify(errs.slice(0, 3)) : '')); }
  await browser.close();
}

// ================= 2. 游戏里：玩家换武器 / 穿脱时装 / 刷新后仍然正确 =================
const PLAYER_LOOK = () => {
  const p = __G.player, L = p.model.av; L.sync();
  const cv = document.createElement('canvas'); cv.width = 220; cv.height = 240; const x = cv.getContext('2d');
  x.translate(110, 228); x.scale(1.6, 1.6); p.model.draw(x, { __c: 'idle', __t: 0 }, 0, NO_OPTS);
  return { wpn: L.look.wpn, set: L.look.set, parts: L.look.parts, S2: !!L.S2, acc: L.look.acc, hash: __av.hash(cv), green: __av.green(cv) };
};
const EQUIP = keys => {
  game.lvl = Math.max(game.lvl, 30);
  for (const k of keys) { const it = typeof k === 'string' ? makeItem(k) : rollEquip(k); if (!it) return 'no item ' + JSON.stringify(k); inv.add(it); if (!inv.wear(it)) return 'wear failed ' + it.key; }
  return null;
};
for (const cls of ['sword', 'gun', 'mage']) {
  console.log(`游戏里（${cls}）：换武器 / 穿脱时装 / 刷新`);
  const { browser, page, logs } = await launch({ width: 1280, height: 720 });
  await page.goto(`${URL_BASE}?town&cls=${cls}&mute&fresh`);
  await page.waitForFunction(() => window.__READY, null, { timeout: 30000 });
  await page.evaluate(HELPERS);
  const look = () => page.evaluate(PLAYER_LOOK);
  const types = await page.evaluate(cls => Object.keys(WEAPON_IMG).filter(k => k === WEAPON_IMG[k].type && WTYPES[k].cls === cls), cls);
  const seen = {};
  for (const t of types) {
    const err = await page.evaluate(([EQ, t, cls]) => (0, eval)(EQ)([{ slot: 'weapon', wtype: t, lvl: 10, cls, rar: 2 }]   /* 固定稀有品级：不指定时可能随机出史诗（史诗有专属外观 ep_*） */), [`(${EQUIP})`, t, cls]);
    const L = await look(); seen[t] = L.hash;
    ok(!err && L.wpn === t, `装备${t} → 手里的武器图 ${L.wpn}${err ? ' ' + err : ''}`);
  }
  ok(new Set(Object.values(seen)).size === types.length, `${types.length} 种武器外观互不相同`);
  const ep = await page.evaluate(cls => Object.keys(WEAPON_IMG).find(k => k.startsWith('ep_') && ITEMS[k] && WTYPES[WEAPON_IMG[k].type].cls === cls), cls);   // 只挑物品库里已有的史诗（别的组的新史诗合并前不存在）
  if (ep) { await page.evaluate(([EQ, ep]) => (0, eval)(EQ)([ep]), [`(${EQUIP})`, ep]); const L = await look(); ok(L.wpn === ep, `史诗武器 ${ep} 有专属外观`); }
  // 换回普通武器再测时装：史诗武器图本身可能是绿色（幸运草扫把等），会被误算进绿色残留
  await page.evaluate(([EQ, t, cls]) => (0, eval)(EQ)([{ slot: 'weapon', wtype: t, lvl: 10, cls, rar: 2 }]), [`(${EQUIP})`, types[0], cls]);
  const before = await look();
  const hasSet = await page.evaluate(cls => !!SPR_DATA[`${cls}@festival`], cls);
  if (hasSet) {
    await page.evaluate(([EQ]) => (0, eval)(EQ)(['av_top_festival']), [`(${EQUIP})`]);
    await page.waitForFunction(() => __G.player.model.av.S2, null, { timeout: 10000 }).catch(() => {});
    let L = await look(); ok(L.set === 'festival' && L.parts && L.parts.up === 'festival' && !L.parts.low && !L.parts.feet && L.hash !== before.hash, '只穿上衣：上身换成时装，下身、脚是默认造型（混搭）', JSON.stringify({ set: L.set, parts: L.parts }));
    await page.evaluate(([EQ]) => (0, eval)(EQ)(['av_bottom_festival', 'av_shoes_festival', 'av_hat_festival', 'av_face_festival', 'av_hair_festival']), [`(${EQUIP})`]);
    await page.waitForFunction(() => __G.player.model.av.S2 && __G.player.model.av.acc.every(a => IMG['avatar/' + a.img]), null, { timeout: 10000 });   // 时装帧和头部配件图都加载完再截
    L = await look(); ok(L.set === 'festival' && !L.parts && L.S2 && L.hash !== before.hash, `上衣 + 下装 + 鞋同一套 → 整套换成庆典时装（配件 ${L.acc.length} 件）`);
    ok(L.green === 0, '穿时装后没有绿色残留', `（武器外观 ${L.wpn}，绿色像素 ${L.green}）`);
    await page.waitForTimeout(1500); const worn = (await look()).hash;   // 等剩下的图（武器 / 握拳遮罩等）都加载完，外观稳定后再记下来
    await page.evaluate(() => { save.write(); });
    await page.goto(`${URL_BASE}?town&cls=${cls}&mute`); await page.waitForFunction(() => window.__READY, null, { timeout: 30000 }); await page.evaluate(HELPERS);
    await page.waitForFunction(() => __G.player && __G.player.model.av && (__G.player.model.av.sync(), __G.player.model.av.S2 && __G.player.model.av.acc.every(a => IMG['avatar/' + a.img])), null, { timeout: 10000 }).catch(() => {});
    L = await look(); ok(L.set === 'festival' && L.hash === worn, '刷新后外观不变', JSON.stringify({ set: L.set, S2: !!L.S2, same: L.hash === worn, acc: L.acc, wpn: L.wpn }));
    await page.evaluate(() => { inv.unwear('av_top'); });
    L = await look(); ok(L.parts && !L.parts.up && L.parts.low === 'festival' && L.parts.feet === 'festival' && L.hash !== worn, '脱下上衣 → 上身换回默认造型，下身、鞋仍是庆典（混搭）', JSON.stringify({ set: L.set, parts: L.parts }));
    ok(cls === 'sword' ? L.acc.length === 3 : L.acc.length === 1, cls === 'sword' ? '帽子 / 发饰 / 眼镜仍然戴着' : '默认造型自带帽子：上身不是时装时只剩眼镜');
    await page.evaluate(() => { for (const s of ['av_bottom', 'av_shoes', 'av_hat', 'av_hair']) inv.unwear(s); });
    L = await look(); ok(!L.set && !L.parts && L.acc.length === 1, '只剩眼镜（眼镜没有身体帧）→ 身体换回原样，眼镜仍然戴着', JSON.stringify({ set: L.set, acc: L.acc }));
  }
  await page.evaluate(() => inv.unwear('weapon'));
  { const L = await look(); ok(L.wpn === null, '卸下武器 → 空手'); }
  { const errs = logs.filter(l => l.type !== 'warning'); ok(!errs.length, '页面没有报错' + (errs.length ? ' ' + JSON.stringify(errs.slice(0, 3)) : '')); }
  await browser.close();
}

// ================= 3. 连拍（shots）：测试房间里走路 + 普攻三连，每种外观一条 =================
if (SHOTS) {
  const plans = [['katana', [{ slot: 'weapon', wtype: 'katana', lvl: 10, cls: 'sword' }]], ['greatsword', [{ slot: 'weapon', wtype: 'greatsword', lvl: 10, cls: 'sword' }]],
                 ['lightsaber', [{ slot: 'weapon', wtype: 'lightsaber', lvl: 10, cls: 'sword' }]],
                 ['festival', [{ slot: 'weapon', wtype: 'katana', lvl: 10, cls: 'sword' }, 'av_top_festival', 'av_bottom_festival', 'av_hat_festival', 'av_face_festival', 'av_hair_festival']]];
  for (const [name, keys] of plans) {
    const { browser, page } = await launch({ width: 1280, height: 720 });
    await page.goto(`${URL_BASE}?test&mute&cls=sword&mobs=0`); await page.waitForFunction(() => window.__READY);
    await page.evaluate(([EQ, keys]) => { for (const e of __G.ents) if (e.team === 'e') { e.x = 5000; e.control = null; } (0, eval)(EQ)(keys); }, [`(${EQUIP})`, keys]);
    await page.waitForFunction(() => !__G.player.model.av.setKey || __G.player.model.av.S2, null, { timeout: 10000 });
    const kb = page.keyboard, shots = [];
    const snap = async () => {
      const p = await page.evaluate(() => { const p = __G.player; return { x: (p.x - cam.x) * 1280 / 960, y: (FLOOR_Y + p.y - p.z) * 720 / 540 }; });
      shots.push(await page.screenshot({ clip: { x: Math.max(0, Math.min(1280 - 240, p.x - 120)), y: Math.max(0, p.y - 200), width: 240, height: 220 } }));
    };
    await kb.down('ArrowRight'); for (let i = 0; i < 9; i++) { await snap(); await page.waitForTimeout(70); } await kb.up('ArrowRight');
    await page.waitForTimeout(200);
    for (let i = 0; i < 3; i++) { await kb.press('KeyX'); for (let j = 0; j < 3; j++) { await snap(); await page.waitForTimeout(45); } }
    // 拼成一条
    const url = await page.evaluate(async bufs => {
      const ims = await Promise.all(bufs.map(b => new Promise(r => { const im = new Image(); im.onload = () => r(im); im.src = 'data:image/png;base64,' + b; })));
      const per = 6, cv = document.createElement('canvas'); cv.width = 240 * per; cv.height = 220 * Math.ceil(ims.length / per); const x = cv.getContext('2d');
      ims.forEach((im, i) => x.drawImage(im, (i % per) * 240, Math.floor(i / per) * 220)); return cv.toDataURL('image/png');
    }, shots.map(b => b.toString('base64')));
    const path = `${out}/burst_${name}.png`; fs.writeFileSync(path, Buffer.from(url.split(',')[1], 'base64')); console.log('  写出', path);
    await browser.close();
  }
}

if (fail) { console.log(`\n${fail} 项失败`); process.exit(1); }
console.log('\n全部通过');
