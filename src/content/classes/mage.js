/* =====================================================================
   31. 职业：元素师（法杖）。X 两下杖击 + 第三下魔力弹、跑攻扫杖、空中向斜下抛魔力弹
   技能：魔力弹射 / 冰锥术（冰冻）/ 烈焰柱（灼烧）/ 雷光链（眩晕）/ 寒冰领域 / 元素共鸣 / 陨星召唤 / 风暴漩涡 / 虚空引力 / 觉醒·元素终焉
   ===================================================================== */
const PAL_MAGE = { skin: '#f6d8c4', hair: '#7a4ac8', eye: '#e0a030', coat: '#4a2a7a', coat2: '#2e1a52', trim: '#e8c86a', scarf: '#e85a8a', pants: '#2a2040', boot: '#4a2a3a', glove: '#f6d8c4', belt: '#6a3a5a', blade: '#cfd8e6', glow: '#ff9af0', orb: '#ff6ad0', hat: '#3a2266' };
sfx.zap = function () { this.tone('sawtooth', 1800, 300, 0.12, 0.06); this.noise('highpass', 4000, 1500, 0.12, 0.22, 0.8); };
sfx.ice = function () { this.tone('sine', 2400, 1800, 0.18, 0.08); this.tone('sine', 3300, 2600, 0.14, 0.05, { delay: 0.03 }); this.noise('highpass', 5000, 3000, 0.1, 0.12, 1); };
sfx.magic = function () { this.tone('triangle', 660, 1320, 0.14, 0.08); this.tone('sine', 990, 1980, 0.12, 0.05, { delay: 0.02 }); };
/* ---- 姿势与动画 ---- */
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
/* ---- 魔力弹 ---- */
function magicOrb(e, o = {}) {
  sfx.magic();
  const col = o.col || '#ff7ae0', sp = o.speed || 520, dn = o.down, img = fxTint('orb', col);
  spawnProj({ owner: e, x: e.x + e.face * 30, y: e.y, z: e.z + (dn ? 60 : 62), vx: e.face * sp * (dn ? 0.7 : 1), vz: dn ? -sp * 0.7 : 0, face: e.face, life: o.life || 0.9, w: 9, d: 14, h: 16, pierce: false,
    hit: { dmg: o.dmg || 1.4, stun: 0.35, knock: 90, airLift: 180, hs: 0.05, snd: 'fire', col },
    home: o.home, update(pr, dt) {
      if (pr.z <= 0 && pr.vz < 0) pr.t = pr.life;
      if (pr.home) { let best = null, bd = 400; for (const t of ents) if (t.team === 'e' && !t.dead && (t.x - pr.x) * pr.face > 0) { const d = Math.abs(t.x - pr.x) + Math.abs(t.y - pr.y); if (d < bd) { bd = d; best = t; } } if (best) pr.vy = damp(pr.vy, clamp((best.y - pr.y) * 4, -260, 260), 6, dt); }
      if (Math.random() < 0.7) addFx({ x: pr.x, y: pr.y + 0.3, z: pr.z + 6, dur: 0.22, draw(c) { const k = this.t / this.dur; drawSpr(c, img, sx(this.x), sy(this.y, this.z), 16 * (1 - k), 16 * (1 - k), { alpha: 0.6 * (1 - k) }); } });
    },
    onEnd(pr) { if (o.burst) areaHit(e, pr.x, pr.y, o.burst, Math.max(0, pr.z - 30), { dmg: (o.dmg || 1.4) * (o.burstMul ?? 0.5), knock: 60, airLift: 120, hs: 0.03, col }); fxBurst(pr.x, pr.y, pr.z + 6, 60, col); },
    draw(c, pr) { drawSpr(c, img, sx(pr.x), sy(pr.y, pr.z + 6), 34, 34, { rot: pr.t * 8 }); } });
}
const MAGE_ACTS = {
  atk1: { name: 'atk1', clip: 'atk1', dur: 0.36, chain: [0.14, 0.36], next: 'atk2', move: [[0.03, 0.08, 90]],
    hits: [{ t0: 0.07, t1: 0.12, box: [0, 62, 26, 18, 100], dmg: 0.8, stun: 0.34, knock: 50, hs: 0.05, snd: 'blunt' }], events: [slashAt(0.06, { a0: -2.2, a1: 0.6, r: 44, w: 8, off: [10, 56], squash: 0.7 })] },
  atk2: { name: 'atk2', clip: 'atk2', dur: 0.38, chain: [0.15, 0.38], next: 'atk3', move: [[0.03, 0.08, 80]],
    hits: [{ t0: 0.07, t1: 0.12, box: [0, 62, 26, 18, 110], dmg: 0.85, stun: 0.36, knock: 50, hs: 0.05, snd: 'blunt' }], events: [slashAt(0.06, { a0: 1.0, a1: -2.0, r: 44, w: 8, off: [10, 56], squash: 0.8 })] },
  atk3: { name: 'atk3', clip: 'mcast', dur: 0.45, events: [evAt(0.12, e => magicOrb(e, { dmg: 1.6, burst: 34 }))] },
  dash: { name: 'dash', clip: 'dash', dur: 0.45, move: [[0, 0.24, 380]], noCounter: true,
    hits: [{ t0: 0.05, t1: 0.24, box: [0, 60, 26, 10, 90], dmg: 1.1, launch: 220, knock: 90, hs: 0.06, snd: 'blunt' }], events: [slashAt(0.05, { a0: -2.6, a1: 1.0, r: 50, w: 10, off: [10, 40] })] },
  jatk: { name: 'jatk', clip: 'mjatk', dur: 0.32, airOnly: true, lowGrav: 0.7, events: [evAt(0.08, e => magicOrb(e, { down: true, dmg: 0.9, burst: 30 }))] },
  back: BACKSTEP,
};
/* ---- 技能 ---- */
SKILLS.mg_orb = { name: '魔力弹射', cls: 'mage', lvReq: 1, maxLv: 10, mp: 14, cd: 2.4, desc: '连续射出三发会自动追踪敌人的魔力弹。', col: '#b04ad0',
  drawIcon: (c) => { for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(18 + i * 14, 40 - i * 8, 7, 0, TAU); c.fill(); } },
  act: (lv) => ({ name: 'orb', clip: 'mcast', dur: 0.5, cancelFrom: 0.38, events: [0.08, 0.18, 0.28].map(t => evAt(t, e => magicOrb(e, { dmg: skillDmg(0.95, 0.1, lv), home: true, burst: 26, burstMul: 0.2 }))) }) };
