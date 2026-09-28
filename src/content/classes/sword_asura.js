/* =====================================================================
   转职：阿修罗（鬼剑士，jobId asura）—— 国服现版对齐（docs/SKILLS_OFFICIAL_sword.md 第 6 节）
   舍弃鬼神之力、以双眼为代价掌握“波动”的剑士（设定上是盲人：X 形眼罩、免疫失明）。魔法独立攻击（按智力）。
   核心：波动刻印（开启后每 7 秒生成 1 个波动印，最多 5 个；鬼印珠 / 不动明王阵一次消耗全部，印越多越痛）、
   无尽波动（开关光环：持续耗 MP，周围敌人每 0.5 秒受伤并被挑衅；无双波的前置）。
   技能：裂波斩 / 地裂·波动剑强化、鬼印珠、绝对感知、邪光斩（+ 修罗邪光斩蓄力）、挫折意志、波动爆发（倒地也能用）、
   冰刃·波动剑、爆炎·波动剑、无双波、邪光波动阵、不动明王阵；觉醒（暗天波动眼等）见 P1
   ===================================================================== */
const asOn = p => !!(p && p.buffs && p.buffs.as_mark);
const asMarks = p => (asOn(p) && p.buffs.as_mark.n) || 0;
function asMarkAdd(p, n = 1) {   // 波动刻印开启时才能积累波动印
  if (!asOn(p) || jobOf(p) !== 'asura') return;
  const B = p.buffs.as_mark, n0 = B.n || 0; B.n = Math.min(5, n0 + n);
  if (B.n > n0) { fxText('波动印 ' + B.n, p.x, p.y, p.z + 30, { col: '#b8a8ff', size: 10, dur: 0.6 }); asFx(p); }
}
function asMarkTake(p) { const n = asMarks(p); if (asOn(p)) p.buffs.as_mark.n = 0; return n; }
const asMarkReq = p => asMarks(p) > 0 ? true : '需要波动印';
const asAuraOn = p => !!(p && p.buffs && p.buffs.as_aura);
const AS_COL = '#a88cff', AS_COL2 = '#6ad0ff';
// 波动印（绕身旋转的小光球）和无尽波动的光环：每个阿修罗一个常驻特效，跟着 y 排序；换房间清掉特效列表后自动重建
function asFx(p) {
  if (p._asFx && fxList.includes(p._asFx)) return;
  p._asFx = addFx({ x: p.x, y: p.y, z: 0, dur: 1e9, p,
    update() { const P = this.p; this.x = P.x; this.y = P.y + 0.6; if (P.dead || P.remove || jobOf(P) !== 'asura' || (!asOn(P) && !asAuraOn(P))) this.t = this.dur; },
    draw(c) { const P = this.p, n = asMarks(P), T = game.t;
      if (asAuraOn(P)) { const k = 0.5 + 0.5 * Math.sin(T * 5); drawSpr(c, fxTint('shock', AS_COL), sx(P.x), sy(P.y, 0), 170 + k * 20, 0, { alpha: 0.35 + k * 0.15 }); }
      for (let i = 0; i < n; i++) { const a = T * 2.2 + i * TAU / n, X = sx(P.x + Math.cos(a) * 30), Y = sy(P.y + Math.sin(a) * 10, P.z + 62 + Math.sin(a * 2) * 4); drawSpr(c, fxTint('orb', AS_COL), X, Y, 14, 0, { alpha: 0.9 }); }
    } });
}

/* ---- 被动 ---- */
defSkill('as_sense', { name: '绝对感知', cls: 'sword', job: 'asura', lvReq: 16, maxLv: 1, mp: 0, cd: 0, type: 'indep', passive: true, col: '#8a7ae0',
  desc: '【被动】舍弃双眼、以全身感知波动：免疫失明，从背后被攻击时回避率提高。' });
defSkill('as_will', { name: '挫折意志', cls: 'sword', job: 'asura', lvReq: 17, mp: 0, cd: 0, type: 'indep', passive: true, col: '#9a8ae0',
  desc: '【被动】被攻击后，或施放波动爆发、无尽波动、无双波、邪光波动阵、不动明王阵时，30 秒内攻击力提高（再次触发刷新时间）。', infoExtra: lv => [['攻击力', '+' + pct(0.02 + 0.004 * lv)]] });
const asWill = p => { const lv = skLv(p, 'as_will'); if (lv) p.buffs.as_will = { t: 30, atk: 0.02 + 0.004 * lv }; };
defSkill('as_evil_c', { name: '修罗邪光斩', cls: 'sword', job: 'asura', lvReq: 16, maxLv: 1, mp: 0, cd: 0, type: 'indep', passive: true, col: '#c0a0ff',
  desc: '【被动】按住邪光斩的技能键可以蓄力（很短）：蓄满时伤害 +50%，剑气更快、飞得更远并击退敌人，并生成 1 个波动印。在冰刃·波动剑、爆炎·波动剑之后接邪光斩时直接是蓄满版。' });

