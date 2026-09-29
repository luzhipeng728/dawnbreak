/* =====================================================================
   转职：狂战士（鬼剑士，jobId berserker）—— 国服现版对齐（docs/SKILLS_OFFICIAL_sword.md 第 4 节）
   狂暴之力（开关：二刀流普攻、以血换力，5 个技能必须在狂暴中施放）、血气旺盛（出血链）、力量唤醒、暴走（无限持续）、
   狂气斩、怒气爆发、狂热回旋、饥渴（蓄力耗血）、暴怒狂斩、嗜魂封魔斩、爆发之刃（命中即爆、可取消）、崩山裂地斩，觉醒 魔狱血刹
   伤害类型：转职技能为独立攻击（狂战士按力量）；嗜魂之手已移到基础技能（sword.js）
   ===================================================================== */
const bzFrenzy = p => !!(p && p.buffs && p.buffs.frenzy);
const bzReq = p => bzFrenzy(p) ? true : swordNeed(p, 'frenzy', '狂暴之力');
const bzVig = p => !!(p && hasSkill(p, 'bz_vigor'));
const bzBleed = (e, t) => { if (bzVig(e) && t && !t.dead) addStatus(t, 'bleed', 7, { dps: e.atk * 0.05, src: e }); };
const bzBleedArea = e => bzVig(e) ? { status: 'bleed', sdur: 7, dps: 0.05 } : {};

/* ---- 狂暴之力下的二刀流普攻：一轮 4 刀、每刀 2 段；范围大（含纵深、身后也有判定）；狂暴血气：只在第 1、2 刀之间循环 ---- */
const bzHit = (t0, t1, box, dmg, o) => HB(t0, t1, box, dmg, { rep: 0.06, max: 2, hs: 0.04, type: 'indep', ...o });
const SWORD_ACTS_BZ = { ...SWORD_ACTS,
  atk1: { name: 'atk1', clip: 'bzA1', dur: 0.3, basic: true, speed: 'aspd', chain: [0.12, 0.3], next: 'atk2', move: [[0.02, 0.08, 110]],
    hits: [bzHit(0.05, 0.16, [-30, 102, 40, 10, 110], 0.6, { stun: 0.32, knock: 40 })],
    events: [slashAt(0.04, { a0: -2.4, a1: 0.8, r: 76, w: 14, off: [12, 60], col: '#ff7a7a' }), slashAt(0.1, { a0: 2.2, a1: -0.6, r: 70, w: 12, off: [12, 52], col: '#ff7a7a', silent: true })] },
  atk2: { name: 'atk2', clip: 'bzA2', dur: 0.3, basic: true, speed: 'aspd', chain: [0.12, 0.3], next: p => skLv(p, 'bz_madness') ? 'atk1' : 'atk3', move: [[0.02, 0.08, 100]],
    hits: [bzHit(0.05, 0.16, [-30, 102, 40, 10, 110], 0.62, { stun: 0.32, knock: 50 })],
    events: [slashAt(0.04, { a0: 1.0, a1: -2.2, r: 76, w: 14, off: [12, 56], col: '#ff7a7a' }), slashAt(0.1, { a0: -1.0, a1: 2.0, r: 68, w: 12, off: [12, 50], col: '#ff7a7a', silent: true })] },
  atk3: { name: 'atk3', clip: 'bzA3', dur: 0.32, basic: true, speed: 'aspd', chain: [0.14, 0.32], next: 'atk4', move: [[0.02, 0.1, 140]],
    hits: [bzHit(0.05, 0.18, [-30, 106, 40, 0, 120], 0.7, { stun: 0.36, knock: 60 })],
    events: [slashAt(0.04, { a0: -2.8, a1: 1.0, r: 80, w: 16, off: [12, 60], col: '#ff7a7a' }), slashAt(0.1, { a0: 0.6, a1: -2.0, r: 72, w: 14, off: [10, 44], col: '#ff7a7a', silent: true })] },
  atk4: { name: 'atk4', clip: 'bzA4', dur: 0.42, basic: true, speed: 'aspd', move: [[0.04, 0.14, 200]],
    hits: [bzHit(0.06, 0.2, [-40, 114, 42, 0, 120], 0.9, { knock: 220, stun: 0.5, heavy: true, shake: 3, big: 1.3 })],
    events: [slashAt(0.05, { a0: -3.0, a1: 0.3, r: 92, w: 18, off: [0, 55], squash: 0.45, col: '#ff6a6a', heavy: true }), slashAt(0.12, { a0: 0.3, a1: 3.2, r: 92, w: 18, off: [0, 55], squash: 0.45, col: '#ff6a6a', silent: true })] },
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

// 狂暴之力 / 暴走的全身血焰、血色双刀、红眼、鬼手滴血：转职外观（content/avatar/job_looks.js 的 berserker，渲染 models/job_fx.js）
/* ---- 狂暴之力：开关 BUFF（再按一次解除）。施放时和之后每 10 秒扣固定 HP（扣到 1 也不会自动关）；
   普攻变二刀流；普攻与转职技能攻击力、命中、僵直提高；转职技能冷却 −10%；击杀出血的敌人回少量 HP ---- */
const frenzyCost = lv => [40 + 12 * lv, 20 + 5 * lv];   // [施放, 每 10 秒]
defSkill('frenzy', { name: '狂暴之力', cls: 'sword', job: 'berserker', lvReq: 15, mp: 30, cd: 10, type: 'indep', buff: true, col: '#c0102a',
  desc: '【开关 BUFF · 再按一次解除】以血换力：施放时和之后每 10 秒消耗一定 HP（HP 扣到 1 也不会自动解除）。普攻变为二刀流（一轮 4 刀、每刀 2 段，范围更大），普攻和转职技能攻击力、僵直提高，转职技能冷却减少 10%，击杀出血的敌人时恢复少量 HP。狂气斩、暴怒狂斩、嗜魂封魔斩、爆发之刃、崩山裂地斩只能在狂暴之力中施放。',
  ai: { kind: 'buff', core: true }, infoExtra: lv => [['攻击力', '+' + pct(0.1 + 0.01 * lv)], ['施放 / 每 10 秒消耗 HP', frenzyCost(lv).join(' / ')]],
  act: (lv) => ({ name: 'frenzy', clip: 'roar', dur: 0.5, noCounter: true, superArmor: true,
    onStart: e => {
      if (toggleBuff(e, 'frenzy', 9999, { atk: 0.1 + 0.01 * lv, stagger: 100, lv, hl: '#ff3040' })) { const [c0] = frenzyCost(lv); e.hp = Math.max(1, e.hp - c0); e.buffs.frenzy.tick = 10;
        sfx.buff(); sfx.boom(0.5); fxAura(e, '#ff2a3a', 1.2); fxBurst(e.x, e.y, e.z + 60, 160, '#ff3040'); fxText('狂暴之力 开启', e.x, e.y, e.z + 20, { col: '#ff6a6a', size: 13 });
        const F = isHuman(e) && save.data && (save.data.flags ??= {}); if (F && !F.tip_frenzy) { F.tip_frenzy = true; toastMsg(`狂暴之力开启：普攻变二刀流，狂气斩 / 暴怒狂斩 / 嗜魂封魔斩 / 爆发之刃 / 崩山裂地斩可以用了；开启期间每 10 秒消耗 HP。再按一次（${swordHowTo(e, 'frenzy')}）关闭。`, '#ff8a8a', 'log'); } }
      else fxText('狂暴之力 关闭', e.x, e.y, e.z + 20, { col: '#cccccc', size: 12 });
      if (!(e.st === 'act' && e.act && e.act.basic)) e.acts = swordActs(e);
    } }) });
defSkill('bz_defy', { name: '死亡抗拒', cls: 'sword', job: 'berserker', lvReq: 16, maxLv: 1, mp: 20, cd: 10, type: 'indep', buff: true, col: '#e04a4a',
  desc: '【HP 低于 35% 时可用】2.5 秒内恢复一定比例的 HP，并在 10 秒内减少受到的伤害、提高僵直。', ai: { kind: 'buff' }, infoExtra: () => [['恢复 HP', '15%'], ['受到伤害', '-15%（10 秒）']],
  req: p => p.hp <= p.hpMax * 0.35 ? true : 'HP 需低于 35%',
  act: () => ({ name: 'bz_defy', clip: 'roar', dur: 0.5, noCounter: true, superArmor: true,
    onStart: e => { e.buffs.bz_defy = { t: 10, taken: -0.15, stagger: 60 }; sfx.buff(); fxAura(e, '#ff8a8a', 1);
      for (let i = 1; i <= 5; i++) game.after(i * 0.5, () => { if (e.dead) return; const h = Math.round(e.hpMax * 0.03); e.hp = Math.min(e.hpMax, e.hp + h); addNumber(h, e.x, e.y, e.z, { heal: true }); }); } }) });

/* ---- 狂气斩（仅狂暴中）：双剑向前斩，再按技能键追加 1 击；按 → 滑行、按 ← 反向 ---- */
defSkill('bz_scratch', { name: '狂气斩', cls: 'sword', job: 'berserker', lvReq: 16, mp: 20, cd: 6, type: 'indep', col: '#e04040', req: bzReq,
  desc: '【狂暴之力中】双剑向前交叉斩击，再按技能键追加一斩。按 → 向前滑行，按 ← 转身反向斩。', pow: lv => skillDmg(3.2, 0.32, lv), ai: { kind: 'poke', r: [0, 120], dy: 24 },
  act: (lv, p) => bzScratch(lv, p, 1) });
function bzScratch(lv, p, n) {
  return { name: 'bz_scratch' + n, clip: n === 1 ? 'dual1' : 'dual2', dur: 0.42, noCounter: true, follow: n === 1 ? () => bzScratch(lv, p, 2) : null, followWin: [0.16, 0.42],
    onStart: e => { const d = e.pad.dx() * e.face; if (d < 0) e.face = -e.face; e.act.move = [[0.02, 0.14, d > 0 ? 420 : 140]]; },
    hits: [HB(0.06, 0.16, [-10, 120, 40, 10, 115], skillDmg(1.6, 0.16, lv), { rep: 0.05, max: 2, stun: 0.45, knock: n === 2 ? 180 : 70, hs: 0.06, heavy: n === 2, col: '#ff6a6a', onHit: (a, t) => bzBleed(a, t) })],
    events: [slashAt(0.05, { a0: -2.4, a1: 1.0, r: 94, w: 18, off: [10, 56], col: '#ff6a6a', heavy: true }), slashAt(0.09, { a0: 1.0, a1: -2.4, r: 88, w: 16, off: [10, 52], col: '#ff6a6a', silent: true })] };
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
  desc: '脚下出现血色圆阵，怒气爆发：冲击波和血柱共 10 段，把周围所有敌人高高震上天。霸体。', pow: lv => skillDmg(4.5, 0.45, lv), ai: { kind: 'aoe', r: [0, 210], dy: 70 },
  act: (lv) => ({ name: 'outrage', clip: 'outrage', dur: 0.8, superArmor: true, noCounter: true,
    events: [evAt(0.02, e => { sfx.charge(); fxShock(e.x, e.y, 170, '#ff3a3a'); }),
      evAt(0.2, e => { cam.shake = Math.max(cam.shake, 7); sfx.boom(1); fxShock(e.x, e.y, 270, '#ff3a3a'); fxBurst(e.x, e.y, e.z + 50, 330, '#ff2a3a');
        blast(e, e.x, e.y, 230, { dmg: skillDmg(1.8, 0.18, lv), launch: 520, knock: 60, hs: 0.1, big: 1.6, col: '#ff5a5a' }, { zMax: 150, ...bzBleedArea(e) }); }),
      ...[0, 1, 2, 3, 4, 5, 6, 7, 8].map(i => evAt(0.26 + i * 0.045, e => { const a = i * 0.7;
        fxSpr('bloodpillar', e.x + Math.cos(a) * 160, e.y + Math.sin(a) * 60, 0, { h: 150, dur: 0.4, ay: 1, grow: [0.5, 1], alpha: 0.8 });
        blast(e, e.x, e.y, 230, { dmg: skillDmg(0.3, 0.03, lv), launch: 420, airLift: 240, knock: 10, hs: 0.02, col: '#ff5a5a' }, { zMax: 260 }); }))] }) });   // 血柱继续把敌人往上顶（官方“高高浮空”）

