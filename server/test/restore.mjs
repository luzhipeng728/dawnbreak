// 服务端重启后恢复队伍和房间（不需要浏览器）：组队 + 地下城房间 / 决斗房间 → 重启服务端（同端口同库）→ 队长登记、队员认领 → 房间恢复、转发照常；
// 名单外的人认领无效；没回来的成员限时后通知房主
// 用法：node --disable-warning=ExperimentalWarning server/test/restore.mjs
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import WebSocket from 'ws';
import { start } from '../index.js';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dnf-restore-'));
const opts = { db: path.join(tmp, 't.db'), invites: ['CODE'], admins: [], graceMs: 800, restoreMs: 2500 };
let app = await start({ port: 0, ...opts });
const port = app.port, BASE = `http://127.0.0.1:${port}`;
let fails = 0, n = 0;
const ok = (c, msg, x) => { n++; if (c) console.log('✓', msg); else { fails++; console.log('✗', msg, x !== undefined ? JSON.stringify(x) : ''); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const api = async (m, p, body, token) => { const r = await fetch(BASE + p, { method: m, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined }); return r.json(); };
function conn(token) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`), inbox = [];
  const c = { ws, inbox, send: m => ws.send(JSON.stringify(m)),
    wait: (pred, ms = 3000) => new Promise((res, rej) => { const t0 = Date.now(); const tick = () => { const i = inbox.findIndex(pred); if (i >= 0) { res(inbox.splice(i, 1)[0]); return; } if (Date.now() - t0 > ms) { rej(new Error('等待超时')); return; } setTimeout(tick, 15); }; tick(); }) };
  ws.on('message', d => inbox.push(JSON.parse(d.toString())));
  return new Promise(res => ws.on('open', () => { c.send({ t: 'auth', token, ver: 1 }); res(c); }));
}
const has = (c, pred, ms) => c.wait(pred, ms).then(() => true, () => false);
try {
  const tok = {};
  for (const u of ['alice', 'bob', 'carol', 'dave']) tok[u] = (await api('POST', '/api/register', { user: u, pass: 'secret1', invite: 'CODE' })).token;
  let [a, b, c, d] = await Promise.all(['alice', 'bob', 'carol', 'dave'].map(u => conn(tok[u])));
  const w1 = await a.wait(m => m.t === 'welcome');
  for (const x of [b, c, d]) await x.wait(m => m.t === 'welcome');
  const ids = { alice: w1.user.id, bob: 2, carol: 3, dave: 4 };
  // 组队 + 地下城房间；carol 和 dave 决斗
  a.send({ t: 'party:invite', to: 'bob' }); const iv = await b.wait(m => m.t === 'party:invited'); b.send({ t: 'party:accept', from: iv.from.id });
  await a.wait(m => m.t === 'party' && m.party && m.party.members.length === 2);
  a.send({ t: 'room:open', kind: 'dungeon', meta: { id: 'lorien' } }); const r0 = await b.wait(m => m.t === 'room');
  c.send({ t: 'duel:ask', to: 'dave' }); const da = await d.wait(m => m.t === 'duel:asked'); d.send({ t: 'duel:accept', from: da.from.id });
  const dr0 = await c.wait(m => m.t === 'room' && m.room.kind === 'duel');
  ok(r0.room.members.length === 2 && dr0.room.members.length === 2, '重启前：队伍 + 地下城房间 + 决斗房间');
  // ---- 重启服务端（同端口、同数据库）----
  await app.stop();
  app = await start({ port, ...opts });
  ok(app.port === port, '服务端在同一个端口重新启动');
  [a, b, c, d] = await Promise.all(['alice', 'bob', 'carol', 'dave'].map(u => conn(tok[u])));
  const w2 = await a.wait(m => m.t === 'welcome');
  for (const x of [b, c, d]) await x.wait(m => m.t === 'welcome');
  ok(w2.boot && w2.boot !== w1.boot, 'welcome.boot 变了（客户端据此知道服务端重启过）', [w1.boot, w2.boot]);
  // bob 先认领（队长还没登记）→ 队长登记后自动加入
  b.send({ t: 'restore:claim', host: ids.alice });
  await sleep(150);
  a.send({ t: 'restore:host', party: [ids.bob], room: { kind: 'dungeon', meta: { id: 'lorien' }, members: [ids.bob] } });
  const ra = await a.wait(m => m.t === 'room' && m.room.kind === 'dungeon');
  ok(ra.resume && ra.room.host === ids.alice, '队长收到恢复后的房间（resume）');
  const rb = await b.wait(m => m.t === 'room' && m.room.kind === 'dungeon');
  ok(rb.resume && rb.room.id === ra.room.id, '先认领的队员自动加入恢复的房间');
  ok(await has(a, m => m.t === 'party' && m.party && m.party.members.length === 2), '队伍也恢复了（2 人）');
  a.send({ t: 'r', d: { k: 's', v: 1 } });
  ok(await has(b, m => m.t === 'r' && m.d.k === 's'), '恢复后房间转发正常');
  // 名单外的人认领无效
  c.send({ t: 'restore:claim', host: ids.alice });
  ok(!(await has(c, m => m.t === 'room' && m.room.kind === 'dungeon', 500)), '名单外的人认领不能进房间');
  // 决斗：dave（对方）后认领
  c.send({ t: 'restore:host', room: { kind: 'duel', members: [ids.dave] } });
  await c.wait(m => m.t === 'room' && m.room.kind === 'duel');
  d.send({ t: 'restore:claim', host: ids.carol });
  const rd = await d.wait(m => m.t === 'room' && m.room.kind === 'duel');
  ok(rd.resume && rd.room.host === ids.carol, '决斗房间恢复（对方后认领也能加入）');
  d.send({ t: 'r', d: { k: 'in', l: [[1, 0]] } });
  ok(await has(c, m => m.t === 'r' && m.d.k === 'in'), '决斗转发正常');
  // 限时内没回来的成员：房主收到 room:left
  a.send({ t: 'room:close' }); await sleep(100);
  // 重新来一次：bob 不认领
  await app.stop(); app = await start({ port, ...opts });
  [a, b] = await Promise.all(['alice', 'bob'].map(u => conn(tok[u]))); await a.wait(m => m.t === 'welcome'); await b.wait(m => m.t === 'welcome');
  a.send({ t: 'restore:host', party: [ids.bob], room: { kind: 'dungeon', meta: {}, members: [ids.bob] } });
  const rr = await a.wait(m => m.t === 'room');
  ok(await has(a, m => m.t === 'room:left' && m.user === ids.bob && m.why === 'timeout' && m.id === rr.room.id, 4000), '没回来的成员：限时后房主收到 room:left（timeout）');
  for (const x of [a, b, c, d]) x.ws.close();
} catch (e) { fails++; console.log('✗ 异常', e.stack || e); }
await app.stop();
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\n${n - fails}/${n} 通过`);
process.exit(fails ? 1 : 0);
