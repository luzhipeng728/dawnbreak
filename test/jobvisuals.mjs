// 转职外观测试：node test/jobvisuals.mjs [shots] [glow]（先 node build.mjs）
//   1. look 带转职：lookFromEquip 给自己 / 存档角色 / 指定转职都写 look.job；阿修罗的眼罩在 look.acc 里；15 个转职的 JOB_LOOKS 都在、都能解析
//   2. 状态特效跟着 BUFF 开关：每个转职的每个状态（states[i].demo 打开）→ 打开后外观层有这个状态，关掉就没了；每个转职都能画出来（不报错）
//   3. 无敌半透明：凯贾 + 无敌时本体 globalAlpha ≈ 0.45；凯贾时开始跑动 → 1 秒无敌（官方前冲无敌）
//   4. 强化光效在刀身后面：武器图之前画光晕（back），之后只画火花；狂暴之力的武器染色也在武器图之前
//   5. 其他玩家：城镇里的 NetPeer 收到带 job 的 look → 外观层解析出转职外观
//   6. 帧率：城镇 8 人（各转职外观 + +13~+16 武器 + 天空套）+ 地下城 4 个开着状态特效的角色打怪，要 55fps 以上
//   shots：每个转职一排（城镇站立 / 走路 / 状态、混搭时装 + 状态、地下城状态），原始 1 倍大小 → test/shots/jobvisuals/sheet.jpg
//   glow：强化光效阶梯 +7 / +10 / +12 / +13 / +14 / +15 / +16（修罗之戮、血之挽歌、增幅各一排）→ test/shots/jobvisuals/glow.jpg
import { launch, URL_BASE } from './lib.mjs';
import fs from 'fs';
import { execFileSync } from 'child_process';
const SHOTS = process.argv.includes('shots'), GLOW = process.argv.includes('glow');
const out = 'test/shots/jobvisuals'; fs.mkdirSync(out, { recursive: true });
let fail = 0; const ok = (c, msg, x = '') => { console.log((c ? '  ✓ ' : '  ✗ ') + msg, x); if (!c) fail++; };
// 总览图里每个转职拿的武器（史诗外观）
const WPN = { blade: 'ep_katana', soulbender: 'ep_ss_shura', berserker: 'ep_ls_elegy', asura: 'ep_kt_andra', ghostblade: 'ep_kt_slaughter',
  ranger: 'ep_rv_python', launcher: 'ep_hc_meteor', mechanic: 'ep_ap_flash', spitfire: 'ep_bg_red', paramedic: 'ep_rf_howl',
  elemental: 'ep_st_sage', battlemage: 'ep_pl_phantom', summoner: 'ep_rd_thunder', witch: 'ep_br_lucky', enchantress: 'ep_rd_meow' };

const HELP = () => {
  window.__jv = {
    clsOf(job) { for (const c of openClasses()) if (CLASSES[c].jobs[job]) return c; return 'sword'; },
    eq(o = {}) {
      const e = {};
      if (o.wpn) e.weapon = { key: o.wpn, slot: 'weapon', kind: 'equip', wtype: ITEMS[o.wpn] ? ITEMS[o.wpn].wtype : null, rar: 4, enh: o.enh || 0, dim: o.amp ? 'str' : undefined };
      if (o.set) for (const s of ['av_top', 'av_bottom', 'av_shoes']) e[s] = { set: o.set };
      if (o.mix) ['av_top', 'av_bottom', 'av_shoes'].forEach((s, i) => { if (o.mix[i]) e[s] = { set: o.mix[i] }; });
      return e;
    },
    look(job, o, cls) { return lookFromEquip(cls || this.clsOf(job), this.eq(o), undefined, job); },
    async spawn(job, o, x, y) {
      const cls = job ? this.clsOf(job) : 'sword'; await loadBundles(['spr:' + cls]); if (o && o.wpn && typeof loadArtKey === 'function') await loadArtKey('weapon/' + o.wpn);   // 武器图按需加载
      const g = makePlayer(cls, { team: 'p', kit: { bar: [], lv: {}, job, wtype: null }, name: job || cls, pad: new Pad() });
      g.x = x; g.y = y; g.face = 1; g.control = null; g.hp = g.hpMax = 1e7; ents.push(g);
      avatarSetLook(g.model, this.look(job, o, cls)); return g;
    },
    stateOn(g) { const J = JOB_LOOKS[g.kit.job]; for (const S of (J && J.states) || []) if (S.demo) S.demo(g); },
    stateOff(g) { g.buffs = {}; g.pmInfo = 0; if (typeof dismissSummons === 'function') dismissSummons(g, null, 'cmd'); },
    clear() { for (let i = ents.length - 1; i >= 0; i--) if (ents[i] !== game.player) ents.splice(i, 1); if (world && world.crowd) { for (const q of world.crowd) if (q.net && typeof cashDetach === 'function') cashDetach(q); world.crowd.length = 0; } fxList.length = 0; if (typeof SUMMONS !== 'undefined') SUMMONS.length = 0; },
    // 暂停主循环，逐帧推进；_mv = 每秒移动（跑 / 走）
    step(n) {
      for (let i = 0; i < n; i++) {
        for (const e of ents) if (e._mv !== undefined) { e.vx = e._mv; e.vy = 0; const s = Math.abs(e._mv) > 200 ? 'run' : e._mv ? 'walk' : 'idle'; if (e.st !== s) e.setState(s); }
        step(1 / 60);
      }
    },
  };
};
const town = async () => {
  await page.goto(`${URL_BASE}?town&mute&cls=sword&fresh`); await page.waitForFunction(() => window.__READY); await page.waitForTimeout(600); await page.evaluate(HELP); await page.evaluate(w => { window.WPN_ = w; }, WPN);
  await page.evaluate(async () => { enterScene('hm_plaza'); for (let i = 0; i < 60 && world.S.id !== 'hm_plaza'; i++) await new Promise(r => setTimeout(r, 100)); await new Promise(r => setTimeout(r, 800)); while (menus.stack.length) menus.close(menus.stack[menus.stack.length - 1]); });
};
const dungeon = async () => {
  await page.goto(`${URL_BASE}?test&mute&cls=sword&mon=goblin,goblin,goblin,goblinThrower`); await page.waitForFunction(() => window.__READY); await page.waitForTimeout(800); await page.evaluate(HELP); await page.evaluate(w => { window.WPN_ = w; }, WPN);
};

