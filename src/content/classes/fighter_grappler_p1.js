/* =====================================================================
   柔道家（grappler）P1：一觉 风林火山（力之奥义 / 死亡旋律 / 彗星冲击 / 武莲华）→ 二觉 宗师（傲天之怒 / 黑震旋风 / 疾风闪电 / 一字传承·极义震天破）
   → 三觉 归元·柔道家（神怡气静 / 黑震流·殒灭 / 黑震流·山岳崩颓）。通用构件（fgAct / fgGrabHB / fgCannon / fgWave …）在 fighter_grappler.js
   ===================================================================== */
// 房间里“最强”的敌人：领主 > 精英 > 最大 HP（锁定最强敌人：二觉 / 三觉 / 殒灭的冲撞）
function fgStrongest(e, range, filter) {
  let best = null, bs = -1;
  for (const t of ents) {
    if (!foe(e, t) || t.invul > 0 || Math.abs(t.x - e.x) > range || Math.abs(t.y - e.y) > range * 0.6 || (filter && !filter(t))) continue;
    const s = (t.boss ? 3e9 : 0) + (t.elite ? 1e9 : 0) + (t.hpMax || 0); if (s > bs) { bs = s; best = t; }
  }
  return best;
}
// 瞬间贴到目标身前（留残影）
function fgBlink(e, t, gap = 44) {
  fxAfterimage(e, '#ffd070'); const R = game.room, side = Math.sign(e.x - t.x) || -e.face;
  e.x = R ? clamp(t.x + side * gap, R.x0 + e.w, R.x1 - e.w) : t.x + side * gap; e.y = t.y; e.face = Math.sign(t.x - e.x) || e.face;
  fxStreak({ x: e.x - e.face * 60, y: e.y, z: e.z + 50, face: e.face, len: 90, w: 10, col: '#ffe0a0', dur: 0.15 });
}
// 岩块投射物（一字传承的踢岩块、殒灭的碎片）
function fgRockProj(e, o) {
  const img = fxTint('rock', o.col || '#8a7a66');
  return spawnProj({ owner: e, x: e.x + e.face * (o.dx ?? 30), y: e.y + (o.dy || 0), z: o.z ?? 40, vx: e.face * (o.speed ?? 700), vy: o.vy || 0, vz: o.vz || 0, grav: o.grav || 0, face: e.face, life: o.life ?? 0.6,
    w: o.bw ?? 18, d: o.bd ?? 22, h: o.bh ?? 40, pierce: true, hit: { knock: 60, stun: 0.3, hs: 0.03, snd: 'blunt', col: '#e0c8a0', ...o.hit }, onHitT: o.onHitT, mul: o.mul,
    draw(c, pr) { drawSpr(c, img, sx(pr.x), sy(pr.y, pr.z + 10), o.size ?? 30, 0, { rot: pr.t * 14 * pr.face, add: false });
      if (Math.random() < 0.3) fxDust(pr.x - pr.face * 10, pr.y, 1, 4, FG_COL.dust); } });
}
// 地面变成沸腾的火山（三觉）：一片发光的熔岩地面 + 冒泡
function fgLavaField(x, y, r, dur) {
  const img = IMG['fx/lava'];
  addFx({ x, y: y - 30, z: 0, dur, draw(c) {
    const k = this.t / this.dur, a = (k < 0.1 ? k / 0.1 : k > 0.85 ? (1 - k) / 0.15 : 1), X = sx(this.x), Y = sy(y, 0);
    c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.45 * a * FX_DIM;
    const g = c.createRadialGradient(X, Y, 4, X, Y, r); g.addColorStop(0, '#ffb040'); g.addColorStop(0.6, '#ff5a1a'); g.addColorStop(1, 'rgba(120,20,0,0)');
    c.fillStyle = g; c.beginPath(); c.ellipse(X, Y, r, r * 0.3, 0, 0, TAU); c.fill(); c.restore();
    if (img && Math.random() < 0.35) fxSpr('lava', x + rnd(-r, r) * 0.8, y + rnd(-18, 18), 0, { w: rnd(40, 70), dur: 0.5, ay: 1, grow: [0.3, 1], alpha: a });
  } });
}

/* ================= 一觉：风林火山 ================= */
defSkill('fg_counter', { name: '力之奥义', cls: 'fighter', job: GJ, tier: 1, lvReq: 21, maxLv: 10, passive: true, type: 'phys', col: '#e04a4a',
  desc: '【被动】普攻和抓取技能的攻击力提高；在敌人出招时抓住它（破招抓取），额外造成 30% 的破招伤害。',
  infoExtra: lv => [['普攻 / 抓取攻击力', '+' + pct(0.04 + 0.01 * lv)], ['破招抓取追加伤害', '30%']] });
FIGHTER_HOOKS.onHit.push((p, t, h, dmg) => {   // 破招抓取：抓取判定打中出招中的敌人 → 追加 30%
  if (!h.grab || !fgIs(p) || !hasSkill(p, 'fg_counter') || t.dead || !isCounter(t)) return;
  const x = Math.max(1, Math.round(dmg * 0.3)); t.hp -= x; addNumber(x, t.x, t.y, t.z + 14, { col: '#ff6a3a' });
  fxText('破招抓取', t.x, t.y, t.z + t.h + 16, { col: '#ff6a3a', size: 11, dur: 0.6 });
});

