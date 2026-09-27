/* =====================================================================
   30. 职业：神枪手（女）—— 普攻连射（每轮发数随武器：左轮 4、自动手枪 6、步枪 3、手炮 2、手弩 7；↑ 斜上射、↓ 低射可打倒地）、
   跑攻滑铲、空中斜下射击；基础技能（国服女枪名称）：后撩踢、浮空弹、M-137 格林机枪、上旋踢、钉刺射、浮空铲、M-3 喷火器、刺踢、BBQ、G-14 手雷、银弹
   转职：漫游枪手 gun_ranger.js、枪炮师 gun_launcher.js
   ===================================================================== */
const PAL_GUN = { skin: '#f0c8a0', hair: '#4a3024', eye: '#3a6ac8', coat: '#7a5232', coat2: '#54361f', trim: '#d0a050', scarf: '#2a5a8a', pants: '#2c3440', boot: '#3a2a1e', glove: '#4a3424', belt: '#3a2618', blade: '#cfd8e6', glow: '#ffd070', hat: '#5a3a22' };
sfx.gun = function (v = 1) { this.tone('square', 1100, 140, 0.05, 0.08 * v); this.noise('bandpass', 2600, 700, 0.07, 0.3 * v, 1.1); this.tone('sine', 170, 60, 0.07, 0.3 * v); };
sfx.cannon = function (v = 1) { this.tone('sine', 120, 40, 0.4, 0.5 * v); this.noise('lowpass', 1400, 200, 0.35, 0.45 * v, 0.8); this.tone('square', 300, 60, 0.12, 0.08 * v); };
sfx.flame = function () { this.noise('bandpass', 700, 1200, 0.12, 0.08, 0.6); };
/* ---- 骨骼姿势（没有逐帧素材时的兜底；逐帧动画见 content/sprites.js） ---- */
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
const weaponType = p => p.kit ? p.kit.wtype : (typeof inv !== 'undefined' && inv.equip && inv.equip.weapon && inv.equip.weapon.wtype) || null;
const GUN_SHOTS = { revolver: 4, autopistol: 6, rifle: 3, handcannon: 2, bowgun: 7 };
const shotsOf = p => GUN_SHOTS[weaponType(p)] || 4;
// o: { dmg, up, down, low（低射，可打倒地）, knock, lift, life, pierce, vol, quiet, hit, ang }
function fireBullet(e, o = {}) {
  const sp = 950 * (1 + 0.02 * skLv(e, 'g_revmaster')), dn = o.down, up = o.up, ang = dn || up ? 0.72 : 1, zz = dn ? 52 : up ? 74 : o.low ? 24 : 64;
  muzzle(e);
  { const mx = e.x + e.face * 34, mz = e.z + zz, rot = (dn ? 0.7 : up ? -0.7 : 0) * e.face + (e.face < 0 ? Math.PI : 0);   // 枪口火光
    addFx({ x: mx, y: e.y + 1, z: mz, dur: 0.07, add: true, rot, draw(c) { drawSpr(c, 'muzzle', sx(this.x), sy(this.y, this.z), 34, 0, { ax: 0.2, rot: this.rot, alpha: 1 - this.t / this.dur }); } }); }
  if (!o.quiet) sfx.gun(o.vol || 1);
  const silver = e.buffs && e.buffs.g_silver;
  spawnProj({ owner: e, x: e.x + e.face * 34, y: e.y, z: e.z + zz, vx: e.face * sp * ang, vz: dn ? -sp * 0.72 : up ? sp * 0.72 : 0, face: e.face, life: o.life || 0.52, w: 7, d: 12, h: o.low ? 10 : 14,
    pierce: !!o.pierce || skLv(e, 'g_revmaster') >= 5,
    hit: { dmg: (o.dmg || 0.5) * (silver ? 1 + silver.shot : 1), stun: 0.22, knock: o.knock ?? 25, airLift: o.lift ?? 120, hs: 0.025, snd: 'stab', col: silver ? '#fff6c0' : '#ffe0a0', downHit: !!o.low, elem: silver ? 'light' : undefined, ...(o.hit || {}) },
    update(pr) { if (pr.z <= 0 && pr.vz < 0) { pr.t = pr.life; fxDust(pr.x, pr.y, 2, 4, '#a89878'); } },
    draw(c, pr) { drawSpr(c, silver ? fxTint('bullet', '#fff8d0') : 'bullet', sx(pr.x), sy(pr.y, pr.z), 52, 8, { ax: 0.9, rot: Math.atan2(-pr.vz, pr.vx) }); } });
}
// 普攻：一轮 N 发（最后一发击退更强）；按住 X 自动连射；↑ 斜上射（托浮空）、↓ 低射（能打倒地）
function shotDmgOf(e) { return (1 + 0.02 * skLv(e, 'g_revmaster')) * (e.buffs && e.buffs.g_buff ? 1 + e.buffs.g_buff.shot : 1); }
const gunShot = i => ({ name: 'shot' + i, clip: 'gshot', dur: 0.2, basic: true, speed: 'aspd', chain: [0.1, 0.2], next: p => i < shotsOf(p) ? 'atk' + (i + 1) : null, hold: true,
  onStart: e => { const dy = e.pad ? e.pad.dy() : 0; e.act.aim = dy < 0 ? 'up' : dy > 0 ? 'low' : ''; if (e.act.aim === 'up') e.play('gup', true); },
  events: [evAt(0.01, e => { const last = i >= shotsOf(e), a = e.act.aim; fireBullet(e, { dmg: (last ? 0.9 : 0.5) * shotDmgOf(e), up: a === 'up', low: a === 'low', knock: last ? 160 : 25, lift: last ? 220 : a === 'up' ? 190 : 120 }); })] });
