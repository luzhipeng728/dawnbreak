// 世界测试：内容校验 → 每个场景截图（素材齐全、不黑屏、有路人）→ 走遍所有出口并走回来 → 锁住的路 / 等级限制 → 所有 NPC 可对话
//          → 世界地图打开与区域移动 → 隐藏门现身特效 → 城镇曲目有声音
// 用法：node test/world.mjs（WEB=1 测网页版分包加载）；截图在 test/shots/world/
import { launch, URL_BASE, imageStats } from './lib.mjs';
import fs from 'fs';
const out = 'test/shots/world'; fs.mkdirSync(out, { recursive: true });
const { browser, page, logs } = await launch({ width: 1280, height: 720 });
const wait = ms => page.waitForTimeout(ms), shot = n => page.screenshot({ path: `${out}/${n}.png` });
const fails = [], ok = (cond, msg) => { if (!cond) fails.push(msg); console.log(cond ? '  ✓' : '  ✗', msg); };
const closeAll = () => page.evaluate(() => { while (menus.stack.length) menus.close(menus.stack[menus.stack.length - 1]); });
const enter = (id, spawn) => page.evaluate(([id, spawn]) => enterScene(id, spawn), [id, spawn]).then(() => page.waitForFunction(id => world && world.S.id === id, id, { timeout: 15000 }));

await page.goto(`${URL_BASE}?town&cls=sword&mute`);
await page.waitForFunction(() => window.__READY, null, { timeout: 30000 });
await closeAll();
console.log('· 内容校验');
const problems = await page.evaluate(() => validateWorld());
ok(problems.length === 0, `validateWorld 没有问题（${problems.length} 条）${problems.length ? '：' + problems.join('；') : ''}`);
const info = await page.evaluate(() => ({ start: START_SCENE, at: world.S.id, scenes: Object.keys(SCENES), npcs: Object.keys(NPCS).length }));
ok(info.at === info.start, `新角色出生在 ${info.start}（实际 ${info.at}）`);
console.log(`  ${info.scenes.length} 个场景、${info.npcs} 个 NPC`);
await page.evaluate(() => { game.lvl = MAX_LVL; });   // 满级：天帷巨兽的出口要 Lv.24 / 27

console.log('· 每个场景截图');
for (const id of info.scenes) {
  await enter(id); await wait(900); await closeAll();
  const r = await page.evaluate(() => {
    const S = world.S, miss = [];
    for (const k of [`bg/${S.theme}_far`, `bg/${S.theme}_floor`]) if (!IMG[k]) miss.push(k);
    for (const pr of S.props) if (!IMG[pr.art]) miss.push(pr.art);
    for (const n of S.npcs) if (!IMG[NPCS[n.npc].art]) miss.push(NPCS[n.npc].art);
    for (const g of S.gates) { const a = gateArt(DUNGEONS[g.dungeon]).art; if (!IMG[a]) miss.push(a); }
    return { miss, crowd: world.crowd.length, want: crowdSize(S), banner: !!world.banner, npcs: world.npcs.length };
  });
  // 镜头移到场景中间再拍一张（看到更多建筑）
  await page.evaluate(() => { game.player.x = world.S.width / 2; game.player.y = 120; });
  await wait(700);
  const buf = await page.screenshot({ path: `${out}/scene-${id}.png` }), st = await imageStats(page, buf);
  ok(!r.miss.length, `${id}：素材齐全${r.miss.length ? '，缺 ' + r.miss.join(',') : ''}`);
  ok(st.mean > 0.12 && st.std > 0.08, `${id}：画面正常（亮度 ${st.mean}，对比 ${st.std}）`);
  ok(r.crowd === r.want, `${id}：路人 ${r.crowd}/${r.want}`);
}

