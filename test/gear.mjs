// 装备深化测试：新史诗 / 套装、绑定与交易、增幅（净化 / 成功 / 失败 / 归零 / 破碎 / 保护券）、锻造、附魔、装备图鉴、装备评分、
// 装备特效（proc）、深渊派对（邀请函 → 深渊柱 → 两轮 → 深渊领主 → 史诗光柱 → 拾取公告）、各窗口截图、刷新后数据仍在
// 用法：node build.mjs --offline && node test/gear.mjs [cls]
import { launch, URL_BASE } from './lib.mjs';
import fs from 'fs';
const cls = process.argv[2] || 'sword';
const out = 'test/shots/gear'; fs.mkdirSync(out, { recursive: true });
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
await ev(() => { game.gold = 5e6; game.lvl = 30; recalcStats(game.player); window.__ann = []; bus.on('announce', e => window.__ann.push({ kind: e.kind, key: e.item && e.item.key, lvl: e.lvl, abyss: e.abyss })); });

/* ---------- 1. 物品库 ---------- */
step('新史诗与套装');
const lib = await ev(() => {
  const ep = Object.values(ITEMS).filter(D => D.kind === 'equip' && D.rar === 5);
  const byW = {}; for (const D of ep) if (D.wtype) byW[D.wtype] = (byW[D.wtype] || 0) + 1;
  const slots = {}; for (const D of ep) slots[D.slot] = (slots[D.slot] || 0) + 1;
  const epicSets = Object.values(SETS).filter(S => S.epic), sizes = epicSets.map(S => S.pieces.length);
  const lv = [...new Set(ep.map(D => D.lvl))].sort((a, b) => a - b);
  const badIcon = ep.filter(D => !ASSET_SRC['icon/' + D.icon]).map(D => D.key);
  return { n: ep.length, minW: Math.min(...Object.values(byW)), wtypes: Object.keys(byW).length, slots, epicSets: epicSets.length, has5: sizes.includes(5), has3: sizes.includes(3), maxLv: Math.max(...lv), lv, badIcon: badIcon.length, badIconList: badIcon.slice(0, 8), legend: Object.values(SETS).filter(S => S.job).length, cards: Object.keys(ITEMS).filter(k => ITEMS[k].orb).length };
});
check(lib.n >= 120 && lib.wtypes === 15 && lib.minW >= 3, `史诗 ${lib.n} 件，15 种武器每种至少 ${lib.minW} 件`);
check(['weapon', 'top', 'head', 'bottom', 'belt', 'shoes', 'neck', 'bracelet', 'ring', 'support', 'stone'].every(s => lib.slots[s] >= 2), '每个部位至少 2 件史诗', JSON.stringify(lib.slots));
check(lib.epicSets >= 12 && lib.has5 && lib.has3 && lib.maxLv >= 30 && lib.maxLv <= 60, `史诗套装 ${lib.epicSets} 套（有 3 件 / 5 件套），最高 Lv${lib.maxLv}`);
check(lib.legend === 6 && lib.cards >= 30, `异界套装 ${lib.legend} 套，怪物卡片 ${lib.cards} 张`);
check(lib.badIcon === 0, '每件史诗都有专属图标', lib.badIconList.join(','));

/* ---------- 2. 绑定 / 交易 ---------- */
step('绑定与交易');
const bind = await ev(() => {
  const it = makeItem(G60.succ.ep_ss_kanya || 'ep_ss_kanya'); inv.add(it);   // 坎亚搬到 Lv55 后用它的继承装备 const before = { t: itemTradable(it), txt: itemBindText(it) };
  const w0 = inv.equip.weapon; inv.wear(it); const after = { t: itemTradable(it), txt: itemBindText(it) }; inv.wear(inv.items.find(x => x === w0) || w0);
  const t = makeItem('title_slayer'), tk = makeItem('abyss_ticket'), q = { kind: 'quest', key: 'q_x' };
  return { before, after, title: itemBindText(t), titleTrade: itemTradable(t), ticket: itemTradable(tk), quest: itemTradable(q), normal: itemTradable(makeItem('katana_10_1')) };
});
check(bind.before.t && !bind.after.t && bind.after.txt === '账号绑定', `史诗：穿之前 ${bind.before.txt}，穿上后 ${bind.after.txt}`);
check(!bind.titleTrade && bind.title === '角色绑定' && bind.ticket && !bind.quest && bind.normal, '任务称号角色绑定；邀请函、普通装备可交易；任务道具不可交易');