const GUN_ACTS = {
  atk1: gunShot(1), atk2: gunShot(2), atk3: gunShot(3), atk4: gunShot(4), atk5: gunShot(5), atk6: gunShot(6), atk7: gunShot(7),
  // 跑攻：滑铲（学会浮空铲后命中浮空）
  dash: { name: 'dash', clip: 'slide', dur: 0.46, basic: true, speed: 'aspd', move: [[0, 0.3, 430]], noCounter: true,
    onStart: e => { const lv = skLv(e, 'g_slide'); e.act.hits = [HB(0.02, 0.3, [-10, 50, 24, 0, 50], lv ? skillDmg(1.4, 0.14, lv) : 1.1, lv ? { launch: 360 + lv * 10, knock: 60, hs: 0.05, snd: 'blunt' } : { knock: 180, stun: 0.45, hs: 0.05, snd: 'blunt', heavy: true })]; },
    update: e => { if (e.actT < 0.3 && Math.random() < 0.5) fxDust(e.x - e.face * 10, e.y, 1, 4); } },
  jatk: { name: 'jatk', clip: 'gdown', dur: 0.22, basic: true, speed: 'aspd', airOnly: true, lowGrav: 0.55, chain: [0.11, 0.22], next: 'jatk', hold: true,
    onStart: e => { e.vz = Math.max(e.vz, 30); }, events: [evAt(0.01, e => fireBullet(e, { down: true, dmg: 0.45 * shotDmgOf(e) }))] },
  back: BACKSTEP,
};
/* ---- 基础技能 ---- */
defSkill('g_knee', { name: '后撩踢', cls: 'gun', lvReq: 1, mp: 10, cd: 2, type: 'phys', col: '#3a7fd0',
  desc: '抬腿向上猛踢，把敌人踢到空中。发动瞬间霸体，接射击可以持续浮空。', pow: lv => skillDmg(1.7, 0.17, lv), ai: { kind: 'launch', r: [0, 60], dy: 20 },
  act: (lv) => ({ name: 'g_knee', clip: 'kick', dur: 0.45, cancelFrom: 0.24, superArmor: [0, 0.1],
    hits: [HB(0.08, 0.18, [0, 68, 26, 20, 135], skillDmg(1.7, 0.17, lv), { launch: 560 + lv * 6, knock: 30, hs: 0.08, snd: 'blunt', shake: 2, big: 1.2 })],
    events: [evAt(0.06, () => sfx.swing(true))] }) });
