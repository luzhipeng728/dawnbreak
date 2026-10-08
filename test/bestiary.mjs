// 图鉴测试：逐个生成怪物，让玩家站着挨打若干秒，统计每下伤害占“同等级玩家血量”的比例，截图，收集报错。
// 离线单文件包含约 220MB 内嵌素材；网页版只打开一次，随后按怪物加载分包并重置测试房，
// 避免数百次 page.goto 的浏览器资源泄漏。有网页版构建时默认使用它，单文件仅作为回退。
import fs from 'fs';
if (!process.env.GAME_URL && fs.existsSync(new URL('../dist/web/index.html', import.meta.url))) process.env.WEB ||= '1';
const { launch, URL_BASE } = await import('./lib.mjs');
const out = 'test/shots/bestiary';
fs.mkdirSync(out, { recursive: true });
const only = process.argv[2] ? process.argv[2].split(',') : null;
const { browser, page, logs } = await launch({ width: 1280, height: 720 });
const open = async () => {
  for (let attempt = 0; ; attempt++) {
    try {
      await page.goto(`${URL_BASE}?test&mon=goblin&mute`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForFunction(() => window.__READY, null, { timeout: 30000 });
      return;
    } catch (e) {
      if (attempt >= 2) throw e;
      await page.goto('about:blank', { waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {});
    }
  }
};
await open();
const kinds = only || await page.evaluate(() => Object.keys(MON));
const bosses = await page.evaluate(() => Object.values(DUNGEONS).map(d => d.boss.kind));
await page.evaluate(() => {
  window.__hurt = [];
  const orig = game.onPlayerHurt.bind(game);
  game.onPlayerHurt = function (p, dmg) { if (p === game.player) __hurt.push(dmg); return orig(...arguments); };
  setInterval(() => { const p = game.player; if (p) { p.hp = p.hpMax; p.dead = false; } }, 50);
});
const rows = [];
for (const kind of kinds) {
  const lv = await page.evaluate(k => MON[k].lvl, kind);
  const boss = bosses.includes(kind);
  await page.evaluate(async ({ kind, lv, boss }) => {
    await loadBundles(monBundles([kind]));
    startTestRoom();
    const p = game.player;
    for (let i = ents.length - 1; i >= 0; i--) if (ents[i] !== p) ents.splice(i, 1);
    if (p.heldBy) releaseHeld(p);
    if (p.act) p.endAct();
    Object.assign(p, { x: 200, y: 100, z: 0, vx: 0, vy: 0, vz: 0, dead: false, stun: 0, invul: 0, grabbed: null, heldBy: null, status: {} });
    p.setState('idle'); p.lvl = lv; p.def = 300 + 28 * (lv - 1); p.hp = p.hpMax;
    window.__hp = 1800 + 150 * (lv - 1); window.__hurt = [];
    spawnMonster(kind, 700, 100, { lvl: lv, boss });
    game.speedMul = 5;
  }, { kind, lv, boss });
  await page.waitForTimeout(1000);   // 5 秒游戏时间
  await page.screenshot({ path: `${out}/${kind}-a.png` });
  await page.waitForTimeout(1800);   // 再跑 9 秒，总计与旧测试相同的 14 秒
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
