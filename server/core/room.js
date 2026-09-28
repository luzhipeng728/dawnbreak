/* 核心模块：实例房间（组队地下城 / 好友决斗）的消息转发。服务端不模拟游戏，只做成员校验和转发
   房间：{ id, kind:'dungeon'|'duel', host, members:[userId], meta }
   WS（客户端 → 服务端）：
     room:open { kind:'dungeon', meta }     队长开地下城房间（成员 = 队伍里在线的人）
     r { d, to? }                           转发：房主不写 to → 发给其他所有成员；成员不写 to → 只发给房主；to:'all' → 其他所有人；to:<userId> → 指定成员
     room:leave / room:close                离开（房主离开 = 关闭房间）/ 房主关闭
     duel:ask { to }  duel:accept { from }  duel:decline { from, why }  duel:cancel { to }   好友决斗邀请（接受后建 duel 房间，发起方当房主）
   WS（服务端 → 客户端）：room { room, resume? }、room:closed { id, why }、room:left { id, user, why }、room:lag { id, user, on }、r { f: 发送者, d }、
     duel:asked { from }、duel:declined { by, why }、duel:note { text }
   掉线：成员离线后先广播 room:lag，宽限期（cfg.graceMs）内重连回来会收到 room { resume: true } 接着玩；超时算离开（房主超时 = 房间关闭，why: 'host-lost'）
   服务端重启（队伍和房间只在内存里，状态其实在队长的客户端上）：客户端发现 welcome.boot 变了以后——
     队长 / 决斗发起方：restore:host { party: [队员 id], room: { kind, meta, members: [成员 id] } | null }
     队员 / 决斗对方：  restore:claim { host }
   双方互相认领才算数（队长列了名单、本人也认这个队长），服务端据此重建队伍和房间，被认领的成员收到 room { resume: true } 接着玩；
   cfg.restoreMs 内没回来的成员，房主会收到 room:left { why: 'timeout' } */
import { str } from '../lib/util.js';

const ASK_TTL = 20_000;

