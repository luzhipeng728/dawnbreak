/* =====================================================================
   转职：弹药专家（女）—— 国服现版（docs/SKILLS_OFFICIAL_gun.md 第 7 节）。固伤（技能按独立攻击力 indep 结算），皮甲，擅长步枪 / 手弩
   - 单兵推进器：每跳 7 次（02X 后 8 次）空中动作——空中 C 上升、空中 ←/→+C 水平冲刺、空中 ↓+C 空中后跳、空中 Space 急降、
     被打浮空时按 C 姿态恢复、空中每放一个技能耗 1 次；落地回满；地面普攻中按 C 取消成跳跃；空中射击常驻
   - 弹药：超负荷装填（→→+Space，施放时按方向键选属性：→ 火 / ← 冰 / ↑ 光 / ↓ 无，不按就轮换）决定子弹和射击技能的属性；
     特性弹 / 贯穿弹 / 爆裂弹 三选一（互斥）改变普攻子弹；不开超负荷，这些技能放不了
   - 手雷：G-14（基础）/ G-35L 感电 / G-18C 冰冻 各 3 颗装填；地面投掷间隔 3 秒（↑↓ 调距离），空中 0.5 秒、角度固定
   - 一觉 战争女神（EMP 磁暴）→ 二觉 芙蕾雅（决战之日）→ 三觉 重霄·弹药专家（终解·制空霸权）
   依赖的共享钩子（通用组）：CLASSES.gun.preControl / airControl / airOk / onCast / shotMod / skillMul；召唤框架 summon.js（魔法师组）
   ===================================================================== */
const SF = 'spitfire';
const isSf = p => !!p && jobOf(p) === SF;
const SF_ELEM = [['fire', '火', '#ff7a3a'], ['ice', '冰', '#8fe0ff'], ['light', '光', '#fff38a'], [null, '无', '#e8e8f0']];
const sfElemCol = el => (SF_ELEM.find(x => x[0] === el) || SF_ELEM[3])[2];
const sfElemName = el => (SF_ELEM.find(x => x[0] === el) || SF_ELEM[3])[1];
const SF_BULLETS = ['gs_elem', 'gs_pierce', 'gs_burst'];
const SF_GRENADES = ['g_grenade', 'gs_g35', 'gs_g18'];
const sfOver = p => p.buffs && p.buffs.gs_overcharge;
const sfElem = p => { const b = sfOver(p); return b ? b.elem : null; };
const sfMode = p => { if (!p.buffs) return null; for (const id of SF_BULLETS) if (p.buffs[id]) return id; return null; };
const sfNeedOver = p => sfOver(p) ? true : '需要超负荷装填';
const sfLv = (p, id) => isSf(p) ? skLv(p, id) : 0;
sfx.sfNitro = function (v = 1) { this.noise('bandpass', 900, 2400, 0.16, 0.22 * v, 0.9); this.tone('sawtooth', 160, 420, 0.12, 0.05 * v); };
sfx.sfBeep = function () { this.tone('square', 1800, 1800, 0.05, 0.05); };
sfx.sfZap = function (v = 1) { this.noise('highpass', 3000, 6000, 0.12, 0.2 * v, 1.2); this.tone('square', 880, 220, 0.1, 0.05 * v); };
sfx.sfFreeze = function () { this.noise('highpass', 5000, 8000, 0.3, 0.18, 0.6); this.tone('sine', 1400, 700, 0.2, 0.06); };

/* ---- 单兵推进器 ---- */
const NITRO_CD = 0.5;   // 空中上升 / 冲刺之间的间隔（官方 0.5 秒）
const nitroMax = p => 7 + (sfLv(p, 'gs_02x') > 0 ? 1 : 0);
function nitroLeft(p) { if (p.nitro === undefined) p.nitro = nitroMax(p); return p.nitro; }
const standbyOn = p => !!(p.buffs && p.buffs.gs_standby);
function useNitro(p, n = 1) { if (standbyOn(p)) return true; if (nitroLeft(p) < n) return false; p.nitro -= n; p._nitroT = game.t; return true; }
const sfCanAir = p => isSf(p) && (standbyOn(p) || nitroLeft(p) >= 1);
// 推进器喷焰（腰后的蓝色喷口；dir: 'up' 向下喷、'fwd' 向后喷、'down' 向上喷）
function nitroFx(e, dir) {
  sfx.sfNitro(dir === 'down' ? 0.7 : 1);
  const rot = dir === 'up' ? Math.PI / 2 : dir === 'down' ? -Math.PI / 2 : (e.face > 0 ? Math.PI : 0);
  for (let i = 0; i < 3; i++) addFx({ ent: e, dur: 0.22 + i * 0.05, y: e.y + 0.2, rot, i, add: true, update() { this.y = this.ent.y + 0.2; },
    draw(c) { const k = this.t / this.dur, E = this.ent, X = sx(E.x - E.face * 8), Y = sy(E.y, E.z + 42);
      drawSpr(c, fxTint('flame', '#6ac8ff'), X + Math.cos(this.rot) * (10 + k * 26 + this.i * 8), Y - Math.sin(this.rot) * (10 + k * 26 + this.i * 8), 46 * (1 - k * 0.5), 20 * (1 - k * 0.5), { rot: -this.rot, alpha: 1 - k }); } });
  fxDust(e.x, e.y, e.z < 20 ? 4 : 0, 10, '#9ac8e8');
}
// 空中上升：算一次新的跳跃（跳射次数重算）；可以接跳射（普攻）
const SF_RISE = { name: 'sfRise', clip: 'sfUp', dur: 0.22, basic: true, airOnly: true, sfNitro: true, noCounter: true, chain: [0.05, 0.22], next: 'jatk', hold: true,
  onStart: e => { e.vz = 440; e.airAtk = 0; nitroFx(e, 'up'); } };
// 空中水平冲刺：贴着当前高度冲出一段
const SF_DASH = { name: 'sfDash', clip: 'sfDash', dur: 0.26, basic: true, airOnly: true, sfNitro: true, noCounter: true, lowGrav: 0.02, chain: [0.12, 0.26], next: 'jatk', hold: true, move: [[0, 0.22, 560, 0]],
  onStart: e => { e.vz = 0; nitroFx(e, 'fwd'); fxAfterimage(e, '#8fd8ff'); } };
// 空中急降：垂直（或按住 ←/→ 斜向）高速落地
const SF_DIVE = { name: 'sfDive', clip: 'sfDive', dur: 1.2, airOnly: true, sfNitro: true, noCounter: true,
  onStart: e => { e.vz = -950; nitroFx(e, 'down'); }, onLand: e => { fxDust(e.x, e.y, 6, 16, '#a8b8c8'); sfx.thud(0.5); e.vx *= 0.2; e.endAct(); } };
// 姿态恢复：被打浮空时按 C（耗 1 次）
function nitroRecover(p) {
  p.interrupt(); p.stun = 0; p.rot = 0; p.juggle = 0; p.downHits = 0; p.bounced = false; p.bouncing = false; p.hitHeavy = false; resetCmb(p);
  p.vz = Math.max(p.vz, 300); p.vx *= 0.3; p.airAtk = 0; p.setState('jump'); p.invul = Math.max(p.invul, 0.3);
  fxText('姿态恢复', p.x, p.y, p.z + 20, { col: '#8fd8ff', size: 11 }); nitroFx(p, 'up');
}
// 每帧（CLASSES.gun.preControl）：落地回满、姿态恢复、地面普攻 C 取消成跳跃、空中 C 上升 / ←→+C 冲刺 / ↓+C 空中后跳、手雷装填加速、空袭战略悬停
function sfPreControl(p, I, dt) {
  if (p.dead) return false;
  if (p.nitroCd > 0) p.nitroCd -= dt;
  sfHudFx(p); sfTickGrenades(p, dt); sfTickStandby(p, dt);
  if (p.z <= 0.01 && p.vz <= 0 && p.st !== 'air' && !standbyOn(p)) { const m = nitroMax(p); if (p.nitro !== m) p.nitro = m; }
  if (!I.buffered('jump')) return false;
  if ((p.st === 'air' || (p.st === 'hit' && p.z > 2)) && !(p.status && (p.status.freeze || p.status.stun || p.status.sleep))) {
    if (nitroLeft(p) < 1) return false;
    I.consume('jump'); useNitro(p, 1); nitroRecover(p); return true;
  }
  const a = p.act;
  if (p.st === 'act' && a && a.basic && !a.airOnly && a.name !== 'back' && p.z <= 1 && !I.is('down')) {
    I.consume('jump'); p.interrupt(); p.vz = p.jumpV; p.z = 0.5; p.jumpRun = false; p.airAtk = 0; p.setState('jump'); sfx.jump(); return true;
  }
  const airBasic = p.st === 'act' && a && a.airOnly && (a.basic || a.sfNitro) && a.name !== 'sfDive';
  if ((p.st === 'jump' || airBasic) && p.z > 1 && !standbyOn(p)) {
    I.consume('jump');
    if (p.nitroCd > 0 || nitroLeft(p) < 1) return true;
    useNitro(p, 1); p.nitroCd = NITRO_CD;
    if (I.is('down')) { p.doAct(p.acts.back || BACKSTEP); nitroFx(p, 'fwd'); return true; }
    const dx = I.dx(); if (dx) p.face = dx;
    p.doAct(dx ? SF_DASH : SF_RISE); return true;
  }
  return false;
}
// 空中 Space（CLASSES.gun.airControl，trySkill 没有放出技能时才会走到）：急降
function sfAirControl(p, I) {
  if (!I.hit('cmdB') || p.z < 8 || standbyOn(p) || nitroLeft(p) < 1 || (p.act && !(p.act.basic || p.act.sfNitro)) || (p.act && p.act.name === 'sfDive')) return false;
  I.consume('cmdB'); useNitro(p, 1); const dx = I.dx(); if (dx) p.face = dx;
  p.doAct(SF_DIVE); p.vx = dx * 320; return true;
}
// 推进器次数 / 超负荷属性的小指示（头顶；空中或次数不满时显示）
function sfHudFx(p) {
  if (p._sfHud && fxList.indexOf(p._sfHud) >= 0) return;
  p._sfHud = addFx({ ent: p, y: p.y + 0.4, dur: 1e9, update() { const e = this.ent; this.y = e.y + 0.4; if (e.dead || ents.indexOf(e) < 0 || !isSf(e)) this.t = this.dur; },
    draw(c) {
      const e = this.ent, n = nitroLeft(e), m = nitroMax(e), show = (e.z > 2 || n < m) && game.scene !== 'town';
      const X = sx(e.x), Y = sy(e.y, e.z + e.h + 12);
      if (show) {
        const w = 7, x0 = X - (m * w) / 2;
        c.fillStyle = 'rgba(8,16,28,.6)'; c.fillRect(x0 - 2, Y - 3, m * w + 3, 7);
        for (let i = 0; i < m; i++) { c.fillStyle = standbyOn(e) ? '#ffd23a' : i < n ? '#6ad8ff' : '#2a3a4a'; c.fillRect(x0 + i * w, Y - 1, w - 2, 3); }
      }
      const b = sfOver(e); if (b && game.t - (b.shownT || -9) < 1.6) { const k = (game.t - b.shownT) / 1.6; c.globalAlpha = 1 - k * k;
        c.fillStyle = sfElemCol(b.elem); c.beginPath(); c.arc(X, Y - 12, 6, 0, TAU); c.fill(); c.globalAlpha = 1; }
    } });
}

/* ---- 手雷（G-35L / G-18C / 空袭战略的强化手雷；G-14 是基础技能）----
   地面：↑ 投远、↓ 投近，碰到敌人立刻爆炸；空中：固定角度斜向下投。 o = { img, col, r, dmg, elem, onBoom(pr) } */
function sfGrenade(e, o) {
  const air = e.z > 2;
  let tx, ty;
  if (air) { tx = e.x + e.face * (70 + e.z * 0.55); ty = e.y; }
  else { const dy = e.pad ? e.pad.dy() : 0, dist = 220 + (dy < 0 ? 100 : dy > 0 ? -100 : 0), at = aimAhead(e, dist, dist + 60); tx = at.t ? at.x : e.x + e.face * dist; ty = at.t ? at.y : e.y; }
  const boom = pr => { if (pr.boomed) return; pr.boomed = true; pr.t = pr.life; o.onBoom(pr); };
  const img = IMG['fx/' + o.img] ? o.img : fxTint('grenade', o.col);
  const pr = lobProj(e, tx, ty, air ? 0.34 : 0.5, { img, h: 16, z0: air ? 20 : 70, vz: air ? 40 : 260, onLand: boom,
    update: q => { if (q.boomed) return; for (const t of ents) if (foe(e, t) && !t.dead && Math.abs(t.x - q.x) < t.w + 8 && Math.abs(t.y - q.y) < 16 && q.z < t.z + t.hurtH()) { boom(q); break; } } });
  pr.sfGrenade = boom;   // 超真空弹会把附近的手雷吸过去一起引爆
  return pr;
}
// 手雷装填：兵器研究 +30% 装填速度；空袭战略中每种手雷至少留 1 颗
function sfTickGrenades(p, dt) {
  const fm = sfLv(p, 'gs_firearm') > 0 && sfRifle(p), st = standbyOn(p);
  if (!fm && !st) return;
  for (const id of SF_GRENADES) { const Q = chargesOf(p, id); if (!Q) continue; if (fm && Q.n < SKILLS[id].charges) Q.t += dt * 0.3; if (st && Q.n < 1) Q.n = 1; }
}
const sfRifle = p => { const w = wtypeOf(p); return w === 'rifle' || w === 'bowgun'; };

