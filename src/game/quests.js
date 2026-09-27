/* =====================================================================
   任务引擎（任务与转职）：定义 / 状态 / 进度 / 奖励 / 每日重置
   - defineQuest(id, def)：
       def = { type: 'main'|'side'|'daily'|'job'|'hidden', name, npc（接取）, to（交付，默认同 npc）, lvl（等级要求）,
               pre: [前置任务], cls: 职业限定, job: true（需已转职）/ false（需未转职）, chapter, desc,
               goals: [目标...], reward: { exp, gold, sp, coins, items: [{ key, n } | { equip: 部位, lvl, rar }], title, flag, unlock },
               talk: { offer: [接取台词...], doing: [进行中...], done: [完成...] } }
     台词里「我：」开头的是玩家说的话；{name} 角色名，{cls} 职业名，{job} 转职名
   - 目标类型（进度全部靠监听 bus 事件推进，不往战斗 / 地下城代码里插调用）：
       clear   通关地下城 { dungeon, diff（最低难度）, rank（最低评价）, hurt（被击 ≤N）, time（秒内）, noCoin, n }
       kill    击杀 { kind（怪物 id 或数组）, boss, elite, dungeon, n }
       collect 收集任务道具 { key（任务道具 key，装备组的 defineItem 注册后会同时放进背包“任务”页）, item（道具名）, icon, from（怪物）, dungeon, rate（掉率）, boss, n }
               —— 只在任务进行中掉落；进度以任务记录为准，背包里的只是展示，交付 / 放弃时一并收回
       talk    对话 { npc, lines: [台词...] }
       reach   到达场景 { scene }
       level   等级 { lvl }
       equip   穿戴装备 { slot, rar（最低品质）, lvl（最低等级）}
       enhance 强化装备 { lvl（+N）, slot }
       skill   使用技能 { id（不填 = 任意技能；也可以是 { sword: 'upslash', gun: ..., mage: ... } 按职业区分）, n }
       use     使用消耗品 { key（不填 = 任意）, n }
       item    上交物品 { key, n }（交付时扣除）
       job     完成转职
   - 存档：save.data.quests = { id: { p: [各目标进度], t: 接取时间 } }（进行中）、save.data.questDone = { id: 完成时间 }
   ===================================================================== */
const QUESTS = {};
const QTYPES = {
  main: { name: '主线', col: '#ffd23a' },
  side: { name: '支线', col: '#8fd8ff' },
  hidden: { name: '隐藏', col: '#e0a0ff' },
  daily: { name: '每日', col: '#8aff9a' },
  job: { name: '转职', col: '#ff9a5a' },
};
// 任务日志的分类页签（隐藏任务归在支线页）
const QUEST_TABS = [{ id: 'main', name: '主线', types: ['main'] }, { id: 'side', name: '支线', types: ['side', 'hidden'] }, { id: 'daily', name: '每日', types: ['daily'] }, { id: 'job', name: '转职', types: ['job'] }];
const QUEST_MAX_ACTIVE = 20, QUEST_TRACK_MAX = 5;
// 任务经验：按该等级升级所需经验的比例给（和 progress.js 的 expNeed 曲线匹配）
const qexp = (lv, frac) => Math.round(expNeed(lv) * frac / 10) * 10;

// NPC 可以写成数组 [首选, 备选...]：取第一个已定义的（世界组新增的 NPC 合并前用备选顶上）
const questNpc = v => { const L = [].concat(v || []); return L.find(id => NPCS[id]) || L[0]; };
function defineQuest(id, def) {
  const q = { id, type: 'side', lvl: 1, pre: [], goals: [], reward: {}, desc: '', ...def };
  q.npc = questNpc(q.npc); q.to = questNpc(def.to) || q.npc;
  q.pre = [].concat(q.pre || []);
  const t = def.talk || {};
  q.talk = { offer: [].concat(t.offer || []), doing: [].concat(t.doing || []), done: [].concat(t.done || []) };
  q.goals = q.goals.map(g => ({ n: 1, ...g, npc: g.npc && questNpc(g.npc) }));
  // 任务道具：装备组的 defineItem 存在时注册成背包“任务”页的道具
  if (typeof defineItem === 'function' && typeof ITEMS !== 'undefined') for (const g of q.goals) if (g.type === 'collect' && g.key && !ITEMS[g.key]) { try { defineItem(g.key, { kind: 'quest', name: g.item, desc: g.desc || `任务「${q.name}」所需的道具。`, rar: g.rar || 1 }); } catch (e) { /* 物品库接口变化时不影响任务本身 */ } }
  q.seq = Object.keys(QUESTS).length;
  QUESTS[id] = q;
  return q;
}

