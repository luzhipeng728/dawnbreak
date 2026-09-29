/* =====================================================================
   装备 2.0（满级 60）· 注册接口。蓝图和分工见 docs/GEAR_PLAN_60.md（§6 有完整用法）。
   ORDER：epics / epics2 / epics3 之后、B1~B3 的内容文件（epics60_*.js）之前；统一生效在 gear60_apply.js（所有区域 + abyss.js 之后）。
   立即生效：moveEpic / redefEpic / inheritEpic / inheritSet / moveSet / defineNamed / monDrop
   排队到 gear60_apply.js：gearDrop / dropRemove / abyssClaim / g60Later（掉落表、深渊归属要等所有区域都定义完）
   ===================================================================== */
const G60 = {
  orig: {},      // key → 第一次被改之前的定义快照（继承装备从这里复制）
  moved: {},     // key → { from, to }：等级被调高的物品（老存档迁移按这个补发继承装备）
  succ: {},      // 老 key → 继承装备 key
  pred: {},      // 继承装备 key → 老 key
  setSucc: {},   // 老套装 id → 继承套装 id
  queue: [],     // 排队的掉落 / 深渊操作（apply 之后调用就立即执行）
  applied: false,
  problems: [],  // 登记 / 生效时发现的问题（test/gear60.mjs 会检查为空）
};
const g60Problem = msg => { G60.problems.push(msg); console.warn('[gear60] ' + msg); };
// 定义快照：defineGear 存的原始定义（D._def），深拷贝一层 fx / st / proc，之后怎么改都不影响
function g60Orig(key) {
  if (G60.orig[key]) return G60.orig[key];
  const D = ITEMS[key]; if (!D) { g60Problem(`没有这个物品：${key}`); return null; }
  const d = D._def || D, o = { ...d };
  for (const k of ['fx', 'st']) if (d[k]) o[k] = { ...d[k] };
  if (d.proc) o.proc = Array.isArray(d.proc) ? d.proc.map(p => ({ ...p })) : { ...d.proc };
  for (const k of ['abyss', 'abyssFrom']) if (D[k] !== undefined && o[k] === undefined) o[k] = D[k];   // 区域 spec 的深渊史诗：abyss / abyssFrom 是后来标上的
  return (G60.orig[key] = o);
}
// 按新定义重新生成（基础属性按新等级重算；fx / proc / st 传了就整个替换，没传沿用原来的）
function redefEpic(key, patch = {}) {
  const D = ITEMS[key]; if (!D) { g60Problem(`redefEpic：没有这个物品 ${key}`); return null; }
  g60Orig(key);
  const { tier, ...p } = patch;
  const keep = {}; for (const k of ['abyss', 'abyssFrom', 'abyssRegion', 'tier']) if (D[k] !== undefined && !(k in p)) keep[k] = D[k];   // 后来标上的字段（patch 里写了的以 patch 为准）
  if (p.abyss === false) { p.abyss = undefined; p.abyssFrom = undefined; delete keep.abyssRegion; delete keep.abyssFrom; delete keep.abyss; }   // abyss: false = 不再是深渊专属
  const N = defineGear(key, { ...(D._def || {}), ...p });
  Object.assign(N, keep);
  if (tier) N.tier = tier;
  if (typeof codexKeysCache !== 'undefined') codexKeysCache = null;
  return N;
}
// 官方物品回到官方等级：moveEpic(key, { lvl, tier?: 1|2|3, name?, fx?, proc?, st?, desc?, slot?, abyss?: false, ... })
//   等级调高的会登记进 G60.moved（老存档迁移用）；Lv60 的 tier：1 = 官方 Lv60、2 = 官方 Lv65、3 = 官方 Lv70（深渊 / 攻坚顶级）
function moveEpic(key, o = {}) {
  const O = g60Orig(key); if (!O) return null;
  const N = redefEpic(key, o);
  if (N && N.lvl > (O.lvl || 1)) G60.moved[key] = { from: O.lvl || 1, to: N.lvl };
  else if (N) delete G60.moved[key];
  return N;
}
// 继承装备：inheritEpic(老 key, 新 key, { name, desc, icon?, ...想改的字段 })
//   复制老物品（被搬走之前的）定义：部位 / 类型 / 等级 / fx / proc / 深渊归属 / 随机基础属性（同一个种子）完全一样，只换名字和外观。
//   掉落表里的老 key 会在 apply 时自动换成它（低等级地下城），老存档里的老物品按它补发（强化等转移过来）。
//   套装部件请用 inheritSet（不然继承装备会和老物品算同一套）。
function inheritEpic(oldKey, newKey, o = {}) {
  const O = g60Orig(oldKey); if (!O) return null;
  if (ITEMS[newKey]) g60Problem(`inheritEpic：${newKey} 已经存在`);
  if (O.set && !o.set) g60Problem(`inheritEpic：${oldKey} 是套装部件，请用 inheritSet`);
  const def = { ...O, icon: 'item_' + newKey, seed: O.seed || oldKey, ...o };
  for (const k of ['fx', 'st']) if (def[k] === O[k] && O[k]) def[k] = { ...O[k] };
  const D = defineGear(newKey, def);
  if (O.abyss !== undefined && o.abyss === undefined) { D.abyss = O.abyss; if (O.abyssFrom) D.abyssFrom = O.abyssFrom; }
  if (ITEMS[oldKey] && ITEMS[oldKey].abyssRegion && !D.abyssRegion && D.abyss) D.abyssRegion = ITEMS[oldKey].abyssRegion;
  G60.succ[oldKey] = newKey; G60.pred[newKey] = oldKey;
  if (typeof codexKeysCache !== 'undefined') codexKeysCache = null;
  return D;
}
// 继承套装：inheritSet(老套装 id, 新套装 id, { name, pieces: { <部位>: { key?, name } | '名字' }, desc?, bonus? })
//   件数效果（bonus）默认原样复制；每个部件按 inheritEpic 继承（新 key 默认 `${新套装 id}_${部位}`）
function inheritSet(oldId, newId, o = {}) {
  const S = SETS[oldId]; if (!S) { g60Problem(`inheritSet：没有这个套装 ${oldId}`); return null; }
  if (SETS[newId]) g60Problem(`inheritSet：套装 ${newId} 已经存在`);
  const { pieces: P = {}, ...rest } = o;
  const N = defineSet(newId, { ...S, id: newId, pieces: [], bonus: JSON.parse(JSON.stringify(S.bonus)), ...rest });
  for (const k of S.pieces.slice()) {
    const slot = ITEMS[k].slot, p = typeof P[slot] === 'string' ? { name: P[slot] } : P[slot] || {};
    const nk = p.key || `${newId}_${slot}`, { key: _k, ...pp } = p;
    if (!p.name) g60Problem(`inheritSet：${newId} 的 ${slot} 没有写名字`);
    inheritEpic(k, nk, { ...pp, set: newId, ...(o.desc && !pp.desc ? { desc: o.desc } : {}) });
    N.pieces.push(nk);
  }
  G60.setSucc[oldId] = newId;
  return N;
}
// 整套搬家：moveSet(套装 id, { lvl, tier?, name?, bonus?, pieces: { <部位>: { name?, fx?, ... } } , ...所有部件共用的字段 })
function moveSet(id, o = {}) {
  const S = SETS[id]; if (!S) { g60Problem(`moveSet：没有这个套装 ${id}`); return null; }
  const { name, bonus, pieces: P = {}, ...common } = o;
  if (name) S.name = name;
  if (bonus) S.bonus = bonus;
  for (const k of S.pieces) moveEpic(k, { ...common, ...(P[ITEMS[k].slot] || {}) });
  return S;
}
// 领主神器（粉色）：defineNamed(key, { slot, wtype? / atype?, lvl, name, fx?, proc?, desc })——只在 monDrop 登记的怪身上掉（不进随机池），图鉴「领主神器」页
function defineNamed(key, def) {
  if (ITEMS[key]) g60Problem(`defineNamed：${key} 已经存在`);
  return defineGear(key, { rar: 3, named: true, noDrop: true, icon: 'item_' + key, fx: {}, ...def });
}
// 指定怪物的专属掉落：monDrop(怪物 kind, [[key, 几率, 数量?]...], { dungeons?: [地下城 id...] })——精英、深渊领主、房间脚本刷出来的怪都算
function monDrop(kind, list, o = {}) {
  const L = MON_DROPS[kind] = MON_DROPS[kind] || [];
  for (const [key, p, n] of list) L.push({ key, p, n: n || 1, dg: o.dungeons || null });
  if (typeof itemSrcIndex !== 'undefined') itemSrcIndex = null;
}
// ---- 排队的操作（gear60_apply.js 统一执行）----
const g60Dirty = () => { if (typeof itemSrcIndex !== 'undefined') itemSrcIndex = null; if (typeof codexKeysCache !== 'undefined') codexKeysCache = null; };   // 获取途径 / 图鉴的缓存
function g60Queue(fn) { if (G60.applied) { fn(); g60Dirty(); } else G60.queue.push(fn); }
// 领主掉落表追加：gearDrop(地下城 id, [[key, 几率, 数量?]...])
const gearDrop = (dg, list) => g60Queue(() => g60AddBoss(dg, list));
// 从领主掉落表去掉：dropRemove(地下城 id | '*', key)
const dropRemove = (dg, key) => g60Queue(() => { for (const id of dg === '*' ? Object.keys(DROP_TABLES) : [dg]) { const T = DROP_TABLES[id]; if (T) T.boss = T.boss.filter(e => e[0] !== key); } });
// 深渊归属：abyssClaim(区域 id, [物品 key 或套装 id...])——标成深渊专属，掉史诗时一半从这里出、保底必出（区域 id：darkelf / snow / gent / train / timegate / siroco，老区域 grand_flores / sky_castle / behemoth）
const abyssClaim = (rid, keys) => g60Queue(() => g60Claim(rid, keys));
// 等所有区域定义完再做的事（例如改区域 spec 里定义的物品）
const g60Later = fn => g60Queue(fn);

