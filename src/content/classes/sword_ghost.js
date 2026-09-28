/* =====================================================================
   转职：剑影（鬼剑士，jobId ghostblade）—— 国服现版对齐（docs/SKILLS_OFFICIAL_sword.md 第 7 节）
   濒死时被冤魂“幻鬼”附身、两个灵魂共存一体的剑士。物理百分比，只用太刀（本作不限制）。
   三大体系：
     剑术（本体出手）：鬼连击（+极）、鬼连牙、魂破斩、冥灵断魂斩；鬼步准备姿势中按剑术技能 = 换成该技能的收尾，伤害打在鬼步路径上的所有敌人
     幻鬼（幻鬼出手）：一闪、连击、回天；在剑术技能（和剑影形态的三段刃）施放中按下 = 无动作叠加
     共鸣（本体 + 幻鬼一起）：离魂一闪、鬼灵斩；同一个敌人只结算一次（hitGroup）；幻鬼已分离时在它自己的位置同步出招
   幻鬼 = 召唤框架的 follower（不可被攻击、半透明 0.82）；幻鬼步：瞬移到幻鬼的位置（移动中无敌，到达后再无敌 0.5 秒）
   ===================================================================== */
const GB_COL = '#8fd0ff', GB_DEEP = '#4a8ad8';
const gbJob = p => jobOf(p) === 'ghostblade';
const gbLv = (p, id) => (gbJob(p) ? skLv(p, id) : 0);
const GB_SWORD = new Set(['gb_chain', 'gb_fang', 'gb_break', 'gb_behead']);   // 剑术技能
let gbInSword = p => p.st === 'act' && !!p.act && (GB_SWORD.has(p.act.skill) || (p.act.skill === 'triple' && gbLv(p, 'gb_ghostman') > 0) || !!p.act.gbStep);
const gbPhantom = p => summonsOf(p, 'gb_phantom')[0] || null;
const gbPhantomBusy = p => { const s = gbPhantom(p); return !!(s && s.st === 'act' && s.act && !s.act.linger); };

/* ---- 幻鬼（独立精灵 art/final/spr/phantom，16 帧）---- */
const PHANTOM_ANIMS = {
  idle: [['pfloat', 0]], walk: [['pfloat', 0]], run: [['pdash1', 0]], pAppear: [['pappear', 0], ['pfloat', 0.22]], pVanish: [['pvanish', 0]],
  pDash: [['pdash1', 0], ['pdash2', 0.2]], pRend: [['prend1', 0], ['prend2', 0.1], ['prend1', 0.2], ['prend2', 0.3], ['prend3', 0.42]],
  pSpin: { fps: 10, frames: ['pspin1', 'pspin2'] }, pIai: [['piai1', 0], ['piai2', 0.32]], pDive: [['pdive1', 0], ['pdive2', 0.22]], pCross: [['pdash1', 0], ['pcross', 0.08]], pSeal: [['pseal', 0]],
};
let PHANTOM_CLIPS = null;
function phantomClips() {   // 逐帧精灵只需要片段名（__name）和时长；姿势用站姿占位
  if (PHANTOM_CLIPS) return PHANTOM_CLIPS;
  PHANTOM_CLIPS = {};
  for (const n in PHANTOM_ANIMS) { const A = PHANTOM_ANIMS[n]; const c = A.frames ? { dur: A.frames.length / A.fps, loop: true, keys: [k(0, POSE.idle)] } : { dur: A[A.length - 1][1] + 2, keys: [k(0, POSE.idle)] }; Object.defineProperty(c, '__name', { value: n }); PHANTOM_CLIPS[n] = c; }
  for (const n of ['hit', 'hit2', 'air', 'down', 'getup', 'held', 'jump']) PHANTOM_CLIPS[n] = PHANTOM_CLIPS.idle;
  return PHANTOM_CLIPS;
}
function phantomModel() {
  const m = new SpriteModel('phantom', { _: 'pfloat', idle: 'pfloat' }, PHANTOM_ANIMS), d0 = m.draw.bind(m);
  m.draw = (c, pose, t, opts) => { const g = c.globalAlpha; c.globalAlpha = g * 0.82; d0(c, pose, t, opts); c.globalAlpha = g; };   // 半透明（只改 globalAlpha，不用滤镜）
  return m;
}
defSummon('gb_phantom', { kind: 'follower', name: '幻鬼', tags: ['phantom'], max: 1, over: 'oldest', life: 2, keepRoom: false, speed: 0, w: 13, d: 12, h: 104, col: GB_COL, bundle: 'phantom',
  model: () => phantomModel(), clips: phantomClips(), type: 'phys',
  ai: s => { if (!s.act) { s.vx = s.vy = 0; s.setState('idle'); } },
  onSpawn: s => { fxSpr('ghost', s.x, s.y, 50, { w: 70, dur: 0.3, col: GB_COL, alpha: 0.6 }); s.retraceOk = true; },
  onEnd: (s, why) => { if (why !== 'owner' && why !== 'room') { fxSpr('ghost', s.x, s.y, 50, { w: 80, dur: 0.35, col: GB_COL, alpha: 0.5, grow: [1, 1.3] }); fxDust(s.x, s.y, 3, 12, '#9fb8d8'); } } });
// 让幻鬼出招：没有就在 (x, y) 现身；已分离就打断当前动作原地出招。出完停留 linger 秒（可以幻鬼步）后消失
function gbPhantomDo(p, lv, act, o = {}) {
  let s = gbPhantom(p);
  const x = o.x ?? (s ? s.x : p.x + p.face * 40), y = o.y ?? (s ? s.y : p.y);
  if (!s) { s = summon(p, 'gb_phantom', { x, y, lv, life: act.dur + (o.linger ?? 1) }); if (!s) return null; s.play('pAppear', true); }
  else { if (o.x !== undefined) s.warp(x, y); s.lifeT = 0; s.life = act.dur + (o.linger ?? 1); }
  s.face = o.face ?? p.face; s.retraceOk = true; s.lv = lv;
  summonAct(s, { ...act, onEnd: (e, intr) => { if (act.onEnd) act.onEnd(e, intr); if (!intr && !e.gone) e.doAct({ name: 'linger', clip: 'idle', dur: o.linger ?? 1, linger: true }); } });
  return s;
}

/* ---- 被动 ---- */
defSkill('gb_ghostman', { name: '鬼人化', cls: 'sword', job: 'ghostblade', lvReq: 15, maxLv: 1, mp: 0, cd: 0, type: 'phys', passive: true, col: '#7aa8d8',
  desc: '【被动】与幻鬼共存一体：普攻变为剑影专属的 4 段斩（第 4 段挑空），跑攻变为 2 段且之后可以直接接技能；鬼斩变为剑影形态（无属性）；三段刃更快更远，施放中可以叠加幻鬼技能；后跳中按 X 可以空中斩（冷却 2 秒）。' });
defSkill('gb_katana', { name: '剑影太刀精通', cls: 'sword', job: 'ghostblade', lvReq: 16, mp: 0, cd: 0, type: 'phys', passive: true, col: '#8ab0d8',
  desc: '【被动】精通太刀：攻击力、命中率提高。', infoExtra: lv => [['攻击力', '+' + pct(0.03 + 0.006 * lv)]] });
defSkill('gb_power', { name: '幻鬼之力', cls: 'sword', job: 'ghostblade', lvReq: 17, mp: 0, cd: 0, type: 'phys', passive: true, col: '#6ab8ff',
  desc: '【被动】借用幻鬼的力量：攻击速度、移动速度、物理暴击率、暴击伤害提高。', infoExtra: lv => [['攻速 / 移速', '+' + pct(0.02 + 0.004 * lv)], ['暴击率', '+' + pct(0.01 + 0.003 * lv)], ['暴击伤害', '+' + pct(0.02 + 0.005 * lv)]] });
defSkill('gb_chainex', { name: '鬼连击：极', cls: 'sword', job: 'ghostblade', lvReq: 18, maxLv: 1, mp: 0, cd: 0, type: 'phys', passive: true, col: '#9fd8ff',
  desc: '【被动】鬼连击的最后一击之后，召出第二把蓝色的灵魂刀追加 3 段交叉上斩（伤害随鬼连击等级）。' });
defSkill('gb_resonance', { name: '双魂共鸣', cls: 'sword', job: 'ghostblade', lvReq: 18, mp: 30, cd: 5, type: 'phys', buff: true, col: '#6aa8ff',
  desc: '【BUFF · 持续时间无限】本体与幻鬼的灵魂共鸣：普攻、鬼斩、三段刃和转职技能的攻击力提高。施放时霸体，后摇较长。', ai: { kind: 'buff', core: true },
  infoExtra: lv => [['攻击力', '+' + pct(0.2 + 0.02 * lv)]],
  act: (lv) => ({ name: 'gb_resonance', clip: 'focus', dur: 0.8, superArmor: true, noCounter: true, onStart: e => { e.buffs.gb_resonance = { t: 9999, dmg: 0.2 + 0.02 * lv }; sfx.buff(); fxAura(e, GB_COL, 1.2); gbPhantomDo(e, lv, { name: 'pRes', clip: 'pSeal', dur: 0.6 }, { x: e.x - e.face * 40, y: e.y, linger: 0.2 }); } }) });

