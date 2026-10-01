/* =====================================================================
   区域流水线 · 怪物技能库 + 领主机制库（新区域专用；老区域的怪物不受影响）
   - 怪物技能 MON_SKILLS：带参数的招式模板。区域 spec 里写 { use: 'dash', len: 360, cd: [4, 6] }，
     monSkill(spec, D) 编译成 monsterAI 认识的招式 { clip, range, dy, cd, w, cond, act }
   - 领主机制 BOSS_MECHS：破招槽、无敌阶段、可破护盾、安全区、场地危害、狂暴计时、分身、属性切换、连线
     msMechStart(m, spec) 启动；spec 里写在 boss.mechs（出场就有）或阶段的 enter.mechs（进阶段时启动）
   - regionAI：怪物 AI 外壳（阶段切换、连招队列、反击、机制更新、行为原型），里面仍然调用 monsterAI
   参数表见 docs/REGION_PIPELINE.md；所有预警都走 telegraph()，每帧绘制只用 source-over / lighter
   ===================================================================== */
const MS_ELEM_COL = { dark: '#a070ff', fire: '#ff7a3a', ice: '#8ad8ff', light: '#ffe070', poison: '#c080ff' };
const MS_DOT = { burn: 1, poison: 1, bleed: 1 };
const MS_STATS = { cast: {}, mech: {} };   // 调试统计：每种技能 / 机制触发过几次（test/region.mjs 读取）
// 调试事件流（test/boss.mjs 读取，docs/BOSS_SPEC.md §6）：{ t 游戏秒, T 墙钟毫秒, ev: cast | tele | mech | end | solve | fail | hurt | phase | hook, id, kind, nid, ... }
const MS_EVENTS = [];
function msLog(ev, m, o) {
  MS_EVENTS.push({ t: +(game.t || 0).toFixed(2), T: Date.now(), ev, kind: m ? m.kind : undefined, nid: m ? m.nid : undefined, ...o });
  if (MS_EVENTS.length > 3000) MS_EVENTS.splice(0, 1000);
}
// 难度系数（D5）：普通难度下失误惩罚打折（stagger 失败的大招、mark、按最大 HP 结算的招式、场地真实伤害）
const MS_PUNISH = [0.6, 0.8, 1, 1];
const msPunishK = () => (game.dungeon ? MS_PUNISH[game.dungeon.diff || 0] ?? 1 : 1);
const msCol = p => p.col || MS_ELEM_COL[p.elem] || '#ff5a3a';
const msRoomW = () => (game.room ? game.room.x1 : 1400);
const msFoes = e => ents.filter(t => t.team !== e.team && t.team !== 'n' && !t.dead && !t.remove);
// 命中参数：伤害倍率 / 硬直 / 击退 / 浮空 / 倒地 / 属性 / 异常状态
function msHit(p, o = {}) {
  const h = { dmg: (p.dmg ?? 1) * (p.punish ? msPunishK() : 1), stun: p.stun ?? 0.4, knock: p.knock ?? 120, hs: 0.07, snd: p.snd || 'blunt', shake: p.shake ?? 2, ...o };
  if (p.elem) h.elem = p.elem;
  if (p.down) h.down = true;
  if (p.launch) h.launch = p.launch;
  if (p.status) { const st = p.status, sd = p.sdur || 2.5; h.onHit = (a, t) => addStatus(t, st, sd, { dps: MS_DOT[st] ? a.atk * 0.06 : 0, src: a }); }
  return h;
}
// 圆形范围伤害；r0 > 0 时圆环内圈安全；jump = 跳起来可以躲
function msArea(e, x, y, r, p, r0 = 0) {
  const fake = { x: x - e.face * 10, y, z: 0, face: e.face }, zMax = p.jump ? 12 : 40;
  for (const t of msFoes(e)) if (t.invul <= 0 && inGround(t, x, y, r) && !(r0 && inGround(t, x, y, r0 - t.w)) && t.z < zMax && t.st !== 'down') applyHit(e, t, { ...msHit(p), box: null }, { proj: true, src: fake });
  if ((p.elem === 'fire' || p.ignite) && typeof msPoolIgnite === 'function') msPoolIgnite(e, x, y, r);   // 火属性落点点燃地上的油（pool zone: 'oil'，game/mon_skills_ext.js）
}
// 组队同步（net/coop_mech.js 接管 msNet）：主机上机制启动 / 结束 / 关键时刻（一轮落石、护盾惩罚、破招、属性切换……）调 msNetEv，
// 队员那边按各机制的 mirror 重放同样的预警、文字和攻击（打的是队员自己，谁挨打谁结算）；结果（护盾破没破、水晶、无敌解除）只认主机
let msNet = null, msNetSrc = null, msNetEnt = () => null;   // msNetSrc：正在跑哪个机制的攻击（队员统计“被机制打中”用）；msNetEnt(nid)：队员这边按编号找傀儡
let msGuestSpawn = () => false;   // 组队队员正在按主机的生成信息建傀儡（net/coop_mech.js 接管）：这时不启动机制、不刷东西
// 一次性事件的队员重放（领主钩子以外的：房间机关的自爆、倒计时……）：主机 msNetEv(怪, null, 'hook', { h: 名字, … })，队员调 MS_MIRROR[名字](傀儡, d)
const MS_MIRROR = {};
// 跟着领主画的常驻特效（护盾泡泡、属性光圈、连线）：组队队员那边领主藏起来再出来时傀儡是重建的，按编号找现在的傀儡
const msLive = m => (m && m.puppet && m.nid && msNetEnt(m.nid)) || m;
const msShown = e => !e.remove && ents.includes(e);   // 藏起来（主机 msHide / 队员那边傀儡已移除）的时候不画
const msNetEv = (m, st, ev, d) => { if (msNet && m && m.nid && !m.puppet) msNet(m, st, ev, d); };
const msSelf = () => game.realPlayer || game.player;   // 本机玩家（组队主机跑怪物 AI 时 game.player 临时换成了 AI 的目标，见 net/coop.js hostMonster）
// 真实伤害（按最大 HP 的比例）：安全区机制没站对位置时用
function msTrueHit(m, t, frac) {
  if (t.dead || t.invul > 0 || t.ghost) return;   // 队友的影子：由队友自己的客户端结算
  const d = Math.max(1, Math.round(t.hpMax * frac)); t.hp -= d; addNumber(d, t.x, t.y, t.z, { player: t.team === 'p' }); cam.shake = Math.max(cam.shake, 7);
  if (t.team === 'p' && !t.summon) game.onPlayerHurt(t, d, m);
  if (t.hp <= 0) { t.hp = 0; killEnt(t, m, {}); return; }
  applyHit(m, t, { dmg: 0.01, sure: true, down: true, knock: 200, hs: 0.08, snd: 'crit' }, { proj: true });
}
const msSay = (e, txt, col = '#ffe070', size = 13) => txt && fxText(txt, e.x, e.y, e.z + e.h * (e.scale || 1) + 18, { col, size, dur: 1.4 });
// 运行时特效（帧里不画特效，全部在这里）：fx: 'slash' | 'shock' | 'burst' | 'dust' | 'charge' | 'aura' | 'afterimage' | 'pillar'
const MS_FX = {
  slash: (e, col) => fxSlashX(e.x + e.face * 40, e.y, 50, 120, col),
  shock: (e, col) => fxShock(e.x, e.y, 90, col),
  burst: (e, col) => fxBurst(e.x, e.y, 50, 150, col),
  dust: e => fxDust(e.x, e.y, 8, 26),
  charge: (e, col) => fxCharge(e, col),
  aura: (e, col) => fxAura(e, col, 0.8),
  afterimage: (e, col) => fxAfterimage(e, col),
  pillar: (e, col) => { const img = fxTint('pillar', col); addFx({ x: e.x, y: e.y + 2, z: 0, dur: 0.5, add: true, draw(c) { drawSpr(c, img, sx(this.x), sy(this.y, 0) + 6, 0, 220, { ay: 1, alpha: 1 - this.t / this.dur }); } }); },
};

/* ================= 怪物技能库 ================= */
const MON_SKILLS = {};
function defineMonSkill(id, def) { MON_SKILLS[id] = { id, clip: 'club', dy: 18, cd: [2, 3.2], defaults: {}, ...def }; }

// 近战挥砍 / 连击：n 段，每段间隔 gap；reach 攻击距离，width 纵深半宽
defineMonSkill('swipe', { clip: 'club', desc: '近战挥砍 / 连击', defaults: { n: 1, reach: 72, width: 22, windup: 0.42, gap: 0.34, dmg: 1 },
  range: p => [0, p.reach - 6],
  act: p => {
    const hits = [], events = [];
    for (let i = 0; i < p.n; i++) {
      const t0 = p.windup + i * p.gap, last = i === p.n - 1;
      hits.push({ t0, t1: t0 + 0.08, box: [0, p.reach, p.width, 10, 100], ...msHit(p, { dmg: (p.dmg ?? 1) * (last ? 1 : 0.7), knock: last ? p.knock ?? 140 : 50, stun: last ? p.stun ?? 0.45 : 0.3 }) });
      if (i) events.push(evAt(t0 - 0.14, e => e.play(p.clip || 'club', true)));
      events.push(slashAt(t0 - 0.02, { a0: i % 2 ? 1.0 : -2.2, a1: i % 2 ? -2.0 : 0.8, r: p.reach * 0.62, w: 10, off: [10, p.reach * 0.6], col: p.col || '#ffd8b0', silent: i > 0 }));
    }
    return { dur: p.windup + (p.n - 1) * p.gap + 0.45, hits, events };
  } });
// 冲刺：先出红线预警（windup 秒），再贴地冲过去
defineMonSkill('dash', { clip: 'chargeW', sa: true, desc: '冲刺（线形预警）', defaults: { len: 320, speed: 640, windup: 0.8, hw: 22, dmg: 1.2, knock: 220 }, range: p => [110, p.len + 40], dy: 26, cd: [4.5, 6.5],
  act: p => {
    if (p.carry || p.spin || p.bounces || p.wallStun || p.frac) return msDashPlus(p);   // 冲刺变体（game/mon_skills_ext.js）
    const T1 = p.windup + p.len / p.speed;
    return { dur: T1 + 0.4,
      onStart: e => { const pl = game.player; if (pl) e.face = pl.x >= e.x ? 1 : -1; e.msDashGo = false; e.msTele = telegraph({ x: e.x, y: e.y, kind: 'line', len: Math.min(p.len, Math.abs(skyWall(e, e.face) - e.x)) * e.face, face: 1, hw: p.hw, dur: p.windup, col: msCol(p) }); },
      update: (e, dt) => { if (e.actT < p.windup) { e.vx = 0; return; } if (e.actT < T1) { if (!e.msDashGo) { e.msDashGo = true; e.play('charge', true); sfx.swing(true); } e.vx = e.face * p.speed; if (Math.random() < 0.5) fxDust(e.x - e.face * 18, e.y, 1, 6); } else e.vx = 0; },
      hits: [{ t0: p.windup, t1: T1, box: [-6, 50, p.hw + 2, 0, 110], ...msHit(p, { stun: 0.5, hs: 0.08, snd: 'slash', shake: 4 }) }],
      onEnd: e => { e.vx = 0; e.msDashGo = false; if (e.msTele) killTele(e.msTele); } };
  } });
// 投射物：mode = straight 直线 | spread 扇形 | homing 追踪 | arc 抛物线（落点红圈）
defineMonSkill('shot', { clip: 'throw', desc: '投射物', defaults: { mode: 'straight', n: 1, speed: 300, spread: 60, dmg: 0.9, pierce: false, r: 46, turn: 2.4, life: 2.2, at: 0.45, size: 26 },
  range: p => [100, p.mode === 'arc' ? 520 : 420], dy: 60, cd: [3.6, 5.2], ranged: true,
  act: p => ({ dur: p.at + 0.5, events: [evAt(p.at, e => msShoot(e, p))] }) });
function msShoot(e, p) {
  const pl = game.player; if (!pl) return;
  if (p.mode === 'arc') { for (let i = 0; i < p.n; i++) bhLob(e, { r: p.r, dmg: p.dmg, col: msCol(p), status: p.status, x: pl.x + (i ? rnd(-p.spread * 2, p.spread * 2) : 0), y: pl.y + (i ? rnd(-40, 40) : 0) }); return; }
  sfx.swing(false);
  const img = fxTint('orb', msCol(p)), vy0 = clamp((pl.y - e.y) * 1.2, -60, 60);
  for (let i = 0; i < p.n; i++) {
    const vy = p.mode === 'spread' || p.n > 1 ? vy0 + (i - (p.n - 1) / 2) * p.spread : vy0;
    spawnProj({ owner: e, x: e.x + e.face * 16, y: e.y, z: 50, vx: e.face * p.speed, vy, life: p.life, w: 9, d: 10, h: 12, face: e.face, pierce: !!p.pierce, shadow: 5, spin: 0,
      hit: msHit(p, { stun: 0.3, knock: 80, hs: 0.05 }),
      update(pr, dt) {
        pr.spin += dt * 8;
        if (p.mode !== 'homing' || !pl || pl.dead) return;
        const want = Math.atan2(pl.y - pr.y, pl.x - pr.x), cur = Math.atan2(pr.vy, pr.vx), sp = Math.hypot(pr.vx, pr.vy);
        let d = want - cur; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU;
        const a = cur + clamp(d, -p.turn * dt, p.turn * dt); pr.vx = Math.cos(a) * sp; pr.vy = Math.sin(a) * sp;
      },
      draw(c, pr) { drawSpr(c, img, sx(pr.x), sy(pr.y, pr.z), p.size, p.size, { rot: pr.spin }); } });
  }
}
// 地面范围：shape = circle 圆 | ring 圆环（内圈安全）| line 直线 | cross 十字；at = self | target | front；jump = 可以跳起来躲
defineMonSkill('aoe', { clip: 'cast', sa: true, desc: '地面范围（预警）', defaults: { shape: 'circle', at: 'target', r: 70, r0: 0, len: 560, hw: 26, windup: 1.0, dmg: 1.2, n: 1, scatter: 120, follow: true, jump: false, down: true },
  range: p => [0, p.at === 'self' ? p.r + 20 : 520], dy: p => (p.at === 'self' ? 70 : 400), cd: [5, 7],
  act: p => ({ dur: 0.4 + Math.min(p.windup, 0.8), events: [evAt(0.15, e => msAoe(e, p))] }) });
function msAoe(e, p) {
  const pl = game.player; if (!pl) return;
  const col = msCol(p), ax = p.at === 'self' ? e.x : p.at === 'front' ? e.x + e.face * p.r : pl.x, ay = p.at === 'target' ? pl.y : e.y;
  const boom = (x, y, r) => { cam.shake = Math.max(cam.shake, 4); sfx.boom(0.5); fxShock(x, y, r * 1.1, col); };
  if (p.shape === 'circle' || p.shape === 'ring') {
    for (let i = 0; i < p.n; i++) {
      const x = i ? ax + rnd(-p.scatter, p.scatter) : ax, y = clamp(i ? ay + rnd(-50, 50) : ay, 8, DEPTH - 8);
      const g = telegraph({ x, y, r: p.r, dur: p.windup, col, jump: !!p.jump, r0: p.shape === 'ring' ? p.r0 : 0, follow: !i && p.follow && p.at === 'target' ? pl : p.at === 'self' ? e : null, fire: g => { if (e.dead) return; boom(g.x, g.y, p.r); msArea(e, g.x, g.y, p.r, p, p.shape === 'ring' ? p.r0 : 0); if (p.linger && typeof msPoolAt === 'function') msPoolAt(e, g.x, g.y, { ...MON_SKILLS.pool.defaults, ...p, zone: p.zone || 'poison' }); } });   // linger：落地后留下残留区（pool）
      if (p.shape === 'ring') addFx({ x, y: y + 0.4, z: 0, dur: p.windup, g, draw(c) {   // 内圈安全区：白色描边
        const X = sx(this.g.x), Y = sy(this.g.y, 0); c.save(); c.globalAlpha = 0.8; c.strokeStyle = '#ffffff'; c.lineWidth = 2; c.setLineDash([6, 5]); c.beginPath(); c.ellipse(X, Y, p.r0, p.r0 * GR, 0, 0, TAU); c.stroke(); c.restore(); } });
    }
    return;
  }
  const W = msRoomW(), x0 = p.at === 'self' || p.at === 'front' ? e.x : 20, x1 = p.at === 'self' || p.at === 'front' ? skyWall(e, e.face) : W - 20;
  const kS = (sy(DEPTH, 0) - sy(0, 0)) / DEPTH, vert = p.shape === 'cross', hwS = DEPTH * kS / 2;
  telegraph({ x: x0, y: ay, kind: 'line', len: x1 - x0, face: 1, hw: p.hw * kS, dur: p.windup, col });
  if (vert) telegraph({ x: ax - p.hw, y: DEPTH / 2, kind: 'line', len: p.hw * 2, face: 1, hw: hwS, dur: p.windup, col });
  game.after(p.windup, () => {
    if (e.dead) return;
    boom(ax, ay, 60); skyBeamFx(x0, x1, ay, p.hw, col, 0.45);
    for (const t of msFoes(e)) {
      if (t.invul > 0 || t.z >= (p.jump ? 12 : 40) || t.st === 'down') continue;
      const inRow = Math.abs(t.y - ay) <= p.hw && t.x + t.w >= Math.min(x0, x1) && t.x - t.w <= Math.max(x0, x1), inCol = vert && Math.abs(t.x - ax) <= p.hw + t.w;
      if (inRow || inCol) applyHit(e, t, { ...msHit(p), box: null }, { proj: true, src: { x: t.x - e.face * 10, y: t.y, z: 0, face: e.face } });
    }
  });
}
// 落雨 / 陨石：n 个落点依次落下（kind = hex 陨石 | bolt 落雷），第一个落在目标脚下
defineMonSkill('rain', { clip: 'cast', sa: true, desc: '落雨 / 陨石', defaults: { n: 5, interval: 0.32, r: 44, spread: 170, windup: 1.1, dmg: 1.1, kind: 'hex', follow: false, down: true },
  range: [0, 900], dy: 900, cd: [7, 10], ranged: true,
  act: p => ({ dur: 1.0, events: [evAt(0.2, e => msRain(e, p))] }) });
