// 转职外观测试：node test/jobvisuals.mjs [shots] [--oldglow 旧版 vanityWeaponFx 的 js 文件]（先 node build.mjs）
//   1. look 带转职：lookFromEquip 给自己 / 存档角色 / 指定转职都写 look.job；阿修罗的眼罩在 look.acc 里；JOB_LOOKS 每条都能解析
//   2. 状态特效跟着 BUFF 开关：鬼泣 残影之凯贾（鬼影 / 残影 / 无敌半透明）、阵（鬼火）；狂战士 狂暴之力（血焰 + 武器染色）/ 暴走（加强）
//   3. 无敌半透明：凯贾 + 无敌时本体 globalAlpha ≈ 0.45；凯贾时开始跑动 → 1 秒无敌（官方前冲无敌）
//   4. 强化光效在刀身后面：武器图之前画光晕（back），之后只画火花；狂暴之力的武器染色也在武器图之前
//   5. 其他玩家：城镇里的 NetPeer 收到带 job 的 look → 外观层解析出转职外观
//   6. 帧率：城镇 8 人（转职外观 + +16 武器 + 天空套）+ 地下城 4 个开着状态特效的鬼剑士打怪，要 55fps 以上
//   shots：鬼泣 / 狂战士 各状态 × 默认 / 混搭时装 × 城镇 / 地下城，原始 1 倍大小 → test/shots/jobvisuals/sheet.png
import { launch, URL_BASE } from './lib.mjs';
import fs from 'fs';
import { execFileSync } from 'child_process';
const SHOTS = process.argv.includes('shots'), OLD = process.argv.includes('--oldglow') ? fs.readFileSync(process.argv[process.argv.indexOf('--oldglow') + 1], 'utf8') : null;
const out = 'test/shots/jobvisuals'; fs.mkdirSync(out, { recursive: true });
let fail = 0; const ok = (c, msg, x = '') => { console.log((c ? '  ✓ ' : '  ✗ ') + msg, x); if (!c) fail++; };

const HELP = () => {
  window.__jv = {
    eq(o = {}) {
      const e = {};
      if (o.wpn) e.weapon = { key: o.wpn, slot: 'weapon', kind: 'equip', wtype: ITEMS[o.wpn] ? ITEMS[o.wpn].wtype : null, rar: 4, enh: o.enh || 0, dim: o.amp ? 'str' : undefined };
      if (o.set) for (const s of ['av_top', 'av_bottom', 'av_shoes']) e[s] = { set: o.set };
      if (o.mix) ['av_top', 'av_bottom', 'av_shoes'].forEach((s, i) => { if (o.mix[i]) e[s] = { set: o.mix[i] }; });
      return e;
    },
    look(job, o) { return lookFromEquip('sword', this.eq(o), undefined, job); },
    spawn(job, o, x, y) {
      const g = makePlayer('sword', { team: 'p', kit: { bar: [], lv: {}, job, wtype: null }, name: job, pad: new Pad() });
      g.x = x; g.y = y; g.face = 1; g.control = null; g.hp = g.hpMax = 1e7; ents.push(g);
      avatarSetLook(g.model, this.look(job, o)); return g;
    },
    clear() { for (let i = ents.length - 1; i >= 0; i--) if (ents[i] !== game.player) ents.splice(i, 1); if (world && world.crowd) { for (const q of world.crowd) if (q.net && typeof cashDetach === 'function') cashDetach(q); world.crowd.length = 0; } fxList.length = 0; },
    // 暂停主循环，逐帧推进；_mv = 每秒移动（跑 / 走），_act = 定格在某个动作帧
    step(n) {
      for (let i = 0; i < n; i++) {
        for (const e of ents) if (e._mv !== undefined) { e.vx = e._mv; e.vy = 0; const s = Math.abs(e._mv) > 200 ? 'run' : e._mv ? 'walk' : 'idle'; if (e.st !== s) e.setState(s); }
        step(1 / 60);
      }
    },
  };
};