/* ---- 普攻子弹（CLASSES.gun.shotMod）：属性、三种子弹、弹药改良、兵器研究（普攻按独立攻击力）、弹药强化（过电流）---- */
const sfBulletAtk = p => { const m = sfMode(p); return m ? 0.15 + 0.03 * (skLv(p, m) - 1) + 0.02 * sfLv(p, 'gs_nitro') : 0; };
function sfShotMod(e, o) {
  const el = sfElem(e), mode = sfMode(e), booster = sfLv(e, 'gs_booster');
  const H = { ...(o.hit || {}) }, on0 = H.onHit;
  o = { ...o, hit: H, dmg: (o.dmg || 0.5) * (1 + sfBulletAtk(e)) };
  if (sfLv(e, 'gs_firearm') > 0) H.type = 'indep';
  if (el && !(e.buffs && e.buffs.g_silver)) { H.elem = el; o.col = sfElemCol(el); }
  if (booster) { if (!o.pierce && Math.random() < 0.04 * booster) o.pierce = true; H.stun = (H.stun ?? 0.22) * (1 + 0.07 * booster); }
  const extra = [];
  if (mode === 'gs_elem') {
    const lv = skLv(e, 'gs_elem');
    extra.push((a, t) => { if (Math.random() >= 0.25) return; const k = el || 'stun';
      if (k === 'fire') addStatus(t, 'burn', 2, { src: a, dps: atkOf(a, 'indep') * (0.06 + 0.006 * lv) });
      else if (k === 'ice') addStatus(t, 'freeze', 2, { src: a });
      else if (k === 'light') addStatus(t, 'shock', 2, { src: a, hitDmg: atkOf(a, 'indep') * (0.06 + 0.006 * lv) });
      else addStatus(t, 'stun', 2, { src: a }); });
  } else if (mode === 'gs_pierce') { o.pierce = true; o.life = (o.life || 0.52) * 1.2; o.speedMul = 1.5; }
  else if (mode === 'gs_burst' && !o.cannon) {
    o.pierce = false; const d = o.dmg * 0.6;
    extra.push((a, t) => { const x = t.x, y = t.y; fxSpr('explosion', x, y, t.z + 30, { w: 60, dur: 0.3, col: el ? sfElemCol(el) : undefined }); sfx.boom(0.25);
      areaHit(a, x, y, 42, 0, { dmg: d, type: H.type || 'phys', elem: el || undefined, knock: 40, stun: 0.2, hs: 0.02, col: sfElemCol(el) }, { zMax: 120 }); });
  }
  if (extra.length) H.onHit = (a, t, dmg) => { if (on0) on0(a, t, dmg); for (const f of extra) f(a, t, dmg); };
  return o;
}
// 过电流（弹药强化，一觉被动）：所有攻击命中时给目标挂 20 秒，受到的伤害提高
defSummon('gs_oc', { kind: 'attach', life: 20, max: 60, over: 'oldest', keepRoom: false, tags: ['oc'],
  onSpawn(s) { const h = s.host; h.buffs = h.buffs || {}; h.buffs.gs_oc = { t: 1e9, taken: s.amt || 0.12 }; },
  onEnd(s) { const h = s.host; if (h && h.buffs && h.buffs.gs_oc) delete h.buffs.gs_oc; },
  draw(c, s) { if (Math.floor(game.t * 10 + s.sid) % 7) return; const h = s.host; drawSpr(c, fxTint('spark', '#8fd0ff'), sx(h.x + rnd(-10, 10)), sy(h.y, h.z + rnd(20, h.h * 0.8)), 20, 0, { alpha: 0.8 }); } });
function sfOvercurrent(a, t) {
  const lv = sfLv(a, 'gs_arsenal'); if (!lv || !t || t.dead || t.fighter && !game.pvp) return;
  const amt = 0.12 + 0.015 * (lv - 1), s = summonsOf(a, 'gs_oc').find(q => q.host === t);
  if (s) { s.lifeT = 0; return; }
  const n = summon(a, 'gs_oc', { target: t }); if (n) { n.amt = amt; if (t.buffs && t.buffs.gs_oc) t.buffs.gs_oc.taken = amt; }
}

/* ---- 转职技能的公共部分：空中施放（耗推进器、短暂悬停、后坐）、兵器研究减冷却 ---- */
const SF_SHOOT = ['gs_cross', 'gs_buster', 'gs_napalm'];   // 推进器「射击技能攻击力」
const sfShootMul = p => 1 + (sfLv(p, 'gs_nitro') ? 0.1 + 0.01 * sfLv(p, 'gs_nitro') : 0);
const sfGrenadeMul = (p, reinforced) => (1 + 0.04 * sfLv(p, 'gs_gmastery')) * (reinforced ? 1.5 : 1);
function sfAct(A, o = {}) {
  const s0 = A.onStart;
  A.onStart = e => {
    const a = e.act; a.air = e.z > 2;
    if (a.air && a.clip === 'sfThrow') { a.clip = 'sfAirThrow'; e.play('sfAirThrow', true); }
    if (a.air && !o.noNitro) useNitro(e, 1);
    if (a.air && !o.keepGrav) { if (a.lowGrav === undefined) a.lowGrav = standbyOn(e) ? 0 : 0.12; e.vz = standbyOn(e) ? 0 : Math.max(0, e.vz) * 0.2; if (o.recoil && !standbyOn(e)) e.vx = -e.face * o.recoil; }
    const S = SKILLS[a.skill];
    if (S && S.job === SF && !S.awaken && e.cool[a.skill] > 0) e.cool[a.skill] *= 1 - 0.01 * sfLv(e, 'gs_firearm');
    if (S && S.charges && a.air) e.cool[a.skill] = Math.min(e.cool[a.skill] || 0, 0.5);   // 空中投掷间隔 0.5 秒
    if (s0) s0(e);
  };
  return A;
}
// 射击方向：地面平射；空中斜向下（落点在前下方）
const sfAirBox = (e, x0, x1, hw) => e.z > 2 ? [x0, x1, hw, -e.z - 10, 70] : null;
function sfTracer(e, x0, z0, x1, z1, col, w = 3) {
  addFx({ x: e.x, y: e.y + 2, dur: 0.1, add: true, draw(c) { const k = this.t / this.dur; c.save(); c.globalCompositeOperation = 'lighter'; c.strokeStyle = col; c.globalAlpha = 1 - k; c.lineWidth = w;
    c.beginPath(); c.moveTo(sx(x0), sy(e.y, z0)); c.lineTo(sx(x1), sy(e.y, z1)); c.stroke(); c.restore(); } });
}

/* =====================================================================
   技能
   ===================================================================== */
// ---- 被动 / BUFF（15 级）----
defSkill('gs_nitro', { name: '单兵推进器', cls: 'gun', job: SF, lvReq: 15, passive: true, sp: 20, col: '#4a9ad8',
  desc: '【被动】腰间的推进器让你在空中自由行动：每次跳跃可以使用 7 次空中动作——空中 C 上升、空中 ←/→+C 水平冲刺、空中 ↓+C 后跳、空中 Space 急降、被打浮空时按 C 恢复姿态；空中每放一个技能也消耗 1 次，落地回满。地面普攻中可以按 C 取消成跳跃；空中射击常驻。空中动作转职后就能用，技能等级提高子弹 BUFF 和射击技能（交叉射击、聚合弹、凝固汽油弹）的攻击力。',
  infoExtra: lv => [['每跳空中动作', '7 次'], ['子弹 BUFF 攻击力', '+' + pct(0.02 * lv)], ['射击技能攻击力', '+' + pct(0.1 + 0.01 * lv)]] });
defSkill('gs_overcharge', { name: '超负荷装填', cls: 'gun', job: SF, lvReq: 15, mp: 30, cd: 5, type: 'indep', buff: true, col: '#e05a3a', cmdNote: '→→+Space（施放时 → 火 / ← 冰 / ↑ 光 / ↓ 无）',
  desc: '【BUFF · 常驻】给子弹装填特殊火药，普攻和技能的攻击力提高。施放时按方向键选择属性：→ 火、← 冰、↑ 光、↓ 无属性；不按就依次轮换。属性决定子弹、特性弹 / 爆裂弹、交叉射击、聚合弹、凝固汽油弹的属性。特性弹、贯穿弹、爆裂弹、交叉射击、聚合弹、凝固汽油弹都要在超负荷装填状态下才能用。',
  infoExtra: lv => [['普攻 / 技能攻击力', '+' + pct(0.1 + 0.01 * lv)]], ai: { kind: 'buff' },
  act: (lv, p) => sfAct({ name: 'gs_overcharge', clip: 'sfReload', dur: 0.5, noCounter: true,
    onStart: e => { e.act.pick = undefined; sfx.charge(); sfPickFx(e); },
    onInput: (e, I) => { const a = e.act; if (e.actT < 0.45) for (const [k, el] of [['right', 'fire'], ['left', 'ice'], ['up', 'light'], ['down', null]]) if (I.hit(k)) a.pick = el;
      return false; },
    events: [evAt(0.42, e => { const a = e.act, b0 = sfOver(e), order = SF_ELEM.map(x => x[0]);
      let el = a.pick; if (el === undefined) el = b0 ? order[(order.indexOf(b0.elem) + 1) % order.length] : 'fire';
      if (!isHuman(e) && a.pick === undefined) el = pick(['fire', 'ice', 'light']);
      e.buffs.gs_overcharge = { t: 1e9, lv, elem: el, dmg: 0.1 + 0.01 * lv, shownT: game.t };
      sfx.buff(); fxAura(e, sfElemCol(el)); fxText(`超负荷 · ${sfElemName(el)}`, e.x, e.y, e.z + 20, { col: sfElemCol(el), size: 12, dur: 1 }); })] }, { keepGrav: false }) });
// 超负荷装填施放时的属性选择：四个属性标记绕在身边（→ 火 / ← 冰 / ↑ 光 / ↓ 无，按屏幕方向）
function sfPickFx(e) {
  addFx({ ent: e, y: e.y + 0.5, dur: 0.5, add: true, update() { this.y = this.ent.y + 0.5; },
    draw(c) { const E = this.ent, X = sx(E.x), Y = sy(E.y, E.z + 62), k = this.t / this.dur, a = E.act && E.act.name === 'gs_overcharge' ? E.act.pick : undefined;
      const spots = [['fire', 34, 0], ['ice', -34, 0], ['light', 0, -30], [null, 0, 30]];
      for (const [el, dx, dy] of spots) { const on = a === el; c.globalAlpha = (on ? 1 : 0.55) * (k > 0.8 ? (1 - k) / 0.2 : 1);
        drawSpr(c, fxTint('orb', sfElemCol(el)), X + dx, Y + dy, on ? 26 : 16, on ? 26 : 16, {}); }
      c.globalAlpha = 1; } });
}
defSkill('gs_elem', { name: '特性弹', cls: 'gun', job: SF, lvReq: 15, sp: 10, mp: 20, cd: 5, type: 'indep', buff: true, col: '#c07a2a', req: sfNeedOver,
  desc: '【BUFF · 常驻】让超负荷装填的属性以“特性”的形式附在子弹上：普攻命中时有 25% 几率使敌人进入异常状态 2 秒（火：灼烧，冰：冰冻，光：感电，无：眩晕），子弹攻击力提高。和贯穿弹、爆裂弹不能同时使用。需要超负荷装填。',
  infoExtra: lv => [['异常几率', '25%（2 秒）'], ['子弹攻击力', '+' + pct(0.15 + 0.03 * (lv - 1))]], ai: { kind: 'buff' },
  act: lv => sfBulletAct('gs_elem', lv) });
function sfBulletAct(id, lv) {
  return sfAct({ name: id, clip: 'sfReload', dur: 0.35, noCounter: true,
    onStart: e => { for (const k of SF_BULLETS) delete e.buffs[k]; e.buffs[id] = { t: 1e9, lv }; sfx.buff(); const el = sfElem(e); fxAura(e, sfElemCol(el)); fxText(SKILLS[id].name, e.x, e.y, e.z + 20, { col: sfElemCol(el), size: 11 }); } });
}
// ---- 16 级 ----
defSkill('gs_booster', { name: '弹药改良', cls: 'gun', job: SF, lvReq: 16, passive: true, sp: 10, col: '#8a6a3a',
  desc: '【被动】子弹的穿透几率和让敌人僵直的时间提高。子弹 BUFF（特性弹 / 贯穿弹 / 爆裂弹）按超负荷装填的属性追加效果：火 / 冰 / 光 → 对应属性强化提高，无属性 → 普攻和技能攻击力 +10%。',
  infoExtra: lv => [['子弹穿透几率', '+' + pct(0.04 * lv)], ['敌人僵直时间', '+' + pct(0.07 * lv)], ['属性强化（火 / 冰 / 光）', '+' + (10 + 2 * lv)]] });
defSkill('gs_firearm', { name: '兵器研究', cls: 'gun', job: SF, lvReq: 16, passive: true, sp: 10, col: '#5a6a4a',
  desc: '【被动】普攻按独立攻击力结算。装备步枪 / 手弩时，攻击力、攻击速度提高，手雷装填速度 +30%。转职技能（觉醒除外）冷却时间缩短。',
  infoExtra: lv => [['攻击力（步枪 / 手弩）', '+' + pct(0.01 * lv)], ['攻击速度（步枪 / 手弩）', '+' + pct(0.08 + 0.02 * lv)], ['手雷装填速度', '+30%'], ['转职技能冷却', '-' + pct(0.01 * lv)]] });
