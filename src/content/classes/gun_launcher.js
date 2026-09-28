/* =====================================================================
   转职：枪炮师（女）—— 重火器（官方现版，见 docs/SKILLS_OFFICIAL_gun.md 第 5 节；等级按统一等级表换算；本作按独立攻击力 indep 结算）
   重火器系统：重火器奥义（重火器技能 +1 级，转职自动学会）、重火器拔击（拔出重火器的一瞬间就有判定、击退）、
   重火器精通（重火器技能 MP 减少；连续使用叠加攻击力，每层 5%、最多 4 层、2.5 秒）、潜能爆发（重火器技能攻击力 BUFF）
   觉醒：一觉 远古粒子炮（重炮掌控者）→ 二觉 火力全开（风暴骑兵）→ 三觉 制胜·最终兵器（重霄·枪炮师）
   ===================================================================== */
const lblast = (e, x, y, r, h, o) => blast(e, x, y, r, { type: 'indep', ...h }, o);   // 枪炮师的范围攻击一律按独立攻击结算
// 重火器技能（重火器奥义 +1 级、重火器拔击、重火器精通、潜能爆发都只对它们生效；觉醒技能不算）
const HEAVY = new Set(['g_gatling', 'g_m3', 'g_bbq', 'gl_cannon', 'gl_antitank', 'gl_laser', 'gl_flame', 'gl_fm31', 'gl_fm92', 'gl_quantum', 'gl_x1', 'gl_plasma', 'gl_fm92sw', 'gl_fsc7', 'gl_pt15', 'gl_uht03']);
const isLauncher = p => jobOf(p) === 'launcher';
CLASSES.gun.lvBonus = (p, id) => HEAVY.has(id) && isLauncher(p) && lvOf(p, 'gl_hwlore') > 0 ? 1 : 0;
CLASSES.gun.mpMul = (p, id) => HEAVY.has(id) && isLauncher(p) ? 1 - Math.min(0.3, 0.03 * lvOf(p, 'gl_hwmaster')) : 1;
// 施放重火器技能：拔击判定 + 精通叠层 + 潜能爆发（加在这个动作的伤害倍率上：动作里的判定、动作里射出的投射物都吃）
CLASSES.gun.onCast = (p, id, act) => {
  if (!HEAVY.has(id) || !isLauncher(p) || !act) return;
  const hm = lvOf(p, 'gl_hwmaster');
  if (hm) { const b = p.buffs.gl_hwstack; const n = Math.min(4, (b ? b.n : 0) + 1); p.buffs.gl_hwstack = { t: 2.5, n, col: '#ffb060' }; }
  const st = p.buffs.gl_hwstack ? p.buffs.gl_hwstack.n * 0.05 : 0, mir = p.buffs.gl_miracle ? p.buffs.gl_miracle.hw : 0, oh = skLv(p, 'gl_overheat') ? 0.16 + 0.02 * skLv(p, 'gl_overheat') : 0;
  act.dmgMul = (act.dmgMul || 1) * (1 + st + mir + oh);
  if (lvOf(p, 'gl_draw')) game.after(0.02, () => { if (p.act === act && !p.dead) { fxSlashOn(p, { a0: -2.2, a1: 0.6, r: 56, w: 12, off: [10, 50], col: '#ffc070', silent: true }); sfx.swing(true);
    instantHit(p, { box: [0, 72, 28, 0, 110], dmg: 1.2 * (1 + 0.1 * lvOf(p, 'gl_draw')), type: 'indep', stun: 0.35, knock: 180, hs: 0.05, snd: 'blunt', col: '#ffd090' }); } });
};
// 炮弹：直线飞行，碰到第一个敌人或飞到尽头爆炸
function cannonShell(e, o) {
  let hitT = null;
  return shootProj(e, { img: 'shell', w: 46, h: 18, speed: o.speed || 700, life: o.life || 0.7, z: 62, dx: 46, bw: 12, bh: 24, pierce: false, trail: '#ffb060',
    hit: { dmg: o.dmg, knock: 60, stun: 0.4, hs: 0.06, snd: 'blunt', unblockable: o.unblock, ...o.hit }, onHitT: (pr, t) => { hitT = t; },
    onEnd: pr => { const x = o.behind && hitT ? hitT.x + pr.face * 55 : pr.x, y = hitT ? hitT.y : pr.y;
      const boom = k => { meteorImpact({ x, y }, o.big || 0.7); lblast(e, x, y, o.r || 80, { dmg: o.boom, launch: k === (o.n || 1) - 1 ? o.launch ?? 380 : 120, knock: 120 * (o.behind ? -1 : 1), hs: 0.08, snd: 'fire', col: '#ffb060', elem: o.elem, unblockable: o.unblock, onHit: o.onHit }, { zMax: 160 }); };
      for (let k = 0; k < (o.n || 1); k++) game.after(k * 0.14, () => { if (!e.dead) boom(k); }); } });
}
/* ---- 转职技能（官方 15~45 级 → 本作 15~20 级）---- */
defSkill('gl_hwlore', { name: '重火器奥义', cls: 'gun', job: 'launcher', lvReq: 15, maxLv: 1, sp: 0, mp: 0, cd: 0, type: 'indep', passive: true, col: '#6a5a3a',
  desc: '【被动，转职时自动学会】所有重火器技能（M-137、M-3、BBQ、加农炮、激光炮……）等级 +1（已经学会的才加；觉醒技能不加）。' });
defSkill('gl_draw', { name: '重火器拔击', cls: 'gun', job: 'launcher', lvReq: 16, maxLv: 1, sp: 20, mp: 0, cd: 0, type: 'indep', passive: true, col: '#8a6a3a',
  desc: '【被动】拔出重火器的动作带攻击判定：放任何重火器技能时，起手先抡一下，打中的敌人被击退、被击硬直增加。' });
defSkill('gl_hwmaster', { name: '重火器精通', cls: 'gun', job: 'launcher', lvReq: 16, sp: 15, mp: 0, cd: 0, type: 'indep', passive: true, col: '#7a6a4a',
  desc: '【被动】重火器技能的 MP 消耗减少；连续使用重火器技能时叠加攻击力（每层 +5%，最多 4 层，2.5 秒内没有再用就消失）。',
  infoExtra: lv => [['MP 消耗', '-' + pct(Math.min(0.3, 0.03 * lv))], ['叠层', '+5% × 4 层']] });