/* ---- 存档（懒初始化） ---- */
function qdata() {
  const d = save.data; if (!d) return null;
  d.quests ??= {}; d.questDone ??= {}; d.questTrack ??= []; d.flags ??= {}; d.titles ??= [];
  return d;
}
const questRec = id => { const d = qdata(); return d && d.quests[id]; };
const questDone = id => { const d = qdata(); return !!(d && d.questDone[id]); };
const playerCls = () => game.player ? game.player.cls : save.data && save.data.cls;

/* ---- 条件与状态 ---- */
function questReqOk(q) {
  const d = qdata(); if (!d) return false;
  if (q.cls && ![].concat(q.cls).includes(playerCls())) return false;
  if (q.job === true && !game.job) return false;
  if (q.job === false && game.job) return false;
  for (const p of q.pre) if (!d.questDone[p]) return false;
  if (q.cond && !q.cond()) return false;
  return true;
}
// 'active' 进行中 / 'ready' 可交付 / 'avail' 可接 / 'soon' 即将开放（等级差 3 以内）/ 'done' 已完成 / 'locked'
function questState(id) {
  const q = QUESTS[id], d = qdata(); if (!q || !d) return 'locked';
  if (d.quests[id]) return questReady(id) ? 'ready' : 'active';
  if (d.questDone[id]) return 'done';
  if (!questReqOk(q)) return 'locked';
  if (game.lvl >= q.lvl) return 'avail';
  if (game.lvl >= q.lvl - 3) return 'soon';
  return 'locked';
}
// 单个目标当前进度（状态类目标实时计算）
function goalVal(q, rec, i) {
  const g = q.goals[i];
  switch (g.type) {
    case 'level': return game.lvl >= g.lvl ? g.n : 0;
    case 'job': return game.job ? g.n : 0;
    case 'equip': return questEquipMatch(g) ? g.n : 0;
    case 'enhance': return questMaxEnh(g) >= g.lvl ? g.n : 0;
    case 'item': return Math.min(g.n, inv.count(g.key));
    default: return Math.min(g.n, (rec && rec.p[i]) || 0);
  }
}
function questReady(id) { const q = QUESTS[id], rec = questRec(id); return !!rec && q.goals.every((g, i) => goalVal(q, rec, i) >= g.n); }
function questEquipMatch(g) {
  for (const s of SLOTS) {
    const it = inv.equip[s]; if (!it) continue;
    if (g.slot && g.slot !== s) continue;
    if (g.rar != null && (it.rar || 0) < g.rar) continue;
    if (g.lvl != null && (it.lvl || 0) < g.lvl) continue;
    return true;
  }
  return false;
}
function questMaxEnh(g) {
  let m = 0;
  for (const s of SLOTS) { const it = inv.equip[s]; if (it && (!g.slot || g.slot === s)) m = Math.max(m, it.enh || 0); }
  for (const it of inv.items) if (it.kind === 'equip' && (!g.slot || g.slot === it.slot)) m = Math.max(m, it.enh || 0);
  return m;
}
// 列表：按类型、等级、定义顺序排序
function questList(filter) {
  return Object.values(QUESTS).filter(filter).sort((a, b) => (a.type === 'main' ? 0 : 1) - (b.type === 'main' ? 0 : 1) || a.lvl - b.lvl || a.seq - b.seq);
}
const activeQuests = () => { const d = qdata(); return d ? Object.keys(d.quests).filter(id => QUESTS[id]).map(id => QUESTS[id]) : []; };

