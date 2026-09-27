/* =====================================================================
   31. 职业：魔法师（女）—— 普攻两下杖击 + 第三下魔力弹、跑攻扫杖、空中向斜下抛魔力弹；
   基础技能：魔法星弹、天击、杰克爆弹、光电鳗、龙牙、魔法护盾、暗影夜猫、冰霜雪人、落花掌
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
/* ---- 魔力弹 ---- */
function magicOrb(e, o = {}) {
  sfx.magic();
  const col = o.col || '#ff7ae0', sp = o.speed || 520, dn = o.down, img = fxTint('orb', col), sz = o.size || 34;
  return spawnProj({ owner: e, x: e.x + e.face * 30, y: e.y, z: e.z + (dn ? 60 : 62), vx: e.face * sp * (dn ? 0.7 : 1), vz: dn ? -sp * 0.7 : 0, vy: o.vy || 0, face: e.face, life: o.life || 0.9, w: 9 * sz / 34, d: 14, h: 16 * sz / 34, pierce: false,
    hit: { dmg: o.dmg || 1.4, stun: 0.35, knock: 90, airLift: 180, hs: 0.05, snd: 'fire', col, type: 'mag', elem: o.elem },
    home: o.home, steer: o.steer, update(pr, dt) {
      if (pr.z <= 0 && pr.vz < 0) pr.t = pr.life;
      if (pr.steer && e.pad) pr.vy = damp(pr.vy, e.pad.dy() * 220, 8, dt);
      if (pr.home) { const best = nearestFoe(e, 400, t => (t.x - pr.x) * pr.face > 0); if (best) pr.vy = damp(pr.vy, clamp((best.y - pr.y) * 4, -260, 260), 6, dt); }
      if (Math.random() < 0.6) addFx({ x: pr.x, y: pr.y + 0.3, z: pr.z + 6, dur: 0.22, draw(c) { const k = this.t / this.dur; drawSpr(c, img, sx(this.x), sy(this.y, this.z), 16 * (1 - k), 16 * (1 - k), { alpha: 0.6 * (1 - k) }); } });
    },
    onEnd(pr) { if (o.burst) areaHit(e, pr.x, pr.y, o.burst, Math.max(0, pr.z - 30), { dmg: (o.dmg || 1.4) * (o.burstMul ?? 0.5), knock: 60, airLift: 120, hs: 0.03, col, type: 'mag', elem: o.elem }); fxBurst(pr.x, pr.y, pr.z + 6, 60 * sz / 34, col); },
    draw(c, pr) { drawSpr(c, img, sx(pr.x), sy(pr.y, pr.z + 6), sz, sz, { rot: pr.t * 8 }); } });
}
const MAGE_ACTS = {
  atk1: { name: 'atk1', clip: 'atk1', dur: 0.36, basic: true, speed: 'aspd', chain: [0.14, 0.36], next: 'atk2', move: [[0.03, 0.08, 90]],
    hits: [HB(0.07, 0.12, [0, 62, 26, 18, 100], 0.8, { stun: 0.34, knock: 50, hs: 0.05, snd: 'blunt', type: 'phys' })], events: [slashAt(0.06, { a0: -2.2, a1: 0.6, r: 44, w: 8, off: [10, 56], squash: 0.7 })] },
  atk2: { name: 'atk2', clip: 'atk2', dur: 0.38, basic: true, speed: 'aspd', chain: [0.15, 0.38], next: 'atk3', move: [[0.03, 0.08, 80]],
    hits: [HB(0.07, 0.12, [0, 62, 26, 18, 110], 0.85, { stun: 0.36, knock: 50, hs: 0.05, snd: 'blunt', type: 'phys', last: true })], events: [slashAt(0.06, { a0: 1.0, a1: -2.0, r: 44, w: 8, off: [10, 56], squash: 0.8 })] },
  atk3: { name: 'atk3', clip: 'mcast', dur: 0.45, basic: true, speed: 'cspd', events: [evAt(0.12, e => magicOrb(e, { dmg: 1.6, burst: 34 }))] },
  dash: { name: 'dash', clip: 'dash', dur: 0.45, basic: true, speed: 'aspd', move: [[0, 0.24, 380]], noCounter: true,
    hits: [HB(0.05, 0.24, [0, 60, 26, 10, 90], 1.1, { launch: 220, knock: 90, hs: 0.06, snd: 'blunt', type: 'phys' })], events: [slashAt(0.05, { a0: -2.6, a1: 1.0, r: 50, w: 10, off: [10, 40] })] },
  jatk: { name: 'jatk', clip: 'mjatk', dur: 0.32, basic: true, speed: 'cspd', airOnly: true, lowGrav: 0.7, events: [evAt(0.08, e => magicOrb(e, { down: true, dmg: 0.9, burst: 30 }))] },
  back: BACKSTEP,
};
/* ---- 基础技能 ---- */
defSkill('mg_orb', { name: '魔法星弹', cls: 'mage', lvReq: 1, mp: 6, cd: 0.8, type: 'mag', icon: 'mg_orb', col: '#b04ad0', cast: true,
  desc: '射出魔法星弹，飞行中可用 ↑↓ 调整轨迹。按住技能键蓄力（最长 0.5 秒）射出更大的星弹。', pow: lv => skillDmg(1.4, 0.14, lv), cmdNote: '快捷栏', ai: { kind: 'proj', r: [0, 420], dy: 30 },
  act: (lv) => ({ name: 'mg_orb', clip: 'mcast', dur: 0.4, cancelFrom: 0.22,
    charge: { at: 0.06, max: 0.5, min: 0, dmg: 1.0, update: e => { if (Math.random() < 0.5) fxCharge(e, '#ff9af0'); } },
    events: [evAt(0.1, e => { const k = e.act.chargeK || 0; magicOrb(e, { dmg: skillDmg(1.4, 0.14, lv), size: 30 + k * 26, speed: 560, burst: 26 + k * 30, burstMul: 0.3 + k * 0.4, steer: true, life: 1.0 }); })] }) });
