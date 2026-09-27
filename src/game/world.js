/* =====================================================================
   世界：城镇 / 区域场景（参照 DNF 经典版：赛丽亚的房间 → 艾尔文防线 → 赫顿玛尔 / 西海岸；洛兰、格兰之森区域地图 → 地下城门口）
   注册（内容写在 content/world/*.js，新增内容的完整步骤见 docs/CONTENT_GUIDE.md）：
   - defineScene(id, def)：场景
       name 城镇 / 区域名（右上角大字、世界地图分组）  area 小区域名（如“中央广场”）  kind 'town' 城镇 | 'field' 区域地图
       width 场景宽  theme 背景（art/final/bg/<theme>_{far,floor,edge}）  bgm 曲目  interior 室内（没有路人和天气粒子）
       map [x, y] 世界地图上的位置（0~100 × 0~60）  spawn {x, y} 默认出生点  ambient 环境粒子  crowd 路人数量
       props [{ art, x, h, y?, anim?, glow?, flip? }]：y 省略 = 贴在后墙；y ≥ 0 = 摆在地面上，和角色一起按纵深排序
         anim：'flag'（左端固定的旗子）'hang'（上端固定的挂布）'sway'（摇摆）'bob'（漂浮）'breathe'（小动物）'fountain'（喷泉）
         glow：[x, y, 半径, 颜色]，x / y 是图内的相对位置（0~1），画一团会闪的光（灯、水晶）
       npcs [{ npc, x, y?, face? }]
       exits [{ side, to, x?, minLv?, label?, locked? }]：side = left / right（走到场景边缘）、up（走进后墙的门 / 路口）、down（走到场景下缘）
         双向连接：两边场景都要写一个指向对方的出口；从某个出口进来时，玩家站在“指回来源场景”的那个出口旁
         locked：写一句提示文字 = 还没开放的路（只提示，不切换场景）；minLv：等级不够时不让过
       gates [{ dungeon, x }]：地下城门（门的美术见 grand_flores.js 的 GATE_ART）
   - defineNpc(id, def)：NPC = { name, title, art, h, services, lines, greet? }（services 见 ui/npc.js 的 NPC_SERVICES）
   - defineDungeon(id, def)：地下城（见 grand_flores.js）
   走到地下城门口 → 弹出地下城选择；打完地下城返回时出现在该地下城门口（与官方一致）
   ===================================================================== */
const SCENES = {}, NPCS = {}, DUNGEONS = {};
function defineDungeon(id, def) { DUNGEONS[id] = { id, branches: 2, cols: 5, rows: 3, bossAdds: 2, bgm: 'dungeon', ...def }; }
function defineScene(id, def) { SCENES[id] = { id, kind: 'town', width: 2400, props: [], npcs: [], exits: [], gates: [], ...def }; }
function defineNpc(id, def) { NPCS[id] = { id, h: 120, services: [], lines: ['……'], ...def }; }
let world = null;
const GATE_W = 150, EXIT_ZONE = 26, DOOR_ZONE = 16;
const sceneTitle = S => S.area && S.area !== S.name ? `${S.name} · ${S.area}` : S.name;
const worldBundles = S => ['world', 'bg:' + S.theme];
// 新场景（手绘背景）的色调 / 远景地平线位置（room.js 的 BG_GRADE 按主题查表）
Object.assign(BG_GRADE, {
  elvenguard: { tint: 'rgba(255,230,170,0.06)', fog: 'rgba(255,240,200,0.06)' }, westcoast: { tint: 'rgba(170,220,255,0.06)', fog: 'rgba(220,240,255,0.06)' },
  seriaRoom: { tint: 'rgba(255,200,140,0.08)', anchor: 0.9 }, civic: { tint: 'rgba(200,220,255,0.05)' }, oldtown: { tint: 'rgba(255,190,120,0.08)' },
  backstreet: { tint: 'rgba(90,60,140,0.14)' }, magicGuild: { tint: 'rgba(120,80,200,0.10)' },
});
// 素材按键零散加载（路人只需要站立 / 走 / 跑几帧，不必把整套职业精灵拉下来）；和 loadBundles 共用同一个缓存
function loadArtKeys(keys) {
  return Promise.all(keys.filter(k => ASSET_SRC[k] && !IMG[k]).map(k => bundleLoads[k] || (bundleLoads[k] = new Promise(res => {
    const im = new Image(); im.onload = () => { IMG[k] = im; res(); }; im.onerror = () => { console.warn('素材加载失败', k); res(); }; im.src = ASSET_SRC[k];
  }))));
}
/* ---- 进入场景 ----
   spawn：{ from: 来源场景 id }（站到指回来源的出口旁）| 'left' | 'right' | { x, y, face } | 'gate:<地下城 id>' | 省略（场景的 spawn 或正中） */
