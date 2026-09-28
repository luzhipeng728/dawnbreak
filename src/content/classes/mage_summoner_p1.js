/* =====================================================================
   召唤师 P1（一觉之后）：融合精灵海伊伦、支配之环、咒令：愤怒咆哮、蚀月附灵（上级精灵 / 精灵王 / 拉莫斯的附灵）、狂化黑月、
   传说召唤：月蚀之影、二觉“逆月者拉莫斯”、咒令：逆月之蚀、逆月、至高精灵王、三觉“魔月·德拉里昂”（docs/SKILLS_OFFICIAL_mage.md 3.2）
   露易丝暴走 / 袄索“蚀”形态用运行时换色，不另出帧；德拉里昂按文档做成插图式演出（觉醒插图 + 运行时画的月面和巨口）
   ===================================================================== */
const ECL = '#8a4ad0';
// ---- 融合精灵海伊伦：贴在肩膀旁边，不攻击；在场时给本体加属性攻击、给 600px 内的队友加速度，上级精灵霸体、全部召唤兽免疫异常 ----
smDef('sm_hilun', 'hilun', { h: 52, speed: 300, pref: 0, tags: ['spirit', 'fusion'], col: '#ffc0ff' });
SUMMON_DEFS.sm_hilun.ai = s => { const o = s.owner, gx = o.x - o.face * 30, gy = o.y - 6, dx = gx - s.x, dy = gy - s.y;
  if (Math.abs(dx) > 400) { s.warp(gx, gy); return; }
  if (Math.abs(dx) > 4 || Math.abs(dy) > 3) { s.vx = dx * 6; s.vy = dy * 6; s.setState('walk'); } else { s.vx = s.vy = 0; s.setState('idle'); } s.face = o.face; };
defSkill('sm_hilun', { noHitCheck: true, name: '融合精灵海伊伦', cls: 'mage', job: SM, tier: 1, lvReq: 23, mp: 60, cd: 10, type: 'mag', col: '#ffc0ff', cast: true,
  desc: '召唤融合精灵海伊伦（常驻，不攻击），贴在你身边：提高你的技能攻击力；600px 内的你和队友攻击速度、移动速度、施放速度提高；上级精灵获得霸体；全部召唤兽免疫异常状态。',
  ai: { kind: 'buff', summon: 'sm_hilun' }, infoExtra: lv => [['技能攻击力', '+' + pct(0.05 + 0.01 * lv)], ['攻速 / 移速 / 施放速度', '+' + pct(0.06 + 0.01 * lv)]],
  act: (lv) => smSummonAct('sm_hilun', lv) });
// ---- 支配之环：极快地依次召出全部已学、当前不在场的召唤兽（卡西利亚斯、拉莫斯除外） ----
const SM_RING = [['sm_lesser', LESSER], ['sm_frit', 'sm_frit'], ['sm_sandor', 'sm_sandor'], ['sm_aukuso', 'sm_aukuso'], ['sm_merkle', 'sm_merkle'], ['sm_glarelin', 'sm_glarelin'], ['sm_aqueris', 'sm_aqueris'],
  ['sm_flamehulk', 'sm_flamehulk'], ['sm_luise', 'sm_luise'], ['sm_echeverria', 'sm_echeverria'], ['sm_kuruta', 'sm_kuruta'], ['mg_hodor', 'hodor'], ['sm_hilun', 'sm_hilun']];
defSkill('sm_ring', { name: '支配之环', cls: 'mage', job: SM, tier: 1, lvReq: 23, mp: 150, cd: 60, type: 'mag', col: '#b08aff', cast: true,
  desc: '举起支配之环，极快地依次召出你已学会、当前不在场的全部召唤兽（卡西利亚斯、拉莫斯除外）。', ai: { kind: 'buff' },
  act: () => ({ name: 'sm_ring', clip: 'smSummon', dur: 1.1, cancelFrom: 0.9, noCounter: true, events: [evAt(0.2, e => { sfx.magic(); fxShock(e.x, e.y, 160, '#b08aff'); let i = 0;
    for (const [id, keys] of SM_RING) { const lv = skLv(e, id); if (lv <= 0) continue;
      for (const k of [].concat(keys)) { if (summonsOf(e, k).length) continue; const j = i++; mgAfter(e, 0.06 * j, () => summon(e, k, { lv, mul: k === 'hodor' ? lvMul(lv, 0.1) : smMul(e, lv), x: e.x + e.face * (40 + (j % 5) * 22), y: clamp(e.y + ((j % 3) - 1) * 18, 6, DEPTH - 6) })); } } })] }) });
// ---- 咒令：愤怒咆哮（库鲁塔） ----
SUMMON_DEFS.sm_kuruta.cmds.rage = (s, arg) => { smFront(s, arg); summonAct(s, { clip: 'roar', dur: 2.2, superArmor: true, events: [
  evAt(0.3, e => { sfx.boom(0.7); cam.shake = Math.max(cam.shake, 5); fxShock(e.x, e.y, 200, '#ffb060'); summonArea(e, e.x, e.y, 170, { dmg: 0.8, stun: 0.8, knock: 20, hs: 0.04, type: 'mag' }, { status: 'stun', sdur: 1.0 }); }),
  ...[0.7, 0.95, 1.2, 1.45].map((t, i) => evAt(t, e => { e.play('axe', true); sfx.swing(true); cam.shake = Math.max(cam.shake, 4); fxShock(e.x + e.face * 70, e.y, 120, '#ffb060');
    summonArea(e, e.x + e.face * 70, e.y, 110, { dmg: 1.2, stun: 0.5, knock: 30, hs: 0.05, type: 'mag', downHit: true }, { zMax: 150 }); })),
  evAt(1.8, e => { e.play('axe', true); sfx.boom(1.2); cam.shake = Math.max(cam.shake, 9); fxShock(e.x + e.face * 80, e.y, 260, '#ffb060'); fxBurst(e.x + e.face * 80, e.y, 30, 260, '#ffd090');
    summonArea(e, e.x + e.face * 80, e.y, 170, { dmg: 4.0 * ((arg && arg.mul) || 1), launch: 420, knock: 160, hs: 0.12, big: 1.7, type: 'mag', downHit: true }, { zMax: 220 }); })] }); };
