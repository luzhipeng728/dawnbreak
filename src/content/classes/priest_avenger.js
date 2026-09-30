/* =====================================================================
   圣职者转职：复仇者（`avenger`，技能前缀 pa_，P-avenger；逐技能对照 docs/skills/priest_avenger_final.md，规格 docs/skills/priest.json 的 pa_ 段）
   官方口径：KR 现版（namu 어벤저/스킬 2025-10、国服三觉专题 dnf.qq.com a20200922priestman、2023-01 黑暗之触复刻 / 黑暗权能重做）
   - 恶魔能量（上限 400，进地下城 / 复活自带 200，决斗场从 0 开始，不会自己掉）：普攻命中 +4（魔化 +10）、技能施放按固定值回；恶魔之力 / 堕落之魂 / 审判 / 追加段消耗
   - 恶魔之力：复仇者技能动画中按 Z / X / C 各放一次恶魔残影（耗 30 能量；Z 重击打飞、X 快斩可连按、C 挑空）；普攻换成复仇者 4 段（2 拳 + 2 镰）
   - 半魔化：能量 ≥ 200 时变成黑色剪影、普攻 / 恶魔之力强化、能量持续流失，归零解除（期间各种追加消耗为 0）
   - 魔化：末日审判者（一觉觉醒技）= 变身 50 秒：体型变大、黑色恶魔之躯 + 恶魔翼 / 角 + 紫黑火焰（运行时画，art/final/fx/pa_*），全程霸体、不能被抓；
     技能栏不变，每个转职技能自动换成恶魔版（伤害 / 冷却 / 特效按官方改），空斩打键 → 恶魔之爪，另有审判 / 恶魔屏障；
     化魔（高痛之喜）第一次手动放后每 8 秒自动施放：能量 +、魔化持续 +7.3 秒、魔化冷却 −21 秒 → 实际上常驻；冷却好了再按魔化 = 周身伤害 + 时间重置，冷却中再按 = 解除；
     魔化中 HP 归零 → 恶之再临（变回人形、回复 30% HP / MP，冷却 145 秒）
   觉醒：一觉 末日审判者（魔化：末日审判者）→ 二觉 永生者（永堕：混沌弑神）→ 三觉 神启·复仇者（末日福音：毁灭之翼）
   本文件：常量 / 能量 / HUD / 魔化的外观 / 普攻 / 恶魔之力 / 钩子 / 被动 / Lv15~20 的技能；魔化、觉醒、Lv21 以后的技能、化魔改写、组队同步、登记在 priest_avenger_p1.js
   ===================================================================== */
const PA = 'avenger';
const paOn = p => !!p && jobOf(p) === PA;
const PA_COL = { dark: '#8a4ad8', deep: '#3a1a5a', blood: '#d02a4a', claw: '#b05aff', light: '#fff4d0', pink: '#ff6ad8', eye: '#ff2a3a', flame: '#7a3ad8' };
const PA_EMAX = 400, PA_SCALE = 1.22;
const paDemon = p => !!(p && p.buffs && p.buffs.pa_demon);
const paHalf = p => !!(p && p.buffs && p.buffs.pa_half);
const paTl = (tl, fb) => typeof SPR_DATA !== 'undefined' && SPR_DATA.priest && SPR_DATA.priest.frames && SPR_DATA.priest.frames[tl[0][0]] ? tl : fb;

/* ---- 恶魔能量 ---- */
function paE(p) { if (p._paE === undefined) p._paE = game.pvp ? 0 : PA_EMAX / 2; return p._paE; }
// 获得：恶魔唤醒每次额外 +3 以上；半魔化中只有化魔 / 不朽战吼 / 混沌弑神能回能量（src = 'keep'）
function paGain(p, v, src) {
  if (!paOn(p) || !(v > 0) || !skLv(p, 'pa_devil')) return;
  if (paHalf(p) && src !== 'keep') return;
  const n = skLv(p, 'pa_nightmare'); p._paE = clamp(paE(p) + v + (n ? 3 + (3 + n) / 9 : 0), 0, PA_EMAX);
}
// 消耗：半魔化中不耗；不够返回 false
function paSpend(p, v) { if (paHalf(p)) return true; if (paE(p) < v) return false; p._paE -= v; return true; }
// 技能施放时回的能量（多段技能也只算一次）
const PA_GAIN = { pa_render: 15, pa_mine: 30, pa_cutter: 20, pa_thorn: 40, pa_wheel: 25, pa_reaper: 30, pa_gate: 40, pa_disaster: 45 };
// 魔化后：[伤害倍率, 冷却倍率]（官方恶魔版的改动）
const PA_DEMON = { pa_render: [2.25, 1.6], pa_mine: [1.6, 1.55], pa_cutter: [1.9, 1.5], pa_thorn: [2, 1.6], pa_wheel: [2.34, 1.5], pa_fist: [1.34, 1], pa_reaper: [1.35, 1], pa_authority: [1.35, 1],
  pa_gate: [1.5, 1], pa_disaster: [1.35, 1], pa_howl: [1.17, 1], pa_smite: [1.35, 1], pa_awaken2: [1.35, 1], pa_stream: [1.3, 1], pa_awaken3: [1.4, 1], p_grab: [2.24, 1.6] };
const paDmg = (p, id) => paDemon(p) && PA_DEMON[id] ? PA_DEMON[id][0] : 1;
bus.on('dungeonEnter', () => { const p = game.player; if (p && paOn(p)) p._paE = PA_EMAX / 2; });

/* ---- 矢量占位模型的片段 / 精灵帧（P-art 的 pa_ 帧，没出之前用通用帧）---- */
Object.assign(CLIPS.priest, {
  paSlash: HUMAN_CLIPS.atk2, paSlash2: HUMAN_CLIPS.atk3, paGrab: CLIPS.priest.grab, paStab: HUMAN_CLIPS.dash, paRoar: CLIPS.priest.rapture,
  paHunch: CLIPS.priest.rapture, paExecute: CLIPS.priest.throw, paDive: HUMAN_CLIPS.jatk, paCast: CLIPS.priest.cast,
});
const PA_ANIMS = {
  paSlash: paTl([['pa_slash1', 0], ['pa_slash2', 0.08]], [['idle', 0]]), paSlash2: paTl([['pa_slash1', 0], ['pa_slash2', 0.12]], [['idle', 0]]),
  paGrab: paTl([['pa_grab', 0]], [['idle', 0]]), paStab: paTl([['pa_stab', 0]], [['run3', 0]]), paRoar: paTl([['pa_roar', 0]], [['charge', 0]]),
  paHunch: paTl([['pa_hunch', 0]], [['charge', 0]]), paExecute: paTl([['pa_execute', 0]], [['idle', 0]]), paDive: paTl([['pa_dive', 0]], [['jump3', 0]]),
  paCast: paTl([['pa_grab', 0]], [['charge', 0]]),
};

