/* =====================================================================
   23. 物品系统（规则与通用函数；物品库内容在 content/items/*，窗口在 ui/items/*）
   - 物品库：defineItem(key, def) 注册，makeItem(key, n, opt) 生成实例，rollEquip({...}) 按条件随机装备
   - 背包 inv（分页签：装备 / 消耗品 / 材料 / 任务 / 称号）、装备栏（12 格）、角色仓库、账号金库 bank
   - 耐久（受伤 / 死亡掉耐久，0 时属性失效）、修理、强化（官方成功率与失败惩罚）、分解、出售与回购
   - 图标：itemIconSrc(it) 给 <img>，drawItemIcon(c, it, s) 画在画布上
   ===================================================================== */
// 时装（官方 8 个部位）：没有耐久，不能强化 / 分解；属性按官方（头部 / 帽子 施放速度、脸部 / 胸部 攻击速度、上衣 四维、下装 HP / MP、腰带 回避、鞋 移动速度）
const AV_SLOTS = ['av_hair', 'av_hat', 'av_face', 'av_chest', 'av_top', 'av_bottom', 'av_belt', 'av_shoes'];
const SLOTS = ['weapon', 'title', 'top', 'head', 'bottom', 'belt', 'shoes', 'neck', 'bracelet', 'ring', 'support', 'stone', ...AV_SLOTS];
const SLOT_NAME = { weapon: '武器', title: '称号', top: '上衣', head: '头肩', bottom: '下装', belt: '腰带', shoes: '鞋', neck: '项链', bracelet: '手镯', ring: '戒指', support: '辅助装备', stone: '魔法石',
  av_hair: '头部', av_hat: '帽子', av_face: '脸部', av_chest: '胸部', av_top: '上衣', av_bottom: '下装', av_belt: '腰带', av_shoes: '鞋' };
const ARMOR_SLOTS = ['top', 'head', 'bottom', 'belt', 'shoes'], ACC_SLOTS = ['neck', 'bracelet', 'ring'], SPECIAL_SLOTS = ['support', 'stone'];
const GRADES = ['最下级', '下级', '中级', '上级', '最上级'];
const RAR_MUL = [1, 1.25, 1.55, 1.85, 2.2, 2.8];
const gradeMul = g => g == null ? 1 : 0.9 + g * 0.05;
// 武器类型（官方 15 种，攻速 / 物攻 / 魔攻特点按官方资料站）：phys / mag 物攻 / 魔攻系数，aspd / cspd 攻速 / 施放速度加成，spd 为说明里的“攻击速度”，dur 耐久
const WTYPES = {
  shortsword: { name: '短剑', cls: 'sword', phys: 1.0, mag: 1.0, aspd: 0, spd: '普通', dur: 30, desc: '攻速普通，魔法攻击力是鬼剑士武器里最高的' },
  katana: { name: '太刀', cls: 'sword', phys: 0.98, mag: 0.8, aspd: 0.08, crit: 0.02, spd: '快速', dur: 30, desc: '出手快，魔法攻击力较高' },
  club: { name: '钝器', cls: 'sword', phys: 1.1, mag: 0.55, aspd: -0.08, stagger: 30, spd: '缓慢', dur: 34, desc: '物理攻击力较高，打击让敌人僵直更久' },
  greatsword: { name: '巨剑', cls: 'sword', phys: 1.2, mag: 0.45, aspd: -0.12, hardness: 20, spd: '最慢', dur: 36, desc: '物理攻击力最高，挥动最慢' },
  lightsaber: { name: '光剑', cls: 'sword', phys: 0.9, mag: 0.8, aspd: 0.14, elem: 'light', spd: '极快', dur: 23, desc: '攻速极快，物理攻击力最低，附带光属性攻击' },
  revolver: { name: '左轮枪', cls: 'gun', phys: 1.02, mag: 0.5, aspd: 0.06, crit: 0.02, spd: '快速', dur: 30, desc: '每轮连射 4 发，物理攻击力中上' },
  autopistol: { name: '自动手枪', cls: 'gun', phys: 0.85, mag: 1.0, aspd: 0.14, spd: '极快', dur: 28, desc: '每轮连射 6 发，魔法攻击力最高、物理攻击力最低' },
  rifle: { name: '步枪', cls: 'gun', phys: 1.1, mag: 0.55, aspd: -0.06, hit: 0.03, spd: '缓慢', dur: 34, desc: '每轮连射 3 发，攻击力仅次于手炮，射程最远' },
  handcannon: { name: '手炮', cls: 'gun', phys: 1.22, mag: 0.45, aspd: -0.14, stagger: 35, spd: '极慢', dur: 36, desc: '每轮连射 2 发，攻击力最高' },
  bowgun: { name: '手弩', cls: 'gun', phys: 0.96, mag: 0.6, aspd: 0, spd: '普通', dur: 39, desc: '每轮连射 7 发' },
  spear: { name: '矛', cls: 'mage', phys: 1.1, mag: 0.9, aspd: -0.08, stagger: 20, spd: '缓慢', dur: 34, desc: '物理攻击力最高，攻击范围最大' },
  pole: { name: '棍棒', cls: 'mage', phys: 0.95, mag: 0.98, aspd: 0.06, spd: '快速', dur: 30, desc: '物理与魔法攻击力均衡' },
  rod: { name: '魔杖', cls: 'mage', phys: 0.55, mag: 1.05, aspd: 0.12, cspd: 0.05, spd: '极快', dur: 26, desc: '攻速极快，魔法攻击力次于法杖，施放速度 +5%' },
  staff: { name: '法杖', cls: 'mage', phys: 0.5, mag: 1.15, aspd: -0.12, mcrit: 0.02, spd: '极慢', dur: 30, desc: '魔法攻击力最高，攻速极慢' },
  broom: { name: '扫把', cls: 'mage', phys: 0.8, mag: 1.0, aspd: 0.06, mspd: 0.03, spd: '快速', dur: 28, desc: '移动速度 +3%' },
};
const CLASS_WTYPES = cls => Object.keys(WTYPES).filter(k => WTYPES[k].cls === cls);
const CLASS_START_WEAPON = { sword: 'katana', gun: 'revolver', mage: 'rod' };   // 初始武器选攻速不慢的类型
// 防具类型：def / mdef / hp / mp 系数，dur 上衣耐久（官方：布 28、皮 33、轻 38、重 40、板 60；其他部位 ×0.85）
const ATYPES = {
  cloth: { name: '布甲', def: 0.94, mdef: 1.3, hp: 0.95, mp: 1.4, dur: 28 },
  leather: { name: '皮甲', def: 0.99, mdef: 1.05, hp: 1.0, mp: 1.1, dur: 33 },
  light: { name: '轻甲', def: 1.02, mdef: 0.98, hp: 1.0, mp: 1.0, dur: 38 },
  heavy: { name: '重甲', def: 1.1, mdef: 0.88, hp: 1.1, mp: 0.9, dur: 40 },
  plate: { name: '板甲', def: 1.25, mdef: 0.8, hp: 1.15, mp: 0.85, dur: 60 },
};
const ARMOR_W = { top: 1.2, bottom: 1.1, head: 1.0, shoes: 0.85, belt: 0.85 };
// 属性名（tooltip / 面板）；pct 表示百分比显示
const STAT_INFO = {
  atk: ['物理攻击力'], matk: ['魔法攻击力'], indep: ['独立攻击力'], def: ['物理防御力'], mdef: ['魔法防御力'],
  str: ['力量'], int: ['智力'], vit: ['体力'], spr: ['精神'], hp: ['HP 上限'], mp: ['MP 上限'],
  crit: ['物理暴击率', 1], mcrit: ['魔法暴击率', 1], critDmg: ['暴击伤害', 1], aspd: ['攻击速度', 1], cspd: ['施放速度', 1], mspd: ['移动速度', 1],
  hit: ['命中率', 1], evade: ['回避率', 1], hardness: ['硬直'], stagger: ['僵直度'],
  fire: ['火属性强化'], ice: ['冰属性强化'], light: ['光属性强化'], dark: ['暗属性强化'], elemAll: ['所有属性强化'],
  rfire: ['火属性抗性'], rice: ['冰属性抗性'], rlight: ['光属性抗性'], rdark: ['暗属性抗性'], resAll: ['所有属性抗性'],
  allStat: ['四维'], hpPct: ['HP 上限', 1], mpPct: ['MP 上限', 1], atkPct: ['攻击力', 1], defPct: ['防御力', 1],
  cdr: ['技能冷却时间', 1, -1], dmgUp: ['伤害增加', 1], dmgReduce: ['受到的伤害', 1, -1], mpRegen: ['MP 恢复速度', 1],
  killHeal: ['击杀敌人时恢复 HP', 1], killMp: ['击杀敌人时恢复 MP', 1], goldUp: ['金币获得量', 1], expUp: ['经验获得量', 1],
};
const FLAT_STATS = ['atk', 'matk', 'indep', 'def', 'mdef', 'str', 'int', 'vit', 'spr', 'hp', 'mp'];
function fmtStatVal(k, v) {
  const I = STAT_INFO[k] || [k], neg = I[2] === -1;
  const pv = Math.round(Math.abs(v) * 1000) / 10, s = I[1] ? `${pv.toFixed(pv % 1 ? 1 : 0)}%` : fmtNum(Math.abs(v));   // 先取整到 0.1%，避免 7.000001 显示成 7.0%
  return `${(neg ? v < 0 : v >= 0) ? '+' : '-'}${s}`;
}
const statLine = (k, v) => `${(STAT_INFO[k] || [k])[0]} ${fmtStatVal(k, v)}`;