function msRain(e, p) {
  for (let i = 0; i < p.n; i++) game.after(i * p.interval, () => {
    const pl = game.player; if (e.dead || !pl) return;
    const x = clamp(pl.x + (i ? rnd(-p.spread, p.spread) : 0), 30, msRoomW() - 30), y = clamp(pl.y + (i ? rnd(-60, 60) : 0), 8, DEPTH - 8);
    telegraph({ x, y, r: p.r, dur: p.windup, kind: p.kind === 'hex' ? 'hex' : 'circle', col: msCol(p), follow: p.follow && !i ? pl : null,
      fire: g => { if (e.dead) return; if (p.kind === 'bolt') lightningStrike(g); else meteorImpact(g, 0.5); msArea(e, g.x, g.y, p.r, p); } });
  });
}
// 抓取 → 投掷：抓住后 hold 秒再扔出去（抓取判定能抓住霸体目标）
defineMonSkill('grab', { clip: 'club', sa: true, desc: '抓取 / 投掷', defaults: { reach: 62, hold: 0.8, dmg: 0.5, throwDmg: 1.5, windup: 0.5 }, range: p => [0, p.reach - 6], cd: [6, 8],
  act: p => ({ dur: p.windup + p.hold + 0.55,
    hits: [{ t0: p.windup, t1: p.windup + 0.12, box: [0, p.reach, 20, 0, 110], grab: true, grabMaxW: 4, dmg: p.dmg, stun: 0.2, knock: 0, hs: 0.05, snd: 'blunt' }],
    events: [evAt(p.windup + p.hold, e => { if (!e.grabbed) return; e.play(p.clip || 'slam', true); throwGrab(e, { dmg: p.throwDmg, launch: 320, knock: 220, down: true, snd: 'blunt', shake: 5, ...(p.elem ? { elem: p.elem } : {}) }); })] }) });
// 召唤小怪：kind 怪物 id，n 只，场上同种少于 max 才会放
defineMonSkill('summon', { clip: 'roar', sa: true, desc: '召唤', defaults: { kind: null, n: 2, max: 3, lvlOff: -1 }, range: [0, 900], dy: 900, cd: [16, 22],
  cond: p => () => skyAlive(p.kind) < p.max,
  act: p => ({ dur: 1.2, events: [evAt(0.6, e => msSummon(e, p.kind, p.n, p.lvlOff))] }) });
function msSummon(e, kind, n, lvlOff = -1) {
  const W = msRoomW(), L = [];
  for (let i = 0; i < n; i++) L.push(spawnMonster(kind, clamp(e.x + (i % 2 ? 1 : -1) * rnd(110, 230), 80, W - 80), rnd(20, DEPTH - 20), { lvl: e.lvl + lvlOff, drop: true, ...skyMul() }));
  fxBurst(e.x, e.y, 60, 120, '#b890ff'); sfx.buff();
  return L;
}
// 瞬移：to = behind 目标背后 | away 拉开距离 | random | center 房间中央 | front 目标面前；可以用 then 接一招
defineMonSkill('blink', { clip: 'cast', desc: '瞬移', defaults: { to: 'behind', dist: 80, at: 0.28 }, range: [0, 700], dy: 700, cd: [5, 7],
  act: p => ({ dur: p.at + 0.3, events: [evAt(p.at, e => msBlink(e, p))] }) });
function msBlink(e, p) {
  const pl = game.player; if (!pl) return;
  const W = msRoomW(), col = msCol({ ...p, col: p.col || '#b890ff' });
  fxBurst(e.x, e.y, 50, 110, col); fxAfterimage(e, col); sfx.swing(false);
  let x = e.x;
  if (p.to === 'behind') x = pl.x - pl.face * p.dist; else if (p.to === 'front') x = pl.x + pl.face * p.dist;
  else if (p.to === 'away') x = e.x - Math.sign(pl.x - e.x || 1) * (p.dist + 140); else if (p.to === 'center') x = W / 2; else x = rnd(100, W - 100);
  e.x = clamp(x, 40, W - 40); if (p.to === 'behind' || p.to === 'front') e.y = pl.y;
  e.face = pl.x >= e.x ? 1 : -1; e.invul = Math.max(e.invul, 0.25); fxBurst(e.x, e.y, 50, 110, col);
}
// 强化：kind = enrage 狂暴（攻击 / 移速）| shield 护盾（吸收 amt×HP）| haste 加速 | heal 治疗；target = self | allies（r 范围内的同伴，含自己）
defineMonSkill('buff', { clip: 'roar', sa: true, desc: '强化自己 / 同伴', defaults: { kind: 'enrage', target: 'self', r: 280, dur: 8, amt: 0.3 }, range: [0, 900], dy: 900, cd: [14, 20],
  cond: p => m => p.kind !== 'heal' || ents.some(t => t.team === m.team && !t.dead && t.hp < t.hpMax * 0.7 && Math.abs(t.x - m.x) < p.r),
  act: p => ({ dur: 1.1, events: [evAt(0.5, e => msBuff(e, p))] }) });
function msBuff(e, p) {
  const L = p.target === 'self' ? [e] : ents.filter(t => t.team === e.team && !t.dead && !t.remove && Math.abs(t.x - e.x) < p.r && Math.abs(t.y - e.y) < p.r * GR * 2);
  const col = { enrage: '#ff5a3a', shield: '#8ad8ff', haste: '#ffe070', heal: '#9affc0' }[p.kind] || '#ffffff';
  sfx.buff();
  for (const t of L) {
    fxAura(t, col, 0.9);
    if (p.kind === 'heal') { const h = Math.round(t.hpMax * p.amt); t.hp = Math.min(t.hpMax, t.hp + h); addNumber(h, t.x, t.y, t.z + 30, { heal: true }); continue; }
    if (p.kind === 'shield') { t.msShieldHp = Math.round(t.hpMax * p.amt); t.msShieldT = game.t + p.dur; msBuffShieldFx(t); continue; }
    const k = 'ms_' + p.kind; if (t[k]) continue;
    const atk = t.atk, spd = t.speed; t[k] = true;
    if (p.kind === 'enrage') { t.atk = Math.round(atk * (1 + p.amt)); t.speed = spd * 1.2; } else t.speed = spd * (1 + p.amt);
    fxText(p.kind === 'enrage' ? '狂暴' : '加速', t.x, t.y, t.z + t.h * (t.scale || 1), { col, size: 11 });
    game.after(p.dur, () => { if (t.dead) return; t.atk = atk; t.speed = spd; t[k] = false; });
  }
}
function msBuffShieldFx(t) {   // 怪物给同伴加的护盾（buff kind shield）；和下面领主机制的 msShieldFx 同名会被覆盖，所以单独起名
  addFx({ x: t.x, y: t.y + 0.5, z: 0, dur: 1e9, ent: t, update() { const E = this.ent; this.x = E.x; this.y = E.y + 0.5; if (E.dead || !(E.msShieldHp > 0) || game.t > E.msShieldT) { E.msShieldHp = 0; this.t = this.dur; } },
    draw(c) { const E = this.ent, H = E.h * (E.scale || 1), X = sx(E.x), Y = sy(E.y, E.z); c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.3 + 0.08 * Math.sin(game.t * 5); c.strokeStyle = '#8ad8ff'; c.lineWidth = 2; c.beginPath(); c.ellipse(X, Y - H * 0.5, H * 0.42, H * 0.62, 0, 0, TAU); c.stroke(); c.restore(); } });
}
// 激光扫射：先出细线（windup 秒），再射出光束 dur 秒；sweep > 0 时光束以每秒 sweep 的速度沿纵深扫过去（跳起来能躲 zMax 以上）
defineMonSkill('laser', { clip: 'cast', sa: true, desc: '激光扫射', defaults: { windup: 1.1, dur: 1.2, hw: 16, sweep: 0, dmg: 0.45, tick: 0.2, zMax: 34 }, range: [80, 900], dy: 70, cd: [6, 8], ranged: true,
  act: p => ({ dur: p.windup + p.dur + 0.3,
    onStart: e => { const pl = game.player; e.msLz = { y: e.y, dir: pl && pl.y < e.y ? -1 : 1, tick: 0, x0: e.x + e.face * 20, x1: skyWall(e, e.face) }; telegraph({ x: e.msLz.x0, y: e.y, kind: 'line', len: e.msLz.x1 - e.msLz.x0, face: 1, hw: 4, dur: p.windup, col: msCol(p) }); },
    update: (e, dt) => {
      const L = e.msLz; if (!L || e.actT < p.windup || e.actT > p.windup + p.dur) return;
      if (!L.on) { L.on = true; sfx.boom(0.5); cam.shake = Math.max(cam.shake, 4); L.fx = addFx({ x: (L.x0 + L.x1) / 2, y: L.y, z: 0, dur: p.dur, add: true, L, draw(c) { const k = this.t / this.dur, X0 = sx(Math.min(this.L.x0, this.L.x1)), X1 = sx(Math.max(this.L.x0, this.L.x1)), Y = sy(this.L.y, 34), h = p.hw * (1 - k * 0.3);
        c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = shade(msCol(p), 0.2, 0.55); c.fillRect(X0, Y - h, X1 - X0, h * 2); c.fillStyle = 'rgba(255,255,255,.8)'; c.fillRect(X0, Y - h * 0.3, X1 - X0, h * 0.6); c.restore(); } }); }
      if (p.sweep) L.y = clamp(L.y + L.dir * p.sweep * dt, 6, DEPTH - 6);
      if (L.fx) L.fx.y = L.y;
      L.tick -= dt; if (L.tick > 0) return; L.tick = p.tick;
      skyLineHit(e, L.x0, L.x1, L.y, p.hw, msHit(p, { stun: 0.25, knock: 40, hs: 0.03, snd: 'fire' }), { zMax: p.zMax });
    },
    onEnd: e => { if (e.msLz && e.msLz.fx) e.msLz.fx.t = 1e9; e.msLz = null; } }) });
// 格挡架势：dur 秒内正面伤害 ×(1 − reduce)、霸体；被打中立刻反击（counter = 一招技能 spec，默认自身周围的冲击波）
defineMonSkill('guard', { clip: 'charge', sa: true, desc: '格挡 / 反击', defaults: { dur: 2.4, reduce: 0.8, counter: { use: 'aoe', shape: 'circle', at: 'self', r: 110, windup: 0.45, dmg: 1.3 } }, range: [0, 180], dy: 40, cd: [7, 10],
  act: (p, D) => { const C = monSkill(p.counter, D); return { dur: p.dur, guard: p.reduce, msGuard: true,
    onStart: e => { e.msGuard = { counter: C, fired: false }; msSay(e, p.say || '格挡架势', '#8ad8ff', 11); },
    onEnd: e => { if (e.msGuard && !e.msGuard.fired) e.msGuard = null; } }; } });
// 自爆：原地预警后爆炸（suicide = 自己也死）；怪物特性 onDeath: 'explode' 用的是同一个爆炸
defineMonSkill('explode', { clip: 'roar', sa: true, desc: '自爆 / 死亡爆炸', defaults: { r: 110, windup: 0.9, dmg: 1.6, suicide: true, down: true }, range: [0, 90], dy: 40, cd: [3, 5],
  act: p => ({ dur: p.windup + 0.15, events: [evAt(0.05, e => msExplodeAt(e, e.x, e.y, p, e))] }) });
function msExplodeAt(e, x, y, p, follow) {
  const col = msCol({ ...p, col: p.col || '#ff7a3a' });
  telegraph({ x, y, r: p.r, dur: p.windup, col, follow: follow || null, fire: g => {
    meteorImpact(g, 0.6); msArea(e, g.x, g.y, p.r, p);
    if (p.suicide && follow && !follow.dead) { follow.hp = 0; killEnt(follow, game.player || follow, {}); }
  } });
}
// 连招：steps 里的技能依次放出（领主的“剧本招式”），例如 瞬移到背后 → 连斩 → 冲击波
defineMonSkill('seq', { clip: 'cast', desc: '连招（多个技能依次放出）', defaults: { steps: [] }, range: [0, 700], dy: 700, cd: [10, 14],
  act: (p, D) => { const steps = p.steps.map(s => monSkill(s, D)); return { dur: 0.05, onStart: e => { e.msQueue = steps.slice(); } }; } });
// 启动一个领主机制（例如隔一段时间重新架起护盾）：mech = 机制 spec
defineMonSkill('mech', { clip: 'roar', sa: true, desc: '启动领主机制', defaults: { mech: null }, range: [0, 900], dy: 900, cd: [22, 28],
  cond: p => m => !msMechActive(m, p.mech.use) && !(p.gap && game.t - ((m.msMechEndT || {})[p.mech.use] ?? -1e9) < p.gap),   // gap：同种机制结束后至少隔 gap 秒才再放（形态 / 蓄力这类持续好几秒的）
  act: p => ({ dur: 1.2, events: [evAt(0.5, e => msMechStart(e, p.mech))] }) });