const smOrder = (key, cmd, name) => (lv) => ({ name: 'sm_cmd', clip: 'smCmd', dur: 0.35, noCounter: true, onStart: e => { summonCmd(e, key, cmd, { ...smCmdArg(e), mul: lvMul(lv, 0.1) }); fxText(name, e.x, e.y, e.z + 30, { col: '#e0c0ff', size: 10, dur: 0.5 }); } });
defSkill('sm_roar', { name: '咒令：愤怒咆哮', cls: 'mage', job: SM, tier: 1, lvReq: 25, mp: 60, cd: 25, type: 'mag', col: '#e0a060', req: p => summonsOf(p, 'sm_kuruta').length > 0 || '库鲁塔不在场',
  desc: '库鲁塔在场时才能用：它跑到你前方咆哮（眩晕），斧头快速砸地 4 次，最后一记重击。', pow: lv => skillDmg(20, 2, lv), ai: { kind: 'aoe', r: [0, 300], dy: 80 }, act: smOrder('sm_kuruta', 'rage', '愤怒咆哮') });
// ---- 蚀月附灵（二觉被动）：上级精灵、精灵王、拉莫斯再按一次召唤键 = 附灵（瞬移到你前方放专属招，冷却 15 秒） ----
defSkill('sm_eclipse', { name: '蚀月附灵', cls: 'mage', job: SM, tier: 2, lvReq: 26, passive: true, type: 'mag', col: ECL,
  desc: '【被动·二觉】技能攻击力提高。解锁附灵：上级精灵、精灵王、拉莫斯在场时再按一次召唤键，它瞬移到你前方放专属招（按住 ↓ 再按则瞬移到你脚下）。默克尔：五片暗区；格雷林：巨型落雷；阿奎利斯：七重冰导弹；赫瑞克：火焰爆剑；伊伽贝拉：四属性旋转激光；拉莫斯：蚀旋（大范围聚怪）。',
  infoExtra: lv => [['技能攻击力', '+' + pct(0.15 + 0.02 * lv)]] });
const smPossess = (key, cd) => ({ ok: p => jobOf(p) === SM && hasSkill(p, 'sm_eclipse') && summonsOf(p, key).length > 0, cd, mp: 20, instant: true,
  act: (lv, p) => { smOrderNow(p, key, 'special', '附灵'); } });
for (const id of ['sm_merkle', 'sm_glarelin', 'sm_aqueris', 'sm_flamehulk', 'sm_echeverria']) SKILLS[id].recast = smPossess(id, 15);
SUMMON_DEFS.sm_merkle.cmds = { special(s, arg) { smFront(s, arg); summonAct(s, { clip: 'cast', dur: 0.9, events: [evAt(0.4, e => { sfx.magic(); const o = e.owner, cx = o.x + o.face * 130;
  for (const [dx, dy] of [[0, 0], [110, 0], [-110, 0], [0, 50], [0, -50]]) { const f = summon(o, 'sm_darkfield', { x: cx + dx, y: clamp(o.y + dy, 8, DEPTH - 8) }); if (f) { f.dmg = 0.45 * e.mul; f.life = 4; } } })] }); } };
SUMMON_DEFS.sm_darkfield.max = 8;
SUMMON_DEFS.sm_glarelin.cmds = { special(s, arg) { smFront(s, arg); summonAct(s, { clip: 'roar', dur: 1.0, events: [evAt(0.45, e => { const t = summonTarget(e) || { x: e.x + e.face * 160, y: e.y };
  sfx.boom(1.0); cam.shake = Math.max(cam.shake, 7); for (let i = 0; i < 3; i++) lightningStrike({ x: t.x + (i - 1) * 16, y: t.y }); fxShock(t.x, t.y, 200, '#fff38a'); smBolt(e, t.x, t.y, 3.0, { r: 110, shock: 0.5 }); })] }); } };
SUMMON_DEFS.sm_aqueris.cmds = { special(s, arg) { smFront(s, arg); summonAct(s, { clip: 'cast', dur: 1.2, events: [evAt(0.35, e => { sfx.ice();
  for (let i = 0; i < 7; i++) game.after(i * 0.08, () => { if (!e.gone) smShot(e, { dmg: 0.6, col: '#bfefff', elem: 'ice', img: 'icespike', home: true, speed: 460, life: 1.5, hit: { onHit: (a, t) => { if (Math.random() < 0.15) addStatus(t, 'freeze', 1.2, { src: a.owner }); } } }); }); })] }); } };
SUMMON_DEFS.sm_flamehulk.cmds = { special(s, arg) { smFront(s, arg); summonAct(s, { clip: 'club', dur: 1.0, superArmor: true, events: [evAt(0.42, e => { sfx.hit('fire', true); cam.shake = Math.max(cam.shake, 6);
  fxSlash({ x: e.x, y: e.y, z: e.z, face: e.face, col: '#ff8a3a', a0: -1.6, a1: 1.2, r: 170, w: 26, off: [10, 80], dur: 0.26 }); fxBurst(e.x + e.face * 110, e.y, 50, 220, '#ffb060');
  summonArea(e, e.x + e.face * 110, e.y, 150, { dmg: 3.2, launch: 320, knock: 120, hs: 0.1, big: 1.4, elem: 'fire', type: 'mag', downHit: true }, { zMax: 200, status: 'burn', sdur: 3, dps: 0.08 }); })] }); } };
// 伊伽贝拉附灵“四属性旋转激光”：火 / 冰 / 光 / 暗四道激光（相隔 90°）从她身上射出，绕着她在地面平面上转一圈；每道激光扫过敌人时打一下
function echeRotBeams(e, o) {
  const L = o.len || 420, n = o.n || 4, dur = o.dur || 1.2, spin = (o.turns || 1) * TAU / dur, a0 = e.face > 0 ? 0 : Math.PI, last = new Map();
  const beam = (i, t) => a0 + i * TAU / n + spin * t * (e.face > 0 ? 1 : -1);
  addFx({ x: e.x, y: e.y + 1, z: 0, dur, e, update() { const t = this.t, E = this.e; if (E.gone) return;
      for (const tg of ents) { if (!foe(E.owner, tg) || tg.dead || tg.z > 220) continue; const dx = tg.x - E.x, dy = (tg.y - E.y) / GR, d = Math.hypot(dx, dy); if (d > L + tg.w || d < 1) continue;
        const phi = Math.atan2(dy, dx);
        for (let i = 0; i < n; i++) { let da = (phi - beam(i, t)) % TAU; if (da > Math.PI) da -= TAU; if (da < -Math.PI) da += TAU;
          const k = tg.id * 8 + i; if (Math.abs(da) < 0.16 + tg.w / Math.max(d, 40) && !(game.t - (last.get(k) ?? -9) < dur * 0.6)) { last.set(k, game.t); const [el, col] = o.elems[i % o.elems.length];
            summonHit(E, tg, { dmg: o.dmg, stun: 0.4, knock: 10, hs: 0.03, elem: el, type: 'mag', col }); } } } },
    draw(c) { const E = this.e, k = this.t / this.dur, X = sx(E.x), Y = sy(E.y, E.z + 70), a = k < 0.1 ? k / 0.1 : k > 0.88 ? (1 - k) / 0.12 : 1;
      for (let i = 0; i < n; i++) { const th = beam(i, this.t), vx = Math.cos(th) * L, vy = Math.sin(th) * L * GR, [, col] = o.elems[i % o.elems.length];
        drawSpr(c, fxTint('laser', col), X, Y, Math.hypot(vx, vy), o.w || 30, { ax: 0, ay: 0.5, rot: Math.atan2(vy, vx), alpha: a }); } } });
}
SUMMON_DEFS.sm_echeverria.cmds = { special(s, arg) { smFront(s, arg); summonAct(s, { clip: 'cast', dur: 1.6, superArmor: true, events: [evAt(0.3, e => { sfx.zap(); fxShock(e.x, e.y, 120, '#ffd070'); echeRotBeams(e, { elems: ELEM4, dmg: 0.9, dur: 1.2 }); }),
  ...[0.55, 0.85, 1.15].map(t => evAt(t, () => sfx.zap()))] }); } };
