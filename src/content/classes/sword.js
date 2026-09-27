/* =====================================================================
   职业：鬼剑士（男）—— 普攻、基础技能、职业定义（转职：剑魂 sword_blade.js、狂战士 sword_berserker.js）
   ===================================================================== */
/* ---- 普攻：三段斩击（剑魂的里·鬼剑术追加第 4、5 段）、跑攻突刺 → 连突刺、跳斩、后跳（剑魂可接后跳斩）---- */
const SWORD_ACTS = {
  atk1: { name: 'atk1', dur: 0.32, basic: true, speed: 'aspd', chain: [0.12, 0.32], next: 'atk2', move: [[0.02, 0.08, 110]],
    hits: [HB(0.06, 0.11, [0, 72, 28, 18, 100], 1.0, { stun: 0.3, knock: 50, hs: 0.055 })],
    events: [slashAt(0.05, { a0: -2.4, a1: 0.7, r: 54, w: 15, off: [14, 58], squash: 0.72 })] },
  atk2: { name: 'atk2', dur: 0.34, basic: true, speed: 'aspd', chain: [0.12, 0.34], next: 'atk3', move: [[0.02, 0.08, 100]],
    hits: [HB(0.06, 0.11, [0, 70, 28, 18, 110], 1.05, { stun: 0.32, knock: 55, hs: 0.055 })],
    events: [slashAt(0.05, { a0: 1.0, a1: -2.1, r: 52, w: 15, off: [12, 56], squash: 0.8 })] },
  atk3: { name: 'atk3', dur: 0.46, basic: true, speed: 'aspd', chain: [0.24, 0.46], next: p => skLv(p, 'rikiken') > 0 ? 'atk4' : null, move: [[0.06, 0.15, 230]],
    hits: [HB(0.12, 0.18, [0, 84, 30, 0, 115], 1.6, { stun: 0.5, knock: 230, hs: 0.09, shake: 3, big: 1.3, heavy: true })],
    events: [slashAt(0.11, { a0: -2.7, a1: 1.1, r: 66, w: 22, off: [10, 56], squash: 0.85, heavy: true })] },
  // 里·鬼剑术：第 4 段回旋斩、第 5 段跃步重劈（技能等级 5 以上）
  atk4: { name: 'atk4', clip: 'atk4', dur: 0.4, basic: true, speed: 'aspd', chain: [0.2, 0.4], next: p => skLv(p, 'rikiken') >= 5 ? 'atk5' : null, move: [[0.02, 0.12, 120]],
    hits: [HB(0.06, 0.16, [-50, 80, 32, 10, 110], 1.3, { stun: 0.4, knock: 110, hs: 0.06, dmgKey: 'rikiken' })],
    events: [slashAt(0.05, { a0: -3.0, a1: 0.3, r: 64, w: 16, off: [0, 55], squash: 0.45 }), slashAt(0.12, { a0: 0.3, a1: 3.2, r: 64, w: 16, off: [0, 55], squash: 0.45, silent: true })] },
  atk5: { name: 'atk5', clip: 'atk3', dur: 0.5, basic: true, speed: 'aspd', move: [[0.04, 0.16, 260]],
    hits: [HB(0.13, 0.2, [0, 90, 32, 0, 120], 2.1, { down: true, knock: 200, hs: 0.1, shake: 4, big: 1.5, dmgKey: 'rikiken' })],
    events: [slashAt(0.12, { a0: -2.8, a1: 1.2, r: 72, w: 24, off: [10, 56], squash: 0.9, heavy: true, col: '#b7f0ff' })] },
  dash: { name: 'dash', dur: 0.45, basic: true, speed: 'aspd', move: [[0, 0.26, 420]], noCounter: true, chain: [0.14, 0.45], next: p => hasSkill(p, 'dashthrust') ? 'dash2' : null,
    hits: [HB(0.05, 0.26, [0, 58, 26, 30, 90], 1.35, { stun: 0.45, knock: 240, hs: 0.07, shake: 2, heavy: true })],
    events: [evAt(0.04, e => { fxStreak({ x: e.x, y: e.y, z: e.z + 62, face: e.face, len: 80, w: 10, col: '#8fd8ff' }); sfx.swing(true); })] },
  // 连突刺：跑攻中再按 X（技能）
  dash2: { name: 'dash2', clip: 'flurry', dur: 0.55, basic: true, speed: 'aspd', move: [[0, 0.4, 60]], noCounter: true,
    hits: [HB(0.02, 0.4, [0, 64, 26, 30, 95], 0.45, { rep: 0.08, stun: 0.3, knock: 40, hs: 0.03, snd: 'stab', dmgKey: 'dashthrust' }), HB(0.42, 0.48, [0, 70, 28, 25, 100], 1.3, { knock: 240, stun: 0.5, hs: 0.07, shake: 2, heavy: true, dmgKey: 'dashthrust' })],
    update: e => { if (e.actT < 0.4 && Math.floor(e.actT / 0.08) !== e._fl) { e._fl = Math.floor(e.actT / 0.08); fxStreak({ x: e.x + e.face * 12, y: e.y + rnd(-4, 4), z: e.z + rnd(50, 70), face: e.face, len: rnd(45, 65), w: 5, col: '#8fd8ff', dur: 0.1 }); } } },
  jatk: { name: 'jatk', dur: 0.34, basic: true, speed: 'aspd', airOnly: true, lowGrav: 0.75,
    hits: [HB(0.07, 0.17, [0, 64, 28, -30, 80], 0.95, { stun: 0.35, knock: 50, hs: 0.05, airLift: 170 })],
    events: [slashAt(0.06, { a0: -1.9, a1: 1.3, r: 48, w: 14, off: [12, 40] })] },
  back: { ...BACKSTEP, update: e => { if (e.actT > 0.04 && e.pad.buffered('attack') && hasSkill(e, 'backslash') && !(e.cool.backslash > 0)) { e.pad.consume('attack'); castSkill(e, 'backslash', false, 'attack'); } } },
};

