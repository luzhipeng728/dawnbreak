// 魔道学者技能截图（人工检查美术 / 座位 / 特效用）：node test/witch_shots.mjs [技能id,...] [--set 套装]
// 每个技能在施放后的几个时间点各截一张，裁成角色附近 520×300，拼成一张总览 test/shots/witch/_sheet.png（每行一个技能）
import { launch, URL_BASE } from './lib.mjs';
import fs from 'fs';
const out = 'test/shots/witch'; fs.mkdirSync(out, { recursive: true });
const args = process.argv.slice(2), set = args.includes('--set') ? args[args.indexOf('--set') + 1] : null;
const want = (args.find(a => !a.startsWith('--') && a !== set) || '').split(',').filter(Boolean);
// [技能, 截图时间点（帧）, 选项]
const PLAN = [
  ['jump', [10, 30, 50, 70], {}], ['wt_shululu', [20, 90], { force: 'ok' }], ['wt_missile', [12, 30], { force: 'great' }], ['wt_cloak', [10, 30], {}],
  ['wt_swatter', [8, 16], { force: 'ok' }], ['wt_lava', [10, 60], { force: 'ok' }], ['wt_lava', [10, 30], { force: 'fail', tag: 'lava_fail' }], ['wt_acid', [20, 120], { force: 'great' }],
  ['wt_spin', [20, 60], { force: 'ok' }], ['wt_spin', [15, 60, 100], { force: 'ok', air: true, tag: 'spin_air' }],
  ['wt_tesla', [15, 60, 120], { force: 'ok' }], ['wt_furnace', [15, 60, 90], { force: 'ok' }], ['wt_furnace', [15, 50], { force: 'fail', tag: 'furnace_fail' }],
  ['wt_drill', [10, 40, 120], { force: 'great' }], ['wt_antigrav', [20, 60], { force: 'ok' }],
  ['wt_superswat', [12, 20], { force: 'ok' }], ['wt_rabbit', [20, 60], { force: 'ok' }], ['wt_shaved', [20, 80], { force: 'ok' }], ['wt_lollipop', [12, 24, 60], { force: 'ok' }],
  ['wt_trickjack', [20, 60], { force: 'ok' }], ['wt_awaken', [60, 120, 200, 250], {}], ['wt_awaken2', [60, 150], {}], ['wt_awaken3', [60, 150, 250], {}],
];
const { browser, page, logs } = await launch({ width: 960, height: 540 });
await page.goto(`${URL_BASE}?test&cls=mage&mobs=0&mute`); await page.waitForFunction(() => window.__READY, null, { timeout: 30000 });
await page.evaluate(async set => {
  const B = ['shululu', 'furnace', 'drill', 'tesla', 'antigrav', 'rabbit', 'shaved', 'ouro', 'trickjack', 'candyDoll', 'coaster', 'wtAwk', 'helperJack', 'helperSnow', 'helperEel', 'helperCat', 'goblin', 'tau'].map(b => 'spr:' + b);
  if (set) B.push('spr:mage@' + set);
  await loadBundles(B.filter(b => Object.values(ASSET_BUNDLE).includes(b)));
  game.paused = true; const p = game.player; game.job = 'witch';
  for (const id of CLASSES.mage.jobs.witch.skills) game.skillLv[id] = Math.min(10, SKILLS[id].maxLv);
  for (const id of ['wt_helper', 'wt_pink', 'wt_stone']) game.skillLv[id] = 0;
  const broom = makeItem(Object.keys(ITEMS).find(k => /^broom_\d+_[01]$/.test(k))); inv.equip.weapon = broom;
  if (set) { const it = Object.values(ITEMS).find(d => d.slot === 'av_top' && d.set === set); if (it) inv.equip.av_top = makeItem(it.key); }
  recalcStats(p); p.model = CLASSES.mage.model(); p._psvT = 0; tickPassives(p, 0.3);
}, set);
const shots = [];
for (const [id, times, o] of PLAN) {
  if (want.length && !want.includes(id) && !want.includes(o.tag)) continue;
  const tag = o.tag || id;
  await page.evaluate(({ id, o }) => {
    const run = n => { for (let i = 0; i < n; i++) { input.frame(game.t); step(1 / 60); } };
    const p = game.player; clearAllSummons('test'); for (const e of ents) if (e !== p) e.remove = true; run(1); projs.length = 0; fxList.length = 0;
    Object.assign(p, { x: 400, y: 100, z: 0, vz: 0, face: 1, act: null, scale: 1, drawFlip: false }); p.setState('idle'); for (const k in p.cool) p.cool[k] = 0; p.mp = p.mpMax = 99999; p.hp = p.hpMax; cam.x = 0;
    for (const [x, y] of [[560, 100], [650, 80], [720, 120]]) { const m = spawnMonster('goblin', x, y); m.control = null; m.hp = m.hpMax = 1e9; m.acd = m.acd.map(() => 99); }
    if (o.air || id === 'jump') { p.z = 1; p.vz = p.jumpV; p.setState('jump'); if (o.air) run(14); }
    p.wtForce = o.force || null;
    if (id !== 'jump') castSkill(p, id, false, null);
    window.__wtT = 0;
  }, { id, o });
  for (const t of times) {
    await page.evaluate(n => { const run = k => { for (let i = 0; i < k; i++) { input.frame(game.t); step(1 / 60); } }; run(n - window.__wtT); window.__wtT = n; }, t);
    await page.waitForTimeout(60);
    const box = await page.evaluate(() => { const p = game.player; return { x: sx(p.x), y: sy(p.y, 0) }; });
    const file = `${out}/${tag}_${t}.png`;
    await page.screenshot({ path: file, clip: { x: Math.max(0, Math.min(960 - 520, box.x - 200)), y: Math.max(0, Math.min(540 - 300, box.y - 230)), width: 520, height: 300 } });
    shots.push([tag, t, file]);
  }
}
fs.writeFileSync(`${out}/_list.json`, JSON.stringify(shots));
const errs = logs.filter(l => l.type === 'pageerror' || /error/i.test(l.text)); console.log('errors', JSON.stringify(errs.slice(0, 5)));
await browser.close();
