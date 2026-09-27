/* =====================================================================
   16. 掉落物：金币（自动拾取）、装备 / 消耗品（站上去按 X 拾取，头顶显示品级颜色的名字，史诗有金色光柱）
   ===================================================================== */
const drops = [];
const RARITY = [
  { name: '普通', col: '#e8e8e8' }, { name: '高级', col: '#68b8ff' }, { name: '稀有', col: '#b36bff' },
  { name: '神器', col: '#ff6bd0' }, { name: '传说', col: '#ff9a2a' }, { name: '史诗', col: '#ffd23a' },
];
function spawnCoins(e, amount) {
  const n = clamp(Math.ceil(amount / 40), 1, 6);
  for (let i = 0; i < n; i++) spawnDrop({ kind: 'gold', amount: Math.ceil(amount / n), x: e.x, y: e.y, z: Math.max(e.z, 20) });
}
function spawnDrop(o) {
  const d = { t: 0, vx: rnd(-70, 70), vy: rnd(-25, 25), vz: rnd(220, 320), bounce: 0, ...o };
  d.draw = drawDrop; drops.push(d);
  if (d.item) sfx.drop(d.item.rar || 0);
  return d;
}
function updateDrops(dt) {
  const p = game.player;
  for (let i = drops.length - 1; i >= 0; i--) {
    const d = drops[i]; d.t += dt;
    if (d.z > 0 || d.vz > 0) { d.vz -= 900 * dt; d.z += d.vz * dt; d.x += d.vx * dt; d.y = clamp(d.y + d.vy * dt, 6, DEPTH - 6); if (d.z <= 0) { d.z = 0; if (d.bounce++ < 1) { d.vz = 120; d.vx *= 0.4; } else { d.vz = 0; d.vx = 0; d.vy = 0; } } }
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
function tryPickup(p) {
  let best = null, bd = 99;
  for (const d of drops) if (d.kind !== 'gold' && d.t > 0.45) { const dd = Math.abs(p.x - d.x) + Math.abs(p.y - d.y); if (dd < 30 && dd < bd) { bd = dd; best = d; } }
  if (!best) return false;
  if (!inv.add(best.item)) { toastMsg('背包已满'); return false; }
  drops.splice(drops.indexOf(best), 1); sfx.pickup(); bus.emit('pickup', { item: best.item });
  toastMsg(`获得 ${best.item.name}`, RARITY[best.item.rar || 0].col);
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
  if ((it.rar || 0) >= 5) {   // 史诗光柱
    c.save(); c.globalCompositeOperation = 'lighter';
    const g = c.createLinearGradient(0, Y - 220, 0, Y); g.addColorStop(0, 'rgba(255,210,60,0)'); g.addColorStop(0.7, 'rgba(255,210,60,.35)'); g.addColorStop(1, 'rgba(255,240,160,.8)');
    c.fillStyle = g; const w = 10 + Math.sin(d.t * 4) * 2; c.fillRect(X - w / 2, Y - 220, w, 220);
    c.restore();
  } else if ((it.rar || 0) >= 2) {
    c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = shade(R.col, 0, 0.25 + 0.1 * Math.sin(d.t * 5)); c.beginPath(); c.ellipse(X, Y - 2, 12, 4, 0, 0, TAU); c.fill(); c.restore();
  }
  c.save(); c.translate(X, Y - 6 - Math.abs(Math.sin(d.t * 3)) * 2); drawItemIcon(c, it, 14); c.restore();
  if (d.near || (it.rar || 0) >= 3 || input.is('confirm')) {
    c.font = 'bold 9px "PingFang SC","Microsoft YaHei",sans-serif'; c.textAlign = 'center'; c.lineWidth = 3; c.strokeStyle = '#000'; c.strokeText(it.name, X, Y - 20); c.fillStyle = R.col; c.fillText(it.name, X, Y - 20);
  }
}
let toastList = [];
function toastMsg(msg, col = '#fff') { toastList.push({ msg, col, t: 0 }); if (toastList.length > 5) toastList.shift(); }