/* ---- 波动刻印：开关 BUFF。开启时立刻生成 1 个波动印，之后每 7 秒生成 1 个（最多 5 个）；施放速度、攻击力提高；普攻和上挑附带射出波动剑气 ---- */
defSkill('as_mark', { name: '波动刻印', cls: 'sword', job: 'asura', lvReq: 15, mp: 20, cd: 1, type: 'indep', buff: true, col: '#a88cff',
  desc: '【开关 BUFF · 再按一次解除】把波动刻进身体：开启时立刻生成 1 个波动印，之后每 7 秒生成 1 个（最多 5 个），施放速度和攻击力提高，普攻和上挑附带射出波动剑气。鬼印珠、不动明王阵会一次消耗全部波动印。',
  ai: { kind: 'buff', core: true }, infoExtra: lv => [['攻击力', '+' + pct(0.03 + 0.005 * lv)], ['施放速度', '+' + pct(0.05 + 0.01 * lv)], ['波动印', '每 7 秒 1 个，最多 5 个']],
  act: (lv) => ({ name: 'as_mark', clip: 'asAura', dur: 0.45, noCounter: true,
    onStart: e => { if (toggleBuff(e, 'as_mark', 9999, { atk: 0.03 + 0.005 * lv, cspd: 0.05 + 0.01 * lv, n: 0, gen: 7 })) { asMarkAdd(e, 1); sfx.buff(); fxAura(e, AS_COL, 1); fxShock(e.x, e.y, 90, AS_COL); } } }) });

/* ---- 鬼印珠：需要波动印，一次消耗全部。发射高速旋转的珠子多段攻击，自己和被击中的敌人都减速；约 4 秒或打满后爆炸。印越多越痛 ---- */
defSkill('as_orb', { name: '鬼印珠', cls: 'sword', job: 'asura', lvReq: 15, mp: 25, cd: 6, type: 'indep', col: '#b89aff', req: asMarkReq,
  desc: '【需要波动印，消耗全部】向前发射高速旋转的鬼印珠，多段攻击并减速敌人（施放后自己也会短暂减速），约 4 秒后或打满次数时爆炸。消耗的波动印越多伤害越高（2 / 3 / 4 / 5 个：+5% / 10% / 15% / 20%）。',
  pow: lv => skillDmg(4.0, 0.4, lv), ai: { kind: 'proj', r: [0, 320], dy: 30 },
  act: (lv, p) => ({ name: 'as_orb', clip: 'asOrb', dur: 0.5, noCounter: true,
    events: [evAt(0.22, e => { const n = asMarkTake(e), m = 1 + 0.05 * Math.max(0, n - 1); sfx.swing(true); sfx.charge(); e.buffs.as_orbslow = { t: 1.2, mspd: -0.3 };
      spawnProj({ owner: e, x: e.x + e.face * 40, y: e.y, z: e.z + 60, vx: e.face * 170, face: e.face, life: 4.3, w: 26, d: 24, h: 40, pierce: true,
        hit: { dmg: skillDmg(0.22, 0.022, lv) * m, rep: 0.2, max: 14, stun: 0.25, knock: 8, hs: 0.02, type: 'indep', col: AS_COL },
        onHitT(pr, t) { addStatus(t, 'slow', 1.5, { src: e }); pr.hits = (pr.hits || 0) + 1; if (pr.hits >= 14) pr.t = pr.life; },
        update(pr, dt) { if (Math.abs(pr.vx) > 70) pr.vx *= Math.exp(-0.25 * dt); },
        onEnd(pr) { sfx.boom(0.6); fxBurst(pr.x, pr.y, pr.z, 150, AS_COL); fxShock(pr.x, pr.y, 90, AS_COL);
          blast(e, pr.x, pr.y, 80, { dmg: skillDmg(1.4, 0.14, lv) * m, launch: 300, knock: 120, hs: 0.06, type: 'indep', col: AS_COL }, { zMax: 150 }); },
        draw(c, pr) { const X = sx(pr.x), Y = sy(pr.y, pr.z); drawSpr(c, fxTint('darkorb', AS_COL), X, Y, 44, 0, { rot: pr.t * 12 }); drawSpr(c, fxTint('rune', AS_COL), X, Y, 60, 0, { rot: -pr.t * 5, alpha: 0.6 }); } }); })] }) });

/* ---- 邪光斩：挥剑放出巨大剑气，多段攻击，容易打中高处和倒地的敌人。学了修罗邪光斩可以按住蓄力（蓄满 / 接在冰刃、爆炎之后 = 满蓄） ---- */
defSkill('as_evil', { name: '邪光斩', cls: 'sword', job: 'asura', lvReq: 16, mp: 30, cd: 10, type: 'indep', col: '#c0a0ff',
  desc: '挥剑放出巨大的邪光剑气，多段攻击沿途的敌人，高处和倒地的敌人也打得到。学了修罗邪光斩后可以按住技能键蓄力：蓄满时伤害 +50%、剑气更快更远、击退敌人并生成 1 个波动印；接在冰刃·波动剑、爆炎·波动剑后面施放时直接是蓄满版。',
  pow: lv => skillDmg(4.5, 0.45, lv), ai: { kind: 'proj', r: [0, 300], dy: 26 },
  act: (lv, p) => {
    const chargeOk = hasSkill(p, 'as_evil_c'), linked = p && p._asEvilFull && game.t - p._asEvilFull < 0.3;
    const a = { name: 'as_evil', clip: 'asEvil', dur: 0.55, noCounter: true,
      onStart: e => { if (linked) { e.act.chargeK = 1; e.act.full = true; e.act.charge = null; e.act.chargeDone = true; } },
      events: [evAt(0.12, e => { const full = e.act.full || (e.act.chargeK || 0) > 0.95, sp = full ? 900 : 420, life = full ? 0.9 : 0.6;
        sfx.swing(true); sfx.iai(); cam.shake = Math.max(cam.shake, full ? 4 : 2); if (full) { asMarkAdd(e, 1); fxShock(e.x, e.y, 90, AS_COL); }
        fxSlashOn(e, { col: AS_COL, a0: 1.4, a1: -1.9, r: 80, w: 24, off: [10, 50], heavy: true });
        spawnProj({ owner: e, x: e.x + e.face * 40, y: e.y, z: 0, vx: e.face * sp, face: e.face, life, w: 34, d: 30, h: 150, pierce: true,
          hit: { dmg: skillDmg(0.9, 0.09, lv) * (full ? 1.5 : 1), rep: 0.3, max: 5, stun: 0.4, knock: full ? 160 : 30, airLift: 160, downHit: true, hs: 0.04, type: 'indep', col: AS_COL },
          draw(c, pr) { const X = sx(pr.x), Y = sy(pr.y, 0), k = pr.t / pr.life, al = k > 0.8 ? (1 - k) / 0.2 : 1; drawSpr(c, fxTint('wave', AS_COL), X, Y + 6, 0, full ? 170 : 140, { ay: 1, flip: pr.face < 0, alpha: al });
            drawSpr(c, fxTint('slash', AS_COL2), X - pr.face * 10, Y - 60, full ? 130 : 100, 0, { flip: pr.face < 0, rot: -1.2 * pr.face, alpha: al * 0.6 }); } }); })] };
    if (chargeOk && !linked) a.charge = { at: 0.06, max: 0.1, min: 0, dmg: 0, update: e => { if (Math.random() < 0.6) fxCharge(e, AS_COL); } };
    return a;
  } });

