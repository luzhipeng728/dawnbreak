/* =====================================================================
   13. 投射物：剑气、飞石、箭、火球……（按 rep 间隔对同一目标多段命中）
   ===================================================================== */
const projs = [];
function spawnProj(o) {
  const p = { t: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, grav: 0, w: 10, d: 12, h: 20, life: 1, pierce: true, hitMap: new Map(), face: 1, ...o };
  p.team = o.owner.team; projs.push(p); return p;
}
function updateProjs(dt) {
  for (let i = projs.length - 1; i >= 0; i--) {
    const p = projs[i];
    if (p.owner.hitstop > 0 && p.freezeWithOwner) continue;
    p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; if (p.grav) p.vz -= p.grav * dt;
    if (p.update) p.update(p, dt);
    let dead = p.t >= p.life || (p.grav && p.z <= 0 && p.t > 0.05);
    if (p.z <= 0 && p.grav && p.onGround) p.onGround(p);
    const R = game.room; if (R && (p.x < R.x0 - 40 || p.x > R.x1 + 40)) { dead = true; p.culled = true; }
    if (!dead && p.hit) {
      const B = { x0: p.x - p.w, x1: p.x + p.w, y0: p.y - p.d, y1: p.y + p.d, z0: p.z, z1: p.z + p.h };
      for (const t of ents) {
        if (t.team === p.team || t.dead || t.invul > 0 || t.remove) continue;
        if (!overlaps(B, t)) continue;
        const last = p.hitMap.get(t.id);
        if (last !== undefined && (!p.hit.rep || p.t - last < p.hit.rep)) continue;
        p.hitMap.set(t.id, p.t);
        const fake = { x: p.x - p.face * 10, y: p.y, z: p.z, face: p.face };   // applyHit 只从 src 读取位置与朝向
        applyHit(p.owner, t, { ...p.hit, box: null }, { proj: true, src: fake });
        if (!p.pierce) { dead = true; break; }
      }
    }
    if (dead) { if (p.onEnd && !p.culled) p.onEnd(p); projs.splice(i, 1); }
  }
}
function drawProjShadows(c) { for (const p of projs) if (p.shadow) { c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.ellipse(sx(p.x), sy(p.y, 0), p.shadow, p.shadow * 0.35, 0, 0, TAU); c.fill(); } }
