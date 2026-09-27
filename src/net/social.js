/* =====================================================================
   社交与经济服务 · 客户端逻辑（拍卖行 / 邮件 / 排行榜 / 全服公告 / 每日签到 / 管理员后台；窗口在 ui/social/*，设计见 docs/SOCIAL.md）
   - 只在登录后工作：socialOn()。单机模式（离线单文件、不登录）下所有入口隐藏、事件什么都不做
   - 防复制 / 防丢失：先在本地存档里扣减（物品 / 金币）并记一条待办 save.data.svcPend（带 rid）→ 立即上传云存档 →
     调接口（服务端按 rid 幂等）→ 成功删待办；服务端明确拒绝（4xx）就把扣掉的还回去；网络错误保留待办，下次进城 / 重连时自动对账
   - 全服公告：bus.emit('announce', { kind, ... })（格式见协作板），另外兜底监听 pickup / enhance / jobChange / 首次通关
   - 排行榜：进城、升级、换装、转职、通关、决斗后自动上报（防抖）
   ===================================================================== */
const SX = { unread: 0, pending: 0, signed: true, annSeen: new Map(), firstClear: null, reconciling: false, rankTm: 0, rankAt: 0, rankCid: null, pollAt: 0 };
function socialOn() { return typeof netOn === 'function' && typeof net !== 'undefined' && !!netOn() && !!net.user; }
const sxAdmin = () => socialOn() && !!net.user.admin;
const sxRid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
const sxApi = (method, path, body) => net.api(method, path, body);
const sxErrText = e => (e && e.data && e.data.error) || (e && e.status ? `请求失败（${e.status}）` : '网络异常，请稍后再试');
const sxDefinite = e => !!e && e.status >= 400 && e.status < 500;   // 服务端明确拒绝：这次请求没有生效
const sxPend = () => save.data ? (save.data.svcPend ??= []) : [];
const SX_CURRENCY = new Set(['coin', 'cera', 'shard_box', 'coin_gift']);   // 计数型：进背包时直接加到余额，不占格子
const sxIsCurrency = key => SX_CURRENCY.has(key) || !!(ITEMS[key] && (ITEMS[key].currency || ITEMS[key].counter));
// 拍卖行规则（和 server/modules/auction.js 保持一致）
const SX_AUCTION = { hours: { 12: 0.5, 24: 1, 48: 2 }, tax: 0.05, maxOn: 10, maxPrice: 2e9 };
const sxAuctionFee = (price, hours) => Math.max(10, Math.floor(price * 0.005 * (SX_AUCTION.hours[hours] || 1)));
const SX_POSTAGE = 100;
// 首次通关会发公告的地下城（天空之城的最终地下城 + 隐藏图）
const SX_FIRST_CLEAR = ['lord_palace', 'floating_castle'];

/* ---- 物品是否可以交易（上拍卖行 / 寄给好友）：装备深化组的 itemTradable 优先 ---- */
function sxTradable(it) {
  if (!it) return false;
  if (typeof itemTradable === 'function') { try { return !!itemTradable(it); } catch (e) { /* 回退到下面的规则 */ } }
  const D = ITEMS[it.key] || {};
  const bind = it.bind ?? D.bind;
  return it.kind !== 'quest' && !D.noTrade && !D.noSell && !it.noTrade && !sxIsCurrency(it.key) && !(bind && bind !== 'equip') && !it.legacy;
}
function sxBindText(it) {
  if (typeof itemBindText === 'function') { try { return itemBindText(it); } catch (e) { /* 回退 */ } }
  if (it.kind === 'quest') return '任务道具';
  const b = it.bind ?? (ITEMS[it.key] || {}).bind;
  return b === 'char' ? '角色绑定' : b === 'account' ? '账号绑定' : sxTradable(it) ? '可交易' : '不可交易';
}
// 装备评分：装备深化组的 gearScore 优先；没有时用一个简单的兜底公式
function sxGearScore() {
  if (typeof gearScore === 'function') { try { return Math.max(0, Math.round(gearScore(inv.equip))) || 0; } catch (e) { /* 回退 */ } }
  let s = 0;
  for (const k of SLOTS) { const it = inv.equip[k]; if (!it || it.kind !== 'equip') continue; s += (it.lvl || 1) * 10 * (1 + (it.rar || 0) * 0.6) * (1 + (it.enh || 0) * 0.08) * gradeMul(it.grade ?? 2); }
  return Math.round(s);
}
function sxEpicCount() {
  if (typeof epicCollectCount === 'function') { try { return epicCollectCount() | 0; } catch (e) { /* 回退 */ } }
  const keys = new Set();
  for (const it of [...inv.items, ...(inv.storage || []), ...Object.values(inv.equip)]) if (it && it.kind === 'equip' && (it.rar || 0) >= 5) keys.add(it.key);
  return keys.size;
}
const sxJobName = (cls, job, awaken) => { const J = CLASSES[cls] && CLASSES[cls].jobs && CLASSES[cls].jobs[job]; return J ? (awaken ? J.awakenName || J.name : J.name) : ''; };
const sxClsName = (cls, job) => sxJobName(cls, job) || (CLASSES[cls] ? CLASSES[cls].name : cls || '');

