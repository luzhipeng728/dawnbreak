// 联机：组队刷图的手感与规则（2 个玩家，默认模拟 80ms 下行延迟）
// 1) 队员打浮空：本地立刻飞起（不等快照），落地后不会被“晚一拍的快照”再浮空一次，最后和主机位置对齐
// 2) 队员抓取：主机那边怪物挂到队员身上（被抓状态），放开后恢复；主机判定抓不住时队员这边也放开
// 3) 自带 AI 的怪（龙之雕像）：在全队里选目标，队员那边用同一个 AI 出招（能打到队员）
// 4) 深渊进图被取消：队长和队员扣掉的邀请函都退还；深渊领主以队长为准
// 时间相关的判断都用游戏逻辑时间（game.t，固定 60Hz 步长）或者“等条件成立（带超时）”，机器负载高、掉帧时也不会误报；失败时打印具体数值
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
    ok(boss[0] === boss[1], `深渊领主以队长为准（队长 ${boss[0]} / 队员 ${boss[1]}）`, boss);
    await until(A, () => menus.isOpen('nd_coopwait'), null, 5000);
    await A.click('.netask button:has-text("取消")');
    ok(await until(A, n => coop.state === 'none' && inv.count('abyss_ticket') === n, t0[0], 10000), '队长取消 → 队长的邀请函退还', await A.evaluate(() => ({ state: coop.state, tickets: inv.count('abyss_ticket') })));
    ok(await until(B, n => coop.state === 'none' && inv.count('abyss_ticket') === n, t0[1], 10000), '队员的邀请函也退还', await B.evaluate(() => ({ state: coop.state, tickets: inv.count('abyss_ticket') })));
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
    for (let i = 0; i < 5; i++) { const m = spawnMonster('goblin', clamp(g.x + 120 + i * 90, 60, R.x1 - 60), clamp(g.y + (i % 2 ? 30 : -30), 20, DEPTH - 20), { lvl: 3, mul: 60 }); m.control = null; ids.push(m.nid); }
    return ids;
  });
  ok(await until(B, ids => ids.every(id => coop.puppets.has(id)), mk, 10000), '队员那边出现了测试用的怪', await B.evaluate(ids => ids.map(id => coop.puppets.has(id)), mk));
  const [pick, jugId, gid0, nid0, longId] = mk;
  // 打中 → 离地：按游戏逻辑时间量（掉帧时一帧会补跑好几步逻辑，按真实时间量会误报）；采样一直到它落地、起身、恢复（逻辑时间 4 秒为限）
  const hit = await B.evaluate(async id => {
    const m = ents.find(e => e.nid === id), g0 = game.t; game.player.x = m.x - 60; game.player.y = m.y; game.player.face = 1;
    applyHit(game.player, m, { dmg: 1, launch: 520, sure: true, noCounterBonus: true, box: [0, 60, 20, 0, 100] });
    let up = -1; const zs = [];
    while (game.t - g0 < 4) { await new Promise(r => requestAnimationFrame(r)); const t = (game.t - g0) * 1000; if (up < 0 && m.z > 10) up = t; zs.push([Math.round(t), +m.z.toFixed(1), m.st]); }
    return { up, zs };
  }, pick);
  // 单机基准：主机上对一只真怪打同样的一下（有打击停顿，所以也不是 0ms）
  const base = await A.evaluate(async () => {
    const m = spawnMonster('goblin', game.player.x - 200, 100, { lvl: 3, mul: 60 }); m.control = null; m.invul = 0;
    const g0 = game.t; game.player.x = m.x - 60; game.player.y = m.y; game.player.face = 1;
    applyHit(game.player, m, { dmg: 1, launch: 520, sure: true, noCounterBonus: true, box: [0, 60, 20, 0, 100] });
    while (game.t - g0 < 2) { await new Promise(r => requestAnimationFrame(r)); if (m.z > 10) return (game.t - g0) * 1000; }
    return null;
  });
  // 两边都是逻辑时间，差别只在于采样落在哪一帧：允许 3 个逻辑帧（50ms）的误差；网络延迟（这里 80ms + 抖动）不应该出现在里面
  ok(hit.up >= 0 && base !== null && hit.up <= base + 50, `队员打中后本地立刻浮空：${Math.round(hit.up)}ms（单机基准 ${Math.round(base)}ms，都是逻辑时间、含打击停顿；网络延迟 ${LAG}ms 不影响）`, { up: hit.up, base });
  const iDown = hit.zs.findIndex(s => s[2] === 'down' || s[2] === 'getup' || s[2] === 'idle');
  const after = iDown >= 0 ? hit.zs.slice(iDown + 3) : [];
  ok(iDown > 0 && after.every(s => s[1] < 8 && s[2] !== 'air'), `落地后没有被晚到的快照“再浮空一次”（第 ${iDown} 个采样落地，之后 ${after.length} 个采样）`, { iDown, bad: after.filter(s => s[1] >= 8 || s[2] === 'air').slice(0, 5), tail: hit.zs.slice(-3) });
  // 主机那边：等这次命中到达（最多 5 秒，不用固定等待）
  ok(await until(A, id => { const m = coop.puppets.get(id); return m && m.hp < m.hpMax; }, pick, 5000), '主机那边也收到了这次命中', await A.evaluate(id => { const m = coop.puppets.get(id); return m ? { air: m.cmb.air, hp: m.hp, hpMax: m.hpMax } : null; }, pick));
  // 位置对齐：主机上的怪停住后，等队员这边的傀儡收敛（最多 10 秒）；误差门槛保持 12px / 8px
  await A.evaluate(id => { const m = coop.puppets.get(id); if (m) { m.control = null; m.vx = m.vy = 0; } }, pick);
  const hostPos = async () => A.evaluate(id => { const m = coop.puppets.get(id); return m && { x: +m.x.toFixed(1), y: +m.y.toFixed(1), st: m.st }; }, pick);
  let hp0 = await hostPos(), conv = false;
  for (let i = 0; i < 40 && !conv; i++) {
    await sleep(250);
    const hp1 = await hostPos(); if (!hp1) break;
    if (Math.abs(hp1.x - hp0.x) > 0.5 || Math.abs(hp1.y - hp0.y) > 0.5) { hp0 = hp1; continue; }   // 主机那边还在滑（击退余势）：等它停稳
    conv = await B.evaluate(([id, x, y]) => { const m = coop.puppets.get(id); return !!m && Math.abs(m.x - x) < 12 && Math.abs(m.y - y) < 8; }, [pick, hp1.x, hp1.y]);
    hp0 = hp1;
  }
  const guestPos = await B.evaluate(id => { const m = coop.puppets.get(id); return m && { x: +m.x.toFixed(1), y: +m.y.toFixed(1), st: m.st, pred: !!m.pred, settle: !!m.settle, netSt: m.netSt, z: +m.z.toFixed(1) }; }, pick);
  ok(conv, `预测结束后平滑回到主机的位置（主机 ${hp0 && hp0.x},${hp0 && hp0.y} / 队员 ${guestPos && guestPos.x},${guestPos && guestPos.y}）`, { host: hp0, guest: guestPos });
  // 浮空连击：挑空后在空中连续追打 4 下，傀儡一直在空中、位置没有跳变（手感和单机一样）
  const jug = await B.evaluate(async id => {
    const m = ents.find(e => e.nid === id); if (!m) return null;
    const p = game.player; p.x = m.x - 60; p.y = m.y; p.face = 1;
    const H = { dmg: 1, sure: true, noCounterBonus: true, box: [0, 60, 20, 0, 200] };
    applyHit(p, m, { ...H, launch: 520 });
    // 按逻辑时间追打：0.33 / 0.58 / 0.83 / 1.08 秒各一下；看 0.15~1.2 秒之间一直在空中，横向移动速度没有“瞬移”
    const g0 = game.t, at = [0.33, 0.58, 0.83, 1.08], S = []; let k = 0, lastT = 0, lastX = m.x;
    while (game.t - g0 < 1.6) {
      await new Promise(r => requestAnimationFrame(r));
      const t = game.t - g0;
      while (k < at.length && t >= at[k]) { applyHit(p, m, { ...H, airLift: 200 }); k++; }
      if (t > lastT) S.push([+t.toFixed(3), +m.z.toFixed(1), Math.abs(m.x - lastX) / (t - lastT)]);
      lastT = t; lastX = m.x;
    }
    const mid = S.filter(s => s[0] >= 0.15 && s[0] <= 1.2);
    return { minZ: Math.min(...mid.map(s => s[1])), maxSpeed: Math.round(Math.max(...S.map(s => s[2]))), n: S.length, hits: k };
  }, jugId);
  // 击退最快几百像素 / 秒；快照位置硬拉过来会是一帧几十像素（上千像素 / 秒）
  ok(jug && jug.hits === 4 && jug.minZ > 2 && jug.maxSpeed < 900, `浮空连击：追打期间一直在空中（最低 ${jug && jug.minZ}px），没有瞬移（最大横向速度 ${jug && jug.maxSpeed}px/s）`, jug);
  // 长浮空连（刷图没有浮空时限）：队员连打 6.5 秒（每 0.2 秒一下空中攻击、快落地就再挑），傀儡全程在空中、没有被拉回主机的状态（以前第一下定 4 秒预测上限）；
  // 主机那边这些命中也都按空中受击结算了（没有因为主机先落地而被丢掉）
  const host0 = await A.evaluate(id => { const m = coop.puppets.get(id); return m ? m.cmb.air : -1; }, longId);
  const lj = await B.evaluate(async id => {
    const m = ents.find(e => e.nid === id); if (!m) return null;
    const p = game.player; p.x = m.x - 60; p.y = m.y; p.face = 1;
    const H = { dmg: 1, sure: true, noCounterBonus: true, box: [0, 60, 20, 0, 260] };
    applyHit(p, m, { ...H, launch: 520 });
    const g0 = game.t, S = []; let next = 0.2, hits = 1, launches = 1, lastT = 0, lastX = m.x, snapped = 0;
    while (game.t - g0 < 6.5) {
      await new Promise(r => requestAnimationFrame(r));
      const t = game.t - g0; p.x = m.x - 60; p.y = m.y;
      if (!m.pred) snapped++;
      if (t >= next) { next += 0.2; if (m.vz < 0 && m.z < 50) { applyHit(p, m, { ...H, launch: 480 }); launches++; } else applyHit(p, m, { ...H, airLift: 160 }); hits++; }
      if (t > lastT) S.push([+t.toFixed(3), +m.z.toFixed(1), Math.abs(m.x - lastX) / (t - lastT), m.st]);
      lastT = t; lastX = m.x;
    }
    const mid = S.filter(s => s[0] >= 0.15);
    return { T: +(game.t - g0).toFixed(2), hits, launches, minZ: Math.min(...mid.map(s => s[1])), grounded: mid.filter(s => s[3] !== 'air').length, maxSpeed: Math.round(Math.max(...S.map(s => s[2]))), snapped, lv: m.js ? m.js.lv : 0 };
  }, longId);
  const hostLong = await until(A, ([id, a0, n]) => { const m = coop.puppets.get(id); return m && m.cmb.air - a0 >= n * 0.8; }, [longId, host0, lj ? lj.hits : 1e9], 6000);
  const hostInfo = await A.evaluate(id => { const m = coop.puppets.get(id); return m && { air: m.cmb.air, st: m.st, lv: m.js ? m.js.lv : 0, grace: coop.stats.landGrace || 0 }; }, longId);
  ok(lj && lj.T >= 6.4 && lj.minZ > 2 && lj.grounded === 0 && lj.snapped === 0 && lj.maxSpeed < 900, `队员长浮空连 ${lj && lj.T} 秒（${lj && lj.hits} 下、再挑 ${lj && lj.launches} 次）：傀儡全程在空中（最低 ${lj && lj.minZ}px），没有被拉回主机状态`, lj);
  ok(hostLong, `主机那边这套长连的命中都按空中受击结算（空中受击 +${hostInfo && hostInfo.air - host0} / 队员 ${lj && lj.hits} 下，落地宽容 ${hostInfo && hostInfo.grace} 次）`, { hostInfo, host0 });
  // 主机落地宽容：队员那边看到还在空中（tz）、主机这边刚落地不到 0.25 秒 → 按空中受击结算一次；落地久了 / 二级保护强制落地的照旧不吃
  const grace = await A.evaluate(id => {
    const m = coop.puppets.get(id), uid = [...coop.mates.keys()][0]; if (!m || uid === undefined) return null;
    const try1 = (stT, lv, tz) => { m.hp = Math.max(m.hp, m.hpMax * 0.5); m.invul = 0; m.z = 0; m.vz = 0; m.setState('down'); m.stT = stT; if (m.js) m.js.lv = lv; const g0 = coop.stats.landGrace || 0;
      coop.remoteHit(uid, { id, dmg: 1, h: { airLift: 140, stun: 0.2 }, tz, x: Math.round(m.x - 40), z: 0, f: 1, tm: 1 }); const r = { st: m.st, grace: (coop.stats.landGrace || 0) - g0 }; if (m.js) m.js.lv = 0; return r; };
    const out = { fresh: try1(0.1, 0, 40), late: try1(0.6, 0, 40), lv2: m.js ? try1(0.1, 2, 40) : { st: 'down', grace: 0 }, ground: try1(0.1, 0, 0) };
    m.z = 0; m.vz = 0; m.setState('idle'); resetCmb(m); return out;
  }, longId);
  ok(grace && grace.fresh.st === 'air' && grace.fresh.grace === 1 && grace.late.st === 'down' && grace.lv2.st === 'down' && grace.ground.st === 'down' && !grace.late.grace && !grace.lv2.grace && !grace.ground.grace, '主机落地宽容：队员看到还在空中、主机刚落地 0.1 秒的命中按空中受击；落地 0.6 秒 / 二级保护落地 / 队员也看到在地上的不吃', grace);
  // ---- 2) 队员抓取 ----
  // 抓之前先等条件就绪（不用固定等待）：队员站到怪旁边，主机那边的影子也跟过来了，主机上这只怪可以被抓（站着、没被抓、没有抓取保护）
  await B.evaluate(id => { const m = ents.find(e => e.nid === id); if (!m) return; const p = game.player; p.x = m.x - 40; p.y = m.y; p.face = 1; }, gid0);
  const ready = await until(A, id => { const m = coop.puppets.get(id), g = [...coop.mates.values()][0]; return m && g && !m.heldBy && m.st !== 'down' && m.st !== 'air' && (m.grabProt || 0) <= 0 && Math.abs(m.x - g.x) < 70 && Math.abs(m.y - g.y) < 15; }, gid0, 8000);
  ok(ready, '抓取前：主机那边的影子已经走到怪旁边、怪可以被抓', await A.evaluate(id => { const m = coop.puppets.get(id), g = [...coop.mates.values()][0]; return m && g && { st: m.st, dx: +(m.x - g.x).toFixed(1), dy: +(m.y - g.y).toFixed(1), prot: m.grabProt }; }, gid0));
  const gid = await B.evaluate(id => { const m = ents.find(e => e.nid === id); if (!m) return null; const p = game.player; p.doAct({ name: 'holdtest', clip: 'idle', dur: 2.5 }); startGrab(p, m, {}); return m.heldBy === p ? m.nid : null; }, gid0);
  ok(!!gid, '队员本地抓住了一只怪');
  const hostHeld = id => A.evaluate(id => { const m = coop.puppets.get(id), g = [...coop.mates.values()][0]; return m && { st: m.st, byMate: !!g && m.heldBy === g, dx: +(m.x - g.x).toFixed(1), dy: +(m.y - g.y).toFixed(1), grabs: coop.stats.grabs || 0, rej: coop.stats.grabRej, ghostSt: g && g.st, ghostAct: g && g.act && g.act.name }; }, id);
  ok(await until(A, id => { const m = coop.puppets.get(id), g = [...coop.mates.values()][0]; return m && m.st === 'held' && m.heldBy === g; }, gid, 6000), '主机那边：怪物被挂到队员身上（被抓状态）', await hostHeld(gid));
  const hh = await hostHeld(gid);
  ok(hh && Math.abs(hh.dx) < 60 && Math.abs(hh.dy) < 5, `被抓的怪跟着队员的影子走（相对影子 ${hh && hh.dx}, ${hh && hh.dy}）`, hh);
  await B.evaluate(() => dropGrab(game.player));
  ok(await until(A, id => { const m = coop.puppets.get(id); return m && !m.heldBy && m.st !== 'held'; }, gid, 6000), '队员放开 → 主机那边也放开', await hostHeld(gid));
  // 主机判定抓不住（这里在主机上把怪标成不可抓）→ 队员那边也放开
  const nid = nid0;
  if (nid) {
    await A.evaluate(id => { const m = coop.puppets.get(id); if (m) m.noGrab = true; }, nid);
    await until(A, id => { const m = coop.puppets.get(id); return m && m.noGrab; }, nid, 3000);
    await B.evaluate(id => { const m = ents.find(e => e.nid === id), p = game.player; p.x = m.x - 40; p.y = m.y; p.doAct({ name: 'holdtest', clip: 'idle', dur: 2.5 }); m.grabProt = 0; startGrab(p, m, {}); }, nid);
    ok(await until(B, id => { const m = ents.find(e => e.nid === id); return m && !m.heldBy; }, nid, 6000), '主机抓不住（规则判定）→ 队员这边自动放开', await B.evaluate(id => { const m = ents.find(e => e.nid === id); return m && { held: !!m.heldBy, st: m.st }; }, nid));
    ok(await A.evaluate(id => { const m = coop.puppets.get(id); return !m || !m.heldBy; }, nid), '主机那边没有被抓', await hostHeld(nid));
  }
  // ---- 3) 自带 AI 的怪：龙之雕像也会打队员 ----
  const st = await A.evaluate(() => {
    const g = [...coop.mates.values()][0], R = game.room;
    game.player.x = R.x1 - 60; game.player.y = 20;   // 队长离得远远的
    const m = spawnMonster('dragonStatue', clamp(g.x + 150, 60, R.x1 - 200), g.y, { lvl: 10 }); m.control = skyStatueAI; m.aiCd = 0.3;
    return { wrapped: m.control !== skyStatueAI && typeof m.control === 'function', nid: m.nid };
  });
  ok(st.wrapped, '后来才换上的自带 AI（m.control = skyStatueAI）也被联机层包住', st);
  const me0 = await B.evaluate(() => coop.stats.monActsMe || 0);
  ok(await until(A, id => { const m = coop.puppets.get(id); return m && m.tgt && m.tgt.ghost; }, st.nid, 8000), '龙之雕像的目标是离它近的队员（不是队长）', await A.evaluate(id => { const m = coop.puppets.get(id); return m && { tgt: m.tgt ? (m.tgt.ghost ? 'mate' : 'host') : null, act: m.act && m.act.name }; }, st.nid));
  ok(await until(B, n => (coop.stats.monActsMe || 0) > n && ents.some(e => e.nid && e.kind === 'dragonStatue' && e.act && e.act.name === 'breath'), me0, 10000), '队员那边雕像用同一个 AI 出招（喷火，打的是队员）', await B.evaluate(() => ({ monActsMe: coop.stats.monActsMe, statue: (ents.find(e => e.kind === 'dragonStatue') || {}).st })));
  const fb = await until(B, () => projs.some(p => p.owner && p.owner.kind === 'dragonStatue'), null, 9000);
  ok(fb, '队员这边看到雕像的火球（能打到自己）', fb ? undefined : await B.evaluate(() => { const m = ents.find(e => e.kind === 'dragonStatue'); return m && { st: m.st, act: m.act && m.act.name, actT: m.actT, ev: m.act && m.act.events && m.act.events.map(e => e.done), tgt: m.tgt === game.player, dead: m.dead }; }));
  await B.screenshot({ path: `${out}/01-statue.png` });
  const errs = dumpErrors(players);
  ok(!errs.length, '页面没有报错', errs.slice(0, 5));
} catch (e) { ok(false, '异常：' + (e.stack || e)); }
await close(); await srv.stop();
const r = result(); console.log(`\n${r.total - r.fails}/${r.total} 通过`); process.exit(r.fails ? 1 : 0);
