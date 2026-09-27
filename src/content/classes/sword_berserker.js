/* =====================================================================
   转职：狂战士（鬼剑士）—— 以血换力。血之狂暴、血气唤醒、嗜魂之手（抓取吸血）、暴走、怒气爆发、血气之刃、崩山裂地斩，觉醒 魔狱血刹
   ===================================================================== */
const bzMul = p => p && p.buffs && p.buffs.frenzy ? 1.3 : 1;   // 血之狂暴强化嗜魂之手 / 怒气爆发 / 十字斩
defSkill('frenzy', { name: '血之狂暴', cls: 'sword', job: 'berserker', lvReq: 15, mp: 30, cd: 3, type: 'phys', buff: true, col: '#c0102a',
  desc: '【BUFF · 再按一次解除】以血换力：持续消耗 HP，攻击力、攻击速度、僵直度提升，普攻附带出血；强化嗜魂之手、怒气爆发、十字斩。', ai: { kind: 'buff' },
  infoExtra: lv => [['攻击力', '+' + pct(0.12 + 0.012 * lv)], ['每秒消耗 HP', '0.6%']],
  act: (lv) => ({ name: 'frenzy', clip: 'roar', dur: 0.55, noCounter: true, superArmor: true,
    onStart: e => { if (toggleBuff(e, 'frenzy', 9999, { atk: 0.12 + 0.012 * lv, aspd: 0.1, stagger: 60 })) { sfx.buff(); sfx.boom(0.5); fxAura(e, '#ff2a3a', 1.2); fxBurst(e.x, e.y, e.z + 60, 160, '#ff3040'); } } }) });
defSkill('bloodwake', { name: '血气唤醒', cls: 'sword', job: 'berserker', lvReq: 15, mp: 0, cd: 0, type: 'phys', passive: true, col: '#a01020',
  desc: '【被动】HP 越低越强：HP ≤40% / 30% / 20% 时分三阶段提升技能伤害、攻击速度与移动速度。',
  infoExtra: lv => [['伤害提升', `${pct(0.04 + 0.006 * lv)} / ${pct(0.08 + 0.008 * lv)} / ${pct(0.12 + 0.01 * lv)}`]] });
defSkill('soulhand', { name: '嗜魂之手', cls: 'sword', job: 'berserker', lvReq: 25, mp: 35, cd: 8, type: 'phys', col: '#b01a2a',
  desc: '伸出鬼手抓住前方的敌人（可以抓住霸体和格挡中的敌人），吸取鲜血恢复 HP，最后让血气喷发把敌人击飞。', pow: lv => skillDmg(4.0, 0.4, lv), ai: { kind: 'grab', r: [20, 150], dy: 22 },
  act: (lv, p) => { const m = bzMul(p); return { name: 'soulhand', clip: 'soulhand', dur: 1.15, noCounter: true, superArmor: [0.1, 1.1],
    hits: [HB(0.12, 0.3, [10, 160, 30, 0, 110], skillDmg(0.8, 0.08, lv) * m, { grab: true, stun: 0.4, hs: 0.05 })],
    hold: (e, t) => { const k = clamp((e.actT - 0.2) / 0.25, 0, 1); t.x = damp(t.x, e.x + e.face * lerp(120, 42, k), 12, 1 / 60); t.y = e.y + 0.5; t.z = e.z + k * 55; t.face = -e.face; },
    events: [evAt(0.1, e => { sfx.swing(true); fxSpr('bloodhand', e.x + e.face * 70, e.y, e.z + 62, { w: 150, dur: 0.3, flip: e.face < 0, grow: [0.4, 1], alpha: 0.9 }); }),
      ...[0.5, 0.64, 0.78].map(t => evAt(t, e => { const g = e.grabbed; if (!g) return; applyHit(e, g, { dmg: skillDmg(0.7, 0.07, lv) * m, hs: 0.04, sure: true, snd: 'blunt', col: '#ff4a5a' }, { proj: true });
        const heal = Math.round(e.hpMax * 0.02); e.hp = Math.min(e.hpMax, e.hp + heal); addNumber(heal, e.x, e.y, e.z, { heal: true }); fxSpr('bloodpillar', g.x, g.y, 0, { h: 70, dur: 0.3, ay: 1, alpha: 0.7 }); })),
      evAt(0.92, e => { cam.shake = Math.max(cam.shake, 6); sfx.boom(0.8); const g = e.grabbed;
        if (g) { fxSpr('bloodpillar', g.x, g.y, 0, { h: 190, dur: 0.5, ay: 1, grow: [0.4, 1] }); fxBurst(g.x, g.y, g.z + 30, 170, '#ff3040'); }
        throwGrab(e, { dmg: skillDmg(1.4, 0.14, lv) * m, launch: 520, knock: 60, hs: 0.1, big: 1.5, col: '#ff4a5a' }); })] }; } });
