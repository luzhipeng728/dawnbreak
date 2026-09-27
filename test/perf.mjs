// 帧率测试：测试房间里持续战斗（普攻 + 轮流放技能），统计逻辑 step / 渲染的耗时与帧率。node test/perf.mjs sword,gun,mage [秒]
import { launch, URL_BASE } from './lib.mjs';
const classes = (process.argv[2] || 'sword,gun,mage').split(','), secs = +(process.argv[3] || 8);
let fail = 0;
for (const cls of classes) {
  const { browser, page, logs } = await launch({ width: 1280, height: 720 });
  await page.goto(`${URL_BASE}?test&mute&cls=${cls}&mobs=8`);
  await page.waitForFunction(() => window.__READY);
  const r = await page.evaluate(async ({ secs }) => {
    const p = __G.player, T = { step: 0, render: 0, n: 0, r: 0, worstStep: 0, worstRender: 0 };
    p.mpMax = p.mp = 99999;
    const s0 = window.step, r0 = window.renderWorld;
    window.step = dt => { const t = performance.now(); s0(dt); const d = performance.now() - t; T.step += d; T.n++; T.worstStep = Math.max(T.worstStep, d); };
    window.renderWorld = () => { const t = performance.now(); r0(); const d = performance.now() - t; T.render += d; T.r++; T.worstRender = Math.max(T.worstRender, d); };
    const bar = game.skillBar.filter(Boolean); let i = 0, frames = 0, t0 = performance.now();
    const iv = setInterval(() => { p.hp = p.hpMax; p.mp = p.mpMax; for (const k in p.cool) p.cool[k] = 0; if (__G.ents.filter(e => e.team === 'e' && !e.dead).length < 5) for (let j = 0; j < 4; j++) __G.spawnMonster('goblin', p.x + 120 + j * 50, 40 + j * 40);
      const V = input.virt; for (const k in V) delete V[k]; V.attack = 2; if (i++ % 3 === 0) V['s' + (i % Math.max(1, bar.length))] = 2; }, 250);
    await new Promise(res => { const f = () => { frames++; if (performance.now() - t0 < secs * 1000) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); });
    clearInterval(iv);
    return { fps: +(frames / secs).toFixed(1), stepMs: +(T.step / T.n).toFixed(2), renderMs: +(T.render / T.r).toFixed(2), worstStep: +T.worstStep.toFixed(1), worstRender: +T.worstRender.toFixed(1), fx: __G.fxList.length, projs: __G.projs.length, ents: __G.ents.length };
  }, { secs });
  const errs = logs.filter(l => l.type !== 'warning');
  const ok = r.fps >= 55 && errs.length === 0;
  if (!ok) fail++;
  console.log(cls, ok ? 'OK ' : 'LOW', JSON.stringify(r), errs.length ? JSON.stringify(errs.slice(0, 3)) : '');
  await browser.close();
}
// 决斗场（AI 对 AI，正常速度，不截图）
if (process.env.DUEL !== '0') {
  const { browser, page, logs } = await launch({ width: 1280, height: 720 });
  await page.goto(`${URL_BASE}?duel=sword&vs=mage&auto&ai=3&mute`); await page.waitForFunction(() => window.__READY);
  const r = await page.evaluate(async secs => { let frames = 0; const t0 = performance.now(); let minFps = 99;
    await new Promise(res => { const f = () => { frames++; if (performance.now() - t0 < secs * 1000) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); });
    return { fps: +(frames / secs).toFixed(1), fx: __G.fxList.length, projs: __G.projs.length }; }, secs * 2);
  const errs = logs.filter(l => l.type !== 'warning'), ok = r.fps >= 55 && !errs.length; if (!ok) fail++;
  console.log('duel', ok ? 'OK ' : 'LOW', JSON.stringify(r), errs.length ? JSON.stringify(errs.slice(0, 3)) : '');
  await browser.close();
}
process.exit(fail ? 1 : 0);
