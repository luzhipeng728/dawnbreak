// 商城与礼包测试：购买 / 限购 / 自选属性、天空套合成（固定随机种子验证概率）、开箱与十连、魔盒保底与碎片、多买多送、不放回抽奖、
// 兑换商店、券、宠物跟随、光环与天空 8 件光效（城镇 + 地下城）、点券产出、刷新后数据仍在
// 用法：node build.mjs --offline && node test/shop.mjs [cls]
import { launch, URL_BASE } from './lib.mjs';
import fs from 'fs';
const cls = process.argv[2] || 'sword';
const out = 'test/shots/shop'; fs.mkdirSync(out, { recursive: true });
const { browser, page, logs } = await launch({ width: 1280, height: 720 });
const wait = ms => page.waitForTimeout(ms), shot = n => page.screenshot({ path: `${out}/${n}.png` });
const ev = (fn, arg) => page.evaluate(fn, arg);
let fails = 0;
const check = (ok, msg, extra = '') => { console.log(ok ? '  ✓' : '  ✗', msg, extra); if (!ok) fails++; };
const closeAll = () => ev(() => { while (menus.stack.length) menus.close(menus.stack[menus.stack.length - 1]); });
const step = s => console.log('·', s);

try {
await page.goto(`${URL_BASE}?town&fresh&cls=${cls}&mute`);
await page.waitForFunction(() => window.__READY && game.player && game.scene === 'town', null, { timeout: 30000 });
await wait(500); await closeAll();
await ev(() => { cashData(); save.data.cera = 200000; game.gold = 500000; game.lvl = 20; recalcStats(game.player); inv.cap = 200; save.write(); });

/* ---------- 1. 入口：菜单按钮栏 + 快捷键 ] ---------- */
step('入口：菜单按钮 / 快捷键');
check(await ev(() => MENUBAR.some(b => b[0] === 'cash') && KEYMAP.cash.includes('BracketRight')), '菜单按钮栏有“商城”，快捷键 ]');
await page.keyboard.press(']'); await wait(300);
check(await ev(() => menus.isOpen('cash')), '按 ] 打开商城');
await shot('01-rec');
await page.keyboard.press(']'); await wait(200);
check(await ev(() => !menus.isOpen('cash')), '再按 ] 关闭');
await page.click('#menubar button[title="商城"]'); await wait(300);
check(await ev(() => menus.isOpen('cash')), '点菜单按钮打开商城');
await closeAll(); await ev(() => menus.open('system')); await wait(150); await page.click('[data-win=system] .btn:has-text("破晓商城")'); await wait(250);
check(await ev(() => menus.isOpen('cash') && !menus.isOpen('system')), '系统菜单（触屏也能进）里的“破晓商城”打开商城');

/* ---------- 2. 购买：单件自选属性、整套、限购、免费礼包、等级礼包 ---------- */
step('购买');
await page.click('.cashwin .itab:has-text("时装")'); await wait(200);
await page.click('.cashwin .ccard:has-text("锦鲤贺岁醒狮帽")'); await wait(200);
await page.selectOption('.cash-side select', 'cspd'); await wait(100);
const c0 = await ev(() => save.data.cera);
await page.click('.cash-side .btn.buy'); await wait(250);
const hat = await ev(() => { const it = inv.items.find(x => x.key === 'av_hat_spring'); return it && { opt: it.opt, cspd: it.st.cspd, lock: it.optLock, cera: save.data.cera }; });
check(hat && hat.opt === 'cspd' && hat.cspd === 0.02 && hat.lock, '单件时装：购买时自选“施放速度 +2%”', JSON.stringify(hat));
check(hat && c0 - hat.cera === 1500, `扣点券 ${c0 - (hat ? hat.cera : 0)} = 1500`);
await shot('02-avatar');
const whole = await ev(() => { const r = cashBuy('set:av_summer', 1, { opts: { av_top_summer: 'int' } }); return { ok: r.ok, n: inv.items.filter(x => x.set === 'av_summer').length, top: (inv.items.find(x => x.key === 'av_top_summer') || {}).st }; });
check(whole.ok && whole.n === 8 && whole.top.int === 8 + 3, '整套 8 件，上衣自选智力（固定四维 +3 + 智力 +8）', JSON.stringify(whole));
const lim = await ev(() => { const r = [1, 2, 3, 4].map(() => cashBuy('fatigue', 1)); return r.map(x => !!x.ok); });
check(lim.join() === 'true,true,true,false', '抗疲劳秘药每天限购 3', lim.join());
const free = await ev(() => { const a = cashBuy('pkg_newbie'), b = cashBuy('pkg_newbie'); return [!!a.ok, b.err]; });
check(free[0] && free[1], '新手礼包免费领取 1 次，第二次被拦', JSON.stringify(free));
const lvp = await ev(() => { game.lvl = 25; const a = cashBuy('pkg_lv30'), b = cashBuy('pkg_lv20'); game.lvl = 20; return [a.err, !!b.ok]; });
check(lvp[0] && lvp[1], '等级礼包：Lv30 未到级不能领，Lv20 可以领', JSON.stringify(lvp));
const pack = await ev(() => { const it = inv.items.find(x => x.key === 'pkg_lv20'); const n0 = inv.count('box_magic'); inv.useItem(it); return { magic: inv.count('box_magic') - n0, egg: inv.count('egg_pet'), left: inv.count('pkg_lv20') }; });
check(pack.magic === 10 && pack.egg >= 1 && pack.left === 0, '右键打开礼包得到全部内容', JSON.stringify(pack));
await wait(300); await shot('03-pack-got'); await closeAll();
const deals = await ev(() => { const D = cashDeals(); const g = D.day[0]; const r = cashBuy(g.pid, 1); const r2 = cashBuy(g.pid, 9); return { n: D.day.length, week: !!D.week, ok: !!r.ok, price: g.price, base: g.base, lim2: g.limit.n > 1 ? 'skip' : r2.err }; });
check(deals.n === 3 && deals.week && deals.ok && deals.price < deals.base && deals.lim2, '每日特惠 3 个 + 每周特惠，打折且限购', JSON.stringify(deals));

/* ---------- 3. 穿戴时装 / 属性选择 ---------- */
step('穿戴与属性选择');
const wear = await ev(() => { const s0 = game.player.stats.cspd; const it = inv.items.find(x => x.key === 'av_hat_spring'); inv.wear(it); recalcStats(game.player); return { d: +(game.player.stats.cspd - s0).toFixed(3) }; });
check(wear.d === 0.02, '穿上醒狮帽：施放速度 +2%', JSON.stringify(wear));
const opt = await ev(() => { const it = inv.items.find(x => x.key === 'av_shoes_summer'); const a = cashSetOpt(it, 'str'); const b = cashSetOpt(it, 'vit'); inv.add(makeItem('tk_avopt', 1)); const c = cashSetOpt(it, 'vit'); return { a: a.free, b: b.err, c: !!c.ok, st: it.st.vit, tk: inv.count('tk_avopt') }; });
check(opt.a && opt.b && opt.c && opt.st === 6 && opt.tk === 0, '第一次换属性免费，之后需要变更券', JSON.stringify(opt));
await ev(() => menus.open('avopt')); await wait(250); await shot('04-avopt'); await closeAll();

/* ---------- 4. 天空套合成（固定种子） ---------- */
step('装扮合成（固定随机种子）');
const syn = await ev(() => {
  cashSeed(20260928);
  const N = 400; let ok = 0, sameSlot = 0;
  for (let i = 0; i < N; i++) {
    const a = makeItem('av_belt_spring'), b = makeItem('av_belt_academy'); inv.add(a); inv.add(b); inv.add(makeItem('synth_basic', 1));
    const r = cashSynth({ synth: 'synth_basic', inputs: [a, b], set: 'av_sky1' });
    if (r.ok) ok++; else if (r.item.slot === 'av_belt' && CASH_ADV_SETS.includes(r.item.set)) sameSlot++;
    inv.remove(r.item);
  }
  let okG = 0;
  for (let i = 0; i < N; i++) { const a = makeItem('av_shoes_spring'), b = makeItem('av_shoes_spring'); inv.add(a); inv.add(b); inv.add(makeItem('synth_gold', 1)); const r = cashSynth({ synth: 'synth_gold', inputs: [a, b], set: 'av_sky2' }); if (r.ok) okG++; inv.remove(r.item); }
  // 梦想：任意 8 件 → 指定部位 100%
  const ins = AV_PIECE_SLOTS.map(s => makeItem(avKey('av_academy', s))); ins.forEach(x => inv.add(x)); inv.add(makeItem('synth_dream', 1));
  const d = cashSynth({ synth: 'synth_dream', inputs: ins, set: 'av_sky2', slot: 'av_top', opt: 'int' });
  const bad = cashSynth({ synth: 'synth_basic', inputs: [makeItem('av_top_spring')], set: 'av_sky1' });
  cashSeed(null);
  return { rate: ok / N, sameSlot: sameSlot === N - ok, rateG: okG / N, dream: d.ok && d.item.key === 'av_top_sky2' && d.item.opt === 'int', bad: bad.err };
});
check(syn.rate > 0.15 && syn.rate < 0.25, `普通合成器成功率 ${(syn.rate * 100).toFixed(1)}%（期望 20%）`);
check(syn.rateG > 0.25 && syn.rateG < 0.35, `黄金合成器成功率 ${(syn.rateG * 100).toFixed(1)}%（期望 30%）`);
check(syn.sameSlot, '失败时都得到 1 件同部位的高级装扮');
check(syn.dream, '梦想合成器：8 件 → 指定部位 100%，带自选属性');
check(!!syn.bad, '材料不对时拒绝合成', syn.bad);
// 界面：合成成功演出
await ev(() => { cashSeed(1); for (const k of ['av_hat_spring', 'av_hat_summer']) inv.add(makeItem(k)); inv.add(makeItem('synth_gold', 2)); menus.open('synth', { key: 'synth_gold' }); });
await wait(250);
await page.click('[data-win=synth] .csy-list .islot >> nth=0'); await wait(100);
await ev(() => { inv.add(makeItem(avKey('av_academy', CSY.ins[0].slot))); menus.wins.synth._render(); }); await wait(100);
await page.click('[data-win=synth] .csy-list .islot >> nth=0'); await wait(150);
check(await ev(() => CSY.ins.length === 2 && CSY.ins[0].slot === CSY.ins[1].slot), '点击放入 2 件同部位高级装扮（放入第一件后列表只剩同部位）');
await shot('05-synth');
const ann = await ev(() => { window.__ann = []; bus.on('announce', e => window.__ann.push(e)); cashRng = () => 0.01; return true; });
await page.click('[data-win=synth] .btn:has-text("合成")'); await wait(900);
const synOk = await ev(() => ({ open: menus.isOpen('boxopen'), ann: window.__ann.map(e => e.kind), sky: inv.items.some(x => x.set === 'av_sky1' || x.set === 'av_sky2') }));
check(synOk.open && synOk.ann.includes('skyset') && synOk.sky, '合成成功：全屏演出 + 全服公告 skyset', JSON.stringify(synOk));
await shot('06-synth-ok');
await ev(() => cashSeed(null)); await closeAll();

/* ---------- 5. 开箱：单开、十连、保底、碎片、概率 ---------- */
step('开箱与十连');
const odds = await ev(() => { const o = cashBoxOdds('box_magic'); return { sum: +o.reduce((s, x) => s + x.p, 0).toFixed(6), jack: +o.filter(x => x.jackpot).reduce((s, x) => s + x.p, 0).toFixed(4), n: o.length }; });
check(Math.abs(odds.sum - 1) < 1e-6, `魔盒概率公示合计 100%（${odds.n} 项）`, `大奖 ${(odds.jack * 100).toFixed(2)}%`);
const stat = await ev(() => { cashSeed(7); const T = cashBoxTiers('box_magic'); let j = 0; const N = 40000; for (let i = 0; i < N; i++) if (cashRollTier(T).T.jackpot) j++; cashSeed(null); return j / N; });
check(Math.abs(stat - odds.jack) < 0.004, `固定种子抽 4 万次：大奖 ${(stat * 100).toFixed(2)}%（公示 ${(odds.jack * 100).toFixed(2)}%）`);
const pity = await ev(() => { const S = cashData(); S.pity.box_magic = 99; inv.add(makeItem('box_magic', 2)); cashRng = () => 0.999; const r = cashOpenBoxes('box_magic', 1); const r2 = cashOpenBoxes('box_magic', 1); cashSeed(null); return { jack: r.results[0].jackpot, after: S.pity.box_magic, r2: r2.results[0].jackpot }; });
check(pity.jack && pity.after === 1 && !pity.r2, '保底：第 100 次必出大奖，出货后计数归零', JSON.stringify(pity));
check(await ev(() => { const L = cashData().openLog || []; return L.some(x => x.jp && x.forced); }), '开箱记录里有这次保底大奖（标记“保底”）');
const s0 = await ev(() => cashBal('shard'));
await ev(() => { inv.add(makeItem('box_magic', 12)); });
const one = await ev(() => cashBoxUI('box_magic', 1));
await wait(400); await shot('07-box-shake'); await wait(1200); await shot('08-box-open');
check(one && await ev(() => menus.isOpen('boxopen')), '单开：播放开箱演出');
await page.click('.cbox-foot .btn:has-text("十连")'); await wait(700); await shot('09-ten-back');
await page.waitForFunction(() => document.querySelectorAll('.cbox-t').length === 10 && !document.querySelector('.cbox-t.hide') && document.querySelector('.cbox-foot .btn'), null, { timeout: 12000 }).catch(() => {}); await wait(500); await shot('10-ten-open');
const ten = await ev(() => ({ tiles: document.querySelectorAll('.cbox-t').length, hidden: document.querySelectorAll('.cbox-t.hide').length, shard: cashBal('shard') }));
check(ten.tiles === 10 && ten.hidden === 0, '十连：一次展示 10 张，全部翻开', JSON.stringify(ten));
check(ten.shard - s0 === 11, `每开 1 个魔盒得 1 个碎片（+${ten.shard - s0}）`);
await closeAll();
// 其他箱子都能开（有奖池的 × 3）
const boxes = await ev(() => { const r = {}; for (const k in CASH_BOXES) { inv.add(makeItem(k, 3)); const x = cashOpenBoxes(k, 3); r[k] = x.err || x.results.flatMap(R => R.items).length; } return r; });
check(Object.values(boxes).every(v => typeof v === 'number' && v >= 3), '所有箱子都能开出东西', JSON.stringify(boxes));
const sel = await ev(() => { inv.add(makeItem('box_epic', 1)); const keys = cashSelectKeys('box_epic'); const r = cashOpenSelect('box_epic', keys[0]); return { n: keys.length, ok: r.results && r.results[0].items[0].rar === 5 }; });
check(sel.n > 0 && sel.ok, `史诗自选礼盒：${sel.n} 件可选，开出史诗`);

/* ---------- 6. 多买多送 ---------- */
step('多买多送');
const multi = await ev(() => { const S = cashData(); const m0 = S.multi; for (let i = 0; i < 5; i++) cashBuy(['pkg_spring', 'pkg_summer', 'pkg_academy'][i % 3]); return { multi: S.multi - m0, aura: inv.count('aura_supreme'), title: inv.count('title_supreme'), pet: inv.count('pet_pegasus'), got: Object.keys(S.multiGot) }; });
check(multi.multi === 5 && multi.aura === 1 && multi.title === 1 && multi.pet === 1, '累计 5 套：送至尊光环 / 称号 / 宠物', JSON.stringify(multi));

/* ---------- 7. 不放回抽奖 ---------- */
step('破晓启示（不放回抽奖）');
const lot = await ev(() => { inv.add(makeItem('tk_lotto', 30)); const seen = []; for (let i = 0; i < 20; i++) { const r = cashLottoDraw(); if (r.err) return { err: r.err, i }; seen.push(r.i); } const over = cashLottoDraw(); const claim = cashLottoClaim(); const reset = cashLottoReset(); return { uniq: new Set(seen).size, over: !!over.err, claim: !!claim.ok, reset: !!reset.ok, left: cashLottoState().left, resets: cashLottoState().resets }; });
check(lot.uniq === 20 && lot.over && lot.claim && lot.reset && lot.left === 20 && lot.resets === 1, '20 次抽空（不重复）→ 领完成奖励 → 重置', JSON.stringify(lot));
await ev(() => menus.open('lotto')); await wait(250);
await page.click('[data-win=lotto] .btn:has-text("抽 1 次")'); await wait(2200);
check(await ev(() => cashLottoState().got.length === 1), '界面抽 1 次（轮盘动画）');
await shot('11-lotto'); await closeAll();

/* ---------- 8. 兑换商店 ---------- */
step('兑换商店');
const ex = await ev(() => { const S = cashData(); S.shard = 400; S.gcoin = 50; const i = CASH_EXCH.shard.goods.findIndex(g => g.key === 'box_epic'); const a = cashExchange('shard', i), b = cashExchange('shard', i); const j = CASH_EXCH.gcoin.goods.findIndex(g => g.key === 'tk_lotto'); const t0 = inv.count('tk_lotto'); const c = cashExchange('gcoin', j); return { a: !!a.ok, b: b.err, shard: S.shard, lotto: inv.count('tk_lotto') - t0, gcoin: S.gcoin }; });
check(ex.a && ex.b && ex.shard === 200 && ex.lotto === 1 && ex.gcoin === 45, '碎片换史诗自选（每周 1）、礼包币换抽奖券', JSON.stringify(ex));
await ev(() => menus.open('cashx')); await wait(250); await shot('12-exchange'); await closeAll();

/* ---------- 9. 券 ---------- */
step('强化券 / 兑换券');
const tk = await ev(() => { const w = inv.equip.weapon; w.enh = 2; inv.add(makeItem('tk_enh7', 1)); const t = inv.items.find(x => x.key === 'tk_enh7'); const r = cashUseTicket(t, w); inv.add(makeItem('tk_sky', 1)); const s = inv.items.find(x => x.key === 'tk_sky'); const r2 = cashUseTicket(s, null, { set: 'av_sky1', slot: 'av_hat', opt: 'str' }); return { enh: w.enh, ok: !!r.ok, sky: r2.ok && r2.items[0].key === 'av_hat_sky1' && r2.items[0].st.str === 10 }; });
check(tk.ok && tk.enh === 7 && tk.sky, '+7 强化券把武器变为 +7；天空套部件兑换券自选部位和属性', JSON.stringify(tk));

/* ---------- 10. 宠物跟随 / 光环 / 天空 8 件光效 ---------- */
step('宠物 / 光环 / 天空套光效');
await ev(() => { for (const k of ['pet_lion', 'aura_spring', 'petR_2', 'petB_1']) { const it = inv.items.find(x => x.key === k) || (inv.add(makeItem(k)), inv.items.find(x => x.key === k)); inv.wear(it); } });
await wait(400);
const pet0 = await ev(() => { const p = game.player, C = p._cash; return C && C.pet && { dx: C.pet.x - p.x, inFx: fxList.includes(C.petFx) && fxList.includes(C.auraFx) }; });
check(pet0 && pet0.inFx, '宠物和光环出现在场景里', JSON.stringify(pet0));
await page.keyboard.down('ArrowRight'); await wait(1200); await shot('13-pet-walk'); await page.keyboard.up('ArrowRight'); await wait(900);
const pet1 = await ev(() => { const p = game.player, S = p._cash.pet; return { dx: Math.round(S.x - p.x), dy: Math.round(S.y - p.y), face: S.face, pf: p.face }; });
check(Math.abs(pet1.dx) < 90 && Math.abs(pet1.dy) < 30, '走动后宠物跟在身后', JSON.stringify(pet1));
await shot('14-pet-aura');
await ev(() => menus.open('pet')); await wait(400); await shot('15-pet-window'); await closeAll();
// 天空 8 件套
await ev(() => { for (const s of AV_PIECE_SLOTS) { const it = makeItem(avKey('av_sky1', s)); inv.add(it); inv.wear(it); } });
await wait(1500);
const sky = await ev(() => { const p = game.player; return { set: (p.sets || []).find(x => x.id === 'av_sky1'), parts: p._cash.parts.length, fx: fxList.includes(p._cash.glowFx) }; });
check(sky.set && sky.set.on.includes(8) && sky.parts > 3 && sky.fx, '天空 8 件套：套装效果 + 身上光效', JSON.stringify({ on: sky.set && sky.set.on, parts: sky.parts }));
await shot('16-sky8');
// 进地下城：宠物 / 光环 / 光效一起出现
await ev(() => { game.player.x = 400; startTestRoom(); });
await wait(1500);
const dg = await ev(() => { const p = game.player, C = p._cash; return { scene: game.scene, pet: !!(C && fxList.includes(C.petFx)), aura: !!(C && fxList.includes(C.auraFx)), glow: !!(C && fxList.includes(C.glowFx)) }; });
check(dg.pet && dg.aura && dg.glow, '地下城里宠物 / 光环 / 光效都在', JSON.stringify(dg));
await shot('17-dungeon');
const perf = await ev(async () => { const t0 = performance.now(); for (let i = 0; i < 300; i++) renderWorld(); return (performance.now() - t0) / 300; });
console.log(`  · 每帧 renderWorld 平均 ${perf.toFixed(2)} ms（含宠物 / 光环 / 光效）`);

// 外观组登记的时装帧集：上衣 + 下装同套时整套换装；武器装扮换武器图（外观组分支合并后才有，没合并时只打印）
const looks = await ev(() => {
  const cls = game.player.cls, reg = [], miss = [];
  for (const set in CASH_SETS) { const eq = { av_top: makeItem(avKey(set, 'av_top')), av_bottom: makeItem(avKey(set, 'av_bottom')) }; const L = lookFromEquip(cls, eq); (L.set ? reg : miss).push(set); }
  const w = lookFromEquip(cls, { weapon: inv.equip.weapon, av_weapon: makeItem('av_weapon_spring') }).wpn;
  return { reg, miss, wskin: w, sets: Object.keys(AVATAR_SETS || {}) };
});
console.log(`  · 已登记整套帧集：${looks.reg.join(' ') || '无'}；还没有：${looks.miss.join(' ') || '无'}；武器装扮 → ${looks.wskin}`);
check(looks.reg.every(set => looks.sets.includes(set)), '登记了帧集的时装，穿上衣 + 下装会整套换装');

/* ---------- 11. 点券产出 ---------- */
step('点券产出');
const earn = await ev(() => {
  const S = cashData(), c0 = save.data.cera; S.today.rank = 0;
  bus.emit('dungeonClear', { id: 'lorien', diff: 0, rank: 'SSS', time: 60, hurt: 0, maxCombo: 30 });
  const c1 = save.data.cera; bus.emit('dungeonClear', { id: 'lorien', diff: 0, rank: 'S', time: 60, hurt: 0, maxCombo: 30 });
  const c2 = save.data.cera; S.lvlPaid = 20; game.lvl = 21; bus.emit('levelUp', { lvl: 21 }); const c3 = save.data.cera;
  const q = Object.values(QUESTS).find(Q => Q.type === 'daily'); bus.emit('questDone', { id: q.id }); const c4 = save.data.cera;
  S.today.exch = 0; const g0 = game.gold; const x = cashExchGold(600); const c5 = save.data.cera;
  S.today.rank = 990; bus.emit('dungeonClear', { id: 'lorien', diff: 0, rank: 'SSS', time: 60, hurt: 0, maxCombo: 30 }); const c6 = save.data.cera;
  return { first: c1 - c0, s: c2 - c1, lvl: c3 - c2, daily: c4 - c3, exch: c5 - c4, gold: g0 - game.gold, cap: c6 - c5, ach: S.ach.sss ? 1 : 0 };
});
check(earn.first === 300 + 80 + 500, `首通 300 + SSS 80 + 成就“完美演出”500 = ${earn.first}`);
check(earn.s === 40 && earn.lvl === 21 * 40 && earn.daily === 150, `S 评价 40、升级 Lv21 ${earn.lvl}、每日任务 150`, JSON.stringify(earn));
check(earn.exch === 500 && earn.gold === 25000 && earn.cap === 10, '金币兑换每天 500 封顶（25000 G），评价每天 1000 封顶', JSON.stringify(earn));
await ev(() => menus.open('cashlog', { tab: 'earn' })); await wait(250); await shot('18-earn'); await closeAll();

/* ---------- 12. 刷新后数据仍在 ---------- */
step('刷新后数据仍在');
const before = await ev(() => { save.write(); const S = cashData(); return { cera: save.data.cera, shard: S.shard, multi: S.multi, pity: S.pity.box_magic, pet: inv.equip.av_pet && inv.equip.av_pet.key, hatOpt: (inv.equip.av_hat || {}).opt, lotto: S.lotto.got.length, buys: S.buys.length }; });
await page.goto(`${URL_BASE}?town&cls=${cls}&mute`);
await page.waitForFunction(() => window.__READY && game.player && game.scene === 'town', null, { timeout: 30000 });
await wait(800);
const after = await ev(() => { inv.ensure(); const S = cashData(); return { cera: save.data.cera, shard: S.shard, multi: S.multi, pity: S.pity.box_magic, pet: inv.equip.av_pet && inv.equip.av_pet.key, hatOpt: (inv.equip.av_hat || {}).opt, lotto: S.lotto.got.length, buys: S.buys.length }; });
check(JSON.stringify(before) === JSON.stringify(after), '点券、碎片、多买多送、保底、宠物、时装属性、抽奖进度、购买记录都在', JSON.stringify(after));
const petBack = await ev(() => { const C = game.player._cash; return !!(C && fxList.includes(C.petFx)); });
check(petBack, '刷新后宠物继续跟随');
await ev(() => menus.open('cash', { tab: 'box' })); await wait(500); await shot('19-box-tab');
await ev(() => { CW.tab = 'pet'; CW.sel = 'pet_seal'; menus.wins.cash._render(); }); await wait(500); await shot('20-pet-tab');

} catch (e) { fails++; console.log('  ✗ 测试中断：', e.message.split('\n')[0]); await shot('99-crash').catch(() => {}); }
const errs = logs.filter(l => l.type === 'pageerror' || (l.type === 'error' && !/favicon|ERR_FILE_NOT_FOUND/.test(l.text)));
check(!errs.length, '页面没有报错', errs.slice(0, 3).map(e => e.text.slice(0, 200)).join(' | '));
console.log(fails ? `\n✗ ${fails} 项失败` : '\n全部通过');
await browser.close();
process.exit(fails ? 1 : 0);