defSkill('rampage', { name: '暴走', cls: 'sword', job: 'berserker', lvReq: 25, mp: 40, cd: 30, type: 'phys', buff: true, col: '#d02a2a',
  desc: '【BUFF】30 秒内攻击力、攻击速度、移动速度、僵直度大幅提升，但受到的伤害增加 10%。', ai: { kind: 'buff' },
  infoExtra: lv => [['攻击力', '+' + pct(0.1 + 0.01 * lv)], ['攻速 / 移速', '+15%']],
  act: (lv) => ({ name: 'rampage', clip: 'roar', dur: 0.5, noCounter: true, superArmor: true,
    onStart: e => { e.buffs.rampage = { t: 30, atk: 0.1 + 0.01 * lv, aspd: 0.15, mspd: 0.15, stagger: 60, taken: 0.1 }; sfx.buff(); fxAura(e, '#ff5a3a', 1); } }) });
defSkill('outrage', { name: '怒气爆发', cls: 'sword', job: 'berserker', lvReq: 30, mp: 40, cd: 10, type: 'phys', col: '#e0402a',
  desc: '以自身为中心爆发出血红的怒气，把周围所有敌人震上天。霸体。血之狂暴状态下威力提升。', pow: lv => skillDmg(4.5, 0.45, lv), ai: { kind: 'aoe', r: [0, 110], dy: 50 },
  act: (lv, p) => { const m = bzMul(p); return { name: 'outrage', clip: 'outrage', dur: 0.62, cancelFrom: 0.45, superArmor: true, noCounter: true,
    events: [evAt(0.02, () => sfx.charge()), evAt(0.2, e => { cam.shake = Math.max(cam.shake, 7); sfx.boom(1); fxShock(e.x, e.y, 200, '#ff3a3a'); fxBurst(e.x, e.y, e.z + 50, 240, '#ff2a3a');
      for (let i = 0; i < 6; i++) fxSpr('bloodpillar', e.x + Math.cos(i) * 70, e.y + Math.sin(i) * 25, 0, { h: 120, dur: 0.4, ay: 1, grow: [0.5, 1], alpha: 0.8 });
      blast(e, e.x, e.y, 120, { dmg: skillDmg(4.5, 0.45, lv) * m, launch: 520, knock: 60, hs: 0.1, big: 1.6, col: '#ff5a5a' }, { zMax: 150 }); })] }; } });
