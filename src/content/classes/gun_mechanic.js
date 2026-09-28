/* =====================================================================
   转职：机械师（女）—— 国服现版，见 docs/SKILLS_OFFICIAL_gun.md 第 6 节（技能树）与第 6.4 节（本作的实现与决定）。
   百分比魔法职业（J.dmgType = 'mag'，吃智力），布甲；机器人全部“脱手”打伤害，都走召唤框架 src/game/summon.js（tag 'mech'）：
     RX-78 追击者（基础技能，所有转职都走这里）、空投的银色破坏者：追着最近的敌人跑，贴上后自爆
     EZ-8 自爆者：原地定时炸弹，按住技能键延长引信
     G 系列（tag 'gs'）：G-1 科罗纳（身后的浮空炮台）↔ G-2 旋雷者 ×3（环绕静电场，充满后再按发电磁波）↔ G-3 捕食者 ×6（再按缠到敌人身上 / 再按召回）
       三种形态共用持续时间（改装 +10 秒，不超过 20 秒）和改装冷却（5 秒；学了 G 系扩张后为 0，每次改装叠一层，最多 5 层）
       G-磁力弹、G-0 战争领主（一觉）以 G 系列为前提
     Ex-S 毒蛇炮（最多 9 台）、空战机械：狂风（再按自爆）、拦截机工厂（学了光反应能量模块后改成一次性的散热板激光）、空投支援
   指令类：机械引爆（点按 = 就地引爆范围内的 RX-78 / EZ-8；按住 = 准星，方向键移动，松开后机器人冲向准星自爆）、机械改良（开关，持续耗 MP）、
     机械指令（停火开关）、伪装（隐身：怪物丢失目标，出招时暂时现形）
   再按技能键（S.recast）：G-1 连按加快射速 / 其他形态时改装回 G-1、G-2 发射电磁波、G-3 缠绕 / 召回、狂风立即自爆
   机器人在地下城里不会被攻击（官方有 HP，见第 6.4 节）；伤害按主人的魔攻实时结算
   ===================================================================== */
const MC = 'mechanic';
const isMech = p => !!p && jobOf(p) === MC;
// 人物动作：新姿势（CLASSES.gun.jobs.mechanic.anims，由 sprites.js 合进 SPR_ANIMS.gun）进来之前先用现有帧
const MECH_CLIP_FB = { mSet: 'tech', mRemote: 'quantum', mPoint: 'gaim', mCall: 'gbuff', mAwk: 'quantum' };
const mclip = n => (typeof SPR_ANIMS !== 'undefined' && SPR_ANIMS.gun && SPR_ANIMS.gun[n] && CLIPS.gun && CLIPS.gun[n]) ? n : MECH_CLIP_FB[n];
const MECH_COL = { light: '#fff0a0', fire: '#ffb060', none: '#d8e4f0' };
const OUTL = '#1b1e28';
sfx.mech = function (v = 1) { this.tone('square', 520, 880, 0.06, 0.05 * v); this.tone('square', 880, 660, 0.05, 0.04 * v, { delay: 0.06 }); };
sfx.beep = function (v = 1) { this.tone('square', 1320, 1320, 0.05, 0.04 * v); };

/* ---- 数值（本作单位：攻击力的倍数；按官方各技能的相对比例压缩，见第 6.4 节） ---- */
const MECH_DMG = {
  rx78: lv => skillDmg(3.2, 0.32, lv),              // 和基础技能 g_rx78 一样
  ez8: lv => skillDmg(6.0, 0.6, lv),
  ez8Delay: lv => 2.4 + 0.4 * (lv - 1),             // 按住最多延长的引信
  g1: lv => skillDmg(0.26, 0.026, lv),              // 每发
  g2Field: lv => skillDmg(0.06, 0.006, lv),         // 每台每跳
  g2Wave: lv => skillDmg(0.36, 0.036, lv),          // 每台一道电磁波
  g3: lv => skillDmg(0.07, 0.007, lv),              // 每台每 0.5 秒
  viper: lv => skillDmg(0.12, 0.012, lv),           // 每发
  viperBoom: lv => skillDmg(0.9, 0.09, lv),
  galeGun: lv => skillDmg(0.035, 0.0035, lv), galeMis: lv => skillDmg(0.07, 0.007, lv), galeBoom: lv => skillDmg(2.6, 0.26, lv),
  magnet: () => 0.22, magnetEnd: () => 0.9,
  drop: lv => skillDmg(1.25, 0.125, lv),            // 每个银色破坏者
  sparrowShot: lv => skillDmg(0.05, 0.005, lv), sparrowBoom: lv => skillDmg(1.2, 0.12, lv), solar: lv => skillDmg(10, 1.0, lv),
  g0Gat: lv => 0.18 * (1 + 0.27 * (lv - 1)), g0Mis: lv => 0.25 * (1 + 0.27 * (lv - 1)), g0Las: lv => 1.0 * (1 + 0.27 * (lv - 1)),
};
const GS_BASE = 20, GS_BONUS = 10, GS_TF_CD = 5;
// 机械改良：机器人移速加成；G 系扩张：每层攻击力
const robSpd = p => { const B = p && p.buffs && p.buffs.gm_robotics; return B ? 1.62 + 0.04 * (B.lv - 1) : 1; };
const gextLv = p => skLv(p, 'gm_gext');
const gextPer = p => { const l = gextLv(p); return l ? 0.02 + 0.005 * (l - 1) : 0; };
// 所有机器人的伤害倍率（G 系扩张的层数对全部机器人生效，官方 100 版本起）
const mechMul = p => 1 + gextPer(p) * ((p.gs && p.gs.stacks) || 0);
// 电能转换：RX-78 / EZ-8 / Ex-S / 狂风 / 空投 / 拦截机改成光属性
const mElem = (p, base) => hasSkill(p, 'gm_convert') ? 'light' : base;
const mechHeld = s => !!(s.owner && s.owner.mechHold) && !s.sdef.noHold;
// 目标等级：领主 > 精英 > 普通（捕食者 / G-0 锁定 / 拦截机引爆优先打等级高的）
const foeGrade = t => (t.boss ? 3 : t.elite ? 2 : 1) * 1e9 + t.hp;
function foesNear(p, x, y, rx, ry = rx * 0.4) { const L = []; for (const t of ents) if (foe(p, t) && Math.abs(t.x - x) < rx && Math.abs(t.y - y) < ry) L.push(t); return L; }

/* ---- 机器人外观：有美术（art/final/spr/mech_<名字>/，分包 spr:mech_<名字>）就画帧，没有就用矢量画的替身 ---- */
const MECH_ART = ['rx78', 'ez8', 'g1', 'g2', 'g3', 'viper', 'gale', 'sparrow', 'factory', 'g0', 'buster', 'hs12', 'frisbee', 'falcon', 'emgen', 'bolt'];
let mechArtReq = false;
function mechArtLoad() {
  if (mechArtReq || typeof loadBundles !== 'function' || typeof ASSET_BUNDLE === 'undefined') return; mechArtReq = true;
  const want = MECH_ART.map(k => 'spr:mech_' + k).filter(b => Object.values(ASSET_BUNDLE).includes(b)); if (want.length) loadBundles(want).catch(() => { });
}
if (typeof bus !== 'undefined') { bus.on('jobChange', e => { if (e && e.job === MC) mechArtLoad(); }); bus.on('dungeonEnter', () => { if (isMech(game.player)) mechArtLoad(); }); }
function mechFrame(c, kind, f) {
  const key = 'mech_' + kind, D = typeof SPR_DATA !== 'undefined' && SPR_DATA[key]; if (!D) return false;
  if (!D.frames[f]) f = 'idle'; const F = D.frames[f], im = IMG[`spr/${key}/${f}`]; if (!F || !im) return false;
  const k = 1 / (D.res || 2); c.save(); c.scale(k, k); c.drawImage(im, -F.ax, -F.ay); c.restore(); return true;
}
const MECH_NULL = { skel: { map: {} }, draw() { } };
const cyc = (t, fps, L) => L[Math.floor(t * fps) % L.length];
function mechModel(s) { return { skel: { map: {} }, draw(c, pose, t) { const L = MECH_LOOK[s.mkind]; if (!L) return; c.save(); c.translate(0, -(s.hz || 0)); L(c, s, t); c.restore(); } }; }
function mechSpawn(s, kind, o = {}) {
  s.mkind = kind; s.model = mechModel(s); s.hz = o.hz || 0; s.timers = {}; mechArtLoad();
  const own = s.owner; s.face = own.face;
  if (o.puff !== false) { fxBurst(s.x, s.y, 20 + (s.hz || 0), 60, '#d8e8ff'); fxDust(s.x, s.y, 3, 10); }
}
// ---- 矢量替身（粗描边 Q 版；正式美术见 art/tools/mech_art.py）----
function mP(c, fill, fn, lw = 2.2) { c.beginPath(); fn(); c.fillStyle = fill; c.fill(); c.lineWidth = lw; c.strokeStyle = OUTL; c.stroke(); }
function mGlow(c, x, y, r, col, a = 0.8) { c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha *= a; const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); c.restore(); }
const MECH_LOOK = {
  rx78(c, s, t) { if (mechFrame(c, 'rx78', s.st === 'walk' || s.st === 'run' || s.rush ? cyc(t, s.rush ? 18 : 12, ['run1', 'run2', 'run3']) : 'idle')) return; drawRx78(c, 0, 0, 1, t + s.sid); },
  buster(c, s, t) {
    if (mechFrame(c, 'buster', cyc(t, 16, ['run1', 'run2', 'run3']))) return;
    c.save(); c.scale(1.1, 1.1); drawRx78(c, 0, 0, 1, t * 1.6 + s.sid);
    c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.35; c.fillStyle = '#e8eef8'; c.fillRect(-11, -26, 22, 20); c.restore();
  },
  ez8(c, s, t) {
    const left = s.life - s.lifeT, on = Math.floor(t * (left < 1 ? 14 : left < 2 ? 7 : 3.5)) % 2 === 0;
    if (mechFrame(c, 'ez8', s.leap ? 'hop2' : left < 0.5 ? 'swell' : left < 1.2 ? (on ? 'shake' : 'blink') : on ? 'idle' : 'blink')) return;
    c.fillStyle = '#2a2f3c'; c.fillRect(-12, -6, 6, 6); c.fillRect(6, -6, 6, 6);
    mP(c, '#7a8499', () => c.ellipse(0, -19, 15, 14, 0, 0, TAU));
    mP(c, '#f2c230', () => c.rect(-15, -17, 30, 5), 1.6);
    mP(c, '#232833', () => c.rect(-8, -29, 16, 9), 1.6);
    c.fillStyle = on ? '#ff3a2a' : '#7a2018'; c.font = 'bold 8px monospace'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(Math.max(0, Math.ceil(left))), 0, -24.5);
    c.strokeStyle = OUTL; c.lineWidth = 2; c.beginPath(); c.moveTo(5, -32); c.lineTo(9, -40); c.stroke();
    c.fillStyle = on ? '#ff5a3a' : '#5a1a14'; c.beginPath(); c.arc(9, -41, 3, 0, TAU); c.fill(); if (on) mGlow(c, 9, -41, 10, '#ff5a3a');
  },
  g1(c, s, t) {
    const b = Math.sin(t * 3 + s.sid) * 3; c.translate(0, b);
    if (mechFrame(c, 'g1', s.fireFx > game.t ? 'fire' : s.fireFx > game.t - 0.15 ? 'recover' : cyc(t, 2.5, ['idle', 'bob1', 'idle', 'bob2']))) return;
    c.translate(0, -12);
    mP(c, '#58627a', () => { c.moveTo(-10, -4); c.lineTo(-24, -14); c.lineTo(-20, 4); c.closePath(); });
    mP(c, '#58627a', () => { c.moveTo(-10, 4); c.lineTo(-22, 12); c.lineTo(-12, 10); c.closePath(); });
    mP(c, '#3a4050', () => c.rect(6, -3.5, 16, 7));
    mP(c, '#cfd6e2', () => c.arc(0, 0, 13, 0, TAU));
    mP(c, '#f2c230', () => c.arc(0, 0, 13, Math.PI * 0.8, Math.PI * 1.2), 1.4);
    c.fillStyle = '#fff4a8'; c.beginPath(); c.arc(1, 0, 5, 0, TAU); c.fill(); mGlow(c, 1, 0, 14, '#fff0a0', 0.6 + 0.3 * Math.sin(t * 8));
    if (s.fireFx > game.t) mGlow(c, 24, 0, 16, '#fff6c0');
  },
  g2(c, s, t) {
    const G = s.owner.gs, full = G && G.chg >= 1;
    if (mechFrame(c, 'g2', full ? (Math.floor(t * 8) % 3 ? 'charged' : 'spin2') : cyc(t, 14, ['idle', 'spin1', 'spin2', 'spin3']))) return;
    c.translate(0, -8); c.scale(1, 0.9);
    mP(c, '#3a4050', () => c.ellipse(0, 4, 13, 5, 0, 0, TAU));
    mP(c, '#9aa6bc', () => c.ellipse(0, 0, 12, 7, 0, 0, TAU));
    const a = t * 14 + s.idx; c.strokeStyle = '#f2c230'; c.lineWidth = 2; c.beginPath(); c.moveTo(Math.cos(a) * 10, Math.sin(a) * 4); c.lineTo(-Math.cos(a) * 10, -Math.sin(a) * 4); c.stroke();
    mP(c, '#5ab8ff', () => c.arc(0, -4, 4.5, 0, TAU), 1.6);
    if (full) { mGlow(c, 0, -4, 18, '#9fd8ff'); c.strokeStyle = 'rgba(200,240,255,.9)'; c.lineWidth = 1.5; c.beginPath(); for (let i = 0; i < 4; i++) { const r = rnd(8, 16), q = rnd(0, TAU); c.moveTo(0, -4); c.lineTo(Math.cos(q) * r, -4 + Math.sin(q) * r * 0.6); } c.stroke(); }
  },
  g3(c, s, t) {
    const flap = Math.sin(t * 22 + s.idx) > 0;
    if (mechFrame(c, 'g3', s.stuck ? cyc(t, 6, ['bite', 'grab']) : s.tgt ? 'dive' : cyc(t, 10, ['flapU', 'idle', 'flapD', 'idle']))) return;
    c.translate(0, -6);
    mP(c, '#8a95ab', () => { c.moveTo(-4, -2); c.lineTo(-16, flap ? -12 : 2); c.lineTo(-2, 3); c.closePath(); }, 1.8);
    mP(c, '#b9c3d4', () => c.ellipse(0, 0, 9, 6, 0, 0, TAU), 1.8);
    mP(c, '#f2c230', () => { c.moveTo(8, -2); c.lineTo(15, 0); c.lineTo(8, 3); c.closePath(); }, 1.4);
    c.fillStyle = '#ff5a3a'; c.beginPath(); c.arc(4, -2, 1.8, 0, TAU); c.fill();
    c.strokeStyle = OUTL; c.lineWidth = 1.6; c.beginPath(); c.moveTo(-1, 5); c.lineTo(-3, 10); c.moveTo(3, 5); c.lineTo(4, 10); c.stroke();
  },
  viper(c, s, t) {
    const firing = s.fireFx > game.t;
    if (mechFrame(c, 'viper', firing ? cyc(t, 20, ['fire1', 'fire2']) : s.life - s.lifeT < 0.6 ? 'heat' : 'idle')) return;
    c.strokeStyle = OUTL; c.lineWidth = 3; c.beginPath(); c.moveTo(0, -14); c.lineTo(-12, 0); c.moveTo(0, -14); c.lineTo(12, 0); c.moveTo(0, -14); c.lineTo(2, 0); c.stroke();
    c.strokeStyle = '#5a6378'; c.lineWidth = 1.6; c.stroke();
    mP(c, '#6b778f', () => c.rect(-10, -26, 18, 13));
    mP(c, '#3a4050', () => c.rect(6, -24 + (firing ? Math.sin(t * 60) : 0), 20, 4), 1.6); mP(c, '#3a4050', () => c.rect(6, -18, 20, 4), 1.6);
    mP(c, '#f2c230', () => c.rect(-10, -26, 5, 13), 1.4);
    c.fillStyle = '#7fe8ff'; c.fillRect(-2, -23, 5, 3);
    if (firing) mGlow(c, 28, -18, 12, '#fff0c0');
  },
  gale(c, s, t) {
    const b = Math.sin(t * 2.4 + s.sid) * 4; c.translate(0, b);
    if (mechFrame(c, 'gale', s.dive ? 'dive' : s.misFx > game.t ? 'missile' : s.fireFx > game.t ? 'fire' : cyc(t, 2.5, ['idle', 'bob1', 'idle', 'bob2']))) return;
    c.translate(0, -14);
    mP(c, '#3a4050', () => c.rect(-30, -3, 60, 5), 1.8);
    for (const x of [-26, 26]) { c.save(); c.translate(x, -4); c.scale(1, 0.25); c.globalAlpha = 0.55; c.fillStyle = '#cfd6e2'; c.beginPath(); c.arc(0, 0, 13, 0, TAU); c.fill(); c.restore(); }
    mP(c, '#7d8aa3', () => { c.moveTo(-18, -10); c.lineTo(20, -8); c.lineTo(26, 2); c.lineTo(14, 12); c.lineTo(-16, 10); c.closePath(); });
    mP(c, '#a8e0ff', () => { c.moveTo(6, -8); c.lineTo(20, -7); c.lineTo(24, 1); c.lineTo(8, 1); c.closePath(); }, 1.6);
    mP(c, '#f2c230', () => c.rect(-16, 2, 10, 5), 1.4);
    mP(c, '#3a4050', () => c.rect(12, 8, 18, 4), 1.4);
    mP(c, '#c83a2a', () => c.rect(-12, 10, 12, 4), 1.4);
  },
  sparrow(c, s, t) {
    const flap = Math.sin(t * 30 + s.sid) > 0;
    if (mechFrame(c, 'sparrow', s.kami ? 'dive' : cyc(t + s.sid, 14, ['up', 'idle', 'down', 'idle']))) return;
    c.translate(0, -4); c.scale(0.8, 0.8);
    mP(c, '#9aa6bc', () => { c.moveTo(-2, 0); c.lineTo(-12, flap ? -9 : 3); c.lineTo(2, 2); c.closePath(); }, 1.6);
    mP(c, '#e8ecf2', () => c.ellipse(0, 0, 8, 5, 0, 0, TAU), 1.6);
    mP(c, '#5ab8ff', () => c.arc(4, -1, 2.2, 0, TAU), 1.2);
  },
  factory(c, s, t) {
    if (mechFrame(c, 'factory', s.life - s.lifeT < 0.5 ? 'brace' : s.mkT > game.t ? 'open2' : s.mkT > game.t - 0.15 ? 'open1' : 'idle')) return;
    mP(c, '#5a6378', () => c.rect(-26, -44, 52, 44));
    mP(c, '#7d8aa3', () => { c.moveTo(-30, -44); c.lineTo(0, -58); c.lineTo(30, -44); c.closePath(); });
    for (let i = 0; i < 5; i++) { c.fillStyle = i % 2 ? '#f2c230' : '#232833'; c.fillRect(-26 + i * 10.4, -8, 10.4, 8); }
    mP(c, '#232833', () => c.rect(-12, -34, 24, 18), 1.6);
    const k = (t * 1.5) % 1; c.fillStyle = `rgba(255,220,120,${0.3 + 0.5 * (1 - k)})`; c.fillRect(-10, -32, 20, 14);
    c.strokeStyle = OUTL; c.lineWidth = 2; c.beginPath(); c.moveTo(14, -54); c.lineTo(14, -66); c.stroke(); c.fillStyle = Math.floor(t * 4) % 2 ? '#ff5a3a' : '#5a1a14'; c.beginPath(); c.arc(14, -68, 3, 0, TAU); c.fill();
  },
  hs12(c, s, t) {
    if (mechFrame(c, 'hs12', s.lifeT < 0.7 ? cyc(t, 8, ['charge1', 'charge2']) : s.lifeT > 2.8 ? 'swell' : cyc(t, 10, ['fly1', 'fly2']))) return;
    c.translate(0, -16); mGlow(c, 0, 0, 26, '#c08aff', 0.7 + 0.3 * Math.sin(t * 14));
    mP(c, '#e8ecf2', () => c.arc(0, 0, 14, 0, TAU)); mP(c, '#b070ff', () => c.arc(0, 0, 8, 0, TAU), 1.6); c.fillStyle = '#5ab8ff'; c.beginPath(); c.arc(6, -4, 2.5, 0, TAU); c.fill();
  },
  frisbee(c, s, t) {
    if (mechFrame(c, 'frisbee', cyc(t, 20, ['spin1', 'spin2', 'spin3', 'spin4']))) return;
    c.translate(0, -14); c.rotate(t * 20); mP(c, '#5a6378', () => { for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; c.lineTo(Math.cos(a) * 15, Math.sin(a) * 15); c.lineTo(Math.cos(a + 0.26) * 12, Math.sin(a + 0.26) * 12); } c.closePath(); }, 2);
    mP(c, '#e8ecf2', () => c.arc(0, 0, 7, 0, TAU), 1.6); c.fillStyle = '#f2c230'; c.fillRect(-7, -1, 14, 2);
  },
  falcon(c, s, t) {
    const b = Math.sin(t * 3) * 3; c.translate(0, b);
    if (mechFrame(c, 'falcon', s.job ? cyc(t, 8, ['cling', 'dive']) : s.fireFx > game.t ? (s.form === 'g2' ? 'laser' : 'charge') : cyc(t, 9, ['flapU', 'idle', 'flapD', 'idle']))) return;
    c.save(); c.scale(1.6, 1.6); MECH_LOOK.g3(c, { ...s, stuck: false, tgt: null }, t); c.restore();
  },
  emgen(c, s, t) { mP(c, '#5a6378', () => c.rect(-8, -30, 16, 26)); mP(c, '#5ab8ff', () => c.arc(0, -34, 6, 0, TAU), 1.6); },
  bolt(c, s, t) {
    const ph = s.phase || 'drop', f = ph === 'drop' ? 'land' : ph === 'mx2' ? 'mx2' : ph === 'rifle' ? (s.fireFx > game.t ? 'rifle2' : 'rifle1') : ph === 'blade' ? cyc(t, 6, ['blade1', 'blade2']) : ph === 'charge' ? 'charge' : 'idle';
    if (mechFrame(c, 'bolt', f)) return;
    c.save(); c.scale(0.95, 0.95); MECH_LOOK.g0(c, { ...s, phase: ph === 'rifle' ? 'gat' : ph === 'blade' ? 'laser' : 'idle', lifeT: 2, life: 9 }, t); c.restore();
  },
  g0(c, s, t) {
    const k = clamp(s.lifeT / 0.6, 0, 1), sc = 0.4 + 0.6 * easeOutBack(k), fin = s.life - s.lifeT;
    c.globalAlpha *= clamp(fin / 0.4, 0, 1) * Math.min(1, k * 2);
    const ph = s.phase || 'build', f = ph === 'gat' ? cyc(t, 24, ['gat1', 'gat2']) : ph === 'mis' ? 'missile' : ph === 'laser' ? 'laser' : ph === 'end' ? 'kneel' : k < 1 ? 'recoil' : 'idle';
    c.scale(sc, sc);
    if (mechFrame(c, 'g0', f)) return;
    const bob = Math.sin(t * 2) * 2; c.translate(0, bob);
    // 腿
    mP(c, '#4a5266', () => c.rect(-26, -46, 16, 46)); mP(c, '#4a5266', () => c.rect(8, -46, 16, 46));
    mP(c, '#2a2f3c', () => c.rect(-30, -8, 22, 8)); mP(c, '#2a2f3c', () => c.rect(4, -8, 24, 8));
    // 躯干
    mP(c, '#8a96ae', () => { c.moveTo(-36, -120); c.lineTo(34, -120); c.lineTo(40, -60); c.lineTo(-38, -58); c.closePath(); });
    mP(c, '#f2c230', () => c.rect(-30, -112, 12, 44), 1.8);
    mP(c, '#232833', () => c.arc(8, -92, 14, 0, TAU));
    const core = ph === 'laser' ? 1 : 0.5 + 0.3 * Math.sin(t * 6); c.fillStyle = '#ff6a5a'; c.beginPath(); c.arc(8, -92, 8, 0, TAU); c.fill(); mGlow(c, 8, -92, 24 + core * 20, '#ff8a6a', core);
    // 头
    mP(c, '#aeb8cc', () => c.rect(-10, -142, 26, 22)); mP(c, '#ff4a3a', () => c.rect(2, -136, 12, 5), 1.4);
    // 肩上导弹舱
    mP(c, '#6b778f', () => c.rect(-44, -138, 26, 22)); for (let i = 0; i < 3; i++) { c.fillStyle = '#c83a2a'; c.beginPath(); c.arc(-38 + i * 8, -127, 3, 0, TAU); c.fill(); }
    // 右臂格林机枪
    c.save(); c.translate(34, -104); c.rotate(ph === 'gat' ? Math.sin(t * 40) * 0.03 : 0.1);
    mP(c, '#4a5266', () => c.rect(0, -8, 22, 18)); mP(c, '#232833', () => c.rect(20, -6, 34, 14));
    for (let i = 0; i < 3; i++) { c.fillStyle = '#8a96ae'; c.fillRect(22, -5 + i * 4.5 + ((t * 60) % 4.5) * (ph === 'gat' ? 1 : 0), 32, 2); }
    if (ph === 'gat' && Math.floor(t * 30) % 2) mGlow(c, 60, 1, 18, '#fff0c0');
    c.restore();
  },
};

