/* =====================================================================
   24. 存档（localStorage）：等级/经验/SP/技能/背包/装备/金币/疲劳/复活币/难度解锁/最佳评价
   疲劳与复活币每天 06:00 重置（与原作一致）
   ===================================================================== */
const FATIGUE_MAX = 156;
const dayKey = () => { const d = new Date(Date.now() - 6 * 3600 * 1000); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
const SAVE_V = 5, MAX_CHARS = 6;
const DUNGEON_ALIAS = { path: 'lorien', deep: 'lorien_deep', shade: 'dark_woods', thunder: 'thunder_ruins', venom: 'venom_ruins', camp: 'graca', flame: 'blazing_graca', abyss: 'dark_thunder' };
/* 存档结构：{ v, cur, chars: [角色数据...] }，每个角色独立保存等级 / 背包 / 任务 / 位置等（官方的角色选择） */
const save = {
  key: ['test', 'dungeon', 'town', 'bot', 'cls', 'duel'].some(k => PARAMS.has(k)) ? 'dawnbreak_dev' : 'dawnbreak_save_v1', data: null, chars: [], cur: -1, live: false, acct: {},   // 调试参数用独立存档，不碰玩家的正式存档
  defaults(cls = 'sword', name = '勇士') {
    return { v: SAVE_V, cls, name, job: null, lvl: 1, exp: 0, sp: 150, gold: 1500, skillLv: {}, skillBar: Array(SKILL_SLOTS).fill(null), inv: [], equip: {}, quick: [null, null, null, null, null, null], storage: [],
      fatigue: FATIGUE_MAX, day: dayKey(), coins: 5, unlocked: {}, best: {}, weak: 0, clears: 0, created: Date.now(), playTime: 0, quests: {}, questDone: {}, loc: null, seen: {}, titles: [], buyback: [],
      opts: { music: 0.6, sfx: 0.9 } };
  },
  // 读取全部角色；返回是否至少有一个角色
  loadAll() {
    this.chars = []; this.cur = -1; this.live = false; this.acct = {};
    if (PARAMS.has('fresh')) return false;
    try {
      const raw = localStorage.getItem(this.key); if (!raw) return false;
      const d = JSON.parse(raw);
      if (d.chars) { this.chars = d.chars; this.cur = d.cur ?? 0; this.acct = d.acct || {}; }
      else { this.chars = [d]; this.cur = 0; }            // v1/v2：单角色存档
      this.chars = this.chars.filter(c => c && CLASSES[c.cls]).map(c => this.migrate({ ...this.defaults(c.cls), ...c, v: c.v || 1, opts: { ...this.defaults().opts, ...(c.opts || {}) } }));
    } catch (e) { this.chars = []; }
    if (this.cur >= this.chars.length) this.cur = this.chars.length - 1;
    for (const c of this.chars) if (!c.name || !String(c.name).trim()) c.name = CLASSES[c.cls].name;   // 早期存档 / 本机导入的角色可能没有名字
    this.mergeAcctCurrency();
    return this.chars.length > 0;
  },
  // 兼容旧接口：读取并选中上次的角色
  load() { if (!this.loadAll()) { this.data = null; return false; } this.select(Math.max(0, this.cur)); return true; },
  select(i) { this.cur = i; this.data = this.chars[i]; this.live = false; this.daily(); },
  daily() { const d = dayKey(); if (this.data.day !== d) { this.data.day = d; this.data.fatigue = FATIGUE_MAX; this.data.coins = Math.max(this.data.coins, 0) + 1; if (typeof questsDailyReset === 'function') questsDailyReset(this.data); toastMsg('新的一天：疲劳值已恢复，领取复活币 ×1', '#bfe8bf'); } },
  write() {
    if (!this.data || !this.live) return;   // 只有 apply() 之后（游戏状态已对应这个角色）才写，避免在标题 / 选角界面把空状态写进角色
    const d = this.data;
    d.lvl = game.lvl; d.exp = game.exp; d.sp = game.sp || 0; d.gold = game.gold; d.skillLv = game.skillLv; d.skillBar = game.skillBar; d.job = game.job || null;
    d.inv = inv.items; d.equip = inv.equip; d.quick = inv.quick; d.storage = inv.storage || d.storage || [];
    if (this.cur < 0) { this.chars.push(d); this.cur = this.chars.length - 1; }
    this.chars[this.cur] = d;
    this.persist();
  },
  // 点券 / 魔盒碎片 / 礼包币是账号共享的（官方也是）：存在根部的 acct 里，所有角色共用。
  // 老存档 / 本机导入的角色身上还留着的余额，读取时收进账号（收完清零，重复执行也不会多算）
  mergeAcctCurrency() {
    const A = this.acct;
    A.cera = A.cera || 0; A.shard = A.shard || 0; A.gcoin = A.gcoin || 0;
    for (const c of this.chars) {
      A.cera += c.cera || 0; c.cera = 0;
      if (c.shop) { A.shard += c.shop.shard || 0; A.gcoin += c.shop.gcoin || 0; c.shop.shard = 0; c.shop.gcoin = 0; }
    }
  },
  // 写进 localStorage；登录后同时通知云存档（net/account.js 防抖上传）
  persist() {
    try { localStorage.setItem(this.key, JSON.stringify({ v: SAVE_V, cur: this.cur, chars: this.chars, acct: this.acct })); } catch (e) { /* 存储已满或无痕模式 */ }
    if (typeof cloudSave !== 'undefined') cloudSave.changed();
  },
  // 旧版本存档升级
  migrate(d) {
    if ((d.v || 1) < 2) {   // v1 → v2：补发平衡调整的福利
      d.sp = (d.sp || 0) + 150; d.gold = (d.gold || 0) + 1000;
      const C = CLASSES[d.cls]; for (const id of C.start) if (!d.skillLv[id]) { d.skillLv[id] = 1; if (!d.skillBar.includes(id)) { const k = d.skillBar.indexOf(null); if (k >= 0) d.skillBar[k] = id; } }
      const add = (key, n) => { const it = (d.inv || []).find(x => x.key === key); if (it) it.n += n; else (d.inv = d.inv || []).push(makeConsumable(key, n)); };
      add('hpS', 10); add('mpS', 10); add('hpM', 5);
      this.migrated = true;
    }
    if ((d.v || 1) < 3) {   // v2 → v3：地下城改成官方名称（编号映射），新增角色名 / 转职 / 任务 / 位置
      const remap = o => { const r = {}; for (const k in o || {}) { const [id, diff] = k.split(':'); r[(DUNGEON_ALIAS[id] || id) + (diff !== undefined ? ':' + diff : '')] = o[k]; } return r; };
      d.unlocked = remap(d.unlocked); d.best = remap(d.best); d.loc = null;
    }
    if ((d.v || 1) < 4) {   // v3 → v4：技能体系按官方重做（旧技能删除、初始技能改变）→ 和官方大版本一样，技能初始化并返还全部 SP
      const C = CLASSES[d.cls];
      d.skillLv = {}; for (const id of C.start) d.skillLv[id] = 1;
      d.skillBar = C.bar.slice(0, 12); while (d.skillBar.length < 12) d.skillBar.push(null);
      d.sp = 150; for (let l = 2; l <= (d.lvl || 1); l++) d.sp += 28 + l;   // 与 onLevelUp 的 SP 发放一致
      if (d.opts) d.opts.cmdLock = {};
      this.skillReset = true;
    }
    if ((d.v || 1) < 5) this.migrateV5(d);
    if (!Array.isArray(d.skillBar)) d.skillBar = [];
    while (d.skillBar.length < SKILL_SLOTS) d.skillBar.push(null);   // 技能栏 14 格（旧存档 12 格）
    d.v = SAVE_V; return d;
  },
  // v4 → v5：操作与技能体系按官方现版对齐（三职业一起：统一等级表、学习间隔 lvStep、每级固定 SP、前置、指令、取消规则、新技能 / 被动改主动）
  //   → 和官方大版本一样统一洗点：技能回到初始技能 1 级、按等级返还全部 SP、清空指令锁定；转职保留。
  //   技能栏保留玩家原来摆的位置（这些技能还在、而且不是被动的；没学之前图标是暗的，学回来就能用），补成 14 格，初始技能不在栏上就补上
  migrateV5(d) {
    const C = CLASSES[d.cls]; if (!C) return;
    const ok = new Set(classSkills(d.cls, d.job || null)), old = Array.isArray(d.skillBar) ? d.skillBar : [];
    d.skillLv = {}; for (const id of C.start) d.skillLv[id] = 1;
    d.skillBar = Array(SKILL_SLOTS).fill(null);
    old.forEach((id, i) => { if (i < SKILL_SLOTS && id && ok.has(id) && SKILLS[id] && !SKILLS[id].passive && !d.skillBar.includes(id)) d.skillBar[i] = id; });
    for (const id of C.start) if (!d.skillBar.includes(id)) { const k = d.skillBar.indexOf(null); if (k >= 0) d.skillBar[k] = id; }
    d.sp = 150; for (let l = 2; l <= (d.lvl || 1); l++) d.sp += 28 + l;   // 与 onLevelUp 的 SP 发放一致
    if (d.opts) d.opts.cmdLock = {};
    this.skillReset = true;
  },
  apply() {
    const d = this.data; this.live = true;
    game.lvl = d.lvl; game.exp = d.exp; game.sp = d.sp; game.gold = d.gold; game.skillLv = d.skillLv; game.skillBar = d.skillBar; game.job = d.job || null;
    inv.items = d.inv || []; inv.equip = d.equip || {}; inv.quick = d.quick || inv.quick; inv.storage = d.storage || [];
  },
  newGame(cls, name) {
    this.loadAll();   // 先读出已有角色，新角色追加在后面，不覆盖
    this.data = this.defaults(cls, name || CLASSES[cls].name);
    this.cur = -1;
    const C = CLASSES[cls];
    for (const id of C.start) this.data.skillLv[id] = 1;
    C.bar.forEach((id, i) => { if (i < SKILL_SLOTS) this.data.skillBar[i] = id; });
    this.apply();
    inv.starter(cls);
    this.write();
  },
  remove(i) { this.chars.splice(i, 1); if (i < this.cur) this.cur--; this.cur = Math.min(this.cur, this.chars.length - 1); this.data = null; this.persist(); },
  useFatigue(n) { this.data.fatigue = Math.max(0, this.data.fatigue - n); },
  onClear(id, diff, rank) {
    const d = this.data; d.clears++;
    const b = d.best[id + ':' + diff]; if (!b || RANKS.findIndex(r => r[0] === rank) > RANKS.findIndex(r => r[0] === b)) d.best[id + ':' + diff] = rank;
    // 难度解锁：通关普通 → 冒险；冒险 B 以上 → 勇士；勇士 S 以上 → 王者
    const ri = RANKS.findIndex(r => r[0] === rank), need = [0, 4, 6];
    const cur = d.unlocked[id] || 0;
    if (diff < 3 && diff >= cur && ri >= (need[diff] || 0)) { d.unlocked[id] = diff + 1; toastMsg(`解锁新难度：${DIFFS[diff + 1].name}`, DIFFS[diff + 1].col); }
    this.write();
  },
};
// 关页面 / 切到后台时保存（刷新也不会丢掉这一局的进度）
addEventListener('pagehide', () => { if (save.data) save.write(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && save.data) save.write(); });
