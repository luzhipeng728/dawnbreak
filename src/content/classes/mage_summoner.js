/* =====================================================================
   转职：召唤师（魔法师）—— 按国服现版对齐（docs/SKILLS_OFFICIAL_mage.md 3.2），召唤物走共享框架 src/game/summon.js
   召唤兽：下级精灵 ×4（亚德炎 / 冰奈斯 / 瑟冥特克 / 雷沃斯，在场 30 秒）、契约兽（赫德尔 / 弗利特 / 桑德尔 / 袄索 / 露易丝 / 库鲁塔，常驻）、
          上级精灵 ×4（默克尔 / 格雷林 / 阿奎利斯 / 赫瑞克，常驻）、精灵王伊伽贝拉（常驻）
   交感（心灵感应）：契约兽在场时再按一次召唤键，它瞬移到你前方放专属招（按住 ↓ 再按 = 瞬移到脚下）；心灵感应的等级决定解锁到哪一只
   全体指令：伺机而动（停火）、召唤兽跟随、召唤解除、召唤兽传送、魔力印记（集火）
   地下城里召唤兽不会被攻击；伤害按你的魔攻实时结算
   ===================================================================== */
const SM = 'summoner';
const SM_PVP_HURT = true;
const smMul = (p, lv) => lvMul(lv, 0.1);
// 召唤兽定义的小工具：spr = 美术目录（art/final/spr/<id>），fly = 浮空（切帧时已经抬高）
function smDef(key, spr, o) {
  return defSummon(key, { kind: 'follower', bundle: spr, model: () => summonSprite(spr, o.tint || {}, o.col), w: o.w || 12, d: o.d || 11, h: o.h || 80, speed: o.speed ?? 170, runSpeed: o.runSpeed || 330, pref: o.pref ?? 40,
    sight: o.sight || 560, aggro: o.aggro || 1, life: o.life ?? Infinity, max: o.max ?? 1, col: o.col, tags: o.tags || [], enterAt: o.enterAt, attacks: o.attacks || [], cmds: o.cmds || {}, ai: smAI,
    onSpawn: s => { if (o.sa) s.superArmor = Infinity; if (o.scale) s.scale = o.scale;
      // 官方：召唤时脚下先铺开一个比人大得多的双层法阵（外圈慢转、内圈反转），约 1 秒后淡出；下级精灵 / 阿奎利斯 / 伊伽贝拉是黄绿色，桑德尔 / 格雷林 / 默克尔等是橙色
      const W = 150 + (o.h || 80) * 1.2; const rc = o.ring || '#ff9a3a'; fxSigil('hexagram', s.x, s.y, 0, { w: W, dur: 1.0, ay: 0.5, grow: [0.4, 1], col: rc }); fxSigil('rune', s.x, s.y, 0, { w: W * 0.62, dur: 1.0, grow: [0.4, 1], spin: -2.4, alpha: 0.8, col: rc }); fxBurst(s.x, s.y, 40, 90, o.col || '#d8c0ff');
      // 决斗场里召唤兽有自己的 HP（官方：竞技场单独设定 HP / 防御），地下城里怪物打不到它们
      if (SM_PVP_HURT && game.pvp && !o.noHurt) { s.invul = 0; s.hp = s.hpMax = Math.max(1, Math.round(s.owner.hpMax * (o.hpK || 6))); s.superArmor = Infinity; s.def = s.owner.def; s.mdef = s.owner.mdef; if (o.onHurt) s.onHurt = (a, h) => o.onHurt(s, a, h); }
      if (o.onSpawn) o.onSpawn(s); },
    onEnd: (s, why) => { if (why === 'dead' && o.deathBlast) o.deathBlast(s); if (o.onEnd) o.onEnd(s, why); }, update: o.update });
}
// 上级精灵被打倒时的死亡爆炸（官方：阿奎利斯冰冻 / 默克尔致盲 / 赫瑞克灼烧 / 格雷林感电）
const smDeath = (elem, status, col, dur) => s => { sfx.boom(0.6); fxShock(s.x, s.y, 170, col); fxBurst(s.x, s.y, 50, 200, col);
  summonArea(s, s.x, s.y, 150, { dmg: 1.0, stun: 0.4, knock: 60, hs: 0.05, elem, type: 'mag', col, downHit: true }, { zMax: 150, status, sdur: dur, dps: status === 'burn' ? 0.06 : 0 }); };
// 伺机而动（官方：开着时全部召唤兽原地停下、不主动攻击，只执行交感 / 附灵 / 咒令这类命令攻击）；同时开着“跟随”时照常跟在你身边、不出手
function smAI(s, dt) { const M = s.owner.summonMode; if (M && M.hold && !M.follow) { s.vx = s.vy = 0; if (s.st !== 'idle') s.setState('idle'); const t = nearestFoe(s, s.sdef.sight || 560); if (t) s.face = t.x >= s.x ? 1 : -1; return; } summonAI(s, dt); }
// 近战判定 / 远程投射物的简写（dmg = 主人攻击力的倍数，summonAI 会再乘 s.mul）
const mH = (t0, t1, box, dmg, x) => ({ t0, t1, box, dmg, stun: 0.35, knock: 60, hs: 0.04, snd: 'blunt', ...x });
function smShot(s, o) {
  const t = summonTarget(s) || nearestFoe(s, 600); const dx = t ? t.x - s.x : s.face * 300, dy = t ? t.y - s.y : 0, L = Math.hypot(dx, dy) || 1, sp = o.speed || 480, img = fxTint(o.img || 'orb', o.col);
  return spawnProj({ owner: s, x: s.x + s.face * 24, y: s.y, z: s.z + (o.z || 50), vx: dx / L * sp, vy: dy / L * sp * 0.6, face: s.face, life: o.life || 1.0, w: o.w || 9, d: 12, h: o.h || 14, pierce: !!o.pierce,
    hit: { dmg: o.dmg * s.mul, stun: 0.3, knock: 50, airLift: 120, hs: 0.03, col: o.col, elem: o.elem, ...(o.hit || {}) },
    update(pr) { if (o.home && t && !t.dead) pr.vy = damp(pr.vy, clamp((t.y - pr.y) * 4, -240, 240), 6, 1 / 60); if (Math.random() < 0.4) addFx({ x: pr.x, y: pr.y + 0.3, z: pr.z, dur: 0.2, draw(c) { const k = this.t / this.dur; drawSpr(c, img, sx(this.x), sy(this.y, this.z), 10 * (1 - k), 0, { alpha: 0.6 * (1 - k) }); } }); },
    onEnd(pr) { fxBurst(pr.x, pr.y, pr.z, 50 * (o.size || 1), o.col); if (o.onEnd) o.onEnd(pr); },
    draw(c, pr) { drawSpr(c, img, sx(pr.x), sy(pr.y, pr.z), 24 * (o.size || 1), 24 * (o.size || 1), { rot: pr.t * 8 }); } });
}
// 落雷（格雷林 / 伊伽贝拉）：能打到空中和倒地的敌人
function smBolt(s, x, y, dmg, o = {}) { lightningStrike({ x, y }); fxShock(x, y, o.r || 65, '#fff6a0'); summonArea(s, x, y, o.r || 65, { dmg: dmg, stun: 0.5, launch: 200, knock: 20, hs: 0.05, snd: 'crit', col: '#fff6a0', elem: 'light', downHit: true, type: 'mag' }, { zMax: 220 }); if (o.shock && Math.random() < o.shock) for (const t of ents) if (foe(s.owner, t) && inGround(t, x, y, o.r || 65)) addStatus(t, 'shock', 4, { src: s.owner }); }
// 瞬移到主人前方（交感 / 附灵）；按住 ↓ = 脚下
function smFront(s, arg) { const o = s.owner, feet = arg && arg.feet; s.warp(o.x + o.face * (feet ? 0 : 70), o.y + (feet ? 2 : 0)); s.face = o.face; fxBurst(s.x, s.y, 40, 80, s.sdef.col || '#d8c0ff'); }
const smCmdArg = p => ({ feet: !!(p.pad && p.pad.dy() > 0) });
// ---- 下级精灵（在场 30 秒，每种 1 只） ----
smDef('sm_ador', 'ador', { ring: '#9ad84a', h: 60, speed: 190, pref: 26, life: 30, tags: ['spirit', 'lesser'], col: '#ff9a50', elem: 'fire',
  attacks: [{ clip: 'atk1', range: [0, 60], dy: 16, cd: [1, 1.2], act: { dur: 0.55, hits: [mH(0.12, 0.18, [0, 58, 20, 0, 60], 0.16, { elem: 'fire', downHit: true, snd: 'fire', knock: 20 }), mH(0.3, 0.36, [0, 58, 20, 0, 60], 0.16, { elem: 'fire', downHit: true, snd: 'fire', knock: 40 })] } }] });
smDef('sm_naias', 'naias', { ring: '#9ad84a', h: 58, speed: 170, pref: 90, life: 30, tags: ['spirit', 'lesser'], col: '#9fe6ff', aggro: 0.8,
  onSpawn: s => { const o = s.owner; const hh = Math.round(o.hpMax * 0.02); o.hp = Math.min(o.hpMax, o.hp + hh); addNumber(hh, o.x, o.y, o.z, { heal: true }); },
  attacks: [{ clip: 'atk1', range: [0, 60], dy: 16, cd: [1, 1.2], act: { dur: 0.5, hits: [mH(0.14, 0.2, [0, 58, 20, 10, 60], 0.24, { elem: 'ice', snd: 'blunt' })] } },
    { clip: 'cast', range: [60, 360], dy: 40, cd: [1.5, 1.8], act: { dur: 0.6, events: [evAt(0.3, s => { sfx.ice(); smShot(s, { dmg: 0.26, col: '#bfefff', elem: 'ice', img: 'icespike', hit: { onHit: (a, t) => { if (Math.random() < 0.05) addStatus(t, 'freeze', 1, { src: a.owner }); } } }); })] } }] });
smDef('sm_stalker', 'stalker', { ring: '#9ad84a', h: 56, speed: 220, pref: 24, life: 30, tags: ['spirit', 'lesser'], col: '#c79aff', aggro: 1.4,
  attacks: [{ clip: 'scratch', range: [0, 62], dy: 16, cd: [1, 1.2], act: { dur: 0.5, hits: [mH(0.3, 0.36, [0, 60, 20, 0, 60], 0.2, { elem: 'dark', stun: 0.65, downHit: true, snd: 'slash', onHit: (a, t) => { if (Math.random() < 0.1) addStatus(t, 'curse', 4, { src: a.owner }); } })] } }] });
