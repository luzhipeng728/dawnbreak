// 把区域 spec（src/content/regions/<id>.js，纯数据的 defineRegion({...})）导出成 JSON，给 art/tools/region_art.py 用
// 用法：node art/tools/region_spec.mjs <id> [--write]     --write 同时写一份 art/regions/<id>.json（方便看 diff）
import fs from 'fs';
import vm from 'vm';
const id = process.argv[2]; if (!id) { console.error('用法：node art/tools/region_spec.mjs <id> [--write]'); process.exit(1); }
const src = fs.readFileSync(new URL(`../../src/content/regions/${id}.js`, import.meta.url), 'utf8');
let spec = null;
vm.runInNewContext(src, { defineRegion: s => { spec = s; } });
if (!spec) { console.error(`${id}.js 里没有调用 defineRegion`); process.exit(1); }
const json = JSON.stringify(spec, null, 1);
if (process.argv.includes('--write')) { const out = new URL(`../regions/${id}.json`, import.meta.url); fs.mkdirSync(new URL('../regions/', import.meta.url), { recursive: true }); fs.writeFileSync(out, json); }
process.stdout.write(json);
