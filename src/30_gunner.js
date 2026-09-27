/* =====================================================================
   30. 职业：枪手（左轮）。X 射击（按住连射，子弹能把浮空的敌人持续托在空中）、跑攻滑铲、空中向斜下射击
   技能：上踢 / 回旋踢 / 滑铲 / 乱射 / 燃烧手雷 / 双鹰回旋 / 爆头 / 死亡左轮 / 格林机枪 / 觉醒·弹雨终焉
   ===================================================================== */
const PAL_GUN = { skin: '#f0c8a0', hair: '#4a3024', eye: '#3a6ac8', coat: '#7a5232', coat2: '#54361f', trim: '#d0a050', scarf: '#2a5a8a', pants: '#2c3440', boot: '#3a2a1e', glove: '#4a3424', belt: '#3a2618', blade: '#cfd8e6', glow: '#ffd070', hat: '#5a3a22' };
sfx.gun = function (v = 1) { this.tone('square', 1100, 140, 0.05, 0.08 * v); this.noise('bandpass', 2600, 700, 0.07, 0.3 * v, 1.1); this.tone('sine', 170, 60, 0.07, 0.3 * v); };
/* ---- 姿势与动画 ---- */
POSE.gAim = P(POSE.idle, { torso: -2, head: 0, uaF: 90, faF: 0, wF: -90, uaB: -20, faB: 50, thF: 22, shF: -12, thB: -18, shB: -10 });
POSE.gRecoil = P(POSE.gAim, { torso: 4, head: -3, uaF: 104, faF: -6, wF: -96 });
POSE.gUp = P(POSE.gAim, { torso: 8, head: -12, uaF: 138, faF: 0, wF: -90 });
POSE.gUp2 = P(POSE.gUp, { uaF: 148, torso: 10 });
POSE.gDown = P(POSE.jumpFall, { torso: -18, head: 14, uaF: 45, faF: 0, wF: -90 });
POSE.kickW = P(POSE.idle, { torso: 10, head: -4, thF: 80, shF: -110, ftF: 30, uaF: 50, faF: 70, wF: -100, uaB: -30, faB: 60 });
POSE.kickUp = P(POSE.idle, { torso: 24, head: -14, thF: 165, shF: -4, ftF: 10, thB: -12, shB: -8, ftB: 30, uaF: 20, faF: 80, wF: -100, uaB: -50, faB: 40 });
POSE.kickSide = P(POSE.idle, { torso: 30, head: -18, thF: 100, shF: -2, ftF: 0, thB: -10, shB: -10, ftB: 20, uaF: -10, faF: 60, wF: -100, uaB: -60, faB: 40 });
POSE.slide = P(POSE.idle, { torso: 55, head: -30, thF: 88, shF: 0, ftF: 0, thB: 40, shB: -120, ftB: 60, uaF: 60, faF: 40, wF: -90, uaB: -100, faB: 20 });
POSE.gatling = P(POSE.idle, { torso: -8, head: 4, uaF: 60, faF: 30, wF: -90, uaB: 50, faB: 40, thF: 34, shF: -24, thB: -30, shB: -12 });
CLIPS.gun = { ...HUMAN_CLIPS,
  gshot: { dur: 0.2, fps: 24, keys: [k(0, POSE.gAim, 'hold'), k(0.04, POSE.gRecoil, 'out'), k(0.16, POSE.gAim)] },
  gdown: { dur: 0.22, fps: 24, keys: [k(0, POSE.gDown)] },
  gup: { dur: 0.14, loop: true, fps: 24, keys: [k(0, POSE.gUp), k(0.07, POSE.gUp2)] },
  gaim: { dur: 0.5, keys: [k(0, POSE.gAim)] },
  kick: { dur: 0.45, fps: 20, keys: [k(0, POSE.kickW, 'hold'), k(0.08, POSE.kickUp, 'out'), k(0.3, POSE.kickUp), k(0.45, POSE.idle)] },
  spinkick: { dur: 0.16, loop: true, fps: 16, keys: [k(0, POSE.kickSide), k(0.08, P(POSE.kickSide, { thF: 110, torso: 36 }))] },
  slide: { dur: 0.5, keys: [k(0, POSE.slide)] },
  gthrow: { dur: 0.6, fps: 16, keys: [k(0, POSE.idle), k(0.1, POSE.throwW, 'hold'), k(0.28, POSE.throwS, 'out'), k(0.6, POSE.idle)] },
  gatling: { dur: 0.1, loop: true, fps: 20, keys: [k(0, POSE.gatling), k(0.05, P(POSE.gatling, { torso: -5, uaF: 63 }))] },
};
/* ---- 射击 ---- */
function muzzle(e) { e.drawOpts = { muzzle: 1 }; game.after(0.05, () => { if (e.drawOpts) e.drawOpts.muzzle = 0; }); }
function fireBullet(e, o = {}) {
  const sp = 950, dn = o.down, up = o.up, ang = dn || up ? 0.72 : 1;
  muzzle(e);
  { const mx = e.x + e.face * 34, mz = e.z + (dn ? 52 : up ? 74 : 64), rot = (dn ? 0.7 : up ? -0.7 : 0) * e.face + (e.face < 0 ? Math.PI : 0);   // 枪口火光
    addFx({ x: mx, y: e.y + 1, z: mz, dur: 0.07, add: true, rot, draw(c) { drawSpr(c, 'muzzle', sx(this.x), sy(this.y, this.z), 34, 0, { ax: 0.2, rot: this.rot, alpha: 1 - this.t / this.dur }); } }); }
  if (!o.quiet) sfx.gun(o.vol || 1);
  spawnProj({ owner: e, x: e.x + e.face * 34, y: e.y, z: e.z + (dn ? 52 : up ? 74 : 64), vx: e.face * sp * ang, vz: dn ? -sp * 0.72 : up ? sp * 0.72 : 0, face: e.face, life: o.life || 0.52, w: 7, d: 12, h: 14, pierce: !!o.pierce,
    hit: { dmg: o.dmg || 0.5, stun: 0.22, knock: o.knock ?? 25, airLift: o.lift ?? 120, hs: 0.025, snd: 'stab', col: '#ffe0a0', ...(o.hit || {}) },
    update(pr) { if (pr.z <= 0 && pr.vz < 0) { pr.t = pr.life; fxDust(pr.x, pr.y, 2, 4, '#a89878'); } },
    draw(c, pr) { drawSpr(c, 'bullet', sx(pr.x), sy(pr.y, pr.z), 52, 8, { ax: 0.9, rot: Math.atan2(-pr.vz, pr.vx) }); } });
}
const gunShot = (next, dmg = 0.5, extra = {}) => ({ name: 'shot', clip: 'gshot', dur: 0.2, chain: [0.1, 0.2], next, hold: true, events: [evAt(0.01, e => fireBullet(e, { dmg: dmg * (e.buffs && e.buffs.g_buff ? 1.2 : 1), ...extra }))] });
const GUN_ACTS = {
  atk1: gunShot('atk2'), atk2: gunShot('atk3'), atk3: gunShot('atk4'), atk4: gunShot('atk5'),
  atk5: { ...gunShot(null, 0.9, { knock: 160, lift: 200 }), dur: 0.34 },
  dash: { name: 'dash', clip: 'slide', dur: 0.46, move: [[0, 0.3, 430]], noCounter: true,
    hits: [{ t0: 0.02, t1: 0.3, box: [-10, 50, 24, 0, 50], dmg: 1.2, launch: 300, knock: 60, hs: 0.05, snd: 'blunt' }],
    update: e => { if (e.actT < 0.3 && Math.random() < 0.5) fxDust(e.x - e.face * 10, e.y, 1, 4); } },
  jatk: { name: 'jatk', clip: 'gdown', dur: 0.22, airOnly: true, lowGrav: 0.55, chain: [0.11, 0.22], next: 'jatk', hold: true,
    onStart: e => { e.vz = Math.max(e.vz, 30); }, events: [evAt(0.01, e => fireBullet(e, { down: true, dmg: 0.45 }))] },
  back: SWORD_ACTS.back,
};
/* ---- 技能 ---- */
const gIcon = (fn) => (c, arc) => { c.lineWidth = 5; fn(c, arc); };
SKILLS.g_kick = { name: '上踢', cls: 'gun', lvReq: 1, maxLv: 10, mp: 10, cd: 2.4, desc: '抬腿向上猛踢，把敌人踢到空中，接子弹持续浮空。', col: '#3a7fd0',
  drawIcon: gIcon(c => { c.beginPath(); c.moveTo(18, 54); c.lineTo(30, 30); c.lineTo(46, 10); c.stroke(); c.beginPath(); c.moveTo(38, 10); c.lineTo(48, 8); c.lineTo(46, 18); c.fill(); }),
  act: (lv) => ({ name: 'kick', clip: 'kick', dur: 0.45, cancelFrom: 0.26,
    hits: [{ t0: 0.08, t1: 0.18, box: [0, 58, 26, 20, 135], dmg: skillDmg(1.6, 0.16, lv), launch: 560, knock: 30, hs: 0.08, snd: 'blunt', shake: 2, big: 1.2 }],
    events: [evAt(0.06, () => sfx.swing(true))] }) };
