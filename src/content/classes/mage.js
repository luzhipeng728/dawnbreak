/* =====================================================================
   31. 职业：魔法师（女）—— 按国服现版对齐（docs/SKILLS_OFFICIAL_mage.md 第 2 节）
   普攻：3 段挥杖（第 3 下重击）；跑攻扫杖；空中挥杖（女法本体不发魔法球、不骑扫把）
   基础技能：魔法星弹、天击、龙牙、魔法护盾、杰克爆弹、光电鳗、契约召唤：赫德尔、别过来!、冰霜雪人、暗影夜猫、鞭挞、
            替身草人、落花掌、驱散魔法、空中施放：杰克爆弹、魔法秀（战斗法师学不了其中 9 个：S.excl）
   转职：元素师 mage_elemental.js、战斗法师 mage_battle.js
   ===================================================================== */
const PAL_MAGE = { skin: '#f6d8c4', hair: '#7a4ac8', eye: '#e0a030', coat: '#4a2a7a', coat2: '#2e1a52', trim: '#e8c86a', scarf: '#e85a8a', pants: '#2a2040', boot: '#4a2a3a', glove: '#f6d8c4', belt: '#6a3a5a', blade: '#cfd8e6', glow: '#ff9af0', orb: '#ff6ad0', hat: '#3a2266' };
sfx.zap = function () { this.tone('sawtooth', 1800, 300, 0.12, 0.06); this.noise('highpass', 4000, 1500, 0.12, 0.22, 0.8); };
sfx.ice = function () { this.tone('sine', 2400, 1800, 0.18, 0.08); this.tone('sine', 3300, 2600, 0.14, 0.05, { delay: 0.03 }); this.noise('highpass', 5000, 3000, 0.1, 0.12, 1); };
sfx.magic = function () { this.tone('triangle', 660, 1320, 0.14, 0.08); this.tone('sine', 990, 1980, 0.12, 0.05, { delay: 0.02 }); };
/* ---- 骨骼姿势（兜底） ---- */
POSE.mCast = P(POSE.idle, { torso: -4, head: 2, uaF: 100, faF: 10, wF: -60, uaB: -20, faB: 40 });
POSE.mCastUp = P(POSE.idle, { torso: 6, head: -10, uaF: 170, faF: 10, wF: -20, uaB: 120, faB: 30 });
POSE.mCastDown = P(POSE.idle, { torso: -28, head: 18, uaF: 60, faF: 10, wF: -120, uaB: 40, faB: 40, thF: 40, shF: -40, thB: -30, shB: -20 });
POSE.mChan = P(POSE.idle, { torso: -2, uaF: 95, faF: 20, wF: -40, uaB: 88, faB: 22 });
POSE.mIdle = P(POSE.idle, { uaF: 18, faF: 52, wF: 22 });
POSE.mIdle2 = P(POSE.mIdle, { torso: -9, head: 8, uaF: 20, faF: 55 });
CLIPS.mage = { ...HUMAN_CLIPS,
  idle: { dur: 1.2, loop: true, fps: 8, keys: [k(0, POSE.mIdle, 'smooth'), k(0.6, POSE.mIdle2, 'smooth')] },
  mcast: { dur: 0.45, fps: 20, keys: [k(0, POSE.mCastUp, 'hold'), k(0.12, POSE.mCast, 'out'), k(0.3, POSE.mCast), k(0.45, POSE.idle)] },
  mup: { dur: 0.6, fps: 16, keys: [k(0, POSE.idle), k(0.1, POSE.mCastUp, 'out'), k(0.6, POSE.mCastUp)] },
  mdown: { dur: 0.6, fps: 16, keys: [k(0, POSE.mCastUp, 'hold'), k(0.18, POSE.mCastDown, 'out'), k(0.6, POSE.mCastDown)] },
  mchan: { dur: 0.3, loop: true, fps: 10, keys: [k(0, POSE.mChan), k(0.15, P(POSE.mChan, { uaF: 100, uaB: 92 }))] },
  mjatk: { dur: 0.3, fps: 20, keys: [k(0, P(POSE.jumpUp, { uaF: 160, wF: -20 }), 'hold'), k(0.08, P(POSE.jumpFall, { uaF: 50, faF: 0, wF: -90, torso: -16 }))] },
};
/* ---- 魔法弹（魔法星弹 / 空中杰克等共用）：pierceP = 每次命中后继续穿透的概率 ---- */
function magicOrb(e, o = {}) {
  sfx.magic();
  const col = o.col || '#ff7ae0', sp = o.speed || 520, dn = o.down, img = fxTint(o.img || 'orb', col), sz = o.size || 34;
  return spawnProj({ owner: e, x: e.x + e.face * 30, y: e.y, z: e.z + (dn ? 60 : 62), vx: e.face * sp * (dn ? 0.7 : 1), vz: dn ? -sp * 0.7 : 0, vy: o.vy || 0, face: e.face, life: o.life || 0.9, w: 9 * sz / 34, d: 14, h: 16 * sz / 34,
    pierce: !!o.pierceP, pierceP: o.pierceP || 0,
    hit: { dmg: o.dmg || 1.4, stun: 0.35, knock: 90, airLift: 180, hs: 0.05, snd: 'fire', col, type: 'mag', elem: o.elem },
    home: o.home, steer: o.steer, onHitT(pr) { if (pr.pierce && Math.random() > pr.pierceP) pr.t = pr.life; },
    update(pr, dt) {
      if (pr.z <= 0 && pr.vz < 0) pr.t = pr.life;
      if (pr.steer && e.pad) pr.vy = damp(pr.vy, e.pad.dy() * 220, 8, dt);
      if (pr.home) { const best = nearestFoe(e, 400, t => (t.x - pr.x) * pr.face > 0); if (best) pr.vy = damp(pr.vy, clamp((best.y - pr.y) * 4, -260, 260), 6, dt); }
      if (Math.random() < 0.6) addFx({ x: pr.x, y: pr.y + 0.3, z: pr.z + 6, dur: 0.22, draw(c) { const k = this.t / this.dur; drawSpr(c, img, sx(this.x), sy(this.y, this.z), 16 * (1 - k), 16 * (1 - k), { alpha: 0.6 * (1 - k) }); } });
    },
    onEnd(pr) { if (o.burst) areaHit(e, pr.x, pr.y, o.burst, Math.max(0, pr.z - 30), { dmg: (o.dmg || 1.4) * (o.burstMul ?? 0.5), knock: 60, airLift: 120, hs: 0.03, col, type: 'mag', elem: o.elem }); fxBurst(pr.x, pr.y, pr.z + 6, 60 * sz / 34, col); },
    draw(c, pr) { drawSpr(c, img, sx(pr.x), sy(pr.y, pr.z + 6), sz, sz, { rot: pr.t * 8 }); } });
}
/* ---- 地面法阵（召唤阵 / 驱散等）：和 fxSpr 同样的参数，但平躺在地面上转（drawSpr ground） ---- */
function fxSigil(name, x, y, z, o = {}) {
  const img = o.col ? fxTint(name, o.col) : IMG['fx/' + name], g = o.grow || [1, 1];
  return addFx({ x, y: y - 1, z, dur: o.dur || 0.4, draw(c) { const k = this.t / this.dur, s = lerp(g[0], g[1], easeOut(k)), w = (o.w || 100) * s;
    const a = (o.alpha ?? 1) * (k < 0.08 ? k / 0.08 : k > 0.6 ? 1 - (k - 0.6) / 0.4 : 1);
    drawSpr(c, img, sx(this.x), sy(y, this.z), w, w * GR, { ground: true, rot: (o.rot || 0) + (o.spin ?? 1.2) * this.t, alpha: a, add: o.add !== false }); } });
}
/* ---- 蓄气：PvE 只放大范围、决斗场才加伤害（官方 2017 年以后的规则）；学了移动施法（元素师）可以边蓄边走、蓄满后按住保持、带进下一个房间；
   蓄气中双击方向可以冲刺；魔法秀 / 魔法记忆（BUFF 字段 chargeCut）缩短蓄气时间；basic = 四个基础元素技能（魔法记忆额外缩短） ---- */
