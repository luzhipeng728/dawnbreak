/* =====================================================================
   12. 技能（剑士）。每个技能：名称、描述、MP、冷却、学习等级、最大等级、图标、act(lv, 玩家) → 动作定义
   技能伤害 = 攻击力 × dmg，dmg 随技能等级成长
   ===================================================================== */
const SKILLS = {};
const hittable = (e, t) => t.team !== e.team && !t.dead && !t.remove && t.invul <= 0 && t.team !== 'n';
const skillDmg = (base, per, lv) => base + per * (lv - 1);
function projWave(p, o) {   // 地面剑气：向前推进的多段浮空判定
  spawnProj({ owner: p, x: p.x + p.face * 30, y: p.y, z: 0, vx: p.face * (o.speed || 360), face: p.face, life: o.life || 0.7, w: 26, d: 26, h: 90,
    hit: { dmg: o.dmg, launch: o.launch || 380, knock: 60, hs: 0.05, col: '#9fe6ff', rep: 0.14, shake: 1.5 },
    draw(c, pr) {
      const X = sx(pr.x), Y = sy(pr.y, 0), k = pr.t / pr.life, a = k > 0.75 ? (1 - k) / 0.25 : Math.min(1, k * 10);
      for (let i = 2; i >= 0; i--) drawSpr(c, 'wave', X - i * 16 * pr.face, Y + 6, 0, 100 - i * 18, { ay: 1, flip: pr.face < 0, alpha: a * (1 - i * 0.3) });
    }, trail: 'wave' });
}
SKILLS.upslash = { name: '挑空斩', cls: 'sword', lvReq: 1, maxLv: 10, mp: 12, cd: 2.6, cmd: 'du', desc: '从下向上挑斩，将敌人挑飞到空中。浮空连击的起手技。',
  icon: 'up', col: '#3a7fd0',
  act: (lv) => ({ name: 'up', clip: 'up', dur: 0.5, cancelFrom: 0.28, move: [[0.02, 0.1, 100]],
    hits: [{ t0: 0.1, t1: 0.18, box: [0, 74, 30, 0, 125], dmg: skillDmg(1.8, 0.18, lv), launch: 540, knock: 40, hs: 0.08, shake: 2, big: 1.2 }],
    events: [slashAt(0.09, { a0: 1.4, a1: -1.9, r: 62, w: 20, off: [10, 50], heavy: true })] }) };
SKILLS.triple = { name: '疾风三连', cls: 'sword', lvReq: 1, maxLv: 10, mp: 28, cd: 6, cmd: 'fX', desc: '向前突进斩击，再次按键可追加第二、三段突进（最多三段）。',
  icon: 'triple', col: '#2aa0a0',
  act: (lv) => tripleStage(lv, 1) };
function tripleStage(lv, n) {
  return { name: 'triple' + n, clip: n === 2 ? 'atk2' : n === 3 ? 'atk3' : 'dash', dur: 0.34, cancelFrom: 0.22, move: [[0, 0.18, 520]], noCounter: true,
    follow: n < 3 ? () => tripleStage(lv, n + 1) : null, followWin: [0.12, 0.34],
    hits: [{ t0: 0.02, t1: 0.2, box: [-10, 60, 28, 10, 105], dmg: skillDmg(1.3, 0.14, lv) * (n === 3 ? 1.4 : 1), stun: 0.45, knock: n === 3 ? 260 : 120, hs: 0.06, shake: n === 3 ? 3 : 1.5, launch: n === 3 ? 260 : 0 }],
    events: [evAt(0.01, e => { e.invul = 0.12; fxAfterimage(e); fxStreak({ x: e.x - e.face * 20, y: e.y, z: e.z + 58, face: e.face, len: 110, w: 12, col: '#7ff0e0' }); sfx.swing(n === 3); })] };
}
SKILLS.wave = { name: '冲天剑气', cls: 'sword', lvReq: 1, maxLv: 10, mp: 40, cd: 7.5, cmd: 'dfX', desc: '以剑气击打地面，放出沿地面推进的剑气冲击波，把沿途敌人连续挑起。',
  icon: 'wave', col: '#5a60d8',
  act: (lv) => ({ name: 'wave', clip: 'atk3', dur: 0.55, cancelFrom: 0.35,
    hits: [{ t0: 0.13, t1: 0.19, box: [0, 70, 30, 0, 110], dmg: skillDmg(1.2, 0.1, lv), launch: 360, knock: 30, hs: 0.06 }],
    events: [slashAt(0.12, { a0: -2.6, a1: 1.2, r: 60, w: 18, off: [10, 56], heavy: true }), evAt(0.16, p => { projWave(p, { dmg: skillDmg(0.9, 0.1, lv), launch: 400 }); cam.shake = Math.max(cam.shake, 3); sfx.boom(0.5); })] }) };
