// 图鉴测试：逐个生成怪物，让玩家站着挨打若干秒，统计每下伤害占“同等级玩家血量”的比例，截图，收集报错
import { launch, URL_BASE } from './lib.mjs';
import fs from 'fs';
const out = 'test/shots/bestiary';
fs.mkdirSync(out, { recursive: true });
const only = process.argv[2] ? process.argv[2].split(',') : null;
const { browser, page, logs } = await launch({ width: 1280, height: 720 });
await page.goto(`${URL_BASE}?test&mon=goblin&mute`);
await page.waitForFunction(() => window.__READY, null, { timeout: 20000 });
const kinds = only || await page.evaluate(() => Object.keys(MON));
const bosses = await page.evaluate(() => Object.values(DUNGEONS).map(d => d.boss.kind));
const rows = [];
for (const kind of kinds) {
  const lv = await page.evaluate(k => MON[k].lvl, kind);
  const boss = bosses.includes(kind);
  await page.goto(`${URL_BASE}?test&mute&mon=${kind}&lvl=${lv}${boss ? '&boss' : ''}`);
  await page.waitForFunction(() => window.__READY, null, { timeout: 20000 });
  await page.evaluate((lv) => {
    const p = __G.player; p.lvl = lv; p.def = 300 + 28 * (lv - 1); window.__hp = 1800 + 150 * (lv - 1);
    window.__hurt = []; const orig = game.onPlayerHurt.bind(game);
    game.onPlayerHurt = (pp, dmg) => { __hurt.push(dmg); orig(pp, dmg); };
    setInterval(() => { p.hp = p.hpMax; }, 50);
    game.speedMul = 2;
  }, lv);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${out}/${kind}-a.png` });
  await page.waitForTimeout(4500);
  await page.screenshot({ path: `${out}/${kind}-b.png` });
  const r = await page.evaluate(() => {
    const m = __G.ents.find(e => e.team === 'e');
    return { hits: __hurt.length, max: Math.max(0, ...__hurt), sum: __hurt.reduce((a, b) => a + b, 0), hp: __hp, mhp: m ? m.hpMax : 0, st: m ? m.st : 'none', ground: groundFx.length };
  });
  rows.push({ kind, lv, boss, hits: r.hits, maxPct: (r.max / r.hp * 100).toFixed(1), dps14s: (r.sum / r.hp * 100 / 14).toFixed(1) + '%/s', mhp: r.mhp });
}
console.table(rows);
console.log('LOGS', JSON.stringify(logs.filter(l => l.type !== 'warning').slice(0, 10), null, 1));
await browser.close();
