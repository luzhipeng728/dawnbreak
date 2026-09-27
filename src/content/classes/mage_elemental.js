/* =====================================================================
   转职：元素师（魔法师）—— 四属性元素魔法。烈焰冲击、虚无之球、冰墙、雷旋、杰克降临、天雷、极冰盛宴、湮灭黑洞，觉醒 陨星幻灭（大魔导师）
   ===================================================================== */
defSkill('mg_flame', { name: '烈焰冲击', cls: 'mage', job: 'elemental', lvReq: 15, mp: 30, cd: 5, type: 'mag', elem: 'fire', icon: 'mg_fire', col: '#d8502a', cast: true,
  desc: '在前方敌人脚下召唤火柱，把敌人烧上天并使其灼烧。施放时可用方向键微调火柱位置。', pow: lv => skillDmg(3.6, 0.36, lv), ai: { kind: 'aoe', r: [40, 300], dy: 60 },
  act: (lv) => ({ name: 'mg_flame', clip: 'flameCast', dur: 0.62, cancelFrom: 0.42,
    events: [evAt(0.2, e => { const at = aimAhead(e, 150, 320); const I = e.pad; if (I) { at.x += I.dx() * 60; at.y = clamp(at.y + I.dy() * 40, 8, DEPTH - 8); } sfx.hit('fire', false); sfx.boom(0.4);
      groundPillar(e, at.x, at.y, { life: 0.85, hit: { dmg: skillDmg(0.6, 0.06, lv), stun: 0.3, launch: 330, knock: 10, hs: 0.03, rep: 0.14, snd: 'fire', col: '#ffb060', elem: 'fire', type: 'mag', onHit: (a, t) => addStatus(t, 'burn', 3, { dps: a.atk * 0.08, src: a }) } }); })] }) });
defSkill('mg_void', { name: '虚无之球', cls: 'mage', job: 'elemental', lvReq: 17, mp: 40, cd: 8, type: 'mag', elem: 'dark', col: '#4a1a6a', cast: true,
  desc: '放出缓慢前进的暗属性虚无之球，贯穿路径上的敌人，每 0.4 秒造成一次伤害。', pow: lv => skillDmg(4.2, 0.42, lv), ai: { kind: 'proj', r: [0, 300], dy: 20 },
  act: (lv) => ({ name: 'mg_void', clip: 'void', dur: 0.6, cancelFrom: 0.42,
    events: [evAt(0.26, e => { sfx.charge(); shootProj(e, { img: 'darkorb', w: 74, speed: 130, life: 2.4, z: 38, dx: 40, bw: 26, bh: 60, pierce: true, spin: 2, noFlip: true,
      hit: { dmg: skillDmg(0.6, 0.06, lv), stun: 0.35, knock: 10, airLift: 60, hs: 0.03, rep: 0.4, elem: 'dark', type: 'mag', col: '#c79aff' },
      onEnd: pr => { fxBurst(pr.x, pr.y, pr.z + 30, 140, '#b070ff'); sfx.boom(0.5); blast(e, pr.x, pr.y, 70, { dmg: skillDmg(1.4, 0.14, lv), launch: 300, knock: 80, hs: 0.06, elem: 'dark', type: 'mag' }, { zMax: 140 }); } }); })] }) });
