// 31~60 区域的每日 / 支线 / 制霸链 / 里程碑（content/quests/regions.js）
//   Lv35 / Lv50 / Lv60（只做了主线）/ 满级老存档（和 tools/admin/maxout.mjs 一样把当时所有非每日任务标成完成，但那时还没有这批新任务）
//   进各区域城镇：NPC 头顶的 ! + 追踪栏的“可接取” → 接取 → 完成目标 → 交付拿奖励；制霸链不能一键完成；每日第二天重置；NPC 对话界面接 / 交一遍；自动前往指到 NPC / 地下城门口
import { launch, URL_BASE } from './lib.mjs';
import fs from 'fs';
const out = 'test/shots/quests60'; fs.mkdirSync(out, { recursive: true });
let fail = 0; const ok = (c, m, x = '') => { console.log(c ? '  ✓' : '  ✗', m, typeof x === 'string' ? x : JSON.stringify(x)); if (!c) fail++; };
const { browser, page, logs } = await launch({ width: 1280, height: 720 });
await page.goto(`${URL_BASE}?town&mute&cls=sword&fresh`); await page.waitForFunction(() => window.__READY); await page.waitForTimeout(800);
const closeAll = () => page.evaluate(() => { while (menus.stack.length) menus.close(menus.stack[menus.stack.length - 1]); });
await closeAll();
// 各区域：城镇场景（可接任务的 NPC 在这里）
const TOWNS = { darkelf: ['aferia_camp'], snow: ['storm_pass'], ancient: ['elvenguard', 'aferia_camp'], gent: ['heaven_gate', 'hendon_myre'], train: ['luft_port'], timegate: ['time_gate'], siroco: ['siroco_town'] };
const REG = Object.keys(TOWNS);
const NEW = await page.evaluate(REG => { const L = REG.flatMap(r => [...REGIONS[r].dailies, ...REGIONS[r].sides, ...REGIONS[r].tour]); return [...L, 'q_ms40', 'q_ms50', 'q_ms60']; }, REG);
ok(NEW.length >= 50, `新任务 ${NEW.length} 个`);

// 角色进度：L 级；mode = 'progress'（≤L 的非每日任务都做完）| 'main'（只做完主线）| 'maxed'（maxout.mjs 的做法）；新任务一律没有记录（老存档）
async function setup(L, mode) {
  await page.evaluate(({ L, mode, NEW }) => {
    window.toastMsg = () => {};
    const d = qdata(), N = new Set(NEW), cls = save.data.cls;
    d.quests = {}; d.questDone = {}; d.questTrack = []; d.titles = [];
    testLoadout(L); game.gold = 0;
    for (const id in QUESTS) { const q = QUESTS[id]; if (N.has(id) || q.type === 'daily' || (q.cls && q.cls !== cls) || q.lvl > L) continue; if (mode === 'main' && q.type !== 'main') continue; d.questDone[id] = Date.now(); }
    if (L >= 21) d.flags.awaken = true; if (L >= 26) d.flags.awaken2 = true; if (L >= 30) d.flags.awaken3 = true;
    questDirty();
  }, { L, mode, NEW });
}
const states = () => page.evaluate(NEW => Object.fromEntries(NEW.map(id => [id, questState(id)])), NEW);
// 进城：返回 NPC 标记 + 追踪栏
async function visit(scene) {
  await page.evaluate(s => enterScene(s), scene);
  await page.waitForFunction(s => world.S && world.S.id === s, scene, { timeout: 20000 });
  await page.waitForTimeout(500);
  return page.evaluate(() => {
    const npcs = world.S.npcs.map(n => n.npc);
    return { scene: world.S.id, marks: Object.fromEntries(npcs.map(n => [n, questMarker(n)])), track: questTownAvail().map(q => ({ id: q.id, npc: q.npc, here: npcs.includes(q.npc) })), rect: !!questUI.trackRect };
  });
}

