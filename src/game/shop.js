/* =====================================================================
   商城核心（商城组）：点券与兑换货币、购买 / 限购 / 购买记录、限时特惠、多买多送、不放回抽奖、兑换商店、
   点券产出（升级 / 首通 / 评价 / 每日任务 / 成就 / 金币兑换）、自选属性、券的使用
   数据：save.data.cera（点券）+ save.data.shop（其余，懒初始化，随云存档同步）
   随机数：cashRng()（测试可以用 cashSeed(种子) 固定）
   对外：addCera(n, 来源) / spendCera(n, 原因) / cashBal(cur) / cashBuy(pid, n, opt) / giveItem(makeItem('cera', n))
   ===================================================================== */
let cashRng = Math.random;
function cashSeed(seed) { cashRng = seed == null ? Math.random : mulberry(seed); }
const cashPick = arr => arr[Math.floor(cashRng() * arr.length)];
const cashInt = (a, b) => a + Math.floor(cashRng() * (b - a + 1));
// 周编号（和每天 06:00 重置同一口径；周一 06:00 换周）
const cashDayNo = () => Math.floor((Date.now() - 6 * 3600 * 1000 - new Date().getTimezoneOffset() * 60000) / 86400000);
const cashWeekKey = () => 'w' + Math.floor((cashDayNo() + 3) / 7);
function cashData() {
  const d = save.data; if (!d) return null;
  d.cera ??= 0;
  const S = d.shop ??= {};
  S.shard ??= 0; S.gcoin ??= 0; S.log ??= []; S.buys ??= []; S.lim ??= {}; S.pity ??= {}; S.stat ??= {}; S.ach ??= {}; S.first ??= {};
  S.multi ??= 0; S.multiGot ??= {}; S.lotto ??= { got: [], resets: 0, done: 0 }; S.today ??= {}; S.opened ??= 0;
  if (S.today.day !== dayKey()) S.today = { day: dayKey(), rank: 0, exch: 0, daily: 0 };
  return S;
}
/* ---- 货币 ---- */
const CUR_NAME = { cera: '点券', shard: '魔盒碎片', gcoin: '礼包币' };
function cashBal(cur = 'cera') { const S = cashData(); if (!S) return 0; return cur === 'cera' ? save.data.cera : S[cur] || 0; }
function cashAdd(cur, n, why) {
  const S = cashData(); if (!S || !n) return false;
  n = Math.round(n);
  if (cur === 'cera') {
    save.data.cera = Math.max(0, save.data.cera + n);
    S.log.unshift({ t: Date.now(), n, why: why || '' }); if (S.log.length > 50) S.log.length = 50;
    if (n > 0) bus.emit('ceraGain', { n, why });
  } else S[cur] = Math.max(0, (S[cur] || 0) + n);
  return true;
}
const addCera = (n, why) => cashAdd('cera', Math.abs(n), why);
function spendCera(n, why) { if (cashBal('cera') < n) return false; cashAdd('cera', -n, why); return true; }
// 计数型物品：进背包时直接加余额（和复活币一样）
{ const add0 = inv.add; inv.add = function (it, list, cap) { if (it && CASH_CUR[it.key] && (list === undefined || list === this.items) && save.data) { cashAdd(CASH_CUR[it.key], it.n || 1, '获得'); return true; } return add0.call(this, it, list, cap); }; }
// 点券获得提示（合并同一帧里的多次）
let ceraToastN = 0, ceraToastWhy = '';
bus.on('ceraGain', e => { if (!ceraToastN) setTimeout(() => { if (ceraToastN) toastMsg(`点券 +${fmtNum(ceraToastN)}${ceraToastWhy ? `（${ceraToastWhy}）` : ''}`, '#ff9ae8'); ceraToastN = 0; }, 30); ceraToastN += e.n; ceraToastWhy = ceraToastN === e.n ? e.why : ''; });

