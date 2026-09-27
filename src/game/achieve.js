/* =====================================================================
   成就系统（定义在 content/achievements.js，窗口在 ui/social/achieve.js）
   - 数据跟随角色存档（云同步）：save.data.ach = { c: 统计计数, done: { id: 达成时间 }, got: { id: 领奖时间 } }
   - 统计全部来自事件总线（kill / dungeonClear / enhance / amplify / boxOpen / pvpResult …），状态类（等级、图鉴、称号、去过的地方）在检查时直接读
   - 检查：有相关事件时标记“脏”，最多每 0.4 秒检查一次没完成的成就；达成 → 弹窗 + 音效，奖励到成就窗口里领取（点券 / 称号 / 道具）
   - 商城组旧成就 CASH_ACH：同 id 的成就读档时如果 save.data.shop.ach[id] 已有值 → 直接算达成且已领奖；本系统达成时也写 save.data.shop.ach[id]，两边都不会重复发点券
   - 成就点进排行榜（net/social.js 的 sxRankReport 上报 ach）
   ===================================================================== */
const ACH = { dirty: true, timer: 0, queue: [], ctx: null, silent: true };
function achData() {
  const d = save.data; if (!d) return null;
  const A = d.ach ??= {};
  A.c ??= {}; A.done ??= {}; A.got ??= {};
  A.c.bossK ??= {}; A.c.npc ??= {};
  return A;
}
const achList = () => Object.values(ACHIEVEMENTS);
const achN = A => (typeof A.n === 'function' ? A.n() : A.n) || 1;
function achPoints(d = achData()) { if (!d) return 0; let p = 0; for (const id in d.done) { const A = ACHIEVEMENTS[id]; if (A) p += ACH_TIER[A.tier].pts; } return p; }
function achUnclaimed(d = achData()) { if (!d) return 0; let n = 0; for (const id in d.done) if (!d.got[id] && ACHIEVEMENTS[id] && achHasReward(ACHIEVEMENTS[id])) n++; return n; }
const achHasReward = A => !!(A.reward && (A.reward.cera || A.reward.title || (A.reward.items && A.reward.items.length)));
// 计数（add）/ 取最大值（max）
function achAdd(k, v = 1) { const d = achData(); if (!d) return; d.c[k] = (d.c[k] || 0) + v; achMark(); }
function achMax(k, v) { const d = achData(); if (!d || !(v > (d.c[k] || 0))) return; d.c[k] = v; achMark(); }
function achMark() { ACH.dirty = true; if (!ACH.timer) ACH.timer = setTimeout(() => { ACH.timer = 0; achCheck(); }, 400); }

/* ---- 检查用的上下文：按需计算，同一次检查里只算一次 ---- */
function achCtx(d) {
  const memo = {}, once = (k, f) => (k in memo ? memo[k] : (memo[k] = f()));
  const best = save.data.best || {};
  const cleared = id => Object.keys(best).some(k => k.startsWith(id + ':'));
  return {
    c: d.c,
    get lvl() { return game.lvl || save.data.lvl || 1; },
    get job() { return game.job || save.data.job; },
    get awaken() { return !!((save.data.flags || {}).awaken || d.c.awaken); },
    get skills() { return once('sk', () => Object.keys(game.skillLv || {}).filter(id => (game.skillLv[id] || 0) > 0 && SKILLS[id] && !SKILLS[id].passive).length); },
    get skillsMax() { return once('skm', () => Object.keys(game.skillLv || {}).filter(id => SKILLS[id] && (game.skillLv[id] || 0) >= (SKILLS[id].maxLv || 10)).length); },
    quest: type => once('q' + type, () => Object.keys(save.data.questDone || {}).filter(id => QUESTS[id] && QUESTS[id].type === type).length),
    get playH() { return (save.data.playTime || 0) / 3600; },
    get chars() { return save.chars ? save.chars.length : 1; },
    get pts() { return achPoints(d); },
    get codex() { return once('cx', () => (typeof codexStats === 'function' ? codexStats() : { epic: 0, legend: 0, set: 0, artifact: 0, abyssEpic: 0 })); },
    get score() { return once('gs', () => { try { return typeof gearScore === 'function' ? gearScore(inv.equip) | 0 : 0; } catch (e) { return 0; } }); },
    get own() { return once('own', achOwned); },
    get seen() { return Object.keys(save.data.seen || {}).filter(id => SCENES[id]).length; },
    seenId: id => !!(save.data.seen || {})[id],
    get npcs() { return Object.keys(d.c.npc).filter(id => NPCS[id]).length; },
    cleared, clearedOf: ids => ids.filter(cleared).length,
    get dgCleared() { return once('dgc', () => achDgIds(() => true).filter(cleared).length); },
    bossK: (kind, dg) => Math.max(d.c.bossK[kind] || 0, dg && cleared(dg) ? 1 : 0),
  };
}
// 背包 + 仓库 + 身上：称号种类、时装件数、单套时装最多件数、宠物、光环、卡片种类
function achOwned() {
  const all = [...(inv.items || []), ...(inv.storage || []), ...Object.values(inv.equip || {})].filter(Boolean);
  const titles = new Set(), sets = {}, cards = new Set();
  let avatars = 0, pets = 0, auras = 0;
  for (const it of all) {
    if (it.kind === 'equip' && it.slot === 'title') titles.add(it.key);
    else if (it.kind === 'equip' && typeof it.slot === 'string' && it.slot.startsWith('av_')) {
      if (it.slot === 'av_pet') pets++; else if (it.slot === 'av_aura') auras++;
      else if (!/^av_pet[RBG]$/.test(it.slot) && it.slot !== 'av_weapon') { avatars++; if (it.set) sets[it.set] = (sets[it.set] || 0) + 1; }
    } else if (typeof it.key === 'string' && it.key.startsWith('card_')) cards.add(it.key);
  }
  for (const n of save.data.titles || []) titles.add(n);   // 任务发过的称号（名字），卖掉了也算
  return { titles: titles.size, avatars, avatarSet: Math.max(0, ...Object.values(sets)), pets, auras, cards: cards.size };
}