/* ---- 特效构件 ---- */
// 三道爪痕（魔化的爪击 / 半魔化的攻击都带爪痕）
function paClawFx(x, y, z, face, s = 1, col = PA_COL.claw) {
  addFx({ x, y: y + 1, z, dur: 0.28, face, draw(c) { const k = this.t / this.dur, X = sx(this.x), Y = sy(this.y, this.z), a = 1 - k * k, L = 70 * s * (0.6 + 0.6 * easeOut(Math.min(1, k * 3)));
    c.save(); c.globalCompositeOperation = 'lighter'; c.lineCap = 'round';
    for (let i = -1; i <= 1; i++) for (const [w, cc, al] of [[9 * s, col, 0.45], [3 * s, '#ffe0ff', 1]]) { c.strokeStyle = cc; c.globalAlpha = a * al; c.lineWidth = w; c.beginPath();
      c.moveTo(X - this.face * L * 0.5 + i * 12 * s, Y - L * 0.55 + i * 6 * s); c.quadraticCurveTo(X + this.face * 6, Y + i * 10 * s, X + this.face * L * 0.5 + i * 12 * s, Y + L * 0.5 + i * 6 * s); c.stroke(); }
    c.restore(); } });
}
// 紫黑色的爆炸（暗属性的爆点：暗球 + 爆闪，都按紫色染）
function paBoom(x, y, z, w) { fxSpr('darkorb', x, y, z, { w: w * 0.9, dur: 0.45, col: '#8a2ad8', grow: [0.3, 1.2] }); fxBurst(x, y, z, w, '#c060ff'); }
// 复仇之刺的暗黑尖刺：从脚下向外放射的黑色尖刺（前方长、身后短），紫色描边，长出来 → 停一下 → 缩回
function paThorns(e, s = 1) {
  const L = []; for (let i = 0; i < 16; i++) { const back = i >= 11, ang = back ? Math.PI + (i - 13) * 0.32 : (i - 5) * 0.16, len = (back ? 100 : 150 + (i % 3) * 45) * s * rnd(0.85, 1.1); L.push([ang, len, rnd(9, 15) * s]); }
  addFx({ x: e.x, y: e.y + 1.2, z: 0, dur: 0.5, f: e.face, draw(c) { const k = this.t / this.dur, g = k < 0.2 ? easeOut(k / 0.2) : k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1, X = sx(this.x), Y = sy(this.y, 0);
    c.save(); for (const [ang, len, w] of L) { const dx = Math.cos(ang) * this.f, dy = Math.sin(ang) * GR, tx = X + dx * len * g, ty = Y + dy * len * g - len * 0.55 * g, nx = -dy, ny = dx;
      c.beginPath(); c.moveTo(X + nx * w, Y + ny * w * 0.4); c.lineTo(tx, ty); c.lineTo(X - nx * w, Y - ny * w * 0.4); c.closePath();
      c.fillStyle = 'rgba(26,8,40,0.95)'; c.fill(); c.strokeStyle = 'rgba(190,110,255,0.9)'; c.lineWidth = 2; c.stroke(); }
    c.restore(); } });
}
// 紫黑火焰一小团（魔化脚下 / 地面）
function paFlame(c, x, y, h, i, a = 1) { c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = a; jlCell(c, 'jv_flame', PA_COL.flame, i, x, y, h, 1.1); c.globalAlpha = a * 0.6; jlCell(c, 'jv_flame', '#d060ff', i + 1, x, y, h * 0.6, 0.9); c.restore(); }
// 一张素材：生图的 fx/pa_*；没有就用现成素材顶上
function paImg(name) { return IMG['fx/' + name] || (name === 'pa_demon' ? fxTint('bz_demon', '#6a2ab8') : name === 'pa_wings' ? fxTint('darkorb', '#6a2ab8') : null); }
// 整个人的暗色剪影（魔化 = 黑色恶魔之躯；半魔化 = 全黑剪影）：把当前姿势画进离屏画布再染色，叠在人物身上
const PA_SHADE = { cv: null, W: 300, H: 320, FY: 290 };
function paShade(c, E, col, alpha) {
  const S = PA_SHADE; if (!S.cv) { S.cv = document.createElement('canvas'); S.cv.width = S.W; S.cv.height = S.H; }
  if (!E.model || !E.pose || E.hidden) return;
  const g = S.cv.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; g.clearRect(0, 0, S.W, S.H);
  g.translate(S.W / 2, S.FY); g.scale(E.face * (E.drawFlip ? -1 : 1), 1); if (E.rot) { g.translate(0, -E.h * 0.42); g.rotate(E.rot); g.translate(0, E.h * 0.42); }
  try { E.model.draw(g, E.pose, game.t + E.id, E.drawOpts || {}); } catch (e) { return; }
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-atop'; g.fillStyle = col; g.fillRect(0, 0, S.W, S.H); g.globalCompositeOperation = 'source-over';
  const sc = E.scale || 1; c.save(); c.globalAlpha = alpha; c.drawImage(S.cv, sx(E.x) - S.W / 2 * sc, sy(E.y, E.z) - S.FY * sc, S.W * sc, S.H * sc); c.restore();
}
// 魔化的外观（跟着人画，BUFF 没了自己结束；换房间清掉特效后由被动 / 组队同步补回来）：
//   身后 = 巨大的末日审判者虚影 + 展开的恶魔翼 + 脚下旋转的紫色魔法阵；身前 = 黑色恶魔之躯（染色剪影）、恶魔角、红眼、胸口的十字疤、脚边紫黑火焰、往上飘的暗色火星
function paDemonFx(p) {
  if (p._paDemonFx && fxList.includes(p._paDemonFx[0])) return;
  const alive = f => { const E = f.ent; if (!E.buffs || !E.buffs.pa_demon || E.dead || E.remove) { f.dur = f.t; return false; } f.x = E.x; return true; };
  const back = addFx({ ent: p, x: p.x, y: p.y - 0.6, z: 0, dur: 1e6, update() { if (alive(this)) this.y = this.ent.y - 0.6; },
    draw(c) { const E = this.ent; if (E.hidden) return; const t = this.t, sc = E.scale || 1, X = sx(E.x), Yf = sy(E.y, E.z), a = Math.min(1, t / 0.4);
      c.save(); c.globalAlpha = a * 0.7; drawSpr(c, fxTint('rune', '#9a4ae8'), X, sy(E.y, 0), 170 * sc, 60 * sc, { ground: true, rot: t * 0.8 }); c.restore();
      const dem = paImg('pa_demon'); if (dem) { c.save(); c.globalAlpha = a * (0.28 + 0.06 * Math.sin(t * 3)); drawSpr(c, dem, X - E.face * 18 * sc, Yf + 6, 0, 210 * sc * (1 + 0.02 * Math.sin(t * 2.2)), { add: false, flip: E.face < 0, ay: 1 }); c.restore(); }
      const W = paImg('pa_wings'); if (W) { const flap = 1 + 0.08 * Math.sin(t * 5); c.save(); c.globalAlpha = a; drawSpr(c, W, X - E.face * 10 * sc, Yf - 78 * sc, 190 * sc * flap, 150 * sc, { add: false, ay: 0.55 }); c.restore(); }
      for (let i = 0; i < 4; i++) paFlame(c, X + (i - 1.5) * 14 * sc, sy(E.y, E.z) + 4, (40 + 10 * Math.sin(t * 9 + i)) * sc, i + Math.floor(t * 14), a * 0.85); } });
  const front = addFx({ ent: p, x: p.x, y: p.y + 0.02, z: 0, dur: 1e6, emb: [], update(dt) { if (!alive(this)) return; const E = this.ent; this.y = E.y + 0.02;
      if (Math.random() < 0.5) this.emb.push({ x: E.x + rnd(-22, 22), z: E.z + rnd(10, 90), vz: rnd(40, 110), life: rnd(0.4, 0.9), t: 0 });
      for (const m of this.emb) { m.t += dt || 1 / 60; m.z += m.vz * (dt || 1 / 60); } this.emb = this.emb.filter(m => m.t < m.life); },
    draw(c) { const E = this.ent; if (E.hidden) return; const t = this.t, sc = E.scale || 1, a = Math.min(1, t / 0.4), X = sx(E.x);
      paShade(c, E, 'rgba(34,10,52,0.62)', a);
      const up = E.st !== 'air' && E.st !== 'down', hz = E.z + 104 * sc;
      if (up) { const H = paImg('pa_horns'); if (H) drawSpr(c, H, X + E.face * 3 * sc, sy(E.y, hz), 54 * sc, 0, { add: false, ay: 0.85 });
        c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = a * (0.8 + 0.2 * Math.sin(t * 10)); drawSpr(c, fxTint('orb', PA_COL.eye), X + E.face * 12 * sc, sy(E.y, E.z + 92 * sc), 16 * sc, 0, {});
        drawSpr(c, fxTint('crossx', '#ffe0e0'), X + E.face * 6 * sc, sy(E.y, E.z + 62 * sc), 22 * sc, 0, { alpha: 0.5 + 0.3 * Math.sin(t * 4) }); c.restore(); }
      c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = '#c070ff'; for (const m of this.emb) { c.globalAlpha = 0.9 * (1 - m.t / m.life); c.fillRect(sx(m.x) - 1.5, sy(E.y, m.z) - 1.5, 3, 3); } c.restore(); } });
  p._paDemonFx = [back, front];
}
// 半魔化：全黑剪影 + 红眼 + 身上冒黑雾（巨兵不见了，攻击带爪痕）
function paHalfFx(p) {
  if (p._paHalfFx && fxList.includes(p._paHalfFx)) return;
  p._paHalfFx = addFx({ ent: p, x: p.x, y: p.y + 0.02, z: 0, dur: 1e6, update() { const E = this.ent; if (!E.buffs || !E.buffs.pa_half || E.dead || E.remove) { this.dur = this.t; return; } this.x = E.x; this.y = E.y + 0.02; },
    draw(c) { const E = this.ent; if (E.hidden) return; const t = this.t, X = sx(E.x); paShade(c, E, 'rgba(8,4,14,0.9)', Math.min(1, t / 0.3));
      c.save(); c.globalCompositeOperation = 'lighter'; drawSpr(c, fxTint('orb', PA_COL.eye), X + E.face * 12, sy(E.y, E.z + 92), 13, 0, {});
      c.globalAlpha = 0.5; jlCell(c, 'jv_wisp', '#5a2a8a', Math.floor(t * 8), X - E.face * 8, sy(E.y, E.z) - 20, 60, 1); c.restore(); } });
}
// 魔化的吼声（低沉的嘶吼 + 噪声爆裂 + 低频轰鸣；没有录音素材，用合成器拼）
function paRoarSfx(k = 1) {
  if (!sfx.ok) return;
  sfx.tone('sawtooth', 160, 55, 1.2 * k, 0.24, { attack: 0.03 }); sfx.tone('square', 80, 38, 1.3 * k, 0.12, { attack: 0.03 }); sfx.tone('sawtooth', 240, 110, 0.9 * k, 0.08, { attack: 0.05 });
  sfx.noise('lowpass', 1200, 240, 1.2 * k, 0.32, 0.9); sfx.boom(1.3);
}

/* ---- HUD：恶魔能量条（MP 球上方；触屏画在左上 BUFF 下面）；魔化中显示剩余时间 ---- */
function paHudHook() {
  if (paHudHook.on || typeof ui === 'undefined' || !ui || !ui.drawPanel) return; paHudHook.on = true;
  const d0 = ui.drawPanel;
  ui.drawPanel = function (c) { d0.call(this, c); try { paDrawGauge(c); } catch (e) { console.error('恶魔能量条', e); } };
}
function paDrawGauge(c) {
  const p = game.player; if (!paOn(p) || !skLv(p, 'pa_devil')) return;
  const touchOn = typeof touch !== 'undefined' && touch.on, w = touchOn ? 400 : 200, h = 14;
  const x = touchOn ? (touch.hudX || 30) + 110 : HUD.mp.x - w / 2, y = touchOn ? 172 : HUD.y0 - 40;
  const e = paE(p), f = e / PA_EMAX, D = p.buffs.pa_demon, H = p.buffs.pa_half;
  c.fillStyle = 'rgba(10,6,14,.85)'; c.fillRect(x - 3, y - 3, w + 6, h + 6);
  const g = c.createLinearGradient(x, 0, x + w, 0); g.addColorStop(0, '#3a1060'); g.addColorStop(1, H ? '#101010' : '#c060ff');
  c.fillStyle = g; c.fillRect(x, y, w * clamp(f, 0, 1), h);
  c.fillStyle = 'rgba(255,255,255,.55)'; c.fillRect(x + w * 0.5 - 1, y - 2, 2, h + 4);   // 200：半魔化的门槛
  if (D) { c.strokeStyle = `rgba(255,90,200,${0.6 + 0.4 * Math.sin(game.t * 8)})`; c.lineWidth = 2.5; c.strokeRect(x - 1.5, y - 1.5, w + 3, h + 3);
    const k = clamp(D.t / 50, 0, 1); c.fillStyle = 'rgba(255,60,120,.85)'; c.fillRect(x, y + h + 4, w * k, 4); }
  uiText(D ? `魔化 ${Math.ceil(D.t)}s · 恶魔 ${Math.floor(e)}` : `${H ? '半魔化 · ' : ''}恶魔 ${Math.floor(e)}/${PA_EMAX}`, x + w / 2, y - 5, { size: 15, align: 'center', color: D ? '#ffa0e0' : H ? '#d0d0d0' : '#e0b0ff', sw: 3 });
}