// 死亡旋律（一觉）：挥臂起风把范围内的敌人吸过来抓住 → 7 连击（连按 X 加快，按 C 直接终结）→ 第 4 下（终结）挑起一起跳起，下踢砸地出冲击波
const FG_AWK_RK = lv => [1, 1.18, 1.35][clamp(lv, 1, 3) - 1];
function fgAwkFin(e, G, a) {   // 终结：挑起 + 下踢砸地 + 大冲击波（二觉预约时一次打完）
  const P = a.P, m = a.dmgMul || 1, x = e.x + e.face * 40;
  for (const t of [...G, ...(a.strike || [])]) if (!t.dead) fgHitT(e, t, { dmg: P * 0.42, spike: 600, down: true, bounce: 0.3, throwHit: true, hs: 0.1, big: 2, shake: 6, col: FG_COL.fire }, m);
  fgBoom(x, e.y, 260 * (a.rk || 1), FG_COL.fire, 14);
  fgWave(e, x, e.y, 220 * (a.rk || 1), { dmg: P * 0.3, launch: 380, knock: 200 }, { mul: m, col: FG_COL.fire, bcol: FG_COL.fire, shake: 12, boom: 1 });
}
defSkill('fg_awaken', { name: '死亡旋律', cls: 'fighter', job: GJ, lvReq: 21, maxLv: 3, mp: 150, cd: 135, pvp: 0.45, type: 'phys', awaken: true, grab: true, air: true, shotSpan: 3.2, col: '#ff8a3a',
  desc: '【觉醒】挥臂卷起狂风，把周围的敌人吸过来抓住（抓取 / 打击范围随技能等级扩大到 135%），“1 段弱！2 段中！3 段强！”连打 7 下（连按 X 加快，按 C 直接进入终结），第 4 段把敌人挑起、一起跳到空中，猛力下踢砸向地面，产生巨大的冲击波。领主 / 不可抓取的敌人不会被抓，但照样吃到全部打击。空中施放：直接下踢砸地（不抓人）。全程无敌。施放中可以预约一字传承·极义震天破。',
  pow: lv => skillDmg(22, 6, lv), ai: { kind: 'awaken', r: [0, 240], dy: 90 },
  infoExtra: lv => [['吸引 / 打击范围', pct(FG_AWK_RK(lv))], ['连击', '7 下']],
  act: (lv, p) => {
    const P = skillDmg(22, 6, lv), rk = FG_AWK_RK(lv), air = p.st === 'jump' || p.z > 2, R = 250 * rk;
    return fgAct({ name: 'fg_awaken', clip: air ? 'fgDive' : 'fgFocus', dur: air ? 2.4 : 4, superArmor: true, invul: true, noCounter: true, P, rk,
      onStart: e => { game.cutin = { t: 0, dur: 1.0, name: '死亡旋律', who: cutinWho(e) }; game.timeStop = 0.8; sfx.awaken(); const a = e.act; a.cx = e.x + e.face * 60;
        if (air) { e.vz = 260; e.vx = e.face * 60; return; }
        fgWind(a.cx, e.y, 190 * rk, 0.5, FG_COL.wind); fgSpr('vortex', a.cx, e.y, 60, { w: 220 * rk, dur: 0.5, col: '#e0f0ff', spin: -10, grow: [1.2, 0.5] }); },
      onInput: (e, I) => { const a = e.act; if (a.stage !== 'hits') return false;
        if (I.buffered('attack')) { while (I.consume('attack')); a.mash = game.t; }
        if (I.buffered('jump')) { while (I.consume('jump')); a.skip = true; return true; }
        return false; },
      update: (e, dt) => { const a = e.act;
        if (air) { if (!a.dive && e.actT > 0.18) { a.dive = true; e.vz = -1300; } return; }
        if (!a.stage && e.actT < 0.4) { for (const t of ents) if (foe(e, t) && !t.dead && !t.boss && !t.noGrab && t.weight <= 2.2 && t.st !== 'held' && Math.hypot(t.x - a.cx, (t.y - e.y) * 2) < R) { t.x += (a.cx - t.x) * Math.min(1, dt * 7); t.y += (e.y - t.y) * Math.min(1, dt * 5); } return; }
        if (!a.stage) {   // 抓住吸过来的（最多 8 个），抓不了的记为打击目标
          a.stage = 'hits'; a.n = 0; a.nt = e.actT + 0.05; a.strike = []; const h = { grabInvul: true, grabMax: 8, grabDown: true };
          for (const t of ents) { if (!foe(e, t) || t.invul > 0 || Math.hypot(t.x - a.cx, (t.y - e.y) * 2) > R * 0.75) continue; if (grabsOf(e).length < 8 && canGrab(e, t, h)) startGrab(e, t, h); else if (t.z < 90) a.strike.push(t); }
          a.dur = e.actT + 4; e.play('fgKnee', true); return; }
        if (a.stage === 'hits') {
          if (a.skip || a.n >= 7) { a.stage = 'lift'; a.lt = e.actT; e.play('fgHigh', true); sfx.swing(true);
            for (const t of [...grabsOf(e), ...a.strike]) applyHit(e, t, { dmg: P * 0.22 * (a.skip ? 1 + (7 - a.n) * 0.04 / 0.22 : 1), sure: true, noCounterBonus: true, hs: 0.08, big: 1.8, snd: 'blunt', col: FG_COL.fire });
            e.vz = 640; e.z = 1; return; }
          if (e.actT >= a.nt) { a.n++; a.nt = e.actT + (game.t - (a.mash || -9) < 0.25 ? 0.08 : 0.13); e.play(a.n % 2 ? 'fgPalm' : 'fgKnee', true); sfx.hit('blunt', a.n % 3 === 0);
            if (a.n <= 3) fxText(['1 段 弱！', '2 段 中！', '3 段 强！'][a.n - 1], e.x, e.y, e.z + 120, { col: '#ffe070', size: 12 + a.n * 2, dur: 0.5 });
            for (const t of [...grabsOf(e), ...a.strike]) { applyHit(e, t, { dmg: P * 0.04, sure: true, noCounterBonus: true, stun: 0.3, knock: 0, hs: 0.05, big: 1.2 + a.n * 0.05, snd: 'blunt', col: FG_COL.hit }); fxHit(t.x, t.y, t.z + 50, e.face, { col: FG_COL.fire, big: 1.3 }); } }
          return; }
        if (a.stage === 'lift' && e.vz < 40 && !a.dive) { a.dive = true; e.vz = -1400; e.play('fgAxe', true); fxSlash({ x: e.x, y: e.y, z: e.z, face: e.face, col: '#ffcf8a', a0: -1.6, a1: 1.3, r: 90, w: 26, off: [16, 60], heavy: true }); } },
      hold: (e, t, i) => { const a = e.act; if (a.stage === 'lift') fgHoldAt(e, t, i, 30, e.z + 30); else fgHoldAt(e, t, i, 36, 8); },
      onLand: e => { const a = e.act; e.vx = 0;
        if (air) { a.onLand = null; a.fgFinDone = true; const x = e.x + e.face * 30;
          fgBoom(x, e.y, 280 * rk, FG_COL.fire, 14); fgWave(e, x, e.y, 240 * rk, { dmg: P * 0.95, launch: 420, knock: 220 }, { col: FG_COL.fire, bcol: FG_COL.fire, shake: 12, boom: 1 }); a.dur = e.actT + 0.6; e.play('fgStomp', true); return; }
        if (a.stage !== 'lift' || !a.dive) { e.vz = 0; return; }
        a.onLand = null; a.fgFinDone = true; const G = grabsOf(e).slice(); dropGrab(e); fgAwkFin(e, G, a); e.play('fgStomp', true); a.dur = e.actT + 0.6; },
      fgFin: fgAwkFin });
  } });