// 编译：spec → monsterAI 的招式。公共参数：clip range dy cd w sa say fx fxCol then + 条件 hp phase adds crowd once
function msCond(p, S) {
  const L = [];
  if (p.hp) L.push(m => m.hp >= m.hpMax * p.hp[0] && m.hp <= m.hpMax * p.hp[1]);
  if (p.phase != null) { const ph = [].concat(p.phase); L.push(m => ph.includes(m.msPhase || 0)); }
  if (p.adds != null) L.push(() => aliveAdds() < p.adds);
  if (p.crowd) L.push(m => msFoes(m).filter(t => Math.abs(t.x - m.x) < 260).length >= p.crowd);
  if (p.ranged ?? S.ranged) L.push(m => m.boss || skyRangedOk());
  if (S.cond) L.push(S.cond(p));
  return L.length ? m => L.every(f => f(m)) : undefined;
}
function monSkill(spec, D = {}) {
  const S = MON_SKILLS[spec.use]; if (!S) throw new Error(`怪物技能库里没有 ${spec.use}`);
  const p = { elem: D.elem, ...S.defaults, ...spec };
  const act = S.act(p, D), ranged = (p.ranged ?? S.ranged) && !D.boss_;
  if (p.sa ?? S.sa ?? (D.msSa === 'cast' && S.clip !== 'club')) act.superArmor = true;
  const os = act.onStart;
  act.onStart = e => {
    MS_STATS.cast[p.use] = (MS_STATS.cast[p.use] || 0) + 1;
    msLog('cast', e, { id: p.use, sid: p.id, i: act.msIdx });
    if (ranged) skyRangedUse();
    if (p.say) msSay(e, p.say, msCol(p));
    if (p.fx && MS_FX[p.fx]) MS_FX[p.fx](e, p.fxCol || msCol(p));
    if (os) os(e);
  };
  if (spec.then) { const T = monSkill(spec.then, D), oe = act.onEnd; act.onEnd = (e, broke) => { if (oe) oe(e, broke); if (!broke && !e.dead) (e.msQueue ??= []).push(T); }; }
  const val = (v, dflt) => (typeof v === 'function' ? v(p) : v ?? dflt);
  const A = { clip: p.clip || S.clip, range: p.range || val(S.range, [0, 80]), dy: p.dy ?? val(S.dy, 18), cd: p.cd || S.cd, w: p.w ?? 1, cond: msCond({ ...p, ranged }, S), act, ms: spec.use, msId: spec.id, p };
  const c0 = A.cond; A.cond = m => msGateOk(m, A) && (!c0 || c0(m));
  // 编号：这只怪编译出来的每一招（招式表 + 连招的每一步 / 反击 / then）按编译顺序编号（都在定义时编译，每个客户端顺序一样）；
  // 组队时主机发编号（net/coop.js monAct 的 mi），队员按编号原样重播同一招（判定、事件都一样），不用猜
  const L = D.msAll ??= []; act.msIdx = L.length; L.push(A);
  return A;
}
// 招式子集（stance 架势 / form 形态，docs/BOSS_SPEC.md）：m.msGates 栈顶 = { ids: Set, tok, replace }
// 形态 / 架势自带的招式（A.msGateTok）只在它生效时可用；被某个模式点名的招式 id（D.msGatedIds）只在点名它的模式里可用；replace = 只放这个模式的招式
function msGateOk(m, A) {
  const Gs = m.msGates, G = Gs && Gs.length ? Gs[Gs.length - 1] : null, D = m.def_;
  if (A.msGateTok) return !!(G && G.tok === A.msGateTok);
  if (A.msId && D && D.msGatedIds && D.msGatedIds.has(A.msId)) return !!(G && G.ids.has(A.msId));
  if (G && G.replace) return !!(A.msId && G.ids.has(A.msId));
  return true;
}
// 定义时预编译机制里嵌套的招式（stagger 的大招、form / stance 自带的招式、gauntlet 波次的招式、特性 back / onGetup 的反击……）：
// 编译结果挂在 spec 上（不可枚举，不会随机制参数发给队员），所有客户端编号一致；form / stance 点名的 id 记进 D.msGatedIds
function msPrecompile(D, o) {
  if (Array.isArray(o)) { o.forEach(x => msPrecompile(D, x)); return; }
  if (!o || typeof o !== 'object') return;
  const M = typeof o.use === 'string' && BOSS_MECHS[o.use];
  if (M && M.precompile && !o._pc) { Object.defineProperty(o, '_pc', { value: true }); M.precompile(D, o); }
  for (const k in o) if (o[k] && typeof o[k] === 'object') msPrecompile(D, o[k]);
}
const msSpecA = (o, k) => o && o[k];   // 预编译结果（msPin 挂上的）
// 编译一个嵌套 spec（只编一次；编译结果不进招式表，只能 msStart / 队列放出，组队按编号重播）
const msNestA = (D, o, k, spec) => msSpecA(o, k) || msPin(o, k, monSkill(spec, D));
function msPin(o, k, A) { Object.defineProperty(o, k, { value: A, configurable: true }); return A; }
// 一组招式（字符串 = 已有招式 id，对象 = 这个模式自带的招式 spec）→ { ids, specs }；自带的招式编译后标上 tok
function msGateList(D, list, tok) {
  const ids = new Set();
  for (const s of list || []) {
    if (typeof s === 'string') { ids.add(s); (D.msGatedIds ??= new Set()).add(s); continue; }
    const A = msSpecA(s, '_A') || msPin(s, '_A', monSkill(s, D)); A.msGateTok = tok;
    if (!D.attacks.includes(A)) D.attacks.push(A);
  }
  return ids;
}
// 立即放出一招（连招队列 / 反击 / 调试）
function msStart(m, A) {
  if (m.act) m.endAct(); m.setState('idle');
  const pl = game.player; if (pl) m.face = pl.x >= m.x ? 1 : -1;
  const ai = m.def_ && m.def_.attacks ? m.def_.attacks.indexOf(A) : -1;
  m.doAct({ name: A.clip, clip: A.clip, ...A.act, events: (A.act.events || []).map(ev => ({ ...ev, done: false })), hits: A.act.hits && A.act.hits.map(h => ({ ...h })), ...(ai >= 0 ? { aIdx: ai } : {}) });
  if (m.boss || m.elite || A.act.superArmor) warnMark(m, A.act.superArmor ? '#ff3a2a' : '#ffc02a');
  m.vx = m.vy = 0;
}
// 调试钩子（test/region.mjs、test/boss.mjs）：强制怪物放一招。i = 招式表序号 | 技能库名 / 招式 id（先找招式表，再找预编译的嵌套招式）| 技能 spec 对象（现场编译，同一个 spec 只编译一次）
// 组队：现场编译的 spec 队员那边没有编号，只能单机用；组队测试请用序号 / id
function monForceSkill(m, i) {
  if (!m || m.dead) return false;
  const D = m.def_, L = D.attacks;
  let A = typeof i === 'number' ? L[i] : typeof i === 'string' ? L.find(a => a.ms === i || a.msId === i) || (D.msAll || []).find(a => a.ms === i || a.msId === i) : null;
  if (!A && i && typeof i === 'object') { const key = JSON.stringify(i), C = D.msForce ??= {}; A = C[key] ??= monSkill(i, D); }
  if (!A) return false; m.stun = 0; msStart(m, A); return true;
}
// 调试钩子：把领主直接推进到第 i 阶段（血量压到门槛下，立刻进阶段，进阶段的机制照常启动）；返回现在的阶段号
function bossPhaseSet(m, i) {
  const P = m && m.def_ && m.def_.msPhases; if (!P || !P[i] || m.dead) return m ? m.msPhase || 0 : -1;
  if ((m.msPhase || 0) < i) { m.hp = Math.min(m.hp, Math.max(1, Math.floor(m.hpMax * P[i].at) - 1)); msPhaseCheck(m); }
  return m.msPhase || 0;
}

/* ================= 行为原型与特性 ================= */
// arch：aggressive 冲上来打 | kiter 保持距离、贴身就后撤 | guard 守在原地附近 | flier 悬浮、上下灵活 | swarm 又快又多
const MS_ARCH = {
  aggressive: { pref: 58, speed: 110 },
  kiter: { pref: 230, speed: 95, flee: 120 },
  guard: { pref: 70, speed: 70, leash: 240, aggro: 300, hardness: 60 },
  flier: { pref: 150, speed: 105, noGrab: true },
  swarm: { pref: 44, speed: 150 },
  boss: { pref: 110, speed: 95 },
};
// 死亡爆炸（特性 onDeath: 'explode'）的参数；组队队员那边收到击杀时也按它在傀儡的位置放一次（net/coop_mech.js）
function msDeathExplode(D) { const T = D.msTraits || {}; return T.onDeath === 'explode' ? { r: 90, windup: 0.7, dmg: 1.3, elem: D.elem, ...T.explode, suicide: false } : null; }
// 特性钩子（docs/BOSS_SPEC.md §3）：MS_TRAIT_HOOKS[特性名] = { spawn(m, cfg, o), damaged(m, cfg, a, dmg, crit, h), update(m, cfg, dt), getup(m, cfg), puppet(m, cfg) }
// 怪物 traits 里写了这个名字才调用；game/mon_skills_ext.js 往里注册（hitHp、saVsRanged、reflectRanged、rooted、back、onGetup、grabOnly、stacks、substitute、trail）
const MS_TRAIT_HOOKS = {};
function msTraitCall(m, fn, a, b, c, d, e) {
  const T = m.def_ && m.def_.msTraits; if (!T) return;
  for (const k in T) { const H = MS_TRAIT_HOOKS[k]; if (H && H[fn]) H[fn](m, T[k], a, b, c, d, e); }
}
// 受伤倍率：各机制 / 特性往 m.msMul 里写一项，乘起来就是 m.dmgTakenMul（没有机制的普通怪也能立刻生效）
function msMulSet(m, k, v) { const M = m.msMul ??= {}; if (v === undefined || v === null) delete M[k]; else M[k] = v; let mul = 1; for (const x in M) mul *= M[x]; m.dmgTakenMul = mul; }
function msOnSpawn(m, o) {
  const D = m.def_, T = D.msTraits || {};
  m.control = D.msObj ? msObjAI : regionAI; m.msHome = m.x; m.elem = D.elem;
  if (D.hardness) m.hardness = D.hardness;
  if (D.elem) m.res = { [D.elem]: 40 };
  if (T.immune) m.statusImmune = Object.fromEntries(T.immune.map(k => [k, 1]));
  const X = msDeathExplode(D); if (X) m.onDeath = () => msExplodeAt(m, m.x, m.y, X, null);
  if (T.regen) m.msRegen = { rate: 0.006, delay: 4, ...T.regen, last: game.t, tick: 0 };
  msTraitCall(m, 'spawn', o);
  if (D.msObj) { m.noLoot = true; if (D.botSkip) m.botSkip = true; return; }
  if (o.boss && D.boss_) msBossSpawn(m);
}
// 领主出场：阶段、出场机制、钩子（区域领主和 defineBossKit 的老领主共用）
function msBossSpawn(m) {
  const D = m.def_;
  m.msPhase = 0;
  for (const s of D.msMechs || []) msMechStart(m, s);
  const H = D.hook && REGION_HOOKS[D.hook]; if (H && H.onSpawn) H.onSpawn(m);
}
function msOnDamaged(m, a, dmg, crit, h) {
  const D = m.def_, T = D.msTraits || {};
  if (T.sa === 'always') m.superArmor = Math.max(m.superArmor || 0, 0.25);
  if (m.msRegen) m.msRegen.last = game.t;
  if (m.msShieldHp > 0) { const take = Math.min(m.msShieldHp, dmg); m.msShieldHp -= take; m.hp += take; }
  if (m.msGuard && !m.msGuard.fired && m.act && m.act.msGuard) { m.msGuard.fired = true; m.msCounterNow = true; }
  if (T.reflect && a && a.team === 'p' && h && h.box && !a.dead) { const r = Math.round(dmg * T.reflect); if (r > 0 && a.hp > r) { a.hp -= r; addNumber(r, a.x, a.y, a.z, { player: true }); } }
  msTraitCall(m, 'damaged', a, dmg, crit, h || {});
  if (m.msReflect && typeof msReflectHit === 'function') msReflectHit(m, a, dmg, h || {}, m.msReflect);   // stance 的反伤模式
  if (m.msMechs) for (const st of m.msMechs) { const M = BOSS_MECHS[st.id]; if (!st.done && !st.mirror && M.onHit) M.onHit(m, st, dmg, a, h); }   // 镜像（组队队员）：结果以主机为准
  // 倍率 0 在 applyHit 里会被当成 1（dmgTakenMul || 1）：无敌、车轮战观战（gauntlet watch）都在这里把血补回去
  if (m.msMul && (m.msMul.invuln === 0 || m.msMul.gauntlet === 0)) { m.hp = Math.min(m.hpMax, m.hp + dmg); if (!(m.msInvulTxt > game.t)) { m.msInvulTxt = game.t + 0.8; fxText('无敌', m.x, m.y, m.z + 40, { col: '#c8c8ff', size: 12 }); } }
  const H = D.hook && REGION_HOOKS[D.hook]; if (H && H.onHit && m.boss) H.onHit(m, dmg, a, h);
}
function msObjAI(m, dt) { m.vx = m.vy = 0; if (m.msMechs) msMechUpdate(m, dt); msTraitCall(m, 'update', dt); }
// 每帧的领主 / 区域怪逻辑（机制、阶段、钩子、特性、回血、连招队列、反击）；返回 true = 这一帧已经出招，不再跑 AI
function msTick(m, dt) {
  const D = m.def_;
  if (m.msMechs) msMechUpdate(m, dt);
  if (m.boss && D.msPhases) msPhaseCheck(m);
  const H = D.hook && REGION_HOOKS[D.hook]; if (H && H.update && m.boss) H.update(m, dt);
  msTraitCall(m, 'update', dt);
  if (m.st === 'getup') { if (!m.msGetup) { m.msGetup = true; msTraitCall(m, 'getup'); } } else m.msGetup = false;
  if (m.msRegen) msRegenTick(m, dt);
  if (m.msCdMul) m.aiCd -= dt * (1 / m.msCdMul - 1);
  if (m.msCounterNow) { m.msCounterNow = false; const C = m.msGuard && m.msGuard.counter; m.msGuard = null; if (C) { msStart(m, C); return true; } }
  if (m.msQueue && m.msQueue.length && !m.busy && !(m.stun > 0)) { msStart(m, m.msQueue.shift()); return true; }
  if (m.msIdle && !m.busy) { m.aiCd = Math.max(m.aiCd, 0.3); if (m.msIdle === 'still' && m.free) { m.vx = m.vy = 0; m.setState('idle'); return true; } }   // gauntlet 观战 / 机制接管：不出招
  return false;
}
// AI 之后：定身特性 / 形态悬浮
function msPostAI(m) { if (m.msRooted && !m.dead) { m.vx = m.vy = 0; } }
function regionAI(m, dt) {
  const D = m.def_;
  if (!m.dead && msTick(m, dt)) return;
  monsterAI(m, dt);
  msPostAI(m);
  const A = D.msArch, pl = game.player; if (!A || !pl || m.busy || m.dead || m.st === 'jump') return;
  const dx = pl.x - m.x, adx = Math.abs(dx), R = game.room;
  if (A.flee && adx < A.flee && R) { m.goalX = clamp(m.x - Math.sign(dx || 1) * 170, R.x0 + 30, R.x1 - 30); m.think = Math.max(m.think, 0.45); }
  if (A.leash && Math.abs(m.x - m.msHome) > A.leash && adx > A.aggro) { m.vx = Math.sign(m.msHome - m.x) * m.speed * 0.7; m.face = m.vx >= 0 ? 1 : -1; }
}
// 老领主（手写 AI，1~30 级）挂上机制库：包一层 control / onDamaged（defineBossKit、深渊领主共用；由 abyss.js 原来的 abyssLordMechs 泛化）
// 组队主机上 m.control 是 coop 的访问器，必须包里面真正的 AI（aiInner），不然“包装 → 这层 → 包装”无限递归；ctl.aiBase 让 coop 找到原 AI 的函数名给队员重播
function msDriveLegacy(m) {
  if (m.msDrive) return; m.msDrive = true;
  const base = m.aiInner || m.control; if (base === regionAI || base === msObjAI) return;
  const ctl = (e, dt) => { if (!e.dead && !e.msHidden && msTick(e, dt)) return; base(e, dt); msPostAI(e); };
  ctl.aiBase = base; m.control = ctl;
  if (m.onDamaged === msOnDamaged) return;
  const od = m.onDamaged;
  m.onDamaged = (t, a, dmg, crit, h) => { if (od) od(t, a, dmg, crit, h); msOnDamaged(t, a, dmg, crit, h); };
}
// 老领主套件（docs/BOSS_SPEC.md §4）：手写 AI 不动，只往上挂阶段 / 机制 / 技能库招式 / 特性 / 钩子；只在当领主（boss: true）刷出来时生效
// defineBossKit('tauKing', { mechs: [...], traits: {...}, hook, skills: [...], phases: [{ at: 0.5, say, col, roar, heal, summon, mechs, skills, only }] })
function defineBossKit(kind, K) {
  const D = MON[kind]; if (!D) throw new Error(`defineBossKit：没有怪物 ${kind}`);
  D.msKit = K; D.boss_ = true;
  D.msTraits = { ...(D.msTraits || {}), ...(K.traits || {}) };
  D.msMechs = K.mechs || [];
  if (K.hook) D.hook = K.hook;
  const P = K.phases || [], phases = P.length && (P[0].at ?? 1) >= 1 ? P : [{ at: 1 }, ...P];
  D.msPhases = phases.map(p => ({ at: p.at ?? 1, enter: p.enter || { say: p.say, col: p.col, roar: p.roar, heal: p.heal, summon: p.summon, mechs: p.mechs } }));
  for (const A of D.attacks) if (!A.p && !A.msKitGate) { const c0 = A.cond; A.msKitGate = true; A.cond = m => !(m.msGates && m.msGates.length && m.msGates[m.msGates.length - 1].replace) && (!c0 || c0(m)); }   // 形态 / 架势 replace 时手写招式也停掉
  const n = phases.length, from = i => Array.from({ length: n - i }, (_, k) => i + k), boss = A => { const c = A.cond; A.cond = m => !!m.boss && (!c || c(m)); return A; };
  const add = [...(K.skills || []).map(s => boss(monSkill(s, D))), ...phases.flatMap((Q, i) => (Q.skills || []).map(s => boss(monSkill({ phase: Q.only ? i : from(i), ...s }, D))))];
  D.attacks = [...D.attacks, ...add];   // 新数组：换色的同模怪（catCurse = { ...MON.catKing }）共用招式表，不能原地改
  msPrecompile(D, [K.mechs, phases, K.skills, K.traits]);
  if (typeof regionKinds === 'function') D.summons = [...new Set([...(D.summons || []), ...regionKinds([K.skills, phases, K.mechs, K.traits])])];
  const os = D.onSpawn;
  D.onSpawn = (m, o) => { if (os) os(m, o); if (o && o.boss) msKitSpawn(m); };
  return D;
}
function msKitSpawn(m) {
  const T = m.def_.msTraits || {};
  if (T.immune) m.statusImmune = { ...(m.statusImmune || {}), ...Object.fromEntries(T.immune.map(k => [k, 1])) };
  msTraitCall(m, 'spawn', { boss: true });
  msBossSpawn(m);
  msDriveLegacy(m);
}
function msRegenTick(m, dt) {
  const R = m.msRegen; if (game.t - R.last < R.delay || m.hp >= m.hpMax) return;
  R.tick -= dt; if (R.tick > 0) return; R.tick = 1;
  const h = Math.round(m.hpMax * R.rate); m.hp = Math.min(m.hpMax, m.hp + h); addNumber(h, m.x, m.y, m.z + 40, { heal: true });
}