/* ---- 文本 ---- */
const npcName = id => (NPCS[id] && NPCS[id].name) || id || '—';
const sceneOfNpc = id => { for (const s of Object.values(SCENES)) if (s.npcs.some(n => n.npc === id)) return s; return null; };
const sceneLabel = S => S.area && S.area !== S.name ? (S.area.includes(S.name) ? S.area : `${S.name}·${S.area}`) : S.name;
const npcWhere = id => { if (!id) return '—'; const S = sceneOfNpc(id); return S ? `${npcName(id)}（${sceneLabel(S)}）` : npcName(id); };
const monName = k => (MON[k] && MON[k].name) || k;
const dgName = id => (DUNGEONS[id] && DUNGEONS[id].name) || id;
function questFmt(s) {
  const d = save.data || {}, C = CLASSES[playerCls()] || {}, J = game.job && C.jobs && C.jobs[game.job];
  return String(s).replace(/\{name\}/g, d.name || '勇士').replace(/\{cls\}/g, C.name || '冒险家').replace(/\{job\}/g, J ? J.name : (C.name || ''));
}
function goalText(g) {
  if (g.text) return questFmt(g.text);
  const list = (v, f) => [].concat(v).map(f).join(' / ');
  switch (g.type) {
    case 'clear': {
      const conds = [];
      if (g.diff) conds.push(`${DIFFS[g.diff].name}以上`);
      if (g.rank) conds.push(`评价 ${g.rank} 以上`);
      if (g.hurt != null) conds.push(`被击 ≤ ${g.hurt} 次`);
      if (g.time != null) conds.push(`${Math.floor(g.time / 60) ? Math.floor(g.time / 60) + ' 分 ' : ''}${g.time % 60 ? g.time % 60 + ' 秒' : ''}内`);
      if (g.noCoin) conds.push('不使用复活币');
      return `通关 ${!g.dungeon || g.dungeon === 'any' ? '任意地下城' : list(g.dungeon, dgName)}${conds.length ? '（' + conds.join('，') + '）' : ''}`;
    }
    case 'kill': return `${g.dungeon ? '在' + list(g.dungeon, dgName) + '' : ''}击败 ${g.kind ? list(g.kind, monName) : g.boss ? '领主' : g.elite ? '精英怪' : '怪物'}`;
    case 'collect': return `收集 ${g.item}`;
    case 'talk': return `与 ${npcName(g.npc)} 对话`;
    case 'reach': { const S = SCENES[g.scene]; return `前往 ${S ? S.area || S.name : g.scene}`; }
    case 'level': return `达到 Lv.${g.lvl}`;
    case 'job': return '完成转职';
    case 'equip': return `穿戴${g.lvl ? ' Lv.' + g.lvl + ' 以上的' : ''}${g.rar ? RARITY[g.rar].name + '以上的' : ''}${g.slot ? SLOT_NAME[g.slot] : '装备'}`;
    case 'enhance': return `将${g.slot ? SLOT_NAME[g.slot] : '装备'}强化到 +${g.lvl}`;
    case 'skill': { const id = goalSkillId(g); return `使用技能${id && SKILLS[id] ? '「' + SKILLS[id].name + '」' : ''}`; }
    case 'use': return `使用${g.key && CONSUMABLES[g.key] ? CONSUMABLES[g.key].name : '消耗品'}`;
    case 'item': return `带来 ${CONSUMABLES[g.key] ? CONSUMABLES[g.key].name : g.key}`;
  }
  return '???';
}
// 进度文字：计数目标显示 (a/b)，一次性目标显示 完成 / 未完成
const goalSkillId = g => g.id && typeof g.id === 'object' ? g.id[playerCls()] : g.id;
const goalCounted = g => g.n > 1 || ['kill', 'collect', 'skill', 'use', 'item'].includes(g.type);
function goalProgText(q, rec, i) {
  const g = q.goals[i], v = goalVal(q, rec, i);
  if (g.type === 'level') return `Lv.${Math.min(game.lvl, g.lvl)}/${g.lvl}`;
  return goalCounted(g) ? `${v}/${g.n}` : v >= g.n ? '完成' : '未完成';
}

