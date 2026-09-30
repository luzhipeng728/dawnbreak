// 格斗家（男）外观测试（B2，docs/FIGHTER_ART_SAMPLES.md §9）：node test/fighter_looks.mjs [shots] [live]（先 node build.mjs）
//   检查（默认，约 20 秒，?fighter=1 强制开放）：
//     1. 动作片段：4 个转职 J.anims 的片段都解析到真帧；B1 的 25 个转职专属帧都有片段在用；列出退回基础帧的片段
//     2. 转职外观：JOB_LOOKS 4 条（头饰有图、有 fighter / fighter@ 位置、道服换色只染原装帧、状态跟着 BUFF 开关）
//     3. 武器：5 类 × 普通 / 稀有 / 神器 / 传说 + 6 款装扮都有图（手套 / 拳套 / 爪 / 臂铠 cover、东方棍握着）、图标、流沙图标；手上真的画出来了（远侧拳按拳头裁）
//     4. 时装：6 套 × 91 帧都在，锚点齐全；时装配件都有 fighter 位置；路人里有格斗家（开放后）
//     5. 全组合画一遍不报错
//   shots：总览图 test/shots/fighter_looks/{jobs,weapons,costumes,heads}.jpg（直接用游戏的模型绘制，1.3 倍，和鬼剑士对照）
//   live：测试房间实拍（每个转职 站立 / 跑 / 普攻 3 段 / 一个技能）+ 城镇路人 + 选角 / 世界地图 → live.jpg、screens.jpg
import { launch, URL_BASE } from './lib.mjs';
import fs from 'fs';
import { execFileSync } from 'child_process';
const SHOTS = process.argv.includes('shots'), LIVE = process.argv.includes('live');
const out = 'test/shots/fighter_looks'; fs.mkdirSync(out, { recursive: true });
let fail = 0; const ok = (c, msg, x = '') => { console.log((c ? '  ✓ ' : '  ✗ ') + msg, x); if (!c) fail++; };
const JOBS = ['nenmaster', 'striker', 'brawler', 'grappler'];
const TYPES = ['knuckle', 'boxing', 'claw', 'tonfa', 'gauntlet'];
const SKINS = ['spring', 'summer', 'holywing', 'flamedragon', 'academy', 'gothic'];
const SETS = ['summer', 'festival', 'spring', 'academy', 'sky1', 'sky2'];
const JOB_WPN = { null: 'knuckle', nenmaster: 'knuckle_r4', striker: 'boxing_r4', brawler: 'claw_r4', grappler: 'gauntlet_r4' };
const save = (url, name) => { fs.writeFileSync(`${out}/${name}.png`, Buffer.from(url.split(',')[1], 'base64')); execFileSync('python3', ['-c', `from PIL import Image; Image.open('${out}/${name}.png').convert('RGB').save('${out}/${name}.jpg', quality=86)`]); fs.rmSync(`${out}/${name}.png`); console.log('  总览', `${out}/${name}.jpg`); };

