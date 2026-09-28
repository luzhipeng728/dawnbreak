/* =====================================================================
   转职：狂战士（鬼剑士，jobId berserker）—— 国服现版对齐（docs/SKILLS_OFFICIAL_sword.md 第 4 节）
   狂暴之力（开关：二刀流普攻、以血换力，5 个技能必须在狂暴中施放）、血气旺盛（出血链）、力量唤醒、暴走（无限持续）、
   狂气斩、怒气爆发、狂热回旋、饥渴（蓄力耗血）、暴怒狂斩、嗜魂封魔斩、爆发之刃（命中即爆、可取消）、崩山裂地斩，觉醒 魔狱血刹
   伤害类型：转职技能为独立攻击（狂战士按力量）；嗜魂之手已移到基础技能（sword.js）
   ===================================================================== */
const bzFrenzy = p => !!(p && p.buffs && p.buffs.frenzy);
const bzReq = p => bzFrenzy(p) ? true : '需要狂暴之力';
const bzVig = p => !!(p && hasSkill(p, 'bz_vigor'));
const bzBleed = (e, t) => { if (bzVig(e) && t && !t.dead) addStatus(t, 'bleed', 7, { dps: e.atk * 0.05, src: e }); };
const bzBleedArea = e => bzVig(e) ? { status: 'bleed', sdur: 7, dps: 0.05 } : {};

/* ---- 狂暴之力下的二刀流普攻：一轮 4 刀、每刀 2 段；范围大（含纵深、身后也有判定）；狂暴血气：只在第 1、2 刀之间循环 ---- */
const bzHit = (t0, t1, box, dmg, o) => HB(t0, t1, box, dmg, { rep: 0.06, max: 2, hs: 0.04, type: 'indep', ...o });
const SWORD_ACTS_BZ = { ...SWORD_ACTS,
  atk1: { name: 'atk1', clip: 'bzA1', dur: 0.3, basic: true, speed: 'aspd', chain: [0.12, 0.3], next: 'atk2', move: [[0.02, 0.08, 110]],
    hits: [bzHit(0.05, 0.16, [-24, 82, 36, 10, 110], 0.6, { stun: 0.32, knock: 40 })],
    events: [slashAt(0.04, { a0: -2.4, a1: 0.8, r: 58, w: 14, off: [12, 60], col: '#ff7a7a' }), slashAt(0.1, { a0: 2.2, a1: -0.6, r: 54, w: 12, off: [12, 52], col: '#ff7a7a', silent: true })] },
  atk2: { name: 'atk2', clip: 'bzA2', dur: 0.3, basic: true, speed: 'aspd', chain: [0.12, 0.3], next: p => skLv(p, 'bz_madness') ? 'atk1' : 'atk3', move: [[0.02, 0.08, 100]],
    hits: [bzHit(0.05, 0.16, [-24, 82, 36, 10, 110], 0.62, { stun: 0.32, knock: 50 })],
    events: [slashAt(0.04, { a0: 1.0, a1: -2.2, r: 58, w: 14, off: [12, 56], col: '#ff7a7a' }), slashAt(0.1, { a0: -1.0, a1: 2.0, r: 52, w: 12, off: [12, 50], col: '#ff7a7a', silent: true })] },
  atk3: { name: 'atk3', clip: 'bzA3', dur: 0.32, basic: true, speed: 'aspd', chain: [0.14, 0.32], next: 'atk4', move: [[0.02, 0.1, 140]],
    hits: [bzHit(0.05, 0.18, [-24, 86, 36, 0, 120], 0.7, { stun: 0.36, knock: 60 })],
    events: [slashAt(0.04, { a0: -2.8, a1: 1.0, r: 62, w: 16, off: [12, 60], col: '#ff7a7a' }), slashAt(0.1, { a0: 0.6, a1: -2.0, r: 56, w: 14, off: [10, 44], col: '#ff7a7a', silent: true })] },
  atk4: { name: 'atk4', clip: 'bzA4', dur: 0.42, basic: true, speed: 'aspd', move: [[0.04, 0.14, 200]],
    hits: [bzHit(0.06, 0.2, [-30, 92, 38, 0, 120], 0.9, { knock: 220, stun: 0.5, heavy: true, shake: 3, big: 1.3 })],
    events: [slashAt(0.05, { a0: -3.0, a1: 0.3, r: 66, w: 18, off: [0, 55], squash: 0.45, col: '#ff6a6a', heavy: true }), slashAt(0.12, { a0: 0.3, a1: 3.2, r: 66, w: 18, off: [0, 55], squash: 0.45, col: '#ff6a6a', silent: true })] },
};
// 狂暴之力中：连突刺、跳攻、跑攻、空之连刃变为独立攻击
for (const k of ['dash', 'dash2', 'jatk', 'jatk2', 'jatk3']) SWORD_ACTS_BZ[k] = { ...SWORD_ACTS[k], type: 'indep' };
SWORD_ACT_PICK.push(p => jobOf(p) === 'berserker' && bzFrenzy(p) ? SWORD_ACTS_BZ : null);

