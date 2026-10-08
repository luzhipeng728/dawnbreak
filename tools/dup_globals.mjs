// 同名全局函数检查：src/ 按 src/ORDER 拼成一个全局作用域，顶层 function 重名不会报错，后加载的悄悄覆盖前面的
// （地下城的门 drawGate 被 world.js 同名函数盖掉，门一直没画出来）。顶层 const / let / class 重名浏览器会直接报错，不用查。
// 用法：node tools/dup_globals.mjs（有重名退出码 1；quick.sh 里跑）
import fs from 'fs';
import path from 'path';
const root = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'src');
const files = fs.readFileSync(path.join(root, 'ORDER'), 'utf8').split('\n').map(l => l.replace(/#.*/, '').trim()).filter(Boolean);
const seen = new Map(), dups = [];
for (const f of files) {
  const p = path.join(root, f); if (!fs.existsSync(p)) continue;
  let block = false;   // 第 0 列的 { ... } 块（构建是 "use strict"，块里的函数是块级作用域，不算全局）
  fs.readFileSync(p, 'utf8').split('\n').forEach((line, i) => {
    const net = (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;   // 一行写完的 { ... } 不算进块
    if (/^\{/.test(line)) { if (net > 0) block = true; } else if (/^\}/.test(line)) block = false;
    if (block) return;
    const m = /^(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)\s*\(/.exec(line); if (!m) return;   // 只看第 0 列：块里 / 函数里的同名函数是局部的
    const at = `${f}:${i + 1}`, prev = seen.get(m[1]);
    if (prev) dups.push(`${m[1]}  ${prev}  ↔  ${at}`); else seen.set(m[1], at);
  });
}
if (dups.length) { console.log(`✗ ${dups.length} 个同名全局函数（后面的会覆盖前面的）：\n  ` + dups.join('\n  ')); process.exit(1); }
console.log(`✓ ${files.length} 个文件、${seen.size} 个顶层函数，没有重名`);