defSkill('gs_gmastery', { name: '手雷精通', cls: 'gun', job: SF, lvReq: 16, passive: true, sp: 15, col: '#6a7a3a', pre: { g_grenade: 1 },
  desc: '【被动】G-14 手雷、G-35L 感电手雷、G-18C 冰冻手雷的攻击力提高。需要 G-14 手雷 Lv1。', infoExtra: lv => [['手雷攻击力', '+' + pct(0.04 * lv)]] });
// M18 阔剑地雷：在前方放置地雷，敌人进入扇形感应区就爆炸（3 段 + 眩晕 2 秒并被推开）；再按技能键手动引爆。02X：改成投掷圆盘，感应范围变成一整圈、推开距离缩短
defSkill('gs_m18', { name: 'M18 阔剑地雷', cls: 'gun', job: SF, lvReq: 16, mp: 25, cd: 6, type: 'indep', col: '#4a6a3a', airIf: sfCanAir,
  desc: '在前方放置 M18 阔剑地雷。敌人进入前方的扇形感应区就会爆炸（3 段），100% 眩晕 2 秒并被推开。地雷在场时再按一次技能键手动引爆。空中施放时把地雷投到前下方。',
  pow: lv => skillDmg(3.6, 0.36, lv), infoExtra: () => [['眩晕', '2 秒（100%）']], ai: { kind: 'aoe', r: [0, 200], dy: 40 },
  recast: { ok: p => summonsOf(p, 'gs_m18').length > 0, cd: 0.2, act: () => ({ name: 'gs_m18d', clip: 'gshot', dur: 0.18, noCounter: true, onStart: e => { sfx.sfBeep(); for (const s of summonsOf(e, 'gs_m18')) sfM18Boom(s); } }) },
  act: lv => sfAct({ name: 'gs_m18', clip: 'sfPlant', dur: 0.36, noCounter: true,
    events: [evAt(0.14, e => { const disc = sfLv(e, 'gs_02x') > 0, air = e.act.air, x = e.x + e.face * (air ? 60 + e.z * 0.5 : disc ? 150 : 46);
      const put = X => { const s = summon(e, 'gs_m18', { x: X, y: e.y, lv }); if (s) { s.disc = disc; s.armT = 0.3; s.face = e.face; s.dmg = skillDmg(1.2, 0.12, lv); } };
      if (air || disc) { sfx.swing(false); lobProj(e, x, e.y, air ? 0.3 : 0.35, { img: IMG['fx/sf_m18'] ? 'sf_m18' : 'grenade', h: 14, z0: air ? 10 : 40, vz: air ? 40 : 160, onLand: pr => put(pr.x) }); }
      else { put(x); sfx.thud(0.4); } })] }, { recoil: 40 }) });
defSummon('gs_m18', { kind: 'field', life: 20, max: 1, over: 'oldest', keepRoom: false, type: 'indep',
  update(s, dt) {
    if (s.boom) return; if (s.armT > 0) { s.armT -= dt; return; }
    for (const t of ents) if (foe(s.owner, t) && t.invul <= 0 && t.z < 60) {
      const dx = (t.x - s.x) * s.face, dy = Math.abs(t.y - s.y);
      if (s.disc ? Math.hypot(t.x - s.x, (t.y - s.y) / GR) < 130 : dx > -10 && dx < 160 && dy < 30 + dx * 0.3) { sfM18Boom(s); break; }
    } },
  drawUpright(c, s) { const X = sx(s.x), Y = sy(s.y, 0), blink = Math.floor(game.t * (s.armT > 0 ? 12 : 4)) % 2;
    if (IMG['fx/sf_m18']) drawSpr(c, 'sf_m18', X, Y + 2, 0, 22, { ay: 1, flip: s.face < 0, add: false });
    else { c.fillStyle = '#3a4a2a'; c.fillRect(X - 11, Y - 14, 22, 11); c.fillStyle = '#5a6a3a'; c.fillRect(X - 11, Y - 14, 22, 3); c.fillStyle = '#2a2a2a'; c.fillRect(X - 9, Y - 3, 2, 3); c.fillRect(X + 7, Y - 3, 2, 3); }
    c.fillStyle = blink ? '#ff3a2a' : '#6a1a14'; c.fillRect(X - 2, Y - 18, 4, 3); } });
function sfM18Boom(s) {
  if (s.boom || s.gone) return; s.boom = true;
  const o = s.owner, disc = s.disc, cone = t => { const dx = (t.x - s.x) * s.face, dy = Math.abs(t.y - s.y); return disc ? Math.hypot(t.x - s.x, (t.y - s.y) / GR) < 150 : dx > -20 && dx < 190 && dy < 40 + dx * 0.3; };
  for (let i = 0; i < 3; i++) game.after(i * 0.1, () => {
    if (ents.indexOf(o) < 0) return;
    fxSpr('explosion', s.x + s.face * (disc ? rnd(-40, 40) : 30 + i * 40), s.y, 20, { w: disc ? 150 : 110, dur: 0.35 }); fxDust(s.x + s.face * 40, s.y, 6, 30, '#6a5a4a'); sfx.boom(0.5); cam.shake = Math.max(cam.shake, 4);
    for (const t of ents) if (foe(o, t) && t.invul <= 0 && t.z < 120 && cone(t)) {
      const away = Math.sign(t.x - s.x) || s.face;
      summonHit(s, t, { dmg: s.dmg, type: 'indep', stun: 0.4, knock: (disc ? 60 : 160) * (i === 2 ? 1.5 : 0.4), airLift: 80, hs: 0.04, snd: 'fire', col: '#ffb060', downHit: true }, {});
      if (i === 0) { addStatus(t, 'stun', 2, { src: o }); if (away !== s.face && !disc) t.vx += away * 60; }
    }
    if (i === 2) dismissOne(s, 'boom');
  });
}
// ---- 17 级 ----
defSkill('gs_cross', { name: '交叉射击', cls: 'gun', job: SF, lvReq: 17, mp: 35, cd: 8, type: 'indep', col: '#c05a2a', req: sfNeedOver, airIf: sfCanAir,
  desc: '双手交叉，向前方大范围连开 3 轮，属性随超负荷装填。空中施放时向斜下方扫射，收招更快。需要超负荷装填。', pow: lv => skillDmg(4.5, 0.45, lv), ai: { kind: 'aoe', r: [0, 260], dy: 50 },
  act: lv => sfAct({ name: 'gs_cross', clip: 'sfCross', dur: 0.56, noCounter: true,
    onStart: e => { if (e.act.air) e.act.dur = 0.4; },
    events: [0.08, 0.18, 0.28].map((t, i) => evAt(t, e => { const el = sfElem(e), col = sfElemCol(el), air = e.act.air, m = sfShootMul(e);
      muzzle(e); sfx.gun(1.1); cam.shake = Math.max(cam.shake, 2);
      const box = sfAirBox(e, 0, 280, 60) || [0, 290, 58, 0, 130];
      for (const a of [-1, 1]) sfTracer(e, e.x + e.face * 30, e.z + 60, e.x + e.face * 280, air ? 0 : e.z + 60 + a * 36, col, 2);
      instantHit(e, { box, dmg: skillDmg(1.5, 0.15, lv) * m, type: 'indep', elem: el || undefined, stun: 0.3, knock: i === 2 ? 120 : 30, airLift: 100, hs: 0.03, col, downHit: air, snd: 'stab' }); })) }, { recoil: 60 }) });
defSkill('gs_g35', { name: 'G-35L 感电手雷', cls: 'gun', job: SF, lvReq: 17, mp: 25, cd: 3, charges: 3, reload: 2.5, type: 'indep', elem: 'light', col: '#d8c83a', airIf: sfCanAir,
  desc: '投出 G-35L 感电手雷，光属性爆炸使范围内的敌人感电 9 秒；命中后自己的暴击率提高 10%（30 秒）。最多装填 3 颗；地面投掷间隔 3 秒（按住 ↑ 投远、↓ 投近），空中 0.5 秒。',
  pow: lv => skillDmg(2.4, 0.24, lv), infoExtra: () => [['装填', '3 颗'], ['感电', '9 秒'], ['命中后暴击率', '+10%（30 秒）']], ai: { kind: 'proj', r: [80, 320], dy: 40 },
  act: lv => sfAct({ name: 'gs_g35', clip: 'sfThrow', dur: 0.5, noCounter: true, events: [evAt(0.22, e => { if (!sfReinforced(e, 'gs_g35', lv)) sfThrowG35(e, lv); })] }, { recoil: 30 }) });
function sfThrowG35(e, lv, reinforced) {
  sfx.swing(false);
  return sfGrenade(e, { img: 'sf_g35', col: '#ffe060', onBoom: pr => {
    fxSpr('spark', pr.x, pr.y, 30, { w: 190, dur: 0.35 }); fxShock(pr.x, pr.y, 90, '#fff38a'); sfx.sfZap(1.2); cam.shake = Math.max(cam.shake, 4);
    let hit = false; const dmg = skillDmg(2.4, 0.24, lv) * sfGrenadeMul(e, reinforced);
    blast(e, pr.x, pr.y, 78, { dmg, type: 'indep', elem: 'light', launch: 260, knock: 70, hs: 0.06, snd: 'crit', col: '#fff38a', downHit: true,
      onHit: (a, t) => { hit = true; addStatus(t, 'shock', 9, { src: a, hitDmg: atkOf(a, 'indep') * 0.1 }); } }, { zMax: 140 });
    if (hit) { e.buffs.gs_g35 = { t: 30, crit: 0.1 }; }
    if (reinforced) summon(e, 'gs_magf', { x: pr.x, y: pr.y, lv });
  } });
}
// ---- 18 级 ----
defSkill('gs_pierce', { name: '贯穿弹', cls: 'gun', job: SF, lvReq: 18, sp: 10, mp: 20, cd: 5, type: 'indep', buff: true, col: '#6a8ad8', req: sfNeedOver,
  desc: '【BUFF · 常驻】给弹头装上穿甲装置：普攻子弹 100% 贯穿，射程 +20%，弹速 +50%，子弹攻击力提高。和特性弹、爆裂弹不能同时使用。需要超负荷装填。',
  infoExtra: lv => [['贯穿', '100%'], ['射程 / 弹速', '+20% / +50%'], ['子弹攻击力', '+' + pct(0.15 + 0.03 * (lv - 1))]], ai: { kind: 'buff' }, act: lv => sfBulletAct('gs_pierce', lv) });
defSkill('gs_burst', { name: '爆裂弹', cls: 'gun', job: SF, lvReq: 18, sp: 10, mp: 20, cd: 5, type: 'indep', buff: true, col: '#d86a2a', req: sfNeedOver,
  desc: '【BUFF · 常驻】在弹头里装入炸药：普攻子弹命中时在小范围内爆炸，属性随超负荷装填，子弹攻击力提高。和特性弹、贯穿弹不能同时使用。需要超负荷装填。',
  infoExtra: lv => [['爆炸伤害', '子弹伤害的 60%'], ['子弹攻击力', '+' + pct(0.15 + 0.03 * (lv - 1))]], ai: { kind: 'buff' }, act: lv => sfBulletAct('gs_burst', lv) });
defSkill('gs_g18', { name: 'G-18C 冰冻手雷', cls: 'gun', job: SF, lvReq: 18, mp: 30, cd: 4, charges: 3, reload: 3, type: 'indep', elem: 'ice', col: '#5ab8e8', airIf: sfCanAir,
  desc: '投出 G-18C 冰冻手雷，冰属性爆炸，100% 冰冻范围内的敌人 4 秒（领主时间缩短）。最多装填 3 颗；地面投掷间隔 4 秒（按住 ↑ 投远、↓ 投近），空中 0.5 秒。',
  pow: lv => skillDmg(2.6, 0.26, lv), infoExtra: () => [['装填', '3 颗'], ['冰冻', '4 秒（100%）']], ai: { kind: 'proj', r: [80, 320], dy: 40 },
  act: lv => sfAct({ name: 'gs_g18', clip: 'sfThrow', dur: 0.5, noCounter: true, events: [evAt(0.22, e => { if (!sfReinforced(e, 'gs_g18', lv)) sfThrowG18(e, lv); })] }, { recoil: 30 }) });
function sfThrowG18(e, lv, reinforced) {
  sfx.swing(false);
  return sfGrenade(e, { img: 'sf_g18', col: '#8fe0ff', onBoom: pr => {
    fxSpr('frost', pr.x, pr.y, 20, { w: 200, dur: 0.6, grow: [0.6, 1.1] }); fxShock(pr.x, pr.y, 90, '#bfefff'); sfx.sfFreeze(); cam.shake = Math.max(cam.shake, 3);
    const dmg = skillDmg(2.6, 0.26, lv) * sfGrenadeMul(e, reinforced);
    blast(e, pr.x, pr.y, 78, { dmg, type: 'indep', elem: 'ice', knock: 30, stun: 0.3, hs: 0.05, snd: 'crit', col: '#bfefff', downHit: true, onHit: (a, t) => addStatus(t, 'freeze', 4, { src: a }) }, { zMax: 140 });
    if (sfLv(e, 'gs_02x') > 0 || reinforced) summon(e, 'gs_mist', { x: pr.x, y: pr.y, lv, life: reinforced ? 2 : 3 });
  } });
}
// 02X：冰冻手雷爆炸处留下冰雾 3 秒，敌人累计待满 3 秒 → 特殊冰冻 2 秒（强化 G-18C：冰雾期间多段伤害）
defSummon('gs_mist', { kind: 'field', life: 3, r: 80, tick: 0.25, zMax: 60, max: 4, keepRoom: false, type: 'indep', elem: 'ice',
  onTick(s, L) { for (const t of L) { t._sfChill = (t._sfChill || 0) + 0.25; if (t._sfChill >= 3) { t._sfChill = 0; addStatus(t, 'freeze', 2, { src: s.owner }); } else addStatus(t, 'slow', 1, { src: s.owner });
    if (s.life <= 2) summonHit(s, t, { dmg: skillDmg(0.2, 0.02, s.lv), type: 'indep', elem: 'ice', stun: 0.1, hs: 0.01, downHit: true, col: '#bfefff' }); } },
  draw(c, s) { const k = s.lifeT / s.life; drawSpr(c, 'frost', sx(s.x), sy(s.y, 0), 170, 0, { ay: 0.7, alpha: 0.35 * (1 - k * k) }); } });