// 头部总览（node test/jobvisuals.mjs heads）：3 个基础职业 + 15 个转职一排一个，站立 / 跑动 / 攻击 / 时装全套（学院：帽子 + 发饰 + 眼镜）/ 时装跑动（炎龙之魂：龙角 + 发饰）/ 头部特写
//   直接用游戏的模型绘制（外观层 + 转职外观），1.3 倍 → test/shots/jobvisuals/heads.jpg
const headsSheet = async () => {
  const url = await page.evaluate(async ([WPN, ONLY]) => {
    let rows = []; for (const cls of openClasses()) { rows.push({ cls, job: null, name: CLASSES[cls].name }); for (const j of openJobs(cls)) rows.push({ cls, job: j, name: CLASSES[cls].jobs[j].name }); }   // 已开放的职业 / 转职（ready:false 的不画）
    if (ONLY) rows = rows.filter(R => ONLY.includes(R.job || R.cls));   // HEADS=blade,ranger 只出这几排（调位置用）
    const COST = { academy: ['av_academy', 'av_hat_academy', 'av_hair_academy', 'av_face_academy'], sky2: ['av_sky2', 'av_hat_sky2', 'av_hair_sky2'] };
    const cols = [['城镇站立', 'idle'], ['跑动', 'run'], ['攻击', 'atk'], ['时装（学院 帽子+发饰+眼镜）', 'idle', 'academy'], ['时装跑动（炎龙 龙角+发饰）', 'run', 'sky2'], ['头部特写 ×2.6', 'idle', null, 1]];
    const S = 1.3, CW = 150, CH = 186, LW = 128, TH = 26, W = LW + cols.length * CW, H = TH + rows.length * CH;
    await loadBundles([...openClasses().map(c => 'spr:' + c), ...openClasses().flatMap(c => [`spr:${c}@academy`, `spr:${c}@sky2`])]);
    const [cv, x] = offCanvas(W, H); x.fillStyle = '#201c24'; x.fillRect(0, 0, W, H);
    x.font = 'bold 13px sans-serif'; x.fillStyle = '#ffe2a0'; cols.forEach(([t], i) => x.fillText(t, LW + i * CW + 6, 18));
    const frameOf = (cls, k) => { if (k === 'idle') return 'idle'; const A = SPR_ANIMS[cls], c = k === 'run' ? A.run : A.atk2 || A.atk1; if (!c) return 'idle'; const fr = c.frames ? c.frames.map(f => f) : c.map(e => e[0]); return fr[Math.min(1, fr.length - 1)]; };
    const models = [];
    for (const [ri, R] of rows.entries()) {
      for (const [ci, [, fk, set, zoom]] of cols.entries()) {
        const eq = {}, wp = R.job ? WPN[R.job] : null;
        if (wp) { eq.weapon = { key: wp, slot: 'weapon', kind: 'equip', wtype: ITEMS[wp] ? ITEMS[wp].wtype : null, rar: 4 }; await loadArtKey('weapon/' + wp); }
        else { const t = CLASS_START_WEAPON[R.cls]; eq.weapon = { key: t, slot: 'weapon', kind: 'equip', wtype: t }; }
        if (set) { const [st, ...acc] = COST[set]; for (const s of ['av_top', 'av_bottom', 'av_shoes']) eq[s] = { set: st }; for (const k of acc) eq['av_' + k.split('_')[1]] = { key: k, set: st }; }
        const look = lookFromEquip(R.cls, eq, undefined, R.job);
        const m = new SpriteModel(R.cls, SPR_FALLBACK, SPR_ANIMS[R.cls]); avatarSetLook(m, look);
        const f = frameOf(R.cls, fk); m.frameOf = () => f; models.push({ m, ri, ci, zoom, R });
        if (look.wpn) await loadArtKey('weapon/' + look.wpn);
      }
    }
    const draw = () => {
      for (const { m, ri, ci, zoom, R } of models) {
        const X = LW + ci * CW, Y = TH + ri * CH;
        x.save(); x.beginPath(); x.rect(X + 2, Y + 2, CW - 4, CH - 4); x.clip(); x.fillStyle = '#8f9aa6'; x.fillRect(X, Y, CW, CH);
        if (zoom) { const Fh = m.S.frames.idle.head || { x: m.S.frames.idle.ax, y: 40 }, F0 = m.S.frames.idle, k = 2.6 / m.S.res; x.translate(X + CW / 2 - (Fh.x - F0.ax) * k, Y + CH / 2 - (Fh.y + (R.cls === 'sword' ? 6 : 22) - F0.ay) * k); x.scale(2.6, 2.6); }
        else { x.translate(X + CW / 2, Y + CH - 12); x.scale(S, S); }
        m.draw(x, { __c: 'idle', __t: 0 }, 0, NO_OPTS); x.restore();
      }
    };
    draw(); await new Promise(r => setTimeout(r, 1500)); x.fillStyle = '#201c24'; x.fillRect(0, TH, W, H - TH); draw();
    x.font = 'bold 15px sans-serif';
    rows.forEach((R, i) => { x.fillStyle = R.job ? '#fff0d0' : '#a0c8ff'; x.fillText(R.name, 8, TH + i * CH + CH / 2); x.font = '11px sans-serif'; x.fillStyle = '#b0a898'; x.fillText(R.job || '（基础职业）', 8, TH + i * CH + CH / 2 + 18); x.font = 'bold 15px sans-serif'; });
    return cv.toDataURL('image/png');
  }, [WPN, process.env.HEADS ? process.env.HEADS.split(',') : null]);
  fs.writeFileSync(`${out}/heads.png`, Buffer.from(url.split(',')[1], 'base64'));
  execFileSync('python3', ['-c', `from PIL import Image; Image.open('${out}/heads.png').convert('RGB').save('${out}/heads.jpg', quality=88)`]);
  console.log('  头部总览', `${out}/heads.jpg`);
};