/* ---- 奖励 ---- */
// 物品奖励：优先用装备组的 makeItem(key, n)，没有就回退到 makeConsumable / makeEquip
function questMakeItem(r) {
  if (r.equip) {
    const slot = r.equip === 'rand' ? pick(SLOTS) : r.equip, lvl = r.lvl || game.lvl, rar = r.rar ?? 1;
    if (typeof makeItem === 'function' && r.key) { try { const it = makeItem(r.key, 1); if (it) return it; } catch (e) { /* 回退 */ } }
    if (typeof rollEquip === 'function') { try { const it = rollEquip({ slot, lvl, rar, cls: playerCls() }); if (it) return it; } catch (e) { /* 回退 */ } }
    return makeEquip(slot, lvl, rar, playerCls());
  }
  if (typeof makeItem === 'function') { try { const it = makeItem(r.key, r.n || 1); if (it) return it; } catch (e) { /* 回退 */ } }
  if (CONSUMABLES[r.key]) return makeConsumable(r.key, r.n || 1);
  return null;
}
function questItemMakeAny(key) { if (typeof makeItem !== 'function') return null; try { return makeItem(key, 1) || null; } catch (e) { return null; } }
function questRewardName(r) {
  if (r.equip) return `${RARITY[r.rar ?? 1].name}${r.equip === 'rand' ? '装备' : SLOT_NAME[r.equip]}（Lv.${r.lvl || game.lvl}）`;
  return (CONSUMABLES[r.key] ? CONSUMABLES[r.key].name : r.name || r.key) + (r.n > 1 ? ` ×${r.n}` : '');
}
// 奖励清单（给界面显示用）：[{ kind, label, icon?, item? }]
const questExp = R => R.exp || (R.expFrac ? qexp(game.lvl, R.expFrac) : 0);
function questRewardList(q) {
  const R = q.reward || {}, out = [], exp = questExp(R);
  if (exp) out.push({ kind: 'exp', label: `经验值 +${fmtNum(exp)}` });
  if (R.gold) out.push({ kind: 'gold', label: `金币 +${fmtNum(R.gold)} G` });
  if (R.sp) out.push({ kind: 'sp', label: `SP +${R.sp}` });
  if (R.coins) out.push({ kind: 'coin', label: `复活币 ×${R.coins}` });
  for (const r of R.items || []) out.push({ kind: 'item', label: questRewardName(r), spec: r });
  if (R.title) out.push({ kind: 'title', label: `称号「${R.title}」` });
  if (R.unlock) out.push({ kind: 'unlock', label: `开放隐藏地下城「${dgName(R.unlock)}」` });
  if (R.flag === 'awaken') out.push({ kind: 'flag', label: '解锁觉醒技能' });
  else if (R.flag === 'jobTrial') out.push({ kind: 'flag', label: '获得转职资格' });
  return out;
}
function giveQuestRewards(q) {
  const R = q.reward || {}, d = qdata(), got = [];
  if (R.gold) { game.gold += R.gold; bus.emit('gold', { n: R.gold }); got.push({ kind: 'gold', label: `金币 +${fmtNum(R.gold)} G` }); }
  if (R.sp) { game.sp = (game.sp || 0) + R.sp; got.push({ kind: 'sp', label: `SP +${R.sp}` }); }
  if (R.coins) { d.coins = (d.coins || 0) + R.coins; got.push({ kind: 'coin', label: `复活币 ×${R.coins}` }); }
  for (const r of R.items || []) { const it = questMakeItem(r); if (!it) continue; giveItem(it); got.push({ kind: 'item', label: (it.n > 1 ? it.n + '× ' : '') + it.name, item: it }); }
  if (R.title) {   // 称号：装备组的称号表里有 titleKey 就发称号装备，否则记进 save.data.titles
    const it = R.titleKey && questItemMakeAny(R.titleKey);
    if (it) giveItem(it); else if (!d.titles.includes(R.title)) d.titles.push(R.title);
    got.push({ kind: 'title', label: `称号「${R.title}」`, item: it || null });
  }
  if (R.unlock) got.push({ kind: 'unlock', label: `隐藏地下城「${dgName(R.unlock)}」已开放` });
  if (R.flag) { d.flags[R.flag] = true; if (R.flag === 'awaken') { got.push({ kind: 'flag', label: '解锁觉醒技能' }); bus.emit('awaken', { job: game.job }); } }
  const exp = questExp(R);
  if (exp) { got.unshift({ kind: 'exp', label: `经验值 +${fmtNum(exp)}` }); gainExp(exp); }   // 经验最后给：升级提示排在奖励之后
  return got;
}