defSkill('mg_icewall', { name: '冰墙', cls: 'mage', job: 'elemental', lvReq: 19, mp: 45, cd: 12, type: 'mag', elem: 'ice', col: '#6ab8e8', cast: true,
  desc: '在自身周围竖起冰墙，震开并减速周围的敌人；冰墙持续 4 秒，挡住敌人的投射物，进入的敌人被减速。', pow: lv => skillDmg(3.0, 0.3, lv), ai: { kind: 'aoe', r: [0, 110], dy: 50 },
  act: (lv) => ({ name: 'mg_icewall', clip: 'wall', dur: 0.6, cancelFrom: 0.45, superArmor: true, noCounter: true,
    events: [evAt(0.2, e => { sfx.ice(); sfx.boom(0.5); cam.shake = Math.max(cam.shake, 4); const cx = e.x, cy = e.y;
      blast(e, cx, cy, 110, { dmg: skillDmg(3.0, 0.3, lv), launch: 260, knock: 160, hs: 0.08, elem: 'ice', type: 'mag', col: '#bfefff' }, { zMax: 150, status: 'slow', sdur: 3 });
      for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; fxSpr('icewall', cx + Math.cos(a) * 95, cy + Math.sin(a) * 40, 0, { w: 70, dur: 4, ay: 0.9, add: false, grow: [0.3, 1], fadeIn: 0.03 }); }
      const wall = { t: 0, dur: 4, x: cx, y: cy, owner: e };
      game.after(0.01, function tick() { wall.t += 0.1; for (let i = projs.length - 1; i >= 0; i--) { const pr = projs[i]; if (pr.team !== e.team && Math.hypot(pr.x - cx, (pr.y - cy) * 2.2) < 110) { fxSpr('frost', pr.x, pr.y, pr.z, { w: 40, dur: 0.3 }); projs.splice(i, 1); } }
        for (const t of ents) if (foe(e, t) && Math.hypot(t.x - cx, (t.y - cy) * 2.2) < 110) addStatus(t, 'slow', 0.5, { src: e });
        if (wall.t < wall.dur && !e.dead) game.after(0.1, tick); }); })] }) });
defSkill('mg_vortex', { name: '雷旋', cls: 'mage', job: 'elemental', lvReq: 19, mp: 40, cd: 8, type: 'mag', elem: 'light', col: '#e0c82a', cast: true,
  desc: '召唤雷球绕自身旋转一圈，连续电击周围的敌人。按住技能键蓄力增加雷球数量。', pow: lv => skillDmg(3.8, 0.38, lv), ai: { kind: 'aoe', r: [0, 110], dy: 50 },
  act: (lv) => ({ name: 'mg_vortex', clip: 'thunderCast', dur: 0.5, cancelFrom: 0.36,
    charge: { at: 0.06, max: 0.6, min: 0, dmg: 0.4, update: e => { if (Math.random() < 0.4) fxCharge(e, '#fff38a'); } },
    events: [evAt(0.14, e => { sfx.zap(); const n = 3 + Math.round((e.act.chargeK || 0) * 3), m = e.act.dmgMul; for (let i = 0; i < n; i++) { const a0 = i * TAU / n;
      spawnProj({ owner: e, x: e.x, y: e.y, z: 36, face: e.face, life: 1.2, w: 14, d: 14, h: 40, pierce: true, mul: m,
        hit: { dmg: skillDmg(0.3, 0.03, lv), stun: 0.3, knock: 10, airLift: 100, hs: 0.02, rep: 0.18, elem: 'light', type: 'mag', col: '#fff6a0', snd: 'crit' },
        update(pr) { const a = a0 + pr.t * 5.5; pr.x = e.x + Math.cos(a) * 90; pr.y = clamp(e.y + Math.sin(a) * 38, 4, DEPTH - 4); },
        draw(c, pr) { drawSpr(c, 'spark', sx(pr.x), sy(pr.y, pr.z), 36, 36, { rot: pr.t * 12 }); drawSpr(c, 'orb', sx(pr.x), sy(pr.y, pr.z), 22, 22, { col: '#fff38a' }); } }); } })] }) });
