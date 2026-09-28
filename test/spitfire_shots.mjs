// 弹药专家技能截图（目测特效 / 动作用，不算回归测试）：node test/spitfire_shots.mjs [技能id,...] → test/shots/spitfire/*.png
import { launch, URL_BASE } from './lib.mjs';
import fs from 'fs';
const out = 'test/shots/spitfire'; fs.mkdirSync(out, { recursive: true });
const ids = (process.argv[2] || 'gs_overcharge,gs_m18,gs_cross,gs_g35,gs_g18,gs_buster,gs_c4,gs_napalm,gs_lockon,gs_emp,gs_g61,gs_chelli,gs_openfire,gs_photon,gs_dday,gs_standby,gs_final').split(',');
const { browser, page, logs } = await launch({ width: 1280, height: 720 });
await page.goto(`${URL_BASE}?test&cls=gun&mobs=0&mute`); await page.waitForFunction(() => window.__READY, null, { timeout: 30000 });
await page.evaluate(() => {
  game.paused = true;
  window.T = { run(n) { for (let i = 0; i < n; i++) step(1 / 60); } };
  game.job = 'spitfire'; if (save.data) { save.data.job = 'spitfire'; qdata().flags.awaken = qdata().flags.awaken2 = qdata().flags.awaken3 = true; }
  const L = game.skillLv; for (const id of classSkills('gun', 'spitfire')) L[id] = Math.min(SKILLS[id].maxLv, 5);
  onJobChange(game.player, 'spitfire');
  const p = game.player; p.buffs.gs_overcharge = { t: 1e9, lv: 5, elem: 'fire', dmg: 0.15 }; p.buffs.gs_burst = { t: 1e9, lv: 5 };
});
const shots = { gs_overcharge: [12], gs_m18: [20, 60], gs_cross: [12, 20], gs_g35: [30, 44], gs_g18: [30, 44], gs_buster: [30, 58], gs_c4: [24, 50, 'recast', 20], gs_napalm: [22, 60],
  gs_lockon: [40, 70], gs_emp: [60, 90, 160, 220], gs_g61: [60, 150, 200], gs_chelli: [20, 60, 'recast', 10], gs_openfire: [30, 60, 90], gs_photon: [30, 50, 80], gs_dday: [60, 110, 170, 250],
  gs_standby: [40, 90, 'recast', 60], gs_final: [60, 100, 160, 200, 230] };
for (const id of ids) {
  await page.evaluate(() => { for (const e of ents) if (e !== game.player) e.remove = true; T.run(1); projs.length = 0; clearAllSummons('round');
    const p = game.player; if (p.act) p.endAct(); Object.assign(p, { x: 360, y: 110, z: 0, vx: 0, vy: 0, vz: 0, face: 1, cool: {}, charges: {}, invul: 0 }); p.mp = p.mpMax; p.setState('idle'); T.run(2);
    for (const [x, y] of [[520, 70], [600, 130], [680, 90], [760, 150], [560, 180]]) { const m = spawnMonster('goblin', x, y); m.control = null; m.hp = m.hpMax = 1e9; } T.run(2); });
  const seq = shots[id] || [20, 60]; let last = 0, n = 0;
  await page.evaluate(id => { const p = game.player; p.cool = {}; castSkill(p, id); }, id);
  for (const s of seq) {
    if (s === 'recast') { await page.evaluate(id => { const p = game.player; p.cool = {}; castSkill(p, id); }, id); continue; }
    await page.evaluate(n => T.run(n), s - last); last = s;
    await page.evaluate(() => { renderWorld(); ui.draw(); });
    await page.screenshot({ path: `${out}/${id}-${n++}.png` });
  }
}
const errs = logs.filter(l => l.type !== 'warning'); console.log('errors', JSON.stringify(errs.slice(0, 5)));
await browser.close();