/* ---- 波动爆发：瞬间爆发体内的波动，把周围的敌人往面朝方向击飞；霸体；生成 2 个波动印；倒地时也能用 ---- */
defSkill('as_burst', { name: '波动爆发', cls: 'sword', job: 'asura', lvReq: 17, mp: 30, cd: 7.5, type: 'indep', col: '#9a7aff',
  desc: '瞬间爆发体内的波动，把周围的敌人往面朝方向震飞。霸体，生成 2 个波动印。倒地时也能施放。', pow: lv => skillDmg(4.0, 0.4, lv), ai: { kind: 'aoe', r: [0, 110], dy: 40 },
  whenHit: p => p.st !== 'hit' && p.st !== 'air',
  act: (lv) => ({ name: 'as_burst', clip: 'asBurst', dur: 0.55, superArmor: true, noCounter: true,
    onStart: e => { if (e.z < 1) e.z = 0; asWill(e); },
    events: [evAt(0.12, e => { asMarkAdd(e, 2); cam.shake = Math.max(cam.shake, 6); sfx.boom(0.9); fxShock(e.x, e.y, 180, AS_COL); fxBurst(e.x + e.face * 30, e.y, e.z + 50, 200, AS_COL);
      blast(e, e.x + e.face * 20, e.y, 120, { dmg: skillDmg(4.0, 0.4, lv), launch: 380, knock: 280, hs: 0.1, big: 1.5, type: 'indep', col: AS_COL, radial: false }, { zMax: 160 }); })] }) });

/* ---- 无尽波动：开关光环。开启期间持续消耗 MP，周围的敌人每 0.5 秒受到伤害并被挑衅；自身攻击力提高；无双波的前置 ---- */
defSkill('as_aura', { name: '无尽波动', cls: 'sword', job: 'asura', lvReq: 18, mp: 20, cd: 1, type: 'indep', buff: true, col: '#8a6aff',
  desc: '【开关 BUFF · 再按一次解除】放出无尽的杀意波动：周围的敌人每 0.5 秒受到一次伤害，并被挑衅转而攻击自己；自身攻击力提高。开启期间持续消耗 MP，MP 不足时自动解除。无双波只能在无尽波动开启时施放。',
  pow: lv => skillDmg(0.3, 0.03, lv), ai: { kind: 'buff', core: true }, infoExtra: lv => [['攻击力', '+' + pct(0.03 + 0.005 * lv)], ['每秒消耗 MP', '3%']],
  act: (lv) => ({ name: 'as_aura', clip: 'asAura', dur: 0.45, noCounter: true,
    onStart: e => { if (toggleBuff(e, 'as_aura', 9999, { atk: 0.03 + 0.005 * lv, lv, tick: 0 })) { asWill(e); sfx.buff(); fxShock(e.x, e.y, 150, AS_COL); asFx(e); } } }) });

/* ---- 冰刃·波动剑：沿地面接连刺出一排冰柱，100% 冰冻；冰冻中的敌人可以连续命中；生成 1 个波动印 ---- */
defSkill('as_ice', { name: '冰刃·波动剑', cls: 'sword', job: 'asura', lvReq: 18, mp: 35, cd: 7, type: 'indep', elem: 'ice', col: '#8fdcff',
  desc: '把剑插进地面，沿地面向前接连刺出一排冰柱，命中的敌人 100% 冰冻（冰冻中的敌人可以被连续命中）。生成 1 个波动印。之后可以直接接满蓄的邪光斩。', pow: lv => skillDmg(4.4, 0.44, lv), ai: { kind: 'proj', r: [0, 280], dy: 26 },
  act: (lv) => ({ name: 'as_ice', clip: 'asPlant', dur: 0.8, noCounter: true, links: ['as_evil'], linkFrom: 0.3,
    update: e => { if (e.actT >= 0.3) e._asEvilFull = game.t; }, onEnd: e => { e._asEvilFull = game.t; },   // 后摇中接邪光斩 = 满蓄
    events: [evAt(0.14, e => { sfx.ice(); asMarkAdd(e, 1); cam.shake = Math.max(cam.shake, 2); const x0 = e.x, y0 = e.y, f = e.face;
      for (let i = 0; i < 11; i++) game.after(i * 0.04, () => { if (e.dead) return; const x = x0 + f * (40 + i * 24), y = y0 + (i % 2 ? 8 : -8);
        fxSpr('icespike', x, y, 0, { h: 70 + (i % 3) * 14, dur: 0.5, ay: 1, grow: [0.2, 1] });
        blast(e, x, y, 30, { dmg: skillDmg(0.4, 0.04, lv), stun: 0.3, knock: 10, airLift: 120, hs: 0.02, type: 'indep', elem: 'ice', col: '#bfefff' }, { zMax: 100, status: 'freeze', sdur: 1.6 }); }); })] }) });

