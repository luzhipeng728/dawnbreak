/* =====================================================================
   30. 职业：神枪手（女）—— 普攻：拔枪 → 按武器连射一轮（左轮 4、自动手枪 6、步枪 3、手炮 2、手弩 7；手炮是前方范围判定）→ 收枪 / 装填；↓ 低射可打倒地；
   跑攻滑铲（中途按 X = 起身上旋踢）；跳跃斜下射击（每跳发数随武器）。基础技能（国服女枪，官方现版，见 docs/SKILLS_OFFICIAL_gun.md 第 3 节）：
   后撩踢、浮空弹、M-137 格林机枪、银弹、RX-78 追击者、上旋踢、钉刺射、浮空铲、M-3 喷火器、烟尘弹、空中射击、刺踢、BBQ、G-14 手雷
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
const weaponType = p => wtypeOf(p);
/* ---- 普攻手感随武器（官方：地面一轮发数 左轮 4 / 自动 6 / 步枪 3 / 手炮 2 / 手弩 7；拔枪速度 自动 > 左轮 > 手弩 > 步枪 > 手炮；
   硬直 手炮 > 步枪 > 左轮 > 手弩 > 自动；射程 步枪 > 左轮 > 手弩 > 自动 > 手炮；手炮不是子弹，是前方一小块范围判定、空中命中直接打倒地）。
   n 发数、draw 拔枪前摇、gap 连射间隔、holster 收枪 / 装填后摇、life 子弹寿命（射程）、stun 硬直、knock 击退、pierce 穿透几率、dmg 每发伤害倍率（最后一发 ×1.8）、
   air 每次跳跃的射击上限（手炮官方 1 发，其余按地面发数）、bonus 空中射击 1 / 10 级增加的发数、airGap 跳射间隔、recoil 跳射后坐 —— 数值是【建议】值，见 docs/SKILLS_OFFICIAL_gun.md 第 2.2 节 ---- */