// ---- 狂化黑月（露易丝暴走 15 秒）：霸体、换色，招式换成蚀枪 / 月之破碎 / 追踪月光 ----
const luiseFrenzy = s => s.frenzyT > game.t;
for (const A of SUMMON_DEFS.sm_luise.attacks) { const c0 = A.cond; A.cond = (s, t) => !luiseFrenzy(s) && (!c0 || c0(s, t)); }
SUMMON_DEFS.sm_luise.attacks.push(
  { clip: 'cast', range: [60, 440], dy: 60, cd: [0.8, 1.2], w: 3, cond: luiseFrenzy, act: { dur: 0.6, events: [evAt(0.3, s => { sfx.magic(); smShot(s, { dmg: 1.0, col: ECL, elem: 'dark', img: 'darkorb', speed: 700, size: 1.5, pierce: true }); })] } },
  { clip: 'club', range: [0, 130], dy: 30, cd: [1.6, 2.2], w: 2, cond: luiseFrenzy, act: { dur: 0.8, superArmor: true, events: [evAt(0.4, s => { sfx.boom(0.8); fxShock(s.x + s.face * 60, s.y, 160, ECL); fxBurst(s.x + s.face * 60, s.y, 60, 180, '#e0d0ff');
    summonArea(s, s.x + s.face * 60, s.y, 120, { dmg: 1.6, launch: 300, knock: 80, hs: 0.06, elem: 'dark', type: 'mag', downHit: true }, { zMax: 180 }); })] } },
  { clip: 'cast', range: [100, 520], dy: 120, cd: [2.4, 3.2], w: 1, cond: luiseFrenzy, act: { dur: 0.8, events: [evAt(0.35, s => { for (let i = 0; i < 3; i++) game.after(i * 0.1, () => { if (!s.gone) smShot(s, { dmg: 0.6, col: '#e8e0ff', elem: 'light', img: 'orb', home: true, speed: 420, life: 1.6 }); }); })] } });
SUMMON_DEFS.sm_luise.cmds.frenzy = (s) => { s.frenzyT = game.t + 15; s.superArmor = Infinity; s.baseModel = s.baseModel || s.model; s.model = summonSprite('luise', { hue: 250, bright: 0.8, sat: 0.7 }, ECL); s.acd = s.acd.map(() => 0); fxShock(s.x, s.y, 140, ECL); fxBurst(s.x, s.y, 60, 160, ECL); };
{ const u0 = SUMMON_DEFS.sm_luise.update; SUMMON_DEFS.sm_luise.update = (s, dt) => { if (u0) u0(s, dt); if (s.frenzyT && !luiseFrenzy(s)) { s.frenzyT = 0; if (s.baseModel) s.model = s.baseModel; } else if (luiseFrenzy(s) && Math.random() < 0.15) fxSpr('spark', s.x + rnd(-16, 16), s.y + 1, s.z + rnd(30, 110), { w: 16, dur: 0.2, col: ECL }); }; }
defSkill('sm_blackmoon', { name: '狂化黑月', cls: 'mage', job: SM, tier: 2, lvReq: 26, mp: 80, cd: 30, type: 'mag', col: ECL, req: p => summonsOf(p, 'sm_luise').length > 0 || '露易丝不在场',
  desc: '露易丝在场时才能用：她暴走 15 秒，获得霸体，攻击换成蚀枪（穿透）、月之破碎（范围）、追踪月光。', ai: { kind: 'buff' }, act: smOrder('sm_luise', 'frenzy', '狂化黑月') });
