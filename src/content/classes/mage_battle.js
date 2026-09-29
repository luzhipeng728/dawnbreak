/* =====================================================================
   转职：战斗法师（魔法师）—— 按国服现版（2024-03-21 重做后）对齐（docs/SKILLS_OFFICIAL_mage.md 3.3）
   炫纹：每 7 秒自动生成 1 个、直接攻击命中时生成 1 个（每个动作一次），每个存在 30 秒，最多 9 个；
         命中敌人后按炫纹键（→+Space）把最早的一个射向最后命中的敌人（冷却 0.5 秒、800px 内），炫纹命中后 30 秒内攻击 / 攻速 / 移速 / 暴击提高
   尼巫的战术：普攻变成 刺 → 上挑 → 横扫；龙牙、碎霸命中后可以接体术技能（links）
   斗神意志：按连击数分 3 段（10 / 20 / 30 连击），每段提高攻速、移速、回避；连击断了约每 4 秒掉一段
   流星闪影击 / 煌龙偃月期间按住炫纹键（技能栏键或 Space）自动连发（间隔 0.2 秒）；战灵潜能学会后炫纹变成金色
   觉醒：星纹陨爆（贝亚娜斗神）
   ===================================================================== */
const BM = 'battlemage';
const CHASER_COL = '#8ac8ff', CHASER_LIFE = 30;
const BM_BODY = ['mg_sky', 'mg_palm', 'mg_fang', 'bm_round', 'bm_double', 'bm_bomb', 'bm_smash', 'bm_flash', 'bm_raid', 'bm_dragon'];   // 体术技能（尼巫的战术的衔接目标）
const chaserMax = p => 9;
const chCol = p => p && hasSkill(p, 'bm_potential') ? '#ffd870' : CHASER_COL;   // 战灵潜能：炫纹外观改变
const liveChasers = p => (p.chasers = (p.chasers || []).filter(c => game.t - c < CHASER_LIFE));
// 按住炫纹键（技能栏里炫纹那一格或 Space）：流星闪影击 / 煌龙偃月期间自动连发；AI 视为一直按住
function chaserHeld(p) { const I = p.pad; if (!isHuman(p)) return true; if (!I) return false; const slot = barOf(p).indexOf('bm_chaser'); return (slot >= 0 && I.is('s' + slot)) || I.is('cmdB'); }
function chaserAuto(e, iv) { const a = e.act; if (!hasSkill(e, 'bm_chaser') || !chaserHeld(e) || game.t - (a.chT || -9) < iv || !liveChasers(e).length) return; const t = chaserTarget(e) || nearestFoe(e, 400, o => (o.x - e.x) * e.face > 0); if (t) { a.chT = game.t; e.chasers.shift(); fireChaser(e, t); } }
const BM_HAND = { x: 25, z: 128 };   // bmCall 帧里举起的那只手（帧像素量出来换成世界单位）：超级炫纹 / 星纹陨爆的球画在这里，不画进角色帧
function addChaser(p, n = 1) {
  if (!hasSkill(p, 'bm_chaser')) return;
  p.chasers = (p.chasers || []).filter(c => game.t - c < CHASER_LIFE);
  for (let i = 0; i < n && p.chasers.length < chaserMax(p); i++) p.chasers.push(game.t);
  chaserOrbit(p);
}
function chaserOrbit(p) {
  if (p._chFx && fxList.indexOf(p._chFx) >= 0) return;
  p._chFx = addFx({ ent: p, y: p.y, dur: 1e9, update() { const e = this.ent; this.y = e.y + 0.2; if (e.dead || ents.indexOf(e) < 0 || jobOf(e) !== BM) this.t = this.dur; },
    draw(c) { const e = this.ent, L = e.chasers || []; const n = L.length; if (!n) return; const img = fxTint('orb', chCol(e));
      for (let i = 0; i < n; i++) { const a = game.t * 2.6 + i * TAU / n, r = 24 + n * 1.5, x = e.x + Math.cos(a) * r, z = e.z + 78 + Math.sin(a * 2) * 5, y = e.y + Math.sin(a) * 6, fade = CHASER_LIFE - (game.t - L[i]) < 3 ? 0.4 + 0.3 * Math.sin(game.t * 20) : 1;
        drawSpr(c, 'chaser', sx(x), sy(y, z), 16, 16, { alpha: fade }); drawSpr(c, img, sx(x), sy(y, z), 12, 12, { alpha: fade }); } } });
}
// 射出一个（或融合后的一个大）炫纹，追向目标；命中后给自己挂炫纹增益
function fireChaser(p, t, o = {}) {
  const lv = Math.max(1, skLv(p, 'bm_chaser')), big = o.big || 1, col = chCol(p), img = fxTint('orb', col);
  const from = o.from || { x: p.x, z: p.z + 80 };
  const pr = spawnProj({ owner: p, x: from.x, y: p.y, z: from.z, vx: p.face * 200, vz: 160, face: p.face, life: 1.6, w: 10 * big, d: 12 * big, h: 14 * big, pierce: false,
    hit: { dmg: (o.dmg || skillDmg(0.9, 0.09, lv)), stun: 0.3, knock: 40, airLift: 150, hs: 0.04, type: 'phys', col, noChaser: true, ...(o.hit || {}) },
    update(q, dt) { const tt = t && !t.dead && !t.remove ? t : nearestFoe(p, 800); if (tt) { const dx = tt.x - q.x, dy = tt.y - q.y, dz = tt.z + tt.hurtH() * 0.5 - q.z, l = Math.hypot(dx, dy * 2, dz) || 1, sp = 560;
      q.vx = damp(q.vx, dx / l * sp, 9, dt); q.vy = damp(q.vy, dy / l * sp, 9, dt); q.vz = damp(q.vz, dz / l * sp, 9, dt); } if (Math.random() < 0.6) addFx({ x: q.x, y: q.y + 0.3, z: q.z, dur: 0.2, draw(c) { const k = this.t / this.dur; drawSpr(c, img, sx(this.x), sy(this.y, this.z), 12 * big * (1 - k), 0, { alpha: 0.6 * (1 - k) }); } }); },
    onHitT(q, tt) { if (!o.noBuff) chaserBuff(p); if (p.cool && p.cool.bm_primal > 0) p.cool.bm_primal = Math.max(0, p.cool.bm_primal - 0.5); },   // 太古化身：炫纹命中缩短冷却
    onEnd(q) { fxBurst(q.x, q.y, q.z, 60 * big, col); if (o.burst) { sfx.boom(0.4 + big * 0.1); fxShock(q.x, q.y, o.burst * 1.2, col); blast(p, q.x, q.y, o.burst, { dmg: o.burstDmg || skillDmg(0.8, 0.08, lv), down: true, downLift: 160, knock: 90, hs: 0.07, type: 'phys', col, downHit: true, noChaser: true }, { zMax: 200 }); } },
    draw(c, q) { drawSpr(c, 'chaser', sx(q.x), sy(q.y, q.z), 22 * big, 22 * big); drawSpr(c, img, sx(q.x), sy(q.y, q.z), 16 * big, 16 * big); } });
  sfx.magic(); return pr;
}
function chaserBuff(p) { const lv = Math.max(1, skLv(p, 'bm_chaser')); p.buffs.bm_chaserHit = { t: 30, dmg: 0.1 + 0.005 * lv, aspd: 0.1, mspd: 0.15, crit: 0.1 + 0.005 * lv }; }
// 最后一次直接攻击命中的目标（2 秒内、800px 内）
function chaserTarget(p) { const t = p._lastHitTgt; return t && !t.dead && !t.remove && game.t - (p._lastHitT || -9) < 2 && Math.abs(t.x - p.x) < 800 ? t : null; }
function shootOneChaser(p) {
  p.chasers = (p.chasers || []).filter(c => game.t - c < CHASER_LIFE);
  const t = chaserTarget(p); if (!p.chasers.length || !t) return false;
  p.chasers.shift(); fireChaser(p, t); return true;
}
// ---- 被动 ----
defSkill('bm_combo', { name: '连击精通', cls: 'mage', job: BM, lvReq: 15, maxLv: 1, passive: true, type: 'phys', col: '#e0a040', desc: '【被动】连击判定的间隔延长 0.3 秒，连击更不容易断。' });
defSkill('bm_shieldup', { name: '魔法护盾强化', cls: 'mage', job: BM, lvReq: 15, maxLv: 1, passive: true, type: 'mag', col: '#3a8ad8', desc: '【被动】魔法护盾额外降低 3% 受到的伤害；进入地下城时自动开启魔法护盾（需要学会魔法护盾）。' });
defSkill('bm_niu', { name: '尼巫的战术', cls: 'mage', job: BM, lvReq: 15, passive: true, type: 'phys', col: '#e0b040',
  desc: '【被动】普攻变成战斗法师专属的 3 段：直刺 → 上挑 → 大横扫。技能攻击力和暴击率提高。龙牙、碎霸命中后可以取消后摇接体术技能（天击、落花掌、圆舞棍、双重锤击、炫纹爆弹、碎霸、流星闪影击、强袭流星打、煌龙偃月）。',
  infoExtra: lv => [['技能攻击力', '+' + pct(0.1 + 0.01 * lv)], ['暴击率', '+' + pct(0.1 + 0.005 * lv)]] });