defSkill('mg_sky', { name: '天击', cls: 'mage', lvReq: 1, mp: 10, cd: 2, type: 'phys', col: '#5a8ae0',
  desc: '挥杖向上猛击把敌人打上天。施放时按住 ↑ 或 ↓ 会先向该方向侧滑再攻击。发动瞬间霸体。', pow: lv => skillDmg(1.8, 0.18, lv), ai: { kind: 'launch', r: [0, 64], dy: 20 },
  act: (lv) => ({ name: 'mg_sky', clip: 'sky', dur: 0.48, cancelFrom: 0.28, superArmor: [0, 0.1],
    onStart: e => { const dy = e.pad ? e.pad.dy() : 0; if (dy) e.act.move = [[0, 0.1, 0, undefined, dy * 420]]; },
    hits: [HB(0.12, 0.2, [0, 66, 28, 0, 130], skillDmg(1.8, 0.18, lv), { launch: 540 + lv * 6, knock: 30, hs: 0.08, snd: 'blunt', shake: 2, big: 1.2, chaser: 'light' })],
    events: [slashAt(0.11, { a0: 1.4, a1: -1.9, r: 56, w: 12, off: [10, 50], col: '#e0c0ff' })], onEnd: e => { e.vy = 0; } }) });
defSkill('mg_jack', { name: '杰克爆弹', cls: 'mage', lvReq: 5, mp: 15, cd: 3, type: 'mag', elem: 'fire', col: '#e07a2a', cast: true,
  desc: '投出一颗南瓜爆弹，落地爆炸把敌人炸上天。按住技能键蓄力（最长 0.6 秒）扩大爆炸。', pow: lv => skillDmg(2.4, 0.24, lv), ai: { kind: 'proj', r: [60, 260], dy: 40 },
  act: (lv) => ({ name: 'mg_jack', clip: 'jack', dur: 0.55, cancelFrom: 0.36,
    charge: { at: 0.1, max: 0.6, min: 0, dmg: 0.8, clip: 'jackHold', update: e => { if (Math.random() < 0.4) fxCharge(e, '#ffb060'); } },
    events: [evAt(0.2, e => { sfx.swing(false); const at = aimAhead(e, 170, 280), k = e.act.chargeK || 0, m = e.act.dmgMul;
      lobProj(e, at.x, at.y, 0.5, { img: 'jack', h: 20 + k * 10, onLand: pr => { meteorImpact(pr, 0.5 + k * 0.3); blast(e, pr.x, pr.y, 60 + k * 30, { dmg: skillDmg(2.4, 0.24, lv) * m, launch: 380, knock: 70, hs: 0.08, snd: 'fire', col: '#ffb060', elem: 'fire', type: 'mag' }); } }); })] }) });
