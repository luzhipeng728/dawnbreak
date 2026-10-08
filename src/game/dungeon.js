/* =====================================================================
   18. 地下城：房间网格生成、门与转场、小地图、清房、领主房、实时评价、结算、死亡与复活币
   ===================================================================== */
const DIFFS = [
  { name: '普通', hp: 1, atk: 1, exp: 1, drop: 0, col: '#e8e8e8' },
  { name: '冒险', hp: 1.6, atk: 1.3, exp: 1.4, drop: 0.08, col: '#68b8ff' },
  { name: '勇士', hp: 2.56, atk: 1.69, exp: 1.8, drop: 0.16, col: '#ff9a2a' },
  { name: '王者', hp: 4.1, atk: 2.2, exp: 2.2, drop: 0.26, col: '#ff4a4a' },
];
const RANKS = [['F', 0, 0], ['E', 35, 0], ['D', 45, 0], ['C', 55, 0], ['B', 65, 0.05], ['A', 75, 0.1], ['S', 85, 0.15], ['SS', 95, 0.2], ['SSS', 105, 0.3]];
const RANK_COL = { F: '#8a8a8a', E: '#9a9a9a', D: '#b0b0b0', C: '#9ad0ff', B: '#6ab8ff', A: '#6aff9a', S: '#ffd23a', SS: '#ff9a2a', SSS: '#ff4a6a' };
function rankOf(score) { let r = RANKS[0]; for (const x of RANKS) if (score >= x[1]) r = x; return r; }

/* ---- 生成房间网格：从起点随机游走到领主房，再加若干支路（def.fixed = 固定房间结构，见 genFixedLayout）---- */
function genLayout(def, seed) {
  if (def.fixed) return genFixedLayout(def.fixed, seed);
  const R = mulberry(seed), cols = def.cols || 4, rows = def.rows || 3, n = def.rooms || 6;
  const key = (x, y) => x + ',' + y, rooms = new Map();
  let x = 0, y = Math.floor(rows / 2);
  const add = (x, y, from) => { let r = rooms.get(key(x, y)); if (!r) { r = { gx: x, gy: y, doors: {}, type: 'normal' }; rooms.set(key(x, y), r); } if (from) { const d = dirTo(from, r); from.doors[d] = r; r.doors[OPP[d]] = from; } return r; };
  let cur = add(x, y); cur.type = 'start';
  const path = [cur];
  let guard = 0;
  while (path.length < n && guard++ < 400) {
    const opts = [[1, 0], [0, -1], [0, 1], [1, 0], [1, 0]].map(([dx, dy]) => [cur.gx + dx, cur.gy + dy]).filter(([a, b]) => a >= 0 && b >= 0 && a < cols && b < rows && !rooms.has(key(a, b)));
    if (!opts.length) break;
    const [nx, ny] = opts[Math.floor(R() * opts.length)];
    cur = add(nx, ny, cur); path.push(cur);
  }
  cur.type = 'boss';
  // 支路：从主路上随机挂 1~3 个房间
  const branches = def.branches ?? Math.floor(n / 3);
  for (let i = 0; i < branches; i++) {
    const base = path[1 + Math.floor(R() * Math.max(1, path.length - 2))];
    const opts = [[1, 0], [-1, 0], [0, -1], [0, 1]].map(([dx, dy]) => [base.gx + dx, base.gy + dy]).filter(([a, b]) => a >= 0 && b >= 0 && a < cols && b < rows && !rooms.has(key(a, b)));
    if (!opts.length) continue;
    const [nx, ny] = opts[Math.floor(R() * opts.length)];
    const r = add(nx, ny, base); if (R() < 0.35) r.type = 'elite';
  }
  return { rooms: [...rooms.values()], cols, rows, start: path[0], boss: cur, pathLen: path.length };
}
/* ---- 固定房间结构（团本节点等官方固定地图）：不随机游走，房间位置 / 连通 / 类型都写死；只有出生房、领主房可以在候选里按种子抽
   fixed = { cols, rows, rooms: [{ at: [x, y], type: 'normal' | 'elite' | 'boss', prep 准备房（不刷怪）, n 小怪数, mobs 本房小怪池 [[kind, 权重]…], elite 精英 kind, name 房间名 }],
             links: 'chain'（缺省：按数组顺序串起来）| 'grid'（相邻的全连通）| [[i, j]…], start: 下标 | [候选…], boss: 下标 | [候选…], hideBoss 小地图上没去过的领主房不标 ☠ }
   没被抽中的领主候选房变成普通小怪房；出生房是 start 类型（prep 的不刷怪）。同一个种子永远得到同一张图（组队全队一致）---- */