defSkill('bm_realphase', { name: '实战型替身草人', cls: 'mage', job: BM, lvReq: 15, maxLv: 1, passive: true, type: 'mag', col: '#b89a50',
  desc: '【被动】替身草人不用挨打也能随时施放，冷却缩短 5 秒；不再留下草人，改为自己获得 5 秒攻速 / 移速 +10%。' });
defSkill('bm_weapon', { name: '战斗法师武器精通', cls: 'mage', job: BM, lvReq: 16, passive: true, type: 'phys', col: '#a07a4a',
  desc: '【被动】提高武器攻击力和暴击率；落花掌、强袭流星打的满蓄时间减半。', infoExtra: lv => [['攻击力', '+' + pct(0.04 + 0.01 * lv)], ['暴击率', '+' + pct(0.02 + 0.003 * lv)]] });
defSkill('bm_will', { name: '斗神意志', cls: 'mage', job: BM, lvReq: 21, passive: true, type: 'phys', col: '#ffd23a',
  desc: '【被动·一觉】技能攻击力提高；按连击数分 3 段（10 / 20 / 30 连击），每段提高攻速、移速和回避。连击断了以后约每 4 秒掉一段。', infoExtra: lv => [['技能攻击力', '+' + pct(0.06 + 0.01 * lv)], ['每段', '攻速 / 移速 +5%，回避 +6.6%']] });
// ---- 炫纹（→+Space）：无动作施放，把最早的炫纹射向最后命中的敌人 ----
defSkill('bm_chaser', { name: '炫纹', cls: 'mage', job: BM, lvReq: 15, mp: 3, cd: 0.5, type: 'phys', col: '#5aa8e0', noForce: true,
  desc: '战斗法师的核心。每 7 秒自动生成 1 个炫纹，普攻或技能命中敌人时也会生成；每个炫纹存在 30 秒，最多 9 个。直接攻击命中敌人后按技能键，把最早生成的炫纹射向最后命中的敌人（800px 内）。炫纹命中后 30 秒内技能攻击力、攻速、移速、暴击率提高。其他动作中也能施放。',
  pow: lv => skillDmg(0.9, 0.09, lv), infoExtra: lv => [['炫纹上限', '9'], ['命中增益', `攻击 +${pct(0.1 + 0.005 * lv)}，攻速 +10%，移速 +15%，暴击 +${pct(0.1 + 0.005 * lv)}`]], ai: { kind: 'buff' },
  instant: (lv, p) => { if (!shootOneChaser(p) && isHuman(p)) fxText('没有目标', p.x, p.y, p.z + 30, { col: '#9ab', size: 10, dur: 0.5 }); return true; },
  act: (lv) => ({ name: 'bm_chaser', clip: 'chaser', dur: 0.2, noCounter: true, onStart: e => shootOneChaser(e) }) });