SKILLS.slam = { name: '崩地斩', cls: 'sword', lvReq: 2, maxLv: 10, mp: 45, cd: 9, cmd: 'udX', desc: '跃起后挥剑重砸地面，冲击波击倒周围的敌人。',
  icon: 'slam', col: '#b8602a', air: true,
  act: (lv) => ({ name: 'slam', clip: 'a3slam', dur: 1.2, superArmor: true, noCounter: true,
    onStart: e => { if (e.z <= 1) { e.vz = 520; e.z = 1; } sfx.jump(); },
    update: (e, dt) => { if (e.actT > 0.28 && !e.slamDive) { e.slamDive = true; e.vz = -1100; e.vx = e.face * 120; } },
    onLand: e => { e.slamDive = false; e.vx = 0; slamImpact(e, skillDmg(3.2, 0.3, lv)); e.act.dur = e.actT + 0.3; e.act.onLand = null; },
    onEnd: e => { e.slamDive = false; } }) };
function slamImpact(e, dmg) {
  cam.shake = Math.max(cam.shake, 8); fxDust(e.x, e.y, 14, 40); sfx.boom(1);
  fxShock(e.x + e.face * 30, e.y, 160, '#ffb060'); fxBurst(e.x + e.face * 30, e.y, 15, 100, '#ffb060');
  instantHit(e, { box: [-60, 130, 50, -5, 60], dmg, down: true, knock: 200, hs: 0.1, big: 1.5, col: '#ffcf8a' });
}
SKILLS.iai = { name: '瞬影拔刀', cls: 'sword', lvReq: 5, maxLv: 10, mp: 70, cd: 13, cmd: 'bfX', desc: '收刀蓄势后瞬间拔刀，斩出贯穿前方的巨大剑光。蓄势期间霸体。',
  icon: 'iai', col: '#d8a02a',
  act: (lv) => ({ name: 'iai', clip: 'iai', dur: 0.95, superArmor: true, noCounter: true, cancelFrom: 0.7,
    update: (e) => { e.drawOpts = { glow: e.actT < 0.4 ? e.actT / 0.4 : Math.max(0, 1 - (e.actT - 0.4) * 3) }; },
    onEnd: (e) => { e.drawOpts = {}; },
    events: [evAt(0.02, () => sfx.charge()), evAt(0.4, e => {
      cam.flash = 0.12; cam.flashCol = '#fff6d0'; cam.shake = 7; sfx.iai();
      fxStreak({ x: e.x, y: e.y, z: e.z + 60, face: e.face, len: 280, w: 26, col: '#ffd070', dur: 0.3 }); fxBurst(e.x + e.face * 150, e.y, e.z + 60, 170, '#ffd070');
      instantHit(e, { box: [0, 280, 34, 0, 130], dmg: skillDmg(6.5, 0.7, lv), down: true, knock: 280, hs: 0.14, big: 1.8, col: '#ffe0a0', critBonus: 0.2 });
    })] }) };
SKILLS.flurry = { name: '流星乱舞', cls: 'sword', lvReq: 7, maxLv: 10, mp: 55, cd: 11, desc: '以极快的速度连续突刺，最后一击将敌人击飞。',
  icon: 'flurry', col: '#c03a6a',
  act: (lv) => ({ name: 'flurry', clip: 'flurry', dur: 1.05, superArmor: true, noCounter: true, move: [[0, 0.8, 40]],
    hits: [{ t0: 0.05, t1: 0.8, rep: 0.07, box: [0, 70, 28, 20, 100], dmg: skillDmg(0.42, 0.05, lv), stun: 0.25, knock: 25, hs: 0.025, snd: 'stab' },
      { t0: 0.86, t1: 0.92, box: [0, 80, 30, 10, 110], dmg: skillDmg(2.2, 0.25, lv), launch: 360, knock: 240, hs: 0.1, shake: 4, big: 1.5 }],
    update: (e) => { if (e.actT < 0.8 && Math.floor(e.actT / 0.07) !== e._fl) { e._fl = Math.floor(e.actT / 0.07); fxStreak({ x: e.x + e.face * 10, y: e.y + rnd(-6, 6), z: e.z + rnd(45, 75), face: e.face, len: rnd(50, 75), w: 6, col: '#ff9ac0', dur: 0.1 }); } } }) };