// 彗星冲击：蓄力（最多 0.4 秒，只加距离）→ 高速飞踢长距离突进，把路上的敌人全部拖着走，最后击飞
defSkill('fg_pierce', { name: '彗星冲击', cls: 'fighter', job: GJ, tier: 1, lvReq: 23, mp: 70, cd: 25, type: 'phys', col: '#8ad0ff',
  desc: '蓄力（按住技能键，最多 0.4 秒，蓄得越久冲得越远）后化作彗星高速飞踢，长距离突进，把路上的敌人全部拖着走，冲到尽头把他们踢飞。学会连环抓取后，命中后可以取消接柔道家的抓取技能（野蛮冲撞和空中技能除外）；没打中也可以取消接旋风腿。',
  pow: lv => skillDmg(10, 1.0, lv), ai: { kind: 'gap', r: [0, 420], dy: 30 },
  infoExtra: () => [['突进距离', '300～620 px（按蓄力）']],
  act: (lv, p) => {
    const P = skillDmg(10, 1.0, lv), chain = hasSkill(p, 'fg_combo'), SPD = 1150;
    const dragOk = (a, t) => !t.boss && !t.noGrab && t.weight <= 2.2 && !t.dead;
    return { name: 'fg_pierce', clip: 'fgFlyKick', dur: 1.2, noCounter: true,
      charge: { at: 0.02, max: 0.4, min: 0, dmg: 0, clip: 'fgCrouch', update: (e, dt, k) => { if (Math.random() < 0.5) fxCharge(e, '#bfe4ff'); },
        onRelease: (e, k) => { const a = e.act, dist = 300 + 320 * k; a.x0 = e.x; a.dist = dist; a.dashT = e.actT; a.move = [[e.actT, e.actT + dist / SPD, SPD]]; a.dur = e.actT + dist / SPD + 0.4; e.play('fgFlyKick', true); sfx.swing(true);
          fxStreak({ x: e.x - e.face * 40, y: e.y, z: e.z + 50, face: e.face, len: 160, w: 22, col: '#dff2ff', dur: 0.3 }); } },
      hits: [HB(0.03, 1.2, [-10, 66, 40, 0, 115], P * 0.3, { stun: 0.6, knock: 0, hs: 0.03, big: 1.4, snd: 'blunt', col: '#dff2ff', onHit: (a, t) => { const A = a.act; if (A && A.name === 'fg_pierce' && dragOk(a, t) && !(A.drag || (A.drag = [])).includes(t)) A.drag.push(t); } })],
      update: e => { const a = e.act; if (a.dashT === undefined) return;
        const k = e.actT - a.dashT, T = a.dist / SPD;
        if (k < T) { if (Math.random() < 0.8) fxStreak({ x: e.x - e.face * 20, y: e.y + rnd(-6, 6), z: e.z + rnd(30, 80), face: e.face, len: rnd(60, 120), w: 6, col: '#dff2ff', dur: 0.12 }); if (Math.random() < 0.5) fxDust(e.x - e.face * 20, e.y, 2, 10);
          (a.drag || []).forEach((t, i) => { if (t.dead) return; t.x = e.x + e.face * (56 + i * 8); t.y += (e.y - t.y) * 0.3; t.z = 18; t.vx = t.vy = t.vz = 0; t.interrupt(); if (t.st !== 'hit') t.setState('hit'); t.stun = 0.3; }); }
        else if (!a.fin) { a.fin = true; e.vx = 0; const m = fgMul(e);   // 冲到尽头：把拖着的和身前的一起踢飞
          fxSpr('burst', e.x + e.face * 60, e.y, 60, { w: 200, dur: 0.35, col: '#dff2ff', grow: [0.4, 1.2] }); fxDust(e.x + e.face * 40, e.y, 14, 50); fgRocks(e.x + e.face * 40, e.y, 4, 60); cam.shake = Math.max(cam.shake, 6); sfx.boom(0.8);
          const done = new Set(); for (const t of a.drag || []) if (!t.dead) { done.add(t); t.z = Math.max(t.z, 2); fgHitT(e, t, { dmg: P * 0.7, launch: 560, knock: 260, hs: 0.1, big: 1.8, shake: 5, col: '#dff2ff' }, m); }
          const B = atkBox(e, { box: [-10, 110, 44, 0, 120] }); for (const t of ents) if (!done.has(t) && canHit(e, t, {}) && overlaps(B, t) && e.hitsDone.has(t.id * 100)) fgHitT(e, t, { dmg: P * 0.7, launch: 520, knock: 220, hs: 0.1, big: 1.8 }, m); } },
      links: chain ? FG_CHAIN.filter(id => id !== 'fg_tackle') : undefined, hitCancel: true, linkFrom: 0.1, onEnd: fgChainEnd };
  } });

// 武莲华：抓住一个敌人连打 12 下（连按 X 加快，按 C 直接终结）→ 摔在地上 → 跳起来用身体压下去（压地冲击波）；摔之前按方向键改摔的方向
defSkill('fg_fury', { name: '武莲华', cls: 'fighter', job: GJ, tier: 1, lvReq: 25, mp: 95, cd: 45, type: 'phys', grab: true, shotSpan: 2.8, col: '#e05a2a',
  desc: '抓住一个敌人连打 12 下（连按 X 加快，按 C 直接进入终结），把他摔在地上，再跳起来用身体狠狠压下去，压地产生冲击波。摔之前按 ← 可以往身后摔。抓住期间无敌；抓不住的敌人改成抓轰炮。冲刺中施放时滑行抓取。',
  pow: lv => skillDmg(14, 1.4, lv), ai: { kind: 'grab', r: [0, 100], dy: 30 },
  act: (lv, p) => {
    const P = skillDmg(14, 1.4, lv);
    return fgSlide(fgAct({ name: 'fg_fury', clip: 'fgGrab', dur: 0.7, noCounter: true, P,
      hits: [fgGrabHB(0.05, 0.2, [0, 102, 38, 0, 120], P * 0.12, P * 0.88)],
      onGrab: e => { const a = e.act; if (a.gT !== undefined) return; a.gT = e.actT; a.dur = e.actT + 4; a.n = 0; a.nt = e.actT + 0.12; },
      onInput: (e, I) => { const a = e.act; if (a.gT === undefined || a.thrown) return false;
        if (I.buffered('attack')) { while (I.consume('attack')); a.mash = game.t; }
        if (I.buffered('jump')) { while (I.consume('jump')); a.skip = true; return true; }
        return false; },
      hold: (e, t, i) => fgHoldAt(e, t, i, 34, 12),
      update: e => { const a = e.act; if (a.gT === undefined) return;
        if (!a.thrown && (a.n >= 12 || a.skip) && e.actT >= a.nt) {   // 摔
          a.thrown = true; const d = fgDir(e), dir = d === 'b' ? -e.face : e.face, G = grabsOf(e).slice(), m = fgMul(e), left = a.skip ? (12 - a.n) * 0.031 : 0;
          e.play('fgSlam', true); sfx.swing(true); a.tx = e.x + dir * 100;
          for (const t of G) throwArc(e, t, { dx: 100, dir, h: 50, dur: 0.3, other: false, hit: { dmg: P * (0.185 + left) * m, spike: 300, down: true, bounce: 0.2, shake: 4, big: 1.6 } });
          a.jt = e.actT + 0.32; return; }
        if (!a.thrown) { if (e.actT >= a.nt) { a.n++; a.nt = e.actT + (game.t - (a.mash || -9) < 0.25 ? 0.055 : 0.1); e.play(a.n % 2 ? 'fgPalm' : 'fgKick', true); sfx.hit('blunt', a.n % 4 === 0);
          for (const t of grabsOf(e)) { applyHit(e, t, { dmg: P * 0.031, sure: true, noCounterBonus: true, hs: 0.03, big: 1.1, snd: 'blunt' }); fxHit(t.x + rnd(-6, 6), t.y, t.z + rnd(30, 70), e.face, { col: FG_COL.fire, big: 1.1 }); } }
          return; }
        if (a.jt && e.actT >= a.jt && !a.jump) { a.jump = true; e.face = Math.sign(a.tx - e.x) || e.face; e.vz = 620; e.z = 1; e.vx = (a.tx - e.x) / 0.72; e.play('fgFlip', true); sfx.jump(); }
        if (a.jump && !a.press && e.vz < 0) { a.press = true; e.vz = -1200; e.play('fgPress', true); } },
      onLand: e => { const a = e.act; if (!a.jump) { e.vz = 0; return; } a.onLand = null; e.vx = 0; a.fgFinDone = true;
        fxSpr('explosion', a.tx, e.y, 20, { w: 170, dur: 0.45, col: '#a07050', grow: [0.4, 1] }); fgRocks(a.tx, e.y, 10, 120);
        fgWave(e, a.tx, e.y, 160, { dmg: P * 0.32, launch: 300 }, { col: FG_COL.fire, bcol: '#ffb070', shake: 9, boom: 0.9 }); e.play('fgStomp', true); a.dur = e.actT + 0.45; } }), p);
  } });

