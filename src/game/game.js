/* =====================================================================
   20. 游戏主循环：固定 60Hz 逻辑步长；场景（地下城房间 / 城镇）；相机；渲染排序
   ===================================================================== */
const game = {
  t: 0, player: null, room: null, scene: 'none', paused: false,
  skillBar: ['upslash', 'triple', 'wave', 'slam', 'focus', 'iai', 'spin', 'awaken', 'flurry', 'rise', null, null],
  skillLv: { upslash: 1, triple: 1, wave: 1, slam: 1, focus: 1, iai: 1, spin: 1, awaken: 1, flurry: 1, rise: 1 },
  combo: 0, comboT: 0, maxCombo: 0, comboDmg: 0, timeStop: 0, cutin: null, maxAttackers: 2,
  gold: 0, exp: 0, lvl: 1,
  onPlayerHit(t, dmg, crit, counter, back) { this.combo++; this.comboT = 1.6; this.comboDmg += dmg; this.maxCombo = Math.max(this.maxCombo, this.combo); if (this.dungeon) this.dungeon.onHit(t, dmg, counter, back); bus.emit('playerHit', { target: t, dmg, crit, counter, back }); },
  onPlayerHurt(p, dmg, a) { p.lastHurtT = this.t; if (!(a && a.fighter)) p.invul = Math.max(p.invul, 0.2); if (this.dungeon) this.dungeon.hurt++; bus.emit('playerHurt', { dmg }); },   // 被怪物打中给 0.2 秒保护；决斗场里不给（否则连不上招）
  onKill(t, a) { if (this.duel) { this.duel.onKill(t, a); return; } if (t.team === 'p') return; for (const e of ents) if (e !== t && !e.dead && e.def_ && e.def_.coward) cowardDrop(e); if (this.dungeon) this.dungeon.onKill(t, a); else { spawnCoins(t, rndi(t.gold ? t.gold[0] : 5, t.gold ? t.gold[1] : 15)); } },
  onSkill(id) { },
  timers: [],
  after(sec, fn) { this.timers.push({ t: sec, fn }); },
};
function step(dt) {
  game.t += dt;
  if (bot.on) bot.tick(dt);
  if (touch.on) touch.tick();
  input.frame(game.t);
  if (game.cutin) { game.cutin.t += dt; if (game.cutin.t >= game.cutin.dur) game.cutin = null; }
  if (game.timeStop > 0) { game.timeStop -= dt; updateCamera(dt); input.endFrame(); return; }
  const p = game.player;
  if (p) {
    for (const k in p.cool) if (p.cool[k] > 0) p.cool[k] -= dt;
    if (!p.dead && !game.pvp && game.t - (p.lastHurtT || -99) > 4 && p.hp < p.hpMax) p.hp = Math.min(p.hpMax, p.hp + p.hpMax * 0.015 * dt);
    if (!p.dead) { p.mp = Math.min(p.mpMax, p.mp + p.mpMax * 0.02 * dt * (p.mpRegen || 1) * (1 + (p.buffMpr || 0)) * (game.scene === 'town' ? 5 : 1)); }
    if (inv.potCd > 0) inv.potCd -= dt;
    if (p.weak && (game.weakChk = (game.weakChk || 0) + dt) > 1) { game.weakChk = 0; if (!(save.data.weak > Date.now())) { recalcStats(p); toastMsg('虚弱状态解除了', '#8aff9a', 'log'); } }
    if (game.scene !== 'town' && !p.dead) for (let i = 0; i < 6; i++) if (input.hit('i' + i) && inv.quick[i]) inv.use(inv.quick[i]);
    if (p.buffs) for (const k in p.buffs) { p.buffs[k].t -= dt; if (p.buffs[k].t <= 0) delete p.buffs[k]; }
    applyBuffs(p);
  }
  if (game.scene === 'dungeon' || game.scene === 'test') {
    for (const e of ents) if (e.fighter && e !== p) tickFighter(e, dt);   // AI / 网络格斗者：冷却、MP、BUFF
    for (const e of ents) if (e.control && e.hitstop <= 0 && !(game.dungeon && game.dungeon.transition)) e.control(e, dt);
    for (const e of ents) { e.update(dt); if (e.status && !e.dead) updateStatus(e, dt); }
    resolveHits();
    updateProjs(dt);
    updateGroundFx(dt);
    updateDrops(dt);
    if (game.dungeon) game.dungeon.update(dt);
    if (game.duel) game.duel.update(dt);
  } else if (game.scene === 'town') { worldUpdate(dt); }
  for (let i = game.timers.length - 1; i >= 0; i--) { const T = game.timers[i]; T.t -= dt * (game.slowmo ? 1 / 0.35 : 1); if (T.t <= 0) { game.timers.splice(i, 1); T.fn(); } }
  updateFx(dt);
  if (game.comboT > 0) { game.comboT -= dt; if (game.comboT <= 0) { game.combo = 0; game.comboDmg = 0; } }
  for (let i = ents.length - 1; i >= 0; i--) { const e = ents[i]; if (e.remove || (e.dead && e.deadT > 1.1 && e.team !== 'p')) ents.splice(i, 1); }
  updateCamera(dt);
  input.endFrame();
}
function applyBuffs(p) {
  const base = p.baseStats || (p.baseStats = { atk: p.atk, speed: p.speed, runSpeed: p.runSpeed });
  let atkMul = 1, spd = 1, crit = 0, mpr = 0;
  if (p.buffs) for (const k in p.buffs) { const b = p.buffs[k]; atkMul += b.atk || 0; spd += b.spd || 0; crit += b.crit || 0; mpr += b.mpr || 0; }
  if (p.baseCrit !== undefined) p.crit = p.baseCrit + crit;
  p.buffMpr = mpr;
  if (p.status && p.status.slow) spd *= 0.5;
  p.atk = base.atk * atkMul; p.speed = base.speed * spd; p.runSpeed = base.runSpeed * spd;
}
function updateCamera(dt) {
  const p = game.player, R = game.room;
  if (p && R) {
    const want = clamp((game.duel ? game.duel.focusX() : p.x + p.face * 70) - WW / 2, R.x0, R.x1 - WW);
    cam.x = damp(cam.x, want, 5, dt);
    cam.x = clamp(cam.x, R.x0, Math.max(R.x0, R.x1 - WW));
  }
  if (cam.shake > 0) { cam.shx = Math.round(rnd(-1, 1) * cam.shake); cam.shy = Math.round(rnd(-1, 1) * cam.shake * 0.6); cam.shake = Math.max(0, cam.shake - dt * 40); } else { cam.shx = cam.shy = 0; }
  if (typeof uiPref === 'function' && !uiPref('shake')) cam.shx = cam.shy = 0;   // 设置里关掉了屏幕震动
  if (cam.flash > 0) cam.flash -= dt;
}
function renderWorld() {
  const c = wctx; c.setTransform(RS, 0, 0, RS, 0, 0); c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high'; c.globalAlpha = 1; c.filter = 'none';
  if (game.scene === 'title' && IMG.title) {   // 标题主图：缓慢推镜
    const im = IMG.title, z = 1.04 + Math.sin(performance.now() / 9000) * 0.03, w = WW * z, h = WH * z;
    c.drawImage(im, (WW - w) / 2, (WH - h) / 2, w, h); return;
  }
  if (game.scene === 'town') { renderScene(c); return; }
  const R = game.room; if (!R) { c.fillStyle = '#000'; c.fillRect(0, 0, WW, WH); return; }
  drawRoomBack(c, R);
  if (game.dungeon) game.dungeon.drawDoors(c);
  drawGroundFx(c);
  for (const e of ents) if (!(e.dead && e.deadT > 0.9)) e.drawShadow(c);
  drawProjShadows(c); drawDropShadows(c);
  const list = [];
  for (const e of ents) list.push(e);
  for (const p of projs) list.push({ y: p.y, draw: (cc) => p.draw(cc, p) });
  for (const d of drops) list.push(d);
  for (const f of fxList) list.push(f);
  list.sort((a, b) => a.y - b.y);
  for (const o of list) o.draw(c);
  for (const e of ents) if (e.status && !e.dead) drawStatus(c, e);
  drawBlind(c);
  drawNumbers(c);
  drawRoomFore(c, R);
  if (game.timeStop > 0) { c.fillStyle = 'rgba(0,0,0,0.55)'; c.fillRect(0, 0, WW, WH); const p = game.player; if (p) p.draw(c); }
  if (cam.flash > 0) { c.globalAlpha = clamp(cam.flash * 5, 0, 0.85); c.fillStyle = cam.flashCol; c.fillRect(0, 0, WW, WH); c.globalAlpha = 1; }
  if (game.dungeon) game.dungeon.drawOverlay(c);
  if (game.duel) game.duel.drawOverlay(c);
}
let lastT = performance.now(), acc = 0, fps = 60, fpsAcc = 0, fpsN = 0;
function frame(now) {
  requestAnimationFrame(frame);   // 先排下一帧：即使本帧出错，游戏也不会整个卡死
  try { frameBody(now); } catch (e) { console.error(e); }
}
function frameBody(now) {
  const rdt = Math.min(0.1, (now - lastT) / 1000); lastT = now;
  fpsAcc += rdt; fpsN++; if (fpsAcc >= 0.5) { fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0; }
  // 手机竖屏时（提示横屏的遮罩盖住画面）暂停游戏
  const blocked = touch.on && innerHeight > innerWidth;
  if (!game.paused && !blocked) {
    acc += rdt * (game.slowmo ? 0.35 : 1) * (game.speedMul || 1);
    let n = 0;
    while (acc >= 1 / 60 && n < 5) { step(1 / 60); acc -= 1 / 60; n++; }
    if (n === 5) acc = 0;
  } else { if (bot.on) bot.tick(rdt); if (touch.on) touch.tick(); input.frame(game.t); if (game.onPausedFrame) game.onPausedFrame(); input.endFrame(); }
  renderWorld();
  ui.draw();
}
/* ---- 测试房间（?test）：暮色林地 + 一群哥布林 ---- */
function startTestRoom() {
  ents.length = 0; projs.length = 0; fxList.length = 0; drops.length = 0; groundFx.length = 0;
  game.scene = 'test';
  game.room = { x0: 0, x1: 1600, theme: 'forest', seed: 7 };
  buildRoomArt(game.room);
  const p = game.player || (game.player = makePlayer());
  p.x = 200; p.y = 100; ents.push(p);
  if (PARAMS.has('mon')) {   // ?mon=tauKing,goblin&lvl=16&boss：图鉴测试
    PARAMS.get('mon').split(',').forEach((kd, i) => spawnMonster(kd, 700 + i * 120, 60 + (i * 47) % 100, { lvl: +(PARAMS.get('lvl') || 0) || undefined, boss: PARAMS.has('boss') && i === 0 }));
    return;
  }
  const n = +(PARAMS.get('mobs') || 6);
  for (let i = 0; i < n; i++) spawnMonster(i % 3 === 2 ? 'goblinThrower' : 'goblin', 520 + i * 90, 40 + (i * 53) % 150);
}
