/* =====================================================================
   装备深化 · 规则：绑定 / 增幅（异次元属性·红字）/ 锻造 / 附魔（宝珠·卡片）/ 装备图鉴 / 装备评分
   设计、数值和官方依据见 docs/GEAR.md。窗口在 ui/items/{amplify,enchant,codex}.js，深渊派对在 content/abyss.js，特效在 game/gear_fx.js
   对外接口（其他组会用）：
     itemBind(it) / itemTradable(it) / itemBindText(it)            绑定与交易（拍卖行）
     canAmplify / ampConvert / tryAmplify / ampSetLevel             增幅（增幅券调用 ampSetLevel）
     canForge / tryForge                                            锻造
     canEnchant(orbKey, target) / enchantItem(target, orbInvItem)   附魔（宝珠物品：defineItem(key, { kind: 'mat', orb: { on: [slot | 分组], st } })）
     codexRecord(it, src) / codexStats() / epicCollectCount()       装备图鉴
     itemScore(it) / gearScore(equip)                               装备评分（排行榜）
   ===================================================================== */

/* ---------------- 绑定 ----------------
   ITEMS[key].bind 或实例 it.bind（覆盖）：'char' 角色绑定（不能进账号金库）/ 'account' 账号绑定 / 'equip' 封装（穿戴后变成账号绑定）/ 空 = 可交易
   缺省：史诗 = 封装；任务专属称号 = 角色绑定；时装 = 账号绑定 */
const BIND_NAME = { char: '角色绑定', account: '账号绑定', equip: '封装（穿戴后账号绑定）' };
function itemBind(it) {
  if (!it) return null;
  if (it.bind !== undefined) return it.bind || null;
  const D = ITEMS[it.key] || {};
  if (D.bind !== undefined) return D.bind || null;
  if (D.kind === 'equip') {
    if (D.rar === 5) return 'equip';
    if (D.slot === 'title' && D.noDrop) return 'char';
    if (isAvatar(D)) return 'account';
  }
  return null;
}
function itemTradable(it) {
  if (!it || it.kind === 'quest') return false;
  const D = ITEMS[it.key] || {};
  if (D.kind === 'quest' || D.noTrade || D.noSell) return false;
  const b = itemBind(it); return !b || b === 'equip';
}
const itemBindText = it => { const b = itemBind(it); return b ? BIND_NAME[b] : '可交易'; };
bus.on('equip', e => { const it = e && e.item; if (it && itemBind(it) === 'equip') it.bind = 'account'; });

/* ---------------- 增幅（官方 60 版第十章「异次元裂缝」：Lv55 以上装备带“异界气息”，用异界气息净化书净化后随机得到一种异次元属性（红字），
   之后用金币 + 矛盾的结晶体增幅；带红字的装备只能增幅、不能强化，原来的强化等级原样保留为增幅等级） ----------------
   字段：it.dim = 'str' | 'int' | 'vit' | 'spr'（红字种类）。带 dim 的装备，it.enh 就是增幅等级（显示成红色 +N）。
   增幅等级同时提供和同级强化一样的强化加成（enhStats），另加红字 ampStatVal。
   本作：Lv15 以上、稀有品级以上的装备带有异界气息。 */
