// 服务端接口自测（不需要浏览器）：临时数据库起服务 → 注册 / 登录 / 云存档往返与冲突 / 好友 / WS 聊天 / 同屏 / 队伍 / 房间转发 / 断线宽限 / 限流
// 用法：cd server && node --disable-warning=ExperimentalWarning test/api.mjs
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import WebSocket from 'ws';
import { start } from '../index.js';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dnf-api-'));
// 扩展模块示例（和其他组写 server/modules/*.js 的方式一样）
fs.writeFileSync(path.join(tmp, 'demo.js'), `export default {
  name: 'demo',
  migrations: ['CREATE TABLE demo (id INTEGER PRIMARY KEY, user_id INTEGER, text TEXT)'],
  init(ctx) { return { count: () => ctx.db.get('SELECT COUNT(*) AS n FROM demo').n }; },
  routes(r, ctx) {
    r.post('/api/demo', { auth: true, rate: [3, 60] }, req => { if (!req.body.text) throw ctx.err(400, '没有内容'); ctx.db.run('INSERT INTO demo (user_id, text) VALUES (?, ?)', req.user.id, String(req.body.text)); ctx.sendTo(req.user.id, { t: 'demo:new', n: ctx.mods.demo.count() }); return { n: ctx.mods.demo.count() }; });
    r.get('/api/demo/admin', { admin: true }, () => ({ online: ctx.online().length }));
  },
  ws: { 'demo:echo'(c, msg) { c.send({ t: 'demo:echo', v: msg.v, me: c.user.name }); } },
};`);
const app = await start({ port: 0, db: path.join(tmp, 't.db'), invites: ['TESTCODE'], admins: ['alice'], graceMs: 1500, extraModules: [path.join(tmp, 'demo.js')] });
const BASE = `http://127.0.0.1:${app.port}`;
let fails = 0, n = 0;
const ok = (c, msg) => { n++; if (c) console.log('✓', msg); else { fails++; console.log('✗', msg); } };
const api = async (method, p, body, token) => {
  const r = await fetch(BASE + p, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, data: await r.json().catch(() => ({})) };
};
const sleep = ms => new Promise(r => setTimeout(r, ms));
function conn(token) {
  const ws = new WebSocket(`ws://127.0.0.1:${app.port}/ws`), inbox = [];
  const c = { ws, inbox, send: m => ws.send(JSON.stringify(m)),
    wait: (pred, ms = 2000) => new Promise((res, rej) => { const t0 = Date.now(); const tick = () => { const i = inbox.findIndex(pred); if (i >= 0) { res(inbox.splice(i, 1)[0]); return; } if (Date.now() - t0 > ms) { rej(new Error('等待超时')); return; } setTimeout(tick, 15); }; tick(); }) };
  ws.on('message', d => inbox.push(JSON.parse(d.toString())));
  return new Promise(res => ws.on('open', () => { c.send({ t: 'auth', token, ver: 1, build: 'test' }); res(c); }));
}
const has = (c, pred, ms) => c.wait(pred, ms).then(() => true, () => false);