/* ---- 奖励：统一生成物品（礼包 / 奖池 / 兑换 / 抽奖） ---- */
function cashRewardItems(r, lv = game.lvl) {
  const n = Array.isArray(r.n) ? cashInt(r.n[0], r.n[1]) : r.n || 1;
  if (r.set) return AV_PIECE_SLOTS.map(s => makeItem(avKey(r.set, s)));
  if (r.gold) { const g = cashInt(r.gold[0], r.gold[1]) * Math.max(1, lv) * (r.mul || 1); return [{ key: '_gold', kind: 'gold', name: `${fmtNum(g)} 金币`, gold: g, rar: r.mul >= 20 ? 4 : r.mul >= 5 ? 3 : 1, n: 1 }]; }
  if (r.cera) return [makeItem('cera', cashInt(r.cera[0], r.cera[1]))];
  if (r.epic) { const E = typeof rollEpic === 'function' ? rollEpic(lv) : null; const it = E && makeItem(E.key); return it ? [it] : cashRewardItems({ equip: true, rar: 4 }, lv); }
  if (r.equip) { const it = rollEquip({ lvl: lv, rar: r.rar }); return it ? [it] : [makeItem('crystal', 20 + lv)]; }
  if (!ITEMS[r.key]) return [];
  const D = ITEMS[r.key];
  if (D.kind === 'equip') return Array.from({ length: n }, () => makeItem(r.key));
  return [makeItem(r.key, n)];
}
const cashRewardOk = r => !r.key || !!ITEMS[r.key];
function cashRewardName(r) {
  if (r.set) return `${CASH_SETS[r.set].name} 8 件`;
  if (r.gold) return `金币（等级 × ${r.gold[0]}~${r.gold[1]}${r.mul ? ` ×${r.mul}` : ''}）`;
  if (r.epic) return '史诗装备（本级随机）';
  if (r.equip) return `${RARITY[r.rar].name}装备（本级随机）`;
  if (r.cera) return `点券 ${r.cera[0]}~${r.cera[1]}`;
  const D = ITEMS[r.key]; if (!D) return r.key;
  return D.name + (Array.isArray(r.n) ? ` ×${r.n[0]}~${r.n[1]}` : r.n > 1 ? ` ×${r.n}` : '');
}
const cashRewardRar = r => r.set ? CASH_SETS[r.set].tier === 'rare' ? 2 : 1 : r.epic ? 5 : r.equip ? r.rar : r.gold ? (r.mul >= 20 ? 4 : r.mul >= 5 ? 3 : 1) : r.cera ? 3 : ((ITEMS[r.key] || {}).rar || 0);
// 放进背包需要的新格子（按页签；能叠加的已有物品不占新格子）
function cashSlotsNeed(items) {
  const need = {}, seen = new Set();
  for (const it of items) {
    if (!it || it.kind === 'gold' || CASH_CUR[it.key] || it.key === 'coin') continue;
    const t = TAB_OF(it);
    if (it.kind === 'equip') need[t] = (need[t] || 0) + 1;
    else if (!inv.count(it.key) && !seen.has(it.key)) { seen.add(it.key); need[t] = (need[t] || 0) + 1; }
  }
  return need;
}
function cashRoomFor(items) {
  inv.ensure();
  const need = cashSlotsNeed(items), TN = Object.fromEntries(INV_TABS);
  for (const t in need) if (inv.free(t) < need[t]) return `背包的“${TN[t] || t}”栏空间不足（还需要 ${need[t] - inv.free(t)} 格）`;
  return null;
}
function cashGive(items) {
  for (const it of items) {
    if (!it) continue;
    if (it.kind === 'gold') { game.gold += it.gold; bus.emit('gold', { n: it.gold }); continue; }
    if (!inv.add(it)) giveItem(it);
    if (it.rar >= 5 && it.kind === 'equip') cashStat('epic', 1, true);
  }
}

/* ---- 限购 ---- */
const cashLimKey = per => per === 'day' ? dayKey() : per === 'week' ? cashWeekKey() : 'life';
function cashLimitLeft(id, limit) {
  if (!limit) return Infinity;
  const S = cashData(), L = S.lim[id], k = cashLimKey(limit.per);
  return limit.n - (L && L.k === k ? L.n : 0);
}
function cashLimitUse(id, limit, n) { if (!limit) return; const S = cashData(), k = cashLimKey(limit.per), L = S.lim[id]; S.lim[id] = { k, n: (L && L.k === k ? L.n : 0) + n }; }
const LIMIT_TXT = { day: '每天', week: '每周', life: '每角色' };