/* ---- 爆炎·波动剑：连锁火焰爆炸，100% 灼伤 4 秒；生成 1 个波动印 ---- */
defSkill('as_fire', { name: '爆炎·波动剑', cls: 'sword', job: 'asura', lvReq: 19, mp: 45, cd: 15, type: 'indep', elem: 'fire', col: '#ff8a4a',
  desc: '把剑插进地面，向前引发一连串火焰爆炸，命中的敌人 100% 灼伤 4 秒。生成 1 个波动印。之后可以直接接满蓄的邪光斩。', pow: lv => skillDmg(6.0, 0.6, lv), ai: { kind: 'proj', r: [0, 260], dy: 30 },
  act: (lv) => ({ name: 'as_fire', clip: 'asPlant', dur: 0.9, noCounter: true, links: ['as_evil'], linkFrom: 0.35,
    update: e => { if (e.actT >= 0.3) e._asEvilFull = game.t; }, onEnd: e => { e._asEvilFull = game.t; },   // 后摇中接邪光斩 = 满蓄
    events: [evAt(0.16, e => { asMarkAdd(e, 1); const x0 = e.x, y0 = e.y, f = e.face;
      for (let i = 0; i < 5; i++) game.after(i * 0.09, () => { if (e.dead) return; const x = x0 + f * (60 + i * 50); sfx.boom(0.5); cam.shake = Math.max(cam.shake, 3);
        fxSpr('explosion', x, y0, 30, { w: 120 + i * 10, dur: 0.45, grow: [0.4, 1.1] });
        blast(e, x, y0, 60, { dmg: skillDmg(1.2, 0.12, lv), launch: i === 4 ? 360 : 200, knock: 60, hs: 0.05, type: 'indep', elem: 'fire', col: '#ffb070' }, { zMax: 160, status: 'burn', sdur: 4, dps: 0.06 }); }); })] }) });

/* ---- 无双波（仅无尽波动中）：在前方撕开波动裂缝，把周围的敌人吸过去；再按一次（或时间到）引爆。可以中途接不动明王阵 ---- */
defSkill('as_musou', { name: '无双波', cls: 'sword', job: 'asura', lvReq: 19, mp: 45, cd: 12, type: 'indep', col: '#9a6aff', req: p => asAuraOn(p) ? true : '需要无尽波动',
  desc: '【无尽波动中】在前方撕开波动裂缝，把周围的敌人吸到裂缝里持续伤害；再按一次技能键（或 1.5 秒后）引爆裂缝。可以中途接不动明王阵。', pow: lv => skillDmg(6.0, 0.6, lv), ai: { kind: 'aoe', r: [60, 220], dy: 50 },
  act: (lv) => ({ name: 'as_musou', clip: 'asPull', dur: 1.7, noCounter: true, superArmor: true, links: ['as_fudo'],
    onStart: e => { asWill(e); e.act.cx = e.x + e.face * 150; e.act.cy = e.y; e._asMusou = { x: e.act.cx, y: e.act.cy }; sfx.charge(); },
    follow: () => asMusouBoom(lv), followWin: [0.3, 1.6],
    update: (e, dt) => { const a = e.act;
      for (const t of ents) if (hittable(e, t) && !t.boss && Math.hypot(t.x - a.cx, (t.y - a.cy) * 1.5) < 230) { t.x = damp(t.x, a.cx, 5, dt); t.y = damp(t.y, a.cy, 5, dt); }
      a.tk = (a.tk || 0) + dt; if (a.tk >= 0.2) { a.tk = 0; fxSpr('vortex', a.cx, a.cy, 50, { w: 150, dur: 0.3, alpha: 0.7, col: AS_COL, spin: 6 }); blast(e, a.cx, a.cy, 90, { dmg: skillDmg(0.35, 0.035, lv), stun: 0.3, knock: 0, hs: 0.02, type: 'indep', col: AS_COL }, { zMax: 200 }); }
      if (e.actT >= 1.5 && !a.boomed) { a.boomed = true; asMusouFinish(e, lv, a.cx, a.cy); } } }) });
function asMusouFinish(e, lv, x, y) { cam.shake = Math.max(cam.shake, 7); sfx.boom(1); fxBurst(x, y, 50, 240, AS_COL); fxShock(x, y, 200, AS_COL);
  blast(e, x, y, 120, { dmg: skillDmg(3.4, 0.34, lv), launch: 480, knock: 120, hs: 0.1, big: 1.6, type: 'indep', col: AS_COL }, { zMax: 220 }); }
