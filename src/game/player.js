/* =====================================================================
   11. 玩家角色（“格斗者” fighter）：移动 / 双击跑 / 跳 / 普攻连段 / 跑攻 / 跳攻 / 后跳（+ 后跳-强化）/ 受身蹲伏 / 技能与取消 / 指令 / 蓄力
   同一套逻辑由 p.pad 驱动：键盘玩家 pad = input；AI / 网络对手 pad = new Pad()（见 engine/pad.js、game/fighter_ai.js）
   技能栏与技能等级：键盘玩家读 game.skillBar / game.skillLv / game.job；其他格斗者读自己的 p.kit = { bar, lv, job }
   取消规则（官方现版，见 docs/SKILLS_OFFICIAL_common.md 第 5 节）：
     普攻（含跑攻、跳攻）→ 攻击类技能：随时（强制）；Buff 类技能（S.noForce，默认 = S.buff）不能取消普攻
     普攻 → 后跳：随时
     技能 → 其他技能：只有白名单——动作 / 技能上的 links（技能 id 列表，linkFrom 秒之后生效）、职业钩子 CLASSES[cls].cancelHook（次数制柔化等）
     技能 → 后跳：只有学了「后跳-强化」（c_bsup），冷却 40 秒；觉醒不能被取消
     受击 / 倒地中 ↓+C：「后跳-强化」的脱身，冷却 30 秒（和上面共用冷却），过程无敌 + 落地后 1 秒无敌
     动作中的派生键：act.keyLinks = { attack | cmd | jump: 技能id }（例：滑铲中按 X = 起身上旋踢）；倒地 / 起身中：CLASSES[cls].getupLinks
     技能多段追加（follow）：followWin 内再按同一个键或 Z
   技能字段钩子（字段不存在就是原来的行为）：S.req(p) → true | 失败提示；S.morph(p) → 替代技能 id；S.whenHit（受击 / 倒地时才能放，函数可自定条件）；
     S.airIf(p)（满足时可在空中放）；S.recast（召唤物在场时再按）；S.instant（无动作施放）；S.only / S.excl（基础技能的转职限制，skillAllowed）；
     act.hitCancel（本技能命中后 links 才开放）；CLASSES[cls].onHurt(p, 攻击者, h, dmg)（受击后）、cancelHook(p, act, id)（职业柔化）
   ===================================================================== */
const DEG = Math.PI / 180;
// 刀光：在动作的某个时刻生成（相对角色朝向）
const slashAt = (t, o) => ({ t, fn: e => { fxSlash({ x: e.x, y: e.y, z: e.z, face: e.face, col: e.slashCol || '#8fd8ff', ...o }); if (!o.silent) sfx.swing(o.heavy); } });
const evAt = (t, fn) => ({ t, fn });

/* ---- 通用动作：后跳（↓+C，耗 1 MP，无冷却）。官方基础后跳靠位移躲攻击，只在起跳给一小段无敌；后跳过程算“空中”，可以接空中技能 ---- */
const BACKSTEP = { name: 'back', clip: 'back', dur: 0.36, move: [[0, 0.3, -340, 250]], noCounter: true, invul: [0, 0.12],
  onStart: e => { e.jumpRun = false; e.mp = Math.max(0, e.mp - 1); sfx.jump(); e._bsEsc = !!e.act.escape; if (e._bsEsc) fxText('后跳-强化', e.x, e.y, e.z + 10, { col: '#9fe8ff', size: 11 }); },
  onLand: e => { e.vx *= 0.3; e.endAct(); },
  // 后跳-强化：落地后 1 秒内无敌（动作可能在落地前按时长结束，所以在结束时给，还在空中就多给一点）
  onEnd: e => { if (e._bsEsc) { e._bsEsc = false; e.invul = Math.max(e.invul, 1 + (e.z > 1 ? 0.25 : 0)); } } };