/* ---- 接取 / 推进 / 放弃 / 交付 ---- */
const questUI = { flash: {}, notified: {}, drawn: false };
function questAccept(id) {
  const q = QUESTS[id], d = qdata();
  if (questState(id) !== 'avail') return false;
  if (Object.keys(d.quests).length >= QUEST_MAX_ACTIVE) { toastMsg(`同时进行的任务最多 ${QUEST_MAX_ACTIVE} 个`, '#ff8a6a'); sfx.error(); return false; }
  d.quests[id] = { p: q.goals.map(() => 0), t: Date.now() };
  if (!d.questTrack.includes(id)) { d.questTrack.unshift(id); if (d.questTrack.length > QUEST_TRACK_MAX) d.questTrack.length = QUEST_TRACK_MAX; }
  questUI.flash[id] = game.t;
  sfxQuest('accept');
  toastMsg(`接受任务：【${QTYPES[q.type].name}】${q.name}`, QTYPES[q.type].col);
  bus.emit('questAccept', { id });
  questCheck(id);
  save.write();
  return true;
}
function questAbandon(id) {
  const d = qdata(); if (!d || !d.quests[id]) return;
  delete d.quests[id]; d.questTrack = d.questTrack.filter(x => x !== id); questItemsTake(QUESTS[id]); questDirty();
  toastMsg(`放弃了任务：${QUESTS[id].name}`, '#c8b8a0'); sfx.click();
  bus.emit('questAbandon', { id }); save.write();
}
// 目标推进：add 为增量
function questProgress(id, i, add = 1, at) {
  const q = QUESTS[id], rec = questRec(id); if (!rec) return;
  const g = q.goals[i], before = rec.p[i] || 0; if (before >= g.n) return;
  rec.p[i] = Math.min(g.n, before + add);
  questUI.flash[id] = game.t;
  if (g.type === 'collect') {
    const x = at && at.x != null ? at.x : game.player.x, y = at && at.y != null ? at.y : game.player.y;
    if (typeof fxText === 'function') fxText(`${g.item} ${rec.p[i]}/${g.n}`, x, y, 30, { col: '#ffe070', size: 11, dur: 1.4 });
    if (g.key) { const it = questItemMake(g.key); if (it) inv.add(it); }
    sfx.pickup();
  }
  if (rec.p[i] >= g.n && goalCounted(g)) toastMsg(`${q.name}：${goalText(g)}（${g.n}/${g.n}）`, '#e8f0c0');
  questCheck(id);
}
// 任务道具：装备组的物品库里注册过（defineItem kind:'quest'）才放进背包展示
function questItemMake(key) { if (typeof makeItem !== 'function' || typeof ITEMS === 'undefined' || !ITEMS[key]) return null; try { return makeItem(key, 1); } catch (e) { return null; } }
function questItemsTake(q) { for (const g of q.goals) if (g.type === 'collect' && g.key && inv.count(g.key)) inv.take(g.key, inv.count(g.key)); }
// 检查是否刚刚全部达成 → 提示去交付
function questCheck(id) {
  questDirty();
  const rec = questRec(id); if (!rec) return;
  const r = questReady(id);
  if (r && !rec.r) { const q = QUESTS[id]; rec.r = 1; sfxQuest('ready'); toastMsg(q.to ? `任务目标达成：${q.name} → 找 ${npcName(q.to)} 交付` : `任务目标达成：${q.name}`, '#ffd23a'); bus.emit('questReady', { id }); }
  else if (!r && rec.r) rec.r = 0;
}
const questCheckAll = () => { for (const q of activeQuests()) questCheck(q.id); };
function questComplete(id) {
  const q = QUESTS[id], d = qdata();
  if (questState(id) !== 'ready') return null;
  for (const g of q.goals) if (g.type === 'item') inv.take(g.key, g.n);
  questItemsTake(q);
  delete d.quests[id]; d.questTrack = d.questTrack.filter(x => x !== id);
  d.questDone[id] = Date.now(); questDirty();
  const got = giveQuestRewards(q);
  sfxQuest('done');
  if (game.player) { recalcStats(game.player); if (typeof fxAura === 'function') fxAura(game.player, '#ffd23a', 1.2); }
  bus.emit('questDone', { id });
  save.write();
  return got;
}
// 每天 06:00：每日任务的进度和完成记录清零（save.js 的 daily() 调用）
function questsDailyReset(d) {
  d.quests ??= {}; d.questDone ??= {}; questDirty();
  for (const id in QUESTS) if (QUESTS[id].type === 'daily') { delete d.quests[id]; delete d.questDone[id]; }
  if (d.questTrack) d.questTrack = d.questTrack.filter(id => !QUESTS[id] || QUESTS[id].type !== 'daily');
}

