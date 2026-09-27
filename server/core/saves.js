/* 核心模块：云存档
   GET /api/saves → { data: { v, cur, chars } | null, updatedAt }（updatedAt = 0 表示云端还没有存档）
   PUT /api/saves { data, baseUpdatedAt, force? } → { updatedAt }
     baseUpdatedAt 和云端当前版本不一致 → 409 { error, updatedAt }（客户端提示冲突让玩家选择；选“用本机覆盖”时带 force: true）
   备份：每个账号最多保留 20 份历史（最多每 10 分钟一份，覆盖冲突前的版本也会先备份），出问题时管理员可以恢复 */
const MAX_CHARS = 12, HIST_KEEP = 20, HIST_GAP = 10 * 60_000;

function validSave(d) {
  if (!d || typeof d !== 'object' || Array.isArray(d)) return '存档格式不对';
  if (!Array.isArray(d.chars)) return '存档里没有角色列表';
  if (d.chars.length > MAX_CHARS) return `角色数量超过上限（${MAX_CHARS}）`;
  for (const c of d.chars) if (!c || typeof c !== 'object' || typeof c.cls !== 'string') return '存档里有损坏的角色数据';
  return null;
}

export default {
  name: 'saves',
  migrations: [
    `CREATE TABLE saves (user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, data TEXT NOT NULL, updated_at INTEGER NOT NULL, size INTEGER NOT NULL)`,
    `CREATE TABLE save_history (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, data TEXT NOT NULL, updated_at INTEGER NOT NULL, created INTEGER NOT NULL, why TEXT);
     CREATE INDEX save_history_user ON save_history(user_id, created)`,
  ],
  init(ctx) {
    const { db } = ctx;
    const api = {
      read(userId) {
        const row = db.get('SELECT data, updated_at FROM saves WHERE user_id = ?', userId);
        if (!row) return { data: null, updatedAt: 0 };
        try { return { data: JSON.parse(row.data), updatedAt: row.updated_at }; } catch { return { data: null, updatedAt: row.updated_at }; }
      },
      backup(userId, why, force) {
        const cur = db.get('SELECT data, updated_at FROM saves WHERE user_id = ?', userId); if (!cur) return;
        const last = db.get('SELECT created FROM save_history WHERE user_id = ? ORDER BY created DESC LIMIT 1', userId);
        if (!force && last && Date.now() - last.created < HIST_GAP) return;
        db.run('INSERT INTO save_history (user_id, data, updated_at, created, why) VALUES (?, ?, ?, ?, ?)', userId, cur.data, cur.updated_at, Date.now(), why);
        db.run('DELETE FROM save_history WHERE user_id = ? AND id NOT IN (SELECT id FROM save_history WHERE user_id = ? ORDER BY created DESC LIMIT ?)', userId, userId, HIST_KEEP);
      },
      history(userId) { return db.all('SELECT id, updated_at AS updatedAt, created, why, length(data) AS size FROM save_history WHERE user_id = ? ORDER BY created DESC', userId); },
      restore(userId, histId) {
        const h = db.get('SELECT data FROM save_history WHERE id = ? AND user_id = ?', histId, userId); if (!h) return false;
        api.backup(userId, 'restore', true);
        const t = Date.now();
        db.run('INSERT INTO saves (user_id, data, updated_at, size) VALUES (?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at, size = excluded.size', userId, h.data, t, h.data.length);
        return true;
      },
    };
    ctx.readSave = api.read;
    return api;
  },
  routes(r, ctx) {
    const { db, err, cfg } = ctx;
    r.get('/api/saves', { auth: true }, req => ctx.mods.saves.read(req.user.id));
    r.put('/api/saves', { auth: true, rate: [60, 60], limit: cfg.saveLimit }, req => {
      const { data, baseUpdatedAt, force } = req.body;
      const e = validSave(data); if (e) throw err(400, e);
      const text = JSON.stringify(data);
      if (text.length > cfg.saveLimit) throw err(413, '存档太大了');
      const uid = req.user.id;
      return db.tx(() => {
        const cur = db.get('SELECT updated_at FROM saves WHERE user_id = ?', uid);
        const curAt = cur ? cur.updated_at : 0;
        if (!force && (+baseUpdatedAt || 0) !== curAt) throw err(409, '云端存档已经在别处更新过了', { updatedAt: curAt });
        ctx.mods.saves.backup(uid, force ? 'force' : 'auto', !!force);
        const t = Math.max(Date.now(), curAt + 1);
        db.run('INSERT INTO saves (user_id, data, updated_at, size) VALUES (?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at, size = excluded.size', uid, text, t, text.length);
        return { updatedAt: t };
      });
    });
    // 管理员：查看 / 恢复某个账号的存档备份
    r.get('/api/admin/saves/:user/history', { admin: true }, req => { const u = ctx.findUser(req.params.user); if (!u) throw err(404, '没有这个用户'); return { user: u, list: ctx.mods.saves.history(u.id) }; });
    r.post('/api/admin/saves/:user/restore', { admin: true }, req => { const u = ctx.findUser(req.params.user); if (!u) throw err(404, '没有这个用户'); if (!ctx.mods.saves.restore(u.id, +req.body.id)) throw err(404, '没有这份备份'); return { ok: true }; });
  },
};
