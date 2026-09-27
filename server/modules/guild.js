// 公会（社交与经济服务）：创建（金币在客户端扣，按 rid 幂等）、职位（会长 / 副会长 / 成员）、邀请 / 申请 / 审批 / 踢人 / 转让、
// 公告与留言板、公会频道（WS guild:say）、公会等级与贡献（通关 / 深渊 / 签到）、公会技能（按等级自动生效，客户端算属性）、
// 公会商店（个人贡献兑换，按 rid 幂等）、公会排行、名牌标签（GET /api/guild/tags）
import { now } from './mail.js';
import { dayOf } from './signin.js';
const DAY = 86400000;
export const GUILD = {
  createGold: 50000, createLvl: 10, maxLvl: 10,
  exp: [0, 1000, 2500, 4500, 7000, 10000, 14000, 19000, 25000, 32000],   // 达到 Lv.(下标+1) 需要的累计经验
  members: lvl => 10 + (lvl - 1) * 2, vices: lvl => (lvl >= 5 ? 3 : 2),
  // 贡献：[每次, 每天次数上限]；公会经验和个人贡献同时增加
  gain: { clear: [10, 20], abyss: [40, 5], coop: [5, 20], signin: [30, 1] },
};
// 公会技能：按公会等级自动生效（数值克制；客户端据此加属性）
export const GUILD_PERKS = [
  { lvl: 2, name: '公会之力 I', st: { str: 5, int: 5, vit: 5, spr: 5 }, desc: '四维 +5' },
  { lvl: 3, name: '互相学习 I', st: { expUp: 0.03 }, desc: '经验获得量 +3%' },
  { lvl: 4, name: '坚韧意志', st: { hpPct: 0.02, mpPct: 0.02 }, desc: 'HP / MP 上限 +2%' },
  { lvl: 5, name: '生财有道', st: { goldUp: 0.03 }, desc: '金币获得量 +3%' },
  { lvl: 6, name: '公会之力 II', st: { str: 5, int: 5, vit: 5, spr: 5 }, desc: '四维再 +5（合计 +10）' },
  { lvl: 7, name: '元素亲和', st: { elemAll: 5 }, desc: '所有属性强化 +5' },
  { lvl: 8, name: '互相学习 II', st: { expUp: 0.02 }, desc: '经验获得量再 +2%（合计 +5%）' },
  { lvl: 9, name: '疾行', st: { mspd: 0.02 }, desc: '移动速度 +2%' },
  { lvl: 10, name: '公会之力 III', st: { str: 5, int: 5, vit: 5, spr: 5, resAll: 5 }, desc: '四维再 +5（合计 +15），所有属性抗性 +5' },
];
// 公会商店：个人贡献兑换；lvl = 公会等级要求；week = 每周限购（null 不限；once = 每人只能换一次）
export const GUILD_SHOP = [
  { id: 'crystal', key: 'crystal', n: 100, cost: 30, lvl: 1, week: null },
  { id: 'coin', key: 'coin', n: 1, cost: 40, lvl: 1, week: 10 },
  { id: 'fatigue', key: 'fatigue', n: 1, cost: 60, lvl: 1, week: 7 },
  { id: 'guard', key: 'guard', n: 1, cost: 150, lvl: 2, week: 3 },
  { id: 'elem2', key: 'm_elem2', n: 5, cost: 80, lvl: 3, week: 5 },
  { id: 'abyss', key: 'abyss_ticket', n: 1, cost: 120, lvl: 3, week: 5 },
  { id: 'box', key: 'box_magic', n: 1, cost: 250, lvl: 4, week: 3 },
  { id: 'title1', key: 'title_guild', n: 1, cost: 1500, lvl: 5, once: true },
  { id: 'ampguard', key: 'amp_guard', n: 1, cost: 400, lvl: 6, week: 1 },
  { id: 'enh7', key: 'tk_enh7', n: 1, cost: 800, lvl: 7, week: 1 },
  { id: 'title2', key: 'title_guild2', n: 1, cost: 4000, lvl: 9, once: true },
];
const ROLE = { leader: '会长', vice: '副会长', member: '成员' };
const txt = (s, n) => String(s ?? '').replace(/[\u0000-\u001f\u007f‪-‮⁦-⁩]/g, ' ').trim().slice(0, n);
const int = (v, lo, hi) => { const n = Math.floor(Number(v)); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : lo; };
const NAME_RE = /^[一-龥A-Za-z0-9·]{2,8}$/;
const GLYPH_RE = /^[一-龥A-Za-z0-9★☆♠♥♦♣◆●▲✦✿☀☾⚔]$/u;
export const lvlOf = exp => { let l = 1; for (let i = 1; i < GUILD.exp.length; i++) if (exp >= GUILD.exp[i]) l = i + 1; return Math.min(GUILD.maxLvl, l); };
const weekOf = t => { const d = new Date(t + 8 * 3600000 - 6 * 3600000), day = (d.getUTCDay() + 6) % 7; return new Date(d.getTime() - day * DAY).toISOString().slice(0, 10); };   // 周一 06:00 换周
function cleanBadge(ctx, b) {
  if (!b || typeof b !== 'object') throw ctx.err(400, '请选择徽章');
  const g = String(b.g || '');
  if (!GLYPH_RE.test(g)) throw ctx.err(400, '徽章文字只能是 1 个汉字、字母或符号');
  return { s: int(b.s, 0, 7), c: int(b.c, 0, 9), g };
}
const slog = (ctx, type, user, detail) => { if (ctx.mods.gm && ctx.mods.gm.log) ctx.mods.gm.log(type, user, detail); };