const { browser, page, logs } = await launch({ width: 960, height: 540 });
await page.goto(`${URL_BASE}?town&mute&cls=sword&fresh`); await page.waitForFunction(() => window.__READY); await page.waitForTimeout(600);
await page.evaluate(HELP);
await page.evaluate(async () => { enterScene('hm_plaza'); for (let i = 0; i < 60 && world.S.id !== 'hm_plaza'; i++) await new Promise(r => setTimeout(r, 100)); await new Promise(r => setTimeout(r, 500)); while (menus.stack.length) menus.close(menus.stack[menus.stack.length - 1]); });

console.log('1. look 带转职');
const r1 = await page.evaluate(() => {
  game.job = 'soulbender'; const own = lookFromEquip('sword', inv.equip);
  save.chars = save.chars || []; const d = { cls: 'sword', job: 'berserker', equip: {} }; save.chars.push(d); const other = lookFromEquip('sword', d.equip); save.chars.pop();
  const asura = __jv.look('asura', {}), stranger = lookFromEquip('sword', {});
  const bad = Object.keys(JOB_LOOKS).filter(j => { const L = __jv.look(j, {}); return L.job !== j || (JOB_LOOKS[j].acc || []).some(k => !L.acc.includes(k) || !AVATAR_ACC[k]); });
  game.job = null; return { own: own.job, other: other.job, asura: asura.acc, stranger: stranger.job, bad, jobs: Object.keys(JOB_LOOKS) };
});
ok(r1.own === 'soulbender' && r1.other === 'berserker' && r1.stranger === null, '自己 / 存档角色的 look.job 正确，没有主人的装备不带转职', JSON.stringify([r1.own, r1.other, r1.stranger]));
ok(r1.asura.includes('job_asura_eyes'), '阿修罗的眼罩在 look.acc 里', JSON.stringify(r1.asura));
ok(!r1.bad.length && r1.jobs.includes('soulbender') && r1.jobs.includes('berserker'), `JOB_LOOKS ${r1.jobs.length} 条都能解析`, JSON.stringify(r1.bad));

console.log('2 / 3 / 4. 状态特效、无敌半透明、光效在刀身后面');
const r2 = await page.evaluate(() => {
  __jv.clear(); game.paused = true; const p = game.player;
  const sb = __jv.spawn('soulbender', { wpn: 'ep_ss_shura', enh: 12 }, p.x + 60, p.y), bz = __jv.spawn('berserker', { wpn: 'ep_ls_elegy', enh: 12 }, p.x + 140, p.y);
  const [cv, c] = offCanvas(300, 300);
  const draw = g => { c.setTransform(1, 0, 0, 1, 150, 280); c.globalAlpha = 1; g.model.draw(c, g.pose, game.t, NO_OPTS); return g.model.av; };
  const ids = g => { const L = draw(g); return (L.jfx || []).map(([fx]) => Object.keys(fx).join('+')).join(','); };
  const res = { sb0: ids(sb), bz0: ids(bz), job: [sb.model.av.jobId, bz.model.av.jobId], J: !!(sb.model.av.J && bz.model.av.J) };
  sb.buffs.sb_kaiga = { t: 9999 }; res.sbK = ids(sb);
  summon(sb, 'sb_plemon_f', { x: sb.x + 100, y: sb.y, lv: 1 }); res.sbKF = ids(sb); dismissSummons(sb, { tag: 'field' }, 'cmd');
  delete sb.buffs.sb_kaiga; res.sbOff = ids(sb);
  bz.buffs.frenzy = { t: 9999 }; res.bzF = ids(bz); res.jw = bz.model.av.jw;
  bz.buffs.rampage = { t: 9999 }; draw(bz); res.bzLv = bz.model.av.jfx.find(([fx]) => fx.burn)[1];
  delete bz.buffs.frenzy; delete bz.buffs.rampage; res.bzOff = ids(bz); res.jwOff = bz.model.av.jw;
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
  draw(bz); window.vanityWeaponFx = v0; window.jlWeapon = j0; delete c.drawImage; delete bz.buffs.frenzy;
  res.seq = seq.slice(0, 4).join(' → '); res.glow = !!LB.glow;
  __jv.clear(); game.paused = false; return res;
});
ok(r2.J && r2.job.join() === 'soulbender,berserker', 'AI / 队友实体按 kit.job 解析出转职外观', JSON.stringify(r2.job));
ok(r2.sb0 === '' && r2.bz0 === '', '没开状态时没有状态特效', JSON.stringify([r2.sb0, r2.bz0]));
ok(/ghost/.test(r2.sbK) && /trail/.test(r2.sbK) && /fade/.test(r2.sbK) && /wisps/.test(r2.sbKF) && r2.sbOff === '', '鬼泣：凯贾 → 鬼影 + 残影 + 无敌半透明；阵在场 → 鬼火；关掉就没了', JSON.stringify([r2.sbK, r2.sbKF, r2.sbOff]));
ok(/burn/.test(r2.bzF) && r2.jw && r2.bzLv === 2 && r2.bzOff === '' && !r2.jwOff, '狂战士：狂暴之力 → 血焰 + 武器染红；再开暴走 → 强度 2；关掉就没了', JSON.stringify([r2.bzF, r2.jw, r2.bzLv, r2.bzOff]));
ok(r2.alphaInv <= 0.56 && r2.alphaInv >= 0.35 && r2.alphaNo === 1, `凯贾 + 无敌：本体半透明（alpha ${r2.alphaInv}，不无敌时 ${r2.alphaNo}）`);
ok(r2.runInv >= 0.9 && r2.runInv2 === 0, `凯贾时开始跑动 → 1 秒无敌（${r2.runInv} 秒），3 秒内再跑不再触发（${r2.runInv2}）`);
ok(r2.glow && r2.seq === 'glow:back → tint → weapon → glow:front', '强化光晕 / 武器染色画在武器图之前，火花在之后', r2.seq);