// ---- 技能 ----
// 圆舞棍：刺中前方一个敌人（抓取），举过头摔到身后（抓住时按 → 摔到身前），落地冲击波；摔的过程中无敌，期间射出 2 个炫纹
defSkill('bm_round', { name: '圆舞棍', cls: 'mage', job: BM, lvReq: 15, mp: 30, cd: 4, type: 'phys', col: '#6a3a9a',
  desc: '刺中前方一个敌人（抓取，能抓霸体和格挡中的敌人），举过头顶摔到身后，落地冲击波击倒周围敌人；抓住时按 → 改为摔到身前。摔的过程中无敌，可以射出炫纹。抓不住的敌人只受到刺击伤害。', pow: lv => skillDmg(4.0, 0.4, lv), ai: { kind: 'grab', r: [0, 100], dy: 24 },
  act: (lv) => ({ name: 'bm_round', clip: 'bmThrow', dur: 0.95, noCounter: true, invul: [0.14, 0.7], superArmor: [0, 0.14],
    hits: [HB(0.06, 0.14, [0, 100, 28, 10, 110], skillDmg(0.8, 0.08, lv), { grab: true, stun: 0.4, hs: 0.05, snd: 'stab' })],
    onGrab: e => { e.act.fwd = false; },
    onInput: (e, I) => { if (e.grabbed && I.dx() === e.face) e.act.fwd = true; return false; },
    hold: (e, t) => { const k = clamp((e.actT - 0.14) / 0.42, 0, 1), a = Math.PI * k, c = Math.cos(a); t.x = e.x + e.face * (e.act.fwd ? Math.abs(c) : c) * 44; t.y = e.y + 0.5; t.z = e.z + 30 + Math.sin(a) * 76; t.face = -e.face; },   // 举过头顶：默认落到身后，按 → 折回身前
    // 摔的过程中可以手动射 2 次炫纹（炫纹是无动作施放，本来就能按）；AI 不会手动按，替它射
    events: [evAt(0.3, e => { if (e.grabbed && !isHuman(e) && liveChasers(e).length) { e.chasers.shift(); fireChaser(e, e.grabbed); } }),
      evAt(0.45, e => { if (e.grabbed && !isHuman(e) && liveChasers(e).length) { e.chasers.shift(); fireChaser(e, e.grabbed); } }),
      evAt(0.58, e => { const g = e.grabbed; if (!g) { e.act.dur = Math.min(e.act.dur, 0.62); return; } const dir = e.act.fwd ? 1 : -1; sfx.swing(true);
        g.x = e.x + dir * e.face * 46; g.z = 30;
        throwGrab(e, { dmg: skillDmg(2.0, 0.2, lv), down: true, downLift: 120, knock: 60 * dir, bounce: 0.5, hs: 0.1, shake: 4, big: 1.5 });   // 往摔的方向弹开（身后 = 反向击退）
        const x = e.x + dir * e.face * 40; fxShock(x, e.y, 150, '#b080ff'); fxShock(x, e.y, 110, '#e0c0ff'); cam.shake = Math.max(cam.shake, 5); sfx.boom(0.7);
        blast(e, x, e.y, 130, { dmg: skillDmg(1.2, 0.12, lv), down: true, knock: 120, hs: 0.06, downHit: true }); })] }) });
// 战斗本能：开关型增益，技能攻击力提高，身上出现红色电光
defSkill('bm_instinct', { name: '战斗本能', cls: 'mage', job: BM, lvReq: 16, mp: 30, cd: 5, type: 'phys', buff: true, col: '#e04a4a',
  desc: '【开关 BUFF】身上出现红色电光气场，技能攻击力提高。再按一次关闭。', infoExtra: lv => [['技能攻击力', '+' + pct(0.1 + 0.01 * lv)]], ai: { kind: 'buff' },
  act: (lv) => ({ name: 'bm_instinct', clip: 'cheer', dur: 0.4, noCounter: true, onStart: e => { if (toggleBuff(e, 'bm_instinct', 1e9, { dmg: 0.1 + 0.01 * lv })) { sfx.buff(); fxAura(e, '#ff5a5a'); } } }) });
// 双重锤击：先下砸一次，再跳起在空中转体下砸第二次（带冲击波，小幅击飞），能打倒地的敌人
defSkill('bm_double', { name: '双重锤击', cls: 'mage', job: BM, lvReq: 16, mp: 30, cd: 8, type: 'phys', col: '#8a5ab0',
  desc: '先把武器砸向前方，再跳起在空中转体砸下第二次，第二下带冲击波把敌人小幅击飞。共 3 段，能打到倒地的敌人。', pow: lv => skillDmg(4.2, 0.42, lv), ai: { kind: 'poke', r: [0, 130], dy: 30 },
  act: (lv) => ({ name: 'bm_double', clip: 'bmDouble', dur: 0.95, cancelFrom: 0.8, move: [[0.36, 0.62, 90, 380]], superArmor: [0.3, 0.7],
    hits: [HB(0.12, 0.2, [0, 115, 34, 0, 110], skillDmg(1.4, 0.14, lv), { stun: 0.5, knock: 60, hs: 0.07, snd: 'blunt', downHit: true, spike: 200 })],
    events: [evAt(0.1, e => sfx.swing(true)), evAt(0.14, e => fxShock(e.x + e.face * 70, e.y, 95, '#c0a0ff')),
      evAt(0.66, e => { e.vz = -900; }),
      evAt(0.72, e => { cam.shake = Math.max(cam.shake, 5); sfx.boom(0.7); fxShock(e.x + e.face * 70, e.y, 160, '#c080ff'); fxShock(e.x + e.face * 70, e.y, 110, '#e0c0ff');
        instantHit(e, { box: [-10, 140, 44, -20, 130], dmg: skillDmg(1.4, 0.14, lv), launch: 280, knock: 80, hs: 0.1, big: 1.4, downHit: true, snd: 'blunt' });
        blast(e, e.x + e.face * 70, e.y, 160, { dmg: skillDmg(1.4, 0.14, lv), launch: 240, knock: 100, hs: 0.06, downHit: true }, { zMax: 120 }); })],
    onLand: e => { e.vz = 0; } }) });
// 炫纹爆弹：横扫一刀并撒出炫纹碎片，被打中的敌人挂上定时炸弹：约 4 秒多段伤害后爆炸（只伤挂弹的目标）；继续攻击挂弹的敌人会缩短倒计时
defSummon('bm_timebomb', { kind: 'attach', host: 'target', life: 4, max: 20, over: 'deny', tick: 0.5,
  onTick(s, host) { summonHit(s, host, { dmg: s.dmg * 0.08, stun: 0.12, knock: 0, hs: 0.02, type: 'phys', col: CHASER_COL, sure: true, noChaser: true }); },
  onEnd(s, why) { const h = s.host; if (why !== 'life' || !h || h.dead) return; sfx.boom(0.6); fxBurst(h.x, h.y, h.z + 40, 130, CHASER_COL); summonHit(s, h, { dmg: s.dmg, launch: 300, knock: 60, hs: 0.1, big: 1.5, type: 'phys', col: CHASER_COL, sure: true, noChaser: true }); },
  draw(c, s) { const h = s.host; if (!h) return; const X = sx(h.x), Y = sy(h.y, h.z + h.h * (h.scale || 1) + 14), k = s.lifeT / s.life;
    drawSpr(c, fxTint('orb', CHASER_COL), X, Y, 14 + Math.sin(game.t * 12 * (1 + k * 2)) * 3, 0, {}); c.strokeStyle = '#ffe070'; c.lineWidth = 2; c.beginPath(); c.arc(X, Y, 10, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - k)); c.stroke(); } });