/* ---- 基础技能 ---- */
defSkill('upslash', { name: '上挑', cls: 'sword', lvReq: 1, mp: 10, cd: 2, type: 'phys', icon: 'up', col: '#3a7fd0',
  desc: '从下向上挑斩，把敌人挑到空中。发动瞬间霸体，浮空连击的起手技。', pow: lv => skillDmg(1.8, 0.18, lv), ai: { kind: 'launch', r: [0, 72], dy: 22 },
  act: (lv) => ({ name: 'up', clip: 'up', dur: 0.46, cancelFrom: 0.26, superArmor: [0, 0.1], move: [[0.02, 0.1, 100]],
    hits: [HB(0.1, 0.18, [0, 74, 30, 0, 125], skillDmg(1.8, 0.18, lv), { launch: 520 + lv * 6, knock: 40, hs: 0.08, shake: 2, big: 1.2 })],
    events: [slashAt(0.09, { a0: 1.4, a1: -1.9, r: 62, w: 20, off: [10, 50], heavy: true })] }) });
defSkill('ghost', { name: '鬼斩', cls: 'sword', lvReq: 1, mp: 18, cd: 5, type: 'mag', elem: 'dark', col: '#6a3ab0',
  desc: '左臂的鬼神之力附在剑上，斩出带暗属性的鬼气斩击，击退前方的敌人。', pow: lv => skillDmg(2.6, 0.26, lv), ai: { kind: 'poke', r: [0, 95], dy: 26 },
  act: (lv) => ({ name: 'ghost', clip: 'ghost', dur: 0.56, cancelFrom: 0.36, move: [[0.1, 0.18, 160]],
    hits: [HB(0.14, 0.22, [0, 100, 32, 0, 120], skillDmg(2.6, 0.26, lv), { stun: 0.55, knock: 190, airLift: 220, hs: 0.09, shake: 3, heavy: true, big: 1.4 })],
    events: [evAt(0.02, e => fxSpr('ghost', e.x - e.face * 4, e.y, e.z + 60, { w: 60, dur: 0.3, follow: e, ox: -4, oz: 58, alpha: 0.6, grow: [0.6, 1] })),
      evAt(0.13, e => { sfx.swing(true); sfx.iai(); fxSpr('ghost', e.x + e.face * 55, e.y, e.z + 60, { w: 140, dur: 0.38, flip: e.face < 0, grow: [0.7, 1.15] }); })] }) });
