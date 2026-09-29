// 查看其他玩家（好友 / 城镇 / 排行榜 / 公会 / 队伍里的「查看信息」）：从对方的云存档里取一个角色的公开信息，只读
// GET /api/inspect/:user?cid=角色创建时间&char=角色名   （:user = 账号 id 或账号名）
//   → { user, uid, online, updatedAt, char: { name, cls, job, lvl, cid }, equip: { 部位: 装备 }, codex: [图鉴登记过的物品 key], guild: { name, lvl, perks } | null }
//   选哪个角色：cid 优先 → 角色名 → 对方在线时正在玩的角色 → 存档里上次选中的角色
//   只返回显示和算属性要用的字段（装备按白名单逐个字段取）；金币、点券、背包、仓库、金库、邮件、任务、账号信息一律不返回
import { cleanChar } from '../core/social.js';
import { GUILD_PERKS } from './guild.js';
import { isNum, str } from '../lib/util.js';

const KEY_RE = /^[A-Za-z0-9_:@.-]{1,60}$/;
const ITEM_STR = ['key', 'slot', 'wtype', 'atype', 'cls', 'set', 'dim', 'skin', 'avSet', 'bind'];
const ITEM_NUM = ['rar', 'lvl', 'grade', 'enh', 'dur', 'durMax', 'forge'];
const numMap = o => { const r = {}; if (o && typeof o === 'object') for (const k of Object.keys(o).slice(0, 40)) if (KEY_RE.test(k) && isNum(o[k])) r[k] = o[k]; return r; };
export function publicItem(it, slot) {
  if (!it || typeof it !== 'object' || it.kind !== 'equip' || it.slot !== slot || typeof it.key !== 'string' || !KEY_RE.test(it.key)) return null;
  const o = { kind: 'equip', name: str(it.name, 40) };
  for (const k of ITEM_STR) if (typeof it[k] === 'string' && KEY_RE.test(it[k])) o[k] = it[k];
  for (const k of ITEM_NUM) if (isNum(it[k])) o[k] = it[k];
  o.st = numMap(it.st);
  if (it.fx && typeof it.fx === 'object') { o.fx = numMap(it.fx); if (typeof it.fx.atkElem === 'string' && KEY_RE.test(it.fx.atkElem)) o.fx.atkElem = it.fx.atkElem; }
  if (it.orb && typeof it.orb === 'object' && typeof it.orb.key === 'string' && KEY_RE.test(it.orb.key)) o.orb = { key: it.orb.key, st: numMap(it.orb.st), name: str(it.orb.name, 40) };
  if (it.legacy === true) o.legacy = true;
  return o;
}
function pickChar(data, q, playing) {
  const chars = Array.isArray(data && data.chars) ? data.chars.filter(c => c && typeof c === 'object') : [];
  const cid = str(q.cid, 24), name = str(q.char, 16);
  return (cid && chars.find(c => String(c.created) === cid)) || (name && chars.find(c => c.name === name)) || (playing && chars.find(c => c.name === playing))
    || (data && chars.includes(data.chars[data.cur]) ? data.chars[data.cur] : chars[0]) || null;
}

export default {
  name: 'inspect',
  routes(r, ctx) {
    r.get('/api/inspect/:user', { auth: true, rate: [60, 60] }, req => {
      const q = req.query || {}, id = /^\d+$/.test(req.params.user) ? +req.params.user : req.params.user;
      const u = ctx.findUser(id); if (!u || u.banned) throw ctx.err(404, '没有这个玩家');
      const cl = ctx.client && ctx.client(u.id), playing = cl && cl.char ? cl.char.name : null;
      const { data, updatedAt } = ctx.mods.saves.read(u.id);
      const ch = pickChar(data, q, playing); if (!ch) throw ctx.err(404, '这个玩家还没有角色');
      const c = cleanChar(ch), equip = {};
      if (ch.equip && typeof ch.equip === 'object') for (const s of Object.keys(ch.equip).slice(0, 40)) { const it = publicItem(ch.equip[s], s); if (it) equip[s] = it; }
      const codex = ch.codex && typeof ch.codex === 'object' ? Object.keys(ch.codex).filter(k => KEY_RE.test(k)).slice(0, 5000) : [];
      const G = ctx.mods.guild, m = G && G.memberOf ? G.memberOf(u.id) : null, g = m && G.api ? G.api.guild(m.guild_id) : null;
      return {
        user: u.name, uid: u.id, online: !!cl, updatedAt,
        char: { name: c.name, cls: c.cls, job: c.job, lvl: c.lvl, cid: str(String(ch.created ?? ''), 24) },
        equip, codex,
        guild: g ? { name: g.name, lvl: g.lvl, perks: GUILD_PERKS.filter(p => p.lvl <= g.lvl).map(p => ({ lvl: p.lvl, name: p.name, st: p.st })) } : null,
      };
    });
  },
};