/* ---- 鬼人化：普攻 4 段、跑攻 2 段、后跳中空中斩 ---- */
const SWORD_ACTS_GB = { ...SWORD_ACTS,
  atk1: { name: 'atk1', dur: 0.28, basic: true, speed: 'aspd', chain: [0.1, 0.28], next: 'atk2', move: [[0.02, 0.08, 120]], hits: [HB(0.05, 0.1, [0, 74, 28, 18, 100], 0.95, { stun: 0.3, knock: 45, hs: 0.05 })], events: [slashAt(0.04, { a0: -2.4, a1: 0.7, r: 56, w: 14, off: [14, 58], col: GB_COL })] },
  atk2: { name: 'atk2', dur: 0.28, basic: true, speed: 'aspd', chain: [0.1, 0.28], next: 'atk3', move: [[0.02, 0.08, 110]], hits: [HB(0.05, 0.1, [0, 74, 28, 18, 110], 1.0, { stun: 0.32, knock: 50, hs: 0.05 })], events: [slashAt(0.04, { a0: 1.0, a1: -2.1, r: 54, w: 14, off: [12, 56], col: GB_COL })] },
  atk3: { name: 'atk3', clip: 'rk1', dur: 0.3, basic: true, speed: 'aspd', chain: [0.12, 0.3], next: 'atk4', move: [[0.02, 0.1, 140]], hits: [HB(0.05, 0.12, [0, 80, 30, 10, 110], 1.1, { stun: 0.36, knock: 70, hs: 0.06 })], events: [slashAt(0.04, { a0: -2.6, a1: 0.5, r: 60, w: 16, off: [12, 56], col: GB_COL })] },
  atk4: { name: 'atk4', clip: 'rk3', dur: 0.56, basic: true, speed: 'aspd', move: [[0.04, 0.14, 100]], hits: [HB(0.08, 0.16, [0, 80, 30, 0, 130], 1.4, { launch: 240, knock: 40, hs: 0.08, heavy: true })], events: [slashAt(0.07, { a0: 1.4, a1: -1.9, r: 64, w: 20, off: [10, 50], col: GB_COL, heavy: true })] },
  dash: { ...SWORD_ACTS.dash, chain: [0.14, 0.45], next: 'dash2' },
  dash2: { name: 'dash2', clip: 'rk2', dur: 0.4, basic: true, speed: 'aspd', move: [[0.02, 0.12, 200]], hits: [HB(0.05, 0.14, [-10, 84, 30, 10, 110], 1.3, { knock: 200, stun: 0.5, hs: 0.07, heavy: true })], events: [slashAt(0.04, { a0: 0.8, a1: -2.4, r: 64, w: 18, off: [0, 55], col: GB_COL })] },
  back: { ...SWORD_ACTS.back, update: e => {
    if (e.actT > 0.04 && e.pad.buffered('attack') && !(e.cool.gb_airslash > 0)) { e.pad.consume('attack'); e.cool.gb_airslash = 2;
      e.doAct({ name: 'gb_airslash', clip: 'backslash', dur: 0.42, noCounter: true, lowGrav: 0.7, hits: [HB(0.05, 0.16, [-10, 76, 30, -40, 100], 1.4, { spike: 300, bounce: 0.4, knock: 50, hs: 0.07 })], events: [slashAt(0.04, { a0: -2.6, a1: 1.4, r: 64, w: 18, off: [12, 50], col: GB_COL })], onLand: x => x.endAct() }); return; }
    SWORD_ACTS.back.update(e);
  } },
};
SWORD_ACT_PICK.push(p => gbJob(p) && gbLv(p, 'gb_ghostman') ? SWORD_ACTS_GB : null);

/* ---- 鬼步：进入准备姿势（霸体，最多 3 秒）。按 X / Z 瞬间向前闪过（穿过敌人，路径上 3 段伤害）；按剑术技能 = 换成该技能的收尾，伤害打在路径上的所有敌人；C 取消 ---- */
const GB_STEP = 300;
function gbPath(p, x0, x1, fn) { const lo = Math.min(x0, x1) - 20, hi = Math.max(x0, x1) + 20; for (const t of ents) if (hittable(p, t) && t.x >= lo && t.x <= hi && Math.abs(t.y - p.y) < 40 && t.z < 140 && (t.st !== 'down')) fn(t); }
function gbDash(e, dist) {   // 肉眼不可见的速度前冲：直接位移，残影 + 刀光
  const R = game.room, x0 = e.x, x1 = R ? clamp(e.x + e.face * dist, R.x0 + e.w, R.x1 - e.w) : e.x + e.face * dist;
  fxAfterimage(e, GB_COL); fxStreak({ x: x0, y: e.y, z: e.z + 58, face: e.face, len: Math.abs(x1 - x0) + 40, w: 16, col: GB_COL, dur: 0.25 }); sfx.iai();
  e.x = x1; e.invul = Math.max(e.invul, 0.2); return [x0, x1];
}
// 鬼步收尾（剑术技能的鬼步形态）：瞬移 + 把该技能的全部伤害打在路径上的敌人 + 收尾动作
function gbStepFinish(lv, p, o) {
  return { name: 'gbStep_' + o.id, clip: o.clip || 'rk2', dur: o.dur || 0.5, noCounter: true, superArmor: true, gbStep: true,
    onStart: e => { const [x0, x1] = gbDash(e, GB_STEP); e.act.path = [x0, x1];
      game.after(0.08, () => { if (e.dead) return; cam.shake = Math.max(cam.shake, o.shake || 5); sfx.hit('crit', true);
        gbPath(e, x0, x1, t => { applyHit(e, t, { dmg: o.pow(lv), sure: true, hs: 0.1, big: 1.5, col: o.col || GB_COL, ...o.hit }, { proj: true }); fxSlashX(t.x, t.y, t.z + 50, 110, o.col || GB_COL); }); }); } };
}
const gbStepMode = p => !!(p._gbStepT && game.t - p._gbStepT < 0.1);
defSkill('gb_step', { name: '鬼步', cls: 'sword', job: 'ghostblade', lvReq: 15, mp: 15, cd: 6, type: 'phys', col: '#6aa0e0',
  desc: '进入鬼步的准备姿势（霸体，最多 3 秒）：按 X 或 Z 以肉眼看不见的速度向前闪过，对路径上的敌人造成 3 段伤害；按剑术技能（鬼连击、鬼连牙、魂破斩、冥灵断魂斩）则换成该技能的收尾，技能的全部伤害打在路径上的所有敌人身上。按跳跃键取消。',
  pow: lv => skillDmg(3.0, 0.3, lv), ai: { kind: 'gap', r: [60, 280], dy: 30 },
  act: (lv) => ({ name: 'gb_step', clip: 'hakuu', dur: 3, superArmor: true, noCounter: true,
    update: e => { e.vx = 0; e.vy = 0; if (Math.random() < 0.15) fxCharge(e, GB_COL); if (e.actT >= 2.95 && !e.act.fired) gbPlainStep(e, lv); },
    onInput: (e, I) => {
      if (e.actT < 0.08) return false;
      if (I.buffered('jump')) { I.consume('jump'); e.endAct(); return true; }
      const bar = barOf(e);
      for (let i = 0; i < bar.length; i++) if (bar[i] && GB_SWORD.has(bar[i]) && I.buffered('s' + i)) { I.consume('s' + i); e._gbStepT = game.t; if (castSkill(e, bar[i], false, 's' + i)) return true; }
      if (I.buffered('cmd')) { const C = CLASSES.sword;
        for (const [seq, sid, key] of C.cmds) if (GB_SWORD.has(sid) && !key && seq && cmdMatch(I, seq, e.face) && lvOf(e, sid) > 0) { I.consume('cmd'); e._gbStepT = game.t; if (castSkill(e, sid, true, 'cmd')) return true; } }
      if (I.buffered('attack') || I.buffered('cmd')) { I.consume('attack'); I.consume('cmd'); gbPlainStep(e, lv); return true; }
      return false;
    } }) });
function gbPlainStep(e, lv) {
  e.act.fired = true; const [x0, x1] = gbDash(e, GB_STEP);
  for (let i = 0; i < 3; i++) game.after(0.05 + i * 0.06, () => { if (e.dead) return; gbPath(e, x0, x1, t => applyHit(e, t, { dmg: skillDmg(1.0, 0.1, lv), sure: true, stun: 0.4, knock: i === 2 ? 120 : 10, hs: 0.04, col: GB_COL }, { proj: true })); if (i === 2) sfx.hit('crit', false); });
  e.doAct({ name: 'gb_step_end', clip: 'rk2', dur: 0.35, noCounter: true, skill: 'gb_step' });
}