const chargeCut = (p, basic) => clamp(buffVal(p, 'chargeCut') + (basic ? buffVal(p, 'chargeCutB') : 0), 0, 0.95);
// 移动施法：蓄满后按住可以一直保持满蓄边走边带着（hold），走进下一个房间也不会丢（keepRoom，换房时调 onRoom 重新瞄准）
function mCharge(p, max, col, o = {}) {
  const clip = o.clip || 'mchan', mv = !!p && typeof hasSkill === 'function' && hasSkill(p, 'el_movecast');
  return { at: o.at ?? 0.06, max: Math.max(0.04, max * (1 - chargeCut(p, o.basic))), min: 0, dmg: game.pvp ? (o.pvp ?? 0.4) : 0, clip, hold: mv, keepRoom: mv, onRoom: o.onRoom,
    update: (e, dt) => { if (Math.random() < 0.4) fxCharge(e, col); mageChargeMove(e, clip); if (o.update) o.update(e, dt); } };
}
function mageChargeMove(e, clip) {
  if (!e.pad || typeof hasSkill !== 'function' || !hasSkill(e, 'el_movecast')) return;
  const dx = e.pad.dx(), dy = e.pad.dy(), run = !!e.pad.runDir && dx === e.pad.runDir, sp = (run ? e.runSpeed || 290 : e.speed || 160) * (0.98 + 0.02 * skLv(e, 'el_movecast'));   // 双击方向 = 蓄气中冲刺
  if (dx || dy) { const l = Math.hypot(dx, dy * 0.7) || 1, ck = run ? 'run' : 'walk'; e.vx = dx / l * sp; e.vy = dy / l * sp * 0.7; if (dx) e.face = dx; if (e.clipName !== ck) e.play(ck); }
  else { e.vx = e.vy = 0; if (e.clipName !== clip) e.play(clip); }
}
const MAGE_ACTS = {
  atk1: { name: 'atk1', clip: 'atk1', dur: 0.36, basic: true, speed: 'aspd', chain: [0.14, 0.36], next: 'atk2', move: [[0.03, 0.08, 90]],
    hits: [HB(0.07, 0.12, [0, 62, 26, 18, 100], 0.8, { stun: 0.34, knock: 50, hs: 0.05, snd: 'blunt', type: 'phys' })], events: [slashAt(0.06, { a0: -2.2, a1: 0.6, r: 44, w: 8, off: [10, 56], squash: 0.7 })] },
  atk2: { name: 'atk2', clip: 'atk2', dur: 0.38, basic: true, speed: 'aspd', chain: [0.15, 0.38], next: 'atk3', move: [[0.03, 0.08, 80]],
    hits: [HB(0.07, 0.12, [0, 62, 26, 18, 110], 0.85, { stun: 0.36, knock: 50, hs: 0.05, snd: 'blunt', type: 'phys' })], events: [slashAt(0.06, { a0: 1.0, a1: -2.0, r: 44, w: 8, off: [10, 56], squash: 0.8 })] },
  // 第 3 下：双手挥杖重击，击退（官方女法普攻是 3 段近战，不发魔法球）
  atk3: { name: 'atk3', clip: 'atk3', dur: 0.46, basic: true, speed: 'aspd', move: [[0.04, 0.12, 120]],
    hits: [HB(0.12, 0.18, [0, 72, 28, 10, 115], 1.15, { stun: 0.42, knock: 230, heavy: true, hs: 0.07, snd: 'blunt', type: 'phys', last: true, shake: 1.5 })],
    events: [slashAt(0.11, { a0: -2.5, a1: 0.8, r: 54, w: 12, off: [10, 58], heavy: true })] },
  // 跑攻：扫杖挑空；打空时“哎哟”一声向前扑倒（官方女法彩蛋，战斗法师没有——战法有自己的跑攻）
  dash: { name: 'dash', clip: 'dash', dur: 0.45, basic: true, speed: 'aspd', move: [[0, 0.24, 380]], noCounter: true,
    hits: [HB(0.05, 0.24, [0, 60, 26, 10, 90], 1.1, { launch: 220, knock: 90, hs: 0.06, snd: 'blunt', type: 'phys' })], events: [slashAt(0.05, { a0: -2.6, a1: 1.0, r: 50, w: 10, off: [10, 40] })],
    onEnd: (e, cut) => { if (!cut && !e.dead && e.grounded && e.hitsDone.size === 0 && jobOf(e) !== 'battlemage') e.doAct(MAGE_TRIP); } },
  // 空中挥杖：向前下方扫，托住浮空的敌人
  jatk: { name: 'jatk', clip: 'mjatk', dur: 0.32, basic: true, speed: 'aspd', airOnly: true, lowGrav: 0.75,
    hits: [HB(0.07, 0.15, [0, 60, 24, -40, 80], 0.8, { stun: 0.34, knock: 60, airLift: 170, hs: 0.05, snd: 'blunt', type: 'phys' })],
    events: [slashAt(0.06, { a0: -1.9, a1: 1.3, r: 46, w: 9, off: [8, 36] })] },
  back: BACKSTEP,
};
const MAGE_TRIP = { name: 'mg_trip', clip: 'down', dur: 0.5, noCounter: true, move: [[0, 0.12, 170]],
  events: [evAt(0.01, e => { fxText('哎哟！', e.x, e.y, e.z + 70, { col: '#ffd0e0', size: 12, dur: 0.6 }); fxDust(e.x + e.face * 20, e.y, 3, 5, '#c8b8a0'); sfx.thud(); }), evAt(0.28, e => e.play('getup', true))] };
const NO_BM = ['battlemage'];   // 战斗法师学不了的基础技能（官方 2024 重做后）
/* ---- 基础技能 ---- */
defSkill('mg_orb', { name: '魔法星弹', cls: 'mage', lvReq: 1, mp: 6, cd: 0.5, type: 'mag', elem: 'light', icon: 'mg_orb', col: '#b04ad0', cast: true,
  desc: '射出星形魔法弹，飞行中可以用 ↑↓ 调整轨迹，有轻微追踪；命中后有几率继续穿透。', pow: lv => skillDmg(1.1, 0.11, lv), cmdNote: '快捷栏', ai: { kind: 'proj', r: [0, 460], dy: 30 },
  infoExtra: lv => [['穿透几率', pct(Math.min(0.95, 0.7 + 0.025 * (lv - 1)))]],
  act: (lv) => ({ name: 'mg_orb', clip: 'mcast', dur: 0.36, cancelFrom: 0.2,
    events: [evAt(0.1, e => magicOrb(e, { dmg: skillDmg(1.1, 0.11, lv), col: '#ffe070', size: 30, speed: 600, life: 0.9, steer: true, home: true, elem: 'light', pierceP: Math.min(0.95, 0.7 + 0.025 * (lv - 1)) }))] }) });
