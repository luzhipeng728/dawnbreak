// 男格斗家（B9）决斗：AI 用得出各转职的主要技能 + 抓取在决斗里公平（抓取保护 / 强制硬直上限 / 没有无限连）+ 决斗表登记
// 用法：node test/fighter_pvp.mjs [rows,ai,grab]（默认全部，约 40 秒）；AI=每个转职打几场（默认 24）
// 无渲染快进（直接调 step），和 test/pvp_balance.mjs 一样；网址带 ?fighter=1（格斗家还没开放也能测）
import { launch, URL_BASE } from './lib.mjs';
const parts = (process.argv[2] || 'rows,ai,grab').split(',');
const N = +(process.env.AI || 24);
const { browser, page, logs } = await launch({ width: 640, height: 360 });
await page.goto(`${URL_BASE}?duel=fighter&vs=sword&auto&ai=3&mute&fighter=1`);
await page.waitForFunction(() => window.__READY && game.duel, null, { timeout: 60000 });
await page.evaluate(async () => { await loadBundles(openClasses().map(c => 'spr:' + c)); game.paused = true; window.toastMsg = () => {}; });
let fails = 0;
const ok = (c, msg, x) => { if (c) console.log('✓', msg); else { fails++; console.log('✗', msg, x !== undefined ? JSON.stringify(x).slice(0, 600) : ''); } };
const JOBS = ['', 'nenmaster', 'striker', 'brawler', 'grappler'];

if (parts.includes('rows')) {
  const r = await page.evaluate(() => ({ base: !!DUEL_BASE.fighter, jobs: ['', 'nenmaster', 'striker', 'brawler', 'grappler'].map(j => PVP_JOB['fighter:' + j]), pool: aiKit('fighter', 'grappler', 30).pool.length, bar: aiKit('fighter', 'grappler', 30).bar.filter(Boolean).length }));
  ok(r.base && r.jobs.every(v => v !== undefined), 'DUEL_BASE.fighter / PVP_JOB 5 行（未转职 + 4 转职）都登记了', r);
  ok(r.pool > r.bar, `AI 技能池比技能栏大（柔道家 ${r.pool} 个 > ${r.bar} 格）`, r);
}

