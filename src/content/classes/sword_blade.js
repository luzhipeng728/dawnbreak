/* =====================================================================
   转职：剑魂（鬼剑士）—— 剑术大师。里·鬼剑术延长普攻，流心系列、拔刀斩、猛龙断空斩、幻影剑舞，觉醒 极·鬼剑术（暴风式）
   ===================================================================== */
const flowMul = p => 1 + buffVal(p, 'flowDmg');
defSkill('backslash', { name: '后跳斩', cls: 'sword', job: 'blade', lvReq: 15, mp: 8, cd: 2, type: 'phys', air: true, col: '#3ab0d0',
  desc: '后跳中按 X：向后翻身的同时向前斩击，把敌人砸向地面。', cmdNote: '后跳中 X', pow: lv => skillDmg(2.0, 0.2, lv), ai: { kind: 'escape' },
  act: (lv) => ({ name: 'backslash', clip: 'backslash', dur: 0.5, noCounter: true, move: [[0, 0.3, -180]], lowGrav: 0.8,
    onStart: e => { if (e.z < 20) { e.vz = Math.max(e.vz, 260); e.z = Math.max(e.z, 1); } },
    hits: [HB(0.06, 0.2, [-10, 76, 30, -40, 100], skillDmg(2.0, 0.2, lv), { spike: 380, bounce: 0.5, knock: 60, hs: 0.08, shake: 2, big: 1.3 })],
    events: [slashAt(0.05, { a0: -2.6, a1: 1.4, r: 66, w: 20, off: [12, 50], heavy: true })],
    onLand: e => { e.vx *= 0.3; if (e.actT > 0.2) e.endAct(); } }) });
defSkill('rikiken', { name: '里·鬼剑术', cls: 'sword', job: 'blade', lvReq: 15, mp: 0, cd: 0, type: 'phys', passive: true, col: '#5a8ad0',
  desc: '【被动】普攻第三段之后追加回旋斩；技能等级 5 以上再追加跃步重劈。追加段的伤害随技能等级提升。', pow: lv => 1.3 + (lv >= 5 ? 2.1 : 0),
  infoExtra: lv => [['追加段数', lv >= 5 ? '2' : '1']] });
/* ---- 流心：进入流心待命状态，按 X 流心·刺、C 流心·跃、Z 流心·升 ---- */
defSkill('flow', { name: '流心', cls: 'sword', job: 'blade', lvReq: 20, maxLv: 1, mp: 5, cd: 0.5, type: 'phys', col: '#3a8ab0',
  desc: '收剑凝神进入流心状态（约 1.5 秒）：按 X 施放流心·刺，按 C 施放流心·跃，按 Z 施放流心·升。', ai: { kind: 'stance' },
  act: () => ({ name: 'flow', clip: 'charge', dur: 1.5, noCounter: true, cancelable: true, cancelFrom: 0.05,
    onStart: e => { fxAura(e, '#8fd8ff', 0.5); sfx.charge(); },
    onInput: (e, I) => {
      for (const [key, id] of [['attack', 'flow_stab'], ['jump', 'flow_leap'], ['cmd', 'flow_rise']]) if (I.buffered(key) && hasSkill(e, id)) { I.consume(key); if (key === 'cmd') I.consume('cmdB'); castSkill(e, id, false, key); return true; }
      return false;
    } }) });
defSkill('flow_stab', { name: '流心·刺', cls: 'sword', job: 'blade', lvReq: 20, mp: 15, cd: 3, type: 'phys', col: '#4aa0e0', cmdNote: '流心中 X',
  desc: '流心状态下按 X：瞬间突进刺穿前方敌人，多段攻击后击退。', pow: lv => skillDmg(2.4, 0.24, lv), ai: { kind: 'gap', r: [0, 170], dy: 20 },
  act: (lv, p) => ({ name: 'flow_stab', clip: 'dash', dur: 0.42, cancelFrom: 0.3, noCounter: true, move: [[0.02, 0.2, 620]],
    hits: [HB(0.02, 0.24, [-10, 70, 28, 20, 100], skillDmg(0.6, 0.06, lv) * flowMul(p), { rep: 0.05, max: 3, stun: 0.35, knock: 30, hs: 0.03, snd: 'stab' }),
      HB(0.24, 0.3, [0, 70, 28, 20, 100], skillDmg(0.6, 0.06, lv) * flowMul(p), { knock: 220, stun: 0.5, hs: 0.08, heavy: true, shake: 2 })],
    events: [evAt(0.01, e => { fxAfterimage(e, '#8fd8ff'); fxStreak({ x: e.x - e.face * 30, y: e.y, z: e.z + 60, face: e.face, len: 190, w: 14, col: '#8fd8ff', dur: 0.24 }); sfx.iai(); })] }) });
