// 小魔女 · 永恒的占据（组队才能用）：2 个玩家真联机 —— 队员死亡倒计时里，小魔女放永恒的占据，队员原地复活（不花复活币）。node test/enchantress_coop.mjs
import { startServer, launchPlayers, ok, result, sleep, until, uiRegister, uiCreateChar, dumpErrors } from './net_lib.mjs';
const srv = await startServer({ lagMs: 40, jitterMs: 10 });
const { players, close } = await launchPlayers(2);
const [A, B] = players.map(p => p.page);
try {
  for (const [i, P] of [A, B].entries()) { await uiRegister(P, srv.url, ['alice', 'bob'][i]); await uiCreateChar(P, i); await P.evaluate(() => { testLoadout(10); save.write(); }); }
  await A.evaluate(() => netPartyInvite(null, 'bob')); await until(B, () => menus.isOpen('nd_pinv')); await B.click('.netask button:has-text("加入队伍")');
  await until(A, () => netParty.p && netParty.p.members.length === 2);
  await A.evaluate(() => { const s = Object.keys(SCENES).find(s => SCENES[s].gates.some(g => g.dungeon === 'lorien')); return worldTravel(s); });
  await until(A, () => world && world.S.gates.some(g => g.dungeon === 'lorien'));
  await A.evaluate(() => enterDungeon('lorien', 0));
  ok(await until(B, () => coop.state === 'play' && game.scene === 'dungeon', null, 30000), '组队进图');
  await sleep(1500);
  // A 转小魔女，学会永恒的占据
  await A.evaluate(() => {
    game.job = 'enchantress'; save.data.job = 'enchantress'; Object.assign(save.data.flags ??= {}, { awaken: true, awaken2: true, awaken3: true });
    for (const id of CLASSES.mage.jobs.enchantress.skills) game.skillLv[id] = SKILLS[id].awaken ? 1 : 5;
    onJobChange(game.player, 'enchantress'); const p = game.player; p.mpMax = p.mp = 1e6; p.cool = {};
    for (let i = 0; i < game.skillBar.length; i++) game.skillBar[i] = null; game.skillBar[0] = 'en_possession';
  });
  const req = await A.evaluate(() => { const r = SKILLS.en_possession.req(game.player); return r; });
  ok(req === true, '组队时永恒的占据可以使用（req 通过）', { req });
  // B 倒下
  await B.evaluate(() => { const p = game.player; p.hp = 0; p.dead = true; });
  ok(await until(B, () => game.dungeon && game.dungeon.state === 'dead', null, 8000), '队员进入死亡倒计时', await B.evaluate(() => game.dungeon && game.dungeon.state));
  ok(await until(A, () => { const g = [...coop.mates.values()][0]; return g && g.dead; }, null, 8000), '小魔女这边看到队员倒下', await A.evaluate(() => [...coop.mates.values()].map(g => g.dead)));
  const coins0 = await B.evaluate(() => save.data.coins || 0);
  // A 施放
  const cast = await A.evaluate(() => { const p = game.player; p.cool = {}; p.setState('idle'); p.act = null; const ok = castSkill(p, 'en_possession', false, null); return { ok, act: p.act && p.act.skill }; });
  ok(cast.act === 'en_possession', '永恒的占据放得出来', cast);
  ok(await until(B, () => game.dungeon.state === 'play' && !game.player.dead, null, 8000), '队员原地复活（死亡倒计时结束、恢复行动）', await B.evaluate(() => ({ st: game.dungeon.state, dead: game.player.dead, hp: game.player.hp })));
  const coins1 = await B.evaluate(() => save.data.coins || 0);
  ok(coins1 === coins0, `不花复活币（${coins0} → ${coins1}）`, { coins0, coins1 });
  dumpErrors(players);
} catch (e) { console.error(e); ok(false, '异常: ' + e.message); }
await close(); await srv.stop();
const r = result(); console.log(r.fails ? `失败 ${r.fails}/${r.total}` : `全部通过 ${r.total}`); process.exit(r.fails ? 1 : 0);