/* ---------- 3. 增幅 ---------- */
step('增幅');
const amp = await ev(() => {
  const w = makeItem('katana_20_2'); w.enh = 4; inv.add(w); inv.wear(w);
  const r = {};
  r.noBook = ampConvert(w).err;
  inv.add(makeItem('amp_purify', 3)); inv.add(makeItem('m_contra', 400)); inv.add(makeItem('amp_guard', 1));
  const str0 = game.player.str;
  r.conv = ampConvert(w, 0); r.dim = w.dim; r.enhAfter = w.enh; r.canEnh = canEnhance(w);
  r.redStat = ampStatVal(w); r.strGain = game.player[w.dim] - (w.dim === 'str' ? str0 : game.player[w.dim]);
  r.ok5 = tryAmplify(w, {}, 0).lvl;             // +4 → +5 成功
  r.fail6 = tryAmplify(w, {}, 0.99).lvl;        // 冲 +6 失败 → +4
  w.enh = 8; r.reset = tryAmplify(w, {}, 0.99); // 冲 +9 失败 → 归零
  w.enh = 10; r.guard = tryAmplify(w, { guard: true }, 0.99);   // 冲 +11 失败 + 保护券 → +9
  w.enh = 12; const before = inv.count('m_contra'); r.broke = tryAmplify(w, {}, 0.99); r.gone = !inv.items.includes(w) && inv.equip.weapon !== w; r.refund = inv.count('m_contra') - before;
  const w2 = makeItem('katana_20_2'); inv.add(w2); inv.wear(w2); w2.dim = 'str'; w2.enh = 9; r.ann = tryAmplify(w2, {}, 0); r.annList = window.__ann.filter(a => a.kind === 'amplify');
  r.ticket = ampSetLevel(makeItem('katana_25_2'), 10, { stat: 'int' });
  return r;
});
check(!!amp.noBook && amp.conv.ok && ['str', 'int', 'vit', 'spr'].includes(amp.dim) && amp.enhAfter === 4 && !amp.canEnh, `净化：没有净化书时拦下；净化后红字 ${amp.dim}，强化 +4 转成增幅 +4，不能再强化`);
check(amp.redStat > 0, `红字数值 ${amp.redStat}`);
check(amp.ok5 === 5 && amp.fail6 === 4, '增幅成功 +5；冲 +6 失败掉 1 级');
check(amp.reset.lvl === 0 && amp.reset.reset, '冲 +9 失败归零');
check(amp.guard.guard && amp.guard.lvl === 9, '冲 +11 失败 + 增幅保护券：只掉 1 级');
check(amp.broke.broken && amp.gone && amp.refund > 0, `冲 +13 失败装备破碎，返还矛盾的结晶体 ${amp.refund}`);
check(amp.ann.ok && amp.annList.some(a => a.lvl === 10), '增幅到 +10 发全服公告（announce）');
check(amp.ticket === true, '增幅券接口 ampSetLevel 可用');

/* ---------- 4. 锻造 ---------- */
step('锻造');
const forge = await ev(() => {
  const w = inv.equip.weapon; w.forge = 0; inv.add(makeItem('m_aura', 50)); inv.add(makeItem('crystal', 500)); recalcStats(game.player);
  const i0 = game.player.indep, a = tryForge(w, 0), i1 = game.player.indep, b = tryForge(w, 0.99);
  w.forge = 5; const c = tryForge(w, 0), ann = window.__ann.some(x => x.kind === 'forge' && x.lvl === 6);
  return { a: a.lvl, b: b.lvl, bOk: b.ok, up: i1 > i0, c: c.lvl, ann, stats: forgeStats(w) };
});
check(forge.a === 1 && forge.up, '锻造 +1 成功，独立攻击提高');
check(!forge.bOk && forge.b === 1, '锻造失败不降级');
check(forge.c === 6 && forge.ann, '锻造到 +6 发全服公告', JSON.stringify(forge.stats));