/* ---- 爆炸 / 伤害小工具 ---- */
function mechBoomFx(x, y, s, elem) {
  if (elem === 'light') { cam.shake = Math.max(cam.shake, 6 * s); sfx.boom(s); fxSpr('explosion', x, y, 20 * s, { w: 150 * s, dur: 0.5, col: '#bfe8ff', grow: [0.5, 1.1] }); fxBurst(x, y, 30 * s, 130 * s, '#fff6c0'); fxShock(x, y, 110 * s, '#bfe8ff'); fxDust(x, y, 6, 20 * s); }
  else meteorImpact({ x, y }, s);
}
// 机器人本身的范围爆炸（summonArea：按主人面板结算；s.mul 已经包含召出时的倍率）
function mechBlast(s, x, y, r, dmg, o = {}) {
  const el = o.elem === undefined ? null : o.elem;
  mechBoomFx(x, y, o.big || r / 140, el);
  return summonArea(s, x, y, r, { dmg, type: 'mag', elem: el, launch: o.launch ?? 320, knock: o.knock ?? 110, hs: o.hs ?? 0.06, snd: 'fire', col: MECH_COL[el || 'none'], downHit: o.downHit !== false, stun: o.stun, big: o.bigHit }, { zMax: o.zMax ?? 150 });
}
// 从机器人发出的子弹（spawnProj 的 owner 是机器人：伤害按它读到的主人面板）
function mechShot(s, o) {
  const face = o.face || s.face, img = fxTint(o.img || 'orb', o.col || '#fff0a0'), sp = o.speed || 800;
  const tx = o.tx ?? s.x + face * 400, ty = o.ty ?? s.y, dx = tx - s.x, dy = (ty - s.y) * 1.6, L = Math.hypot(dx, dy) || 1;
  return spawnProj({ owner: s, x: s.x + face * (o.dx ?? 16), y: s.y, z: o.z ?? 40, vx: dx / L * sp, vy: dy / L * sp / 1.6, face: Math.sign(dx) || face, life: o.life || 0.6, w: o.bw || 8, d: o.bd || 12, h: o.bh || 16, pierce: !!o.pierce, shadow: 0,
    hit: { type: 'mag', stun: 0.25, knock: 20, hs: 0.02, snd: 'blunt', col: o.col, ...o.hit }, mul: s.mul, onHitT: o.onHitT, onEnd: o.onEnd,
    update: o.update,
    draw(c, pr) { const X = sx(pr.x), Y = sy(pr.y, pr.z); if (o.tracer) { c.save(); c.globalCompositeOperation = 'lighter'; c.strokeStyle = o.col || '#fff0a0'; c.lineWidth = o.tracer; c.globalAlpha = 0.9; c.beginPath(); c.moveTo(X, Y); c.lineTo(X - pr.vx * 0.03, Y - pr.vy * 0.03 * GR); c.stroke(); c.restore(); } else drawSpr(c, img, X, Y, o.size || 18, o.size || 18, { rot: pr.t * 10 }); } });
}
// 一条直线上的敌人（电磁波 / 激光）
function lineFoes(p, x, y, face, len, hw = 40) { const L = []; for (const t of ents) if (foe(p, t) && t.invul <= 0 && (t.x - x) * face > -20 && Math.abs(t.x - x) < len && Math.abs(t.y - y) < hw) L.push(t); return L; }

/* =====================================================================
   RX-78 追击者（基础技能 g_rx78 的实现，所有转职共用）/ 银色破坏者（空投支援）
   ===================================================================== */
function runnerAI(s, dt) {
  const o = s.owner, sp = s.baseSpd * robSpd(o);
  if (s.rush) {   // 机械引爆的冲锋：无敌 + 霸体，冲到准星自爆
    const R = s.rush, dx = R.x - s.x, dy = R.y - s.y, d = Math.hypot(dx, dy * 1.6);
    if (d < 14) { runnerBoom(s, R.mul); return; }
    const v = 620; s.vx = dx / d * v; s.vy = dy / d * v * 0.6; s.face = dx >= 0 ? 1 : -1; s.setState('run'); if (Math.random() < 0.5) fxDust(s.x - s.face * 8, s.y, 1, 3);
    return;
  }
  if (mechHeld(s)) { s.vx = s.vy = 0; s.setState('idle'); return; }
  const t = nearestFoe(s, 620, e => e.invul <= 0 || e.st === 'down');
  if (t) {
    const dx = t.x - s.x, dy = t.y - s.y;
    if (Math.abs(dx) < t.w + 14 && Math.abs(dy) < 16) { runnerBoom(s, 1); return; }
    const d = Math.hypot(dx, dy * 1.4) || 1; s.vx = dx / d * sp; s.vy = dy / d * sp * 0.75; s.face = dx >= 0 ? 1 : -1; s.setState('walk');
    if (Math.random() < 0.25) fxDust(s.x - s.face * 8, s.y, 1, 3);
  } else { const gx = s.x + s.face * 40; s.vx = s.face * sp * 0.35; s.vy = 0; if (game.room && (gx < game.room.x0 + 30 || gx > game.room.x1 - 30)) s.face = -s.face; s.setState('walk'); }
}
function runnerBoom(s, mul = 1, fromEnd) {
  if (s.boomed || (s.gone && !fromEnd)) return; s.boomed = true;
  const o = s.owner, el = mElem(o, 'fire'), big = s.skey === 'mech_buster';
  mechBlast(s, s.x, s.y, big ? 85 : 70, s.base * mul * mechMul(o), { elem: el, big: big ? 0.6 : 0.45, launch: 320, knock: 120 });
  if (!fromEnd) dismissOne(s, 'boom');
}
const RUNNER = { kind: 'follower', over: 'oldest', keepRoom: false, w: 12, d: 11, h: 34, shadowR: 11, type: 'mag', model: () => MECH_NULL, ai: runnerAI };
defSummon('mech_rx78', { ...RUNNER, tags: ['mech', 'det', 'runner'], max: 12, life: 7.5,
  onSpawn: s => { mechSpawn(s, 'rx78', { puff: false }); s.baseSpd = 175; },
  onEnd: (s, why) => { if (why === 'life') runnerBoom(s, s.rushMul || 1, true); } });
defSummon('mech_buster', { ...RUNNER, tags: ['mech', 'runner'], max: 24, life: 5, w: 13, h: 36,
  onSpawn: s => { mechSpawn(s, 'buster', { puff: false }); s.baseSpd = 300; },
  onEnd: (s, why) => { if (why === 'life') runnerBoom(s, 1, true); } });
// 所有转职的 RX-78 都从这里出（gunner.js 的 rx78() 转到这里）；o.mul / o.life 照旧
function mechRx78(e, lv, o = {}) {
  const s = summon(e, 'mech_rx78', { lv, mul: o.mul || 1, life: o.life, x: o.x ?? e.x + e.face * 26, y: o.y ?? e.y });
  if (s) s.base = MECH_DMG.rx78(lv);
  // 危机追击者：放 RX-78 时有 lv% 几率多放一个
  const bl = skLv(e, 'gm_backup'); if (s && !o.extra && bl && Math.random() < 0.01 * bl) mechRx78(e, lv, { ...o, extra: true, y: e.y + rnd(-16, 16) });
  return s;
}

/* =====================================================================
   EZ-8 自爆者：原地放置的定时炸弹（3 秒），按住技能键蓄力延长引信（官方：只有机械师能学）
   ===================================================================== */
function ezAI(s, dt) {
  if (s.leap) {   // 机械引爆：弹起来跳到准星处爆炸
    const L = s.leap; L.t += dt; const k = clamp(L.t / L.T, 0, 1);
    s.x = lerp(L.x0, L.x1, k); s.y = lerp(L.y0, L.y1, k); s.hz = Math.sin(k * Math.PI) * 90; s.vx = s.vy = 0;
    if (k >= 1) { s.hz = 0; ezBoom(s, L.mul); }
    return;
  }
  s.vx = s.vy = 0;
  if (Math.floor(s.lifeT * 2) !== s.beepN) { s.beepN = Math.floor(s.lifeT * 2); if (isHuman(s.owner) && s.life - s.lifeT < 2.2) sfx.beep(0.6); }
}
function ezBoom(s, mul = 1, fromEnd) {
  if (s.boomed || (s.gone && !fromEnd)) return; s.boomed = true;
  const o = s.owner; mechBlast(s, s.x, s.y, 100, s.base * mul * mechMul(o), { elem: mElem(o, 'fire'), big: 0.8, launch: 380, knock: 150, bigHit: 1.4 });
  if (!fromEnd) dismissOne(s, 'boom');
}
defSummon('mech_ez8', { kind: 'follower', tags: ['mech', 'det'], max: 5, over: 'oldest', keepRoom: false, life: 3, w: 14, d: 12, h: 40, speed: 0, shadowR: 14, type: 'mag', noHold: true,
  model: () => MECH_NULL, onSpawn: s => mechSpawn(s, 'ez8'), ai: ezAI, onEnd: (s, why) => { if (why === 'life') ezBoom(s, 1, true); } });
defSkill('gm_ez8', { name: 'EZ-8 自爆者', cls: 'gun', job: MC, lvReq: 15, sp: 20, mp: 35, cd: 7.5, type: 'mag', elem: 'fire', col: '#c8502a',
  desc: '在面前放下定时自爆机器人 EZ-8，3 秒后原地爆炸，炸飞周围的敌人（火属性魔法伤害；学了电能转换后是光属性）。按住技能键可以蓄力，蓄得越久引信越长（最多再延长数秒），方便配合机械引爆。',
  pow: lv => MECH_DMG.ez8(lv), infoExtra: lv => [['基础引信', '3 秒'], ['按住最多延长', MECH_DMG.ez8Delay(lv).toFixed(1) + ' 秒']], ai: { kind: 'aoe', r: [0, 120], dy: 30, summon: 'mech_ez8' },
  act: (lv) => ({ name: 'gm_ez8', clip: mclip('mSet'), dur: 0.36, noCounter: true,
    charge: { at: 0.12, max: MECH_DMG.ez8Delay(lv), min: 0, dmg: 0, update: (e, dt, k) => { if (Math.random() < 0.3) fxCharge(e, '#ff9a5a'); } },
    events: [evAt(0.16, e => { const k = e.act.chargeK || 0, s = summon(e, 'mech_ez8', { lv, x: e.x + e.face * 34, y: e.y, life: 3 + k * MECH_DMG.ez8Delay(lv) });
      if (s) s.base = MECH_DMG.ez8(lv); sfx.mech(); })] }) });

/* =====================================================================
   机械改良（开关，持续耗 MP）/ 机械引爆 / 机械指令
   ===================================================================== */
defSkill('gm_robotics', { name: '机械改良', cls: 'gun', job: MC, lvReq: 15, mp: 30, cd: 5, type: 'mag', buff: true, col: '#5a8ad8',
  desc: '【开关】给我方的机器人加装改良部件：自己的技能攻击力提高、机器人的移动速度大幅提高。开启期间每秒消耗少量 MP，MP 不足时自动关闭。再放一次关闭。',
  infoExtra: lv => [['技能攻击力', '+' + pct(0.09 + 0.02 * (lv - 1))], ['机器人移速', '+' + pct(0.62 + 0.04 * (lv - 1))], ['开启时每秒 MP', String(1 + 0.5 * (lv - 1))]], ai: { kind: 'buff' },
  act: (lv) => ({ name: 'gm_robotics', clip: mclip('mRemote'), dur: 0.5, noCounter: true,
    onStart: e => { const on = toggleBuff(e, 'gm_robotics', 1e9, { lv, dmg: 0.09 + 0.02 * (lv - 1), drain: 1 + 0.5 * (lv - 1) }); if (on) { sfx.buff(); fxAura(e, '#8fc0ff'); for (const s of summonsOf(e, { tag: 'mech' })) fxBurst(s.x, s.y, 30 + (s.hz || 0), 50, '#8fc0ff'); } } }) });
// 机械引爆：点按 = 就地引爆范围内的 RX-78 / EZ-8（和拦截机）；按住 = 出准星，方向键移动，松开后 RX-78 霸体冲过去、EZ-8 弹跳过去自爆
const detRange = lv => 365 + 60 * (Math.min(lv, 5) - 1);
const detMul = lv => 1.32 + 0.02 * (Math.min(lv, 5) - 1);
const detTargets = (e, lv) => summonsOf(e, { tag: 'det' }).filter(s => Math.abs(s.x - e.x) < detRange(lv) && !s.boomed);
function detonateNow(e, lv) {
  const L = detTargets(e, lv); let n = 0;
  for (const s of L) { n++; game.after(n * 0.04, () => { if (s.gone) return; if (s.skey === 'mech_ez8') ezBoom(s, detMul(lv)); else runnerBoom(s, detMul(lv)); }); }
  sparrowDive(e, detRange(lv));
  return n;
}
function detonateAt(e, lv, P) {
  for (const s of detTargets(e, lv)) {
    if (s.skey === 'mech_ez8') s.leap = { x0: s.x, y0: s.y, x1: P.x + rnd(-10, 10), y1: clamp(P.y + rnd(-6, 6), 4, DEPTH - 4), t: 0, T: 0.55, mul: detMul(lv) };
    else { s.rush = { x: P.x + rnd(-8, 8), y: P.y + rnd(-5, 5), mul: detMul(lv) }; s.rushMul = detMul(lv); s.superArmor = 99; s.life = Math.max(s.life, s.lifeT + 3); }
  }
  sparrowDive(e, detRange(lv));
}
defSkill('gm_detonate', { name: '机械引爆', cls: 'gun', job: MC, lvReq: 15, maxLv: 5, mp: 10, cd: 3.5, type: 'mag', col: '#d8603a',
  desc: '按下遥控器，引爆范围内所有的 RX-78 追击者和 EZ-8 自爆者（拦截机会冲向等级最高的敌人自爆），爆炸伤害提高。按住技能键会出现准星，用方向键移动，松开后 RX-78 带着霸体冲向准星、EZ-8 弹跳过去，一起在准星处爆炸。',
  infoExtra: lv => [['遥控范围', detRange(lv) + ' px'], ['爆炸伤害', pct(detMul(lv))]], ai: { kind: 'aoe', r: [0, 300], dy: 60 },
  act: (lv) => ({ name: 'gm_detonate', clip: mclip('mRemote'), dur: 0.4, noCounter: true,
    update: (e, dt) => { const a = e.act, held = !!(e.pad && a.key && e.pad.is(a.key));
      if (!a.aim && !a.fired && e.actT >= 0.14) {
        if (held && detTargets(e, lv).length) { a.aim = { x: e.x + e.face * 220, y: e.y }; a.dur = 3.4; sfx.beep();
          a.ret = addFx({ x: a.aim.x, y: a.aim.y, z: 0, dur: 4, a, draw(c) { const A = this.a.aim; if (!A || this.a.fired) { this.t = this.dur; return; } const X = sx(A.x), Y = sy(A.y, 0), r = 26 + Math.sin(game.t * 10) * 3;
            c.save(); c.globalCompositeOperation = 'lighter'; c.strokeStyle = '#ff5a3a'; c.lineWidth = 2.5; c.beginPath(); c.ellipse(X, Y, r, r * GR, 0, 0, TAU); c.stroke();
            c.beginPath(); for (const q of [0, 1, 2, 3]) { const an = q * Math.PI / 2 + game.t * 2; c.moveTo(X + Math.cos(an) * r * 0.5, Y + Math.sin(an) * r * 0.5 * GR); c.lineTo(X + Math.cos(an) * r * 1.3, Y + Math.sin(an) * r * 1.3 * GR); } c.stroke(); c.restore(); } }); }
        else { a.fired = true; detonateNow(e, lv); sfx.beep(1.2); }
      }
      if (a.aim && !a.fired) {
        const I = e.pad; a.aim.x = clamp(a.aim.x + I.dx() * 420 * dt, e.x - detRange(lv), e.x + detRange(lv)); a.aim.y = clamp(a.aim.y + I.dy() * 200 * dt, 6, DEPTH - 6); e.vx = e.vy = 0;
        if (I.dx()) e.face = e.face;   // 瞄准时不转身
        if (!held || e.actT > 3.2) { a.fired = true; detonateAt(e, lv, a.aim); a.dur = e.actT + 0.2; sfx.beep(1.2); }
      } },
    onInput: (e, I) => !!(e.act && e.act.aim && !e.act.fired) }) });
