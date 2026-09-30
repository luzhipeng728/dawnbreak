// 装备 2.0（满级 60，docs/GEAR_PLAN_60.md）：node build.mjs && node test/gear60.mjs [core|migrate|content|power|all] [--only weapon|armor|acc]
//   core    注册接口（搬家 / 继承 / 继承套装 / 领主神器 / 指定怪物掉落 / 掉落表替换 / 深渊归属与保底池）、图鉴页、兑换价、获取途径、ORDER 里的空文件（B0，任何时候都要过）
//   migrate 老存档迁移：tools/admin/maxout.mjs 造的 Lv30 +12 存档（阿波菲斯 +12 带红字 / 锻造 / 附魔）+ Lv60 角色 + 仓库 + 账号金库；
//           不丢不复制、强化等转移、强度不变、刷新后不重复补发、云存档走真服务端往返、一键满级券升到 60 后能穿回老物品
//           （还没有真实的搬家时，测试自己登记一个样本：阿波菲斯 → Lv55 + 继承装备，身上的 Lv28 五件套整套搬到 Lv60 + 继承套装）
//   content B1~B3 交付时要过：每部位 × 等级段数量下限、蓝图的搬家表、继承装备数值一致、每件有图标 / 武器图、G60.problems 为空
//   jobs    每个开放的转职（格斗家的气功师 / 散打 / 街霸 / 柔道家也在内）：每 5 级都能买到 / 掉到能装的武器、每 10 级内有能刷到的史诗武器；
//           单换武器的「最好史诗 / 同级稀有」倍率按转职的伤害类型算够高（魔法转职的武器要有智力 / 魔法暴击 / 施放）；装备对比、红字默认属性按转职伤害类型；
//           每类武器 Lv60 T1 < T2 < T3、Lv55 < T1（按这类武器的主口径：魔攻系数高的按魔法转职）
//   power   各等级「同级最好史诗」对「同级稀有（去掉随机属性）」的综合倍率，和 Lv30 比在 ±10% 以内（搜索见 test/lib_bestkit.mjs，结果和原因见 GEAR.md §10.4）；加 --why 输出拆解（因子 / 套装 / fx / 每件）
import { launch, URL_BASE } from './lib.mjs';
import { BEST_KIT_SRC } from './lib_bestkit.mjs';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
const MODE = process.argv[2] || 'core', ONLY = (process.argv.find(a => a.startsWith('--only=')) || '').slice(7) || (process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : '');
const run = m => MODE === m || MODE === 'all';
const ROOT = new URL('..', import.meta.url).pathname;
let fails = 0; const check = (ok, msg, x = '') => { console.log(ok ? '  ✓' : '  ✗', msg, ok ? '' : (typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 600)); if (!ok) fails++; };
const step = s => console.log('\n■ ' + s);
const { browser, page, logs } = await launch({ width: 800, height: 450 });
const ev = (f, a) => page.evaluate(f, a);
const boot = async q => { await page.goto(`${URL_BASE}?${q}`); await page.waitForFunction(() => window.__READY && game.player && game.scene === 'town', null, { timeout: 60000 }); await ev(() => { window.toastMsg = () => {}; }); };