/* ---------- 5. 附魔 ---------- */
step('附魔');
const ench = await ev(() => {
  inv.add(makeItem('card_seghart', 1)); inv.add(makeItem('card_lucas', 1)); inv.add(makeItem('card_goblin', 1));
  const w = inv.equip.weapon, l0 = game.player.elem.light;
  const bad = enchantItem(w, inv.items.find(x => x.key === 'card_goblin'));
  const a = enchantItem(w, inv.items.find(x => x.key === 'card_seghart')), l1 = game.player.elem.light;
  const b = enchantItem(w, inv.items.find(x => x.key === 'card_lucas'));
  return { bad: !!bad.err, a: a.ok, up: l1 > l0, b: b.ok, old: b.old && b.old.key, now: w.orb.key, left: inv.count('card_seghart') + inv.count('card_lucas') };
});
check(ench.bad, '鞋子卡片不能附魔到武器');
check(ench.a && ench.up, '附魔光之城主塞格哈特卡片：光属性强化提高');
check(ench.b && ench.old === 'card_seghart' && ench.now === 'card_lucas' && ench.left === 0, '覆盖附魔：旧卡片消失，新卡片生效');
await closeAll(); const oi = await ev(() => { const hd = makeItem('heavy_head_20_1'); inv.add(hd); inv.wear(hd); inv.add(makeItem('card_catKing', 1)); menus.open('enchant', { npc: NPCS.lorian }); return orbItemsInBag().findIndex(x => x.key === 'card_catKing'); }); await wait(300);
await page.click(`[data-win=enchant] .enchcol >> nth=0 >> .islot >> nth=${oi}`); await wait(150);
await shot('01-enchant');
const orbSel = await ev(() => IW.enchOrb);
await page.click('[data-win=enchant] .enchright .btn.big'); await wait(250);
if (await page.isVisible('.idlg')) await page.click('.idlg .btn.red');
await wait(200);
const e2 = await ev(() => ({ head: inv.equip.head && inv.equip.head.orb && inv.equip.head.orb.key, msg: IW.enchMsg && IW.enchMsg.text }));
check(e2.head === orbSel && orbSel === 'card_catKing', '附魔窗口：选卡片 → 点附魔 → 附到头肩', JSON.stringify(e2));

/* ---------- 6. 图鉴 / 评分 ---------- */
step('装备图鉴与装备评分');
const cx = await ev(() => {
  const s0 = codexStats(), st0 = game.player.str, sc0 = gearScore();
  for (const k of ['ep_katana', 'ep_neck', 'ep_ring']) giveItem(makeItem(k));
  const s1 = codexStats(), st1 = game.player.str;
  const w = inv.equip.weapon, e0 = itemScore(w); w.enh = (w.enh || 0) + 2; const e1 = itemScore(w);
  return { s0: s0.epic, s1: s1.epic, count: epicCollectCount(), bonusStr: codexBonusStats().str || 0, log: save.data.codexLog.length, src: save.data.codex.ep_katana.src, sc0, sc1: gearScore(), e0, e1 };
});
check(cx.s1 >= cx.s0 + 3 && cx.count === cx.s1, `获得 3 件史诗后图鉴登记：${cx.s0} → ${cx.s1}（epicCollectCount = ${cx.count}）`);
check(cx.bonusStr >= 3, `收集加成生效（力量 +${cx.bonusStr}）`);
check(cx.log >= 3, `获得记录 ${cx.log} 条，来源：${cx.src}`);
check(cx.e1 > cx.e0 && cx.sc0 > 0, `装备评分：强化后单件 ${cx.e0} → ${cx.e1}，全身 ${cx.sc1}`);
await closeAll(); await ev(() => { IW.codexTab = 'weapon'; menus.open('codex'); }); await wait(300); await shot('02-codex');
await ev(() => { IW.codexTab = 'bonus'; itemsRefresh(); }); await wait(200); await shot('03-codex-bonus');
await closeAll(); await ev(() => { menus.open('status'); }); await wait(300); await shot('04-status-score');
check(await page.isVisible('[data-win=status] .stscore'), '个人信息窗口显示装备评分');