/* ---- 狂热回旋：挥剑把左右两侧的敌人扫到身前，原地回旋上斩击飞 ---- */
defSkill('bz_whirl', { name: '狂热回旋', cls: 'sword', job: 'berserker', lvReq: 18, mp: 35, cd: 10, type: 'indep', col: '#d04a3a',
  desc: '挥剑把左右两侧的敌人扫到身前，随即原地回旋上斩把它们击飞。', pow: lv => skillDmg(4.0, 0.4, lv), ai: { kind: 'aoe', r: [0, 180], dy: 50 },
  act: (lv) => ({ name: 'bz_whirl', clip: 'whirl', dur: 0.8, superArmor: [0, 0.6], noCounter: true,
    events: [evAt(0.08, e => { sfx.swing(true); fxSlashOn(e, { col: '#ff6a6a', a0: -3.1, a1: 3.1, r: 150, w: 20, off: [0, 40], squash: 0.4, dur: 0.25 });
        for (const t of ents) if (hittable(e, t) && !t.boss && Math.abs(t.y - e.y) < 70 && Math.abs(t.x - e.x) < 290) { t.x = lerp(t.x, e.x + e.face * 45, 0.85); t.y = lerp(t.y, e.y, 0.5); }
        blast(e, e.x, e.y, 200, { dmg: skillDmg(1.6, 0.16, lv), stun: 0.6, knock: 0, hs: 0.05, col: '#ff6a6a' }, { zMax: 120, ...bzBleedArea(e) }); }),
      evAt(0.36, e => { e.play('rise', true); sfx.swing(true); fxSlashOn(e, { col: '#ff6a6a', a0: 1.4, a1: -1.9, r: 96, w: 22, off: [6, 50], heavy: true }); cam.shake = Math.max(cam.shake, 4);
        instantHit(e, { box: [-50, 120, 44, 0, 140], dmg: skillDmg(2.4, 0.24, lv), launch: 520, knock: 60, hs: 0.1, big: 1.5, col: '#ff6a6a' }); })] }) });

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
        fxShock(e.x, e.y, 520, '#ff3040'); cam.shake = Math.max(cam.shake, 5);
        blast(e, e.x, e.y, 525, { dmg: skillDmg(2.0, 0.2, lv) * (1 + n * 0.15), knock: 160, stun: 0.5, hs: 0.06, col: '#ff4a5a' }, { zMax: 120, status: 'bleed', sdur: 7, dps: 0.05 }); } } }) });

/* ---- 暴怒狂斩（仅狂暴中）：下劈浮空 → 双刀空中乱砍 4 次、每刀留下剑痕 → 剑痕一起撕裂敌人。霸体 ---- */
defSkill('bz_enrage', { name: '暴怒狂斩', cls: 'sword', job: 'berserker', lvReq: 19, mp: 50, cd: 20, type: 'indep', col: '#ff3a3a', req: bzReq,
  desc: '【狂暴之力中】武器下劈把敌人挑上半空，跃起双刀乱砍 4 次，每一刀都在空中留下血色剑痕，最后所有剑痕一起撕裂敌人。霸体。', pow: lv => skillDmg(8.0, 0.8, lv), ai: { kind: 'launch', r: [0, 115], dy: 26 },
  act: (lv) => ({ name: 'bz_enrage', clip: 'rise', dur: 1.5, superArmor: true, noCounter: true, lowGrav: 0.35,
    hits: [HB(0.06, 0.16, [-10, 110, 38, 0, 140], skillDmg(1.4, 0.14, lv), { launch: 480, knock: 40, hs: 0.08, col: '#ff6a6a', onHit: (a, t) => bzBleed(a, t) })],
    events: [evAt(0.24, e => { e.vz = 420; e.z = Math.max(e.z, 1); e.vx = e.face * 60; e.play('enrage', true); e.act.marks = []; }),
      ...[0.34, 0.46, 0.58, 0.7].map((t, i) => evAt(t, e => { sfx.swing(true); const m = { x: e.x + e.face * 75, y: e.y, z: e.z + 40, a: i % 2 ? 0.8 : -0.8 }; e.act.marks.push(m);
        fxSlashOn(e, { col: '#ff4a4a', a0: i % 2 ? 1.2 : -2.4, a1: i % 2 ? -2.2 : 1.0, r: 86, w: 18, off: [10, 40] });
        addFx({ x: m.x, y: m.y + 0.5, z: m.z, dur: 0.9 - i * 0.12, add: true, draw(c) { const k = this.t / this.dur; drawSpr(c, fxTint('slash', '#ff4a4a'), sx(this.x), sy(this.y, this.z), 150, 0, { rot: m.a, alpha: 0.85 * (1 - k * 0.5) }); } });
        blast(e, m.x, m.y, 95, { dmg: skillDmg(0.8, 0.08, lv), airLift: 200, stun: 0.3, knock: 10, hs: 0.03, col: '#ff6a6a' }, { z: Math.max(0, m.z - 80), zMax: 260 }); })),
      evAt(1.0, e => { cam.shake = Math.max(cam.shake, 7); sfx.boom(1); sfx.iai();
        for (const m of e.act.marks || []) { fxSlashX(m.x, m.y, m.z, 190, '#ff3040'); blast(e, m.x, m.y, 110, { dmg: skillDmg(0.9, 0.09, lv), launch: 300, knock: 120, hs: 0.06, big: 1.4, col: '#ff5a5a' }, { zMax: 300, ...bzBleedArea(e) }); } })],
    onLand: e => { if (e.actT > 1.05) e.endAct(); } }) });

