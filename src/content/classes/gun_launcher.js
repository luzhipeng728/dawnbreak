/* =====================================================================
   转职：枪炮师（女）—— 重火器（固伤职业：技能按独立攻击力 indep 结算）。加农炮、反坦克炮、激光炮、聚焦喷火器、FM-31 榴弹发射器、量子爆弹、X-1 压缩量子炮，觉醒 远古粒子炮（重炮掌控者）
   ===================================================================== */
const lblast = (e, x, y, r, h, o) => blast(e, x, y, r, { type: 'indep', ...h }, o);   // 枪炮师的范围攻击一律按独立攻击结算
// 炮弹：直线飞行，碰到第一个敌人或飞到尽头爆炸
function cannonShell(e, o) {
  let hitT = null;
  return shootProj(e, { img: 'shell', w: 46, h: 18, speed: o.speed || 700, life: o.life || 0.7, z: 62, dx: 46, bw: 12, bh: 24, pierce: false, trail: '#ffb060',
    hit: { dmg: o.dmg, knock: 60, stun: 0.4, hs: 0.06, snd: 'blunt', ...o.hit }, onHitT: (pr, t) => { hitT = t; },
    onEnd: pr => { const x = o.behind && hitT ? hitT.x + pr.face * 55 : pr.x, y = hitT ? hitT.y : pr.y; meteorImpact({ x, y }, o.big || 0.7);
      lblast(e, x, y, o.r || 80, { dmg: o.boom, launch: o.launch ?? 380, knock: 120, hs: 0.1, snd: 'fire', col: '#ffb060', elem: o.elem, type: 'indep' }, { zMax: 160 }); } });
}
defSkill('gl_cannon', { name: '加农炮', cls: 'gun', job: 'launcher', lvReq: 20, mp: 40, cd: 7, type: 'indep', col: '#5a4a3a',
  desc: '扛起手炮发射炮弹，命中后爆炸。按住技能键蓄力（最长 0.8 秒）提高威力；发射时霸体。', pow: lv => skillDmg(4.5, 0.45, lv), ai: { kind: 'proj', r: [60, 450], dy: 16 },
  act: (lv) => ({ name: 'gl_cannon', clip: 'cannon', dur: 0.75, cancelFrom: 0.55, superArmor: true, noCounter: true,
    charge: { at: 0.12, max: 0.8, min: 0, dmg: 0.8, update: e => { if (Math.random() < 0.4) fxCharge(e, '#ffb060'); } },
    events: [evAt(0.2, e => { sfx.cannon(); cam.shake = Math.max(cam.shake, 4); e.play('cannonFire', true); e.vx = -e.face * 120; const m = e.act.dmgMul;
      cannonShell(e, { dmg: skillDmg(1.5, 0.15, lv), boom: skillDmg(3.0, 0.3, lv) * m, big: 0.6 + (e.act.chargeK || 0) * 0.4, r: 70 + (e.act.chargeK || 0) * 40 }); })] }) });
defSkill('gl_antitank', { name: '反坦克炮', cls: 'gun', job: 'launcher', lvReq: 20, mp: 40, cd: 8, type: 'indep', elem: 'fire', col: '#8a3a1a',
  desc: '发射火属性反坦克炮弹，命中敌人后在它的身后爆炸，把敌人炸向自己一侧。', pow: lv => skillDmg(4.8, 0.48, lv), ai: { kind: 'proj', r: [40, 420], dy: 16 },
  act: (lv) => ({ name: 'gl_antitank', clip: 'cannon', dur: 0.62, cancelFrom: 0.46, superArmor: [0.1, 0.3],
    events: [evAt(0.16, e => { sfx.cannon(); e.play('cannonFire', true); cannonShell(e, { dmg: skillDmg(1.4, 0.14, lv), boom: skillDmg(3.4, 0.34, lv), behind: true, elem: 'fire', hit: { elem: 'fire' } }); })] }) });
defSkill('gl_laser', { name: '激光炮', cls: 'gun', job: 'launcher', lvReq: 25, mp: 50, cd: 10, type: 'indep', elem: 'light', col: '#3a9ae0',
  desc: '蓄能后发射光属性激光，攻击范围窄但射程极远，贯穿路径上的所有敌人（多段）。', pow: lv => skillDmg(6.0, 0.6, lv), ai: { kind: 'burst', r: [0, 700], dy: 12 },
  act: (lv) => ({ name: 'gl_laser', clip: 'laser', dur: 1.1, noCounter: true, superArmor: true, cancelFrom: 0.95,
    update: e => { if (e.actT < 0.4 && Math.random() < 0.6) fxCharge(e, '#8fe0ff'); },
    events: [evAt(0.02, () => sfx.charge()), evAt(0.4, e => { e.play('laserFire', true); sfx.iai(); cam.shake = 5; fxBeam(e.x + e.face * 50, e.y, e.z + 50, 760, e.face, { w: 46, dur: 0.6, col: '#8fe0ff' }); }),
      ...[0.42, 0.52, 0.62, 0.72, 0.82].map(t => evAt(t, e => instantHit(e, { box: [40, 800, 14, 30, 80], dmg: skillDmg(1.2, 0.12, lv), stun: 0.4, knock: 60, airLift: 150, hs: 0.04, col: '#bff0ff', elem: 'light' })))] }) });