console.log('· 走遍所有出口并走回来');
const edges = await page.evaluate(() => { const L = []; for (const id in SCENES) for (const ex of SCENES[id].exits) L.push({ from: id, to: ex.to || null, side: ex.side, x: ex.x ?? null, locked: ex.locked || (SCENES[ex.to] ? null : `${ex.to}（还没加载，按未开放处理）`), minLv: SCENES[ex.to] ? ex.minLv || 0 : 0 }); return L; });
// 按出口的方向把玩家放到出口前，按住对应方向键走过去
async function walkThrough(sceneId, ex) {
  await page.evaluate(([ex]) => {
    const p = game.player, W = world.S.width; world.exitLock = 0;
    if (ex.side === 'left') { p.x = 70; p.y = 100; } else if (ex.side === 'right') { p.x = W - 70; p.y = 100; }
    else if (ex.side === 'up') { p.x = ex.x; p.y = 24; } else { p.x = ex.x; p.y = DEPTH - 24; }
  }, [ex]);
  const k = { left: 'ArrowLeft', right: 'ArrowRight', up: 'ArrowUp', down: 'ArrowDown' }[ex.side];
  await page.evaluate(() => { window.__arr = null; });
  await page.keyboard.down(k);
  await page.waitForFunction(() => window.__arr, null, { timeout: 1500 }).catch(() => {});   // 一到新场景就松开方向键
  await page.keyboard.up(k);
  await wait(400);
}
// 进入场景那一刻玩家站的位置（按住方向键时会继续往前走，所以在 sceneEnter 时记下来）
await page.evaluate(() => bus.on('sceneEnter', () => { window.__arr = { id: world.S.id, x: game.player.x, y: game.player.y }; }));
for (const e of edges.filter(e => !e.locked)) {
  await enter(e.from); await closeAll(); await wait(200);
  await walkThrough(e.from, e);
  const arrived = await page.waitForFunction(to => world.S.id === to, e.to, { timeout: 6000 }).then(() => true, () => false);
  const at = await page.evaluate(() => ({ id: world.S.id, x: Math.round(game.player.x), y: Math.round(game.player.y) }));
  ok(arrived, `${e.from} —${e.side}→ ${e.to}（到达 ${at.id} @${at.x},${at.y}）`);
  if (!arrived) continue;
  // 回程：新场景里指回来源的出口
  const back = await page.evaluate(from => { const ex = world.S.exits.find(x => x.to === from); return ex ? { side: ex.side, x: ex.x ?? null } : null; }, e.from);
  ok(!!back, `${e.to} 有回到 ${e.from} 的出口`);
  if (!back) continue;
  const near = await page.evaluate(b => { const p = window.__arr, W = world.S.width; return b.side === 'left' ? p.x < 200 : b.side === 'right' ? p.x > W - 200 : Math.abs(p.x - b.x) < 80; }, back);
  ok(near, `${e.to}：出现在回 ${e.from} 的出口旁（${JSON.stringify(await page.evaluate(() => ({ x: Math.round(window.__arr.x), y: Math.round(window.__arr.y) })))}）`);
  await closeAll(); await wait(300);
  await walkThrough(e.to, back);
  const returned = await page.waitForFunction(to => world.S.id === to, e.from, { timeout: 6000 }).then(() => true, () => false);
  ok(returned, `${e.to} —${back.side}→ ${e.from}（走回来）`);
}
console.log('· 锁住的路 / 等级限制');
for (const e of edges.filter(e => e.locked)) {
  await enter(e.from); await closeAll(); await wait(200);
  await walkThrough(e.from, e); await wait(300);
  const at = await page.evaluate(() => world.S.id);
  ok(at === e.from, `${e.from} 的「${e.locked.slice(0, 12)}…」不能通过`);
}
for (const e of edges.filter(e => e.minLv)) {
  await page.evaluate(() => { game.lvl = 1; });
  await enter(e.from); await closeAll(); await wait(200);
  await walkThrough(e.from, e); await wait(300);
  ok(await page.evaluate(() => world.S.id) === e.from, `${e.from} → ${e.to} 在 Lv.1 时被拦住（需要 Lv.${e.minLv}）`);
  await shot(`minlv-${e.from}`);
  await page.evaluate(() => { game.lvl = MAX_LVL; });
}

