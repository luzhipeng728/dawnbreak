/* =====================================================================
   天空之城的怪物（官方经典版 Lv17~30，本作压缩到 Lv14~25）
   资料：腾讯 2011 资料站“天空之城”、百度百科、灰机 wiki。领主招式按官方描述改编，
   每个大招都有地面预警（红圈 / 电圈 / 光线）或头顶“!”，留出躲避时间。
   - 普通怪：翼龙、蓝翼龙、龙人、米尼乌斯、污泥人偶师、岩石人偶师、泥土石巨人、青铜石巨人、卡格、夜视镜卡格、驱逐者、斧之驱逐者、侍剑骑兵
   - 精英 / 稀有：寒冰人偶师 沙杜、石巨人操纵师、雷环休斯
   - 领主：鲁卡斯、人偶之王 道格里、黄金巨人 普拉塔尼、天之驱逐者、光之城主 赛格哈特、罪恶之眼
   - 召唤物：鲁卡斯的分身、龙之雕像
   用 Object.assign 扩展 MON / MON_ART；房间里的特殊机关（雕像、石化骑士、操纵师）靠 roomEnter / kill 事件实现。
   ===================================================================== */

/* ---- 通用表现 ---- */
// 从地下刺出的尖石（以地面点为底，先冒出来再缩回去）
function skyRockFx(x, y, r, col = '#a08a6a') {
  const n = r > 44 ? 4 : 3, spikes = Array.from({ length: n }, (_, i) => ({ dx: (i - (n - 1) / 2) * r * 0.45 + rnd(-4, 4), h: r * rnd(1.3, 1.9), w: r * rnd(0.28, 0.38) }));
  addFx({ x, y: y + 1, z: 0, dur: 0.75, spikes, col, draw(c) {
    const k = this.t / this.dur, grow = k < 0.15 ? easeOut(k / 0.15) : k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1, X = sx(this.x), Y = sy(this.y, 0);
    c.save(); c.lineJoin = 'round';
    for (const s of this.spikes) {
      const h = s.h * grow, x0 = X + s.dx; if (h < 1) continue;
      c.fillStyle = this.col; c.strokeStyle = '#2a1e14'; c.lineWidth = 2;
      c.beginPath(); c.moveTo(x0 - s.w, Y); c.lineTo(x0 - s.w * 0.4, Y - h * 0.55); c.lineTo(x0 - s.w * 0.05, Y - h); c.lineTo(x0 + s.w * 0.35, Y - h * 0.5); c.lineTo(x0 + s.w, Y); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = 'rgba(255,255,255,.28)'; c.beginPath(); c.moveTo(x0 - s.w * 0.4, Y - h * 0.5); c.lineTo(x0 - s.w * 0.05, Y - h * 0.95); c.lineTo(x0 - s.w * 0.05, Y - h * 0.3); c.closePath(); c.fill();
    }
    c.restore();
  } });
  fxDust(x, y, 6, r * 0.8, '#8a7a60');
}
// 横向光束（激光）：从 x0 到 x1，贴着地面 z 高度，一闪即逝
function skyBeamFx(x0, x1, y, hw, col, dur = 0.5) {
  addFx({ x: (x0 + x1) / 2, y: y + 2, z: 0, dur, add: true, draw(c) {
    const k = this.t / this.dur, a = k < 0.12 ? k / 0.12 : 1 - (k - 0.12) / 0.88, X0 = sx(Math.min(x0, x1)), X1 = sx(Math.max(x0, x1)), Y = sy(y, 34), h = hw * (1.2 - k * 0.6);
    c.save(); c.globalCompositeOperation = 'lighter';
    const g = c.createLinearGradient(0, Y - h * 1.6, 0, Y + h * 1.6); g.addColorStop(0, shade(col, 0, 0)); g.addColorStop(0.5, shade(col, 0.3, 0.9 * a)); g.addColorStop(1, shade(col, 0, 0));
    c.fillStyle = g; c.fillRect(X0, Y - h * 1.6, X1 - X0, h * 3.2);
    c.fillStyle = `rgba(255,255,255,${0.85 * a})`; c.fillRect(X0, Y - h * 0.3, X1 - X0, h * 0.6);
    c.restore();
  } });
}
// 石化：站着不能动，身上盖一层石头
function skyPetrify(t, dur, src) {
  if (t.dead || t.invul > 0) return;
  addStatus(t, 'stun', dur, { src });
  fxText('石化', t.x, t.y, t.z + 30, { col: '#d0d0c8', size: 13, dur: 0.9 });
  addFx({ x: t.x, y: t.y + 0.6, z: 0, dur, ent: t, draw(c) {
    const e = this.ent, k = this.t / this.dur, X = sx(e.x), Y = sy(e.y, e.z), hh = e.h * (e.scale || 1) * 0.92, w = e.w * 1.5;
    c.save(); c.globalAlpha = (k > 0.85 ? (1 - k) / 0.15 : 1) * 0.6; c.fillStyle = '#9a968c'; c.strokeStyle = '#4a463e'; c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(X - w, Y); c.lineTo(X - w * 1.05, Y - hh * 0.5); c.lineTo(X - w * 0.6, Y - hh * 0.95); c.lineTo(X + w * 0.5, Y - hh); c.lineTo(X + w * 1.05, Y - hh * 0.45); c.lineTo(X + w * 0.9, Y); c.closePath(); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(X - w * 0.4, Y - hh * 0.8); c.lineTo(X - w * 0.1, Y - hh * 0.55); c.lineTo(X + w * 0.3, Y - hh * 0.62); c.moveTo(X + w * 0.1, Y - hh * 0.3); c.lineTo(X + w * 0.5, Y - hh * 0.2); c.stroke();
    c.restore();
  } });
}
// 只打玩家方的一条横向区域（激光、剑气）
function skyLineHit(e, x0, x1, y, hw, h, o = {}) {
  const a = Math.min(x0, x1), b = Math.max(x0, x1);
  for (const t of ents) {
    if (t.team === e.team || t.team === 'n' || t.dead || t.invul > 0 || t.remove) continue;
    if (t.x + t.w < a || t.x - t.w > b || Math.abs(t.y - y) > hw + 4 || t.z > (o.zMax ?? 50)) continue;
    applyHit(e, t, { ...h, box: null }, { proj: true, src: { x: t.x - e.face * 10, y, z: 0, face: e.face } });
    if (o.status) addStatus(t, o.status, o.sdur || 2, { src: e });
    if (o.onHit) o.onHit(t);
  }
}
const skyAlive = kind => ents.filter(e => e.kind === kind && !e.dead).length;
const skyMul = () => game.dungeon ? { mul: game.dungeon.D.hp, atkMul: game.dungeon.D.atk } : {};
// 同屏的远程小怪轮流出手：整个房间每 2.4 秒最多出一次远程攻击（打磨组实测：黑暗玄廊 / 城主宫殿的被击主要来自多只远程怪同时射击）
const skyRangedOk = () => game.t - (game.skyRangedT || -9) > 2.4;
const skyRangedUse = () => { game.skyRangedT = game.t; };
const skyWall = (e, dir) => { const R = game.room; return R ? (dir > 0 ? R.x1 - 20 : R.x0 + 20) : e.x + dir * 700; };