/* ---- 存档：写本地 + 立即上传云存档（联机组提供的立即上传函数；没有时只写本地） ---- */
async function sxFlush() {
  save.write();
  const f = typeof netSaveFlush === 'function' ? netSaveFlush : typeof net !== 'undefined' && typeof net.saveNow === 'function' ? () => net.saveNow() : null;
  if (!f) return true;
  try { return (await f()) !== false; } catch (e) { return false; }
}
function sxGiveBack(it) { if (it && !inv.add(it)) inv.items.push(it); }   // 退回：背包满了也放进去（不受格子上限，避免丢失）
function sxDrop(p) { const L = sxPend(), i = L.indexOf(p); if (i >= 0) L.splice(i, 1); }
function sxRollback(p) {
  if (p.op === 'list') { sxGiveBack(p.item); game.gold += p.fee || 0; }
  else if (p.op === 'buy') game.gold += p.price || 0;
  else if (p.op === 'send') { game.gold += (p.gold || 0) + (p.postage || 0); for (const it of p.items || []) sxGiveBack(it); }
}
function sxReq(p) {
  if (p.op === 'list') return ['POST', '/api/auction/list', { item: p.item, price: p.price, hours: p.hours, rid: p.rid, char: p.char }];
  if (p.op === 'buy') return ['POST', '/api/auction/buy', { id: p.id, price: p.price, rid: p.rid, char: p.char }];
  if (p.op === 'send') return ['POST', '/api/mail/send', { to: p.to, title: p.title, body: p.body, gold: p.gold, items: (p.items || []).map(item => ({ item })), rid: p.rid }];
  return ['POST', '/api/mail/claim', { id: p.id, rid: p.rid }];
}
// 执行一条待办；成功返回服务端结果。失败抛错：err.definite = true 表示已经退回（服务端明确拒绝），否则待办保留、稍后自动重试
async function sxRun(p) {
  let res;
  try { res = await sxApi(...sxReq(p)); }
  catch (e) {
    if (sxDefinite(e)) { sxRollback(p); sxDrop(p); await sxFlush(); if (typeof itemsRefresh === 'function') itemsRefresh(); throw Object.assign(new Error(sxErrText(e)), { definite: true, status: e.status }); }
    throw Object.assign(new Error(sxErrText(e) + '（已记录，稍后自动重试）'), { definite: false });
  }
  if (p.op === 'claim') res.got = sxApplyClaim(res);
  sxDrop(p); await sxFlush();
  if (typeof itemsRefresh === 'function') itemsRefresh();
  if (res.unread != null) sxSetCounts(res);
  return res;
}
// 对账：把上次没完成的待办重新提交一遍（同一个 rid，服务端幂等）
async function sxReconcile() {
  if (!socialOn() || !save.data || !save.live || SX.reconciling) return;
  const L = sxPend(); if (!L.length) return;
  SX.reconciling = true;
  let n = 0;
  try { for (const p of L.slice()) { try { await sxRun(p); n++; } catch (e) { if (!e.definite) break; } } }
  finally { SX.reconciling = false; }
  if (n) toastMsg('上次没完成的交易已经处理好了', '#bfe8bf');
}