const DIM_STATS = ['str', 'int', 'vit', 'spr'];
const DIM_NAME = { str: '异次元力量', int: '异次元智力', vit: '异次元体力', spr: '异次元精神' };
const AMP_MAX = 15;
// 到 +1 ~ +15 的成功率（下标 = 当前等级；官方公示：+1~+4 必定成功，+5 80%、+6 70%、+7 60%、+8 70%、+9 60%、+10 50%、+11 40%、+12 30%、+13 起 20%）
const AMP_RATE = [1, 1, 1, 1, 0.8, 0.7, 0.6, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.2, 0.2];
// 红字 = round((1 + 装备等级 × 0.09) × 品级系数 × AMP_MUL[等级])；官方：+6 和 +10 之后涨幅明显变大，红 10 → 红 11 约涨 70%
const AMP_MUL = [0, 0.3, 0.6, 0.9, 1.2, 1.5, 2.0, 2.4, 2.8, 3.2, 3.6, 6.1, 7.6, 9.2, 11, 13];
const AMP_RAR = [0.7, 0.8, 0.9, 1, 1.1, 1.25];
const canAmplify = it => !!it && it.kind === 'equip' && SLOTS.includes(it.slot) && it.slot !== 'title' && !isAvatar(it) && !(ITEMS[it.key] && ITEMS[it.key].noEnhance);
const hasOtherworld = it => canAmplify(it) && (it.lvl || 1) >= 15 && (it.rar || 0) >= 2;
const ampStatVal = (it, lv = it.enh || 0) => lv > 0 ? Math.round((1 + (it.lvl || 1) * 0.09) * AMP_RAR[it.rar || 0] * AMP_MUL[Math.min(AMP_MAX, lv)]) : 0;
// 职业的主属性（增幅券缺省按它赋予红字）
const mainStatOf = (cls = game.player && game.player.cls, job = game.job) => { const C = CLASSES[cls] || {}, J = job && C.jobs && C.jobs[job]; return ((J && J.dmgType) || C.dmgType || (cls === 'mage' ? 'mag' : 'phys')) === 'mag' ? 'int' : 'str'; };   // 转职的伤害类型优先（气功师 / 街霸 / 机械师是魔法职业 → 智力）
// 失败结果（官方经典规则）：冲 +5~+7 失败掉 1 级；冲 +8~+10 失败归零；冲 +11 起失败装备破碎（用增幅保护券：不碎、不归零，只掉 1 级）
function ampFailResult(it) {
  const e = it.enh || 0, to = e + 1;
  if (to <= 4) return { lvl: e };
  if (to <= 7) return { lvl: e - 1 };
  if (to <= 10) return { lvl: 0 };
  return { lvl: 0, broken: true };
}
const rarCostMul = it => [1, 1.15, 1.35, 1.6, 1.9, 2.4][it.rar || 0];
const ampConvertCost = it => ({ gold: Math.round((800 + it.lvl * 120) * rarCostMul(it)), purify: 1 });
function ampCost(it) {
  const e = it.enh || 0;
  return { gold: Math.round((it.lvl * 40 + 150) * Math.pow(1.36, e) * rarCostMul(it)), contra: Math.max(1, Math.ceil((e + 1) * (0.4 + it.lvl / 60))) };
}
const itemOwned = it => inv.items.includes(it) || SLOTS.some(s => inv.equip[s] === it);
// 净化异界气息：随机赋予一种红字；已有红字时换成另外三种之一（增幅等级不变）
function ampConvert(it, r01 = Math.random()) {
  if (!canAmplify(it)) return { err: '这件物品不能增幅' };
  if (!hasOtherworld(it)) return { err: '只有 Lv15 以上、稀有品级以上的装备带有异界气息' };
  if (!itemOwned(it)) return { err: '这件装备已经不在身上或背包里了' };
  const c = ampConvertCost(it);
  if (game.gold < c.gold) return { err: '金币不足' };
  if (inv.count('amp_purify') < c.purify) return { err: '需要异界气息净化书' };
  game.gold -= c.gold; inv.take('amp_purify', c.purify);
  const pool = DIM_STATS.filter(k => k !== it.dim), old = it.dim || null;
  it.dim = pool[Math.min(pool.length - 1, Math.floor(r01 * pool.length))];
  if (game.player) recalcStats(game.player);
  bus.emit('amplify', { item: it, convert: true, ok: true, lvl: it.enh || 0, from: it.enh || 0, old });
  save.write();
  return { ok: true, dim: it.dim, old, lvl: it.enh || 0 };
}
// opt：{ guard（用增幅保护券）, book（用黄金增幅书：成功率 +15%） }
function tryAmplify(it, opt = {}, r01 = Math.random()) {
  if (!canAmplify(it)) return { err: '这件物品不能增幅' };
  if (!it.dim) return { err: '需要先用异界气息净化书赋予异次元属性' };
  if (!itemOwned(it)) return { err: '这件装备已经不在身上或背包里了' };
  if ((it.enh || 0) >= AMP_MAX) return { err: '已经增幅到最高等级' };
  const c = ampCost(it);
  if (game.gold < c.gold) return { err: '金币不足' };
  if (inv.count('m_contra') < c.contra) return { err: '矛盾的结晶体不足' };
  const book = !!opt.book && inv.count('amp_book') > 0;
  game.gold -= c.gold; inv.take('m_contra', c.contra); if (book) inv.take('amp_book', 1);
  const from = it.enh || 0, rate = Math.min(1, AMP_RATE[from] + (book ? 0.15 : 0));
  let res;
  if (r01 < rate) { it.enh = from + 1; res = { ok: true, from, lvl: it.enh, book }; }
  else {
    const f = ampFailResult(it);
    if (f.lvl < from - 1 || f.broken) {
      if (opt.guard && inv.take('amp_guard', 1)) { it.enh = Math.max(0, from - 1); res = { ok: false, from, lvl: it.enh, guard: true }; }
      else if (f.broken) res = { ok: false, from, lvl: from, broken: true };
      else { it.enh = f.lvl; res = { ok: false, from, lvl: 0, reset: true }; }
    } else { it.enh = f.lvl; res = { ok: false, from, lvl: it.enh }; }
  }
  if (res.broken) {   // 装备破碎：从身上 / 背包里移除，返还一半矛盾的结晶体
    for (const s of SLOTS) if (inv.equip[s] === it) delete inv.equip[s];
    inv.remove(it); res.refund = Math.max(1, Math.round(c.contra * 0.5 + from)); giveItem(makeItem('m_contra', res.refund));
  }
  if (game.player) recalcStats(game.player);
  bus.emit('amplify', { item: it, ok: res.ok, lvl: res.lvl, from, broken: !!res.broken });
  if (res.ok && res.lvl >= 10) {
    bus.emit('announce', { kind: 'amplify', item: it, lvl: res.lvl });
    toastMsg(`【公告】勇士 ${save.data ? save.data.name : ''} 将 ${it.name} 增幅到了 +${res.lvl}！`, '#ff6a8a');
  }
  save.write();
  return res;
}
// 直接设增幅等级（商城组的增幅券用）：没有红字时按 stat（缺省职业主属性）赋予；强化过的装备要 convert: true 才转换
function ampSetLevel(it, n, { stat, convert } = {}) {
  if (!canAmplify(it) || n < 0 || n > AMP_MAX) return false;
  if (!it.dim) { if ((it.enh || 0) > 0 && !convert) return false; it.dim = DIM_STATS.includes(stat) ? stat : mainStatOf(); }
  if ((it.enh || 0) >= n) return false;
  const from = it.enh || 0; it.enh = n;
  if (game.player) recalcStats(game.player);
  bus.emit('amplify', { item: it, ok: true, lvl: n, from, ticket: true });
  if (n >= 10) bus.emit('announce', { kind: 'amplify', item: it, lvl: n });
  save.write();
  return true;
}

