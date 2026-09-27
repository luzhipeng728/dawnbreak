/* 核心模块：队伍（最多 4 人，官方就是 4 人），只存在内存里（服务端重启即解散）
   WS（客户端 → 服务端）：party:invite { to: 用户 id 或名字 }、party:accept { from }、party:decline { from }、party:leave、party:kick { id }、party:lead { id }
   WS（服务端 → 客户端）：party { party: { id, leader, members:[{ id, name, char, online, build }] } | null, why? }、party:invited { from }、party:declined { by, why }、party:note { text }
   掉线：成员离线后保留 cfg.graceMs（默认 20 秒），期间重连回来接着在队里；超时自动离队（队长超时 → 队长移交给下一个在线成员） */
import { str } from '../lib/util.js';

export const PARTY_MAX = 4;
const INVITE_TTL = 30_000;

export default {
  name: 'party',
  init(ctx) {
    const parties = new Map(), byUser = new Map(), invites = new Map(), grace = new Map();
    let seq = 1;
    setInterval(() => { const t = Date.now(); for (const [k, v] of invites) if (v.exp < t) invites.delete(k); }, 60_000).unref();
    const info = id => { const c = ctx.client(id), u = c ? c.user : ctx.findUser(id); return { id, name: u ? u.name : '?', char: c ? c.char : null, online: !!c, build: c ? c.build : '' }; };
    const view = P => P && { id: P.id, leader: P.leader, members: P.members.map(info) };
    const note = (P, text, skip) => { for (const id of P.members) if (id !== skip) ctx.sendTo(id, { t: 'party:note', text }); };
    const api = {
      parties, PARTY_MAX,
      of: uid => parties.get(byUser.get(uid)),
      view,
      push(P, why) { const v = view(P); for (const id of P.members) ctx.sendTo(id, { t: 'party', party: v, why }); },
      touch(uid) { const P = api.of(uid); if (P) api.push(P); },
      // 把某人移出队伍（离开 / 被踢 / 掉线超时）
      remove(uid, why) {
        const P = api.of(uid); if (!P) return;
        P.members = P.members.filter(x => x !== uid); byUser.delete(uid);
        const g = grace.get(uid); if (g) { clearTimeout(g); grace.delete(uid); }
        ctx.sendTo(uid, { t: 'party', party: null, why });
        if (ctx.mods.room) ctx.mods.room.onPartyLeave(uid, P, why);
        if (P.members.length <= 1) {   // 只剩一个人：解散
          for (const id of P.members) { byUser.delete(id); ctx.sendTo(id, { t: 'party', party: null, why: 'disband' }); }
          parties.delete(P.id); return;
        }
        if (P.leader === uid) P.leader = P.members.find(id => ctx.isOnline(id)) || P.members[0];
        const u = ctx.findUser(uid);
        note(P, `${u ? u.name : '队员'} ${why === 'kick' ? '被移出了队伍' : why === 'timeout' ? '掉线，已离开队伍' : '离开了队伍'}`);
        api.push(P);
      },
      create(a, b) {
        const P = { id: 'p' + (seq++), leader: a, members: [a, b], created: Date.now() };
        parties.set(P.id, P); byUser.set(a, P.id); byUser.set(b, P.id); return P;
      },
      join(uid, P) { if (!P.members.includes(uid)) P.members.push(uid); byUser.set(uid, P.id); },
      invites, grace,
    };
    return api;
  },
  onConnect(c, ctx) {
    const A = ctx.mods.party, g = A.grace.get(c.user.id);
    if (g) { clearTimeout(g); A.grace.delete(c.user.id); }
    const P = A.of(c.user.id); if (!P) return;
    A.push(P);   // 重连回来：刷新队伍的在线状态
  },
  onClose(c, ctx) {
    if (c.replaced) return;
    const A = ctx.mods.party, P = A.of(c.user.id); if (!P) return;
    A.push(P);
    const uid = c.user.id;
    // 宽限期后仍未重连 → 离队
    const old = A.grace.get(uid); if (old) clearTimeout(old);
    A.grace.set(uid, setTimeout(() => { A.grace.delete(uid); if (!ctx.isOnline(uid)) A.remove(uid, 'timeout'); }, ctx.cfg.graceMs));
  },
  ws: {
    'party:invite'(c, msg, ctx) {
      const A = ctx.mods.party, me = c.user.id;
      const to = typeof msg.to === 'number' ? ctx.findUser(msg.to) : ctx.findUser(str(msg.to, 32));
      const fail = text => c.send({ t: 'party:note', text });
      if (!to) return fail('没有这个玩家');
      if (to.id === me) return fail('不能邀请自己');
      if (!ctx.isOnline(to.id)) return fail(`${to.name} 不在线`);
      const P = A.of(me);
      if (P && P.leader !== me) return fail('只有队长可以邀请队员');
      if (P && P.members.length >= PARTY_MAX) return fail(`队伍已满（最多 ${PARTY_MAX} 人）`);
      if (P && ctx.mods.room && ctx.mods.room.partyBusy(P)) return fail('队伍正在地下城里，回城后再邀请');
      if (A.of(to.id)) return fail(`${to.name} 已经有队伍了`);
      A.invites.set(`${to.id}:${me}`, { exp: Date.now() + INVITE_TTL });
      ctx.sendTo(to.id, { t: 'party:invited', from: { id: me, name: c.user.name, char: c.char, build: c.build }, size: P ? P.members.length : 1 });
      c.send({ t: 'party:note', text: `已向 ${to.name} 发出组队邀请` });
    },
    'party:accept'(c, msg, ctx) {
      const A = ctx.mods.party, me = c.user.id, from = +msg.from, k = `${me}:${from}`, I = A.invites.get(k);
      const fail = text => c.send({ t: 'party:note', text });
      A.invites.delete(k);
      if (!I || I.exp < Date.now()) return fail('邀请已经过期了');
      if (A.of(me)) return fail('你已经在队伍里了，先离开当前队伍');
      if (!ctx.isOnline(from)) return fail('对方已经下线了');
      let P = A.of(from);
      if (P && P.leader !== from) return fail('对方已经不是队长了');
      if (P && P.members.length >= PARTY_MAX) return fail('队伍已满');
      if (P && ctx.mods.room && ctx.mods.room.partyBusy(P)) return fail('队伍正在地下城里，稍后再试');
      if (!P) P = A.create(from, me); else A.join(me, P);
      for (const id of P.members) if (id !== me) ctx.sendTo(id, { t: 'party:note', text: `${c.user.name} 加入了队伍` });
      A.push(P);
    },
    'party:decline'(c, msg, ctx) {
      const A = ctx.mods.party, from = +msg.from;
      A.invites.delete(`${c.user.id}:${from}`);
      ctx.sendTo(from, { t: 'party:declined', by: c.user.name, why: msg.why === 'busy' ? 'busy' : 'no' });
    },
    'party:leave'(c, msg, ctx) { ctx.mods.party.remove(c.user.id, 'leave'); },
    'party:kick'(c, msg, ctx) {
      const A = ctx.mods.party, P = A.of(c.user.id), id = +msg.id;
      if (!P || P.leader !== c.user.id) return c.send({ t: 'party:note', text: '只有队长可以请离队员' });
      if (id === c.user.id || !P.members.includes(id)) return;
      A.remove(id, 'kick');
    },
    'party:lead'(c, msg, ctx) {
      const A = ctx.mods.party, P = A.of(c.user.id), id = +msg.id;
      if (!P || P.leader !== c.user.id || !P.members.includes(id) || id === c.user.id) return;
      if (ctx.mods.room && ctx.mods.room.partyBusy(P)) return c.send({ t: 'party:note', text: '地下城里不能移交队长' });
      if (!ctx.isOnline(id)) return c.send({ t: 'party:note', text: '对方不在线' });
      P.leader = id;
      const u = ctx.findUser(id);
      for (const m of P.members) ctx.sendTo(m, { t: 'party:note', text: `${u ? u.name : '队员'} 成为了新队长` });
      A.push(P);
    },
  },
};
