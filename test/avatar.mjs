// 外观与换装测试：node test/avatar.mjs [shots]（先 node build.mjs）
//   1. 换武器类型 → 外观改变；穿上 / 脱下时装 → 外观切换；刷新后仍然正确
//   2. 截图里没有绿色占位像素残留
//   3. 三个职业所有动画片段、所有帧都能正常绘制（有武器轨迹的帧武器也画出来）
//   shots：另外把「帧 × 外观」拼成大图写到 test/shots/avatar/，给人逐帧看
import { launch, URL_BASE, openLists } from './lib.mjs';
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
    for (const cls of openClasses()) {   // 已开放的职业（ready:false 的不查）
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
      const types = Object.keys(WTYPES).filter(t => clsOpen(WTYPES[t].cls)), have = types.filter(t => WEAPON_IMG[`${s}_${t}`]);   // 已开放职业的武器类型
      r[s] = { n: have.length, all: types.length, ok: have.every(t => lookFromEquip(WTYPES[t].cls, { weapon: W(t, WTYPES[t].cls), av_weapon: skin(s) }).wpn === `${s}_${t}`) };
    }
    r.noWeapon = lookFromEquip('sword', { av_weapon: skin('spring') }).wpn;
    r.overEpic = lookFromEquip('sword', { weapon: { key: 'ep_katana', wtype: 'katana' }, av_weapon: skin('spring') }).wpn;
    r.byKey = lookFromEquip('gun', { weapon: W('rifle', 'gun'), av_weapon: { key: 'av_weapon_summer' } }).wpn;
    r.dual = WEAPON_IMG.summer_rifle && WEAPON_IMG.summer_rifle.dual === 0 && WEAPON_IMG.spring_revolver.dual !== 0;
    r.skins = Object.values(WEAPON_SKINS);
    return r;
  });
  for (const s of sk.skins) ok(sk[s].n === sk[s].all && sk[s].all >= 15 && sk[s].ok, `${s} 装扮覆盖 ${sk[s].n}/${sk[s].all} 种武器类型，装上后换成对应的图`);
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
const PLAYER_LOOK = async () => {
  const p = __G.player, L = p.model.av; L.sync();
  if (L.A && !L.wim) { await loadArtKey('weapon/' + L.look.wpn); L.wim = IMG['weapon/' + L.look.wpn]; }   // 武器图按需加载（weapon 包）：等这把加载完再画
  const cv = document.createElement('canvas'); cv.width = 220; cv.height = 240; const x = cv.getContext('2d');
  x.translate(110, 228); x.scale(1.6, 1.6); p.model.draw(x, { __c: 'idle', __t: 0 }, 0, NO_OPTS);
  return { wpn: L.look.wpn, set: L.look.set, parts: L.look.parts, S2: !!L.S2, acc: L.look.acc, hash: __av.hash(cv), green: __av.green(cv) };
};
const EQUIP = keys => {
  game.lvl = Math.max(game.lvl, 30);
  for (const k of keys) { const it = typeof k === 'string' ? makeItem(k) : rollEquip(k); if (!it) return 'no item ' + JSON.stringify(k); inv.add(it); if (!inv.wear(it)) return 'wear failed ' + it.key; }
  return null;
};
for (const cls of (await openLists()).classes) {
  console.log(`游戏里（${cls}）：换武器 / 穿脱时装 / 刷新`);
  const { browser, page, logs } = await launch({ width: 1280, height: 720 });
  await page.goto(`${URL_BASE}?town&cls=${cls}&mute&fresh`);
  await page.waitForFunction(() => window.__READY, null, { timeout: 30000 });
  await page.evaluate(HELPERS);
  const look = () => page.evaluate(PLAYER_LOOK);
  const types = await page.evaluate(cls => Object.keys(WEAPON_IMG).filter(k => k === WEAPON_IMG[k].type && WTYPES[k].cls === cls), cls);
  const seen = {};
  for (const t of types) {
    const job0 = await page.evaluate(t => { const j = game.job; if (WTYPES[t].jobs) game.job = WTYPES[t].jobs[0]; return j; }, t);   // 转职专用武器（拳套只给散打）：先切到能用的转职，看完外观再切回来
    const err = await page.evaluate(([EQ, t, cls]) => (0, eval)(EQ)([{ slot: 'weapon', wtype: t, lvl: 10, cls, rar: 2 }]   /* 固定稀有品级：不指定时可能随机出史诗（史诗有专属外观 ep_*） */), [`(${EQUIP})`, t, cls]);
    const L = await look(); seen[t] = L.hash; await page.evaluate(j => { game.job = j; }, job0);
    ok(!err && L.wpn === t + '_r2', `装备稀有${t} → 手里的武器图 ${L.wpn}（稀有品级外观）${err ? ' ' + err : ''}`);
  }
  ok(new Set(Object.values(seen)).size === types.length, `${types.length} 种武器外观互不相同`);
  const ep = await page.evaluate(cls => Object.keys(WEAPON_IMG).find(k => k.startsWith('ep_') && ITEMS[k] && ITEMS[k].lvl <= 30 && WTYPES[WEAPON_IMG[k].type].cls === cls), cls);   // 只挑物品库里已有的史诗（别的组的新史诗合并前不存在）
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
    ok(['sword', 'fighter'].includes(cls) ? L.acc.length === 3 : L.acc.length === 1, ['sword', 'fighter'].includes(cls) ? '帽子 / 发饰 / 眼镜仍然戴着' : '默认造型自带帽子：上身不是时装时只剩眼镜');
    await page.evaluate(() => { for (const s of ['av_bottom', 'av_shoes', 'av_hat', 'av_hair']) inv.unwear(s); });
    L = await look(); ok(!L.set && !L.parts && L.acc.length === 1, '只剩眼镜（眼镜没有身体帧）→ 身体换回原样，眼镜仍然戴着', JSON.stringify({ set: L.set, acc: L.acc }));
  }
  await page.evaluate(() => inv.unwear('weapon'));
  { const L = await look(); ok(L.wpn === null, '卸下武器 → 空手'); }
  { const errs = logs.filter(l => l.type !== 'warning'); ok(!errs.length, '页面没有报错' + (errs.length ? ' ' + JSON.stringify(errs.slice(0, 3)) : '')); }
  await browser.close();
}