defSkill('bm_bomb', { name: '炫纹爆弹', cls: 'mage', job: BM, lvReq: 17, mp: 40, cd: 12, type: 'phys', col: '#5aa8e0',
  desc: '横扫一刀并撒出炫纹碎片，给命中的敌人挂上定时炸弹：约 4 秒内持续造成伤害，然后爆炸（只伤害挂弹的敌人）。之后每次攻击挂弹的敌人，都会缩短多段间隔和倒计时。', pow: lv => skillDmg(5.0, 0.5, lv), ai: { kind: 'poke', r: [0, 140], dy: 36 },
  act: (lv) => ({ name: 'bm_bomb', clip: 'bmSweep', dur: 0.55, cancelFrom: 0.4,
    hits: [HB(0.12, 0.2, [-10, 145, 44, 0, 120], skillDmg(1.2, 0.12, lv), { stun: 0.4, knock: 80, hs: 0.06, snd: 'slash',
      onHit: (a, t) => { const s = summon(a, 'bm_timebomb', { target: t }); if (s) s.dmg = skillDmg(3.2, 0.32, lv); } })],
    events: [slashAt(0.11, { a0: -1.3, a1: 1.1, r: 86, w: 16, off: [24, 55], col: '#9ad0ff' }), evAt(0.13, e => { for (let i = 0; i < 8; i++) fxSpr('spark', e.x + e.face * rnd(30, 145), e.y + rnd(-30, 30), rnd(30, 90), { w: 20, dur: 0.3, col: CHASER_COL }); })] }) });
// 碎霸：一次大幅横扫（Y 轴也宽），把敌人小幅击飞；命中后可以接体术技能
defSkill('bm_smash', { name: '碎霸', cls: 'mage', job: BM, lvReq: 18, mp: 40, cd: 8, type: 'phys', col: '#8a4ab0',
  desc: '大幅度横扫武器，范围很大（纵深也宽），把敌人小幅击飞。命中后可以取消后摇接体术技能。学会太古之力后，身上有炫纹时消耗 1 个，挥出更大的魔法轨迹（范围 +35%）。', pow: lv => skillDmg(4.6, 0.46, lv), ai: { kind: 'aoe', r: [0, 190], dy: 60 },
  act: (lv, p) => { const anc = !!(p && hasSkill(p, 'bm_ancient') && liveChasers(p).length), R = anc ? 1.35 : 1;
    return { name: 'bm_smash', clip: 'bmSweep', dur: 0.62, cancelFrom: 0.45, superArmor: [0.06, 0.3], links: BM_BODY, hitCancel: true,
      onStart: e => { if (anc && liveChasers(e).length) e.chasers.shift(); },
      hits: [HB(0.14, 0.22, [-40, 195 * R, 66 * R, 0, 140 * R], skillDmg(4.6, 0.46, lv), { launch: 300, knock: 140, hs: 0.1, big: 1.5, shake: 3, snd: 'blunt' })],
      events: [slashAt(0.13, { a0: -1.4, a1: 1.2, r: 112, w: 24, off: [28, 55], col: '#d0a0ff', heavy: true }),
        ...(anc ? [evAt(0.14, e => { const col = chCol(e); fxSlash({ x: e.x, y: e.y, z: e.z, face: e.face, col, a0: -1.5, a1: 1.3, r: 112 * R + 30, w: 34, off: [30, 60], dur: 0.3 }); fxShock(e.x + e.face * 120, e.y, 210, col); })] : [])] }; } });
// 超级炫纹：把 2～9 个炫纹融合成大球（不足 2 个自动补足），射向最后命中的敌人，爆炸并击倒；其他动作中也能放
defSkill('bm_super', { name: '超级炫纹', cls: 'mage', job: BM, lvReq: 18, mp: 40, cd: 8, type: 'phys', col: '#6ab8ff', noForce: true,
  desc: '把 2～9 个炫纹融合成一个大球，射向最后被普攻或技能打中的敌人，命中后范围爆炸并击倒敌人。炫纹不足 2 个时自动补足；超过 2 个的每一个都会增加伤害。其他动作中也能施放。', pow: lv => skillDmg(3.0, 0.3, lv), ai: { kind: 'aoe', r: [0, 500], dy: 60 },
  instant: (lv, p) => { superChaser(p, lv); return true; },
  act: (lv) => ({ name: 'bm_super', clip: 'bmCall', dur: 0.3, noCounter: true, onStart: e => superChaser(e, lv) }) });
function superChaser(p, lv) {
  p.chasers = (p.chasers || []).filter(c => game.t - c < CHASER_LIFE);
  const n = clamp(p.chasers.length, 2, 9); p.chasers.splice(0, Math.min(p.chasers.length, 9));
  let t = chaserTarget(p) || nearestFoe(p, 800);
  if (hasSkill(p, 'bm_ancient')) { const st = strongestFoe(p, 800), rank = o => o ? (o.boss ? 2 : o.elite ? 1 : 0) * 1e9 + o.hp : -1; if (st && rank(st) > rank(t)) t = st; }   // 太古之力：自动锁定最强的敌人（一样强时照常打最后命中的）
  const hand = { x: p.x + p.face * BM_HAND.x, z: p.z + BM_HAND.z };
  fireChaser(p, t, { big: 2.0 + n * 0.14, dmg: skillDmg(1.0, 0.1, lv), burst: 100 + n * 8, burstDmg: skillDmg(2.0, 0.2, lv) * (1 + (n - 2) * 0.15), noBuff: true, from: hand });
  fxAura(p, chCol(p), 0.4);
}
// 流星闪影击：原地连刺 20 次（霸体），然后大范围横扫打飞；连刺时按 Z 直接出终结，按跳跃取消；期间自动射出炫纹
defSkill('bm_flash', { name: '流星闪影击', cls: 'mage', job: BM, lvReq: 19, mp: 55, cd: 20, type: 'phys', col: '#e0c040',
  desc: '霸体原地连续直刺 20 次，然后大范围横扫把敌人打飞。连刺时再按技能键或 Z 直接出终结，按跳跃取消。释放期间按住炫纹键（技能栏的炫纹键或 Space）会自动连发炫纹。', pow: lv => skillDmg(7.0, 0.7, lv), ai: { kind: 'burst', r: [0, 140], dy: 30 },
  act: (lv) => ({ name: 'bm_flash', clip: 'fangRush', dur: 1.25, superArmor: true, noCounter: true, links: BM_BODY, linkFrom: 1.05,
    hits: [HB(0.04, 0.9, [0, 140, 32, 30, 95], skillDmg(0.24, 0.024, lv), { rep: 0.045, max: 20, stun: 0.3, knock: 0, hs: 0.02, snd: 'stab' }),
      HB(0.98, 1.06, [-40, 210, 72, 0, 140], skillDmg(2.2, 0.22, lv), { launch: 460, knock: 220, hs: 0.1, big: 1.5, shake: 3, snd: 'blunt' })],
    // 连刺中：再按技能键 / Z = 立即终结，跳跃 = 取消；其他按键照常（炫纹 / 超级炫纹是无动作施放，可以穿插）
    onInput: (e, I) => { const a = e.act; if (e.actT >= 0.9 || a.fin) return false; const slot = barOf(e).indexOf('bm_flash'), sk = slot >= 0 ? 's' + slot : null;
      if (I.buffered('cmd') || (sk && I.buffered(sk))) { I.consume('cmd'); if (sk) I.consume(sk); e.actT = 0.92; return true; }
      if (I.buffered('jump')) { I.consume('jump'); a.dur = e.actT; return true; } return false; },
    update: e => { const a = e.act; if (e.actT < 0.9 && Math.floor(e.actT / 0.06) !== a.k) { a.k = Math.floor(e.actT / 0.06); fxStreak({ x: e.x + e.face * 14, y: e.y + rnd(-5, 5), z: e.z + rnd(45, 70), face: e.face, len: rnd(100, 140), w: 8, col: '#ffe090', dur: 0.1 }); if (a.k % 2) sfx.swing(false); }
      if (e.actT < 0.9) chaserAuto(e, 0.2);
      if (e.actT >= 0.92 && !a.fin) { a.fin = true; e.play('bmSweep', true); sfx.swing(true); fxSlashOn(e, { col: '#ffe090', a0: -1.4, a1: 1.2, r: 125, w: 26, off: [28, 55] }); fxShock(e.x + e.face * 110, e.y, 180, '#ffe090'); } } }) });
