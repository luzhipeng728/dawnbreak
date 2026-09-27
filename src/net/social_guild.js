/* =====================================================================
   公会 · 客户端逻辑（窗口在 ui/social/guild.js，服务端 server/modules/guild.js，设计见 docs/SOCIAL.md「公会」）
   - 只在登录后工作；GD.data = GET /api/guild 的结果（我的公会、成员、留言、商店、技能表）
   - 名牌：netPlayerTag(userId) → 公会名（联机组 town.js 的扩展点），查本地缓存 GD.tags，公会有变动时服务端推送 guild:tags 再刷新
   - 公会频道：CHAT_CH.guild + 包一层 chat.cycle / chat.sendText（/g 内容），服务端 guild:say 转发给在线成员
   - 公会技能：包一层 equipTotals，按公会等级加属性（只在登录且有公会时）
   - 贡献：通关地下城 / 深渊 / 组队通关时上报（服务端有每日上限）；签到由服务端直接加
   - 创建公会（扣金币）、公会商店（服务端扣贡献、客户端入包）都走 net/social.js 的待办对账（op: gcreate / gshop）
   ===================================================================== */
const GD = { data: null, tags: new Map(), loading: null, at: 0, tagsAt: 0 };
const GUILD_COLORS = ['#c8a24a', '#c04a3a', '#3a7ac8', '#4aa05a', '#8a4ac8', '#c86a2a', '#2aa0a8', '#c84a8a', '#6a6a7a', '#e8e0c8'];
const GUILD_SHAPES = ['盾', '圆', '六边', '菱形', '星', '旗', '方', '翼'];
const GUILD_GLYPHS = ['龙', '剑', '星', '月', '炎', '风', '光', '影', '王', '魂', '樱', '狼', '晓', '天', '雷', '冰', '★', '◆', '♠', '♥'];
const guildIn = () => !!(GD.data && GD.data.guild);
const guildRole = () => (guildIn() && GD.data.me ? GD.data.me.role : null);
const guildOfficer = () => guildRole() === 'leader' || guildRole() === 'vice';
function netPlayerTag(id) { return GD.tags.get(id) || null; }   // 城镇名牌第二行显示「<公会名> 职业」（每帧调用，只查缓存）

/* ---- 数据 ---- */
async function guildRefresh() {
  if (!socialOn()) { GD.data = null; return null; }
  if (GD.loading) return GD.loading;
  GD.loading = (async () => {
    const before = guildLvlNow();
    try { GD.data = await sxApi('GET', '/api/guild'); GD.at = Date.now(); }
    catch (e) { return null; }
    finally { GD.loading = null; }
    if (guildLvlNow() !== before && game.player) recalcStats(game.player);   // 公会技能变了（加入 / 离开 / 升级）
    if (menus.isOpen('guild') && menus.wins.guild._render) { menus.wins.guild._data = GD.data; menus.wins.guild._render(); }
    bus.emit('guildUpdate', { data: GD.data });
    return GD.data;
  })();
  return GD.loading;
}
async function guildTagsRefresh() {
  if (!socialOn()) return;
  try { const r = await sxApi('GET', '/api/guild/tags'); GD.tags = new Map(Object.entries(r.map || {}).map(([k, v]) => [+k, v])); GD.tagsAt = Date.now(); } catch (e) { /* 下次再刷 */ }
}
const guildLvlNow = () => (guildIn() ? GD.data.guild.lvl : 0);

/* ---- 公会技能：按公会等级加属性（包一层 equipTotals，和图鉴加成同一个口径进面板） ---- */
function guildPerkStats() {
  if (!socialOn() || !guildIn()) return null;
  const o = {}, L = GD.data.guild.lvl;
  for (const P of GD.data.perks || []) if (L >= P.lvl) for (const k in P.st) o[k] = (o[k] || 0) + P.st[k];
  return o;
}
{
  const et0 = equipTotals;
  equipTotals = function () {
    const r = et0.apply(this, arguments), g = guildPerkStats();
    if (g) for (const k in g) r.t[k] = (r.t[k] || 0) + g[k];
    return r;
  };
}

/* ---- 贡献上报 ---- */
bus.on('dungeonClear', e => {
  if (!socialOn() || !guildIn() || !e) return;
  const D = DUNGEONS[e.id], kind = D && D.abyss ? 'abyss' : 'clear';
  sxApi('POST', '/api/guild/contrib', { kind }).then(r => { if (r && r.gain) { toastMsg(`公会贡献 +${r.gain}`, '#9aff7a'); if (GD.data && GD.data.me) GD.data.me.contrib = r.contrib; } }).catch(() => {});
  const P = typeof netParty !== 'undefined' && netParty.p;
  if (P && P.members.length >= 2) sxApi('POST', '/api/guild/contrib', { kind: 'coop' }).catch(() => {});
});