/* ---- 被动 ---- */
defSkill('bz_vigor', { name: '血气旺盛', cls: 'sword', job: 'berserker', lvReq: 15, maxLv: 1, mp: 0, cd: 0, type: 'indep', passive: true, col: '#b01020',
  desc: '【被动】所有转职技能、崩山击、十字刃和狂暴之力的普攻都附带出血（7 秒）。崩山击多一道血气冲击波；十字刃改为消耗 HP，血十字变大。' });
defSkill('bz_madness', { name: '狂暴血气', cls: 'sword', job: 'berserker', lvReq: 15, maxLv: 1, mp: 0, cd: 0, type: 'indep', passive: true, col: '#d0303a',
  desc: '【被动】狂暴之力状态下，普攻只在第 1、2 刀之间循环（不再出第 3、4 刀），适合持续乱砍。' });
defSkill('bloodwake', { name: '力量唤醒', cls: 'sword', job: 'berserker', lvReq: 15, mp: 0, cd: 0, type: 'indep', passive: true, col: '#a01020',
  desc: '【被动】技能攻击力、攻击速度、移动速度提高；HP 低于 70% / 60% / 50% 时分三档额外提高攻击速度和移动速度。',
  infoExtra: lv => [['技能攻击力', '+' + pct(0.03 + 0.006 * lv)], ['攻速 / 移速', `+${pct(0.03)}，低血每档再 +${pct(0.04)}`]] });

/* ---- 狂暴之力：开关 BUFF（再按一次解除）。施放时和之后每 10 秒扣固定 HP（扣到 1 也不会自动关）；
   普攻变二刀流；普攻与转职技能攻击力、命中、僵直提高；转职技能冷却 −10%；击杀出血的敌人回少量 HP ---- */
const frenzyCost = lv => [40 + 12 * lv, 20 + 5 * lv];   // [施放, 每 10 秒]
defSkill('frenzy', { name: '狂暴之力', cls: 'sword', job: 'berserker', lvReq: 15, mp: 30, cd: 10, type: 'indep', buff: true, col: '#c0102a',
  desc: '【开关 BUFF · 再按一次解除】以血换力：施放时和之后每 10 秒消耗一定 HP（HP 扣到 1 也不会自动解除）。普攻变为二刀流（一轮 4 刀、每刀 2 段，范围更大），普攻和转职技能攻击力、僵直提高，转职技能冷却减少 10%，击杀出血的敌人时恢复少量 HP。狂气斩、暴怒狂斩、嗜魂封魔斩、爆发之刃、崩山裂地斩只能在狂暴之力中施放。',
  ai: { kind: 'buff' }, infoExtra: lv => [['攻击力', '+' + pct(0.1 + 0.01 * lv)], ['施放 / 每 10 秒消耗 HP', frenzyCost(lv).join(' / ')]],
  act: (lv) => ({ name: 'frenzy', clip: 'roar', dur: 0.5, noCounter: true, superArmor: true,
    onStart: e => {
      if (toggleBuff(e, 'frenzy', 9999, { atk: 0.1 + 0.01 * lv, stagger: 100, lv })) { const [c0] = frenzyCost(lv); e.hp = Math.max(1, e.hp - c0); e.buffs.frenzy.tick = 10;
        sfx.buff(); sfx.boom(0.5); fxAura(e, '#ff2a3a', 1.2); fxBurst(e.x, e.y, e.z + 60, 160, '#ff3040'); }
      if (!(e.st === 'act' && e.act && e.act.basic)) e.acts = swordActs(e);
    } }) });
defSkill('bz_defy', { name: '死亡抗拒', cls: 'sword', job: 'berserker', lvReq: 16, maxLv: 1, mp: 20, cd: 10, type: 'indep', buff: true, col: '#e04a4a',
  desc: '【HP 低于 50% 时可用】1 秒内恢复一定比例的 HP，并在 10 秒内减少受到的伤害、提高僵直。', ai: { kind: 'buff' }, infoExtra: () => [['恢复 HP', '15%'], ['受到伤害', '-15%（10 秒）']],
  req: p => p.hp <= p.hpMax * 0.5 ? true : 'HP 需低于 50%',
  act: () => ({ name: 'bz_defy', clip: 'roar', dur: 0.5, noCounter: true, superArmor: true,
    onStart: e => { e.buffs.bz_defy = { t: 10, taken: -0.15, stagger: 60 }; sfx.buff(); fxAura(e, '#ff8a8a', 1);
      for (let i = 1; i <= 5; i++) game.after(i * 0.2, () => { if (e.dead) return; const h = Math.round(e.hpMax * 0.03); e.hp = Math.min(e.hpMax, e.hp + h); addNumber(h, e.x, e.y, e.z, { heal: true }); }); } }) });