function enterScene(id, spawn) {
  const S = SCENES[id]; if (!S) { console.error('未知场景', id); return Promise.resolve(); }
  return withLoading(worldBundles(S), () => setupScene(S, spawn));
}
function exitSpawn(S, ex) {
  const face = (ex.x ?? S.width / 2) < S.width / 2 ? 1 : -1;
  if (ex.side === 'left') return { x: 90, y: DEPTH * 0.5, face: 1 };
  if (ex.side === 'right') return { x: S.width - 90, y: DEPTH * 0.5, face: -1 };
  if (ex.side === 'up') return { x: ex.x, y: 36, face };
  return { x: ex.x, y: DEPTH - 36, face };
}
function setupScene(S, spawn) {
  const prev = world && world.S;
  game.scene = 'town'; game.dungeon = null; game.paused = false; game.timers.length = 0; game.slowmo = false; save.daily();
  ents.length = 0; projs.length = 0; drops.length = 0; fxList.length = 0; numList.length = 0; groundFx.length = 0;
  game.room = { x0: 0, x1: S.width, theme: S.theme, seed: S.id.length * 7 + 3, scene: S.id };
  buildRoomArt(game.room);
  const p = game.player;
  p.dead = false; p.status = {}; p.invul = 0; p.act = null; p.setState('idle'); p.z = 0; p.vx = p.vy = p.vz = 0; p.cool = {}; p.buffs = {};
  if (p.hp <= 0) p.hp = 1;
  let pos = null;
  if (spawn && spawn.from) { const ex = S.exits.find(e => e.to === spawn.from); if (ex) pos = exitSpawn(S, ex); }
  else if (spawn === 'left' || spawn === 'right') pos = exitSpawn(S, { side: spawn });
  else if (typeof spawn === 'string' && spawn.startsWith('gate:')) { const g = S.gates.find(g => g.dungeon === spawn.slice(5)); if (g) pos = { x: g.x, y: 34, face: 1 }; }
  else if (spawn && spawn.x !== undefined) pos = { x: spawn.x, y: spawn.y ?? DEPTH * 0.6, face: spawn.face || 1 };
  if (!pos) pos = S.spawn ? { face: 1, ...S.spawn } : { x: S.width / 2, y: DEPTH * 0.6, face: 1 };
  p.x = clamp(pos.x, 60, S.width - 60); p.y = clamp(pos.y, 8, DEPTH - 8); p.face = pos.face;
  ents.push(p);
  const npcs = S.npcs.map(n => {
    const N = NPCS[n.npc]; if (!N) { console.error('场景引用了未定义的 NPC', n.npc); return null; }
    const e = new Ent({ team: 'n', name: N.name, model: IMG[N.art] ? new NpcModel(N.art, N.h, N.still) : buildSwordsman(), clips: CLIPS.sword, x: n.x, y: n.y ?? 40, face: n.face || (N.still ? 1 : -1), shadowR: N.shadow || 18 });
    e.npc = N; e.home = e.face; e.lookT = rnd(3, 8); ents.push(e); return e;
  }).filter(Boolean);
  world = { S, npcs, near: null, gateLock: null, exitLock: 0.4, hover: null, crowd: [], fx: [], t: 0, banner: null, revealing: {} };
  if (!prev || prev.id !== S.id) world.banner = { t: 0, big: S.name, small: S.area && S.area !== S.name ? S.area : '' };
  for (const g of S.gates) if (Math.abs(p.x - g.x) < GATE_W * 0.32 && p.y < 26) world.gateLock = g;   // 从地下城回来就站在门口：先别再弹窗
  cam.x = clamp(p.x - WW / 2, 0, Math.max(0, S.width - WW));
  save.data.loc = { scene: S.id, x: Math.round(p.x), y: Math.round(p.y) };
  (save.data.seen = save.data.seen || {})[S.id] = 1;
  music.play(S.bgm || 'town'); save.write();
  spawnCrowd(S);
  if (typeof questsOnEnterScene === 'function') questsOnEnterScene(S.id);
  bus.emit('sceneEnter', { id: S.id, kind: S.kind, from: spawn && spawn.from || null });
}
function goTown() { const loc = save.data.loc; return enterScene(loc && SCENES[loc.scene] ? loc.scene : START_SCENE, loc && SCENES[loc.scene] ? loc : undefined); }
// 世界地图 / 区域移动 NPC：瞬移到某个城镇（站在场景的 spawn 点）
function worldTravel(id) {
  const S = SCENES[id]; if (!S || game.scene !== 'town') return Promise.resolve(false);
  sfx.buff(); return enterScene(id).then(() => { fxRing(); return true; });
}
function fxRing() { const p = game.player; world.fx.push({ type: 'warp', x: p.x, y: p.y, t: 0, dur: 0.9 }); }
// 当前可见的地下城门（隐藏地下城满足条件后才出现）
const gateVisible = g => { const D = DUNGEONS[g.dungeon]; return D && (!D.hidden || dungeonUnlocked(D)); };
function dungeonUnlocked(D) { if (!D.hidden) return true; const u = D.unlock || {}; if (u.quest) return !!(save.data.questDone || {})[u.quest]; if (u.clear) return !!(save.data.unlocked || {})[u.clear]; return true; }
/* ---- 每帧更新 ---- */
function worldUpdate(dt) {
  const p = game.player, S = world.S;
  world.t += dt;
  if (!menus.modal()) playerControlTown(p, dt); else if (p.st === 'walk' || p.st === 'run') { p.vx = p.vy = 0; p.setState('idle'); }
  for (const e of ents) e.update(dt);
  for (const w of world.crowd) w.update(dt);
  updateCrowdPool();
  for (let i = world.fx.length - 1; i >= 0; i--) { const f = world.fx[i]; f.t += dt; if (f.t >= f.dur) world.fx.splice(i, 1); }
  if (world.banner && (world.banner.t += dt) > 3.2) world.banner = null;
  // NPC：玩家走近时转过来看着玩家、打个招呼；没人理的时候偶尔回头张望
  let near = null, bd = 70;
  for (const e of world.npcs) {
    const d = Math.abs(e.x - p.x) + Math.abs(e.y - p.y) * 1.5; if (d < bd) { bd = d; near = e; }
    if (e.npc.still) continue;
    if (Math.abs(e.x - p.x) < 260 && Math.abs(e.y - p.y) < 140) npcFace(e, p.x > e.x ? 1 : -1);
    else if ((e.lookT -= dt) <= 0) { const away = e.face === e.home; npcFace(e, away ? -e.home : e.home); e.lookT = away ? rnd(1.2, 2.2) : rnd(4, 9); }
    if (e.model.tick) e.model.tick(dt);
  }
  if (near && near !== world.near && near.model.hop) near.model.hop();
  world.near = near;
  world.exitLock = Math.max(0, world.exitLock - dt);
  // 隐藏地下城的门第一次出现：播放现身特效
  for (const g of S.gates) { const D = DUNGEONS[g.dungeon]; if (D && D.hidden && gateVisible(g) && !(save.data.hiddenSeen ??= {})[D.id] && !world.revealing[D.id]) revealGate(g); }
  if (menus.modal()) return;
  if (near && input.hit('attack')) { input.consume('attack'); openNpc(near.npc); return; }
  if (world.exitLock <= 0) for (const ex of S.exits) if (exitTouched(ex, p)) { useExit(ex); return; }
  // 地下城门口：走到门前（靠后墙）弹出地下城选择
  let inGate = null;
  for (const g of S.gates) if (gateVisible(g) && !world.revealing[g.dungeon] && Math.abs(p.x - g.x) < GATE_W * 0.32 && p.y < 26) inGate = g;
  if (inGate && world.gateLock !== inGate) { world.gateLock = inGate; save.data.loc = { scene: S.id, x: Math.round(inGate.x), y: 34 }; menus.open('dungeon', { dungeon: inGate.dungeon, scene: S.id }); sfx.open(); p.vx = p.vy = 0; }
  else if (!inGate) world.gateLock = null;
  if (game.t % 2 < dt) save.data.loc = { scene: S.id, x: Math.round(p.x), y: Math.round(p.y) };
}
function npcFace(e, f) { if (e.face !== f) { e.face = f; if (e.model.turn) e.model.turn(); } }
function exitTouched(ex, p) {
  const dx = input.dx(), dy = input.dy(), W = world.S.width;
  if (ex.side === 'left') return p.x <= EXIT_ZONE + 40 && dx < 0;
  if (ex.side === 'right') return p.x >= W - EXIT_ZONE - 40 && dx > 0;
  if (ex.side === 'up') return Math.abs(p.x - ex.x) < 56 && p.y <= DOOR_ZONE && dy < 0;
  if (ex.side === 'down') return Math.abs(p.x - ex.x) < 70 && p.y >= DEPTH - DOOR_ZONE && dy > 0;
  return false;
}
function useExit(ex) {
  const p = game.player, T = SCENES[ex.to];
  const back = () => { world.exitLock = 1.2; p.vx = p.vy = 0; if (ex.side === 'left') p.x += 36; else if (ex.side === 'right') p.x -= 36; else if (ex.side === 'up') p.y += 16; else p.y -= 16; };
  if (ex.locked || !T) { toastMsg(ex.locked || '前面的路还没有开放', '#ffd0a0'); sfx.error(); back(); return; }
  if (ex.minLv && game.lvl < ex.minLv) { toastMsg(`需要达到 Lv.${ex.minLv} 才能前往 ${sceneTitle(T)}`, '#ffd0a0'); sfx.error(); back(); return; }
  sfx.door(); world.exitLock = 99; enterScene(ex.to, { from: world.S.id });
}
function playerControlTown(p, dt) {
  const dx = input.dx(), dy = input.dy(), running = input.runDir !== 0 && dx === input.runDir;
  if (dx || dy) { if (dx) p.face = dx; const sp = running ? p.runSpeed : p.speed; p.vx = dx * sp; p.vy = dy * sp * 0.88; p.setState(running ? 'run' : 'walk'); }
  else { p.vx = p.vy = 0; p.setState('idle'); }
}
function revealGate(g) {
  const D = DUNGEONS[g.dungeon]; world.revealing[D.id] = 1;
  world.fx.push({ type: 'reveal', x: g.x, t: 0, dur: 2.4, col: gateArt(D).col });
  cam.shake = Math.max(cam.shake, 6); sfx.buff();
  game.after(2.4, () => { if (world) { delete world.revealing[D.id]; save.data.hiddenSeen[D.id] = 1; save.write(); } });
  toastMsg(`隐藏地下城「${D.name}」的入口出现了！`, '#e0a0ff');
}
/* =====================================================================
   NPC 立绘模型：脚底中心为原点；呼吸起伏、轻微摇摆、转身时的“翻面”、玩家走近时小跳一下打招呼
   ===================================================================== */