function genFixedLayout(F, seed) {
  const R = mulberry(seed), list = F.rooms.map(o => ({ gx: o.at[0], gy: o.at[1], doors: {}, type: o.type || 'normal', spec: o }));
  const link = (a, b) => { if (!a || !b || a === b) return; const d = dirTo(a, b); a.doors[d] = b; b.doors[OPP[d]] = a; };
  if (F.links === 'grid') { for (const a of list) for (const b of list) if (Math.abs(a.gx - b.gx) + Math.abs(a.gy - b.gy) === 1) link(a, b); }
  else if (Array.isArray(F.links)) for (const [i, j] of F.links) link(list[i], list[j]);
  else for (let i = 1; i < list.length; i++) link(list[i - 1], list[i]);
  const pick = v => { const c = [].concat(v ?? 0); return c[Math.floor(R() * c.length)]; };
  const si = pick(F.start), bossC = [].concat(F.boss ?? list.length - 1).filter(i => i !== si || list.length === 1), bi = bossC.length ? bossC[Math.floor(R() * bossC.length)] : si;
  for (const [i, r] of list.entries()) if (r.type === 'boss' && i !== bi) r.type = 'normal';
  const start = list[si], boss = list[bi];
  start.type = 'start'; boss.type = 'boss';
  return { rooms: list, cols: F.cols || Math.max(...list.map(r => r.gx)) + 1, rows: F.rows || Math.max(...list.map(r => r.gy)) + 1, start, boss, pathLen: list.length, fixed: true, hideBoss: !!F.hideBoss };
}
const OPP = { left: 'right', right: 'left', up: 'down', down: 'up' };
// 可以带着过门的动作：蓄气中的移动施法（charge.keepRoom）、开着走的载具（act.keepRoom = true 或 fn(p)，魔道学者 冰霜钻孔车 / 乌洛波洛斯之环）
function actKeepsRoom(p) {
  const a = p.act; if (!a) return false;
  if (a.charging && a.charge && a.charge.keepRoom) return true;
  return typeof a.keepRoom === 'function' ? !!a.keepRoom(p) : !!a.keepRoom;
}
function dirTo(a, b) { return b.gx > a.gx ? 'right' : b.gx < a.gx ? 'left' : b.gy < a.gy ? 'up' : 'down'; }

