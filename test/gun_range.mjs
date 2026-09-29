// 神枪手技能判定范围体检：每个技能对着“单个”轻木桩施放多次（木桩逐个摆在不同距离 / 纵深），量出真正能打到的范围。
// 单木桩逐点量，避免不穿透的子弹 / 抓取被前面的木桩挡住；自动瞄准（aimAhead）、召唤物索敌、手雷落点都按真实距离生效。
// 页面测量代码复用 test/skillaudit.mjs 的 pageInit（同样的输入方式、规格里的 pre / input / presses / watch 等）。
// 摆位：身前 70/170/300/450/600/750/900（纵深 0）、身后 80/200、纵深 +30 / +60 / +90（身前 70 / 300 / 600）；人物在 x=300、y=100，房间足够宽。
// 输出：终端一张表 + test/shots/audit/range-<职业>-<转职>.json；--min：和 docs/skills/gun.json 里每个技能的 far（最小前伸）/ deep（最小纵深）对比，不够的退出码 1。
// 用法：node test/gun_range.mjs gun,gun:ranger,... [--only id1,id2] [--min]
import { launch, URL_BASE } from './lib.mjs';
import fs from 'fs';

const args = process.argv.slice(2), opt = {}, pos = [];
for (const a of args) { if (a.startsWith('--')) { const [k, v] = a.slice(2).split('='); opt[k] = v ?? true; } else pos.push(a); }
const list = (pos[0] || 'gun').split(',');
const only = opt.only ? new Set(opt.only.split(',')) : null;
const FWD = [70, 170, 300, 450, 600, 750, 900], BACK = [-80, -200], DYS = [30, 60, 90], DXS = [70, 300, 600], DEEP = DYS.flatMap(y => DXS.map(x => [x, y]));
const PTS = [...FWD.map(x => [x, 0]), ...BACK.map(x => [x, 0]), ...DEEP];
const src = fs.readFileSync(new URL('./skillaudit.mjs', import.meta.url), 'utf8');
const i0 = src.indexOf('function pageInit() {'), i1 = src.indexOf('\n}\n', i0);
let init = src.slice(i0, i1 + 2);
const OLD = "else for (const dx of [-80, 70, 170, 300, 450]) D.push(A.dummy('goblin', 300 + dx, 100, String(dx)));";
if (!init.includes(OLD)) { console.log('skillaudit.mjs 的木桩摆位代码变了，更新 gun_range.mjs 的 OLD'); process.exit(2); }
init = init.replace(OLD, "else for (const [dx, dy] of window.__PTS) D.push(A.dummy('goblin', 300 + dx, 100 + dy, dx + ',' + dy));");
const spec = JSON.parse(fs.readFileSync('docs/skills/gun.json', 'utf8')).skills;
const out = 'test/shots/audit'; fs.mkdirSync(out, { recursive: true });
const { browser, page, logs } = await launch({ width: 960, height: 540 });
let bad = 0;
for (const item of list) {
  const [cls, job] = item.split(':'), tag = `${cls}-${job || 'base'}`;
  await page.goto(`${URL_BASE}?test&mute&cls=${cls}&mobs=0`); await page.waitForFunction(() => window.__READY, null, { timeout: 30000 });
  await page.evaluate(`(${init})()`);
  await page.evaluate(() => { const R = game.room; if (R) { R.x0 = Math.min(R.x0, -400); R.x1 = Math.max(R.x1, 1600); } });
  const all = await page.evaluate(({ cls, job }) => AUD.skills(cls, job), { cls, job });
  const skills = all.filter(s => (!only || only.has(s.id)) && (job ? s.job === job : true));
  const res = {};
  console.log(`\n== ${tag}  前伸（纵深 0）/ 身后 / 纵深 → ${out}/range-${tag}.json`);
  console.log('技能                   │ 70 170 300 450 600 750 900 │后80 200│+30:70 300 600│+60:70 300 600│+90:70 300 600│ 前伸 纵深');
  for (const s of skills) {
    const sp = spec[`${s.id}@${job}`] || spec[s.id] || {};
    const o = { pre: sp.pre, hp: sp.hp, input: sp.input, holdT: sp.holdT, mashT: sp.mashT, dir: sp.dir, presses: sp.presses, watch: sp.watch, minWatch: sp.minWatch, air: sp.air, at: sp.at, airDelay: sp.airDelay, set: sp.set, learn: sp.learn };
    const hit = {};
    for (const [dx, dy] of PTS) {
      const r = await page.evaluate(({ id, o, pt }) => { window.__PTS = [pt]; return AUD.run(id, 'spread', o); }, { id: s.id, o, pt: [dx, dy] });
      hit[dx + ',' + dy] = r.skip ? -1 : (r.spread || {})[dx + ',' + dy] || 0;
    }
    const reach = Math.max(0, ...FWD.filter(x => hit[x + ',0'] > 0));
    const deep = Math.max(0, ...DEEP.filter(([x, y]) => hit[x + ',' + y] > 0).map(([, y]) => y));
    res[s.id] = { name: s.name, hit, reach, deep, back: Math.max(0, ...BACK.filter(x => hit[x + ',0'] > 0).map(x => -x)) };
    const c = k => String(hit[k] > 0 ? hit[k] : hit[k] < 0 ? 'x' : '·');
    let flag = '';
    if (opt.min && ((sp.far && reach < sp.far) || (sp.deep && deep < sp.deep))) { flag = ` ✗ 应 ≥ ${sp.far || 0} / ${sp.deep || 0}`; bad++; }
    console.log(`${(s.id + ' ' + s.name).padEnd(22).slice(0, 22)} │${FWD.map(x => c(x + ',0').padStart(3)).join(' ')} │${BACK.map(x => c(x + ',0').padStart(3)).join(' ')} │${DYS.map(y => DXS.map(x => c(x + ',' + y).padStart(3)).join(' ') + '   │').join('')} ${String(reach).padStart(4)} ${String(deep).padStart(3)}${flag}`);
  }
  fs.writeFileSync(`${out}/range-${tag}.json`, JSON.stringify(res, null, 1));
  const errs = logs.filter(l => l.type === 'pageerror'); if (errs.length) { console.log('  ✗ 页面报错：' + errs[0].text.slice(0, 160)); bad++; logs.length = 0; }
}
await browser.close();
process.exit(bad ? 1 : 0);