const { browser, page, logs } = await launch({ width: 960, height: 540 });
await town();
if (process.argv.includes('heads')) { await headsSheet(); await browser.close(); process.exit(0); }

console.log('1. look 带转职');
const r1 = await page.evaluate(() => {
  game.job = 'soulbender'; const own = lookFromEquip('sword', inv.equip);
  save.chars = save.chars || []; const d = { cls: 'sword', job: 'berserker', equip: {} }; save.chars.push(d); const other = lookFromEquip('sword', d.equip); save.chars.pop();
  const asura = __jv.look('asura', {}), stranger = lookFromEquip('sword', {});
  const all = []; for (const c of openClasses()) for (const j of openJobs(c)) all.push(j);
  const missing = all.filter(j => !JOB_LOOKS[j]);
  const bad = Object.keys(JOB_LOOKS).filter(j => { const L = __jv.look(j, {}); return L.job !== j || (JOB_LOOKS[j].acc || []).some(k => !L.acc.includes(k) || !AVATAR_ACC[k]); });
  const noState = Object.keys(JOB_LOOKS).filter(j => !(JOB_LOOKS[j].states || []).some(S => S.demo));
  game.job = null; return { own: own.job, other: other.job, asura: asura.acc, stranger: stranger.job, bad, missing, noState, n: all.filter(j => JOB_LOOKS[j]).length, all: all.length, stray: Object.keys(JOB_LOOKS).filter(j => !Object.values(CLASSES).some(C => C.jobs && C.jobs[j])) };   // 没开放的转职（格斗家 ready:false）可以先有条目
});
ok(r1.own === 'soulbender' && r1.other === 'berserker' && r1.stranger === null, '自己 / 存档角色的 look.job 正确，没有主人的装备不带转职', JSON.stringify([r1.own, r1.other, r1.stranger]));
ok(r1.asura.includes('job_asura_eyes'), '阿修罗的眼罩在 look.acc 里', JSON.stringify(r1.asura));
ok(!r1.missing.length && !r1.bad.length && r1.n === r1.all && !r1.stray.length, `${r1.all} 个转职都有外观条目、都能解析`, JSON.stringify([r1.missing, r1.bad, r1.stray]));
ok(!r1.noState.length, '每个转职都至少有一个状态特效（带 demo）', JSON.stringify(r1.noState));

