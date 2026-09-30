// 决斗节奏统计（B9）：一局打多久（击杀用时 / 超时比例）、连招多长（每次连招的段数 / 时长 / 伤害占 HP 比例），AI 难度 3 循环赛，无渲染快进
// 用法：node test/duel_stats.mjs [每对几场=2] [只跑含这些的组合，逗号分隔；all = 全部]   → 打印汇总，写 test/shots/duel_stats.json
// “连招”= 对手从挨第一下到重新能行动（free / 出招）之间挨的所有命中；觉醒定格（timeStop）不算时间
import fs from 'node:fs';
import { launch, URL_BASE } from './lib.mjs';
const N = +(process.argv[2] || 2), only = (process.argv[3] || '').split(',').filter(x => x && x !== 'all');
const { browser, page, logs } = await launch({ width: 640, height: 360 });
await page.goto(`${URL_BASE}?duel=sword&vs=gun&auto&ai=3&mute&fighter=1`);
await page.waitForFunction(() => window.__READY && game.duel, null, { timeout: 60000 });
const combos = await page.evaluate(async () => { await loadBundles(openClasses().map(c => 'spr:' + c)); game.paused = true; window.toastMsg = () => {}; return openClasses().flatMap(c => [c + ':', ...openJobs(c).map(j => c + ':' + j)]); });
const pairs = []; for (let i = 0; i < combos.length; i++) for (let j = i + 1; j < combos.length; j++) if (!only.length || only.some(o => combos[i] === o || combos[j] === o)) pairs.push([combos[i], combos[j]]);
const all = { rounds: 0, secs: [], timeouts: 0, combos: [] }, per = {};
for (const [x, y] of pairs) {
  const r = await page.evaluate(({ x, y, N }) => {
    const out = [];
    for (let n = 0; n < N; n++) {
      const [a, b] = n % 2 ? [y, x] : [x, y], [ca, ja] = a.split(':'), [cb, jb] = b.split(':');
      duel.start({ a: ca, ja: ja || null, b: cb, jb: jb || null, lv: DUEL_CFG.lv, ai: 3, auto: true, theme: 'ruinsDark' });
      const P = [duel.a, duel.b], C = [null, null], done = [];
      for (let i = 0; i < 60 * 60 * 4 && duel.state !== 'result' && duel.state !== 'done'; i++) {
        const hp0 = P.map(p => p.hp); step(1 / 60);
        if (duel.state !== 'fight' || game.timeStop > 0) continue;
        P.forEach((p, k) => {
          const hit = p.hp < hp0[k], free = p.free || p.st === 'act';
          if (hit && !C[k]) C[k] = { by: P[1 - k].cls + ':' + ((P[1 - k].kit && P[1 - k].kit.job) || ''), vs: p.cls + ':' + ((p.kit && p.kit.job) || ''), hits: 0, t: 0, dmg: 0, sk: {} };
          const c = C[k]; if (!c) return;
          if (hit) { c.hits++; c.dmg += hp0[k] - p.hp; const o = P[1 - k], a = o.act && (o.act.skill || o.act.name); if (a) c.sk[a] = 1; if (p.status) for (const s in p.status) if (p.status[s].dps) c.sk['dot:' + s] = 1; }
          if (free || p.dead) { done.push({ by: c.by, vs: c.vs, hits: c.hits, t: +c.t.toFixed(2), pct: +(c.dmg / p.hpMax * 100).toFixed(1), sk: Object.keys(c.sk).slice(0, 12).join(','), dead: p.dead }); C[k] = null; } else c.t += 1 / 60;
        });
      }
      const L = duel.roundLog || []; duel.roundLog = [];
      out.push({ secs: L.map(q => q.time), to: L.map(q => q.hpA > 0 && q.hpB > 0), combos: done });
    }
    return out;
  }, { x, y, N });
  for (const d of r) { all.rounds += d.secs.length; all.secs.push(...d.secs); all.timeouts += d.to.filter(Boolean).length; all.combos.push(...d.combos); }
}
const avg = a => a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0, pc = (a, q) => { const s = [...a].sort((u, v) => u - v); return s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))] : 0; };
const real = all.combos.filter(c => c.hits >= 2);
for (const c of real) { const k = c.by; (per[k] ||= []).push(c); }
const S = {
  rounds: all.rounds, ttkAvg: +avg(all.secs).toFixed(1), ttkP50: pc(all.secs, 0.5), ttkP90: pc(all.secs, 0.9), timeoutPct: +(all.timeouts / Math.max(1, all.rounds) * 100).toFixed(1),
  combos: real.length, hitsAvg: +avg(real.map(c => c.hits)).toFixed(1), hitsP90: pc(real.map(c => c.hits), 0.9), hitsMax: Math.max(0, ...real.map(c => c.hits)),
  lenAvg: +avg(real.map(c => c.t)).toFixed(2), lenP90: pc(real.map(c => c.t), 0.9), lenMax: Math.max(0, ...real.map(c => c.t)),
  pctAvg: +avg(real.map(c => c.pct)).toFixed(1), pctP90: pc(real.map(c => c.pct), 0.9), pctMax: Math.max(0, ...real.map(c => c.pct)),
};
console.log(`决斗节奏（${pairs.length} 对 × ${N} 场，${S.rounds} 局）：`);
console.log(`  一局用时 平均 ${S.ttkAvg} 秒（中位 ${S.ttkP50}、90% ${S.ttkP90}），超时 ${S.timeoutPct}%`);
console.log(`  连招（≥2 段，${S.combos} 次）：段数 平均 ${S.hitsAvg}、90% ${S.hitsP90}、最多 ${S.hitsMax}；时长 平均 ${S.lenAvg} 秒、90% ${S.lenP90}、最长 ${S.lenMax.toFixed(1)}；伤害 平均 ${S.pctAvg}% HP、90% ${S.pctP90}%、最多 ${S.pctMax}%`);
const rows = Object.entries(per).map(([k, L]) => ({ k, n: L.length, hits: +avg(L.map(c => c.hits)).toFixed(1), len: +avg(L.map(c => c.t)).toFixed(2), maxLen: +Math.max(...L.map(c => c.t)).toFixed(1), pct: +avg(L.map(c => c.pct)).toFixed(1) })).sort((a, b) => b.maxLen - a.maxLen);
console.log('  各职业打出的连招（按最长排）：' + rows.map(r => `${r.k} ${r.hits}段/${r.len}s/最长${r.maxLen}s/${r.pct}%`).join('；'));
const top = [...real].sort((a, b) => b.pct - a.pct).slice(0, 5); console.log('  伤害最高的 5 次连招：' + top.map(c => `${c.by}→${c.vs} ${c.pct}% ${c.hits}段 ${c.t}s [${c.sk}]`).join(' | '));
fs.mkdirSync('test/shots', { recursive: true }); fs.writeFileSync('test/shots/duel_stats.json', JSON.stringify({ S, rows }, null, 1));
const errs = logs.filter(l => l.type === 'pageerror'); if (errs.length) console.log('页面报错', JSON.stringify(errs.slice(0, 3)));
await browser.close(); process.exit(errs.length ? 1 : 0);
