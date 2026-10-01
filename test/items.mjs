// 装备与经济测试：商店多选 / Shift 数量购买、出售与回购、穿戴与属性、强化成功 / 失败 / 破碎 / 保护券、分解、仓库与账号金库、耐久与修理、刷新后数据仍在
// 用法：node build.mjs --offline && node test/items.mjs [cls]
import { launch, URL_BASE } from './lib.mjs';
import fs from 'fs';
const cls = process.argv[2] || 'sword';
const out = 'test/shots/items'; fs.mkdirSync(out, { recursive: true });
const { browser, page, logs } = await launch({ width: 1280, height: 720 });
const wait = ms => page.waitForTimeout(ms), shot = n => page.screenshot({ path: `${out}/${n}.png` });
const ev = (fn, arg) => page.evaluate(fn, arg);
let fails = 0;
const check = (ok, msg, extra = '') => { console.log(ok ? '  ✓' : '  ✗', msg, extra); if (!ok) fails++; };
const closeAll = () => ev(() => { while (menus.stack.length) menus.close(menus.stack[menus.stack.length - 1]); });
const step = s => console.log('·', s);

await page.goto(`${URL_BASE}?town&fresh&cls=${cls}&mute`);
await page.waitForFunction(() => window.__READY && game.player && game.scene === 'town', null, { timeout: 30000 });
await wait(400); await closeAll();
await ev(() => { localStorage.removeItem('dawnbreak_bank_dev'); bank.loadedKey = null; game.gold = 300000; game.lvl = 12; recalcStats(game.player); save.write(); });

/* ---------- 1. 购买：多选 + Shift 数量 ---------- */
step('商店购买（多选 + Shift 数量）');
await ev(() => menus.open('shop', { shop: 'seria', npc: NPCS.seria }));
await wait(300);
const b0 = await ev(() => ({ gold: game.gold, hpS: inv.count('hpS'), mpS: inv.count('mpS'), hpM: inv.count('hpM') }));
await page.click('.shopwin .srow:has-text("新手 HP 药剂")');
await page.click('.shopwin .srow:has-text("新手 MP 药剂")');
await page.click('.shopwin .srow:has-text("普通 HP 药剂")', { modifiers: ['Shift'] });
await wait(200);
check(await page.isVisible('.idlg input[type=number]'), 'Shift + 点击弹出数量输入框');
await page.fill('.idlg input[type=number]', '7'); await shot('01-shop-qty');
await page.keyboard.press('Enter'); await wait(150);
await shot('02-shop-multiselect');
await page.click('.shopwin .shopfoot button:has-text("购买选中")'); await wait(300);
const b1 = await ev(() => ({ gold: game.gold, hpS: inv.count('hpS'), mpS: inv.count('mpS'), hpM: inv.count('hpM'), price: ITEMS.hpS.price + ITEMS.mpS.price + ITEMS.hpM.price * 7 }));
check(b1.hpS === b0.hpS + 1 && b1.mpS === b0.mpS + 1 && b1.hpM === b0.hpM + 7, '多选一次购买了 3 种（其中一种 ×7）', JSON.stringify(b1));
check(b0.gold - b1.gold === b1.price, `扣款正确 ${b0.gold - b1.gold} = ${b1.price}`);
// 贵重物品二次确认：称号商店
await closeAll(); await ev(() => menus.open('shop', { shop: 'paris', npc: NPCS.paris })); await wait(250);
await page.click('.shopwin .srow:has-text("赫顿玛尔的英雄")', { button: 'right' }); await wait(200);
check(await page.isVisible('.idlg:has-text("确认购买")'), '贵重物品（3 万金币的称号）购买前二次确认');
await shot('03-shop-confirm');
await page.click('.idlg button:has-text("购买")'); await wait(200);
check(await ev(() => inv.count('title_hero') === 1), '确认后买到称号');
// 时装：多选买 3 件，用背包操作栏的“穿戴”按钮穿上（触屏也能用），3 件套生效
await page.click('.shopwin .shopcats .cat:has-text("时装")'); await wait(150);
for (const n of ['庆典小礼帽', '庆典外套', '庆典小皮鞋']) await page.click(`.shopwin .srow:has-text("${n}")`);
await page.click('.shopwin .shopfoot button:has-text("购买选中")'); await wait(250);
if (await page.isVisible('.idlg')) await page.click('.idlg button:has-text("购买")');
await wait(200);
await closeAll(); await ev(() => { IW.invTab = 'avatar'; IW.dollPage = 'avatar'; menus.open('status'); menus.open('inv'); }); await wait(250);
const sp0 = await ev(() => ({ str: game.player.stats.str, mspd: game.player.stats.mspd }));
for (let i = 0; i < 3; i++) { await page.click('[data-win=inv] .igrid .islot >> nth=0'); await wait(100); await page.click('[data-win=inv] .ibar button:has-text("穿戴")'); await wait(150); }
const sp1 = await ev(() => ({ str: game.player.stats.str, mspd: game.player.stats.mspd, n: AV_SLOTS.filter(s => inv.equip[s]).length, set: (game.player.sets || []).find(x => x.id === 'av_festival') }));
check(sp1.n === 3 && sp1.set && sp1.set.on.includes(3), '时装 3 件穿上，3 件套生效', JSON.stringify(sp1.set));
check(sp1.str >= sp0.str + 18 && sp1.mspd > sp0.mspd, `时装属性：力量 ${sp0.str}→${sp1.str}，移速 ${sp0.mspd}→${sp1.mspd}`);
await shot('03b-avatar');
await ev(() => { IW.dollPage = 'gear'; });