/* ---- 邮件 ---- */
function sxSetCounts(r) { if (r && r.unread != null) { SX.unread = r.unread | 0; SX.pending = r.pending | 0; } }
async function sxMailCounts() { if (!socialOn()) return; try { sxSetCounts(await sxApi('GET', '/api/mail/unread')); } catch (e) { /* 下次再查 */ } }
function mailUnread() { return socialOn() ? SX.unread : 0; }
// 附件生成物品：完整物品对象（拍卖行 / 好友寄出）换一个新的本地 id；{ key, n, opt } 按物品库生成
function sxMakeItems(list) {
  const out = [];
  for (const e of list || []) {
    if (e.item) { const it = JSON.parse(JSON.stringify(e.item)); it.id = itemSeq++; out.push(normalizeItem(it)); continue; }
    const D = ITEMS[e.key]; if (!D) continue;
    if (D.kind === 'equip') { for (let i = 0; i < (e.n || 1); i++) { const it = makeItem(e.key, 1, e.opt || {}); if (it) out.push(it); } }
    else { const it = makeItem(e.key, e.n || 1); if (it) out.push(it); }
  }
  return out;
}
// 领取前检查：物品 key 是否认识、背包空间够不够（整封领，不拆开）
function sxClaimCheck(m) {
  for (const e of m.items || []) { const key = e.item ? e.item.key : e.key; if (!ITEMS[key] && !(e.item && e.item.legacy)) return '附件里有当前版本不认识的物品，请刷新页面更新游戏'; }
  if (m.cera && typeof addCera !== 'function' && !ITEMS.cera) return '当前版本还不支持点券，请刷新页面更新游戏';
  const need = {}, stack = new Set();
  for (const e of m.items || []) {
    const D = e.item || ITEMS[e.key] || {}, key = e.item ? e.item.key : e.key, kind = e.item ? e.item.kind : D.kind;
    if (sxIsCurrency(key) || kind === 'quest') continue;
    if (kind !== 'equip') { if (stack.has(key) || inv.items.some(x => x.key === key && x.kind !== 'equip')) continue; stack.add(key); }
    const tab = TAB_OF({ kind, slot: D.slot }), k = kind === 'equip' && !e.item ? e.n || 1 : 1;
    need[tab] = (need[tab] || 0) + k;
  }
  for (const tab in need) if (inv.free(tab) < need[tab]) { const nm = (INV_TABS.find(t => t[0] === tab) || [0, tab])[1]; return `背包空间不足（「${nm}」页签需要空出 ${need[tab]} 格）`; }
  return null;
}
function sxApplyClaim(res) {
  const got = [];
  if (res.gold) { game.gold += res.gold; got.push(`${fmtNum(res.gold)} G`); }
  if (res.cera) { if (typeof addCera === 'function') addCera(res.cera, '邮件'); else giveItem(makeItem('cera', res.cera)); got.push(`点券 ${fmtNum(res.cera)}`); }
  for (const it of sxMakeItems(res.items)) { const nm = it.name + (it.n > 1 ? ` ×${it.n}` : ''); sxGiveBack(it); got.push(nm); if ((it.rar || 0) >= 5) sfx.epic(); }
  if (res.gold || res.cera) sfx.coin(); else sfx.pickup();
  return got;
}
async function sxMailClaim(m) {
  if (!save.live) throw new Error('请先进入游戏');
  const why = sxClaimCheck(m); if (why) throw Object.assign(new Error(why), { definite: true });
  const p = { rid: sxRid(), op: 'claim', id: m.id, t: Date.now() };
  sxPend().push(p);
  if (!(await sxFlush())) { sxDrop(p); save.write(); throw new Error('网络异常，存档没能上传，请稍后再试'); }
  return sxRun(p);
}
async function sxMailSend({ to, title, body, gold = 0, items = [] }) {
  gold = Math.max(0, Math.floor(gold || 0));
  const postage = gold || items.length ? SX_POSTAGE : 0;
  if (!to) throw new Error('请选择收件人');
  if (!title) throw new Error('请填写标题');
  if (items.length > 5) throw new Error('每封邮件最多附带 5 件物品');
  if (game.gold < gold + postage) throw new Error(`金币不足（附带 ${fmtNum(gold)} G + 邮费 ${fmtNum(postage)} G）`);
  for (const it of items) { if (!inv.items.includes(it)) throw new Error(`${it.name} 已经不在背包里了`); if (!sxTradable(it)) throw new Error(`${it.name}：${sxBindText(it)}，不能邮寄`); }
  for (const it of items) { inv.remove(it); sxClearQuick(it.key); }
  game.gold -= gold + postage;
  const p = { rid: sxRid(), op: 'send', to, title, body, gold, postage, items, char: save.data.name, t: Date.now() };
  sxPend().push(p);
  if (!(await sxFlush())) { sxRollback(p); sxDrop(p); save.write(); throw new Error('网络异常，存档没能上传，请稍后再试'); }
  return sxRun(p);
}
function sxClearQuick(key) { for (let i = 0; i < 6; i++) if (inv.quick[i] === key && !inv.count(key)) inv.quick[i] = null; }

