/* =====================================================================
   12. 职业技能公共部分：技能登记、转职工具、被动 / BUFF、常用的攻击与投射物构件
   ---------------------------------------------------------------------
   技能定义 defSkill(id, { name, cls, job?, lvReq, maxLv, mp, cd, desc, type('phys'|'mag'|'indep'), elem?, air?, airOnly?,
     passive?(被动，没有 act), buff?, awaken?, pvp?(决斗场伤害修正), pvpCd?, speed?, cast?,
     lvStep?(学到第 n 级需要 lvReq + (n−1)×lvStep 级；默认基础技能 2、转职 / 觉醒技能 1), sp?(每级固定 SP), pre?({ 技能id: 等级 } 前置),
     noForce?(不能强制中断普攻；Buff 默认 true), links?([技能id...] 本技能动作中可以接的技能白名单), linkFrom?(秒),
     charges?(装填次数上限), reload?(每颗补充秒数), noWtype?([武器类型...] 不能用), jobs?([转职...] 基础技能只有这些转职能用),
     recast?({ ok(p), act(lv,p), cd, mp }：召唤物在场时再按), instant?(fn(lv,p,extra)：无动作施放，不打断当前动作),
     pow(lv)（技能攻击力合计，用于提示）, ai:{ kind, r:[近,远], dy }（AI 用）, act(lv, p) → 动作定义 })
   伤害倍率 dmg 以“攻击力的倍数”计；技能等级成长用 skillDmg(基础, 每级, lv)
   ===================================================================== */
const SKILLS = {};
const skillDmg = (base, per, lv) => base + per * (lv - 1);
const pct = v => `${Math.round(v * 100)}%`;
function defSkill(id, S) {
  const s = SKILLS[id] = { id, maxLv: 10, type: undefined, ...S };
  // 官方技能系统：技能等级上限跟角色等级挂钩（lvStep）、每级 SP 固定（sp）。等级换算见 docs/SKILLS_OFFICIAL_common.md 第 7 节
  s.lvStep ??= s.job || s.awaken ? 1 : 2;
  s.sp ??= s.awaken ? 60 : s.passive ? 15 : s.job ? 25 : 20;
  if (!s.spCost) s.spCost = () => s.sp;
  if (!s.info) s.info = (lv, p) => {
    const L = [];
    if (s.pow) L.push(['技能攻击力', pct(s.pow(Math.max(1, lv)))]);
    if (s.infoExtra) L.push(...s.infoExtra(Math.max(1, lv), p));
    if (!s.passive) { L.push(['MP 消耗', String(s.mp)]); L.push(['冷却时间', s.cd + ' 秒']); }
    return L;
  };
  return s;
}
// 基础技能的转职限制：S.only = 只有这些转职能学 / 用，S.excl = 这些转职学不了（没转职时都能学）。例：EZ-8 自爆者只有机械师能学
function skillAllowed(id, job) { const S = SKILLS[id]; if (!S) return false; if (!job) return true; if (S.only && !S.only.includes(job)) return false; if (S.excl && S.excl.includes(job)) return false; return true; }
// 某个转职能学的全部技能：基础（按转职限制过滤）+ 该转职
function classSkills(cls, job) { const C = CLASSES[cls]; if (!C) return []; const J = job && C.jobs && C.jobs[job], base = C.skills.filter(id => skillAllowed(id, job)); return J ? base.concat(J.skills) : base; }
const CMD_KEY_TXT = { cmd: 'Z', attack: 'X', buff: 'Space', jump: 'C' };
const CMD_SEQ_TXT = { hold: '按住→', holdd: '按住↓' };
// 技能的指令文字（例如 "↓→+Z"），没有指令返回 ''
function cmdTextOf(id) {
  const S = SKILLS[id]; if (!S) return '';
  if (S.cmdNote) return S.cmdNote;
  const C = CLASSES[S.cls]; if (!C) return '';
  for (const [seq, sid, key] of C.cmds) if (sid === id) {
    const arrows = CMD_SEQ_TXT[seq] || [...seq].map(c => ({ f: '→', b: '←', u: '↑', d: '↓' })[c]).join('');
    return `${arrows}${arrows ? '+' : ''}${CMD_KEY_TXT[key || 'cmd']}`;
  }
  return '';
}
function cmdLabel(cls) { for (const id of classSkills(cls, null).concat(...Object.values(CLASSES[cls].jobs || {}).map(j => j.skills))) if (SKILLS[id]) { const t = cmdTextOf(id); SKILLS[id].cmdTxt = t ? '指令：' + t : ''; } }
/* ---- 通用技能（所有职业）：后跳-强化（官方 2022 通用被动，替代本作以前的闪避翻滚）。
   后跳（↓+C）和受身蹲伏（倒地时 C）是自带的动作，见 game/player.js ---- */