function asMusouBoom(lv) {   // 再按一次：立即引爆（裂缝中心取上一段动作记下的位置）
  return { name: 'as_musou2', clip: 'asBurst', dur: 0.45, noCounter: true, superArmor: true, links: ['as_fudo'],
    onStart: e => { const p = e._asMusou || { x: e.x + e.face * 150, y: e.y }; asMusouFinish(e, lv, p.x, p.y); } };
}

/* ---- 邪光波动阵：剑劈地面放出冲击波，生成圆形波动阵，持续 2 秒、7 段伤害，定住敌人（连抓取免疫的大型怪也能定住）。可以接无双波 ---- */
defSkill('as_array', { name: '邪光波动阵', cls: 'sword', job: 'asura', lvReq: 19, mp: 50, cd: 20, type: 'indep', col: '#b08aff',
  desc: '把剑劈进地面放出冲击波，生成圆形的波动阵：持续 2 秒、共 7 段伤害，并定住阵里的敌人（抓取免疫的大型怪物也能定住）。之后可以接无双波。', pow: lv => skillDmg(6.5, 0.65, lv), ai: { kind: 'aoe', r: [0, 150], dy: 40 },
  act: (lv) => ({ name: 'as_array', clip: 'a3slam', dur: 0.7, noCounter: true, superArmor: [0, 0.5], links: ['as_musou'], linkFrom: 0.3,
    onStart: e => asWill(e),
    events: [evAt(0.28, e => { const cx = e.x + e.face * 70, cy = e.y; cam.shake = Math.max(cam.shake, 5); sfx.boom(0.8); fxShock(cx, cy, 160, AS_COL);
      addFx({ x: cx, y: cy - 30, z: 0, dur: 2, draw(c) { const k = this.t / this.dur, al = k < 0.1 ? k / 0.1 : k > 0.85 ? (1 - k) / 0.15 : 1; drawSpr(c, fxTint('hexagram', AS_COL), sx(cx), sy(cy, 0), 240, 90, { rot: this.t * 0.8, alpha: 0.75 * al }); } });
      for (let i = 0; i < 7; i++) game.after(i * 0.28, () => { if (e.dead) return; fxSpr('wave', cx + rnd(-60, 60), cy + rnd(-16, 16), 0, { h: 90, dur: 0.3, ay: 1, col: AS_COL, alpha: 0.8 });
        blast(e, cx, cy, 130, { dmg: skillDmg(0.93, 0.093, lv), stun: 0.6, knock: 0, hs: 0.03, downHit: true, type: 'indep', col: AS_COL, onHit: (a, t) => asRoot(t, a, 0.5) }, { zMax: 140 }); }); })] }) });
const asRoot = (t, a, dur) => addStatus(t, 'root', dur, { src: a });   // 定身（对领主自动变为减速）

/* ---- 不动明王阵：需要波动印，一次消耗全部。在前方生成阵法强控敌人，不动明王现身，焰珠绕阵旋转后爆炸；按 C 立刻引爆。全程霸体 ---- */
defSkill('as_fudo', { name: '不动明王阵', cls: 'sword', job: 'asura', lvReq: 20, mp: 70, cd: 45, type: 'indep', col: '#7a8aff', req: asMarkReq,
  desc: '【需要波动印，消耗全部】在前方生成不动明王阵：阵里的敌人被牢牢定住，不动明王现身，焰珠绕阵旋转后一起爆炸；按跳跃键立刻引爆。全程霸体。消耗的波动印越多伤害越高。', pow: lv => skillDmg(9.0, 0.9, lv), ai: { kind: 'aoe', r: [40, 220], dy: 50 },
  act: (lv) => ({ name: 'as_fudo', clip: 'asSeal', dur: 2.4, superArmor: true, noCounter: true,
    onStart: e => { const a = e.act; a.n = asMarkTake(e); a.m = 1 + 0.08 * Math.max(0, a.n - 1); a.cx = e.x + e.face * 160; a.cy = e.y; asWill(e); sfx.charge(); cam.shake = Math.max(cam.shake, 4);
      fxShock(a.cx, a.cy, 200, AS_COL2);
      a.fx = addFx({ x: a.cx, y: a.cy - 40, z: 0, dur: 2.4, a, draw(c) { const A = this.a, k = this.t, al = k < 0.25 ? k / 0.25 : A.boomed ? Math.max(0, 1 - (k - A.boomT) * 3) : 1;
        drawSpr(c, fxTint('rune', AS_COL2), sx(A.cx), sy(A.cy, 0), 260, 96, { rot: k * 0.6, alpha: 0.7 * al });
        drawSpr(c, 'fudo', sx(A.cx), sy(A.cy - 30, 0), 0, 230 * Math.min(1, k * 2), { ay: 1, alpha: 0.85 * al, add: true });
        if (!A.boomed) for (let i = 0; i < 6; i++) { const ang = k * 3 + i * TAU / 6; drawSpr(c, fxTint('fireball', '#7ab0ff'), sx(A.cx + Math.cos(ang) * 120), sy(A.cy + Math.sin(ang) * 40, 40), 36, 0, { alpha: al }); } } });
    },
    onInput: (e, I) => { const a = e.act; if (!a.boomed && e.actT > 0.4 && I.buffered('jump')) { I.consume('jump'); asFudoBoom(e, lv); return true; } return false; },
    update: (e, dt) => { const a = e.act; a.tk = (a.tk || 0) + dt;
      if (!a.boomed && a.tk >= 0.25) { a.tk = 0; blast(e, a.cx, a.cy, 150, { dmg: skillDmg(0.3, 0.03, lv) * a.m, stun: 0.5, knock: 0, hs: 0.02, type: 'indep', col: AS_COL2, onHit: (x, t) => asRoot(t, x, 0.6) }, { zMax: 200 });
        for (const t of ents) if (hittable(e, t) && !t.boss && Math.hypot(t.x - a.cx, (t.y - a.cy) * 1.5) < 170) { t.x = damp(t.x, a.cx, 3, dt * 10); t.y = damp(t.y, a.cy, 3, dt * 10); } }
      if (!a.boomed && e.actT >= 1.9) asFudoBoom(e, lv); } }) });