defSkill('mg_jackfall', { name: '杰克降临', cls: 'mage', job: 'elemental', lvReq: 23, mp: 60, cd: 15, type: 'mag', elem: 'fire', col: '#e0702a', cast: true,
  desc: '召唤巨型杰克爆弹从天空斜线落下，落地爆炸并产生冲击波。', pow: lv => skillDmg(7.5, 0.75, lv), ai: { kind: 'aoe', r: [80, 320], dy: 60 },
  act: (lv) => ({ name: 'mg_jackfall', clip: 'jackfall', dur: 0.8, superArmor: true, noCounter: true, cancelFrom: 0.62,
    events: [evAt(0.15, e => { const at = aimAhead(e, 200, 380); sfx.charge();
      telegraph({ x: at.x, y: at.y, r: 100, dur: 0.75, kind: 'hex', col: '#ff9a3a', friendly: true, fire: g => { meteorImpact(g, 1.1); fxShock(g.x, g.y, 220, '#ffb060');
        blast(e, g.x, g.y, 100, { dmg: skillDmg(7.5, 0.75, lv), launch: 460, knock: 160, hs: 0.12, big: 1.8, snd: 'fire', col: '#ffb060', elem: 'fire', type: 'mag', downHit: true }, { zMax: 220, status: 'burn', sdur: 3, dps: 0.1 }); } });
      addFx({ x: at.x, y: at.y + 2, z: 0, dur: 0.75, add: false, draw(c) { const k = this.t / this.dur; drawSpr(c, 'jackbig', sx(this.x) - 240 * (1 - k), sy(this.y, 0) - 480 * (1 - k) - 40, 110, 0, { add: false, rot: k * 2 }); } }); })] }) });
defSkill('mg_thunder', { name: '天雷', cls: 'mage', job: 'elemental', lvReq: 23, mp: 60, cd: 15, type: 'mag', elem: 'light', icon: 'mg_chain', col: '#d8c82a', cast: true,
  desc: '召唤雷光标记（方向键移动），按 X 在标记处落下天雷（最多 6 次）。施放中自己不能移动。', pow: lv => skillDmg(1.4, 0.14, lv) * 6, ai: { kind: 'aoe', r: [40, 360], dy: 90 },
  act: (lv) => ({ name: 'mg_thunder', clip: 'thunderCast', dur: 2.6, noCounter: true, cancelFrom: 0.4,
    onStart: e => { const at = aimAhead(e, 160, 400); e.act.cx = at.x; e.act.cy = at.y; e.act.n = 0; e.act.cd = 0.3; },
    onInput: (e, I) => { const a = e.act; e.vx = e.vy = 0;
      if (isHuman(e)) { a.cx += I.dx() * 5; a.cy = clamp(a.cy + I.dy() * 3, 8, DEPTH - 8); } else { const t = nearestFoe(e, 500); if (t) { a.cx = damp(a.cx, t.x, 6, 1 / 60); a.cy = damp(a.cy, t.y, 6, 1 / 60); } }
      if ((I.buffered('attack') || !isHuman(e)) && e.actT > a.cd && a.n < 6) { I.consume('attack'); a.n++; a.cd = e.actT + 0.22; lightningStrike({ x: a.cx, y: a.cy }); sfx.zap();
        blast(e, a.cx, a.cy, 50, { dmg: skillDmg(1.4, 0.14, lv), stun: 0.5, launch: 200, knock: 20, hs: 0.07, snd: 'crit', col: '#fff6a0', elem: 'light', type: 'mag' }, { zMax: 200 }); if (a.n >= 6) a.dur = e.actT + 0.3; }
      return false; },
    update: e => { const a = e.act; addFx({ x: a.cx, y: a.cy + 1, z: 0, dur: 0.02, draw(c) { const X = sx(this.x), Y = sy(this.y, 0); c.strokeStyle = 'rgba(255,240,120,.8)'; c.lineWidth = 2; c.beginPath(); c.ellipse(X, Y, 24, 24 * GR, 0, 0, TAU); c.stroke(); c.beginPath(); c.moveTo(X - 30, Y); c.lineTo(X + 30, Y); c.moveTo(X, Y - 14); c.lineTo(X, Y + 14); c.stroke(); } }); } }) });