// 机械指令：禁止已放出的机器人攻击（G-2 旋雷者和觉醒不受影响）
defSkill('gm_hold', { name: '机械指令', cls: 'gun', job: MC, lvReq: 18, maxLv: 1, sp: 0, mp: 0, cd: 1, type: 'mag', col: '#6a7a8a',
  desc: '【开关】命令已经放出的机器人停火待命（RX-78 原地待命、EZ-8 照常计时），再放一次恢复攻击。G-2 旋雷者和觉醒技能不受影响。',
  act: () => ({ name: 'gm_hold', clip: mclip('mRemote'), dur: 0.3, noCounter: true,
    onStart: e => { e.mechHold = !e.mechHold; sfx.beep(); fxText(e.mechHold ? '机器人：停火' : '机器人：攻击', e.x, e.y, e.z + 20, { col: e.mechHold ? '#9fd8ff' : '#ffd070', size: 12, dur: 1 }); } }) });

/* =====================================================================
   G 系列：G-1 科罗纳 ↔ G-2 旋雷者 ↔ G-3 捕食者（共用持续时间与改装冷却）
   ===================================================================== */
const GS_Q = { tag: 'gs' };
const gsUnits = p => summonsOf(p, GS_Q);
const gsForm = p => { const u = gsUnits(p)[0]; return u ? u.skey.slice(5) : null; };   // 'mech_g2' → 'g2'
const gsLeft = p => { let m = 0; for (const u of gsUnits(p)) m = Math.max(m, u.life - u.lifeT); return m; };
const tfCd = p => gextLv(p) ? 0 : GS_TF_CD;
const tfReady = p => !(p.gsTfT > game.t);
const gsState = p => p.gs || (p.gs = { stacks: 0, chg: 0, g3on: false });
// G-X 主宰者（二觉被动）：改装不再有施法动作、G 系列强化、Buff On!
const hasGop = p => skLv(p, 'gm_gop') > 0;
const gsCount = (p, form) => form === 'g1' ? 1 : form === 'g2' ? 3 + (hasGop(p) ? 1 : 0) : 6 + (hasGop(p) ? 1 : 0);
function buffOn(p) {
  const lv = skLv(p, 'gm_gop'); if (!lv) return;
  const had = p.buffs.gm_gop; p.buffs.gm_gop = { t: 30, dmg: 0.10 + 0.02 * (lv - 1), name: 'Buff On!', col: '#ff8ad8' };
  if (!had && isHuman(p)) { fxText('Buff On!', p.x, p.y, p.z + 40, { col: '#ff9ae0', size: 15, dur: 1.2 }); sfx.buff(); }
}
// G 系列的伤害倍率：另外两种形态的技能等级互相加成（官方：G-1 等级提高 G-2 / G-3 攻击力……）× 机器人倍率；电能转换不加成 G 系列（从主人的 dmg 加成里扣掉）
function gsMul(p, form) {
  let o = 0; for (const f of ['g1', 'g2', 'g3']) if (f !== form) o += skLv(p, 'gm_' + f);
  const B = 1 + buffVal(p, 'dmg'), cv = (p.buffs && p.buffs.gm_convert && p.buffs.gm_convert.dmg) || 0;
  return (1 + 0.04 * o) * mechMul(p) * (B - cv) / B;
}
function gsSpawn(p, form, life, from) {
  const n = gsCount(p, form), lv = skLv(p, 'gm_' + form) || 1;
  for (let i = 0; i < n; i++) { const f = from && from.length ? from[i % from.length] : null;
    const s = summon(p, 'mech_' + form, { lv, life, x: f ? f.x : p.x - p.face * 46, y: f ? f.y : p.y }); if (s) { s.idx = i; s.n = n; s.hz = f ? f.hz : 60; } }
}
// 改装：换成另一种形态，剩余时间 +10 秒（不超过基础持续 20 秒）；学了 G 系扩张后改装冷却为 0 并叠层
function gsTransform(p, form, o = {}) {
  const G = gsState(p), left = gsLeft(p), from = gsUnits(p).map(u => ({ x: u.x, y: u.y, hz: u.hz || 40 }));
  dismissSummons(p, GS_Q, 'tf');
  const life = Math.min(GS_BASE, left + GS_BONUS);
  gsSpawn(p, form, life, from);
  if (!o.free) { p.gsTfT = game.t + tfCd(p); for (const id of ['gm_g2', 'gm_g3']) p.cool[id] = Math.max(p.cool[id] || 0, tfCd(p)); }
  if (gextLv(p)) G.stacks = Math.min(5, (G.stacks || 0) + 1);
  if (form !== 'g3') G.g3on = false;
  buffOn(p);
  sfx.mech(1.2); for (const u of gsUnits(p)) { fxBurst(u.x, u.y, 30 + (u.hz || 0), 70, '#fff0a0'); }
  if (isHuman(p)) fxText({ g1: 'G-1 科罗纳', g2: 'G-2 旋雷者', g3: 'G-3 捕食者' }[form], p.x, p.y, p.z + 26, { col: '#ffe080', size: 11, dur: 0.8 });
}
const gsTfAct = form => ({ name: 'gm_' + form, clip: mclip('mRemote'), dur: 0.4, noCounter: true, events: [evAt(0.12, e => gsTransform(e, form))] });
const tinyAct = id => ({ name: id, clip: mclip('mRemote'), dur: 0.12, noCounter: true });
// G-X 主宰者：改装走“再按技能键”分支（和普通施放一样扣 MP）：正在做别的动作时无动作、不打断；空闲时播 0.12 秒的按遥控器动作
function gopTransform(p, form) {
  const S = SKILLS['gm_' + form], mp = S.mp;
  if (p.mp < mp) { if (isHuman(p)) fxText('MP不足', p.x, p.y, p.z + 20, { col: '#9fd8ff', size: 10, dur: 0.5 }); }
  else { p.mp -= mp; gsTransform(p, form); }
  return tinyAct('gm_' + form);
}
// 有 G 系列时，另两种形态的技能键 = 改装；同一形态的键 = 再按（recast）
const gsReq = form => p => { const f = gsForm(p); if (!f) return form === 'g1' ? true : '需要先放出 G-1 科罗纳'; if (f === form) return true; return tfReady(p) || '改装冷却中'; };
const G_FOLLOW = { kind: 'follower', tags: ['mech', 'gs'], keepRoom: true, enterAt: 'behind', life: GS_BASE, speed: 0, w: 10, d: 10, h: 30, shadowR: 7, type: 'mag', model: () => MECH_NULL };

/* ---- G-1 科罗纳：身后的浮空炮台，每 0.8 秒向最近的敌人射一发光属性魔法弹（带硬直），连按技能键加快射速 ---- */
function g1Target(s) { const o = s.owner; let best = null, bd = 1e9; for (const t of ents) if (foe(o, t) && t.invul <= 0 && t.st !== 'down' && Math.abs(t.x - s.x) < 560 && Math.abs(t.y - s.y) < 130) { const d = Math.abs(t.x - s.x) + Math.abs(t.y - s.y) * 2 - ((t.x - o.x) * o.face > 0 ? 80 : 0); if (d < bd) { bd = d; best = t; } } return best; }
function g1Fire(s, t, big) {
  const o = s.owner, lv = s.lv, dmg = MECH_DMG.g1(lv) * gsMul(o, 'g1') * (big ? 2.2 : 1);
  s.fireFx = game.t + 0.12; s.face = t ? (t.x >= s.x ? 1 : -1) : o.face; if (isHuman(o)) sfx.zap ? sfx.zap() : sfx.gun(0.4);
  mechShot(s, { tx: t ? t.x : undefined, ty: t ? t.y : undefined, z: (s.hz || 60) - 4, speed: 760, life: 0.9, size: big ? 26 : 18, col: '#fff0a0', dx: 22,
    hit: { dmg: dmg * 0.7, elem: 'light', stun: 0.32 * (1 + 0.04 * (lv - 1)), knock: 20, hs: 0.025, snd: 'crit', onHit: () => { const G = gsState(o); G.g1hits = (G.g1hits || 0) + 1; if (G.g1hits % 10 === 0) buffOn(o); } },
    onEnd: pr => { fxBurst(pr.x, pr.y, pr.z, 44, '#fff0a0'); summonArea(s, pr.x, pr.y, big ? 50 : 34, { dmg: dmg * 0.3, type: 'mag', elem: 'light', stun: 0.2, knock: 10, hs: 0.01, col: '#fff0a0' }, { zMax: 140 }); } });
}
function g1AI(s, dt) {
  const o = s.owner, gx = o.x - o.face * 46, gy = clamp(o.y - 4, 4, DEPTH - 4);
  s.x = damp(s.x, gx, 7, dt); s.y = damp(s.y, gy, 7, dt); s.vx = s.vy = 0; s.hz = damp(s.hz || 60, 60, 5, dt);
  if (!s.fireFx || s.fireFx < game.t - 0.4) s.face = o.face;
  if (mechHeld(s)) return;
  s.fireT = (s.fireT ?? 0.35) - dt;
  if (s.fireT <= 0) { const t = g1Target(s); if (t) { g1Fire(s, t); s.fireT = hasGop(o) ? 0.7 : 0.8; } else s.fireT = 0.15; }
}
defSummon('mech_g1', { ...G_FOLLOW, max: 1, onSpawn: s => mechSpawn(s, 'g1', { hz: 60 }), ai: g1AI });
defSummon('mech_g1t', { ...G_FOLLOW, tags: ['mech'], keepRoom: false, max: 1, life: 1.2, onSpawn: s => mechSpawn(s, 'g1', { hz: 60 }), ai: (s, dt) => { s.hz = 60; s.vx = s.vy = 0; } });   // G-磁力弹借用的临时科罗纳
// 连按：科罗纳立刻补射一发（最短 0.3 秒一发）
function g1Rapid(p) {
  const s = summonsOf(p, 'mech_g1')[0];
  if (s && !mechHeld(s) && !(s.rapidT > game.t)) { s.rapidT = game.t + 0.3; g1Fire(s, g1Target(s)); s.fireT = Math.max(s.fireT || 0, 0.3); }
  return tinyAct('gm_g1');
}
defSkill('gm_g1', { name: 'G-1 科罗纳', cls: 'gun', job: MC, lvReq: 16, mp: 40, cd: 20, type: 'mag', elem: 'light', col: '#e8c84a',
  desc: '在身后放出浮空辅助机器人科罗纳，跟着你移动，每隔一段时间向敌人发射光属性魔法弹（命中使敌人硬直）。科罗纳在场时再按技能键会立刻补射一发（最快 0.3 秒一发）。持续 20 秒；在场时可以改装成 G-2 旋雷者 / G-3 捕食者，每次改装持续时间 +10 秒（不超过 20 秒）。本技能等级也提高旋雷者、捕食者的攻击力。',
  pow: lv => MECH_DMG.g1(lv) * 25, infoExtra: lv => [['持续', GS_BASE + ' 秒'], ['自动射击间隔', '0.8 秒'], ['G-2 / G-3 攻击力', '+' + pct(0.04 * lv)]], ai: { kind: 'proj', r: [0, 520], dy: 120, summon: 'mech_g1' },
  req: gsReq('g1'),
  recast: { ok: p => { const f = gsForm(p); return f === 'g1' || (!!f && tfReady(p)); }, instant: p => gsForm(p) === 'g1' || (hasGop(p) && p.st === 'act'), cd: 0.1, mp: 0,
    act: (lv, p) => gsForm(p) === 'g1' ? g1Rapid(p) : hasGop(p) ? gopTransform(p, 'g1') : (p.mp = Math.max(0, p.mp - SKILLS.gm_g1.mp), gsTfAct('g1')) },
  act: () => ({ name: 'gm_g1', clip: mclip('mCall'), dur: 0.5, noCounter: true,
    events: [evAt(0.2, e => { dismissSummons(e, GS_Q, 'tf'); const G = gsState(e); G.stacks = 0; G.g3on = false; gsSpawn(e, 'g1', GS_BASE); sfx.mech(1.2); })] }) });

/* ---- G-2 旋雷者 ×3：环绕自己的静电场（充满电时每秒一跳），充满后再按技能键向前发射电磁波 ---- */
const G2_CHARGE = 1.5;
function g2AI(s, dt) {
  const o = s.owner, a = game.t * 2.4 * (hasGop(o) ? 1.5 : 1) + s.idx * TAU / (s.n || 3);
  s.x = damp(s.x, o.x + Math.cos(a) * 58, 10, dt); s.y = damp(s.y, clamp(o.y + Math.sin(a) * 20, 4, DEPTH - 4), 10, dt); s.vx = s.vy = 0; s.face = o.face; s.hz = damp(s.hz || 40, 38, 5, dt);
  const G = gsState(o); if (!(G.chg >= 1)) return;
  s.fieldT = (s.fieldT ?? s.idx * 0.33) - dt;
  if (s.fieldT <= 0) { s.fieldT = 1;
    const n = summonArea(s, s.x, s.y, 52, { dmg: MECH_DMG.g2Field(s.lv) * gsMul(o, 'g2'), type: 'mag', elem: 'light', stun: 0.25, knock: 10, hs: 0.015, col: '#9fd8ff', snd: 'crit', downHit: true }, { zMax: 110 });
    if (n) fxSpr('spark', s.x, s.y, s.hz || 38, { w: 70, dur: 0.25, col: '#9fd8ff' }); }
}
function g2Wave(p) {
  const G = gsState(p), U = summonsOf(p, 'mech_g2');
  if (!(G.chg >= 1)) { if (isHuman(p)) fxText('充电中', p.x, p.y, p.z + 20, { col: '#9fd8ff', size: 10, dur: 0.5 }); }
  else {
    G.chg = 0; sfx.zap ? sfx.zap() : sfx.iai(); sfx.boom(0.3); buffOn(p);
    for (const s of U) {
      const dmg = MECH_DMG.g2Wave(s.lv) * gsMul(p, 'g2');
      spawnProj({ owner: s, x: s.x + p.face * 10, y: s.y, z: 10, vx: p.face * 560, face: p.face, life: 0.85, w: 18, d: 22 + (hasSkill(p, 'gm_micro') ? 12 * U.length : 0), h: 100, pierce: true, mul: s.mul,
        hit: { dmg, type: 'mag', elem: 'light', stun: 0.45, knock: 60, airLift: 140, hs: 0.04, snd: 'crit', col: '#bfe8ff', max: 1 },
        draw(c, pr) { const k = pr.t / pr.life; drawSpr(c, fxTint('wave', '#9fd8ff'), sx(pr.x), sy(pr.y, pr.z + 40), 60, 100, { flip: pr.face < 0, alpha: 1 - k * k }); } });
      fxBurst(s.x, s.y, (s.hz || 38), 60, '#bfe8ff');
    }
  }
  return tinyAct('gm_g2');
}
defSummon('mech_g2', { ...G_FOLLOW, max: 4, noHold: true, onSpawn: s => mechSpawn(s, 'g2', { hz: 38, puff: false }), ai: g2AI });
defSkill('gm_g2', { name: '改装：G-2 旋雷者', cls: 'gun', job: MC, lvReq: 17, mp: 45, cd: GS_TF_CD, type: 'mag', elem: 'light', col: '#5ab8ff', pre: { gm_g1: 2 },
  desc: '把在场的科罗纳 / 捕食者改装成 3 台环绕自己的旋雷者。旋雷者每 1.5 秒充满一次电，充满电时静电场每秒电击周围的敌人；充满后再按技能键，3 台一起向前发射电磁波。和 G-1 共用持续时间，改装冷却 5 秒；不受机械指令影响。本技能等级也提高科罗纳、捕食者的攻击力。',
  pow: lv => MECH_DMG.g2Wave(lv) * 3, infoExtra: lv => [['充电', G2_CHARGE + ' 秒'], ['静电场（每台每秒）', pct(MECH_DMG.g2Field(lv))], ['G-1 / G-3 攻击力', '+' + pct(0.04 * lv)]], ai: { kind: 'burst', r: [0, 420], dy: 40 },
  req: gsReq('g2'),
  recast: { ok: p => gsForm(p) === 'g2' || (hasGop(p) && !!gsForm(p) && tfReady(p)), instant: p => gsForm(p) === 'g2' || p.st === 'act', cd: 0.2, mp: 0, act: (lv, p) => gsForm(p) === 'g2' ? g2Wave(p) : gopTransform(p, 'g2') },
  act: () => gsTfAct('g2') });

