// 以玩家视角把联机和新玩法走一遍（本机临时服务端，不连线上；1 个浏览器里 2 个玩家）：
// 注册 → 建角色 → 自己的名牌 → 好友（按用户名加） → 点玩家组队 → 组队刷图（双方键盘） → PK → 公会 → 成就 → 商城开箱 → 深渊派对 → 天帷巨兽 → 登出再登录
// 用法：node test/walk.mjs [步骤,逗号分隔，默认全部]
import fs from 'node:fs';
import { startServer, launchPlayers, sleep, until, uiRegister, uiLogin, uiCreateChar, dumpErrors } from './net_lib.mjs';
import { kbPlayer } from './kbplay.mjs';
const only = process.argv[2] ? new Set(process.argv[2].split(',')) : null, want = k => !only || only.has(k);
const out = 'test/shots/walk'; fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
const notes = [], note = m => { notes.push(m); console.log('  [问题] ' + m); };
let fails = 0; const ok = (c, m, x) => { console.log(`  ${c ? '✓' : '✗'} ${m}${x !== undefined && !c ? ' ' + JSON.stringify(x) : ''}`); if (!c) fails++; return !!c; };
const step = s => console.log('·', s);
const srv = await startServer();
const { players, close } = await launchPlayers(2);
const [A, B] = players.map(p => p.page);
const KA = kbPlayer(A, { out: out + '/alice' }), KB = kbPlayer(B, { out: out + '/bob' });
let n = 0; const shot = async (P, name) => { const f = `${out}/${String(++n).padStart(2, '0')}-${name}.png`; await P.screenshot({ path: f }); return f; };
const ev = (P, f, a) => P.evaluate(f, a);
async function goScene(P, K, target) {
  const path = await ev(P, t => { const from = world.S.id, prev = { [from]: null }, q = [from]; while (q.length) { const s = q.shift(); if (s === t) break; for (const ex of SCENES[s].exits) if (SCENES[ex.to] && !ex.locked && !(ex.minLv && game.lvl < ex.minLv) && !(ex.to in prev)) { prev[ex.to] = s; q.push(ex.to); } } if (!(t in prev)) return null; const p = []; for (let s = t; s !== from; s = prev[s]) p.unshift(s); return p; }, target);
  if (!path) { note(`走不到 ${target}`); return false; }
  for (const s of path) if (!(await K.exitTo(s))) return false;
  return true;
}
// 在画布上点另一个玩家（世界坐标 → 屏幕坐标）
async function clickPeer(P) {
  const xy = await ev(P, () => { const p = [...netTown.peers.values()][0]; if (!p) return null; const r = wcan.getBoundingClientRect(); return { x: r.left + (p.x - cam.x) / WW * r.width, y: r.top + (FLOOR_Y + p.y - 50) / WH * r.height }; });
  if (!xy) return false;
  await P.mouse.click(xy.x, xy.y); await sleep(400);
  return ev(P, () => menus.isOpen('pmenu'));
}
const fightBoth = (a, b) => Promise.all([KA.fightDungeon(a || {}), KB.fightDungeon(b || {})]);
try {
  step('1. 注册 / 建角色');
  await A.goto(srv.url + '?mute'); await A.waitForFunction(() => window.__READY); await sleep(600); await shot(A, 'title');
  ok(await uiRegister(A, srv.url, 'alice'), 'alice 在标题界面注册并登录'); await shot(A, 'after-register');
  ok(await uiRegister(B, srv.url, 'bob'), 'bob 注册');
  ok(await uiCreateChar(A, 0, '爱丽丝'), 'alice 建角色进城'); ok(await uiCreateChar(B, 1, '鲍勃'), 'bob 建角色进城');
  for (const P of [A, B]) await ev(P, () => { testLoadout(16); game.gold = 500000; save.write(); });
  await sleep(500); await shot(A, 'own-label-room');

  if (want('friend')) {
    step('2. 好友：左侧“好友”按钮 → 输入用户名加好友 → 对方同意');
    await KA.exitTo('elvenguard'); await KB.exitTo('elvenguard');
    await until(A, () => netTown.peers.size >= 1, null, 8000);
    // 自己的名牌：站到林纳斯跟前
    const ln = await KA.npcPos('linus'); await KA.walkTo(ln.x - 30, ln.y + 6); await sleep(400); await shot(A, 'own-label-npc');
    const fb = A.locator('#sxbar button', { hasText: '好友' });
    ok(await fb.count() === 1 && await fb.isVisible(), '左侧社交按钮条有“好友”');
    await fb.click(); await sleep(400); ok(await ev(A, () => menus.isOpen('friends')), '点“好友”打开好友窗口'); await shot(A, 'friends-win');
    await A.fill('[data-win="friends"] input.txt', 'bob'); await A.click('[data-win="friends"] button:has-text("加好友")'); await sleep(800);
    await shot(A, 'friends-sent');
    const asked = await until(B, () => menus.stack.some(n => n.startsWith('nd_freq')) || (netFriends.incoming || []).length > 0, null, 6000);
    ok(asked, 'bob 收到好友申请'); await shot(B, 'friend-request');
    const dot = await ev(B, () => { const b = [...document.querySelectorAll('#sxbar button')].find(x => x.textContent.includes('好友')); const g = b && b.querySelector('.badge'); return g && !g.hidden; });
    ok(dot, 'bob 的“好友”按钮上有红点');
    if (await B.locator('.netask button:has-text("同意")').count()) await B.click('.netask button:has-text("同意")');
    else { await B.click('#sxbar button:has-text("好友")'); await sleep(300); await B.click('[data-win="friends"] button:has-text("同意")'); }
    ok(await until(A, () => netFriends.list.some(f => f.name === 'bob'), null, 8000), 'alice 的好友列表里有 bob');
    await sleep(500); await shot(A, 'friends-done'); await ev(A, () => menus.closeAll()); await ev(B, () => menus.closeAll());
  }

  if (want('party')) {
    step('3. 组队：alice 在城镇里点 bob → 邀请组队 → bob 加入');
    await until(A, () => netTown.peers.size >= 1, null, 8000);
    const bx = await ev(B, () => game.player.x), ax = await ev(A, () => game.player.x);
    await KB.walkTo(ax + 120, 80); await sleep(800);
    ok(await clickPeer(A), '点 bob 的角色弹出玩家菜单'); await shot(A, 'pmenu');
    await A.click('.pmenu button:has-text("邀请组队")');
    ok(await until(B, () => menus.stack.some(n => n.startsWith('nd_pinv')), null, 6000), 'bob 收到组队邀请'); await shot(B, 'party-invite');
    await B.click('.netask button:has-text("加入队伍")');
    ok(await until(A, () => netParty.p && netParty.p.members.length === 2, null, 6000), '组队成功'); await sleep(500); await shot(A, 'party-hud');
    step('4. 组队刷图：队长走到洛兰门口进图，双方用键盘一起打');
    await KA.exitTo('gf_lorien'); await KB.exitTo('gf_lorien');
    await KA.toGate('lorien_deep'); await shot(A, 'party-gate'); await A.click('text=进入地下城');
    const inA = await until(A, () => game.scene === 'dungeon' && coop.state === 'play', null, 30000), inB = await until(B, () => game.scene === 'dungeon' && coop.state === 'play', null, 30000);
    ok(inA && inB, '全队一起进图'); await sleep(800); await shot(A, 'coop-a'); await shot(B, 'coop-b');
    const [ra, rb] = await fightBoth({ maxMs: 300000 }, { maxMs: 300000 });
    step(`组队结果：alice ${JSON.stringify(ra)} bob ${JSON.stringify(rb)}`);
    ok(ra.state === 'result' && rb.state === 'result', '双方都打到结算');
    await shot(A, 'coop-result-a'); await shot(B, 'coop-result-b');
    await Promise.all([KA.flipAndReturn(), KB.flipAndReturn()]).catch(e => note('结算翻牌 / 回城出错：' + e.message.split('\n')[0]));
    await sleep(800); await shot(A, 'coop-back');
  }

  if (want('pk')) {
    step('5. PK：alice 点 bob → 发起决斗 → bob 接受 → 双方键盘打');
    await ev(A, () => worldTravel('elvenguard')); await ev(B, () => worldTravel('elvenguard')); await sleep(1500);
    await until(A, () => netTown.peers.size >= 1, null, 8000);
    const ax = await ev(A, () => game.player.x); await KB.walkTo(ax + 120, 80); await sleep(800);
    ok(await clickPeer(A), '点 bob 弹出玩家菜单');
    await A.click('.pmenu button:has-text("发起决斗")');
    ok(await until(B, () => menus.isOpen('nd_duelask'), null, 6000), 'bob 收到决斗邀请'); await shot(B, 'duel-ask');
    await B.click('.netask button:has-text("接受决斗")');
    ok(await until(A, () => netDuel.state === 'fight', null, 25000) && await until(B, () => netDuel.state === 'fight', null, 25000), '双方进入决斗');
    await sleep(1200); await shot(A, 'duel-a'); await shot(B, 'duel-b');
    // 双方都朝对方走、按 X、偶尔放技能
    const brawl = async (P, K, me) => { const t0 = Date.now(); let k = 0; while (Date.now() - t0 < 240000) { const s = await ev(P, () => ({ st: netDuel.state, a: game.player && { x: game.player.x, y: game.player.y, f: game.player.face }, o: game.duel && (game.duel.a === game.player ? game.duel.b : game.duel.a) })).catch(() => null); if (!s || s.st !== 'fight' || !s.a || !s.o) { if (s && s.st !== 'fight' && s.st !== 'setup') break; await sleep(200); continue; } const dx = s.o.x - s.a.x, dy = s.o.y - s.a.y; if (Math.abs(dx) < 70 && Math.abs(dy) < 14) { await K.release(); await K.tap(++k % 6 === 0 ? 'KeyS' : 'KeyX', 45); } else { await K.hold([Math.abs(dx) > 50 ? (dx > 0 ? 'ArrowRight' : 'ArrowLeft') : null, Math.abs(dy) > 8 ? (dy > 0 ? 'ArrowDown' : 'ArrowUp') : null].filter(Boolean)); await sleep(60); } } await K.release(); };
    await Promise.all([brawl(A, KA, 'a'), brawl(B, KB, 'b')]);
    await sleep(1500); await shot(A, 'duel-end-a'); await shot(B, 'duel-end-b');
    const res = await ev(A, () => netDuel.result); step('决斗结果：' + JSON.stringify(res)); ok(!!res, '决斗打完有结果');
    ok(await until(A, () => game.scene === 'town', null, 20000) && await until(B, () => game.scene === 'town', null, 20000), '决斗后双方回到城镇');
    await sleep(800); await shot(A, 'duel-back');
  }

  if (want('guild')) {
    step('6. 公会：alice 按 J → 创建公会 → 点 bob 邀请 → bob 加入');
    await ev(A, () => menus.closeAll()); await KA.tap('KeyJ'); await sleep(600); ok(await ev(A, () => menus.isOpen('guild')), 'J 打开公会窗口'); await shot(A, 'guild-list');
    await A.click('.sxguild .itab:has-text("创建公会")'); await sleep(300);
    await A.fill('.sxguild input', '破晓测试团'); await A.click('.sxguild .bpick .gl:has-text("晓")').catch(() => {}); await shot(A, 'guild-create');
    await A.click('.sxguild button:has-text("创建")'); await sleep(200); await A.click('.idlg button:has-text("创建")'); await sleep(1500);
    ok(await until(A, () => typeof GD !== 'undefined' && GD.data && GD.data.guild, null, 8000), '公会创建成功'); await shot(A, 'guild-mine');
    await ev(A, () => menus.closeAll()); await sleep(300);
    ok(await clickPeer(A), '点 bob 弹出玩家菜单（带“邀请加入公会”）');
    const gi = A.locator('.pmenu button:has-text("邀请加入公会")');
    if (await gi.count()) await gi.click(); else note('玩家菜单里没有“邀请加入公会”');
    ok(await until(B, () => menus.isOpen('ask'), null, 6000), 'bob 收到公会邀请'); await shot(B, 'guild-invite');
    await B.click('.askwin button:has-text("加入")'); await sleep(1200);
    ok(await until(B, () => GD.data && GD.data.guild, null, 8000), 'bob 加入公会');
    await sleep(1500); await shot(A, 'guild-tags');
    await KB.tap('KeyJ'); await sleep(600); await shot(B, 'guild-bob'); await ev(B, () => menus.closeAll());
  }

  if (want('ach')) {
    step('7. 成就：按 U → 领取');
    await ev(A, () => menus.closeAll()); await KA.tap('KeyU'); await sleep(600); ok(await ev(A, () => menus.isOpen('achieve')), 'U 打开成就窗口'); await shot(A, 'ach');
    const c0 = await ev(A, () => typeof cashData === 'function' ? cashData().cera : null);
    const all = A.locator('[data-win="achieve"] button:has-text("一键领取")');
    if (await all.count() && !(await all.getAttribute('class')).includes('off')) { await all.click(); await sleep(800); }
    const c1 = await ev(A, () => typeof cashData === 'function' ? cashData().cera : null);
    step(`点券 ${c0} → ${c1}`); await shot(A, 'ach-claimed'); await ev(A, () => menus.closeAll());
  }

  if (want('shop')) {
    step('8. 商城：打开商城 → 魔盒 → 买下并打开');
    const cera = await ev(A, () => cashData().cera);
    if (cera < 300) { note(`点券只有 ${cera}，不够买魔盒（300）：用管理员发放点券继续`); await ev(A, () => { cashData().cera += 3000; save.write(); }); }
    await A.click('#menubar button[title="商城"]'); await sleep(800); ok(await ev(A, () => menus.isOpen('cash')), '点右下“商城”打开商城'); await shot(A, 'cash');
    await A.click('.cashwin .itab:has-text("魔盒")'); await sleep(400); await shot(A, 'cash-box-tab');
    const card = A.locator('.cashwin .ccard[data-pid]').first(); await card.click(); await sleep(300);
    const open = A.locator('.cashwin button:has-text("买下并打开")');
    if (await open.count()) { await open.click(); await sleep(400); if (await A.locator('.idlg').count()) await A.locator('.idlg .row .btn').last().click(); }
    else note('魔盒页没有“买下并打开”');
    ok(await until(A, () => menus.isOpen('boxopen'), null, 6000), '开箱动画窗口'); await sleep(1500); await shot(A, 'box-open'); await sleep(2500); await shot(A, 'box-result');
    await ev(A, () => menus.closeAll());
  }

  if (want('abyss')) {
    step('9. 深渊派对：歌兰蒂斯接资格任务 → 交任务拿邀请函 → 格拉卡的深渊门 → 进图');
    await ev(B, () => { if (netParty.p) net.send({ t: 'party:leave' }); }).catch(() => {});   // 深渊 / 天帷这里 alice 单刷
    await sleep(500);
    await goScene(A, KA, 'hendon_myre');
    ok(await KA.talk('grandis'), '和歌兰蒂斯对话'); await shot(A, 'grandis');
    if (await ev(A, () => npcUI.qid) !== 'q_abyss_gf') await KA.pickQuest('深渊派对的资格');
    step('资格任务：' + await KA.dialogTo(['接受'])); await ev(A, () => menus.closeAll());
    // 跳过：资格任务的目标是“通关烈焰格拉卡”（转职试炼已经实测过这张图），这里直接记为通关
    await ev(A, () => bus.emit('dungeonClear', { id: 'blazing_graca', diff: 0, rank: 'A', time: 200, hurt: 20 }));
    ok(await KA.talk('grandis'), '回来和歌兰蒂斯对话');
    step('交资格任务：' + await KA.dialogTo(['完成任务'])); await sleep(500); await shot(A, 'abyss-reward');
    if (await ev(A, () => menus.isOpen('npcquest'))) { await KA.tap('KeyX'); await sleep(300); }
    await ev(A, () => menus.closeAll());
    step('邀请函：' + await ev(A, () => inv.count('abyss_ticket')));
    await goScene(A, KA, 'gf_graca'); await sleep(500);
    const gx = await ev(A, () => world.S.gates.find(g => g.dungeon === 'abyss_gf').x); await KA.walkTo(gx + 160, 60); await sleep(1200); await shot(A, 'abyss-gate-reveal'); await sleep(2000);
    ok(await KA.toGate('abyss_gf'), '深渊门口弹出地下城选择'); await shot(A, 'abyss-select');
    await KA.enterDungeon();
    const r = await KA.fightDungeon({ maxMs: 420000, onRoom: async s => { if (s.d.boss) await shot(A, 'abyss-boss'); } });
    step('深渊派对：' + JSON.stringify(r)); ok(r.state === 'result', '深渊派对通关');
    if (r.state === 'result') { await shot(A, 'abyss-result'); await KA.flipAndReturn(); }
  }

  if (want('behemoth')) {
    step('10. 天帷巨兽：Lv.26 → 西海岸坐船 → 神殿之路 → 进图');
    await ev(A, () => { testLoadout(26); save.write(); });
    ok(await goScene(A, KA, 'behemoth'), '走到天帷巨兽 · 神殿之路'); await sleep(800); await shot(A, 'behemoth-field');
    ok(await KA.toGate('temple_outskirts'), '神殿外围门口弹窗'); await shot(A, 'behemoth-gate');
    await KA.enterDungeon(); await sleep(800); await shot(A, 'behemoth-in');
    const r = await KA.fightDungeon({ maxMs: 420000, onRoom: async s => { if (s.d.boss) await shot(A, 'behemoth-boss'); } });
    step('神殿外围：' + JSON.stringify(r)); ok(r.state === 'result', '神殿外围通关');
    if (r.state === 'result') { await shot(A, 'behemoth-result'); await KA.flipAndReturn(); }
  }

  if (want('relogin')) {
    step('11. 登出再登录：系统菜单 → 登出 → 标题登录 → 角色还在');
    await ev(A, () => menus.closeAll()); await KA.tap('Escape'); await sleep(400); await shot(A, 'sysmenu');
    const lo = A.locator('.sysmenu button:has-text("登出账号")'); if (await lo.count()) { await lo.click(); await sleep(400); if (await A.locator('.askwin').count()) await A.click('.askwin .btn:not(.blue)'); } else note('系统菜单里没有“登出”');
    await sleep(1500); await shot(A, 'after-logout');
    ok(await uiLogin(A, srv.url, 'alice'), '重新登录');
    await sleep(800); await A.click('text=进入游戏').catch(() => {}); await sleep(800); await shot(A, 'charselect-cloud');
    ok(await ev(A, () => save.chars.some(c => c.name === '爱丽丝')), '云存档里角色还在');
  }
} catch (e) { note('脚本异常：' + e.message.split('\n')[0]); await shot(A, 'crash-a').catch(() => {}); await shot(B, 'crash-b').catch(() => {}); fails++; }
const errs = dumpErrors(players);
console.log('\n问题：'); for (const x of [...notes, ...KA.notes, ...KB.notes]) console.log(' -', x);
console.log('页面报错：', errs.slice(0, 10));
await close(); await srv.stop();
console.log(fails || errs.length ? `\n失败 ${fails} 项，报错 ${errs.length} 条` : '\n全部通过');
process.exit(fails || errs.length ? 1 : 0);
