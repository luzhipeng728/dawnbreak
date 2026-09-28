// 魔法师（女）基础技能行为回归（docs/skills/mage_behavior.md 基础部分）：
//   跑攻打空扑倒 / 打中不扑倒、落花掌按住后方向原地出掌 / 满蓄突进更远、赫德尔自我加速、杰克爆弹纵深追踪
// 用法：node test/mage.mjs（约 10 秒）
import { launch, URL_BASE } from './lib.mjs';
const { browser, page, logs } = await launch();
await page.goto(`${URL_BASE}?test&mute&cls=mage&mobs=0`); await page.waitForFunction(() => window.__READY, null, { timeout: 30000 });
const r = await page.evaluate(() => {
  game.paused = true; const p = game.player, out = {};
  const stepN = n => { for (let i = 0; i < n; i++) step(1 / 60); };
  const reset = () => { for (const k in input.virt) delete input.virt[k]; input.buf.length = 0; input.dirHist.length = 0; input.down.clear();
    clearAllSummons('t'); for (const e of ents) if (e !== p) e.remove = true; stepN(1); projs.length = 0; groundFx.length = 0;
    Object.assign(p, { x: 300, y: 100, z: 0, vx: 0, vy: 0, vz: 0, face: 1, act: null, cool: {}, buffs: {}, invul: 0 }); p.mp = p.mpMax = 99999; p.setState('idle'); stepN(2); };
  const dummy = (x, y = 100) => { const m = spawnMonster('goblin', x, y); m.control = null; m.act = null; m.hp = m.hpMax = 1e9; m.evade = 0; m.invul = 0; m.face = -1; m.setState('idle'); return m; };
  // 1) 跑攻打空 → 扑倒
  reset(); p.doAct(p.acts.dash); let trip = false; for (let i = 0; i < 60; i++) { stepN(1); if (p.act && p.act.name === 'mg_trip') trip = true; } out.dashMissTrip = trip;
  // 2) 跑攻打中 → 不扑倒
  reset(); const d2 = dummy(350); let nh = 0; const ah = window.applyHit; window.applyHit = function (a, t) { if (t === d2) nh++; return ah.apply(this, arguments); };
  p.doAct(p.acts.dash); trip = false; for (let i = 0; i < 60; i++) { stepN(1); if (p.act && p.act.name === 'mg_trip') trip = true; } out.dashHitTrip = trip; out.dashHits = nh; window.applyHit = ah;
  // 3) 落花掌：点按 / 满蓄 / 按住后方向（原地）
  const palm = (dir, hold) => { reset(); game.skillLv.mg_palm = 5; game.skillBar[0] = 'mg_palm'; input.virt.s0 = 2; stepN(1); if (!hold) delete input.virt.s0;
    if (dir) input.virt[dir] = 2; const x0 = p.x; let x1 = p.x; for (let i = 0; i < 60; i++) { stepN(1); if (hold && i === 24) delete input.virt.s0; if (p.act && p.act.name === 'mg_palm') x1 = p.x; } if (dir) delete input.virt[dir]; return Math.round(x1 - x0); };
  out.palmTap = palm(null, false); out.palmFull = palm(null, true); out.palmBack = palm('left', false);
  // 4) 赫德尔：自我加速
  reset(); dummy(500); const s = summon(p, 'hodor', { lv: 5 }); let haste = false; for (let i = 0; i < 60 * 30 && !haste; i++) { stepN(1); if (s.buffs && s.buffs.haste) haste = true; } out.hodorHaste = haste;
  // 5) 杰克爆弹：目标偏离纵深 40px 也能追上
  reset(); const m = dummy(560, 140); game.skillLv.mg_jack = 5; game.skillBar[0] = 'mg_jack'; const hp0 = m.hp; input.virt.s0 = 2; stepN(1); delete input.virt.s0; stepN(90); out.jackHoming = m.hp < hp0;
  return out;
});
console.log(JSON.stringify(r));
const errs = logs.filter(l => l.type === 'error');
const ok = r.dashMissTrip && !r.dashHitTrip && r.palmBack < 20 && r.palmFull > r.palmTap && r.hodorHaste && r.jackHoming && !errs.length;
if (errs.length) console.log('页面报错：', errs.slice(0, 3));
console.log(ok ? 'OK 魔法师基础行为' : 'FAIL 魔法师基础行为');
await browser.close(); process.exit(ok ? 0 : 1);
