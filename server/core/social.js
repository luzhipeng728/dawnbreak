/* 核心模块：在线状态、角色信息、城镇同屏（场景频道）、聊天（世界 / 队伍 / 私聊）、好友
   WS（客户端 → 服务端）：
     { t:'hello', char:{ name, cls, job, lvl, look } }        当前角色信息（进游戏 / 换角色 / 升级 / 换装时发）
     { t:'scene', id|null, x, y, f }                           进入城镇场景（null = 离开城镇：地下城 / 选角）
     { t:'pos', x, y, f, s }                                    城镇里的位置（10Hz），s = idle / walk / run
     { t:'chat', ch:'world'|'party'|'whisper', text, to? }     聊天（私聊 to = 用户名）
   WS（服务端 → 客户端）：peers / penter / pleave / pos / pchar、chat / chatlog、friend:req / friend:ok / friend:del / friend:on */
import { str, isNum, clampNum, limiter } from '../lib/util.js';

const CLS_RE = /^[a-z]{2,12}$/, KEY_RE = /^[A-Za-z0-9_:@.-]{1,48}$/;
export function cleanChar(c) {
  if (!c || typeof c !== 'object') return null;
  const look = c.look && typeof c.look === 'object' ? c.look : {};
  const key = v => typeof v === 'string' && KEY_RE.test(v) ? v : null;
  return {
    name: str(c.name, 16) || '勇士', cls: CLS_RE.test(c.cls) ? c.cls : 'sword', job: key(c.job), lvl: Math.round(clampNum(c.lvl, 1, 99, 1)),
    look: { wpn: key(look.wpn), set: key(look.set), acc: Array.isArray(look.acc) ? look.acc.map(key).filter(Boolean).slice(0, 6) : [],
      cash: look.cash && typeof look.cash === 'object' ? { pet: key(look.cash.pet), aura: key(look.cash.aura), sky8: key(look.cash.sky8) } : null },   // 商城外观：宠物 / 光环 / 天空套光效
    title: str(c.title, 24) || null, hp: clampNum(c.hp, 0, 1, 1),
  };
}
const cleanText = t => str(t, 200).replace(/[\u0000-\u001f\u007f‪-‮⁦-⁩]/g, ' ').trim().slice(0, 100);