smDef('sm_wisp', 'wisp', { ring: '#9ad84a', h: 54, speed: 190, pref: 40, life: 30, tags: ['spirit', 'lesser'], col: '#fff38a', hpK: 3,
  // 官方：被打后会瞬移到攻击者背后（间隔 3 秒）
  onHurt: (s, a) => { if (!a || game.t < (s.blinkT || 0)) return; s.blinkT = game.t + 3; fxBurst(s.x, s.y, 30, 60, '#fff38a'); s.warp(a.x - (a.face || 1) * 60, a.y); s.face = a.face || s.face; fxBurst(s.x, s.y, 30, 60, '#fff38a'); },
  attacks: [{ clip: 'atk1', range: [0, 84], dy: 18, cd: [1, 1.2], act: { dur: 0.5, events: [evAt(0.18, s => { sfx.zap(); fxSpr('spark', s.x + s.face * 48, s.y + 1, s.z + 50, { w: 56, dur: 0.2 }); })],
    hits: [mH(0.18, 0.24, [0, 82, 22, 0, 90], 0.22, { elem: 'light', snd: 'crit', onHit: (a, t) => { if (Math.random() < 0.1 && Math.sign(a.x - t.x || 1) !== t.face) addStatus(t, 'stun', 1, { src: a.owner }); } })] } }] });
const LESSER = ['sm_ador', 'sm_naias', 'sm_stalker', 'sm_wisp'];
// ---- 契约兽 ----
smDef('sm_frit', 'frit', { h: 70, speed: 180, pref: 50, tags: ['contract'], col: '#ff8a4a',
  attacks: [{ clip: 'bite', range: [0, 68], dy: 16, cd: [1, 1.2], w: 2, act: { dur: 0.7, superArmor: true, hits: [mH(0.34, 0.42, [0, 68, 22, 0, 70], 0.45, { elem: 'fire', snd: 'blunt' })] } },
    { clip: 'cast', range: [70, 360], dy: 40, cd: [1, 1.3], w: 2, act: { dur: 0.7, events: [evAt(0.35, s => { sfx.hit('fire', false); smShot(s, { dmg: 0.5, col: '#ffb060', elem: 'fire', img: 'fireball', size: 1.2 }); })] } },
    { clip: 'roar', range: [0, 170], dy: 36, cd: [2, 2.4], w: 1, act: { dur: 1.1, events: [evAt(0.45, s => { for (let i = 0; i < 3; i++) game.after(i * 0.12, () => { if (s.gone) return; fxSpr('flame', s.x + s.face * (50 + i * 45), s.y, 30, { w: 95, dur: 0.3 });
      summonArea(s, s.x + s.face * (50 + i * 45), s.y, 55, { dmg: 0.25, stun: 0.3, knock: 30, hs: 0.03, elem: 'fire', type: 'mag' }, { status: Math.random() < 0.1 ? 'burn' : null, sdur: 3, dps: 0.06 }); }); })] } }],
  cmds: { special(s, arg) { smFront(s, arg); summonAct(s, { clip: 'roar', dur: 1.0, superArmor: true, events: [evAt(0.35, e => { sfx.boom(0.6); cam.shake = Math.max(cam.shake, 4); fxShock(e.x + e.face * 50, e.y, 170, '#ff9a50');
    for (let i = 0; i < 5; i++) game.after(i * 0.1, () => { if (!e.gone) summonArea(e, e.x + e.face * 50, e.y, 170, { dmg: 0.4, stun: 0.4, knock: 60, hs: 0.04, elem: 'fire', type: 'mag', downHit: true }, { zMax: 150 }); }); })] }); } } });
// 桑德尔的守护光环：韩服 2023-08 改版后不再有时间限制、加魔法防御、范围加大（同时删掉了回血 / 抗异常两招）——在场期间我方队员（含你）在范围内一直受到伤害减免
smDef('sm_sandor', 'sandor', { h: 124, w: 16, d: 13, speed: 150, pref: 50, tags: ['contract'], col: '#b08aff', sa: true,
  update: s => { s.guardT = (s.guardT || 0) - 1 / 60; for (const a of ents) if (a.team === s.owner.team && !a.summon && !a.dead && a.buffs && Math.abs(a.x - s.x) < 520 && Math.abs(a.y - s.y) < 260) a.buffs.sm_guard = { t: 0.5, taken: -0.08 };
    if (s.guardT <= 0) { s.guardT = 1.6; fxSigil('hexagram', s.x, s.y, 0, { w: 200, dur: 1.2, ay: 0.5, grow: [0.5, 1.4], alpha: 0.5, col: '#ffb060' }); } },
  attacks: [{ clip: 'club', range: [0, 100], dy: 22, cd: [1, 1.2], w: 2, act: { dur: 0.9, hits: [mH(0.42, 0.5, [0, 104, 30, 0, 120], 0.7, { elem: 'dark', knock: 110, snd: 'slash', heavy: true })], events: [evAt(0.38, s => sfx.swing(true))] } },
    { clip: 'pounce', range: [60, 200], dy: 20, cd: [1.5, 1.8], w: 1, act: { dur: 1.0, move: [[0.35, 0.6, 360]], hits: [mH(0.4, 0.6, [0, 90, 26, 10, 110], 0.8, { elem: 'dark', knock: 160, snd: 'stab' })] } },
    // 举盾防御：蹲身架盾挡在敌人前面（盾面闪光），架盾时自己和身后的你受到的伤害降低
    { clip: 'chargeW', range: [0, 150], dy: 40, cd: [6, 9], w: 1, act: { dur: 1.3, superArmor: true, update: s => { if (Math.floor(s.actT / 0.22) !== s.guardN) { s.guardN = Math.floor(s.actT / 0.22); fxGuard(s); } },
      events: [evAt(0.05, s => { sfx.hit('blunt', false); s.guardN = -1; const o = s.owner; if (Math.abs(o.x - s.x) < 160) o.buffs.sm_shield = { t: 1.3, taken: -0.1 }; })] } }],
  cmds: { special(s, arg) { smFront(s, arg); summonAct(s, { clip: 'chargeW', dur: 0.9, superArmor: true, update: e => { if (e.actT < 0.48 && Math.random() < 0.5) fxCharge(e, '#c79aff'); }, events: [evAt(0.5, e => { sfx.iai(); e.play('club', true);
    shootProj(e, { img: 'slash', col: '#c79aff', w: 150, speed: 620, life: 0.8, z: 30, bw: 36, bd: 24, bh: 110, pierce: true, hit: { dmg: 1.6 * e.mul, stun: 0.5, knock: 120, hs: 0.06, elem: 'dark', type: 'mag', col: '#c79aff', max: 1 } }); })] }); } } });
// 袄索：召出 / 换房间时从你面前的地面钻出（尘土 + 碎石迸开）
function aukusoEmerge(s) { fxDust(s.x, s.y, 10, 30, '#7a6a4a'); fxSpr('rock', s.x, s.y, 10, { w: 90, dur: 0.4, grow: [0.4, 1.1] }); fxShock(s.x, s.y, 70, '#8adf6a'); sfx.boom(0.3); }
// 毒虫：放出 3 只毒虫贴地爬向敌人，碰到就中毒
function aukusoBugs(s) { const t = summonTarget(s); if (!t) return; sfx.magic();
  for (let i = 0; i < 3; i++) game.after(i * 0.12, () => { if (s.gone) return;
    spawnProj({ owner: s, x: s.x + s.face * 34, y: clamp(s.y + (i - 1) * 14, 6, DEPTH - 6), z: 1, vx: s.face * 230, vy: 0, face: s.face, life: 2.2, w: 8, d: 10, h: 14, pierce: false,
      hit: { dmg: 0.22 * s.mul, stun: 0.3, knock: 10, hs: 0.02, type: 'mag', col: '#8adf6a', onHit: (a, tt) => addStatus(tt, 'poison', 3, { dps: atkOf(s.owner, 'mag') * 0.03, src: s.owner }) },
      update(pr) { if (t.dead || t.remove) return; const dx = t.x - pr.x, dy = t.y - pr.y, L = Math.hypot(dx, dy) || 1; pr.vx = damp(pr.vx, dx / L * 230, 4, 1 / 60); pr.vy = damp(pr.vy, dy / L * 150, 4, 1 / 60); pr.face = pr.vx >= 0 ? 1 : -1; },
      onEnd(pr) { fxBurst(pr.x, pr.y, 6, 40, '#8adf6a'); },
      draw(c, pr) { const X = sx(pr.x), Y = sy(pr.y, pr.z) - 4, w = Math.sin(game.t * 36 + pr.x) * 1.5; c.fillStyle = '#8adf6a'; c.fillRect(X - 6, Y + w, 12, 1.5); c.fillRect(X - 4, Y - w, 8, 1.5);
        c.fillStyle = '#23331a'; c.beginPath(); c.ellipse(X, Y, 7, 4.5, 0, 0, TAU); c.fill(); c.fillStyle = '#c8ff70'; c.fillRect(X + pr.face * 5 - 1, Y - 2, 2.5, 2.5); } }); }); }
