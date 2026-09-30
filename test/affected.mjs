// 只跑受影响的测试：按改动的文件挑测试，默认 2 路并行、低优先级，不卡电脑
// 用法：
//   node test/affected.mjs                 和 main 的分叉点比（在 main 上 = 只看没提交的改动）
//   node test/affected.mjs --base HEAD~3   指定比较起点
//   node test/affected.mjs --dry           只列出会跑哪些测试
//   node test/affected.mjs --no-build      已经构建过就跳过构建
//   node test/affected.mjs --only a,b      只跑挑出来的其中几项
//   J=1 node test/affected.mjs             并行数（默认 2）
// 规则表在下面 RULES：路径（正则）→ 测试。改了测试文件本身就跑它；只改 docs / 图片说明不跑测试。
// 改了核心文件（CORE）时会多跑冒烟测试，并提示合并前再跑一次 sh test/quick.sh。
// 和 quick.sh 共用一把全局锁（/tmp/dawnbreak-tests.lock）：同一时间只有一套测试在跑，别的会排队等。
import { execFileSync, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
process.chdir(ROOT);
const argv = process.argv.slice(2), flag = k => argv.includes(k), opt = k => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
const run = (cmd, args) => { try { return execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 << 20 }).trim(); } catch (e) { return ''; } };
const git = (...a) => run('git', a);

// ---- 改了哪些文件 ----
function changedFiles() {
  const branch = git('rev-parse', '--abbrev-ref', 'HEAD');
  let base = opt('--base');
  if (!base) base = branch === 'main' ? 'HEAD' : (git('merge-base', 'HEAD', 'main') || 'HEAD');
  const list = [git('diff', '--name-only', base), git('diff', '--name-only', '--cached'), git('ls-files', '--others', '--exclude-standard')].join('\n');
  return { base, files: [...new Set(list.split('\n').map(s => s.trim()).filter(Boolean))] };
}

const T = (name, ...args) => ({ name, cmd: ['node', ...args] });
const nodeT = n => T(n, `test/${n}.mjs`);
const srvT = n => T(`srv_${n}`, '--disable-warning=ExperimentalWarning', `server/test/${n}.mjs`);

// 职业文件 → [职业, 转职]
const JOB_OF = { nen: 'nenmaster' };
function classOf(f) {
  const m = f.match(/^src\/content\/classes\/([a-z]+?)(?:_([a-z]+?))?(?:_p\d)?\.js$/); if (!m || m[1] === 'common') return null;   // common.js 不是职业（见 RULES）
  if (!fs.existsSync(`src/content/classes/${m[1]}.js`)) return null;   // 职业的基础文件（sword.js / gunner.js / mage.js / fighter.js / 以后的新职业）
  const cls = { gunner: 'gun' }[m[1]] || m[1];
  return [cls, m[2] ? (JOB_OF[m[2]] || m[2]) : null];
}
function classTests(cls, job) {
  const out = [];
  const base = { gun: 'gunner' }[cls] || cls;
  if (!job) { if (fs.existsSync(`test/${base}.mjs`)) out.push(nodeT(base)); else out.push(T(`classes_${cls}`, 'test/classes.mjs', cls)); return out; }
  for (const n of [job, `${cls}_${job}`]) if (fs.existsSync(`test/${n}.mjs`)) out.push(nodeT(n));
  out.push(T(`classes_${job}`, 'test/classes.mjs', `${cls}:${job}`), T(`awk_${job}`, 'test/awkcancel.mjs', `${cls}:${job}`));
  return out;
}

