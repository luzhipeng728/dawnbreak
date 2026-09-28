/* =====================================================================
   转职：战斗法师（魔法师）—— 近身棍术 + 炫纹。炫纹发射、圆舞棍（抓取）、炫纹融合、碎霸、流星闪影击、炫纹强压、强袭流星打、煌龙偃月，觉醒 变身贝亚娜（贝亚娜斗神）
   炫纹：普攻最后一击生成无属性、龙牙生成冰、天击生成光、落花掌生成火、圆舞棍生成暗（学会炫纹发射后）；
         炫纹发射开启时，直接攻击命中敌人后向该敌人射出一个炫纹
   ===================================================================== */
const CHASER_COL = { none: '#ffe070', ice: '#9fe6ff', light: '#fff6c0', fire: '#ffa060', dark: '#c79aff' };
const chaserMax = p => 3 + (skLv(p, 'bm_chaser') >= 5 ? 1 : 0) + (skLv(p, 'bm_chaser') >= 10 ? 1 : 0) + (p.buffs.bm_awaken ? 2 : 0);
function addChaser(p, el) {
  if (!hasSkill(p, 'bm_chaser')) return;
  p.chasers = p.chasers || [];
  if (p.chasers.length >= chaserMax(p)) return;
  p.chasers.push(el || 'none');
  if (!(game.t - (p._chFxT || -9) < 0.1)) addFx({ ent: p, y: p.y, dur: 1e9, update() { const e = this.ent; this.y = e.y + 0.2; e._chFxT = game.t; if (!e.chasers || !e.chasers.length || e.dead || ents.indexOf(e) < 0) this.t = this.dur; },
    draw(c) { const e = this.ent, n = e.chasers.length; for (let i = 0; i < n; i++) { const a = game.t * 3 + i * TAU / n, x = e.x + Math.cos(a) * 26, z = e.z + 78 + Math.sin(a * 2) * 5, y = e.y + Math.sin(a) * 6;
      drawSpr(c, 'chaser', sx(x), sy(y, z), 16, 16, { col: undefined }); drawSpr(c, fxTint('orb', CHASER_COL[e.chasers[i]]), sx(x), sy(y, z), 12, 12); } } });
  p._chFxT = game.t;
}
function fireChaser(p, t, el, o = {}) {
  const lv = Math.max(1, skLv(p, 'bm_chaser')), col = CHASER_COL[el] || CHASER_COL.none, img = fxTint('orb', col), big = o.big || 1;
  const pr = spawnProj({ owner: p, x: p.x, y: p.y, z: p.z + 80, vx: p.face * 200, vz: 160, face: p.face, life: 1.4, w: 10 * big, d: 12, h: 14 * big, pierce: false,
    hit: { dmg: skillDmg(0.9, 0.09, lv) * big, stun: 0.3, knock: 40, airLift: 150, hs: 0.04, type: 'mag', elem: el === 'none' ? undefined : el, col },
    update(q, dt) { const tt = t && !t.dead ? t : nearestFoe(p, 500); if (tt) { const dx = tt.x - q.x, dy = tt.y - q.y, dz = tt.z + tt.hurtH() * 0.5 - q.z, l = Math.hypot(dx, dy * 2, dz) || 1, sp = 520;
      q.vx = damp(q.vx, dx / l * sp, 9, dt); q.vy = damp(q.vy, dy / l * sp, 9, dt); q.vz = damp(q.vz, dz / l * sp, 9, dt); } if (Math.random() < 0.6) addFx({ x: q.x, y: q.y + 0.3, z: q.z, dur: 0.2, draw(c) { const k = this.t / this.dur; drawSpr(c, img, sx(this.x), sy(this.y, this.z), 12 * big * (1 - k), 0, { alpha: 0.6 * (1 - k) }); } }); },
    onEnd(q) { fxBurst(q.x, q.y, q.z, 60 * big, col); if (o.burst) blast(p, q.x, q.y, o.burst, { dmg: skillDmg(0.8, 0.08, lv) * big, launch: 260, knock: 60, hs: 0.05, type: 'mag', col }, { zMax: 200 }); },
    draw(c, q) { drawSpr(c, 'chaser', sx(q.x), sy(q.y, q.z), 22 * big, 22 * big); drawSpr(c, img, sx(q.x), sy(q.y, q.z), 16 * big, 16 * big); } });
  sfx.magic(); return pr;
}
defSkill('bm_chaser', { name: '炫纹发射', cls: 'mage', job: 'battlemage', lvReq: 15, mp: 10, cd: 1, type: 'mag', col: '#e0b02a', buff: true, cmdNote: '快捷栏（开关）',
  desc: '【开关】开启后，直接攻击命中敌人时向它射出一个炫纹。炫纹由普攻最后一击（无）、龙牙（冰）、天击（光）、落花掌（火）、圆舞棍（暗）生成，最多储存 3 个（5 / 10 级各 +1）。', pow: lv => skillDmg(0.9, 0.09, lv),
  infoExtra: lv => [['炫纹上限', String(3 + (lv >= 5) + (lv >= 10))]], ai: { kind: 'buff' },
  act: (lv) => ({ name: 'bm_chaser', clip: 'chaser', dur: 0.35, noCounter: true, onStart: e => { if (toggleBuff(e, 'bm_chaser', 9999, {})) { sfx.buff(); addChaser(e, 'none'); } } }) });