/* ---- 狂气斩（仅狂暴中）：双剑向前斩，再按技能键追加 1 击；按 → 滑行、按 ← 反向 ---- */
defSkill('bz_scratch', { name: '狂气斩', cls: 'sword', job: 'berserker', lvReq: 16, mp: 20, cd: 6, type: 'indep', col: '#e04040', req: bzReq,
  desc: '【狂暴之力中】双剑向前交叉斩击，再按技能键追加一斩。按 → 向前滑行，按 ← 转身反向斩。', pow: lv => skillDmg(3.2, 0.32, lv), ai: { kind: 'poke', r: [0, 90], dy: 24 },
  act: (lv, p) => bzScratch(lv, p, 1) });
function bzScratch(lv, p, n) {
  return { name: 'bz_scratch' + n, clip: n === 1 ? 'dual1' : 'dual2', dur: 0.42, noCounter: true, follow: n === 1 ? () => bzScratch(lv, p, 2) : null, followWin: [0.16, 0.42],
    onStart: e => { const d = e.pad.dx() * e.face; if (d < 0) e.face = -e.face; e.act.move = [[0.02, 0.14, d > 0 ? 420 : 140]]; },
    hits: [HB(0.06, 0.16, [-10, 90, 36, 10, 115], skillDmg(1.6, 0.16, lv), { rep: 0.05, max: 2, stun: 0.45, knock: n === 2 ? 180 : 70, hs: 0.06, heavy: n === 2, col: '#ff6a6a', onHit: (a, t) => bzBleed(a, t) })],
    events: [slashAt(0.05, { a0: -2.4, a1: 1.0, r: 68, w: 18, off: [10, 56], col: '#ff6a6a', heavy: true }), slashAt(0.09, { a0: 1.0, a1: -2.4, r: 64, w: 16, off: [10, 52], col: '#ff6a6a', silent: true })] };
}

/* ---- 暴走：持续时间无限。技能攻击力、攻速、移速、僵直大幅提高；代价是防御下降（受到的伤害 +10%）；
   爆发之刃、嗜魂封魔斩、崩山裂地斩冷却 −20%；十字刃、崩山击、狂暴普攻僵直更大、后摇更短 ---- */
defSkill('rampage', { name: '暴走', cls: 'sword', job: 'berserker', lvReq: 17, mp: 40, cd: 5, type: 'indep', buff: true, col: '#d02a2a',
  desc: '【BUFF · 持续时间无限】攻击力、攻击速度、移动速度、僵直大幅提高，但防御下降（受到的伤害增加 10%）。爆发之刃、嗜魂封魔斩、崩山裂地斩冷却减少 20%；十字刃、崩山击、狂暴之力普攻的僵直更大、后摇更短。',
  ai: { kind: 'buff' }, infoExtra: lv => [['攻击力', '+' + pct(0.08 + 0.01 * lv)], ['攻速 / 移速', '+' + pct(0.1 + 0.005 * lv)]],
  act: (lv) => ({ name: 'rampage', clip: 'roar', dur: 0.5, noCounter: true, superArmor: true,
    onStart: e => { e.buffs.rampage = { t: 9999, atk: 0.08 + 0.01 * lv, aspd: 0.1 + 0.005 * lv, mspd: 0.1 + 0.005 * lv, stagger: 150, taken: 0.1 }; sfx.buff(); fxAura(e, '#ff5a3a', 1); } }) });

/* ---- 怒气爆发：脚下出圆阵，冲击波 + 血柱共 10 段，把周围敌人高高浮空。霸体 ---- */
defSkill('outrage', { name: '怒气爆发', cls: 'sword', job: 'berserker', lvReq: 18, mp: 40, cd: 13, type: 'indep', col: '#e0402a',
  desc: '脚下出现血色圆阵，怒气爆发：冲击波和血柱共 10 段，把周围所有敌人高高震上天。霸体。', pow: lv => skillDmg(4.5, 0.45, lv), ai: { kind: 'aoe', r: [0, 110], dy: 50 },
  act: (lv) => ({ name: 'outrage', clip: 'outrage', dur: 0.8, superArmor: true, noCounter: true,
    events: [evAt(0.02, e => { sfx.charge(); fxShock(e.x, e.y, 110, '#ff3a3a'); }),
      evAt(0.2, e => { cam.shake = Math.max(cam.shake, 7); sfx.boom(1); fxShock(e.x, e.y, 200, '#ff3a3a'); fxBurst(e.x, e.y, e.z + 50, 240, '#ff2a3a');
        blast(e, e.x, e.y, 120, { dmg: skillDmg(1.8, 0.18, lv), launch: 520, knock: 60, hs: 0.1, big: 1.6, col: '#ff5a5a' }, { zMax: 150, ...bzBleedArea(e) }); }),
      ...[0, 1, 2, 3, 4, 5, 6, 7, 8].map(i => evAt(0.26 + i * 0.045, e => { const a = i * 0.7;
        fxSpr('bloodpillar', e.x + Math.cos(a) * 80, e.y + Math.sin(a) * 28, 0, { h: 120, dur: 0.4, ay: 1, grow: [0.5, 1], alpha: 0.8 });
        blast(e, e.x, e.y, 120, { dmg: skillDmg(0.3, 0.03, lv), airLift: 240, knock: 10, hs: 0.02, col: '#ff5a5a' }, { zMax: 260 }); }))] }) });