class Dungeon {
  // o（组队刷图，net/coop.js）：seed / roomSeeds = 队长发来的地图种子（全队同一张图）；guest = 队员（怪物由队长模拟，本地不刷怪、不判定清房）；hpMul = 怪物血量倍率（按人数）
  constructor(def, diff = 0, o = {}) {
    this.def = def; this.diff = diff; this.D = DIFFS[diff];
    this.seed = o.seed ?? ((Math.random() * 1e9) | 0);
    this.layout = genLayout(def, this.seed);
    this.t = 0; this.kills = 0; this.hurt = 0; this.combos5 = 0; this.aerial = 0; this.back = 0; this.counter = 0; this.overkill = 0; this.expGot = 0;
    this.roomsEntered = 0; this.transition = null; this.state = 'play'; this.flipStage = 'none'; this.lastComboCounted = 0; this.usedCoins = 0;
    this.guest = !!o.guest; this.hpMul = o.hpMul || 1;
    this.layout.rooms.forEach((r, i) => { r.visited = false; r.cleared = false; r.seed = o.roomSeeds ? o.roomSeeds[i] : (Math.random() * 1e9) | 0; });
  }
  start() {
    game.dungeon = this; game.scene = 'dungeon';
    ents.length = 0; projs.length = 0; drops.length = 0; fxList.length = 0; numList.length = 0; groundFx.length = 0;
    game.paused = false; game.timers.length = 0; game.slowmo = false; save.daily();
    const p = game.player; p.hp = p.hpMax; p.mp = p.mpMax; p.cool = {}; p.buffs = {}; p.status = {}; p.dead = false; p.setState('idle'); p.act = null;
    ents.push(p);
    this.enter(this.layout.start, null);
    music.play(this.def.bgm || 'dungeon');
    // 领主房单独的背景、稀有领主的精灵：进图时后台预载（到领主房还没载完就用普通背景 / 不换稀有领主）
    const B = this.def, pre = [...(B.bossTheme ? ['bg:' + B.bossTheme] : []), ...(B.bossAlt && MON[B.bossAlt.kind] ? monBundles([B.bossAlt.kind]) : [])];
    if (pre.length && typeof loadBundles === 'function') loadBundles(pre).catch(() => {});
    bus.emit('dungeonEnter', { id: this.def.id, diff: this.diff });
  }
  // 进入房间：from 为进来的方向（'left' 表示从本房间左门进来）
  enter(room, fromDir) {
    const first = !room.visited;
    if (first) { room.visited = true; this.roomsEntered++; save.useFatigue(1); }
    this.room = room;
    const W = (room.spec && room.spec.w) || (room.type === 'boss' ? 1400 : room.type === 'start' ? 1150 : 1150 + Math.floor(hash2(room.gx, room.gy) * 3) * 250);
    const BT = room.type === 'boss' && this.def.bossTheme, theme = BT && (hasArt(`bg/${BT}_far`) || THEMES[BT]) ? BT : this.def.theme;   // 领主房单独的背景（bossTheme）
    game.room = { x0: 0, x1: W, theme, seed: room.seed, doors: room.doors, type: room.type };
    buildRoomArt(game.room);
    for (let i = ents.length - 1; i >= 0; i--) if (ents[i].team !== 'p') ents.splice(i, 1);
    game.lastTarget = null;   // 换房间 / 换地下城：清掉上一个目标的血条
    projs.length = 0; drops.length = 0; fxList.length = 0; groundFx.length = 0; if (typeof msRoomReset === 'function') msRoomReset();   // 领主机制的逻辑计时器 / 残留区（game/mon_skills.js）
    const p = game.player;
    const pos = { left: [60, DEPTH / 2], right: [W - 60, DEPTH / 2], up: [W / 2, 20], down: [W / 2, DEPTH - 16] };
    const [px, py] = fromDir ? pos[fromDir] : [120, DEPTH / 2];
    // 能带进下一个房间的动作（actKeepsRoom）：换房后调 act.onRoom / charge.onRoom（重新瞄准、把载具摆到门口），其他动作照旧结束
    const carry = p.st === 'act' && actKeepsRoom(p);
    p.x = px; p.y = py; p.z = carry ? p.z : 0; p.vx = p.vy = p.vz = 0; p.face = fromDir === 'right' ? -1 : 1;
    if (carry) { const a = p.act; if (a.onRoom) a.onRoom(p); if (a.charge && a.charge.onRoom) a.charge.onRoom(p); } else { if (p.act) p.endAct(); p.setState('idle'); }
    p.juggle = 0; p.downHits = 0; p.bounced = false; p.stun = 0; p.drawFlip = false;
    cam.x = clamp(p.x - WW / 2, 0, W - WW);
    if (room.type === 'boss' && this.def.bossProps) bossPropsFx(this.def.bossProps, W);
    if (!room.cleared) this.spawnRoom(room, W, first); else this.onCleared(true);
    this.doorsOpen = room.cleared;
    if (first) bus.emit('roomEnter', { id: this.def.id, room, type: room.type });
    if (room.type === 'boss' && !room.cleared) { music.play(bossTrack(this.def)); toastMsg(`领主房 · ${MON[this.def.boss.kind].name}`, '#ff6a4a'); }
  }
  spawnRoom(room, W, first) {
    if (this.guest) { this.waves = []; return; }   // 组队的队员：怪物由队长那边生成后同步过来
    const def = this.def, D = this.D, R = mulberry(room.seed);
    const lv = def.lvl[0] + Math.floor(R() * (def.lvl[1] - def.lvl[0] + 1));
    const o = { lvl: lv, mul: D.hp * this.hpMul, atkMul: D.atk, expMul: D.exp };
    const RS = room.spec || {}, pool = RS.mobs || def.mobs;   // 固定房间（genFixedLayout）可以单独写这个房间的小怪池 / 数量 / 准备房
    const pick = () => { const tot = pool.reduce((s, m) => s + m[1], 0); let r = R() * tot; for (const m of pool) { r -= m[1]; if (r <= 0) return m[0]; } return pool[0][0]; };
    const count = RS.prep ? 0 : RS.n ?? (room.type === 'start' ? 3 + Math.floor(R() * 2) : room.type === 'boss' ? def.bossAdds || 2 : room.type === 'elite' && RS.elite ? 0 : 4 + Math.floor(R() * 4));
    for (let i = 0; i < count; i++) spawnMonster(pick(), 380 + R() * (W - 480), 20 + R() * (DEPTH - 40), o);
    if (room.type === 'elite') spawnMonster(RS.elite || def.elite || pick(), W * 0.6, DEPTH / 2, { ...o, elite: true, lvl: lv + 1 });
    if (room.type === 'boss') {
      const A = def.bossAlt, alt = A && MON[A.kind] && Math.random() < (A.chance ?? 0.1) && monBundles([A.kind]).every(b => IMG[b.replace(/^spr:/, 'spr/') + '/idle']);   // 稀有领主替换（素材没载完就不换）
      const b = spawnMonster(alt ? A.kind : def.boss.kind, W - 320, DEPTH / 2, { ...o, lvl: def.boss.lvl, boss: true }); this.boss = b; game.lastTarget = b; game.lastTargetT = game.t;
      if (alt) game.after(0.6, () => toastMsg(A.say || `稀有领主 ${b.name} 出现了！`, '#ffd23a'));
      for (const P of def.bossProps || []) if (MON[P.kind]) spawnMonster(P.kind, P.x <= 1 ? W * P.x : P.x, (P.y ?? 0.5) <= 1 ? DEPTH * (P.y ?? 0.5) : P.y, { ...o, lvl: def.boss.lvl - 1 });   // 摆设里是怪物 id 的（投冰车、笼子……）由主机刷
    }
    // 第二波（大房间）
    this.waves = room.type === 'normal' && W > 1500 && !RS.prep ? [{ n: 3 + Math.floor(R() * 2), o }] : [];
  }
  update(dt) {
    this.t += dt;
    const p = game.player;
    // 转场
    if (this.transition) {
      const T = this.transition; T.t += dt;
      if (T.phase === 'out' && T.t >= 0.28) { this.enter(T.room, T.from); T.phase = 'in'; T.t = 0; }
      else if (T.phase === 'in' && T.t >= 0.28) this.transition = null;
      return;
    }
    if (this.state === 'dead') { this.deadT -= dt; if (this.deadT < 9.2 && input.hit('attack') && save.data.coins > 0) this.revive(); else if (this.deadT <= 0) this.fail(); return; }
    if (this.state === 'result') return;
    if (p.dead && this.state === 'play') { this.state = 'dead'; this.deadT = 10; sfx.gameOver(); bus.emit('playerDeath', { dungeon: this.def.id }); return; }
    // 连击统计：一段 ≥5 的连击结束时记一次操作分
    if (game.combo >= 5 && game.combo > this.lastComboCounted) this.pendingCombo = game.combo;
    if (game.combo === 0 && this.pendingCombo) { this.combos5++; this.pendingCombo = 0; }
    this.lastComboCounted = game.combo;
    const alive = ents.filter(e => e.team === 'e' && !e.dead).length;
    if (!this.guest && !this.room.cleared && alive === 0) {
      if (this.waves && this.waves.length) { const w = this.waves.shift(); for (let i = 0; i < w.n; i++) spawnMonster(pick(this.def.mobs)[0], cam.x + rnd(80, WW - 80), rnd(20, DEPTH - 20), { ...w.o, drop: true }); }
      else if (this.room.type !== 'boss') { this.room.cleared = true; this.onCleared(false); }
    }
    // 门
    if (this.doorsOpen && !p.dead && (p.st !== 'act' || actKeepsRoom(p))) {
      const R = game.room, W = R.x1;
      const pad = (p.st === 'act' && p.act && p.act.doorPad) || 0;   // 载具（人坐在车上，车身宽、到不了墙边）：门的判定放宽一点
      for (const d in this.room.doors) {
        const hitDoor = d === 'left' ? p.x <= 30 + pad && Math.abs(p.y - DEPTH / 2) < 50 : d === 'right' ? p.x >= W - 30 - pad && Math.abs(p.y - DEPTH / 2) < 50
          : d === 'up' ? p.y <= 10 && Math.abs(p.x - W / 2) < 60 : p.y >= DEPTH - 8 && Math.abs(p.x - W / 2) < 60;
        if (hitDoor) { this.go(d); break; }
      }
    }
  }
  go(dir) {
    const next = this.room.doors[dir]; if (!next) return;
    if (!next.visited && save.data.fatigue <= 0) { toastMsg('疲劳值不足，无法进入新的房间', '#ff6a6a'); return; }
    lootAll(); projs.length = 0; groundFx.length = 0;
    this.transition = { phase: 'out', t: 0, room: next, from: OPP[dir] }; sfx.door();
  }
  onCleared(silent) {
    this.doorsOpen = true;
    if (!silent) { sfx.clear(); for (const d of drops) if (d.kind === 'gold') d.t = Math.max(d.t, 0.8); game.autoLoot = true; game.after(1.5, () => { game.autoLoot = false; }); }
  }
  onHit(t, dmg, counter, back) { if (t.st === 'air' || t.z > 4) this.aerial++; if (counter) this.counter++; if (back) this.back++; game.lastTarget = t; game.lastTargetT = game.t; }
  onKill(t, a) {
    this.kills++;
    const left = t.boss && !t.abyssLord ? this.bossLeft(t) : [];   // 多领主同场（duo / gauntlet，game/mon_skills.js）：还有别的领主活着 = 只倒下一个，不结算
    bus.emit('kill', { kind: t.kind, lvl: t.lvl, boss: !!t.boss, elite: !!t.elite, dungeon: this.def.id, x: t.x, y: t.y });
    if (left.length) { toastMsg(`${t.name}倒下了——还剩 ${left.length} 个领主！`, '#ffb070'); fxBurst(t.x, t.y, t.z + 60, 240, '#ffb070'); sfx.boom(1); cam.shake = Math.max(cam.shake, 8); }
    if (t.noLoot) return;
    const over = a.team === 'p' && t.lastDmg > t.hpMax * 0.3;
    if (over) { this.overkill++; fxText('OVER KILL', t.x, t.y, t.z + 14, { col: '#ff4aa0', size: 12 }); }
    const exp = t.exp || 20; gainExp(exp); this.expGot += exp;
    spawnCoins(t, Math.round(rndi(t.gold ? t.gold[0] : 5, t.gold ? t.gold[1] : 15) * (1 + t.lvl * 0.15) * (t.elite ? 3 : 1) * (t.boss ? 8 : 1)));
    if (window.rollDrop) { if (left.length) { t.boss = false; try { rollDrop(t, this); } finally { t.boss = true; } } else rollDrop(t, this); }   // 领主掉落只在最后一个倒下时掉
    if (t.boss && !left.length) this.bossDown(t);
  }
  // 同场还活着的领主（含藏起来的；队员这边看傀儡表）
  bossLeft(t) {
    const S = new Set([this.boss, ...(this.bossGroup || [])]);
    for (const e of ents) if (e.boss) S.add(e);
    if (this.guest && typeof coop !== 'undefined' && coop.puppets) for (const e of coop.puppets.values()) if (e.boss) S.add(e);
    return [...S].filter(e => e && e !== t && e.boss && !e.dead && !e.abyssLord && e.hp > 0 && e.team === 'e');
  }
  bossDown(b) {
    // 击杀领主：慢动作 + 白闪，其余怪物一并消灭
    game.slowmo = true; cam.flash = 0.25; cam.flashCol = '#fff'; cam.shake = 10; sfx.boom(1.3); fxBurst(b.x, b.y, b.z + 60, 360); fxShock(b.x, b.y, 220, '#ffe070');
    game.after(1.4, () => { game.slowmo = false; });
    for (const e of ents) if (e.team === 'e' && !e.dead) { e.hp = 0; killEnt(e, game.player, {}); }
    // 领主常常是被投射物打死的（此时正处在 updateProjs 的遍历中），清理敌方投射物要推到下一帧，否则会删乱遍历中的数组
    game.after(0, () => { for (let i = projs.length - 1; i >= 0; i--) if (projs[i].team !== 'p') projs.splice(i, 1); });
    groundFx.length = 0; const p = game.player; p.status = {}; p.invul = Math.max(p.invul, 4);
    this.room.cleared = true; this.doorsOpen = true;
    game.after(2.6, () => this.finish());
  }
  score() {
    const ops = Math.min(70, this.combos5 * 5 + this.aerial * 0.6 + (this.pendingCombo ? 5 : 0));
    const tech = Math.min(70, this.back * 1.2 + this.counter * 2.5 + this.overkill * 6);
    const pen = this.hurt * 1.6 * 6 / Math.max(6, this.roomsEntered);
    return { ops: Math.round(ops), tech: Math.round(tech), pen: Math.round(pen), total: Math.round(ops + tech - pen) };
  }
  finish() {
    if (game.dungeon !== this || this.state === 'result' || this.state === 'failed') return;
    const p = game.player; if (p.dead) { p.dead = false; p.hp = Math.max(1, Math.round(p.hpMax * 0.3)); p.setState('idle'); p.z = 0; p.vz = 0; }
    // Official flow: after the boss is down the instance is frozen in a
    // result / card-flip stage.  Input, movement, combat and room changes are
    // all suspended until the player has selected the free card and closes the
    // settlement window.
    this.state = 'result'; this.flipStage = 'choose'; this.combatLocked = true; music.play('clear');
    const S = this.score(), rk = rankOf(S.total);
    const clearExp = Math.round((this.def.clearExp || 300) * this.D.exp);
    const bonus = Math.round((this.expGot + clearExp) * rk[2]);
    gainExp(clearExp + bonus);
    this.result = { S, rank: rk[0], clearExp, bonus, time: this.t, cards: [], freeCard: -1, goldCards: [] };
    save.onClear(this.def.id, this.diff, rk[0]);
    bus.emit('dungeonClear', { id: this.def.id, diff: this.diff, rank: rk[0], time: this.t, hurt: this.hurt, maxCombo: game.maxCombo });
    menus.open('result', this);
  }
  finishFlip() {
    if (this.state !== 'result' || this.flipStage === 'done') return false;
    this.flipStage = 'done'; this.combatLocked = false; return true;
  }
  revive() {
    save.data.coins--; save.write(); this.usedCoins++;
    const p = game.player; p.dead = false; p.hp = p.hpMax; p.mp = p.mpMax; p.invul = 3; p.status = {}; p.setState('idle'); p.z = 0; p.vz = 0;
    this.state = 'play'; sfx.levelUp();
    // 复活冲击：把身边的怪推倒（不计入连击 / 评价）
    for (const e of ents) if (e.team === 'e' && !e.dead && Math.abs(e.x - p.x) < 200 && !(e.act && e.act.superArmor)) { if (e.act && e.act.onEnd) e.act.onEnd(e, true); e.act = null; e.vx = Math.sign(e.x - p.x || 1) * 300 / Math.max(0.5, e.weight); e.vz = 230 / Math.sqrt(e.weight); e.z = 1; e.setState('air'); e.bounced = false; }
    if (this.boss && this.boss.dead) game.after(1, () => this.finish());
    cam.flash = 0.2; cam.flashCol = '#fff';
  }
  fail() { this.state = 'failed'; save.data.weak = Date.now() + 10 * 60 * 1000; game.dungeon = null; recalcStats(game.player); goTown(); toastMsg('冒险失败……回到城镇（虚弱 10 分钟）', '#ff6a6a'); }
  /* ---- 画门（世界层） ---- */
  drawDoors(c) {
    const R = game.room, W = R.x1, open = this.doorsOpen;
    for (const d in this.room.doors) {
      const nb = this.room.doors[d], boss = nb.type === 'boss' && !(this.layout.hideBoss && !nb.visited);   // 随机领主房（hideBoss）：没进去过就看不出来
      if (d === 'left' || d === 'right') {
        const x = d === 'left' ? 12 : W - 12, X = sx(x), Y = sy(DEPTH / 2, 0);
        drawGate(c, X, Y, open, boss, d === 'left' ? 1 : -1);
      } else {
        const X = sx(W / 2), Y = d === 'up' ? sy(0, 0) - 2 : sy(DEPTH, 0) + 6;
        c.save(); c.globalCompositeOperation = open ? 'lighter' : 'source-over';
        c.fillStyle = open ? `rgba(${boss ? '255,80,60' : '120,220,255'},${0.35 + 0.15 * Math.sin(game.t * 4)})` : 'rgba(0,0,0,.35)';
        c.beginPath(); c.ellipse(X, Y, 56, 12, 0, 0, TAU); c.fill(); c.restore();
        if (open) { c.fillStyle = boss ? '#ff6a4a' : '#bff0ff'; c.beginPath(); const s = d === 'up' ? -1 : 1; c.moveTo(X - 8, Y + s * -4); c.lineTo(X + 8, Y + s * -4); c.lineTo(X, Y + s * 6); c.closePath(); c.fill(); }
      }
    }
  }
  drawOverlay(c) {
    if (this.transition) { const T = this.transition, a = T.phase === 'out' ? T.t / 0.28 : 1 - T.t / 0.28; c.fillStyle = `rgba(0,0,0,${clamp(a, 0, 1)})`; c.fillRect(0, 0, WW, WH); }
  }
  /* ---- UI 层：小地图、地下城名、实时评价、死亡倒计时 ---- */
  drawUI(c) {
    const L = this.layout, cs = 34, x0 = 1880 - L.cols * cs, y0 = 70;
    c.fillStyle = 'rgba(8,6,10,.72)'; c.fillRect(x0 - 12, y0 - 52, L.cols * cs + 24, L.rows * cs + 64);
    uiText(this.def.name, 1880, y0 - 26, { size: 22, align: 'right', color: '#ffe8a8', sw: 4 });
    uiText(this.D.name, x0 - 4, y0 - 26, { size: 18, color: this.D.col, sw: 4 });
    for (const r of L.rooms) {
      const x = x0 + r.gx * cs, y = y0 + r.gy * cs;
      for (const d of ['right', 'down']) if (r.doors[d]) { c.fillStyle = r.visited || r.doors[d].visited ? '#c8b080' : '#4a4038'; if (d === 'right') c.fillRect(x + cs - 6, y + cs / 2 - 2, 12, 4); else c.fillRect(x + cs / 2 - 2, y + cs - 6, 4, 12); }
      c.fillStyle = r === this.room ? '#ffd23a' : r.visited ? (r.cleared ? '#8a7a5a' : '#b89a60') : '#2c2620';
      c.fillRect(x + 4, y + 4, cs - 8, cs - 8);
      const showB = r.type === 'boss' && !(L.hideBoss && !r.visited);
      c.strokeStyle = showB ? '#ff4a3a' : '#0a0806'; c.lineWidth = 2; c.strokeRect(x + 4, y + 4, cs - 8, cs - 8);
      if (showB) uiText('☠', x + cs / 2, y + cs / 2 + 8, { size: 20, align: 'center', color: '#ff5a4a', sw: 3 });
      if (r === this.room) { c.fillStyle = '#fff'; c.beginPath(); c.arc(x + cs / 2, y + cs / 2, 5, 0, TAU); c.fill(); }
    }
    // 实时评价（右下）
    if (!(typeof uiPref === 'function' && uiPref('hideRank'))) {   // End 键 / 设置里可以隐藏
      const S = this.score(), rk = rankOf(S.total);
      const mb = typeof menubar !== 'undefined' && menubar.el && !menubar.el.hidden ? menubar.el : null;
      const ry = mb ? Math.min(700, Math.round(mb.offsetTop / (dom.clientHeight || 1) * 1080) - 106) : 830;   // 右下角留给菜单按钮栏（按它实际的高度），评价面板放在它上方
      c.fillStyle = 'rgba(8,6,10,.6)'; c.fillRect(1640, ry, 260, 96);
      uiText(rk[0], 1890, ry + 72, { size: 62, align: 'right', color: RANK_COL[rk[0]], sw: 7, font: '"Arial Black",sans-serif', weight: 900, stroke: '#1a0a00' });
      uiText(`操作 ${S.ops}`, 1652, ry + 30, { size: 18, color: '#ffe8c0', sw: 3 });
      uiText(`技巧 ${S.tech}`, 1652, ry + 56, { size: 18, color: '#ffe8c0', sw: 3 });
      uiText(`被击 ${this.hurt}`, 1652, ry + 82, { size: 18, color: '#ff9a9a', sw: 3 });
    }
    uiText(`${Math.floor(this.t / 60)}:${String(Math.floor(this.t % 60)).padStart(2, '0')}`, 1880, 58, { size: 18, align: 'right', color: '#ccc', sw: 3 });
    if (this.state === 'dead') {
      c.fillStyle = 'rgba(0,0,0,.55)'; c.fillRect(0, 0, 1920, 1080);
      uiText('你倒下了……', 960, 420, { size: 64, align: 'center', color: '#ff6a6a', sw: 8 });
      uiText(`${Math.ceil(this.deadT)}`, 960, 540, { size: 120, align: 'center', color: '#fff', sw: 10, font: '"Arial Black",sans-serif' });
      uiText(save.data.coins > 0 ? `按 ${typeof keyName === 'function' ? keyName('attack') : 'X'} 使用复活币原地复活（剩余 ${save.data.coins} 枚）` : '没有复活币了，倒计时结束后返回城镇', 960, 630, { size: 30, align: 'center', color: '#ffe8a8', sw: 5 });
    }
    // 提示横幅（结算 / 倒地时先排队，不和结算画面、倒地倒计时叠在一起）
    if (this.state !== 'dead' && !menus.isOpen('result')) drawToastBanner(c);
  }
}
// 左右两侧的门：石拱门 + 发光传送面（开门后）
function drawGate(c, X, Y, open, boss, dir) {
  c.save(); c.translate(X, Y);
  const h = 92, w = 26;
  c.fillStyle = '#3a3430'; c.fillRect(-w / 2 - 6, -h - 8, 8, h + 8); c.fillRect(w / 2 - 2, -h - 8, 8, h + 8);
  c.fillStyle = '#4a443c'; c.beginPath(); c.ellipse(0, -h - 4, w / 2 + 8, 14, 0, Math.PI, 0); c.fill();
  c.fillStyle = boss ? '#6a1a14' : '#2a2420'; c.fillRect(-w / 2 - 6, -h - 20, w + 12, 6);
  if (open) {
    c.globalCompositeOperation = 'lighter';
    const g = c.createLinearGradient(0, -h, 0, 0); g.addColorStop(0, boss ? 'rgba(255,60,40,.15)' : 'rgba(90,200,255,.15)'); g.addColorStop(1, boss ? `rgba(255,120,80,${0.6 + 0.2 * Math.sin(game.t * 5)})` : `rgba(160,240,255,${0.6 + 0.2 * Math.sin(game.t * 5)})`);
    c.fillStyle = g; c.fillRect(-w / 2 + 2, -h, w - 4, h);
    for (let i = 0; i < 4; i++) { const yy = -((game.t * 60 + i * 24) % h); c.fillStyle = boss ? 'rgba(255,180,140,.6)' : 'rgba(220,250,255,.6)'; c.fillRect(-2 + Math.sin(i * 7) * 6, yy, 2, 6); }
    c.globalCompositeOperation = 'source-over';
  } else { c.fillStyle = 'rgba(0,0,0,.6)'; c.fillRect(-w / 2 + 2, -h, w - 4, h); for (let i = 0; i < 4; i++) { c.fillStyle = '#5a4a3a'; c.fillRect(-w / 2 + 2, -h + 10 + i * 22, w - 4, 3); } }
  if (boss) { c.fillStyle = '#ff4a3a'; c.font = 'bold 14px sans-serif'; c.textAlign = 'center'; c.fillText('☠', 0, -h - 26); }
  c.restore();
}

