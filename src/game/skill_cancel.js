/* =====================================================================
   技能后摇取消（DNF 式，所有职业通用、数据驱动）：技能命中以后，进入后摇就能直接放别的攻击技能，不用等后摇放完
   官方依据见 docs/SKILLS_OFFICIAL_common.md §5.3：取消是“命中确认 + 后摇”（冰结师 2015 改版、战斗法师 2024「尼巫的战术」），
   被取消的技能后面的打击直接没了；有的技能不能被取消（例：韩服 이단심판관「차륜형」）；决斗场里技能连携 / 取消会加冷却（Nexon 결투장 패치）。
   规则（canCancelInto 里，在 links 白名单 / 模式动作之后、职业柔化 cancelHook 之前）：
     从：当前是技能动作（不是普攻 / 觉醒 / 抓取中 / 蓄力中 / 3 秒以上的持续动作），而且这一招已经打中过（近身判定 hitsDone，或这一招放出的投射物 / 直接 applyHit 打中）
     时机：actT ≥ 取消点。默认 = 最后一个攻击判定结束 / 最后一个事件（事件里出手：instantHit、放子弹、换一组判定）里更晚的那个 + 0.05 秒；
           都没有取 60%；不超过动作时长的 80%（动作中途改 hits 的每帧现算）
     到：别的攻击技能（不是同一个、不是 BUFF / 姿态 / 被动 / 无动作施放；觉醒另有 awkCancelOk）
   数据字段（写在 SKILLS[id] 或动作上，动作上的优先）：
     cancelAt: 秒      这一招的取消点（覆盖默认）；cancelAt: false 或 noCancel: true = 这一招不能被通用取消
     cancelNoHit: true 不需要命中也能在取消点之后取消（位移 / 设置类）
     noCancelInto: true 不能用来取消别的技能（例：需要完整起手的大招）
     pvpNoCancel / pvpNoCancelInto：只在决斗里禁用（SKILL_CANCEL.pvp = false 整个决斗关掉）
   决斗：通过通用取消放出来的技能冷却 ×pvpCdMul（官方：决斗场连携取消加冷却）。AI 判断“忙不忙”的 canSkillCancel 不变，AI 打法和决斗平衡不受影响
   关掉：网址加 ?nocancel（对比手感用）
   ===================================================================== */
const SKILL_CANCEL = { on: !PARAMS.has('nocancel'), pvp: true, after: 0.05, maxK: 0.8, noHitK: 0.6, longDur: 3, pvpCdMul: 1.2 };
const scVal = (a, A, k) => a[k] !== undefined ? a[k] : A ? A[k] : undefined;
// 这一招的取消点（动作时间，和 actT 同单位）；null = 不能通用取消
function skillCancelAt(a, A) {
  if (!a || !A || A.awaken || a.basic) return null;
  if (scVal(a, A, 'noCancel') || scVal(a, A, 'cancelAt') === false) return null;
  const dur = a.dur || 0, at = scVal(a, A, 'cancelAt');
  if (typeof at === 'number') return at;
  if (!(dur > 0) || dur >= SKILL_CANCEL.longDur || a.grab || a.charge || a.hold) return null;
  let t = -1;   // 判定和事件都算（事件里常有 instantHit / 放子弹 / 中途换一组判定），取最晚的；动作里中途改 hits 的，每次现算
  if (a.hits) for (const h of a.hits) { if (h.grab) return null; t = Math.max(t, h.t1); }
  if (a.events) for (const ev of a.events) if (ev.t <= dur) t = Math.max(t, ev.t);
  if (t < 0) t = dur * SKILL_CANCEL.noHitK - SKILL_CANCEL.after;
  return Math.min(t + SKILL_CANCEL.after, dur * SKILL_CANCEL.maxK);
}
// 能当“取消进去”的技能：攻击技能
function skillCancelTarget(p, id, A) {
  const S = SKILLS[id];
  if (!S || !S.act || S.passive || S.awaken || S.buff || S.noCancelInto || (A && id === p.act.skill)) return false;
  const k = S.ai && S.ai.kind; if (k === 'buff' || k === 'stance' || k === 'mode') return false;
  return !(typeof S.noForce === 'function' ? S.noForce(p) : S.noForce);
}
function skillCancelOk(p, id) {
  if (!SKILL_CANCEL.on || p.st !== 'act' || !p.act) return false;
  const a = p.act, A = a.skill && SKILLS[a.skill];
  if (!A || p.grabbed || a.charging) return false;
  if (game.pvp && (!SKILL_CANCEL.pvp || scVal(a, A, 'pvpNoCancel') || (SKILLS[id] && SKILLS[id].pvpNoCancelInto))) return false;   // 决斗单独开关 / 单个技能决斗里不能取消（官方：决斗场部分后摇取消禁用）
  const at = skillCancelAt(a, A); if (at === null || p.actT < at) return false;
  if (!scVal(a, A, 'cancelNoHit') && !(a.hitAny || p.hitsDone.size > 0)) return false;
  return skillCancelTarget(p, id, A);
}
// castSkill 放出来以后（p._gcancel 是 canCancelInto 放行时记下的）：决斗冷却加成、计数
function skillCancelCommit(p, prev, id) {
  if (game.pvp && p.cool[id] > 0) p.cool[id] *= SKILL_CANCEL.pvpCdMul;
  p.cancelN = (p.cancelN || 0) + 1;
  if (p.act) p.act.viaCancel = prev.skill || true;
}
// 命中确认：投射物记下是哪一招放出的；这一招还在放的时候打中了就算这一招命中（近身判定本来就记在 hitsDone）
{ const sp0 = spawnProj; spawnProj = function (o) { const pr = sp0(o); if (pr && o && o.owner && o.owner.act && pr.srcAct === undefined) pr.srcAct = o.owner.act; return pr; }; }
{ const ah0 = applyHit; applyHit = function (a, t, h, opt) {
  const r = ah0(a, t, h, opt);
  if (r && a && a.fighter && a.act && a.act.skill && t && t !== a && t.team !== a.team) {
    const src = opt && opt.proj ? opt.srcProj : null;
    if (!opt || !opt.proj || !src || src.srcAct === a.act) a.act.hitAny = true;
  }
  return r;
}; }
// 自己处理输入的动作（onInput：连按追加、待命派生……；keyLinks）会吞掉技能键：后摇取消先过一遍（只认通用取消放行的技能，觉醒走 tryAwk）
function tryCancelSkill(p) {
  if (!SKILL_CANCEL.on || p.st !== 'act' || !p.act || !(p.act.hitAny || p.hitsDone.size > 0)) return false;
  const I = p.pad, bar = barOf(p), a = p.act;
  const go = (id, key, viaCmd) => { if (!skillCancelOk(p, id) || !skillUsable(p, id) || (p.cool[id] || 0) > 0 || !airOk(p, SKILLS[id])) return false; I.consume(key); p._gcancel = { a, id }; return castSkill(p, id, viaCmd, key); };
  for (let i = 0; i < SKILL_SLOTS; i++) { const id = bar[i]; if (id && SKILLS[id] && !SKILLS[id].awaken && I.buffered('s' + i) && go(id, 's' + i, false)) return true; }
  for (const [seq, id, k2] of CLASSES[p.cls].cmds) { const key = CMD_KEY_OF[k2 || 'cmd']; if (seq !== '' && SKILLS[id] && !SKILLS[id].awaken && I.buffered(key) && cmdMatch(I, seq, p.face, p) && go(id, key, true)) return true; }
  return false;
}