const GUN_FEEL = {
  revolver: { n: 4, draw: 0.08, gap: 0.18, holster: 0.24, life: 0.6, stun: 0.25, knock: 25, pierce: 0.1, dmg: 0.6, air: 4, bonus: [4, 8], airGap: 0.2, recoil: 'none' },
  autopistol: { n: 6, draw: 0.05, gap: 0.13, holster: 0.2, life: 0.45, stun: 0.16, knock: 16, pierce: 0, dmg: 0.41, air: 6, bonus: [6, 12], airGap: 0.15, recoil: 'hover' },
  rifle: { n: 3, draw: 0.14, gap: 0.24, holster: 0.3, life: 0.75, stun: 0.32, knock: 40, pierce: 0.3, dmg: 0.86, air: 3, bonus: [3, 7], airGap: 0.26, recoil: 'up' },
  handcannon: { n: 2, draw: 0.2, gap: 0.3, holster: 0.34, life: 0, stun: 0.42, knock: 90, pierce: 1, dmg: 1.15, air: 1, bonus: [2, 4], airGap: 0.3, recoil: 'back', area: 110 },
  bowgun: { n: 7, draw: 0.1, gap: 0.12, holster: 0.24, life: 0.52, stun: 0.2, knock: 12, pierce: 0, dmg: 0.4, air: 7, bonus: [5, 14], airGap: 0.13, recoil: 'sink' },
};
const feelOf = p => GUN_FEEL[wtypeOf(p)] || GUN_FEEL.revolver;
const isRevolver = p => !wtypeOf(p) || wtypeOf(p) === 'revolver';   // 没装备武器按左轮算
const shotsOf = p => feelOf(p).n;
// 空中射击（Buff）增加的跳射发数：1 级到 10 级之间按等级插值
function aerialBonus(p) { const b = p.buffs && p.buffs.g_aerial; if (!b) return 0; const [a0, a1] = feelOf(p).bonus; return Math.round(lerp(a0, a1, clamp((b.lv - 1) / 9, 0, 1))); }
// o: { fx（只做表现，不判定：伤害由技能自己结算）, dmg, up（格林机枪 / BBQ 的斜上射）, down（跳射斜下）, low（↓X 低射，可打倒地）, knock, lift, life, pierce, vol, quiet, hit, basic（普攻：吃银弹）,
//      speedMul（子弹速度倍率）, col（子弹染色，银弹优先）}
// 转职的普攻子弹钩子 CLASSES.gun.shotMod(e, o) → 新的 o（弹药专家的子弹种类：改 dmg / life / pierce / hit / speedMul / col）
function fireBullet(e, o = {}) {
  if (o.basic && CLASSES.gun.shotMod) o = CLASSES.gun.shotMod(e, o) || o;
  const sp = 950 * (1 + 0.02 * skLv(e, 'g_revmaster')) * (o.speedMul || 1), dn = o.down, up = o.up, ang = dn || up ? 0.72 : 1, zz = dn ? 52 : up ? 74 : o.low ? 24 : 64;
  muzzle(e);
  { const mx = e.x + e.face * 34, mz = e.z + zz, rot = (dn ? 0.7 : up ? -0.7 : 0) * e.face + (e.face < 0 ? Math.PI : 0);   // 枪口火光
    addFx({ x: mx, y: e.y + 1, z: mz, dur: 0.07, add: true, rot, draw(c) { drawSpr(c, 'muzzle', sx(this.x), sy(this.y, this.z), 34, 0, { ax: 0.2, rot: this.rot, alpha: 1 - this.t / this.dur }); } }); }
  if (!o.quiet) sfx.gun(o.vol || 1);
  // 银弹：按发数计（官方），只有普通射击吃
  const silver = o.basic && e.buffs && e.buffs.g_silver;
  if (silver) { silver.n--; if (silver.n <= 0) delete e.buffs.g_silver; }
  spawnProj({ owner: e, x: e.x + e.face * 34, y: e.y, z: e.z + zz, vx: e.face * sp * ang, vz: dn ? -sp * 0.72 : up ? sp * 0.72 : 0, face: e.face, life: o.life || 0.52, w: 7, d: 12, h: o.low ? 10 : 14,
    pierce: !!o.pierce || (o.basic && isRevolver(e) && Math.random() < 0.04 * skLv(e, 'g_revmaster')),   // 左轮奥义：普攻穿透几率
    hit: o.fx ? null : { dmg: (o.dmg || 0.5) * (silver ? 1 + silver.shot : 1), stun: 0.22, knock: o.knock ?? 25, airLift: o.lift ?? 120, hs: 0.025, snd: 'stab', col: silver ? '#fff6c0' : '#ffe0a0', downHit: !!o.low, elem: silver ? 'light' : undefined, ...(o.hit || {}) },
    update(pr) { if (pr.z <= 0 && pr.vz < 0) { pr.t = pr.life; fxDust(pr.x, pr.y, 2, 4, '#a89878'); } },
    draw(c, pr) { drawSpr(c, silver ? fxTint('bullet', '#fff8d0') : o.col ? fxTint('bullet', o.col) : 'bullet', sx(pr.x), sy(pr.y, pr.z), 52, 8, { ax: 0.9, rot: Math.atan2(-pr.vz, pr.vx) }); } });
}
// 手炮普攻：不是子弹，是前方一小块范围判定（穿透、能穿障碍）；空中的敌人直接被砸到地上
function cannonBlast(e, dmg, o) {
  const M = CLASSES.gun.shotMod ? CLASSES.gun.shotMod(e, { basic: true, cannon: true, dmg, hit: {} }) : null; if (M) dmg = M.dmg ?? dmg;   // 同 fireBullet 的普攻子弹钩子
  muzzle(e); sfx.cannon(0.4); cam.shake = Math.max(cam.shake, o.last ? 3 : 2);
  const air = o.air, low = o.low, F = GUN_FEEL.handcannon;
  addFx({ x: e.x + e.face * 40, y: e.y + 1, z: e.z + (air ? 40 : low ? 24 : 62), dur: 0.1, add: true, face: e.face, draw(c) { drawSpr(c, 'muzzle', sx(this.x), sy(this.y, this.z), 70, 0, { ax: 0.15, rot: (air ? 0.7 : 0) * this.face + (this.face < 0 ? Math.PI : 0), alpha: 1 - this.t / this.dur }); } });
  instantHit(e, { box: air ? [0, 90, 26, -70, 40] : [14, F.area, 26, low ? -10 : 10, low ? 50 : 100], dmg, stun: F.stun + (o.last ? 0.12 : 0), knock: o.last ? 200 : F.knock, spike: 320, hs: 0.06, snd: 'blunt',
    downHit: low || air, heavy: o.last, big: 1.2, col: '#ffd090', ...((M && M.hit) || {}) });
}
// 普攻的一发（地面 / 空中共用）
function gunFire(e, i, aim, air) {
  const F = feelOf(e), last = !air && i >= F.n, dmg = F.dmg * (last ? 1.8 : 1) * shotDmgOf(e) * (air ? airShotMul(e) : 1);
  if (F.area) { cannonBlast(e, dmg, { last, low: aim === 'low', air }); return; }
  fireBullet(e, { dmg, basic: true, down: air, low: aim === 'low', life: F.life, pierce: Math.random() < F.pierce, knock: last ? 160 : F.knock, lift: last ? 220 : 120, hit: { stun: F.stun + (last ? 0.12 : 0) } });
}
// 射击伤害倍率：左轮奥义（只对左轮）+ 快速拔枪（普攻）
function shotDmgOf(e) { return 1 + (isRevolver(e) ? 0.02 * skLv(e, 'g_revmaster') : 0) + 0.015 * skLv(e, 'g_quickdraw'); }
const airShotMul = e => { const b = e.buffs && e.buffs.g_aerial; return b ? 1 + 0.02 * b.lv : 1; };
// 普攻：按 X 先拔枪，然后按武器连射 N 发（按住 X 自动连射），打完一轮收枪 / 装填，再按（或一直按着）开下一轮。↓ 低射（能打倒地）；官方普攻没有 ↑ 斜上射
const gunShot = i => ({ name: 'shot' + i, clip: 'gshot', dur: 0.2, basic: true, speed: 'aspd', chain: [0.1, 0.2], hold: true,
  next: p => i < feelOf(p).n ? 'atk' + (i + 1) : 'holster',
  onStart: e => { const F = feelOf(e), a = e.act, d = i === 1 ? F.draw / (1 + 0.08 * skLv(e, 'g_quickdraw')) : 0; a.fireT = d; a.dur = d + F.gap; a.chain = [d + F.gap * 0.5, a.dur]; a.counterEnd = a.dur;
    const dy = e.pad ? e.pad.dy() : 0; a.aim = dy > 0 ? 'low' : ''; if (d > 0) e.play('gaim', true); },
  update: e => { const a = e.act; if (!a.fired && e.actT >= a.fireT) { a.fired = true; if (a.fireT > 0) e.play('gshot', true); gunFire(e, i, a.aim, false); } } });
