// 任务经验 / 金币汇总（不开浏览器）：按任务等级分段，统计每段任务经验合计是“当级升级所需经验”的多少倍
// 用法：node test/qbalance.mjs [职业，默认 sword]   （只算一个职业的转职链；每日任务单独列出，按每天计）
import fs from 'fs';
const cls = process.argv[2] || 'sword';
const Q = [], g = globalThis;
g.expNeed = lv => lv;   // 只关心比例：qexp(lv, f) 记成 { lv, f }
g.qexp = (lv, f) => ({ __lv: lv, __f: f });
g.defineQuest = (id, d) => Q.push({ id, type: 'side', ...d });
g.NPCS = {}; g.CLASSES = { sword: { name: '鬼剑士' }, gun: { name: '神枪手' }, mage: { name: '魔法师' } }; g.qNpcName = x => x;
const root = new URL('..', import.meta.url).pathname;
for (const f of fs.readdirSync(root + 'src/content/quests').filter(f => f.endsWith('.js')).sort((a, b) => (a === 'main.js' ? -1 : b === 'main.js' ? 1 : a.localeCompare(b))))
  (0, eval)(fs.readFileSync(root + 'src/content/quests/' + f, 'utf8').replace(/^const /gm, 'var '));
const band = {}, tot = {}, gold = {};
let daily = 0, dailyGold = 0;
for (const q of Q) {
  const R = q.reward || {};
  if (q.type === 'daily') { daily += R.expFrac || 0; dailyGold += R.gold || 0; continue; }
  if (q.cls && q.cls !== cls) continue;
  const f = (R.exp && R.exp.__f) || 0, b = band[q.lvl] || (band[q.lvl] = { main: 0, side: 0, hidden: 0, job: 0 });
  b[q.type] += f; tot[q.type] = (tot[q.type] || 0) + f; gold[q.type] = (gold[q.type] || 0) + (R.gold || 0);
}
console.log('任务等级\t合计\t主线\t支线\t隐藏\t转职');
for (const lv of Object.keys(band).sort((a, b) => a - b)) { const b = band[lv]; console.log(`Lv${lv}\t${(b.main + b.side + b.hidden + b.job).toFixed(2)}\t${b.main.toFixed(2)}\t${b.side.toFixed(2)}\t${b.hidden.toFixed(2)}\t${b.job.toFixed(2)}`); }
const all = Object.values(tot).reduce((s, v) => s + v, 0);
console.log(`总计 ${all.toFixed(2)} 级（${Object.entries(tot).map(([k, v]) => `${k} ${v.toFixed(2)}`).join('，')}）`);
console.log(`金币 ${Object.values(gold).reduce((s, v) => s + v, 0)} G（${Object.entries(gold).map(([k, v]) => `${k} ${v}`).join('，')}）`);
console.log(`每日任务：每天合计 ${daily.toFixed(2)} 级经验，${dailyGold} G`);
// 给装备组 test/econ.mjs 用的汇总表：任务等级 → [经验比例合计, 金币合计]
const econ = {};
for (const q of Q) { if (q.type === 'daily' || (q.cls && q.cls !== cls)) continue; const R = q.reward || {}, e = econ[q.lvl] || (econ[q.lvl] = [0, 0]); e[0] = +(e[0] + ((R.exp && R.exp.__f) || 0)).toFixed(2); e[1] += R.gold || 0; }
console.log('econ.mjs QUESTS =', JSON.stringify(econ));