SKILLS.g_spin = { name: '回旋踢', cls: 'gun', lvReq: 1, maxLv: 10, mp: 32, cd: 5, desc: '原地旋转连续踢击，攻击两侧的敌人并将其踢飞。', col: '#3aa060',
  drawIcon: gIcon((c, arc) => { arc(32, 34, 20, 0.3, Math.PI * 1.8); c.beginPath(); c.moveTo(52, 22); c.lineTo(56, 36); c.lineTo(44, 32); c.fill(); }),
  act: (lv) => ({ name: 'spin', clip: 'spinkick', dur: 0.72, cancelFrom: 0.62, move: [[0, 0.6, 50]],
    onEnd: e => { e.drawFlip = false; },
    update: e => { const n = Math.floor(e.actT / 0.08); if (n !== e._sp && e.actT < 0.62) { e._sp = n; e.drawFlip = n % 2 === 1; if (n % 2) sfx.swing(false); } },
    hits: [{ t0: 0.04, t1: 0.62, rep: 0.12, box: [-62, 62, 30, 0, 100], dmg: skillDmg(0.75, 0.08, lv), launch: 240, knock: 60, hs: 0.04, snd: 'blunt' }] }) };
SKILLS.g_slide = { name: '滑铲', cls: 'gun', lvReq: 1, maxLv: 10, mp: 18, cd: 4, desc: '贴地高速滑行，把路径上的敌人铲到空中。滑行开始时短暂无敌。', col: '#b8602a',
  drawIcon: gIcon(c => { c.beginPath(); c.moveTo(8, 48); c.lineTo(56, 48); c.stroke(); for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(10 + i * 8, 38 - i * 6); c.lineTo(26 + i * 8, 38 - i * 6); c.stroke(); } }),
  act: (lv) => ({ name: 'slide', clip: 'slide', dur: 0.5, cancelFrom: 0.4, move: [[0, 0.38, 540]], noCounter: true, onStart: e => { e.invul = 0.2; sfx.swing(true); },
    hits: [{ t0: 0.02, t1: 0.38, box: [-10, 52, 26, 0, 50], dmg: skillDmg(1.4, 0.14, lv), launch: 400, knock: 40, hs: 0.05, snd: 'blunt' }],
    update: e => { if (e.actT < 0.38 && Math.random() < 0.6) fxDust(e.x - e.face * 10, e.y, 1, 5); } }) };