const GUN_ACTS = {
  atk1: gunShot(1), atk2: gunShot(2), atk3: gunShot(3), atk4: gunShot(4), atk5: gunShot(5), atk6: gunShot(6), atk7: gunShot(7),
  // 一轮打完：收枪 / 装填（可以被技能、后跳取消；一直按着 X 会自动开下一轮）
  holster: { name: 'holster', clip: 'holster', dur: 0.24, basic: true, speed: 'aspd', chain: [0.17, 0.24], next: 'atk1', hold: true,
    onStart: e => { const F = feelOf(e), a = e.act, H = F.holster / (1 + 0.1 * skLv(e, 'g_revmaster') * (wtypeOf(e) === 'revolver' || !wtypeOf(e) ? 1 : 0)); a.dur = H; a.chain = [H * 0.7, H]; a.counterEnd = 0; } },
  // 跑攻：滑铲（不再自带浮空，浮空铲是单独的主动技能）；滑铲中按 X = 起身上旋踢（学了上旋踢）
  dash: { name: 'dash', clip: 'slide', dur: 0.46, basic: true, speed: 'aspd', move: [[0, 0.3, 430]], noCounter: true, keyLinks: { attack: 'g_spin', cmd: 'g_bl_rush' }, linkFrom: 0.08,   // 滑铲中 X = 起身上旋踢，Z = 起身斩（女漫游）
    hits: [HB(0.02, 0.3, [-10, 50, 24, 0, 50], 1.1, { knock: 180, stun: 0.45, hs: 0.05, snd: 'blunt', heavy: true })],
    update: e => { if (e.actT < 0.3 && Math.random() < 0.5) fxDust(e.x - e.face * 10, e.y, 1, 4); } },
  // 跳射：斜向下射击，每次跳跃有发数上限（airMaxOf），后坐随武器（手炮向后飘、步枪向上、手弩下坠、自动几乎停在空中）
  jatk: { name: 'jatk', clip: 'gdown', dur: 0.22, basic: true, speed: 'aspd', airOnly: true, lowGrav: 0.55, chain: [0.11, 0.22], next: 'jatk', hold: true,
    onStart: e => { const F = feelOf(e), a = e.act, hang = e.buffs && e.buffs.g_aerial ? 0.6 : 1;
      a.dur = F.airGap; a.chain = [F.airGap * 0.5, F.airGap]; a.counterEnd = a.dur; a.lowGrav = (F.recoil === 'hover' ? 0.35 : F.recoil === 'sink' ? 0.8 : 0.55) * hang;
      if (F.recoil === 'up') e.vz = Math.max(e.vz, 150); else if (F.recoil === 'sink') e.vz = Math.min(e.vz, 0) - 60; else e.vz = Math.max(e.vz, F.recoil === 'hover' ? 50 : 30);
      if (F.recoil === 'back') e.vx = -e.face * 120; },
    events: [evAt(0.01, e => gunFire(e, 0, '', true))] },
  back: BACKSTEP,
};
/* ---- 基础技能（国服女枪；等级 / 指令 / 冷却按官方，见 docs/SKILLS_OFFICIAL_gun.md 第 3 节）---- */
defSkill('g_knee', { name: '后撩踢', cls: 'gun', lvReq: 1, lvStep: 3, sp: 20, mp: 10, cd: 2.1, type: 'phys', col: '#3a7fd0',
  desc: '抬腿向上猛踢，把敌人踢到空中。发动瞬间霸体；按住前方向键会向前滑出半个身位。', pow: lv => skillDmg(1.7, 0.17, lv), ai: { kind: 'launch', r: [0, 60], dy: 20 },
  act: (lv, p) => ({ name: 'g_knee', clip: 'kick', dur: 0.45, superArmor: [0, 0.1],
    move: p && p.pad && p.pad.is(p.face > 0 ? 'right' : 'left') ? [[0, 0.14, 210]] : null,
    hits: [HB(0.08, 0.18, [0, 68, 26, 20, 135], skillDmg(1.7, 0.17, lv), { launch: 470 + lv * 5, knock: 30, hs: 0.08, snd: 'blunt', shake: 2, big: 1.2 })],
    events: [evAt(0.06, () => sfx.swing(true))] }) });