function api(ctx) {
  const db = ctx.db;
  const G = {
    memberOf: uid => db.get('SELECT m.*, g.name AS gname FROM guild_member m JOIN guild g ON g.id = m.guild_id WHERE m.user_id = ?', uid),
    guild: id => db.get('SELECT * FROM guild WHERE id = ?', id),
    members: gid => db.all('SELECT * FROM guild_member WHERE guild_id = ? ORDER BY CASE role WHEN \'leader\' THEN 0 WHEN \'vice\' THEN 1 ELSE 2 END, contrib_total DESC, joined ASC', gid),
    count: gid => db.get('SELECT COUNT(*) n FROM guild_member WHERE guild_id = ?', gid).n,
    officer: m => m && (m.role === 'leader' || m.role === 'vice'),
    // 发给公会里在线的人
    toGuild(gid, msg) { for (const m of db.all('SELECT user_id FROM guild_member WHERE guild_id = ?', gid)) ctx.sendTo(m.user_id, msg); },
    update(gid, why) { G.toGuild(gid, { t: 'guild:update', why }); },
    tagsChanged() { ctx.broadcast({ t: 'guild:tags' }); },
    // 公会动态：记进留言板（系统消息）+ 公会频道
    sys(gid, text) {
      const t = now(ctx);
      db.run('INSERT INTO guild_post (guild_id, user_id, user_name, char_name, text, created, sys) VALUES (?,?,?,?,?,?,1)', gid, null, '', '', text, t);
      G.toGuild(gid, { t: 'chat', ch: 'guild', text, at: t });
    },
    // 公会经验 + 个人贡献（带每日次数上限）；返回实际增加的量
    gain(uid, kind, times = 1) {
      const R = GUILD.gain[kind]; if (!R) return 0;
      const m = db.get('SELECT * FROM guild_member WHERE user_id = ?', uid); if (!m) return 0;
      const day = dayOf(now(ctx));
      const row = db.get('SELECT n FROM guild_contrib WHERE user_id = ? AND day = ? AND kind = ?', uid, day, kind);
      const left = R[1] - (row ? row.n : 0), k = Math.min(left, Math.max(1, times | 0));
      if (k <= 0) return 0;
      const add = R[0] * k;
      db.run('INSERT INTO guild_contrib (user_id, day, kind, n) VALUES (?,?,?,?) ON CONFLICT(user_id, day, kind) DO UPDATE SET n = n + excluded.n', uid, day, kind, k);
      db.run('UPDATE guild_member SET contrib = contrib + ?, contrib_total = contrib_total + ? WHERE user_id = ?', add, add, uid);
      const g = G.guild(m.guild_id), before = g.lvl, exp = g.exp + add, lvl = lvlOf(exp);
      db.run('UPDATE guild SET exp = ?, lvl = ? WHERE id = ?', exp, lvl, g.id);
      if (lvl > before) {
        G.sys(g.id, `公会升到了 Lv.${lvl}！${GUILD_PERKS.filter(p => p.lvl > before && p.lvl <= lvl).map(p => `解锁公会技能「${p.name}」：${p.desc}`).join('；')}`);
        if (ctx.mods.notice) ctx.mods.notice.broadcast({ kind: 'custom', text: `公会「${g.name}」升到了 Lv.${lvl}！` });
        G.update(g.id, 'lvl');
      }
      return add;
    },
    // 离开 / 被踢：删掉成员（个人贡献清零，官方做法）
    remove(uid) { db.run('DELETE FROM guild_member WHERE user_id = ?', uid); },
    disband(gid) {
      for (const t of ['guild_member', 'guild_req', 'guild_post']) db.run(`DELETE FROM ${t} WHERE guild_id = ?`, gid);
      db.run('DELETE FROM guild WHERE id = ?', gid);
    },
    join(gid, uid, role = 'member') {
      const u = ctx.findUser(uid), c = ctx.client && ctx.client(uid), ch = c && c.char;
      db.run('INSERT INTO guild_member (user_id, guild_id, role, joined, char_name, char_cls, char_lvl) VALUES (?,?,?,?,?,?,?)', uid, gid, role, now(ctx), ch ? ch.name : '', ch ? ch.cls : null, ch ? ch.lvl : 0);
      db.run('DELETE FROM guild_req WHERE user_id = ?', uid);   // 加入了一个公会：其他申请 / 邀请作废
      return u;
    },
    // 名牌标签：所有公会成员 → 公会名
    tags() { const o = {}; for (const r of db.all('SELECT m.user_id, g.name FROM guild_member m JOIN guild g ON g.id = m.guild_id')) o[r.user_id] = r.name; return o; },
    summary(g) {
      const n = G.count(g.id), leader = ctx.findUser(g.leader_id);
      return { id: g.id, name: g.name, badge: JSON.parse(g.badge), lvl: g.lvl, exp: g.exp, members: n, maxMembers: GUILD.members(g.lvl), leader: leader ? leader.name : '', joinMode: g.join_mode, intro: g.intro, created: g.created };
    },
  };
  return G;
}
// 在线状态 / 所在位置（在线的顺便把最新角色信息写回数据库，离线时显示最后一次的角色）
function memberView(ctx, m) {
  const c = ctx.client && ctx.client(m.user_id), ch = c && c.char, u = ctx.findUser(m.user_id);
  if (ch && (ch.name !== m.char_name || ch.lvl !== m.char_lvl || ch.cls !== m.char_cls)) ctx.db.run('UPDATE guild_member SET char_name = ?, char_cls = ?, char_lvl = ?, last_on = ? WHERE user_id = ?', ch.name, ch.cls, ch.lvl, now(ctx), m.user_id);
  return { id: m.user_id, name: u ? u.name : '?', role: m.role, roleName: ROLE[m.role], contrib: m.contrib, contribTotal: m.contrib_total, joined: m.joined,
    online: !!c, scene: c ? c.scene || null : null, char: ch ? { name: ch.name, cls: ch.cls, job: ch.job, lvl: ch.lvl } : { name: m.char_name, cls: m.char_cls, lvl: m.char_lvl }, lastOn: c ? now(ctx) : m.last_on };
}