SKILLS.g_rapid = { name: '乱射', cls: 'gun', lvReq: 1, maxLv: 10, mp: 38, cd: 8, desc: '向前方与斜上方交替疯狂射击，空中的敌人会被子弹一直托着落不下来。', col: '#d8a02a',
  drawIcon: gIcon(c => { for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(12, 52); c.lineTo(52, 44 - i * 11); c.stroke(); } }),
  act: (lv) => ({ name: 'rapid', clip: 'gup', dur: 1.25, superArmor: true, noCounter: true,
    update: e => { const n = Math.floor(e.actT / 0.07); if (n !== e._rp && e.actT < 1.12) { e._rp = n; e.play(n % 2 ? 'gshot' : 'gup'); fireBullet(e, { up: n % 2 === 0, dmg: skillDmg(0.34, 0.04, lv), lift: 190, life: 0.4, vol: 0.6 }); } } }) };
SKILLS.g_grenade = { name: '燃烧手雷', cls: 'gun', lvReq: 2, maxLv: 10, mp: 30, cd: 6, desc: '投出燃烧手雷，爆炸把敌人炸飞并使其灼烧。', col: '#c83a2a',
  drawIcon: gIcon(c => { c.beginPath(); c.arc(30, 38, 14, 0, TAU); c.fill(); c.fillRect(26, 16, 8, 8); c.beginPath(); c.moveTo(34, 18); c.quadraticCurveTo(46, 8, 52, 14); c.stroke(); }),
  act: (lv) => ({ name: 'grenade', clip: 'gthrow', dur: 0.6, cancelFrom: 0.4,
    events: [evAt(0.26, e => throwGrenade(e, skillDmg(2.6, 0.28, lv)))] }) };
