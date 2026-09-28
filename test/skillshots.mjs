// 技能连拍：测试房间里对着木桩（冻结的哥布林）逐个施放某职业 / 转职的全部技能，每个技能连拍 N 张角色附近的截图，
// 同时检查：技能能放出来（动作名正确）、放完能回到可行动状态、没有报错。输出 test/shots/skills/<职业>-<转职>-<技能>-<序号>.png
// node test/skillshots.mjs sword:blade,sword:berserker,gun:ranger,...  [每个技能的张数]
import { launch, URL_BASE } from './lib.mjs';
import fs from 'fs';
const out = 'test/shots/skills'; fs.mkdirSync(out, { recursive: true });
const list = (process.argv[2] || 'sword:blade').split(','), N = +(process.argv[3] || 6);
const SKILLS_AIR_DELAY = new Set(['silver', 'aircut']);
let fail = 0;
for (const item of list) {
  const [cls, job] = item.split(':');
  const { browser, page, logs } = await launch({ width: 1280, height: 720 });
  await page.goto(`${URL_BASE}?test&mute&cls=${cls}&mobs=0`); await page.waitForFunction(() => window.__READY);
  const ids = await page.evaluate(({ cls, job }) => {
    const p = game.player; game.job = job || null;
    const ids = classSkills(cls, job).filter(id => SKILLS[id].act && !SKILLS[id].passive);
    for (const id of classSkills(cls, job)) game.skillLv[id] = 5;
    p.mpMax = p.mp = 99999; setInterval(() => { p.mp = p.mpMax; p.hp = p.hpMax; }, 200);
    window.__dummy = () => { for (const e of ents) if (e.team === 'e') e.remove = true; const m = spawnMonster('goblin', p.x + 72, p.y); m.control = null; m.hp = m.hpMax = 1e9; m.invul = 0; return m; };
    return ids;
  }, { cls, job });
  const res = [];
  for (const id of ids) {
    const setup = await page.evaluate(id => {
      const p = game.player; p.x = 380; p.y = 100; p.z = 0; p.vz = 0; p.face = 1; p.setState('idle'); p.act = null; p.cool = {}; p.buffs = {}; p.chasers = [];
      for (let i = 0; i < 12; i++) game.skillBar[i] = null; game.skillBar[0] = id; __dummy(); projs.length = 0;
      if (SKILLS[id].airOnly) { p.vz = 420; p.z = 1; p.setState('jump'); }
      const S = SKILLS[id]; if (typeof S.whenHit === 'function' ? S.whenHit(p) : S.whenHit) { p.setState('hit'); p.stun = 0.8; }
      if (S.req && S.req(p) !== true) return 'pre';   // 前置条件不满足（例：咒令要求召唤兽在场），和 classes.mjs 一样跳过
      return S.instant ? 'instant' : true;
    }, id);
    if (setup === 'pre') { res.push(`-${id}`); continue; }
    if (SKILLS_AIR_DELAY.has(id)) await page.waitForTimeout(160);
    await page.keyboard.down('KeyA'); await page.waitForTimeout(40); await page.keyboard.up('KeyA');
    await page.waitForFunction(id => game.player.act && game.player.act.skill === id, id, { timeout: 500 }).catch(() => { });
    const got = await page.evaluate(() => game.player.act && game.player.act.skill);
    for (let i = 0; i < N; i++) {
      const pos = await page.evaluate(() => { const p = __G.player; return { x: (p.x - cam.x) * 1280 / 960, y: (FLOOR_Y + p.y - p.z) * 720 / 540 }; });
      await page.screenshot({ path: `${out}/${cls}-${job || 'base'}-${id}-${i}.png`, clip: { x: Math.max(0, Math.min(1280 - 420, pos.x - 150)), y: Math.max(0, Math.min(720 - 300, pos.y - 230)), width: 420, height: 300 } });
      await page.waitForTimeout(90);
    }
    await page.waitForTimeout(1800);
    const after = await page.evaluate(() => { const p = game.player; if (game.timeStop > 0) return 'timestop'; return p.st; });
    const ok = (got === id || (setup === 'instant' && !got)) && ['idle', 'jump', 'walk', 'run', 'act'].includes(after);   // 无动作施放的技能不进入动作
    if (!ok) fail++;
    res.push(`${ok ? '' : '✗'}${id}${got === id ? '' : '(放出:' + got + ')'}${after === 'idle' || after === 'jump' ? '' : '[' + after + ']'}`);
  }
  const errs = logs.filter(l => l.type !== 'warning');
  if (errs.length) fail++;
  console.log(`${cls}:${job || 'base'} ${ids.length} 个技能：`, res.join(' '), errs.length ? '\nERR ' + JSON.stringify(errs.slice(0, 4)) : '');
  await browser.close();
}
process.exit(fail ? 1 : 0);