defSkill('g_launch', { name: '浮空弹', cls: 'gun', lvReq: 1, mp: 12, cd: 4, type: 'phys', col: '#4a90d8',
  desc: '射出一发特制子弹，命中的敌人被高高打上天。', pow: lv => skillDmg(1.8, 0.18, lv), ai: { kind: 'launch', r: [0, 380], dy: 14 },
  act: (lv) => ({ name: 'g_launch', clip: 'gshot', dur: 0.36, cancelFrom: 0.2,
    events: [evAt(0.04, e => { fireBullet(e, { dmg: skillDmg(1.8, 0.18, lv), life: 0.6, hit: { launch: 520, knock: 40, hs: 0.07, big: 1.3 } }); sfx.gun(1.3); })] }) });
defSkill('g_gatling', { name: 'M-137 格林机枪', cls: 'gun', lvReq: 5, mp: 30, cd: 5, type: 'phys', icon: 'g_gatling', col: '#5a5a6a',
  desc: '架起格林机枪向前扫射。连按 X 延长扫射时间，按住 ↑ 向斜上方扫射托住空中的敌人。', pow: lv => skillDmg(4.2, 0.42, lv), ai: { kind: 'poke', r: [0, 400], dy: 14 },
  act: (lv) => ({ name: 'g_gatling', clip: 'gatling', dur: 3, noCounter: true, cancelFrom: 0.3,
    onStart: e => { e.act.end = 1.1; },
    onInput: (e, I) => { if (I.buffered('attack')) { I.consume('attack'); e.act.end = Math.min(2.4, e.act.end + 0.12); } e.act.up = I.is('up'); e.vy = I.dy() * (e.act.up ? 0 : 50); return false; },
    update: e => { const a = e.act; a.dur = a.end + 0.15; const n = Math.floor(e.actT / 0.07);
      if (n !== a.k && e.actT > 0.12 && e.actT < a.end) { a.k = n; fireBullet(e, { up: a.up, dmg: skillDmg(0.24, 0.024, lv), lift: a.up ? 200 : 70, knock: 16, life: 0.45, vol: 0.45, quiet: n % 2 === 1 }); e.x -= e.face * 0.5; } },
    onEnd: e => { e.vy = 0; } }) });
defSkill('g_spin', { name: '上旋踢', cls: 'gun', lvReq: 10, mp: 20, cd: 4, type: 'phys', icon: 'g_spin', col: '#3aa060',
  desc: '旋转着向上连续踢击，攻击身体两侧的敌人并把它们踢上天。', pow: lv => skillDmg(2.4, 0.24, lv), ai: { kind: 'aoe', r: [0, 60], dy: 26 },
  act: (lv) => ({ name: 'g_spin', clip: 'spinkick', dur: 0.62, cancelFrom: 0.5, move: [[0, 0.4, 40]], superArmor: [0, 0.12],
    onEnd: e => { e.drawFlip = false; },
    update: e => { const n = Math.floor(e.actT / 0.08); if (n !== e._sp && e.actT < 0.5) { e._sp = n; e.drawFlip = n % 2 === 1; if (n % 2) sfx.swing(false); } },
    hits: [HB(0.04, 0.5, [-62, 62, 30, 0, 110], skillDmg(0.6, 0.06, lv), { rep: 0.12, launch: 300, airLift: 240, knock: 40, hs: 0.04, snd: 'blunt' })] }) });