console.log('1b. 头部（发色 + 头饰）');
const r1b = await page.evaluate(async () => {
  const res = { dup: [], plain: [], noArt: [], noPos: [], hairCls: [], hairBad: [] };
  const sig = {}; for (const c of openClasses()) sig[c] = { '|': c };   // 基础职业：原色头发、没有头饰
  for (const c of openClasses()) for (const j of openJobs(c)) {
    const J = JOB_LOOKS[j], acc = (J.acc || []).slice().sort(), s = (J.hair || '') + '|' + acc.join(',');
    if (!J.hair && !acc.length) res.plain.push(j);
    if (sig[c][s]) res.dup.push(j + '=' + sig[c][s]); sig[c][s] = j;
    if (J.hair && !JL_HAIR_PICK[c]) res.hairCls.push(j);
    for (const k of acc) { const A = AVATAR_ACC[k]; if (!A || !IMG['avatar/' + A.img]) res.noArt.push(k); else if (!A.pos[c] || !A.pos[c + '@'] && c !== 'sword') res.noPos.push(k); }
  }
  // 发色真的换上了：剑魂站姿的头发像素平均色接近目标色（棕），头发以外（衣服）不动
  for (const [cls, job] of [['sword', 'blade'], ['mage', 'elemental']]) {
    const F = SPR_DATA[cls].frames.idle, im = IMG[`spr/${cls}/idle`], o = jlHairImg(im, F, F.head, cls, JOB_LOOKS[job].hair);
    if (!o) { res.hairBad.push(job + ':没找到头发'); continue; }
    const d = o.cv.getContext('2d').getImageData(0, 0, o.cv.width, o.cv.height).data; let r = 0, g = 0, b = 0, n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 200) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; }
    const [tr, tg, tb] = hexRgb(JOB_LOOKS[job].hair), k = (r + g + b) / n / (tr + tg + tb);   // 亮度按比例对齐后比较颜色
    const err = Math.hypot(r / n - tr * k, g / n - tg * k, b / n - tb * k) / 255;
    res[job] = { n, area: +(n / (F.w * F.h)).toFixed(3), y1: o.y + o.cv.height - F.head.y, err: +err.toFixed(2) };
  }
  // 时装优先：戴了时装帽子 → 帽子类头饰不画；耳机 / 额饰 / 面罩照画；时装眼镜在 → 魔道学者的眼镜不画；阿修罗的眼罩照旧压掉时装眼镜
  const eq = (set, parts) => { const e = {}; for (const s of ['av_top', 'av_bottom', 'av_shoes']) e[s] = { set: 'av_' + set }; for (const p of parts) e['av_' + p] = { key: `av_${p}_${set}`, set: 'av_' + set }; return e; };
  const L = (cls, job, e) => lookFromEquip(cls, e, undefined, job).acc;
  res.clash = {
    rangerHat: L('gun', 'ranger', eq('academy', ['hat'])), rangerBare: L('gun', 'ranger', eq('academy', [])), rangerDefault: L('gun', 'ranger', {}),
    paraHat: L('gun', 'paramedic', eq('academy', ['hat'])), witchFace: L('mage', 'witch', eq('academy', ['face'])), witch: L('mage', 'witch', eq('academy', ['hat'])),
    bowHair: L('mage', 'enchantress', eq('academy', ['hair'])), bowHat: L('mage', 'enchantress', eq('academy', ['hat'])), asura: L('sword', 'asura', eq('academy', ['hat', 'face'])),
    ghostHat: L('sword', 'ghostblade', eq('sky2', ['hat', 'hair'])),
  };
  return res;
});
ok(!r1b.plain.length && !r1b.dup.length, '15 个转职的头部（发色 + 头饰）两两不同，也都和基础职业不同', JSON.stringify([r1b.plain, r1b.dup]));
ok(!r1b.noArt.length && !r1b.noPos.length, '转职头饰都有图、都写了本职业（默认帽子 / 时装）的位置', JSON.stringify([r1b.noArt, r1b.noPos]));
ok(!r1b.hairCls.length, '只给能分出头发的职业（鬼剑士 / 魔法师）写发色', JSON.stringify(r1b.hairCls));
ok(!r1b.hairBad.length && ['blade', 'elemental'].every(j => r1b[j] && r1b[j].err < 0.12 && r1b[j].area > 0.04), `发色换上了：剑魂 ${JSON.stringify(r1b.blade)}、元素师 ${JSON.stringify(r1b.elemental)}`, JSON.stringify(r1b.hairBad));
ok(r1b.blade && r1b.blade.y1 < 40, `鬼剑士只染头上（头发像素最低到头心下 ${r1b.blade && r1b.blade.y1} 像素，不染到衣领）`);
const C = r1b.clash, has = (a, k) => a.includes(k);
ok(!has(C.rangerHat, 'job_ranger_hat') && has(C.rangerHat, 'av_hat_academy') && has(C.rangerBare, 'job_ranger_hat') && has(C.rangerDefault, 'job_ranger_hat'), '时装帽子优先：戴学院帽 → 牛仔帽不画；只穿时装不戴帽 / 默认造型 → 牛仔帽照画');
ok(has(C.paraHat, 'job_paramedic_headset') && has(C.paraHat, 'av_hat_academy'), '不挡帽子的头饰照画：协战师的耳机 + 学院帽');
ok(!has(C.witchFace, 'job_witch_glasses') && has(C.witchFace, 'av_face_academy') && has(C.witch, 'job_witch_glasses'), '时装眼镜优先：戴学院眼镜 → 魔道学者的圆眼镜不画；只戴帽子时照画');
ok(!has(C.bowHair, 'job_enchantress_bow') && has(C.bowHat, 'job_enchantress_bow'), '时装发饰优先：戴学院发饰 → 小魔女的蝴蝶结不画；只戴帽子时照画');
ok(has(C.asura, 'job_asura_eyes') && !has(C.asura, 'av_face_academy') && has(C.asura, 'av_hat_academy'), '阿修罗的眼罩照旧压掉时装眼镜（帽子照戴）');
ok(has(C.ghostHat, 'job_ghostblade_mask'), '剑影的面罩戴着龙角 + 发饰也照画');