/* ---- 嗜魂封魔斩（仅狂暴中）：旋风把前方敌人快速吸到身前 → 血剑强力上斩击飞 ---- */
defSkill('bz_twister', { name: '嗜魂封魔斩', cls: 'sword', job: 'berserker', lvReq: 19, mp: 55, cd: 25, type: 'indep', col: '#c01030', req: bzReq,
  desc: '【狂暴之力中】举剑卷起血色旋风，把前方的敌人快速吸到身前，再用血剑强力上斩把它们击飞。抓不动的敌人不受吸引。', pow: lv => skillDmg(7.5, 0.75, lv), ai: { kind: 'aoe', r: [0, 330], dy: 50 },
  act: (lv) => ({ name: 'bz_twister', clip: 'twister', dur: 1.2, superArmor: true, noCounter: true,
    update: (e, dt) => { if (e.actT < 0.7) { const cx = e.x + e.face * 70; for (const t of ents) if (hittable(e, t) && !t.boss && (t.x - e.x) * e.face > -40 && Math.abs(t.x - e.x) < 380 && Math.abs(t.y - e.y) < 90) { t.x = damp(t.x, cx, 6, dt); t.y = damp(t.y, e.y, 6, dt); }
      if (Math.random() < 0.5) fxSpr('vortex', e.x + e.face * 90, e.y, e.z + 60, { w: 210, dur: 0.25, alpha: 0.5, col: '#ff3a4a' }); } },
    hits: [HB(0.1, 0.7, [-10, 150, 44, 0, 130], skillDmg(0.4, 0.04, lv), { rep: 0.1, stun: 0.3, knock: 0, hs: 0.02, col: '#ff5a5a' })],
    events: [evAt(0.05, e => sfx.charge()), evAt(0.75, e => { e.play('bladeW', true); sfx.swing(true); sfx.iai(); cam.shake = Math.max(cam.shake, 6);
      fxSlashOn(e, { col: '#ff3040', a0: 1.4, a1: -1.9, r: 120, w: 26, off: [10, 50], heavy: true }); fxSpr('bloodwave', e.x + e.face * 80, e.y, 0, { h: 200, dur: 0.4, ay: 1, flip: e.face < 0 });
      instantHit(e, { box: [-10, 160, 46, 0, 160], dmg: skillDmg(4.8, 0.48, lv), launch: 560, knock: 80, hs: 0.12, big: 1.7, col: '#ff5a5a' }); bzBleedAreaAt(e, e.x + e.face * 80); })] }) });
const bzBleedAreaAt = (e, x) => { if (bzVig(e)) for (const t of ents) if (foe(e, t) && Math.abs(t.x - x) < 130 && Math.abs(t.y - e.y) < 60) bzBleed(e, t); };

/* ---- 爆发之刃（仅狂暴中）：喷血凝成剑，握剑突刺，命中立即爆炸（把敌人推开）；命中后可以取消接其他技能；按 ← 原地刺 ---- */
defSkill('bloodblade', { name: '爆发之刃', cls: 'sword', job: 'berserker', lvReq: 19, mp: 50, cd: 20, type: 'indep', col: '#a0101a', req: bzReq,
  desc: '【狂暴之力中】喷出鲜血在前方凝成剑，握剑向前突刺，刺中敌人时立即爆炸，把敌人从爆心推开。命中后可以马上用其他技能取消。按 ← 原地突刺。霸体。', pow: lv => skillDmg(6.0, 0.6, lv), ai: { kind: 'gap', r: [0, 280], dy: 30 },
  act: (lv) => ({ name: 'bloodblade', clip: 'bloodblade', dur: 0.8, superArmor: true, noCounter: true, hitCancel: true, links: swordAttackIds(),
    onStart: e => { const back = e.pad.dx() * e.face < 0; e.act.move = back ? [] : [[0.08, 0.3, 880]]; },
    hits: [HB(0.08, 0.32, [-20, 104, 36, 10, 110], skillDmg(1.8, 0.18, lv), { stun: 0.5, knock: 30, hs: 0.05, col: '#ff4a5a', onHit: (a, t) => { bzBleed(a, t); if (!a.act || a.act.boom) return; a.act.boom = true; a.act.move = []; a.vx = 0; bloodBoom(a, lv, t.x); a.act.dur = Math.min(a.act.dur, a.actT + 0.3); } })],
    events: [evAt(0.08, e => { fxAfterimage(e, '#ff4a5a'); fxStreak({ x: e.x, y: e.y, z: e.z + 60, face: e.face, len: 280, w: 24, col: '#ff3040', dur: 0.3 }); sfx.iai(); }),
      evAt(0.45, e => { if (!e.act.boom) { e.act.boom = true; bloodBoom(e, lv, e.x + e.face * 30); } })] }) });
function bloodBoom(e, lv, x) {
  cam.shake = Math.max(cam.shake, 6); sfx.boom(0.9); fxSpr('bloodwave', x, e.y, 0, { h: 210, dur: 0.4, ay: 1, flip: e.face < 0, grow: [0.5, 1.1] }); fxBurst(x, e.y, 60, 300, '#ff2a3a'); fxShock(x, e.y, 200, '#ff3040');
  blast(e, x, e.y, 180, { dmg: skillDmg(4.2, 0.42, lv), down: true, downLift: 240, knock: 240, hs: 0.1, big: 1.6, col: '#ff5a5a', radial: true }, { zMax: 160, ...bzBleedArea(e) });
}

/* ---- 崩山裂地斩（仅狂暴中）：召唤血剑时无敌 → 起跳霸体（←→ 调整距离）→ 砸地大范围冲击波把敌人竖直震上天 → 碎块 / 岩浆 6 段喷发。砸地后短暂无敌 ---- */
defSkill('quake', { name: '崩山裂地斩', cls: 'sword', job: 'berserker', lvReq: 20, mp: 70, cd: 40, type: 'indep', col: '#e0702a', req: bzReq,
  desc: '【狂暴之力中】召唤血剑（此时无敌）高高跃起（←→ 调整距离），把剑砸进大地：大范围冲击波把敌人竖直震上天，随后碎石和岩浆接连喷发 6 次追打浮空的敌人。起跳后霸体，砸地后短暂无敌。', pow: lv => skillDmg(9.0, 0.9, lv), ai: { kind: 'aoe', r: [0, 360], dy: 80 },
  act: (lv) => ({ name: 'quake', clip: 'quake', dur: 1.8, superArmor: true, noCounter: true, invul: [0, 0.22],
    onStart: e => { const d = e.pad.dx() * e.face; e.vz = 560; e.z = Math.max(e.z, 1); e.vx = e.face * (d > 0 ? 560 : d < 0 ? 40 : 300); sfx.jump(); fxSpr('bloodpillar', e.x, e.y, 0, { h: 150, dur: 0.3, ay: 1, alpha: 0.7 }); },
    update: e => { if (e.actT > 0.3 && !e.act.dive) { e.act.dive = true; e.vz = -1300; } },
    onLand: e => { if (e.actT < 0.1) return; const a = e.act; a.onLand = null; a.dur = e.actT + 1.0; e.vx = 0; e.play('quakeLand', true); e.invul = Math.max(e.invul, 0.3);
      cam.shake = 12; sfx.boom(1.3); fxDust(e.x, e.y, 16, 50, '#7a5a3a'); fxShock(e.x + e.face * 40, e.y, 420, '#ff9a4a'); fxShock(e.x + e.face * 40, e.y, 250, '#ffcf8a'); fxSpr('lava', e.x + e.face * 50, e.y, 0, { w: 380, dur: 0.6, ay: 0.8, grow: [0.5, 1.1] });
      blast(e, e.x + e.face * 40, e.y, 360, { dmg: skillDmg(4.0, 0.4, lv), launch: 560, knock: 20, hs: 0.12, big: 1.8, col: '#ffb060', downHit: true }, { zMax: 120, ...bzBleedArea(e) });
      for (let i = 0; i < 6; i++) game.after(0.14 + i * 0.12, () => { if (e.dead) return; const x = e.x + e.face * (40 + [-90, 90, 0, -45, 45, 0][i]), y = e.y + [-30, 30, 0, 18, -18, 0][i]; sfx.boom(0.4); fxSpr('lava', x, y, 0, { w: 300, dur: 0.5, ay: 0.85, grow: [0.3, 1.1] });
        blast(e, x, y, 170, { dmg: skillDmg(0.85, 0.085, lv), airLift: 380, knock: 10, hs: 0.04, col: '#ffb060' }, { zMax: 320 }); }); } }) });