/* ================= 二觉：宗师 ================= */
defSkill('fg_strongest', { name: '傲天之怒', cls: 'fighter', job: GJ, tier: 2, lvReq: 26, maxLv: 10, passive: true, type: 'phys', col: '#c03a2a',
  desc: '【被动】基础 / 转职技能攻击力和物理暴击率提高；房间里有领主或精英时攻击力再提高（按最强的那只算，不叠加）。',
  infoExtra: lv => [['攻击力', '+' + pct(0.04 + 0.01 * lv)], ['物理暴击率', '+' + pct(0.02 + 0.003 * lv)], ['有领主 / 精英时', '+' + pct(0.03 + 0.006 * lv)]] });

// 黑震旋风：抓住敌人大幅抡转，背摔倒插进地里（插着的不能动），旋风每转一圈打一次（5 圈），最后地面爆炸把他们弹出来；暴力抓取时把周围的一起卷进来
defSkill('fg_blacktornado', { name: '黑震旋风', cls: 'fighter', job: GJ, tier: 2, lvReq: 26, mp: 90, cd: 40, type: 'phys', grab: true, shotSpan: 2.4, col: '#5a4a6a',
  desc: '抓住敌人大幅抡转，背摔把他倒插进地里（插着的敌人不能动），黑色旋风每转一圈造成一次伤害（共 5 圈），过一会儿地面爆炸把他们弹出来。暴力抓取时把周围的敌人一起卷进来抡。领主 / 不可抓取的敌人不会被插进地里，但照样吃到旋风和爆炸。抓住期间无敌；冲刺中施放时滑行抓取。',
  pow: lv => skillDmg(15, 1.5, lv), ai: { kind: 'grab', r: [0, 100], dy: 30 },
  act: (lv, p) => {
    const P = skillDmg(15, 1.5, lv), og = fgOG(p);
    const tgts = e => { const a = e.act; return [...grabsOf(e), ...(a.boss && !a.boss.dead ? [a.boss] : [])]; };
    return fgSlide(fgAct({ name: 'fg_blacktornado', clip: 'fgGrab', dur: 0.7, noCounter: true, superArmor: og ? [0, 0.4] : undefined, P,
      hits: [fgGrabHB(0.05, 0.2, [0, 104, 38, 0, 120], P * 0.02, 0, og ? { grabRange: FG_OG_RANGE } : {})],
      fgOnFail: (e, t) => { const a = e.act; if (a.gT !== undefined) return; a.gT = e.actT; a.boss = t; a.dur = e.actT + 2.1; e.play('fgSwing', true); },
      onGrab: e => { const a = e.act; if (a.gT !== undefined) return; a.gT = e.actT; a.dur = e.actT + 2.1; e.play('fgSwing', true); a.wind = fgWind(e.x, e.y, 110, 0.5, '#7a5a9a', { ent: e, alpha: 0.6 }); },
      hold: (e, t, i) => { const a = e.act, k = e.actT - (a.gT || 0);
        if (k < 0.5) { const th = k / 0.5 * TAU * 1.5 + i * 0.7; t.x = e.x + Math.cos(th) * 62 * e.face; t.y = clamp(e.y + Math.sin(th) * 16 + 0.5, 4, DEPTH - 4); t.z = 34 + Math.sin(th * 2) * 12; t.rot = th; t.face = -e.face; return; }
        t.x = a.px + e.face * (i ? (i % 2 ? 12 : -12) * Math.ceil(i / 2) : 0); t.y = clamp(e.y + (i % 2 ? 6 : -6) * Math.ceil(i / 2) + 0.5, 4, DEPTH - 4); t.z = 0; t.rot = Math.PI; t.face = -e.face; },   // 倒插在地里
      update: e => { const a = e.act; if (a.gT === undefined) return; const k = e.actT - a.gT, m = fgMul(e);
        if (k >= 0.5 && !a.plant) { a.plant = true; a.px = e.x + e.face * 56; e.play('fgSlam', true); sfx.boom(0.7); cam.shake = Math.max(cam.shake, 6);
          for (const t of tgts(e)) applyHit(e, t, { dmg: P * 0.2, sure: true, noCounterBonus: true, hs: 0.1, big: 1.8, snd: 'blunt', col: '#c8b8d8', stun: 0.8, knock: 0 });
          fxShock(a.px, e.y, 120, '#8a7a9a'); fxDust(a.px, e.y, 12, 40); fgRocks(a.px, e.y, 6, 70); a.tw = fgWind(a.px, e.y, 180, 1.0, '#7a5a9a'); }
        for (let n = 0; n < 5; n++) if (a.plant && k >= 0.62 + n * 0.17 && (a.spins || 0) <= n) { a.spins = n + 1; sfx.swing(n === 4);
          fgSpr('vortex', a.px, e.y, 50, { w: 150, dur: 0.2, col: '#7a5a9a', spin: -18 });
          for (const t of tgts(e)) applyHit(e, t, { dmg: P * 0.08, sure: true, noCounterBonus: true, hs: 0.04, big: 1.2, snd: 'blunt', col: '#c8b8d8', stun: 0.5, knock: 0 }); }
        if (k >= 1.55 && !a.boom) { a.boom = true; a.fgFinDone = true; const G = grabsOf(e).slice();   // 地面爆炸：弹出来
          for (const t of G) throwGrab(e, { dmg: 0.01, launch: 640, knock: 80, hs: 0.04 });
          fgBoom(a.px, e.y, 220, '#9a7ab0', 10);
          fgWave(e, a.px, e.y, 170, { dmg: P * 0.4, launch: 480, knock: 120 }, { mul: m, col: '#b8a0d0', bcol: '#ff9a4a', shake: 9, boom: 1 });
          if (a.boss && !a.boss.dead && !inGround(a.boss, a.px, e.y, 170 * fgWaveK(e))) fgHitT(e, a.boss, { dmg: P * 0.4, knock: 60 }, m); } } }), p);
  } });