// ---- 规则：路径 → 测试 ----
const RULES = [
  [/^src\/engine\/(combat|entity|proj)\.js$/, [nodeT('combat'), nodeT('juggle'), nodeT('skill_sa')]],
  [/^src\/content\/classes\/common\.js$/, [T('fighter_open', 'test/fighter.mjs', 'save,switch'), T('classes_base', 'test/classes.mjs', 'sword,fighter')]],   // 职业公共件：开放开关 / 技能登记 / 指令
  [/^src\/game\/player\.js$/, [nodeT('combat'), T('awk_sample', 'test/awkcancel.mjs', 'sword:berserker,fighter:striker')]],
  [/^src\/(game\/duel|net\/pvp|net\/arena)\.js$|^server\/modules\/arena\.js$/, [nodeT('duel_rules'), T('duel_wakeup', 'test/duel_wakeup.mjs', 'asura,aura'), nodeT('fighter_pvp'), srvT('arena')]],
  [/^src\/game\/(items|gear|drops|shop)\.js$|^src\/content\/items\//, [nodeT('items'), nodeT('gear'), nodeT('compare'), T('gear60', 'test/gear60.mjs', 'core'), nodeT('cdr60'), nodeT('shop')]],
  [/^src\/ui\/items\//, [nodeT('bag'), nodeT('items'), nodeT('bulk'), nodeT('compare'), nodeT('shop')]],
  [/^src\/ui\/cash\/|^src\/content\/cash\//, [nodeT('shop_econ'), nodeT('vanity'), nodeT('shop_synth')]],
  [/^src\/ui\/skillwin\.js$|^src\/game\/progress\.js$/, [nodeT('skill_autolearn'), nodeT('levelcap')]],
  [/^src\/(engine\/touch|ui\/mobile)/, [nodeT('mobile'), nodeT('mobile_buff')]],
  [/^src\/ui\/(hud|charselect|login|menus|settings|worldmap)\.js$/, [nodeT('ui')]],
  [/^src\/(game\/quests|ui\/quest|ui\/job|ui\/npc)\.js$|^src\/content\/quests\//, [nodeT('quickquest'), nodeT('quests60')]],
  [/^src\/net\/(coop|coop_mech|party_sync)\.js$|^server\/core\/(party|room)\.js$/, [T('mp_coop', 'test/mp_coop.mjs', '2'), nodeT('mp_coop_more')]],
  [/^src\/net\/(account|net|social|town)\.js$|^server\/(core|lib|index)/, [srvT('api'), nodeT('net_account')]],
  [/^server\/(modules\/admin|admin\/)|^src\/ui\/social\/gm\.js$/, [srvT('admin'), nodeT('admin_console')]],
  [/^src\/game\/(mon_skills|mon_skills_ext|region)\.js$|^src\/content\/regions\/siroco/, [T('region_siroco', 'test/region.mjs', 'siroco', 'data,skills,mechs')]],
  [/^src\/content\/abyss\.js$/, [T('region_abyss', 'test/region.mjs', 'siroco', 'abyss'), T('mp_abyss', 'test/mp_abyss.mjs', 'A')]],
  [/^src\/(content\/avatar|models)\//, [nodeT('avatar'), nodeT('jobvisuals')]],
  [/^art\/final\/spr\/fighter|^src\/content\/avatar\/.*fighter|^art\/tools\/fighter/, [nodeT('fighter_looks')]],
  [/^art\/final\/weapon\/|^src\/content\/avatar\/weapon_art\.js$/, [nodeT('weapons')]],
];
// 区域文件：content/regions/<id>.js / <id>_bosses.js → region.mjs <id>
function regionTests(f) {
  const m = f.match(/^src\/content\/regions\/([a-z]+?)(?:_bosses|_rooms)?\.js$/); if (!m || m[1] === 'siroco') return [];
  const out = [T(`region_${m[1]}`, 'test/region.mjs', m[1], 'data,skills,mechs')];
  if (fs.existsSync('test/boss.mjs')) out.push(T(`boss_${m[1]}`, 'test/boss.mjs', m[1], 'data,phases,skills,mechs'));
  return out;
}
// 改了这些就多跑冒烟测试，并提示合并前跑 quick.sh
const CORE = /^(build\.mjs|src\/game\/(game|save|flow|world|dungeon)\.js|src\/engine\/(core|render)\.js)$/;
const SMOKE = [nodeT('flow'), nodeT('ui')];
const SLOW = new Set(['duel', 'world', 'bestiary', 'botrun', 'sky', 'behemoth', 'region']);   // 同名但很慢的全量测试（all.sh 里跑），不自动挑
const SKIP = /^(docs\/|README|HANDOFF|\.team\/|art\/(work|src|tools\/.*\.json))/;

function pick(files) {
  const tests = new Map(), why = new Map(), add = (t, f) => { if (!tests.has(t.name)) { tests.set(t.name, t); why.set(t.name, f); } };
  let core = false;
  for (const f of files) {
    if (SKIP.test(f)) continue;
    const tm = f.match(/^test\/([a-z0-9_]+)\.mjs$/); if (tm && !['lib', 'net_lib', 'lib_bestkit', 'affected'].includes(tm[1])) { add(nodeT(tm[1]), f); continue; }
    if (/^server\/test\/([a-z]+)\.mjs$/.test(f)) { add(srvT(f.match(/([a-z]+)\.mjs$/)[1]), f); continue; }
    if (CORE.test(f)) core = true;
    const c = classOf(f); if (c) for (const t of classTests(...c)) add(t, f);
    for (const t of regionTests(f)) add(t, f);
    for (const [re, ts] of RULES) if (re.test(f)) for (const t of ts) add(t, f);
    const base = path.basename(f).replace(/\.(js|mjs|py)$/, '');
    if (/^src\//.test(f) && fs.existsSync(`test/${base}.mjs`) && !SLOW.has(base)) add(nodeT(base), f);   // 同名测试（src/.../foo.js ↔ test/foo.mjs）
  }
  const touchedCode = files.some(f => !SKIP.test(f));
  if (core || (touchedCode && !tests.size)) for (const t of SMOKE) add(t, core ? '核心文件' : '没有对应规则，跑冒烟');
  return { tests: [...tests.values()], why, core };
}

// ---- 全局锁：同一时间只跑一套测试 ----
const LOCK = path.join(os.tmpdir(), 'dawnbreak-tests.lock');
const alive = pid => { try { process.kill(pid, 0); return true; } catch (e) { return false; } };
async function lock() {
  let said = false;
  for (;;) {
    try { fs.mkdirSync(LOCK); fs.writeFileSync(path.join(LOCK, 'pid'), String(process.pid)); return; } catch (e) { /* 已被占用 */ }
    const pid = +(fs.readFileSync(path.join(LOCK, 'pid'), 'utf8').trim() || 0);
    if (pid && !alive(pid)) { fs.rmSync(LOCK, { recursive: true, force: true }); continue; }
    if (!said) { console.log(`另一套测试正在跑（pid ${pid}），排队等它结束……`); said = true; }
    await new Promise(r => setTimeout(r, 5000));
  }
}
const unlock = () => { try { if (+fs.readFileSync(path.join(LOCK, 'pid'), 'utf8') === process.pid) fs.rmSync(LOCK, { recursive: true, force: true }); } catch (e) { /* 已释放 */ } };

// ---- 跑 ----
const { base, files } = changedFiles();
const picked = pick(files), only = opt('--only'), { why, core } = picked;
const tests = only ? picked.tests.filter(t => only.split(',').includes(t.name)) : picked.tests;
console.log(`比较起点 ${base}，改动 ${files.length} 个文件 → ${tests.length} 项测试`);
for (const t of tests) console.log(`  - ${t.name.padEnd(18)} ← ${why.get(t.name)}`);
if (!tests.length) { console.log('没有要跑的测试（只改了文档 / 说明）'); process.exit(0); }
if (flag('--dry')) process.exit(0);

await lock();
process.on('exit', unlock); process.on('SIGINT', () => process.exit(130));
if (!flag('--no-build')) { const b = run('node', ['build.mjs']).split('\n').pop(); console.log(b || '构建失败'); if (!b) process.exit(1); }
const LOG = 'test/shots/affected'; fs.mkdirSync(LOG, { recursive: true });
const J = Math.max(1, +(process.env.J || 2)), t0 = Date.now(), res = [];
const runOne = t => new Promise(resolve => {
  const s = Date.now(), out = fs.openSync(`${LOG}/${t.name}.log`, 'w');
  const p = spawn('nice', ['-n', '10', ...t.cmd], { stdio: ['ignore', out, out] });
  p.on('close', code => {
    const txt = fs.readFileSync(`${LOG}/${t.name}.log`, 'utf8');
    if (code === 0 && /"type": ?"pageerror"|✗/.test(txt)) code = 99;
    const r = { name: t.name, ok: code === 0, sec: Math.round((Date.now() - s) / 1000) };
    console.log(`== ${t.name.padEnd(18)} ${r.ok ? 'PASS' : `FAIL(${code})`}  ${r.sec}s`); res.push(r); resolve();
  });
});
const queue = tests.slice();
await Promise.all(Array.from({ length: Math.min(J, queue.length) }, async () => { while (queue.length) await runOne(queue.shift()); }));
const fails = res.filter(r => !r.ok);
console.log(`受影响的测试：${res.length - fails.length}/${res.length} 通过，用时 ${Math.round((Date.now() - t0) / 1000)}s（日志 ${LOG}/<名字>.log）`);
if (fails.length) console.log(`失败：${fails.map(r => r.name).join('、')}（已知偶发的单独重跑一次再下结论）`);
if (core) console.log('提示：改了核心文件，合并 / 部署前由主线程跑一次 sh test/quick.sh');
process.exit(fails.length ? 1 : 0);