/* ---- 狂热回旋：挥剑把左右两侧的敌人扫到身前，原地回旋上斩击飞 ---- */
defSkill('bz_whirl', { name: '狂热回旋', cls: 'sword', job: 'berserker', lvReq: 18, mp: 35, cd: 10, type: 'indep', col: '#d04a3a',
  desc: '挥剑把左右两侧的敌人扫到身前，随即原地回旋上斩把它们击飞。', pow: lv => skillDmg(4.0, 0.4, lv), ai: { kind: 'aoe', r: [0, 130], dy: 40 },
  act: (lv) => ({ name: 'bz_whirl', clip: 'whirl', dur: 0.8, superArmor: [0, 0.6], noCounter: true,
    events: [evAt(0.08, e => { sfx.swing(true); fxSlashOn(e, { col: '#ff6a6a', a0: -3.1, a1: 3.1, r: 110, w: 20, off: [0, 40], squash: 0.4, dur: 0.25 });
        for (const t of ents) if (hittable(e, t) && !t.boss && Math.abs(t.y - e.y) < 60 && Math.abs(t.x - e.x) < 220) { t.x = lerp(t.x, e.x + e.face * 45, 0.85); t.y = lerp(t.y, e.y, 0.5); }
        blast(e, e.x, e.y, 150, { dmg: skillDmg(1.6, 0.16, lv), stun: 0.6, knock: 0, hs: 0.05, col: '#ff6a6a' }, { zMax: 120, ...bzBleedArea(e) }); }),
      evAt(0.36, e => { e.play('rise', true); sfx.swing(true); fxSlashOn(e, { col: '#ff6a6a', a0: 1.4, a1: -1.9, r: 76, w: 22, off: [6, 50], heavy: true }); cam.shake = Math.max(cam.shake, 4);
        instantHit(e, { box: [-40, 90, 40, 0, 140], dmg: skillDmg(2.4, 0.24, lv), launch: 520, knock: 60, hs: 0.1, big: 1.5, col: '#ff6a6a' }); })] }) });

/* ---- 饥渴：按住蓄力（每 0.5 秒扣 10% HP，最多 8 次；HP 低于 10% 时停止），松手放出出血冲击波；之后普攻和转职技能攻击力提高（持续时间无限）。
   蓄满时嗜魂之手吸取次数 +3 ---- */
defSkill('bz_thirst', { name: '饥渴', cls: 'sword', job: 'berserker', lvReq: 19, mp: 30, cd: 10, type: 'indep', buff: true, col: '#901020',
  desc: '【BUFF · 按住蓄力】每 0.5 秒消耗 10% HP（最多 8 次，HP 低于 10% 时停止），松开后放出出血冲击波；之后普攻和转职技能攻击力提高，持续时间无限，蓄力越久提高越多。蓄满时嗜魂之手的吸取次数 +3。',
  pow: lv => skillDmg(2.0, 0.2, lv), ai: { kind: 'buff' }, infoExtra: lv => [['攻击力提高（每段蓄力）', '+' + pct(0.01 + 0.002 * lv)], ['基础提高', '+' + pct(0.04 + 0.006 * lv)]],
  act: (lv) => ({ name: 'bz_thirst', clip: 'thirst', dur: 0.6, noCounter: true, superArmor: true,
    charge: { at: 0.05, max: 4, min: 0, dmg: 0,
      update: (e, dt) => { const a = e.act; a.tk = (a.tk || 0) + dt; if (Math.random() < 0.5) fxCharge(e, '#ff3040');
        if (a.tk >= 0.5) { a.tk = 0; if (e.hp < e.hpMax * 0.1 || (a.n || 0) >= 8) { a.chargeT = a.charge.max; return; } a.n = (a.n || 0) + 1; const c = Math.round(e.hpMax * 0.1); e.hp = Math.max(1, e.hp - c); addNumber(c, e.x, e.y, e.z, { player: true }); fxBurst(e.x, e.y, e.z + 50, 60, '#ff3040'); } },
      onRelease: e => { const a = e.act, n = a.n || 0;
        e.buffs.bz_thirst = { t: 9999, dmg: 0.04 + 0.006 * lv + (0.01 + 0.002 * lv) * n, full: n >= 8 }; sfx.buff(); sfx.boom(0.8); fxAura(e, '#ff2030', 1);
        fxShock(e.x, e.y, 250, '#ff3040'); cam.shake = Math.max(cam.shake, 5);
        blast(e, e.x, e.y, 250, { dmg: skillDmg(2.0, 0.2, lv) * (1 + n * 0.15), knock: 160, stun: 0.5, hs: 0.06, col: '#ff4a5a' }, { zMax: 120, status: 'bleed', sdur: 7, dps: 0.05 }); } } }) });