/* ---------------- 1. Lv35：只有暗精灵的 ---------------- */
await setup(35, 'progress');
{
  const S = await states(), av = NEW.filter(id => S[id] === 'avail');
  const lv = await page.evaluate(av => av.map(id => QUESTS[id].lvl), av);
  ok(av.includes('d_de_spider') && av.includes('s_de_morgan') && av.includes('s_de_war'), 'Lv35：暗黑城的每日 / 支线可以接', av);
  ok(lv.every(l => l <= 35), 'Lv35：没有超过等级的任务', lv);
  const V = await visit('aferia_camp');
  ok(V.marks.bryce === '!' && V.marks.kurent === '!', '阿法利亚营地：布莱斯 / 克伦特头顶有 !', V.marks);
  ok(V.rect && V.track.length && V.track[0].here, '追踪栏：可接的每日 / 支线，这里的 NPC 排前面', V.track);
  await page.screenshot({ path: `${out}/01-lv35-aferia.png` });
}

/* ---------------- 2. Lv50：暗精灵 / 雪山 / 远古 / 根特 ---------------- */
await setup(50, 'progress');
{
  const S = await states(), av = NEW.filter(id => S[id] === 'avail');
  const byR = await page.evaluate(({ REG, av }) => Object.fromEntries(REG.map(r => [r, av.filter(id => [...REGIONS[r].dailies, ...REGIONS[r].sides, ...REGIONS[r].tour].includes(id)).length])), { REG, av });
  ok(byR.darkelf && byR.snow && byR.ancient && byR.gent && !byR.train && !byR.timegate && !byR.siroco, 'Lv50：暗精灵 / 雪山 / 远古 / 根特有可接的，海上列车以后的还没有', byR);
  ok(S.d_an_wail === 'avail' && S.d_gt_supply === 'avail' && S.r_sn1 === 'avail', 'Lv50：征服悲鸣洞穴 / 前线补给 / 万年雪山巡礼可接', { d_an_wail: S.d_an_wail, d_gt_supply: S.d_gt_supply, r_sn1: S.r_sn1 });
  const V = await visit('heaven_gate');
  ok(V.marks.kishika === '!' && V.rect && V.track[0] && V.track[0].npc === 'kishika', '天界之门：玛琳·基希卡头顶有 !，追踪栏第一个是她的任务', V);
}

/* ---------------- 3. Lv60：只做完主线（没做深渊资格） ---------------- */
await setup(60, 'main');
{
  const S = await states();
  ok(S.d_si_patrol === 'avail' && S.r_si1 === 'avail' && S.s_si_luxi === 'avail', 'Lv60 只做主线：幻界巡逻 / 魔界巡礼 / 卢克西的记忆可接', { d: S.d_si_patrol, r: S.r_si1, s: S.s_si_luxi });
  ok(S.d_si_abyss === 'locked' && S.r_de2 === 'locked', '需要深渊资格的（深渊的呼唤 / 制霸最后一步）先锁着', { d: S.d_si_abyss, r: S.r_de2 });
}

