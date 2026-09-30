// 领主清单 + 查重（docs/BOSS_PLAN.md §4.2 P0-C）：在 Node 的 vm 里把 src/ 跑一遍（照 tools/item_catalog.mjs 的做法，浏览器接口换成替身），
// 读 DUNGEONS / MON / MON_ART / REGIONS / REGION_HOOKS / ABYSS / QUESTS，重新生成 docs/boss_inventory.json，并做查重：
//   - 两个领主机制组合完全相同 → 警告
//   - 招式相似度（技能种类 + 机制 + 招牌的 Jaccard）≥ 0.7 → 警告
//   - 底图相同但没写 variantOf → 警告；写了 variantOf 但体型差 < 15% → 警告
//   - 招牌少于 2 个 → 报错（规则见下面 BOSS_SCAN_SRC 的“招牌”一段）
// 用法：node tools/boss_inventory.mjs [--baseline] [--no-write] [--quiet]
//   --baseline  只报告，不因为报错退出 1（现有内容一定过不了，做基线 / 进度对照用）
//   --no-write  不改 docs/boss_inventory.json（只查重）
// 官方对照（official）、目标（target）、原语 / 分块（primitives / blocks）、手写领主的招牌名（boss.signature）这些人工整理的字段从旧的 json 里原样保留。
// boss.mjs 也用这里的 BOSS_SCAN_SRC 在页面里算招式数 / 招牌 / 相似度用的记号（同一份规则）。
import fs from 'fs';
import vm from 'vm';
import path from 'path';

const ROOT = path.join(path.dirname(new URL(import.meta.url).pathname), '..');

