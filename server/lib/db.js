/* 数据库：Node 22 内置的 node:sqlite（同步 API，零原生依赖）的薄封装
   db.run(sql, ...参数) → { changes, lastInsertRowid }   db.get(sql, ...) → 一行 | undefined   db.all(sql, ...) → 数组
   db.exec(sql)   db.tx(fn) 事务（可嵌套，内层直接执行）
   参数：? 位置参数；或者只传一个对象，配合 :name（对象的键不带前缀）。注意 node:sqlite 不接受 true/false/undefined，请用 1/0/null */
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

export function openDb(file) {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  const raw = new DatabaseSync(file);
  raw.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 3000;');
  const cache = new Map();
  const prep = sql => { let s = cache.get(sql); if (!s) { s = raw.prepare(sql); cache.set(sql, s); } return s; };
  let depth = 0;
  const db = {
    raw, file,
    run(sql, ...a) { const r = prep(sql).run(...a); return { changes: Number(r.changes), lastInsertRowid: Number(r.lastInsertRowid) }; },
    get(sql, ...a) { return prep(sql).get(...a); },
    all(sql, ...a) { return prep(sql).all(...a); },
    exec(sql) { raw.exec(sql); },
    tx(fn) {
      if (depth) return fn();
      raw.exec('BEGIN IMMEDIATE'); depth++;
      try { const r = fn(); raw.exec('COMMIT'); return r; }
      catch (e) { try { raw.exec('ROLLBACK'); } catch { /* 已回滚 */ } throw e; }
      finally { depth--; }
    },
    close() { try { raw.close(); } catch { /* 已关闭 */ } },
  };
  db.exec('CREATE TABLE IF NOT EXISTS _migrations (name TEXT NOT NULL, idx INTEGER NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (name, idx))');
  return db;
}

// 按下标执行模块的迁移（每条只执行一次；只能往后追加）
export function migrate(db, name, list, log) {
  if (!Array.isArray(list)) return;
  const done = new Set(db.all('SELECT idx FROM _migrations WHERE name = ?', name).map(r => r.idx));
  list.forEach((m, i) => {
    if (done.has(i)) return;
    db.tx(() => {
      if (typeof m === 'function') m(db); else db.exec(m);
      db.run('INSERT INTO _migrations (name, idx, at) VALUES (?, ?, ?)', name, i, Date.now());
    });
    log(`数据库迁移 ${name}#${i}`);
  });
}