// ---- 19 级 ----
defSkill('gs_buster', { name: '聚合弹', cls: 'gun', job: SF, lvReq: 19, mp: 60, cd: 18, type: 'indep', col: '#d8502a', req: sfNeedOver, airIf: sfCanAir,
  desc: '向前方窄范围集中连射，最后一发把敌人轰飞，全程霸体。属性随超负荷装填。空中施放时向斜下方射击。需要超负荷装填。（指令和烟尘弹相同，按千海天规则冷却长的聚合弹生效；烟尘弹仍可以用快捷栏放）',
  pow: lv => skillDmg(9.0, 0.9, lv), ai: { kind: 'burst', r: [0, 420], dy: 16 },
  act: lv => sfAct({ name: 'gs_buster', clip: 'sfAim', dur: 1.0, superArmor: true, noCounter: true,
    update: e => { const a = e.act, n = Math.floor((e.actT - 0.12) / 0.06); if (e.actT < 0.12 || n === a.n || n > 10) return; a.n = n;
      const el = sfElem(e), col = sfElemCol(el), last = n === 10, air = a.air, m = sfShootMul(e);
      muzzle(e); sfx.gun(last ? 1.6 : 0.8); if (last) { cam.shake = 6; e.vx = -e.face * 90; } else e.x -= e.face * 0.6;
      sfTracer(e, e.x + e.face * 34, e.z + 62, e.x + e.face * 430, air ? 0 : e.z + 62, col, last ? 6 : 3);
      instantHit(e, { box: sfAirBox(e, 20, 430, 20) || [20, 440, 16, 30, 100], dmg: skillDmg(last ? 2.0 : 0.7, last ? 0.2 : 0.07, lv) * m, type: 'indep', elem: el || undefined,
        stun: 0.3, knock: last ? 260 : 6, launch: last ? 300 : 0, airLift: 60, hs: last ? 0.1 : 0.02, big: last ? 1.6 : 1, col, sure: !last, snd: 'stab' }); } }, { recoil: 20 }) });
defSkill('gs_c4', { name: 'C4 飞弹', cls: 'gun', job: SF, lvReq: 19, mp: 50, cd: 20, type: 'indep', col: '#8a8a5a', airIf: sfCanAir,
  desc: '掷出装着 C4 炸药的飞盘，在敌人之间弹跳，给碰到的每个敌人贴上 C4（最多 15 个，被贴上的敌人减速）。C4 在 10 秒后爆炸，也可以再按一次技能键立刻引爆；贴着 C4 的敌人被打倒也会引爆。',
  pow: lv => skillDmg(8.0, 0.8, lv), infoExtra: () => [['最多贴上', '15 个'], ['自动引爆', '10 秒']], ai: { kind: 'proj', r: [40, 360], dy: 40 },
  recast: { ok: p => summonsOf(p, 'gs_c4').length > 0, cd: 0.2, act: () => ({ name: 'gs_c4d', clip: 'gbuff', dur: 0.2, noCounter: true, onStart: e => { sfx.sfBeep(); dismissSummons(e, 'gs_c4', 'cmd'); } }) },
  act: lv => sfAct({ name: 'gs_c4', clip: 'sfThrow', dur: 0.45, noCounter: true, events: [evAt(0.18, e => sfC4Disc(e, lv))] }, { recoil: 30 }) });
function sfC4Disc(e, lv) {
  sfx.swing(true); const tagged = new Set(), air = e.z > 2;
  spawnProj({ owner: e, x: e.x + e.face * 30, y: e.y, z: e.z + (air ? 30 : 55), vx: e.face * 520, vy: 0, vz: air ? -e.z * 1.4 : 0, face: e.face, life: 2.2, w: 12, d: 14, h: 22, pierce: true, hit: null, spin: 0, bounces: 0, shadow: 6,
    update(pr, dt) {
      pr.spin += dt * 24; if (pr.z < 20 && pr.vz < 0) { pr.z = 20; pr.vz = 0; }
      for (const t of ents) if (foe(e, t) && t.invul <= 0 && !tagged.has(t) && Math.abs(t.x - pr.x) < t.w + 12 && Math.abs(t.y - pr.y) < 18 && pr.z < t.z + t.hurtH()) {
        tagged.add(t); applyHit(e, t, { dmg: skillDmg(0.4, 0.04, lv), type: 'indep', stun: 0.2, knock: 10, hs: 0.02, snd: 'blunt' }, { proj: true, src: { x: pr.x, y: pr.y, z: pr.z, face: pr.face } });
        const s = summon(e, 'gs_c4', { target: t, lv }); if (s) s.dmg = skillDmg(7.6, 0.76, lv); addStatus(t, 'slow', 10, { src: e }); sfx.sfBeep();
        if (tagged.size >= 15) { pr.t = pr.life; return; }
        // 弹向下一个没贴过的敌人
        let nx = null, bd = 260; for (const o of ents) if (foe(e, o) && !tagged.has(o)) { const d = Math.hypot(o.x - pr.x, (o.y - pr.y) * 1.5); if (d < bd) { bd = d; nx = o; } }
        if (nx) { const d = Math.hypot(nx.x - pr.x, nx.y - pr.y) || 1; pr.vx = (nx.x - pr.x) / d * 520; pr.vy = (nx.y - pr.y) / d * 520; pr.face = pr.vx >= 0 ? 1 : -1; pr.t = Math.min(pr.t, pr.life - 0.8); }
        else pr.vx *= 0.6;
        break;
      } },
    draw(c, pr) { const X = sx(pr.x), Y = sy(pr.y, pr.z); if (IMG['fx/sf_c4disc']) drawSpr(c, 'sf_c4disc', X, Y, 30, 0, { rot: pr.spin, add: false });
      else { c.save(); c.translate(X, Y); c.scale(1, 0.45); c.fillStyle = '#6a6a4a'; c.beginPath(); c.arc(0, 0, 13, 0, TAU); c.fill(); c.fillStyle = '#c8c0a0'; c.beginPath(); c.arc(Math.cos(pr.spin) * 6, Math.sin(pr.spin) * 6, 4, 0, TAU); c.fill(); c.restore(); }
      if (Math.floor(game.t * 10) % 2) { c.fillStyle = '#ff3a2a'; c.fillRect(X - 1.5, Y - 5, 3, 3); } } });
}
defSummon('gs_c4', { kind: 'attach', life: 10, max: 15, over: 'oldest', keepRoom: false, type: 'indep',
  onEnd(s, why) {
    if (why === 'room' || why === 'owner' || why === 'replaced' || why === 'round') return;
    const o = s.owner; if (ents.indexOf(o) < 0) return;
    meteorImpact({ x: s.x, y: s.y }, 0.55); sfx.boom(0.8);
    const h = s.host; if (h && !h.dead && h.invul <= 0) summonHit(s, h, { dmg: s.dmg || 5, type: 'indep', launch: 380, knock: 120, hs: 0.1, big: 1.5, downHit: true, snd: 'fire', col: '#ffb060' }, {});
    summonArea(s, s.x, s.y, 60, { dmg: (s.dmg || 5) * 0.2, type: 'indep', knock: 90, launch: 200, hs: 0.04, downHit: true }, { zMax: 120 });
  },
  draw(c, s) { const h = s.host, X = sx(h.x - h.face * 4), Y = sy(h.y, h.z + h.hurtH() * 0.5), left = s.life - s.lifeT, blink = Math.floor(game.t * (left < 2 ? 12 : 4)) % 2;
    if (IMG['fx/sf_c4']) drawSpr(c, 'sf_c4', X, Y, 18, 0, { add: false }); else { c.fillStyle = '#8a7a5a'; c.fillRect(X - 7, Y - 5, 14, 10); c.fillStyle = '#3a3a3a'; c.fillRect(X - 7, Y - 1, 14, 2); }
    c.fillStyle = blink ? '#ff2a1a' : '#5a1410'; c.fillRect(X - 2, Y - 8, 4, 3); } });
defSkill('gs_napalm', { name: '凝固汽油弹', cls: 'gun', job: SF, lvReq: 19, mp: 60, cd: 20, type: 'indep', col: '#e0502a', req: sfNeedOver, airIf: sfCanAir,
  desc: '朝前方地面射出凝固汽油弹：爆炸后留下持续 3 秒的属性地带（每 0.2 秒一段，能打到倒地的敌人），属性随超负荷装填。射击时霸体。空中施放时射向前下方，出手更快。需要超负荷装填。',
  pow: lv => skillDmg(9.5, 0.95, lv), ai: { kind: 'aoe', r: [40, 260], dy: 40 },
  act: lv => sfAct({ name: 'gs_napalm', clip: 'sfAimDown', dur: 0.62, superArmor: true, noCounter: true,
    onStart: e => { if (e.act.air) { e.act.dur = 0.42; e.act.events[0].t = 0.12; } },
    events: [evAt(0.24, e => { const el = sfElem(e), col = sfElemCol(el), air = e.act.air, x = e.x + e.face * (air ? 50 + e.z * 0.7 : 90), m = sfShootMul(e);
      muzzle(e); sfx.cannon(0.7); sfTracer(e, e.x + e.face * 30, e.z + (air ? 50 : 40), x, 0, col, 5);
      game.after(0.06, () => { if (ents.indexOf(e) < 0) return;
        fxSpr('explosion', x, e.y, 30, { w: 170, dur: 0.45, col: el && el !== 'fire' ? col : undefined }); fxShock(x, e.y, 110, col); sfx.boom(0.8); cam.shake = Math.max(cam.shake, 6);
        blast(e, x, e.y, 90, { dmg: skillDmg(6.5, 0.65, lv) * m, type: 'indep', elem: el || undefined, launch: 380, knock: 80, hs: 0.1, big: 1.5, downHit: true, snd: 'fire', col }, { zMax: 160 });
        const s = summon(e, 'gs_napalm', { x, y: e.y, lv }); if (s) { s.el = el; s.dmg = skillDmg(0.2, 0.02, lv) * m; } }); })] }, { recoil: 50 }) });
defSummon('gs_napalm', { kind: 'field', life: 3, r: 90, tick: 0.2, zMax: 40, max: 2, keepRoom: false, type: 'indep',
  onTick(s, L) { for (const t of L) { summonHit(s, t, { dmg: s.dmg || 0.2, type: 'indep', elem: s.el || undefined, stun: 0.12, hs: 0.01, downHit: true, snd: 'fire', col: sfElemCol(s.el) });
    if (s.el === 'fire' && Math.random() < 0.15) addStatus(t, 'burn', 2, { src: s.owner, dps: atkOf(s.owner, 'indep') * 0.05 }); } },
  draw(c, s) { const k = s.lifeT / s.life, a = k < 0.1 ? k / 0.1 : k > 0.8 ? (1 - k) / 0.2 : 1, col = sfElemCol(s.el), img = s.el === 'ice' ? 'frost' : s.el === 'light' ? 'spark' : 'flame';
    drawSpr(c, 'shock', sx(s.x), sy(s.y, 0), 200, 0, { alpha: a * 0.35, add: true });
    for (let i = 0; i < 5; i++) { const ang = i * 1.26 + s.sid, r = 30 + (i % 3) * 22, X = sx(s.x + Math.cos(ang) * r), Y = sy(s.y + Math.sin(ang) * r * GR, 0);
      drawSpr(c, s.el && s.el !== 'fire' ? fxTint(img, col) : img, X, Y + 2, img === 'flame' ? 56 : 60, 0, { ay: 0.9, rot: img === 'flame' ? -Math.PI / 2 : 0, alpha: a * (0.6 + 0.4 * Math.sin(game.t * 12 + i)) }); } } });
// ---- 20 级 ----
defSkill('gs_lockon', { name: '镭射狙击', cls: 'gun', job: SF, lvReq: 20, mp: 80, cd: 45, type: 'indep', col: '#e03a3a', airIf: sfCanAir,
  desc: '向射程内最强的敌人投出激光信标，呼叫支援火力对它连续轰击 5 次，每次都使它眩晕 1 秒。投掷时霸体。', pow: lv => skillDmg(15, 1.5, lv), ai: { kind: 'burst', r: [0, 450], dy: 80 },
  act: lv => sfAct({ name: 'gs_lockon', clip: 'sfThrow', dur: 0.5, superArmor: true, noCounter: true,
    events: [evAt(0.2, e => { let t = null, bh = -1;
      for (const o of ents) if (foe(e, o) && (o.x - e.x) * e.face > -30 && Math.abs(o.x - e.x) < 460 && Math.abs(o.y - e.y) < 120) { const v = o.hp + (o.boss ? 1e9 : o.elite ? 1e8 : 0); if (v > bh) { bh = v; t = o; } }
      sfx.swing(false); if (!t) { fxText('没有目标', e.x, e.y, e.z + 20, { col: '#ccc', size: 10 }); return; }
      if (IMG['fx/sf_beacon']) lobProj(e, t.x, t.y, 0.3, { img: 'sf_beacon', h: 18, z0: 60, vz: 160 });
      const s = summon(e, 'gs_lock', { target: t, lv }); if (s) s.dmg = skillDmg(3.0, 0.3, lv); sfx.sfBeep(); })] }) });
