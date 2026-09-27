// 拍卖行（社交与经济服务）：一口价上架 / 搜索 / 购买 / 下架 / 到期邮件退回 / 成交价参考
// 物品交割全部走邮件：买家的物品、卖家的金币（扣 5% 手续费）、退回的物品都是拍卖行邮件（不过期）
// 客户端在调用前已经从自己的存档里扣掉物品（上架）或金币（购买），请求带 rid，按 rid 幂等
import { now } from './mail.js';
export const AUCTION = { hours: { 12: 0.5, 24: 1, 48: 2 }, tax: 0.05, maxOn: 10, page: 20, maxPrice: 2e9 };
export const auctionFee = (price, hours) => Math.max(10, Math.floor(price * 0.005 * (AUCTION.hours[hours] || 1)));
const HOUR = 3600000;
const ARMOR = ['top', 'head', 'bottom', 'belt', 'shoes'], ACC = ['neck', 'bracelet', 'ring'], SPECIAL = ['support', 'stone'];
export function catOf(it) {
  if (it.kind === 'equip') {
    const s = String(it.slot || '');
    return s === 'weapon' ? 'weapon' : ARMOR.includes(s) ? 'armor' : ACC.includes(s) ? 'acc' : SPECIAL.includes(s) ? 'special' : s === 'title' ? 'title' : s.startsWith('av_') ? 'avatar' : 'etc';
  }
  return it.kind === 'use' ? 'use' : it.kind === 'mat' ? 'mat' : 'etc';
}
const txt = (s, n) => String(s ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, n);
const int = (v, lo, hi) => { const n = Math.floor(Number(v)); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : lo; };
const parse = s => { try { return JSON.parse(s); } catch { return null; } };
const slog = (ctx, type, user, detail) => { if (ctx.mods.gm && ctx.mods.gm.log) ctx.mods.gm.log(type, user, detail); };
const label = a => `${a.enh ? '+' + a.enh + ' ' : ''}${a.name}${a.n > 1 ? ' ×' + a.n : ''}`;
function view(a, uid, t) {
  return { id: a.id, item: parse(a.item), key: a.key, name: a.name, rar: a.rar, lvl: a.lvl, n: a.n, price: a.price, unit: a.unit, hours: a.hours,
    seller: a.seller_name, sellerChar: a.seller_char, created: a.created, expires: a.expires, left: Math.max(0, a.expires - t), status: a.status,
    buyer: a.buyer_name, closed: a.closed_at, mine: a.seller_id === uid, bought: a.buyer_id === uid };
}
// 物品退回卖家（到期 / 下架 / 管理员强制下架）
function giveBack(ctx, a, why) {
  ctx.mods.mail.send(a.seller_id, { kind: 'auction', from: '拍卖行', title: `${why}：${label(a)}`.slice(0, 40), body: `你上架的 ${label(a)} ${why === '到期退回' ? '到期没有卖出' : '已经下架'}，物品退还给你。（保管费不退）`, items: [{ item: parse(a.item) }], days: null });
}
// 到期处理：每 30 秒一次，搜索 / 查看前也会先跑一次
function expireDue(ctx) {
  const t = now(ctx);
  const due = ctx.db.all("SELECT * FROM auction WHERE status = 'on' AND expires <= ?", t);
  for (const a of due) {
    const ch = ctx.db.run("UPDATE auction SET status = 'expired', closed_at = ? WHERE id = ? AND status = 'on'", t, a.id);
    if (!ch.changes) continue;
    giveBack(ctx, a, '到期退回');
    slog(ctx, 'auction.expire', { id: a.seller_id, name: a.seller_name }, { id: a.id, item: label(a), price: a.price });
  }
  return due.length;
}
function cancel(ctx, a, by, why) {
  const ch = ctx.db.run("UPDATE auction SET status = 'cancel', closed_at = ? WHERE id = ? AND status = 'on'", now(ctx), a.id);
  if (!ch.changes) throw ctx.err(409, '这件物品已经卖出或下架了');
  giveBack(ctx, a, why);
  slog(ctx, 'auction.cancel', by, { id: a.id, item: label(a), seller: a.seller_name, why });
}
const SORTS = {
  unit: 'unit ASC, id ASC', unit_desc: 'unit DESC, id ASC', price: 'price ASC, id ASC', price_desc: 'price DESC, id ASC',
  lvl: 'lvl ASC, unit ASC', lvl_desc: 'lvl DESC, unit ASC', rar: 'rar DESC, unit ASC', end: 'expires ASC', new: 'created DESC, id DESC',
};

