// 职业测试：测试房间里依次使用普攻连段 / 跑攻 / 跳攻 / 10 个技能 / 指令，截图并收集报错
import { launch, URL_BASE } from './lib.mjs';
import fs from 'fs';
const out = 'test/shots/classes'; fs.mkdirSync(out, { recursive: true });
const classes = (process.argv[2] || 'gun,mage').split(',');
const KEYS = ['KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyH', 'KeyQ', 'KeyW', 'KeyE', 'KeyR'];
for (const cls of classes) {
  const { browser, page, logs } = await launch({ width: 1280, height: 720 });
  await page.goto(`${URL_BASE}?test&mute&cls=${cls}&mobs=7`);
  await page.waitForFunction(() => window.__READY);
  const kb = page.keyboard, wait = ms => page.waitForTimeout(ms);
  const tap = async (k, ms = 50) => { await kb.down(k); await wait(ms); await kb.up(k); };
  const info = () => page.evaluate(() => ({ hp: Math.round(__G.player.hp), mp: Math.round(__G.player.mp), st: __G.player.st, act: __G.player.act && __G.player.act.name, combo: game.maxCombo, mobs: __G.ents.filter(e => e.team === 'e' && !e.dead).length, fps: Math.round(fps) }));
  await page.evaluate(() => { const p = __G.player; p.mpMax = p.mp = 99999; setInterval(() => { p.hp = p.hpMax; p.mp = p.mpMax; for (const k in p.cool) p.cool[k] = 0; if (__G.ents.filter(e => e.team === 'e' && !e.dead).length < 3) for (let i = 0; i < 4; i++) __G.spawnMonster('goblin', p.x + 150 + i * 60, 40 + i * 40); }, 400); });
  await wait(500);
  await kb.down('ArrowRight'); await wait(700); await kb.up('ArrowRight');
  await kb.down('KeyX'); await wait(1100); await kb.up('KeyX'); await page.screenshot({ path: `${out}/${cls}-00-basic.png` }); console.log(cls, 'basic', JSON.stringify(await info()));
  await tap('ArrowRight', 40); await wait(50); await kb.down('ArrowRight'); await wait(300); await tap('KeyX'); await kb.up('ArrowRight'); await wait(400);
  await tap('KeyC'); await wait(150); await tap('KeyX'); await wait(120); await tap('KeyX'); await wait(500);
  await page.screenshot({ path: `${out}/${cls}-01-dash-jump.png` }); console.log(cls, 'dash/jump', JSON.stringify(await info()));
  for (let i = 0; i < 10; i++) {
    const id = await page.evaluate(i => game.skillBar[i], i);
    await tap(KEYS[i]); await wait(i === 9 ? 1300 : 350);
    await page.screenshot({ path: `${out}/${cls}-s${i}-${id}.png` });
    await wait(i === 9 ? 1500 : 500);
    console.log(cls, id, JSON.stringify(await info()));
  }
  for (const seq of [['ArrowDown', 'ArrowRight'], ['ArrowRight', 'ArrowDown'], ['ArrowLeft', 'ArrowRight'], ['ArrowDown', 'ArrowDown'], ['ArrowUp']]) { for (const k of seq) await tap(k, 30); await tap('KeyZ'); await wait(700); }
  console.log(cls, 'cmds', JSON.stringify(await info()));
  console.log(cls, 'LOGS', JSON.stringify(logs.filter(l => l.type !== 'warning').slice(0, 6), null, 1));
  await browser.close();
}
