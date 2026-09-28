/* =====================================================================
   职业：鬼剑士（男）—— 普攻、基础技能、职业定义（转职：剑魂 sword_blade.js、狂战士 sword_berserker.js）
   按国服现版（2026）对齐，设计与取舍见 docs/SKILLS_OFFICIAL_sword.md
   ===================================================================== */
/* ---- 普攻：三段斩击、跑攻突刺 → 连突刺、跳斩（学了空之连刃可在空中连斩 3 下）、后跳（后跳中 Z 银光落刃，剑魂可接后跳斩）----
   各转职改写普攻：狂战士狂暴之力 = 二刀流（SWORD_ACTS_BZ）；swordActs(p) 按转职 / BUFF 挑选，passives 每 0.25 秒刷新一次 p.acts */
const SWORD_ACTS = {
  atk1: { name: 'atk1', dur: 0.32, basic: true, speed: 'aspd', chain: [0.12, 0.32], next: 'atk2', move: [[0.02, 0.08, 110]],
    hits: [HB(0.06, 0.11, [0, 72, 28, 18, 100], 1.0, { stun: 0.3, knock: 50, hs: 0.055 })],
    events: [slashAt(0.05, { a0: -2.4, a1: 0.7, r: 54, w: 15, off: [14, 58], squash: 0.72 })] },
  atk2: { name: 'atk2', dur: 0.34, basic: true, speed: 'aspd', chain: [0.12, 0.34], next: 'atk3', move: [[0.02, 0.08, 100]],
    hits: [HB(0.06, 0.11, [0, 70, 28, 18, 110], 1.05, { stun: 0.32, knock: 55, hs: 0.055 })],
    events: [slashAt(0.05, { a0: 1.0, a1: -2.1, r: 52, w: 15, off: [12, 56], squash: 0.8 })] },
  atk3: { name: 'atk3', dur: 0.46, basic: true, speed: 'aspd', move: [[0.06, 0.15, 230]],
    hits: [HB(0.12, 0.18, [0, 84, 30, 0, 115], 1.6, { stun: 0.5, knock: 230, hs: 0.09, shake: 3, big: 1.3, heavy: true })],
    events: [slashAt(0.11, { a0: -2.7, a1: 1.1, r: 66, w: 22, off: [10, 56], squash: 0.85, heavy: true })] },
  dash: { name: 'dash', dur: 0.45, basic: true, speed: 'aspd', move: [[0, 0.26, 420]], noCounter: true, chain: [0.14, 0.45], next: p => hasSkill(p, 'dashthrust') ? 'dash2' : null,
    hits: [HB(0.05, 0.26, [0, 58, 26, 30, 90], 1.35, { stun: 0.45, knock: 240, hs: 0.07, shake: 2, heavy: true })],
    events: [evAt(0.04, e => { fxStreak({ x: e.x, y: e.y, z: e.z + 62, face: e.face, len: 80, w: 10, col: '#8fd8ff' }); sfx.swing(true); })] },
  // 连突刺：跑攻中再按 X（技能）
  dash2: { name: 'dash2', clip: 'flurry', dur: 0.55, basic: true, speed: 'aspd', move: [[0, 0.4, 60]], noCounter: true,
    hits: [HB(0.02, 0.4, [0, 64, 26, 30, 95], 0.45, { rep: 0.08, stun: 0.3, knock: 40, hs: 0.03, snd: 'stab', dmgKey: 'dashthrust' }), HB(0.42, 0.48, [0, 70, 28, 25, 100], 1.3, { knock: 240, stun: 0.5, hs: 0.07, shake: 2, heavy: true, dmgKey: 'dashthrust' })],
    update: e => { if (e.actT < 0.4 && Math.floor(e.actT / 0.08) !== e._fl) { e._fl = Math.floor(e.actT / 0.08); fxStreak({ x: e.x + e.face * 12, y: e.y + rnd(-4, 4), z: e.z + rnd(50, 70), face: e.face, len: rnd(45, 65), w: 5, col: '#8fd8ff', dur: 0.1 }); } } },
  jatk: { name: 'jatk', dur: 0.34, basic: true, speed: 'aspd', airOnly: true, lowGrav: 0.75, chain: [0.16, 0.34], next: p => hasSkill(p, 'aircut') ? 'jatk2' : null,
    hits: [HB(0.07, 0.17, [0, 64, 28, -30, 80], 0.95, { stun: 0.35, knock: 50, hs: 0.05, airLift: 170 })],
    events: [slashAt(0.06, { a0: -1.9, a1: 1.3, r: 48, w: 14, off: [12, 40] })] },
  // 空之连刃：空中第 2、3 斩（按技能等级成长），第 3 斩把敌人砸向地面
  jatk2: { name: 'jatk2', clip: 'jatkB', dur: 0.3, basic: true, speed: 'aspd', airOnly: true, lowGrav: 0.3, chain: [0.14, 0.3], next: 'jatk3',
    hits: [HB(0.05, 0.14, [0, 70, 30, -30, 90], 1.0, { stun: 0.35, knock: 30, hs: 0.05, airLift: 150, dmgKey: 'aircut' })],
    events: [slashAt(0.04, { a0: 1.2, a1: -2.2, r: 52, w: 14, off: [12, 40] })] },
  jatk3: { name: 'jatk3', clip: 'jatkC', dur: 0.36, basic: true, speed: 'aspd', airOnly: true, lowGrav: 0.5,
    hits: [HB(0.06, 0.16, [0, 76, 30, -40, 90], 1.3, { spike: 420, bounce: 0.45, knock: 60, hs: 0.08, shake: 2, dmgKey: 'aircut' })],
    events: [slashAt(0.05, { a0: -1.4, a1: 1.6, r: 60, w: 18, off: [14, 40], heavy: true })] },
  back: { ...BACKSTEP, update: e => {
    if (e.actT > 0.04 && e.pad.buffered('attack') && hasSkill(e, 'backslash') && !(e.cool.backslash > 0)) { e.pad.consume('attack'); castSkill(e, 'backslash', false, 'attack'); }
    else if (e.actT > 0.06 && e.z > 2 && e.pad.buffered('cmd') && hasSkill(e, 'silver') && !(e.cool.silver > 0)) { e.pad.consume('cmd'); e.pad.consume('cmdB'); castSkill(e, 'silver', false, 'cmd'); }   // 后跳中 Z：银光落刃（官方）
  } },
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
const guardPhys = lv => Math.min(0.8, 0.4 + 0.04 * (lv - 1)), guardMag = lv => Math.min(0.6, 0.15 + 0.05 * (lv - 1));   // 官方：物理 40→80%，魔法 15→60%
defSkill('guard', { name: '格挡', cls: 'sword', lvReq: 5, mp: 5, cd: 2, type: 'phys', col: '#4a8ac8',
  desc: '举剑挡住前方的攻击（被打会后退）。物理攻击吸收较多，魔法攻击吸收较少。按住技能键可以持续格挡。抓取攻击无法格挡。', pow: null,
  infoExtra: lv => [['物理伤害吸收', pct(guardPhys(lv))], ['魔法伤害吸收', pct(guardMag(lv))]], ai: { kind: 'guard' },
  act: (lv) => ({ name: 'guard', clip: 'guard', dur: 3, noCounter: true, guard: guardPhys(lv), guardMag: guardMag(lv), cancelFrom: 0.2,
    update: e => { e.vx = 0; if (e.actT > 0.25 && !e.pad.is(e.act.key || 'attack')) e.endAct(); } }) });
defSkill('silver', { name: '银光落刃', cls: 'sword', lvReq: 5, mp: 12, cd: 3, type: 'phys', air: true, airOnly: true, col: '#9ab8d8',
  desc: '跳跃中或后跳中使用：持剑向下急刺。跳得越高伤害越高，足够高时落地产生冲击波把敌人击倒。', pow: lv => skillDmg(2.4, 0.24, lv), cmdNote: '跳跃中 / 后跳中 Z', ai: { kind: 'air' },
  act: (lv) => ({ name: 'silver', clip: 'silver', dur: 2, noCounter: true, superArmor: true,
    onStart: e => { e.act.z0 = e.z; e.vz = -1050; e.vx = e.face * 90; sfx.swing(true); },
    hits: [HB(0, 2, [-10, 44, 26, -40, 50], skillDmg(0.9, 0.09, lv), { stun: 0.35, spike: 500, bounce: 0.5, hs: 0.05, knock: 30 })],
    onLand: e => {
      const h = clamp(e.act.z0 / 140, 0.4, 1.4); e.vx = 0; e.act.hits = null; e.act.dur = e.actT + 0.26; e.act.onLand = null; e.play('silverLand', true);
      cam.shake = Math.max(cam.shake, 3 + h * 3); sfx.boom(0.5 + h * 0.3); fxDust(e.x, e.y, 8, 24);
      instantHit(e, { box: [-20, 50, 30, -5, 60], dmg: skillDmg(1.5, 0.15, lv) * h, down: true, knock: 120, hs: 0.08, downHit: true });
      if (e.act.z0 > 60) { fxShock(e.x, e.y, 110 * h, '#cfe6ff'); blast(e, e.x, e.y, 95 * h, { dmg: skillDmg(1.2, 0.12, lv) * h, launch: 260, knock: 120, hs: 0.05, downHit: true }); }
    } }) });
defSkill('aircut', { name: '空之连刃', cls: 'sword', lvReq: 5, mp: 0, cd: 0, type: 'phys', passive: true, maxLv: 10, col: '#5ab0e0',
  desc: '【被动】跳跃中可以连按 X 连续斩击（最多 3 斩），第 2、3 斩按本技能的攻击力计算，第 3 斩把敌人砸向地面。', cmdNote: '跳跃中连按 X', pow: lv => (1.0 + 1.3) * (1 + 0.08 * (lv - 1)) });
defSkill('dashthrust', { name: '连突刺', cls: 'sword', lvReq: 5, mp: 0, cd: 0, type: 'phys', passive: true, maxLv: 5, col: '#3aa0c0',
  desc: '【被动】跑动攻击（前冲攻击）中再按 X，追加一连串突刺，最后一击击退敌人。', cmdNote: '跑攻中 X', pow: lv => 0.45 * 5 + 1.3 });
defSkill('slam', { name: '崩山击', cls: 'sword', lvReq: 10, mp: 22, cd: 4, type: 'phys', icon: 'slam', col: '#b8602a', air: true,
  desc: '向前跃起后挥剑重砸地面，冲击多段、最后一击使敌人倒地。按住技能键跳得更远；跳到一半开启霸体，落地瞬间无敌。', pow: lv => skillDmg(3.2, 0.3, lv), ai: { kind: 'gap', r: [60, 190], dy: 30 },
  act: (lv) => ({ name: 'slam', clip: 'a3slam', dur: 1.3, noCounter: true, superArmor: [0.18, 1.3],
    charge: { at: 0.02, max: 0.35, min: 0, dmg: 0.2, clip: 'charge', onRelease: (e, k) => { e.act.leap = 170 + k * 170; } },
    events: [evAt(0.03, e => { if (e.z <= 1) { e.vz = 500; e.z = 1; } e.vx = e.face * (e.act.leap || 170); sfx.jump(); })],
    update: e => { if (e.actT > 0.3 && !e.slamDive) { e.slamDive = true; e.vz = -1100; } },
    onLand: e => { if (e.actT < 0.08) { e.vz = 0; return; } e.slamDive = false; e.vx = 0; e.invul = Math.max(e.invul, 0.15); slamImpact(e, skillDmg(1.1, 0.1, lv)); e.act.dur = e.actT + (e.buffs.rampage ? 0.18 : 0.36); e.act.onLand = null;
      if (hasSkill(e, 'bz_vigor')) game.after(0.22, () => { if (e.dead) return; const x = e.x + e.face * 90; fxSpr('bloodwave', x, e.y, 0, { h: 120, dur: 0.35, ay: 1, flip: e.face < 0, grow: [0.5, 1] }); sfx.boom(0.5);
        blast(e, x, e.y, 80, { dmg: skillDmg(0.8, 0.08, lv), knock: 120, down: true, hs: 0.05, col: '#ff5a5a', downHit: true }, { zMax: 90, status: 'bleed', sdur: 7, dps: 0.05 }); }); },
    onEnd: e => { e.slamDive = false; } }) });
function slamImpact(e, dmg) {
  cam.shake = Math.max(cam.shake, 7); fxDust(e.x, e.y, 14, 40); sfx.boom(1);
  fxShock(e.x + e.face * 30, e.y, 160, '#ffb060'); fxBurst(e.x + e.face * 30, e.y, 15, 100, '#ffb060');
  // 多段冲击：前两段小浮空，第三段倒地
  const st = e.buffs && e.buffs.rampage ? 0.4 : 0;   // 暴走：硬直更大
  for (let i = 0; i < 3; i++) game.after(i * 0.07, () => { if (!e.dead) instantHit(e, { box: [-50, 130, 50, -5, 70], dmg, airLift: 120, launch: i < 2 ? 160 : 0, down: i === 2, knock: i === 2 ? 200 : 40, stun: 0.4 + st, hs: 0.05, big: 1.2 + i * 0.2, col: '#ffcf8a', downHit: i === 2 }); });
}
defSkill('rip', { name: '裂波斩', cls: 'sword', lvReq: 10, mp: 30, cd: 8, type: 'mag', col: '#3a9ae0',
  desc: '向上刺出带抓取判定的一剑（可以抓住霸体和格挡中的敌人），随后释放 3 段裂波攻击周围的敌人并把它们击飞。', pow: lv => skillDmg(4.2, 0.42, lv), ai: { kind: 'grab', r: [0, 70], dy: 20 },
  act: (lv) => ({ name: 'rip', clip: 'rip', dur: 0.95, noCounter: true, superArmor: [0.2, 0.9], move: [[0.02, 0.1, 140]],
    hits: [HB(0.08, 0.18, [0, 72, 26, 10, 120], skillDmg(1.0, 0.1, lv), { grab: true, stun: 0.4, hs: 0.06 })],
    grabAt: [40, 50],
    hold: (e, t) => { const k = clamp((e.actT - 0.12) / 0.2, 0, 1); t.x = e.x + e.face * 42; t.y = e.y + 0.5; t.z = e.z + 20 + k * 45; t.face = -e.face; },
    events: [slashAt(0.08, { a0: 1.2, a1: -1.6, r: 64, w: 18, off: [10, 50], heavy: true }),
      ...[0.32, 0.46, 0.6].map((t, i) => evAt(t, e => { fxShock(e.x, e.y, 100 + i * 14, '#8fd8ff'); fxSpr('wave', e.x + e.face * 40, e.y, 0, { h: 90, dur: 0.25, ay: 1, alpha: 0.7, flip: e.face < 0 }); sfx.swing(false);
        blast(e, e.x + e.face * 30, e.y, 110, { dmg: skillDmg(0.73, 0.073, lv), airLift: 160, stun: 0.35, hs: 0.03, knock: 30 }, { zMax: 140 }); })),
      evAt(0.72, e => { cam.shake = Math.max(cam.shake, 5); sfx.boom(0.7); fxBurst(e.x + e.face * 40, e.y, e.z + 70, 180, '#8fd8ff');
        throwGrab(e, { dmg: skillDmg(1.2, 0.12, lv), launch: 480, knock: 120, hs: 0.1, big: 1.5 });
        blast(e, e.x + e.face * 30, e.y, 120, { dmg: skillDmg(1.0, 0.1, lv), launch: 420, knock: 100, hs: 0.06 }, { zMax: 160 }); })] }) });
defSkill('triple', { name: '三段刃', cls: 'sword', lvReq: 15, mp: 25, cd: 6, type: 'phys', icon: 'triple', col: '#2aa0a0',
  desc: '边向前滑行边斩击，再次按键追加下一段（最多 5 段，最后一段上挑浮空），每段之间可以用方向键转向。常用作位移。', pow: lv => skillDmg(1.3, 0.14, lv) * 5.4, ai: { kind: 'gap', r: [20, 160], dy: 26 },
  act: (lv) => tripleStage(lv, 1) });
const TRIPLE_N = 5;   // 现版 5 段（2025 年 TP 并入本体）
function tripleStage(lv, n) {
  const last = n === TRIPLE_N;
  return { name: 'triple' + n, clip: last ? 'up' : ['dash', 'atk2', 'atk3', 'atk1'][(n - 1) % 4], dur: 0.34, cancelFrom: 0.22, move: [[0, 0.18, last ? 300 : 520]], noCounter: true,
    follow: n < TRIPLE_N ? () => tripleStage(lv, n + 1) : null, followWin: [0.1, 0.34],
    hits: [HB(0.02, 0.2, [-10, 60, 28, last ? -10 : 10, last ? 130 : 105], skillDmg(1.3, 0.14, lv) * (last ? 1.4 : 1), { stun: 0.45, knock: last ? 120 : 120, hs: 0.06, shake: last ? 3 : 1.5, launch: last ? 420 : 0 })],
    events: [evAt(0.01, e => { fxAfterimage(e); fxStreak({ x: e.x - e.face * 20, y: e.y, z: e.z + 58, face: e.face, len: 110, w: 12, col: '#7ff0e0' }); sfx.swing(last); })] };
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
// 十字刃：交叉两斩 + 血十字；血十字出现时再按一次追加推击（击倒）。狂战士学了血气旺盛：改为耗 HP、十字变大并附出血
defSkill('cross', { name: '十字刃', cls: 'sword', lvReq: 15, mp: 16, cd: 6, type: 'phys', col: '#c02a3a',
  desc: '交叉斩出两剑，并召唤血十字攻击前方。血十字出现时再按一次技能键，追加一击把敌人推开击倒。可以被其他技能取消。', pow: lv => skillDmg(4.0, 0.4, lv), ai: { kind: 'poke', r: [0, 80], dy: 22 },
  infoExtra: (lv, p) => p && hasSkill(p, 'bz_vigor') ? [['血气旺盛', '耗 HP、十字变大、附带出血']] : [],
  act: (lv, p) => crossStage(lv, p, 1) });
function crossStage(lv, p, n) {
  const vig = !!(p && hasSkill(p, 'bz_vigor')), big = vig ? 1.1 : 1, fast = p && p.buffs && p.buffs.rampage;
  if (n === 2) return { name: 'cross2', clip: 'atk3', dur: 0.4, cancelFrom: 0.22, move: [[0.02, 0.1, 160]],
    hits: [HB(0.06, 0.14, [0, 90, 32, 0, 120], skillDmg(1.2, 0.12, lv), { down: true, knock: 260, stun: fast ? 0.9 : 0.5, hs: 0.09, shake: 3, heavy: true, col: '#ff6a6a', downHit: true })],
    events: [slashAt(0.05, { a0: -2.7, a1: 1.1, r: 70, w: 22, off: [10, 56], heavy: true, col: '#ff8a8a' })] };
  return { name: 'cross', clip: 'cross', dur: 0.52, cancelFrom: fast ? 0.2 : 0.3, move: [[0.02, 0.1, 90]], follow: () => crossStage(lv, p, 2), followWin: [0.26, 0.52],
    onStart: e => { if (vig) { const c = Math.round(e.hpMax * 0.01); e.hp = Math.max(1, e.hp - c); } },
    hits: [HB(0.05, 0.1, [0, 76, 30, 10, 110], skillDmg(0.9, 0.09, lv), { stun: fast ? 0.7 : 0.4, knock: 40, hs: 0.05 }), HB(0.17, 0.22, [0, 76, 30, 10, 110], skillDmg(0.9, 0.09, lv), { stun: fast ? 0.7 : 0.45, knock: 60, hs: 0.06 })],
    events: [slashAt(0.04, { a0: -2.2, a1: 1.0, r: 58, w: 16, off: [10, 55], col: '#ff8a8a' }), slashAt(0.16, { a0: 1.0, a1: -2.2, r: 58, w: 16, off: [10, 55], col: '#ff8a8a' }),
      evAt(0.24, e => { const x = e.x + e.face * 58; fxSpr('crossx', x, e.y, e.z + 60, { w: 110 * big, dur: 0.5, grow: [0.5, 1.1], col: '#ff4a4a' }); sfx.hit('crit', false);
        blast(e, x, e.y, 55 * big, { dmg: skillDmg(1.0, 0.1, lv) * big, stun: 0.5, knock: 90, hs: 0.07, col: '#ff6a6a' }, vig ? { zMax: 120, status: 'bleed', sdur: 7, dps: 0.05 } : { zMax: 120 }); })] };
}
// 刀魂之卡赞（通用 BUFF）：召唤鬼神卡赞，力量、智力提升 120 秒；鬼泣转职后改为被动，剑影不能学
defSkill('kazan', { name: '刀魂之卡赞', cls: 'sword', lvReq: 5, mp: 30, cd: 5, type: 'phys', buff: true, col: '#c0302a', excl: ['ghostblade'],
  desc: '【BUFF】召唤鬼神卡赞，120 秒内力量、智力提升（攻击力提升）。再次施放会重新召唤。', ai: { kind: 'buff' },
  infoExtra: lv => [['攻击力', '+' + pct(kazanAtk(lv))], ['持续时间', '120 秒']],
  act: (lv) => ({ name: 'kazan', clip: 'focus', dur: 0.5, noCounter: true,
    onStart: e => { e.buffs.kazan = { t: 120, atk: kazanAtk(lv) }; sfx.buff(); fxAura(e, '#ff5a4a', 1); fxSpr('ghost', e.x - e.face * 10, e.y, e.z + 70, { w: 90, dur: 0.6, alpha: 0.7, grow: [0.5, 1.1], col: '#ff6a5a' }); } }) });
const kazanAtk = lv => 0.03 + 0.005 * (lv - 1);
// 月光斩：左手月形斩（对空浮空），再按技能键追加单手上斩；按 → 前进更远、按 ← 原地
defSkill('moon', { name: '月光斩', cls: 'sword', lvReq: 15, mp: 22, cd: 4, type: 'mag', elem: 'dark', col: '#8a7ae0',
  desc: '左手挥出月牙形斩击（打到空中的敌人会浮空），再按技能键追加单手上斩。方向键控制前进距离。', pow: lv => skillDmg(3.0, 0.3, lv), ai: { kind: 'poke', r: [0, 90], dy: 22 },
  act: (lv) => moonStage(lv, 1) });
function moonStage(lv, n) {
  const step = e => { const d = e.pad.dx() * e.face; return d > 0 ? 220 : d < 0 ? 30 : 120; };
  if (n === 2) return { name: 'moon2', clip: 'up', dur: 0.44, cancelFrom: 0.3, move: [[0.02, 0.1, 110]],
    hits: [HB(0.08, 0.16, [0, 80, 30, 0, 140], skillDmg(1.6, 0.16, lv), { launch: 460, knock: 40, hs: 0.08, shake: 2 })],
    events: [slashAt(0.07, { a0: 1.4, a1: -1.9, r: 66, w: 20, off: [10, 50], col: '#c8b8ff', heavy: true })] };
  return { name: 'moon', clip: 'cross', dur: 0.46, cancelFrom: 0.3, follow: () => moonStage(lv, 2), followWin: [0.14, 0.46],
    onStart: e => { e.act.move = [[0.02, 0.12, step(e)]]; },
    hits: [HB(0.08, 0.16, [0, 86, 30, 10, 130], skillDmg(1.4, 0.14, lv), { stun: 0.4, knock: 60, airLift: 280, hs: 0.06 })],
    events: [evAt(0.07, e => { fxSpr('slash', e.x + e.face * 40, e.y, e.z + 62, { w: 120, dur: 0.25, flip: e.face < 0, col: '#b8a8ff', grow: [0.7, 1.1] }); sfx.swing(true); })] };
}
// 嗜魂之手（男鬼剑通用，现版）：带吸附的抓取 → 吸取能量（多段）→ 喷发打飞（身后的敌人也吃伤害）。抓到时无敌；抓不动的敌人改为向前喷血；
// 对出血的敌人增伤。狂战士：饥渴满蓄时吸取次数 +3，学血气旺盛附出血，二觉被动加霸体（P1）
defSkill('soulhand', { name: '嗜魂之手', cls: 'sword', lvReq: 17, mp: 35, cd: 6, type: 'phys', col: '#b01a2a',
  desc: '伸出鬼手抓住前方稍远处的敌人（可以抓住霸体和格挡中的敌人），吸取能量后喷发，把敌人和它身后的敌人一起打飞。抓住时无敌；抓不动的敌人改为向前喷血。对出血的敌人伤害提高。', pow: lv => skillDmg(4.0, 0.4, lv), ai: { kind: 'grab', r: [20, 150], dy: 22 },
  act: (lv, p) => {
    const bz = p && jobOf(p) === 'berserker', vig = !!(p && hasSkill(p, 'bz_vigor')), extra = bz && p.buffs.bz_thirst && p.buffs.bz_thirst.full ? 3 : 0;
    const ts = [0.5, 0.62, 0.74]; for (let i = 0; i < extra; i++) ts.push(0.86 + i * 0.1);
    const endT = ts[ts.length - 1] + 0.16, bleedMul = t => t.status && t.status.bleed ? 1.3 : 1;
    return { name: 'soulhand', clip: 'soulhand', dur: endT + 0.25, noCounter: true, superArmor: [0.1, endT + 0.2],
      hits: [HB(0.12, 0.3, [10, 160, 30, 0, 110], skillDmg(0.8, 0.08, lv), { grab: true, stun: 0.4, hs: 0.05 })],
      hold: (e, t) => { e.invul = Math.max(e.invul, 0.05); const k = clamp((e.actT - 0.2) / 0.25, 0, 1); t.x = damp(t.x, e.x + e.face * lerp(120, 42, k), 12, 1 / 60); t.y = e.y + 0.5; t.z = e.z + k * 55; t.face = -e.face; },
      events: [evAt(0.1, e => { sfx.swing(true); fxSpr('bloodhand', e.x + e.face * 70, e.y, e.z + 62, { w: 150, dur: 0.3, flip: e.face < 0, grow: [0.4, 1], alpha: 0.9 }); }),
        evAt(0.36, e => { if (e.grabbed) return; const x = e.x + e.face * 90;   // 没抓到（抓不动的敌人 / 落空）：向前喷血
          fxSpr('bloodpillar', x, e.y, 0, { h: 110, dur: 0.35, ay: 1, grow: [0.4, 1] }); sfx.boom(0.5);
          blast(e, x, e.y, 70, { dmg: skillDmg(2.4, 0.24, lv), knock: 160, launch: 300, hs: 0.07, col: '#ff4a5a' }, vig ? { zMax: 150, status: 'bleed', sdur: 7, dps: 0.05 } : { zMax: 150 }); e.act.dur = Math.min(e.act.dur, e.actT + 0.3); }),
        ...ts.map(t => evAt(t, e => { const g = e.grabbed; if (!g) return; applyHit(e, g, { dmg: skillDmg(0.55, 0.055, lv) * bleedMul(g), hs: 0.04, sure: true, snd: 'blunt', col: '#ff4a5a' }, { proj: true });
          fxSpr('bloodpillar', g.x, g.y, 0, { h: 70, dur: 0.3, ay: 1, alpha: 0.7 }); })),
        evAt(endT, e => { cam.shake = Math.max(cam.shake, 6); sfx.boom(0.8); const g = e.grabbed;
          if (g) { fxSpr('bloodpillar', g.x, g.y, 0, { h: 190, dur: 0.5, ay: 1, grow: [0.4, 1] }); fxBurst(g.x, g.y, g.z + 30, 170, '#ff3040');
            blast(e, g.x + e.face * 60, g.y, 70, { dmg: skillDmg(1.0, 0.1, lv), launch: 380, knock: 140, hs: 0.05, col: '#ff4a5a' }, { zMax: 150 });   // 身后的敌人
            if (vig) addStatus(g, 'bleed', 7, { dps: e.atk * 0.05, src: e }); }
          throwGrab(e, { dmg: skillDmg(1.4, 0.14, lv) * (g ? bleedMul(g) : 1), launch: 520, knock: 60, hs: 0.1, big: 1.5, col: '#ff4a5a' }); })] };
  } });

/* ---- 职业定义 ---- */
Object.assign(CLASSES.sword, {
  name: '鬼剑士', desc: '左臂寄宿着鬼神的剑士。连段流畅、浮空强势，指令技能丰富。', model: () => buildSwordsman(), dmgType: 'phys', acts: SWORD_ACTS, airMax: 1,
  skills: ['upslash', 'ghost', 'guard', 'silver', 'aircut', 'dashthrust', 'kazan', 'slam', 'rip', 'triple', 'wave', 'cross', 'moon', 'soulhand'],
  start: ['upslash', 'ghost'], bar: ['upslash', 'ghost', null, null, null, null, null, null, null, null, null, null],
  // 指令：[方向序列, 技能 id, 按键]（f 前 b 后 u 上 d 下；hold = 按住→；按键省略 = Z，attack = X，buff = Space，jump = C）
  cmds: [['', 'upslash'], ['', 'silver'], ['u', 'ghost'], ['dd', 'guard', 'attack'], ['f', 'kazan', 'buff'], ['fd', 'slam'], ['fu', 'rip'], ['hold', 'triple'], ['df', 'wave'], ['bf', 'cross'], ['uf', 'moon'], ['ff', 'soulhand']],
  jobs: {}, passives: [],
});
// 普攻动作表按转职 / BUFF 挑选（狂战士狂暴之力 = 二刀流等）：各转职文件往 SWORD_ACT_PICK 里登记 p => 动作表 | null
const SWORD_ACT_PICK = [];
function swordActs(p) { for (const f of SWORD_ACT_PICK) { const A = f(p); if (A) return A; } return SWORD_ACTS; }
CLASSES.sword.passives.push(p => {
  if (!(p.st === 'act' && p.act && p.act.basic)) p.acts = swordActs(p);   // 普攻连段中途不切换（next 指向的动作在另一张表里可能不存在）
  p.airBonus = hasSkill(p, 'aircut') ? 2 : 0;                             // 空之连刃：空中最多 3 斩
});