defSkill('gl_flame', { name: '聚焦喷火器', cls: 'gun', job: 'launcher', lvReq: 30, mp: 55, cd: 12, type: 'indep', elem: 'fire', col: '#e0802a',
  desc: '喷出高温聚焦火焰（2.5 秒），射程远，喷射中可以缓慢移动。按住技能键持续，松开停止。', pow: lv => skillDmg(7.0, 0.7, lv), ai: { kind: 'poke', r: [0, 240], dy: 18 },
  act: (lv) => ({ name: 'gl_flame', clip: 'flame', dur: 2.6, noCounter: true, superArmor: true, cancelFrom: 0.5,
    onInput: (e, I) => { e.vx = I.dx() * 40; e.vy = I.dy() * 40; if (e.actT > 0.5 && !I.is(e.act.key || 'cmd')) e.act.dur = Math.min(e.act.dur, e.actT + 0.1); return false; },
    update: e => { const n = Math.floor(e.actT / 0.05); if (n !== e.act.k && e.actT > 0.1 && e.actT < e.act.dur - 0.1) { e.act.k = n; if (n % 3 === 0) sfx.flame(); flameJet(e, { dmg: skillDmg(0.14, 0.014, lv), range: 250, speed: 640, burn: 0.07 }); } },
    onEnd: e => { e.vx = 0; e.vy = 0; } }) });
defSkill('gl_fm31', { name: 'FM-31 榴弹发射器', cls: 'gun', job: 'launcher', lvReq: 35, mp: 55, cd: 12, type: 'indep', col: '#6a6a3a',
  desc: '连续发射 5 发曲射榴弹，由近到远依次落地爆炸。', pow: lv => skillDmg(7.5, 0.75, lv), ai: { kind: 'proj', r: [80, 340], dy: 40 },
  act: (lv) => ({ name: 'gl_fm31', clip: 'cannon', dur: 0.9, cancelFrom: 0.75,
    events: [0.12, 0.24, 0.36, 0.48, 0.6].map((t, i) => evAt(t, e => { sfx.cannon(0.5); e.play('cannonFire', true);
      lobProj(e, e.x + e.face * (110 + i * 55), e.y + rnd(-10, 10), 0.5, { img: 'grenade', h: 14, vz: 200, onLand: pr => { meteorImpact(pr, 0.4); lblast(e, pr.x, pr.y, 55, { dmg: skillDmg(1.5, 0.15, lv), launch: 300, knock: 60, hs: 0.05, snd: 'fire' }); } }); }))
  }) });
defSkill('gl_quantum', { name: '量子爆弹', cls: 'gun', job: 'launcher', lvReq: 40, mp: 70, cd: 20, type: 'indep', elem: 'light', col: '#3a6ae0',
  desc: '按下遥控器，呼叫卫星在指定位置投下量子爆弹（施放后 0.5 秒内可用方向键移动落点），大范围爆炸，有几率使敌人感电眩晕。', pow: lv => skillDmg(9.0, 0.9, lv), ai: { kind: 'aoe', r: [100, 320], dy: 60 },
  act: (lv) => ({ name: 'gl_quantum', clip: 'quantum', dur: 0.8, cancelFrom: 0.6, noCounter: true,
    onStart: e => { const at = aimAhead(e, 220, 400); e.act.tx = at.x; e.act.ty = at.y; sfx.charge();
      e.act.g = telegraph({ x: at.x, y: at.y, r: 110, dur: 1.1, kind: 'circle', col: '#6ab0ff', friendly: true, fire: g => {
        fxSpr('thunderbolt', g.x, g.y, 0, { h: 540, dur: 0.35, ay: 1, col: '#8fd0ff' }); fxSpr('quantum', g.x, g.y, 40, { w: 260, dur: 0.6, grow: [0.3, 1.2] }); fxShock(g.x, g.y, 240, '#8fd0ff');
        cam.shake = 10; cam.flash = 0.15; cam.flashCol = '#cfe8ff'; sfx.boom(1.2);
        lblast(e, g.x, g.y, 120, { dmg: skillDmg(9.0, 0.9, lv), launch: 480, knock: 140, hs: 0.12, big: 1.8, elem: 'light', col: '#bfe8ff', downHit: true, onHit: (a, t) => { if (Math.random() < 0.35) addStatus(t, 'stun', 1.2, { src: a }); } }, { zMax: 240 }); } }); },
    onInput: (e, I) => { const g = e.act.g; if (g && e.actT < 0.5) { g.x += I.dx() * 4; g.y = clamp(g.y + I.dy() * 3, 8, DEPTH - 8); } return false; } }) });
