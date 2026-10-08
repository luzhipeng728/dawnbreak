/* 团本（RA1，docs/RAID_PLAN.md §3.7；消息表见 docs/NETWORK.md「团本」）：服务端权威的团本会话
   规则全部在 src/game/raid_core.js（和浏览器共用同一个文件，这里用 node:vm 加载，见 loadRaidCore）；这个模块只管：
   谁能发什么（成员 / 团长 / 队伍校验）、把规则核心的效果发给该收的人、1Hz 计时、存库（raid_run）、重启恢复（计时按停机时长顺延）、
   每天 / 每周次数（raid_week，按角色）、领奖幂等（raid_claim）、清理过期会话。
   会话和队伍（party.js）是分开的：建团时从队伍里拉人，之后队伍解散 / 重组都不影响会话；队伍里有人在团本里时不能邀请外人、不能移交队长。
   WS（客户端 → 服务端）：
     raid:create { raid, mode:'normal'|'guide', cid, char }  建团（队长，或者没组队的单人）。普通模式会给队友发 raid:open
     raid:join { sid, cid, char } / raid:ready { on } / raid:start / raid:leave
         加入 / 准备 / 团长开始（休整中 = 提前进下一阶段）/ 离开（开始后离开 = 放弃，次数照扣）
     raid:enter { node, with?: [uid] }    进节点；with = 一起进（要是队长，收到 raid:entered 后自己发 room:open）→ 进的人都收到 raid:entered
     raid:ev { node, run, q, e, v }       实例上报：e = hp | down | clear | fail | death | revive | cp；q = 这次挑战里自己的序号（补发重复的回 dup）→ raid:ack
     raid:mark { uid, node } / raid:resume { sid } / raid:claim { sid, phase } / raid:loot { mode } / raid:flip { op, phase, index }
   WS（服务端 → 客户端）：raid { run, now, resume? } 全量 | raid:d { sid, now, set, nodes } 变化 | raid:fx { sid, kind, node, p } | raid:entered { sid, run, … } |
     raid:ack { sid, run, q, e, ok, res?, dup?, code?, text? } | raid:note { sid, text, code?, bad? } | raid:end { sid, ok, why } |
     raid:open { sid, raid, mode, leader } | raid:claimed { sid, phase, reward, dup?, limits }
   HTTP：GET /api/raid?cid=&raid= → { raid, limits, run, invite, defs, now } */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const TZ = 480;   // 每天 / 每周按北京时间算（06:00 换日，周四 06:00 换周），和 signin.js 一致
const KEEP_ENDED = 10 * 60_000, LOBBY_IDLE = 30 * 60_000, DB_KEEP = 7 * 86400_000;
const LIVE_SQL = `('lobby','routes','rest','final')`;
const EVS = new Set(['hp', 'down', 'clear', 'fail', 'death', 'revive', 'cp', 'boss']);
const txt = (s, n) => String(s ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, n);
const KEY_RE = /^[a-z][a-z0-9_]{0,23}$/, CLS_RE = /^[a-z]{2,12}$/;

// 规则核心：在 node:vm 的空上下文里跑 src/game/raid_core.js（和网页版拼接时一样加 "use strict"），取出 RAID_CORE。
// 找文件的顺序：参数 → 环境变量 DNF_RAID_CORE → 服务端 lib/raid_core.js（线上部署时复制过去）→ 仓库里的 src/game/raid_core.js。
// 找不到就抛错：index.js 记一条“模块加载失败”并跳过团本模块，服务端照常启动。
export function loadRaidCore(file) {
  const cands = [file, process.env.DNF_RAID_CORE, path.join(DIR, '..', 'lib', 'raid_core.js'), path.join(DIR, '..', '..', 'src', 'game', 'raid_core.js')].filter(Boolean);
  const f = cands.find(p => fs.existsSync(p));
  if (!f) throw new Error('找不到团本规则文件 raid_core.js（' + cands.join(' / ') + '）');
  const core = vm.runInContext('"use strict";\n' + fs.readFileSync(f, 'utf8') + '\n;RAID_CORE', vm.createContext({}), { filename: f, timeout: 5000 });
  core.file = f;
  return core;
}
const CORE = loadRaidCore();

