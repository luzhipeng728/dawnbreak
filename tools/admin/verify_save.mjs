// 校验 maxout 的结果：把 maxed.json 里每个角色进城一次、截个人信息图，确认存档能正常加载
import fs from 'fs';
// 把 maxed.json 里的每个角色进城一次、打开个人信息截图（<工作目录>/maxed_<序号>.png），确认没有报错
import { launch, URL_BASE } from '../../test/lib.mjs';
const S = process.argv[2], saved = JSON.parse(fs.readFileSync(S + '/maxed.json', 'utf8'));
const { browser, page, logs } = await launch({ width: 1280, height: 720 });
await page.goto(`${URL_BASE}?town&mute&cls=gun`); await page.waitForFunction(() => window.__READY && game.player && game.scene === 'town', null, { timeout: 60000 });
for (let i = 0; i < saved.chars.length; i++) {
  const r = await page.evaluate(async ({ saved, i }) => {
    localStorage.setItem(save.key, JSON.stringify(saved)); save.loadAll(); save.select(i);
    await startGame(save.data.cls); await new Promise(r => setTimeout(r, 1500));
    const aw = Object.keys(game.skillLv).filter(id => SKILLS[id] && SKILLS[id].awaken && game.skillLv[id] > 0);
    return { name: save.data.name, job: game.job, lvl: game.lvl, scene: game.scene, aw, bar: game.skillBar.map(id => id && SKILLS[id].name) };
  }, { saved, i });
  console.log(JSON.stringify(r));
  await page.keyboard.press('KeyM'); await page.waitForTimeout(700);
  await page.screenshot({ path: `${S}/maxed_${i}.png` });
  await page.keyboard.press('KeyM'); await page.waitForTimeout(300);
}
console.log('errors:', logs.filter(l => l.type === 'pageerror').map(l => l.text.slice(0, 200)));
await browser.close();