/* ---------------- 锻造（官方 2012 年：武器专用，锻造等级只提升独立攻击力；失败不降级，只消耗材料；锻到 +6 起全服公告） ----------------
   成功率按官方公示：+1 100%，+2/+3 50%，+4/+5 30%，+6/+7 15%，+8 7.5%。材料：强烈的气息 + 金币 + 无色小晶块
   本作只有枪炮师是独立攻击职业，为了让锻造对所有职业都有意义：锻造同时按一半比例提升物理 / 魔法攻击 */
const FORGE_MAX = 8;
const FORGE_RATE = [1, 0.5, 0.5, 0.3, 0.3, 0.15, 0.15, 0.075];
const FORGE_PCT = [0, 0.03, 0.06, 0.09, 0.12, 0.15, 0.19, 0.23, 0.28];
const canForge = it => !!it && it.kind === 'equip' && it.slot === 'weapon' && !(ITEMS[it.key] && ITEMS[it.key].noEnhance);
function forgeStats(it, lv = it.forge || 0) {
  const o = {}; if (!lv || it.slot !== 'weapon') return o;
  const P = FORGE_PCT[Math.min(FORGE_MAX, lv)], st = it.st || {};
  if (st.indep) o.indep = Math.round(st.indep * P);
  if (st.atk) o.atk = Math.round(st.atk * P * 0.5);
  if (st.matk) o.matk = Math.round(st.matk * P * 0.5);
  return o;
}
function forgeCost(it) {
  const e = it.forge || 0;
  return { gold: Math.round((it.lvl * 30 + 200) * Math.pow(1.25, e) * rarCostMul(it)), aura: 1 + Math.floor(e / 2), crystal: Math.round((it.lvl + 6) * 0.3) };
}
function tryForge(it, r01 = Math.random()) {
  if (!canForge(it)) return { err: '只有武器可以锻造' };
  if (!itemOwned(it)) return { err: '这件武器已经不在身上或背包里了' };
  if ((it.forge || 0) >= FORGE_MAX) return { err: '已经锻造到最高等级' };
  const c = forgeCost(it);
  if (game.gold < c.gold) return { err: '金币不足' };
  if (inv.count('m_aura') < c.aura) return { err: '强烈的气息不足' };
  if (inv.count('crystal') < c.crystal) return { err: '无色小晶块不足' };
  game.gold -= c.gold; inv.take('m_aura', c.aura); inv.take('crystal', c.crystal);
  const from = it.forge || 0; let res;
  if (r01 < FORGE_RATE[from]) { it.forge = from + 1; res = { ok: true, from, lvl: it.forge }; }
  else res = { ok: false, from, lvl: from };
  if (game.player) recalcStats(game.player);
  bus.emit('forge', { item: it, ok: res.ok, lvl: res.lvl, from });
  if (res.ok && res.lvl >= 6) { bus.emit('announce', { kind: 'forge', item: it, lvl: res.lvl }); toastMsg(`【公告】勇士 ${save.data ? save.data.name : ''} 将 ${it.name} 锻造到了 +${res.lvl}！`, '#ffb070'); }
  save.write();
  return res;
}