defSkill('mg_icefeast', { name: '极冰盛宴', cls: 'mage', job: 'elemental', lvReq: 25, mp: 70, cd: 20, type: 'mag', elem: 'ice', col: '#3a8ae0', cast: true,
  desc: '在前方展开冰之魔法阵，阵内接连召唤冰柱砸落，冰冻敌人。', pow: lv => skillDmg(8.0, 0.8, lv), ai: { kind: 'aoe', r: [60, 320], dy: 80 },
  act: (lv) => ({ name: 'mg_icefeast', clip: 'wall', dur: 0.7, superArmor: true, noCounter: true,
    events: [evAt(0.2, e => { const at = aimAhead(e, 180, 360); sfx.ice();
      telegraph({ x: at.x, y: at.y, r: 120, dur: 2.0, kind: 'frost', col: '#bfefff', friendly: true });
      for (let i = 0; i < 10; i++) game.after(0.3 + i * 0.16, () => { if (e.dead) return; const x = at.x + rnd(-100, 100), y = clamp(at.y + rnd(-45, 45), 6, DEPTH - 6); sfx.ice();
        addFx({ x, y: y + 1, z: 0, dur: 0.35, draw(c) { const k = this.t / this.dur; drawSpr(c, 'icespike', sx(this.x), sy(this.y, 0) - 300 * (1 - Math.min(1, k * 3)), 0, 80, { rot: Math.PI / 2, add: true, alpha: 1 - Math.max(0, k - 0.6) / 0.4 }); } });
        game.after(0.1, () => { fxSpr('frost', x, y, 0, { w: 90, dur: 0.4, ay: 0.75 }); blast(e, x, y, 42, { dmg: skillDmg(0.8, 0.08, lv), stun: 0.4, launch: 220, knock: 20, hs: 0.05, elem: 'ice', type: 'mag', col: '#bfefff' }, { zMax: 200, status: i === 9 ? 'freeze' : null, sdur: 1.5 }); }); }); })] }) });
defSkill('mg_hole', { name: '湮灭黑洞', cls: 'mage', job: 'elemental', lvReq: 25, mp: 70, cd: 20, type: 'mag', elem: 'dark', icon: 'mg_hole', col: '#4a2a6a', cast: true,
  desc: '在前方制造黑洞，持续把周围的敌人吸到中心，最后爆炸把它们击飞。', pow: lv => skillDmg(8.5, 0.85, lv), ai: { kind: 'aoe', r: [80, 300], dy: 80 },
  act: (lv) => ({ name: 'mg_hole', clip: 'grip', dur: 0.7, superArmor: true, noCounter: true, events: [evAt(0.15, e => {
    const at = aimAhead(e, 190, 300); sfx.charge();
    spawnProj({ owner: e, x: at.x, y: at.y, z: 30, face: e.face, life: 1.7, w: 40, d: 30, h: 90, pierce: true,
      hit: { dmg: skillDmg(0.4, 0.04, lv), stun: 0.35, knock: 0, airLift: 60, hs: 0.02, rep: 0.2, col: '#d0a0ff', elem: 'dark', type: 'mag' },
      update(pr, dt) { for (const t of ents) if (foe(e, t) && Math.hypot(t.x - pr.x, t.y - pr.y) < 230 && !(t.boss && hasSA(t))) { t.x = damp(t.x, pr.x, 2.2, dt); t.y = damp(t.y, pr.y, 2.2, dt); } },
      onEnd(pr) { sfx.boom(0.9); cam.shake = Math.max(cam.shake, 6); blast(e, pr.x, pr.y, 110, { dmg: skillDmg(4.5, 0.45, lv), launch: 400, knock: 160, hs: 0.1, big: 1.6, col: '#e0b0ff', elem: 'dark', type: 'mag' }, { zMax: 220 }); fxBurst(pr.x, pr.y, 40, 200, '#c080ff'); fxShock(pr.x, pr.y, 140, '#c080ff'); },
      draw(c, pr) { const X = sx(pr.x), Y = sy(pr.y, pr.z), k = pr.t / pr.life, s = Math.min(1, k * 6) * (k > 0.92 ? (1 - k) / 0.08 : 1); c.fillStyle = 'rgba(10,2,20,.92)'; c.beginPath(); c.arc(X, Y, Math.max(0.5, 16 * s), 0, TAU); c.fill(); drawSpr(c, 'vortex', X, Y, 120 * s, 120 * s, { rot: -game.t * 5 }); } });
  })] }) });