/* ---- 狂气涌动：除受击硬直、浮空外任何时候都能瞬发（不打断当前动作）。10 秒内 HP 不会被打到 50% 以下；
   触发时生成 3 秒血盾吸收全部伤害，血盾结束时 BUFF 也结束。冷却固定 45 秒（不受冷却减少影响）---- */
defSkill('bz_surge', { name: '狂气涌动', cls: 'sword', job: 'berserker', lvReq: 24, maxLv: 1, mp: 30, cd: 45, fixedCd: true, type: 'indep', buff: true, noForce: false, col: '#ff4a5a',
  desc: '【BUFF · 瞬发】除受击硬直、浮空以外任何时候都能施放（不打断当前动作）。10 秒内 HP 不会被打到 50% 以下；第一次被打到 50% 时生成 3 秒的血盾，吸收所有伤害，血盾结束时效果也结束。冷却时间固定 45 秒。',
  ai: { kind: 'buff' }, cmdNote: '单按 Space',
  req: p => p.st === 'hit' || p.st === 'air' ? '受击中不能用' : true,
  act: () => ({ name: 'bz_surge', clip: 'roar', dur: 0.3, noCounter: true }),   // 只给 AI 选技能用；实际施放走 instant
  instant: (lv, p) => { p.buffs.bz_surge = { t: 10 }; sfx.buff(); fxAura(p, '#ff2a3a', 0.8); fxText('狂气涌动', p.x, p.y, p.z + 20, { col: '#ff6a6a', size: 12 }); } });
SWORD_HOOKS.beforeHurt.push((p, a, h) => {
  const B = p.buffs.bz_surge; if (!B || jobOf(p) !== 'berserker') return null;
  if (B.shield) { fxSpr('bloodpillar', p.x, p.y, 0, { h: 90, dur: 0.2, ay: 1, alpha: 0.5 }); return { block: true }; }   // 血盾：吸收全部伤害
  return { minHp: Math.ceil(p.hpMax * 0.5) };
});
SWORD_HOOKS.onHurt.push(p => {
  const B = p.buffs.bz_surge; if (!B || B.shield || jobOf(p) !== 'berserker' || p.hp > Math.ceil(p.hpMax * 0.5)) return;
  B.shield = true; B.t = 3; p.superArmor = Math.max(p.superArmor, 0.3); sfx.boom(0.6); fxAura(p, '#ff2a3a', 1.2); fxText('血盾', p.x, p.y, p.z + 24, { col: '#ff4a5a', size: 13 });
});

CLASSES.sword.jobs.berserker = { art: 'job/berserker', name: '狂战士', role: '近战 · 爆发', armor: 'heavy', awaken: 'bz_awaken', awakenName: '暗狱魔神',
  desc: '以自身鲜血换取力量的鬼剑士。狂暴之力下双刀乱舞，出血链越滚越强，HP 越低越凶猛。',
  skills: ['bz_vigor', 'bz_madness', 'bloodwake', 'frenzy', 'bz_defy', 'bz_scratch', 'rampage', 'outrage', 'bz_whirl', 'bz_thirst', 'bz_enrage', 'bz_twister', 'bloodblade', 'quake', 'bz_awaken', 'bz_surge', 'bz_memory', 'bz_snatch', 'bz_crusher', 'bz_incarnate', 'bz_boom', 'bz_fatal', 'bz_awaken2', 'bz_limit', 'bz_rampant', 'bz_awaken3'] };
CLASSES.sword.cmds.push(['du', 'frenzy', 'buff'], ['uu', 'bz_defy', 'buff'], ['uu', 'bz_scratch'], ['ff', 'rampage', 'buff'], ['du', 'outrage'], ['ud', 'bz_whirl'], ['ud', 'bz_thirst', 'buff'],
  ['buf', 'bz_enrage'], ['bff', 'bz_twister'], ['bbf', 'bloodblade'], ['uff', 'quake'], ['uudd', 'bz_awaken'], ['', 'bz_surge', 'buff'],
  ['fbuf', 'bz_snatch'], ['fdf', 'bz_crusher'], ['fbf', 'bz_boom'], ['dff', 'bz_fatal'], ['duff', 'bz_awaken2'], ['udff', 'bz_rampant'], ['bufd', 'bz_awaken3']);

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
    if ((A.basic && bzFrenzy(p)) || (S && (S.job === 'berserker' || A.skill === 'slam' || A.skill === 'cross'))) { addStatus(t, 'bleed', 7, { dps: p.atk * 0.05, src: p }); if (typeof jobFxBlood === 'function') jobFxBlood(t, p.face); }   // 出血命中溅血（视觉）
  }
  if (jobOf(p) === 'berserker' && bzFrenzy(p) && t.hp <= 0 && t.status && t.status.bleed) { const hl = Math.round(p.hpMax * 0.01); p.hp = Math.min(p.hpMax, p.hp + hl); addNumber(hl, p.x, p.y, p.z, { heal: true }); }
  if (A && A.basic && !A.rk && wtypeOf(p) === 'club' && Math.random() < 0.08 && !t.dead) addStatus(t, 'stun', 0.8, { src: p });
});

/* =====================================================================
   狂战士 P1（官方 48–100 级 → 本作 21–30 级）：鲜血之忆、魔狱血刹（背后血剑吸血成形 → 再按甩进地面）、狂怒暴掠、强悍碾压、汲血之力、
   浴血之怒、致命血陨、血魔·弑天（二觉）、血气界限、疯魔血魂斩、血魔极道：灭世（三觉）
   ===================================================================== */
const bzImg = (name, fb, col) => IMG['fx/' + name] ? name : fxTint(fb, col);
defSkill('bz_memory', { name: '鲜血之忆', cls: 'sword', job: 'berserker', lvReq: 21, mp: 0, cd: 0, type: 'indep', passive: true, col: '#c0202a',
  desc: '【被动 · 一觉】攻击出血状态的敌人后 20 秒内，独立攻击力和物理暴击率提高（每次攻击刷新时间）。', infoExtra: lv => [['攻击力', '+' + pct(0.04 + 0.008 * lv)], ['物理暴击率', '+' + pct(0.02 + 0.003 * lv)]] });
defSkill('bz_incarnate', { name: '汲血之力', cls: 'sword', job: 'berserker', lvReq: 26, mp: 0, cd: 0, type: 'indep', passive: true, col: '#a0101a',
  desc: '【被动 · 二觉】普攻和转职技能攻击力提高；嗜魂之手全程霸体。', infoExtra: lv => [['攻击力', '+' + pct(0.05 + 0.01 * lv)]] });
defSkill('bz_limit', { name: '血气界限', cls: 'sword', job: 'berserker', lvReq: 29, mp: 0, cd: 0, type: 'indep', passive: true, col: '#e0303a',
  desc: '【被动 · 三觉】普攻和转职技能攻击力提高；十字刃改为交叉斩直接射出血十字；嗜魂之手的血气向四个方向喷发，没抓到也会生成血块爆炸。', infoExtra: lv => [['攻击力', '+' + pct(0.06 + 0.012 * lv)]] });

/* ---- 一觉：魔狱血刹。施放时无敌，在背后召唤血剑（约 55 秒，期间攻速、移速提高）；
   攻击敌人时血剑吸收血气（血滴飞向背后），剑身从剑柄开始一点点凝成完整的血剑，吸满后剑身发光；剩最后 10 秒剑身闪白提醒。
   再按一次技能键：拔下背后的血剑，朝指定方向（按住 ←→ 转向，↑↓ 调整纵深）甩进地面 → 大地裂开，血气冲天的血浪从落点向前涌出，
   把范围里的敌人牢牢定住并连续打击 25 次；吸收的血气越多伤害越高。时间到时血剑自己劈向前方。血剑在背上时放三觉 = 用三觉代替收尾 ---- */
