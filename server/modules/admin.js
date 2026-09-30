// 后台管理（/admin 页面，server/admin/）的接口：全部 { admin: true }（没登录 401、不是 DNF_ADMIN 账号 403）
//   概况 GET /api/gm/stats · 账号 GET /api/gm/users、/api/gm/users/:id · 封禁 / 解封、踢下线、重设密码、软删除 / 恢复 POST /api/gm/users/:id/{ban,logout,password,delete,undelete}
//   注册记录 GET /api/gm/regs · GM 邮件历史 GET /api/gm/mails · 客户端报错 GET /api/gm/cerr
//   发邮件 / 公告 / 在线玩家 / 操作日志沿用 gm.js 的 /api/gm/{mail,notice,online,logs}
// 每个写操作都记进操作日志 svc_log（ctx.mods.gm.log，detail 里带 uid = 被操作的账号）
// 删除账号 = 软删除：先把整个数据库 VACUUM INTO 备份到数据库目录下的 backups/，再停用 + 标记 deleted_at（存档 / 邮件都留着，可以恢复）
// 物品目录：网页版构建出的 catalog.json（DNF_CATALOG，或 DNF_STATIC 下的），发物品邮件时校验 key；读不到就只校验格式
import fs from 'node:fs';
import path from 'node:path';
import { checkPass } from '../lib/util.js';

const DAY = 86400000, FLAG_IP = 3;
const txt = (s, n) => String(s ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, n);
const int = (v, lo, hi, d = lo) => { const n = Math.floor(Number(v)); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };
const parse = (s, d) => { try { return JSON.parse(s); } catch { return d; } };
const safeJson = col => `CASE WHEN json_valid(${col}) THEN ${col} END`;

function catalogLoader(ctx) {
  let cache = null, file = '', mtime = 0, checked = 0;
  return () => {
    const f = ctx.cfg.catalog || (ctx.cfg.static ? path.join(ctx.cfg.static, 'catalog.json') : '');
    if (!f) return null;
    const t = Date.now();
    if (f === file && t - checked < 10_000) return cache;
    checked = t;
    try {
      const st = fs.statSync(f);
      if (cache && f === file && st.mtimeMs === mtime) return cache;
      const j = JSON.parse(fs.readFileSync(f, 'utf8'));
      const names = new Map(j.items.map(x => [x[0], x[1]]));
      cache = { id: j.id || '', classes: j.classes || {}, size: names.size, has: k => names.has(k), name: k => names.get(k) };
      mtime = st.mtimeMs;
    } catch { cache = null; }
    file = f;
    return cache;
  };
}

// 所有账号的摘要（角色 / 点券 / 金币用 SQLite 的 JSON 函数直接从存档里取，不在 JS 里解析整份存档）；5 秒内重复查询用缓存，写操作后清掉
function summaries(ctx, memo) {
  if (memo.rows && Date.now() - memo.at < 5000) return memo.rows;
  const rows = ctx.db.all(`SELECT u.id, u.name, u.created, u.last_login, u.reg_ip, u.last_ip, u.banned, u.deleted_at, s.updated_at AS save_at, s.size,
      COALESCE(json_extract(s.d, '$.acct.cera'), 0) AS cera, COUNT(c.key) AS nchars,
      COALESCE(SUM(json_extract(c.value, '$.gold')), 0) AS gold, COALESCE(MAX(json_extract(c.value, '$.lvl')), 0) AS maxlv,
      json_group_array(json_array(json_extract(c.value, '$.name'), json_extract(c.value, '$.cls'), json_extract(c.value, '$.job'), json_extract(c.value, '$.lvl'))) AS chars
    FROM users u LEFT JOIN (SELECT user_id, updated_at, size, ${safeJson('data')} AS d FROM saves) s ON s.user_id = u.id
    LEFT JOIN json_each(s.d, '$.chars') c GROUP BY u.id`);
  const A = ctx.mods.account;
  memo.rows = rows.map(r => ({
    id: r.id, name: r.name, created: r.created, lastLogin: r.last_login || 0, regIp: r.reg_ip || '', lastIp: r.last_ip || '',
    banned: !!r.banned, deleted: !!r.deleted_at, deletedAt: r.deleted_at || 0, admin: A.isAdmin(r.name), saveAt: r.save_at || 0, saveSize: r.size || 0,
    cera: Math.floor(+r.cera || 0), gold: Math.floor(+r.gold || 0), maxlv: r.maxlv | 0,
    chars: parse(r.chars, []).filter(c => c[1]).map(([name, cls, job, lvl]) => ({ name: String(name ?? ''), cls, job: job || null, lvl: lvl | 0 })),
  }));
  memo.at = Date.now();
  return memo.rows;
}

