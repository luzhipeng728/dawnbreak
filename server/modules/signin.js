// 每日签到（社交与经济服务）：以服务器时间为准（北京时间 06:00 换日，和游戏里疲劳恢复一致），按月签到日历
// 奖励按“本月第 N 次签到”发放，连续签到 3 / 7 / 14 / 21 / 28 天另有奖励；奖励以系统邮件发出，客户端签到后自动领取
// 物品 key 和商城组约定：cera 点券（计数型）、box_magic 魔盒、tk_enh7 +7 强化券、box_equip / box_orb / box_supply 礼盒；fatigue / coin / guard / crystal 为现有物品
import { now } from './mail.js';
const TZ = 8 * 3600000, RESET = 6 * 3600000, DAY = 86400000;
export const dayOf = t => new Date(t + TZ - RESET).toISOString().slice(0, 10);   // 'YYYY-MM-DD'
const dayNum = d => Math.round(Date.parse(d + 'T00:00:00Z') / DAY);
// 本月第 N 次签到的奖励（下标 0 = 第 1 次）
export const SIGNIN_REWARDS = [
  { gold: 3000 }, { items: [{ key: 'fatigue', n: 1 }] }, { cera: 50 }, { items: [{ key: 'hpM', n: 10 }, { key: 'mpM', n: 10 }] }, { items: [{ key: 'coin', n: 1 }] },
  { gold: 5000 }, { items: [{ key: 'box_magic', n: 1 }] }, { items: [{ key: 'crystal', n: 50 }] }, { items: [{ key: 'fatigue', n: 1 }] }, { cera: 100 },
  { items: [{ key: 'guard', n: 1 }] }, { gold: 8000 }, { items: [{ key: 'coin', n: 2 }] }, { items: [{ key: 'box_supply', n: 1 }] }, { cera: 150 },
  { items: [{ key: 'fatigue', n: 2 }] }, { gold: 10000 }, { items: [{ key: 'm_elem', n: 5 }] }, { items: [{ key: 'coin', n: 2 }] }, { items: [{ key: 'tk_enh7', n: 1 }] },
  { items: [{ key: 'box_magic', n: 2 }] }, { gold: 12000 }, { items: [{ key: 'fatigue', n: 2 }] }, { cera: 200 }, { items: [{ key: 'guard', n: 2 }] },
  { items: [{ key: 'box_orb', n: 1 }] }, { gold: 15000 }, { items: [{ key: 'box_equip', n: 1 }] }, { cera: 100 }, { cera: 100 }, { items: [{ key: 'box_magic', n: 3 }] },
];
// 连续签到奖励
export const SIGNIN_STREAK = {
  3: { cera: 30 }, 7: { items: [{ key: 'box_magic', n: 1 }] }, 14: { cera: 300 }, 21: { items: [{ key: 'box_orb', n: 1 }] }, 28: { items: [{ key: 'tk_enh7', n: 1 }, { key: 'box_magic', n: 2 }] },
};
const merge = (a, b) => ({ gold: (a.gold || 0) + (b.gold || 0), cera: (a.cera || 0) + (b.cera || 0), items: [...(a.items || []), ...(b.items || [])] });
function state(ctx, uid) {
  const t = now(ctx), today = dayOf(t), month = today.slice(0, 7);
  const rows = ctx.db.all('SELECT day FROM signin WHERE user_id = ? ORDER BY day DESC LIMIT 400', uid).map(r => r.day);
  const set = new Set(rows);
  const days = rows.filter(d => d.startsWith(month)).map(d => +d.slice(8)).sort((a, b) => a - b);
  // 连续签到：从今天（今天没签就从昨天）往前数
  let streak = 0, d = dayNum(today) - (set.has(today) ? 0 : 1);
  const has = n => set.has(new Date(n * DAY).toISOString().slice(0, 10));
  while (has(d)) { streak++; d--; }
  const [y, m] = month.split('-').map(Number);
  return { today, month, days, signed: set.has(today), count: days.length, streak, total: rows.length,
    daysInMonth: new Date(Date.UTC(y, m, 0)).getUTCDate(), firstWeekday: new Date(Date.UTC(y, m - 1, 1)).getUTCDay(),
    rewards: SIGNIN_REWARDS, streakRewards: SIGNIN_STREAK, now: t, nextReset: Date.parse(today + 'T00:00:00Z') + DAY - TZ + RESET };
}
export default {
  name: 'signin',
  migrations: [
    `CREATE TABLE signin (user_id INTEGER NOT NULL, day TEXT NOT NULL, at INTEGER NOT NULL, reward TEXT NOT NULL DEFAULT '{}', mail_id INTEGER, PRIMARY KEY (user_id, day))`,
  ],
  routes(r, ctx) {
    r.get('/api/signin', { auth: true }, req => state(ctx, req.user.id));
    r.post('/api/signin', { auth: true, rate: [10, 60] }, req => {
      const uid = req.user.id;
      const res = ctx.db.tx(() => {
        const s = state(ctx, uid);
        if (s.signed) throw ctx.err(409, '今天已经签到过了');
        const count = s.count + 1, streak = s.streak + 1;
        const base = SIGNIN_REWARDS[Math.min(count, SIGNIN_REWARDS.length) - 1], bonus = SIGNIN_STREAK[streak] || null;
        const reward = bonus ? merge(base, bonus) : merge(base, {});
        ctx.db.run('INSERT INTO signin (user_id, day, at, reward) VALUES (?,?,?,?)', uid, s.today, now(ctx), JSON.stringify(reward));
        const mailId = ctx.mods.mail.send(uid, { kind: 'sys', from: '每日签到', title: `签到奖励（本月第 ${count} 天${bonus ? `，连续 ${streak} 天` : ''}）`,
          body: bonus ? `感谢每天到访！连续签到 ${streak} 天，额外奖励已一并放入附件。` : '感谢每天到访！明天也要来哦。', gold: reward.gold, cera: reward.cera, items: reward.items, days: 30 });
        ctx.db.run('UPDATE signin SET mail_id = ? WHERE user_id = ? AND day = ?', mailId, uid, s.today);
        return { count, streak, reward, bonus, mailId, day: s.today };
      });
      if (ctx.mods.gm && ctx.mods.gm.log) ctx.mods.gm.log('signin', req.user, { day: res.day, count: res.count, streak: res.streak });
      return { ok: true, ...res, state: state(ctx, uid) };
    });
  },
};
