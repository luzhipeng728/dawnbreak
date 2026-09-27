// 动作连拍：测试房间里跑步 / 普攻三连 / 技能 / 闪避 / 被打，每 60ms 截一张角色附近的图，拼成连拍
import { launch, URL_BASE } from './lib.mjs';
import { execSync } from 'child_process';
import fs from 'fs';
const cls = process.argv[2] || 'sword', out = `test/shots/motion`; fs.mkdirSync(out, { recursive: true });
const { browser, page, logs } = await launch({ width: 1280, height: 720 });
await page.goto(`${URL_BASE}?test&mute&cls=${cls}&mobs=2`); await page.waitForFunction(() => window.__READY);
await page.evaluate(() => { for (const e of __G.ents) if (e.team === 'e') { e.x = 900; e.control = null; } const p = __G.player; p.mpMax = p.mp = 9999; setInterval(() => { p.mp = 9999; for (const k in p.cool) p.cool[k] = 0; }, 300); });
const kb = page.keyboard, wait = ms => page.waitForTimeout(ms);
const shots = []; let n = 0;
const snap = async () => { const p = await page.evaluate(() => { const p = __G.player; return { x: (p.x - cam.x) * 1280 / 960, y: (FLOOR_Y + p.y - p.z) * 720 / 540 }; }); const f = `${out}/${cls}-${String(n++).padStart(3, '0')}.png`; await page.screenshot({ path: f, clip: { x: Math.max(0, Math.min(1280 - 240, p.x - 120)), y: Math.max(0, p.y - 190), width: 240, height: 210 } }); shots.push(f); };
const burst = async (ms, every = 60) => { const t = Date.now(); while (Date.now() - t < ms) { await snap(); await wait(every); } };
await kb.down('ArrowRight'); await burst(700); await kb.up('ArrowRight');
await kb.press('ArrowRight'); await wait(40); await kb.down('ArrowRight'); await burst(700); await kb.up('ArrowRight');
await wait(200);
for (let i = 0; i < 3; i++) { await kb.press('KeyX'); await burst(170, 40); }
await burst(300);
await kb.press('KeyA'); await burst(500);
await kb.press('ShiftLeft'); await burst(400);
await kb.press('KeyC'); await burst(250); await kb.press('KeyX'); await burst(500);
fs.writeFileSync(`${out}/${cls}-list.json`, JSON.stringify(shots));
console.log(shots.length, 'frames', JSON.stringify(logs.filter(l => l.type !== 'warning')));
await browser.close();
