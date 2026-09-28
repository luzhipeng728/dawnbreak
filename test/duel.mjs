// 决斗场测试：AI 对 AI 自动打完三局两胜（?duel=A&vs=B&auto），统计双方施放的技能、造成的伤害、受身 / 后跳 / 后跳-强化次数、抓取、保护触发、帧率
// node test/duel.mjs sword:gun,gun:mage,mage:sword [速度倍率]
import { launch, URL_BASE } from './lib.mjs';
import fs from 'fs';
const out = 'test/shots/duel'; fs.mkdirSync(out, { recursive: true });
const pairs = (process.argv[2] || 'sword:gun,gun:mage,mage:sword').split(','), speed = +(process.argv[3] || 3);
let fail = 0;
for (const pr of pairs) {
  const [a, b, ja, jb] = pr.split(':');
  const { browser, page, logs } = await launch({ width: 1280, height: 720 });
  await page.goto(`${URL_BASE}?duel=${a}&vs=${b}${ja ? '&job=' + ja : ''}${jb ? '&vsjob=' + jb : ''}&auto&ai=3&mute`);
  await page.waitForFunction(() => window.__READY, null, { timeout: 30000 });
  await page.evaluate(s => {
    game.speedMul = s;
    const S = window.__duelStats = { cast: [{}, {}], dmg: [0, 0], tech: [0, 0], back: [0, 0], bsup: [0, 0], grab: [0, 0], counter: [0, 0], airProt: [0, 0], fpsMin: 99, frames: 0 };
    const side = p => p === duel.a ? 0 : 1;
    const c0 = window.castSkill; window.castSkill = (p, id, v, k) => { const r = c0(p, id, v, k); if (r && p.act && p.act.skill === id) S.cast[side(p)][id] = (S.cast[side(p)][id] || 0) + 1; return r; };
    const h0 = window.applyHit; window.applyHit = (a, t, h, o) => { const hp = t.hp, ctr = isCounter(t), ok = h0(a, t, h, o); if (t.fighter && a.fighter) { S.dmg[side(a)] += Math.max(0, hp - t.hp); if (ctr && ok) S.counter[side(a)]++; if (airProtLv(t) > 0) S.airProt[side(t)]++; } return ok; };
    const g0 = window.startGrab; window.startGrab = (a, t, h) => { S.grab[side(a)]++; return g0(a, t, h); };
    const t0 = window.tryTech; window.tryTech = p => { const r = t0(p); if (r) S.tech[side(p)]++; return r; };
    const d0 = window.doBackstep; window.doBackstep = (p, m) => { if (m === 'up') S.bsup[side(p)]++; return d0(p, m); };   // 后跳-强化（技能中后跳 / 受击中脱身）
    const e0 = window.escapeBackstep; window.escapeBackstep = p => { S.bsup[side(p)]++; return e0(p); };
    const a0 = Ent.prototype.doAct; Ent.prototype.doAct = function (def, ex) { if (def && def.name === 'back' && this.fighter) S.back[side(this)]++; return a0.call(this, def, ex); };
    setInterval(() => { if (duel.state === 'fight') S.fpsMin = Math.min(S.fpsMin, Math.round(fps)); }, 500);
  }, speed);
  const t0 = Date.now(); let res = null, n = 0;
  while (!res && Date.now() - t0 < 240000) {
    await page.waitForTimeout(2500);
    res = await page.evaluate(() => window.__duelDone || null);
    if (n++ % 3 === 0) await page.screenshot({ path: `${out}/${a}-${b}-${String(n).padStart(2, '0')}.png` });
  }
  const st = await page.evaluate(() => window.__duelStats);
  const errs = logs.filter(l => l.type !== 'warning');
  const used = st.cast.map(c => Object.keys(c).length);
  const ok = !!res && errs.length === 0 && used[0] >= 3 && used[1] >= 3 && st.dmg[0] > 0 && st.dmg[1] > 0;
  if (!ok) fail++;
  console.log(`${pr}: ${ok ? 'OK' : 'FAIL'}`, JSON.stringify({ result: res, skillsUsed: used, casts: st.cast, dmg: st.dmg.map(Math.round), tech: st.tech, backstep: st.back, bsup: st.bsup, grabs: st.grab, counters: st.counter, airProtHits: st.airProt, fpsMin: st.fpsMin }));
  if (errs.length) console.log('ERR', JSON.stringify(errs.slice(0, 5), null, 1));
  await browser.close();
}
process.exit(fail ? 1 : 0);