// 掉落表里被搬走的老 key：低等级地下城（≤ 原等级 + 6）换成继承装备（几率不变），新等级附近的（≥ 新等级 − 6）保留，其余去掉。gear60_apply.js 调一次（重复调用没有副作用）
function g60SwapDrops() {
  for (const id in DROP_TABLES) {
    const T = DROP_TABLES[id], G = DUNGEONS[id]; if (!T.boss || !G) continue;
    const out = [];
    for (const e of T.boss) {
      const M = G60.moved[e[0]], S = G60.succ[e[0]];
      if (!M) { out.push(e); continue; }
      if (G.lvl[1] <= M.from + 6) { if (S && !T.boss.some(x => x[0] === S) && !out.some(x => x[0] === S)) out.push([S, ...e.slice(1)]); }
      else if (G.lvl[0] >= M.to - 6) out.push(e);
    }
    T.boss = out;
  }
  if (typeof itemSrcIndex !== 'undefined') itemSrcIndex = null;
}
function g60AddBoss(dg, list) {
  if (!DUNGEONS[dg]) { g60Problem(`gearDrop：没有这个地下城 ${dg}`); return; }
  const T = DROP_TABLES[dg] || autoDropTable(DUNGEONS[dg]);
  for (const e of list) { if (!ITEMS[e[0]]) g60Problem(`gearDrop：没有这个物品 ${e[0]}`); T.boss = T.boss.filter(x => x[0] !== e[0]); T.boss.push(e.slice()); }
}
function g60Claim(rid, keys) {
  const As = Object.values(ABYSS).filter(A => A.region === rid);
  if (!As.length) { g60Problem(`abyssClaim：区域 ${rid} 没有深渊`); return; }
  const label = As.map(A => A.name).join('、');
  for (const k of keys.flatMap(k => SETS[k] ? SETS[k].pieces : [k])) {
    if (!ITEMS[k]) { g60Problem(`abyssClaim：没有这个物品 ${k}`); continue; }
    Object.assign(ITEMS[k], { abyss: true, abyssFrom: label, abyssRegion: rid });
  }
}

