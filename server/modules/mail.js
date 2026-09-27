// 邮件（社交与经济服务）：收件箱、领取附件（按 rid 幂等）、好友寄信、系统 / 管理员 / 拍卖行邮件
// 其他模块发邮件：ctx.mods.mail.send(userId, { title, body, from, fromId, kind, gold, cera, items, days })
//   items：[{ key, n, opt? }（按物品库 key 生成，客户端领取时 makeItem）| { item: 完整物品对象 }（拍卖行 / 好友寄出的实物）]
//   days：过期天数；null = 不过期（拍卖行邮件）；缺省 30 天
const DAY = 86400000;
const MAX_ITEMS = 5, INBOX = 100, MAX_GOLD = 2e9, MAX_CERA = 1e7, ITEM_BYTES = 4096;
const KINDS = new Set(['sys', 'gm', 'friend', 'auction']);
export const now = ctx => Date.now() + (ctx.svcShift || 0);   // 测试可以平移时间（见 gm.js 的测试接口）
const txt = (s, n) => String(s ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, n);
const int = (v, lo, hi) => { const n = Math.floor(Number(v)); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : lo; };
const parse = s => { try { return JSON.parse(s || '[]'); } catch { return []; } };

// 校验附件物品：只检查结构和大小（物品库在客户端，领取时客户端还会再检查 key 是否存在）
export function cleanItems(ctx, list) {
  if (list == null) return [];
  if (!Array.isArray(list)) throw ctx.err(400, '附件格式不对');
  if (list.length > MAX_ITEMS) throw ctx.err(400, `每封邮件最多 ${MAX_ITEMS} 件物品`);
  return list.map(e => {
    if (e && e.item && typeof e.item === 'object') {
      const it = e.item;
      if (typeof it.key !== 'string' || !it.key || it.key.length > 60) throw ctx.err(400, '附件物品不对');
      if (JSON.stringify(it).length > ITEM_BYTES) throw ctx.err(400, '附件物品数据过大');
      return { item: it };
    }
    if (e && typeof e.key === 'string' && e.key && e.key.length <= 60) {
      const o = { key: e.key, n: int(e.n ?? 1, 1, 9999) };
      if (e.opt && typeof e.opt === 'object') { const p = {}; if (e.opt.enh != null) p.enh = int(e.opt.enh, 0, 31); if (e.opt.grade != null) p.grade = int(e.opt.grade, 0, 4); if (Object.keys(p).length) o.opt = p; }
      return o;
    }
    throw ctx.err(400, '附件物品不对');
  });
}
const hasAtt = r => r.gold > 0 || r.cera > 0 || (r.items && r.items !== '[]');
const live = t => `deleted = 0 AND (expires IS NULL OR expires > ${Math.floor(t)})`;
function view(r) {
  return { id: r.id, kind: r.kind, from: r.from_name, title: r.title, body: r.body, gold: r.gold, cera: r.cera, items: parse(r.items),
    created: r.created, expires: r.expires, read: !!r.read_at, claimed: !!r.claimed_at, att: hasAtt(r) };
}
function counts(ctx, uid) {
  const t = now(ctx);
  const u = ctx.db.get(`SELECT COUNT(*) n FROM mail WHERE to_id = ? AND read_at IS NULL AND ${live(t)}`, uid);
  const p = ctx.db.get(`SELECT COUNT(*) n FROM mail WHERE to_id = ? AND claimed_at IS NULL AND (gold > 0 OR cera > 0 OR items != '[]') AND ${live(t)}`, uid);
  return { unread: u.n, pending: p.n };
}
function send(ctx, toId, m) {
  const kind = KINDS.has(m.kind) ? m.kind : 'sys';
  const items = cleanItems(ctx, m.items);
  const gold = int(m.gold || 0, 0, MAX_GOLD), cera = int(m.cera || 0, 0, MAX_CERA);
  const t = now(ctx), days = m.days === null ? null : int(m.days ?? 30, 1, 365);
  const r = ctx.db.run(`INSERT INTO mail (to_id, from_id, from_name, kind, title, body, gold, cera, items, created, expires, rid) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    toId, m.fromId ?? null, txt(m.from || '系统', 24) || '系统', kind, txt(m.title, 40) || '（无标题）', String(m.body ?? '').slice(0, 1000), gold, cera, JSON.stringify(items), t, days === null ? null : t + days * DAY, m.rid ?? null);
  const id = Number(r.lastInsertRowid);
  const c = counts(ctx, toId);
  ctx.sendTo(toId, { t: 'mail:new', id, unread: c.unread, pending: c.pending, from: txt(m.from || '系统', 24), title: txt(m.title, 40) });
  return id;
}
function friends(ctx, uid) {
  const S = ctx.mods.social || {};
  const f = S.friendsOf || S.friendIds || S.friends;
  if (typeof f !== 'function') return null;
  return (f.call(S, uid) || []).map(x => typeof x === 'object' ? x.id : x);
}
const slog = (ctx, type, user, detail) => { if (ctx.mods.gm && ctx.mods.gm.log) ctx.mods.gm.log(type, user, detail); };

export default {
  name: 'mail',
  migrations: [
    `CREATE TABLE mail (id INTEGER PRIMARY KEY AUTOINCREMENT, to_id INTEGER NOT NULL, from_id INTEGER, from_name TEXT NOT NULL, kind TEXT NOT NULL,
      title TEXT NOT NULL, body TEXT NOT NULL DEFAULT '', gold INTEGER NOT NULL DEFAULT 0, cera INTEGER NOT NULL DEFAULT 0, items TEXT NOT NULL DEFAULT '[]',
      created INTEGER NOT NULL, expires INTEGER, read_at INTEGER, claimed_at INTEGER, claim_rid TEXT, rid TEXT, deleted INTEGER NOT NULL DEFAULT 0)`,
    `CREATE INDEX mail_to ON mail (to_id, deleted, created)`,
    `CREATE UNIQUE INDEX mail_rid ON mail (from_id, rid) WHERE rid IS NOT NULL`,
  ],
  init(ctx) {
    return {
      send: (toId, m) => send(ctx, toId, m),
      counts: uid => counts(ctx, uid),
      cleanItems: list => cleanItems(ctx, list),
    };
  },
  routes(r, ctx) {
    const mine = (req, id) => {
      const m = ctx.db.get(`SELECT * FROM mail WHERE id = ? AND to_id = ? AND ${live(now(ctx))}`, int(id, 0, 1e15), req.user.id);
      if (!m) throw ctx.err(404, '邮件不存在或已过期');
      return m;
    };
    r.get('/api/mail', { auth: true }, req => {
      const rows = ctx.db.all(`SELECT * FROM mail WHERE to_id = ? AND ${live(now(ctx))} ORDER BY created DESC, id DESC LIMIT ${INBOX}`, req.user.id);
      return { list: rows.map(view), ...counts(ctx, req.user.id), now: now(ctx) };
    });
    r.get('/api/mail/unread', { auth: true }, req => counts(ctx, req.user.id));
    r.post('/api/mail/read', { auth: true }, req => {
      const m = mine(req, req.body.id);
      if (!m.read_at) ctx.db.run('UPDATE mail SET read_at = ? WHERE id = ?', now(ctx), m.id);
      return { ok: true, ...counts(ctx, req.user.id) };
    });
    // 领取附件：同一个 rid 重复调用返回同样的附件（客户端断网重试 / 刷新后对账）
    r.post('/api/mail/claim', { auth: true, rate: [200, 60] }, req => {
      const rid = txt(req.body.rid, 40);
      if (!rid) throw ctx.err(400, '缺少请求 id');
      const res = ctx.db.tx(() => {
        const m = mine(req, req.body.id);
        if (m.claimed_at) { if (m.claim_rid === rid) return { m, again: true }; throw ctx.err(409, '附件已经领取过了'); }
        if (!hasAtt(m)) throw ctx.err(400, '这封邮件没有附件');
        const t = now(ctx);
        ctx.db.run('UPDATE mail SET claimed_at = ?, claim_rid = ?, read_at = COALESCE(read_at, ?) WHERE id = ? AND claimed_at IS NULL', t, rid, t, m.id);
        return { m };
      });
      const m = res.m;
      if (!res.again) slog(ctx, 'mail.claim', req.user, { id: m.id, kind: m.kind, from: m.from_name, title: m.title, gold: m.gold, cera: m.cera, items: parse(m.items).map(e => e.item ? `${e.item.name || e.item.key}×${e.item.n || 1}` : `${e.key}×${e.n}`) });
      return { ok: true, again: !!res.again, id: m.id, gold: m.gold, cera: m.cera, items: parse(m.items), ...counts(ctx, req.user.id) };
    });
    // 好友寄信：附件（金币 / 物品）已在客户端从寄件人存档里扣掉；同一个 rid 只寄一次
    r.post('/api/mail/send', { auth: true, rate: [10, 60] }, req => {
      const b = req.body || {}, rid = txt(b.rid, 40);
      if (!rid) throw ctx.err(400, '缺少请求 id');
      const old = ctx.db.get('SELECT id FROM mail WHERE from_id = ? AND rid = ?', req.user.id, rid);
      if (old) return { ok: true, again: true, id: old.id };
      const to = ctx.findUser(txt(b.to, 40));
      if (!to) throw ctx.err(404, '没有这个玩家');
      if (to.id === req.user.id) throw ctx.err(400, '不能给自己寄信');
      const fr = friends(ctx, req.user.id);
      if (fr && !fr.includes(to.id)) throw ctx.err(403, '只能给好友寄信');
      if (b.cera) throw ctx.err(400, '点券不能在玩家之间邮寄');
      const title = txt(b.title, 40); if (!title) throw ctx.err(400, '请填写标题');
      const items = cleanItems(ctx, (b.items || []).map(e => ({ item: e.item || e })));
      const id = send(ctx, to.id, { kind: 'friend', from: req.user.name, fromId: req.user.id, title, body: String(b.body ?? '').slice(0, 500), gold: int(b.gold || 0, 0, MAX_GOLD), items, days: 30, rid });
      slog(ctx, 'mail.send', req.user, { id, to: to.name, title, gold: int(b.gold || 0, 0, MAX_GOLD), items: items.map(e => `${e.item.name || e.item.key}×${e.item.n || 1}`) });
      return { ok: true, id };
    });
    r.del('/api/mail/:id', { auth: true }, req => {
      const m = mine(req, req.params.id);
      if (hasAtt(m) && !m.claimed_at) throw ctx.err(400, '请先领取附件再删除');
      ctx.db.run('UPDATE mail SET deleted = 1 WHERE id = ?', m.id);
      return { ok: true, ...counts(ctx, req.user.id) };
    });
    // 一键删除：已读且没有未领取附件的邮件
    r.post('/api/mail/clean', { auth: true }, req => {
      const x = ctx.db.run(`UPDATE mail SET deleted = 1 WHERE to_id = ? AND deleted = 0 AND read_at IS NOT NULL AND (claimed_at IS NOT NULL OR (gold = 0 AND cera = 0 AND items = '[]'))`, req.user.id);
      return { ok: true, n: x.changes, ...counts(ctx, req.user.id) };
    });
  },
  // 过期清理：好友邮件里没领的附件退回寄件人（系统邮件，30 天），其余直接清除
  tick: {
    every: 5 * 60000,
    fn(ctx) {
      const t = now(ctx);
      const due = ctx.db.all('SELECT * FROM mail WHERE deleted = 0 AND expires IS NOT NULL AND expires <= ?', t);
      for (const m of due) {
        ctx.db.run('UPDATE mail SET deleted = 1 WHERE id = ?', m.id);
        if (m.kind === 'friend' && m.from_id && !m.claimed_at && hasAtt(m)) {
          send(ctx, m.from_id, { kind: 'sys', from: '系统', title: `退回：${m.title}`.slice(0, 40), body: '对方 30 天内没有领取，附件已退回。', gold: m.gold, items: parse(m.items), days: 30 });
        }
      }
    },
  },
};