/* ================= 领主：阶段 ================= */
// D.msPhases = [{ at: 1, skills }, { at: 0.7, enter: { say, roar, summon: { kind, n }, heal, mechs: [...] }, skills }]
function msPhaseCheck(m) {
  const P = m.def_.msPhases; let i = m.msPhase || 0;
  while (i + 1 < P.length && m.hp <= m.hpMax * P[i + 1].at) { i++; m.msPhase = i; msEnterPhase(m, i); }
}
// 进阶段的无敌咆哮：把附近的人震开。组队时主机的这一招带阶段号（act.msPhase → ma 的 ph），队员那边也调用它，震开的是队员自己（阶段机制只在主机上跑）
function msPhaseRoar(m, i) {
  const E = m.def_.msPhases[i].enter || {};
  if (m.act) m.endAct(); m.invul = Math.max(m.invul, 1.4); m.doAct({ name: 'roar', clip: 'roar', dur: 1.3, superArmor: true, msPhase: i });
  cam.shake = Math.max(cam.shake, 8); sfx.boom(0.9); fxShock(m.x, m.y, 200, E.col || '#b890ff');
  for (const t of msFoes(m)) if (Math.abs(t.x - m.x) < 220) applyHit(m, t, { dmg: 0.05, sure: true, knock: 320, stun: 0.3, hs: 0.04 }, { proj: true });
}
function msEnterPhase(m, i) {
  const E = m.def_.msPhases[i].enter || {};
  MS_STATS.mech.phase = (MS_STATS.mech.phase || 0) + 1;
  msLog('phase', m, { i });
  m.msQueue = [];
  if (E.roar !== false) msPhaseRoar(m, i);
  if (E.say) { msSay(m, E.say, E.col || '#ffb0ff', 15); toastMsg(E.say, E.col || '#d8b0ff'); }
  if (E.heal) { const h = Math.round(m.hpMax * E.heal); m.hp = Math.min(m.hpMax, m.hp + h); addNumber(h, m.x, m.y, m.z + 40, { heal: true }); }
  if (E.summon) msSummon(m, E.summon.kind, E.summon.n || 2, E.summon.lvlOff ?? -1);
  for (const s of E.mechs || []) msMechStart(m, s);
  const H = m.def_.hook && REGION_HOOKS[m.def_.hook]; if (H && H.onPhase) H.onPhase(m, i);
}

/* ================= 领主机制库 ================= */
const BOSS_MECHS = {};
function defineBossMech(id, def) { BOSS_MECHS[id] = { id, defaults: {}, ...def }; }
function msMechStart(m, spec) {
  const M = BOSS_MECHS[spec.use]; if (!M) throw new Error(`领主机制库里没有 ${spec.use}`);
  if (m.puppet || msGuestSpawn()) return { id: spec.use, p: { ...M.defaults, ...spec }, t: 0, done: true, ended: true };   // 组队队员的傀儡（含正在生成的傀儡）：机制以主机为准（net/coop_mech.js 镜像过来），本地不启动、不刷搭档
  const st = { id: spec.use, p: { ...M.defaults, ...spec }, spec, t: 0, done: false };
  (m.msMechs ??= []).push(st); m.msMul ??= {};
  MS_STATS.mech[spec.use] = (MS_STATS.mech[spec.use] || 0) + 1;
  msLog('mech', m, { id: spec.use });
  if (M.start) M.start(m, st, st.p);
  msNetEv(m, st, 'start', M.net ? M.net(m, st, st.p) : null);
  return st;
}
const msMechActive = (m, id) => !!(m.msMechs && m.msMechs.some(s => s.id === id && !s.done));
// 机制的结果（test/boss.mjs 读 MS_EVENTS）：解开 = solve（破招成功、护盾打破、车轮战打完……），失败 = fail（没破招放出大招、保护目标丢了……）
function msMechResult(m, st, ok, why) { if (st.res) return; st.res = ok ? 'solve' : 'fail'; msLog(st.res, m, { id: st.id, why }); MS_STATS.mech[st.id + (ok ? 'Solve' : 'Fail')] = (MS_STATS.mech[st.id + (ok ? 'Solve' : 'Fail')] || 0) + 1; }
function msMechEnd(m, st) { if (st.ended) return; st.done = st.ended = true; (m.msMechEndT ??= {})[st.id] = game.t; const M = BOSS_MECHS[st.id]; if (M.end) M.end(m, st, st.p); msLog('end', m, { id: st.id, res: st.res }); msNetEv(m, st, 'end', { b: st.broken ? 1 : 0, r: st.revealed ? 1 : 0 }); }
function msMechUpdate(m, dt) {
  for (const st of m.msMechs) { if (st.done) { msMechEnd(m, st); continue; } st.t += dt; const M = BOSS_MECHS[st.id]; if (M.update) M.update(m, st, st.p, dt); if (st.done) msMechEnd(m, st); }
  m.msMechs = m.msMechs.filter(s => !s.ended);
  let mul = 1; for (const k in m.msMul) mul *= m.msMul[k]; m.dmgTakenMul = mul;
}
// 领主藏起来（离开场地，不能被打到）：机制更新改由一个特效对象驱动
function msHide(m, on) {
  if (on) {
    if (m.msHidden) return; m.msHidden = true; fxBurst(m.x, m.y, 60, 200, '#6a3aaa'); sfx.boom(0.6); if (m.act) m.endAct(); m.remove = true;
    msTicker(dt => { if (!m.msHidden || m.dead) return true; msMechUpdate(m, dt); return false; });
  } else if (m.msHidden) {
    m.msHidden = false; m.remove = false; if (!ents.includes(m)) ents.push(m);
    const pl = game.player; m.x = clamp(pl ? pl.x + (pl.x < msRoomW() / 2 ? 260 : -260) : m.x, 60, msRoomW() - 60); m.invul = 0.6; m.setState('idle');
    fxBurst(m.x, m.y, 60, 220, '#b890ff'); sfx.boom(0.8); cam.shake = Math.max(cam.shake, 6);
  }
}
// 破招槽：受到伤害扣槽（每次命中 hit 点 + 每 1% 最大 HP 的伤害 dmg/100 点），扣空 → 眩晕 dur 秒且受到的伤害 ×mul，然后回满
defineBossMech('groggy', { defaults: { max: 100, hit: 0.6, dmg: 300, dur: 7, mul: 1.5, col: '#ffb030' },
  start(m, st, p) { st.g = p.max; st.stun = 0; },
  onHit(m, st, dmg) { if (st.stun > 0) return; st.g -= st.p.hit + dmg / m.hpMax * st.p.dmg; if (st.g <= 0) msGroggyBreak(m, st); },
  update(m, st, p, dt) { if (st.stun <= 0) return; st.stun -= dt; m.stun = Math.max(m.stun || 0, Math.min(0.3, st.stun)); if (m.st !== 'hit' && m.st !== 'air' && m.st !== 'down') m.setState('hit'); if (st.stun <= 0) { st.g = p.max; delete m.msMul.groggy; msSay(m, '破招结束', '#ffd8a0', 12); msNetEv(m, st, 'ge'); } },
  netState: st => ({ g: Math.round(st.g) }),
  mirror: {
    start(m, st, p) { st.g = p.max; st.stun = 0; },
    ev(m, st, p, e) { if (e === 'gb') { st.g = 0; st.stun = p.dur; if (m) msGroggyFx(m); } else if (e === 'ge') { st.stun = 0; st.g = p.max; if (m) msSay(m, '破招结束', '#ffd8a0', 12); } },
    update(m, st, p, dt) { if (st.stun > 0) st.stun = Math.max(0.01, st.stun - dt); } },
  hud(c, m, st, x, y, w) { msBar(c, x, y, w, st.stun > 0 ? st.stun / st.p.dur : st.g / st.p.max, st.stun > 0 ? '#ff6a3a' : st.p.col, st.stun > 0 ? `破招！${st.stun.toFixed(1)}s` : '破招槽'); return 16; } });
function msGroggyBreak(m, st) {
  st = st || (m.msMechs || []).find(s => s.id === 'groggy' && !s.done); if (!st || st.stun > 0) return;
  st.g = 0; st.stun = st.p.dur; m.msMul.groggy = st.p.mul; m.msQueue = [];
  if (m.act) m.endAct(); m.superArmor = 0; m.setState('hit'); m.stun = 0.3;
  msGroggyFx(m); msNetEv(m, st, 'gb'); msLog('solve', m, { id: 'groggy' });
  MS_STATS.mech.groggyBreak = (MS_STATS.mech.groggyBreak || 0) + 1;
}
function msGroggyFx(m) { fxText('破招！', m.x, m.y, m.z + m.h * (m.scale || 1) + 20, { col: '#ffb030', size: 22, dur: 1.6 }); cam.shake = Math.max(cam.shake, 10); cam.flash = 0.15; cam.flashCol = '#ffe0a0'; sfx.boom(1); }
// 无敌阶段：until = crystals 击破 n 个水晶 | adds 打倒 n 只 kind | survive 撑过 survive 秒 | hook 由自定义钩子结束（m.msInvulDone = true）
// hide：领主离开场地（打水晶 / 小怪时默认 true，否则留在原地，伤害 ×0）
defineBossMech('invuln', { defaults: { until: 'crystals', n: 4, kind: 'msCrystal', name: '', hpFrac: 0.025, survive: 12, hide: null, say: '', col: '#b890ff' },
  start(m, st, p) {
    st.objs = [];
    if (p.until === 'crystals' || p.until === 'adds') {
      const W = msRoomW();
      for (let i = 0; i < p.n; i++) {
        const o = spawnMonster(p.kind, clamp(W * (0.15 + 0.7 * i / Math.max(1, p.n - 1)), 80, W - 80), p.until === 'crystals' ? (i % 2 ? DEPTH * 0.25 : DEPTH * 0.75) : rnd(20, DEPTH - 20), { lvl: m.lvl - 1, drop: true, ...skyMul() });
        if (p.until === 'crystals') { o.hp = o.hpMax = Math.round(m.hpMax * p.hpFrac); if (p.name) o.name = p.name; }
        st.objs.push(o);
      }
    }
    if (p.hide ?? p.until !== 'survive') msHide(m, true); else m.msMul.invuln = 0;
    if (p.say) toastMsg(p.say, p.col);
  },
  update(m, st, p) {
    const ok = p.until === 'survive' ? st.t >= p.survive : p.until === 'hook' ? m.msInvulDone : st.objs.every(o => o.dead || o.remove);
    if (ok) st.done = true;
  },
  end(m, st, p) { msMechResult(m, st, true); delete m.msMul.invuln; m.msInvulDone = false; msHide(m, false); MS_STATS.mech.invulnEnd = (MS_STATS.mech.invulnEnd || 0) + 1; fxText('无敌解除！', m.x, m.y, m.z + 80, { col: '#ffe070', size: 16, dur: 1.4 }); },
  net: (m, st) => ({ o: st.objs.map(o => o.nid || 0) }),
  mirror: {   // 队员：水晶 / 小怪是主机刷的（照常同步成傀儡），领主藏起来由快照决定；这里只管提示和 HUD
    start(m, st, p, d) { st.oids = d.o || []; st.objs = []; if (p.say) toastMsg(p.say, p.col); if (m && !(p.hide ?? p.until !== 'survive')) (m.msMul ??= {}).invuln = 0; else if (m) fxBurst(m.x, m.y, 60, 200, '#6a3aaa'); },
    update(m, st) { st.objs = st.oids.map(id => { const o = msNetEnt(id); return { dead: !o || o.dead || o.remove }; }); },
    end(m) { if (!m) return; if (m.msMul) delete m.msMul.invuln; fxText('无敌解除！', m.x, m.y, m.z + 80, { col: '#ffe070', size: 16, dur: 1.4 }); } },
  hud(c, m, st, x, y) { const p = st.p, left = st.objs.filter(o => !o.dead && !o.remove).length; uiText(p.until === 'survive' ? `无敌 · 撑过 ${Math.max(0, p.survive - st.t).toFixed(0)} 秒` : p.until === 'hook' ? '无敌' : `无敌 · 击破${p.name || MON[p.kind].name} ${p.n - left}/${p.n}`, x, y + 14, { size: 16, color: '#d8c8ff', sw: 3 }); return 18; } });
// 可破护盾：护盾值 hp×最大 HP（或 hits 次命中）挡住全部伤害；dur 秒内没打破 → punish（heal 回血 | nova 大范围冲击）；onBreak: 'groggy' 打破后直接破招
defineBossMech('shield', { defaults: { hp: 0.06, hits: 0, dur: 0, punish: 'heal', onBreak: '', col: '#7ae0c8', say: '' },
  start(m, st, p) { st.hp = st.max = p.hits || Math.round(m.hpMax * p.hp); msShieldFx(m, st, p); },
  onHit(m, st, dmg) { const take = st.p.hits ? 1 : Math.min(st.hp, dmg); st.hp -= take; m.hp = Math.min(m.hpMax, m.hp + (st.p.hits ? dmg : take)); if (st.hp <= 0) { st.done = true; st.broken = true; } },
  update(m, st, p) { if (p.dur && st.t > p.dur && !st.done) { st.done = true; if (p.punish === 'heal') { const h = Math.round(m.hpMax * 0.05); m.hp = Math.min(m.hpMax, m.hp + h); addNumber(h, m.x, m.y, m.z + 40, { heal: true }); } msShieldPunish(m, p); msNetEv(m, st, 'pn'); } },
  end(m, st, p) { msMechResult(m, st, !!st.broken); if (!st.broken) return; msShieldBreakFx(m, p); if (p.onBreak === 'groggy') msGroggyBreak(m); },
  net: (m, st) => ({ max: st.max }),
  netState: st => ({ hp: Math.round(st.hp) }),
  mirror: {
    start(m, st, p, d) { st.hp = st.max = d.max || 1; if (m) msShieldFx(m, st, p); },
    ev(m, st, p, e) { if (e === 'pn' && m) msShieldPunish(m, p); },
    end(m, st, p, d) { if (d.b && m) msShieldBreakFx(m, p); } },
  hud(c, m, st, x, y, w) { msBar(c, x, y, w, st.hp / st.max, st.p.col, '护盾'); return 16; } });
function msShieldFx(m, st, p) {
  if (p.say) msSay(m, p.say, p.col, 14);
  addFx({ x: m.x, y: m.y + 0.5, z: 0, dur: 1e9, st, update() { const e = msLive(m); this.x = e.x; this.y = e.y + 0.5; }, draw(c) { const e = msLive(m); if (this.st.done || e.dead) { this.t = this.dur; return; } if (!msShown(e)) return; const H = e.h * (e.scale || 1), X = sx(e.x), Y = sy(e.y, e.z), k = this.st.hp / this.st.max;
    c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.18 + 0.2 * k; c.fillStyle = p.col; c.beginPath(); c.ellipse(X, Y - H * 0.5, H * 0.5, H * 0.66, 0, 0, TAU); c.fill(); c.globalAlpha = 0.6; c.strokeStyle = p.col; c.lineWidth = 2; c.stroke(); c.restore(); } });
}
function msShieldPunish(m, p) { if (p.punish === 'heal') msSay(m, '护盾吸收完毕，回复了体力', p.col); else skyNova(m, 200, 1.2, p.col, { dmg: 1.6 }); }
function msShieldBreakFx(m, p) { fxText('护盾破碎！', m.x, m.y, m.z + 90, { col: p.col, size: 18, dur: 1.4 }); fxBurst(m.x, m.y, 60, 200, p.col); sfx.boom(0.7); }
// 安全区：windup 秒后全屏重击（frac × 最大 HP 的真实伤害），只有站进安全区才没事
// mode = zone 光圈（n 个，半径 r）| near 贴近领主 | far 远离领主；safeCol 光圈颜色
defineBossMech('safezone', { defaults: { windup: 3.2, n: 2, r: 70, frac: 0.45, mode: 'zone', col: '#a070ff', safeCol: '#e8f4ff', say: '站进光圈！' },
  start(m, st, p) {
    const W = msRoomW(); st.zones = [];
    if (p.mode === 'zone') for (let i = 0; i < p.n; i++) st.zones.push({ x: clamp(W * (0.2 + 0.6 * (i + rnd(0.2, 0.8)) / p.n), 90, W - 90), y: rnd(DEPTH * 0.3, DEPTH * 0.7) });
    msSafezoneFx(m, st, p);
  },
  update(m, st, p) {
    if (st.t < p.windup) return;
    st.done = true; msSafezoneFire(m, st, p, ents.filter(t => t.team === 'p' && !t.dead && !t.remove && !t.ghost));
  },
  net: (m, st) => ({ z: st.zones.map(z => [Math.round(z.x), Math.round(z.y)]) }),
  mirror: {   // 队员：同样的光圈和倒计时，到点只判定自己（主机先到点结束的话，收到结束时补一次）
    start(m, st, p, d) { st.zones = (d.z || []).map(([x, y]) => ({ x, y })); if (m) msSafezoneFx(m, st, p); },
    update(m, st, p) { if (!st.fired && st.t >= p.windup) { st.fired = true; if (m) msSafezoneFire(m, st, p, [msSelf()]); } },
    end(m, st, p) { if (!st.fired) { st.fired = true; if (m) msSafezoneFire(m, st, p, [msSelf()]); } } } });