const ELEM4 = [['fire', '#ff9a50'], ['ice', '#9fe6ff'], ['light', '#fff38a'], ['dark', '#c79aff']];
defSkill('mg_awaken', { name: '陨星幻灭', cls: 'mage', job: 'elemental', lvReq: 18, maxLv: 3, mp: 150, cd: 60, pvp: 0.45, type: 'mag', awaken: true, icon: 'mg_awaken', col: '#ffd23a',
  desc: '【觉醒】展开巨大的法阵（可用方向键移动，移动时法阵缩小、陨石更密集），火、冰、光、暗四属性陨石接连坠落。施放中只有霸体，没有无敌。', pow: lv => skillDmg(24, 6, lv), ai: { kind: 'awaken', r: [0, 360], dy: 90 },
  act: (lv) => ({ name: 'mg_awaken', clip: 'mAwk', dur: 3.4, superArmor: true, noCounter: true,
    onStart: e => { game.cutin = { t: 0, dur: 1.0, name: '陨星幻灭', who: e }; game.timeStop = 0.9; sfx.awaken(); const at = aimAhead(e, 220, 400); e.act.cx = at.x; e.act.cy = at.y; e.act.r = 170; },
    onInput: (e, I) => { const a = e.act; e.vx = e.vy = 0; let mx = I.dx(), my = I.dy();
      if (!isHuman(e)) { const t = nearestFoe(e, 600); if (t) { mx = Math.sign(t.x - a.cx) * (Math.abs(t.x - a.cx) > 20); my = Math.sign(t.y - a.cy) * (Math.abs(t.y - a.cy) > 10); } }
      a.cx += mx * 3; a.cy = clamp(a.cy + my * 2, 10, DEPTH - 10); a.r = damp(a.r, mx || my ? 110 : 170, 3, 1 / 60); return true; },
    update: e => { const a = e.act; if (e.actT < 0.95) return;
      addFx({ x: a.cx, y: a.cy - 1, z: 0, dur: 0.02, r: a.r, draw(c) { c.save(); c.translate(sx(this.x), sy(this.y, 0)); c.scale(1, GR); c.rotate(game.t); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.6; const im = IMG['fx/hexagram']; if (im) c.drawImage(im, -this.r, -this.r, this.r * 2, this.r * 2); c.restore(); } });
      const step = a.r < 140 ? 0.1 : 0.16, n = Math.floor((e.actT - 1.0) / step);
      if (e.actT > 1.0 && e.actT < 3.1 && n !== a.n) { a.n = n; const [el, col] = ELEM4[n % 4], x = a.cx + rnd(-a.r, a.r) * 0.8, y = clamp(a.cy + rnd(-a.r, a.r) * 0.3, 6, DEPTH - 6);
        addFx({ x, y: y + 2, z: 0, dur: 0.3, col, draw(c) { const k = this.t / this.dur; drawSpr(c, 'elemmeteor', sx(this.x) - 160 * (1 - k), sy(this.y, 0) - 360 * (1 - k), 90, 0, { ax: 0.8, ay: 0.82 }); } });
        game.after(0.3, () => { meteorImpact({ x, y }, 0.5); blast(e, x, y, 60, { dmg: skillDmg(1.6, 0.45, lv), launch: 300, knock: 60, hs: 0.04, elem: el, type: 'mag', col, downHit: true }, { zMax: 240 }); }); } } }) });
CLASSES.mage.jobs.elemental = { art: 'job/elemental', name: '元素师', role: '远程 · 范围', armor: 'cloth', awaken: 'mg_awaken', awakenName: '大魔导师',
  desc: '精通火、冰、光、暗四属性魔法的魔法师。技能范围大、威力高，擅长控场。',
  skills: ['mg_flame', 'mg_void', 'mg_icewall', 'mg_vortex', 'mg_jackfall', 'mg_thunder', 'mg_icefeast', 'mg_hole', 'mg_awaken'] };
CLASSES.mage.cmds.push(['uu', 'mg_flame'], ['fdf', 'mg_void'], ['dd', 'mg_icewall'], ['bdf', 'mg_vortex'], ['uff', 'mg_jackfall'], ['udu', 'mg_thunder'], ['udd', 'mg_icefeast'], ['bff', 'mg_hole'], ['uudd', 'mg_awaken']);