function throwGrenade(e, dmg) {
  sfx.swing(false);
  let tx = e.x + e.face * 220, ty = e.y;
  const tgt = ents.filter(t => t.team === 'e' && !t.dead && (t.x - e.x) * e.face > 20 && Math.abs(t.x - e.x) < 360).sort((a, b) => Math.abs(a.x - e.x) - Math.abs(b.x - e.x))[0];
  if (tgt) { tx = tgt.x; ty = tgt.y; }
  const T = 0.55;
  spawnProj({ owner: e, x: e.x + e.face * 14, y: e.y, z: e.z + 70, vx: (tx - e.x) / T, vy: (ty - e.y) / T, vz: 260, grav: (70 + 260 * T) * 2 / (T * T), life: 3, w: 6, d: 8, h: 10, face: e.face, pierce: true, shadow: 5,
    hit: null, spin: 0, update(pr, dt) { pr.spin += dt * 14; },
    onEnd(pr) { meteorImpact(pr, 0.6); areaHit(e, pr.x, pr.y, 64, 0, { dmg, launch: 330, knock: 90, hs: 0.08, snd: 'fire', col: '#ffb060' }, { status: 'burn', sdur: 3, dps: 0.12 }); },
    draw(c, pr) { drawSpr(c, 'grenade', sx(pr.x), sy(pr.y, pr.z), 0, 16, { add: false, rot: pr.spin }); } });
}
SKILLS.g_hawk = { name: '双鹰回旋', cls: 'gun', lvReq: 5, maxLv: 10, mp: 45, cd: 9, desc: '把两把左轮旋转着掷出，飞出后再飞回手中，来回切割路径上的敌人。', col: '#2aa0a0',
  drawIcon: gIcon((c, arc) => { arc(32, 32, 20, -2.6, 0.4, 5); arc(32, 32, 12, 0.6, 3.6, 4); }),
  act: (lv) => ({ name: 'hawk', clip: 'gthrow', dur: 0.6, cancelFrom: 0.45,
    events: [evAt(0.26, e => { sfx.swing(true); hawkGun(e, 0, skillDmg(1.5, 0.15, lv)); game.after(0.12, () => { if (!e.dead) hawkGun(e, 1, skillDmg(1.5, 0.15, lv)); }); })] }) };
function hawkGun(e, i, dmg) {
  const T = 1.2, x0 = e.x, dir = e.face, z0 = 50 + i * 28;
  spawnProj({ owner: e, x: x0, y: e.y, z: z0, face: dir, life: T, w: 14, d: 18, h: 18, pierce: true, spin: 0, sndT: 0,
    hit: { dmg, stun: 0.3, knock: 20, airLift: 150, hs: 0.03, rep: 0.14, col: '#bfefff' },
    update(pr, dt) { const u = clamp(pr.t / T, 0, 1); pr.x = lerp(x0, e.x, u) + dir * 330 * Math.sin(Math.PI * u); pr.y = damp(pr.y, e.y, 4, dt); pr.spin += dt * 30; pr.sndT -= dt; if (pr.sndT <= 0) { pr.sndT = 0.15; sfx.swing(false); } },
    draw(c, pr) { const X = sx(pr.x), Y = sy(pr.y, pr.z); c.save(); c.translate(X, Y); c.rotate(pr.spin); c.globalCompositeOperation = 'lighter'; c.strokeStyle = 'rgba(160,230,255,.5)'; c.lineWidth = 3; c.beginPath(); c.arc(0, 0, 14, 0, TAU * 0.7); c.stroke(); c.globalCompositeOperation = 'source-over'; c.rotate(Math.PI / 2); c.scale(1.1, 1.1); drawGun(c, PAL_GUN); c.restore(); } });
}
SKILLS.g_head = { name: '爆头', cls: 'gun', lvReq: 5, maxLv: 10, mp: 50, cd: 10, desc: '举枪瞄准片刻后射出贯穿一切的一发子弹，暴击率大幅提升。瞄准期间霸体。', col: '#8a2a3a',
  drawIcon: gIcon(c => { c.beginPath(); c.arc(32, 32, 18, 0, TAU); c.stroke(); c.beginPath(); c.moveTo(32, 6); c.lineTo(32, 58); c.moveTo(6, 32); c.lineTo(58, 32); c.stroke(); c.beginPath(); c.arc(32, 32, 4, 0, TAU); c.fill(); }),
  act: (lv) => ({ name: 'head', clip: 'gaim', dur: 0.95, superArmor: true, noCounter: true, cancelFrom: 0.75,
    update: e => { if (e.actT < 0.55) addFx({ x: e.x, y: e.y + 0.6, z: e.z + 64, face: e.face, dur: 0.02, draw(c) { c.strokeStyle = `rgba(255,40,40,${0.35 + 0.3 * Math.random()})`; c.lineWidth = 1; c.beginPath(); c.moveTo(sx(this.x + this.face * 34), sy(this.y, this.z)); c.lineTo(sx(this.x + this.face * 560), sy(this.y, this.z)); c.stroke(); } }); },
    events: [evAt(0.02, () => sfx.charge()), evAt(0.55, e => {
      muzzle(e); sfx.gun(1.6); sfx.iai(); cam.shake = 5; cam.flash = 0.06; cam.flashCol = '#fff0d0';
      fxStreak({ x: e.x + e.face * 30, y: e.y, z: e.z + 64, face: e.face, len: 560, w: 10, col: '#ffd070', dur: 0.25 });
      instantHit(e, { box: [20, 560, 18, 45, 90], dmg: skillDmg(5.6, 0.6, lv), down: true, knock: 240, hs: 0.12, big: 1.6, col: '#ffe0a0', critBonus: 0.5, snd: 'stab' });
    })] }) };