defSkill('bm_round', { name: '圆舞棍', cls: 'mage', job: 'battlemage', lvReq: 17, mp: 35, cd: 7, type: 'phys', col: '#6a3a9a',
  desc: '用棍把敌人挑起（抓取判定，能抓住霸体敌人），在头顶抡一圈后摔向身后，落地冲击波击倒周围敌人。生成暗属性炫纹。', pow: lv => skillDmg(4.0, 0.4, lv), ai: { kind: 'grab', r: [0, 70], dy: 20 },
  act: (lv) => ({ name: 'bm_round', clip: 'smash', dur: 0.95, noCounter: true, superArmor: [0.1, 0.9],
    hits: [HB(0.06, 0.16, [0, 70, 26, 10, 110], skillDmg(0.8, 0.08, lv), { grab: true, stun: 0.4, hs: 0.05, snd: 'blunt' })],
    hold: (e, t) => { const k = clamp((e.actT - 0.12) / 0.45, 0, 1), a = Math.PI * k; t.x = e.x + e.face * Math.cos(a) * 44; t.y = e.y + 0.5; t.z = e.z + 30 + Math.sin(a) * 70; t.face = -e.face; },
    events: [evAt(0.58, e => { e.play('smashDown', true); sfx.swing(true); const g = e.grabbed; addChaser(e, 'dark');
      if (g) { g.x = e.x - e.face * 44; g.z = 30; }
      throwGrab(e, { dmg: skillDmg(2.0, 0.2, lv), down: true, downLift: 120, knock: 60, bounce: 0.5, hs: 0.1, shake: 4, big: 1.5 });
      fxShock(e.x - e.face * 40, e.y, 150, '#b080ff'); cam.shake = Math.max(cam.shake, 5); sfx.boom(0.7);
      blast(e, e.x - e.face * 40, e.y, 90, { dmg: skillDmg(1.2, 0.12, lv), down: true, knock: 120, hs: 0.06, downHit: true }); })] }) });
defSkill('bm_fusion', { name: '炫纹融合', cls: 'mage', job: 'battlemage', lvReq: 21, mp: 30, cd: 15, type: 'mag', col: '#f0c040', buff: true,
  desc: '把 2 个炫纹融合成一个巨大炫纹射出，同时 20 秒内魔法攻击力与魔法暴击率提升。', pow: lv => skillDmg(0.9, 0.09, lv) * 3, infoExtra: lv => [['魔攻', '+' + pct(0.06 + 0.01 * lv)], ['魔法暴击', '+5%']], ai: { kind: 'buff' },
  act: (lv) => ({ name: 'bm_fusion', clip: 'chaser', dur: 0.45, noCounter: true, cancelFrom: 0.3,
    onStart: e => { e.buffs.bm_fusion = { t: 20, atk: 0.06 + 0.01 * lv, crit: 0.05 }; sfx.buff(); fxAura(e, '#ffd070');
      if (e.chasers && e.chasers.length >= 2) { const el = e.chasers.shift(); e.chasers.shift(); fireChaser(e, nearestFoe(e, 500), el, { big: 2.6, burst: 70 }); } } }) });