defSkill('g_launch', { name: '浮空弹', cls: 'gun', lvReq: 1, sp: 15, mp: 12, cd: 3.8, type: 'phys', col: '#4a90d8',
  desc: '射出一发特制子弹，命中的敌人被高高打上天（浮空高度比其他浮空技能都高）。', pow: lv => skillDmg(1.8, 0.18, lv), ai: { kind: 'launch', r: [0, 380], dy: 14 },
  act: (lv) => ({ name: 'g_launch', clip: 'gshot', dur: 0.36,
    events: [evAt(0.04, e => { fireBullet(e, { dmg: skillDmg(1.8, 0.18, lv), life: 0.6, hit: { launch: 700, knock: 40, hs: 0.07, big: 1.3 } }); sfx.gun(1.3); })] }) });
defSkill('g_gatling', { name: 'M-137 格林机枪', cls: 'gun', lvReq: 5, sp: 15, mp: 30, cd: 5, type: 'phys', icon: 'g_gatling', col: '#5a5a6a',
  desc: '架起格林机枪向前扫射，每秒 7 发。连按 X 延长扫射（最长 2 秒），按住 ↑ 向斜上方扫射托住空中的敌人，按 C 停止。', pow: lv => skillDmg(6.7, 0.67, lv), ai: { kind: 'poke', r: [0, 400], dy: 14 },
  act: (lv) => ({ name: 'g_gatling', clip: 'gatling', dur: 3, noCounter: true,
    onStart: e => { e.act.end = 0.2 + 1.0; },
    onInput: (e, I) => { const a = e.act; if (I.buffered('attack')) { I.consume('attack'); a.end = Math.min(2.2, a.end + 0.14); }
      if (I.buffered('jump') && e.actT > 0.2) { I.consume('jump'); a.end = Math.min(a.end, e.actT); }
      a.up = I.is('up'); e.vy = I.dy() * (a.up ? 0 : 50); return false; },
    update: e => { const a = e.act; a.dur = a.end + 0.15; const n = Math.floor((e.actT - 0.2) * 7);
      if (e.actT >= 0.2 && n !== a.k && e.actT < a.end) { a.k = n; fireBullet(e, { up: a.up, dmg: skillDmg(0.48, 0.048, lv), lift: a.up ? 200 : 70, knock: 16, life: 0.5, vol: 0.55 }); e.x -= e.face * 0.8; } },
    onEnd: e => { e.vy = 0; } }) });
defSkill('g_silver', { name: '银弹', cls: 'gun', lvReq: 5, sp: 15, mp: 30, cd: 16, type: 'phys', buff: true, elem: 'light', col: '#d8d8e8',
  desc: '【BUFF】接下来的 25 发普通射击变为光属性银弹，附加光属性伤害。不能强制中断普通攻击。', infoExtra: lv => [['银弹数', '25 发'], ['射击伤害', '+' + pct(0.1 + 0.02 * lv)]], ai: { kind: 'buff' },
  act: (lv) => ({ name: 'g_silver', clip: 'gbuff', dur: 0.3, noCounter: true, onStart: e => { e.buffs.g_silver = { t: 120, n: 25, shot: 0.1 + 0.02 * lv }; sfx.buff(); fxAura(e, '#fff6c0'); } }) });
/* ---- RX-78 追击者：放出诱导型自爆机器人，追着最近的敌人跑，贴上后自爆（火属性魔法范围伤害）。
   先用投射物实现；机械师的机械引爆 / 危机追击者上线时改走召唤框架（src/game/summon.js，魔法师组）---- */