/* ---- 暴怒狂斩（仅狂暴中）：下劈浮空 → 双刀空中乱砍 4 次、每刀留下剑痕 → 剑痕一起撕裂敌人。霸体 ---- */
defSkill('bz_enrage', { name: '暴怒狂斩', cls: 'sword', job: 'berserker', lvReq: 19, mp: 50, cd: 20, type: 'indep', col: '#ff3a3a', req: bzReq,
  desc: '【狂暴之力中】武器下劈把敌人挑上半空，跃起双刀乱砍 4 次，每一刀都在空中留下血色剑痕，最后所有剑痕一起撕裂敌人。霸体。', pow: lv => skillDmg(8.0, 0.8, lv), ai: { kind: 'launch', r: [0, 90], dy: 26 },
  act: (lv) => ({ name: 'bz_enrage', clip: 'rise', dur: 1.5, superArmor: true, noCounter: true, lowGrav: 0.35,
    hits: [HB(0.06, 0.16, [-10, 84, 34, 0, 140], skillDmg(1.4, 0.14, lv), { launch: 480, knock: 40, hs: 0.08, col: '#ff6a6a', onHit: (a, t) => bzBleed(a, t) })],
    events: [evAt(0.24, e => { e.vz = 420; e.z = Math.max(e.z, 1); e.vx = e.face * 60; e.play('enrage', true); e.act.marks = []; }),
      ...[0.34, 0.46, 0.58, 0.7].map((t, i) => evAt(t, e => { sfx.swing(true); const m = { x: e.x + e.face * 55, y: e.y, z: e.z + 40, a: i % 2 ? 0.8 : -0.8 }; e.act.marks.push(m);
        fxSlashOn(e, { col: '#ff4a4a', a0: i % 2 ? 1.2 : -2.4, a1: i % 2 ? -2.2 : 1.0, r: 66, w: 18, off: [10, 40] });
        addFx({ x: m.x, y: m.y + 0.5, z: m.z, dur: 0.9 - i * 0.12, add: true, draw(c) { const k = this.t / this.dur; drawSpr(c, fxTint('slash', '#ff4a4a'), sx(this.x), sy(this.y, this.z), 110, 0, { rot: m.a, alpha: 0.85 * (1 - k * 0.5) }); } });
        blast(e, m.x, m.y, 70, { dmg: skillDmg(0.8, 0.08, lv), airLift: 200, stun: 0.3, knock: 10, hs: 0.03, col: '#ff6a6a' }, { z: Math.max(0, m.z - 80), zMax: 260 }); })),
      evAt(1.0, e => { cam.shake = Math.max(cam.shake, 7); sfx.boom(1); sfx.iai();
        for (const m of e.act.marks || []) { fxSlashX(m.x, m.y, m.z, 140, '#ff3040'); blast(e, m.x, m.y, 80, { dmg: skillDmg(0.9, 0.09, lv), launch: 300, knock: 120, hs: 0.06, big: 1.4, col: '#ff5a5a' }, { zMax: 300, ...bzBleedArea(e) }); } })],
    onLand: e => { if (e.actT > 1.05) e.endAct(); } }) });

/* ---- 嗜魂封魔斩（仅狂暴中）：旋风把前方敌人快速吸到身前 → 血剑强力上斩击飞 ---- */
defSkill('bz_twister', { name: '嗜魂封魔斩', cls: 'sword', job: 'berserker', lvReq: 19, mp: 55, cd: 25, type: 'indep', col: '#c01030', req: bzReq,
  desc: '【狂暴之力中】举剑卷起血色旋风，把前方的敌人快速吸到身前，再用血剑强力上斩把它们击飞。抓不动的敌人不受吸引。', pow: lv => skillDmg(7.5, 0.75, lv), ai: { kind: 'aoe', r: [0, 220], dy: 40 },
  act: (lv) => ({ name: 'bz_twister', clip: 'twister', dur: 1.2, superArmor: true, noCounter: true,
    update: (e, dt) => { if (e.actT < 0.7) { const cx = e.x + e.face * 60; for (const t of ents) if (hittable(e, t) && !t.boss && (t.x - e.x) * e.face > -30 && Math.abs(t.x - e.x) < 300 && Math.abs(t.y - e.y) < 80) { t.x = damp(t.x, cx, 6, dt); t.y = damp(t.y, e.y, 6, dt); }
      if (Math.random() < 0.5) fxSpr('vortex', e.x + e.face * 60, e.y, e.z + 60, { w: 150, dur: 0.25, alpha: 0.5, col: '#ff3a4a' }); } },
    hits: [HB(0.1, 0.7, [-10, 110, 40, 0, 130], skillDmg(0.4, 0.04, lv), { rep: 0.1, stun: 0.3, knock: 0, hs: 0.02, col: '#ff5a5a' })],
    events: [evAt(0.05, e => sfx.charge()), evAt(0.75, e => { e.play('bladeW', true); sfx.swing(true); sfx.iai(); cam.shake = Math.max(cam.shake, 6);
      fxSlashOn(e, { col: '#ff3040', a0: 1.4, a1: -1.9, r: 90, w: 26, off: [10, 50], heavy: true }); fxSpr('bloodwave', e.x + e.face * 60, e.y, 0, { h: 150, dur: 0.4, ay: 1, flip: e.face < 0 });
      instantHit(e, { box: [-10, 110, 42, 0, 160], dmg: skillDmg(4.8, 0.48, lv), launch: 560, knock: 80, hs: 0.12, big: 1.7, col: '#ff5a5a' }); bzBleedAreaAt(e, e.x + e.face * 60); })] }) });