// 炫纹强压：跳起把身上所有炫纹聚到武器前端，砸向前方地面爆炸；每消耗 1 个炫纹范围 +4%；没有炫纹时先生成 1 个
// 炫纹聚拢：n 个炫纹从身边绕到武器前端（tip，相对人物），合成一个光球；dur 后半段光球落到 to（相对人物、地面）
function bmGatherFx(e, n, dur, tip, to, col0) {
  const col = col0 || chCol(e), img = fxTint('orb', col);
  addFx({ ent: e, x: e.x, y: e.y, dur, update() { const p = this.ent; this.x = p.x; this.y = p.y + 0.3; if (p.dead || p.st !== 'act') this.t = this.dur; },
    draw(c) { const p = this.ent, k = this.t / this.dur, g = clamp(k / 0.6, 0, 1), f = to ? clamp((k - 0.8) / 0.2, 0, 1) : 0, tx = p.x + p.face * (tip.x + ((to ? to.x : tip.x) - tip.x) * f), tz = p.z + tip.z + ((to ? to.z : tip.z) - tip.z - p.z) * f;
      c.save(); c.globalCompositeOperation = 'lighter';
      for (let i = 0; i < n && g < 1; i++) { const a = game.t * 3 + i * TAU / n, ox = p.x + Math.cos(a) * 28, oz = p.z + 78 + Math.sin(a * 2) * 6; drawSpr(c, img, sx(ox + (tx - ox) * g), sy(this.y, oz + (tz - oz) * g), 14, 14, {}); }
      const R = (10 + n * 4) * (0.4 + 0.6 * g); drawSpr(c, img, sx(tx), sy(this.y, tz), R * 2, R * 2, { rot: game.t * 5 }); drawSpr(c, 'chaser', sx(tx), sy(this.y, tz), R * 1.3, R * 1.3, { rot: -game.t * 6 }); c.restore(); } });
}
defSkill('bm_press', { name: '炫纹强压', cls: 'mage', job: BM, lvReq: 19, mp: 45, cd: 17, type: 'phys', col: '#d0a030',
  desc: '跳起把身上所有炫纹聚到武器前端，砸向前方地面引发爆炸。每消耗 1 个炫纹范围 +4%，伤害也提高；身上没有炫纹时会先生成 1 个。', pow: lv => skillDmg(6.0, 0.6, lv), ai: { kind: 'aoe', r: [40, 260], dy: 70 },
  act: (lv) => ({ name: 'bm_press', clip: 'bmDouble', dur: 0.8, superArmor: true, noCounter: true, cancelFrom: 0.66, move: [[0.05, 0.22, 110, 300]],
    onStart: e => { e.act.n = Math.max(1, liveChasers(e).length); e.chasers.length = 0; bmGatherFx(e, e.act.n, 0.5, { x: 46, z: 118 }, { x: 100, z: 0 }); },
    update: e => { const a = e.act; if (e.actT < 0.45 && Math.random() < 0.8) fxCharge(e, CHASER_COL); },
    events: [evAt(0.45, e => { e.vz = -900; }),
      evAt(0.52, e => { const a = e.act, n = a.n, r = 150 * (1 + 0.04 * n), x = e.x + e.face * 100; cam.shake = Math.max(cam.shake, 6); sfx.boom(0.9);
        fxBurst(x, e.y, 20, 260 * (1 + 0.04 * n), CHASER_COL); fxShock(x, e.y, r * 1.1, CHASER_COL); fxShock(x, e.y, r * 0.7, '#ffffff');
        blast(e, x, e.y, r, { dmg: skillDmg(6.0, 0.6, lv) * (0.8 + 0.05 * n), launch: 360, knock: 100, hs: 0.12, big: 1.8, type: 'phys', col: CHASER_COL, downHit: true, noChaser: true }, { zMax: 220 }); })],
    onLand: e => { e.vz = 0; } }) });
// 强袭流星打：蓄力（最长 0.4 秒）后高速突进把敌人打上高空，然后退回原位（退回过程无敌）；蓄得越久冲得越远
defSkill('bm_raid', { name: '强袭流星打', cls: 'mage', job: BM, lvReq: 19, mp: 60, cd: 25, type: 'phys', col: '#e08a2a',
  desc: '蓄力（按住技能键最长 0.4 秒）后化作流星向前高速突进，把路径上的敌人打上高空，然后退回原位，退回过程无敌。蓄得越久冲得越远、范围越大。', pow: lv => skillDmg(7.0, 0.7, lv), ai: { kind: 'gap', r: [0, 280], dy: 24 },
  act: (lv, p) => ({ name: 'bm_raid', clip: 'fang', dur: 1.2, superArmor: true, noCounter: true,
    charge: { at: 0.06, max: hasSkill(p, 'bm_weapon') ? 0.2 : 0.4, min: 0, dmg: game.pvp ? 0.4 : 0, clip: 'charge', update: e => { if (Math.random() < 0.5) fxCharge(e, '#ffb060'); } },
    onStart: e => { e.act.x0 = e.x; },
    update: e => { const a = e.act; if (a.charging || !a.chargeDone) return; if (!a.go) { a.go = e.actT; e.play('raid', true); sfx.iai(); fxAfterimage(e, '#ffb060'); const k = a.chargeK || 0, h = a.hits && a.hits[0]; if (h) h.box = [-20, 100 + 50 * k, 40 + 16 * k, 0, 120 + 30 * k]; }   // 蓄得越久范围越大
      const k = e.actT - a.go; if (k < 0.3) { e.vx = e.face * (700 + (a.chargeK || 0) * 350); if (Math.random() < 0.7) fxStreak({ x: e.x - e.face * 30, y: e.y, z: e.z + 55, face: e.face, len: 150, w: 22, col: '#ffb060', dur: 0.15 }); }
      else if (!a.back) { a.back = true; e.invul = Math.max(e.invul, 0.6); e.vx = (a.x0 - e.x) / (760 / GRAV); e.vz = 380; e.z = Math.max(e.z, 1); e.play('bmLeap', true); } },
    hits: [HB(0.1, 0.5, [-20, 100, 40, 0, 120], skillDmg(7.0, 0.7, lv), { launch: 520, knock: 120, hs: 0.1, big: 1.6, shake: 4 })],
    onLand: e => { if (e.act.back) { e.vx = 0; e.endAct(); } } }) });