class NpcModel {
  constructor(key, h, still) { this.img = IMG[key]; this.h = h; this.still = still; this.skel = { map: {} }; this.turnT = 1; this.hopT = 1; this.seed = Math.random() * 9; }
  turn() { this.turnT = 0; }
  hop() { if (this.hopT >= 1 && !this.still) this.hopT = 0; }
  tick(dt) { this.turnT = Math.min(1, this.turnT + dt / 0.2); this.hopT = Math.min(1, this.hopT + dt / 0.42); }
  draw(c, pose, t) {
    const im = this.img; if (!im) return;
    const k = this.h / im.height, s = this.seed, br = this.still ? 0 : Math.sin(t * 2.1 + s);
    if (this.still) { c.save(); c.scale(k, k); c.drawImage(im, -im.width / 2, -im.height); c.restore(); return; }
    const turn = this.turnT < 1 ? 0.25 + 0.75 * Math.sin(this.turnT * Math.PI / 2) : 1;
    const hp = this.hopT < 1 ? Math.sin(this.hopT * Math.PI) : 0, sq = this.hopT < 1 ? (this.hopT < 0.15 || this.hopT > 0.85 ? 0.95 : 1.02) : 1;
    c.save(); c.translate(0, -hp * 7);
    c.transform(1, 0, Math.sin(t * 0.8 + s * 2) * 0.012, 1, 0, 0);
    c.scale(k * turn * (1 - br * 0.005) * (2 - sq), k * (1 + br * 0.011) * sq);
    c.drawImage(im, -im.width / 2, -im.height); c.restore();
  }
}
/* =====================================================================
   路过的冒险家：用职业精灵在城镇里走来走去（不进 ents，不参与战斗），模仿官方城镇里其他玩家的感觉
   城镇：在街上闲逛、在 NPC 跟前停下来“对话”、从出口离开 / 进来；区域地图：走进地下城门里，或从门里出来
   ===================================================================== */
const CROWD_NAMES = ['夜雨·剑魂', '小鱼干', '奶妈别跑', '月下独酌', '爆头专业户', '一刀九九九', '阿拉德萌新', '赫顿玛尔扛把子', '深渊门口排队', '今天也要刷图',
  '林纳斯的锤子', '粉色小枪手', '元素少女', '剑圣预备役', '回家吃饭', '洛兰小霸王', '格拉卡钉子户', '不吃香菜', '疲劳又空了', '强化+12', '赛丽亚的粉丝', '牛头王克星',
  '星落', '南风知我意', '一只喵', '柠檬汽水', '闪避大师', '暴击不要停', '白给少年', '炫纹发射器', '左轮信仰', '冰霜法师', '人偶师', '晨曦'];
