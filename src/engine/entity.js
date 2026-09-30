/* =====================================================================
   10. 实体：状态机、物理、动画、绘制（伤害结算与受击反应见 engine/combat.js）
   坐标：x 横向、y 纵深（0..DEPTH）、z 高度；速度 vx vy vz（px/s）
   状态 st：
     idle walk run jump   可行动
     act                  执行动作（普攻 / 技能 / 后跳 / 闪避……），见下方“动作定义”
     hit                  地面硬直（stun 秒）；hitHeavy = 重击（播放重受击帧）
     air                  被打浮空（受浮空重力：连击越多下落越快）
     down                 倒地（downTime 秒后起身；只有带 downHit 的攻击能打到）
     getup                起身（带无敌）；tech = 受身起身
     held                 被抓取（位置由抓取者控制，不能行动）
     （air + thrown）     被扔出去（engine/combat.js throwArc：位置按弧线走，不受重力 / AI，落地结算）
     dead
   动作定义 act：{ name, clip, dur,
     hits:[{ t0, t1, box:[前沿0,前沿1,纵深半宽,z0,z1], dmg, type, elem, stun, knock, launch, airLift, down, downHit, grab, heavy, hs, rep, max, ... }],
     move:[[t0,t1,vx,vz?,vy?]], events:[{t,fn}], update(e,dt), onStart, onEnd(e,interrupted), onLand,
     superArmor: true | [t0,t1] | [[t0,t1],...]，invul: 同上（无敌窗口），noCounter（不会被破招），
     speed: 'aspd' | 'cspd' | 数字（动作速度），charge:{ at, max, min, dmg, clip, onRelease }（按住技能键蓄力），
     cancelFrom（此时间后可被技能 / 后跳取消），chain/next（普攻连段），airOnly, lowGrav,
     hurtH（动作中的受击盒高度：格斗家 蹲伏 = 压低到只有下段判定打得到；不写 = 身高） }
   ===================================================================== */