/* ---- G-3 捕食者 ×6：在身边待命；再按技能键缠到范围内（500 px）等级最高的敌人身上持续电击（每 0.5 秒），再按一次召回 ---- */
function g3Pick(s) {
  const o = s.owner, L = foesNear(o, o.x, o.y, 500, 160).filter(t => t.invul <= 0 || t.st === 'down'); if (!L.length) return null;
  const cnt = new Map(); for (const u of summonsOf(o, 'mech_g3')) if (u !== s && u.tgt) cnt.set(u.tgt, (cnt.get(u.tgt) || 0) + 1);
  const cap = hasGop(o) ? 4 : 2;   // 同一个敌人身上最多缠几台（官方 2；G-X 主宰者 +2）
  const ok = L.filter(t => (cnt.get(t) || 0) < cap); if (!ok.length) return null;
  ok.sort((a, b) => (cnt.get(a) || 0) - (cnt.get(b) || 0) || foeGrade(b) - foeGrade(a));
  return ok[0];
}
function g3AI(s, dt) {
  const o = s.owner, G = gsState(o);
  if (G.g3on && !mechHeld(s)) {
    let t = s.tgt; if (!t || t.dead || t.remove || Math.abs(t.x - o.x) > 560) { t = s.tgt = g3Pick(s); s.stuck = false; }
    if (t) {
      const ox = ((s.idx % 3) - 1) * 9, tx = t.x + ox, ty = t.y + 0.6, th = t.z + t.hurtH() * 0.75;
      const dx = tx - s.x, dy = ty - s.y, d = Math.hypot(dx, dy * 1.4);
      if (d > 10) { const v = Math.min(d / dt, 520 * robSpd(o)); s.x += dx / d * v * dt; s.y += dy / d * v * dt * 0.8; s.face = dx >= 0 ? 1 : -1; s.stuck = false; }
      else { s.x = tx; s.y = ty; s.stuck = true; }
      s.hz = damp(s.hz || 40, th, 8, dt); s.vx = s.vy = 0;
      if (s.stuck) { s.stuckT = (s.stuckT || 0) + dt; if (s.stuckT >= 1 && !s.buffed) { s.buffed = true; buffOn(o); } s.hitT = (s.hitT ?? 0) - dt; if (s.hitT <= 0) { s.hitT = 0.5; if (summonHit(s, t, { dmg: MECH_DMG.g3(s.lv) * gsMul(o, 'g3'), type: 'mag', elem: 'light', stun: 0.22, knock: 0, hs: 0.01, col: '#fff0a0', snd: 'crit', downHit: true, sure: true })) fxSpr('spark', s.x, s.y, s.hz, { w: 34, dur: 0.18, col: '#fff0a0' }); } }
      return;
    }
  }
  s.tgt = null; s.stuck = false; s.stuckT = 0; s.buffed = false;
  const a = Math.PI * (0.15 + 0.7 * s.idx / Math.max(1, (s.n || 6) - 1)) + Math.sin(game.t * 2 + s.idx) * 0.08, gx = o.x - o.face * Math.cos(a) * 34, gy = clamp(o.y - 2, 4, DEPTH - 4);
  s.x = damp(s.x, gx, 6, dt); s.y = damp(s.y, gy, 6, dt); s.hz = damp(s.hz || 40, 88 + Math.sin(a) * 26, 5, dt); s.vx = s.vy = 0; s.face = o.face;
}
function g3Toggle(p) {
  const G = gsState(p); G.g3on = !G.g3on; sfx.beep();
  if (isHuman(p)) fxText(G.g3on ? '捕食者：缠绕' : '捕食者：召回', p.x, p.y, p.z + 20, { col: '#ffe080', size: 10, dur: 0.6 });
  return tinyAct('gm_g3');
}
defSummon('mech_g3', { ...G_FOLLOW, max: 7, onSpawn: s => mechSpawn(s, 'g3', { hz: 60, puff: false }), ai: g3AI });
defSkill('gm_g3', { name: '改装：G-3 捕食者', cls: 'gun', job: MC, lvReq: 18, mp: 50, cd: GS_TF_CD, type: 'mag', elem: 'light', col: '#e89a3a', pre: { gm_g2: 3 },
  desc: '把在场的科罗纳 / 旋雷者改装成 6 台捕食者，在身边待命。再按技能键，捕食者分头缠到周围（500 px 内）等级最高的敌人身上持续电击（使敌人硬直）；目标倒下会自动找下一个。再按一次召回。和 G-1 共用持续时间，改装冷却 5 秒。本技能等级也提高科罗纳、旋雷者的攻击力。',
  pow: lv => MECH_DMG.g3(lv) * 6 * 2 * 10, infoExtra: lv => [['每台每 0.5 秒', pct(MECH_DMG.g3(lv))], ['缠绕范围', '500 px'], ['G-1 / G-2 攻击力', '+' + pct(0.04 * lv)]], ai: { kind: 'aoe', r: [0, 480], dy: 120 },
  req: gsReq('g3'),
  recast: { ok: p => gsForm(p) === 'g3' || (hasGop(p) && !!gsForm(p) && tfReady(p)), instant: p => gsForm(p) === 'g3' || p.st === 'act', cd: 0.25, mp: 0, act: (lv, p) => gsForm(p) === 'g3' ? g3Toggle(p) : gopTransform(p, 'g3') },
  act: () => gsTfAct('g3') });

/* ---- G-磁力弹：科罗纳射出磁力弹，命中后在地面标记处展开磁场，把敌人吸过去托起（3 秒，每 0.3 秒一段），最后放下打倒 ----
   G-2 / G-3 在场 → 先变回 G-1；没有 G 系列且 G-1 冷却好了 → 顺便放出 G-1（进入冷却）；G-1 冷却中 → 临时的科罗纳射完就走 */
function magnetCast(e, lv) {
  const f = gsForm(e);
  if (f && f !== 'g1') gsTransform(e, 'g1', { free: true });
  else if (!f && skLv(e, 'gm_g1') && !((e.cool.gm_g1 || 0) > 0)) { gsSpawn(e, 'g1', GS_BASE); gsState(e).stacks = 0; e.cool.gm_g1 = SKILLS.gm_g1.cd * (e.cdMul || 1); }
  const c = summonsOf(e, 'mech_g1')[0] || summon(e, 'mech_g1t', { x: e.x - e.face * 40, y: e.y });
  if (!c) return;
  c.face = e.face; c.fireFx = game.t + 0.2; sfx.charge();
  const land = pr => { if (pr.landed) return; pr.landed = true; summon(e, 'mech_magfield', { x: pr.x, y: pr.y, lv }); };
  mechShot(c, { face: e.face, tx: c.x + e.face * 400, ty: e.y, z: 50, speed: 620, life: 0.55, size: 30, col: '#b89aff', dx: 20, hit: { dmg: 0.3, elem: 'light', stun: 0.4, knock: 0, hs: 0.03 },
    onHitT: (pr, t) => { pr.x = t.x; pr.y = t.y; land(pr); pr.t = pr.life; }, onEnd: land });
}
defSummon('mech_magfield', { kind: 'field', r: 110, tick: 0.3, life: 3, tags: ['mech'], type: 'mag', keepRoom: false,
  onSpawn: s => { s.held = new Set(); s.R = hasSkill(s.owner, 'gm_micro') ? 230 : 150; fxShock(s.x, s.y, s.R * 0.8, '#b89aff'); sfx.boom(0.4); },
  update: (s, dt) => {
    const o = s.owner;
    for (const t of ents) { if (!foe(o, t) || t.dead || !inGround(t, s.x, s.y, s.R)) continue;
      if (t.noGrab || t.boss || t.weight > 2.2 || t.heldBy) continue;
      s.held.add(t); if (t.act) t.interrupt(); if (t.st !== 'hit') t.setState('hit'); t.stun = 0.35;
      const pull = s.R > 150 ? 8 : 5; t.x = damp(t.x, s.x, pull, dt); t.y = damp(t.y, s.y, pull, dt); const lift = s.lifeT > 0.4 ? 46 : 0; t.z = damp(t.z, lift, 4, dt); t.vz = 0; t.vx = t.vy = 0; }
  },
  onTick: (s, foes) => { if (s.R > 150) foes = ents.filter(t => foe(s.owner, t) && t.invul <= 0 && inGround(t, s.x, s.y, s.R * 0.75)); for (const t of foes) summonHit(s, t, { dmg: MECH_DMG.magnet() * gsMul(s.owner, 'g1'), type: 'mag', elem: 'light', stun: 0.35, knock: 0, hs: 0.01, col: '#c8b0ff', sure: true, downHit: true }); },
  onEnd: s => { for (const t of s.held || []) if (!t.dead && !t.remove) { t.setState('idle'); summonHit(s, t, { dmg: MECH_DMG.magnetEnd() * gsMul(s.owner, 'g1'), type: 'mag', elem: 'light', down: true, downLift: 160, knock: 40, hs: 0.06, sure: true, col: '#c8b0ff' }); }
    fxBurst(s.x, s.y, 40, 140, '#c8b0ff'); },
  draw(c, s) { const X = sx(s.x), Y = sy(s.y, 0), k = s.lifeT / s.life; c.save(); c.translate(X, Y); c.scale(1, GR); c.rotate(-game.t * 3); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.7 * (1 - k * 0.5);
    const im = fxTint('rune', '#b89aff'), R = (s.R || 150) * 0.75; if (im) c.drawImage(im, -R, -R, R * 2, R * 2); c.restore(); } });
defSkill('gm_magnet', { name: 'G-磁力弹', cls: 'gun', job: MC, lvReq: 19, maxLv: 1, sp: 30, mp: 60, cd: 15, type: 'mag', elem: 'light', col: '#9a7ae8', pre: { gm_g1: 2 },
  desc: '让科罗纳射出磁力弹：命中的敌人和附近的敌人被吸到地上的磁场标记处托起（3 秒，每 0.3 秒一段），最后被放下打倒。抓不住的敌人（领主等）只受伤害。G-2 / G-3 在场时先变回 G-1；没有 G 系列时顺便放出 G-1（G-1 冷却中则由临时的科罗纳发射）。',
  pow: () => MECH_DMG.magnet() * 10 + MECH_DMG.magnetEnd(), infoExtra: () => [['控制', '3 秒'], ['多段间隔', '0.3 秒']], ai: { kind: 'aoe', r: [40, 400], dy: 60 },
  act: (lv) => ({ name: 'gm_magnet', clip: mclip('mPoint'), dur: 0.3, noCounter: true, events: [evAt(0.04, e => magnetCast(e, lv))] }) });

/* =====================================================================
   Ex-S 毒蛇炮：面前的火力支援炮台（每秒 5 发贯穿子弹，6 秒后自爆），最多 9 台
   ===================================================================== */
function viperAI(s, dt) {
  s.vx = s.vy = 0; if (mechHeld(s)) return;
  s.fireT = (s.fireT ?? 0.25) - dt; if (s.fireT > 0) return; s.fireT = 0.2;
  const o = s.owner, T = foesNear(o, s.x + s.face * 260, s.y, 280, 70).filter(t => (t.x - s.x) * s.face > 0);
  if (!T.length) return;
  const t = T.sort((a, b) => Math.abs(a.x - s.x) - Math.abs(b.x - s.x))[0], air = t.z > 30;
  s.fireFx = game.t + 0.1; if (isHuman(o)) sfx.gun(0.3);
  mechShot(s, { face: s.face, tx: s.x + s.face * 500, ty: t.y, z: air ? 20 + Math.min(t.z, 90) : 24, speed: 980, life: 0.55, tracer: 2.5, col: '#ffe8a0', dx: 26, pierce: true,
    hit: { dmg: MECH_DMG.viper(s.lv) * mechMul(o), elem: mElem(o, null), stun: 0.18, knock: 8, airLift: 60, hs: 0.01 } });
}
defSummon('mech_viper', { kind: 'follower', tags: ['mech', 'turret'], max: 9, over: 'oldest', life: 6, keepRoom: false, speed: 0, w: 14, d: 12, h: 40, shadowR: 14, type: 'mag',
  model: () => MECH_NULL, onSpawn: s => mechSpawn(s, 'viper'), ai: viperAI,
  onEnd: (s, why) => { if (why === 'life' || why === 'replaced') { s.boomed = true; mechBlast(s, s.x, s.y, 70, MECH_DMG.viperBoom(s.lv) * mechMul(s.owner), { elem: mElem(s.owner, null), big: 0.45, launch: 260, knock: 90 }); } } });
defSkill('gm_viper', { name: 'Ex-S 毒蛇炮', cls: 'gun', job: MC, lvReq: 17, mp: 30, cd: 3.5, type: 'mag', col: '#6a8a5a',
  desc: '在面前架起火力支援机器人 Ex-S 毒蛇炮，向前方每秒发射 5 发贯穿子弹（敌人跳起时会抬高枪口），6 秒后自爆，炸伤周围的敌人。最多同时存在 9 台（超出时最早的一台提前自爆）。',
  pow: lv => MECH_DMG.viper(lv) * 30 + MECH_DMG.viperBoom(lv), infoExtra: () => [['持续', '6 秒'], ['射速', '每秒 5 发'], ['最多', '9 台']], ai: { kind: 'poke', r: [40, 480], dy: 50, summon: 'mech_viper' },
  act: (lv) => ({ name: 'gm_viper', clip: mclip('mSet'), dur: 0.45, noCounter: true,
    events: [evAt(0.18, e => { summon(e, 'mech_viper', { lv, x: e.x + e.face * 40, y: e.y }); sfx.mech(); })] }) });

/* =====================================================================
   被动：高科技 / 危机追击者 / 电能转换 / 光反应能量模块 / G 系扩张
   ===================================================================== */
defSkill('gm_hitech', { name: '高科技', cls: 'gun', job: MC, lvReq: 15, maxLv: 1, sp: 30, passive: true, type: 'mag', col: '#4a7ad0',
  desc: '【被动】用最尖端的技术强化自己的机器人：所有技能攻击力提高。', infoExtra: () => [['技能攻击力', '+10%']] });
defSkill('gm_backup', { name: '危机追击者', cls: 'gun', job: MC, lvReq: 16, passive: true, type: 'mag', col: '#8a5a3a', pre: { g_rx78: 1 },
  desc: '【被动】被敌人攻击时，有一定几率放出一台 RX-78 追击者反击（等级 = RX-78 追击者的技能等级；有冷却）。放出 RX-78 时也有小几率多放一台。',
  infoExtra: lv => [['被击时几率', pct(0.1 * lv)], ['冷却', (3 - 0.1 * (lv - 1)).toFixed(1) + ' 秒'], ['放 RX-78 时多放一台', pct(0.01 * lv)]] });
defSkill('gm_convert', { name: '电能转换', cls: 'gun', job: MC, lvReq: 17, passive: true, type: 'mag', elem: 'light', col: '#f2d24a',
  desc: '【被动】RX-78、EZ-8、Ex-S 毒蛇炮、狂风、空投支援、拦截机的攻击改为光属性；除 G 系列（科罗纳 / 旋雷者 / 捕食者）以外，所有技能攻击力和魔法暴击率提高。',
  infoExtra: lv => [['技能攻击力（G 系列除外）', '+' + pct(0.12 + 0.02 * (lv - 1))], ['魔法暴击率', '+10%']] });
defSkill('gm_solar', { name: '光反应能量模块', cls: 'gun', job: MC, lvReq: 20, maxLv: 1, sp: 10, passive: true, type: 'mag', elem: 'light', col: '#e8e05a', pre: { gm_factory: 1 },
  desc: '【被动】拦截机工厂改成一次性的攻击：放出的拦截机互相连结成散热板，蓄满能量后向前方射出一道贯穿整个画面的光束。' });
defSkill('gm_gext', { name: 'G 系扩张', cls: 'gun', job: MC, lvReq: 21, sp: 30, passive: true, tier: 1, type: 'mag', col: '#ffb03a',
  desc: '【被动·一觉】G 系列的改装冷却变为 0；G 系列每改装一次叠一层（最多 5 层，G 系列消失时清零），每层提高所有机器人的攻击力。旋雷者的电能在其他形态下也会照常充电。',
  infoExtra: lv => [['每层攻击力', '+' + pct(0.02 + 0.005 * (lv - 1))], ['最多', '5 层']] });

/* =====================================================================
   伪装：自己隐身（官方：自己和附近的队员），怪物丢失目标；做移动以外的动作时暂时现形，停手后再次隐身；被打中则解除
   另有常驻的被动减伤（学了就有）
   ===================================================================== */
const cloakOn = p => !!(p && p.cloakT > game.t);
const cloakHidden = p => cloakOn(p) && !(p.cloakRevT > game.t);   // 隐身中且没有暂时现形（和 bestiary.js 的 cloaked(e) 一样）
function cloakWrap(p) {
  const m = p.model; if (!m || m.__cloak) return;
  const d = m.draw; m.draw = function (c, pose, t, o) { if (cloakOn(p)) c.globalAlpha *= cloakHidden(p) ? 0.28 + 0.06 * Math.sin(game.t * 6) : 0.75; return d.call(this, c, pose, t, o); }; m.__cloak = true;
}
defSummon('mech_cloak', { kind: 'attach', host: 'owner', life: 12, keepRoom: true, tags: [],
  update: (s, dt) => { const p = s.owner; if (!cloakOn(p)) { dismissOne(s, 'cmd'); return; } cloakWrap(p);
    if (p.st === 'act' && p.act && p.act.name !== 'back' && p.act.skill !== 'gm_camo') p.cloakRevT = game.t + 0.5;
    if ((p.st === 'walk' || p.st === 'run') && Math.random() < 0.08) fxSpr('spark', p.x + rnd(-10, 10), p.y, p.z + rnd(20, 90), { w: 14, dur: 0.3, col: '#bfe8ff' }); },
  onEnd: s => { const p = s.owner; if (p) { p.cloakT = 0; fxBurst(p.x, p.y, p.z + 50, 90, '#bfe8ff'); } } });
const camoDur = lv => 12 + 2 * (lv - 1), camoEv = lv => 0.12 + 0.01 * (lv - 1), camoDr = lv => 0.06 + 0.01 * (lv - 1);
defSkill('gm_camo', { name: '伪装', cls: 'gun', job: MC, lvReq: 18, mp: 60, cd: 60, type: 'mag', buff: true, col: '#5a9aa8',
  desc: '用最尖端的伪装技术让自己隐身：怪物立刻丢失目标，回避率提高。做移动以外的动作（普攻、放技能）时会暂时现形，停手后再次隐身；被击中时伪装解除。学会后常驻：受到的伤害降低。',
  infoExtra: lv => [['持续', camoDur(lv) + ' 秒'], ['回避率', '+' + pct(camoEv(lv))], ['常驻减伤', pct(camoDr(lv))]], ai: { kind: 'buff' },
  act: (lv) => ({ name: 'gm_camo', clip: mclip('mRemote'), dur: 0.7, noCounter: true,
    events: [evAt(0.35, e => { e.cloakT = game.t + camoDur(lv); e.cloakRevT = 0; e.cloakLv = lv; cloakWrap(e); dismissSummons(e, 'mech_cloak', 'cmd'); e.cloakT = game.t + camoDur(lv);
      summon(e, 'mech_cloak', { life: camoDur(lv) }); sfx.buff(); addFx({ x: e.x, y: e.y - 0.5, z: 0, dur: 0.6, draw(c) { const k = this.t / this.dur;   // 地面法阵：躺在地上
        drawSpr(c, fxTint('rune', '#bfe8ff'), sx(this.x), sy(this.y + 0.5, 0), 140 * lerp(0.3, 1.2, easeOut(k)), 52 * lerp(0.3, 1.2, easeOut(k)), { ground: true, rot: k * 0.8, alpha: k > 0.6 ? 1 - (k - 0.6) / 0.4 : 1, add: true }); } }); })] }) });

/* =====================================================================
   空战机械：狂风（跟着你的飞行机甲：机枪 + 导弹，60 秒；到时 / 再按技能键 / 放新的时自爆）
   ===================================================================== */