// ---- 传说召唤：月蚀之影：前方铺一片“蚀”，爆炸 15 次；区域里自己的召唤兽身上也跟着爆炸 ----
defSummon('sm_eclZone', { kind: 'field', r: 150, tick: 0.2, hits: 15, life: 3.2, max: 1, col: ECL, keepRoom: false,
  onTick(s) { const o = s.owner, x = s.x + rnd(-120, 120), y = clamp(s.y + rnd(-40, 40), 8, DEPTH - 8); sfx.boom(0.4); fxBurst(x, y, 30, 110, ECL);
    summonArea(s, x, y, 90, { dmg: s.dmg || 1, stun: 0.4, knock: 20, hs: 0.03, elem: 'dark', type: 'mag', downHit: true }, { zMax: 200 });
    for (const m of summonsOf(o).filter(m => m.kind === 'follower' && inGround(m, s.x, s.y, 170))) if (Math.random() < 0.35) { fxBurst(m.x, m.y, 60, 90, '#c79aff'); summonArea(s, m.x, m.y, 70, { dmg: (s.dmg || 1) * 0.6, stun: 0.3, knock: 10, hs: 0.02, elem: 'dark', type: 'mag', downHit: true }, { zMax: 200 }); } },
  draw(c, s) { const k = s.lifeT / s.life, a = k < 0.1 ? k * 10 : k > 0.85 ? (1 - k) / 0.15 : 1; c.save(); c.translate(sx(s.x), sy(s.y, 0)); c.scale(1, GR); c.globalAlpha = 0.7 * a; c.fillStyle = '#14081e';
    c.beginPath(); c.arc(0, 0, 150, 0, TAU); c.fill(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.8 * a; drawSpr(c, fxTint('vortex', ECL), 0, 0, 320, 320, { rot: game.t * 2 }); c.restore(); } });
defSkill('sm_shadow', { name: '传说召唤：月蚀之影', cls: 'mage', job: SM, tier: 2, lvReq: 26, mp: 100, cd: 40, type: 'mag', elem: 'dark', col: ECL, cast: true,
  desc: '在前方铺一片“蚀”，3 秒内爆炸 15 次；区域里你自己的召唤兽身上也会跟着爆炸。', pow: lv => skillDmg(22, 2.2, lv), ai: { kind: 'aoe', r: [40, 300], dy: 70 },
  act: (lv) => ({ name: 'sm_shadow', clip: 'smSac', dur: 0.6, cancelFrom: 0.45, noCounter: true, events: [evAt(0.25, e => { const at = aimAhead(e, 170, 300); sfx.charge(); const s = summon(e, 'sm_eclZone', { x: at.x, y: at.y, lv }); if (s) s.dmg = skillDmg(1.3, 0.13, lv); })] }) });
// ---- 二觉：逆月者拉莫斯（在场 200 秒，除冲刺外霸体；离场时升空放光柱） ----
let LAM_ANIMS = null;
const lamAnims = () => LAM_ANIMS || (LAM_ANIMS = { ...SPR_ANIMS.monster, lamClaw: [['claw1', 0], ['claw2', 0.25]], lamDash: [['dash', 0], ['claw2', 0.4]], lamSpin: [['spin', 0], ['claw1', 0.25], ['spin', 0.45]],
  lamRaise: [['raise', 0]], lamRise: [['rise1', 0], ['rise2', 0.3]], lamLand: [['land', 0]] });
const HIDE_MODEL = { draw() { } };
function lamPillar(o, x, y, mul) {
  addFx({ x, y: y + 0.5, z: 0, dur: 1.0, draw(c) { const k = this.t / this.dur, w = 60 * (k < 0.2 ? k / 0.2 : 1 - (k - 0.2) / 0.8), X = sx(this.x), Y = sy(this.y, 0); c.save(); c.globalCompositeOperation = 'lighter';
    c.globalAlpha = 0.8; c.fillStyle = '#d0b0ff'; c.fillRect(X - w / 2, 0, w, Y); c.globalAlpha = 0.5; c.fillStyle = '#ffffff'; c.fillRect(X - w / 5, 0, w / 2.5, Y); c.restore(); } });
  sfx.boom(1.0); applyAreaFrom(o, x, y, 130, { dmg: 6 * mul, launch: 380, knock: 60, hs: 0.1, big: 1.4, type: 'mag', col: '#d0b0ff', downHit: true });
}
function eclipseMoonFx(x, y, dur, fall) {
  addFx({ x, y: y + 0.4, z: 0, dur, draw(c) { const k = this.t / this.dur, z = fall ? 520 * (1 - Math.min(1, k * 1.25)) + 40 : 330, R = fall ? 70 + 50 * k : 80, X = sx(this.x), Y = sy(this.y, z), a = k > 0.85 ? (1 - k) / 0.15 : Math.min(1, k * 6);
    c.save(); c.globalAlpha = a; c.globalCompositeOperation = 'lighter'; drawSpr(c, fxTint('orb', ECL), X, Y, R * 3, R * 3, {}); c.globalCompositeOperation = 'source-over';
    c.fillStyle = '#0a0612'; c.beginPath(); c.arc(X, Y, R, 0, TAU); c.fill(); c.strokeStyle = '#d0b0ff'; c.lineWidth = 3; c.stroke(); c.restore(); } });
}
defSummon('sm_lamos', { kind: 'follower', name: '逆月者拉莫斯', bundle: 'lamos', model: () => summonSprite('lamos', {}, ECL, lamAnims()), clips: () => summonClipsFor(lamAnims()),
  w: 18, d: 14, h: 172, shadowR: 22, speed: 170, runSpeed: 360, pref: 70, sight: 720, life: 200, max: 1, col: ECL, tags: ['awaken'], ai: smAI,
  onSpawn: s => { s.superArmor = Infinity; s.statusImmune = BM_FORM_IMMUNE; },
  update: s => { if (!s.upGo && s.life - s.lifeT < 1.2 && s.life > 5) { s.upGo = true; summonAct(s, { clip: 'lamRise', dur: 1.2, superArmor: true, events: [evAt(0.5, e => lamPillar(e.owner, e.x, e.y, e.mul))] }); } },
  onEnd: (s, why) => { if (!s.upGo && (why === 'cmd' || why === 'replaced' || why === 'dead')) lamPillar(s.owner, s.x, s.y, s.mul); },
  attacks: [
    { clip: 'lamClaw', range: [0, 120], dy: 26, cd: [1.4, 2.0], w: 3, act: { dur: 0.7, superArmor: true, hits: [mH(0.12, 0.18, [0, 120, 28, 0, 160], 1.6, { elem: 'dark', snd: 'slash', knock: 40 }), mH(0.37, 0.43, [0, 120, 28, 0, 160], 2.0, { elem: 'dark', snd: 'slash', knock: 120 })],
      events: [evAt(0.1, e => fxSlash({ x: e.x, y: e.y, z: e.z, face: e.face, col: ECL, a0: -1.4, a1: 1.0, r: 110, w: 18, off: [10, 90], dur: 0.18 })), evAt(0.35, e => fxSlash({ x: e.x, y: e.y, z: e.z, face: e.face, col: '#d0b0ff', a0: 1.0, a1: -1.4, r: 110, w: 18, off: [10, 90], dur: 0.18 }))] } },
    { clip: 'lamDash', range: [140, 420], dy: 30, cd: [4, 6], w: 2, act: { dur: 0.75, move: [[0.05, 0.4, 900]], onStart: e => { e.superArmor = 0; }, onEnd: e => { e.superArmor = Infinity; },
      hits: [mH(0.05, 0.45, [0, 90, 30, 0, 160], 2.2, { elem: 'dark', snd: 'slash', knock: 160, launch: 240, max: 1 })], events: [evAt(0.05, e => { sfx.swing(true); fxAfterimage(e, ECL); })] } },
    { clip: 'lamSpin', range: [0, 160], dy: 60, cd: [6, 8], w: 1, act: { dur: 0.8, superArmor: true, events: [evAt(0.3, e => { sfx.swing(true); fxSlash({ x: e.x, y: e.y, z: e.z, face: e.face, col: ECL, a0: -3.1, a1: 3.1, r: 170, w: 22, off: [0, 80], squash: 0.45, dur: 0.3 });
      summonArea(e, e.x, e.y, 170, { dmg: 3.0, launch: 300, knock: 140, hs: 0.08, elem: 'dark', type: 'mag', radial: true, downHit: true }, { zMax: 200 }); })] } }],
  cmds: {
    // 附灵“蚀旋”：大范围把敌人卷到拉莫斯面前
    special(s, arg) { smFront(s, arg); summonAct(s, { clip: 'lamRaise', dur: 1.5, superArmor: true, update: e => { if (e.actT > 0.2 && e.actT < 1.2) mgPull(e.owner, e.x + e.face * 80, e.y, 520, 0.05); },
      events: [evAt(0.2, e => { sfx.charge(); addFx({ x: e.x + e.face * 80, y: e.y + 1, z: 0, dur: 1.1, draw(c) { const k = this.t / this.dur; c.save(); c.translate(sx(this.x), sy(this.y, 0)); c.scale(1, GR); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.8 * (1 - k * 0.5); drawSpr(c, fxTint('vortex', ECL), 0, 0, 900 * (1 - k * 0.6), 900 * (1 - k * 0.6), { rot: -game.t * 5 }); c.restore(); } }); }),
        ...[0.4, 0.7, 1.0].map(t => evAt(t, e => summonArea(e, e.x + e.face * 80, e.y, 200, { dmg: 1.2, stun: 0.6, knock: 0, hs: 0.03, elem: 'dark', type: 'mag', downHit: true }, { zMax: 200 }))),
        evAt(1.25, e => { sfx.boom(1.0); fxShock(e.x + e.face * 80, e.y, 240, ECL); summonArea(e, e.x + e.face * 80, e.y, 200, { dmg: 3.5, launch: 360, knock: 100, hs: 0.1, big: 1.4, elem: 'dark', type: 'mag', downHit: true }, { zMax: 220 }); })] }); },
    // 咒令：逆月之蚀——化成“蚀”退回月亮，再砸下来啃咬范围内的敌人
    eclipse(s, arg) { const o = s.owner, k = (arg && arg.mul) || 1; summonAct(s, { clip: 'lamRise', dur: 2.1, superArmor: true, events: [
      evAt(0.35, e => { sfx.charge(); e.baseModel = e.baseModel || e.model; e.model = HIDE_MODEL; eclipseMoonFx(e.x, e.y, 0.5, false); }),
      evAt(0.8, e => { const t = strongestFoe(e, 700) || { x: o.x + o.face * 200, y: o.y }; e.act.tx = t.x; e.act.ty = t.y; eclipseMoonFx(t.x, t.y, 0.6, true); }),
      evAt(1.3, e => { const x = e.act.tx, y = e.act.ty; sfx.boom(1.3); cam.shake = Math.max(cam.shake, 10); fxShock(x, y, 300, ECL); fxBurst(x, y, 40, 320, '#d0b0ff');
        for (let i = 0; i < 4; i++) game.after(i * 0.1, () => { if (!e.gone) summonArea(e, x, y, 180, { dmg: 2.0 * k, stun: 0.6, knock: 20, hs: 0.05, elem: 'dark', type: 'mag', downHit: true }, { zMax: 220 }); });
        game.after(0.45, () => { if (e.gone) return; summonArea(e, x, y, 200, { dmg: 5.0 * k, launch: 420, knock: 140, hs: 0.12, big: 1.6, elem: 'dark', type: 'mag', downHit: true }, { zMax: 240 }); }); }),
      evAt(1.5, e => { e.warp(e.act.tx - o.face * 60, e.act.ty); if (e.baseModel) e.model = e.baseModel; e.play('lamLand', true); })] }); } } });
defSkill('sm_awaken2', { name: '传说召唤：逆月者拉莫斯', cls: 'mage', job: SM, tier: 2, lvReq: 27, maxLv: 3, mp: 200, cd: 170, pvp: 0.45, type: 'mag', awaken: true, col: ECL,
  desc: '【二次觉醒】在月食之夜与“蚀”签约：黑色的月亮出现在前方上空，远古战士拉莫斯降临，落地冲击击倒大范围的敌人。在场 200 秒（决斗场 30 秒），除冲刺外常驻霸体，放养时施展爪击、冲刺、回旋；学会蚀月附灵后可附灵“蚀旋”；离场时升空放出光柱。召唤过程中你处于无敌状态。',
  pow: lv => skillDmg(34, 9, lv), ai: { kind: 'awaken', r: [0, 420], dy: 120 }, infoExtra: () => [['在场时间', '200 秒']],
  recast: smPossess('sm_lamos', 15),
  act: (lv) => ({ name: 'sm_awaken2', clip: 'smAwk', dur: 2.0, superArmor: true, noCounter: true, invul: true,
    onStart: e => { game.cutin = { t: 0, dur: 1.0, name: '逆月者拉莫斯', who: cutinWho(e, 2) }; game.timeStop = 0.9; sfx.awaken(); dismissSummons(e, 'sm_lamos', 'replaced'); const R = game.room, x = e.x + e.face * 150; e.act.rx = R ? clamp(x, R.x0 + 40, R.x1 - 40) : x; e.act.ry = e.y; },
    events: [evAt(0.95, e => { sfx.charge(); eclipseMoonFx(e.act.rx, e.act.ry, 1.0, false); }),
      evAt(1.3, e => { const s = summon(e, 'sm_lamos', { lv, mul: casMul(e, lv), x: e.act.rx, y: e.act.ry, life: game.pvp ? 30 : 200 }); if (s) { s.face = e.face; summonAct(s, { clip: 'lamLand', dur: 0.6, superArmor: true }); } }),
      evAt(1.4, e => { const a = e.act; cam.flash = 0.25; cam.flashCol = '#e0d0ff'; cam.shake = 12; sfx.boom(1.3); fxShock(a.rx, a.ry, 460, ECL); fxBurst(a.rx, a.ry, 30, 360, '#d0b0ff');
        blast(e, a.rx, a.ry, 380, { dmg: skillDmg(12, 3, lv), down: true, launch: 240, knock: 80, hs: 0.12, big: 1.8, sure: true, downHit: true, type: 'mag', col: ECL }, { zMax: 300 }); e.invul = Math.max(e.invul, 0.6); })] }) });
defSkill('sm_lamoseclipse', { name: '咒令：逆月之蚀', cls: 'mage', job: SM, tier: 2, lvReq: 27, mp: 100, cd: 45, type: 'mag', col: ECL, req: p => summonsOf(p, 'sm_lamos').length > 0 || '拉莫斯不在场',
  desc: '拉莫斯在场时才能用：她化成“蚀”退回月亮，再对着最强的敌人砸下来，连续啃咬范围内的敌人，最后一口重击。', pow: lv => skillDmg(26, 2.6, lv), ai: { kind: 'aoe', r: [0, 600], dy: 120 }, act: smOrder('sm_lamos', 'eclipse', '逆月之蚀') });
// ---- 三觉段 ----
defSkill('sm_reverse', { name: '逆月', cls: 'mage', job: SM, tier: 3, lvReq: 29, passive: true, type: 'mag', col: '#6a3a9a',
  desc: '【被动·三觉】技能攻击力提高；鞭挞变成蚀鞭（伤害提高）；新召唤的袄索变成被“蚀”侵蚀的形态：远程攻击的射程大幅增加。', infoExtra: lv => [['技能攻击力', '+' + pct(0.08 + 0.02 * lv)], ['鞭挞伤害', '+50%']] });
{ const D = SUMMON_DEFS.sm_aukuso, o0 = D.onSpawn;
  const ECL_DEF = { ...D, sight: 760, attacks: D.attacks.map(A => ({ ...A, range: [A.range[0], A.range[1] > 100 ? A.range[1] * 1.6 : A.range[1]], dy: A.dy * 1.3 })) };
  D.onSpawn = s => { if (o0) o0(s); if (skLv(s.owner, 'sm_reverse') > 0) { s.sdef = ECL_DEF; s.acd = ECL_DEF.attacks.map(() => 0); s.model = summonSprite('aukuso', { hue: 250, bright: 0.75, sat: 0.8 }, ECL); } }; }
SUMMON_DEFS.sm_echeverria.cmds.supreme = (s, arg) => { const o = s.owner, k = (arg && arg.mul) || 1; smFront(s, arg); summonAct(s, { clip: 'cast', dur: 2.4, superArmor: true, events: [
  ...Array.from({ length: 12 }, (_, i) => evAt(0.3 + i * 0.1, e => { const f = i % 2 ? -e.face : e.face, lane = ((i * 5) % 7 - 3) * 14, col = i % 3 ? '#e0d0ff' : ECL; sfx.zap();
    fxBeam(e.x + f * 30, e.y + lane, e.z + 80, 460, f, { w: 34, col, dur: 0.18 });
    for (const t of ents) if (foe(o, t) && !t.dead && (t.x - e.x) * f > -t.w && Math.abs(t.x - e.x) < 480 && Math.abs(t.y - e.y - lane) < 50 && t.z < 220) summonHit(e, t, { dmg: 1.2 * k, stun: 0.4, knock: 10, hs: 0.03, elem: 'dark', type: 'mag', col }); })),
  evAt(1.7, e => { sfx.charge(); fxAura(o, ECL); fxAura(e, ECL); }),
  evAt(2.0, e => { cam.flash = 0.3; cam.flashCol = '#e8d8ff'; cam.shake = 12; sfx.boom(1.4); for (const c of [[e.x, e.y], [o.x, o.y]]) { fxShock(c[0], c[1], 300, ECL); fxBurst(c[0], c[1], 60, 300, '#e0d0ff'); }
    summonArea(e, e.x, e.y, 220, { dmg: 6 * k, launch: 420, knock: 160, hs: 0.12, big: 1.8, elem: 'dark', type: 'mag', downHit: true }, { zMax: 260 });
    summonArea(e, o.x, o.y, 220, { dmg: 6 * k, launch: 420, knock: 160, hs: 0.12, big: 1.8, elem: 'dark', type: 'mag', downHit: true }, { zMax: 260 }); })] }); };
defSkill('sm_supreme', { name: '至高精灵王', cls: 'mage', job: SM, tier: 3, lvReq: 29, mp: 150, cd: 50, type: 'mag', col: '#ffd070', req: p => summonsOf(p, 'sm_echeverria').length > 0 || '伊伽贝拉不在场',
  desc: '伊伽贝拉在场时才能用：她被注入“蚀”，向两侧放出多束超高密度激光，最后和你一起引爆。', pow: lv => skillDmg(30, 3, lv), ai: { kind: 'aoe', r: [0, 460], dy: 80 }, act: smOrder('sm_echeverria', 'supreme', '至高精灵王') });
// ---- 三觉：魔月·德拉里昂（插图式演出，官方四步：召唤阵 → 敌人被逆召唤到月面 → 德拉里昂现身、喷出蚀之波涛 → 蚀化成牙齿，张开巨口吞掉整个月亮；全程无敌） ----
// 演出层画在所有实体后面（y = -20）：敌人和你照常画在上面，看起来就是站在月面上被波涛卷过、最后连同月亮一起被吞掉
function delarionFx(cx, cy, dur) {
  const stars = Array.from({ length: 60 }, () => [Math.random(), Math.random() * 0.6, 0.5 + Math.random()]);
  const craters = Array.from({ length: 16 }, () => [Math.random(), Math.random(), 0.02 + Math.random() * 0.05]);
  const worms = Array.from({ length: 28 }, () => [Math.random(), 0.9 + Math.random() * 0.7, rnd(0.6, 1.5), Math.random() < 0.5 ? -1 : 1]);
  addFx({ x: cx, y: -20, z: 0, dur, draw(c) { const t = this.t, k = t / this.dur, a = Math.min(1, t / 0.35) * (k > 0.93 ? (1 - k) / 0.07 : 1), W = c.canvas.width, H = c.canvas.height;
    const hor = H * (FLOOR_Y - 26) / WH, zoom = easeOut(clamp((t - 1.7) / 0.5, 0, 1)), bite = t >= 2.6;
    c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 0.92 * a; c.fillStyle = '#05030c'; c.fillRect(0, 0, W, H);
    c.globalCompositeOperation = 'lighter'; c.fillStyle = '#ffffff'; for (const [u, v, s] of stars) { c.globalAlpha = a * (0.3 + 0.5 * Math.abs(Math.sin(game.t * 2 + u * 30))); c.fillRect(u * W, v * H, s * 2, s * 2); }
    c.globalCompositeOperation = 'source-over';
    // 德拉里昂：从月平线后面升起的巨大魔物，身体由“蚀”（黑紫色的虫）聚成，两只发光的眼睛；0.9 秒起张开嘴喷出蚀之波涛（先画它，月面再盖住它的下半身）
    const rise = easeOut(clamp((t - 0.35) / 0.7, 0, 1)), headA = a * rise * (1 - clamp((t - 1.75) / 0.25, 0, 1));
    if (headA > 0 && zoom < 1) { const S = H * 0.3, hx = W / 2, hy = hor - S * 0.5 + (1 - rise) * S * 1.4, open = clamp((t - 0.85) / 0.2, 0, 1) * (t < 1.7 ? 1 : 0);
      c.globalAlpha = headA; c.fillStyle = '#1a0a28'; c.beginPath();
      for (let i = 0; i < 9; i++) { const u = -1.1 + i * 0.275, bx = hx + u * S, by = hy - Math.sqrt(Math.max(0, 1 - (u / 1.3) ** 2)) * S * 0.8; c.moveTo(bx - S * 0.12, by + 10); c.lineTo(bx + u * S * 0.1, by - S * (0.3 + 0.14 * Math.abs(Math.sin(i * 2.3)))); c.lineTo(bx + S * 0.12, by + 10); } c.fill();
      c.fillStyle = '#12061c'; c.beginPath(); c.ellipse(hx, hy, S * 1.3, S * 0.85, 0, 0, TAU); c.fill();
      c.globalCompositeOperation = 'lighter'; c.strokeStyle = '#8a4ad0'; c.lineWidth = 3; c.beginPath(); c.ellipse(hx, hy, S * 1.3, S * 0.85, 0, Math.PI * 1.05, Math.PI * 1.95); c.stroke();
      c.fillStyle = '#e070ff'; for (const sd of [-1, 1]) { c.beginPath(); c.moveTo(hx + sd * S * 0.2, hy - S * 0.12); c.lineTo(hx + sd * S * 0.72, hy - S * 0.36); c.lineTo(hx + sd * S * 0.62, hy - S * 0.08); c.closePath(); c.fill();
        c.globalAlpha = headA * 0.3; c.beginPath(); c.arc(hx + sd * S * 0.5, hy - S * 0.2, S * 0.24, 0, TAU); c.fill(); c.globalAlpha = headA; }
      c.globalCompositeOperation = 'source-over';
      if (open > 0) { const my2 = hy + S * 0.36, mw = S * 0.85 * open, mh = S * 0.26 * open; c.fillStyle = '#3a0a50'; c.beginPath(); c.ellipse(hx, my2, mw, mh, 0, 0, TAU); c.fill();
        c.fillStyle = '#d8c8f0'; c.beginPath(); for (let i = 0; i < 8; i++) { const x = hx - mw * 0.85 + mw * 1.7 * (i + 0.5) / 8; c.moveTo(x - 7, my2 - mh * 0.75); c.lineTo(x, my2 - mh * 0.75 + 16 * open); c.lineTo(x + 7, my2 - mh * 0.75); } c.fill();
        c.globalCompositeOperation = 'lighter'; c.globalAlpha = headA * 0.6; c.fillStyle = '#c070ff'; c.beginPath(); c.ellipse(hx, my2 + mh * 0.2, mw * 0.6, mh * 0.45, 0, 0, TAU); c.fill(); c.globalCompositeOperation = 'source-over'; c.globalAlpha = headA; }
      c.globalCompositeOperation = 'lighter'; c.strokeStyle = '#7a3ab8'; c.lineWidth = 2.5; for (const [u, r, v, d] of worms) { const an = u * TAU + game.t * v * d, wx = hx + Math.cos(an) * S * 1.4 * r, wy = hy - S * 0.15 + Math.sin(an) * S * 0.75 * r;
        c.beginPath(); c.moveTo(wx - 7, wy); c.quadraticCurveTo(wx - 2, wy - 6 * d, wx + 2, wy); c.quadraticCurveTo(wx + 6, wy + 6 * d, wx + 10, wy); c.stroke(); }
      c.globalCompositeOperation = 'source-over'; }
    // 月面（被逆召唤过来的地面，敌人和你站在上面）：1.7 秒后镜头拉远，月面缩成一颗月亮
    if (zoom < 1) { c.globalAlpha = a * (1 - zoom); const g = c.createLinearGradient(0, hor, 0, H); g.addColorStop(0, '#b8b3c6'); g.addColorStop(1, '#5a566a'); c.fillStyle = g;
      c.beginPath(); c.moveTo(0, hor + 18); c.quadraticCurveTo(W / 2, hor - 22, W, hor + 18); c.lineTo(W, H); c.lineTo(0, H); c.closePath(); c.fill();
      c.fillStyle = 'rgba(70,64,90,0.55)'; for (const [u, v, r] of craters) { c.beginPath(); c.ellipse(u * W, hor + 30 + v * (H - hor - 40), r * W, r * W * 0.32, 0, 0, TAU); c.fill(); } }
    const mx = W * 0.5, my = H * 0.42, mr = H * (0.2 + 0.5 * (1 - zoom));
    if (zoom > 0 && !bite) { c.globalAlpha = a * zoom; c.fillStyle = '#e8e4f0'; c.beginPath(); c.arc(mx, my, mr, 0, TAU); c.fill();
      c.fillStyle = '#bdb6cc'; for (const [dx, dy, r] of [[-0.3, -0.2, 0.18], [0.25, 0.1, 0.22], [-0.05, 0.35, 0.12], [0.35, -0.35, 0.1]]) { c.beginPath(); c.arc(mx + dx * mr, my + dy * mr, r * mr, 0, TAU); c.fill(); } }
    // 蚀之波涛：从德拉里昂嘴里涌出，沿着月面从远处向镜头滚过来（伤害按波涛经过的节奏结算，见技能 update）
    const wp = clamp((t - 0.95) / 0.75, 0, 1);
    if (wp > 0 && wp < 1 && zoom < 1) { const wy = hor + (H - hor + 80) * easeIn(wp), th = 40 + 90 * wp; c.globalAlpha = a * (1 - zoom);
      const g = c.createLinearGradient(0, wy - th * 2.2, 0, wy); g.addColorStop(0, 'rgba(40,8,60,0)'); g.addColorStop(0.6, 'rgba(70,16,110,0.75)'); g.addColorStop(1, 'rgba(90,24,140,0.95)'); c.fillStyle = g; c.fillRect(0, wy - th * 2.2, W, th * 2.2);
      c.globalCompositeOperation = 'lighter'; c.strokeStyle = '#d090ff'; c.lineWidth = 6; c.beginPath(); for (let x = 0; x <= W; x += 20) c.lineTo(x, wy - 12 * Math.abs(Math.sin(x * 0.018 + game.t * 9))); c.stroke();
      c.strokeStyle = '#8a4ad0'; c.lineWidth = 3; c.beginPath(); for (let x = 0; x <= W; x += 20) c.lineTo(x, wy - th * 0.7 - 8 * Math.abs(Math.sin(x * 0.025 - game.t * 7))); c.stroke(); c.globalCompositeOperation = 'source-over'; }
    // 蚀化成的牙齿：上下两排从月亮两侧合拢（1.9 秒张开，2.35~2.6 秒咬合 = 技能的最后一击），咬住之后月亮消失
    const show = clamp((t - 1.85) / 0.2, 0, 1) * a, gap = show > 0 ? (t < 2.2 ? (mr * 2.4) * clamp((t - 1.85) / 0.35, 0, 1) : t < 2.35 ? mr * 2.4 : mr * 2.4 * Math.max(0, 1 - (t - 2.35) / 0.25)) : 0;
    if (show > 0 && t < 3.0) { const ja = show * (t > 2.7 ? Math.max(0, 1 - (t - 2.7) / 0.3) : 1);
      for (const s of [-1, 1]) { const jy = my + s * gap / 2; c.globalAlpha = ja; c.fillStyle = '#2a0c3c'; c.beginPath(); c.moveTo(mx - W * 0.45, jy + s * H * 0.6); c.lineTo(mx - W * 0.45, jy);
        for (let i = 0; i <= 12; i++) { const x = mx - W * 0.45 + (W * 0.9) * i / 12; c.lineTo(x - W * 0.0375, jy); c.lineTo(x, jy - s * 40); } c.lineTo(mx + W * 0.45, jy + s * H * 0.6); c.closePath(); c.fill();
        c.globalCompositeOperation = 'lighter'; c.strokeStyle = '#b060ff'; c.lineWidth = 3; c.stroke(); c.globalCompositeOperation = 'source-over'; }
      c.globalCompositeOperation = 'lighter'; c.globalAlpha = ja; c.fillStyle = '#e070ff'; for (const s of [-1, 1]) { c.beginPath(); c.ellipse(mx + s * W * 0.2, my - gap / 2 - 70, 30, 9, s * 0.25, 0, TAU); c.fill(); } }
    c.restore(); } });
}
defSkill('sm_awaken3', { name: '魔月·德拉里昂', cls: 'mage', job: SM, tier: 3, lvReq: 30, maxLv: 3, mp: 300, cd: 270, pvp: 0.45, type: 'mag', awaken: true, col: '#c050ff',
  desc: '【三次觉醒】画出巨型召唤阵，把前方的敌人逆召唤到月面；魔月德拉里昂现身，喷出蚀之波涛，最后张开巨口吞掉整个月亮。范围内的敌人全程被困住。全程无敌。', pow: lv => skillDmg(46, 12, lv), ai: { kind: 'awaken', r: [0, 460], dy: 140 },
  act: (lv) => ({ name: 'sm_awaken3', clip: 'smAwk', dur: 5.0, superArmor: true, noCounter: true, invul: true,
    onStart: e => { game.cutin = { t: 0, dur: 1.2, name: '魔月·德拉里昂', who: cutinWho(e, 3) }; game.timeStop = 1.0; sfx.awaken(); const R = game.room, x = e.x + e.face * 160; e.act.cx = R ? clamp(x, R.x0 + 80, R.x1 - 80) : x; e.act.cy = e.y; },
    update: e => { const a = e.act; if (e.actT < 1.4 || e.actT > 4.0) return; const n = Math.floor((e.actT - 1.4) / 0.25);
      if (n !== a.n) { a.n = n; if (n % 3 === 2) fxShock(a.cx, a.cy, 260, ECL); blast(e, a.cx, a.cy, 340, { dmg: skillDmg(1.1, 0.3, lv), stun: 0.7, knock: 0, hs: 0.02, type: 'mag', elem: 'dark', col: ECL, sure: true, downHit: true }, { zMax: 320, status: 'bind', sdur: 1.0 }); } },
    events: [evAt(1.0, e => { const a = e.act; sfx.charge(); fxSigil('hexagram', a.cx, a.cy, 0, { w: 640, dur: 4.0, ay: 0.5, grow: [0.2, 1], col: '#c050ff' }); }),
      evAt(1.3, e => { const a = e.act; cam.shake = Math.max(cam.shake, 6); sfx.boom(0.9); delarionFx(a.cx, a.cy, 3.6); }),
      evAt(3.9, e => { const a = e.act; cam.flash = 0.4; cam.flashCol = '#f0e0ff'; cam.shake = 16; sfx.boom(1.6); fxShock(a.cx, a.cy, 560, ECL); fxBurst(a.cx, a.cy, 120, 520, '#e0d0ff');
        blast(e, a.cx, a.cy, 360, { dmg: skillDmg(30, 8, lv), launch: 520, knock: 220, hs: 0.16, big: 2.2, type: 'mag', elem: 'dark', col: '#ffffff', sure: true, downHit: true }, { zMax: 340 }); e.invul = Math.max(e.invul, 0.8); })] }) });
// ---- 登记、被动 ----
CLASSES.mage.jobs.summoner.skills.push('sm_hilun', 'sm_ring', 'sm_roar', 'sm_eclipse', 'sm_blackmoon', 'sm_shadow', 'sm_awaken2', 'sm_lamoseclipse', 'sm_reverse', 'sm_supreme', 'sm_awaken3');
CLASSES.mage.cmds.push(['duf', 'sm_hilun', 'buff'], ['bub', 'sm_ring', 'buff'], ['dbd', 'sm_roar'], ['udb', 'sm_blackmoon'], ['dbf', 'sm_shadow'], ['ddff', 'sm_awaken2'], ['fbd', 'sm_lamoseclipse'], ['ubf', 'sm_supreme'], ['ffdd', 'sm_awaken3']);
SM_BUNDLES.push('hilun', 'lamos');
CLASSES.mage.passives.push(p => {
  if (jobOf(p) !== SM) return;
  const ec = skLv(p, 'sm_eclipse'); setPassive(p, 'sm_eclipse', ec > 0, { dmg: 0.15 + 0.02 * ec });
  const rv = skLv(p, 'sm_reverse'); setPassive(p, 'sm_reverse', rv > 0, { dmg: 0.08 + 0.02 * rv });
  const H = summonsOf(p, 'sm_hilun')[0]; if (!H) return;
  const hl = H.lv || 1, sp = 0.06 + 0.01 * hl; setPassive(p, 'sm_hilunSelf', true, { dmg: 0.05 + 0.01 * hl });
  for (const a of ents) if (a.team === p.team && !a.summon && !a.dead && a.cls && Math.abs(a.x - p.x) < 600 && a.buffs) a.buffs.sm_hilunAura = { t: 0.5, aspd: sp, mspd: sp, cspd: sp };
  for (const s of summonsOf(p)) if (s.kind === 'follower') { if (s.sdef.tags.includes('higher')) s.superArmor = Infinity; if (!s.statusImmune) s.statusImmune = BM_FORM_IMMUNE; }
});
