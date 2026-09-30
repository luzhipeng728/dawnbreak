/* 核心模块：账号（注册 / 登录 / 登出 / 当前用户 / 改密码）、会话 token、邀请码
   - 密码：scrypt（N=16384, r=8, p=1, 64 字节），存成 scrypt$N$r$p$盐$哈希
   - token：32 字节随机数（base64url）交给客户端，数据库只存它的 sha256；30 天有效，使用中自动续期
   - 开放注册，不需要邀请码（管理员后台的邀请码功能已不再使用）
   - users 还记录注册 IP / 最近登录 IP（后台管理看注册来源）和 deleted_at（后台“删除账号”是软删除：停用 + 标记，数据都留着，可以恢复） */
import crypto from 'node:crypto';
import { checkUser, checkPass, limiter, str } from '../lib/util.js';

const scrypt = (pass, salt, N = 16384, r = 8, p = 1) => new Promise((res, rej) => crypto.scrypt(pass, salt, 64, { N, r, p, maxmem: 64 * 1024 * 1024 }, (e, k) => e ? rej(e) : res(k)));
async function hashPass(pass) {
  const salt = crypto.randomBytes(16), k = await scrypt(pass, salt);
  return `scrypt$16384$8$1$${salt.toString('base64')}$${k.toString('base64')}`;
}
async function verifyPass(pass, stored) {
  const [alg, N, r, p, salt, hash] = String(stored).split('$');
  if (alg !== 'scrypt') return false;
  const k = await scrypt(pass, Buffer.from(salt, 'base64'), +N, +r, +p), h = Buffer.from(hash, 'base64');
  return k.length === h.length && crypto.timingSafeEqual(k, h);
}
const sha = t => crypto.createHash('sha256').update(t).digest('hex');
const DUMMY_HASH = 'scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$' + Buffer.alloc(64).toString('base64');   // 用户不存在时也跑一遍 scrypt，避免按耗时猜用户名