/* ---- 普攻：人形（恶魔之力：2 拳 + 2 镰，第 3、4 段有最下段 / 对空判定，身后也打得到）/ 半魔化 / 魔化（爪 4 段 × 2 下，范围很大）---- */
const paGainHit = v => (a, t) => { if (a.fighter) paGain(a, v); };
const PA_ACTS_HUMAN = {
  atk1: { name: 'atk1', clip: 'jab', dur: 0.32, basic: true, speed: 'aspd', type: 'mag', chain: [0.12, 0.32], next: 'atk2', move: [[0.02, 0.08, 80]],
    hits: [HB(0.05, 0.11, [0, 105, 36, 30, 115], 0.8, { type: 'mag', stun: 0.3, knock: 30, hs: 0.05, snd: 'blunt', onHit: paGainHit(4) })], events: [evAt(0.04, e => pPunch(e, 70))] },
  atk2: { name: 'atk2', clip: 'straight', dur: 0.34, basic: true, speed: 'aspd', type: 'mag', chain: [0.13, 0.34], next: 'atk3', move: [[0.02, 0.08, 80]],
    hits: [HB(0.06, 0.12, [0, 110, 36, 30, 115], 0.9, { type: 'mag', stun: 0.32, knock: 40, hs: 0.05, snd: 'blunt', onHit: paGainHit(4) })], events: [evAt(0.05, e => pPunch(e, 90, true))] },
  atk3: { name: 'atk3', clip: 'paSlash', dur: 0.42, basic: true, speed: 'aspd', type: 'mag', chain: [0.18, 0.42], next: 'atk4', move: [[0.02, 0.1, 90]],
    hits: [HB(0.1, 0.18, [0, 145, 42, -10, 175], 1.2, { type: 'mag', launch: 380, knock: 20, hs: 0.06, downHit: true, snd: 'slash', col: '#d0a0ff', onHit: paGainHit(4) }),
      HB(0.1, 0.18, [-65, 0, 36, 0, 120], 0.4, { type: 'mag', stun: 0.3, knock: 40, hs: 0.04, snd: 'slash', col: '#d0a0ff' })],
    events: [slashAt(0.09, { a0: 1.4, a1: -1.8, r: 112, w: 22, off: [14, 50], col: PA_COL.dark, heavy: true })] },
  atk4: { name: 'atk4', clip: 'paSlash2', dur: 0.56, basic: true, speed: 'aspd', type: 'mag', move: [[0.04, 0.14, 110]],
    hits: [HB(0.16, 0.24, [0, 155, 44, -10, 175], 1.6, { type: 'mag', knock: 220, stun: 0.55, hs: 0.09, shake: 3, heavy: true, big: 1.3, downHit: true, snd: 'slash', col: '#d0a0ff', onHit: paGainHit(4) }),
      HB(0.16, 0.24, [-65, 0, 36, 0, 120], 0.5, { type: 'mag', stun: 0.35, knock: 60, hs: 0.05, snd: 'slash', col: '#d0a0ff' })],
    events: [slashAt(0.14, { a0: -2.6, a1: 1.2, r: 122, w: 26, off: [14, 60], col: PA_COL.dark, heavy: true })] },
  dash: { name: 'dash', clip: 'paStab', dur: 0.46, basic: true, speed: 'aspd', type: 'mag', move: [[0, 0.26, 400]], noCounter: true,
    hits: [HB(0.05, 0.26, [0, 135, 40, 10, 120], 1.3, { type: 'mag', stun: 0.6, knock: 80, hs: 0.07, shake: 2, snd: 'slash', col: '#d0a0ff', onHit: paGainHit(4) })],
    events: [evAt(0.03, e => { fxStreak({ x: e.x - e.face * 10, y: e.y, z: e.z + 58, face: e.face, len: 130, w: 14, col: PA_COL.dark, dur: 0.2 }); sfx.swing(true); })] },
  jatk: { name: 'jatk', clip: 'paDive', dur: 0.36, basic: true, speed: 'aspd', type: 'mag', airOnly: true, lowGrav: 0.75,
    hits: [HB(0.07, 0.18, [0, 120, 40, -40, 90], 1.0, { type: 'mag', stun: 0.34, knock: 40, airLift: 150, hs: 0.05, snd: 'slash', col: '#d0a0ff', onHit: paGainHit(4) })],
    events: [slashAt(0.06, { a0: -1.7, a1: 1.4, r: 104, w: 20, off: [10, 40], col: PA_COL.dark })] },
};
// 半魔化：1、2 段一下两记勾拳（各半伤），3 段上勾，4 段下砸；跳攻可以连续
const paHook = (t0, dmg, o = {}) => HB(t0, t0 + 0.05, [0, 115, 40, 20, 125], dmg, { type: 'mag', stun: 0.32, knock: 30, hs: 0.04, snd: 'blunt', col: '#c080ff', ...o });
const PA_ACTS_HALF = { ...PA_ACTS_HUMAN,
  atk1: { name: 'atk1', clip: 'jab', dur: 0.34, basic: true, speed: 'aspd', type: 'mag', chain: [0.14, 0.34], next: 'atk2', move: [[0.02, 0.08, 90]], hits: [paHook(0.04, 0.45), paHook(0.12, 0.45)],
    events: [evAt(0.04, e => paClawFx(e.x + e.face * 70, e.y, e.z + 70, e.face, 0.7)), evAt(0.12, e => paClawFx(e.x + e.face * 80, e.y, e.z + 60, e.face, 0.7))] },
  atk2: { name: 'atk2', clip: 'straight', dur: 0.34, basic: true, speed: 'aspd', type: 'mag', chain: [0.14, 0.34], next: 'atk3', move: [[0.02, 0.08, 90]], hits: [paHook(0.04, 0.5), paHook(0.12, 0.5)],
    events: [evAt(0.04, e => paClawFx(e.x + e.face * 70, e.y, e.z + 70, -e.face, 0.7)), evAt(0.12, e => paClawFx(e.x + e.face * 80, e.y, e.z + 60, e.face, 0.7))] },
  atk3: { name: 'atk3', clip: 'upper', dur: 0.4, basic: true, speed: 'aspd', type: 'mag', chain: [0.16, 0.4], next: 'atk4', move: [[0.02, 0.08, 90]], hits: [paHook(0.07, 1.3, { launch: 480, box: [0, 125, 42, 0, 160] })],
    events: [evAt(0.07, e => paClawFx(e.x + e.face * 70, e.y, e.z + 80, e.face, 1))] },
  atk4: { name: 'atk4', clip: 'paSlash2', dur: 0.52, basic: true, speed: 'aspd', type: 'mag', move: [[0.04, 0.12, 110]], hits: [paHook(0.14, 1.8, { down: true, knock: 160, hs: 0.09, big: 1.4, box: [0, 135, 44, -10, 170] })],
    events: [evAt(0.14, e => { paClawFx(e.x + e.face * 80, e.y, e.z + 60, e.face, 1.3); fxShock(e.x + e.face * 80, e.y, 140, PA_COL.dark); })] },
  jatk: { ...PA_ACTS_HUMAN.jatk, clip: 'paDive', hits: [paHook(0.06, 1.0, { box: [0, 115, 40, -40, 90], airLift: 150 })], events: [evAt(0.06, e => paClawFx(e.x + e.face * 60, e.y, e.z + 40, e.face, 0.8))] },
};
// 魔化：爪 → 爪 → 上挑 → 下劈，每段 2 下（1 : 1.5 : 3.13 : 3.44），1、2 段让敌人浮空、3 段打飞；跑攻 = 恶魔脸气劲的长距离冲撞（多段）；跳攻 = 高速下落爪劈
const paDClaw = (t0, dmg, o = {}) => HB(t0, t0 + 0.05, [0, 190, 62, -10, 210], dmg, { type: 'mag', stun: 0.4, knock: 30, hs: 0.05, downHit: true, snd: 'slash', col: '#e0a0ff', onHit: paGainHit(10), ...o });
const paDFx = (t, s, flip, dz = 70) => evAt(t, e => { paClawFx(e.x + e.face * 95, e.y, e.z + dz, flip ? -e.face : e.face, s); sfx.swing(s > 1.2); });
const PA_ACTS_DEMON = {
  atk1: { name: 'atk1', clip: 'paSlash', dur: 0.4, basic: true, speed: 'aspd', type: 'mag', chain: [0.16, 0.4], next: 'atk2', move: [[0.02, 0.1, 160]],
    hits: [paDClaw(0.06, 0.5, { airLift: 120 }), paDClaw(0.14, 0.5, { airLift: 120 })], events: [paDFx(0.06, 1.2), paDFx(0.14, 1.2, true)] },
  atk2: { name: 'atk2', clip: 'paSlash2', dur: 0.42, basic: true, speed: 'aspd', type: 'mag', chain: [0.17, 0.42], next: 'atk3',
    hits: [paDClaw(0.06, 0.75, { launch: 300 }), paDClaw(0.15, 0.75, { airLift: 160 })], events: [paDFx(0.06, 1.3), paDFx(0.15, 1.3, true)] },
  atk3: { name: 'atk3', clip: 'upper', dur: 0.48, basic: true, speed: 'aspd', type: 'mag', chain: [0.2, 0.48], next: 'atk4',
    hits: [paDClaw(0.08, 1.56, { launch: 420 }), paDClaw(0.17, 1.56, { knock: 420, launch: 360, big: 1.5 })], events: [paDFx(0.08, 1.5, false, 90), paDFx(0.17, 1.6, true, 90)] },
  atk4: { name: 'atk4', clip: 'paSlash2', dur: 0.6, basic: true, speed: 'aspd', type: 'mag',
    hits: [paDClaw(0.12, 1.72, { stun: 0.6 }), paDClaw(0.22, 1.72, { down: true, knock: 140, hs: 0.1, shake: 4, big: 1.7 })],
    events: [paDFx(0.12, 1.6), evAt(0.22, e => { paClawFx(e.x + e.face * 100, e.y, e.z + 50, e.face, 1.9); fxShock(e.x + e.face * 100, e.y, 220, PA_COL.dark); cam.shake = Math.max(cam.shake, 4); })] },
  dash: { name: 'dash', clip: 'paStab', dur: 0.62, basic: true, speed: 'aspd', type: 'mag', move: [[0, 0.44, 560]], noCounter: true,
    hits: [HB(0.04, 0.44, [0, 160, 56, 0, 190], 0.47, { type: 'mag', rep: 0.1, max: 4, stun: 0.5, knock: 90, hs: 0.04, snd: 'slash', col: '#e0a0ff', onHit: paGainHit(10) })],
    events: [evAt(0.02, e => { fxText('哈哈哈哈!', e.x, e.y, e.z + 120, { col: '#e0a0ff', size: 12, dur: 0.6 }); sfx.swing(true); }),
      evAt(0.04, e => addFx({ ent: e, x: e.x, y: e.y + 0.3, z: 0, dur: 0.42, draw(c) { const E = this.ent, k = this.t / this.dur; drawSpr(c, fxTint('ghost', PA_COL.dark), sx(E.x + E.face * 60), sy(E.y, E.z + 70), 140, 0, { flip: E.face < 0, alpha: 1 - k * k }); } }))] },
  jatk: { name: 'jatk', clip: 'paDive', dur: 0.6, basic: true, speed: 'aspd', type: 'mag', airOnly: true,
    onStart: e => { e.vz = Math.min(e.vz, -900); },
    hits: [HB(0.02, 0.6, [0, 150, 56, -60, 100], 4.0, { type: 'mag', max: 1, launch: 300, knock: 60, hs: 0.1, big: 1.8, downHit: true, snd: 'slash', col: '#e0a0ff', onHit: paGainHit(10) })],
    events: [evAt(0.02, e => paClawFx(e.x + e.face * 60, e.y, e.z + 30, e.face, 1.6))] },
};
PRIEST_ACT_PICK.push(p => !paOn(p) ? null : paDemon(p) ? { ...pActsOf(p), ...PA_ACTS_DEMON } : paHalf(p) ? { ...pActsOf(p), ...PA_ACTS_HALF } : skLv(p, 'pa_devil') ? { ...pActsOf(p), ...PA_ACTS_HUMAN } : null);

