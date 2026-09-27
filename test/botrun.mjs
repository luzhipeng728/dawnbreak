// 机器人通关测试：?dungeon=ID&bot&lv=N，统计用时 / 评价 / 死亡次数，收集报错，定时截图
import { launch, URL_BASE } from './lib.mjs';
import fs from 'fs';
const out = 'test/shots/bot'; fs.mkdirSync(out, { recursive: true });
const list = (process.argv[2] || 'path:2').split(',').map(s => { const [id, lv, diff, cls] = s.split(':'); return { id, lv: +lv || 1, diff: +diff || 0, cls: cls || 'sword' }; });
const speed = +(process.env.SPEED || 3), limit = +(process.env.LIMIT || 420);
const rows = [];
for (const r of list) {
  const { browser, page, logs } = await launch({ width: 1280, height: 720 });
  await page.goto(`${URL_BASE}?dungeon=${r.id}&diff=${r.diff}&bot&mute&lv=${r.lv}&cls=${r.cls}`);
  await page.waitForFunction(() => window.__READY, null, { timeout: 20000 });
  await page.evaluate(s => { game.speedMul = s; }, speed);
  const t0 = Date.now(); let done = null, n = 0;
  while (!done && (Date.now() - t0) / 1000 * speed < limit) {
    await page.waitForTimeout(3000);
    done = await page.evaluate(() => window.__botDone || null);
    const st = await page.evaluate(() => { const D = game.dungeon; return D ? { room: D.layout.rooms.indexOf(D.room), boss: D.room.type === 'boss', hp: Math.round(game.player.hp / game.player.hpMax * 100), bossHp: D.boss ? Math.round(D.boss.hp / D.boss.hpMax * 100) : null, t: Math.round(D.t), fps: Math.round(fps) } : { scene: game.scene }; });
    if (n++ % 4 === 0) { await page.screenshot({ path: `${out}/${r.cls}-${r.id}-${String(n).padStart(2, '0')}.png` }); console.log(r.id, JSON.stringify(st)); }
  }
  await page.screenshot({ path: `${out}/${r.cls}-${r.id}-end.png` });
  const errs = logs.filter(l => l.type !== 'warning');
  rows.push({ ...r, ...(done || { rank: 'TIMEOUT' }), errors: errs.length });
  if (errs.length) console.log('ERR', r.id, JSON.stringify(errs.slice(0, 5), null, 1));
  await browser.close();
}
console.table(rows);
