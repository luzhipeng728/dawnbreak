/* =====================================================================
   16. 掉落物：金币（自动拾取）、装备 / 消耗品（站上去按 X 拾取，头顶显示品级颜色的名字，史诗有金色光柱）
   掉落表：按地下城等级与难度随机；领主有专属掉落（content/items/droptables.js 的 defineDropTable）
   ===================================================================== */
const drops = [];
// 品级颜色（官方）：普通白、高级蓝、稀有紫、神器粉、传说橙、史诗金
const RARITY = [
  { name: '普通', col: '#ffffff' }, { name: '高级', col: '#68d5ed' }, { name: '稀有', col: '#b36bff' },
  { name: '神器', col: '#ff55ff' }, { name: '传说', col: '#ff7800' }, { name: '史诗', col: '#ffb400' },
];
const DROP_TABLES = {};
// defineDropTable(地下城 id, { boss: [[物品 key, 几率, 数量?]...], mats: [[key, 几率, 数量]...], epics: [key...] })
function defineDropTable(id, def) { DROP_TABLES[id] = { boss: [], mats: [], ...def }; }
function rollRarity(bonus = 0, boss = false) {
  const w = [50, 30, 13 + bonus * 20, 4.5 + bonus * 10, 1.2 + bonus * 4 + (boss ? 1.5 : 0), 0.25 + bonus * 1.5 + (boss ? 0.8 : 0)];
  let r = Math.random() * w.reduce((a, b) => a + b, 0); for (let i = 0; i < w.length; i++) { r -= w[i]; if (r <= 0) return i; } return 0;
}
// 掉落装备的等级：地下城推荐等级段内随机（不会高于玩家太多，否则穿不上）
const dropLvl = (t, dg) => { const L = dg ? dg.def.lvl : [t.lvl, t.lvl]; return clamp(rndi(L[0], L[1] + (t.boss ? 1 : 0)), 1, Math.max(L[1] + 1, game.lvl + 2)); };
// 随机一件史诗：等级 ≤ lvl + 3；只出本职业武器；深渊专属（abyss: true）的只在深渊派对里出（opt.abyss）
// opt：{ abyss（深渊派对：可出深渊专属，且偏向接近 lvl 的）, lo（最低等级） }
function rollEpic(lvl, opt = {}) {
  const cls = game.player ? game.player.cls : 'sword';
  const pool = EPICS.filter(E => { const D = ITEMS[E.key]; return D && E.lvl <= lvl + 3 && E.lvl >= (opt.lo || 0) && (!E.cls || E.cls === cls) && !D.noDrop && (opt.abyss || !D.abyss); });
  if (!pool.length) return null;
  // 越接近目标等级越容易出（深渊派对里更集中）
  const w = pool.map(E => 1 / (1 + Math.abs(lvl - E.lvl) * (opt.abyss ? 0.18 : 0.08)));
  let r = Math.random() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < pool.length; i++) { r -= w[i]; if (r <= 0) return makeItem(pool[i].key); }
  return makeItem(pool[0].key);
}
// 商城组的史诗自选礼盒用：单件史诗（不含套装部件、深渊专属），等级 ≤ lvl + 3，武器只列本职业
function epicChoiceKeys(lvl = game.lvl, cls = game.player ? game.player.cls : 'sword') {
  return EPICS.filter(E => { const D = ITEMS[E.key]; return D && !D.set && !D.abyss && !D.noDrop && E.lvl <= lvl + 3 && (!E.cls || E.cls === cls); }).map(E => E.key);
}
// 没配掉落表的地下城（新加的地下城）：按推荐等级自动生成——等级段内的套装部件和史诗，领主小几率掉落
function autoDropTable(def) {
  if (DROP_TABLES[def.id]) return DROP_TABLES[def.id];
  const lo = def.lvl[0] - 2, hi = def.lvl[1] + 3, boss = [];
  for (const D of GEAR) if (D.lvl >= lo && D.lvl <= hi && !D.noDrop && (D.set || D.rar === 5)) boss.push([D.key, D.rar === 5 ? 0.008 : 0.025]);
  const lv = def.lvl[1];
  defineDropTable(def.id, { boss, mats: [['crystal', 0.07, 3 + Math.floor(lv / 5)], [lv >= 12 ? 'm_elem' : 'm_iron', 0.015, 1], [pick(['c_red', 'c_blue', 'c_white', 'c_black']), 0.02, 1]], auto: true });
  return DROP_TABLES[def.id];
}
function rollDrop(t, dg) {
  const bonus = dg ? dg.D.drop : 0, T = dg && autoDropTable(dg.def);
  const n = t.boss ? 2 + (Math.random() < 0.5 ? 1 : 0) : t.elite ? (Math.random() < 0.6 ? 1 : 0) : (Math.random() < 0.07 ? 1 : 0);
  for (let i = 0; i < n; i++) {
    const rar = rollRarity(bonus, t.boss), lvl = dropLvl(t, dg);
    const it = rar === 5 ? rollEpic(lvl) || rollEquip({ lvl, rar: 4 }) : rollEquip({ lvl, rar });
    if (it) spawnDrop({ kind: 'item', item: it, x: t.x, y: t.y, z: Math.max(t.z, 20) });
  }
  // 领主专属掉落（套装部件、专属首饰、史诗等）
  if (t.boss && T) for (const [key, p, cnt] of T.boss) if (Math.random() < p * (1 + bonus * 2)) { const it = makeItem(key, cnt || 1); if (it) spawnDrop({ kind: 'item', item: it, x: t.x + rnd(-20, 20), y: t.y, z: 30 }); }
  // 材料 / 消耗品
  if (Math.random() < (t.boss ? 1 : t.elite ? 0.3 : 0.06)) spawnDrop({ kind: 'item', item: makeItem(pick(['hpS', 'mpS', 'hpM', 'crystal']), t.boss ? 3 : 1), x: t.x, y: t.y, z: 20 });
  if (T) for (const [key, p, cnt] of T.mats) if (Math.random() < p * (t.boss ? 4 : t.elite ? 2 : 1)) { const it = makeItem(key, cnt || 1); if (it) spawnDrop({ kind: 'item', item: it, x: t.x, y: t.y, z: 20 }); }
  // 装备深化：深渊派对邀请函、怪物卡片、深渊派对的史诗（content/abyss.js）
  if (typeof abyssExtraDrops === 'function') abyssExtraDrops(t, dg);
}
// 翻牌奖励（结算界面）：gold = 黄金卡牌。返回 { gold } 或 { item }
function rollCardReward(dg, gold) {
  const r = Math.random(), lv = dg.def.lvl[1];
  if (r < 0.4) return { gold: Math.round((80 + lv * 45) * (1 + dg.diff * 0.5) * rnd(0.8, 1.6) * (gold ? 2.5 : 1)) };
  if (r < 0.65) return { item: makeItem(pick(['hpM', 'mpM', 'crystal', 'crystal', 'elixir', 'fatigue']), pick([1, 2, 3, 5])) };
  const rar = Math.max(1, Math.min(5, rollRarity(0.15 + dg.D.drop + (gold ? 0.25 : 0), gold)));
  return { item: (rar === 5 && rollEpic(lv)) || rollEquip({ lvl: rndi(dg.def.lvl[0], lv), rar: Math.min(rar, 4) }) || makeItem('crystal', 5) };
}
function spawnCoins(e, amount) {
  const p = game.player; amount = Math.round(amount * (1 + (p && p.goldUp || 0)));
  const n = clamp(Math.ceil(amount / 40), 1, 6);
  for (let i = 0; i < n; i++) spawnDrop({ kind: 'gold', amount: Math.ceil(amount / n), x: e.x, y: e.y, z: Math.max(e.z, 20) });
}
function spawnDrop(o) {
  const d = { t: 0, vx: rnd(-70, 70), vy: rnd(-25, 25), vz: rnd(220, 320), bounce: 0, landT: null, ...o };
  d.draw = drawDrop; drops.push(d);
  if (d.item) { const r = d.item.rar || 0; if (r >= 5) { sfx.tone('triangle', 1200, 1800, 0.12, 0.08); const dg = game.dungeon; bus.emit('epicDrop', { item: d.item, dungeon: dg && dg.def.id, abyss: !!(dg && dg.def.abyss) }); } else sfx.drop(r); }
  return d;
}
function updateDrops(dt) {
  const p = game.player;
  for (let i = drops.length - 1; i >= 0; i--) {
    const d = drops[i]; d.t += dt;
    if (d.z > 0 || d.vz > 0) { d.vz -= 900 * dt; d.z += d.vz * dt; d.x += d.vx * dt; d.y = clamp(d.y + d.vy * dt, 6, DEPTH - 6); if (d.z <= 0) { d.z = 0; if (d.landT == null) dropLanded(d); if (d.bounce++ < 1) { d.vz = 120; d.vx *= 0.4; } else { d.vz = 0; d.vx = 0; d.vy = 0; } } }
    const R = game.room; if (R) d.x = clamp(d.x, R.x0 + 10, R.x1 - 10);
    if (!p || p.dead || d.t < 0.45) continue;
    const near = Math.abs(p.x - d.x) < 20 && Math.abs(p.y - d.y) < 14 && p.z < 20;
    if (d.kind === 'gold' && (near || (game.autoLoot && d.t > 0.8))) {
      if (!near) { d.x = damp(d.x, p.x, 10, dt); d.y = damp(d.y, p.y, 10, dt); if (Math.abs(p.x - d.x) > 20) continue; }
      game.gold += d.amount; bus.emit('gold', { n: d.amount }); sfx.coin(); addNumber(d.amount, p.x, p.y, p.z + 10, { col: '#ffd24a' }); drops.splice(i, 1); continue;
    }
    d.near = near;
  }
}
// 第一次落地：史诗立起光柱并播放专属音效，传说是橙色的小光柱
function dropLanded(d) {
  d.landT = game.t;
  const r = d.item ? d.item.rar || 0 : 0;
  if (r >= 5) { gearSfx.epicDrop(); cam.shake = Math.max(cam.shake, 3); toastMsg(`史诗装备 ${d.item.name} 掉落了！`, RARITY[5].col); }
  else if (r === 4) gearSfx.legendDrop();
}
function tryPickup(p) {
  let best = null, bd = 99;
  for (const d of drops) if (d.kind !== 'gold' && d.t > 0.45) { const dd = Math.abs(p.x - d.x) + Math.abs(p.y - d.y); if (dd < 30 && dd < bd) { bd = dd; best = d; } }
  if (!best) return false;
  if (!inv.add(best.item)) { toastMsg('背包已满', '#ff6a6a'); return false; }
  drops.splice(drops.indexOf(best), 1); sfx.pickup(); bus.emit('pickup', { item: best.item });
  toastMsg(`获得 ${best.item.name}${best.item.n > 1 ? ' ×' + best.item.n : ''}`, RARITY[best.item.rar || 0].col);
  if ((best.item.rar || 0) >= 5) {
    sfx.epic();
    const dg = game.dungeon; bus.emit('announce', { kind: 'epic', item: best.item, dungeon: dg ? dg.def.id : null, abyss: !!(best.abyss || (dg && dg.def.abyss)) });   // 全服公告（社交组广播）
  }
  return true;
}
function drawDropShadows(c) { for (const d of drops) { c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.ellipse(sx(d.x), sy(d.y, 0), 7, 2.5, 0, 0, TAU); c.fill(); } }
function drawDrop(c) {
  const d = this, X = sx(d.x), Y = sy(d.y, d.z);
  if (d.kind === 'gold') {
    const s = Math.abs(Math.sin(d.t * 6)) * 4 + 1;
    c.fillStyle = '#8a5a10'; c.beginPath(); c.ellipse(X, Y - 4, s + 0.8, 4.8, 0, 0, TAU); c.fill();
    c.fillStyle = '#ffd24a'; c.beginPath(); c.ellipse(X, Y - 4, s, 4, 0, 0, TAU); c.fill();
    c.fillStyle = '#fff6c0'; c.fillRect(X - 1, Y - 7, 1, 2);
    return;
  }
  const it = d.item, R = RARITY[it.rar || 0];
  if ((it.kind === 'equip' && (it.rar || 0) >= 4) || d.abyss) drawDropPillar(c, d, sx(d.x), sy(d.y, 0));   // 史诗金色光柱 / 传说橙色光柱（game/gear_fx.js）
  else if ((it.rar || 0) >= 2) {
    c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = shade(R.col, 0, 0.25 + 0.1 * Math.sin(d.t * 5)); c.beginPath(); c.ellipse(X, Y - 2, 12, 4, 0, 0, TAU); c.fill(); c.restore();
  }
  c.save(); c.translate(X, Y - 6 - Math.abs(Math.sin(d.t * 3)) * 2); drawItemIcon(c, it, 14); c.restore();
  const showNames = typeof uiPref === 'function' ? uiPref('dropNames') : false;
  if (d.near || (it.rar || 0) >= 3 || showNames || input.is('confirm')) {
    const txt = it.name + (it.n > 1 ? ` ×${it.n}` : '');
    c.font = 'bold 9px "PingFang SC","Microsoft YaHei",sans-serif'; c.textAlign = 'center'; c.lineWidth = 3; c.strokeStyle = '#000'; c.strokeText(txt, X, Y - 20); c.fillStyle = R.col; c.fillText(txt, X, Y - 20);
  }
}
let toastList = [];
function toastMsg(msg, col = '#fff') { toastList.push({ msg, col, t: 0 }); if (toastList.length > 5) toastList.shift(); }