/* ---------------- 附魔（宝珠 / 怪物卡片） ----------------
   物品库：defineItem(key, { kind: 'mat', orb: { on: [slot 或分组...], st: {...} } })；分组：weapon armor acc special title avatar（所有 av_ 栏位，含宠物）
   实例：it.orb = { key, st }（st 是附魔时的快照；以物品库为准，物品库没有这个 key 时才用快照）
   每件装备 1 个槽；附新的会覆盖旧的（旧的消失，官方做法）；必定成功 */
const ORB_GROUPS = { weapon: ['weapon'], armor: ARMOR_SLOTS, acc: ACC_SLOTS, special: SPECIAL_SLOTS, title: ['title'] };
function orbSlotOk(on, slot) {
  for (const g of on || []) {
    if (g === slot) return true;
    if (g === 'avatar' && typeof slot === 'string' && slot.startsWith('av_')) return true;
    if (ORB_GROUPS[g] && ORB_GROUPS[g].includes(slot)) return true;
  }
  return false;
}
const orbDef = key => { const D = ITEMS[key]; return D && D.orb ? D.orb : null; };
function canEnchant(orbKey, target) { const O = orbDef(orbKey); return !!(O && target && target.kind === 'equip' && orbSlotOk(O.on, target.slot)); }
function orbStats(it) { if (!it || !it.orb) return {}; const O = orbDef(it.orb.key); return (O && O.st) || it.orb.st || {}; }
function orbName(it) { return it && it.orb ? ((ITEMS[it.orb.key] || {}).name || it.orb.name || '未知宝珠') : ''; }
function enchantItem(target, orbIt) {
  if (!orbIt || !orbDef(orbIt.key)) return { err: '这不是宝珠' };
  if (!canEnchant(orbIt.key, target)) return { err: '这颗宝珠不能附魔到这个部位' };
  if (!itemOwned(target) && !SLOTS.some(s => inv.equip[s] === target)) return { err: '这件装备已经不在身上或背包里了' };
  if (!inv.take(orbIt.key, 1)) return { err: '背包里没有这颗宝珠了' };
  const old = target.orb ? { ...target.orb } : null, O = orbDef(orbIt.key);
  target.orb = { key: orbIt.key, st: { ...O.st }, name: ITEMS[orbIt.key].name };
  if (game.player) recalcStats(game.player);
  bus.emit('enchant', { item: target, orb: orbIt.key, old: old && old.key });
  save.write();
  return { ok: true, old };
}