SKILLS.mg_ice = { name: '冰锥术', cls: 'mage', lvReq: 1, maxLv: 10, mp: 24, cd: 5, desc: '射出贯穿的冰锥，命中的敌人会被冰冻。', col: '#3a9ad8',
  drawIcon: (c) => { c.beginPath(); c.moveTo(8, 40); c.lineTo(56, 30); c.lineTo(8, 22); c.closePath(); c.fill(); },
  act: (lv) => ({ name: 'ice', clip: 'mcast', dur: 0.5, cancelFrom: 0.36, events: [evAt(0.12, e => {
    sfx.ice();
    spawnProj({ owner: e, x: e.x + e.face * 30, y: e.y, z: e.z + 58, vx: e.face * 720, face: e.face, life: 0.65, w: 16, d: 14, h: 14, pierce: true,
      hit: { dmg: skillDmg(1.9, 0.19, lv), stun: 0.4, knock: 40, airLift: 160, hs: 0.06, snd: 'stab', col: '#bfefff', onHit: (a, t) => addStatus(t, 'freeze', 1.4 + lv * 0.06, { src: a }) },
      update(pr) { if (Math.random() < 0.6) addFx({ x: pr.x - pr.face * 14, y: pr.y + 0.3, z: pr.z + rnd(-4, 10), dur: 0.3, draw(c) { c.fillStyle = `rgba(220,245,255,${0.8 * (1 - this.t / this.dur)})`; c.fillRect(sx(this.x), sy(this.y, this.z), 2, 2); } }); },
      draw(c, pr) { drawSpr(c, 'icespike', sx(pr.x), sy(pr.y, pr.z + 7), 76, 0, { flip: pr.face < 0 }); } });
  })] }) };