/* ---- 招式模板 ---- */
// 地刺：落点先出现红圈（可跟随目标一小段时间），时间到从地下刺出尖石并挑飞
function skySpikeAt(e, x, y, dur, o = {}) {
  return telegraph({ x, y: clamp(y, 8, DEPTH - 8), r: o.r || 40, dur, col: o.col || '#ff5a3a', follow: o.follow, fire: g => {
    skyRockFx(g.x, g.y, g.r, o.rock); sfx.hit('blunt', false); cam.shake = Math.max(cam.shake, 3);
    areaHit(e, g.x, g.y, g.r, 0, { dmg: o.dmg || 1.1, launch: o.launch ?? 290, knock: 40, hs: 0.07, snd: 'blunt' }, o.status ? { status: o.status, sdur: o.sdur || 1 } : {});
  } });
}
// 放电：身边出现蓝色电圈，时间到在圈里落下一片闪电（官方：鲁卡斯 / 雷环休斯）
function skyDischarge(e, r, dur) {
  fxText('放电！', e.x, e.y, e.z + e.h * (e.scale || 1) + 10, { col: '#8ae0ff', size: 12 });
  sfx.charge();
  telegraph({ x: e.x, y: e.y, r, dur, col: '#6ad8ff', follow: e, fire: g => {
    for (let i = 0; i < 5; i++) { const a = rnd(0, TAU), d = rnd(0, g.r * 0.8); lightningStrike({ x: g.x + Math.cos(a) * d, y: clamp(g.y + Math.sin(a) * d * GR, 4, DEPTH - 4) }); }
    fxShock(g.x, g.y, g.r, '#8ae0ff');
    if (!e.dead) areaHit(e, g.x, g.y, g.r, 0, { dmg: 1.3, launch: 240, knock: 180, hs: 0.08, snd: 'crit', shake: 4 });
  } });
}
// 囚笼：玩家脚下出现金色圈（先跟随，后锁定），落下铁笼困住 1.2 秒
function skyCage(e) {
  const p = game.player; if (!p) return;
  telegraph({ x: p.x, y: p.y, r: 44, dur: 1.4, col: '#ffd23a', follow: p, fire: g => {
    sfx.thud(1.2); cam.shake = Math.max(cam.shake, 4); fxDust(g.x, g.y, 8, 40, '#8a8070');
    for (const t of ents) if (t.team === 'p' && !t.dead && t.invul <= 0 && t.z < 20 && inGround(t, g.x, g.y, g.r)) {
      applyHit(e, t, { dmg: 0.6, stun: 0, knock: 0, hs: 0.05, snd: 'blunt' }, { proj: true, src: { x: t.x, y: t.y, z: 0, face: e.face } });
      addStatus(t, 'stun', 1.2, { force: true, src: e }); fxText('被困住了！', t.x, t.y, t.z + 40, { col: '#ffd23a', size: 12 });
      addFx({ x: t.x, y: t.y + 0.8, z: 0, dur: 1.2, ent: t, draw(c) {
        const k = this.t / this.dur, X = sx(this.ent.x), Y = sy(this.ent.y, 0), hh = 118, drop = k < 0.1 ? (1 - k / 0.1) * 60 : 0;
        c.save(); c.globalAlpha = k > 0.85 ? (1 - k) / 0.15 : 1; c.strokeStyle = '#5a4a2a'; c.lineWidth = 4;
        for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(X + i * 11, Y - hh - drop); c.lineTo(X + i * 11, Y - drop); c.stroke(); }
        c.strokeStyle = '#d8b050'; c.lineWidth = 2; for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(X + i * 11 - 1, Y - hh - drop); c.lineTo(X + i * 11 - 1, Y - drop); c.stroke(); }
        c.fillStyle = '#8a6a2a'; c.fillRect(X - 30, Y - hh - drop - 8, 60, 9); c.fillRect(X - 30, Y - drop - 4, 60, 6);
        c.restore();
      } });
    }
  } });
}
// 提线：紫色圈跟着玩家，锁定后丝线把人拖向道格里并减速（官方的“混乱”改成看得见、躲得开的拉扯）
function skyStrings(e) {
  const p = game.player; if (!p) return;
  telegraph({ x: p.x, y: p.y, r: 46, dur: 1.5, col: '#c080ff', follow: p, fire: g => {
    for (const t of ents) if (t.team === 'p' && !t.dead && t.invul <= 0 && t.z < 20 && inGround(t, g.x, g.y, g.r)) {
      fxText('被丝线缠住了！', t.x, t.y, t.z + 40, { col: '#e0b0ff', size: 12 }); addStatus(t, 'slow', 2.5, { src: e }); sfx.charge();
      addFx({ x: t.x, y: t.y, z: 0, dur: 1.3, ent: t, boss: e, update(dt) {
        const T = this.ent, B = this.boss; if (B.dead || T.dead || T.invul > 0) { this.t = this.dur; return; }
        const d = B.x - T.x; if (Math.abs(d) > 60) T.x += Math.sign(d) * 120 * dt; T.y += clamp(B.y - T.y, -1, 1) * 40 * dt;
      }, draw(c) {
        const T = this.ent, B = this.boss, bx = sx(B.x + B.face * 20), by = sy(B.y, B.z + B.h * (B.scale || 1) * 0.8), tx = sx(T.x), ty = sy(T.y, T.z + T.h * 0.8);
        c.save(); c.strokeStyle = `rgba(220,170,255,${0.8 - this.t / this.dur * 0.5})`; c.lineWidth = 1.2;
        for (let i = -1; i <= 1; i++) { c.beginPath(); c.moveTo(bx, by); c.quadraticCurveTo((bx + tx) / 2, Math.min(by, ty) - 40 + i * 10, tx + i * 6, ty); c.stroke(); }
        c.restore();
      } });
    }
  } });
}
// 石化石弹：直线飞行，命中石化
function skyStoneShot(e, n = 1) {
  const p = game.player; sfx.swing(true);
  for (let i = 0; i < n; i++) {
    const vy = p ? clamp((p.y - e.y) * 1.1, -70, 70) + (i - (n - 1) / 2) * 70 : 0;
    spawnProj({ owner: e, x: e.x + e.face * 16, y: e.y, z: 50, vx: e.face * 260, vy, life: 2.2, w: 9, d: 10, h: 14, face: e.face, pierce: false, shadow: 6, spin: 0,
      hit: { dmg: 0.9, stun: 0.2, knock: 40, hs: 0.05, snd: 'blunt', onHit: (a, t) => skyPetrify(t, 1.0, a) },
      update(pr, dt) { pr.spin += dt * 9; }, onEnd(pr) { fxDust(pr.x, pr.y, 3, 6, '#9a9688'); },
      draw(c, pr) { drawSpr(c, 'rock', sx(pr.x), sy(pr.y, pr.z), 20, 20, { add: false, rot: pr.spin }); c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = 'rgba(200,190,160,.35)'; c.beginPath(); c.arc(sx(pr.x), sy(pr.y, pr.z), 14, 0, TAU); c.fill(); c.restore(); } });
  }
}
// 飞镖：又快又小，命中中毒
function skyDart(e, n = 1) {
  const p = game.player; sfx.swing(false);
  for (let i = 0; i < n; i++) game.after(i * 0.12, () => {
    if (e.dead) return;
    spawnProj({ owner: e, x: e.x + e.face * 12, y: e.y, z: 48, vx: e.face * 330, vy: p ? clamp((p.y - e.y) * 1.3, -80, 80) : 0, life: 1.6, w: 7, d: 8, h: 10, face: e.face, pierce: false, shadow: 3,
      hit: { dmg: 0.5, stun: 0.25, knock: 40, hs: 0.04, snd: 'stab', onHit: (a, t) => addStatus(t, 'poison', 3, { dps: a.atk * 0.04, src: a }) },
      draw(c, pr) { const X = sx(pr.x), Y = sy(pr.y, pr.z), f = pr.face; c.save(); c.strokeStyle = '#3a3a44'; c.lineWidth = 2; c.beginPath(); c.moveTo(X - f * 10, Y); c.lineTo(X + f * 6, Y); c.stroke(); c.fillStyle = '#c8ccd8'; c.beginPath(); c.moveTo(X + f * 10, Y); c.lineTo(X + f * 3, Y - 3); c.lineTo(X + f * 3, Y + 3); c.closePath(); c.fill(); c.fillStyle = '#a04ad0'; c.fillRect(X - f * 12 - 2, Y - 2, 4, 4); c.restore(); } });
  });
}
// 烟雾弹（夜视镜卡格“关灯”）：抛物线落地后冒出黑烟，站在烟里会失明
function skySmokeBomb(e) {
  const p = game.player; if (!p) return;
  const dist = Math.abs(p.x - e.x), T = clamp(dist / 260, 0.55, 1.1); sfx.swing(false);
  const land = telegraph({ x: p.x, y: p.y, r: 58, dur: T, col: '#7a5aff' });
  spawnProj({ owner: e, x: e.x + e.face * 12, y: e.y, z: 60, vx: (p.x - e.x) / T, vy: (p.y - e.y) / T, vz: 240, grav: (60 + 240 * T) * 2 / (T * T), life: 3, w: 8, d: 10, h: 12, face: e.face, pierce: false, shadow: 6,
    hit: { dmg: 0.4, stun: 0.2, knock: 30, hs: 0.03 },
    onEnd(pr) {
      killTele(land); sfx.hit('fire', false);
      addFx({ x: pr.x, y: pr.y - 20, cy: pr.y, z: 0, dur: 3.2, tick: 0, update(dt) { this.tick -= dt; if (this.tick <= 0) { this.tick = 0.4; for (const t of ents) if (t.team === 'p' && !t.dead && inGround(t, this.x, this.cy, 58) && t.z < 40) addStatus(t, 'blind', 2.2, { src: e }); } },
        draw(c) { const k = this.t / this.dur, a = k < 0.1 ? k / 0.1 : k > 0.8 ? (1 - k) / 0.2 : 1; for (let i = 0; i < 5; i++) { const ang = i / 5 * TAU + this.t * 0.5; drawSpr(c, 'dust', sx(this.x) + Math.cos(ang) * 30, sy(this.cy, 18) + Math.sin(ang) * 12, 80 + Math.sin(this.t * 3 + i) * 8, 0, { add: false, alpha: 0.7 * a, rot: ang }); } c.save(); c.globalAlpha = 0.45 * a; c.fillStyle = '#140c24'; c.beginPath(); c.ellipse(sx(this.x), sy(this.cy, 10), 60, 26, 0, 0, TAU); c.fill(); c.restore(); } });
    },
    draw(c, pr) { drawSpr(c, 'bomb', sx(pr.x), sy(pr.y, pr.z), 0, 16, { add: false, rot: pr.t * 8 }); } });
}
// 短冲刺：脚下先出现一条短红线，然后贴地冲过去（驱逐者、侍剑骑兵）
function skyDashAct(len, speed, dmg) {
  const T0 = 0.5, T1 = T0 + len / speed;
  return { dur: T1 + 0.35, onStart: e => { const p = game.player; if (p) e.face = p.x >= e.x ? 1 : -1; e.dashTele = telegraph({ x: e.x, y: e.y, kind: 'line', len: len * e.face, face: 1, hw: 18, dur: T0, col: '#ff6a3a' }); },
    update: (e, dt) => { if (e.actT < T0) { e.vx = 0; return; } if (e.actT < T1) { if (!e.dashGo) { e.dashGo = true; e.play('charge', true); sfx.swing(true); } e.vx = e.face * speed; if (Math.random() < 0.5) fxDust(e.x - e.face * 16, e.y, 1, 5); } else e.vx = 0; },
    hits: [{ t0: T0, t1: T1, box: [-6, 44, 22, 0, 100], dmg, knock: 200, stun: 0.5, hs: 0.07, snd: 'slash', shake: 3 }],
    onEnd: e => { e.vx = 0; e.dashGo = false; if (e.dashTele) killTele(e.dashTele); } };
}
// 光圈 / 冲击波：以自身为圆心的预警圈，时间到向外炸开（赛格哈特的光环、普拉塔尼的合掌、罪恶之眼的冲击波）
function skyNova(e, r, dur, col, h) {
  telegraph({ x: e.x, y: e.y, r, dur, col, follow: e, fire: g => {
    if (e.dead) return; cam.shake = Math.max(cam.shake, 6); sfx.boom(0.8); fxShock(g.x, g.y, r * 1.1, col); fxBurst(g.x, g.y, 40, r * 1.2, col);
    areaHit(e, g.x, g.y, r, 0, { dmg: 1.4, down: true, knock: 260, hs: 0.1, snd: 'crit', shake: 6, ...h });
  } });
}
// 激光：先出现一条细细的亮线（官方的“信号是细小的光线”），再射出粗光束
function skyLaser(e, y, o = {}) {
  const dir = o.dir || e.face, x0 = e.x + dir * 20, x1 = skyWall(e, dir), warn = o.warn || 1.2, col = o.col || '#fff2a0';
  telegraph({ x: x0, y, kind: 'line', len: (x1 - x0), face: 1, hw: 5, dur: warn, col });
  game.after(warn, () => {
    if (e.dead) return;   // 离开地下城时 game.timers 会被清空，不会在城里放激光
    sfx.iai ? sfx.iai() : sfx.boom(0.6); cam.shake = Math.max(cam.shake, 5); skyBeamFx(x0, x1, y, 20, col, 0.55);
    skyLineHit(e, x0, x1, y, 20, { dmg: o.dmg || 1.8, down: true, knock: 220, hs: 0.1, snd: 'crit', shake: 6 });
  });
}
// 落雷列：从 4 条纵深里挑 n 条落满闪电，至少留一条安全通道（天之驱逐者）
function skyThunderLanes(e, n) {
  const lanes = [22, 72, 122, 172].sort(() => Math.random() - 0.5).slice(0, Math.min(3, n));
  const strike = g => { lightningStrike(g); if (!e.dead) areaHit(e, g.x, g.y, 34, 0, { dmg: 1.15, launch: 260, knock: 60, hs: 0.08, snd: 'crit' }, { status: 'stun', sdur: 0.5 }); };
  lanes.forEach((y, li) => { for (let i = 0; i < 8; i++) telegraph({ x: cam.x + 70 + i * 118, y, r: 34, dur: 1.5 + li * 0.35 + i * 0.03, fire: strike }); });
}
// 雷电密布：领主身边一圈外的环形区域落满闪电——贴身或者离远都安全（光之城主）
function skyLightField(e) {
  fxText('拉开距离，或者贴近他！', e.x, e.y, e.z + e.h * (e.scale || 1) + 14, { col: '#fff2a0', size: 11, dur: 1.4 });
  const strike = g => { lightningStrike(g); if (!e.dead) areaHit(e, g.x, g.y, 34, 0, { dmg: 1.2, launch: 260, knock: 60, hs: 0.08, snd: 'crit' }); };
  for (let i = 0; i < 14; i++) { const a = i / 14 * TAU + rnd(-0.1, 0.1), d = rnd(115, 300); telegraph({ x: e.x + Math.cos(a) * d, y: clamp(e.y + Math.sin(a) * d * GR, 6, DEPTH - 6), r: 34, dur: 1.6 + (i % 3) * 0.12, col: '#fff2a0', fire: strike }); }
}
// 追踪光柱：紫色圈跟着玩家，锁定后落下光柱（罪恶之眼）
function skyTrackBeams(e, n) {
  const p = game.player; if (!p) return;
  const strike = g => { if (e.dead) return; sfx.boom(0.5); addFx({ x: g.x, y: g.y + 2, z: 0, dur: 0.45, add: true, draw(c) { const k = this.t / this.dur; drawSpr(c, fxTint('pillar', '#c060ff'), sx(this.x), sy(this.y, 0) + 6, 0, 230, { ay: 1, alpha: 1 - k }); } }); fxShock(g.x, g.y, 50, '#c060ff'); areaHit(e, g.x, g.y, 38, 0, { dmg: 1.4, launch: 280, knock: 60, hs: 0.08, snd: 'crit' }); };
  for (let i = 0; i < n; i++) telegraph({ x: p.x, y: p.y, r: 38, dur: 1.5 + i * 0.55, follow: p, col: '#c060ff', fire: strike });
}
// 石化眼球：一排眼球横着飞过来，中间空出一条缝（罪恶之眼）
function skyEyeRow(e) {
  const gap = rndi(0, 4); sfx.charge();
  for (let i = 0; i < 5; i++) {
    if (i === gap) continue;
    const y = 14 + i * (DEPTH - 28) / 4;
    spawnProj({ owner: e, x: e.x + e.face * 30, y, z: 40, vx: e.face * 210, life: 4.5, w: 10, d: 12, h: 16, face: e.face, pierce: false, shadow: 5,
      hit: { dmg: 0.8, stun: 0.2, knock: 30, hs: 0.05, snd: 'blunt', onHit: (a, t) => skyPetrify(t, 1.2, a) },
      draw(c, pr) { const X = sx(pr.x), Y = sy(pr.y, pr.z); c.save(); c.fillStyle = '#f4ecf8'; c.strokeStyle = '#3a1a4a'; c.lineWidth = 2; c.beginPath(); c.arc(X, Y, 9, 0, TAU); c.fill(); c.stroke(); c.fillStyle = '#b02a8a'; c.beginPath(); c.arc(X + pr.face * 3, Y, 4.5, 0, TAU); c.fill(); c.fillStyle = '#140818'; c.beginPath(); c.arc(X + pr.face * 4, Y, 2, 0, TAU); c.fill(); c.restore(); } });
  }
}
// 分身：两个半透明的鲁卡斯，血少、只会普通攻击
function skyClones(e) {
  fxText('分身术！', e.x, e.y, e.z + 40, { col: '#8ae0ff', size: 14 }); sfx.buff();
  for (const dx of [-150, 150]) {
    const m = spawnMonster('lucasClone', clamp(e.x + dx, 80, (game.room ? game.room.x1 : 1400) - 80), clamp(e.y + rnd(-40, 40), 16, DEPTH - 16), { lvl: e.lvl - 2, drop: true, ...skyMul() });
    m.drawOpts = { glow: 0.7 }; fxBurst(m.x, m.y, 50, 120, '#8ae0ff');
  }
}
// 普拉塔尼的连续冲撞：每次先画出冲刺路线（红线），冲过去砸地；n 次之后过热，2.4 秒内受到的伤害增加并且可以被打硬直
function skyDashChain(n) {
  const C = 1.3, W = 0.75, D = 0.3;
  const hits = []; for (let i = 0; i < n; i++) hits.push({ t0: i * C + W, t1: i * C + W + D, box: [-10, 54, 30, 0, 130], dmg: 1.1, down: true, knock: 220, hs: 0.08, snd: 'blunt', shake: 5 });
  return { dur: n * C + 0.15, superArmor: true, noCounter: true, hits,
    onStart: e => { e.dc = { i: -1 }; },
    update: (e, dt) => {
      const i = Math.floor(e.actT / C), t = e.actT - i * C, D2 = e.dc;
      if (i >= n) { e.vx = 0; return; }
      if (i !== D2.i) {
        const p = game.player; D2.i = i; D2.slam = false; D2.go = false; if (p) e.face = p.x >= e.x ? 1 : -1;
        D2.len = p ? clamp(Math.abs(p.x - e.x) + 40, 160, 440) : 300; D2.len = Math.min(D2.len, Math.abs(skyWall(e, e.face) - e.x));
        D2.tele = telegraph({ x: e.x, y: e.y, kind: 'line', len: D2.len * e.face, face: 1, hw: 30, dur: W, col: '#ff8a2a' });
        if (p) e.vy = 0; sfx.charge();
      }
      if (t < W) { e.vx = 0; e.play('chargeW'); }
      else if (t < W + D) { if (!D2.go) { D2.go = true; e.play('charge', true); sfx.boom(0.3); } e.vx = e.face * D2.len / D; if (Math.random() < 0.5) fxDust(e.x - e.face * 24, e.y, 1, 8); }
      else { e.vx = 0; if (!D2.slam) { D2.slam = true; e.play('slam', true); e.animT = 0.7; cam.shake = Math.max(cam.shake, 6); sfx.boom(0.8); fxShock(e.x + e.face * 50, e.y, 90, '#ffb040'); fxDust(e.x + e.face * 50, e.y, 10, 50, '#a08a5a'); areaHit(e, e.x + e.face * 50, e.y, 70, 0, { dmg: 1.2, down: true, knock: 200, hs: 0.08, snd: 'blunt' }); } }
    },
    onEnd: (e, interrupted) => {
      e.vx = 0; if (e.dc && e.dc.tele) killTele(e.dc.tele);
      if (e.dead) return;
      e.overheat = game.t + 2.4; e.dmgTakenMul = 1.35; e.aiCd = Math.max(e.aiCd, 2.4); e.superArmor = 0;
      fxText('过热！趁现在猛攻！', e.x, e.y, e.z + e.h * (e.scale || 1) + 10, { col: '#ffb040', size: 13, dur: 1.4 });
      addFx({ x: e.x, y: e.y + 1, z: 0, dur: 2.4, ent: e, draw(c) { const E = this.ent; for (let i = 0; i < 3; i++) { const ph = (this.t * 1.5 + i / 3) % 1; drawSpr(c, 'dust', sx(E.x) + (i - 1) * 16, sy(E.y, E.z + E.h * (E.scale || 1) * (0.7 + ph * 0.5)), 30 + ph * 30, 0, { add: false, alpha: 0.6 * (1 - ph) }); } } });
      game.after(2.4, () => { e.dmgTakenMul = 1; });
    } };
}