/* ---- 领主房摆设（bossProps）：王座 / 锁链 / 笼子 / 柱子 / 骨堆，程序画（art 写了素材名、素材也加载了就画素材）；kind 是怪物 id 的由主机刷（见 spawnRoom） ----
   bossProps: [{ kind: 'throne' | 'chain' | 'cage' | 'pillar' | 'bones' | <怪物 id>, x: 0~1（按房间宽）| 像素, y: 0~1（按纵深）, h, col, art }] */
function bossPropsFx(L, W) {
  for (const P of L) {
    if (MON[P.kind]) continue;
    const x = P.x <= 1 ? W * P.x : P.x, y = (P.y ?? 0.1) <= 1 ? DEPTH * (P.y ?? 0.1) : P.y, h = P.h || 160, col = P.col || '#8a8aa0';
    addFx({ x, y, z: 0, dur: 1e9, draw(c) { const X = sx(x), Y = sy(y, 0); if (X < -300 || X > WW + 300) return; if (P.art && IMG[P.art]) { drawSpr(c, IMG[P.art], X, Y, 0, h, { ay: 1, add: false }); return; } bossPropDraw(c, P.kind, X, Y, h, col); } });
  }
}
function bossPropDraw(c, kind, X, Y, h, col) {
  const dk = shade(col, -0.4, 1), lt = shade(col, 0.3, 1);
  c.save(); c.lineWidth = 3; c.strokeStyle = '#120c16';
  if (kind === 'throne') {
    c.fillStyle = dk; c.fillRect(X - h * 0.32, Y - h, h * 0.64, h * 0.62); c.strokeRect(X - h * 0.32, Y - h, h * 0.64, h * 0.62);
    c.fillStyle = col; c.fillRect(X - h * 0.4, Y - h * 0.42, h * 0.8, h * 0.18); c.fillRect(X - h * 0.4, Y - h * 0.26, h * 0.12, h * 0.26); c.fillRect(X + h * 0.28, Y - h * 0.26, h * 0.12, h * 0.26);
    c.fillStyle = lt; for (let i = -1; i <= 1; i++) { c.beginPath(); c.moveTo(X + i * h * 0.2 - h * 0.07, Y - h); c.lineTo(X + i * h * 0.2, Y - h * 1.18); c.lineTo(X + i * h * 0.2 + h * 0.07, Y - h); c.fill(); }
  } else if (kind === 'chain') {
    c.strokeStyle = col; c.lineWidth = 4; for (let i = 0; i < 12; i++) { const yy = Y - h * 2 + i * h * 0.17; c.beginPath(); c.ellipse(X + Math.sin(game.t + i) * 2, yy, 6, 10, 0, 0, TAU); c.stroke(); }
    c.fillStyle = dk; c.fillRect(X - 18, Y - 14, 36, 14);
  } else if (kind === 'cage') {
    c.strokeStyle = col; c.lineWidth = 4; for (let i = 0; i <= 5; i++) { const xx = X - h * 0.35 + i * h * 0.14; c.beginPath(); c.moveTo(xx, Y); c.lineTo(xx, Y - h); c.stroke(); }
    c.fillStyle = dk; c.fillRect(X - h * 0.4, Y - h - 8, h * 0.8, 10); c.fillRect(X - h * 0.4, Y - 6, h * 0.8, 8);
  } else if (kind === 'bones') {
    c.fillStyle = '#e8e0cc'; for (let i = 0; i < 6; i++) { c.beginPath(); c.ellipse(X + (i - 3) * 16, Y - 6 - (i % 2) * 8, 18, 5, (i - 2) * 0.4, 0, TAU); c.fill(); c.stroke(); } c.beginPath(); c.arc(X + 8, Y - 22, 12, 0, TAU); c.fill(); c.stroke();
  } else {   // pillar
    c.fillStyle = dk; c.fillRect(X - h * 0.12, Y - h, h * 0.24, h); c.strokeRect(X - h * 0.12, Y - h, h * 0.24, h); c.fillStyle = col; c.fillRect(X - h * 0.16, Y - h - 10, h * 0.32, 12); c.fillRect(X - h * 0.16, Y - 10, h * 0.32, 10);
  }
  c.restore();
}