console.log('2. 状态特效跟着 BUFF 开关（全部转职）');
const r2 = await page.evaluate(async () => {
  __jv.clear(); const p = game.player, [cv, c] = offCanvas(400, 400), bad = [], drawn = [];
  const draw = g => { c.setTransform(1, 0, 0, 1, 200, 330); c.globalAlpha = 1; g.model.draw(c, g.pose, game.t, NO_OPTS); return g.model.av; };
  const has = (g, fx) => (draw(g).jfx || []).some(([x]) => x === fx);
  for (const job of Object.keys(JOB_LOOKS).filter(j => openClasses().some(c => CLASSES[c].jobs[j]))) {   // 已开放的转职（格斗家的 4 条在 test/fighter_looks.mjs）
    const g = await __jv.spawn(job, {}, p.x + 80, p.y); game.paused = true; __jv.step(2);
    const L = draw(g); if (L.jobId !== job || !L.J) bad.push(job + ':没解析出转职');
    for (const S of JOB_LOOKS[job].states || []) {
      if (has(g, S.fx)) bad.push(`${job}.${S.id}:没开就有`);
      S.demo(g); __jv.step(1); if (!has(g, S.fx)) bad.push(`${job}.${S.id}:打开后没有`);
      __jv.stateOff(g); __jv.step(1); if (has(g, S.fx)) bad.push(`${job}.${S.id}:关掉还在`);
    }
    __jv.stateOn(g); for (let i = 0; i < 3; i++) { __jv.step(1); draw(g); } drawn.push(job);   // 全开画几帧（报错会记在页面错误里）
    game.paused = false; __jv.clear();
  }
  return { bad, drawn: drawn.length };
});
ok(!r2.bad.length && r2.drawn === r1.n, `${r2.drawn} 个转职的状态特效都跟着 BUFF 开关`, JSON.stringify(r2.bad));

console.log('3 / 4. 无敌半透明、凯贾前冲无敌、光效在刀身后面');
const r3 = await page.evaluate(async () => {
  __jv.clear(); const p = game.player;
  const sb = await __jv.spawn('soulbender', { wpn: 'ep_ss_shura', enh: 12 }, p.x + 60, p.y), bz = await __jv.spawn('berserker', { wpn: 'ep_ls_elegy', enh: 12 }, p.x + 140, p.y);
  game.paused = true; const [cv, c] = offCanvas(300, 300), res = {};
  const draw = g => { c.setTransform(1, 0, 0, 1, 150, 280); c.globalAlpha = 1; g.model.draw(c, g.pose, game.t, NO_OPTS); return g.model.av; };
  bz.buffs.frenzy = { t: 9999 }; bz.buffs.rampage = { t: 9999 }; draw(bz); res.bzLv = bz.model.av.jfx.find(([fx]) => fx.burn)[1]; res.jw = bz.model.av.jw && bz.model.av.jw.col; bz.buffs = {};
  // 无敌半透明：under 之后的 globalAlpha（本体就按它画）
  sb.buffs.sb_kaiga = { t: 9999 }; sb.invul = 1; const L = sb.model.av, F = sb.model.S.frames.idle;
  c.setTransform(1, 0, 0, 1, 150, 280); c.globalAlpha = 1; c.save(); L.under(c, sb.model, 'idle', F); res.alphaInv = +c.globalAlpha.toFixed(2); c.restore();
  sb.invul = 0; c.save(); L.under(c, sb.model, 'idle', F); res.alphaNo = +c.globalAlpha.toFixed(2); c.restore();
  // 凯贾时开始跑动 → 1 秒无敌（官方前冲无敌）；每 3 秒最多一次
  game.job = 'soulbender'; p.buffs.sb_kaiga = { t: 9999 }; p.invul = 0; p._kgInvT = 0; p.setState('run'); p._psvT = 0; tickPassives(p, 0.01); res.runInv = +p.invul.toFixed(2);
  p.invul = 0; p.setState('idle'); p.setState('run'); p._psvT = 0; tickPassives(p, 0.01); res.runInv2 = +p.invul.toFixed(2); p.setState('idle'); delete p.buffs.sb_kaiga; game.job = null;
  // 光效 / 武器染色画在武器图之前：记下 vanityWeaponFx / jlWeapon / 武器图的调用顺序
  const seq = [], v0 = window.vanityWeaponFx, j0 = window.jlWeapon, d0 = c.drawImage;
  bz.buffs.frenzy = { t: 9999 }; const LB = bz.model.av; draw(bz);
  window.vanityWeaponFx = (cc, LL, w, A, im, s, back) => { seq.push('glow:' + (back ? 'back' : 'front')); };
  window.jlWeapon = () => seq.push('tint');
  c.drawImage = function (im, ...a) { if (im === LB.wim) seq.push('weapon'); return d0.call(this, im, ...a); };
  draw(bz); window.vanityWeaponFx = v0; window.jlWeapon = j0; delete c.drawImage;
  res.seq = seq.slice(0, 4).join(' → '); res.glow = !!LB.glow;
  __jv.clear(); game.paused = false; return res;
});
ok(r3.bzLv === 2 && r3.jw === '#ff2030', `狂战士：狂暴之力 + 暴走 → 血焰强度 2、武器染红（${r3.jw}）`);
ok(r3.alphaInv <= 0.56 && r3.alphaInv >= 0.35 && r3.alphaNo === 1, `凯贾 + 无敌：本体半透明（alpha ${r3.alphaInv}，不无敌时 ${r3.alphaNo}）`);
ok(r3.runInv >= 0.9 && r3.runInv2 === 0, `凯贾时开始跑动 → 1 秒无敌（${r3.runInv} 秒），3 秒内再跑不再触发（${r3.runInv2}）`);
ok(r3.glow && r3.seq === 'glow:back → tint → weapon → glow:front', '强化光晕 / 武器染色画在武器图之前，火花在之后', r3.seq);