const BZ_SWORD_LIFE = 55;
defSkill('bz_awaken', { name: '魔狱血刹', cls: 'sword', job: 'berserker', lvReq: 21, maxLv: 3, mp: 150, cd: 135, pvp: 0.45, type: 'indep', awaken: true, noHitCheck: true, col: '#8a0010',
  desc: '【觉醒】在背后召唤血剑（约 55 秒，期间攻击速度、移动速度提高）。攻击敌人时血剑吸收血气，剑身一点点凝成完整的血剑。再按一次技能键（可以按方向键选方向），拔下血剑甩进地面：大地裂开，冲天的血浪从落点涌出，把范围里的敌人牢牢定住并连续打击 25 次，吸收的血气越多伤害越高。时间到时血剑自动劈下。血剑在背上时施放血魔极道：灭世，会用它代替收尾。召唤时无敌。',
  pow: lv => skillDmg(24, 6, lv), ai: { kind: 'awaken', r: [0, 300], dy: 90 }, cmdNote: '再按：甩下血剑（←→ 选方向）',
  recast: { ok: p => summonsOf(p, 'bz_bloodsword').length > 0, cd: 0.5, act: lv => bzSwordThrow(lv) },
  act: (lv) => ({ name: 'bz_awaken', clip: 'roar', dur: 1.2, superArmor: true, noCounter: true, invul: [0, 1.2],
    onStart: e => { game.cutin = { t: 0, dur: 1.0, name: '魔狱血刹', who: cutinWho(e) }; game.timeStop = 0.9; sfx.awaken(); },
    events: [evAt(0.95, e => { summon(e, 'bz_bloodsword', { lv }); sfx.charge(); fxAura(e, '#ff2030', 1.2); fxBurst(e.x - e.face * 18, e.y, e.z + 80, 200, '#ff3040');
      for (let i = 0; i < 10; i++) bzBloodDrop(e, e.x + rnd(-120, 120), e.y + rnd(-20, 20), rnd(10, 90), i * 0.03); })] }) });
defSummon('bz_bloodsword', { kind: 'attach', host: 'owner', tags: ['sword'], max: 1, over: 'refresh', life: BZ_SWORD_LIFE, keepRoom: true,
  onSpawn: s => { s.blood = 0; s.owner.buffs.bz_bloodsword = { t: BZ_SWORD_LIFE, aspd: 0.15, mspd: 0.15 }; bzSwordFx(s); },
  update: s => bzSwordFx(s),
  onEnd: (s, why) => { const p = s.owner; if (p.buffs) delete p.buffs.bz_bloodsword; if (why === 'life' && !p.dead) bzSwordFall(p, s.lv, s.blood || 0, p.face, p.y); } });
// 背上的血剑：画在人物身后（y 比人物小一点）；轮廓先淡淡地在，吸到的血气从剑柄往剑尖“长”出实体
function bzSwordFx(s) {
  if (s.fx && fxList.includes(s.fx)) return;
  s.fx = addFx({ x: s.owner.x, y: s.owner.y - 0.35, z: 0, dur: 1e9, s,
    update() { const S = this.s, p = S.owner; this.x = p.x; this.y = p.y - 0.35; if (S.gone || p.dead) this.t = this.dur; },
    draw(c) {
      const S = this.s, p = S.owner, img = IMG['fx/bz_bloodsword']; if (S.gone || !img) return;
      const b = S.blood || 0, full = b >= 1, H = 200, W = H * img.width / img.height, k = Math.min(1, S.lifeT * 3), f = 0.28 + 0.72 * b;
      const warn = S.life - S.lifeT < 10 && Math.floor(game.t * 4) % 2 === 0;   // 最后 10 秒剑身闪白
      c.save(); c.translate(sx(p.x - p.face * 36), sy(p.y, p.z + 86 + Math.sin(game.t * 2) * 3)); c.rotate(p.face * 0.55); c.scale(k, k); c.globalCompositeOperation = 'lighter';
      c.globalAlpha = 0.35; c.drawImage(img, -W / 2, -H / 2, W, H);   // 还没凝成的部分：淡淡的轮廓（发光）
      c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1; c.drawImage(   // 已凝成的部分：实体（不叠加，亮背景上也看得清）
        warn ? fxTint('bz_bloodsword', '#ffffff') : img, 0, 0, img.width, img.height * f, -W / 2, -H / 2, W, H * f);
      if (full) { c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.35 + 0.25 * Math.sin(game.t * 6); c.drawImage(img, -W * 0.6, -H * 0.55, W * 1.2, H * 1.1); }
      c.restore();
    } });
}
// 血滴：从 (x, y, z) 飞向背上的血剑
function bzBloodDrop(p, x, y, z, delay = 0) {
  addFx({ x, y: y + 0.5, z, dur: 0.35 + delay, p, draw(c) {
    const k = Math.max(0, (this.t - delay) / 0.35); if (k <= 0) return; const e = easeIn(k), P = this.p;
    const X = lerp(x, P.x - P.face * 36, e), Z = lerp(z, P.z + 92, e) + Math.sin(k * Math.PI) * 30;
    drawSpr(c, fxTint('orb', '#ff2030'), sx(X), sy(lerp(y, P.y, e), Z), 14 * (1 - k * 0.4), 0, { alpha: 0.95 });
  } });
}
// 攻击命中时血剑吸收血气：普攻每次 2.5%，技能 4.5%（同一帧多个目标只算一次）
SWORD_HOOKS.onHit.push((p, t, h, dmg, act) => {
  if (h.bzFall || jobOf(p) !== 'berserker') return; const S = summonsOf(p, 'bz_bloodsword')[0]; if (!S || S.blood >= 1 || S._absT === game.t) return;
  S._absT = game.t; const A = act || p.act; S.blood = Math.min(1, (S.blood || 0) + (A && A.basic ? 0.025 : 0.045));
  if (game.t - (S._dropT ?? -9) > 0.06) { S._dropT = game.t; bzBloodDrop(p, t.x, t.y, t.z + t.h * 0.6); }
  if (S.blood >= 1) { sfx.buff(); fxAura(p, '#ff2030', 0.8); fxText('血剑成形', p.x, p.y, p.z + 30, { col: '#ff5a5a', size: 13 }); }
});
// 再按一次：拔下血剑（bzAwk1 举剑）→ 甩进地面（bzAwk2）；方向键：←→ 在 castSkill 里已经转向，↑↓ 让落点往纵深偏
function bzSwordThrow(lv) {
  return { name: 'bz_swordfall', clip: 'bzAwk', dur: 1.25, superArmor: true, noCounter: true, invul: [0, 1.25],
    onStart: e => { const s = summonsOf(e, 'bz_bloodsword')[0], a = e.act; a.L = s ? s.lv : lv; a.blood = s ? s.blood || 0 : 0; a.ty = clamp(e.y + e.pad.dy() * 70, 8, DEPTH - 8); a.face = e.face;
      dismissSummons(e, 'bz_bloodsword', 'cmd'); sfx.charge();
      a.fx = addFx({ x: e.x, y: e.y + 0.4, z: 0, dur: 0.32, e, draw(c) { const k = easeOut(this.t / this.dur), E = this.e;   // 血剑从背后拔到头顶
        drawSpr(c, 'bz_bloodsword', sx(E.x + E.face * lerp(-30, 6, k)), sy(E.y, E.z + lerp(84, 150, k)), 0, lerp(190, 230, k), { rot: E.face * lerp(0.5, Math.PI, k), alpha: 0.95 }); } }); },
    update: e => { e.vx = e.vy = 0; },
    events: [evAt(0.3, e => { e.play('bzAwk', true); e.animT = 1.72; const a = e.act; bzSwordFall(e, a.L, a.blood, a.face, a.ty, true); })] };
}
// 血剑甩进地面：剑从头顶 / 背后飞向落点插进地里 → 裂地 → 冲天血浪从落点向前涌出（25 段，定身）
function bzSwordFall(e, lv, blood, face, ty, thrown) {
  const x = e.x + face * 150, y = ty ?? e.y, mul = 0.8 + 0.35 * clamp(blood, 0, 1), x0 = e.x - face * (thrown ? -6 : 30), z0 = e.z + (thrown ? 150 : 84);
  addFx({ x, y: y + 0.6, z: 0, dur: 0.12, draw(c) { const k = easeIn(this.t / this.dur);   // 飞行
    drawSpr(c, 'bz_bloodsword', sx(lerp(x0, x, k)), sy(lerp(e.y, y, k), lerp(z0, 60, k)), 0, 240, { rot: face * lerp(thrown ? Math.PI * 0.75 : 0.5, 0, k), alpha: 0.95 }); } });
  game.after(0.12, () => {
    cam.flash = 0.3; cam.flashCol = '#ff4a4a'; cam.shake = 14; sfx.boom(1.4); sfx.iai();
    fxSpr('bz_bloodsword', x, y, 0, { h: 260, dur: 2.0, ay: 0.85, fadeIn: 0.01, alpha: 0.95 });   // 插在地上的血剑
    fxShock(x, y, 340, '#ff3040'); fxBurst(x, y, 30, 300, '#ff2030'); fxDust(x, y, 14, 50, '#6a1a1a');
    const L = ents.filter(t => hittable(e, t) && (t.x - x) * face > -260 && Math.abs(t.x - x) < 540 && Math.abs(t.y - y) < 130);
    for (const t of L) addStatus(t, 'root', 2.2, { src: e });
    for (let j = 0; j < 7; j++) game.after(0.06 + j * 0.07, () => { const X = x + face * (j * 72 - 40);   // 血浪：冲天的血柱从落点一排排向前涌
      fxSpr('bloodpillar', X, y + rnd(-14, 14), 0, { h: 300 + j * 20, dur: 0.7, ay: 1, grow: [0.3, 1.05] }); fxSpr('bloodwave', X, y, 0, { h: 200, dur: 0.5, ay: 1, flip: face < 0, grow: [0.5, 1.1] }); if (j % 2 === 0) sfx.boom(0.6); });
    game.after(0.2, () => fxSpr('bloodpillar', x, y, 0, { h: 460, w: 200, dur: 1.2, ay: 1, grow: [0.4, 1.1] }));
    for (let i = 0; i < 25; i++) game.after(0.05 + i * 0.07, () => { if (e.dead) return; if (i % 6 === 5) fxSpr('bloodpillar', x + face * rnd(-80, 440), y + rnd(-40, 40), 0, { h: 240, dur: 0.4, ay: 1 });
      for (const t of L) if (!t.dead) applyHit(e, t, { dmg: skillDmg(i === 24 ? 8 : 0.8, i === 24 ? 2.5 : 0.25, lv) * mul, stun: 0.3, knock: 0, launch: i === 24 ? 520 : 0, hs: 0.02, sure: true, downHit: true, col: '#ff4a5a', type: 'indep', bzFall: true }, { proj: true }); });
  });
}

