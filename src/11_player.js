/* =====================================================================
   11. 玩家：操控（移动 / 双击跑 / 跳 / 普攻三连 / 冲刺攻击 / 跳攻 / 后跳 / 技能与取消）
   ===================================================================== */
const DEG = Math.PI / 180;
// 刀光：在动作的某个时刻生成（相对角色朝向）
const slashAt = (t, o) => ({ t, fn: e => { fxSlash({ x: e.x, y: e.y, z: e.z, face: e.face, col: e.slashCol || '#8fd8ff', ...o }); if (!o.silent) sfx.swing(o.heavy); } });
const evAt = (t, fn) => ({ t, fn });

/* ---- 剑士的基础动作 ---- */
const SWORD_ACTS = {
  atk1: { name: 'atk1', dur: 0.34, chain: [0.13, 0.34], next: 'atk2', move: [[0.03, 0.09, 120]],
    hits: [{ t0: 0.07, t1: 0.12, box: [0, 72, 28, 18, 100], dmg: 1.0, stun: 0.36, knock: 60, hs: 0.055 }],
    events: [slashAt(0.06, { a0: -2.4, a1: 0.7, r: 54, w: 15, off: [14, 58], squash: 0.72 })] },
  atk2: { name: 'atk2', dur: 0.36, chain: [0.13, 0.36], next: 'atk3', move: [[0.03, 0.09, 110]],
    hits: [{ t0: 0.07, t1: 0.12, box: [0, 70, 28, 18, 110], dmg: 1.05, stun: 0.38, knock: 60, hs: 0.055 }],
    events: [slashAt(0.06, { a0: 1.0, a1: -2.1, r: 52, w: 15, off: [12, 56], squash: 0.8 })] },
  atk3: { name: 'atk3', dur: 0.5, chain: [0.26, 0.5], next: null, move: [[0.07, 0.16, 240]],
    hits: [{ t0: 0.13, t1: 0.19, box: [0, 84, 30, 0, 115], dmg: 1.7, stun: 0.5, knock: 230, hs: 0.09, shake: 3, down: false, big: 1.3 }],
    events: [slashAt(0.12, { a0: -2.7, a1: 1.1, r: 66, w: 22, off: [10, 56], squash: 0.85, heavy: true })] },
  dash: { name: 'dash', dur: 0.45, move: [[0, 0.26, 420]], noCounter: true,
    hits: [{ t0: 0.05, t1: 0.26, box: [0, 58, 26, 30, 90], dmg: 1.35, stun: 0.45, knock: 240, hs: 0.07, shake: 2 }],
    events: [evAt(0.04, e => { fxStreak({ x: e.x, y: e.y, z: e.z + 62, face: e.face, len: 80, w: 10, col: '#8fd8ff' }); sfx.swing(true); })] },
  jatk: { name: 'jatk', dur: 0.36, airOnly: true, lowGrav: 0.75,
    hits: [{ t0: 0.07, t1: 0.17, box: [0, 64, 28, -30, 80], dmg: 0.95, stun: 0.35, knock: 50, hs: 0.05, airLift: 160 }],
    events: [slashAt(0.06, { a0: -1.9, a1: 1.3, r: 48, w: 14, off: [12, 40] })] },
  back: { name: 'back', dur: 0.36, move: [[0, 0.3, -340, 250]], noCounter: true, onStart: e => { e.invul = 0.36; e.jumpRun = false; e.mp = Math.max(0, e.mp - 1); sfx.jump(); }, onLand: e => { e.vx *= 0.3; e.endAct(); } },
  // 连突刺：跑攻后再按 X
  dash2: { name: 'dash2', clip: 'flurry', dur: 0.55, move: [[0, 0.4, 60]], noCounter: true,
    hits: [{ t0: 0.02, t1: 0.4, rep: 0.08, box: [0, 64, 26, 30, 95], dmg: 0.45, stun: 0.3, knock: 40, hs: 0.03, snd: 'stab' }, { t0: 0.42, t1: 0.48, box: [0, 70, 28, 25, 100], dmg: 1.2, knock: 220, stun: 0.5, hs: 0.07, shake: 2 }],
    update: e => { if (e.actT < 0.4 && Math.floor(e.actT / 0.08) !== e._fl) { e._fl = Math.floor(e.actT / 0.08); fxStreak({ x: e.x + e.face * 12, y: e.y + rnd(-4, 4), z: e.z + rnd(50, 70), face: e.face, len: rnd(45, 65), w: 5, col: '#8fd8ff', dur: 0.1 }); } } },
};
SWORD_ACTS.dash.chain = [0.14, 0.45]; SWORD_ACTS.dash.next = 'dash2';
/* ---- 闪避翻滚（所有职业）：朝方向键方向（含纵深）翻滚，全程无敌；受击硬直中也能用（冷却更长） ---- */
const DODGE_CD = 0.7, BREAK_CD = 5;
function doDodge(p, fromHit) {
  let dx = input.dx(), dy = input.dy(); if (!dx && !dy) dx = p.face;
  const l = Math.hypot(dx, dy * 1.2) || 1, vx = dx / l * 470, vy = dy / l * 470 * 0.62;
  if (dx) p.face = Math.sign(dx);
  if (p.act && p.act.onEnd) { const o = p.act; p.act = null; o.onEnd(p, true); }
  p.stun = 0; p.dodgeCd = DODGE_CD; if (fromHit) { p.breakCd = BREAK_CD; fxText('紧急闪避', p.x, p.y, p.z, { col: '#9fe8ff', size: 11 }); }
  p.doAct({ name: 'dodge', clip: 'roll', dur: 0.36, noCounter: true,
    onStart: e => { e.invul = Math.max(e.invul, 0.34); sfx.jump(); sfx.swing(false); fxDust(e.x, e.y, 4, 10); },
    update: e => { e.vx = e.actT < 0.3 ? vx : vx * 0.3; e.vy = e.actT < 0.3 ? vy : vy * 0.3; if (Math.floor(e.actT / 0.06) !== e._dg) { e._dg = Math.floor(e.actT / 0.06); fxAfterimage(e, '#9fe8ff'); } },
    onEnd: e => { e.vx *= 0.3; e.vy = 0; } });
}
/* ---- 职业基础属性（随等级成长） ---- */
const CLASSES = {
  sword: { name: '剑士', hp0: 1800, hpPer: 150, mp0: 700, mpPer: 40, atk0: 480, atkPer: 58, str0: 7, strPer: 2.2, def0: 300, defPer: 28, crit: 0.08, speed: 165, runSpeed: 300,
    // 指令：方向序列（f 前 b 后 d 下 u 上）+ Z；hold 表示按住前
    cmds: [['df', 'wave'], ['fd', 'slam'], ['fu', 'rise'], ['bf', 'spin'], ['dd', 'iai'], ['u', 'flurry'], ['hold', 'triple'], ['', 'upslash']] },
};