defSkill('flow_leap', { name: '流心·跃', cls: 'sword', job: 'blade', lvReq: 25, mp: 20, cd: 4, type: 'phys', col: '#3a70c0', cmdNote: '流心中 C（空中再按 X 下斩）',
  desc: '流心状态下按 C：向前高高跃起（可用 ↑↓ 调整纵深），空中再按 X 挥剑下斩，落地冲击使敌人倒地。', pow: lv => skillDmg(3.0, 0.3, lv), ai: { kind: 'gap', r: [80, 240], dy: 40 },
  act: (lv, p) => ({ name: 'flow_leap', clip: 'leap', dur: 1.6, noCounter: true, superArmor: true,
    onStart: e => { e.vz = 520; e.z = Math.max(e.z, 1); e.vx = e.face * 260; sfx.jump(); fxDust(e.x, e.y, 5, 12); },
    onInput: (e, I) => { e.vy = I.dy() * 90; if (!e.act.dive && e.actT > 0.12 && I.buffered('attack')) { I.consume('attack'); e.act.dive = true; } return false; },
    update: e => { if (!e.act.diving && (e.act.dive || e.actT > 0.5)) { e.act.diving = true; e.vz = -1100; e.vx = e.face * 140; e.play('silver', true); sfx.swing(true); } },
    hits: [HB(0, 1.6, [-10, 50, 28, -40, 60], skillDmg(0.8, 0.08, lv) * flowMul(p), { stun: 0.3, spike: 420, bounce: 0.4, hs: 0.05 })],
    onLand: e => { e.vx = 0; e.vy = 0; e.act.hits = null; e.act.dur = e.actT + 0.32; e.act.onLand = null; e.play('leapLand', true); cam.shake = Math.max(cam.shake, 6); sfx.boom(0.8);
      fxShock(e.x + e.face * 20, e.y, 140, '#8fd8ff'); fxDust(e.x, e.y, 10, 30);
      blast(e, e.x + e.face * 20, e.y, 100, { dmg: skillDmg(2.2, 0.22, lv) * flowMul(p), down: true, knock: 160, hs: 0.09, downHit: true, big: 1.4 }); } }) });
defSkill('flow_rise', { name: '流心·升', cls: 'sword', job: 'blade', lvReq: 30, mp: 20, cd: 4, type: 'phys', col: '#5ac0f0', cmdNote: '流心中 Z',
  desc: '流心状态下按 Z：向上连续斩击把敌人卷上高空，攻击空中的敌人时伤害提升。', pow: lv => skillDmg(3.2, 0.32, lv), ai: { kind: 'launch', r: [0, 70], dy: 22 },
  act: (lv, p) => ({ name: 'flow_rise', clip: 'up', dur: 0.62, cancelFrom: 0.45, noCounter: true, superArmor: [0, 0.3], move: [[0.04, 0.3, 50, 300]], lowGrav: 0.6,
    hits: [HB(0.05, 0.32, [-10, 70, 30, -10, 150], skillDmg(0.8, 0.08, lv) * flowMul(p), { rep: 0.07, max: 4, launch: 460, airLift: 420, knock: 20, hs: 0.04, onHit: (a, t) => { if (t.cmb.air > 1) t.hp -= Math.round(t.lastDmg * 0.3); } })],
    update: e => { if (e.actT < 0.32 && Math.random() < 0.5) fxSlashOn(e, { col: '#9fe8ff', a0: 1.2, a1: -1.6, r: rnd(44, 62), w: 10, off: [10, 50], dur: 0.12 }); },
    onLand: e => { if (e.actT > 0.1) e.endAct(); } }) });
defSkill('flow_frenzy', { name: '流心·狂', cls: 'sword', job: 'blade', lvReq: 30, mp: 40, cd: 30, type: 'phys', buff: true, col: '#2a60c0', cmdNote: '快捷栏',
  desc: '【BUFF】30 秒内流心·刺 / 跃 / 升的伤害提升。', infoExtra: lv => [['流心技能伤害', '+' + pct(0.2 + 0.03 * lv)]], ai: { kind: 'buff' },
  act: (lv) => ({ name: 'flow_frenzy', clip: 'focus', dur: 0.4, noCounter: true, onStart: e => { e.buffs.flow_frenzy = { t: 30, flowDmg: 0.2 + 0.03 * lv }; sfx.buff(); fxAura(e, '#6ac8ff', 1); } }) });
