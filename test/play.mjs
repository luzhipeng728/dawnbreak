// 自动操作冒烟测试：载入测试房间，脚本化按键（移动、普攻三连、跑攻、跳攻、技能、指令），截图 + 收集报错
import { launch, URL_BASE } from './lib.mjs';
import fs from 'fs';
const out = process.argv[2] || 'test/shots/play';
fs.mkdirSync(out, { recursive: true });
const { browser, page, logs } = await launch({ width: 1600, height: 900 });
await page.goto(`${URL_BASE}?test&fps${process.env.Q || ''}`);
await page.waitForFunction(() => window.__READY, null, { timeout: 20000 });
const kb = page.keyboard, wait = ms => page.waitForTimeout(ms);
const tap = async (k, ms = 50) => { await kb.down(k); await wait(ms); await kb.up(k); };
const shot = async (n) => { await page.screenshot({ path: `${out}/${n}.png` }); console.log('shot', n, JSON.stringify(await page.evaluate(() => ({ hp: __G.player.hp, mp: Math.round(__G.player.mp), st: __G.player.st, mobs: __G.ents.filter(e => e.team === 'e' && !e.dead).length, combo: __G.game.combo, fx: __G.fxList.length })))); };
await wait(600); await shot('00-start');
await kb.down('ArrowRight'); await wait(900); await kb.up('ArrowRight');
for (let i = 0; i < 3; i++) { await tap('KeyX'); await wait(170); }
await wait(80); await shot('01-combo');
await tap('KeyA'); await wait(140); await shot('02-upslash');
await wait(200); await tap('KeyX'); await wait(150); await tap('KeyX'); await wait(300);
await tap('KeyS'); await wait(250); await tap('KeyS'); await wait(250); await tap('KeyS'); await wait(200); await shot('03-triple');
await tap('KeyD'); await wait(350); await shot('04-wave');
// 双击跑 + 跑攻 + 连突刺
await tap('ArrowLeft', 40); await wait(60); await kb.down('ArrowLeft'); await wait(500); await tap('KeyX'); await kb.up('ArrowLeft'); await wait(200); await tap('KeyX'); await wait(500); await shot('05-dash');
// 指令：↓→+Z（剑气）
await tap('ArrowDown', 40); await tap('ArrowRight', 40); await tap('KeyZ'); await wait(400); await shot('06-cmd-wave');
// 跳攻
await tap('KeyC'); await wait(120); await tap('KeyX'); await wait(300); await shot('07-jumpatk');
await tap('KeyF'); await wait(700); await shot('08-iai');
await tap('KeyG'); await wait(500); await tap('KeyE'); await wait(600); await shot('09-spin-flurry');
await tap('KeyW'); await wait(900); await shot('10-awaken');
await wait(2000); await shot('11-after');
console.log('LOGS', JSON.stringify(logs.slice(0, 8), null, 1));
await browser.close();