// 一个转职打 N 场（对手轮换），统计每个技能放了几次；抓取的公平性顺便记下来
async function runJob(job, n, opps) {
  return page.evaluate(({ job, n, opps }) => {
    const cnt = {}, G = { grabs: 0, regrabFast: 0, maxHeld: 0, maxLock: 0, maxHold: 0, rounds: 0, secs: 0 };
    const cs0 = castSkill; let F = null;
    castSkill = function (p, id, ...r) { const ok = cs0.call(this, p, id, ...r); if (ok && p === F) cnt[id] = (cnt[id] || 0) + 1; return ok; };
    try {
      for (let k = 0; k < n; k++) {
        const [cb, jb] = opps[k % opps.length].split(':'), me = k % 2 === 0;
        duel.start({ a: me ? 'fighter' : cb, ja: me ? job || null : jb || null, b: me ? cb : 'fighter', jb: me ? jb || null : job || null, lv: DUEL_CFG.lv, ai: 3, auto: true, theme: 'ruinsDark' });
        F = me ? duel.a : duel.b; const V = me ? duel.b : duel.a;
        let held = 0, lock = 0, relT = -9, wasHeld = false, holdT = 0;
        for (let i = 0; i < 60 * 60 * 1.3 && duel.state !== 'result' && duel.state !== 'done'; i++) {
          step(1 / 60);
          if (duel.state !== 'fight' || game.timeStop > 0) continue;   // 觉醒定格（双方都停）不算
          const h = V.st === 'held' && V.heldBy === F;
          if (h && !wasHeld) { G.grabs++; if (game.t - relT < PVP.grabProt - 0.05) G.regrabFast++; }
          if (!h && wasHeld) relT = game.t;
          wasHeld = h; held = h ? held + 1 / 60 : 0; G.maxHeld = Math.max(G.maxHeld, held);
          const locked = !V.dead && !(V.free || V.st === 'act');
          lock = locked ? lock + 1 / 60 : 0; G.maxLock = Math.max(G.maxLock, lock);
          const hs = V.status && V.status.hold; holdT = hs ? holdT + 1 / 60 : 0; G.maxHold = Math.max(G.maxHold, holdT);
        }
        G.rounds++; const L = duel.roundLog || []; duel.roundLog = []; G.secs += L.length ? L[0].time : 0;
      }
    } finally { castSkill = cs0; }
    const pool = aiKit('fighter', job || null, DUEL_CFG.lv).pool;
    return { cnt, G, pool };
  }, { job, n, opps });
}
const OPPS = ['sword:blade', 'gun:ranger', 'mage:elemental', 'sword:berserker', 'gun:mechanic', 'mage:battlemage', 'fighter:grappler', 'fighter:nenmaster'];
const RARE = {};   // 以后真有 AI 用不出来的技能（例：要特殊前置、决斗里没机会），写 id: '理由'
const MAIN = { grappler: ['fg_snapshot', 'fg_airsteiner', 'fg_cannonspike', 'fg_fling', 'fg_slamkick', 'fg_breakdown'], '': ['f_airwalk', 'f_knee', 'f_seismic'], nenmaster: ['fn_tiger', 'fn_spiral', 'fn_cannon'], striker: ['fs_dragon', 'fs_mortal', 'fs_awaken'], brawler: ['fb_poison', 'fb_net', 'fb_mount', 'fb_hook'] };
const grabStats = {};
for (const job of JOBS) {
  if (!parts.includes('ai') && !(parts.includes('grab') && (job === 'grappler' || job === 'brawler'))) continue;
  const r = await runJob(job, N, OPPS);
  grabStats[job] = r.G;
  if (!parts.includes('ai')) continue;
  const own = r.pool.filter(id => job ? id.startsWith({ nenmaster: 'fn_', striker: 'fs_', brawler: 'fb_', grappler: 'fg_' }[job]) : id.startsWith('f_'));
  let miss = own.filter(id => !r.cnt[id] && !RARE[id]), n = N;
  for (let k = 0; k < 2 && miss.length; k++) {   // 随机选技能：个别技能一批没轮到就再打一批（看的是“会不会用”，不是频率）
    const r2 = await runJob(job, N, OPPS); n += N;
    for (const [id, v] of Object.entries(r2.cnt)) r.cnt[id] = (r.cnt[id] || 0) + v;
    miss = own.filter(id => !r.cnt[id] && !RARE[id]);
  }
  const top = Object.entries(r.cnt).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + ':' + v).join(' ');
  console.log(`  ${job || '未转职'}（${n} 场）：${top}`);
  ok(!miss.length, `${job || '未转职'}：AI 用到了本转职全部 ${own.length} 个主动技能（${Object.keys(RARE).filter(k => own.includes(k)).join(' / ') || '无'} 例外）`, miss);
  ok(MAIN[job].every(id => r.cnt[id] > 0), `${job || '未转职'}：招牌技能都用过（${MAIN[job].join(' / ')}）`, MAIN[job].map(id => id + ':' + (r.cnt[id] || 0)));
}
if (parts.includes('grab')) for (const job of ['grappler', 'brawler']) {
  const G = grabStats[job]; console.log(`  ${job} 抓取：${JSON.stringify(G)}`);
  ok(G.grabs >= (job === 'grappler' ? N : N / 4), `${job}：决斗里 AI 会抓人（${G.grabs} 次 / ${N} 场）`, G);
  ok(G.regrabFast === 0, `${job}：放开后 ${'1.5'} 秒内（抓取保护）没有再被抓住`, G);
  ok(G.maxHeld < 4.2, `${job}：一次最多被抓 ${G.maxHeld.toFixed(2)} 秒（上限 4 秒）`, G);
  ok(G.maxHold <= 1.05, `${job}：决斗里强制硬直（hold）最长 ${G.maxHold.toFixed(2)} 秒（≤1 秒）`, G);
  ok(G.maxLock < 15, `${job}：对手连续不能行动最长 ${G.maxLock.toFixed(1)} 秒（没有无限连；抓取 + 觉醒接觉醒的长连段，老职业同样量法：阿修罗 17 秒、枪炮师 7 秒）`, G);
}
const errs = logs.filter(l => l.type === 'pageerror');
ok(!errs.length, '没有页面报错', errs.slice(0, 3));
await browser.close();
console.log(fails ? `\n${fails} 项失败` : '\n全部通过');
process.exit(fails ? 1 : 0);
