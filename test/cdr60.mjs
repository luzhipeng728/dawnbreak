// 纯冷却流（content/items/cdr60.js，docs/GEAR.md §11）：传说「时之沙漏」5 件套 + 神器「流沙」
//   1. 物品：50 件都在、只有 cdr 特效（没有伤害 / 攻击 / 暴击特效和 proc）、不进随机池、都有图标、流沙武器拿在手里是 <类型>_r3
//   2. 冷却：Lv60 穿满时之沙漏 + 其余部位全流沙 → cdMul = 0.6 × 各来源连乘（套装按档各算一个来源），保底 5%
//   3. 兑换：歌兰蒂斯「深渊派对 · 纯冷却流」列出来、能用宇宙灵魂买（传说 40 / 神器 20）
//   4. 掉落：所有 Lv50 以上地下城（含深渊派对）的领主掉落表里都有，传说比神器稀有；低等级地下城没有
// 用法：node build.mjs --offline && node test/cdr60.mjs
import { launch, URL_BASE } from './lib.mjs';
let fails = 0; const check = (ok, msg, x = '') => { console.log(ok ? '  ✓' : '  ✗', msg, ok ? '' : (typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 600)); if (!ok) fails++; };
const step = s => console.log('\n■ ' + s);
const { browser, page, logs } = await launch({ width: 1280, height: 720 });
const ev = (f, a) => page.evaluate(f, a), wait = ms => page.waitForTimeout(ms);
await page.goto(`${URL_BASE}?town&fresh&mute&cls=sword`);
await page.waitForFunction(() => window.__READY && game.player && game.scene === 'town', null, { timeout: 60000 });
await ev(() => { window.toastMsg = () => {}; while (menus.stack.length) menus.close(menus.stack[menus.stack.length - 1]); });

step('物品');
const lib = await ev(() => {
  const all = [...CDR60.legend, ...CDR60.sand], D = k => ITEMS[k];
  const bad = all.filter(k => { const x = D(k); return !x || x.lvl !== 50 || JSON.stringify(Object.keys(x.fx || {})) !== '["cdr"]' || x.proc || !x.noDrop; });
  return { legend: CDR60.legend.slice(), setPieces: SETS.set_hourglass.pieces.slice(), n: all.length, bad,
    legendOk: CDR60.legend.every(k => D(k).rar === 4 && D(k).fx.cdr === 0.1 && D(k).set === 'set_hourglass'),
    sandOk: CDR60.sand.every(k => D(k).rar === 3 && D(k).fx.cdr === 0.06 && !D(k).set),
    armor: Object.keys(ATYPES).every(a => ARMOR_SLOTS.every(s => D(`sand_${a}_${s}`) && D(`sand_${a}_${s}`).atype === a)),
    acc: [...ACC_SLOTS, ...SPECIAL_SLOTS].every(s => D(`sand_${s}`) && D(`sand_${s}`).slot === s),
    weapons: Object.keys(WTYPES).every(t => D(`sand_${t}`) && D(`sand_${t}`).wtype === t),
    inPool: all.filter(k => GEAR.includes(D(k))), noIcon: all.filter(k => !ASSET_SRC['icon/' + D(k).icon]),
    look: Object.keys(WTYPES).filter(t => weaponArtOf(makeItem(`sand_${t}`), WTYPES[t].cls) !== `${t}_r3`),
    src: itemSourceText('sand_katana'), problems: G60.problems.slice() };
});
check(lib.n === 50 && !lib.bad.length, `50 件（5 传说 + 45 神器），都是 Lv50、只有 cdr 特效、没有 proc、不进随机池`, lib.bad);
check(lib.legendOk && lib.setPieces.join() === lib.legend.join(), `时之沙漏：${lib.legend.join(' ')}（传说，每件 -10%）`);
check(lib.sandOk && lib.armor && lib.acc && lib.weapons, '流沙：5 种护甲 × 5 部位 + 首饰 3 + 辅助 + 魔法石 + 15 种武器（神器，每件 -6%）');
check(!lib.inPool.length, '不在随机掉落池里', lib.inPool);
check(!lib.noIcon.length, `每件都有图标（缺 ${lib.noIcon.length}）`, lib.noIcon.join(' '));
check(!lib.look.length, '流沙武器拿在手里是 <类型>_r3', lib.look);
check(/Lv50 以上/.test(lib.src) && /宇宙灵魂/.test(lib.src), `获取途径：${lib.src}`);
check(!lib.problems.length, 'G60.problems 为空', lib.problems);