/* ---- 恶魔之力：复仇者技能动画中按 Z / X / C 放恶魔残影（耗 30 能量；半魔化不耗、更强）；普攻 / 地狱之门 / 末日浩劫 / 二三觉 / 魔化中不能用 ---- */
const PA_NODEVIL = new Set(['pa_gate', 'pa_disaster', 'pa_howl', 'pa_smite', 'pa_awaken2', 'pa_stream', 'pa_awaken3', 'pa_awaken', 'pa_execute', 'pa_meta', 'pa_fall']);
function paDevilInput(p, I) {
  if (!paOn(p) || !skLv(p, 'pa_devil') || paDemon(p) || p.st !== 'act' || !p.act || !p.act.skill || p.actT < 0.08) return false;
  const S = SKILLS[p.act.skill]; if (!S || S.job !== PA || PA_NODEVIL.has(p.act.skill)) return false;
  const k = I.buffered('attack') ? 'attack' : I.buffered('jump') ? 'jump' : I.buffered('cmd') && !I.dx() && !I.dy() ? 'cmd' : null; if (!k) return false;
  if ((p._paDevilT || 0) > game.t && k !== 'attack') return false;
  if (!paSpend(p, 30)) { fxText('恶魔能量不足', p.x, p.y, p.z + 100, { col: '#b0a0c0', size: 10, dur: 0.4 }); I.consume(k); return false; }
  I.consume(k); p._paDevilT = game.t + 0.5; paDevil(p, k === 'cmd' ? 'z' : k === 'attack' ? 'x' : 'c'); return false;
}
{ const pc0 = CLASSES.priest.preControl; CLASSES.priest.preControl = (p, I, dt) => (pc0 ? pc0(p, I, dt) : false) || paDevilInput(p, I); }
function paDevil(p, kind) {
  const lv = Math.max(1, skLv(p, 'pa_devil')), H = paHalf(p), evo = skLv(p, 'pa_evil') > 0, col = evo ? PA_COL.pink : PA_COL.dark, x = p.x + p.face * 50;
  const base = skillDmg(1.2, 0.12, lv) * (evo ? 1.1 + 0.015 * skLv(p, 'pa_evil') : 1);
  addFx({ x, y: p.y + 0.4, z: p.z, face: p.face, dur: 0.35, img: ghostSnap(p), col, draw(c) { const k = this.t / this.dur; c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.7 * (1 - k);
    c.drawImage(this.img, sx(this.x + this.face * 30 * k) - GHOST.W / 2, sy(this.y, this.z) - GHOST.FY); c.restore();
    drawSpr(c, fxTint('ghost', this.col), sx(this.x + this.face * 40), sy(this.y, this.z + 60), 110, 0, { flip: this.face < 0, alpha: 0.8 * (1 - k) }); } });
  const hit = (d, o) => instantHit(p, { box: [0, 185, 60, -10, 190], dmg: d, type: 'mag', hs: 0.05, downHit: true, sure: true, snd: 'slash', col: '#e0b0ff', ...o });
  if (kind === 'z') { paClawFx(x + p.face * 50, p.y, p.z + 70, p.face, 1.5, col); hit(base * (H ? 1.1 : 1), { knock: 520, launch: 220, big: 1.5, shake: 3 }); sfx.swing(true); }
  else if (kind === 'x') { const n = H ? 4 : 1; for (let i = 0; i < n; i++) game.after(0.05 * i, () => { paClawFx(x + p.face * 40, p.y, p.z + 60, i % 2 ? -p.face : p.face, 1, col); hit(base * (H ? 0.28 : 0.45), { stun: 0.4, knock: 20 }); }); sfx.swing(false); }
  else { const n = H ? 2 : 1; for (let i = 0; i < n; i++) game.after(0.06 * i, () => { paClawFx(x + p.face * 40, p.y, p.z + 90, p.face, 1.2, col); hit(base * (H ? 0.55 : 0.8), { launch: 560, knock: 20 }); }); sfx.swing(true); }
}

/* ---- 钩子：基础技能在复仇者下的改写 ---- */
// 恶魔之手：魔化中本人亲手去抓（攻 +124%、体积 +100%、冷却 +60%）
PRIEST_HOOKS.mod.push((p, id) => paOn(p) && paDemon(p) && id === 'p_grab' ? { dmg: 2.24, range: 2 } : null);
// 魔化中不能用的基础技能（官方：除后跳 / 恶魔之手 / 化魔以外的转职前技能都不能放；空斩打键换成恶魔之爪）
const PA_DEMON_BAN = new Set(['p_smasher', 'p_lucky', 'p_second', 'p_slowheal', 'p_cure', 'p_phoenix', 'p_emblem', 'p_purity']);
PRIEST_HOOKS.req.push((p, id) => paOn(p) && paDemon(p) && PA_DEMON_BAN.has(id) ? '魔化中不能用' : true);
// 施放：技能回能量、魔化版冷却加长、恶魔诅咒（幻听）BUFF
PRIEST_HOOKS.onCast.push((p, id, act, how) => {
  if (!paOn(p) || how === 'recast') return;
  const S = SKILLS[id]; if (!S) return;
  if (PA_GAIN[id]) paGain(p, PA_GAIN[id]);
  if (paDemon(p) && PA_DEMON[id] && PA_DEMON[id][1] !== 1 && p.cool[id] > 0) p.cool[id] *= PA_DEMON[id][1];
  const ec = skLv(p, 'pa_echo'); if (ec && S.job === PA && !S.passive) p.buffs.pa_echoB = { t: 30, mspd: 0.02 * ec, name: '幻听', col: '#9a6ad8' };
});
// 化魔：复仇者施放中也能用（没有施放动作，官方“可以在其他技能中施放”）
PRIEST_HOOKS.cancelHook.push((p, a, id) => paOn(p) && id === 'p_rapture' && !!a.skill);
// 恶之再临：魔化中受到致命伤害 → HP 留 1，再由 onHurt 变回人形回复 30%
PRIEST_HOOKS.beforeHurt.push(p => paOn(p) && paDemon(p) && skLv(p, 'pa_rebirth') && !(p.cool.pa_rebirth > 0) && !game.pvp ? { minHp: 1 } : null);
// 恶魔屏障：受到的伤害 −60%（BUFF 的 taken 字段已经算进 applyHit，这里只画格挡火花）
PRIEST_HOOKS.onHurt.push((p, a, h, dmg) => {
  if (!paOn(p)) return;
  if (p.buffs.pa_barrier) fxShock(p.x, p.y, 90, '#c080ff');
  if (paDemon(p) && p.hp <= 1 && skLv(p, 'pa_rebirth') && !(p.cool.pa_rebirth > 0) && !game.pvp) paRebirth(p);
});
function paRebirth(p) {
  p.cool.pa_rebirth = 145; paDemonEnd(p, '恶之再临');
  p.hp = Math.max(p.hp, Math.round(p.hpMax * 0.3)); p.mp = Math.max(p.mp, Math.round(p.mpMax * 0.3)); p.invul = Math.max(p.invul, 1.5);
  fxText('恶之再临', p.x, p.y, p.z + 110, { col: '#ffa0e0', size: 16, dur: 1.2 }); fxAura(p, '#fff0ff', 1.2); fxShock(p.x, p.y, 260, PA_COL.light); sfx.buff();
}
// 魔化结束（时间到 / 再按一次解除 / 恶之再临）：体型复原、普攻换回人形
function paDemonEnd(p, why) {
  if (!p.buffs.pa_demon) return; delete p.buffs.pa_demon; delete p.buffs.pa_barrier;
  p.scale = p._paScale0 || 1; p.noGrab = !!p._paNoGrab0; p.acts = priestActs(p);
  fxBurst(p.x, p.y, p.z + 60, 220, PA_COL.dark); fxShock(p.x, p.y, 200, PA_COL.dark); fxText(why || '魔化结束', p.x, p.y, p.z + 90, { col: '#d0b0e0', size: 12 });
}
// 半魔化结束（能量归零 / 再按一次）：冷却这时才开始转
function paHalfEnd(p, why) {
  if (!p.buffs.pa_half) return; delete p.buffs.pa_half; p.cool.pa_meta = SKILLS.pa_meta.cd * (p.cdMul || 1); p.acts = priestActs(p);
  fxBurst(p.x, p.y, p.z + 60, 160, '#3a2a4a'); fxText(why || '半魔化结束', p.x, p.y, p.z + 90, { col: '#b0a0c0', size: 11 });
}