/* ---- 幻鬼步：幻鬼分离在场时，瞬移到幻鬼的位置（移动中无敌，到达后再无敌 0.5 秒）。每只召出的幻鬼只能用一次 ---- */
defSkill('gb_retrace', { name: '幻鬼步', cls: 'sword', job: 'ghostblade', lvReq: 16, mp: 5, cd: 0, type: 'phys', buff: true, noForce: false, col: '#9fc8ff',
  desc: '幻鬼分离在场时，瞬间移动到幻鬼所在的位置（能穿过敌人和障碍），移动中无敌，到达后再无敌 0.5 秒。每一次召出幻鬼只能用一次；施放共鸣技能会重新获得一次机会。', ai: { kind: 'escape' },
  req: p => { const s = gbPhantom(p); return s && s.retraceOk ? true : '幻鬼不在场'; },
  act: () => ({ name: 'gb_retrace', clip: 'dash', dur: 0.2, noCounter: true, invul: [0, 0.2],
    onStart: e => { const s = gbPhantom(e); if (!s) return; s.retraceOk = false; fxAfterimage(e, GB_COL); fxStreak({ x: e.x, y: e.y, z: e.z + 58, face: Math.sign(s.x - e.x) || e.face, len: Math.abs(s.x - e.x) + 30, w: 12, col: GB_COL, dur: 0.2 });
      e.x = s.x; e.y = s.y; e.face = s.face; e.invul = Math.max(e.invul, 0.7); sfx.swing(true); } }) });

/* ---- 剑术 ---- */
defSkill('gb_chain', { name: '鬼连击', cls: 'sword', job: 'ghostblade', lvReq: 15, mp: 20, cd: 5, type: 'phys', col: '#7ab8ff',
  desc: '快速向前连斩 3 次。学了鬼连击：极，最后追加召出第二把蓝色灵魂刀的 3 段交叉上斩。【剑术】可以接在鬼步后面。', pow: lv => skillDmg(3.3, 0.33, lv), ai: { kind: 'gap', r: [0, 150], dy: 24 },
  act: (lv, p) => {
    if (gbStepMode(p)) return gbStepFinish(lv, p, { id: 'gb_chain', pow: l => skillDmg(3.3, 0.33, l) * (gbLv(p, 'gb_chainex') ? 1.6 : 1), clip: 'rk3' });
    const ex = gbLv(p, 'gb_chainex') > 0, T = ex ? 1.05 : 0.6;
    return { name: 'gb_chain', clip: 'rk1', dur: T, noCounter: true,
      events: [0, 1, 2].map(i => evAt(0.02 + i * 0.14, e => { e.play(['rk1', 'rk2', 'rk1'][i], true); e.vx = e.face * 380; sfx.swing(true); fxSlashOn(e, { col: GB_COL, a0: i % 2 ? 0.8 : -2.4, a1: i % 2 ? -2.4 : 0.8, r: 62, w: 16, off: [10, 56] });
        game.after(0.05, () => { if (e.dead) return; e.vx = 0; instantHit(e, { box: [-10, 80, 32, 10, 110], dmg: skillDmg(1.1, 0.11, lv), stun: 0.4, knock: i === 2 ? 150 : 40, hs: 0.05 }); }); })).concat(ex ? [0, 1, 2].map(i => evAt(0.5 + i * 0.13, e => {
        if (i === 0) e.play('rk3', true); sfx.swing(true); fxSlashOn(e, { col: '#4ab0ff', a0: 1.2, a1: -2.0, r: 70, w: 20, off: [10, 50] });
        instantHit(e, { box: [-10, 84, 34, 0, 150], dmg: skillDmg(0.7, 0.07, lv), launch: i === 2 ? 420 : 200, airLift: 260, knock: 20, hs: 0.05, col: '#6ac0ff' }); })) : []) };
  } });
defSkill('gb_fang', { name: '鬼连牙', cls: 'sword', job: 'ghostblade', lvReq: 17, mp: 30, cd: 8, type: 'phys', col: '#6aa0ff',
  desc: '聚魂强力突刺：硬直很大，把前方的敌人拉到剑尖前（能推动霸体的敌人，浮空和倒地的敌人会被强制拉起）。【剑术】接在鬼步后面时变为大范围拉怪。', pow: lv => skillDmg(4.0, 0.4, lv), ai: { kind: 'poke', r: [0, 180], dy: 26 },
  act: (lv, p) => {
    if (gbStepMode(p)) return gbStepFinish(lv, p, { id: 'gb_fang', pow: l => skillDmg(4.0, 0.4, l), clip: 'dash', hit: { stun: 0.8, knock: 0 }, shake: 4 });
    return { name: 'gb_fang', clip: 'dash', dur: 0.62, noCounter: true, move: [[0.08, 0.16, 300]],
      events: [evAt(0.04, e => sfx.charge()), evAt(0.14, e => { sfx.iai(); fxStreak({ x: e.x, y: e.y, z: e.z + 60, face: e.face, len: 200, w: 18, col: GB_COL, dur: 0.25 });
        const tipX = e.x + e.face * 70;
        for (const t of ents) if (hittable(e, t) && (t.x - e.x) * e.face > -10 && Math.abs(t.x - e.x) < 200 && Math.abs(t.y - e.y) < 34) {
          if (!t.boss) { t.x = tipX + e.face * 10; t.y = lerp(t.y, e.y, 0.5); }
          if (t.st === 'down' || t.st === 'air') { t.setState('hit'); t.z = 0; t.vz = 0; }
          applyHit(e, t, { dmg: skillDmg(4.0, 0.4, lv), stun: 1.2, knock: 10, hs: 0.12, big: 1.4, sure: true, throwHit: true, downHit: true }, { proj: false }); } })] };
  } });
defSkill('gb_break', { name: '魂破斩', cls: 'sword', job: 'ghostblade', lvReq: 19, mp: 40, cd: 12, type: 'phys', col: '#5a90e8',
  desc: '聚集灵魂之力，大力向下劈斩，把前方的敌人震飞。【剑术】可以接在鬼步后面。', pow: lv => skillDmg(6.0, 0.6, lv), ai: { kind: 'burst', r: [0, 120], dy: 26 },
  act: (lv, p) => {
    if (gbStepMode(p)) return gbStepFinish(lv, p, { id: 'gb_break', pow: l => skillDmg(6.0, 0.6, l), clip: 'a3slam', hit: { launch: 460, knock: 120 }, shake: 8 });
    return { name: 'gb_break', clip: 'a3slam', dur: 0.8, superArmor: [0, 0.5], noCounter: true, move: [[0.04, 0.14, 120]],
      events: [evAt(0.06, e => { sfx.charge(); fxCharge(e, GB_COL, 3); }), evAt(0.34, e => { const x = e.x + e.face * 70; cam.shake = Math.max(cam.shake, 8); sfx.boom(1);
        fxSlashOn(e, { col: GB_COL, a0: -2.8, a1: 1.2, r: 84, w: 26, off: [10, 56], heavy: true }); fxShock(x, e.y, 150, GB_COL); fxBurst(x, e.y, 30, 160, GB_COL);
        blast(e, x, e.y, 90, { dmg: skillDmg(6.0, 0.6, lv), launch: 480, knock: 160, hs: 0.12, big: 1.7, col: '#bfe8ff', downHit: true }, { zMax: 160 }); })] };
  } });
defSkill('gb_behead', { name: '冥灵断魂斩', cls: 'sword', job: 'ghostblade', lvReq: 20, mp: 60, cd: 45, type: 'phys', col: '#4a70d8',
  desc: '灵魂刀聚魂，先推开贴身的敌人，随后大幅度横斩：横向距离极长、纵深很窄，前摇较长。【剑术】接在鬼步后面时瞬间出手。', pow: lv => skillDmg(10.0, 1.0, lv), ai: { kind: 'burst', r: [0, 380], dy: 20 },
  act: (lv, p) => {
    if (gbStepMode(p)) return gbStepFinish(lv, p, { id: 'gb_behead', pow: l => skillDmg(10.0, 1.0, l), clip: 'iaiSpin', dur: 0.6, hit: { knock: 200, down: true, downHit: true }, shake: 9 });
    return { name: 'gb_behead', clip: 'iai', dur: 1.2, superArmor: true, noCounter: true,
      events: [evAt(0.1, e => { sfx.charge(); blast(e, e.x + e.face * 20, e.y, 60, { dmg: skillDmg(0.8, 0.08, lv), knock: 260, stun: 0.5, hs: 0.04 }, { zMax: 120 }); fxShock(e.x, e.y, 70, GB_COL); }),
        evAt(0.7, e => { cam.flash = 0.12; cam.flashCol = '#dff0ff'; cam.shake = Math.max(cam.shake, 8); sfx.iai(); sfx.boom(0.8);
          fxBeam(e.x, e.y, e.z + 60, 420, e.face, { col: '#bfe8ff', w: 34, dur: 0.35 }); fxSlashOn(e, { col: '#bfe8ff', a0: -2.9, a1: 0.4, r: 120, w: 26, off: [0, 56], squash: 0.3, dur: 0.3 });
          instantHit(e, { box: [0, 420, 22, 0, 130], dmg: skillDmg(9.2, 0.92, lv), knock: 200, down: true, hs: 0.14, big: 1.8, col: '#dff0ff', downHit: true }); })] };
  } });