/* ---------------- 4. 满级老存档：每个区域城镇都能看到、接取、完成、交付 ---------------- */
await setup(60, 'maxed');
{
  const S = await states(), av = NEW.filter(id => S[id] === 'avail');
  const quick = await page.evaluate(() => questQuickList().map(q => q.id));
  ok(!quick.some(id => /^(r_|q_ms|d_)/.test(id)) && quick.some(id => /^s_/.test(id)), '一键完成：支线可以，制霸链 / 里程碑 / 每日不行', quick.filter(id => /^(r_|q_ms|d_)/.test(id)));
  ok(av.length >= 30, `满级老存档：新任务直接可接 ${av.length} 个`);
}
const gotAll = {};
for (const r of REG) {
  for (const scene of TOWNS[r]) {
    const V = await visit(scene);
    const mine = await page.evaluate(r => [...REGIONS[r].dailies, ...REGIONS[r].sides, ...REGIONS[r].tour], r);
    const givers = await page.evaluate(({ mine, npcs }) => [...new Set(mine.map(id => QUESTS[id].npc).filter(n => npcs.includes(n) && questsOfNpc(n).some(x => questState(x) === 'avail')))], { mine, npcs: Object.keys(V.marks) });
    ok(givers.length && givers.every(n => V.marks[n] === '!') && V.rect && V.track.length && V.track[0].here, `${r} · ${V.scene}：${givers.join('/')} 头顶有 !，追踪栏显示这里的任务`, { marks: V.marks, track: V.track.map(x => x.id) });
    if (r === 'darkelf') await page.screenshot({ path: `${out}/02-maxed-aferia.png` });
  }
  // 接取 → 目标 → 交付（按链的顺序；每个都检查奖励真的到手）
  const res = await page.evaluate(async r => {
    const R = REGIONS[r], ids = [...R.sides, ...R.tour, ...R.dailies], rows = [];
    for (const id of ids) {
      const q = QUESTS[id], s0 = questState(id);
      if (s0 !== 'avail') { rows.push({ id, s0 }); continue; }
      questAccept(id);
      q.goals.forEach((g, i) => {
        const dg = [].concat(g.dungeon || R.dungeons[0])[0];
        if (g.type === 'talk') bus.emit('npcTalk', { id: g.npc });
        else if (g.type === 'clear') for (let k = 0; k < g.n; k++) bus.emit('dungeonClear', { id: dg, diff: g.diff || 0, rank: 'S', time: 100, hurt: 0, maxCombo: 10 });
        else if (g.type === 'kill') for (let k = 0; k < g.n; k++) bus.emit('kill', { kind: [].concat(g.kind)[0], boss: !!g.boss, elite: !!g.elite, dungeon: dg, lvl: 60, x: 0, y: 0 });
        else if (g.type === 'collect') questProgress(id, i, g.n);
        else if (g.type === 'item') inv.add(makeItem(g.key, g.n));
      });
      const ready = questState(id) === 'ready', R0 = q.reward, g0 = game.gold, it0 = (R0.items || []).map(x => inv.count(x.key));
      const got = questComplete(id);
      const items = (R0.items || []).every((x, k) => !x.key || inv.count(x.key) >= it0[k] + x.n);
      const title = !R0.title || save.data.titles.includes(ITEMS[R0.title].name);
      rows.push({ id, s0, ready, done: questState(id) === 'done', gold: game.gold - g0 === R0.gold, items, title, n: got ? got.length : 0 });
    }
    return rows;
  }, r);
  const bad = res.filter(x => !(x.s0 === 'avail' && x.ready && x.done && x.gold && x.items && x.title));
  ok(!bad.length, `${r}：${res.length} 个任务全部 接取 → 完成 → 交付，金币 / 物品 / 称号到手`, bad);
  for (const x of res) gotAll[x.id] = x.done;
}
// 里程碑（赛丽亚）：制霸链全部完成后解锁
{
  const r = await page.evaluate(() => ['q_ms40', 'q_ms50', 'q_ms60'].map(id => { const s0 = questState(id); questAccept(id); const got = questComplete(id); return { id, s0, done: questState(id) === 'done', got: got && got.map(x => x.label).join('、') }; }));
  ok(r.every(x => x.s0 === 'avail' && x.done), '里程碑：百战精英 / 超越极限 / 破晓之巅 接取 → 交付', r);
  const t = await page.evaluate(() => ['title_rg_darkelf', 'title_rg_snow', 'title_rg_ancient', 'title_rg_gent', 'title_rg_train', 'title_rg_timegate', 'title_rg_siroco'].filter(k => inv.count(k) || save.data.titles.includes(ITEMS[k].name)).length);
  ok(t === 7, `7 个区域称号都拿到了（${t}）`);
}
// 每日：第二天重置
{
  const r = await page.evaluate(NEW => {
    const D = NEW.filter(id => QUESTS[id].type === 'daily'), before = D.filter(id => questState(id) === 'done').length, cera = cashData().today.daily;
    save.data.day = '2000-1-1'; save.daily();
    return { n: D.length, before, after: D.filter(id => questState(id) === 'avail').length, sides: NEW.filter(id => QUESTS[id].type === 'side' && questState(id) === 'done').length, cera, max: CASH_EARN.dailyMax };
  }, NEW);
  ok(r.cera === r.max, `每日任务的点券一天只算 ${r.max} 个（做了 ${r.n} 个，算了 ${r.cera} 个）`);
  ok(r.before === r.n && r.after === r.n, `每日 ${r.n} 个：今天做完，第二天全部可以再接`, r);
  ok(r.sides === NEW.length - r.n, '支线 / 制霸 / 里程碑不重置', r);
}