/* ---- 限时特惠：日期种子决定（所有玩家一样） ---- */
function cashDeals() {
  const R = mulberry(cashDayNo() * 7919 + 17), pool = CASH_DEALS_DAY.filter(d => ITEMS[d.key]).slice(), out = [];
  for (let i = 0; i < 3 && pool.length; i++) out.push(pool.splice(Math.floor(R() * pool.length), 1)[0]);
  const wk = +cashWeekKey().slice(1), W = CASH_DEALS_WEEK.filter(d => ITEMS[d.key]);
  const week = W.length ? W[wk % W.length] : null;
  const toG = (d, per) => ({ pid: `deal:${per}:${d.key}:${d.n}`, key: d.key, n: d.n, price: Math.round(d.base * d.off / 10) * 10, base: d.base, off: d.off, cur: 'cera', tab: 'rec', tag: `${Math.round(d.off * 10)} 折`, limit: { per, n: d.limit }, deal: per });
  return { day: out.map(d => toG(d, 'day')), week: week ? toG(week, 'week') : null };
}
const cashLtdPack = () => CASH_LTD[+cashWeekKey().slice(1) % CASH_LTD.length];
// 商品：目录 + 特惠（pid 以 deal: 开头的由 cashDeals 生成）
function cashGoods(pid) {
  if (!pid) return null;
  if (CASH_GOODS[pid]) return CASH_GOODS[pid];
  if (pid.startsWith('deal:')) { const D = cashDeals(); return [...D.day, D.week].find(g => g && g.pid === pid) || null; }
  return null;
}
// 商品现在能不能买（返回原因文字；null = 可以）
function cashGoodsBlock(G) {
  if (!G || !ITEMS[G.key]) return '商品不存在';
  if (G.ltd && cashLtdPack() !== G.pid) return '本周不出售';
  if (G.lvl && game.lvl < G.lvl) return `达到 Lv.${G.lvl} 后可以领取`;
  if (cashLimitLeft(G.pid, G.limit) <= 0) return G.limit.per === 'life' ? '已经领取过了' : `${LIMIT_TXT[G.limit.per]}限购已满`;
  return null;
}
/* ---- 购买：opt = { opts: { [物品 key]: 属性 } }（时装自选属性） ---- */
function cashBuy(pid, n = 1, opt = {}) {
  const S = cashData(), G = cashGoods(pid);
  const block = cashGoodsBlock(G); if (block) return { err: block };
  n = Math.max(1, n | 0);
  if (G.limit) n = Math.min(n, cashLimitLeft(pid, G.limit));
  const cost = G.price * n;
  if (cashBal(G.cur) < cost) return { err: `${CUR_NAME[G.cur]}不足（需要 ${fmtNum(cost)}）` };
  let items = [];
  for (let i = 0; i < n; i++) items.push(...(G.whole ? AV_PIECE_SLOTS.map(s => makeItem(avKey(G.whole, s))) : cashRewardItems({ key: G.key, n: G.n })));
  items = items.filter(Boolean);
  for (const it of items) if (it.kind === 'equip' && opt.opts && opt.opts[it.key]) { it.opt = opt.opts[it.key]; it.optLock = true; normalizeItem(it); }
  const room = cashRoomFor(items); if (room) return { err: room };
  cashAdd(G.cur, -cost, `购买 ${cashGoodsName(G)}${n > 1 ? ' ×' + n : ''}`);
  cashLimitUse(pid, G.limit, n);
  cashGive(items);
  S.buys.unshift({ t: Date.now(), pid, name: cashGoodsName(G), n, cost, cur: G.cur }); if (S.buys.length > 100) S.buys.length = 100;
  const got = [...items];
  if (G.fest) { S.multi += n; got.push(...cashMultiCheck()); }
  bus.emit('cashBuy', { pid, n, cost, cur: G.cur });
  sfx.coin(); save.write();
  return { ok: true, items: got, cost, n };
}
const cashGoodsName = G => G.name || (ITEMS[G.key] ? ITEMS[G.key].name : G.key) + (G.n > 1 ? ` ×${G.n}` : '');
// 多买多送：到达档位自动发放（返回发放的物品，界面弹出提示）
function cashMultiCheck() {
  const S = cashData(), got = [];
  for (const T of CASH_MULTI) {
    if (S.multi < T.n || S.multiGot[T.n]) continue;
    const items = T.reward.filter(cashRewardOk).flatMap(r => cashRewardItems(r));
    S.multiGot[T.n] = Date.now(); cashGive(items); got.push(...items);
    toastMsg(`多买多送：累计 ${T.n} 套，获得 ${T.name}！`, '#ffd23a');
    bus.emit('announce', { kind: 'multi', name: T.name, item: items[0] });
  }
  return got;
}

