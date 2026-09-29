// 排行榜（社交与经济服务）：按角色上榜（cid = 角色创建时间），全部玩家榜 / 好友榜
// 榜单：lvl 等级、score 装备评分、duel 好友决斗胜场、arena 决斗场段位积分（arena.js 的表）、clear 地下城最快通关时间（按地下城 + 难度）、epic 史诗收集数、ach 成就点
import { now } from './mail.js';
import { tierOf } from './arena.js';
const txt = (s, n) => String(s ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, n);
const int = (v, lo, hi) => { const n = Math.floor(Number(v)); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : lo; };
const cidOf = v => txt(v, 24) || '0';
const TOP = 50;
const BOARDS = {
  lvl: { where: 'lvl > 0', order: 'lvl DESC, exp DESC, updated ASC', val: r => r.lvl },
  score: { where: 'score > 0', order: 'score DESC, lvl DESC, updated ASC', val: r => r.score },
  duel: { where: 'duel_win + duel_lose + duel_draw > 0', order: 'duel_win DESC, duel_lose ASC, updated ASC', val: r => r.duel_win },
  epic: { where: 'epics > 0', order: 'epics DESC, lvl DESC, updated ASC', val: r => r.epics },
  ach: { where: 'ach > 0', order: 'ach DESC, lvl DESC, updated ASC', val: r => r.ach },
};
function friendIds(ctx, uid) {
  const S = ctx.mods.social || {};
  const f = S.friendsOf || S.friendIds || S.friends;
  const list = typeof f === 'function' ? (f.call(S, uid) || []).map(x => typeof x === 'object' ? x.id : x) : [];
  return [uid, ...list];
}
function ensureChar(ctx, uid, name, cid) {
  ctx.db.run(`INSERT INTO rank_char (user_id, cid, user_name, char_name, updated) VALUES (?,?,?,?,?) ON CONFLICT(user_id, cid) DO NOTHING`, uid, cid, name, '', now(ctx));
}
const entry = (r, i) => ({ rank: i + 1, user: r.user_name, uid: r.user_id, cid: r.cid, char: r.char_name, cls: r.cls, job: r.job, lvl: r.lvl, score: r.score, epics: r.epics, ach: r.ach,
  win: r.duel_win, lose: r.duel_lose, draw: r.duel_draw, time: r.time_ms, diff: r.diff, at: r.at });