console.log('5. 其他玩家收到转职外观');
const r5 = await page.evaluate(async () => {
  __jv.clear(); const p = game.player, look = __jv.look('berserker', { wpn: 'ep_ls_elegy', enh: 12 });
  const P = new NetPeer({ id: 901, name: 'peer', x: p.x + 80, y: p.y, f: 1, s: 'idle' }); P.setChar({ name: '红眼', cls: 'sword', lvl: 30, look: JSON.parse(JSON.stringify(look)) }); P.a = 1; world.crowd.push(P);
  for (let i = 0; i < 30 && !(P.model && P.model.av && P.model.av.J); i++) await new Promise(r => setTimeout(r, 50));
  const L = P.model && P.model.av; return { job: L && L.jobId, J: !!(L && L.J), eyes: !!(L && L.J && L.J.eyes) };
});
ok(r5.job === 'berserker' && r5.eyes, '城镇里的其他玩家（NetPeer）按 look.job 画出狂战士外观', JSON.stringify(r5));

console.log('6. 帧率');
const fps = async () => page.evaluate(async () => {
  const r0 = window.renderWorld; let rs = 0, rn = 0, rmax = 0; window.renderWorld = () => { const t = performance.now(); r0(); const d = performance.now() - t; rs += d; rn++; rmax = Math.max(rmax, d); };
  const secs = 5; let frames = 0, gap = 0, last = performance.now(); const t0 = last;
  await new Promise(res => { const f = () => { const n = performance.now(); if (frames > 5) gap = Math.max(gap, n - last); last = n; frames++; if (n - t0 < secs * 1000) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); });
  window.renderWorld = r0; return { fps: +(frames / secs).toFixed(1), maxFrame: +gap.toFixed(1), renderMs: +(rs / rn).toFixed(2), renderMax: +rmax.toFixed(1) };
});
const r6 = await page.evaluate(async () => {
  __jv.clear(); const p = game.player; game.job = 'berserker'; inv.ensure(); inv.equip.weapon.enh = 16; bus.emit('enhance', {});
  const P = [];
  for (let i = 0; i < 8; i++) {
    const job = ['soulbender', 'berserker', 'asura', 'soulbender'][i % 4], eq = __jv.eq({ wpn: i % 2 ? 'ep_ls_elegy' : 'ep_ss_shura', enh: 13 + (i % 4) }); for (const s of AV_PIECE_SLOTS) eq[s] = { set: i % 2 ? 'av_sky2' : 'av_sky1' };
    const look = { ...lookFromEquip('sword', eq, undefined, job), cash: cashLook(eq) };
    const q = new NetPeer({ id: 910 + i, name: 'p' + i, x: p.x - 420 + i * 110, y: 30 + (i % 4) * 30, f: 1, s: 'walk' }); q.setChar({ name: '勇士' + i, cls: 'sword', lvl: 30, look }); q.a = 1; world.crowd.push(q); P.push(q);
  }
  await new Promise(r => setTimeout(r, 1500));
  let k = 0; window.__jvIv = setInterval(() => { k++; P.forEach((q, i) => q.push(p.x - 420 + i * 110 + Math.sin(k / 12 + i) * 90, 30 + (i % 4) * 30, Math.cos(k / 12 + i) > 0 ? 1 : -1, i % 2 ? 'run' : 'walk')); }, 100);
  return P.filter(q => q.model && q.model.av && q.model.av.J).length;
});
const f6 = await fps(); await page.evaluate(() => clearInterval(window.__jvIv));
ok(r6 >= 6, `城镇里 ${r6}/8 个其他玩家画出了转职外观`);
ok(f6.fps >= 55, `城镇 8 人（转职外观 + +13~+16 + 天空套）：${f6.fps} fps，最长一帧 ${f6.maxFrame} ms，渲染平均 ${f6.renderMs} ms / 最长 ${f6.renderMax} ms`);