export default {
  name: 'social',
  migrations: [
    `CREATE TABLE friends (user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, friend_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, state TEXT NOT NULL, created INTEGER NOT NULL, PRIMARY KEY (user_id, friend_id))`,
  ],
  init(ctx) {
    const { db } = ctx;
    const scenes = new Map();    // 场景 id → Set(client)
    const worldLog = [];         // 最近的世界频道消息（新上线的人能看到）
    const peerInfo = c => ({ id: c.user.id, name: c.user.name, char: c.char, x: c.pos ? c.pos.x : 0, y: c.pos ? c.pos.y : 0, f: c.pos ? c.pos.f : 1, s: c.pos ? c.pos.s : 'idle' });
    const api = {
      scenes, peerInfo, worldLog,
      friendsOf(userId) { return db.all("SELECT friend_id FROM friends WHERE user_id = ? AND state = 'ok'", userId).map(r => r.friend_id); },
      areFriends(a, b) { return !!db.get("SELECT 1 FROM friends WHERE user_id = ? AND friend_id = ? AND state = 'ok'", a, b); },
      leaveScene(c) {
        if (!c.scene) return;
        const set = scenes.get(c.scene);
        if (set) { set.delete(c); if (!set.size) scenes.delete(c.scene); const m = JSON.stringify({ t: 'pleave', id: c.user.id }); for (const o of set) o.send(m); }
        c.scene = null;
      },
      toScene(c, msg) { const set = c.scene && scenes.get(c.scene); if (!set) return; const m = JSON.stringify(msg); for (const o of set) if (o !== c) o.send(m); },
      notifyFriends(userId, msg) { for (const id of api.friendsOf(userId)) ctx.sendTo(id, msg); },
      sys(c, text) { c.send({ t: 'chat', ch: 'sys', text, at: Date.now() }); },
    };
    return api;
  },
  onConnect(c, ctx) {
    const S = ctx.mods.social;
    S.notifyFriends(c.user.id, { t: 'friend:on', id: c.user.id, on: true, char: c.char });
    if (S.worldLog.length) c.send({ t: 'chatlog', list: S.worldLog.slice(-30) });
  },
  onClose(c, ctx) {
    const S = ctx.mods.social;
    S.leaveScene(c);
    if (!c.replaced) S.notifyFriends(c.user.id, { t: 'friend:on', id: c.user.id, on: false });
  },
  ws: {
    hello(c, msg, ctx) {
      const ch = cleanChar(msg.char); if (!ch) return;
      c.char = ch;
      ctx.mods.social.toScene(c, { t: 'pchar', id: c.user.id, char: ch });
      if (ctx.mods.party) ctx.mods.party.touch(c.user.id);
    },
    scene(c, msg, ctx) {
      const S = ctx.mods.social, id = msg.id === null ? null : str(msg.id, 40);
      if (!c.char) return;   // 先 hello 再进场景
      if (id !== c.scene) S.leaveScene(c);
      c.pos = { x: clampNum(msg.x, -100, 20000, 0), y: clampNum(msg.y, -50, 500, 0), f: msg.f < 0 ? -1 : 1, s: 'idle' };
      if (!id || id === c.scene) return;
      c.scene = id;
      let set = S.scenes.get(id); if (!set) S.scenes.set(id, set = new Set());
      const list = [...set].map(S.peerInfo);
      set.add(c);
      c.send({ t: 'peers', scene: id, list });
      S.toScene(c, { t: 'penter', p: S.peerInfo(c) });
    },
    pos(c, msg, ctx) {
      if (!c.scene || !isNum(msg.x) || !isNum(msg.y)) return;
      const p = c.pos || (c.pos = {});
      p.x = clampNum(msg.x, -100, 20000, 0); p.y = clampNum(msg.y, -50, 500, 0); p.f = msg.f < 0 ? -1 : 1; p.s = msg.s === 'walk' || msg.s === 'run' ? msg.s : 'idle';
      ctx.mods.social.toScene(c, { t: 'pos', id: c.user.id, x: Math.round(p.x), y: Math.round(p.y), f: p.f, s: p.s });
    },
    chat(c, msg, ctx) {
      const S = ctx.mods.social, text = cleanText(msg.text);
      if (!text) return;
      c.chatRl = c.chatRl || limiter(6, 8);
      if (!c.chatRl(1)) { S.sys(c, '说话太快了，休息一下吧'); return; }
      const out = { t: 'chat', ch: msg.ch, from: { id: c.user.id, name: c.user.name, cname: c.char ? c.char.name : '' }, text, at: Date.now() };
      if (msg.ch === 'world') { S.worldLog.push(out); if (S.worldLog.length > 60) S.worldLog.splice(0, 20); ctx.broadcast(out); }
      else if (msg.ch === 'party') {
        const P = ctx.mods.party && ctx.mods.party.of(c.user.id);
        if (!P) { S.sys(c, '你还没有队伍'); return; }
        for (const id of P.members) ctx.sendTo(id, out);
      } else if (msg.ch === 'whisper') {
        let to; try { to = ctx.findPlayer(str(msg.to, 32)); } catch (e) { S.sys(c, e.message); return; }   // 账号名或角色名
        if (!to) { S.sys(c, '没有这个玩家'); return; }
        if (to.id === c.user.id) { S.sys(c, '不能给自己发私聊'); return; }
        out.to = { id: to.id, name: to.name };
        if (!ctx.sendTo(to.id, out)) { S.sys(c, `${to.name} 不在线`); return; }
        c.send(out);
      }
    },
  },
  routes(r, ctx) {
    const { db, err } = ctx, S = () => ctx.mods.social;
    const target = (req, q) => {
      const u = ctx.findPlayer(typeof q === 'number' ? q : str(q, 32));   // 账号名或角色名
      if (!u) throw err(404, '没有这个玩家');
      if (u.id === req.user.id) throw err(400, '不能加自己为好友');
      return u;
    };
    const info = id => { const u = ctx.findUser(id), c = ctx.client(id); return { id, name: u ? u.name : '?', online: !!c, char: c ? c.char : null, scene: c ? c.scene : null }; };
    r.get('/api/friends', { auth: true }, req => {
      const rows = db.all('SELECT friend_id, state FROM friends WHERE user_id = ?', req.user.id);
      return { friends: rows.filter(x => x.state === 'ok').map(x => info(x.friend_id)), incoming: rows.filter(x => x.state === 'in').map(x => info(x.friend_id)), outgoing: rows.filter(x => x.state === 'out').map(x => info(x.friend_id)) };
    });
    r.post('/api/friends', { auth: true, rate: [20, 60] }, req => {
      const u = target(req, req.body.user), me = req.user.id, t = Date.now();
      const cur = db.get('SELECT state FROM friends WHERE user_id = ? AND friend_id = ?', me, u.id);
      if (cur && cur.state === 'ok') throw err(400, `${u.name} 已经是你的好友了`);
      if (cur && cur.state === 'out') return { ok: true, state: 'out', name: u.name };
      if (db.get("SELECT COUNT(*) AS n FROM friends WHERE user_id = ? AND state = 'ok'", me).n >= 100) throw err(400, '好友数量已达上限（100）');
      if (cur && cur.state === 'in') {   // 对方已经申请过：直接成为好友
        db.tx(() => { db.run("UPDATE friends SET state = 'ok' WHERE user_id = ? AND friend_id = ?", me, u.id); db.run("INSERT OR REPLACE INTO friends (user_id, friend_id, state, created) VALUES (?, ?, 'ok', ?)", u.id, me, t); });
        ctx.sendTo(u.id, { t: 'friend:ok', user: info(me) });
        return { ok: true, state: 'ok', name: u.name };
      }
      db.tx(() => { db.run("INSERT OR REPLACE INTO friends (user_id, friend_id, state, created) VALUES (?, ?, 'out', ?)", me, u.id, t); db.run("INSERT OR REPLACE INTO friends (user_id, friend_id, state, created) VALUES (?, ?, 'in', ?)", u.id, me, t); });
      ctx.sendTo(u.id, { t: 'friend:req', from: { id: me, name: req.user.name } });
      return { ok: true, state: 'out', name: u.name };
    });
    r.post('/api/friends/accept', { auth: true, rate: [30, 60] }, req => {
      const u = target(req, req.body.user), me = req.user.id;
      const cur = db.get('SELECT state FROM friends WHERE user_id = ? AND friend_id = ?', me, u.id);
      if (!cur || cur.state !== 'in') throw err(400, '没有这条好友申请');
      db.tx(() => { db.run("UPDATE friends SET state = 'ok' WHERE user_id = ? AND friend_id = ?", me, u.id); db.run("UPDATE friends SET state = 'ok' WHERE user_id = ? AND friend_id = ?", u.id, me); });
      ctx.sendTo(u.id, { t: 'friend:ok', user: info(me) });
      return { ok: true, friend: info(u.id) };
    });
    r.del('/api/friends/:user', { auth: true }, req => {
      const u = ctx.findUser(req.params.user); if (!u) throw err(404, '没有这个玩家');
      db.run('DELETE FROM friends WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)', req.user.id, u.id, u.id, req.user.id);
      ctx.sendTo(u.id, { t: 'friend:del', id: req.user.id });
      return { ok: true };
    });
    // 在线玩家（按名字查某人是否在线、在哪个场景；给“玩家信息”用）
    r.get('/api/player/:name', { auth: true }, req => { const u = ctx.findUser(req.params.name); if (!u) throw err(404, '没有这个玩家'); return { ...info(u.id), friend: S().areFriends(req.user.id, u.id) }; });
  },
};