SKILLS.mg_fire = { name: '烈焰柱', cls: 'mage', lvReq: 1, maxLv: 10, mp: 30, cd: 6, desc: '在前方最近的敌人脚下升起火柱，连续把敌人烧上天并使其灼烧。', col: '#d8502a',
  drawIcon: (c) => { c.beginPath(); c.moveTo(20, 58); c.quadraticCurveTo(10, 30, 30, 8); c.quadraticCurveTo(28, 30, 40, 26); c.quadraticCurveTo(54, 40, 44, 58); c.closePath(); c.fill(); },
  act: (lv) => ({ name: 'fire', clip: 'mdown', dur: 0.6, cancelFrom: 0.42, events: [evAt(0.18, e => firePillar(e, aimAhead(e, 150, 320), skillDmg(0.6, 0.06, lv)))] }) };
// 找前方最近的敌人（没有就取前方固定距离）
function aimAhead(e, def, range) {
  const t = ents.filter(o => o.team !== e.team && !o.dead && (o.x - e.x) * e.face > -10 && Math.abs(o.x - e.x) < range && Math.abs(o.y - e.y) < 90).sort((a, b) => Math.abs(a.x - e.x) - Math.abs(b.x - e.x))[0];
  return t ? { x: t.x, y: t.y } : { x: e.x + e.face * def, y: e.y };
}
function firePillar(e, at, dmg, visual) {
  if (!visual) { sfx.hit('fire', false); sfx.boom(0.4); }
  const draw = (c, X, Y, k) => { const a = k < 0.1 ? k / 0.1 : k > 0.75 ? (1 - k) / 0.25 : 1, grow = easeOut(Math.min(1, k * 5));
    drawSpr(c, 'shock', X, Y, 110, 0, { alpha: a * 0.7 }); drawSpr(c, 'pillar', X + Math.sin(game.t * 30) * 1.5, Y + 8, 0, 175 * grow, { ay: 1, alpha: a }); };
  if (visual) { addFx({ x: at.x, y: at.y + 1, dur: 0.85, draw(c) { draw(c, sx(this.x), sy(this.y, 0), this.t / this.dur); } }); return; }
  spawnProj({ owner: e, x: at.x, y: at.y, z: 0, face: e.face, life: 0.85, w: 26, d: 20, h: 150, pierce: true,
    hit: { dmg, stun: 0.3, launch: 300, knock: 10, hs: 0.03, rep: 0.2, snd: 'fire', col: '#ffb060', onHit: (a, t) => addStatus(t, 'burn', 3, { dps: a.atk * 0.1, src: a }) },
    draw(c, pr) { draw(c, sx(pr.x), sy(pr.y, 0), pr.t / pr.life); } });
}
SKILLS.mg_chain = { name: '雷光链', cls: 'mage', lvReq: 1, maxLv: 10, mp: 40, cd: 8, desc: '召唤落雷依次劈中前方最多 3 名敌人（每 3 级 +1），使其眩晕。', col: '#d8c82a',
  drawIcon: (c) => { c.beginPath(); c.moveTo(36, 4); c.lineTo(18, 34); c.lineTo(32, 34); c.lineTo(24, 60); c.lineTo(48, 26); c.lineTo(34, 26); c.lineTo(44, 4); c.closePath(); c.fill(); },
  act: (lv) => ({ name: 'chain', clip: 'mup', dur: 0.6, cancelFrom: 0.45, events: [evAt(0.14, e => {
    const n = 3 + Math.floor((lv - 1) / 3), list = ents.filter(t => hittable(e, t) && (t.x - e.x) * e.face > -30 && Math.abs(t.x - e.x) < 460).sort((a, b) => Math.abs(a.x - e.x) - Math.abs(b.x - e.x)).slice(0, n);
    if (!list.length) list.push({ x: e.x + e.face * 180, y: e.y, fake: true });
    list.forEach((t, i) => game.after(i * 0.09, () => { lightningStrike(t); sfx.zap(); if (!t.fake && hittable(e, t)) { applyHit(e, t, { dmg: skillDmg(2.1, 0.21, lv), stun: 0.5, launch: 200, knock: 20, hs: 0.07, snd: 'crit', col: '#fff6a0' }, { proj: true }); addStatus(t, 'stun', 1.0, { src: e }); } }));
  })] }) };
