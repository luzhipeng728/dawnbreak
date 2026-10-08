// 团本（server/modules/raid.js + src/game/raid_core.js）自测，不需要浏览器。时间用 cfg.raidShift 平移（不真等），计时靠手动 tick
// 规则核心：节点图（普通 / 引导）、每天 / 每周次数（周四 06:00 换周）、同一串事件在服务端 vm 和网页版脚本里结果一致（有 dist/web 构建时）
// 两人全流程：建团 / 加入 / 准备 / 开始扣次数 → 顺序节点（错序回满、没轮到提示）→ 并行的增益节点（跨节点 BUFF、重生）→ 复活次数 / 侵蚀 →
//   痛苦之镜到 0（重置苦难之境）→ 补位切换 → 无形之门 ×2（各打各的、门的队伍到领主房 → 幻影之城开放）→ 阶段奖励（幂等）→ 掉线重连 →
//   服务端重启（计时顺延、重组队伍）→ 讨伐战（扭曲 → 意识之棺虚弱、真理之棺共享血量 / 压抑旋转 / 忘却共鸣合并）→ 阴影之棺一起进 → 通关；作弊被拒；单人引导全流程（存档点）；练习 / 每周次数；过期大厅清理
//   官方规则的细节（共享时限、叠层、重置、合并、否定……）在 test/raid_siroco_rules.mjs
// 用法：node --disable-warning=ExperimentalWarning server/test/raid.mjs
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';
import { start } from '../index.js';
import { loadRaidCore } from '../modules/raid.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dnf-raid-'));
const opts = { db: path.join(tmp, 't.db'), invites: [], admins: [], graceMs: 600, raidShift: 0 };
let app = await start({ port: 0, ...opts });
app.ctx.log = () => {};
let fails = 0, n = 0;
const ok = (c, msg, x) => { n++; if (c) console.log('✓', msg); else { fails++; console.log('✗', msg, x !== undefined ? JSON.stringify(x).slice(0, 600) : ''); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const base = () => `http://127.0.0.1:${app.port}`;
const api = async (method, p, body, token) => { const r = await fetch(base() + p, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, data: await r.json().catch(() => ({})) }; };
function conn(token) {
  const ws = new WebSocket(`ws://127.0.0.1:${app.port}/ws`), inbox = [];
  const c = { ws, inbox, send: m => ws.send(JSON.stringify(m)),
    wait: (pred, ms = 3000) => new Promise((res, rej) => { const t0 = Date.now(); const tick = () => { const i = inbox.findIndex(pred); if (i >= 0) { res(inbox.splice(i, 1)[0]); return; } if (Date.now() - t0 > ms) { rej(new Error('等待超时')); return; } setTimeout(tick, 10); }; tick(); }) };
  ws.on('message', d => inbox.push(JSON.parse(d.toString())));
  return new Promise(res => ws.on('open', () => { c.send({ t: 'auth', token, ver: 1, build: 'test' }); c.wait(m => m.t === 'welcome').then(() => res(c)); }));
}
const got = (c, pred, ms) => c.wait(pred, ms).then(m => m, () => null);
const R = () => app.ctx.mods.raid;
const shift = ms => { app.ctx.cfg.raidShift += ms; };
const tick = () => R().tick();
const U = {};
const char = name => ({ name, cls: 'sword', job: 'blade', lvl: 60 });
async function user(name) {
  const r = await api('POST', '/api/register', { user: name, pass: 'secret1' });
  const u = { name, token: r.data.token, id: r.data.user.id };
  u.c = await conn(u.token); u.c.send({ t: 'hello', char: char(name + '角色') });
  return (U[name] = u);
}
async function reconnect(u) { u.c = await conn(u.token); u.c.send({ t: 'hello', char: char(u.name + '角色') }); return u.c; }
const drain = (...us) => { for (const u of us) u.c.inbox.length = 0; };
const S = u => R().of(u.id);
const Q = {};
async function ev(u, node, run, e, v, q) {
  const k = u.name + ':' + run, qq = q ?? (Q[k] = (Q[k] || 0) + 1);
  u.c.send({ t: 'raid:ev', node, run, q: qq, e, v });
  return got(u.c, m => m.t === 'raid:ack' && m.run === run && m.q === qq && m.e === e);
}
async function enter(u, node, w) {
  u.c.send({ t: 'raid:enter', node, with: w });
  return got(u.c, m => (m.t === 'raid:entered' && m.node === node) || (m.t === 'raid:note' && m.bad));
}
// 一个人打一个节点：进 → 过了最短通关时间 → 通关回营地
async function solo(u, node) {
  const e = await enter(u, node); if (!e || !e.run) return e;
  shift(21_000);
  const a = await ev(u, node, e.run, 'clear');
  return a && a.ok ? e : a;
}
// 结算后的翻牌是阶段边界：领奖后每名有奖励的队员都必须明确翻开并关闭自己的牌面，
// 才能开始下一阶段。服务端测试沿用客户端的 open → pick → close 顺序。
async function flip(c, sid, phase, index = 0) {
  c.send({ t: 'raid:flip', sid, phase, op: 'open' });
  const o = await got(c, m => m.t === 'raid:flip' && m.sid === sid && m.phase === phase && m.op === 'open');
  if (!o) return false;
  const count = phase === 1 ? 1 : 2;
  for (let i = 0; i < count; i++) {
    const card = index + i;
    c.send({ t: 'raid:flip', sid, phase, op: 'pick', index: card });
    const p = await got(c, m => m.t === 'raid:flip' && m.sid === sid && m.phase === phase && m.op === 'pick' && m.index === card);
    if (!p) return false;
  }
  c.send({ t: 'raid:flip', sid, phase, op: 'close' });
  return !!(await got(c, m => m.t === 'raid:flip' && m.sid === sid && m.phase === phase && m.op === 'close' && m.ok !== false));
}
async function party(a, b) {
  a.c.send({ t: 'party:invite', to: b.name }); const iv = await got(b.c, m => m.t === 'party:invited');
  b.c.send({ t: 'party:accept', from: iv.from.id });
  return got(a.c, m => m.t === 'party' && m.party && m.party.members.length === 2);
}

try {
  // ================= 规则核心（服务端 vm 加载的同一个文件）=================
  const K = loadRaidCore();
  const GN = K.graph('siroco', 'normal'), GG = K.graph('siroco', 'guide');
  ok(Object.keys(GN.phases[0].nodes).length === 16 && Object.keys(GN.phases[1].nodes).length === 15, '普通图：阻截战 16 个节点、讨伐战 15 个（官方全图）');
  ok(Object.keys(GG.phases[0].nodes).join() === 'law_a,wit_dawn,pain_mem,gate_l' && GG.phases[0].nodes.law_a.type === 'main' && GG.phases[0].nodes.gate_l.type === 'main'
    && GG.phases[0].nodes.wit_dawn.need.join() === 'law_a' && GG.phases[0].goal.join() === 'gate_l' && Object.keys(GG.phases[1].nodes).join() === 'sub_a,con_hall,coffin',
  '引导图：每层一个主线节点，顺序 / 同步节点变成主线，增益 / 倒计时节点去掉', Object.keys(GG.phases[0].nodes));
  const thu6 = Date.UTC(2026, 9, 1, 6) - 8 * 3600e3;   // 2026-10-01 是周四，北京时间 06:00
  ok(K.weekNo(thu6, 480) - K.weekNo(thu6 - 60e3, 480) === 1 && K.weekNo(thu6 - 60e3, 480) === K.weekNo(thu6 - 6 * 86400e3, 480) && K.dayNo(thu6, 480) - K.dayNo(thu6 - 60e3, 480) === 1,
    '每周四 06:00（北京时间）换周、每天 06:00 换日');
  let rec = null; const tt = thu6 + 3600e3;
  rec = K.consume('siroco', rec, tt, 480);
  const L1 = K.limits('siroco', rec, tt, 480);
  ok(rec && L1.dayLeft === 0 && L1.weekLeft === 1 && !L1.ok && K.consume('siroco', rec, tt, 480) === null, '一天 1 次：同一天第二次不扣（练习）', L1);
  rec = K.consume('siroco', rec, tt + 86400e3, 480);
  ok(rec && rec.wn === 2 && K.consume('siroco', rec, tt + 2 * 86400e3, 480) === null && K.limits('siroco', rec, tt + 2 * 86400e3, 480).weekLeft === 0, '一周 2 次：第三天没有次数了');
  ok(K.limits('siroco', rec, tt + 7 * 86400e3, 480).weekLeft === 2 && K.limits('siroco', rec, tt + 2 * 86400e3, 480).nextWeek === thu6 + 7 * 86400e3, '下周四 06:00 次数恢复（nextWeek 时间正确）');
  const r1 = K.rollReward(K.init('siroco', [{ uid: 1 }], 'guide', 0, { seed: 1 }), 1, 1, () => 0.99), r2 = K.rollReward(K.init('siroco', [{ uid: 1 }], 'normal', 0, { seed: 1 }), 1, 2, () => 0);
  ok(r1.cards.length === 2 && r1.cards[0].key === 'raid_petal' && r1.cards[0].n === 2 && r1.cards[1].key === 'raid_immaterial' && r1.cards[1].n === 2
    && r2.cards.length === 2 && r2.cards[0].key === 'raid_petal' && r2.cards[0].n === 12 && r2.cards[1].key === 'raid_immaterial' && r2.cards[1].n === 2,
  '奖励：P1 / P2 各含花瓣与独立材料；引导模式货币 ×0.6', [r1, r2]);

  // ================= 两人全流程 =================
  // 测试时钟固定到某个周四 18:00（北京时间）：后面按天 / 按周平移时，不会因为今天是几号而跨周
  app.ctx.cfg.raidShift = K.limits('siroco', null, Date.now(), 480).nextWeek + 12 * 3600e3 - Date.now();
  const [al, bo, ca, da] = [await user('alice'), await user('bobby'), await user('carol'), await user('dave')];
  await party(al, bo);
  const g0 = await api('GET', '/api/raid?cid=c1', null, al.token);
  ok(g0.status === 200 && g0.data.limits.dayLeft === 1 && g0.data.limits.weekLeft === 2 && !g0.data.run && g0.data.defs[0].id === 'siroco', 'GET /api/raid：本周 2 次、今天 1 次，没有进行中的团本', g0.data);
  bo.c.send({ t: 'raid:create', raid: 'siroco', mode: 'normal', cid: 'c1', char: char('小鲍') });
  ok(!!(await got(bo.c, m => m.t === 'raid:note' && /队长/.test(m.text))), '队员不能建团（只有队长）');
  al.c.send({ t: 'raid:create', raid: 'siroco', mode: 'normal', cid: 'c1', char: { ...char('阿丽'), lvl: 50 } });
  ok(!!(await got(al.c, m => m.t === 'raid:note' && /60 级/.test(m.text))), '等级不够 60 不能建团');
  al.c.send({ t: 'raid:create', raid: 'siroco', mode: 'normal', cid: 'c1', char: char('阿丽') });
  const c0 = await got(al.c, m => m.t === 'raid'), op = await got(bo.c, m => m.t === 'raid:open');
  const sid = c0 && c0.run.sid;
  ok(c0 && c0.run.st === 'lobby' && c0.run.leader === al.id && op && op.sid === sid, '队长建团（大厅），队友收到 raid:open', { c0, op });
  const gi = await api('GET', '/api/raid?cid=c1', null, bo.token);
  ok(gi.data.invite && gi.data.invite.sid === sid, 'GET /api/raid：队友能看到队长的团本邀请', gi.data.invite);
  bo.c.send({ t: 'raid:join', sid, cid: 'c1', char: char('小鲍') });
  ok(!!(await got(bo.c, m => m.t === 'raid' && m.run.members.length === 2)), '队友加入团本');
  al.c.send({ t: 'party:invite', to: 'dave' });
  ok(!!(await got(al.c, m => m.t === 'party:note' && /最多 2 人/.test(m.text))), '团本满 2 人：不能再邀请别人进队伍');
  al.c.send({ t: 'raid:start' });
  ok(!!(await got(al.c, m => m.t === 'raid:note' && m.code === 'ready')), '队友没准备：不能开始');
  bo.c.send({ t: 'raid:ready', on: true }); await sleep(50);
  bo.c.send({ t: 'raid:start' });
  ok(!!(await got(bo.c, m => m.t === 'raid:note' && m.code === 'leader')), '只有团长能开始');
  drain(al, bo);
  al.c.send({ t: 'raid:start' });
  const st1 = await got(bo.c, m => m.t === 'raid' && m.run.st === 'routes');
  ok(st1 && st1.run.graph === 'normal' && st1.run.lives === 6 && st1.run.phase === 1 && st1.run.nodes.law_a.st === 'open' && st1.run.nodes.wit_dawn.st === 'locked' && st1.run.members.every(m => m.rw), '开始：追逐战，普通图，全团 6 次复活，第一层开放', st1 && st1.run);
  const g1 = await api('GET', '/api/raid?cid=c1', null, al.token);
  ok(g1.data.limits.dayLeft === 0 && g1.data.limits.weekLeft === 1 && g1.data.run && g1.data.run.sid === sid, '开始时扣次数：今天 0 / 本周剩 1', g1.data.limits);
  al.c.send({ t: 'party:lead', id: bo.id });
  ok(!!(await got(al.c, m => m.t === 'party:note' && /团本/.test(m.text))), '团本进行中不能移交队长');
  al.c.send({ t: 'party:invite', to: 'dave' });
  ok(!!(await got(al.c, m => m.t === 'party:note' && /团本以外/.test(m.text))), '团本进行中不能邀请外人');

  // ---- 顺序节点（破坏之门 ×4，共享时限）----
  ok((await enter(al, 'wit_dawn')).code === 'locked', '作弊：没开放的节点进不去');
  ok((await enter(al, 'law_a', [bo.id])).code === 'solo', '必须分头的节点不能一起进');
  ok((await enter(al, 'nope')).code === 'node', '没有的节点进不去');
  const laws = ['law_a', 'law_b', 'law_c', 'law_d'].sort((x, y) => S(al).nodes[x].order - S(al).nodes[y].order);
  const ea = await enter(al, laws[0]), eb = await enter(bo, laws[1]);
  ok(ea && ea.run && eb && eb.run && ea.order === 1 && eb.order === 2 && ea.scale && ea.scale.lvl === 62 && S(al).glim.law && S(al).glim.law.until - R().now() > 590_000,
    '4 扇破坏之门各有一个顺序数字（1~4）；第一次有人进门开始 10 分钟共享时限', { ea, eb, glim: S(al).glim });
  ok((await enter(bo, laws[0])).code === 'busy', '已经在节点里：不能再进别的');
  const x1 = await ev(bo, laws[0], ea.run, 'down');
  ok(x1 && !x1.ok && (x1.code === 'notyours' || x1.code === 'run'), '作弊：给别人的挑战上报被拒', x1);
  const x2 = await ev(al, laws[0], ea.run, 'down');
  ok(x2 && !x2.ok && x2.code === 'fast', '作弊：进去马上报领主倒下（太快）被拒', x2);
  shift(21_000);
  const first = [al, ea, laws[0]], second = [bo, eb, laws[1]];
  drain(al, bo);
  await ev(second[0], second[2], second[1].run, 'hp', 0.05);
  ok(!!(await got(second[0].c, m => m.t === 'raid:note' && /还没轮到你/.test(m.text))), '数字大的一边血量压到 10% 以下：提示“还没轮到你”');
  const w1 = await ev(second[0], second[2], second[1].run, 'down');
  const h1 = await got(first[0].c, m => m.t === 'raid:fx' && m.kind === 'heal'), h2 = await got(second[0].c, m => m.t === 'raid:fx' && m.kind === 'heal');
  ok(w1 && w1.ok && w1.res === 'heal' && h1 && h2 && S(al).stats.penalties === 1, '错序：守门人回满血', { w1, h1, h2 });
  const d1 = await ev(first[0], first[2], first[1].run, 'down');
  ok(d1 && d1.ok && d1.res === 'clear' && !!(await got(first[0].c, m => m.t === 'raid:fx' && m.kind === 'done')), '数字小的先倒：通关');
  const d2 = await ev(second[0], second[2], second[1].run, 'down');
  ok(d2 && d2.ok && d2.res === 'clear', '轮到数字 2：通关');
  await ev(first[0], first[2], first[1].run, 'clear'); await ev(second[0], second[2], second[1].run, 'clear');
  const x3 = await ev(first[0], first[2], first[1].run, 'down');
  ok(x3 && !x3.ok && x3.code === 'ended', '一个节点只认一次结果：挑战结束后再报被拒', x3);
  const x4 = await ev(first[0], first[2], first[1].run, 'down', null, 1);
  ok(x4 && x4.ok && x4.dup, '重连补发的旧事件（序号重复）回 dup，不重复生效', x4);
  await solo(al, laws[2]); await solo(bo, laws[3]);
  ok(laws.every(id => S(al).nodes[id].st === 'cleared') && !S(al).glim.law && S(al).nodes.wit_dawn.st === 'open' && S(al).nodes.wit_night.st === 'locked' && S(al).members.every(m => m.at === 'camp'),
    '法则之境通关：梦幻之黎明开放（另外 3 张要等有人进黎明），两人回营地');

  // ---- 知性之境：进黎明打开另外 3 张；噩梦之夜没通关 → 哈妮尔每 30 秒叠攻防；复活次数、侵蚀 ----
  drain(al, bo);
  const ed = await enter(al, 'wit_dawn');
  ok(ed && ed.run && ed.limit - R().now() > 410_000 && ['wit_night', 'wit_phantom', 'wit_day'].every(id => S(al).nodes[id].st === 'open'), '进了黎明（单次限时 7 分钟）：噩梦之夜 / 幻影之界 / 归还之昼开放', ed);
  const en = await enter(bo, 'wit_night');
  ok(en && en.run && en.type === 'buff', '两人同时打两张图（黎明 + 噩梦之夜）');
  shift(30_500); tick();
  const bf = await got(al.c, m => m.t === 'raid:fx' && m.kind === 'buff' && m.node === 'wit_dawn' && m.p.id === 'night_haniel');
  ok(bf && bf.p.n === 1 && bf.p.p.atk === 0.05 && bf.p.p.def === 0.05 && bf.p.tick, '30 秒：黎明里的哈妮尔攻防 +10%（两人系数 ×0.5）', bf);
  const cn = await ev(bo, 'wit_night', en.run, 'clear');
  const ub = await got(al.c, m => m.t === 'raid:fx' && m.kind === 'unbuff' && m.p.id === 'night_haniel');
  ok(cn && cn.ok && ub && S(al).nodes.wit_night.st === 'cool', '噩梦之夜通关：叠层撤掉；进入重生（1:30）', cn);
  shift(91_000); tick();
  ok(S(al).nodes.wit_night.st === 'open', '90 秒后噩梦之夜重生（叠层重新开始算）');
  const en2 = await enter(bo, 'wit_night');
  const lives = [];
  for (let i = 0; i < 7; i++) { await ev(bo, 'wit_night', en2.run, 'revive'); lives.push(await got(bo.c, m => m.t === 'raid:fx' && m.kind === 'life')); }
  ok(lives.slice(0, 6).every((l, i) => l.p.ok && l.p.left === 5 - i) && !lives[6].p.ok && lives[6].p.why === 'pool' && S(al).lives === 0, '复活：用全团次数（6 次用完）；每人每张图上限 6（官方每队每图 6 枚复活币）', lives.map(l => l && l.p));
  await ev(bo, 'wit_night', en2.run, 'death');
  const ero = await got(bo.c, m => m.t === 'raid:fx' && m.kind === 'erosion');
  ok(ero && ero.p.until - R().now() > 55_000 && S(al).nodes.wit_night.st === 'open' && S(al).stats.deaths === 1, '倒下不能复活：回营地、侵蚀 60 秒，一个人打的节点重置', ero);
  ok((await enter(bo, 'wit_night')).code === 'erosion', '侵蚀中不能进节点');
  shift(61_000); tick();
  const en3 = await enter(bo, 'wit_night');
  ok(en3 && en3.run, '侵蚀结束后可以再进');
  await ev(bo, 'wit_night', en3.run, 'fail', 'retreat');
  ok(!!(await got(bo.c, m => m.t === 'raid:fx' && m.kind === 'erosion')), '撤退也算侵蚀');
  const dd = await ev(al, 'wit_dawn', ed.run, 'down');
  ok(dd && dd.ok && S(al).nodes.wit_dawn.st === 'cleared' && S(al).nodes.wit_night.st === 'off' && S(al).nodes.pain_mirror.timer > R().now() && S(al).nodes.pain_mirror2.timer > R().now(), '黎明通关：另外 3 张关闭，苦难之境开放、两面痛苦之镜开始 5 分钟倒计时');
  const x5 = await ev(al, 'wit_dawn', ed.run, 'down');
  ok(x5 && !x5.ok && x5.code === 'dup', '同一次挑战重复报倒下被拒', x5);
  await ev(al, 'wit_dawn', ed.run, 'clear');

  // ---- 痛苦之镜到 0、补位切换 ----
  const ep = await enter(al, 'pain_mem');
  const dl0 = S(al).deadline;
  drain(al, bo);
  shift(301_000); tick();
  const rm = await got(al.c, m => m.t === 'raid:fx' && m.kind === 'reset'), ck = await got(al.c, m => m.t === 'raid:fx' && m.kind === 'closed' && m.node === 'pain_mem');
  ok(ep && ep.run && rm && rm.p.area === 3 && ck && ck.p.why === 'reset' && S(al).deadline === dl0 && S(al).nodes.pain_mem.st === 'open' && S(al).nodes.pain_mirror.timer > R().now(),
    '没人压镜子、倒计时到 0：苦难之境Ⅰ 的进度重置（里面的人回营地），时间不退，镜子重新计时', { rm, ck });
  bo.c.ws.close(); await sleep(150);
  ok(!!(await got(al.c, m => m.t === 'raid:d' && m.set.members && m.set.members.some(x => x.uid === bo.id && !x.online))), '队友掉线：会话里显示离线');
  shift(181_000); tick();
  const sb = await got(al.c, m => m.t === 'raid:fx' && m.kind === 'sub');
  ok(sb && sb.p.on && S(al).sub && S(al).nodes.pain_mirror.timer === 0, '队友离线超过 3 分钟：切到补位规则（镜子暂停）', sb);
  await reconnect(bo);
  const rs = await got(bo.c, m => m.t === 'raid' && m.resume);
  tick();
  ok(rs && rs.run.sid === sid && rs.run.st === 'routes' && !S(al).sub && S(al).nodes.pain_mirror.timer > R().now() && !!(await got(al.c, m => m.t === 'raid:fx' && m.kind === 'sub' && !m.p.on)), '重连：自动恢复会话；补位关闭，镜子重新计时', rs && rs.run.st);
  const em = await solo(bo, 'pain_mirror');
  ok(em && em.run && S(al).nodes.pain_mirror.st === 'cool', '压镜子：通关后修复 90 秒');
  await solo(bo, 'pain_mirror2'); await solo(al, 'pain_mem'); await solo(bo, 'pain_mem2');
  ok(S(al).nodes.pain_mem.st === 'cleared' && S(al).nodes.pain_mem2.st === 'cleared' && S(al).nodes.gate_l.st === 'open' && S(al).nodes.gate_r.st === 'open' && S(al).nodes.castle_l.st === 'locked',
    '记忆的碎片 + 碎片的记忆通关：无形之门 ×2 开放（幻影之城还没开）');

  // ---- 无形之门 ×2：各打各的（官方没有同时击杀窗口）；门的队伍到领主房 → 幻影之城开放 ----
  drain(al, bo);
  const gl = await enter(al, 'gate_l'), gr = await enter(bo, 'gate_r');
  const bs = await ev(al, 'gate_l', gl.run, 'boss');
  ok(bs && bs.ok && S(al).nodes.castle_l.st === 'open' && S(al).nodes.castle_r.st === 'locked', '门 1 的队伍到领主房（boss 事件）：幻影之城开放', bs);
  const bsx = await ev(al, 'gate_l', gr.run, 'boss');
  ok(bsx && !bsx.ok, '作弊：替别人的挑战报到领主房被拒', bsx);
  shift(21_000);
  await ev(al, 'gate_l', gl.run, 'hp', 0.4); await ev(bo, 'gate_r', gr.run, 'hp', 0.8);
  ok(gl.type === 'main' && gr.type === 'main' && !S(al).buffs.some(b => b.id === 'twin_guard'), '两扇门都是普通主线：血量差多大都不减伤', S(al).buffs);
  const gd = await ev(al, 'gate_l', gl.run, 'down');
  ok(gd && gd.ok && gd.res === 'clear' && S(al).nodes.gate_l.st === 'cleared' && S(al).nodes.castle_l.st === 'off' && S(al).st === 'routes', '维塔倒下就通关（不等另一边），幻影之城关闭', gd);
  drain(al, bo); shift(31_000); tick();
  ok(S(al).nodes.gate_l.st === 'cleared', '过了 30 秒也不会复活');
  const sy = await ev(bo, 'gate_r', gr.run, 'down');
  const ph1 = await got(al.c, m => m.t === 'raid:fx' && m.kind === 'phase' && m.p.ok);
  ok(sy && sy.ok && sy.res === 'clear' && ph1 && ph1.p.phase === 1 && S(al).st === 'rest' && S(al).res.phases[0] === 1, '两扇门都通关 → 阻截战完成，进入休整', { sy, ph1 });
  await ev(al, 'gate_l', gl.run, 'clear'); await ev(bo, 'gate_r', gr.run, 'clear');
  // ---- 阶段奖励（幂等）----
  al.c.send({ t: 'raid:claim', sid, phase: 2 });
  ok(!!(await got(al.c, m => m.t === 'raid:note' && m.code === 'claim')), '没通关的阶段不能领奖');
  al.c.send({ t: 'raid:claim', sid, phase: 1 });
  const cl1 = await got(al.c, m => m.t === 'raid:claimed');
  al.c.send({ t: 'raid:claim', sid, phase: 1 });
  const cl2 = await got(al.c, m => m.t === 'raid:claimed');
  ok(cl1 && !cl1.dup && cl1.reward.cards[0].key === 'raid_petal' && cl1.reward.cards[0].n >= 3 && cl1.reward.cards[0].n <= 4 && cl2 && cl2.dup && JSON.stringify(cl2.reward) === JSON.stringify(cl1.reward)
    && app.ctx.db.get('SELECT COUNT(*) AS n FROM raid_claim').n === 1, '领 P1 奖励（3~4 花瓣）；重复领返回同一份、不重复发', { cl1, cl2 });
  bo.c.send({ t: 'raid:claim', sid, phase: 1 });
  const cl1b = await got(bo.c, m => m.t === 'raid:claimed' && m.sid === sid && m.phase === 1);
  const flipA1 = await flip(al.c, sid, 1), flipB1 = await flip(bo.c, sid, 1);
  ok(cl1b && !cl1b.dup && flipA1 && flipB1, '两名队员分别完成 P1 翻牌后才解除阶段门禁', { cl1b, flipA1, flipB1 });

  // ---- 服务端重启：会话从库里读回来，计时按停机时长顺延；队伍要重组 ----
  const left0 = S(al).restUntil - R().now();
  al.c.ws.close(); bo.c.ws.close(); await sleep(100);
  await app.stop();
  app.ctx.cfg.raidShift += 60_000;
  app = await start({ port: 0, ...opts, raidShift: app.ctx.cfg.raidShift });
  app.ctx.log = () => {};
  await reconnect(al); await reconnect(bo); await reconnect(ca); await reconnect(da);
  const ra = await got(al.c, m => m.t === 'raid' && m.resume), rb2 = await got(bo.c, m => m.t === 'raid' && m.resume);
  const left1 = S(al).restUntil - R().now();
  ok(ra && rb2 && ra.run.sid === sid && ra.run.st === 'rest' && Math.abs(left1 - left0) < 3000, `重启后自动恢复（停机 60 秒，休整还剩 ${Math.round(left1 / 1000)} 秒，和停机前一样）`, { left0, left1 });
  ok(!!(await party(al, bo)), '重启后队伍没了：团本成员之间可以重新组队');
  al.c.send({ t: 'party:invite', to: 'dave' });
  ok(!!(await got(al.c, m => m.t === 'party:note' && /团本以外/.test(m.text))), '重启后仍然不能邀请外人');

  // ---- 讨伐战 ----
  drain(al, bo);
  al.c.send({ t: 'raid:start' });
  const p2 = await got(bo.c, m => m.t === 'raid' && m.run.phase === 2);
  ok(p2 && p2.run.st === 'routes' && p2.run.lives === 6 && p2.run.nodes.sub_a.st === 'open' && p2.run.rot && p2.run.rot.forms.length === 3, '团长提前结束休整：讨伐战开始（复活次数重置，真理之棺有旋转形态）', p2 && p2.run);
  await Promise.all([solo(al, 'sub_a'), solo(bo, 'sub_b')]); await Promise.all([solo(al, 'sub_c'), solo(bo, 'sub_d')]);
  ok(['con_hall', 'con_hall2', 'con_mut', 'con_mut2'].every(id => S(al).nodes[id].st === 'open'), '4 个无欲之棺分头通关 → 第 2 界开放');
  drain(al, bo);
  const ch = await enter(al, 'con_hall'), cm = await enter(bo, 'con_mut');
  await ev(al, 'con_hall', ch.run, 'boss');
  shift(21_000);
  await ev(bo, 'con_mut', cm.run, 'clear');
  const gg = await got(al.c, m => m.t === 'raid:fx' && m.kind === 'groggy');
  ok(gg && gg.node === 'con_hall' && gg.p.dur === 10 && gg.p.p.weak === 1, '扭曲的无欲之棺通关 → 意识之棺 1 的希洛克虚弱 10 秒（那边已到领主房）', gg);
  await ev(al, 'con_hall', ch.run, 'clear'); await solo(bo, 'con_hall2');
  ok(['truth_a', 'truth_b', 'truth_c'].every(id => S(al).nodes[id].st === 'open') && S(al).nodes.coffin.st === 'locked' && S(al).st === 'routes', '意识之棺 ×2 通关：真理的意识之棺 ×3 开放（阴影之棺还关着）');

  // ---- 第 1 界：共享血量、压抑旋转、忘却共鸣 → 阴影之棺 ----
  drain(al, bo);
  const ta = await enter(al, 'truth_a');
  ok(ta && ta.run && ta.pool && ta.pool.hp === 1 && ta.form && /^raid_si_truth_/.test(ta.dg), '真理之棺 1：共享血量 100%，按旋转进对应形态', ta);
  await ev(al, 'truth_a', ta.run, 'boss');
  ok(['deny', 'suppress', 'forget'].every(id => S(al).nodes[id].st === 'open'), '遇到希洛克：否定 / 压抑 / 忘却开放');
  shift(15_000);
  await ev(al, 'truth_a', ta.run, 'hp', 0.7);
  const tb = await enter(bo, 'truth_b');
  ok(tb && tb.hpStart === 0.7, '另一边进来：血量接着共享的 70%', tb);
  shift(5_000); drain(al, bo);
  await ev(bo, 'truth_b', tb.run, 'hp', 0.6);
  const ps = await got(al.c, m => m.t === 'raid:fx' && m.kind === 'pool');
  ok(ps && Math.abs(ps.p.d + 0.1) < 1e-6, '乙打掉的 10% 同步给甲（差值推送）', ps);
  await ev(bo, 'truth_b', tb.run, 'fail', 'retreat');
  const pr2 = await got(al.c, m => m.t === 'raid:fx' && m.kind === 'pool');
  ok(pr2 && Math.abs(pr2.p.d - 0.1) < 1e-6 && Math.abs(S(al).pools.truth.hp - 0.7) < 1e-6, '乙撤退：这次的伤害退回', pr2);
  shift(61_000); tick();
  for (let k = 0; k < 3 && S(al).rot !== 0; k++) { shift(31_000); tick(); await solo(bo, 'suppress'); }
  ok(S(al).rot === 0, '压抑转到共鸣位置', S(al).rot);
  drain(al, bo);
  await solo(bo, 'forget');
  const mg = await got(al.c, m => m.t === 'raid:fx' && m.kind === 'closed' && m.node === 'truth_a');
  ok(mg && mg.p.why === 'merge' && S(al).nodes.coffin.st === 'open' && S(al).st === 'final', '共鸣时通关忘却：真理之棺里的人被收回营地，阴影之棺开 60 秒', mg);
  ok((await enter(al, 'coffin')).code === 'together', '阴影之棺要两人一起进');
  ok((await enter(bo, 'coffin', [al.id])).code === 'party', '一起进要由队长带队');
  drain(al, bo);
  const f1 = await enter(al, 'coffin', [bo.id]), f1b = await got(bo.c, m => m.t === 'raid:entered' && m.node === 'coffin');
  ok(f1 && f1.run && f1b && f1b.run === f1.run && f1.host === al.id && f1.by.length === 2 && f1.scale.lvl === 64 && f1.hpStart === 0.7 && f1.buffs.some(b => b.id === 'shadow_weak') && f1.dg === 'raid_si_shadow',
    '队长带队一起进阴影之棺：血量接着共享的 70%，希洛克一进门就虚弱', f1);
  const cpx = await ev(al, 'coffin', f1.run, 'cp', { hp: 0.3, ph: 1 });
  ok(cpx && !cpx.ok && cpx.code === 'bad', '阴影之棺没有存档点（共享血量就是进度）', cpx);
  const hb = await ev(bo, 'coffin', f1.run, 'hp', 0.2);
  ok(hb && !hb.ok && hb.code === 'host', '只有主机能报血量', hb);
  shift(10_000);
  await ev(al, 'coffin', f1.run, 'hp', 0.3);
  ok(Math.abs(S(al).pools.truth.hp - 0.3) < 1e-6, '共享血量 70% → 30%');
  shift(10_000);
  drain(al, bo);
  const fd = await ev(al, 'coffin', f1.run, 'hp', 0);
  const endA = await got(al.c, m => m.t === 'raid:end'), endB = await got(bo.c, m => m.t === 'raid:end');
  ok(fd && fd.ok && endA && endA.ok && endA.why === 'clear' && endB && endB.ok && S(al) === null, '共享血量打空：团本通关，两人都收到 raid:end', { fd, endA });
  al.c.send({ t: 'raid:claim', sid, phase: 2 });
  const cp2a = await got(al.c, m => m.t === 'raid:claimed' && m.sid === sid && m.phase === 2);
  bo.c.send({ t: 'raid:claim', sid, phase: 2 });
  const cp2 = await got(bo.c, m => m.t === 'raid:claimed');
  ok(cp2a && cp2 && cp2.reward.cards.length === 2 && cp2.limits.weekLeft === 1, '通关后两名队员都能领取 P2 奖励（翻 2 张），带本周剩余次数', { cp2a, cp2 });
  const flipA2 = await flip(al.c, sid, 2, 0), flipB2 = await flip(bo.c, sid, 2, 0);
  ok(flipA2 && flipB2, '两名队员完成 P2 翻牌后结算锁解除', { flipA2, flipB2 });
  al.c.send({ t: 'raid:resume', sid });
  const rr = await got(al.c, m => m.t === 'raid' && m.run.st === 'cleared');
  const rclaim = await got(al.c, m => m.t === 'raid:claimed' && m.phase === 2);
  const rflip = await got(al.c, m => m.t === 'raid:flip' && m.phase === 2 && m.op === 'resume');
  const rend = await got(al.c, m => m.t === 'raid:end' && m.ok);
  ok(rr && rclaim && rflip && rflip.closed && (rflip.picks || []).length === 2 && rend, '结束后 raid:resume 补发领奖与已选 / 已关闭牌面，刷新可继续或确认结算', { rr, rclaim, rflip, rend });
  const row = app.ctx.db.get('SELECT st FROM raid_run WHERE sid = ?', sid);
  ok(row && row.st === 'cleared', '会话结果存在库里（raid_run）');

  // ================= 单人引导 =================
  ca.c.send({ t: 'raid:create', raid: 'siroco', mode: 'guide', cid: 'k1', char: char('卡萝') });
  await got(ca.c, m => m.t === 'raid');
  drain(ca);
  ca.c.send({ t: 'raid:start' });
  const gs = await got(ca.c, m => m.t === 'raid' && m.run.st === 'routes');
  ok(gs && gs.run.graph === 'guide' && gs.run.lives === 3 && Object.keys(gs.run.nodes).join() === 'law_a,wit_dawn,pain_mem,gate_l', '单人引导：引导图（每层一个节点），全团 3 次复活', gs && gs.run);
  const e1 = await enter(ca, 'law_a');
  ok(e1 && e1.type === 'main' && e1.order === 0 && e1.scale.guide && e1.scale.hp === 0.85 && e1.scale.mech === 0.6 && !e1.scale.penalty, '引导：守门人没有顺序；怪物 ×0.85、机制 ×0.6、没有跨队惩罚', e1);
  await ev(ca, 'law_a', e1.run, 'death');
  const e2 = await got(ca.c, m => m.t === 'raid:fx' && m.kind === 'erosion');
  ok(e2 && e2.p.until - R().now() <= 10_000 && e2.p.until - R().now() > 5_000, '引导模式侵蚀只有 10 秒', e2);
  shift(11_000); tick();
  for (const nd of ['law_a', 'wit_dawn', 'pain_mem']) await solo(ca, nd);
  const gl1 = await solo(ca, 'gate_l');
  ok(gl1 && gl1.run && gl1.dg === 'raid_si_gate_duo' && S(ca).st === 'rest', '引导：无形之门是一个房间的双领主，打完追逐战完成');
  ca.c.send({ t: 'raid:claim', sid: gs.run.sid, phase: 1 });
  const gcl1 = await got(ca.c, m => m.t === 'raid:claimed' && m.sid === gs.run.sid && m.phase === 1);
  const gflip1 = await flip(ca.c, gs.run.sid, 1);
  ok(gcl1 && gflip1, '引导阶段完成 P1 翻牌后才能进入讨伐战', { gcl1, gflip1 });
  ca.c.send({ t: 'raid:start' }); await got(ca.c, m => m.t === 'raid' && m.run.phase === 2);
  await solo(ca, 'sub_a'); await solo(ca, 'con_hall');
  const fc = await enter(ca, 'coffin');
  ok(fc && fc.run && fc.scale.lvl === 64 && fc.dg === 'raid_si_coffin' && !fc.pool, '引导：最终战一个人进（真理的意识之棺，没有共享血量）', fc);
  shift(10_000);
  const gcpx = await ev(ca, 'coffin', fc.run, 'cp', { hp: 0.3, ph: 1 });
  ok(gcpx && !gcpx.ok && gcpx.code === 'fast', '作弊：10 秒掉 70% 血的存档点被拒', gcpx);
  const gcpo = await ev(ca, 'coffin', fc.run, 'cp', { hp: 0.6, ph: 1 });
  ok(gcpo && gcpo.ok && S(ca).cp.coffin.hp === 0.6 && S(ca).cp.coffin.ph === 1, '主机每 3 秒报领主血量和阶段（存档点）');
  await ev(ca, 'coffin', fc.run, 'fail', 'lost');
  const fc2 = await enter(ca, 'coffin');
  ok(fc2 && fc2.run && fc2.cp && fc2.cp.hp === 0.6 && fc2.hpStart === 0.6, '房间断了重进：领主从存档点（60%、第 2 阶段）开始', fc2);
  shift(13_000); drain(ca);
  await ev(ca, 'coffin', fc2.run, 'down');
  ok(!!(await got(ca.c, m => m.t === 'raid:end' && m.ok)), '单人引导通关');
  ca.c.send({ t: 'raid:claim', sid: gs.run.sid, phase: 1 });
  const gc = await got(ca.c, m => m.t === 'raid:claimed');
  ok(gc && gc.reward.cards[0].n === 2, '引导奖励：货币 ×0.6（3~4 → 2）', gc && gc.reward);

  // ================= 练习 / 每周次数 =================
  const guideRun = async u => {
    u.c.send({ t: 'raid:create', raid: 'siroco', mode: 'guide', cid: 'c1', char: char('x') }); await got(u.c, m => m.t === 'raid');
    drain(u); u.c.send({ t: 'raid:start' });
    return got(u.c, m => m.t === 'raid' && m.run.st === 'routes');
  };
  const pr = await guideRun(al);
  ok(pr && pr.run.members[0].rw === false && !!(await got(al.c, m => m.t === 'raid:note' && /练习/.test(m.text))), '今天的次数用完了还能进：这次是练习');
  for (const nd of ['law_a', 'wit_dawn', 'pain_mem', 'gate_l']) await solo(al, nd);
  al.c.send({ t: 'raid:claim', sid: pr.run.sid, phase: 1 });
  ok(!!(await got(al.c, m => m.t === 'raid:note' && m.code === 'practice')), '练习：阶段通关了也不能领奖');
  al.c.send({ t: 'raid:leave' }); await got(al.c, m => m.t === 'raid:end');
  shift(86_400_000);
  const d2r = await guideRun(al);
  ok(d2r && d2r.run.members[0].rw === true, '第二天：本周第 2 次，有奖励');
  al.c.send({ t: 'raid:leave' });
  ok(!!(await got(al.c, m => m.t === 'raid:end' && m.why === 'left')), '中途离开 = 放弃（次数照扣）');
  shift(86_400_000);
  const g3 = await api('GET', '/api/raid?cid=c1', null, al.token);
  ok(g3.data.limits.dayLeft === 1 && g3.data.limits.weekLeft === 0 && !g3.data.limits.ok, '第三天：今天有、但本周 2 次用完了', g3.data.limits);
  const d3r = await guideRun(al);
  ok(d3r && d3r.run.members[0].rw === false, '本周用完：练习');
  al.c.send({ t: 'raid:leave' }); await got(al.c, m => m.t === 'raid:end');
  shift(g3.data.limits.nextWeek - R().now() + 1000);
  const g4 = await api('GET', '/api/raid?cid=c1', null, al.token);
  ok(g4.data.limits.weekLeft === 2 && g4.data.limits.dayLeft === 1, '下周四 06:00：次数恢复', g4.data.limits);
  const g5 = await api('GET', '/api/raid?cid=c2', null, al.token);
  ok(g5.data.limits.weekLeft === 2, '次数按角色（另一个角色不受影响）');

  // ================= 过期大厅清理 =================
  da.c.send({ t: 'raid:create', raid: 'siroco', mode: 'guide', cid: 'd1', char: char('戴夫') });
  await got(da.c, m => m.t === 'raid');
  shift(31 * 60_000); tick();
  ok(!!(await got(da.c, m => m.t === 'raid:end' && m.why === 'stale')) && !R().of(da.id), '30 分钟没人开始的大厅：自动关闭');

  // ================= 同一串事件：服务端 vm 和网页版脚本结果一致 =================
  const script = K2 => {
    const out = []; let t = 1_800_000_000_000;
    const S2 = K2.init('siroco', [{ uid: 1, cid: 'a', name: 'A' }], 'normal', t, { sid: 'det', seed: 7 });
    const E = (ev2, dt) => { t += dt || 0; const o = K2.event(S2, ev2, t); out.push(JSON.stringify([o.err, o.ack, o.fx])); return o; };
    const T = dt => { t += dt; out.push(JSON.stringify(K2.tick(S2, t).fx)); };
    E({ t: 'join', uid: 2, cid: 'b', name: 'B' }); E({ t: 'ready', uid: 2 }); E({ t: 'start', uid: 1 });
    const laws = ['law_a', 'law_b', 'law_c', 'law_d'].sort((x, y) => S2.nodes[x].order - S2.nodes[y].order);
    const a = E({ t: 'enter', uid: 1, node: laws[0] }).ack.run, b = E({ t: 'enter', uid: 2, node: laws[1] }).ack.run;
    E({ t: 'down', uid: 2, node: laws[1], run: b, q: 1 }, 25_000); E({ t: 'down', uid: 1, node: laws[0], run: a, q: 2 }, 1000);
    E({ t: 'clear', uid: 1, node: laws[0], run: a, q: 3 }); E({ t: 'down', uid: 2, node: laws[1], run: b, q: 4 }); E({ t: 'clear', uid: 2, node: laws[1], run: b, q: 5 });
    for (const [u, id] of [[1, laws[2]], [2, laws[3]]]) { const r = E({ t: 'enter', uid: u, node: id }).ack.run; E({ t: 'clear', uid: u, node: id, run: r, q: 1 }, 21_000); }
    const d = E({ t: 'enter', uid: 1, node: 'wit_dawn' }).ack.run, nn = E({ t: 'enter', uid: 2, node: 'wit_night' }).ack.run;
    T(31_000); E({ t: 'revive', uid: 2, node: 'wit_night', run: nn }); E({ t: 'clear', uid: 2, node: 'wit_night', run: nn });
    T(100_000); E({ t: 'online', uid: 2, on: false }); T(190_000); E({ t: 'clear', uid: 1, node: 'wit_dawn', run: d });
    out.push(JSON.stringify(K2.view(S2)));
    return out;
  };
  const vmOut = script(K);
  ok(vmOut.length > 15 && !vmOut.some(s => s.includes('"code"')) && JSON.parse(vmOut[vmOut.length - 1]).nodes.pain_mem.st === 'open', '固定事件脚本在服务端 vm 里跑通（顺序、跨图叠层、复活、补位）', vmOut.find(s => s.includes('"code"')));
  const page = path.join(ROOT, 'dist', 'web', 'index.html');
  const html = fs.existsSync(page) ? fs.readFileSync(page, 'utf8') : '';
  if (html.includes('RAID_CORE')) {
    const { webContext } = await import(path.join(ROOT, 'tools', 'item_catalog.mjs'));
    const js = html.slice(html.indexOf('"use strict"'), html.lastIndexOf('</script>')).replace(/<\\\/script/gi, '</script');
    const W = vm.runInContext('RAID_CORE', webContext(js));
    const webOut = script(W);
    ok(webOut.length === vmOut.length && webOut.every((s, i) => s === vmOut[i]), `网页版脚本（dist/web，全部游戏代码一起加载）里的 RAID_CORE 跑同一串事件：${webOut.length} 步结果完全一致`,
      webOut.findIndex((s, i) => s !== vmOut[i]));
  } else console.log('（跳过网页版一致性：dist/web/index.html 里还没有 raid_core，先 node build.mjs --web）');
} catch (e) { ok(false, '异常：' + (e.stack || e)); }
for (const u of Object.values(U)) try { u.c.ws.close(); } catch { /* 已关闭 */ }
await app.stop(); fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\n${n - fails}/${n} 通过`); process.exit(fails ? 1 : 0);
