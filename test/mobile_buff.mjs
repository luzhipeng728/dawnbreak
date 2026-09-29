// 手机状态键：没放进技能栏的 Buff（方向 + 空格那类）/ 受击技能出现在最右边一列，点一下就放
// 用法：node build.mjs && node test/mobile_buff.mjs
import { URL_BASE, chromium } from './lib.mjs';
let fails = 0; const check = (ok, msg, x = '') => { console.log(ok ? '  ✓' : '  ✗', msg, x); if (!ok) fails++; };
const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.goto(`${URL_BASE}?town&fresh&mute&cls=sword`); await page.waitForFunction(() => window.__READY && game.player && game.scene === 'town', null, { timeout: 30000 });
const r = await page.evaluate(() => {
  while (menus.stack.length) menus.close(menus.stack[menus.stack.length - 1]);
  game.lvl = 30; game.job = 'berserker'; save.data.job = 'berserker';
  for (const id of Object.keys(SKILLS)) if (SKILLS[id].cls === 'sword' && (!SKILLS[id].job || SKILLS[id].job === 'berserker') && !SKILLS[id].passive) game.skillLv[id] = 1;
  const bar = Object.keys(SKILLS).filter(id => game.skillLv[id] && !SKILLS[id].buff && !SKILLS[id].whenHit && !SKILLS[id].awaken).slice(0, 14); game.skillBar = bar;
  save.data.fatigue = FATIGUE_MAX; enterDungeon('lorien', 0); return touchBuffSkills(game.player, game.skillBar);
});
await page.waitForFunction(() => game.scene === 'dungeon', null, { timeout: 20000 }); await page.waitForTimeout(1500);
const vis = await page.evaluate(() => touch.buffBtns.filter(b => !b.classList.contains('hidden')).map(b => b._id));
check(r.includes('frenzy') && vis.length === r.length && vis.length > 0, `状态键：${vis.join(' / ')}（狂暴之力在里面，没在技能栏里的 Buff 都显示）`);
const box = await page.evaluate(() => { const b = touch.buffBtns[0].getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; });
const before = await page.evaluate(id => game.player.cool[id] || 0, vis[0]);
await page.touchscreen.tap(box.x, box.y); await page.waitForTimeout(500);
const after = await page.evaluate(id => ({ cd: game.player.cool[id] || 0, act: game.player.act && game.player.act.skill, buffs: Object.keys(game.player.buffs) }), vis[0]);
check(before === 0 && after.cd > 0 && after.buffs.includes(vis[0]), `点一下就放：${vis[0]} 进冷却、Buff 生效`, JSON.stringify(after));
check(!errs.length, '没有报错', errs.slice(0, 2).join(' | '));

await browser.close(); console.log(fails ? `✗ ${fails} 项失败` : '✓ 全部通过'); process.exit(fails ? 1 : 0);