/* ---------------- 物品库 ---------------- */
const ITEMS = {};
const CONSUMABLES = {};   // 旧接口：非装备物品的定义（key → def）
const GEAR = [];          // 可以随机掉落的装备定义
const EPICS = [];         // 史诗（旧接口：{ slot, cls, lvl, key, name }）
const isAvatar = it => !!it && typeof it.slot === 'string' && it.slot.startsWith('av_');
const TAB_OF = it => it.kind === 'equip' ? (it.slot === 'title' ? 'title' : isAvatar(it) ? 'avatar' : 'equip') : it.kind === 'use' ? 'use' : it.kind === 'quest' ? 'quest' : 'mat';
function defineItem(key, def) {
  const D = { key, kind: 'mat', rar: 0, price: 10, ...def };
  const prev = ITEMS[key];   // 重新定义（装备 2.0 的 moveEpic 等）：去掉旧的随机池 / 史诗表条目，不留重复
  if (prev && prev.kind === 'equip') { const gi = GEAR.indexOf(prev); if (gi >= 0) GEAR.splice(gi, 1); const ei = EPICS.findIndex(E => E.key === key); if (ei >= 0) EPICS.splice(ei, 1); }
  if (D.kind === 'equip') {
    D.lvl = D.lvl || 1;
    if (D.slot === 'weapon' && D.wtype) D.cls = D.cls || WTYPES[D.wtype].cls;
    if (D.durMax === undefined) D.durMax = D.slot === 'title' || D.slot.startsWith('av_') ? 0 : D.slot === 'weapon' ? (WTYPES[D.wtype] || {}).dur || 30 : D.atype ? Math.round(ATYPES[D.atype].dur * (D.slot === 'top' ? 1 : 0.85)) : 24;
    if (!def.price) D.price = Math.round((40 + D.lvl * 25) * Math.pow(2.2, D.rar) * (D.slot === 'weapon' ? 1.2 : 1) * 1.6);   // 经济模拟（test/econ.mjs）校准过
    if (!D.noDrop && !D.quest) GEAR.push(D);
    if (D.rar === 5) EPICS.push({ slot: D.slot, cls: D.cls || null, lvl: D.lvl, key, name: D.name, fx: D.fx, desc: D.desc });
  } else CONSUMABLES[key] = D;
  ITEMS[key] = D;
  return D;
}
// 种子随机（同一个 key 生成的装备属性固定）
const keySeed = key => { let h = 2166136261; for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619); return h >>> 0; };
// 高品级的特殊词条（神器 1 条、传说 2 条；史诗的特效在物品库里手写）
const AFFIXES = [
  { k: 'cdr', v: [0.03, 0.07] }, { k: 'critDmg', v: [0.08, 0.16] }, { k: 'dmgUp', v: [0.03, 0.07] }, { k: 'aspd', v: [0.03, 0.06], also: 'cspd' },
  { k: 'mspd', v: [0.04, 0.08] }, { k: 'elemAll', v: [8, 18], int: 1 }, { k: 'killHeal', v: [0.01, 0.025] }, { k: 'dmgReduce', v: [0.03, 0.06] },
  { k: 'hpPct', v: [0.04, 0.08] }, { k: 'crit', v: [0.02, 0.04], also: 'mcrit' }, { k: 'goldUp', v: [0.05, 0.12] }, { k: 'killMp', v: [0.01, 0.025] },
  { k: 'hardness', v: [20, 40], int: 1 }, { k: 'stagger', v: [20, 40], int: 1 },
];
// 按部位 / 类型 / 等级 / 品级生成装备的基础属性（物品库里 defineGear 调用）
function gearStats(D, R) {
  const L = D.lvl, m = RAR_MUL[D.rar], st = {};
  const add = (k, v) => { st[k] = +((st[k] || 0) + v).toFixed(k in STAT_INFO && STAT_INFO[k][1] ? 3 : 0); };
  if (D.slot === 'weapon') {
    const T = WTYPES[D.wtype], base = (60 + 26 * L) * m;
    add('atk', Math.round(base * T.phys)); add('matk', Math.round(base * T.mag)); add('indep', Math.round(base * Math.max(T.phys, T.mag) * 0.9));
  } else if (ARMOR_SLOTS.includes(D.slot)) {
    const A = ATYPES[D.atype], w = ARMOR_W[D.slot], base = (14 + 7 * L) * m * w;
    add('def', Math.round(base * A.def)); add('mdef', Math.round(base * A.mdef * 0.9));
    add('hp', Math.round((20 + 12 * L) * m * (D.slot === 'top' ? 1.4 : 1) * A.hp));
    if (D.atype === 'cloth') add('mp', Math.round((10 + 6 * L) * m));
  } else if (D.slot === 'neck') { add('str', Math.round((2 + L * 0.9) * m)); add('int', Math.round((2 + L * 0.9) * m)); add('mp', Math.round((15 + 8 * L) * m)); add('mdef', Math.round((6 + 3 * L) * m)); }
  else if (D.slot === 'bracelet') { add('str', Math.round((2 + L * 0.8) * m)); add('int', Math.round((2 + L * 0.8) * m)); add('atk', Math.round((8 + 5 * L) * m)); add('matk', Math.round((8 + 5 * L) * m)); add('mdef', Math.round((5 + 2.5 * L) * m)); }
  else if (D.slot === 'ring') { const cL = Math.min(L, 30) + Math.max(0, L - 30) * 0.5;   // 暴击率：Lv30 以后成长减半（满级 60 时一枚戒指不超过 ~18%）
    add('str', Math.round((2 + L * 0.8) * m)); add('int', Math.round((2 + L * 0.8) * m)); add('crit', 0.01 + 0.002 * cL * m); add('mcrit', 0.01 + 0.002 * cL * m); add('mdef', Math.round((5 + 2.5 * L) * m)); }
  else if (D.slot === 'support') { for (const k of ['str', 'int', 'vit', 'spr']) add(k, Math.round((1 + L * 0.45) * m)); add('hp', Math.round((10 + 6 * L) * m)); }
  else if (D.slot === 'stone') { add('str', Math.round((1 + L * 0.5) * m)); add('int', Math.round((1 + L * 0.5) * m)); add('elemAll', Math.round((2 + L * 0.35) * m)); add('mp', Math.round((8 + 5 * L) * m)); }
  // 稀有以上附加 1~2 条随机属性（按 key 固定）
  if (D.rar >= 1 && D.slot !== 'title') {
    const pool = ['str', 'int', 'vit', 'spr', 'hp', 'mp', 'crit', 'hit', 'evade'], n = D.rar >= 3 ? 2 : 1;
    for (let i = 0; i < n; i++) {
      const k = pool[Math.floor(R() * pool.length)];
      if (k === 'hp') add(k, Math.round(L * 8 * m)); else if (k === 'mp') add(k, Math.round(L * 5 * m));
      else if (k === 'crit') { add('crit', 0.01 * D.rar); add('mcrit', 0.01 * D.rar); } else if (k === 'hit' || k === 'evade') add(k, 0.01 + 0.005 * D.rar);
      else add(k, Math.round((2 + L * 0.5) * m));
    }
  }
  return st;
}
function gearAffixes(D, R) {
  const n = D.rar === 3 ? 1 : D.rar === 4 ? 2 : 0, fx = {};
  const pool = AFFIXES.slice();
  for (let i = 0; i < n && pool.length; i++) {
    const A = pool.splice(Math.floor(R() * pool.length), 1)[0];
    const t = clamp(D.lvl / 30, 0, 1) * 0.6 + R() * 0.4, v = A.v[0] + (A.v[1] - A.v[0]) * t;
    fx[A.k] = A.int ? Math.round(v) : +v.toFixed(3); if (A.also) fx[A.also] = fx[A.k];
  }
  return fx;
}
// 装备注册的便捷写法：物品库只需要写名字 / 类型 / 等级 / 品级，属性自动生成（也可以用 st / fx 覆盖或追加）
// def.seed：随机基础属性按这个 key 的种子生成（装备 2.0 的继承装备用原物品的种子，数值完全一样）；D._def 保留原始定义（gear60_api.js 按新等级重新定义时用）
function defineGear(key, def) {
  const R = mulberry(keySeed(def.seed || key));
  const D = { kind: 'equip', ...def };
  const st = def.st && def.stOnly ? {} : gearStats(D, R);
  if (def.st) for (const k in def.st) st[k] = +((st[k] || 0) + def.st[k]).toFixed(3);
  const fx = def.fx ? { ...def.fx } : gearAffixes(D, R);
  return defineItem(key, { ...def, kind: 'equip', st, fx: Object.keys(fx).length ? fx : undefined, _def: def });
}
/* ---- 套装 ---- */
const SETS = {};
function defineSet(id, def) { SETS[id] = { id, pieces: [], bonus: {}, ...def }; return SETS[id]; }