defSkill('g_stomp', { name: '钉刺射', cls: 'gun', lvReq: 10, mp: 30, cd: 6, type: 'phys', col: '#8a5a2a',
  desc: '滑铲把敌人铲倒（抓取判定，能抓住霸体敌人），踩住后向下连续射击，枪弹冲击波波及周围。', pow: lv => skillDmg(4.4, 0.44, lv), ai: { kind: 'grab', r: [0, 140], dy: 20 },
  act: (lv) => ({ name: 'g_stomp', clip: 'slide', dur: 0.5, noCounter: true, move: [[0, 0.3, 520]],
    hits: [HB(0.02, 0.3, [-10, 50, 24, 0, 60], skillDmg(0.8, 0.08, lv), { grab: true, stun: 0.4, hs: 0.05, snd: 'blunt' })],
    onGrab: (e, t) => { t.heldClip = 'down'; const a = e.act; a.events = a.events || []; a.dur = e.actT + 1.2; a.gT = e.actT; e.vx = 0; e.play('stomp', true); a.move = null;
      for (let i = 0; i < 5; i++) a.events.push({ t: e.actT + 0.25 + i * 0.13, done: false, fn: e2 => { const g = e2.grabbed; if (!g) return; muzzle(e2); sfx.gun(0.9);
        addFx({ x: g.x, y: g.y + 1, z: 10, dur: 0.1, add: true, draw(c) { drawSpr(c, 'spark', sx(this.x), sy(this.y, this.z), 40, 0, { alpha: 1 - this.t / this.dur }); } });
        applyHit(e2, g, { dmg: skillDmg(0.5, 0.05, lv), hs: 0.03, sure: true, snd: 'stab' }, { proj: true });
        blast(e2, g.x, g.y, 60, { dmg: skillDmg(0.3, 0.03, lv), knock: 80, stun: 0.3, hs: 0.02, downHit: true }, { zMax: 40 }); } });
      a.events.push({ t: e.actT + 1.0, done: false, fn: e2 => throwGrab(e2, { dmg: skillDmg(0.9, 0.09, lv), down: true, downLift: 60, knock: 40, hs: 0.08 }) }); },
    hold: (e, t) => { t.x = e.x + e.face * 26; t.y = e.y + 0.5; t.z = 0; t.face = -e.face; },
    update: e => { if (e.actT < 0.3 && Math.random() < 0.6) fxDust(e.x - e.face * 10, e.y, 1, 5); } }) });
defSkill('g_slide', { name: '浮空铲', cls: 'gun', lvReq: 10, mp: 0, cd: 0, type: 'phys', passive: true, col: '#b8602a', icon: 'g_slide',
  desc: '【被动】跑动攻击的滑铲命中后把敌人铲上天。', cmdNote: '跑动中 X', pow: lv => skillDmg(1.4, 0.14, lv) });
defSkill('g_m3', { name: 'M-3 喷火器', cls: 'gun', lvReq: 10, mp: 40, cd: 8, type: 'phys', elem: 'fire', col: '#e0602a',
  desc: '按住技能键持续向前喷射火焰（最长 2 秒），多段攻击并灼烧敌人；火焰贴地，能烧到倒地的敌人。', pow: lv => skillDmg(4.0, 0.4, lv), ai: { kind: 'poke', r: [0, 150], dy: 18 },
  act: (lv) => ({ name: 'g_m3', clip: 'flame', dur: 2.2, noCounter: true, cancelFrom: 0.4,
    onInput: (e, I) => { if (e.actT > 0.5 && !I.is(e.act.key || 'attack')) e.act.dur = Math.min(e.act.dur, e.actT + 0.1); return false; },
    update: e => { const n = Math.floor(e.actT / 0.06); if (n !== e.act.k && e.actT > 0.08 && e.actT < e.act.dur - 0.1) { e.act.k = n; if (n % 3 === 0) sfx.flame();
      flameJet(e, { dmg: skillDmg(0.2, 0.02, lv), range: 150, burn: 0.05 }); } } }) });