const COMMON_SKILLS = ['c_bsup'];
defSkill('c_bsup', { name: '后跳-强化', cls: null, lvReq: 10, maxLv: 1, sp: 50, mp: 0, cd: 0, passive: true, col: '#4a9ad8', cmdNote: '技能中 / 受击中 ↓+C',
  desc: '【被动】放技能的过程中（觉醒除外）可以按 ↓+C 强制后跳，冷却 40 秒；被击中、倒地、被击退时也可以按 ↓+C 后跳脱身，冷却 30 秒。两种用法共用冷却，不受冷却缩减影响。后跳过程中无敌，落地后 1 秒内也无敌。',
  infoExtra: () => [['技能中后跳冷却', BSUP_CD_SKILL + ' 秒'], ['受击中后跳冷却', BSUP_CD_HIT + ' 秒']] });
// 把通用技能挂到每个职业的技能表最前面（职业文件都加载完之后调用一次，见 content/sprites.js）
function addCommonSkills() { for (const c in CLASSES) { const L = CLASSES[c].skills; if (L) for (const id of [...COMMON_SKILLS].reverse()) if (!L.includes(id)) L.unshift(id); } }
// 是否学会（被动 / 转职技能要求转职一致）
const hasSkill = (p, id) => { const S = SKILLS[id]; return !!S && lvOf(p, id) > 0 && (!S.job || S.job === jobOf(p)) && skillAllowed(id, jobOf(p)); };
const skLv = (p, id) => hasSkill(p, id) ? lvOf(p, id) : 0;
// 转职完成后调用（任务组的转职流程）：重算属性、刷新指令文字、被动
function onJobChange(p, job) {
  p = p || game.player; if (!p) return;
  cmdLabel(p.cls); if (!p.kit && typeof recalcStats === 'function') recalcStats(p);
  // 转职后学不了的基础技能（例如战斗法师的杰克爆弹）：返还 SP、从技能栏移除
  if (isHuman(p) && game.skillLv && typeof skillAllowed === 'function') {   // skillAllowed 由通用组提供（读 S.excl / S.only）
    let back = 0;
    for (const id of CLASSES[p.cls].skills) { const lv = game.skillLv[id] || 0, S = SKILLS[id]; if (!lv || skillAllowed(id, job)) continue;
      for (let l = 1; l <= lv; l++) back += typeof skCost === 'function' ? skCost(S, l) : typeof skillCost === 'function' ? skillCost(S, l) : 0;
      delete game.skillLv[id]; if (game.skillBar) game.skillBar.forEach((b, i) => { if (b === id) game.skillBar[i] = null; }); }
    if (back) { game.sp = (game.sp || 0) + back; if (save.data) save.data.sp = game.sp; }
  }
  const J = CLASSES[p.cls].jobs && CLASSES[p.cls].jobs[job];
  if (J && isHuman(p)) { fxAura(p, '#ffd23a', 1.4); fxText(J.name, p.x, p.y, p.z + 20, { col: '#ffe070', size: 16, dur: 1.4 }); }
}
// 被动技能：每 0.25 秒按条件刷新（p.buffs 里的伪 BUFF，t 很短；HUD 会显示图标）
function tickPassives(p, dt) {
  p._psvT = (p._psvT || 0) - dt; if (p._psvT > 0) return; p._psvT = 0.25;
  const C = CLASSES[p.cls]; if (!C.passives) return;
  for (const fn of C.passives) fn(p);
}
function setPassive(p, id, on, fx) { if (on) p.buffs[id] = { t: 0.4, passive: true, ...fx }; else if (p.buffs[id] && p.buffs[id].passive) delete p.buffs[id]; }
// BUFF 切换（再按一次关闭，例如血之狂暴）
function toggleBuff(p, id, dur, fx) { if (p.buffs[id]) { delete p.buffs[id]; fxText('解除', p.x, p.y, p.z + 10, { col: '#ccc', size: 10 }); return false; } p.buffs[id] = { t: dur, ...fx }; return true; }

