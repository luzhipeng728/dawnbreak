// 闪避测试：位移 / 无敌 / 硬直中紧急闪避 / 纵深方向 / 冷却，翻滚中截图
import { launch, URL_BASE } from './lib.mjs';
const { browser, page, logs } = await launch({ width: 1280, height: 720 });
await page.goto(`${URL_BASE}?test&mute&mobs=0`); await page.waitForFunction(() => window.__READY);
const kb = page.keyboard, wait = ms => page.waitForTimeout(ms);
const P = () => page.evaluate(() => { const p = __G.player; return { x: Math.round(p.x), y: Math.round(p.y), st: p.st, act: p.act && p.act.name, invul: +p.invul.toFixed(2), cd: +(p.dodgeCd || 0).toFixed(2) }; });
await wait(400);
const a = await P(); await kb.press('ShiftLeft'); await wait(120); const mid = await P(); await page.screenshot({ path: 'test/shots/dodge-mid.png' }); await wait(400); const b = await P();
console.log('前滚', JSON.stringify({ before: a, mid, after: b, dx: b.x - a.x }));
await kb.down('ArrowDown'); await kb.press('ShiftLeft'); await wait(450); await kb.up('ArrowDown'); const c = await P(); console.log('向下滚', JSON.stringify({ dy: c.y - b.y }));
await kb.press('ShiftLeft'); await wait(50); await kb.press('ShiftLeft'); await wait(60); console.log('冷却中连按', JSON.stringify(await P()));
// 受击硬直中紧急闪避
await wait(900);
await page.evaluate(() => { const p = __G.player; p.setState('hit'); p.stun = 1; p.breakCd = 0; });
await kb.press('ShiftLeft'); await wait(80); const d = await P(); console.log('硬直中闪避', JSON.stringify(d));
await wait(500); await page.evaluate(() => { const p = __G.player; p.setState('hit'); p.stun = 1; });
await kb.press('ShiftLeft'); await wait(80); console.log('紧急闪避冷却中（应该还是 hit）', JSON.stringify(await P()));
// 普攻中取消闪避
await wait(1200); await kb.press('KeyX'); await wait(90); await kb.press('ShiftLeft'); await wait(60); console.log('普攻中闪避', JSON.stringify(await P()));
console.log('LOGS', JSON.stringify(logs.filter(l => l.type !== 'warning')));
await browser.close();