/* ---- 礼包：右键打开 ---- */
function cashOpenPack(it) {
  const P = CASH_PACKS[it.key]; if (!P) return { err: '礼包内容不存在' };
  const items = P.filter(cashRewardOk).flatMap(r => cashRewardItems(r)).filter(Boolean);
  const room = cashRoomFor(items); if (room) return { err: room };
  if (!inv.take(it.key, 1)) return { err: '没有这个礼包了' };
  cashGive(items); save.write();
  return { ok: true, items };
}

/* ---- 兑换商店 ---- */
function cashExchange(shop, i, n = 1) {
  const E = CASH_EXCH[shop], G = E && E.goods[i]; if (!G || !ITEMS[G.key]) return { err: '商品不存在' };
  const id = `x:${shop}:${G.key}:${G.n}`;
  n = Math.max(1, Math.min(n | 0, cashLimitLeft(id, G.limit)));
  if (cashLimitLeft(id, G.limit) <= 0) return { err: `${LIMIT_TXT[G.limit.per]}限兑已满` };
  if (cashBal(shop) < G.cost * n) return { err: `${E.name}不足` };
  const items = []; for (let k = 0; k < n; k++) items.push(...cashRewardItems(G));
  const room = cashRoomFor(items); if (room) return { err: room };
  cashAdd(shop, -G.cost * n); cashLimitUse(id, G.limit, n); cashGive(items);
  const S = cashData(); S.buys.unshift({ t: Date.now(), pid: id, name: `${ITEMS[G.key].name}${G.n > 1 ? ' ×' + G.n : ''}（兑换）`, n, cost: G.cost * n, cur: shop }); if (S.buys.length > 100) S.buys.length = 100;
  sfx.coin(); save.write();
  return { ok: true, items };
}

/* ---- 破晓启示：不放回抽奖 ---- */
function cashLottoState() { const S = cashData(), L = S.lotto; return { got: L.got, left: CASH_LOTTO.length - L.got.length, resets: L.resets, done: L.done, tickets: inv.count('tk_lotto') }; }
function cashLottoDraw() {
  const S = cashData(), L = S.lotto;
  const left = CASH_LOTTO.map((_, i) => i).filter(i => !L.got.includes(i));
  if (!left.length) return { err: '奖池已经抽空，请领取完成奖励后重置' };
  if (!inv.count('tk_lotto')) return { err: '没有破晓启示抽奖券' };
  const i = cashPick(left), R = CASH_LOTTO[i];
  const items = cashRewardOk(R) ? cashRewardItems(R) : [makeItem('coin_gift', 5)];
  const room = cashRoomFor(items); if (room) return { err: room };
  inv.take('tk_lotto', 1); L.got.push(i); cashGive(items);
  if (R.star) bus.emit('announce', { kind: 'box', box: '破晓启示', item: items[0] });
  save.write();
  return { ok: true, i, items, empty: L.got.length >= CASH_LOTTO.length };
}
function cashLottoClaim() {
  const S = cashData(), L = S.lotto;
  if (L.got.length < CASH_LOTTO.length) return { err: '还没有抽空奖池' };
  if (L.done > L.resets) return { err: '完成奖励已经领过了' };
  const items = CASH_LOTTO_DONE.filter(cashRewardOk).flatMap(r => cashRewardItems(r));
  const room = cashRoomFor(items); if (room) return { err: room };
  L.done = L.resets + 1; cashGive(items); save.write();
  return { ok: true, items };
}
function cashLottoReset() {
  const L = cashData().lotto;
  if (L.got.length < CASH_LOTTO.length) return { err: '奖池还没有抽空' };
  if (L.done <= L.resets) return { err: '请先领取完成奖励' };
  if (L.resets >= CASH_LOTTO_RESETS) return { err: `最多重置 ${CASH_LOTTO_RESETS} 次` };
  L.resets++; L.got = []; save.write();
  return { ok: true };
}