SKILLS.mg_nova = { name: '寒冰领域', cls: 'mage', lvReq: 2, maxLv: 10, mp: 36, cd: 9, desc: '以自身为中心释放寒气冲击，冰冻周围所有敌人。释放时霸体。', col: '#6ab8e8',
  drawIcon: (c) => { for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; c.save(); c.translate(32, 32); c.rotate(a); c.fillRect(-2, -26, 4, 22); c.fillRect(-7, -20, 14, 3); c.restore(); } },
  act: (lv) => ({ name: 'nova', clip: 'mdown', dur: 0.7, superArmor: true, noCounter: true, events: [evAt(0.2, e => {
    sfx.ice(); sfx.boom(0.5); cam.shake = Math.max(cam.shake, 4);
    addFx({ x: e.x, y: e.y + 1, z: 0, dur: 0.6, add: true, draw(c) { const k = this.t / this.dur, X = sx(this.x), Y = sy(this.y, 0); drawSpr(c, 'rune', X, Y, 280 * (0.5 + k * 0.5), 280 * GR * (0.5 + k * 0.5), { alpha: (1 - k) * 0.7 }); drawSpr(c, 'frost', X, Y, 300 * (0.4 + easeOut(k) * 0.7), 0, { ay: 0.75, alpha: 1 - k * k }); } });
    areaHit(e, e.x, e.y, 135, 0, { dmg: skillDmg(2.4, 0.24, lv), launch: 180, knock: 60, hs: 0.07, snd: 'stab', col: '#bfefff' }, { status: 'freeze', sdur: 1.6 + lv * 0.05, zMax: 200 });
  })] }) };
SKILLS.mg_buff = { name: '元素共鸣', cls: 'mage', lvReq: 3, maxLv: 10, mp: 40, cd: 30, buff: true, desc: '20 秒内攻击力提升，MP 恢复速度翻倍。', col: '#8a60e0',
  drawIcon: (c) => { c.beginPath(); c.arc(32, 32, 18, 0, TAU); c.stroke(); for (let i = 0; i < 3; i++) { const a = i / 3 * TAU - Math.PI / 2; c.beginPath(); c.arc(32 + Math.cos(a) * 18, 32 + Math.sin(a) * 18, 6, 0, TAU); c.fill(); } },
  act: (lv) => ({ name: 'mbuff', clip: 'mup', dur: 0.5, noCounter: true, onStart: e => { e.buffs = e.buffs || {}; e.buffs.mg_buff = { t: 20, atk: 0.1 + 0.018 * lv, mpr: 1 }; sfx.buff(); fxAura(e, '#c080ff'); } }) };
SKILLS.mg_meteor = { name: '陨星召唤', cls: 'mage', lvReq: 5, maxLv: 10, mp: 70, cd: 14, desc: '在前方召唤巨大的陨石坠落，砸倒范围内的敌人并使其灼烧。', col: '#c83a2a',
  drawIcon: (c) => { c.beginPath(); c.arc(38, 40, 14, 0, TAU); c.fill(); for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(28 - i * 4, 30 - i * 2); c.lineTo(8 - i * 2, 8 + i * 6); c.stroke(); } },
  act: (lv) => ({ name: 'meteor', clip: 'mup', dur: 0.8, superArmor: true, noCounter: true, events: [evAt(0.15, e => {
    const at = aimAhead(e, 200, 380); sfx.charge();
    telegraph({ x: at.x, y: at.y, r: 95, dur: 0.75, kind: 'hex', col: '#ff9a3a', friendly: true, fire: (g) => { meteorImpact(g, 1); areaHit(e, g.x, g.y, 95, 0, { dmg: skillDmg(6, 0.6, lv), down: true, knock: 200, hs: 0.12, big: 1.8, snd: 'fire', col: '#ffb060' }, { status: 'burn', sdur: 4, dps: 0.15, zMax: 240 }); } });
    addFx({ x: at.x, y: at.y + 2, z: 0, dur: 0.75, add: true, draw(c) { const k = this.t / this.dur; drawSpr(c, 'meteor', sx(this.x) - 220 * (1 - k), sy(this.y, 0) - 480 * (1 - k), 120, 0, { ax: 0.8, ay: 0.82 }); } });
  })] }) };