function galeAI(s, dt) {
  const o = s.owner;
  if (s.dive) {   // 自爆：冲向目标
    const t = s.dive.t, tx = t && !t.dead ? t.x : s.dive.x, ty = t && !t.dead ? t.y : s.dive.y, dx = tx - s.x, dy = ty - s.y, d = Math.hypot(dx, dy * 1.4);
    s.hz = damp(s.hz, 0, 6, dt);
    if (d < 16 || s.hz < 8 || s.lifeT > s.dive.until) { galeBoom(s); return; }
    const v = 520; s.x += dx / d * v * dt; s.y += dy / d * v * dt * 0.7; s.face = dx >= 0 ? 1 : -1; s.vx = s.vy = 0; return;
  }
  const t = mechHeld(s) ? null : nearestFoe(s, 600);
  const gx = t ? t.x - Math.sign(t.x - o.x || o.face) * 150 : o.x + o.face * 30, gy = t ? t.y : clamp(o.y - 10, 4, DEPTH - 4);
  const sp = 240 * robSpd(o), dx = gx - s.x, dy = gy - s.y, d = Math.hypot(dx, dy);
  if (d > 6) { const v = Math.min(sp, d * 4); s.x += dx / d * v * dt; s.y += dy / d * v * dt * 0.8; }
  s.vx = s.vy = 0; s.hz = damp(s.hz || 110, 112, 3, dt); s.face = t ? (t.x >= s.x ? 1 : -1) : o.face;
  if (!t) return;
  const T = s.timers; T.gun = (T.gun ?? 0.8) - dt; T.mis = (T.mis ?? 2.2) - dt;
  if (T.gun <= 0) { T.gun = 1.5; for (let i = 0; i < 8; i++) game.after(i * 0.07, () => { if (s.gone || s.dive || t.dead) return; s.fireFx = game.t + 0.1; if (isHuman(o)) sfx.gun(0.25);
    mechShot(s, { tx: t.x + rnd(-10, 10), ty: t.y + rnd(-4, 4), z: s.hz - 16, speed: 1100, life: 0.7, tracer: 2, col: '#ffe8a0', dx: 18,
      update: pr => { pr.vz = ((t.z + 40) - pr.z) * 3; }, hit: { dmg: MECH_DMG.galeGun(s.lv) * mechMul(o), elem: mElem(o, null), stun: 0.2, knock: 6, hs: 0.01 } }); }); }
  if (T.mis <= 0) { T.mis = 3.6; s.misFx = game.t + 0.6; for (let i = 0; i < 4; i++) game.after(i * 0.12, () => { if (s.gone || s.dive) return; galeMissile(s, nearestFoe(s, 700) || t, i); }); }
}
function galeMissile(s, t, i) {
  const o = s.owner, img = fxTint('fireball', '#ffb060');
  spawnProj({ owner: s, x: s.x, y: s.y, z: s.hz, vx: -s.face * 120 + rnd(-40, 40), vy: rnd(-30, 30), vz: 160 + i * 30, face: s.face, life: 1.6, w: 8, d: 10, h: 12, pierce: false, shadow: 4, mul: s.mul,
    hit: { dmg: MECH_DMG.galeMis(s.lv) * mechMul(o), type: 'mag', elem: mElem(o, 'fire'), stun: 0.3, knock: 30, hs: 0.02, snd: 'fire' },
    update(pr, dt) { if (pr.t > 0.25 && t && !t.dead) { const dx = t.x - pr.x, dy = t.y - pr.y, dz = t.z + 30 - pr.z, d = Math.hypot(dx, dy, dz) || 1, v = 520; pr.vx = damp(pr.vx, dx / d * v, 8, dt); pr.vy = damp(pr.vy, dy / d * v, 8, dt); pr.vz = damp(pr.vz, dz / d * v, 8, dt); }
      else pr.vz -= 300 * dt; if (Math.random() < 0.6) addFx({ x: pr.x, y: pr.y + 0.2, z: pr.z, dur: 0.3, draw(c) { const k = this.t / this.dur; c.fillStyle = `rgba(220,220,230,${0.5 * (1 - k)})`; c.beginPath(); c.arc(sx(this.x), sy(this.y, this.z), 3 + k * 4, 0, TAU); c.fill(); } }); },
    onEnd(pr) { fxBurst(pr.x, pr.y, pr.z, 60, '#ffb060'); summonArea(s, pr.x, pr.y, 36, { dmg: MECH_DMG.galeMis(s.lv) * 0.5 * mechMul(o), type: 'mag', elem: mElem(o, 'fire'), stun: 0.2, knock: 30, hs: 0.01 }, { zMax: 160 }); },
    draw(c, pr) { drawSpr(c, img, sx(pr.x), sy(pr.y, pr.z), 22, 12, { rot: Math.atan2(-pr.vz, Math.abs(pr.vx) + 1) * (pr.vx < 0 ? -1 : 1), flip: pr.vx < 0 }); } });
}
function galeBoom(s) {
  if (s.boomed) return; s.boomed = true; const o = s.owner;
  mechBlast(s, s.x, s.y, 120, MECH_DMG.galeBoom(s.lv) * mechMul(o), { elem: mElem(o, 'fire'), big: 0.9, launch: 420, knock: 160, bigHit: 1.5 });
  if (!s.gone) dismissOne(s, 'boom');
}
function galeDive(s) { if (s.dive || s.boomed) return; const t = nearestFoe(s, 700); s.dive = { t, x: t ? t.x : s.x + s.face * 120, y: t ? t.y : s.y, until: s.lifeT + 1.2 }; s.life = Math.max(s.life, s.lifeT + 1.5); sfx.charge(); }
defSummon('mech_gale', { kind: 'follower', tags: ['mech'], max: 1, life: 60, keepRoom: true, enterAt: 'behind', speed: 0, w: 14, d: 12, h: 40, shadowR: 18, type: 'mag',
  model: () => MECH_NULL, onSpawn: s => mechSpawn(s, 'gale', { hz: 112 }), ai: galeAI,
  onEnd: (s, why) => { if (!s.boomed && (why === 'life' || why === 'replaced')) galeBoom(s); } });
defSkill('gm_gale', { name: '空战机械：狂风', cls: 'gun', job: MC, lvReq: 19, mp: 80, cd: 30, type: 'mag', col: '#5a6a9a',
  desc: '召唤空中战斗机甲狂风：跟着你飞行，自动用机枪扫射、发射追踪导弹攻击敌人；60 秒后（或放出新的狂风时）冲向敌人自爆。狂风在场时再按技能键，让它立刻冲向最近的敌人自爆。',
  pow: lv => MECH_DMG.galeGun(lv) * 8 * 20 + MECH_DMG.galeMis(lv) * 4 * 8 + MECH_DMG.galeBoom(lv), infoExtra: lv => [['持续', '60 秒'], ['自爆', pct(MECH_DMG.galeBoom(lv))]], ai: { kind: 'poke', r: [0, 600], dy: 200, summon: 'mech_gale' },
  recast: { ok: p => summonsOf(p, 'mech_gale').some(s => !s.dive), instant: () => true, cd: 0.5, mp: 0,
    act: (lv, p) => { for (const s of summonsOf(p, 'mech_gale')) galeDive(s); sfx.beep(); return { name: 'gm_gale', clip: mclip('mRemote'), dur: 0.12, noCounter: true }; } },
  act: (lv) => ({ name: 'gm_gale', clip: mclip('mCall'), dur: 0.6, noCounter: true,
    events: [evAt(0.3, e => { summon(e, 'mech_gale', { lv, x: e.x - e.face * 30, y: e.y }); sfx.mech(1.3); sfx.charge(); })] }) });

/* =====================================================================
   空投支援：在指定位置（施放时方向键微调标记）呼叫轰炸机，投下一批银色破坏者（最快、爆炸更大的 RX-78），追着敌人自爆
   ===================================================================== */
function mechDropRun(e, lv, P) {
  const n = 12, dir = e.face, room = game.room;
  // 轰炸机飞过：天上的机影 + 地上的大影子
  addFx({ x: P.x - dir * 700, y: P.y, z: 0, dur: 1.6, dir, add: false, draw(c) { const k = this.t / this.dur, x = this.x + this.dir * 1400 * k, X = sx(x), Y = sy(this.y, 0);
    c.save(); c.fillStyle = 'rgba(0,0,0,.22)'; c.beginPath(); c.ellipse(X, Y, 120, 24, 0, 0, TAU); c.fill(); c.restore();
    c.save(); c.translate(X - this.dir * 60, Y - 330); c.scale(this.dir, 1); c.fillStyle = '#3a4050'; c.strokeStyle = OUTL; c.lineWidth = 3;
    c.beginPath(); c.moveTo(-90, 0); c.lineTo(80, -8); c.lineTo(100, 4); c.lineTo(-80, 14); c.closePath(); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(-10, 2); c.lineTo(-60, 60); c.lineTo(-30, 62); c.lineTo(30, 6); c.closePath(); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(-70, 0); c.lineTo(-96, -30); c.lineTo(-80, -30); c.lineTo(-50, 0); c.closePath(); c.fill(); c.stroke(); c.restore(); } });
  sfx.charge(); cam.shake = Math.max(cam.shake, 3);
  for (let i = 0; i < n; i++) game.after(0.55 + i * 0.07, () => {
    if (e.dead || game.room !== room) return; const x = P.x + rnd(-110, 110), y = clamp(P.y + rnd(-40, 40), 6, DEPTH - 6);
    addFx({ x, y, z: 320, dur: 0.35, draw(c) { const k = this.t / this.dur; c.save(); c.translate(sx(this.x), sy(this.y, 320 * (1 - k))); c.scale(0.9, 0.9); drawRx78(c, 0, 0, 1, game.t); c.restore(); } });
    game.after(0.35, () => { if (e.dead || game.room !== room) return; const s = summon(e, 'mech_buster', { lv, x, y }); if (s) { s.base = MECH_DMG.drop(lv); fxDust(x, y, 4, 12); } });
  });
}
defSkill('gm_drop', { name: '空投支援', cls: 'gun', job: MC, lvReq: 19, mp: 90, cd: 40, type: 'mag', elem: 'fire', col: '#8a6a4a',
  desc: '用遥控器呼叫轰炸机：施放时可以用方向键移动地上的标记，轰炸机飞过标记上空，投下 12 台银色破坏者（跑得最快、爆炸更大的 RX-78），各自冲向附近的敌人自爆。',
  pow: lv => MECH_DMG.drop(lv) * 12, infoExtra: () => [['银色破坏者', '12 台']], ai: { kind: 'aoe', r: [60, 420], dy: 90 },
  act: (lv) => ({ name: 'gm_drop', clip: mclip('mRemote'), dur: 0.7, noCounter: true,
    onStart: e => { const at = aimAhead(e, 240, 440); e.act.g = telegraph({ x: at.x, y: at.y, r: 110, dur: 1.25, kind: 'circle', col: '#ffb060', friendly: true }); e.act.P = at; sfx.beep(); },
    onInput: (e, I, dt) => { const g = e.act.g; if (g && e.actT < 0.6) { g.x += I.dx() * 360 * (dt || 1 / 60); g.y = clamp(g.y + I.dy() * 200 * (dt || 1 / 60), 8, DEPTH - 8); } return false; },
    events: [evAt(0.62, e => mechDropRun(e, lv, { x: e.act.g.x, y: e.act.g.y }))] }) });

/* =====================================================================
   拦截机工厂：面前的工厂（5 秒）不停生产小拦截机（最多 6 架）射击 800 px 内的敌人；工厂到时爆炸，剩下的拦截机冲向敌人自爆
   光反应能量模块：6 架拦截机一次放出，连结成散热板，蓄能后向前射出贯穿光束
   ===================================================================== */
function factoryAI(s, dt) {
  s.vx = s.vy = 0; const o = s.owner, T = s.timers;
  if (s.solar) {
    if (s.lifeT > 0.1 && (s.made || 0) < 6) { T.mk = (T.mk ?? 0) - dt; if (T.mk <= 0) { T.mk = 0.08; const b = summon(o, 'mech_sparrow', { lv: s.lv, x: s.x, y: s.y }); if (b) { b.fac = s; b.slot = s.made; b.hz = 40; } s.made = (s.made || 0) + 1; } }
    if (s.lifeT > 1.7 && !s.fired) { s.fired = true; solarFire(s); }
    return;
  }
  T.mk = (T.mk ?? 0.2) - dt;
  if (T.mk <= 0) { T.mk = 0.5; const mine = summonsOf(o, 'mech_sparrow').filter(b => b.fac === s); if (mine.length < 6 && !mechHeld(s)) { const b = summon(o, 'mech_sparrow', { lv: s.lv, x: s.x, y: s.y }); if (b) { b.fac = s; b.hz = 40; s.mkT = game.t + 0.3; sfx.mech(0.5); } } }
}
function solarFire(s) {
  const o = s.owner, x0 = s.x + s.face * 40, dmg = MECH_DMG.solar(s.lv) * mechMul(o), el = mElem(o, 'light');
  cam.shake = Math.max(cam.shake, 8); cam.flash = 0.12; cam.flashCol = '#fff6c0'; sfx.boom(1.1); sfx.iai();
  fxBeam(x0, s.y, 50, 1000, s.face, { w: 90, dur: 0.7, col: '#fff0a0' });
  for (const t of lineFoes(o, x0, s.y, s.face, 1000, 48)) summonHit(s, t, { dmg, type: 'mag', elem: el, launch: 360, knock: 160, hs: 0.1, big: 1.6, sure: true, downHit: true, col: '#fff6c0' });
  for (const b of summonsOf(o, 'mech_sparrow')) if (b.fac === s) dismissOne(b, 'cmd');
  s.life = Math.min(s.life, s.lifeT + 0.4);
}
function sparrowAI(s, dt) {
  const o = s.owner, f = s.fac;
  if (f && f.solar) {   // 散热板：在工厂前方排成一列，发光蓄能
    const k = (s.slot || 0), gx = f.x + f.face * 38, gz = 22 + k * 16; s.face = f.face;
    s.x = damp(s.x, gx, 10, dt); s.y = damp(s.y, f.y + 0.5, 10, dt); s.hz = damp(s.hz || 30, gz, 10, dt); s.vx = s.vy = 0;
    if (f.lifeT > 0.8 && Math.random() < 0.3) fxCharge({ x: s.x, y: s.y, z: s.hz - 50 }, '#fff0a0');
    return;
  }
  if (s.kami) {   // 自爆：冲向目标
    const t = s.kami; if (!t || t.dead || t.remove) { s.kami = nearestFoe(s, 800); if (!s.kami) { sparrowBoom(s); return; } return; }
    const dx = t.x - s.x, dy = t.y - s.y, dz = t.z + t.hurtH() * 0.5 - (s.hz || 40), d = Math.hypot(dx, dy * 1.4, dz); const v = 460 * robSpd(o);
    if (d < 16) { sparrowBoom(s); return; }
    s.x += dx / d * v * dt; s.y += dy / d * v * dt * 0.7; s.hz = (s.hz || 40) + dz / d * v * dt; s.face = dx >= 0 ? 1 : -1; s.vx = s.vy = 0; return;
  }
  const base = f && !f.gone ? f : o, t = mechHeld(s) ? null : nearestFoe(base, 800);
  const a = game.t * 1.8 + s.sid, gx = t ? t.x + Math.cos(a) * 70 : base.x + Math.cos(a) * 40, gy = t ? t.y + Math.sin(a) * 20 : base.y + Math.sin(a) * 12;
  const sp = 260 * robSpd(o), dx = gx - s.x, dy = gy - s.y, d = Math.hypot(dx, dy); if (d > 4) { const v = Math.min(sp, d * 5); s.x += dx / d * v * dt; s.y += dy / d * v * dt * 0.8; }
  s.y = clamp(s.y, 4, DEPTH - 4); s.hz = damp(s.hz || 40, 70 + Math.sin(a * 2) * 10, 3, dt); s.vx = s.vy = 0; s.face = t ? (t.x >= s.x ? 1 : -1) : s.face;
  if (!t) return;
  s.timers.sh = (s.timers.sh ?? rnd(0.2, 0.8)) - dt;
  if (s.timers.sh <= 0) { s.timers.sh = 0.8; mechShot(s, { tx: t.x, ty: t.y, z: s.hz - 6, speed: 900, life: 0.5, tracer: 1.5, col: '#bfe8ff', dx: 8, pierce: Math.random() < 0.3,
    update: pr => { pr.vz = ((t.z + 36) - pr.z) * 4; }, hit: { dmg: MECH_DMG.sparrowShot(s.lv) * mechMul(o), elem: mElem(o, null), stun: 0.22, knock: 6, hs: 0.01 } }); }
}
function sparrowBoom(s) {
  if (s.boomed) return; s.boomed = true; const o = s.owner;
  mechBlast(s, s.x, s.y, 54, MECH_DMG.sparrowBoom(s.lv) * mechMul(o), { elem: mElem(o, null), big: 0.35, launch: 260, knock: 80 });
  if (!s.gone) dismissOne(s, 'boom');
}
// 机械引爆 / 工厂到时：拦截机冲向等级最高的敌人自爆
function sparrowDive(p, range) { const L = foesNear(p, p.x, p.y, range || 800, 200).sort((a, b) => foeGrade(b) - foeGrade(a)); for (const s of summonsOf(p, 'mech_sparrow')) if (!s.kami && !(s.fac && s.fac.solar)) { s.kami = L[0] || nearestFoe(s, 800); if (!s.kami) sparrowBoom(s); s.life = Math.max(s.life, s.lifeT + 2); } }
defSummon('mech_sparrow', { kind: 'follower', tags: ['mech'], max: 12, over: 'oldest', life: 9, keepRoom: false, speed: 0, w: 8, d: 8, h: 20, shadowR: 6, type: 'mag',
  model: () => MECH_NULL, onSpawn: s => mechSpawn(s, 'sparrow', { hz: 40, puff: false }), ai: sparrowAI, onEnd: (s, why) => { if (why === 'life' && !s.boomed && !(s.fac && s.fac.solar)) sparrowBoom(s); } });
defSummon('mech_factory', { kind: 'follower', tags: ['mech'], max: 1, life: 5, keepRoom: false, speed: 0, w: 24, d: 16, h: 60, shadowR: 30, type: 'mag',
  model: () => MECH_NULL, onSpawn: s => mechSpawn(s, 'factory'), ai: factoryAI,
  onEnd: (s, why) => { if (s.solar) { fxBurst(s.x, s.y, 30, 90, '#fff0a0'); return; } mechBoomFx(s.x, s.y, 0.6, mElem(s.owner, null)); const o = s.owner, L = foesNear(o, s.x, s.y, 800, 220).sort((a, b) => foeGrade(b) - foeGrade(a));
    for (const b of summonsOf(o, 'mech_sparrow')) if (b.fac === s && !b.kami) { b.kami = L.length ? L[Math.floor(Math.random() * Math.min(3, L.length))] : null; if (!b.kami) sparrowBoom(b); b.life = Math.max(b.life, b.lifeT + 2); } } });
defSkill('gm_factory', { name: '拦截机工厂', cls: 'gun', job: MC, lvReq: 20, mp: 100, cd: 45, type: 'mag', col: '#7a8a9a',
  desc: '在面前设置拦截机工厂（5 秒），持续生产小型拦截机（最多 6 架）射击 800 px 内的敌人；工厂到时爆炸，剩下的拦截机冲向敌人自爆。机械引爆也会让拦截机冲向等级最高的敌人自爆。学了光反应能量模块后改成一次性的散热板光束。',
  pow: lv => MECH_DMG.sparrowBoom(lv) * 6, infoExtra: lv => [['持续', '5 秒'], ['拦截机', '最多 6 架'], ['光反应能量模块光束', pct(MECH_DMG.solar(lv))]], ai: { kind: 'aoe', r: [0, 500], dy: 120, summon: 'mech_factory' },
  act: (lv) => ({ name: 'gm_factory', clip: mclip('mSet'), dur: 0.45, noCounter: true,
    events: [evAt(0.2, e => { const s = summon(e, 'mech_factory', { lv, x: e.x + e.face * 50, y: e.y }); if (s && hasSkill(e, 'gm_solar')) { s.solar = true; s.life = 2.6; } sfx.mech(1.2); })] }) });

/* =====================================================================
   一觉：改装：G-0 战争领主（需要 G 系列在场）。锁定前方的敌人（最多 5 个，等级高的优先），
   G 系列合体成战争领主：格林机枪 30 发 → 导弹 24 发 → 激光 12 段，集中攻击锁定目标（3 级：单个目标的锁定上限增加）；施放时无敌，G 系列消失并重置 G-1 冷却
   ===================================================================== */