defSkill('bloodblade', { name: '血气之刃', cls: 'sword', job: 'berserker', lvReq: 40, mp: 50, cd: 12, type: 'phys', col: '#a0101a',
  desc: '消耗 3% HP，化作血光向前突进贯穿敌人（霸体），随后在终点引发血气爆炸。', pow: lv => skillDmg(6.0, 0.6, lv), ai: { kind: 'gap', r: [0, 220], dy: 24 },
  act: (lv) => ({ name: 'bloodblade', clip: 'bloodblade', dur: 0.8, superArmor: true, noCounter: true, move: [[0.08, 0.3, 700]],
    onStart: e => { e.hp = Math.max(1, e.hp - Math.round(e.hpMax * 0.03)); },
    hits: [HB(0.08, 0.32, [-20, 70, 30, 10, 110], skillDmg(1.8, 0.18, lv), { stun: 0.5, knock: 30, hs: 0.05, col: '#ff4a5a' })],
    events: [evAt(0.08, e => { fxAfterimage(e, '#ff4a5a'); fxStreak({ x: e.x, y: e.y, z: e.z + 60, face: e.face, len: 220, w: 22, col: '#ff3040', dur: 0.3 }); sfx.iai(); }),
      evAt(0.45, e => { const x = e.x + e.face * 30; cam.shake = Math.max(cam.shake, 6); sfx.boom(0.9); fxSpr('bloodwave', x, e.y, 0, { h: 150, dur: 0.4, ay: 1, flip: e.face < 0, grow: [0.5, 1.1] }); fxBurst(x, e.y, 60, 200, '#ff2a3a');
        blast(e, x, e.y, 110, { dmg: skillDmg(4.2, 0.42, lv), launch: 440, knock: 160, hs: 0.1, big: 1.6, col: '#ff5a5a' }, { zMax: 160 }); })] }) });
defSkill('quake', { name: '崩山裂地斩', cls: 'sword', job: 'berserker', lvReq: 45, mp: 70, cd: 20, type: 'phys', col: '#e0702a',
  desc: '高高跃起后把剑砸进大地，大范围冲击波把敌人震上天，随后岩浆接连喷发追打浮空的敌人。', pow: lv => skillDmg(9.0, 0.9, lv), ai: { kind: 'aoe', r: [0, 170], dy: 50 },
  act: (lv) => ({ name: 'quake', clip: 'quake', dur: 1.6, superArmor: true, noCounter: true,
    onStart: e => { e.vz = 560; e.z = Math.max(e.z, 1); e.vx = e.face * 120; sfx.jump(); },
    update: e => { if (e.actT > 0.3 && !e.act.dive) { e.act.dive = true; e.vz = -1300; } },
    onLand: e => { if (e.actT < 0.1) return; const a = e.act; a.onLand = null; a.dur = e.actT + 0.8; e.vx = 0; e.play('quakeLand', true);
      cam.shake = 12; sfx.boom(1.3); fxDust(e.x, e.y, 16, 50, '#7a5a3a'); fxShock(e.x + e.face * 40, e.y, 300, '#ff9a4a'); fxSpr('lava', e.x + e.face * 50, e.y, 0, { w: 220, dur: 0.6, ay: 0.8, grow: [0.5, 1.1] });
      blast(e, e.x + e.face * 40, e.y, 170, { dmg: skillDmg(4.0, 0.4, lv), launch: 520, knock: 80, hs: 0.12, big: 1.8, col: '#ffb060', downHit: true }, { zMax: 120 });
      for (let i = 0; i < 3; i++) game.after(0.16 + i * 0.14, () => { if (e.dead) return; const x = e.x + e.face * (90 + i * 70); sfx.boom(0.5); fxSpr('lava', x, e.y, 0, { w: 150, dur: 0.5, ay: 0.85, grow: [0.3, 1.1] });
        blast(e, x, e.y, 70, { dmg: skillDmg(1.7, 0.17, lv), airLift: 380, launch: 260, knock: 40, hs: 0.05, elem: 'fire', col: '#ffb060' }, { zMax: 260 }); }); } }) });
