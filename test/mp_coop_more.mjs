// 联机：组队刷图的手感与规则（2 个玩家，默认模拟 80ms 下行延迟）
// 1) 队员打浮空：本地立刻飞起（不等快照），落地后不会被“晚一拍的快照”再浮空一次，最后和主机位置对齐
// 2) 队员抓取：主机那边怪物挂到队员身上（被抓状态），放开后恢复；主机判定抓不住时队员这边也放开
// 3) 自带 AI 的怪（龙之雕像）：在全队里选目标，队员那边用同一个 AI 出招（能打到队员）
// 4) 深渊进图被取消：队长和队员扣掉的邀请函都退还；深渊领主以队长为准
import fs from 'node:fs';
import { startServer, launchPlayers, ok, result, sleep, until, uiRegister, uiCreateChar, dumpErrors } from './net_lib.mjs';
const out = 'test/shots/mp_coop_more'; fs.mkdirSync(out, { recursive: true });
const LAG = +(process.env.LAG ?? 80);
const srv = await startServer({ lagMs: LAG, jitterMs: 20 });
console.log(`（模拟网络延迟 ${LAG}ms + 抖动 20ms）`);
const { players, close } = await launchPlayers(2);
const [A, B] = players.map(p => p.page);
try {
  for (const [i, P] of [A, B].entries()) { await uiRegister(P, srv.url, ['alice', 'bob'][i]); await uiCreateChar(P, i); await P.evaluate(() => { testLoadout(10); save.write(); }); }
  await A.evaluate(() => netPartyInvite(null, 'bob')); await until(B, () => menus.isOpen('nd_pinv')); await B.click('.netask button:has-text("加入队伍")');
  await until(A, () => netParty.p && netParty.p.members.length === 2);
  // ---- 4) 深渊：进图被取消 → 退还邀请函；领主以队长为准 ----
  const aby = await A.evaluate(() => Object.keys(typeof ABYSS !== 'undefined' ? ABYSS : {}).find(id => DUNGEONS[id]));
  if (aby) {
    for (const P of [A, B]) await P.evaluate(() => { inv.add(makeItem('abyss_ticket', 2)); save.write(); });
    const t0 = [await A.evaluate(() => inv.count('abyss_ticket')), await B.evaluate(() => inv.count('abyss_ticket'))];
    await B.evaluate(() => { window.__wl = withLoading; withLoading = () => new Promise(() => {}); });   // 让队员一直“加载中”，队长才有机会取消
    await A.evaluate(id => coop.lead(id, 0), aby);
    ok(await until(B, () => coop.state === 'load', null, 8000), '深渊：队员收到准备并扣了邀请函（加载中）');
    const t1 = [await A.evaluate(() => inv.count('abyss_ticket')), await B.evaluate(() => inv.count('abyss_ticket'))];
    ok(t1[0] === t0[0] - 1 && t1[1] === t0[1] - 1, '进图前双方各扣 1 张邀请函', { t0, t1 });
    const boss = [await A.evaluate(id => DUNGEONS[id].boss.kind, aby), await B.evaluate(id => DUNGEONS[id].boss.kind, aby)];
    ok(boss[0] === boss[1], '深渊领主以队长为准（双方一致）', boss);
    await until(A, () => menus.isOpen('nd_coopwait'), null, 5000);
    await A.click('.netask button:has-text("取消")');
    ok(await until(A, n => coop.state === 'none' && inv.count('abyss_ticket') === n, t0[0], 8000), '队长取消 → 队长的邀请函退还');
    ok(await until(B, n => coop.state === 'none' && inv.count('abyss_ticket') === n, t0[1], 8000), '队员的邀请函也退还', await B.evaluate(() => inv.count('abyss_ticket')));
    await B.evaluate(() => { withLoading = window.__wl; });
  } else ok(false, '找不到深渊地下城（ABYSS）');
  // ---- 组队进洛兰 ----
  await A.evaluate(() => { const s = Object.keys(SCENES).find(s => SCENES[s].gates.some(g => g.dungeon === 'lorien')); return worldTravel(s); });
  await until(A, () => world && world.S.gates.some(g => g.dungeon === 'lorien'));
  await A.evaluate(() => enterDungeon('lorien', 0));
  ok(await until(B, () => coop.state === 'play' && game.scene === 'dungeon', null, 30000), '组队进图');
  await sleep(1500);
  // 测试用的怪：主机在队员身边刷几只血很厚、不会动的哥布林（不受房间里其他怪和 AI 干扰）
  const mk = await A.evaluate(() => {
    const g = [...coop.mates.values()][0], R = game.room, ids = [];
    game.player.x = R.x1 - 60; game.player.y = 20;
    for (let i = 0; i < 4; i++) { const m = spawnMonster('goblin', clamp(g.x + 120 + i * 90, 60, R.x1 - 60), clamp(g.y + (i % 2 ? 30 : -30), 20, DEPTH - 20), { lvl: 3, mul: 60 }); m.control = null; ids.push(m.nid); }
    return ids;
  });
  ok(await until(B, ids => ids.every(id => coop.puppets.has(id)), mk, 5000), '队员那边出现了测试用的怪');
  const [pick, jugId, gid0, nid0] = mk;
  const hit = await B.evaluate(async id => {
    const m = ents.find(e => e.nid === id), t0 = performance.now(); game.player.x = m.x - 60; game.player.y = m.y; game.player.face = 1;
    applyHit(game.player, m, { dmg: 1, launch: 520, sure: true, noCounterBonus: true, box: [0, 60, 20, 0, 100] });
    let up = -1; const zs = [];
    for (let i = 0; i < 240; i++) { await new Promise(r => requestAnimationFrame(r)); const dt = performance.now() - t0; if (up < 0 && m.z > 10) up = dt; zs.push([Math.round(dt), +m.z.toFixed(1), m.st]); }
    return { up, zs };
  }, pick);
  // 单机基准：主机上对一只真怪打同样的一下（有打击停顿，所以也不是 0ms）
  const base = await A.evaluate(async () => {
    const m = spawnMonster('goblin', game.player.x - 200, 100, { lvl: 3, mul: 60 }); m.control = null; m.invul = 0;
    const t0 = performance.now(); game.player.x = m.x - 60; game.player.y = m.y; game.player.face = 1;
    applyHit(game.player, m, { dmg: 1, launch: 520, sure: true, noCounterBonus: true, box: [0, 60, 20, 0, 100] });
    for (let i = 0; i < 60; i++) { await new Promise(r => requestAnimationFrame(r)); if (m.z > 10) return performance.now() - t0; }
    return null;
  });
  ok(hit.up >= 0 && base !== null && hit.up <= base + 40, `队员打中后本地立刻浮空：${Math.round(hit.up)}ms（单机基准 ${Math.round(base)}ms，含打击停顿；网络延迟 ${LAG}ms 不影响）`, { up: hit.up, base });
  const iDown = hit.zs.findIndex(s => s[2] === 'down' || s[2] === 'getup' || s[2] === 'idle');
  const after = iDown >= 0 ? hit.zs.slice(iDown + 3) : [];
  ok(iDown > 0 && after.every(s => s[1] < 8 && s[2] !== 'air'), '落地后没有被晚到的快照“再浮空一次”', { iDown, bad: after.filter(s => s[1] >= 8 || s[2] === 'air').slice(0, 5) });
  const hostSaw = await A.evaluate(id => { const m = coop.puppets.get(id); return m ? { air: m.cmb.air, hp: m.hp, hpMax: m.hpMax } : null; }, pick);
  ok(hostSaw && hostSaw.hp < hostSaw.hpMax, '主机那边也收到了这次命中', hostSaw);
  await sleep(2500);
  await A.evaluate(id => { const m = coop.puppets.get(id); if (m) { m.control = null; m.vx = m.vy = 0; } }, pick);   // 让主机上这只怪停下，好比较位置
  await sleep(1500);
  const pos = [await A.evaluate(id => { const m = coop.puppets.get(id); return m && [m.x, m.y, m.st, m.hp]; }, pick), await B.evaluate(id => { const m = coop.puppets.get(id); return m && [m.x, m.y, m.st, m.hp, !!m.pred, m.netSt, m.z, m.netBuf.length, m.netBuf.length && m.netBuf[m.netBuf.length - 1].x, performance.now() - (m.seenT || 0), m.act && m.act.name]; }, pick)];
  ok(pos[0] && pos[1] && Math.abs(pos[0][0] - pos[1][0]) < 12 && Math.abs(pos[0][1] - pos[1][1]) < 8, '预测结束后平滑回到主机的位置', pos);
  // 浮空连击：挑空后在空中连续追打 4 下，傀儡一直在空中、位置没有跳变（手感和单机一样）
  const jug = await B.evaluate(async id => {
    const m = ents.find(e => e.nid === id); if (!m) return null;
    const p = game.player; p.x = m.x - 60; p.y = m.y; p.face = 1;
    const H = { dmg: 1, sure: true, noCounterBonus: true, box: [0, 60, 20, 0, 200] };
    applyHit(p, m, { ...H, launch: 520 });
    const zs = [], xs = [];
    for (let i = 0; i < 100; i++) {
      await new Promise(r => requestAnimationFrame(r));
      if (i === 20 || i === 35 || i === 50 || i === 65) applyHit(p, m, { ...H, airLift: 200 });
      zs.push(m.z); xs.push(m.x);
    }
    const jumps = xs.slice(1).map((x, i) => Math.abs(x - xs[i]));
    return { minZ: Math.min(...zs.slice(8, 72)), maxJump: Math.max(...jumps), st: m.st };
  }, jugId);
  ok(jug && jug.minZ > 2 && jug.maxJump < 40, '浮空连击：追打期间一直在空中，位置不跳', jug);
  // ---- 2) 队员抓取 ----
  const gid = await B.evaluate(id => { const m = ents.find(e => e.nid === id); if (!m) return null; const p = game.player; p.x = m.x - 40; p.y = m.y; p.face = 1; p.doAct({ name: 'holdtest', clip: 'idle', dur: 2.5 }); startGrab(p, m, {}); return m.heldBy === p ? m.nid : null; }, gid0);
  ok(!!gid, '队员本地抓住了一只怪');
  ok(await until(A, id => { const m = coop.puppets.get(id), g = [...coop.mates.values()][0]; return m && m.st === 'held' && m.heldBy === g; }, gid, 3000), '主机那边：怪物被挂到队员身上（被抓状态）');
  const near = await A.evaluate(id => { const m = coop.puppets.get(id), g = [...coop.mates.values()][0]; return Math.abs(m.x - g.x) < 60 && Math.abs(m.y - g.y) < 5; }, gid);
  ok(near, '被抓的怪跟着队员的影子走');
  await B.evaluate(() => dropGrab(game.player));
  ok(await until(A, id => { const m = coop.puppets.get(id); return m && !m.heldBy && m.st !== 'held'; }, gid, 3000), '队员放开 → 主机那边也放开');
  // 主机判定抓不住（这里在主机上把怪标成不可抓）→ 队员那边也放开
  const nid = nid0;
  if (nid) {
    await A.evaluate(id => { const m = coop.puppets.get(id); if (m) m.noGrab = true; }, nid);
    await B.evaluate(id => { const m = ents.find(e => e.nid === id), p = game.player; p.x = m.x - 40; p.y = m.y; p.doAct({ name: 'holdtest', clip: 'idle', dur: 2.5 }); m.grabProt = 0; startGrab(p, m, {}); }, nid);
    ok(await until(B, id => { const m = ents.find(e => e.nid === id); return m && !m.heldBy; }, nid, 3000), '主机抓不住（规则判定）→ 队员这边自动放开');
    ok(await A.evaluate(id => { const m = coop.puppets.get(id); return !m || !m.heldBy; }, nid), '主机那边没有被抓');
  }
  // ---- 3) 自带 AI 的怪：龙之雕像也会打队员 ----
  const st = await A.evaluate(() => {
    const g = [...coop.mates.values()][0], R = game.room;
    game.player.x = R.x1 - 60; game.player.y = 20;   // 队长离得远远的
    const m = spawnMonster('dragonStatue', clamp(g.x + 150, 60, R.x1 - 200), g.y, { lvl: 10 }); m.control = skyStatueAI; m.aiCd = 0.3;
    return { wrapped: m.control !== skyStatueAI && typeof m.control === 'function', nid: m.nid };
  });
  ok(st.wrapped, '后来才换上的自带 AI（m.control = skyStatueAI）也被联机层包住');
  const me0 = await B.evaluate(() => coop.stats.monActsMe || 0);
  ok(await until(A, id => { const m = coop.puppets.get(id); return m && m.tgt && m.tgt.ghost; }, st.nid, 6000), '龙之雕像的目标是离它近的队员（不是队长）');
  ok(await until(B, n => (coop.stats.monActsMe || 0) > n && ents.some(e => e.nid && e.kind === 'dragonStatue' && e.act && e.act.name === 'breath'), me0, 8000), '队员那边雕像用同一个 AI 出招（喷火，打的是队员）');
  const fb = await until(B, () => projs.some(p => p.owner && p.owner.kind === 'dragonStatue'), null, 9000);
  ok(fb, '队员这边看到雕像的火球（能打到自己）', fb ? undefined : await B.evaluate(() => { const m = ents.find(e => e.kind === 'dragonStatue'); return m && { st: m.st, act: m.act && m.act.name, actT: m.actT, ev: m.act && m.act.events && m.act.events.map(e => e.done), tgt: m.tgt === game.player, dead: m.dead }; }));
  await B.screenshot({ path: `${out}/01-statue.png` });
  const errs = dumpErrors(players);
  ok(!errs.length, '页面没有报错', errs.slice(0, 5));
} catch (e) { ok(false, '异常：' + (e.stack || e)); }
await close(); await srv.stop();
const r = result(); console.log(`\n${r.total - r.fails}/${r.total} 通过`); process.exit(r.fails ? 1 : 0);