function msSafezoneFx(m, st, p) {
    toastMsg(p.say, p.safeCol); msSay(m, p.say, p.safeCol, 16); sfx.buff();
    addFx({ x: 0, y: -1, z: 0, dur: p.windup, st, draw(c) {
      const k = this.t / this.dur, Y0 = sy(0, 0), Y1 = sy(DEPTH, 0), blink = Math.floor(this.t * (4 + k * 10)) % 2;
      c.save(); c.globalAlpha = 0.16 + 0.12 * blink; c.fillStyle = p.col; c.fillRect(0, Y0 - 10, WW, Y1 - Y0 + 20); c.globalAlpha = 1;
      c.globalCompositeOperation = 'lighter';
      const circ = (x, y, r) => { const X = sx(x), Y = sy(y, 0); c.fillStyle = shade(p.safeCol, 0, 0.35); c.beginPath(); c.ellipse(X, Y, r, r * GR, 0, 0, TAU); c.fill(); c.strokeStyle = p.safeCol; c.lineWidth = 3; c.stroke(); };
      if (p.mode === 'zone') for (const z of this.st.zones) circ(z.x, z.y, p.r);
      else if (p.mode === 'near') { const e = msLive(m); circ(e.x, e.y, p.r); }
      c.restore();
      uiTextWorld(c, `${Math.max(0, this.dur - this.t).toFixed(1)}`, WW / 2, 120, p.safeCol);
    } });
}
function msSafezoneFire(m, st, p, who) {
    cam.flash = 0.2; cam.flashCol = p.col; sfx.boom(1.2);
    for (const t of who) {
      if (!t || t.dead || t.remove) continue;
      const safe = p.mode === 'zone' ? st.zones.some(z => inGround(t, z.x, z.y, p.r)) : p.mode === 'near' ? inGround(t, m.x, m.y, p.r) : !inGround(t, m.x, m.y, p.r);
      if (safe) { fxText('安全', t.x, t.y, t.z + 60, { col: p.safeCol, size: 12 }); MS_STATS.mech.safe = (MS_STATS.mech.safe || 0) + 1; msLog('solve', m, { id: 'safezone' }); }
      else { msTrueHit(m, t, p.frac); msLog('fail', m, { id: 'safezone' }); }
    }
}
function uiTextWorld(c, txt, x, y, col) { c.save(); c.font = '900 30px "Arial Black",sans-serif'; c.textAlign = 'center'; c.lineWidth = 6; c.strokeStyle = '#140a1a'; c.strokeText(txt, x, y); c.fillStyle = col; c.fillText(txt, x, y); c.restore(); }
// 场地危害：kind = fire 地火（每 every 秒在目标附近 n 处）| debris 落石（全场随机 n 处）| shrink 场地缩小（两侧暗区每秒 4% 伤害，最窄 minW）；dur = 0 一直持续
defineBossMech('hazard', { defaults: { kind: 'fire', every: 4, n: 2, r: 50, dmg: 1.0, dur: 0, windup: 1.1, minW: 560, speed: 22, col: '#ff7a3a' },
  start(m, st, p) {
    st.cd = 1.5;
    if (p.kind === 'shrink') { st.cx = msRoomW() / 2; st.w = msRoomW(); st.tick = 0; msShrinkFx(m, st, p); }
  },
  update(m, st, p, dt) {
    if (p.dur && st.t > p.dur) { st.done = true; return; }
    if (p.kind === 'shrink') {
      st.w = Math.max(p.minW, st.w - p.speed * dt); st.tick -= dt; if (st.tick > 0) return; st.tick = 1;
      for (const t of ents) if (t.team === 'p' && !t.dead && Math.abs(t.x - st.cx) > st.w / 2) msTrueHit(m, t, 0.04);
      return;
    }
    st.cd -= dt; if (st.cd > 0) return; st.cd = p.every;
    const pl = game.player, W = msRoomW(); if (!pl) return;
    const L = [];
    for (let i = 0; i < p.n; i++) L.push([Math.round(p.kind === 'debris' ? rnd(60, W - 60) : clamp(pl.x + rnd(-150, 150), 40, W - 40)), Math.round(p.kind === 'debris' ? rnd(10, DEPTH - 10) : clamp(pl.y + rnd(-50, 50), 8, DEPTH - 8))]);
    msHazardVolley(m, p, L); msNetEv(m, st, 'v', { l: L });
  },
  net: (m, st) => st.cx !== undefined ? { cx: st.cx, w: st.w } : null,
  mirror: {   // 队员：落石 / 地火按主机发来的位置放同样的预警（打的是自己）；场地缩小在本地按同样的速度缩、自己判定暗区
    start(m, st, p, d) { if (p.kind === 'shrink' && d) { st.cx = d.cx; st.w = d.w; st.tick = 0; if (m) msShrinkFx(m, st, p); } },
    ev(m, st, p, e, d) { if (e === 'v' && m) msHazardVolley(m, p, d.l || []); },
    update(m, st, p, dt) {
      if (p.kind !== 'shrink' || st.w === undefined) return;
      st.w = Math.max(p.minW, st.w - p.speed * dt); st.tick -= dt; if (st.tick > 0) return; st.tick = 1;
      const t = msSelf(); if (m && t && !t.dead && Math.abs(t.x - st.cx) > st.w / 2) msTrueHit(m, t, 0.04);
    } },
  hud(c, m, st, x, y) { if (st.p.kind !== 'shrink') return 0; uiText('场地正在缩小', x, y + 14, { size: 15, color: '#ffb08a', sw: 3 }); return 18; } });
function msHazardVolley(m, p, L) {
  for (const [x, y] of L) telegraph({ x, y, r: p.r, dur: p.windup, kind: p.kind === 'debris' ? 'hex' : 'circle', col: p.col, fire: g => { if (m.dead) return; if (p.kind === 'debris') meteorImpact(g, 0.45); else { fxShock(g.x, g.y, p.r, p.col); fxBurst(g.x, g.y, 20, 90, p.col); } msArea(m, g.x, g.y, p.r, { dmg: p.dmg, status: p.kind === 'fire' ? 'burn' : null, down: p.kind === 'debris' }); } });
}
function msShrinkFx(m, st, p) {
  addFx({ x: 0, y: -1, z: 0, dur: 1e9, st, draw(c) { if (this.st.done || m.dead) { this.t = this.dur; return; } const s = this.st, Y0 = sy(0, 0) - 8, Y1 = sy(DEPTH, 0) + 8, a = sx(s.cx - s.w / 2), b = sx(s.cx + s.w / 2);
    c.save(); c.globalAlpha = 0.45; c.fillStyle = '#1a0a24'; c.fillRect(-10, Y0, a + 10, Y1 - Y0); c.fillRect(b, Y0, WW - b + 10, Y1 - Y0); c.globalAlpha = 0.9; c.fillStyle = p.col; c.fillRect(a - 2, Y0, 3, Y1 - Y0); c.fillRect(b - 1, Y0, 3, Y1 - Y0); c.restore(); } });
}
// 狂暴计时（DPS 检查）：t 秒没打倒 → 攻击 ×atk、移速 ×speed、出招间隔 ×0.6
defineBossMech('enrage', { defaults: { t: 180, atk: 1.8, speed: 1.3, say: '狂暴了！' },
  update(m, st, p) { if (st.fired || st.t < p.t) return; st.fired = true; m.atk = Math.round(m.atk * p.atk); m.speed *= p.speed; m.msCdMul = 0.6; msEnrageFx(m, p); msNetEv(m, st, 'f'); },
  mirror: { ev(m, st, p, e) { if (e === 'f') { st.fired = true; if (m) msEnrageFx(m, p); } } },   // 攻击力变了会随生成信息重发（net/coop.js snapshot）
  hud(c, m, st, x, y) { const left = st.p.t - st.t; uiText(st.fired ? '狂暴中' : `狂暴倒计时 ${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}`, x + 790, y + 14, { size: 15, align: 'right', color: st.fired || left < 30 ? '#ff6a4a' : '#e8d8c8', sw: 3 }); return 18; } });
function msEnrageFx(m, p) { msSay(m, p.say, '#ff4a3a', 18); toastMsg(`${m.name}${p.say}`, '#ff6a4a'); fxAura(m, '#ff3a2a', 1.2); sfx.boom(1); }
// 分身：召出 n 个暗影（kind 默认 <领主 id>Shade），领主混在里面换位置；打暗影会被惩罚（punish: nova 爆炸 | heal 领主回血），打中本体分身就散了
defineBossMech('clones', { defaults: { n: 3, hp: 0.015, dur: 14, punish: 'nova', dmg: 1.2, r: 110, kind: '', say: '' },
  start(m, st, p) {
    const kind = p.kind || m.kind + 'Shade', W = msRoomW(), slots = [];
    for (let i = 0; i <= p.n; i++) slots.push({ x: clamp(W * (0.15 + 0.7 * i / p.n) + rnd(-40, 40), 80, W - 80), y: rnd(30, DEPTH - 30) });
    const me = Math.floor(Math.random() * slots.length);
    st.from = [Math.round(m.x), Math.round(m.y)];
    fxBurst(m.x, m.y, 60, 200, '#6a3aaa'); if (m.act) m.endAct(); m.x = slots[me].x; m.y = slots[me].y; fxBurst(m.x, m.y, 60, 140, '#6a3aaa');
    st.shades = slots.filter((s, i) => i !== me).map(s => { const o = spawnMonster(kind, s.x, s.y, { lvl: m.lvl, ...skyMul() }); o.hp = o.hpMax = Math.max(1, Math.round(m.hpMax * p.hp)); o.noLoot = true; o.msCloneOf = m; o.face = m.face;
      o.onDeath = () => { if (st.done) return; if (p.punish === 'heal') { const h = Math.round(m.hpMax * 0.03); m.hp = Math.min(m.hpMax, m.hp + h); addNumber(h, m.x, m.y, m.z + 40, { heal: true }); } msClonePunish(o, p, o.x, o.y); msNetEv(m, st, 'px', { x: Math.round(o.x), y: Math.round(o.y), s: o.nid || 0 }); MS_STATS.mech.clonePunish = (MS_STATS.mech.clonePunish || 0) + 1; };
      return o; });
    if (p.say) toastMsg(p.say, '#d0b0ff');
  },
  onHit(m, st) { st.revealed = true; },
  update(m, st, p) { if (st.revealed || st.t > p.dur || st.shades.every(o => o.dead)) st.done = true; },
  end(m, st) { msMechResult(m, st, !!st.revealed); for (const o of st.shades) if (!o.dead && !o.remove) { fxBurst(o.x, o.y, 50, 110, '#6a3aaa'); o.remove = true; } if (st.revealed) fxText('找到本体了！', m.x, m.y, m.z + 90, { col: '#ffe070', size: 15 }); },
  net: (m, st) => ({ a: st.from, b: [Math.round(m.x), Math.round(m.y)], sh: st.shades.map(o => o.nid || 0) }),
  mirror: {   // 队员：暗影是主机刷的（同步成傀儡）；打错暗影的惩罚爆炸按主机发来的位置放，打的是自己
    start(m, st, p, d) { if (d.a) fxBurst(d.a[0], d.a[1], 60, 200, '#6a3aaa'); if (d.b) fxBurst(d.b[0], d.b[1], 60, 140, '#6a3aaa'); st.sh = d.sh || []; if (p.say) toastMsg(p.say, '#d0b0ff'); },
    ev(m, st, p, e, d) { if (e === 'px') { const o = msNetEnt(d.s) || m; if (o) msClonePunish(o, p, d.x, d.y); } },
    end(m, st, p, d) { for (const id of st.sh || []) { const o = msNetEnt(id); if (o && !o.dead && !o.remove) { fxBurst(o.x, o.y, 50, 110, '#6a3aaa'); o.remove = true; } } if (d.r && m) fxText('找到本体了！', m.x, m.y, m.z + 90, { col: '#ffe070', size: 15 }); } } });
function msClonePunish(o, p, x, y) { if (p.punish === 'heal') fxText('打错了！', x, y, 60, { col: '#ff8a8a', size: 14 }); else msExplodeAt(o, x, y, { r: p.r, windup: 0.5, dmg: p.dmg, elem: 'dark', col: '#a070ff' }, null); }
// 属性切换：领主在 modes 之间轮换（每 every 秒）；场上有对应颜色的两个法阵，站在“相克”颜色的法阵里打才有全额伤害，否则 ×mul（亮破暗，暗破亮）
defineBossMech('element', { defaults: { modes: ['light', 'dark'], every: 12, mul: 0.35, r: 95, say: '' },
  start(m, st, p) { msElemInit(st, p); msElemFx(m, st, p); },
  update(m, st, p, dt) {
    st.next -= dt; if (st.next <= 0) { st.next = p.every; st.mode = (st.mode + 1) % p.modes.length; msElemSay(m, st, p); msNetEv(m, st, 'md', { i: st.mode }); }
    msElemGood(m, st, p);
  },
  end(m) { delete m.msMul.element; },
  mirror: {   // 队员：法阵、属性切换（以主机为准）照常显示；站没站对按自己算（伤害倍率主机按队员的位置另算，见 net/coop.js remoteHit）
    start(m, st, p) { msElemInit(st, p); if (m) msElemFx(m, st, p); },
    ev(m, st, p, e, d) { if (e === 'md') { st.mode = d.i | 0; st.next = p.every; if (m) msElemSay(m, st, p); } },
    update(m, st, p) { if (m) msElemGood(m, st, p); },
    end(m) { if (m && m.msMul) delete m.msMul.element; } },
  hud(c, m, st, x, y) { const cur = st.p.modes[st.mode], want = st.p.modes.find(md => md !== cur); uiText(`${ELEM_NAME_MS[cur]}属性 · 站进${ELEM_NAME_MS[want]}之阵攻击${st.good ? '（有效）' : `（伤害 ×${st.p.mul}）`}`, x, y + 14, { size: 15, color: st.good ? '#ffe8a0' : '#c8b8e8', sw: 3 }); return 18; } });
function msElemInit(st, p) { const W = msRoomW(); st.mode = 0; st.next = p.every; st.zones = p.modes.map((md, i) => ({ md, x: W * (i ? 0.72 : 0.28), y: DEPTH / 2 })); }
function msElemSay(m, st, p) { msSay(m, `${m.name}变成了${ELEM_NAME_MS[p.modes[st.mode]] || p.modes[st.mode]}属性！`, MS_ELEM_COL[p.modes[st.mode]], 14); }
const msElemOk = (st, p, pl) => { const cur = p.modes[st.mode], z = pl && st.zones.find(z => inGround(pl, z.x, z.y, p.r)); return !!(z && z.md !== cur); };
function msElemGood(m, st, p) { st.good = msElemOk(st, p, msSelf()); (m.msMul ??= {}).element = st.good ? 1 : p.mul; }
// 某个玩家打这只怪时的属性倍率（组队主机按队员影子的位置算队员的命中）；没有属性切换机制时是 1
function msElemMulFor(m, pl) { const st = m.msMechs && m.msMechs.find(s => s.id === 'element' && !s.done); return st ? (msElemOk(st, st.p, pl) ? 1 : st.p.mul) : 1; }
function msElemFx(m, st, p) {
    addFx({ x: 0, y: -1, z: 0, dur: 1e9, st, draw(c) { const e = msLive(m); if (this.st.done || e.dead) { this.t = this.dur; return; }
      c.save(); c.globalCompositeOperation = 'lighter';
      for (const z of this.st.zones) { const X = sx(z.x), Y = sy(z.y, 0), col = MS_ELEM_COL[z.md] || '#ffffff'; c.globalAlpha = 0.22; c.fillStyle = col; c.beginPath(); c.ellipse(X, Y, p.r, p.r * GR, 0, 0, TAU); c.fill(); c.globalAlpha = 0.8; c.strokeStyle = col; c.lineWidth = 2; c.stroke(); }
      const col = MS_ELEM_COL[p.modes[this.st.mode]], H = e.h * (e.scale || 1); c.globalAlpha = 0.35 + 0.15 * Math.sin(game.t * 6); c.strokeStyle = col; c.lineWidth = 3; if (msShown(e)) { c.beginPath(); c.ellipse(sx(e.x), sy(e.y, e.z) - H * 0.5, H * 0.45, H * 0.62, 0, 0, TAU); c.stroke(); }
      c.restore(); } });
}
const ELEM_NAME_MS = { light: '光', dark: '暗', fire: '火', ice: '冰' };
// 连线：召出搭档 kind（hp × 领主最大 HP），两者之间有连线
// mode = guard 搭档活着时领主受到的伤害 ×mul | share 领主受到的伤害分 share 给搭档 | close 两者距离小于 dist 时每秒各回 1% HP
// 搭档倒下 → 机制结束；onBreak: 'groggy' 领主直接破招
defineBossMech('tether', { defaults: { kind: '', mode: 'guard', mul: 0.35, share: 0.5, dist: 180, hp: 0.2, onBreak: 'groggy', say: '', col: '#ff8ab0' },
  start(m, st, p) {
    const W = msRoomW(), pt = spawnMonster(p.kind, m.x < W / 2 ? W - 170 : 170, clamp(m.y + 50, 20, DEPTH - 20), { lvl: m.lvl, drop: true, ...skyMul() });
    pt.hp = pt.hpMax = Math.round(m.hpMax * p.hp); pt.noLoot = true; st.pt = pt; st.tick = 0;
    if (p.mode === 'guard') m.msMul.tether = p.mul;
    msTetherFx(m, st, p);
  },
  net: (m, st) => ({ pt: st.pt.nid || 0 }),
  mirror: {   // 队员：搭档是主机刷的（同步成傀儡），这里画连线、HUD 提示
    start(m, st, p, d) { st.ptId = d.pt; st.pt = msNetEnt(d.pt) || { name: MON[p.kind] ? MON[p.kind].name : '', dead: false, remove: false, x: 0, y: 0, z: 0, h: 80 }; if (!m) return; if (p.mode === 'guard') (m.msMul ??= {}).tether = p.mul; msTetherFx(m, st, p); },
    update(m, st) { const o = msNetEnt(st.ptId); if (o) st.pt = o; },
    end(m, st, p) { if (!m) return; if (m.msMul) delete m.msMul.tether; fxText('连线断开了！', m.x, m.y, m.z + 90, { col: p.col, size: 16, dur: 1.4 }); } },
  onHit(m, st, dmg) { if (st.p.mode !== 'share' || st.pt.dead) return; const s = Math.round(dmg * st.p.share); m.hp = Math.min(m.hpMax, m.hp + s); st.pt.hp = Math.max(1, st.pt.hp - s); },
  update(m, st, p, dt) {
    if (st.pt.dead || st.pt.remove) { st.done = true; return; }
    if (p.mode === 'close') { st.tick -= dt; if (st.tick <= 0) { st.tick = 1; if (Math.abs(st.pt.x - m.x) < p.dist) for (const e of [m, st.pt]) { const h = Math.round(e.hpMax * 0.01); e.hp = Math.min(e.hpMax, e.hp + h); addNumber(h, e.x, e.y, e.z + 40, { heal: true }); } } }
  },
  end(m, st, p) { msMechResult(m, st, !!st.pt.dead); delete m.msMul.tether; fxText('连线断开了！', m.x, m.y, m.z + 90, { col: p.col, size: 16, dur: 1.4 }); if (p.onBreak === 'groggy' && st.pt.dead) msGroggyBreak(m); },
  hud(c, m, st, x, y) { const p = st.p; uiText(p.mode === 'guard' ? `${st.pt.name}在守护：伤害 ×${p.mul}，先打倒${st.pt.name}` : p.mode === 'share' ? `伤害分担给${st.pt.name}` : `把${m.name}和${st.pt.name}分开`, x, y + 14, { size: 15, color: '#ffc8d8', sw: 3 }); return 18; } });