function g0Lock(e, lv) {
  const L = ents.filter(t => foe(e, t) && !t.dead && (t.x - e.x) * e.face > -60 && Math.abs(t.x - e.x) < 700 && Math.abs(t.y - e.y) < 160).sort((a, b) => foeGrade(b) - foeGrade(a)).slice(0, 5);
  for (const t of L) addFx({ ent: t, y: t.y + 0.4, dur: 5.6, draw(c) { const T = this.ent; if (T.dead || T.remove) { this.t = this.dur; return; } const k = Math.min(1, this.t / 0.35), X = sx(T.x), Y = sy(T.y, T.z + T.hurtH() * 0.55), r = 34 - 14 * easeOut(k);
    this.y = T.y + 0.4; c.save(); c.globalCompositeOperation = 'lighter'; c.strokeStyle = '#ff4a3a'; c.lineWidth = 2.5; c.globalAlpha = 0.9; c.beginPath(); c.arc(X, Y, r, 0, TAU); c.stroke();
    c.beginPath(); for (const q of [0, 1, 2, 3]) { const a = q * Math.PI / 2 + this.t * 3; c.moveTo(X + Math.cos(a) * (r - 6), Y + Math.sin(a) * (r - 6)); c.lineTo(X + Math.cos(a) * (r + 8), Y + Math.sin(a) * (r + 8)); } c.stroke(); c.restore(); } });
  return L;
}
function g0AI(s, dt) {
  const o = s.owner, lv = s.lv, T = s.timers, k = s.lifeT;
  s.vx = s.vy = 0; s.face = s.face || o.face;
  const alive = () => { s.locks = (s.locks || []).filter(t => !t.dead && !t.remove); if (!s.locks.length) { const t = nearestFoe(s, 800); if (t) s.locks = [t]; } return s.locks; };
  // 3 级：单个目标的锁定上限增加（等级最高的目标占两份火力）
  const pickT = i => { const L = alive(); if (!L.length) return null; const W = lv >= 3 && L.length > 1 ? [L[0], ...L] : L; return W[i % W.length]; };
  const main = () => { const L = alive(); return L.length ? L.slice().sort((a, b) => foeGrade(b) - foeGrade(a))[0] : null; };
  if (k < 0.7) { s.phase = 'build'; if (Math.random() < 0.5) fxCharge({ x: s.x, y: s.y, z: 40 }, '#ffd070'); return; }
  if (k < 2.2) { s.phase = 'gat'; T.g = (T.g ?? 0) - dt; while (T.g <= 0 && (s.nGat || 0) < 30) { T.g += 0.05; const i = s.nGat = (s.nGat || 0) + 1, t = pickT(i); if (!t) break;
      const mx = s.x + s.face * 70, mz = 110; addFx({ x: mx, y: s.y + 1, z: mz, tx: t.x, ty: t.y, tz: t.z + t.hurtH() * 0.5, dur: 0.06, add: true, draw(c) { c.save(); c.globalCompositeOperation = 'lighter'; c.strokeStyle = '#ffe8a0'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(sx(this.x), sy(this.y, this.z)); c.lineTo(sx(this.tx), sy(this.ty, this.tz)); c.stroke(); c.restore(); } });
      if (i % 3 === 0) sfx.gun(0.5); summonHit(s, t, { dmg: MECH_DMG.g0Gat(lv), type: 'mag', elem: 'light', stun: 0.3, knock: 4, hs: 0.01, sure: true, downHit: true, col: '#ffe8a0', snd: 'blunt' }); } return; }
  if (k < 3.4) { s.phase = 'mis'; T.m = (T.m ?? 0) - dt; while (T.m <= 0 && (s.nMis || 0) < 24) { T.m += 0.05; const i = s.nMis = (s.nMis || 0) + 1, t = pickT(i); if (!t) break; g0Missile(s, t, i); } return; }
  if (k < 4.7) { s.phase = 'laser'; const t = main(); T.l = (T.l ?? 0.1) - dt;
    if (t && !s.beam) s.beam = addFx({ s, y: s.y + 1, dur: 1.3, add: true, draw(c) { const S = this.s, tg = S.beamT; if (!tg || S.gone) return; const x0 = sx(S.x + S.face * 20), y0 = sy(S.y, 100), x1 = sx(tg.x), y1 = sy(tg.y, tg.z + tg.hurtH() * 0.5), w = 18 + Math.sin(game.t * 50) * 4;
      c.save(); c.globalCompositeOperation = 'lighter'; c.lineCap = 'round'; c.strokeStyle = 'rgba(255,120,100,.55)'; c.lineWidth = w * 1.8; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); c.strokeStyle = '#fff4e0'; c.lineWidth = w * 0.6; c.stroke(); c.restore(); drawSpr(c, 'spark', x1, y1, 80 + Math.random() * 30, 0, {}); } });
    s.beamT = t;
    while (T.l <= 0 && (s.nLas || 0) < 12) { T.l += 0.1; s.nLas = (s.nLas || 0) + 1; if (!t) break; cam.shake = Math.max(cam.shake, 4); if (s.nLas % 2) sfx.iai();
      summonHit(s, t, { dmg: MECH_DMG.g0Las(lv) * 0.8, type: 'mag', elem: 'light', stun: 0.4, knock: 10, airLift: 60, hs: 0.03, sure: true, downHit: true, col: '#ffd0c0', snd: 'crit', big: 1.4 });
      summonArea(s, t.x, t.y, 60, { dmg: MECH_DMG.g0Las(lv) * 0.2, type: 'mag', elem: 'light', stun: 0.3, knock: 20, hs: 0.01, col: '#ffd0c0' }, { zMax: 200 }); }
    return; }
  s.phase = 'end'; s.beamT = null;
}
function g0Missile(s, t, i) {
  const o = s.owner, img = fxTint('fireball', '#ff9a6a');
  spawnProj({ owner: s, x: s.x - s.face * 20, y: s.y, z: 140, vx: rnd(-160, 160), vy: rnd(-60, 60), vz: 260 + rnd(0, 120), face: s.face, life: 1.6, w: 8, d: 10, h: 12, pierce: false, shadow: 4, mul: 1, tgt: t,
    hit: null,
    update(pr, dt) { const T = pr.tgt; if (pr.t > 0.3 && T && !T.dead) { const dx = T.x - pr.x, dy = T.y - pr.y, dz = T.z + 30 - pr.z, d = Math.hypot(dx, dy, dz) || 1, v = 640; pr.vx = damp(pr.vx, dx / d * v, 10, dt); pr.vy = damp(pr.vy, dy / d * v, 10, dt); pr.vz = damp(pr.vz, dz / d * v, 10, dt); if (d < 18) pr.t = pr.life; }
      else pr.vz -= 400 * dt; if (Math.random() < 0.5) addFx({ x: pr.x, y: pr.y + 0.2, z: pr.z, dur: 0.3, draw(c) { const k = this.t / this.dur; c.fillStyle = `rgba(230,230,240,${0.5 * (1 - k)})`; c.beginPath(); c.arc(sx(this.x), sy(this.y, this.z), 3 + k * 5, 0, TAU); c.fill(); } }); },
    onEnd(pr) { fxBurst(pr.x, pr.y, pr.z, 70, '#ffb080'); if (i % 4 === 0) sfx.boom(0.35); summonArea(s, pr.x, pr.y, 44, { dmg: MECH_DMG.g0Mis(s.lv), type: 'mag', elem: 'light', stun: 0.35, knock: 40, hs: 0.02, col: '#ffb080', downHit: true }, { zMax: 200 }); },
    draw(c, pr) { drawSpr(c, img, sx(pr.x), sy(pr.y, pr.z), 24, 12, { rot: Math.atan2(-pr.vz, Math.abs(pr.vx) + 1) * (pr.vx < 0 ? -1 : 1), flip: pr.vx < 0 }); } });
}
defSummon('mech_g0', { kind: 'follower', tags: ['mech'], max: 1, life: 5.1, keepRoom: false, speed: 0, w: 30, d: 16, h: 150, shadowR: 40, type: 'mag', noHold: true,
  model: () => MECH_NULL, onSpawn: s => { mechSpawn(s, 'g0', { puff: false }); s.timers = {}; }, ai: g0AI });
defSkill('gm_g0', { name: '改装：G-0 战争领主', cls: 'gun', job: MC, lvReq: 21, maxLv: 3, mp: 150, cd: 135, pvp: 0.45, type: 'mag', elem: 'light', awaken: true, col: '#ff6a3a',
  desc: '【觉醒】需要 G 系列在场。锁定前方的敌人（最多 5 个，等级高的优先；3 级时对单个目标的锁定上限增加），把 G 系列合体改装成战争领主，用格林机枪（30 发）、导弹（24 发）、激光（12 段）三重轰炸锁定的目标。施放时无敌；G 系列消失，G-1 科罗纳的冷却立刻重置。',
  pow: lv => MECH_DMG.g0Gat(lv) * 30 + MECH_DMG.g0Mis(lv) * 24 + MECH_DMG.g0Las(lv) * 12, infoExtra: lv => [['锁定', '5 个'], ['单个目标锁定', lv >= 3 ? '2 份' : '1 份']], ai: { kind: 'awaken', r: [0, 650], dy: 140 },
  req: p => gsUnits(p).length ? true : '需要 G 系列在场',
  act: (lv) => ({ name: 'gm_g0', clip: mclip('mAwk'), dur: 0.9, superArmor: true, invul: true, noCounter: true,
    onStart: e => { game.cutin = { t: 0, dur: 1.0, name: 'G-0 战争领主', who: cutinWho(e) }; game.timeStop = 0.9; sfx.awaken(); e.act.locks = g0Lock(e, lv); },
    events: [evAt(0.15, e => { const U = gsUnits(e); let cx = e.x - e.face * 34;
      for (const u of U) addFx({ x: u.x, y: u.y + 0.5, z: (u.hz || 40), tx: cx, dur: 0.35, draw(c) { const k = easeIn(this.t / this.dur); drawSpr(c, 'spark', sx(lerp(this.x, this.tx, k)), sy(this.y, lerp(this.z, 80, k)), 40, 0, {}); } });
      dismissSummons(e, GS_Q, 'tf'); gsState(e).stacks = 0; e.cool.gm_g1 = 0;
      const s = summon(e, 'mech_g0', { lv, x: cx, y: clamp(e.y - 2, 4, DEPTH - 4) }); if (s) { s.face = e.face; s.locks = e.act.locks; }
      cam.shake = 8; sfx.boom(0.8); fxShock(cx, e.y, 180, '#ffb080'); })] }) });

/* =====================================================================
   二觉 / 三觉（第 B 阶段）：HS-12 等离子体发生器、G-4 雷行者、G-X 主宰者（二觉被动）、G-超级猎鹰、高压电磁场、终结者：博尔特 MX（二觉）、
   微型制导（三觉被动）、超时空光耀加农炮、G-X 星尘天穹（三觉，和一觉互相绑定冷却）
   ===================================================================== */
Object.assign(MECH_DMG, {
  hs12: lv => skillDmg(9.0, 0.9, lv),
  frisbee: lv => skillDmg(0.2, 0.02, lv), frisbeeBoom: lv => skillDmg(1.2, 0.12, lv),
  falconCo: lv => skillDmg(6.0, 0.6, lv), falconRt: lv => skillDmg(2.0, 0.2, lv), falconRp: lv => skillDmg(0.24, 0.024, lv),
  field: lv => skillDmg(0.9, 0.09, lv),
  boltMx2: lv => 0.6 * (1 + 0.27 * (lv - 1)), boltMx2Boom: lv => 2.4 * (1 + 0.27 * (lv - 1)), boltRifle: lv => 1.4 * (1 + 0.27 * (lv - 1)), boltRifle4: lv => 1.8 * (1 + 0.27 * (lv - 1)),
  boltBlade: lv => 3.0 * (1 + 0.27 * (lv - 1)), boltFin: lv => 11 * (1 + 0.27 * (lv - 1)),
  hyperBomb: lv => skillDmg(1.0, 0.1, lv), hyperBoom: lv => skillDmg(3.5, 0.35, lv),
  sdLaser: () => 2.2, sdDome: () => 5.2,
});
// 锁定标记（准星，跟着目标）
function lockFx(t, dur, col = '#ff4a3a') {
  addFx({ ent: t, y: t.y + 0.4, dur, draw(c) { const T = this.ent; if (T.dead || T.remove) { this.t = this.dur; return; } const k = Math.min(1, this.t / 0.3), X = sx(T.x), Y = sy(T.y, T.z + T.hurtH() * 0.55), r = 30 - 12 * easeOut(k);
    this.y = T.y + 0.4; c.save(); c.globalCompositeOperation = 'lighter'; c.strokeStyle = col; c.lineWidth = 2.5; c.beginPath(); c.arc(X, Y, r, 0, TAU); c.stroke();
    c.beginPath(); for (const q of [0, 1, 2, 3]) { const a = q * Math.PI / 2 + this.t * 3; c.moveTo(X + Math.cos(a) * (r - 6), Y + Math.sin(a) * (r - 6)); c.lineTo(X + Math.cos(a) * (r + 8), Y + Math.sin(a) * (r + 8)); } c.stroke(); c.restore(); } });
}

/* ---- HS-12 等离子体发生器：等离子机器人锁定附近等级最高的敌人，蓄能后飞过去自爆（学了 G-X 主宰者后爆炸范围扩大） ---- */
function hs12AI(s, dt) {
  const o = s.owner; s.vx = s.vy = 0;
  if (!s.tgt || s.tgt.dead || s.tgt.remove) { const L = foesNear(o, s.x, s.y, 560, 200).sort((a, b) => foeGrade(b) - foeGrade(a)); s.tgt = L[0] || null; if (s.tgt) lockFx(s.tgt, 2.5, '#c08aff'); }
  if (s.lifeT < 0.7) { s.hz = damp(s.hz || 20, 56, 4, dt); if (Math.random() < 0.5) fxCharge({ x: s.x, y: s.y, z: s.hz - 40 }, '#d0a0ff'); return; }
  const t = s.tgt, tx = t ? t.x : s.x + s.face * 220, ty = t ? t.y : s.y, dx = tx - s.x, dy = ty - s.y, d = Math.hypot(dx, dy * 1.4);
  if (d < 18 || s.lifeT > 3.2) { hs12Boom(s); return; }
  const v = 560 * robSpd(o); s.x += dx / d * v * dt; s.y += dy / d * v * dt * 0.8; s.face = dx >= 0 ? 1 : -1; s.hz = damp(s.hz, t ? t.hurtH() * 0.4 : 40, 5, dt);
}
function hs12Boom(s, fromEnd) {
  if (s.boomed || (s.gone && !fromEnd)) return; s.boomed = true; const o = s.owner;
  mechBlast(s, s.x, s.y, hasGop(o) ? 150 : 125, MECH_DMG.hs12(s.lv) * mechMul(o), { elem: 'light', big: 1.1, launch: 460, knock: 180, bigHit: 1.8 });
  fxSpr('quantum', s.x, s.y, 40, { w: 240, dur: 0.6, col: '#d0a0ff', grow: [0.3, 1.3] });
  if (!fromEnd) dismissOne(s, 'boom');
}
defSummon('mech_hs12', { kind: 'follower', tags: ['mech'], max: 2, life: 3.5, keepRoom: false, speed: 0, w: 14, d: 12, h: 40, shadowR: 12, type: 'mag',
  model: () => MECH_NULL, onSpawn: s => mechSpawn(s, 'hs12', { hz: 20 }), ai: hs12AI, onEnd: (s, why) => { if (why === 'life') hs12Boom(s, true); } });
defSkill('gm_hs12', { name: 'HS-12 等离子体发生器', cls: 'gun', job: MC, lvReq: 23, tier: 1, mp: 120, cd: 30, type: 'mag', elem: 'light', col: '#9a5ae8',
  desc: '放出等离子体凝聚成的机器人 HS-12：锁定附近等级最高的敌人，蓄能片刻后飞过去自爆，大范围光属性爆炸。学了 G-X 主宰者后爆炸范围扩大。',
  pow: lv => MECH_DMG.hs12(lv), ai: { kind: 'burst', r: [0, 520], dy: 120 },
  act: (lv) => ({ name: 'gm_hs12', clip: mclip('mSet'), dur: 0.35, noCounter: true, events: [evAt(0.12, e => { summon(e, 'mech_hs12', { lv, x: e.x + e.face * 40, y: e.y }); sfx.charge(); })] }) });

/* ---- G-4 雷行者：全身齿轮的回旋机器人，绕着你高速回旋、锯齿多段攻击（7 秒）；按住方向键再按技能键把它派到那个方向（最远 300 px），只按技能键召回；到时爆炸 ---- */
function frisbeeAI(s, dt) {
  const o = s.owner, G = s.goal; s.vx = s.vy = 0; s.hz = damp(s.hz || 10, 8, 6, dt);
  const cx = G ? G.x : o.x, cy = G ? G.y : o.y, R = G ? 28 : 84;
  s.ang = (s.ang ?? (s.idx || 0) * Math.PI) + dt * (G ? 9 : 4.8);
  const gx = cx + Math.cos(s.ang) * R, gy = clamp(cy + Math.sin(s.ang) * R * 0.35, 4, DEPTH - 4);
  s.x = damp(s.x, gx, G ? 7 : 12, dt); s.y = damp(s.y, gy, G ? 7 : 12, dt); s.face = Math.cos(s.ang) < 0 ? 1 : -1;
  if (mechHeld(s)) return;
  s.hitT = (s.hitT ?? 0) - dt;
  if (s.hitT <= 0) { s.hitT = hasGop(o) ? 0.14 : 0.18;
    const n = summonArea(s, s.x, s.y, 64, { dmg: MECH_DMG.frisbee(s.lv) * mechMul(o), type: 'mag', elem: 'light', stun: 0.22, knock: 20, airLift: 60, hs: 0.01, col: '#fff0a0', snd: 'slash', downHit: true }, { zMax: 80 });
    if (n && Math.random() < 0.5) fxSpr('spark', s.x, s.y, 12, { w: 40, dur: 0.15, col: '#ffe8a0' }); }
  if (Math.random() < 0.4) fxDust(s.x, s.y, 1, 6);
}
function frisbeeBoom(s, fromEnd) { if (s.boomed) return; s.boomed = true; mechBlast(s, s.x, s.y, 110, MECH_DMG.frisbeeBoom(s.lv) * mechMul(s.owner), { elem: 'light', big: 0.6, launch: 320, knock: 120 }); if (!fromEnd) dismissOne(s, 'boom'); }
function frisbeeCmd(p) {
  const I = p.pad, dx = I ? I.dx() : 0, dy = I ? I.dy() : 0;
  for (const s of summonsOf(p, 'mech_frisbee')) s.goal = dx || dy ? { x: p.x + dx * 300, y: clamp(p.y + dy * 110, 6, DEPTH - 6) } : null;
  sfx.beep(); if (isHuman(p)) fxText(dx || dy ? '雷行者：出击' : '雷行者：召回', p.x, p.y, p.z + 20, { col: '#ffe080', size: 10, dur: 0.6 });
  return tinyAct('gm_frisbee');
}
defSummon('mech_frisbee', { kind: 'follower', tags: ['mech'], max: 2, life: 7, keepRoom: false, speed: 0, w: 16, d: 12, h: 20, shadowR: 16, type: 'mag',
  model: () => MECH_NULL, onSpawn: s => mechSpawn(s, 'frisbee', { hz: 10 }), ai: frisbeeAI, onEnd: (s, why) => { if (why === 'life') frisbeeBoom(s, true); } });
defSkill('gm_frisbee', { name: 'G-4 雷行者', cls: 'gun', job: MC, lvReq: 25, tier: 1, mp: 130, cd: 45, type: 'mag', elem: 'light', col: '#d8a83a', pre: { gm_g3: 3 },
  desc: '放出全身裹着齿轮的回旋机器人雷行者：绕着你在地面高速回旋，锯齿身体连续攻击周围的敌人（能打到倒地的敌人），持续 7 秒，结束时爆炸。在场时按住方向键再按技能键，把它派到那个方向（最远 300 px）；只按技能键召回身边。',
  pow: lv => MECH_DMG.frisbee(lv) * 39 + MECH_DMG.frisbeeBoom(lv), infoExtra: () => [['持续', '7 秒'], ['多段间隔', '0.18 秒'], ['派出距离', '300 px']], ai: { kind: 'aoe', r: [0, 160], dy: 60, summon: 'mech_frisbee' },
  recast: { ok: p => summonsOf(p, 'mech_frisbee').length > 0, instant: () => true, cd: 0.25, mp: 0, act: (lv, p) => frisbeeCmd(p) },
  act: (lv) => ({ name: 'gm_frisbee', clip: mclip('mCall'), dur: 0.4, noCounter: true,
    events: [evAt(0.15, e => { const n = hasGop(e) ? 2 : 1; for (let i = 0; i < n; i++) { const s = summon(e, 'mech_frisbee', { lv, x: e.x + e.face * 40, y: e.y }); if (s) s.idx = i; } sfx.mech(1.2); })] }) });

