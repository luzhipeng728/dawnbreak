/* 决斗场（排位赛）：自动匹配 + 段位积分（Elo）+ 没人时 AI 补位 + 每日胜利奖励；排行榜在 rank.js 的 arena 榜
   积分按角色（user_id + cid，cid = 角色创建时间，和 rank.js 一样）；防刷规则按账号
   WS（客户端 → 服务端）：
     arena:join { cid, char { name, cls, job } }   进入匹配队列（在城镇里、不在地下城 / 决斗房间里）
     arena:leave                                    退出队列
     arena:end { id, win, draw, abort? }            本局结果（abort 1 = 没能开打 → 作废，2 = 中途离开 → 判负）（真人：双方各报一次，一致才算；只有一方报了就等 cfg.arenaReportMs 后按它算；AI：客户端报）
   WS（服务端 → 客户端）：
     arena:queued { rating, tier, n, aiAfter } / arena:left { why } / arena:note { text }
     arena:match { id, ai, host, vs { name, cls, job, rating, tier, lvl? }, rating }   匹配成功（真人对战随后会收到 room { kind:'duel', meta:{ arena:id } }，走好友决斗的同一套流程）
     arena:result { id, win, draw, void, why, delta, rating, tier, ai, reward }
   规则（docs/NETWORK.md「决斗场排位」）：
     - 匹配：积分差在范围内（100 起，每等 1 秒 +30，最多 600）；不和自己、不和 cfg.arenaRematchMs 内刚打过的账号再匹配；断线 / 进地下城就移出队列
     - AI 补位：等了 cfg.arenaAiMs（默认 12 秒）还没有真人，就给一个 AI 对手（18 种职业 / 转职随机，名字像玩家，积分在你附近，难度按段位）
     - AI 局只给一半积分，而且白金（1500）以上赢 AI 不再加分——天梯上半段只能靠打真人（防刷）
     - 逃跑：真人对局开打（cfg.arenaForfeitMs）之后掉线 / 离开 = 判负；开打前取消不计；双方报的结果对不上 = 作废
     - AI 局超过 cfg.arenaAiTimeout 还没报结果 / 重新排队时还有没报完的 AI 局 = 判负 */
import { now } from './mail.js';
import { dayOf } from './signin.js';

const START = 1000, K = 32, AI_GAIN = 0.5, AI_CAP = 1500, FLOOR = 0;
export const TIERS = [[0, '青铜'], [1100, '白银'], [1300, '黄金'], [1500, '白金'], [1700, '钻石'], [1900, '斗神']];
export const tierOf = r => { let t = TIERS[0][1]; for (const [lo, n] of TIERS) if (r >= lo) t = n; return t; };
export const REWARD = { gold: 2000, aiGold: 1000, goldWins: 10, cera: 5, ceraCap: 30, first: { gold: 5000, cera: 20 } };
const DEF = { arenaAiMs: 12_000, arenaRematchMs: 300_000, arenaReportMs: 15_000, arenaForfeitMs: 30_000, arenaMinMs: 15_000, arenaAiTimeout: 360_000 };
// AI 对手的职业：3 个基础职业 + 15 个转职 = 18 种
export const AI_POOL = { sword: [null, 'blade', 'berserker', 'asura', 'soulbender', 'ghostblade'], gun: [null, 'ranger', 'launcher', 'spitfire', 'mechanic', 'paramedic'], mage: [null, 'elemental', 'battlemage', 'summoner', 'witch', 'enchantress'] };
const ALL18 = Object.entries(AI_POOL).flatMap(([c, js]) => js.map(j => [c, j]));
const W1 = ['夜', '风', '影', '月', '雪', '星', '烈', '寒', '墨', '苍', '白', '赤', '紫', '青', '孤', '醉', '狂', '暗', '轻', '碎', '冷', '天'];
const W2 = ['刃', '殇', '歌', '羽', '枫', '痕', '魂', '梦', '光', '尘', '澜', '斩', '翼', '泪', '神', '瞳', '歌', '寂'];
const WORD = ['剑舞', '倾城', '无双', '残月', '星辰', '流光', '落雪', '破晓', '天涯', '轮回', '逍遥', '战神', '狂刀', '幽冥', '霜华', '绯夜', '浮生', '一念', '清风', '南城'];
const pick = a => a[Math.floor(Math.random() * a.length)];
export function aiName() {
  const r = Math.random();
  if (r < 0.3) return pick(W1) + pick(['丶', '之', '']) + pick(W2);
  if (r < 0.55) return pick(WORD) + pick(['丶', '', '·']) + pick(W2);
  if (r < 0.75) return pick(WORD) + pick(WORD);
  if (r < 0.9) return '小' + pick(W1) + pick(W2) + pick(['', '', '酱', '丫']);
  return pick(WORD) + (Math.floor(Math.random() * 900) + 10);
}
export const aiLevel = r => r < 1150 ? 1 : r < 1500 ? 2 : 3;   // 段位越高 AI 越强（fighter_ai.js 的难度 1..3）
export const expect = (ra, rb) => 1 / (1 + 10 ** ((rb - ra) / 400));
const txt = (s, n) => String(s ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, n);
const cidOf = v => txt(v, 24) || '0';
const KEY_RE = /^[a-z][a-z0-9_]{0,23}$/;