/* ---- 拍卖行 ---- */
async function sxAuctionList(it, n, price, hours) {
  price = Math.floor(price); n = it.kind === 'equip' ? 1 : Math.max(1, Math.min(it.n || 1, Math.floor(n || 1)));
  if (!save.live) throw new Error('请先进入游戏');
  if (!inv.items.includes(it)) throw new Error('只能上架背包里的物品');
  if (!sxTradable(it)) throw new Error(`${it.name}：${sxBindText(it)}，不能上架`);
  if (!(price >= 1 && price <= SX_AUCTION.maxPrice)) throw new Error('价格要在 1 ~ 20 亿 G 之间');
  if (!SX_AUCTION.hours[hours]) throw new Error('请选择上架时长');
  const fee = sxAuctionFee(price, hours);
  if (game.gold < fee) throw new Error(`金币不足，保管费需要 ${fmtNum(fee)} G`);
  let part = it;
  if (it.kind !== 'equip' && n < it.n) { it.n -= n; part = { ...JSON.parse(JSON.stringify(it)), id: itemSeq++, n }; }
  else inv.remove(it);
  sxClearQuick(it.key);
  game.gold -= fee;
  const p = { rid: sxRid(), op: 'list', item: part, price, hours, fee, char: save.data.name, t: Date.now() };
  sxPend().push(p);
  if (!(await sxFlush())) { sxRollback(p); sxDrop(p); save.write(); throw new Error('网络异常，存档没能上传，请稍后再试'); }
  return sxRun(p);
}
async function sxAuctionBuy(a) {
  if (!save.live) throw new Error('请先进入游戏');
  if (a.mine) throw new Error('不能购买自己上架的物品');
  if (game.gold < a.price) throw new Error('金币不足');
  game.gold -= a.price;
  const p = { rid: sxRid(), op: 'buy', id: a.id, price: a.price, name: a.name, char: save.data.name, t: Date.now() };
  sxPend().push(p);
  if (!(await sxFlush())) { sxRollback(p); sxDrop(p); save.write(); throw new Error('网络异常，存档没能上传，请稍后再试'); }
  return sxRun(p);
}

/* ---- 全服公告：announce 事件 → 服务端广播（同一件物品 + kind + lvl 10 秒内只发一次） ---- */
function sxAnnounce(o) {
  if (!socialOn() || !o || !o.kind || !save.data) return;
  const it = o.item, t = performance.now();
  const key = `${o.kind}|${it ? it.id ?? it.key : ''}|${o.lvl ?? ''}|${o.job ?? ''}|${o.dungeon ?? ''}|${o.name ?? ''}`;
  if (SX.annSeen.get(key) > t - 10000) return;
  SX.annSeen.set(key, t);
  if (SX.annSeen.size > 200) for (const [k, v] of SX.annSeen) if (v < t - 10000) SX.annSeen.delete(k);
  const b = { kind: o.kind, char: save.data.name, lvl: o.lvl, box: o.box, name: o.name, text: o.text };
  if (it) b.item = { key: it.key, name: it.name, rar: it.rar || 0, enh: it.enh || 0, amp: it.amp || 0 };
  const dg = o.dungeon || (game.scene === 'dungeon' && game.dungeon && game.dungeon.def ? game.dungeon.def.id : null);
  if (dg && typeof DUNGEONS !== 'undefined' && DUNGEONS[dg]) b.place = DUNGEONS[dg].name;
  if (o.kind === 'job' || o.kind === 'awaken') b.job = sxJobName(save.data.cls, o.job || game.job, o.kind === 'awaken') || o.job;
  sxApi('POST', '/api/notice', b).catch(() => { /* 公告失败不影响游戏 */ });
}
bus.on('announce', sxAnnounce);
bus.on('pickup', e => { const it = e && e.item; if (it && it.kind === 'equip' && (it.rar || 0) >= 5) sxAnnounce({ kind: 'epic', item: it }); });
bus.on('enhance', e => { if (e && e.ok && e.lvl >= 10 && e.item) sxAnnounce({ kind: 'enhance', item: e.item, lvl: e.lvl }); });
bus.on('jobChange', e => { if (e && e.job) sxAnnounce({ kind: 'job', job: e.job }); sxRankSoon(); });
bus.on('dungeonEnter', e => {
  const best = (save.data && save.data.best) || {};
  SX.firstClear = e && SX_FIRST_CLEAR.includes(e.id) && !Object.keys(best).some(k => k.startsWith(e.id + ':')) ? e.id : null;
});
bus.on('dungeonClear', e => {
  if (!e) return;
  if (SX.firstClear === e.id) sxAnnounce({ kind: 'firstClear', dungeon: e.id });
  SX.firstClear = null;
  if (socialOn() && save.data && e.time > 0) sxApi('POST', '/api/rank/clear', { cid: String(save.data.created), dungeon: e.id, diff: e.diff | 0, time: Math.round(e.time * 1000) }).then(r => { if (r && r.record) toastMsg(`刷新了个人最快通关记录：${sxFmtTime(r.best)}`, '#8fe8ff'); }).catch(() => {});
  sxRankSoon();
});
const sxFmtTime = ms => { const s = Math.round(ms / 100) / 10, m = Math.floor(s / 60); return `${m ? m + '分' : ''}${(s % 60).toFixed(1)}秒`; };