/* =====================================================================
   被动（官方学习等级 → 本作：15 → 15、20 → 16、30 → 18、48 → 21、50 → 21、75 → 26、95 → 29）；数值按本作被动的尺度缩小（infoExtra）
   ===================================================================== */
const paDef = (id, S) => defSkill(id, { cls: 'priest', job: PA, type: 'mag', col: PA_COL.dark, ...S });
paDef('pa_devil', { name: '恶魔之力', lvReq: 15, maxLv: 10, sp: 15, passive: true, col: '#9a5ae8',
  desc: '【被动，转职时自动学会 1 级】唤醒体内的恶魔：普攻变成复仇者专用的 4 段（2 拳 + 2 镰，第 3、4 段能打到倒地 / 空中的敌人，身后也有判定），开启恶魔能量槽（上限 400，进地下城时 200）。复仇者技能施放中按 Z / X / C 放出恶魔残影（各耗 30 能量）：Z = 重击把敌人打飞很远，X = 快斩（可以连按），C = 挑空。普攻、地狱之门、末日浩劫、二觉 / 三觉技能、魔化中不能用。',
  infoExtra: lv => [['残影攻击力', pct(skillDmg(1.2, 0.12, lv))], ['每次消耗', '30 能量'], ['普攻命中', '+4 能量']] });
paDef('pa_heavy', { name: '复仇者重甲精通', lvReq: 15, maxLv: 1, sp: 0, passive: true, col: '#6a6a7a',
  desc: '【被动，转职时自动学会】穿重甲时智力、体力、精神、魔法暴击率、HP / MP 上限和 MP 恢复提高（防具精通，按穿着的重甲件数生效）。' });
paDef('pa_scythe', { name: '镰刀精通', lvReq: 16, maxLv: 10, sp: 15, passive: true, col: '#7a5ab8',
  desc: '【被动】装备镰刀时：普攻按魔法攻击结算，魔法攻击力、攻击速度、魔法暴击率提高；暗属性抗性提高、光属性抗性降低。',
  infoExtra: lv => [['魔法攻击力', '+' + pct(0.02 * lv)], ['攻击速度', '+' + pct(0.02 * lv)], ['魔法暴击率', '+' + pct(0.025 * lv)], ['暗 / 光抗性', `+${6 * lv} / −${3 * lv}`]] });
paDef('pa_echo', { name: '恶魔诅咒', lvReq: 18, maxLv: 10, sp: 15, passive: true, col: '#9a6ad8',
  desc: '【被动】（旧译“幻听”）恶魔在耳边低语：普攻和技能攻击力提高（魔化普攻、恶魔之爪除外）；施放复仇者技能时触发「幻听」：30 秒内移动速度提高（化魔必定触发，几乎常驻）。',
  infoExtra: lv => [['攻击力', '+' + pct(0.012 * lv)], ['幻听移速', '+' + pct(0.02 * lv)]] });
paDef('pa_nightmare', { name: '恶魔唤醒', tier: 1, lvReq: 21, maxLv: 10, sp: 20, passive: true, col: '#b04ae8',
  desc: '【被动】每次获得恶魔能量时额外 +3 以上；魔化普攻、审判、复仇者技能攻击力提高。', infoExtra: lv => [['每次额外能量', '+' + (3 + (3 + lv) / 9).toFixed(1)], ['攻击力', '+' + pct(0.008 * lv)], ['审判', '+' + pct(0.02 * lv)]] });
paDef('pa_rebirth', { name: '恶之再临', tier: 1, lvReq: 21, maxLv: 1, sp: 0, passive: true, col: '#ff8ad8',
  desc: '【一觉被动，完成一次觉醒任务时自动学会】魔化中 HP 降到 0 时不会死亡：变回人形，回复 30% 的 HP / MP，短暂无敌。冷却 145 秒（不受冷却缩减影响）；决斗场无效。', infoExtra: () => [['冷却', '145 秒'], ['回复', '30% HP / MP']] });
paDef('pa_evil', { name: '原罪之力', tier: 2, lvReq: 26, sp: 30, passive: true, col: '#ff6ad8',
  desc: '【二觉被动】恶魔之力进化（残影变成粉紫色），恶魔之力伤害提高；普攻和所有技能攻击力提高。', infoExtra: lv => [['恶魔之力', '+' + pct(0.1 + 0.015 * lv)], ['攻击力', '+' + pct(0.02 * lv)]] });
paDef('pa_righteous', { name: '光之影', tier: 3, lvReq: 29, sp: 40, passive: true, col: '#fff0c0',
  desc: '【三觉被动】光与暗在体内交织：普攻和转职技能攻击力提高；魔化中 裂地锤 改为前方三个方向同时冒出暗黑石柱、同时爆炸（区域判定），回旋飞镰 在范围里必定打满（掷出 3 下 + 收回 4 下）。', infoExtra: lv => [['攻击力', '+' + pct(0.03 * lv)]] });

/* =====================================================================
   转职主动技能（Lv15~20；伤害按本作同冷却技能的尺度，各段比例照官方 DFO Lv1 百分比；魔化版的改动见 PA_DEMON）
   ===================================================================== */
// 半魔化：能量 ≥ 200 时变身（周身暗爆一次）；普攻 / 恶魔之力强化，技能攻击 +、攻速 +5%、移速 +10%；能量每 1.29 秒 −15，归零解除；再按一次解除；冷却在结束后才开始
defSkill('pa_meta', { name: '半魔化', cls: 'priest', job: PA, lvReq: 15, maxLv: 1, sp: 20, mp: 60, cd: 5, type: 'mag', buff: true, col: '#5a3a7a', icon: 'pa_meta',
  req: p => paDemon(p) ? '魔化中不能用' : paHalf(p) || paE(p) >= PA_EMAX / 2 || '恶魔能量不足 200',
  desc: '恶魔能量 ≥ 200 时，释放一部分恶魔之力：身体变成全黑的剪影（红眼、巨兵消失、攻击带爪痕），周身暗爆一次。半魔化中普攻变成 勾拳×2 → 勾拳×2 → 上勾 → 下砸、跳攻可以连续，恶魔之力不耗能量并且更强，复仇者技能攻击力提高、攻速 +5%、移速 +10%，各种追加消耗能量变成 0；能量每 1.29 秒 −15（只有化魔 / 不朽战吼 / 混沌弑神能回能量），归零解除。再按一次也能解除；冷却在解除后才开始。',
  infoExtra: () => [['技能攻击力', '+25%'], ['能量流失', '15 / 1.29 秒'], ['门槛', '200 能量']], ai: { kind: 'buff' },
  recast: { ok: p => paHalf(p), instant: true, cd: 0.3, act: (lv, p) => paHalfEnd(p, '解除半魔化') },
  act: () => ({ name: 'pa_meta', clip: 'paHunch', dur: 0.45, noCounter: true, superArmor: true,
    events: [evAt(0.25, e => { e.buffs.pa_half = { t: 1e6, dmg: 0.25, aspd: 0.05, mspd: 0.1, drainT: 0, name: '半魔化', col: '#3a2a4a' }; e.cool.pa_meta = 1e6; e.acts = priestActs(e); paHalfFx(e);
      fxShock(e.x, e.y, 220, '#3a1a5a'); fxBurst(e.x, e.y, e.z + 60, 200, '#5a2a8a'); cam.shake = Math.max(cam.shake, 5); paRoarSfx(0.4);
      blast(e, e.x, e.y, 160, { dmg: 1.0, type: 'mag', knock: 160, launch: 160, hs: 0.05, downHit: true, snd: 'slash', col: '#c080ff' }, { zMax: 120 }); })] }) });
// 死亡切割：霸体连斩 6 下（连打技能键更快），每下把敌人拉近并让它背对你；每下按打中的目标数回血；最下段判定；能量 +15。魔化：用爪，攻 +125%、冷却 +60%
defSkill('pa_render', { name: '死亡切割', cls: 'priest', job: PA, lvReq: 15, mp: 30, cd: 5, type: 'mag', col: '#8a4ad8', icon: 'pa_render',
  desc: '以霸体挥镰连斩 6 下（连打技能键斩得更快），每一下把敌人拉近并让它转过身背对你（背击），按打中的目标数回复 HP；能打到倒地的敌人。恶魔能量 +15。魔化：改用巨爪，攻击力 +125%、冷却 +60%。',
  pow: lv => skillDmg(2.6, 0.26, lv), infoExtra: () => [['段数', '6 × 221%'], ['每个目标回复', '0.4% HP']], ai: { kind: 'poke', r: [0, 140], dy: 40 },
  act: (lv, p) => { const D = paDemon(p), per = skillDmg(2.6, 0.26, lv) / 6 * paDmg(p, 'pa_render');
    return { name: 'pa_render', clip: D ? 'paSlash' : 'paSlash', dur: 0.9, noCounter: true, superArmor: true, type: 'mag',
      onInput: (e, I) => { const a = e.act; if (I.buffered(a.key || 'cmd')) { I.consume(a.key || 'cmd'); a.fast = 0.2; } return false; },
      update: (e, dt) => { const a = e.act; if (a.fast > 0) { a.fast -= dt; e.actT += dt * 0.5; }
        const k = Math.floor((e.actT - 0.06) / 0.12); if (e.actT > 0.06 && k !== a.k && (a.n || 0) < 6) { a.k = k; a.n = (a.n || 0) + 1; e.play(a.n % 2 ? 'paSlash' : 'paSlash2', true); e.animT = 0.06;
          if (D) paClawFx(e.x + e.face * 90, e.y, e.z + 60, a.n % 2 ? e.face : -e.face, 1.3); else fxSlashOn(e, { a0: a.n % 2 ? -2.2 : 1.4, a1: a.n % 2 ? 1.2 : -1.8, r: 118, w: 20, off: [16, 54], col: PA_COL.dark, silent: true });
          sfx.swing(false); let n = 0;
          for (const t of ents) if (hittable(e, t) && (t.x - e.x) * e.face > -30 && Math.abs(t.x - e.x) < (D ? 240 : 205) && Math.abs(t.y - e.y) < (D ? 64 : 52) && t.z < 150) {
            applyHit(e, t, { dmg: per, type: 'mag', stun: 0.4, knock: -30, hs: 0.03, downHit: true, snd: 'slash', col: '#d0a0ff', box: null }, { src: e }); paPullBack(t, e); n++; }
          if (n) { e.hp = Math.min(e.hpMax, e.hp + Math.round(e.hpMax * 0.004 * n)); } }
        if (a.n >= 6 && !a.done) { a.done = true; a.dur = e.actT + 0.2; } } }; } });