// 从天而降的支援火力光束（竖直的激光素材）
function sfSkyBeam(x, y, col) {
  addFx({ x, y: y + 1, z: 0, dur: 0.22, add: true, img: fxTint('laser', col), draw(c) { const k = this.t / this.dur, X = sx(this.x), Y = sy(this.y, 0);
    drawSpr(c, this.img, X, Y, 560, 34 * (1 - k * 0.7), { ax: 0, ay: 0.5, rot: -Math.PI / 2, alpha: k > 0.6 ? (1 - k) / 0.4 : 1 }); } });
}
defSummon('gs_lock', { kind: 'attach', life: 2.3, max: 1, over: 'oldest', keepRoom: false, type: 'indep',
  update(s) { const k = Math.floor((s.lifeT - 0.45) / 0.36); if (s.lifeT < 0.45 || k === s.k || k > 4) return; s.k = k; const h = s.host;
    sfSkyBeam(h.x, h.y, '#ff5a4a'); fxSpr('explosion', h.x, h.y, h.z + 30, { w: 110, dur: 0.3 }); sfx.cannon(0.6); cam.shake = Math.max(cam.shake, 5);
    summonHit(s, h, { dmg: s.dmg || 3, type: 'indep', stun: 0.5, knock: 20, launch: k === 4 ? 360 : 0, hs: 0.08, big: 1.4, downHit: true, snd: 'fire', col: '#ffb0a0', sure: true }, {});
    addStatus(h, 'stun', 1, { src: s.owner });
    for (const t of ents) if (t !== h && foe(s.owner, t) && t.invul <= 0 && inGround(t, h.x, h.y, 50) && t.z < 120) summonHit(s, t, { dmg: (s.dmg || 3) * 0.3, type: 'indep', knock: 60, stun: 0.3, hs: 0.02, downHit: true }, {}); },
  draw(c, s) { const h = s.host, X = sx(h.x), Y = sy(h.y, h.z + h.hurtH() * 0.55), r = 16 + Math.sin(game.t * 20) * 3;
    c.save(); c.globalCompositeOperation = 'lighter'; c.strokeStyle = '#ff3a2a'; c.lineWidth = 2; c.beginPath(); c.arc(X, Y, r, 0, TAU); c.moveTo(X - r - 6, Y); c.lineTo(X + r + 6, Y); c.moveTo(X, Y - r - 6); c.lineTo(X, Y + r + 6); c.stroke(); c.restore(); } });
// ---- 21 级：一觉（战争女神）----
defSkill('gs_arsenal', { name: '弹药强化', cls: 'gun', job: SF, lvReq: 21, tier: 1, passive: true, sp: 30, col: '#5a8ae0',
  desc: '【被动 · 一觉】强化武器：所有攻击命中时让目标进入“过电流”状态 20 秒，受到的伤害提高。', infoExtra: lv => [['过电流：受到伤害', '+' + pct(0.12 + 0.015 * (lv - 1))]] });
defSkill('gs_emp', { name: 'EMP 磁暴', cls: 'gun', job: SF, lvReq: 21, tier: 1, maxLv: 3, mp: 150, cd: 135, pvp: 0.45, type: 'indep', elem: 'light', awaken: true, col: '#3a8ae0', airIf: sfCanAir,
  desc: '【觉醒】向前方投下 EMP 装置（施放时可以用方向键瞄准落点）：落地的冲击波和电磁场之后，连续放出电磁波，最后大爆炸。电磁场让敌人感电；3 级起，直到爆炸为止自己无敌。',
  pow: lv => skillDmg(24, 6, lv), ai: { kind: 'awaken', r: [0, 360], dy: 90 },
  act: lv => sfAct({ name: 'gs_emp', clip: 'sfEmp', dur: 0.95, superArmor: true, noCounter: true, invul: [0, 0.95],
    onStart: e => { game.cutin = { t: 0, dur: 1.0, name: 'EMP 磁暴', who: cutinWho(e) }; game.timeStop = 0.9; sfx.awaken(); const at = aimAhead(e, 220, 400); e.act.cx = at.x; e.act.cy = at.y;
      e.act.g = telegraph({ x: at.x, y: at.y, r: 150, dur: 1.6, kind: 'circle', col: '#6ab0ff', friendly: true }); },
    onInput: (e, I, dt) => { const a = e.act; if (e.actT > 0.55 || !a.g) return false; const d = dt || 1 / 60; a.cx += I.dx() * 320 * d; a.cy = clamp(a.cy + I.dy() * 170 * d, 8, DEPTH - 8); a.g.x = a.cx; a.g.y = a.cy; return false; },
    events: [evAt(0.6, e => { const a = e.act; sfx.swing(true); if (a.g) a.g.dur = a.g.t + 0.05;
      const s = summon(e, 'gs_emp', { x: a.cx, y: a.cy, lv }); if (s) s.dmg = skillDmg(24, 6, lv);
      if (lv >= 3) e.invul = Math.max(e.invul, 3.4); })] }, { noNitro: false }) });
defSummon('gs_emp', { kind: 'field', life: 3.2, r: 150, tick: 0.25, zMax: 200, max: 1, keepRoom: false, type: 'indep', elem: 'light',
  onSpawn(s) { s.dropZ = 420; },
  update(s, dt) { const D = s.dmg || 24;
    if (s.dropZ > 0) { s.dropZ = Math.max(0, s.dropZ - dt * 1600); if (s.dropZ > 0) return;
      meteorImpact(s, 0.9); fxShock(s.x, s.y, 200, '#8fd0ff'); cam.flash = 0.12; cam.flashCol = '#cfe8ff';
      summonArea(s, s.x, s.y, 150, { dmg: D * 0.2, type: 'indep', elem: 'light', launch: 360, knock: 100, hs: 0.1, big: 1.6, downHit: true, snd: 'crit', col: '#bfe8ff' }, { zMax: 200 }); return; }
    const w = Math.floor((s.lifeT - 0.6) / 0.5); if (s.lifeT > 0.6 && w !== s.w && w < 4) { s.w = w; sfx.sfZap(1.3); fxShock(s.x, s.y, 190, '#bff0ff'); fxSpr('spark', s.x, s.y, 40, { w: 220, dur: 0.3 });
      summonArea(s, s.x, s.y, 190, { dmg: D * 0.08, type: 'indep', elem: 'light', stun: 0.45, knock: 0, hs: 0.04, downHit: true, col: '#bff0ff' }, { zMax: 200 }); } },
  onTick(s, L) { if (s.dropZ > 0) return; for (const t of L) { summonHit(s, t, { dmg: (s.dmg || 24) * 0.02, type: 'indep', elem: 'light', stun: 0.2, hs: 0.01, downHit: true, col: '#bfe8ff' }); addStatus(t, 'shock', 3, { src: s.owner, hitDmg: atkOf(s.owner, 'indep') * 0.1 }); } },
  onEnd(s, why) { if (why !== 'life') return; const o = s.owner; if (ents.indexOf(o) < 0) return;
    fxSpr('explosion', s.x, s.y, 40, { w: 360, dur: 0.6 }); fxShock(s.x, s.y, 260, '#ffd090'); sfx.boom(1.5); cam.shake = 12; cam.flash = 0.2; cam.flashCol = '#fff0d0';
    summonArea(s, s.x, s.y, 200, { dmg: (s.dmg || 24) * 0.36, type: 'indep', launch: 520, knock: 200, hs: 0.14, big: 2, downHit: true, snd: 'fire', col: '#ffe0a0' }, { zMax: 260 }); },
  draw(c, s) { const X = sx(s.x), Y = sy(s.y, 0);
    if (s.dropZ <= 0) { c.save(); c.translate(X, Y); c.scale(1, GR); c.rotate(game.t * 2); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.5 + 0.2 * Math.sin(game.t * 18); drawSpr(c, fxTint('rune', '#6ab0ff'), 0, 0, 300, 300, {}); c.restore(); } },
  drawUpright(c, s) { const X = sx(s.x), Y = sy(s.y, s.dropZ || 0);
    if (IMG['fx/sf_emp']) drawSpr(c, 'sf_emp', X, Y + 4, 0, 54, { ay: 1, add: false });
    else { c.fillStyle = '#3a4a5a'; c.fillRect(X - 16, Y - 30, 32, 30); c.fillStyle = '#8fd0ff'; c.fillRect(X - 12, Y - 26, 24, 5); c.fillStyle = '#c8d8e8'; c.fillRect(X - 3, Y - 44, 6, 14); }
    if (s.dropZ <= 0 && Math.floor(game.t * 14) % 2) drawSpr(c, 'spark', X, Y - 40, 40, 0, {}); } });
// ---- 23 / 25 级（一觉段）----
defSkill('gs_g61', { name: 'G-61 重力手雷', cls: 'gun', job: SF, lvReq: 23, tier: 1, mp: 90, cd: 20, type: 'indep', col: '#6a4ad8', airIf: sfCanAir,
  desc: '投出重力手雷：落地后展开 3 秒的重力场，把周围的敌人吸到中心并持续造成伤害，最后爆炸。投掷时霸体；地面按住 ↑ / ↓ 调整距离，空中角度固定。',
  pow: lv => skillDmg(12, 1.2, lv), ai: { kind: 'aoe', r: [80, 320], dy: 60 },
  act: lv => sfAct({ name: 'gs_g61', clip: 'sfThrow', dur: 0.5, superArmor: [0, 0.4], noCounter: true,
    events: [evAt(0.22, e => { sfx.swing(true); sfGrenade(e, { img: 'sf_g61', col: '#a07aff', onBoom: pr => { const s = summon(e, 'gs_g61', { x: pr.x, y: pr.y, lv }); if (s) s.dmg = skillDmg(12, 1.2, lv); sfx.charge(); } }).sfGrenade = null; })] }, { recoil: 30 }) });
defSummon('gs_g61', { kind: 'field', life: 3, r: 170, tick: 0.25, zMax: 160, max: 1, keepRoom: false, type: 'indep',
  update(s, dt) { for (const t of ents) if (foe(s.owner, t) && !t.dead && inGround(t, s.x, s.y, 190) && t.st !== 'held') { const k = t.boss ? 0.8 : 3.2; t.x = damp(t.x, s.x, k, dt); t.y = damp(t.y, s.y, k, dt); } },
  onTick(s, L) { for (const t of L) summonHit(s, t, { dmg: (s.dmg || 12) * 0.03, type: 'indep', stun: 0.3, hs: 0.01, downHit: true, col: '#c0a0ff' }); },
  onEnd(s, why) { if (why !== 'life') return; if (ents.indexOf(s.owner) < 0) return;
    fxSpr('quantum', s.x, s.y, 40, { w: 300, dur: 0.5, grow: [1.2, 0.4], col: '#a07aff' }); fxSpr('explosion', s.x, s.y, 30, { w: 260, dur: 0.5 }); sfx.boom(1.2); cam.shake = 9;
    summonArea(s, s.x, s.y, 170, { dmg: (s.dmg || 12) * 0.64, type: 'indep', launch: 460, knock: 60, hs: 0.12, big: 1.8, downHit: true, snd: 'fire' }, { zMax: 200 }); },
  draw(c, s) { const X = sx(s.x), Y = sy(s.y, 0); c.save(); c.translate(X, Y); c.scale(1, GR); c.rotate(-game.t * 4); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.65;
    drawSpr(c, fxTint('vortex', '#8a6aff'), 0, 0, 340, 340, {}); c.restore(); drawSpr(c, fxTint('orb', '#b090ff'), X, Y - 24, 36, 36, { alpha: 0.9 }); } });
// 超真空弹：切利——命中第一个敌人后在它脚下生成跟着它的真空洞，吸住周围的敌人和附近的手雷；再按技能键或时间到了就吸热爆炸。没打中时在地面留下真空洞，第一个踩上去的敌人会被粘住
defSkill('gs_chelli', { name: '超真空弹：切利', cls: 'gun', job: SF, lvReq: 25, tier: 1, mp: 100, cd: 30, type: 'indep', col: '#3a5ad8', airIf: sfCanAir, cmdNote: '↓↑↓+Z（再按引爆）',
  desc: '射出超真空弹：命中的第一个敌人脚下出现跟着它移动的真空洞，把周围的敌人吸过去并持续造成伤害，还会把附近的手雷（G-14 / G-35L / G-18C）吸进来一起引爆。再按一次技能键或 3 秒后吸收空气中的热量爆炸。没打中时在落点留下真空洞，第一个踩上去的敌人会被粘住。',
  pow: lv => skillDmg(16, 1.6, lv), ai: { kind: 'proj', r: [0, 460], dy: 16 },
  recast: { ok: p => summonsOf(p, { tag: 'vac' }).length > 0, cd: 0.2, act: () => ({ name: 'gs_chellid', clip: 'gbuff', dur: 0.2, noCounter: true, onStart: e => dismissSummons(e, { tag: 'vac' }, 'cmd') }) },
  act: lv => sfAct({ name: 'gs_chelli', clip: 'sfAim', dur: 0.55, noCounter: true,
    events: [evAt(0.2, e => { muzzle(e); sfx.cannon(0.6); const air = e.act.air, D = skillDmg(16, 1.6, lv); let stuck = false;
      shootProj(e, { img: 'darkorb', col: '#6a8aff', w: 36, speed: 760, life: 0.6, z: air ? 50 : 60, dx: 40, bw: 12, bh: 30, ang: air ? 0.6 : 0, pierce: false, trail: '#8fb0ff',
        hit: { dmg: D * 0.04, type: 'indep', stun: 0.3, hs: 0.03, col: '#bfd0ff' },
        onHitT: (pr, t) => { stuck = true; const s = summon(e, 'gs_vac', { target: t, lv }); if (s) s.dmg = D; },
        onEnd: pr => { if (stuck) return; const s = summon(e, 'gs_vacg', { x: pr.x, y: pr.y, lv }); if (s) s.dmg = D; } }); })] }, { recoil: 60 }) });