console.log('· 所有 NPC 可对话');
for (const id of info.scenes) {
  const npcs = await page.evaluate(id => SCENES[id].npcs.map(n => n.npc), id);
  if (!npcs.length) continue;
  await enter(id); await closeAll(); await wait(300);
  for (const n of npcs) {
    await page.evaluate(n => { const e = world.npcs.find(x => x.npc.id === n); game.player.x = e.x - 40; game.player.y = e.y; world.exitLock = 1; }, n);
    await wait(150); await page.keyboard.down('KeyX'); await wait(60); await page.keyboard.up('KeyX'); await wait(350);
    const r = await page.evaluate(() => ({ open: menus.isOpen('npc'), img: !!document.querySelector('.npcpt[src], img.npcpt'), txt: (document.querySelector('.win') || {}).innerText || '' }));
    ok(r.open, `${id} / ${n}：对话窗口打开`);
    if (n === npcs[0]) await shot(`npc-${id}-${n}`);
    await closeAll();
  }
}

console.log('· 世界地图');
await enter('elvenguard'); await closeAll(); await wait(300);
await page.keyboard.down('KeyN'); await wait(60); await page.keyboard.up('KeyN'); await wait(400);   // N 键（界面组 KEYMAP 的 map）
const wm = await page.evaluate(() => ({ open: menus.isOpen('worldmap'), nodes: document.querySelectorAll('.wm-node').length, here: (document.querySelector('.wm-node.here') || {}).dataset?.id }));
ok(wm.open, '世界地图能打开');
ok(wm.nodes === info.scenes.length, `世界地图画出了全部 ${info.scenes.length} 个地点（${wm.nodes}）`);
ok(wm.here === 'elvenguard', `当前位置标在 elvenguard（${wm.here}）`);
await shot('worldmap');
await page.click('.wm-node[data-id="hm_plaza"]'); await wait(300);
await shot('worldmap-plaza');
await page.click('.wm-go .btn'); await wait(1500);
ok(await page.evaluate(() => world.S.id) === 'hm_plaza', '世界地图区域移动到中央广场');
await shot('travel-arrive');
// 区域移动没有前置：区域地图里按 N 也能传送
await enter('gf_forest'); await closeAll(); await wait(300);
await page.keyboard.down('KeyN'); await wait(60); await page.keyboard.up('KeyN'); await wait(300);
await page.click('.wm-node[data-id="elvenguard"]'); await wait(300);
ok(await page.evaluate(() => !!document.querySelector('.wm-go .btn:not(.off)')), '区域地图里按 N 打开也能传送');
await closeAll();
await enter('hm_plaza'); await closeAll(); await wait(300);
await page.evaluate(() => { const e = world.npcs.find(x => x.npc.id === 'nuoyu'); game.player.x = e.x - 40; game.player.y = e.y; }); await wait(200);
await page.keyboard.down('KeyX'); await wait(60); await page.keyboard.up('KeyX'); await wait(350);
const hasTravel = await page.evaluate(() => [...document.querySelectorAll('button')].some(b => b.textContent.includes('区域移动')));
ok(hasTravel, '诺羽有「区域移动」按钮');
if (hasTravel) {
  await page.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent.includes('区域移动')).click()); await wait(400);
  ok(await page.evaluate(() => menus.isOpen('worldmap')), '诺羽打开区域移动地图');
  await page.click('.wm-node[data-id="west_coast"]'); await wait(300); await page.click('.wm-go .btn'); await wait(1500);
  ok(await page.evaluate(() => world.S.id) === 'west_coast', '诺羽区域移动到西海岸');
}
await closeAll();
{
  const r = await page.evaluate(() => { save.data.seen = {}; const far = Object.keys(SCENES).filter(id => SCENES[id].kind === 'town' && id !== world.S.id).map(id => [id, travelBlocked(id, {})]); return far; });
  ok(r.length && r.every(([, w]) => w === ''), '区域移动没有前置：没去过 / 不用 NPC 也能传到任何城镇', JSON.stringify(r.filter(([, w]) => w)));
}