const { browser, page, logs } = await launch({ width: 960, height: 540 });
await page.goto(`${URL_BASE}?town&mute&cls=fighter&fighter=1&fresh`); await page.waitForFunction(() => window.__READY, null, { timeout: 120000 }); await page.waitForTimeout(500);
await page.evaluate(async ([TYPES, SETS]) => {
  await loadBundles(['spr:fighter', 'spr:sword', ...SETS.map(s => 'spr:fighter@' + s), ...SETS.map(s => 'spr:sword@' + s)]);
  window.__fl = {
    // 装备：武器 key（类型 / 品级外观 / 装扮 <装扮>_<类型>）、整套时装、时装配件
    eq(o = {}) {
      const e = {}, w = o.wpn;
      if (w) { const A = WEAPON_IMG[w], t = A ? A.type : w, sk = w.includes('_') && !/_r\d$/.test(w) ? w.split('_')[0] : null, r = /_r(\d)$/.exec(w);
        e.weapon = { key: t + '_item', slot: 'weapon', kind: 'equip', wtype: t, rar: r ? +r[1] : 0, cls: WTYPES[t] ? WTYPES[t].cls : undefined, enh: o.enh || 0 };
        if (sk) e.av_weapon = { key: 'av_weapon_' + sk, skin: sk }; }
      if (o.set) { for (const s of ['av_top', 'av_bottom', 'av_shoes']) e[s] = { set: 'av_' + o.set }; for (const p of o.acc || []) e['av_' + p] = { key: `av_${p}_${o.set}`, set: 'av_' + o.set }; }
      return e;
    },
    look(cls, job, o) { return lookFromEquip(cls, this.eq(o), undefined, job); },
    model(cls, look) { const m = new SpriteModel(cls, SPR_FALLBACK, SPR_ANIMS[cls]); avatarSetLook(m, look); return m; },
    async ready(looks) { for (const L of looks) if (L.wpn) await loadArtKey('weapon/' + L.wpn); for (const k of Object.keys(AVATAR_ACC)) await loadArtKey('avatar/' + AVATAR_ACC[k].img); },
    // 按固定帧画一个模型（原点 = 脚底）
    drawAt(x, m, f, X, Y, S = 1.3) { m.frameOf = () => f; x.save(); x.translate(X, Y); x.scale(S, S); m.draw(x, { __c: 'idle', __t: 0 }, 0, NO_OPTS); x.restore(); },
    // 总览图：rows = [{ name, sub, cells: [{ cls, look, f, ent?, zoom? }] }]
    async sheet(title, cols, rows, o = {}) {
      const S = o.S || 1.3, CW = o.CW || 150, CH = o.CH || 196, LW = 118, TH = 26, W = LW + cols.length * CW, H = TH + rows.length * CH;
      const cells = []; for (const [ri, R] of rows.entries()) for (const [ci, C] of R.cells.entries()) if (C) cells.push({ ri, ci, C, m: C.m || this.model(C.cls, C.look) });
      await this.ready(cells.map(c => c.C.look));
      const [cv, x] = offCanvas(W, H);
      const draw = () => {
        x.fillStyle = '#201c24'; x.fillRect(0, 0, W, H); x.font = 'bold 12px sans-serif'; x.fillStyle = '#ffe2a0'; cols.forEach((t, i) => x.fillText(t, LW + i * CW + 4, 17));
        for (const { ri, ci, C, m } of cells) {
          const X = LW + ci * CW, Y = TH + ri * CH; x.save(); x.beginPath(); x.rect(X + 2, Y + 2, CW - 4, CH - 4); x.clip(); x.fillStyle = C.bg || '#8f9aa6'; x.fillRect(X, Y, CW, CH);
          if (C.zoom) { const F = m.S.frames[C.f] || m.S.frames.idle, H0 = F.head || { x: F.ax, y: 40 }, k = C.zoom / m.S.res; this.drawAt(x, m, C.f, X + CW / 2 - (H0.x - F.ax) * k, Y + CH / 2 - (H0.y + 10 - F.ay) * k, C.zoom); }
          else this.drawAt(x, m, C.f, X + CW / 2, Y + CH - 14, S);
          x.fillStyle = 'rgba(0,0,0,.55)'; x.fillRect(X + 2, Y + CH - 13, CW - 4, 11); x.fillStyle = '#e8e0d0'; x.font = '9px sans-serif'; x.fillText(C.tag || C.f, X + 4, Y + CH - 4); x.restore();
        }
        x.font = 'bold 13px sans-serif'; rows.forEach((R, i) => { x.fillStyle = '#fff0d0'; x.fillText(R.name, 6, TH + i * CH + CH / 2); x.font = '10px sans-serif'; x.fillStyle = '#b0a898'; (R.sub || '').split('\n').forEach((s, k) => x.fillText(s, 6, TH + i * CH + CH / 2 + 15 + k * 12)); x.font = 'bold 13px sans-serif'; });
        x.fillStyle = '#ffffff'; x.font = 'bold 13px sans-serif'; x.fillText(title, 6, 17);
      };
      draw(); await new Promise(r => setTimeout(r, 1200)); draw();
      return cv.toDataURL('image/png');
    },
  };
}, [TYPES, SETS]);

console.log('1. 转职动作片段接上 B1 的专属帧');
const r1 = await page.evaluate(JOBS => {
  const F = SPR_DATA.fighter.frames, A = SPR_ANIMS.fighter, res = { missing: [], unused: [], fallback: {}, clips: 0 };
  const framesOf = c => c.frames ? c.frames : c.map(e => e[0]);
  const own = Object.keys(F).filter(f => /^f[nsbg]_/.test(f)), used = new Set();
  for (const c in A) for (const f of framesOf(A[c])) used.add(f);
  res.unused = own.filter(f => !used.has(f));
  for (const j of JOBS) {
    const J = CLASSES.fighter.jobs[j], pre = { nenmaster: 'fn', striker: 'fs', brawler: 'fb', grappler: 'fg' }[j];
    for (const c of Object.keys(J.anims || {})) {
      res.clips++; const fr = framesOf(A[c]);
      for (const f of fr) if (!F[f]) res.missing.push(`${j}.${c}:${f}`);
      if (!fr.some(f => f.startsWith(pre + '_'))) (res.fallback[j] ||= []).push(`${c}=${fr.join('/')}`);
    }
  }
  return res;
}, JOBS);
ok(!r1.missing.length, `4 个转职 ${r1.clips} 个动作片段都解析到真帧（没有落回站姿兜底）`, JSON.stringify(r1.missing));
ok(!r1.unused.length, 'B1 的 25 个转职专属帧（fn_ fs_ fb_ fg_）全部有片段在用', JSON.stringify(r1.unused));
console.log('    用基础格斗家帧的转职片段（姿势本来就是共用的：掌推 / 结印 / 下劈 / 抓 / 旋风腿…）：', JSON.stringify(r1.fallback));