// 把敌人拉到身前并转过身去（死亡切割）
function paPullBack(t, e) { if (t.boss || t.heldBy || (hasSA(t) && t.st !== 'hit' && t.st !== 'air')) return; t.x = lerp(t.x, e.x + e.face * 70, 0.25); t.y = lerp(t.y, e.y, 0.2); t.face = e.face; }
// 裂地锤：一拳砸地，前方依次冒出 3 根石柱（贴身打不到），轻推敌人，出手极快；能量 +30。魔化：暗黑石柱 4 根、冒出 + 爆炸共 8 击、范围更大、冷却 +55%；光之影：三个方向同时
defSkill('pa_mine', { name: '裂地锤', cls: 'priest', job: PA, lvReq: 16, mp: 30, cd: 5, type: 'mag', col: '#7a5a9a', icon: 'pa_mine',
  desc: '一拳砸向地面，前方依次冒出 3 根石柱（每根 441%；贴身的敌人打不到），把敌人轻轻推开，出手极快。恶魔能量 +30。魔化：变成 4 根暗黑石柱，冒出和爆炸各打一下（最多 8 击），范围更大，冷却 +55%；学了光之影后，魔化中前方三个方向同时冒出、同时爆炸。',
  pow: lv => skillDmg(2.6, 0.26, lv), infoExtra: () => [['石柱', '3 根 × 441%'], ['距离', '70 ~ 300px']], ai: { kind: 'poke', r: [60, 300], dy: 40 },
  act: (lv, p) => { const D = paDemon(p), T = skillDmg(2.6, 0.26, lv), R3 = D && skLv(p, 'pa_righteous');
    const pillar = (e, x, y, d, big, dark) => { fxSpr('rock', x, y, 30, { w: big ? 60 : 44, h: big ? 150 : 110, dur: 0.5, add: false, grow: [0.3, 1], ay: 1 }); if (dark) fxSpr('aura', x, y, 0, { h: big ? 200 : 150, w: 70, ay: 1, dur: 0.4, col: PA_COL.dark, grow: [0.3, 1] });
      fxDust(x, y, 4, 16); sfx.hit('blunt', false); areaHit(e, x, y, big ? 62 : 48, 0, { dmg: d, type: 'mag', launch: 260, knock: 70, hs: 0.04, downHit: true, snd: 'blunt', col: '#d0b0ff' }, { zMax: 150 }); };
    return { name: 'pa_mine', clip: 'thrust', dur: D ? 0.75 : 0.5, noCounter: true, type: 'mag',
      events: [evAt(0.08, e => { cam.shake = Math.max(cam.shake, 3); fxDust(e.x + e.face * 30, e.y, 5, 10); }),
        ...(D ? [0, 1, 2, 3].map(i => evAt(R3 ? 0.14 : 0.12 + i * 0.07, e => { const d = T / 8 * 1.6, xs = R3 ? [[0, 0], [0, -1], [0, 1]] : [[0, 0]];
            for (const [, dy] of xs) { const x = e.x + e.face * (80 + i * 75), y = e.y + dy * (40 + i * 18); pillar(e, x, y, d, true, true); game.after(0.18, () => { if (e.dead) return; paBoom(x, y, 40, 120); areaHit(e, x, y, 70, 0, { dmg: d, type: 'mag', launch: 300, knock: 90, hs: 0.04, downHit: true, snd: 'blunt', col: '#d0b0ff' }, { zMax: 170 }); }); } }))
          : [0, 1, 2].map(i => evAt(0.1 + i * 0.06, e => pillar(e, e.x + e.face * (95 + i * 85), e.y, T / 3, false, false))))] }; } });
// 回旋飞镰：把镰刀掷出（第 1 击击退并把敌人吸到同一条线上），镰刀在前方原地转 5 下，再按技能键或时间到就收回（收回时把敌人拉回身前）；全程霸体；能量 +20。
// 魔化：黑色镰影高速旋转、不能手动收回，攻 +90%、冷却 +50%；光之影：范围里必定打满（掷出 3 + 收回 4）
defSkill('pa_cutter', { name: '回旋飞镰', cls: 'priest', job: PA, lvReq: 17, mp: 45, cd: 10, type: 'mag', col: '#8a5ae8', icon: 'pa_cutter',
  desc: '把镰刀向前掷出：第 1 击把敌人击退并吸到同一条线上，镰刀在 230px 外原地旋转 5 下；再按技能键（或 1.4 秒后）收回，收回时把敌人拉回你身前。全程霸体（期间只能用恶魔之力）。恶魔能量 +20。魔化：黑色镰影高速旋转（不能手动收回），攻击力 +90%、冷却 +50%；学了光之影后必定打满（掷出 3 下 + 收回 4 下）。',
  pow: lv => skillDmg(4.8, 0.48, lv), infoExtra: () => [['掷出 : 旋转', '674% : 396% × 5'], ['距离', '230px']], ai: { kind: 'poke', r: [60, 300], dy: 40 },
  act: (lv, p) => { const T = skillDmg(4.8, 0.48, lv) * paDmg(p, 'pa_cutter'), D = paDemon(p), R3 = D && skLv(p, 'pa_righteous'), throwD = T * 0.254, spin = T * 0.149;
    return { name: 'pa_cutter', clip: 'paSlash', dur: 2.2, noCounter: true, superArmor: true, type: 'mag',
      onStart: e => { const a = e.act; a.sx = e.x; a.sy = e.y; a.sz = 60; a.st = 'out'; a.n = 0; a.T0 = 0;
        addFx({ ent: e, x: e.x, y: e.y + 0.8, z: 0, dur: 2.3, draw(c) { const E = this.ent, A = E.act; if (!A || A.name !== 'pa_cutter') { this.dur = this.t; return; }
          this.y = A.sy + 0.8; const X = sx(A.sx), Y = sy(A.sy, A.sz), r = D ? 170 : 120;
          drawSpr(c, fxTint('slash', D ? '#5a2a8a' : PA_COL.dark), X, Y, r, r * 0.5, { rot: this.t * (D ? 30 : 18), alpha: 0.9 }); drawSpr(c, fxTint('slash', '#e0b0ff'), X, Y, r * 0.8, r * 0.4, { rot: -this.t * 22 + 1, alpha: 0.6 }); } }); },
      onInput: (e, I) => { const a = e.act; if (!D && a.st === 'spin' && I.buffered(a.key || 'cmd')) { I.consume(a.key || 'cmd'); a.st = 'back'; } return false; },
      update: (e, dt) => { const a = e.act, tx = e.x + e.face * 230;
        if (a.st === 'out') { a.sx = lerp(a.sx, tx, Math.min(1, dt * 14)); if (!a.hit1 && Math.abs(a.sx - e.x) > 90) { a.hit1 = true; sfx.swing(true);
            for (const t of ents) if (hittable(e, t) && (t.x - e.x) * e.face > 0 && Math.abs(t.x - e.x) < 260 && Math.abs(t.y - e.y) < 90 && t.z < 150) { const n = R3 ? 3 : 1;
              for (let i = 0; i < n; i++) applyHit(e, t, { dmg: throwD / n * (R3 ? 1.2 : 1), type: 'mag', knock: 0, stun: 0.45, hs: 0.04, downHit: true, snd: 'slash', col: '#d0a0ff', box: null }, { src: e }); if (!t.boss && !(hasSA(t) && t.st !== 'hit')) { t.y = lerp(t.y, e.y, 0.7); if ((t.x - e.x) * e.face < 200) t.x = lerp(t.x, tx - e.face * 20, 0.7); } } }
          if (Math.abs(a.sx - tx) < 12) { a.st = 'spin'; a.T0 = e.actT; } }
        else if (a.st === 'spin') { const iv = D ? 0.12 : 0.24, k = Math.floor((e.actT - a.T0) / iv);
          if (k !== a.k && a.n < 5) { a.k = k; a.n++; areaHit(e, a.sx, a.sy, D ? 120 : 95, 0, { dmg: spin, type: 'mag', stun: 0.35, knock: -20, hs: 0.02, downHit: true, snd: 'slash', col: '#d0a0ff' }, { zMax: 160 }); if (a.n % 2) sfx.swing(false); }
          if ((a.n >= 5 && e.actT - a.T0 > iv * 5.2) || e.actT - a.T0 > 1.4) a.st = 'back'; }
        else if (a.st === 'back') { a.sx = lerp(a.sx, e.x, Math.min(1, dt * 12)); a.sy = lerp(a.sy, e.y, Math.min(1, dt * 12));
          for (const t of ents) if (hittable(e, t) && Math.abs(t.x - a.sx) < 70 && Math.abs(t.y - a.sy) < 60 && t.z < 150) { if (!t.boss && !(hasSA(t) && t.st !== 'hit')) t.x = lerp(t.x, e.x + e.face * 60, 0.25);
            if (R3 && !a.back1) { a.back1 = true; for (let i = 0; i < 4; i++) applyHit(e, t, { dmg: spin * 0.8, type: 'mag', stun: 0.3, hs: 0.02, downHit: true, snd: 'slash', col: '#d0a0ff', box: null }, { src: e }); } }
          if (Math.abs(a.sx - e.x) < 20) { a.st = 'done'; a.dur = e.actT + 0.15; sfx.swing(false); } } } }; } });
