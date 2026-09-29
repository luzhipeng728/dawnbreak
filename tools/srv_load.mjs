// 服务端压力测量（只在本机跑，不要对线上用）：独立进程起一个临时服务端，用假客户端模拟 R 个组队房间（每间 M 人，按实测的消息大小 / 频率发组队流量）
// + T 个同城镇玩家（10Hz 位置），统计服务端 CPU、内存、事件循环延迟（p50 / p99 / 最大，含 1ms 采样间隔）和转发量。docs/PERF.md
// 用法：node tools/srv_load.mjs [房间数=20] [每间人数=2] [城镇人数=20] [秒=15]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
const ROOT = new URL('..', import.meta.url).pathname;
const WebSocket = createRequire(path.join(ROOT, 'server/package.json'))('ws');
const R = +(process.argv[2] || 20), M = +(process.argv[3] || 2), T = +(process.argv[4] || 20), SECS = +(process.argv[5] || 15);
const sleep = ms => new Promise(r => setTimeout(r, ms));
// 实测（test/mp_perf.mjs，2 人 Lv60 满房间）的每类消息：[k, 每秒条数, 字节]
const HOST = [['s', 20, 560], ['p', 20, 130], ['kill', 12, 62], ['spawn', 1.6, 1600], ['ma', 2, 120], ['a', 1.2, 55]];
const GUEST = [['p', 20, 130], ['hb', 5, 700], ['st', 5, 75], ['a', 1, 55]];
const pad = n => 'x'.repeat(Math.max(0, n));
// 服务端进程：预加载一段统计脚本（事件循环延迟 / CPU / 内存每秒打印一行）
const port = await new Promise(res => { const s = net.createServer().listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dnf-load-')), pre = path.join(tmp, 'stats.mjs');
fs.writeFileSync(pre, `import { monitorEventLoopDelay } from 'node:perf_hooks';
const h = monitorEventLoopDelay({ resolution: 1 }); h.enable(); let c0 = process.cpuUsage(), t0 = Date.now();
setInterval(() => { const c = process.cpuUsage(c0), dt = Date.now() - t0; c0 = process.cpuUsage(); t0 = Date.now();
  process.stdout.write('@@' + JSON.stringify({ cpu: +((c.user + c.system) / 1000 / dt * 100).toFixed(1), rss: Math.round(process.memoryUsage().rss / 1048576), p50: +(h.percentile(50) / 1e6).toFixed(2), p99: +(h.percentile(99) / 1e6).toFixed(2), max: +(h.max / 1e6).toFixed(1) }) + '\\n'); h.reset(); }, 1000).unref();\n`);
const env = { ...process.env, DNF_PORT: String(port), DNF_HOST: '127.0.0.1', DNF_DB: path.join(tmp, 'load.db'), DNF_INVITE: 'LOAD' };
const proc = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', '--import', pre, path.join(ROOT, 'server/index.js')], { env, stdio: ['ignore', 'pipe', 'pipe'] });
const stats = []; let buf = '';
proc.stdout.on('data', d => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { const l = buf.slice(0, i); buf = buf.slice(i + 1); if (l.startsWith('@@')) stats.push(JSON.parse(l.slice(2))); } });
proc.stderr.on('data', d => { if (!/Experimental/.test(d)) process.stderr.write(d); });
for (let i = 0; i < 100; i++) { try { if ((await fetch(`http://127.0.0.1:${port}/api/health`)).ok) break; } catch (e) { /* 还没起来 */ } await sleep(100); }
let ipN = 0;
const ip = () => `10.9.${(++ipN >> 8) & 255}.${ipN & 255}`;   // 每个假客户端一个 IP（本机来源信任 X-Forwarded-For），绕开按 IP 的注册 / 连接限流
async function client(name) {
  const addr = ip(), r = await fetch(`http://127.0.0.1:${port}/api/register`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': addr }, body: JSON.stringify({ user: name, pass: 'secret123', invite: 'LOAD' }) });
  const j = await r.json(); if (!j.token) throw new Error('注册失败 ' + JSON.stringify(j));
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`, { headers: { 'x-forwarded-for': addr } });
  const C = { name, id: j.user.id, ws, got: 0, gotB: 0, wait: [] };
  ws.on('message', d => { C.got++; C.gotB += d.length; const m = JSON.parse(d); for (const w of C.wait.slice()) if (w.f(m)) { C.wait.splice(C.wait.indexOf(w), 1); w.res(m); } });
  await new Promise((res, rej) => { ws.once('open', res); ws.once('error', rej); });
  C.send = m => ws.send(JSON.stringify(m));
  C.until = (f, ms = 5000) => new Promise((res, rej) => { C.wait.push({ f, res }); setTimeout(() => rej(new Error(name + ' 等待超时')), ms); });
  C.send({ t: 'auth', token: j.token, ver: 1, build: 'load' }); await C.until(m => m.t === 'welcome');
  C.send({ t: 'hello', char: { name, cls: 'sword', job: 'blade', lvl: 60, look: { wpn: 'bsword' }, hp: 1 } });
  return C;
}
const all = [], rooms = [];
const t0 = Date.now();
for (let r = 0; r < R; r++) {
  const mem = []; for (let k = 0; k < M; k++) mem.push(await client(`r${r}m${k}`));
  const [H] = mem;
  for (const G of mem.slice(1)) { H.send({ t: 'party:invite', to: G.id }); await G.until(m => m.t === 'party:invited'); G.send({ t: 'party:accept', from: H.id }); await H.until(m => m.t === 'party' && m.party && m.party.members.length === mem.indexOf(G) + 1); }
  H.send({ t: 'room:open', kind: 'dungeon', meta: { id: 'law_gate', diff: 0 } }); await H.until(m => m.t === 'room');
  rooms.push(mem); all.push(...mem);
}
const town = []; for (let i = 0; i < T; i++) { const C = await client(`town${i}`); C.send({ t: 'scene', id: 'hm_plaza', x: 400 + i * 10, y: 100, f: 1 }); town.push(C); all.push(C); }
console.log(`${R} 个房间 × ${M} 人 + 城镇 ${T} 人，共 ${all.length} 条连接（准备用了 ${((Date.now() - t0) / 1000).toFixed(1)} 秒），开始发 ${SECS} 秒`);
// 发流量：每个连接一个 10ms 定时器，按每类消息的频率累加发送
const timers = [];
let sent = 0;
const drive = (C, list, wrap) => { const acc = list.map(() => Math.random()); timers.push(setInterval(() => { list.forEach(([k, hz, b], i) => { acc[i] += hz / 100; while (acc[i] >= 1) { acc[i]--; C.send(wrap(k, b)); sent++; } }); }, 10)); };
for (const mem of rooms) mem.forEach((C, i) => drive(C, i ? GUEST : HOST, (k, b) => (k === 'p' ? { t: 'r', to: 'all', d: { k, x: 100, y: 50, pad: pad(b - 60) } } : { t: 'r', d: { k, pad: pad(b - 40) } })));
for (const C of town) { let x = 400; timers.push(setInterval(() => { x = (x + 7) % 1600; C.send({ t: 'pos', x, y: 100, f: 1, s: 'run' }); sent++; }, 100)); }
for (const C of all) { C.got = 0; C.gotB = 0; }
const s0 = stats.length;
await sleep(SECS * 1000);
for (const t of timers) clearInterval(t);
const S = stats.slice(s0 + 1), avg = k => +(S.reduce((a, b) => a + b[k], 0) / S.length).toFixed(2), mx = k => Math.max(...S.map(s => s[k]));
const got = all.reduce((a, c) => a + c.got, 0), gotB = all.reduce((a, c) => a + c.gotB, 0);
const out = { rooms: R, per: M, town: T, conns: all.length, secs: SECS, inMsgs: Math.round(sent / SECS), outMsgs: Math.round(got / SECS), outKBps: Math.round(gotB / SECS / 1024), cpuAvg: avg('cpu'), cpuMax: mx('cpu'), rssMB: mx('rss'), eldP50: avg('p50'), eldP99: avg('p99'), eldP99Max: mx('p99'), eldMax: mx('max') };
console.log(JSON.stringify(out));
for (const C of all) C.ws.close();
proc.kill('SIGKILL'); fs.rmSync(tmp, { recursive: true, force: true });
if (process.env.OUT) fs.writeFileSync(process.env.OUT, JSON.stringify(out));
process.exit(0);
