/* =====================================================================
   13. 投射物：剑气、子弹、飞石、火球……（按 rep 间隔对同一目标多段命中，max 限制次数）
   生成时记下发射者当前动作的伤害类型 / 属性 / 蓄力倍率（动作结束后投射物仍按发射时的数值结算）
   ===================================================================== */
const projs = [];
function spawnProj(o) {
  const p = { t: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, grav: 0, w: 10, d: 12, h: 20, life: 1, pierce: true, hitMap: new Map(), face: 1, ...o };
  const own = o.owner, act = own.act;
  p.team = own.team;
  if (p.hit) {
    if (!p.hit.type) p.hit.type = (act && act.type) || own.dmgType || 'phys';
    if (!p.hit.elem && act && act.elem) p.hit.elem = act.elem;
    p.mul = p.mul || (act && act.dmgMul) || 1;
  }
  projs.push(p); return p;
}
function updateProjs(dt) {
  for (let i = projs.length - 1; i >= 0; i--) {
    const p = projs[i]; if (!p) continue;   // 回调在遍历中删掉了投射物（例如领主死亡清场）
    if (p.owner.hitstop > 0 && p.freezeWithOwner) continue;
    p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; if (p.grav) p.vz -= p.grav * dt;
    if (p.update) p.update(p, dt);
    let dead = p.t >= p.life || (p.grav && p.z <= 0 && p.t > 0.05);
    if (p.z <= 0 && p.grav && p.onGround) p.onGround(p);
    const R = game.room; if (R && (p.x < R.x0 - 40 || p.x > R.x1 + 40)) { dead = true; p.culled = true; }
    if (!dead && p.hit) {
      const B = { x0: p.x - p.w, x1: p.x + p.w, y0: p.y - p.d, y1: p.y + p.d, z0: p.z, z1: p.z + p.h };
      for (const t of ents) {
        if (t.team === p.team || !canHit(p.owner, t, p.hit) || !overlaps(B, t)) continue;
        const last = p.hitMap.get(t.id);
        if (last !== undefined && (!p.hit.rep || p.t - last < p.hit.rep)) continue;
        if (p.hit.max) { const n = p.hitMap.get(-t.id) || 0; if (n >= p.hit.max) continue; p.hitMap.set(-t.id, n + 1); }
        p.hitMap.set(t.id, p.t);
        const fake = { x: p.x - p.face * 10, y: p.y, z: p.z, face: p.face };   // applyHit 只从 src 读取位置与朝向
        applyHit(p.owner, t, p.hitBox ? p.hit : { ...p.hit, box: null }, { proj: true, src: fake, mul: p.mul, srcProj: p });
        if (p.onHitT) p.onHitT(p, t);
        if (!p.pierce) { dead = true; break; }
      }
    }
    if (dead) { if (p.onEnd && !p.culled) p.onEnd(p); const j = projs.indexOf(p); if (j >= 0) projs.splice(j, 1); }
  }
}
function drawProjShadows(c) { for (const p of projs) if (p.shadow) { c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.ellipse(sx(p.x), sy(p.y, 0), p.shadow, p.shadow * 0.35, 0, 0, TAU); c.fill(); } }
// 抵消投射物（阿修罗 鬼印珠“飞行中抵消远程攻击”）：删掉和盒子 B 重叠的敌方投射物，不触发它们的 onEnd（爆炸 / 分裂）；
// 太大的（激光 / 光柱这类 w > maxW）和写了 noErase 的不算；fn(q) 在删掉前调（画火花）；返回删掉的个数
function eraseProjs(team, B, fn, maxW = 48) {
  let n = 0;
  for (const q of projs) {
    if (!q || q.team === team || !q.hit || q.noErase || q.w > maxW || q.t >= q.life) continue;
    if (q.x + q.w < B.x0 || q.x - q.w > B.x1 || q.y + q.d < B.y0 || q.y - q.d > B.y1 || q.z + q.h < B.z0 || q.z > B.z1) continue;
    if (fn) fn(q);
    q.hit = null; q.culled = true; q.t = q.life; n++;
  }
  return n;
}
