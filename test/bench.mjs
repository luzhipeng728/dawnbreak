// 性能基准：在真实 GPU（Metal）、真实分辨率下测最重的几个场景，决定渲染方案用。
// 分别统计：逻辑 step、世界层绘制 renderWorld、界面层绘制 ui.draw 的 CPU 耗时；
// FLUSH=1 时每帧末尾用 getImageData 强制等 GPU 画完，得到“CPU + GPU”的真实成本。
// 用法：node test/bench.mjs [场景,...]   环境变量：W H DPR（默认 1728×962@2，和用户的 MacBook 一致）、SECS、FLUSH
import { chromium, URL_BASE } from './lib.mjs';
import { execSync } from 'child_process';
const W = +(process.env.W || 1728), H = +(process.env.H || 962), DPR = +(process.env.DPR || 2), SECS = +(process.env.SECS || 8), FLUSH = !!process.env.FLUSH;
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const SCENES = {
  town: { url: '?town&cls=gun&mute', setup: async p => { await p.evaluate(() => enterScene('hm_plaza')); await p.waitForTimeout(3000); } },
  fight: { url: '?test&cls=gun&mute&mobs=10', spam: 'launcher' },
  fight_mage: { url: '?test&cls=mage&mute&mobs=10', spam: 'elemental' },
  sky_boss: { url: '?test&cls=sword&mute&mon=seghart,knight,knight,expeller&lvl=21&boss', spam: 'blade' },
  duel: { url: '?duel=sword&vs=mage&auto&ai=3&mute' },
};
const pick = (process.argv[2] || Object.keys(SCENES).join(',')).split(',');
// Chrome 进程树的 CPU 占用（渲染进程 + GPU 进程 + 浏览器进程）
function cpuOf(rootPid) {
  const rows = execSync('ps -A -o pid=,ppid=,%cpu=,rss=').toString().trim().split('\n').map(l => l.trim().split(/\s+/).map(Number));
  const kids = new Map(); for (const [pid, pp] of rows) { if (!kids.has(pp)) kids.set(pp, []); kids.get(pp).push(pid); }
  const set = new Set([rootPid]), st = [rootPid]; while (st.length) for (const k of kids.get(st.pop()) || []) if (!set.has(k)) { set.add(k); st.push(k); }
  let cpu = 0, rss = 0; for (const [pid, , c, r] of rows) if (set.has(pid)) { cpu += c; rss += r; }
  return { cpu, rssMB: Math.round(rss / 1024) };
}
const results = [];
for (const name of pick) {
  const S = SCENES[name]; if (!S) { console.log('没有这个场景', name); continue; }
  const browser = await chromium.launch({ headless: true, executablePath: CHROME, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required', '--enable-precise-memory-info'] });
  const pid = browser.process ? browser.process()?.pid : null;
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: DPR });
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto(URL_BASE + S.url); await page.waitForFunction(() => window.__READY, null, { timeout: 60000 });
  await page.waitForTimeout(1500);
  if (S.setup) await S.setup(page);
  const gpu = await page.evaluate(() => { const gl = document.createElement('canvas').getContext('webgl2'); const e = gl && gl.getExtension('WEBGL_debug_renderer_info'); return e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : '?'; });
  const run = page.evaluate(async ({ secs, spam, flush }) => {
    const T = { step: [], world: [], ui: [], flush: [], iv: [] };
    const s0 = step, r0 = renderWorld, u0 = ui.draw.bind(ui);
    window.step = dt => { const t = performance.now(); s0(dt); T.step.push(performance.now() - t); };
    window.renderWorld = () => { const t = performance.now(); r0(); T.world.push(performance.now() - t); };
    ui.draw = () => { const t = performance.now(); u0(); T.ui.push(performance.now() - t);
      if (flush) { const f = performance.now(); wctx.getImageData(0, 0, 1, 1); uctx.getImageData(0, 0, 1, 1); T.flush.push(performance.now() - f); } };
    let iv = null;
    if (spam) {   // 持续战斗：普攻 + 轮流放转职技能（含觉醒），怪物不够就补
      const p = game.player; game.job = spam; (save.data.flags ??= {}).awaken = true;
      const ids = CLASSES[p.cls].jobs[spam].skills; for (const id of ids) game.skillLv[id] = 5;
      game.skillBar = ids.filter(id => !SKILLS[id].passive).concat(Array(12).fill(null)).slice(0, 12);
      p.mpMax = p.mp = 99999; let i = 0;
      iv = setInterval(() => { p.hp = p.hpMax; p.mp = p.mpMax; for (const k in p.cool) p.cool[k] = 0;
        if (ents.filter(e => e.team === 'e' && !e.dead).length < 6) for (let j = 0; j < 4; j++) spawnMonster('goblin', p.x + 120 + j * 50, 40 + j * 40);
        const V = input.virt; for (const k in V) delete V[k]; V.attack = 2; if (i++ % 2 === 0) V['s' + (i % game.skillBar.filter(Boolean).length)] = 2; }, 200);
    }
    let last = performance.now(); const t0 = last, peak = { fx: 0, ents: 0, projs: 0 };
    await new Promise(res => { const f = now => { T.iv.push(now - last); last = now; peak.fx = Math.max(peak.fx, fxList.length); peak.ents = Math.max(peak.ents, ents.length); peak.projs = Math.max(peak.projs, projs.length);
      if (now - t0 < secs * 1000) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); });
    if (iv) clearInterval(iv);
    const st = a => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y), q = k => +s[Math.min(s.length - 1, Math.floor(s.length * k))].toFixed(2); return { avg: +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(2), p95: q(0.95), p99: q(0.99), max: +s[s.length - 1].toFixed(1) }; };
    const iv2 = T.iv.slice(5);
    return { fps: +(1000 / (iv2.reduce((a, b) => a + b, 0) / iv2.length)).toFixed(1), jank20: iv2.filter(x => x > 20).length, jank50: iv2.filter(x => x > 50).length, frames: iv2.length,
      step: st(T.step), world: st(T.world), ui: st(T.ui), flush: st(T.flush), peak, heapMB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1e6) : null,
      canvas: { world: [wcan.width, wcan.height], ui: [ucan.width, ucan.height] } };
  }, { secs: SECS, spam: S.spam || null, flush: FLUSH });
  // 运行中间采样 CPU
  let cpuS = []; if (pid) { for (let k = 0; k < 4; k++) { await page.waitForTimeout(SECS * 1000 / 5); cpuS.push(cpuOf(pid)); } }
  const r = await run;
  r.cpu = cpuS.length ? Math.round(cpuS.reduce((a, b) => a + b.cpu, 0) / cpuS.length) + '%' : '?'; r.rssMB = cpuS.length ? cpuS[cpuS.length - 1].rssMB : '?';
  r.gpu = gpu; r.errors = errs.length;
  results.push({ name, ...r });
  console.log(`\n== ${name}  ${W}×${H}@${DPR}${FLUSH ? '（含 GPU 等待）' : ''}  GPU=${gpu}`);
  console.log(JSON.stringify(r));
  await browser.close();
}