function sfVacPull(s, dt) {
  for (const t of ents) if (foe(s.owner, t) && !t.dead && t !== s.host && inGround(t, s.x, s.y, 180) && t.st !== 'held') { const k = t.boss ? 0.6 : 2.6; t.x = damp(t.x, s.x, k, dt); t.y = damp(t.y, s.y, k, dt); }
  for (const pr of projs) if (pr.owner === s.owner && pr.sfGrenade && !pr.boomed) { const d = Math.hypot(pr.x - s.x, pr.y - s.y);
    if (d < 260) { pr.x = damp(pr.x, s.x, 6, dt); pr.y = damp(pr.y, s.y, 6, dt); if (d < 30) pr.sfGrenade(pr); } }
}
function sfVacBoom(s) {
  const o = s.owner; if (ents.indexOf(o) < 0) return;
  fxSpr('darkorb', s.x, s.y, 40, { w: 280, dur: 0.45, grow: [1.3, 0.3], col: '#6a8aff' }); fxSpr('explosion', s.x, s.y, 30, { w: 300, dur: 0.55 }); fxShock(s.x, s.y, 220, '#ffb070');
  sfx.boom(1.3); cam.shake = 10; cam.flash = 0.1; cam.flashCol = '#ffe8d0';
  summonArea(s, s.x, s.y, 170, { dmg: (s.dmg || 16) * 0.7, type: 'indep', elem: 'fire', launch: 480, knock: 140, hs: 0.13, big: 1.8, downHit: true, snd: 'fire', col: '#ffc090' }, { zMax: 220 });
}
const sfVacDraw = (c, s) => { const X = sx(s.x), Y = sy(s.y, 0); c.save(); c.translate(X, Y); c.scale(1, GR); c.rotate(-game.t * 6); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.7; drawSpr(c, fxTint('vortex', '#5a7aff'), 0, 0, 260, 260, {}); c.restore(); };
defSummon('gs_vac', { kind: 'attach', life: 3, max: 1, over: 'oldest', keepRoom: false, type: 'indep', tags: ['vac'], tick: 0.3,
  update: sfVacPull, onTick(s, h) { summonArea(s, s.x, s.y, 150, { dmg: (s.dmg || 16) * 0.03, type: 'indep', stun: 0.25, hs: 0.01, downHit: true, col: '#bfd0ff' }, { zMax: 160 }); },
  onEnd(s, why) { if (why === 'life' || why === 'cmd' || why === 'dead') sfVacBoom(s); }, draw: sfVacDraw });
defSummon('gs_vacg', { kind: 'field', life: 4, r: 60, max: 1, over: 'oldest', keepRoom: false, type: 'indep', tags: ['vac'],
  update(s, dt) { sfVacPull(s, dt); if (s.stuckTo) return;
    for (const t of ents) if (foe(s.owner, t) && !t.dead && inGround(t, s.x, s.y, 40) && t.z < 20) { s.stuckTo = t; dismissOne(s, 'stick'); const n = summon(s.owner, 'gs_vac', { target: t, lv: s.lv }); if (n) n.dmg = s.dmg; break; } },
  onEnd(s, why) { if (why === 'life' || why === 'cmd') sfVacBoom(s); }, draw: sfVacDraw });
// ---- 26 / 27 级：二觉（芙蕾雅）----
defSkill('gs_airmaster', { name: '制空掌握', cls: 'gun', job: SF, lvReq: 26, tier: 2, passive: true, sp: 30, col: '#4ab8e8',
  desc: '【被动 · 二觉】以鸟瞰的视角看穿敌人的弱点：普攻和技能的攻击力提高；身在空中时再额外提高。', infoExtra: lv => [['攻击力', '+' + pct(0.1 + 0.01 * lv)], ['空中时再', '+' + pct(0.1 + 0.01 * lv)]] });
defSkill('gs_openfire', { name: '开火', cls: 'gun', job: SF, lvReq: 26, tier: 2, mp: 120, cd: 45, type: 'indep', col: '#e0702a', air: true, cmdNote: '→←→+Z（地面施放会跃起，不耗推进器）',
  desc: '跃向空中，把身上所有的手雷一口气砸向前方：G-14、G-35L、G-18C 各两颗依次爆炸（火 / 光 / 冰）。地面施放时直接跃起，不消耗推进器次数；空中也能用。投掷时霸体。',
  pow: lv => skillDmg(21, 2.1, lv), ai: { kind: 'aoe', r: [60, 380], dy: 60 },
  act: lv => sfAct({ name: 'gs_openfire', clip: 'sfAirThrow', dur: 0.95, superArmor: true, noCounter: true,
    onStart: e => { if (!e.act.air) { e.vz = 520; e.act.lowGrav = 0.35; } },
    events: [0.3, 0.38, 0.46, 0.54, 0.62, 0.7].map((t, i) => evAt(t, e => { if (i % 2 === 0) e.play('sfAirThrow', true); sfx.swing(false);
      const kind = ['fire', 'light', 'ice'][i % 3], x = e.x + e.face * (110 + i * 50 + rnd(-15, 15)), y = clamp(e.y + rnd(-30, 30), 8, DEPTH - 8), D = skillDmg(3.5, 0.35, lv) * sfGrenadeMul(e);
      lobProj(e, x, y, 0.42, { img: kind === 'fire' ? 'grenade' : IMG['fx/' + (kind === 'light' ? 'sf_g35' : 'sf_g18')] ? (kind === 'light' ? 'sf_g35' : 'sf_g18') : fxTint('grenade', sfElemCol(kind)), h: 16, z0: 20, vz: 60,
        onLand: pr => { sfGrenadeBoom(e, pr.x, pr.y, kind, D, 80); } }); })) }, { noNitro: false }) });
// 手雷爆炸（按属性换表现）
function sfGrenadeBoom(e, x, y, kind, dmg, r) {
  if (kind === 'light') { fxSpr('spark', x, y, 30, { w: 180, dur: 0.35 }); fxShock(x, y, r + 10, '#fff38a'); sfx.sfZap(1); }
  else if (kind === 'ice') { fxSpr('frost', x, y, 20, { w: 180, dur: 0.5 }); fxShock(x, y, r + 10, '#bfefff'); sfx.sfFreeze(); }
  else meteorImpact({ x, y }, r / 130);
  cam.shake = Math.max(cam.shake, 5);
  blast(e, x, y, r, { dmg, type: 'indep', elem: kind === 'fire' ? undefined : kind, launch: 340, knock: 90, hs: 0.07, downHit: true, snd: 'fire', col: sfElemCol(kind),
    onHit: (a, t) => { if (kind === 'light') addStatus(t, 'shock', 5, { src: a }); else if (kind === 'ice' && Math.random() < 0.5) addStatus(t, 'freeze', 2, { src: a }); } }, { zMax: 160 });
}
defSkill('gs_photon', { name: '光子霰雷发射器', cls: 'gun', job: SF, lvReq: 26, tier: 2, mp: 150, cd: 45, type: 'indep', elem: 'light', col: '#8ad8ff', air: true, cmdNote: '↓→→+Z（地面施放会跃起）',
  desc: '跃向空中撒出 8 颗光子手雷，同时朝地面射出强力的磁力弹；光子手雷被磁力吸向落点，依次爆炸。空中也能用。',
  pow: lv => skillDmg(24, 2.4, lv), ai: { kind: 'aoe', r: [60, 360], dy: 60 },
  act: lv => sfAct({ name: 'gs_photon', clip: 'sfAirThrow', dur: 0.9, superArmor: true, noCounter: true,
    onStart: e => { if (!e.act.air) { e.vz = 520; e.act.lowGrav = 0.35; } },
    events: [evAt(0.3, e => { sfx.swing(true); const orbs = [];
      for (let i = 0; i < 8; i++) orbs.push(spawnProj({ owner: e, x: e.x + e.face * 20, y: e.y, z: e.z + 50, vx: e.face * rnd(60, 260), vy: rnd(-90, 90), vz: rnd(120, 300), grav: 500, life: 3, w: 8, d: 8, h: 10, pierce: true, hit: null, face: e.face, i,
        update(pr, dt) { if (pr.z < 30) { pr.z = 30; pr.vz = 0; pr.vx *= 0.9; pr.vy *= 0.9; } const m = pr.mag; if (m) { pr.grav = 0; const dx = m.x - pr.x, dy = m.y - pr.y, d = Math.hypot(dx, dy) || 1, sp = 520 + pr.t * 300;
          pr.vx = dx / d * sp; pr.vy = dy / d * sp * 0.6; pr.vz = (10 - pr.z) * 4; if (d < 18 + pr.i * 2) { pr.t = pr.life; sfGrenadeBoom(e, m.x + rnd(-20, 20), m.y + rnd(-10, 10), 'light', skillDmg(3.0, 0.3, lv), 70); } } },
        draw(c, pr) { drawSpr(c, fxTint('orb', '#8fe0ff'), sx(pr.x), sy(pr.y, pr.z), 22, 22, {}); } }));
      e.act.orbs = orbs; }),
      evAt(0.5, e => { const x = e.x + e.face * 220, y = e.y, air = e.z > 2; muzzle(e); sfx.cannon(0.9); sfTracer(e, e.x + e.face * 34, e.z + 60, x, 0, '#8fe0ff', 6);
        fxSpr('quantum', x, y, 10, { w: 140, dur: 1.4, col: '#8fe0ff' }); fxShock(x, y, 80, '#8fe0ff');
        (e.act.orbs || []).forEach((pr, i) => game.after(0.1 + i * 0.06, () => { pr.mag = { x, y }; })); })] }, { noNitro: false }) });
defSkill('gs_dday', { name: '决战之日', cls: 'gun', job: SF, lvReq: 27, tier: 2, maxLv: 3, mp: 300, cd: 180, pvp: 0.45, type: 'indep', awaken: true, col: '#e0a02a', airIf: sfCanAir,
  desc: '【二次觉醒】向前方投出激光信号弹，呼叫炮兵支援和战争女神机动队：炮弹覆盖信号弹周围，机动队从空中俯冲扫射，最后集中轰炸。投掷信号弹时无敌；空中也能用。',
  pow: lv => skillDmg(60, 12, lv), ai: { kind: 'awaken', r: [0, 420], dy: 90 },
  act: lv => sfAct({ name: 'gs_dday', clip: 'sfFlare', dur: 1.0, superArmor: true, noCounter: true, invul: [0, 1.0],
    onStart: e => { game.cutin = { t: 0, dur: 1.0, name: '决战之日', who: sfCutin(e, 2) }; game.timeStop = 0.9; sfx.awaken(); },
    events: [evAt(0.55, e => { sfx.swing(true); const at = aimAhead(e, 240, 420), D = skillDmg(60, 12, lv);
      lobProj(e, at.x, at.y, 0.45, { img: IMG['fx/sf_flare'] ? 'sf_flare' : fxTint('orb', '#ff5a3a'), h: IMG['fx/sf_flare'] ? 22 : 14, z0: e.z > 2 ? 20 : 70, vz: e.z > 2 ? 60 : 300, onLand: pr => { const s = summon(e, 'gs_dday', { x: pr.x, y: pr.y, lv }); if (s) s.dmg = D; } }); })] }) });
defSummon('gs_dday', { kind: 'field', life: 4.2, r: 0, max: 1, keepRoom: false, type: 'indep',
  update(s) { const D = s.dmg || 60, o = s.owner; if (s.lifeT < 3.6 && Math.random() < 0.3) fxDust(s.x, s.y, 1, 6, '#e06a5a');
    // 炮击：0.6~2.4 秒 20 发
    const k = Math.floor((s.lifeT - 0.6) / 0.09); if (s.lifeT > 0.6 && k !== s.k && k < 20) { s.k = k; const L = ents.filter(t => foe(o, t) && inGround(t, s.x, s.y, 280)), T = L.length && k % 3 ? pick(L) : null;
      const x = T ? T.x + rnd(-20, 20) : s.x + rnd(-200, 200), y = clamp(T ? T.y + rnd(-10, 10) : s.y + rnd(-60, 60), 8, DEPTH - 8);
      telegraph({ x, y, r: 36, dur: 0.25, kind: 'circle', col: '#ff8a4a', friendly: true, fire: g => { meteorImpact(g, 0.45); summonArea(s, g.x, g.y, 70, { dmg: D * 0.025, type: 'indep', launch: 280, knock: 80, hs: 0.04, downHit: true, snd: 'fire' }, { zMax: 160 }); } }); }
    // 机动队俯冲扫射：1.4~2.8 秒，3 架从后方飞过
    if (s.lifeT > 1.4 && !s.jets) { s.jets = true; for (let i = 0; i < 3; i++) sfJet(s, o.face, i, D); }
    // 集中轰炸
    if (s.lifeT > 3.6 && !s.fin) { s.fin = true; for (let i = 0; i < 5; i++) game.after(i * 0.08, () => { const x = s.x + (i - 2) * 70; meteorImpact({ x, y: s.y }, 1.1); });
      game.after(0.35, () => { if (ents.indexOf(o) < 0) return; cam.shake = 14; cam.flash = 0.2; cam.flashCol = '#fff0c0'; sfx.boom(1.6);
        summonArea(s, s.x, s.y, 280, { dmg: D * 0.25, type: 'indep', launch: 560, knock: 220, hs: 0.15, big: 2.2, downHit: true, snd: 'fire', col: '#ffe0a0' }, { zMax: 300 }); }); } },
  draw(c, s) { if (s.lifeT > 3.6) return; if (IMG['fx/sf_flare']) drawSpr(c, 'sf_flare', sx(s.x), sy(s.y, 0) - 4, 0, 18, { rot: 1.2, add: false }); drawSpr(c, fxTint('orb', '#ff4a2a'), sx(s.x) + 6, sy(s.y, 0) - 10, 26 + Math.sin(game.t * 20) * 4, 0, {}); } });