/* ================= core ================= */
if (run('core')) {
  step('core：注册接口 / 掉落 / 图鉴 / 兑换价');
  const ord = fs.readFileSync(ROOT + 'src/ORDER', 'utf8');
  const need = ['gear60_api', 'epics60_w_sword', 'epics60_w_gun', 'epics60_w_mage', 'epics60_armor', 'epics60_acc', 'gear60_apply'];
  const pos = need.map(n => ord.indexOf(`content/items/${n}.js`));
  check(pos.every(p => p > 0) && pos.slice(0, 6).every((p, i, a) => !i || p > a[i - 1]) && pos[0] > ord.indexOf('content/items/epics3.js') && pos[6] > ord.indexOf('content/abyss.js'), 'ORDER：接口 → 5 个内容文件（epics3 之后）→ 生效（abyss.js 之后）', pos);
  await boot('town&fresh&mute&cls=sword');
  const r = await ev(() => {
    const o = {}, eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    o.applied = G60.applied; o.problems = G60.problems.slice();
    // 样本物品（只在这个页面里）
    defineEpic('ep_kt_zz', { slot: 'weapon', wtype: 'katana', lvl: 20, name: '测试太刀', fx: { dmgUp: 0.08, crit: 0.03 }, proc: { chance: 0.05, act: 'strike', mul: 1.5, name: '测试' }, desc: 'x' });
    defineDropTable('zz_low', { boss: [['ep_kt_zz', 0.01]] }); DUNGEONS.zz_low = { id: 'zz_low', name: '测试低级', lvl: [18, 20] };
    defineDropTable('zz_mid', { boss: [['ep_kt_zz', 0.01]] }); DUNGEONS.zz_mid = { id: 'zz_mid', name: '测试中级', lvl: [36, 38] };
    defineDropTable('zz_high', { boss: [['ep_kt_zz', 0.01]] }); DUNGEONS.zz_high = { id: 'zz_high', name: '测试高级', lvl: [52, 54] };
    const st0 = { ...ITEMS.ep_kt_zz.st }, atk0 = ITEMS.ep_kt_zz.st.atk;
    const S = inheritEpic('ep_kt_zz', 'ep_kt_zz_succ', { name: '测试继承太刀', desc: '（本作原创，继承自测试太刀）' });
    const M = moveEpic('ep_kt_zz', { lvl: 55, tier: 1, fx: { dmgUp: 0.12 } });
    o.inherit = { lvl: S.lvl, st: eq(S.st, st0), fx: eq(S.fx, { dmgUp: 0.08, crit: 0.03 }), proc: eq(S.proc, { chance: 0.05, act: 'strike', mul: 1.5, name: '测试' }), cls: S.cls, name: S.name, icon: S.icon };
    o.move = { lvl: M.lvl, tier: M.tier, atkUp: M.st.atk > atk0 * 2, fx: eq(M.fx, { dmgUp: 0.12 }), moved: G60.moved.ep_kt_zz, succ: G60.succ.ep_kt_zz, pred: G60.pred.ep_kt_zz_succ };
    o.once = { epics: EPICS.filter(E => E.key === 'ep_kt_zz').length, gear: GEAR.filter(D => D.key === 'ep_kt_zz').length, elvl: (EPICS.find(E => E.key === 'ep_kt_zz') || {}).lvl };
    g60SwapDrops();
    const has = (id, k) => DROP_TABLES[id].boss.some(e => e[0] === k);
    o.swap = { low: has('zz_low', 'ep_kt_zz_succ') && !has('zz_low', 'ep_kt_zz'), mid: !has('zz_mid', 'ep_kt_zz') && !has('zz_mid', 'ep_kt_zz_succ'), high: has('zz_high', 'ep_kt_zz') && !has('zz_high', 'ep_kt_zz_succ') };
    // 继承套装 / 整套搬家
    defineSet('set_zz', { name: '测试套', epic: true, bonus: { 2: { st: { dmgUp: 0.05 }, desc: 'x' } } });
    for (const s of ['top', 'bottom']) { defineGear('set_zz_' + s, { rar: 5, slot: s, atype: 'cloth', lvl: 28, name: '测试' + s, fx: {}, set: 'set_zz' }); SETS.set_zz.pieces.push('set_zz_' + s); }
    const top0 = { ...ITEMS.set_zz_top.st };
    inheritSet('set_zz', 'set_zz2', { name: '测试继承套', pieces: { top: '继承上衣', bottom: { key: 'set_zz2_pants', name: '继承下装' } } });
    moveSet('set_zz', { lvl: 60, tier: 3, name: '测试套（Lv60）' });
    o.set = { pieces: SETS.set_zz2.pieces.join(), bonus: eq(SETS.set_zz2.bonus, SETS.set_zz.bonus), pset: ITEMS.set_zz2_top.set + ITEMS.set_zz2_pants.set, lvl: [ITEMS.set_zz2_top.lvl, ITEMS.set_zz_top.lvl], st: eq(ITEMS.set_zz2_top.st, top0), moved: !!G60.moved.set_zz_bottom, succ: G60.succ.set_zz_bottom, setSucc: G60.setSucc.set_zz, name: SETS.set_zz.name };
    // 领主神器 + 指定怪物掉落
    defineNamed('nm_zz_ring', { slot: 'ring', lvl: 34, name: '测试神器', fx: { crit: 0.02 }, desc: 'x' });
    monDrop('kain', [['nm_zz_ring', 1]], { dungeons: ['wailing_cave'] });
    drops.length = 0; const rnd0 = Math.random; Math.random = () => 0.001;
    const t = { kind: 'kain', lvl: 50, x: 100, y: 50, z: 0, elite: true };
    rollDrop(t, { def: DUNGEONS.wailing_cave, D: DIFFS[0] }); const inCave = drops.some(d => d.item && d.item.key === 'nm_zz_ring');
    drops.length = 0; rollDrop(t, { def: DUNGEONS.lorien || Object.values(DUNGEONS)[0], D: DIFFS[0] }); const elsewhere = drops.some(d => d.item && d.item.key === 'nm_zz_ring');
    Math.random = rnd0; drops.length = 0;
    o.named = { rar: ITEMS.nm_zz_ring.rar, noDrop: !!ITEMS.nm_zz_ring.noDrop, inGear: GEAR.includes(ITEMS.nm_zz_ring), inCave, elsewhere, page: codexKeys('named').includes('nm_zz_ring'), stats: codexStats().namedTotal >= 1, src: itemSourceText('nm_zz_ring') };
    // 深渊归属 + 保底池
    abyssClaim('timegate', ['ep_kt_zz']);
    const A = ABYSS.abyss_timegate;
    o.claim = { region: ITEMS.ep_kt_zz.abyssRegion, from: ITEMS.ep_kt_zz.abyssFrom, pool: abyssPool(A).includes('ep_kt_zz'), src: itemSourceText('ep_kt_zz') };
    gearDrop('iris_raid', [['ep_kt_zz', 0.003]]); o.claim.src2 = itemSourceText('ep_kt_zz');
    dropRemove('iris_raid', 'ep_kt_zz'); o.claim.removed = !DROP_TABLES.iris_raid.boss.some(e => e[0] === 'ep_kt_zz');
    // 兑换价
    o.cost = { l20: abyssEpicCost('ep_kt_zz_succ'), l55: abyssEpicCost('ep_kt_zz'), set60: abyssEpicCost('set_zz_top'), si: abyssEpicCost('ep_si_nex') };
    moveEpic('ep_kt_zz', { lvl: 60, tier: 3 }); o.cost.t3 = abyssEpicCost('ep_kt_zz');
    o.bonus = CODEX_BONUS.some(B => B.need.epic === 280) && CODEX_BONUS.some(B => B.need.named === 30);
    o.pages = CODEX_PAGES.map(P => P.id).join();
    return o;
  });
  check(r.applied, 'gear60_apply.js 已生效（G60.applied）');
  check(!r.problems.length, `现有内容没有登记问题（G60.problems ${r.problems.length} 条）`, r.problems.slice(0, 5));
  check(r.inherit.lvl === 20 && r.inherit.st && r.inherit.fx && r.inherit.proc && r.inherit.cls === 'sword' && r.inherit.icon === 'item_ep_kt_zz_succ', 'inheritEpic：继承装备等级 / 基础属性（同一个种子）/ fx / proc 和搬家前完全一样', r.inherit);
  check(r.move.lvl === 55 && r.move.tier === 1 && r.move.atkUp && r.move.fx && r.move.moved.from === 20 && r.move.moved.to === 55 && r.move.succ === 'ep_kt_zz_succ' && r.move.pred === 'ep_kt_zz', 'moveEpic：按 Lv55 重算基础属性、fx 替换、登记搬家 / 继承关系', r.move);
  check(r.once.epics === 1 && r.once.gear === 1 && r.once.elvl === 55, '重新定义不留重复（EPICS / GEAR 各一条，等级是新的）', r.once);
  check(r.swap.low && r.swap.mid && r.swap.high, '掉落表：低级地下城换成继承装备、中间的去掉、新等级附近的保留', r.swap);
  check(r.set.pieces === 'set_zz2_top,set_zz2_pants' && r.set.bonus && r.set.pset === 'set_zz2set_zz2' && r.set.lvl.join() === '28,60' && r.set.st && r.set.moved && r.set.succ === 'set_zz2_pants' && r.set.setSucc === 'set_zz2' && r.set.name === '测试套（Lv60）', 'inheritSet / moveSet：继承套装件数效果一样、部件属于新套装；原套装整套搬到 Lv60', r.set);
  check(r.named.rar === 3 && r.named.noDrop && !r.named.inGear && r.named.inCave && !r.named.elsewhere && r.named.page && r.named.stats && /悲鸣洞穴 · 骷髅凯恩/.test(r.named.src), 'defineNamed + monDrop：粉色、不进随机池、只在悲鸣洞穴的骷髅凯恩身上掉、图鉴「领主神器」页、获取途径', r.named);
  check(r.claim.region === 'timegate' && r.claim.from === '时空之门深渊' && r.claim.pool && /时空之门深渊/.test(r.claim.src) && /谜之觉悟.*的领主；深渊派对/.test(r.claim.src2) && r.claim.removed, 'abyssClaim / gearDrop / dropRemove：深渊专属进保底池；获取途径同时写攻坚领主和深渊', r.claim);
  check(r.cost.l20 === 28 && r.cost.l55 === 55 && r.cost.set60 === 90 && r.cost.t3 === 90 && r.cost.si === 70, '宇宙灵魂兑换价：Lv20 28 / Lv55 55 / Lv60 T1 70 / T3 与 Lv60 套装部件 90', r.cost);
  check(r.bonus && /named/.test(r.pages), '图鉴：新增「领主神器」页，收集加成加到史诗 280 / 神器 30 档', r.pages);
}