defSkill('rise', { name: '破军升龙击', cls: 'sword', job: 'blade', lvReq: 30, mp: 45, cd: 10, type: 'phys', icon: 'rise', col: '#e0602a',
  desc: '霸体向前冲撞，撞到敌人后挥剑上斩，连续斩击把敌人带上高空。', pow: lv => skillDmg(5.0, 0.5, lv), ai: { kind: 'launch', r: [0, 150], dy: 24 },
  act: (lv) => ({ name: 'rise', clip: 'dash', dur: 1.0, superArmor: true, noCounter: true, move: [[0, 0.24, 480]],
    hits: [HB(0.02, 0.24, [-10, 60, 28, 10, 100], skillDmg(1.2, 0.12, lv), { knock: 20, stun: 0.5, hs: 0.05 })],
    update: e => {
      const a = e.act;
      if (!a.up && (e.actT >= 0.24 || e.hitsDone.size)) { a.up = true; a.upT = e.actT; e.vx = e.face * 50; e.vz = 560; e.z = Math.max(e.z, 1); e.play('rise', true); sfx.swing(true);
        a.hits = [HB(a.upT, a.upT + 0.34, [-10, 66, 30, -10, 140], skillDmg(0.7, 0.07, lv), { rep: 0.07, airLift: 520, launch: 520, knock: 20, hs: 0.03 }),
          HB(a.upT + 0.38, a.upT + 0.44, [-10, 80, 32, -20, 150], skillDmg(1.4, 0.14, lv), { down: true, knock: 180, hs: 0.1, shake: 4, big: 1.4 })]; }
      if (a.up && e.actT - a.upT < 0.36 && Math.random() < 0.6) fxSlashOn(e, { col: '#ffa060', a0: 1.2, a1: -1.6, r: rnd(40, 60), w: 10, off: [10, 50], dur: 0.12 });
    },
    lowGrav: 0.5, onLand: e => { if (e.act.up && e.actT - e.act.upT > 0.1) e.endAct(); } }) });
defSkill('iai', { name: '拔刀斩', cls: 'sword', job: 'blade', lvReq: 35, mp: 60, cd: 12, type: 'phys', icon: 'iai', col: '#d8a02a',
  desc: '收刀蓄势（按住技能键可延长蓄势，伤害提升），瞬间拔刀斩出贯穿前方的巨大剑光。蓄势期间霸体。命中的敌人越少伤害越高。', pow: lv => skillDmg(6.5, 0.7, lv), ai: { kind: 'burst', r: [0, 260], dy: 30 },
  act: (lv) => ({ name: 'iai', clip: 'iai', dur: 0.95, superArmor: true, noCounter: true, cancelFrom: 0.72,
    charge: { at: 0.3, max: 0.6, min: 0, dmg: 0.5, update: (e, dt, k) => { if (Math.random() < 0.5) fxCharge(e, '#ffd070'); e.drawOpts = { glow: 0.3 + k * 0.7 }; } },
    update: (e) => { if (!e.act.charging) e.drawOpts = { glow: e.actT < 0.4 ? e.actT / 0.4 : Math.max(0, 1 - (e.actT - 0.4) * 3) }; },
    onEnd: (e) => { e.drawOpts = {}; },
    events: [evAt(0.02, () => sfx.charge()), evAt(0.4, e => {
      cam.flash = 0.12; cam.flashCol = '#fff6d0'; cam.shake = 7; sfx.iai();
      fxStreak({ x: e.x, y: e.y, z: e.z + 60, face: e.face, len: 300, w: 26, col: '#ffd070', dur: 0.3 }); fxBurst(e.x + e.face * 150, e.y, e.z + 60, 170, '#ffd070');
      const n = Math.max(1, ents.filter(t => foe(e, t) && overlaps(atkBox(e, { box: [0, 300, 34, 0, 130] }), t)).length);
      instantHit(e, { box: [0, 300, 34, 0, 130], dmg: skillDmg(6.5, 0.7, lv) * (1 + 0.5 / n), down: true, knock: 280, hs: 0.14, big: 1.8, col: '#ffe0a0', critBonus: 0.2, downHit: true });
    })] }) });
