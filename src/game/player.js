/* =====================================================================
   11. 玩家角色（“格斗者” fighter）：移动 / 双击跑 / 跳 / 普攻连段 / 跑攻 / 跳攻 / 后跳 / 受身 / 闪避 / 技能与取消 / 指令 / 蓄力
   同一套逻辑由 p.pad 驱动：键盘玩家 pad = input；AI / 网络对手 pad = new Pad()（见 engine/pad.js、game/fighter_ai.js）
   技能栏与技能等级：键盘玩家读 game.skillBar / game.skillLv / game.job；其他格斗者读自己的 p.kit = { bar, lv, job }
   取消规则（与原作一致）：
     普攻 → 任意技能（随时，“强制”）；普攻命中后 → 后跳
     技能 → 其他技能 / 后跳：cancelFrom 之后（没有 cancelFrom 的技能——觉醒等——不能取消）
     技能多段追加（follow）：followWin 内再按同一个键或 Z
   ===================================================================== */
const DEG = Math.PI / 180;
// 刀光：在动作的某个时刻生成（相对角色朝向）
const slashAt = (t, o) => ({ t, fn: e => { fxSlash({ x: e.x, y: e.y, z: e.z, face: e.face, col: e.slashCol || '#8fd8ff', ...o }); if (!o.silent) sfx.swing(o.heavy); } });
const evAt = (t, fn) => ({ t, fn });

/* ---- 通用动作：后跳（↓+C，耗 1 MP，起跳 0.22 秒无敌）---- */
const BACKSTEP = { name: 'back', clip: 'back', dur: 0.36, move: [[0, 0.3, -340, 250]], noCounter: true, invul: [0, 0.22],
  onStart: e => { e.jumpRun = false; e.mp = Math.max(0, e.mp - 1); sfx.jump(); }, onLand: e => { e.vx *= 0.3; e.endAct(); } };
/* ---- 闪避翻滚（Shift / V，所有职业）：朝方向键方向（含纵深）翻滚，全程无敌；受击硬直中也能用（冷却更长） ---- */
const DODGE_CD = 0.7, BREAK_CD = 5;
function doDodge(p, fromHit) {
  let dx = p.pad.dx(), dy = p.pad.dy(); if (!dx && !dy) dx = p.face;
  const l = Math.hypot(dx, dy * 1.2) || 1, vx = dx / l * 470, vy = dy / l * 470 * 0.62;
  if (dx) p.face = Math.sign(dx);
  p.interrupt();
  p.stun = 0; p.dodgeCd = DODGE_CD; if (fromHit) { p.breakCd = game.pvp ? BREAK_CD * 2 : BREAK_CD; fxText('紧急闪避', p.x, p.y, p.z, { col: '#9fe8ff', size: 11 }); }
  p.doAct({ name: 'dodge', clip: 'roll', dur: 0.36, noCounter: true,
    onStart: e => { e.invul = Math.max(e.invul, 0.34); sfx.jump(); sfx.swing(false); fxDust(e.x, e.y, 4, 10); },
    update: e => { e.vx = e.actT < 0.3 ? vx : vx * 0.3; e.vy = e.actT < 0.3 ? vy : vy * 0.3; if (Math.floor(e.actT / 0.06) !== e._dg) { e._dg = Math.floor(e.actT / 0.06); fxAfterimage(e, '#9fe8ff'); } },
    onEnd: e => { e.vx *= 0.3; e.vy = 0; } });
}
/* ---- 职业基础属性（随等级成长；具体职业内容见 content/classes/*） ---- */
const CLASSES = {
  sword: { name: '鬼剑士', hp0: 1800, hpPer: 150, mp0: 700, mpPer: 40, atk0: 480, atkPer: 58, str0: 7, strPer: 2.2, def0: 300, defPer: 28, crit: 0.08, speed: 165, runSpeed: 300, cmds: [] },
};
// 技能栏 / 技能等级 / 转职：键盘玩家用全局存档数据，其他格斗者用自己的 kit
const barOf = p => p.kit ? p.kit.bar : game.skillBar;
const lvOf = (p, id) => ((p.kit ? p.kit.lv : game.skillLv)[id] || 0);
const jobOf = p => p.kit ? p.kit.job : game.job;
const isHuman = p => p.pad === input;