// 煌龙偃月：召唤巨型金色偃月刀向前连续突刺，强制把敌人推到刀尖（霸体、不可抓取的也推得动，固定型除外）；刺到敌人时刀尖周围生成 7 颗龙之炫纹依次爆炸，最后一次大爆炸
// 煌龙乱舞（官方 45 级 → 本作 20 级，可选的形态被动）：学会后煌龙偃月改为挥舞偃月刀连续横扫 6 次，没有抓取 / 推到刀尖；
//   连按 X 挥得更快（动作整体加速），按住 → 边走边打；最后一扫把敌人打飞。期间照样按住炫纹键自动连发炫纹
defSkill('bm_dragondance', { name: '煌龙乱舞', cls: 'mage', job: BM, lvReq: 20, maxLv: 1, passive: true, type: 'phys', col: '#f0a830', pre: { bm_dragon: 1 },
  desc: '【被动 · 改变形态】学会后，煌龙偃月改为：召唤巨大的金色偃月刀，连续横扫 6 次，最后一扫把敌人打飞；不再把敌人推到刀尖。释放中连按 X 挥得更快，按住 → 可以边走边打。（不想要这个形态就不学）' });
const BM_DANCE_T = [0.1, 0.3, 0.5, 0.7, 0.9, 1.12];
function bmDragonDance(lv) {
  const sw = i => { const last = i === 5; return HB(BM_DANCE_T[i], BM_DANCE_T[i] + 0.08, [-50, 200, 64, 0, 150], skillDmg(last ? 3.6 : 1.9, last ? 0.36 : 0.19, lv),
    last ? { launch: 460, knock: 220, hs: 0.12, big: 1.8, shake: 5, snd: 'blunt' } : { stun: 0.45, knock: 50, hs: 0.05, big: 1.2, shake: 1.5, snd: 'blunt' }); };
  return { name: 'bm_dragon', clip: 'bmSweep', dur: 1.5, superArmor: true, noCounter: true, dance: true,
    hits: [0, 1, 2, 3, 4, 5].map(sw),
    onInput: (e, I) => { const a = e.act; if (I.buffered('attack')) { I.consume('attack'); a.fastT = 0.3; } a.fwd = isHuman(e) ? I.dx() === e.face : false; return false; },
    update: (e, dt) => { const a = e.act; a.fastT = Math.max(0, (a.fastT || 0) - dt); a.spd0 ??= a.spd; a.spd = a.spd0 * (a.fastT > 0 ? 1.6 : 1);
      e.vx = a.fwd && e.actT < 1.2 ? e.face * 150 : 0;
      if (e.actT < 1.3) chaserAuto(e, 0.2); },
    events: BM_DANCE_T.map((t, i) => evAt(t - 0.03, e => { const up = i % 2 === 0, last = i === 5;
      e.play(up ? 'bmSweep' : 'bmSpin', true); sfx.swing(true); if (last) { cam.shake = Math.max(cam.shake, 5); sfx.boom(0.6); }
      fxSlashOn(e, { col: '#ffd060', a0: up ? -1.6 : 1.3, a1: up ? 1.3 : -1.6, r: last ? 175 : 145, w: last ? 38 : 30, off: [30, 62], dur: 0.2 });
      fxSpr('dragonfang', e.x + e.face * 100, e.y, e.z + 62, { w: last ? 330 : 260, dur: 0.22, flip: (e.face < 0) !== !up, rot: up ? -0.5 : 0.5, grow: [0.8, 1.1] });
      if (last) { fxBurst(e.x + e.face * 130, e.y, e.z + 60, 260, '#ffd070'); fxShock(e.x + e.face * 130, e.y, 220, '#ffd070'); } })) };
}
defSkill('bm_dragon', { name: '煌龙偃月', cls: 'mage', job: BM, lvReq: 20, mp: 80, cd: 45, type: 'phys', col: '#f0c030',
  desc: '召唤一把巨大的金色偃月刀向前连续突刺，把敌人强制推到刀尖（霸体和无法抓取的敌人也推得动，固定型的除外）。刺中敌人时刀尖周围生成 7 颗龙之炫纹依次爆炸，最后一次大爆炸。全程霸体；期间按住炫纹键会自动连发炫纹。', pow: lv => skillDmg(11, 1.1, lv), ai: { kind: 'burst', r: [0, 190], dy: 36 },
  act: (lv, p) => p && hasSkill(p, 'bm_dragondance') ? bmDragonDance(lv) : ({ name: 'bm_dragon', clip: 'fangRush', dur: 1.6, superArmor: true, noCounter: true, move: [[0.05, 0.75, 160]],
    hits: [HB(0.05, 0.75, [0, 175, 42, 10, 120], skillDmg(0.5, 0.05, lv), { rep: 0.09, stun: 0.4, knock: 0, hs: 0.02, snd: 'stab', onHit: (a, t) => { if (!t.fixed && !t.def_?.fixed) t.x = a.x + a.face * 160; if (a.act) a.act.stuck = true; } })],
    update: e => { const a = e.act; if (e.actT < 0.75 && Math.random() < 0.3) fxSpr('dragonfang', e.x + e.face * 100, e.y, e.z + 60, { w: 290, dur: 0.12, flip: e.face < 0 }); if (e.actT < 1.35) chaserAuto(e, 0.2); },
    events: [evAt(0.8, e => { const a = e.act; e.play('fang', true); const x = e.x + e.face * 165; cam.flash = 0.12; cam.flashCol = '#fff0b0'; sfx.iai();
      fxSpr('dragonfang', e.x + e.face * 90, e.y, e.z + 60, { w: 330, dur: 0.6, flip: e.face < 0, grow: [0.6, 1.2] });
      if (!a.stuck) return;
      for (let i = 0; i < 7; i++) game.after(0.07 * i, () => { const bx = x + rnd(-70, 70), by = clamp(e.y + rnd(-40, 40), 6, DEPTH - 6); fxBurst(bx, by, rnd(30, 90), 130, '#ffd070'); sfx.boom(0.3);
        blast(e, bx, by, 80, { dmg: skillDmg(0.8, 0.08, lv), stun: 0.3, knock: 20, hs: 0.04, col: '#ffe070', noChaser: true }, { zMax: 200 }); });
      game.after(0.55, () => { cam.shake = 9; sfx.boom(1.1); fxBurst(x, e.y, 60, 360, '#ffd070'); fxShock(x, e.y, 200, '#ffd070'); fxShock(x, e.y, 140, '#fff6d0');
        blast(e, x, e.y, 200, { dmg: skillDmg(4.5, 0.45, lv), launch: 520, knock: 200, hs: 0.14, big: 1.9, col: '#ffe070', downHit: true, noChaser: true }, { zMax: 220 }); }); })] }) });