defSkill('guard', { name: '格挡', cls: 'sword', lvReq: 5, mp: 5, cd: 2, type: 'phys', col: '#4a8ac8',
  desc: '举剑挡住前方的攻击，吸收大部分伤害（被打会后退）。按住技能键可以持续格挡。抓取攻击无法格挡。', pow: null,
  infoExtra: lv => [['伤害吸收', pct(Math.min(0.9, 0.5 + 0.04 * lv))]], ai: { kind: 'guard' },
  act: (lv) => ({ name: 'guard', clip: 'guard', dur: 3, noCounter: true, guard: Math.min(0.9, 0.5 + 0.04 * lv), cancelFrom: 0.2,
    update: e => { e.vx = 0; if (e.actT > 0.25 && !e.pad.is(e.act.key || 'attack')) e.endAct(); } }) });
defSkill('silver', { name: '银光落刃', cls: 'sword', lvReq: 5, mp: 12, cd: 3, type: 'phys', air: true, airOnly: true, col: '#9ab8d8',
  desc: '跳跃中使用：持剑向下急刺。跳得越高伤害越高，足够高时落地产生冲击波。', pow: lv => skillDmg(2.4, 0.24, lv), cmdNote: '跳跃中 Z', ai: { kind: 'air' },
  act: (lv) => ({ name: 'silver', clip: 'silver', dur: 2, noCounter: true, superArmor: true,
    onStart: e => { e.act.z0 = e.z; e.vz = -1050; e.vx = e.face * 90; sfx.swing(true); },
    hits: [HB(0, 2, [-10, 44, 26, -40, 50], skillDmg(0.9, 0.09, lv), { stun: 0.35, spike: 500, bounce: 0.5, hs: 0.05, knock: 30 })],
    onLand: e => {
      const h = clamp(e.act.z0 / 140, 0.4, 1.4); e.vx = 0; e.act.hits = null; e.act.dur = e.actT + 0.26; e.act.onLand = null; e.play('silverLand', true);
      cam.shake = Math.max(cam.shake, 3 + h * 3); sfx.boom(0.5 + h * 0.3); fxDust(e.x, e.y, 8, 24);
      instantHit(e, { box: [-20, 50, 30, -5, 60], dmg: skillDmg(1.5, 0.15, lv) * h, down: true, knock: 120, hs: 0.08, downHit: true });
      if (e.act.z0 > 60) { fxShock(e.x, e.y, 110 * h, '#cfe6ff'); blast(e, e.x, e.y, 95 * h, { dmg: skillDmg(1.2, 0.12, lv) * h, launch: 260, knock: 120, hs: 0.05, downHit: true }); }
    } }) });
defSkill('aircut', { name: '空中连斩', cls: 'sword', lvReq: 5, mp: 10, cd: 3, type: 'phys', air: true, airOnly: true, col: '#5ab0e0',
  desc: '跳跃中使用：在空中连续斩击，最后一斩把敌人砸向地面。', pow: lv => skillDmg(2.2, 0.22, lv), cmdNote: '跳跃中快捷栏', ai: { kind: 'air' },
  act: (lv) => ({ name: 'aircut', clip: 'aircut', dur: 0.62, airOnly: true, lowGrav: 0.25, noCounter: true,
    onStart: e => { e.vz = Math.max(e.vz, 60); },
    hits: [HB(0.04, 0.4, [0, 70, 30, -30, 90], skillDmg(0.5, 0.05, lv), { rep: 0.1, stun: 0.3, airLift: 130, knock: 20, hs: 0.035 }),
      HB(0.44, 0.52, [0, 76, 30, -40, 90], skillDmg(0.8, 0.08, lv), { spike: 420, bounce: 0.45, knock: 60, hs: 0.08, shake: 2 })],
    events: [0.03, 0.13, 0.23, 0.33].map((t, i) => slashAt(t, { a0: i % 2 ? 1.2 : -2.2, a1: i % 2 ? -2.2 : 1.2, r: 50, w: 12, off: [12, 40], silent: i > 0 })).concat([slashAt(0.43, { a0: -1.4, a1: 1.6, r: 60, w: 18, off: [14, 40], heavy: true })]) }) });