function asFudoBoom(e, lv) { const a = e.act; a.boomed = true; a.boomT = e.actT; a.dur = Math.min(a.dur, e.actT + 0.5);
  cam.flash = 0.15; cam.flashCol = '#cfd8ff'; cam.shake = Math.max(cam.shake, 9); sfx.boom(1.3);
  for (let i = 0; i < 6; i++) { const ang = i * TAU / 6; fxSpr('explosion', a.cx + Math.cos(ang) * 110, a.cy + Math.sin(ang) * 36, 40, { w: 110, dur: 0.4, col: '#8ab0ff', grow: [0.5, 1.1] }); }
  fxBurst(a.cx, a.cy, 60, 280, AS_COL2);
  blast(e, a.cx, a.cy, 180, { dmg: skillDmg(6.0, 0.6, lv) * a.m, launch: 520, knock: 160, hs: 0.14, big: 1.9, type: 'indep', col: AS_COL2, downHit: true }, { zMax: 260 }); }

/* ---- 一觉：暗天波动眼（仅无尽波动中）。施放 1 秒（无敌），生成持续 40 秒的黑暗领域（换房间也不消失）：
   地裂·波动剑 → 波动剑·光翼、冰刃 → 波动眼·天照、爆炎 → 波动剑·闪枪、普攻第 3 击 → 波动剑·刺轮；时间到或再按一次，天穹之眼爆炸 ---- */
const asDomain = p => !!(p && p.buffs && p.buffs.as_domain);
defSkill('as_awaken', { name: '暗天波动眼', cls: 'sword', job: 'asura', lvReq: 21, maxLv: 3, mp: 150, cd: 135, pvp: 0.45, type: 'indep', awaken: true, col: '#6a4ad8',
  desc: '【觉醒 · 无尽波动中】开启暗天波动眼（施放时无敌），40 秒内展开黑暗领域：地裂·波动剑变为波动剑·光翼，冰刃·波动剑变为波动眼·天照，爆炎·波动剑变为波动剑·闪枪，普攻第 3 击放出波动剑·刺轮。时间到或再按一次技能键，天穹上睁开无数眼睛，一起爆炸。',
  pow: lv => skillDmg(20, 6, lv), ai: { kind: 'awaken', r: [0, 300], dy: 90 }, req: p => asAuraOn(p) || asDomain(p) ? true : '需要无尽波动',
  recast: { ok: p => asDomain(p), cd: 0.5, act: lv => ({ name: 'as_eyes', clip: 'asAura', dur: 0.5, noCounter: true, invul: [0, 0.5], onStart: e => asSkyEyes(e) }) },
  act: (lv) => ({ name: 'as_awaken', clip: 'asAura', dur: 1.0, noCounter: true, invul: [0, 1.0],
    onStart: e => { game.cutin = { t: 0, dur: 1.0, name: '暗天波动眼', who: cutinWho(e) }; game.timeStop = 0.9; sfx.awaken(); },
    events: [evAt(0.95, e => { e.buffs.as_domain = { t: 40, lv, evade: 0.1 }; cam.flash = 0.2; cam.flashCol = '#4a3a8a'; fxShock(e.x, e.y, 320, AS_COL); asDomainFx(e); })] }) });
function asDomainFx(p) {   // 黑暗领域：地面暗紫色光圈 + 飘动的波动（每帧只有 drawImage）
  if (p._asDom && fxList.includes(p._asDom)) return;
  p._asDom = addFx({ x: p.x, y: p.y - 60, z: 0, dur: 1e9, p, update() { const P = this.p; this.x = P.x; this.y = P.y - 60; if (P.dead || P.remove || !asDomain(P)) this.t = this.dur; },
    draw(c) { const P = this.p, T = game.t; drawSpr(c, fxTint('hexagram', '#5a3aa8'), sx(P.x), sy(P.y, 0), 420, 150, { rot: T * 0.3, alpha: 0.35, add: false }); drawSpr(c, fxTint('rune', AS_COL), sx(P.x), sy(P.y, 0), 300, 110, { rot: -T * 0.5, alpha: 0.35 }); } });
}
function asSkyEyes(e) {   // 天穹之眼：全屏爆炸（再按一次 / 时间到）
  const B = e.buffs.as_domain; if (!B) return; const lv = B.lv || 1; delete e.buffs.as_domain;
  cam.flash = 0.35; cam.flashCol = '#d8c8ff'; cam.shake = 12; sfx.boom(1.3); sfx.iai();
  for (let i = 0; i < 14; i++) game.after(i * 0.04, () => { const x = cam.x + rnd(40, WW - 40), y = rnd(20, DEPTH - 20); fxSpr('rune', x, y, rnd(160, 260), { w: 70, dur: 0.6, col: '#e0d0ff', grow: [0.3, 1.2] }); fxSpr('burst', x, y, 20, { w: 120, dur: 0.4, col: AS_COL }); });
  for (const t of ents) if (hittable(e, t) && Math.abs(t.x - e.x) < WW) applyHit(e, t, { dmg: skillDmg(20, 6, lv), launch: 480, knock: 100, hs: 0.2, big: 2, critBonus: 0.2, downHit: true, sure: true, type: 'indep', col: AS_COL }, { proj: true });
}
// 领域中的变形技能（不进技能树，等级沿用原技能）
defSkill('as_wing', { name: '波动剑·光翼', cls: 'sword', job: 'asura', lvReq: 21, mp: 20, cd: 1.2, type: 'indep', col: '#c0b0ff', hidden: true,
  desc: '暗天波动眼中的地裂·波动剑：放出交叉的光翼剑气，范围很大。', pow: lv => skillDmg(3.0, 0.3, lv), ai: { kind: 'proj', r: [0, 300], dy: 40 },
  act: (lv) => ({ name: 'as_wing', clip: 'asEvil', dur: 0.4, noCounter: true, links: swordAttackIds(), linkFrom: 0.2,
    events: [evAt(0.1, e => { sfx.iai(); for (const dy of [-26, 26]) projWave(e, { speed: 620, life: 0.55, h: 130, col: '#d8c8ff', hit: { dmg: skillDmg(1.5, 0.15, lv), launch: 300, knock: 120, hs: 0.06, type: 'indep' } }); })] }) });