defSkill('mg_eel', { name: '光电鳗', cls: 'mage', lvReq: 5, mp: 25, cd: 6, type: 'mag', elem: 'light', col: '#e0d02a', cast: true,
  desc: '召唤 3 颗雷球环绕自身旋转并向外扩散，多段攻击周围的敌人。', pow: lv => skillDmg(3.0, 0.3, lv), ai: { kind: 'aoe', r: [0, 140], dy: 60 },
  act: (lv) => ({ name: 'mg_eel', clip: 'eel', dur: 0.5, cancelFrom: 0.36,
    events: [evAt(0.14, e => { sfx.zap(); for (let i = 0; i < 3; i++) { const a0 = i * TAU / 3, cx = e.x, cy = e.y;
      spawnProj({ owner: e, x: cx, y: cy, z: 40, face: e.face, life: 1.3, w: 16, d: 16, h: 40, pierce: true,
        hit: { dmg: skillDmg(0.35, 0.035, lv), stun: 0.3, knock: 20, airLift: 120, hs: 0.02, rep: 0.2, col: '#fff6a0', elem: 'light', type: 'mag', snd: 'crit' },
        update(pr) { const r = 30 + pr.t * 110, a = a0 + pr.t * 6; pr.x = cx + Math.cos(a) * r; pr.y = clamp(cy + Math.sin(a) * r * 0.45, 4, DEPTH - 4); },
        draw(c, pr) { drawSpr(c, 'eel', sx(pr.x), sy(pr.y, pr.z), 40, 40, { rot: pr.t * 10 }); } }); } })] }) });
defSkill('mg_fang', { name: '龙牙', cls: 'mage', lvReq: 5, mp: 15, cd: 4, type: 'phys', col: '#c0c8e0',
  desc: '挥杖向前直刺，命中的敌人陷入长时间僵直；命中后可以立即接天击、落花掌等技能。', pow: lv => skillDmg(2.0, 0.2, lv), ai: { kind: 'poke', r: [0, 90], dy: 20 },
  act: (lv) => ({ name: 'mg_fang', clip: 'fang', dur: 0.46, cancelFrom: 0.2, move: [[0.08, 0.16, 300]],
    hits: [HB(0.12, 0.2, [0, 92, 22, 30, 90], skillDmg(2.0, 0.2, lv), { stun: 1.0, knock: 30, hs: 0.08, snd: 'stab', chaser: 'ice' })],
    events: [evAt(0.11, e => { sfx.swing(true); fxStreak({ x: e.x + e.face * 10, y: e.y, z: e.z + 56, face: e.face, len: 100, w: 10, col: '#dfe8ff', dur: 0.16 }); })] }) });
defSkill('mg_shield', { name: '魔法护盾', cls: 'mage', lvReq: 5, mp: 40, cd: 20, type: 'mag', buff: true, col: '#3a8ad8',
  desc: '【BUFF】60 秒内受到的伤害有一部分改由 MP 承担。', infoExtra: lv => [['MP 承担比例', pct(0.3 + 0.02 * lv)]], ai: { kind: 'buff' },
  act: (lv) => ({ name: 'mg_shield', clip: 'cheer', dur: 0.45, noCounter: true, onStart: e => { e.buffs.mg_shield = { t: 60, shield: 0.3 + 0.02 * lv }; sfx.buff(); fxAura(e, '#6ab0ff'); } }) });