defSkill('dashthrust', { name: '连突刺', cls: 'sword', lvReq: 5, mp: 0, cd: 0, type: 'phys', passive: true, maxLv: 5, col: '#3aa0c0',
  desc: '【被动】跑动攻击（前冲攻击）中再按 X，追加一连串突刺，最后一击击退敌人。', cmdNote: '跑攻中 X', pow: lv => 0.45 * 5 + 1.3 });
defSkill('slam', { name: '崩山击', cls: 'sword', lvReq: 10, mp: 22, cd: 4, type: 'phys', icon: 'slam', col: '#b8602a', air: true,
  desc: '向前跃起后挥剑重砸地面，冲击多段、最后一击使敌人倒地。按住技能键跳得更远；跳到一半开启霸体，落地瞬间无敌。', pow: lv => skillDmg(3.2, 0.3, lv), ai: { kind: 'gap', r: [60, 190], dy: 30 },
  act: (lv) => ({ name: 'slam', clip: 'a3slam', dur: 1.3, noCounter: true, superArmor: [0.18, 1.3],
    charge: { at: 0.02, max: 0.35, min: 0, dmg: 0.2, clip: 'charge', onRelease: (e, k) => { e.act.leap = 170 + k * 170; } },
    events: [evAt(0.03, e => { if (e.z <= 1) { e.vz = 500; e.z = 1; } e.vx = e.face * (e.act.leap || 170); sfx.jump(); })],
    update: e => { if (e.actT > 0.3 && !e.slamDive) { e.slamDive = true; e.vz = -1100; } },
    onLand: e => { if (e.actT < 0.08) { e.vz = 0; return; } e.slamDive = false; e.vx = 0; e.invul = Math.max(e.invul, 0.15); slamImpact(e, skillDmg(1.1, 0.1, lv)); e.act.dur = e.actT + 0.36; e.act.onLand = null; },
    onEnd: e => { e.slamDive = false; } }) });
function slamImpact(e, dmg) {
  cam.shake = Math.max(cam.shake, 7); fxDust(e.x, e.y, 14, 40); sfx.boom(1);
  fxShock(e.x + e.face * 30, e.y, 160, '#ffb060'); fxBurst(e.x + e.face * 30, e.y, 15, 100, '#ffb060');
  // 多段冲击：前两段小浮空，第三段倒地
  for (let i = 0; i < 3; i++) game.after(i * 0.07, () => { if (!e.dead) instantHit(e, { box: [-50, 130, 50, -5, 70], dmg, airLift: 120, launch: i < 2 ? 160 : 0, down: i === 2, knock: i === 2 ? 200 : 40, hs: 0.05, big: 1.2 + i * 0.2, col: '#ffcf8a', downHit: i === 2 }); });
}
defSkill('rip', { name: '裂波斩', cls: 'sword', lvReq: 10, mp: 30, cd: 7, type: 'mag', col: '#3a9ae0',
  desc: '向上刺出带抓取判定的一剑（可以抓住霸体和格挡中的敌人），随后释放裂波，多段攻击周围的敌人并把它们击飞。', pow: lv => skillDmg(4.2, 0.42, lv), ai: { kind: 'grab', r: [0, 70], dy: 20 },
  act: (lv) => ({ name: 'rip', clip: 'rip', dur: 0.95, noCounter: true, superArmor: [0.2, 0.9], move: [[0.02, 0.1, 140]],
    hits: [HB(0.08, 0.18, [0, 72, 26, 10, 120], skillDmg(1.0, 0.1, lv), { grab: true, stun: 0.4, hs: 0.06 })],
    grabAt: [40, 50],
    hold: (e, t) => { const k = clamp((e.actT - 0.12) / 0.2, 0, 1); t.x = e.x + e.face * 42; t.y = e.y + 0.5; t.z = e.z + 20 + k * 45; t.face = -e.face; },
    events: [slashAt(0.08, { a0: 1.2, a1: -1.6, r: 64, w: 18, off: [10, 50], heavy: true }),
      ...[0.3, 0.4, 0.5, 0.6].map((t, i) => evAt(t, e => { fxShock(e.x, e.y, 100 + i * 14, '#8fd8ff'); fxSpr('wave', e.x + e.face * 40, e.y, 0, { h: 90, dur: 0.25, ay: 1, alpha: 0.7, flip: e.face < 0 }); sfx.swing(false);
        blast(e, e.x + e.face * 30, e.y, 110, { dmg: skillDmg(0.55, 0.055, lv), airLift: 160, stun: 0.35, hs: 0.03, knock: 30 }, { zMax: 140 }); })),
      evAt(0.72, e => { cam.shake = Math.max(cam.shake, 5); sfx.boom(0.7); fxBurst(e.x + e.face * 40, e.y, e.z + 70, 180, '#8fd8ff');
        throwGrab(e, { dmg: skillDmg(1.2, 0.12, lv), launch: 480, knock: 120, hs: 0.1, big: 1.5 });
        blast(e, e.x + e.face * 30, e.y, 120, { dmg: skillDmg(1.0, 0.1, lv), launch: 420, knock: 100, hs: 0.06 }, { zMax: 160 }); })] }) });