/* ---- 事件监听：一切进度都从这里推进 ---- */
function forGoals(type, fn) {
  const d = qdata(); if (!d) return;
  for (const id of Object.keys(d.quests)) {
    const q = QUESTS[id], rec = d.quests[id]; if (!q) continue;
    q.goals.forEach((g, i) => { if (g.type === type && (rec.p[i] || 0) < g.n) fn(q, g, i, rec); });
  }
}
const inList = (v, x) => [].concat(v).includes(x);
const rankIdx = r => RANKS.findIndex(x => x[0] === r);
function killMatch(g, e, kinds) {
  if (g.dungeon && !inList(g.dungeon, e.dungeon)) return false;
  if (kinds && !inList(kinds, e.kind)) return false;
  if (g.boss && !e.boss) return false;
  if (g.elite && !e.elite) return false;
  if (g.diff != null && !(game.dungeon && game.dungeon.diff >= g.diff)) return false;
  return true;
}
bus.on('kill', e => {
  forGoals('kill', (q, g, i) => { if (killMatch(g, e, g.kind)) questProgress(q.id, i, 1); });
  forGoals('collect', (q, g, i) => { if (killMatch(g, e, g.from) && Math.random() < (g.rate ?? (e.boss ? 1 : 0.45))) questProgress(q.id, i, 1, e); });
});
// 通关：条件不满足时告诉玩家差在哪（试炼类任务很需要）
function clearFails(g, e) {
  const why = [];
  if (g.diff != null && e.diff < g.diff) why.push(`难度需要${DIFFS[g.diff].name}以上`);
  if (g.rank && rankIdx(e.rank) < rankIdx(g.rank)) why.push(`评价 ${e.rank}（需要 ${g.rank} 以上）`);
  if (g.hurt != null && e.hurt > g.hurt) why.push(`被击 ${e.hurt} 次（需要 ≤ ${g.hurt}）`);
  if (g.time != null && e.time > g.time) why.push(`用时 ${Math.round(e.time)} 秒（需要 ${g.time} 秒内）`);
  if (g.noCoin && game.dungeon && game.dungeon.usedCoins) why.push('使用了复活币');
  return why;
}
bus.on('dungeonClear', e => {
  forGoals('clear', (q, g, i) => {
    if (g.dungeon && g.dungeon !== 'any' && !inList(g.dungeon, e.id)) return;
    const why = clearFails(g, e);
    if (why.length) { toastMsg(`「${q.name}」条件未达成：${why.join('，')}`, '#ff9a7a'); return; }
    questProgress(q.id, i, 1);
  });
});
bus.on('sceneEnter', e => forGoals('reach', (q, g, i) => { if (g.scene === e.id) questProgress(q.id, i, 1); }));
bus.on('npcTalk', e => forGoals('talk', (q, g, i) => { if (g.npc === e.id) questProgress(q.id, i, 1); }));
bus.on('itemUse', e => forGoals('use', (q, g, i) => { if (!g.key || g.key === e.key) questProgress(q.id, i, 1); }));
for (const ev of ['levelUp', 'equip', 'enhance', 'jobChange', 'pickup']) bus.on(ev, () => questCheckAll());
// 技能：监听 skillUse；战斗模块还没发这个事件时，用 game.onSkill 兜底（同一帧同一技能只算一次）
const questSkillSeen = { id: null, t: -1 };
function questSkillUsed(id) {
  if (questSkillSeen.id === id && questSkillSeen.t === game.t) return;
  questSkillSeen.id = id; questSkillSeen.t = game.t;
  forGoals('skill', (q, g, i) => { const want = goalSkillId(g); if (!want || want === id) questProgress(q.id, i, 1); });
}
bus.on('skillUse', e => questSkillUsed(e.id));
{ const orig = game.onSkill; game.onSkill = function (id) { orig.call(this, id); questSkillUsed(id); }; }