/* ================= migrate ================= */
if (run('migrate')) {
  step('migrate：老存档迁移');
  // 1. 用 maxout 造存档：Lv30 剑魂（+12 史诗全身）+ Lv60 狂战士
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'g60-'));
  fs.writeFileSync(dir + '/cloud.json', JSON.stringify({ data: { v: 5, cur: -1, chars: [], acct: {} } }));
  execFileSync('node', [ROOT + 'tools/admin/maxout.mjs', dir, '', '0', 'sword:blade:30:max:老剑士,sword:berserker:60:max:满级狂战'], { stdio: 'pipe', timeout: 600000 });
  const maxed = JSON.parse(fs.readFileSync(dir + '/maxed.json', 'utf8'));
  check(maxed.chars.length === 2 && maxed.chars[0].lvl === 30 && maxed.chars[1].lvl === 60 && Object.values(maxed.chars[0].equip).filter(it => it && it.enh === 12).length >= 8, 'maxout 造出 Lv30（+12 全身）和 Lv60 两个角色', maxed.chars.map(c => c.lvl));
  await boot('town&mute&cls=sword');
  // 2. 往老存档里放阿波菲斯（装备栏 +12 红字 / 锻造 / 附魔、背包 +7、仓库 +10、Lv60 角色装备着 +12）+ 账号金库一把 +5
  const SAMPLE = `
    window.g60Sample = sidIn => {
      if (G60.succ.ep_gs_apophis) return false;   // 已经有真实的搬家（B1 之后），不用样本
      inheritEpic('ep_gs_apophis', 'ep_gs_zz_apo', { name: '测试·阿波菲斯的继承' });
      moveEpic('ep_gs_apophis', { lvl: 55 });
      const eq = JSON.parse(localStorage.getItem(save.key)).chars[0].equip;
      const sid = sidIn !== undefined ? sidIn : Object.values(eq).map(it => it && ITEMS[it.key] && ITEMS[it.key].set).find(s => s && SETS[s] && SETS[s].epic && ITEMS[SETS[s].pieces[0]].lvl >= 20 && ITEMS[SETS[s].pieces[0]].lvl <= 30) || '';
      if (sid && !G60.setSucc[sid]) { const P = {}; for (const k of SETS[sid].pieces) P[ITEMS[k].slot] = '测试继承·' + ITEMS[k].slot; inheritSet(sid, sid + '_zz', { name: '测试继承套', pieces: P }); moveSet(sid, { lvl: 60, tier: 3 }); }
      return sid;
    };`;
  await page.addScriptTag({ content: SAMPLE });
  const prep = await ev(root => {
    const mk = (enh, extra) => { const it = makeItem('ep_gs_apophis'); it.enh = enh; it.lvl = 27; Object.assign(it, extra || {}); return JSON.parse(JSON.stringify(it)); };
    const card = Object.keys(ITEMS).find(k => ITEMS[k].orb && canEnchant(k, { kind: 'equip', slot: 'weapon' }));
    const c0 = root.chars[0], c1 = root.chars[1];
    if (c0.equip.weapon) c0.inv.push(c0.equip.weapon);
    c0.equip.weapon = mk(12, { dim: 'str', forge: 5, orb: { key: card, st: { ...ITEMS[card].orb.st }, name: ITEMS[card].name } });
    c0.inv.push(mk(7)); c0.storage = [...(c0.storage || []), mk(10)];
    if (c1.equip.weapon) c1.inv.push(c1.equip.weapon); c1.equip.weapon = mk(12);
    root.v = 5; for (const c of root.chars) { c.v = 5; delete c.g60m; }
    localStorage.setItem(save.key, JSON.stringify(root));
    localStorage.setItem(bank.key(), JSON.stringify({ v: 1, items: [mk(5)], gold: 100 }));
    return { card, key: save.key, bank: bank.key() };
  }, maxed);
  const oldRoot = await ev(() => JSON.parse(localStorage.getItem(save.key)));
  // 迁移前后的强度（去掉图鉴加成：补发的继承装备会登记进图鉴，那是额外的奖励）
  const SNAP = `
    window.g60Snap = i => {
      save.loadAll(); save.select(i); game.player = makePlayer(save.data.cls); save.apply(); inv._norm = null; inv.ensure(); codexBonusCache = null;
      const cb = window.codexBonusStats; window.codexBonusStats = () => ({}); recalcStats(game.player);
      const m = gearMetrics(game.player, mainDmgType(game.player)); window.codexBonusStats = cb; recalcStats(game.player);
      const all = [...inv.items, ...Object.values(inv.equip), ...inv.storage].filter(it => it && it.kind === 'equip');
      const W = inv.equip.weapon;
      return { off: m.off, ehp: m.ehp, lvl: game.lvl, n: all.length, ids: all.map(it => it.id), keys: all.map(it => it.key).sort(),
        w: W && { key: W.key, enh: W.enh, dim: W.dim, forge: W.forge, orb: W.orb && W.orb.key },
        apo: all.filter(it => it.key === 'ep_gs_apophis').map(it => ({ enh: it.enh, dim: it.dim || null, forge: it.forge || 0, orb: it.orb ? 1 : 0, where: inv.equip.weapon === it ? 'equip' : inv.storage.includes(it) ? 'storage' : 'inv' })),
        sets: (game.player.sets || []).map(s => s.id.replace(/_zz$/, '') + ':' + s.on.join('/')).sort().join(' '), g60m: Object.keys(save.data.g60m || {}).length, note: (save.data.g60note || []).length,
        items: all.map(it => [it.id, it.key]),
        succ: all.filter(it => G60.pred[it.key]).map(it => ({ id: it.id, key: it.key, enh: it.enh, dim: it.dim || null, forge: it.forge || 0, orb: it.orb ? it.orb.key : null, lvl: it.lvl })) };
    };`;
  await page.addScriptTag({ content: SNAP });
  const real = await ev(() => !!G60.succ.ep_gs_apophis);
  const before0 = real ? null : await ev(() => g60Snap(0));
  const sid = await ev(() => g60Sample());
  console.log(real ? '  （用真实的搬家表）' : `  （样本搬家：阿波菲斯 → Lv55；身上的套装 ${sid || '无'} → Lv60 + 继承套装）`);
  const a0 = await ev(() => g60Snap(0)), a1 = await ev(() => g60Snap(1));
  const S = a0.w, succKey = await ev(() => G60.succ.ep_gs_apophis);
  check(S && S.key === succKey && S.enh === 12 && S.dim === 'str' && S.forge === 5 && S.orb === prep.card, 'Lv30：装备栏换成继承装备，+12 / 红字 / 锻造 +5 / 附魔全部转移过来', S);
  const c0o = oldRoot.chars[0], oldApo = [...c0o.inv.map(it => ['inv', it]), ...Object.values(c0o.equip).map(it => ['inv', it]), ...(c0o.storage || []).map(it => ['storage', it])].filter(([, it]) => it && it.key === 'ep_gs_apophis');   // maxout 自己也可能给 Lv30 剑魂配了阿波菲斯
  const apo = a0.apo.map(x => `${x.where}+${x.enh}${x.dim || ''}${x.forge ? 'F' : ''}${x.orb ? 'O' : ''}`).sort().join(' '), apoWant = oldApo.map(([w]) => w + '+0').sort().join(' ');
  check(apo === apoWant, `Lv30：${oldApo.length} 把阿波菲斯都还在（装备着的进背包），强化 / 红字 / 锻造 / 附魔都转移走了（+0）`, { apo, apoWant });
  const preIds = new Set(JSON.stringify(oldRoot.chars[0]).match(/"id":\d+/g).map(x => +x.slice(5)));   // 只数迁移新发的（maxout 可能本来就给了继承装备那把 Lv27 巨剑）
  const sEnh = a0.succ.filter(x => x.key === succKey && !preIds.has(x.id)).map(x => x.enh).sort((a, b) => a - b).join(), sWant = oldApo.map(([, it]) => it.enh || 0).sort((a, b) => a - b).join();
  check(sEnh === sWant, `每把阿波菲斯补发一把继承装备，强化各自转移（${sEnh}）`, { sEnh, sWant });
  const idsOf = c => [...c.inv, ...Object.values(c.equip), ...(c.storage || [])].filter(it => it && it.kind === 'equip').map(it => it.id);
  const oldIds = idsOf(oldRoot.chars[0]);
  const lost = oldIds.filter(id => !a0.ids.includes(id)), dupIds = a0.ids.length - new Set(a0.ids).size;
  const added = a0.items.filter(([id]) => !oldIds.includes(id)), predOk = await ev(ks => ks.every(k => !!G60.pred[k]), added.map(x => x[1])), comp = added.length;
  check(!lost.length && !dupIds && predOk && comp >= 3, `不丢不复制：原来 ${oldIds.length} 件全在、没有重复 id、多出的 ${comp} 件全是补发的继承装备`, { lost, dupIds, n: a0.n, old: oldIds.length, added });
  if (before0) check(Math.abs(a0.off / before0.off - 1) < 1e-9 && Math.abs(a0.ehp / before0.ehp - 1) < 1e-9 && a0.sets === before0.sets, `Lv30 强度一点不变（输出 ${before0.off.toFixed(1)} → ${a0.off.toFixed(1)}，套装 ${a0.sets}）`, { before: before0.sets, after: a0.sets });
  else check(a0.succ.every(x => x.lvl <= 30), '继承装备都在 Lv30 以内（真实搬家表：数值一致性见 content 模式）', a0.succ);
  check(a0.note === comp && a0.g60m > 0, `迁移提示 ${a0.note} 条，g60m 记下已处理的搬家`, { note: a0.note, g60m: a0.g60m });
  check(a1.w && a1.w.key === 'ep_gs_apophis' && a1.w.enh === 12 && a1.n === idsOf(oldRoot.chars[1]).length, 'Lv60 角色：阿波菲斯 +12 照穿，不补发', { w: a1.w, n: a1.n });
  // 3. 同一份原始存档再读一次（还没写回）→ 结果一样；写回后刷新 → 不再补发
  const again = await ev(() => g60Snap(0));
  check(again.n === a0.n && again.keys.join() === a0.keys.join(), '没写回之前重新读档：结果一样（按原始数据算，不会叠加）');
  await ev(() => { g60Snap(0); save.write(); });
  const persisted = await ev(() => JSON.parse(localStorage.getItem(save.key)));
  await boot('town&mute&cls=sword');
  const shown = await ev(() => !save.data.g60note);   // 进城时 afterEnterWorld 已经提示过并删掉
  await page.addScriptTag({ content: SAMPLE }); await page.addScriptTag({ content: SNAP });
  await ev(s => g60Sample(s), sid);
  const r0 = await ev(() => g60Snap(0));
  check(r0.n === a0.n && r0.keys.join() === a0.keys.join() && r0.w.key === succKey && r0.w.enh === 12, '写回后刷新页面：件数 / 物品完全一样，没有再补发', { n: [a0.n, r0.n] });
  check(shown, '进城时提示一次后删掉（g60note）');
  check(persisted.chars[0].g60m && persisted.chars[0].g60m.ep_gs_apophis === 1, '存档里记下了 g60m（按搬家的 key）');
  // 4. 账号金库：账号里有 Lv60 角色 → 不补发；只有 Lv30 角色 → 补发并立刻写回，刷新不重复
  const bk = await ev(k => { bank.loadedKey = null; bank.load(); const L = bank.items.map(it => it.key + '+' + it.enh); return L; }, prep.bank);
  check(bk.join() === 'ep_gs_apophis+5', '账号金库（账号里有 Lv60 角色）：阿波菲斯 +5 不动', bk);
  const bk2 = await ev(() => {
    const root = JSON.parse(localStorage.getItem(save.key)); root.chars = root.chars.slice(0, 1); localStorage.setItem(save.key, JSON.stringify(root));
    localStorage.setItem(bank.key(), JSON.stringify({ v: 1, items: [JSON.parse(JSON.stringify(Object.assign(makeItem('ep_gs_apophis'), { enh: 5 })))], gold: 100 }));
    save.loadAll(); save.select(0); bank.loadedKey = null; bank.load();
    const first = bank.items.map(it => it.key + '+' + it.enh).sort().join();
    bank.loadedKey = null; bank.load();
    return { first, second: bank.items.map(it => it.key + '+' + it.enh).sort().join(), stored: JSON.parse(localStorage.getItem(bank.key())).g60m };
  });
  const bankWant = ['ep_gs_apophis+0', `${succKey}+5`].sort().join();
  check(bk2.first === bankWant && bk2.second === bk2.first && bk2.stored && bk2.stored.ep_gs_apophis, '账号金库（只有 Lv30 角色）：补发继承装备 +5，写回后再读不重复', bk2);
  // 5. 一键满级券：Lv30 → 60 后能穿回阿波菲斯
  const mx = await ev(() => {
    g60Snap(0); const apo = inv.items.find(it => it.key === 'ep_gs_apophis');
    const before = inv.wear(apo);
    inv.add(makeItem('tk_maxlv', 1)); const used = inv.useItem(inv.items.find(i => i.key === 'tk_maxlv'));
    const after = inv.wear(inv.items.find(it => it.key === 'ep_gs_apophis'));
    return { before, used, lvl: game.lvl, after, w: inv.equip.weapon && inv.equip.weapon.key, lvW: ITEMS.ep_gs_apophis.lvl };
  });
  check(!mx.before && mx.used && mx.lvl === 60 && mx.after && mx.w === 'ep_gs_apophis', `一键满级券：Lv30 穿不上 Lv${mx.lvW} 的阿波菲斯 → 升到 60 后能穿`, mx);
  // 6. 云存档：真服务端往返（原始老存档上传 → 客户端读取迁移 → 再上传 → 再读取不重复）
  let start = null; try { ({ start } = await import('../server/index.js')); } catch (e) { check(false, '云存档：起不了服务端（server/node_modules 缺失？cd server && npm i，或软链主仓库的）', e.message); }
  if (start) {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'g60-srv-'));
    const app = await start({ port: 0, db: path.join(tmp, 't.db'), invites: ['TESTCODE'], admins: [] });
    const B = `http://127.0.0.1:${app.port}`;
    const api = async (m, p, body, tok) => { const r = await fetch(B + p, { method: m, headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}) }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, data: await r.json().catch(() => ({})) }; };
    const reg = await api('POST', '/api/register', { user: 'g60test', pass: 'secret1', invite: 'TESTCODE' }), tok = reg.data.token;
    const up = { ...oldRoot, bank: { v: 1, items: [await ev(() => JSON.parse(JSON.stringify(Object.assign(makeItem('ep_gs_apophis'), { enh: 5 }))))], gold: 100 } };
    up.chars = up.chars.slice(0, 1);
    const p1 = await api('PUT', '/api/saves', { data: up, baseUpdatedAt: 0 }, tok);
    const g1 = await api('GET', '/api/saves', null, tok);
    const c1 = await ev(({ data, at }) => {
      cloudSave.use(987654); save.key = cloudSave.key(987654); cloudSave.adopt(data, at);   // 测试页的存档 key 是 dawnbreak_dev，手动切到账号缓存
      const s = g60Snap(0); bank.loadedKey = null; bank.load(); save.write();
      return { s, bank: bank.items.map(it => it.key + '+' + it.enh).sort().join(), payload: cloudSave.payload() };
    }, { data: g1.data.data, at: g1.data.updatedAt });
    const p2 = await api('PUT', '/api/saves', { data: c1.payload, baseUpdatedAt: g1.data.updatedAt }, tok);
    const g2 = await api('GET', '/api/saves', null, tok);
    const c2 = await ev(({ data, at }) => { cloudSave.adopt(data, at); const s = g60Snap(0); bank.loadedKey = null; bank.load(); return { s, bank: bank.items.map(it => it.key + '+' + it.enh).sort().join() }; }, { data: g2.data.data, at: g2.data.updatedAt });
    await ev(() => { cloudSave.leave(); });
    check(p1.status === 200 && p2.status === 200 && g2.data.data.chars[0].g60m && g2.data.data.bank && g2.data.data.bank.g60m, '云存档：服务端收下老存档和迁移后的存档（新字段 g60m / 金库 g60m 原样往返）', { p1: p1.status, p2: p2.status });
    check(c1.s.w && c1.s.w.key === succKey && c1.s.w.enh === 12 && c1.bank === bankWant, '云存档：从云端读到老存档 → 迁移（身上 + 金库）', { w: c1.s.w, bank: c1.bank });
    check(c2.s.n === c1.s.n && c2.s.keys.join() === c1.s.keys.join() && c2.bank === c1.bank, '云存档：迁移后的上传再下载 → 不重复补发、物品一样', { n: [c1.s.n, c2.s.n], bank: [c1.bank, c2.bank] });
    try { app.stop && app.stop(); } catch (e) { /* 进程马上退出 */ }
  }
}