defSkill('mg_cat', { name: '暗影夜猫', cls: 'mage', lvReq: 10, mp: 20, cd: 5, type: 'mag', elem: 'dark', col: '#4a2a6a', cast: true,
  desc: '放出一只暗影夜猫向前飞扑，扑到尽头后再返回，最多攻击同一敌人 2 次。', pow: lv => skillDmg(2.4, 0.24, lv), ai: { kind: 'proj', r: [0, 220], dy: 20 },
  act: (lv) => ({ name: 'mg_cat', clip: 'cast3', dur: 0.45, cancelFrom: 0.3,
    events: [evAt(0.12, e => { sfx.magic(); const x0 = e.x, dir = e.face;
      spawnProj({ owner: e, x: x0, y: e.y, z: 30, face: dir, life: 0.9, w: 20, d: 18, h: 40, pierce: true,
        hit: { dmg: skillDmg(1.2, 0.12, lv), stun: 0.4, knock: 60, airLift: 150, hs: 0.05, rep: 0.3, max: 2, elem: 'dark', type: 'mag', col: '#c79aff' },
        update(pr) { const u = pr.t / pr.life; pr.x = x0 + dir * 230 * Math.sin(Math.PI * u); pr.face = u < 0.5 ? dir : -dir; pr.z = 20 + Math.sin(u * TAU * 2) * 8; },
        draw(c, pr) { const X = sx(pr.x), Y = sy(pr.y, pr.z); c.save(); c.translate(X, Y); c.scale(pr.face, 1); c.globalCompositeOperation = 'lighter';
          drawSpr(c, 'darkorb', -6, -4, 44, 26, { alpha: 0.7 }); c.globalCompositeOperation = 'source-over'; c.fillStyle = '#1a0a26';
          c.beginPath(); c.ellipse(0, 0, 14, 8, 0, 0, TAU); c.fill(); c.beginPath(); c.arc(12, -6, 7, 0, TAU); c.fill(); c.beginPath(); c.moveTo(8, -12); c.lineTo(10, -18); c.lineTo(13, -12); c.moveTo(14, -12); c.lineTo(17, -18); c.lineTo(18, -10); c.fill();
          c.fillStyle = '#ffe070'; c.fillRect(14, -8, 2, 2); c.restore(); } }); })] }) });
defSkill('mg_snowman', { name: '冰霜雪人', cls: 'mage', lvReq: 10, mp: 20, cd: 5, type: 'mag', elem: 'ice', col: '#6ac0e8', cast: true,
  desc: '召唤雪人追踪最近的敌人，碰到后爆开冰霜。按住技能键蓄满（0.6 秒）时冰冻并减速敌人。', pow: lv => skillDmg(2.6, 0.26, lv), ai: { kind: 'proj', r: [0, 320], dy: 60 },
  act: (lv) => ({ name: 'mg_snowman', clip: 'summon', dur: 0.5, cancelFrom: 0.34,
    charge: { at: 0.08, max: 0.6, min: 0, dmg: 0.5, update: e => { if (Math.random() < 0.4) fxCharge(e, '#bfefff'); } },
    events: [evAt(0.16, e => { sfx.ice(); const full = (e.act.chargeK || 0) > 0.95, m = e.act.dmgMul;
      spawnProj({ owner: e, x: e.x + e.face * 40, y: e.y, z: 0, face: e.face, vx: e.face * 150, life: 2.4, w: 16, d: 16, h: 50, pierce: false,
        hit: { dmg: skillDmg(0.6, 0.06, lv), stun: 0.3, knock: 20, hs: 0.03, elem: 'ice', type: 'mag' },
        update(pr, dt) { const t = nearestFoe(e, 420); if (t) { pr.vx = damp(pr.vx, clamp((t.x - pr.x) * 3, -220, 220), 4, dt); pr.vy = damp(pr.vy, clamp((t.y - pr.y) * 3, -120, 120), 4, dt); if (Math.abs(pr.vx) > 5) pr.face = Math.sign(pr.vx); } },
        onEnd(pr) { sfx.ice(); fxSpr('frost', pr.x, pr.y, 0, { w: 150, dur: 0.5, ay: 0.75, grow: [0.4, 1.1] });
          blast(e, pr.x, pr.y, 60, { dmg: skillDmg(2.0, 0.2, lv) * m, launch: 260, knock: 60, hs: 0.07, elem: 'ice', type: 'mag', col: '#bfefff' }, full ? { status: 'freeze', sdur: 1.5 } : { status: 'slow', sdur: 2 }); },
        draw(c, pr) { drawSpr(c, 'snowman', sx(pr.x), sy(pr.y, 0) + 2, 0, 46, { ay: 1, add: false, flip: pr.face < 0 }); } }); })] }) });