step('冷却：Lv60 穿满');
const cd = await ev(() => {
  const p = game.player; game.lvl = 60; inv.ensure();
  for (const s of SLOTS) delete inv.equip[s];
  recalcStats(p); const base = p.cdMul;
  const M = masteryOf(p.cls, game.job), kit = { weapon: `sand_${CLASS_START_WEAPON[p.cls]}` };
  for (const s of ARMOR_SLOTS) kit[s] = `sand_${M}_${s}`;
  const legend = CDR60.legend.map(k => [ITEMS[k].slot, k]);
  const steps = [], near = (a, b) => Math.abs(a - b) < 1e-9;
  for (const s in kit) inv.equip[s] = makeItem(kit[s]);
  recalcStats(p); steps.push({ n: 0, got: p.cdMul, want: base * 0.94 ** 6, on: [] });
  const tierMul = n => [[2, 0.95], [3, 0.92], [5, 0.88]].reduce((m, [k, v]) => n >= k ? m * v : m, 1);
  legend.forEach(([s, k], i) => {
    inv.equip[s] = makeItem(k); recalcStats(p);
    const n = i + 1, S = (p.sets || []).find(x => x.id === 'set_hourglass');
    steps.push({ n, got: p.cdMul, want: Math.max(0.6 * 0.05, base * 0.94 ** 6 * 0.9 ** n * tierMul(n)), on: S ? S.on : [] });
  });
  const full = p.cdMul, cdr = p.stats.cdr;
  // 保底：把 5 件效果临时改成 -99%，应该停在 0.6 × 5%
  const B5 = SETS.set_hourglass.bonus[5].st; B5.cdr = 0.99; recalcStats(p); const floor = p.cdMul; B5.cdr = 0.12; recalcStats(p);
  return { base, M, kit, steps: steps.map(x => ({ ...x, ok: near(x.got, x.want) })), full, cdr, floor, after: p.cdMul, near: near(p.cdMul, full) };
});
check(Math.abs(cd.base - 0.6) < 1e-9, `没穿装备：cdMul = ${cd.base}（刷图基准 ×0.6）`);
check(cd.steps.every(x => x.ok), `逐件穿上（流沙 6 件 + 时之沙漏 0~5 件）：cdMul 都等于 0.6 × 连乘`, cd.steps.filter(x => !x.ok));
check(['', '', '2', '2,3', '2,3', '2,3,5'].every((w, n) => cd.steps[n].on.join() === w), `套装按档生效：${cd.steps.map(x => `${x.n}件[${x.on.join('/')}]`).join(' ')}`);
const want = 0.6 * 0.94 ** 6 * 0.9 ** 5 * 0.95 * 0.92 * 0.88;
check(Math.abs(cd.full - want) < 1e-9, `全身纯冷却（${cd.M} 护甲 + ${cd.kit.weapon}）：cdMul = ${cd.full.toFixed(4)} = 0.6 × 0.94^6 × 0.9^5 × 0.95 × 0.92 × 0.88（面板冷却 -${(cd.cdr * 100).toFixed(1)}%）`);
check(Math.abs(cd.floor - 0.03) < 1e-9 && cd.near, `保底 5%：连乘低于 5% 时 cdMul = 0.6 × 5% = ${cd.floor}；改回后恢复`);

step('兑换：歌兰蒂斯 · 纯冷却流');
await ev(() => { inv.add(makeItem('m_cosmos', 100)); menus.open('abyss', NPCS.grandis); });
await wait(300);
await page.click('[data-win=abyss] .itab:has-text("纯冷却流")'); await wait(200);
const ex0 = await ev(() => ({ keys: cdr60ExchangeKeys(), shown: document.querySelectorAll('[data-win=abyss] .exgrid .islot').length, soul: inv.count('m_cosmos'), cost: [cdr60Cost('set_hourglass_neck'), cdr60Cost('sand_katana')] }));
check(ex0.shown === ex0.keys.length && ex0.keys.length === 40 && ex0.keys.slice(0, 5).join() === lib.legend.join() && ex0.keys.includes('sand_katana') && !ex0.keys.includes('sand_revolver'),
  `列出 ${ex0.shown} 件（传说 5 + 流沙首饰 / 特殊 5 + 流沙防具 25 + 本职业武器 5）`, ex0);
check(ex0.cost[0] === 40 && ex0.cost[1] === 20, `价格：传说 ${ex0.cost[0]}、神器 ${ex0.cost[1]} 宇宙灵魂`);
const buy = async key => {
  const i = ex0.keys.indexOf(key);
  await page.click(`[data-win=abyss] .exgrid .islot >> nth=${i}`); await wait(120);
  await page.click('[data-win=abyss] .exrow .btn'); await wait(150); await page.click('.idlg .btn:not(.blue)'); await wait(200);
  return ev(k => ({ got: inv.count(k), soul: inv.count('m_cosmos') }), key);
};
await page.screenshot({ path: 'test/shots/cdr60_exchange.png' });
const b1 = await buy('set_hourglass_neck'), b2 = await buy('sand_katana');
check(b1.got === 1 && b1.soul === ex0.soul - 40, `买到时之沙漏项链：宇宙灵魂 ${ex0.soul} → ${b1.soul}`);
check(b2.got === 1 && b2.soul === b1.soul - 20, `买到流沙太刀：宇宙灵魂 ${b1.soul} → ${b2.soul}`);

step('掉落表');
const dr = await ev(() => {
  const all = [...CDR60.legend, ...CDR60.sand], hi = [], lo = [], miss = [];
  for (const id in DUNGEONS) {
    const G = DUNGEONS[id], T = DROP_TABLES[id], B = new Map(((T && T.boss) || []).map(e => [e[0], e[1]]));
    if (G.lvl && G.lvl[1] >= 50) { hi.push(id); for (const k of all) if (B.get(k) !== (ITEMS[k].rar === 4 ? 0.002 : 0.004)) miss.push(`${id}:${k}=${B.get(k)}`); }
    else if (all.some(k => B.has(k))) lo.push(id);
  }
  return { hi, lo, miss, abyss: hi.filter(id => ABYSS[id]) };
});
check(dr.hi.length >= 20 && dr.abyss.length >= 3 && !dr.miss.length, `${dr.hi.length} 个 Lv50 以上地下城（含深渊 ${dr.abyss.join(' ')}）的领主掉落：传说每件 0.2%、神器每件 0.4%`, dr.miss.slice(0, 10));
check(!dr.lo.length, 'Lv50 以下的地下城不掉', dr.lo);

check(!logs.some(l => l.type === 'pageerror'), '没有页面报错', logs.filter(l => l.type === 'pageerror').map(l => l.text.slice(0, 200)));
await browser.close();
console.log(fails ? `\n✗ ${fails} 项失败` : '\n✓ 全部通过');
process.exit(fails ? 1 : 0);