export default {
  name: 'guild',
  migrations: [
    `CREATE TABLE guild (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE COLLATE NOCASE, badge TEXT NOT NULL, leader_id INTEGER NOT NULL,
      notice TEXT NOT NULL DEFAULT '', intro TEXT NOT NULL DEFAULT '', lvl INTEGER NOT NULL DEFAULT 1, exp INTEGER NOT NULL DEFAULT 0, join_mode TEXT NOT NULL DEFAULT 'apply',
      rid TEXT, created INTEGER NOT NULL)`,
    `CREATE TABLE guild_member (user_id INTEGER PRIMARY KEY, guild_id INTEGER NOT NULL, role TEXT NOT NULL, joined INTEGER NOT NULL, contrib INTEGER NOT NULL DEFAULT 0,
      contrib_total INTEGER NOT NULL DEFAULT 0, char_name TEXT NOT NULL DEFAULT '', char_cls TEXT, char_lvl INTEGER NOT NULL DEFAULT 0, last_on INTEGER)`,
    `CREATE INDEX guild_member_g ON guild_member (guild_id)`,
    `CREATE TABLE guild_req (guild_id INTEGER NOT NULL, user_id INTEGER NOT NULL, kind TEXT NOT NULL, by_id INTEGER, msg TEXT NOT NULL DEFAULT '', created INTEGER NOT NULL, PRIMARY KEY (guild_id, user_id, kind))`,
    `CREATE TABLE guild_post (id INTEGER PRIMARY KEY AUTOINCREMENT, guild_id INTEGER NOT NULL, user_id INTEGER, user_name TEXT NOT NULL DEFAULT '', char_name TEXT NOT NULL DEFAULT '', text TEXT NOT NULL, created INTEGER NOT NULL, sys INTEGER NOT NULL DEFAULT 0)`,
    `CREATE INDEX guild_post_g ON guild_post (guild_id, id)`,
    `CREATE TABLE guild_contrib (user_id INTEGER NOT NULL, day TEXT NOT NULL, kind TEXT NOT NULL, n INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (user_id, day, kind))`,
    `CREATE TABLE guild_buy (user_id INTEGER NOT NULL, rid TEXT NOT NULL, shop_id TEXT NOT NULL, cost INTEGER NOT NULL, week TEXT NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (user_id, rid))`,
  ],
  init(ctx) {
    const G = api(ctx);
    return { gain: (uid, kind, times) => G.gain(uid, kind, times), memberOf: G.memberOf, tags: G.tags, api: G, logs: new Map() };
  },
  // 上线：记最后在线时间，补发最近的公会频道消息（内存里保留每个公会最近 20 条）
  onConnect(c, ctx) {
    const m = ctx.db.get('SELECT guild_id FROM guild_member WHERE user_id = ?', c.user.id); if (!m) return;
    ctx.db.run('UPDATE guild_member SET last_on = ? WHERE user_id = ?', now(ctx), c.user.id);
    const L = ctx.mods.guild.logs.get(m.guild_id); if (L) for (const x of L) c.send(x);
  },
  ws: {
    // 公会频道：发给在线的公会成员；格式和联机组的聊天一致，chat.add 直接显示成“[公会] 名字：内容”
    'guild:say'(c, msg, ctx) {
      const text = txt(msg.text, 100); if (!text) return;
      const m = ctx.db.get('SELECT guild_id FROM guild_member WHERE user_id = ?', c.user.id);
      if (!m) { c.send({ t: 'chat', ch: 'sys', text: '你还没有加入公会', at: Date.now() }); return; }
      c.guildRl = c.guildRl || { t: 0, n: 0 };
      const t = Date.now(); if (t - c.guildRl.t > 8000) { c.guildRl.t = t; c.guildRl.n = 0; }
      if (++c.guildRl.n > 6) { c.send({ t: 'chat', ch: 'sys', text: '说话太快了，休息一下吧', at: t }); return; }
      const out = { t: 'chat', ch: 'guild', from: { id: c.user.id, name: c.user.name, cname: c.char ? c.char.name : '' }, text, at: t };
      const logs = ctx.mods.guild.logs, L = logs.get(m.guild_id) || []; L.push(out); if (L.length > 20) L.shift(); logs.set(m.guild_id, L);
      api(ctx).toGuild(m.guild_id, out);
    },
  },
  routes(r, ctx) {
    const G = api(ctx), db = ctx.db;
    const mine = req => { const m = G.memberOf(req.user.id); if (!m) throw ctx.err(400, '你还没有加入公会'); return m; };
    const officer = req => { const m = mine(req); if (!G.officer(m)) throw ctx.err(403, '只有会长和副会长可以这样做'); return m; };
    const target = (gid, name) => { const u = ctx.findUser(txt(name, 40)); if (!u) throw ctx.err(404, '没有这个玩家'); const t = db.get('SELECT * FROM guild_member WHERE user_id = ?', u.id); if (!t || t.guild_id !== gid) throw ctx.err(404, `${u.name} 不是本公会成员`); return { u, t }; };
    const who = req => `「${(req.body && txt(req.body.char, 16)) || req.user.name}」`;

    // 我的公会（没加入时返回收到的邀请和自己的申请）
    r.get('/api/guild', { auth: true }, req => {
      const uid = req.user.id, m = G.memberOf(uid), t = now(ctx);
      const base = { perks: GUILD_PERKS, gainRule: GUILD.gain, expTable: GUILD.exp, createGold: GUILD.createGold, createLvl: GUILD.createLvl, now: t };
      if (!m) {
        const invites = db.all("SELECT r.guild_id, r.created, r.by_id FROM guild_req r WHERE r.user_id = ? AND r.kind = 'invite' ORDER BY r.created DESC", uid).map(x => { const g = G.guild(x.guild_id); const by = ctx.findUser(x.by_id); return g && { ...G.summary(g), by: by ? by.name : '', at: x.created }; }).filter(Boolean);
        const applied = db.all("SELECT guild_id FROM guild_req WHERE user_id = ? AND kind = 'apply'", uid).map(x => x.guild_id);
        return { ...base, guild: null, invites, applied };
      }
      const g = G.guild(m.guild_id), week = weekOf(t), day = dayOf(t);
      const bought = {}; for (const b of db.all('SELECT shop_id, week, COUNT(*) n FROM guild_buy WHERE user_id = ? GROUP BY shop_id, week', uid)) { const o = bought[b.shop_id] ||= { week: 0, all: 0 }; o.all += b.n; if (b.week === week) o.week += b.n; }
      const today = {}; for (const x of db.all('SELECT kind, n FROM guild_contrib WHERE user_id = ? AND day = ?', uid, day)) today[x.kind] = x.n;
      const reqs = G.officer(m) ? db.all("SELECT user_id, msg, created FROM guild_req WHERE guild_id = ? AND kind = 'apply' ORDER BY created", g.id).map(x => { const u = ctx.findUser(x.user_id); const c = ctx.client && ctx.client(x.user_id); return { id: x.user_id, name: u ? u.name : '?', msg: x.msg, at: x.created, online: !!c, char: c && c.char ? { name: c.char.name, cls: c.char.cls, job: c.char.job, lvl: c.char.lvl } : null }; }) : [];
      const invited = G.officer(m) ? db.all("SELECT user_id, created FROM guild_req WHERE guild_id = ? AND kind = 'invite'", g.id).map(x => { const u = ctx.findUser(x.user_id); return { id: x.user_id, name: u ? u.name : '?', at: x.created }; }) : [];
      const posts = db.all('SELECT * FROM guild_post WHERE guild_id = ? ORDER BY id DESC LIMIT 60', g.id).map(p => ({ id: p.id, user: p.user_name, uid: p.user_id, char: p.char_name, text: p.text, at: p.created, sys: !!p.sys }));
      return { ...base, guild: { ...G.summary(g), notice: g.notice, vices: GUILD.vices(g.lvl) }, me: { role: m.role, roleName: ROLE[m.role], contrib: m.contrib, contribTotal: m.contrib_total, joined: m.joined },
        members: G.members(g.id).map(x => memberView(ctx, x)), posts, reqs, invited, today,
        shop: GUILD_SHOP.map(s => ({ ...s, bought: bought[s.id] ? (s.once ? bought[s.id].all : bought[s.id].week) : 0 })) };
    });
    r.get('/api/guild/list', { auth: true }, req => {
      const q = txt(req.query.q, 16);
      const rows = q ? db.all("SELECT * FROM guild WHERE name LIKE ? ESCAPE '\\' ORDER BY lvl DESC, exp DESC LIMIT 50", '%' + q.replace(/[\\%_]/g, c => '\\' + c) + '%') : db.all('SELECT * FROM guild ORDER BY lvl DESC, exp DESC LIMIT 50');
      const applied = new Set(db.all("SELECT guild_id FROM guild_req WHERE user_id = ? AND kind = 'apply'", req.user.id).map(x => x.guild_id));
      return { list: rows.map(g => ({ ...G.summary(g), applied: applied.has(g.id) })) };
    });
    r.get('/api/guild/rank', { auth: true }, () => ({ list: db.all('SELECT * FROM guild ORDER BY lvl DESC, exp DESC, created ASC LIMIT 50').map((g, i) => ({ rank: i + 1, ...G.summary(g) })) }));
    r.get('/api/guild/tags', { auth: true }, () => ({ map: G.tags() }));
    // 创建：金币已经在客户端扣掉（待办对账），同一个 rid 只创建一次
    r.post('/api/guild/create', { auth: true, rate: [10, 60] }, req => {
      const b = req.body || {}, uid = req.user.id, rid = txt(b.rid, 40);
      if (!rid) throw ctx.err(400, '缺少请求 id');
      const old = db.get('SELECT * FROM guild WHERE rid = ? AND leader_id = ?', rid, uid);
      if (old) return { ok: true, again: true, id: old.id };
      if (G.memberOf(uid)) throw ctx.err(400, '你已经在一个公会里了');
      const name = txt(b.name, 12);
      if (!NAME_RE.test(name)) throw ctx.err(400, '公会名要 2~8 个汉字、字母或数字');
      if (db.get('SELECT 1 FROM guild WHERE name = ?', name)) throw ctx.err(409, '这个公会名已经被使用了');
      const badge = cleanBadge(ctx, b.badge);
      const id = db.tx(() => {
        const x = db.run('INSERT INTO guild (name, badge, leader_id, rid, created, notice) VALUES (?,?,?,?,?,?)', name, JSON.stringify(badge), uid, rid, now(ctx), `欢迎来到「${name}」！`);
        const gid = Number(x.lastInsertRowid);
        G.join(gid, uid, 'leader');
        return gid;
      });
      G.sys(id, `${who(req)} 创建了公会「${name}」`);
      G.tagsChanged();
      slog(ctx, 'guild.create', req.user, { name, gold: GUILD.createGold });
      return { ok: true, id };
    });
    r.post('/api/guild/apply', { auth: true, rate: [20, 60] }, req => {
      const uid = req.user.id, g = G.guild(int(req.body.id, 0, 1e12));
      if (!g) throw ctx.err(404, '没有这个公会');
      if (G.memberOf(uid)) throw ctx.err(400, '你已经在一个公会里了');
      if (g.join_mode === 'closed') throw ctx.err(403, '这个公会暂时不招人');
      if (G.count(g.id) >= GUILD.members(g.lvl)) throw ctx.err(400, '这个公会已经满员了');
      if (g.join_mode === 'open') { G.join(g.id, uid); G.sys(g.id, `${who(req)} 加入了公会`); G.update(g.id, 'join'); G.tagsChanged(); return { ok: true, joined: true }; }
      db.run('INSERT INTO guild_req (guild_id, user_id, kind, by_id, msg, created) VALUES (?,?,?,?,?,?) ON CONFLICT(guild_id, user_id, kind) DO UPDATE SET msg = excluded.msg, created = excluded.created', g.id, uid, 'apply', uid, txt(req.body.msg, 60), now(ctx));
      G.update(g.id, 'apply');
      return { ok: true, joined: false };
    });
    r.post('/api/guild/cancelApply', { auth: true }, req => { db.run("DELETE FROM guild_req WHERE guild_id = ? AND user_id = ? AND kind = 'apply'", int(req.body.id, 0, 1e12), req.user.id); return { ok: true }; });
    r.post('/api/guild/invite', { auth: true, rate: [30, 60] }, req => {
      const m = officer(req), g = G.guild(m.guild_id);
      const u = ctx.findUser(typeof req.body.user === 'number' ? req.body.user : txt(req.body.user, 40));
      if (!u) throw ctx.err(404, '没有这个玩家');
      if (u.id === req.user.id) throw ctx.err(400, '不能邀请自己');
      const t = G.memberOf(u.id); if (t) throw ctx.err(400, t.guild_id === g.id ? `${u.name} 已经是本公会成员了` : `${u.name} 已经加入了别的公会`);
      if (G.count(g.id) >= GUILD.members(g.lvl)) throw ctx.err(400, '公会已经满员了');
      db.run('INSERT INTO guild_req (guild_id, user_id, kind, by_id, created) VALUES (?,?,?,?,?) ON CONFLICT(guild_id, user_id, kind) DO UPDATE SET by_id = excluded.by_id, created = excluded.created', g.id, u.id, 'invite', req.user.id, now(ctx));
      const online = ctx.sendTo(u.id, { t: 'guild:invite', id: g.id, guild: g.name, badge: JSON.parse(g.badge), from: req.user.name });
      return { ok: true, online };
    });
    r.post('/api/guild/accept', { auth: true }, req => {
      const uid = req.user.id, g = G.guild(int(req.body.id, 0, 1e12));
      if (!g || !db.get("SELECT 1 FROM guild_req WHERE guild_id = ? AND user_id = ? AND kind = 'invite'", g.id, uid)) throw ctx.err(404, '邀请已经失效了');
      if (G.memberOf(uid)) throw ctx.err(400, '你已经在一个公会里了');
      if (G.count(g.id) >= GUILD.members(g.lvl)) throw ctx.err(400, '公会已经满员了');
      G.join(g.id, uid); G.sys(g.id, `${who(req)} 接受邀请，加入了公会`); G.update(g.id, 'join'); G.tagsChanged();
      return { ok: true };
    });
    r.post('/api/guild/decline', { auth: true }, req => { db.run("DELETE FROM guild_req WHERE guild_id = ? AND user_id = ? AND kind = 'invite'", int(req.body.id, 0, 1e12), req.user.id); return { ok: true }; });
    r.post('/api/guild/approve', { auth: true }, req => {
      const m = officer(req), g = G.guild(m.guild_id), u = ctx.findUser(typeof req.body.user === 'number' ? req.body.user : txt(req.body.user, 40));
      if (!u || !db.get("SELECT 1 FROM guild_req WHERE guild_id = ? AND user_id = ? AND kind = 'apply'", g.id, u.id)) throw ctx.err(404, '申请已经失效了');
      if (!req.body.ok) { db.run("DELETE FROM guild_req WHERE guild_id = ? AND user_id = ? AND kind = 'apply'", g.id, u.id); ctx.sendTo(u.id, { t: 'chat', ch: 'sys', text: `公会「${g.name}」拒绝了你的申请`, at: Date.now() }); return { ok: true }; }
      if (G.memberOf(u.id)) { db.run('DELETE FROM guild_req WHERE user_id = ?', u.id); throw ctx.err(400, `${u.name} 已经加入了别的公会`); }
      if (G.count(g.id) >= GUILD.members(g.lvl)) throw ctx.err(400, '公会已经满员了');
      G.join(g.id, u.id);
      const c = ctx.client && ctx.client(u.id);
      G.sys(g.id, `「${c && c.char ? c.char.name : u.name}」加入了公会（${ROLE[m.role]}${who(req)}批准）`);
      ctx.sendTo(u.id, { t: 'guild:update', why: 'approved', guild: g.name }); G.update(g.id, 'join'); G.tagsChanged();
      return { ok: true };
    });
    r.post('/api/guild/kick', { auth: true }, req => {
      const m = officer(req), { u, t } = target(m.guild_id, req.body.user);
      if (u.id === req.user.id) throw ctx.err(400, '不能请离自己');
      if (t.role === 'leader' || (t.role === 'vice' && m.role !== 'leader')) throw ctx.err(403, '不能请离职位比你高或和你一样的人');
      G.remove(u.id); G.sys(m.guild_id, `「${t.char_name || u.name}」被请离了公会`);
      ctx.sendTo(u.id, { t: 'guild:update', why: 'kicked' }); G.update(m.guild_id, 'kick'); G.tagsChanged();
      return { ok: true };
    });
    r.post('/api/guild/role', { auth: true }, req => {
      const m = mine(req); if (m.role !== 'leader') throw ctx.err(403, '只有会长可以任命职位');
      const { u, t } = target(m.guild_id, req.body.user), role = req.body.role === 'vice' ? 'vice' : 'member', g = G.guild(m.guild_id);
      if (t.role === 'leader') throw ctx.err(400, '会长的职位请用“转让会长”');
      if (role === 'vice' && t.role !== 'vice' && db.get("SELECT COUNT(*) n FROM guild_member WHERE guild_id = ? AND role = 'vice'", g.id).n >= GUILD.vices(g.lvl)) throw ctx.err(400, `副会长最多 ${GUILD.vices(g.lvl)} 人`);
      db.run('UPDATE guild_member SET role = ? WHERE user_id = ?', role, u.id);
      G.sys(g.id, `「${t.char_name || u.name}」的职位变为${ROLE[role]}`); G.update(g.id, 'role');
      return { ok: true };
    });
    r.post('/api/guild/transfer', { auth: true }, req => {
      const m = mine(req); if (m.role !== 'leader') throw ctx.err(403, '只有会长可以转让');
      const { u, t } = target(m.guild_id, req.body.user);
      if (u.id === req.user.id) throw ctx.err(400, '你已经是会长了');
      db.tx(() => {
        db.run("UPDATE guild_member SET role = 'vice' WHERE user_id = ?", req.user.id);
        db.run("UPDATE guild_member SET role = 'leader' WHERE user_id = ?", u.id);
        db.run('UPDATE guild SET leader_id = ? WHERE id = ?', u.id, m.guild_id);
      });
      G.sys(m.guild_id, `会长${who(req)}把会长转让给了「${t.char_name || u.name}」`); G.update(m.guild_id, 'role');
      return { ok: true };
    });
    r.post('/api/guild/leave', { auth: true }, req => {
      const m = mine(req);
      if (m.role === 'leader') {
        if (G.count(m.guild_id) > 1) throw ctx.err(400, '会长要先把会长转让给别人才能离开');
        const g = G.guild(m.guild_id); G.disband(g.id); G.tagsChanged(); slog(ctx, 'guild.disband', req.user, { name: g.name });
        return { ok: true, disbanded: true };
      }
      G.remove(req.user.id); G.sys(m.guild_id, `${who(req)} 离开了公会`); G.update(m.guild_id, 'leave'); G.tagsChanged();
      return { ok: true };
    });
    r.post('/api/guild/disband', { auth: true }, req => {
      const m = mine(req); if (m.role !== 'leader') throw ctx.err(403, '只有会长可以解散公会');
      const g = G.guild(m.guild_id);
      if (txt(req.body.name, 12).toLowerCase() !== g.name.toLowerCase()) throw ctx.err(400, '请输入公会名确认');
      const ids = db.all('SELECT user_id FROM guild_member WHERE guild_id = ?', g.id).map(x => x.user_id);
      G.disband(g.id);
      for (const id of ids) ctx.sendTo(id, { t: 'guild:update', why: 'disband', guild: g.name });
      G.tagsChanged(); slog(ctx, 'guild.disband', req.user, { name: g.name });
      return { ok: true };
    });
    r.post('/api/guild/notice', { auth: true, rate: [20, 60] }, req => {
      const m = officer(req), text = String(req.body.text ?? '').replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, ' ').slice(0, 300);
      db.run('UPDATE guild SET notice = ? WHERE id = ?', text, m.guild_id); G.update(m.guild_id, 'notice');
      return { ok: true };
    });
    r.post('/api/guild/set', { auth: true, rate: [20, 60] }, req => {
      const m = officer(req), b = req.body || {};
      if (b.intro !== undefined) db.run('UPDATE guild SET intro = ? WHERE id = ?', txt(b.intro, 60), m.guild_id);
      if (b.joinMode !== undefined) db.run('UPDATE guild SET join_mode = ? WHERE id = ?', ['apply', 'open', 'closed'].includes(b.joinMode) ? b.joinMode : 'apply', m.guild_id);
      if (b.badge !== undefined) { if (m.role !== 'leader') throw ctx.err(403, '只有会长可以修改徽章'); db.run('UPDATE guild SET badge = ? WHERE id = ?', JSON.stringify(cleanBadge(ctx, b.badge)), m.guild_id); G.tagsChanged(); }
      G.update(m.guild_id, 'set');
      return { ok: true };
    });
    r.post('/api/guild/post', { auth: true, rate: [10, 60] }, req => {
      const m = mine(req), text = txt(req.body.text, 120); if (!text) throw ctx.err(400, '请写点什么');
      const x = db.run('INSERT INTO guild_post (guild_id, user_id, user_name, char_name, text, created) VALUES (?,?,?,?,?,?)', m.guild_id, req.user.id, req.user.name, txt(req.body.char, 16), text, now(ctx));
      const cnt = db.get('SELECT COUNT(*) n FROM guild_post WHERE guild_id = ?', m.guild_id).n;
      if (cnt > 300) db.run('DELETE FROM guild_post WHERE guild_id = ? AND id IN (SELECT id FROM guild_post WHERE guild_id = ? ORDER BY id ASC LIMIT ?)', m.guild_id, m.guild_id, cnt - 300);
      G.update(m.guild_id, 'post');
      return { ok: true, id: Number(x.lastInsertRowid) };
    });
    r.del('/api/guild/post/:id', { auth: true }, req => {
      const m = mine(req), p = db.get('SELECT * FROM guild_post WHERE id = ? AND guild_id = ?', int(req.params.id, 0, 1e12), m.guild_id);
      if (!p) throw ctx.err(404, '没有这条留言');
      if (p.user_id !== req.user.id && !G.officer(m)) throw ctx.err(403, '只能删除自己的留言');
      db.run('DELETE FROM guild_post WHERE id = ?', p.id); G.update(m.guild_id, 'post');
      return { ok: true };
    });
    // 贡献：通关地下城 / 深渊 / 组队通关（签到由 signin 模块在服务端直接加）
    r.post('/api/guild/contrib', { auth: true, rate: [60, 60] }, req => {
      const kind = ['clear', 'abyss', 'coop'].includes(req.body.kind) ? req.body.kind : null;
      if (!kind) throw ctx.err(400, '不支持的贡献类型');
      const m = G.memberOf(req.user.id); if (!m) return { ok: true, gain: 0 };
      const gain = G.gain(req.user.id, kind);
      const me = db.get('SELECT contrib, contrib_total FROM guild_member WHERE user_id = ?', req.user.id), g = G.guild(m.guild_id);
      return { ok: true, gain, contrib: me.contrib, contribTotal: me.contrib_total, lvl: g.lvl, exp: g.exp };
    });
    // 公会商店：服务端扣个人贡献，按 rid 幂等返回物品，由客户端放进背包（和领取邮件附件同一套对账）
    r.post('/api/guild/shop/buy', { auth: true, rate: [30, 60] }, req => {
      const uid = req.user.id, rid = txt(req.body.rid, 40);
      if (!rid) throw ctx.err(400, '缺少请求 id');
      const old = db.get('SELECT * FROM guild_buy WHERE user_id = ? AND rid = ?', uid, rid);
      if (old) { const S = GUILD_SHOP.find(s => s.id === old.shop_id); return { ok: true, again: true, items: S ? [{ key: S.key, n: S.n }] : [], cost: old.cost }; }
      const m = mine(req), g = G.guild(m.guild_id), S = GUILD_SHOP.find(s => s.id === req.body.id);
      if (!S) throw ctx.err(404, '没有这件商品');
      if (g.lvl < S.lvl) throw ctx.err(403, `公会 Lv.${S.lvl} 才能兑换`);
      const t = now(ctx), week = weekOf(t);
      if (S.once && db.get('SELECT 1 FROM guild_buy WHERE user_id = ? AND shop_id = ?', uid, S.id)) throw ctx.err(400, '每人只能兑换一次');
      if (S.week && db.get('SELECT COUNT(*) n FROM guild_buy WHERE user_id = ? AND shop_id = ? AND week = ?', uid, S.id, week).n >= S.week) throw ctx.err(400, `本周已经兑换了 ${S.week} 次，下周一再来`);
      const res = db.tx(() => {
        const x = db.run('UPDATE guild_member SET contrib = contrib - ? WHERE user_id = ? AND contrib >= ?', S.cost, uid, S.cost);
        if (!x.changes) throw ctx.err(400, `个人贡献不足（需要 ${S.cost}）`);
        db.run('INSERT INTO guild_buy (user_id, rid, shop_id, cost, week, at) VALUES (?,?,?,?,?,?)', uid, rid, S.id, S.cost, week, t);
        return db.get('SELECT contrib FROM guild_member WHERE user_id = ?', uid).contrib;
      });
      slog(ctx, 'guild.shop', req.user, { item: `${S.key}×${S.n}`, cost: S.cost });
      return { ok: true, items: [{ key: S.key, n: S.n }], cost: S.cost, contrib: res };
    });
  },
};