// 觉醒插图：有转职插图（art/final/cutin/<转职>.webp）时用转职的，否则用职业的（HUD 按 who.cls 取 IMG['cutin/…']）
const cutinWho = e => { const j = jobOf(e); return j && IMG['cutin/' + j] ? { cls: j, model: e.model, x: e.x } : e; };
/* ---- 常用构件 ---- */
// 攻击判定：box = [前沿0, 前沿1, 纵深半宽, z0, z1]
const HB = (t0, t1, box, dmg, o) => ({ t0, t1, box, dmg, ...o });
// 找前方最近的敌人（没有就取前方固定距离）
function aimAhead(e, def, range, dyMax = 90) {
  let best = null, bd = 1e9;
  for (const o of ents) if (foe(e, o) && (o.x - e.x) * e.face > -10 && Math.abs(o.x - e.x) < range && Math.abs(o.y - e.y) < dyMax) { const d = Math.abs(o.x - e.x); if (d < bd) { bd = d; best = o; } }
  return best ? { x: best.x, y: best.y, t: best } : { x: e.x + e.face * def, y: e.y, t: null };
}
function nearestFoe(e, range = 9999, filter) {
  let best = null, bd = range;
  for (const o of ents) if (foe(e, o) && (!filter || filter(o))) { const d = Math.abs(o.x - e.x) + Math.abs(o.y - e.y) * 1.5; if (d < bd) { bd = d; best = o; } }
  return best;
}
// 以 (x,y) 为圆心的地面范围攻击（z < zMax 的目标）；h.radial = 从中心向外击退
function blast(e, x, y, r, h, o = {}) { areaHit(e, x, y, r, o.z || 0, { radial: true, ...h }, o); }
// 直线投射物（带素材）：o = { img, w, h(绘制尺寸), speed, life, z, hit, pierce, col, spin, trail, onEnd, bw, bd, bh(判定尺寸) }
function shootProj(e, o) {
  const face = o.face || e.face, sp = o.speed ?? 600, img = o.col ? fxTint(o.img, o.col) : IMG['fx/' + o.img];
  return spawnProj({ owner: e, x: e.x + face * (o.dx ?? 34), y: e.y + (o.dy || 0), z: e.z + (o.z ?? 60), vx: face * sp * (o.ang ? Math.cos(o.ang) : 1), vz: o.ang ? -sp * Math.sin(o.ang) : (o.vz || 0), vy: o.vy || 0,
    grav: o.grav || 0, face, life: o.life || 0.8, w: o.bw || 12, d: o.bd || 14, h: o.bh || 18, pierce: !!o.pierce, shadow: o.shadow, hit: o.hit, onEnd: o.onEnd, onHitT: o.onHitT,
    update(pr, dt) { if (o.floor !== false && pr.z <= 0 && pr.vz < 0) pr.t = pr.life; if (o.update) o.update(pr, dt); if (o.trail && Math.random() < 0.5) addFx({ x: pr.x - pr.face * 8, y: pr.y + 0.3, z: pr.z + 6, dur: 0.2, col: o.trail, draw(c) { const k = this.t / this.dur; c.fillStyle = this.col; c.globalAlpha = 0.7 * (1 - k); c.fillRect(sx(this.x) - 2, sy(this.y, this.z) - 2, 4, 4); c.globalAlpha = 1; } }); },
    draw(c, pr) { if (img) drawSpr(c, img, sx(pr.x), sy(pr.y, pr.z + (o.drawZ || 6)), o.w || 40, o.h || 0, { flip: pr.face < 0 && !o.noFlip, rot: o.spin ? pr.t * o.spin : o.rotV ? Math.atan2(-pr.vz, Math.abs(pr.vx)) * pr.face : 0, add: o.add !== false, ay: o.ay }); } });
}
// 抛物线投掷物：落到 (tx,ty) 时触发 onLand
function lobProj(e, tx, ty, T, o) {
  const x0 = e.x + e.face * 14, z0 = e.z + (o.z0 ?? 70), vz0 = o.vz ?? 260;
  return spawnProj({ owner: e, x: x0, y: e.y, z: z0, vx: (tx - x0) / T, vy: (ty - e.y) / T, vz: vz0, grav: (z0 + vz0 * T) * 2 / (T * T), life: 4, w: 8, d: 8, h: 10, face: e.face, pierce: true, shadow: o.shadow ?? 6,
    hit: o.hit || null, spin: 0, update(pr, dt) { pr.spin += dt * (o.spinV ?? 12); if (o.update) o.update(pr, dt); },
    onEnd(pr) { if (o.onLand) o.onLand(pr); },
    draw(c, pr) { drawSpr(c, o.img, sx(pr.x), sy(pr.y, pr.z), o.w || 0, o.h || 18, { add: !!o.add, rot: pr.spin }); } });
}
// 地面柱状判定（火柱 / 雷 / 血柱）：在 (x,y) 持续 life 秒，按 rep 间隔多段
function groundPillar(e, x, y, o) {
  return spawnProj({ owner: e, x, y, z: 0, face: e.face, life: o.life || 0.7, w: o.bw || 26, d: o.bd || 20, h: o.bh || 150, pierce: true, hit: o.hit,
    draw(c, pr) { const k = pr.t / pr.life, a = k < 0.1 ? k / 0.1 : k > 0.75 ? (1 - k) / 0.25 : 1, grow = easeOut(Math.min(1, k * 5)); if (o.ring !== false) drawSpr(c, 'shock', sx(pr.x), sy(pr.y, 0), o.ringW || 110, 0, { alpha: a * 0.6 }); drawSpr(c, o.img || 'pillar', sx(pr.x) + Math.sin(game.t * 30) * 1.5, sy(pr.y, 0) + 8, 0, (o.drawH || 175) * grow, { ay: 1, alpha: a }); } });
}
// 刀光 / 斩击特效的快捷写法
const fxSlashOn = (e, o) => fxSlash({ x: e.x, y: e.y, z: e.z, face: e.face, col: e.slashCol || '#8fd8ff', ...o });
// 普攻 / 技能伤害的属性成长小工具
const lvMul = (lv, per = 0.1) => 1 + per * (lv - 1);