SKILLS.g_buff = { name: '死亡左轮', cls: 'gun', lvReq: 3, maxLv: 10, mp: 40, cd: 30, buff: true, desc: '20 秒内攻击力与暴击率提升，普通射击伤害提升 20%。', col: '#8a60e0',
  drawIcon: gIcon(c => { c.beginPath(); c.arc(32, 32, 16, 0, TAU); c.stroke(); for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; c.beginPath(); c.arc(32 + Math.cos(a) * 9, 32 + Math.sin(a) * 9, 3, 0, TAU); c.fill(); } }),
  act: (lv) => ({ name: 'gbuff', clip: 'gshot', dur: 0.4, noCounter: true,
    onStart: e => { e.buffs = e.buffs || {}; e.buffs.g_buff = { t: 20, atk: 0.08 + 0.015 * lv, crit: 0.06 + 0.005 * lv }; sfx.buff(); muzzle(e); sfx.gun(0.6); fxAura(e, '#ffd070'); } }) };
SKILLS.g_gatling = { name: '格林机枪', cls: 'gun', lvReq: 7, maxLv: 10, mp: 60, cd: 12, desc: '架起格林机枪向前方持续扫射 2 秒，可用 ↑↓ 调整纵向位置。霸体。', col: '#5a5a6a',
  drawIcon: gIcon(c => { c.fillRect(10, 26, 36, 12); for (let i = 0; i < 3; i++) c.fillRect(46, 25 + i * 5, 12, 3); c.fillRect(18, 38, 8, 14); }),
  act: (lv) => ({ name: 'gatling', clip: 'gatling', dur: 2.1, superArmor: true, noCounter: true, onEnd: e => { e.vy = 0; },
    update: (e, dt) => {
      if (e.team === 'p') e.vy = input.dy() * 70;
      const n = Math.floor(e.actT / 0.05); if (n !== e._gt && e.actT > 0.2 && e.actT < 2.0) { e._gt = n; fireBullet(e, { dmg: skillDmg(0.18, 0.02, lv), lift: 70, knock: 18, life: 0.45, vol: 0.45, quiet: n % 2 === 1 }); e.x -= e.face * 0.6; }
      if (!(e.model instanceof SpriteModel)) addFx({ x: e.x, y: e.y + 0.6, z: e.z, face: e.face, dur: 0.02, draw(c) { const X = sx(this.x + this.face * 14), Y = sy(this.y, this.z + 56); c.save(); c.translate(X, Y); c.scale(this.face, 1); c.fillStyle = '#3a3a44'; c.fillRect(0, -6, 30, 12); c.fillStyle = '#5a5a66'; for (let i = 0; i < 3; i++) c.fillRect(30, -5 + i * 3.5, 16, 2.5); c.fillStyle = '#6a4a2a'; c.fillRect(4, 6, 6, 10); c.restore(); } });
    } }) };