// 页面 / vm 里都能跑的扫描函数：window.bossScan(kind) → 领主的阶段 / 技能 / 机制 / 招牌 / 查重记号
// 招牌（签名招式）怎么算，满足任意一条就算一个（按名字去重）：
//   1. 技能 spec 写了 sig（true 或名字），或动作片段是招牌动作（clip: 'sigA' / 'sigB' …）
//   2. 用了 Phase 0 的新原语：技能 leap cone lanes mark plant pool pull、dash 变体（carry spin bounces wallStun frac）、aoe 带 linger / zone / trail；
//      机制 form stance duo gauntlet stagger arena protect facing split debuff order；特性 hitHp saVsRanged reflectRanged rooted back onGetup grabOnly stacks substitute
//   3. 显式声明的名字：区域 spec 的 boss.sig: [...]、MON.<领主>.sig: [...]（手写 AI 已有的招牌）、defineBossKit 套件的 sig: [...]、钩子 REGION_HOOKS.<名字>.sig: [...]
//   4. 有自定义钩子但钩子没写 sig：算 1 个（hook:<名字>）
// 名字：sig 写的名字 > say > 原语名。老的通用招式（swipe aoe rain summon shot blink … + groggy invuln shield safezone hazard enrage clones element tether）不算招牌。
export const BOSS_SCAN_SRC = String.raw`(() => {
  const SKILL_PRIM = ['leap', 'cone', 'lanes', 'mark', 'plant', 'pool', 'pull'];
  const DASH_VAR = ['carry', 'spin', 'bounces', 'wallStun', 'frac'];
  const MECH_PRIM = ['form', 'stance', 'duo', 'gauntlet', 'stagger', 'arena', 'protect', 'facing', 'split', 'debuff', 'order'];
  const TRAIT_PRIM = ['hitHp', 'saVsRanged', 'reflectRanged', 'rooted', 'back', 'onGetup', 'grabOnly', 'stacks', 'substitute'];
  const kitOf = k => { const D = MON[k] || {}; return (typeof BOSS_KITS !== 'undefined' && BOSS_KITS && BOSS_KITS[k]) || D.msKit || D.bossKit || D.kit || null; };
  const regionSpec = k => { const D = MON[k]; return D && D.region && REGIONS[D.region] && REGIONS[D.region].spec.bosses ? REGIONS[D.region].spec.bosses[k] || null : null; };
  const variant = s => (s.use === 'dash' ? DASH_VAR.find(v => s[v]) : s.use === 'aoe' && (s.linger || s.zone || s.trail) ? 'pool' : null);
  const label = s => {
    if (!s || !s.use) return '?';
    let L = s.use === 'aoe' ? 'aoe/' + (s.shape || 'circle') : s.use === 'rain' ? 'rain/' + (s.kind || 'hex') : s.use === 'shot' && s.mode ? 'shot/' + s.mode : s.use === 'summon' ? 'summon:' + s.kind
      : s.use === 'seq' ? 'seq[' + (s.steps || []).map(label).join(',') + ']' : s.use === 'mech' ? 'mech:' + (s.mech && s.mech.use) : s.use;
    const v = variant(s); if (v) L += '.' + v;
    if (s.clip && /^sig/.test(s.clip)) L += '@' + s.clip;
    return L;
  };
  const flat = (L, out = []) => { for (const s of L || []) { if (!s) continue; out.push(s); if (s.use === 'seq') flat(s.steps, out); if (s.then) flat([s.then], out); } return out; };
  window.bossScan = function (k) {
    const D = MON[k]; if (!D) return null;
    const S = regionSpec(k), K = kitOf(k), src = S || K;
    const art = MON_ART[k] ? [].concat(MON_ART[k]) : null;
    const handAtk = (D.attacks || []).filter(a => !a.ms);
    const engine = S ? 'region-spec' : (K || D.msPhases || D.msMechs || (D.attacks || []).some(a => a.ms)) ? 'legacy+kit' : 'legacy-handwritten';
    let skills, phases = [], base = [], mechs = [];
    if (src) {
      base = src.skills || [];
      phases = (src.phases || []).map(P => ({ at: P.at ?? 1, enterMechs: ((P.enter || {}).mechs || []).map(m => m.use), summon: (P.enter || {}).summon ? P.enter.summon.kind : null, skills: (P.skills || []).map(label), _sk: P.skills || [], _mk: (P.enter || {}).mechs || [] }));
      skills = flat([...base, ...phases.flatMap(P => P._sk)]);
      mechs = src.mechs || D.msMechs || [];
    } else {
      skills = (D.attacks || []).filter(a => a.ms).map(a => ({ use: a.ms, clip: a.clip, id: a.msId }));
      phases = (D.msPhases || []).map(P => ({ at: P.at ?? 1, enterMechs: ((P.enter || {}).mechs || []).map(m => m.use), summon: (P.enter || {}).summon ? P.enter.summon.kind : null, skills: [], _sk: [], _mk: (P.enter || {}).mechs || [] }));
      mechs = D.msMechs || [];
    }
    const mechSpecs = [...mechs, ...phases.flatMap(P => P._mk), ...skills.filter(s => s.use === 'mech' && s.mech).map(s => s.mech)];
    const skillUses = [...new Set(skills.map(s => s.use).filter(u => u !== 'mech'))].sort();
    const mechSet = [...new Set(mechSpecs.map(m => m.use))].sort();
    const traits = (src && src.traits) || D.msTraits || {};
    const sig = [], seen = new Set(), add = (name, why) => { name = String(name); if (!seen.has(name)) { seen.add(name); sig.push({ name, why }); } };
    for (const s of skills) {
      const v = variant(s), nm = typeof s.sig === 'string' ? s.sig : s.say || s.use + (v ? '.' + v : '');
      if (s.sig) add(nm, 'sig');
      else if (s.clip && /^sig/.test(s.clip)) add(nm, 'clip:' + s.clip);
      else if (SKILL_PRIM.includes(s.use)) add(nm, s.use);
      else if (v) add(nm, s.use + '.' + v);
    }
    for (const m of mechSpecs) if (m.sig || MECH_PRIM.includes(m.use)) add(typeof m.sig === 'string' ? m.sig : m.say || m.use, m.use);
    for (const t of TRAIT_PRIM) if (traits[t]) add('trait.' + t, 'trait');
    for (const n of [...((S && S.sig) || []), ...(D.sig || []), ...((K && K.sig) || [])]) add(n, 'declared');
    const hook = D.hook || (S && S.hook) || null, H = hook && typeof REGION_HOOKS !== 'undefined' ? REGION_HOOKS[hook] : null;
    if (H && Array.isArray(H.sig)) for (const n of H.sig) add(n, 'hook'); else if (hook) add('hook:' + hook, 'hook');
    const tokens = new Set([...skillUses.map(u => 's:' + u), ...mechSet.map(u => 'm:' + u)]);
    for (const s of skills) { const v = variant(s); if (v) tokens.add('s:' + s.use + '.' + v); }
    for (const t of TRAIT_PRIM) if (traits[t]) tokens.add('t:' + t);
    if (hook) tokens.add('h:' + hook);
    for (const g of sig) if (g.why === 'sig' || g.why === 'declared' || g.why.startsWith('clip:') || g.why === 'hook') tokens.add('x:' + g.name);
    if (handAtk.length) tokens.add('l:' + k);
    const variantOf = (S && S.variantOf) || D.variantOf || (K && K.variantOf) || null;
    return {
      kind: k, name: D.name, lvl: D.lvl, engine, region: D.region || null, hook,
      art: { base: art ? art[0] : 'model:' + k, recolor: art && art[1] ? art[1] : null }, variantOf,
      scale: D.scale || 1, h: D.h, visualH: Math.round(D.h * (D.scale || 1)), bars: D.bars, elem: D.elem || null, tier: (S && S.tier) || null,
      summons: D.summons || [],
      attacks: handAtk.map(a => a.clip),
      phases: phases.map(({ _sk, _mk, ...P }) => P), baseSkills: base.map(label), mechs: mechs.map(m => m.use),
      skillUses, mechSet, moves: (D.attacks || []).length, sig, tokens: [...tokens].sort(),
      windups: skills.filter(s => s.windup != null).map(s => ({ skill: label(s), windup: s.windup })),
    };
  };
})();`;