function rx78(e, lv, o = {}) {
  if (typeof mechRx78 === 'function') return mechRx78(e, lv, o);   // 机械师组把 RX-78 改成召唤物（gun_mechanic.js，召唤框架）；所有转职都走它
  const dmg = skillDmg(3.2, 0.32, lv) * (o.mul || 1);
  const boom = pr => { if (pr.done) return; pr.done = true; meteorImpact(pr, 0.45); sfx.boom(0.6);
    blast(e, pr.x, pr.y, 70, { dmg, type: 'mag', elem: 'fire', launch: 320, knock: 120, hs: 0.06, snd: 'fire', col: '#ffb060' }, { zMax: 120 }); };
  return spawnProj({ owner: e, x: e.x + e.face * 26, y: e.y, z: 0, face: e.face, life: o.life || 7.5, w: 12, d: 12, h: 28, pierce: true, hit: null, shadow: 9, spd: 170, done: false,
    update(pr, dt) {
      let best = null, bd = 520; for (const t of ents) if (foe(e, t) && !t.dead) { const d = Math.abs(t.x - pr.x) + Math.abs(t.y - pr.y) * 1.5; if (d < bd) { bd = d; best = t; } }
      if (best) { const ddx = best.x - pr.x, ddy = best.y - pr.y; pr.face = ddx >= 0 ? 1 : -1; pr.x += Math.sign(ddx) * Math.min(Math.abs(ddx), pr.spd * dt); pr.y += Math.sign(ddy) * Math.min(Math.abs(ddy), pr.spd * 0.7 * dt);
        if (Math.abs(ddx) < best.w + 12 && Math.abs(ddy) < 14) { boom(pr); pr.t = pr.life; } }
      else pr.x += pr.face * pr.spd * 0.4 * dt;
      if (Math.random() < 0.3) fxDust(pr.x - pr.face * 8, pr.y, 1, 3); },
    onEnd: boom,
    draw(c, pr) { drawRx78(c, sx(pr.x), sy(pr.y, pr.z), pr.face, pr.t); } });
}
// RX-78 的样子（没有素材时画一个履带小机器人：灰色车身、圆顶、红色指示灯）
function drawRx78(c, X, Y, face, t) {
  if (IMG['fx/rx78']) { drawSpr(c, 'rx78', X, Y + 2, 0, 36, { ay: 1, flip: face < 0, add: false, rot: Math.sin(t * 30) * 0.04 }); return; }
  c.save(); c.translate(X, Y); c.scale(face, 1);
  c.fillStyle = '#2a2a30'; c.fillRect(-12, -7, 24, 7); c.fillStyle = '#44444c'; for (let i = 0; i < 4; i++) c.fillRect(-11 + i * 6 + ((t * 40) % 6), -6, 3, 5);
  c.fillStyle = '#8a8f9a'; c.fillRect(-10, -19, 20, 12); c.fillStyle = '#b8bcc6'; c.beginPath(); c.arc(0, -19, 8, Math.PI, 0); c.fill();
  c.fillStyle = Math.floor(t * 8) % 2 ? '#ff3a2a' : '#6a1a14'; c.fillRect(3, -24, 4, 4); c.fillStyle = '#e0c040'; c.fillRect(6, -14, 5, 3);
  c.restore();
}
defSkill('g_rx78', { name: 'RX-78 追击者', cls: 'gun', lvReq: 5, sp: 15, mp: 18, cd: 2.8, type: 'mag', elem: 'fire', col: '#8a8f9a',
  desc: '放出诱导型自爆机器人 RX-78：追着最近的敌人跑，贴上后自爆，造成火属性魔法范围伤害。持续 7.5 秒，时间到了也会原地爆炸。', pow: lv => skillDmg(3.2, 0.32, lv), ai: { kind: 'proj', r: [40, 420], dy: 60 },
  act: (lv) => ({ name: 'g_rx78', clip: 'gthrow', dur: 0.4,
    events: [evAt(0.2, e => { rx78(e, lv); sfx.swing(false); })] }) });