/* ---- 操作 ---- */
async function guildCreate(name, badge) {
  const need = GD.data ? GD.data.createGold : 50000, lv = GD.data ? GD.data.createLvl : 10;
  if (!save.live) throw new Error('请先进入游戏');
  if (game.lvl < lv) throw new Error(`Lv.${lv} 才能创建公会`);
  if (game.gold < need) throw new Error(`金币不足，创建公会需要 ${fmtNum(need)} G`);
  game.gold -= need;
  const p = { rid: sxRid(), op: 'gcreate', name, badge, gold: need, char: save.data.name, t: Date.now() };
  sxPend().push(p);
  if (!(await sxFlush())) { sxRollback(p); sxDrop(p); save.write(); throw new Error('网络异常，存档没能上传，请稍后再试'); }
  const r = await sxRun(p);
  await guildRefresh(); guildTagsRefresh();
  return r;
}
async function guildShopBuy(S) {
  if (!save.live) throw new Error('请先进入游戏');
  const why = sxClaimCheck({ items: [{ key: S.key, n: S.n }] }); if (why) throw new Error(why);
  const p = { rid: sxRid(), op: 'gshop', id: S.id, t: Date.now() };
  sxPend().push(p);
  if (!(await sxFlush())) { sxDrop(p); save.write(); throw new Error('网络异常，存档没能上传，请稍后再试'); }
  const r = await sxRun(p);
  guildRefresh();
  return r;
}
// 通用：调用接口 → 成功后刷新；失败 toast
async function guildDo(method, path, body, okMsg) {
  try { const r = await sxApi(method, path, body); if (okMsg) toastMsg(okMsg, '#9aff7a'); await guildRefresh(); return r; }
  catch (e) { toastMsg(sxErrText(e), '#ff6a6a'); sfx.error(); return null; }
}
const guildInvite = name => guildDo('POST', '/api/guild/invite', { user: name }).then(r => { if (r) toastMsg(r.online ? `已向 ${name} 发出公会邀请` : `已向 ${name} 发出公会邀请（对方不在线，上线后在公会窗口里能看到）`, '#9aff7a'); return r; });

/* ---- WS 推送 ---- */
if (typeof net !== 'undefined' && typeof net.on === 'function') {
  net.on('guild:update', m => {
    if (m.why === 'kicked') toastMsg('你被请离了公会', '#ffb08a');
    else if (m.why === 'disband') toastMsg(`公会「${m.guild || ''}」解散了`, '#ffb08a');
    else if (m.why === 'approved') { toastMsg(`公会「${m.guild || ''}」通过了你的申请，欢迎加入！`, '#9aff7a'); sfx.buff(); }
    guildRefresh();
  });
  net.on('guild:tags', () => guildTagsRefresh());
  net.on('guild:invite', m => {
    toastMsg(`${m.from} 邀请你加入公会「${m.guild}」`, '#9aff7a');
    GD.invitePending = true;
    if (menus.isOpen('ask')) return;   // 正在确认别的事情：稍后在公会窗口里处理
    menus.ask({ title: '公会邀请', text: `<b>${escHtml(m.from)}</b> 邀请你加入公会 <b style="color:#9aff7a">「${escHtml(m.guild)}」</b>`, okText: '加入', cancelText: '以后再说',
      ok: () => guildDo('POST', '/api/guild/accept', { id: m.id }, `加入了公会「${m.guild}」`).then(() => guildTagsRefresh()),
      cancel: () => {} });
  });
}
bus.on('netLogin', () => { guildRefresh(); guildTagsRefresh(); });
bus.on('netOpen', () => { guildRefresh(); guildTagsRefresh(); });
bus.on('netLogout', () => { GD.data = null; GD.tags.clear(); if (game.player) recalcStats(game.player); if (menus.isOpen('guild')) menus.close('guild'); });
bus.on('charLeave', () => { if (menus.isOpen('guild')) menus.close('guild'); });

/* ---- 公会频道：聊天框里的“公会”（Tab 切换，/g 内容） ---- */
if (typeof CHAT_CH !== 'undefined' && typeof chat !== 'undefined') {
  CHAT_CH.guild = ['公会', '#9aff7a'];
  chat.cycle = function () {
    const L = ['world', 'party', ...(guildIn() ? ['guild'] : []), 'whisper'];
    this.setCh(L[(L.indexOf(this.ch) + 1) % L.length]);
    if (this.ch === 'whisper' && !this.toEl.value) setTimeout(() => this.toEl.focus(), 0); else this.inp.focus();
  };
  const send0 = chat.sendText;
  chat.sendText = function (text) {
    let m = /^\/g\s+(.+)$/i.exec(text);
    if (m || (this.ch === 'guild' && !/^\/[wrps]\s/i.test(text))) {
      if (m) text = m[1];
      if (!guildIn()) { this.add({ ch: 'sys', text: '你还没有加入公会' }); return; }
      if (!text) return;
      if (!net.send({ t: 'guild:say', text })) this.add({ ch: 'sys', text: '没有连上服务器，消息没有发出去' }); else bus.emit('sxChat', { ch: 'guild' });
      return;
    }
    if (text) bus.emit('sxChat', { ch: this.ch });
    return send0.call(this, text);
  };
}