defSkill('as_amaterasu', { name: '波动眼·天照', cls: 'sword', job: 'asura', lvReq: 21, mp: 25, cd: 2, type: 'indep', col: '#a0d0ff', hidden: true,
  desc: '暗天波动眼中的冰刃·波动剑：地面突刺并把敌人拉近，生成 1 个波动印。', pow: lv => skillDmg(4.0, 0.4, lv), ai: { kind: 'proj', r: [0, 280], dy: 30 },
  act: (lv) => ({ name: 'as_amaterasu', clip: 'asPlant', dur: 0.5, noCounter: true,
    events: [evAt(0.12, e => { asMarkAdd(e, 1); sfx.boom(0.6); for (let i = 0; i < 6; i++) game.after(i * 0.03, () => { const x = e.x + e.face * (60 + i * 40); fxSpr('pillar', x, e.y, 0, { h: 120, dur: 0.35, ay: 1, col: '#c8d8ff', grow: [0.2, 1] });
      blast(e, x, e.y, 36, { dmg: skillDmg(0.66, 0.066, lv), launch: 260, knock: -140, hs: 0.04, type: 'indep', col: '#c8d8ff' }, { zMax: 140 }); }); })] }) });
defSkill('as_spear', { name: '波动剑·闪枪', cls: 'sword', job: 'asura', lvReq: 21, mp: 30, cd: 4.9, type: 'indep', col: '#e0c0ff', hidden: true,
  desc: '暗天波动眼中的爆炎·波动剑：在前方敌人身后生成长枪向前穿刺，生成 1 个波动印。', pow: lv => skillDmg(5.0, 0.5, lv), ai: { kind: 'proj', r: [0, 320], dy: 30 },
  act: (lv) => ({ name: 'as_spear', clip: 'asBurst', dur: 0.55, noCounter: true,
    events: [evAt(0.14, e => { asMarkAdd(e, 1); const t = aimAhead(e, 200, 360), x = t.x + e.face * 60; sfx.iai(); cam.shake = Math.max(cam.shake, 4);
      fxBeam(x, t.y, 60, 260, -e.face, { col: '#e0c8ff', w: 30, dur: 0.35 });
      for (let k = 0; k < 3; k++) blast(e, x - e.face * (50 + k * 80), t.y, 55, { dmg: skillDmg(1.7, 0.17, lv), knock: -200, launch: 260, hs: 0.08, big: 1.4, type: 'indep', col: '#e0c8ff', radial: false }, { zMax: 160 }); })] }) });
// 领域中的普攻第 3 击：刺轮（向前滚动的波动刺轮）
const SWORD_ACTS_AS = { ...SWORD_ACTS, atk3: { ...SWORD_ACTS.atk3, events: [...SWORD_ACTS.atk3.events, evAt(0.12, e => {
  spawnProj({ owner: e, x: e.x + e.face * 30, y: e.y, z: 20, vx: e.face * 360, face: e.face, life: 0.9, w: 30, d: 26, h: 60, pierce: true,
    hit: { dmg: 0.9, rep: 0.12, max: 5, stun: 0.3, knock: 20, hs: 0.02, type: 'indep', col: AS_COL },
    draw(c, pr) { drawSpr(c, fxTint('rune', AS_COL), sx(pr.x), sy(pr.y, pr.z + 20), 60, 0, { rot: pr.t * 14 * pr.face }); } }); })] } };
SWORD_ACT_PICK.push(p => jobOf(p) === 'asura' && asDomain(p) ? SWORD_ACTS_AS : null);
for (const [a0, b0] of [['wave', 'as_wing'], ['as_ice', 'as_amaterasu'], ['as_fire', 'as_spear']]) { const S = SKILLS[a0], m0 = S.morph; S.morph = p => (jobOf(p) === 'asura' && asDomain(p) ? b0 : m0 ? m0(p) : null); }