export default {
  name: 'raid',
  migrations: [
    `CREATE TABLE raid_run (sid TEXT PRIMARY KEY, raid TEXT NOT NULL, mode TEXT NOT NULL, st TEXT NOT NULL, leader INTEGER NOT NULL, uids TEXT NOT NULL,
      data TEXT NOT NULL, created INTEGER NOT NULL, updated INTEGER NOT NULL, beat INTEGER NOT NULL)`,
    `CREATE INDEX raid_run_st ON raid_run (st, updated)`,
    `CREATE TABLE raid_claim (sid TEXT NOT NULL, user_id INTEGER NOT NULL, cid TEXT NOT NULL, phase INTEGER NOT NULL, reward TEXT NOT NULL, at INTEGER NOT NULL,
      PRIMARY KEY (sid, user_id, cid, phase))`,
    `CREATE TABLE raid_week (user_id INTEGER NOT NULL, cid TEXT NOT NULL, raid TEXT NOT NULL, day INTEGER NOT NULL, dn INTEGER NOT NULL DEFAULT 0,
      week INTEGER NOT NULL, wn INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (user_id, cid, raid))`,
  ],
  init(ctx) {
    const C = ctx.cfg;
    if (process.env.DNF_RAID_FAST === '1') { C.raidMinClear ??= 0; C.raidMaxDrop ??= 0; }   // 测试用（RA2 的 ?raidfast）：不查最短通关时间和掉血速度
    const now = () => Date.now() + (C.raidShift || 0);   // 测试可以平移时间（cfg.raidShift 毫秒）
    const guard = () => { const g = {}; if (C.raidMinClear != null) g.minClear = +C.raidMinClear; if (C.raidMaxDrop != null) g.maxDrop = +C.raidMaxDrop; return g; };
    const runs = new Map(), byUser = new Map();
    let seq = 1, sweepN = 0;
    const LIVE = st => !!CORE.LIVE[st];
    const mine = uid => runs.get(byUser.get(uid)) || null;
    const member = (W, uid) => W.S.members.find(m => m.uid === uid) || null;
    const present = W => W.S.members.filter(m => !m.left).map(m => m.uid);
    const note = (c, W, text, code) => c.send({ t: 'raid:note', sid: W ? W.S.sid : null, text, code: code || null, bad: true });
    function wrap(S, t) { return { S, sent: CORE.view(S), saved: t, dirty: false, touched: t, endedAt: LIVE(S.st) ? 0 : t, uids: [] }; }
    // byUser：没结束的会话里、没离开的成员 → sid
    function index(W) {
      const want = LIVE(W.S.st) ? present(W) : [];
      for (const u of W.uids) if (!want.includes(u) && byUser.get(u) === W.S.sid) byUser.delete(u);
      for (const u of want) byUser.set(u, W.S.sid);
      W.uids = want;
    }
    function save(W) {
      const S = W.S, t = now();
      ctx.db.run(`INSERT INTO raid_run (sid, raid, mode, st, leader, uids, data, created, updated, beat) VALUES (?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT(sid) DO UPDATE SET st = excluded.st, leader = excluded.leader, uids = excluded.uids, data = excluded.data, updated = excluded.updated, beat = excluded.beat`,
        S.sid, S.raid, S.mode, S.st, S.leader, ',' + S.members.map(m => m.uid).join(',') + ',', JSON.stringify(S), S.created, t, t);
      W.saved = t; W.dirty = false;
    }
    // 状态变了：先发 raid:d（节点表换了 = 换阶段，发全量 raid），再发效果；hp / cp 这类高频上报最多每秒存一次库，其余立刻存
    function commit(W, out, force) {
      const v = CORE.view(W.S), a = W.sent, set = {}, nodes = {}, sid = W.S.sid;
      let n = 0;
      for (const k of Object.keys(v)) if (k !== 'nodes' && JSON.stringify(a[k]) !== JSON.stringify(v[k])) { set[k] = v[k]; n++; }
      const full = Object.keys(a.nodes || {}).join(',') !== Object.keys(v.nodes).join(',');
      if (!full) for (const id of Object.keys(v.nodes)) if (JSON.stringify(a.nodes[id]) !== JSON.stringify(v.nodes[id])) { nodes[id] = v.nodes[id]; n++; }
      W.sent = v;
      const to = present(W);
      if (full) for (const u of to) ctx.sendTo(u, { t: 'raid', run: v, now: now() });
      else if (n) for (const u of to) ctx.sendTo(u, { t: 'raid:d', sid, now: now(), set, nodes });
      for (const f of out ? out.fx : []) {
        const msg = f.kind === 'note' ? { t: 'raid:note', sid, text: f.p.text, node: f.node } : f.kind === 'end' ? { t: 'raid:end', sid, ...f.p }
          : f.kind === 'entered' ? { t: 'raid:entered', sid, ...f.p } : { t: 'raid:fx', sid, kind: f.kind, node: f.node, p: f.p };
        for (const u of f.to === 'all' ? to : f.to) ctx.sendTo(u, msg);
      }
      if (full || n || (out && out.fx.length)) W.dirty = true;
      if (W.dirty && (force || now() - W.saved >= 1000 || !LIVE(W.S.st))) save(W);
      if (!LIVE(W.S.st) && !W.endedAt) W.endedAt = now();
      index(W);
    }
    function apply(W, ev, c) {
      const out = CORE.event(W.S, ev, now());
      W.touched = now();
      commit(W, out, ev.t !== 'hp' && ev.t !== 'cp');
      if (out.err && c) note(c, W, out.err.text, out.err.code);
      return out;
    }
    // 已经结束的会话（领奖 / 查结果 / 补发）：内存里没有就从库里读
    function load(sid) {
      let W = runs.get(sid); if (W) return W;
      const r = sid && ctx.db.get('SELECT data FROM raid_run WHERE sid = ?', sid); if (!r) return null;
      let S; try { S = JSON.parse(r.data); } catch { return null; }
      W = wrap(S, now()); runs.set(sid, W); index(W);
      return W;
    }
    const weekRow = (uid, cid, raid) => ctx.db.get('SELECT day, dn, week, wn FROM raid_week WHERE user_id = ? AND cid = ? AND raid = ?', uid, cid, raid) || null;
    const limitsOf = (uid, cid, raid) => CORE.limits(raid, weekRow(uid, cid, raid), now(), TZ);
    const cidOf = v => txt(v, 24) || '0';
    function charOf(c, msg) {
      const ch = msg.char && typeof msg.char === 'object' ? msg.char : c.char || {};
      return { name: txt(ch.name, 16) || c.user.name, cls: CLS_RE.test(ch.cls || '') ? ch.cls : null, job: KEY_RE.test(ch.job || '') ? ch.job : null, lvl: Math.max(0, Math.min(99, +ch.lvl || 0)) };
    }

    // 启动：把没结束的会话读回来，计时按停机时长顺延（beat = 最后一次心跳）；所有人先算离线，重连时 onConnect 标回在线
    {
      const t = now();
      for (const r of ctx.db.all(`SELECT sid, data, beat FROM raid_run WHERE st IN ${LIVE_SQL}`)) {
        let S; try { S = JSON.parse(r.data); } catch { continue; }
        if (!CORE.defOf(S.raid)) continue;
        CORE.shift(S, Math.max(0, t - r.beat));
        for (const m of S.members) if (m.online) { m.online = false; m.offAt = t; }
        const W = wrap(S, t); runs.set(S.sid, W); index(W);
      }
      if (runs.size) ctx.log(`团本：恢复了 ${runs.size} 个没结束的会话`);
    }

    function tick() {
      const t = now();
      let live = 0;
      for (const W of [...runs.values()]) {
        if (!LIVE(W.S.st)) { if (t - W.endedAt > KEEP_ENDED) runs.delete(W.S.sid); continue; }
        live++;
        if (W.S.st === 'lobby' && t - W.touched > LOBBY_IDLE) { commit(W, CORE.abort(W.S, t, 'stale'), true); continue; }
        const out = CORE.tick(W.S, t);
        commit(W, out, out.fx.length > 0);
      }
      if (live) ctx.db.run(`UPDATE raid_run SET beat = ? WHERE st IN ${LIVE_SQL}`, t);
      if (++sweepN % 600 === 0) ctx.db.run(`DELETE FROM raid_run WHERE st NOT IN ${LIVE_SQL} AND updated < ?`, t - DB_KEEP);
    }
    setInterval(() => { try { tick(); } catch (e) { ctx.log('raid tick 出错', e.stack || e); } }, 1000).unref();

    const api = {
      core: CORE, runs, byUser, now, tick, load, limitsOf,
      of: uid => { const W = mine(uid); return W ? W.S : null; },
      flush() { for (const W of runs.values()) if (W.dirty || LIVE(W.S.st)) save(W); },
      presence(uid, on) { const W = mine(uid); if (W) apply(W, { t: 'online', uid, on }); },
      // party.js：队伍里有人在没结束的团本里
      busy: P => P.members.some(id => !!mine(id)),
      // party.js：from 邀请 to（或 to 接受 from 的邀请）能不能组队，返回不行的原因
      inviteBlock(from, to) {
        const A = mine(from), B = mine(to);
        if (B && B !== A) return '对方正在别的团本里';
        if (!A || A.S.members.some(m => m.uid === to && !m.left)) return null;
        const D = CORE.defOf(A.S.raid);
        if (A.S.st !== 'lobby') return '团本进行中，不能邀请团本以外的人';
        if (A.S.mode === 'guide') return '引导模式的团本只能一个人';
        if (A.S.members.length >= (D.maxPlayers || 2)) return `当前团本最多 ${D.maxPlayers || 2} 人`;
        return null;
      },
      // party.js：有人离开 / 被请离队伍。还没开始的团本里把他移出去（掉线超时不算，回来还能接着准备）
      onPartyLeave(uid, P, why) {
        const W = mine(uid); if (!W || W.S.st !== 'lobby' || why === 'timeout') return;
        apply(W, { t: 'leave', uid });
        ctx.sendTo(uid, { t: 'raid:end', sid: W.S.sid, ok: false, why: 'left' });
      },
      create(c, msg) {
        const me = c.user.id, raid = txt(msg.raid, 24), D = CORE.defOf(raid), mode = msg.mode === 'guide' ? 'guide' : 'normal';
        if (!D) return note(c, null, '没有这个团本');
        const cur = mine(me);
        if (cur) { c.send({ t: 'raid', run: cur.sent, now: now(), resume: true }); return note(c, cur, '你已经在团本里了', 'busy'); }
        if (ctx.mods.room && ctx.mods.room.of(me)) return note(c, null, '先离开地下城 / 决斗再建团');
        const P = ctx.mods.party.of(me), ch = charOf(c, msg);
        if (mode === 'normal' && P && P.leader !== me) return note(c, null, '只有队长可以建团');
        if (mode === 'normal' && P && P.members.length > (D.maxPlayers || 2)) return note(c, null, `当前团本最多 ${D.maxPlayers || 2} 人`);
        if (D.minLvl && ch.lvl < D.minLvl) return note(c, null, `需要 ${D.minLvl} 级`);
        const sid = 'rd' + C.boot + '_' + (seq++), t = now();
        const S = CORE.init(raid, [{ uid: me, cid: cidOf(msg.cid), name: ch.name, cls: ch.cls, job: ch.job }], mode, t, { sid, guard: guard(), seed: crypto.randomInt(2 ** 31), lootMode: msg.lootMode });
        const W = wrap(S, t); runs.set(sid, W); index(W); save(W);
        c.send({ t: 'raid', run: W.sent, now: t });
        if (mode === 'normal' && P) for (const id of P.members) if (id !== me) ctx.sendTo(id, { t: 'raid:open', sid, raid, mode, leader: { id: me, name: c.user.name } });
      },
      join(c, msg) {
        const me = c.user.id, W = runs.get(txt(msg.sid, 40));
        if (!W || W.S.st !== 'lobby') return note(c, null, '这个团本已经开始了，或者不存在');
        if (mine(me) && mine(me) !== W) return note(c, W, '你已经在别的团本里了');
        const P = ctx.mods.party.of(me);
        if (!P || !P.members.includes(W.S.leader)) return note(c, W, '要和团长在同一个队伍里才能加入');
        const ch = charOf(c, msg), D = CORE.defOf(W.S.raid);
        if (D.minLvl && ch.lvl < D.minLvl) return note(c, W, `需要 ${D.minLvl} 级`);
        const out = apply(W, { t: 'join', uid: me, cid: cidOf(msg.cid), name: ch.name, cls: ch.cls, job: ch.job }, c);
        if (!out.err) c.send({ t: 'raid', run: W.sent, now: now() });
      },
      ready(c, msg) { const W = mine(c.user.id); if (W) apply(W, { t: 'ready', uid: c.user.id, on: msg.on !== false }, c); },
      // 开始：先按规则核心检查，再按角色扣每天 / 每周次数（用完的人这次是练习，没有奖励），最后开始第一阶段（同一个事务）
      start(c) {
        const me = c.user.id, W = mine(me); if (!W) return;
        const e = CORE.canStart(W.S, me); if (e) return note(c, W, e.text, e.code);
        if (W.S.st !== 'lobby') return apply(W, { t: 'start', uid: me }, c);
        const rw = {}, t = now();
        ctx.db.tx(() => {
          for (const m of W.S.members) {
            if (m.left) continue;
            const next = CORE.consume(W.S.raid, weekRow(m.uid, m.cid, W.S.raid), t, TZ);
            rw[m.uid] = !!next;
            if (next) ctx.db.run(`INSERT INTO raid_week (user_id, cid, raid, day, dn, week, wn) VALUES (?,?,?,?,?,?,?)
              ON CONFLICT(user_id, cid, raid) DO UPDATE SET day = excluded.day, dn = excluded.dn, week = excluded.week, wn = excluded.wn`,
              m.uid, m.cid, W.S.raid, next.day, next.dn, next.week, next.wn);
          }
          apply(W, { t: 'start', uid: me, rw }, c);
        });
      },
      leave(c) {
        const me = c.user.id, W = mine(me); if (!W) return;
        apply(W, { t: 'leave', uid: me }, c);
        c.send({ t: 'raid:end', sid: W.S.sid, ok: false, why: 'left' });
      },
      enter(c, msg) {
        const me = c.user.id, W = mine(me); if (!W) return note(c, null, '你不在团本里');
        const w = Array.isArray(msg.with) ? [...new Set(msg.with.map(Number).filter(x => Number.isInteger(x) && x > 0 && x !== me))].slice(0, 3) : [];
        if (w.length) {
          const P = ctx.mods.party.of(me);
          if (!P || P.leader !== me || w.some(id => !P.members.includes(id))) return note(c, W, '一起进要先组队，并且由队长带队', 'party');
        }
        apply(W, { t: 'enter', uid: me, node: txt(msg.node, 24), with: w }, c);
      },
      ev(c, msg) {
        const me = c.user.id, e = String(msg.e || ''), run = txt(msg.run, 16), q = Number.isInteger(msg.q) && msg.q >= 0 ? msg.q : null;
        const W = (typeof msg.sid === 'string' && msg.sid ? load(txt(msg.sid, 40)) : null) || mine(me);
        const ack = (ok, x) => c.send({ t: 'raid:ack', sid: W ? W.S.sid : null, run, q, e, ok, ...x });
        if (!W || !EVS.has(e)) return ack(false, { code: W ? 'bad' : 'member' });
        let v = null;
        if (e === 'hp') v = +msg.v;
        else if (e === 'cp') v = msg.v && typeof msg.v === 'object' ? { hp: +msg.v.hp, ph: Number.isInteger(msg.v.ph) ? msg.v.ph : -1 } : null;
        else if (e === 'fail') v = txt(msg.v, 12);
        const out = CORE.event(W.S, { t: e, uid: me, node: msg.node == null ? null : txt(msg.node, 24), run, q, v }, now());
        W.touched = now();
        commit(W, out, e !== 'hp' && e !== 'cp');
        if (out.err) ack(false, { code: out.err.code, text: out.err.text });
        else ack(true, out.ack || {});
      },
      mark(c, msg) { const W = mine(c.user.id); if (W) apply(W, { t: 'mark', uid: c.user.id, to: +msg.uid, node: msg.node == null ? null : txt(msg.node, 24) }, c); },
      loot(c, msg) {
        const W = mine(c.user.id); if (!W) return;
        const out = CORE.setLootMode(W.S, c.user.id, txt(msg.mode, 16));
        if (!out.ok) return note(c, W, out.text, out.code);
        commit(W, { fx: [] }, true);
      },
      flip(c, msg) {
        const me = c.user.id, W = typeof msg.sid === 'string' ? load(txt(msg.sid, 40)) : mine(me), phase = msg.phase | 0, op = txt(msg.op, 8) || 'open';
        if (!W || !member(W, me)) return note(c, W, '你不在这个团本里', 'flip');
        let out;
        if (op === 'open') out = CORE.flipOpen(W.S, me, phase, now());
        else if (op === 'pick') out = CORE.flipPick(W.S, me, phase, msg.index | 0, now(), Math.random);
        else if (op === 'close') out = CORE.flipClose(W.S, me, phase, now());
        else out = { ok: false, code: 'flip', text: '未知翻牌操作' };
        if (!out.ok) return note(c, W, out.text, out.code);
        // picks / rewardCards intentionally stay out of public view; mark the wrapped run dirty so
        // each member's selection survives a restart even when the shared flip state stays "open".
        W.dirty = true; commit(W, { fx: [] }, true); c.send({ t: 'raid:flip', sid: W.S.sid, phase, op, ...out });
      },
      // 重连 / 刷新页面：发全量状态（没结束的会话顺便标回在线）；已经结束的补一条 raid:end
      resume(c, msg) {
        const me = c.user.id, sid = txt(msg.sid, 40), W = sid ? load(sid) : mine(me), m = W && member(W, me);
        if (!m) return c.send({ t: 'raid:end', sid: sid || null, ok: false, why: 'gone' });
        if (LIVE(W.S.st) && !m.left) apply(W, { t: 'online', uid: me, on: true });
        c.send({ t: 'raid', run: W.sent, now: now(), resume: true });
        // 领奖和翻牌是两个可重入步骤：刷新后先补发角色自己的领奖记录，再补发
        // 已选牌 / 关牌状态。公共 raid view 不带 rewardCards，避免把别人的牌面泄露给客户端。
        // 这也让 claim → reload → pick 在结束会话和服务端重启后仍能继续。
        if (!m.left) {
          const rows = ctx.db.all('SELECT phase, reward FROM raid_claim WHERE sid = ? AND user_id = ? AND cid = ? ORDER BY phase', W.S.sid, me, m.cid);
          const claimed = new Map();
          for (const row of rows) {
            try { claimed.set(Number(row.phase), JSON.parse(row.reward)); } catch { /* 损坏的历史奖励由正常 claim 错误路径处理 */ }
          }
          const phases = (W.S.res && W.S.res.phases || []).map(Number), F = W.S.flip && W.S.flip.cards || {}, current = Number(W.S.flip && W.S.flip.phase) || 0;
          for (const phase of phases) {
            const reward = claimed.get(phase);
            if (!reward) continue;
            c.send({ t: 'raid:claimed', sid: W.S.sid, phase, reward, dup: true, limits: limitsOf(me, m.cid, W.S.raid) });
            const card = current === phase ? F[String(me)] : null;
            const picks = card && Array.isArray(card.picks) ? card.picks.map(x => ({ index: x.index, reward: x.reward })) : [];
            const closed = !!(card && card.closedAt) || phase < current;
            c.send({ t: 'raid:flip', sid: W.S.sid, phase, op: 'resume', state: closed ? 'closed' : 'open', closed, picks });
          }
        }
        if (!LIVE(W.S.st) || m.left) c.send({ t: 'raid:end', sid: W.S.sid, ok: W.S.st === 'cleared', why: m.left ? 'left' : W.S.why });
      },
      // 领阶段奖励：阶段通关了、这次不是练习、没领过（会话 + 账号 + 角色 + 阶段唯一）；重复领返回同一份（dup），客户端按 sid + phase 只入账一次
      claim(c, msg) {
        const me = c.user.id, W = typeof msg.sid === 'string' ? load(txt(msg.sid, 40)) : mine(me), phase = msg.phase | 0, m = W && member(W, me);
        if (!m) return note(c, W, '你不在这个团本里', 'claim');
        const old = ctx.db.get('SELECT reward FROM raid_claim WHERE sid = ? AND user_id = ? AND cid = ? AND phase = ?', W.S.sid, me, m.cid, phase);
        const limits = limitsOf(me, m.cid, W.S.raid);
        if (old) {
          const reward = JSON.parse(old.reward), opened = CORE.flipOpen(W.S, me, phase, now());
          if (opened.ok) {
            const set = CORE.flipSetReward(W.S, me, phase, reward);
            if (set.ok) commit(W, { fx: [] }, true);
          }
          return c.send({ t: 'raid:claimed', sid: W.S.sid, phase, reward, dup: true, limits });
        }
        if (!W.S.res.phases.includes(phase)) return note(c, W, '这个阶段还没通关', 'claim');
        if (!m.rw) return note(c, W, '这次是练习（本周 / 今天的次数已经用完了），没有奖励', 'practice');
        const opened = CORE.flipOpen(W.S, me, phase, now());
        if (!opened.ok) return note(c, W, opened.text, opened.code);
        const reward = CORE.rollReward(W.S, me, phase, Math.random);
        CORE.flipSetReward(W.S, me, phase, reward);
        // 领奖确认本身就是一次合法的翻牌打开；客户端再按卡面做动画，不会让角色提前离开结算锁。
        commit(W, { fx: [] }, true);
        ctx.db.run('INSERT INTO raid_claim (sid, user_id, cid, phase, reward, at) VALUES (?,?,?,?,?,?)', W.S.sid, me, m.cid, phase, JSON.stringify(reward), now());
        c.send({ t: 'raid:claimed', sid: W.S.sid, phase, reward, limits });
        if (ctx.mods.gm && ctx.mods.gm.log) ctx.mods.gm.log('raid', { id: me, name: c.user.name }, { sid: W.S.sid, cid: m.cid, phase, reward });
      },
    };
    return api;
  },
  // 服务端关闭前（index.js 的 stop）：把还没写进库的变化写掉
  stop(ctx) { ctx.mods.raid.flush(); },
  onConnect(c, ctx) { const A = ctx.mods.raid; if (A.byUser.has(c.user.id)) A.resume(c, {}); },
  onClose(c, ctx) { if (!c.replaced) ctx.mods.raid.presence(c.user.id, false); },
  ws: {
    'raid:create'(c, msg, ctx) { ctx.mods.raid.create(c, msg); },
    'raid:join'(c, msg, ctx) { ctx.mods.raid.join(c, msg); },
    'raid:ready'(c, msg, ctx) { ctx.mods.raid.ready(c, msg); },
    'raid:start'(c, msg, ctx) { ctx.mods.raid.start(c); },
    'raid:leave'(c, msg, ctx) { ctx.mods.raid.leave(c); },
    'raid:enter'(c, msg, ctx) { ctx.mods.raid.enter(c, msg); },
    'raid:ev'(c, msg, ctx) { ctx.mods.raid.ev(c, msg); },
    'raid:mark'(c, msg, ctx) { ctx.mods.raid.mark(c, msg); },
    'raid:loot'(c, msg, ctx) { ctx.mods.raid.loot(c, msg); },
    'raid:flip'(c, msg, ctx) { ctx.mods.raid.flip(c, msg); },
    'raid:resume'(c, msg, ctx) { ctx.mods.raid.resume(c, msg); },
    'raid:claim'(c, msg, ctx) { ctx.mods.raid.claim(c, msg); },
  },
  routes(r, ctx) {
    r.get('/api/raid', { auth: true, rate: [60, 60] }, req => {
      const A = ctx.mods.raid, q = req.query || {}, uid = req.user.id, raid = CORE.defOf(q.raid) ? q.raid : 'siroco';
      const S = A.of(uid), P = ctx.mods.party.of(uid), L = P && P.leader !== uid ? A.of(P.leader) : null;
      const invite = !S && L && L.st === 'lobby' && L.mode === 'normal' ? { sid: L.sid, raid: L.raid, mode: L.mode, leader: P.leader } : null;
      return { raid, limits: A.limitsOf(uid, txt(q.cid, 24) || '0', raid), run: S ? CORE.view(S) : null, invite, now: A.now(),
        defs: Object.values(CORE.defs).map(D => ({ id: D.id, name: D.name, minLvl: D.minLvl, maxPlayers: D.maxPlayers, limits: D.limits })) };
    });
  },
};