defSkill('gl_cannon', { name: '加农炮', cls: 'gun', job: 'launcher', lvReq: 16, mp: 40, cd: 5, type: 'indep', col: '#5a4a3a',
  desc: '扛起手炮向前发射一颗能量球，穿透路上的敌人并把它们击退。按住技能键蓄气（最长 0.8 秒，蓄满自动发射）提高威力；发射前按住 ↑↓ 调整方向。施放中霸体，不能被其他技能取消。', pow: lv => skillDmg(3.6, 0.36, lv), ai: { kind: 'proj', r: [40, 450], dy: 20 },
  act: (lv, p) => ({ name: 'gl_cannon', clip: 'cannon', dur: 0.75, superArmor: true, noCounter: true,
    charge: { at: 0.12, max: 0.8, min: 0, dmg: 0.8, update: e => { if (Math.random() < 0.4) fxCharge(e, '#ffb060'); } },
    events: [evAt(0.2, e => { sfx.cannon(); cam.shake = Math.max(cam.shake, 4); e.play('cannonFire', true); e.vx = -e.face * 120 * (skLv(e, 'gl_armor') ? 0.75 : 1);
      const k = e.act.chargeK || 0, dy = e.pad ? e.pad.dy() : 0, armored = skLv(e, 'gl_armor') > 0;
      if (armored) { cannonShell(e, { dmg: skillDmg(1.4, 0.14, lv), boom: skillDmg(2.9, 0.29, lv) * (1 + k * 0.8), big: 0.7 + k * 0.4, r: 80 + k * 40, speed: 900, life: 0.9 }); return; }   // 重武装改造：接触即炸、飞得更远
      shootProj(e, { img: IMG['fx/cannonball'] ? 'cannonball' : 'quantum', col: IMG['fx/cannonball'] ? null : '#ffb060', w: 54 + k * 30, speed: 620, life: 0.7, z: 62, dx: 50, bw: 22 + k * 10, bh: 40 + k * 16, pierce: true, vy: dy * 160, trail: '#ffd090',
        hit: { dmg: skillDmg(3.6, 0.36, lv) * (1 + k * 0.8), stun: 0.5, knock: 220, airLift: 180, hs: 0.08, big: 1.3, snd: 'fire', col: '#ffd090', type: 'indep' } }); })] }) });
defSkill('gl_antitank', { name: '反坦克炮', cls: 'gun', job: 'launcher', lvReq: 16, mp: 40, cd: 6, type: 'indep', elem: 'fire', col: '#8a3a1a',
  desc: '发射一发火属性反坦克炮弹，命中后在敌人身后连爆 3 次，把敌人炸向自己一侧，并让敌人出血。无视格挡。', pow: lv => skillDmg(6.0, 0.6, lv), ai: { kind: 'proj', r: [40, 420], dy: 16 },
  act: (lv, p) => { const pan = p && skLv(p, 'gl_pandora') > 0; return { name: 'gl_antitank', clip: 'cannon', dur: 0.55, superArmor: [0.05, 0.3],
    events: [evAt(0.1, e => { sfx.cannon(); e.play('cannonFire', true);
      cannonShell(e, { dmg: skillDmg(1.4, 0.14, lv), boom: skillDmg(1.6, 0.16, lv), behind: true, n: 3, elem: 'fire', unblock: true, r: pan ? 120 : 80, big: pan ? 0.9 : 0.6, hit: { elem: 'fire' },
        onHit: (a, t) => { if (Math.random() < 0.15) addStatus(t, 'bleed', 3, { dps: a.atk * 0.05, src: a }); } }); })] }; } });
defSkill('gl_laser', { name: '激光炮', cls: 'gun', job: 'launcher', lvReq: 17, mp: 45, cd: 7, type: 'indep', elem: 'light', col: '#3a9ae0',
  desc: '发射一道光属性激光：判定很窄、射程极远，一击贯穿路上的所有敌人。学了蓄电激光炮后，放激光炮时按住攻击键可以充电（最长 0.3 秒），范围和威力更大，但后坐力会把自己推后。', pow: lv => skillDmg(6.5, 0.65, lv), ai: { kind: 'burst', r: [0, 780], dy: 12 },
  act: (lv) => ({ name: 'gl_laser', clip: 'laser', dur: 0.62, noCounter: true, superArmor: [0, 0.4],
    update: e => { const a = e.act, I = e.pad, ch = skLv(e, 'gl_charge') > 0;
      if (!a.fired && ch && I && I.is('attack') && e.actT < 0.42) { a.charge = Math.min(0.3, e.actT - 0.12); if (Math.random() < 0.6) fxCharge(e, '#8fe0ff'); return; }
      if (!a.fired && e.actT >= 0.12) { a.fired = true; const k = ch ? clamp((a.charge || 0) / 0.3, 0, 1) : 0; e.play('laserFire', true); sfx.iai(); cam.shake = 4 + k * 5; a.dur = e.actT + 0.4;
        fxBeam(e.x + e.face * 50, e.y, e.z + 50, 800, e.face, { w: 30 + k * 34, dur: 0.35, col: '#8fe0ff' });
        instantHit(e, { box: [40, 820, 12 + k * 14, 34, 80], dmg: skillDmg(6.5, 0.65, lv) * (1 + 0.6 * k), stun: 0.5, knock: 120, airLift: 150, hs: 0.08, big: 1.3, col: '#bff0ff', elem: 'light', type: 'indep' });
        if (k > 0.5) e.vx = -e.face * 260 * (skLv(e, 'gl_armor') ? 0.75 : 1); } } }) });
defSkill('gl_charge', { name: '蓄电激光炮', cls: 'gun', job: 'launcher', lvReq: 17, maxLv: 1, sp: 30, mp: 0, cd: 0, type: 'indep', passive: true, col: '#5ab0f0', pre: { gl_laser: 1 },
  desc: '【被动】放激光炮时按住攻击键充电（最长 0.3 秒）：伤害最多 +60%，激光变粗；蓄满时后坐力会把自己推后。需要激光炮 Lv1。' });