/* ---- 时装自选属性 ---- */
// 身上 + 背包里所有可以选属性的时装
const cashAvItems = () => { inv.ensure(); return [...SLOTS.map(s => inv.equip[s]), ...inv.items].filter(it => it && it.kind === 'equip' && ITEMS[it.key] && ITEMS[it.key].avOpt); };
function cashSetOpt(it, opt) {
  const D = ITEMS[it.key], T = cashAvOpts(D); if (!T || !T.some(o => o[0] === opt)) return { err: '没有这个属性' };
  if ((it.opt || T[0][0]) === opt) return { err: '已经是这个属性了' };
  const free = !it.optLock;
  if (!free && !inv.take('tk_avopt', 1)) return { err: '需要 1 张装扮属性变更券（商城 100 点券）' };
  it.opt = opt; it.optLock = true; normalizeItem(it);
  if (game.player) recalcStats(game.player);
  save.write();
  return { ok: true, free };
}

/* ---- 券：强化 / 增幅 / 兑换 ---- */
function cashTicketTargets(T) {
  inv.ensure();
  const all = [...SLOTS.map(s => inv.equip[s]).filter(it => it && inv.equip[it.slot] === it), ...inv.items].filter(it => it && it.kind === 'equip');
  if (T.kind === 'enh') return all.filter(it => canEnhance(it) && !it.dim && (it.enh || 0) < T.lvl);
  if (T.kind === 'amp') return all.filter(it => canEnhance(it) && (it.enh || 0) < T.lvl && (it.dim || !(it.enh > 0)));
  return [];
}
function cashUseTicket(tk, target, sel = {}) {
  const D = ITEMS[tk.key], T = D && D.ticket; if (!T) return { err: '不是券' };
  if (!inv.items.includes(tk)) return { err: '券已经不在背包里了' };
  if (T.kind === 'enh') {
    if (!target || !cashTicketTargets(T).includes(target)) return { err: '这件装备不能使用' };
    inv.take(tk.key, 1); target.enh = T.lvl;
  } else if (T.kind === 'amp') {
    if (typeof ampSetLevel !== 'function') return { err: '增幅系统尚未开放' };
    if (!target) return { err: '请选择装备' };
    if (!ampSetLevel(target, T.lvl, { stat: sel.stat })) return { err: '这件装备不能使用增幅券' };
    inv.take(tk.key, 1);
  } else if (T.kind === 'avatar' || T.kind === 'sky') {
    const sets = T.kind === 'sky' ? CASH_SKY_SETS : CASH_ADV_SETS;
    if (!sets.includes(sel.set) || !AV_PIECE_SLOTS.includes(sel.slot)) return { err: '请选择套装和部位' };
    const it = makeItem(avKey(sel.set, sel.slot)); if (sel.opt) { it.opt = sel.opt; it.optLock = true; normalizeItem(it); }
    const room = cashRoomFor([it]); if (room) return { err: room };
    inv.take(tk.key, 1); cashGive([it]);
    if (T.kind === 'sky') bus.emit('announce', { kind: 'skyset', item: it });
    save.write(); return { ok: true, items: [it] };
  } else return { err: '请在“属性选择”里使用' };
  if (game.player) recalcStats(game.player);
  save.write(); sfx.enhanceOk();
  return { ok: true, items: [target] };
}