smDef('sm_aukuso', 'aukuso', { h: 110, w: 18, d: 14, speed: 0, pref: 0, sight: 480, tags: ['contract'], col: '#8adf6a', enterAt: 'front',
  onSpawn: s => { aukusoEmerge(s); s.room0 = game.room; }, update: s => { if (s.room0 !== game.room) { s.room0 = game.room; aukusoEmerge(s); } },
  attacks: [{ clip: 'atk1', range: [0, 100], dy: 26, cd: [1, 1.2], w: 2, act: { dur: 0.55, hits: [mH(0.2, 0.28, [-10, 104, 30, 0, 100], 0.4, { snd: 'stab', knock: 60 })] } },
    { clip: 'cast', range: [70, 420], dy: 60, cd: [2, 2.4], w: 2, act: { dur: 0.7, events: [evAt(0.35, s => { const t = summonTarget(s); if (!t) return; fxSpr('icespike', t.x, t.y, 0, { w: 50, dur: 0.4, col: '#6a9a4a', grow: [0.3, 1] });
      summonHit(s, t, { dmg: 0.5, launch: 260, knock: 10, stun: 0.4, hs: 0.05, snd: 'stab', type: 'mag' }); })] } },
    { clip: 'roar', range: [0, 220], dy: 70, cd: [4, 4.5], w: 1, act: { dur: 1.0, events: [evAt(0.5, s => { fxSpr('poison', s.x + s.face * 80, s.y, 20, { w: 260, dur: 0.8, col: '#8adf6a' });
      summonArea(s, s.x + s.face * 80, s.y, 150, { dmg: 0.3, stun: 0.3, knock: 20, hs: 0.03, type: 'mag' }, { status: Math.random() < 0.3 ? 'confuse' : 'poison', sdur: 3, dps: 0.05 }); })] } },
    { clip: 'cast', range: [80, 420], dy: 60, cd: [4, 4.5], w: 1, act: { dur: 0.8, events: [evAt(0.4, aukusoBugs)] } }],
  cmds: { special(s) { summonAct(s, { clip: 'cast', dur: 0.8, events: [evAt(0.35, e => { let n = 0; for (const t of ents) if (foe(e.owner, t) && Math.abs(t.x - e.x) < 500 && Math.abs(t.y - e.y) < 200 && n < 12) { n++;
    fxSpr('icespike', t.x, t.y, 0, { w: 56, dur: 0.45, col: '#6a9a4a', grow: [0.3, 1] }); summonHit(e, t, { dmg: 1.2, launch: 320, stun: 0.5, hs: 0.06, snd: 'stab', type: 'mag' }); } })] }); } } });
function luiseMeteor(s, n) {
  const o = s.owner;
  for (let i = 0; i < n; i++) game.after(i * 0.35, () => { const t = nearestFoe(o, 600) || { x: o.x + o.face * 200, y: o.y }; const g = { x: t.x, y: t.y };
    telegraph({ x: g.x, y: g.y, r: 130, dur: 0.6, kind: 'hex', col: '#ff9a3a', friendly: true, fire: () => { meteorImpact(g, 1.2); fxShock(g.x, g.y, 200, '#ffb060');
      applyAreaFrom(o, g.x, g.y, 140, { dmg: 2.4 * (s.mul || 1), launch: 380, knock: 120, hs: 0.1, big: 1.5, elem: 'fire', type: 'mag', downHit: true }); } }); });
}
function applyAreaFrom(owner, x, y, r, h) { for (const t of ents) if (foe(owner, t) && t.invul <= 0 && inGround(t, x, y, r) && t.z < 200 && (t.st !== 'down' || h.downHit)) applyHit(owner, t, { ...h, box: null }, { proj: true, src: { x: x - owner.face * 10, y, z: 0, face: owner.face } }); }
defSummon('sm_needleField', { kind: 'field', r: 40, tick: 0.5, life: 3, max: 6, col: '#bfefff',
  onTick(s, foes) { for (const t of foes) summonHit(s, t, { dmg: 0.12, stun: 0.1, knock: 0, hs: 0.01, elem: 'ice', type: 'mag', sure: true }); },
  draw(c, s) { const k = s.lifeT / s.life, X = sx(s.x), Y = sy(s.y, 0); c.save(); c.globalAlpha = k > 0.8 ? (1 - k) / 0.2 : 1; drawSpr(c, fxTint('icespike', '#bfefff'), X, Y, 22, 30, { ax: 0.5, ay: 0.9 }); c.restore(); } });
smDef('sm_luise', 'luise', { h: 112, speed: 160, pref: 120, tags: ['contract'], col: '#ff6a5a',
  attacks: [{ clip: 'club', range: [0, 88], dy: 22, cd: [1, 1.2], w: 1, act: { dur: 0.8, superArmor: true, hits: [mH(0.4, 0.48, [0, 90, 28, 0, 110], 0.5, { knock: 100 })] } },
    // 冰针（冷却 5s）：射出后插在地上，碰到的敌人继续受伤
    { clip: 'cast', range: [60, 380], dy: 50, cd: [5, 5.5], w: 3, act: { dur: 0.7, events: [evAt(0.35, s => { sfx.ice(); smShot(s, { dmg: 0.35, col: '#bfefff', elem: 'ice', img: 'icespike', speed: 600, onEnd: pr => { if (Math.abs(pr.x - s.x) > 20) summon(s.owner, 'sm_needleField', { x: pr.x, y: pr.y }); } }); })] } },
    { clip: 'cast', range: [60, 380], dy: 50, cd: [1.5, 1.8], w: 3, act: { dur: 0.7, events: [evAt(0.35, s => { sfx.hit('fire', false); smShot(s, { dmg: 0.5, col: '#ffb060', elem: 'fire', img: 'fireball', size: 1.3 }); })] } },
    { clip: 'cast', range: [60, 380], dy: 50, cd: [1.5, 1.8], w: 2, act: { dur: 0.7, events: [evAt(0.35, s => { const t = summonTarget(s); if (t) { sfx.ice(); fxSpr('icespike', t.x, t.y, 0, { w: 95, dur: 0.5, grow: [0.3, 1] }); summonArea(s, t.x, t.y, 70, { dmg: 0.7, launch: 280, stun: 0.4, hs: 0.05, elem: 'ice', type: 'mag' }, { zMax: 150 }); } })] } }],
  cmds: { special(s, arg) { smFront(s, arg); summonAct(s, { clip: 'cast', dur: 0.8, events: [evAt(0.3, e => { sfx.charge(); luiseMeteor(e, 1); })] }); } },
  onEnd: (s, why) => { if (why === 'life' || why === 'dead' || why === 'cmd') luiseMeteor(s, why === 'dead' ? 2 : 1); } });
// 库鲁塔：复用牛头王的整套美术（缩小一点）
defSummon('sm_kuruta', { kind: 'follower', bundle: 'tauKing', model: () => summonSprite('tauKing', {}, '#e0a060'), w: 20, d: 15, h: 140, scale: 0.82, speed: 140, runSpeed: 300, pref: 60, sight: 560, life: Infinity, max: 1, col: '#e0a060', tags: ['contract'], ai: smAI,
  onSpawn: s => { s.superArmor = Infinity; fxSigil('hexagram', s.x, s.y, 0, { w: 160, dur: 0.6, ay: 0.5, grow: [0.3, 1] }); cam.shake = Math.max(cam.shake, 3); },
  attacks: [{ clip: 'axe', range: [0, 125], dy: 28, cd: [1, 1.2], w: 2, act: { dur: 1.25, hits: [mH(0.62, 0.72, [-10, 132, 36, 0, 140], 1.2, { knock: 200, heavy: true, hs: 0.08, shake: 2 })], events: [evAt(0.58, s => sfx.swing(true))] } },
    { clip: 'charge', range: [100, 320], dy: 24, cd: [2, 2.4], w: 1, act: { dur: 0.9, move: [[0.1, 0.7, 420]], hits: [mH(0.1, 0.7, [0, 80, 30, 0, 130], 0.9, { knock: 220, launch: 260, hs: 0.06 })] } },
    { clip: 'roar', range: [0, 260], dy: 100, cd: [3, 3.6], w: 0.8, act: { dur: 1.2, events: [evAt(0.5, s => { sfx.boom(0.6); cam.shake = Math.max(cam.shake, 4); fxShock(s.x, s.y, 210, '#ffb060'); summonArea(s, s.x, s.y, 210, { dmg: 0.4, stun: 0.6, knock: 60, hs: 0.04 }, { status: 'stun', sdur: 1.2 }); })] } }],
  cmds: { special(s, arg) { smFront(s, arg); summonAct(s, { clip: 'axe', dur: 1.4, superArmor: true, events: [
    evAt(0.3, e => { sfx.swing(true); for (const t of ents) if (foe(e.owner, t) && Math.abs(t.x - e.x) < 300 && Math.abs(t.y - e.y) < 100 && !t.boss) { t.x = damp(t.x, e.x + e.face * 80, 20, 1 / 60); } summonArea(e, e.x + e.face * 70, e.y, 170, { dmg: 1.2, stun: 0.5, knock: -80, hs: 0.06 }); }),
    evAt(0.75, e => { sfx.boom(1.0); cam.shake = Math.max(cam.shake, 7); fxShock(e.x + e.face * 90, e.y, 290, '#ffb060'); summonArea(e, e.x + e.face * 90, e.y, 210, { dmg: 2.6, launch: 380, knock: 120, hs: 0.1, big: 1.6, downHit: true }, { zMax: 200 }); })] }); } } });
// ---- 上级精灵（常驻；附灵 = 二觉被动“蚀月附灵”解锁的再按指令，招式写在 mage_summoner_p1.js） ----
defSummon('sm_darkfield', { kind: 'field', r: 100, tick: 0.5, life: 4, max: 3, col: '#8a4ab0',
  onTick(s, foes) { for (const t of foes) { summonHit(s, t, { dmg: s.dmg || 0.2, stun: 0.2, knock: 0, hs: 0.02, elem: 'dark', type: 'mag', sure: true }); if (Math.random() < 0.1) addStatus(t, 'blind', 2, { src: s.owner }); } },
  draw(c, s) { const X = sx(s.x), Y = sy(s.y, 0), k = s.lifeT / s.life, a = k < 0.1 ? k * 10 : k > 0.85 ? (1 - k) / 0.15 : 1; c.save(); c.globalAlpha = 0.55 * a; c.translate(X, Y); c.scale(1, GR); drawSpr(c, fxTint('vortex', '#6a2a9a'), 0, 0, 215, 215, { rot: -game.t * 1.5 }); c.restore(); } });
smDef('sm_merkle', 'merkle', { h: 128, w: 16, speed: 160, pref: 55, life: 200, tags: ['spirit', 'higher'], col: '#a06adf', deathBlast: smDeath('dark', 'blind', '#a06adf', 3),
  attacks: [{ clip: 'club', range: [0, 112], dy: 26, cd: [1, 1.2], w: 2, act: { dur: 0.9, hits: [mH(0.42, 0.5, [-10, 118, 32, 0, 120], 0.6, { elem: 'dark', snd: 'slash', knock: 90, onHit: (a, t) => { if (Math.random() < 0.08) addStatus(t, 'blind', 2, { src: a.owner }); } })] } },
    { clip: 'slam', range: [0, 112], dy: 26, cd: [1.5, 1.8], w: 1, act: { dur: 1.1, hits: [mH(0.7, 0.8, [0, 118, 34, 0, 120], 0.9, { elem: 'dark', snd: 'slash', down: true, downHit: true })] } },
    { clip: 'cast', range: [0, 300], dy: 60, cd: [3, 3.6], w: 1, act: { dur: 0.8, events: [evAt(0.4, s => { const t = summonTarget(s); const f = summon(s.owner, 'sm_darkfield', { x: t ? t.x : s.x + s.face * 80, y: t ? t.y : s.y }); if (f) f.dmg = 0.2 * s.mul; })] } }] });
