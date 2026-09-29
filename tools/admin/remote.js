// 在服务器上跑的数据库小工具（由 tools/admin/*.sh 通过 ssh 调用，用服务端自带的 node 运行）。
// 写操作之前调用方会先跑 /opt/dawnbreak-server/backup.sh；写存档时另外把旧存档存进 save_history（why = admin-*）。
//   node remote.js <db> users                         列出账号、角色、点券邮件
//   node remote.js <db> dump <账号>                    打印 { updated_at, data }（云存档）
//   node remote.js <db> mail <账号> <点券> [标题]       发管理员邮件（点券，单封上限 1000 万）
//   node remote.js <db> item <账号> <物品key> <数量> [标题]  发管理员邮件（物品，按物品库 key，领取时生成；数量 1~9999）
//   node remote.js <db> put <账号> <json 文件> <why>    写回云存档（角色必须和下载时一致，否则拒绝）
const { DatabaseSync } = require('node:sqlite'); const fs = require('fs'); const crypto = require('crypto');
const [db0, cmd, a1, a2, a3] = process.argv.slice(2);
const db = new DatabaseSync(db0, { readOnly: cmd === 'users' || cmd === 'dump' });
const user = n => { const u = db.prepare('SELECT id, name FROM users WHERE name = ?').get(n); if (!u) { console.error('没有这个账号：' + n); process.exit(1); } return u; };
if (cmd === 'users') {
  for (const u of db.prepare('SELECT u.id, u.name, u.created, s.data FROM users u LEFT JOIN saves s ON s.user_id = u.id ORDER BY u.id').all()) {
    let d = {}; try { d = JSON.parse(u.data || '{}'); } catch (e) { /* */ }
    console.log(u.id, u.name, new Date(u.created).toISOString().slice(0, 16), '|', (d.chars || []).map(c => `${c.name}(${c.cls}${c.job ? '/' + c.job : ''} Lv${c.lvl})`).join(', '), '| 点券', (d.acct || {}).cera || 0);
  }
} else if (cmd === 'dump') {
  const u = user(a1), r = db.prepare('SELECT data, updated_at FROM saves WHERE user_id = ?').get(u.id);
  process.stdout.write(JSON.stringify({ updated_at: r.updated_at, data: JSON.parse(r.data) }));
} else if (cmd === 'mail') {
  const u = user(a1), cera = Math.min(1e7, Math.max(1, Math.floor(+a2))), t = Date.now();
  const r = db.prepare('INSERT INTO mail (to_id, from_id, from_name, kind, title, body, gold, cera, items, created, expires, rid) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
    .run(u.id, null, '管理员', 'gm', a3 || '点券补给', '管理员发放的点券，领取后所有角色共用。祝游戏愉快！', 0, cera, '[]', t, t + 30 * 86400000, null);
  console.log(`已发邮件 #${Number(r.lastInsertRowid)} → ${u.name}，点券 ${cera}`);
} else if (cmd === 'item') {
  const u = user(a1), n = Math.min(9999, Math.max(1, Math.floor(+a3 || 1))), t = Date.now();
  if (!/^[a-z][a-z0-9_]{0,59}$/.test(a2 || '') || !/^\d+$/.test(a3 || '')) { console.error(`参数不对：key=${a2} 数量=${a3}`); process.exit(1); }   // key 以字母开头、数量必须是数字（防参数错位）
  const r = db.prepare('INSERT INTO mail (to_id, from_id, from_name, kind, title, body, gold, cera, items, created, expires, rid) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
    .run(u.id, null, '管理员', 'gm', process.argv[7] || '物品补给', '管理员发放的物品，领取后放进背包。祝游戏愉快！', 0, 0, JSON.stringify([{ key: a2, n }]), t, t + 30 * 86400000, null);
  console.log(`已发邮件 #${Number(r.lastInsertRowid)} → ${u.name}，物品 ${a2} ×${n}`);
} else if (cmd === 'put') {
  const u = user(a1), next = JSON.parse(fs.readFileSync(a2, 'utf8'));
  const cur = db.prepare('SELECT data, updated_at FROM saves WHERE user_id = ?').get(u.id), old = JSON.parse(cur.data);
  if (next.chars.length < old.chars.length || old.chars.some((c, i) => c.created !== next.chars[i].created)) { console.error('角色和下载时不一致（玩家期间新建 / 删除了角色），已拒绝写入，请重新下载再做'); process.exit(1); }   // 允许在后面追加新角色
  const data = { ...old, v: next.v, chars: next.chars, acct: next.acct, _rev: crypto.randomBytes(6).toString('hex') };
  const text = JSON.stringify(data), t = Math.max(Date.now(), cur.updated_at + 1);
  db.exec('BEGIN');
  db.prepare('INSERT INTO save_history (user_id, data, updated_at, created, why) VALUES (?, ?, ?, ?, ?)').run(u.id, cur.data, cur.updated_at, Date.now(), 'admin-' + (a3 || 'edit'));
  db.prepare('UPDATE saves SET data = ?, updated_at = ?, size = ? WHERE user_id = ?').run(text, t, text.length, u.id);
  db.exec('COMMIT');
  console.log(`已写回 ${u.name} 的云存档：`, data.chars.map(c => `${c.name} ${c.cls}/${c.job} Lv${c.lvl}`).join('、'), '点券', data.acct && data.acct.cera);
} else { console.error('用法见文件开头'); process.exit(1); }