/* ================= content ================= */
if (run('content')) {
  step('content：数量下限 / 搬家表 / 继承一致 / 图标');
  await boot('town&fresh&mute&cls=sword');
  // 蓝图 §1 的搬家表（key → 新等级）；B1~B3 可以按实际调整，改了要同步 GEAR_PLAN_60.md
  const MOVES = {
    ep_shortsword: 50, ep_ss_gsd: 50, ep_ss_kanya: 55, ep_ss_fate: 60, ep_ss_shura: 60, ep_katana: 50, ep_kt_slaughter: 55, ep_katana2: 55, ep_kt_andra: 60, ep_kt_ninedragon: 60,
    ep_cb_ghost: 50, ep_cb_devour: 50, ep_club: 55, ep_cb_soulmate: 55, ep_cb_kirin: 60, ep_cb_heart: 60, ep_greatsword: 50, ep_gs_conqueror: 50, ep_gs_evildragon: 55, ep_gs_apophis: 55, ep_gs_guardian: 60,
    ep_ls_sun: 50, ep_ls_breaker: 50, ep_ls_millennium: 55, ep_ls_elegy: 60, ep_rv_enazma: 55, ep_rv_sunset: 55, ep_rv_bone: 60, ep_rv_python: 60, ep_ap_flash: 55, ep_ap_viper: 55, ep_ap_heckler: 60,
    ep_rf_death: 55, ep_rf_howl: 55, ep_rf_zombie: 60, ep_hc_meteor: 55, ep_hc_breaker: 55, ep_hc_aqua: 60, ep_hc_wing: 60, ep_bg_headless: 50, ep_bg_red: 55, ep_bg_satan: 60,
    ep_sp_evil: 55, ep_sp_lava: 60, ep_pl_breaker: 55, ep_pl_phantom: 60, ep_rd_thunder: 55, ep_rd_cheshire: 55, ep_rd_meow: 60, ep_st_willy: 55, ep_st_sage: 60, ep_st_witchgold: 60, ep_st_moon: 60, ep_br_scribble: 55, ep_br_lucky: 60,
    ep_head: 50, ep_head2: 50, ep_shoes2: 50, ep_shoes_pisco: 50,
    ...Object.fromEntries(['tremor', 'reaper', 'arad', 'evilgod', 'kingtear'].flatMap(s => ['top', 'head', 'bottom', 'belt', 'shoes'].map(p => [`set_${s}_${p}`, 60]))),
    ...Object.fromEntries(['wargod', 'timelord'].flatMap(s => ['neck', 'bracelet', 'ring'].map(p => [`set_${s}_${p}`, 60]))),
    ep_sup_michel: 60, ep_sup_paris: 60, ep_stone_platani: 60, ep_stone_grelin: 60, ep_stone_herik: 60, ep_stone_aqui: 60, ep_stone_merkel: 60,
  };
  const c = await ev(({ MOVES, ONLY }) => {
    const grp = D => D.slot === 'weapon' ? 'weapon' : ARMOR_SLOTS.includes(D.slot) ? 'armor' : 'acc';
    const want = D => !ONLY || grp(D) === ONLY;
    const B = [[1, 10], [11, 20], [21, 30], [31, 40], [41, 50], [51, 60]], bi = l => B.findIndex(([a, b]) => l >= a && l <= b);
    const E = Object.values(ITEMS).filter(D => D.kind === 'equip' && D.rar === 5 && !isAvatar(D));
    const MIN = { weapon: [1, 1, 2, 2, 2, 4], armor: [1, 3, 5, 5, 6, 8], acc: [1, 2, 3, 3, 3, 5], special: [0, 2, 2, 2, 3, 10] };
    const short = [];
    // 武器类型：只查已开放职业的（clsOpen）
    for (const t of Object.keys(WTYPES).filter(t => clsOpen(WTYPES[t].cls))) { const n = B.map(() => 0); for (const D of E) if (D.wtype === t) n[bi(D.lvl)]++; n.forEach((v, i) => { if (v < MIN.weapon[i] && (!ONLY || ONLY === 'weapon')) short.push(`${WTYPES[t].name} Lv${B[i].join('~')}：${v}/${MIN.weapon[i]}`); }); }
    for (const s of ARMOR_SLOTS) { const n = B.map(() => 0); for (const D of E) if (D.slot === s) n[bi(D.lvl)]++; n.forEach((v, i) => { if (v < MIN.armor[i] && (!ONLY || ONLY === 'armor')) short.push(`${SLOT_NAME[s]} Lv${B[i].join('~')}：${v}/${MIN.armor[i]}`); });
      for (const a of Object.keys(ATYPES)) for (let i = 3; i < 6; i++) if (!E.some(D => D.slot === s && D.atype === a && bi(D.lvl) === i) && (!ONLY || ONLY === 'armor')) short.push(`${ATYPES[a].name}${SLOT_NAME[s]} Lv${B[i].join('~')}：0`); }
    for (const s of [...ACC_SLOTS, ...SPECIAL_SLOTS]) { const M = ACC_SLOTS.includes(s) ? MIN.acc : MIN.special, n = B.map(() => 0); for (const D of E) if (D.slot === s) n[bi(D.lvl)]++; n.forEach((v, i) => { if (v < M[i] && (!ONLY || ONLY === 'acc')) short.push(`${SLOT_NAME[s]} Lv${B[i].join('~')}：${v}/${M[i]}`); }); }
    const named = Object.values(ITEMS).filter(D => D.rar === 3 && D.named).filter(want);
    const moveBad = [], inhBad = [];
    for (const [k, l] of Object.entries(MOVES)) { const D = ITEMS[k]; if (!D || !want(D)) continue; if (D.lvl !== l) moveBad.push(`${k}@${D.lvl}≠${l}`); if (!G60.succ[k]) moveBad.push(`${k} 没有继承装备`); }
    const norm = a => (a && typeof a === 'object' && !Object.keys(a).length) ? null : a || null;   // 空对象 {} 和“没有这个字段”算同一个（新定义的物品不存空 fx）
    const eq = (a, b) => JSON.stringify(norm(a)) === JSON.stringify(norm(b));
    for (const [K, S] of Object.entries(G60.succ)) { const O = G60.orig[K], D = ITEMS[S]; if (!O || !D || !want(D)) continue; if (D.lvl !== O.lvl || !eq(D.fx, O.fx) || !eq(D.proc, O.proc) || D.slot !== O.slot) inhBad.push(`${S}（${K}）`); }
    const noIcon = E.concat(named).filter(want).filter(D => !ASSET_SRC['icon/' + (D.icon || 'item_' + D.key)]).map(D => D.key);
    const artKey = D => D.pal && !WEAPON_IMG[D.key] ? `${D.wtype}_r4` : D.key;   // 配色变体（格斗家，物品上写 pal）：拿在手里 = <类型>_r4 + 换色，不另画图
    const noArt = E.filter(D => D.slot === 'weapon' && want(D) && (!WEAPON_IMG[artKey(D)] || !ASSET_SRC['weapon/' + artKey(D)])).map(D => D.key);
    // 职业之间持平（武器）：每个开放职业的领主神器 ≥ 6 件、深渊专属武器 21~30 ≥ 3 / 暗黑城深渊（Lv38）≥ 5 / 时空之门深渊（T3）≥ 5、官方 T1 / T2 / T3 各 ≥ 5
    const parity = [];
    if (!ONLY || ONLY === 'weapon') for (const cls of openClasses()) { const W = Object.values(ITEMS).filter(D => D.kind === 'equip' && D.slot === 'weapon' && D.cls === cls), nm = s => W.filter(D => D.rar === 5 && D.abyssRegion === s).length;
      const got = { named: W.filter(D => D.named && D.rar === 3).length, low: W.filter(D => D.rar === 5 && D.abyss && D.lvl >= 21 && D.lvl <= 30).length, darkelf: nm('darkelf'), timegate: nm('timegate'),
        t1: W.filter(D => D.rar === 5 && D.tier === 1).length, t2: W.filter(D => D.rar === 5 && D.tier === 2).length, t3: W.filter(D => D.rar === 5 && D.tier === 3).length };
      const need = { named: 6, low: 3, darkelf: 5, timegate: 5, t1: 5, t2: 5, t3: 5 };
      for (const k in need) if (got[k] < need[k]) parity.push(`${cls} ${k} ${got[k]}/${need[k]}`); }
    const count = { weapon: E.filter(D => D.slot === 'weapon').length, armor: E.filter(D => ARMOR_SLOTS.includes(D.slot)).length, acc: E.filter(D => !ARMOR_SLOTS.includes(D.slot) && D.slot !== 'weapon').length, named: named.length };
    return { short, moveBad, inhBad, noIcon, noArt, count, parity, problems: G60.problems.slice() };
  }, { MOVES, ONLY });
  console.log('  史诗件数', JSON.stringify(c.count));
  check(!c.short.length, `每部位 × 等级段的数量下限（缺 ${c.short.length} 处）`, c.short.slice(0, 20).join('；'));
  check(!c.moveBad.length, `蓝图搬家表：等级和继承装备（不符 ${c.moveBad.length}）`, c.moveBad.slice(0, 20).join(' '));
  check(!c.inhBad.length, '继承装备和搬家前的数值 / 特效 / 部位完全一样', c.inhBad.slice(0, 10).join(' '));
  if (!ONLY || ONLY === 'armor' || ONLY === 'acc' || ONLY === 'weapon') check(c.count.named >= (ONLY ? 5 : 40), `领主神器 ${c.count.named} 件`);
  check(!c.noIcon.length, `每件都有图标（缺 ${c.noIcon.length}）`, c.noIcon.slice(0, 20).join(' '));
  check(!c.noArt.length, `史诗武器都有武器图（缺 ${c.noArt.length}；配色变体按 <类型>_r4 查）`, c.noArt.slice(0, 20).join(' '));
  check(!c.parity.length, '职业之间持平（武器）：每个开放职业都有领主神器 ≥ 6、21~30 / 暗黑城 / 时空之门深渊专属、T1 / T2 / T3 各 ≥ 5', c.parity.join('；'));
  check(!c.problems.length, `G60.problems 为空（${c.problems.length}）`, c.problems.slice(0, 8));
}