// 格雷林（韩服 2023-08 改版后的现版）：发射闪电 2 段、闪电五连发改为 3 道、闪电盾删除并改为“闪电针”（一段时间内提高发射闪电和三连闪电的攻击力）
smDef('sm_glarelin', 'glarelin', { h: 130, speed: 160, pref: 200, life: 200, tags: ['spirit', 'higher'], col: '#fff38a', deathBlast: smDeath('light', 'shock', '#fff38a', 4),
  attacks: [{ clip: 'cast', range: [80, 420], dy: 80, cd: [1, 1.2], w: 3, act: { dur: 0.8, events: [evAt(0.4, s => { const t = summonTarget(s); if (!t) return; sfx.zap(); for (let i = 0; i < 2; i++) game.after(i * 0.1, () => { if (!s.gone) smBolt(s, t.x, t.y, 0.45, { shock: 0.1 }); }); })] } },
    // 三连落雷（冷却 2s）：在面前排成一条横线依次劈下
    { clip: 'roar', range: [0, 420], dy: 120, cd: [2, 2.4], w: 1, act: { dur: 1.0, events: [evAt(0.5, s => { sfx.zap(); const t = summonTarget(s), y = t ? t.y : s.y, f = t ? Math.sign(t.x - s.x) || s.face : s.face; for (let i = 0; i < 3; i++) game.after(i * 0.09, () => { if (!s.gone) smBolt(s, s.x + f * (100 + i * 80), y, 0.5, { shock: 0.1 }); }); })] } },
    // 闪电针：自己身上聚起电光，10 秒内闪电类攻击 +40%（官方冷却未公开，按 20 秒）
    { clip: 'cast', range: [0, 420], dy: 400, cd: [20, 22], w: 0.8, cond: s => !(s.buffs.needle && s.buffs.needle.t > 0), act: { dur: 0.7, events: [evAt(0.3, s => { sfx.zap(); s.buffs.needle = { t: 10, dmg: 0.4 }; fxAura(s, '#fff38a'); fxSpr('spark', s.x, s.y + 1, s.z + 70, { w: 90, dur: 0.4 }); })] } }] });
smDef('sm_aqueris', 'aqueris', { ring: '#9ad84a', h: 130, speed: 160, pref: 200, life: 200, tags: ['spirit', 'higher'], col: '#9fe6ff', deathBlast: smDeath('ice', 'freeze', '#9fe6ff', 1.5),
  attacks: [{ clip: 'atk1', range: [60, 420], dy: 50, cd: [1, 1.2], w: 3, act: { dur: 0.6, events: [evAt(0.25, s => { sfx.ice(); smShot(s, { dmg: 0.4, col: '#bfefff', elem: 'ice', img: 'icespike', speed: 620 }); })] } },
    { clip: 'cast', range: [0, 200], dy: 60, cd: [2, 2.4], w: 1, act: { dur: 0.9, events: [evAt(0.45, s => { fxSpr('frost', s.x + s.face * 110, s.y, 0, { w: 260, dur: 0.6, ay: 0.75 }); summonArea(s, s.x + s.face * 110, s.y, 140, { dmg: 0.7, stun: 0.4, knock: 60, hs: 0.04, elem: 'ice', type: 'mag' }, { zMax: 120 });
      for (const t of ents) if (foe(s.owner, t) && inGround(t, s.x + s.face * 110, s.y, 140) && Math.random() < 0.1) addStatus(t, 'freeze', 1.2, { src: s.owner }); })] } },
    { clip: 'roar', range: [100, 460], dy: 100, cd: [5, 5.5], w: 1, act: { dur: 0.9, events: [evAt(0.4, s => { for (let i = 0; i < 3; i++) game.after(i * 0.12, () => { if (!s.gone) smShot(s, { dmg: 0.35, col: '#bfefff', elem: 'ice', img: 'icespike', home: true, speed: 420, life: 1.4 }); }); })] } }] });
smDef('sm_flamehulk', 'flamehulk', { h: 132, w: 16, speed: 170, pref: 45, life: 200, tags: ['spirit', 'higher'], col: '#ff8a3a', deathBlast: smDeath('fire', 'burn', '#ff8a3a', 3),
  attacks: [{ clip: 'club', range: [0, 105], dy: 24, cd: [1, 1.2], w: 2, act: { dur: 0.9, hits: [mH(0.42, 0.5, [0, 108, 30, 0, 120], 0.6, { elem: 'fire', snd: 'fire', knock: 100, onHit: (a, t) => { if (Math.random() < 0.1) addStatus(t, 'burn', 3, { dps: atkOf(a.owner, 'mag') * 0.05, src: a.owner }); } })] } },
    { clip: 'pounce', range: [60, 300], dy: 24, cd: [1.5, 1.8], w: 1, act: { dur: 1.0, events: [evAt(0.5, s => { sfx.hit('fire', false); shootProj(s, { img: 'slash', col: '#ff9a50', w: 140, speed: 560, life: 0.75, z: 30, bw: 34, bd: 22, bh: 100, pierce: true, hit: { dmg: 0.5 * s.mul, stun: 0.4, knock: 60, hs: 0.04, elem: 'fire', type: 'mag', rep: 0.15, max: 2 } }); })] } }] });
// ---- 精灵王伊伽贝拉：常驻霸体；附近的己方精灵伤害 +15%，自己每有一只精灵 +15%（最多 +30%）；攻击自动用敌人抗性最低的属性 ----
const bestElem = (t) => { let best = 'fire', v = 1e9; for (const el of ['fire', 'ice', 'light', 'dark']) { const r = (t && t.res && t.res[el]) || 0; if (r < v) { v = r; best = el; } } return best; };
smDef('sm_echeverria', 'echeverria', { ring: '#9ad84a', h: 140, w: 16, speed: 150, pref: 120, life: 200, sa: true, tags: ['spirit', 'king'], col: '#ffd070',
  update: s => { const L = summonsOf(s.owner, { tag: 'spirit' }).filter(x => x !== s && Math.abs(x.x - s.x) < 400); for (const x of L) x.buffs.king = { t: 0.5, dmg: 0.15 }; s.buffs.kingSelf = { t: 0.5, dmg: Math.min(0.3, L.length * 0.15) }; },
  attacks: [{ clip: 'atk1', range: [0, 110], dy: 26, cd: [0.6, 0.8], w: 2, act: { dur: 0.6, events: [evAt(0.25, s => { const t = summonTarget(s); if (t) summonHit(s, t, { dmg: 0.7, stun: 0.4, knock: 80, hs: 0.05, elem: bestElem(t), type: 'mag' }); })] } },
    // 音波（冷却 3.1s）：射出一道很长的新月形冲击波，击退沿途的敌人
    { clip: 'roar', range: [0, 520], dy: 90, cd: [3.1, 3.5], w: 1, act: { dur: 1.0, events: [evAt(0.45, s => { sfx.boom(0.4); fxShock(s.x + s.face * 30, s.y, 120, '#ffd070'); shootProj(s, { img: 'slash', col: '#ffd070', w: 260, speed: 560, life: 1.0, z: 40, bw: 60, bd: 60, bh: 120, pierce: true, hit: { dmg: 0.8 * s.mul, stun: 0.5, knock: 220, hs: 0.05, elem: 'light', type: 'mag', col: '#ffd070', max: 1 } }); })] } },
    { clip: 'cast', range: [60, 420], dy: 100, cd: [5, 5.5], w: 1, act: { dur: 1.2, events: [evAt(0.4, s => { for (let i = 0; i < 7; i++) game.after(i * 0.1, () => { if (s.gone) return; const t = summonTarget(s); const x = (t ? t.x : s.x + s.face * 150) + rnd(-90, 90), y = clamp((t ? t.y : s.y) + rnd(-40, 40), 6, DEPTH - 6); smBolt(s, x, y, 0.3); }); })] } },
    { clip: 'axe', range: [60, 540], dy: 36, cd: [9.3, 10], w: 1, act: { dur: 1.2, events: [evAt(0.55, s => { const t = summonTarget(s), el = bestElem(t); sfx.zap(); fxBeam(s.x + s.face * 30, s.y, s.z + 70, 560, s.face, { w: 42, col: ELEM_COL[el], dur: 0.4 });
      instantHit(s, { box: [10, 570, 36, 10, 130], dmg: 1.4 * s.mul, stun: 0.5, knock: 120, hs: 0.06, elem: el, type: 'mag' }); })] } }] });
// ---- 技能 ----
// 施放时间按官方：弗利特 0.7 / 桑德尔 0.8 / 袄索 0.7 / 露易丝 1.0 / 库鲁塔 1.2 / 伊伽贝拉 1.0 / 上级精灵 0.7
const smSummonAct = (key, lv, cast = 0.5, extra = {}) => ({ name: key, clip: 'smSummon', dur: cast, cancelFrom: cast * 0.72, noCounter: true, ...extra,
  events: [evAt(cast * 0.44, e => { sfx.magic(); summon(e, key, { lv, mul: smMul(e, lv) }); })] });
// 交感（心灵感应）：契约兽在场时再按一次召唤键，它瞬移到你前方放专属招；需要心灵感应达到对应等级
// 无动作下令（recast.instant）：放别的技能 / 普攻的过程中也能按，不打断你自己的动作（官方交感 / 附灵都可以在动作中施放）
const smOrderNow = (p, key, cmd, name, arg) => { const n = summonCmd(p, key, cmd, { ...smCmdArg(p), ...(arg || {}) }); if (n) fxText(name, p.x, p.y, p.z + 30, { col: '#e0c0ff', size: 10, dur: 0.5 }); return n; };
const smRecast = (key, need, cd, mp) => ({ ok: p => jobOf(p) === SM && summonsOf(p, key).length > 0 && skLv(p, 'sm_telepathy') >= need, cd, mp, instant: true,
  act: (lv, p) => { smOrderNow(p, key, 'special', '交感'); } });