defSkill('gl_apg', { name: 'APG-63', cls: 'gun', job: 'launcher', lvReq: 17, sp: 15, mp: 0, cd: 0, type: 'indep', passive: true, col: '#6a7a8a',
  desc: '【被动】女枪炮师专用的脉冲雷达部件：暴击率、攻击力提高。', infoExtra: lv => [['暴击率', '+' + pct(0.013 * lv)], ['攻击力', '+' + pct(0.024 * lv)]] });
defSkill('gl_flame', { name: '聚焦喷火器', cls: 'gun', job: 'launcher', lvReq: 18, mp: 55, cd: 12, type: 'indep', elem: 'fire', col: '#e0802a', pre: { g_m3: 1 },
  desc: '喷出高温聚焦火焰（最长 2.5 秒），射程远、判定低，能烧到倒地的敌人；喷射中可以移动。按住技能键持续，松开停止。需要 M-3 喷火器 Lv1。', pow: lv => skillDmg(7.5, 0.75, lv), ai: { kind: 'poke', r: [0, 250], dy: 18 },
  act: (lv, p) => ({ name: 'gl_flame', clip: 'flame', dur: 2.6, noCounter: true, superArmor: true,
    onInput: (e, I) => { const sp = e.speed * (0.39 + 0.035 * lv) * (skLv(e, 'gl_pandora') ? 1.4 : 1); e.vx = I.dx() * sp; e.vy = I.dy() * sp * 0.6; if (e.actT > 0.4 && !I.is(e.act.key || 'cmd')) e.act.dur = Math.min(e.act.dur, e.actT + 0.1); return false; },
    update: e => { const a = e.act, n = Math.floor(e.actT / 0.08);
      if (n !== a.k && e.actT > 0.1 && e.actT < a.dur - 0.1) { a.k = n; if (n % 3 === 0) sfx.flame(); flameJet(e, { range: 250, speed: 640, visual: true });
        instantHit(e, { box: [30, 270, 20, 0, 70], dmg: skillDmg(0.24, 0.024, lv), stun: 0.3, knock: 20, airLift: 90, hs: 0.012, snd: 'fire', downHit: true, elem: 'fire', col: '#ffb060', type: 'indep',
          onHit: (a2, t) => { if (Math.random() < 0.15) addStatus(t, 'burn', 2, { dps: a2.atk * 0.07, src: a2 }); } }); } },
    onEnd: e => { e.vx = 0; e.vy = 0; } }) });
defSkill('gl_miracle', { name: '潜能爆发', cls: 'gun', job: 'launcher', lvReq: 18, mp: 60, cd: 5, type: 'indep', buff: true, col: '#ffa03a',
  desc: '【BUFF】120 秒内重火器技能的攻击力提高。', infoExtra: lv => [['重火器攻击力', '+' + pct(0.03 + 0.022 * lv)], ['持续', '120 秒']], ai: { kind: 'buff' },
  act: (lv) => ({ name: 'gl_miracle', clip: 'gbuff', dur: 0.45, noCounter: true, onStart: e => { e.buffs.gl_miracle = { t: 120, hw: 0.03 + 0.022 * lv }; sfx.buff(); fxAura(e, '#ffc070'); } }) });
defSkill('gl_fm31', { name: 'FM-31 榴弹发射器', cls: 'gun', job: 'launcher', lvReq: 19, mp: 55, cd: 15, type: 'indep', col: '#6a6a3a',
  desc: '高速连射 4 发榴弹，弹道略不规则，碰到敌人或落地就爆炸。', pow: lv => skillDmg(9.6, 0.96, lv), ai: { kind: 'proj', r: [80, 380], dy: 50 },
  act: (lv) => ({ name: 'gl_fm31', clip: 'cannon', dur: 0.85, superArmor: true, noCounter: true,
    events: Array.from({ length: 4 }, (_, i) => evAt(0.1 + i * 0.14, e => { sfx.cannon(0.55); e.play('cannonFire', true);
      const at = aimAhead(e, rnd(160, 340), 420), tx = at.x + e.face * rnd(-20, 50), ty = clamp(at.y + rnd(-30, 30), 8, DEPTH - 8);
      const boom = pr => { if (pr.boomed) return; pr.boomed = true; meteorImpact(pr, 0.45); lblast(e, pr.x, pr.y, 65, { dmg: skillDmg(2.4, 0.24, lv), stun: 0.4, knock: 90, airLift: 150, hs: 0.05, snd: 'fire' }); };   // 官方：爆炸击退，不浮空
      lobProj(e, tx, ty, rnd(0.3, 0.42), { img: 'grenade', h: 14, vz: rnd(120, 200), onLand: boom,
        update: pr => { if (pr.boomed) return; for (const t of ents) if (foe(e, t) && !t.dead && Math.abs(t.x - pr.x) < t.w + 8 && Math.abs(t.y - pr.y) < 18 && pr.z < t.z + t.hurtH()) { boom(pr); pr.t = pr.life; break; } } }); })) }) });