// 喷火：一小团火焰投射物（低位判定，可打倒地）
function flameJet(e, o) {
  shootProj(e, { img: 'flame', w: 90, h: 34, speed: o.speed || 520, life: (o.range || 150) / (o.speed || 520), z: o.z ?? 50, dx: 40, bh: 70, bw: 18, pierce: true, drawZ: 0, floor: false,
    hit: { dmg: o.dmg, stun: 0.25, knock: 20, airLift: 90, hs: 0.015, rep: 0.12, snd: 'fire', downHit: true, elem: 'fire', col: '#ffb060', onHit: (a, t) => { if (Math.random() < 0.3) addStatus(t, 'burn', 2, { dps: a.atk * (o.burn || 0.05), src: a }); } },
    update: pr => { pr.z = Math.max(0, pr.z - 60 / 60); } });
}
defSkill('g_flash', { name: '刺踢', cls: 'gun', lvReq: 15, mp: 18, cd: 4, type: 'phys', col: '#c07a2a',
  desc: '快速踢出一记直踢，把敌人远远踢开，有几率使其眩晕。', pow: lv => skillDmg(2.6, 0.26, lv), ai: { kind: 'poke', r: [0, 70], dy: 20 },
  act: (lv) => ({ name: 'g_flash', clip: 'flashKick', dur: 0.4, cancelFrom: 0.26, move: [[0.02, 0.08, 160]],
    hits: [HB(0.06, 0.13, [0, 66, 26, 30, 90], skillDmg(2.6, 0.26, lv), { knock: 300, stun: 0.6, heavy: true, hs: 0.09, snd: 'blunt', shake: 3, big: 1.3, onHit: (a, t) => { if (Math.random() < 0.3) addStatus(t, 'stun', 1.0, { src: a }); } })],
    events: [evAt(0.04, () => sfx.swing(true))] }) });
defSkill('g_bbq', { name: 'BBQ', cls: 'gun', lvReq: 15, mp: 45, cd: 9, type: 'phys', col: '#c8502a',
  desc: '后撩踢把敌人踢起并抓住（霸体 / 格挡中的敌人只会挨一脚），随即架起格林机枪向空中猛烈扫射，最后把敌人打飞。', pow: lv => skillDmg(6.0, 0.6, lv), ai: { kind: 'grab', r: [0, 60], dy: 20 },
  act: (lv) => ({ name: 'g_bbq', clip: 'kick', dur: 0.5, noCounter: true, superArmor: [0, 0.12],
    hits: [HB(0.08, 0.18, [0, 68, 26, 20, 135], skillDmg(1.2, 0.12, lv), { grab: true, launch: 420, knock: 30, hs: 0.08, snd: 'blunt' })],
    onGrab: (e, t) => { const a = e.act; a.gT = e.actT; a.dur = e.actT + 1.35; t.heldClip = 'air';
      a.update = e2 => { const k = e2.actT - a.gT; if (k > 0.25 && !a.fire) { a.fire = true; e2.play('bbq', true); }
        if (a.fire && k < 1.1 && Math.floor(k / 0.06) !== a.n) { a.n = Math.floor(k / 0.06); fireBullet(e2, { up: true, dmg: skillDmg(0.18, 0.018, lv), lift: 120, knock: 5, vol: 0.5, quiet: a.n % 2 === 1 });
          const g = e2.grabbed; if (g) applyHit(e2, g, { dmg: skillDmg(0.2, 0.02, lv), hs: 0.01, sure: true, snd: 'stab' }, { proj: true }); }
        if (k > 1.15 && !a.done) { a.done = true; throwGrab(e2, { dmg: skillDmg(1.0, 0.1, lv), launch: 380, knock: 120, hs: 0.1, big: 1.4 }); } }; },
    hold: (e, t) => { const k = clamp((e.actT - e.act.gT) / 0.3, 0, 1); t.x = e.x + e.face * 46; t.y = e.y + 0.5; t.z = e.z + 30 + k * 70 + Math.sin(game.t * 40) * 2; t.face = -e.face; },
    events: [evAt(0.06, () => sfx.swing(true))] }) });
defSkill('g_grenade', { name: 'G-14 手雷', cls: 'gun', lvReq: 15, mp: 25, cd: 5, type: 'mag', icon: 'g_grenade', col: '#6a7a3a',
  desc: '填装后投出 G-14 手雷（按住 ↑↓ 控制投掷的纵深方向），爆炸把周围的敌人炸飞。', pow: lv => skillDmg(3.0, 0.3, lv), ai: { kind: 'proj', r: [120, 300], dy: 40 },
  act: (lv) => ({ name: 'g_grenade', clip: 'gthrow', dur: 0.6, cancelFrom: 0.4,
    events: [evAt(0.26, e => { sfx.swing(false); const at = aimAhead(e, 220, 360); const ty = clamp(at.y + (e.pad ? e.pad.dy() : 0) * 60, 8, DEPTH - 8);
      lobProj(e, at.x, ty, 0.55, { img: 'grenade', h: 16, onLand: pr => { meteorImpact(pr, 0.6); blast(e, pr.x, pr.y, 70, { dmg: skillDmg(3.0, 0.3, lv), launch: 360, knock: 100, hs: 0.08, snd: 'fire', col: '#ffb060', type: 'mag' }); } }); })] }) });