/* ---- 后跳-强化（通用被动 c_bsup，Lv10）：技能中 ↓+C 强制后跳（冷却 40 秒）；受击 / 倒地中 ↓+C 脱身（冷却 30 秒）；两种共用冷却，不受冷却缩减影响 ---- */
const BSUP_CD_SKILL = 40, BSUP_CD_HIT = 30;
const bsupReady = p => lvOf(p, 'c_bsup') > 0 && !(p.bsCd > 0);
// 受身蹲伏：冷却（决斗场更长）、按住 C 最长蹲伏时间、松开起身后的霸体
const TECH_CD = 5, TECH_CD_PVP = 20, TECH_HOLD_MAX = 3, TECH_SA = 0.3;
/* ---- 职业基础属性（随等级成长；具体职业内容见 content/classes/*） ---- */
const CLASSES = {
  sword: { name: '鬼剑士', hp0: 1800, hpPer: 150, mp0: 700, mpPer: 40, atk0: 480, atkPer: 58, str0: 7, strPer: 2.2, def0: 300, defPer: 28, crit: 0.08, speed: 165, runSpeed: 300, cmds: [] },
};
// 技能栏 / 技能等级 / 转职：键盘玩家用全局存档数据，其他格斗者用自己的 kit
const barOf = p => p.kit ? p.kit.bar : game.skillBar;
const lvOf = (p, id) => ((p.kit ? p.kit.lv : game.skillLv)[id] || 0);
const jobOf = p => p.kit ? p.kit.job : game.job;
const isHuman = p => p.pad === input;
// 当前武器类型（没装备武器返回 null）
const wtypeOf = p => p.kit ? p.kit.wtype : (typeof inv !== 'undefined' && inv.equip && inv.equip.weapon && inv.equip.weapon.wtype) || null;
const SKILL_SLOTS = 14;   // 技能栏格数：两排各 7 格（ASDFGH + Alt、QWERTY + 第 7 格）