/* ---- 世界 / NPC 钩子（world.js、npc.js 预留） ---- */
// 某 NPC 身上的任务：可交付（交付人是他）→ 可接（发布人是他）→ 进行中（交付人是他 / 有找他对话的目标）
function questsOfNpc(npcId) {
  const d = qdata(); if (!d) return [];
  const ready = [], avail = [], active = [];
  for (const q of Object.values(QUESTS)) {
    const st = questState(q.id);
    if (st === 'ready' && q.to === npcId) ready.push(q.id);
    else if (st === 'avail' && q.npc === npcId) avail.push(q.id);
    else if (st === 'active' && (q.to === npcId || questTalkPending(q.id, npcId))) active.push(q.id);
  }
  const by = (a, b) => (QUESTS[a].type === 'main' ? 0 : 1) - (QUESTS[b].type === 'main' ? 0 : 1) || QUESTS[a].lvl - QUESTS[b].lvl || QUESTS[a].seq - QUESTS[b].seq;
  return [...ready.sort(by), ...avail.sort(by), ...active.sort(by)];
}
// 进行中的任务里还没完成的「与某 NPC 对话」目标
function questTalkPending(id, npcId) { const q = QUESTS[id], rec = questRec(id); if (!rec) return null; const i = q.goals.findIndex((g, k) => g.type === 'talk' && g.npc === npcId && (rec.p[k] || 0) < g.n); return i >= 0 ? q.goals[i] : null; }
function questTalksFor(npcId) { const out = []; for (const q of activeQuests()) { const g = questTalkPending(q.id, npcId); if (g) out.push({ q, g }); } return out; }
// 头顶标记：可交付 / 有对话目标 → 黄色 ?；可接 → 黄色 !；进行中 → 灰色 ?
const questMkCache = { k: '', v: 0, m: {} };
const questDirty = () => { questMkCache.v++; };
function questMarkerInfo(npcId) {
  const k = `${game.t}:${game.lvl}:${game.job}:${questMkCache.v}`;   // 每帧每个 NPC 只算一次；任务状态一变就失效
  if (questMkCache.k !== k) { questMkCache.k = k; questMkCache.m = {}; }
  if (npcId in questMkCache.m) return questMkCache.m[npcId];
  return (questMkCache.m[npcId] = questMarkerCalc(npcId));
}
function questMarkerCalc(npcId) {
  if (!qdata() || !NPCS[npcId]) return null;
  let avail = null, active = false;
  for (const id of questsOfNpc(npcId)) {
    const st = questState(id), q = QUESTS[id];
    if (st === 'ready' || (st === 'active' && questTalkPending(id, npcId))) return { ch: '?', col: '#ffd23a', main: q.type === 'main' };
    if (st === 'avail' && (!avail || (q.type === 'main' && avail.type !== 'main'))) avail = q;
    if (st === 'active') active = true;
  }
  if (avail) return { ch: '!', col: '#ffd23a', main: avail.type === 'main' };
  if (active) return { ch: '?', col: '#9a9a9a', main: false };
  return null;
}
function questMarker(npcId) { const m = questMarkerInfo(npcId); return m ? m.ch : null; }
function questsOnTalk(npcId) { /* 对话目标由 npcTalk 事件推进；这里预留给以后的剧情触发 */ }
// 进入场景：提示这里有新的主线任务可以接
function questsOnEnterScene(sceneId) {
  const S = SCENES[sceneId]; if (!S || !qdata()) return;
  for (const n of S.npcs) for (const id of questsOfNpc(n.npc)) {
    const q = QUESTS[id];
    if (q.type === 'main' && questState(id) === 'avail' && !questUI.notified[id]) { questUI.notified[id] = 1; game.after(0.6, () => toastMsg(`新的主线任务：${q.name}（${npcName(q.npc)}）`, '#ffd23a')); }
  }
}
// 觉醒任务完成后才能学觉醒技能（战斗组的技能学习条件可以调用）
function awakenUnlocked() { const d = qdata(); return !!(d && d.flags.awaken); }
// 当前该做的主线（追踪栏在没有进行中的主线时给引导）
function questNextMain() {
  const story = q => q.type === 'main' || q.story;
  if (activeQuests().some(story)) return null;
  return questList(q => story(q) && ['avail', 'soon'].includes(questState(q.id)))[0] || null;
}

/* ---- 音效 ---- */
function sfxQuest(kind) {
  if (!sfx.ok) return;
  if (kind === 'accept') { [0, 7, 12].forEach((s, i) => sfx.tone('triangle', 587 * Math.pow(2, s / 12), 0, 0.18, 0.1, { delay: i * 0.07 })); sfx.tone('sine', 1760, 2200, 0.2, 0.04, { delay: 0.2 }); }
  else if (kind === 'ready') { [0, 4, 7].forEach((s, i) => sfx.tone('sine', 880 * Math.pow(2, s / 12), 0, 0.22, 0.08, { delay: i * 0.06 })); }
  else if (kind === 'done') {
    [0, 4, 7, 12].forEach((s, i) => sfx.tone('triangle', 523 * Math.pow(2, s / 12), 0, 0.3, 0.1, { delay: i * 0.09 }));
    [12, 16, 19, 24].forEach(s => sfx.tone('sine', 523 * Math.pow(2, s / 12), 0, 0.9, 0.05, { delay: 0.4, attack: 0.02 }));
  }
}
