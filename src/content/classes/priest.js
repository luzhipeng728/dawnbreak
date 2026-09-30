/* =====================================================================
   职业：圣职者（男）——基础职业切片
   基础普攻、通用技能和职业元数据集中在这里；四个转职的专属机制由各自文件补充。
   ===================================================================== */

const PRIEST_PALETTE = { skin: '#efc39c', hair: '#342820', eye: '#4d6f85', coat: '#e6e0d1', coat2: '#b9ae98', trim: '#d4b45e', scarf: '#e6e0d1', pants: '#474951', boot: '#3c3028', glove: '#e6e0d1', belt: '#66503a', blade: '#d8dde8', glow: '#ffe3a0' };
// 基础文件只登记武器标签，具体数值由 items.js / 转职文件按版本补齐。
const PRIEST_WEAPON_TYPES = ['cross', 'rosary', 'battleaxe', 'totem', 'scythe'];
const PRIEST_WEAPON_NAMES = { cross: '十字架', rosary: '念珠', battleaxe: '战斧', totem: '图腾', scythe: '镰刀' };

const PRIEST_ACTS = {
  atk1: { name: 'atk1', dur: 0.34, basic: true, speed: 'aspd', chain: [0.12, 0.34], next: 'atk2', move: [[0.02, 0.08, 100]],
    hits: [HB(0.06, 0.12, [0, 94, 34, 10, 102], 1.0, { stun: 0.32, knock: 45, hs: 0.05, snd: 'blunt' })],
    events: [slashAt(0.05, { a0: -2.1, a1: 1.0, r: 68, w: 17, off: [12, 56], col: '#ffe2a0' })] },
  atk2: { name: 'atk2', dur: 0.38, basic: true, speed: 'aspd', chain: [0.13, 0.38], next: 'atk3', move: [[0.02, 0.1, 90]],
    hits: [HB(0.06, 0.13, [0, 98, 35, 8, 106], 1.08, { stun: 0.35, knock: 55, hs: 0.055, snd: 'blunt' })],
    events: [slashAt(0.05, { a0: 1.0, a1: -2.0, r: 70, w: 18, off: [12, 58], col: '#ffe2a0' })] },
  atk3: { name: 'atk3', dur: 0.5, basic: true, speed: 'aspd', move: [[0.04, 0.16, 190]],
    hits: [HB(0.1, 0.19, [0, 112, 38, 0, 120], 1.55, { stun: 0.5, knock: 210, hs: 0.085, shake: 2, big: 1.2, heavy: true, snd: 'blunt' })],
    events: [slashAt(0.09, { a0: -2.6, a1: 1.0, r: 84, w: 22, off: [12, 58], squash: 0.85, heavy: true, col: '#fff0b8' })] },
  dash: { name: 'dash', dur: 0.45, basic: true, speed: 'aspd', move: [[0, 0.25, 390]], noCounter: true, chain: [0.13, 0.45],
    hits: [HB(0.05, 0.24, [0, 80, 32, 18, 94], 1.25, { stun: 0.4, knock: 190, hs: 0.06, heavy: true, snd: 'blunt' })],
    events: [evAt(0.04, e => { fxStreak({ x: e.x + e.face * 12, y: e.y, z: e.z + 58, face: e.face, len: 92, w: 11, col: '#ffe2a0' }); sfx.swing(true); })] },
  jatk: { name: 'jatk', dur: 0.34, basic: true, speed: 'aspd', airOnly: true, lowGrav: 0.72, chain: [0.15, 0.34],
    hits: [HB(0.07, 0.17, [0, 82, 32, -30, 78], 0.95, { stun: 0.32, knock: 50, hs: 0.05, airLift: 150, snd: 'blunt' })],
    events: [slashAt(0.06, { a0: -1.8, a1: 1.2, r: 64, w: 15, off: [12, 42], col: '#ffe2a0' })] },
  back: { ...BACKSTEP },
};