CLASSES.sword.jobs.asura = { art: 'job/asura', name: '阿修罗', role: '中近距离 · 波动', armor: 'plate', awaken: 'as_awaken', awakenName: '大暗黑天',
  desc: '舍弃鬼神之力、以双眼为代价掌握“波动”的剑士。积攒波动印，用波动剑、鬼印珠和不动明王阵掌控战场。',
  skills: ['as_mark', 'as_orb', 'as_sense', 'as_evil', 'as_evil_c', 'as_will', 'as_burst', 'as_aura', 'as_ice', 'as_fire', 'as_musou', 'as_array', 'as_fudo', 'as_awaken'] };
CLASSES.sword.cmds.push(['uu', 'as_mark', 'buff'], ['bff', 'as_orb'], ['ff', 'as_evil'], ['uu', 'as_burst'], ['ff', 'as_aura', 'buff'], ['fdf', 'as_ice'], ['bdf', 'as_fire'], ['du', 'as_musou'], ['udd', 'as_array'], ['udu', 'as_fudo'], ['uudd', 'as_awaken']);

// 无双波：记下裂缝位置（再按一次引爆用）；无尽波动：每秒耗 MP、每 0.5 秒伤害 + 挑衅；波动刻印：每 7 秒一个印；绝对感知：免疫失明
CLASSES.sword.passives.push(p => {
  if (jobOf(p) !== 'asura') { if (p.statusImmune && p.statusImmune._asura) p.statusImmune = null; return; }
  if (hasSkill(p, 'as_sense')) p.statusImmune = { blind: true, _asura: true };
  const D = p.buffs.as_domain; if (D) { asDomainFx(p); if (D.t <= 0.3) asSkyEyes(p); }
  const M = p.buffs.as_mark; if (M) { M.gen = (M.gen ?? 7) - 0.25; if (M.gen <= 0) { M.gen = 7; asMarkAdd(p, 1); } asFx(p); }
  const A = p.buffs.as_aura;
  if (A) { const cost = p.mpMax * 0.03 * 0.25; if (p.mp < cost) { delete p.buffs.as_aura; fxText('无尽波动解除', p.x, p.y, p.z + 20, { col: '#ccc', size: 10 }); }
    else { p.mp -= cost; A.tick = (A.tick || 0) + 0.25; asFx(p);
      if (A.tick >= 0.5) { A.tick = 0; for (const t of ents) if (hittable(p, t) && Math.hypot(t.x - p.x, (t.y - p.y) * 1.5) < 150) {
        applyHit(p, t, { dmg: skillDmg(0.3, 0.03, A.lv || 1), sure: true, hs: 0, stun: 0.05, knock: 0, type: 'indep', col: AS_COL, asAura: true }, { proj: true });
        addStatus(t, 'taunt', 1, { src: p }); } } } }
});
// 背击回避（绝对感知）
SWORD_HOOKS.beforeHurt.push((p, a, h, opt) => {
  if (jobOf(p) !== 'asura' || !hasSkill(p, 'as_sense') || h.sure || h.grab) return null;
  const src = opt.src || a; if (!src || Math.sign(src.x - p.x || 1) === p.face || Math.random() >= 0.2) return null;
  fxText('MISS', p.x, p.y, p.z, { col: '#d8d8d8', size: 12, dur: 0.5 }); return { block: true };
});
SWORD_HOOKS.onHurt.push(p => { if (jobOf(p) === 'asura') asWill(p); });
// 普攻 / 上挑附带波动剑气（波动刻印开启时，普攻最后一击和上挑）
SWORD_HOOKS.onHit.push((p, t, h, dmg, act) => {
  if (jobOf(p) !== 'asura' || !asOn(p) || !act || h.asAura || h.asWave) return;
  if ((act.basic && !act.next && !act.chain) || act.skill === 'upslash') { if (p._asWaveT === game.t) return; p._asWaveT = game.t;
    projWave(p, { speed: 460, life: 0.4, h: 70, col: AS_COL, hit: { dmg: skillDmg(0.6, 0.06, skLv(p, 'as_mark')), knock: 80, stun: 0.3, type: 'indep', asWave: true } }); }
});
// X 形眼罩：阿修罗玩家的脸部配件（外观层按头部锚点叠加，和时装眼镜同一套坐标；戴着阿修罗眼罩时不再画时装眼镜）。
// lookFromEquip 是 content/avatar/looks.js 里的函数声明（整段脚本开始时就已提升），这里包一层；AVATAR_ACC 在调用时才读取。
const AS_EYES = { img: 'asura_face', face: 1, pos: { sword: [9, 25, 0, 0.66], 'sword@': [9, 25, 0, 0.66] } };
if (typeof lookFromEquip === 'function') {
  const lf0 = lookFromEquip;
  lookFromEquip = function (cls, eq, prefer) {
    const L = lf0(cls, eq, prefer);
    if (cls === 'sword' && !prefer && typeof game !== 'undefined' && game.job === 'asura' && typeof inv !== 'undefined' && eq === inv.equip && typeof AVATAR_ACC !== 'undefined') {   // 只给当前玩家自己（选角列表里的其他角色不受影响）
      AVATAR_ACC.job_asura_eyes ??= AS_EYES;
      L.acc = (L.acc || []).filter(k => !(AVATAR_ACC[k] && AVATAR_ACC[k].face)).concat('job_asura_eyes');
    }
    return L;
  };
}
bus.on('jobChange', () => { const m = game.player && game.player.model, av = m && m.av; if (av) av.own = null; });   // 转职后外观层重新取一次（戴上眼罩）
swordFinalize();
