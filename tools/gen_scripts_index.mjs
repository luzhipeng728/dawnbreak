// 脚本索引生成器：扫描 build.mjs / tools / test / server/test / art/tools 里每个脚本的文件头注释，按文件名规则分类，写成 docs/SCRIPTS.md
//   node tools/gen_scripts_index.mjs           重新生成 docs/SCRIPTS.md
//   node tools/gen_scripts_index.mjs --check   只检查 docs/SCRIPTS.md 是否最新、每个脚本是否有文件头说明（不写文件，不一致则退出码 1）
// 新增脚本时：在文件最前面写一行说明（只收录 git 已跟踪的文件，先 git add）（.py 用模块文档字符串，.mjs / .js / .sh 用 // 或 # 注释），再跑一次本脚本即可。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'docs', 'SCRIPTS.md');
const EXT = /\.(mjs|js|py|sh)$/;
// 只收录 git 已跟踪的脚本：索引要和仓库内容一致，新脚本 git add 之后才会出现在索引里
let TRACKED = null;
try { TRACKED = new Set(execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 }).split('\n')); } catch {}

// 每个目录：标题、说明、分类规则（按顺序匹配文件名，第一个命中的算；都不中归“其他”）
const SECTIONS = [
  {
    dir: '.', only: ['build.mjs'], title: '构建', note: '`node build.mjs` 把 `src/` 按 `src/ORDER` 拼成网页版 `dist/web/` 和离线单文件 `dist/dawnbreak.html`。',
    rules: [['构建', /./]],
  },
  {
    dir: 'tools', title: '运维与分析工具（`tools/`）', note: '部署、数据体检、技能范围检查、服务器管理。部署前先读 `README.md` 的“部署”一节：生产与开发服务器不能混用。',
    recursive: true,
    rules: [
      ['部署', /^deploy\.sh$/],
      ['服务器管理（`tools/admin/`）', /^admin\//],
      ['数据与资源体检', /./],
    ],
  },
  {
    dir: 'test', title: '测试（`test/`）', note: '全部是无头 Chrome 端到端测试，公共部分在 `lib.mjs`。先 `node build.mjs`（测试读构建产物）；多个测试不要并行开浏览器。入口：`node test/flow.mjs`（冒烟，必跑）、`sh test/quick.sh`（快速回归）、`sh test/all.sh`（完整回归）、`node test/affected.mjs`（按改动文件挑测试）。',
    rules: [
      ['回归入口与公共库', /^(lib|lib_bestkit|net_lib|priest_coop_lib|_shot|testlock|affected|quick|all|combat_all)[._]/],
      ['联机与服务端', /^(mp_|svc_|net_|coop_mail|boss_coop|enchantress_coop|liveupdate|acct|findfriend|admin_console)/],
      ['决斗与 PvP', /^(duel|pvp|arena|fighter_pvp)/],
      ['领主、团本与区域', /^(boss|ozma|raid|behemoth|skasa|region|sky|world|dungeon|abyss)/],
      ['装备、商店、经济与任务', /^(gear|items|shop|econ|bag|enh|epicfx|ancient|cdr60|cash|vanity|weapons|compare|bulk|box100|quest|levelcap|maxlv|repair|inspect|contract|qbalance|quickquest)/],
      ['技能、战斗与动作手感', /^(skill|combat|juggle|awkcancel|animfeel|motion|hurtlog|bench|soak)/],
      ['职业专项', /^(sword|mage|gunner|gun_range|priest|fighter|brawler|grappler|striker|nenmaster|infighter|crusader|avenger|exorcist|enchantress|summon|witch|spitfire|mechanic|paramedic|classes)/],
      ['外观与美术', /^(art|avatar|jobvisuals|music)/],
      ['界面、移动端与整体流程', /^(ui|mobile|kbplay|guide|polish|perf|flow|play|botrun|walk|bestiary)/],
    ],
  },
  {
    dir: 'server/test', title: '服务端测试（`server/test/`）', note: '直接起本机临时库跑真实服务端（`sh test/all.sh` 会先装好 `server/` 依赖）。',
    rules: [['服务端', /./]],
  },
  {
    dir: 'art/tools', title: '美术流水线（`art/tools/`）', note: '生图（gpt-image）、去底、切帧、拼图集、质检。总流程见 `docs/ART_PIPELINE.md`；原图写到 `art/src/`（不进 git），成品在 `art/final/`。多数脚本都能 `python3 art/tools/<名字>.py -h` 看用法。',
    rules: [
      ['换装与外观（`avatar_*`）', /^avatar_/],
      ['武器图与武器设计', /^(weapon_|wdesign_|fighter_weapons)/],
      ['装备、附魔与商城图标', /^(gear_icons|icons|quest_icons|ench|cash_art|asset_shrink)/],
      ['区域、背景与世界', /^(region_|sky_art|bgs|worldprep)/],
      ['通用基础库（被其他脚本调用）', /^(prep|sheets|sheets2|frames|frames2|gridsheet|rig|perframe|poseguide|fxprep|marker_check|jobs|combatgen)\./],
      ['职业、召唤物与怪物美术', /^(behemoth|crusader|exorcist|fighter|infighter|mage|paramedic|priest|spitfire|striker|sword|witch|summon|mech|job|jobvis|gun)/],
    ],
  },
];

function describe(file) {
  const text = fs.readFileSync(file, 'utf8');
  const lines = text.split('\n');
  let i = 0;
  while (i < lines.length && (/^#!/.test(lines[i]) || /^\s*$/.test(lines[i]) || /^\s*['"]use strict['"];?\s*$/.test(lines[i]))) i++;
  const first = lines[i] || '';
  let desc = '';
  if (/\.py$/.test(file)) {
    const m = first.match(/^\s*[rRuU]?("""|''')(.*)$/);
    if (!m && /^\s*#/.test(first)) desc = first.replace(/^\s*#\s?/, '').trim();
    else if (m) {
      desc = m[2].replace(/("""|''')\s*$/, '').trim();
      if (!desc) { for (let j = i + 1; j < lines.length && !desc; j++) desc = lines[j].replace(/("""|''')\s*$/, '').trim(); }
    }
  } else if (/^\s*\/\//.test(first)) desc = first.replace(/^\s*\/\/\s?/, '').trim();
  else if (/^\s*\/\*/.test(first)) desc = first.replace(/^\s*\/\*+\s?/, '').replace(/\*\/\s*$/, '').trim() || (lines[i + 1] || '').replace(/^\s*\*?\s?/, '').trim();
  else if (/^\s*#/.test(first)) desc = first.replace(/^\s*#\s?/, '').trim();
  return desc;
}

function list(dir, recursive, only) {
  const base = path.join(ROOT, dir);
  const out = [];
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name === '__pycache__' || e.name === 'shots') continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) { if (recursive) walk(p); continue; }
      if (!EXT.test(e.name)) continue;
      if (!TRACKED || TRACKED.has(path.relative(ROOT, p).split(path.sep).join('/'))) out.push(path.relative(base, p));
    }
  })(base);
  return out.filter(f => !only || only.includes(f)).sort();
}