defSkill('g_silver', { name: '银弹', cls: 'gun', lvReq: 5, mp: 30, cd: 20, type: 'phys', buff: true, elem: 'light', col: '#d8d8e8',
  desc: '【BUFF】40 秒内普通射击变为光属性银弹，伤害提升。', infoExtra: lv => [['射击伤害', '+' + pct(0.1 + 0.02 * lv)]], ai: { kind: 'buff' },
  act: (lv) => ({ name: 'g_silver', clip: 'gbuff', dur: 0.4, noCounter: true, onStart: e => { e.buffs.g_silver = { t: 40, shot: 0.1 + 0.02 * lv }; sfx.buff(); fxAura(e, '#fff6c0'); } }) });
/* ---- 双鹰回旋用的回旋手枪（漫游枪手） ---- */
function hawkGun(e, i, dmg) {
  const T = 1.2, x0 = e.x, dir = e.face, z0 = 50 + i * 28;
  spawnProj({ owner: e, x: x0, y: e.y, z: z0, face: dir, life: T, w: 14, d: 18, h: 18, pierce: true, spin: 0, sndT: 0,
    hit: { dmg, stun: 0.3, knock: 20, airLift: 150, hs: 0.03, rep: 0.14, col: '#bfefff' },
    update(pr, dt) { const u = clamp(pr.t / T, 0, 1); pr.x = lerp(x0, e.x, u) + dir * 330 * Math.sin(Math.PI * u); pr.y = damp(pr.y, e.y, 4, dt); pr.spin += dt * 30; pr.sndT -= dt; if (pr.sndT <= 0) { pr.sndT = 0.15; sfx.swing(false); } },
    draw(c, pr) { const X = sx(pr.x), Y = sy(pr.y, pr.z); c.save(); c.translate(X, Y); c.rotate(pr.spin); c.globalCompositeOperation = 'lighter'; c.strokeStyle = 'rgba(160,230,255,.5)'; c.lineWidth = 3; c.beginPath(); c.arc(0, 0, 14, 0, TAU * 0.7); c.stroke(); c.globalCompositeOperation = 'source-over'; c.rotate(Math.PI / 2); c.scale(1.1, 1.1); drawGun(c, PAL_GUN); c.restore(); } });
}
CLASSES.gun = { name: '神枪手', hp0: 1650, hpPer: 135, mp0: 800, mpPer: 45, atk0: 470, atkPer: 56, str0: 6, strPer: 2, def0: 260, defPer: 25, crit: 0.1, speed: 172, runSpeed: 305,
  desc: '手持双左轮的远程射手，子弹能把敌人一直托在空中，踢技与重火器补足近身。', model: () => buildSwordsman(PAL_GUN, { weapon: 'gun', hair: 'long', hat: 'cap', scarf: true, pauldron: false, coatTail: true }),
  acts: GUN_ACTS, slashCol: '#ffd070', dmgType: 'phys', airMax: 8,
  skills: ['g_knee', 'g_launch', 'g_gatling', 'g_silver', 'g_spin', 'g_stomp', 'g_slide', 'g_m3', 'g_flash', 'g_bbq', 'g_grenade'],
  start: ['g_knee', 'g_launch'], bar: ['g_knee', 'g_launch', null, null, null, null, null, null, null, null, null, null],
  cmds: [['', 'g_knee'], ['hold', 'g_launch'], ['df', 'g_gatling', 'attack'], ['dd', 'g_spin', 'attack'], ['fd', 'g_stomp', 'attack'], ['bdf', 'g_m3', 'attack'],
    ['df', 'g_flash'], ['du', 'g_bbq'], ['fu', 'g_grenade'], ['f', 'g_silver', 'buff']],
  jobs: {}, passives: [] };
