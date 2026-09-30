// 构建：把 src/ 下的脚本按 src/ORDER 顺序拼进一个 <script>（共享同一作用域），输出两个版本：
//   dist/web/index.html + dist/web/assets/**   网页版：美术按分包按需加载（进城 / 进地下城时再加载对应素材）
//   dist/dawnbreak.html                        离线单文件：全部美术以 data URI 内嵌，双击即可游玩
// 用法：node build.mjs            （两个都出；测试默认读离线单文件，quick.sh / all.sh 用这个）
//       node build.mjs --web      （只出网页版，快、不写 175 MB 的单文件；部署 tools/deploy.sh 用这个）  node build.mjs --offline（只出离线版）
// 版本号 BUILD_ID = 网页版页面内容的哈希（内容不变就不变，两个版本共用）；网页版另写 dist/web/version.json { id, time, notes }，
// 在线的页面轮询它发现新版本（net/liveupdate.js）；notes 用环境变量 NOTES，没给就取最近几条 feat / fix 提交的标题
// 网页版另写 dist/web/catalog.json（物品 / 职业目录，后台管理 /admin 用，见 tools/item_catalog.mjs）
import fs from 'fs';
import crypto from 'crypto';
import path from 'path';
import { execFileSync } from 'child_process';
import { writeCatalog } from './tools/item_catalog.mjs';
const ROOT = path.dirname(new URL(import.meta.url).pathname);
const SRC = path.join(ROOT, 'src'), ART = path.join(ROOT, 'art', 'final'), DIST = path.join(ROOT, 'dist');
const args = process.argv.slice(2), want = k => !args.length || args.includes('--' + k);

const order = fs.readFileSync(path.join(SRC, 'ORDER'), 'utf8').split('\n').map(s => s.trim()).filter(s => s && !s.startsWith('#'));
const top = fs.readFileSync(path.join(SRC, 'shell_top.html'), 'utf8');
const bottom = fs.readFileSync(path.join(SRC, 'shell_bottom.html'), 'utf8');

// ---- 美术素材清单：key = art/final 下的相对路径（去掉 .webp），分包规则见 bundleOf ----
function bundleOf(key) {
  const [a, b] = key.split('/');
  if (a === 'spr') return 'spr:' + b;                                  // 角色 / 怪物逐帧精灵：spr:sword、spr:goblin……
  if (a === 'bg') return 'bg:' + b.replace(/_(far|floor|edge|mid|fore)$/, '');   // 场景背景：bg:forest……
  if (a === 'npc') return 'npc';
  if (a === 'world') return 'world';                                   // 城镇建筑、地下城门、NPC 立绘
  if (a === 'scene') return 'scene:' + b;                              // 城镇 / 区域场景的专用美术
  if (a === 'job') return 'job';
  if (a === 'weapon') return 'weapon';                                 // 拿在手里的武器图：用到哪把才加载哪把（loadArtKey），不进启动包
  if (a === 'cash' || a === 'pet' || a === 'aura') return 'cash';                     // 商城图标、宠物、光环（进城后后台加载 / 打开商城时加载）                                       // 转职立绘（和导师对话 / 打开转职窗口时才加载）
  return 'core';                                                       // 图标、特效、标题、职业立绘、觉醒立绘
}
function collectArt() {
  const files = [], sprs = {};
  if (!fs.existsSync(ART)) return { files, sprs };
  const walk = rel => {
    for (const e of fs.readdirSync(path.join(ART, rel), { withFileTypes: true })) {
      const r = rel ? rel + '/' + e.name : e.name;
      if (e.isDirectory()) walk(r);
      else if (e.name.endsWith('.webp')) files.push(r);
      else if (e.name === 'spr.json') sprs[rel.replace(/^spr\//, '')] = JSON.parse(fs.readFileSync(path.join(ART, r), 'utf8'));
    }
  };
  walk('');
  return { files, sprs };
}
function artModule(mode, files, sprs, id) {
  const src = {}, bundle = {};
  for (const f of files) {
    const key = f.replace(/\.webp$/, '');
    src[key] = mode === 'offline' ? 'data:image/webp;base64,' + fs.readFileSync(path.join(ART, f)).toString('base64') : 'assets/' + f;
    bundle[key] = bundleOf(key);
  }
  return `const ASSET_SRC = ${JSON.stringify(src)};\nconst ASSET_BUNDLE = ${JSON.stringify(bundle)};\nconst SPR_DATA = ${JSON.stringify(sprs)};\nconst BUILD_MODE = '${mode}';\nconst BUILD_ID = '${id}';\n`;
}
function bundleJs(art) {
  const js = '"use strict";\n' + order.map(f => `// ==== ${f} ====\n` + fs.readFileSync(path.join(SRC, f), 'utf8') + (f === 'engine/core.js' ? '\n// ==== art (generated) ====\n' + art : '')).join('\n');
  return js;
}
function syntaxCheck(js) {
  const tmp = path.join(ROOT, '.build-check.js');
  fs.writeFileSync(tmp, js);
  try { execFileSync(process.execPath, ['--check', tmp], { stdio: 'pipe' }); }
  catch (e) { console.error('语法错误：\n' + e.stderr.toString()); process.exit(1); }
  finally { fs.unlinkSync(tmp); }
}
const html = js => top + js.replace(/<\/script/gi, '<\\/script') + bottom;

function patchNotes() {
  if (process.env.NOTES !== undefined) return process.env.NOTES;
  try {
    const subj = execFileSync('git', ['log', '-20', '--no-merges', '--format=%s'], { cwd: ROOT, encoding: 'utf8' }).split('\n');
    return subj.filter(s => /^(feat|fix)\b/.test(s)).slice(0, 3).map(s => s.replace(/^\w+(\([^)]*\))?!?:\s*/, '')).join('；');
  } catch (e) { return ''; }
}

const { files, sprs } = collectArt();
const BUILD_ID = crypto.createHash('sha256').update(html(bundleJs(artModule('web', files, sprs, '')))).digest('hex').slice(0, 12);
let checked = false;
if (want('web')) {
  const js = bundleJs(artModule('web', files, sprs, BUILD_ID)); syntaxCheck(js); checked = true;
  const out = path.join(DIST, 'web');
  fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(path.join(out, 'assets'), { recursive: true });
  for (const f of files) { const d = path.join(out, 'assets', f); fs.mkdirSync(path.dirname(d), { recursive: true }); fs.copyFileSync(path.join(ART, f), d); }
  const page = html(js); fs.writeFileSync(path.join(out, 'index.html'), page);
  fs.writeFileSync(path.join(out, 'version.json'), JSON.stringify({ id: BUILD_ID, time: new Date().toISOString(), notes: patchNotes() }));
  writeCatalog(js, out, BUILD_ID);
  const artKB = files.reduce((s, f) => s + fs.statSync(path.join(ART, f)).size, 0) / 1024;
  console.log(`dist/web/index.html: ${(page.length / 1024).toFixed(0)} KB + ${files.length} 个素材文件（${(artKB / 1024).toFixed(1)} MB，按需加载），版本 ${BUILD_ID}`);
}
if (want('offline')) {
  const art = artModule('offline', files, sprs, BUILD_ID), js = bundleJs(art); if (!checked) syntaxCheck(js);
  fs.mkdirSync(DIST, { recursive: true });
  const page = html(js); fs.writeFileSync(path.join(DIST, 'dawnbreak.html'), page);
  console.log(`dist/dawnbreak.html: ${(page.length / 1024).toFixed(0)} KB（离线单文件，其中美术 ${(art.length / 1024).toFixed(0)} KB），${order.length} 个模块`);
}