// 地下城（测试房间）：自己 + 3 个开着状态的鬼剑士打哥布林
await page.goto(`${URL_BASE}?test&mute&cls=sword&mon=goblin,goblin,goblin,goblinThrower`); await page.waitForFunction(() => window.__READY); await page.waitForTimeout(800);
await page.evaluate(HELP);
await page.evaluate(async () => {
  const p = game.player; game.job = 'soulbender'; p.buffs.sb_kaiga = { t: 9999 }; for (const m of ents) if (m.team === 'e') { m.hp = m.hpMax = 1e8; }
  const g1 = __jv.spawn('berserker', { wpn: 'ep_ls_elegy', enh: 16 }, p.x + 60, p.y + 20), g2 = __jv.spawn('soulbender', { wpn: 'ep_ss_shura', enh: 16 }, p.x + 20, p.y - 20), g3 = __jv.spawn('berserker', { wpn: 'ep_ls_elegy', enh: 14, mix: ['av_academy', 'av_festival', null] }, p.x - 40, p.y + 40);
  g1.buffs.frenzy = g3.buffs.frenzy = { t: 9999 }; g3.buffs.rampage = { t: 9999 }; g2.buffs.sb_kaiga = { t: 9999 };
  let k = 0; window.__jvIv = setInterval(() => { k++; input.virt[k % 30 < 15 ? 'right' : 'left'] = 1; delete input.virt[k % 30 < 15 ? 'left' : 'right']; if (k % 5 === 0) { input.virt.attack = 1; } else delete input.virt.attack; if (k % 20 === 0) p.invul = 0.6; }, 100);
  await new Promise(r => setTimeout(r, 1200));
}).catch(e => console.log('  (地下城准备)', e.message));
const f7 = await fps(); await page.evaluate(() => { clearInterval(window.__jvIv); for (const k of ['left', 'right', 'attack']) delete input.virt[k]; });
ok(f7.fps >= 55, `地下城 4 个鬼剑士开着状态特效打怪：${f7.fps} fps，最长一帧 ${f7.maxFrame} ms，渲染平均 ${f7.renderMs} ms / 最长 ${f7.renderMax} ms`);