defSkill('sm_aura', { name: '召唤兽强化', cls: 'mage', job: SM, lvReq: 15, passive: true, type: 'mag', col: '#b89aff', desc: '【被动光环】全图的召唤兽攻击力提高；你的魔法暴击率提高。', infoExtra: lv => [['召唤兽攻击力', '+' + pct(0.02 + 0.02 * lv)], ['魔法暴击率', '+' + pct(0.05 + 0.005 * lv)]] });
defSkill('sm_telepathy', { name: '心灵感应', cls: 'mage', job: SM, lvReq: 15, maxLv: 6, passive: true, type: 'mag', col: '#e0a0ff',
  desc: '【被动】技能攻击力提高。每升一级解锁一只契约兽的交感（召唤兽在场时再按一次召唤键，它瞬移到你前方放专属招；按住 ↓ 再按则瞬移到你脚下）：1 赫德尔 → 2 弗利特 → 3 桑德尔 → 4 袄索 → 5 露易丝 → 6 库鲁塔。',
  infoExtra: lv => [['技能攻击力', '+' + pct(0.03 + 0.02 * lv)], ['已解锁交感', ['赫德尔', '弗利特', '桑德尔', '袄索', '露易丝', '库鲁塔'].slice(0, lv).join('、')]] });
defSkill('sm_lesser', { name: '下级精灵召唤', cls: 'mage', job: SM, lvReq: 15, mp: 30, cd: 2, type: 'mag', col: '#8ad0ff', cast: true,
  desc: '一次召唤火、冰、暗、光四种下级精灵各 1 只，在场 30 秒：亚德炎（火，近身连打）、冰奈斯（冰，近战 + 远程，召唤时为你回复少量 HP）、瑟冥特克（暗，攻击快、硬直长，几率诅咒）、雷沃斯（光，电击，背击几率眩晕）。',
  pow: lv => skillDmg(0.8, 0.08, lv), ai: { kind: 'buff', summon: 'sm_ador' },
  act: (lv) => ({ name: 'sm_lesser', clip: 'smSummon', dur: 0.3, cancelFrom: 0.22, noCounter: true, events: [evAt(0.14, e => { sfx.magic(); LESSER.forEach((k, i) => game.after(i * 0.05, () => { if (!e.dead) summon(e, k, { lv, mul: smMul(e, lv), x: e.x + e.face * (30 + i * 16), y: clamp(e.y + (i - 1.5) * 16, 6, DEPTH - 6) }); })); })] }) });
defSkill('sm_wait', { name: '伺机而动', cls: 'mage', job: SM, lvReq: 15, maxLv: 1, mp: 5, cd: 1.2, type: 'mag', buff: true, col: '#8a8aa0',
  desc: '【开关】所有召唤兽原地停下，不再主动攻击（交感、附灵、咒令等指令攻击照常）；期间魔力印记暂停造成伤害。再按一次恢复。', ai: null,
  act: () => ({ name: 'sm_wait', clip: 'smCmd', dur: 0.3, noCounter: true, onStart: e => { const M = e.summonMode = e.summonMode || {}; M.hold = !M.hold; if (M.hold) e.buffs.sm_wait = { t: 1e9 }; else delete e.buffs.sm_wait; fxText(M.hold ? '伺机而动' : '解除', e.x, e.y, e.z + 30, { col: '#c0c0e0', size: 10 }); } }) });
defSkill('sm_follow', { name: '召唤兽跟随', cls: 'mage', job: SM, lvReq: 15, maxLv: 1, mp: 5, cd: 1, type: 'mag', buff: true, col: '#6ab0a0',
  desc: '【开关】召唤兽在你身边 100px 内跟随，只攻击靠近你的敌人；期间你受到的伤害降低 5%。再按一次恢复。', ai: null,
  act: () => ({ name: 'sm_follow', clip: 'smCmd', dur: 0.4, noCounter: true, onStart: e => { const M = e.summonMode = e.summonMode || {}; M.follow = !M.follow; if (M.follow) e.buffs.sm_follow = { t: 1e9, taken: -0.05 }; else delete e.buffs.sm_follow; fxText(M.follow ? '跟随' : '解除', e.x, e.y, e.z + 30, { col: '#a0e0d0', size: 10 }); } }) });
defSkill('sm_dismiss', { noHitCheck: true, name: '召唤解除', cls: 'mage', job: SM, lvReq: 16, maxLv: 1, mp: 0, cd: 10, type: 'mag', col: '#6a6a80', desc: '解除你的全部召唤兽。', ai: null,
  act: () => ({ name: 'sm_dismiss', clip: 'smCmd', dur: 1.2, noCounter: true, events: [evAt(0.6, e => { dismissSummons(e, undefined, 'cmd'); sfx.magic(); })] }) });
defSkill('sm_frit', { name: '契约召唤：弗利特', cls: 'mage', job: SM, lvReq: 16, mp: 40, cd: 10, type: 'mag', elem: 'fire', col: '#e06a3a', cast: true, recast: smRecast('sm_frit', 2, 10, 10),
  desc: '召唤小火龙弗利特（常驻）：撕咬（霸体）、吐火球、火焰吐息（几率灼烧）。心灵感应 2 级后可以交感：“龙之威压”——瞬移到你前方咆哮，5 段范围火焰伤害。', pow: lv => skillDmg(1.0, 0.1, lv), ai: { kind: 'buff', summon: 'sm_frit' },
  act: (lv) => smSummonAct('sm_frit', lv, 0.7) });
defSkill('sm_sacrifice', { name: '精灵献祭', cls: 'mage', job: SM, lvReq: 16, mp: 40, cd: 20, type: 'mag', col: '#e0a0ff', cast: true,
  desc: '在前方画出魔法阵，引爆阵内的下级精灵，各按属性造成爆炸（火：灼烧 / 冰：冰刺 / 暗：诅咒 / 光：落雷）。按住技能键时，先把全图的下级精灵传送到阵里再引爆。', pow: lv => skillDmg(2.0, 0.2, lv) * 4, ai: { kind: 'aoe', r: [40, 360], dy: 90 },
  act: (lv, p) => ({ name: 'sm_sacrifice', clip: 'smSac', dur: 0.8, cancelFrom: 0.6, noCounter: true, charge: { at: 0.1, max: 0.4, min: 0, dmg: 0, clip: 'smSac' },
    events: [evAt(0.2, e => { const cx = e.x + e.face * 180, cy = e.y; fxSigil('hexagram', cx, cy, 0, { w: 460, dur: 0.6, ay: 0.5, grow: [0.3, 1], col: '#e0a0ff' });
      const L = summonsOf(e, { tag: 'lesser' }); if ((e.act.chargeK || 0) > 0.2) L.forEach((s, i) => s.warp(cx + (i - 1.5) * 60, cy + ((i % 2) - 0.5) * 40));
      for (const s of L) { if (Math.hypot(s.x - cx, (s.y - cy) * 2) > 234) continue; const x = s.x, y = s.y, key = s.skey; dismissOne(s, 'cmd'); fxBurst(x, y, 40, 180, s.sdef.col); fxShock(x, y, 120, s.sdef.col); sfx.boom(0.5);
        const el = { sm_ador: 'fire', sm_naias: 'ice', sm_stalker: 'dark', sm_wisp: 'light' }[key];
        applyAreaFrom(e, x, y, 120, { dmg: skillDmg(2.0, 0.2, lv), launch: 300, knock: 100, hs: 0.08, elem: el, type: 'mag', downHit: true, big: 1.3 });
        for (const t of ents) if (foe(e, t) && inGround(t, x, y, 120)) addStatus(t, { fire: 'burn', ice: 'slow', dark: 'curse', light: 'shock' }[el], 4, { src: e, dps: el === 'fire' ? atkOf(e, 'mag') * 0.08 : 0 }); } })] }) });
defSkill('sm_sandor', { name: '契约召唤：黑骑士桑德尔', cls: 'mage', job: SM, lvReq: 17, mp: 45, cd: 10, type: 'mag', elem: 'dark', col: '#6a4a9a', cast: true, recast: smRecast('sm_sandor', 3, 12, 12),
  desc: '召唤黑骑士桑德尔（常驻、霸体）：挥剑、突刺、举盾防御（架盾时身后的你受到的伤害降低），偶尔展开守护光环。心灵感应 3 级后可以交感：蓄力后直线射出剑气。', pow: lv => skillDmg(1.4, 0.14, lv), ai: { kind: 'buff', summon: 'sm_sandor' },
  act: (lv) => smSummonAct('sm_sandor', lv, 0.8) });
defSkill('sm_domin', { name: '绝对支配', cls: 'mage', job: SM, lvReq: 17, passive: true, type: 'mag', col: '#a05ad0', desc: '【被动】鞭挞的范围大幅扩大，给召唤兽的增益持续时间变成 40 秒。' });
defSkill('sm_mark', { name: '魔力印记', cls: 'mage', job: SM, lvReq: 17, mp: 15, cd: 1, type: 'mag', col: '#ff6aa0', cast: true,
  desc: '向前方的敌人扔出魔力印记：被标记的敌人 72 秒内每秒受到伤害，附近的召唤兽会集火它。同一时间只能标记一个敌人。', pow: lv => skillDmg(0.3, 0.03, lv), infoExtra: lv => [['射程', (300 + 8 * lv) + 'px']], ai: { kind: 'proj', r: [0, 300], dy: 40 },
  act: (lv) => ({ name: 'sm_mark', clip: 'smThrow', dur: 0.5, cancelFrom: 0.3, events: [evAt(0.2, e => { const t = aimAhead(e, 200, 300 + 8 * lv, 80).t || nearestFoe(e, 300 + 8 * lv); if (!t) return;
    sfx.magic(); dismissSummons(e, 'sm_markT'); const s = summon(e, 'sm_markT', { target: t, lv }); if (s) s.dmg = skillDmg(0.3, 0.03, lv); const M = e.summonMode = e.summonMode || {}; M.mark = t; M.markR = 400 + 10 * lv; })] }) });
