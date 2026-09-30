/* =====================================================================
   装备好坏对比：背包 / 商店里的装备直接标出比身上的好还是差（▲ 更好 / ▼ 更差 / = 差不多 / × 不能用）
   做法：把这件装备“模拟穿上”，用真实的 recalcStats 算出换上后的属性（套装件数、防具精通、耐久失效都自动算进去），
   再按角色主要伤害类型估算「输出」和「生存」，综合分 = 输出^0.7 × 生存^0.3，和当前装备比较。
   模拟用的是影子实体 Object.create(player)，只写在影子上，不会改动玩家的真实状态。
   ===================================================================== */
addStyle(`
.islot .cmp{position:absolute;left:.1em;bottom:.1em;min-width:1.05em;height:1.05em;display:grid;place-items:center;font-size:.8em;font-weight:900;pointer-events:none;line-height:1;background:rgba(8,6,10,.78);border-radius:.25em;box-shadow:0 0 .15em #000}
.islot .cmp.up{color:#5dff6a}.islot .cmp.down{color:#ff5a5a}.islot .cmp.same{color:#c8c0a8}.islot .cmp.na{color:#ff5a5a}
.islot.better{border-color:#4fbf5c;box-shadow:inset 0 0 .5em rgba(90,255,110,.25)}
.itip .cmpsum{font-weight:900;font-size:.95em;margin-bottom:.15em}
.itip .cmpsum .setd{font-weight:800;font-size:.86em}
/* 套装：绿色边框 + 右上角件数；套装效果生效中的部件有流光；悬停时同套部件一起高亮 */
.islot.set{border-color:#5fbf3a}
.islot.seton{border-color:var(--qset);animation:iseton 2.2s ease-in-out infinite}
@keyframes iseton{0%,100%{box-shadow:inset 0 0 .35em rgba(140,255,90,.35),0 0 .25em rgba(140,255,90,.35)}50%{box-shadow:inset 0 0 .6em rgba(140,255,90,.6),0 0 .6em rgba(140,255,90,.7)}}
.islot .settag{position:absolute;right:.08em;top:.06em;font-size:.6em;font-weight:900;color:var(--qset);background:rgba(8,6,10,.78);border-radius:.25em;padding:0 .2em;line-height:1.35;pointer-events:none;box-shadow:0 0 .15em #000}
.islot.sethl{outline:.16em solid var(--qset);outline-offset:-.02em;z-index:1}

.itip .cmpsum .d{font-weight:600;font-size:.86em;color:#b8ac90}
`);
// 角色的主要伤害类型：按已学技能（当前转职可用的）的等级加权统计，物理 / 魔法 / 独立里最多的那种
function mainDmgType(p) {
  const w = {};
  for (const id in game.skillLv) {
    const lv = game.skillLv[id], S = SKILLS[id];
    if (!lv || !S || S.passive || (S.job && S.job !== game.job)) continue;
    const t = S.type || p.dmgType || 'phys'; w[t] = (w[t] || 0) + lv;
  }
  let best = p.dmgType || 'phys', bv = 0;
  for (const t in w) if (w[t] > bv) { bv = w[t]; best = t; }
  return best;
}
// 用当前 inv.equip 算影子实体的「输出」与「有效生命」
function gearMetrics(p, type) {
  const q = Object.create(p); recalcStats(q);
  let atk = type === 'mag' ? q.matk : type === 'indep' ? q.indep : q.baseStats.atk;
  let crit = clamp(type === 'mag' ? q.mcrit : q.crit, 0, 1); const spd = type === 'mag' ? q.cspd : q.aspd;
  // 街霸「邪功修炼」（fighter_brawler.js 每帧按面板算）：力量 / 智力、物理 / 魔法暴击取高——对比装备时也按取高算，不然重甲精通的力量、偏力量的武器在街霸身上显示成没用
  if (type === 'mag' && typeof hasSkill === 'function' && hasSkill(p, 'fb_overstrain')) { if (q.str > q.int) atk *= (1 + q.str * 0.004) / (1 + q.int * 0.004); crit = clamp(Math.max(q.mcrit, q.crit), 0, 1); }
  const el = q.elem || {}, elemBonus = q.atkElem ? (el[q.atkElem] || 0) / 220 : Math.max(0, el.fire || 0, el.ice || 0, el.light || 0, el.dark || 0) / 220 * 0.3;
  const off = atk * (1 + crit * (q.critDmg - 1)) * (1 + (q.dmgUp || 0)) * (0.6 + 0.4 * spd) * (1 + elemBonus);
  const dr = (q.def / (q.def + 1200) + q.mdef / (q.mdef + 1200)) / 2;   // 与伤害结算一致：减伤 = 防御 / (防御 + 1200)，物理魔法各半
  const ehp = q.hpMax / Math.max(0.05, (1 - dr) * (q.dmgTaken || 1));
  return { off, ehp, sets: q.sets || [] };
}
const CMP = { sig: null, type: null, base: null, map: new Map() };
const itemSigOf = it => it ? `${it.id}:${it.enh || 0}:${itemActive(it) ? 1 : 0}` : '-';
// 返回 { v: 'up'|'down'|'same'|'na'|'worn', total, off, ehp, why }；非装备返回 null
function equipCompare(it) {
  const p = game.player;
  if (!p || !it || it.kind !== 'equip' || !SLOTS.includes(it.slot)) return null;
  if (inv.equip[it.slot] === it) return { v: 'worn' };
  if (it.slot === 'weapon' && it.cls && it.cls !== p.cls) return { v: 'na', why: `${CLASSES[it.cls] ? CLASSES[it.cls].name : ''}专用武器，当前职业不能使用` };
  if (it.slot === 'weapon' && !wtypeJobOk(it.wtype, game.job)) return { v: 'na', why: `${wtypeJobText(it.wtype)}专用武器，当前转职不能使用` };
  const sig = [game.lvl, game.job, save.data && save.data.weak > Date.now() ? 1 : 0, ...SLOTS.map(s => itemSigOf(inv.equip[s]))].join('|');
  if (CMP.sig !== sig) { CMP.sig = sig; CMP.map.clear(); CMP.type = mainDmgType(p); CMP.base = gearMetrics(p, CMP.type); }
  const key = itemSigOf(it); let r = CMP.map.get(key); if (r) return r;
  const slot = it.slot, old = inv.equip[slot];
  inv.equip[slot] = it;
  let m; try { m = gearMetrics(p, CMP.type); } finally { if (old) inv.equip[slot] = old; else delete inv.equip[slot]; }
  const B = CMP.base, off = m.off / B.off - 1, ehp = m.ehp / B.ehp - 1;
  const total = Math.pow(m.off / B.off, 0.7) * Math.pow(m.ehp / B.ehp, 0.3) - 1;
  // 套装效果变化：换上后新激活 / 失去了哪些件数档
  const tiers = sets => { const o = new Set(); for (const x of sets) for (const n of x.on) o.add(x.id + ':' + n); return o; };
  const t0 = tiers(B.sets), t1 = tiers(m.sets), nm = k => { const [id, n] = k.split(':'); return `${(SETS[id] || {}).name || id} ${n} 件套`; };
  const gained = [...t1].filter(k => !t0.has(k)).map(nm), lost = [...t0].filter(k => !t1.has(k)).map(nm);
  r = { v: total > 0.003 ? 'up' : total < -0.003 ? 'down' : 'same', total, off, ehp, empty: !old, broken: !itemActive(it), gained, lost };
  CMP.map.set(key, r); return r;
}
// 格子角标
function equipCompareBadge(it) {
  const r = equipCompare(it); if (!r || r.v === 'worn') return null;
  const txt = { up: '▲', down: '▼', same: '=', na: '×' }[r.v];
  return h('span', { class: 'cmp ' + r.v }, txt);
}
// tooltip 顶部的一行总结
function equipCompareTip(it) {
  const r = equipCompare(it); if (!r || r.v === 'worn') return null;
  if (r.v === 'na') return h('div', { class: 'cmpsum bad' }, '× ' + r.why);
  const pct = x => `${x >= 0 ? '+' : ''}${(x * 100).toFixed(1)}%`;
  const col = r.v === 'up' ? 'good' : r.v === 'down' ? 'bad' : 'dimt';
  const head = r.broken ? '耐久为 0，换上后没有属性' : r.empty ? '该部位还没穿装备 · 换上后综合' : `换上后综合 ${r.v === 'up' ? '▲' : r.v === 'down' ? '▼' : '≈'}`;
  return h('div', { class: 'cmpsum ' + col }, head, r.broken ? null : ` ${pct(r.total)}`,
    h('div', { class: 'd' }, `输出 ${pct(r.off)} · 生存 ${pct(r.ehp)}${it.lvl > game.lvl ? `（需要 Lv.${it.lvl}）` : ''}`),
    r.gained && r.gained.length ? h('div', { class: 'setd good' }, '激活：' + r.gained.join('、')) : null,
    r.lost && r.lost.length ? h('div', { class: 'setd bad' }, '失去：' + r.lost.join('、')) : null);
}
// 套装装饰：绿框 + 角标。身上的部件显示“已穿件数 / 总件数”，套装效果生效时加流光；背包里的部件显示“套”
function equippedSetCount(setId, eq = inv.equip) { let n = 0; for (const s of SLOTS) { const x = eq[s]; if (x && x.slot === s && x.set === setId && itemActive(x)) n++; } return n; }
function setSlotDecor(el, it, worn, eq) {
  const S = it && it.set && SETS[it.set]; if (!S) return;
  el.classList.add('set'); el.dataset.set = it.set;
  if (worn) {
    const n = equippedSetCount(it.set, eq), min = Math.min(...Object.keys(S.bonus).map(Number));
    if (n >= min && itemActive(it)) el.classList.add('seton');
    el.append(h('span', { class: 'settag' }, `${n}/${S.pieces.length}`));
    // 悬停时同一套的其他部件一起高亮
    el.addEventListener('mouseenter', () => { const box = el.closest('.doll'); if (box) box.querySelectorAll(`[data-set="${it.set}"]`).forEach(x => x.classList.add('sethl')); });
    el.addEventListener('mouseleave', () => { const box = el.closest('.doll'); if (box) box.querySelectorAll('.sethl').forEach(x => x.classList.remove('sethl')); });
  } else el.append(h('span', { class: 'settag' }, '套'));
}