/* ---- 怪物表 ---- */
const SKY_GOB = { ...PAL_GOB };
Object.assign(MON, {
  // 翼龙：会扑咬，扇翅膀扑过来（官方：短暂停顿后冲刺）
  wyvern: { name: '翼龙', lvl: 14, hp: 5600, atk: 215, def: 240, w: 13, d: 12, h: 76, weight: 1, speed: 140, exp: 100, gold: [22, 45], shadowR: 17, pref: 60, clips: BEAST_CLIPS,
    model: () => buildCat({ fur: '#3a9a8a', belly: '#e8e0b0', ear: '#2a7a6a', eye: '#ffd23a', cloth: '#2a5a4a' }),
    attacks: [
      melee('bite', 0.3, 0.42, [0, 56, 20, 10, 70], { range: [0, 50], cd: [1.4, 2.4], hit: { dmg: 0.9, knock: 70, stun: 0.35, snd: 'stab' } }),
      { clip: 'pounce', range: [100, 300], dy: 30, cd: [3, 4.5], act: pounceAct(1.1) }] },
  // 蓝翼龙：扇翅膀时是霸体（官方描述）
  wyvernBlue: { name: '蓝翼龙', lvl: 15, hp: 6400, atk: 225, def: 260, w: 13, d: 12, h: 76, weight: 1, speed: 160, exp: 108, gold: [24, 48], shadowR: 17, pref: 60, clips: BEAST_CLIPS,
    model: () => buildCat({ fur: '#3a6ac8', belly: '#e8e0b0', ear: '#2a4a9a', eye: '#ffd23a', cloth: '#2a3a6a' }),
    attacks: [
      melee('bite', 0.3, 0.42, [0, 56, 20, 10, 70], { range: [0, 50], cd: [1.3, 2.2], hit: { dmg: 0.95, knock: 70, stun: 0.35, snd: 'stab' } }),
      { clip: 'pounce', range: [100, 320], dy: 30, cd: [2.8, 4.2], w: 1.2, act: { ...pounceAct(1.2), superArmor: true } }] },
  // 龙人：动作很慢，但被耙子砸中会倒地
  dragonman: { name: '龙人', lvl: 14, hp: 8400, atk: 230, def: 320, w: 15, d: 12, h: 112, weight: 1.8, speed: 68, exp: 112, gold: [25, 50], shadowR: 20, pref: 70, clips: BEAST_CLIPS,
    model: () => buildZombie({ skin: '#5aa04a', hair: '#2a5a2a', eye: '#ffd23a', cloth: '#6a4a2a', pants: '#4a3a2a' }),
    attacks: [
      melee('club', 0.44, 0.52, [0, 98, 22, 10, 90], { range: [0, 90], cd: [1.8, 3], hit: { dmg: 1.0, knock: 120, stun: 0.45, snd: 'stab' } }),
      melee('slam', 0.7, 0.8, [0, 104, 28, 0, 110], { range: [0, 95], cd: [3.5, 5], sa: true, w: 0.8, hit: { dmg: 1.5, down: true, knock: 180, shake: 4 }, events: [evAt(0.7, e => { fxDust(e.x + e.face * 70, e.y, 8, 26); sfx.boom(0.4); })] })] },
  // 米尼乌斯（蓝龙人）：多一招大范围横扫
  minius: { name: '米尼乌斯', lvl: 16, hp: 9600, atk: 240, def: 350, w: 15, d: 12, h: 112, weight: 1.9, speed: 72, exp: 120, gold: [26, 52], shadowR: 20, pref: 70, clips: BEAST_CLIPS,
    model: () => buildZombie({ skin: '#4a7ac0', hair: '#2a3a7a', eye: '#ffd23a', cloth: '#5a3a2a', pants: '#3a2a2a' }),
    attacks: [
      melee('club', 0.44, 0.52, [0, 98, 22, 10, 90], { range: [0, 90], cd: [1.8, 3], hit: { dmg: 1.0, knock: 120, stun: 0.45, snd: 'stab' } }),
      melee('axe', 0.62, 0.72, [-30, 112, 36, 0, 100], { range: [0, 100], dy: 30, cd: [3.2, 4.6], sa: true, hit: { dmg: 1.3, knock: 200, stun: 0.5, shake: 3 }, events: [slashAt(0.6, { a0: -2.4, a1: 0.9, r: 60, w: 12, off: [10, 50], col: '#bfe8ff' })] })] },
  // 污泥人偶师：远处施法，玩家脚下冒红圈后刺出尖石（官方：后跳就能躲开）
  puppeteer: { name: '污泥人偶师', lvl: 15, hp: 5000, atk: 225, def: 220, w: 11, d: 11, h: 70, weight: 0.8, speed: 90, exp: 105, gold: [22, 44], shadowR: 15, pref: 220, clips: BEAST_CLIPS,
    model: () => buildGoblinVariant({ ...SKY_GOB, skin: '#8a7a6a', skin2: '#6a5a4a', eye: '#ffa030', band: null }, { weapon: 'none', robe: '#6a4a2a' }),
    attacks: [
      melee('atk1', 0.08, 0.16, [0, 50, 20, 10, 60], { range: [0, 46], cd: [1.6, 2.6], hit: { dmg: 0.8, knock: 80, snd: 'blunt' } }),
      { clip: 'cast', range: [0, 440], dy: 440, cd: [3.2, 4.6], w: 1.6, act: { dur: 1.2, events: [evAt(0.25, e => { const p = game.player; if (p) skySpikeAt(e, p.x, p.y, 1.1, { r: 36, dmg: 1.05, follow: p }); })] } }] },
  // 岩石人偶师：石弹命中会石化
  puppeteerRock: { name: '岩石人偶师', lvl: 17, hp: 5600, atk: 235, def: 240, w: 11, d: 11, h: 70, weight: 0.8, speed: 90, exp: 115, gold: [24, 46], shadowR: 15, pref: 220, clips: BEAST_CLIPS,
    model: () => buildGoblinVariant({ ...SKY_GOB, skin: '#8a8a8a', skin2: '#5a5a5a', eye: '#ffa030', band: null }, { weapon: 'none', robe: '#5a5a62' }),
    attacks: [
      { clip: 'throw', range: [90, 360], dy: 36, cd: [4.6, 6.2], w: 1.4, cond: skyRangedOk, act: { dur: 0.9, onStart: skyRangedUse, events: [evAt(0.45, e => skyStoneShot(e))] } },
      { clip: 'cast', range: [0, 440], dy: 440, cd: [4.5, 6.5], act: { dur: 1.2, events: [evAt(0.25, e => { const p = game.player; if (p) skySpikeAt(e, p.x, p.y, 1.1, { r: 36, dmg: 1.05, follow: p, rock: '#9a9690' }); })] } }] },
  // 寒冰人偶师 沙杜（稀有）：冰刺会冻结；任务组的“冰冷的净化水”从它身上掉
  puppeteerIce: { name: '寒冰人偶师 沙杜', lvl: 17, hp: 7400, atk: 240, def: 260, w: 11, d: 11, h: 70, weight: 0.9, speed: 95, exp: 160, gold: [40, 80], shadowR: 15, pref: 220, clips: BEAST_CLIPS, scale: 1.08,
    model: () => buildGoblinVariant({ ...SKY_GOB, skin: '#8ac8e8', skin2: '#5a98c8', eye: '#e0ffff', band: null }, { weapon: 'none', robe: '#3a6a9a' }),
    attacks: [
      { clip: 'cast', range: [0, 300], dy: 50, cd: [2.2, 3.2], w: 1.4, act: { dur: 1.0, events: [evAt(0.4, e => shootStraight(e, { col: '#bfefff', dmg: 0.9, status: 'slow', speed: 300, pierce: true, glow: true, z: 50 }))] } },
      { clip: 'cast', range: [0, 440], dy: 440, cd: [4, 5.5], act: { dur: 1.2, events: [evAt(0.25, e => { const p = game.player; if (p) skySpikeAt(e, p.x, p.y, 1.1, { r: 38, dmg: 1.0, follow: p, col: '#8ad8ff', rock: '#bfe8f8', status: 'freeze', sdur: 0.8 }); })] } }] },
  // 泥土石巨人：双拳锤地（霸体），离得近才会打
  golem: { name: '泥土石巨人', lvl: 16, hp: 12000, atk: 245, def: 420, w: 20, d: 15, h: 112, weight: 2.8, speed: 55, exp: 125, gold: [28, 56], shadowR: 26, pref: 60, clips: BEAST_CLIPS,
    model: () => buildTau({ fur: '#8a6a4a', muzzle: '#a88a6a', horn: '#6a5a4a', eye: '#6ad0ff', cloth: '#5a4a3a' }, { weapon: 'none' }),
    attacks: [
      melee('club', 0.44, 0.52, [0, 84, 26, 10, 90], { range: [0, 80], cd: [1.8, 3], hit: { dmg: 1.0, knock: 150, stun: 0.45 } }),
      melee('slam', 0.7, 0.8, [-10, 108, 34, 0, 110], { range: [0, 95], cd: [2.8, 4.2], sa: true, hit: { dmg: 1.6, down: true, knock: 220, shake: 6 }, events: [evAt(0.7, e => { fxDust(e.x + e.face * 60, e.y, 12, 36, '#8a7a5a'); fxShock(e.x + e.face * 60, e.y, 70, '#c8a060'); sfx.boom(0.6); })] })] },
  // 青铜石巨人：多一招滚动冲撞
  golemBronze: { name: '青铜石巨人', lvl: 18, hp: 13000, atk: 255, def: 460, w: 20, d: 15, h: 112, weight: 3, speed: 58, exp: 130, gold: [30, 60], shadowR: 26, pref: 60, clips: BEAST_CLIPS,
    model: () => buildTau({ fur: '#b0703a', muzzle: '#c89a6a', horn: '#8a5a2a', eye: '#6ad0ff', cloth: '#6a4a2a' }, { weapon: 'none' }),
    attacks: [
      melee('slam', 0.7, 0.8, [-10, 108, 34, 0, 110], { range: [0, 95], cd: [3.2, 4.6], sa: true, w: 1.5, hit: { dmg: 1.6, down: true, knock: 220, shake: 6 }, events: [evAt(0.7, e => { fxDust(e.x + e.face * 60, e.y, 12, 36, '#8a7a5a'); fxShock(e.x + e.face * 60, e.y, 70, '#d8a050'); sfx.boom(0.6); })] }),
      { clip: 'chargeW', range: [150, 420], dy: 24, cd: [6, 9], w: 0.7, act: tauCharge(0.9) }] },
  // 石巨人操纵师（精英）：打倒它，房间里的石巨人会一起崩裂（官方：变成石巨人的灵魂）
  golemMaster: { name: '石巨人操纵师', lvl: 18, hp: 7200, atk: 240, def: 260, w: 11, d: 11, h: 70, weight: 0.9, speed: 95, exp: 160, gold: [40, 80], shadowR: 15, pref: 240, clips: BEAST_CLIPS, scale: 1.1,
    model: () => buildGoblinVariant({ ...SKY_GOB, skin: '#b8a060', skin2: '#8a7a40', eye: '#ffe060', band: null }, { weapon: 'none', robe: '#7a5a1a' }),
    attacks: [
      { clip: 'cast', range: [0, 460], dy: 460, cd: [3, 4.2], w: 1.6, act: { dur: 1.3, events: [evAt(0.25, e => { const p = game.player; if (!p) return; skySpikeAt(e, p.x, p.y, 1.1, { r: 38, dmg: 1.05, follow: p }); skySpikeAt(e, p.x + rnd(-120, 120), clamp(p.y + rnd(-50, 50), 10, DEPTH - 10), 1.3, { r: 38, dmg: 1.05 }); })] } },
      { clip: 'roar', range: [0, 800], dy: 800, cd: [12, 16], w: 0.6, cond: () => skyAlive('golem') + skyAlive('golemBronze') < 2, act: { dur: 1.3, superArmor: true, events: [evAt(0.6, e => { fxText('起来吧，石巨人！', e.x, e.y, e.z + 30, { col: '#ffe060', size: 11 }); spawnMonster('golem', clamp(e.x + rnd(-160, 160), 80, (game.room ? game.room.x1 : 1200) - 80), rnd(20, DEPTH - 20), { lvl: e.lvl - 1, drop: true, ...skyMul() }); })] } }] },
  // 卡格：扔毒飞镖，一次 1 枚（黑暗玄廊远程怪多，机器人实测被击次数偏多，2026-09-27 调低频率和移速）
  kargo: { name: '卡格', lvl: 18, hp: 5400, atk: 235, def: 230, w: 10, d: 10, h: 66, weight: 0.7, speed: 120, exp: 110, gold: [26, 50], shadowR: 14, pref: 220, clips: BEAST_CLIPS,
    model: () => buildGoblinVariant({ ...SKY_GOB, skin: '#5a6a8a', skin2: '#3a4a6a', eye: '#60ff90', band: '#c83a3a' }, { weapon: 'none' }),
    attacks: [
      melee('atk1', 0.08, 0.16, [0, 48, 20, 10, 60], { range: [0, 44], cd: [1.4, 2.4], hit: { dmg: 0.8, knock: 70, snd: 'stab' } }),
      { clip: 'throw', range: [100, 340], dy: 40, cd: [5.5, 7], w: 1.6, cond: skyRangedOk, act: { dur: 0.9, onStart: skyRangedUse, events: [evAt(0.45, e => skyDart(e, 1))] } }] },
  // 夜视镜卡格：扔烟雾弹“关灯”（烟里会失明）；它还活着时黑暗玄廊会更黑（见 themes/sky_castle.js）
  kargoGoggle: { name: '夜视镜卡格', lvl: 19, hp: 5800, atk: 240, def: 240, w: 10, d: 10, h: 66, weight: 0.7, speed: 125, exp: 115, gold: [28, 52], shadowR: 14, pref: 240, clips: BEAST_CLIPS,
    model: () => buildGoblinVariant({ ...SKY_GOB, skin: '#6a5a8a', skin2: '#4a3a6a', eye: '#60ff90', band: '#3a3a3a' }, { weapon: 'none' }),
    attacks: [
      { clip: 'throw', range: [100, 340], dy: 40, cd: [5.5, 7], w: 1.2, cond: skyRangedOk, act: { dur: 0.9, onStart: skyRangedUse, events: [evAt(0.45, e => skyDart(e, 1))] } },
      { clip: 'throw', range: [120, 360], dy: 60, cd: [7, 9], w: 1, cond: skyRangedOk, act: { dur: 0.9, onStart: skyRangedUse, events: [evAt(0.45, e => skySmokeBomb(e))] } }] },
  // 驱逐者：挥剑 + 短距离冲刺
  expeller: { name: '驱逐者', lvl: 19, hp: 10000, atk: 245, def: 420, w: 15, d: 12, h: 116, weight: 1.6, speed: 95, exp: 125, gold: [28, 56], shadowR: 20, pref: 60, clips: BEAST_CLIPS,
    model: () => buildZombie({ skin: '#5a5a66', hair: '#2a2a32', eye: '#ff3a2a', cloth: '#3a3a4a', pants: '#2a2a32' }),
    attacks: [
      melee('club', 0.44, 0.52, [0, 96, 24, 10, 100], { range: [0, 88], cd: [2.4, 3.6], w: 1.5, hit: { dmg: 1.1, knock: 140, stun: 0.45, snd: 'slash' }, events: [slashAt(0.42, { a0: -2.2, a1: 0.8, r: 56, w: 12, off: [10, 50], col: '#ffb0a0', silent: true })] }),
      { clip: 'chargeW', range: [140, 300], dy: 24, cd: [4, 6], act: skyDashAct(240, 560, 1.1) }] },
  // 斧之驱逐者：挥斧时霸体
  expellerAxe: { name: '斧之驱逐者', lvl: 20, hp: 11500, atk: 255, def: 460, w: 16, d: 12, h: 116, weight: 2, speed: 85, exp: 130, gold: [30, 58], shadowR: 21, pref: 65, clips: BEAST_CLIPS, scale: 1.05,
    model: () => buildZombie({ skin: '#6a5a4a', hair: '#2a2a32', eye: '#ff3a2a', cloth: '#4a3a2a', pants: '#2a2a32' }),
    attacks: [
      melee('axe', 0.62, 0.72, [0, 104, 30, 0, 120], { range: [0, 95], cd: [3.2, 4.4], sa: true, w: 1.5, hit: { dmg: 1.3, knock: 220, stun: 0.55, shake: 5 } }),
      melee('slam', 0.7, 0.8, [-80, 100, 40, 0, 110], { range: [0, 90], dy: 30, cd: [7, 9], sa: true, hit: { dmg: 1.2, down: true, knock: 200, shake: 5 }, events: [evAt(0.7, e => { fxShock(e.x, e.y, 110, '#ff8a6a'); sfx.boom(0.5); })] })] },
  // 侍剑骑兵（悬空城）：进房时是石像，走近或被打才会醒来
  knight: { name: '侍剑骑兵', lvl: 22, hp: 11500, atk: 268, def: 480, w: 15, d: 12, h: 116, weight: 1.8, speed: 100, exp: 130, gold: [30, 60], shadowR: 20, pref: 60, clips: BEAST_CLIPS, scale: 1.05,
    model: () => buildZombie({ skin: '#8a8a9a', hair: '#3a3a4a', eye: '#6ad0ff', cloth: '#4a4a6a', pants: '#2a2a3a' }),
    attacks: [
      melee('club', 0.44, 0.52, [0, 100, 24, 10, 100], { range: [0, 90], cd: [1.5, 2.6], w: 1.5, hit: { dmg: 1.15, knock: 150, stun: 0.45, snd: 'slash' }, events: [slashAt(0.42, { a0: -2.2, a1: 0.8, r: 58, w: 12, off: [10, 50], col: '#bfe8ff', silent: true })] }),
      { clip: 'chargeW', range: [140, 320], dy: 24, cd: [3.6, 5.4], act: skyDashAct(260, 600, 1.15) }] },
  // 雷环休斯（精英）：和鲁卡斯一样会放电
  hughes: { name: '雷环休斯', lvl: 21, hp: 16000, atk: 270, def: 480, w: 15, d: 12, h: 112, weight: 2, speed: 85, exp: 180, gold: [40, 80], shadowR: 21, pref: 70, clips: BEAST_CLIPS, scale: 1.1,
    model: () => buildZombie({ skin: '#c8b040', hair: '#6a5a1a', eye: '#6ad8ff', cloth: '#3a3a6a', pants: '#2a2a3a' }),
    attacks: [
      melee('club', 0.44, 0.52, [0, 100, 24, 10, 90], { range: [0, 90], cd: [1.6, 2.6], w: 1.5, hit: { dmg: 1.1, knock: 130, stun: 0.45, snd: 'stab' } }),
      { clip: 'cast', range: [0, 150], dy: 80, cd: [5, 7], act: { dur: 1.5, superArmor: true, events: [evAt(0.05, e => skyDischarge(e, 110, 1.1))] } }] },
  // 鲁卡斯的分身：血少，只会刺
  lucasClone: { name: '鲁卡斯的分身', lvl: 15, hp: 7000, atk: 230, def: 300, w: 15, d: 12, h: 120, weight: 1.6, speed: 100, exp: 30, gold: [5, 10], shadowR: 20, pref: 80, clips: BEAST_CLIPS, scale: 1.1,
    model: () => buildZombie({ skin: '#8ad8e8', hair: '#4a8aaa', eye: '#ffffff', cloth: '#3a5a8a', pants: '#2a3a5a' }),
    attacks: [melee('club', 0.44, 0.52, [0, 104, 24, 10, 100], { range: [0, 95], cd: [1.8, 3], hit: { dmg: 0.9, knock: 120, stun: 0.4, snd: 'stab' } })] },
  // 龙之雕像：不会动，每隔几秒朝玩家喷火球（官方：先打掉雕像，否则会一直喷火）
  dragonStatue: { name: '龙之雕像', lvl: 16, hp: 9000, atk: 240, def: 500, w: 16, d: 14, h: 80, weight: 99, speed: 0, exp: 40, gold: [10, 20], shadowR: 20, pref: 0, clips: BEAST_CLIPS, scale: 1.25,
    model: () => buildCat({ fur: '#8a8a88', belly: '#aaaaa8', ear: '#6a6a68', eye: '#ff6a2a', cloth: '#5a5a58' }), attacks: [] },

  /* ---- 领主 ---- */
  // 鲁卡斯（龙人之塔）：放电、囚笼、分身；被暴击时也会放电
  lucas: { name: '鲁卡斯', lvl: 17, hp: 112000, atk: 295, def: 470, w: 17, d: 14, h: 124, weight: 3, speed: 105, exp: 1600, gold: [220, 420], shadowR: 25, pref: 80, clips: BEAST_CLIPS, scale: 1.2, bars: 22,
    model: () => buildZombie({ skin: '#3a8aa0', hair: '#1a4a6a', eye: '#ffd23a', cloth: '#c8a040', pants: '#1a2a4a' }),
    onDamaged: (m, a, dmg, crit) => { if (!crit || m.dead || m.act || (m.lastZap && game.t - m.lastZap < 7)) return; m.lastZap = game.t; skyDischarge(m, 110, 0.9); },
    attacks: [
      melee('club', 0.44, 0.52, [0, 112, 26, 10, 110], { range: [0, 100], cd: [1.4, 2.4], w: 2, hit: { dmg: 1.2, knock: 140, stun: 0.45, snd: 'stab' }, events: [slashAt(0.42, { a0: -1.9, a1: 0.5, r: 64, w: 12, off: [10, 55], col: '#8ae0ff', silent: true })] }),
      { clip: 'cast', range: [0, 170], dy: 90, cd: [5, 7], w: 1.6, act: { dur: 1.5, superArmor: true, events: [evAt(0.05, e => skyDischarge(e, 135, 1.1))] } },
      { clip: 'roar', range: [120, 800], dy: 800, cd: [7, 10], w: 1.2, act: { dur: 1.3, superArmor: true, events: [evAt(0.3, e => skyCage(e))] } },
      { clip: 'roar', range: [0, 900], dy: 900, cd: [16, 22], w: 0.8, cond: () => skyAlive('lucasClone') === 0, act: { dur: 1.4, superArmor: true, events: [evAt(0.6, e => skyClones(e))] } }] },
  // 人偶之王 道格里（人偶玄关）：三连石柱、提线拉扯、石化石弹
  dogrey: { name: '人偶之王 道格里', lvl: 18, hp: 120000, atk: 300, def: 480, w: 17, d: 14, h: 124, weight: 3, speed: 95, exp: 1900, gold: [240, 450], shadowR: 25, pref: 120, clips: BEAST_CLIPS, scale: 1.2, bars: 24,
    model: () => buildGoblinVariant({ ...SKY_GOB, skin: '#f0e8e0', skin2: '#c8c0b8', eye: '#a060ff', band: null }, { weapon: 'staff', orb: '#c080ff', robe: '#5a2a7a', helmet: true }),
    attacks: [
      melee('club', 0.44, 0.52, [0, 100, 28, 10, 110], { range: [0, 90], cd: [1.4, 2.4], w: 2, hit: { dmg: 1.2, knock: 150, stun: 0.45 } }),
      { clip: 'cast', range: [0, 800], dy: 800, cd: [6, 8], w: 1.6, act: { dur: 2.3, superArmor: true, events: [0.1, 0.75, 1.4].map(t => evAt(t, e => { const p = game.player; if (p) skySpikeAt(e, p.x, p.y, 1.0, { r: 50, dmg: 1.2, rock: '#b8a8d0', col: '#ff5a8a' }); }))} },
      { clip: 'roar', range: [140, 800], dy: 800, cd: [9, 12], w: 1.1, act: { dur: 1.6, superArmor: true, events: [evAt(0.2, e => skyStrings(e))] } },
      { clip: 'throw', range: [100, 520], dy: 70, cd: [4, 6], w: 1.2, act: { dur: 1.0, events: [evAt(0.5, e => skyStoneShot(e, 3))] } }] },
  // 黄金巨人 普拉塔尼（石巨人塔）：几乎一直霸体；连续冲撞 1~3 次后会过热，这是反击的时机；地刺成列 / 围成一圈
  platani: { name: '黄金巨人 普拉塔尼', lvl: 20, hp: 132000, atk: 310, def: 560, w: 22, d: 16, h: 140, weight: 6, speed: 80, exp: 2300, gold: [280, 520], shadowR: 30, pref: 90, clips: BEAST_CLIPS, scale: 1.15, bars: 28,
    model: () => buildTau({ fur: '#d8a830', muzzle: '#f0d070', horn: '#b08020', eye: '#ff8a2a', cloth: '#8a6a1a' }, { weapon: 'none', armor: '#e8c050', big: true }),
    onDamaged: (m) => { if (!(m.overheat > game.t)) m.superArmor = Math.max(m.superArmor, 0.35); },
    attacks: [
      melee('club', 0.44, 0.52, [0, 110, 30, 10, 120], { range: [0, 100], cd: [1.6, 2.6], w: 2, hit: { dmg: 1.4, knock: 220, stun: 0.5, shake: 4 } }),
      { clip: 'chargeW', range: [0, 900], dy: 900, cd: [8, 11], w: 1.4, act: skyDashChain(1), cond: m => !m.enraged && m.hp > m.hpMax * 0.6 },
      { clip: 'chargeW', range: [0, 900], dy: 900, cd: [8, 11], w: 1.4, act: skyDashChain(2), cond: m => !m.enraged && m.hp <= m.hpMax * 0.6 },
      { clip: 'chargeW', range: [0, 900], dy: 900, cd: [8, 11], w: 1.6, act: skyDashChain(3), cond: m => m.enraged },
      { clip: 'slam', range: [0, 900], dy: 900, cd: [5, 7], w: 1.3, act: { dur: 1.6, superArmor: true, events: [evAt(0.3, e => {
        const p = game.player; if (!p) return;
        if (Math.random() < 0.5) for (let i = 0; i < 4; i++) skySpikeAt(e, p.x, 22 + i * 50, 1.2 + i * 0.12, { r: 36, dmg: 1.15 });   // 竖着一列：左右移动躲开
        else { for (let i = 0; i < 3; i++) { const a = i / 3 * TAU + rnd(0, 1); skySpikeAt(e, p.x + Math.cos(a) * 95, p.y + Math.sin(a) * 42, 1.2, { r: 38, dmg: 1.15 }); } fxText('别乱动！', p.x, p.y, 90, { col: '#ffd23a', size: 11 }); }   // 围成一圈：站着别动
      })] } },
      { clip: 'cast', range: [0, 170], dy: 90, cd: [6, 9], w: 1, act: { dur: 1.4, superArmor: true, events: [evAt(0.1, e => skyNova(e, 150, 1.0, '#ffc040', { dmg: 1.5 }))] } }] },
  // 天之驱逐者（黑暗玄廊）：双剑斩、1~3 列落雷（总会留一条安全通道）、长距离冲刺
  skyExpeller: { name: '天之驱逐者', lvl: 22, hp: 148000, atk: 310, def: 580, w: 17, d: 14, h: 124, weight: 3, speed: 110, exp: 2700, gold: [320, 580], shadowR: 25, pref: 80, clips: BEAST_CLIPS, scale: 1.18, bars: 30,
    model: () => buildZombie({ skin: '#d8d8e8', hair: '#8a8aa0', eye: '#ff3a2a', cloth: '#2a4aa0', pants: '#8a8aa0' }),
    attacks: [
      { clip: 'club', range: [0, 110], dy: 20, cd: [2.2, 3.2], w: 2, act: { dur: 1.3, hits: [{ t0: 0.44, t1: 0.52, box: [0, 118, 28, 10, 120], dmg: 1.1, knock: 110, stun: 0.45, hs: 0.07, snd: 'slash' }, { t0: 0.94, t1: 1.02, box: [0, 118, 28, 10, 120], dmg: 1.3, knock: 200, stun: 0.5, hs: 0.08, snd: 'slash', shake: 3 }],
        events: [slashAt(0.42, { a0: -2.2, a1: 0.8, r: 70, w: 14, off: [10, 55], col: '#ffe070', silent: true }), evAt(0.6, e => e.play('club', true)), slashAt(0.92, { a0: 1.0, a1: -2.0, r: 70, w: 14, off: [10, 55], col: '#ffe070' })] } },
      { clip: 'cast', range: [0, 900], dy: 900, cd: [6, 8], w: 1.5, act: { dur: 2.0, superArmor: true, events: [evAt(0.2, e => skyThunderLanes(e, e.enraged ? 3 : rndi(1, 3)))] } },
      { clip: 'chargeW', range: [160, 900], dy: 40, cd: [5, 7.5], w: 1.2, act: tauCharge(1.4) },
      { clip: 'roar', range: [0, 900], dy: 900, cd: [22, 28], w: 0.7, cond: m => m.hp < m.hpMax * 0.6 && skyAlive('expeller') + skyAlive('expellerAxe') < 2, act: { dur: 1.3, superArmor: true, events: [evAt(0.6, e => { fxText('亲卫队，上！', e.x, e.y, e.z + 40, { col: '#ff8a6a', size: 12 }); for (const k of ['expeller', 'expellerAxe']) spawnMonster(k, clamp(e.x + rnd(-200, 200), 80, (game.room ? game.room.x1 : 1400) - 80), rnd(20, DEPTH - 20), { lvl: e.lvl - 3, drop: true, ...skyMul() }); })] } }] },
  // 光之城主 赛格哈特（城主宫殿）：甩发、光环、雷电密布（贴身或远离都安全）、激光（先出细线）
  seghart: { name: '光之城主 赛格哈特', lvl: 24, hp: 168000, atk: 328, def: 620, w: 16, d: 14, h: 128, weight: 3, speed: 105, exp: 3200, gold: [360, 660], shadowR: 25, pref: 110, clips: BEAST_CLIPS, scale: 1.18, bars: 34,
    model: () => buildZombie({ skin: '#f0e0c0', hair: '#fff0b0', eye: '#ffd23a', cloth: '#f0f0f8', pants: '#d8c070' }),
    attacks: [
      melee('scratch', 0.3, 0.4, [-70, 104, 34, 10, 120], { range: [0, 95], dy: 30, cd: [2.4, 3.4], w: 2, hit: { dmg: 1.2, knock: 150, stun: 0.45 }, events: [slashAt(0.28, { a0: -2.6, a1: 1.2, r: 74, w: 14, off: [0, 60], col: '#ffe8a0', silent: true })] }),
      { clip: 'cast', range: [0, 160], dy: 90, cd: [5, 7], w: 1.4, act: { dur: 1.3, superArmor: true, events: [evAt(0.1, e => skyNova(e, 125, 0.9, '#fff0a0', { dmg: 1.5 }))] } },
      { clip: 'cast', range: [0, 900], dy: 900, cd: [8, 11], w: 1.3, act: { dur: 2.2, superArmor: true, events: [evAt(0.1, e => skyLightField(e))] } },
      { clip: 'cast', range: [150, 900], dy: 40, cd: [5, 7], w: 1.4, act: { dur: 1.9, superArmor: true, events: [evAt(0.15, e => { skyLaser(e, e.y, { dmg: 1.9 }); if (e.enraged && game.player) { const y2 = game.player.y; if (Math.abs(y2 - e.y) > 50) skyLaser(e, y2, { dmg: 1.6, warn: 1.4 }); } })] } }] },
  // 罪恶之眼（悬空城，隐藏）：冲击波、追踪光柱、直线激光、石化眼球列（总有一条缝）
  sinEye: { name: '罪恶之眼', lvl: 25, hp: 175000, atk: 330, def: 600, w: 22, d: 16, h: 118, weight: 8, speed: 50, exp: 3400, gold: [380, 700], shadowR: 30, pref: 200, clips: BEAST_CLIPS, scale: 1.15, bars: 36,
    model: () => buildCat({ fur: '#6a4a7a', belly: '#e8d8f0', ear: '#8a3a8a', eye: '#ff3a8a', cloth: '#3a1a4a' }),
    onDamaged: (m) => { m.superArmor = Math.max(m.superArmor, 0.3); },
    attacks: [
      { clip: 'cast', range: [0, 180], dy: 90, cd: [5, 7], w: 1.6, act: { dur: 1.4, superArmor: true, events: [evAt(0.1, e => skyNova(e, 160, 1.0, '#d060ff', { dmg: 1.4 }))] } },
      { clip: 'cast', range: [0, 900], dy: 900, cd: [6, 8], w: 1.4, act: { dur: 1.8, superArmor: true, events: [evAt(0.2, e => skyTrackBeams(e, e.enraged ? 4 : 3))] } },
      { clip: 'cast', range: [120, 900], dy: 40, cd: [5, 7], w: 1.3, act: { dur: 1.8, superArmor: true, events: [evAt(0.15, e => skyLaser(e, e.y, { dmg: 1.8, col: '#ff70d0' }))] } },
      { clip: 'roar', range: [0, 900], dy: 900, cd: [7, 10], w: 1.2, act: { dur: 1.2, superArmor: true, events: [evAt(0.5, e => skyEyeRow(e))] } },
      { clip: 'roar', range: [0, 900], dy: 900, cd: [30, 40], w: 0.5, cond: m => m.hp < m.hpMax * 0.5 && skyAlive('knight') < 2, act: { dur: 1.3, superArmor: true, events: [evAt(0.6, e => { fxText('守卫们，醒来！', e.x, e.y, e.z + 40, { col: '#ff70d0', size: 12 }); for (let i = 0; i < 2; i++) spawnMonster('knight', clamp(e.x + rnd(-260, 260), 80, (game.room ? game.room.x1 : 1400) - 80), rnd(20, DEPTH - 20), { lvl: e.lvl - 3, drop: true, ...skyMul() }); })] } }] },
});
MON.lucas.summons = ['lucasClone', 'dragonStatue']; MON.golemMaster.summons = ['golem']; MON.skyExpeller.summons = ['expeller', 'expellerAxe']; MON.sinEye.summons = ['knight'];

