// 决斗场排位（server/modules/arena.js）接口自测，不需要浏览器：匹配 / AI 补位 / 积分 / AI 减半 / 不重复匹配 / 退出队列 / 排队中断线 / 逃跑判负 / 结果对不上作废 / 奖励 / 排行榜
// 用法：node --disable-warning=ExperimentalWarning server/test/arena.mjs
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import WebSocket from 'ws';
import { start } from '../index.js';
import { expect, tierOf, REWARD, AI_POOL, aiPoolOf } from '../modules/arena.js';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dnf-arena-'));
const app = await start({ port: 0, db: path.join(tmp, 't.db'), invites: ['T'], admins: [], graceMs: 600,
  arenaAiMs: 1500, arenaRematchMs: 60_000, arenaMinMs: 300, arenaForfeitMs: 800, arenaReportMs: 600 });
const BASE = `http://127.0.0.1:${app.port}`, A = app.ctx.mods.arena;
let fails = 0, n = 0;
const ok = (c, msg, x) => { n++; if (c) console.log('✓', msg); else { fails++; console.log('✗', msg, x !== undefined ? JSON.stringify(x) : ''); } };
const api = async (method, p, body, token) => { const r = await fetch(BASE + p, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, data: await r.json().catch(() => ({})) }; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
function conn(token) {
  const ws = new WebSocket(`ws://127.0.0.1:${app.port}/ws`), inbox = [];
  const c = { ws, inbox, send: m => ws.send(JSON.stringify(m)),
    wait: (pred, ms = 4000) => new Promise((res, rej) => { const t0 = Date.now(); const tick = () => { const i = inbox.findIndex(pred); if (i >= 0) { res(inbox.splice(i, 1)[0]); return; } if (Date.now() - t0 > ms) { rej(new Error('等待超时')); return; } setTimeout(tick, 15); }; tick(); }) };
  ws.on('message', d => inbox.push(JSON.parse(d.toString())));
  return new Promise(res => ws.on('open', () => { c.send({ t: 'auth', token, ver: 1, build: 'test' }); c.wait(m => m.t === 'welcome').then(() => res(c)); }));
}
const got = (c, pred, ms) => c.wait(pred, ms).then(m => m, () => null);
const users = {};
async function user(name) { const r = await api('POST', '/api/register', { user: name, pass: 'secret1', invite: 'T' }); users[name] = { token: r.data.token, id: r.data.user.id, c: await conn(r.data.token) }; return users[name]; }
const join = (u, cls = 'sword') => u.c.send({ t: 'arena:join', cid: 'c1', char: { name: u === users.alice ? '爱丽丝' : 'x' + u.id, cls, job: null } });
const rating = u => A.row(u.id, 'c1').rating;

try {
  const [al, bo, ca, da, er] = [await user('alice'), await user('bob'), await user('carol'), await user('dave'), await user('erin')];
  const s0 = await api('GET', '/api/arena?cid=c1', null, al.token);
  ok(s0.status === 200 && s0.data.rating === 1000 && s0.data.tier === '青铜' && !s0.data.queued, '初始 1000 分（青铜）', s0.data);

  // ---- 两个真人互相匹配 → 决斗房间（带 meta.arena）----
  join(al); join(bo); join(bo);
  ok(!!(await got(al.c, m => m.t === 'arena:queued')), 'alice 进队列');
  ok(A.queue.size === 2, '同一账号重复排队只算一次（不会自己匹配自己）', A.queue.size);
  const ma = await got(al.c, m => m.t === 'arena:match'), mb = await got(bo.c, m => m.t === 'arena:match');
  ok(ma && mb && !ma.ai && ma.id === mb.id && ma.host && !mb.host && ma.vs.acct === 'bob', '两个真人互相匹配（先排的当主机）', { ma, mb });
  const room = await got(bo.c, m => m.t === 'room' && m.room.kind === 'duel');
  ok(room && room.room.meta.arena === ma.id && room.room.host === al.id, '建好排位决斗房间（meta.arena = 对局 id）', room);
  // 双方结果一致 → 结算
  al.c.send({ t: 'arena:end', id: ma.id, win: true }); bo.c.send({ t: 'arena:end', id: ma.id, win: false });
  const ra = await got(al.c, m => m.t === 'arena:result'), rb = await got(bo.c, m => m.t === 'arena:result');
  ok(ra && rb && ra.win && !rb.win && ra.delta === 16 && rb.delta === -16 && rating(al) === 1016 && rating(bo) === 984, '同分对局：赢 +16 / 输 −16', { ra, rb });
  ok(ra && ra.reward && ra.reward.first && ra.reward.gold === REWARD.gold + REWARD.first.gold && ra.reward.cera === REWARD.cera + REWARD.first.cera, '今日首胜奖励（金币 + 点券）', ra && ra.reward);
  ok(!!(await got(al.c, m => m.t === 'mail:new' && /首胜/.test(m.title))), '奖励走系统邮件');
  al.c.send({ t: 'room:close', why: 'end' }); await got(bo.c, m => m.t === 'room:closed');

  // ---- 刚打过的不再匹配：两人再排 → 各自等到 AI ----
  join(al); join(bo);
  const aa = await got(al.c, m => m.t === 'arena:match', 5000), ab = await got(bo.c, m => m.t === 'arena:match', 5000);
  ok(aa && ab && aa.ai && ab.ai && aa.id !== ab.id, '刚打过的两个人不会马上再匹配，超时后各自匹配到 AI', { aa, ab });
  ok(aa && aa.vs.name && aa.vs.cls && aa.vs.lvl === 1 && Math.abs(aa.vs.rating - 1016) <= 60, 'AI 对手：像玩家的名字、随机职业、积分在附近、青铜段位难度 1', aa && aa.vs);
  // AI 局：太快报的结果无效；正常报 → 积分减半
  al.c.send({ t: 'arena:end', id: aa.id, win: true });
  ok(!!(await got(al.c, m => m.t === 'arena:note' && /太短/.test(m.text))), 'AI 局开打不到最短时间就报结果：无效');
  await sleep(350);
  const r0 = rating(al); al.c.send({ t: 'arena:end', id: aa.id, win: true });
  const rai = await got(al.c, m => m.t === 'arena:result');
  const full = Math.round(32 * (1 - expect(r0, aa.vs.rating)));
  ok(rai && rai.ai && rai.win && rai.delta === Math.round(full * 0.5) && rai.delta < full && rating(al) === r0 + rai.delta, `赢 AI 只加一半分（+${rai && rai.delta}，打真人是 +${full}）`, rai);
  ok(rai && rai.reward && !rai.reward.first && rai.reward.gold === REWARD.aiGold, '赢 AI 的金币奖励减半、首胜不重复发', rai && rai.reward);
  const r1 = rating(bo); bo.c.send({ t: 'arena:end', id: ab.id, win: false });
  const rbl = await got(bo.c, m => m.t === 'arena:result');
  ok(rbl && rbl.delta === Math.round(Math.round(32 * (0 - expect(r1, ab.vs.rating))) * 0.5) && rbl.delta < 0 && !rbl.reward, '输给 AI 扣一半分、没有奖励', rbl);
  // 白金以上赢 AI 不加分
  app.ctx.db.run('UPDATE arena SET rating = 1600 WHERE user_id = ?', al.id);
  join(al); const acap = await got(al.c, m => m.t === 'arena:match', 5000);
  ok(acap && acap.ai && acap.vs.lvl === 3, '白金段位的 AI 难度 3', acap && acap.vs);
  await sleep(350); al.c.send({ t: 'arena:end', id: acap.id, win: true });
  const rcap = await got(al.c, m => m.t === 'arena:result');
  ok(rcap && rcap.delta === 0 && rating(al) === 1600, '白金（1500）以上赢 AI 不再加分（天梯靠打真人）', rcap);
  // 没报完的 AI 局，重新排队 = 判负
  join(bo); const aesc = await got(bo.c, m => m.t === 'arena:match', 5000);
  const r2 = rating(bo); join(bo);
  const resc = await got(bo.c, m => m.t === 'arena:result' && m.id === (aesc && aesc.id));
  ok(resc && !resc.win && resc.why === 'escape' && rating(bo) < r2, 'AI 局没打完就重新排队：上一局判负', resc);
  bo.c.send({ t: 'arena:leave' }); await got(bo.c, m => m.t === 'arena:left');

  // ---- 退出队列 ----
  join(ca); await got(ca.c, m => m.t === 'arena:queued');
  ca.c.send({ t: 'arena:leave' });
  ok(!!(await got(ca.c, m => m.t === 'arena:left' && m.why === 'leave')) && !A.queue.has(ca.id), '退出队列');
  ok(!(await got(ca.c, m => m.t === 'arena:match', 2200)), '退出后不会再匹配到对手');
  // ---- 排队中断线 ----
  join(ca); await got(ca.c, m => m.t === 'arena:queued');
  ca.c.ws.close(); await sleep(300);
  ok(!A.queue.has(ca.id), '排队中断线：自动移出队列');
  await sleep(1800);
  ok(!app.ctx.db.get('SELECT id FROM arena_match WHERE a = ? OR b = ?', ca.id, ca.id), '断线的人没有被匹配');
  ca.c = await conn(ca.token);

  // ---- 开打后逃跑 = 判负 ----
  join(da); join(er);
  const md = await got(da.c, m => m.t === 'arena:match'); await got(er.c, m => m.t === 'arena:match');
  ok(md && !md.ai, 'dave 和 erin 匹配');
  await sleep(900); er.c.ws.close();
  const rf = await got(da.c, m => m.t === 'arena:result', 4000);
  ok(rf && rf.win && rf.why === 'forfeit' && rf.delta > 0, '开打后对方掉线超时：判对方逃跑，我方胜', rf);
  ok(app.ctx.db.get('SELECT result, winner FROM arena_match WHERE id = ?', md.id).winner === da.id && A.row(er.id, 'c1').lose === 1, '逃跑的一方记一场负');
  er.c = await conn(er.token);
  // ---- 开打前取消 = 不计 ----
  join(ca); join(er);
  const mc = await got(ca.c, m => m.t === 'arena:match'); await got(er.c, m => m.t === 'arena:match');
  await got(ca.c, m => m.t === 'room');
  ca.c.send({ t: 'room:close' });
  const rv = await got(er.c, m => m.t === 'arena:result'); await got(ca.c, m => m.t === 'arena:result');
  ok(mc && rv && rv.void && rv.why === 'cancel' && A.row(er.id, 'c1').lose === 1, '开打前取消：作废，不计胜负', rv);
  // ---- 双方结果对不上 = 作废 ----
  join(ca, 'mage'); join(da);
  const mx = await got(ca.c, m => m.t === 'arena:match'); await got(da.c, m => m.t === 'arena:match');
  ca.c.send({ t: 'arena:end', id: mx.id, win: true }); da.c.send({ t: 'arena:end', id: mx.id, win: true });
  const rx = await got(ca.c, m => m.t === 'arena:result');
  ok(rx && rx.void && rx.why === 'disputed', '双方都说自己赢：作废', rx);
  ca.c.send({ t: 'room:close', why: 'end' }); await sleep(100);
  // 只有一方报：等一会儿按它算
  join(bo); join(ca);
  const m1 = await got(bo.c, m => m.t === 'arena:match'); await got(ca.c, m => m.t === 'arena:match');
  bo.c.send({ t: 'arena:end', id: m1.id, win: true });
  const r1s = await got(ca.c, m => m.t === 'arena:result', 3000);
  ok(r1s && !r1s.win && !r1s.void && r1s.delta < 0, '只有一方报了结果：等一会儿按它结算', r1s);
  bo.c.send({ t: 'room:close', why: 'end' });

  // ---- AI 对手的职业池：只从客户端上报的已开放列表里抽（格斗家没开放时老职业玩家不会排到）----
  const F5 = ['fighter:', 'fighter:nenmaster', 'fighter:striker', 'fighter:brawler', 'fighter:grappler'];
  ok(aiPoolOf(undefined).length === 18 && aiPoolOf(undefined).every(([c]) => c !== 'fighter'), '老客户端（没带 pool）：原来的 18 种，不含格斗家', aiPoolOf(undefined).length);
  ok(aiPoolOf([...F5, 'sword:blade', 'bogus:x', 'fighter:nope']).length === 6 && aiPoolOf(['fighter:grappler']).every(([c, j]) => c === 'fighter' && j === 'grappler'), '带 pool：只认 AI_POOL 里有的“职业:转职”，其余忽略');
  ok(Object.values(AI_POOL).flat().length === 23 && AI_POOL.fighter.length === 5, 'AI_POOL 23 种（格斗家未转职 + 4 转职）');
  const seen = new Set();
  for (let i = 0; i < 6; i++) {
    da.c.send({ t: 'arena:join', cid: 'c1', char: { name: 'x' + da.id, cls: 'fighter', job: 'grappler' }, pool: F5 });
    const m = await got(da.c, x => x.t === 'arena:match', 5000); if (!m) break;
    seen.add(m.vs.cls + ':' + (m.vs.job || '')); await sleep(350); da.c.send({ t: 'arena:end', id: m.id, win: false }); await got(da.c, x => x.t === 'arena:result');
  }
  ok(seen.size >= 2 && [...seen].every(k => F5.includes(k)), `上报只开放格斗家：AI 对手都是格斗家（${[...seen].join(' / ')}）`, [...seen]);
  ok(A.row(da.id, 'c1').cls === 'fighter' && A.row(da.id, 'c1').job === 'grappler', '格斗家排位按上报的职业 / 转职记（不会记成鬼剑士）', A.row(da.id, 'c1'));

  // ---- 排行榜（rank 模块）+ 当天状态 ----
  const lb = await api('GET', '/api/rank?board=arena', null, bo.token);
  const L = lb.data.list || [];
  ok(lb.status === 200 && L.length >= 4 && L[0].uid === al.id && L[0].rating === 1600 && L[0].tier === '白金' && L.every((e, i) => !i || L[i - 1].rating >= e.rating), '决斗场排行榜：按积分排序，带段位', L.slice(0, 3));
  ok(lb.data.me.length === 1 && lb.data.me[0].uid === bo.id, '排行榜里有我的名次');
  const st = await api('GET', '/api/arena?cid=c1', null, al.token);
  ok(st.data.today.wins === 3 && st.data.today.first === 1 && st.data.today.cera === REWARD.cera * 3 && st.data.aiWin === 2 && st.data.win === 1, '今日胜场 / 点券 / 首胜记录', st.data);
  ok(tierOf(1099) === '青铜' && tierOf(1100) === '白银' && tierOf(1500) === '白金' && tierOf(2400) === '斗神', '段位划分');
} catch (e) { ok(false, '异常：' + (e.stack || e)); }
for (const u of Object.values(users)) try { u.c.ws.close(); } catch { /* */ }
await app.stop(); fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\n${n - fails}/${n} 通过`); process.exit(fails ? 1 : 0);
