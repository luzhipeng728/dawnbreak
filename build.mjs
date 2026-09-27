// 构建：把 src/ 下的脚本按 src/ORDER 顺序拼进一个 <script>（共享同一作用域），生成可离线运行的单文件 index.html
// 用法：node build.mjs
import fs from 'fs';
import { execFileSync } from 'child_process';
const dir = new URL('./src/', import.meta.url);
const order = fs.readFileSync(new URL('ORDER', dir), 'utf8').split('\n').map(s => s.trim()).filter(s => s && !s.startsWith('#'));
const top = fs.readFileSync(new URL('shell_top.html', dir), 'utf8');
const bottom = fs.readFileSync(new URL('shell_bottom.html', dir), 'utf8');
// 美术素材：art/final 下的 WebP 以 data URI 内嵌，骨骼装配数据（rig.json）一并写入
function artModule() {
  const root = new URL('./art/final/', import.meta.url), src = {}, rigs = {}, sprs = {};
  if (!fs.existsSync(root)) return 'const ASSET_SRC = {}, RIG_DATA = {}, SPR_DATA = {};\n';
  const walk = (rel) => {
    for (const e of fs.readdirSync(new URL(rel, root), { withFileTypes: true })) {
      const r = rel + e.name;
      if (e.isDirectory()) walk(r + '/');
      else if (e.name.endsWith('.webp')) src[r.replace(/\.webp$/, '')] = 'data:image/webp;base64,' + fs.readFileSync(new URL(r, root)).toString('base64');
      else if (e.name === 'rig.json') rigs[rel.replace(/\/$/, '')] = JSON.parse(fs.readFileSync(new URL(r, root), 'utf8'));
      else if (e.name === 'spr.json') sprs[rel.replace(/^spr\//, '').replace(/\/$/, '')] = JSON.parse(fs.readFileSync(new URL(r, root), 'utf8'));
    }
  };
  walk('');
  return `const ASSET_SRC = ${JSON.stringify(src)};\nconst RIG_DATA = ${JSON.stringify(rigs)};\nconst SPR_DATA = ${JSON.stringify(sprs)};\n`;
}
const art = artModule();
const js = '"use strict";\n' + order.map(f => `// ==== ${f} ====\n` + fs.readFileSync(new URL(f, dir), 'utf8') + (f === '00_core.js' ? '\n// ==== art (generated) ====\n' + art : '')).join('\n');
const tmp = new URL('./.build-check.js', import.meta.url);
fs.writeFileSync(tmp, js);
try { execFileSync(process.execPath, ['--check', tmp.pathname], { stdio: 'pipe' }); }
catch (e) { console.error('语法错误：\n' + e.stderr.toString()); process.exit(1); }
finally { fs.unlinkSync(tmp); }
const out = top + js.replace(/<\/script/gi, '<\\/script') + bottom;
fs.writeFileSync(new URL('./index.html', import.meta.url), out);
console.log(`index.html: ${(out.length / 1024).toFixed(0)} KB（其中美术 ${(art.length / 1024).toFixed(0)} KB）, ${order.length} 个模块`);