/* ---------- 7. 套装效果与装备特效 ---------- */
step('史诗套装与装备特效');
const set = await ev(() => {
  const AR = G60.setSucc.set_arad || 'set_arad';   // 装备 2.0：阿拉德之息搬到 Lv60 以后，用留在 Lv28 的继承套装测同一套效果
  for (const k of SETS[AR].pieces) { const it = makeItem(k); inv.add(it); inv.wear(it); }
  const p = game.player, S = (p.sets || []).find(x => x.id === AR);
  const scene0 = game.scene; game.scene = 'test';
  const t = { team: 'e', hp: 1e6, hpMax: 1e6, x: p.x + 30, y: p.y, z: 0, status: {}, dead: false };
  for (let i = 0; i < 12; i++) bus.emit('playerHit', { target: t, dmg: 100, crit: false });
  const b = p.buffs && p.buffs.gear_arad ? { n: p.buffs.gear_arad.n, aspd: p.buffs.gear_arad.aspd } : null;
  // 屠戮之刃：攻击出血中的敌人时附加 20% 伤害
  const k = makeItem(G60.succ.ep_kt_slaughter || 'ep_kt_slaughter'); inv.add(k); const w0 = inv.equip.weapon; inv.wear(k);   // 同上：屠戮之刃搬到 Lv55 后用继承装备
  t.status = { bleed: { t: 3 } }; const hp0 = t.hp; bus.emit('playerHit', { target: t, dmg: 1000, crit: false });
  const extra = hp0 - t.hp; game.scene = scene0; inv.wear(w0);
  return { on: S && S.on, b, extra, procs: (p.gearProcs || []).length };
});
check(set.on && set.on.join() === '2,3,5', '阿拉德之息 5 件套：2 / 3 / 5 件效果全部生效');
check(set.b && set.b.n === 10 && Math.abs(set.b.aspd - 0.15) < 1e-6, '5 件套特效：命中叠加疾风之息，最多 10 层（攻速 +15%）', JSON.stringify(set.b));
check(set.extra === 200, `史诗武器专属特效：攻击出血中的敌人附加 20% 伤害（${set.extra}）`);

/* ---------- 8. 窗口 ---------- */
step('增幅 / 锻造 / 深渊派对窗口');
await closeAll(); await ev(() => { IW.ampSel = inv.equip.weapon; menus.open('amplify', NPCS.kiri); }); await wait(300); await shot('05-amplify');
check(await page.isVisible('[data-win=amplify] .enhlv'), '增幅窗口');
await closeAll(); await ev(() => menus.open('forge', NPCS.linus)); await wait(300); await shot('06-forge');
check(await page.isVisible('[data-win=forge] .enhlv'), '锻造窗口');
await closeAll(); await ev(() => menus.open('abyss', NPCS.grandis)); await wait(300); await shot('07-abyss');
const tk0 = await ev(() => inv.count('abyss_ticket'));
await page.click('[data-win=abyss] .itab:has-text("邀请函")'); await wait(150);
await page.click('[data-win=abyss] .exrow >> nth=0 >> .btn'); await wait(150);
check(await ev(() => inv.count('abyss_ticket')) === tk0 + 1, '歌兰蒂斯处购买深渊派对邀请函');
await ev(() => inv.add(makeItem('m_cosmos', 60))); await page.click('[data-win=abyss] .itab:has-text("史诗兑换")'); await wait(150);
await page.click('[data-win=abyss] .exgrid .islot >> nth=0'); await wait(120); await shot('08-abyss-exchange');
const ex0 = await ev(() => ({ soul: inv.count('m_cosmos'), key: IW.abySel }));
await page.click('[data-win=abyss] .exrow .btn'); await wait(200); await page.click('.idlg .btn:not(.blue)'); await wait(200);
const ex1 = await ev(k => ({ soul: inv.count('m_cosmos'), got: inv.count(k) }), ex0.key);
check(ex1.got >= 1 && ex1.soul < ex0.soul, `宇宙灵魂兑换史诗：${ex0.key}，灵魂 ${ex0.soul} → ${ex1.soul}`);
// NPC 功能按钮
const svc = await ev(() => ({ grandis: NPCS.grandis.services.includes('abyss'), kiri: NPCS.kiri.services.includes('amplify'), linus: NPCS.linus.services.includes('forge'), lorian: NPCS.lorian.services.includes('enchant'), seria: NPCS.seria.services.includes('codex') }));
check(Object.values(svc).every(Boolean), 'NPC 功能入口：歌兰蒂斯 深渊派对 / 凯丽 增幅 / 林纳斯 锻造 / 罗莉安 附魔 / 赛丽亚 图鉴');
await closeAll(); await ev(() => openNpc(NPCS.grandis)); await wait(400); await shot('09-npc-grandis');
check(await page.isVisible('.npcmenu .btn:has-text("深渊派对")'), '歌兰蒂斯的对话窗口里有「深渊派对」按钮');
// tooltip
await closeAll(); await ev(() => { const it = makeItem('set_reaper_top'); inv.add(it); IW.invTab = 'equip'; menus.open('inv'); });
await wait(300);
const idx = await ev(() => inv.items.filter(x => TAB_OF(x) === 'equip').findIndex(x => x.key === 'set_reaper_top'));
await page.hover(`[data-win=inv] .igrid .islot >> nth=${idx}`); await wait(300); await shot('10-tip-epicset');
check(await page.isVisible('#itip .itip.r5 .tag'), '史诗 tooltip：金色边框、品级标签、特效说明');