/* ---- 玩家实体 ---- */
function makePlayer(cls = 'sword', o = {}) {
  const C = CLASSES[cls];
  const p = new Ent({ team: 'p', name: C.name, model: C.model ? C.model() : buildSwordsman(), clips: CLIPS[cls] || CLIPS.sword, x: 200, y: 100, w: 13, d: 12, h: 104, hp: 2000, mpMax: 700, mp: 700,
    atk: 520, def: 300, crit: 0.1, speed: 165, runSpeed: 300, jumpV: 480, shadowR: 19, weight: 1, cls, slashCol: C.slashCol || '#8fd8ff',
    fighter: true, dmgType: C.dmgType || 'phys', ...o });
  p.acts = C.acts; p.cool = {}; p.buffs = {}; p.reboundCd = 0; p.bsCd = 0; p.airAtk = 0; p.charges = {};
  p.pad = o.pad || input; p.control = o.control || playerControl;
  p.onHurt = (a, h) => { p.hurtT = game.t; if (C.onHurt) C.onHurt(p, a, h, p.lastDmg); };   // 受击后：记时间（“被击时”指令用）+ 职业钩子
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
// 装填次数制技能（S.charges = 上限，S.reload = 每颗补充秒数；例：G-14 手雷 3 颗、每 2 秒补 1 颗）
function tickCharges(p, dt) {
  const Q = p.charges || (p.charges = {});
  for (const id in Q) { const S = SKILLS[id], q = Q[id]; if (!S || q.n >= S.charges) { q.t = 0; continue; } q.t += dt; if (q.t >= (S.reload || 2)) { q.t = 0; q.n++; } }
}
const chargesOf = (p, id) => { const S = SKILLS[id]; if (!S || !S.charges) return null; const Q = p.charges || (p.charges = {}); return (Q[id] ??= { n: S.charges, t: 0 }); };
function playerControl(p, dt) {
  if (p.dead) return;
  const I = p.pad, dx = I.dx(), dy = I.dy();
  tickPassives(p, dt);
  tickCharges(p, dt);
  const Cc = CLASSES[p.cls]; if (Cc.preControl && Cc.preControl(p, I, dt)) return;   // 职业的每帧前置处理（所有状态都调；弹药专家 单兵推进器 / 姿态恢复）；true = 这一帧不再往下走
  if (p.reboundCd > 0) p.reboundCd -= dt;
  if (p.bsCd > 0) p.bsCd -= dt;
  // 后跳-强化的脱身：受击 / 倒地中 ↓+C（优先于受身）
  if ((p.st === 'hit' || p.st === 'down') && I.buffered('jump') && I.is('down') && p.z <= 1 && bsupReady(p)) { I.consume('jump'); escapeBackstep(p); return; }
  // 受击 / 倒地中才能放的技能（替身草人、幻鬼步、心灵反击……）
  if ((p.st === 'hit' || p.st === 'down' || p.st === 'air') && tryWhenHit(p)) return;
  // 受身蹲伏：倒地后按 C；蹲伏中按住 C 延长，松开起身
  if (tryTech(p)) return;
  if (p.st === 'getup' && p.techHold) { holdTech(p, I); return; }
  // 倒地 / 起身中的派生（例：女枪 倒地时按 X = 起身上旋踢）
  if ((p.st === 'down' && p.stT > 0.1) || (p.st === 'getup' && !p.tech)) { if (tryKeyLinks(p, CLASSES[p.cls].getupLinks, I)) { p.downHits = 0; p.juggle = 0; p.invul = Math.max(p.invul, 0.15); return; } }
  if (!p.free && p.st !== 'act') return;   // 硬直 / 浮空 / 倒地 / 起身 / 被抓
  // 后跳：↓ + C（站立、普攻中随时；技能中要有后跳-强化）
  if (I.buffered('jump') && I.is('down') && p.z <= 1) { const m = backstepMode(p); if (m) { I.consume('jump'); doBackstep(p, m); return; } }
  // 动作自己处理输入（流心的 X/C/Z、移动射击、天雷落点、连按追加……）
  if (p.st === 'act' && p.act && p.act.onInput && p.act.onInput(p, I, dt)) return;
  // 动作中的派生键（例：滑铲中按 X = 起身上旋踢）
  if (p.st === 'act' && p.act && p.act.keyLinks && p.actT >= (p.act.linkFrom || 0) && tryKeyLinks(p, p.act.keyLinks, I)) return;
  // ---- 技能（按取消规则打断普攻 / 白名单里的技能）----
  if (trySkill(p)) return;
  // ---- 动作中：普攻连段 ----
  if (p.st === 'act' && p.act) {
    const a = p.act;
    if (a.airOnly && Cc.airControl && Cc.airControl(p, I, dt)) return;   // 空中动作（跳攻 / 空中技能）中也交给职业的空中钩子（魔道学者扫把、弹药专家急降）；自己看 p.act
    const nx = typeof a.next === 'function' ? a.next(p) : a.next;
    if (a.chain && nx && p.actT >= a.chain[0] && (I.buffered('attack') || (a.hold !== false && a.basic && I.is('attack') && p.actT >= a.chain[0] + 0.04))) {
      if (!a.airOnly || p.airAtk < airMaxOf(p)) { I.consume('attack'); faceInput(p, dx); if (a.airOnly) p.airAtk++; p.doAct(p.acts[nx]); return; }
    }
    // 空中攻击期间允许轻微的空中移动
    if (a.airOnly) p.vx = damp(p.vx, dx * p.speed * mspdOf(p) * 0.8, 6, dt);
    return;
  }
  // ---- 空中 ----
  if (p.st === 'jump') {
    if (Cc.airControl && Cc.airControl(p, I, dt)) return;   // 职业自己的空中操作（魔道学者 扫把：空中冲刺、缓降）；返回 true = 这一帧不走默认的空中处理
    if (tryKeyLinks(p, Cc.jumpLinks, I)) return;   // 跳跃中的派生（例：女漫游 地面连按 C C = 飞燕射击）
    const sp = (p.jumpRun ? p.runSpeed : p.speed) * mspdOf(p);
    p.vx = damp(p.vx, dx * sp, 5, dt); p.vy = dy * p.speed * 0.6;
    if (dx) p.face = dx;
    if (I.buffered('attack') && p.airAtk < airMaxOf(p)) { I.consume('attack'); p.airAtk++; p.doAct(p.acts.jatk); }
    return;
  }
  // ---- 地面 ----
  if (I.consume('jump')) { p.vz = p.jumpV; p.z = 0.5; p.jumpRun = p.st === 'run'; p.airAtk = 0; p.setState('jump'); sfx.jump(); return; }
  if (I.buffered('attack') && isHuman(p) && tryPickup(p)) { I.consume('attack'); return; }
  if (I.consume('attack')) {
    if (p.st === 'run') { p.doAct(p.acts.dash); return; }
    faceInput(p, dx); p.doAct(p.acts.atk1); return;
  }
  // 按住 X 一直打：一轮连击打完、被打断起身后，只要还按着就接着从第一下开始（不用松开再按）；跑动中不自动出冲刺攻击
  if (I.is('attack') && p.st !== 'run' && p.acts.atk1 && p.acts.atk1.hold !== false) { faceInput(p, dx); p.doAct(p.acts.atk1); return; }
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
// 每次跳跃的空中攻击次数上限（职业可以按武器改：CLASSES[cls].airMaxOf）
function airMaxOf(p) { const C = CLASSES[p.cls]; return (C.airMaxOf ? C.airMaxOf(p) : (C.airMax || 1)) + (p.airBonus || 0); }
// 派生键表 { attack | cmd | jump | cmdB: 技能id }：学会、能用、冷却好了就放
function tryKeyLinks(p, L, I) {
  if (!L) return false;
  for (const k in L) {
    const id = L[k]; if (!I.buffered(k) || !skillUsable(p, id) || (p.cool[id] || 0) > 0) continue;
    I.consume(k); if (castSkill(p, id, false, k)) return true;
  }
  return false;
}
/* ---- 受身蹲伏（官方现版：倒地后按 C 蹲伏，蹲着时无敌；按住 C 最长 3 秒，松开才起身，起身后 0.3 秒霸体；冷却 5 秒 / 决斗场 20 秒；耗 1 MP）---- */
function tryTech(p) {
  const I = p.pad;
  if (p.st !== 'down' || p.dead) return false;
  if (!I.buffered('jump') || p.reboundCd > 0 || p.stT < 0.05 || p.mp < 1) return false;
  I.consume('jump');
  p.z = 0; p.vz = 0; p.vx *= 0.2; p.startGetup(true); p.techHold = true; p.getupDur = 0.3; p.reboundCd = game.pvp ? TECH_CD_PVP : TECH_CD; p.mp -= 1;
  fxText('受身蹲伏', p.x, p.y, p.z, { col: '#8fd8ff', size: 11 }); fxDust(p.x, p.y, 4, 12);
  return true;
}
function holdTech(p, I) {
  if (I.is('jump') && p.stT < TECH_HOLD_MAX) { p.getupDur = Math.max(p.getupDur, p.stT + 0.1); p.invul = Math.max(p.invul, 0.15); return; }
  p.techHold = false; p.getupDur = p.stT + 0.12; p.invul = Math.max(p.invul, 0.12); p.superArmor = Math.max(p.superArmor, TECH_SA + 0.12);
}
/* ---- 后跳 ---- */
// 当前能否后跳：'free'（站立 / 普攻 / 后跳本身不行）、'up'（技能中，用后跳-强化）、null
function backstepMode(p) {
  if (p.free) return p.st !== 'jump' ? 'free' : null;
  const a = p.act; if (p.st !== 'act' || !a || a.airOnly || a.name === 'back') return null;
  if (a.basic || a.backOk) return 'free';
  if (a.skill) { const S = SKILLS[a.skill]; if (S && S.awaken) return null; return bsupReady(p) && p.actT >= 0.05 ? 'up' : null; }
  return null;
}
const canBackstep = p => !!backstepMode(p);
function doBackstep(p, mode) {
  if (mode === 'up') { p.bsCd = BSUP_CD_SKILL; p.doAct(p.acts.back || BACKSTEP, { escape: true, invul: true }); return; }
  p.doAct(p.acts.back || BACKSTEP);
}
function escapeBackstep(p) {
  p.interrupt(); p.stun = 0; p.z = 0; p.vz = 0; p.rot = 0; p.downHits = 0; p.juggle = 0; p.bounced = false; p.hitHeavy = false; p.techHold = false;
  p.bsCd = BSUP_CD_HIT; resetCmb(p);
  p.doAct(p.acts.back || BACKSTEP, { escape: true, invul: true });
}
/* ---- 取消规则 ---- */
// 当前动作能否被技能 id 打断
function canCancelInto(p, id) {
  if (p.st !== 'act' || !p.act) return true;
  const a = p.act, S = SKILLS[id];
  if (S && S.instant) return true;                                            // 无动作施放：不打断当前动作
  if (S && recastInstant(p, S)) return true;                                  // 无动作的再按（给召唤物下命令）：也不打断
  if (a.name === 'back') return !!(S && S.air) && p.actT >= 0.06;              // 后跳算空中：可以接空中技能
  if (a.basic) return !(S && (S.noForce ?? S.buff));                           // 强制：普攻随时可被攻击类技能取消
  const A = a.skill && SKILLS[a.skill];
  if (A && A.awaken) return false;
  const L = a.links || (A && A.links);
  if (L && L.includes(id) && p.actT >= (a.linkFrom ?? (A && A.linkFrom) ?? 0) && (!(a.hitCancel ?? (A && A.hitCancel)) || a.hitAny || p.hitsDone.size > 0)) return true;
  if (a.cancelable && a.cancelFrom !== undefined && p.actT >= a.cancelFrom) return true;   // 模式类动作（移动射击等）
  const C = CLASSES[p.cls]; if (C && C.cancelHook && C.cancelHook(p, a, id)) { p._soft = { a, id }; return true; }   // 职业专属柔化（女漫游「花式枪术」等）；真放出来才扣次数（softCommit）
  return false;
}
// 兼容旧调用：当前动作有没有可能被“某个”技能打断（AI 判断忙不忙用）
function canSkillCancel(p) { return p.st !== 'act' || !p.act || !!p.act.basic || !!p.act.links || !!p.act.cancelable; }
// 受击时才能放的技能：S.whenHit = true 或 fn(p) → 这个限制现在是否生效（例：战斗法师学了“实战型替身草人”后返回 false，平时也能放）；
// 限制生效时，只有 S.hitStates 里的状态（默认受击硬直 / 倒地）或受击后 S.hitWin 秒内能放；被抓、冰冻、眩晕时都不行
function whenHitOk(p, S) {
  if (!(typeof S.whenHit === 'function' ? S.whenHit(p) : !!S.whenHit)) return true;
  if ((p.status && (p.status.freeze || p.status.stun)) || p.st === 'held') return false;
  if ((S.hitStates || ['hit', 'down']).includes(p.st)) return true;
  return !!S.hitWin && game.t - (p.hurtT ?? -9) < S.hitWin;
}
// 空中 / 地面限制：空中只能放 air（或 airIf 满足）的技能，airOnly 的技能只能在空中放
function airOk(p, S) {
  const inAir = p.st === 'jump' || p.z > 2 || (p.st === 'act' && p.act && p.act.airOnly);
  if (!inAir) return !S.airOnly;
  const C = CLASSES[p.cls]; return !!(S.air || (S.airIf && S.airIf(p)) || (C && C.airOk && C.airOk(p, S)));   // 职业钩子：弹药专家有推进器次数时基础技能也能在空中放
}
// 技能现在能不能用（学会、转职、转职限制、前置条件、受击限制）：指令匹配时用来决定谁“占用”这个指令
function skillUsable(p, id) {
  const S = SKILLS[id]; if (!S || skillLvOf(p, id) <= 0) return false;
  if (isHuman(p) && !tierUnlocked(tierOf(S))) return false;
  if (S.job && S.job !== jobOf(p)) return false;
  if (typeof skillAllowed === 'function' && !skillAllowed(id, jobOf(p))) return false;
  if (S.req && S.req(p) !== true) return false;
  if (S.whenHit && !whenHitOk(p, S)) return false;
  return true;
}
// 再按技能键的“无动作”版本：S.recast.instant = true 或 fn(p)（只在 recast.ok(p) 时看）——人物不做动作、不打断当前动作（机械师 G-1 补射、G-3 召回……）
const recastInstant = (p, S) => !!(S.recast && S.recast.instant && S.recast.ok(p) && (typeof S.recast.instant !== 'function' || S.recast.instant(p)));
function castSkill(p, id, viaCmd, key) {
  let S = SKILLS[id]; if (!S || !(S.act || S.instant) || S.passive) return false;
  const human = isHuman(p), slot = barOf(p).indexOf(id), flash = msg => { if (human && slot >= 0) ui.flashSlot(slot, msg); return true; };
  const id0 = id; if (S.morph) { const m = S.morph(p); if (m && m !== id && SKILLS[m]) { id = m; S = SKILLS[m]; } }   // 某些状态下同一个键放另一个技能（没学替代技能时用原技能的等级）
  const lv = skillLvOf(p, id) || skillLvOf(p, id0);
  if (lv <= 0) return flash('未学习');
  if (S.job && S.job !== jobOf(p)) return flash('未转职');
  if (typeof skillAllowed === 'function' && !skillAllowed(id, jobOf(p))) return flash('无法使用');
  if (S.req) { const r = S.req(p); if (r !== true) return flash(typeof r === 'string' ? r : '条件不足'); }
  if (S.whenHit && !whenHitOk(p, S)) return flash('受击时才能用');
  if (S.noWtype && S.noWtype.includes(wtypeOf(p))) return flash('武器不符');
  if (human && !tierUnlocked(tierOf(S))) return flash('未觉醒');
  const dx0 = p.pad.dx();
  // 召唤物 / 放置物在场时再按技能键（召唤框架，见 docs/SKILLS_OFFICIAL_mage.md 第 6 节）：在冷却检查之前
  if (S.recast && S.recast.ok(p)) {
    if ((p.cool[id + '~'] || 0) > 0) return flash('冷却中');
    if (p.mp < (S.recast.mp || 0)) return flash('MP不足');
    p.cool[id + '~'] = S.recast.cd || 0.3; p.mp -= S.recast.mp || 0;
    if (recastInstant(p, S)) { S.recast.act(lv, p); const Ci = CLASSES[p.cls]; if (Ci.onCast) Ci.onCast(p, id, null, 'recast'); return true; }   // 不做动作、不改朝向
    if (dx0) p.face = dx0;
    p.doAct(S.recast.act(lv, p), { skill: id, lv, key: key || null, type: S.type || p.dmgType });
    const Cr = CLASSES[p.cls]; if (Cr.onCast) Cr.onCast(p, id, p.act, 'recast'); return true;
  }
  if ((p.cool[id] || 0) > 0) return flash('冷却中');
  const Q = chargesOf(p, id); if (Q && Q.n < 1) return flash('装填中');
  const Cp = CLASSES[p.cls], mp = Math.round(S.mp * (Cp.mpMul ? Cp.mpMul(p, id) : 1));   // 职业的 MP 消耗修正（枪炮师「重火器精通」）
  if (p.mp < mp) return flash('MP不足');
  if (!airOk(p, S)) return false;
  p.mp -= mp; p.cool[id] = S.cd * (p.cdMul || 1) * (game.pvp && S.pvpCd ? S.pvpCd : 1);
  if (Q) Q.n--;
  if (dx0) p.face = dx0;
  const extra = { skill: id, lv, key: key || null, type: S.type || p.dmgType };
  if (S.elem) extra.elem = S.elem;
  if (S.pvp) extra.pvp = S.pvp;
  if (S.speed || S.cast) extra.speed = S.speed || 'cspd';
  else if (!S.awaken && extra.type !== 'mag') extra.speed = 1 + (aspdOf(p) - 1) * 0.5;   // 物理技能：攻速一半生效（施法类技能看施放速度）
  const prev = p.act, soft = p._soft; p._soft = null;
  if (typeof S.instant === 'function') S.instant(lv, p, extra);
  else { if (p.st === 'hit' || p.st === 'down' || p.st === 'air') { p.interrupt(); p.stun = 0; } p.doAct(S.act(lv, p), extra); }
  const C = CLASSES[p.cls]; if (soft && soft.a === prev && soft.id === id && C.softCommit) C.softCommit(p, prev, id);
  if (C.onCast) C.onCast(p, id, typeof S.instant === 'function' ? null : p.act);   // 职业的施放钩子：扣完 MP / 冷却 / 装填、动作开始之后调（枪炮师：重火器拔击、精通叠层）；无动作施放 act = null，再按（recast）第 4 个参数 'recast'
  if (human) { game.onSkill(id); bus.emit('skillUse', { id }); }
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
  // 技能栏（被取消规则挡住的按键留在缓冲里，0.3 秒内动作结束还能放出来）
  for (let i = 0; i < SKILL_SLOTS; i++) {
    const key = 's' + i, id = bar[i];
    if (!id || !I.buffered(key) || !canCancelInto(p, id)) continue;
    I.consume(key);
    if (castSkill(p, id, false, key)) return true;
  }
  // 指令：方向 + Z（cmd）/ Space（cmdB，Buff 类）/ X / C。同一指令只生效一个技能（千海天规则：基础冷却长的优先，一样长时学习等级高的优先）
  const C = CLASSES[p.cls];
  if (!C.cmdsSorted) C.cmdsSorted = [...C.cmds].sort((a, b) => cmdRank(b[0]) - cmdRank(a[0]) || (SKILLS[b[1]] ? SKILLS[b[1]].cd : 0) - (SKILLS[a[1]] ? SKILLS[a[1]].cd : 0) || (SKILLS[b[1]] ? SKILLS[b[1]].lvReq : 0) - (SKILLS[a[1]] ? SKILLS[a[1]].lvReq : 0));
  for (const key of CMD_KEYS) {
    if (!I.buffered(key)) continue;
    const claimed = new Set(); let blocked = false;
    for (const [seq, id, k2] of C.cmdsSorted) {
      const kk = CMD_KEY_OF[k2 || 'cmd'];
      if (kk !== key || !SKILLS[id] || !cmdMatch(I, seq, p.face, p)) continue;
      const sig = seq + '|' + kk; if (claimed.has(sig)) continue;
      if (!skillUsable(p, id) || !airOk(p, SKILLS[id])) continue;
      if (seq !== '' && isHuman(p) && typeof cmdLocked === 'function' && cmdLocked(id)) continue;   // 技能窗口里锁定了指令（界面组 cmdLocked，读 save.data.opts.cmdLock）：只能用快捷栏释放
      claimed.add(sig);
      if ((p.cool[id] || 0) > 0 && !(SKILLS[id].recast && SKILLS[id].recast.ok(p))) continue;
      if (!canCancelInto(p, id)) { blocked = true; continue; }
      I.consume(key);
      if (castSkill(p, id, seq !== '', key === 'cmdB' ? 'cmdB' : key)) return true;
    }
    if ((key === 'cmd' || key === 'cmdB') && !blocked) { I.consume(key); return false; }
  }
  return false;
}
// 受击 / 倒地 / 被打浮空中：只看 whenHit 技能（技能栏按键 + 指令）
function tryWhenHit(p) {
  const I = p.pad, bar = barOf(p);
  for (let i = 0; i < SKILL_SLOTS; i++) { const id = bar[i], S = id && SKILLS[id]; if (!S || !S.whenHit || !I.buffered('s' + i) || !skillUsable(p, id) || (p.cool[id] || 0) > 0) continue; I.consume('s' + i); if (castSkill(p, id, false, 's' + i)) return true; }
  const C = CLASSES[p.cls];
  for (const [seq, id, k2] of C.cmds) {
    const S = SKILLS[id], key = CMD_KEY_OF[k2 || 'cmd']; if (!S || !S.whenHit || !I.buffered(key) || !cmdMatch(I, seq, p.face, p) || !skillUsable(p, id) || (p.cool[id] || 0) > 0) continue;
    I.consume(key); if (castSkill(p, id, seq !== '', key)) return true;
  }
  return false;
}
// 指令表第三项（按键）→ 输入动作名：省略 = Z（cmd）、'buff' = Space（cmdB）、'attack' = X、'jump' = C
const CMD_KEY_OF = { cmd: 'cmd', buff: 'cmdB', attack: 'attack', jump: 'jump' };
const CMD_KEYS = ['cmdB', 'cmd', 'attack', 'jump'];
// 指令优先级：长指令 > 按住方向 > 单方向 > 无方向
const cmdRank = s => s === 'hold' || s === 'holdd' ? 1.5 : s === 'hit' ? 0.5 : s === '' ? 0 : s.length + (s.length === 1 ? 0.2 : 0);
const HIT_WIN = 1;   // 「(被击时) Z」：受击 / 倒地中，或受击后 1 秒内
const HOLD_MIN = 0.18;   // 「按住 ↓ + Z」：↓ 要先按住这么久（避免和 ↓+Z 抢指令）
function cmdMatch(I, seq, face, p) {
  if (seq === '') return true;
  if (seq === 'hit') return !!p && (p.st === 'hit' || p.st === 'down' || game.t - (p.hurtT ?? -9) < HIT_WIN);
  const fw = face > 0 ? 'right' : 'left', bw = face > 0 ? 'left' : 'right';
  if (seq === 'hold') return I.is(fw);
  if (seq === 'holdd') return I.heldFor('down') >= HOLD_MIN;
  if (seq.length === 1) { const d = { f: fw, b: bw, u: 'up', d: 'down' }[seq]; return I.is(d) || I.command(seq, face); }
  return I.command(seq, face);
}
