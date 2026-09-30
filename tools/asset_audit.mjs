// 素材盘点：找出 art/final 里游戏从来不用的文件（docs/ASSET_AUDIT.md）。先 node build.mjs（data / trace 要用构建好的页面）
//   node tools/asset_audit.mjs static            只做静态扫描（src/**/*.js 的字符串 / 模板 → 匹配规则），打印统计
//   node tools/asset_audit.mjs data              无头页面里按数据枚举（运行时字符串 + 物品图标 / 武器外观 / 转职立绘 / 门 / 觉醒插图）→ test/shots/asset_audit/data.json
//   PAR=4 node tools/asset_audit.mjs trace [测试...]   记录实际画出来的素材：dist/web 页面打埋点，GAME_URL 指过去跑现成测试 + 自己的巡游（tour）→ trace.json（约 50 分钟，跑的时候别重新构建）
//   node tools/asset_audit.mjs report [--doc]    合并三种来源 → test/shots/asset_audit/unused.json（unused 删除 / suspect 疑似 / missing 缺文件）；--doc 重写 docs/ASSET_AUDIT.md 的 §2~§5
//   node tools/asset_audit.mjs delete            git rm unused.json 里的 unused（疑似的留着），精灵帧同时从 spr.json 去掉
//   node tools/asset_audit.mjs spot              删 / 压之后的目视抽查（网页版：4 个职业进城、地下城、背包、商城、觉醒插图），报“素材加载失败”和 404
// 规则：三种来源都没有引用的文件才算“没用”；模板 / 拼接的洞只能填已有的字符串或数字（宽匹配只算“疑似”），
// 只有分类前缀、其余全是变量的模板（'fx/' + name）交给名字规则、数据枚举和运行记录
import fs from 'fs';
import path from 'path';
import http from 'http';
import { spawn, execFileSync } from 'child_process';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const ART = path.join(ROOT, 'art', 'final'), OUT = path.join(ROOT, 'test', 'shots', 'asset_audit');
fs.mkdirSync(OUT, { recursive: true });

// art/final 的文件 → 大小；大小取 git HEAD 里的原始大小（瘦身改过的文件也按原图算，报告前后一致），HEAD 里没有的按磁盘
export function artFiles() {
  const files = {}, head = {};
  try { for (const l of execFileSync('git', ['ls-tree', '-r', '-l', 'HEAD', 'art/final'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 << 20 }).split('\n')) { const m = l.match(/^\S+ blob \S+\s+(\d+)\tart\/final\/(.+)\.webp$/); if (m) head[m[2]] = +m[1]; } } catch (e) { }
  const walk = rel => {
    for (const e of fs.readdirSync(path.join(ART, rel), { withFileTypes: true })) {
      const r = rel ? rel + '/' + e.name : e.name;
      if (e.isDirectory()) walk(r); else if (e.name.endsWith('.webp')) { const k = r.replace(/\.webp$/, ''); files[k] = head[k] ?? fs.statSync(path.join(ART, r)).size; }
    }
  };
  walk('');
  return files;
}
export function sprJson() {
  const out = {};
  for (const d of fs.readdirSync(path.join(ART, 'spr'))) { const p = path.join(ART, 'spr', d, 'spr.json'); if (fs.existsSync(p)) out[d] = JSON.parse(fs.readFileSync(p, 'utf8')); }
  return out;
}