export default {
  name: 'arena',
  migrations: [
    `CREATE TABLE arena (user_id INTEGER NOT NULL, cid TEXT NOT NULL, user_name TEXT NOT NULL, char_name TEXT NOT NULL DEFAULT '', cls TEXT, job TEXT,
      rating INTEGER NOT NULL DEFAULT ${START}, best INTEGER NOT NULL DEFAULT ${START}, win INTEGER NOT NULL DEFAULT 0, lose INTEGER NOT NULL DEFAULT 0, draw INTEGER NOT NULL DEFAULT 0,
      ai_win INTEGER NOT NULL DEFAULT 0, ai_lose INTEGER NOT NULL DEFAULT 0, updated INTEGER NOT NULL, PRIMARY KEY (user_id, cid))`,
    `CREATE INDEX arena_rating ON arena (rating DESC)`,
    `CREATE TABLE arena_match (id TEXT PRIMARY KEY, a INTEGER NOT NULL, a_cid TEXT NOT NULL, b INTEGER, b_cid TEXT, ai TEXT, ra INTEGER NOT NULL, rb INTEGER NOT NULL,
      created INTEGER NOT NULL, done INTEGER, result TEXT, winner INTEGER, da INTEGER, db INTEGER)`,
    `CREATE INDEX arena_match_open ON arena_match (done, created)`,
    `CREATE TABLE arena_day (user_id INTEGER NOT NULL, day TEXT NOT NULL, wins INTEGER NOT NULL DEFAULT 0, cera INTEGER NOT NULL DEFAULT 0, first INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (user_id, day))`,
  ],
  init(ctx) {
    const C = k => ctx.cfg[k] ?? DEF[k];
    const queue = new Map(), matches = new Map(), recent = new Map();
    let seq = 1, sweepN = 0;
    const row = (uid, cid) => ctx.db.get('SELECT * FROM arena WHERE user_id = ? AND cid = ?', uid, cid);
    const view = r => ({ rating: r ? r.rating : START, tier: tierOf(r ? r.rating : START), best: r ? r.best : START, win: r ? r.win : 0, lose: r ? r.lose : 0, draw: r ? r.draw : 0, aiWin: r ? r.ai_win : 0, aiLose: r ? r.ai_lose : 0 });
    const today = uid => ctx.db.get('SELECT wins, cera, first FROM arena_day WHERE user_id = ? AND day = ?', uid, dayOf(now(ctx))) || { wins: 0, cera: 0, first: 0 };
    const metRecently = (a, b) => { const m = recent.get(a); return !!(m && m.get(b) > Date.now() - C('arenaRematchMs')); };
    const remember = (a, b) => { for (const [x, y] of [[a, b], [b, a]]) { let m = recent.get(x); if (!m) recent.set(x, m = new Map()); m.set(y, Date.now()); } };
    const band = w => Math.min(600, 100 + 30 * Math.floor(w / 1000));
    const newId = () => 'm' + ctx.cfg.boot + '_' + (seq++);
    function load(id) {   // 服务端重启后内存里没有：从数据库恢复（排位房间会随好友决斗的恢复流程一起恢复）
      let M = matches.get(id); if (M) return M;
      const r = ctx.db.get('SELECT * FROM arena_match WHERE id = ? AND done IS NULL', id); if (!r) return null;
      M = { id, a: r.a, aCid: r.a_cid, b: r.b, bCid: r.b_cid, ai: r.ai ? JSON.parse(r.ai) : null, ra: r.ra, rb: r.rb, created: r.created, rep: {}, done: false };
      matches.set(id, M); return M;
    }
    function reward(uid, ai) {
      const t = today(uid), day = dayOf(now(ctx));
      const gold = t.wins < REWARD.goldWins ? (ai ? REWARD.aiGold : REWARD.gold) : 0, cera = Math.max(0, Math.min(REWARD.cera, REWARD.ceraCap - t.cera));
      const first = !t.first, R = { gold: gold + (first ? REWARD.first.gold : 0), cera: cera + (first ? REWARD.first.cera : 0), first };
      ctx.db.run(`INSERT INTO arena_day (user_id, day, wins, cera, first) VALUES (?,?,1,?,1) ON CONFLICT(user_id, day) DO UPDATE SET wins = wins + 1, cera = cera + ?, first = 1`, uid, day, cera, cera);
      if (R.gold || R.cera) ctx.mods.mail.send(uid, { kind: 'sys', from: '决斗场', title: first ? '决斗场今日首胜奖励' : '决斗场胜利奖励', body: first ? '今日首胜！额外奖励已放入附件。' : '恭喜获胜！', gold: R.gold, cera: R.cera, days: 30 });
      return R;
    }
    // 结算：winner = 胜者 userId | 0（AI 赢）| -1 平局 | null 作废
    function settle(M, winner, why) {
      if (!M || M.done) return; M.done = true; clearTimeout(M.timer); matches.delete(M.id);
      const t = now(ctx), side = [[M.a, M.aCid, M.ra, M.rb], ...(M.b ? [[M.b, M.bCid, M.rb, M.ra]] : [])];
      if (winner === null) {
        ctx.db.run('UPDATE arena_match SET done = ?, result = ? WHERE id = ?', t, why, M.id);
        for (const [uid] of side) ctx.sendTo(uid, { t: 'arena:result', id: M.id, void: true, why });
        return;
      }
      const out = ctx.db.tx(() => {
        const res = [];
        for (const [uid, cid, r, ro] of side) {
          const s = winner === -1 ? 0.5 : winner === uid ? 1 : 0;
          let d = Math.round(K * (s - expect(r, ro)));
          if (M.ai) { d = Math.round(d * AI_GAIN); if (d > 0 && r >= AI_CAP) d = 0; }
          else if (s === 1 && d < 1) d = 1;
          const w = s === 1 ? 1 : 0, l = s === 0 ? 1 : 0, dr = s === 0.5 ? 1 : 0;
          ctx.db.run(`UPDATE arena SET rating = MAX(${FLOOR}, rating + ?), best = MAX(best, rating + ?), win = win + ?, lose = lose + ?, draw = draw + ?, ai_win = ai_win + ?, ai_lose = ai_lose + ?, updated = ? WHERE user_id = ? AND cid = ?`,
            d, d, M.ai ? 0 : w, M.ai ? 0 : l, dr, M.ai ? w : 0, M.ai ? l : 0, t, uid, cid);
          const rw = w ? reward(uid, !!M.ai) : null;
          res.push({ uid, d, w, dr, rw, cur: (row(uid, cid) || {}).rating ?? START });
        }
        ctx.db.run('UPDATE arena_match SET done = ?, result = ?, winner = ?, da = ?, db = ? WHERE id = ?', t, why, winner, res[0].d, res[1] ? res[1].d : null, M.id);
        return res;
      });
      for (const x of out) ctx.sendTo(x.uid, { t: 'arena:result', id: M.id, win: !!x.w, draw: !!x.dr, why, delta: x.d, rating: x.cur, tier: tierOf(x.cur), ai: !!M.ai, reward: x.rw });
      if (ctx.mods.gm && ctx.mods.gm.log) ctx.mods.gm.log('arena', { id: M.a, name: (ctx.findUser(M.a) || {}).name }, { id: M.id, vs: M.b || 'AI', winner, why, d: out.map(x => x.d) });
    }
    function openMatch(a, b, ai) {
      const M = { id: newId(), a: a.uid, aCid: a.cid, b: b ? b.uid : null, bCid: b ? b.cid : null, ai, ra: a.rating, rb: b ? b.rating : ai.rating, created: Date.now(), rep: {}, done: false };
      ctx.db.run('INSERT INTO arena_match (id, a, a_cid, b, b_cid, ai, ra, rb, created) VALUES (?,?,?,?,?,?,?,?,?)', M.id, M.a, M.aCid, M.b, M.bCid, ai ? JSON.stringify(ai) : null, M.ra, M.rb, M.created);
      matches.set(M.id, M); return M;
    }
    const vsOf = e => ({ name: e.char.name, acct: e.name, cls: e.char.cls, job: e.char.job, rating: e.rating, tier: tierOf(e.rating) });
    function startHuman(a, b) {
      queue.delete(a.uid); queue.delete(b.uid); remember(a.uid, b.uid);
      const M = openMatch(a, b, null);
      ctx.sendTo(a.uid, { t: 'arena:match', id: M.id, ai: false, host: true, vs: vsOf(b), rating: a.rating });
      ctx.sendTo(b.uid, { t: 'arena:match', id: M.id, ai: false, host: false, vs: vsOf(a), rating: b.rating });
      ctx.mods.room.open('duel', a.uid, [a.uid, b.uid], { arena: M.id, theme: null });   // 先等久的当主机
    }
    function startAi(a) {
      queue.delete(a.uid);
      const [cls, job] = pick(ALL18), rating = Math.max(FLOOR, a.rating + Math.round((Math.random() - 0.5) * 120));
      const ai = { name: aiName(), cls, job, lvl: aiLevel(a.rating), rating };
      const M = openMatch(a, null, ai);
      ctx.sendTo(a.uid, { t: 'arena:match', id: M.id, ai: true, host: true, vs: { ...ai, tier: tierOf(rating) }, rating: a.rating });
    }
    // 没报完的 AI 局：判负（重新排队 / 超时）
    function dropAi(uid, older = 0) {
      for (const M of [...matches.values()]) if (M.ai && M.a === uid && Date.now() - M.created >= older) settle(M, 0, 'escape');
    }
    function tick() {
      const t = Date.now(), R = ctx.mods.room;
      const Q = [...queue.values()].sort((x, y) => x.t0 - y.t0), used = new Set();
      for (const a of Q) {
        if (used.has(a.uid)) continue;
        if (!ctx.isOnline(a.uid) || R.of(a.uid)) { queue.delete(a.uid); used.add(a.uid); ctx.sendTo(a.uid, { t: 'arena:left', why: 'busy' }); continue; }
        let best = null, bd = Infinity;
        for (const b of Q) {
          if (b === a || b.uid === a.uid || used.has(b.uid) || !ctx.isOnline(b.uid) || R.of(b.uid) || metRecently(a.uid, b.uid)) continue;
          const d = Math.abs(a.rating - b.rating);
          if (d <= Math.max(band(t - a.t0), band(t - b.t0)) && d < bd) { best = b; bd = d; }
        }
        if (best) { used.add(a.uid); used.add(best.uid); startHuman(a, best); continue; }
        if (t - a.t0 >= C('arenaAiMs')) { used.add(a.uid); startAi(a); }
      }
      if (++sweepN % 10 === 0) {   // 超时的对局
        for (const M of [...matches.values()]) if (M.ai && t - M.created > C('arenaAiTimeout')) settle(M, 0, 'timeout');
        const stale = ctx.db.all('SELECT id FROM arena_match WHERE done IS NULL AND created < ?', t - Math.max(C('arenaAiTimeout'), 600_000) * 2);
        for (const r of stale) { const M = load(r.id); if (M) settle(M, M.ai ? 0 : null, 'stale'); }
      }
    }
    setInterval(() => { try { tick(); } catch (e) { ctx.log('arena tick 出错', e.stack || e); } }, 1000).unref();
    // 排位房间关闭：有结果按结果结算；开打前关掉 = 作废；开打后 = 走掉的一方判负
    ctx.mods.room.closeHooks.push((R, why) => {
      if (R.kind !== 'duel' || !R.meta || !R.meta.arena) return;
      const M = load(String(R.meta.arena)); if (!M || M.ai) return;
      const reps = Object.values(M.rep);
      if (reps.length === 2 && reps[0] !== reps[1]) return settle(M, null, 'disputed');
      if (reps.length) return settle(M, reps[0], 'end');
      if (Date.now() - M.created < C('arenaForfeitMs')) return settle(M, null, 'cancel');
      const gone = R.members.length < 2 ? [M.a, M.b].find(id => !R.members.includes(id)) : R.host;
      settle(M, gone === M.a ? M.b : M.a, 'forfeit');
    });
    return {
      queue, matches, settle, tick, row, view, today,
      state(uid, cid) { const r = row(uid, cid); return { ...view(r), today: today(uid), queued: queue.has(uid), n: queue.size, aiAfter: C('arenaAiMs'), tiers: TIERS, reward: REWARD, aiGain: AI_GAIN, aiCap: AI_CAP }; },
      join(c, msg) {
        const me = c.user.id, note = text => c.send({ t: 'arena:note', text });
        if (queue.has(me)) { const e = queue.get(me); return c.send({ t: 'arena:queued', rating: e.rating, tier: tierOf(e.rating), n: queue.size, aiAfter: C('arenaAiMs') }); }
        if (ctx.mods.room.of(me)) return note('你正在地下城或决斗中，不能排队');
        const ch = msg.char && typeof msg.char === 'object' ? msg.char : {};
        const char = { name: txt(ch.name, 16) || c.user.name, cls: AI_POOL[ch.cls] ? ch.cls : 'sword', job: KEY_RE.test(ch.job || '') ? ch.job : null };
        const cid = cidOf(msg.cid);
        dropAi(me);
        ctx.db.run(`INSERT INTO arena (user_id, cid, user_name, char_name, cls, job, updated) VALUES (?,?,?,?,?,?,?)
          ON CONFLICT(user_id, cid) DO UPDATE SET user_name = excluded.user_name, char_name = excluded.char_name, cls = excluded.cls, job = excluded.job`, me, cid, c.user.name, char.name, char.cls, char.job, now(ctx));
        const rating = row(me, cid).rating;
        queue.set(me, { uid: me, name: c.user.name, cid, char, rating, t0: Date.now(), conn: c.cid });
        c.send({ t: 'arena:queued', rating, tier: tierOf(rating), n: queue.size, aiAfter: C('arenaAiMs') });
      },
      report(c, msg) {
        const me = c.user.id, M = load(txt(msg.id, 40));
        if (!M || M.done || (me !== M.a && me !== M.b)) return;
        if (M.ai) {
          if (msg.abort) return msg.abort === 1 && Date.now() - M.created < 60_000 ? settle(M, null, 'abort') : settle(M, 0, 'escape');   // abort 1 = 客户端没能开打（不在城镇等）：作废；2 = 中途离开：判负
          if (Date.now() - M.created < C('arenaMinMs')) return c.send({ t: 'arena:note', text: '对局时间太短，结果无效' });
          return settle(M, msg.draw ? -1 : msg.win ? me : 0, 'end');
        }
        const other = me === M.a ? M.b : M.a;
        M.rep[me] = msg.draw ? -1 : msg.win ? me : other;
        const reps = Object.values(M.rep);
        if (reps.length === 2) return reps[0] === reps[1] ? settle(M, reps[0], 'end') : settle(M, null, 'disputed');
        clearTimeout(M.timer); M.timer = setTimeout(() => settle(M, M.rep[me], 'end'), C('arenaReportMs'));
      },
    };
  },
  onClose(c, ctx) {
    const A = ctx.mods.arena, e = A.queue.get(c.user.id);
    if (e && e.conn === c.cid) A.queue.delete(c.user.id);   // 断线：移出队列（被新连接顶掉的旧连接不算）
  },
  ws: {
    'arena:join'(c, msg, ctx) { ctx.mods.arena.join(c, msg); },
    'arena:leave'(c, msg, ctx) { if (ctx.mods.arena.queue.delete(c.user.id)) c.send({ t: 'arena:left', why: 'leave' }); },
    'arena:end'(c, msg, ctx) { ctx.mods.arena.report(c, msg); },
  },
  routes(r, ctx) {
    r.get('/api/arena', { auth: true, rate: [60, 60] }, req => ctx.mods.arena.state(req.user.id, cidOf((req.query || {}).cid)));
  },
};