/* ---------- 2. 林纳斯：买武器 + 防具，右键穿戴，属性变化 ---------- */
step('林纳斯商店 → 穿戴 → 属性变化');
await closeAll(); await ev(() => menus.open('shop', { shop: 'linus', npc: NPCS.linus })); await wait(300);
await shot('04-shop-linus');
const want = await ev(() => { const w = CLASS_START_WEAPON[game.player.cls], m = masteryOf(game.player.cls, game.job); return { w: ITEMS[`${w}_10_1`].name, top: ITEMS[`${m}_top_10_1`].name }; });
await page.click(`.shopwin .srow:has-text("${want.w}")`);
await page.click('.shopwin .shopcats .cat:has-text("防具")'); await wait(150);
await page.click(`.shopwin .srow:has-text("${want.top}")`);
await page.click('.shopwin .shopfoot button:has-text("购买选中")'); await wait(300);
const bought = await ev(n => ({ w: inv.items.filter(x => x.name === n.w).length, top: inv.items.filter(x => x.name === n.top).length }), want);
check(bought.w === 1 && bought.top === 1, '跨分类多选买到武器和上衣', JSON.stringify(bought));
await closeAll(); await ev(() => { IW.invTab = 'equip'; menus.open('status'); menus.open('inv'); }); await wait(300);
const s0 = await ev(() => ({ atk: game.player.stats.atk, matk: game.player.stats.matk, def: game.player.def, w: inv.equip.weapon.key }));
// 右键穿武器
const wIdx = await ev(n => inv.items.filter(x => TAB_OF(x) === 'equip').findIndex(x => x.name === n), want.w);
await page.click(`[data-win=inv] .igrid .islot >> nth=${wIdx}`, { button: 'right' }); await wait(200);
// 拖上衣到个人信息的上衣格
const tIdx = await ev(n => inv.items.filter(x => TAB_OF(x) === 'equip').findIndex(x => x.name === n), want.top);
const src = page.locator(`[data-win=inv] .igrid .islot >> nth=${tIdx}`), dst = page.locator('[data-win=status] .doll .islot >> nth=1');
const sb = await src.boundingBox(), db = await dst.boundingBox();
await page.mouse.move(sb.x + sb.width / 2, sb.y + sb.height / 2); await page.mouse.down();
await page.mouse.move(sb.x + 30, sb.y + 20, { steps: 4 }); await page.mouse.move(db.x + db.width / 2, db.y + db.height / 2, { steps: 8 }); await page.mouse.up(); await wait(250);
const s1 = await ev(() => ({ atk: game.player.stats.atk, matk: game.player.stats.matk, def: game.player.def, w: inv.equip.weapon.name, top: inv.equip.top && inv.equip.top.name }));
check(s1.w === want.w, '右键穿上武器', s1.w);
check(s1.top === want.top, '拖放穿上上衣', s1.top);
check((cls === 'mage' ? s1.matk > s0.matk : s1.atk > s0.atk) && s1.def > s0.def, `攻击 / 防御上升 ${Math.round(s0.atk)}→${Math.round(s1.atk)} / ${Math.round(s0.def)}→${Math.round(s1.def)}`);
// tooltip（背包里的装备并排对比当前装备）
await ev(() => { IW.invTab = 'equip'; itemsRefresh(); });
const oldIdx = await ev(() => inv.items.filter(x => TAB_OF(x) === 'equip').findIndex(x => x.slot === 'weapon'));
if (oldIdx >= 0) { await page.hover(`[data-win=inv] .igrid .islot >> nth=${oldIdx}`); await wait(250); check(await page.isVisible('#itip .itip-pair'), 'tooltip 并排显示当前装备对比'); await shot('05-tooltip-compare'); }
await page.mouse.move(5, 5);
await shot('06-inv-status');