const esc = s => s.replace(/\|/g, '\\|');
const cut = s => (s.length > 150 ? s.slice(0, 148) + '…' : s);
const missing = [];
let md = `# 脚本索引

> 本文件由 \`node tools/gen_scripts_index.mjs\` 生成，**不要手改**（改脚本文件头的第一行说明，再重新生成）。
> \`node tools/gen_scripts_index.mjs --check\` 会检查本文件是否最新、每个脚本是否写了文件头说明。
> 新来的人先读 [\`../CLAUDE.md\`](../CLAUDE.md)（项目地图与常用命令）和 [\`README.md\`](README.md)（文档索引）。

`;
for (const s of SECTIONS) {
  const files = list(s.dir, s.recursive, s.only);
  const groups = new Map(s.rules.map(r => [r[0], []]));
  groups.set('其他', []);
  for (const f of files) {
    const rel = path.posix.join(s.dir === '.' ? '' : s.dir, f.split(path.sep).join('/'));
    const d = describe(path.join(ROOT, rel));
    if (!d) missing.push(rel);
    const name = f.split(path.sep).join('/');
    const rule = s.rules.find(r => r[1].test(name));
    groups.get(rule ? rule[0] : '其他').push([rel, d]);
  }
  md += `## ${s.title}\n\n${s.note}\n\n`;
  for (const [g, items] of groups) {
    if (!items.length) continue;
    md += `### ${g}（${items.length}）\n\n| 脚本 | 作用 |\n|---|---|\n`;
    for (const [rel, d] of items) md += `| [\`${rel}\`](../${rel}) | ${esc(cut(d)) || '**（缺文件头说明）**'} |\n`;
    md += '\n';
  }
}

if (process.argv.includes('--check')) {
  const cur = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
  let bad = 0;
  if (cur !== md) { console.error('docs/SCRIPTS.md 不是最新：运行 node tools/gen_scripts_index.mjs 重新生成'); bad = 1; }
  if (missing.length) { console.error('缺文件头说明：\n  ' + missing.join('\n  ')); bad = 1; }
  if (!bad) console.log(`脚本索引已是最新（缺说明 0 个）`);
  process.exit(bad);
} else {
  fs.writeFileSync(OUT, md);
  console.log(`已写 docs/SCRIPTS.md；缺文件头说明 ${missing.length} 个${missing.length ? '：\n  ' + missing.join('\n  ') : ''}`);
}