console.log('5. 其他玩家收到转职外观');
const r5 = await page.evaluate(async () => {
  __jv.clear(); const p = game.player, res = {};
  for (const job of ['berserker', 'elemental', 'mechanic']) {
    const cls = __jv.clsOf(job), look = __jv.look(job, { wpn: WPN_[job], enh: 12 }, cls); await loadBundles(['spr:' + cls]);
    const P = new NetPeer({ id: 901 + Object.keys(res).length, name: 'peer', x: p.x + 80, y: p.y, f: 1, s: 'idle' }); P.setChar({ name: job, cls, lvl: 30, look: JSON.parse(JSON.stringify(look)) }); P.a = 1; world.crowd.push(P);
    for (let i = 0; i < 30 && !(P.model && P.model.av && P.model.av.J); i++) await new Promise(r => setTimeout(r, 50));
    res[job] = P.model && P.model.av && P.model.av.jobId;
  }
  return res;
}).catch(e => ({ err: e.message }));
ok(r5.berserker === 'berserker' && r5.elemental === 'elemental' && r5.mechanic === 'mechanic', '城镇里的其他玩家（NetPeer）按 look.job 画出转职外观（鬼剑士 / 魔法师 / 神枪手）', JSON.stringify(r5));

console.log('6. 帧率');
const fps = async () => page.evaluate(async () => {
  const r0 = window.renderWorld; let rs = 0, rn = 0, rmax = 0; window.renderWorld = () => { const t = performance.now(); r0(); const d = performance.now() - t; rs += d; rn++; rmax = Math.max(rmax, d); };
  const secs = 5; let frames = 0, gap = 0, last = performance.now(); const t0 = last;
  await new Promise(res => { const f = () => { const n = performance.now(); if (frames > 5) gap = Math.max(gap, n - last); last = n; frames++; if (n - t0 < secs * 1000) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); });
  window.renderWorld = r0; return { fps: +(frames / secs).toFixed(1), maxFrame: +gap.toFixed(1), renderMs: +(rs / rn).toFixed(2), renderMax: +rmax.toFixed(1) };
});
const r6 = await page.evaluate(async () => {
  __jv.clear(); const p = game.player; game.job = 'berserker'; inv.ensure(); inv.equip.weapon.enh = 16; bus.emit('enhance', {});
  await loadBundles(['spr:gun', 'spr:mage']);
  const P = [], jobs = ['soulbender', 'elemental', 'mechanic', 'berserker', 'summoner', 'enchantress', 'blade', 'spitfire'];
  for (let i = 0; i < 8; i++) {
    const job = jobs[i], cls = __jv.clsOf(job), eq = __jv.eq({ wpn: WPN_[job], enh: 13 + (i % 4) }); for (const s of AV_PIECE_SLOTS) eq[s] = { set: i % 2 ? 'av_sky2' : 'av_sky1' };
    const look = { ...lookFromEquip(cls, eq, undefined, job), cash: cashLook(eq) };
    const q = new NetPeer({ id: 910 + i, name: 'p' + i, x: p.x - 420 + i * 110, y: 30 + (i % 4) * 30, f: 1, s: 'walk' }); q.setChar({ name: '勇士' + i, cls, lvl: 30, look }); q.a = 1; world.crowd.push(q); P.push(q);
  }
  await new Promise(r => setTimeout(r, 2000));
  let k = 0; window.__jvIv = setInterval(() => { k++; P.forEach((q, i) => q.push(p.x - 420 + i * 110 + Math.sin(k / 12 + i) * 90, 30 + (i % 4) * 30, Math.cos(k / 12 + i) > 0 ? 1 : -1, i % 2 ? 'run' : 'walk')); }, 100);
  return P.filter(q => q.model && q.model.av && q.model.av.J).length;
});
const f6 = await fps(); await page.evaluate(() => clearInterval(window.__jvIv));
ok(r6 >= 6, `城镇里 ${r6}/8 个其他玩家画出了转职外观`);
ok(f6.fps >= 55, `城镇 8 人（各转职外观 + +13~+16 + 天空套）：${f6.fps} fps，最长一帧 ${f6.maxFrame} ms，渲染平均 ${f6.renderMs} ms / 最长 ${f6.renderMax} ms`);