defSkill('gl_fm92', { name: 'FM-92 mk2 榴弹', cls: 'gun', job: 'launcher', lvReq: 19, mp: 60, cd: 20, type: 'indep', elem: 'fire', col: '#8a5a2a',
  desc: '向斜上方发射一颗榴弹，在空中分裂成 10 个爆弹落下爆炸，把敌人炸上天（火属性）。按住技能键可以推迟分裂（最长 0.6 秒），落点更远。', pow: lv => skillDmg(10, 1.0, lv), ai: { kind: 'aoe', r: [100, 360], dy: 60 },
  act: (lv) => ({ name: 'gl_fm92', clip: 'lancerUp', dur: 0.7, superArmor: true, noCounter: true,
    events: [evAt(0.15, e => { sfx.cannon(0.9); cam.shake = Math.max(cam.shake, 3); const a = e.act, key = a.key || 'cmd', x0 = e.x + e.face * 30, y0 = e.y, face = e.face;
      const shell = spawnProj({ owner: e, x: x0, y: y0, z: e.z + 90, vx: face * 420, vz: 520, grav: 900, face, life: 0.6, w: 10, d: 10, h: 10, pierce: true, hit: null,
        update(pr) { if (pr.t > 0.1 && !(e.pad && e.pad.is(key))) pr.t = pr.life; if (Math.random() < 0.6) addFx({ x: pr.x, y: pr.y + 0.3, z: pr.z, dur: 0.2, draw(c) { c.fillStyle = `rgba(255,180,90,${1 - this.t / this.dur})`; c.fillRect(sx(this.x) - 3, sy(this.y, this.z) - 3, 6, 6); } }); },
        onEnd(pr) { sfx.boom(0.4); for (let i = 0; i < 10; i++) { const tx = pr.x + face * (-20 + i * 18 + rnd(-6, 6)), ty = clamp(y0 + ((i % 3) - 1) * 32 + rnd(-10, 10), 8, DEPTH - 8);   // 10 个子弹在前方铺开一片
          lobProj(e, tx, ty, rnd(0.35, 0.6), { img: 'grenade', h: 10, z0: Math.max(10, pr.z - 60), vz: 60, onLand: q => { meteorImpact(q, 0.3); lblast(e, q.x, q.y, 50, { dmg: skillDmg(1.0, 0.1, lv), launch: 360, knock: 40, hs: 0.04, snd: 'fire', elem: 'fire' }); } }); } },
        draw(c, pr) { drawSpr(c, 'shell', sx(pr.x), sy(pr.y, pr.z), 30, 12, { rot: Math.atan2(-pr.vz, pr.vx) }); } });
      return shell; })] }) });
defSkill('gl_dual', { name: '光热反应', cls: 'gun', job: 'launcher', lvReq: 19, maxLv: 1, sp: 20, mp: 0, cd: 0, type: 'indep', passive: true, col: '#e0a060',
  desc: '【被动】火属性强化和光属性强化中较低的一方提高到和较高的一方一样。' });
defSkill('gl_quantum', { name: '量子爆弹', cls: 'gun', job: 'launcher', lvReq: 19, mp: 70, cd: 18, type: 'indep', elem: 'light', col: '#3a6ae0',
  desc: '按下遥控器，呼叫卫星投下量子爆弹：准星先出现在前方，落下之前一直可以用方向键移动。先落下一枚导弹，然后大范围爆炸，让敌人感电。', pow: lv => skillDmg(10, 1.0, lv), ai: { kind: 'aoe', r: [100, 340], dy: 60 },
  act: (lv) => ({ name: 'gl_quantum', clip: 'quantum', dur: 1.1, noCounter: true, superArmor: true,
    onStart: e => { const at = aimAhead(e, 220, 400); sfx.charge();
      e.act.g = telegraph({ x: at.x, y: at.y, r: 130, dur: 1.1, kind: 'circle', col: '#6ab0ff', friendly: true, fire: g => {
        fxSpr('thunderbolt', g.x, g.y, 0, { h: 540, dur: 0.35, ay: 1, col: '#8fd0ff' }); lblast(e, g.x, g.y, 50, { dmg: skillDmg(1.5, 0.15, lv), stun: 0.4, hs: 0.04, elem: 'light' }, { zMax: 200 });
        game.after(0.2, () => { fxSpr('quantum', g.x, g.y, 40, { w: 300, dur: 0.6, grow: [0.3, 1.2] }); fxShock(g.x, g.y, 280, '#8fd0ff'); cam.shake = 10; cam.flash = 0.15; cam.flashCol = '#cfe8ff'; sfx.boom(1.2);
          lblast(e, g.x, g.y, 140, { dmg: skillDmg(8.5, 0.85, lv), launch: 480, knock: 140, hs: 0.12, big: 1.8, elem: 'light', col: '#bfe8ff', downHit: true, onHit: (a, t) => addStatus(t, STATUS_NAME.shock ? 'shock' : 'stun', STATUS_NAME.shock ? 4 : 0.8, { hitDmg: a.atk * 0.08, src: a }) }, { zMax: 240 }); }); } }); },
    onInput: (e, I) => { const g = e.act.g; if (g && g.t < g.dur) { g.x += I.dx() * 5; g.y = clamp(g.y + I.dy() * 3, 8, DEPTH - 8); } return false; } }) });
defSkill('gl_x1', { name: 'X-1 压缩量子炮', cls: 'gun', job: 'launcher', lvReq: 20, mp: 80, cd: 25, type: 'indep', col: '#2a5ad0', pre: { gl_quantum: 1 },
  desc: '按住技能键蓄气（最长 0.8 秒，蓄满自动发射），射出一颗缓慢前进的压缩量子球：蓄得越满吸附范围越大，带着敌人前进，最后爆炸。发射前按住 ↑↓ 调整方向。需要量子爆弹 Lv1。', pow: lv => skillDmg(12, 1.2, lv), ai: { kind: 'proj', r: [0, 360], dy: 40 },
  act: (lv) => ({ name: 'gl_x1', clip: 'laser', dur: 0.7, noCounter: true, superArmor: true,
    charge: { at: 0.1, max: 0.8, min: 0.1, dmg: 0.6, update: e => { if (Math.random() < 0.5) fxCharge(e, '#6ab0ff'); } },
    events: [evAt(0.2, e => { e.play('laserFire', true); sfx.cannon(0.8); const k = e.act.chargeK || 0, R = 90 + k * 80, dy = e.pad ? e.pad.dy() : 0;
      shootProj(e, { img: 'quantum', w: 60 + k * 30, speed: 170, life: 1.8, z: 50, dx: 50, bw: 26, bh: 60, pierce: true, spin: 3, vy: dy * 60,
        hit: { dmg: skillDmg(0.4, 0.04, lv), stun: 0.3, knock: 0, airLift: 60, hs: 0.02, rep: 0.2, type: 'indep' },
        update: (pr, dt) => { for (const t of ents) if (hittable(e, t) && Math.hypot(t.x - pr.x, (t.y - pr.y) * 1.4) < R && !(t.boss && hasSA(t))) { t.x = damp(t.x, pr.x, 4, dt); t.y = damp(t.y, pr.y, 4, dt); } },
        onEnd: pr => { fxSpr('quantum', pr.x, pr.y, 40, { w: 220 + k * 80, dur: 0.5, grow: [0.4, 1.3] }); fxShock(pr.x, pr.y, 200, '#8fd0ff'); cam.shake = 9; sfx.boom(1.1);
          lblast(e, pr.x, pr.y, R, { dmg: skillDmg(7.5, 0.75, lv), launch: 480, knock: 140, hs: 0.12, big: 1.8, col: '#bfe8ff' }, { zMax: 200 }); } }); })] }) });