defSkill('bm_smash', { name: '碎霸', cls: 'mage', job: 'battlemage', lvReq: 21, mp: 40, cd: 8, type: 'phys', col: '#8a4ab0',
  desc: '挥棍大范围横扫把敌人挑起，接着当头砸下，砸地冲击波击倒周围的敌人。', pow: lv => skillDmg(4.6, 0.46, lv), ai: { kind: 'aoe', r: [0, 110], dy: 30 },
  act: (lv) => ({ name: 'bm_smash', clip: 'smash', dur: 0.8, cancelFrom: 0.6, superArmor: [0.3, 0.55],
    hits: [HB(0.08, 0.16, [-30, 110, 40, 0, 140], skillDmg(1.8, 0.18, lv), { launch: 380, knock: 40, hs: 0.07 })],
    events: [slashAt(0.07, { a0: 1.6, a1: -1.6, r: 76, w: 16, off: [10, 50], col: '#d0a0ff' }), evAt(0.36, e => { e.play('smashDown', true); sfx.swing(true); fxSlashOn(e, { col: '#d0a0ff', a0: -1.8, a1: 1.4, r: 80, w: 20, off: [10, 50] }); }),
      evAt(0.44, e => { cam.shake = Math.max(cam.shake, 5); sfx.boom(0.8); fxShock(e.x + e.face * 60, e.y, 180, '#c080ff');
        instantHit(e, { box: [-10, 120, 40, -10, 140], dmg: skillDmg(2.8, 0.28, lv), spike: 400, bounce: 0.5, down: true, knock: 100, hs: 0.1, big: 1.5, downHit: true }); })] }) });
defSkill('bm_flash', { name: '流星闪影击', cls: 'mage', job: 'battlemage', lvReq: 23, mp: 55, cd: 12, type: 'phys', col: '#e0c040',
  desc: '霸体连续向前直刺，最后一击把敌人击飞。', pow: lv => skillDmg(6.0, 0.6, lv), ai: { kind: 'burst', r: [0, 100], dy: 22 },
  act: (lv) => ({ name: 'bm_flash', clip: 'fangRush', dur: 1.0, superArmor: true, noCounter: true, move: [[0, 0.7, 50]],
    hits: [HB(0.04, 0.7, [0, 96, 24, 30, 95], skillDmg(0.45, 0.045, lv), { rep: 0.08, stun: 0.3, knock: 20, hs: 0.025, snd: 'stab' }),
      HB(0.76, 0.82, [0, 104, 28, 20, 110], skillDmg(2.4, 0.24, lv), { launch: 460, knock: 220, hs: 0.1, big: 1.5, shake: 3 })],
    update: e => { if (e.actT < 0.7 && Math.floor(e.actT / 0.08) !== e.act.k) { e.act.k = Math.floor(e.actT / 0.08); fxStreak({ x: e.x + e.face * 14, y: e.y + rnd(-5, 5), z: e.z + rnd(45, 70), face: e.face, len: rnd(70, 100), w: 7, col: '#ffe090', dur: 0.1 }); if (e.act.k % 2) sfx.swing(false); } } }) });
defSkill('bm_press', { name: '炫纹强压', cls: 'mage', job: 'battlemage', lvReq: 23, mp: 40, cd: 10, type: 'mag', col: '#d0a030',
  desc: '把储存的全部炫纹集中砸向前方地面爆炸（没有炫纹时只砸出一个）。炫纹越多威力越大。', pow: lv => skillDmg(1.8, 0.18, lv) * 3, ai: { kind: 'aoe', r: [40, 220], dy: 50 },
  act: (lv) => ({ name: 'bm_press', clip: 'smashDown', dur: 0.6, cancelFrom: 0.45, superArmor: true,
    events: [evAt(0.12, e => { const at = aimAhead(e, 120, 240), L = e.chasers && e.chasers.length ? e.chasers.splice(0) : ['none'];
      L.forEach((el, i) => game.after(i * 0.08, () => { const x = at.x + rnd(-30, 30), y = clamp(at.y + rnd(-15, 15), 6, DEPTH - 6), col = CHASER_COL[el];
        addFx({ x, y: y + 1, z: 0, dur: 0.18, col, draw(c) { const k = this.t / this.dur; drawSpr(c, fxTint('orb', this.col), sx(this.x), sy(this.y, 0) - 200 * (1 - k), 26, 26); } });
        game.after(0.18, () => { fxBurst(x, y, 10, 110, col); fxShock(x, y, 90, col); sfx.boom(0.5); blast(e, x, y, 60, { dmg: skillDmg(1.8, 0.18, lv), launch: 320, knock: 60, hs: 0.06, type: 'mag', elem: el === 'none' ? undefined : el, col, downHit: true }, { zMax: 200 }); }); })); })] }) });