try {
  // ---- 注册 / 登录 ----
  ok((await api('POST', '/api/register', { user: 'alice', pass: 'secret1', invite: 'WRONG' })).status === 400, '邀请码错误被拒绝');
  ok((await api('POST', '/api/register', { user: 'a', pass: 'secret1', invite: 'TESTCODE' })).status === 400, '用户名太短被拒绝');
  const ra = await api('POST', '/api/register', { user: 'alice', pass: 'secret1', invite: 'TESTCODE' });
  ok(ra.status === 200 && ra.data.token && ra.data.user.admin === true, '注册 alice（管理员）');
  ok((await api('POST', '/api/register', { user: 'ALICE', pass: 'secret1', invite: 'TESTCODE' })).status === 409, '用户名不区分大小写查重');
  const rb = await api('POST', '/api/register', { user: 'bob', pass: 'secret2', invite: 'TESTCODE' });
  ok(rb.status === 200 && rb.data.user.admin === false, '注册 bob');
  ok((await api('POST', '/api/login', { user: 'bob', pass: 'nope' })).status === 401, '密码错误被拒绝');
  const lb = await api('POST', '/api/login', { user: 'Bob', pass: 'secret2' });
  ok(lb.status === 200 && lb.data.user.name === 'bob', '登录 bob（用户名大小写无关）');
  const A = ra.data.token, B = lb.data.token;
  ok((await api('GET', '/api/me', null, A)).data.user.name === 'alice', 'me');
  ok((await api('GET', '/api/me', null, 'bogus-token-123456789012345')).status === 401, '无效 token 401');
  // 管理员邀请码
  const inv = app.ctx.mods.account.createInvite(1, '测试');
  ok((await api('POST', '/api/register', { user: 'carol', pass: 'secret3', invite: inv.toLowerCase() })).status === 200, '一次性邀请码注册（不区分大小写）');
  ok((await api('POST', '/api/register', { user: 'dave', pass: 'secret3', invite: inv })).status === 400, '一次性邀请码不能再用');
  // ---- 云存档 ----
  const s0 = await api('GET', '/api/saves', null, A);
  ok(s0.data.updatedAt === 0 && s0.data.data === null, '新账号云存档为空');
  const save1 = { v: 4, cur: 0, chars: [{ cls: 'sword', name: '测试剑', lvl: 3, inv: [], equip: {} }] };
  const p1 = await api('PUT', '/api/saves', { data: save1, baseUpdatedAt: 0 }, A);
  ok(p1.status === 200 && p1.data.updatedAt > 0, '上传存档');
  const g1 = await api('GET', '/api/saves', null, A);
  ok(g1.data.updatedAt === p1.data.updatedAt && g1.data.data.chars[0].name === '测试剑', '存档往返一致');
  const p2 = await api('PUT', '/api/saves', { data: { ...save1, cur: 0 }, baseUpdatedAt: p1.data.updatedAt }, A);
  ok(p2.status === 200 && p2.data.updatedAt > p1.data.updatedAt, '基于最新版本再次上传');
  const p3 = await api('PUT', '/api/saves', { data: save1, baseUpdatedAt: p1.data.updatedAt }, A);
  ok(p3.status === 409 && p3.data.updatedAt === p2.data.updatedAt, '旧版本上传 → 409 冲突');
  const p4 = await api('PUT', '/api/saves', { data: save1, baseUpdatedAt: p1.data.updatedAt, force: true }, A);
  ok(p4.status === 200, '选择“用本机覆盖”（force）');
  ok((await api('PUT', '/api/saves', { data: { chars: 'x' }, baseUpdatedAt: 0 }, B)).status === 400, '存档格式校验');
  ok((await api('GET', '/api/saves', null, B)).data.updatedAt === 0, '存档按账号隔离');
  const big = await fetch(BASE + '/api/friends', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + A }, body: JSON.stringify({ user: 'x'.repeat(100000) }) });
  ok(big.status === 413, '请求体大小限制（64KB）');
  // ---- 好友 ----
  ok((await api('POST', '/api/friends', { user: 'bob' }, A)).data.state === 'out', 'alice 申请加 bob');
  const fb = await api('GET', '/api/friends', null, B);
  ok(fb.data.incoming.length === 1 && fb.data.incoming[0].name === 'alice', 'bob 收到申请');
  ok((await api('POST', '/api/friends/accept', { user: 'alice' }, B)).status === 200, 'bob 同意');
  ok((await api('GET', '/api/friends', null, A)).data.friends[0].name === 'bob', '成为好友');
  ok(app.ctx.mods.social.friendsOf(1).includes(2), 'ctx.mods.social.friendsOf');
  // ---- WS ----
  const ca = await conn(A), cb = await conn(B);
  ok(!!(await ca.wait(m => m.t === 'welcome')), 'WS 鉴权 alice');
  await cb.wait(m => m.t === 'welcome');
  ok(await has(ca, m => m.t === 'friend:on' && m.on && m.id === 2), '好友上线提醒');
  const bad = new WebSocket(`ws://127.0.0.1:${app.port}/ws`);
  const badClose = await new Promise(res => { bad.on('open', () => bad.send(JSON.stringify({ t: 'auth', token: A, ver: 999 }))); bad.on('close', code => res(code)); });
  ok(badClose === 4002, '协议版本不一致 → 断开（4002）');
  // 扩展模块
  ok((await api('POST', '/api/demo', { text: 'hi' }, A)).data.n === 1, '扩展模块：路由 + 迁移 + ctx.mods 互调');
  ok(await has(ca, m => m.t === 'demo:new' && m.n === 1), '扩展模块：ctx.sendTo 推送');
  ok((await api('POST', '/api/demo', {}, A)).status === 400, '扩展模块：ctx.err 返回中文错误');
  ok((await api('GET', '/api/demo/admin', null, B)).status === 403 && (await api('GET', '/api/demo/admin', null, A)).data.online >= 1, '扩展模块：admin 路由只有管理员能调');
  await api('POST', '/api/demo', { text: '2' }, A); await api('POST', '/api/demo', { text: '3' }, A);
  ok((await api('POST', '/api/demo', { text: '4' }, A)).status === 429, '扩展模块：路由限流 rate');
  ca.send({ t: 'demo:echo', v: 7 });
  ok(await has(ca, m => m.t === 'demo:echo' && m.v === 7 && m.me === 'alice'), '扩展模块：WS 消息处理');
  // 同屏
  const char = n => ({ name: n, cls: 'sword', job: null, lvl: 5, look: { wpn: 'katana', set: null, acc: [] } });
  ca.send({ t: 'hello', char: char('阿丽') }); cb.send({ t: 'hello', char: char('小鲍') });
  ca.send({ t: 'scene', id: 'elvenguard', x: 100, y: 80, f: 1 });
  await sleep(50);
  cb.send({ t: 'scene', id: 'elvenguard', x: 300, y: 90, f: -1 });
  const peers = await cb.wait(m => m.t === 'peers');
  ok(peers.list.length === 1 && peers.list[0].char.name === '阿丽', '进场景收到已在场的玩家');
  ok(await has(ca, m => m.t === 'penter' && m.p.name === 'bob'), '场景里的人收到新玩家进入');
  cb.send({ t: 'pos', x: 320, y: 88, f: 1, s: 'walk' });
  ok(await has(ca, m => m.t === 'pos' && m.id === 2 && m.x === 320 && m.s === 'walk'), '位置转发');
  cb.send({ t: 'scene', id: null });
  ok(await has(ca, m => m.t === 'pleave' && m.id === 2), '离开场景通知');
  // 聊天
  ca.send({ t: 'chat', ch: 'world', text: '大家好' });
  ok(await has(cb, m => m.t === 'chat' && m.ch === 'world' && m.text === '大家好' && m.from.cname === '阿丽'), '世界频道');
  ca.send({ t: 'chat', ch: 'whisper', to: 'bob', text: '悄悄话' });
  ok(await has(cb, m => m.t === 'chat' && m.ch === 'whisper' && m.text === '悄悄话'), '私聊');
  ca.send({ t: 'chat', ch: 'whisper', to: 'carol', text: '在吗' });
  ok(await has(ca, m => m.t === 'chat' && m.ch === 'sys' && /不在线/.test(m.text)), '私聊不在线提示');
  // 队伍
  ca.send({ t: 'party:invite', to: 'bob' });
  const iv = await cb.wait(m => m.t === 'party:invited');
  ok(iv.from.name === 'alice', '收到组队邀请');
  cb.send({ t: 'party:accept', from: iv.from.id });
  const pa = await ca.wait(m => m.t === 'party' && m.party);
  ok(pa.party.members.length === 2 && pa.party.leader === 1, '组队成功，alice 是队长');
  cb.send({ t: 'chat', ch: 'party', text: '队伍消息' });
  ok(await has(ca, m => m.t === 'chat' && m.ch === 'party' && m.text === '队伍消息'), '队伍频道');
  // 房间转发
  cb.send({ t: 'room:open', kind: 'dungeon' });
  ok(await has(cb, m => m.t === 'party:note' && /队长/.test(m.text)), '非队长不能开房间');
  ca.send({ t: 'room:open', kind: 'dungeon', meta: { dungeon: 'lorien' } });
  const rm = await cb.wait(m => m.t === 'room');
  ok(rm.room.kind === 'dungeon' && rm.room.host === 1 && rm.room.members.length === 2, '队长开地下城房间');
  ca.send({ t: 'r', d: { k: 'snap', v: 1 } });
  ok(await has(cb, m => m.t === 'r' && m.f === 1 && m.d.k === 'snap'), '房主 → 成员转发');
  cb.send({ t: 'r', d: { k: 'hit', v: 2 } });
  ok(await has(ca, m => m.t === 'r' && m.f === 2 && m.d.k === 'hit'), '成员 → 房主转发');
  // 非成员不能转发
  const cc = await conn((await api('POST', '/api/login', { user: 'carol', pass: 'secret3' })).data.token); await cc.wait(m => m.t === 'welcome');
  cc.send({ t: 'r', d: { k: 'evil' } });
  ok(!(await has(ca, m => m.t === 'r' && m.d.k === 'evil', 300)), '非房间成员的转发被丢弃');
  // 断线宽限：bob 掉线后在宽限期内重连 → 房间恢复
  cb.ws.close();
  ok(await has(ca, m => m.t === 'room:lag' && m.user === 2 && m.on), '成员掉线 → 房主收到 room:lag');
  const cb2 = await conn(B);
  ok(await has(cb2, m => m.t === 'room' && m.resume), '宽限期内重连 → 房间恢复');
  ok(await has(ca, m => m.t === 'room:lag' && m.user === 2 && !m.on), '房主收到重连通知');
  // 宽限期超时 → 离开房间和队伍
  cb2.ws.close();
  ok(await has(ca, m => m.t === 'room:left' && m.user === 2, 3000), '掉线超时 → 离开房间');
  ok(await has(ca, m => m.t === 'party' && !m.party, 3000), '掉线超时 → 队伍解散（只剩 1 人）');
  ca.send({ t: 'room:close' });   // alice 独自留在地下城房间里：先关掉
  // 决斗邀请
  const cb3 = await conn(B); await cb3.wait(m => m.t === 'welcome');
  ca.send({ t: 'duel:ask', to: 'bob' });
  const da = await cb3.wait(m => m.t === 'duel:asked');
  cb3.send({ t: 'duel:decline', from: da.from.id });
  ok(await has(ca, m => m.t === 'duel:declined' && m.by === 'bob'), '决斗被拒绝通知');
  ca.send({ t: 'duel:ask', to: 'bob' });
  const da2 = await cb3.wait(m => m.t === 'duel:asked');
  cb3.send({ t: 'duel:accept', from: da2.from.id });
  const dr = await ca.wait(m => m.t === 'room' && m.room.kind === 'duel');
  ok(dr.room.host === 1 && dr.room.members.length === 2, '决斗房间（发起方当房主）');
  ca.send({ t: 'room:close', why: 'end' });
  ok(await has(cb3, m => m.t === 'room:closed'), '房主关闭房间');
  // 顶号
  const ca2 = await conn(A);
  ok(await has(ca, m => m.t === 'kicked'), '同账号新连接顶掉旧连接');
  // WS 频率限制
  const cf = await conn(B); await cf.wait(m => m.t === 'welcome');
  const closed = new Promise(res => cf.ws.on('close', code => res(code)));
  for (let i = 0; i < 3000; i++) cf.send({ t: 'pos', x: i, y: 1 });
  ok(await Promise.race([closed, sleep(2000).then(() => 0)]) === 4008, 'WS 刷屏 → 断开（4008）');
  // 登出
  ok((await api('POST', '/api/logout', null, A)).status === 200 && (await api('GET', '/api/me', null, A)).status === 401, '登出后 token 失效');
  for (const c of [ca2, cc, cb3]) c.ws.close();
} catch (e) { fails++; console.log('✗ 异常', e.stack || e); }
await app.stop();
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\n${n - fails}/${n} 通过`);
process.exit(fails ? 1 : 0);