/* ---- 狂怒暴掠：抓住前方的敌人（按 → 突进去抓），跳起把它摔在地上，血气爆炸。施放时霸体，抓住后无敌 ---- */
defSkill('bz_snatch', { name: '狂怒暴掠', cls: 'sword', job: 'berserker', lvReq: 23, mp: 60, cd: 30, type: 'indep', col: '#d0202a',
  desc: '抓住前方的敌人（按 → 突进过去抓），跳起把它狠狠摔在地上，引发血气爆炸。施放时霸体，抓住后无敌。', pow: lv => skillDmg(12, 1.2, lv), ai: { kind: 'grab', r: [0, 200], dy: 28 },
  act: (lv) => ({ name: 'bz_snatch', clip: 'soulhand', dur: 1.3, superArmor: true, noCounter: true,
    onStart: e => { if (e.pad.dx() * e.face > 0) e.act.move = [[0.02, 0.18, 700]]; },
    hits: [HB(0.06, 0.22, [0, 118, 36, 0, 120], skillDmg(1.5, 0.15, lv), { grab: true, stun: 0.5, hs: 0.05 })],
    hold: (e, t) => { e.invul = Math.max(e.invul, 0.05); t.x = e.x + e.face * 36; t.y = e.y + 0.5; t.z = e.z + 50; t.face = -e.face; },
    events: [evAt(0.34, e => { if (!e.grabbed) { e.act.dur = Math.min(e.act.dur, 0.6); return; } e.vz = 620; e.z = Math.max(e.z, 1); e.play('quake', true); sfx.jump(); }),
      evAt(0.62, e => { if (e.grabbed) { e.vz = -1400; } })],
    onLand: e => { if (e.actT < 0.5 || !e.grabbed) return; const a = e.act; a.onLand = null; a.dur = e.actT + 0.45; e.play('quakeLand', true); cam.shake = 12; sfx.boom(1.3);
      const x = e.x + e.face * 36; fxShock(x, e.y, 270, '#ff3040'); fxSpr('bloodpillar', x, e.y, 0, { h: 260, dur: 0.5, ay: 1, grow: [0.4, 1.1] }); fxBurst(x, e.y, 30, 290, '#ff2030');
      throwGrab(e, { dmg: skillDmg(8, 0.8, lv), down: true, knock: 80, hs: 0.14, big: 1.8, col: '#ff4a5a' });
      blast(e, x, e.y, 210, { dmg: skillDmg(3.5, 0.35, lv), launch: 420, knock: 120, hs: 0.08, col: '#ff5a5a' }, { zMax: 160, ...bzBleedArea(e) }); } }) });

/* ---- 强悍碾压：割开手掌（消耗当前 HP 1%），喷出的血把剑化成血剑，高举砸向大地引发巨大爆炸 ---- */
defSkill('bz_crusher', { name: '强悍碾压', cls: 'sword', job: 'berserker', lvReq: 25, mp: 70, cd: 50, type: 'indep', col: '#b01020',
  desc: '割开手掌（消耗当前 HP 的 1%），喷出的血把剑化成巨大的血剑，高高举起砸向大地，引发巨大的血气爆炸。霸体。', pow: lv => skillDmg(15, 1.5, lv), ai: { kind: 'aoe', r: [0, 300], dy: 70 },
  act: (lv) => ({ name: 'bz_crusher', clip: 'bzAwk', dur: 1.3, superArmor: true, noCounter: true,
    onStart: e => { e.hp = Math.max(1, e.hp - Math.round(e.hp * 0.01)); fxBurst(e.x, e.y, e.z + 60, 80, '#ff2030'); sfx.charge(); },
    update: e => { if (e.actT < 0.7 && Math.random() < 0.6) fxCharge(e, '#ff3040', 2); },
    events: [evAt(0.1, e => { e.animT = 0; }), evAt(0.75, e => { e.animT = 1.72; const x = e.x + e.face * 120; cam.shake = 14; cam.flash = 0.2; cam.flashCol = '#ff6a6a'; sfx.boom(1.4);
      fxSpr(bzImg('bz_bloodsword', 'swordrain', '#ff3040'), x, e.y, 0, { h: 280, dur: 0.4, ay: 1, grow: [1.3, 1] }); fxShock(x, e.y, 380, '#ff3040'); fxBurst(x, e.y, 40, 380, '#ff2030');
      for (let i = 0; i < 6; i++) fxSpr('bloodpillar', x + Math.cos(i) * 200, e.y + Math.sin(i) * 70, 0, { h: 210, dur: 0.5, ay: 1, grow: [0.4, 1] });
      for (let i = 0; i < 5; i++) game.after(i * 0.09, () => { if (e.dead) return; if (i) fxBurst(x + rnd(-120, 120), e.y, 40 + rnd(0, 60), 160, '#ff2030');
        blast(e, x, e.y, 300, { dmg: skillDmg(3, 0.3, lv), launch: i ? 0 : 520, airLift: 220, knock: i === 4 ? 160 : 20, hs: i === 4 ? 0.16 : 0.05, big: i === 4 ? 2 : 1.3, col: '#ff5a5a', downHit: true }, { zMax: 260, ...(i ? {} : bzBleedArea(e)) }); }); })] }) });

/* ---- 浴血之怒：消耗当前 HP 的 1%，以自身为中心引发大范围血气爆炸。站桩、霸体 ---- */
defSkill('bz_boom', { name: '浴血之怒', cls: 'sword', job: 'berserker', lvReq: 26, mp: 60, cd: 40, type: 'indep', col: '#ff2a3a',
  desc: '消耗当前 HP 的 1%，以自身为中心引发大范围的血气爆炸。施放时站桩、霸体。', pow: lv => skillDmg(14, 1.4, lv), ai: { kind: 'aoe', r: [0, 280], dy: 90 },
  act: (lv) => ({ name: 'bz_boom', clip: 'outrage', dur: 0.9, superArmor: true, noCounter: true,
    onStart: e => { e.hp = Math.max(1, e.hp - Math.round(e.hp * 0.01)); sfx.charge(); },
    update: e => { e.vx = e.vy = 0; },
    events: [evAt(0.3, e => { cam.shake = 13; cam.flash = 0.2; cam.flashCol = '#ff5a5a'; sfx.boom(1.4); fxShock(e.x, e.y, 400, '#ff2030'); fxBurst(e.x, e.y, 50, 420, '#ff2a3a');
      for (let i = 0; i < 10; i++) { const a = i * TAU / 10; fxSpr('bloodpillar', e.x + Math.cos(a) * 240, e.y + Math.sin(a) * 80, 0, { h: 240, dur: 0.5, ay: 1, grow: [0.3, 1.05] }); }
      blast(e, e.x, e.y, 300, { dmg: skillDmg(14, 1.4, lv), launch: 520, knock: 180, hs: 0.16, big: 2, col: '#ff5a5a', downHit: true, radial: true }, { zMax: 260, ...bzBleedArea(e) }); })] }) });