// 消耗品拖到 HUD 快捷栏（落点由界面组的 hud.js 处理）
if (await ev(() => typeof hudQuickRect === 'function')) {
  await ev(() => { IW.invTab = 'use'; itemsRefresh(); inv.quick[2] = null; }); await wait(150);
  const qi = await ev(() => inv.items.filter(x => TAB_OF(x) === 'use').findIndex(x => x.key === 'hpM'));
  const from = await page.locator(`[data-win=inv] .igrid .islot >> nth=${qi}`).boundingBox();
  const to = await ev(() => { const R = hudQuickRect(2), r = stage.getBoundingClientRect(); return { x: r.left + (R.x + R.s / 2) / UW * r.width, y: r.top + (R.y + R.s / 2) / UH * r.height }; });
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2); await page.mouse.down();
  await page.mouse.move(from.x + 20, from.y + 20, { steps: 4 }); await page.mouse.move(to.x, to.y, { steps: 10 }); await page.mouse.up(); await wait(200);
  check(await ev(() => inv.quick[2] === 'hpM'), '背包消耗品拖到 HUD 快捷栏第 3 格');
}
/* ---------- 3. 出售 + 回购 ---------- */
step('出售（全选普通）与回购');
await ev(() => { for (let i = 0; i < 3; i++) inv.add(rollEquip({ lvl: 8, rar: 0 })); const e = rollEquip({ lvl: 8, rar: 1 }); e.enh = 4; inv.add(e); itemsRefresh(); });
await closeAll(); await ev(() => menus.open('shop', { shop: 'linus', npc: NPCS.linus, tab: 'sell' })); await wait(300);
const c0 = await ev(() => ({ gold: game.gold, n: inv.items.length, commons: inv.items.filter(x => x.kind === 'equip' && x.rar === 0 && !x.enh).length }));
await page.click('.shopwin .shopcats .cat:has-text("全选普通")'); await wait(100);
await shot('07-shop-sell');
await page.click('.shopwin .shopfoot button:has-text("出售选中")'); await wait(250);
if (await page.isVisible('.idlg')) await page.click('.idlg button:has-text("出售")');
await wait(200);
const c1 = await ev(() => ({ gold: game.gold, n: inv.items.length, bb: save.data.buyback.length }));
check(c1.n === c0.n - c0.commons && c1.gold > c0.gold, `批量出售 ${c0.commons} 件普通装备，+${c1.gold - c0.gold} G`);
// 强化过的装备出售要确认
const enhIdx = await ev(() => inv.items.filter(x => TAB_OF(x) === 'equip').findIndex(x => x.enh === 4));
await page.click(`.shopwin .igrid .islot >> nth=${enhIdx}`, { button: 'right' }); await wait(200);
check(await page.isVisible('.idlg:has-text("确认出售")'), '强化过的装备出售前二次确认');
await page.click('.idlg button:has-text("出售")'); await wait(200);
await page.click('.shopwin .itab:has-text("回购")'); await wait(200);
await shot('08-shop-buyback');
const r0 = await ev(() => ({ gold: game.gold, has: inv.items.some(x => x.enh === 4), price: save.data.buyback[0].price }));
await page.click('.shopwin .srow >> nth=0 >> button:has-text("回购")'); await wait(200);
const r1 = await ev(() => ({ gold: game.gold, has: inv.items.some(x => x.enh === 4) }));
check(!r0.has && r1.has && r0.gold - r1.gold === r0.price, '回购：按出售价买回强化装备');