// 地下城（测试房间）：自己（鬼泣 + 凯贾）+ 4 个开着状态的角色打哥布林
await dungeon();
await page.evaluate(async () => {
  const p = game.player; game.job = 'soulbender'; p.buffs.sb_kaiga = { t: 9999 }; for (const m of ents) if (m.team === 'e') { m.hp = m.hpMax = 1e8; }
  const G = [];
  for (const [i, job] of ['berserker', 'elemental', 'battlemage', 'asura'].entries()) { const g = await __jv.spawn(job, { wpn: WPN_[job], enh: 14 + i }, p.x + 60 - i * 30, p.y + 30 - i * 20); __jv.stateOn(g); G.push(g); }
  let k = 0; window.__jvIv = setInterval(() => { k++; input.virt[k % 30 < 15 ? 'right' : 'left'] = 1; delete input.virt[k % 30 < 15 ? 'left' : 'right']; if (k % 5 === 0) { input.virt.attack = 1; } else delete input.virt.attack; if (k % 20 === 0) p.invul = 0.6; G.forEach((g, i) => { g.vx = Math.sin(k / 8 + i) * 120; }); }, 100);
  await new Promise(r => setTimeout(r, 1500));
}).catch(e => console.log('  (地下城准备)', e.message));
const f7 = await fps(); await page.evaluate(() => { clearInterval(window.__jvIv); for (const k of ['left', 'right', 'attack']) delete input.virt[k]; });
ok(f7.fps >= 55, `地下城 5 个角色开着状态特效打怪：${f7.fps} fps，最长一帧 ${f7.maxFrame} ms，渲染平均 ${f7.renderMs} ms / 最长 ${f7.renderMax} ms`);