export default {
  name: 'auction',
  migrations: [
    `CREATE TABLE auction (id INTEGER PRIMARY KEY AUTOINCREMENT, rid TEXT NOT NULL UNIQUE, seller_id INTEGER NOT NULL, seller_name TEXT NOT NULL, seller_char TEXT NOT NULL DEFAULT '',
      item TEXT NOT NULL, key TEXT NOT NULL, name TEXT NOT NULL, kind TEXT NOT NULL, cat TEXT NOT NULL, slot TEXT, rar INTEGER NOT NULL DEFAULT 0, lvl INTEGER NOT NULL DEFAULT 1,
      cls TEXT, enh INTEGER NOT NULL DEFAULT 0, n INTEGER NOT NULL DEFAULT 1, price INTEGER NOT NULL, unit REAL NOT NULL, fee INTEGER NOT NULL, hours INTEGER NOT NULL,
      created INTEGER NOT NULL, expires INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'on', buyer_id INTEGER, buyer_name TEXT, buy_rid TEXT, closed_at INTEGER)`,
    `CREATE INDEX auction_on ON auction (status, expires)`,
    `CREATE INDEX auction_seller ON auction (seller_id, status)`,
    `CREATE INDEX auction_key ON auction (key, status, closed_at)`,
  ],
  init(ctx) {
    return { expireDue: () => expireDue(ctx), cancel: (id, by, why = '管理员下架') => { const a = ctx.db.get('SELECT * FROM auction WHERE id = ?', int(id, 0, 1e15)); if (!a) throw ctx.err(404, '没有这条挂单'); cancel(ctx, a, by, why); return true; } };
  },
  routes(r, ctx) {
    r.get('/api/auction/search', { auth: true, rate: [120, 60] }, req => {
      expireDue(ctx);
      const q = req.query || {}, t = now(ctx), where = ["status = 'on'", 'expires > ?'], args = [t];
      const kw = txt(q.q, 30); if (kw) { where.push("name LIKE ? ESCAPE '\\'"); args.push('%' + kw.replace(/[\\%_]/g, c => '\\' + c) + '%'); }
      if (q.cat) { where.push('cat = ?'); args.push(txt(q.cat, 12)); }
      if (q.slot) { where.push('slot = ?'); args.push(txt(q.slot, 12)); }
      if (q.rar !== undefined && q.rar !== '') { where.push('rar = ?'); args.push(int(q.rar, 0, 9)); }
      if (q.lvmin) { where.push('lvl >= ?'); args.push(int(q.lvmin, 0, 999)); }
      if (q.lvmax) { where.push('lvl <= ?'); args.push(int(q.lvmax, 0, 999)); }
      if (q.cls) { where.push('(cls IS NULL OR cls = ?)'); args.push(txt(q.cls, 12)); }
      if (q.key) { where.push('key = ?'); args.push(txt(q.key, 60)); }
      const W = where.join(' AND '), page = int(q.page || 0, 0, 9999);
      const total = ctx.db.get(`SELECT COUNT(*) n FROM auction WHERE ${W}`, ...args).n;
      const rows = ctx.db.all(`SELECT * FROM auction WHERE ${W} ORDER BY ${SORTS[q.sort] || SORTS.unit} LIMIT ${AUCTION.page} OFFSET ${page * AUCTION.page}`, ...args);
      return { list: rows.map(a => view(a, req.user.id, t)), total, page, pages: Math.max(1, Math.ceil(total / AUCTION.page)), now: t };
    });
    r.get('/api/auction/mine', { auth: true }, req => {
      expireDue(ctx);
      const t = now(ctx), uid = req.user.id;
      const on = ctx.db.all("SELECT * FROM auction WHERE seller_id = ? AND status = 'on' ORDER BY expires ASC", uid);
      const hist = ctx.db.all("SELECT * FROM auction WHERE (seller_id = ? OR buyer_id = ?) AND status != 'on' ORDER BY closed_at DESC LIMIT 40", uid, uid);
      return { on: on.map(a => view(a, uid, t)), history: hist.map(a => view(a, uid, t)), maxOn: AUCTION.maxOn, now: t };
    });
    // 成交价参考：近 7 天同 key 的成交（按单价）+ 当前在售最低单价
    r.get('/api/auction/price', { auth: true }, req => {
      const key = txt(req.query.key, 60), t = now(ctx);
      const s = ctx.db.get("SELECT COUNT(*) n, AVG(unit) avg, MIN(unit) lo, MAX(unit) hi FROM auction WHERE key = ? AND status = 'sold' AND closed_at > ?", key, t - 7 * 24 * HOUR);
      const cur = ctx.db.get("SELECT MIN(unit) lo, COUNT(*) n FROM auction WHERE key = ? AND status = 'on' AND expires > ?", key, t);
      return { key, sold: s.n, avg: s.n ? Math.round(s.avg) : null, lo: s.lo, hi: s.hi, onSale: cur.n, onLo: cur.lo };
    });
    // 上架：物品已在客户端移出背包、保管费已扣
    r.post('/api/auction/list', { auth: true, rate: [30, 60], limit: 16384 }, req => {
      const b = req.body || {}, uid = req.user.id, rid = txt(b.rid, 40);
      if (!rid) throw ctx.err(400, '缺少请求 id');
      const old = ctx.db.get('SELECT * FROM auction WHERE rid = ?', rid);
      if (old) { if (old.seller_id !== uid) throw ctx.err(409, '请求 id 冲突'); return { ok: true, again: true, id: old.id, fee: old.fee, expires: old.expires }; }
      const it = b.item;
      if (!it || typeof it !== 'object' || typeof it.key !== 'string' || !it.key || typeof it.name !== 'string') throw ctx.err(400, '物品数据不对');
      const raw = JSON.stringify(it); if (raw.length > 4096) throw ctx.err(400, '物品数据过大');
      if (it.kind === 'quest' || it.bind || it.noTrade) throw ctx.err(400, '这件物品不能交易');
      const hours = int(b.hours, 0, 99); if (!AUCTION.hours[hours]) throw ctx.err(400, '上架时长只能是 12 / 24 / 48 小时');
      const price = int(b.price, 0, AUCTION.maxPrice + 1); if (price < 1 || price > AUCTION.maxPrice) throw ctx.err(400, '价格要在 1 ~ 20 亿 G 之间');
      const onN = ctx.db.get("SELECT COUNT(*) n FROM auction WHERE seller_id = ? AND status = 'on'", uid).n;
      if (onN >= AUCTION.maxOn) throw ctx.err(400, `同时最多上架 ${AUCTION.maxOn} 件`);
      const n = it.kind === 'equip' ? 1 : int(it.n || 1, 1, 1e6), t = now(ctx), fee = auctionFee(price, hours);
      const x = ctx.db.run(`INSERT INTO auction (rid, seller_id, seller_name, seller_char, item, key, name, kind, cat, slot, rar, lvl, cls, enh, n, price, unit, fee, hours, created, expires)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        rid, uid, req.user.name, txt(b.char, 24), raw, it.key.slice(0, 60), txt(it.name, 40), txt(it.kind, 10) || 'mat', catOf(it), it.slot ? txt(it.slot, 12) : null,
        int(it.rar || 0, 0, 9), int(it.lvl || 1, 0, 999), it.slot === 'weapon' && it.cls ? txt(it.cls, 12) : null, int(it.enh || 0, 0, 99), n, price, price / n, fee, hours, t, t + hours * HOUR);
      const id = Number(x.lastInsertRowid);
      slog(ctx, 'auction.list', req.user, { id, item: `${it.enh ? '+' + it.enh + ' ' : ''}${it.name}${n > 1 ? ' ×' + n : ''}`, price, hours, fee });
      return { ok: true, id, fee, expires: t + hours * HOUR };
    });
    // 一口价购买：买家的金币已在客户端扣掉；成功后物品 → 买家邮件，金币（扣手续费）→ 卖家邮件
    r.post('/api/auction/buy', { auth: true, rate: [30, 60] }, req => {
      const b = req.body || {}, uid = req.user.id, rid = txt(b.rid, 40);
      if (!rid) throw ctx.err(400, '缺少请求 id');
      const res = ctx.db.tx(() => {
        const a = ctx.db.get('SELECT * FROM auction WHERE id = ?', int(b.id, 0, 1e15));
        if (!a) throw ctx.err(404, '没有这件物品');
        if (a.status === 'sold' && a.buyer_id === uid && a.buy_rid === rid) return { a, again: true };
        if (a.status !== 'on' || a.expires <= now(ctx)) throw ctx.err(409, '这件物品已经被买走或下架了');
        if (a.seller_id === uid) throw ctx.err(400, '不能购买自己上架的物品');
        if (b.price != null && int(b.price, 0, 1e12) !== a.price) throw ctx.err(409, '价格已经变了，请刷新');
        const t = now(ctx);
        ctx.db.run("UPDATE auction SET status = 'sold', buyer_id = ?, buyer_name = ?, buy_rid = ?, closed_at = ? WHERE id = ? AND status = 'on'", uid, req.user.name, rid, t, a.id);
        const tax = Math.floor(a.price * AUCTION.tax), got = a.price - tax;
        ctx.mods.mail.send(uid, { kind: 'auction', from: '拍卖行', title: `购买成功：${label(a)}`.slice(0, 40), body: `你以 ${a.price.toLocaleString('en-US')} G 买下了 ${label(a)}。`, items: [{ item: parse(a.item) }], days: null });
        ctx.mods.mail.send(a.seller_id, { kind: 'auction', from: '拍卖行', title: `出售成功：${label(a)}`.slice(0, 40), body: `${label(a)} 以 ${a.price.toLocaleString('en-US')} G 成交（买家：${b.char ? txt(b.char, 24) : req.user.name}）。\n扣除 5% 手续费 ${tax.toLocaleString('en-US')} G，实得 ${got.toLocaleString('en-US')} G。`, gold: got, days: null });
        return { a, tax, got };
      });
      if (!res.again) slog(ctx, 'auction.buy', req.user, { id: res.a.id, item: label(res.a), price: res.a.price, seller: res.a.seller_name, tax: res.tax });
      return { ok: true, again: !!res.again, id: res.a.id, price: res.a.price };
    });
    r.post('/api/auction/cancel', { auth: true, rate: [30, 60] }, req => {
      const a = ctx.db.get('SELECT * FROM auction WHERE id = ?', int(req.body.id, 0, 1e15));
      if (!a || a.seller_id !== req.user.id) throw ctx.err(404, '没有这条挂单');
      if (a.status !== 'on') throw ctx.err(409, '这件物品已经卖出或下架了');
      ctx.db.tx(() => cancel(ctx, a, req.user, '取消上架'));
      return { ok: true };
    });
  },
  tick: { every: 30000, fn: ctx => { expireDue(ctx); } },
};