/* ---------------- 锻造 + 宝珠 的属性（equipTotals 与 tooltip 共用；强化 / 增幅在 items.js 的 enhStats） ---------------- */
function gearExtraStats(it) {
  const o = {}, add = S => { for (const k in S) if (typeof S[k] === 'number') o[k] = +((o[k] || 0) + S[k]).toFixed(4); };
  add(forgeStats(it)); add(orbStats(it));
  return o;
}

/* ---------------- 装备图鉴（参照官方收集箱：收集史诗 / 套装 / 传说，按收集数量解锁属性加成；显示获得记录） ----------------
   存档：save.data.codex = { key: { t 时间, lv 获得时等级, src 来源, n 获得次数 } }、save.data.codexLog = [{ key, t, src }]（最近 60 条） */
const CODEX_PAGES = [
  { id: 'weapon', name: '史诗武器', test: D => D.rar === 5 && D.slot === 'weapon' },
  { id: 'armor', name: '史诗防具', test: D => D.rar === 5 && ARMOR_SLOTS.includes(D.slot) && !D.set },
  { id: 'acc', name: '史诗首饰 · 特殊', test: D => D.rar === 5 && (ACC_SLOTS.includes(D.slot) || SPECIAL_SLOTS.includes(D.slot)) && !D.set },
  { id: 'epicset', name: '史诗套装', test: D => D.rar === 5 && !!D.set },
  { id: 'set', name: '神器 · 稀有套装', test: D => !!D.set && D.rar < 5 && !D.named && !isAvatar(D) },
  { id: 'legend', name: '传说 · 异界套装', test: D => D.rar === 4 && !!D.named },
  { id: 'named', name: '领主神器', test: D => D.rar === 3 && !!D.named },   // 装备 2.0：官方领主神器（粉色，只在对应领主身上掉）
];
let codexKeysCache = null;
function codexKeys(page) {
  if (!codexKeysCache) {
    codexKeysCache = {};
    for (const P of CODEX_PAGES) codexKeysCache[P.id] = Object.keys(ITEMS).filter(k => { const D = ITEMS[k]; return D.kind === 'equip' && !D.codexHide && P.test(D); })
      .sort((a, b) => ITEMS[a].lvl - ITEMS[b].lvl || SLOTS.indexOf(ITEMS[a].slot) - SLOTS.indexOf(ITEMS[b].slot));
  }
  return page ? codexKeysCache[page] || [] : Object.values(codexKeysCache).flat();
}
const codexWorthy = it => { const D = it && ITEMS[it.key]; return !!(D && D.kind === 'equip' && CODEX_PAGES.some(P => P.test(D)) && !D.codexHide); };
function codexData() {
  const d = save.data; if (!d) return null;
  if (!d.codex) {   // 第一次：把已经有的装备登记上（来源记为“旧存档”）
    d.codex = {}; d.codexLog = [];
    for (const it of [...(d.inv || []), ...Object.values(d.equip || {}), ...(d.storage || [])]) if (it && codexWorthy(it) && !d.codex[it.key]) d.codex[it.key] = { t: Date.now(), lv: d.lvl, src: '旧存档', n: 1 };
  }
  return d;
}
// 获得来源：地下城（深渊派对单独标出）/ 翻牌 / 商店 / 其他
let codexSrcNext = null;
function codexSrcNow() {
  if (codexSrcNext) return codexSrcNext;
  const dg = game.dungeon;
  if (game.scene === 'dungeon' && dg) return (dg.def.abyss ? '深渊派对 · ' : '') + dg.def.name + (dg.state === 'result' ? '（翻牌）' : '');
  if (typeof menus !== 'undefined' && menus.isOpen && menus.isOpen('shop')) return '商店购买';
  return '城镇';
}
function codexRecord(it, src) {
  if (!codexWorthy(it) || !codexData()) return false;
  const d = save.data, e = d.codex[it.key];
  if (e) { e.n = (e.n || 1) + 1; return false; }
  const rec = { t: Date.now(), lv: game.lvl, src: src || codexSrcNow(), n: 1 };
  d.codex[it.key] = rec;
  d.codexLog.unshift({ key: it.key, t: rec.t, src: rec.src }); if (d.codexLog.length > 60) d.codexLog.length = 60;
  codexBonusCache = null;
  toastMsg(`装备图鉴：登记了 ${it.name}`, RARITY[it.rar || 0].col, 'log');
  bus.emit('codex', { key: it.key, item: it });
  if (game.player) recalcStats(game.player);
  return true;
}
function codexStats() {
  const d = codexData(), C = (d && d.codex) || {}, cnt = page => codexKeys(page).filter(k => C[k]).length;
  const epic = ['weapon', 'armor', 'acc', 'epicset'].reduce((s, p) => s + cnt(p), 0), epicTotal = ['weapon', 'armor', 'acc', 'epicset'].reduce((s, p) => s + codexKeys(p).length, 0);
  let setDone = 0; const sets = new Set(codexKeys().map(k => ITEMS[k].set).filter(Boolean));
  for (const id of sets) if (SETS[id] && SETS[id].pieces.every(k => C[k])) setDone++;
  const abyssEpic = Object.keys(C).filter(k => ITEMS[k] && ITEMS[k].rar === 5 && /^深渊派对/.test(C[k].src || '')).length;
  return { epic, epicTotal, set: setDone, setTotal: sets.size, legend: cnt('legend'), legendTotal: codexKeys('legend').length, artifact: cnt('set'), artifactTotal: codexKeys('set').length, abyssEpic,
    named: cnt('named'), namedTotal: codexKeys('named').length };
}
const epicCollectCount = () => codexStats().epic;
// 收集加成（参照官方收集箱：登记越多加成越多；本作按“不同史诗数量 / 集齐的套装数 / 传说数量”分档）
const CODEX_BONUS = [
  { need: { epic: 1 }, st: { str: 3, int: 3, vit: 3, spr: 3 }, desc: '四维 +3' },
  { need: { epic: 3 }, st: { hp: 200, mp: 100 }, desc: 'HP +200，MP +100' },
  { need: { epic: 6 }, st: { str: 6, int: 6, vit: 6, spr: 6 }, desc: '四维 +6' },
  { need: { epic: 10 }, st: { elemAll: 6 }, desc: '所有属性强化 +6' },
  { need: { epic: 15 }, st: { atkPct: 0.01 }, desc: '攻击力 +1%' },
  { need: { epic: 22 }, st: { str: 8, int: 8, vit: 8, spr: 8 }, desc: '四维 +8' },
  { need: { epic: 30 }, st: { crit: 0.01, mcrit: 0.01 }, desc: '暴击率 +1%' },
  { need: { epic: 40 }, st: { dmgUp: 0.02 }, desc: '伤害增加 +2%' },
  { need: { epic: 55 }, st: { atkPct: 0.01, hpPct: 0.02 }, desc: '攻击力 +1%，HP +2%' },
  { need: { epic: 75 }, st: { dmgUp: 0.02, elemAll: 8 }, desc: '伤害增加 +2%，所有属性强化 +8' },
  { need: { epic: 100 }, st: { str: 10, int: 10, vit: 10, spr: 10 }, desc: '四维 +10' },   // 装备 2.0（史诗约 490 件）加的四档
  { need: { epic: 140 }, st: { atkPct: 0.01, hp: 400 }, desc: '攻击力 +1%，HP +400' },
  { need: { epic: 200 }, st: { dmgUp: 0.02 }, desc: '伤害增加 +2%' },
  { need: { epic: 280 }, st: { elemAll: 10, hpPct: 0.03 }, desc: '所有属性强化 +10，HP +3%' },
  { need: { set: 1 }, st: { hp: 150 }, desc: '集齐 1 套：HP +150' },
  { need: { set: 3 }, st: { str: 5, int: 5, vit: 5, spr: 5 }, desc: '集齐 3 套：四维 +5' },
  { need: { set: 6 }, st: { dmgReduce: 0.02 }, desc: '集齐 6 套：受到的伤害 -2%' },
  { need: { set: 10 }, st: { atkPct: 0.01 }, desc: '集齐 10 套：攻击力 +1%' },
  { need: { legend: 3 }, st: { mspd: 0.02 }, desc: '传说 3 件：移动速度 +2%' },
  { need: { legend: 8 }, st: { critDmg: 0.03 }, desc: '传说 8 件：暴击伤害 +3%' },
  { need: { named: 5 }, st: { hp: 300 }, desc: '领主神器 5 件：HP +300' },
  { need: { named: 15 }, st: { str: 6, int: 6, vit: 6, spr: 6 }, desc: '领主神器 15 件：四维 +6' },
  { need: { named: 30 }, st: { critDmg: 0.03 }, desc: '领主神器 30 件：暴击伤害 +3%' },
];
const codexBonusOn = (B, S) => Object.keys(B.need).every(k => (S[k] || 0) >= B.need[k]);
let codexBonusCache = null;
function codexBonusStats() {
  if (!save.data) return {};
  const sig = save.data.codex ? Object.keys(save.data.codex).length + '|' + save.cur : 'x';
  if (codexBonusCache && codexBonusCache.sig === sig) return codexBonusCache.st;
  const S = codexStats(), st = {};
  for (const B of CODEX_BONUS) if (codexBonusOn(B, S)) for (const k in B.st) st[k] = +((st[k] || 0) + B.st[k]).toFixed(4);
  codexBonusCache = { sig, st };
  return st;
}
bus.on('charLeave', () => { codexBonusCache = null; });