// 整库备份（VACUUM INTO，写在数据库目录下的 backups/），返回文件名；内存数据库（测试）不备份
function backupDb(ctx, tag) {
  if (!ctx.cfg.db || ctx.cfg.db === ':memory:') return '';
  const dir = path.join(path.dirname(path.resolve(ctx.cfg.db)), 'backups');
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
  const file = path.join(dir, `dawnbreak-${stamp}-${tag}.db`);
  ctx.db.exec(`VACUUM INTO '${file.replace(/'/g, "''")}'`);
  return path.basename(file);
}

function saveSummary(data) {
  if (!data || !Array.isArray(data.chars)) return null;
  const itemBrief = it => it && typeof it === 'object' ? { key: txt(it.key, 60), name: txt(it.name || it.key, 40), rar: it.rar | 0, enh: it.enh | 0, amp: !!it.amp, n: it.n | 0 || 1 } : null;
  return {
    cera: Math.floor(+((data.acct || {}).cera) || 0),
    bank: data.bank && typeof data.bank === 'object' ? { gold: Math.floor(+data.bank.gold || 0), items: Array.isArray(data.bank.items) ? data.bank.items.length : 0 } : null,
    chars: data.chars.filter(c => c && typeof c === 'object').map(c => ({
      name: txt(c.name, 40), cls: txt(c.cls, 20), job: c.job ? txt(c.job, 20) : null, lvl: c.lvl | 0, gold: Math.floor(+c.gold || 0), created: +c.created || 0,
      inv: Array.isArray(c.inv) ? c.inv.length : 0, invN: Array.isArray(c.inv) ? c.inv.reduce((s, it) => s + ((it && it.n) | 0 || 1), 0) : 0, storage: Array.isArray(c.storage) ? c.storage.length : 0,
      equip: Object.entries(c.equip && typeof c.equip === 'object' ? c.equip : {}).filter(([, it]) => it).map(([slot, it]) => ({ slot, ...itemBrief(it) })),
    })),
  };
}