/* ---- G-X 主宰者（二觉被动）：改装没有施法动作；G 系列强化；除觉醒外所有技能冷却 -15%；满足条件时“Buff On!”（30 秒）技能攻击力提高 ---- */
defSkill('gm_gop', { name: 'G-X 主宰者', cls: 'gun', job: MC, lvReq: 26, tier: 2, passive: true, type: 'mag', col: '#ff6ac8',
  desc: '【被动·二觉】G 系列的改装不再有施法动作（再按对应的技能键立即改装）；科罗纳射击间隔 -0.1 秒；旋雷者 +1 台、回旋速度 +50%；捕食者 +1 台、同一个敌人身上最多缠 4 台；雷行者 +1 个、多段间隔 -0.04 秒；HS-12 爆炸范围扩大。除觉醒技能外，所有技能冷却时间 -15%。G 系列改装、科罗纳命中 10 次、旋雷者发射电磁波、捕食者持续攻击 1 秒时，头上出现“Buff On!”，30 秒内技能攻击力提高。',
  infoExtra: lv => [['Buff On! 技能攻击力', '+' + pct(0.10 + 0.02 * (lv - 1))], ['冷却时间', '-15%']] });

/* ---- G-超级猎鹰：随 G 系列当前形态攻击（科罗纳：蓄能大范围爆炸 / 旋雷者：3 道激光 / 捕食者：缠住等级最高的敌人 25 段）；每 15 秒充 1 次，最多存 3 次 ---- */
function falconUnit(p) { let f = summonsOf(p, 'mech_falcon')[0]; if (!f) f = summon(p, 'mech_falcon', { x: p.x - p.face * 30, y: p.y }); else f.lifeT = 0; return f; }
function falconAI(s, dt) {
  const o = s.owner; s.vx = s.vy = 0;
  if (s.job && s.job.t && !s.job.t.dead && !s.job.t.remove) { const t = s.job.t; s.x = damp(s.x, t.x - s.face * 10, 12, dt); s.y = damp(s.y, t.y + 0.5, 12, dt); s.hz = damp(s.hz || 90, t.z + t.hurtH() * 0.8, 10, dt); return; }
  s.x = damp(s.x, o.x - o.face * 30, 6, dt); s.y = damp(s.y, clamp(o.y - 6, 4, DEPTH - 4), 6, dt); s.hz = damp(s.hz || 90, 104 + Math.sin(game.t * 2) * 4, 4, dt); s.face = o.face;
}
function falconAttack(p, lv) {
  const f = falconUnit(p); if (!f) return; const form = gsForm(p) || 'g1', mul = mechMul(p), room = game.room; f.form = form; f.face = p.face;
  if (form === 'g1') {
    const x = p.x + p.face * 210, y = p.y; f.fireFx = game.t + 0.5; sfx.charge();
    addFx({ x: f.x, y: f.y + 0.5, z: f.hz || 100, dur: 0.4, draw(c) { const k = this.t / this.dur; drawSpr(c, fxTint('orb', '#fff0a0'), sx(this.x), sy(this.y, this.z), 20 + 60 * k, 0, {}); } });
    game.after(0.4, () => { if (game.room !== room) return; mechBoomFx(x, y, 1.1, 'light'); fxShock(x, y, 180, '#fff0a0');
      summonArea(f, x, y, 160, { dmg: MECH_DMG.falconCo(lv) * mul, type: 'mag', elem: 'light', launch: 380, knock: 120, hs: 0.08, big: 1.6, downHit: true, col: '#fff0a0' }, { zMax: 220 }); });
  } else if (form === 'g2') {
    sfx.iai(); f.fireFx = game.t + 0.3;
    [-22, 0, 22].forEach((oy, i) => game.after(i * 0.08, () => { if (game.room !== room) return; const y = clamp(p.y + oy, 4, DEPTH - 4); fxBeam(f.x + p.face * 10, y, 60, 820, p.face, { w: 30, dur: 0.4, col: '#9fd8ff' });
      for (const t of lineFoes(p, f.x, y, p.face, 820, 26)) summonHit(f, t, { dmg: MECH_DMG.falconRt(lv) * mul, type: 'mag', elem: 'light', stun: 0.4, knock: 40, airLift: 100, hs: 0.04, sure: true, downHit: true, col: '#bfe8ff' }); }));
  } else {
    const L = summonsOf(p, 'mech_g3').map(u => u.tgt).filter(Boolean), cand = (L.length ? L : foesNear(p, p.x, p.y, 500, 160)).filter(t => !t.dead).sort((a, b) => foeGrade(b) - foeGrade(a)), t = cand[0];
    if (!t) return; f.job = { t }; lockFx(t, 2.2, '#ffd070');
    for (let i = 0; i < 25; i++) game.after(0.25 + i * 0.08, () => { if (t.dead || t.remove || f.gone) return; summonHit(f, t, { dmg: MECH_DMG.falconRp(lv) * mul, type: 'mag', elem: 'light', stun: 0.2, knock: 0, hs: 0.005, sure: true, downHit: true, col: '#fff0a0' }); if (i % 3 === 0) fxSpr('spark', t.x, t.y, t.z + t.hurtH() * 0.6, { w: 40, dur: 0.12, col: '#ffe8a0' }); });
    game.after(0.25 + 25 * 0.08, () => { f.job = null; });
  }
}
defSummon('mech_falcon', { kind: 'follower', tags: ['mech'], max: 1, life: 20, keepRoom: true, enterAt: 'behind', speed: 0, w: 12, d: 12, h: 30, shadowR: 10, type: 'mag', noHold: true,
  model: () => MECH_NULL, onSpawn: s => mechSpawn(s, 'falcon', { hz: 104 }), ai: falconAI });
defSkill('gm_falcon', { name: 'G-超级猎鹰', cls: 'gun', job: MC, lvReq: 26, tier: 2, mp: 80, cd: 0.5, charges: 3, reload: 15, type: 'mag', elem: 'light', col: '#f0b83a',
  desc: '放出和 G 系列联动的特殊机器人猎鹰，按 G 系列当前的形态攻击：科罗纳（或没有 G 系列）= 蓄能后大范围爆炸；旋雷者 = 向前射出 3 道激光；捕食者 = 缠住被捕食者咬住的敌人里等级最高的一个，连续攻击 25 段。每 15 秒充能 1 次，最多存 3 次。',
  pow: lv => MECH_DMG.falconCo(lv), infoExtra: lv => [['科罗纳形态', pct(MECH_DMG.falconCo(lv))], ['旋雷者形态', pct(MECH_DMG.falconRt(lv)) + ' ×3'], ['捕食者形态', pct(MECH_DMG.falconRp(lv)) + ' ×25'], ['充能', '15 秒 / 最多 3 次']],
  ai: { kind: 'burst', r: [0, 480], dy: 80 },
  act: (lv) => ({ name: 'gm_falcon', clip: mclip('mPoint'), dur: 0.4, noCounter: true, events: [evAt(0.1, e => { falconAttack(e, lv); sfx.mech(1.1); })] }) });

/* ---- 高压电磁场：射出磁场发生器，飞 220 px 后展开电磁场，1.5 秒内 15 段，把周围的敌人往中心拉 ---- */
defSummon('mech_emfield', { kind: 'field', r: 125, tick: 0.1, hits: 15, life: 1.7, tags: ['mech'], type: 'mag', keepRoom: false,
  onSpawn: s => { sfx.zap ? sfx.zap() : sfx.iai(); sfx.boom(0.5); fxShock(s.x, s.y, 150, '#9fd8ff'); },
  update: (s, dt) => { for (const t of ents) if (foe(s.owner, t) && !t.dead && !t.boss && !t.noGrab && inGround(t, s.x, s.y, 170)) { t.x = damp(t.x, s.x, 2.5, dt); t.y = damp(t.y, s.y, 2.5, dt); } },
  onTick: (s, foes) => { for (const t of foes) summonHit(s, t, { dmg: MECH_DMG.field(s.lv) * mechMul(s.owner), type: 'mag', elem: 'light', stun: 0.3, knock: 0, hs: 0.005, sure: true, downHit: true, col: '#bfe8ff', snd: 'crit' }); },
  draw(c, s) { const X = sx(s.x), Y = sy(s.y, 0), k = s.lifeT / s.life; c.save(); c.globalCompositeOperation = 'lighter';
    c.globalAlpha = 0.5 * (1 - k * 0.6); c.fillStyle = 'rgba(120,200,255,.25)'; c.beginPath(); c.ellipse(X, Y, 125, 125 * GR, 0, 0, TAU); c.fill();
    c.strokeStyle = '#bfe8ff'; c.lineWidth = 2; for (let i = 0; i < 3; i++) { const r = 125 * ((game.t * 1.5 + i / 3) % 1); c.globalAlpha = 0.7 * (1 - r / 125); c.beginPath(); c.ellipse(X, Y, r, r * GR, 0, 0, TAU); c.stroke(); }
    c.globalAlpha = 0.9; c.beginPath(); for (let i = 0; i < 6; i++) { const a = rnd(0, TAU), r = rnd(30, 120); c.moveTo(X, Y - 30); c.lineTo(X + Math.cos(a) * r, Y + Math.sin(a) * r * GR); } c.stroke();
    c.restore(); c.save(); c.translate(X, Y); if (!mechFrame(c, 'emgen', cyc(game.t, 8, ['spin1', 'spin2', 'pulse']))) MECH_LOOK.emgen(c, s, game.t); c.restore(); } });
defSkill('gm_field', { name: '高压电磁场', cls: 'gun', job: MC, lvReq: 26, tier: 2, mp: 150, cd: 50, type: 'mag', elem: 'light', col: '#3a8ae8',
  desc: '向前射出磁场发生器，飞出 220 px 后展开高压电磁场，1.5 秒内连续电击范围内的敌人 15 次，并把周围的敌人往中心拉。',
  pow: lv => MECH_DMG.field(lv) * 15, infoExtra: () => [['多段', '15 次 / 1.5 秒'], ['飞行距离', '220 px']], ai: { kind: 'aoe', r: [100, 380], dy: 60 },
  act: (lv) => ({ name: 'gm_field', clip: mclip('mPoint'), dur: 0.7, noCounter: true,
    events: [evAt(0.3, e => { sfx.swing(false); const room = game.room;
      lobProj(e, e.x + e.face * 220, e.y, 0.45, { img: 'grenade', h: 18, vz: 160, onLand: pr => { if (game.room === room) summon(e, 'mech_emfield', { x: pr.x, y: pr.y, lv }); } }); })] }) });

/* ---- 二觉：终结者：博尔特 MX。天降的新型战斗机甲：锁定落点附近的敌人 → 肩上射出回旋炮（Raptor Mx2）→ 移动中步枪射击 4 发 → 激光剑连斩 3 次 → 冲向一个敌人自爆 ---- */
function boltTargets(s) { return foesNear(s.owner, s.x0, s.y0, 380, 200).filter(t => !t.dead).sort((a, b) => foeGrade(b) - foeGrade(a)); }
function boltAI(s, dt) {
  const o = s.owner, lv = s.lv, k = s.lifeT, T = s.timers; s.vx = s.vy = 0;
  const L = boltTargets(s), main = L[0] || null;
  if (k < 0.55) { s.phase = 'drop'; s.hz = Math.max(0, 420 * (1 - k / 0.55)); if (k + dt >= 0.55) { cam.shake = 9; sfx.boom(0.9); fxShock(s.x, s.y, 160, '#ffd0a0'); fxDust(s.x, s.y, 10, 30); } return; }
  s.hz = 0;
  if (k < 1.4) { s.phase = 'mx2'; if (!T.mx2 && main) { T.mx2 = true; const t = main, x0 = s.x, y0 = s.y; sfx.swing(true);
      addFx({ x: x0, y: y0 + 0.5, z: 110, tx: t.x, ty: t.y, dur: 0.35, draw(c) { const q = easeIn(this.t / this.dur); c.save(); c.translate(sx(lerp(this.x, this.tx, q)), sy(lerp(this.y, this.ty, q), lerp(110, 40, q))); c.rotate(game.t * 20); mP(c, '#8a96ae', () => c.rect(-10, -6, 20, 12), 2); c.restore(); } });
      for (let i = 0; i < 5; i++) game.after(0.35 + i * 0.1, () => { if (s.gone) return; summonArea(s, t.x, t.y, 70, { dmg: MECH_DMG.boltMx2(lv), type: 'mag', elem: 'light', stun: 0.3, knock: 0, hs: 0.01, sure: true, downHit: true, col: '#ffe8a0' }, { zMax: 200 }); fxSpr('spark', t.x, t.y, 40, { w: 60, dur: 0.12 }); });
      game.after(0.9, () => { if (s.gone) return; mechBoomFx(t.x, t.y, 0.8, 'light'); summonArea(s, t.x, t.y, 90, { dmg: MECH_DMG.boltMx2Boom(lv), type: 'mag', elem: 'light', launch: 360, knock: 100, hs: 0.06, sure: true, downHit: true }, { zMax: 220 }); }); }
    return; }
  if (k < 3.3) { s.phase = 'rifle'; const want = main ? main.x - Math.sign(main.x - s.x0 || 1) * 150 : s.x0; s.x = damp(s.x, want, 2.5, dt); s.face = main ? (main.x >= s.x ? 1 : -1) : o.face;
    T.r = (T.r ?? 0.2) - dt; if (T.r <= 0 && (s.nR || 0) < 4) { T.r = 0.45; s.nR = (s.nR || 0) + 1; const t = L[(s.nR - 1) % Math.max(1, L.length)]; if (!t) return; const big = s.nR === 4; sfx.cannon(big ? 0.8 : 0.5); s.fireFx = game.t + 0.12;
      addFx({ x: s.x + s.face * 60, y: s.y + 1, z: 96, tx: t.x, ty: t.y, tz: t.z + t.hurtH() * 0.5, dur: 0.1, add: true, big, draw(c) { c.save(); c.globalCompositeOperation = 'lighter'; c.strokeStyle = '#bfe8ff'; c.lineWidth = this.big ? 8 : 4; c.beginPath(); c.moveTo(sx(this.x), sy(this.y, this.z)); c.lineTo(sx(this.tx), sy(this.ty, this.tz)); c.stroke(); c.restore(); } });
      summonHit(s, t, { dmg: big ? MECH_DMG.boltRifle4(lv) : MECH_DMG.boltRifle(lv), type: 'mag', elem: 'light', stun: 0.45, knock: big ? 160 : 60, launch: big ? 300 : 0, hs: 0.06, sure: true, downHit: true, big: 1.4, col: '#bfe8ff' }); fxBurst(t.x, t.y, t.z + 40, big ? 120 : 70, '#bfe8ff'); }
    return; }
  if (k < 4.7) { s.phase = 'blade'; T.b = (T.b ?? 0) - dt; if (T.b <= 0 && (s.nB || 0) < 3) { T.b = 0.42; s.nB = (s.nB || 0) + 1; const t = L[(s.nB - 1) % Math.max(1, L.length)] || main; if (!t) return;
      s.face = t.x >= s.x ? 1 : -1; s.x = t.x - s.face * 50; s.y = t.y; sfx.iai(); cam.shake = Math.max(cam.shake, 5);
      fxSlash({ x: s.x, y: s.y, z: 0, face: s.face, col: '#ff8ae0' });
      summonArea(s, s.x + s.face * 55, s.y, 95, { dmg: MECH_DMG.boltBlade(lv), type: 'mag', elem: 'light', launch: 260, knock: 140, hs: 0.08, sure: true, downHit: true, big: 1.5, col: '#ffb0e8' }, { zMax: 220 }); }
    return; }
  if (k < 5.6) { s.phase = 'charge'; const t = main; if (t) { const dx = t.x - s.x; s.x += Math.sign(dx) * Math.min(Math.abs(dx), 700 * dt); s.y = damp(s.y, t.y, 8, dt); s.face = dx >= 0 ? 1 : -1; }
    if (!T.fin && (k > 5.4 || (t && Math.abs(t.x - s.x) < 30))) { T.fin = true; cam.shake = 14; cam.flash = 0.2; cam.flashCol = '#fff0e0'; mechBoomFx(s.x, s.y, 1.6, 'light');
      summonArea(s, s.x, s.y, 170, { dmg: MECH_DMG.boltFin(lv), type: 'mag', elem: 'light', launch: 520, knock: 220, hs: 0.14, sure: true, downHit: true, big: 2 }, { zMax: 300 }); s.life = Math.min(s.life, s.lifeT + 0.1); }
  }
}
defSummon('mech_bolt', { kind: 'follower', tags: ['mech'], max: 1, life: 5.8, keepRoom: false, speed: 0, w: 26, d: 16, h: 140, shadowR: 36, type: 'mag', noHold: true,
  model: () => MECH_NULL, onSpawn: s => { mechSpawn(s, 'bolt', { puff: false, hz: 420 }); s.x0 = s.x; s.y0 = s.y; }, ai: boltAI });
defSkill('gm_bolt', { name: '终结者：博尔特 MX', cls: 'gun', job: MC, lvReq: 27, maxLv: 3, mp: 250, cd: 170, pvp: 0.45, type: 'mag', elem: 'light', awaken: true, tier: 2, col: '#e84a8a',
  desc: '【二觉】召唤天界最新型的战斗机甲博尔特 MX 从天而降，自动锁定落点附近的敌人：先从肩上射出回旋炮连续打击后爆炸，再一边移动一边用步枪射击 4 发，随后拔出激光剑连斩 3 次，最后冲向一个敌人自爆。施放时无敌。',
  pow: lv => MECH_DMG.boltMx2(lv) * 5 + MECH_DMG.boltMx2Boom(lv) + MECH_DMG.boltRifle(lv) * 3 + MECH_DMG.boltRifle4(lv) + MECH_DMG.boltBlade(lv) * 3 + MECH_DMG.boltFin(lv), ai: { kind: 'awaken', r: [0, 400], dy: 120 },
  act: (lv) => ({ name: 'gm_bolt', clip: mclip('mAwk'), dur: 0.6, superArmor: true, invul: true, noCounter: true,
    onStart: e => { game.cutin = { t: 0, dur: 1.0, name: '终结者：博尔特 MX', who: cutinWho(e, 2) }; game.timeStop = 0.9; sfx.awaken(); },
    events: [evAt(0.1, e => { const s = summon(e, 'mech_bolt', { lv, x: e.x + e.face * 60, y: e.y }); if (s) { s.face = e.face; for (const t of boltTargets(s).slice(0, 5)) lockFx(t, 3.2); } })] }) });

/* ---- 三觉被动：微型制导 ---- */
defSkill('gm_micro', { name: '微型制导', cls: 'gun', job: MC, lvReq: 29, tier: 3, passive: true, type: 'mag', col: '#8ad8ff',
  desc: '【被动·三觉】引入微型机械技术：所有技能攻击力提高；旋雷者加装部件后，电磁波的纵向范围随在场的旋雷者数量扩大；G-磁力弹的磁力弹分解成纳米机器人，展开更大的电磁场，把范围内的敌人一起吸到中心。',
  infoExtra: lv => [['技能攻击力', '+' + pct(0.2 + 0.02 * (lv - 1))]] });