/* ---------------- 物品实例 ---------------- */
let itemSeq = (Date.now() % 1e8) * 10;
const randGrade = () => { const r = Math.random(); return r < 0.12 ? 0 : r < 0.37 ? 1 : r < 0.72 ? 2 : r < 0.93 ? 3 : 4; };
function makeItem(key, n = 1, opt = {}) {
  const D = ITEMS[key];
  if (!D) { console.warn('makeItem：物品库里没有', key); return null; }
  if (D.kind !== 'equip') return { id: itemSeq++, key, kind: D.kind, name: D.name, rar: D.rar, n: Math.max(1, n | 0), price: D.price };
  const grade = D.slot === 'title' || isAvatar(D) ? null : D.rar === 5 ? 4 : opt.grade ?? D.grade ?? randGrade();   // 史诗固定最上级
  const it = { id: itemSeq++, key, kind: 'equip', slot: D.slot, name: D.name, rar: D.rar, lvl: D.lvl, grade, st: {}, enh: opt.enh || 0, durMax: D.durMax, dur: D.durMax, price: D.price };
  applyDef(it, D);
  return it;
}
// 用物品库定义刷新实例的固定部分（改平衡后旧存档里的装备自动跟着变）
function applyDef(it, D) {
  it.name = D.name; it.slot = D.slot; it.lvl = D.lvl; it.price = D.price; it.rar = D.rar;
  it.wtype = D.wtype || null; it.atype = D.atype || null; it.cls = D.cls || null; it.set = D.set || null;
  it.fx = D.fx ? { ...D.fx } : undefined; it.desc = D.desc || undefined; it.epic = D.rar === 5 || undefined; if (it.epic) it.grade = 4;
  const g = gradeMul(it.grade); it.st = {};
  for (const k in D.st) it.st[k] = FLAT_STATS.includes(k) ? Math.round(D.st[k] * g) : D.st[k];
  if (it.durMax !== D.durMax) { it.durMax = D.durMax; it.dur = Math.min(it.dur ?? D.durMax, D.durMax); }
  if (it.dur === undefined) it.dur = it.durMax;
}
// 旧存档里的物品：补全 key / 类型 / 新属性
function normalizeItem(it) {
  if (!it || typeof it !== 'object') return it;
  if (it.kind === 'equip') {
    const D = ITEMS[it.key];
    if (D && D.kind === 'equip') { applyDef(it, D); return it; }
    if (!it.legacy && !it.key) {   // 旧版随机装备（没有 key）：保留名字和数值，换算成新属性
      it.legacy = true; it.key = it.key || 'legacy_' + it.slot; const st = it.st || {};
      if (it.slot === 'weapon') { const cls = it.cls || 'sword'; it.wtype = CLASS_START_WEAPON[cls] || 'katana'; const T = WTYPES[it.wtype]; const a = st.atk || 100; st.atk = Math.round(a * T.phys); st.matk = Math.round(a * T.mag); st.indep = Math.round(a * Math.max(T.phys, T.mag) * 0.9); }
      else if (ARMOR_SLOTS.includes(it.slot)) { it.atype = it.atype || 'light'; st.mdef = Math.round((st.def || 0) * 0.86); }
      else if (ACC_SLOTS.includes(it.slot)) { if (st.str) st.int = st.str; st.mdef = Math.round(6 + it.lvl * 3); if (st.crit) st.mcrit = st.crit; }
      if (it.fx) { const f = it.fx; if (f.spd) { f.mspd = f.spd; f.aspd = f.spd; f.cspd = f.spd; delete f.spd; } if (f.crit) f.mcrit = f.crit; }
      it.st = st; it.durMax = it.durMax || 30; it.dur = Math.min(it.dur ?? 30, it.durMax);
    }
    return it;
  }
  if (!it.key) return it;
  const D = ITEMS[it.key]; if (D) { it.name = D.name; it.rar = D.rar; it.price = D.price; it.kind = D.kind; }
  it.n = Math.max(1, it.n | 0 || 1);
  return it;
}
// 按条件随机一件装备：{ slot?, lvl, rar?, cls?, wtype?, atype?, bonus?, boss?, grade? }
const SLOT_WEIGHT = { weapon: 16, top: 9, head: 9, bottom: 9, belt: 8, shoes: 8, neck: 8, bracelet: 8, ring: 8, support: 4, stone: 4 };
function pickSlot() { let r = Math.random() * 91; for (const s in SLOT_WEIGHT) { r -= SLOT_WEIGHT[s]; if (r <= 0) return s; } return 'top'; }
function rollEquip(o = {}) {
  const lvl = clamp(Math.round(o.lvl || game.lvl || 1), 1, 60);
  let rar = o.rar ?? rollRarity(o.bonus || 0, o.boss);
  const cls = o.cls || (game.player ? game.player.cls : 'sword');
  const slot = o.slot && (SLOT_WEIGHT[o.slot] || o.strict) ? o.slot : pickSlot();   // 称号 / 时装这类不掉落的部位：换一个能掉的（strict 时保持）
  const mastery = typeof masteryOf === 'function' ? masteryOf(cls, game.job) : 'heavy';
  for (let tries = 0; tries < 8; tries++) {
    const lo = lvl - 6 - tries * 4, hi = lvl + 1 + Math.floor(tries / 2);
    let pool = GEAR.filter(D => D.slot === slot && D.rar === rar && D.lvl >= lo && D.lvl <= hi && !D.shopOnly && (!o.wtype || D.wtype === o.wtype) && (!o.atype || D.atype === o.atype));
    if (slot === 'weapon' && !o.wtype) { const own = pool.filter(D => D.cls === cls); if (own.length && Math.random() < 0.8) pool = own; }
    if (ARMOR_SLOTS.includes(slot) && !o.atype) { const m = pool.filter(D => D.atype === mastery); if (m.length && Math.random() < 0.6) pool = m; }
    if (pool.length) {
      // 等级越接近越容易出（不出比目标高很多的）
      const w = pool.map(D => (D.set ? 0.3 : 1) / (1 + Math.abs(lvl - D.lvl) * 0.35)); let r = Math.random() * w.reduce((a, b) => a + b, 0);
      for (let i = 0; i < pool.length; i++) { r -= w[i]; if (r <= 0) return makeItem(pool[i].key, 1, { grade: o.grade }); }
      return makeItem(pool[0].key, 1, { grade: o.grade });
    }
    if (tries >= 3 && rar > 0) rar--;   // 这个等级段没有这个品级：降一级再找
  }
  // 这个部位在这个等级段根本没有（例如 Lv10 以下的辅助装备 / 魔法石）：换成防具 / 武器再找
  if (!o.strict && !o._retry && (slot === 'support' || slot === 'stone')) return rollEquip({ ...o, slot: pick(['weapon', ...ARMOR_SLOTS, ...ACC_SLOTS]), _retry: true });
  return null;
}
// 旧接口
function makeEquip(slot, lvl, rar, cls, epic = null) {
  if (epic && epic.key) return makeItem(epic.key);
  return rollEquip({ slot, lvl, rar, cls }) || rollEquip({ lvl, rar: 0, cls }) || makeItem(`${CLASS_START_WEAPON[cls || (game.player ? game.player.cls : 'sword')] || 'katana'}_1_0`);   // 保证不返回 null（旧的翻牌代码直接读返回值）
}
function makeConsumable(key, n = 1) { return makeItem(key, n); }