console.log('2. 转职外观（JOB_LOOKS）');
const r2 = await page.evaluate(async JOBS => {
  const res = { noLook: [], noArt: [], noPos: [], dup: [], states: [], outfit: {}, costumeRecolor: null };
  const sig = { '|': 'base' };
  for (const j of JOBS) {
    const J = JOB_LOOKS[j]; if (!J) { res.noLook.push(j); continue; }
    const s = (J.outfit || '') + '|' + (J.acc || []).join(','); if (sig[s]) res.dup.push(j + '=' + sig[s]); sig[s] = j;
    for (const k of J.acc || []) { const A = AVATAR_ACC[k]; await loadArtKey('avatar/' + (A && A.img)); if (!A || !IMG['avatar/' + A.img]) res.noArt.push(k); else if (!A.pos.fighter || !A.pos['fighter@']) res.noPos.push(k); }
  }
  // 道服换色：原装站姿换出来的像素平均色接近目标色、只在身体（头以下）；时装帧（L.alt）不染
  const Fi = SPR_DATA.fighter.frames.idle, im = IMG['spr/fighter/idle'];
  for (const j of JOBS) {
    const col = JOB_LOOKS[j].outfit; if (!col) continue;
    const o = jlHairImg(im, Fi, Fi.head, 'fighter', col, JL_OUTFIT_PICK.fighter); if (!o) { res.outfit[j] = 'none'; continue; }
    const d = o.cv.getContext('2d').getImageData(0, 0, o.cv.width, o.cv.height).data; let n = 0, r = 0, g = 0, b = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 200) { n++; r += d[i]; g += d[i + 1]; b += d[i + 2]; }
    const [tr, tg, tb] = hexRgb(col), k = (r + g + b) / n / (tr + tg + tb);
    res.outfit[j] = { area: +(n / (Fi.w * Fi.h)).toFixed(3), err: +(Math.hypot(r / n - tr * k, g / n - tg * k, b / n - tb * k) / 255).toFixed(2), top: o.y - Fi.head.y };
  }
  // 穿时装：外观层 alt 有帧 → jlHair 不画道服色（数一下 drawImage 次数）
  const m = __fl.model('fighter', __fl.look('fighter', 'nenmaster', { set: 'summer' })), [cv, c] = offCanvas(200, 260); c.translate(100, 240);
  m.draw(c, { __c: 'idle', __t: 0 }, 0, NO_OPTS); await new Promise(r => setTimeout(r, 300));
  let n0 = 0; const d0 = c.drawImage; c.drawImage = function () { n0++; return d0.apply(this, arguments); };
  const L = m.av, F = L.frame(m, 'f_jab2').F; jlHair(c, L, m, 'f_jab2', F); res.costumeRecolor = n0; c.drawImage = d0;
  // 状态特效跟着 BUFF 开关（测试房间外：自己造一个格斗家实体）
  const p = game.player;
  for (const j of JOBS) {
    const g = makePlayer('fighter', { team: 'p', kit: { bar: [], lv: {}, job: j, wtype: null }, name: j, pad: new Pad() }); g.x = p.x + 60; g.y = p.y; g.control = null; ents.push(g);
    avatarSetLook(g.model, __fl.look('fighter', j, { wpn: 'knuckle' }));
    const draw = () => { c.setTransform(1, 0, 0, 1, 100, 240); g.model.draw(c, g.pose, game.t, NO_OPTS); return g.model.av; };
    for (const S of JOB_LOOKS[j].states || []) {
      const has = () => (draw().jfx || []).some(([x]) => x === S.fx);
      const a = has(); S.demo(g); const b = has(); g.buffs = {}; const cc = has();
      if (a || !b || cc) res.states.push(`${j}.${S.id}:${a}/${b}/${cc}`);
    }
    ents.splice(ents.indexOf(g), 1);
  }
  return res;
}, JOBS);
ok(!r2.noLook.length && !r2.dup.length, '4 个转职都有外观条目，道服色 + 头饰两两不同', JSON.stringify([r2.noLook, r2.dup]));
ok(!r2.noArt.length && !r2.noPos.length, '转职头饰都有图、都写了 fighter / fighter@ 位置', JSON.stringify([r2.noArt, r2.noPos]));
ok(Object.values(r2.outfit).every(o => o.area > 0.03 && o.err < 0.15 && o.top > 10), '道服换色：原装马甲换成转职颜色（只在头以下）', JSON.stringify(r2.outfit));
ok(r2.costumeRecolor === 0, '穿时装时不染道服色', r2.costumeRecolor);
ok(!r2.states.length, '状态特效跟着 BUFF 开关（龙虎啸 / 风雷啸 / 烈焰焚步 / 霸体护甲 / 强化投掷 / 挑衅 / 暴力抓取）', JSON.stringify(r2.states));