// 疾风闪电：短距离快冲抓住敌人 → 连续抓范围内的其他敌人聚到一点（最多再抓 4 次）→ 次数用完 / 没有目标 / 再按技能键：踩着抓住的敌人跳起，终结砸地，冲击波打没抓到的
function fgStormFin(e, G, a) {
  const P = a.P, m = a.dmgMul || 1, x = a.gx ?? e.x + e.face * 40;
  for (const t of G) if (!t.dead) fgHitT(e, t, { dmg: P * 0.65, spike: 600, down: true, bounce: 0.35, throwHit: true, hs: 0.12, big: 2, shake: 8, col: FG_COL.fire }, m);
  if (a.boss && !a.boss.dead) fgHitT(e, a.boss, { dmg: P * 0.7, throwHit: true, knock: 60, stun: 0.6, hs: 0.1, big: 2 }, m);
  fgBoom(x, e.y, 230, FG_COL.fire, 10);
  const done = new Set([...G, a.boss]);
  for (const t of ents) if (!done.has(t) && foe(e, t) && t.invul <= 0 && t.z < 80 && inGround(t, x, e.y, 200 * fgWaveK(e))) fgHitT(e, t, { dmg: P * 0.4, launch: 420, knock: 200, radial: true, hs: 0.05, downHit: true }, m, { x, y: e.y, z: 0, face: e.face });
  fxShock(x, e.y, 200 * fgWaveK(e), FG_COL.fire);
}
defSkill('fg_stormdiver', { name: '疾风闪电', cls: 'fighter', job: GJ, tier: 2, lvReq: 26, mp: 100, cd: 45, type: 'phys', grab: true, shotSpan: 2.2, col: '#ffd24a',
  desc: '短距离快冲抓住敌人，接着闪身连续抓住附近（约 320 px 内）的其他敌人（最多再抓 4 次），全部聚到一点；次数用完或附近没有敌人时，踩着抓住的敌人高高跳起，再猛力砸下终结，冲击波打到没抓到的敌人。抓的途中再按一次技能键直接终结。领主 / 不可抓取的敌人：直接对它终结（伤害更高）。施放中可以预约一字传承·极义震天破。',
  pow: lv => skillDmg(16, 1.6, lv), ai: { kind: 'grab', r: [0, 200], dy: 34 },
  act: (lv, p) => {
    const P = skillDmg(16, 1.6, lv), H = { grabInvul: true, grabMax: 5 };
    const toFin = e => { const a = e.act; if (a.fin) return; a.fin = true; a.lt = e.actT; e.x = clamp(a.gx - e.face * 30, (game.room ? game.room.x0 : -1e9) + e.w, (game.room ? game.room.x1 : 1e9) - e.w); e.vz = 680; e.z = 1; e.vx = e.face * 30; e.play('fgFlip', true); sfx.jump(); };
    return fgAct({ name: 'fg_stormdiver', clip: 'fgShoulder', dur: 0.6, noCounter: true, P,
      move: [[0.02, 0.24, 900]],
      hits: [fgGrabHB(0.02, 0.26, [-6, 70, 40, 0, 120], P * 0.15, 0, { grabMax: 5 })],
      fgOnFail: (e, t) => { const a = e.act; if (a.gT !== undefined) return; a.gT = e.actT; a.boss = t; a.gx = t.x; a.move = null; e.vx = 0; a.dur = e.actT + 3; toFin(e); },
      onGrab: (e, t) => { const a = e.act; if (a.gT !== undefined) return; a.gT = e.actT; a.gx = e.x + e.face * 40; a.move = null; e.vx = 0; a.dur = e.actT + 3; a.moves = 0; a.nt = e.actT + 0.16; },
      onInput: (e, I) => { const a = e.act; if (a.gT === undefined || a.fin) return false; const slot = barOf(e).indexOf('fg_stormdiver');
        if ((slot >= 0 && I.buffered('s' + slot)) || I.buffered('cmd')) { if (slot >= 0) I.consume('s' + slot); I.consume('cmd'); toFin(e); return true; } return false; },
      hold: (e, t, i) => { const a = e.act; if (a.fin) { t.x = a.gx + (i ? (i % 2 ? 8 : -8) * Math.ceil(i / 2) : 0); t.y = clamp(e.y + (i % 2 ? 5 : -5) * Math.ceil(i / 2) + 0.5, 4, DEPTH - 4); t.z = Math.max(0, 6 + i * 4); t.face = -e.face; t.rot = 0; return; }
        const k = clamp((e.actT - (t._fgSdT ?? a.gT)) / 0.14, 0, 1); t.x += (a.gx + e.face * (i ? (i % 2 ? 10 : -10) * Math.ceil(i / 2) : 0) - t.x) * k; t.y += (e.y - t.y) * k * 0.5; t.z = 10 + i * 6; t.face = -e.face; },
      update: e => { const a = e.act; if (a.gT === undefined) return;
        if (!a.fin && e.actT >= a.nt) {   // 下一个：闪身过去抓住，拉回聚集点
          a.nt = e.actT + 0.2;
          const n = a.moves < 4 ? fgStrongest(e, 320, t => !t.heldBy && canGrab(e, t, H) && t.st !== 'dead') : null;
          if (!n) { toFin(e); return; }
          a.moves++; fgBlink(e, n, 36); e.play('fgGrab', true); n._fgSdT = e.actT; startGrab(e, n, H);
          if (n.heldBy === e) applyHit(e, n, { dmg: P * 0.15, sure: true, noCounterBonus: true, hs: 0.05, big: 1.3, snd: 'blunt', col: '#fff0a0' });
          game.after(0.1, () => { if (e.act === a && !a.fin) { fxAfterimage(e, '#ffd070'); e.x = clamp(a.gx - e.face * 36, (game.room ? game.room.x0 : -1e9) + e.w, (game.room ? game.room.x1 : 1e9) - e.w); } }); }
        if (a.fin && !a.dive && e.vz < 60) { a.dive = true; e.vz = -1400; e.play('fgPress', true);
          for (const t of grabsOf(e)) applyHit(e, t, { dmg: P * 0.2, sure: true, noCounterBonus: true, hs: 0.05, big: 1.4, snd: 'blunt' }); } },
      onLand: e => { const a = e.act; if (!a.dive) { e.vz = 0; return; } a.onLand = null; e.vx = 0; a.fgFinDone = true; const G = grabsOf(e).slice(); dropGrab(e); fgStormFin(e, G, a); e.play('fgStomp', true); a.dur = e.actT + 0.5; },
      fgFin: (e, G, a) => { if (a.boss) a.gx = a.gx ?? a.boss.x; fgStormFin(e, G, a); } });
  } });