defSkill('g_spin', { name: '上旋踢', cls: 'gun', lvReq: 10, sp: 15, mp: 20, cd: 4.5, type: 'phys', icon: 'g_spin', col: '#3aa060',
  desc: '旋转着向上连踢 3 下，攻击身体两侧的敌人并把它们踢上天。滑铲（跑攻）中或倒地时按 X，起身的同时放出上旋踢（起身上旋踢）。', cmdNote: '↓↓+X（滑铲中 / 倒地时 X）',
  pow: lv => skillDmg(0.8, 0.08, lv) * 3, ai: { kind: 'aoe', r: [0, 60], dy: 26 },
  act: (lv, p) => ({ name: 'g_spin', clip: 'spinkick', dur: 0.5, superArmor: [0, 0.12], move: p && skLv(p, 'g_stylish') ? null : [[0, 0.36, 40]],
    // 女漫游：上旋踢中 X = 音速劫击、Z = 翻腾攻击，能接鲜血劫击；学了花式枪术可以边踢边移动
    keyLinks: { attack: 'g_sonic', cmd: 'g_bl_up' }, linkFrom: 0.1, links: ['g_bloodspike'],
    onInput: (e, I) => { if (skLv(e, 'g_stylish')) { e.vx = I.dx() * 240 * mspdOf(e); e.vy = I.dy() * 120; } return false; },
    onEnd: e => { e.drawFlip = false; e.vy = 0; },
    update: e => { const n = Math.floor(e.actT / 0.08); if (n !== e._sp && e.actT < 0.4) { e._sp = n; e.drawFlip = n % 2 === 1; if (n % 2) sfx.swing(false); } },
    hits: [HB(0.04, 0.4, [-62, 62, 30, 0, 110], skillDmg(0.8, 0.08, lv), { rep: 0.12, max: 3, launch: 300, airLift: 240, knock: 40, hs: 0.04, snd: 'blunt' })] }) });
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
defSkill('g_slide', { name: '浮空铲', cls: 'gun', lvReq: 10, maxLv: 1, sp: 15, mp: 15, cd: 8, type: 'phys', col: '#b8602a', icon: 'g_slide',
  desc: '贴地滑铲，把命中的敌人铲上天。滑铲（跑攻）中可以直接接出浮空铲。', pow: () => 1.6, ai: { kind: 'launch', r: [20, 150], dy: 18 },
  act: (lv) => ({ name: 'g_slide', clip: 'slide', dur: 0.5, noCounter: true, move: [[0, 0.3, 460]],
    hits: [HB(0.02, 0.3, [-10, 52, 24, 0, 50], 1.6, { launch: 480, knock: 60, hs: 0.05, snd: 'blunt', big: 1.2 })],
    update: e => { if (e.actT < 0.3 && Math.random() < 0.6) fxDust(e.x - e.face * 10, e.y, 1, 5); } }) });
defSkill('g_m3', { name: 'M-3 喷火器', cls: 'gun', lvReq: 10, sp: 20, mp: 40, cd: 7, type: 'phys', elem: 'fire', col: '#e0602a',
  desc: '按住技能键持续向前喷火（最长 2 秒），每 0.16 秒一段并灼烧敌人；火焰贴地，能烧到倒地的敌人。喷射越久，结束后的收招越长；等级越高，敌人被烧得越僵。', pow: lv => skillDmg(4.0, 0.4, lv), ai: { kind: 'poke', r: [0, 150], dy: 18 },
  act: (lv, p) => ({ name: 'g_m3', clip: 'flame', dur: 2.3, noCounter: true, superArmor: p && skLv(p, 'gl_pandora') ? true : undefined,   // 枪炮师三觉被动 Pandora_01：施放时霸体
    onInput: (e, I) => { const a = e.act; if (!a.stopT && e.actT > 0.35 && !I.is(a.key || 'attack')) { a.stopT = e.actT; a.dur = e.actT + 0.1 + 0.12 * e.actT; }
      if (skLv(e, 'gl_pandora') && !a.stopT) { const sp = e.speed * 1.1; e.vx = I.dx() * sp; e.vy = I.dy() * sp * 0.6; }   // 枪炮师三觉被动 Pandora_01：喷射中可以移动（固定 110%）
      return false; },
    onEnd: e => { e.vx = 0; e.vy = 0; },
    update: e => { const a = e.act, end = a.stopT || 2.1, n = Math.floor(e.actT / 0.08);
      if (n !== a.k && e.actT > 0.08 && e.actT < end) { a.k = n; if (n % 3 === 0) sfx.flame(); flameJet(e, { range: 150, visual: true }); }
      const tk = Math.floor(e.actT / 0.16); if (tk !== a.tk && e.actT > 0.1 && e.actT < end) { a.tk = tk;
        instantHit(e, { box: [30, 160, 22, 0, 70], dmg: skillDmg(0.32, 0.032, lv), stun: 0.12 + 0.02 * lv, knock: 20, airLift: 90, hs: 0.015, snd: 'fire', downHit: true, elem: 'fire', col: '#ffb060',
          onHit: (a2, t) => { if (Math.random() < 0.3) addStatus(t, 'burn', 2, { dps: a2.atk * 0.05, src: a2 }); } }); } } }) });
// 喷火：一小团火焰投射物（低位判定，可打倒地）。visual = 只做表现，伤害由技能自己按固定间隔结算
function flameJet(e, o) {
  shootProj(e, { img: 'flame', w: 90, h: 34, speed: o.speed || 520, life: (o.range || 150) / (o.speed || 520), z: o.z ?? 50, dx: 40, bh: 70, bw: 18, pierce: true, drawZ: 0, floor: false,
    hit: o.visual ? null : { dmg: o.dmg, stun: 0.25, knock: 20, airLift: 90, hs: 0.015, rep: 0.12, snd: 'fire', downHit: true, elem: 'fire', col: '#ffb060', onHit: (a, t) => { if (Math.random() < 0.3) addStatus(t, 'burn', 2, { dps: a.atk * (o.burn || 0.05), src: a }); } },
    update: pr => { pr.z = Math.max(0, pr.z - 60 / 60); } });
}
defSkill('g_dust', { name: '烟尘弹', cls: 'gun', lvReq: 10, sp: 15, mp: 30, cd: 6, type: 'phys', col: '#a08a5a', noWtype: ['handcannon'],
  desc: '朝敌人脚下快速连开 6 枪，扬起烟尘；子弹贴地，能打到倒地的敌人。手炮不能用。', pow: lv => skillDmg(0.55, 0.055, lv) * 6, ai: { kind: 'poke', r: [0, 300], dy: 16 },
  act: (lv) => ({ name: 'g_dust', clip: 'gshot', dur: 0.62,
    update: e => { const a = e.act, n = Math.floor((e.actT - 0.06) / 0.07);
      if (e.actT >= 0.06 && n !== a.n && n < 6) { a.n = n; e.play('gshot', true);
        fireBullet(e, { low: true, dmg: skillDmg(0.55, 0.055, lv), life: 0.34, knock: 30, lift: 90, vol: 0.7, quiet: n % 2 === 1, hit: { stun: 0.3, downHit: true, onHit: (a2, t) => fxDust(t.x, t.y, 4, 10, '#b8a888') } }); } } }) });