// 复仇之刺：蹲身聚力，从地面放射出暗黑尖刺（前方多、后方少），1 击、硬直很长；纵深宽、空中地面都打得到；霸体、刺出时无敌；被打中时也能放（这时攻 +20%）。
// 魔化：刺更大，“生成 + 破碎”共 2 击（约 2 倍），第 1 击强制硬直，冷却 +60%
defSkill('pa_thorn', { name: '复仇之刺', cls: 'priest', job: PA, lvReq: 18, mp: 60, cd: 10, type: 'mag', col: '#6a3aa8', icon: 'pa_thorn', whenHit: () => false,
  desc: '蹲身聚力，从地面放射出一圈暗黑尖刺（前方多、后方少）：1 击，敌人长时间硬直；纵深很宽，地面和空中都打得到。霸体，刺出的一瞬间无敌。被打中（硬直 / 倒地）时也能放，这时攻击力 +20%。恶魔能量 +40。魔化：尖刺更大，生成 + 破碎共 2 击（约 2 倍伤害），第 1 击强制硬直，冷却 +60%。',
  pow: lv => skillDmg(4.8, 0.48, lv), infoExtra: () => [['范围', '前方 240px / 身后 130px'], ['受击中施放', '+20%']], ai: { kind: 'aoe', r: [0, 220], dy: 80 },
  act: (lv, p) => { const hurt = p.st === 'hit' || p.st === 'down' || p.st === 'air', T = skillDmg(4.8, 0.48, lv) * paDmg(p, 'pa_thorn') * (hurt ? 1.2 : 1), D = paDemon(p);
    return { name: 'pa_thorn', clip: 'paHunch', dur: 0.62, noCounter: true, superArmor: true, invul: [0.2, 0.34], type: 'mag',
      events: [evAt(0.02, e => { fxCharge(e, PA_COL.dark, 3); sfx.charge(); }),
        evAt(0.22, e => { e.play('paRoar', true); cam.shake = Math.max(cam.shake, 5); sfx.boom(0.6); const s = D ? 1.4 : 1;
          paThorns(e, s); fxShock(e.x, e.y, 220 * s, PA_COL.dark);
          const hit = (d, o) => { for (const t of ents) if (hittable(e, t) && (t.x - e.x) * e.face > -130 * s && (t.x - e.x) * e.face < 240 * s && Math.abs(t.y - e.y) < 95 * s && t.z < 260) applyHit(e, t, { dmg: d, type: 'mag', hs: 0.08, downHit: true, snd: 'slash', col: '#d0a0ff', box: null, ...o }, { src: e }); };
          if (D) { hit(T * 0.5, { stun: 1.0, knock: 0, onHit: (a, t) => addStatus(t, 'hold', 1.2, { src: a }) }); game.after(0.2, () => { if (e.dead) return; fxBurst(e.x + e.face * 90, e.y, 60, 280, PA_COL.dark); hit(T * 0.5, { stun: 1.2, knock: 120, launch: 260 }); }); }
          else hit(T, { stun: 1.2, knock: 40, airLift: 80 }); })] }; } });
// 厄运之轮：变成巨大的锯轮直冲 400px（9 击），↑ / ↓ 调纵深；跳跃中 / 后跳中也能放；霸体；能量 +25。魔化：死亡突击 —— 瞬间冲刺斩出暗黑剑气，6 击，总伤约 2.34 倍，冲刺时短暂无敌，冷却 +50%
defSkill('pa_wheel', { name: '厄运之轮', cls: 'priest', job: PA, lvReq: 19, mp: 70, cd: 16, type: 'mag', air: true, col: '#7a3ad8', icon: 'pa_wheel',
  desc: '化作一只巨大的锯轮向前直冲 400px，一路连续切割 9 下；冲刺中按 ↑ / ↓ 调整纵深。跳跃中、后跳中也能施放。霸体（但能被抓）。恶魔能量 +25。魔化：变成“死亡突击”——瞬间冲刺斩并带出暗黑剑气（6 击，总伤害约 2.34 倍），冲刺时短暂无敌，冷却 +50%。',
  pow: lv => skillDmg(7, 0.7, lv), infoExtra: () => [['段数', '9 × 685%'], ['冲刺距离', '400px']], ai: { kind: 'gap', r: [0, 420], dy: 60 },
  act: (lv, p) => { const T = skillDmg(7, 0.7, lv) * paDmg(p, 'pa_wheel'), D = paDemon(p);
    if (D) return { name: 'pa_wheel', clip: 'paStab', dur: 0.7, noCounter: true, superArmor: true, invul: [0, 0.22], type: 'mag', move: [[0.02, 0.2, 2100]],
      onStart: e => { sfx.swing(true); fxStreak({ x: e.x - e.face * 20, y: e.y, z: e.z + 70, face: e.face, len: 460, w: 40, col: '#9a4ae8', dur: 0.3 }); },
      update: e => { if (e.actT < 0.2 && Math.floor(e.actT / 0.03) !== e.act.ai) { e.act.ai = Math.floor(e.actT / 0.03); fxAfterimage(e, '#8a4ad8'); } },
      events: [0.24, 0.3, 0.36, 0.42, 0.48, 0.56].map((t, i) => evAt(t, e => { const x = e.x - e.face * 200; if (i === 0) { fxSpr('wave', x, e.y, 60, { h: 200, dur: 0.4, col: '#8a4ad8', rot: e.face * Math.PI / 2, grow: [0.6, 1.3] }); cam.shake = 7; }
        paClawFx(x + rnd(-120, 120), e.y, rnd(40, 110), e.face, 1.4); instantHit(e, { box: [-460, 40, 70, -10, 200], dmg: T / 6, type: 'mag', stun: 0.5, knock: i === 5 ? 260 : 20, launch: i === 5 ? 300 : 0, hs: 0.04, downHit: true, sure: true, snd: 'slash', col: '#e0a0ff' }); })) };
    return { name: 'pa_wheel', clip: 'paStab', dur: 1.0, noCounter: true, superArmor: true, type: 'mag', lowGrav: 0.2,
      onStart: e => { sfx.swing(true); e.act.wheel = addFx({ ent: e, x: e.x, y: e.y + 0.7, z: 0, dur: 1.0, draw(c) { const E = this.ent; if (!E.act || E.act.name !== 'pa_wheel') { this.dur = this.t; return; } this.y = E.y + 0.7;
        drawSpr(c, fxTint('slash', PA_COL.dark), sx(E.x + E.face * 40), sy(E.y, E.z + 60), 150, 150, { rot: this.t * 30 * E.face }); drawSpr(c, fxTint('slash', '#e0b0ff'), sx(E.x + E.face * 40), sy(E.y, E.z + 60), 110, 110, { rot: this.t * 30 * E.face + 2, alpha: 0.7 }); } }); },
      onInput: (e, I) => { e.vy = I.dy() * 160; return false; },
      update: e => { const a = e.act; if (e.actT < 0.9) e.vx = e.face * 450; else e.vx *= 0.8;
        const k = Math.floor(e.actT / 0.1); if (k !== a.k && (a.n || 0) < 9) { a.k = k; a.n = (a.n || 0) + 1; if (a.n % 3 === 0) sfx.swing(false);
          instantHit(e, { box: [-30, 130, 56, -10, 140], dmg: T / 9, type: 'mag', stun: 0.4, knock: 30, hs: 0.02, downHit: true, snd: 'slash', col: '#d0a0ff', onHit: (a2, t) => { if (!t.boss) t.x = lerp(t.x, e.x + e.face * 70, 0.4); } }); } },
      onEnd: e => { e.vy = 0; } }; } });
// 恶魔之拳：从影子里抽出恶魔之气缠在手臂上往前伸：10 段多段（短暂 hold），最后在拳头处爆炸（多段 : 爆炸 ≈ 1 : 3.7）；近处的敌人被推到手臂中段、远处的原地挨打
defSkill('pa_fist', { name: '恶魔之拳', cls: 'priest', job: PA, lvReq: 20, mp: 80, cd: 20, type: 'mag', col: '#8a3ad8', icon: 'pa_fist',
  desc: '从影子里抽出恶魔之气缠在手臂上，化作巨大的恶魔之臂往前伸出 320px：一路 10 段多段攻击（让敌人短暂强制硬直），最后在拳头处爆炸（多段 : 爆炸 ≈ 1 : 3.7）。近处的敌人会被推到手臂中段，远处的原地挨打，几乎不聚怪。魔化：多段 +29%、爆炸 +36%。',
  pow: lv => skillDmg(8.5, 0.85, lv), infoExtra: () => [['多段', '10 × 144%'], ['爆炸', '5316%'], ['距离', '320px']], ai: { kind: 'poke', r: [40, 320], dy: 40 },
  act: (lv, p) => { const T = skillDmg(8.5, 0.85, lv), D = paDemon(p), multi = T * 0.213 / 10 * (D ? 1.29 : 1), boom = T * 0.787 * (D ? 1.36 : 1), L = D ? 360 : 320;
    return { name: 'pa_fist', clip: 'paGrab', dur: 1.25, noCounter: true, superArmor: true, type: 'mag',
      onStart: e => { const a = e.act; fxCharge(e, PA_COL.dark, 3); sfx.charge();
        a.arm = addFx({ ent: e, x: e.x, y: e.y + 0.6, z: 0, dur: 1.2, draw(c) { const E = this.ent, A = E.act; if (!A || A.name !== 'pa_fist') { this.dur = this.t; return; }
          const k = clamp((this.t - 0.1) / 0.7, 0, 1), len = L * easeOut(k), X = sx(E.x + E.face * 30), Y = sy(E.y, E.z + 62);
          drawSpr(c, fxTint('bloodhand', D ? '#5a1a8a' : PA_COL.dark), X, Y, Math.max(20, len), 90 * (D ? 1.4 : 1), { ax: 0, ay: 0.5, flip: E.face < 0, alpha: 0.95 });
          drawSpr(c, fxTint('darkorb', PA_COL.dark), sx(E.x + E.face * (30 + len)), Y, 90, 0, { rot: this.t * 6, alpha: 0.8 }); } }); },
      update: e => { const a = e.act, k = Math.floor((e.actT - 0.15) / 0.07);
        if (e.actT > 0.15 && k !== a.k && (a.n || 0) < 10) { a.k = k; a.n = (a.n || 0) + 1; const len = L * easeOut(clamp((e.actT - 0.1) / 0.7, 0, 1));
          for (const t of ents) if (hittable(e, t) && (t.x - e.x) * e.face > 0 && (t.x - e.x) * e.face < len + 40 && Math.abs(t.y - e.y) < 60 && t.z < 170) {
            applyHit(e, t, { dmg: multi, type: 'mag', stun: 0.4, knock: 0, hs: 0.02, downHit: true, snd: 'slash', col: '#d0a0ff', box: null }, { src: e }); if (!t.boss) { addStatus(t, 'hold', 0.25, { src: e }); if ((t.x - e.x) * e.face < len * 0.5) t.x = lerp(t.x, e.x + e.face * len * 0.5, 0.3); } } }
        if (!a.boom && e.actT >= 0.9) { a.boom = true; const x = e.x + e.face * (30 + L); cam.shake = Math.max(cam.shake, 9); sfx.boom(1.1); fxBurst(x, e.y, 60, 300, PA_COL.dark); paBoom(x, e.y, 50, 240); fxShock(x, e.y, 260, PA_COL.dark);
          for (let i = 1; i < 4; i++) paBoom(e.x + e.face * (30 + L * i / 4), e.y, 60, 140);
          instantHit(e, { box: [10, L + 110, D ? 80 : 66, -10, 230], dmg: boom, type: 'mag', knock: 200, launch: 380, hs: 0.12, big: 1.8, downHit: true, snd: 'slash', col: '#e0a0ff' });   // 整条手臂一起炸（近处被推到手臂中段的也吃到）
          for (const t of ents) if (t.status && t.status.hold && t.status.hold.src === e) delete t.status.hold; } } }; } });