/* ---- 幻鬼技能：剑术技能（和三段刃）施放中按下 = 无动作叠加；平时本体挥一下剑、幻鬼现身出招。上一个幻鬼技能没演完时放不出来 ---- */
function gbGhostSkill(id, o) {
  defSkill(id, { ...o, cls: 'sword', job: 'ghostblade', type: 'phys',
    req: p => gbPhantomBusy(p) ? '幻鬼还在出招' : (p.st === 'act' && p.act && p.act.skill && !p.act.basic && !gbInSword(p)) ? '施放中' : true,
    act: lv => ({ name: id, clip: 'rk1', dur: 0.3, noCounter: true }),   // 只给 AI 选技能用；实际施放走 instant
    instant: (lv, p, extra) => {
      const go = () => o.phantom(lv, p);
      if (gbInSword(p)) { go(); return; }
      p.doAct({ name: id, clip: 'rk1', dur: 0.32, noCounter: true, events: [evAt(0.06, e => { sfx.swing(false); fxSlashOn(e, { col: GB_COL, a0: -2.2, a1: 0.8, r: 52, w: 12, off: [10, 56] }); go(); })] }, extra);
    } });
}
gbGhostSkill('gb_issen', { name: '幻鬼：一闪', lvReq: 16, mp: 20, cd: 6, col: '#8ac8ff',
  desc: '本体挥剑，幻鬼向前突进约 450 像素斩穿路径上的敌人，之后停留约 1 秒（可以接幻鬼步快速横穿房间）。', pow: lv => skillDmg(3.0, 0.3, lv), ai: { kind: 'gap', r: [0, 300], dy: 26 },
  phantom: (lv, p) => gbPhantomDo(p, lv, { name: 'pIssen', clip: 'pDash', dur: 0.45, noCounter: true, move: [[0.02, 0.2, 2200]],
    hits: [HB(0.02, 0.22, [-30, 60, 30, 10, 110], skillDmg(3.0, 0.3, lv), { stun: 0.6, knock: 60, hs: 0.05, col: GB_COL })],
    events: [evAt(0.01, s => { fxStreak({ x: s.x, y: s.y, z: s.z + 58, face: s.face, len: 450, w: 16, col: GB_COL, dur: 0.3 }); sfx.iai(); })] }, { x: p.x, y: p.y }) });
gbGhostSkill('gb_rend', { name: '幻鬼：连击', lvReq: 17, mp: 25, cd: 8, col: '#7ab8ff',
  desc: '幻鬼在身前现身，原地快速连斩 4 次，最后一击把敌人挑上空中。', pow: lv => skillDmg(4.0, 0.4, lv), ai: { kind: 'launch', r: [0, 110], dy: 24 },
  phantom: (lv, p) => gbPhantomDo(p, lv, { name: 'pRend', clip: 'pRend', dur: 0.62, noCounter: true,
    hits: [HB(0.02, 0.36, [-10, 78, 32, 10, 120], skillDmg(0.93, 0.093, lv), { rep: 0.12, max: 3, stun: 0.4, knock: 10, hs: 0.04, col: GB_COL }),
      HB(0.44, 0.52, [-10, 82, 34, 0, 140], skillDmg(1.2, 0.12, lv), { launch: 460, knock: 40, hs: 0.08, col: GB_COL })],
    events: [0.02, 0.14, 0.26, 0.44].map((t, i) => evAt(t, s => { fxSlash({ x: s.x, y: s.y, z: s.z, face: s.face, col: GB_COL, a0: i % 2 ? 0.8 : -2.4, a1: i % 2 ? -2.4 : 0.8, r: 60, w: 14, off: [10, 56] }); sfx.swing(i === 3); })) }, { x: p.x + p.face * 70, y: p.y }) });
gbGhostSkill('gb_kaiten', { name: '幻鬼：回天', lvReq: 19, mp: 45, cd: 20, col: '#5aa0f0',
  desc: '幻鬼边前进边旋转，大幅斩击 2 次，纵深范围很大。', pow: lv => skillDmg(6.0, 0.6, lv), ai: { kind: 'aoe', r: [0, 200], dy: 60 },
  phantom: (lv, p) => gbPhantomDo(p, lv, { name: 'pKaiten', clip: 'pSpin', dur: 0.9, noCounter: true, move: [[0, 0.8, 220]],
    hits: [HB(0.05, 0.4, [-70, 90, 70, 0, 130], skillDmg(3.0, 0.3, lv), { stun: 0.7, knock: 30, hs: 0.07, col: GB_COL }), HB(0.43, 0.8, [-70, 90, 70, 0, 150], skillDmg(3.0, 0.3, lv), { launch: 300, knock: 80, hs: 0.08, col: GB_COL })],
    events: [0.05, 0.43].map(t => evAt(t, s => { fxSlash({ x: s.x, y: s.y, z: s.z, face: s.face, col: GB_COL, a0: -3.1, a1: 3.1, r: 96, w: 20, off: [0, 50], squash: 0.45, dur: 0.3 }); sfx.swing(true); })) }, { x: p.x + p.face * 40, y: p.y }) });

/* ---- 共鸣技能：本体 + 幻鬼一起出手（同一目标只结算一次）；幻鬼已分离时在它自己的位置同步出招；重新获得一次幻鬼步 ---- */
defSkill('gb_riko', { name: '共鸣：离魂一闪', cls: 'sword', job: 'ghostblade', lvReq: 18, mp: 40, cd: 12, type: 'phys', col: '#9ad8ff',
  desc: '幻鬼向前突进约 400 像素斩击，随后与本体交叉互斩，两者交换横向位置，夹在中间的敌人受到伤害。幻鬼已经分离在场时，立刻与它交叉斩（距离不限）。【共鸣】', pow: lv => skillDmg(6.0, 0.6, lv), ai: { kind: 'gap', r: [0, 400], dy: 30 },
  act: (lv) => ({ name: 'gb_riko', clip: 'hakuu', dur: 0.8, superArmor: true, noCounter: true,
    onStart: e => { const G = hitGroup(); e.act.hitGroup = G; let s = gbPhantom(e);
      const cross = (s) => { const px = e.x, sx0 = s.x; fxStreak({ x: px, y: e.y, z: e.z + 58, face: Math.sign(sx0 - px) || e.face, len: Math.abs(sx0 - px), w: 18, col: GB_COL, dur: 0.3 }); sfx.iai(); cam.shake = Math.max(cam.shake, 6);
        const lo = Math.min(px, sx0), hi = Math.max(px, sx0); for (const t of ents) if (hittable(e, t) && t.x >= lo - 20 && t.x <= hi + 20 && Math.abs(t.y - e.y) < 50) { const l = G.last.get(t.id); if (l !== undefined) continue; G.last.set(t.id, game.t); applyHit(e, t, { dmg: skillDmg(6.0, 0.6, lv), sure: true, stun: 0.8, knock: 80, launch: 260, hs: 0.1, big: 1.5, col: '#bfe8ff' }, { proj: true }); fxSlashX(t.x, t.y, t.z + 50, 120, GB_COL); }
        e.x = sx0; s.warp(px, s.y); s.face = -s.face; e.face = -Math.sign(px - sx0) || e.face; s.retraceOk = true; e.invul = Math.max(e.invul, 0.3); };
      if (s) { s.face = Math.sign(e.x - s.x) || -e.face; summonAct(s, { name: 'pCross', clip: 'pCross', dur: 0.5 }); cross(s); return; }
      s = gbPhantomDo(e, lv, { name: 'pRikoDash', clip: 'pDash', dur: 0.4, move: [[0, 0.2, 2000]], hitGroup: G, hits: [HB(0.02, 0.22, [-30, 60, 30, 10, 110], skillDmg(1.5, 0.15, lv), { stun: 0.5, knock: 20, hs: 0.04 })] }, { x: e.x, y: e.y });
      if (s) game.after(0.3, () => { if (!e.dead && !s.gone) cross(s); }); } }) });