console.log('3. 武器（5 类 × 品级 + 装扮、图标）');
const r3 = await page.evaluate(async ([TYPES, SKINS]) => {
  const res = { noArt: [], noIcon: [], cover: [], drawn: [], shop: 0, bad: [] };
  for (const t of TYPES) {
    for (const k of [t, t + '_r2', t + '_r3', t + '_r4', ...SKINS.map(s => s + '_' + t)]) {
      const A = WEAPON_IMG[k]; if (!A) { res.noArt.push(k); continue; }
      if (A.type !== t) res.bad.push(k + ':type'); if (!!A.cover !== (t !== 'tonfa')) res.cover.push(k);
      await loadArtKey('weapon/' + k); if (!IMG['weapon/' + k]) res.noArt.push(k + ':img');
    }
    for (const ic of [`icon/item_w_${t}`, `icon/item_sand_${t}`]) if (!ASSET_SRC[ic]) res.noIcon.push(ic);
  }
  if (!ASSET_SRC['icon/w_fighter']) res.noIcon.push('icon/w_fighter');
  // 手上真的画了：每类武器 idle 帧（两只拳都有锚点）比空手多出来的像素
  const px = look => { const m = __fl.model('fighter', look), [cv, c] = offCanvas(200, 260); __fl.drawAt(c, m, 'idle', 100, 240, 1); return c.getImageData(0, 0, 200, 260).data; };
  const bare = px({ wpn: null, set: null, acc: [] });
  for (const t of TYPES) { const d = px(__fl.look('fighter', null, { wpn: t })); let n = 0; for (let i = 0; i < d.length; i += 4) if (Math.abs(d[i] - bare[i]) + Math.abs(d[i + 1] - bare[i + 1]) + Math.abs(d[i + 2] - bare[i + 2]) + Math.abs(d[i + 3] - bare[i + 3]) > 60) n++; res.drawn.push([t, n]); }
  // 商店：格斗家武器货架有 5 类
  // 手臂层（按帧重画的戴武器小臂 + 拳头，art/tools/fighter_arms_art.py）：5 类都有、帧齐全；拿拳套时站立帧真的走手臂层；稀有 / 装扮换了色
  res.arm = TYPES.map(t => [t, SPR_DATA['farm_' + t] ? Object.keys(SPR_DATA['farm_' + t].frames).length : 0]);
  await loadBundles(TYPES.map(t => 'spr:farm_' + t));
  const am = __fl.model('fighter', __fl.look('fighter', null, { wpn: 'boxing' })), [acv, acx] = offCanvas(200, 260); __fl.drawAt(acx, am, 'idle', 100, 240, 1); res.armUsed = !!(am.av.fr && am.av.fr.ov);
  const tintOf = k => { const mm = __fl.model('fighter', __fl.look('fighter', null, { wpn: k })); __fl.drawAt(acx, mm, 'idle', 100, 240, 1); return mm.av.fr && mm.av.fr.ov && mm.av.fr.ov.im; };
  res.tint = new Set(['boxing', 'boxing_r2', 'boxing_r4', 'summer_boxing', 'gothic_boxing'].map(tintOf)).size;
  const T = SHOPS.fengzhen.tabs[0], goods = typeof T.goods === 'function' ? [10, 30, 60].flatMap(l => T.goods(l)) : T.goods;
  res.shop = new Set(goods.map(k => (ITEMS[k] || {}).wtype)).size;
  // 物品的武器图：普通 / 高级 → 类型外观，稀有~传说 → r2~r4
  for (const t of TYPES) for (const r of [0, 2, 3, 4]) { const k = weaponArtOf({ key: 'x', wtype: t, rar: r, cls: 'fighter' }, 'fighter'); if (k !== (r ? `${t}_r${r}` : t)) res.bad.push(`${t}/${r}:${k}`); }
  return res;
}, [TYPES, SKINS]);
ok(!r3.noArt.length && !r3.bad.length, `5 类 × (普通 + 稀有 / 神器 / 传说 + 6 款装扮) = ${5 * 10} 张武器图都在`, JSON.stringify([r3.noArt, r3.bad]));
ok(!r3.cover.length, '手套 / 拳套 / 爪 / 臂铠盖住拳头（cover），东方棍握在拳里', JSON.stringify(r3.cover));
ok(!r3.noIcon.length, '图标：item_w_<类型> ×5、流沙 item_sand_<类型> ×5、w_fighter', JSON.stringify(r3.noIcon));
ok(r3.drawn.every(([, n]) => n > 100), '每类武器都画在手上（站姿和空手相比变了的像素）', JSON.stringify(r3.drawn));
ok(r3.shop === 5, `风振的格斗家武器货架有 ${r3.shop} 类`);
ok(r3.arm.every(([, n]) => n >= 16) && r3.arm.some(([t, n]) => t === 'boxing' && n >= 85) && r3.armUsed, '拳上武器有按帧重画的手臂层（拳套 91 帧齐；其余类型没做完的帧退回贴武器图），站立帧用上了', JSON.stringify([r3.arm, r3.armUsed]));
ok(r3.tint === 5, `品级 / 装扮给手臂层换色（5 种外观 = ${r3.tint} 张不同的图）`);

console.log('4. 时装 / 配件 / 路人');
const r4 = await page.evaluate(async SETS => {
  const B = SPR_DATA.fighter.frames, res = { sets: {}, noAcc: [], crowd: null };
  for (const s of SETS) {
    const D = SPR_DATA['fighter@' + s]; if (!D) { res.sets[s] = 'none'; continue; }
    const miss = Object.keys(B).filter(f => !D.frames[f]), noHead = Object.keys(D.frames).filter(f => B[f] && B[f].head && !D.frames[f].head), noW = Object.keys(D.frames).filter(f => B[f] && B[f].wpn && !D.frames[f].wpn);
    res.sets[s] = { n: Object.keys(D.frames).length, miss: miss.length, noHead: noHead.length, noW: noW.length };
  }
  for (const k in AVATAR_ACC) if (k.startsWith('av_') && (!AVATAR_ACC[k].pos.fighter || !AVATAR_ACC[k].pos['fighter@'])) res.noAcc.push(k);
  res.crowd = crowdCls().includes('fighter') && !!CROWD_LOOKS.fighter;
  return res;
}, SETS);
ok(SETS.every(s => r4.sets[s] && r4.sets[s].miss === 0 && r4.sets[s].noHead === 0 && r4.sets[s].noW === 0), '6 套时装 × 91 帧齐全（头部 / 拳头锚点跟着原装）', JSON.stringify(r4.sets));
ok(!r4.noAcc.length, '时装配件（帽子 / 发饰 / 眼镜）都有 fighter / fighter@ 位置', JSON.stringify(r4.noAcc));
ok(r4.crowd, '开放后城镇路人里有格斗家（马甲换色 3 种）');