// 黑暗之触（2023 复刻，占原恶魔之握的位置）：恶魔之臂从影子里伸出，打周围的敌人并把他们聚到身前，不管抓没抓到都撕裂爆炸，再把敌人拉回身前；霸体；能量 +30
defSkill('pa_reaper', { name: '黑暗之触', cls: 'priest', job: PA, lvReq: 20, mp: 80, cd: 25, type: 'mag', col: '#6a2ab8', icon: 'pa_reaper',
  desc: '（2023 复刻）巨大的恶魔之臂从你的影子里伸出：扫过周围 310px 的敌人、把他们聚到身前一把握住（强制硬直），随即撕裂爆炸，再把敌人拉回身前。霸体。恶魔能量 +30。魔化：手臂巨大化，攻击力 +35%。',
  pow: lv => skillDmg(9, 0.9, lv), infoExtra: () => [['抓 : 爆炸', '1 : 3'], ['范围', '310px']], ai: { kind: 'aoe', r: [0, 260], dy: 100 },
  act: (lv, p) => { const T = skillDmg(9, 0.9, lv) * paDmg(p, 'pa_reaper'), D = paDemon(p), R = D ? 360 : 310;
    return { name: 'pa_reaper', clip: 'paGrab', dur: 1.1, noCounter: true, superArmor: true, type: 'mag',
      events: [evAt(0.12, e => { const gx = e.x + e.face * 100; sfx.swing(true); fxSpr('darkorb', e.x, e.y, 10, { w: R * 1.6, h: R * 0.5, dur: 0.6, col: '#3a1a5a', grow: [0.3, 1] });
          for (let i = 0; i < 3; i++) fxSpr('bloodhand', e.x + e.face * (40 + i * 70), e.y + (i - 1) * 30, 50 + i * 20, { w: 220 * (D ? 1.5 : 1), h: 100, dur: 0.5, col: '#5a2a9a', flip: e.face < 0, grow: [0.4, 1.1] });
          for (const t of paFoes(e, R)) { applyHit(e, t, { dmg: T * 0.25, type: 'mag', stun: 0.8, knock: 0, hs: 0.05, downHit: true, snd: 'slash', col: '#d0a0ff', box: null }, { src: e }); if (!t.boss) { t.x = lerp(t.x, gx, 0.85); t.y = lerp(t.y, e.y, 0.8); addStatus(t, 'hold', 0.9, { src: e }); } } }),
        evAt(0.55, e => { const gx = e.x + e.face * 100; cam.shake = Math.max(cam.shake, 8); sfx.boom(1); fxBurst(gx, e.y, 70, 320, PA_COL.dark); paClawFx(gx, e.y, 70, e.face, 2); fxShock(gx, e.y, 240, '#8a3ad8');
          blast(e, gx, e.y, 150 * (D ? 1.3 : 1), { dmg: T * 0.75, type: 'mag', stun: 0.6, knock: -60, hs: 0.1, big: 1.8, downHit: true, snd: 'slash', col: '#e0a0ff' }, { zMax: 220 });
          for (const t of paFoes(e, R)) { if (t.status && t.status.hold && t.status.hold.src === e) delete t.status.hold; if (!t.boss) t.x = lerp(t.x, e.x + e.face * 70, 0.5); } })] }; } });
// 身边 r 以内（纵深减半）的敌人
function paFoes(e, r) { const L = []; for (const t of ents) if (hittable(e, t) && Math.abs(t.x - e.x) < r && Math.abs(t.y - e.y) < r * 0.5 && t.z < 240) L.push(t); return L; }
// 黑暗权能（2023 重做）：砸地的暗黑冲击波（打中的强制硬直）→ 横斩画出逆十字 → 沿着斩痕爆炸（解除硬直）；按住技能键耗 60 能量，爆炸 +11%。魔化：手背长出刃爪，旋身抓挠后爆炸，范围更大
defSkill('pa_authority', { name: '黑暗权能', cls: 'priest', job: PA, lvReq: 20, mp: 90, cd: 40, type: 'mag', col: '#9a3ad8', icon: 'pa_authority',
  desc: '（2023 重做）一拳砸地放出暗黑冲击波（打中的敌人强制硬直）→ 横斩一记，在空中画出逆十字 → 沿着斩痕爆炸（解除硬直）。三段的范围各不相同，要贴近了放。按住技能键额外消耗 60 恶魔能量，爆炸伤害 +11%。魔化：手背长出刃爪，旋身抓挠后爆炸，攻击力 +35%、范围更大。',
  pow: lv => skillDmg(12, 1.2, lv), infoExtra: () => [['三段', '冲击波 25% / 横斩 30% / 爆炸 45%'], ['按住', '−60 能量，爆炸 +11%']], ai: { kind: 'aoe', r: [0, 200], dy: 70 },
  act: (lv, p) => { const T = skillDmg(12, 1.2, lv) * paDmg(p, 'pa_authority'), D = paDemon(p), s = D ? 1.3 : 1;
    return { name: 'pa_authority', clip: 'thrust', dur: 1.2, noCounter: true, superArmor: true, type: 'mag',
      events: [evAt(0.12, e => { const x = e.x + e.face * 60; cam.shake = Math.max(cam.shake, 5); sfx.boom(0.6); fxShock(x, e.y, 240 * s, PA_COL.dark); fxDust(x, e.y, 5, 16);
          blast(e, x, e.y, 150 * s, { dmg: T * 0.25, type: 'mag', stun: 0.6, knock: 0, hs: 0.05, downHit: true, snd: 'blunt', col: '#d0a0ff', onHit: (a, t) => addStatus(t, 'hold', 1.2, { src: a }) }, { zMax: 120 }); }),
        evAt(0.42, e => { e.play(D ? 'paSlash2' : 'paSlash', true); sfx.swing(true); if (D) { paClawFx(e.x + e.face * 90, e.y, 70, e.face, 1.8); paClawFx(e.x + e.face * 90, e.y, 70, -e.face, 1.8); }
          const x = e.x + e.face * 120; fxSpr('crossx', x, e.y, 80, { w: 60 * s, h: 220 * s, dur: 0.7, col: '#8a2ad8', rot: Math.PI, grow: [0.3, 1] }); fxSpr('slash', x, e.y, 110, { w: 260 * s, h: 50, dur: 0.6, col: '#b060ff', grow: [0.3, 1.1] });
          instantHit(e, { box: [0, 240 * s, 60, 0, 190], dmg: T * 0.3, type: 'mag', stun: 0.6, knock: 0, hs: 0.06, downHit: true, snd: 'slash', col: '#e0a0ff' }); }),
        evAt(0.78, e => { const x = e.x + e.face * 120, I = e.pad, a = e.act, extra = !!(I && a.key && I.is(a.key)) && paSpend(e, 60), mul = extra ? 1.11 : 1;
          if (extra) fxText('权能!', e.x, e.y, e.z + 110, { col: '#ff8ae8', size: 12 }); cam.shake = Math.max(cam.shake, 10); sfx.boom(1.2);
          for (let i = 0; i < 5; i++) game.after(0.04 * i, () => paBoom(x + e.face * (i - 2) * 50 * s, e.y + rnd(-20, 20), 40 + i * 30, 150));
          for (const t of ents) if (t.status && t.status.hold && t.status.hold.src === e) delete t.status.hold;
          blast(e, x, e.y, 170 * s, { dmg: T * 0.45 * mul, type: 'mag', launch: 460, knock: 120, hs: 0.12, big: 1.8, downHit: true, snd: 'slash', col: '#e0a0ff' }, { zMax: 260 }); })] }; } });
// 堕落之魂：消耗 60 恶魔能量，获得无限时 BUFF：复仇者的基础 / 转职技能攻击力提高（技能等级跟着恶魔之力一起涨）
defSkill('pa_fall', { name: '堕落之魂', cls: 'priest', job: PA, lvReq: 17, maxLv: 1, sp: 20, mp: 0, cd: 5, type: 'mag', buff: true, col: '#7a3ad8', icon: 'pa_fall',
  req: p => paE(p) >= 60 || paHalf(p) || '恶魔能量不足 60',
  desc: '【BUFF · 无限时】消耗 60 恶魔能量，让灵魂堕入黑暗：复仇者的基础技能和转职技能攻击力提高，持续到死亡或离开地下城（决斗场 30 秒）。效果随恶魔之力的等级提升。',
  infoExtra: (lv, p) => [['技能攻击力', '+' + pct(0.05 + 0.005 * Math.max(1, skLv(p || game.player, 'pa_devil')))], ['消耗', '60 恶魔能量']], ai: { kind: 'buff' },
  act: () => ({ name: 'pa_fall', clip: 'paCast', dur: 0.4, noCounter: true,
    events: [evAt(0.2, e => { if (!paSpend(e, 60)) return; const d = 0.05 + 0.005 * Math.max(1, skLv(e, 'pa_devil'));
      e.buffs.pa_fallB = { t: game.pvp ? 30 : 1e6, dmg: d, name: '堕落之魂', col: '#7a3ad8' }; fxSpr('ghost', e.x, e.y, e.z + 160, { w: 90, dur: 0.6, col: '#9a5ae8', grow: [1, 0.3], rot: Math.PI / 2 }); fxAura(e, '#7a3ad8', 0.8); sfx.buff(); })] }) });
