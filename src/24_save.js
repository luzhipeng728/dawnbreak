/* =====================================================================
   24. 存档（localStorage）：等级/经验/SP/技能/背包/装备/金币/疲劳/复活币/难度解锁/最佳评价
   疲劳与复活币每天 06:00 重置（与原作一致）
   ===================================================================== */
const FATIGUE_MAX = 156;
const dayKey = () => { const d = new Date(Date.now() - 6 * 3600 * 1000); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
const save = {
  key: ['test', 'dungeon', 'town', 'bot', 'cls'].some(k => PARAMS.has(k)) ? 'dawnbreak_dev' : 'dawnbreak_save_v1', data: null,   // 调试参数用独立存档，不碰玩家的正式存档
  defaults(cls = 'sword') {
    return { v: 2, cls, lvl: 1, exp: 0, sp: 150, gold: 1500, skillLv: {}, skillBar: Array(12).fill(null), inv: [], equip: {}, quick: [null, null, null, null, null, null],
      fatigue: FATIGUE_MAX, day: dayKey(), coins: 5, unlocked: {}, best: {}, weak: 0, clears: 0, created: Date.now(), playTime: 0, opts: { music: 0.6, sfx: 0.9 } };
  },
  load() {
    try { const s = localStorage.getItem(this.key); if (s) { const d = JSON.parse(s); this.data = { ...this.defaults(), ...d, opts: { ...this.defaults().opts, ...(d.opts || {}) } }; if (!CLASSES[this.data.cls]) this.data.cls = 'sword'; } } catch (e) { this.data = null; }
    if (PARAMS.has('fresh')) this.data = null;
    if (!this.data) return false;
    this.daily(); return true;
  },
  daily() { const d = dayKey(); if (this.data.day !== d) { this.data.day = d; this.data.fatigue = FATIGUE_MAX; this.data.coins = Math.max(this.data.coins, 0) + 1; toastMsg('新的一天：疲劳值已恢复，领取复活币 ×1', '#bfe8bf'); } },
  write() {
    if (!this.data) return;
    const d = this.data;
    d.lvl = game.lvl; d.exp = game.exp; d.sp = game.sp || 0; d.gold = game.gold; d.skillLv = game.skillLv; d.skillBar = game.skillBar;
    d.inv = inv.items; d.equip = inv.equip; d.quick = inv.quick;
    try { localStorage.setItem(this.key, JSON.stringify(d)); } catch (e) { /* 存储已满或无痕模式 */ }
  },
  // 老存档（v1）升级：补发平衡调整的福利
  migrate() {
    const d = this.data; if (!d || d.v >= 2) return;
    d.v = 2; d.sp = (d.sp || 0) + 150; d.gold = (d.gold || 0) + 1000;
    const C = CLASSES[d.cls]; for (const id of C.start) if (!d.skillLv[id]) { d.skillLv[id] = 1; if (!d.skillBar.includes(id)) { const k = d.skillBar.indexOf(null); if (k >= 0) d.skillBar[k] = id; } }
    const add = (key, n) => { const it = (d.inv || []).find(x => x.key === key); if (it) it.n += n; else (d.inv = d.inv || []).push(makeConsumable(key, n)); };
    add('hpS', 10); add('mpS', 10); add('hpM', 5);
    this.migrated = true;
  },
  apply() {
    this.migrate();
    const d = this.data;
    game.lvl = d.lvl; game.exp = d.exp; game.sp = d.sp; game.gold = d.gold; game.skillLv = d.skillLv; game.skillBar = d.skillBar;
    inv.items = d.inv || []; inv.equip = d.equip || {}; inv.quick = d.quick || inv.quick;
  },
  newGame(cls) {
    this.data = this.defaults(cls);
    const C = CLASSES[cls];
    for (const id of C.start) this.data.skillLv[id] = 1;
    C.bar.forEach((id, i) => { this.data.skillBar[i] = id; });
    this.apply();
    inv.starter(cls);
    this.write();
  },
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
