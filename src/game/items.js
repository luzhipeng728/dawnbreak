/* =====================================================================
   23. 物品：装备生成（部位 / 品级 / 品质 / 强化）、消耗品、背包与装备栏、掉落、强化规则、图标
   ===================================================================== */
const SLOTS = ['weapon', 'head', 'top', 'bottom', 'belt', 'shoes', 'neck', 'bracelet', 'ring'];
const SLOT_NAME = { weapon: '武器', head: '头肩', top: '上衣', bottom: '下装', belt: '腰带', shoes: '鞋', neck: '项链', bracelet: '手镯', ring: '戒指' };
const GRADES = ['最下级', '下级', '中级', '上级', '最上级'];
const RAR_MUL = [1, 1.25, 1.55, 1.85, 2.2, 2.8];
const BASE_NAMES = {
  weapon: { sword: ['铁制太刀', '钢制太刀', '寒光太刀', '白鞘太刀', '赤锋太刀', '月影太刀', '雷纹太刀'], gun: ['旧式左轮', '钢制左轮', '夜鹰左轮', '赤铜左轮', '银翼左轮'], mage: ['橡木法杖', '水晶法杖', '星辉法杖', '炎心法杖', '霜语法杖'] },
  head: ['皮质护肩', '锁甲护肩', '钢铁护肩', '骑士护肩', '龙鳞护肩'], top: ['粗布上衣', '皮质上衣', '锁甲上衣', '钢铁胸甲', '骑士胸甲'],
  bottom: ['粗布长裤', '皮质护腿', '锁甲护腿', '钢铁护腿', '骑士护腿'], belt: ['麻绳腰带', '皮质腰带', '铆钉腰带', '钢扣腰带', '骑士腰带'],
  shoes: ['草鞋', '皮靴', '铁头靴', '钢铁战靴', '骑士战靴'], neck: ['骨质项链', '铜质项链', '银质项链', '翡翠项链', '星辰项链'],
  bracelet: ['木质手镯', '铜质手镯', '银质手镯', '红玉手镯', '星辰手镯'], ring: ['铁指环', '铜指环', '银指环', '蓝宝石戒指', '星辰戒指'],
};
const RAR_PREFIX = [[''], ['精良的', '坚固的', '锐利的'], ['秘银', '符文', '深蓝'], ['幻影', '血月', '星陨'], ['传说·', '英雄·', '远古·'], ['']];
// 史诗装备（固定名称 + 特效）
const EPICS = [
  { slot: 'weapon', cls: 'sword', name: '破晓之刃·晨星', lvl: 5, fx: { critDmg: 0.35, crit: 0.08 }, desc: '暴击伤害 +35%，暴击率 +8%' },
  { slot: 'weapon', cls: 'gun', name: '沙漠之鹰·黄昏', lvl: 5, fx: { critDmg: 0.3, crit: 0.1 }, desc: '暴击伤害 +30%，暴击率 +10%' },
  { slot: 'weapon', cls: 'mage', name: '星海之杖·永夜', lvl: 5, fx: { critDmg: 0.25, mpRegen: 1.0 }, desc: '暴击伤害 +25%，MP 恢复 +100%' },
  { slot: 'top', name: '不灭者战甲', lvl: 8, fx: { hpPct: 0.25 }, desc: 'HP 上限 +25%' },
  { slot: 'neck', name: '渊洋之心', lvl: 10, fx: { cdr: 0.12 }, desc: '所有技能冷却时间 -12%' },
  { slot: 'ring', name: '时光之戒', lvl: 12, fx: { spd: 0.12, crit: 0.05 }, desc: '移动与攻击速度 +12%，暴击率 +5%' },
  { slot: 'shoes', name: '疾风行者', lvl: 6, fx: { spd: 0.18 }, desc: '移动速度 +18%' },
  { slot: 'bracelet', name: '炎龙之怒', lvl: 14, fx: { atkPct: 0.12 }, desc: '攻击力 +12%' },
];
let itemSeq = Date.now() % 100000;
function makeEquip(slot, lvl, rar, cls = game.player ? game.player.cls : 'sword', epic = null) {
  const grade = rar === 5 ? 4 : Math.floor(Math.random() * 5), gm = 0.9 + grade * 0.05, m = RAR_MUL[rar] * gm;
  const tier = clamp(Math.floor((lvl - 1) / 5) + (rar >= 3 ? 1 : 0), 0, 4);
  let name;
  if (epic) name = epic.name;
  else if (slot === 'weapon') { const arr = BASE_NAMES.weapon[cls] || BASE_NAMES.weapon.sword; name = pick(RAR_PREFIX[rar]) + arr[Math.min(arr.length - 1, tier + (rar >= 4 ? 1 : 0))]; }
  else name = pick(RAR_PREFIX[rar]) + BASE_NAMES[slot][Math.min(4, tier)];
  const st = {};
  if (slot === 'weapon') st.atk = Math.round((60 + 26 * lvl) * m);
  else if (['head', 'top', 'bottom', 'belt', 'shoes'].includes(slot)) { st.def = Math.round((14 + 7 * lvl) * m); st.hp = Math.round((20 + 12 * lvl) * m * (slot === 'top' ? 1.4 : 1)); }
  else { st.str = Math.round((2 + lvl * 0.9) * m); if (slot === 'ring') st.crit = +(0.01 + 0.004 * lvl * m / 2).toFixed(3); if (slot === 'neck') st.mp = Math.round((15 + 8 * lvl) * m); if (slot === 'bracelet') st.atk = Math.round((8 + 5 * lvl) * m); }
  if (rar >= 2) { const extra = pick(['str', 'crit', 'hp', 'mp']); if (extra === 'str') st.str = (st.str || 0) + Math.round(lvl * 0.6 * m); else if (extra === 'crit') st.crit = +((st.crit || 0) + 0.01 * rar).toFixed(3); else if (extra === 'hp') st.hp = (st.hp || 0) + Math.round(lvl * 10 * m); else st.mp = (st.mp || 0) + Math.round(lvl * 6 * m); }
  const it = { id: itemSeq++, kind: 'equip', slot, cls: slot === 'weapon' ? cls : null, name, rar, grade, lvl: Math.max(1, lvl), st, enh: 0, dur: 30 };
  if (epic) { it.fx = epic.fx; it.desc = epic.desc; it.epic = true; }
  it.price = Math.round((40 + lvl * 25) * Math.pow(2.2, rar));
  return it;
}
const CONSUMABLES = {
  hpS: { name: '小型生命药剂', kind: 'use', hp: 0.25, price: 60, col: '#e83a3a', size: 0.8 },
  hpM: { name: '中型生命药剂', kind: 'use', hp: 0.45, price: 160, col: '#e83a3a', size: 1 },
  hpL: { name: '大型生命药剂', kind: 'use', hp: 0.7, price: 400, col: '#e83a3a', size: 1.2 },
  mpS: { name: '小型魔力药剂', kind: 'use', mp: 0.25, price: 60, col: '#3a78ff', size: 0.8 },
  mpM: { name: '中型魔力药剂', kind: 'use', mp: 0.45, price: 160, col: '#3a78ff', size: 1 },
  elixir: { name: '精灵之泪', kind: 'use', hp: 1, mp: 1, price: 1500, col: '#ffd23a', size: 1.1 },
  crystal: { name: '无色晶块', kind: 'mat', price: 30, col: '#dfe8f0' },
  guard: { name: '强化保护券', kind: 'mat', price: 12000, col: '#6ad0ff' },
  coin: { name: '复活币', kind: 'mat', price: 3000, col: '#ffd23a' },
};
function makeConsumable(key, n = 1) { const C = CONSUMABLES[key]; return { id: itemSeq++, kind: C.kind, key, name: C.name, n, rar: key === 'elixir' ? 3 : key === 'guard' ? 2 : 0, price: C.price }; }
/* ---- 背包 ---- */
const inv = {
  items: [], equip: {}, quick: ['hpS', 'mpS', null, null, null, null], cap: 48, potCd: 0,
  add(it) {
    if (it.kind !== 'equip') { const ex = this.items.find(x => x.key === it.key); if (ex) { ex.n += it.n; return true; } }
    if (this.items.length >= this.cap) return false;
    this.items.push(it); return true;
  },
  count(key) { const x = this.items.find(i => i.key === key); return x ? x.n : 0; },
  take(key, n = 1) { const x = this.items.find(i => i.key === key); if (!x || x.n < n) return false; x.n -= n; if (x.n <= 0) this.items.splice(this.items.indexOf(x), 1); return true; },
  remove(it) { const i = this.items.indexOf(it); if (i >= 0) this.items.splice(i, 1); },
  starter(cls) {
    this.items = []; this.equip = {}; this.quick = ['hpS', 'mpS', null, null, null, null];
    this.equip.weapon = makeEquip('weapon', 1, 0, cls); this.equip.top = makeEquip('top', 1, 0); this.equip.bottom = makeEquip('bottom', 1, 0);
    this.add(makeConsumable('hpS', 15)); this.add(makeConsumable('mpS', 15)); this.add(makeConsumable('hpM', 5)); this.add(makeConsumable('crystal', 30));
  },
  wear(it) {
    if (it.lvl > game.lvl) { toastMsg(`需要等级 ${it.lvl}`, '#ff6a6a'); sfx.error(); return false; }
    if (it.slot === 'weapon' && it.cls && it.cls !== game.player.cls) { toastMsg('职业无法使用这件武器', '#ff6a6a'); sfx.error(); return false; }
    const old = this.equip[it.slot]; this.remove(it); this.equip[it.slot] = it; if (old) this.items.push(old);
    recalcStats(game.player); sfx.pickup(); return true;
  },
  unwear(slot) { const it = this.equip[slot]; if (!it) return; if (this.items.length >= this.cap) { toastMsg('背包已满'); return; } delete this.equip[slot]; this.items.push(it); recalcStats(game.player); },
  // 装备总属性：基础 + 强化（武器加攻击，防具加防御，首饰加力量）+ 史诗特效
  equipStats() {
    const s = { atk: 0, def: 0, hp: 0, mp: 0, str: 0, crit: 0, critDmg: 0, spd: 0, cdr: 0, hpPct: 0, atkPct: 0, mpRegen: 0 };
    for (const k of SLOTS) {
      const it = this.equip[k]; if (!it) continue;
      for (const a in it.st) s[a] += it.st[a];
      const e = it.enh || 0;
      if (k === 'weapon') s.atk += Math.round((it.st.atk || 0) * enhBonus(e));
      else if (it.st.def) s.def += Math.round(it.st.def * enhBonus(e) * 0.8);
      else s.str += Math.round(e * e * 0.6);
      if (it.fx) for (const a in it.fx) s[a] = (s[a] || 0) + it.fx[a];
    }
    s.atk = Math.round(s.atk * (1 + s.atkPct)); s.hp = Math.round(s.hp * (1 + s.hpPct)) + 0;
    return s;
  },
  use(key) {
    const p = game.player; if (!p || p.dead) return false;
    const C = CONSUMABLES[key]; if (!C || C.kind !== 'use') return false;
    if (this.potCd > 0) return false;
    if (!this.take(key)) { toastMsg('没有这个物品了'); return false; }
    if (C.hp) { const h = Math.round(p.hpMax * C.hp); p.hp = Math.min(p.hpMax, p.hp + h); addNumber(h, p.x, p.y, p.z, { heal: true }); }
    if (C.mp) { const m = Math.round(p.mpMax * C.mp); p.mp = Math.min(p.mpMax, p.mp + m); addNumber(m, p.x, p.y, p.z + 12, { col: '#6ab8ff' }); }
    this.potCd = 1; sfx.pickup();
    addFx({ x: p.x, y: p.y + 1, z: 0, dur: 0.5, add: true, col: C.col, draw(c) { const k = this.t / this.dur; c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = shade(this.col, 0.3, 0.5 * (1 - k)); for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + k * 3; c.beginPath(); c.arc(sx(game.player.x) + Math.cos(a) * 16, sy(game.player.y, 20 + k * 70), 2.5, 0, TAU); c.fill(); } c.restore(); } });
    return true;
  },
};
// 放进背包；背包满了就按出售价自动换成金币（避免奖励凭空消失）
function giveItem(it) {
  if (inv.add(it)) return true;
  const g = Math.max(1, Math.round((it.price || 10) * 0.2 * (it.kind === 'equip' ? 1 : it.n || 1)));
  game.gold += g; toastMsg(`背包已满，${it.name} 已自动出售（+${fmtNum(g)} G）`, '#ffd070'); return false;
}
const enhBonus = e => e <= 0 ? 0 : [0, 0.03, 0.06, 0.1, 0.14, 0.19, 0.25, 0.32, 0.4, 0.5, 0.62, 0.8, 1.0, 1.25, 1.55, 1.9][Math.min(15, e)];
// 强化成功率（经典流传表）与失败惩罚（+3~+10 降 1 级；武器 +10→11 降为 +7、+11→12 降为 +8；+12 以上碎；防具首饰 +10 以上碎）
const ENH_RATE = [1, 1, 1, 0.95, 0.9, 0.8, 0.75, 0.621, 0.537, 0.414, 0.339, 0.28, 0.207, 0.173, 0.136];
const enhCost = (it) => ({ gold: Math.round((it.lvl * 30 + 80) * Math.pow(1.45, it.enh) * (1 + it.rar * 0.3)), crystal: Math.max(1, Math.round((it.lvl + 5) * 0.5 * Math.pow(1.25, it.enh))) });
function tryEnhance(it, useGuard) {
  const cost = enhCost(it);
  if (game.gold < cost.gold || inv.count('crystal') < cost.crystal) return { err: '材料或金币不足' };
  if (it.enh >= 15) return { err: '已经强化到最高等级' };
  game.gold -= cost.gold; inv.take('crystal', cost.crystal);
  const ok = Math.random() < ENH_RATE[it.enh];
  if (ok) { it.enh++; return { ok: true, lvl: it.enh }; }
  let res = { ok: false, from: it.enh };
  if (useGuard && it.enh >= 10 && inv.take('guard')) { res.guard = true; if (it.enh >= 10) it.enh = 10; else it.enh = Math.max(0, it.enh - 1); }
  else if (it.enh < 3) { /* +1~+3 失败不掉级 */ }
  else if (it.enh < 10) it.enh--;
  else if (it.slot === 'weapon' && it.enh === 10) it.enh = 7;
  else if (it.slot === 'weapon' && it.enh === 11) it.enh = 8;
  else res.broken = true;
  res.lvl = it.enh; return res;
}
/* ---- 掉落 ---- */
function rollRarity(bonus = 0, boss = false) {
  const w = [50, 30, 13 + bonus * 20, 4.5 + bonus * 10, 1.2 + bonus * 4 + (boss ? 1.5 : 0), 0.25 + bonus * 1.5 + (boss ? 0.8 : 0)];
  let r = Math.random() * w.reduce((a, b) => a + b, 0); for (let i = 0; i < w.length; i++) { r -= w[i]; if (r <= 0) return i; } return 0;
}
function rollDrop(t, dg) {
  const bonus = dg ? dg.D.drop : 0;
  const n = t.boss ? 2 + (Math.random() < 0.5 ? 1 : 0) : t.elite ? (Math.random() < 0.6 ? 1 : 0) : (Math.random() < 0.07 ? 1 : 0);
  for (let i = 0; i < n; i++) {
    const rar = rollRarity(bonus, t.boss);
    let it;
    if (rar === 5) { const pool = EPICS.filter(e => !e.cls || e.cls === game.player.cls); const E = pick(pool); it = makeEquip(E.slot, Math.max(E.lvl, t.lvl), 5, game.player.cls, E); }
    else it = makeEquip(pick(SLOTS), clamp(t.lvl + rndi(-1, 1), 1, 30), rar);
    spawnDrop({ kind: 'item', item: it, x: t.x, y: t.y, z: Math.max(t.z, 20) });
  }
  if (Math.random() < (t.boss ? 1 : 0.06)) spawnDrop({ kind: 'item', item: makeConsumable(pick(['hpS', 'mpS', 'hpM', 'crystal']), t.boss ? 3 : 1), x: t.x, y: t.y, z: 20 });
}
/* ---- 图标（世界层与 DOM 共用） ---- */
function drawItemIcon(c, it, s = 16) {
  const art = IMG[itemArtKey(it)]; if (art) { c.drawImage(art, -s * 0.62, -s * 0.62, s * 1.24, s * 1.24); return; }   // 手绘图标
  c.save(); c.scale(s / 32, s / 32); c.lineJoin = 'round';
  const R = RARITY[it.rar || 0].col;
  const metal = it.rar >= 5 ? '#ffe070' : it.rar >= 3 ? '#e8c0ff' : '#c8d0dc';
  const ol = () => { c.lineWidth = 2; c.strokeStyle = OUTLINE; c.stroke(); };
  if (it.kind === 'equip') {
    switch (it.slot) {
      case 'weapon':
        if (it.cls === 'gun') { c.fillStyle = metal; c.fillRect(-10, -8, 22, 7); ol(); c.fillStyle = '#6a4a2a'; c.beginPath(); c.moveTo(-10, -2); c.lineTo(-4, -2); c.lineTo(-7, 10); c.lineTo(-13, 10); c.closePath(); c.fill(); ol(); }
        else if (it.cls === 'mage') { c.fillStyle = '#7a5030'; c.fillRect(-2, -6, 4, 22); ol(); c.fillStyle = it.rar >= 3 ? '#ff6ad0' : '#6ad0ff'; c.beginPath(); c.arc(0, -10, 6, 0, TAU); c.fill(); ol(); }
        else { c.rotate(-0.7); c.fillStyle = metal; c.beginPath(); c.moveTo(-2, -16); c.lineTo(2, -16); c.lineTo(2.5, 8); c.lineTo(-2.5, 8); c.closePath(); c.fill(); ol(); c.fillStyle = '#d9b25a'; c.fillRect(-6, 8, 12, 3); c.fillStyle = '#3a2a20'; c.fillRect(-1.5, 11, 3, 7); }
        break;
      case 'head': c.fillStyle = metal; c.beginPath(); c.ellipse(-7, 0, 8, 6, -0.3, 0, TAU); c.fill(); ol(); c.beginPath(); c.ellipse(7, 0, 8, 6, 0.3, 0, TAU); c.fill(); ol(); break;
      case 'top': c.fillStyle = metal; c.beginPath(); c.moveTo(-12, -10); c.lineTo(12, -10); c.lineTo(9, 12); c.lineTo(-9, 12); c.closePath(); c.fill(); ol(); c.fillStyle = R; c.fillRect(-2, -8, 4, 18); break;
      case 'bottom': c.fillStyle = metal; c.beginPath(); c.moveTo(-9, -10); c.lineTo(9, -10); c.lineTo(10, 13); c.lineTo(2, 13); c.lineTo(0, 0); c.lineTo(-2, 13); c.lineTo(-10, 13); c.closePath(); c.fill(); ol(); break;
      case 'belt': c.fillStyle = '#7a5030'; c.fillRect(-13, -4, 26, 8); ol(); c.fillStyle = metal; c.fillRect(-4, -5, 8, 10); ol(); break;
      case 'shoes': c.fillStyle = '#6a4a30'; c.beginPath(); c.moveTo(-8, -12); c.lineTo(0, -12); c.lineTo(1, 4); c.lineTo(12, 6); c.lineTo(12, 12); c.lineTo(-8, 12); c.closePath(); c.fill(); ol(); c.fillStyle = metal; c.fillRect(-8, 8, 20, 3); break;
      case 'neck': c.strokeStyle = metal; c.lineWidth = 2.5; c.beginPath(); c.arc(0, -4, 10, 0.2, Math.PI - 0.2); c.stroke(); c.fillStyle = R; c.beginPath(); c.moveTo(0, 6); c.lineTo(5, 11); c.lineTo(0, 16); c.lineTo(-5, 11); c.closePath(); c.fill(); ol(); break;
      case 'bracelet': c.strokeStyle = OUTLINE; c.lineWidth = 7; c.beginPath(); c.ellipse(0, 0, 11, 8, 0, 0, TAU); c.stroke(); c.strokeStyle = metal; c.lineWidth = 4; c.stroke(); c.fillStyle = R; c.beginPath(); c.arc(0, -8, 3, 0, TAU); c.fill(); break;
      case 'ring': c.strokeStyle = OUTLINE; c.lineWidth = 6; c.beginPath(); c.arc(0, 3, 8, 0, TAU); c.stroke(); c.strokeStyle = metal; c.lineWidth = 3; c.stroke(); c.fillStyle = R; c.beginPath(); c.arc(0, -6, 4.5, 0, TAU); c.fill(); ol(); break;
    }
  } else {
    const C = CONSUMABLES[it.key] || {};
    if (it.key === 'crystal') { c.fillStyle = '#dfe8f0'; c.beginPath(); c.moveTo(0, -12); c.lineTo(9, -2); c.lineTo(4, 12); c.lineTo(-6, 10); c.lineTo(-9, -3); c.closePath(); c.fill(); ol(); c.fillStyle = '#fff'; c.fillRect(-3, -6, 3, 6); }
    else if (it.key === 'guard') { c.fillStyle = '#e8e0c8'; c.fillRect(-10, -12, 20, 24); ol(); c.fillStyle = '#6ad0ff'; c.beginPath(); c.moveTo(0, -7); c.lineTo(7, -3); c.lineTo(5, 6); c.lineTo(0, 9); c.lineTo(-5, 6); c.lineTo(-7, -3); c.closePath(); c.fill(); ol(); }
    else if (it.key === 'coin') { c.fillStyle = '#ffd23a'; c.beginPath(); c.arc(0, 0, 11, 0, TAU); c.fill(); ol(); c.fillStyle = '#a07010'; c.font = 'bold 13px sans-serif'; c.textAlign = 'center'; c.fillText('复', 0, 5); }
    else { const z = C.size || 1; c.scale(z, z); c.fillStyle = 'rgba(220,230,240,.6)'; c.beginPath(); c.moveTo(-3, -12); c.lineTo(3, -12); c.lineTo(3, -6); c.quadraticCurveTo(10, -3, 9, 5); c.quadraticCurveTo(8, 12, 0, 12); c.quadraticCurveTo(-8, 12, -9, 5); c.quadraticCurveTo(-10, -3, -3, -6); c.closePath(); c.fill(); ol(); c.fillStyle = C.col || '#f33'; c.beginPath(); c.moveTo(-8, 2); c.quadraticCurveTo(0, -1, 8, 2); c.quadraticCurveTo(8, 11, 0, 11); c.quadraticCurveTo(-8, 11, -8, 2); c.fill(); c.fillStyle = '#8a5a30'; c.fillRect(-3, -15, 6, 4); c.fillStyle = 'rgba(255,255,255,.7)'; c.fillRect(-5, -2, 2, 6); }
  }
  c.restore();
}
const itemArtKey = it => it.kind === 'equip' ? (it.slot === 'weapon' ? `icon/w_${it.cls || 'sword'}` : `icon/${it.slot}`) : `icon/${it.key}`;
const iconUrlCache = new Map();
function itemIconURL(it, size = 96) {
  const key = (it.kind === 'equip' ? it.slot + (it.cls || '') + it.rar : it.key) + size;
  if (iconUrlCache.has(key)) return iconUrlCache.get(key);
  const [cv, c] = offCanvas(size, size);
  const g = c.createLinearGradient(0, 0, 0, size); g.addColorStop(0, '#2a2230'); g.addColorStop(1, '#140f18'); c.fillStyle = g; c.fillRect(0, 0, size, size);
  c.translate(size / 2, size / 2); drawItemIcon(c, it, size * 0.8);
  const url = cv.toDataURL(); iconUrlCache.set(key, url); return url;
}
function drawQuickItem(c, i, x, y, s) {
  const key = inv.quick[i]; if (!key) return;
  const n = inv.count(key);
  c.save(); c.translate(x + s / 2, y + s / 2); c.globalAlpha = n > 0 ? 1 : 0.3; drawItemIcon(c, { kind: 'use', key }, s * 0.85); c.restore();
  uiText(String(n), x + s - 2, y + s - 3, { size: 16, align: 'right', color: '#fff', sw: 3 });
  if (inv.potCd > 0) { c.fillStyle = 'rgba(0,0,0,.5)'; c.fillRect(x, y + s * (1 - inv.potCd), s, s * inv.potCd); }
}