defSkill('g_aerial', { name: '空中射击', cls: 'gun', lvReq: 15, lvStep: 3, sp: 20, mp: 40, cd: 40, type: 'phys', buff: true, col: '#6a9ad8',
  desc: '【BUFF】25 秒内跳跃射击的攻击力提高，每次跳跃能射的发数增加（随武器：左轮 +4~8、自动手枪 +6~12、步枪 +3~7、手炮 +2~4、手弩 +5~14），并且跳射时在空中停留更久。不能强制中断普通攻击。',
  infoExtra: lv => [['持续', '25 秒'], ['跳射攻击力', '+' + pct(0.02 * lv)]], ai: { kind: 'buff' },
  act: (lv) => ({ name: 'g_aerial', clip: 'gbuff', dur: 0.4, noCounter: true, onStart: e => { e.buffs.g_aerial = { t: 25, lv }; sfx.buff(); fxAura(e, '#9fd0ff'); } }) });
defSkill('g_flash', { name: '刺踢', cls: 'gun', lvReq: 15, sp: 20, mp: 18, cd: 4.4, type: 'phys', col: '#c07a2a',
  desc: '快速踢出一记直踢，把敌人远远踢开，有几率使其眩晕。', pow: lv => skillDmg(2.6, 0.26, lv), ai: { kind: 'poke', r: [0, 70], dy: 20 },
  act: (lv) => ({ name: 'g_flash', clip: 'flashKick', dur: 0.4, move: [[0.02, 0.08, 160]],
    hits: [HB(0.06, 0.13, [0, 66, 26, 30, 90], skillDmg(2.6, 0.26, lv), { knock: 300, stun: 0.6, heavy: true, hs: 0.09, snd: 'blunt', shake: 3, big: 1.3, onHit: (a, t) => { if (Math.random() < 0.1 + 0.025 * lv) addStatus(t, 'stun', 1.0, { src: a }); } })],
    events: [evAt(0.04, () => sfx.swing(true))] }) });
defSkill('g_bbq', { name: 'BBQ', cls: 'gun', lvReq: 15, sp: 20, mp: 45, cd: 8, type: 'phys', col: '#c8502a', pre: { g_gatling: 1 },
  desc: '后撩踢把敌人踢起并抓住（霸体 / 格挡中的敌人只会挨一脚），随即架起格林机枪向空中追射 10 发，最后把敌人打飞。需要 M-137 格林机枪 Lv1。', pow: lv => skillDmg(6.0, 0.6, lv), ai: { kind: 'grab', r: [0, 60], dy: 20 },
  act: (lv) => ({ name: 'g_bbq', clip: 'kick', dur: 0.5, noCounter: true, superArmor: [0, 0.12],
    hits: [HB(0.08, 0.18, [0, 68, 26, 20, 135], skillDmg(1.2, 0.12, lv), { grab: true, launch: 420, knock: 30, hs: 0.08, snd: 'blunt' })],
    onGrab: (e, t) => { const a = e.act; a.gT = e.actT; a.dur = e.actT + 1.3; t.heldClip = 'air';
      a.update = e2 => { const k = e2.actT - a.gT; if (k > 0.25 && !a.fire) { a.fire = true; e2.play('bbq', true); }
        if (a.fire && Math.floor((k - 0.25) / 0.08) !== a.n && (a.shots || 0) < 10) { a.n = Math.floor((k - 0.25) / 0.08); a.shots = (a.shots || 0) + 1; fireBullet(e2, { fx: true, up: true, dmg: skillDmg(0.3, 0.03, lv), lift: 120, knock: 5, vol: 0.55, quiet: a.n % 2 === 1 });
          const g = e2.grabbed; if (g) applyHit(e2, g, { dmg: skillDmg(0.3, 0.03, lv), hs: 0.01, sure: true, snd: 'stab' }, { proj: true }); }
        if (k > 1.1 && !a.done) { a.done = true; throwGrab(e2, { dmg: skillDmg(1.0, 0.1, lv), launch: 380, knock: 120, hs: 0.1, big: 1.4 }); } }; },
    hold: (e, t) => { const k = clamp((e.actT - e.act.gT) / 0.3, 0, 1); t.x = e.x + e.face * 46; t.y = e.y + 0.5; t.z = e.z + 30 + k * 70 + Math.sin(game.t * 40) * 2; t.face = -e.face; },
    events: [evAt(0.06, () => sfx.swing(true))] }) });