/* ---------------- 装备评分（排行榜 / 个人信息）：只看装备本身，和角色临时状态无关 ---------------- */
const SCORE_RAR = [1, 1.25, 1.6, 2.1, 2.7, 3.6];
const SCORE_SLOT = { weapon: 2.2, title: 0.7, support: 0.8, stone: 0.8 };
function itemScore(it) {
  if (!it || it.kind !== 'equip') return 0;
  const w = SCORE_SLOT[it.slot] ?? (isAvatar(it) ? 0.25 : 1);
  const base = ((it.lvl || 1) + 6) * 10 * SCORE_RAR[it.rar || 0] * w * gradeMul(it.grade);
  let s = base;
  if (it.enh) s += base * enhBonus(it.enh) * (it.slot === 'weapon' ? 0.9 : 0.45) + (it.dim ? ampStatVal(it) * 14 : 0);
  if (it.forge) s += base * FORGE_PCT[Math.min(FORGE_MAX, it.forge)] * 1.5;
  if (it.orb) { const R = (ITEMS[it.orb.key] || {}).rar || 2; s += 40 + R * 45; }
  return Math.round(s);
}
function gearScore(equip = inv.equip) {
  let s = 0; const sets = {};
  for (const slot of SLOTS) { const it = equip && equip[slot]; if (!it || it.slot !== slot) continue; s += itemScore(it); if (it.set) sets[it.set] = (sets[it.set] || 0) + 1; }
  for (const id in sets) { const S = SETS[id]; if (!S) continue; for (const n in S.bonus) if (sets[id] >= +n) s += 60 * +n * (S.epic ? 2 : 1); }
  return Math.round(s);
}