const CROWD_GUILDS = ['破晓', '赫顿夜话', '洛兰互助会', '西海岸渔夫', '', '', '', ''];
const CROWD_CLS = ['sword', 'gun', 'mage'];
// 路人的“时装”：只对衣服的主色相区间换色（鬼剑士的藏青外套、神枪手的蓝领巾、魔法师的紫裙），和玩家本人区分开
const CROWD_LOOKS = {
  sword: [{}, { hue: 150, only: [195, 255] }, { hue: -95, only: [195, 255] }, { hue: 100, only: [195, 255] }],
  gun: [{}, { hue: 150, only: [190, 250] }, { hue: -100, only: [190, 250] }],
  mage: [{}, { hue: -100, only: [250, 320] }, { hue: 70, only: [250, 320] }, { hue: 150, only: [250, 320] }],
};
const crowdFrames = cls => [`spr/${cls}/idle`, ...Array.from({ length: 8 }, (_, i) => `spr/${cls}/walk${i + 1}`), ...Array.from({ length: 8 }, (_, i) => `spr/${cls}/run${i + 1}`)];
class Passerby {
  constructor(o) {
    Object.assign(this, { x: 0, y: 100, face: 1, a: 0, fade: 1, st: 'idle', wait: rnd(0.5, 2.5), tx: 0, ty: 0, sp: rnd(80, 110), seed: Math.random() * 99 }, o);
    this.pose = { __c: 'idle', __t: 0 };
  }
  update(dt) {
    const S = world.S;
    this.a = clamp(this.a + dt * 2 * this.fade, 0, 1);
    if (this.fade < 0 && this.a <= 0) { this.gone = true; return; }
    this.pose.__t += dt;
    if (this.st === 'move') {
      const dx = this.tx - this.x, dy = this.ty - this.y, d = Math.hypot(dx, dy), sp = this.run ? this.sp * 2.1 : this.sp;
      if (d < 4) { this.st = 'idle'; this.pose.__c = 'idle'; this.wait = this.leaving ? 0 : rnd(1.5, 5); if (this.leaving) this.fade = -1; if (this.lookAt !== undefined) this.face = this.lookAt > this.x ? 1 : -1; return; }
      this.x += dx / d * sp * dt; this.y += dy / d * sp * dt * 0.88; if (Math.abs(dx) > 2) this.face = dx > 0 ? 1 : -1;
      return;
    }
    if (this.fade < 0 || (this.wait -= dt) > 0) return;
    // 选下一个去处
    this.lookAt = undefined; this.run = false;
    const r = Math.random(), gates = S.gates.filter(gateVisible), edges = S.exits.filter(e => (e.side === 'left' || e.side === 'right') && !e.locked);
    if (S.kind === 'field' && gates.length && r < 0.45) { const g = pick(gates); this.go(g.x + rnd(-10, 10), 22); this.leaving = true; }
    else if (edges.length && r < (S.kind === 'field' ? 0.7 : 0.14)) { const e = pick(edges); this.go(e.side === 'left' ? 40 : S.width - 40, rnd(40, DEPTH - 40)); this.leaving = true; }
    else if (world.npcs.length && r < 0.5) { const n = pick(world.npcs), side = Math.random() < 0.5 ? -1 : 1; this.go(n.x + side * rnd(55, 80), clamp(n.y + rnd(-10, 25), 20, DEPTH - 20)); this.lookAt = n.x; }
    else this.go(rnd(120, S.width - 120), rnd(24, DEPTH - 24));
  }
  go(x, y) { this.tx = clamp(x, 30, world.S.width - 30); this.ty = clamp(y, 8, DEPTH - 8); this.st = 'move'; this.run = Math.abs(this.tx - this.x) > 700 && Math.random() < 0.5; this.pose.__c = this.run ? 'run' : 'walk'; this.pose.__t = 0; }
  drawShadow(c) { if (this.a <= 0) return; const X = sx(this.x), Y = sy(this.y); if (X < -60 || X > WW + 60) return; c.fillStyle = `rgba(0,0,0,${0.3 * this.a})`; c.beginPath(); c.ellipse(X, Y, 18, 6, 0, 0, TAU); c.fill(); }
  draw(c) {
    const X = sx(this.x), Y = sy(this.y); if (this.a <= 0 || X < -80 || X > WW + 80) return;
    c.save(); c.globalAlpha = this.a; c.translate(X, Y); c.scale(this.face, 1); this.model.draw(c, this.pose, game.t + this.seed, NO_OPTS); c.restore();
    c.save(); c.globalAlpha = this.a * 0.95; c.font = 'bold 9px "PingFang SC","Microsoft YaHei",sans-serif'; c.textAlign = 'center'; c.lineWidth = 3; c.strokeStyle = 'rgba(0,0,0,.8)';
    const ny = sy(this.y, 124);
    if (this.guild) { c.strokeText(`<${this.guild}>`, X, ny - 11); c.fillStyle = '#a8e6a0'; c.fillText(`<${this.guild}>`, X, ny - 11); }
    c.strokeText(this.name, X, ny); c.fillStyle = '#ffffff'; c.fillText(this.name, X, ny); c.restore();
  }
}
function crowdSize(S) { return S.crowd ?? (S.interior ? 0 : S.kind === 'field' ? 2 : Math.max(3, Math.round(S.width / 650))); }
function spawnCrowd(S) {
  const n = crowdSize(S); if (!n) return;
  const W0 = world;
  loadArtKeys(CROWD_CLS.flatMap(crowdFrames)).then(() => {
    if (world !== W0) return;
    const used = new Set();
    for (let i = 0; i < n; i++) world.crowd.push(makePasserby(S, used, true));
  });
}
function makePasserby(S, used, anywhere) {
  const cls = pick(CROWD_CLS.filter(c => SPR_DATA[c] && IMG[`spr/${c}/idle`])); if (!cls) return null;
  let name = pick(CROWD_NAMES); for (let k = 0; k < 6 && used.has(name); k++) name = pick(CROWD_NAMES); used.add(name);
  const looks = CROWD_LOOKS[cls].filter((l, i) => i || !game.player || game.player.cls !== cls);
  const w = new Passerby({ cls, name, guild: pick(CROWD_GUILDS), model: new SpriteModel(cls, SPR_FALLBACK, SPR_ANIMS[cls], pick(looks)) });
  const edges = S.exits.filter(e => (e.side === 'left' || e.side === 'right') && !e.locked), gates = S.gates.filter(gateVisible);
  if (anywhere) { w.x = rnd(150, S.width - 150); w.y = rnd(30, DEPTH - 30); }
  else if (S.kind === 'field' && gates.length && Math.random() < 0.6) { const g = pick(gates); w.x = g.x; w.y = 24; }   // 刚从地下城出来
  else if (edges.length) { const e = pick(edges); w.x = e.side === 'left' ? 40 : S.width - 40; w.y = rnd(40, DEPTH - 40); }
  else { w.x = rnd(150, S.width - 150); w.y = rnd(30, DEPTH - 30); }
  w.face = Math.random() < 0.5 ? -1 : 1;
  return w;
}
function updateCrowdPool() {
  const S = world.S, C = world.crowd;
  for (let i = C.length - 1; i >= 0; i--) if (C[i].gone) C.splice(i, 1);
  if (C.length < crowdSize(S) && Math.random() < 0.004) { const w = makePasserby(S, new Set(C.map(c => c.name)), false); if (w) C.push(w); }
}
/* =====================================================================
   环境粒子：落叶 / 花瓣 / 光尘 / 魔法光点 / 海鸥（按场景的 ambient 选择；区域地图沿用主题自带的萤火虫、雨等）
   ===================================================================== */
