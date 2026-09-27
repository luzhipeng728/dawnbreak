// 全服公告（社交与经济服务）：客户端上报 → 按 kind 白名单生成文案 → 记录 → WS 广播给所有在线玩家
// 格式约定见协作板「announce 事件格式」：kind = epic / enhance / amplify / skyset / box / multi / ach / job / awaken / firstClear / custom（只给管理员）
import { now } from './mail.js';
const txt = (s, n) => String(s ?? '').replace(/[\u0000-\u001f\u007f\[\]]/g, ' ').trim().slice(0, n);
const int = (v, lo, hi) => { const n = Math.floor(Number(v)); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : lo; };
const itemName = it => it && typeof it === 'object' ? `${int(it.enh || 0, 0, 99) ? '+' + int(it.enh, 0, 99) + ' ' : ''}${txt(it.name, 30)}` : '';
// 每种公告的文案（who = 「角色名」）；返回 null = 字段不全，丢弃
const KINDS = {
  epic: (b, who) => b.item && `勇士${who}${b.place ? `在${txt(b.place, 20)}` : ''}获得了史诗装备 [${itemName(b.item)}]！`,
  enhance: (b, who) => b.item && int(b.lvl, 0, 99) >= 10 && `勇士${who}将 [${itemName({ ...b.item, enh: 0 })}] 强化到了 +${int(b.lvl, 0, 99)}！`,
  amplify: (b, who) => b.item && int(b.lvl, 0, 99) >= 10 && `勇士${who}将 [${itemName({ ...b.item, enh: 0 })}] 增幅到了 +${int(b.lvl, 0, 99)}！`,
  skyset: (b, who) => (b.item || b.name) && `勇士${who}合成出了 [${b.item ? itemName(b.item) : txt(b.name, 30)}]！`,
  box: (b, who) => b.item && `勇士${who}打开${txt(b.box, 20) || '箱子'}获得了 [${itemName(b.item)}]！`,
  job: (b, who) => b.job && `勇士${who}转职成为了${txt(b.job, 16)}！`,
  awaken: (b, who) => b.job && `勇士${who}完成了觉醒：${txt(b.job, 16)}！`,
  firstClear: (b, who) => b.place && `勇士${who}首次通关了${txt(b.place, 20)}！`,
  ach: (b, who) => b.name && `勇士${who}达成了金色成就 [${txt(b.name, 20)}]！`,
  multi: (b, who) => (b.item || b.name) && `勇士${who}累计购买节日礼包，获得了 [${b.item ? itemName(b.item) : txt(b.name, 30)}]！`,
};
function show(ctx, o) {
  const t = now(ctx);
  const x = ctx.db.run('INSERT INTO notice (kind, user_id, user_name, char_name, text, rar, at) VALUES (?,?,?,?,?,?,?)', o.kind, o.uid ?? null, o.user || '', o.char || '', o.text, o.rar || 0, t);
  const msg = { t: 'notice:show', id: Number(x.lastInsertRowid), kind: o.kind, text: o.text, user: o.user || '', char: o.char || '', rar: o.rar || 0, item: o.item || null, at: t };
  ctx.broadcast(msg);
  return msg;
}
export default {
  name: 'notice',
  migrations: [
    `CREATE TABLE notice (id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL, user_id INTEGER, user_name TEXT NOT NULL DEFAULT '', char_name TEXT NOT NULL DEFAULT '',
      text TEXT NOT NULL, rar INTEGER NOT NULL DEFAULT 0, at INTEGER NOT NULL)`,
    `CREATE INDEX notice_at ON notice (at)`,
  ],
  init(ctx) {
    // 服务端 / 管理员直接发（custom 文字原样显示，客户端会转义）
    return { broadcast: o => show(ctx, { kind: o.kind || 'custom', text: txt(o.text, 120), user: o.user, char: o.char, rar: o.rar, uid: o.uid }) };
  },
  routes(r, ctx) {
    r.post('/api/notice', { auth: true, rate: [20, 60] }, req => {
      const b = req.body || {}, f = KINDS[b.kind];
      if (!f) throw ctx.err(400, '不支持的公告类型');
      const char = txt(b.char, 24) || req.user.name;
      const text = f(b, `「${char}」`);
      if (!text) throw ctx.err(400, '公告内容不完整');
      const item = b.item && typeof b.item === 'object' ? { name: itemName({ ...b.item, enh: b.kind === 'enhance' || b.kind === 'amplify' ? 0 : b.item.enh }), rar: int(b.item.rar || 0, 0, 9) } : null;
      return { ok: true, notice: show(ctx, { kind: b.kind, text, user: req.user.name, char, uid: req.user.id, rar: item ? item.rar : 0, item }) };
    });
    r.get('/api/notice/recent', { auth: true }, () => ({ list: ctx.db.all('SELECT id, kind, user_name AS "user", char_name AS "char", text, rar, at FROM notice ORDER BY id DESC LIMIT 20') }));
  },
};
