// 后台管理接口自测（不需要浏览器）：权限（每个新接口：没登录 401、普通玩家 403）、账号列表 / 搜索 / 排序 / 详情、封禁 / 解封、踢下线、重设密码、
// 软删除（输入用户名确认 + 自动备份）/ 恢复、注册记录（同 IP 标记）、GM 邮件（点券自动拆封 / 预览 / 批次防重复 / 物品 @强化 / key 校验 / 全体不含封禁）、
// 邮件历史领取进度、客户端报错、操作日志、/admin 页面的安全头、限流
// 用法：node --disable-warning=ExperimentalWarning server/test/admin.mjs
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import WebSocket from 'ws';
import { start } from '../index.js';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dnf-admin-'));
const catalog = path.join(tmp, 'catalog.json');
fs.writeFileSync(catalog, JSON.stringify({ id: 'testbuild', items: [['fatigue', '抗疲劳秘药', 1, 'use', '', 1, '', null], ['katana_60_5', '测试太刀', 5, 'equip', 'weapon', 60, 'sword', null]], classes: { fighter: { name: '格斗家', jobs: { striker: '散打' } } } }));
const app = await start({ port: 0, db: path.join(tmp, 't.db'), admins: ['alice'], catalog, httpRate: [100000, 10], graceMs: 500 });
app.ctx.log = () => {};
const BASE = `http://127.0.0.1:${app.port}`;
let fails = 0, n = 0;
const ok = (c, msg, x) => { n++; if (c) console.log('✓', msg); else { fails++; console.log('✗', msg, x !== undefined ? JSON.stringify(x).slice(0, 400) : ''); } };
const api = async (method, p, body, token) => {
  const r = await fetch(BASE + p, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, ...(await r.json().catch(() => ({}))) };
};
const login = async (user, pass = 'secret1') => api('POST', '/api/login', { user, pass });
const sleep = ms => new Promise(r => setTimeout(r, ms));