/* ---- 一次觉醒：重炮掌控者（官方 48~70 级 → 本作 21~25 级）---- */
defSkill('gl_overheat', { name: '超温重火器', cls: 'gun', job: 'launcher', tier: 1, lvReq: 21, sp: 20, mp: 0, cd: 0, type: 'indep', passive: true, col: '#e05a2a',
  desc: '【一觉被动】让重火器超负荷运转：重火器技能的攻击力提高。', infoExtra: lv => [['重火器攻击力', '+' + pct(0.16 + 0.02 * lv)]] });
defSkill('gl_awaken', { name: '远古粒子炮', cls: 'gun', job: 'launcher', tier: 1, lvReq: 21, maxLv: 3, mp: 150, cd: 135, pvp: 0.45, type: 'indep', awaken: true, col: '#e0a02a',
  desc: '【觉醒】架起远古巨炮，蓄能后向前方发射贯穿整个画面的粒子光束（4 秒，16 段），同时不停射出小束激光；主炮期间前方生成屏障，把敌人挡在炮口前。', pow: lv => skillDmg(24, 7, lv), ai: { kind: 'awaken', r: [0, 760], dy: 50 },
  act: (lv) => ({ name: 'gl_awaken', clip: 'lAwk', dur: 5.3, superArmor: true, noCounter: true, invul: [0, 1.2],
    onStart: e => { game.cutin = { t: 0, dur: 1.0, name: '远古粒子炮', who: cutinWho(e) }; game.timeStop = 0.9; sfx.awaken(); },
    update: e => { const a = e.act;
      if (e.actT > 0.95 && e.actT < 1.3 && Math.random() < 0.8) fxCharge(e, '#ffd070', 2);
      if (e.actT >= 1.3 && !a.fire) { a.fire = true; e.play('lAwkFire', true); cam.flash = 0.25; cam.flashCol = '#fff0c0'; sfx.cannon(1.5); sfx.iai(); fxBeam(e.x + e.face * 70, e.y, e.z + 48, 1000, e.face, { w: 110, dur: 4.1, col: '#ffe090' }); }
      if (a.fire && e.actT < 5.3) { const n = Math.floor((e.actT - 1.3) / 0.25);
        if (n !== a.n && n < 16) { a.n = n; cam.shake = Math.max(cam.shake, 5); instantHit(e, { box: [40, 1000, 44, 0, 120], dmg: skillDmg(1.3, 0.38, lv), stun: 0.5, knock: 30, airLift: 140, hs: 0.03, col: '#ffe0a0', sure: true, downHit: true, type: 'indep' });
          const sy2 = e.y + rnd(-60, 60); fxBeam(e.x + e.face * 60, sy2, e.z + rnd(20, 100), 700, e.face, { w: 12, dur: 0.2, col: '#fff0a0' });
          instantHit(e, { box: [40, 700, 70, 0, 150], dmg: skillDmg(0.3, 0.1, lv), stun: 0.2, knock: 0, hs: 0.01, sure: true, type: 'indep' }); }
        // 屏障（3 级起）：炮口前方一段距离内的敌人被推回去
        if (lvOf(e, 'gl_awaken') >= 3) for (const t of ents) if (hittable(e, t) && (t.x - e.x) * e.face > 0 && Math.abs(t.x - e.x) < 90 && Math.abs(t.y - e.y) < 60 && !t.boss) t.x = e.x + e.face * 90; } } }) });
defSkill('gl_plasma', { name: '等离子放射器', cls: 'gun', job: 'launcher', tier: 1, lvReq: 23, mp: 80, cd: 30, type: 'indep', elem: 'light', col: '#8a5ae0',
  desc: '放射电流，多段攻击前方的敌人，持续期间把它们控制住、吸到电流尽头；放射中可以用方向键移动。全程霸体。', pow: lv => skillDmg(16, 1.6, lv), cmdNote: '→←↓→+Z（本作指令）', ai: { kind: 'poke', r: [0, 240], dy: 24 },
  act: (lv) => ({ name: 'gl_plasma', clip: 'plasma', dur: 2.2, noCounter: true, superArmor: true,
    onInput: (e, I) => { e.vx = I.dx() * e.speed * 0.4; e.vy = I.dy() * e.speed * 0.25; return false; },
    update: e => { const a = e.act, n = Math.floor(e.actT / 0.1), ex = e.x + e.face * 200;
      if (e.actT > 0.2 && n !== a.n && e.actT < 2.0) { a.n = n; fxBeam(e.x + e.face * 50, e.y, e.z + 56, 220, e.face, { w: 14 + (n % 2) * 8, dur: 0.12, col: '#c8a0ff' }); if (n % 2) sfx.hit('stab', false);
        instantHit(e, { box: [40, 260, 30, 20, 100], dmg: skillDmg(0.8, 0.08, lv), stun: 0.5, knock: 0, hs: 0.01, elem: 'light', col: '#e0c8ff', type: 'indep',
          onHit: (a2, t) => { if (!t.boss && !hasSA(t)) { t.x = damp(t.x, ex, 6, 0.1); t.y = damp(t.y, e.y, 6, 0.1); } } }); } },
    onEnd: e => { e.vx = 0; e.vy = 0; } }) });
