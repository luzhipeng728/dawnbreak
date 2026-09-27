/* =====================================================================
   14. 怪物：数据 + AI
   AI：接近 → 进入攻击距离且冷却好 → 出手（有明显前摇）；同时出手的怪物数量有上限，避免围殴
   ===================================================================== */
POSE.throwW = P(POSE.idle, { torso: 10, head: -4, uaF: 160, faF: 60, uaB: 40, faB: 30, thF: 25, shF: -20, thB: -20, shB: -15 });
POSE.throwS = P(POSE.idle, { torso: -25, head: 12, uaF: 60, faF: 0, uaB: -40, faB: 30, thF: 40, shF: -30, thB: -30, shB: -10 });
POSE.gobW = P(POSE.a3w, { torso: 12, head: -6 });
POSE.gobS = P(POSE.a3s, { torso: -30 });
const GOB_CLIPS = { ...HUMAN_CLIPS,
  club: { dur: 0.95, fps: 16, keys: [k(0, POSE.idle), k(0.12, POSE.gobW, 'hold'), k(0.42, POSE.gobS, 'out'), k(0.6, POSE.gobS), k(0.95, POSE.idle)] },
  throw: { dur: 0.9, fps: 16, keys: [k(0, POSE.idle), k(0.12, POSE.throwW, 'hold'), k(0.45, POSE.throwS, 'out'), k(0.9, POSE.idle)] },
};
const MON = {
  goblin: { name: '哥布林', lvl: 1, hp: 2600, atk: 190, def: 120, w: 11, d: 11, h: 72, weight: 0.8, speed: 95, exp: 28, gold: [6, 18], shadowR: 15,
    model: () => buildGoblin(), clips: GOB_CLIPS, pref: 40,
    attacks: [{ clip: 'club', range: [0, 58], dy: 16, cd: [1.6, 2.8], act: { dur: 0.95, hits: [{ t0: 0.44, t1: 0.52, box: [0, 58, 20, 0, 70], dmg: 1, stun: 0.4, knock: 120, hs: 0.07, snd: 'blunt', shake: 2 }], events: [evAt(0.4, e => sfx.swing(true))] } }] },
  goblinThrower: { name: '哥布林投石手', lvl: 2, hp: 2000, atk: 160, def: 80, w: 11, d: 11, h: 72, weight: 0.8, speed: 80, exp: 32, gold: [8, 20], shadowR: 15,
    model: () => buildGoblin({ ...PAL_GOB, skin: '#8aa84a', skin2: '#6a8434', band: '#3a7ac8' }, 'none'), clips: GOB_CLIPS, pref: 190,
    attacks: [{ clip: 'throw', range: [110, 320], dy: 40, cd: [2.2, 3.4], act: { dur: 0.9, events: [evAt(0.45, e => throwRock(e))] } }] },
};
function throwRock(e) {
  const p = game.player; if (!p) return;
  const dist = Math.abs(p.x - e.x), T = clamp(dist / 260, 0.5, 1.1);
  sfx.swing(false);
  spawnProj({ owner: e, x: e.x + e.face * 12, y: e.y, z: 60, vx: (p.x - e.x) / T, vy: (p.y - e.y) / T, vz: 240, grav: (60 + 240 * T) * 2 / (T * T), life: 3, w: 8, d: 10, h: 12, face: e.face, shadow: 6, pierce: false,
    hit: { dmg: 0.9, stun: 0.35, knock: 80, hs: 0.05, snd: 'blunt' }, spin: 0,
    update(pr, dt) { pr.spin += dt * 12; },
    onEnd(pr) { fxDust(pr.x, pr.y, 3, 5, '#9a8a70'); },
    draw(c, pr) { drawSpr(c, 'rock', sx(pr.x), sy(pr.y, pr.z), 18, 18, { add: false, rot: pr.spin }); } });
}
const MON_ATK_MUL = 0.72;   // 2026-09-27 降低难度
function spawnMonster(kind, x, y, o = {}) {
  const D = MON[kind], lv = (o.lvl || D.lvl) + (D.coward ? 8 : 0), mul = o.mul || 1;
  const m = new Ent({ team: 'e', kind, name: D.name, model: D.model(), clips: D.clips, x, y, w: D.w, d: D.d, h: D.h, weight: D.weight,
    hp: Math.round(D.hp * mul * (1 + (lv - 1) * 0.15)), atk: Math.round(D.atk * (1 + (lv - 1) * 0.1) * (o.atkMul || 1) * MON_ATK_MUL), def: D.def * (1 + (lv - 1) * 0.08), lvl: lv,
    speed: D.speed, shadowR: D.shadowR, exp: Math.round(D.exp * (1 + (lv - 1) * 0.4) * (o.expMul || 1)), gold: D.gold, def_: D, face: -1, crit: 0.03,
    aiCd: rnd(0.6, 1.4), think: 0, boss: !!o.boss, elite: !!o.elite, scale: o.scale || D.scale || 1, bars: D.bars, onDamaged: D.onDamaged,
    acd: D.attacks.map(A => A.cd[0] >= 5 ? rnd(A.cd[0] * 0.4, A.cd[0]) : 0) });
  if (o.elite) { m.hp = m.hpMax = Math.round(m.hp * 3); m.atk *= 1.3; m.name = '精英 ' + m.name; m.scale *= 1.12; }
  m.hpMax = m.hp;
  m.control = monsterAI;
  // 出场：闪烁落地
  m.invul = 0.4; m.z = o.drop ? 160 : 0; m.vz = o.drop ? -50 : 0; if (o.drop) m.setState('jump');
  ents.push(m);
  return m;
}
function monsterAI(m, dt) {
  const p = game.player;
  if (m.dead || !p) return;
  if (m.st === 'jump') return;
  m.aiCd -= dt; m.think -= dt;
  for (let i = 0; i < m.acd.length; i++) m.acd[i] -= dt;
  if (m.busy) return;
  const D = m.def_, dx = p.x - m.x, dy = p.y - m.y, adx = Math.abs(dx), ady = Math.abs(dy);
  if (p.dead) { m.setState('idle'); m.vx = m.vy = 0; return; }
  const spd = m.speed * (m.status && m.status.slow ? 0.5 : 1);
  if (D.coward) { cowardAI(m, dt, dx, spd); return; }
  m.face = dx >= 0 ? 1 : -1;
  // 领主残血狂暴：出手更频繁
  if (m.boss && !m.enraged && m.hp < m.hpMax * 0.3) { m.enraged = true; fxText('狂暴！', m.x, m.y, m.z + 40, { col: '#ff3a2a', size: 16, dur: 1.2 }); sfx.boom(0.6); m.speed *= 1.2; }
  const rage = m.enraged ? 0.85 : 1;
  // ---- 出手：在距离内、冷却好、满足条件的招式里按权重随机 ----
  if (m.aiCd <= 0 && p.st !== 'down') {
    const ok = D.attacks.filter((A, i) => adx >= A.range[0] && adx <= A.range[1] && ady <= A.dy && m.acd[i] <= 0 && (!A.cond || A.cond(m)));
    const attacking = ok.length && !m.boss ? ents.filter(e => e.team === 'e' && e.st === 'act' && !e.dead).length : 0;
    if (ok.length && (m.boss || attacking < (game.maxAttackers || 3))) {
      let r = rnd(0, ok.reduce((s, A) => s + (A.w || 1), 0)), A = ok[ok.length - 1];
      for (const x of ok) { r -= x.w || 1; if (r <= 0) { A = x; break; } }
      if (D.attacks.length > 1) { m.acd[D.attacks.indexOf(A)] = rnd(A.cd[0], A.cd[1]) * rage; m.aiCd = (m.boss ? rnd(1.2, 2.2) : rnd(0.7, 1.6)) * rage; }
      else m.aiCd = rnd(A.cd[0], A.cd[1]) * rage;
      const events = (A.act.events || []).map(ev => ({ ...ev, done: false }));
      m.doAct({ name: A.clip, clip: A.clip, ...A.act, events, hits: A.act.hits && A.act.hits.map(h => ({ ...h })) });
      if (m.boss || m.elite || A.act.superArmor) warnMark(m, A.act.superArmor ? '#ff3a2a' : '#ffc02a');
      m.vx = m.vy = 0;
      return;
    }
  }
  // ---- 走位：朝首选距离靠近，并对齐纵深；偶尔横向游走 ----
  if (m.think <= 0) {
    m.think = rnd(0.35, 0.9);
    const want = D.pref + rnd(-10, 20);
    m.goalX = p.x - Math.sign(dx || 1) * want + rnd(-15, 15);
    m.goalY = clamp(p.y + (Math.random() < 0.25 ? rnd(-40, 40) : 0), 8, DEPTH - 8);
    if (Math.random() < 0.15) { m.goalX = m.x + rnd(-60, 60); }
    const R = game.room; if (R) m.goalX = clamp(m.goalX, R.x0 + 30, R.x1 - 30);
  }
  const gx = m.goalX - m.x, gy = m.goalY - m.y;
  if (Math.abs(gx) > 6 || Math.abs(gy) > 5) {
    const l = Math.hypot(gx, gy * 1.4);
    m.vx = gx / l * spd; m.vy = gy / l * spd * 0.8;
    m.setState('walk');
  } else { m.vx = m.vy = 0; m.setState('idle'); }
}
// 胆小哥布林（原作机制）：进房时等级很高、只会逃跑；场上每死一只别的怪它就掉 1 级（血量防御随之下降），经验仍按进房时的等级结算
function cowardAI(m, dt, dx, spd) {
  const R = game.room;
  if (m.think <= 0 || Math.abs(m.goalX - m.x) < 10) {
    m.think = rnd(0.5, 1);
    const away = -Math.sign(dx || 1), wall = away > 0 ? R.x1 - m.x : m.x - R.x0;
    // 被逼到墙角就从玩家身边绕过去
    if (wall < 90) { m.goalX = m.x - away * 420; m.goalY = game.player.y < DEPTH / 2 ? DEPTH - 12 : 12; }
    else { m.goalX = m.x + away * 260; m.goalY = clamp(m.y + rnd(-60, 60), 10, DEPTH - 10); }
  }
  const gx = m.goalX - m.x, gy = m.goalY - m.y, l = Math.hypot(gx, gy) || 1;
  m.vx = gx / l * spd * 1.3; m.vy = gy / l * spd; m.face = m.vx >= 0 ? 1 : -1;
  m.setState('run');
  if (Math.random() < dt * 0.5) fxText(pick(['呀！', '别过来！', '饶命！']), m.x, m.y, m.z, { col: '#ffe070', size: 9 });
}
function cowardDrop(m) {
  if (m.lvl <= 1) return;
  const D = m.def_, f = m.hp / m.hpMax, k = (1 + (m.lvl - 2) * 0.15) / (1 + (m.lvl - 1) * 0.15);
  m.lvl--; m.hpMax = Math.round(m.hpMax * k); m.hp = Math.max(1, Math.round(m.hpMax * f)); m.def = D.def * (1 + (m.lvl - 1) * 0.08);
  fxText(`Lv.${m.lvl}`, m.x, m.y, m.z, { col: '#c8c8c8', size: 11 });
}
// 出招预警：头顶弹出一个 “!”（红色 = 霸体重招，黄色 = 普通招式）
function warnMark(m, col) {
  const top = m.h * (m.scale || 1) + 12;
  addFx({ x: m.x, y: m.y + 3, z: m.z, dur: 0.5, col, ent: m, draw(c) {
    const e = this.ent, k = this.t / this.dur, pop = k < 0.2 ? 0.6 + k / 0.2 * 0.6 : 1.2 - (k - 0.2) * 0.3, X = sx(e.x), Y = sy(e.y, e.z + top) - Math.sin(k * Math.PI) * 4;
    c.save(); c.globalAlpha = k > 0.8 ? (1 - k) / 0.2 : 1; c.font = `900 ${Math.round(22 * pop)}px "Arial Black",sans-serif`; c.textAlign = 'center';
    c.lineWidth = 5; c.strokeStyle = '#1a0806'; c.strokeText('!', X, Y); c.fillStyle = this.col; c.fillText('!', X, Y); c.restore();
  } });
}