/* ---------------- (a) 静态扫描 ---------------- */
const KW = new Set(['return', 'typeof', 'case', 'do', 'else', 'in', 'of', 'new', 'delete', 'void', 'throw', 'instanceof', 'yield', 'await']);
const ESC = { n: '\n', t: '\t', r: '\r', b: '\b', f: '\f', v: '\v', 0: '\0' };
// 极简 JS 词法：取出字符串字面量（带前后一个有效字符，判断是不是在做拼接）和模板字符串（quasi 片段 + 洞）
export function tokenize(src) {
  const strs = [], tmpls = [], stack = [];
  let i = 0, prev = '';
  const n = src.length;
  const nextSig = j => { while (j < n && /\s/.test(src[j])) j++; return src[j] || ''; };
  const readTemplate = T => {
    let s = '';
    while (i < n) {
      const c = src[i];
      if (c === '\\') { s += ESC[src[i + 1]] ?? src[i + 1]; i += 2; continue; }
      if (c === '`') { T.parts.push(s); i++; T.after = nextSig(i); tmpls.push(T); prev = 'x'; return; }
      if (c === '$' && src[i + 1] === '{') { T.parts.push(s); s = ''; i += 2; stack.push({ T, depth: 0 }); prev = '('; return; }
      s += c; i++;
    }
  };
  while (i < n) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '/') { while (i < n && src[i] !== '\n') i++; continue; }
    if (c === '/' && src[i + 1] === '*') { const e = src.indexOf('*/', i + 2); i = e < 0 ? n : e + 2; continue; }
    if (c === '"' || c === "'") {
      let s = ''; i++;
      while (i < n && src[i] !== c && src[i] !== '\n') { if (src[i] === '\\') { s += ESC[src[i + 1]] ?? src[i + 1]; i += 2; } else s += src[i++]; }
      i++; strs.push({ s, before: prev, after: nextSig(i), at: i }); prev = 'x'; continue;
    }
    if (c === '`') { i++; readTemplate({ parts: [], before: prev, at: i }); continue; }
    if (c === '{') { if (stack.length) stack[stack.length - 1].depth++; prev = '{'; i++; continue; }
    if (c === '}') {
      if (stack.length) { const top = stack[stack.length - 1]; if (top.depth === 0) { stack.pop(); i++; readTemplate(top.T); continue; } top.depth--; }
      prev = '}'; i++; continue;
    }
    if (c === '/') {
      if (prev === 'x' || prev === ')' || prev === ']') { prev = '/'; i++; continue; }
      i++; let cls = false;
      while (i < n) { const d = src[i]; if (d === '\\') { i += 2; continue; } if (d === '\n') break; if (d === '[') cls = true; else if (d === ']') cls = false; else if (d === '/' && !cls) { i++; break; } i++; }
      while (i < n && /[a-z]/i.test(src[i])) i++;
      prev = 'x'; continue;
    }
    if (/\s/.test(c)) { i++; continue; }
    if (/[A-Za-z0-9_$.]/.test(c)) { let j = i; while (j < n && /[A-Za-z0-9_$.]/.test(src[j])) j++; const w = src.slice(i, j); prev = KW.has(w) ? '(' : 'x'; i = j; continue; }
    prev = c; i++;
  }
  return { strs, tmpls };
}
const reEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export function srcFiles() {
  const out = [];
  const walk = d => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (/\.(js|html)$/.test(e.name)) out.push(p); } };
  walk(path.join(ROOT, 'src'));
  return out;
}
// 静态规则 → { lits: Set（所有字面量）, tpls: [{ parts, key（带分类前缀）, src }]（模板字符串 / 字符串拼接，洞在 parts 之间）, where: Map（字面量 → 出处） }
//   'icon/' + x → parts ['icon/', '']；x + '_far' → ['', '_far']；`bg/${t}_floor` → ['bg/', '_floor']
export function staticRules() {
  const lits = new Set(), tpls = [], where = new Map(), occ = new Map();
  for (const f of srcFiles()) {
    let src = fs.readFileSync(f, 'utf8'); const rel = path.relative(ROOT, f);
    if (f.endsWith('.html')) src = src.replace(/<[^>]*>/g, ' ');
    const starts = [0]; for (let i = 0; i < src.length; i++) if (src[i] === '\n') starts.push(i + 1);
    const lineOf = i => { let lo = 0, hi = starts.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (starts[m] <= i) lo = m; else hi = m - 1; } return lo + 1; };
    const lines = src.split('\n');
    const { strs, tmpls } = tokenize(src);
    for (const { s, before, after, at } of strs) {
      lits.add(s); if (!where.has(s)) where.set(s, rel + ':' + lineOf(at));
      const L = occ.get(s) || []; if (L.length < 60) { const ln = lineOf(at); L.push({ src: rel + ':' + ln, file: rel, line: ln, text: lines[ln - 1] }); occ.set(s, L); }
      const pre = after === '+', suf = before === '+';
      if ((!pre && !suf) || !/[a-z0-9]/i.test(s)) continue;
      tpls.push({ parts: [...(suf ? [''] : []), s, ...(pre ? [''] : [])], src: rel + ':' + lineOf(at) });
    }
    for (const T of tmpls) {
      if (T.parts.length === 1) { const s = T.parts[0]; lits.add(s); if (!where.has(s)) where.set(s, rel + ':' + lineOf(T.at)); if (T.after !== '+' && T.before !== '+') continue; }
      const parts = [...(T.before === '+' ? [''] : []), ...T.parts, ...(T.after === '+' ? [''] : [])];
      if (!/[a-z0-9]/i.test(parts.join(''))) continue;
      tpls.push({ parts, src: rel + ':' + lineOf(T.at) });
    }
  }
  const seen = new Set();
  return { lits, where, occ, tpls: tpls.filter(t => { const id = t.parts.join('\u0000'); if (seen.has(id)) return false; seen.add(id); t.pat = t.parts.join('${}'); t.key = t.parts[0].includes('/') || t.parts.some(p => p.includes('/')); return true; }) };
}
// 一个 key 的“名字”：分类后面的部分；精灵帧另外拆出目录名和帧名
export const splitKey = k => { const a = k.split('/'); return a[0] === 'spr' ? { cat: 'spr', dir: a[1], name: a.slice(2).join('/') } : { cat: a.length > 1 ? a[0] : '', name: a.slice(1).join('/') || a[0] }; };
// 名字的数字尾巴：walk3 → walk（seq('walk', 8)、'cutin/witch' + n 这类）
const numStem = s => { const m = s.match(/^(.*?[A-Za-z_])\d+$/); return m ? m[1] : null; };
// 模板匹配：ok(洞的值) 决定洞能填什么；ok = null 表示洞随便填（宽匹配）
function tmatch(parts, s, ok) {
  if (!s.startsWith(parts[0])) return false;
  const go = (i, pos) => {
    if (i === parts.length - 1) { const P = parts[i]; if (!s.endsWith(P)) return false; const end = s.length - P.length; return end > pos && (!ok || ok(s.slice(pos, end))); }
    const P = parts[i];
    for (let j = P ? s.indexOf(P, pos + 1) : pos + 1; j > pos && j <= s.length; j = P ? s.indexOf(P, j + 1) : j + 1) {
      if (j < 0) break;
      if ((!ok || ok(s.slice(pos, j))) && go(i + 1, j + P.length)) return true;
    }
    return false;
  };
  return parts.length === 1 ? s === parts[0] : go(1, parts[0].length);
}
// 模板只有“分类前缀 + 一个洞”（'icon/' + x、`fx/${n}`）或者全是洞：宽匹配等于“这个分类的任何文件”，不当证据（洞的取值交给数据枚举 / 名字规则）
const catOnly = parts => parts.join('').replace(/^[a-z]+\//i, '').replace(/[^a-z0-9]/gi, '').length < 2;
// 只当普通怪物用的精灵目录：出现在 MON_ART 里，而且目录名没有在“会自己造精灵模型 / 直接取帧”的代码里出现过
// （转职 / 召唤物 / 外观 / 联机 / 界面 / 引擎 / summon.js / 天空之城的自定义模型），也没有 'spr:目录'、'spr/目录/…' 这样的直接引用；
// 只在怪物数据里出现（MON_ART、区域 spec 的 art:、地下城的怪物表、spawnMonster 的种类名）的，模型一定是 SpriteModel(目录, 怪物兜底表, SPR_ANIMS.monster)
const SPECIAL_FILES = /^src\/(content\/classes|content\/avatar|models|net|ui|engine)\/|^src\/game\/summon\.js$|^src\/content\/monsters\/sky_castle\.js$/;
export function genericMonDirs(R, D) {
  const dirs = new Set(), special = {};
  if (!D || !D.spr) return { dirs, frames: new Set(), special };
  const direct = [...R.lits].filter(s => /^spr[:/]/.test(s)).map(s => s.slice(4).split('/')[0]);
  for (const d of D.spr.monDirs) {
    const bad = (R.occ.get(d) || []).filter(o => SPECIAL_FILES.test(o.file));
    if (bad.length || direct.includes(d) || D.spr.classDirs.includes(d.split('@')[0])) { special[d] = bad.slice(0, 3).map(o => o.src).concat(direct.includes(d) ? ['spr:' + d] : []); continue; }
    dirs.add(d);
  }
  return { dirs, frames: new Set(D.spr.Rmon), special };
}
const ENUM_TESTS = new Set(['avatar', 'fighter_looks']);
// 人工看过的宽模板：洞的取值其实受限，宽匹配不算证据
const REVIEWED = [
  { pat: 'spr/fighter/${}', file: 'src/models/avatar.js', why: 'armDraw 里的 f 是格斗家模型当前画的帧，只能是动画表 / 兜底表里的帧（这些帧名已经按名字规则算过）' },
];
// 一个文件的引用证据：强 → trace / 取图函数 / 整个 key；中 → 名字 / 目录 + 帧名 / 模板（洞能用已有的字符串或数字填上）；弱 → 模板宽匹配（洞随便填）
export function classify(files, R, D, T) {
  const S = new Set([...R.lits, ...(D ? D.S : [])]), H = D ? D.H : {}, TK = T ? T.keys : {};
  const has = v => S.has(v) || /^\d+$/.test(v);
  // 带分类前缀的模板（`pet/${id}_${f}`）洞必须填已有的字符串 / 数字，本身就够具体，全部用上；不带前缀的只用有 2 个以上固定字母数字的
  const keyT = R.tpls.filter(t => t.key && t.parts[0].includes('/')), nameT = R.tpls.filter(t => !t.key && !catOnly(t.parts));
  const GM = genericMonDirs(R, D);
  const out = {};
  for (const k of Object.keys(files)) {
    const ev = { strong: [], mid: [], weak: [] }, { cat, dir, name } = splitKey(k);
    // 精灵帧只在“逐帧遍历 SPR_DATA 的测试”里画过的（avatar / fighter_looks 把每一帧都画一遍查外观），不算游戏里用到
    for (const p of ['d:', 'u:', 'g:', 'q:']) if (TK[p + k]) { if (cat === 'spr' && TK[p + k].every(w => ENUM_TESTS.has(w))) ev.enumOnly = 'trace ' + p + TK[p + k].join(','); else ev.strong.push('trace ' + p + TK[p + k].join(',')); }
    if (H[k]) ev.strong.push('data ' + H[k].join(','));
    if (R.lits.has(k)) ev.strong.push('字面量 ' + R.where.get(k));
    if (S.has(k) && !R.lits.has(k)) ev.strong.push('运行时字符串');
    for (const t of keyT) if (tmatch(t.parts, k, has)) { ev.mid.push('模板 ' + t.pat + ' @' + t.src); break; }
    const nameEv = (s, lab) => {
      if (S.has(s)) return lab + ' ' + s + (R.where.has(s) ? ' @' + R.where.get(s) : '（运行时）');
      const st = numStem(s); if (st && S.has(st)) return lab + '序号 ' + st + '…';
      for (const t of nameT) if (tmatch(t.parts, s, has)) return lab + '模板 ' + t.pat + ' @' + t.src;
      return null;
    };
    if (cat === 'spr') {
      const [d0, d1] = dir.split('@');
      const dirEv = nameEv(dir, '目录') || (S.has('spr:' + dir) && '目录 spr:' + dir) || (d1 && nameEv(d0, '目录') && nameEv(d1, '套装') && '目录 ' + d0 + '@' + d1);
      const fr = dirEv && nameEv(name, '帧');
      if (fr) ev.mid.push(dirEv + ' + ' + fr);
    } else { const e = nameEv(name, '名字'); if (e) ev.mid.push(e); }
    // 只当普通怪物用的精灵目录（MON_ART → SpriteModel(目录, 怪物兜底表, SPR_ANIMS.monster)）：帧只能从怪物动画表 / 兜底表里选，
    // 别的帧名碰巧在代码里出现（'taunt'、'idle2' 是别的东西的名字）不算；运行记录画出来过的照样算
    if (cat === 'spr' && GM.dirs.has(dir) && !ev.strong.length) {
      ev.mid = GM.frames.has(name) ? ['怪物通用动画表 / 兜底表里有 ' + name] : [];
      if (!ev.mid.length) ev.note = `目录 ${dir} 只当普通怪物用（MON_ART），帧 ${name} 不在 SPR_ANIMS.monster / 兜底表里`;
    }
    if (!ev.strong.length && !ev.mid.length && !ev.note) {
      for (const t of R.tpls) if (!catOnly(t.parts) && !REVIEWED.some(r => r.pat === t.pat && t.src.startsWith(r.file + ':')) && (t.key ? tmatch(t.parts, k, null) : tmatch(t.parts, name, null))) { ev.weak.push(t.pat + ' @' + t.src); if (ev.weak.length > 3) break; }
    }
    out[k] = ev;
  }
  return out;
}

/* ---------------- (b) 数据枚举 ---------------- */
// 所有脚本的顶层声明名（const / let / var / function / class）：页面里逐个取值，深度遍历收集字符串
export function globalNames() {
  const names = new Set();
  for (const f of srcFiles()) {
    if (!f.endsWith('.js')) continue;
    for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
      let m = line.match(/^(?:async\s+)?(?:function\*?|class)\s+([A-Za-z_$][\w$]*)/); if (m) { names.add(m[1]); continue; }
      m = line.match(/^(?:const|let|var)\s+(.*)$/); if (!m) continue;
      let depth = 0, cur = '';
      for (const ch of m[1]) { if ('([{'.includes(ch)) depth++; else if (')]}'.includes(ch)) depth--; if (ch === ',' && depth === 0) { const n = cur.match(/^\s*([A-Za-z_$][\w$]*)\s*=/); if (n) names.add(n[1]); cur = ''; } else cur += ch; }
      const n = cur.match(/^\s*([A-Za-z_$][\w$]*)\s*=/); if (n) names.add(n[1]);
    }
  }
  return [...names];
}
// 页面里跑：S = 运行时数据里出现过的所有字符串（值 + 对象键），H = 用游戏自己的取图函数算出来的 key
function pageEnum(names) {
  const S = new Set(), H = {}, seen = new WeakSet();
  const add = (k, why) => { if (k && typeof k === 'string') (H[k] ||= new Set()).add(why); };
  const SKIP = new Set(['ASSET_SRC', 'ASSET_BUNDLE', 'SPR_DATA', 'IMG', 'tintCache', 'bundleLoads', 'SPR_SIL', 'SPR_LOOP_CACHE', 'WEAPON_IMG', '__AT']);
  let budget = 8e6;
  const walk = (v, d) => {
    if (budget-- < 0) return;
    if (typeof v === 'string') { if (v.length < 120) S.add(v); return; }
    if (!v || typeof v !== 'object' || d > 16 || seen.has(v)) return;
    seen.add(v);
    if (v instanceof Node || v === window || v instanceof HTMLImageElement || v instanceof HTMLCanvasElement || ArrayBuffer.isView(v) || v instanceof ArrayBuffer || v instanceof CanvasRenderingContext2D || (typeof AudioNode !== 'undefined' && v instanceof AudioNode) || (typeof AudioBuffer !== 'undefined' && v instanceof AudioBuffer) || v instanceof Event) return;
    if (v instanceof Map) { for (const [a, b] of v) { walk(a, d + 1); walk(b, d + 1); } return; }
    if (v instanceof Set) { for (const a of v) walk(a, d + 1); return; }
    let ds; try { ds = Object.getOwnPropertyDescriptors(v); } catch (e) { return; }
    for (const k in ds) { if (!/^\d+$/.test(k)) S.add(k); if ('value' in ds[k]) walk(ds[k].value, d + 1); }
  };
  const vals = {};
  for (const n of names) { if (SKIP.has(n)) continue; try { vals[n] = (0, eval)(n); } catch (e) { } }
  for (const n in vals) { const v = vals[n]; if (typeof v === 'function') { for (const k of Object.keys(v)) walk(v[k], 1); } else walk(v, 0); }
  // 物品图标：每件物品按各种品级算一次（itemArtKey 取第一张存在的图；商城 cashIcon 的包装也在里面）
  const skins = [null, ...Object.keys(WEAPON_SKINS).map(key => ({ key })), ...Object.keys(ITEMS).filter(k => ITEMS[k].skin).map(k => ({ key: k, skin: ITEMS[k].skin }))];
  const clsList = Object.keys(CLASSES);
  for (const key in ITEMS) {
    let it; try { it = makeItem(key, 1); } catch (e) { it = null; } if (!it) it = { ...ITEMS[key], key };
    for (const rar of [undefined, 0, 1, 2, 3, 4, 5]) {
      const x = rar === undefined ? it : { ...it, rar };
      try { add(itemArtKey(x), 'itemArtKey:' + key); } catch (e) { }
      try { const s = itemIconSrc(x); if (s && /^assets\//.test(s)) add(s.replace(/^assets\//, '').replace(/\.webp$/, ''), 'itemIconSrc:' + key); } catch (e) { }
    }
    if (it.slot === 'weapon') for (const cls of clsList) for (const sk of skins) for (const rar of [undefined, 0, 1, 2, 3, 4]) { try { const w = weaponArtOf(rar === undefined ? it : { ...it, rar }, cls, sk); if (w) add('weapon/' + w, 'weaponArtOf:' + key); } catch (e) { } }
  }
  for (const t in WTYPES) for (const sk of skins) for (const rar of [0, 1, 2, 3, 4, 5]) { try { const w = weaponArtOf({ key: '__none', wtype: t, rar }, WTYPES[t].cls, sk); if (w) add('weapon/' + w, 'weaponArtOf:' + t); } catch (e) { } }
  // 转职立绘 / 觉醒插图 / 职业立绘
  for (const cls of clsList) {
    add('class/' + cls, 'class'); add('cutin/' + cls, 'cutin');
    const J = CLASSES[cls].jobs || {};
    for (const id in J) {
      try { add(jobArtKey(cls, id), 'jobArtKey'); } catch (e) { }
      if (J[id].art) add(J[id].art, 'J.art');
      for (const tier of ['', 2, 3]) add('cutin/' + id + tier, 'cutinWho');
    }
  }
  // 地下城门 / 场景
  if (typeof DUNGEONS !== 'undefined') for (const id in DUNGEONS) { try { add(gateArt(DUNGEONS[id]).art, 'gateArt:' + id); } catch (e) { } }
  const out = { S: [...S], H: {} };
  for (const k in H) out.H[k] = [...H[k]].slice(0, 3);
  // 普通怪物模型能选到的帧：SPR_ANIMS.monster 的所有帧 + 怪物兜底表（sprites.js 的 MON[kk].model）
  const Rmon = new Set(['idle', ...Object.values({ ...SPR_FALLBACK, cast: 'cast1', roar: 'cast2', crouch: 'low1' })]);
  for (const A of Object.values(SPR_ANIMS.monster)) { if (A.frames) A.frames.forEach(f => Rmon.add(f)); else A.forEach(x => Rmon.add(x[0])); }
  out.spr = { monDirs: [...new Set(Object.values(MON_ART).map(a => [].concat(a)[0]))], Rmon: [...Rmon], classDirs: Object.keys(CLASSES).concat(['pmsuit']) };
  return out;
}
export async function dataPass() {
  const { launch, URL_BASE } = await import('../test/lib.mjs');
  const { browser, page, logs } = await launch({ width: 960, height: 540 });
  await page.goto(`${URL_BASE}?town&cls=sword&mute&fresh`); await page.waitForFunction(() => window.__READY, null, { timeout: 90000 });
  await page.waitForTimeout(1500);
  const r = await page.evaluate(pageEnum, globalNames());
  await browser.close();
  const errs = logs.filter(l => l.type === 'pageerror');
  if (errs.length) console.log('页面错误', errs.slice(0, 3));
  fs.writeFileSync(path.join(OUT, 'data.json'), JSON.stringify(r));
  console.log(`数据枚举：运行时字符串 ${r.S.length} 个，取图函数算出的 key ${Object.keys(r.H).length} 个`);
  return r;
}

/* ---------------- (c) 运行记录 ---------------- */
// 埋点（插在页面脚本最前面）：d: 真正画到画布上 / 做成图案的素材（tintImg 里的预先换色不算，换色后的画布画出来时才算）、
// u: DOM 里用到的素材（<img> / 背景图）、g: 代码按 key 取 IMG（分包批量加载不算）、q: 代码查 ASSET_SRC 有没有这个 key（同上）
const TRACE_PRELUDE = `window.__AT = (() => {
  const A = { tint: 0, bulk: 0 }, seen = new Set(); let pend = [];
  const flush = () => { if (!pend.length) return; const b = JSON.stringify({ p: location.pathname, k: pend }); pend = []; try { fetch('/__trace', { method: 'POST', body: b, keepalive: b.length < 60000 }); } catch (e) { } };
  const rec = k => { if (seen.has(k)) return; seen.add(k); pend.push(k); if (pend.length === 1) setTimeout(flush, 250); };
  setInterval(flush, 1000); addEventListener('pagehide', flush);
  const isKey = k => typeof k === 'string' && k.includes('/') && !k.startsWith('assets/') && !k.startsWith('data:');
  A.img = new Proxy({}, { get(t, k) { if (!A.tint && !A.bulk && isKey(k)) rec('g:' + k); return t[k]; } });
  A.src = o => new Proxy(o, { get(t, k) { if (!A.bulk && isKey(k)) rec('q:' + k); return t[k]; } });
  const keyOfUrl = s => { const i = s ? s.indexOf('assets/') : -1; return i < 0 ? null : decodeURIComponent(s.slice(i + 7).replace(/\\.webp.*$/, '')); };
  const keyOf = im => im && (im.__k || (im instanceof HTMLImageElement ? keyOfUrl(im.getAttribute('src')) : null));
  const RMAX = {}, CNT = {};
  const recR = (k, r) => { if (!(r > 0) || !isFinite(r)) return; if (r > (RMAX[k] || 0) * 1.03) { RMAX[k] = r; pend.push('r:' + k + '|' + r.toFixed(3)); if (pend.length === 1) setTimeout(flush, 250); } };
  // 画到屏幕上的放大倍数（每个源像素占几个屏幕像素）：世界层按 1920×1080 的实际画布算；UI 层按最大情况（逻辑 1920 宽、2 倍像素）折算
  const ratio = (ctx, im, a) => {
    const n = a.length, sw = n >= 9 ? a[3] : im.width, sh = n >= 9 ? a[4] : im.height, dw = n >= 9 ? a[7] : n >= 5 ? a[3] : im.width, dh = n >= 9 ? a[8] : n >= 5 ? a[4] : im.height;
    const t = ctx.getTransform(), s = Math.sqrt(Math.abs(t.a * t.d - t.b * t.c)), r = s * Math.max(Math.abs(dw / sw), Math.abs(dh / sh));
    return ctx.canvas.id === 'ui' ? r / (ctx.canvas.width / 1920) * 2 : r;
  };
  for (const P of [CanvasRenderingContext2D.prototype, typeof OffscreenCanvasRenderingContext2D !== 'undefined' && OffscreenCanvasRenderingContext2D.prototype].filter(Boolean)) {
    const di = P.drawImage, cp = P.createPattern;
    P.drawImage = function (im) {
      const k = keyOf(im);
      if (k) {
        if (A.tint) { if (this.canvas) this.canvas.__k = k; }
        else {
          rec('d:' + k);
          const cv = this.canvas, on = cv && cv.isConnected && (cv.id === 'world' || cv.id === 'ui');
          if (!on) rec('o:' + k);
          else { const c = CNT[k] = (CNT[k] || 0) + 1; if (c < 12 || c % 24 === 0) recR(k, ratio(this, im, arguments)); }
        }
      }
      return di.apply(this, arguments);
    };
    P.createPattern = function (im) { const k = keyOf(im); if (k && !A.tint) { rec('d:' + k); rec('o:' + k); } return cp.apply(this, arguments); };
  }
  const scanEl = el => {
    if (!el || el.nodeType !== 1) return;
    if (el.tagName === 'IMG') { const k = keyOfUrl(el.getAttribute('src')); if (k) rec('u:' + k); }
    const st = el.getAttribute && el.getAttribute('style'); if (st && st.includes('assets/')) for (const m of st.matchAll(/assets\\/([^)"'\\s]+?)\\.webp/g)) { rec('u:' + decodeURIComponent(m[1])); rec('o:' + decodeURIComponent(m[1])); }
  };
  new MutationObserver(ms => { for (const m of ms) { if (m.type === 'attributes') scanEl(m.target); for (const n of m.addedNodes || []) if (n.nodeType === 1) { scanEl(n); if (n.querySelectorAll) n.querySelectorAll('img,[style]').forEach(scanEl); } } })
    .observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['src', 'style'] });
  // DOM 图片的显示大小：按最大情况折算（舞台 1920 宽 × 2 倍像素 = 3840 屏幕像素）
  setInterval(() => {
    const st = document.getElementById('stage'), W = st && st.getBoundingClientRect().width; if (!W) return;
    for (const im of document.querySelectorAll('img')) { const k = keyOfUrl(im.getAttribute('src')); if (!k || !im.naturalWidth) continue; const b = im.getBoundingClientRect(); if (b.width > 0) recR(k, Math.max(b.width / im.naturalWidth, b.height / im.naturalHeight) * 3840 / W); }
  }, 700);
  return A;
})();`;
function patchPage(html) {
  const rep = (a, b) => { if (!html.includes(a)) throw new Error('埋点位置找不到：' + a); html = html.replace(a, b); };
  rep('<script>', '<script>' + TRACE_PRELUDE + '</script>\n<script>');
  html = html.replace(/const ASSET_SRC = (\{.*?\});\n/, (m, o) => `const ASSET_SRC = __AT.src(${o});\n`);
  rep('const IMG = {};', 'const IMG = __AT.img;');
  const wrap = (sig, name, args, body) => rep(sig, `function ${name}(${args}) { ${body} }\n` + sig.replace(`function ${name}(`, `function ${name}__o(`));
  wrap('function loadBundles(names) {', 'loadBundles', 'names', '__AT.bulk++; try { return loadBundles__o(names); } finally { __AT.bulk--; }');
  wrap('function loadArtKey(k) {', 'loadArtKey', 'k', '__AT.bulk++; try { return loadArtKey__o(k); } finally { __AT.bulk--; }');
  wrap('function tintImg(key, deg = 0, b = 1, s = 1, only = null) {', 'tintImg', '...a', '__AT.tint++; try { const r = tintImg__o(...a); if (r && r.tagName !== "IMG") r.__k = a[0]; return r; } finally { __AT.tint--; }');
  return html;
}
// 起埋点网页版：dist/web 的页面打补丁，素材直接读 dist/web/assets；POST /__trace 收记录。
// 每个测试用自己的路径 /t/<测试名>/index.html（素材按相对路径跟着走），记录按页面路径归到对应的测试上（并行跑也分得清）
export function traceServer(onKeys, on404 = () => { }) {
  const web = path.join(ROOT, 'dist', 'web'), page = patchPage(fs.readFileSync(path.join(web, 'index.html'), 'utf8'));
  const types = { '.html': 'text/html; charset=utf-8', '.webp': 'image/webp', '.js': 'text/javascript', '.json': 'application/json' };
  return new Promise(res => {
    const srv = http.createServer((req, rsp) => {
      const u = decodeURIComponent(req.url.split('?')[0]).replace(/^\/t\/[^/]+/, '');
      if (req.method === 'POST' && u === '/__trace') { let b = ''; req.on('data', d => b += d); req.on('end', () => { try { const o = JSON.parse(b); onKeys(o.k, (o.p.match(/^\/t\/([^/]+)\//) || [])[1] || '?'); } catch (e) { } rsp.end('ok'); }); return; }
      if (u === '/' || u === '/index.html') { rsp.writeHead(200, { 'Content-Type': types['.html'] }); rsp.end(page); return; }
      const p = path.join(web, u);
      fs.readFile(p, (err, buf) => { if (err) { on404(u); rsp.writeHead(404); rsp.end(); return; } rsp.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'application/octet-stream' }); rsp.end(buf); });
    }).listen(0, () => res({ srv, base: `http://127.0.0.1:${srv.address().port}` }));
  });
}
// 巡游用的现成测试（覆盖：全职业全转职全部主动技能 / 觉醒、外观 / 时装 / 武器、场景 / NPC / 世界地图、老区域和 7 个新区域的每个怪物和领主招式、商城 / 背包 / 界面、召唤类转职）
const TOUR = [
  'test/skillshots.mjs sword,sword:blade,sword:berserker,sword:asura,sword:soulbender,sword:ghostblade', 'test/skillshots.mjs gun,gun:ranger,gun:launcher,gun:mechanic,gun:spitfire,gun:paramedic',
  'test/skillshots.mjs mage,mage:elemental,mage:battlemage,mage:summoner,mage:witch,mage:enchantress', 'test/skillshots.mjs fighter,fighter:nenmaster,fighter:striker,fighter:brawler,fighter:grappler', 'test/avatar.mjs', 'test/fighter_looks.mjs', 'test/weapons.mjs', 'test/jobvisuals.mjs', 'test/vanity.mjs', 'test/world.mjs', 'test/bestiary.mjs',
  'test/sky.mjs', 'test/behemoth.mjs', ...['siroco', 'darkelf', 'snow', 'ancient', 'gent', 'train', 'timegate'].map(r => `test/region.mjs ${r} monsters,scenes,abyss`),
  'test/shop.mjs', 'test/ui.mjs', 'test/items.mjs', 'test/bag.mjs', 'test/flow.mjs', 'test/epicfx.mjs', 'test/polish.mjs', 'test/guide.mjs', 'test/quests60.mjs', 'test/fighter_quests.mjs',
  'test/summoner.mjs', 'test/witch.mjs', 'test/enchantress.mjs', 'test/mechanic.mjs', 'test/paramedic.mjs', 'test/spitfire.mjs', 'test/nenmaster.mjs', 'test/brawler.mjs', 'test/grappler.mjs', 'test/striker.mjs',
  'test/duel_rules.mjs', 'test/mobile.mjs', 'test/skyguide.mjs', 'test/ancient.mjs', 'tools/asset_audit.mjs tour',
];
export async function tracePass(list, par = 3) {
  const file = path.join(OUT, 'trace.json');
  const T = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : { keys: {}, runs: {}, ratio: {} };
  T.ratio ||= {};
  const save = () => fs.writeFileSync(file, JSON.stringify(T));
  const onKeys = (ks, who) => {
    for (const k of ks) {
      if (k.startsWith('r:')) { const i = k.lastIndexOf('|'), key = k.slice(2, i), r = +k.slice(i + 1); if (!(T.ratio[key] >= r)) T.ratio[key] = r; continue; }
      const L = T.keys[k] ||= []; if (!L.includes(who) && L.length < 8) L.push(who);
    }
  };
  const { srv, base } = await traceServer(onKeys, u => { T.notFound ||= {}; T.notFound[u] = (T.notFound[u] || 0) + 1; });
  const logDir = path.join(OUT, 'logs'); fs.mkdirSync(logDir, { recursive: true });
  const queue = [...list];
  const one = async cmd => {
    const name = cmd.replace(/^(test|tools)\//, '').replace(/\.mjs/, '').replace(/[^\w-]+/g, '_').slice(0, 60);
    const t0 = Date.now();
    const code = await new Promise(res => {
      const [bin, ...args] = cmd.split(' ');
      const p = spawn(process.execPath, [bin, ...args], { cwd: ROOT, env: { ...process.env, GAME_URL: `${base}/t/${name}/index.html` }, stdio: ['ignore', fs.openSync(path.join(logDir, name + '.log'), 'w'), fs.openSync(path.join(logDir, name + '.log'), 'a')] });
      const to = setTimeout(() => p.kill('SIGKILL'), 45 * 60e3);
      p.on('exit', c => { clearTimeout(to); res(c); });
    });
    T.runs[name] = { code, s: Math.round((Date.now() - t0) / 1000) }; save();
    console.log(`  ${name}: 退出码 ${code}，${T.runs[name].s}s，累计 ${Object.keys(T.keys).length} 条记录`);
  };
  await Promise.all(Array.from({ length: par }, async () => { while (queue.length) await one(queue.shift()); }));
  await new Promise(r => setTimeout(r, 1500)); save(); srv.close();
  return T;
}
// 自己的巡游（补现成测试没走到的）：每个地下城进一次、逐个房间换过去；商城每个分页；背包里塞满全部物品翻页；个人信息 / 时装页
async function tour() {
  const { launch, URL_BASE } = await import('../test/lib.mjs');
  const { browser, page, logs } = await launch({ width: 1280, height: 720 });
  const open = async q => { await page.goto(`${URL_BASE}?${q}`); await page.waitForFunction(() => window.__READY, null, { timeout: 60000 }); };
  await open('town&cls=sword&mute&fresh&lv=60');
  const dungeons = await page.evaluate(() => Object.keys(DUNGEONS));
  console.log('地下城', dungeons.length);
  for (const id of dungeons) {
    try {
      await open(`dungeon=${id}&lv=60&cls=gun&mute`);
      await page.evaluate(() => { game.speedMul = 3; }).catch(() => { });
      await page.waitForTimeout(700);
      const n = await page.evaluate(() => (game.dungeon && game.dungeon.layout ? game.dungeon.layout.rooms.length : 0)).catch(() => 0);
      for (let i = 0; i < n; i++) {
        await page.evaluate(i => { try { const D = game.dungeon, r = D.layout.rooms[i]; if (r.type === 'boss' || r.type === 'elite' || i % 3 === 0) D.enter(r, null); } catch (e) { } }, i).catch(() => { });
        await page.waitForTimeout(150);
      }
      await page.waitForTimeout(400);
    } catch (e) { console.log('  ', id, e.message.split('\n')[0]); }
  }
  await open('town&cls=mage&mute&fresh&lv=60');
  await page.evaluate(async () => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    for (const k of Object.keys(ITEMS)) { try { inv.add(makeItem(k, 1)); } catch (e) { } }
    for (const w of ['inv', 'status', 'skills', 'quests', 'worldmap', 'cash', 'storage', 'avatar']) { try { menus.open(w); await sleep(400); document.querySelectorAll('.tab, [data-tab]').forEach(t => t.click && t.click()); await sleep(300); menus.closeAll ? menus.closeAll() : null; } catch (e) { } }
  });
  await page.waitForTimeout(1000);
  await browser.close();
}

const fmtMB = b => (b / 1048576).toFixed(2);
const groupOf = k => k.startsWith('spr/') ? 'spr/' + splitKey(k).dir : k.includes('/') ? k.split('/')[0] : '(根目录)';
function loadJson(f) { const p = path.join(OUT, f); return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null; }
export function audit() {
  const files = artFiles(), R = staticRules(), D = loadJson('data.json'), T = loadJson('trace.json');
  const C = classify(files, R, D, T), SJ = sprJson();
  const unused = [], suspect = [];
  for (const k in C) { const e = C[k]; if (e.strong.length || e.mid.length) continue; (e.weak.length ? suspect : unused).push(k); }
  // 缺文件：代码 / 数据要的 key 在 art/final 里没有。lit = 代码里写死的整条 key；rt = 运行时按 key 查过（IMG / ASSET_SRC）；fn = 取图函数的候选；sj = spr.json 有帧没图
  const missing = {};
  const miss = (k, type, why) => { if (files[k] === undefined) ((missing[k] ||= { type, why: new Set() }).why.add(why)); };
  const frag = new Set(R.tpls.filter(t => t.parts.length > 1).map(t => t.parts[0]));
  for (const s of R.lits) if (/^(spr|icon|fx|bg|world|cutin|job|class|weapon|cash|pet|aura|avatar)\/[\w@.-]*[\w.-](\/[\w.-]+)?$/.test(s) && !frag.has(s)) miss(s, 'lit', R.where.get(s));
  for (const d in SJ) for (const f in SJ[d].frames) miss(`spr/${d}/${f}`, 'sj', `art/final/spr/${d}/spr.json`);
  if (T) for (const t in T.keys) { const p = t.slice(0, 2), k = t.slice(2); if ((p === 'g:' || p === 'q:') && /^[a-z]+\/[\w@.-]/.test(k)) miss(k, 'rt', T.keys[t].slice(0, 3).join(',')); }
  if (D) for (const k in D.H) if (/^(icon|weapon|job|cutin|class|world|bg)\//.test(k)) miss(k, 'fn', D.H[k].join(','));
  return { files, C, unused, suspect, missing, T, R, D };
}

// 报告里的“为什么没用”：按文件名套的说明（没套上的用通用说明）
const WHY = [
  [/^spr\/mech_/, 'gun_mechanic.js 的机器人外观 mechFrame() 只取 MECH_LOOK 里写死的帧名，没有这一帧'],
  [/^spr\/pmsuit\//, '协战师战斗服的动画表 pmAnims()（gun_paramedic.js）没有这一帧'],
  [/^spr\/thornhut\//, '林中小屋（mage_enchantress.js enFrame）只取 idle / 摇晃 / 倒塌帧，没有这一帧'],
  [/\/victory$/, '游戏里没有“胜利”片段：代码和数据里都没有 victory 这个帧名'],
  [/^icon\/x_/, '旧版通用图标（x_ 前缀），代码 / 物品 / 技能 / 任务数据里都没有这个名字'],
  [/^icon\/bm_fusion$/, '炫纹融合已换成超级炫纹（bm_super，旧技能 id 由存档迁移清掉，docs/SKILLS_OFFICIAL_mage.md）'],
  [/^icon\/f_emblem$/, '格斗家技能图标表第 16 格顺带出的职业徽记（art/tools/fighter_base_art.py），游戏里没用'],
  [/^icon\/q_magic_stone$/, '任务道具图标表里的一格（art/tools/quest_icons.py），没有任务 / 物品用它'],
  [/^world\/b_boutique$/, '城镇建筑“时装店”（art/tools/jobs.py 出的图），没有摆进任何场景'],
];
// 运行时查过但没有的 key：已知的“先查专属图、没有就用通用的”探测
const PROBES = [
  [/^fx\/wt_/, 'mage_witch.js：没有图就用 fxTint / fireball / orb 代替（美术没出）'],
  [/^fx\/fn_beast_/, 'fighter_nen.js fnBeast：念兽有素材就画素材，没有就程序画发光兽形（素材没出）'],
  [/^icon\/wt_fam_/, 'mage_witch.js craftPop：使魔结果表情有图标就用，没有就画带颜色的小圆牌（图标没出）'],
  [/^spr\/phantom\/idle$/, 'summon.js summonLoadArt 用 spr/<分包>/idle 判断分包是否已加载；幻鬼（phantom）的站姿帧叫 pfloat、没有 idle，所以每次召唤都会再调一次 loadBundles（功能正常，只是多做一次空加载）'],
  [/^bg\/.+_(mid|fore)$/, 'content/abyss.js 给深渊复制背景时 5 种图层逐个查，mid / fore 本来就没有（手绘背景只有 far / floor / edge）'],
  [/^bg\/abyss\w*_(far|floor|edge)$/, '深渊主题先查自己的背景，没有就借普通主题的（content/abyss.js）'],
  [/^cutin\/fighter$/, 'hud.js 觉醒插图按 cutin/<职业或转职> 取；格斗家没有基础职业的插图（鬼剑士 / 神枪手 / 魔法师有），没有就画人物模型'],
  [/^cutin\/\w+[23]$/, 'cutinWho（common.js）：二觉 / 三觉有专属插图就用，没有就用一觉的'],
  [/^icon\//, 'itemArtKey / 技能图标：按候选顺序查（icon 字段 → 通用图 → 旧图标 → 代码绘制）'],
  [/^world\/g_/, 'gateArt（world.js）：地下城有专属门图就用，没有用通用门'],
  [/^spr\/[^/]+\/(idle|walk1|build)$/, '精灵分包是否已加载 / 是否有美术的探测（没有就用程序画的兜底）'],
];
const DOC = path.join(ROOT, 'docs', 'ASSET_AUDIT.md');
function writeDoc(A) {
  const { files, C, unused, suspect, missing } = A, size = ks => ks.reduce((s, k) => s + files[k], 0), kb = b => (b / 1024).toFixed(0);
  const why = k => C[k].note || (WHY.find(([re]) => re.test(k)) || [])[1] || '代码字面量 / 模板 / 运行时数据里都没有这个名字，巡游测试也没画过';
  const L = [];
  const cat = k => k.startsWith('spr/') ? 'spr' : k.includes('/') ? k.split('/')[0] : '(根目录)';
  const cats = {}; for (const k in files) { const c = cat(k); (cats[c] ||= { n: 0, b: 0, un: 0, ub: 0, su: 0 }); cats[c].n++; cats[c].b += files[k]; }
  for (const k of unused) { cats[cat(k)].un++; cats[cat(k)].ub += files[k]; }
  for (const k of suspect) cats[cat(k)].su++;
  L.push('## 2. 按目录汇总（盘点时的 art/final）', '', '| 目录 | 文件 | 大小 MiB | 没用（删除） | 删除 KiB | 疑似（留着） |', '|---|---:|---:|---:|---:|---:|');
  for (const [c, v] of Object.entries(cats).sort((a, b) => b[1].b - a[1].b)) L.push(`| ${c} | ${v.n} | ${fmtMB(v.b)} | ${v.un} | ${kb(v.ub)} | ${v.su} |`);
  const tot = Object.values(cats).reduce((s, v) => ({ n: s.n + v.n, b: s.b + v.b, un: s.un + v.un, ub: s.ub + v.ub, su: s.su + v.su }), { n: 0, b: 0, un: 0, ub: 0, su: 0 });
  L.push(`| **合计** | ${tot.n} | ${fmtMB(tot.b)} | ${tot.un} | ${kb(tot.ub)} | ${tot.su} |`, '');
  L.push('## 3. 删除清单', '', '### 3.1 最大的 30 个', '', '| 文件 | KB | 为什么没用 |', '|---|---:|---|');
  for (const k of [...unused].sort((a, b) => files[b] - files[a]).slice(0, 30)) L.push(`| \`${k}\` | ${kb(files[k])} | ${why(k)} |`);
  L.push('', `### 3.2 全部 ${unused.length} 个（按目录，${fmtMB(size(unused))} MiB，每项后面是 KiB）`, '');
  if (unused.some(k => C[k].note)) L.push('没写原因的都是普通怪物目录的帧：目录只当普通怪物用（MON_ART），这一帧不在 `SPR_ANIMS.monster` / 怪物兜底表里（见 §1 第 2 条）。', '');
  const by = {}; for (const k of unused) (by[groupOf(k)] ||= []).push(k);
  for (const [g, ks] of Object.entries(by).sort((a, b) => size(b[1]) - size(a[1]))) {
    const reasons = [...new Set(ks.map(why))];
    L.push(`- \`${g}\`（${ks.length} 个，${kb(size(ks))} KiB）：${ks.map(k => `${k.slice(g.length + 1)} ${kb(files[k])}`).join('、')}${reasons.length === 1 ? ' —— ' + reasons[0] : ''}`);
  }
  L.push('', `## 4. 疑似未用（${suspect.length} 个，留着没删）`, '');
  if (!suspect.length) L.push('没有：凡是只剩“模板宽匹配”这种弱证据的，都已按具体规则（洞必须能用已有的字符串 / 数字填上）判定。', '');
  for (const k of suspect) L.push(`- \`${k}\`（${kb(files[k])} KB）：${C[k].weak.join('；')}`);
  const M = t => Object.entries(missing).filter(([, v]) => v.type === t);
  L.push('', '## 5. 代码要、但 art/final 里没有的文件', '');
  L.push(`### 5.1 代码里写死的 key（${M('lit').length} 个，要么缺美术、要么是死代码）`, '');
  for (const [k, v] of M('lit')) { const P = PROBES.find(([re]) => re.test(k)); L.push(`- \`${k}\`：${[...v.why].join('、')}${P ? ' —— ' + P[1] : ''}`); }
  L.push('', `### 5.2 spr.json 里有帧、但没有图（${M('sj').length} 个）`, '');
  for (const [k, v] of M('sj')) L.push(`- \`${k}\`：${[...v.why].join('、')}`);
  if (!M('sj').length) L.push('没有。');
  const rt = [...M('rt'), ...M('fn')], grp = {};
  for (const [k, v] of rt) { const P = PROBES.find(([re]) => re.test(k)); const g = P ? P[1] : '其他（没有兜底说明，需要人看）'; (grp[g] ||= []).push(k); }
  L.push('', `### 5.3 运行时按 key 查过 / 取图函数的候选，但没有文件（${rt.length} 个，都是“有专属图就用，没有就退回通用图 / 程序画”的探测）`, '');
  for (const [g, ks] of Object.entries(grp)) L.push(`- ${g}（${ks.length} 个）：${ks.slice(0, 40).map(k => '`' + k + '`').join(' ')}${ks.length > 40 ? ' …' : ''}`);
  const body = L.join('\n');
  let doc = fs.existsSync(DOC) ? fs.readFileSync(DOC, 'utf8') : '# 素材盘点\n\n<!-- audit:start -->\n<!-- audit:end -->\n';
  doc = doc.replace(/<!-- audit:start -->[\s\S]*<!-- audit:end -->/, `<!-- audit:start -->（下面 §2~§5 由 \`node tools/asset_audit.mjs report --doc\` 生成）\n\n${body}\n\n<!-- audit:end -->`);
  fs.writeFileSync(DOC, doc);
  console.log('写入', path.relative(ROOT, DOC));
}

// 删完 / 瘦身后的目视抽查（网页版分包加载）：4 个职业进城、地下城、背包（塞满各类物品）、商城、觉醒插图；控制台里的“素材加载失败”和 404 一起报
async function spot() {
  process.env.WEB ||= '1';
  const { launch, URL_BASE } = await import('../test/lib.mjs');
  const { browser, page, logs } = await launch({ width: 1280, height: 720 });
  const dir = path.join(OUT, 'spot'); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  page.on('response', r => { if (r.status() >= 400 && !/\/api\//.test(r.url())) logs.push({ type: 'http' + r.status(), text: r.url() }); });
  const open = async q => { await page.goto(`${URL_BASE}?${q}`); await page.waitForFunction(() => window.__READY, null, { timeout: 60000 }); await page.evaluate(() => menus.closeAll()); await page.waitForTimeout(1200); };
  const shot = n => page.screenshot({ path: path.join(dir, n + '.png') });
  for (const c of ['sword', 'gun', 'mage', 'fighter']) { await open(`town&cls=${c}&mute&fresh&lv=60`); await shot('town_' + c); }
  await open('dungeon=lorien&lv=60&cls=sword&mute'); await shot('dungeon_lorien');
  await open('dungeon=abyss_gf&lv=60&cls=mage&mute&bot'); await page.waitForTimeout(800); await shot('dungeon_abyss');
  await open('town&cls=gun&mute&fresh&lv=60');
  await page.evaluate(() => {
    const ks = Object.keys(ITEMS), pick = f => ks.filter(k => f(ITEMS[k])).slice(0, 8);
    for (const k of [...pick(d => d.slot === 'weapon' && d.rar >= 5), ...pick(d => d.slot === 'top'), ...pick(d => d.kind === 'consumable' || d.kind === 'use'), ...pick(d => d.kind === 'mat'), ...pick(d => d.slot === 'ring'), ...pick(d => d.cashIcon)]) { try { inv.add(makeItem(k, 1)); } catch (e) { } }
    menus.open('inv');
  });
  await page.waitForTimeout(1500); await shot('inventory');
  await page.evaluate(() => { menus.closeAll(); menus.open('cash'); }); await page.waitForTimeout(1800); await shot('cashshop');
  await page.evaluate(() => menus.closeAll());
  for (const who of ['sword', 'mage', 'witch3', 'fighter', 'nenmaster', 'paramedic2']) {
    await page.evaluate(w => { game.cutin = { t: 30, dur: 100, name: 'CUT-IN ' + w, who: { cls: w } }; }, who); await page.waitForTimeout(300); await shot('cutin_' + who);
  }
  await page.evaluate(() => { game.cutin = null; });
  await browser.close();
  const bad = logs.filter(l => /素材加载失败|pageerror|^http[45]/.test(l.text + ' ' + l.type) || /^http/.test(l.type));
  console.log(`抽查截图 ${fs.readdirSync(dir).length} 张 → ${path.relative(ROOT, dir)}；素材加载失败 / 404 / 页面错误 ${bad.length} 条`);
  for (const l of bad.slice(0, 20)) console.log('  ', l.type, l.text.slice(0, 200));
}

const mode = process.argv[2];
if (mode === 'spot') await spot();
if (mode === 'data') await dataPass();
if (mode === 'report') {
  const A = audit(), { files, C, unused, suspect, missing } = A;
  const size = ks => ks.reduce((s, k) => s + files[k], 0);
  console.log(`文件 ${Object.keys(files).length}（${fmtMB(size(Object.keys(files)))} MB）；没用 ${unused.length}（${fmtMB(size(unused))} MB）；疑似 ${suspect.length}（${fmtMB(size(suspect))} MB）；缺文件 ${Object.keys(missing).length}`);
  const by = {}; for (const k of unused) { const g = groupOf(k); (by[g] ||= []).push(k); }
  for (const [g, ks] of Object.entries(by).sort((a, b) => size(b[1]) - size(a[1])).slice(0, +(process.argv[3] || 40))) console.log('  ', g, ks.length, fmtMB(size(ks)), ks.slice(0, 6).map(k => k.split('/').pop()).join(' '));
  fs.writeFileSync(path.join(OUT, 'unused.json'), JSON.stringify({ unused, suspect, missing: Object.fromEntries(Object.entries(missing).map(([k, v]) => [k, { type: v.type, why: [...v.why] }])), ev: Object.fromEntries([...unused, ...suspect].map(k => [k, C[k]])) }, null, 1));
  if (process.argv.includes('--doc')) writeDoc(A);
}
if (mode === 'trace') await tracePass(process.argv.length > 3 ? process.argv.slice(3) : TOUR, +(process.env.PAR || 3));
if (mode === 'tour') await tour();
if (mode === 'static') {
  const files = artFiles(), C = classify(files, staticRules()), ref = {}; for (const k in C) if (C[k].strong.length || C[k].mid.length) ref[k] = [...C[k].strong, ...C[k].mid];
  const un = Object.keys(files).filter(k => !ref[k]);
  const by = {}; for (const k of un) { const c = splitKey(k).cat + (k.startsWith('spr/') ? '/' + splitKey(k).dir : ''); (by[c] ||= [0, 0])[0]++; by[c][1] += files[k]; }
  console.log('文件', Object.keys(files).length, '静态没引用', un.length, (un.reduce((s, k) => s + files[k], 0) / 1e6).toFixed(1) + ' MB');
  for (const [c, [n, b]] of Object.entries(by).sort((a, b) => b[1][1] - a[1][1]).slice(0, +(process.argv[3] || 60))) console.log(' ', c, n, (b / 1e6).toFixed(2));
  fs.writeFileSync(path.join(OUT, 'static.json'), JSON.stringify({ unref: un, ref }, null, 0));
}
if (mode === 'delete') {
  const U = loadJson('unused.json'); if (!U) { console.log('先跑 report'); process.exit(1); }
  const files = artFiles(), ks = U.unused.filter(k => files[k] !== undefined);
  for (let i = 0; i < ks.length; i += 200) execFileSync('git', ['rm', '-q', '-f', '--', ...ks.slice(i, i + 200).map(k => path.join('art', 'final', k + '.webp'))], { cwd: ROOT });
  // 删掉的精灵帧同时从 spr.json 去掉（保持原来的缩进格式，浮点 2.0 不变成 2）
  const frames = {}; for (const k of ks) { const s = splitKey(k); if (s.cat === 'spr') (frames[s.dir] ||= []).push(s.name); }
  const py = [
    'import json, sys',
    'for d, fs in json.loads(sys.argv[1]).items():',
    '  p = "art/final/spr/" + d + "/spr.json"; s = open(p).read(); j = json.loads(s)',
    '  for f in fs: j["frames"].pop(f, None)',
    '  t = json.dumps(j, indent=1, ensure_ascii=False) if "\\n" in s[:20] else json.dumps(j, separators=(",", ":"), ensure_ascii=False)',
    '  open(p, "w").write(t + ("\\n" if s.endswith("\\n") else ""))',
  ].join('\n');
  if (Object.keys(frames).length) execFileSync('python3', ['-c', py, JSON.stringify(frames)], { cwd: ROOT });
  console.log(`git rm ${ks.length} 个文件（${fmtMB(ks.reduce((s, k) => s + files[k], 0))} MB），更新 ${Object.keys(frames).length} 个 spr.json`);
}