SKILLS.g_awaken = { name: '弹雨·终焉', cls: 'gun', lvReq: 8, maxLv: 3, mp: 150, cd: 60, awaken: true, desc: '【觉醒】时间凝滞后，向画面内所有敌人倾泻弹雨，最后一发引爆全场。', col: '#ffd23a',
  drawIcon: gIcon(c => { c.fillStyle = '#fff6c0'; for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; c.save(); c.translate(32 + Math.cos(a) * 16, 32 + Math.sin(a) * 16); c.rotate(a); c.fillRect(-6, -2, 12, 4); c.restore(); } c.beginPath(); c.arc(32, 32, 7, 0, TAU); c.fill(); }),
  act: (lv) => ({ name: 'gawaken', clip: 'gshot', dur: 2.5, superArmor: true, noCounter: true,
    onStart: e => { e.invul = 2.7; game.cutin = { t: 0, dur: 1.0, name: '弹雨·终焉', who: e }; game.timeStop = 0.9; sfx.awaken(); },
    update: e => {
      if (e.actT < 0.95 || e.actT > 2.1) return;
      const n = Math.floor(e.actT / 0.045); if (n === e._aw) return; e._aw = n;
      e.face = n % 2 ? 1 : -1; e.play('gshot', true);
      const pool = ents.filter(t => hittable(e, t) && Math.abs(t.x - (cam.x + WW / 2)) < WW / 2 + 20);
      sfx.gun(0.5); e.drawOpts = { muzzle: 1 };
      if (!pool.length) return; const t = pick(pool); e.face = t.x >= e.x ? 1 : -1;
      addFx({ x: e.x + e.face * 34, y: Math.max(e.y, t.y) + 1, z: e.z + 64, tx: t.x, ty: t.y, tz: t.z + t.hurtH() * 0.5, dur: 0.08, add: true, draw(c) { c.save(); c.globalCompositeOperation = 'lighter'; c.strokeStyle = `rgba(255,220,120,${1 - this.t / this.dur})`; c.lineWidth = 2; c.beginPath(); c.moveTo(sx(this.x), sy(this.y, this.z)); c.lineTo(sx(this.tx), sy(this.ty, this.tz)); c.stroke(); c.restore(); } });
      applyHit(e, t, { dmg: skillDmg(0.45, 0.12, lv), stun: 0.3, knock: 20, airLift: 160, hs: 0.02, snd: 'stab', col: '#ffe0a0' }, { proj: true });
    },
    events: [evAt(2.15, e => {
      cam.flash = 0.3; cam.flashCol = '#fff0c0'; cam.shake = 12; sfx.boom(1.3); e.drawOpts = {};
      for (const t of ents) if (hittable(e, t) && Math.abs(t.x - (cam.x + WW / 2)) < WW / 2 + 20) { meteorImpact(t, 0.5); applyHit(e, t, { dmg: skillDmg(6, 2, lv), down: true, knock: 240, hs: 0.15, big: 2, col: '#ffd070', critBonus: 0.2 }, { proj: true }); }
    })] }) };
CLASSES.gun = { name: '枪手', hp0: 1650, hpPer: 135, mp0: 800, mpPer: 45, atk0: 470, atkPer: 56, str0: 6, strPer: 2, def0: 260, defPer: 25, crit: 0.1, speed: 172, runSpeed: 305,
  desc: '手持双左轮的远程射手，子弹能把敌人一直托在空中，踢技与手雷补足近身。', model: () => RIG_DATA.gun ? new ImageModel('gun') : buildSwordsman(PAL_GUN, { weapon: 'gun', hair: 'long', hat: 'cap', scarf: true, pauldron: false, coatTail: true }),
  acts: GUN_ACTS, slashCol: '#ffd070',
  skills: ['g_kick', 'g_spin', 'g_slide', 'g_rapid', 'g_grenade', 'g_buff', 'g_hawk', 'g_head', 'g_gatling', 'g_awaken'],
  start: ['g_kick', 'g_spin', 'g_slide', 'g_rapid'], bar: ['g_kick', 'g_spin', 'g_slide', 'g_rapid', null, null, null, null, null, null, null, null],
  cmds: [['df', 'g_rapid'], ['fd', 'g_grenade'], ['bf', 'g_hawk'], ['dd', 'g_head'], ['fu', 'g_gatling'], ['u', 'g_spin'], ['hold', 'g_slide'], ['', 'g_kick']] };