const hh = (i, k) => { const s = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return s - Math.floor(s); };
function drawAmbient(c, kind, back) {
  const t = game.t;
  if (kind === 'gulls' && back) {   // 海鸥：远景里飞过
    c.save(); c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = 1.6;
    for (let i = 0; i < 5; i++) {
      const sp = 22 + hh(i, 1) * 26, x = ((hh(i, 2) * 1400 + t * sp - cam.x * 0.25) % 1300 + 1300) % 1300 - 170, y = 40 + hh(i, 3) * 120 + Math.sin(t * 0.7 + i) * 10, f = Math.sin(t * 6 + i * 2) * 3.5;
      c.beginPath(); c.moveTo(x - 8, y - f); c.quadraticCurveTo(x - 4, y - 3, x, y); c.quadraticCurveTo(x + 4, y - 3, x + 8, y - f); c.stroke();
    }
    c.restore(); return;
  }
  if (back) return;
  c.save();
  if (kind === 'leaves' || kind === 'petals') {
    const cols = kind === 'leaves' ? ['#9fd26a', '#e8b34a', '#d9793a', '#7cc05a'] : ['#ffc6dd', '#ffe0ec', '#ffffff', '#ffb0cc'];
    for (let i = 0; i < 16; i++) {
      const fall = 26 + hh(i, 4) * 22, ph = (t * fall / 600 + hh(i, 5)) % 1, x = ((hh(i, 6) * 1300 - cam.x * 1.05 + Math.sin(t * 1.3 + i) * 30 + ph * 120) % 1150 + 1150) % 1150 - 95, y = -20 + ph * 580;
      c.save(); c.translate(x, y); c.rotate(t * (1 + hh(i, 7) * 2) + i); c.scale(1, 0.45 + 0.45 * Math.sin(t * 3 + i)); c.fillStyle = cols[i % cols.length]; c.globalAlpha = 0.85;
      c.beginPath(); c.ellipse(0, 0, kind === 'leaves' ? 4.5 : 3.2, kind === 'leaves' ? 2.2 : 2.6, 0, 0, TAU); c.fill(); c.restore();
    }
  } else if (kind === 'sunbeam' || kind === 'dust') {
    if (kind === 'sunbeam') {   // 室内：窗外斜射进来的光柱
      c.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 3; i++) { const x = 300 + i * 90 - cam.x * 0.2, a = 0.05 + 0.025 * Math.sin(t * 0.6 + i); const g = c.createLinearGradient(x, 0, x + 160, 380); g.addColorStop(0, `rgba(255,236,170,${a})`); g.addColorStop(1, 'rgba(255,236,170,0)'); c.fillStyle = g; c.beginPath(); c.moveTo(x, 0); c.lineTo(x + 50, 0); c.lineTo(x + 230, 380); c.lineTo(x + 140, 380); c.closePath(); c.fill(); }
    }
    for (let i = 0; i < 22; i++) {
      const x = ((hh(i, 8) * 1200 - cam.x * 0.9 + Math.sin(t * 0.3 + i) * 40) % 1100 + 1100) % 1100 - 70, y = 60 + hh(i, 9) * 380 + Math.sin(t * 0.5 + i * 1.7) * 20, a = 0.35 + 0.35 * Math.sin(t * 1.4 + i);
      c.fillStyle = kind === 'sunbeam' ? `rgba(255,240,190,${a})` : `rgba(255,230,180,${a * 0.6})`; c.fillRect(x, y, 2, 2);
    }
  } else if (kind === 'magic' || kind === 'lantern') {
    c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 22; i++) {
      const ph = (t * (0.05 + hh(i, 10) * 0.07) + hh(i, 11)) % 1, x = ((hh(i, 12) * 1250 - cam.x * 0.95 + Math.sin(t + i) * 16) % 1100 + 1100) % 1100 - 70, y = 520 - ph * 520, a = Math.sin(ph * Math.PI);
      const col = kind === 'magic' ? (i % 2 ? '190,140,255' : '140,200,255') : '255,200,120';
      c.fillStyle = `rgba(${col},${0.7 * a})`; c.fillRect(x, y, 2, 2); c.fillStyle = `rgba(${col},${0.14 * a})`; c.beginPath(); c.arc(x + 1, y + 1, 6, 0, TAU); c.fill();
    }
  }
  c.restore();
}
/* =====================================================================
   渲染
   ===================================================================== */