export default {
  name: 'account',
  migrations: [
    `CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE COLLATE NOCASE, pass TEXT NOT NULL, created INTEGER NOT NULL, last_login INTEGER, banned INTEGER NOT NULL DEFAULT 0, invite TEXT)`,
    `CREATE TABLE sessions (token TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, created INTEGER NOT NULL, expires INTEGER NOT NULL, last_seen INTEGER NOT NULL, ip TEXT, ua TEXT);
     CREATE INDEX sessions_user ON sessions(user_id)`,
    `CREATE TABLE invites (code TEXT PRIMARY KEY, created_by INTEGER, created_at INTEGER NOT NULL, used_by INTEGER, used_at INTEGER, note TEXT)`,
    `ALTER TABLE users ADD COLUMN reg_ip TEXT NOT NULL DEFAULT '';
     ALTER TABLE users ADD COLUMN last_ip TEXT NOT NULL DEFAULT '';
     ALTER TABLE users ADD COLUMN deleted_at INTEGER;
     UPDATE users SET reg_ip = COALESCE((SELECT ip FROM sessions s WHERE s.user_id = users.id ORDER BY created LIMIT 1), ''),
                      last_ip = COALESCE((SELECT ip FROM sessions s WHERE s.user_id = users.id ORDER BY last_seen DESC LIMIT 1), '')`,
  ],
  init(ctx) {
    const { db, cfg } = ctx, DAY = 86400_000, TTL = cfg.sessionDays * DAY;
    const cache = new Map();   // token 哈希 → { user, exp, chk }（减少每个请求查库）
    const isAdmin = name => cfg.admins.includes(String(name).toLowerCase());
    const pub = u => u && ({ id: u.id, name: u.name, admin: isAdmin(u.name) });
    const api = {
      isAdmin, pub,
      userByToken(token) {
        if (typeof token !== 'string' || token.length < 20 || token.length > 100) return null;
        const h = sha(token), t = Date.now(), c = cache.get(h);
        if (c && c.exp > t && t - c.chk < 60_000) return c.user;
        const row = db.get('SELECT s.expires, s.last_seen, u.id, u.name, u.banned FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?', h);
        if (!row || row.expires < t || row.banned) { cache.delete(h); if (row) db.run('DELETE FROM sessions WHERE token = ?', h); return null; }
        let exp = row.expires;
        if (t - row.last_seen > DAY) { exp = t + TTL; db.run('UPDATE sessions SET last_seen = ?, expires = ? WHERE token = ?', t, exp, h); }   // 每天最多续期一次
        const user = pub(row); cache.set(h, { user, exp, chk: t });
        return user;
      },
      userFromReq(req) {
        const a = req.headers.authorization || '';
        const m = /^Bearer\s+(\S+)$/i.exec(a);
        return m ? api.userByToken(m[1]) : null;
      },
      newSession(userId, ip, ua) {
        const token = crypto.randomBytes(32).toString('base64url'), t = Date.now();
        db.run('INSERT INTO sessions (token, user_id, created, expires, last_seen, ip, ua) VALUES (?, ?, ?, ?, ?, ?, ?)', sha(token), userId, t, t + TTL, t, ip || '', str(ua, 200));
        db.run('DELETE FROM sessions WHERE user_id = ? AND token NOT IN (SELECT token FROM sessions WHERE user_id = ? ORDER BY created DESC LIMIT 10)', userId, userId);   // 每个账号最多 10 个会话
        return token;
      },
      findUser(q) {
        const row = typeof q === 'number' ? db.get('SELECT id, name, created, banned, deleted_at FROM users WHERE id = ?', q) : db.get('SELECT id, name, created, banned, deleted_at FROM users WHERE name = ?', String(q));
        return row ? { ...pub(row), created: row.created, banned: !!row.banned, deleted: !!row.deleted_at } : null;
      },
      // 玩家手动输入的名字：先按账号名，找不到再按角色名（存档里的角色名，精确匹配）。同名角色有多个时报错，请对方给账号名
      findPlayer(q) {
        const u = api.findUser(q); if (u || typeof q !== 'string') return u;
        const n = q.trim(); if (!n) return null;
        const like = '%"name":"' + n.replace(/[\\%_]/g, m => '\\' + m) + '"%';
        const ids = db.all("SELECT user_id, data FROM saves WHERE data LIKE ? ESCAPE '\\'", like)
          .filter(r => { try { return (JSON.parse(r.data).chars || []).some(c => c && c.name === n); } catch (e) { return false; } }).map(r => r.user_id);
        if (ids.length > 1) throw ctx.err(400, `有 ${ids.length} 个叫「${n}」的角色，请输入对方的账号名`);
        return ids.length ? api.findUser(ids[0]) : null;
      },
      // 邀请码（管理员后台用）
      createInvite(byUserId, note) {
        const code = crypto.randomBytes(5).toString('hex').toUpperCase();
        db.run('INSERT INTO invites (code, created_by, created_at, note) VALUES (?, ?, ?, ?)', code, byUserId ?? null, Date.now(), str(note || '', 100));
        return code;
      },
      listInvites() { return db.all('SELECT i.code, i.created_at AS createdAt, i.used_at AS usedAt, i.note, c.name AS createdBy, u.name AS usedBy FROM invites i LEFT JOIN users c ON c.id = i.created_by LEFT JOIN users u ON u.id = i.used_by ORDER BY i.created_at DESC LIMIT 500'); },
      deleteInvite(code) { return db.run('DELETE FROM invites WHERE code = ? AND used_by IS NULL', String(code)).changes > 0; },
      // 封禁：清掉会话并踢下线
      setBanned(userId, on) {
        db.run('UPDATE users SET banned = ? WHERE id = ?', on ? 1 : 0, userId);
        if (on) { db.run('DELETE FROM sessions WHERE user_id = ?', userId); for (const [k, v] of cache) if (v.user.id === userId) cache.delete(k); ctx.hub.kick(userId, '账号已被管理员停用'); }
      },
      // 给“发给全体”用：停用 / 删除的账号不算
      listUsers() { return db.all('SELECT id, name FROM users WHERE banned = 0 AND deleted_at IS NULL ORDER BY id'); },
      // 管理员重设密码：旧会话全部作废并踢下线
      async setPassword(userId, pass) {
        db.run('UPDATE users SET pass = ? WHERE id = ?', await hashPass(pass), userId);
        api.logoutAll(userId); ctx.hub.kick(userId, '密码已被管理员重设，请用新密码登录');
      },
      logout(token) { const h = sha(token); db.run('DELETE FROM sessions WHERE token = ?', h); cache.delete(h); },
      logoutAll(userId) { db.run('DELETE FROM sessions WHERE user_id = ?', userId); for (const [k, v] of cache) if (v.user.id === userId) cache.delete(k); },
    };
    ctx.findUser = api.findUser; ctx.findPlayer = api.findPlayer;
    // 注册是开放的：DNF_ADMIN 里还没注册的名字谁先注册谁就是管理员，启动时提醒（先注册、再写进 DNF_ADMIN）
    for (const n of cfg.admins) if (!db.get('SELECT 1 FROM users WHERE name = ?', n)) ctx.log(`警告：DNF_ADMIN 里的「${n}」还没有注册，任何人注册这个名字都会成为管理员；请先注册再写进 DNF_ADMIN`);
    return api;
  },
  routes(r, ctx) {
    const { db, cfg, err } = ctx, A = () => ctx.mods.account;
    const loginIp = limiter(20, 600), loginName = limiter(10, 600), regLimit = limiter(30, 3600);
    r.post('/api/register', {}, async req => {
      const { user, pass } = req.body;   // 开放注册：不再需要邀请码
      const e = checkUser(user) || checkPass(pass); if (e) throw err(400, e);
      if (!regLimit(req.ip)) throw err(429, '注册太频繁，请稍后再试');
      if (db.get('SELECT 1 FROM users WHERE name = ?', user)) throw err(409, '这个用户名已经被注册了');
      const hash = await hashPass(pass);
      let id;
      try {
        id = db.tx(() => db.run('INSERT INTO users (name, pass, created, last_login, invite, reg_ip, last_ip) VALUES (?, ?, ?, ?, ?, ?, ?)', user, hash, Date.now(), Date.now(), '', str(req.ip, 64), str(req.ip, 64)).lastInsertRowid);
      } catch (e2) { if (/UNIQUE/.test(String(e2.message))) throw err(409, '这个用户名已经被注册了'); throw e2; }
      ctx.log(`新用户注册：${user}（#${id}）`);
      return { token: A().newSession(id, req.ip, req.headers['user-agent']), user: A().pub({ id, name: user }) };
    });
    r.post('/api/login', {}, async req => {
      const { user, pass } = req.body;
      if (typeof user !== 'string' || typeof pass !== 'string' || !user || !pass) throw err(400, '请输入用户名和密码');
      if (!loginIp(req.ip) || !loginName(user.toLowerCase())) throw err(429, '登录尝试太多，请 10 分钟后再试');
      const row = db.get('SELECT id, name, pass, banned FROM users WHERE name = ?', user.slice(0, 32));
      const ok = await verifyPass(pass.slice(0, 64), row ? row.pass : DUMMY_HASH);
      if (!row || !ok) throw err(401, '用户名或密码不对');
      if (row.banned) throw err(403, '这个账号已被管理员停用');
      db.run('UPDATE users SET last_login = ?, last_ip = ? WHERE id = ?', Date.now(), str(req.ip, 64), row.id);
      return { token: A().newSession(row.id, req.ip, req.headers['user-agent']), user: A().pub(row) };
    });
    r.post('/api/logout', { auth: true }, req => {
      const m = /^Bearer\s+(\S+)$/i.exec(req.headers.authorization || '');
      if (m) A().logout(m[1]);
      return { ok: true };
    });
    r.get('/api/me', { auth: true }, req => ({ user: req.user }));
    r.post('/api/password', { auth: true, rate: [5, 600] }, async req => {
      const { old, pass } = req.body;
      const e = checkPass(pass); if (e) throw err(400, e);
      const row = db.get('SELECT pass FROM users WHERE id = ?', req.user.id);
      if (!row || !(await verifyPass(String(old || '').slice(0, 64), row.pass))) throw err(401, '原密码不对');
      db.run('UPDATE users SET pass = ? WHERE id = ?', await hashPass(pass), req.user.id);
      return { ok: true };
    });
  },
};