defSummon('sm_markT', { kind: 'attach', host: 'target', life: 72, max: 1, tick: 1, col: '#ff6aa0',
  onTick(s, h) { if ((s.owner.summonMode || NO_MODE).hold) return; summonHit(s, h, { dmg: s.dmg || 0.3, stun: 0.05, knock: 0, hs: 0.01, type: 'mag', sure: true, col: '#ff8ac0' }); },   // 伺机而动时印记不掉血（官方）
  onEnd(s) { const M = s.owner.summonMode; if (M && M.mark === s.host) M.mark = null; },
  draw(c, s) { const h = s.host; if (!h) return; const X = sx(h.x), Y = sy(h.y, h.z + h.h * (h.scale || 1) + 18); c.strokeStyle = '#ff6aa0'; c.lineWidth = 2; c.beginPath(); c.arc(X, Y, 7 + Math.sin(game.t * 6) * 1.5, 0, TAU); c.moveTo(X - 11, Y); c.lineTo(X + 11, Y); c.moveTo(X, Y - 11); c.lineTo(X, Y + 11); c.stroke(); } });
defSkill('sm_frenzy', { name: '召唤兽狂化', cls: 'mage', job: SM, lvReq: 18, mp: 40, cd: 5, type: 'mag', buff: true, col: '#e04a6a',
  desc: '【开关 BUFF】你的技能攻击力提高；1000px 内召唤兽的攻速、移速大幅提高。再按一次关闭。', infoExtra: lv => [['技能攻击力', '+' + pct(0.05 + 0.02 * lv)], ['召唤兽攻速', '+' + pct(0.2 + 0.017 * lv)], ['召唤兽移速', '+' + pct(0.2 + 0.014 * lv)]], ai: { kind: 'buff' },
  act: (lv) => ({ name: 'sm_frenzy', clip: 'cheer', dur: 0.4, noCounter: true, onStart: e => { if (toggleBuff(e, 'sm_frenzy', 1e9, { dmg: 0.05 + 0.02 * lv, lv })) { sfx.buff(); fxAura(e, '#ff6a8a'); } } }) });
defSkill('sm_aukuso', { name: '契约召唤：魔界花袄索', cls: 'mage', job: SM, lvReq: 18, mp: 45, cd: 10, type: 'mag', col: '#6a9a3a', cast: true, recast: smRecast('sm_aukuso', 4, 15, 12),
  desc: '在前方召唤魔界花袄索（常驻、不会移动）：近身刺击、从地下刺出根刺攻击远处的敌人、喷出毒雾（中毒 / 混乱）、放出贴地爬行的毒虫。换房间时从你面前的地面钻出。心灵感应 4 级后可以交感：“穿刺”——范围内每个敌人各被根刺打一下。', pow: lv => skillDmg(1.2, 0.12, lv), ai: { kind: 'buff', summon: 'sm_aukuso' },
  act: (lv) => smSummonAct('sm_aukuso', lv, 0.7) });
for (const [id, key, name, el, col, extra] of [
  ['sm_merkle', 'sm_merkle', '精灵召唤：亡魂默克尔', 'dark', '#8a4ab0', '持镰刀近战，劈砍、下劈，并在敌人脚下铺出 4 秒暗黑区域（几率致盲）；被打倒时爆炸致盲。'],
  ['sm_glarelin', 'sm_glarelin', '精灵召唤：极光格雷林', 'light', '#e0d060', '保持距离从天上降下落雷（能打到空中和倒地的敌人，几率感电）、面前一条线五连落雷；被打倒时爆炸感电。'],
  ['sm_aqueris', 'sm_aqueris', '精灵召唤：冰影阿奎利斯', 'ice', '#6ac0e8', '保持距离射出冰块、放出冰风（几率冰冻）和追踪冰导弹；被打倒时爆炸冰冻。'],
  ['sm_flamehulk', 'sm_flamehulk', '精灵召唤：火焰赫瑞克', 'fire', '#e06a2a', '持火焰短刀近战（几率灼烧），下劈时放出前进的炎火剑气；被打倒时爆炸灼烧。']])
  defSkill(id, { name, cls: 'mage', job: SM, lvReq: 18, mp: 50, cd: 10, type: 'mag', elem: el, col, cast: true, desc: `召唤上级精灵（在场 200 秒，被打倒时爆炸）：${extra}`, pow: lv => skillDmg(1.6, 0.16, lv), ai: { kind: 'buff', summon: key }, act: (lv) => smSummonAct(key, lv, 0.7) });
defSkill('sm_luise', { name: '契约召唤：露易丝姐姐', cls: 'mage', job: SM, lvReq: 19, mp: 55, cd: 10, type: 'mag', col: '#d04a5a', cast: true, recast: smRecast('sm_luise', 5, 20, 15),
  desc: '召唤火与冰的魔女露易丝（常驻）：杖击（霸体）、冰针（插在地上继续伤敌）、火球、冰柱。离场或被解除时落下 1 颗陨石。心灵感应 5 级后可以交感：召唤陨石砸向敌人。', pow: lv => skillDmg(1.6, 0.16, lv), ai: { kind: 'buff', summon: 'sm_luise' },
  act: (lv) => smSummonAct('sm_luise', lv, 1.0) });
defSkill('sm_echeverria', { name: '精灵召唤：精灵王伊伽贝拉', cls: 'mage', job: SM, lvReq: 19, mp: 70, cd: 20, type: 'mag', col: '#ffd070', cast: true,
  desc: '召唤精灵王伊伽贝拉（在场 200 秒、霸体）：触击、音波（新月形冲击波）、七连落雷、全属性激光，攻击时自动选择敌人抗性最低的属性。附近的己方精灵伤害 +15%；自己身边每有一只精灵伤害 +15%（最多 +30%）。', pow: lv => skillDmg(2.4, 0.24, lv), ai: { kind: 'buff', summon: 'sm_echeverria' },
  act: (lv) => smSummonAct('sm_echeverria', lv, 1.0) });
defSkill('sm_teleport', { noHitCheck: true, name: '召唤兽传送', cls: 'mage', job: SM, lvReq: 19, maxLv: 1, mp: 10, cd: 10, type: 'mag', col: '#8a9aff', desc: '让全部召唤兽瞬移到你所站的位置（包括不会移动的袄索）。', ai: null,
  act: () => ({ name: 'sm_teleport', clip: 'smCmd', dur: 0.7, noCounter: true, events: [evAt(0.35, e => { summonsOf(e).forEach((s, i) => { if (s.kind === 'follower') { s.warp(e.x + (i % 5 - 2) * 18, clamp(e.y + ((i % 3) - 1) * 18, 6, DEPTH - 6)); fxBurst(s.x, s.y, 40, 60, s.sdef.col || '#d8c0ff'); } }); sfx.magic(); })] }) });
defSkill('sm_kuruta', { name: '契约召唤：牛头王库鲁塔', cls: 'mage', job: SM, lvReq: 20, mp: 70, cd: 10, type: 'mag', col: '#c08040', cast: true, recast: smRecast('sm_kuruta', 6, 40, 20),
  desc: '召唤牛头王库鲁塔（常驻、霸体）：横斩、愤怒冲锋、咆哮（眩晕）。放着不管时输出最高。心灵感应 6 级后可以交感：“狂怒”——横扫把敌人拉到一起，再下劈带冲击波。', pow: lv => skillDmg(2.4, 0.24, lv), ai: { kind: 'buff', summon: 'sm_kuruta' },
  act: (lv) => smSummonAct('sm_kuruta', lv, 1.2) });
defSkill('sm_bind', { name: '束缚印记', cls: 'mage', job: SM, lvReq: 20, mp: 40, cd: 25, type: 'mag', col: '#8adf6a', cast: true,
  desc: '向前扔出黏液瓶，爆炸后把范围内的敌人定身 3 秒。', pow: lv => skillDmg(1.5, 0.15, lv), ai: { kind: 'aoe', r: [60, 320], dy: 80 },
  act: (lv) => ({ name: 'sm_bind', clip: 'smThrow', dur: 0.5, cancelFrom: 0.34, events: [evAt(0.18, e => { const at = aimAhead(e, 200, 320); sfx.swing(false);
    lobProj(e, at.x, at.y, 0.45, { img: 'poison', h: 18, onLand: pr => { sfx.boom(0.4); fxSpr('poison', pr.x, pr.y, 10, { w: 270, dur: 0.6, col: '#8adf6a' }); fxShock(pr.x, pr.y, 130, '#8adf6a');
      blast(e, pr.x, pr.y, 130, { dmg: skillDmg(1.5, 0.15, lv), stun: 0.3, knock: 10, hs: 0.05, type: 'mag' }, { zMax: 120, status: 'root', sdur: 3 }); } }); })] }) });
defSkill('sm_soul', { name: '灵魂支配', cls: 'mage', job: SM, lvReq: 21, passive: true, type: 'mag', col: '#c0a0ff', desc: '【被动·一觉】技能攻击力和施放速度提高。', infoExtra: lv => [['技能攻击力', '+' + pct(0.08 + 0.015 * lv)], ['施放速度', '+' + pct(0.05 + 0.01 * lv)]] });
// ---- 一觉：契约召唤：征服者卡西利亚斯（第四使徒的分身，剑豪） ----
// 从劈开的次元裂缝里走出，落地时击倒画面内的全部敌人；召唤过程中本体无敌。在场 200 秒（决斗场 30 秒），霸体、免疫异常。
// 放着不管时出招：不动剑（原地拔刀斩）、疾风剑（突进斩）、残心剑（下劈 + 回旋斩）；离场时放“狱冥天地”剑阵。帧里不画特效，裂缝 / 剑光 / 剑阵都在这里画
const CAS_COL = '#e0304a';
let CAS_ANIMS = null;
const casAnims = () => CAS_ANIMS || (CAS_ANIMS = { ...SPR_ANIMS.monster,
  casStep: [['step1', 0], ['step2', 0.45]], casFudo: [['stance', 0], ['iai1', 0.3], ['iai2', 0.52]], casGale: [['iai1', 0], ['dash', 0.16], ['iai2', 0.54]],
  casZan: [['slash1', 0], ['slash2', 0.26], ['spin', 0.54], ['sheath', 0.95]], casThousand: [['iai1', 0], ['dash', 0.24], ['iai2', 0.52], ['sheath', 1.1]],
  casGoku: [['raise', 0], ['plunge', 0.7], ['fade', 1.3]], casThrust: [['thrust', 0]], casUp: [['upcut', 0]], casGuard: [['guard', 0]] });