/* ---------------- 背包 / 装备栏 / 仓库 ---------------- */
const INV_TABS = [['equip', '装备'], ['use', '消耗品'], ['mat', '材料'], ['quest', '任务'], ['title', '称号'], ['avatar', '时装']];
const INV_NOCAP = { equip: true, use: true, mat: true, title: true, avatar: true };   // 背包各页签暂时不限格子（任务道具本来就不限）；仓库仍按格子算
const inv = {
  items: [], equip: {}, quick: ['hpS', 'mpS', null, null, null, null], storage: [], cap: 48, potCd: 0, _norm: null,
  // 读档后第一次用到时补全旧物品（save.apply 直接替换了数组，这里按数组身份判断）
  ensure() {
    if (this._norm === this.items && this._normSt === this.storage && this._normEq === this.equip) return;
    this.items = (this.items || []).filter(Boolean).map(normalizeItem);
    this.storage = (this.storage || []).filter(Boolean).map(normalizeItem);
    for (const s in this.equip) { const it = this.equip[s]; if (!it) { delete this.equip[s]; continue; } normalizeItem(it); if (it.slot !== s) { delete this.equip[s]; this.items.push(it); } }   // 部位不对：放回背包（不受格子上限限制，避免丢失）
    // 旧存档：equip 里的键名一致，无需迁移；背包 / 仓库里的复活币物品换成计数
    for (const L of [this.items, this.storage]) for (let i = L.length - 1; i >= 0; i--) if (L[i].key === 'coin' && save.data) { save.data.coins += L[i].n || 1; L.splice(i, 1); }
    this._norm = this.items; this._normSt = this.storage; this._normEq = this.equip;
    if (save.data) save.data.storage = this.storage;
  },
  tabCount(tab, list = this.items) { let n = 0; for (const x of list) if (TAB_OF(x) === tab) n++; return n; },
  free(tab, list = this.items, cap = this.cap) { return INV_NOCAP[tab] && list === this.items ? Infinity : cap - this.tabCount(tab, list); },
  add(it, list = this.items, cap = this.cap) {
    if (!it) return false;
    normalizeItem(it);
    if (it.key === 'coin' && list === this.items) { if (save.data) save.data.coins += it.n || 1; return true; }
    if (it.kind !== 'equip') { const ex = list.find(x => x.key === it.key && x.kind !== 'equip'); if (ex) { ex.n += it.n || 1; return true; } }
    if (it.kind !== 'quest' && this.free(TAB_OF(it), list, cap) <= 0) return false;   // 任务道具不占格子上限（不能丢，也不能因为满了消失）
    list.push(it);
    if (it.kind === 'equip' && list === this.items && typeof codexRecord === 'function') codexRecord(it);   // 装备图鉴：第一次获得时登记
    return true;
  },
  count(key, list = this.items) { let n = 0; for (const x of list) if (x.key === key) n += x.kind === 'equip' ? 1 : x.n || 1; return n; },
  has(key, n = 1) { return this.count(key) >= n; },
  take(key, n = 1, list = this.items) {
    if (this.count(key, list) < n) return false;
    for (let i = list.length - 1; i >= 0 && n > 0; i--) { const x = list[i]; if (x.key !== key) continue; if (x.kind === 'equip') { list.splice(i, 1); n--; } else { const t = Math.min(n, x.n); x.n -= t; n -= t; if (x.n <= 0) list.splice(i, 1); } }
    return true;
  },
  remove(it, list = this.items) { const i = list.indexOf(it); if (i >= 0) list.splice(i, 1); return i >= 0; },
  starter(cls) {
    this.items = []; this.equip = {}; this.storage = []; this.quick = ['hpS', 'mpS', null, null, null, null];
    const w = CLASS_START_WEAPON[cls] || 'katana', m = masteryOf(cls, null);
    this.equip.weapon = makeItem(`${w}_1_0`, 1, { grade: 2 }) || rollEquip({ slot: 'weapon', lvl: 1, rar: 0, cls });
    this.equip.top = makeItem(`${m}_top_1_0`, 1, { grade: 2 }) || rollEquip({ slot: 'top', lvl: 1, rar: 0 });
    this.equip.bottom = makeItem(`${m}_bottom_1_0`, 1, { grade: 2 }) || rollEquip({ slot: 'bottom', lvl: 1, rar: 0 });
    for (const [k, n] of [['hpS', 15], ['mpS', 15], ['hpM', 5], ['crystal', 30]]) this.add(makeItem(k, n));
    this._norm = this.items; this._normSt = this.storage; this._normEq = this.equip;
  },
  canWear(it, quiet) {
    const fail = msg => { if (!quiet) { toastMsg(msg, '#ff6a6a'); sfx.error(); } return false; };
    if (!it || it.kind !== 'equip') return fail('不能装备');
    if (it.lvl > game.lvl) return fail(`需要等级 ${it.lvl}`);
    if (it.slot === 'weapon' && it.cls && game.player && it.cls !== game.player.cls) return fail(`${CLASSES[it.cls] ? CLASSES[it.cls].name : ''}专用武器，无法装备`);
    return true;
  },
  wear(it) {
    this.ensure();
    if (!this.canWear(it)) return false;
    const i = this.items.indexOf(it), old = this.equip[it.slot];
    if (i < 0) return false;   // 只能穿背包里的物品（避免同一件物品两处引用造成复制）
    if (old) this.items[i] = old; else this.items.splice(i, 1);
    this.equip[it.slot] = it;
    recalcStats(game.player); sfx.pickup(); bus.emit('equip', { item: it, slot: it.slot });
    return true;
  },
  unwear(slot) {
    this.ensure();
    const it = this.equip[slot]; if (!it) return false;
    if (this.free(TAB_OF(it)) <= 0) { toastMsg('背包已满', '#ff6a6a'); sfx.error(); return false; }
    delete this.equip[slot]; this.items.push(it); recalcStats(game.player); sfx.click(); bus.emit('unequip', { item: it, slot });
    return true;
  },
  // 整理：按页签内的 种类 → 部位 → 品级（高在前）→ 等级 排序，同 key 的消耗品合并
  sort() {
    const merged = [];
    for (const x of this.items) { if (x.kind !== 'equip') { const ex = merged.find(y => y.key === x.key && y.kind !== 'equip'); if (ex) { ex.n += x.n; continue; } } merged.push(x); }
    const so = s => SLOTS.indexOf(s), keyOrder = Object.keys(ITEMS);
    merged.sort((a, b) => (TAB_OF(a) > TAB_OF(b) ? 1 : TAB_OF(a) < TAB_OF(b) ? -1 : 0) || (a.kind === 'equip' ? so(a.slot) - so(b.slot) || b.rar - a.rar || b.lvl - a.lvl || (b.enh || 0) - (a.enh || 0) : b.rar - a.rar || keyOrder.indexOf(a.key) - keyOrder.indexOf(b.key)));
    this.items.length = 0; this.items.push(...merged); this._norm = this.items;
  },
  // 使用消耗品（快捷栏 1~6 调用的是 use(key)，背包右键调用 useItem(it)）
  use(key) {
    const it = this.items.find(x => x.key === key); if (!it) { toastMsg('没有这个物品了'); return false; }
    return this.useItem(it);
  },
  useItem(it) {
    const p = game.player; if (!p || p.dead) return false;
    const D = ITEMS[it.key]; if (!D || D.kind !== 'use' || !D.use) { toastMsg('这个物品不能直接使用'); return false; }
    const U = D.use;
    if (U.dungeonOnly && game.scene !== 'dungeon' && game.scene !== 'test') { toastMsg('只能在地下城里使用', '#ffb0a0'); sfx.error(); return false; }
    if ((U.hp || U.mp) && this.potCd > 0) return false;
    if (U.fatigue && save.data.fatigue >= (U.fatigueBelow || FATIGUE_MAX)) { toastMsg(U.fatigueBelow ? `疲劳值低于 ${U.fatigueBelow} 时才能使用` : '疲劳值已满', '#ffb0a0'); sfx.error(); return false; }
    const daily = U.perDay && (save.data.itemDaily || (save.data.itemDaily = {}));
    if (daily) { const d = typeof dayKey === 'function' ? dayKey() : ''; if (daily.day !== d) { daily.day = d; daily.n = {}; } if ((daily.n[it.key] || 0) >= U.perDay) { toastMsg(`今天已经用了 ${U.perDay} 次，明天再来吧`, '#ffb0a0'); sfx.error(); return false; } }
    if (U.open && !this.canOpen(U)) return false;
    if (!this.take(it.key, 1)) return false;
    if (daily) daily.n[it.key] = (daily.n[it.key] || 0) + 1;
    if (U.hp) { const hh = Math.round(p.hpMax * U.hp); p.hp = Math.min(p.hpMax, p.hp + hh); if (game.scene !== 'town') addNumber(hh, p.x, p.y, p.z, { heal: true }); }
    if (U.mp) { const mm = Math.round(p.mpMax * U.mp); p.mp = Math.min(p.mpMax, p.mp + mm); if (game.scene !== 'town') addNumber(mm, p.x, p.y, p.z + 12, { col: '#6ab8ff' }); }
    if (U.hp || U.mp) this.potCd = U.cd ?? 1;
    if (U.fatigue) { const f = Math.min(FATIGUE_MAX - save.data.fatigue, U.fatigue); save.data.fatigue += f; toastMsg(`疲劳值恢复了 ${f} 点`, '#8aff9a'); }
    if (U.buff) { p.buffs = p.buffs || {}; p.buffs['item_' + it.key] = { ...U.buff, t: U.buff.t }; toastMsg(`${D.name}：${D.desc || '效果发动'}`, '#ffe8a8'); }
    if (U.open) this.openBox(D);
    sfx.pickup(); bus.emit('itemUse', { item: D, key: it.key });
    if ((U.hp || U.mp) && game.scene !== 'town') addFx({ x: p.x, y: p.y + 1, z: 0, dur: 0.5, add: true, col: U.hp ? '#e83a3a' : '#3a78ff', draw(c) { const k = this.t / this.dur, P = game.player; if (!P) return; c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = shade(this.col, 0.3, 0.5 * (1 - k)); for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + k * 3; c.beginPath(); c.arc(sx(P.x) + Math.cos(a) * 16, sy(P.y, 20 + k * 70), 2.5, 0, TAU); c.fill(); } c.restore(); } });
    if (typeof save !== 'undefined' && game.scene === 'town') save.write();
    return true;
  },
  canOpen(U) { const need = U.slots || 2; if (this.free('equip') < 1 || this.free('use') < 1 || this.free('mat') < 1) { toastMsg(`背包空间不足（至少各留 ${Math.min(need, 1)} 格）`, '#ff6a6a'); sfx.error(); return false; } return true; },
  // 罐子 / 礼盒：按表随机开出物品
  openBox(D) {
    const got = [], U = D.use, lv = game.lvl;
    codexSrcNext = `打开${D.name}`;
    const rolls = U.open(lv) || [];
    for (const r of rolls) {
      let it = null;
      if (r.gold) { game.gold += r.gold; got.push(`${fmtNum(r.gold)} G`); bus.emit('gold', { n: r.gold }); continue; }
      if (r.equip) it = rollEquip({ lvl: r.lvl || lv, rar: r.rar, slot: r.slot }) || makeItem('crystal', 10 + lv); else if (r.key) it = makeItem(r.key, r.n || 1);
      if (it) { giveItem(it); got.push(`<span class="q${it.rar || 0}">${it.name}${it.n > 1 ? ' ×' + it.n : ''}</span>`); if (it.rar >= 5) sfx.epic(); }
    }
    codexSrcNext = null;
    toastMsg(`打开了${D.name}：${got.map(s => s.replace(/<[^>]+>/g, '')).join('、') || '什么都没有……'}`, '#ffe8a8');
    this.lastOpened = got;
  },
};
// 放进背包；背包满了就按出售价自动换成金币（避免奖励凭空消失）
function giveItem(it) {
  if (!it) return false;
  const dg = game.dungeon;
  if ((it.rar || 0) >= 5 && it.kind === 'equip' && game.scene === 'dungeon' && dg && dg.state === 'result') bus.emit('announce', { kind: 'epic', item: it, dungeon: dg.def.id, abyss: !!dg.def.abyss, via: 'card' });   // 翻牌翻到史诗
  if (inv.add(it)) return true;
  const g = Math.max(1, sellPrice(it));
  game.gold += g; toastMsg(`背包已满，${it.name} 已自动出售（+${fmtNum(g)} G）`, '#ffd070'); return false;
}
/* ---- 账号金库（多个角色共享，独立的 localStorage key） ---- */
const bank = {
  items: [], gold: 0, cap: 48, loadedKey: null,
  key() { return save.key === 'dawnbreak_dev' ? 'dawnbreak_bank_dev' : 'dawnbreak_bank'; },
  load() {
    const k = this.key(); if (this.loadedKey === k) return this;
    this.items = []; this.gold = 0;
    let mig = 0; this.g60m = {};
    try { const d = JSON.parse(localStorage.getItem(k) || 'null'); if (d) { this.items = (d.items || []).filter(Boolean); this.gold = Math.max(0, d.gold | 0); this.g60m = d.g60m || {}; if (typeof g60MigrateBank === 'function') mig = g60MigrateBank(this); this.items = this.items.map(normalizeItem); } } catch (e) { /* 损坏就当空的 */ }
    this.loadedKey = k; if (mig) this.write();   // 装备 2.0 的补发：立刻写回（g60m 记下处理过的，不会重复补发）
    return this;
  },
  write() { try { localStorage.setItem(this.key(), JSON.stringify({ v: 1, items: this.items, gold: this.gold, g60m: this.g60m || {} })); } catch (e) { /* 存储已满 */ } },
};
/* ---- 出售 / 回购 ---- */
const sellPrice = it => { const D = ITEMS[it.key]; if (it.kind === 'quest' || (D && D.noSell)) return 0; return Math.max(1, Math.floor((it.price || 10) * (D && D.sellMul || (it.kind === 'equip' ? 0.125 : 0.2)))) * (it.kind === 'equip' ? 1 : it.n || 1); };
const canSell = it => it.kind !== 'quest' && !(ITEMS[it.key] && ITEMS[it.key].noSell);
function sellItems(list) {
  let g = 0; const sold = [];
  for (const it of list) {
    if (!canSell(it) || !inv.remove(it)) continue;
    const p = sellPrice(it); g += p; sold.push(it);
    const bb = save.data.buyback || (save.data.buyback = []); bb.unshift({ item: it, price: p }); if (bb.length > 12) bb.length = 12;
    for (let i = 0; i < 6; i++) if (inv.quick[i] === it.key && !inv.count(it.key)) inv.quick[i] = null;
  }
  if (!sold.length) return 0;
  game.gold += g; sfx.coin(); bus.emit('sell', { items: sold, gold: g }); save.write();
  return g;
}
function buyBack(i) {
  const bb = save.data.buyback || [], e = bb[i]; if (!e) return false;
  if (game.gold < e.price) { toastMsg('金币不足', '#ff6a6a'); sfx.error(); return false; }
  if (!inv.add(e.item)) { toastMsg('背包已满', '#ff6a6a'); sfx.error(); return false; }
  game.gold -= e.price; bb.splice(i, 1); sfx.coin(); save.write(); return true;
}
/* ---- 耐久：地下城里受伤 / 倒下会掉耐久，0 时这件装备的属性失效（林纳斯 / 卡坤处修理） ---- */
const itemActive = it => !it.durMax || it.dur > 0;
const durItems = () => SLOTS.filter(s => inv.equip[s] && inv.equip[s].slot === s).map(s => inv.equip[s]).filter(it => it.durMax);
function wearDurability(n, all) {
  const list = durItems(); if (!list.length) return;
  let broke = false;
  const hit = it => { if (it.dur <= 0) return; const before = it.dur; it.dur = Math.max(0, it.dur - n); if (it.dur === 0) { broke = true; toastMsg(`${it.name} 的耐久度为 0，属性失效了！请找林纳斯修理`, '#ff6a6a'); } else if (before > it.durMax * 0.2 && it.dur <= it.durMax * 0.2) toastMsg(`${it.name} 的耐久度快用完了`, '#ffb070'); };
  if (all) list.forEach(hit); else hit(pick(list));
  if (broke) recalcStats(game.player);
}
let hurtCount = 0;
bus.on('playerHurt', () => { if (game.scene !== 'dungeon') return; if (++hurtCount % 4 === 0) wearDurability(1, false); });   // 每被击 4 次随机一件装备 -1 耐久
bus.on('playerDeath', () => { for (const it of durItems()) { const b = it.dur; it.dur = Math.max(0, it.dur - Math.ceil(it.durMax * 0.1)); if (b > 0 && it.dur === 0) toastMsg(`${it.name} 的耐久度为 0，属性失效了！`, '#ff6a6a'); } if (game.player) recalcStats(game.player); });
bus.on('dungeonClear', () => { hurtCount = 0; });
// 修理：身上 + 背包里的装备
const repairList = () => [...SLOTS.map(s => inv.equip[s]), ...inv.items].filter(it => it && it.kind === 'equip' && it.durMax && it.dur < it.durMax);
const repairCostOf = it => Math.ceil((it.durMax - it.dur) * (5 + it.lvl * 2) * (1 + it.rar * 0.35));
function repairCost(list = repairList()) { let c = 0; for (const it of list) c += repairCostOf(it); return c; }
function repairAll(verbose, list = repairList()) {
  const c = repairCost(list);
  if (!c) { if (verbose) toastMsg('装备都很完好，不需要修理', '#bfe8bf'); return false; }
  if (game.gold < c) { toastMsg(`金币不足，修理需要 ${fmtNum(c)} G`, '#ff6a6a'); sfx.error(); return false; }
  game.gold -= c; for (const it of list) it.dur = it.durMax;
  recalcStats(game.player); sfx.coin(); save.write(); toastMsg(`修理完成，花费 ${fmtNum(c)} G`, '#ffd23a'); bus.emit('repair', { cost: c });
  return true;
}
/* ---- 强化（官方经典规则） ----
   成功率：+1~+3 100%、→+4 95%、→+5 90%、→+6 80%、→+7 75%、→+8 62.1%、→+9 53.7%、→+10 41.4%、→+11 33.9%、→+12 28%、→+13 20.7%、→+14 17.3%、→+15 13.6%、→+16 10.1%
   失败：+3~+9 失败降 1 级；武器 +10 失败降为 +7、+11 失败降为 +8、+12 以上失败破碎；防具 / 首饰 / 特殊装备 +10 以上失败破碎
   强化保护券：本来会破碎时装备不碎，但强化等级归零（券被消耗）
   加成：武器 → 攻击力、防具 → 物理防御、首饰 → 魔法防御、特殊装备 → 四维 */