// 星纹陨爆（觉醒）：短暂变身贝亚娜，把力量压缩成一颗巨大的“类星体”炫纹引爆，大范围伤害；施放后短暂无敌
// 星纹陨爆（一觉）：变身贝亚娜（金色光环）→ 举手把力量压缩成“类星体”炫纹（0.95～1.35 秒长大）→ 推到前方（～1.6 秒）→
//   类星体原地收缩、持续脉冲 6 段（判定持续久）→ 2.2 秒引爆，大范围伤害；施放过程和之后 1 秒无敌
defSkill('bm_awaken', { name: '星纹陨爆', cls: 'mage', job: BM, lvReq: 21, maxLv: 3, mp: 150, cd: 135, pvp: 0.45, type: 'phys', awaken: true, col: '#ffd23a',
  desc: '【觉醒】短暂变身为贝亚娜斗神，把力量压缩成一颗巨大的“类星体”炫纹推向前方；类星体不断收缩、持续冲击周围的敌人，最后引爆，大范围伤害。施放过程和之后 1 秒无敌。', pow: lv => skillDmg(40, 10, lv), ai: { kind: 'awaken', r: [0, 560], dy: 140 },
  act: (lv) => ({ name: 'bm_awaken', clip: 'bmAwk', dur: 2.5, superArmor: true, noCounter: true, invul: true,
    onStart: e => { game.cutin = { t: 0, dur: 1.0, name: '星纹陨爆', who: cutinWho(e) }; game.timeStop = 0.9; sfx.awaken(); const R = game.room, x = e.x + e.face * 220; e.act.cx = R ? clamp(x, R.x0 + 60, R.x1 - 60) : x; e.act.cy = e.y; e.drawOpts = { glow: 0.4 };
      bmAuraFx(e, '#ffd23a', 2.5); fxAfterimage(e, '#ffe070'); },
    update: e => { const a = e.act; if (e.actT < 0.95 || e.actT >= 2.2) return; if (!a.call) { a.call = true; e.play('bmCall', true); }
      const hx = e.x + e.face * BM_HAND.x, hz = e.z + BM_HAND.z + 20, g = clamp((e.actT - 0.95) / 0.4, 0, 1), m = clamp((e.actT - 1.35) / 0.25, 0, 1), q = clamp((e.actT - 1.6) / 0.6, 0, 1);
      const x = hx + (a.cx - hx) * m, z = hz + (110 - hz) * m, sz = (30 + g * 130 + m * 150) * (1 - 0.55 * q) * (q > 0 ? 1 + Math.sin(game.t * 40) * 0.05 : 1);
      addFx({ x, y: a.cy, z: 0, dur: 0.02, zz: z, sz, q, draw(c) { const X = sx(this.x), Y = sy(this.y, this.zz); drawSpr(c, fxTint('orb', '#fff0a0'), X, Y, this.sz, this.sz, { rot: game.t * 3 });
        drawSpr(c, 'chaser', X, Y, this.sz * 0.7, this.sz * 0.7, { rot: -game.t * 4 }); if (this.q > 0) { c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.35 + this.q * 0.4; drawSpr(c, fxTint('orb', '#ffffff'), X, Y, this.sz * 0.5, this.sz * 0.5, {}); c.restore(); } } });
      if (e.actT < 1.6 && Math.random() < 0.6) fxCharge(e, '#ffe070'); },
    events: [evAt(1.6, e => { const a = e.act; cam.shake = 7; sfx.boom(0.9); fxShock(a.cx, a.cy, 400, '#ffd070'); }),
      ...Array.from({ length: 6 }, (_, i) => evAt(1.62 + i * 0.09, e => { const a = e.act; fxShock(a.cx, a.cy, 280 + i * 30, i % 2 ? CHASER_COL : '#ffe070'); cam.shake = Math.max(cam.shake, 3);
        blast(e, a.cx, a.cy, 380, { dmg: skillDmg(40, 10, lv) * 0.06, stun: 0.5, knock: 0, airLift: 40, hs: 0.03, sure: true, downHit: true, col: '#ffe070', noChaser: true }, { zMax: 260 }); })),
      evAt(2.2, e => { const a = e.act; cam.flash = 0.3; cam.flashCol = '#fff6d0'; cam.shake = 12; sfx.boom(1.4); fxBurst(a.cx, a.cy, 110, 600, '#ffe070'); fxShock(a.cx, a.cy, 480, '#ffd070'); fxShock(a.cx, a.cy, 340, CHASER_COL);
        blast(e, a.cx, a.cy, 480, { dmg: skillDmg(40, 10, lv) * 0.64, launch: 520, knock: 220, hs: 0.16, big: 2.2, sure: true, downHit: true, col: '#ffe070', noChaser: true }, { zMax: 260 }); e.invul = Math.max(e.invul, 1.0); })],
    onEnd: e => { e.drawOpts = {}; } }) });
CLASSES.mage.jobs.battlemage = { art: 'job/battlemage', name: '战斗法师', role: '近战 · 连击', armor: 'leather', awaken: 'bm_awaken', awakenName: '贝亚娜斗神',
  desc: '把魔力灌注进矛和棍、近身搏斗的魔法师。连招流畅；战斗中不断生成炫纹，命中敌人后把炫纹射出去追击。',
  skills: ['bm_combo', 'bm_shieldup', 'bm_niu', 'bm_realphase', 'bm_chaser', 'bm_round', 'bm_instinct', 'bm_weapon', 'bm_double', 'bm_bomb', 'bm_smash', 'bm_super', 'bm_flash', 'bm_press', 'bm_raid', 'bm_dragon', 'bm_dragondance', 'bm_will', 'bm_awaken'] };
CLASSES.mage.cmds.push(['f', 'bm_chaser', 'buff'], ['fd', 'bm_round'], ['ff', 'bm_instinct', 'buff'], ['dd', 'bm_double'], ['uu', 'bm_bomb'], ['bdf', 'bm_smash'], ['df', 'bm_super', 'buff'],
  ['fdf', 'bm_flash'], ['ud', 'bm_press'], ['bff', 'bm_raid'], ['uff', 'bm_dragon'], ['bfbf', 'bm_awaken']);