SKILLS.spin = { name: '回旋斩', cls: 'sword', lvReq: 1, maxLv: 10, mp: 35, cd: 6.5, desc: '原地旋身挥剑，攻击前后两侧的所有敌人。',
  icon: 'spin', col: '#3aa060',
  act: (lv) => ({ name: 'spin', clip: 'spin', dur: 0.55, cancelFrom: 0.4,
    hits: [{ t0: 0.08, t1: 0.36, rep: 0.12, box: [-72, 72, 32, 10, 105], dmg: skillDmg(1.1, 0.12, lv), stun: 0.4, knock: 90, launch: 200, hs: 0.05 }],
    events: [slashAt(0.08, { a0: -3.1, a1: 0.2, r: 64, w: 16, off: [0, 55], squash: 0.45 }), slashAt(0.2, { a0: 0.2, a1: 3.3, r: 64, w: 16, off: [0, 55], squash: 0.45, silent: true })] }) };
SKILLS.rise = { name: '升龙破', cls: 'sword', lvReq: 9, maxLv: 10, mp: 65, cd: 12, desc: '持剑冲天而起，将前方敌人卷入连续斩击并带到高空。',
  icon: 'rise', col: '#e0602a',
  act: (lv) => ({ name: 'rise', clip: 'up', dur: 0.8, superArmor: true, noCounter: true, move: [[0.06, 0.4, 60, 520]], lowGrav: 0.5, airOnly: false,
    hits: [{ t0: 0.06, t1: 0.42, rep: 0.08, box: [-10, 64, 30, -10, 130], dmg: skillDmg(0.7, 0.08, lv), airLift: 520, knock: 20, hs: 0.03 },
      { t0: 0.46, t1: 0.52, box: [-10, 80, 32, -20, 140], dmg: skillDmg(2.4, 0.25, lv), down: true, knock: 180, hs: 0.1, shake: 4 }],
    update: e => { if (e.actT < 0.45 && Math.random() < 0.6) fxSlash({ x: e.x, y: e.y, z: e.z, face: e.face, col: '#ffa060', a0: 1.2, a1: -1.6, r: rnd(40, 60), w: 10, off: [10, 50], dur: 0.12 }); },
    onLand: e => { e.endAct(); } }) };
SKILLS.focus = { name: '剑意', cls: 'sword', lvReq: 3, maxLv: 10, mp: 30, cd: 30, buff: true, desc: '凝聚剑意，20 秒内攻击力提升，攻击与移动速度提升。',
  icon: 'focus', col: '#8a60e0',
  act: (lv) => ({ name: 'focus', clip: 'idle', dur: 0.4, noCounter: true,
    onStart: e => { e.buffs = e.buffs || {}; e.buffs.focus = { t: 20, atk: 0.12 + 0.02 * lv, spd: 0.1 }; sfx.buff(); fxAura(e, '#b48cff', 1); } }) };
SKILLS.awaken = { name: '破晓·一闪', cls: 'sword', lvReq: 8, maxLv: 3, mp: 150, cd: 60, awaken: true, desc: '【觉醒】时间凝滞的一瞬间，斩开整个画面的所有敌人。',
  icon: 'awaken', col: '#ffd23a',
  act: (lv) => ({ name: 'awaken', clip: 'iai', dur: 1.6, superArmor: true, noCounter: true,
    onStart: e => { e.invul = 1.8; game.cutin = { t: 0, dur: 1.0, name: '破晓·一闪', who: e }; game.timeStop = 0.9; sfx.awaken(); },
    events: [evAt(0.95, e => {
      cam.flash = 0.35; cam.flashCol = '#ffffff'; cam.shake = 12; sfx.iai(); sfx.boom(1.2);
      for (let i = 0; i < 5; i++) fxStreak({ x: cam.x - 40, y: e.y + (i - 2) * 30, z: 40 + i * 12, face: 1, len: WW + 80, w: 18, col: '#ffe070', dur: 0.4 });
      for (let i = 0; i < 7; i++) game.after(i * 0.05, () => fxSlashX(cam.x + 90 + i * 130, e.y + rnd(-25, 25), rnd(50, 110), rnd(150, 210), '#ffe070'));
      for (const t of ents) if (hittable(e, t) && Math.abs(t.x - (cam.x + WW / 2)) < WW / 2 + 20)
        applyHit(e, t, { dmg: skillDmg(14, 4, lv), down: true, knock: 220, hs: 0.2, big: 2.2, col: '#ffe070', critBonus: 0.3 }, { proj: true });
    })] }) };
// 立即判定（不依赖动作的命中窗口）：用于冲击波、拔刀等
function instantHit(e, h) {
  const B = atkBox(e, h);
  for (const t of ents) if (hittable(e, t) && overlaps(B, t)) applyHit(e, t, h);
}
const SWORD_SKILL_ORDER = ['upslash', 'triple', 'wave', 'slam', 'focus', 'iai', 'spin', 'awaken', 'flurry', 'rise'];