console.log('5. 全组合画一遍（转职 × 武器 × 时装 × 全部帧）');
const r5 = await page.evaluate(async ([JOBS, TYPES, SETS]) => {
  const [cv, c] = offCanvas(260, 300); let n = 0; const t0 = performance.now();
  const frames = Object.keys(SPR_DATA.fighter.frames);
  for (const j of [null, ...JOBS]) for (const [i, t] of TYPES.entries()) {
    const look = __fl.look('fighter', j, { wpn: t + (i % 2 ? '_r4' : ''), set: i === 0 ? null : SETS[(i + (j || '').length) % SETS.length], acc: ['hat', 'hair', 'face'] });
    await __fl.ready([look]); const m = __fl.model('fighter', look);
    for (const f of frames) { __fl.drawAt(c, m, f, 130, 280, 1); n++; }
  }
  return { n, ms: Math.round(performance.now() - t0) };
}, [JOBS, TYPES, SETS]);
const errs = logs.filter(l => l.type === 'pageerror');
ok(!errs.length && r5.n > 2000, `画了 ${r5.n} 帧（${r5.ms} ms），没有报错`, JSON.stringify(errs.slice(0, 3)));

if (SHOTS) {
  console.log('shots：总览图');
  const J = [[null, '格斗家', '基础职业 · 手套'], ['nenmaster', '气功师', '青绿道袍 + 念珠\n金色念气珠 · 手套 r4'], ['striker', '散打', '白道服 + 红头带\n拳套 r4'], ['brawler', '街霸', '红马甲 + 创可贴\n铁链 · 毒药瓶 · 爪 r4'], ['grappler', '柔道家', '藏青柔道服 + 白头带\n臂铠 r4']];
  const SK = { null: ['f_high2', 'f_spin1'], nenmaster: ['fn_thrust1', 'fn_thrust2'], striker: ['fs_kneekick', 'fs_dashpunch'], brawler: ['fb_throw1', 'fb_pound2'], grappler: ['fg_backflip', 'fg_piledrive'] };
  const url1 = await page.evaluate(async ([J, SK, WP]) => {
    const cols = ['站立', '跑 3', '跑 7', '普攻 1', '普攻 2', '普攻 3', '技能 1', '技能 2', '状态特效', '学院时装 + 配件', '炎龙时装跑'];
    const sw = (job, name) => { const look = __fl.look('sword', job, { wpn: job ? 'katana_r4' : 'katana' }), a = f => ({ cls: 'sword', look, f });
      return { name, sub: '对照：鬼剑士', cells: [a('idle'), a('run3'), a('run7'), a('a1_2'), a('a2_2'), a('a3_2'), a('up2'), a('dash2'), null, { cls: 'sword', look: __fl.look('sword', job, { wpn: 'katana', set: 'academy', acc: ['hat', 'hair', 'face'] }), f: 'idle' }, { cls: 'sword', look: __fl.look('sword', job, { wpn: 'katana', set: 'sky2', acc: ['hat', 'hair'] }), f: 'run3' }] }; };
    const rows = [sw(null, '鬼剑士'), sw('blade', '剑魂')];
    const p = game.player;
    for (const [job, name, sub] of J) {
      const look = __fl.look('fighter', job, { wpn: WP[job] }), a = f => ({ cls: 'fighter', look, f });
      const g = makePlayer('fighter', { team: 'p', kit: { bar: [], lv: {}, job, wtype: null }, name, pad: new Pad() }); g.x = p.x + 500; g.y = p.y; g.control = null; ents.push(g);
      avatarSetLook(g.model, look); if (job) for (const S of JOB_LOOKS[job].states || []) S.demo(g);
      rows.push({ name, sub, cells: [a('idle'), a('run3'), a('run7'), a('f_jab2'), a('f_low2'), a('f_mid2'), a(SK[job][0]), a(SK[job][1]), job ? { cls: 'fighter', look, f: 'idle', m: g.model, tag: (JOB_LOOKS[job].states || []).map(S => S.name).join(' + ') } : null,
        { cls: 'fighter', look: __fl.look('fighter', job, { wpn: WP[job], set: 'academy', acc: ['hat', 'hair', 'face'] }), f: 'idle' }, { cls: 'fighter', look: __fl.look('fighter', job, { wpn: WP[job], set: 'sky2', acc: ['hat', 'hair'] }), f: 'run3' }] });
    }
    return __fl.sheet('格斗家 4 个转职外观（游戏模型 1.3 倍）', cols, rows);
  }, [J, SK, JOB_WPN]);
  save(url1, 'jobs');
  const url2 = await page.evaluate(async ([TYPES, SKINS]) => {
    const act = ['f_jab2', 'f_mid2', 'run3', 'walk2', 'f_seal', 'hit2', 'fb_throw2', 'fg_swing1'];
    const cols = ['普通', '稀有 r2', '神器 r3', '传说 r4', ...SKINS.map(s => '装扮 ' + s), ...act, '+13 光效', '+16 光效'];
    const NM = { knuckle: '手套', boxing: '拳套', claw: '爪', tonfa: '东方棍', gauntlet: '臂铠' };
    const rows = [{ name: '鬼剑士太刀', sub: '对照', cells: [...['katana', 'katana_r2', 'katana_r3', 'katana_r4', ...SKINS.map(s => s + '_katana')].map(k => ({ cls: 'sword', look: __fl.look('sword', null, { wpn: k }), f: 'idle', tag: k })), ...act.map(() => null),
      ...[13, 16].map(enh => ({ cls: 'sword', look: __fl.look('sword', null, { wpn: 'katana_r4', enh }), f: 'idle', tag: `+${enh} katana_r4` }))] }];
    for (const t of TYPES) rows.push({ name: NM[t], sub: t, cells: [...[t, t + '_r2', t + '_r3', t + '_r4', ...SKINS.map(s => s + '_' + t)].map(k => ({ cls: 'fighter', look: __fl.look('fighter', null, { wpn: k }), f: 'idle', tag: k })),
      ...act.map(f => ({ cls: 'fighter', look: __fl.look('fighter', null, { wpn: t + '_r3' }), f, tag: `${f} · ${t}_r3` })),
      ...[13, 16].map(enh => ({ cls: 'fighter', look: __fl.look('fighter', null, { wpn: t + '_r4', enh }), f: 'f_jab2', tag: `+${enh} ${t}_r4` }))] });
    return __fl.sheet('格斗家武器（5 类 × 品级 × 装扮，手上 1.3 倍；右边 8 列 = 动作里的神器外观）', cols, rows, { CW: 132 });
  }, [TYPES, SKINS]);
  save(url2, 'weapons');
  const url3 = await page.evaluate(async SETS => {
    const fr = ['idle', 'walk3', 'run3', 'f_jab2', 'f_mid2', 'f_high2', 'hit2', 'down', 'f_lift', 'f_palm2', 'fn_meditate', 'fs_dashpunch', 'fb_pound1', 'fg_swing2'];
    const cols = ['鬼剑士同款', ...fr, '配件全戴', '散打 + 时装'];
    const rows = [{ name: '原装', sub: '', cells: [{ cls: 'sword', look: __fl.look('sword', null, { wpn: 'katana' }), f: 'idle' }, ...fr.map(f => ({ cls: 'fighter', look: __fl.look('fighter', null, { wpn: 'knuckle' }), f }))] }];
    const nm = { summer: '晴空海滩', festival: '庆典', spring: '锦鲤贺岁', academy: '星辉学院', sky1: '天穹圣翼', sky2: '炎龙之魂' };
    for (const s of SETS) {
      const look = __fl.look('fighter', null, { wpn: 'knuckle', set: s });
      rows.push({ name: nm[s], sub: s, cells: [{ cls: 'sword', look: __fl.look('sword', null, { wpn: 'katana', set: s }), f: 'idle' }, ...fr.map(f => ({ cls: 'fighter', look, f })),
        { cls: 'fighter', look: __fl.look('fighter', null, { wpn: 'knuckle', set: s, acc: ['hat', 'hair', 'face'] }), f: 'idle' }, { cls: 'fighter', look: __fl.look('fighter', 'striker', { wpn: 'boxing', set: s, acc: ['face'] }), f: 'f_jab2' }] });
    }
    return __fl.sheet('格斗家 6 套时装（每套 91 帧，和原装逐帧对齐）', cols, rows, { CW: 136 });
  }, SETS);
  save(url3, 'costumes');
  const url4 = await page.evaluate(async ([JOBS, SETS]) => {
    const cols = ['原装', '跑 3', '普攻', ...SETS.map(s => s + ' 配件')];
    const rows = [];
    for (const j of [null, ...JOBS]) rows.push({ name: j ? CLASSES.fighter.jobs[j].name : '格斗家', sub: j || '', cells: [
      { cls: 'fighter', look: __fl.look('fighter', j, { wpn: 'knuckle' }), f: 'idle', zoom: 2.4 }, { cls: 'fighter', look: __fl.look('fighter', j, { wpn: 'knuckle' }), f: 'run3', zoom: 2.4 }, { cls: 'fighter', look: __fl.look('fighter', j, { wpn: 'knuckle' }), f: 'f_jab2', zoom: 2.4 },
      ...SETS.map(s => ({ cls: 'fighter', look: __fl.look('fighter', j, { wpn: 'knuckle', set: s, acc: ['hat', 'hair', 'face'] }), f: 'idle', zoom: 2.4 }))] });
    return __fl.sheet('头部特写 ×2.4：转职头饰 × 时装配件（时装帽子优先：头带不画；念珠 / 创可贴照画）', cols, rows, { CW: 150, CH: 170 });
  }, [JOBS, SETS]);
  save(url4, 'heads');
  // 91 帧逐帧 × 红拳套（最显眼）：哪些帧只有一只 / 没有拳头锚点（没锚点的拳头是空拳；多半被身体挡住）
  const url6 = await page.evaluate(async () => {
    const F = SPR_DATA.fighter.frames, names = Object.keys(F), per = 13, rows = [], look = __fl.look('fighter', null, { wpn: 'boxing_r4' });
    for (let i = 0; i < names.length; i += per) rows.push({ name: '', cells: names.slice(i, i + per).map(f => ({ cls: 'fighter', look, f, tag: `${f} ${F[f].wpn ? (F[f].wpn2 ? '●●' : '●') : '○'}` })) });
    return __fl.sheet('91 帧 × 拳套 r4（● = 有拳头锚点的拳，○ = 这一帧没有锚点）', Array.from({ length: per }, (_, i) => ''), rows, { CW: 168, CH: 200, S: 1.15 });
  });
  save(url6, 'allframes');
}