defSkill('dragon', { name: '猛龙断空斩', cls: 'sword', job: 'blade', lvReq: 40, mp: 60, cd: 15, type: 'phys', col: '#2a6ad0',
  desc: '化作一道剑光连续突进斩击（最多 4 次，每次可用方向键改变突进方向，包括纵深），最后一击上挑浮空。霸体。', pow: lv => skillDmg(7.0, 0.7, lv), ai: { kind: 'gap', r: [0, 220], dy: 60 },
  act: (lv) => ({ name: 'dragon', clip: 'dragon', dur: 1.3, superArmor: true, noCounter: true,
    onStart: e => { e.act.seg = -1; },
    update: e => {
      const a = e.act, seg = Math.floor(e.actT / 0.22);
      if (seg !== a.seg && seg < 4) {
        a.seg = seg; e.hitsDone.clear();
        let dx = e.pad.dx(), dy = e.pad.dy(); if (!dx && !dy) dx = e.face; if (dx) e.face = dx;
        if (!e.pad || e.pad !== input) { const t = nearestFoe(e, 400); if (t && e.pad !== input) { dx = Math.sign(t.x - e.x) || e.face; dy = Math.sign(t.y - e.y) * (Math.abs(t.y - e.y) > 10 ? 1 : 0); e.face = dx; } }
        const l = Math.hypot(dx, dy * 1.3) || 1; a.vx = dx / l * 620; a.vy = dy / l * 380;
        fxAfterimage(e, '#8fb8ff'); sfx.swing(true); fxStreak({ x: e.x - e.face * 20, y: e.y, z: e.z + 58, face: e.face, len: 150, w: 14, col: '#8fb8ff', dur: 0.2 });
      }
      if (seg < 4) { const k = (e.actT % 0.22) < 0.16; e.vx = k ? a.vx : a.vx * 0.2; e.vy = k ? a.vy : a.vy * 0.2; }
      else if (!a.fin) { a.fin = true; e.vx = e.face * 60; e.vy = 0; e.play('up', true); fxSlashOn(e, { col: '#8fb8ff', a0: 1.4, a1: -1.9, r: 70, w: 22, off: [10, 50] }); sfx.swing(true);
        instantHit(e, { box: [-10, 84, 32, 0, 130], dmg: skillDmg(2.2, 0.22, lv), launch: 560, knock: 60, hs: 0.1, shake: 4, big: 1.5 }); }
    },
    hits: [HB(0, 0.88, [-20, 60, 30, 10, 100], skillDmg(1.2, 0.12, lv), { rep: 0.22, stun: 0.5, knock: 40, airLift: 200, hs: 0.04 })],
    onEnd: e => { e.vy = 0; } }) });
defSkill('phantom', { name: '幻影剑舞', cls: 'sword', job: 'blade', lvReq: 45, mp: 80, cd: 20, type: 'phys', col: '#4a50c8',
  desc: '原地舞出幻影般的连斩，连按 X 增加斩击次数，↑↓ 调整方向，最后放出剑气击飞前方敌人。霸体。', pow: lv => skillDmg(9.0, 0.9, lv), ai: { kind: 'burst', r: [0, 100], dy: 24 },
  act: (lv) => ({ name: 'phantom', clip: 'phantom', dur: 2.2, superArmor: true, noCounter: true,
    onStart: e => { e.act.end = 1.5; },
    onInput: (e, I) => { if (I.buffered('attack')) { I.consume('attack'); e.act.end = Math.min(2.4, e.act.end + 0.08); } e.vy = I.dy() * 60; return false; },
    update: e => {
      const a = e.act; a.dur = a.end + 0.5;
      if (e.actT < a.end && Math.floor(e.actT / 0.07) !== a.k) { a.k = Math.floor(e.actT / 0.07); fxSlashOn(e, { col: '#b0c0ff', a0: rnd(-3, 0), a1: rnd(0, 3), r: rnd(50, 72), w: 10, off: [16, rnd(35, 70)], squash: rnd(0.4, 0.9), dur: 0.1, silent: a.k % 2 === 1 }); }
      if (e.actT >= a.end && !a.fin) { a.fin = true; e.play('atk3', true); sfx.iai(); cam.shake = Math.max(cam.shake, 5);
        projWave(e, { speed: 520, life: 0.6, hit: { dmg: skillDmg(3.0, 0.3, lv), launch: 460, knock: 200, hs: 0.1, big: 1.6, rep: 0 } }); }
    },
    hits: [HB(0, 2.4, [-20, 88, 34, 0, 120], skillDmg(0.35, 0.035, lv), { rep: 0.07, stun: 0.3, knock: 10, airLift: 140, hs: 0.02, snd: 'slash' })],
    onEnd: e => { e.vy = 0; } }) });