/* ================= jobs ================= */
if (run('jobs')) {
  step('jobs：每个转职都有能用的武器 / 史诗，魔法转职的武器有魔法属性');
  await boot('town&fresh&mute&cls=sword');
  const J = await ev(() => {
    const out = { rows: [], lack: [], weak: [], stat: [], cmp: [], order: [], magItem: [] };
    const W = Object.values(ITEMS).filter(D => D.kind === 'equip' && D.slot === 'weapon');
    const dropKeys = new Set(); for (const id in DROP_TABLES) for (const e of DROP_TABLES[id].boss) dropKeys.add(e[0]);
    const epicOk = D => D.rar === 5 && (dropKeys.has(D.key) || D.abyssRegion || (!D.noDrop && !D.abyss));   // 能刷到：领主表 / 深渊专属 / 随机池
    const shopWeapons = L => new Set(Object.values(SHOPS).flatMap(S => S.tabs.flatMap(T => typeof T.goods === 'function' ? T.goods(L) : T.goods)).filter(k => ITEMS[k] && ITEMS[k].slot === 'weapon'));
    const GEARS = SLOTS.filter(s => !s.startsWith('av_') && s !== 'title');
    const rareIt = D => { const it = makeItem(D.key, 1, { grade: 2 }), R = mulberry(keySeed((D._def && D._def.seed) || D.key));
      const k = ['str', 'int', 'vit', 'spr', 'hp', 'mp', 'crit', 'hit', 'evade'][Math.floor(R() * 9)], L = D.lvl, m = RAR_MUL[D.rar], st = { ...D.st };
      if (k === 'crit') { st.crit = +(st.crit - 0.01 * D.rar).toFixed(3); st.mcrit = +(st.mcrit - 0.01 * D.rar).toFixed(3); }
      else if (k === 'hit' || k === 'evade') st[k] = +(st[k] - (0.01 + 0.005 * D.rar)).toFixed(3);
      else st[k] -= Math.round(k === 'hp' ? L * 8 * m : k === 'mp' ? L * 5 * m : (2 + L * 0.5) * m);
      const g = gradeMul(it.grade); it.st = {}; for (const x in st) if (st[x]) it.st[x] = FLAT_STATS.includes(x) ? Math.round(st[x] * g) : st[x];
      return it; };
    const ratioRows = {};
    for (const cls of openClasses()) for (const job of openJobs(cls)) {
      const C = CLASSES[cls], Jd = C.jobs[job], TYPE = Jd.dmgType || C.dmgType || (cls === 'mage' ? 'mag' : 'phys'), row = `${cls}:${job}`;
      game.player = makePlayer(cls); game.job = job; const p = game.player;
      game.skillLv = {}; for (const id of Jd.auto || []) game.skillLv[id] = 1;
      const wear = D => D.cls === cls && wtypeJobOk(D.wtype, job);
      // 1. 每 5 级：能买到 / 掉到的武器（普通~传说，等级在 (L-5, L]）；每 5 级（Lv10 起）：10 级内能刷到的史诗
      for (let L = 5; L <= 60; L += 5) {
        const shop = shopWeapons(L), mine = W.filter(D => wear(D) && D.rar < 5 && !D.named && D.lvl <= L && D.lvl > L - 5);
        if (!mine.some(D => shop.has(D.key))) out.lack.push(`${row} Lv${L} 商店没有能装的武器`);
        if (!mine.some(D => GEAR.includes(D))) out.lack.push(`${row} Lv${L} 掉落池里没有能装的武器`);
        if (L >= 10 && !W.some(D => wear(D) && epicOk(D) && D.lvl <= L && D.lvl > L - 10)) out.lack.push(`${row} Lv${L} 10 级内没有能刷到的史诗武器`);
      }
      // 2. 单换武器的倍率（其余部位 = 同级稀有，去掉随机属性；和 gear60 power / GEAR.md §10.1 同一口径）
      const score = () => { const m = gearMetrics(p, TYPE); return Math.pow(m.off, 0.7) * Math.pow(m.ehp, 0.3); };
      const M = masteryOf(cls, job), SW = CLASS_START_WEAPON[cls], R = ratioRows[row] = {};
      for (let L = 10; L <= 60; L += 5) {
        game.lvl = L; const T = Math.floor(L / 5) * 5;
        for (const s of GEARS) delete inv.equip[s];
        for (const s of GEARS) { const D = GEAR.find(D => D.slot === s && D.rar === 2 && D.lvl === T && !D.set && !D.named && (s !== 'weapon' || D.wtype === SW) && (!ARMOR_SLOTS.includes(s) || D.atype === M)); if (D) inv.equip[s] = rareIt(D); }
        recalcStats(p); const base = score(); let best = 0;
        for (const D of W) if (wear(D) && D.rar === 5 && D.lvl <= L && D.lvl > L - (L <= 30 ? 6 : 12)) { inv.equip.weapon = makeItem(D.key); recalcStats(p); best = Math.max(best, score() / base); }
        R[L] = +best.toFixed(3);
        if (best < (L <= 30 ? 1.15 : 1.3)) out.weak.push(`${row} Lv${L} ×${best.toFixed(2)}`);
      }
      // 3. 装备对比 / 红字默认属性按转职的伤害类型
      if (Jd.dmgType === 'mag') {
        for (const id in SKILLS) { const S = SKILLS[id]; if (S.job === job && !S.passive && !S.awaken) game.skillLv[id] = 1; }
        if (mainDmgType(p) !== 'mag') out.cmp.push(`${row} 装备对比按 ${mainDmgType(p)}`);
        if (mainStatOf(cls, job) !== 'int') out.stat.push(`${row} 红字默认 ${mainStatOf(cls, job)}`);
        // 魔法转职能装的 Lv31+ 史诗：写了物理暴击的也要有魔法暴击、写了力量的也要有智力（不然魔法转职拿到是白板）
        for (const D of W) if (wear(D) && (D.rar === 5 || D.named) && D.lvl > 30) { const f = D.fx || {}, st = (D._def && D._def.st) || {};
          if ((f.crit && !f.mcrit) || (st.str && !st.int)) out.magItem.push(`${row} ${D.name}`); }
      }
    }
    // 4. 每类武器 Lv55 < T1 < T2 < T3（按这类武器的主口径：魔攻系数更高的按本职业的魔法转职，否则物理转职；没有这种转职就按职业）
    //    只查格斗家：三职业是各自的块按自己的口径定的（阿波菲斯是 Lv55 最强巨剑、魔法师矛 / 棍棒按物理口径…，GEAR.md §10.1），这里的主口径不适用
    const ORDER_CLS = ['fighter'];
    for (const t of Object.keys(WTYPES).filter(t => clsOpen(WTYPES[t].cls) && ORDER_CLS.includes(WTYPES[t].cls))) {
      const cls = WTYPES[t].cls, C = CLASSES[cls], want = WTYPES[t].mag > WTYPES[t].phys ? 'mag' : 'phys';
      const job = openJobs(cls).find(j => wtypeJobOk(t, j) && (C.jobs[j].dmgType || C.dmgType || (cls === 'mage' ? 'mag' : 'phys')) === want) || null;
      game.player = makePlayer(cls); game.job = job; const p = game.player, Jd = job && C.jobs[job], TYPE = (Jd && Jd.dmgType) || C.dmgType || (cls === 'mage' ? 'mag' : 'phys');
      game.skillLv = {}; if (Jd) for (const id of Jd.auto || []) game.skillLv[id] = 1;
      const score = () => { const m = gearMetrics(p, TYPE); return Math.pow(m.off, 0.7) * Math.pow(m.ehp, 0.3); };
      game.lvl = 60; for (const s of GEARS) delete inv.equip[s];
      const M = masteryOf(cls, job); for (const s of GEARS) { const D = GEAR.find(D => D.slot === s && D.rar === 2 && D.lvl === 60 && !D.set && !D.named && (s !== 'weapon' || D.wtype === CLASS_START_WEAPON[cls]) && (!ARMOR_SLOTS.includes(s) || D.atype === M)); if (D) inv.equip[s] = rareIt(D); }
      const sc = D => { inv.equip.weapon = makeItem(D.key); recalcStats(p); return score(); };
      const band = f => W.filter(D => D.wtype === t && D.rar === 5 && f(D)).map(sc);
      const g = [band(D => D.lvl === 55), band(D => D.tier === 1), band(D => D.tier === 2), band(D => D.tier === 3)];
      for (let i = 1; i < 4; i++) if (g[i - 1].length && g[i].length && Math.max(...g[i - 1]) >= Math.min(...g[i])) out.order.push(`${WTYPES[t].name}（${job || cls}）${['Lv55', 'T1', 'T2', 'T3'][i - 1]} ≥ ${['Lv55', 'T1', 'T2', 'T3'][i]}`);
    }
    out.ratio = ratioRows;
    return out;
  });
  const KNOWN = { 'gun:mechanic': '机械师（魔法口径）没单独平衡过' };
  const known = x => Object.keys(KNOWN).some(k => x.startsWith(k + ' '));
  for (const [row, R] of Object.entries(J.ratio)) if (row.startsWith('fighter:')) console.log(`  ${row}：单换武器 ${Object.entries(R).map(([L, v]) => `Lv${L} ×${v}`).join(' ')}`);
  check(!J.lack.length, `每个转职每 5 级都有能买 / 能掉的武器，每 10 级内有能刷到的史诗武器（${Object.keys(J.ratio).length} 个转职）`, J.lack.slice(0, 12).join('；'));
  check(!J.weak.filter(x => !known(x)).length, '单换武器的最好史诗 / 同级稀有：Lv10~30 ≥ ×1.15、Lv35~60 ≥ ×1.3（按转职的伤害类型）', J.weak.filter(x => !known(x)).join('；'));
  check(!J.cmp.length && !J.stat.length, '魔法转职：装备对比按魔法算、红字默认智力', J.cmp.concat(J.stat).join('；'));
  const mi = J.magItem.filter(x => !known(x)), mk = J.magItem.filter(known);
  check(!mi.length, `魔法转职能装的 Lv31+ 史诗 / 领主神器都有魔法属性（有物理暴击就有魔法暴击、有力量就有智力）${mk.length ? `；已知：机械师 ${mk.length} 件` : ''}`, mi.slice(0, 12).join('；'));
  check(!J.order.length, '格斗家每类武器 Lv55 < T1 < T2 < T3（主口径：手套按气功师，其余按物理转职）', J.order.join('；'));
}