if (LIVE) {
  console.log('live：测试房间实拍 + 城镇 / 选角 / 世界地图');
  const { browser: b2, page: pg, logs: l2 } = await launch({ width: 1280, height: 720 });
  await pg.goto(`${URL_BASE}?test&mute&cls=fighter&fighter=1&mobs=0`); await pg.waitForFunction(() => window.__READY, null, { timeout: 120000 });
  await pg.evaluate(async () => {
    window.requestAnimationFrame = () => 0; await new Promise(r => setTimeout(r, 150));
    for (const k of ['help', 'title']) if (menus.isOpen && menus.isOpen(k)) menus.close(k);
    const p = game.player; p.mpMax = p.mp = 99999; Object.assign((save.data.flags ??= {}), { awaken: true, awaken2: true, awaken3: true });
    window.__crops = []; window.__row = [];
    window.__st = (held, press, cap, tag) => {
      input.virt = {}; for (const k of held) input.virt[k] = 1; for (const k of press) input.virt[k] = 2;
      step(1 / 60); renderWorld(); if (!cap) return;
      const x0 = sx(p.x) - 110, y0 = sy(p.y, 0) - 190, cw = 220, ch = 210, [cv, x] = offCanvas(cw * RS, ch * RS);
      x.drawImage(wcan, x0 * RS, y0 * RS, cw * RS, ch * RS, 0, 0, cw * RS, ch * RS);
      x.fillStyle = 'rgba(0,0,0,.6)'; x.fillRect(0, 0, cw * RS, 15 * RS); x.fillStyle = '#fff'; x.font = `${10 * RS}px sans-serif`;
      x.fillText(`${tag} · ${p.model.frameOf ? p.model.frameOf(p.pose) : '?'}`, 4, 11 * RS); __row.push(cv);
    };
    window.__setup = async (job, wpn, skill) => {
      for (const e of ents) if (e.team === 'e') e.remove = true;
      game.job = job; const t = WEAPON_IMG[wpn].type, r = /_r(\d)$/.exec(wpn);
      inv.equip.weapon = { key: t, slot: 'weapon', kind: 'equip', wtype: t, rar: r ? +r[1] : 0, cls: 'fighter', lvl: 1 };
      await loadArtKey('weapon/' + wpn);
      for (const id of classSkills('fighter', job)) game.skillLv[id] = Math.max(1, Math.min(SKILLS[id].maxLv || 5, 5));
      p.buffs = {}; p.cool = {}; p.setState('idle'); p.act = null; p.x = 520; p.y = 110; p.face = 1; p.vx = p.vy = 0;
      cam.x = clamp(p.x - WW / 2, game.room.x0, game.room.x1 - WW);
      const m = spawnMonster('goblin', p.x + 80, p.y); m.control = null; m.hp = m.hpMax = 1e9; window.__skill = skill;
    };
  });
  const S = (n, o = {}) => pg.evaluate(({ n, o }) => { for (let i = 0; i < n; i++) __st(o.held || [], i === 0 ? (o.press || []) : [], o.cap && o.cap.includes(i), o.tag); }, { n, o });
  const JL = [[null, 'knuckle', 'f_highkick'], ['nenmaster', 'knuckle_r4', 'fn_spear'], ['striker', 'boxing_r4', 'fs_close'], ['brawler', 'claw_r4', 'fb_mine'], ['grappler', 'gauntlet_r4', 'fg_magnum']];
  const rowsOut = [];
  for (const [job, wpn, skill] of JL) {
    await pg.evaluate(a => __setup(...a), [job, wpn, skill]);
    await S(20, { cap: [19], tag: '站立' });
    await S(2, { press: ['right'] }); await S(4); await S(1, { press: ['right'], held: ['right'] }); await S(26, { held: ['right'], cap: [12, 24], tag: '跑' });
    await S(20); await pg.evaluate(() => { game.player.x = 520; game.player.face = 1; });
    for (let k = 0; k < 3; k++) { await S(1, { press: ['attack'] }); await S(14, { cap: [5], tag: `普攻 ${k + 1}` }); }
    await S(30); await pg.evaluate(() => { const p = game.player; p.x = 520; p.face = 1; p.setState('idle'); p.act = null; castSkill(p, __skill, false, null); });
    await S(40, { cap: [8, 22, 36], tag: skill });
    rowsOut.push(await pg.evaluate(() => { const L = __row; __crops.push(L); window.__row = []; return L.length; }));
  }
  const url5 = await pg.evaluate(() => {
    const cw = __crops[0][0].width, ch = __crops[0][0].height, cols = Math.max(...__crops.map(r => r.length)), [cv, x] = offCanvas(cw * cols, ch * __crops.length);
    __crops.forEach((R, i) => R.forEach((c, j) => x.drawImage(c, j * cw, i * ch))); return cv.toDataURL('image/png');
  });
  save(url5, 'live');
  // 城镇路人（格斗家已开放）+ 世界地图 + 选角
  await pg.goto(`${URL_BASE}?town&mute&cls=fighter&fighter=1&fresh`); await pg.waitForFunction(() => window.__READY, null, { timeout: 120000 });
  await pg.evaluate(async () => {
    enterScene('hm_plaza'); for (let i = 0; i < 60 && world.S.id !== 'hm_plaza'; i++) await new Promise(r => setTimeout(r, 100));
    while (menus.stack.length) menus.close(menus.stack[menus.stack.length - 1]);
    game.job = 'striker'; inv.equip.weapon = { key: 'boxing', slot: 'weapon', kind: 'equip', wtype: 'boxing', rar: 4, cls: 'fighter', lvl: 1 }; inv.equip.av_pet = makeItem('pet_lion'); inv.equip.av_aura = makeItem('aura_supreme');   // 宠物 / 光环兼容
    world.crowd.length = 0; for (let i = 0; i < 8; i++) { const w = makePasserby(world.S, new Set(), (i + 0.5) / 8); if (w) { if (i % 2) { w.cls = 'fighter'; w.model = new SpriteModel('fighter', SPR_FALLBACK, SPR_ANIMS.fighter, pick(CROWD_LOOKS.fighter)); avatarSetLook(w.model, avatarRandomLook('fighter')); } w.x = game.player.x - 330 + i * 90; w.y = 60 + (i % 3) * 30; world.crowd.push(w); } }
    await new Promise(r => setTimeout(r, 1500));
  });
  await pg.screenshot({ path: `${out}/town.png` });
  await pg.evaluate(() => { menus.open('worldmap'); }); await pg.waitForTimeout(800); await pg.screenshot({ path: `${out}/worldmap.png` });
  await pg.goto(`${URL_BASE}?mute&fighter=1`); await pg.waitForFunction(() => window.__READY, null, { timeout: 120000 });
  await pg.evaluate(async () => {
    const mk = (name, job, eq) => ({ ...save.defaults('fighter', name), job, lvl: 60, equip: eq });
    const W = (t, r) => ({ key: t, slot: 'weapon', kind: 'equip', wtype: t, rar: r, cls: 'fighter' }), C = s => ({ av_top: { set: 'av_' + s }, av_bottom: { set: 'av_' + s }, av_shoes: { set: 'av_' + s } });
    const chars = [mk('气功小念', 'nenmaster', { weapon: W('knuckle', 4) }), mk('散打阿龙', 'striker', { weapon: W('boxing', 3), ...C('summer') }), mk('街霸老六', 'brawler', { weapon: W('claw', 4) }), mk('柔道小柔', 'grappler', { weapon: W('gauntlet', 4), ...C('sky2') }), mk('新手格斗', null, { weapon: W('knuckle', 0) })];
    localStorage.setItem(save.key, JSON.stringify({ chars, cur: 0, acct: {} }));
    await loadBundles(['spr:fighter', 'spr:fighter@summer', 'spr:fighter@sky2']);
    while (menus.stack.length) menus.close(menus.stack[menus.stack.length - 1]); menus.open('charselect'); await new Promise(r => setTimeout(r, 1500));
  });
  await pg.screenshot({ path: `${out}/charselect.png` });
  execFileSync('python3', ['-c', `from PIL import Image
ims=[Image.open('${out}/'+n+'.png').convert('RGB') for n in ('town','worldmap','charselect')]
W=sum(i.width for i in ims)//2; o=Image.new('RGB',(ims[0].width*2,ims[0].height*2),(20,20,20))
for k,i in enumerate(ims): o.paste(i,((k%2)*i.width,(k//2)*i.height))
o=o.resize((o.width*3//4,o.height*3//4)); o.save('${out}/screens.jpg',quality=84)
import os
for n in ('town','worldmap','charselect'): os.remove('${out}/'+n+'.png')`]);
  console.log('  总览', `${out}/screens.jpg`);
  const e2 = l2.filter(l => l.type === 'pageerror'); ok(!e2.length, 'live 实拍没有报错', JSON.stringify(e2.slice(0, 3)));
  await b2.close();
}

await browser.close();
console.log(fail ? `✗ ${fail} 项失败` : '✓ 全部通过');
process.exit(fail ? 1 : 0);