defSkill('mg_palm', { name: '落花掌', cls: 'mage', lvReq: 15, mp: 25, cd: 6, type: 'phys', col: '#e07ab0',
  desc: '一掌把敌人击飞，被击飞的敌人撞到其他敌人时也会造成伤害。', pow: lv => skillDmg(3.0, 0.3, lv), ai: { kind: 'poke', r: [0, 60], dy: 20 },
  act: (lv) => ({ name: 'mg_palm', clip: 'palm', dur: 0.5, cancelFrom: 0.32,
    hits: [HB(0.1, 0.16, [0, 60, 26, 20, 110], skillDmg(3.0, 0.3, lv), { down: true, downLift: 150, knock: 520, hs: 0.1, snd: 'blunt', shake: 3, big: 1.4, chaser: 'fire',
      onHit: (a, t) => { fxSpr('petal', t.x, t.y, t.z + 50, { w: 120, dur: 0.5, flip: a.face < 0, grow: [0.5, 1.2] }); const pr = spawnProj({ owner: a, x: t.x, y: t.y, z: t.z, face: a.face, life: 0.5, w: 20, d: 16, h: 60, pierce: true,
        hit: { dmg: skillDmg(1.5, 0.15, lv), knock: 260, down: true, downLift: 120, hs: 0.06, snd: 'blunt', type: 'phys' }, update(p) { p.x = t.x; p.y = t.y; p.z = t.z; }, draw() { } }); pr.hitMap.set(t.id, 0); pr.hitMap.set(-t.id, 99); pr.hit.max = 1; } })],
    events: [evAt(0.09, e => sfx.swing(true))] }) });
CLASSES.mage = { name: '魔法师', hp0: 1450, hpPer: 120, mp0: 1100, mpPer: 60, atk0: 500, atkPer: 60, str0: 5, strPer: 1.8, def0: 220, defPer: 22, crit: 0.07, speed: 160, runSpeed: 290,
  desc: '操纵火、冰、光、暗四种元素的魔法师，身板脆弱但 MP 充沛；转职后可以成为元素师或战斗法师。', model: () => buildSwordsman(PAL_MAGE, { weapon: 'staff', hair: 'long', hat: 'wizard', scarf: false, pauldron: false, coatTail: true }),
  acts: MAGE_ACTS, slashCol: '#e0a0ff', dmgType: 'mag', airMax: 1,
  skills: ['mg_orb', 'mg_sky', 'mg_jack', 'mg_eel', 'mg_fang', 'mg_shield', 'mg_cat', 'mg_snowman', 'mg_palm'],
  start: ['mg_orb', 'mg_sky'], bar: ['mg_orb', 'mg_sky', null, null, null, null, null, null, null, null, null, null],
  cmds: [['', 'mg_sky'], ['df', 'mg_jack'], ['du', 'mg_eel'], ['f', 'mg_fang'], ['du', 'mg_shield', 'buff'], ['bf', 'mg_cat'], ['d', 'mg_snowman'], ['ff', 'mg_palm']],
  jobs: {}, passives: [] };
