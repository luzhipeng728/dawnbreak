/* =====================================================================
   19. 城镇“晨曦营地”：可走动的 2.5D 街道，NPC（铁匠 / 药剂师 / 剑术导师 / 行商 / 地下城入口）
   靠近 NPC 按 X 对话 → 打开对应窗口；走到最右侧的传送门 → 地下城选择
   ===================================================================== */
const NPCS = [
  { id: 'smith', name: '铁匠·格雷', title: '强化', x: 470, y: 60, pal: { skin: '#e8b890', hair: '#5a3a2a', eye: '#3a2a1a', coat: '#6a4a36', coat2: '#4a3020', trim: '#b8905a', scarf: '#8a2a1a', pants: '#3a3030', boot: '#3a2a20', glove: '#5a4030', belt: '#3a2618', blade: '#ccc', glow: '#fff' }, opt: { weapon: 'hammer', scarf: false, pauldron: false, coatTail: false, hair: 'bald' }, open: 'enhance', lines: ['想把装备强化得更锋利？交给我吧。', '强化到 +10 以上可要小心，失败了我可不负责哦。'] },
  { id: 'potion', name: '药剂师·莉娜', title: '商店', x: 880, y: 40, pal: { skin: '#f6d6c0', hair: '#c86a3a', eye: '#3a7a3a', coat: '#3a6a4a', coat2: '#2a4a36', trim: '#e8d08a', scarf: '#e8a0b0', pants: '#4a3a4a', boot: '#5a3a30', glove: '#f6d6c0', belt: '#6a4a30', blade: '#ccc', glow: '#fff' }, opt: { weapon: 'none', scarf: false, pauldron: false, coatTail: true, hair: 'long' }, open: 'shop', lines: ['欢迎光临！药剂、晶块，冒险必备的都在这儿。', '别忘了把药剂放进快捷栏，按 1~6 就能喝。'] },
  { id: 'trainer', name: '剑术导师·凯', title: '技能', x: 1290, y: 70, pal: { skin: '#e8c0a0', hair: '#2a2a3a', eye: '#8a2a2a', coat: '#5a2a2a', coat2: '#3a1a1a', trim: '#c8c0b0', scarf: '#2a2a2a', pants: '#2a2a2a', boot: '#2a2020', glove: '#3a2a2a', belt: '#2a1a14', blade: '#dfe6f0', glow: '#ff8a8a' }, opt: { weapon: 'sword', scarf: true, pauldron: true, coatTail: true, hair: 'bun' }, open: 'skills', lines: ['用技能点学习新的招式，然后放进快捷栏。', '指令释放技能（方向 + Z）会少消耗一点 MP 和冷却。'] },
  { id: 'merchant', name: '行商·巴顿', title: '装备', x: 1690, y: 45, pal: { skin: '#e0b088', hair: '#8a8070', eye: '#3a3a3a', coat: '#7a6a3a', coat2: '#5a4a2a', trim: '#d9b25a', scarf: '#3a6aa8', pants: '#4a4034', boot: '#4a3020', glove: '#e0b088', belt: '#4a3020', blade: '#ccc', glow: '#fff', hat: '#6a4a2a' }, opt: { weapon: 'none', scarf: true, pauldron: false, coatTail: true, hair: 'short', hat: 'cap' }, open: 'gear', lines: ['来看看这些装备吧，都是从各地收来的好货。'] },
];
let town = null;
function goTown() {
  game.scene = 'town'; game.dungeon = null; game.paused = false; game.timers.length = 0; game.slowmo = false; save.daily();
  ents.length = 0; projs.length = 0; drops.length = 0; fxList.length = 0; numList.length = 0; groundFx.length = 0;
  game.room = { x0: 0, x1: 2300, theme: 'town', seed: 11 };
  buildRoomArt(game.room);
  const p = game.player; p.dead = false; p.status = {}; p.invul = 0; p.hp = p.hpMax; p.mp = p.mpMax; p.act = null; p.setState('idle'); p.x = 240; p.y = 110; p.z = 0; p.vx = p.vy = 0; p.face = 1; p.cool = {}; p.buffs = {};
  ents.push(p);
  town = { npcs: NPCS.map(n => { const e = new Ent({ team: 'n', name: n.name, model: hasArt(`npc/${n.id}`) ? new StaticModel(`npc/${n.id}`, n.id === 'merchant' ? 116 : 122) : buildSwordsman(n.pal, n.opt), clips: CLIPS.sword, x: n.x, y: n.y, face: n.x < 1200 ? 1 : -1, shadowR: 17 }); e.npc = n; ents.push(e); return e; }), near: null, portal: 2200 };
  cam.x = 0; music.play('town'); save.write();
}
function townUpdate(dt) {
  const p = game.player;
  if (!menus.modal()) playerControlTown(p, dt); else if (p.st === 'walk' || p.st === 'run') { p.vx = p.vy = 0; p.setState('idle'); }
  for (const e of ents) e.update(dt);
  // 最近的 NPC
  let near = null, bd = 60;
  for (const e of town.npcs) { const d = Math.abs(e.x - p.x) + Math.abs(e.y - p.y) * 1.5; if (d < bd) { bd = d; near = e; } e.face = p.x > e.x ? 1 : -1; }
  town.near = near;
  if (!menus.modal()) {
    if (near && input.hit('attack')) { menus.open(near.npc.open, near.npc); sfx.open(); }
    if (p.x > town.portal - 40) { p.x = town.portal - 60; p.vx = 0; menus.open('dungeon'); sfx.open(); }
    for (let i = 0; i < 6; i++) if (input.hit('i' + i)) inv.use(inv.quick[i]);
  }
}
function playerControlTown(p, dt) {
  const dx = input.dx(), dy = input.dy(), running = input.runDir !== 0 && dx === input.runDir;
  if (dx || dy) { if (dx) p.face = dx; const sp = running ? p.runSpeed : p.speed; p.vx = dx * sp; p.vy = dy * sp * 0.88; p.setState(running ? 'run' : 'walk'); }
  else { p.vx = p.vy = 0; p.setState('idle'); }
}
function renderTown(c) {
  const R = game.room;
  drawRoomBack(c, R);
  // 传送门（地下城入口）
  const X = sx(town.portal), Y = sy(DEPTH / 2, 0);
  c.save(); c.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 3; i++) { c.strokeStyle = `rgba(120,200,255,${0.5 - i * 0.12})`; c.lineWidth = 4 - i; c.beginPath(); c.ellipse(X, Y - 60, 34 + i * 6 + Math.sin(game.t * 3 + i) * 2, 64 + i * 6, 0, 0, TAU); c.stroke(); }
  const g = c.createRadialGradient(X, Y - 60, 4, X, Y - 60, 60); g.addColorStop(0, 'rgba(200,240,255,.6)'); g.addColorStop(1, 'rgba(60,120,255,0)'); c.fillStyle = g; c.beginPath(); c.ellipse(X, Y - 60, 32, 62, 0, 0, TAU); c.fill();
  c.restore();
  c.fillStyle = '#4a4238'; c.fillRect(X - 44, Y - 140, 10, 140); c.fillRect(X + 34, Y - 140, 10, 140); c.fillStyle = '#6a5a48'; c.fillRect(X - 50, Y - 150, 100, 14);
  for (const e of ents) e.drawShadow(c);
  const list = [...ents, ...fxList].sort((a, b) => a.y - b.y);
  for (const o of list) o.draw(c);
  // NPC 名字
  c.font = 'bold 10px "PingFang SC","Microsoft YaHei",sans-serif'; c.textAlign = 'center';
  for (const e of town.npcs) {
    const x = sx(e.x), y = sy(e.y, 118);
    c.lineWidth = 3; c.strokeStyle = '#000'; c.strokeText(e.npc.name, x, y); c.fillStyle = '#ffe070'; c.fillText(e.npc.name, x, y);
    c.font = 'bold 8px sans-serif'; c.strokeText(`[${e.npc.title}]`, x, y - 11); c.fillStyle = '#9fe0ff'; c.fillText(`[${e.npc.title}]`, x, y - 11); c.font = 'bold 10px "PingFang SC","Microsoft YaHei",sans-serif';
  }
  c.lineWidth = 3; c.strokeStyle = '#000'; c.strokeText('地下城入口', X, Y - 158); c.fillStyle = '#9fe0ff'; c.fillText('地下城入口', X, Y - 158);
  drawNumbers(c);
  drawRoomFore(c, R);
}
function townUI(c) {
  if (town && town.near && !menus.modal()) uiText(`按 X 与 ${town.near.npc.name} 对话`, 960, 700, { size: 30, align: 'center', color: '#ffe8a8', sw: 5 });
  uiText('晨曦营地', 1880, 50, { size: 30, align: 'right', color: '#ffe8a8', sw: 5 });
  uiText('I 背包  K 技能  M 角色  Esc 菜单  → 最右侧：地下城入口', 1880, 88, { size: 18, align: 'right', color: '#d8d0c0', sw: 3 });
  let ty = 360;
  for (let i = toastList.length - 1; i >= 0; i--) { const m = toastList[i]; m.t += 1 / 60; if (m.t > 3) { toastList.splice(i, 1); continue; } c.globalAlpha = m.t > 2.4 ? (3 - m.t) / 0.6 : 1; uiText(m.msg, 960, ty, { size: 28, align: 'center', color: m.col, sw: 5 }); ty += 40; c.globalAlpha = 1; }
}
/* ---- 城镇场景美术 ---- */
function house(c, x, base, w, h, R) {
  const wall = ['#c8b090', '#b8a080', '#d0b898', '#a89070'][Math.floor(R() * 4)], roof = ['#8a3a2a', '#6a3a2a', '#3a4a6a', '#5a3a2a'][Math.floor(R() * 4)];
  c.fillStyle = wall; c.fillRect(x, base - h, w, h);
  c.fillStyle = shade(wall, -0.25); c.fillRect(x, base - h, 6, h);
  // 木筋
  c.fillStyle = '#5a3a24'; c.fillRect(x, base - h, w, 4); c.fillRect(x, base - h * 0.5, w, 3); for (let i = 0; i <= w; i += w / 3) c.fillRect(x + i - 2, base - h, 4, h);
  c.fillStyle = roof; c.beginPath(); c.moveTo(x - 14, base - h + 2); c.lineTo(x + w / 2, base - h - h * 0.55); c.lineTo(x + w + 14, base - h + 2); c.closePath(); c.fill();
  c.fillStyle = shade(roof, 0.2); for (let i = 0; i < 5; i++) { c.fillRect(x - 10 + i * (w + 20) / 5, base - h - 2 - i % 2 * 3, (w + 20) / 5 - 3, 3); }
  // 窗户（暖光）
  for (let i = 0; i < 2; i++) { const wx = x + w * 0.2 + i * w * 0.45, wy = base - h * 0.82; c.fillStyle = '#ffd890'; c.fillRect(wx, wy, 14, 14); c.fillStyle = '#5a3a24'; c.fillRect(wx + 6, wy, 2, 14); c.fillRect(wx, wy + 6, 14, 2); }
  c.fillStyle = '#4a2e1c'; c.fillRect(x + w * 0.42, base - h * 0.42, w * 0.18, h * 0.42);
  // 烟囱
  c.fillStyle = '#6a5a50'; c.fillRect(x + w * 0.7, base - h - h * 0.5, 10, h * 0.3);
}
THEMES.town = {
  sky: '#6aa0d0',
  far(c, w, R) {
    const g = c.createLinearGradient(0, 0, 0, FLOOR_Y); g.addColorStop(0, '#5a8ac8'); g.addColorStop(0.6, '#9ac0e0'); g.addColorStop(1, '#f0d8b0'); c.fillStyle = g; c.fillRect(0, 0, w, FLOOR_Y + 10);
    // 云
    for (let i = 0; i < w / 150; i++) { const x = R() * w, y = 30 + R() * 90; c.fillStyle = 'rgba(255,255,255,.75)'; for (let j = 0; j < 4; j++) { c.beginPath(); c.ellipse(x + j * 22, y + (j % 2) * 6, 26, 12, 0, 0, TAU); c.fill(); } }
    // 远山与城堡剪影
    c.fillStyle = '#7a9ab8'; c.beginPath(); c.moveTo(0, FLOOR_Y - 60); for (let x = 0; x <= w; x += 60) c.lineTo(x, FLOOR_Y - 90 - Math.sin(x * 0.004) * 50 - R() * 30); c.lineTo(w, FLOOR_Y); c.lineTo(0, FLOOR_Y); c.closePath(); c.fill();
    c.fillStyle = '#6a88a8'; const cx = w * 0.6; c.fillRect(cx, FLOOR_Y - 190, 60, 120); c.fillRect(cx - 30, FLOOR_Y - 150, 24, 90); c.fillRect(cx + 66, FLOOR_Y - 160, 24, 100); c.beginPath(); c.moveTo(cx - 8, FLOOR_Y - 190); c.lineTo(cx + 30, FLOOR_Y - 250); c.lineTo(cx + 68, FLOOR_Y - 190); c.fill();
  },
  mid(c, w, R) { for (let x = -40; x < w; x += 170 + R() * 60) tree(c, x, FLOOR_Y - 20, 150 + R() * 40, '#4a5a3a', ['#5a8a4a', '#6a9a50', '#4a7a40'], R, 1); },
  wall(c, w, R) {
    for (let x = 60; x < w - 200; x += 260 + R() * 60) house(c, x, FLOOR_Y + 2, 130 + R() * 40, 90 + R() * 30, R);
    // 栅栏 + 木箱 + 路灯
    for (let x = 0; x < w; x += 18) { c.fillStyle = '#7a5a3a'; c.fillRect(x, FLOOR_Y - 18, 5, 20); } c.fillStyle = '#8a6a44'; c.fillRect(0, FLOOR_Y - 14, w, 4); c.fillRect(0, FLOOR_Y - 6, w, 3);
    for (let x = 200; x < w; x += 330) { c.fillStyle = '#3a3430'; c.fillRect(x, FLOOR_Y - 80, 4, 80); c.fillStyle = '#ffd890'; c.fillRect(x - 4, FLOOR_Y - 88, 12, 10); c.fillStyle = 'rgba(255,220,140,.25)'; c.beginPath(); c.arc(x + 2, FLOOR_Y - 83, 16, 0, TAU); c.fill(); }
    for (let x = 140; x < w; x += 400) { c.fillStyle = '#9a7040'; c.fillRect(x, FLOOR_Y - 22, 22, 20); c.strokeStyle = '#5a3a20'; c.lineWidth = 2; c.strokeRect(x, FLOOR_Y - 22, 22, 20); c.beginPath(); c.moveTo(x, FLOOR_Y - 22); c.lineTo(x + 22, FLOOR_Y - 2); c.stroke(); }
  },
  floor(c, w, R) {
    const top = FLOOR_Y - 4, h = WH - top;
    c.fillStyle = '#a89878'; c.fillRect(0, top, w, h);
    // 石板路
    for (let row = 0; row < 12; row++) { const y = top + 4 + row * 17, off = row % 2 ? 14 : 0; for (let x = -off; x < w; x += 28) { c.fillStyle = shade('#9a8a6a', (R() - 0.5) * 0.25); c.fillRect(x + 1, y + 1, 26, 15); c.fillStyle = 'rgba(255,255,255,.12)'; c.fillRect(x + 1, y + 1, 26, 2); } }
    c.fillStyle = 'rgba(0,0,0,.08)'; for (let i = 0; i < w * 0.3; i++) c.fillRect(R() * w, top + R() * h, 2, 1);
  },
  fore(c, w, R) { for (let x = 100; x < w; x += 420 + R() * 200) { c.fillStyle = '#5a3a24'; c.fillRect(x, WH - 24, 34, 24); c.fillStyle = '#4a8a3a'; c.beginPath(); c.ellipse(x + 17, WH - 26, 24, 12, 0, 0, TAU); c.fill(); c.fillStyle = ['#e85a6a', '#ffd23a', '#fff'][Math.floor(R() * 3)]; for (let j = 0; j < 5; j++) c.fillRect(x + 4 + j * 6, WH - 32 - (j % 2) * 4, 3, 3); } },
};