defSkill('bz_awaken', { name: '魔狱血刹', cls: 'sword', job: 'berserker', lvReq: 18, maxLv: 3, mp: 150, cd: 60, pvp: 0.45, type: 'phys', awaken: true, col: '#8a0010',
  desc: '【觉醒】魔剑吸收周围的血气不断变大，最后砸向大地，血气柱贯穿整个画面。', pow: lv => skillDmg(24, 6, lv), ai: { kind: 'awaken', r: [0, 300], dy: 90 },
  act: (lv) => ({ name: 'bz_awaken', clip: 'bzAwk', dur: 2.6, superArmor: true, noCounter: true, invul: [0, 2.0],
    onStart: e => { game.cutin = { t: 0, dur: 1.0, name: '魔狱血刹', who: e }; game.timeStop = 0.9; sfx.awaken(); },
    update: e => { if (e.actT > 0.95 && e.actT < 1.7) { e.drawOpts = { glow: (e.actT - 0.95) * 1.3 }; if (Math.random() < 0.7) fxCharge(e, '#ff3040', 2); } },
    onEnd: e => { e.drawOpts = {}; },
    events: [evAt(0.95, e => { sfx.charge(); fxAura(e, '#ff2030', 1.2); for (const t of ents) if (hittable(e, t) && Math.abs(t.x - e.x) < WW) applyHit(e, t, { dmg: skillDmg(1.5, 0.5, lv), stun: 0.8, hs: 0.05, sure: true, col: '#ff4a5a' }, { proj: true }); }),
      evAt(1.75, e => { cam.flash = 0.35; cam.flashCol = '#ff4a4a'; cam.shake = 14; sfx.boom(1.4); sfx.iai();
        fxShock(e.x + e.face * 60, e.y, 360, '#ff3040'); fxBurst(e.x + e.face * 60, e.y, 40, 300, '#ff2030');
        for (let i = 0; i < 9; i++) game.after(i * 0.05, () => fxSpr('bloodpillar', e.x + e.face * (60 + i * 95), e.y + rnd(-20, 20), 0, { h: 260, dur: 0.6, ay: 1, grow: [0.3, 1.05] }));
        for (const t of ents) if (hittable(e, t) && (t.x - e.x) * e.face > -80 && Math.abs(t.x - e.x) < 900) applyHit(e, t, { dmg: skillDmg(18, 5, lv), launch: 560, knock: 160, hs: 0.2, big: 2.2, critBonus: 0.3, downHit: true, sure: true, col: '#ff4a5a' }, { proj: true }); })] }) });
CLASSES.sword.jobs.berserker = { art: 'job/berserker', name: '狂战士', role: '近战 · 爆发', armor: 'heavy', awaken: 'bz_awaken', awakenName: '狱血魔神',
  desc: '以自身鲜血换取力量的鬼剑士。血之狂暴下攻势凶猛，嗜魂之手抓取吸血，HP 越低越强。',
  skills: ['frenzy', 'bloodwake', 'soulhand', 'rampage', 'outrage', 'bloodblade', 'quake', 'bz_awaken'] };
CLASSES.sword.cmds.push(['du', 'frenzy', 'buff'], ['ff', 'soulhand'], ['ff', 'rampage', 'buff'], ['du', 'outrage'], ['bbf', 'bloodblade'], ['uff', 'quake'], ['uudd', 'bz_awaken']);
// 被动：血之狂暴耗血 + 刀光变红；血气唤醒按 HP 分阶段
CLASSES.sword.passives.push(p => {
  if (p.buffs.frenzy) { p.hp = Math.max(1, p.hp - p.hpMax * 0.006 * 0.25); p.slashCol = '#ff5a5a'; } else p.slashCol = CLASSES.sword.slashCol || '#8fd8ff';
  const lv = skLv(p, 'bloodwake'), f = p.hp / p.hpMax, st = !lv ? 0 : f <= 0.2 ? 3 : f <= 0.3 ? 2 : f <= 0.4 ? 1 : 0;
  setPassive(p, 'bloodwake', st > 0, { dmg: [0, 0.04 + 0.006 * lv, 0.08 + 0.008 * lv, 0.12 + 0.01 * lv][st], aspd: 0.05 * st, mspd: 0.05 * st });
});
// 血之狂暴中普攻附带出血
CLASSES.sword.onHit = (p, t, h, dmg, act) => { if (act && act.basic && p.buffs.frenzy && !t.dead) addStatus(t, 'bleed', 2, { dps: p.atk * 0.06, src: p }); };