defSkill('gl_x1', { name: 'X-1 压缩量子炮', cls: 'gun', job: 'launcher', lvReq: 45, mp: 80, cd: 25, type: 'indep', col: '#2a5ad0',
  desc: '蓄能（按住技能键最长 1 秒）后发射缓慢前进的压缩量子球，蓄得越满吸附范围越大，带着敌人前进后爆炸。', pow: lv => skillDmg(11, 1.1, lv), ai: { kind: 'proj', r: [0, 360], dy: 40 },
  act: (lv) => ({ name: 'gl_x1', clip: 'laser', dur: 0.7, noCounter: true, superArmor: true, cancelFrom: 0.55,
    charge: { at: 0.1, max: 1.0, min: 0.1, dmg: 0.6, update: e => { if (Math.random() < 0.5) fxCharge(e, '#6ab0ff'); } },
    events: [evAt(0.2, e => { e.play('laserFire', true); sfx.cannon(0.8); const k = e.act.chargeK || 0, R = 90 + k * 70;
      const pr = shootProj(e, { img: 'quantum', w: 60 + k * 30, speed: 170, life: 1.8, z: 50, dx: 50, bw: 26, bh: 60, pierce: true, spin: 3,
        hit: { dmg: skillDmg(0.4, 0.04, lv), stun: 0.3, knock: 0, airLift: 60, hs: 0.02, rep: 0.2 },
        update: (p, dt) => { for (const t of ents) if (hittable(e, t) && Math.hypot(t.x - p.x, (t.y - p.y) * 1.4) < R && !(t.boss && hasSA(t))) { t.x = damp(t.x, p.x, 4, dt); t.y = damp(t.y, p.y, 4, dt); } },
        onEnd: p => { fxSpr('quantum', p.x, p.y, 40, { w: 220 + k * 80, dur: 0.5, grow: [0.4, 1.3] }); fxShock(p.x, p.y, 200, '#8fd0ff'); cam.shake = 9; sfx.boom(1.1);
          lblast(e, p.x, p.y, R, { dmg: skillDmg(7, 0.7, lv), launch: 480, knock: 140, hs: 0.12, big: 1.8, col: '#bfe8ff' }, { zMax: 200 }); } }); })] }) });
defSkill('gl_awaken', { name: '远古粒子炮', cls: 'gun', job: 'launcher', lvReq: 18, maxLv: 3, mp: 150, cd: 60, pvp: 0.45, type: 'indep', awaken: true, col: '#e0a02a',
  desc: '【觉醒】架起远古巨炮，蓄能后向前方发射贯穿整个画面的粒子光束，连续命中后引发大爆炸。', pow: lv => skillDmg(22, 6, lv), ai: { kind: 'awaken', r: [0, 700], dy: 50 },
  act: (lv) => ({ name: 'gl_awaken', clip: 'lAwk', dur: 2.8, superArmor: true, noCounter: true, invul: [0, 1.2],
    onStart: e => { game.cutin = { t: 0, dur: 1.0, name: '远古粒子炮', who: e }; game.timeStop = 0.9; sfx.awaken(); },
    update: e => { if (e.actT > 0.95 && e.actT < 1.35 && Math.random() < 0.8) fxCharge(e, '#ffd070', 2); },
    events: [evAt(1.35, e => { e.play('lAwkFire', true); cam.flash = 0.25; cam.flashCol = '#fff0c0'; sfx.cannon(1.5); sfx.iai(); fxBeam(e.x + e.face * 70, e.y, e.z + 48, 1000, e.face, { w: 110, dur: 1.2, col: '#ffe090' }); }),
      ...Array.from({ length: 10 }, (_, i) => evAt(1.4 + i * 0.1, e => { cam.shake = Math.max(cam.shake, 6); instantHit(e, { box: [40, 1000, 40, 0, 120], dmg: skillDmg(1.4, 0.4, lv), stun: 0.5, knock: 30, airLift: 140, hs: 0.03, col: '#ffe0a0', sure: true, downHit: true }); })),
      evAt(2.45, e => { cam.shake = 12; sfx.boom(1.4); for (const t of ents) if (hittable(e, t) && (t.x - e.x) * e.face > 0 && Math.abs(t.x - e.x) < 1000 && Math.abs(t.y - e.y) < 60) { meteorImpact(t, 0.6); applyHit(e, t, { dmg: skillDmg(8, 2, lv), launch: 500, knock: 200, hs: 0.15, big: 2, sure: true, downHit: true }, { proj: true }); } })] }) });
CLASSES.gun.jobs.launcher = { art: 'job/launcher', name: '枪炮师', role: '远程 · 重火力', armor: 'heavy', awaken: 'gl_awaken', awakenName: '重炮掌控者',
  desc: '操纵重火器的枪手。攻击缓慢但范围大、威力高，加农炮、激光炮、量子爆弹覆盖整个战场。',
  skills: ['gl_cannon', 'gl_antitank', 'gl_laser', 'gl_flame', 'gl_fm31', 'gl_quantum', 'gl_x1', 'gl_awaken'] };
CLASSES.gun.cmds.push(['uf', 'gl_cannon'], ['bf', 'gl_antitank'], ['ff', 'gl_laser'], ['buf', 'gl_flame'], ['uff', 'gl_fm31'], ['ud', 'gl_quantum'], ['bbf', 'gl_x1'], ['uudd', 'gl_awaken']);