/* ---------- 4. 强化 ---------- */
step('强化：成功 / 失败降级 / 武器 +10 失败 / 防具破碎 / 保护券');
await closeAll(); await ev(() => { inv.add(makeItem('crystal', 3000)); IW.enhSel = inv.equip.weapon; IW.enhSrc = 'worn'; menus.open('enhance', NPCS.kiri || NPCS.linus); }); await wait(300);
await ev(() => { window.__rnd = Math.random; Math.random = () => 0; });
await page.click('[data-win=enhance] button:has-text("强化")'); await wait(1400);
const e1 = await ev(() => ({ enh: inv.equip.weapon.enh, msg: IW.enhMsg && IW.enhMsg.text }));
check(e1.enh === 1 && /成功/.test(e1.msg), '强化成功 +0 → +1', e1.msg);
await shot('09-enhance-ok');
await ev(() => { inv.equip.weapon.enh = 5; Math.random = () => 0.999; itemsRefresh(); });
await page.click('[data-win=enhance] button:has-text("强化")'); await wait(1400);
check(await ev(() => inv.equip.weapon.enh === 4), '+5 失败降为 +4');
await shot('10-enhance-fail');
await ev(() => { inv.equip.weapon.enh = 10; itemsRefresh(); });
await page.click('[data-win=enhance] button:has-text("强化")'); await wait(200);
if (await page.isVisible('.idlg')) await page.click('.idlg button:has-text("强化")');
await wait(1400);
check(await ev(() => inv.equip.weapon.enh === 7), '武器 +10 失败降为 +7（官方）');
// 防具 +10 失败破碎；再测保护券
const brk = await ev(() => { const a = inv.equip.top; a.enh = 10; const r = tryEnhance(a, false, 0.999); return { broken: r.broken, still: !!inv.equip.top }; });
check(brk.broken && !brk.still, '防具 +10 失败破碎并从身上移除');
const grd = await ev(() => { const a = rollEquip({ slot: 'head', lvl: 10, rar: 1 }); inv.add(a); a.enh = 11; inv.add(makeItem('guard', 1)); const g0 = inv.count('guard'); const r = tryEnhance(a, true, 0.999); return { guard: r.guard, enh: a.enh, kept: inv.items.includes(a), used: g0 - inv.count('guard') }; });
check(grd.guard && grd.enh === 0 && grd.kept && grd.used === 1, '保护券：不破碎、强化归零、券消耗 1 张', JSON.stringify(grd));
const evt = await ev(() => { let got = null; const off = bus.on('enhance', e => { got = e; }); tryEnhance(inv.equip.weapon, false, 0); off(); return got && { ok: got.ok, lvl: got.lvl }; });
check(evt && evt.ok, 'bus 发出 enhance 事件', JSON.stringify(evt));
const pity = await ev(() => {
  if (typeof enhPityRate !== 'function' || typeof enhPityStep !== 'function') return { missing: true };
  const w = inv.equip.weapon, fodder = rollEquip({ slot: 'weapon', lvl: 10, rar: 1 });
  inv.add(fodder); save.data.enhPity = 0; fodder.enh = 10;
  const fail = tryEnhance(fodder, false, 0.999999); fodder.enh = 10;
  const step10 = enhPityStep(10), boosted10 = enhPityRate({ enh: 10 });
  const fail2 = tryEnhance(fodder, false, 0.999999); fodder.enh = 11;
  const boosted11 = enhPityRate({ enh: 11 }), step11 = enhPityStep(11);
  save.data.enhPity = 4; const low = rollEquip({ slot: 'weapon', lvl: 10, rar: 1 }); inv.add(low); low.enh = 9;
  const lowRate = enhPityRate(low), lowFail = tryEnhance(low, false, 0.999999), lowPity = save.data.enhPity;
  w.enh = 15; save.data.enhPity = ENH_PITY_HARD;
  const hardRate = enhPityRate(w), hard = tryEnhance(w, false, 0.999999);
  return { failPity: fail.pity, fail2Pity: fail2.pity, step10, boosted10, base10: enhRate(10), step11, boosted11, base11: enhRate(11), lowRate, lowBase: enhRate(9), lowFail: lowFail.ok, lowPity, hardRate, hardOk: hard.ok, hardLvl: hard.lvl, hardPity: save.data.enhPity };
});
check(!pity.missing && pity.failPity === 1 && Math.abs(pity.boosted10 - (pity.base10 + pity.step10)) < 1e-9, '+10 后垫子失败，下一次强化吃到隐藏递增加成', JSON.stringify(pity));
check(pity.fail2Pity === 2 && pity.boosted11 > pity.base11 + pity.step11 && pity.lowRate === pity.lowBase && !pity.lowFail && pity.lowPity === 4, '连续失败时后续加成继续递增，+10 以下不享受加成', JSON.stringify(pity));
check(pity.hardRate === 1 && pity.hardOk && pity.hardLvl === 16 && pity.hardPity === 0, '连续失败达到硬保底后下一次必定成功并清零', JSON.stringify(pity));
await ev(() => itemsRefresh());
check(!(await page.isVisible('[data-win=enhance] .enhpity')), '隐藏保底不在强化窗口明示');
await ev(() => { Math.random = window.__rnd; });