defSkill('triple', { name: '三段斩', cls: 'sword', lvReq: 15, mp: 25, cd: 6, type: 'phys', icon: 'triple', col: '#2aa0a0',
  desc: '边向前滑行边斩击，再次按键追加第二、三段（最多三段），每段之间可以用方向键转向。常用作位移。', pow: lv => skillDmg(1.3, 0.14, lv) * 3.4, ai: { kind: 'gap', r: [20, 160], dy: 26 },
  act: (lv) => tripleStage(lv, 1) });
function tripleStage(lv, n) {
  return { name: 'triple' + n, clip: n === 2 ? 'atk2' : n === 3 ? 'atk3' : 'dash', dur: 0.34, cancelFrom: 0.22, move: [[0, 0.18, 520]], noCounter: true,
    follow: n < 3 ? () => tripleStage(lv, n + 1) : null, followWin: [0.1, 0.34],
    hits: [HB(0.02, 0.2, [-10, 60, 28, 10, 105], skillDmg(1.3, 0.14, lv) * (n === 3 ? 1.4 : 1), { stun: 0.45, knock: n === 3 ? 260 : 120, hs: 0.06, shake: n === 3 ? 3 : 1.5, launch: n === 3 ? 260 : 0 })],
    events: [evAt(0.01, e => { fxAfterimage(e); fxStreak({ x: e.x - e.face * 20, y: e.y, z: e.z + 58, face: e.face, len: 110, w: 12, col: '#7ff0e0' }); sfx.swing(n === 3); })] };
}
function projWave(p, o) {   // 地面剑气：沿地面推进
  spawnProj({ owner: p, x: p.x + p.face * 30, y: p.y, z: 0, vx: p.face * (o.speed || 380), face: p.face, life: o.life || 0.7, w: 26, d: 26, h: 90,
    hit: { knock: 170, hs: 0.05, col: '#9fe6ff', shake: 1.5, ...o.hit },
    draw(c, pr) {
      const X = sx(pr.x), Y = sy(pr.y, 0), k = pr.t / pr.life, a = k > 0.75 ? (1 - k) / 0.25 : Math.min(1, k * 10);
      const img = o.col ? fxTint(o.img || 'wave', o.col) : o.img || 'wave';
      for (let i = 2; i >= 0; i--) drawSpr(c, img, X - i * 16 * pr.face, Y + 6, 0, (o.h || 100) - i * 18, { ay: 1, flip: pr.face < 0, alpha: a * (1 - i * 0.3) });
    } });
}
defSkill('wave', { name: '地裂·波动剑', cls: 'sword', lvReq: 15, mp: 20, cd: 3.5, type: 'mag', icon: 'wave', col: '#5a60d8',
  desc: '以剑击地，放出沿地面推进的波动剑气，击退沿途敌人并使其倒地。', pow: lv => skillDmg(2.2, 0.22, lv), ai: { kind: 'proj', r: [0, 300], dy: 22 },
  act: (lv) => ({ name: 'wave', clip: 'atk3', dur: 0.52, cancelFrom: 0.32,
    events: [slashAt(0.12, { a0: -2.6, a1: 1.2, r: 60, w: 18, off: [10, 56], heavy: true }), evAt(0.15, p => { projWave(p, { hit: { dmg: skillDmg(2.2, 0.22, lv), down: true, downLift: 180 } }); cam.shake = Math.max(cam.shake, 3); sfx.boom(0.5); })] }) });