/* ---- 老存档迁移（save.migrate 每次读档都调用；按 d.g60m 记下处理过的搬家，不会重复补发）----
   角色等级 < 搬家后的等级：每件老物品补发一件继承装备，强化 / 增幅（红字）/ 锻造 / 附魔 / 绑定从老物品转移过去（老物品回到 +0）；
   装备着的：继承装备穿在同一格，老物品放进背包（不受格子上限，不会丢）。角色等级够用的不动（老物品直接变强）。
   账号金库按账号里最高的角色等级算。服务端的拍卖 / 邮件里的物品不补发（领取时按新等级）。 */
function g60Transfer(from, to) {
  to.enh = from.enh || 0;
  for (const k of ['dim', 'forge', 'orb', 'bind']) if (from[k] !== undefined) to[k] = from[k];
  from.enh = 0; delete from.dim; delete from.forge; delete from.orb;
}
function g60Compensate(lists, equip, lvl, done, onGive) {
  const todo = new Set(Object.keys(G60.moved).filter(k => !done[k])); if (!todo.size) return 0;
  let n = 0;
  const need = it => it && typeof it === 'object' && it.kind === 'equip' && todo.has(it.key) && ITEMS[it.key] && lvl < ITEMS[it.key].lvl;
  const give = it => { const S = G60.succ[it.key]; const x = S && ITEMS[S] ? makeItem(S) : null; if (x) { g60Transfer(it, x); n++; onGive(it, x); } return x; };
  for (const L of lists) if (Array.isArray(L)) for (let i = 0, n0 = L.length; i < n0; i++) if (need(L[i])) { const x = give(L[i]); if (x) L.push(x); }   // 先处理背包 / 仓库（装备栏卸下来的老物品不会再算一次）
  if (equip) for (const s of Object.keys(equip)) { const it = equip[s]; if (!need(it)) continue; const x = give(it); lists[0].push(it); if (x) equip[s] = x; else delete equip[s]; }
  for (const k of todo) done[k] = 1;
  return n;
}
function g60MigrateChar(d) {
  if (!Object.keys(G60.moved).length) return;
  d.inv = Array.isArray(d.inv) ? d.inv : []; d.equip = d.equip && typeof d.equip === 'object' ? d.equip : {};
  const done = d.g60m = d.g60m && typeof d.g60m === 'object' ? d.g60m : {}, lvl = d.lvl || 1, notes = [];
  g60Compensate([d.inv, d.storage], d.equip, lvl, done, (old, x) => {
    const D = ITEMS[old.key];
    notes.push(`${D.name} → Lv.${D.lvl}，补发「${x.name}」${x.enh ? `（+${x.enh} 已转移）` : ''}`);
    if (d.codex && !d.codex[x.key]) { const t = Date.now(); d.codex[x.key] = { t, lv: lvl, src: '版本更新补发', n: 1 }; if (Array.isArray(d.codexLog)) d.codexLog.unshift({ key: x.key, t, src: '版本更新补发' }); }
  });
  if (notes.length) d.g60note = [...(Array.isArray(d.g60note) ? d.g60note : []), ...notes];
}
function g60MigrateBank(b) {
  if (!Object.keys(G60.moved).length || !save.chars.length) return 0;   // 还没读出角色（按账号最高等级判断）就先不处理
  const lvl = Math.max(1, ...save.chars.map(c => (c && c.lvl) || 1));
  b.g60m = b.g60m && typeof b.g60m === 'object' ? b.g60m : {};
  return g60Compensate([b.items], null, lvl, b.g60m, () => {});
}