defSkill('p_upslash', { name: '空斩打', cls: 'priest', lvReq: 1, mp: 8, cd: 2, type: 'phys', icon: 'up', col: '#d7b86a',
  desc: '挥动武器向上挑击，把前方敌人击至空中。', pow: lv => skillDmg(1.7, 0.17, lv), ai: { kind: 'launch', r: [0, 110], dy: 24 },
  act: lv => ({ name: 'p_upslash', clip: 'up', dur: 0.43, cancelFrom: 0.25, superArmor: [0, 0.1], move: [[0.02, 0.1, 95]],
    hits: [HB(0.1, 0.18, [0, 100, 34, 0, 124], skillDmg(1.7, 0.17, lv), { launch: 500 + lv * 6, knock: 40, hs: 0.075, shake: 1.5 })],
    events: [slashAt(0.09, { a0: 1.3, a1: -1.8, r: 82, w: 20, off: [10, 50], heavy: true, col: '#ffe7a2' })] }) });
defSkill('p_jab', { name: '直拳冲击', cls: 'priest', lvReq: 1, mp: 10, cd: 2.5, type: 'phys', col: '#d2b46d',
  desc: '向前快速直拳，命中后把敌人推开。', pow: lv => skillDmg(1.8, 0.18, lv), ai: { kind: 'poke', r: [0, 160], dy: 24 },
  act: lv => ({ name: 'p_jab', clip: 'palm', dur: 0.38, cancelFrom: 0.22, move: [[0.04, 0.16, 180]],
    hits: [HB(0.1, 0.18, [0, 154, 30, 12, 90], skillDmg(1.8, 0.18, lv), { stun: 0.38, knock: 150, hs: 0.06, snd: 'blunt' })],
    events: [evAt(0.08, e => { fxStreak({ x: e.x + e.face * 80, y: e.y, z: e.z + 58, face: e.face, len: 80, w: 10, col: '#ffe3a0' }); sfx.swing(true); })] }) });
defSkill('p_fallhammer', { name: '落凤锤', cls: 'priest', lvReq: 5, mp: 16, cd: 4, type: 'phys', air: true, col: '#d0a95a',
  desc: '跃起后向地面猛击，落地产生冲击波。', pow: lv => skillDmg(2.7, 0.27, lv), ai: { kind: 'gap', r: [40, 220], dy: 30 },
  act: lv => ({ name: 'p_fallhammer', clip: 'a3slam', dur: 1.2, noCounter: true, superArmor: [0.2, 1.1],
    onStart: e => { e.vz = 480; e.z = Math.max(e.z, 1); e.vx = e.face * 170; sfx.jump(); },
    update: e => { if (e.actT > 0.28 && !e._pDive) { e._pDive = true; e.vz = -1080; } },
    onLand: e => { if (e.actT < 0.3) { e.vz = 0; return; } e._pDive = false; e.vx = 0; e.play('quake', true); e.act.dur = e.actT + 0.3; e.act.onLand = null;
      const x = e.x + e.face * 18; fxDust(x, e.y, 10, 34); fxShock(x, e.y, 170, '#ffe3a0'); sfx.boom(0.6);
      blast(e, x, e.y, 145, { dmg: skillDmg(2.7, 0.27, lv), launch: 380, knock: 120, hs: 0.075, downHit: true, snd: 'blunt' }, { zMax: 85 }); },
    onEnd: e => { e._pDive = false; } }) });
defSkill('p_tiger', { name: '虎袭', cls: 'priest', lvReq: 5, mp: 14, cd: 4, type: 'phys', col: '#d8b96a',
  desc: '沉肩向前冲撞，命中敌人后把目标击退。', pow: lv => skillDmg(2.35, 0.23, lv), ai: { kind: 'gap', r: [0, 180], dy: 28 },
  act: lv => ({ name: 'p_tiger', clip: 'dash', dur: 0.55, noCounter: true, move: [[0.04, 0.28, 360]],
    hits: [HB(0.08, 0.28, [0, 116, 36, 4, 98], skillDmg(2.35, 0.23, lv), { stun: 0.55, knock: 280, hs: 0.075, shake: 2, heavy: true, snd: 'blunt' })],
    events: [evAt(0.05, e => { fxAura(e, '#ffe3a0', 0.25); sfx.swing(true); })] }) });