defSkill('gb_ghostslash', { name: '共鸣：鬼灵斩', cls: 'sword', job: 'ghostblade', lvReq: 19, mp: 50, cd: 15, type: 'phys', col: '#6ab0ff',
  desc: '与幻鬼一起拔刀，大范围斩击（全程霸体）。幻鬼已经分离在场时，它在自己的位置面向本体同步出斩，范围随之扩大。同一个敌人只结算一次。【共鸣】', pow: lv => skillDmg(7.5, 0.75, lv), ai: { kind: 'burst', r: [0, 200], dy: 40 },
  act: (lv) => ({ name: 'gb_ghostslash', clip: 'iai', dur: 0.95, superArmor: true, noCounter: true,
    onStart: e => { const G = e.act.hitGroup = hitGroup(); let s = gbPhantom(e); const sep = !!s;
      const pact = { name: 'pIai', clip: 'pIai', dur: 0.7, noCounter: true, hitGroup: G, hits: [HB(0.36, 0.44, [-40, 190, 40, 0, 140], skillDmg(7.5, 0.75, lv), { knock: 180, stun: 0.8, hs: 0.1, big: 1.6, col: GB_COL, down: true })],
        events: [evAt(0.36, s2 => { fxSlash({ x: s2.x, y: s2.y, z: s2.z, face: s2.face, col: GB_COL, a0: -3.0, a1: 1.0, r: 110, w: 26, off: [0, 56], squash: 0.5, dur: 0.3 }); })] };
      if (sep) { s.face = Math.sign(e.x - s.x) || -e.face; summonAct(s, pact); s.lifeT = 0; s.life = 1.8; s.retraceOk = true; }
      else gbPhantomDo(e, lv, pact, { x: e.x - e.face * 30, y: e.y + 6 }); },
    hits: [HB(0.4, 0.48, [-40, 190, 40, 0, 140], skillDmg(7.5, 0.75, lv), { knock: 180, stun: 0.8, hs: 0.1, big: 1.6, col: '#bfe8ff', down: true })],
    events: [evAt(0.02, e => sfx.charge()), evAt(0.4, e => { cam.flash = 0.1; cam.flashCol = '#dff0ff'; cam.shake = Math.max(cam.shake, 7); sfx.iai(); fxSlashOn(e, { col: '#bfe8ff', a0: -3.0, a1: 1.0, r: 110, w: 26, off: [0, 56], squash: 0.5, dur: 0.3 }); })] }) });

/* ---- 一觉：冥夜鬼天杀。施放时无敌；画面变暗，幻鬼在前方现身，两人大幅交叉斩 4 次（双方都双持）---- */
defSkill('gb_awaken', { name: '冥夜鬼天杀', cls: 'sword', job: 'ghostblade', lvReq: 21, maxLv: 3, mp: 150, cd: 135, pvp: 0.45, type: 'phys', awaken: true, col: '#3a6ad8',
  desc: '【觉醒】夜刀神摆出架势，四周陷入黑暗，幻鬼在前方现身，两人以双刀大幅交叉斩击 4 次，把范围内的敌人斩裂。施放中无敌。', pow: lv => skillDmg(22, 6, lv), ai: { kind: 'awaken', r: [0, 300], dy: 90 },
  act: (lv) => ({ name: 'gb_awaken', clip: 'hakuu', dur: 2.3, superArmor: true, noCounter: true, invul: [0, 2.3],
    onStart: e => { game.cutin = { t: 0, dur: 1.0, name: '冥夜鬼天杀', who: cutinWho(e) }; game.timeStop = 0.9; sfx.awaken(); const a = e.act; a.cx = e.x + e.face * 150; a.cy = e.y; a.G = hitGroup(0.2);
      gbPhantomDo(e, lv, { name: 'pAwk', clip: 'pSeal', dur: 1.4 }, { x: e.x + e.face * 300, y: e.y, face: -e.face, linger: 0.2 }); },
    events: [0, 1, 2, 3].map(i => evAt(0.95 + i * 0.28, e => { const a = e.act, s = gbPhantom(e);
      e.play(['dual1', 'dual3', 'dual2', 'dual4'][i], true); if (s) s.play(i % 2 ? 'pCross' : 'pDash', true);
      cam.shake = Math.max(cam.shake, 6 + i); sfx.iai(); cam.flash = 0.08; cam.flashCol = '#bfe0ff';
      fxSlashX(a.cx + rnd(-40, 40), a.cy + rnd(-10, 10), 70, 180 + i * 20, i % 2 ? '#bfe8ff' : '#6aa8ff');
      blast(e, a.cx, a.cy, 170, { dmg: skillDmg(i === 3 ? 10 : 4, i === 3 ? 3 : 1, lv), stun: 0.8, knock: i === 3 ? 200 : 10, launch: i === 3 ? 480 : 0, hs: 0.1, big: 1.8, sure: true, downHit: true, col: '#bfe8ff' }, { zMax: 260 }); }))
      .concat([evAt(0.9, e => { const a = e.act; fxShock(a.cx, a.cy, 260, GB_DEEP); })]) }) });

/* ---- 剑影形态的鬼斩（无属性）和三段刃（更快更远，施放中可以叠加幻鬼技能）---- */
{
  const G = SKILLS.ghost, act0 = G.act;
  G.act = (lv, p) => { const a = act0(lv, p); if (p && gbJob(p) && gbLv(p, 'gb_ghostman')) { const s0 = a.onStart; a.onStart = e => { e.act.elem = null; if (s0) s0(e); }; } return a; };
  const Tr = SKILLS.triple, t0 = Tr.act;
  Tr.act = (lv, p) => { const a = t0(lv, p); if (p && gbJob(p) && gbLv(p, 'gb_ghostman')) { a.move = [[0, 0.16, 700]]; a.dur = 0.3; } return a; };
}

/* =====================================================================
   剑影 P1（官方 48–100 级 → 本作 21–30 级）：鬼夜、幻鬼：奈落、共鸣：聚渊、鬼咲（二觉被动）、幻鬼：大回天、裂魂乱舞、
   鬼隐·夜奈落（二觉）、睥睨万物、无式·极影剑、灭魂极影剑·止煞（三觉）
   ===================================================================== */
defSkill('gb_yaksha', { name: '鬼夜', cls: 'sword', job: 'ghostblade', lvReq: 21, mp: 0, cd: 0, type: 'phys', passive: true, col: '#4a6ab0',
  desc: '【被动 · 一觉】被称为夜刀神的冷酷剑意：攻击力和物理暴击率提高。', infoExtra: lv => [['攻击力', '+' + pct(0.04 + 0.008 * lv)], ['物理暴击率', '+' + pct(0.02 + 0.003 * lv)]] });
defSkill('gb_bloom', { name: '鬼咲', cls: 'sword', job: 'ghostblade', lvReq: 26, maxLv: 1, mp: 0, cd: 0, type: 'phys', passive: true, col: '#6a8ae0',
  desc: '【被动 · 二觉】恶鬼现身：攻击力提高；三段刃、鬼步冷却减少 1 秒；普攻、跑攻、后跳中也能无动作叠加幻鬼技能；站立被击时也能施放幻鬼技能和幻鬼步。' });
defSkill('gb_scorn', { name: '睥睨万物', cls: 'sword', job: 'ghostblade', lvReq: 29, mp: 0, cd: 0, type: 'phys', passive: true, col: '#8ab0ff',
  desc: '【被动 · 三觉】恶鬼无双：技能攻击力提高；浮空被击或倒地时也能用幻鬼步（另有 7 秒冷却）；幻鬼：连击的范围和速度提高 15%，并追加一段收尾斩。', infoExtra: lv => [['技能攻击力', '+' + pct(0.06 + 0.012 * lv)]] });

/* ---- 幻鬼：奈落：幻鬼出现在 800 像素内最强敌人的头顶，向下劈砸（单段） ---- */
gbGhostSkill('gb_naraku', { name: '幻鬼：奈落', lvReq: 23, mp: 60, cd: 20, col: '#5a80e0',
  desc: '幻鬼出现在 800 像素内最强的敌人头顶，向下劈砸（单段高伤害）。之后可以用幻鬼步追过去。', pow: lv => skillDmg(12, 1.2, lv), ai: { kind: 'burst', r: [0, 600], dy: 90 },
  phantom: (lv, p) => { const val = t => (t.boss ? 2e12 : t.elite ? 1e12 : 0) + t.hp, L = ents.filter(t => hittable(p, t) && Math.abs(t.x - p.x) < 800), t = L.sort((a, b) => val(b) - val(a))[0];
    const x = t ? t.x - p.face * 20 : p.x + p.face * 200, y = t ? t.y : p.y;
    const s = gbPhantomDo(p, lv, { name: 'pNaraku', clip: 'pDive', dur: 0.6, noCounter: true,
      events: [evAt(0.22, s2 => { s2.z = 0; cam.shake = Math.max(cam.shake, 8); sfx.boom(1); fxShock(s2.x, s2.y, 150, GB_COL); fxSpr('swordrain', s2.x, s2.y, 0, { h: 220, dur: 0.4, ay: 1, col: GB_COL });
        for (const e of ents) if (hittable(p, e) && Math.abs(e.x - s2.x) < 90 && Math.abs(e.y - s2.y) < 50) applyHit(p, e, { dmg: skillDmg(12, 1.2, lv), down: true, knock: 60, hs: 0.14, big: 1.8, sure: true, col: '#bfe8ff', downHit: true }, { proj: true }); })] }, { x, y });
    if (s) { s.z = 220; s.vz = -900; } } });