// 小道具的动画：挂布 / 旗子按条带做波动，植物摇摆，水晶漂浮
function drawProp(c, pr, X, Y, w, h, im) {
  const t = game.t + pr.x * 0.01, a = pr.anim;
  c.save();
  if (pr.flip) { c.translate(X + w / 2, 0); c.scale(-1, 1); c.translate(-(X + w / 2), 0); }
  if (a === 'flag' || a === 'hang') {
    const n = 14;
    for (let i = 0; i < n; i++) {
      const f = i / n;
      if (a === 'flag') { const sx0 = im.width * f, sw = im.width / n + 1, off = Math.sin(t * 3.2 - f * 5) * 3 * f; c.drawImage(im, sx0, 0, sw, im.height, X + w * f, Y + off, w / n + 0.6, h); }
      else { const sy0 = im.height * f, sh = im.height / n + 1, off = Math.sin(t * 2.4 - f * 4) * 3.5 * f; c.drawImage(im, 0, sy0, im.width, sh, X + off, Y + h * f, w, h / n + 0.6); }
    }
  } else if (a === 'sway' || a === 'breathe') {
    c.translate(X + w / 2, Y + h);
    if (a === 'sway') c.rotate(Math.sin(t * 1.3) * 0.018); else c.scale(1 - Math.sin(t * 2.4) * 0.01, 1 + Math.sin(t * 2.4) * 0.025);
    c.drawImage(im, -w / 2, -h, w, h);
  } else if (a === 'bob') c.drawImage(im, X, Y + Math.sin(t * 1.8) * 4 - 2, w, h);
  else c.drawImage(im, X, Y, w, h);
  c.restore();
  if (pr.glow) {   // 灯火 / 水晶的光晕（叠加模式，轻微闪烁）
    const [gx, gy, r = 40, col = '255,210,120'] = pr.glow, cx = X + (pr.flip ? 1 - gx : gx) * w, cy = Y + gy * h + (a === 'bob' ? Math.sin(t * 1.8) * 4 - 2 : 0), fl = 0.75 + 0.15 * Math.sin(t * 7.3) + 0.1 * Math.sin(t * 13.1);
    c.save(); c.globalCompositeOperation = 'lighter'; const g = c.createRadialGradient(cx, cy, 1, cx, cy, r); g.addColorStop(0, `rgba(${col},${0.45 * fl})`); g.addColorStop(1, `rgba(${col},0)`); c.fillStyle = g; c.fillRect(cx - r, cy - r, r * 2, r * 2); c.restore();
  }
  if (a === 'fountain') {   // 喷泉：水珠抛物线
    const cx = X + w * 0.5, top = Y + h * (pr.src || 0.28);
    c.save(); c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 26; i++) {
      const ph = (game.t * 0.9 + hh(i, 13)) % 1, dir = (hh(i, 14) - 0.5) * 2, vx = dir * w * 0.32, px = cx + vx * ph, py = top - Math.sin(ph * Math.PI) * h * 0.14 + ph * h * 0.2;
      c.fillStyle = `rgba(190,230,255,${0.75 * (1 - ph)})`; c.beginPath(); c.arc(px, py, 1.6, 0, TAU); c.fill();
    }
    c.restore();
  }
}
const propRect = pr => { const im = IMG[pr.art]; if (!im) return null; const h = pr.h || 200, w = im.width * h / im.height; return { im, w, h, X: sx(pr.x) - w / 2, Y: sy(pr.y ?? -14, 0) - h }; };
function renderScene(c) {
  const R = game.room, S = world.S;
  drawRoomBack(c, R);
  if (S.ambient && !S.interior) drawAmbient(c, S.ambient, true);
  // 建筑 / 道具：贴在后墙线上（与地面同一视差）
  for (const pr of S.props) {
    if (pr.y !== undefined) continue;
    const r = propRect(pr); if (!r || r.X > WW + 40 || r.X + r.w < -40) continue;
    drawProp(c, pr, r.X, r.Y, r.w, r.h, r.im);
  }
  for (const g of S.gates) drawGate(c, g);
  for (const ex of S.exits) if (ex.side === 'up' || ex.side === 'down') drawDoorExit(c, S, ex);
  for (const e of ents) e.drawShadow(c);
  for (const w of world.crowd) w.drawShadow(c);
  const ground = S.props.filter(pr => pr.y !== undefined).map(pr => ({ y: pr.y, draw: cc => { const r = propRect(pr); if (r && r.X < WW + 40 && r.X + r.w > -40) drawProp(cc, pr, r.X, r.Y, r.w, r.h, r.im); } }));
  const list = [...ents, ...fxList, ...world.crowd, ...ground].sort((a, b) => a.y - b.y);
  for (const o of list) o.draw(c);
  // NPC 名牌 + 任务标记
  for (const e of world.npcs) {
    const N = e.npc, X = sx(e.x), Y = sy(e.y, N.h + 16), hot = world.near === e || world.hover === e;
    if (X < -100 || X > WW + 100) continue;
    c.font = `bold ${hot ? 11 : 10}px "PingFang SC","Microsoft YaHei",sans-serif`; c.textAlign = 'center';
    c.lineWidth = 3; c.strokeStyle = '#000'; c.strokeText(N.name, X, Y); c.fillStyle = hot ? '#fff6c0' : '#ffe070'; c.fillText(N.name, X, Y);
    if (N.title) { c.font = 'bold 8px sans-serif'; c.strokeText(`[${N.title}]`, X, Y - 11); c.fillStyle = '#9fe0ff'; c.fillText(`[${N.title}]`, X, Y - 11); }
    if (typeof drawQuestMarker === 'function') drawQuestMarker(c, X, Y - 24, N.id);
    else {
      const mk = typeof questMarker === 'function' ? questMarker(N.id) : null;
      if (mk) { const bob = Math.sin(game.t * 4) * 2; c.font = '900 18px "Arial Black",sans-serif'; c.lineWidth = 4; c.strokeText(mk, X, Y - 24 + bob); c.fillStyle = mk === '?' ? '#6aff6a' : '#ffd23a'; c.fillText(mk, X, Y - 24 + bob); }
    }
  }
  // 左右出口：箭头 + 目的地名牌
  for (const ex of S.exits) {
    if (ex.side !== 'left' && ex.side !== 'right') continue;
    const X = ex.side === 'left' ? 22 - cam.x : S.width - 22 - cam.x, Y = sy(DEPTH / 2, 0);
    if (X < -80 || X > WW + 80) continue;
    const dir = ex.side === 'left' ? -1 : 1, bob = Math.sin(game.t * 4) * 3, T = SCENES[ex.to], off = !!ex.locked || !T || (ex.minLv && game.lvl < ex.minLv);
    c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = off ? 'rgba(200,200,200,.35)' : 'rgba(255,230,140,.75)';
    for (let i = 0; i < 3; i++) { const x = X + dir * (i * 10 + bob); c.beginPath(); c.moveTo(x, Y - 12); c.lineTo(x + dir * 12, Y); c.lineTo(x, Y + 12); c.closePath(); c.fill(); }
    c.restore();
    plate(c, X - dir * 30, Y - 36, exitLabel(S, ex), exitSub(ex), off ? '#b8b0a0' : '#fff0c0', false);
  }
  for (const f of world.fx) drawWorldFx(c, f);
  if (S.ambient) drawAmbient(c, S.ambient, false);
  drawNumbers(c);
  drawRoomFore(c, R);
}
const exitLabel = (S, ex) => { const T = SCENES[ex.to]; if (ex.label) return ex.label; if (!T) return '？？？'; return T.name === S.name ? T.area || T.name : T.name; };
const exitSub = ex => ex.locked ? '未开放' : ex.minLv && game.lvl < ex.minLv ? `Lv.${ex.minLv} 可进入` : '';
// 后墙的门 / 路口（up）与场景下缘的路口（down）：地上的光圈 + 箭头 + 名牌
function drawDoorExit(c, S, ex) {
  const X = sx(ex.x), up = ex.side === 'up', Y = sy(up ? 4 : DEPTH - 2, 0); if (X < -120 || X > WW + 120) return;
  const T = SCENES[ex.to], off = !!ex.locked || !T || (ex.minLv && game.lvl < ex.minLv), near = Math.abs(game.player.x - ex.x) < 90;
  c.save(); c.globalCompositeOperation = 'lighter';
  const a = (off ? 0.12 : 0.22) + 0.08 * Math.sin(game.t * 3), g = c.createRadialGradient(X, Y, 2, X, Y, 60);
  g.addColorStop(0, off ? `rgba(200,200,200,${a})` : `rgba(255,220,140,${a})`); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.beginPath(); c.ellipse(X, Y, 60, 16, 0, 0, TAU); c.fill();
  c.fillStyle = off ? 'rgba(200,200,200,.4)' : 'rgba(255,230,140,.8)';
  const dir = up ? -1 : 1, bob = Math.sin(game.t * 4) * 2;
  for (let i = 0; i < 2; i++) { const y = Y + dir * (i * 7 + bob) - (up ? 0 : 6); c.beginPath(); c.moveTo(X - 12, y); c.lineTo(X, y + dir * 7); c.lineTo(X + 12, y); c.lineTo(X, y + dir * 3); c.closePath(); c.fill(); }
  c.restore();
  if (near || !ex.door) plate(c, X, up ? Y - 14 : Y - 22, exitLabel(S, ex), exitSub(ex), off ? '#b8b0a0' : '#fff0c0', near);
}
/* ---- 地下城门：各地下城自己的门（GATE_ART）+ 旋转的传送门光 + 门牌（名字、等级，按玩家等级着色） ---- */
function gateArt(D) { const A = (typeof GATE_ART !== 'undefined' && GATE_ART[D.id]) || {}; return { art: A.art || (IMG['world/g_' + D.id] ? 'world/g_' + D.id : D.hidden ? 'world/b_gate_hidden' : 'world/b_gate'), portal: A.portal || [0.5, 0.52, 0.2, 0.3], col: A.col || (D.hidden ? '220,120,255' : '140,220,255'), h: A.h || 200 }; }
function drawGate(c, g) {
  if (!gateVisible(g)) return;
  const D = DUNGEONS[g.dungeon], A = gateArt(D), im = IMG[A.art], h = A.h, X = sx(g.x), Y = sy(-12, 0);
  if (X < -220 || X > WW + 220) return;
  const rv = world.fx.find(f => f.type === 'reveal' && f.x === g.x), alpha = rv ? clamp((rv.t - 0.7) / 1.1, 0, 1) : 1;
  if (alpha <= 0) return;
  c.save(); c.globalAlpha = alpha;
  let w = h;
  if (im) { w = im.width * h / im.height; c.drawImage(im, X - w / 2, Y - h, w, h); }
  // 传送门：中心光晕 + 缓慢旋转的光带 + 被吸进去的光点
  const [px, py, rx, ry] = A.portal, cx = X - w / 2 + px * w, cy = Y - h + py * h, RX = rx * w, RY = ry * h, a = 0.22 + 0.1 * Math.sin(game.t * 3 + g.x);
  c.globalCompositeOperation = 'lighter';
  const gg = c.createRadialGradient(cx, cy, 2, cx, cy, Math.max(RX, RY)); gg.addColorStop(0, `rgba(${A.col},${a + 0.1})`); gg.addColorStop(1, `rgba(${A.col},0)`);
  c.fillStyle = gg; c.beginPath(); c.ellipse(cx, cy, RX, RY, 0, 0, TAU); c.fill();
  c.strokeStyle = `rgba(${A.col},${0.25 * alpha})`; c.lineWidth = 2;
  for (let i = 0; i < 3; i++) { const r0 = game.t * 1.6 + i * 2.1; c.beginPath(); c.ellipse(cx, cy, RX * (0.35 + 0.2 * i), RY * (0.35 + 0.2 * i), 0, r0, r0 + 1.6); c.stroke(); }
  for (let i = 0; i < 8; i++) { const ph = (game.t * 0.5 + hh(i, g.x)) % 1, an = hh(i, 21) * TAU + game.t * 0.8, r = 1 - ph; c.fillStyle = `rgba(255,255,255,${0.7 * ph})`; c.fillRect(cx + Math.cos(an) * RX * 1.1 * r, cy + Math.sin(an) * RY * 1.05 * r, 2, 2); }
  c.restore();
  const lv = game.lvl, col = lv < D.lvl[0] - 1 ? '#ff8a7a' : lv > D.lvl[1] + 2 ? '#b8b8b8' : D.hidden ? '#e0a0ff' : '#ffe8a0';
  c.save(); c.globalAlpha = alpha; plate(c, X, Y - h - 6, D.name, `${D.hidden ? '隐藏 · ' : ''}Lv.${D.lvl[0]}~${D.lvl[1]}`, col, world.gateLock === g); c.restore();
}
function drawWorldFx(c, f) {
  const k = f.t / f.dur;
  if (f.type === 'reveal') {   // 隐藏门现身：天降光柱 → 地面光环扩散 → 门淡入 + 光点四散
    const X = sx(f.x), Y = sy(-12, 0), col = f.col;
    c.save(); c.globalCompositeOperation = 'lighter';
    const beam = k < 0.6 ? k / 0.6 : 1 - (k - 0.6) / 0.4, bw = 40 + 60 * Math.sin(Math.min(1, k * 2) * Math.PI / 2);
    const g = c.createLinearGradient(X - bw, 0, X + bw, 0); g.addColorStop(0, `rgba(${col},0)`); g.addColorStop(0.5, `rgba(255,255,255,${0.75 * beam})`); g.addColorStop(1, `rgba(${col},0)`);
    c.fillStyle = g; c.fillRect(X - bw, 0, bw * 2, Y);
    for (let i = 0; i < 3; i++) { const kk = clamp(k * 1.6 - i * 0.18, 0, 1); if (kk <= 0 || kk >= 1) continue; c.strokeStyle = `rgba(${col},${(1 - kk) * 0.9})`; c.lineWidth = 3; c.beginPath(); c.ellipse(X, Y, 30 + kk * 220, 8 + kk * 50, 0, 0, TAU); c.stroke(); }
    for (let i = 0; i < 30; i++) { const an = hh(i, 31) * TAU, sp = 40 + hh(i, 32) * 160, r = sp * k; c.fillStyle = `rgba(${i % 3 ? col : '255,255,255'},${(1 - k)})`; c.fillRect(X + Math.cos(an) * r, Y - 90 + Math.sin(an) * r * 0.7 - k * 30, 3, 3); }
    c.restore();
    if (k < 0.25) { c.fillStyle = `rgba(255,255,255,${(0.25 - k) * 1.6})`; c.fillRect(0, 0, WW, WH); }
  } else if (f.type === 'warp') {   // 区域移动到达：脚下的传送光环
    const X = sx(f.x), Y = sy(f.y, 0);
    c.save(); c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 2; i++) { const kk = clamp(k * 1.4 - i * 0.25, 0, 1); c.strokeStyle = `rgba(140,220,255,${1 - kk})`; c.lineWidth = 3; c.beginPath(); c.ellipse(X, Y, 20 + kk * 70, 6 + kk * 20, 0, 0, TAU); c.stroke(); }
    const g = c.createLinearGradient(0, Y - 140, 0, Y); g.addColorStop(0, 'rgba(140,220,255,0)'); g.addColorStop(1, `rgba(180,235,255,${0.5 * (1 - k)})`); c.fillStyle = g; c.fillRect(X - 26, Y - 140, 52, 140);
    c.restore();
  }
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
/* ---- 城镇 UI（1920×1080 坐标）：右上角当前位置、进入新区域时的大字区域名、对话提示、任务追踪、提示消息 ---- */
function worldUI(c) {
  const S = world.S;
  // 右上角：城镇名 + 小区域名
  c.save(); c.font = '800 30px "PingFang SC","Microsoft YaHei",sans-serif'; const w = Math.max(200, c.measureText(S.name).width + 70);
  const g = c.createLinearGradient(1900 - w, 0, 1900, 0); g.addColorStop(0, 'rgba(10,8,16,0)'); g.addColorStop(0.35, 'rgba(10,8,16,.55)'); g.addColorStop(1, 'rgba(10,8,16,.7)');
  c.fillStyle = g; c.fillRect(1900 - w, 14, w, S.area && S.area !== S.name ? 86 : 54); c.restore();
  uiText(S.name, 1880, 52, { size: 30, align: 'right', color: '#ffe8a8', sw: 5 });
  if (S.area && S.area !== S.name) uiText(S.area, 1880, 86, { size: 20, align: 'right', color: '#d8d0b8', sw: 3 });
  if (world.banner) drawAreaBanner(c, world.banner);
  if (world.near && !menus.modal()) uiText(`按 ${typeof keyName === 'function' ? keyName('attack') : 'X'} 或点击与 ${world.near.npc.name} 对话`, 960, 700, { size: 28, align: 'center', color: '#ffe8a8', sw: 5 });
  if (typeof drawQuestTracker === 'function') drawQuestTracker(c);
  drawToasts(c);
}
// 官方式的区域名：屏幕上方中间，金色大字 + 两侧饰线，淡入 0.5 秒、停留、淡出
function drawAreaBanner(c, B) {
  const t = B.t, a = t < 0.5 ? t / 0.5 : t > 2.5 ? Math.max(0, 1 - (t - 2.5) / 0.7) : 1; if (a <= 0) return;
  const y = 214, rise = (1 - Math.min(1, t / 0.5)) * 14;
  c.save(); c.globalAlpha = a;
  c.font = '900 64px "PingFang SC","Microsoft YaHei",serif'; const w = c.measureText(B.big).width;
  const lw = 150 + Math.min(1, t / 0.7) * 90;
  for (const s of [-1, 1]) {
    const x0 = 960 + s * (w / 2 + 26), g = c.createLinearGradient(x0, 0, x0 + s * lw, 0); g.addColorStop(0, 'rgba(255,220,140,.95)'); g.addColorStop(1, 'rgba(255,220,140,0)');
    c.fillStyle = g; c.fillRect(Math.min(x0, x0 + s * lw), y - 24 + rise, lw, 3);
    c.save(); c.translate(x0 + s * 6, y - 22.5 + rise); c.rotate(Math.PI / 4); c.fillStyle = '#ffe2a0'; c.fillRect(-5, -5, 10, 10); c.restore();
  }
  c.restore();
  c.save(); c.globalAlpha = a;
  uiText(B.big, 960, y + rise, { size: 64, weight: 900, align: 'center', color: '#ffe6a6', sw: 8, stroke: 'rgba(40,20,0,.9)' });
  if (B.small) uiText(B.small, 960, y + 50 + rise, { size: 30, align: 'center', color: '#f4ecd8', sw: 5 });
  c.restore();
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
/* =====================================================================
   内容校验：启动时检查场景出口是否互相连通、NPC / 地下城引用是否存在、美术素材是否齐全
   开发环境（本地文件 / localhost / ?dev）用 console.error 报出来，线上只 console.warn；返回问题列表（测试用）
   ===================================================================== */
function validateWorld() {
  const P = [], err = m => P.push(m), has = k => !!ASSET_SRC[k];
  if (!SCENES[START_SCENE]) err(`START_SCENE 指向不存在的场景 ${START_SCENE}`);
  const placed = new Set(), gated = new Set();
  for (const id in SCENES) {
    const S = SCENES[id], at = `场景 ${id}`;
    if (!S.name) err(`${at} 缺少 name`);
    if (!S.map) err(`${at} 缺少世界地图坐标 map`);
    if (!(S.width >= WW)) err(`${at} 宽度 ${S.width} 小于一屏 ${WW}`);
    for (const k of ['far', 'floor']) if (!has(`bg/${S.theme}_${k}`)) err(`${at} 缺少背景素材 bg/${S.theme}_${k}`);
    for (const ex of S.exits) {
      if (!['left', 'right', 'up', 'down'].includes(ex.side)) err(`${at} 出口 side 无效：${ex.side}`);
      if ((ex.side === 'up' || ex.side === 'down') && typeof ex.x !== 'number') err(`${at} 的 ${ex.side} 出口缺少 x`);
      if (ex.locked) continue;
      const T = SCENES[ex.to];
      if (!T) { err(`${at} 的出口指向不存在的场景 ${ex.to}`); continue; }
      if (!T.exits.some(e => e.to === id && !e.locked)) err(`${at} → ${ex.to} 是单向的：${ex.to} 没有回到 ${id} 的出口`);
    }
    const sides = S.exits.filter(e => e.side === 'left' || e.side === 'right').map(e => e.side);
    if (new Set(sides).size !== sides.length) err(`${at} 同一侧有多个边缘出口`);
    for (const n of S.npcs) {
      if (!NPCS[n.npc]) err(`${at} 引用了未定义的 NPC ${n.npc}`);
      else if (placed.has(n.npc)) err(`NPC ${n.npc} 同时出现在多个场景`);
      placed.add(n.npc);
      if (n.x < 40 || n.x > S.width - 40) err(`${at} 的 NPC ${n.npc} 站在场景外（x=${n.x}）`);
    }
    for (const g of S.gates) {
      const D = DUNGEONS[g.dungeon];
      if (!D) { err(`${at} 的门指向不存在的地下城 ${g.dungeon}`); continue; }
      gated.add(g.dungeon);
      if (!has(gateArt(D).art)) err(`地下城 ${g.dungeon} 缺少门的素材 ${gateArt(D).art}`);
      if (!D.theme || !has(`bg/${D.theme}_far`)) err(`地下城 ${g.dungeon} 缺少背景 bg/${D.theme}_far`);
    }
    for (const pr of S.props) if (!has(pr.art)) err(`${at} 缺少道具素材 ${pr.art}`);
  }
  for (const id in NPCS) {
    const N = NPCS[id];
    if (!placed.has(id)) err(`NPC ${id} 没有放进任何场景`);
    if (N.art && !has(N.art)) err(`NPC ${id} 缺少立绘 ${N.art}`);
    if (typeof NPC_SERVICES !== 'undefined') for (const s of N.services) { const k = s.split(':')[0]; if (!NPC_SERVICES[k] && !WORLD_LATE_SERVICES.includes(k)) err(`NPC ${id} 的功能 ${k} 没有在 NPC_SERVICES 注册`); }
  }
  for (const id in DUNGEONS) if (!gated.has(id)) err(`地下城 ${id} 没有放在任何区域地图的门里`);
  // 从出生点出发，所有场景都能走到
  const seen = new Set([START_SCENE]), q = [START_SCENE];
  while (q.length) { const S = SCENES[q.shift()]; if (!S) continue; for (const ex of S.exits) if (SCENES[ex.to] && !ex.locked && !seen.has(ex.to)) { seen.add(ex.to); q.push(ex.to); } }
  for (const id in SCENES) if (!seen.has(id)) err(`场景 ${id} 从出生点走不到`);
  const dev = location.protocol === 'file:' || /^(localhost|127\.|0\.0\.0\.0)/.test(location.hostname) || PARAMS.has('dev');
  for (const m of P) (dev ? console.error : console.warn)('[内容校验] ' + m);
  return P;
}
// 由其他模块稍后注册的 NPC 功能（校验时不算错）：arena = 决斗场（战斗组）
const WORLD_LATE_SERVICES = ['arena'];