if (SHOTS || GLOW) {
  console.log('7. 总览图');
  const tiles = [], titles = {};
  // 一排角色：list[i] = { job, o（装备）, state（打开全部状态）, invul, mv（每秒移动）, suit（协战师战斗服）, row, label }
  const stage = async (row, list, scene, gap = 180) => {
    const pos = await page.evaluate(async ({ list, scene, gap }) => {
      __jv.clear(); while (menus.stack.length) menus.close(menus.stack[menus.stack.length - 1]);
      const p = game.player; p.draw = p.drawShadow = () => {}; p.vx = p.vy = 0; game.paused = true; __jv.step(40); game.paused = false;   // 自己不画；先让镜头停稳再按镜头摆人
      const X0 = cam.x + (gap < 180 ? 80 : 110), Y = scene === 'town' ? 150 : 110, G = [];
      for (const [i, o] of list.entries()) { const g = await __jv.spawn(o.job, o.o, X0 + i * gap - (o.mv ? 70 : 0), Y); if (o.mv !== undefined) g._mv = o.mv; if (o.state) __jv.stateOn(g); if (o.suit && typeof pmSuitSync === 'function') pmSuitSync(g); G.push(g); }
      for (const m of ents) if (m.team === 'e') m.x = cam.x + 2000;
      await new Promise(r => setTimeout(r, 1800));   // 时装分包、武器图、小伙伴的精灵帧
      for (const [i, g] of G.entries()) if (list[i].suit && typeof pmSuitSync === 'function') pmSuitSync(g);
      game.paused = true; __jv.step(30);
      G.forEach((g, i) => { if (list[i].invul) g.invul = 5; });
      __jv.step(2);
      return G.map((g, i) => ({ x: sx(list[i].mv ? g.x - 30 : g.x), y: sy(g.y, 0) }));
    }, { list, scene, gap });
    await page.evaluate(() => { for (const id of ['ui', 'dom']) document.getElementById(id).style.visibility = 'hidden'; });   // 只拍世界层（HUD / 窗口先藏起来）
    await page.waitForTimeout(250);
    const f = `${out}/stage${tiles.length}.png`; await page.screenshot({ path: f });
    await page.evaluate(() => { for (const id of ['ui', 'dom']) document.getElementById(id).style.visibility = ''; });
    await page.evaluate(() => { game.paused = false; for (const e of ents) delete e._mv; delete game.player.draw; delete game.player.drawShadow; });
    const w = Math.min(170, gap - 4); list.forEach((o, i) => tiles.push({ f, label: o.label, row: o.row ?? row, box: [pos[i].x - w / 2, pos[i].y - 150, w, 168].map(Math.round) }));
  };
  if (SHOTS) {
    const J = await page.evaluate(() => { const r = []; for (const c of openClasses()) for (const j of openJobs(c)) if (JOB_LOOKS[j]) r.push({ job: j, cls: c, name: CLASSES[c].jobs[j].name, st: (JOB_LOOKS[j].states || []).map(S => S.name || S.id).join(' + ') }); return r; });
    const MIX = ['av_academy', 'av_festival', null];
    J.forEach((j, i) => { titles[i] = `${j.name}（${j.job}）· 状态：${j.st}`; });
    // 地下城：一次摆 5 个转职（每个一格，开着状态）
    for (let k = 0; k < J.length; k += 5) await stage(0, J.slice(k, k + 5).map((j, i) => ({ job: j.job, o: { wpn: WPN[j.job], enh: 12 }, state: 1, suit: 1, row: k + i, label: `地下城 · 状态` })), 'dungeon');
    await town();
    for (const [i, j] of J.entries()) await stage(i, [
      { job: j.job, o: { wpn: WPN[j.job], enh: 12 }, label: `${j.name} 站立（城镇）` }, { job: j.job, o: { wpn: WPN[j.job], enh: 12 }, mv: 110, label: '走路' },
      { job: j.job, o: { wpn: WPN[j.job], enh: 12 }, state: 1, label: '状态' }, { job: j.job, o: { wpn: WPN[j.job], enh: 12, mix: MIX }, state: 1, mv: 300, label: '混搭时装 + 状态 跑动' }], 'town');
    // 地下城那格放到每排最后
    const byRow = {}; for (const t of tiles) (byRow[t.row] ||= []).push(t); tiles.length = 0; for (const r in byRow) { const L = byRow[r]; tiles.push(...L.filter(t => !t.label.startsWith('地下城')), ...L.filter(t => t.label.startsWith('地下城'))); }
  }
  // 强化光效阶梯：同一把武器 +7 / +10 / +12 / +13 / +14 / +15 / +16 排一排
  if (GLOW) {
    await town();
    const LV = [7, 10, 12, 13, 14, 15, 16], R = (row, wpn, nm, amp) => stage(row, LV.map(lv => ({ job: null, o: { wpn, enh: lv, amp }, label: `${nm} ${amp ? '增幅' : ''}+${lv}` })), 'town', 128);
    await R(100, 'ep_ss_shura', '修罗之戮'); await R(101, 'ep_ls_elegy', '血之挽歌'); await R(102, 'ep_ls_elegy', '血之挽歌', 1);
    Object.assign(titles, { 100: '强化光效 · 修罗之戮（短剑）：+10 起刀身描边，+12 光晕加倍，+13 变红 + 爆闪，+14 环绕光点，+15 变紫 + 双层光晕 + 脚下光环，+16 七彩 + 电弧', 101: '强化光效 · 血之挽歌（光剑）', 102: '增幅光效 · 血之挽歌' });
  }
  fs.writeFileSync(`${out}/tiles.json`, JSON.stringify({ tiles, titles })); const name = GLOW && !SHOTS ? 'glow' : 'sheet';
  const py = `
import json
from PIL import Image, ImageDraw, ImageFont
F = ImageFont.truetype('/System/Library/Fonts/STHeiti Medium.ttc', 13); T = ImageFont.truetype('/System/Library/Fonts/STHeiti Medium.ttc', 17)
D = json.load(open('${out}/tiles.json')); tiles = D['tiles']; titles = {int(k): v for k, v in D['titles'].items()}; rows = {}
for t in tiles:
    x, y, w, h = t['box']; im = Image.open(t['f']).convert('RGB').crop((x, y, x + w, y + h))
    cell = Image.new('RGB', (w, h + 18), (18, 16, 22)); cell.paste(im, (0, 18)); ImageDraw.Draw(cell).text((4, 1), t['label'], font=F, fill=(255, 226, 160)); rows.setdefault(t['row'], []).append(cell)
W = max(sum(c.width + 4 for c in r) for r in rows.values()); out = []
for r in sorted(rows):
    hd = Image.new('RGB', (W, 24), (40, 30, 24)); ImageDraw.Draw(hd).text((8, 2), titles.get(r, ''), font=T, fill=(255, 240, 200)); out.append(hd)
    h = max(c.height for c in rows[r]); im = Image.new('RGB', (W, h + 4), (10, 8, 12)); x = 0
    for c in rows[r]: im.paste(c, (x, 0)); x += c.width + 4
    out.append(im)
sheet = Image.new('RGB', (W, sum(o.height for o in out))); y = 0
for o in out: sheet.paste(o, (0, y)); y += o.height
sheet.save('${out}/${name}.png'); sheet.save('${out}/${name}.jpg', quality=86)
`;
  execFileSync('python3', ['-c', py]); console.log('  总览图', `${out}/${name}.jpg`);
}

const errs = logs.filter(l => l.type === 'pageerror' || l.type === 'error');
ok(!errs.length, '没有页面错误', errs.slice(0, 3).map(e => e.text).join(' | '));
await browser.close();
console.log(fail ? `✗ ${fail} 项失败` : '✓ 全部通过');
process.exit(fail ? 1 : 0);