console.log('· 隐藏地下城的门现身');
await page.evaluate(() => { (save.data.questDone ??= {}).q_hidden_frozen = true; save.data.hiddenSeen = {}; });
await enter('gf_forest', { x: 2500, y: 90 }); await wait(600);
ok(await page.evaluate(() => !world.fx.some(f => f.type === 'reveal') && !save.data.hiddenSeen.frozen_woods), '门在画面外时先不播现身特效（等玩家走到能看见的地方）');
await enter('gf_forest', { x: 700, y: 90 }); await wait(700); await shot('hidden-reveal');
const rv = await page.evaluate(() => world.fx.some(f => f.type === 'reveal'));
ok(rv, '冰霜幽暗密林的门播放现身特效');
await wait(2600);
ok(await page.evaluate(() => !!save.data.hiddenSeen.frozen_woods), '现身后记录为已出现（只播一次）');
await shot('hidden-after');
// 现身特效还没播完就离开（进地下城会清空 game.timers）：回来时不能再播一次、再提示一次
await page.evaluate(() => { save.data.hiddenSeen = {}; toastList.length = 0; });
await enter('gf_forest', { x: 700, y: 90 }); await wait(300);
await page.evaluate(() => { game.timers.length = 0; });   // 模拟 Dungeon.start()
await enter('gf_thunder'); await wait(200); await enter('gf_forest', { x: 700, y: 90 }); await wait(300);
const again = await page.evaluate(() => ({ fx: world.fx.some(f => f.type === 'reveal'), toasts: toastList.filter(m => m.msg.includes('冰霜幽暗密林')).length }));
ok(!again.fx && again.toasts === 1, `现身途中离开再回来不会重播（重播 ${again.fx}，提示 ${again.toasts} 条）`);

console.log('· 返回门口');
await page.evaluate(() => { save.data.loc = { scene: 'gf_thunder', x: 1360, y: 34 }; });
await page.evaluate(() => goTown()); await wait(1200);
const g = await page.evaluate(() => ({ id: world.S.id, x: Math.round(game.player.x), lock: world.gateLock && world.gateLock.dungeon, win: menus.stack.join(',') }));
ok(g.id === 'gf_thunder' && Math.abs(g.x - 1360) < 5 && !g.win, `从地下城回来站在门口且不弹窗（${JSON.stringify(g)}）`);

console.log('· 城镇曲目');
const page2 = await browser.newPage({ viewport: { width: 960, height: 540 } });
await page2.goto(`${URL_BASE}?test&mobs=0`); await page2.waitForFunction(() => window.__READY); await page2.mouse.click(400, 300); await page2.waitForTimeout(300);
for (const name of ['seria', 'town', 'hendon', 'backstreet', 'westcoast', 'guild', 'sky', 'field']) {
  await page2.evaluate(n => music.play(n), name); await page2.waitForTimeout(1300);
  const r = await page2.evaluate(async () => { const a = sfx.analyser, buf = new Float32Array(a.fftSize); let sum = 0, peak = 0; for (let i = 0; i < 30; i++) { a.getFloatTimeDomainData(buf); let s = 0; for (const v of buf) { s += v * v; peak = Math.max(peak, Math.abs(v)); } sum += Math.sqrt(s / buf.length); await new Promise(r => setTimeout(r, 50)); } return { rms: +(sum / 30).toFixed(4), peak: +peak.toFixed(3) }; });
  ok(r.rms > 0.004 && r.peak < 1, `曲目 ${name}：rms ${r.rms}，峰值 ${r.peak}`);
}
await page2.close();

const errs = logs.filter(l => l.type !== 'warning');
ok(!errs.length, `没有报错${errs.length ? '：' + JSON.stringify(errs.slice(0, 5)) : ''}`);
console.log(fails.length ? `\n失败 ${fails.length} 项：\n- ${fails.join('\n- ')}` : '\n全部通过');
await browser.close();
process.exit(fails.length ? 1 : 0);
