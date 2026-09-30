/* =====================================================================
   装备 2.0 · 纯冷却流（用户要求「只减冷却」的装备线，本作原创，Lv50）
   - 传说「时之沙漏」5 件套（项链 / 手镯 / 戒指 / 辅助装备 / 魔法石）：每件只有技能冷却 -10% + 这个部位的普通基础属性；2 / 3 / 5 件各 -5% / -8% / -12%
   - 神器「流沙」：防具 5 种护甲 × 5 部位、首饰 3 件、辅助装备、魔法石、15 种武器各一件，每件只有技能冷却 -6%（武器拿在手里是 <类型>_r3 外观，只做图标）
   冷却减少各来源相乘、不设上限（game/progress.js equipTotals 的 cdrMul，最低保底 5%）；每件装备、每档套装效果各算一个来源。
   获取：所有 Lv50 以上地下城 / 深渊派对的领主小几率掉落（不进随机池）；歌兰蒂斯「深渊派对 · 纯冷却流」用宇宙灵魂兑换（ui/items/abyss.js）。
   图标：art/tools/gear_icons_cdr60.py。说明：docs/GEAR.md §11。
   注释只放在行尾或单独一行（一行中间的 // 会吞掉后面的字段）。
   ===================================================================== */
const CDR60 = {
  set: 'set_hourglass',
  legend: [],   // 时之沙漏 5 件
  sand: [],     // 流沙：首饰 / 辅助 / 魔法石 → 防具（按护甲类型）→ 武器
  cost: { 4: 40, 3: 20 },   // 宇宙灵魂兑换价：传说 40、神器 20
  drop: { 4: 0.002, 3: 0.004 },   // 领主掉落几率（每件）：传说比神器更稀有
  minLv: 50,   // 推荐等级上限 ≥ 50 的地下城（含深渊派对）
};
const cdr60Cost = key => CDR60.cost[ITEMS[key].rar] || 0;
// 兑换列表：传说 → 流沙首饰 / 特殊 → 流沙防具（本职业精通的护甲排前面）→ 流沙武器（只列本职业）
function cdr60ExchangeKeys(cls = game.player ? game.player.cls : 'sword', job = game.job) {
  const M = typeof masteryOf === 'function' ? masteryOf(cls, job) : null, D = k => ITEMS[k];
  const acc = CDR60.sand.filter(k => !D(k).atype && D(k).slot !== 'weapon');
  const armor = CDR60.sand.filter(k => D(k).atype).sort((a, b) => (D(b).atype === M) - (D(a).atype === M));
  const weapon = CDR60.sand.filter(k => D(k).slot === 'weapon' && D(k).cls === cls && wtypeJobOk(D(k).wtype, job));
  return [...CDR60.legend, ...acc, ...armor, ...weapon];
}
{
const SRC = `所有 Lv${CDR60.minLv} 以上地下城 / 深渊派对的领主小几率掉落；歌兰蒂斯处（深渊派对 · 纯冷却流）用宇宙灵魂兑换`;
// 两条随机基础属性（gearStats 前两次 R()）不抽力量 / 智力 / 暴击：换种子 `${key}#n`（和 g60CalmLines 同一个写法），部位本身的基础属性不变
const LINES = ['str', 'int', 'vit', 'spr', 'hp', 'mp', 'crit', 'hit', 'evade'], MAIN = ['str', 'int', 'crit'];
const calmSeed = key => { for (let i = 0; i < 100; i++) { const s = i ? `${key}#${i}` : key, R = mulberry(keySeed(s)); if (![R(), R()].some(x => MAIN.includes(LINES[Math.floor(x * 9)]))) return s; } return key; };
const CDR = (key, def) => { if (ITEMS[key]) g60Problem(`纯冷却流：${key} 已经存在`); return defineGear(key, { lvl: 50, noDrop: true, icon: 'item_' + key, src: SRC, seed: calmSeed(key), ...def }); };

/* ---------------- 传说「时之沙漏」5 件套 ---------------- */
if (SETS[CDR60.set]) g60Problem(`纯冷却流：套装 ${CDR60.set} 已经存在`);
defineSet(CDR60.set, { name: '时之沙漏', bonus: {
  2: { st: { cdr: 0.05 }, desc: '【纯冷却流】技能冷却 -5%（单独一个来源，和其他冷却减少相乘）' },
  3: { st: { cdr: 0.08 }, desc: '【纯冷却流】技能冷却再 -8%（单独一个来源，相乘）' },
  5: { st: { cdr: 0.12 }, desc: '【纯冷却流】技能冷却再 -12%（单独一个来源，相乘）；满 5 件时这套一共让冷却 ×0.45' } } });
const HG_DESC = '【纯冷却流】只减技能冷却，不加伤害。冷却减少按来源相乘、不设上限（最低保底 5%）：每件 -10%，套装 2 / 3 / 5 件再各 -5% / -8% / -12%。倒着流的沙漏，沙子落下之前，技能已经准备好了。（本作原创）';
for (const [slot, name] of [['neck', '时之沙漏项链'], ['bracelet', '时之沙漏手镯'], ['ring', '时之沙漏戒指'], ['support', '时之沙漏·逆流沙钟'], ['stone', '时之沙漏·时砂晶石']]) {
  const key = `${CDR60.set}_${slot}`;
  CDR(key, { slot, rar: 4, name, fx: { cdr: 0.1 }, set: CDR60.set, desc: HG_DESC });
  SETS[CDR60.set].pieces.push(key); CDR60.legend.push(key);
}

/* ---------------- 神器「流沙」：每件只有技能冷却 -6% ---------------- */
const SAND_DESC = '【纯冷却流】只减技能冷却，不加伤害。冷却减少按来源相乘、不设上限（最低保底 5%）。细沙从指缝里流走，时间也跟着快了一点。（本作原创）';
const SAND = (key, def) => { CDR(key, { rar: 3, fx: { cdr: 0.06 }, desc: SAND_DESC, ...def }); CDR60.sand.push(key); };
for (const [slot, name] of [['neck', '流沙项链'], ['bracelet', '流沙手镯'], ['ring', '流沙戒指'], ['support', '流沙之瓶'], ['stone', '流沙晶石']]) SAND(`sand_${slot}`, { slot, name });
// 防具：5 种护甲各一套（精通只认同类型的护甲，重甲 / 板甲穿错还有惩罚）
for (const a of Object.keys(ATYPES)) for (const s of ARMOR_SLOTS) SAND(`sand_${a}_${s}`, { slot: s, atype: a, name: `流沙${ATYPES[a].name}${SLOT_NAME[s]}` });
for (const t of Object.keys(WTYPES)) SAND(`sand_${t}`, { slot: 'weapon', wtype: t, name: `流沙${WTYPES[t].name}` });

/* ---------------- 掉落：所有 Lv50 以上地下城（含深渊派对）的领主（要等所有区域定义完，排到 gear60_apply.js 执行）---------------- */
g60Later(() => {
  const list = [...CDR60.legend, ...CDR60.sand].filter(k => !ITEMS[k].cls || clsOpen(ITEMS[k].cls)).map(k => [k, CDR60.drop[ITEMS[k].rar]]);   // 还没开放的职业（格斗家）的流沙武器不掉
  for (const id in DUNGEONS) { const G = DUNGEONS[id]; if (G.lvl && G.lvl[1] >= CDR60.minLv) g60AddBoss(id, list); }   // g60Later 里直接调 gearDrop 的实现（gearDrop 本身在排队执行期间还会再排一次队）
});
}