// 战争女神机动队：一架从画面后方低空飞过、沿途扫射的空降兵（有素材 fx/sf_valk 时用素材）
function sfJet(s, face, i, D) {
  const o = s.owner, y = clamp(s.y + (i - 1) * 24, 8, DEPTH - 8), x0 = s.x - face * 520, x1 = s.x + face * 520, T = 1.2, t0 = i * 0.25;
  addFx({ dur: T + t0, y: y + 0.5, add: false, draw(c) { const u = (this.t - t0) / T; if (u < 0 || u > 1) return; const x = lerp(x0, x1, u), z = 150 - Math.sin(u * Math.PI) * 60;
    if (IMG['fx/sf_valk']) drawSpr(c, 'sf_valk', sx(x), sy(y, z), 90, 0, { flip: face < 0, add: false });
    else { c.fillStyle = '#5a6a7a'; c.save(); c.translate(sx(x), sy(y, z)); c.scale(face, 1); c.beginPath(); c.moveTo(30, 0); c.lineTo(-24, -10); c.lineTo(-30, 0); c.lineTo(-24, 10); c.closePath(); c.fill(); c.restore(); }
    drawSpr(c, fxTint('flame', '#6ac8ff'), sx(x - face * 40), sy(y, z), 40, 14, { flip: face > 0 }); } });
  for (let k = 0; k < 5; k++) game.after(t0 + 0.25 + k * 0.16, () => { if (ents.indexOf(o) < 0) return; const x = lerp(x0, x1, (0.25 + k * 0.16) / T);
    sfx.gun(0.7); fxSpr('spark', x, y, 10, { w: 60, dur: 0.2 }); fxDust(x, y, 3, 14, '#a89878');
    summonArea(s, x, y, 90, { dmg: D * 0.02, type: 'indep', stun: 0.3, knock: 20, airLift: 120, hs: 0.02, downHit: true, snd: 'stab' }, { zMax: 200 }); });
}
// ---- 29 / 30 级：三觉（重霄·弹药专家）----
defSkill('gs_02x', { name: '单兵推进器-02X', cls: 'gun', job: SF, lvReq: 29, tier: 3, passive: true, sp: 30, col: '#5ac8ff',
  desc: '【被动 · 三觉】换装推进器-02X：每跳空中动作次数 +1，普攻和转职技能攻击力提高。M18 阔剑地雷改为投掷圆盘，感应范围变成一整圈（推开距离缩短）；G-18C 冰冻手雷爆炸处留下冰雾 3 秒，在冰雾里累计待满 3 秒的敌人被特殊冰冻 2 秒。',
  infoExtra: lv => [['每跳空中动作', '+1'], ['普攻 / 转职技能攻击力', '+' + pct(0.2 + 0.02 * (lv - 1))]] });
defSkill('gs_standby', { name: '空袭战略', cls: 'gun', job: SF, lvReq: 29, tier: 3, mp: 150, cd: 60, type: 'indep', col: '#d8b83a', air: true, cmdNote: '↑↓→→+Z（再按：提前引爆过载部件）',
  desc: '装上推进器-02X 的机体部件，飞到轰炸高度悬停 6 秒：期间推进器次数不减、空中技能没有后坐、空中射击发数 +12，每种手雷至少留 1 颗；G-14 / G-35L / G-18C 变成强化手雷（共 6 次：G-14 碰地大爆炸、G-35L 留下磁场、G-18C 留下寒气）。再按技能键或时间到了，丢下过载的机体部件引发大爆炸。',
  pow: lv => skillDmg(18, 1.8, lv), infoExtra: () => [['悬停', '6 秒'], ['强化手雷', '6 次']], ai: { kind: 'buff' },
  recast: { ok: p => standbyOn(p), cd: 0.3, act: () => ({ name: 'gs_standbyd', clip: 'gbuff', dur: 0.2, noCounter: true, onStart: e => sfStandbyEnd(e) }) },
  act: lv => sfAct({ name: 'gs_standby', clip: 'sfHover', dur: 0.5, superArmor: true, noCounter: true,
    onStart: e => { e.buffs.gs_standby = { t: 6, lv, throws: 6, dmg: skillDmg(18, 1.8, lv) }; e.act.lowGrav = 0; sfx.buff(); fxAura(e, '#ffd23a', 1.2); nitroFx(e, 'up'); } }, { noNitro: true, keepGrav: true }) });
const SF_HOVER_Z = 150;
function sfTickStandby(p, dt) {
  const b = p.buffs && p.buffs.gs_standby;
  if (b) { p._sbOn = b; p._sbHome = p.buffs;
    if (!p.dead && p.st !== 'air' && p.st !== 'held' && p.st !== 'down') { const want = (SF_HOVER_Z - p.z) * 5; p.vz = want + GRAV * dt * (p.act && p.act.lowGrav !== undefined ? p.act.lowGrav : 1); if (p.z < 1) p.z = 1.5; if (p.st === 'idle' || p.st === 'walk' || p.st === 'run') p.setState('jump'); }
    if (Math.random() < 0.3) addFx({ x: p.x - p.face * 8, y: p.y + 0.3, z: p.z + 38, dur: 0.2, add: true, draw(c) { drawSpr(c, fxTint('flame', '#6ac8ff'), sx(this.x), sy(this.y, this.z - this.t * 60), 20, 30, { rot: Math.PI / 2, alpha: 1 - this.t / this.dur }); } });
    return; }
  if (p._sbOn) { const s0 = p._sbOn; p._sbOn = null; if (p._sbHome === p.buffs && !p.dead) sfStandbyFinish(p, s0); }   // 进新地下城时 buffs 整个被换掉：不引爆
}
function sfStandbyEnd(p) { const b = p.buffs.gs_standby; if (!b) return; delete p.buffs.gs_standby; p._sbOn = null; sfStandbyFinish(p, b); }
function sfStandbyFinish(p, b) {
  const x = p.x + p.face * 30, y = p.y, z = p.z;
  fxText('过载部件！', p.x, p.y, p.z + 20, { col: '#ffd23a', size: 12 }); sfx.swing(true);
  spawnProj({ owner: p, x, y, z, vx: p.face * 60, vy: 0, vz: -200, grav: 900, life: 3, w: 10, d: 10, h: 10, pierce: true, hit: null, face: p.face, shadow: 12,
    draw(c, pr) { drawSpr(c, IMG['fx/sf_parts'] ? 'sf_parts' : fxTint('shell', '#ffd23a'), sx(pr.x), sy(pr.y, pr.z), 44, 0, { rot: pr.t * 8, add: !IMG['fx/sf_parts'] }); },
    onEnd: pr => { if (ents.indexOf(p) < 0) return; meteorImpact(pr, 1.3); cam.flash = 0.15; cam.flashCol = '#fff0c0';
      blast(p, pr.x, pr.y, 190, { dmg: b.dmg || 18, type: 'indep', launch: 520, knock: 200, hs: 0.14, big: 2, downHit: true, snd: 'fire', col: '#ffe0a0' }, { zMax: 260 }); } });
}
// 空袭战略中的强化手雷（G-14 / G-35L / G-18C 投掷时调用；返回 true = 已经按强化版投出）
function sfReinforced(e, id, lv) {
  const b = e.buffs && e.buffs.gs_standby; if (!b || b.throws <= 0) return false; b.throws--;
  if (id === 'gs_g35') sfThrowG35(e, lv, true);
  else if (id === 'gs_g18') sfThrowG18(e, lv, true);
  else { sfx.swing(false); const D = skillDmg(3.0, 0.3, lv) * sfGrenadeMul(e, true); sfGrenade(e, { img: 'grenade', col: '#ffb060', onBoom: pr => sfGrenadeBoom(e, pr.x, pr.y, 'fire', D, 110) }); }
  fxText('强化', e.x, e.y, e.z + 10, { col: '#ffd23a', size: 10 });
  return true;
}
// 强化 G-35L 留下的磁场：2 秒多段光属性伤害
defSummon('gs_magf', { kind: 'field', life: 2, r: 90, tick: 0.2, zMax: 120, max: 3, keepRoom: false, type: 'indep', elem: 'light',
  onTick(s, L) { for (const t of L) summonHit(s, t, { dmg: skillDmg(0.3, 0.03, s.lv), type: 'indep', elem: 'light', stun: 0.15, hs: 0.01, downHit: true, col: '#fff38a' }); },
  draw(c, s) { const X = sx(s.x), Y = sy(s.y, 0); c.save(); c.translate(X, Y); c.scale(1, GR); c.rotate(game.t * 3); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.55; drawSpr(c, fxTint('rune', '#fff38a'), 0, 0, 190, 190, {}); c.restore(); } });
defSkill('gs_final', { name: '终解·制空霸权', cls: 'gun', job: SF, lvReq: 30, tier: 3, maxLv: 3, mp: 400, cd: 290, pvp: 0.45, type: 'indep', awaken: true, col: '#ffd23a', airIf: sfCanAir,
  desc: '【三次觉醒】装上推进器-02X 和飞翼急速升空，先对前方大范围轰炸，再装上附加部件全武装俯冲突进，边下降边进行最后的轰炸，落地引发大爆炸。全程无敌。空中施放要有推进器次数；空袭战略中施放时，过载部件立刻坠落引爆。',
  pow: lv => skillDmg(90, 20, lv), ai: { kind: 'awaken', r: [0, 520], dy: 100 },
  act: lv => sfAct({ name: 'gs_final', clip: 'sfSoar', dur: 4.0, superArmor: true, noCounter: true, invul: [0, 4.2], lowGrav: 0,
    onStart: e => { game.cutin = { t: 0, dur: 1.0, name: '终解·制空霸权', who: sfCutin(e, 3) }; game.timeStop = 0.9; sfx.awaken(); if (standbyOn(e)) sfStandbyEnd(e);
      const a = e.act; a.x0 = e.x; a.D = skillDmg(90, 20, lv); a.z0 = e.z; sfWings(e, 4.0); },
    update: (e, dt) => { const a = e.act, t = e.actT;
      if (t < 0.6) { e.vz = (240 - e.z) * 6; if (Math.random() < 0.5) nitroFx(e, 'up'); }
      else if (t < 2.3) { e.vz = (240 - e.z) * 4; e.vx = 0; e.play('sfBomb'); }
      else if (t < 3.4) { e.play('sfDashAtk'); e.vz = -240 / 1.1 - 40; e.vx = e.face * 330; }
      else { e.vx *= 0.8; } },
    events: [...Array.from({ length: 7 }, (_, i) => evAt(0.75 + i * 0.2, e => { const a = e.act, x = e.x + e.face * (120 + i * 60 + rnd(-20, 20)), y = clamp(e.y + rnd(-60, 60), 8, DEPTH - 8);
        sfx.swing(false); lobProj(e, x, y, 0.35, { img: IMG['fx/sf_bomb'] ? 'sf_bomb' : 'bomb', h: 26, z0: -20, vz: 0, spinV: 0, update: pr => { pr.spin = IMG['fx/sf_bomb'] ? Math.PI : 0; }, onLand: pr => { meteorImpact(pr, 0.8);
          blast(e, pr.x, pr.y, 110, { dmg: a.D * 0.05, type: 'indep', launch: 360, knock: 90, hs: 0.06, downHit: true, snd: 'fire' }, { zMax: 300 }); } }); })),
      ...Array.from({ length: 5 }, (_, i) => evAt(2.35 + i * 0.2, e => { const a = e.act; muzzle(e); sfx.cannon(0.8); cam.shake = Math.max(cam.shake, 6);
        sfTracer(e, e.x + e.face * 30, e.z + 50, e.x + e.face * 260, 0, '#ffe07a', 6); fxSpr('explosion', e.x + e.face * 160, e.y, 20, { w: 180, dur: 0.35 });
        instantHit(e, { box: [-40, 320, 70, -e.z - 20, 140], dmg: a.D * 0.08, type: 'indep', stun: 0.5, knock: 60, launch: 240, hs: 0.06, big: 1.5, downHit: true, sure: true, snd: 'fire' }); })),
      evAt(3.45, e => { const a = e.act; e.play('sfLand', true); cam.shake = 16; cam.flash = 0.25; cam.flashCol = '#fff4d0'; sfx.boom(1.8); fxShock(e.x, e.y, 320, '#ffd070');
        fxSpr('explosion', e.x + e.face * 60, e.y, 40, { w: 420, dur: 0.7 });
        for (const t of ents) if (hittable(e, t) && Math.abs(t.x - e.x) < 320 && Math.abs(t.y - e.y) < 110) applyHit(e, t, { dmg: a.D * 0.25, type: 'indep', launch: 560, knock: 240, hs: 0.16, big: 2.4, sure: true, downHit: true, snd: 'fire' }, { proj: true }); })] }, { keepGrav: true }) });