defSkill('mg_sky', { name: '天击', cls: 'mage', lvReq: 1, mp: 10, cd: 2, type: 'phys', col: '#5a8ae0',
  desc: '挥杖向上猛击把敌人打上天。施放时按住 ↑ 或 ↓ 会先向该方向侧滑再攻击。', pow: lv => skillDmg(1.8, 0.18, lv), ai: { kind: 'launch', r: [0, 64], dy: 20 },
  act: (lv) => ({ name: 'mg_sky', clip: 'sky', dur: 0.48, cancelFrom: 0.28,
    onStart: e => { const dy = e.pad ? e.pad.dy() : 0; if (dy) e.act.move = [[0, 0.1, 0, undefined, dy * 420]]; },
    hits: [HB(0.12, 0.2, [0, 66, 28, 0, 130], skillDmg(1.8, 0.18, lv), { launch: 540 + lv * 6, knock: 30, hs: 0.08, snd: 'blunt', shake: 2, big: 1.2, chaser: 'light' })],
    events: [slashAt(0.11, { a0: 1.4, a1: -1.9, r: 56, w: 12, off: [10, 50], col: '#e0c0ff' })], onEnd: e => { e.vy = 0; } }) });
defSkill('mg_fang', { name: '龙牙', cls: 'mage', lvReq: 5, mp: 12, cd: 2, type: 'phys', col: '#c0c8e0',
  desc: '挥杖向前长距离直刺，命中的敌人陷入长时间僵直；命中后可以立即接天击、落花掌。', pow: lv => skillDmg(1.5, 0.15, lv), ai: { kind: 'poke', r: [0, 100], dy: 20 },
  act: (lv, p) => ({ name: 'mg_fang', clip: 'fang', dur: 0.46, cancelFrom: 0.2, move: [[0.08, 0.16, 300]], links: p && jobOf(p) === 'battlemage' && typeof BM_BODY !== 'undefined' ? BM_BODY : ['mg_sky', 'mg_palm'], hitCancel: true,
    hits: [HB(0.12, 0.2, [0, 100, 22, 30, 90], skillDmg(1.5, 0.15, lv), { stun: 1.0, knock: 30, hs: 0.08, snd: 'stab', chaser: 'ice' })],
    events: [evAt(0.11, e => { sfx.swing(true); fxStreak({ x: e.x + e.face * 10, y: e.y, z: e.z + 56, face: e.face, len: 110, w: 10, col: '#dfe8ff', dur: 0.16 }); })] }) });
// 魔法护盾（现版）：开关型防御 BUFF（旧版“伤害改扣 MP”已在韩服 2019 年删除）
defSkill('mg_shield', { name: '魔法护盾', cls: 'mage', lvReq: 5, mp: 30, cd: 5, type: 'mag', buff: true, col: '#3a8ad8', cmdNote: undefined,
  desc: '【开关】全身罩上一层魔力薄膜，提高物理与魔法防御（受到的伤害降低）。再按一次关闭。', infoExtra: lv => [['受到伤害', '-' + pct(0.05 + 0.01 * lv)]], ai: { kind: 'buff' },
  act: (lv) => ({ name: 'mg_shield', clip: 'cheer', dur: 0.4, noCounter: true, onStart: e => { if (toggleBuff(e, 'mg_shield', 1e9, { taken: -(0.05 + 0.01 * lv) })) { sfx.buff(); fxAura(e, '#6ab0ff'); } } }) });
// 杰克爆弹：发射瞬间锁定方向后直线飞行（飞行中对纵深有中等追踪），碰到敌人小范围爆炸；蓄气只放大南瓜和射程
function jackBomb(e, lv, k, air) {
  sfx.swing(false);
  const tgt = aimAhead(e, 300, 560, 120), dxl = tgt.t ? tgt.x - e.x : e.face * 300, dyl = tgt.t ? tgt.y - e.y : 0, L = Math.hypot(dxl, dyl) || 1, sp = 520;
  const range = 545 * (1 + k * 0.8), sz = 30 * (1 + k * 0.6), img = IMG['fx/jack'] ? 'jack' : 'fireball';
  return spawnProj({ owner: e, x: e.x + e.face * 26, y: e.y, z: e.z + (air ? 50 : 58), vx: air ? e.face * sp * 0.75 : dxl / L * sp, vy: air ? 0 : dyl / L * sp * 0.6, vz: air ? -sp * 0.6 : 0,
    face: e.face, life: range / sp, w: 10 * (1 + k * 0.6), d: 14, h: 18 * (1 + k * 0.6), pierce: false,
    hit: { dmg: skillDmg(0.5, 0.05, lv), stun: 0.3, knock: 60, hs: 0.04, type: 'mag', elem: 'fire', col: '#ffb060', snd: 'fire' },
    update(pr, dt) { if (pr.z <= 0 && pr.vz < 0) pr.t = pr.life;
      if (!air) { const t = nearestFoe(e, 520, q => (q.x - pr.x) * Math.sign(pr.vx || pr.face) > 0); if (t) pr.vy = damp(pr.vy, clamp((t.y - pr.y) * 3, -200, 200), 3.5, dt); }   // 飞行中中等追踪（只追纵深）
      if (Math.random() < 0.4) addFx({ x: pr.x, y: pr.y + 0.3, z: pr.z + 8, dur: 0.25, draw(c) { const q = this.t / this.dur; drawSpr(c, fxTint('orb', '#ff9a40'), sx(this.x), sy(this.y, this.z), 12 * (1 - q), 0, { alpha: 0.6 * (1 - q) }); } }); },
    onEnd(pr) { sfx.boom(0.25 + k * 0.2); fxBurst(pr.x, pr.y, Math.max(10, pr.z), 80 * (1 + k * 0.5), '#ffb060');
      blast(e, pr.x, pr.y, 48 * (1 + k * 0.5), { dmg: skillDmg(1.1, 0.11, lv), launch: 260, knock: 70, hs: 0.06, snd: 'fire', col: '#ffb060', elem: 'fire', type: 'mag' }, { zMax: Math.max(40, pr.z + 40) }); },
    draw(c, pr) { drawSpr(c, img, sx(pr.x), sy(pr.y, pr.z + 6), sz, 0, { add: false, rot: Math.sin(pr.t * 14) * 0.2, flip: pr.face < 0 }); } });
}
defSkill('mg_jack', { name: '杰克爆弹', cls: 'mage', lvReq: 5, mp: 12, cd: 1, type: 'mag', elem: 'fire', col: '#e07a2a', cast: true, excl: NO_BM,
  airIf: p => hasSkill(p, 'mg_jackair') && (p._jackAir || 0) < 2,
  desc: '向前方的敌人射出燃烧的南瓜灯（发射瞬间锁定方向），碰到敌人小范围爆炸。按住技能键蓄气（最长 0.6 秒）让南瓜变大、飞得更远。学会“空中施放”后跳跃中也能放。', pow: lv => skillDmg(1.6, 0.16, lv), ai: { kind: 'proj', r: [40, 520], dy: 40 },
  act: (lv, p) => {
    if (p && p.z > 2) return { name: 'mg_jack', clip: 'mjatk', dur: 0.34, airOnly: true, lowGrav: 0.4, cancelFrom: 0.2,
      onStart: e => { e._jackAir = (e._jackAir || 0) + 1; }, events: [evAt(0.08, e => { jackBomb(e, lv, 0, true); e.vz = Math.max(e.vz, 150); })] };
    return { name: 'mg_jack', clip: 'jack', dur: 0.5, cancelFrom: 0.34, charge: mCharge(p, 0.6, '#ffb060', { at: 0.1, clip: 'jackHold', basic: true }),
      events: [evAt(0.2, e => jackBomb(e, lv, e.act.chargeK || 0))] };
  } });