defSkill('bm_raid', { name: '强袭流星打', cls: 'mage', job: 'battlemage', lvReq: 25, mp: 60, cd: 15, type: 'phys', col: '#e08a2a',
  desc: '蓄气（按住技能键最长 0.8 秒）后化作流星向前冲刺，撞飞路径上的敌人，再跃回原位。', pow: lv => skillDmg(6.5, 0.65, lv), ai: { kind: 'gap', r: [0, 260], dy: 24 },
  act: (lv) => ({ name: 'bm_raid', clip: 'fang', dur: 1.1, superArmor: true, noCounter: true,
    charge: { at: 0.08, max: 0.8, min: 0, dmg: 0.6, clip: 'charge', update: e => { if (Math.random() < 0.5) fxCharge(e, '#ffb060'); } },
    onStart: e => { e.act.x0 = e.x; },
    update: e => { const a = e.act; if (a.charging || !a.chargeDone) return; if (!a.go) { a.go = e.actT; e.play('raid', true); sfx.iai(); fxAfterimage(e, '#ffb060'); }
      const k = e.actT - a.go; if (k < 0.3) { e.vx = e.face * (700 + (a.chargeK || 0) * 300); if (Math.random() < 0.7) fxStreak({ x: e.x - e.face * 30, y: e.y, z: e.z + 55, face: e.face, len: 120, w: 16, col: '#ffb060', dur: 0.15 }); }
      else if (!a.back) { a.back = true; e.vx = (a.x0 - e.x) / 0.4; e.vz = 380; e.z = Math.max(e.z, 1); e.play('bmLeap', true); } },
    hits: [HB(0.1, 0.5, [-20, 70, 30, 0, 110], skillDmg(6.5, 0.65, lv), { launch: 480, knock: 120, hs: 0.1, big: 1.6, shake: 4 })],
    onLand: e => { if (e.act.back) { e.vx = 0; e.endAct(); } } }) });
defSkill('bm_dragon', { name: '煌龙偃月', cls: 'mage', job: 'battlemage', lvReq: 27, mp: 80, cd: 20, type: 'phys', col: '#f0c030',
  desc: '连续突刺把敌人推到棍尖，最后龙之炫纹在棍尖爆炸。', pow: lv => skillDmg(9.0, 0.9, lv), ai: { kind: 'burst', r: [0, 120], dy: 26 },
  act: (lv) => ({ name: 'bm_dragon', clip: 'fangRush', dur: 1.3, superArmor: true, noCounter: true, move: [[0.05, 0.75, 180]],
    hits: [HB(0.05, 0.75, [0, 100, 30, 10, 110], skillDmg(0.5, 0.05, lv), { rep: 0.09, stun: 0.4, knock: 0, hs: 0.02, snd: 'stab', onHit: (a, t) => { if (!hasSA(t)) t.x = a.x + a.face * 90; } })],
    events: [evAt(0.85, e => { e.play('fang', true); const x = e.x + e.face * 110; cam.flash = 0.15; cam.flashCol = '#fff0b0'; cam.shake = 9; sfx.iai(); sfx.boom(1.1);
      fxSpr('dragonfang', e.x + e.face * 60, e.y, e.z + 60, { w: 240, dur: 0.5, flip: e.face < 0, grow: [0.6, 1.2] }); fxBurst(x, e.y, 60, 240, '#ffd070');
      blast(e, x, e.y, 110, { dmg: skillDmg(4.5, 0.45, lv), launch: 520, knock: 200, hs: 0.14, big: 1.9, col: '#ffe070', type: e.matk !== undefined && e.matk > e.atk ? 'mag' : 'phys' }, { zMax: 200 }); })] }) });