const bzBleedAreaAt = (e, x) => { if (bzVig(e)) for (const t of ents) if (foe(e, t) && Math.abs(t.x - x) < 90 && Math.abs(t.y - e.y) < 50) bzBleed(e, t); };

/* ---- 爆发之刃（仅狂暴中）：喷血凝成剑，握剑突刺，命中立即爆炸（把敌人推开）；命中后可以取消接其他技能；按 ← 原地刺 ---- */
defSkill('bloodblade', { name: '爆发之刃', cls: 'sword', job: 'berserker', lvReq: 19, mp: 50, cd: 20, type: 'indep', col: '#a0101a', req: bzReq,
  desc: '【狂暴之力中】喷出鲜血在前方凝成剑，握剑向前突刺，刺中敌人时立即爆炸，把敌人从爆心推开。命中后可以马上用其他技能取消。按 ← 原地突刺。霸体。', pow: lv => skillDmg(6.0, 0.6, lv), ai: { kind: 'gap', r: [0, 220], dy: 24 },
  act: (lv) => ({ name: 'bloodblade', clip: 'bloodblade', dur: 0.8, superArmor: true, noCounter: true, hitCancel: true, links: swordAttackIds(),
    onStart: e => { const back = e.pad.dx() * e.face < 0; e.act.move = back ? [] : [[0.08, 0.3, 700]]; },
    hits: [HB(0.08, 0.32, [-20, 80, 30, 10, 110], skillDmg(1.8, 0.18, lv), { stun: 0.5, knock: 30, hs: 0.05, col: '#ff4a5a', onHit: (a, t) => { bzBleed(a, t); if (!a.act || a.act.boom) return; a.act.boom = true; a.act.move = []; a.vx = 0; bloodBoom(a, lv, t.x); a.act.dur = Math.min(a.act.dur, a.actT + 0.3); } })],
    events: [evAt(0.08, e => { fxAfterimage(e, '#ff4a5a'); fxStreak({ x: e.x, y: e.y, z: e.z + 60, face: e.face, len: 220, w: 22, col: '#ff3040', dur: 0.3 }); sfx.iai(); }),
      evAt(0.45, e => { if (!e.act.boom) { e.act.boom = true; bloodBoom(e, lv, e.x + e.face * 30); } })] }) });
function bloodBoom(e, lv, x) {
  cam.shake = Math.max(cam.shake, 6); sfx.boom(0.9); fxSpr('bloodwave', x, e.y, 0, { h: 150, dur: 0.4, ay: 1, flip: e.face < 0, grow: [0.5, 1.1] }); fxBurst(x, e.y, 60, 200, '#ff2a3a');
  blast(e, x, e.y, 110, { dmg: skillDmg(4.2, 0.42, lv), launch: 440, knock: 160, hs: 0.1, big: 1.6, col: '#ff5a5a', radial: true }, { zMax: 160, ...bzBleedArea(e) });
}