// 一字传承·极义震天破（二觉）：震地冲击波束缚敌人 → 连踢岩块 → 抓住最强的敌人抛起背摔（抛不了 / 预约接上时：向下刺击收尾）→ 终结冲击波
function fgQtFinish(e, a, t) {
  const P = a.P, m = a.dmgMul || 1, x = t && !t.dead ? t.x : e.x + e.face * 60;
  if (t && !t.dead) fgHitT(e, t, { dmg: P * 0.2, spike: 700, down: true, throwHit: true, bounce: 0.3, hs: 0.14, big: 2.2, shake: 10, col: FG_COL.fire }, m);
  fgBoom(x, e.y, 300, FG_COL.fire, 16); fxSpr('pillar', x, e.y, 0, { h: 260, dur: 0.5, ay: 1, col: '#ffb060', grow: [0.4, 1.1] });
  fgWave(e, x, e.y, 260, { dmg: P * 0.26, launch: 460, knock: 240 }, { mul: m, col: FG_COL.fire, bcol: FG_COL.fire, shake: 14, boom: 1 });
}
defSkill('fg_awaken2', { name: '一字传承·极义震天破', cls: 'fighter', job: GJ, tier: 2, lvReq: 27, maxLv: 3, mp: 180, cd: 170, pvp: 0.45, type: 'phys', awaken: true, air: true, shotSpan: 3.6, col: '#ffb040',
  desc: '【二次觉醒】猛踏地面，震地冲击波把周围的敌人束缚住 → 连踢掀起的岩块（连按 X 加快）→ 闪身抓住最强的敌人抛向空中，再跳起来背摔砸地，终结冲击波。抛不起来的敌人（领主 / 不可抓取）或预约接上时，改成跳起向下刺击收尾。跳跃中也能用；可以在浮空凌云踢、疾波猛坠、裂石破天、死亡旋律、疾风闪电、黑震流·殒灭 施放中预约（先打完那个技能的终结再接上）。全程无敌。',
  pow: lv => skillDmg(30, 9, lv), ai: { kind: 'awaken', r: [0, 400], dy: 120 },
  act: (lv, p) => {
    const P = skillDmg(30, 9, lv), air = p.st === 'jump' || p.z > 2;
    return { name: 'fg_awaken2', clip: air ? 'fgDive' : 'fgStomp', dur: 5, superArmor: true, invul: true, noCounter: true, P,
      onStart: e => { game.cutin = { t: 0, dur: 1.0, name: '一字传承·极义震天破', who: cutinWho(e, 2) }; game.timeStop = 0.9; sfx.awaken(); if (air) e.vz = -1400; else e.act.t0 = 0; },
      onLand: e => { const a = e.act; if (a.t0 === undefined) { a.t0 = e.actT; } e.vz = 0;
        if (a.stage === 'jump' && a.dive) { a.onLand = null; a.stage = 'end'; e.vx = 0; const G = grabsOf(e).slice(); dropGrab(e); fgQtFinish(e, a, G[0] || a.tgt); e.play(G.length ? 'fgPile' : 'fgStomp', true); a.dur = e.actT + 0.7; } },
      onInput: (e, I) => { const a = e.act; if (a.stage !== 'rocks') return false; if (I.buffered('attack')) { while (I.consume('attack')); a.mash = game.t; } return false; },
      hold: (e, t, i) => { const a = e.act; if (a.stage === 'toss') { t.x = e.x + e.face * 30; t.z = Math.min(170, t.z + 12); t.y = e.y + 0.5; } else fgHoldAt(e, t, i, 20, e.z + 30); t.face = -e.face; },
      update: e => { const a = e.act; if (a.t0 === undefined) return; const k = e.actT - a.t0, m = fgMul(e);
        if (!a.stage) { a.stage = 'quake'; e.play('fgStomp', true); cam.shake = Math.max(cam.shake, 12); sfx.boom(1);   // 震地：冲击波 + 束缚
          fxShock(e.x, e.y, 300, '#c8a070'); fxShock(e.x, e.y, 200, '#ffd090'); fgRocks(e.x, e.y, 18, 260); fxSpr('burst', e.x, e.y, 10, { w: 300, dur: 0.4, col: '#ffcf8a', grow: [0.3, 1.2] });
          for (const t of ents) if (foe(e, t) && t.invul <= 0 && t.z < 80 && inGround(t, e.x, e.y, 290)) { fgHitT(e, t, { dmg: P * 0.3, stun: 0.8, knock: 20, hs: 0.06, big: 1.8, radial: true, downHit: true }, m, { x: e.x, y: e.y, z: 0, face: e.face }); if (!isPvp(e, t) && !t.dead) addStatus(t, 'hold', 1.8, { src: e }); }
          a.stage = 'rocks'; a.n = 0; a.nt = k + 0.3; return; }
        if (a.stage === 'rocks') {   // 连踢岩块（8 块）
          if (k >= a.nt && a.n < 8) { a.n++; a.nt = k + (game.t - (a.mash || -9) < 0.25 ? 0.07 : 0.11); e.play(a.n % 2 ? 'fgKick' : 'fgSpin', true); sfx.swing(a.n === 8);
            fxRocksUp(e); fgRockProj(e, { speed: 760, life: 0.55, z: 30 + (a.n % 3) * 18, dy: (a.n % 3 - 1) * 10, size: 34 + (a.n % 2) * 10, mul: m, hit: { dmg: P * 0.03, stun: 0.35, knock: 40, airLift: 100 } }); }
          if (a.n >= 8 && k >= a.nt + 0.1) { a.stage = 'grab'; const t = fgStrongest(e, 460); a.tgt = t;
            if (t && !a.fgResv && canGrab(e, t, { grabInvul: true })) { fgBlink(e, t, 34); startGrab(e, t, { grabInvul: true }); a.stage = 'toss'; a.tt = k; e.play('fgLift', true); sfx.swing(true); }
            else { if (t) fgBlink(e, t, 50); a.stage = 'jump'; e.vz = 700; e.z = 1; e.play('fgFlip', true); } }
          return; }
        if (a.stage === 'toss' && k >= a.tt + 0.3) { a.stage = 'jump'; e.vz = 760; e.z = 1; e.play('fgFlip', true); sfx.jump(); }
        if (a.stage === 'jump' && !a.dive && e.vz < 80) { a.dive = true; e.vz = -1500; e.play(grabsOf(e).length ? 'fgSlam' : 'fgDive', true);
          if (a.tgt && !a.tgt.dead && !grabsOf(e).length) { e.x = a.tgt.x - e.face * 24; } } } };
  } });
// 岩块被踢起来的碎屑（一字传承）
function fxRocksUp(e) { fgRocks(e.x + e.face * 30, e.y, 3, 40); fxDust(e.x + e.face * 26, e.y, 3, 10); }

/* ================= 三觉：归元·柔道家 ================= */
defSkill('fg_equanimity', { name: '神怡气静', cls: 'fighter', job: GJ, tier: 3, lvReq: 29, maxLv: 10, passive: true, type: 'phys', col: '#e0c070',
  desc: '【被动】基础 / 转职技能攻击力提高；傲天之怒永远按“房间里有领主”计算。无情摔击在地面上撞到不可抓取的敌人时原地停下，产生冲击波（伤害和强制硬直相同，范围吃摔技强化）。暴力抓取状态下，霹雳旋踢改成驱赶抓取（身前站着的敌人也一起抓，最多 5 个），并且冲刺中施放时滑行抓取。',
  infoExtra: lv => [['攻击力', '+' + pct(0.06 + 0.012 * lv)]] });