defSkill('p_demonhand', { name: '恶魔之手', cls: 'priest', lvReq: 10, mp: 22, cd: 5, type: 'mag', elem: 'dark', col: '#9a6ac7',
  desc: '召唤暗属性恶魔之手攻击前方敌人。', pow: lv => skillDmg(2.9, 0.29, lv), ai: { kind: 'proj', r: [40, 300], dy: 32 },
  act: lv => ({ name: 'p_demonhand', clip: 'focus', dur: 0.52, noCounter: true,
    events: [evAt(0.12, e => { fxSpr('darkorb', e.x + e.face * 80, e.y, e.z + 54, { w: 150, dur: 0.3, flip: e.face < 0, col: '#9a6ac7', grow: [0.45, 1] }); sfx.swing(false);
      shootProj(e, { img: 'darkorb', col: '#9a6ac7', speed: 520, life: 0.7, w: 44, h: 48, bw: 28, bd: 24, bh: 70, hit: { dmg: skillDmg(2.9, 0.29, lv), knock: 120, stun: 0.45, hs: 0.06, elem: 'dark', col: '#b98ae8' } }); })] }) });
defSkill('p_holyball', { name: '圣光球', cls: 'priest', lvReq: 10, mp: 20, cd: 4, type: 'mag', elem: 'light', col: '#ffe993',
  desc: '向前发射光属性念气球，命中时发生小范围爆炸。', pow: lv => skillDmg(2.5, 0.25, lv), ai: { kind: 'proj', r: [50, 340], dy: 32 },
  act: lv => ({ name: 'p_holyball', clip: 'focus', dur: 0.46,
    events: [evAt(0.08, e => shootProj(e, { img: 'orb', col: '#ffe993', speed: 600, life: 0.65, w: 36, h: 36, bw: 22, bd: 20, bh: 44, hit: { dmg: skillDmg(2.5, 0.25, lv), knock: 95, stun: 0.35, hs: 0.05, elem: 'light', col: '#fff1b0' } }))] }) });
defSkill('p_heal', { name: '缓慢愈合', cls: 'priest', lvReq: 10, mp: 35, cd: 8, type: 'mag', buff: true, noHitCheck: true, col: '#8fe0b0',
  desc: '恢复自身生命值，并在短时间内持续回复。', pow: lv => skillDmg(0.9, 0.08, lv), infoExtra: lv => [['恢复生命', pct(skillDmg(0.9, 0.08, lv))]], ai: { kind: 'buff' },
  act: lv => ({ name: 'p_heal', clip: 'focus', dur: 0.58, noCounter: true,
    onStart: e => { const n = Math.round(e.hpMax * skillDmg(0.9, 0.08, lv) * 0.1); e.hp = Math.min(e.hpMax, e.hp + n); e.buffs.p_heal = { t: 5, heal: n / 5 }; fxAura(e, '#8fe0b0', 0.7); fxText('缓慢愈合', e.x, e.y, e.z + 20, { col: '#b8ffd2', size: 11 }); },
    onEnd: e => { const b = e.buffs.p_heal; if (b && b.t <= 0) delete e.buffs.p_heal; } }) });
defSkill('p_purify', { name: '净化', cls: 'priest', lvReq: 15, mp: 24, cd: 12, type: 'mag', buff: true, noHitCheck: true, col: '#bce7ff',
  desc: '解除自身的异常状态，并获得短暂的控制抗性。', pow: () => 0, ai: { kind: 'buff' },
  act: lv => ({ name: 'p_purify', clip: 'focus', dur: 0.46, noCounter: true,
    onStart: e => { if (e.status) for (const k of ['bleed', 'burn', 'poison', 'blind', 'curse', 'slow', 'stun']) delete e.status[k]; e.buffs.p_purify = { t: 2 + 0.2 * (lv - 1), noStatus: true }; fxAura(e, '#bce7ff', 0.55); fxText('净化', e.x, e.y, e.z + 20, { col: '#d7f4ff', size: 11 }); } }) });