/* ---- 崩山裂地斩（仅狂暴中）：召唤血剑时无敌 → 起跳霸体（←→ 调整距离）→ 砸地大范围冲击波把敌人竖直震上天 → 碎块 / 岩浆 6 段喷发。砸地后短暂无敌 ---- */
defSkill('quake', { name: '崩山裂地斩', cls: 'sword', job: 'berserker', lvReq: 20, mp: 70, cd: 40, type: 'indep', col: '#e0702a', req: bzReq,
  desc: '【狂暴之力中】召唤血剑（此时无敌）高高跃起（←→ 调整距离），把剑砸进大地：大范围冲击波把敌人竖直震上天，随后碎石和岩浆接连喷发 6 次追打浮空的敌人。起跳后霸体，砸地后短暂无敌。', pow: lv => skillDmg(9.0, 0.9, lv), ai: { kind: 'aoe', r: [0, 170], dy: 50 },
  act: (lv) => ({ name: 'quake', clip: 'quake', dur: 1.8, superArmor: true, noCounter: true, invul: [0, 0.22],
    onStart: e => { const d = e.pad.dx() * e.face; e.vz = 560; e.z = Math.max(e.z, 1); e.vx = e.face * (d > 0 ? 200 : d < 0 ? 40 : 120); sfx.jump(); fxSpr('bloodpillar', e.x, e.y, 0, { h: 150, dur: 0.3, ay: 1, alpha: 0.7 }); },
    update: e => { if (e.actT > 0.3 && !e.act.dive) { e.act.dive = true; e.vz = -1300; } },
    onLand: e => { if (e.actT < 0.1) return; const a = e.act; a.onLand = null; a.dur = e.actT + 1.0; e.vx = 0; e.play('quakeLand', true); e.invul = Math.max(e.invul, 0.3);
      cam.shake = 12; sfx.boom(1.3); fxDust(e.x, e.y, 16, 50, '#7a5a3a'); fxShock(e.x + e.face * 40, e.y, 300, '#ff9a4a'); fxSpr('lava', e.x + e.face * 50, e.y, 0, { w: 220, dur: 0.6, ay: 0.8, grow: [0.5, 1.1] });
      blast(e, e.x + e.face * 40, e.y, 170, { dmg: skillDmg(4.0, 0.4, lv), launch: 560, knock: 20, hs: 0.12, big: 1.8, col: '#ffb060', downHit: true }, { zMax: 120, ...bzBleedArea(e) });
      for (let i = 0; i < 6; i++) game.after(0.14 + i * 0.12, () => { if (e.dead) return; const x = e.x + e.face * (70 + (i % 3) * 70) , y = e.y + (i < 3 ? -18 : 18); sfx.boom(0.4); fxSpr('lava', x, y, 0, { w: 130, dur: 0.5, ay: 0.85, grow: [0.3, 1.1] });
        blast(e, x, y, 70, { dmg: skillDmg(0.85, 0.085, lv), airLift: 380, launch: 260, knock: 20, hs: 0.04, col: '#ffb060' }, { zMax: 300 }); }); } }) });

/* ---- 一觉：魔狱血刹（现版的“背后召唤血剑 → 再按一次劈下”改动放在 P1；这里仍是一次性演出）---- */
defSkill('bz_awaken', { name: '魔狱血刹', cls: 'sword', job: 'berserker', lvReq: 21, maxLv: 3, mp: 150, cd: 135, pvp: 0.45, type: 'indep', awaken: true, col: '#8a0010',
  desc: '【觉醒】召唤吸满血气的魔剑，劈向大地引发血气爆炸，血气柱贯穿整个画面。施放中无敌。', pow: lv => skillDmg(24, 6, lv), ai: { kind: 'awaken', r: [0, 300], dy: 90 },
  act: (lv) => ({ name: 'bz_awaken', clip: 'bzAwk', dur: 2.6, superArmor: true, noCounter: true, invul: [0, 2.0],
    onStart: e => { game.cutin = { t: 0, dur: 1.0, name: '魔狱血刹', who: cutinWho(e) }; game.timeStop = 0.9; sfx.awaken(); },
    update: e => { if (e.actT > 0.95 && e.actT < 1.7) { e.drawOpts = { glow: (e.actT - 0.95) * 1.3 }; if (Math.random() < 0.7) fxCharge(e, '#ff3040', 2); } },
    onEnd: e => { e.drawOpts = {}; },
    events: [evAt(0.95, e => { sfx.charge(); fxAura(e, '#ff2030', 1.2); for (const t of ents) if (hittable(e, t) && Math.abs(t.x - e.x) < WW) applyHit(e, t, { dmg: skillDmg(1.5, 0.5, lv), stun: 0.8, hs: 0.05, sure: true, col: '#ff4a5a' }, { proj: true }); }),
      evAt(1.75, e => { cam.flash = 0.35; cam.flashCol = '#ff4a4a'; cam.shake = 14; sfx.boom(1.4); sfx.iai();
        fxShock(e.x + e.face * 60, e.y, 360, '#ff3040'); fxBurst(e.x + e.face * 60, e.y, 40, 300, '#ff2030');
        for (let i = 0; i < 9; i++) game.after(i * 0.05, () => fxSpr('bloodpillar', e.x + e.face * (60 + i * 95), e.y + rnd(-20, 20), 0, { h: 260, dur: 0.6, ay: 1, grow: [0.3, 1.05] }));
        for (const t of ents) if (hittable(e, t) && (t.x - e.x) * e.face > -80 && Math.abs(t.x - e.x) < 900) applyHit(e, t, { dmg: skillDmg(18, 5, lv), launch: 560, knock: 160, hs: 0.2, big: 2.2, critBonus: 0.3, downHit: true, sure: true, col: '#ff4a5a' }, { proj: true }); })] }) });