defSkill('awaken', { name: '极·鬼剑术（暴风式）', cls: 'sword', job: 'blade', lvReq: 18, maxLv: 3, mp: 150, cd: 60, pvp: 0.45, type: 'phys', awaken: true, icon: 'awaken', col: '#ffd23a',
  desc: '【觉醒】唤出 24 把鬼剑组成剑阵，把周围的敌人吸到中心反复斩击，最后引爆剑阵。剑阵展开后无敌。', pow: lv => skillDmg(22, 6, lv), ai: { kind: 'awaken', r: [0, 300], dy: 90 },
  act: (lv) => ({ name: 'awaken', clip: 'awkB', dur: 2.9, superArmor: true, noCounter: true, invul: [0.1, 2.9],
    onStart: e => { game.cutin = { t: 0, dur: 1.0, name: '极·鬼剑术', who: e }; game.timeStop = 0.9; sfx.awaken(); e.act.cx = e.x + e.face * 130; e.act.cy = e.y; },
    update: (e, dt) => {
      const a = e.act; if (e.actT < 0.95) return;
      for (const t of ents) if (hittable(e, t) && Math.hypot(t.x - a.cx, (t.y - a.cy) * 1.5) < 280 && !(t.boss && hasSA(t))) { t.x = damp(t.x, a.cx, 4, dt); t.y = damp(t.y, a.cy, 4, dt); }
      if (e.actT < 2.4 && Math.floor(e.actT / 0.08) !== a.k) {
        a.k = Math.floor(e.actT / 0.08); const ang = a.k * 2.4, r = 70 + (a.k % 3) * 40;
        fxSpr('swordrain', a.cx + Math.cos(ang) * r, a.cy + Math.sin(ang) * r * 0.4, 30, { h: 110, dur: 0.35, ay: 1, grow: [1.2, 1], alpha: 0.9 });
        if (a.k % 2) { fxSlashX(a.cx + rnd(-60, 60), a.cy + rnd(-20, 20), rnd(40, 90), rnd(90, 140), '#bfe8ff'); sfx.swing(false); }
        blast(e, a.cx, a.cy, 170, { dmg: skillDmg(0.6, 0.18, lv), airLift: 160, stun: 0.3, knock: 0, hs: 0.02, downHit: true, sure: true }, { zMax: 260 });
      }
    },
    events: [evAt(0.95, e => { cam.flash = 0.2; cam.flashCol = '#dff4ff'; fxShock(e.act.cx, e.act.cy, 300, '#9fe8ff'); }),
      evAt(2.45, e => { const a = e.act; cam.flash = 0.35; cam.flashCol = '#ffffff'; cam.shake = 12; sfx.iai(); sfx.boom(1.2);
        fxBurst(a.cx, a.cy, 60, 320, '#bfe8ff'); fxShock(a.cx, a.cy, 280, '#ffffff');
        blast(e, a.cx, a.cy, 240, { dmg: skillDmg(8, 2.5, lv), launch: 520, knock: 200, hs: 0.2, big: 2.2, critBonus: 0.3, downHit: true, sure: true, col: '#ffe070' }, { zMax: 300 }); })] }) });
CLASSES.sword.jobs.blade = { art: 'job/blade', name: '剑魂', role: '近战 · 连击', armor: 'light', awaken: 'awaken', awakenName: '剑圣',
  desc: '专精剑术的鬼剑士。里·鬼剑术让普攻连段更长，流心系列、拔刀斩、猛龙断空斩打出华丽的连招。',
  skills: ['backslash', 'rikiken', 'flow', 'flow_stab', 'flow_leap', 'flow_rise', 'flow_frenzy', 'rise', 'iai', 'dragon', 'phantom', 'awaken'] };
CLASSES.sword.cmds.push(['bff', 'rise'], ['bdf', 'iai'], ['uff', 'dragon'], ['fdf', 'phantom'], ['uudd', 'awaken']);