defSkill('gl_fm92sw', { name: 'FM-92 mk2 SW 榴弹', cls: 'gun', job: 'launcher', tier: 1, lvReq: 25, mp: 90, cd: 50, type: 'indep', elem: 'fire', col: '#c05a2a', pre: { gl_fm92: 1 },
  desc: '锁定最近的敌人发射榴弹，在它头顶分离成 4 个刺状爆弹，落地爆炸并留下一片火焰地带（3 秒）。需要 FM-92 mk2 榴弹 Lv1。', pow: lv => skillDmg(26, 2.6, lv), cmdNote: '→←↑→+Z（本作指令）', ai: { kind: 'aoe', r: [80, 420], dy: 80 },
  act: (lv) => ({ name: 'gl_fm92sw', clip: 'lancerUp', dur: 0.8, superArmor: true, noCounter: true,
    events: [evAt(0.18, e => { sfx.cannon(1); const at = aimAhead(e, 260, 460, 120);
      for (let i = 0; i < 4; i++) { const tx = at.x + (i - 1.5) * 38, ty = clamp(at.y + rnd(-24, 24), 8, DEPTH - 8);
        game.after(0.35 + i * 0.06, () => { if (e.dead) return; lobProj(e, tx, ty, 0.35, { img: 'grenade', h: 14, z0: 160, vz: 20, onLand: q => { meteorImpact(q, 0.5); lblast(e, q.x, q.y, 70, { dmg: skillDmg(3.4, 0.34, lv), launch: 380, knock: 60, hs: 0.06, snd: 'fire', elem: 'fire' });
          groundPillar(e, q.x, q.y, { life: 3, bw: 40, bd: 26, bh: 50, img: 'flame', drawH: 60, ring: false, hit: { dmg: skillDmg(0.43, 0.043, lv), rep: 0.3, stun: 0.2, knock: 0, hs: 0.01, elem: 'fire', downHit: true, snd: 'fire', type: 'indep', onHit: (a, t) => { if (Math.random() < 0.3) addStatus(t, 'burn', 2, { dps: a.atk * 0.06, src: a }); } } }); } }); }); } })] }) });
/* ---- 二次觉醒：风暴骑兵（官方 75~85 级 → 本作 26~27 级）---- */
defSkill('gl_armor', { name: '重武装改造', cls: 'gun', job: 'launcher', tier: 2, lvReq: 26, sp: 30, mp: 0, cd: 0, type: 'indep', passive: true, col: '#7a7a8a',
  desc: '【二觉被动】后坐力减少，普通攻击和技能攻击力提高；加农炮改成接触即炸、飞得更远的炮弹。', infoExtra: lv => [['攻击力', '+' + pct(0.025 * lv)], ['后坐力', '-25%']] });
defSkill('gl_fsc7', { name: 'FSC-7 集束炸弹', cls: 'gun', job: 'launcher', tier: 2, lvReq: 26, mp: 90, cd: 40, type: 'indep', col: '#9a6a3a',
  desc: '发射子母弹，附着在第一个命中的敌人身上，随后小炸弹向四方扩散，连锁爆炸。全程霸体。', pow: lv => skillDmg(20, 2, lv), cmdNote: '↓↑→+Z（本作指令）', ai: { kind: 'proj', r: [40, 420], dy: 24 },
  act: (lv) => ({ name: 'gl_fsc7', clip: 'cannon', dur: 0.7, superArmor: true, noCounter: true,
    events: [evAt(0.16, e => { sfx.cannon(); e.play('cannonFire', true); let host = null;
      shootProj(e, { img: 'shell', w: 50, h: 20, speed: 760, life: 0.7, z: 62, dx: 46, bw: 14, bh: 26, pierce: false, trail: '#ffc070',
        hit: { dmg: skillDmg(2.0, 0.2, lv), stun: 0.5, knock: 20, hs: 0.06, snd: 'blunt', type: 'indep' }, onHitT: (pr, t) => { host = t; },
        onEnd: pr => { const P = { x: host ? host.x : pr.x, y: host ? host.y : pr.y };
          for (let k = 0; k < 10; k++) game.after(0.3 + k * 0.1, () => { if (e.dead) return; if (host && !host.dead) { P.x = host.x; P.y = host.y; }   // 官方：附着在目标身上连锁爆炸 10 段，小炸弹向四方扩散
            const a = k * 2.4, rr = 14 + k * 9, x = P.x + Math.cos(a) * rr, y = clamp(P.y + Math.sin(a) * rr * 0.45, 8, DEPTH - 8); meteorImpact({ x, y }, 0.35);
            lblast(e, P.x, P.y, 60 + k * 6, { dmg: skillDmg(1.8, 0.18, lv), launch: k === 9 ? 260 : 0, airLift: 130, stun: 0.35, knock: k === 9 ? 80 : 10, hs: 0.03, snd: 'fire' }, { zMax: 140 }); }); } }); })] }) });
defSkill('gl_pt15', { name: 'PT-15 原始型压缩炮', cls: 'gun', job: 'launcher', tier: 2, lvReq: 26, mp: 100, cd: 40, type: 'indep', col: '#5a8aa0',
  desc: '发射压缩空气炮，吸附沿途的敌人，飞一段距离后爆炸。按住 ↑ 同时向前后两边发射；按住 ↓ 向脚下发射，把周围的敌人聚过来再引爆。全程霸体。', pow: lv => skillDmg(22, 2.2, lv), ai: { kind: 'aoe', r: [0, 380], dy: 60 },
  act: (lv, p) => { const dy = p && p.pad ? p.pad.dy() : 0, mode = dy < 0 ? 'both' : dy > 0 ? 'down' : 'fwd';
    return { name: 'gl_pt15', clip: mode === 'down' ? 'ptDown' : 'ptFwd', dur: 0.95, superArmor: true, noCounter: true,
      events: [evAt(0.2, e => { sfx.cannon(1.2); cam.shake = 6;
        const vortex = (x0, dir, ground) => { const pr = spawnProj({ owner: e, x: x0, y: e.y, z: ground ? 0 : 60, vx: ground ? 0 : dir * 300, face: dir, life: ground ? 1.2 : 1.0, w: 60, d: 50, h: 90, pierce: true,
            hit: { dmg: skillDmg(0.8, 0.08, lv), stun: 0.3, knock: 0, hs: 0.01, rep: 0.15, type: 'indep' },
            update(q, dt) { for (const t of ents) if (hittable(e, t) && Math.hypot(t.x - q.x, (t.y - q.y) * 1.4) < (ground ? 220 : 120) && !(t.boss && hasSA(t))) { t.x = damp(t.x, q.x, 5, dt); t.y = damp(t.y, q.y, 5, dt); } },
            onEnd(q) { fxShock(q.x, q.y, 220, '#bfe8ff'); cam.shake = 9; sfx.boom(1.1); lblast(e, q.x, q.y, 140, { dmg: skillDmg(ground ? 14 : 10, ground ? 1.4 : 1.0, lv), launch: 460, knock: 140, hs: 0.1, big: 1.6, col: '#dff4ff' }, { zMax: 200 }); },
            draw(c, q) { drawSpr(c, fxTint('quantum', '#dff4ff'), sx(q.x), sy(q.y, q.z + 30), 90, 0, { alpha: 0.7, rot: q.t * 8 }); } }); return pr; };
        if (mode === 'down') vortex(e.x + e.face * 30, e.face, true);
        else { vortex(e.x + e.face * 50, e.face, false); if (mode === 'both') vortex(e.x - e.face * 50, -e.face, false); } })] }; } });