SKILLS.mg_tornado = { name: '风暴漩涡', cls: 'mage', lvReq: 5, maxLv: 10, mp: 45, cd: 9, desc: '放出缓慢前进的龙卷风，把沿途的敌人卷进来持续浮空。', col: '#3aa080',
  drawIcon: (c) => { for (let i = 0; i < 5; i++) { c.beginPath(); c.ellipse(32 + i * 2, 12 + i * 10, 22 - i * 4, 4, 0, 0, TAU); c.stroke(); } },
  act: (lv) => ({ name: 'tornado', clip: 'mcast', dur: 0.5, cancelFrom: 0.36, events: [evAt(0.12, e => {
    sfx.swing(true);
    spawnProj({ owner: e, x: e.x + e.face * 60, y: e.y, z: 0, vx: e.face * 150, face: e.face, life: 2.2, w: 30, d: 24, h: 140, pierce: true,
      hit: { dmg: skillDmg(0.42, 0.045, lv), stun: 0.3, airLift: 240, launch: 240, knock: 5, hs: 0.02, rep: 0.15, col: '#bfffe0' },
      update(pr, dt) { for (const t of ents) if (t.team === 'e' && !t.dead && Math.abs(t.x - pr.x) < 90 && Math.abs(t.y - pr.y) < 50 && !(t.boss && t.act)) { t.x = damp(t.x, pr.x, 3, dt); t.y = damp(t.y, pr.y, 3, dt); } if (Math.random() < 0.08) sfx.swing(false); },
      draw(c, pr) { const k = pr.t / pr.life, a = k > 0.85 ? (1 - k) / 0.15 : Math.min(1, k * 8); drawSpr(c, 'tornado', sx(pr.x) + Math.sin(game.t * 9) * 4, sy(pr.y, 0) + 8, 0, 155, { ay: 1, alpha: a, flip: Math.floor(game.t * 14) % 2 === 1 }); } });
  })] }) };
SKILLS.mg_hole = { name: '虚空引力', cls: 'mage', lvReq: 7, maxLv: 10, mp: 60, cd: 12, desc: '在前方制造一个黑洞，把周围的敌人吸到中心持续伤害，最后爆发。', col: '#4a2a6a',
  drawIcon: (c) => { c.fillStyle = '#1a0a2a'; c.beginPath(); c.arc(32, 32, 12, 0, TAU); c.fill(); c.strokeStyle = '#fff'; for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(32, 32, 16 + i * 6, i, i + 3.6); c.stroke(); } },
  act: (lv) => ({ name: 'hole', clip: 'mchan', dur: 0.7, superArmor: true, noCounter: true, events: [evAt(0.15, e => {
    const at = aimAhead(e, 190, 300); sfx.charge();
    spawnProj({ owner: e, x: at.x, y: at.y, z: 30, face: e.face, life: 1.7, w: 40, d: 30, h: 90, pierce: true,
      hit: { dmg: skillDmg(0.35, 0.04, lv), stun: 0.35, knock: 0, airLift: 60, hs: 0.02, rep: 0.2, col: '#d0a0ff' },
      update(pr, dt) { for (const t of ents) if (t.team === 'e' && !t.dead && Math.hypot(t.x - pr.x, t.y - pr.y) < 230 && !(t.boss && t.act && t.act.superArmor)) { t.x = damp(t.x, pr.x, 2.2, dt); t.y = damp(t.y, pr.y, 2.2, dt); } },
      onEnd(pr) { sfx.boom(0.9); cam.shake = Math.max(cam.shake, 6); areaHit(e, pr.x, pr.y, 110, 0, { dmg: skillDmg(3.2, 0.32, lv), launch: 380, knock: 160, hs: 0.1, big: 1.6, col: '#e0b0ff' }, { zMax: 220 }); (fxBurst(pr.x, pr.y, 40, 200, '#c080ff'), fxShock(pr.x, pr.y, 140, '#c080ff')); },
      draw(c, pr) { const X = sx(pr.x), Y = sy(pr.y, pr.z), k = pr.t / pr.life, s = Math.min(1, k * 6) * (k > 0.92 ? (1 - k) / 0.08 : 1); c.fillStyle = 'rgba(10,2,20,.92)'; c.beginPath(); c.arc(X, Y, Math.max(0.5, 16 * s), 0, TAU); c.fill(); drawSpr(c, 'vortex', X, Y, 120 * s, 120 * s, { rot: -game.t * 5 }); } });
  })] }) };