// ---- 尼巫的战术：战斗法师专属普攻（刺 → 上挑 → 大横扫），跑攻打空也不摔 ----
const BM_ACTS = { ...MAGE_ACTS,
  atk1: { name: 'atk1', clip: 'fang', dur: 0.34, basic: true, speed: 'aspd', chain: [0.13, 0.34], next: 'atk2', move: [[0.03, 0.1, 150]],
    hits: [HB(0.07, 0.12, [0, 106, 26, 30, 95], 0.85, { stun: 0.36, knock: 40, hs: 0.05, snd: 'stab', type: 'phys' })], events: [evAt(0.06, e => fxStreak({ x: e.x + e.face * 10, y: e.y, z: e.z + 58, face: e.face, len: 112, w: 9, col: '#dfe8ff', dur: 0.12 }))] },
  atk2: { name: 'atk2', clip: 'sky', dur: 0.38, basic: true, speed: 'aspd', chain: [0.15, 0.38], next: 'atk3', move: [[0.03, 0.08, 70]],
    hits: [HB(0.1, 0.16, [0, 90, 30, 0, 120], 0.9, { stun: 0.4, launch: 300, knock: 20, hs: 0.05, snd: 'blunt', type: 'phys' })], events: [slashAt(0.09, { a0: 1.4, a1: -1.9, r: 66, w: 10, off: [10, 50] })] },
  atk3: { name: 'atk3', clip: 'bmSweep', dur: 0.48, basic: true, speed: 'aspd', move: [[0.04, 0.12, 100]],
    hits: [HB(0.12, 0.2, [-10, 120, 40, 0, 120], 1.2, { stun: 0.45, knock: 220, heavy: true, hs: 0.07, snd: 'blunt', type: 'phys', last: true, shake: 1.5 })], events: [slashAt(0.11, { a0: -1.3, a1: 1.1, r: 80, w: 14, off: [24, 55], heavy: true })] },
};
// ---- 命中钩子：直接攻击命中生成炫纹（每个动作一次）、记下最后命中的目标；连击精通延长连击判定；炫纹爆弹缩短倒计时 ----
CLASSES.mage.onHit = (p, t, h, dmg, act) => {
  if (jobOf(p) !== BM) return;
  if (hasSkill(p, 'bm_combo') && isHuman(p)) game.comboT = Math.max(game.comboT, 1.9);
  if (!act || h.noChaser) return;
  p._lastHitTgt = t; p._lastHitT = game.t;
  if (!act._chG && !act.awaken) { act._chG = true; addChaser(p, 1); }
  for (const s of summonsOf(p, 'bm_timebomb')) if (s.host === t) { s.lifeT = Math.min(s.life - 0.05, s.lifeT + 0.15); s.tickT += 0.1; }   // 多段间隔和倒计时都缩短
};
// ---- 被动刷新（每 0.25 秒）----
CLASSES.mage.passives.push(p => {
  const bm = jobOf(p) === BM;
  if (bm && hasSkill(p, 'bm_niu')) { if (p.acts !== BM_ACTS) p.acts = BM_ACTS; } else if (p.acts === BM_ACTS) p.acts = MAGE_ACTS;
  if (!bm) return;
  const nl = skLv(p, 'bm_niu'); setPassive(p, 'bm_niu', nl > 0, { dmg: 0.1 + 0.01 * nl, crit: 0.1 + 0.005 * nl });
  const wl = skLv(p, 'bm_weapon'); setPassive(p, 'bm_weapon', wl > 0, { atk: 0.04 + 0.01 * wl, crit: 0.02 + 0.003 * wl });
  if (p.buffs.mg_shield && hasSkill(p, 'bm_shieldup')) p.buffs.mg_shield.taken = -(0.08 + 0.01 * skLv(p, 'mg_shield'));
  // 炫纹：每 7 秒自动生成 1 个；过期的清掉
  if (hasSkill(p, 'bm_chaser') && (game.scene === 'dungeon' || game.scene === 'test')) { p._chGen = (p._chGen || 0) + 0.25; if (p._chGen >= 7) { p._chGen = 0; addChaser(p, 1); } }
  if (p.chasers && p.chasers.length) { p.chasers = p.chasers.filter(c => game.t - c < CHASER_LIFE); chaserOrbit(p); }
  // 斗神意志：10 / 20 / 30 连击三段，连击断了约每 4 秒掉一段
  const wv = skLv(p, 'bm_will');
  if (wv > 0 && isHuman(p)) { const want = game.combo >= 30 ? 3 : game.combo >= 20 ? 2 : game.combo >= 10 ? 1 : 0; p._will = p._will || 0;
    if (want > p._will) { p._will = want; p._willT = 0; fxText(`斗神意志 ${want} 段`, p.x, p.y, p.z + 40, { col: '#ffd23a', size: 11, dur: 0.8 }); }
    else if (want < p._will) { p._willT = (p._willT || 0) + 0.25; if (p._willT >= 4) { p._will--; p._willT = 0; } }
    const s = p._will; setPassive(p, 'bm_will', true, { dmg: 0.06 + 0.01 * wv, aspd: 0.05 * s, mspd: 0.05 * s }); }
  if (p.buffs.bm_instinct && Math.random() < 0.5) fxSpr('spark', p.x + rnd(-14, 14), p.y + 1, p.z + rnd(20, 90), { w: 18, dur: 0.15, col: '#ff5a5a' });
});
// 魔法护盾强化：进入地下城时自动开启魔法护盾
bus.on('dungeonEnter', () => { const p = game.player; if (!p || jobOf(p) !== BM || !hasSkill(p, 'bm_shieldup') || !hasSkill(p, 'mg_shield') || p.buffs.mg_shield) return; const lv = skLv(p, 'mg_shield'); p.buffs.mg_shield = { t: 1e9, taken: -(0.08 + 0.01 * lv) }; });
// 斗神意志的回避：每段 6.6% 几率躲开攻击（抓取、必中攻击除外），用受击前钩子实现
CLASSES.mage.beforeHurt = (t, a, h) => {
  if (jobOf(t) !== BM || !t._will || h.sure || h.grab || h.throwHit || Math.random() >= 0.066 * t._will) return null;
  fxText('MISS', t.x, t.y, t.z, { col: '#d8d8d8', size: 12, dur: 0.5 }); return { block: true };
};
// 战斗法师武器精通：落花掌的满蓄时间减半（落花掌定义在 mage.js，这里包一层，只动蓄力上限）
{ const S = SKILLS.mg_palm, a0 = S && S.act;
  if (a0) S.act = (lv, p) => { const A = a0(lv, p); if (A && A.charge && p && jobOf(p) === BM && hasSkill(p, 'bm_weapon')) A.charge = { ...A.charge, max: Math.max(0.04, A.charge.max / 2) }; return A; }; }