defSkill('g_grenade', { name: 'G-14 手雷', cls: 'gun', lvReq: 15, sp: 20, mp: 25, cd: 3, charges: 3, reload: 2, type: 'mag', icon: 'g_grenade', col: '#6a7a3a',
  desc: '投出 G-14 手雷，碰到敌人立刻爆炸，把周围的敌人炸飞。最多装填 3 颗，每 2 秒补 1 颗；两次投掷之间至少隔 3 秒。按住 ↑ 投得更远、按住 ↓ 投得更近。', pow: lv => skillDmg(3.0, 0.3, lv),
  infoExtra: () => [['装填', '3 颗（每 2 秒 1 颗）']], ai: { kind: 'proj', r: [80, 320], dy: 40 },
  act: (lv) => ({ name: 'g_grenade', clip: 'gthrow', dur: 0.55,
    events: [evAt(0.26, e => { sfx.swing(false); const dy = e.pad ? e.pad.dy() : 0, dist = 220 + (dy < 0 ? 100 : dy > 0 ? -100 : 0), at = aimAhead(e, dist, dist + 60), tx = at.t ? at.x : e.x + e.face * dist;
      const boom = pr => { if (pr.boomed) return; pr.boomed = true; meteorImpact(pr, 0.6); blast(e, pr.x, pr.y, 75, { dmg: skillDmg(3.0, 0.3, lv) * (CLASSES.gun.skillMul ? CLASSES.gun.skillMul(e, 'g_grenade') : 1), launch: 360, knock: 100, hs: 0.08, snd: 'fire', col: '#ffb060', type: 'mag' }); };
      lobProj(e, tx, at.t ? at.y : e.y, 0.5, { img: 'grenade', h: 16, onLand: boom,
        update: pr => { if (pr.boomed) return; for (const t of ents) if (foe(e, t) && !t.dead && Math.abs(t.x - pr.x) < t.w + 8 && Math.abs(t.y - pr.y) < 16 && pr.z < t.z + t.hurtH()) { boom(pr); pr.t = pr.life; break; } } }); })] }) });
CLASSES.gun = { name: '神枪手', hp0: 1650, hpPer: 135, mp0: 800, mpPer: 45, atk0: 470, atkPer: 56, str0: 6, strPer: 2, def0: 260, defPer: 25, crit: 0.1, speed: 172, runSpeed: 305,
  desc: '单手持枪的远程射手，子弹能把敌人一直托在空中，踢技与重火器补足近身。', model: () => buildSwordsman(PAL_GUN, { weapon: 'gun', hair: 'long', hat: 'cap', scarf: true, pauldron: false, coatTail: true }),
  acts: GUN_ACTS, slashCol: '#ffd070', dmgType: 'phys',
  // 每次跳跃的射击上限：按武器（手炮 1 发……）+ 空中射击的加成
  airMaxOf: p => feelOf(p).air + aerialBonus(p),
  // 倒地 / 起身中按 X：起身上旋踢
  getupLinks: { attack: 'g_spin' },
  skills: ['g_knee', 'g_launch', 'g_gatling', 'g_silver', 'g_rx78', 'g_spin', 'g_stomp', 'g_slide', 'g_m3', 'g_dust', 'g_aerial', 'g_flash', 'g_bbq', 'g_grenade'],
  start: ['g_knee', 'g_launch'], bar: ['g_knee', 'g_launch', null, null, null, null, null, null, null, null, null, null, null, null],
  // 指令：[方向序列, 技能 id, 按键]（f 前 b 后 u 上 d 下；hold = 按住→、holdd = 按住↓；按键省略 = Z，attack = X，buff = Space，jump = C）
  cmds: [['', 'g_knee'], ['hold', 'g_launch'], ['df', 'g_gatling', 'attack'], ['df', 'g_silver', 'buff'], ['holdd', 'g_rx78'], ['dd', 'g_spin', 'attack'], ['fd', 'g_stomp', 'attack'],
    ['dd', 'g_slide', 'buff'], ['bdf', 'g_m3', 'attack'], ['uf', 'g_dust'], ['uu', 'g_aerial', 'buff'], ['df', 'g_flash'], ['du', 'g_bbq'], ['fu', 'g_grenade']],
  jobs: {}, passives: [] };