// 黑震流·殒灭：旋风掀翻地面、掀起岩块 → 连踢踢碎（碎片向前飞，多段）→ 最后一踢之前再按技能键：改成冲向被碎片打中的最强敌人肩撞（没有就向前冲）
function fgBasaltTackle(e, a) {
  if (a.tk) return; a.tk = true; a.fgFinDone = true; const P = a.P, m = a.dmgMul || 1;
  const t = a.hitT && [...a.hitT].filter(u => !u.dead && foe(e, u)).sort((p, q) => ((q.boss ? 3e9 : 0) + (q.elite ? 1e9 : 0) + q.hpMax) - ((p.boss ? 3e9 : 0) + (p.elite ? 1e9 : 0) + p.hpMax))[0];
  const R = game.room, x = t ? t.x - e.face * 30 : e.x + e.face * 260;
  fxAfterimage(e, '#c8a070'); fxStreak({ x: e.x, y: e.y, z: e.z + 50, face: e.face, len: Math.abs(x - e.x) + 40, w: 20, col: '#ffcf8a', dur: 0.25 });
  e.x = R ? clamp(x, R.x0 + e.w, R.x1 - e.w) : x; if (t) e.y = t.y; e.play('fgShoulder', true);
  const cx = e.x + e.face * 36; fxSpr('explosion', cx, e.y, 40, { w: 200, dur: 0.45, col: '#c8a070', grow: [0.4, 1.1] }); fgRocks(cx, e.y, 10, 140);
  fgWave(e, cx, e.y, 180, { dmg: P * 0.5, launch: 420, knock: 260 }, { mul: m, col: '#e0b080', bcol: '#ffb060', shake: 10, boom: 1 });
}
defSkill('fg_basalt', { name: '黑震流·殒灭', cls: 'fighter', job: GJ, tier: 3, lvReq: 29, mp: 115, cd: 60, type: 'phys', air: true, shotSpan: 2.2, col: '#7a5a3a',
  desc: '卷起旋风掀翻前方的地面、掀起大块岩石，连踢 4 脚把岩石踢碎，碎片向前飞出造成多段伤害。最后一脚之前再按技能键：改成冲向被碎片打中的最强敌人猛力肩撞，产生冲击波（没打中任何人就向前冲），这时按一字传承·极义震天破可以同时施放。地面、空中都能使用。',
  pow: lv => skillDmg(22, 2.2, lv), ai: { kind: 'burst', r: [0, 320], dy: 40 },
  act: (lv, p) => {
    const P = skillDmg(22, 2.2, lv), air = p.st === 'jump' || p.z > 2;
    return fgAct({ name: 'fg_basalt', clip: 'fgFocus', dur: 3, superArmor: true, noCounter: true, P,
      onStart: e => { const a = e.act; if (air) e.vz = -1300; else a.t0 = 0; },
      onLand: e => { const a = e.act; if (a.t0 === undefined) a.t0 = e.actT; e.vz = 0; e.vx = 0; },
      onInput: (e, I) => { const a = e.act; if (a.t0 === undefined || a.tk || e.actT - a.t0 < 0.9) return false; const slot = barOf(e).indexOf('fg_basalt');
        if ((slot >= 0 && I.buffered('s' + slot)) || I.buffered('cmd')) { if (slot >= 0) I.consume('s' + slot); I.consume('cmd'); a.recast = true; return true; } return false; },
      update: e => { const a = e.act; if (a.t0 === undefined) return; const k = e.actT - a.t0, m = fgMul(e), fx = e.x + e.face * 90;
        if (!a.tw) { a.tw = true; a.dur = e.actT + 2.1; e.play('fgSpin', true); fgWind(fx, e.y, 170, 0.6, '#9a8468'); fgRocks(fx, e.y, 14, 150, '#6a5a4a'); sfx.boom(0.6);   // 旋风掀翻地面
          for (let n = 0; n < 4; n++) game.after(n * 0.12, () => { if (e.dead) return; blast(e, fx, e.y, 130, { dmg: P * 0.04 * m, stun: 0.4, knock: -40, pull: true, hs: 0.03, snd: 'blunt', downHit: true, col: '#e0c8a0' }, { zMax: 120 }); }); }
        for (let n = 0; n < 3; n++) if (k >= 0.5 + n * 0.22 && (a.kicks || 0) <= n) { a.kicks = n + 1; e.play(n % 2 ? 'fgSpin' : 'fgKick', true); sfx.swing(true);   // 连踢 1~3：碎片（每脚最多 10 段）
          fxSpr('burst', e.x + e.face * 50, e.y, 50, { w: 90, dur: 0.2, col: '#e0c8a0' });
          fgRockProj(e, { speed: 520, life: 0.6, z: 20, size: 46, bw: 40, bd: 34, bh: 90, mul: m, col: '#6a5a4a', hit: { dmg: P * 0.01, rep: 0.05, max: 10, stun: 0.3, knock: 20, hs: 0.01 }, onHitT: (pr, t) => (a.hitT || (a.hitT = new Set())).add(t) }); }
        if (!a.tk && (a.recast ? k >= 1.2 : k >= 1.3)) {
          if (a.recast) { fgBasaltTackle(e, a); a.dur = e.actT + 0.55; return; }
          a.tk = true; a.fgFinDone = true; e.play('fgKick', true); sfx.swing(true);   // 第 4 脚：大块碎片（2 段）
          fxSpr('explosion', e.x + e.face * 60, e.y, 40, { w: 130, dur: 0.35, col: '#c8a070' });
          fgRockProj(e, { speed: 700, life: 0.55, z: 20, size: 70, bw: 50, bd: 40, bh: 100, mul: m, col: '#5a4a3a', hit: { dmg: P * 0.25, rep: 0.12, max: 2, stun: 0.5, knock: 160, launch: 300, hs: 0.06, big: 1.6 } });
          a.dur = e.actT + 0.5; } },
      fgFin: (e, G, a) => fgBasaltTackle(e, a) });
  } });