if (SHOTS) {
  console.log('7. 总览图');
  const tiles = [];
  // 一排角色：list[i] = { job, o（装备）, buffs, invul, mv（每秒移动）, act（动作帧）, fields, label }
  const stage = async (row, list, scene) => {
    const pos = await page.evaluate(async ({ list, scene }) => {
      if (scene === 'town' && game.scene !== 'town') { enterScene('hm_plaza'); await new Promise(r => setTimeout(r, 1200)); }
      __jv.clear(); while (menus.stack.length) menus.close(menus.stack[menus.stack.length - 1]);
      const p = game.player; p.x = cam.x - 200; p.y = 100;   // 自己挪到画面外
      const X0 = cam.x + 110, Y = scene === 'town' ? 150 : 110, G = list.map((o, i) => { const g = __jv.spawn(o.job, o.o, X0 + i * 180 - (o.mv ? 70 : 0), Y); g._x0 = g.x; Object.assign(g.buffs, o.buffs || {}); if (o.mv !== undefined) g._mv = o.mv; if (o.fields) summon(g, 'sb_plemon_f', { x: g.x + 30, y: g.y + 50, lv: 1 }); return g; });
      for (const m of ents) if (m.team === 'e') m.x = cam.x + 2000;
      await new Promise(r => setTimeout(r, 1500));   // 时装分包、武器图
      game.paused = true; __jv.step(30);
      G.forEach((g, i) => { const o = list[i]; if (o.invul) g.invul = 5; if (o.act) { g.doAct({ name: 'shot', clip: o.act, dur: 9, noCounter: true }); g.animT = 0.1; } });
      __jv.step(2);
      return G.map((g, i) => ({ x: sx(list[i].mv ? g.x - 30 : g.x), y: sy(g.y, 0) }));
    }, { list, scene });
    await page.evaluate(() => { for (const id of ['ui', 'dom']) document.getElementById(id).style.visibility = 'hidden'; });   // 只拍世界层（HUD / 窗口先藏起来）
    await page.waitForTimeout(250);
    const f = `${out}/stage${tiles.length}.png`; await page.screenshot({ path: f });
    await page.evaluate(() => { for (const id of ['ui', 'dom']) document.getElementById(id).style.visibility = ''; });
    await page.evaluate(() => { game.paused = false; for (const e of ents) delete e._mv; });
    list.forEach((o, i) => tiles.push({ f, label: o.label, row, box: [pos[i].x - 85, pos[i].y - 150, 170, 168].map(Math.round) }));
  };
  const SB = { wpn: 'ep_ss_shura', enh: 12 }, BZ = { wpn: 'ep_ls_elegy', enh: 12 }, MIX = ['av_academy', 'av_festival', null], MIX2 = ['av_sky2', 'av_summer', 'av_spring'];
  const K = { sb_kaiga: { t: 9999 } }, FR = { frenzy: { t: 9999 } }, FRR = { frenzy: { t: 9999 }, rampage: { t: 9999 } };
  for (const [scene, url] of [['dungeon', null], ['town', null]]) {
    const tag = scene === 'town' ? '城镇' : '地下城';
    await stage(scene === 'town' ? 0 : 3, [
      { job: 'soulbender', o: SB, label: `鬼泣 站立（${tag}）` }, { job: 'soulbender', o: SB, mv: 110, label: '鬼泣 走路' },
      { job: 'soulbender', o: SB, buffs: K, mv: 300, label: '鬼影步（凯贾）跑动' }, { job: 'soulbender', o: SB, buffs: K, invul: 1, label: '鬼影步 无敌半透明' },
      { job: 'soulbender', o: SB, buffs: K, fields: 1, label: '凯贾 + 阵（鬼影重重）' }], scene);
    await stage(scene === 'town' ? 1 : 4, [
      { job: 'berserker', o: BZ, label: `狂战士 站立（${tag}）` }, { job: 'berserker', o: BZ, mv: 300, label: '狂战士 跑动（红眼拖光）' },
      { job: 'berserker', o: BZ, buffs: FR, label: '狂暴之力' }, { job: 'berserker', o: BZ, buffs: FR, act: 'dual1', label: '狂暴之力 二刀流' },
      { job: 'berserker', o: BZ, buffs: FRR, label: '狂暴之力 + 暴走' }], scene);
    if (scene === 'town') await stage(2, [
      { job: 'soulbender', o: { ...SB, mix: MIX }, label: '鬼泣 混搭时装' }, { job: 'soulbender', o: { ...SB, mix: MIX2 }, buffs: K, invul: 1, label: '混搭 + 鬼影步无敌' },
      { job: 'berserker', o: { ...BZ, mix: MIX }, label: '狂战士 混搭时装' }, { job: 'berserker', o: { ...BZ, mix: MIX2 }, buffs: FRR, label: '混搭 + 狂暴 + 暴走' },
      { job: 'asura', o: { wpn: 'ep_katana', enh: 12, mix: MIX }, label: '阿修罗（眼罩，参照）' }], 'town');
    if (scene === 'dungeon') { await page.goto(`${URL_BASE}?town&mute&cls=sword&fresh`); await page.waitForFunction(() => window.__READY); await page.waitForTimeout(600); await page.evaluate(HELP); }
  }
  // 强化光效：新（光在刀身后面）/ 旧（--oldglow）
  const glowRow = async (row, tag) => stage(row, [
    { job: null, o: { wpn: 'ep_ss_shura', enh: 12 }, label: `修罗之戮 +12 ${tag}` }, { job: null, o: { wpn: 'ep_ls_elegy', enh: 12 }, label: `血之挽歌 +12 ${tag}` },
    { job: null, o: { wpn: 'ep_ss_shura', enh: 14 }, label: `修罗之戮 +14 ${tag}` }, { job: null, o: { wpn: 'ep_ls_elegy', enh: 16 }, label: `血之挽歌 +16 ${tag}` },
    { job: null, o: { wpn: 'ep_ls_elegy', enh: 13, amp: 1 }, label: `血之挽歌 增幅 +13 ${tag}` }], 'town');
  await glowRow(5, '（新）');
  if (OLD) { await page.evaluate(src => { const f = (0, eval)('(' + src + ')'); window.__vwNew = window.vanityWeaponFx; window.vanityWeaponFx = (c, L, w, A, im, s, back) => { if (!back) f(c, L, w, A, im, s); }; }, OLD); await glowRow(6, '（旧）'); await page.evaluate(() => { window.vanityWeaponFx = window.__vwNew; }); }
  fs.writeFileSync(`${out}/tiles.json`, JSON.stringify(tiles));
  const py = `
import json
from PIL import Image, ImageDraw, ImageFont
F = ImageFont.truetype('/System/Library/Fonts/STHeiti Medium.ttc', 13); T = ImageFont.truetype('/System/Library/Fonts/STHeiti Medium.ttc', 17)
tiles = json.load(open('${out}/tiles.json')); rows = {}
for t in tiles:
    x, y, w, h = t['box']; im = Image.open(t['f']).convert('RGB').crop((x, y, x + w, y + h))
    cell = Image.new('RGB', (w, h + 18), (18, 16, 22)); cell.paste(im, (0, 18)); ImageDraw.Draw(cell).text((4, 1), t['label'], font=F, fill=(255, 226, 160)); rows.setdefault(t['row'], []).append(cell)
titles = {0: '城镇 · 鬼泣（修罗之戮 +12）：鬼手鬼火 + 身后小鬼神；鬼影步 = 鬼影 + 残影 + 无敌半透明', 1: '城镇 · 狂战士（血之挽歌 +12）：红眼 + 鬼手血气；狂暴之力 = 全身血焰；暴走更猛',
          2: '城镇 · 混搭时装（覆盖层叠在最上面）', 3: '地下城 · 鬼泣', 4: '地下城 · 狂战士', 5: '强化光效：光在刀身后面、外圈更细、火花减半且不压在刀身上（新）', 6: '强化光效（旧版，对照）'}
W = max(sum(c.width + 4 for c in r) for r in rows.values()); out = []
for r in sorted(rows):
    hd = Image.new('RGB', (W, 26), (40, 30, 24)); ImageDraw.Draw(hd).text((8, 3), titles.get(r, ''), font=T, fill=(255, 240, 200)); out.append(hd)
    h = max(c.height for c in rows[r]); im = Image.new('RGB', (W, h + 4), (10, 8, 12)); x = 0
    for c in rows[r]: im.paste(c, (x, 0)); x += c.width + 4
    out.append(im)
sheet = Image.new('RGB', (W, sum(o.height for o in out))); y = 0
for o in out: sheet.paste(o, (0, y)); y += o.height
sheet.save('${out}/sheet.png'); sheet.save('${out}/sheet.jpg', quality=88)
`;
  execFileSync('python3', ['-c', py]); console.log('  总览图', `${out}/sheet.png`);
}

const errs = logs.filter(l => l.type === 'pageerror' || l.type === 'error');
ok(!errs.length, '没有页面错误', errs.slice(0, 3).map(e => e.text).join(' | '));
await browser.close();
console.log(fail ? `✗ ${fail} 项失败` : '✓ 全部通过');
process.exit(fail ? 1 : 0);
