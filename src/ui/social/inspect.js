/* =====================================================================
   查看其他玩家的角色信息：好友列表 / 城镇玩家菜单 / 队伍 的「查看信息」、排行榜点角色名、公会成员的「查看」
   数据：GET /api/inspect/:uid（server/modules/inspect.js：从对方云存档里取这个角色的公开字段——装备、等级、转职、图鉴登记、公会）
   画法和自己的个人信息（M）同一套（ui/items/status.js 的 statusBody）：装备 / 时装两页、物品提示、基础与详细属性、装备评分、图鉴、防具精通、套装
   属性不信任对方客户端：按对方的等级 / 转职 / 装备 / 图鉴 / 公会，用同一个 recalcStats 在临时对象上现算；只读，不碰自己的背包和角色
   ===================================================================== */
let inspectSeq = 0;
// p = { id（账号 id）, name?（账号名）, char?: { name }, cid?（角色创建时间，排行榜用） }
function netInspect(p) {
  if (!p || !p.id) return;
  if (!socialOn()) { toastMsg('登录后才能查看其他玩家', '#ffd0a0'); return; }
  if (menus.isOpen('inspect')) menus.close('inspect');
  menus.open('inspect', p);
}
// 按对方的数据算属性：把全局的等级 / 转职 / 装备 / 存档 / 公会临时换成对方的，算完马上换回来（同步执行，中间不会跑别的代码）
function inspectCalc(D) {
  inv.ensure();   // 先把自己的背包整理好，换装备期间 ensure() 不会再动任何东西
  const keep = { lvl: game.lvl, job: game.job, equip: inv.equip, normEq: inv._normEq, data: save.data, gd: typeof GD !== 'undefined' ? GD.data : null, cb: codexBonusCache };
  const p = { cls: D.cls };
  try {
    game.lvl = D.lvl; game.job = D.job; inv.equip = D.equip; inv._normEq = D.equip;
    save.data = { name: D.name, cls: D.cls, job: D.job, lvl: D.lvl, equip: D.equip, codex: D.codex, codexLog: [] };
    codexBonusCache = null;
    if (typeof GD !== 'undefined') GD.data = D.guild ? { guild: { name: D.guild.name, lvl: D.guild.lvl }, perks: D.guild.perks || [] } : null;
    recalcStats(p);
    return { p, codex: codexStats(), score: gearScore(D.equip) };
  } finally {
    game.lvl = keep.lvl; game.job = keep.job; inv.equip = keep.equip; inv._normEq = keep.normEq; save.data = keep.data; codexBonusCache = keep.cb;
    if (typeof GD !== 'undefined') GD.data = keep.gd;
  }
}
// 服务端返回 → statusBody 要的角色数据
function inspectData(r) {
  const c = r.char, equip = {};
  for (const s in r.equip || {}) { const it = normalizeItem({ ...r.equip[s] }); if (it && it.slot === s) { it.id = 'insp' + (++inspectSeq); equip[s] = it; } }   // 物品提示按 id 缓存：用不会和自己物品重复的 id
  const codex = {}; for (const k of r.codex || []) codex[k] = { n: 1 };
  const D = { name: c.name, cls: CLASSES[c.cls] ? c.cls : 'sword', job: c.job || null, lvl: c.lvl || 1, equip, codex, guild: r.guild };
  const S = inspectCalc(D);
  return { ...D, ...S, guild: r.guild ? r.guild.name : '', ro: true, page: 'gear', who: { lvl: D.lvl, cls: D.cls, job: D.job, equip, codex }, user: r.user, uid: r.uid, online: r.online };
}
Object.assign(menus, {
  w_inspect(p) {
    if (!p) return null;
    let C = null, err = '';
    const el = itemWin('inspect', '查看信息', el => {
      if (err) return h('div', { class: 'dim', style: 'padding:1.5em;text-align:center' }, err);
      if (!C) return h('div', { class: 'dim', style: 'padding:1.5em;text-align:center' }, '正在读取角色信息…');
      const me = net.user && C.uid === net.user.id, fr = typeof netFriends !== 'undefined' && netFriends.isFriend(C.uid);
      const B = (label, fn, cls = '') => h('button', { class: 'btn sm ' + cls, onclick: () => { sfx.click(); fn(); } }, label);
      const acts = me ? [] : [
        C.online ? B('私聊', () => chat.whisper(C.user)) : null,
        fr ? null : B('加好友', () => netFriends.add(C.user)),
        C.online && typeof netParty !== 'undefined' && !netParty.has(C.uid) ? B('组队', () => netPartyInvite(C.uid, C.user)) : null,
        C.online ? B('决斗', () => netDuelAsk({ id: C.uid, name: C.user, char: { name: C.name, cls: C.cls, job: C.job, lvl: C.lvl } })) : null].filter(Boolean);
      return [statusBody(el, C),
        h('div', { class: 'row insp-ft' }, h('span', { class: 'small dim' }, `账号 ${C.user}${fr ? ' · 好友' : ''}　${C.online ? '● 在线' : '○ 离线'}　只能查看，不能操作`), h('span', { class: 'sp' }), ...acts)];
    }, { w: 42 });
    el.classList.add('inspect');
    const q = [p.cid ? 'cid=' + encodeURIComponent(p.cid) : '', p.char && p.char.name ? 'char=' + encodeURIComponent(p.char.name) : ''].filter(Boolean).join('&');
    net.api('GET', `/api/inspect/${encodeURIComponent(p.id)}${q ? '?' + q : ''}`).then(r => {
      C = inspectData(r); C.setPage = id => { C.page = id; };
      const tt = el.querySelector('.hd .tt'); if (tt) tt.textContent = `查看信息 · ${C.name}`;
    }, e => { err = e.message || '读取失败'; }).finally(() => { if (el.isConnected) el._render(); });
    return el;
  },
});
addStyle(`
.inspect .insp-ft{gap:.4em;align-items:center;border-top:.08em solid rgba(232,194,106,.2);padding-top:.35em}
.inspect .insp-ft .sp{flex:1}
`);