/* ---------- 5. 分解 ---------- */
step('分解（多选）');
await closeAll(); await ev(() => { for (let i = 0; i < 4; i++) inv.add(rollEquip({ lvl: 10, rar: i % 3 })); IW.disSel.clear(); menus.open('disassemble', NPCS.linus); }); await wait(300);
const d0 = await ev(() => ({ eq: inv.items.filter(canDisassemble).length, crystal: inv.count('crystal') }));
await page.click('[data-win=disassemble] .cat:has-text("全选稀有及以下")'); await wait(150);
await shot('11-disassemble');
const selN = await ev(() => IW.disSel.size);
await page.click('[data-win=disassemble] .shopfoot button:has-text("分解")'); await wait(250);
if (await page.isVisible('.idlg')) await page.click('.idlg button:has-text("分解")');
await wait(200);
const d1 = await ev(() => ({ eq: inv.items.filter(canDisassemble).length, crystal: inv.count('crystal') }));
check(selN > 0 && d1.eq === d0.eq - selN && d1.crystal > d0.crystal, `分解 ${selN} 件，无色小晶块 ${d0.crystal} → ${d1.crystal}`);

/* ---------- 6. 仓库 / 账号金库 ---------- */
step('角色仓库与账号金库');
await closeAll(); await ev(() => { IW.stTab = 'char'; IW.invTab = 'use'; menus.open('storage'); menus.open('inv'); itemsRefresh(); }); await wait(350);
const hpIdx = await ev(() => inv.items.filter(x => TAB_OF(x) === 'use').findIndex(x => x.key === 'hpM'));
const st0 = await ev(() => inv.count('hpM'));
await page.click(`[data-win=inv] .igrid .islot >> nth=${hpIdx}`, { button: 'right' }); await wait(200);
const st1 = await ev(() => ({ bag: inv.count('hpM'), st: inv.count('hpM', inv.storage) }));
check(st1.bag === 0 && st1.st === st0, '背包右键存入角色仓库');
await page.click('[data-win=storage] .itab:has-text("账号金库")'); await wait(200);
const pIdx = await ev(() => inv.items.filter(x => TAB_OF(x) === 'use').findIndex(x => x.key === 'mpS'));
await page.click(`[data-win=inv] .igrid .islot >> nth=${pIdx}`, { button: 'right' }); await wait(150);
await page.fill('[data-win=storage] .shopfoot input', '12345');
await page.click('[data-win=storage] .shopfoot button:has-text("存入")'); await wait(200);
await shot('12-storage-bank');
const bk = await ev(() => JSON.parse(localStorage.getItem('dawnbreak_bank_dev')));
check(bk && bk.gold === 12345 && bk.items.some(x => x.key === 'mpS'), '账号金库写入独立的 localStorage（金币 + 物品）');
await page.click('[data-win=storage] .itab:has-text("角色仓库")'); await wait(150);
await page.click('[data-win=storage] .igrid .islot >> nth=0', { button: 'right' }); await wait(150);
check(await ev(n => inv.count('hpM') === n && !inv.storage.length, st0), '角色仓库右键取出');