const casMul = (e, lv) => smMul(e, skLv(e, 'sm_aura') + 1) * lvMul(lv, 0.3);
// 次元裂缝：竖直的黑紫色裂口，边缘发光（source-over 画暗芯，lighter 画亮边）
function casRift(x, y, dur) {
  addFx({ x, y: y - 3, z: 0, dur, draw(c) {
    const k = this.t / this.dur, o = k < 0.12 ? k / 0.12 : k > 0.8 ? (1 - k) / 0.2 : 1, H = 250 * Math.min(1, o * 1.2), W = 36 * o * (0.85 + 0.15 * Math.sin(game.t * 22)), X = sx(this.x), Y = sy(this.y, 0) - 8;
    if (H < 2) return;
    // 官方：裂缝处升起一根紫色光柱直通画面顶端，底部一圈暗紫色的地面漩涡
    c.save(); c.globalCompositeOperation = 'lighter'; { const pw = 70 * o * (0.9 + 0.1 * Math.sin(game.t * 17)), g = c.createLinearGradient(0, 0, 0, Y); g.addColorStop(0, 'rgba(176,96,255,0.05)'); g.addColorStop(0.7, 'rgba(176,96,255,0.45)'); g.addColorStop(1, 'rgba(230,170,255,0.75)'); c.fillStyle = g; c.fillRect(X - pw / 2, 0, pw, Y); c.globalAlpha = 0.5 * o; c.fillStyle = '#ffffff'; c.fillRect(X - pw / 6, 0, pw / 3, Y); } c.restore();
    c.save(); c.fillStyle = '#12061e'; c.beginPath(); c.ellipse(X, Y - H / 2, W, H / 2, 0, 0, TAU); c.fill();
    c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.9; c.strokeStyle = '#b060ff'; c.lineWidth = 4; c.stroke();
    c.globalAlpha = 0.6; c.strokeStyle = CAS_COL; c.lineWidth = 2; c.beginPath(); c.ellipse(X, Y - H / 2, W * 1.4 + 4, H / 2 + 6, 0, 0, TAU); c.stroke(); c.restore(); } });
}
// 狱冥天地：剑从天而降插满前方，最后一起爆开（伤害按主人结算：本体离场后剑阵照样生效）
function casGokumei(o, x, y, mul) {
  const R = game.room, L = [];
  for (let i = 0; i < 9; i++) L.push({ x: clamp(x + (i - 4) * 70 + rnd(-14, 14), R ? R.x0 + 20 : -1e9, R ? R.x1 - 20 : 1e9), y: clamp(y + rnd(-70, 70), 8, DEPTH - 8), t: 0.1 + i * 0.07 });
  for (const s of L) game.after(s.t, () => {
    addFx({ x: s.x, y: s.y + 0.4, z: 0, dur: 1.4, draw(c) { const k = this.t, fall = Math.min(1, k / 0.18), z = 420 * (1 - fall), X = sx(this.x), Y = sy(this.y, z), a = k > 1.1 ? (1.4 - k) / 0.3 : 1;
      c.save(); c.globalAlpha = a; c.fillStyle = '#dfe6f2'; c.beginPath(); c.moveTo(X - 3, Y - 96); c.lineTo(X + 3, Y - 96); c.lineTo(X + 1, Y - 2); c.lineTo(X, Y + 4); c.lineTo(X - 1, Y - 2); c.fill();
      c.fillStyle = '#c8a060'; c.fillRect(X - 9, Y - 100, 18, 4); c.fillStyle = CAS_COL; c.fillRect(X - 2.5, Y - 124, 5, 24);
      if (fall < 1) { c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.5; c.fillStyle = CAS_COL; c.fillRect(X - 2, Y - 96 - 80, 4, 80); } c.restore(); } });
    game.after(0.18, () => { fxShock(s.x, s.y, 80, CAS_COL); applyAreaFrom(o, s.x, s.y, 70, { dmg: 1.2 * mul, stun: 0.5, knock: 20, hs: 0.04, type: 'mag', col: CAS_COL, downHit: true }); });
  });
  game.after(1.2, () => { if (!o || o.dead) return; sfx.boom(1.2); cam.shake = Math.max(cam.shake, 9); fxShock(x, y, 360, CAS_COL); fxBurst(x, y, 60, 400, CAS_COL);
    applyAreaFrom(o, x, y, 360, { dmg: 5 * mul, launch: 420, knock: 160, hs: 0.12, big: 1.8, type: 'mag', col: CAS_COL, downHit: true }); });
}
defSummon('sm_casillas', { kind: 'follower', name: '征服者卡西利亚斯', bundle: 'casillas', model: () => summonSprite('casillas', {}, CAS_COL, casAnims()), clips: () => summonClipsFor(casAnims()),
  w: 22, d: 16, h: 188, shadowR: 26, speed: 150, runSpeed: 320, pref: 80, sight: 720, life: 200, max: 1, col: CAS_COL, tags: ['awaken'], ai: smAI,
  onSpawn: s => { s.superArmor = Infinity; s.statusImmune = Object.fromEntries(Object.keys(STATUS_COL).map(k => [k, true])); },
  // 在场时间快到时自己放狱冥天地（举剑 → 插地）；被解除 / 被顶替 / 被打倒时剑阵直接落下
  update: s => { if (!s.goku && s.life - s.lifeT < 1.8 && s.life > 5) { s.goku = true; summonAct(s, { clip: 'casGoku', dur: 1.8, superArmor: true, events: [evAt(0.65, e => { sfx.iai(); casGokumei(e.owner, e.x + e.face * 90, e.y, e.mul); })] }); } },
  onEnd: (s, why) => { if (!s.goku && (why === 'cmd' || why === 'dead' || why === 'replaced')) casGokumei(s.owner, s.x + s.face * 90, s.y, s.mul); },
  attacks: [
    { clip: 'casFudo', range: [0, 220], dy: 36, cd: [3, 4.5], w: 3, act: { dur: 1.05, superArmor: true, hits: [mH(0.56, 0.64, [-10, 240, 40, 0, 170], 3.0, { knock: 160, stun: 0.6, hs: 0.1, heavy: true, snd: 'slash', shake: 3 })],
      events: [evAt(0.52, e => { sfx.iai(); fxSlash({ x: e.x, y: e.y, z: e.z, face: e.face, col: CAS_COL, a0: -0.6, a1: 0.9, r: 220, w: 30, off: [10, 95], squash: 0.55, dur: 0.26 }); })] } },
    { clip: 'casGale', range: [120, 420], dy: 30, cd: [5, 7], w: 2, act: { dur: 1.0, superArmor: true, move: [[0.16, 0.5, 820]],
      hits: [mH(0.16, 0.5, [0, 90, 30, 0, 170], 1.0, { knock: 30, stun: 0.5, hs: 0.04, snd: 'slash', rep: 0.08, max: 4 }), mH(0.56, 0.62, [-80, 210, 40, 0, 170], 2.0, { knock: 140, launch: 260, hs: 0.08, snd: 'slash' })],
      events: [evAt(0.16, e => { sfx.swing(true); fxAfterimage(e, CAS_COL); }), evAt(0.54, e => { sfx.iai(); fxStreak({ x: e.x - e.face * 300, y: e.y, z: e.z + 90, face: e.face, len: 420, w: 10, col: CAS_COL, dur: 0.24 }); })] } },
    { clip: 'casZan', range: [0, 230], dy: 80, cd: [7, 10], w: 1.5, act: { dur: 1.3, superArmor: true, hits: [mH(0.28, 0.36, [0, 220, 38, 0, 170], 1.6, { down: true, downHit: true, knock: 60, hs: 0.08, snd: 'slash' })],
      events: [evAt(0.26, e => { sfx.swing(true); fxSlash({ x: e.x, y: e.y, z: e.z, face: e.face, col: CAS_COL, a0: -1.6, a1: 0.9, r: 160, w: 22, off: [10, 100], dur: 0.22 }); }),
        evAt(0.56, e => { sfx.iai(); fxSlash({ x: e.x, y: e.y, z: e.z, face: e.face, col: CAS_COL, a0: -3.1, a1: 3.1, r: 260, w: 28, off: [0, 80], squash: 0.45, dur: 0.3 });
          summonArea(e, e.x, e.y, 270, { dmg: 2.4, launch: 300, knock: 120, hs: 0.1, big: 1.4, type: 'mag', radial: true, col: CAS_COL }, { zMax: 200 }); })] } }],
  cmds: {
    // 必杀剑·千鬼杀：瞬移到主人前方，拔刀冲斩穿过敌群，身后的剑气再补 5 段，收刀时一起爆开
    thousand(s, arg) { smFront(s); s.face = s.owner.face; const G = hitGroup(), k = (arg && arg.mul) || 1; summonAct(s, { clip: 'casThousand', dur: 1.6, superArmor: true, move: [[0.24, 0.5, 1300]], thousand: true,
      hits: [mH(0.24, 0.52, [-20, 140, 44, 0, 180], 0, { dmg: 3.0 * s.mul * k, knock: 20, stun: 0.9, hs: 0.06, snd: 'slash', max: 1 })],
      events: [evAt(0.22, e => { sfx.charge(); e.act.x0 = e.x; fxAfterimage(e, CAS_COL); }),
        evAt(0.5, e => { sfx.iai(); cam.shake = Math.max(cam.shake, 6); fxStreak({ x: e.act.x0, y: e.y, z: e.z + 90, face: e.face, len: Math.abs(e.x - e.act.x0) + 60, w: 14, col: CAS_COL, dur: 0.3 }); }),
        ...[0.66, 0.76, 0.86, 0.96, 1.06].map((t, i) => evAt(t, e => { const x = e.act.x0 + (e.x - e.act.x0) * (0.15 + i * 0.18); sfx.swing(i === 4);
          fxSlash({ x, y: e.y, z: 0, face: i % 2 ? -e.face : e.face, col: CAS_COL, a0: -1.2, a1: 1.2, r: 150, w: 22, off: [0, 80], dur: 0.2 });
          const lo = Math.min(e.x, e.act.x0) - 40, hi = Math.max(e.x, e.act.x0) + 40;   // 剑气补在整条冲斩路径上：路径上的每个敌人都吃满 5 段
          for (const t of ents) if (foe(e.owner, t) && !t.dead && t.invul <= 0 && t.x + t.w >= lo && t.x - t.w <= hi && Math.abs(t.y - e.y) < 80 && t.z < 220) summonHit(e, t, { dmg: 1.4 * k, stun: 0.6, knock: 10, hs: 0.05, type: 'mag', col: CAS_COL, downHit: true }); })),
        evAt(1.25, e => { sfx.boom(1.1); cam.shake = Math.max(cam.shake, 10); const cx = (e.x + e.act.x0) / 2; fxShock(cx, e.y, Math.abs(e.x - e.act.x0) / 2 + 150, CAS_COL);
          for (const t of ents) if (foe(e.owner, t) && inGround(t, cx, e.y, Math.abs(e.x - e.act.x0) / 2 + 150) && t.z < 220) summonHit(e, t, { dmg: 5.0 * k, launch: 380, knock: 120, hs: 0.12, big: 1.8, type: 'mag', col: CAS_COL, downHit: true }, { hitGroup: G }); })] }); } } });
