/* =====================================================================
   宠物跟随 / 脚下光环 / 天空套 8 件光效（商城组）
   - 以 fx 对象的形式插进 fxList（城镇、地下城、决斗场都会按纵深排序画出来）；换房间 / 换场景清空 fxList 后下一帧自动补回
   - 宠物：art/final/pet/<id>_<0..3>.webp（0、1 待机，2、3 移动；朝右），跟在角色身后，地面宠物移动时蹦跳，飞行宠物上下浮动
   - 光环：art/final/aura/<id>.webp（俯视的魔法阵），压扁后慢慢旋转画在脚下，再加几颗上升的光点
   - 性能（ARCHITECTURE 绘制规范）：不用 filter / shadowBlur / 高级混合；宠物 1 次 drawImage，光环 2 次，粒子是小圆点
   - 联机：cashLook(equip) → { pet, aura, sky8 }；其他玩家的实体调用 cashAttach(ent, look) 就会画出宠物和光环（look 传 null 取消）
   ===================================================================== */
// 从装备栏算商城外观（宠物 / 光环 / 天空 8 件套）
function cashLook(eq) {
  eq = eq || {};
  const P = eq.av_pet && ITEMS[eq.av_pet.key], A = eq.av_aura && ITEMS[eq.av_aura.key];
  let sky8 = null;
  for (const set of CASH_SKY_SETS) { let n = 0; for (const s of AV_PIECE_SLOTS) { const it = eq[s]; if (it && it.set === set) n++; } if (n >= 8) sky8 = set; }
  return { pet: P && P.pet || null, aura: A && A.aura || null, sky8 };
}
const cashAttached = new Map();   // 其他实体（联机玩家 / 预览）→ look
function cashAttach(ent, look) { if (look && (look.pet || look.aura || look.sky8)) cashAttached.set(ent, look); else { cashDetach(ent); } }
function cashDetach(ent) { const C = ent && ent._cash; if (C) for (const k of ['petFx', 'auraFx', 'glowFx']) { const i = fxList.indexOf(C[k]); if (i >= 0) fxList.splice(i, 1); } cashAttached.delete(ent); if (ent) ent._cash = null; }
let cashPlayerLook = null, cashLookDirty = true;
for (const ev of ['equip', 'unequip', 'charLeave', 'sceneEnter', 'dungeonEnter']) bus.on(ev, () => { cashLookDirty = true; });
// 每个逻辑步更新（包装 updateFx：城镇 / 地下城 / 决斗场都会调用）
{ const uf0 = updateFx; updateFx = function (dt) { uf0(dt); try { cashFxTick(dt); } catch (e) { console.error('宠物 / 光环', e); } }; }
function cashFxTick(dt) {
  const p = game.player, ok = p && (game.scene === 'town' || game.scene === 'dungeon' || game.scene === 'test');
  if (ok) {
    if (cashLookDirty || !cashPlayerLook) { inv.ensure(); cashPlayerLook = cashLook(inv.equip); cashLookDirty = false; }
    cashEntTick(p, cashPlayerLook, dt);
  }
  for (const [e, L] of cashAttached) { if (e.remove || (typeof ents !== 'undefined' && !ents.includes(e) && !(world && world.crowd && world.crowd.includes(e)))) { cashDetach(e); continue; } cashEntTick(e, L, dt); }
}
function cashEntTick(e, L, dt) {
  const C = e._cash || (e._cash = { t: Math.random() * 10, pet: null, parts: [], spawn: 0 });
  C.t += dt;
  const keep = (k, want, make) => {
    if (want) { if (!C[k]) C[k] = make(); if (!fxList.includes(C[k])) fxList.push(C[k]); }
    else if (C[k]) { const i = fxList.indexOf(C[k]); if (i >= 0) fxList.splice(i, 1); C[k] = null; }
  };
  // 宠物
  keep('petFx', L.pet, () => ({ t: 0, dur: Infinity, y: e.y, draw(c) { cashDrawPet(c, e); } }));
  if (L.pet) {
    if (!C.pet || C.pet.id !== L.pet || C.pet.room !== game.room) C.pet = { id: L.pet, room: game.room, x: e.x - e.face * 60, y: e.y - 6, z: 0, face: e.face || 1, mv: 0 };
    const S = C.pet, P = PETS[S.id] || {}, tx = e.x - (e.face || 1) * 58, ty = e.y - 8, dx = tx - S.x, dy = ty - S.y, d = Math.hypot(dx, dy);
    if (d > 520) { S.x = tx; S.y = ty; }
    else if (d > 12) { const sp = Math.min(d * 4, 560) * dt; S.x += dx / d * Math.min(sp, d); S.y += dy / d * Math.min(sp, d) * 0.85; }
    const moving = d > 18;
    S.mv += ((moving ? 1 : 0) - S.mv) * Math.min(1, dt * 8);
    if (Math.abs(dx) > 8) S.face = dx > 0 ? 1 : -1; else if (!moving) S.face = e.face || S.face;
    S.z = P.fly ? 34 + Math.sin(C.t * 3) * 6 : S.mv > 0.5 ? Math.abs(Math.sin(C.t * 11)) * 9 : 0;
    C.petFx.y = S.y;
  }
  // 光环（画在角色正后方：同一纵深再靠后一点）
  keep('auraFx', L.aura, () => ({ t: 0, dur: Infinity, y: e.y, draw(c) { cashDrawAura(c, e, L.aura || (e._cash && e._cash.aura)); } }));
  if (L.aura) { C.aura = L.aura; C.auraFx.y = e.y - 0.5; }
  // 天空 8 件套：身上的光粒子
  keep('glowFx', L.sky8, () => ({ t: 0, dur: Infinity, y: e.y, draw(c) { cashDrawGlow(c, e); } }));
  if (L.sky8) {
    C.sky8 = L.sky8; C.glowFx.y = e.y + 0.5;
    const sky2 = L.sky8 === 'av_sky2';
    if ((C.spawn -= dt) <= 0 && C.parts.length < 16) {
      C.spawn = sky2 ? 0.09 : 0.12;
      const feather = !sky2 && Math.random() < 0.25;
      C.parts.push(feather ? { x: rnd(-34, 34), z: rnd(100, 130), vx: rnd(-8, 8), vz: -rnd(14, 22), life: 2.4, t: 0, kind: 1, rot: rnd(0, TAU) }
        : sky2 ? { x: rnd(-22, 22), z: rnd(0, 20), vx: rnd(-6, 6), vz: rnd(40, 70), life: rnd(1, 1.6), t: 0, kind: 2, g: rndi(60, 170) }
          : { x: rnd(-26, 26), z: rnd(10, 110), vx: 0, vz: rnd(8, 18), life: rnd(0.8, 1.4), t: 0, kind: 0 });
    }
    for (let i = C.parts.length - 1; i >= 0; i--) { const q = C.parts[i]; q.t += dt; q.x += q.vx * dt + (q.kind === 1 ? Math.sin(q.t * 3) * 14 * dt : 0); q.z += q.vz * dt; if (q.t >= q.life) C.parts.splice(i, 1); }
  } else if (C.parts.length) C.parts.length = 0;
}
/* ---- 绘制 ---- */
// 宠物帧：0、1 待机（交替很慢，像呼吸眨眼），2、3 移动
function cashPetFrame(id, moving, t) {
  const f = moving ? (Math.floor(t * 8) % 2 ? 3 : 2) : (t % 3 < 0.25 ? 1 : 0);
  return IMG[`pet/${id}_${f}`] || IMG[`pet/${id}_0`] || null;
}
function cashDrawPetAt(c, id, X, Y, z, face, moving, t, k = 1) {
  const P = PETS[id] || { h: 44, col: '#fff' }, im = cashPetFrame(id, moving, t), h = P.h * k;
  const sh = 1 / (1 + z / 90);
  c.fillStyle = `rgba(0,0,0,${0.28 * sh})`; c.beginPath(); c.ellipse(X, Y, h * 0.36 * sh, h * 0.1 * sh, 0, 0, TAU); c.fill();
  const breathe = moving ? 1 : 1 + Math.sin(t * 2.6) * 0.025;
  c.save(); c.translate(X, Y - z); c.scale(face, breathe);
  if (im) { const w = im.width * h / im.height; c.drawImage(im, -w / 2, -h, w, h); }
  else {   // 没有美术时的兜底：圆滚滚的小团子
    c.fillStyle = P.col; c.strokeStyle = '#2a1a18'; c.lineWidth = 2; c.beginPath(); c.ellipse(0, -h * 0.42, h * 0.42, h * 0.4, 0, 0, TAU); c.fill(); c.stroke();
    c.fillStyle = '#2a1a18'; c.beginPath(); c.arc(h * 0.18, -h * 0.5, h * 0.06, 0, TAU); c.fill();
  }
  c.restore();
}
function cashDrawPet(c, e) {
  const C = e._cash, S = C && C.pet; if (!S) return;
  const X = sx(S.x); if (X < -80 || X > WW + 80) return;
  cashDrawPetAt(c, S.id, X, sy(S.y, 0), S.z, S.face, S.mv > 0.5, C.t);
}
function cashDrawAuraAt(c, id, X, Y, t, r = 60) {
  const A = AURAS[id] || AURAS.spring, im = IMG['aura/' + id];
  c.save(); c.translate(X, Y); c.scale(1, 0.34);
  if (im) {
    c.rotate(t * A.spin); c.globalAlpha = 0.9; c.drawImage(im, -r, -r, r * 2, r * 2);
    c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.18 + 0.14 * Math.sin(t * 3); c.drawImage(im, -r, -r, r * 2, r * 2);
  } else {
    c.globalCompositeOperation = 'lighter'; c.lineWidth = 4;
    for (let i = 0; i < 2; i++) { c.strokeStyle = `rgba(${A.col},${0.55 - i * 0.2})`; c.beginPath(); c.arc(0, 0, r * (0.7 + i * 0.25), 0, TAU); c.stroke(); }
  }
  c.restore();
  // 上升的光点（按时间算位置，不存状态）
  c.save(); c.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 5; i++) {
    const ph = (t * 0.55 + i / 5) % 1, a = i * 1.26 + t * 0.4;
    c.fillStyle = `rgba(${A.col},${(1 - ph) * 0.8})`; c.beginPath(); c.arc(X + Math.cos(a) * r * 0.75, Y + Math.sin(a) * r * 0.22 - ph * 56, 2.2 * (1 - ph * 0.5), 0, TAU); c.fill();
  }
  c.restore();
}
function cashDrawAura(c, e, id) {
  if (!id) return; const X = sx(e.x); if (X < -90 || X > WW + 90) return;
  if (e.dead && e.deadT > 0.9) return;
  cashDrawAuraAt(c, id, X, sy(e.y, 0), (e._cash && e._cash.t) || game.t);
}
function cashDrawGlow(c, e) {
  const C = e._cash; if (!C || !C.parts.length) return;
  const X = sx(e.x), Y = sy(e.y, e.z || 0); if (X < -80 || X > WW + 80) return;
  const sky2 = C.sky8 === 'av_sky2';
  c.save(); c.globalCompositeOperation = 'lighter';
  for (const q of C.parts) {
    const k = q.t / q.life, a = k < 0.2 ? k / 0.2 : 1 - (k - 0.2) / 0.8;
    if (q.kind === 1) { c.save(); c.globalCompositeOperation = 'source-over'; c.globalAlpha = a * 0.9; c.translate(X + q.x, Y - q.z); c.rotate(q.rot + Math.sin(q.t * 2) * 0.6); c.fillStyle = '#ffffff'; c.beginPath(); c.ellipse(0, 0, 5, 1.8, 0, 0, TAU); c.fill(); c.fillStyle = '#ffe9a0'; c.fillRect(-5, -0.4, 10, 0.8); c.restore(); continue; }
    c.fillStyle = sky2 ? `rgba(255,${q.g},40,${a * 0.9})` : `rgba(255,226,120,${a * 0.85})`;
    const s = sky2 ? 2.2 : 1.6 + Math.sin(q.t * 9) * 0.6;
    c.beginPath(); c.arc(X + q.x, Y - q.z, s, 0, TAU); c.fill();
  }
  c.restore();
}