/* ---------------- 5. 界面：NPC 对话里接 / 交；自动前往 ---------------- */
await visit('aferia_camp');
{
  await closeAll();
  const open = () => page.evaluate(() => { const e = world.npcs.find(x => x.npc.id === 'bryce'); openNpc(e.npc); });
  await open(); await page.waitForTimeout(300);
  const listed = await page.evaluate(() => [...document.querySelectorAll('[data-win="npc"] .qitems > *')].map(x => x.textContent));
  ok(listed.some(t => t.includes('准备去熔岩穴')), '布莱斯的对话里列出「准备去熔岩穴」', listed);
  await page.evaluate(() => { const e = world.npcs.find(x => x.npc.id === 'bryce'); npcSet(e.npc, 'offer', 'd_de_spider'); menus.refresh('npc', e.npc); });
  if (await page.evaluate(() => npcUI.page < npcUI.pages.length - 1)) { await page.keyboard.press('Escape'); await page.waitForTimeout(300); }
  await page.click('[data-win="npc"] .btn:has-text("接受")'); await page.waitForTimeout(300);
  ok(await page.evaluate(() => questState('d_de_spider') === 'active'), '点“接受”：每日任务进行中');
  await closeAll(); await page.waitForTimeout(400);
  // 自动前往：进行中的收集任务 → 蜘蛛洞穴的门口
  const g = await page.evaluate(() => { guide.goTo('d_de_spider'); const t = guide.focus(); guide.auto = false; return t && { kind: t.kind, scene: t.scene, gate: t.gate }; });
  ok(g && g.kind === 'gate' && g.gate === 'spider_cave', '自动前往：指到蜘蛛洞穴的门口', g);
  await page.screenshot({ path: `${out}/03-track-active.png` });
  await page.evaluate(() => questProgress('d_de_spider', 0, 10));
  await open(); await page.waitForTimeout(300);
  if (await page.evaluate(() => npcUI.page < npcUI.pages.length - 1)) { await page.keyboard.press('Escape'); await page.waitForTimeout(300); }   // 只有一页时 Esc 会关窗口
  const g0 = await page.evaluate(() => game.gold);
  await page.click('[data-win="npc"] .btn:has-text("完成任务")'); await page.waitForTimeout(500);
  const fin = await page.evaluate(g0 => ({ st: questState('d_de_spider'), gold: game.gold - g0, popup: menus.isOpen('npcquest') }), g0);
  ok(fin.st === 'done' && fin.gold === 2500 && fin.popup, '点“完成任务”：交付，金币 +2500，弹出奖励', fin);
  await page.screenshot({ path: `${out}/04-turnin.png` });
  await closeAll();
  // 可接的任务：自动前往先去找发放人
  const g2 = await page.evaluate(() => { save.data.day = '2000-1-1'; save.daily(); guide.goTo('d_si_abyss'); const t = guide.focus(); guide.auto = false; guide.pin = null; return t && { kind: t.kind, scene: t.scene, npc: t.npc }; });
  ok(g2 && g2.kind === 'npc' && g2.npc === 'mira' && g2.scene === 'siroco_town', '自动前往（还没接）：去魔界找米拉', g2);
}
const errs = logs.filter(l => l.type === 'pageerror'); ok(!errs.length, '没有页面错误', errs.length ? errs[0].text.slice(0, 300) : '');
await browser.close();
console.log(fail ? `${fail} 项失败` : '全部通过'); process.exit(fail ? 1 : 0);