const GRAV = 1500;
const ents = [];
let entSeq = 1;
// 时间窗口：true = 整个动作；[t0,t1]；[[t0,t1],...]
function inWin(w, t) {
  if (!w) return false; if (w === true) return true;
  if (typeof w[0] === 'number') return t >= w[0] && t < w[1];
  for (const x of w) if (t >= x[0] && t < x[1]) return true;
  return false;
}
// BUFF 数值求和（buffs[k][key]）
function buffVal(e, key) { let s = 0; const B = e.buffs; if (B) for (const k in B) { const v = B[k][key]; if (v) s += v; } return s; }
// 持续回复（BUFF 的 hot = 每秒回复最大 HP 的比例，圣职者 缓慢愈合等）：每秒结算一次、飘绿字；键盘玩家在 game.step、其他格斗者在 tickFighter 里调用
function tickHot(e, dt) {
  const v = e.dead ? 0 : buffVal(e, 'hot'); if (!(v > 0)) { e._hotAcc = 0; e._hotT = 0; return; }
  e._hotAcc = (e._hotAcc || 0) + e.hpMax * v * dt; e._hotT = (e._hotT || 0) + dt; if (e._hotT < 1) return;
  const n = Math.min(Math.round(e._hotAcc), e.hpMax - e.hp); e._hotAcc = 0; e._hotT = 0;
  if (n > 0) { e.hp += n; addNumber(n, e.x, e.y, e.z, { col: '#7aff8a' }); }
}
// 免死（BUFF 的 life = 受到致命伤害时不死、回复到最大 HP 的这个比例，用掉这个 BUFF；圣骑士 生命源泉 / 复仇者 恶之再临等）；决斗里不生效。killEnt 开头调用
function lifeSave(t) {
  const B = t.buffs; if (!B || game.pvp) return false;
  const k = Object.keys(B).find(id => B[id].life > 0); if (!k) return false;
  const pct = Math.min(1, B[k].life), name = B[k].name || '免死'; delete B[k];
  t.hp = Math.max(1, Math.round(t.hpMax * pct)); t.invul = Math.max(t.invul || 0, 1);
  fxText(name, t.x, t.y, t.z + 30, { col: '#ffe07a', size: 14, dur: 1 }); if (typeof fxAura === 'function') fxAura(t, '#ffe9a0', 1);
  return true;
}
// 攻速 / 施放 / 移速倍率（1 = 基准；recalcStats 写面板值，BUFF 在读取时叠加）
const aspdOf = e => clamp((e.aspd ?? 1) + buffVal(e, 'aspd'), 0.5, 2.5);
const cspdOf = e => clamp((e.cspd ?? 1) + buffVal(e, 'cspd'), 0.5, 3);
const mspdOf = e => clamp((e.mspd ?? 1) + buffVal(e, 'mspd'), 0.5, 2);
class Ent {
  constructor(o) {
    Object.assign(this, {
      id: entSeq++, team: 'e', x: 0, y: 100, z: 0, vx: 0, vy: 0, vz: 0, face: 1,
      w: 14, d: 12, h: 100, weight: 1, hp: 1000, hpMax: 1000, mp: 0, mpMax: 0,
      // 战斗属性（怪物用默认值；玩家由 recalcStats 写入）
      atk: 100, def: 0, crit: 0.05, critDmg: 1.5, lvl: 1, name: '',
      hitRate: 0, evade: 0, hardness: 0, stagger: 0,
      st: 'idle', stT: 0, act: null, actT: 0, hitstop: 0, invul: 0, stun: 0, superArmor: 0, flash: 0,
      juggle: 0, downHits: 0, bounced: false, clipName: 'idle', animT: 0, pose: {}, dead: false, remove: false,
      speed: 150, runSpeed: 290, jumpV: 470, shadowR: 20, hitsDone: new Map(), stats: {},
      rot: 0, grabbed: null, heldBy: null, grabProt: 0, freeT: 0, thrown: null,
      // 本轮连击统计（被打浮空 / 倒地期间累计；决斗场保护机制用）
      cmb: { air: 0, airDmg: 0, down: 0, downDmg: 0, hits: 0, dmg: 0 },
    }, o);
    this.hpMax = this.hp;
  }
  get grounded() { return this.z <= 0.01 && this.vz <= 0; }
  get busy() { const s = this.st; return s === 'act' || s === 'hit' || s === 'air' || s === 'down' || s === 'getup' || s === 'dead' || s === 'held'; }
  // 可行动（能被输入 / AI 控制）
  get free() { const s = this.st; return s === 'idle' || s === 'walk' || s === 'run' || s === 'jump'; }
  setState(s) { if (this.st !== s) { this.st = s; this.stT = 0; } }
  play(name, restart = false) { if (this.clipName !== name || restart) { this.clipName = name; this.animT = 0; } }
  clipOr(...names) { for (const n of names) if (this.clips[n]) return n; return 'idle'; }
  doAct(def, extra) {
    if (this.act) { const o = this.act; this.act = null; if (o.onEnd) o.onEnd(this, true); }   // 被新动作取代时也要做收尾
    if (this.grabbed) dropGrab(this);
    const a = this.act = { ...def, ...extra }; this.actT = 0; this.hitsDone.clear(); this.setState('act');
    if (a.events) a.events = a.events.map(ev => ({ ...ev, done: false }));
    a.spd = a.speed === 'aspd' ? aspdOf(this) : a.speed === 'cspd' ? cspdOf(this) : typeof a.speed === 'number' ? a.speed : 1;
    // 破招判定结束时间：最后一个攻击判定结束（没有攻击判定的动作取前 60%）
    if (a.counterEnd === undefined) { let t1 = 0; if (a.hits) for (const h of a.hits) t1 = Math.max(t1, h.t1); a.counterEnd = t1 || a.dur * 0.6; }
    a.dmgMul = a.dmgMul || 1; a.charging = false; a.chargeDone = !a.charge;
    this.play(a.clip || def.name, true);
    if (a.onStart) a.onStart(this);
  }
  endAct() {
    const a = this.act; this.act = null;
    if (this.grabbed) dropGrab(this);
    if (this.st === 'act') this.setState(this.grounded ? 'idle' : 'jump');
    if (a && a.onEnd) a.onEnd(this);
  }
  // 中断当前动作（被打 / 被抓 / 眩晕）
  interrupt() { if (this.grabbed) dropGrab(this); if (this.act) { const a = this.act; this.act = null; if (a.onEnd) a.onEnd(this, true); } }
  // 当前的受击盒高度：倒地时很矮、浮空时是横躺的身体
  hurtH() { return this.st === 'down' ? 22 : this.st === 'air' ? this.h * 0.55 : this.st === 'act' && this.act && this.act.hurtH !== undefined ? this.act.hurtH : this.h; }
  update(dt) {
    if (this.flash > 0) this.flash -= dt;
    if (this.st === 'air') this.cmb.airT = (this.cmb.airT || 0) + dt;   // 本轮浮空时长（含打击停顿；JUGGLE：刷图 / 决斗防无限浮空）
    if (this.hitstop > 0) { this.hitstop -= dt; return; }
    this.stT += dt;
    if (this.invul > 0) this.invul -= dt;
    if (this.superArmor > 0) this.superArmor -= dt;
    if (this.grabProt > 0) this.grabProt -= dt;
    // ---- 被扔出去（throwArc）：位置按弧线走；中途被别的效果改了状态（脱身技能等）就停止 ----
    if (this.thrown) { if (this.st !== 'air' || this.dead) this.thrown = null; else { this.animT += dt; updateThrown(this, dt); this.animate(dt); return; } }
    // ---- 被抓取：位置由抓取者决定 ----
    if (this.st === 'held') { this.animT += dt; updateHeld(this, dt); this.animate(dt); return; }
    // ---- 动作 ----
    let spd = 1;
    if (this.st === 'act' && this.act) {
      const a = this.act; spd = a.spd;
      if (a.invul && inWin(a.invul, this.actT)) this.invul = Math.max(this.invul, 0.02);
      if (a.superArmor && a.superArmor !== true && inWin(a.superArmor, this.actT)) this.superArmor = Math.max(this.superArmor, 0.02);
      if (a.charge && !a.chargeDone && !a.charging && this.actT >= a.charge.at) { a.charging = true; a.chargeT = 0; this.actT = a.charge.at; if (a.charge.clip) this.play(a.charge.clip, true); }
      if (a.charging) {
        a.chargeT += dt;
        const held = this.pad ? this.pad.is(a.key) : false, C = a.charge;
        if (C.update) C.update(this, dt, a.chargeT / C.max);
        // C.hold：蓄满后继续按住就一直保持满蓄（最多再保持 C.holdMax 秒，默认 10），松开才发射（魔法师 移动施法）
        if ((!held && a.chargeT >= (C.min || 0)) || (a.chargeT >= C.max && !(C.hold && held && a.chargeT < C.max + (C.holdMax ?? 10)))) {
          a.charging = false; a.chargeDone = true; a.chargeK = clamp(a.chargeT / C.max, 0, 1); a.dmgMul *= 1 + a.chargeK * (C.dmg ?? 0.5);
          if (C.clip) { this.play(a.clip || a.name, true); this.animT = C.at; }
          if (C.onRelease) C.onRelease(this, a.chargeK);
        }
      } else { this.actT += dt * spd; if (a.recMul && this.actT > a.counterEnd) this.actT += dt * spd * (1 / a.recMul - 1); }   // recMul：最后一个判定结束后的后摇按 recMul 倍时长（暴走 0.5 = 后摇减半）
      if (this.act === a) {
        if (a.move) for (const m of a.move) if (this.actT >= m[0] && this.actT < m[1]) { this.vx = m[2] * this.face * spd; if (m[3] !== undefined) this.vz = m[3]; if (m[4] !== undefined) this.vy = m[4]; }
        if (a.update) a.update(this, dt);
        if (a.events && this.act === a) for (const ev of a.events) if (!ev.done && this.actT >= ev.t) { ev.done = true; ev.fn(this); if (this.act !== a) break; }
        if (this.act === a && this.actT >= a.dur) this.endAct();
      }
    }
    if ((this.st === 'walk' || this.st === 'run') && this.model && this.model.loopRate) spd = this.model.loopRate(this.clipName, Math.hypot(this.vx, this.vy));   // 走 / 跑的播放速度跟实际移速走（models/imgmodel.js loopRate）
    if (!(this.act && this.act.charging && !this.act.charge.clip)) this.animT += dt * spd;
    // ---- 物理 ----
    const inAir = this.z > 0 || this.vz > 0;
    if (inAir) {
      let g = GRAV;
      if (this.st === 'air') g *= airGravity(this);
      else if (this.act && this.act.lowGrav) g *= this.act.lowGrav;
      this.vz -= g * dt; this.z += this.vz * dt;
      if (this.z <= 0) { this.z = 0; this.land(); }
    }
    this.x += this.vx * dt; this.y += this.vy * dt;
    // 地面摩擦：硬直/倒地/动作结束后滑行减速
    if (this.z <= 0) {
      let moving = this.st === 'walk' || this.st === 'run';
      if (!moving && this.act && this.act.move) for (const m of this.act.move) if (this.actT >= m[0] && this.actT < m[1]) { moving = true; break; }
      if (!moving) { const fr = this.st === 'hit' || this.st === 'down' ? 6 : this.st === 'act' ? 10 : 14; const k = Math.exp(-fr * dt); this.vx *= k; this.vy *= k; }
    } else if (this.st === 'air') this.vx *= Math.exp(-0.8 * dt);
    const R = game.room;
    if (R) { this.x = clamp(this.x, R.x0 + this.w, R.x1 - this.w); }
    this.y = clamp(this.y, 4, DEPTH - 4);
    if (this.grabbed) holdGrabbed(this);
    // ---- 受击状态计时 ----
    if (this.st === 'hit') { this.stun -= dt; if (this.stun <= 0) { this.setState('idle'); this.hitHeavy = false; } }
    else if (this.st === 'down') { if (this.stT > (this.downTime || 0.8)) this.startGetup(); }
    else if (this.st === 'getup') { if (this.stT > (this.getupDur || 0.4)) { this.setState('idle'); this.tech = false; this.downHits = 0; this.juggle = 0; } }
    if (this.st === 'dead') this.deadT = (this.deadT || 0) + dt;
    // 连击统计：可行动一段时间后清零（浮空 / 倒地保护重新计算）
    if (this.free || this.st === 'act') { this.freeT += dt; if (this.freeT > COMBAT.protReset && (this.cmb.hits || this.cmb.dmg)) resetCmb(this); } else this.freeT = 0;
    // 浮空姿态：上升时向后仰，下落时趋于水平
    if (this.st === 'air' && !this.dead) this.rot = damp(this.rot, clamp(-this.vz / 900, -0.45, 0.35), 12, dt);
    else if (this.rot) this.rot = Math.abs(this.rot) < 0.01 ? 0 : damp(this.rot, 0, 18, dt);
    // ---- 动画 ----
    this.animate(dt);
  }
  land() {
    const imp = -this.vz;
    if (this.st === 'air') {
      // 落地反弹一次（重击砸地 bounceNext 会弹得更高）
      if (this.recoverLand && !this.dead) { this.recoverLand = false; this.vz = 0; this.bouncing = false; this.startGetup(true); return; }   // 决斗浮空保护：强制受身落地
      if (!this.dead && ((!this.bounced && imp > JUGGLE.bounceImp) || this.bounceNext)) {
        const forced = this.bounceNext || 0; this.bounced = true; this.bounceNext = 0; this.vz = forced ? Math.max(imp * forced, 260) : imp * JUGGLE.bounceK; this.z = 0.01;
        fxDust(this.x, this.y, 5, 14); sfx.thud(0.6); this.cmb.bounce = (this.cmb.bounce || 0) + 1; this.bouncing = true; this.play(this.clipOr('bounceUp', 'air'), true); return;
      }
      this.vz = 0; this.bouncing = false; this.setState('down'); this.downTime = this.dead ? 99 : downTimeOf(this); fxDust(this.x, this.y, 6, 18); sfx.thud(0.8);
      this.play(this.clipOr('down'), true);
      return;
    }
    this.vz = 0;
    if (this.st === 'act' && this.act && this.act.onLand) { this.act.onLand(this); return; }
    if (this.st === 'act' && this.act && this.act.airOnly) this.endAct();
    if (this.st === 'jump') { this.setState('idle'); this.play('land', true); this.landT = 0.1; this.airAtk = 0; fxDust(this.x, this.y, 3, 8); }
  }
  startGetup(tech) {
    this.setState('getup'); this.tech = !!tech; this.play(this.clipOr(tech ? 'tech' : 'getup', 'getup'), true);
    this.getupDur = tech ? 0.34 : 0.4; this.bounced = false; this.rot = 0;
    this.invul = Math.max(this.invul, getupInvulOf(this, tech));
  }
  animate(dt) {
    let clip = this.clipName;
    const s = this.st;
    if (s === 'idle') clip = this.landT > 0 ? 'land' : 'idle';
    else if (s === 'walk') clip = 'walk';
    else if (s === 'run') clip = 'run';
    else if (s === 'jump') clip = this.vz > 60 ? 'jumpUp' : 'jumpFall';
    else if (s === 'hit') clip = this.hitHeavy ? this.clipOr('hit2', 'hit') : 'hit';
    else if (s === 'air') clip = this.bouncing ? this.clipOr('bounceUp', 'air') : this.vz > 80 ? this.clipOr('airUp', 'air') : this.clipOr('air');
    else if (s === 'down' || (s === 'dead' && this.z <= 0)) clip = this.clipOr('down');
    else if (s === 'dead') clip = 'air';
    else if (s === 'held') clip = this.heldClip && this.clips[this.heldClip] ? this.heldClip : this.clipOr('held', 'hit2', 'hit');
    else if (s === 'getup') clip = this.clipName;
    if (this.landT > 0) this.landT -= dt;
    if (clip !== this.clipName) this.play(clip);
    const c = this.clips[this.clipName] || this.clips.idle;
    samplePose(c, this.animT, this.pose);
  }
  // 先画进离屏精灵，再整体合成：受击闪白、霸体红描边只需处理一次（逐部件加滤镜又慢又会把内部线条也描红）
  draw(c) {
    const sc = this.scale || 1, X = sx(this.x), Y = sy(this.y, this.z);
    const shk = this.hitstop > 0 && this.st !== 'act' ? (Math.floor(game.t * 60) % 2 ? 1.5 : -1.5) : 0;
    let a = 1;
    if (this.st === 'dead' && this.z <= 0) a = clamp(1 - (this.deadT - 0.5) / 0.6, 0, 1);
    if (this.invul > 0 && this.fighter && this.st !== 'getup' && this.st !== 'act' && Math.floor(game.t * 20) % 2) a *= 0.55;
    if (a <= 0) return;
    const sa = !this.dead && hasSA(this);
    const fsx = this.face * (this.drawFlip ? -1 : 1) * sc;
    this.pose.__f = fsx < 0 ? -1 : 1;   // 给精灵模型的换帧缓动用：转身时清掉偏移（models/imgmodel.js）
    const rot = this.rot, cy = -this.h * 0.42;
    const body = (x) => { if (rot) { x.translate(0, cy); x.rotate(rot); x.translate(0, -cy); } this.model.draw(x, this.pose, game.t + this.id, this.drawOpts || NO_OPTS); };
    if (!sa && !(this.flash > 0)) {   // 普通情况：直接画到世界层
      c.save(); c.globalAlpha = a; c.translate(X + shk, Y); c.scale(fsx, sc);
      body(c);
      c.restore(); return;
    }
    const col = this.flash > 0 ? '#ffffff' : (Math.floor(game.t * 8) % 2 ? '#ff2020' : '#ff6a3a');
    // 精灵帧模型（怪物）：直接画到世界层——霸体描边 = 4 个偏移的纯色剪影、闪白 = 再叠一层白色剪影（剪影按帧图缓存，models/imgmodel.js sprSil）。
    // 不走下面的离屏合成：那条路每只怪要在 3 张画布之间来回拷贝，大范围技能同时打中一屋子怪时占了世界层绘制的一半（docs/PERF.md）
    if (this.model instanceof SpriteModel && !this.model.av) {
      const M = this.model, t = game.t + this.id, sil = { sil: col };
      const put = (ox, oy, o) => { c.save(); c.translate(X + shk + ox, Y + oy); c.scale(fsx, sc); if (rot) { c.translate(0, cy); c.rotate(rot); c.translate(0, -cy); } M.draw(c, this.pose, t, o); c.restore(); };
      c.globalAlpha = a;
      if (sa) for (const [ox, oy] of SA_OFF) put(ox / RS, oy / RS, sil);
      put(0, 0, this.drawOpts || NO_OPTS);
      if (this.flash > 0) { c.globalAlpha = a * 0.7; put(0, 0, sil); }
      c.globalAlpha = 1; return;
    }
    // 受击闪白 / 霸体红描边：先画进离屏精灵再整体着色合成
    const S = spriteBuf;
    S.x.setTransform(RS, 0, 0, RS, 0, 0); S.x.clearRect(0, 0, S.w, S.h);
    S.x.translate(S.ox, S.oy); S.x.scale(fsx, sc);
    body(S.x);
    const dx = X - S.ox + shk, dy = Y - S.oy;
    const T = tintBuf; T.x.globalCompositeOperation = 'copy'; T.x.drawImage(S.cv, 0, 0); T.x.globalCompositeOperation = 'source-in';
    T.x.fillStyle = col; T.x.fillRect(0, 0, S.cv.width, S.cv.height); T.x.globalCompositeOperation = 'source-over';
    const C = compBuf; C.x.clearRect(0, 0, S.cv.width, S.cv.height);
    if (sa) for (const [ox, oy] of SA_OFF) C.x.drawImage(T.cv, ox, oy);
    C.x.drawImage(S.cv, 0, 0);
    if (this.flash > 0) { C.x.globalAlpha = 0.7; C.x.drawImage(T.cv, 0, 0); C.x.globalAlpha = 1; }
    c.globalAlpha = a; c.drawImage(C.cv, dx, dy, S.w, S.h); c.globalAlpha = 1;
  }
  drawShadow(c) {
    const X = sx(this.x), Y = sy(this.y, 0), k = 1 / (1 + this.z / 120);
    c.fillStyle = `rgba(0,0,0,${0.35 * k})`; c.beginPath(); c.ellipse(X, Y, this.shadowR * k, this.shadowR * 0.32 * k, 0, 0, TAU); c.fill();
  }
}
const SA_OFF = [[2, 0], [-2, 0], [0, 2], [0, -2]];
const NO_OPTS = {};
const spriteBuf = (() => { const [cv, x] = offCanvas(360 * RS, 340 * RS); return { cv, x, w: 360, h: 340, ox: 180, oy: 270 }; })();
const tintBuf = (() => { const [cv, x] = offCanvas(360 * RS, 340 * RS); return { cv, x }; })();
const compBuf = (() => { const [cv, x] = offCanvas(360 * RS, 340 * RS); return { cv, x }; })();
