// 难度核查：机器人通关时记录玩家每一次被击——是谁、哪一招、有没有地面预警、离上一次被击多久（连招），汇总出“最常打中人”的招式
// 用法：node test/hurtlog.mjs dark_thunder:19:sword,dark_corridor:19:gun [速度倍率，默认 2]
import { launch, URL_BASE } from './lib.mjs';
const runs = (process.argv[2] || 'dark_thunder:19:sword').split(','), speed = +(process.argv[3] || 2);
let fail = 0;
for (const r of runs) {
  const [dg, lv, cls = 'sword', diff = 0] = r.split(':');
  const { browser, page, logs } = await launch({ width: 960, height: 540 });
  await page.goto(`${URL_BASE}?dungeon=${dg}&lv=${lv}&cls=${cls}&diff=${diff}&bot&mute`);
  await page.waitForFunction(() => window.__READY, null, { timeout: 30000 });
  await page.evaluate(sp => {
    game.speedMul = sp; window.__hurt = []; let last = -9;
    const o = game.onPlayerHurt.bind(game);
    game.onPlayerHurt = (p, dmg, a) => {
      const src = a && (a.src || a), act = src && src.act, kind = (src && src.kind) || (a && a.kind) || '?';
      const tele = groundFx.some(g => !g.friendly && Math.hypot(g.x - p.x, (g.y - p.y) / 0.45) < (g.r || 40) + 60);
      const room = game.dungeon && game.dungeon.room;
      __hurt.push({ kind, act: act ? (act.clip || act.name || (src.acting && src.acting.clip) || 'act') : (src && src.proj ? 'proj' : '-'), dmg: Math.round(dmg), hp: Math.round(p.hp / p.hpMax * 100), gap: +(game.t - last).toFixed(2), boss: !!(src && src.boss), tele, room: room ? room.type : '', mobs: ents.filter(e => e.team === 'e' && !e.dead).length });
      last = game.t; return o(p, dmg, a);
    };
  }, speed);
  const t0 = Date.now();
  await page.waitForFunction(() => window.__botDone || (game.dungeon && game.dungeon.state === 'failed'), null, { timeout: 900000, polling: 2000 }).catch(() => {});
  const R = await page.evaluate(() => ({ done: window.__botDone, H: window.__hurt, hpMax: game.player.hpMax }));
  const by = {}, gaps = { lt05: 0, lt1: 0 }; let boss = 0, adds = 0;
  for (const h of R.H) { const k = `${h.kind}:${h.act}`; (by[k] ??= { n: 0, dmg: 0 }).n++; by[k].dmg += h.dmg; if (h.gap < 0.5) gaps.lt05++; else if (h.gap < 1) gaps.lt1++; if (h.room === 'boss') boss++; }
  const top = Object.entries(by).sort((a, b) => b[1].n - a[1].n).slice(0, 10).map(([k, v]) => `${k}×${v.n}（均伤 ${Math.round(v.dmg / v.n / R.hpMax * 1000) / 10}%）`);
  const minHp = Math.min(100, ...R.H.map(h => h.hp));
  console.log(`\n== ${dg} Lv.${lv} ${cls} 难度${diff}：${JSON.stringify(R.done)}  用时 ${Math.round((Date.now() - t0) / 1000)}s`);
  console.log(`  被击 ${R.H.length} 次（领主房 ${boss}），间隔 <0.5 秒 ${gaps.lt05} 次、0.5~1 秒 ${gaps.lt1} 次，最低血量 ${minHp}%`);
  console.log('  最常打中：' + top.join('；'));
  const errs = logs.filter(l => l.type === 'pageerror'); if (errs.length) { fail++; console.log('  报错', JSON.stringify(errs.slice(0, 2))); }
  await browser.close();
  await new Promise(r => setTimeout(r, 3000));   // 两次之间歇一会，别让机器持续高负载
}
process.exit(fail ? 1 : 0);