/* ---- 致命血陨：吸血成剑，快速两斩后接强力交叉斩（按 → 前进更远）。霸体 ---- */
defSkill('bz_fatal', { name: '致命血陨', cls: 'sword', job: 'berserker', lvReq: 26, mp: 70, cd: 50, type: 'indep', col: '#e0101a',
  desc: '吸取血气凝成血剑，快速斩击两次，最后一记强力的交叉斩（按 → 前进更远）。霸体。', pow: lv => skillDmg(16, 1.6, lv), ai: { kind: 'burst', r: [0, 220], dy: 40 },
  act: (lv) => ({ name: 'bz_fatal', clip: 'dual1', dur: 1.2, superArmor: true, noCounter: true,
    onStart: e => { e.act.step = e.pad.dx() * e.face > 0 ? 360 : 160; sfx.charge(); fxBurst(e.x, e.y, e.z + 60, 100, '#ff2030'); },
    events: [0.15, 0.35].map((t, i) => evAt(t, e => { e.play(i ? 'dual2' : 'dual3', true); e.vx = e.face * e.act.step * 2; sfx.swing(true); fxSlashOn(e, { col: '#ff3040', a0: i ? 1.0 : -2.4, a1: i ? -2.4 : 1.0, r: 104, w: 22, off: [10, 56], heavy: true });
      game.after(0.07, () => { if (e.dead) return; e.vx = 0; instantHit(e, { box: [-10, 140, 40, 0, 130], dmg: skillDmg(3, 0.3, lv), stun: 0.6, knock: 40, hs: 0.06, col: '#ff5a5a', type: 'indep' }); }); }))
      .concat([evAt(0.7, e => { e.play('dual4', true); cam.shake = 11; sfx.iai(); sfx.boom(1.1); const x = e.x + e.face * 110; fxSpr('crossx', x, e.y, 70, { w: 330, dur: 0.6, grow: [0.5, 1.1], col: '#ff2030' }); fxShock(x, e.y, 230, '#ff3040');
        blast(e, x, e.y, 190, { dmg: skillDmg(10, 1, lv), launch: 480, knock: 200, hs: 0.16, big: 2, col: '#ff5a5a', downHit: true }, { zMax: 240, ...bzBleedArea(e) }); })]) }) });

/* ---- 疯魔血魂斩：生成巨大的血气团，下劈两次把它打碎，再把碎块向前抽飞散射。X 轴范围极大 ---- */
defSkill('bz_rampant', { name: '疯魔血魂斩', cls: 'sword', job: 'berserker', lvReq: 29, mp: 110, cd: 60, type: 'indep', col: '#ff3a4a',
  desc: '在前方生成巨大的血气团，下劈两次把它打碎，再把碎块向前抽飞散射，横向范围极大（按 → 前进更远）。霸体。', pow: lv => skillDmg(22, 2.2, lv), ai: { kind: 'burst', r: [0, 500], dy: 40 },
  act: (lv) => ({ name: 'bz_rampant', clip: 'twister', dur: 1.5, superArmor: true, noCounter: true,
    onStart: e => { const a = e.act; a.cx = e.x + e.face * (e.pad.dx() * e.face > 0 ? 140 : 90); a.cy = e.y; sfx.charge();
      a.fx = addFx({ x: a.cx, y: a.cy, z: 60, dur: 0.95, a, draw(c) { const k = Math.min(1, this.t * 2); drawSpr(c, fxTint('darkorb', '#ff2030'), sx(this.a.cx), sy(this.a.cy, 70), 140 * k, 0, { rot: this.t * 3 }); } }); },
    events: [0.45, 0.7].map((t, i) => evAt(t, e => { const a = e.act; e.play(i ? 'rk4' : 'a3slam', true); cam.shake = i ? 10 : 5; sfx.boom(i ? 1 : 0.6); fxSlashOn(e, { col: '#ff3040', a0: -2.8, a1: 1.2, r: 90, w: 26, off: [10, 56], heavy: true });
      if (i) { fxShock(a.cx, a.cy, 270, '#ff3040'); blast(e, a.cx, a.cy, 180, { dmg: skillDmg(7, 0.7, lv), stun: 0.7, knock: 20, hs: 0.1, big: 1.6, col: '#ff5a5a', downHit: true }, { zMax: 200 }); } }))
      .concat([evAt(1.0, e => { const a = e.act; e.play('whirl', true); cam.shake = 12; sfx.iai(); sfx.boom(1.2); fxBurst(a.cx, a.cy, 70, 220, '#ff2030');
        for (let i = 0; i < 5; i++) game.after(i * 0.05, () => { if (e.dead) return; spawnProj({ owner: e, x: a.cx - e.face * 60, y: a.cy + (i - 2) * 6, z: 55, vx: e.face * 760, vy: (i - 2) * 6, face: e.face, life: 0.9, w: 26, d: 30, h: 70, pierce: true,
          hit: { dmg: skillDmg(3, 0.3, lv), knock: i === 4 ? 140 : 30, stun: 0.45, hs: 0.04, col: '#ff5a5a', type: 'indep', downHit: true }, draw(c, q) { drawSpr(c, fxTint('rock', '#ff3040'), sx(q.x), sy(q.y, q.z), 28, 0, { rot: q.t * 10, add: false }); drawSpr(c, fxTint('fireball', '#ff2030'), sx(q.x - q.face * 10), sy(q.y, q.z), 40, 0, { flip: q.face < 0, alpha: 0.7 }); } }); }); })]) }) });

/* ---- 血魔·弑天（二觉）：无敌；被血云包裹，化身巨大的血魔向前猛冲，终点巨型血爆后变回人形（突进时按反方向键缩短距离） ---- */
defSkill('bz_awaken2', { name: '血魔·弑天', cls: 'sword', job: 'berserker', lvReq: 27, maxLv: 3, mp: 180, cd: 170, pvp: 0.45, type: 'indep', awaken: true, col: '#ff1020',
  desc: '【二觉】被血云包裹，化身巨大的血魔向前猛冲，撞飞沿途的敌人，终点引发巨型血爆后变回人形。突进时按反方向键可以缩短距离。全程无敌。', pow: lv => skillDmg(32, 9, lv), ai: { kind: 'awaken', r: [0, 500], dy: 90 },
  act: (lv) => ({ name: 'bz_awaken2', clip: 'roar', dur: 2.6, superArmor: true, noCounter: true, invul: [0, 2.6],
    onStart: e => { game.cutin = { t: 0, dur: 1.0, name: '血魔·弑天', who: cutinWho(e) }; game.timeStop = 0.9; sfx.awaken(); const a = e.act;
      a.fx = addFx({ x: e.x, y: e.y + 0.6, z: 0, dur: 2.6, e, a, update() { this.x = this.e.x; this.y = this.e.y + 0.6; },
        draw(c) { const t = this.t; if (t < 0.9) return; const k = Math.min(1, (t - 0.9) * 4) * Math.min(1, (2.4 - t) * 4); if (k <= 0) return;
          drawSpr(c, bzImg('bz_demon', 'ghost', '#ff2030'), sx(this.x + this.e.face * 20), sy(this.y, 0) + 8, 0, 300 * k, { ay: 1, flip: this.e.face < 0, alpha: 0.95, add: !IMG['fx/bz_demon'] }); } }); },
    update: (e, dt) => { const a = e.act; if (e.actT > 0.9 && e.actT < 1.9) { const back = e.pad.dx() * e.face < 0; e.vx = e.face * (back ? 180 : 460); e.drawOpts = { glow: 1 };
        a.tk = (a.tk || 0) + dt; a.cnt = a.cnt || new Map();
        for (const [t] of a.cnt) if (!t.dead && t.st !== 'held') { t.x = e.x + e.face * 90; t.y = damp(t.y, e.y, 6, dt); }   // 撞到的敌人被推着一起走
        if (a.tk >= 0.1) { a.tk = 0; fxDust(e.x, e.y, 3, 16, '#8a2a2a');
          for (const t of ents) { const n = a.cnt.get(t) || 0; if (n >= 2 || !hittable(e, t) || Math.abs(t.x - (e.x + e.face * 60)) > 150 || Math.abs(t.y - e.y) > 70 || t.z > 260) continue;
            a.cnt.set(t, n + 1); applyHit(e, t, { dmg: skillDmg(3, 0.9, lv), stun: 0.8, knock: 0, hs: 0.04, sure: true, col: '#ff5a5a' }, { proj: true }); } } }
      else e.vx = 0; },
    onEnd: e => { e.drawOpts = {}; },
    events: [evAt(0.9, e => { fxBurst(e.x, e.y, 60, 240, '#ff2030'); sfx.boom(1); }),
      evAt(1.95, e => { cam.flash = 0.35; cam.flashCol = '#ff4a4a'; cam.shake = 16; sfx.boom(1.5); const x = e.x + e.face * 60;
        fxShock(x, e.y, 440, '#ff2030'); fxBurst(x, e.y, 60, 440, '#ff2030'); for (let i = 0; i < 8; i++) fxSpr('bloodpillar', x + rnd(-280, 280), e.y + rnd(-60, 60), 0, { h: 260, dur: 0.6, ay: 1, grow: [0.3, 1.05] });
        blast(e, x, e.y, 330, { dmg: skillDmg(24, 7, lv), launch: 560, knock: 220, hs: 0.22, big: 2.4, critBonus: 0.2, sure: true, downHit: true, col: '#ff5a5a' }, { zMax: 360 }); })] }) });