// 黑震流·山岳崩颓（三觉）：放出斗气压制周围敌人 → 对最强的敌人背摔 + 向下捶击 → 连捶地面三次，周围变成沸腾的火山（三次喷发）→ 全力一脚踢出巨石 → 巨石爆炸
defSkill('fg_awaken3', { name: '黑震流·山岳崩颓', cls: 'fighter', job: GJ, tier: 3, lvReq: 30, maxLv: 3, mp: 250, cd: 270, pvp: 0.45, type: 'phys', awaken: true, air: true, shotSpan: 3.8, col: '#ff5a1a',
  desc: '【三次觉醒】放出斗气压制周围的敌人（强制硬直），闪身抓住最强的敌人过肩背摔，再向下一记重捶；接着连捶地面三次，让周围变成沸腾的火山，一次比一次猛烈地喷发；最后全力一脚踢出巨石，巨石在前方爆炸。抓不住的敌人（领主）直接吃更重的向下捶击。和二觉一样可以在指定技能施放中预约。全程无敌。',
  pow: lv => skillDmg(45, 12, lv), ai: { kind: 'awaken', r: [0, 420], dy: 140 },
  act: (lv, p) => {
    const P = skillDmg(45, 12, lv), air = p.st === 'jump' || p.z > 2;
    return { name: 'fg_awaken3', clip: 'fgFocus', dur: 6, superArmor: true, invul: true, noCounter: true, P,
      onStart: e => { game.cutin = { t: 0, dur: 1.2, name: '黑震流·山岳崩颓', who: cutinWho(e, 3) }; game.timeStop = 1.0; sfx.awaken(); if (air) e.vz = -1400; else e.act.t0 = 0; },
      onLand: e => { const a = e.act; if (a.t0 === undefined) a.t0 = e.actT; e.vz = 0; e.vx = 0; },
      hold: (e, t, i) => { const a = e.act, k = e.actT - (a.gt || 0), th = clamp(k / 0.3, 0, 1) * Math.PI; t.x = e.x + e.face * 38 * Math.cos(th); t.z = Math.max(0, 24 + 70 * Math.sin(th)); t.y = e.y + 0.5; t.rot = e.face * th; t.face = -e.face; },
      update: e => { const a = e.act; if (a.t0 === undefined) return; const k = e.actT - a.t0, m = fgMul(e);
        if (!a.s1) { a.s1 = true; a.dur = e.actT + 3.8; e.play('fgFocus', true); fxAura(e, '#ff5a2a', 1.2); fxShock(e.x, e.y, 340, '#ff5a2a'); cam.shake = Math.max(cam.shake, 6); sfx.boom(0.6);   // 斗气压制
          for (const t of ents) if (foe(e, t) && t.invul <= 0 && inGround(t, e.x, e.y, 340) && !isPvp(e, t)) addStatus(t, 'hold', 4, { src: e }); }
        if (k >= 0.4 && !a.s2) { a.s2 = true; const t = fgStrongest(e, 480); a.tgt = t;   // 最强的敌人：背摔
          if (t) { fgBlink(e, t, 40); if (canGrab(e, t, { grabInvul: true })) { startGrab(e, t, { grabInvul: true }); a.gt = e.actT; e.play('fgLift', true); sfx.swing(true); } } }
        if (k >= 0.72 && !a.s3) { a.s3 = true; const G = grabsOf(e).slice(), x = e.x - e.face * 36;
          for (const t of G) applyHit(e, t, { dmg: P * 0.05, sure: true, noCounterBonus: true, hs: 0.1, big: 1.8, shake: 6, snd: 'blunt', col: FG_COL.fire });
          if (G.length) { dropGrab(e); for (const t of G) { t.x = x; t.z = 0; } fxShock(x, e.y, 120, FG_COL.fire); fxDust(x, e.y, 10, 30); e.face = -e.face; } }
        if (k >= 0.95 && !a.s4) { a.s4 = true; const t = a.tgt; e.play('fgSlam', true); sfx.boom(0.9); cam.shake = Math.max(cam.shake, 8);   // 向下重捶（抓不住的更重）
          if (t && !t.dead) { const grabbed = a.gt !== undefined; fgHitT(e, t, { dmg: P * (grabbed ? 0.1 : 0.15), spike: 500, down: true, throwHit: true, stun: 0.8, hs: 0.12, big: 2, shake: 8, col: FG_COL.fire }, m); fxSpr('burst', t.x, t.y, 20, { w: 180, dur: 0.35, col: FG_COL.fire }); } }
        for (let n = 0; n < 3; n++) if (k >= 1.25 + n * 0.42 && (a.er || 0) <= n) { a.er = n + 1; const r = 200 + n * 50, x = e.x + e.face * 60;   // 捶地：三次喷发
          e.play(n % 2 ? 'fgSlam' : 'fgStomp', true); if (n === 0) fgLavaField(x, e.y, 300, 2.4);
          for (let j = 0; j < 5 + n * 2; j++) { const px = x + rnd(-r, r) * 0.8, py = clamp(e.y + rnd(-40, 40), 8, DEPTH - 8); fxSpr('lava', px, py, 0, { w: rnd(60, 100), dur: 0.6, ay: 1, grow: [0.3, 1.1] }); fxSpr('flame', px, py, 30, { w: 60, dur: 0.4, rot: -Math.PI / 2, col: FG_COL.fire }); }
          fgRocks(x, e.y, 6 + n * 3, r); fxShock(x, e.y, r, '#ff7a2a');
          blast(e, x, e.y, r, { dmg: P * [0.05, 0.1, 0.2][n] * m, launch: 180 + n * 80, knock: 80, hs: 0.05, snd: 'blunt', col: '#ffb060', downHit: true }, { zMax: 200 });
          cam.shake = Math.max(cam.shake, 6 + n * 3); sfx.boom(0.6 + n * 0.2); }
        if (k >= 2.55 && !a.s6) { a.s6 = true; e.play('fgKick', true); sfx.swing(true);   // 全力一脚：踢出巨石
          const B = atkBox(e, { box: [-10, 220, 60, 0, 160] }); for (const t of ents) if (canHit(e, t, { downHit: true }) && overlaps(B, t)) fgHitT(e, t, { dmg: P * 0.15, launch: 360, knock: 220, hs: 0.1, big: 2, shake: 6, col: FG_COL.fire }, m);
          const bx = e.x + e.face * 40; a.bx = e.x + e.face * 240;
          addFx({ x: bx, y: e.y + 1, z: 40, dur: 0.4, img: fxTint('rock', '#5a3a2a'), face: e.face, draw(c) { const kk = this.t / this.dur, X = sx(bx + (a.bx - bx) * kk); drawSpr(c, this.img, X, sy(this.y, 40 + Math.sin(kk * Math.PI) * 40), 120, 0, { rot: kk * 8 * this.face, add: false }); drawSpr(c, 'flame', X - this.face * 40, sy(this.y, 50), 110, 0, { flip: this.face < 0, alpha: 0.7 }); } }); }
        if (k >= 2.95 && !a.s7) { a.s7 = true; fgBoom(a.bx, e.y, 360, '#ff6a2a', 20); fxSpr('meteor', a.bx, e.y, 60, { w: 200, dur: 0.5, grow: [0.5, 1.3] });   // 巨石爆炸
          fgWave(e, a.bx, e.y, 300, { dmg: P * 0.35, launch: 520, knock: 280 }, { mul: m, col: '#ff7a2a', bcol: '#ffb060', shake: 16, boom: 1, zMax: 220 }); } } };
  } });

/* ================= 被动刷新（力之奥义 / 傲天之怒 / 神怡气静） ================= */
CLASSES.fighter.passives.push(p => {
  const on = fgIs(p), sl = on ? skLv(p, 'fg_strongest') : 0, el = on ? skLv(p, 'fg_equanimity') : 0;
  const boss = sl > 0 && (el > 0 || ents.some(t => t.team === 'e' && !t.dead && (t.boss || t.elite)));
  setPassive(p, 'fg_strongest', sl > 0, { dmg: 0.04 + 0.01 * sl + (boss ? 0.03 + 0.006 * sl : 0), crit: 0.02 + 0.003 * sl });
  setPassive(p, 'fg_equanimity', el > 0, { dmg: 0.06 + 0.012 * el });
});
CLASSES.fighter.jobs.grappler.skills.push('fg_counter', 'fg_awaken', 'fg_pierce', 'fg_fury', 'fg_strongest', 'fg_blacktornado', 'fg_stormdiver', 'fg_awaken2', 'fg_equanimity', 'fg_basalt', 'fg_awaken3');
CLASSES.fighter.jobs.grappler.awaken2 = 'fg_awaken2'; CLASSES.fighter.jobs.grappler.awaken3 = 'fg_awaken3';
CLASSES.fighter.cmds.push(['uudd', 'fg_awaken'], ['fbdf', 'fg_pierce'], ['fbuf', 'fg_fury'], ['fbf', 'fg_blacktornado'], ['dff', 'fg_stormdiver'], ['duff', 'fg_awaken2'], ['udff', 'fg_basalt'], ['bufd', 'fg_awaken3']);
Object.assign(FG_ANIMS, { fgFlyKick: fgTl([['f_flykick', 0]], [['jump2', 0]]) });
CLIPS.fighter.fgFlyKick = { dur: 0.3, keys: [k(0, POSE.fJKick || POSE.jAtkS)] };