defSkill('mg_jackair', { name: '空中施放：杰克爆弹', cls: 'mage', lvReq: 15, maxLv: 1, passive: true, type: 'mag', elem: 'fire', col: '#c05a2a', icon: 'mg_jack', excl: NO_BM,
  desc: '【被动】跳跃中可以施放杰克爆弹：斜向下射出，后坐力让自己略微上浮；空中不能蓄气，每次跳跃最多 2 发。' });
// 光电鳗：3 只发光鳗鱼绕施放点旋转并逐渐向外扩散，持续 5 秒以上；可以叠放多组；蓄气（下蹲）变大、持续更久
defSkill('mg_eel', { name: '光电鳗', cls: 'mage', lvReq: 5, mp: 18, cd: 2, type: 'mag', elem: 'light', col: '#e0d02a', cast: true, excl: NO_BM,
  desc: '召出 3 只光电鳗，环绕施放位置旋转并逐渐向外扩散，持续 5 秒，碰到的敌人受到光属性伤害并硬直。可以叠放多组。蓄气（最长 0.6 秒）变大、持续更久。', pow: lv => skillDmg(2.6, 0.26, lv), ai: { kind: 'aoe', r: [0, 160], dy: 60 },
  act: (lv, p) => ({ name: 'mg_eel', clip: 'eel', dur: 0.45, cancelFrom: 0.32, charge: mCharge(p, 0.6, '#fff38a', { at: 0.06, clip: 'charge', basic: true }),
    events: [evAt(0.14, e => { sfx.zap(); const k = e.act.chargeK || 0, cx = e.x + e.face * 20, cy = e.y, life = 5 + k * 2, sc = 1 + k * 0.35;
      for (let i = 0; i < 3; i++) { const a0 = i * TAU / 3;
        spawnProj({ owner: e, x: cx, y: cy, z: 36, face: e.face, life, w: 14 * sc, d: 14 * sc, h: 40 * sc, pierce: true,
          hit: { dmg: skillDmg(0.22, 0.022, lv), stun: 0.3, knock: 20, airLift: 110, hs: 0.02, rep: 0.35, col: '#fff6a0', elem: 'light', type: 'mag', snd: 'crit' },
          update(pr) { const u = pr.t / pr.life, r = 26 + u * 170 * sc, a = a0 + pr.t * (5.5 - u * 2.5); pr.x = cx + Math.cos(a) * r; pr.y = clamp(cy + Math.sin(a) * r * 0.45, 4, DEPTH - 4); },
          draw(c, pr) { const u = pr.t / pr.life; drawSpr(c, 'eel', sx(pr.x), sy(pr.y, pr.z), 40 * sc, 40 * sc, { rot: pr.t * 10, alpha: u > 0.85 ? (1 - u) / 0.15 : 1 }); } }); } })] }) });
// 契约召唤：赫德尔（召唤框架 follower；地下城里敌人打不到它；素材复用哥布林十夫长）
function hodorModel() {
  if (typeof SPR_DATA !== 'undefined' && SPR_DATA.goblinCaptain && IMG['spr/goblinCaptain/idle']) return new SpriteModel('goblinCaptain', { ...SPR_FALLBACK, cast: 'cast1', roar: 'cast2', crouch: 'low1' }, SPR_ANIMS.monster, { sat: 0.72, bright: 1.06 });
  return buildGoblin();
}
function hodorRock(s, t, n, bomb) {
  for (let i = 0; i < n; i++) game.after(i * 0.12, () => { if (s.gone) return;
    const tx = (t && !t.dead ? t.x : s.x + s.face * 200) + rnd(-20, 20) + (n > 3 ? (i - 2) * 26 : 0), ty = clamp((t && !t.dead ? t.y : s.y) + (n > 3 ? (i - 2) * 14 : rnd(-8, 8)), 6, DEPTH - 6);
    lobProj(s, tx, ty, 0.45, { img: bomb ? 'bomb' : 'rock', h: bomb ? 20 : 14, hit: { dmg: (bomb ? 0.15 : 0.45) * s.mul, stun: 0.25, knock: 60, hs: 0.04, snd: 'blunt' },
      onLand: pr => { if (bomb) hodorBomb(s, pr.x, pr.y); else fxDust(pr.x, pr.y, 3, 5, '#9a8a70'); } }); });
}
// 炸弹：落地后在地上停一会儿（引信闪烁）再小范围爆炸
function hodorBomb(s, x, y) {
  fxDust(x, y, 2, 4, '#9a8a70');
  addFx({ x, y, dur: 0.7, draw(c) { const k = this.t / this.dur; drawSpr(c, 'bomb', sx(x), sy(y, 8), 20, 20, { add: false }); if (Math.sin(this.t * (12 + k * 30)) > 0) drawSpr(c, fxTint('orb', '#ff6040'), sx(x + 4), sy(y, 20), 10, 10, { alpha: 0.9 }); } });
  game.after(0.7, () => { if (s.owner && s.owner.dead) return; sfx.boom(0.35); fxBurst(x, y, 10, 110, '#ffb060'); blast(s, x, y, 60, { dmg: 1.1 * s.mul, launch: 300, knock: 80, hs: 0.06, snd: 'fire', col: '#ffb060' }); });
}
defSummon('hodor', { kind: 'follower', name: '机甲赫德尔', bundle: 'goblinCaptain', model: () => hodorModel(), clips: BEAST_CLIPS, w: 12, d: 11, h: 76, scale: 1.02, speed: 150, runSpeed: 300, pref: 40, sight: 560,
  life: 200, max: 1, col: '#c8d0e0', tags: ['contract'],
  attacks: [
    { clip: 'club', range: [0, 64], dy: 18, cd: [0.9, 1.6], w: 3, act: { dur: 0.8, hits: [{ t0: 0.4, t1: 0.48, box: [0, 60, 22, 0, 80], dmg: 0.55, stun: 0.4, knock: 110, hs: 0.06, snd: 'blunt' }], events: [evAt(0.36, e => sfx.swing(true))] } },
    { clip: 'axe', range: [0, 70], dy: 18, cd: [6, 9], w: 1.2, act: { dur: 1.1, superArmor: true, hits: [{ t0: 0.6, t1: 0.7, box: [0, 70, 26, 0, 90], dmg: 1.3, stun: 0.6, knock: 200, hs: 0.1, snd: 'blunt', shake: 3, heavy: true, onHit: (a, t) => { if (Math.random() < 0.4) addStatus(t, 'stun', 1.0, { src: a.owner }); } }], events: [evAt(0.55, e => sfx.swing(true)), evAt(0.62, e => fxShock(e.x + e.face * 50, e.y, 90, '#e0d0a0'))] } },
    { clip: 'throw', range: [90, 360], dy: 60, cd: [2.4, 3.6], w: 2, act: { dur: 0.9, events: [evAt(0.45, e => hodorRock(e, summonTarget(e), Math.random() < 0.35 ? 3 : 1))] } },
    { clip: 'throw', range: [100, 360], dy: 80, cd: [8, 11], w: 1, act: { dur: 0.9, events: [evAt(0.45, e => hodorRock(e, summonTarget(e), Math.random() < 0.5 ? 5 : 1, Math.random() < 0.5))] } },
    // 自我加速：移速 + 攻速提高一段时间（官方基础招式）
    { clip: 'roar', range: [0, 420], dy: 160, cd: [14, 18], w: 1.5, cond: s => !s.buffs.haste, act: { dur: 0.6, events: [evAt(0.3, e => { e.buffs.haste = { t: 8, aspd: 0.25, mspd: 0.35 }; sfx.buff(); fxAura(e, '#ffe070', 0.6); fxText('加速！', e.x, e.y, e.z + 80, { col: '#ffe070', size: 10 }); })] } }],
});
defSkill('mg_hodor', { name: '契约召唤：赫德尔', cls: 'mage', lvReq: 5, mp: 40, cd: 20, type: 'mag', col: '#8a9a6a', cast: true, excl: NO_BM,
  desc: '召唤与你签订契约的机甲哥布林赫德尔协同作战，在场 200 秒。它会用棍棒击打、给自己加速、投掷石块（单发 / 三连投 / 扇形 5 连）和炸弹（落地后停一会儿再爆炸），偶尔使出带霸体的强力重击（可能眩晕敌人）。地下城里敌人打不到它。伤害按你的魔法攻击力计算。',
  pow: lv => skillDmg(0.55, 0.055, lv), infoExtra: lv => [['在场时间', '200 秒'], ['伤害倍率', pct(lvMul(lv, 0.1))]], ai: { kind: 'buff', summon: 'hodor' },
  act: (lv) => ({ name: 'mg_hodor', clip: 'summon', dur: 0.55, cancelFrom: 0.4, noCounter: true,
    events: [evAt(0.25, e => { sfx.magic(); const s = summon(e, 'hodor', { lv, mul: lvMul(lv, 0.1) }); if (s) { fxBurst(s.x, s.y, 30, 120, '#d8c0ff'); fxSigil('hexagram', s.x, s.y, 0, { w: 110, dur: 0.6, ay: 0.5, grow: [0.4, 1] }); } })] }) });