/* ---- 血魔极道：灭世（三觉）：压制卡赞暴走、血气凝成铠甲 → 追踪最强的敌人连斩 5 次 → 砸进地面插入血剑 → 拔剑喷发血气。无敌 ---- */
defSkill('bz_awaken3', { name: '血魔极道：灭世', cls: 'sword', job: 'berserker', lvReq: 30, maxLv: 3, mp: 250, cd: 135, pvp: 0.45, type: 'indep', awaken: true, col: '#ff0010',
  desc: '【三觉】压制卡赞的暴走，血气凝成铠甲覆盖全身：追踪最强的敌人连斩 5 次（会跟着目标移动），随后砸进地面插入血剑，拔剑时血气喷发波及周围所有敌人。全程无敌。与魔狱血刹共享冷却。',
  pow: lv => skillDmg(48, 12, lv), ai: { kind: 'awaken', r: [0, 400], dy: 90 },
  act: (lv) => ({ name: 'bz_awaken3', clip: 'roar', dur: 3.4, superArmor: true, noCounter: true, invul: [0, 3.4],
    onStart: e => { game.cutin = { t: 0, dur: 1.0, name: '血魔极道：灭世', who: cutinWho(e) }; game.timeStop = 0.9; sfx.awaken(); e.cool.bz_awaken = Math.max(e.cool.bz_awaken || 0, e.cool.bz_awaken3 || 0); },
    update: e => { if (e.actT > 0.9) { e.drawOpts = { glow: 0.8 }; if (Math.random() < 0.4) fxCharge(e, '#ff2030', 1); } },
    onEnd: e => { e.drawOpts = {}; },
    events: [evAt(0.9, e => { fxAura(e, '#ff1020', 1.5); fxBurst(e.x, e.y, e.z + 60, 220, '#ff2030'); sfx.boom(0.8); }),
      ...[0, 1, 2, 3, 4].map(i => evAt(1.1 + i * 0.22, e => { const val = t => (t.boss ? 2e12 : t.elite ? 1e12 : 0) + t.hp, L = ents.filter(t => hittable(e, t) && Math.abs(t.x - e.x) < 700);
        const t = L.sort((a, b) => val(b) - val(a))[0]; if (t) { const side = i % 2 ? 1 : -1; e.x = t.x - side * 60; e.y = t.y; e.face = side; }
        e.play(['dual1', 'dual3', 'dual2', 'dual4', 'bladeW'][i], true); fxAfterimage(e, '#ff2030'); sfx.iai(); cam.shake = Math.max(cam.shake, 7);
        fxSlashOn(e, { col: '#ff2030', a0: i % 2 ? 1.0 : -2.6, a1: i % 2 ? -2.6 : 1.0, r: 130, w: 28, off: [10, 56], heavy: true });
        instantHit(e, { box: [-40, 180, 50, 0, 180], dmg: skillDmg(5, 1.3, lv), stun: 1.0, knock: 10, hs: 0.1, big: 1.8, sure: true, col: '#ff5a5a', downHit: true }); })),
      evAt(2.35, e => { e.play('bzAwk', true); e.animT = 1.72; cam.shake = 14; sfx.boom(1.4); fxShock(e.x, e.y, 260, '#ff2030'); fxSpr(bzImg('bz_bloodsword', 'swordrain', '#ff3040'), e.x + e.face * 60, e.y, 0, { h: 260, dur: 0.9, ay: 1, grow: [1.3, 1] }); }),
      evAt(2.85, e => { cam.flash = 0.4; cam.flashCol = '#ff3030'; cam.shake = 18; sfx.boom(1.6); sfx.iai(); fxBurst(e.x, e.y, 60, 420, '#ff1020');
        for (let i = 0; i < 12; i++) fxSpr('bloodpillar', e.x + rnd(-320, 320), e.y + rnd(-50, 50), 0, { h: 280, dur: 0.7, ay: 1, grow: [0.3, 1.05] });
        for (const t of ents) if (hittable(e, t) && Math.abs(t.x - e.x) < WW * 0.6) applyHit(e, t, { dmg: skillDmg(26, 7, lv), launch: 560, knock: 200, hs: 0.24, big: 2.4, critBonus: 0.3, sure: true, downHit: true, col: '#ff5a5a' }, { proj: true }); })] }) });
{ const A = SKILLS.bz_awaken, a0 = A.act; A.act = (lv, p) => { const a = a0(lv, p); if (p && p.cool) p.cool.bz_awaken3 = Math.max(p.cool.bz_awaken3 || 0, p.cool.bz_awaken || 0); return a; }; }
// 血剑还在背上时放三觉：用三觉代替魔狱血刹的收尾（官方：两者共享冷却，三觉可以替代血剑劈下）；背上的血剑被拔出来用掉
swordAwk3Finish('bz_awaken3', p => summonsOf(p, 'bz_bloodsword').length > 0, e => dismissSummons(e, 'bz_bloodsword', 'cmd'));
// 鲜血之忆：攻击出血的敌人后 20 秒强化；血气界限：十字刃射出血十字、嗜魂之手四向喷发
SWORD_HOOKS.onHit.push((p, t) => { const lv = jobOf(p) === 'berserker' ? skLv(p, 'bz_memory') : 0; if (lv && t.status && t.status.bleed) p.buffs.bz_memory = { t: 20, atk: 0.04 + 0.008 * lv, crit: 0.02 + 0.003 * lv }; });
{
  const C = SKILLS.cross, c0 = C.act;
  C.act = (lv, p) => { const a = c0(lv, p); if (!p || jobOf(p) !== 'berserker' || !skLv(p, 'bz_limit')) return a;
    return { name: 'cross', clip: 'cross', dur: 0.5, noCounter: true, links: swordAttackIds(), linkFrom: 0.28,
      hits: [HB(0.05, 0.1, [0, 100, 36, 10, 110], skillDmg(0.6, 0.06, lv), { stun: 0.45, knock: 30, hs: 0.05, type: 'indep' }), HB(0.13, 0.18, [0, 100, 36, 10, 110], skillDmg(0.6, 0.06, lv), { stun: 0.5, knock: 30, hs: 0.05, type: 'indep' })],
      events: [slashAt(0.04, { a0: -2.2, a1: 1.0, r: 78, w: 18, off: [10, 55], col: '#ff8a8a' }), slashAt(0.12, { a0: 1.0, a1: -2.2, r: 78, w: 18, off: [10, 55], col: '#ff8a8a' }),
        evAt(0.18, e => { sfx.hit('crit', false); spawnProj({ owner: e, x: e.x + e.face * 50, y: e.y, z: 50, vx: e.face * 520, face: e.face, life: 0.7, w: 48, d: 38, h: 90, pierce: true,
          hit: { dmg: skillDmg(3.2, 0.32, lv), stun: 0.6, knock: 200, down: true, hs: 0.08, col: '#ff6a6a', type: 'indep' }, onHitT: (q, t) => addStatus(t, 'bleed', 7, { dps: e.atk * 0.05, src: e }),
          draw(c, q) { drawSpr(c, fxTint('crossx', '#ff3040'), sx(q.x), sy(q.y, q.z), 130, 0, { rot: q.t * 4 }); } }); })] }; };
}
CLASSES.sword.passives.push(p => {
  const on = jobOf(p) === 'berserker';
  setPassive(p, 'bz_incarnate', on && skLv(p, 'bz_incarnate') > 0, { dmg: 0.05 + 0.01 * skLv(p, 'bz_incarnate') });
  setPassive(p, 'bz_limit', on && skLv(p, 'bz_limit') > 0, { dmg: 0.06 + 0.012 * skLv(p, 'bz_limit') });
});

/* ---- 冷却修正（castSkill 先写冷却再调用 act，这里包一层 act 在施放时改 p.cool）：
   剑魂光剑掌握（光剑，非觉醒 −1%/级，最多 −10%）；狂战士狂暴之力（转职技能 −10%）、暴走（爆发之刃 / 嗜魂封魔斩 / 崩山裂地斩 −20%）---- */
function swordCdMul(p, S) {
  let m = 1; if (!p || S.awaken || S.fixedCd) return m;
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
// 官方可用普攻取消后摇：十字刃（狂战士）、三觉
swordAtkCancel('cross', 0.3, 'berserker'); swordAtkCancel('bz_awaken3', 3.0);
swordFinalize();