CLASSES.sword.jobs.berserker = { art: 'job/berserker', name: '狂战士', role: '近战 · 爆发', armor: 'heavy', awaken: 'bz_awaken', awakenName: '暗狱魔神',
  desc: '以自身鲜血换取力量的鬼剑士。狂暴之力下双刀乱舞，出血链越滚越强，HP 越低越凶猛。',
  skills: ['bz_vigor', 'bz_madness', 'bloodwake', 'frenzy', 'bz_defy', 'bz_scratch', 'rampage', 'outrage', 'bz_whirl', 'bz_thirst', 'bz_enrage', 'bz_twister', 'bloodblade', 'quake', 'bz_awaken'] };
CLASSES.sword.cmds.push(['du', 'frenzy', 'buff'], ['uu', 'bz_defy', 'buff'], ['uu', 'bz_scratch'], ['ff', 'rampage', 'buff'], ['du', 'outrage'], ['ud', 'bz_whirl'], ['ud', 'bz_thirst', 'buff'],
  ['buf', 'bz_enrage'], ['bff', 'bz_twister'], ['bbf', 'bloodblade'], ['uff', 'quake'], ['uudd', 'bz_awaken']);

// 被动：狂暴之力每 10 秒扣 HP、刀光变红；力量唤醒按 HP 分档
CLASSES.sword.passives.push(p => {
  const F = p.buffs.frenzy;
  if (F && jobOf(p) === 'berserker') { F.tick = (F.tick ?? 10) - 0.25; if (F.tick <= 0) { F.tick = 10; const c = frenzyCost(F.lv || 1)[1]; p.hp = Math.max(1, p.hp - c); } p.slashCol = '#ff5a5a'; }
  else p.slashCol = CLASSES.sword.slashCol || '#8fd8ff';
  const lv = jobOf(p) === 'berserker' ? skLv(p, 'bloodwake') : 0, f = p.hp / p.hpMax, st = !lv ? 0 : f <= 0.5 ? 3 : f <= 0.6 ? 2 : f <= 0.7 ? 1 : 0;
  setPassive(p, 'bloodwake', lv > 0, { dmg: 0.03 + 0.006 * lv, aspd: 0.03 + 0.04 * st, mspd: 0.03 + 0.04 * st });
});
// 命中：狂暴普攻 / 转职技能 / 崩山击 / 十字刃附带出血（血气旺盛）；狂暴中击杀出血的敌人回 HP；钝器普攻几率眩晕（原作钝器特性）
SWORD_HOOKS.onHit.push((p, t, h, dmg, act) => {
  const A = act || p.act;
  if (jobOf(p) === 'berserker' && bzVig(p) && A && !t.dead) {
    const S = A.skill && SKILLS[A.skill];
    if ((A.basic && bzFrenzy(p)) || (S && (S.job === 'berserker' || A.skill === 'slam' || A.skill === 'cross'))) addStatus(t, 'bleed', 7, { dps: p.atk * 0.05, src: p });
  }
  if (jobOf(p) === 'berserker' && bzFrenzy(p) && t.hp <= 0 && t.status && t.status.bleed) { const hl = Math.round(p.hpMax * 0.01); p.hp = Math.min(p.hpMax, p.hp + hl); addNumber(hl, p.x, p.y, p.z, { heal: true }); }
  if (A && A.basic && !A.rk && wtypeOf(p) === 'club' && Math.random() < 0.08 && !t.dead) addStatus(t, 'stun', 0.8, { src: p });
});

/* ---- 冷却修正（castSkill 先写冷却再调用 act，这里包一层 act 在施放时改 p.cool）：
   剑魂光剑掌握（光剑，非觉醒 −1%/级，最多 −10%）；狂战士狂暴之力（转职技能 −10%）、暴走（爆发之刃 / 嗜魂封魔斩 / 崩山裂地斩 −20%）---- */
function swordCdMul(p, S) {
  let m = 1; if (!p || S.awaken) return m;
  const job = jobOf(p);
  if (job === 'blade' && wtypeOf(p) === 'lightsaber') m *= 1 - Math.min(0.1, 0.01 * skLv(p, 'wm_saber'));
  if (job === 'berserker' && S.job === 'berserker') { if (bzFrenzy(p)) m *= 0.9; if (p.buffs.rampage && ['bloodblade', 'bz_twister', 'quake'].includes(S.id)) m *= 0.8; }
  return m;
}
function swordFinalize() {
  for (const id in SKILLS) { const S = SKILLS[id]; if (S.cls !== 'sword' || !S.act || S._cdw) continue;
    const act0 = S.act; S._cdw = true;
    S.act = (lv, p) => {   // 只在 castSkill 刚写入冷却时修正（冷却值正好等于基础值）
      if (p && p.cool) { const base = S.cd * (p.cdMul || 1) * (game.pvp && S.pvpCd ? S.pvpCd : 1), c = p.cool[S.id]; if (c > 0 && Math.abs(c - base) < 1e-6) p.cool[S.id] = c * swordCdMul(p, S); }
      return act0(lv, p); };
  }
}
swordFinalize();