// ================= 2b. 混搭：上身 / 下身 / 脚分别取上衣 / 下装 / 鞋那套 =================
{
  console.log('混搭（上衣 / 下装 / 鞋各取各的套装）');
  const { browser, page, logs } = await launch({ width: 1280, height: 720 });
  await page.goto(`${URL_BASE}?art&m=sword`);
  await page.waitForFunction(() => window.__ART_READY, null, { timeout: 30000 });
  const r = await page.evaluate(() => {
    const eqOf = o => { const e = {}; for (const [slot, set] of Object.entries(o)) if (set) e[slot] = { key: `${slot}_${set}`, slot, set: 'av_' + set }; return e; };
    // 按身体轴离腰线的距离取一条带，比较拼好的帧和各来源帧（按脚底锚点对齐）在带里的像素差：应该和“该来的那套”最像
    const place = (im, F, W, H, AX, AY) => { const [c, x] = offCanvas(W, H); x.drawImage(im, AX - F.ax, AY - F.ay); return x.getImageData(0, 0, W, H).data; };
    const bandCheck = (cls, f, look) => {
      const m = new SpriteModel(cls, SPR_FALLBACK, SPR_ANIMS[cls]); avatarSetLook(m, look);
      const got = m.av.frame(m, f); const B = SPR_DATA[cls].frames[f], cut = B.cut; if (!got || !cut) return { f, skip: true };
      const W = got.im.width, H = got.im.height, AX = got.F.ax, AY = got.F.ay, C = got.im.getContext('2d').getImageData(0, 0, W, H).data;
      const src = id => id ? { im: IMG[`spr/${cls}@${id}/${f}`], F: SPR_DATA[`${cls}@${id}`].frames[f] } : { im: IMG[`spr/${cls}/${f}`], F: B };
      const ux = Math.sin(cut.a), uy = Math.cos(cut.a), wx = cut.wx - B.ax + AX, wy = cut.wy - B.ay + AY;
      const bands = [['up', -40, -12], ['low', 12, cut.kd - 12], ['feet', cut.kd + 10, cut.kd + 34]];
      const P = look.parts, res = {};
      const cands = [...new Set([P.up, P.low, P.feet])];
      const imgs = Object.fromEntries(cands.map(id => { const s = src(id); return [id || '', place(s.im, s.F, W, H, AX, AY)]; }));
      for (const [name, d0, d1] of bands) {
        if (d1 <= d0) continue;
        const want = P[name] || '', err = {}; let n = 0;
        for (const id of Object.keys(imgs)) err[id] = 0;
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
          const d = (x - wx) * ux + (y - wy) * uy; if (d < d0 || d > d1) continue;
          const i = (y * W + x) * 4; if (C[i + 3] < 200) continue; n++;
          for (const id in imgs) { const S = imgs[id]; err[id] += S[i + 3] < 200 ? 255 : (Math.abs(C[i] - S[i]) + Math.abs(C[i + 1] - S[i + 1]) + Math.abs(C[i + 2] - S[i + 2])) / 3; }
        }
        if (n < 30) continue;
        for (const id in err) err[id] /= n;
        const best = Object.keys(err).reduce((a, b) => err[a] <= err[b] ? a : b);
        res[name] = { want, best, e: Math.round(err[want]) };
      }
      return { f, res };
    };
    const out = {};
    const combos = {
      gunUser: ['gun', { av_hair: 'sky1', av_hat: 'sky1', av_face: 'sky1', av_chest: 'sky1', av_belt: 'sky1', av_top: 'academy', av_bottom: 'sky2', av_shoes: 'sky2' }],
      sword: ['sword', { av_top: 'summer', av_bottom: 'sky2', av_shoes: 'spring' }],
      mage: ['mage', { av_top: 'spring', av_bottom: 'academy', av_shoes: 'sky1', av_hat: 'spring' }],
      gunTopOnly: ['gun', { av_top: 'academy' }],
    };
    for (const [name, [cls, o]] of Object.entries(combos)) {
      const look = lookFromEquip(cls, eqOf(o));
      const frames = ['idle', 'walk1', 'walk3', 'walk5', 'walk7', 'run2', 'run6', ...Object.keys(SPR_DATA[cls].frames).filter(f => /^(a1_2|shoot1|m1_2|cast1|jump3)$/.test(f))];
      const checks = frames.map(f => bandCheck(cls, f, look));
      const bad = checks.filter(c => !c.skip && Object.values(c.res).some(b => b.best !== b.want));
      // 拼不了的帧：整个人用 lookBodySet 选的那套
      const m = new SpriteModel(cls, SPR_FALLBACK, SPR_ANIMS[cls]); avatarSetLook(m, look);
      const unsplit = Object.keys(SPR_DATA[cls].frames).filter(f => !SPR_DATA[cls].frames[f].cut);
      const fbBad = unsplit.filter(f => { const g = m.av.frame(m, f); return look.set ? !(g && g.im === IMG[`spr/${cls}@${look.set}/${f}`]) : !!g; });
      // 帽子 / 发饰：默认带帽职业只有上身是时装才显示
      out[name] = { look: { set: look.set, parts: look.parts, acc: look.acc }, n: checks.filter(c => !c.skip).length, bad: bad.map(b => b.f + JSON.stringify(b.res)), unsplit, fbBad, sample: checks.find(c => !c.skip) };
    }
    // 缓存有上限、被挤掉的画布会重拼；拼好之后每帧只多一次 drawImage（和整套时装一样）
    const cnt = (m, f) => { const [c, x] = offCanvas(300, 300); let n = 0; const d = x.drawImage.bind(x); x.drawImage = (...a) => { n++; return d(...a); }; x.translate(150, 290); m.draw(x, { __c: '__one', __t: 0 }, 0, NO_OPTS); return n; };
    const mk = (cls, look, f) => { const m = new SpriteModel(cls, SPR_FALLBACK, { ...SPR_ANIMS[cls], __one: [[f, 0]] }); avatarSetLook(m, look); return m; };
    const lk = { wpn: 'revolver', set: 'sky1', parts: { up: 'academy', low: 'sky2', feet: 'sky2' }, acc: [] };
    const m1 = mk('gun', lk, 'walk3'), m2 = mk('gun', { ...lk, parts: null }, 'walk3');
    cnt(m1, 'walk3'); cnt(m2, 'walk3');
    const calls = [cnt(m1, 'walk3'), cnt(m2, 'walk3')];
    const sets = Object.values(AVATAR_SETS).map(S => S.id);
    for (const cls of openClasses()) for (let i = 0; i < 4; i++) {
      const look = { wpn: null, set: sets[i], parts: { up: sets[i], low: sets[(i + 1) % sets.length], feet: sets[(i + 2) % sets.length] }, acc: [] };
      for (const f of Object.keys(SPR_DATA[cls].frames)) { const mm = mk(cls, look, f); mm.av.frame(mm, f); }
    }
    const size = MIX_CACHE.size;
    const again = m1.av.frame(m1, 'walk3');   // 早先拼的已经被挤掉了：应该重拼出来（不是空画布）
    return { out, calls, size, max: MIX_MAX, againOk: !!again && again.im.width > 0 && !again.dead };
  });
  for (const [name, v] of Object.entries(r.out)) {
    ok(!!v.look.parts, `${name}：lookFromEquip 给出混搭 ${JSON.stringify(v.look.parts)}（整套备选 ${v.look.set}）`);
    ok(v.bad.length === 0, `${name}：${v.n} 帧拼好的上身 / 下身 / 脚分别和上衣 / 下装 / 鞋那套一致`, v.bad.slice(0, 3).join(' '));
    ok(v.fbBad.length === 0, `${name}：拼不了的 ${v.unsplit.length} 帧（${v.unsplit.join(' ')}）整个人用 lookBodySet 选的 ${v.look.set || '默认造型'}`, v.fbBad.join(' '));
  }
  ok(r.out.gunUser.look.acc.includes('av_hat_sky1'), '神枪手上身是时装（学院）→ 天空套帽子显示');
  ok(!r.out.gunTopOnly.look.parts.low && !r.out.gunTopOnly.look.parts.feet, '只穿上衣：下身、脚是默认造型');
  ok(r.out.mage.look.acc.includes('av_hat_spring'), '魔法师上身是时装 → 帽子显示');
  ok(r.calls[0] === r.calls[1], `拼好之后每帧的 drawImage 次数和整套时装一样（${r.calls[0]} / ${r.calls[1]}）`);
  ok(r.size <= r.max && r.againOk, `拼帧缓存有上限（${r.size} ≤ ${r.max}），被挤掉的帧会重拼`);
  { const errs = logs.filter(l => l.type !== 'warning'); ok(!errs.length, '页面没有报错' + (errs.length ? ' ' + JSON.stringify(errs.slice(0, 3)) : '')); }
  await browser.close();
}
// ---- 城镇里：混搭路人 + 联机发给别人的外观带着 parts ----
{
  console.log('城镇：混搭路人、联机外观');
  const { browser, page, logs } = await launch({ width: 1280, height: 720 });
  await page.goto(`${URL_BASE}?town&cls=gun&mute&fresh`);
  await page.waitForFunction(() => window.__READY, null, { timeout: 30000 });
  const r = await page.evaluate(async () => {
    game.lvl = 30;
    for (const k of ['av_hair_sky1', 'av_hat_sky1', 'av_face_sky1', 'av_chest_sky1', 'av_belt_sky1', 'av_top_academy', 'av_bottom_sky2', 'av_shoes_sky2']) { const it = makeItem(k); if (!it) return { err: k }; inv.add(it); inv.wear(it); }
    const info = typeof netCharInfo === 'function' ? netCharInfo() : null;
    const sent = info && JSON.parse(JSON.stringify(info.look));
    // 别人那边：按收到的外观建模型，画出来应该和自己一样
    await new Promise(res => setTimeout(res, 1500));
    const draw = m => { const [c, x] = offCanvas(220, 240); x.translate(110, 228); x.scale(1.6, 1.6); m.draw(x, { __c: 'idle', __t: 0 }, 0, NO_OPTS); return c.toDataURL(); };
    const other = new SpriteModel('gun', SPR_FALLBACK, SPR_ANIMS.gun); avatarSetLook(other, sent); draw(other);
    await new Promise(res => setTimeout(res, 800));
    const same = draw(other) === draw(__G.player.model);
    // 路人：去中央广场，凑满 8 个路人，全部换成混搭，跑 3 秒，看拼帧缓存和帧时间
    await enterScene('hm_plaza'); await new Promise(res => setTimeout(res, 2500));
    for (let i = 0; world.crowd.length < 8 && i < 20; i++) { const w = makePasserby(world.S, new Set(world.crowd.map(c => c.name)), Math.random()); if (w) world.crowd.push(w); }
    const sets = Object.values(AVATAR_SETS).map(S => S.id);
    world.crowd.forEach((w, i) => avatarSetLook(w.model, { wpn: null, set: sets[i % sets.length], parts: { up: sets[i % sets.length], low: sets[(i + 2) % sets.length], feet: i % 3 ? sets[(i + 4) % sets.length] : null }, acc: [] }));
    for (const w of world.crowd) { w.st = 'move'; w.pose.__c = 'walk'; w.tx = w.x + (Math.random() < 0.5 ? -600 : 600); w.ty = w.y; }
    await new Promise(res => setTimeout(res, 1500));   // 分包加载 + 预热
    let frames = 0, worst = 0, last = performance.now(); const t0 = last;
    await new Promise(res => { const f = () => { const t = performance.now(); worst = Math.max(worst, t - last); last = t; frames++; if (t - t0 < 3000) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); });
    return { parts: sent && sent.parts, same, crowd: world.crowd.length, mixed: world.crowd.filter(w => w.model.av && w.model.av.parts).length, fps: +(frames / 3).toFixed(1), worst: +worst.toFixed(1), cache: MIX_CACHE.size, max: MIX_MAX };
  });
  ok(!r.err, '穿上用户的混搭' + (r.err ? ' 缺物品 ' + r.err : ''));
  ok(r.parts && r.parts.up === 'academy' && r.parts.low === 'sky2', `联机发给别人的外观带着 parts ${JSON.stringify(r.parts)}`);
  ok(r.same, '别人按收到的外观画出来和自己看到的一样');
  ok(r.mixed >= 2 && r.cache <= r.max, `城镇里 ${r.mixed}/${r.crowd} 个混搭路人：拼帧缓存 ${r.cache} ≤ ${r.max}`);
  ok(r.fps >= 50, `城镇走动 3 秒：${r.fps} fps，最长一帧 ${r.worst} ms`);
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
