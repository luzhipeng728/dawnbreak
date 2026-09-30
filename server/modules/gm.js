// 管理员后台（社交与经济服务，只有 DNF_ADMIN 账号能调）：发放金币 / 点券 / 物品邮件、邀请码、在线玩家、全服公告、操作日志、拍卖行管理
// 也提供公共操作日志表 svc_log：ctx.mods.gm.log(type, user, detail)（拍卖 / 邮件 / 签到 / 管理员操作都记在这里）
// 游戏里的“管理”窗口（src/ui/social/gm.js）和独立的后台管理页面 /admin（server/admin/，其余接口在 modules/admin.js）都用这里的接口
import crypto from 'node:crypto';
import { now } from './mail.js';
const txt = (s, n) => String(s ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, n);
const int = (v, lo, hi) => { const n = Math.floor(Number(v)); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : lo; };
const parse = s => { try { return JSON.parse(s); } catch { return s; } };
function log(ctx, type, user, detail) {
  ctx.db.run('INSERT INTO svc_log (at, type, user_id, user_name, detail) VALUES (?,?,?,?,?)', now(ctx), txt(type, 30), user ? user.id ?? null : null, user ? user.name || '' : '', JSON.stringify(detail ?? {}).slice(0, 4000));
}
// 点券：单封上限 1000 万，超出自动拆成多封（最多 20 封 / 人）；按名单发最多 500 人
const CERA_MAIL = 1e7, CERA_SEND = 2e8, MAX_TO = 500;
// 所有注册用户（给“发给全体”用，停用 / 删除的账号不算）：优先用核心提供的列表函数，否则直接查账号表
function allUsers(ctx) {
  const A = ctx.mods.account || {};
  if (typeof A.listUsers === 'function') return A.listUsers();
  try { return ctx.db.all('SELECT id, name FROM users'); } catch { throw ctx.err(501, '服务端不支持群发'); }
}
export default {
  name: 'gm',
  migrations: [
    `CREATE TABLE svc_log (id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL, type TEXT NOT NULL, user_id INTEGER, user_name TEXT NOT NULL DEFAULT '', detail TEXT NOT NULL DEFAULT '{}')`,
    `CREATE INDEX svc_log_type ON svc_log (type, at)`,
  ],
  init(ctx) { return { log: (type, user, detail) => log(ctx, type, user, detail) }; },
  routes(r, ctx) {
    const A = () => ctx.mods.account || {};
    // 发放：to = 用户名数组 | '*'（全体）；附件：金币 / 点券 / 物品（{ key, n, opt: { enh, grade } }，由收件人的客户端按物品库生成）
    //   点券超过单封上限自动拆成多封（标题加“（2/3）”）；preview: true 只返回收件人和拆分结果，不发；
    //   rid：页面生成的批次号，同一个批次重复提交只发一次（网络重试 / 连点）；有物品目录时校验物品 key
    r.post('/api/gm/mail', { admin: true, rate: [30, 60] }, req => {
      const b = req.body || {};
      const title = txt(b.title, 40); if (!title) throw ctx.err(400, '请填写标题');
      const all = b.to === '*';
      let users;
      if (all) users = allUsers(ctx);
      else {
        const names = [...new Set((Array.isArray(b.to) ? b.to : String(b.to || '').split(/[,，、\s]+/)).map(s => txt(s, 40)).filter(Boolean))];
        if (!names.length) throw ctx.err(400, '请填写收件人');
        if (names.length > MAX_TO) throw ctx.err(400, `一次最多 ${MAX_TO} 个收件人（发给所有人请选“全体玩家”）`);
        const seen = new Set();
        users = names.map(n => { const u = ctx.findUser(n); if (!u || u.deleted) throw ctx.err(404, `没有玩家「${n}」`); return u; }).filter(u => !seen.has(u.id) && seen.add(u.id));
      }
      if (!users.length) throw ctx.err(400, '没有可以发送的玩家');
      const items = ctx.mods.mail.cleanItems(b.items || []);
      const cat = ctx.mods.admin && ctx.mods.admin.catalog ? ctx.mods.admin.catalog() : null;
      const unknown = cat ? items.filter(e => e.key && !cat.has(e.key)).map(e => e.key) : [];
      if (unknown.length) throw ctx.err(400, `物品库里没有：${unknown.join('、')}`);
      const gold = int(b.gold || 0, 0, 2e9), cera = int(b.cera || 0, 0, CERA_SEND), days = int(b.days || 30, 1, 365), body = String(b.body ?? '').slice(0, 1000);
      const parts = [{ gold, items, cera: Math.min(cera, CERA_MAIL) }];
      for (let left = cera - parts[0].cera; left > 0; left -= CERA_MAIL) parts.push({ gold: 0, items: [], cera: Math.min(left, CERA_MAIL) });
      const titleOf = i => { if (parts.length < 2) return title; const suf = `（${i + 1}/${parts.length}）`; return title.slice(0, 40 - suf.length) + suf; };
      const itemText = items.map(e => `${e.key}×${e.n}${e.opt && e.opt.enh ? ' +' + e.opt.enh : ''}`);
      if (b.preview) {
        return { ok: true, preview: true, n: users.length, per: parts.length, mails: users.length * parts.length, names: users.slice(0, 50).map(u => u.name), gold, cera, days, titles: parts.map((p, i) => titleOf(i)),
          items: items.map(e => ({ ...e, name: cat ? cat.name(e.key) : null })), checked: !!cat };
      }
      const batch = /^[A-Za-z0-9_-]{6,32}$/.test(String(b.rid || '')) ? String(b.rid) : crypto.randomBytes(6).toString('hex');
      const pre = `gm:${batch}:`;
      const dup = ctx.db.get('SELECT COUNT(*) AS n FROM mail WHERE from_id = ? AND rid >= ? AND rid < ?', req.user.id, pre, `gm:${batch};`).n;
      if (dup) return { ok: true, again: true, n: users.length, mails: dup, per: parts.length, batch };
      const ids = ctx.db.tx(() => users.flatMap(u => parts.map((p, i) => ctx.mods.mail.send(u.id, { kind: 'gm', from: '管理员', fromId: req.user.id, title: titleOf(i), body, gold: p.gold, cera: p.cera, items: p.items, days, rid: `${pre}${u.id}:${i}` }))));
      const to = all ? '全体' : users.length > 30 ? [...users.slice(0, 30).map(u => u.name), `…等 ${users.length} 人`] : users.map(u => u.name);
      log(ctx, 'gm.mail', req.user, { to, title, gold, cera, items: itemText, n: users.length, mails: ids.length, days, batch });
      return { ok: true, n: users.length, mails: ids.length, per: parts.length, batch, ids: ids.slice(0, 1000) };
    });
    r.get('/api/gm/online', { admin: true }, () => ({ list: ctx.online().map(o => ({ id: o.id, name: o.name, admin: o.admin, scene: o.scene, char: o.char, since: o.since, ip: o.ip })), now: now(ctx) }));
    r.get('/api/gm/invites', { admin: true }, () => ({ list: A().listInvites ? A().listInvites() : [] }));
    r.post('/api/gm/invite', { admin: true, rate: [20, 60] }, req => {
      if (!A().createInvite) throw ctx.err(501, '服务端不支持邀请码');
      const n = int(req.body.n || 1, 1, 20), note = txt(req.body.note, 40);
      const codes = Array.from({ length: n }, () => A().createInvite(req.user.id, note));
      log(ctx, 'gm.invite', req.user, { codes, note });
      return { ok: true, codes };
    });
    r.del('/api/gm/invite/:code', { admin: true }, req => {
      if (!A().deleteInvite) throw ctx.err(501, '服务端不支持邀请码');
      A().deleteInvite(txt(req.params.code, 40)); log(ctx, 'gm.invite.del', req.user, { code: req.params.code });
      return { ok: true };
    });
    r.post('/api/gm/notice', { admin: true, rate: [20, 60] }, req => {
      const text = txt(req.body.text, 120); if (!text) throw ctx.err(400, '请填写公告内容');
      const msg = ctx.mods.notice.broadcast({ kind: 'custom', text, user: req.user.name, char: '管理员', uid: req.user.id });
      log(ctx, 'gm.notice', req.user, { text });
      return { ok: true, notice: msg };
    });
    // 日志：type 前缀过滤（auction / mail / signin / gm），user 按用户名过滤，before = 只要 id 更小的（翻页）
    r.get('/api/gm/logs', { admin: true }, req => {
      const q = req.query || {}, where = [], args = [];
      if (q.type) { where.push('type LIKE ?'); args.push(txt(q.type, 20).replace(/[%_]/g, '') + '%'); }
      if (q.user) { where.push('user_name = ?'); args.push(txt(q.user, 40)); }
      if (q.before) { where.push('id < ?'); args.push(int(q.before, 0, 1e15)); }
      const rows = ctx.db.all(`SELECT * FROM svc_log ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY id DESC LIMIT ${int(q.limit || 100, 1, 500)}`, ...args);
      return { list: rows.map(x => ({ id: x.id, at: x.at, type: x.type, user: x.user_name, detail: parse(x.detail) })) };
    });
    r.get('/api/gm/auction', { admin: true }, req => {
      ctx.mods.auction.expireDue();
      const st = txt(req.query.status, 10), t = now(ctx);
      const rows = ctx.db.all(`SELECT * FROM auction ${st ? 'WHERE status = ?' : ''} ORDER BY id DESC LIMIT 200`, ...(st ? [st] : []));
      return { list: rows.map(a => ({ id: a.id, name: a.name, rar: a.rar, enh: a.enh, n: a.n, price: a.price, fee: a.fee, seller: a.seller_name, sellerChar: a.seller_char, buyer: a.buyer_name, status: a.status, created: a.created, expires: a.expires, closed: a.closed_at, left: Math.max(0, a.expires - t) })), now: t };
    });
    r.post('/api/gm/auction/cancel', { admin: true }, req => ({ ok: ctx.db.tx(() => ctx.mods.auction.cancel(req.body.id, req.user, '管理员下架')) }));
    // 测试专用（只有设置了 DNF_SVC_TEST=1 的服务端才有）：平移服务端时间，用来测拍卖到期、跨天签到
    if (process.env.DNF_SVC_TEST === '1') {
      r.post('/api/gm/test/time', { admin: true }, req => {
        ctx.svcShift = (ctx.svcShift || 0) + int(req.body.add || 0, -1e11, 1e11);
        const a = ctx.mods.auction.expireDue();
        return { ok: true, shift: ctx.svcShift, now: now(ctx), expired: a };
      });
    }
  },
};