/* ---- 美术：逐帧精灵（art/final/spr/<id>），变种用染色 ---- */
Object.assign(MON_ART, {
  wyvern: ['wyvern'], wyvernBlue: ['wyvern', { hue: 55, sat: 1.15 }], dragonStatue: ['wyvern', { sat: 0.06, bright: 0.85 }],
  dragonman: ['dragonman'], minius: ['dragonman', { hue: 95, sat: 1.1 }], hughes: ['dragonman', { hue: -55, sat: 1.25, bright: 1.1 }],
  puppeteer: ['puppeteer'], puppeteerRock: ['puppeteer', { sat: 0.25, bright: 0.95 }], puppeteerIce: ['puppeteer', { hue: 170, sat: 1.1, bright: 1.15 }], golemMaster: ['puppeteer', { hue: 20, sat: 1.4, bright: 1.1 }],
  golem: ['golem'], golemBronze: ['golem', { hue: -12, sat: 1.5, bright: 1.05 }],
  kargo: ['kargo'], kargoGoggle: ['kargo', { hue: 60, sat: 1.1 }],
  expeller: ['expeller'], expellerAxe: ['expeller', { hue: 25, sat: 1.2, bright: 0.95 }], knight: ['expeller', { hue: 180, sat: 0.7, bright: 1.1 }],
  lucas: ['lucas'], lucasClone: ['lucas', { hue: 0, sat: 0.4, bright: 1.3 }],
  dogrey: ['dogrey'], platani: ['platani'], skyExpeller: ['skyExpeller'], seghart: ['seghart'], sinEye: ['sinEye'],
});