/* ---- 检查 / 达成 ---- */
function achCheck() {
  const d = achData(); if (!d || !save.live) return;
  ACH.dirty = false;
  const X = achCtx(d), shop = save.data.shop ??= {}; shop.ach ??= {};
  achMax('goldMax', game.gold | 0);
  const got = [];
  for (let round = 0; round < 3; round++) {   // 成就点类成就可能被本轮新达成的成就触发，最多再算两轮
    let any = false;
    for (const A of achList()) {
      if (d.done[A.id]) continue;
      // 商城旧成就已经发过点券：直接算达成、已领奖
      if (A.cash && shop.ach[A.cash]) { d.done[A.id] = shop.ach[A.cash]; d.got[A.id] = shop.ach[A.cash]; any = true; if (Date.now() - shop.ach[A.cash] < 60000) got.push(A); continue; }
      let v = 0; try { v = A.val(X) || 0; } catch (e) { v = 0; }
      if (v < achN(A)) continue;
      d.done[A.id] = Date.now(); any = true; got.push(A);
      if (A.cash) shop.ach[A.cash] = d.done[A.id];   // 占住商城旧成就，商城那边的兜底不会再发
    }
    if (!any) break;
  }
  if (!got.length) return;
  save.write();
  if (!ACH.silent) for (const A of got) achToast(A);
  if (got.some(A => A.tier === 3) && !ACH.silent) for (const A of got.filter(x => x.tier === 3)) bus.emit('announce', { kind: 'ach', name: A.name });
  bus.emit('achDone', { list: got.map(A => A.id) });
  if (typeof sxRankSoon === 'function') sxRankSoon();
}
// 当前进度（窗口用）：{ v, n, done, got }
function achProgress(A, X) {
  const d = achData(); const n = achN(A);
  if (d.done[A.id]) return { v: n, n, done: d.done[A.id], got: d.got[A.id] };
  let v = 0; try { v = A.val(X) || 0; } catch (e) { v = 0; }
  return { v: Math.min(v, n), n, done: 0, got: 0 };
}
/* ---- 领奖 ---- */
function achRewardText(A) {
  const r = A.reward || {}, out = [];
  if (r.cera) out.push(`点券 ${fmtNum(r.cera)}`);
  if (r.title && ITEMS[r.title]) out.push(`称号「${ITEMS[r.title].name}」`);
  for (const [k, n] of r.items || []) if (ITEMS[k]) out.push(`${ITEMS[k].name}${n > 1 ? ' ×' + n : ''}`);
  return out.join('、');
}
function achClaim(id) {
  const d = achData(), A = ACHIEVEMENTS[id];
  if (!d || !A || !d.done[id]) return { err: '还没有达成' };
  if (d.got[id]) return { err: '奖励已经领过了' };
  const r = A.reward || {}, items = [];
  if (r.title && ITEMS[r.title]) items.push({ key: r.title, n: 1 });
  for (const [k, n] of r.items || []) if (ITEMS[k]) items.push({ key: k, n });
  if (items.length && typeof sxClaimCheck === 'function') { const why = sxClaimCheck({ items }); if (why) return { err: why }; }
  d.got[id] = Date.now();
  if (r.cera) { if (typeof addCera === 'function') addCera(r.cera, `成就：${A.name}`); else if (ITEMS.cera) giveItem(makeItem('cera', r.cera)); }
  for (const e of items) { const D = ITEMS[e.key]; if (D.kind === 'equip') for (let i = 0; i < e.n; i++) giveItem(makeItem(e.key)); else giveItem(makeItem(e.key, e.n)); }
  if (r.title && ITEMS[r.title]) { const nm = ITEMS[r.title].name; if (!(save.data.titles || []).includes(nm)) (save.data.titles ??= []).push(nm); }
  save.write(); if (typeof itemsRefresh === 'function') itemsRefresh();
  return { ok: true, text: achRewardText(A) };
}