// 在 vm 里读出清单用的原始数据（地下城顺序 = 定义顺序）
const COLLECT_SRC = String.raw`(() => {
  const qOf = id => Object.keys(QUESTS).filter(q => (QUESTS[q].goals || []).some(g => [].concat(g.dungeon || []).includes(id)));
  const artBase = k => (MON_ART[k] ? [].concat(MON_ART[k])[0] : 'model:' + k);
  const out = [];
  for (const id in DUNGEONS) {
    const D = DUNGEONS[id], R = D.region && REGIONS[D.region], G = R && R.spec.dungeons ? R.spec.dungeons[id] : null, A = typeof ABYSS !== 'undefined' ? ABYSS[id] : null;
    const bk = D.boss && D.boss.kind; if (!bk || !MON[bk]) continue;
    const b = bossScan(bk); b.lvl = D.boss.lvl;
    const lords = typeof ABYSS !== 'undefined' ? Object.values(ABYSS) : [];
    out.push({ id, name: D.name, region: D.region || null, regionName: R ? R.spec.name : null, lvl: D.lvl, rooms: D.rooms, layout: A ? 'abyss' : G ? G.layout || 'standard' : 'legacy-grid', theme: D.theme, hidden: !!D.hidden, abyss: !!(D.abyss || A),
      boss: b, elite: D.elite ? [{ kind: D.elite, name: MON[D.elite] ? MON[D.elite].name : D.elite, artBase: artBase(D.elite) }] : [], preBoss: G && G.preBoss ? G.preBoss.kind : null,
      bossAdds: D.bossAdds, bgm: D.bgm, bossBgm: D.bossBgm || 'boss', quests: [...new Set(qOf(id))],
      abyssLordOf: lords.filter(L => (L.lords || []).includes(bk)).map(L => L.id), sameBossAbyss: A ? null : lords.filter(L => DUNGEONS[L.id] && DUNGEONS[L.id].boss.kind === bk).map(L => L.id),
      abyssPool: A ? { lords: A.lords, lordMechs: ((A.lord || {}).mechs || []).map(m => m.use), cycle: ((A.lord || {}).cycle || []).map(c => c.mech.use) } : undefined });
  }
  return JSON.stringify({ dungeons: out, elites: [...new Set(Object.values(DUNGEONS).map(D => D.elite).filter(Boolean))].map(k => ({ kind: k, base: artBase(k), recolor: MON_ART[k] && [].concat(MON_ART[k])[1] ? 1 : 0, h: MON[k] ? Math.round(MON[k].h * (MON[k].scale || 1)) : 0 })) });
})()`;