/* ---- 共鸣：聚渊：幻鬼向前冲斩，贴封印符把敌人定住后消失 → 本体掷出灵魂刀吸取鬼气把敌人吸拢 → 和幻鬼一起收尾；控制成功时直到最后都无敌 ---- */
defSkill('gb_abyss', { name: '共鸣：聚渊', cls: 'sword', job: 'ghostblade', lvReq: 25, mp: 80, cd: 50, type: 'phys', col: '#4a7ad8',
  desc: '幻鬼向前冲斩，贴上封印符把敌人定住后消失；本体掷出灵魂刀，吸取鬼气把敌人吸拢，最后和幻鬼一起收尾斩。控制成功时直到最后一斩都无敌。【共鸣】', pow: lv => skillDmg(18, 1.8, lv), ai: { kind: 'aoe', r: [0, 360], dy: 60 },
  act: (lv) => ({ name: 'gb_abyss', clip: 'asOrb', dur: 1.9, superArmor: true, noCounter: true,
    onStart: e => { const a = e.act; a.G = hitGroup(0.15); a.vic = [];
      const s = gbPhantomDo(e, lv, { name: 'pSeal', clip: 'pDash', dur: 0.5, move: [[0, 0.2, 1800]], hitGroup: a.G,
        hits: [HB(0.02, 0.22, [-30, 60, 40, 10, 120], skillDmg(3, 0.3, lv), { stun: 0.6, knock: 0, hs: 0.05, col: GB_COL, onHit: (x, t) => { addStatus(t, 'root', 1.8, { src: e }); if (a.vic) a.vic.push(t); } })] }, { x: e.x, y: e.y }); },
    events: [evAt(0.55, e => { const a = e.act; if (a.vic.length) e.invul = Math.max(e.invul, 1.4); e.play('asOrb', true); sfx.swing(true);
        const cx = a.vic.length ? a.vic.reduce((s, t) => s + t.x, 0) / a.vic.length : e.x + e.face * 220, cy = a.vic.length ? a.vic[0].y : e.y; a.cx = cx; a.cy = cy;
        fxStreak({ x: e.x, y: e.y, z: e.z + 60, face: Math.sign(cx - e.x) || e.face, len: Math.abs(cx - e.x), w: 10, col: '#6ab0ff', dur: 0.2 });
        addFx({ x: cx, y: cy, z: 60, dur: 0.9, draw(c) { drawSpr(c, fxTint('vortex', '#4a8aff'), sx(cx), sy(cy, 60), 160, 0, { rot: this.t * 10, alpha: 0.8 }); } }); }),
      evAt(0.6, e => { const a = e.act; for (let i = 0; i < 8; i++) game.after(i * 0.08, () => { for (const t of ents) if (hittable(e, t) && !t.boss && Math.hypot(t.x - a.cx, (t.y - a.cy) * 1.5) < 220) { t.x = lerp(t.x, a.cx, 0.3); t.y = lerp(t.y, a.cy, 0.3);
        if (i % 2 === 0) applyHit(e, t, { dmg: skillDmg(0.8, 0.08, lv), stun: 0.5, knock: 0, hs: 0.02, sure: true, col: '#8fc8ff' }, { proj: true }); } }); }),
      evAt(1.3, e => { const a = e.act; const s = gbPhantom(e); if (s) { s.warp(a.cx - e.face * 60, a.cy); s.face = e.face; summonAct(s, { name: 'pCrossF', clip: 'pCross', dur: 0.4 }); }
        e.x = a.cx + e.face * 60 * -1 - e.face * 40; e.play('iaiSpin', true); cam.flash = 0.2; cam.flashCol = '#dff0ff'; cam.shake = 12; sfx.iai(); sfx.boom(1.2);
        fxSlashX(a.cx, a.cy, 60, 240, '#bfe8ff'); blast(e, a.cx, a.cy, 170, { dmg: skillDmg(12, 1.2, lv), launch: 460, knock: 120, hs: 0.16, big: 2, sure: true, downHit: true, col: '#dff0ff' }, { zMax: 280 }); })] }) });

/* ---- 幻鬼：大回天：幻鬼高速旋转前进，多段攻击，把命中的敌人拉到同一条横线上 ---- */
gbGhostSkill('gb_shinpu', { name: '幻鬼：大回天', lvReq: 26, mp: 80, cd: 40, col: '#6aa8ff',
  desc: '幻鬼高速旋转着向前推进，多段攻击，把命中的敌人都拉到同一条横线上（方便后续连段）。', pow: lv => skillDmg(16, 1.6, lv), ai: { kind: 'aoe', r: [0, 320], dy: 80 },
  phantom: (lv, p) => gbPhantomDo(p, lv, { name: 'pShinpu', clip: 'pSpin', dur: 1.1, noCounter: true, move: [[0, 1.0, 300]],
    update: s => { for (const t of ents) if (hittable(p, t) && !t.boss && Math.abs(t.x - s.x) < 90 && Math.abs(t.y - s.y) < 90) { t.y = damp(t.y, s.y, 8, 1 / 60); t.x = damp(t.x, s.x + s.face * 30, 4, 1 / 60); } },
    hits: [HB(0.05, 1.0, [-80, 90, 80, 0, 140], skillDmg(2.2, 0.22, lv), { rep: 0.14, max: 7, stun: 0.5, knock: 20, hs: 0.03, col: GB_COL })],
    events: Array.from({ length: 7 }, (_, i) => evAt(0.05 + i * 0.14, s => { fxSlash({ x: s.x, y: s.y, z: s.z, face: s.face, col: GB_COL, a0: -3.1, a1: 3.1, r: 100, w: 20, off: [0, 50], squash: 0.45, dur: 0.2 }); if (i % 2 === 0) sfx.swing(true); })) }, { x: p.x + p.face * 30, y: p.y }) });

/* ---- 裂魂乱舞：连斩 3 次 → 灵魂刀合体大回旋 2 次 → 终结（共 6 段）；按住 ← 原地施放；接在鬼步后面瞬间出手 ---- */
defSkill('gb_dance', { name: '裂魂乱舞', cls: 'sword', job: 'ghostblade', lvReq: 26, mp: 100, cd: 45, type: 'phys', col: '#4a90ff',
  desc: '连续斩击 3 次，随后与灵魂刀合体大回旋 2 次，最后一记终结斩（共 6 段）。按住 ← 原地施放。【剑术】接在鬼步后面时瞬间出手。', pow: lv => skillDmg(20, 2, lv), ai: { kind: 'burst', r: [0, 160], dy: 40 },
  act: (lv, p) => {
    if (gbStepMode(p)) return gbStepFinish(lv, p, { id: 'gb_dance', pow: l => skillDmg(20, 2, l), clip: 'iaiSpin', dur: 0.6, hit: { launch: 380, knock: 120 }, shake: 10 });
    const still = p && p.pad.dx() * p.face < 0;
    return { name: 'gb_dance', clip: 'rk1', dur: 2.2, superArmor: true, noCounter: true,
      events: [...[0.05, 0.3, 0.55].map((t, i) => evAt(t, e => { e.play(['rk1', 'rk2', 'rk3'][i], true); if (!still) e.vx = e.face * 300; sfx.swing(true); fxSlashOn(e, { col: GB_COL, a0: i % 2 ? 0.8 : -2.4, a1: i % 2 ? -2.4 : 0.8, r: 72, w: 20, off: [10, 56] });
          game.after(0.06, () => { e.vx = 0; instantHit(e, { box: [-10, 96, 36, 0, 130], dmg: skillDmg(2.4, 0.24, lv), stun: 0.6, knock: 30, hs: 0.06, sure: true }); }); })),
        ...[0.9, 1.3].map(t => evAt(t, e => { e.play('iaiSpin', true); sfx.iai(); fxSlashOn(e, { col: '#6ac0ff', a0: -3.1, a1: 3.1, r: 130, w: 30, off: [0, 50], squash: 0.45, dur: 0.3 });
          instantHit(e, { box: [-120, 140, 60, 0, 150], dmg: skillDmg(3.6, 0.36, lv), stun: 0.7, knock: 20, hs: 0.08, sure: true, col: '#bfe8ff' }); })),
        evAt(1.8, e => { e.play('rk4', true); cam.shake = 12; sfx.boom(1.2); sfx.iai(); fxSlashX(e.x + e.face * 70, e.y, 60, 240, '#bfe8ff');
          instantHit(e, { box: [-20, 150, 50, 0, 160], dmg: skillDmg(6, 0.6, lv), launch: 460, knock: 160, hs: 0.16, big: 2, sure: true, downHit: true, col: '#dff0ff' }); })] };
  } });
GB_SWORD.add('gb_dance');

