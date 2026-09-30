// 驱魔师 / 复仇者组队可见性检查的公共部分（test/exorcist.mjs coop、test/avenger.mjs coop 用）：
// 本机临时服务端 + 两个客户端：A = 鬼剑士队长（主机），B = 圣职者队员（?priest=1，转职 job、Lv30、三次觉醒都完成），组队进地下城后调 fn(A, B) → [[名字, 通过?, 信息], ...]
// 要先软链主仓库的 server/node_modules（worktree 里没有；提交前删掉软链）
import { startServer, launchPlayers, sleep, until, uiRegister, uiCreateChar, dumpErrors } from './net_lib.mjs';
export async function coopCheck(job, fn) {
  const out = [], add = (n, ok, info) => out.push([n, !!ok, info]);
  const srv = await startServer();
  const { players, close } = await launchPlayers(2);
  const [A, B] = players.map(p => p.page);
  const url = `${srv.url}?priest=1&x=`;
  try {
    add('A 注册 + 建鬼剑士进城', await uiRegister(A, url, 'alice') && await uiCreateChar(A, 0));
    add('B 注册', await uiRegister(B, url, 'bob'));
    await B.click('text=进入游戏').catch(() => {}); await until(B, () => menus.isOpen('charselect'), null, 8000);
    await B.click('#charsel button:has-text("创建角色")'); await B.click('.clscard[data-cls="priest"]'); await B.click('text=创建并开始');
    add('B 建圣职者进城（?priest=1）', await until(B, () => game.scene === 'town' && game.player && game.player.cls === 'priest', null, 20000));
    await B.evaluate(() => { for (const n of ['help']) if (menus.isOpen(n)) menus.close(n); });
    await A.evaluate(() => { testLoadout(30); save.write(); });
    await B.evaluate(job => {
      testLoadout(30); game.job = job; save.data.job = job; Object.assign((save.data.flags ??= {}), { awaken: true, awaken2: true, awaken3: true }); onJobChange(game.player, job);
      for (const id of classSkills('priest', job)) game.skillLv[id] = Math.max(game.skillLv[id] || 0, Math.min(SKILLS[id].maxLv || 5, 3));
      recalcStats(game.player); game.player.hp = game.player.hpMax; game.player.mp = game.player.mpMax; save.write();
    }, job);
    await A.evaluate(() => netPartyInvite(null, 'bob'));
    await until(B, () => menus.isOpen('nd_pinv'), null, 5000);
    await B.click('.netask button:has-text("加入队伍")');
    add('组队 2 人', await until(A, () => netParty.p && netParty.p.members.length === 2, null, 8000));
    const scene = await A.evaluate(id => { for (const s in SCENES) if (SCENES[s].gates.some(g => g.dungeon === id)) return s; }, 'lorien');
    await A.evaluate(s => worldTravel(s), scene); await until(A, s => world && world.S.id === s, scene);
    await A.evaluate(() => enterDungeon('lorien', 0));
    const allIn = await Promise.all([A, B].map(P => until(P, () => game.scene === 'dungeon' && coop.state === 'play', null, 30000)));
    add('一起进入地下城', allIn.every(Boolean), allIn);
    await sleep(1200);
    // 主机上的怪全部定住、血加厚（只看表现，不让房间清掉）
    await A.evaluate(() => { for (const m of ents) if (m.nid && m.team === 'e' && !m.dead) { m.control = () => {}; m.vx = m.vy = 0; m.hp = m.hpMax = 1e9; } });
    const g = await A.evaluate(() => { const g = [...coop.mates.values()][0]; return g ? { cls: g.cls, job: jobOf(g) } : null; });
    add(`主机看到的队友影子是 ${job}`, g && g.job === job, g);
    for (const r of await fn(A, B)) out.push(r);
    const errs = dumpErrors(players); add('两边页面都没有报错', !errs.length, errs.slice(0, 4));
  } catch (e) { add('异常：' + (e.stack || e), false); }
  await close(); await srv.stop();
  return out;
}