/* ---- 玩家实体 ---- */
function makePlayer(cls = 'sword', o = {}) {
  const C = CLASSES[cls];
  const p = new Ent({ team: 'p', name: C.name, model: C.model ? C.model() : buildSwordsman(), clips: CLIPS[cls] || CLIPS.sword, x: 200, y: 100, w: 13, d: 12, h: 104, hp: 2000, mpMax: 700, mp: 700,
    atk: 520, def: 300, crit: 0.1, speed: 165, runSpeed: 300, jumpV: 480, shadowR: 19, weight: 1, cls, slashCol: C.slashCol || '#8fd8ff',
    fighter: true, dmgType: C.dmgType || 'phys', ...o });
  p.acts = C.acts; p.cool = {}; p.buffs = {}; p.reboundCd = 0; p.airAtk = 0;
  p.pad = o.pad || input; p.control = o.control || playerControl;
  if (!o.kit) { recalcStats(p); p.hp = p.hpMax; p.mp = p.mpMax; }
  return p;
}
// 非键盘玩家的格斗者：冷却 / MP 恢复 / BUFF 计时（键盘玩家由 game.step 处理）
function tickFighter(p, dt) {
  for (const k in p.cool) if (p.cool[k] > 0) p.cool[k] -= dt;
  if (p.dead) return;
  p.mp = Math.min(p.mpMax, p.mp + p.mpMax * 0.02 * dt);
  for (const k in p.buffs) { p.buffs[k].t -= dt; if (p.buffs[k].t <= 0) delete p.buffs[k]; }
  if (p.baseStats) applyBuffs(p);
}
function playerControl(p, dt) {
  if (p.dead) return;
  const I = p.pad, dx = I.dx(), dy = I.dy();
  if (p.reboundCd > 0) p.reboundCd -= dt;
  if (p.dodgeCd > 0) p.dodgeCd -= dt;
  if (p.breakCd > 0) p.breakCd -= dt;
  // 受身：倒地（或快要落地）时按 C 立即起身并蹲伏（无敌），耗 1 MP
  if (tryTech(p)) return;
  // 闪避：站立 / 走跑 / 普攻中 / 技能后摇中随时可用；受击硬直中用会进入较长冷却
  if (I.buffered('dodge') && !(p.dodgeCd > 0) && p.z <= 1 && (p.free || p.st === 'act' || p.st === 'hit') && p.st !== 'jump') {
    const hit = p.st === 'hit', a = p.act, inSkill = p.st === 'act' && a && (a.skill || a.name === 'back') && !(a.cancelFrom !== undefined && p.actT >= a.cancelFrom) && !a.dodgeOk;
    if (!inSkill && (!hit || !(p.breakCd > 0))) { I.consume('dodge'); doDodge(p, hit); return; }
  }
  if (!p.free && p.st !== 'act') return;   // 硬直 / 浮空 / 倒地 / 起身 / 被抓
  // 后跳：↓ + C（站立时；普攻打出判定后 / 技能后摇中也能用来取消）
  if (I.buffered('jump') && I.is('down') && p.z <= 1 && canBackstep(p)) { I.consume('jump'); p.doAct(p.acts.back || BACKSTEP); return; }
  // ---- 技能（可取消普攻 / 技能后摇）----
  if (trySkill(p)) return;
  // ---- 动作中：普攻连段 ----
  if (p.st === 'act' && p.act) {
    const a = p.act;
    const nx = typeof a.next === 'function' ? a.next(p) : a.next;
    if (a.chain && nx && p.actT >= a.chain[0] && (I.buffered('attack') || (a.hold !== false && a.basic && I.is('attack') && p.actT >= a.chain[0] + 0.04))) {
      if (!a.airOnly || p.airAtk < (CLASSES[p.cls].airMax || 1) + (p.airBonus || 0)) { I.consume('attack'); faceInput(p, dx); if (a.airOnly) p.airAtk++; p.doAct(p.acts[nx]); return; }
    }
    // 空中攻击期间允许轻微的空中移动
    if (a.airOnly) p.vx = damp(p.vx, dx * p.speed * mspdOf(p) * 0.8, 6, dt);
    return;
  }
  // ---- 空中 ----
  if (p.st === 'jump') {
    const sp = (p.jumpRun ? p.runSpeed : p.speed) * mspdOf(p);
    p.vx = damp(p.vx, dx * sp, 5, dt); p.vy = dy * p.speed * 0.6;
    if (dx) p.face = dx;
    if (I.buffered('attack') && p.airAtk < (CLASSES[p.cls].airMax || 1) + (p.airBonus || 0)) { I.consume('attack'); p.airAtk++; p.doAct(p.acts.jatk); }
    return;
  }
  // ---- 地面 ----
  if (I.consume('jump')) { p.vz = p.jumpV; p.z = 0.5; p.jumpRun = p.st === 'run'; p.airAtk = 0; p.setState('jump'); sfx.jump(); return; }
  if (I.buffered('attack') && isHuman(p) && tryPickup(p)) { I.consume('attack'); return; }
  if (I.consume('attack')) {
    if (p.st === 'run') { p.doAct(p.acts.dash); return; }
    faceInput(p, dx); p.doAct(p.acts.atk1); return;
  }
  const running = I.runDir !== 0 && dx === I.runDir;
  if (dx || dy) {
    if (dx) p.face = dx;
    const sp = (running ? p.runSpeed : p.speed) * mspdOf(p);
    p.vx = dx * sp; p.vy = dy * sp * (running ? 0.72 : 0.88);
    p.setState(running ? 'run' : 'walk');
    if (running && Math.floor(p.stT * 7) !== Math.floor((p.stT - dt) * 7)) fxDust(p.x - p.face * 8, p.y, 1, 4);
  } else { p.vx = 0; p.vy = 0; if (p.st === 'walk' || p.st === 'run') p.setState('idle'); }
}
function faceInput(p, dx) { if (dx) p.face = dx; }
function tryTech(p) {
  const I = p.pad;
  if (!(p.st === 'down' || (p.st === 'air' && p.z < 26 && p.vz < 0 && !p.dead))) return false;
  if (!I.buffered('jump') || p.reboundCd > 0 || p.stT < 0.08 || p.mp < 1) return false;
  I.consume('jump');
  p.z = 0; p.vz = 0; p.vx *= 0.2; p.setState('down'); p.startGetup(true); p.superArmor = 0.3; p.reboundCd = game.pvp ? 5 : 2.5; p.mp -= 1;
  fxText('受身', p.x, p.y, p.z, { col: '#8fd8ff', size: 11 }); fxDust(p.x, p.y, 4, 12);
  return true;
}
// 当前动作能否被后跳取消
function canBackstep(p) {
  if (p.free) return p.st !== 'jump';
  const a = p.act; if (p.st !== 'act' || !a || a.airOnly || a.name === 'back' || a.name === 'dodge') return false;
  if (a.basic) return p.actT >= a.counterEnd;
  return a.backOk || (a.skill && a.cancelFrom !== undefined && p.actT >= a.cancelFrom);
}
// 当前动作能否被技能取消
function canSkillCancel(p) {
  if (p.st !== 'act' || !p.act) return true;
  const a = p.act;
  if (a.basic) return true;                                             // 强制：普攻随时可被技能取消
  if (a.skill || a.cancelable) return a.cancelFrom !== undefined && p.actT >= a.cancelFrom;
  return false;
}
function castSkill(p, id, viaCmd, key) {
  const S = SKILLS[id]; if (!S || !S.act || S.passive) return false;
  const lv = lvOf(p, id), human = isHuman(p);
  const slot = barOf(p).indexOf(id), flash = msg => { if (human && slot >= 0) ui.flashSlot(slot, msg); return true; };
  if (lv <= 0) return flash('未学习');
  if (S.job && S.job !== jobOf(p)) return flash('未转职');
  if ((p.cool[id] || 0) > 0) return flash('冷却中');
  const mp = Math.round(S.mp * (viaCmd ? 0.98 : 1));
  if (p.mp < mp) return flash('MP不足');
  const inAir = p.st === 'jump' || p.z > 2 || (p.st === 'act' && p.act && p.act.airOnly);
  if (inAir && !S.air) return false;
  if (!inAir && S.airOnly) return false;
  p.mp -= mp; p.cool[id] = S.cd * (p.cdMul || 1) * (viaCmd ? 0.99 : 1) * (game.pvp && S.pvpCd ? S.pvpCd : 1);
  const dx = p.pad.dx(); if (dx) p.face = dx;
  const extra = { skill: id, lv, key: key || null, type: S.type || p.dmgType };
  if (S.elem) extra.elem = S.elem;
  if (S.pvp) extra.pvp = S.pvp;
  if (S.speed || S.cast) extra.speed = S.speed || 'cspd';
  p.doAct(S.act(lv, p), extra);
  if (human) game.onSkill(id);
  return true;
}
function trySkill(p) {
  const I = p.pad, bar = barOf(p);
  // 追加段（例如三段斩的第 2、3 段）：再按同一个技能键 / Z
  if (p.st === 'act' && p.act && p.act.follow && p.act.skill && p.actT >= p.act.followWin[0]) {
    const slot = bar.indexOf(p.act.skill);
    if ((slot >= 0 && I.buffered('s' + slot)) || I.buffered('cmd')) {
      if (slot >= 0) I.consume('s' + slot); I.consume('cmd');
      const dx = I.dx(); if (dx) p.face = dx;
      const a = p.act, nx = a.follow(p); if (!nx) return false;
      p.doAct(nx, { skill: a.skill, lv: a.lv, key: a.key, type: a.type, elem: a.elem }); return true;
    }
  }
  if (!canSkillCancel(p)) return false;   // 按键会在缓冲里保留 0.3 秒
  for (let i = 0; i < 12; i++) {
    const key = 's' + i, id = bar[i];
    if (!id || !I.buffered(key)) continue;
    I.consume(key);
    if (castSkill(p, id, false, key)) return true;
  }
  // 指令：方向 + Z（或 + X）
  const C = CLASSES[p.cls];
  if (!C.cmdsSorted) C.cmdsSorted = [...C.cmds].sort((a, b) => cmdRank(b[0]) - cmdRank(a[0]));
  for (const key of ['cmd', 'attack']) {
    if (!I.buffered(key)) continue;
    for (const [seq, id, k2] of C.cmdsSorted) {
      if ((k2 || 'cmd') !== key || !cmdMatch(I, seq, p.face)) continue;
      if (lvOf(p, id) <= 0 || (p.cool[id] || 0) > 0 || (SKILLS[id].job && SKILLS[id].job !== jobOf(p))) continue;
      if (key === 'attack' && seq === '') continue;
      I.consume(key);
      if (castSkill(p, id, seq !== '', key)) return true;
    }
    if (key === 'cmd') { I.consume('cmd'); return false; }
  }
  return false;
}
// 指令优先级：长指令 > 按住→ > 单方向 > 无方向
const cmdRank = s => s === 'hold' ? 1.5 : s === '' ? 0 : s.length + (s.length === 1 ? 0.2 : 0);
function cmdMatch(I, seq, face) {
  if (seq === '') return true;
  const fw = face > 0 ? 'right' : 'left', bw = face > 0 ? 'left' : 'right';
  if (seq === 'hold') return I.is(fw);
  if (seq.length === 1) { const d = { f: fw, b: bw, u: 'up', d: 'down' }[seq]; return I.is(d) || I.command(seq, face); }
  return I.command(seq, face);
}