/* ---- 无式·极影剑：直接施放 = 共鸣形态（本体和幻鬼一起 5 连斩 + 收尾）；普攻 / 剑术中施放 = 幻鬼形态（只有幻鬼出手，瞬发）；鬼步中施放 = 剑术形态（鬼步收尾）---- */
defSkill('gb_mushiki', { name: '无式·极影剑', cls: 'sword', job: 'ghostblade', lvReq: 29, mp: 120, cd: 60, type: 'phys', col: '#8ad0ff',
  desc: '三种形态：直接施放 = 共鸣形态，本体和幻鬼一起 5 连斩再收尾；在普攻或剑术技能中施放 = 幻鬼形态，只有幻鬼出手（不打断当前动作，伤害略低）；在鬼步中施放 = 剑术形态，换成鬼步的收尾瞬间出手。', pow: lv => skillDmg(26, 2.6, lv), ai: { kind: 'burst', r: [0, 200], dy: 50 },
  act: lv => ({ name: 'gb_mushiki', clip: 'rk1', dur: 0.3, noCounter: true }),   // 只给 AI 选技能用；实际施放走 instant
  instant: (lv, p, extra) => {
    if (p.st === 'act' && p.act && p.act.skill === 'gb_step') { p._gbStepT = game.t; p.doAct(gbStepFinish(lv, p, { id: 'gb_mushiki', pow: l => skillDmg(26, 2.6, l), clip: 'iaiSpin', dur: 0.6, hit: { launch: 400, knock: 160 }, shake: 12 }), extra); return; }
    const phantomOnly = p.st === 'act' && p.act && (p.act.basic || gbInSword(p));
    const pact = { name: 'pMushiki', clip: 'pRend', dur: 1.0, noCounter: true, hits: [HB(0.02, 0.6, [-20, 96, 40, 0, 140], skillDmg(3.5, 0.35, lv) * (phantomOnly ? 0.84 : 1), { rep: 0.12, max: 5, stun: 0.5, knock: 10, hs: 0.04, col: GB_COL }),
      HB(0.7, 0.78, [-20, 110, 44, 0, 160], skillDmg(8, 0.8, lv) * (phantomOnly ? 0.84 : 1), { launch: 440, knock: 160, hs: 0.12, big: 1.8, col: '#dff0ff' })] };
    if (phantomOnly) { gbPhantomDo(p, lv, pact, { x: p.x + p.face * 50, y: p.y }); return; }
    const G = hitGroup(0.11); pact.hitGroup = G; pact.hits = pact.hits.slice(1);   // 共鸣形态：5 连斩由本体结算（幻鬼的斩击只做表现），收尾两人合击只算一次 gbPhantomDo(p, lv, pact, { x: p.x + p.face * 50, y: p.y + 8 });
    p.doAct({ name: 'gb_mushiki', clip: 'rk1', dur: 1.1, superArmor: true, noCounter: true, hitGroup: G,
      hits: [HB(0.02, 0.6, [-20, 96, 40, 0, 140], skillDmg(3.5, 0.35, lv), { rep: 0.12, max: 5, stun: 0.5, knock: 10, hs: 0.04 }), HB(0.7, 0.78, [-20, 110, 44, 0, 160], skillDmg(8, 0.8, lv), { launch: 440, knock: 160, hs: 0.12, big: 1.8, col: '#dff0ff' })],
      events: [...[0.02, 0.14, 0.26, 0.38, 0.5].map((t, i) => evAt(t, e => { e.play(i % 2 ? 'rk2' : 'rk1', true); fxSlashOn(e, { col: GB_COL, a0: i % 2 ? 0.8 : -2.4, a1: i % 2 ? -2.4 : 0.8, r: 70, w: 18, off: [10, 56] }); sfx.swing(i === 4); })),
        evAt(0.7, e => { e.play('iaiSpin', true); cam.shake = 10; sfx.iai(); fxSlashX(e.x + e.face * 60, e.y, 60, 220, '#dff0ff'); })] }, extra);
  } });

/* ---- 鬼隐·夜奈落（二觉）：两人化烟消失、画面变暗；幻鬼在 600 像素内最强的敌人头顶现身下劈，命中的敌人被定住；两次斜斩；最后交叉斩并解除控制。全程无敌 ---- */
defSkill('gb_awaken2', { name: '鬼隐·夜奈落', cls: 'sword', job: 'ghostblade', lvReq: 27, maxLv: 3, mp: 180, cd: 170, pvp: 0.45, type: 'phys', awaken: true, col: '#2a4a9a',
  desc: '【二觉】本体与幻鬼化烟消失，四周陷入黑暗；幻鬼在 600 像素内最强的敌人头顶现身下劈，命中的敌人被定住；随后两人两次斜斩，最后交叉斩并解除控制。全程无敌。', pow: lv => skillDmg(34, 9, lv), ai: { kind: 'awaken', r: [0, 500], dy: 90 },
  act: (lv) => ({ name: 'gb_awaken2', clip: 'hakuu', dur: 3.0, superArmor: true, noCounter: true, invul: [0, 3.0],
    onStart: e => { game.cutin = { t: 0, dur: 1.0, name: '鬼隐·夜奈落', who: cutinWho(e) }; game.timeStop = 0.9; sfx.awaken();
      const val = t => (t.boss ? 2e12 : t.elite ? 1e12 : 0) + t.hp, L = ents.filter(t => hittable(e, t) && Math.abs(t.x - e.x) < 600), T = L.sort((a, b) => val(b) - val(a))[0];
      e.act.cx = T ? T.x : e.x + e.face * 200; e.act.cy = T ? T.y : e.y;
      addFx({ x: e.x, y: -10, z: 0, dur: 3.0, draw(c) { const k = this.t, al = Math.min(1, (k - 0.9) * 3) * Math.min(1, (3 - k) * 3); if (al <= 0) return; c.save(); c.globalAlpha = 0.62 * al; c.fillStyle = '#02030c'; c.fillRect(0, 0, WW, WH); c.restore(); } }); },
    events: [evAt(0.95, e => { const a = e.act; fxSpr('ghost', e.x, e.y, 50, { w: 90, dur: 0.4, col: GB_COL }); const s = gbPhantomDo(e, lv, { name: 'pAwk2', clip: 'pDive', dur: 1.9 }, { x: a.cx, y: a.cy, linger: 0.2 }); if (s) { s.z = 200; s.vz = -1000; } }),
      evAt(1.15, e => { const a = e.act; cam.shake = 10; sfx.boom(1.1); for (const t of ents) if (hittable(e, t) && Math.hypot(t.x - a.cx, (t.y - a.cy) * 1.4) < 170) { addStatus(t, 'root', 1.6, { src: e }); applyHit(e, t, { dmg: skillDmg(8, 2, lv), stun: 1, knock: 0, hs: 0.1, sure: true, col: '#bfe8ff' }, { proj: true }); } fxShock(a.cx, a.cy, 180, GB_COL); }),
      ...[1.55, 1.85].map((t, i) => evAt(t, e => { const a = e.act; e.x = a.cx - (i ? 1 : -1) * 90; e.face = i ? 1 : -1; e.play(i ? 'rk2' : 'rk1', true); const s = gbPhantom(e); if (s) s.play('pCross', true);
        cam.shake = 9; sfx.iai(); fxSlashX(a.cx, a.cy, 60, 200, i ? '#9fd8ff' : '#6aa8ff');
        blast(e, a.cx, a.cy, 170, { dmg: skillDmg(6, 1.6, lv), stun: 1, knock: 0, hs: 0.1, sure: true, col: '#bfe8ff' }, { zMax: 260 }); })),
      evAt(2.35, e => { const a = e.act; e.play('iaiSpin', true); cam.flash = 0.35; cam.flashCol = '#dff0ff'; cam.shake = 16; sfx.iai(); sfx.boom(1.4); fxSpr('crossx', a.cx, a.cy, 70, { w: 320, dur: 0.6, grow: [0.5, 1.1], col: '#bfe8ff' });
        blast(e, a.cx, a.cy, 200, { dmg: skillDmg(16, 4.5, lv), launch: 520, knock: 200, hs: 0.22, big: 2.4, critBonus: 0.2, sure: true, downHit: true, col: '#dff0ff' }, { zMax: 320 }); })] }) });