/* ---------------- 获取途径（tooltip 用）：物品库的 src 字段优先，否则按掉落表 / 深渊派对 / 商店反查 ---------------- */
const ORB_GROUP_NAME = { weapon: '武器', armor: '防具', acc: '首饰', special: '辅助装备 / 魔法石', title: '称号', avatar: '时装 / 宠物' };
const orbOnText = on => [...new Set((on || []).map(g => ORB_GROUP_NAME[g] || SLOT_NAME[g] || (g === 'av_pet' ? '宠物' : g)))].join('、');
let itemSrcIndex = null;
function itemSourceText(key) {
  const D = ITEMS[key]; if (!D) return '';
  if (D.src) return D.src;
  if (!itemSrcIndex) {
    itemSrcIndex = {};
    const add = (k, txt) => { const L = itemSrcIndex[k] = itemSrcIndex[k] || []; if (!L.includes(txt)) L.push(txt); };
    for (const id in DROP_TABLES) { const T = DROP_TABLES[id], dn = DUNGEONS[id] ? DUNGEONS[id].name : null; if (!dn) continue; for (const [k] of T.boss || []) add(k, dn); }
    if (typeof MON_DROPS !== 'undefined') for (const kind in MON_DROPS) for (const e of MON_DROPS[kind]) {   // 指定怪物的专属掉落：「地下城 · 怪物名」
      const mn = MON[kind] ? MON[kind].name : kind, dgs = (e.dg || []).map(id => DUNGEONS[id] && DUNGEONS[id].name).filter(Boolean);
      (itemSrcIndex['@' + e.key] = itemSrcIndex['@' + e.key] || []).push(dgs.length ? `${dgs.join('、')} · ${mn}` : mn);
    }
    if (typeof SHOPS !== 'undefined') for (const id in SHOPS) for (const T of SHOPS[id].tabs) if (Array.isArray(T.goods)) for (const k of T.goods) add(k, SHOPS[id].name);
  }
  const L = itemSrcIndex[key] || [], NM = itemSrcIndex['@' + key] || [];
  const nmTxt = NM.length ? NM.slice(0, 3).join('、') + (NM.length > 3 ? ' 等' : '') + '；' : '';
  if (D.kind === 'equip' && D.rar === 5) {
    const boss = (L.length ? L.slice(0, 3).join('、') + (L.length > 3 ? ' 等' : '') + '的领主；' : '') + nmTxt;
    if (D.abyss) return boss + '深渊派对' + (D.abyssFrom && D.abyssFrom !== '深渊派对' ? `（${D.abyssFrom}）` : '') + '；歌兰蒂斯处用宇宙灵魂兑换';   // 深渊专属也写上攻坚 / 指定领主的来源（官方：深渊 + 攻坚奖励）
    return boss + `Lv.${Math.max(1, D.lvl - 3)} 以上地下城随机掉落；深渊派对；宇宙灵魂兑换`;
  }
  if (D.kind === 'equip' && D.named && (NM.length || L.length)) return (nmTxt + (L.length ? L.slice(0, 3).join('、') + '的领主' : '')).replace(/；$/, '');   // 领主神器 / 名品
  if (D.kind === 'equip' && D.set && L.length) return L.slice(0, 3).join('、') + (L.length > 3 ? ' 等' : '') + '的领主';
  return L.length && D.kind !== 'equip' ? L.slice(0, 3).join('、') : '';
}