/* ---------- 9. 深渊派对 ---------- */
step('深渊派对');
await closeAll();
const gate = await ev(() => ({ gf: SCENES.gf_graca.gates.some(g => g.dungeon === 'abyss_gf'), sky: SCENES.sky_castle && SCENES.sky_castle.gates.some(g => g.dungeon === 'abyss_sky'), hidden: !dungeonUnlocked(DUNGEONS.abyss_gf) }));
check(gate.gf && gate.sky && gate.hidden, '深渊之门放在格拉卡 / 天空之城，资格任务完成前不出现');
const noTk = await ev(() => { inv.take('abyss_ticket', inv.count('abyss_ticket')); save.data.fatigue = FATIGUE_MAX; return enterDungeon('abyss_gf', 0); });
check(noTk === false && await ev(() => game.scene === 'town'), '没有邀请函进不去');
await ev(() => { save.data.questDone.q_abyss_gf = Date.now(); inv.items = inv.items.filter(x => x.kind !== 'equip'); inv.add(makeItem('abyss_ticket', 2)); game.lvl = 22; recalcStats(game.player); });   // 先清空背包里的装备，免得捡东西时背包满
await ev(() => enterDungeon('abyss_gf', 0));
await page.waitForFunction(() => game.scene === 'dungeon' && game.dungeon && game.dungeon.def.id === 'abyss_gf', null, { timeout: 20000 });
await wait(300);
const dg0 = await ev(() => ({ tk: inv.count('abyss_ticket'), lord: game.dungeon.def.boss.kind, theme: game.room.theme, bg: !!IMG['bg/abyssGF_far'] }));
check(dg0.tk === 1 && dg0.theme === 'abyssGF' && dg0.bg, `消耗 1 张邀请函进入格兰之森深渊（深渊背景，本次深渊领主 ${dg0.lord}）`);
await shot('11-abyss-room');
// 直接进深渊柱所在的房间（官方：深渊柱在某个普通房间，打破后两轮）
await ev(() => { const dg = game.dungeon, p = game.player; p.invul = 999; const r = dg.abyssRoom; for (const o of dg.layout.rooms) if (o !== r && o.type !== 'boss') { o.visited = true; o.cleared = true; } dg.enter(r, 'left'); });
await wait(500);
const seal = await ev(() => { const s = ents.find(e => e.kind === 'abyssPillar'), dg = game.dungeon; return { seal: !!s, room: dg.abyssRoom.type, doors: dg.doorsOpen, phase: dg.abyssRun && dg.abyssRun.phase }; });
check(seal.seal && seal.room !== 'boss' && !seal.doors && seal.phase === 'pillar', '深渊柱出现在普通房间，门锁着');
await shot('12-abyss-seal');
// 打破深渊柱 → 第 1 轮深渊怪物 → 第 2 轮深渊精英 + 深渊领主
for (let i = 0; i < 40; i++) {
  const ph = await ev(() => { const R = game.dungeon.abyssRun; for (const e of ents) if (e.team === 'e' && !e.dead && !e.abyssLord && e !== R.block) { e.invul = 0; e.hp = 0; killEnt(e, game.player, {}); } drops.length = 0; return R.lord ? 'lord' : R.phase + R.round; });
  if (ph === 'lord') break;
  await wait(400);
}
await wait(1500);
const lord = await ev(() => { const R = game.dungeon.abyssRun, b = R.lord; return { lord: !!b && ents.includes(b) && b.name.startsWith('深渊领主'), round: R.round, doors: game.dungeon.doorsOpen }; });
check(lord.lord && lord.round === 2 && !lord.doors, '打破深渊柱，两轮深渊派对的第 2 轮深渊领主降临');
await shot('13-abyss-lord');
// 击杀深渊领主：强制史诗掉落（把随机数压到 0）；不会结算地下城
await ev(() => { const b = game.dungeon.abyssRun.lord; b.invul = 0; const R = Math.random; Math.random = () => 0.001; try { b.hp = 0; killEnt(b, game.player, {}); } finally { Math.random = R; } });
await wait(3200);
const dr = await ev(() => ({ n: drops.length, epic: drops.filter(d => d.item && d.item.rar >= 5).map(d => ({ key: d.item.key, abyss: !!d.abyss, landed: d.landT != null })), soul: drops.some(d => d.item && d.item.key === 'm_cosmos') }));
check(dr.epic.length >= 1 && dr.epic[0].abyss && dr.epic[0].landed && dr.soul, `深渊领主掉落：史诗 ${dr.epic.map(x => x.key).join(',')}（深渊光柱，已落地）、宇宙灵魂`);
await ev(() => { const d = drops.find(d => d.item && d.item.rar >= 5); cam.x = clamp(d.x - WW / 2, 0, game.room.x1 - WW); });   // 只移镜头：玩家站到掉落上会被自动拾取 / 宠物捡走，下一步就找不到了（负载高时偶发）
await wait(300); await shot('14-epic-pillar');
const pick = await ev(() => { const d = drops.find(d => d.item && d.item.rar >= 5), key = d.item.key, p = game.player; p.x = d.x; p.y = d.y; const n0 = window.__ann.length; const ok = tryPickup(game.player); return { ok, key, ann: window.__ann.slice(n0).find(a => a.kind === 'epic'), codex: !!save.data.codex[key], rec: save.data.codex[key] && save.data.codex[key].src }; });
check(pick.ok && pick.ann && pick.ann.abyss && pick.codex, `拾取深渊史诗：全服公告（abyss: true），图鉴登记（${pick.rec}）`);
await ev(() => { document.getElementById('abytreasure')?.remove(); game.dungeon.finish(); }); await wait(600);
check(await ev(() => menus.isOpen('result')), '通关结算');
await ev(() => { menus.close('result'); lootAll(); return goTown(); }); await wait(600);