try {
  const T = {};
  for (const u of ['alice', 'bob', 'carol', 'dave']) T[u] = (await api('POST', '/api/register', { user: u, pass: 'secret1' })).token;
  const id = {};
  for (const u of ['alice', 'bob', 'carol', 'dave']) id[u] = app.ctx.findUser(u).id;
  const A = (m, p, b) => api(m, p, b, T.alice);
  await api('PUT', '/api/saves', { baseUpdatedAt: 0, data: { v: 4, cur: 0, acct: { cera: 1234 }, chars: [
    { cls: 'fighter', job: 'striker', name: '拳王', lvl: 45, gold: 5000, inv: [{ key: 'fatigue', n: 3 }], storage: [], equip: { weapon: { key: 'boxing_45', name: '冠军拳套', rar: 5, enh: 12 } } },
    { cls: 'sword', job: null, name: '小剑', lvl: 12, gold: 100, inv: [], equip: {} }] } }, T.bob);
  await api('PUT', '/api/saves', { baseUpdatedAt: 0, data: { v: 4, cur: 0, chars: [{ cls: 'gun', job: 'ranger', name: '枪手', lvl: 60, gold: 99, inv: [], equip: {} }] } }, T.carol);

  // ---- 权限：每个新接口 ----
  const ENDPOINTS = [['GET', '/api/gm/stats'], ['GET', '/api/gm/users'], ['GET', `/api/gm/users/${id.bob}`], ['GET', '/api/gm/regs'], ['GET', '/api/gm/mails'], ['GET', '/api/gm/cerr'],
    ['POST', `/api/gm/users/${id.carol}/ban`, { on: true }], ['POST', `/api/gm/users/${id.carol}/logout`], ['POST', `/api/gm/users/${id.carol}/password`, { pass: 'hacked1' }],
    ['POST', `/api/gm/users/${id.carol}/delete`, { confirm: 'carol' }], ['POST', `/api/gm/users/${id.carol}/undelete`], ['POST', '/api/gm/mail', { to: '*', title: 'x', cera: 1 }],
    ['GET', '/api/gm/logs'], ['GET', '/api/gm/online'], ['POST', '/api/gm/notice', { text: 'x' }]];
  const s403 = [], s401 = [];
  for (const [m, p, b] of ENDPOINTS) { if ((await api(m, p, b, T.bob)).status !== 403) s403.push(p); if ((await api(m, p, b)).status !== 401) s401.push(`${m} ${p}`); }
  ok(!s403.length, `普通玩家调 ${ENDPOINTS.length} 个后台接口全部 403`, s403);
  ok(!s401.length, `没登录调后台接口全部 401`, s401);
  ok((await login('carol')).status === 200, '普通玩家的越权请求没有生效（carol 还能登录）');

  // ---- 账号列表 / 详情 ----
  let r = await A('GET', '/api/gm/users');
  ok(r.total === 4 && r.list.length === 4, '管理员能看账号列表', r.total);
  const bobRow = r.list.find(u => u.name === 'bob');
  ok(bobRow && bobRow.cera === 1234 && bobRow.gold === 5100 && bobRow.maxlv === 45 && bobRow.chars.length === 2 && bobRow.regIp === '127.0.0.1', '列表里有角色 / 点券 / 金币 / 注册 IP', bobRow);
  ok((await A('GET', '/api/gm/users?q=' + encodeURIComponent('拳王'))).list.map(u => u.name).join() === 'bob', '按角色名搜索');
  ok((await A('GET', '/api/gm/users?q=car')).list.map(u => u.name).join() === 'carol', '按用户名搜索');
  ok((await A('GET', `/api/gm/users?q=%23${id.dave}`)).list.map(u => u.name).join() === 'dave', '按 #ID 搜索');
  ok((await A('GET', '/api/gm/users?sort=gold&dir=desc')).list[0].name === 'bob', '按金币排序');
  r = await A('GET', '/api/gm/users?size=5&page=1&sort=name&dir=asc');
  ok(r.list[0].name === 'alice' && r.pages === 1, '按用户名排序 + 分页', r.list.map(u => u.name));
  r = await A('GET', `/api/gm/users/${id.bob}`);
  ok(r.user.name === 'bob' && r.save.chars[0].cls === 'fighter' && r.save.chars[0].equip[0].name === '冠军拳套' && r.save.chars[0].equip[0].enh === 12 && r.save.chars[0].invN === 3, '账号详情：角色 / 装备 / 背包', r.save);
  ok(r.sessions.length >= 1 && r.sessions[0].ip && r.user.regIp === '127.0.0.1', '账号详情：登录会话 + IP', r.sessions);
  ok((await A('GET', '/api/gm/users/99999')).status === 404 && (await A('GET', '/api/gm/users/abc')).status === 404, '不存在的账号 404');

  // ---- 概况 / 注册记录 ----
  r = await A('GET', '/api/gm/stats');
  ok(r.users.total === 4 && r.users.today === 4 && r.regs.length === 30 && r.jobs.some(j => j.cls === 'fighter' && j.job === 'striker') && r.chars === 3, '概况：注册数 / 今日新增 / 职业分布（含格斗家）', { users: r.users, jobs: r.jobs });
  ok(r.server.ver >= 1 && r.server.web === 'testbuild' && r.server.items === 2 && r.server.uptime >= 0, '概况：服务器版本 / 物品目录', r.server);
  r = await A('GET', '/api/gm/regs?days=1');
  ok(r.list.length === 4 && r.list.every(x => x.ip === '127.0.0.1' && x.flag && x.sameIp === 4), '注册记录：注册 IP + 同 IP 标记', r.list.map(x => [x.name, x.ip, x.sameIp]));
  ok(r.ips[0].ip === '127.0.0.1' && r.ips[0].n === 4 && r.ips[0].flag, '同一个 IP 注册多个账号的汇总', r.ips);
  ok(r.list.find(x => x.name === 'bob').char.name === '拳王', '注册记录：第一个角色');

  // ---- 封禁 / 解封 ----
  const ws = new WebSocket(`ws://127.0.0.1:${app.port}/ws`), inbox = [];
  ws.on('message', d => inbox.push(JSON.parse(d.toString())));
  const wsClosed = new Promise(res => ws.on('close', code => res(code)));
  await new Promise(res => ws.on('open', res)); ws.send(JSON.stringify({ t: 'auth', token: T.bob, ver: 1 }));
  for (let i = 0; i < 40 && !inbox.some(m => m.t === 'welcome'); i++) await sleep(25);
  r = await A('POST', `/api/gm/users/${id.bob}/ban`, { on: true, reason: '测试封禁' });
  ok(r.ok && r.banned, '封禁 bob');
  ok((await api('GET', '/api/me', null, T.bob)).status === 401, '封禁后旧 token 失效');
  ok(await Promise.race([wsClosed, sleep(2000).then(() => 0)]) === 4004 && inbox.some(m => m.t === 'kicked'), '封禁后在线的连接被踢（4004）');
  ok((await login('bob')).status === 403, '封禁后不能登录');
  ok((await A('GET', '/api/gm/users?filter=banned')).list.map(u => u.name).join() === 'bob', '只看封禁');
  ok((await A('POST', `/api/gm/users/${id.bob}/ban`, { on: false })).ok, '解除封禁');
  const lb = await login('bob'); T.bob = lb.token;
  ok(lb.status === 200, '解封后能登录');
  ok((await A('POST', `/api/gm/users/${id.alice}/ban`, { on: true })).status === 400, '不能封禁管理员账号');

  // ---- 踢下线 ----
  const c2 = (await login('carol')).token, c3 = (await login('carol')).token;
  r = await A('POST', `/api/gm/users/${id.carol}/logout`);
  ok(r.ok && r.sessions >= 3, '踢下线：作废全部登录', r);
  ok((await api('GET', '/api/me', null, c2)).status === 401 && (await api('GET', '/api/me', null, c3)).status === 401 && (await api('GET', '/api/me', null, T.carol)).status === 401, '踢下线后所有旧 token 失效');
  ok((await A('POST', `/api/gm/users/${id.alice}/logout`)).status === 400, '不能踢自己');

  // ---- 重设密码 ----
  ok((await A('POST', `/api/gm/users/${id.carol}/password`, { pass: '123' })).status === 400, '新密码太短被拒绝');
  const c4 = (await login('carol')).token;
  ok((await A('POST', `/api/gm/users/${id.carol}/password`, { pass: 'newpass1' })).ok, '重设 carol 的密码');
  ok((await login('carol')).status === 401 && (await login('carol', 'newpass1')).status === 200, '旧密码不能用，新密码能登录');
  ok((await api('GET', '/api/me', null, c4)).status === 401, '重设密码后旧登录作废');
  ok((await A('POST', `/api/gm/users/${id.alice}/password`, { pass: 'whatever1' })).status === 400, '不能在后台重设管理员的密码');

  // ---- GM 邮件：点券拆封 / 预览 / 批次防重复 ----
  const mail = { to: ['bob', 'carol'], title: '维护补偿', body: '辛苦了', gold: 100, cera: 25_000_000, items: [{ key: 'fatigue', n: 2 }] };
  r = await A('POST', '/api/gm/mail', { ...mail, preview: true });
  ok(r.preview && r.n === 2 && r.per === 3 && r.mails === 6 && r.titles[1] === '维护补偿（2/3）' && r.items[0].name === '抗疲劳秘药' && r.checked, '预览：2 人，每人 3 封（2500 万点券拆开），物品名字', r);
  ok((await A('GET', '/api/gm/mails')).list.length === 0, '预览不会发出邮件');
  r = await A('POST', '/api/gm/mail', { ...mail, rid: 'batch_test_1' });
  ok(r.ok && r.n === 2 && r.mails === 6 && r.batch === 'batch_test_1', '群发成功：2 人 6 封', r);
  let bm = (await api('GET', '/api/mail', null, T.bob)).list.filter(m => m.kind === 'gm').sort((a, b) => a.id - b.id);
  ok(bm.length === 3 && bm.reduce((s, m) => s + m.cera, 0) === 25_000_000 && bm.every(m => m.cera <= 1e7) && bm[0].gold === 100 && bm[1].gold === 0 && bm[0].items.length === 1 && !bm[1].items.length && bm[2].title === '维护补偿（3/3）', 'bob 收到 3 封：点券 1000 万 + 1000 万 + 500 万，金币和物品只在第一封', bm.map(m => [m.title, m.gold, m.cera, m.items.length]));
  r = await A('POST', '/api/gm/mail', { ...mail, rid: 'batch_test_1' });
  ok(r.again && (await api('GET', '/api/mail', null, T.bob)).list.filter(m => m.kind === 'gm').length === 3, '同一批次重复提交不会重复发');
  // ---- 物品 @强化 / key 校验 ----
  r = await A('POST', '/api/gm/mail', { to: 'dave', title: '装备补给', items: [{ key: 'katana_60_5', n: 1, opt: { enh: 12, grade: 4 } }] });
  const dm = (await api('GET', '/api/mail', null, T.dave)).list.find(m => m.title === '装备补给');
  ok(r.ok && dm && dm.items[0].key === 'katana_60_5' && dm.items[0].opt.enh === 12 && dm.items[0].opt.grade === 4, '物品邮件带强化 +12 送达', dm);
  r = await A('POST', '/api/gm/mail', { to: 'dave', title: 'x', items: [{ key: 'no_such_item', n: 1 }] });
  ok(r.status === 400 && /物品库里没有/.test(r.error), '物品 key 不在物品目录里 → 400', r);
  ok((await A('POST', '/api/gm/mail', { to: 'nobody', title: 'x' })).status === 404, '收件人不存在 → 404');
  // ---- 领取进度 ----
  await api('POST', '/api/mail/claim', { id: bm[0].id, rid: 'c1' }, T.bob);
  r = await A('GET', '/api/gm/mails');
  const h1 = r.list.find(x => x.batch === 'batch_test_1');
  ok(h1 && h1.stat.n === 6 && h1.stat.claimed === 1 && h1.mails === 6 && h1.cera === 25_000_000, '邮件历史：6 封里已领取 1 封', h1);

  // ---- 软删除 / 恢复 ----
  ok((await A('POST', `/api/gm/users/${id.dave}/delete`, { confirm: 'Dave2' })).status === 400, '删除：用户名没输对 → 400');
  r = await A('POST', `/api/gm/users/${id.dave}/delete`, { confirm: 'dave' });
  const bdir = path.join(tmp, 'backups');
  ok(r.ok && r.backup && fs.existsSync(path.join(bdir, r.backup)) && fs.statSync(path.join(bdir, r.backup)).size > 0, '删除前自动备份了数据库', r);
  ok((await login('dave')).status === 403, '删除后不能登录');
  ok(!(await A('GET', '/api/gm/users')).list.some(u => u.name === 'dave') && (await A('GET', '/api/gm/users?filter=deleted')).list.map(u => u.name).join() === 'dave', '删除后默认列表里不显示，“已删除”里能找到');
  ok((await A('POST', '/api/gm/mail', { to: 'dave', title: 'x' })).status === 404, '不能给已删除的账号发邮件');
  r = await A('POST', '/api/gm/mail', { to: '*', title: '全服福利', cera: 10, preview: true });
  ok(r.n === 3 && !r.names.includes('dave'), '发给全体：不含已删除的账号', r.names);
  ok((await A('GET', `/api/gm/users/${id.dave}`)).save === null && (await A('GET', '/api/gm/stats')).users.deleted === 1, '详情 / 概况里能看到删除状态');
  ok((await A('POST', `/api/gm/users/${id.dave}/undelete`)).ok, '恢复账号');
  ok((await login('dave')).status === 403 && (await A('GET', '/api/gm/users')).list.some(u => u.name === 'dave' && u.banned), '恢复后仍是封禁状态（要再解封）');
  ok((await A('POST', `/api/gm/users/${id.alice}/delete`, { confirm: 'alice' })).status === 400, '不能删除管理员账号');
  await A('POST', `/api/gm/users/${id.bob}/ban`, { on: true });
  r = await A('POST', '/api/gm/mail', { to: '*', title: '全服福利', cera: 10, preview: true });
  ok(r.n === 2 && !r.names.includes('bob'), '发给全体：不含封禁的账号', r.names);
  await A('POST', `/api/gm/users/${id.bob}/ban`, { on: false });

  // ---- 客户端报错 ----
  const tc = (await login('carol', 'newpass1')).token;
  await api('POST', '/api/cerr', { where: 'town.step', msg: 'boom is not defined', stack: 'Error: boom\n  at x', ver: 'abc' }, tc);
  r = await A('GET', '/api/gm/cerr');
  ok(r.list[0].msg === 'boom is not defined' && r.list[0].user === 'carol' && r.groups[0].n === 1, '客户端报错：明细 + 分组', r);
  ok((await A('GET', '/api/gm/cerr?q=boom')).list.length === 1 && (await A('GET', '/api/gm/cerr?q=nothing')).list.length === 0, '报错按关键字过滤');
  ok((await A('GET', '/api/gm/stats')).cerr.day === 1, '概况里的 24 小时报错数');

  // ---- 操作日志 ----
  r = await A('GET', '/api/gm/logs?type=gm&limit=200');
  const types = new Set(r.list.map(x => x.type));
  ok(['gm.ban', 'gm.unban', 'gm.kick', 'gm.password', 'gm.mail', 'gm.delete', 'gm.undelete'].every(t => types.has(t)) && r.list.every(x => x.user === 'alice'), '每个写操作都记进操作日志（操作人 alice）', [...types]);
  const lban = r.list.find(x => x.type === 'gm.ban' && x.detail.why === '测试封禁');
  ok(lban && lban.detail.uid === id.bob && lban.detail.name === 'bob' && lban.at > 0, '日志里有被操作的账号、原因和时间', lban);
  ok(!JSON.stringify(r.list).includes('newpass1'), '日志里没有记密码');
  const before = r.list[1].id;
  ok((await A('GET', `/api/gm/logs?type=gm&before=${before}`)).list.every(x => x.id < before), '日志翻页（before）');
  ok((await A('GET', `/api/gm/users/${id.bob}`)).logs.some(x => x.type === 'gm.ban'), '账号详情里有管理员对它的操作记录');

  // ---- /admin 页面 ----
  let res = await fetch(BASE + '/admin', { redirect: 'manual' });
  ok(res.status === 301 && res.headers.get('location') === '/admin/', '/admin → /admin/');
  res = await fetch(BASE + '/admin/');
  const csp = res.headers.get('content-security-policy') || '';
  ok(res.status === 200 && /后台管理/.test(await res.text()) && csp.includes("script-src 'self'") && csp.includes("frame-ancestors 'none'") && res.headers.get('x-frame-options') === 'DENY', '/admin/ 页面 + CSP / 防嵌入', csp);
  ok((await fetch(BASE + '/admin/admin.js')).status === 200 && (await fetch(BASE + '/admin/admin.css')).status === 200, '页面脚本 / 样式');
  ok((await fetch(BASE + '/admin/%2e%2e/index.js')).status === 404 && (await fetch(BASE + '/admin/../index.js')).status === 404 && (await fetch(BASE + '/admin/x.js')).status === 404, '只托管固定的几个文件（不能读服务端代码）');

  // ---- 限流 ----
  let hit = 0;
  for (let i = 0; i < 8; i++) if ((await A('POST', `/api/gm/users/${id.carol}/delete`, { confirm: 'no' })).status === 429) hit++;
  ok(hit > 0, '删除账号接口限流（10 分钟 5 次）', hit);
  ws.close();
} catch (e) { fails++; console.log('✗ 异常', e.stack || e); }
await app.stop();
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\n${n - fails}/${n} 通过`);
process.exit(fails ? 1 : 0);