// 三觉飞翼：跟着角色画在身后（有素材 fx/sf_wings 时用素材）
function sfWings(e, dur) {
  addFx({ ent: e, dur, y: e.y - 0.3, add: true, update() { this.y = this.ent.y - 0.3; },
    draw(c) { const E = this.ent, X = sx(E.x - E.face * 6), Y = sy(E.y, E.z + 60), k = this.t / this.dur, a = k < 0.1 ? k / 0.1 : k > 0.9 ? (1 - k) / 0.1 : 1;
      if (IMG['fx/sf_wings']) drawSpr(c, 'sf_wings', X, Y, 150, 0, { flip: E.face < 0, alpha: a, add: false });
      else for (const s of [-1, 1]) drawSpr(c, fxTint('slash', '#8fd8ff'), X + s * 30 - E.face * 20, Y - 6, 90, 34, { rot: s * 0.5, flip: s < 0, alpha: a * 0.8 }); } });
}
// 二觉 / 三觉插图（art/final/cutin/spitfire2、spitfire3；没有时用一觉的）
const sfCutin = (e, n) => IMG['cutin/spitfire' + n] ? { cls: 'spitfire' + n, model: e.model, x: e.x } : cutinWho(e);

/* =====================================================================
   职业钩子（包一层：先调原来的，再判断 jobOf(p) === 'spitfire'）
   ===================================================================== */
{
  const C = CLASSES.gun;
  const pre0 = C.preControl; C.preControl = (p, I, dt) => (isSf(p) && sfPreControl(p, I, dt)) || (pre0 ? pre0(p, I, dt) : false);
  const air0 = C.airControl; C.airControl = (p, I, dt) => (isSf(p) && sfAirControl(p, I, dt)) || (air0 ? air0(p, I, dt) : false);
  // 空中技能许可：转职技能各自写了 airIf；基础技能里 G-14 在有推进器次数时也能在空中投（Buff 类只能在地面放，避免和空中 Space 急降抢键）
  const SF_AIR_BASE = ['g_grenade'];
  const aok0 = C.airOk; C.airOk = (p, S) => (isSf(p) && SF_AIR_BASE.includes(S.id) && sfCanAir(p)) || (aok0 ? aok0(p, S) : false);
  // 施放钩子：基础技能在空中施放时耗推进器（转职技能在 sfAct 里扣）；空中投 G-14 间隔 0.5 秒；空袭战略中的强化 G-14
  const cast0 = C.onCast; C.onCast = (p, id, act, how) => { if (cast0) cast0(p, id, act, how);
    if (!isSf(p) || how === 'recast' || !SKILLS[id] || SKILLS[id].job === SF) return;
    if (p.z > 2 && SF_AIR_BASE.includes(id)) { useNitro(p, 1); if (id === 'g_grenade') p.cool[id] = Math.min(p.cool[id] || 0, 0.5); } };
  const shot0 = C.shotMod; C.shotMod = (e, o) => { if (shot0) o = shot0(e, o) || o; return isSf(e) ? sfShotMod(e, o) : o; };
  const mul0 = C.skillMul; C.skillMul = (e, id) => (mul0 ? mul0(e, id) : 1) * (isSf(e) && SF_GRENADES.includes(id) ? sfGrenadeMul(e) : 1);
  const am0 = C.airMaxOf; C.airMaxOf = p => (am0 ? am0(p) : 1) + (isSf(p) && standbyOn(p) ? 12 : 0);
  const hit0 = C.onHit; C.onHit = (a, t, h, dmg, act, opt) => { if (hit0) hit0(a, t, h, dmg, act, opt); if (isSf(a) && foe(a, t)) sfOvercurrent(a, t); };
  // 被动：空中射击常驻（等级 = 空中射击 + 推进器）、兵器研究、弹药改良、制空掌握、02X
  (C.passives || (C.passives = [])).push(p => {
    const on = isSf(p);
    if (on) { const lv = Math.min(10, Math.max(1, skLv(p, 'g_aerial')) + skLv(p, 'gs_nitro')); p.buffs.g_aerial = { t: 0.4, lv, passive: true }; }
    const fm = sfLv(p, 'gs_firearm'); setPassive(p, 'gs_firearm', on && fm > 0 && sfRifle(p), { aspd: 0.08 + 0.02 * fm, atk: 0.01 * fm });
    const bo = sfLv(p, 'gs_booster'), el = sfElem(p), mode = !!sfMode(p);
    setPassive(p, 'gs_booster', on && bo > 0 && mode && !el, { dmg: 0.1 });
    sfElemBoost(p, on && bo > 0 && mode && el ? el : null, 10 + 2 * bo);
    const am = sfLv(p, 'gs_airmaster'); setPassive(p, 'gs_airmaster', on && am > 0, { dmg: (0.1 + 0.01 * am) * (p.z > 2 ? 2 : 1) });
    const x2 = sfLv(p, 'gs_02x'); setPassive(p, 'gs_02x', on && x2 > 0, { dmg: 0.2 + 0.02 * (x2 - 1) });
  });
}
// 弹药改良的属性强化：直接加在 p.elem 上（recalcStats 会重建 p.elem，这里记住加在哪个对象上，避免重复扣减）
function sfElemBoost(p, el, v) {
  const B = p._sfElemB; if (B && B.obj === p.elem && B.el === el && B.v === v) return;
  if (B && B.obj === p.elem && B.el) p.elem[B.el] -= B.v;
  p._sfElemB = null; if (!el || !p.elem) return;
  p.elem[el] = (p.elem[el] || 0) + v; p._sfElemB = { obj: p.elem, el, v };
}
// 基础手雷在空袭战略中投出强化版：包一层 G-14 的动作
{
  const S = SKILLS.g_grenade, act0 = S.act;
  S.act = (lv, p) => { const A = act0(lv, p); if (!isSf(p) || !A.events || A.events.length !== 1) return A;
    const f0 = A.events[0].fn; A.events = [{ ...A.events[0], fn: e => { if (!sfReinforced(e, 'g_grenade', lv)) f0(e); } }];
    return A; };
}

/* =====================================================================
   转职登记
   ===================================================================== */
CLASSES.gun.jobs.spitfire = { art: 'job/spitfire', name: '弹药专家', role: '远程 · 空中轰炸（固伤）', armor: 'leather',
  awaken: 'gs_emp', awakenName: '战争女神', awaken2: 'gs_dday', awakenName2: '芙蕾雅', awaken3: 'gs_final', awakenName3: '重霄·弹药专家',
  desc: '背着单兵推进器在空中作战的弹药专家。超负荷装填切换火 / 冰 / 光属性，三种特殊子弹改变射击方式，手雷、地雷与 C4 从空中倾泻而下。',
  skills: ['gs_nitro', 'gs_overcharge', 'gs_elem', 'gs_booster', 'gs_firearm', 'gs_gmastery', 'gs_m18', 'gs_cross', 'gs_g35', 'gs_pierce', 'gs_burst', 'gs_g18',
    'gs_buster', 'gs_c4', 'gs_napalm', 'gs_lockon', 'gs_arsenal', 'gs_emp', 'gs_g61', 'gs_chelli', 'gs_airmaster', 'gs_openfire', 'gs_photon', 'gs_dday', 'gs_02x', 'gs_standby', 'gs_final'],
  // 人物动作片段（通用组在 content/sprites.js 里合进 SPR_ANIMS.gun）：新帧用 sf 前缀（art/tools/spitfire_art.py 的 gun_spitfire1 / gun_spitfire2 两张表）
  anims: {
    sfUp: [['sfUp', 0]], sfDash: [['sfDash', 0]], sfDive: [['sfDive', 0]], sfReload: [['reload', 0], ['twirl', 0.2]], sfPlant: [['sfPlant', 0]], sfAimDown: [['sfAimDown', 0]],
    sfCross: [['sfCross', 0]], sfThrow: [['throw1', 0], ['throw2', 0.2]], sfAim: [['snipe', 0], ['shoot2', 0.14]], sfAirThrow: [['sfAirThrow1', 0], ['sfAirThrow2', 0.12]],
    sfEmp: [['sfEmp1', 0], ['sfEmp2', 0.55]], sfFlare: [['sfFlare', 0]], sfHover: [['sfHover', 0]], sfBomb: [['sfBomb', 0]], sfSoar: [['sfSoar', 0]], sfDashAtk: [['sfDashAtk', 0]], sfLand: [['sfLand', 0]],
  },
  // 转职任务线（官方经典：凯丽 → 卡坤「多重弹匣」→ 暗黑雷鸣废墟 → 红 / 白小晶块 → 凯丽；小晶块按本作经济改成各 10 个，见 docs/SKILLS_OFFICIAL_gun.md 第 7.4 节）
  quests: [
    ['q_job_spitfire_1', { type: 'job', cls: 'gun', job: false, name: '弹药专家 - 多重弹匣', npc: 'kiri', to: 'kakun', lvl: 15, pre: 'q_job_gun_final',
      desc: '凯丽说，暗精灵商人卡坤那里有一种叫「多重弹匣」的新式弹药。去赫顿玛尔找卡坤打听打听。',
      talk: { offer: ['喜欢在天上飞来飞去、把炸弹撒满整个战场？那弹药专家最适合你啦~', '先去找卡坤吧，那个暗精灵在做一种叫「多重弹匣」的东西。我也想要一个！'],
        done: ['……凯丽让你来的？', '多重弹匣可不是谁都用得了的。一次装填好几种弹药，要是控制不好，先炸飞的就是你自己。'] },
      reward: { expFrac: 0.04, gold: 300, unlock: 'dark_thunder' } }],
    ['q_job_spitfire_2', { type: 'job', cls: 'gun', job: false, name: '弹药专家 - 试射', npc: 'kakun', lvl: 15, pre: 'q_job_spitfire_1',
      desc: '卡坤要你带着试作的多重弹匣去暗黑雷鸣废墟实战一次。通关暗黑雷鸣废墟。',
      goals: [{ type: 'clear', dungeon: 'dark_thunder' }],
      talk: { offer: ['去暗黑雷鸣废墟试试这个弹匣。那里的亡灵不怕痛，正好拿来试射。', '活着回来，把弹匣的使用感告诉我。'], doing: ['暗黑雷鸣废墟就在格兰之森的深处。'], done: ['弹匣没炸？你也没炸？很好。'] },
      reward: { expFrac: 0.08, gold: 800, items: [{ key: 'hpM', n: 3 }] } }],
    ['q_job_spitfire_3', { type: 'job', cls: 'gun', job: false, name: '弹药专家 - 属性弹芯', npc: 'kakun', lvl: 15, pre: 'q_job_spitfire_2',
      desc: '改良多重弹匣需要属性弹芯：带 10 个红色小晶块和 10 个白色小晶块给卡坤（卡坤的店里就有卖）。',
      goals: [{ type: 'item', key: 'c_red', n: 10 }, { type: 'item', key: 'c_white', n: 10 }],
      talk: { offer: ['试射的数据不错，但弹芯还差点意思。', '火之力的红色小晶块、光之力的白色小晶块，各 10 个。我店里就有，嫌贵就自己去打。'], doing: ['红色、白色小晶块，各 10 个。'], done: ['……弹芯装好了。拿着，回去给凯丽看看吧。'] },
      reward: { expFrac: 0.06, gold: 600 } }],
    ['q_job_spitfire_4', { type: 'job', cls: 'gun', job: false, name: '弹药专家 - 新的弹匣', npc: 'kakun', to: 'kiri', lvl: 15, pre: 'q_job_spitfire_3',
      desc: '带着改装好的多重弹匣回到凯丽那里。',
      talk: { offer: ['凯丽等着呢。告诉她，这个弹匣配得上真正的弹药专家。'], done: ['哇——这就是多重弹匣？好厉害！', '准备好了就在我这里转职吧，未来的弹药专家！'] },
      reward: { expFrac: 0.05, gold: 500, items: [{ key: 'elixir', n: 1 }] } }],
  ],
  trial: 'q_job_spitfire_4' };
// 指令（f 前 b 后 u 上 d 下；省略按键 = Z，buff = Space）。和基础技能重复的指令按千海天规则：冷却长的生效（聚合弹 ↑→+Z 压过烟尘弹）
CLASSES.gun.cmds.push(['ff', 'gs_overcharge', 'buff'], ['f', 'gs_elem', 'buff'], ['uf', 'gs_pierce', 'buff'], ['d', 'gs_burst', 'buff'],
  ['dd', 'gs_m18'], ['ff', 'gs_cross'], ['bff', 'gs_g35'], ['uff', 'gs_g18'], ['uf', 'gs_buster'], ['bf', 'gs_c4'], ['bdf', 'gs_napalm'], ['udd', 'gs_lockon'],
  ['uudd', 'gs_emp'], ['fbdf', 'gs_g61'], ['dud', 'gs_chelli'], ['fbf', 'gs_openfire'], ['dff', 'gs_photon'], ['duff', 'gs_dday'], ['udff', 'gs_standby'], ['bufd', 'gs_final']);