// 别过来!：把诅咒人偶贴到敌人身上定住它，自己背身抱头蹲下（人偶爆炸前无敌）；抓不住的敌人（霸体 / 领主）直接爆炸
function keepawayBlast(e, x, y, z, lv) {
  sfx.boom(0.6); cam.shake = Math.max(cam.shake, 3); fxBurst(x, y, z + 30, 130, '#c79aff'); fxShock(x, y, 90, '#c79aff');
  blast(e, x, y, 55, { dmg: skillDmg(2.4, 0.24, lv), launch: 260, knock: 140, hs: 0.1, big: 1.4, col: '#e0b0ff', elem: 'dark', type: 'mag', sure: true }, { zMax: 150 });
}
defSkill('mg_keepaway', { name: '别过来！', cls: 'mage', lvReq: 5, mp: 20, cd: 6, type: 'mag', elem: 'dark', col: '#6a3a8a', excl: NO_BM,
  desc: '往面前的敌人身上贴一个诅咒人偶把它定住，然后引爆。施放后背身抱头蹲下，人偶爆炸之前无敌。对霸体或无法抓取的敌人会直接爆炸。判定很窄。', pow: lv => skillDmg(2.4, 0.24, lv), ai: { kind: 'grab', r: [0, 60], dy: 16 },
  act: (lv) => ({ name: 'mg_keepaway', clip: 'cower', dur: 1.0, noCounter: true, invul: [0.08, 0.92],
    hits: [HB(0.03, 0.09, [0, 58, 16, 0, 110], 0.1, { grab: true, stun: 0.3, hs: 0.03, snd: 'blunt', type: 'mag' })],
    onGrab: (e, t) => { e.act.gx = t.x; e.act.gy = t.y; fxText('！', t.x, t.y, t.z + 20, { col: '#c79aff', size: 16 }); },
    hold: (e, t) => { const a = e.act; t.x = a.gx ?? t.x; t.y = a.gy ?? t.y; t.z = 0; },
    events: [evAt(0.1, e => { if (!e.grabbed) { const x = e.x + e.face * 46; keepawayBlast(e, x, e.y, 0, lv); e.act.dur = 0.45; } else sfx.magic(); }),
      evAt(0.85, e => { const t = e.grabbed; if (!t) return; keepawayBlast(e, t.x, t.y, t.z, lv); throwGrab(e, { dmg: 0.1, down: true, downLift: 200, knock: 140, hs: 0.04, type: 'mag', elem: 'dark' }); })],
    update: e => { const t = e.grabbed; if (t && Math.random() < 0.5) fxSpr('rune', t.x, t.y, t.z + 50, { w: 22, dur: 0.1, col: '#c79aff' }); } }) });
// 冰霜雪人：雪人头贴地弹跳前进，每弹一次就转向最近的敌人；按 ↑ 高抛、按 ↓ 贴地；满蓄时变成冰爆（100% 减速、几率冰冻）
defSkill('mg_snowman', { name: '冰霜雪人', cls: 'mage', lvReq: 10, mp: 14, cd: 1, type: 'mag', elem: 'ice', col: '#6ac0e8', cast: true, excl: NO_BM, pre: ['mg_jack'],
  desc: '甩出一颗雪人头，一路弹跳前进，每弹一次都会转向最近的敌人。施放时按 ↑ 高抛、按 ↓ 贴地弹跳。蓄满（0.5 秒）后变成寒冰爆炸，溅射周围敌人，100% 减速并有几率冰冻。', pow: lv => skillDmg(1.6, 0.16, lv), ai: { kind: 'proj', r: [0, 380], dy: 60 },
  act: (lv, p) => ({ name: 'mg_snowman', clip: 'cast3', dur: 0.45, cancelFrom: 0.32, charge: mCharge(p, 0.5, '#bfefff', { at: 0.08, clip: 'charge', basic: true }),
    events: [evAt(0.14, e => { sfx.ice(); const full = (e.act.chargeK || 0) > 0.95, dy = e.pad ? e.pad.dy() : 0, bv = dy < 0 ? 420 : dy > 0 ? 150 : 270, sp = dy < 0 ? 220 : dy > 0 ? 330 : 270;
      spawnProj({ owner: e, x: e.x + e.face * 30, y: e.y, z: 40, face: e.face, vx: e.face * sp, vz: bv * 0.6, grav: 1100, life: 2.2, w: 12, d: 14, h: 28, pierce: false, shadow: 8,
        hit: { dmg: skillDmg(1.6, 0.16, lv), stun: 0.35, knock: 60, hs: 0.05, elem: 'ice', type: 'mag', col: '#bfefff', onHit: (a, t) => { if (!full) addStatus(t, 'slow', 2, { src: a }); } },
        onGround(pr) { if (pr.vz >= 0) return; pr.z = 0.01; pr.vz = bv; sfx.ice(); fxDust(pr.x, pr.y, 2, 4, '#dff4ff');
          const t = nearestFoe(e, 460); if (t) { const dx = t.x - pr.x, dyy = t.y - pr.y, l = Math.hypot(dx, dyy * 1.5) || 1; pr.vx = dx / l * sp; pr.vy = dyy / l * sp * 0.6; if (Math.abs(pr.vx) > 5) pr.face = Math.sign(pr.vx); } },
        update(pr) { if (pr.z <= 0.02 && pr.vz < 0) { pr.z = 0.01; pr.onGround(pr); } },
        onEnd(pr) { if (full) { sfx.ice(); fxSpr('frost', pr.x, pr.y, 0, { w: 150, dur: 0.5, ay: 0.75, grow: [0.4, 1.1] });
          blast(e, pr.x, pr.y, 70, { dmg: skillDmg(0.8, 0.08, lv), launch: 200, knock: 60, hs: 0.06, elem: 'ice', type: 'mag', col: '#bfefff' }, { zMax: 100, status: 'slow', sdur: 3 });
          for (const t of ents) if (foe(e, t) && inGround(t, pr.x, pr.y, 70) && Math.random() < 0.35) addStatus(t, 'freeze', 1.2, { src: e }); } else fxBurst(pr.x, pr.y, pr.z + 20, 50, '#dff4ff'); },
        draw(c, pr) { drawSpr(c, 'snowman', sx(pr.x), sy(pr.y, pr.z) + 2, 0, full ? 40 : 32, { ay: 0.9, add: false, flip: pr.face < 0, rot: Math.sin(pr.t * 12) * 0.25 }); } }); })] }) });