/* ---- 房间机关 ---- */
// 石像：换成灰色的模型，站着不动，玩家走近或受到攻击时醒来
function skyMakeStatue(m, wake = 170) {
  const A = MON_ART[m.kind]; if (!A || m.dead) return;
  const r = A[0], o = A[1] || {};
  if (typeof SpriteModel === 'undefined' || !SPR_DATA[r] || !IMG[`spr/${r}/idle`]) return;
  const live = m.model;
  m.model = new SpriteModel(r, { idle: 'idle', _: 'idle' }, {}, { ...o, sat: 0.05, bright: 0.82 });
  m.statue = true; m.noGrab = true;   // 石像状态不能被抓取（抓取无视霸体，会打断“石像”动作）
  m.doAct({ name: 'statue', clip: 'idle', dur: 999, superArmor: true, noCounter: true, update: (e) => {
    const p = game.player, woke = e.hp < e.hpMax || (p && Math.abs(p.x - e.x) < wake && Math.abs(p.y - e.y) < 70);
    if (!woke) { e.vx = e.vy = 0; return; }
    e.model = live; e.statue = false; e.noGrab = false; e.actT = e.act.dur; e.aiCd = 0.6; e.flash = 0.2;
    fxText('苏醒了！', e.x, e.y, e.z + e.h + 10, { col: '#bfe8ff', size: 11 }); fxDust(e.x, e.y, 10, 30, '#b0b0b0'); sfx.thud(0.8);
  } });
}
// 龙之雕像：原地不动，对准玩家所在的纵深喷火球（喷之前头顶出现红色“!”）
function skyStatueAI(m, dt) {
  const p = game.player; if (m.dead || !p || p.dead) return;
  m.face = p.x >= m.x ? 1 : -1; m.vx = m.vy = 0;
  if (m.busy) return;
  m.aiCd -= dt; if (m.st !== 'idle') m.setState('idle');
  if (m.aiCd > 0) return;
  m.aiCd = rnd(3.2, 4.6);
  warnMark(m, '#ff3a2a');
  m.doAct({ name: 'breath', clip: 'cast', dur: 1.1, superArmor: true, events: [evAt(0.7, e => shootStraight(e, { col: '#ff7a2a', dmg: 1.0, status: 'burn', speed: 300, trail: true, glow: true, z: 50 }))] });
}
bus.on('roomEnter', d => {
  const W = game.room ? game.room.x1 : 1400;
  // 龙人之塔的领主房：两侧各有一座龙之雕像
  if (d.id === 'dragon_tower' && d.type === 'boss') for (const [x, y] of [[90, 40], [W - 90, DEPTH - 40]]) {
    const m = spawnMonster('dragonStatue', x, y, { lvl: game.dungeon.def.boss.lvl - 2, ...skyMul() }); m.control = skyStatueAI; m.aiCd = rnd(2, 3.5);
  }
  // 悬空城：侍剑骑兵一开始都是石像
  if (d.id === 'floating_castle') for (const m of ents) if (m.kind === 'knight' && !m.dead && !m.elite) skyMakeStatue(m);
});
// 石巨人操纵师被打倒：房间里的石巨人一起崩裂（掉 45% 血并眩晕）
bus.on('kill', d => {
  if (d.kind !== 'golemMaster') return;
  for (const m of ents) if ((m.kind === 'golem' || m.kind === 'golemBronze') && !m.dead) {
    const dmg = Math.round(m.hpMax * 0.45); m.hp = Math.max(1, m.hp - dmg); addNumber(dmg, m.x, m.y, m.z, {});
    addStatus(m, 'stun', 2.5, { force: true }); fxDust(m.x, m.y, 10, 30, '#8a7a5a'); fxText('崩裂！', m.x, m.y, m.z + 60, { col: '#ffe060', size: 12 });
  }
});