defSkill('p_charge', { name: '正义冲撞', cls: 'priest', lvReq: 15, mp: 26, cd: 6, type: 'phys', col: '#e0b86a',
  desc: '向前冲锋并用武器猛击，击退沿途敌人。', pow: lv => skillDmg(3.2, 0.32, lv), ai: { kind: 'gap', r: [70, 340], dy: 30 },
  act: lv => ({ name: 'p_charge', clip: 'dash', dur: 0.62, noCounter: true, superArmor: [0.08, 0.5], move: [[0, 0.38, 620]],
    hits: [HB(0.06, 0.38, [0, 120, 38, 0, 110], skillDmg(3.2, 0.32, lv), { stun: 0.45, knock: 260, hs: 0.075, shake: 2, heavy: true, snd: 'blunt' })],
    events: [evAt(0.03, e => { fxStreak({ x: e.x, y: e.y, z: e.z + 54, face: e.face, len: 120, w: 12, col: '#ffe3a0' }); sfx.swing(true); })] }) });
defSkill('p_wheel', { name: '疾风打', cls: 'priest', lvReq: 15, mp: 30, cd: 7, type: 'phys', col: '#d8b86a',
  desc: '挥动武器连续攻击前方敌人，最后一击将其击飞。', pow: lv => skillDmg(0.62, 0.06, lv) * 5, ai: { kind: 'aoe', r: [0, 150], dy: 30 },
  act: lv => ({ name: 'p_wheel', clip: 'atk3', dur: 0.72, noCounter: true,
    hits: [HB(0.1, 0.62, [0, 112, 38, 0, 118], skillDmg(0.62, 0.06, lv), { rep: 0.12, max: 5, stun: 0.25, knock: 25, hs: 0.035, snd: 'blunt' }), HB(0.62, 0.7, [0, 124, 40, 0, 126], skillDmg(0.8, 0.08, lv), { knock: 240, launch: 300, hs: 0.08, heavy: true, snd: 'blunt' })],
    events: [evAt(0.08, e => { fxAura(e, '#ffe3a0', 0.25); sfx.swing(true); })] }) });
const priestGuardPhys = lv => Math.min(0.75, 0.38 + 0.04 * (lv - 1));
defSkill('p_guard', { name: '圣盾防御', cls: 'priest', lvReq: 15, mp: 8, cd: 3, type: 'phys', col: '#b7cbe4',
  desc: '举起盾牌或武器格挡正面攻击，持续期间可按方向调整位置。', pow: null, infoExtra: lv => [['物理伤害吸收', pct(priestGuardPhys(lv))]], ai: { kind: 'guard' },
  act: lv => ({ name: 'p_guard', clip: 'guard', dur: 2.4, noCounter: true, guard: priestGuardPhys(lv), guardMag: priestGuardPhys(lv) * 0.45, cancelFrom: 0.2,
    update: e => { e.vx = 0; if (e.actT > 0.22 && !e.pad.is(e.act.key || 'cmd')) e.endAct(); } }) });
defSkill('p_holycross', { name: '圣光十字', cls: 'priest', lvReq: 20, mp: 38, cd: 8, type: 'mag', elem: 'light', col: '#ffe993',
  desc: '在前方展开十字圣光，对范围内敌人造成光属性魔法伤害。', pow: lv => skillDmg(4.0, 0.4, lv), ai: { kind: 'aoe', r: [80, 280], dy: 34 },
  act: lv => ({ name: 'p_holycross', clip: 'focus', dur: 0.72, noCounter: true,
    events: [evAt(0.2, e => { const x = e.x + e.face * 95; fxSpr('crossx', x, e.y, 56, { w: 180, dur: 0.42, flip: e.face < 0, col: '#fff2ad', grow: [0.5, 1.1] }); fxShock(x, e.y, 140, '#fff2ad'); sfx.boom(0.5); blast(e, x, e.y, 140, { dmg: skillDmg(4.0, 0.4, lv), launch: 260, knock: 130, hs: 0.07, elem: 'light', col: '#fff2ad' }, { zMax: 150 }); })] }) });
