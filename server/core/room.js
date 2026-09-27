/* 核心模块：实例房间（组队地下城 / 好友决斗）的消息转发。服务端不模拟游戏，只做成员校验和转发
   房间：{ id, kind:'dungeon'|'duel', host, members:[userId], meta }
   WS（客户端 → 服务端）：
     room:open { kind:'dungeon', meta }     队长开地下城房间（成员 = 队伍里在线的人）
     r { d, to? }                           转发：房主不写 to → 发给其他所有成员；成员不写 to → 只发给房主；to:'all' → 其他所有人；to:<userId> → 指定成员
     room:leave / room:close                离开（房主离开 = 关闭房间）/ 房主关闭
     duel:ask { to }  duel:accept { from }  duel:decline { from, why }  duel:cancel { to }   好友决斗邀请（接受后建 duel 房间，发起方当房主）
   WS（服务端 → 客户端）：room { room, resume? }、room:closed { id, why }、room:left { id, user, why }、room:lag { id, user, on }、r { f: 发送者, d }、
     duel:asked { from }、duel:declined { by, why }、duel:note { text }
   掉线：成员离线后先广播 room:lag，宽限期（cfg.graceMs）内重连回来会收到 room { resume: true } 接着玩；超时算离开（房主超时 = 房间关闭，why: 'host-lost'） */
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
      open(kind, host, members, meta, pid) {
        for (const id of members) api.leave(id, 'moved');
        const R = { id: 'r' + (seq++), kind, host, members: [...members], meta, pid, created: Date.now() };
        rooms.set(R.id, R); for (const id of members) byUser.set(id, R.id);
        const v = view(R); for (const id of members) ctx.sendTo(id, { t: 'room', room: v });
        return R;
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
    'room:open'(c, msg, ctx) {
      const A = ctx.mods.room, me = c.user.id;
      if (msg.kind !== 'dungeon') return;
      const P = ctx.mods.party.of(me);
      if (!P) return c.send({ t: 'party:note', text: '你还没有队伍' });
      if (P.leader !== me) return c.send({ t: 'party:note', text: '只有队长可以带队进入地下城' });
      const members = P.members.filter(id => ctx.isOnline(id));
      const meta = msg.meta && typeof msg.meta === 'object' ? JSON.parse(JSON.stringify(msg.meta).slice(0, 4000) || '{}') : {};
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
