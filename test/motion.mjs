// 动作连拍：测试房间里依次做 走 / 跑 / 普攻连段 / 技能取消 / 浮空追击 / 被打（轻、重、浮空、倒地）/ 受身 / 被抓 / 后跳 / 闪避，
// 每 ~80ms 截一张角色附近的图（test/shots/motion/<职业>-<序号>.png），并输出每张图对应的状态，方便逐帧检查动作。
// node test/motion.mjs sword [转职]
import { launch, URL_BASE } from './lib.mjs';
import fs from 'fs';
const cls = process.argv[2] || 'sword', job = process.argv[3] || '', out = `test/shots/motion`; fs.mkdirSync(out, { recursive: true });
const { browser, page, logs } = await launch({ width: 1280, height: 720 });
await page.goto(`${URL_BASE}?test&mute&cls=${cls}&mobs=0`); await page.waitForFunction(() => window.__READY);
await page.evaluate(job => {
  const p = __G.player; p.mpMax = p.mp = 9999; game.job = job || null;
  for (const id of classSkills(p.cls, job)) game.skillLv[id] = 5;
  const launcher = { sword: 'upslash', gun: 'g_knee', mage: 'mg_sky' }[p.cls], poke = { sword: 'ghost', gun: 'g_flash', mage: 'mg_fang' }[p.cls];
  game.skillBar = [launcher, poke, null, null, null, null, null, null, null, null, null, null];
  setInterval(() => { p.mp = 9999; for (const k in p.cool) p.cool[k] = 0; }, 300);
  window.__dummy = (dx = 70) => { for (const e of ents) if (e.team === 'e') e.remove = true; const m = spawnMonster('goblin', p.x + dx * p.face, p.y); m.control = null; m.hp = m.hpMax = 1e9; m.invul = 0; return m; };
}, job);
const kb = page.keyboard, wait = ms => page.waitForTimeout(ms);
const shots = []; let n = 0;
const snap = async (tag) => {
  const s = await page.evaluate(() => { const p = __G.player, m = __G.ents.find(e => e.team === 'e'); return { x: (p.x - cam.x) * 1280 / 960, y: (FLOOR_Y + p.y - p.z) * 720 / 540, st: p.st, clip: p.clipName, act: p.act && p.act.name, m: m && m.st, mz: m && Math.round(m.z) }; });
  const f = `${out}/${cls}-${String(n++).padStart(3, '0')}.png`;
  await page.screenshot({ path: f, clip: { x: Math.max(0, Math.min(1280 - 300, s.x - 110)), y: Math.max(0, Math.min(720 - 240, s.y - 200)), width: 300, height: 240 } });
  shots.push({ f, tag, ...s });
};
const burst = async (tag, ms, every = 70) => { const t = Date.now(); while (Date.now() - t < ms) { await snap(tag); await wait(every); } };
await burst('walk', 500); await kb.down('ArrowRight'); await burst('walk', 600); await kb.up('ArrowRight');
await kb.press('ArrowRight'); await wait(40); await kb.down('ArrowRight'); await burst('run', 600); await kb.up('ArrowRight');
await page.evaluate(() => { const p = __G.player; p.face = 1; __dummy(70); });
for (let i = 0; i < 3; i++) { await kb.press('KeyX'); await burst('combo', 150, 50); }
await kb.press('KeyA'); await burst('launch', 300, 50);
await kb.press('KeyC'); await burst('jump', 150, 50); await kb.press('KeyX'); await burst('jumpatk', 450, 60);
await kb.press('KeyS'); await burst('skill', 600, 70);
// 被打：轻 / 重 / 浮空 / 倒地 → 受身
await page.evaluate(() => { const p = __G.player, m = __dummy(60); m.face = -1; p.invul = 0; applyHit(m, p, { dmg: 0.01, stun: 0.4, knock: 60, sure: true }, {}); });
await burst('hitLight', 350, 60);
await page.evaluate(() => { const p = __G.player, m = __G.ents.find(e => e.team === 'e'); p.invul = 0; applyHit(m, p, { dmg: 0.01, stun: 0.6, knock: 240, heavy: true, sure: true }, {}); });
await burst('hitHeavy', 400, 60);
await page.evaluate(() => { const p = __G.player, m = __G.ents.find(e => e.team === 'e'); p.invul = 0; applyHit(m, p, { dmg: 0.01, launch: 520, knock: 120, sure: true }, {}); });
await burst('launched', 900, 60);
await kb.press('KeyC'); await burst('tech', 600, 60);
// 被抓（用对手的抓取）
await page.evaluate(() => { const p = __G.player, m = __G.ents.find(e => e.team === 'e'); p.invul = 0; p.x = m.x - 40; m.face = -1; m.doAct({ name: 'grab', dur: 1.0, hits: [], hold: (e, t) => { t.x = e.x + e.face * 40; t.z = 50; t.y = e.y + 0.5; } }); applyHit(m, p, { dmg: 0.01, grab: true }, {}); });
await burst('held', 700, 70);
await wait(600); await kb.down('ArrowDown'); await kb.press('KeyC'); await kb.up('ArrowDown'); await burst('backstep', 400, 60);
fs.writeFileSync(`${out}/${cls}-list.json`, JSON.stringify(shots, null, 0));
console.log(shots.length, 'frames', shots.map(s => `${s.tag}:${s.clip}${s.m ? '/' + s.m + (s.mz ? '@' + s.mz : '') : ''}`).join(' '));
console.log('LOGS', JSON.stringify(logs.filter(l => l.type !== 'warning')));
await browser.close();