export default {
  name: 'rank',
  migrations: [
    `CREATE TABLE rank_char (user_id INTEGER NOT NULL, cid TEXT NOT NULL, user_name TEXT NOT NULL, char_name TEXT NOT NULL DEFAULT '', cls TEXT, job TEXT,
      lvl INTEGER NOT NULL DEFAULT 0, exp INTEGER NOT NULL DEFAULT 0, score INTEGER NOT NULL DEFAULT 0, epics INTEGER NOT NULL DEFAULT 0,
      duel_win INTEGER NOT NULL DEFAULT 0, duel_lose INTEGER NOT NULL DEFAULT 0, duel_draw INTEGER NOT NULL DEFAULT 0, updated INTEGER NOT NULL, PRIMARY KEY (user_id, cid))`,
    `CREATE TABLE rank_clear (user_id INTEGER NOT NULL, cid TEXT NOT NULL, dungeon TEXT NOT NULL, diff INTEGER NOT NULL, time_ms INTEGER NOT NULL, at INTEGER NOT NULL,
      PRIMARY KEY (user_id, cid, dungeon, diff))`,
    `CREATE INDEX rank_clear_dg ON rank_clear (dungeon, diff, time_ms)`,
    `ALTER TABLE rank_char ADD COLUMN ach INTEGER NOT NULL DEFAULT 0`,   // 成就点
  ],
  routes(r, ctx) {
    r.post('/api/rank/report', { auth: true, rate: [30, 60] }, req => {
      const b = req.body || {}, uid = req.user.id, cid = cidOf(b.cid), t = now(ctx);
      ctx.db.run(`INSERT INTO rank_char (user_id, cid, user_name, char_name, cls, job, lvl, exp, score, epics, ach, updated) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT(user_id, cid) DO UPDATE SET user_name = excluded.user_name, char_name = excluded.char_name, cls = excluded.cls, job = excluded.job,
          lvl = excluded.lvl, exp = excluded.exp, score = excluded.score, epics = excluded.epics, ach = excluded.ach, updated = excluded.updated`,
        uid, cid, req.user.name, txt(b.char, 24), txt(b.cls, 12) || null, txt(b.job, 16) || null, int(b.lvl, 0, 999), int(b.exp, 0, 1e15), int(b.score, 0, 1e12), int(b.epics, 0, 1e6), int(b.ach, 0, 1e7), t);
      // 账号下已经删掉的角色：下榜
      if (Array.isArray(b.chars) && b.chars.length) {
        const keep = new Set(b.chars.slice(0, 20).map(cidOf)); keep.add(cid);
        for (const row of ctx.db.all('SELECT cid FROM rank_char WHERE user_id = ?', uid)) if (!keep.has(row.cid)) {
          ctx.db.run('DELETE FROM rank_char WHERE user_id = ? AND cid = ?', uid, row.cid);
          ctx.db.run('DELETE FROM rank_clear WHERE user_id = ? AND cid = ?', uid, row.cid);
        }
      }
      return { ok: true };
    });
    // 通关时间：只保留最快的一次
    r.post('/api/rank/clear', { auth: true, rate: [30, 60] }, req => {
      const b = req.body || {}, uid = req.user.id, cid = cidOf(b.cid), dg = txt(b.dungeon, 40), diff = int(b.diff, 0, 9), ms = int(b.time, 1, 36e5 * 10);
      if (!dg) throw ctx.err(400, '缺少地下城');
      ensureChar(ctx, uid, req.user.name, cid);
      const old = ctx.db.get('SELECT time_ms FROM rank_clear WHERE user_id = ? AND cid = ? AND dungeon = ? AND diff = ?', uid, cid, dg, diff);
      if (old && old.time_ms <= ms) return { ok: true, best: old.time_ms, record: false };
      ctx.db.run(`INSERT INTO rank_clear (user_id, cid, dungeon, diff, time_ms, at) VALUES (?,?,?,?,?,?)
        ON CONFLICT(user_id, cid, dungeon, diff) DO UPDATE SET time_ms = excluded.time_ms, at = excluded.at`, uid, cid, dg, diff, ms, now(ctx));
      return { ok: true, best: ms, record: true };
    });
    r.post('/api/rank/duel', { auth: true, rate: [30, 60] }, req => {
      const b = req.body || {}, uid = req.user.id, cid = cidOf(b.cid);
      ensureChar(ctx, uid, req.user.name, cid);
      const col = b.draw ? 'duel_draw' : b.win ? 'duel_win' : 'duel_lose';
      ctx.db.run(`UPDATE rank_char SET ${col} = ${col} + 1, updated = ? WHERE user_id = ? AND cid = ?`, now(ctx), uid, cid);
      const row = ctx.db.get('SELECT duel_win, duel_lose, duel_draw FROM rank_char WHERE user_id = ? AND cid = ?', uid, cid);
      return { ok: true, win: row.duel_win, lose: row.duel_lose, draw: row.duel_draw };
    });
    // 查询：返回前 50 名 + 我的各角色的名次
    r.get('/api/rank', { auth: true, rate: [120, 60] }, req => {
      const q = req.query || {}, uid = req.user.id, board = String(q.board || 'lvl');
      const ids = q.scope === 'friends' ? friendIds(ctx, uid) : null;
      const inIds = ids ? ` AND c.user_id IN (${ids.map(x => int(x, 0, 1e15)).join(',')})` : '';
      let rows;
      if (board === 'arena') {   // 决斗场排位：按积分（打过至少一场的角色）
        rows = ctx.db.all(`SELECT c.*, k.lvl AS lvl FROM arena c LEFT JOIN rank_char k ON k.user_id = c.user_id AND k.cid = c.cid WHERE c.win + c.lose + c.draw + c.ai_win + c.ai_lose > 0${inIds} ORDER BY c.rating DESC, c.updated ASC LIMIT 2000`);   // 等级从角色榜表取
        const all = rows.map((r, i) => ({ rank: i + 1, user: r.user_name, uid: r.user_id, cid: r.cid, char: r.char_name, cls: r.cls, job: r.job, lvl: r.lvl || 0, rating: r.rating, tier: tierOf(r.rating), win: r.win, lose: r.lose, draw: r.draw, aiWin: r.ai_win, aiLose: r.ai_lose }));
        return { board, scope: ids ? 'friends' : 'all', total: all.length, list: all.slice(0, TOP), me: all.filter(e => e.uid === uid), now: now(ctx) };
      }
      if (board === 'clear') {
        const dg = txt(q.dungeon, 40), diff = int(q.diff || 0, 0, 9);
        rows = ctx.db.all(`SELECT k.time_ms, k.diff, k.at, c.* FROM rank_clear k JOIN rank_char c ON c.user_id = k.user_id AND c.cid = k.cid
          WHERE k.dungeon = ? AND k.diff = ?${inIds} ORDER BY k.time_ms ASC, k.at ASC LIMIT 2000`, dg, diff);
      } else {
        const B = BOARDS[board]; if (!B) throw ctx.err(400, '没有这个榜单');
        rows = ctx.db.all(`SELECT * FROM rank_char c WHERE ${B.where}${inIds} ORDER BY ${B.order} LIMIT 2000`);
      }
      const all = rows.map(entry);
      return { board, scope: ids ? 'friends' : 'all', total: all.length, list: all.slice(0, TOP), me: all.filter(e => e.uid === uid), now: now(ctx) };
    });
  },
};