/* ---- 超时空光耀加农炮：小型机器人部队在前方投下能量弹 → 组装光耀加农炮（机器人部队变成护盾：霸体、减伤）→ 等离子放电引爆能量弹残留，4 次大爆炸 ---- */
function applyAreaMech(e, x, y, r, h) { for (const t of ents) if (foe(e, t) && t.invul <= 0 && inGround(t, x, y, r) && t.z < 220) applyHit(e, t, { type: 'mag', elem: 'light', downHit: true, sure: true, col: '#fff0a0', ...h, box: null }, { proj: true, src: { x: x - e.face * 10, y, z: 0, face: e.face } }); }
function hyperCast(e, lv) {
  const room = game.room, spots = [];
  for (let i = 0; i < 6; i++) { const x = e.x + e.face * (130 + i * 55 + rnd(-15, 15)), y = clamp(e.y + rnd(-40, 40), 6, DEPTH - 6); spots.push({ x, y });
    game.after(0.05 + i * 0.07, () => { if (game.room !== room || e.dead) return;
      addFx({ x: e.x, y: e.y + 0.5, z: 80, tx: x, ty: y, dur: 0.35, draw(c) { const q = this.t / this.dur; c.save(); c.translate(sx(lerp(this.x, this.tx, q)), sy(lerp(this.y, this.ty, q), 80 + Math.sin(q * Math.PI) * 60)); MECH_LOOK.sparrow(c, { sid: 0 }, game.t); c.restore(); } });
      game.after(0.35, () => { if (game.room !== room) return; fxBurst(x, y, 20, 70, '#fff0a0'); sfx.boom(0.3);
        applyAreaMech(e, x, y, 60, { dmg: MECH_DMG.hyperBomb(lv), launch: 200, knock: 40, hs: 0.03, stun: 0.4 });
        addFx({ x, y: y + 0.3, z: 0, dur: 1.2, draw(c) { const a = 0.6 + 0.4 * Math.sin(game.t * 20); drawSpr(c, fxTint('orb', '#ffe070'), sx(this.x), sy(this.y, 8), 26, 26, { alpha: a }); } }); }); }); }
  return spots;
}
defSkill('gm_hyper', { name: '超时空光耀加农炮', cls: 'gun', job: MC, lvReq: 29, tier: 3, mp: 200, cd: 60, type: 'mag', elem: 'light', col: '#ffc83a',
  desc: '派出小型机器人部队在前方投下 6 枚能量弹，同时组装光耀加农炮（组装时机器人部队变成护盾：霸体、受到的伤害降低），随后发射高温等离子，引爆能量弹的残留，造成 4 次大爆炸。可以取消普攻。',
  pow: lv => MECH_DMG.hyperBomb(lv) * 6 + MECH_DMG.hyperBoom(lv) * 4, ai: { kind: 'burst', r: [60, 460], dy: 60 },
  act: (lv) => ({ name: 'gm_hyper', clip: 'lAwk', dur: 1.7, superArmor: true, noCounter: true,
    onStart: e => { e.act.spots = hyperCast(e, lv); e.buffs.gm_hyper = { t: 1.7, taken: -0.3 }; sfx.charge(); },
    update: e => { if (e.actT < 0.9 && Math.random() < 0.5) fxCharge(e, '#ffe070', 2); },
    events: [evAt(0.95, e => { e.play('lAwkFire', true); sfx.cannon(1.4); sfx.iai(); cam.flash = 0.15; cam.flashCol = '#fff6d0'; fxBeam(e.x + e.face * 70, e.y, e.z + 48, 700, e.face, { w: 90, dur: 0.6, col: '#ffe890' }); }),
      ...[0, 1, 2, 3].map(i => evAt(1.1 + i * 0.12, e => { const S = e.act.spots || [], P = S.length ? S[Math.min(S.length - 1, Math.round(i * (S.length - 1) / 3))] : { x: e.x + e.face * (180 + i * 80), y: e.y };
        mechBoomFx(P.x, P.y, 1.0, 'light'); applyAreaMech(e, P.x, P.y, 120, { dmg: MECH_DMG.hyperBoom(lv), launch: 380, knock: 120, hs: 0.08, big: 1.6 }); }))] }) });

/* ---- 三觉：G-X 星尘天穹（需要 G 系列；和一觉绑定：G-0 冷却中不能用，用了之后 G-0 进入冷却；G-1 冷却重置）
   G 系列分解成无数微型机械飞上天，组成覆盖前方的机械穹顶，放电后降下 8 道激光，最后穹顶承受不住爆炸（7 段） ---- */
function stardustAI(s, dt) {
  const lv = s.lv, k = s.lifeT, T = s.timers; s.vx = s.vy = 0; s.hz = 0;
  if (k < 0.9) { if (Math.random() < 0.9) addFx({ x: s.owner.x + rnd(-40, 40), y: s.y + 0.4, z: 40, tx: s.x + rnd(-280, 280), tz: 260 + rnd(-30, 30), dur: 0.5, draw(c) { const q = easeOut(this.t / this.dur); drawSpr(c, 'spark', sx(lerp(this.x, this.tx, q)), sy(this.y, lerp(this.z, this.tz, q)), 16, 0, {}); } }); return; }
  if (k < 2.6) { T.l = (T.l ?? 0.1) - dt; if (T.l <= 0 && (s.nL || 0) < 8) { T.l = 0.2; s.nL = (s.nL || 0) + 1; const L = foesNear(s.owner, s.x, s.y, 300, 150), t = L.length ? L[(s.nL - 1) % L.length] : null, x = t ? t.x : s.x + rnd(-250, 250), y = t ? t.y : clamp(s.y + rnd(-60, 60), 6, DEPTH - 6);
      addFx({ x, y: y + 1, z: 0, dur: 0.3, add: true, draw(c) { const q = this.t / this.dur, X = sx(this.x), Y = sy(this.y, 0), w = 26 * (1 - q); c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = `rgba(255,150,230,${0.8 * (1 - q)})`; c.fillRect(X - w / 2, Y - 300, w, 300); c.fillStyle = `rgba(255,255,255,${1 - q})`; c.fillRect(X - w / 5, Y - 300, w / 2.5, 300); c.restore(); } });
      fxBurst(x, y, 10, 90, '#ff9ae0'); sfx.iai(); summonArea(s, x, y, 90, { dmg: MECH_DMG.sdLaser(lv), type: 'mag', elem: 'light', stun: 0.5, launch: 200, knock: 20, hs: 0.05, sure: true, downHit: true, col: '#ffb0e8' }, { zMax: 400 }); }
    return; }
  if (k < 2.8) return;
  T.d = (T.d ?? 0) - dt; if (T.d <= 0 && (s.nD || 0) < 7) { T.d = 0.12; s.nD = (s.nD || 0) + 1; cam.shake = Math.max(cam.shake, 10); if (s.nD === 1) { cam.flash = 0.25; cam.flashCol = '#fff0fa'; sfx.boom(1.5); }
    mechBoomFx(s.x + rnd(-220, 220), clamp(s.y + rnd(-50, 50), 6, DEPTH - 6), 1.2, 'light');
    summonArea(s, s.x, s.y, 320, { dmg: MECH_DMG.sdDome(lv), type: 'mag', elem: 'light', launch: s.nD === 7 ? 520 : 160, knock: 60, hs: 0.06, sure: true, downHit: true, big: 1.8, col: '#ffd0f0' }, { zMax: 400 }); }
}
function stardustDome(c, S) {
  const k = S.lifeT, a = clamp((k - 0.4) / 0.5, 0, 1) * (k > 2.8 ? clamp(1 - (k - 2.8) / 0.4, 0, 1) : 1); if (a <= 0) return;
  const X = sx(S.x), Y = sy(S.y, 0), R = 300; c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = a; c.strokeStyle = '#ffb0e8'; c.lineWidth = 2;
  for (let i = 0; i < 6; i++) { const r = R * (0.35 + i * 0.13); c.beginPath(); c.ellipse(X, Y, r, r * 0.55, 0, Math.PI, TAU); c.stroke(); }
  for (let i = 0; i <= 10; i++) { const q = Math.PI + i / 10 * Math.PI; c.beginPath(); c.moveTo(X, Y - R * 0.55); c.lineTo(X + Math.cos(q) * R, Y + Math.sin(q) * R * 0.55); c.stroke(); }
  c.fillStyle = `rgba(255,170,230,${0.12 + 0.08 * Math.sin(game.t * 12)})`; c.beginPath(); c.ellipse(X, Y, R, R * 0.55, 0, Math.PI, TAU); c.fill(); c.restore();
}
defSummon('mech_stardust', { kind: 'follower', tags: ['mech'], max: 1, life: 3.8, keepRoom: false, speed: 0, w: 10, d: 10, h: 10, shadowR: 0, type: 'mag', noHold: true,
  model: () => MECH_NULL, onSpawn: s => { s.timers = {}; s.dome = addFx({ s, y: s.y - 60, dur: 4, add: true, draw(c) { if (this.s.gone) { this.t = this.dur; return; } stardustDome(c, this.s); } }); },
  ai: stardustAI });
defSkill('gm_stardust', { name: 'G-X 星尘天穹', cls: 'gun', job: MC, lvReq: 30, maxLv: 1, mp: 380, cd: 270, pvp: 0.45, type: 'mag', elem: 'light', awaken: true, tier: 3, col: '#ff7ad8',
  desc: '【三觉】需要 G 系列在场。G 系列分解成无数微型机械“星尘”飞上天空，组成覆盖前方的巨大机械穹顶，放电后降下 8 道激光，最后穹顶承受不住冲击爆炸（7 段）。施放时无敌；G-1 科罗纳的冷却立刻重置。和一觉绑定：改装：G-0 战争领主冷却中不能使用，使用后 G-0 也进入冷却。',
  pow: lv => MECH_DMG.sdLaser(lv) * 8 + MECH_DMG.sdDome(lv) * 7, ai: { kind: 'awaken', r: [0, 500], dy: 140 },
  req: p => !gsUnits(p).length ? '需要 G 系列在场' : (p.cool.gm_g0 || 0) > 0 ? 'G-0 战争领主冷却中' : true,
  act: (lv) => ({ name: 'gm_stardust', clip: mclip('mAwk'), dur: 1.0, superArmor: true, invul: true, noCounter: true,
    onStart: e => { game.cutin = { t: 0, dur: 1.0, name: 'G-X 星尘天穹', who: cutinWho(e, 3) }; game.timeStop = 0.9; sfx.awaken(); },
    events: [evAt(0.1, e => { dismissSummons(e, GS_Q, 'tf'); gsState(e).stacks = 0; e.cool.gm_g1 = 0; e.cool.gm_g0 = Math.max(e.cool.gm_g0 || 0, SKILLS.gm_g0.cd * (e.cdMul || 1));
      summon(e, 'mech_stardust', { lv, x: e.x + e.face * 260, y: e.y }); })] }) });
// G-X 主宰者：除觉醒外所有技能冷却 -15%（castSkill 之后按比例缩短）
if (typeof bus !== 'undefined') bus.on('skillUse', e => { const p = game.player, S = e && SKILLS[e.id]; if (!p || !S || !isMech(p) || !hasGop(p) || S.awaken || !(p.cool[e.id] > 0)) return; p.cool[e.id] *= 0.85; });

/* =====================================================================
   职业钩子（包一层，先调原来的）：受击前（伪装回避 / 常驻减伤）、受击后（危机追击者、伪装被打破）、被动刷新
   ===================================================================== */
{ const prev = CLASSES.gun.beforeHurt;
  CLASSES.gun.beforeHurt = (t, a, h, opt) => {
    const r = prev ? prev(t, a, h, opt) : null; if ((r && r.block) || !isMech(t)) return r;
    let mul = 1; const cl = skLv(t, 'gm_camo'); if (cl) mul *= 1 - camoDr(cl);
    if (cloakOn(t) && !h.sure && !h.grab && Math.random() < camoEv(t.cloakLv || cl || 1)) { fxText('MISS', t.x, t.y, t.z, { col: '#d8d8d8', size: 12, dur: 0.5 }); return { block: true }; }
    if (mul === 1) return r; return { ...(r || {}), mul: ((r && r.mul) ?? 1) * mul };
  }; }
{ const prev = CLASSES.gun.onHurt;
  CLASSES.gun.onHurt = (p, a, h, dmg) => {
    if (prev) prev(p, a, h, dmg); if (!isMech(p)) return;
    if (cloakOn(p)) p.cloakT = 0;
    const lv = skLv(p, 'gm_backup');
    if (lv && !(p._bkT > game.t) && Math.random() < 0.1 * lv) { p._bkT = game.t + (3 - 0.1 * (lv - 1)); const s = mechRx78(p, skLv(p, 'g_rx78') || 1, { extra: true, x: p.x - p.face * 10, y: p.y }); if (s) { fxText('危机追击者', p.x, p.y, p.z + 20, { col: '#ffb060', size: 10, dur: 0.6 }); sfx.mech(); } }
  }; }
CLASSES.gun.passives.push(p => {
  if (!isMech(p)) { if (p.mechHold) p.mechHold = false; return; }
  const ht = skLv(p, 'gm_hitech'); setPassive(p, 'gm_hitech', ht > 0, { dmg: 0.10 + 0.015 * (ht - 1) });
  const cv = skLv(p, 'gm_convert'); setPassive(p, 'gm_convert', cv > 0, { dmg: 0.12 + 0.02 * (cv - 1), crit: 0.1 });
  const mc = skLv(p, 'gm_micro'); setPassive(p, 'gm_micro', mc > 0, { dmg: 0.2 + 0.02 * (mc - 1) });
  // 机械改良：每秒耗 MP，不够时自动关闭
  const R = p.buffs.gm_robotics; if (R) { const d = R.drain * 0.25; if (p.mp < d) { delete p.buffs.gm_robotics; fxText('机械改良：MP 不足', p.x, p.y, p.z + 10, { col: '#9fd8ff', size: 10 }); } else p.mp -= d; }
  // G 系列：旋雷者充电（学了 G 系扩张后其他形态也充）；没有 G 系列时层数清零；层数显示在 BUFF 栏
  const G = gsState(p), f = gsForm(p);
  if (!f) G.stacks = 0;
  if (f === 'g2' || (f && gextLv(p))) G.chg = Math.min(1, (G.chg || 0) + 0.25 / G2_CHARGE);
  setPassive(p, 'gm_gext', !!(f && G.stacks > 0), { n: G.stacks, name: 'G 系扩张' });
  if (cloakOn(p)) cloakWrap(p);
});

/* =====================================================================
   转职登记：转职窗口的卡片、技能、指令、转职任务线（凯丽 → 辛达「马柏斯的仆人」→ 60 白色小晶块 + 2 强大魔力火种 → 凯丽）
   ===================================================================== */
CLASSES.gun.jobs.mechanic = { art: 'job/mechanic', name: '机械师', role: '远程 · 召唤机器人', armor: 'cloth', dmgType: 'mag', growth: { int: 1.1, spr: 1.04 },
  awaken: 'gm_g0', awakenName: '机械之心', awakenName2: '机械之灵', awakenName3: '重霄·机械师',
  desc: '来自天界的机械工学天才。放出 RX-78、EZ-8、G 系列、毒蛇炮、狂风等机器人替自己作战，靠遥控器改装、引爆、指挥它们。魔法伤害职业，机器人的伤害按魔攻实时结算。',
  skills: ['gm_hitech', 'gm_ez8', 'gm_robotics', 'gm_detonate', 'gm_backup', 'gm_g1', 'gm_g2', 'gm_viper', 'gm_convert', 'gm_camo', 'gm_hold', 'gm_g3', 'gm_gale', 'gm_magnet', 'gm_drop',
    'gm_factory', 'gm_solar', 'gm_gext', 'gm_g0', 'gm_hs12', 'gm_frisbee', 'gm_gop', 'gm_falcon', 'gm_field', 'gm_bolt', 'gm_micro', 'gm_hyper', 'gm_stardust'],
  // 新人物动作（外观流水线：art/tools/mech_art.py pose / avatar；sprites.js 读 J.anims 合进 SPR_ANIMS.gun）
  anims: { mSet: [['mSet1', 0], ['mSet2', 0.14]], mRemote: [['mRemote1', 0], ['mRemote2', 0.08]], mCall: [['mCall', 0]], mPoint: [['mPoint', 0]], mAwk: [['mAwk1', 0], ['mAwk2', 0.45]] },
  trial: 'q_jl_mechanic_3',
  // 转职任务线（quests/job.js 统一 defineQuest；用 getter 是因为 QR 在任务文件里才定义）
  get quests() {
    return [
      ['q_jl_mechanic_1', { name: '马柏斯的仆人', npc: 'kiri', to: 'sinda', lvl: 15, pre: 'q_job_gun_final',
        desc: '凯丽说，想成为机械师，先得弄明白天界的机械是怎么“活”过来的。去赫顿玛尔问问材料商人辛达，打听「马柏斯的仆人」的下落。',
        talk: { offer: ['机械师？嘿嘿，这可是天界最酷的职业！', '不过呢，机器人可不是扳手敲一敲就会动的。它们需要“心脏”。', '辛达那里好像收着一台很古老的天界机器人——叫「马柏斯的仆人」。去问问她吧！'],
          done: ['……凯丽让你来的？那台老机器人，确实在我这儿。', '它的动力核心早就熄火了，想让它重新动起来，得先给它找点“燃料”。'] },
        reward: QR(15, 0.03, 300) }],
      ['q_jl_mechanic_2', { name: '重新点燃的核心', npc: 'sinda', lvl: 15, pre: 'q_jl_mechanic_1',
        desc: '给「马柏斯的仆人」的动力核心补充能量：带来 60 个白色小晶块，再从烈焰格拉卡带回 2 个强大魔力火种。',
        goals: [{ type: 'item', key: 'c_white', n: 60 }, { type: 'collect', key: 'q_magic_tinder', item: '强大魔力火种', icon: 'q_magic_tinder', from: ['goblinRed', 'goblinBomber', 'tauBeast', 'flameMage'], dungeon: 'blazing_graca', rate: 0.3, n: 2,
          desc: '在烈焰格拉卡的火焰里淬炼出来的魔力火种，握在手心也不会熄灭。' }],
        talk: { offer: ['白色小晶块里藏着光的力量，天界的机器全靠它驱动——60 个，一个都不能少。', '光有能量还不够，得有火种把它点燃。烈焰格拉卡的怪物身上能找到「强大魔力火种」，带 2 个回来。'],
          doing: ['白色小晶块卡坤的店里就有卖。火种得自己去烈焰格拉卡找。'], done: ['……你听，核心在响了！', '它醒过来了——带它去见凯丽吧，她知道接下来该怎么做。'] },
        reward: QR(15, 0.06, 800) }],
      ['q_jl_mechanic_3', { name: '机械师之路', npc: 'sinda', to: 'kiri', lvl: 15, pre: 'q_jl_mechanic_2',
        desc: '带着重新运转的「马柏斯的仆人」回到凯丽那里。',
        talk: { offer: ['去吧，凯丽在等你。'], done: ['哇！它真的动起来了！', '拆开、改装、再组装——这就是机械师的战斗方式。从今天起，你的机器人就是你的枪！', '好啦，在我这里完成转职吧~'] },
        reward: QR(15, 0.04, 500) }],
    ];
  } };
CLASSES.gun.cmds.push(['dd', 'gm_ez8'], ['ff', 'gm_robotics', 'buff'], ['bf', 'gm_detonate', 'buff'], ['bf', 'gm_g1'], ['uff', 'gm_g2'], ['fdf', 'gm_viper'], ['ud', 'gm_camo', 'buff'],
  ['udf', 'gm_hold', 'buff'], ['udf', 'gm_g3'], ['udu', 'gm_gale'], ['dff', 'gm_magnet'], ['bdf', 'gm_drop'], ['udd', 'gm_factory'], ['uudd', 'gm_g0'],
  ['fbdf', 'gm_hs12'], ['duf', 'gm_frisbee'], ['fbf', 'gm_falcon'], ['fbuf', 'gm_field'], ['duff', 'gm_bolt'], ['udff', 'gm_hyper'], ['bufd', 'gm_stardust']);