// 暗影夜猫：向前扑出、穿透一切，然后飞回你“当前”的位置（你上下移动猫会跟着改道），一去一回最多打 2 下，回程必定背击
defSkill('mg_cat', { name: '暗影夜猫', cls: 'mage', lvReq: 10, mp: 14, cd: 1.2, type: 'mag', elem: 'dark', col: '#4a2a6a', cast: true, excl: NO_BM,
  desc: '放出一只暗影夜猫向前飞扑，穿透所有敌人，然后飞回你当前所在的位置（你移动时它会跟着改道），一去一回最多攻击同一敌人 2 次。蓄气（最长 0.6 秒）增加射程和体积。', pow: lv => skillDmg(1.5, 0.15, lv) * 2, ai: { kind: 'proj', r: [0, 240], dy: 20 },
  act: (lv, p) => ({ name: 'mg_cat', clip: 'cast3', dur: 0.4, cancelFrom: 0.28, charge: mCharge(p, 0.6, '#c79aff', { at: 0.06, clip: 'charge', basic: true }),
    events: [evAt(0.12, e => { sfx.magic(); const k = e.act.chargeK || 0, R = 240 * (1 + k * 0.4), sc = 1 + k * 0.3, x0 = e.x, dir = e.face;
      spawnProj({ owner: e, x: x0, y: e.y, z: 30, face: dir, life: 3, w: 20 * sc, d: 18 * sc, h: 40 * sc, pierce: true, back: false,
        hit: { dmg: skillDmg(1.5, 0.15, lv), stun: 0.4, knock: 60, airLift: 150, hs: 0.05, rep: 0.3, max: 2, elem: 'dark', type: 'mag', col: '#c79aff' },
        update(pr, dt) {
          if (!pr.back) { pr.x += dir * 620 * dt; if ((pr.x - x0) * dir >= R) { pr.back = true; pr.face = -dir; } }
          else { const dx = e.x - pr.x, dy = e.y - pr.y, l = Math.hypot(dx, dy) || 1; pr.x += dx / l * 640 * dt; pr.y += dy / l * 640 * dt; pr.face = Math.sign(dx) || pr.face; if (l < 24 || e.dead) pr.t = pr.life; }
          pr.z = 24 + Math.sin(pr.t * TAU * 2) * 8; },
        draw(c, pr) { const X = sx(pr.x), Y = sy(pr.y, pr.z); c.save(); c.translate(X, Y); c.scale(pr.face * sc, sc); c.globalCompositeOperation = 'lighter';
          drawSpr(c, 'darkorb', -6, -4, 44, 26, { alpha: 0.7 }); c.globalCompositeOperation = 'source-over'; c.fillStyle = '#1a0a26';
          c.beginPath(); c.ellipse(0, 0, 14, 8, 0, 0, TAU); c.fill(); c.beginPath(); c.arc(12, -6, 7, 0, TAU); c.fill(); c.beginPath(); c.moveTo(8, -12); c.lineTo(10, -18); c.lineTo(13, -12); c.moveTo(14, -12); c.lineTo(17, -18); c.lineTo(18, -10); c.fill();
          c.fillStyle = '#ffe070'; c.fillRect(14, -8, 2, 2); c.restore(); } }); })] }) });
// 鞭挞：向前挥出魔法鞭；打中敌人造成伤害，抽到自己的召唤兽让它攻击力 / 攻速 / 移速提高 20 秒（不会让召唤兽硬直）
defSkill('mg_whip', { name: '鞭挞', cls: 'mage', lvReq: 10, mp: 8, cd: 1, type: 'mag', col: '#8a3ab0', excl: NO_BM,
  desc: '向前挥出魔法长鞭造成伤害。抽到队友时队友移速提高 20 秒；抽到自己的召唤兽时，让它 20 秒内攻击力、攻击速度和移动速度提高（不会让召唤兽硬直）。召唤师学了“绝对支配”后范围扩大、增益持续 40 秒，并可再按一次追加上挑。', pow: lv => skillDmg(1.2, 0.12, lv),
  infoExtra: lv => [['召唤兽攻击力', '+4.5%'], ['召唤兽攻速', '+' + pct(0.017 * (1 + lv))], ['召唤兽移速', '+' + pct(0.009 + 0.024 * lv)]], ai: { kind: 'poke', r: [0, 150], dy: 16 },
  // 绝对支配（召唤师被动）：鞭挞键再按一次 = 上挑
  recast: { ok: p => p.st === 'act' && p.act && p.act.name === 'mg_whip' && whipDomin(p), cd: 0.3, mp: 0,
    act: (lv) => ({ name: 'mg_whipUp', clip: 'mup', dur: 0.42, cancelFrom: 0.3,
      hits: [HB(0.06, 0.13, [10, 230, 22, 0, 150], skillDmg(1.2, 0.12, lv), { launch: 330, knock: 20, stun: 0.4, hs: 0.05, snd: 'slash', type: 'mag', col: '#e0a0ff' })],
      events: [evAt(0.05, e => { sfx.swing(true); fxSlash({ x: e.x, y: e.y, z: e.z, face: e.face, col: '#d890ff', a0: 1.2, a1: -1.3, r: 150, w: 10, off: [8, 40], squash: 0.8, dur: 0.22 }); whipBuffSummons(e, lv); })] }) },
  act: (lv, p) => { const dom = whipDomin(p), L = dom ? 240 : 160, rv = p && jobOf(p) === 'summoner' && skLv(p, 'sm_reverse') > 0 ? 1.5 : 1;   // 逆月：蚀鞭
    return { name: 'mg_whip', clip: 'whip', dur: 0.4, cancelFrom: 0.24, links: dom ? ['mg_whip'] : undefined, linkFrom: 0.12,
      hits: [HB(0.08, 0.14, [10, L, 16, 20, 90], skillDmg(1.2, 0.12, lv) * rv, { stun: 0.3, knock: 40, hs: 0.04, snd: 'slash', type: 'mag', col: rv > 1 ? '#a060e0' : '#e0a0ff', elem: rv > 1 ? 'dark' : undefined })],
      events: [evAt(0.07, e => { sfx.swing(false); fxStreak({ x: e.x + e.face * 16, y: e.y, z: e.z + 60, face: e.face, len: L - 10, w: dom ? 7 : 5, col: '#d890ff', dur: 0.18 }); whipBuffSummons(e, lv); whipAllies(e, L); })] }; } });
