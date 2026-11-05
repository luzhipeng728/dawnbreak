// Issue #4：尼尔巴斯护送对象卡深渊、第二波权重与房间池、复活上限显示、图鉴跨分类搜索回归。
// 用法：node test/issue4.mjs；加 --coop 同时检查两个真实客户端的联机清场同步。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { launch, URL_BASE } from './lib.mjs';
const out = 'test/shots/issue4'; fs.mkdirSync(out, { recursive: true });
const { browser, page, logs } = await launch();
let n = 0;
const check = (v, msg) => { assert.ok(v, msg); n++; console.log('✓ ' + msg); };
const killWave = () => page.evaluate(() => {
  for (const e of [...ents]) if (e.team === 'e' && !e.dead && e !== game.dungeon.abyssRun.block && !e.msProtect) { e.invul = 0; e.hp = 0; killEnt(e, game.player, {}); }
});
try {
  await page.goto(`${URL_BASE}?dungeon=abyss_timegate&lv=60&bot&abyssLord=nilbas&mute&offline`);
  await page.waitForFunction(() => window.__READY && game.dungeon);
  await page.evaluate(() => { bot.on = false; game.player.invul = 1e9; game.dungeon.enter(game.dungeon.abyssRoom, 'left'); });
  await killWave();
  await page.waitForFunction(() => game.dungeon.abyssRun.round === 1);
  await killWave();
  await page.waitForFunction(() => game.dungeon.abyssRun.round === 2);
  check(await page.evaluate(() => ents.some(e => e.kind === 'graciaAcolyte' && !e.dead && e.invul > 1000)), '复现真实时空深渊：尼尔巴斯护送草人仍存活且无敌');
  await killWave();
  await page.waitForFunction(() => game.dungeon.abyssRun.phase === 'done' && game.dungeon.doorsOpen, null, { timeout: 4000 });
  check(await page.evaluate(() => !ents.some(e => e.kind === 'graciaAcolyte' && !e.dead && !e.remove) && game.dungeon.abyssRun.block.dead), '先击杀尼尔巴斯：草人清理、深渊奖励出现、隐形挡板移除并开门');
  await page.screenshot({ path: `${out}/abyss-clear.png` });
  await page.evaluate(() => { if (menus.isOpen('abytreasure')) menus.close('abytreasure'); });
  check(await page.evaluate(() => {
    const dg = game.dungeon, next = Object.values(dg.room.doors)[0]; if (!next) return false;
    dg.enter(next, 'left'); return dg.room === next;
  }), '清场后可进入下一房间');
  check(await page.evaluate(() => {
    const m = spawnMonster('nilbas', 500, 80, { boss: true, lvl: 60 });
    const st = m.msMechs.find(s => s.id === 'protect'); st.p.keep = true;
    m.remove = true; updateGroundFx(1 / 60);
    return st.ended && st.obj.remove && !st.res;
  }), '领主离场兜底清理护送对象，包括 keep 对象，不触发成功或失败奖励');
  check(await page.evaluate(() => {
    const m = spawnMonster('nilbas', 500, 80, { boss: true, lvl: 60 });
    const st = m.msMechs.find(s => s.id === 'protect');
    msHide(m, true); updateGroundFx(1 / 60);
    if (st.ended || st.obj.remove) return false;
    m.dead = true; updateGroundFx(1 / 60);
    return st.ended && st.obj.remove;
  }), '正常隐藏阶段保留护送机制，隐藏期间死亡仍清理');
  check(await page.evaluate(() => {
    const m = spawnMonster('nilbas', 500, 80, { boss: true, lvl: 60 });
    const st = m.msMechs.find(s => s.id === 'protect');
    msProtectArrive(m, st, st.p); msMechUpdate(m, 1 / 60); m.remove = true;
    return st.ended && st.res === 'solve' && st.obj.remove;
  }), '正常护送抵达仍按成功结束');
  check(await page.evaluate(() => {
    for (let i = 0; i < 1000; i++) if (dungeonMob([['nilbas', 0], ['goblin', 1]], () => i / 1000) !== 'goblin') return false;
    return dungeonMob([['nilbas', 0]]) === null;
  }), '权重零领主绝不进入普通刷怪池，空池不回退到领主');
  check(await page.evaluate(() => {
    const dg = game.dungeon, p = game.player;
    ents.splice(0, ents.length, p); p.dead = false; dg.state = 'play'; dg.guest = false;
    dg.room.cleared = false; dg.room.type = 'normal'; dg.doorsOpen = false;
    dg.waves = [{ n: 50, o: { lvl: 10 }, pool: [['nilbas', 0], ['goblin', 1]] }];
    dg.update(1 / 60);
    const mobs = ents.filter(e => e.team === 'e');
    return mobs.length === 50 && mobs.every(e => e.kind === 'goblin');
  }), '真实第二波增援只使用当前房间正权重怪物池');
  check(await page.evaluate(() => {
    const before = { S: raidNet.S, def: raidNet.def, phase: raidNet.phase, limits: raidNet.limits };
    try {
      raidNet.S = { st: 'final', mode: 'normal', nTeams: 2, lives: 6, members: [], deadline: 0 };
      raidNet.limits = null; raidNet.def = () => ({ lives: { normal: nt => 3 * nt, guide: 3 } }); raidNet.phase = () => null;
      if (!raidUi.top().textContent.includes('6/6')) return false;
      raidNet.S.nTeams = 4; raidNet.S.lives = 12;
      if (!raidUi.top().textContent.includes('12/12')) return false;
      raidNet.S.mode = 'guide'; raidNet.S.lives = 3;
      return raidUi.top().textContent.includes('3/3');
    } finally { Object.assign(raidNet, before); }
  }), '复活上限函数按队伍数求值，兼容引导模式常数配置');
  await page.goto(`${URL_BASE}?town&lv=60&cls=sword&mute&offline`);
  await page.waitForFunction(() => window.__READY && game.player);
  const search = await page.evaluate(() => {
    while (menus.stack.length) menus.close(menus.stack.at(-1));
    menus.open('codex');
    const k = codexKeys('epicset').find(k => ITEMS[k].set && SETS[ITEMS[k].set]);
    return { key: k, set: SETS[ITEMS[k].set].name, name: ITEMS[k].name };
  });
  await page.getByPlaceholder('搜索装备名称 / 套装名称（跨分类）').fill(search.set);
  check(await page.evaluate(k => document.querySelectorAll('.codexwin .igrid .islot').length > 0 && document.querySelector('.codexwin').textContent.includes('搜索结果') && codexKeys('weapon').includes(k) === false, search.key), '从武器分类按套装名跨分类搜索');
  await page.locator('.codexwin .igrid .islot').first().click();
  check(await page.locator('.codexwin .cdet').innerText().then(t => t.includes('获取途径') || t.includes('获得于')), '搜索结果保留属性详情与获取途径');
  await page.getByPlaceholder('搜索装备名称 / 套装名称（跨分类）').fill('不存在的装备xyz');
  check(await page.locator('.codexwin').innerText().then(t => t.includes('没有匹配的装备')), '搜索无匹配时明确提示');
  await page.getByPlaceholder('搜索装备名称 / 套装名称（跨分类）').fill('');
  check(await page.locator('.codexwin .igrid .islot').count() > 0, '清空搜索恢复当前分类');
  check(!logs.some(l => l.type === 'pageerror'), '页面没有运行异常');
  console.log(`${n} 项 issue #4 回归检查通过`);
} catch (e) {
  await page.screenshot({ path: `${out}/failure.png` }).catch(() => {}); throw e;
} finally { await browser.close(); }