/* ---- 排行榜上报（防抖 5 秒） ---- */
function sxRankSoon(ms = 5000) { if (!socialOn()) return; clearTimeout(SX.rankTm); SX.rankTm = setTimeout(sxRankReport, ms); }
function sxRankReport() {
  if (!socialOn() || !save.data || !save.live || !game.player) return;
  const d = save.data;
  SX.rankAt = Date.now(); SX.rankCid = d.created;
  return sxApi('POST', '/api/rank/report', { cid: String(d.created), char: d.name, cls: d.cls, job: game.job || null, lvl: game.lvl, exp: Math.floor(game.exp || 0),
    score: sxGearScore(), epics: sxEpicCount(), chars: save.chars.map(c => String(c.created)) }).catch(() => {});
}
for (const ev of ['levelUp', 'equip', 'unequip']) bus.on(ev, () => sxRankSoon());
bus.on('pvpResult', e => {
  if (!socialOn() || !save.data || !e) return;
  sxApi('POST', '/api/rank/duel', { cid: String(save.data.created), win: !!e.win, draw: !!e.draw }).catch(() => {});
});
// 进城：对账 + 刷新邮件数 + 上报排行榜（换了角色立即上报，否则最多 1 分钟一次）
bus.on('sceneEnter', () => {
  if (!socialOn() || !save.data) return;
  sxReconcile();
  if (SX.rankCid !== save.data.created || Date.now() - SX.rankAt > 60000) sxRankSoon(1500);
});
async function sxSigninCheck() {
  if (!socialOn()) return;
  try {
    const s = await sxApi('GET', '/api/signin'); SX.signed = !!s.signed; SX.signinState = s;
    if (!s.signed && SX.remindDay !== s.today) { SX.remindDay = s.today; toastMsg('每日签到：今天还没有签到哦（屏幕左侧“签到”）', '#ffe08a'); }
  } catch (e) { /* 下次再查 */ }
}
function sxOnline() { if (!socialOn()) return; sxMailCounts(); sxSigninCheck(); sxReconcile(); sxRankSoon(2000); }
bus.on('netLogin', sxOnline);
bus.on('netOpen', sxOnline);
bus.on('netLogout', () => { SX.unread = 0; SX.pending = 0; SX.signed = true; for (const n of ['auction', 'mail', 'rank', 'signin', 'gm']) if (menus.isOpen(n)) menus.close(n); });
// WS 推送：新邮件、全服公告（net.js 在 ORDER 里排在前面；没有联机模块的构建里这段不生效）
if (typeof net !== 'undefined' && typeof net.on === 'function') {
  net.on('mail:new', m => {
    sxSetCounts(m);
    toastMsg(`收到新邮件：${m.title || ''}（来自 ${m.from || '系统'}）`, '#ffe08a');
    if (menus.isOpen('mail') && menus.wins.mail._reload) menus.wins.mail._reload();
  });
  net.on('notice:show', m => { if (typeof noticeShow === 'function') noticeShow(m); });
}