/* ---------- 7. 耐久与修理 ---------- */
step('耐久与修理');
await closeAll();
const du = await ev(() => {
  const p = game.player, w = inv.equip.weapon; recalcStats(p);
  const a0 = p.stats.atk, d0 = w.dur;
  bus.emit('playerDeath', {});
  const d1 = w.dur; w.dur = 0; recalcStats(p); const a1 = p.stats.atk;
  return { a0, a1, d0, d1, max: w.durMax };
});
check(du.d1 === du.d0 - Math.ceil(du.max * 0.1), `倒下扣 10% 耐久 ${du.d0} → ${du.d1}`);
check(du.a1 < du.a0, `耐久 0 时武器属性失效（攻击 ${Math.round(du.a0)} → ${Math.round(du.a1)}）`);
await ev(() => menus.open('repair', NPCS.linus)); await wait(300);
await shot('13-repair');
const g0 = await ev(() => ({ gold: game.gold, cost: repairCost() }));
await page.click('[data-win=repair] button:has-text("全部修理")'); await wait(250);
const g1 = await ev(() => ({ gold: game.gold, dur: inv.equip.weapon.dur, max: inv.equip.weapon.durMax, atk: game.player.stats.atk }));
check(g1.dur === g1.max && g0.gold - g1.gold === g0.cost && g1.atk >= du.a0 - 1, `修理花费 ${g0.cost} G，耐久回满，属性恢复`);

/* ---------- 8. 旧存档物品自动补全 ---------- */
step('旧存档物品补全');
const lg = await ev(() => {
  const w = normalizeItem({ id: 1, kind: 'equip', slot: 'weapon', cls: 'mage', name: '星辉法杖', rar: 2, grade: 3, lvl: 10, st: { atk: 500, str: 5 }, enh: 3, dur: 30, price: 900 });
  const a = normalizeItem({ id: 2, kind: 'equip', slot: 'top', name: '钢铁胸甲', rar: 1, grade: 2, lvl: 8, st: { def: 120, hp: 200 }, enh: 0, dur: 30, price: 400 });
  const e = normalizeItem({ id: 3, kind: 'equip', slot: 'shoes', name: '疾风行者', rar: 5, grade: 4, lvl: 6, st: { def: 80 }, fx: { spd: 0.18 }, desc: '移动速度 +18%', epic: true, enh: 0, dur: 30, price: 5000 });
  const c = normalizeItem({ id: 4, kind: 'use', key: 'hpS', name: '小型生命药剂', n: 5, rar: 0, price: 60 });
  return { w: [w.wtype, w.st.matk > 0, w.durMax, w.enh], a: [a.atype, a.st.mdef > 0], e: [e.fx.mspd, e.fx.spd], c: [c.name === ITEMS.hpS.name, c.n], tip: !!itemTip(w) };
});
check(lg.w[0] === 'rod' && lg.w[1] && lg.w[2] === 30 && lg.w[3] === 3, '旧武器补全武器类型 / 魔攻 / 耐久，保留强化', JSON.stringify(lg.w));
check(lg.a[0] && lg.a[1], '旧防具补全防具类型 / 魔防');
check(lg.e[0] === 0.18 && lg.e[1] === undefined, '旧史诗的速度特效换算成移速');
check(lg.c[0] && lg.c[1] === 5, '旧药剂名字更新、数量保留');