/* ---- 玩家菜单：会长 / 副会长多一个“邀请加入公会” ---- */
if (typeof menus.w_pmenu === 'function') {
  const pm0 = menus.w_pmenu;
  menus.w_pmenu = function (p) {
    const el = pm0.apply(this, arguments);
    const box = el && el.querySelector('.pmenu');
    if (box && p && guildOfficer() && !GD.tags.get(p.id)) box.append(h('button', { class: 'btn', onclick: () => { sfx.click(); menus.close('pmenu'); guildInvite(p.name); } }, '邀请加入公会'));
    return el;
  };
}

/* ---- 徽章：形状 × 颜色 × 一个字（画成小图，按参数缓存） ---- */
const guildBadgeCache = new Map();
function guildBadgeSrc(b, size = 64) {
  b = b || { s: 0, c: 0, g: '?' };
  const key = `${b.s}|${b.c}|${b.g}|${size}`;
  if (guildBadgeCache.has(key)) return guildBadgeCache.get(key);
  const [cv, c] = offCanvas(size, size), S = size, col = GUILD_COLORS[b.c] || GUILD_COLORS[0];
  c.save(); c.translate(S / 2, S / 2);
  const r = S * 0.44;
  c.beginPath();
  switch (b.s) {
    case 0: c.moveTo(-r * 0.85, -r * 0.8); c.lineTo(r * 0.85, -r * 0.8); c.lineTo(r * 0.85, r * 0.1); c.quadraticCurveTo(r * 0.7, r * 0.75, 0, r); c.quadraticCurveTo(-r * 0.7, r * 0.75, -r * 0.85, r * 0.1); c.closePath(); break;
    case 1: c.arc(0, 0, r * 0.95, 0, TAU); break;
    case 2: for (let i = 0; i < 6; i++) { const a = i / 6 * TAU - Math.PI / 2; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); } c.closePath(); break;
    case 3: c.moveTo(0, -r); c.lineTo(r * 0.85, 0); c.lineTo(0, r); c.lineTo(-r * 0.85, 0); c.closePath(); break;
    case 4: for (let i = 0; i < 10; i++) { const a = i / 10 * TAU - Math.PI / 2, rr = i % 2 ? r * 0.55 : r; c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } c.closePath(); break;
    case 5: c.moveTo(-r * 0.8, -r * 0.9); c.lineTo(r * 0.8, -r * 0.9); c.lineTo(r * 0.8, r * 0.9); c.lineTo(0, r * 0.5); c.lineTo(-r * 0.8, r * 0.9); c.closePath(); break;
    case 6: { const w = r * 1.7, q = r * 0.35; c.moveTo(-w / 2 + q, -w / 2); c.arcTo(w / 2, -w / 2, w / 2, w / 2, q); c.arcTo(w / 2, w / 2, -w / 2, w / 2, q); c.arcTo(-w / 2, w / 2, -w / 2, -w / 2, q); c.arcTo(-w / 2, -w / 2, w / 2, -w / 2, q); c.closePath(); break; }
    default: c.moveTo(0, -r * 0.7); c.quadraticCurveTo(r, -r * 1.1, r, r * 0.1); c.quadraticCurveTo(r * 0.5, r * 0.3, 0, r); c.quadraticCurveTo(-r * 0.5, r * 0.3, -r, r * 0.1); c.quadraticCurveTo(-r, -r * 1.1, 0, -r * 0.7); c.closePath();
  }
  const g = c.createLinearGradient(0, -r, 0, r); g.addColorStop(0, shade(col, 0.35)); g.addColorStop(0.55, col); g.addColorStop(1, shade(col, -0.45));
  c.fillStyle = g; c.fill();
  c.lineWidth = Math.max(2, S * 0.05); c.strokeStyle = '#f8e6b0'; c.stroke();
  c.lineWidth = Math.max(1, S * 0.02); c.strokeStyle = 'rgba(20,10,4,.8)'; c.stroke();
  c.font = `900 ${Math.round(S * 0.42)}px "PingFang SC","Microsoft YaHei",serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.lineWidth = Math.max(2, S * 0.06); c.strokeStyle = 'rgba(20,10,4,.85)'; c.strokeText(b.g, 0, S * 0.02);
  c.fillStyle = '#fff6d8'; c.fillText(b.g, 0, S * 0.02);
  c.restore();
  const url = cv.toDataURL(); guildBadgeCache.set(key, url); return url;
}