defSkill('bm_awaken', { name: '变身贝亚娜', cls: 'mage', job: 'battlemage', lvReq: 21, maxLv: 3, mp: 150, cd: 60, pvp: 0.45, type: 'mag', awaken: true, col: '#ffd23a',
  desc: '【觉醒】唤醒斗神之力变身为贝亚娜：30 秒内攻击力、攻击速度、施放速度大幅提升，炫纹上限 +2 并自动生成。变身时释放斗气冲击。', pow: lv => skillDmg(8, 3, lv), ai: { kind: 'awaken', r: [0, 200], dy: 80 },
  infoExtra: lv => [['攻击力', '+' + pct(0.2 + 0.05 * lv)], ['持续', '30 秒']],
  act: (lv) => ({ name: 'bm_awaken', clip: 'bmAwk', dur: 1.6, superArmor: true, noCounter: true, invul: [0, 1.6],
    onStart: e => { game.cutin = { t: 0, dur: 1.0, name: '变身贝亚娜', who: cutinWho(e) }; game.timeStop = 0.9; sfx.awaken(); },
    events: [evAt(0.95, e => { e.buffs.bm_awaken = { t: 30, atk: 0.2 + 0.05 * lv, aspd: 0.2, cspd: 0.2, mspd: 0.1 }; cam.flash = 0.3; cam.flashCol = '#fff0b0'; cam.shake = 10; sfx.boom(1.2);
      fxAura(e, '#ffd23a', 1.5); fxShock(e.x, e.y, 320, '#ffd070'); fxBurst(e.x, e.y, 60, 320, '#ffe070');
      blast(e, e.x, e.y, 220, { dmg: skillDmg(8, 3, lv), launch: 480, knock: 180, hs: 0.15, big: 2, sure: true, downHit: true, col: '#ffe070' }, { zMax: 240 });
      for (let i = 0; i < 5; i++) addChaser(e, ['none', 'fire', 'ice', 'light', 'dark'][i]); })] }) });
CLASSES.mage.jobs.battlemage = { art: 'job/battlemage', name: '战斗法师', role: '近战 · 连击', armor: 'leather', awaken: 'bm_awaken', awakenName: '贝亚娜斗神',
  desc: '把魔力灌注进战棍近身搏斗的魔法师。连招流畅，炫纹在攻击中不断生成、射出。',
  skills: ['bm_chaser', 'bm_round', 'bm_fusion', 'bm_smash', 'bm_flash', 'bm_press', 'bm_raid', 'bm_dragon', 'bm_awaken'] };
CLASSES.mage.cmds.push(['fd', 'bm_round'], ['df', 'bm_fusion', 'buff'], ['bdf', 'bm_smash'], ['fdf', 'bm_flash'], ['ud', 'bm_press'], ['bff', 'bm_raid'], ['uff', 'bm_dragon'], ['uudd', 'bm_awaken']);
// 炫纹：生成与发射（职业命中钩子）；变身贝亚娜期间自动生成；变身中金色光辉
CLASSES.mage.onHit = (p, t, h, dmg, act) => {
  if (!act || jobOf(p) !== 'battlemage') return;
  if (!act._chG && (h.chaser || (act.basic && h.last))) { act._chG = true; addChaser(p, h.chaser || 'none'); }
  if (p.buffs.bm_chaser && !act._chF && p.chasers && p.chasers.length && !t.dead) { act._chF = true; fireChaser(p, t, p.chasers.shift()); }
};
CLASSES.mage.passives.push(p => {
  if (p.buffs.bm_awaken) { p.drawOpts = { glow: 0.25 + Math.sin(game.t * 6) * 0.1 }; p._awkGen = (p._awkGen || 0) + 0.25; if (p._awkGen >= 1) { p._awkGen = 0; addChaser(p, pick(['none', 'fire', 'ice', 'light', 'dark'])); } }
  else if (p._wasAwk) p.drawOpts = {};
  p._wasAwk = !!p.buffs.bm_awaken;
});
