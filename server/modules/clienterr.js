// 客户端逐帧出错上报（src/game/game.js 的 frameErr：同一个错误每个页面只报第一次）：记进 client_err 表 + 服务端日志一行
// 查看：sh tools/admin/admin.sh errs（最近 30 条）或 GET /api/admin/cerr（管理员）
const txt = (s, n) => String(s ?? '').replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, ' ').slice(0, n);
const KEEP = 5000;   // 最多保留这么多条（插入时删掉更早的）
export default {
  name: 'clienterr',
  migrations: [
    `CREATE TABLE client_err (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, user_name TEXT NOT NULL DEFAULT '', place TEXT NOT NULL DEFAULT '',
      msg TEXT NOT NULL DEFAULT '', stack TEXT NOT NULL DEFAULT '', info TEXT NOT NULL DEFAULT '', ver TEXT NOT NULL DEFAULT '', at INTEGER NOT NULL)`,
    `CREATE INDEX client_err_at ON client_err (at)`,
  ],
  routes(r, ctx) {
    r.post('/api/cerr', { auth: true, rate: [10, 60] }, req => {
      const b = req.body || {}, place = txt(b.where, 60), msg = txt(b.msg, 300);
      let info = ''; try { info = txt(JSON.stringify(b.info ?? null), 600); } catch (e) { /* 不是 JSON */ }
      const x = ctx.db.run('INSERT INTO client_err (user_id, user_name, place, msg, stack, info, ver, at) VALUES (?,?,?,?,?,?,?,?)', req.user.id, req.user.name, place, msg, txt(b.stack, 3000), info, txt(b.ver, 40), Date.now());
      ctx.db.run('DELETE FROM client_err WHERE id <= ?', Number(x.lastInsertRowid) - KEEP);
      ctx.log(`客户端逐帧出错 ${req.user.name}：${place} ${msg} ${info}`);
      return { ok: true };
    });
    r.get('/api/admin/cerr', { admin: true }, () => ({ list: ctx.db.all('SELECT id, user_name AS "user", place, msg, stack, info, ver, at FROM client_err ORDER BY id DESC LIMIT 50') }));
  },
};