/* ---------- 10. 刷新后数据仍在 ---------- */
step('刷新后数据仍在');
const before = await ev(() => { const w = inv.equip.weapon; w.dim = 'str'; w.enh = 7; w.forge = 3; save.write(); return { w: w.key, dim: w.dim, enh: w.enh, forge: w.forge, orb: w.orb && w.orb.key, bind: w.bind, codex: Object.keys(save.data.codex).length, abyss: save.data.abyss.runs, contra: inv.count('m_contra') }; });
await page.goto(`${URL_BASE}?town&cls=${cls}&mute`);
await page.waitForFunction(() => window.__READY && game.player && game.scene === 'town', null, { timeout: 30000 });
await wait(400);
const after = await ev(() => { inv.ensure(); const w = inv.equip.weapon; return { w: w.key, dim: w.dim, enh: w.enh, forge: w.forge, orb: w.orb && w.orb.key, bind: w.bind, codex: Object.keys(save.data.codex).length, abyss: save.data.abyss.runs, contra: inv.count('m_contra') }; });
check(JSON.stringify(after) === JSON.stringify(before), '刷新后 增幅 / 锻造 / 附魔 / 绑定 / 图鉴 / 深渊记录 / 材料 都在', JSON.stringify(after));

const errs = logs.filter(l => l.type === 'pageerror' || (l.type === 'error' && !/favicon|ERR_FILE/.test(l.text)));
check(!errs.length, '没有页面错误', errs.length ? errs[0].text.slice(0, 400) : '');
await browser.close();
console.log(fails ? `失败 ${fails} 项` : '全部通过');
process.exit(fails ? 1 : 0);
