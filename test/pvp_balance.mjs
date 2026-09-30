// 决斗场平衡：18 种职业 / 转职两两 AI 对打（难度 3，公正决斗规则），无渲染快进（直接调 step），统计每个职业的回合胜率
// 用法：node test/pvp_balance.mjs [每对打几场=2（左右各一场）] [只跑含这些的组合，逗号分隔，如 gun:spitfire；all = 全部] [自动调参轮数=0]
//   全部 153 对 × 6 场约 20~30 秒（无渲染快进）
// 输出：每个职业的回合胜率（35%~65% 以外标 ⚠）；完整矩阵写到 test/shots/pvp_balance.json。调参看 game/duel.js 的 PVP_JOB / PVP_SKILL（docs/PVP.md）
import fs from 'node:fs';
import { launch, URL_BASE } from './lib.mjs';
const N = +(process.argv[2] || 2), only = (process.argv[3] || '').split(',').filter(x => x && x !== 'all');
const { browser, page, logs } = await launch({ width: 640, height: 360 });
await page.goto(`${URL_BASE}?duel=sword&vs=gun&auto&ai=3&mute`);
await page.waitForFunction(() => window.__READY && game.duel, null, { timeout: 60000 });
const combos = await page.evaluate(async () => {
  await loadBundles(openClasses().map(c => 'spr:' + c));
  game.paused = true; window.toastMsg = () => {};
  return openClasses().flatMap(c => [c + ':', ...openJobs(c).map(j => c + ':' + j)]);   // 已开放的职业 / 转职（ready:false 的不进循环赛）
});
const pairs = [];
for (let i = 0; i < combos.length; i++) for (let j = i + 1; j < combos.length; j++) if (!only.length || only.some(o => combos[i] === o || combos[j] === o)) pairs.push([combos[i], combos[j]]);
const TUNE = +(process.argv[4] || 0);   // 第 3 个参数 > 0：自动调 PVP_JOB（每轮按胜率偏离 50% 的程度乘一个系数），最后打印调好的表
let W, R;   // W[x][y] = x 对 y 赢的回合数
const t0 = Date.now();
async function runAll() {
W = {}; R = {};
for (const c of combos) { W[c] = {}; R[c] = { win: 0, lose: 0, draw: 0 }; }
for (const [k, [x, y]] of pairs.entries()) {
  const res = await page.evaluate(({ x, y, N }) => {
    const out = [];
    for (let n = 0; n < N; n++) {
      const [a, b] = n % 2 ? [y, x] : [x, y], [ca, ja] = a.split(':'), [cb, jb] = b.split(':');
      duel.start({ a: ca, ja: ja || null, b: cb, jb: jb || null, lv: DUEL_CFG.lv, ai: 3, auto: true, theme: 'ruinsDark' });
      for (let i = 0; i < 60 * 60 * 3.6 && duel.state !== 'result' && duel.state !== 'done'; i++) step(1 / 60);
      const L = duel.roundLog || []; duel.roundLog = [];
      out.push({ a, b, rounds: L.map(r => r.winner), secs: L.map(r => r.time), hp: L.map(r => [r.hpA, r.hpB]) });
    }
    return out;
  }, { x, y, N });
  for (const d of res) for (const w of d.rounds) {
    if (w < 0) { R[d.a].draw++; R[d.b].draw++; continue; }
    const [win, lose] = w === 0 ? [d.a, d.b] : [d.b, d.a];
    R[win].win++; R[lose].lose++; W[win][lose] = (W[win][lose] || 0) + 1;
  }
  if (process.env.DBG) console.log(JSON.stringify(res));
  if (k % 50 === 49) console.log(`… ${k + 1}/${pairs.length} 对，${Math.round((Date.now() - t0) / 1000)} 秒`);
}
}
const rate = c => R[c].win / Math.max(1, R[c].win + R[c].lose);
for (let it = 0; it < TUNE; it++) {
  await runAll();
  const J = await page.evaluate(() => ({ ...PVP_JOB }));
  for (const c of combos) { const r = Math.min(0.95, Math.max(0.05, rate(c))); const o = J[c] ?? 1, v = Array.isArray(o) ? o[0] : o, nv = Math.round(Math.min(2.5, Math.max(0.5, v * Math.pow(0.5 / r, 0.6))) * 100) / 100; J[c] = Array.isArray(o) ? [nv, o[1]] : nv; }
  await page.evaluate(J => Object.assign(PVP_JOB, J), J);
  console.log(`第 ${it + 1} 轮：最高 ${Math.round(Math.max(...combos.map(rate)) * 100)}%，最低 ${Math.round(Math.min(...combos.map(rate)) * 100)}% → PVP_JOB = ${JSON.stringify(J)}`);
}
await runAll();
const name = await page.evaluate(L => Object.fromEntries(L.map(c => { const [a, j] = c.split(':'); return [c, j ? CLASSES[a].jobs[j].name : CLASSES[a].name + '（未转职）']; })), combos);
const rows = combos.filter(c => R[c].win + R[c].lose).map(c => ({ c, name: name[c], rate: R[c].win / (R[c].win + R[c].lose), ...R[c] })).sort((a, b) => b.rate - a.rate);
console.log(`\n回合胜率（${pairs.length} 对 × ${N} 场，AI 难度 3，用时 ${Math.round((Date.now() - t0) / 1000)} 秒）：`);
for (const r of rows) console.log(`${r.rate < 0.35 || r.rate > 0.65 ? '⚠' : ' '} ${(r.rate * 100).toFixed(0).padStart(3)}%  ${r.name.padEnd(8, '　')} ${r.win} 胜 ${r.lose} 负${r.draw ? ` ${r.draw} 平` : ''}  (${r.c})`);
fs.mkdirSync('test/shots', { recursive: true });
fs.writeFileSync('test/shots/pvp_balance.json', JSON.stringify({ n: N, rows, W }, null, 1));
const errs = logs.filter(l => l.type === 'pageerror');
if (errs.length) console.log('页面报错', JSON.stringify(errs.slice(0, 3)));
await browser.close();
process.exit(errs.length ? 1 : 0);