function msTetherFx(m, st, p) {
  if (p.say) toastMsg(p.say, p.col);
  addFx({ x: 0, y: -1, z: 0, dur: 1e9, st, draw(c) { const pt = this.st.pt, e = msLive(m); if (this.st.done || e.dead || !pt || pt.dead) { this.t = this.dur; return; } if (!msShown(e)) return;
    const a = [sx(e.x), sy(e.y, e.z + e.h * 0.6)], b = [sx(pt.x), sy(pt.y, pt.z + pt.h * 0.6)], wob = Math.sin(game.t * 9) * 6;
    c.save(); c.globalCompositeOperation = 'lighter'; c.strokeStyle = p.col; c.globalAlpha = 0.7; c.lineWidth = 3; c.beginPath(); c.moveTo(a[0], a[1]); c.quadraticCurveTo((a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - 30 + wob, b[0], b[1]); c.stroke(); c.restore(); } });
}
/* ================= 逻辑计时器（不画东西的每帧逻辑：duo 复活、物件引信、残留区结算、领主藏起来时的机制……） =================
   不挂在特效列表上：特效太多时会按 FX_CAP 从最早的删掉，挂在上面的逻辑会被一起删（领主藏起来就再也出不来）。换房间时清空（game/dungeon.js enter） */
const MS_TICKS = [];
function msTicker(fn) { MS_TICKS.push(fn); return fn; }
function msRoomReset() { MS_TICKS.length = 0; if (typeof MS_POOLS !== 'undefined') MS_POOLS.length = 0; }
{
  const ug0 = updateGroundFx;
  updateGroundFx = function (dt) { ug0(dt); for (let i = MS_TICKS.length - 1; i >= 0; i--) { let done = true; try { done = MS_TICKS[i](dt); } catch (e) { frameErr('msTick', e); } if (done) MS_TICKS.splice(i, 1); } };
}
/* ================= 领主机制库 · 第二批（docs/BOSS_SPEC.md §2）：stagger form stance duo gauntlet arena protect facing ================= */
// 地面层的常驻绘制（场地地砖、雾……）：直接放进 groundFx（不记预警），换房间 / 领主倒下时随 groundFx 一起清掉
const msGround = (draw, o) => { const g = { t: 0, dur: 1e9, r: 0, x: 0, y: -1, kind: 'ms', col: '#000', draw, ...o }; groundFx.push(g); return g; };
const msGroundOff = g => { if (g) { const i = groundFx.indexOf(g); if (i >= 0) groundFx.splice(i, 1); } };
// 跟着领主的头顶条（stagger 蓄力条、plant 引信……）：k() 返回 0~1
function msHeadBar(e, k, col, label, alive) {
  return addFx({ x: e.x, y: e.y + 2, z: 0, dur: 1e9, update() { const E = msLive(e); this.x = E.x; this.y = E.y + 2; if (!alive() || E.dead) this.t = this.dur; },
    draw(c) { const E = msLive(e); if (!msShown(E)) return; const H = E.h * (E.scale || 1), X = sx(E.x), Y = sy(E.y, E.z + H) - 26, w = 84, v = clamp(k(), 0, 1);
      c.save(); c.fillStyle = 'rgba(10,8,12,.85)'; c.fillRect(X - w / 2 - 2, Y - 2, w + 4, 11); c.fillStyle = col; c.fillRect(X - w / 2, Y, w * v, 7); c.restore();
      if (label) uiTextWorld2(c, label, X, Y - 6, col); } });
}
function uiTextWorld2(c, txt, x, y, col) { c.save(); c.font = '700 13px "PingFang SC","Microsoft YaHei",sans-serif'; c.textAlign = 'center'; c.lineWidth = 3; c.strokeStyle = '#140a1a'; c.strokeText(txt, x, y); c.fillStyle = col; c.fillText(txt, x, y); c.restore(); }
function msBreakStun(m, dur = 3) { if (m.act) m.endAct(); m.superArmor = 0; addStatus(m, 'stun', dur, { force: true }); fxText('BREAK!', m.x, m.y, m.z + 60, { col: '#ffd23a', size: 20, dur: 1.2 }); cam.shake = Math.max(cam.shake, 8); sfx.boom(0.9); }
// ---- stagger 蓄力破招窗口：领主读条 windup 秒（霸体，头顶蓄力条）；期间打够 need×最大 HP 的伤害（或 hits 次命中）→ 打断 + 破招，否则放出大招 skill ----
defineBossMech('stagger', { defaults: { windup: 3, need: 0.04, hits: 0, onBreak: 'groggy', stun: 3, skill: null, say: '蓄力中——打断它！', col: '#ffb030', clip: 'charge' },
  precompile(D, o) {
    msNestA(D, o, '_H', { use: 'hold', dur: o.windup ?? 3, clip: o.clip || 'charge', say: o.say ?? '蓄力中——打断它！', col: o.col || '#ffb030' });
    const S = o.skill || o.onFail; if (S) msNestA(D, o, '_S', { ...S, punish: true });
  },
  start(m, st, p) {
    const o = st.spec; if (!o._pc) { Object.defineProperty(o, '_pc', { value: true }); BOSS_MECHS.stagger.precompile(m.def_, o); }
    st.acc = 0; st.n = 0; st.k = 0; st.S = o._S; m.msQueue = [];
    msStart(m, o._H); m.act.msHold = st;
    msStaggerFx(m, st, p);
  },
  onHit(m, st, dmg) { if (st.done) return; st.acc += dmg; st.n++; const p = st.p; st.k = Math.min(1, p.hits ? st.n / p.hits : st.acc / (m.hpMax * p.need)); if (st.k >= 1) { st.broken = true; st.done = true; } },
  update(m, st, p) {
    if (st.done) return;
    if (st.t > 0.15 && !(m.act && m.act.msHold === st)) { st.broken = true; st.done = true; return; }   // 读条被别的东西打断了（破招槽破了、进阶段）：算打断
    if (st.t >= p.windup) st.done = true;
  },
  end(m, st, p) {
    if (m.act && m.act.msHold === st) m.endAct();
    msMechResult(m, st, !!st.broken);
    if (st.broken) { msStaggerBreakFx(m); if (m.dead) return; if (p.onBreak === 'groggy' && msMechActive(m, 'groggy')) msGroggyBreak(m); else msBreakStun(m, p.stun); return; }
    if (st.S && !m.dead) { m.msQueue = [st.S]; }
  },
  netState: st => ({ k: +(st.k || 0).toFixed(2) }),
  mirror: { start(m, st, p) { st.k = 0; if (m) msStaggerFx(m, st, p); }, end(m, st, p, d) { st.done = true; if (d.b && m) msStaggerBreakFx(m); } },
  hud(c, m, st, x, y, w) { msBar(c, x, y, w, st.k || 0, st.p.col, `打断 ${Math.round((st.k || 0) * 100)}%`); return 16; } });
function msStaggerFx(m, st, p) { toastMsg(p.say, p.col); msHeadBar(m, () => st.k || 0, p.col, '打断！', () => !st.done); }
function msStaggerBreakFx(m) { fxText('打断！', m.x, m.y, m.z + m.h * (m.scale || 1) + 30, { col: '#ffd23a', size: 22, dur: 1.4 }); cam.flash = 0.12; cam.flashCol = '#ffe0a0'; sfx.boom(1); }
// ---- form 形态切换：换精灵 / 体型 / 浮空 / 招式表（过渡无敌）；dur 秒后变回（0 = 一直保持到领主倒下），land = 变回来时接的一招 ----
defineBossMech('form', { defaults: { art: null, scale: 1, fly: 0, dur: 0, skills: null, replace: null, invulT: 1.2, say: '', col: '#bfe6ff', name: '' },
  precompile(D, o) { const tok = 'form:' + (D.msTokN = (D.msTokN || 0) + 1); msPin(o, '_tok', tok); msPin(o, '_ids', msGateList(D, o.skills, tok)); if (o.land) msNestA(D, o, '_L', o.land); },
  start(m, st, p) {
    const o = st.spec; if (!o._pc) { Object.defineProperty(o, '_pc', { value: true }); BOSS_MECHS.form.precompile(m.def_, o); }
    st.gate = { ids: o._ids, tok: o._tok, replace: p.replace ?? !!(p.skills && p.skills.length) }; (m.msGates ??= []).push(st.gate);
    m.msQueue = [];
    if (p.invulT) m.invul = Math.max(m.invul, p.invulT);
    msFormLook(m, st, p);
  },
  update(m, st, p, dt) { if (p.dur && st.t >= p.dur) { st.done = true; return; } if (p.fly) msFormHover(m, p, dt); },
  end(m, st) { if (m.msGates) m.msGates = m.msGates.filter(g => g !== st.gate); msFormUnlook(m, st); if (st.spec._L && !m.dead) (m.msQueue ??= []).push(st.spec._L); },   // land：变回来时接一招（落地砸一下）
  mirror: { start(m, st, p) { if (m) msFormLook(m, st, p); }, update(m, st, p) { if (m && m.msFormSt !== st) msFormLook(m, st, p); }, end(m, st) { if (m) msFormUnlook(m, st); } },
  hud(c, m, st, x, y) { if (!st.p.dur) return 0; uiText(`${st.p.name || '形态'} ${Math.max(0, st.p.dur - st.t).toFixed(0)}s`, x + 790, y + 14, { size: 15, align: 'right', color: st.p.col, sw: 3 }); return 18; } });
function msFormLook(m, st, p) {
  st.prev = st.prev || { model: m.model, scale: m.scale };
  if (p.art) { const md = msArtModel(p.art); if (md) m.model = md; }
  m.scale = st.prev.scale * (p.scale || 1); m.msFormSt = st;
  if (p.say) { msSay(m, p.say, p.col, 16); toastMsg(p.say, p.col); }
  fxBurst(m.x, m.y, 60, 220, p.col); sfx.boom(0.8); cam.shake = Math.max(cam.shake, 6);
}
function msFormUnlook(m, st) { if (!st.prev) return; if (m.msFormSt === st) { m.model = st.prev.model; m.scale = st.prev.scale; m.msFormSt = null; } fxBurst(m.x, m.y, 60, 180, st.p.col); }
function msFormHover(m, p, dt) { m.z = damp(m.z, p.fly, 3, dt); m.vz = 0; m.superArmor = Math.max(m.superArmor || 0, 0.2); if (m.st === 'air' || m.st === 'down') m.setState('idle'); }
// 按美术名造一个精灵模型（form 换图 / lanes 奔袭的影子）；素材没加载就返回 null（保持原样）
function msArtModel(art) {
  const [r, o] = [].concat(art); if (typeof SPR_DATA === 'undefined' || !SPR_DATA[r] || !IMG[`spr/${r}/idle`]) return null;
  return new SpriteModel(r, { ...SPR_FALLBACK, cast: 'cast1', roar: 'cast2', crouch: 'low1' }, typeof msMonAnims === 'function' ? msMonAnims(r) : SPR_ANIMS.monster, o || {});
}
// ---- stance 模式轮换（不换图）：modes 里每个模式换招式子集 + 光环颜色 + 受伤倍率 / 反伤 / 隐身 / 移速；every 秒轮换，或 at: [血量门槛…] 按血量切 ----
defineBossMech('stance', { defaults: { modes: [], every: [12, 16], at: null, say: '' },
  precompile(D, o) { for (const md of o.modes || []) { const tok = 'stance:' + (D.msTokN = (D.msTokN || 0) + 1); msPin(md, '_tok', tok); msPin(md, '_ids', msGateList(D, md.skills, tok)); } },
  start(m, st, p) {
    const o = st.spec; if (!o._pc) { Object.defineProperty(o, '_pc', { value: true }); BOSS_MECHS.stance.precompile(m.def_, o); }
    st.i = -1; st.base = { speed: m.speed, atk: m.atk }; msStanceSet(m, st, p, 0, false);
  },
  update(m, st, p, dt) {
    if (p.at) { const i = p.at.filter(a => m.hp <= m.hpMax * a).length % p.modes.length; if (i !== st.i) msStanceSet(m, st, p, i, true); return; }
    st.next -= dt; if (st.next <= 0) msStanceSet(m, st, p, (st.i + 1) % p.modes.length, true);
  },
  end(m, st) { msStanceClear(m, st); msStanceLook(m, st, st.p, -1); },
  net: (m, st) => ({ i: st.i }),
  mirror: { start(m, st, p, d) { st.i = -1; if (m) msStanceLook(m, st, p, d.i | 0); }, ev(m, st, p, e, d) { if (e === 'md' && m) msStanceLook(m, st, p, d.i | 0); }, update(m, st, p) { if (m && m.msStanceSt !== st && st.i >= 0) msStanceLook(m, st, p, st.i); }, end(m, st, p) { if (m) msStanceLook(m, st, p, -1); } },
  hud(c, m, st, x, y) { const md = st.p.modes[st.i]; if (!md) return 0; uiText(`${md.name || md.id || '模式'}${st.p.at ? '' : ` · ${Math.max(0, st.next || 0).toFixed(0)}s`}`, x + 790, y + 14, { size: 15, align: 'right', color: md.col || '#ffe070', sw: 3 }); return 18; } });
function msStanceClear(m, st) { if (st.gate && m.msGates) m.msGates = m.msGates.filter(g => g !== st.gate); st.gate = null; msMulSet(m, 'stance', null); if (st.base) { m.speed = st.base.speed; m.atk = st.base.atk; } }
function msStanceSet(m, st, p, i, send) {
  msStanceClear(m, st);
  const md = p.modes[i]; st.i = i; st.next = rnd(...[].concat(p.every, p.every).slice(0, 2));
  st.gate = { ids: md._ids || new Set(), tok: md._tok, replace: !!md.replace }; (m.msGates ??= []).push(st.gate);
  if (md.dmgTaken !== undefined) msMulSet(m, 'stance', md.dmgTaken);
  if (md.speed) m.speed = st.base.speed * md.speed;
  if (md.atk) m.atk = Math.round(st.base.atk * md.atk);
  msStanceLook(m, st, p, i);
  if (send) msNetEv(m, st, 'md', { i });
}
// 表现（两边一样）：光环、台词、反伤 / 隐身标记（受击时本地判定反伤：msOnDamaged → 特性钩子 stanceReflect）
function msStanceLook(m, st, p, i) {
  const md = p.modes[i]; st.i = i; m.msStanceSt = i < 0 ? null : st;
  m.msReflect = md && md.reflect ? { type: md.reflect, k: md.reflectK ?? 0.3, col: md.col || '#ff8a8a' } : null;
  m.msInvis = md ? md.invis || 0 : 0;
  if (!md) return;
  const col = md.col || '#ffe070'; if (md.say || p.say) { msSay(m, md.say || p.say, col, 15); toastMsg(md.say || p.say, col); }
  fxAura(m, col, 1); sfx.buff();
  if (!st.auraFx || st.auraFx.t >= st.auraFx.dur) st.auraFx = addFx({ x: m.x, y: m.y + 0.5, z: 0, dur: 1e9, st, update() { const E = msLive(m); this.x = E.x; this.y = E.y + 0.5; if (this.st.done || E.dead) this.t = this.dur; },
    draw(c) { const E = msLive(m), M = this.st.p.modes[this.st.i]; if (!M || !msShown(E) || M.aura === false) return; const H = E.h * (E.scale || 1), X = sx(E.x), Y = sy(E.y, E.z);
      c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = (0.2 + 0.1 * Math.sin(game.t * 5)) * (M.invis ? 0.3 : 1); c.strokeStyle = M.col || '#ffe070'; c.lineWidth = 3; c.beginPath(); c.ellipse(X, Y - H * 0.5, H * 0.46, H * 0.62, 0, 0, TAU); c.stroke();
      c.globalAlpha *= 0.6; c.fillStyle = M.col || '#ffe070'; c.beginPath(); c.ellipse(X, Y, H * 0.5, H * 0.5 * GR, 0, 0, TAU); c.fill(); c.restore(); } });
}
// 隐身模式：模型画得很淡（包一层 model.draw；换模型 / 形态时照样生效）
{
  const ed0 = Ent.prototype.draw;
  Ent.prototype.draw = function (c) { if (!this.msInvis) return ed0.call(this, c); const md = this.model; if (!md || md.msInvisWrap) return ed0.call(this, c);
    const d0 = md.draw, k = this.msInvis; md.draw = function (x, ...a) { x.globalAlpha *= 1 - 0.85 * k; return d0.call(this, x, ...a); }; md.msInvisWrap = true;
    try { return ed0.call(this, c); } finally { md.draw = d0; md.msInvisWrap = false; } };
}
// ---- duo 多领主同场：搭档 with（领主 / 怪物 id）也是领主（全部倒下才结算，血条叠在下面）；onPartnerDown: enrage 其余的狂暴 | none；window > 0 = 必须 n 秒内一起倒下，否则倒下的复活 ----
defineBossMech('duo', { defaults: { with: [], hp: 1, window: 0, reviveHp: 0.5, onPartnerDown: 'enrage', atk: 1.3, speed: 1.25, say: '', col: '#ffb070', lvl: 0 },
  start(m, st, p) {
    const W = msRoomW(), side = m.x < W / 2 ? 1 : -1; st.group = [m];
    p.with.forEach((k, i) => {
      if (!MON[k]) return;
      const o = spawnMonster(k, clamp(m.x + side * (260 + i * 140), 80, W - 80), clamp(m.y + (i % 2 ? -60 : 60), 20, DEPTH - 20), { lvl: m.lvl + p.lvl, boss: true, drop: true, ...skyMul() });
      if (p.hp !== 1) o.hp = o.hpMax = Math.round(o.hpMax * p.hp);
      o.msDuo = st; st.group.push(o);
    });
    m.msDuo = st;
    if (game.dungeon) game.dungeon.bossGroup = [...new Set([...(game.dungeon.bossGroup || []), ...st.group])];
    if (p.say) toastMsg(p.say, p.col);
    msTicker(dt => msDuoTick(st, p, dt));
  },
  update(m, st) { if (st.group.every(o => o.dead)) st.done = true; },
  net: (m, st) => ({ g: st.group.map(o => o.nid || 0) }),
  mirror: { start(m, st, p) { if (p.say) toastMsg(p.say, p.col); } },
  // 组队队员的镜像没有 st.group（搭档是傀儡）：按场上的领主傀儡算
  hud(c, m, st, x, y) { const p = st.p, G = st.group || ents.filter(e => e.boss && e.team === 'e' && !e.remove), left = G.filter(o => !o.dead).length; uiText(`同场领主 ${left}/${G.length}：全部打倒才算通关${p.window ? `（${p.window} 秒内一起打倒，否则会复活）` : ''}`, x, y + 14, { size: 15, color: '#ffd8b0', sw: 3 }); return 18; } });
// 主机：搭档倒下 → 其余狂暴 / 计时复活；领主本体先倒下也照样跑（挂在一个特效上），返回 true = 全部倒下
function msDuoTick(st, p, dt) {
  if (game.dungeon && game.dungeon.state === 'result') return true;
  const alive = st.group.filter(o => !o.dead);
  if (!alive.length) return true;
  for (const o of st.group) {
    if (!o.dead || o.msDuoDown) continue;
    o.msDuoDown = game.t;
    MS_STATS.mech.duoDown = (MS_STATS.mech.duoDown || 0) + 1; msLog('solve', o, { id: 'duo', why: 'down' });
    if (p.onPartnerDown === 'enrage') for (const a of alive) if (!a.msDuoRage) { a.msDuoRage = true; a.atk = Math.round(a.atk * p.atk); a.speed *= p.speed; a.msCdMul = Math.min(a.msCdMul || 1, 0.7); fxAura(a, '#ff3a2a', 1.2); }
    const txt = p.onPartnerDown === 'enrage' ? `${o.name}倒下了——其余的领主暴怒了！` : `${o.name}倒下了！`;
    toastMsg(txt, '#ff8a6a'); msNetEv(alive[0], null, 'hook', { h: 'msDuo', t: txt });
  }
  if (p.window) for (let i = 0; i < st.group.length; i++) {
    const o = st.group[i]; if (!o.dead || game.t - o.msDuoDown < p.window) continue;
    const n = spawnMonster(o.kind, o.x, o.y, { lvl: o.lvl, boss: true, drop: true, ...skyMul() }); n.hp = Math.round(n.hpMax * p.reviveHp); n.msDuo = st; st.group[i] = n;
    if (game.dungeon) game.dungeon.bossGroup = [...new Set([...(game.dungeon.bossGroup || []).filter(e => e !== o), n])];
    const txt = `${n.name}复活了——要在 ${p.window} 秒内一起打倒！`; toastMsg(txt, '#ff6a6a'); msNetEv(n, null, 'hook', { h: 'msDuo', t: txt }); msLog('fail', n, { id: 'duo', why: 'revive' });
  }
  return false;
}
MS_MIRROR.msDuo = (m, d) => toastMsg(d.t, '#ff8a6a');
// ---- gauntlet 车轮战：命名精英一波一波上场（各带自己的机制），领主观战（watch，无敌、不出招）或离场（hide）；打完最后一波领主才下场 ----
defineBossMech('gauntlet', { defaults: { waves: [], boss: 'watch', elite: true, gap: 1.5, window: 0, reviveHp: 0.5, say: '', col: '#ffd070', lvl: 0 },
  start(m, st, p) {
    st.i = -1; st.cur = []; st.wait = 1.0; msMulSet(m, 'gauntlet', 0);
    if (p.boss === 'hide') msHide(m, true); else { m.msIdle = 'still'; m.botSkip = true; }
    if (p.say) { toastMsg(p.say, p.col); msSay(m, p.say, p.col, 15); }
  },
  update(m, st, p, dt) {
    if (p.window) for (let i = 0; i < st.cur.length; i++) { const o = st.cur[i]; if (!o.dead) continue; o.msGDown ??= game.t; if (st.cur.some(x => !x.dead) && game.t - o.msGDown > p.window) { const n = spawnMonster(o.kind, o.x, o.y, { lvl: o.lvl, elite: o.elite, drop: true, ...skyMul() }); n.hp = Math.round(n.hpMax * p.reviveHp); n.name = o.name; st.cur[i] = n; toastMsg(`${n.name}复活了！`, '#ff6a6a'); msLog('fail', m, { id: 'gauntlet', why: 'revive' }); } }
    if (st.cur.some(o => !o.dead && !o.remove)) return;
    st.wait -= dt; if (st.wait > 0) return;
    if (st.i + 1 >= p.waves.length) { st.done = true; return; }
    st.i++; st.wait = p.gap;
    const w = p.waves[st.i], W = msRoomW(), n = w.n || 1, pl = game.player;
    st.cur = [];
    for (let k = 0; k < n; k++) {
      const x = clamp(pl ? pl.x + (pl.x < W / 2 ? 1 : -1) * (300 + k * 90) : W * 0.6, 80, W - 80), o = spawnMonster(w.kind, x, clamp(DEPTH / 2 + (k - (n - 1) / 2) * 50, 20, DEPTH - 20), { lvl: m.lvl + p.lvl, elite: w.elite ?? p.elite, drop: true, ...skyMul() });
      if (w.hp) o.hp = o.hpMax = Math.round(o.hpMax * w.hp);
      if (w.name) o.name = w.name;
      for (const s of w.mechs || []) msMechStart(o, s);
      st.cur.push(o);
    }
    const txt = w.say || `${st.cur[0].name}上场了！（${st.i + 1}/${p.waves.length}）`; toastMsg(txt, p.col);
    msNetEv(m, st, 'wv', { i: st.i, t: txt });
  },
  end(m, st, p) { msMechResult(m, st, st.i >= p.waves.length - 1); msMulSet(m, 'gauntlet', null); m.msIdle = null; m.botSkip = false; if (m.msHidden) msHide(m, false); msSay(m, p.done || `${m.name}亲自上场了！`, p.col, 16); },
  mirror: { start(m, st, p) { st.i = -1; if (p.say) toastMsg(p.say, p.col); if (m) msMulSet(m, 'gauntlet', 0); }, ev(m, st, p, e, d) { if (e === 'wv') { st.i = d.i | 0; toastMsg(d.t, p.col); } }, end(m) { if (m) msMulSet(m, 'gauntlet', null); } },
  hud(c, m, st, x, y) { const p = st.p, w = p.waves[st.i]; uiText(`车轮战 ${Math.max(0, st.i + 1)}/${p.waves.length}${w ? ' · ' + (w.name || (MON[w.kind] || {}).name || '') : ''} —— 领主无敌`, x, y + 14, { size: 15, color: '#ffe0a0', sw: 3 }); return 18; } });
// ---- arena 场地规则：fog 视野雾 | wind 场地推力 | tiles 地砖（岩浆 / 断层，按主机的布局轮换）| cover 掩体（配合 mark cover）| slide 冰面惯性；dur 0 = 一直持续 ----
defineBossMech('arena', { defaults: { kind: 'fog', dur: 0, r: 260, vx: -70, cols: 6, hot: 0.5, every: 6, warn: 1.2, frac: 0.05, tick: 0.5, n: 3, cover: 'msCover', slide: 0.92, say: '', col: '#ff7a3a' },
  start(m, st, p) {
    if (p.kind === 'tiles') { st.mask = msTileMask(p); st.warnT = p.warn; st.next = p.every; }
    if (p.kind === 'cover') { const W = msRoomW(); st.objs = []; for (let i = 0; i < p.n; i++) { const o = spawnMonster(p.cover, W * (0.2 + 0.6 * i / Math.max(1, p.n - 1)), i % 2 ? DEPTH * 0.3 : DEPTH * 0.7, { lvl: m.lvl, ...skyMul() }); st.objs.push(o); } }
    msArenaLook(m, st, p);
  },
  update(m, st, p, dt) {
    if (p.dur && st.t >= p.dur) { st.done = true; return; }
    if (p.kind === 'tiles') { st.next -= dt; if (st.next <= 0) { st.next = p.every; st.mask = msTileMask(p); st.warnT = p.warn; msNetEv(m, st, 'tl', { m: st.mask }); } }
    msArenaSelf(m, st, p, dt);
  },
  end(m, st) { msGroundOff(st.g); if (st.objs) for (const o of st.objs) if (!o.dead) { o.remove = true; } },
  net: (m, st) => (st.mask ? { m: st.mask } : null),
  mirror: { start(m, st, p, d) { if (d && d.m) { st.mask = d.m; st.warnT = p.warn; } if (m) msArenaLook(m, st, p); }, ev(m, st, p, e, d) { if (e === 'tl') { st.mask = d.m; st.warnT = p.warn; } }, update(m, st, p, dt) { if (m) msArenaSelf(m, st, p, dt); }, end(m, st) { msGroundOff(st.g); } },
  hud(c, m, st, x, y) { const k = st.p.kind, T = { fog: '浓雾：视野受限', wind: '异界之风：被吹向一侧', tiles: '地砖：闪烁的格子马上变烫', cover: '找掩体', slide: '冰面：脚下打滑' }; uiText(T[k] || '', x, y + 14, { size: 15, color: '#ffd0a0', sw: 3 }); return 18; } });
// 地砖布局：cols 列，热格至少留一半安全（最少 1 格）
function msTileMask(p) { const n = p.cols, hot = clamp(Math.round(n * p.hot), 1, n - 1), idx = Array.from({ length: n }, (_, i) => i).sort(() => Math.random() - 0.5).slice(0, hot); return Array.from({ length: n }, (_, i) => (idx.includes(i) ? 1 : 0)); }
function msArenaLook(m, st, p) {
  if (p.say) { toastMsg(p.say, p.col); msSay(m, p.say, p.col, 15); }
  st.tick = 0; st.mom = 0; st.lx = null;
  if (p.kind === 'fog') st.g = msGround(null, { fogR: p.r });
  if (p.kind === 'tiles') st.g = msGround((c, g) => { const W = msRoomW(), w = W / p.cols, Y0 = sy(0, 0), Y1 = sy(DEPTH, 0), blink = Math.floor(game.t * 8) % 2;
    c.save(); for (let i = 0; i < p.cols; i++) { const on = st.mask && st.mask[i]; if (!on) continue; const warn = st.warnT > 0; c.globalAlpha = warn ? 0.18 + 0.2 * blink : 0.42; c.fillStyle = p.col; c.fillRect(sx(i * w) + 2, Y0, w - 4, Y1 - Y0); } c.restore(); });
  if (p.kind === 'wind') st.g = msGround((c) => { c.save(); c.globalAlpha = 0.35; c.strokeStyle = '#e8f4ff'; c.lineWidth = 2; const Y0 = sy(0, 0), Y1 = sy(DEPTH, 0), dir = Math.sign(p.vx) || 1;
    for (let i = 0; i < 14; i++) { const y = Y0 + ((i * 53) % (Y1 - Y0)), x = ((game.t * 420 * dir + i * 197) % WW + WW) % WW; c.beginPath(); c.moveTo(x, y - 30); c.lineTo(x - dir * 60, y - 30); c.stroke(); } c.restore(); });
  if (p.kind === 'slide') st.g = msGround((c) => { c.save(); c.globalAlpha = 0.12; c.fillStyle = '#dff6ff'; c.fillRect(0, sy(0, 0), WW, sy(DEPTH, 0) - sy(0, 0)); c.restore(); });
}
// 本机玩家按场地规则受影响（主机、队员各算自己）
function msArenaSelf(m, st, p, dt) {
  const t = msSelf(); if (!t || t.dead) return;
  if (p.kind === 'wind' && t.st !== 'held' && !(t.invul > 5)) { t.x = clamp(t.x + p.vx * dt, 20, msRoomW() - 20); }
  if (p.kind === 'tiles') {
    if (st.warnT > 0) { st.warnT -= dt; return; }
    const w = msRoomW() / p.cols, i = clamp(Math.floor(t.x / w), 0, p.cols - 1);
    st.tick -= dt; if (st.tick > 0) return; st.tick = p.tick;
    if (st.mask && st.mask[i] && t.z < 12) { const s0 = msNetSrc; msNetSrc = msNetSrc || 'arena'; try { msTrueHit(m, t, p.frac * msPunishK()); } finally { msNetSrc = s0; } addStatus(t, 'burn', 1, { src: m }); }
  }
  if (p.kind === 'slide') { if (st.lx !== null && (t.st === 'walk' || t.st === 'run' || t.st === 'idle')) { const v = (t.x - st.lx) / Math.max(dt, 1e-3); st.mom = damp(st.mom, v, 1.5, dt); if (t.st === 'idle') t.x = clamp(t.x + st.mom * dt * p.slide, 20, msRoomW() - 20); } st.lx = t.x; }
}
// 视野雾：本机玩家周围 r 以外压暗（接在前景层 drawRoomFore 后面画，盖住实体和特效，不盖 HUD）
{
  const fx0 = drawRoomFore;
  drawRoomFore = function (c, R) { fx0(c, R); const g = groundFx.find(g => g.fogR); if (!g) return; const t = msSelf(); if (!t) return; const X = sx(t.x), Y = sy(t.y, t.z + 50), r = g.fogR;
    c.save(); const G = c.createRadialGradient(X, Y, r * 0.55, X, Y, r * 1.25); G.addColorStop(0, 'rgba(12,10,16,0)'); G.addColorStop(1, 'rgba(12,10,16,0.93)'); c.fillStyle = G; c.fillRect(0, 0, WW, WH); c.restore(); };
}
// ---- protect 保护 / 护送：刷一个要保护的物件 kind（主机无敌，玩家打不动）；threat 的小怪会被它吸引，摸到就扣一条命（onTouch：heal 领主回血 | none）；
//      escort: { to: 'boss' | x, speed } 物件自己往前走，走到了 onArrive（groggy 领主破招 | hurt 领主掉 frac 血）；命用完 onLose（enrage | heal | nova | fail 全队真实伤害） ----
defineBossMech('protect', { defaults: { kind: 'msHeart', lives: 5, at: 'left', threat: null, spawn: null, onTouch: 'heal', heal: 0.03, onLose: 'enrage', frac: 0.25, escort: null, onArrive: 'groggy', say: '', col: '#ff8ab0', name: '' },
  start(m, st, p) {
    const W = msRoomW(), x = typeof p.at === 'number' ? W * p.at : p.at === 'right' ? W - 120 : p.at === 'center' ? W / 2 : 120;
    const o = st.obj = spawnMonster(p.kind, x, DEPTH / 2, { lvl: m.lvl, ...skyMul() }); o.invul = 1e9; o.botSkip = true; o.noLoot = true; if (p.name) o.name = p.name; o.msProtect = st;
    st.lives = p.lives; st.spawnT = p.spawn ? (p.spawn.first ?? 2) : 1e9; st.tauntT = 0;
    if (p.say) { toastMsg(p.say, p.col); msSay(m, p.say, p.col, 15); }
    msProtectFx(m, st, p);
  },
  update(m, st, p, dt) {
    const o = st.obj; if (!o || o.dead || o.remove) { st.done = true; return; }
    o.invul = 1e9;
    if (p.escort && !st.arrived) {
      const tx = p.escort.to === 'boss' ? m.x : typeof p.escort.to === 'number' ? msRoomW() * p.escort.to : msRoomW() - 100, d = tx - o.x;
      if (Math.abs(d) < 60) { st.arrived = true; msProtectArrive(m, st, p); } else { o.x += Math.sign(d) * (p.escort.speed || 40) * dt; o.face = Math.sign(d) || 1; o.setState('walk'); }
    }
    if (p.spawn && (st.spawnT -= dt) <= 0) { st.spawnT = p.spawn.every || 8; const W = msRoomW(); for (let i = 0; i < (p.spawn.n || 2); i++) spawnMonster(p.spawn.kind, o.x < W / 2 ? W - 80 : 80, rnd(30, DEPTH - 30), { lvl: m.lvl - 1, drop: true, ...skyMul() }); }
    const threats = ents.filter(e => e.team === 'e' && !e.dead && !e.remove && e !== m && e !== o && !e.boss && !(e.def_ && e.def_.msObj) && (!p.threat || [].concat(p.threat).includes(e.kind)));
    if ((st.tauntT -= dt) <= 0) { st.tauntT = 1; for (const e of threats) addStatus(e, 'taunt', 1.6, { src: o, force: true }); }
    for (const e of threats) if (Math.abs(e.x - o.x) < o.w + e.w + 14 && Math.abs(e.y - o.y) < 18) {
      e.noLoot = true; e.hp = 0; killEnt(e, o, {}); st.lives--;
      if (p.onTouch === 'heal') { const h = Math.round(m.hpMax * p.heal); m.hp = Math.min(m.hpMax, m.hp + h); addNumber(h, m.x, m.y, m.z + 40, { heal: true }); }
      msNetEv(m, st, 'tc', { x: Math.round(o.x), y: Math.round(o.y) }); msProtectTouchFx(o, p);
      if (st.lives <= 0) { st.done = true; st.lost = true; break; }
    }
  },
  end(m, st, p) {
    msMechResult(m, st, !st.lost);
    if (st.lost) msProtectLose(m, st, p);
    if (st.obj && !st.obj.dead && !p.keep) { st.obj.invul = 0; st.obj.remove = true; fxBurst(st.obj.x, st.obj.y, 50, 140, p.col); }
  },
  netState: st => ({ lives: st.lives }),
  mirror: { start(m, st, p) { st.lives = p.lives; if (p.say) toastMsg(p.say, p.col); }, ev(m, st, p, e, d) { if (e === 'tc') msProtectTouchFx({ x: d.x, y: d.y, z: 0, h: 80 }, p); if (e === 'lose' && m) msProtectLoseFx(m, st, p, true); if (e === 'arr') toastMsg(d.t, p.col); } },
  hud(c, m, st, x, y) { const p = st.p, nm = p.name || (MON[p.kind] || {}).name || '目标'; uiText(`${p.escort ? '护送' : '保护'}${nm} · 剩 ${Math.max(0, st.lives ?? p.lives)}/${p.lives}${p.threat ? `（别让${(MON[[].concat(p.threat)[0]] || {}).name || '小怪'}碰到）` : ''}`, x, y + 14, { size: 15, color: '#ffc8d8', sw: 3 }); return 18; } });
function msProtectFx(m, st, p) { const o = st.obj; addFx({ x: o.x, y: o.y + 0.5, z: 0, dur: 1e9, update() { this.x = o.x; this.y = o.y + 0.5; if (st.done || o.dead || o.remove) this.t = this.dur; }, draw(c) { const X = sx(o.x), Y = sy(o.y, 0); c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.25 + 0.1 * Math.sin(game.t * 4); c.strokeStyle = p.col; c.lineWidth = 3; c.beginPath(); c.ellipse(X, Y, 46, 46 * GR, 0, 0, TAU); c.stroke(); c.restore(); } }); }
function msProtectTouchFx(o, p) { fxBurst(o.x, o.y, 50, 140, p.col); fxText('被碰到了！', o.x, o.y, (o.h || 80) + 20, { col: p.col, size: 14 }); sfx.boom(0.5); }
function msProtectArrive(m, st, p) {
  const txt = `${st.obj.name}到达了！`; toastMsg(txt, p.col); msNetEv(m, st, 'arr', { t: txt }); msLog('solve', m, { id: 'protect', why: 'arrive' });
  if (p.onArrive === 'groggy' && msMechActive(m, 'groggy')) msGroggyBreak(m); else if (p.onArrive === 'hurt') { const d = Math.round(m.hpMax * (p.hurt ?? 0.1)); m.hp = Math.max(1, m.hp - d); addNumber(d, m.x, m.y, m.z + 30, {}); }
  st.done = true;
}
function msProtectLose(m, st, p) { msNetEv(m, st, 'lose'); msProtectLoseFx(m, st, p, false); }
function msProtectLoseFx(m, st, p, mirror) {
  toastMsg(`没能守住${st.obj ? st.obj.name : ''}……`, '#ff6a6a');
  if (p.onLose === 'enrage' && !mirror) { m.atk = Math.round(m.atk * 1.4); m.msCdMul = Math.min(m.msCdMul || 1, 0.7); fxAura(m, '#ff3a2a', 1.2); }
  else if (p.onLose === 'heal' && !mirror) { const h = Math.round(m.hpMax * 0.2); m.hp = Math.min(m.hpMax, m.hp + h); addNumber(h, m.x, m.y, m.z + 40, { heal: true }); }
  else if (p.onLose === 'nova') skyNova(m, 320, 1.2, '#ff5a5a', { dmg: 1.8 * msPunishK() });
  else if (p.onLose === 'fail') { const t = msSelf(); if (t) msTrueHit(m, t, p.frac * msPunishK()); }
}
// ---- facing 朝向判定（希洛克凝视的通用版）：windup 秒后结算；mode away = 必须背对领主（面朝的挨 frac + 状态），toward = 必须面朝领主 ----
defineBossMech('facing', { defaults: { mode: 'away', windup: 1.8, frac: 0.15, status: 'slow', sdur: 3, say: '', col: '#ff9ad0' },
  start(m, st, p) { msFacingFx(m, st, p); },
  update(m, st, p) { if (st.t < p.windup) return; st.done = true; msFacingResolve(m, st, p); },
  mirror: { start(m, st, p) { if (m) msFacingFx(m, st, p); }, update(m, st, p) { if (!st.fired && st.t >= p.windup) { st.fired = true; if (m) msFacingResolve(m, st, p); } }, end(m, st, p) { if (!st.fired) { st.fired = true; if (m) msFacingResolve(m, st, p); } } } });
function msFacingFx(m, st, p) {
  const txt = p.say || (p.mode === 'away' ? `${m.name}的凝视——背对它！` : `${m.name}的威压——面朝它！`); toastMsg(txt, p.col); msSay(m, txt, p.col, 15); sfx.buff();
  addFx({ x: m.x, y: m.y + 1, z: 0, dur: p.windup, draw(c) { const E = msLive(m), k = this.t / this.dur, H = E.h * (E.scale || 1), X = sx(E.x), Y = sy(E.y, E.z) - H * 0.55;
    c.save(); c.globalAlpha = Math.min(1, k * 4); for (let i = 0; i < 7; i++) { const a = i / 7 * TAU + game.t * 0.8, ex = X + Math.cos(a) * H * 0.7, ey = Y + Math.sin(a) * H * 0.42, o = Math.min(1, k * 1.6);
      c.fillStyle = '#f4ecff'; c.beginPath(); c.ellipse(ex, ey, 9, 5 * o + 0.5, 0, 0, TAU); c.fill(); c.fillStyle = p.col; c.beginPath(); c.arc(ex, ey, 3 * o, 0, TAU); c.fill(); }
    uiTextWorld(c, `${Math.max(0, this.dur - this.t).toFixed(1)}`, X, Y - H * 0.55, p.col); c.restore(); } });
}
function msFacingResolve(m, st, p) {
  if (m.dead) return; cam.flash = 0.12; cam.flashCol = p.col; sfx.boom(0.7);
  const t = msSelf(); if (!t || t.dead || t.remove || t.team !== 'p') return;
  const facing = Math.sign(m.x - t.x || 1) === t.face, ok = p.mode === 'away' ? !facing : facing;
  if (ok) { fxText(p.mode === 'away' ? '避开了凝视' : '顶住了威压', t.x, t.y, t.z + 60, { col: '#e8d8ff', size: 11 }); MS_STATS.mech.facingSafe = (MS_STATS.mech.facingSafe || 0) + 1; msLog('solve', m, { id: 'facing' }); return; }
  if (p.status) addStatus(t, p.status, p.sdur, { src: m, force: true });
  msTrueHit(m, t, p.frac * msPunishK()); MS_STATS.mech.facingHit = (MS_STATS.mech.facingHit || 0) + 1; msLog('fail', m, { id: 'facing' });
}
// 测试工具（test/boss.mjs 的 mechs 部分）用的解法：BOSS_MECHS[id].test.solve(m, st, p, BH)，BH.gw(秒) 等游戏时间、BH.kill(怪) 打掉
{
  const hitN = (m, st, n, dmg = 5) => { for (let k = 0; k < n && !st.done; k++) { m.invul = 0; applyHit(game.player, m, { dmg, sure: true, knock: 0, stun: 0.05, hs: 0 }, { proj: true }); } };
  const T = (id, solve) => { BOSS_MECHS[id].test = { solve }; };
  T('stagger', async (m, st, p, BH) => { let n = 0; while (!st.done && n++ < 200) { hitN(m, st, 20); if (!st.done) await BH.gw(0.05); } await BH.gw(0.3); });
  T('form', async (m, st, p, BH) => { if (p.dur) st.t = Math.max(st.t, p.dur - 0.2); else msMechEnd(m, st); await BH.gw(0.5); });
  T('stance', async (m, st, p, BH) => { st.next = 0; await BH.gw(0.4); msMechEnd(m, st); });
  T('duo', async (m, st, p, BH) => { for (const o of st.group.slice(1)) BH.kill(o); await BH.gw(0.4); msMechEnd(m, st); });
  T('gauntlet', async (m, st, p, BH) => { for (let k = 0; k < 30 && !st.done; k++) { for (const o of st.cur) BH.kill(o); await BH.gw(0.4); } });
  T('arena', async (m, st, p, BH) => { if (p.dur) st.t = Math.max(st.t, p.dur - 0.1); else msMechEnd(m, st); await BH.gw(0.3); });
  T('protect', async (m, st, p, BH) => { for (const e of [...ents]) if (e.team === 'e' && e !== m && e !== st.obj && !e.dead && !(e.def_ && e.def_.msObj)) BH.kill(e); if (p.escort && st.obj) st.obj.x = p.escort.to === 'boss' ? m.x : msRoomW() - 100; await BH.gw(0.4); if (!st.done) msMechEnd(m, st); });
  T('facing', async (m, st, p, BH) => { const pl = game.player, iv = setInterval(() => { const s = Math.sign(m.x - pl.x) || 1; pl.face = p.mode === 'away' ? -s : s; }, 16); try { await BH.gw(Math.max(0, p.windup - st.t) + 0.3); } finally { clearInterval(iv); } });
}
// 领主血条下面的机制提示（包一层 HUD.drawTarget，不改 ui/hud.js）
function msBar(c, x, y, w, k, col, label) {
  c.fillStyle = 'rgba(10,8,12,.8)'; c.fillRect(x - 2, y + 2, w + 4, 12); c.fillStyle = '#2a2024'; c.fillRect(x, y + 4, w, 8);
  c.fillStyle = col; c.fillRect(x, y + 4, w * clamp(k, 0, 1), 8); uiText(label, x - 8, y + 14, { size: 13, align: 'right', color: col, sw: 3 });
}
// 目标血条在 ui.drawTarget（ui/hud.js）；以前包的是 HUD（底栏布局常量，没有 drawTarget），机制提示一直没画出来（2026-09-30 修）
if (typeof ui !== 'undefined' && ui.drawTarget) {
  const base = ui.drawTarget;
  ui.drawTarget = function (c) {
    base.call(this, c);
    const t = game.lastTarget; if (!t || t.dead || !t.boss || game.t - (game.lastTargetT || 0) > 6) return;
    let y = 84;
    if (t.msMechs) for (const st of t.msMechs) { const M = BOSS_MECHS[st.id]; if (!st.done && M.hud) y += M.hud(c, t, st, 560, y, 800); }
    const H = t.def_.hook && REGION_HOOKS[t.def_.hook]; if (H && H.hud) H.hud(c, t, 560, y);
    msGroupBars(c, t, y + 4);
  };
}
// 多领主同场（duo / gauntlet）：当前目标之外的领主各画一条小血条
function msGroupBars(c, t, y) {
  const G = ents.filter(e => e.boss && e !== t && !e.dead && !e.remove && e.team === 'e' && !e.abyssLord); if (!G.length) return;
  for (const e of G.slice(0, 4)) {
    const k = clamp(e.hp / e.hpMax, 0, 1), x = 1060, w = 300;
    c.fillStyle = 'rgba(10,8,12,.8)'; c.fillRect(x - 4, y + 2, w + 8, 18); c.fillStyle = '#300'; c.fillRect(x, y + 6, w, 10); c.fillStyle = '#e8a030'; c.fillRect(x, y + 6, w * k, 10);
    uiText(`${e.name} ${Math.ceil(k * 100)}%`, x - 10, y + 17, { size: 14, align: 'right', color: '#ffd8a0', sw: 3 }); y += 22;
  }
}
// 组队 / 测试用的预警登记：所有 telegraph 记进 MS_EVENTS；自己画的预警（扇形、分道、标记……）写 g.draw，地面层照常排序，默认的圆形法阵不画（r 用 0，真实半径在 g.R）
{
  const tg0 = telegraph;
  telegraph = function (o) { const g = tg0(o); msLog('tele', null, { k: g.kind, r: Math.round(g.R || g.r), src: msNetSrc || undefined }); return g; };
  const dg0 = drawGroundFx;
  drawGroundFx = function (c) { dg0(c); for (const g of groundFx) if (g.draw) { try { g.draw(c, g); } catch (e) { frameErr('ground:' + (g.kind || '?'), e); } } };
  const hu0 = game.onPlayerHurt;
  game.onPlayerHurt = function (p, dmg, a) { msLog('hurt', a && a.team === 'e' ? a : null, { dmg: Math.round(dmg), src: msNetSrc || undefined, me: p === msSelf() ? 1 : 0 }); return hu0.call(this, p, dmg, a); };
}
// 机制用的场景物件（水晶 / 柱子）：没有动作表，程序画一块发光的水晶
class MsCrystalModel {
  constructor(col, h) { this.col = col; this.h = h; this.skel = { map: {} }; }
  draw(c, pose, t = 0) {
    const h = this.h, w = h * 0.34, bob = Math.sin(t * 2.4) * 3;
    c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.25 + 0.1 * Math.sin(t * 4); c.fillStyle = this.col; c.beginPath(); c.ellipse(0, -h * 0.5 + bob, w * 1.5, h * 0.62, 0, 0, TAU); c.fill(); c.restore();
    c.save(); c.translate(0, bob); c.fillStyle = shade(this.col, -0.25, 1); c.strokeStyle = '#1a1030'; c.lineWidth = 3;
    c.beginPath(); c.moveTo(0, -h); c.lineTo(w, -h * 0.55); c.lineTo(w * 0.55, -h * 0.08); c.lineTo(-w * 0.55, -h * 0.08); c.lineTo(-w, -h * 0.55); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = shade(this.col, 0.35, 0.9); c.beginPath(); c.moveTo(0, -h * 0.95); c.lineTo(w * 0.35, -h * 0.55); c.lineTo(0, -h * 0.18); c.lineTo(-w * 0.2, -h * 0.55); c.closePath(); c.fill();
    c.restore();
  }
}
Object.assign(MON, {
  msCrystal: { name: '封印水晶', lvl: 30, hp: 1000, atk: 1, def: 300, w: 16, d: 12, h: 92, weight: 99, speed: 0, exp: 0, gold: [0, 0], shadowR: 16, pref: 0, clips: BEAST_CLIPS, noGrab: true, attacks: [], msObj: true,
    model: () => new MsCrystalModel('#b890ff', 92), onSpawn: msOnSpawn },
});