defSkill('p_conversion', { name: '化魔', cls: 'priest', lvReq: 10, mp: 0, cd: 20, type: 'mag', buff: true, noHitCheck: true, col: '#83c8ef',
  desc: '消耗少量生命，转化为 MP。', pow: () => 0, ai: { kind: 'buff' },
  act: lv => ({ name: 'p_conversion', clip: 'focus', dur: 0.42, noCounter: true,
    onStart: e => { const hp = Math.max(1, Math.round(e.hpMax * Math.min(0.12, 0.06 + lv * 0.004))); const mp = Math.round(hp * (1.35 + lv * 0.04)); if (e.hp <= hp) return; e.hp -= hp; e.mp = Math.min(e.mpMax, e.mp + mp); fxAura(e, '#83c8ef', 0.48); fxText('化魔', e.x, e.y, e.z + 20, { col: '#a8e4ff', size: 11 }); } }) });

const PRIEST_BASE_SKILLS = ['p_upslash', 'p_jab', 'p_fallhammer', 'p_tiger', 'p_demonhand', 'p_holyball', 'p_heal', 'p_purify', 'p_charge', 'p_wheel', 'p_guard', 'p_holycross', 'p_conversion'];
defSkill('p_mastery', { name: '圣职者武器精通', cls: 'priest', lvReq: 1, maxLv: 10, sp: 15, mp: 0, cd: 0, passive: true, col: '#d8bc74',
  desc: '【被动】可以装备十字架、念珠、战斧、图腾和镰刀。技能等级开放后由各武器系统提供对应攻速与伤害修正。', pow: () => 0 });

CLASSES.priest = { name: '圣职者', ready: true, hp0: 1900, hpPer: 155, mp0: 760, mpPer: 45, atk0: 470, atkPer: 54, str0: 6, strPer: 2.0, int0: 4, intPer: 1.2, vit0: 6, vitPer: 2.0, spr0: 6, sprPer: 1.6, def0: 320, defPer: 30, crit: 0.06, speed: 155, runSpeed: 285,
  desc: '掌握神圣力量与重型武器的男圣职者。基础技能兼顾近战、光暗属性攻击与自我恢复，可转职为圣骑士、蓝拳圣使、驱魔师或复仇者。',
  model: () => buildSwordsman(PRIEST_PALETTE, { weapon: 'hammer', hair: 'short', hat: null, scarf: false, pauldron: true, coatTail: true }),
  acts: PRIEST_ACTS, slashCol: '#ffe3a0', dmgType: 'phys', airMax: 1, res: { light: 20, dark: -20 },
  weapons: PRIEST_WEAPON_TYPES, weaponNames: PRIEST_WEAPON_NAMES, startWeapon: 'cross', armor: 'heavy',
  skills: [...PRIEST_BASE_SKILLS, 'p_mastery'], start: ['p_upslash', 'p_jab'], bar: ['p_upslash', 'p_jab', 'p_demonhand', 'p_heal', ...Array(SKILL_SLOTS - 4).fill(null)],
  cmds: [['', 'p_upslash'], ['f', 'p_jab'], ['fd', 'p_fallhammer'], ['hold', 'p_tiger'], ['u', 'p_demonhand'], ['df', 'p_holyball'], ['f', 'p_heal', 'buff'], ['dd', 'p_purify', 'buff'], ['fu', 'p_charge'], ['bf', 'p_wheel'], ['holdd', 'p_guard'], ['uf', 'p_holycross'], ['b', 'p_conversion', 'buff']],
  jobs: {
    crusader: { name: '圣骑士', role: '辅助 / 审判', ready: false, skills: [], start: [], bar: [] },
    monk: { name: '蓝拳圣使', role: '近战 / 连击', ready: false, skills: [], start: [], bar: [] },
    exorcist: { name: '驱魔师', role: '物理或魔法 / 式神', ready: false, skills: [], start: [], bar: [] },
    avenger: { name: '复仇者', role: '暗属性 / 变身', ready: false, skills: [], start: [], bar: [] },
  }, passives: [] };