export default {
  name: 'room',
  init(ctx) {
    const rooms = new Map(), byUser = new Map(), asks = new Map(), grace = new Map();
    let seq = 1;
    setInterval(() => { const t = Date.now(); for (const [k, v] of asks) if (v.exp < t) { asks.delete(k); ctx.sendTo(v.from, { t: 'duel:declined', by: v.toName, why: 'timeout' }); } }, 2000).unref();
    const view = R => ({ id: R.id, kind: R.kind, host: R.host, members: R.members.map(id => { const c = ctx.client(id), u = c ? c.user : ctx.findUser(id); return { id, name: u ? u.name : '?', char: c ? c.char : null, online: !!c }; }), meta: R.meta });
    const api = {
      rooms, asks, grace,
      of: uid => rooms.get(byUser.get(uid)),
      partyBusy: P => [...rooms.values()].some(R => R.kind === 'dungeon' && R.pid === P.id),
      open(kind, host, members, meta, pid, resume) {
        for (const id of members) api.leave(id, 'moved');
        const R = { id: 'r' + ctx.cfg.boot + '_' + (seq++), kind, host, members: [...members], meta, pid, created: Date.now() };
        rooms.set(R.id, R); for (const id of members) byUser.set(id, R.id);
        const v = view(R); for (const id of members) ctx.sendTo(id, resume ? { t: 'room', room: v, resume: true } : { t: 'room', room: v });
        return R;
      },
      /* ---- 服务端重启后的恢复 ---- */
      restores: new Map(), claims: new Map(),
      restoreJoin(rec, uid) {
        const P = ctx.mods.party;
        let ok = false;
        if (rec.P && rec.party.has(uid) && !P.of(uid) && P.parties.has(rec.P.id)) { P.join(uid, rec.P); P.push(rec.P, 'restored'); ok = true; }
        const R = rec.R;
        if (R && rooms.has(R.id) && rec.want.has(uid) && !api.of(uid)) {
          R.members.push(uid); byUser.set(uid, R.id); rec.got.add(uid);
          ctx.sendTo(uid, { t: 'room', room: view(R), resume: true, restored: true });
          for (const id of R.members) if (id !== uid) ctx.sendTo(id, { t: 'room:lag', id: R.id, user: uid, on: false });
          ok = true;
        }
        return ok;
      },
      close(R, why) {
        if (!rooms.has(R.id)) return;
        rooms.delete(R.id);
        for (const id of R.members) { if (byUser.get(id) === R.id) byUser.delete(id); ctx.sendTo(id, { t: 'room:closed', id: R.id, why }); const g = grace.get(id); if (g) { clearTimeout(g); grace.delete(id); } }
      },
      leave(uid, why) {
        const R = api.of(uid); if (!R) return;
        if (R.host === uid) { api.close(R, why === 'timeout' ? 'host-lost' : 'host-left'); return; }
        R.members = R.members.filter(x => x !== uid); byUser.delete(uid);
        ctx.sendTo(uid, { t: 'room:closed', id: R.id, why: 'left' });
        for (const id of R.members) ctx.sendTo(id, { t: 'room:left', id: R.id, user: uid, why });
        if (R.members.length <= 1 && R.kind === 'duel') api.close(R, 'peer-left');
      },
      onPartyLeave(uid, P, why) { const R = api.of(uid); if (R && R.pid === P.id) api.leave(uid, why); },
      relay(c, msg) {
        const R = api.of(c.user.id); if (!R || !msg.d || typeof msg.d !== 'object') return;
        const me = c.user.id, s = JSON.stringify({ t: 'r', f: me, d: msg.d });
        const to = msg.to;
        if (to === undefined || to === null) {
          if (me === R.host) { for (const id of R.members) if (id !== me) ctx.sendTo(id, s); }
          else ctx.sendTo(R.host, s);
        } else if (to === 'all') { for (const id of R.members) if (id !== me) ctx.sendTo(id, s); }
        else if (R.members.includes(+to) && +to !== me) ctx.sendTo(+to, s);
      },
    };
    setInterval(() => { const t = Date.now(); for (const [k, v] of api.claims) if (v.exp < t) api.claims.delete(k); }, 10_000).unref();
    return api;
  },
  onConnect(c, ctx) {
    const A = ctx.mods.room, uid = c.user.id, g = A.grace.get(uid);
    if (g) { clearTimeout(g); A.grace.delete(uid); }
    const R = A.of(uid); if (!R) return;
    for (const id of R.members) if (id !== uid) ctx.sendTo(id, { t: 'room:lag', id: R.id, user: uid, on: false });
    const v = { id: R.id, kind: R.kind, host: R.host, members: R.members.map(id => ({ id, name: (ctx.findUser(id) || {}).name, online: ctx.isOnline(id) })), meta: R.meta };
    c.send({ t: 'room', room: v, resume: true });
  },
  onClose(c, ctx) {
    if (c.replaced) return;
    const A = ctx.mods.room, uid = c.user.id, R = A.of(uid);
    for (const [k, v] of A.asks) if (v.from === uid || v.to === uid) A.asks.delete(k);
    if (!R) return;
    for (const id of R.members) if (id !== uid) ctx.sendTo(id, { t: 'room:lag', id: R.id, user: uid, on: true });
    const old = A.grace.get(uid); if (old) clearTimeout(old);
    const wait = R.kind === 'duel' ? Math.min(ctx.cfg.graceMs, 10_000) : ctx.cfg.graceMs;
    A.grace.set(uid, setTimeout(() => { A.grace.delete(uid); if (!ctx.isOnline(uid)) A.leave(uid, 'timeout'); }, wait));
  },
  ws: {
    // 服务端重启后：队长（或决斗发起方）重新登记队伍和房间
    'restore:host'(c, msg, ctx) {
      const A = ctx.mods.room, P = ctx.mods.party, me = c.user.id;
      if (P.of(me) || A.of(me)) return;   // 没重启过（宽限期内的普通重连）：什么都不用做
      const ids = v => Array.isArray(v) ? [...new Set(v.map(Number).filter(x => Number.isInteger(x) && x > 0 && x !== me))].slice(0, 3) : [];
      const party = ids(msg.party), rm = msg.room && typeof msg.room === 'object' && (msg.room.kind === 'dungeon' || msg.room.kind === 'duel') ? msg.room : null;
      const want = rm ? ids(rm.members) : [];
      if (rm && rm.kind === 'duel' && want.length !== 1) return;
      const rec = { host: me, party: new Set(party), want: new Set(want), got: new Set(), P: null, R: null, exp: Date.now() + ctx.cfg.restoreMs };
      if (party.length) rec.P = P.restoreCreate(me);
      if (rm) {
        const mj = rm.meta && typeof rm.meta === 'object' ? JSON.stringify(rm.meta) : '{}';
        rec.R = A.open(rm.kind, me, [me], mj.length <= 4000 ? JSON.parse(mj) : {}, rec.P ? rec.P.id : undefined, true);
      }
      if (rec.P) P.push(rec.P, 'restored');
      A.restores.set(me, rec);
      for (const [uid, cl] of A.claims) if (cl.host === me && cl.exp > Date.now() && A.restoreJoin(rec, uid)) A.claims.delete(uid);
      // 限时内没回来的成员：告诉房主（房主那边当作掉线离开）
      setTimeout(() => {
        if (A.restores.get(me) !== rec) return;
        A.restores.delete(me);
        if (rec.R && A.rooms.has(rec.R.id)) for (const uid of rec.want) if (!rec.got.has(uid)) ctx.sendTo(me, { t: 'room:left', id: rec.R.id, user: uid, why: 'timeout' });
        if (rec.P && rec.P.members.length <= 1 && P.parties.has(rec.P.id)) P.remove(me, 'disband');
      }, ctx.cfg.restoreMs).unref();
    },
    // 服务端重启后：队员（或决斗对方）认领自己的队长
    'restore:claim'(c, msg, ctx) {
      const A = ctx.mods.room, P = ctx.mods.party, me = c.user.id, host = +msg.host;
      if (!host || host === me || P.of(me) || A.of(me)) return;
      const rec = A.restores.get(host);
      if (rec && rec.exp > Date.now() && A.restoreJoin(rec, me)) return;
      A.claims.set(me, { host, exp: Date.now() + ctx.cfg.restoreMs });   // 队长还没回来：先记着，队长登记时一起处理
    },
    'room:open'(c, msg, ctx) {
      const A = ctx.mods.room, me = c.user.id;
      if (msg.kind !== 'dungeon') return;
      const P = ctx.mods.party.of(me);
      if (!P) return c.send({ t: 'party:note', text: '你还没有队伍' });
      if (P.leader !== me) return c.send({ t: 'party:note', text: '只有队长可以带队进入地下城' });
      const members = P.members.filter(id => ctx.isOnline(id) && (id === me || !(A.of(id) && A.of(id).kind === 'duel')));   // 正在决斗的队员不拉进来
      const mj = msg.meta && typeof msg.meta === 'object' ? JSON.stringify(msg.meta) : '{}', meta = mj.length <= 4000 ? JSON.parse(mj) : {};
      A.open('dungeon', me, members, meta, P.id);
    },
    r(c, msg, ctx) { ctx.mods.room.relay(c, msg); },
    'room:leave'(c, msg, ctx) { ctx.mods.room.leave(c.user.id, 'leave'); },
    'room:close'(c, msg, ctx) { const A = ctx.mods.room, R = A.of(c.user.id); if (R && R.host === c.user.id) A.close(R, str(msg.why, 20) || 'end'); },
    'duel:ask'(c, msg, ctx) {
      const A = ctx.mods.room, me = c.user.id;
      const to = typeof msg.to === 'number' ? ctx.findUser(msg.to) : ctx.findUser(str(msg.to, 32));
      const fail = text => c.send({ t: 'duel:note', text });
      if (!to || to.id === me) return fail('没有这个玩家');
      if (!ctx.isOnline(to.id)) return fail(`${to.name} 不在线`);
      if (A.of(me)) return fail('你正在地下城或决斗中');
      if (A.of(to.id)) return fail(`${to.name} 正在地下城或决斗中`);
      A.asks.set(`${to.id}:${me}`, { from: me, to: to.id, toName: to.name, exp: Date.now() + ASK_TTL });
      ctx.sendTo(to.id, { t: 'duel:asked', from: { id: me, name: c.user.name, char: c.char, build: c.build } });
      fail(`已向 ${to.name} 发起决斗，等待对方回应…`);
    },
    'duel:cancel'(c, msg, ctx) { const A = ctx.mods.room, k = `${+msg.to}:${c.user.id}`; if (A.asks.delete(k)) ctx.sendTo(+msg.to, { t: 'duel:cancelled', from: c.user.id }); },
    'duel:accept'(c, msg, ctx) {
      const A = ctx.mods.room, me = c.user.id, from = +msg.from, k = `${me}:${from}`, ask = A.asks.get(k);
      A.asks.delete(k);
      if (!ask || ask.exp < Date.now()) return c.send({ t: 'duel:note', text: '决斗邀请已经过期了' });
      if (!ctx.isOnline(from)) return c.send({ t: 'duel:note', text: '对方已经下线了' });
      if (A.of(from) || A.of(me)) return c.send({ t: 'duel:note', text: '对方正忙，稍后再试' });
      A.open('duel', from, [from, me], { theme: str(msg.theme, 20) || null });
    },
    'duel:decline'(c, msg, ctx) {
      const A = ctx.mods.room, from = +msg.from;
      if (A.asks.delete(`${c.user.id}:${from}`)) ctx.sendTo(from, { t: 'duel:declined', by: c.user.name, why: msg.why === 'busy' ? 'busy' : 'no' });
    },
  },
};