defSkill('sm_awaken', { name: '契约召唤：征服者卡西利亚斯', cls: 'mage', job: SM, lvReq: 21, maxLv: 3, mp: 150, cd: 145, pvp: 0.45, type: 'mag', awaken: true, col: CAS_COL,
  desc: '【觉醒】用禁断之术劈开次元，召唤第四使徒的分身“征服者卡西利亚斯”：他从裂缝里走出，落地时击倒画面内的全部敌人。在场 200 秒（决斗场 30 秒），霸体、免疫异常，放着不管时施展不动剑、疾风剑、残心剑；离场时放出“狱冥天地”剑阵。召唤过程中你处于无敌状态。',
  pow: lv => skillDmg(12, 3, lv), ai: { kind: 'awaken', r: [0, 420], dy: 120 }, infoExtra: () => [['在场时间', '200 秒'], ['离场', '狱冥天地（剑阵）']],
  act: (lv) => ({ name: 'sm_awaken', clip: 'smAwk', dur: 2.0, superArmor: true, noCounter: true, invul: true,
    onStart: e => { game.cutin = { t: 0, dur: 1.0, name: '征服者卡西利亚斯', who: cutinWho(e) }; game.timeStop = 0.9; sfx.awaken(); dismissSummons(e, 'sm_casillas', 'replaced');
      // 官方：召唤要消耗最大 HP（1 级 10%，随等级降到 5%；不会因此死亡）
      { const cost = Math.min(Math.round(e.hpMax * Math.max(0.05, 0.11 - 0.01 * lv)), Math.max(0, e.hp - 1)); if (cost > 0) { e.hp -= cost; addNumber(cost, e.x, e.y, e.z + 40, { player: true }); } }
      const R = game.room, x = e.x + e.face * 150; e.act.rx = R ? clamp(x, R.x0 + 40, R.x1 - 40) : x; e.act.ry = e.y; },
    events: [evAt(0.95, e => { sfx.charge(); casRift(e.act.rx, e.act.ry, 2.0); cam.shake = Math.max(cam.shake, 4); }),
      evAt(1.25, e => { const s = summon(e, 'sm_casillas', { lv, mul: casMul(e, lv), x: e.act.rx, y: e.act.ry, life: game.pvp ? 30 : 200 }); if (s) { s.face = e.face; summonAct(s, { clip: 'casStep', dur: 0.9, superArmor: true }); } }),
      evAt(1.7, e => { cam.flash = 0.25; cam.flashCol = '#ffd0e0'; cam.shake = 12; sfx.boom(1.3); fxShock(e.act.rx, e.act.ry, 620, CAS_COL); fxShock(e.act.rx, e.act.ry, 420, '#ffd0e0');
        for (const t of ents) if (foe(e, t) && t.invul <= 0 && !t.remove && !t.dead) applyHit(e, t, { dmg: skillDmg(12, 3, lv), down: true, launch: 240, knock: 60, hs: 0.12, big: 1.8, sure: true, downHit: true, type: 'mag', col: CAS_COL, box: null }, { proj: true, src: { x: e.act.rx, y: e.act.ry, z: 0, face: e.face } });
        e.invul = Math.max(e.invul, 0.6); })] }) });
defSkill('sm_thousand', { name: '必杀剑·千鬼杀', cls: 'mage', job: SM, lvReq: 21, mp: 80, cd: 145, type: 'mag', col: CAS_COL, req: p => summonsOf(p, 'sm_casillas').length > 0 || '卡西利亚斯不在场',
  desc: '卡西利亚斯在场时才能用：他瞬移到你前方拔刀冲斩，穿过敌群，身后的剑气再补 5 段，收刀时一起爆开。期间你处于无敌状态。', pow: lv => skillDmg(9, 0.9, lv) * 3, ai: { kind: 'burst', r: [0, 440], dy: 80 },
  act: (lv) => ({ name: 'sm_thousand', clip: 'smCmd', dur: 0.5, noCounter: true, invul: true, onStart: e => { const s = summonsOf(e, 'sm_casillas')[0]; if (!s) return; summonCmd(e, 'sm_casillas', 'thousand', { mul: lvMul(lv, 0.1) }); e.invul = Math.max(e.invul, 1.6);
    fxText('千鬼杀', e.x, e.y, e.z + 40, { col: '#ff8090', size: 12, dur: 0.6 }); } }) });
// 赫德尔的交感（心灵感应 1 级）：瞬移到你前方冲刺 4 连棍
SKILLS.mg_hodor.recast = smRecast('hodor', 1, 8, 8);
{ const D = SUMMON_DEFS.hodor, a0 = D.ai; D.ai = (s, dt) => { const M = s.owner.summonMode; if (M && M.hold && !M.follow) return smAI(s, dt); if (a0) a0(s, dt); else summonAI(s, dt); }; }
SUMMON_DEFS.hodor.cmds = { special(s, arg) { smFront(s, arg); summonAct(s, { clip: 'club', dur: 1.1, move: [[0.1, 0.6, 260]], superArmor: true,
  hits: [0.15, 0.3, 0.45, 0.6].map((t0, i) => mH(t0, t0 + 0.08, [0, 84, 26, 0, 90], 0.45 * s.mul, { knock: i === 3 ? 180 : 40, stun: 0.4, heavy: i === 3 })),
  events: [0.14, 0.29, 0.44, 0.59].map(t => evAt(t, e => sfx.swing(true))) }); } };
CLASSES.mage.jobs.summoner = { art: 'job/summoner', name: '召唤师', role: '远程 · 召唤', armor: 'cloth', awaken: 'sm_awaken', awakenName: '月之女皇', growth: { int: 1.1, spr: 1.06 },
  desc: '召唤具有元素属性的精灵、以及与之签订契约的怪物协同作战的魔法师。召唤兽常驻在场，伤害按你的魔攻计算；交感能让契约兽瞬移到你身前放专属招。',
  skills: ['sm_aura', 'sm_telepathy', 'sm_lesser', 'sm_wait', 'sm_follow', 'sm_dismiss', 'sm_frit', 'sm_sacrifice', 'sm_sandor', 'sm_domin', 'sm_mark', 'sm_frenzy', 'sm_aukuso',
    'sm_merkle', 'sm_glarelin', 'sm_aqueris', 'sm_flamehulk', 'sm_luise', 'sm_echeverria', 'sm_teleport', 'sm_kuruta', 'sm_bind', 'sm_soul', 'sm_awaken', 'sm_thousand'] };
CLASSES.mage.cmds.push(['dd', 'sm_lesser'], ['uu', 'sm_frit'], ['bf', 'sm_sandor', 'buff'], ['ff', 'sm_aukuso', 'buff'], ['fff', 'sm_dismiss', 'buff'], ['bdf', 'sm_echeverria', 'buff'], ['bdf', 'sm_sacrifice'],
  ['bff', 'sm_mark'], ['ufu', 'sm_frenzy', 'buff'], ['udu', 'sm_luise'], ['uff', 'sm_kuruta'], ['fdf', 'sm_merkle'], ['udd', 'sm_glarelin'], ['dfd', 'sm_aqueris'], ['fuf', 'sm_flamehulk'],
  ['db', 'sm_wait', 'buff'], ['fb', 'sm_follow', 'buff'], ['ub', 'sm_teleport', 'buff'], ['ud', 'sm_bind'], ['uudd', 'sm_awaken'], ['bdb', 'sm_thousand']);
// ---- 被动刷新（每 0.25 秒）：召唤兽强化光环、狂化、心灵感应 / 灵魂支配加成 ----
CLASSES.mage.passives.push(p => {
  if (jobOf(p) !== SM) return;
  const al = skLv(p, 'sm_aura'), fr = p.buffs.sm_frenzy, L = summonsOf(p);
  for (const s of L) { if (s.kind !== 'follower') continue; if (al) s.buffs.aura = { t: 0.5, atk: 0.02 + 0.02 * al };
    if (fr && Math.abs(s.x - p.x) < 1000) s.buffs.frenzy = { t: 0.5, aspd: 0.2 + 0.017 * (fr.lv || 1), mspd: 0.2 + 0.014 * (fr.lv || 1) }; }
  setPassive(p, 'sm_aura', al > 0, { crit: 0.05 + 0.005 * al });
  const tl = skLv(p, 'sm_telepathy'); setPassive(p, 'sm_telepathy', tl > 0, { dmg: 0.03 + 0.02 * tl });
  const sl = skLv(p, 'sm_soul'); setPassive(p, 'sm_soul', sl > 0, { dmg: 0.08 + 0.015 * sl, cspd: 0.05 + 0.01 * sl });
});
// 召唤兽的美术：召唤师在城镇 / 进地下城时预先加载，召唤出来就是正式造型
const SM_BUNDLES = ['sandor', 'ador', 'naias', 'stalker', 'wisp', 'frit', 'aukuso', 'luise', 'merkle', 'glarelin', 'aqueris', 'flamehulk', 'echeverria', 'goblinCaptain', 'tauKing', 'casillas'];
function smPreload() { const p = game.player; if (!p || p.cls !== 'mage' || jobOf(p) !== SM || typeof loadBundles !== 'function') return; const need = SM_BUNDLES.filter(b => !IMG[`spr/${b}/idle`]).map(b => 'spr:' + b); if (need.length) loadBundles(need).catch(() => { }); }
bus.on('sceneEnter', smPreload); bus.on('dungeonEnter', smPreload); bus.on('jobChange', smPreload);