/* ================= power ================= */
if (run('power')) {
  step('power：同级最好史诗 vs 同级稀有');
  await boot('town&fresh&mute&cls=sword');
  await ev(BEST_KIT_SRC);
  const WHY = process.argv.includes('--why');
  const R = await ev(async (WHY) => {
    const out = {}, why = {};
    // 行 = 已开放的职业（没转职）+ 和职业口径不一样的转职：伤害类型不同（气功师 / 街霸 / 机械师 = 魔法）或有转职专用武器（散打的拳套）
    const rows = openClasses().map(cls => [cls, null]);
    for (const cls of openClasses()) { const C = CLASSES[cls]; for (const job of openJobs(cls)) { const J = C.jobs[job];
      if ((J.dmgType && J.dmgType !== (C.dmgType || (cls === 'mage' ? 'mag' : 'phys'))) || CLASS_WTYPES(cls).some(t => (WTYPES[t].jobs || []).includes(job))) rows.push([cls, job]); } }
    for (const [cls, job] of rows) {
      game.player = makePlayer(cls); game.job = job; const p = game.player, J = job && CLASSES[cls].jobs[job], row = job ? `${cls}:${job}` : cls;
      game.skillLv = {}; if (J) for (const id of J.auto || []) game.skillLv[id] = 1;   // 转职自动学会的被动（街霸「邪功修炼」：力智取高）
      // 按职业 / 转职的伤害类型算（魔法师、气功师、街霸 = 魔法）；不用 mainDmgType：启动页是鬼剑士，game.skillLv 里是鬼剑士的物理技能，会把魔法师也算成物理（矛 vs 稀有魔杖）
      const TYPE = (J && J.dmgType) || p.dmgType || 'phys', score = () => { const m = gearMetrics(p, TYPE); return Math.pow(m.off, 0.7) * Math.pow(m.ehp, 0.3); };
      // --why：把综合分拆成因子（攻击 / 暴击 / 伤害增加 / 速度 / 属强 / 有效生命），log 贡献 = 0.7·ln(输出因子比) 或 0.3·ln(生存比)
      const parts = () => { const q = Object.create(p); recalcStats(q); const type = TYPE, m = gearMetrics(p, type);
        const crit = clamp(type === 'mag' ? q.mcrit : q.crit, 0, 1), spd = type === 'mag' ? q.cspd : q.aspd, el = q.elem || {};
        return { atk: type === 'mag' ? q.matk : q.baseStats.atk, crit: 1 + crit * (q.critDmg - 1), dmg: 1 + (q.dmgUp || 0), spd: 0.6 + 0.4 * spd,
          elem: 1 + (q.atkElem ? (el[q.atkElem] || 0) / 220 : Math.max(0, el.fire || 0, el.ice || 0, el.light || 0, el.dark || 0) / 220 * 0.3), ehp: m.ehp }; };
      out[row] = {}; why[row] = {};
      for (const L of [30, 35, 40, 45, 50, 55, 60]) {
        game.lvl = L;
        const { best, base, baseKit, bestKit, GEARS } = g60BestKit(L);   // test/lib_bestkit.mjs
        out[row][L] = +(best / base).toFixed(3);
        if (!WHY) continue;
        for (const s of GEARS) { if (baseKit[s]) inv.equip[s] = baseKit[s]; else delete inv.equip[s]; } const P0 = parts();
        for (const s of GEARS) { if (bestKit[s]) inv.equip[s] = bestKit[s]; else delete inv.equip[s]; }
        const P1 = parts(), f = {}; for (const k in P0) f[k] = +((k === 'ehp' ? 0.3 : 0.7) * Math.log(P1[k] / P0[k])).toFixed(3);
        const kit = {}; for (const s of GEARS) { const it = inv.equip[s]; if (!it) continue; const prev = it; inv.equip[s] = baseKit[s]; if (!baseKit[s]) delete inv.equip[s]; recalcStats(p); const drop = +Math.log(best / score()).toFixed(3); inv.equip[s] = prev;
          kit[s] = `${it.key}@${it.lvl}${it.set ? '[' + it.set + ']' : ''} Δ${drop} ${JSON.stringify(it.st).replace(/"/g, '')} fx${JSON.stringify(it.fx || {}).replace(/"/g, '')}`; }
        recalcStats(p); const sets = (p.sets || []).map(x => `${x.id}:${x.n}(${x.on.join('/')})`);
        const bk = {}; for (const x of p.sets || []) { bk[x.id] = SETS[x.id].bonus; SETS[x.id].bonus = {}; } recalcStats(p); const noSet = +Math.log(best / score()).toFixed(3); for (const id in bk) SETS[id].bonus = bk[id];
        const fxs = {}; for (const s of GEARS) { const it = inv.equip[s]; if (it && it.fx) { fxs[s] = it.fx; it.fx = undefined; } } recalcStats(p); const noFx = +Math.log(best / score()).toFixed(3); for (const s in fxs) inv.equip[s].fx = fxs[s];
        recalcStats(p);
        why[row][L] = { lnTotal: +Math.log(best / base).toFixed(3), factor: f, setsLn: noSet, fxLn: noFx, sets, kit, base: Object.fromEntries(Object.entries(P0).map(([k, v]) => [k, +v.toFixed(3)])), epic: Object.fromEntries(Object.entries(P1).map(([k, v]) => [k, +v.toFixed(3)])) };
      }
    }
    return { out, why };
  }, WHY);
  const pw = R.out;
  if (WHY) { const f = path.join(os.tmpdir(), 'gear60_power_why.json'); fs.writeFileSync(f, JSON.stringify(R.why, null, 1)); console.log('  拆解（每件换回稀有的 ln 损失、套装 / fx 的 ln 贡献、因子 ln 贡献）写到', f);
    for (const cls in R.why) for (const L in R.why[cls]) { const w = R.why[cls][L]; console.log(`  ${cls} Lv${L} ln=${w.lnTotal} 套装${w.setsLn} fx${w.fxLn} ${JSON.stringify(w.factor).replace(/"/g, '')} ${w.sets.join(' ')}`); } }
  // 已知没按转职口径平衡过的行（只提示、不算失败）：机械师是神枪手里的魔法转职，GEAR.md §10.4 按职业（物理）口径调的，Lv40 / 55 偏低、Lv60 偏高（docs/FIGHTER_GEAR_AUDIT.md 遗留项）
  const KNOWN = { 'gun:mechanic': '机械师（魔法口径）没单独平衡过' };
  for (const cls of Object.keys(pw)) { const r30 = pw[cls][30], bad = Object.entries(pw[cls]).filter(([L, v]) => +L > 30 && Math.abs(v / r30 - 1) > 0.1);
    if (KNOWN[cls]) { console.log(bad.length ? '  ⚠' : '  ✓', `${cls}：史诗 / 稀有倍率 ${Object.entries(pw[cls]).map(([L, v]) => `Lv${L} ×${v}`).join(' ')}（已知：${KNOWN[cls]}）`, bad.map(([L, v]) => `Lv${L} ${(v / r30).toFixed(2)}`).join(' ')); continue; }
    check(!bad.length, `${cls}：史诗 / 稀有倍率 ${Object.entries(pw[cls]).map(([L, v]) => `Lv${L} ×${v}`).join(' ')}（和 Lv30 比 ±10%）`, bad.map(([L, v]) => `Lv${L} ${(v / r30).toFixed(2)}`).join(' ')); }
  // 职业之间：各行（职业 / 转职）Lv30~60 的平均倍率和中位数比 ±15%（格斗家没有史诗武器时只有 ×3.1，其余 ×4.4~5.1）
  const avg = Object.fromEntries(Object.entries(pw).map(([k, r]) => [k, Object.values(r).reduce((a, b) => a + b, 0) / Object.values(r).length])), med = Object.values(avg).sort((a, b) => a - b)[Math.floor(Object.values(avg).length / 2)];
  const off = Object.entries(avg).filter(([k, v]) => !KNOWN[k] && Math.abs(v / med - 1) > 0.15);
  check(!off.length, `职业之间持平：平均倍率 ${Object.entries(avg).map(([k, v]) => `${k} ×${v.toFixed(2)}`).join(' ')}（中位数 ×${med.toFixed(2)} 的 ±15%）`, off.map(([k, v]) => `${k} ${(v / med).toFixed(2)}`).join(' '));
}

check(!logs.some(l => l.type === 'pageerror'), '没有页面报错', logs.filter(l => l.type === 'pageerror').map(l => l.text.slice(0, 200)));
await browser.close();
console.log(fails ? `\n✗ ${fails} 项失败` : '\n✓ 全部通过');
process.exit(fails ? 1 : 0);