defSkill('gl_awaken2', { name: '火力全开', cls: 'gun', job: 'launcher', tier: 2, lvReq: 27, maxLv: 3, mp: 200, cd: 170, pvp: 0.45, type: 'indep', awaken: true, col: '#f0a02a',
  desc: '【二次觉醒】召唤并穿上强袭装甲：冲击波把周围的敌人向前推开，然后倾泻主激光、辅助激光、格林机枪、榴弹和火箭炮。全程无敌。', pow: lv => skillDmg(32, 9, lv), ai: { kind: 'awaken', r: [0, 600], dy: 90 },
  act: (lv) => ({ name: 'gl_awaken2', clip: 'armorOn', dur: 4.0, superArmor: true, noCounter: true, invul: true,
    onStart: e => { game.cutin = { t: 0, dur: 1.0, name: '火力全开', who: cutinWho(e, 2) }; game.timeStop = 0.9; sfx.awaken(); },
    update: e => { const a = e.act;
      if (e.actT > 0.4 && !a.push) { a.push = true; e.play('armorFire', true); fxShock(e.x, e.y, 260, '#ffd070'); cam.shake = 8; sfx.boom(1);
        lblast(e, e.x + e.face * 40, e.y, 180, { dmg: skillDmg(3, 1, lv), knock: 260, stun: 0.6, hs: 0.08, sure: true, downHit: true }, { zMax: 200 }); }
      if (e.actT > 0.8 && e.actT < 3.4) { const n = Math.floor(e.actT / 0.08);
        if (n !== a.n) { a.n = n; if (n % 2) { fireBullet(e, { dmg: skillDmg(0.3, 0.1, lv), life: 0.6, vol: 0.4, quiet: n % 4 !== 1, hit: { type: 'indep' } }); }
          if (n % 5 === 0) { fxBeam(e.x + e.face * 60, e.y + rnd(-30, 30), e.z + 70, 900, e.face, { w: 24, dur: 0.2, col: '#8fe0ff' }); instantHit(e, { box: [40, 900, 50, 0, 150], dmg: skillDmg(1.0, 0.3, lv), stun: 0.4, knock: 40, airLift: 120, hs: 0.02, sure: true, downHit: true, type: 'indep' }); }
          if (n % 9 === 0) { const tx = e.x + e.face * rnd(150, 500), ty = clamp(e.y + rnd(-60, 60), 8, DEPTH - 8); lobProj(e, tx, ty, 0.5, { img: 'grenade', h: 14, onLand: q => { meteorImpact(q, 0.5); lblast(e, q.x, q.y, 70, { dmg: skillDmg(1.5, 0.45, lv), launch: 320, knock: 80, hs: 0.05 }); } }); } } }
      if (e.actT > 3.4 && !a.fin) { a.fin = true; cam.flash = 0.3; cam.flashCol = '#fff0c0'; cam.shake = 14; sfx.boom(1.5); fxBeam(e.x + e.face * 70, e.y, e.z + 60, 1000, e.face, { w: 130, dur: 0.5, col: '#ffe090' });
        instantHit(e, { box: [40, 1000, 70, 0, 170], dmg: skillDmg(12, 3.5, lv), launch: 520, knock: 220, hs: 0.15, big: 2, sure: true, downHit: true, type: 'indep' }); } } }) });
/* ---- 三次觉醒：重霄·枪炮师（官方 95~100 级 → 本作 29~30 级）---- */
defSkill('gl_pandora', { name: 'Pandora_01', cls: 'gun', job: 'launcher', tier: 3, lvReq: 29, sp: 40, mp: 0, cd: 0, type: 'indep', passive: true, col: '#5a6a9a',
  desc: '【三觉被动】陆战机动装甲：普通攻击和转职技能攻击力提高；反坦克炮的爆炸范围更大；M-3、聚焦喷火器施放时霸体、移动更快。', infoExtra: lv => [['攻击力', '+' + pct(0.03 * lv)]] });
defSkill('gl_uht03', { name: 'UHT-03 爆炎喷火器', cls: 'gun', job: 'launcher', tier: 3, lvReq: 29, mp: 120, cd: 50, type: 'indep', elem: 'fire', col: '#ff6a1a',
  desc: '进入爆炎喷火模式（5 秒）：边走边向前喷出巨大的爆炎，多段攻击并留下火焰；模式中按 C 提前结束。全程霸体。', pow: lv => skillDmg(26, 2.6, lv), cmdNote: '→←↓↑+Z（本作指令）', ai: { kind: 'poke', r: [0, 300], dy: 30 },
  act: (lv) => ({ name: 'gl_uht03', clip: 'flame', dur: 5, noCounter: true, superArmor: true,
    onInput: (e, I) => { e.vx = I.dx() * e.speed * 0.8; e.vy = I.dy() * e.speed * 0.5; if (I.buffered('jump')) { I.consume('jump'); e.act.dur = Math.min(e.act.dur, e.actT + 0.1); } return false; },
    update: e => { const a = e.act, n = Math.floor(e.actT / 0.1);
      if (n !== a.n && e.actT > 0.15 && e.actT < a.dur - 0.1) { a.n = n; if (n % 2 === 0) sfx.flame(); flameJet(e, { range: 300, speed: 700, visual: true, z: 55 }); flameJet(e, { range: 260, speed: 600, visual: true, z: 30 });
        instantHit(e, { box: [30, 320, 34, 0, 100], dmg: skillDmg(0.5, 0.05, lv), stun: 0.3, knock: 30, airLift: 100, hs: 0.01, snd: 'fire', downHit: true, elem: 'fire', col: '#ffb060', type: 'indep', onHit: (a2, t) => { if (Math.random() < 0.3) addStatus(t, 'burn', 3, { dps: a2.atk * 0.08, src: a2 }); } }); } },
    onEnd: e => { e.vx = 0; e.vy = 0; } }) });
