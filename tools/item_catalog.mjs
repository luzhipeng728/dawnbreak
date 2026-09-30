// 物品 / 职业目录（给后台管理 /admin 的物品选择器和服务端的物品 key 校验用）：
// 在 Node 的 vm 里把网页版脚本跑一遍（浏览器接口全部换成什么都不做的替身），读出 ITEMS / CLASSES，写成 dist/web/catalog.json。
// build.mjs 出网页版时自动调用；失败只打警告，不影响构建（后台的物品选择器会提示“没有物品目录”）。
// 单独跑：node tools/item_catalog.mjs（读 dist/web/index.html，写 dist/web/catalog.json）
// 格式：{ id, time, items: [[key, 名字, 品级, kind, slot, 等级, 职业, 图标路径], ...], classes: { cls: { name, jobs: { id: 名字 } } }, scenes: { 场景 / 地下城 id: 名字 } }
import fs from 'fs';
import vm from 'vm';
import path from 'path';

function dummy() {
  const f = function () {};
  const p = new Proxy(f, {
    get(t, k) {
      if (k === Symbol.toPrimitive) return h => (h === 'number' ? 0 : '');
      if (k === Symbol.iterator) return function* () {};
      if (k === 'then') return undefined;
      if (k === 'length') return 0;
      return p;
    },
    set: () => true, apply: () => p, construct: () => p, has: () => true,
  });
  return p;
}

export function catalogFromJs(js, id = '') {
  const any = dummy(), store = { getItem: () => null, setItem() {}, removeItem() {}, clear() {}, key: () => null, length: 0 };
  const box = {
    console: { log() {}, warn() {}, error() {}, info() {}, debug() {} },
    setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {}, requestAnimationFrame: () => 0, cancelAnimationFrame() {}, queueMicrotask() {},
    performance: { now: () => 0 }, document: any, navigator: any, location: any, screen: any, history: any, localStorage: store, sessionStorage: store,
    Image: function () { return any; }, Audio: function () { return any; }, AudioContext: function () { return any; }, OffscreenCanvas: function () { return any; },
    Path2D: function () { return any; }, WebSocket: function () { return any; }, ResizeObserver: function () { return any; }, fetch: () => new Promise(() => {}),
    matchMedia: () => any, getComputedStyle: () => any, addEventListener() {}, removeEventListener() {}, devicePixelRatio: 1, innerWidth: 1280, innerHeight: 720,
    URL, URLSearchParams, TextEncoder, TextDecoder, atob, btoa,
  };
  box.window = box; box.self = box; box.globalThis = box;
  const ctx = vm.createContext(box);
  vm.runInContext(js, ctx, { filename: 'dawnbreak-web.js', timeout: 20000 });
  const out = vm.runInContext(`(() => {
    const items = Object.keys(ITEMS).map(k => {
      const D = ITEMS[k]; let icon = null;
      try { const a = itemArtKey({ ...D, key: k }); icon = a && ASSET_SRC[a] || null; } catch (e) { icon = null; }
      return [k, String(D.name || k), D.rar | 0, D.kind || 'mat', D.slot || '', D.lvl | 0, D.cls || '', icon];
    });
    const classes = {};
    for (const c in CLASSES) { const C = CLASSES[c], jobs = {}; for (const j in (C.jobs || {})) jobs[j] = String(C.jobs[j].name || j); classes[c] = { name: String(C.name || c), jobs }; }
    const scenes = {};
    for (const id in SCENES) scenes[id] = String(SCENES[id].name || id) + (SCENES[id].area && SCENES[id].area !== SCENES[id].name ? ' · ' + SCENES[id].area : '');
    for (const id in DUNGEONS) if (!scenes[id]) scenes[id] = String(DUNGEONS[id].name || id);
    return JSON.stringify({ items, classes, scenes });
  })()`, ctx, { timeout: 20000 });
  return { id, time: new Date().toISOString(), ...JSON.parse(out) };
}

export function writeCatalog(js, outDir, id) {
  try {
    const cat = catalogFromJs(js, id);
    if (!cat.items.length) throw new Error('物品库是空的');
    fs.writeFileSync(path.join(outDir, 'catalog.json'), JSON.stringify(cat));
    return cat;
  } catch (e) {
    console.warn(`（物品目录 catalog.json 没有生成：${e && e.message}）`);
    return null;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const ROOT = path.join(path.dirname(new URL(import.meta.url).pathname), '..');
  const page = fs.readFileSync(path.join(ROOT, 'dist/web/index.html'), 'utf8');
  const js = page.slice(page.indexOf('"use strict"'), page.lastIndexOf('</script>')).replace(/<\\\/script/gi, '</script');
  const id = JSON.parse(fs.readFileSync(path.join(ROOT, 'dist/web/version.json'), 'utf8')).id || '';
  const cat = writeCatalog(js, path.join(ROOT, 'dist/web'), id);
  if (cat) console.log(`dist/web/catalog.json：${cat.items.length} 件物品，${Object.keys(cat.classes).length} 个职业`);
  else process.exit(1);
}