/* ---- 点券产出 ---- */
function cashStat(k, v, max) {
  const S = cashData(); if (!S) return;
  S.stat[k] = max ? Math.max(S.stat[k] || 0, v) : (S.stat[k] || 0) + v;
  for (const A of CASH_ACH) if (A.stat === k && !S.ach[A.id] && S.stat[k] >= A.n) { S.ach[A.id] = Date.now(); addCera(A.cera, `成就：${A.name}`); toastMsg(`成就达成：${A.name}（${A.desc}）`, '#ffd23a'); }
}
bus.on('levelUp', e => { if (!save.data || !e.lvl) return; const S = cashData(); if ((S.lvlPaid || 1) >= e.lvl) return; S.lvlPaid = e.lvl; addCera(e.lvl * CASH_EARN.lvl, `升级到 Lv.${e.lvl}`); });
bus.on('dungeonClear', e => {
  const S = cashData(); if (!S) return;
  cashStat('clear', 1);
  if (e.rank === 'SSS') cashStat('sss', 1);
  let first = 0;
  if (!S.first[e.id]) { S.first[e.id] = 1; first += CASH_EARN.first; }
  const fk = `${e.id}:${e.diff}`; if (e.diff > 0 && !S.first[fk]) { S.first[fk] = 1; first += CASH_EARN.firstDiff[e.diff] || 0; }
  if (first) addCera(first, '首次通关');
  const base = CASH_EARN.rank[e.rank] || 0;
  if (base) { const r = Math.min(Math.round(base * (1 + (e.diff || 0) * 0.25)), CASH_EARN.rankCap - S.today.rank); if (r > 0) { S.today.rank += r; addCera(r, `通关评价 ${e.rank}`); } }
});
bus.on('questDone', e => { const Q = typeof QUESTS !== 'undefined' && QUESTS[e.id]; if (!Q || Q.type !== 'daily' || !save.data) return; cashData().today.daily++; addCera(CASH_EARN.daily, `每日任务：${Q.name}`); });
bus.on('kill', () => cashStat('kill', 1));
bus.on('enhance', e => { if (e.ok) cashStat('enh', e.lvl, true); });
bus.on('pickup', e => { if (e.item && e.item.rar >= 5 && e.item.kind === 'equip') cashStat('epic', 1, true); });
bus.on('jobChange', () => cashStat('job', 1, true));
bus.on('awaken', () => cashStat('awaken', 1, true));
// 金币兑换点券（每天上限）
function cashExchGold(n) {
  const S = cashData(), E = CASH_EARN.exch;
  n = Math.min(n | 0, E.cap - S.today.exch);
  if (n <= 0) return { err: `今天已经兑换了 ${E.cap} 点券，明天再来吧` };
  const g = n * E.rate; if (game.gold < g) return { err: `金币不足（需要 ${fmtNum(g)} G）` };
  game.gold -= g; S.today.exch += n; addCera(n, '金币兑换'); sfx.coin(); save.write();
  return { ok: true, n, gold: g };
}
// 读档后第一次用到时，把旧角色的等级点券补上“起点”（已经是高等级的老角色不补发升级点券，只从下一级开始算）
bus.on('sceneEnter', () => { const S = cashData(); if (S && !S.lvlPaid) S.lvlPaid = game.lvl; });

/* ---- 商城物品的使用：包装 inv.useItem（箱子 / 礼包 / 红包 / 券 / 合成器 / 抽奖券） ---- */
{ const use0 = inv.useItem; inv.useItem = function (it) { const D = ITEMS[it.key]; if (D && D.cashUse) return cashUseItem(it, D); return use0.call(this, it); }; }
function cashUseItem(it, D) {
  const err = m => { toastMsg(m, '#ff6a6a'); sfx.error(); return false; };
  if (!game.player) return false;
  switch (D.cashUse) {
    case 'box': return typeof cashBoxUI === 'function' ? cashBoxUI(it.key, 1) : !cashOpenBoxes(it.key, 1).err;
    case 'pack': { const r = cashOpenPack(it); if (r.err) return err(r.err); if (typeof cashShowGot === 'function') cashShowGot(D.name, r.items); return true; }
    case 'red': { if (!inv.take(it.key, 1)) return false; const n = cashInt(D.red[0], D.red[1]); addCera(n, D.name); sfx.coin(); save.write(); return true; }
    case 'ticket': if (D.ticket.kind === 'avopt') { menus.show('avopt'); return false; } menus.show('ticket', { key: it.key }); return false;
    case 'synth': menus.show('synth', { key: it.key }); return false;
    case 'lotto': menus.show('lotto'); return false;
  }
  return false;
}
// 背包里的物品图标：商城物品优先用 art/final/cash/<cashIcon>
{ const iak0 = itemArtKey; itemArtKey = function (it) { const D = ITEMS[it.key]; if (D && D.cashIcon) { const k = 'cash/' + D.cashIcon; if (IMG[k] || (typeof ASSET_SRC !== 'undefined' && ASSET_SRC[k])) return k; } return iak0(it); }; }
// 商城素材（图标 / 宠物 / 光环）进城后在后台加载；网页版的分包名是 cash（主线程 bundleOf 没有单独分包时它们在 core 里，已经加载好）
bus.on('sceneEnter', () => { if (!cashArtAsked) { cashArtAsked = true; setTimeout(() => loadBundles(['cash']).then(() => { iconUrlCache.clear(); if (typeof itemsRefresh === 'function') itemsRefresh(); }), 1500); } });
let cashArtAsked = false;