/* ---- 事件 → 统计 ---- */
bus.on('kill', e => { achAdd('kill'); if (e.boss) { achAdd('boss'); const d = achData(); if (d) d.c.bossK[e.kind] = (d.c.bossK[e.kind] || 0) + 1; } if (e.elite) achAdd('elite'); });
bus.on('dungeonClear', e => {
  const D = DUNGEONS[e.id]; if (!D) return;
  achAdd('clear');
  if (e.rank === 'SSS') achAdd('sss');
  if (['S', 'SS', 'SSS'].includes(e.rank)) achAdd('splus');
  if (e.hurt === 0 && D.lvl[0] >= 5) achAdd('nohit');
  if (e.time > 0 && e.time <= 60 && D.lvl[0] >= 10) achAdd('fast');
  achMax('combo', e.maxCombo | 0);
  for (let i = 1; i <= 3; i++) if ((e.diff | 0) >= i) achAdd('d' + i);
  if (D.abyss) achAdd('abyss');
  const P = typeof netParty !== 'undefined' && netParty.p;
  if (P && P.members.length >= 2) { achAdd('coop'); if (P.members.length >= 4) achAdd('coop4'); }
});
bus.on('playerDeath', () => achAdd('death'));
bus.on('questDone', e => { const Q = QUESTS[e.id]; if (Q && Q.type === 'daily') achAdd('daily'); else achMark(); });
for (const ev of ['levelUp', 'jobChange', 'equip', 'unequip', 'codex', 'sceneEnter', 'pickup', 'itemUse']) bus.on(ev, () => achMark());
bus.on('awaken', () => achMax('awaken', 1));
bus.on('npcTalk', e => { const d = achData(); if (d && e && e.id && !d.c.npc[e.id]) { d.c.npc[e.id] = 1; achMark(); } });
bus.on('enhance', e => { achAdd('enhTry'); if (e.ok) achMax('enhMax', e.lvl | 0); if (e.broken) achAdd('broken'); });
bus.on('amplify', e => { if (e && e.ok) achMax('ampMax', e.lvl | 0); });
bus.on('forge', e => { if (e && e.ok) achMax('forgeMax', e.lvl | 0); });
bus.on('enchant', () => achAdd('enchant'));
bus.on('boxOpen', e => { achAdd('boxAll'); if (e && /^box_magic/.test(e.key || '')) achAdd('box'); });
bus.on('skySynth', e => { if (e && e.ok) achAdd('sky'); });
bus.on('cashBuy', e => { if (!e) return; achAdd('cashBuy'); if (e.cur === 'cera' || !e.cur) achAdd('cashSpent', e.cost | 0); });
bus.on('sell', e => achAdd('sell', e && e.items ? e.items.length : 1));
bus.on('disassemble', () => achAdd('dis'));
bus.on('repair', () => achAdd('repair'));
bus.on('gold', () => achMark());
bus.on('pvpResult', e => { if (!e) return; achAdd('duel'); if (e.win) achAdd('duelWin'); });
bus.on('epicDrop', () => achMark());
// 社交（本组自己发的事件）
bus.on('sxAuction', e => { if (e.op === 'list') achAdd('aucList'); else if (e.op === 'buy') achAdd('aucBuy'); else if (e.op === 'sold') achAdd('aucSold', e.n || 1); });
bus.on('sxMail', e => { if (e.op === 'send') achAdd('mailSent'); });
bus.on('sxChat', () => achAdd('chat'));
bus.on('sxSignin', e => { achAdd('signin'); achMax('streak', e.streak | 0); });
bus.on('guildUpdate', e => {
  const g = e.data && e.data.guild; if (!g) return;
  achMax('guildJoin', 1); achMax('guildLvl', g.lvl);
  if (e.data.me) { achMax('guildContrib', e.data.me.contribTotal | 0); if (e.data.me.role === 'leader') achMax('guildLead', 1); }
});
bus.on('friendsList', e => achMax('friends', e.n | 0));
// 进入角色（读档后第一次进城）：静默检查一次（老存档里已经满足的直接算达成，不弹窗）
bus.on('sceneEnter', () => { if (ACH.silentPending) { ACH.silentPending = false; ACH.silent = true; achCheck(); ACH.silent = false; } });
bus.on('charLeave', () => { ACH.silentPending = true; });
ACH.silentPending = true;
setInterval(() => { if (ACH.dirty && save.data && save.live) { if (ACH.silentPending) return; achCheck(); } }, 2000);