if (process.argv.includes('--coop')) {
  const { startServer, launchPlayers, uiRegister, uiCreateChar } = await import('./net_lib.mjs');
  const srv = await startServer({ static: fileURLToPath(new URL('../dist/web', import.meta.url)) });
  let session;
  try {
    session = await launchPlayers(2);
    const [H, G] = session.players.map(p => p.page);
    for (const [i, P] of [H, G].entries()) {
      check(await uiRegister(P, srv.url, i ? 'issueguest' : 'issuehost'), '联机玩家注册');
      check(await uiCreateChar(P, 0), '联机玩家创建角色');
      await P.evaluate(() => { testLoadout(60); inv.add(makeItem('abyss_ticket', 5)); save.data.fatigue = 156; save.data.questDone[DUNGEONS.abyss_timegate.unlock.quest] = Date.now(); save.write(); game.player.invul = 1e9; });
    }
    await H.evaluate(() => netPartyInvite(null, 'issueguest'));
    await G.locator('.netask button').filter({ hasText: '加入队伍' }).click();
    await H.waitForFunction(() => netParty.p?.members.length === 2);
    await H.evaluate(() => worldTravel('tg_past_b'));
    await H.waitForFunction(() => game.scene === 'town' && world.S.id === 'tg_past_b');
    await H.evaluate(() => enterDungeon('abyss_timegate', 0));
    for (const P of [H, G]) await P.waitForFunction(() => coop.state === 'play' && game.dungeon?.abyssRoom, null, { timeout: 60000 });
    await H.evaluate(() => { game.dungeon.def.abyssLord = 'nilbas'; });
    const route = await H.evaluate(() => {
      const dg = game.dungeon, prev = new Map([[dg.room, null]]), q = [dg.room];
      for (let i = 0; i < q.length && q[i] !== dg.abyssRoom; i++) for (const [dir, r] of Object.entries(q[i].doors)) if (!prev.has(r) && r.type !== 'boss') { prev.set(r, { room: q[i], dir }); q.push(r); }
      const dirs = []; for (let r = dg.abyssRoom; prev.get(r); r = prev.get(r).room) dirs.unshift(prev.get(r).dir); return dirs;
    });
    for (const dir of route) {
      await H.waitForFunction(() => {
        const dg = game.dungeon; if (dg.transition) return false;
        for (const e of [...ents]) if (e.team === 'e' && !e.dead) { e.invul = 0; e.hp = 0; killEnt(e, game.player, {}); }
        return dg.doorsOpen;
      });
      await H.evaluate(dir => game.dungeon.go(dir), dir);
      await H.waitForFunction(() => !game.dungeon.transition);
    }
    for (const P of [H, G]) await P.waitForFunction(() => game.dungeon.room === game.dungeon.abyssRoom && !game.dungeon.transition);
    const clear = () => H.evaluate(() => {
      for (const e of [...ents]) if (e.team === 'e' && !e.dead && e !== game.dungeon.abyssRun.block && !e.msProtect) { e.invul = 0; e.hp = 0; killEnt(e, game.player, {}); }
    });
    await clear(); await H.waitForFunction(() => game.dungeon.abyssRun.round === 1);
    await clear(); await H.waitForFunction(() => game.dungeon.abyssRun.round === 2);
    await G.waitForFunction(() => ents.some(e => e.kind === 'graciaAcolyte' && !e.dead));
    check(true, '联机队员看到尼尔巴斯护送草人');
    await clear();
    await H.waitForFunction(() => game.dungeon.abyssRun.phase === 'done' && game.dungeon.doorsOpen);
    await G.waitForFunction(() => !ents.some(e => e.kind === 'graciaAcolyte' && !e.dead && !e.remove) && game.dungeon.doorsOpen, null, { timeout: 10000 });
    check(true, '两人联机：主机击杀尼尔巴斯后双方清理草人并开门');
    check(session.players.every(p => !p.logs.some(e => e.type === 'pageerror')), '两人联机没有页面异常');
    console.log(`${n} 项 issue #4 检查通过（含两人联机）`);
  } finally { if (session) await session.close(); await srv.stop(); }
}