/* ---- 灭魂极影剑·止煞（三觉）：本体用剑割开鬼手的掌心，打开“灵魂世界”；本体与幻鬼高速移动互相比剑，卷入的敌人受多段伤害；两人交汇斩开灵魂世界，大爆发收尾。无敌；与冥夜鬼天杀共享冷却 ---- */
defSkill('gb_awaken3', { name: '灭魂极影剑·止煞', cls: 'sword', job: 'ghostblade', lvReq: 30, maxLv: 3, mp: 250, cd: 135, pvp: 0.45, type: 'phys', awaken: true, col: '#6ab0ff',
  desc: '【三觉】用剑割开鬼手的掌心，打开“灵魂世界”：本体与幻鬼在其中高速移动、互相比剑，被卷入的敌人受到多段伤害；最后两人交汇，斩开灵魂世界和敌人，大爆发收尾。全程无敌。与冥夜鬼天杀共享冷却。',
  pow: lv => skillDmg(48, 12, lv), ai: { kind: 'awaken', r: [0, 400], dy: 90 },
  act: (lv) => ({ name: 'gb_awaken3', clip: 'hakuu', dur: 4.0, superArmor: true, noCounter: true, invul: [0, 4.0],
    onStart: e => { game.cutin = { t: 0, dur: 1.0, name: '灭魂极影剑·止煞', who: cutinWho(e) }; game.timeStop = 0.9; sfx.awaken(); e.cool.gb_awaken = Math.max(e.cool.gb_awaken || 0, e.cool.gb_awaken3 || 0);
      const a = e.act; a.cx = e.x + e.face * 180; a.cy = e.y;
      addFx({ x: a.cx, y: -10, z: 0, dur: 4.0, draw(c) { const k = this.t, al = Math.min(1, (k - 0.9) * 3) * Math.min(1, (4 - k) * 3); if (al <= 0) return; c.save(); c.globalAlpha = 0.68 * al; c.fillStyle = '#030818'; c.fillRect(0, 0, WW, WH); c.restore();
        drawSpr(c, fxTint('rune', '#4a8aff'), sx(a.cx), sy(a.cy, 0), 460, 160, { ground: true, rot: k * 0.6, alpha: 0.5 * al }); } });
      gbPhantomDo(e, lv, { name: 'pAwk3', clip: 'pSpin', dur: 2.9 }, { x: a.cx + e.face * 120, y: a.cy, face: -e.face, linger: 0.2 }); },
    events: [...Array.from({ length: 12 }, (_, i) => evAt(1.0 + i * 0.16, e => { const a = e.act, s = gbPhantom(e), side = i % 2 ? 1 : -1;
        e.x = a.cx + side * rnd(60, 140); e.y = clamp(a.cy + rnd(-30, 30), 6, DEPTH - 6); e.face = -side; e.play(i % 2 ? 'rk2' : 'rk1', true); fxAfterimage(e, GB_COL);
        if (s) { s.warp(a.cx - side * rnd(60, 140), clamp(a.cy + rnd(-30, 30), 6, DEPTH - 6)); s.face = side; }
        fxSlashX(a.cx + rnd(-60, 60), a.cy + rnd(-20, 20), rnd(40, 110), rnd(140, 200), i % 2 ? '#9fd8ff' : '#6aa8ff'); if (i % 2) sfx.iai(); else sfx.swing(true);
        blast(e, a.cx, a.cy, 230, { dmg: skillDmg(2.2, 0.55, lv), stun: 0.6, airLift: 100, knock: 0, hs: 0.03, sure: true, downHit: true, col: '#bfe8ff' }, { zMax: 360 }); })),
      evAt(3.1, e => { const a = e.act; e.x = a.cx - e.face * 60; e.play('iaiSpin', true); cam.flash = 0.45; cam.flashCol = '#eaf6ff'; cam.shake = 18; sfx.boom(1.6); sfx.iai();
        fxSpr('crossx', a.cx, a.cy, 80, { w: 420, dur: 0.7, grow: [0.4, 1.1], col: '#dff0ff' }); fxBurst(a.cx, a.cy, 60, 420, '#9fd8ff');
        for (const t of ents) if (hittable(e, t) && Math.abs(t.x - a.cx) < WW * 0.55) applyHit(e, t, { dmg: skillDmg(20, 5.5, lv), launch: 560, knock: 220, hs: 0.24, big: 2.4, critBonus: 0.3, sure: true, downHit: true, col: '#ffffff' }, { proj: true }); })] }) });
{ const A = SKILLS.gb_awaken, a0 = A.act; A.act = (lv, p) => { const a = a0(lv, p); if (p && p.cool) p.cool.gb_awaken3 = Math.max(p.cool.gb_awaken3 || 0, p.cool.gb_awaken || 0); return a; }; }
// 鬼咲：普攻 / 跑攻 / 后跳中也能叠加幻鬼技能；站立被击时也能用幻鬼技能和幻鬼步；三段刃、鬼步冷却 −1 秒。睥睨万物：浮空 / 倒地时也能用幻鬼步（7 秒冷却）
{
  const inS0 = gbInSword; gbInSword = p => inS0(p) || (gbLv(p, 'gb_bloom') > 0 && p.st === 'act' && !!p.act && (p.act.basic || p.act.name === 'back'));
  // whenHit(p) = 这一刻“只能受击时放”的限制是否生效（通用组语义）：平时不限制；受击 / 倒地 / 浮空时要有鬼咲（站立被击）或睥睨万物（浮空 / 倒地，7 秒冷却）
  const R = SKILLS.gb_retrace; R.whenHit = p => p.st === 'hit' || p.st === 'down' || p.st === 'air'; R.hitStates = ['hit', 'down', 'air'];
  { const q0 = R.req; R.req = p => { if (p.st === 'hit' && !gbLv(p, 'gb_bloom')) return '需要鬼咲'; if ((p.st === 'air' || p.st === 'down') && (!gbLv(p, 'gb_scorn') || (p.cool.gb_retrace_air || 0) > 0)) return '需要睥睨万物'; return q0(p); }; }
  const r0 = R.act; R.act = (lv, p) => { const a = r0(lv, p); if (p && (p.st === 'air' || p.st === 'down')) p.cool.gb_retrace_air = 7; return a; }; R.air = true;
  for (const id of ['gb_issen', 'gb_rend', 'gb_kaiten', 'gb_naraku', 'gb_shinpu']) { const S = SKILLS[id], q0 = S.req; S.whenHit = p => p.st === 'hit'; S.hitStates = ['hit']; S.req = p => p.st === 'hit' && !gbLv(p, 'gb_bloom') ? '需要鬼咲' : q0(p); }
  for (const id of ['triple', 'gb_step']) { const S = SKILLS[id], a0 = S.act; S.act = (lv, p) => { const a = a0(lv, p); if (p && gbJob(p) && gbLv(p, 'gb_bloom') && p.cool[id] > 1 && !(p.act && p.act.skill === id)) p.cool[id] -= 1; return a; }; }   // 鬼咲：冷却 −1 秒
}
CLASSES.sword.passives.push(p => {
  if (!gbJob(p)) return;
  setPassive(p, 'gb_yaksha', gbLv(p, 'gb_yaksha') > 0, { atk: 0.04 + 0.008 * gbLv(p, 'gb_yaksha'), crit: 0.02 + 0.003 * gbLv(p, 'gb_yaksha') });
  setPassive(p, 'gb_bloom', gbLv(p, 'gb_bloom') > 0, { dmg: 0.1 });
  setPassive(p, 'gb_scorn', gbLv(p, 'gb_scorn') > 0, { dmg: 0.06 + 0.012 * gbLv(p, 'gb_scorn') });
});

CLASSES.sword.jobs.ghostblade = { art: 'job/ghostblade', name: '剑影', role: '近战 · 双魂', armor: 'leather', awaken: 'gb_awaken', awakenName: '夜刀神',
  desc: '濒死时被冤魂“幻鬼”附身、两个灵魂共存一体的剑士。鬼步接剑术，幻鬼技能随时叠加，与幻鬼共鸣出招，幻鬼步来去无踪。',
  skills: ['gb_ghostman', 'gb_step', 'gb_chain', 'gb_retrace', 'gb_katana', 'gb_issen', 'gb_power', 'gb_fang', 'gb_rend', 'gb_resonance', 'gb_chainex', 'gb_riko', 'gb_break', 'gb_ghostslash', 'gb_kaiten', 'gb_behead', 'gb_awaken', 'gb_yaksha', 'gb_naraku', 'gb_abyss', 'gb_bloom', 'gb_shinpu', 'gb_dance', 'gb_awaken2', 'gb_scorn', 'gb_mushiki', 'gb_awaken3'] };
CLASSES.sword.cmds.push(['bf', 'gb_step', 'buff'], ['bdf', 'gb_chain'], ['', 'gb_retrace', 'buff'], ['fdf', 'gb_issen'], ['fbf', 'gb_fang'], ['uu', 'gb_rend'], ['uu', 'gb_resonance', 'buff'],
  ['bff', 'gb_riko'], ['ud', 'gb_break'], ['fbdf', 'gb_ghostslash'], ['ddf', 'gb_kaiten'], ['du', 'gb_behead'], ['uudd', 'gb_awaken'],
  ['dud', 'gb_naraku'], ['uff', 'gb_abyss'], ['duf', 'gb_shinpu'], ['udf', 'gb_dance'], ['duff', 'gb_awaken2'], ['bfdf', 'gb_mushiki'], ['bufd', 'gb_awaken3']);
// 剑影不能学：连突刺、卡赞、武器精通（官方）
for (const id of ['dashthrust', 'kazan']) { const S = SKILLS[id]; S.excl = [...new Set([...(S.excl || []), 'ghostblade'])]; }
// 被动：太刀精通（攻击力）、幻鬼之力（攻速 / 移速 / 暴击）
CLASSES.sword.passives.push(p => {
  const on = gbJob(p);
  setPassive(p, 'gb_katana', on && gbLv(p, 'gb_katana') > 0, { atk: 0.03 + 0.006 * gbLv(p, 'gb_katana') });
  const w = gbLv(p, 'gb_power'); setPassive(p, 'gb_power', on && w > 0, { aspd: 0.02 + 0.004 * w, mspd: 0.02 + 0.004 * w, crit: 0.01 + 0.003 * w, critDmg: 0.02 + 0.005 * w });
});
// 官方可用普攻取消后摇：三觉
swordAtkCancel('gb_awaken3', 3.2);
swordFinalize();