defSkill('cross', { name: '十字斩', cls: 'sword', lvReq: 15, mp: 16, cd: 3.5, type: 'phys', col: '#c02a3a',
  desc: '交叉斩出两剑，并在原地留下血十字，使敌人出血。狂战士的血之狂暴状态下威力提升。', pow: lv => skillDmg(2.8, 0.28, lv), ai: { kind: 'poke', r: [0, 80], dy: 22 },
  act: (lv, p) => { const bz = p && p.buffs && p.buffs.frenzy ? 1.3 : 1; return { name: 'cross', clip: 'cross', dur: 0.52, cancelFrom: 0.34, move: [[0.02, 0.1, 90]],
    hits: [HB(0.05, 0.1, [0, 76, 30, 10, 110], skillDmg(0.9, 0.09, lv) * bz, { stun: 0.4, knock: 40, hs: 0.05 }), HB(0.17, 0.22, [0, 76, 30, 10, 110], skillDmg(0.9, 0.09, lv) * bz, { stun: 0.45, knock: 60, hs: 0.06 })],
    events: [slashAt(0.04, { a0: -2.2, a1: 1.0, r: 58, w: 16, off: [10, 55], col: '#ff8a8a' }), slashAt(0.16, { a0: 1.0, a1: -2.2, r: 58, w: 16, off: [10, 55], col: '#ff8a8a' }),
      evAt(0.24, e => { const x = e.x + e.face * 58; fxSpr('crossx', x, e.y, e.z + 60, { w: 110, dur: 0.5, grow: [0.5, 1.1], col: '#ff4a4a' }); sfx.hit('crit', false);
        blast(e, x, e.y, 55, { dmg: skillDmg(1.0, 0.1, lv) * bz, stun: 0.5, knock: 90, hs: 0.07, col: '#ff6a6a' }, { zMax: 120, status: 'bleed', sdur: 3, dps: 0.08 * bz }); })] }; } });

/* ---- 职业定义 ---- */
Object.assign(CLASSES.sword, {
  name: '鬼剑士', desc: '左臂寄宿着鬼神的剑士。连段流畅、浮空强势，指令技能丰富。', model: () => buildSwordsman(), dmgType: 'phys', acts: SWORD_ACTS, airMax: 1,
  skills: ['upslash', 'ghost', 'guard', 'silver', 'aircut', 'dashthrust', 'slam', 'rip', 'triple', 'wave', 'cross'],
  start: ['upslash', 'ghost'], bar: ['upslash', 'ghost', null, null, null, null, null, null, null, null, null, null],
  // 指令：[方向序列, 技能 id, 按键]（f 前 b 后 u 上 d 下；hold = 按住→；按键省略 = Z，attack = X，buff = Space，jump = C）
  cmds: [['', 'upslash'], ['', 'silver'], ['u', 'ghost'], ['dd', 'guard', 'attack'], ['fd', 'slam'], ['fu', 'rip'], ['hold', 'triple'], ['df', 'wave'], ['bf', 'cross']],
  jobs: {}, passives: [],
});