/* ---- 玩家实体 ---- */
function makePlayer(cls = 'sword') {
  const C = CLASSES[cls];
  const p = new Ent({ team: 'p', name: C.name, model: C.model ? C.model() : buildSwordsman(), clips: CLIPS[cls] || CLIPS.sword, x: 200, y: 100, w: 13, d: 12, h: 104, hp: 2000, mpMax: 700, mp: 700,
    atk: 520, def: 300, crit: 0.1, speed: 165, runSpeed: 300, jumpV: 480, shadowR: 19, weight: 1, cls, slashCol: C.slashCol || '#8fd8ff' });
  p.acts = C.acts || SWORD_ACTS;
  p.cool = {}; p.reboundCd = 0;
  p.control = playerControl;
  recalcStats(p); p.hp = p.hpMax; p.mp = p.mpMax;
  return p;
}
function playerControl(p, dt) {
  if (p.dead) return;
  const dx = input.dx(), dy = input.dy();
  const canAct = !p.busy || (p.st === 'act' && p.act && p.act.cancelFrom !== undefined && p.actT >= p.act.cancelFrom);
  if (p.reboundCd > 0) p.reboundCd -= dt;
  if (p.dodgeCd > 0) p.dodgeCd -= dt;
  if (p.breakCd > 0) p.breakCd -= dt;
  // 闪避：站立 / 走跑 / 普攻中 / 技能后摇中随时可用；受击硬直中用会进入较长冷却
  if (input.buffered('dodge') && !(p.dodgeCd > 0) && p.z <= 1 && p.st !== 'down' && p.st !== 'air' && p.st !== 'getup' && p.st !== 'jump') {
    const hit = p.st === 'hit', inSkill = p.st === 'act' && p.act && p.act.skill && !(p.act.cancelFrom !== undefined && p.actT >= p.act.cancelFrom) && !p.act.dodgeOk;
    if (!inSkill && (!hit || !(p.breakCd > 0))) { input.consume('dodge'); doDodge(p, hit); return; }
  }
  // 受身：倒地时按 C 立即起身（无敌 + 起身霸体），冷却 5 秒
  if ((p.st === 'down' || (p.st === 'air' && p.z < 30 && p.vz < 0)) && input.buffered('jump') && p.reboundCd <= 0 && p.stT > 0.08) {
    p.z = 0; p.vz = 0; p.setState('down'); p.startGetup(); p.invul = 1.2; p.superArmor = 0.3; p.reboundCd = 2.5; p.mp = Math.max(0, p.mp - 1);
    fxText('受身', p.x, p.y, p.z, { col: '#8fd8ff', size: 11 }); input.consume('jump'); return;
  }
  if (p.st === 'hit' || p.st === 'air' || p.st === 'down' || p.st === 'getup') return;
  // ---- 技能（可取消普攻 / 部分技能后摇）----
  const sk = trySkill(p);
  if (sk) return;
  // ---- 动作中：普攻连段 ----
  if (p.st === 'act' && p.act) {
    const a = p.act;
    if (a.chain && a.next && p.actT >= a.chain[0] && (input.buffered('attack') || (a.hold && input.is('attack')))) { input.consume('attack'); faceInput(p, dx); p.doAct(p.acts[a.next]); }
    // 空中攻击期间允许轻微的空中移动
    if (a.airOnly) p.vx = damp(p.vx, dx * p.speed * 0.8, 6, dt);
    return;
  }
  // ---- 空中 ----
  if (p.st === 'jump') {
    p.vx = damp(p.vx, dx * (p.jumpRun ? p.runSpeed : p.speed), 5, dt); p.vy = dy * p.speed * 0.6;
    if (dx) p.face = dx;
    if (input.consume('attack')) p.doAct(p.acts.jatk);
    return;
  }
  // ---- 地面 ----
  if (input.buffered('jump') && input.is('down')) { input.consume('jump'); p.doAct(p.acts.back); return; }   // 后跳：↓ + C
  if (input.consume('jump')) { p.vz = p.jumpV; p.z = 0.5; p.jumpRun = p.st === 'run'; p.setState('jump'); sfx.jump(); return; }
  if (input.buffered('attack') && tryPickup(p)) { input.consume('attack'); return; }
  if (input.consume('attack')) {
    if (p.st === 'run') { p.doAct(p.acts.dash); return; }
    faceInput(p, dx); p.doAct(p.acts.atk1); return;
  }
  const running = input.runDir !== 0 && dx === input.runDir;
  if (dx || dy) {
    if (dx) p.face = dx;
    const sp = running ? p.runSpeed : p.speed;
    p.vx = dx * sp; p.vy = dy * sp * (running ? 0.72 : 0.88);
    p.setState(running ? 'run' : 'walk');
    if (running && Math.floor(p.stT * 7) !== Math.floor((p.stT - dt) * 7)) fxDust(p.x - p.face * 8, p.y, 1, 4);
  } else { p.vx = 0; p.vy = 0; if (p.st === 'walk' || p.st === 'run') p.setState('idle'); }
}
function faceInput(p, dx) { if (dx) p.face = dx; }
function castSkill(p, id, viaCmd) {
  const S = SKILLS[id]; if (!S || !S.act) return false;
  const lv = game.skillLv[id] || 0;
  const slot = game.skillBar.indexOf(id);
  if (lv <= 0) { if (slot >= 0) ui.flashSlot(slot, '未学习'); return true; }
  if ((p.cool[id] || 0) > 0) { if (slot >= 0) ui.flashSlot(slot, '冷却中'); return true; }
  const mp = Math.round(S.mp * (viaCmd ? 0.98 : 1));
  if (p.mp < mp) { if (slot >= 0) ui.flashSlot(slot, 'MP不足'); return true; }
  const inAir = p.st === 'jump' || p.z > 2 || (p.st === 'act' && p.act && p.act.airOnly);
  if (inAir && !S.air) return false;
  if (p.st === 'act' && p.act && p.act.skillCancel === false) return false;
  p.mp -= mp; p.cool[id] = S.cd * (p.cdMul || 1) * (viaCmd ? 0.99 : 1);
  const dx = input.dx(); if (dx) p.face = dx;
  p.doAct(S.act(lv, p), { skill: id, lv });
  game.onSkill(id);
  return true;
}
function trySkill(p) {
  // 追加段（例如疾风三连的第 2、3 段）：再按同一个技能键 / Z
  if (p.st === 'act' && p.act && p.act.follow && p.act.skill && p.actT >= p.act.followWin[0]) {
    const slot = game.skillBar.indexOf(p.act.skill);
    if ((slot >= 0 && input.buffered('s' + slot)) || input.buffered('cmd')) {
      if (slot >= 0) input.consume('s' + slot); input.consume('cmd');
      const dx = input.dx(); if (dx) p.face = dx;
      const id = p.act.skill, lv = p.act.lv; p.doAct(p.act.follow(), { skill: id, lv }); return true;
    }
  }
  // 技能只能在当前技能的后摇（cancelFrom 之后）取消；觉醒等没有 cancelFrom 的技能不能被打断。按键会在缓冲里保留 0.3 秒
  if (p.st === 'act' && p.act && p.act.skill && !(p.act.cancelFrom !== undefined && p.actT >= p.act.cancelFrom)) return false;
  for (let i = 0; i < 12; i++) {
    const key = 's' + i, id = game.skillBar[i];
    if (!id || !input.buffered(key)) continue;
    input.consume(key);
    if (castSkill(p, id, false)) return true;
  }
  if (input.buffered('cmd')) {
    input.consume('cmd');
    const C = CLASSES[p.cls];
    // 长指令优先匹配（→↑ 先于 ↑），按住→ 次之，无方向的 Z 最后
    if (!C.cmdsSorted) C.cmdsSorted = [...C.cmds].sort((a, b) => (b[0] === 'hold' ? 0.5 : b[0].length) - (a[0] === 'hold' ? 0.5 : a[0].length));
    for (const [seq, id] of C.cmdsSorted) {
      const ok = seq === '' ? true : seq === 'hold' ? input.is(p.face > 0 ? 'right' : 'left') : input.command(seq, p.face);
      if (ok && (game.skillLv[id] || 0) > 0 && (p.cool[id] || 0) <= 0) { if (castSkill(p, id, seq !== '')) return true; }
    }
    return false;
  }
  return false;
}