SKILLS.mg_awaken = { name: '元素终焉', cls: 'mage', lvReq: 8, maxLv: 3, mp: 150, cd: 60, awaken: true, desc: '【觉醒】火、冰、雷三种元素依次覆盖整个画面，最后以纯粹的魔力爆发收尾。', col: '#ffd23a',
  drawIcon: (c) => { c.fillStyle = '#ff7a3a'; c.beginPath(); c.arc(22, 24, 10, 0, TAU); c.fill(); c.fillStyle = '#8ae0ff'; c.beginPath(); c.arc(42, 24, 10, 0, TAU); c.fill(); c.fillStyle = '#fff070'; c.beginPath(); c.arc(32, 42, 10, 0, TAU); c.fill(); },
  act: (lv) => ({ name: 'mawaken', clip: 'mchan', dur: 2.6, superArmor: true, noCounter: true,
    onStart: e => { e.invul = 2.8; game.cutin = { t: 0, dur: 1.0, name: '元素终焉', who: e }; game.timeStop = 0.9; sfx.awaken(); },
    events: [evAt(0.95, e => screenBlast(e, lv, 'fire')), evAt(1.35, e => screenBlast(e, lv, 'ice')), evAt(1.75, e => screenBlast(e, lv, 'bolt')), evAt(2.2, e => screenBlast(e, lv, 'final'))] }) };
function screenBlast(e, lv, kind) {
  const onScreen = ents.filter(t => hittable(e, t) && Math.abs(t.x - (cam.x + WW / 2)) < WW / 2 + 20);
  if (kind === 'fire') { sfx.boom(0.8); for (let i = 0; i < 7; i++) firePillar(e, { x: cam.x + 70 + i * 135, y: rnd(30, DEPTH - 30) }, 0, true); for (const t of onScreen) applyHit(e, t, { dmg: skillDmg(3, 1, lv), launch: 260, hs: 0.06, col: '#ffb060', snd: 'fire' }, { proj: true }); }
  if (kind === 'ice') { sfx.ice(); cam.flash = 0.15; cam.flashCol = '#dff6ff'; for (const t of onScreen) { applyHit(e, t, { dmg: skillDmg(3, 1, lv), airLift: 200, hs: 0.06, col: '#bfefff', snd: 'stab' }, { proj: true }); addStatus(t, 'freeze', 0.6); } }
  if (kind === 'bolt') { for (const t of onScreen) { lightningStrike(t); applyHit(e, t, { dmg: skillDmg(3, 1, lv), airLift: 200, hs: 0.06, col: '#fff6a0', snd: 'crit' }, { proj: true }); } sfx.zap(); }
  if (kind === 'final') { cam.flash = 0.35; cam.flashCol = '#ffe8ff'; cam.shake = 12; sfx.boom(1.3); for (const t of onScreen) { meteorImpact(t, 0.4); applyHit(e, t, { dmg: skillDmg(5, 1.5, lv), down: true, knock: 240, hs: 0.15, big: 2, col: '#ffd0ff', critBonus: 0.2 }, { proj: true }); } }
}
CLASSES.mage = { name: '魔法师', hp0: 1450, hpPer: 120, mp0: 1100, mpPer: 60, atk0: 500, atkPer: 60, str0: 5, strPer: 1.8, def0: 220, defPer: 22, crit: 0.07, speed: 160, runSpeed: 290,
  desc: '操控火、冰、雷与虚空的法师，控场能力极强，身板脆弱但 MP 充沛。', model: () => buildSwordsman(PAL_MAGE, { weapon: 'staff', hair: 'long', hat: 'wizard', scarf: false, pauldron: false, coatTail: true }),
  acts: MAGE_ACTS, slashCol: '#e0a0ff',
  skills: ['mg_orb', 'mg_ice', 'mg_fire', 'mg_chain', 'mg_nova', 'mg_buff', 'mg_meteor', 'mg_tornado', 'mg_hole', 'mg_awaken'],
  start: ['mg_orb', 'mg_ice', 'mg_fire', 'mg_chain'], bar: ['mg_orb', 'mg_ice', 'mg_fire', 'mg_chain', null, null, null, null, null, null, null, null],
  cmds: [['df', 'mg_ice'], ['fd', 'mg_fire'], ['bf', 'mg_chain'], ['dd', 'mg_nova'], ['fu', 'mg_tornado'], ['u', 'mg_meteor'], ['hold', 'mg_hole'], ['', 'mg_orb']] };