export default {
  name: 'admin',
  init(ctx) {
    const catalog = catalogLoader(ctx);
    return { catalog, backup: tag => backupDb(ctx, tag) };
  },
  routes(r, ctx) {
    const db = ctx.db, A = () => ctx.mods.account, memo = {};
    const log = (type, user, detail) => { memo.rows = null; ctx.mods.gm.log(type, user, detail); };
    const target = req => {
      const id = int(req.params.id, 1, 1e12, 0);
      const u = id && db.get('SELECT id, name, banned, deleted_at FROM users WHERE id = ?', id);
      if (!u) throw ctx.err(404, '没有这个账号');
      return { id: u.id, name: u.name, banned: !!u.banned, deleted: !!u.deleted_at, admin: A().isAdmin(u.name) };
    };
    const noAdmin = u => { if (u.admin) throw ctx.err(400, '不能对管理员账号做这个操作（管理员由 DNF_ADMIN 配置）'); };

    r.get('/api/gm/stats', { admin: true }, req => {
      const t = Date.now(), tz = int(req.query.tz, -720, 840, -new Date().getTimezoneOffset());
      const day0 = Math.floor((t + tz * 60000) / DAY) * DAY - tz * 60000, from = day0 - 29 * DAY;
      const regs = Array(30).fill(0);
      for (const x of db.all('SELECT created FROM users WHERE created >= ?', from)) { const i = Math.floor((x.created - from) / DAY); if (i >= 0 && i < 30) regs[i]++; }
      const u = db.get(`SELECT COUNT(*) AS total, SUM(deleted_at IS NULL) AS live, SUM(banned = 1 AND deleted_at IS NULL) AS banned, SUM(deleted_at IS NOT NULL) AS deleted,
        SUM(last_login >= ?) AS dau, SUM(last_login >= ?) AS wau FROM users`, t - DAY, t - 7 * DAY);
      const jobs = db.all(`SELECT json_extract(c.value, '$.cls') AS cls, json_extract(c.value, '$.job') AS job, COUNT(*) AS n, MAX(json_extract(c.value, '$.lvl')) AS maxlv, ROUND(AVG(json_extract(c.value, '$.lvl')), 1) AS avglv
        FROM (SELECT user_id, ${safeJson('data')} AS d FROM saves) s JOIN users u ON u.id = s.user_id, json_each(s.d, '$.chars') c
        WHERE u.deleted_at IS NULL GROUP BY cls, job ORDER BY n DESC`);
      const lv = Array(7).fill(0);
      for (const x of db.all(`SELECT json_extract(c.value, '$.lvl') AS lvl FROM (SELECT user_id, ${safeJson('data')} AS d FROM saves) s JOIN users u ON u.id = s.user_id, json_each(s.d, '$.chars') c WHERE u.deleted_at IS NULL`)) lv[Math.min(6, Math.floor(((x.lvl | 0) - 1) / 10))]++;
      const cerr = db.get('SELECT SUM(at >= ?) AS day, COUNT(*) AS week FROM client_err WHERE at >= ?', t - DAY, t - 7 * DAY);
      const cerrTop = db.all('SELECT place, msg, COUNT(*) AS n, COUNT(DISTINCT user_id) AS users, MAX(at) AS last FROM client_err WHERE at >= ? GROUP BY place, msg ORDER BY n DESC LIMIT 5', t - DAY);
      const gmMail = db.get("SELECT COUNT(*) AS n FROM svc_log WHERE type = 'gm.mail' AND at >= ?", t - 7 * DAY);
      let dbSize = 0; try { dbSize = fs.statSync(ctx.cfg.db).size + (fs.existsSync(ctx.cfg.db + '-wal') ? fs.statSync(ctx.cfg.db + '-wal').size : 0); } catch { dbSize = 0; }
      const cat = ctx.mods.admin.catalog(), mem = process.memoryUsage();
      return {
        now: t, tz, day0, regs, users: { total: u.live || 0, banned: u.banned || 0, deleted: u.deleted || 0, dau: u.dau || 0, wau: u.wau || 0, today: regs[29], week: regs.slice(23).reduce((a, b) => a + b, 0) },
        online: ctx.online().length, jobs, lv, chars: jobs.reduce((s, x) => s + x.n, 0), cerr: { day: cerr.day || 0, week: cerr.week || 0, top: cerrTop }, gmMail7: gmMail.n,
        server: { ver: ctx.NET_VER, boot: parseInt(ctx.cfg.boot, 36) || 0, uptime: Math.round(process.uptime()), node: process.version, rss: mem.rss, heap: mem.heapUsed, db: dbSize, web: cat ? cat.id : '', items: cat ? cat.size : 0 },
        classes: cat ? cat.classes : {},
      };
    });

    // 账号列表：q 搜用户名 / 角色名 / IP / #id；filter all | active | banned | deleted | online；sort 见 SORTS；分页 page / size
    const SORTS = { id: u => u.id, name: u => u.name.toLowerCase(), created: u => u.created, login: u => u.lastLogin, lvl: u => u.maxlv, chars: u => u.chars.length, cera: u => u.cera, gold: u => u.gold };
    r.get('/api/gm/users', { admin: true }, req => {
      const q = req.query, kw = txt(q.q, 40).toLowerCase(), filter = txt(q.filter, 10) || 'active';
      const size = int(q.size, 5, 200, 30), sortKey = SORTS[q.sort] ? q.sort : 'id', dir = q.dir === 'asc' ? 1 : -1;
      const on = new Set(ctx.online().map(o => o.id));
      let L = summaries(ctx, memo);
      if (filter === 'active') L = L.filter(u => !u.deleted);
      else if (filter === 'banned') L = L.filter(u => u.banned && !u.deleted);
      else if (filter === 'deleted') L = L.filter(u => u.deleted);
      else if (filter === 'online') L = L.filter(u => on.has(u.id));
      if (kw) {
        const idq = /^#?(\d+)$/.exec(kw);
        L = L.filter(u => (idq && u.id === +idq[1]) || u.name.toLowerCase().includes(kw) || u.regIp.startsWith(kw) || u.lastIp.startsWith(kw) || u.chars.some(c => c.name.toLowerCase().includes(kw)));
      }
      const key = SORTS[sortKey];
      L = L.slice().sort((a, b) => { const x = key(a), y = key(b); return (x < y ? -1 : x > y ? 1 : 0) * dir || (b.id - a.id); });
      const pages = Math.max(1, Math.ceil(L.length / size)), page = int(q.page, 1, pages, 1);
      return { total: L.length, page, pages, size, sort: sortKey, dir: dir > 0 ? 'asc' : 'desc', list: L.slice((page - 1) * size, page * size).map(u => ({ ...u, online: on.has(u.id) })) };
    });

    r.get('/api/gm/users/:id', { admin: true }, req => {
      const id = int(req.params.id, 1, 1e12, 0);
      const u = id && db.get('SELECT id, name, created, last_login, reg_ip, last_ip, banned, deleted_at FROM users WHERE id = ?', id);
      if (!u) throw ctx.err(404, '没有这个账号');
      const sv = db.get('SELECT data, updated_at, size FROM saves WHERE user_id = ?', id);
      const c = ctx.client(id);
      const logs = db.all(`SELECT id, at, type, user_name, detail FROM svc_log WHERE user_id = ? OR (type LIKE 'gm.%' AND (CASE WHEN json_valid(detail) THEN json_extract(detail, '$.uid') END) = ?) ORDER BY id DESC LIMIT 60`, id, id);
      return {
        user: { id: u.id, name: u.name, created: u.created, lastLogin: u.last_login || 0, regIp: u.reg_ip || '', lastIp: u.last_ip || '', banned: !!u.banned, deleted: !!u.deleted_at, deletedAt: u.deleted_at || 0, admin: A().isAdmin(u.name) },
        online: c ? { scene: c.scene, char: c.char, since: c.since, ip: c.ip } : null,
        save: sv ? { updatedAt: sv.updated_at, size: sv.size, history: db.get('SELECT COUNT(*) AS n FROM save_history WHERE user_id = ?', id).n, ...saveSummary(parse(sv.data, null)) } : null,
        sessions: db.all('SELECT created, last_seen AS lastSeen, expires, ip, ua FROM sessions WHERE user_id = ? ORDER BY last_seen DESC', id),
        mails: db.all('SELECT id, kind, from_name AS "from", title, gold, cera, items, created, expires, read_at AS readAt, claimed_at AS claimedAt, deleted FROM mail WHERE to_id = ? ORDER BY id DESC LIMIT 50', id).map(m => ({ ...m, items: parse(m.items, []) })),
        logs: logs.map(x => ({ id: x.id, at: x.at, type: x.type, user: x.user_name, detail: parse(x.detail, x.detail) })),
        errs: db.all('SELECT id, place, msg, ver, at FROM client_err WHERE user_id = ? ORDER BY id DESC LIMIT 20', id),
        now: Date.now(),
      };
    });

    r.post('/api/gm/users/:id/ban', { admin: true, rate: [30, 60] }, req => {
      const u = target(req), on = !!req.body.on, reason = txt(req.body.reason, 100);
      noAdmin(u);
      if (!on && u.deleted) throw ctx.err(400, '账号已删除，请先恢复再解封');
      A().setBanned(u.id, on);
      log(on ? 'gm.ban' : 'gm.unban', req.user, { uid: u.id, name: u.name, why: reason });
      return { ok: true, banned: on };
    });
    r.post('/api/gm/users/:id/logout', { admin: true, rate: [30, 60] }, req => {
      const u = target(req);
      if (u.id === req.user.id) throw ctx.err(400, '不能把自己踢下线（要退出请点右上角的“退出”）');
      const n = db.get('SELECT COUNT(*) AS n FROM sessions WHERE user_id = ?', u.id).n, was = ctx.isOnline(u.id);
      A().logoutAll(u.id); ctx.hub.kick(u.id, '你已被管理员请下线，请重新登录');
      log('gm.kick', req.user, { uid: u.id, name: u.name, n });
      return { ok: true, sessions: n, online: was };
    });
    r.post('/api/gm/users/:id/password', { admin: true, rate: [10, 60] }, async req => {
      const u = target(req), pass = req.body.pass;
      noAdmin(u);
      const e = checkPass(pass); if (e) throw ctx.err(400, e);
      await A().setPassword(u.id, pass);
      log('gm.password', req.user, { uid: u.id, name: u.name });
      return { ok: true };
    });
    r.post('/api/gm/users/:id/delete', { admin: true, rate: [5, 600] }, req => {
      const u = target(req);
      noAdmin(u);
      if (u.deleted) throw ctx.err(409, '这个账号已经删除了');
      if (txt(req.body.confirm, 40) !== u.name) throw ctx.err(400, `请输入完整的用户名「${u.name}」确认删除`);
      let file;
      try { file = backupDb(ctx, `pre-delete-${u.id}`); } catch (e) { ctx.log('删除账号前备份失败', e.stack || e); throw ctx.err(500, '数据库备份失败，没有删除'); }
      db.run('UPDATE users SET banned = 1, deleted_at = ? WHERE id = ?', Date.now(), u.id);
      A().setBanned(u.id, true);
      log('gm.delete', req.user, { uid: u.id, name: u.name, backup: file });
      ctx.log(`管理员 ${req.user.name} 删除了账号 ${u.name}（#${u.id}，软删除，备份 ${file || '无'}）`);
      return { ok: true, backup: file };
    });
    r.post('/api/gm/users/:id/undelete', { admin: true, rate: [10, 60] }, req => {
      const u = target(req);
      if (!u.deleted) throw ctx.err(409, '这个账号没有被删除');
      db.run('UPDATE users SET deleted_at = NULL WHERE id = ?', u.id);
      log('gm.undelete', req.user, { uid: u.id, name: u.name });
      return { ok: true, banned: u.banned };
    });

    // 最近注册：带注册 IP、第一个角色；同一个 IP 注册了 FLAG_IP 个以上账号的标出来
    r.get('/api/gm/regs', { admin: true }, req => {
      const days = int(req.query.days, 1, 365, 30), limit = int(req.query.limit, 1, 500, 200), since = Date.now() - days * DAY;
      const ipAll = new Map(db.all("SELECT reg_ip, COUNT(*) AS n FROM users WHERE reg_ip != '' GROUP BY reg_ip").map(x => [x.reg_ip, x.n]));
      const list = db.all(`SELECT u.id, u.name, u.created, u.last_login, u.reg_ip, u.last_ip, u.banned, u.deleted_at,
          json_extract(s.d, '$.chars[0].name') AS cname, json_extract(s.d, '$.chars[0].cls') AS cls, json_extract(s.d, '$.chars[0].job') AS job, json_extract(s.d, '$.chars[0].lvl') AS lvl, json_array_length(s.d, '$.chars') AS nchars
        FROM users u LEFT JOIN (SELECT user_id, ${safeJson('data')} AS d FROM saves) s ON s.user_id = u.id WHERE u.created >= ? ORDER BY u.created DESC, u.id DESC LIMIT ?`, since, limit)
        .map(x => ({ id: x.id, name: x.name, created: x.created, lastLogin: x.last_login || 0, ip: x.reg_ip || '', lastIp: x.last_ip || '', banned: !!x.banned, deleted: !!x.deleted_at,
          char: x.cls ? { name: String(x.cname ?? ''), cls: x.cls, job: x.job || null, lvl: x.lvl | 0 } : null, nchars: x.nchars | 0, sameIp: ipAll.get(x.reg_ip) || 0, flag: (ipAll.get(x.reg_ip) || 0) >= FLAG_IP }));
      const ips = db.all(`SELECT reg_ip AS ip, COUNT(*) AS n, SUM(created >= ?) AS recent, MIN(created) AS first, MAX(created) AS last, SUM(banned) AS banned, group_concat(name, '、') AS names
        FROM (SELECT reg_ip, created, banned, name FROM users WHERE reg_ip != '' ORDER BY id) GROUP BY reg_ip HAVING n >= 2 ORDER BY n DESC, last DESC LIMIT 50`, since)
        .map(x => ({ ...x, names: String(x.names || '').split('、').slice(0, 30), flag: x.n >= FLAG_IP }));
      return { days, flagAt: FLAG_IP, list, ips };
    });

    // GM 邮件历史（操作日志里的 gm.mail），带领取进度（按批次号 batch 数 mail 表里的 rid）
    r.get('/api/gm/mails', { admin: true }, req => {
      const rows = db.all("SELECT id, at, user_id, user_name, detail FROM svc_log WHERE type = 'gm.mail' ORDER BY id DESC LIMIT ?", int(req.query.limit, 1, 200, 50));
      return {
        list: rows.map(x => {
          const d = parse(x.detail, {}), o = { id: x.id, at: x.at, by: x.user_name, ...(d && typeof d === 'object' ? d : {}) };
          if (d && typeof d.batch === 'string' && x.user_id) {
            const s = db.get('SELECT COUNT(*) AS n, SUM(claimed_at IS NOT NULL) AS claimed, SUM(read_at IS NOT NULL) AS seen FROM mail WHERE from_id = ? AND rid >= ? AND rid < ?', x.user_id, `gm:${d.batch}:`, `gm:${d.batch};`);
            o.stat = { n: s.n || 0, claimed: s.claimed || 0, seen: s.seen || 0 };
          }
          return o;
        }),
      };
    });

    // 客户端报错：列表（按用户 / 关键字过滤，before 翻页）+ 最近 7 天按“位置 + 消息”分组
    r.get('/api/gm/cerr', { admin: true }, req => {
      const q = req.query, where = [], args = [];
      if (q.user) { where.push('user_name = ?'); args.push(txt(q.user, 40)); }
      if (q.q) { where.push("(msg LIKE ? ESCAPE '\\' OR place LIKE ? ESCAPE '\\')"); const k = '%' + txt(q.q, 60).replace(/[\\%_]/g, m => '\\' + m) + '%'; args.push(k, k); }
      if (q.before) { where.push('id < ?'); args.push(int(q.before, 0, 1e15, 0)); }
      const list = db.all(`SELECT id, user_id AS uid, user_name AS "user", place, msg, stack, info, ver, at FROM client_err ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY id DESC LIMIT ${int(q.limit, 1, 500, 100)}`, ...args);
      const groups = db.all('SELECT place, msg, COUNT(*) AS n, COUNT(DISTINCT user_id) AS users, MAX(at) AS last, MAX(ver) AS ver FROM client_err WHERE at >= ? GROUP BY place, msg ORDER BY n DESC LIMIT 30', Date.now() - 7 * DAY);
      return { list, groups, total: db.get('SELECT COUNT(*) AS n FROM client_err').n };
    });
  },
};