defSkill('gl_awaken3', { name: '制胜·最终兵器', cls: 'gun', job: 'launcher', tier: 3, lvReq: 30, maxLv: 3, mp: 300, cd: 270, pvp: 0.45, type: 'indep', awaken: true, col: '#ffd03a',
  desc: '【三次觉醒】进入决战形态：先放出一轮导弹扰乱，再对整片区域机动打击、自由开火，最后双手机枪切换成激光，放出无法躲避的巨大光束。全程无敌。', pow: lv => skillDmg(46, 13, lv), ai: { kind: 'awaken', r: [0, 700], dy: 110 },
  act: (lv) => ({ name: 'gl_awaken3', clip: 'finalWeapon', dur: 4.6, superArmor: true, noCounter: true, invul: true,
    onStart: e => { game.cutin = { t: 0, dur: 1.2, name: '制胜·最终兵器', who: cutinWho(e, 3) }; game.timeStop = 1.0; sfx.awaken(); },
    update: e => { const a = e.act;
      if (e.actT > 0.4 && e.actT < 1.4 && Math.floor(e.actT / 0.1) !== a.m) { a.m = Math.floor(e.actT / 0.1); const tx = e.x + e.face * rnd(120, 620), ty = clamp(e.y + rnd(-90, 90), 8, DEPTH - 8);
        lobProj(e, tx, ty, 0.45, { img: 'shell', h: 14, z0: 140, vz: 120, onLand: q => { meteorImpact(q, 0.5); lblast(e, q.x, q.y, 80, { dmg: skillDmg(1.4, 0.4, lv), launch: 300, knock: 80, hs: 0.04, sure: true }, { zMax: 200 }); } }); }
      if (e.actT > 1.5 && e.actT < 3.3 && Math.floor(e.actT / 0.06) !== a.g) { a.g = Math.floor(e.actT / 0.06); e.play(a.g % 2 ? 'finalWeapon' : 'finalWeapon2', true); fireBullet(e, { dmg: skillDmg(0.25, 0.08, lv), up: a.g % 5 === 2, low: a.g % 5 === 4, life: 0.7, vol: 0.4, quiet: a.g % 3 !== 0, hit: { type: 'indep', sure: true } }); }
      if (e.actT > 3.4 && !a.fin) { a.fin = true; e.play('finalWeapon2', true); cam.flash = 0.35; cam.flashCol = '#fff6d0'; cam.shake = 16; sfx.boom(1.6); sfx.iai(); fxBeam(e.x + e.face * 70, e.y, e.z + 60, 1100, e.face, { w: 180, dur: 0.9, col: '#fff0a0' });
        instantHit(e, { box: [30, 1100, 110, 0, 220], dmg: skillDmg(20, 5.5, lv), launch: 560, knock: 240, hs: 0.18, big: 2.4, critBonus: 0.2, sure: true, downHit: true, type: 'indep' }); } } }) });
/* ---- 被动效果 ---- */
CLASSES.gun.passives.push(p => {
  const apg = skLv(p, 'gl_apg'), arm = skLv(p, 'gl_armor'), pan = skLv(p, 'gl_pandora');
  setPassive(p, 'gl_apg', apg > 0 || arm > 0 || pan > 0, { crit: 0.013 * apg, dmg: 0.024 * apg + 0.025 * arm + 0.03 * pan, hide: true });
  if (skLv(p, 'gl_dual') && p.elem) { const m = Math.max(p.elem.fire || 0, p.elem.light || 0); p.elem.fire = m; p.elem.light = m; }
});
CLASSES.gun.jobs.launcher = { art: 'job/launcher', name: '枪炮师', role: '远程 · 重火力', armor: 'heavy', awaken: 'gl_awaken', awakenName: '重炮掌控者', awaken2: 'gl_awaken2', awakenName2: '风暴骑兵', awaken3: 'gl_awaken3', awakenName3: '重霄·枪炮师',
  desc: '操纵重火器的枪手。重火器系统让每次开炮都更猛：加农炮、激光炮、榴弹、量子爆弹覆盖整个战场。',
  auto: ['gl_hwlore'],
  skills: ['gl_hwlore', 'gl_draw', 'gl_hwmaster', 'gl_cannon', 'gl_antitank', 'gl_laser', 'gl_charge', 'gl_apg', 'gl_flame', 'gl_miracle', 'gl_fm31', 'gl_fm92', 'gl_dual', 'gl_quantum', 'gl_x1',
    'gl_overheat', 'gl_awaken', 'gl_plasma', 'gl_fm92sw', 'gl_armor', 'gl_fsc7', 'gl_pt15', 'gl_awaken2', 'gl_pandora', 'gl_uht03', 'gl_awaken3'] };
CLASSES.gun.cmds.push(['d', 'gl_cannon'], ['bf', 'gl_antitank'], ['ff', 'gl_laser'], ['buf', 'gl_flame'], ['ff', 'gl_miracle', 'buff'], ['uff', 'gl_fm31'], ['bdf', 'gl_fm92'], ['ud', 'gl_quantum'], ['bbf', 'gl_x1'],
  ['uudd', 'gl_awaken'], ['fbdf', 'gl_plasma'], ['fbuf', 'gl_fm92sw'], ['duf', 'gl_fsc7'], ['fbf', 'gl_pt15'], ['udff', 'gl_awaken2'], ['fbdu', 'gl_uht03'], ['bufd', 'gl_awaken3']);