// 抽到队友：队友移速提高 20 秒（组队中只发给鞭子范围内的队友）
function whipAllies(e, L) {
  if (typeof partyMates !== 'function' || e !== game.player) return;
  const to = partyMates().filter(g => !g.dead && !g.away && Math.abs(g.y - e.y) < 24 && (g.x - e.x) * e.face >= -10 && Math.abs(g.x - e.x) <= L).map(g => g.uid);
  if (to.length) partySend('mg_whip', { to }, e);
}
partyOn('mg_whip', (me, d) => { if (!Array.isArray(d.to) || typeof coop === 'undefined' || !d.to.includes(coop.me()) || me.dead) return;
  me.buffs.mg_whipAlly = { t: 20, mspd: 0.1, party: 1 }; if (typeof applyBuffs === 'function') applyBuffs(me); fxAura(me, '#e090ff', 0.5); });
function whipDomin(p) { return !!p && typeof jobOf === 'function' && jobOf(p) === 'summoner' && skLv(p, 'sm_domin') > 0; }
function whipBuffSummons(e, lv) {
  const dom = whipDomin(e), cx = e.x + e.face * (dom ? 125 : 85);
  for (const s of summonsIn(e, cx, e.y, dom ? 150 : 90)) if (s.kind === 'follower') { s.buffs.whip = { t: dom ? 40 : 20, atk: 0.045, aspd: 0.017 * (1 + lv), mspd: 0.009 + 0.024 * lv }; fxAura(s, '#e090ff', 0.5); }
}
// 替身草人：受击 / 倒地时施放（通用组的 whenHit 钩子），瞬移一段距离（默认向后，可用方向键选方向），之后 0.5 秒无敌；原地留下草人，捡到的人获得攻速 / 移速提升
defSummon('strawdoll', { kind: 'field', life: 10, max: 1, r: 20, tick: 0.1, keepRoom: false,
  onTick(s) { const o = s.owner; if (Math.hypot(o.x - s.x, (o.y - s.y) * 2) < 26 && o.z < 20) { o.buffs.mg_doll = { t: 10, aspd: 0.1, mspd: 0.1 }; fxText('攻速 / 移速提升', o.x, o.y, o.z + 20, { col: '#ffe070', size: 10 }); fxAura(o, '#ffe070', 0.5); dismissOne(s, 'cmd'); } },
  draw(c, s) { const X = sx(s.x), Y = sy(s.y, 0), bob = Math.sin(game.t * 4) * 1.5, a = s.life - s.lifeT < 2 ? 0.5 + 0.5 * Math.sin(game.t * 20) : 1; c.save(); c.globalAlpha = a; c.translate(X, Y - 2 + bob);
    c.fillStyle = '#c8a050'; c.strokeStyle = '#6a4a20'; c.lineWidth = 2; c.beginPath(); c.ellipse(0, -14, 7, 12, 0, 0, TAU); c.fill(); c.stroke(); c.beginPath(); c.arc(0, -30, 6, 0, TAU); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(-11, -18); c.lineTo(11, -18); c.stroke(); c.fillStyle = '#e05a4a'; c.fillRect(-3, -32, 2, 2); c.fillRect(2, -32, 2, 2); c.restore(); } });
defSkill('mg_phase', { noHitCheck: true, name: '替身草人', cls: 'mage', lvReq: 10, mp: 20, cd: 30, type: 'mag', col: '#b89a50', whenHit: p => !(typeof hasSkill === 'function' && hasSkill(p, 'bm_realphase')), cmdNote: '受击中 Space',
  desc: '只能在受击或倒地时施放（被抓取、冰冻、眩晕时不能用）：瞬间脱身，向后（或方向键指定的方向）瞬移一段距离，之后 0.5 秒无敌；原地留下一个草人，捡到后 10 秒内攻速、移速提高。', infoExtra: lv => [['冷却时间', Math.max(21, 31 - lv) + ' 秒']], ai: { kind: 'escape' },
  act: (lv) => ({ name: 'mg_phase', clip: 'jumpFall', dur: 0.3, noCounter: true, invul: [0, 0.3],
    onStart: e => { const x0 = e.x, y0 = e.y, dx = e.pad ? e.pad.dx() : 0, dy = e.pad ? e.pad.dy() : 0, dir = dx || (dy ? 0 : -e.face);
      const real = hasSkill(e, 'bm_realphase');   // 战斗法师：实战型替身草人（随时可放、冷却 −5 秒、不留草人，改为自己加速 5 秒）
      if (e.cool) e.cool.mg_phase = Math.max(21, 31 - lv) - (real ? 5 : 0);
      sfx.magic(); fxBurst(x0, y0, 50, 90, '#ffe070'); e.warp(x0 + dir * 170, y0 + dy * 60, 0); e.setState('act'); e.invul = Math.max(e.invul, 0.8); fxBurst(e.x, e.y, 50, 70, '#ffe070');
      if (real) { e.buffs.mg_doll = { t: 5, aspd: 0.1, mspd: 0.1 }; fxAura(e, '#ffe070', 0.5); } else summon(e, 'strawdoll', { x: x0, y: y0 }); } }) });
// 落花掌：突进一掌把敌人击飞，被击飞的敌人撞到其他敌人也造成伤害；可蓄气 0.3 秒，满蓄时霸体，把敌人撞到墙上会反弹并追加伤害
defSkill('mg_palm', { name: '落花掌', cls: 'mage', lvReq: 15, mp: 20, cd: 3, type: 'phys', col: '#e07ab0',
  desc: '向前突进一掌把敌人击飞，被击飞的敌人撞到其他敌人也会造成伤害。可蓄气（最长 0.3 秒）：蓄得越久突进越快越远，蓄满时带霸体，敌人撞到墙壁会反弹并受到追加伤害。出掌时按住后方向键则原地出掌。', pow: lv => skillDmg(2.4, 0.24, lv), ai: { kind: 'poke', r: [0, 70], dy: 20 },
  act: (lv, p) => ({ name: 'mg_palm', clip: 'palm', dur: 0.5, cancelFrom: 0.32, move: [[0.05, 0.13, 420]], charge: mCharge(p, 0.3, '#ffa0d0', { at: 0.02, clip: 'charge' }),
    // 蓄气越久突进越快越远；满蓄霸体；按住后方向键 = 原地出掌（不突进）
    update: e => { const a = e.act;
      if (a.chargeDone && !a._mv) { a._mv = true; const k = a.chargeK || 0; a.move = e.pad && e.pad.dx() === -e.face ? [] : [[0.05, 0.13 + k * 0.05, 420 * (1 + k * 0.5)]]; }
      if (a.chargeDone && (a.chargeK || 0) > 0.95 && !a._sa) { a._sa = true; a.superArmor = [a.charge.at, 0.4]; } },
    hits: [HB(0.05, 0.16, [-24, 70, 26, 20, 110], skillDmg(2.4, 0.24, lv), { down: true, downLift: 150, knock: 520, hs: 0.1, snd: 'blunt', shake: 3, big: 1.4, chaser: 'fire',
      onHit: (a, t) => { fxSpr('petal', t.x, t.y, t.z + 50, { w: 120, dur: 0.5, flip: a.face < 0, grow: [0.5, 1.2] });
        const pr = spawnProj({ owner: a, x: t.x, y: t.y, z: t.z, face: a.face, life: 0.5, w: 20, d: 16, h: 60, pierce: true,
          hit: { dmg: skillDmg(1.2, 0.12, lv), knock: 260, down: true, downLift: 120, hs: 0.06, snd: 'blunt', type: 'phys' }, update(q) { q.x = t.x; q.y = t.y; q.z = t.z; }, draw() { } });
        pr.hitMap.set(t.id, 0); pr.hitMap.set(-t.id, 99); pr.hit.max = 1;
        if (a.act && (a.act.chargeK || 0) > 0.95) palmWall(a, t, lv); } })],
    events: [evAt(0.09, e => sfx.swing(true))] }) });
