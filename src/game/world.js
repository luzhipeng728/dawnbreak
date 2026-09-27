/* =====================================================================
   世界：城镇 / 区域场景（参照 DNF：艾尔文防线 → 格兰之森区域地图 → 地下城门口）
   - defineScene(id, def)：场景，kind 为 town（城镇）或 field（区域地图）
       def = { name, area, kind, width, theme, bgm, props:[{art, x, h, label}], npcs:[{npc, x, y}], exits:[{side, to, label}], gates:[{dungeon, x}] }
   - defineNpc(id, def)：NPC，def = { name, title, art, h, services:[...], lines:[...], portrait }
   - 走到场景左右边缘 → 进入相连场景；在区域地图里走到地下城门口 → 弹出地下城选择；
     打完地下城返回时出现在该地下城门口（与官方一致）
   ===================================================================== */
const SCENES = {}, NPCS = {}, DUNGEONS = {};
function defineDungeon(id, def) { DUNGEONS[id] = { id, branches: 2, cols: 5, rows: 3, bossAdds: 2, bgm: 'dungeon', ...def }; }
function defineScene(id, def) { SCENES[id] = { id, kind: 'town', width: 2400, props: [], npcs: [], exits: [], gates: [], ...def }; }
function defineNpc(id, def) { NPCS[id] = { id, h: 120, services: [], lines: ['……'], ...def }; }
let world = null;
const GATE_W = 150, EXIT_ZONE = 26;
const worldBundles = S => ['world', 'bg:' + S.theme];
// 进入场景：spawn = 'left' | 'right' | { x, y } | 'gate:<dungeonId>'
function enterScene(id, spawn) {
  const S = SCENES[id]; if (!S) { console.error('未知场景', id); return Promise.resolve(); }
  return withLoading(worldBundles(S), () => setupScene(S, spawn));
}
function setupScene(S, spawn) {
  game.scene = 'town'; game.dungeon = null; game.paused = false; game.timers.length = 0; game.slowmo = false; save.daily();
  ents.length = 0; projs.length = 0; drops.length = 0; fxList.length = 0; numList.length = 0; groundFx.length = 0;
  game.room = { x0: 0, x1: S.width, theme: S.theme, seed: S.id.length * 7 + 3, scene: S.id };
  buildRoomArt(game.room);
  const p = game.player;
  p.dead = false; p.status = {}; p.invul = 0; p.act = null; p.setState('idle'); p.z = 0; p.vx = p.vy = p.vz = 0; p.cool = {}; p.buffs = {};
  if (p.hp <= 0) p.hp = 1;
  let x = S.width / 2, y = DEPTH * 0.6, face = 1;
  if (spawn === 'left') { x = 90; face = 1; }
  else if (spawn === 'right') { x = S.width - 90; face = -1; }
  else if (typeof spawn === 'string' && spawn.startsWith('gate:')) { const g = S.gates.find(g => g.dungeon === spawn.slice(5)); if (g) { x = g.x; y = 34; } }
  else if (spawn && spawn.x !== undefined) { x = spawn.x; y = spawn.y ?? y; face = spawn.face || 1; }
  else if (S.spawn) { x = S.spawn.x; y = S.spawn.y; }
  p.x = clamp(x, 60, S.width - 60); p.y = clamp(y, 8, DEPTH - 8); p.face = face;
  ents.push(p);
  const npcs = S.npcs.map(n => {
    const N = NPCS[n.npc]; if (!N) { console.error('场景引用了未定义的 NPC', n.npc); return null; }
    const e = new Ent({ team: 'n', name: N.name, model: IMG[N.art] ? new StaticModel(N.art, N.h) : buildSwordsman(), clips: CLIPS.sword, x: n.x, y: n.y ?? 40, face: n.face || -1, shadowR: 18 });
    e.npc = N; ents.push(e); return e;
  }).filter(Boolean);
  world = { S, npcs, near: null, gateLock: null, exitLock: 0.4, hover: null };
  for (const g of S.gates) if (Math.abs(p.x - g.x) < GATE_W * 0.32 && p.y < 26) world.gateLock = g;   // 从地下城回来就站在门口：先别再弹窗
  cam.x = clamp(p.x - WW / 2, 0, Math.max(0, S.width - WW));
  save.data.loc = { scene: S.id, x: Math.round(p.x), y: Math.round(p.y) };
  (save.data.seen = save.data.seen || {})[S.id] = 1;
  music.play(S.bgm || 'town'); save.write();
  if (typeof questsOnEnterScene === 'function') questsOnEnterScene(S.id);
  bus.emit('sceneEnter', { id: S.id, kind: S.kind });
}
function goTown() { const loc = save.data.loc; return enterScene(loc && SCENES[loc.scene] ? loc.scene : START_SCENE, loc); }
// 当前可见的地下城门（隐藏地下城满足条件后才出现）
const gateVisible = g => { const D = DUNGEONS[g.dungeon]; return D && (!D.hidden || dungeonUnlocked(D)); };
function dungeonUnlocked(D) { if (!D.hidden) return true; const u = D.unlock || {}; if (u.quest) return !!(save.data.questDone || {})[u.quest]; if (u.clear) return !!(save.data.unlocked || {})[u.clear]; return true; }
function worldUpdate(dt) {
  const p = game.player, W = world.S.width;
  if (!menus.modal()) playerControlTown(p, dt); else if (p.st === 'walk' || p.st === 'run') { p.vx = p.vy = 0; p.setState('idle'); }
  for (const e of ents) e.update(dt);
  // 最近的 NPC
  let near = null, bd = 70;
  for (const e of world.npcs) { const d = Math.abs(e.x - p.x) + Math.abs(e.y - p.y) * 1.5; if (d < bd) { bd = d; near = e; } if (Math.abs(e.x - p.x) < 260) e.face = p.x > e.x ? 1 : -1; }
  world.near = near;
  world.exitLock = Math.max(0, world.exitLock - dt);
  if (menus.modal()) return;
  if (near && input.hit('attack')) { input.consume('attack'); openNpc(near.npc); return; }
  // 场景出口（左右边缘）
  if (world.exitLock <= 0) for (const ex of world.S.exits) {
    if ((ex.side === 'left' && p.x <= EXIT_ZONE + 40 && input.dx() < 0) || (ex.side === 'right' && p.x >= W - EXIT_ZONE - 40 && input.dx() > 0)) {
      sfx.door(); world.exitLock = 99; enterScene(ex.to, ex.side === 'left' ? 'right' : 'left'); return;
    }
  }
  // 地下城门口：走到门前（靠后墙）弹出地下城选择
  let inGate = null;
  for (const g of world.S.gates) if (gateVisible(g) && Math.abs(p.x - g.x) < GATE_W * 0.32 && p.y < 26) inGate = g;
  if (inGate && world.gateLock !== inGate) { world.gateLock = inGate; save.data.loc = { scene: world.S.id, x: Math.round(inGate.x), y: 34 }; menus.open('dungeon', { dungeon: inGate.dungeon, scene: world.S.id }); sfx.open(); p.vx = p.vy = 0; }
  else if (!inGate) world.gateLock = null;
  if (game.t % 2 < dt) save.data.loc = { scene: world.S.id, x: Math.round(p.x), y: Math.round(p.y) };
}
function playerControlTown(p, dt) {
  const dx = input.dx(), dy = input.dy(), running = input.runDir !== 0 && dx === input.runDir;
  if (dx || dy) { if (dx) p.face = dx; const sp = running ? p.runSpeed : p.speed; p.vx = dx * sp; p.vy = dy * sp * 0.88; p.setState(running ? 'run' : 'walk'); }
  else { p.vx = p.vy = 0; p.setState('idle'); }
}
/* ---- 渲染 ---- */
function renderScene(c) {
  const R = game.room, S = world.S;
  drawRoomBack(c, R);
  // 建筑 / 道具：贴在后墙线上（与地面同一视差）
  for (const pr of S.props) {
    const im = IMG[pr.art]; if (!im) continue;
    const h = pr.h || 200, w = im.width * h / im.height, X = sx(pr.x) - w / 2, Y = sy(pr.y ?? -14, 0) - h;
    if (X > WW + 20 || X + w < -20) continue;
    c.drawImage(im, X, Y, w, h);
  }
  // 地下城门：门框 + 旋转的传送门光 + 名牌
  for (const g of S.gates) {
    if (!gateVisible(g)) continue;
    const D = DUNGEONS[g.dungeon], im = IMG[D.hidden ? 'world/b_gate_hidden' : 'world/b_gate'], h = 190, X = sx(g.x), Y = sy(-12, 0);
    if (X < -200 || X > WW + 200) continue;
    if (im) { const w = im.width * h / im.height; c.drawImage(im, X - w / 2, Y - h, w, h); }
    c.save(); c.globalCompositeOperation = 'lighter'; const a = 0.25 + 0.12 * Math.sin(game.t * 3 + g.x);
    const gg = c.createRadialGradient(X, Y - h * 0.42, 4, X, Y - h * 0.42, 60); gg.addColorStop(0, D.hidden ? `rgba(220,120,255,${a})` : `rgba(140,220,255,${a})`); gg.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = gg; c.beginPath(); c.ellipse(X, Y - h * 0.42, 50, 70, 0, 0, TAU); c.fill(); c.restore();
    const near = world.gateLock === g;
    plate(c, X, Y - h - 8, D.name, `Lv.${D.lvl[0]}~${D.lvl[1]}`, D.hidden ? '#e0a0ff' : '#ffe8a0', near);
  }
  for (const e of ents) e.drawShadow(c);
  const list = [...ents, ...fxList].sort((a, b) => a.y - b.y);
  for (const o of list) o.draw(c);
  // NPC 名牌 + 任务标记
  for (const e of world.npcs) {
    const N = e.npc, X = sx(e.x), Y = sy(e.y, N.h + 16), hot = world.near === e || world.hover === e;
    c.font = `bold ${hot ? 11 : 10}px "PingFang SC","Microsoft YaHei",sans-serif`; c.textAlign = 'center';
    c.lineWidth = 3; c.strokeStyle = '#000'; c.strokeText(N.name, X, Y); c.fillStyle = hot ? '#fff6c0' : '#ffe070'; c.fillText(N.name, X, Y);
    if (N.title) { c.font = 'bold 8px sans-serif'; c.strokeText(`[${N.title}]`, X, Y - 11); c.fillStyle = '#9fe0ff'; c.fillText(`[${N.title}]`, X, Y - 11); }
    const mk = typeof questMarker === 'function' ? questMarker(N.id) : null;
    if (mk) { const bob = Math.sin(game.t * 4) * 2; c.font = '900 18px "Arial Black",sans-serif'; c.lineWidth = 4; c.strokeText(mk, X, Y - 24 + bob); c.fillStyle = mk === '?' ? '#6aff6a' : '#ffd23a'; c.fillText(mk, X, Y - 24 + bob); }
  }
  // 出口箭头
  for (const ex of S.exits) {
    const X = ex.side === 'left' ? 22 - cam.x : S.width - 22 - cam.x, Y = sy(DEPTH / 2, 0);
    if (X < -80 || X > WW + 80) continue;
    const dir = ex.side === 'left' ? -1 : 1, bob = Math.sin(game.t * 4) * 3;
    c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = 'rgba(255,230,140,.75)';
    for (let i = 0; i < 3; i++) { const x = X + dir * (i * 10 + bob); c.beginPath(); c.moveTo(x, Y - 12); c.lineTo(x + dir * 12, Y); c.lineTo(x, Y + 12); c.closePath(); c.fill(); }
    c.restore();
    plate(c, X - dir * 30, Y - 36, SCENES[ex.to] ? SCENES[ex.to].name : ex.label, ex.label && SCENES[ex.to] && ex.label !== SCENES[ex.to].name ? ex.label : '', '#fff0c0', false);
  }
  drawNumbers(c);
  drawRoomFore(c, R);
}
function plate(c, X, Y, t1, t2, col, hot) {
  c.save(); c.font = 'bold 11px "PingFang SC","Microsoft YaHei",sans-serif'; c.textAlign = 'center';
  const w = Math.max(c.measureText(t1).width, t2 ? c.measureText(t2).width * 0.85 : 0) + 16, h = t2 ? 30 : 18;
  c.fillStyle = hot ? 'rgba(60,40,10,.9)' : 'rgba(10,8,14,.75)'; c.strokeStyle = hot ? '#ffd23a' : 'rgba(255,220,150,.6)'; c.lineWidth = 1;
  c.beginPath(); c.roundRect ? c.roundRect(X - w / 2, Y - h, w, h, 4) : c.rect(X - w / 2, Y - h, w, h); c.fill(); c.stroke();
  c.fillStyle = col; c.fillText(t1, X, Y - h + 13);
  if (t2) { c.font = 'bold 9px sans-serif'; c.fillStyle = '#c8c0b0'; c.fillText(t2, X, Y - 5); }
  c.restore();
}
function worldUI(c) {
  const S = world.S;
  uiText(S.name, 1880, 50, { size: 30, align: 'right', color: '#ffe8a8', sw: 5 });
  if (S.area && S.area !== S.name) uiText(S.area, 1880, 84, { size: 18, align: 'right', color: '#c8c0a8', sw: 3 });
  if (world.near && !menus.modal()) uiText(`按 X 或点击与 ${world.near.npc.name} 对话`, 960, 700, { size: 28, align: 'center', color: '#ffe8a8', sw: 5 });
  if (typeof drawQuestTracker === 'function') drawQuestTracker(c);
  drawToasts(c);
}
function drawToasts(c) {
  let ty = 360;
  for (let i = toastList.length - 1; i >= 0; i--) { const m = toastList[i]; m.t += 1 / 60; if (m.t > 3) { toastList.splice(i, 1); continue; } c.globalAlpha = m.t > 2.4 ? (3 - m.t) / 0.6 : 1; uiText(m.msg, 960, ty, { size: 28, align: 'center', color: m.col, sw: 5 }); ty += 40; c.globalAlpha = 1; }
}
// 鼠标：悬停高亮 / 点击 NPC 对话
function worldPointer(ev, click) {
  if (game.scene !== 'town' || !world || menus.modal()) return;
  const r = wcan.getBoundingClientRect(), mx = (ev.clientX - r.left) / r.width * WW + cam.x, my = (ev.clientY - r.top) / r.height * WH;
  let hit = null;
  for (const e of world.npcs) { const X = e.x, top = FLOOR_Y + e.y - e.npc.h, bot = FLOOR_Y + e.y; if (Math.abs(mx - X) < 26 && my > top && my < bot + 6) hit = e; }
  world.hover = hit; wcan.style.cursor = hit ? 'pointer' : '';
  if (click && hit) { const p = game.player; if (Math.abs(p.x - hit.x) > 300) { toastMsg('离得太远了，走近一点再对话', '#ffd0a0'); return; } openNpc(hit.npc); }
}
addEventListener('pointermove', ev => worldPointer(ev, false));
wcan.addEventListener('click', ev => worldPointer(ev, true));