const ENH_MAX = 16;
const ENH_RATE = [1, 1, 1, 0.95, 0.9, 0.8, 0.75, 0.621, 0.537, 0.414, 0.339, 0.28, 0.207, 0.173, 0.136, 0.101];
const enhBonus = e => e <= 0 ? 0 : [0, 0.03, 0.06, 0.1, 0.14, 0.19, 0.25, 0.32, 0.4, 0.5, 0.62, 0.8, 1.0, 1.25, 1.55, 1.9, 2.3][Math.min(ENH_MAX, e)];
const canEnhance = it => it && it.kind === 'equip' && it.slot !== 'title' && !isAvatar(it) && !it.dim && !(ITEMS[it.key] && ITEMS[it.key].noEnhance);   // 带异次元属性（增幅）的装备不能再强化（game/gear.js）
const enhCost = it => ({ gold: Math.round((it.lvl * 24 + 60) * Math.pow(1.42, it.enh) * (1 + it.rar * 0.3)), crystal: Math.max(1, Math.round((it.lvl + 4) * 0.35 * Math.pow(1.25, it.enh))) });
// 失败后的结果：{ lvl（失败后的强化等级）, broken }
function enhFailResult(it) {
  const e = it.enh;
  if (e < 3) return { lvl: e, broken: false };
  if (e < 10) return { lvl: e - 1, broken: false };
  if (it.slot === 'weapon') { if (e === 10) return { lvl: 7, broken: false }; if (e === 11) return { lvl: 8, broken: false }; }
  return { lvl: 0, broken: true };
}
// 强化加成的数值（tooltip 与属性计算共用）
function enhStats(it) {
  const e = it.enh || 0, o = {}; if (!e) return o;
  const b = enhBonus(e), st = it.st || {};
  if (it.slot === 'weapon') { for (const k of ['atk', 'matk', 'indep']) if (st[k]) o[k] = Math.round(st[k] * b); }
  else if (ARMOR_SLOTS.includes(it.slot)) o.def = Math.round((st.def || 10) * b * 0.8);
  else if (ACC_SLOTS.includes(it.slot)) o.mdef = Math.round((st.mdef || 10) * b * 0.9 + e * 4);
  else if (SPECIAL_SLOTS.includes(it.slot)) o.allStat = Math.round(e * e * 0.35 + e);
  if (it.dim) o[it.dim] = (o[it.dim] || 0) + ampStatVal(it);   // 增幅：同级强化加成 + 红字（异次元属性）
  return o;
}
function tryEnhance(it, useGuard, rnd01 = Math.random()) {
  if (!canEnhance(it)) return { err: '这件物品不能强化' };
  if (!inv.items.includes(it) && !SLOTS.some(s => inv.equip[s] === it)) return { err: '这件装备已经不在身上或背包里了' };
  if (it.enh >= ENH_MAX) return { err: '已经强化到最高等级' };
  const cost = enhCost(it);
  if (game.gold < cost.gold) return { err: '金币不足' };
  if (inv.count('crystal') < cost.crystal) return { err: '无色小晶块不足' };
  game.gold -= cost.gold; inv.take('crystal', cost.crystal);
  const from = it.enh;
  let res;
  if (rnd01 < ENH_RATE[it.enh]) { it.enh++; res = { ok: true, from, lvl: it.enh }; }
  else {
    const f = enhFailResult(it);
    if (f.broken && useGuard && inv.take('guard', 1)) { it.enh = 0; res = { ok: false, from, lvl: 0, guard: true }; }
    else if (f.broken) res = { ok: false, from, lvl: from, broken: true };
    else { it.enh = f.lvl; res = { ok: false, from, lvl: it.enh }; }
  }
  if (res.broken) {   // 装备破碎：从身上 / 背包里移除，返还一点无色小晶块
    for (const s of SLOTS) if (inv.equip[s] === it) delete inv.equip[s];
    inv.remove(it); res.refund = Math.max(1, Math.round(it.lvl * 2 + cost.crystal * 0.5)); giveItem(makeItem('crystal', res.refund));
  }
  if (game.player) recalcStats(game.player);
  bus.emit('enhance', { item: it, ok: res.ok, lvl: res.lvl, broken: !!res.broken });
  if (res.ok && res.lvl >= 10) toastMsg(`【公告】勇士 ${save.data ? save.data.name : ''} 将 ${it.name} 强化到了 +${res.lvl}！`, '#ffd23a');
  save.write();
  return res;
}
/* ---- 分解：装备 → 材料（诺顿 / 林纳斯） ---- */
function disassembleYield(it) {
  const L = it.lvl, r = it.rar, out = {};
  const add = (k, n) => { if (n > 0 && ITEMS[k]) out[k] = (out[k] || 0) + n; };
  const seed = mulberry(it.id || 1), R = () => seed();
  const metal = it.slot === 'weapon' || it.atype === 'heavy' || it.atype === 'plate';
  const basic = ACC_SLOTS.includes(it.slot) || SPECIAL_SLOTS.includes(it.slot) ? 'm_bone' : metal ? 'm_iron' : it.atype === 'leather' || it.atype === 'light' ? 'm_leather' : 'm_cloth';
  const color = ['c_red', 'c_blue', 'c_white', 'c_black'][Math.floor(R() * 4)];
  add('crystal', Math.round([2, 3, 5, 8, 12, 16][r] + L * [0.2, 0.3, 0.35, 0.45, 0.5, 0.6][r]));   // 白装：无色小晶块
  if (r === 0 && R() < 0.5) add(basic, 1 + Math.floor(L / 12));
  if (r >= 1) add(color, 1 + Math.floor(L / 8) + (r >= 2 ? 1 : 0));                                 // 蓝装：有色小晶块
  if (r >= 2 || it.set) add('m_elem', 1 + Math.floor(L / 12) + Math.floor(R() * 2));                // 紫装 / 套装：下级元素结晶
  if (r >= 3) add('m_elem2', r - 2 + Math.floor(L / 20));                                           // 粉装以上：上级元素结晶
  if (r >= 4) add('m_diamond', r - 3);
  if (r >= 5) add('m_soul', 1);
  if (it.enh && !it.dim) add('crystal', it.enh * 3);
  if (it.dim) add('m_contra', 1 + Math.floor((it.enh || 0) / 3));   // 增幅过的装备返还矛盾的结晶体
  if (it.forge) add('m_elem', Math.ceil(it.forge / 2));
  return out;
}
const canDisassemble = it => it && it.kind === 'equip' && it.slot !== 'title' && !isAvatar(it) && !(ITEMS[it.key] && ITEMS[it.key].noDisassemble);
const disassembleFee = it => Math.ceil(it.lvl * (it.rar + 1) * 2.5);
function disassemble(list) {
  list = list.filter(it => canDisassemble(it) && inv.items.includes(it));
  const fee = list.reduce((s, it) => s + disassembleFee(it), 0);
  if (!list.length) return null;
  if (game.gold < fee) { toastMsg(`金币不足，分解手续费 ${fmtNum(fee)} G`, '#ff6a6a'); sfx.error(); return null; }
  const total = {};
  for (const it of list) { const y = disassembleYield(it); for (const k in y) total[k] = (total[k] || 0) + y[k]; inv.remove(it); bus.emit('disassemble', { item: it, mats: y }); }
  game.gold -= fee;
  for (const k in total) giveItem(makeItem(k, total[k]));
  sfx.coin(); save.write();
  return { mats: total, fee, n: list.length };
}
/* ---------------- 图标 ---------------- */
// 图标美术 key：物品库的 icon 字段 > 按类型的通用图 > 旧图标 > 代码绘制
function itemArtKey(it) {
  const D = ITEMS[it.key] || {};
  const cands = [];
  if (D.icon) cands.push('icon/' + D.icon);
  if (it.kind === 'equip') {
    if (it.slot === 'weapon') cands.push(`icon/item_w_${it.wtype || CLASS_START_WEAPON[it.cls] || 'katana'}`, `icon/w_${it.cls || 'sword'}`);
    else if (ARMOR_SLOTS.includes(it.slot)) cands.push(`icon/item_a_${it.atype || 'light'}_${it.slot}`, `icon/${it.slot}`);
    else if (ACC_SLOTS.includes(it.slot)) cands.push(`icon/item_${it.slot}${it.rar >= 3 ? '2' : ''}`, `icon/item_${it.slot}`, `icon/${it.slot}`);
    else cands.push(`icon/item_${it.slot}`, isAvatar(it) ? 'icon/item_title' : null);
  } else cands.push(`icon/item_${it.key}`, `icon/${it.key}`, it.kind === 'quest' ? 'icon/item_quest' : null);
  for (const k of cands) if (k && IMG[k]) return k;
  return cands.find(k => k && typeof ASSET_SRC !== 'undefined' && ASSET_SRC[k]) || null;
}
// 旧图标（带彩色方块底）要画大一点把底色裁掉；新图标是透明底的物体
const isOldIcon = k => k && !k.startsWith('icon/item_');
function drawItemIcon(c, it, s = 16) {
  const k = itemArtKey(it), art = k && IMG[k];
  if (art) { const z = isOldIcon(k) ? 1.24 : 1.12; c.drawImage(art, -s * z / 2, -s * z / 2, s * z, s * z); return; }
  drawItemVector(c, it, s);
}
// 没有美术时的代码绘制（兜底）
function drawItemVector(c, it, s) {
  c.save(); c.scale(s / 32, s / 32); c.lineJoin = 'round';
  const R = RARITY[it.rar || 0].col, metal = it.rar >= 5 ? '#ffe070' : it.rar >= 3 ? '#e8c0ff' : '#c8d0dc';
  const ol = () => { c.lineWidth = 2; c.strokeStyle = OUTLINE; c.stroke(); };
  if (it.kind === 'equip') {
    switch (it.slot) {
      case 'weapon': c.rotate(-0.7); c.fillStyle = metal; c.beginPath(); c.moveTo(-2, -16); c.lineTo(2, -16); c.lineTo(2.5, 8); c.lineTo(-2.5, 8); c.closePath(); c.fill(); ol(); c.fillStyle = '#d9b25a'; c.fillRect(-6, 8, 12, 3); c.fillStyle = '#3a2a20'; c.fillRect(-1.5, 11, 3, 7); break;
      case 'title': c.fillStyle = '#ffd23a'; c.beginPath(); c.arc(0, 2, 10, 0, TAU); c.fill(); ol(); c.fillStyle = R; c.fillRect(-4, -14, 8, 8); break;
      case 'neck': case 'bracelet': case 'ring': case 'stone': case 'support': c.strokeStyle = OUTLINE; c.lineWidth = 6; c.beginPath(); c.arc(0, 3, 8, 0, TAU); c.stroke(); c.strokeStyle = metal; c.lineWidth = 3; c.stroke(); c.fillStyle = R; c.beginPath(); c.arc(0, -6, 4.5, 0, TAU); c.fill(); ol(); break;
      default: c.fillStyle = metal; c.beginPath(); c.moveTo(-12, -10); c.lineTo(12, -10); c.lineTo(9, 12); c.lineTo(-9, 12); c.closePath(); c.fill(); ol(); c.fillStyle = R; c.fillRect(-2, -8, 4, 18);
    }
  } else if (it.kind === 'mat' || it.kind === 'quest') {
    c.fillStyle = (ITEMS[it.key] || {}).col || '#dfe8f0'; c.beginPath(); c.moveTo(0, -12); c.lineTo(9, -2); c.lineTo(4, 12); c.lineTo(-6, 10); c.lineTo(-9, -3); c.closePath(); c.fill(); ol();
  } else {
    const col = (ITEMS[it.key] || {}).col || '#f33';
    c.fillStyle = 'rgba(220,230,240,.6)'; c.beginPath(); c.arc(0, 3, 10, 0, TAU); c.fill(); ol(); c.fillStyle = col; c.beginPath(); c.arc(0, 5, 7, 0, TAU); c.fill(); c.fillStyle = '#8a5a30'; c.fillRect(-3, -11, 6, 5);
  }
  c.restore();
}
// 带底色和品级边框的图标 URL（<img src> 用）
const iconUrlCache = new Map();
function itemIconSrc(it, size = 64) {
  if (typeof it === 'string') it = ITEMS[it] ? { ...ITEMS[it], key: it } : { key: it, kind: 'use', rar: 0 };
  if (!it) return '';
  const k = itemArtKey(it), ck = `${k || it.slot || it.key}|${it.rar || 0}|${size}`;
  if (iconUrlCache.has(ck)) return iconUrlCache.get(ck);
  const [cv, c] = offCanvas(size, size), r = it.rar || 0, col = RARITY[r].col;
  const g = c.createLinearGradient(0, 0, 0, size); g.addColorStop(0, r >= 5 ? '#3a2c10' : '#2a2430'); g.addColorStop(1, r >= 5 ? '#1a1206' : '#120e16');
  c.fillStyle = g; c.fillRect(0, 0, size, size);
  if (r >= 2) { const rg = c.createRadialGradient(size / 2, size / 2, 2, size / 2, size / 2, size * 0.62); rg.addColorStop(0, shade(col, 0, r >= 4 ? 0.38 : 0.22)); rg.addColorStop(1, shade(col, 0, 0)); c.fillStyle = rg; c.fillRect(0, 0, size, size); }
  c.save(); c.translate(size / 2, size / 2); drawItemIcon(c, it, size * 0.8); c.restore();
  c.strokeStyle = r ? col : '#5a5060'; c.lineWidth = Math.max(1.5, size / 28); c.strokeRect(c.lineWidth / 2, c.lineWidth / 2, size - c.lineWidth, size - c.lineWidth);
  const url = cv.toDataURL();
  if (!k || IMG[k] || (typeof bundleLoads !== 'undefined' && bundleLoads[k])) iconUrlCache.set(ck, url);   // 美术还没开始加载时不缓存（加载失败的也缓存兜底图）
  return url;
}
const itemIconURL = (it, size = 96) => itemIconSrc(it, size);   // 旧名字
function drawQuickItem(c, i, x, y, s) {
  const key = inv.quick[i]; if (!key) return;
  const n = inv.count(key);
  c.save(); c.translate(x + s / 2, y + s / 2); c.globalAlpha = n > 0 ? 1 : 0.3; drawItemIcon(c, { kind: 'use', key }, s * 0.85); c.restore();
  uiText(String(n), x + s - 2, y + s - 3, { size: 16, align: 'right', color: '#fff', sw: 3 });
  if (inv.potCd > 0) { c.fillStyle = 'rgba(0,0,0,.5)'; c.fillRect(x, y + s * (1 - inv.potCd), s, s * inv.potCd); }
}