// 满蓄落花掌：敌人被打到房间边缘时反弹并追加伤害
function palmWall(a, t, lv) {
  addFx({ x: t.x, y: t.y, dur: 1.2, done: false, update() { const R = game.room; this.y = t.y; if (this.done || !R || t.dead) return;
    if (t.x <= R.x0 + t.w + 3 || t.x >= R.x1 - t.w - 3) { this.done = true; cam.shake = Math.max(cam.shake, 5); sfx.boom(0.5); fxShock(t.x, t.y, 80, '#ffa0d0');
      applyHit(a, t, { dmg: skillDmg(1.2, 0.12, lv), knock: -Math.sign(t.vx || 1) * 180, launch: 260, hs: 0.1, snd: 'blunt', type: 'phys', sure: true, downHit: true }, { proj: true, src: { x: t.x + Math.sign(t.vx || 1) * 20, y: t.y, z: t.z, face: -Math.sign(t.vx || 1) } }); } }, draw() { } });
}
// 驱散魔法：以自身为中心 300px，驱散敌人身上的增益，降低敌人攻速 / 移速 / 施放速度；每驱散一个增益，自己的力量和智力提高
defSkill('mg_dispel', { noHitCheck: true, name: '驱散魔法', cls: 'mage', lvReq: 15, mp: 40, cd: 20, type: 'mag', col: '#5a6ad8', cast: true,
  desc: '以自身为中心展开驱散法阵（300px）：驱散范围内敌人身上的增益，并让它们减速 5 秒；每驱散一个增益，自己的攻击力提高（20 秒）。', infoExtra: lv => [['每个增益', '攻击力 +' + pct(0.02 + 0.002 * lv)]], ai: { kind: 'aoe', r: [0, 260], dy: 120 },
  act: (lv) => ({ name: 'mg_dispel', clip: 'dispel', dur: 0.9, cancelFrom: 0.7, noCounter: true,
    events: [evAt(0.45, e => { sfx.buff(); fxShock(e.x, e.y, 300, '#8a9aff'); fxSigil('hexagram', e.x, e.y, 0, { w: 300, dur: 0.7, ay: 0.5, grow: [0.3, 1], col: '#8a9aff' });
      let n = 0; for (const t of ents) if (foe(e, t) && inGround(t, e.x, e.y, 300)) {
        if (t.buffs) for (const k in t.buffs) { delete t.buffs[k]; n++; }
        if (t.enraged && t.speed && t.def_ && t.def_.speed) { t.speed = t.def_.speed; }
        addStatus(t, 'slow', 5, { src: e }); fxText('驱散', t.x, t.y, t.z + 20, { col: '#aab8ff', size: 10 }); }
      if (n) { e.buffs.mg_dispel = { t: 20, atk: Math.min(0.2, n * (0.02 + 0.002 * lv)) }; fxAura(e, '#aab8ff'); } })] }) });
// 魔法秀：20 秒内魔法技能冷却加快、施放更快、蓄气时间缩短（对物理技能、BUFF 和觉醒无效）
defSkill('mg_showtime', { name: '魔法秀', cls: 'mage', lvReq: 16, mp: 60, cd: 40, type: 'mag', buff: true, col: '#e05ab0', excl: ['battlemage', 'enchantress'],
  desc: '【BUFF】华丽的魔法表演：20 秒内施放速度提高、蓄气时间缩短，魔法技能的冷却加快（对物理技能、BUFF 技能和觉醒无效）。', ai: { kind: 'buff' },
  infoExtra: lv => [['施放速度', '+' + pct(0.05 + 0.01 * lv)], ['蓄气时间', '-' + pct(0.05 + 0.02 * lv)], ['魔法技能冷却', '-' + pct(Math.min(0.3, 0.02 * lv + 0.03))]],
  act: (lv) => ({ name: 'mg_showtime', clip: 'showtime', dur: 0.7, noCounter: true,
    onStart: e => { e.buffs.mg_showtime = { t: 20, cspd: 0.05 + 0.01 * lv, chargeCut: 0.05 + 0.02 * lv, showCd: Math.min(0.3, 0.02 * lv + 0.03) }; sfx.buff(); fxAura(e, '#ff9ae0', 1); for (let i = 0; i < 8; i++) fxCharge(e, pick(['#ff9ae0', '#fff38a', '#9fe6ff'])); } }) });
CLASSES.mage = { name: '魔法师', hp0: 1450, hpPer: 120, mp0: 1100, mpPer: 60, atk0: 500, atkPer: 60, str0: 5, strPer: 1.8, def0: 220, defPer: 22, crit: 0.07, speed: 160, runSpeed: 290,
  desc: '操纵火、冰、光、暗四种元素的魔法师，身板脆弱但 MP 充沛；转职后可以成为元素师或战斗法师。', model: () => buildSwordsman(PAL_MAGE, { weapon: 'staff', hair: 'long', hat: 'wizard', scarf: false, pauldron: false, coatTail: true }),
  acts: MAGE_ACTS, slashCol: '#e0a0ff', dmgType: 'mag', airMax: 1,
  skills: ['mg_orb', 'mg_sky', 'mg_fang', 'mg_shield', 'mg_jack', 'mg_eel', 'mg_hodor', 'mg_keepaway', 'mg_snowman', 'mg_cat', 'mg_whip', 'mg_phase', 'mg_palm', 'mg_dispel', 'mg_jackair', 'mg_showtime'],
  start: ['mg_orb', 'mg_sky'], bar: ['mg_orb', 'mg_sky', null, null, null, null, null, null, null, null, null, null],
  cmds: [['', 'mg_sky'], ['hold', 'mg_fang'], ['du', 'mg_shield', 'buff'], ['df', 'mg_jack'], ['du', 'mg_eel'], ['u', 'mg_hodor'], ['db', 'mg_keepaway'], ['d', 'mg_snowman'], ['bf', 'mg_cat'], ['fu', 'mg_whip'],
    ['', 'mg_phase', 'buff'], ['ff', 'mg_palm'], ['bu', 'mg_dispel'], ['uf', 'mg_showtime', 'buff']],
  jobs: {}, passives: [] };
// 基础被动：魔法秀加快魔法技能冷却（每 0.25 秒按比例多扣一段冷却）；空中杰克的次数落地重置
CLASSES.mage.passives.push(p => {
  if (p.z <= 0.01 && p._jackAir) p._jackAir = 0;
  const r = buffVal(p, 'showCd'); if (r > 0 && p.cool) for (const id in p.cool) { const S = SKILLS[id]; if (p.cool[id] > 0 && S && S.type === 'mag' && !S.buff && !S.awaken) p.cool[id] -= 0.25 * r / (1 - r); }
});