// ---- 把 src/ 按 ORDER 拼起来（和 build.mjs 一样，美术只要文件名和 spr.json）----
function gameJs() {
  const SRC = path.join(ROOT, 'src'), ART = path.join(ROOT, 'art', 'final');
  const order = fs.readFileSync(path.join(SRC, 'ORDER'), 'utf8').split('\n').map(s => s.trim()).filter(s => s && !s.startsWith('#'));
  const src = {}, bundle = {}, sprs = {};
  const walk = rel => {
    for (const e of fs.readdirSync(path.join(ART, rel), { withFileTypes: true })) {
      const r = rel ? rel + '/' + e.name : e.name;
      if (e.isDirectory()) walk(r);
      else if (e.name.endsWith('.webp')) { const k = r.replace(/\.webp$/, ''); src[k] = 'assets/' + r; bundle[k] = 'core'; }
      else if (e.name === 'spr.json') sprs[rel.replace(/^spr\//, '')] = JSON.parse(fs.readFileSync(path.join(ART, r), 'utf8'));
    }
  };
  if (fs.existsSync(ART)) walk('');
  const art = `const ASSET_SRC = ${JSON.stringify(src)};\nconst ASSET_BUNDLE = ${JSON.stringify(bundle)};\nconst SPR_DATA = ${JSON.stringify(sprs)};\nconst BUILD_MODE = 'web';\nconst BUILD_ID = 'inventory';\n`;
  return '"use strict";\n' + order.map(f => fs.readFileSync(path.join(SRC, f), 'utf8') + (f === 'engine/core.js' ? '\n' + art : '')).join('\n');
}
function dummy() {
  const f = function () {};
  const p = new Proxy(f, { get(t, k) { if (k === Symbol.toPrimitive) return h => (h === 'number' ? 0 : ''); if (k === Symbol.iterator) return function* () {}; if (k === 'then') return undefined; if (k === 'length') return 0; return p; }, set: () => true, apply: () => p, construct: () => p, has: () => true });
  return p;
}
export function loadGame() {
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
  vm.runInContext(gameJs(), ctx, { filename: 'dawnbreak-src.js', timeout: 30000 });
  vm.runInContext(BOSS_SCAN_SRC, ctx, { timeout: 5000 });
  return ctx;
}

// ---- 查重 ----
const jac = (a, b) => { const A = new Set(a), B = new Set(b); let n = 0; for (const x of A) if (B.has(x)) n++; return n / (A.size + B.size - n || 1); };
export function dupChecks(dungeons, elites = []) {
  const normal = dungeons.filter(d => !d.abyss), errors = [], warns = [], dup = {};
  for (const d of normal) dup[d.id] = { sameMechSet: [], sameSkillSet: [], mostSimilar: [] };
  // 1. 机制组合完全相同
  const byMech = {};
  for (const d of normal) if (d.boss.mechSet.length) (byMech[d.boss.mechSet.join('+')] ??= []).push(d.id);
  const identicalMechSets = Object.fromEntries(Object.entries(byMech).filter(([, L]) => L.length > 1).sort((a, b) => b[1].length - a[1].length));
  for (const [k, L] of Object.entries(identicalMechSets)) { warns.push(`机制组合完全相同（${k}）：${L.join('、')}`); for (const id of L) dup[id].sameMechSet = L.filter(x => x !== id); }
  const bySkill = {};
  for (const d of normal) if (d.boss.skillUses.length) (bySkill[d.boss.skillUses.join('+')] ??= []).push(d.id);
  for (const L of Object.values(bySkill)) if (L.length > 1) for (const id of L) dup[id].sameSkillSet = L.filter(x => x !== id);
  // 2. 招式相似度（技能种类 + 机制 + 招牌 / 钩子记号的 Jaccard）
  const pairs = [];
  for (let i = 0; i < normal.length; i++) for (let j = i + 1; j < normal.length; j++) {
    const a = normal[i], b = normal[j], s = +jac(a.boss.tokens, b.boss.tokens).toFixed(2);
    if (s > 0) { dup[a.id].mostSimilar.push([b.id, s]); dup[b.id].mostSimilar.push([a.id, s]); }
    if (s >= 0.7) pairs.push([a.id, b.id, s]);
  }
  for (const id in dup) dup[id].mostSimilar = dup[id].mostSimilar.sort((x, y) => y[1] - x[1]).slice(0, 2);
  pairs.sort((x, y) => y[2] - x[2]);
  for (const [a, b, s] of pairs) warns.push(`招式相似度 ${s} ≥ 0.7：${a} ↔ ${b}`);
  // 3. 底图相同：没染色的第一个当原版，其余（染过色的、后来的）要写 variantOf；写了 variantOf 的体型要差 ≥ 15%
  const byArt = {};
  for (const d of normal) (byArt[d.boss.art.base] ??= []).push({ id: d.id, kind: d.boss.kind, tint: !!d.boss.art.recolor, h: d.boss.visualH, lvl: d.lvl[0], variantOf: d.boss.variantOf });
  for (const e of elites) if (byArt[e.base] && !byArt[e.base].some(x => x.kind === e.kind)) byArt[e.base].push({ id: '(精英)', kind: e.kind, tint: !!e.recolor, h: e.h, lvl: -1, elite: true });
  const sharedBossArt = {};
  for (const [base, L] of Object.entries(byArt)) {
    if (L.length < 2) continue;
    sharedBossArt[base] = L.map(x => (x.elite ? `${x.kind}(精英)` : x.id));
    const orig = [...L].sort((a, b) => a.tint - b.tint || a.lvl - b.lvl)[0];
    for (const x of L) if (x !== orig && !x.elite && !x.variantOf) warns.push(`底图 ${base} 和 ${orig.elite ? orig.kind + '（精英）' : orig.id} 共用，${x.id}（${x.kind}）没写 variantOf`);
  }
  for (const d of normal) {
    const v = d.boss.variantOf; if (!v) continue;
    const o = normal.find(x => x.boss.kind === v) || elites.find(e => e.kind === v);
    const h0 = o ? (o.boss ? o.boss.visualH : o.h) : 0;
    if (h0 && Math.abs(d.boss.visualH / h0 - 1) < 0.15) warns.push(`${d.id}（${d.boss.kind}）是 ${v} 的换色，体型只差 ${Math.round(Math.abs(d.boss.visualH / h0 - 1) * 100)}%（要 ≥ 15%）`);
  }
  // 4. 招牌少于 2 个
  for (const d of normal) if (d.boss.sig.length < 2) errors.push(`${d.id}（${d.boss.name}）招牌 ${d.boss.sig.length} 个 < 2${d.boss.sig.length ? '：' + d.boss.sig.map(s => s.name).join('、') : ''}`);
  return { errors, warns, dup, identicalMechSets, mostSimilarPairs: pairs, sharedBossArt };
}

export function buildInventory(old = {}) {
  const ctx = loadGame();
  const raw = JSON.parse(vm.runInContext(COLLECT_SRC, ctx, { timeout: 20000 }));
  const oldBy = Object.fromEntries((old.dungeons || []).map(d => [d.id, d]));
  const dungeons = raw.dungeons.map(d => {
    const o = oldBy[d.id] || {};
    const b = { ...d.boss };
    // 手写领主的招牌名是人工整理的，照旧保留
    if (o.boss && o.boss.signature && b.engine !== 'region-spec') b.signature = o.boss.signature;
    return { ...d, region: d.region || o.region || null, regionName: d.regionName || o.regionName || null, boss: b, ...(o.official ? { official: o.official } : {}), ...(o.target ? { target: o.target } : {}) };
  });
  const C = dupChecks(dungeons, raw.elites);
  for (const d of dungeons) {
    const same = dungeons.find(x => !x.abyss && x.boss.kind === d.boss.kind);
    const D = same && C.dup[same.id]; if (D) d.dup = D;
    const shared = C.sharedBossArt[d.boss.art.base]; d.boss.artSharedWith = shared ? shared.filter(x => x !== d.id && x !== (same && same.id)) : [];
  }
  const normal = dungeons.filter(d => !d.abyss), region = normal.filter(d => d.boss.engine === 'region-spec'), count = f => { const o = {}; for (const d of region) for (const k of f(d)) o[k] = (o[k] || 0) + 1; return Object.fromEntries(Object.entries(o).sort((a, b) => b[1] - a[1])); };
  const kinds = new Set(normal.map(d => d.boss.kind));
  const summary = {
    ...(old.summary || {}),
    dungeons: dungeons.length, normalDungeons: normal.length, abyssDungeons: dungeons.length - normal.length, bossKinds: kinds.size,
    legacyBosses: normal.filter(d => d.boss.engine !== 'region-spec').length, regionSpecBosses: region.length,
    distinctBossArtBases: new Set(normal.map(d => d.boss.art.base)).size, sharedBossArt: C.sharedBossArt,
    regionBossSkillUse: count(d => d.boss.skillUses), regionBossMechUse: count(d => d.boss.mechSet),
    identicalMechSets: C.identicalMechSets, mostSimilarPairs: C.mostSimilarPairs,
    bossBgm: `${region.filter(d => d.bossBgm === 'boss').length}/${region.length} 个区域地下城用同一首 boss`,
    sigCount: Object.fromEntries(normal.map(d => [d.id, d.boss.sig.length])),
  };
  return { inv: { generatedFrom: 'tools/boss_inventory.mjs（vm 里跑 src/）', generatedAt: new Date().toISOString(), regenerate: 'node tools/boss_inventory.mjs', summary, checks: { errors: C.errors, warns: C.warns }, primitives: old.primitives || [], blocks: old.blocks || [], dungeons }, checks: C };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2), has = f => args.includes(f);
  const file = path.join(ROOT, 'docs/boss_inventory.json');
  const old = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
  const t0 = Date.now(), { inv, checks } = buildInventory(old);
  if (!has('--no-write')) fs.writeFileSync(file, JSON.stringify(inv, null, 1) + '\n');
  const S = inv.summary, sig = Object.values(S.sigCount);
  console.log(`领主清单：${S.normalDungeons} 个普通地下城 + ${S.abyssDungeons} 个深渊，领主 ${S.bossKinds} 个（区域 spec ${S.regionSpecBosses}、手写 ${S.legacyBosses}），底图 ${S.distinctBossArtBases} 种；招牌 ≥2 的 ${sig.filter(n => n >= 2).length} 个、1 个的 ${sig.filter(n => n === 1).length} 个、0 个的 ${sig.filter(n => !n).length} 个（${Date.now() - t0}ms${has('--no-write') ? '' : '，已写 docs/boss_inventory.json'}）`);
  if (!has('--quiet')) {
    for (const w of checks.warns) console.log('⚠', w);
    for (const e of checks.errors) console.log('✗', e);
  }
  console.log(`查重：警告 ${checks.warns.length} 条（机制组合相同 ${Object.keys(checks.identicalMechSets).length} 组、相似度 ≥0.7 ${checks.mostSimilarPairs.length} 对、共用底图没写 variantOf ${checks.warns.filter(w => w.includes('variantOf')).length} 个），报错 ${checks.errors.length} 条（招牌 < 2）${has('--baseline') ? '（--baseline：只报告）' : ''}`);
  process.exit(checks.errors.length && !has('--baseline') ? 1 : 0);
}