/* ---------- 8b. 回归：代码审查发现的问题 ---------- */
step('回归检查');
const rg = await ev(() => {
  let nulls = 0, badSlot = 0, titles = 0;
  for (let i = 0; i < 400; i++) { const it = makeEquip(pick(SLOTS), 1 + (i % 24), i % 6); if (!it) nulls++; else { if (!SLOT_WEIGHT[it.slot]) badSlot++; if (it.slot === 'title') titles++; } }
  let rollNull = 0; for (let i = 0; i < 300; i++) if (!rollEquip({ lvl: 1 + (i % 9), rar: i % 5 })) rollNull++;
  const cdr = statLine('cdr', 0.1), dr = statLine('dmgReduce', 0.03);
  const stray = makeItem('katana_5_1'); const r = tryEnhance(stray, false, 0); const worn = inv.wear(makeItem('katana_5_1'));
  return { nulls, badSlot, titles, rollNull, cdr, dr, strayErr: !!r.err, worn };
});
check(rg.nulls === 0 && rg.badSlot === 0 && rg.titles === 0, '旧接口 makeEquip(任意部位) 不返回 null、不出称号 / 时装（结算翻牌不会崩）', JSON.stringify(rg));
check(rg.rollNull === 0, '低等级随机装备不会凭空消失');
check(/-10%/.test(rg.cdr) && /-3%/.test(rg.dr), `提示框正负号：${rg.cdr}；${rg.dr}`);
check(rg.strayErr && rg.worn === false, '不在身上 / 背包里的装备不能强化、不能穿');
await closeAll(); await ev(() => menus.open('shop', { shop: 'ophelia', npc: NPCS.ophelia || NPCS.linus })); await wait(200);
if (await page.isVisible('.shopwin .srow')) { await page.click('.shopwin .srow >> nth=0'); await wait(100); }
await closeAll(); await ev(() => menus.open('shop', { shop: 'linus', npc: NPCS.linus })); await wait(200);
check(await ev(() => !Object.keys(IW.shopSel.linus || {}).length), '商店勾选不跨店共享');
await closeAll();

/* ---------- 9. 刷新后数据仍在 ---------- */
step('刷新后数据仍在');
await ev(() => { inv.equip.weapon.enh = 6; save.data.enhPity = 4; inv.storage.push(makeItem('elixir', 2)); save.write(); });
const before = await ev(() => ({ gold: game.gold, lvl: game.lvl, weapon: inv.equip.weapon.name, enh: inv.equip.weapon.enh, pity: save.data.enhPity, title: inv.count('title_hero'), items: inv.items.length, storage: inv.storage.map(x => x.key + x.n).join(), bb: save.data.buyback.length }));
await page.goto(`${URL_BASE}?town&cls=${cls}&mute`);
await page.waitForFunction(() => window.__READY && game.player && game.scene === 'town', null, { timeout: 30000 });
await wait(400);
const after = await ev(() => { inv.ensure(); bank.loadedKey = null; bank.load(); return { gold: game.gold, lvl: game.lvl, weapon: inv.equip.weapon.name, enh: inv.equip.weapon.enh, pity: save.data.enhPity, title: inv.count('title_hero'), items: inv.items.length, storage: inv.storage.map(x => x.key + x.n).join(), bb: save.data.buyback.length, bankGold: bank.gold }; });
check(JSON.stringify({ ...after, bankGold: undefined }) === JSON.stringify({ ...before, bankGold: undefined }), '刷新后金币 / 装备 / 强化保底 / 背包 / 仓库 / 回购都在', JSON.stringify(after));
check(after.bankGold === 12345, '刷新后账号金库金币仍在');
await closeAll(); await ev(() => { menus.open('status'); menus.open('inv'); }); await wait(300); await shot('14-after-reload');

console.log('LOGS', JSON.stringify(logs.filter(l => l.type !== 'warning'), null, 1));
console.log(fails ? `失败 ${fails} 项` : '全部通过');
await browser.close();
process.exit(fails ? 1 : 0);
