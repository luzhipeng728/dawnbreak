/* =====================================================================
   转职：战斗法师（魔法师）—— 按国服现版（2024-03-21 重做后）对齐（docs/SKILLS_OFFICIAL_mage.md 3.3）
   炫纹：每 7 秒自动生成 1 个、直接攻击命中时生成 1 个（每个动作一次），每个存在 30 秒，最多 9 个；
         命中敌人后按炫纹键（→+Space）把最早的一个射向最后命中的敌人（冷却 0.5 秒、800px 内），炫纹命中后 30 秒内攻击 / 攻速 / 移速 / 暴击提高
   尼巫的战术：普攻变成 刺 → 上挑 → 横扫；龙牙、碎霸命中后可以接体术技能（links）
   斗神意志：按连击数分 3 段（10 / 20 / 30 连击），每段提高攻速、移速、回避；连击断了约每 4 秒掉一段
   觉醒：星纹陨爆（贝亚娜斗神）
   ===================================================================== */
const BM = 'battlemage';
const CHASER_COL = '#8ac8ff', CHASER_LIFE = 30;
const BM_BODY = ['mg_sky', 'mg_palm', 'mg_fang', 'bm_round', 'bm_double', 'bm_bomb', 'bm_smash', 'bm_flash', 'bm_raid', 'bm_dragon'];   // 体术技能（尼巫的战术的衔接目标）
const chaserMax = p => 9;
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
    draw(c) { const e = this.ent, L = e.chasers || []; const n = L.length; if (!n) return; const img = fxTint('orb', CHASER_COL);
      for (let i = 0; i < n; i++) { const a = game.t * 2.6 + i * TAU / n, r = 24 + n * 1.5, x = e.x + Math.cos(a) * r, z = e.z + 78 + Math.sin(a * 2) * 5, y = e.y + Math.sin(a) * 6, fade = CHASER_LIFE - (game.t - L[i]) < 3 ? 0.4 + 0.3 * Math.sin(game.t * 20) : 1;
        drawSpr(c, 'chaser', sx(x), sy(y, z), 16, 16, { alpha: fade }); drawSpr(c, img, sx(x), sy(y, z), 12, 12, { alpha: fade }); } } });
}
// 射出一个（或融合后的一个大）炫纹，追向目标；命中后给自己挂炫纹增益
function fireChaser(p, t, o = {}) {
  const lv = Math.max(1, skLv(p, 'bm_chaser')), big = o.big || 1, img = fxTint('orb', CHASER_COL);
  const from = o.from || { x: p.x, z: p.z + 80 };
  const pr = spawnProj({ owner: p, x: from.x, y: p.y, z: from.z, vx: p.face * 200, vz: 160, face: p.face, life: 1.6, w: 10 * big, d: 12 * big, h: 14 * big, pierce: false,
    hit: { dmg: (o.dmg || skillDmg(0.9, 0.09, lv)), stun: 0.3, knock: 40, airLift: 150, hs: 0.04, type: 'phys', col: CHASER_COL, noChaser: true, ...(o.hit || {}) },
    update(q, dt) { const tt = t && !t.dead && !t.remove ? t : nearestFoe(p, 800); if (tt) { const dx = tt.x - q.x, dy = tt.y - q.y, dz = tt.z + tt.hurtH() * 0.5 - q.z, l = Math.hypot(dx, dy * 2, dz) || 1, sp = 560;
      q.vx = damp(q.vx, dx / l * sp, 9, dt); q.vy = damp(q.vy, dy / l * sp, 9, dt); q.vz = damp(q.vz, dz / l * sp, 9, dt); } if (Math.random() < 0.6) addFx({ x: q.x, y: q.y + 0.3, z: q.z, dur: 0.2, draw(c) { const k = this.t / this.dur; drawSpr(c, img, sx(this.x), sy(this.y, this.z), 12 * big * (1 - k), 0, { alpha: 0.6 * (1 - k) }); } }); },
    onHitT(q, tt) { if (!o.noBuff) chaserBuff(p); },
    onEnd(q) { fxBurst(q.x, q.y, q.z, 60 * big, CHASER_COL); if (o.burst) { sfx.boom(0.4 + big * 0.1); fxShock(q.x, q.y, o.burst * 1.2, CHASER_COL); blast(p, q.x, q.y, o.burst, { dmg: o.burstDmg || skillDmg(0.8, 0.08, lv), down: true, downLift: 160, knock: 90, hs: 0.07, type: 'phys', col: CHASER_COL, downHit: true, noChaser: true }, { zMax: 200 }); } },
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
  desc: '刺中前方一个敌人（抓取，能抓霸体和格挡中的敌人），举过头顶摔到身后，落地冲击波击倒周围敌人；抓住时按 → 改为摔到身前。摔的过程中无敌，并射出 2 个炫纹。抓不住的敌人只受到刺击伤害。', pow: lv => skillDmg(4.0, 0.4, lv), ai: { kind: 'grab', r: [0, 80], dy: 20 },
  act: (lv) => ({ name: 'bm_round', clip: 'bmThrow', dur: 0.95, noCounter: true, invul: [0.14, 0.7], superArmor: [0, 0.14],
    hits: [HB(0.06, 0.14, [0, 80, 24, 10, 110], skillDmg(0.8, 0.08, lv), { grab: true, stun: 0.4, hs: 0.05, snd: 'stab' })],
    onGrab: e => { e.act.fwd = false; },
    onInput: (e, I) => { if (e.grabbed && I.dx() === e.face) e.act.fwd = true; return false; },
    hold: (e, t) => { const k = clamp((e.actT - 0.14) / 0.42, 0, 1), a = Math.PI * k, dir = e.act.fwd ? 1 : -1; t.x = e.x + e.face * Math.cos(a) * 44 * (dir > 0 ? 1 : 1); t.y = e.y + 0.5; t.z = e.z + 30 + Math.sin(a) * 76; t.face = -e.face; },
    events: [evAt(0.3, e => { if (e.grabbed) { e.chasers && e.chasers.length && (e.chasers.shift(), fireChaser(e, e.grabbed)); } }),
      evAt(0.45, e => { if (e.grabbed) { e.chasers && e.chasers.length && (e.chasers.shift(), fireChaser(e, e.grabbed)); } }),
      evAt(0.58, e => { const g = e.grabbed; if (!g) { e.act.dur = Math.min(e.act.dur, 0.62); return; } const dir = e.act.fwd ? 1 : -1; sfx.swing(true);
        g.x = e.x + dir * e.face * 46; g.z = 30;
        throwGrab(e, { dmg: skillDmg(2.0, 0.2, lv), down: true, downLift: 120, knock: 60, bounce: 0.5, hs: 0.1, shake: 4, big: 1.5 });
        const x = e.x + dir * e.face * 40; fxShock(x, e.y, 150, '#b080ff'); cam.shake = Math.max(cam.shake, 5); sfx.boom(0.7);
        blast(e, x, e.y, 90, { dmg: skillDmg(1.2, 0.12, lv), down: true, knock: 120, hs: 0.06, downHit: true }); })] }) });
// 战斗本能：开关型增益，技能攻击力提高，身上出现红色电光
defSkill('bm_instinct', { name: '战斗本能', cls: 'mage', job: BM, lvReq: 16, mp: 30, cd: 5, type: 'phys', buff: true, col: '#e04a4a',
  desc: '【开关 BUFF】身上出现红色电光气场，技能攻击力提高。再按一次关闭。', infoExtra: lv => [['技能攻击力', '+' + pct(0.1 + 0.01 * lv)]], ai: { kind: 'buff' },
  act: (lv) => ({ name: 'bm_instinct', clip: 'cheer', dur: 0.4, noCounter: true, onStart: e => { if (toggleBuff(e, 'bm_instinct', 1e9, { dmg: 0.1 + 0.01 * lv })) { sfx.buff(); fxAura(e, '#ff5a5a'); } } }) });
// 双重锤击：先下砸一次，再跳起在空中转体下砸第二次（带冲击波，小幅击飞），能打倒地的敌人
defSkill('bm_double', { name: '双重锤击', cls: 'mage', job: BM, lvReq: 16, mp: 30, cd: 8, type: 'phys', col: '#8a5ab0',
  desc: '先把武器砸向前方，再跳起在空中转体砸下第二次，第二下带冲击波把敌人小幅击飞。共 3 段，能打到倒地的敌人。', pow: lv => skillDmg(4.2, 0.42, lv), ai: { kind: 'poke', r: [0, 100], dy: 24 },
  act: (lv) => ({ name: 'bm_double', clip: 'bmDouble', dur: 0.95, cancelFrom: 0.8, move: [[0.36, 0.62, 90, 380]], superArmor: [0.3, 0.7],
    hits: [HB(0.12, 0.2, [0, 90, 28, 0, 110], skillDmg(1.4, 0.14, lv), { stun: 0.5, knock: 60, hs: 0.07, snd: 'blunt', downHit: true, spike: 200 })],
    events: [evAt(0.1, e => sfx.swing(true)), evAt(0.14, e => fxShock(e.x + e.face * 60, e.y, 70, '#c0a0ff')),
      evAt(0.66, e => { e.vz = -900; }),
      evAt(0.72, e => { cam.shake = Math.max(cam.shake, 5); sfx.boom(0.7); fxShock(e.x + e.face * 60, e.y, 170, '#c080ff');
        instantHit(e, { box: [-10, 110, 36, -20, 130], dmg: skillDmg(1.4, 0.14, lv), launch: 280, knock: 80, hs: 0.1, big: 1.4, downHit: true, snd: 'blunt' });
        blast(e, e.x + e.face * 60, e.y, 110, { dmg: skillDmg(1.4, 0.14, lv), launch: 240, knock: 100, hs: 0.06, downHit: true }, { zMax: 120 }); })],
    onLand: e => { e.vz = 0; } }) });
// 炫纹爆弹：横扫一刀并撒出炫纹碎片，被打中的敌人挂上定时炸弹：约 4 秒多段伤害后爆炸（只伤挂弹的目标）；继续攻击挂弹的敌人会缩短倒计时
defSummon('bm_timebomb', { kind: 'attach', host: 'target', life: 4, max: 20, over: 'deny', tick: 0.5,
  onTick(s, host) { summonHit(s, host, { dmg: s.dmg * 0.08, stun: 0.12, knock: 0, hs: 0.02, type: 'phys', col: CHASER_COL, sure: true, noChaser: true }); },
  onEnd(s, why) { const h = s.host; if (why !== 'life' || !h || h.dead) return; sfx.boom(0.6); fxBurst(h.x, h.y, h.z + 40, 130, CHASER_COL); summonHit(s, h, { dmg: s.dmg, launch: 300, knock: 60, hs: 0.1, big: 1.5, type: 'phys', col: CHASER_COL, sure: true, noChaser: true }); },
  draw(c, s) { const h = s.host; if (!h) return; const X = sx(h.x), Y = sy(h.y, h.z + h.h * (h.scale || 1) + 14), k = s.lifeT / s.life;
    drawSpr(c, fxTint('orb', CHASER_COL), X, Y, 14 + Math.sin(game.t * 12 * (1 + k * 2)) * 3, 0, {}); c.strokeStyle = '#ffe070'; c.lineWidth = 2; c.beginPath(); c.arc(X, Y, 10, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - k)); c.stroke(); } });
defSkill('bm_bomb', { name: '炫纹爆弹', cls: 'mage', job: BM, lvReq: 17, mp: 40, cd: 12, type: 'phys', col: '#5aa8e0',
  desc: '横扫一刀并撒出炫纹碎片，给命中的敌人挂上定时炸弹：约 4 秒内持续造成伤害，然后爆炸（只伤害挂弹的敌人）。之后每次攻击挂弹的敌人，都会缩短倒计时。', pow: lv => skillDmg(5.0, 0.5, lv), ai: { kind: 'poke', r: [0, 110], dy: 30 },
  act: (lv) => ({ name: 'bm_bomb', clip: 'bmSweep', dur: 0.55, cancelFrom: 0.4,
    hits: [HB(0.12, 0.2, [-10, 110, 36, 0, 120], skillDmg(1.2, 0.12, lv), { stun: 0.4, knock: 80, hs: 0.06, snd: 'slash',
      onHit: (a, t) => { const s = summon(a, 'bm_timebomb', { target: t }); if (s) s.dmg = skillDmg(3.2, 0.32, lv); } })],
    events: [slashAt(0.11, { a0: -1.3, a1: 1.1, r: 66, w: 14, off: [24, 55], col: '#9ad0ff' }), evAt(0.13, e => { for (let i = 0; i < 6; i++) fxSpr('spark', e.x + e.face * rnd(30, 110), e.y + rnd(-20, 20), rnd(30, 90), { w: 20, dur: 0.3, col: CHASER_COL }); })] }) });
// 碎霸：一次大幅横扫（Y 轴也宽），把敌人小幅击飞；命中后可以接体术技能
defSkill('bm_smash', { name: '碎霸', cls: 'mage', job: BM, lvReq: 18, mp: 40, cd: 8, type: 'phys', col: '#8a4ab0',
  desc: '大幅度横扫武器，范围很大（纵深也宽），把敌人小幅击飞。命中后可以取消后摇接体术技能。', pow: lv => skillDmg(4.6, 0.46, lv), ai: { kind: 'aoe', r: [0, 130], dy: 44 },
  act: (lv) => ({ name: 'bm_smash', clip: 'bmSweep', dur: 0.62, cancelFrom: 0.45, superArmor: [0.06, 0.3], links: BM_BODY, hitCancel: true,
    hits: [HB(0.14, 0.22, [-30, 135, 48, 0, 140], skillDmg(4.6, 0.46, lv), { launch: 300, knock: 140, hs: 0.1, big: 1.5, shake: 3, snd: 'blunt' })],
    events: [slashAt(0.13, { a0: -1.4, a1: 1.2, r: 80, w: 20, off: [28, 55], col: '#d0a0ff', heavy: true })] }) });
// 超级炫纹：把 2～9 个炫纹融合成大球（不足 2 个自动补足），射向最后命中的敌人，爆炸并击倒；其他动作中也能放
defSkill('bm_super', { name: '超级炫纹', cls: 'mage', job: BM, lvReq: 18, mp: 40, cd: 8, type: 'phys', col: '#6ab8ff', noForce: true,
  desc: '把 2～9 个炫纹融合成一个大球，射向最后被普攻或技能打中的敌人，命中后范围爆炸并击倒敌人。炫纹不足 2 个时自动补足；超过 2 个的每一个都会增加伤害。其他动作中也能施放。', pow: lv => skillDmg(3.0, 0.3, lv), ai: { kind: 'aoe', r: [0, 500], dy: 60 },
  instant: (lv, p) => { superChaser(p, lv); return true; },
  act: (lv) => ({ name: 'bm_super', clip: 'bmCall', dur: 0.3, noCounter: true, onStart: e => superChaser(e, lv) }) });
function superChaser(p, lv) {
  p.chasers = (p.chasers || []).filter(c => game.t - c < CHASER_LIFE);
  const n = clamp(p.chasers.length, 2, 9); p.chasers.splice(0, Math.min(p.chasers.length, 9));
  const t = chaserTarget(p) || nearestFoe(p, 800);
  const hand = { x: p.x + p.face * BM_HAND.x, z: p.z + BM_HAND.z };
  fireChaser(p, t, { big: 1.8 + n * 0.12, dmg: skillDmg(1.0, 0.1, lv), burst: 70 + n * 6, burstDmg: skillDmg(2.0, 0.2, lv) * (1 + (n - 2) * 0.15), noBuff: true, from: hand });
  fxAura(p, CHASER_COL, 0.4);
}
// 流星闪影击：原地连刺 20 次（霸体），然后大范围横扫打飞；连刺时按 Z 直接出终结，按跳跃取消；期间自动射出炫纹
defSkill('bm_flash', { name: '流星闪影击', cls: 'mage', job: BM, lvReq: 19, mp: 55, cd: 20, type: 'phys', col: '#e0c040',
  desc: '霸体原地连续直刺 20 次，然后大范围横扫把敌人打飞。连刺时按 Z 直接出终结，按跳跃取消。释放期间自动把炫纹射向前方的敌人。', pow: lv => skillDmg(7.0, 0.7, lv), ai: { kind: 'burst', r: [0, 110], dy: 24 },
  act: (lv) => ({ name: 'bm_flash', clip: 'fangRush', dur: 1.25, superArmor: true, noCounter: true, links: BM_BODY, linkFrom: 1.05,
    hits: [HB(0.04, 0.9, [0, 104, 26, 30, 95], skillDmg(0.24, 0.024, lv), { rep: 0.045, max: 20, stun: 0.3, knock: 0, hs: 0.02, snd: 'stab' }),
      HB(0.98, 1.06, [-10, 130, 44, 0, 130], skillDmg(2.2, 0.22, lv), { launch: 460, knock: 220, hs: 0.1, big: 1.5, shake: 3, snd: 'blunt' })],
    onInput: (e, I) => { const a = e.act; if (e.actT < 0.9) { if (I.buffered('cmd')) { I.consume('cmd'); e.actT = Math.max(e.actT, 0.92); } else if (I.buffered('jump')) { I.consume('jump'); a.dur = e.actT; } } return true; },
    update: e => { const a = e.act; if (e.actT < 0.9 && Math.floor(e.actT / 0.06) !== a.k) { a.k = Math.floor(e.actT / 0.06); fxStreak({ x: e.x + e.face * 14, y: e.y + rnd(-5, 5), z: e.z + rnd(45, 70), face: e.face, len: rnd(70, 100), w: 7, col: '#ffe090', dur: 0.1 }); if (a.k % 2) sfx.swing(false); }
      if (e.actT < 0.9 && game.t - (a.chT || -9) > 0.35 && e.chasers && e.chasers.length) { const t = nearestFoe(e, 400, o => (o.x - e.x) * e.face > 0); if (t) { a.chT = game.t; e.chasers.shift(); fireChaser(e, t); } }
      if (e.actT >= 0.92 && !a.fin) { a.fin = true; e.play('bmSweep', true); sfx.swing(true); fxSlashOn(e, { col: '#ffe090', a0: -1.4, a1: 1.2, r: 84, w: 20, off: [28, 55] }); } } }) });
// 炫纹强压：跳起把身上所有炫纹聚到武器前端，砸向前方地面爆炸；每消耗 1 个炫纹范围 +4%；没有炫纹时先生成 1 个
defSkill('bm_press', { name: '炫纹强压', cls: 'mage', job: BM, lvReq: 19, mp: 45, cd: 17, type: 'phys', col: '#d0a030',
  desc: '跳起把身上所有炫纹聚到武器前端，砸向前方地面引发爆炸。每消耗 1 个炫纹范围 +4%，伤害也提高；身上没有炫纹时会先生成 1 个。', pow: lv => skillDmg(6.0, 0.6, lv), ai: { kind: 'aoe', r: [40, 220], dy: 50 },
  act: (lv) => ({ name: 'bm_press', clip: 'bmDouble', dur: 0.8, superArmor: true, noCounter: true, cancelFrom: 0.66, move: [[0.05, 0.22, 110, 300]],
    onStart: e => { e.chasers = (e.chasers || []).filter(c => game.t - c < CHASER_LIFE); e.act.n = Math.max(1, e.chasers.length); e.chasers.length = 0; },
    update: e => { const a = e.act; if (e.actT < 0.45 && Math.random() < 0.8) fxCharge(e, CHASER_COL); },
    events: [evAt(0.45, e => { e.vz = -900; }),
      evAt(0.52, e => { const a = e.act, n = a.n, r = 90 * (1 + 0.04 * n), x = e.x + e.face * 80; cam.shake = Math.max(cam.shake, 6); sfx.boom(0.9);
        fxBurst(x, e.y, 20, 180 * (1 + 0.04 * n), CHASER_COL); fxShock(x, e.y, r * 1.6, CHASER_COL);
        blast(e, x, e.y, r, { dmg: skillDmg(6.0, 0.6, lv) * (0.8 + 0.05 * n), launch: 360, knock: 100, hs: 0.12, big: 1.8, type: 'phys', col: CHASER_COL, downHit: true, noChaser: true }, { zMax: 220 }); })],
    onLand: e => { e.vz = 0; } }) });
// 强袭流星打：蓄力（最长 0.4 秒）后高速突进把敌人打上高空，然后退回原位（退回过程无敌）；蓄得越久冲得越远
defSkill('bm_raid', { name: '强袭流星打', cls: 'mage', job: BM, lvReq: 19, mp: 60, cd: 25, type: 'phys', col: '#e08a2a',
  desc: '蓄力（按住技能键最长 0.4 秒）后化作流星向前高速突进，把路径上的敌人打上高空，然后退回原位，退回过程无敌。蓄得越久冲得越远、范围越大。', pow: lv => skillDmg(7.0, 0.7, lv), ai: { kind: 'gap', r: [0, 280], dy: 24 },
  act: (lv, p) => ({ name: 'bm_raid', clip: 'fang', dur: 1.2, superArmor: true, noCounter: true,
    charge: { at: 0.06, max: hasSkill(p, 'bm_weapon') ? 0.2 : 0.4, min: 0, dmg: game.pvp ? 0.4 : 0, clip: 'charge', update: e => { if (Math.random() < 0.5) fxCharge(e, '#ffb060'); } },
    onStart: e => { e.act.x0 = e.x; },
    update: e => { const a = e.act; if (a.charging || !a.chargeDone) return; if (!a.go) { a.go = e.actT; e.play('raid', true); sfx.iai(); fxAfterimage(e, '#ffb060'); }
      const k = e.actT - a.go; if (k < 0.3) { e.vx = e.face * (700 + (a.chargeK || 0) * 350); if (Math.random() < 0.7) fxStreak({ x: e.x - e.face * 30, y: e.y, z: e.z + 55, face: e.face, len: 120, w: 16, col: '#ffb060', dur: 0.15 }); }
      else if (!a.back) { a.back = true; e.invul = Math.max(e.invul, 0.6); e.vx = (a.x0 - e.x) / 0.4; e.vz = 380; e.z = Math.max(e.z, 1); e.play('bmLeap', true); } },
    hits: [HB(0.1, 0.5, [-20, 76, 32, 0, 110], skillDmg(7.0, 0.7, lv), { launch: 520, knock: 120, hs: 0.1, big: 1.6, shake: 4 })],
    onLand: e => { if (e.act.back) { e.vx = 0; e.endAct(); } } }) });
// 煌龙偃月：召唤巨型金色偃月刀向前连续突刺，强制把敌人推到刀尖（霸体、不可抓取的也推得动，固定型除外）；刺到敌人时刀尖周围生成 7 颗龙之炫纹依次爆炸，最后一次大爆炸
defSkill('bm_dragon', { name: '煌龙偃月', cls: 'mage', job: BM, lvReq: 20, mp: 80, cd: 45, type: 'phys', col: '#f0c030',
  desc: '召唤一把巨大的金色偃月刀向前连续突刺，把敌人强制推到刀尖（霸体和无法抓取的敌人也推得动，固定型的除外）。刺中敌人时刀尖周围生成 7 颗龙之炫纹依次爆炸，最后一次大爆炸。全程霸体。', pow: lv => skillDmg(11, 1.1, lv), ai: { kind: 'burst', r: [0, 130], dy: 26 },
  act: (lv) => ({ name: 'bm_dragon', clip: 'fangRush', dur: 1.6, superArmor: true, noCounter: true, move: [[0.05, 0.75, 160]],
    hits: [HB(0.05, 0.75, [0, 110, 32, 10, 120], skillDmg(0.5, 0.05, lv), { rep: 0.09, stun: 0.4, knock: 0, hs: 0.02, snd: 'stab', onHit: (a, t) => { if (!t.fixed && !t.def_?.fixed) t.x = a.x + a.face * 100; if (a.act) a.act.stuck = true; } })],
    update: e => { const a = e.act; if (e.actT < 0.75 && Math.random() < 0.3) fxSpr('dragonfang', e.x + e.face * 70, e.y, e.z + 60, { w: 200, dur: 0.12, flip: e.face < 0 }); },
    events: [evAt(0.8, e => { const a = e.act; e.play('fang', true); const x = e.x + e.face * 110; cam.flash = 0.12; cam.flashCol = '#fff0b0'; sfx.iai();
      fxSpr('dragonfang', e.x + e.face * 60, e.y, e.z + 60, { w: 240, dur: 0.6, flip: e.face < 0, grow: [0.6, 1.2] });
      if (!a.stuck) return;
      for (let i = 0; i < 7; i++) game.after(0.07 * i, () => { const bx = x + rnd(-40, 40), by = clamp(e.y + rnd(-24, 24), 6, DEPTH - 6); fxBurst(bx, by, rnd(30, 90), 90, '#ffd070'); sfx.boom(0.3);
        blast(e, bx, by, 50, { dmg: skillDmg(0.8, 0.08, lv), stun: 0.3, knock: 20, hs: 0.04, col: '#ffe070', noChaser: true }, { zMax: 200 }); });
      game.after(0.55, () => { cam.shake = 9; sfx.boom(1.1); fxBurst(x, e.y, 60, 260, '#ffd070'); fxShock(x, e.y, 200, '#ffd070');
        blast(e, x, e.y, 120, { dmg: skillDmg(4.5, 0.45, lv), launch: 520, knock: 200, hs: 0.14, big: 1.9, col: '#ffe070', downHit: true, noChaser: true }, { zMax: 220 }); }); })] }) });
// 星纹陨爆（觉醒）：短暂变身贝亚娜，把力量压缩成一颗巨大的“类星体”炫纹引爆，大范围伤害；施放后短暂无敌
defSkill('bm_awaken', { name: '星纹陨爆', cls: 'mage', job: BM, lvReq: 21, maxLv: 3, mp: 150, cd: 135, pvp: 0.45, type: 'phys', awaken: true, col: '#ffd23a',
  desc: '【觉醒】短暂变身为贝亚娜斗神，把力量压缩成一颗巨大的“类星体”炫纹，然后引爆，大范围伤害。施放过程和之后 1 秒无敌。', pow: lv => skillDmg(40, 10, lv), ai: { kind: 'awaken', r: [0, 360], dy: 90 },
  act: (lv) => ({ name: 'bm_awaken', clip: 'bmAwk', dur: 2.2, superArmor: true, noCounter: true, invul: true,
    onStart: e => { game.cutin = { t: 0, dur: 1.0, name: '星纹陨爆', who: cutinWho(e) }; game.timeStop = 0.9; sfx.awaken(); e.act.cx = e.x + e.face * 180; e.act.cy = e.y; e.drawOpts = { glow: 0.4 }; },
    update: e => { const a = e.act; if (e.actT < 0.95) return; if (!a.call) { a.call = true; e.play('bmCall', true); }
      // 0.95～1.35 秒：类星体在举起的手上方长大；1.35～1.6 秒：飞到前方引爆点
      if (e.actT < 1.6) { const hx = e.x + e.face * BM_HAND.x, hz = e.z + BM_HAND.z + 20, g = clamp((e.actT - 0.95) / 0.4, 0, 1), m = clamp((e.actT - 1.35) / 0.25, 0, 1);
        const x = hx + (a.cx - hx) * m, z = hz + (110 - hz) * m, sz = 30 + g * 110 + m * 90;
        addFx({ x, y: a.cy, z: 0, dur: 0.02, zz: z, sz, draw(c) { const X = sx(this.x), Y = sy(this.y, this.zz); drawSpr(c, fxTint('orb', '#fff0a0'), X, Y, this.sz, this.sz, { rot: game.t * 3 }); drawSpr(c, 'chaser', X, Y, this.sz * 0.7, this.sz * 0.7, { rot: -game.t * 4 }); } }); if (Math.random() < 0.6) fxCharge(e, '#ffe070'); } },
    events: [evAt(1.6, e => { const a = e.act; cam.flash = 0.3; cam.flashCol = '#fff6d0'; cam.shake = 12; sfx.boom(1.4); fxBurst(a.cx, a.cy, 110, 460, '#ffe070'); fxShock(a.cx, a.cy, 460, '#ffd070'); fxShock(a.cx, a.cy, 300, CHASER_COL);
      blast(e, a.cx, a.cy, 300, { dmg: skillDmg(40, 10, lv), launch: 520, knock: 220, hs: 0.16, big: 2.2, sure: true, downHit: true, col: '#ffe070', noChaser: true }, { zMax: 260 }); e.invul = Math.max(e.invul, 1.0); })],
    onEnd: e => { e.drawOpts = {}; } }) });
CLASSES.mage.jobs.battlemage = { art: 'job/battlemage', name: '战斗法师', role: '近战 · 连击', armor: 'leather', awaken: 'bm_awaken', awakenName: '贝亚娜斗神',
  desc: '把魔力灌注进矛和棍、近身搏斗的魔法师。连招流畅；战斗中不断生成炫纹，命中敌人后把炫纹射出去追击。',
  skills: ['bm_combo', 'bm_shieldup', 'bm_niu', 'bm_realphase', 'bm_chaser', 'bm_round', 'bm_instinct', 'bm_weapon', 'bm_double', 'bm_bomb', 'bm_smash', 'bm_super', 'bm_flash', 'bm_press', 'bm_raid', 'bm_dragon', 'bm_will', 'bm_awaken'] };
CLASSES.mage.cmds.push(['f', 'bm_chaser', 'buff'], ['fd', 'bm_round'], ['ff', 'bm_instinct', 'buff'], ['dd', 'bm_double'], ['uu', 'bm_bomb'], ['bdf', 'bm_smash'], ['df', 'bm_super', 'buff'],
  ['fdf', 'bm_flash'], ['ud', 'bm_press'], ['bff', 'bm_raid'], ['uff', 'bm_dragon'], ['bfbf', 'bm_awaken']);
// ---- 尼巫的战术：战斗法师专属普攻（刺 → 上挑 → 大横扫），跑攻打空也不摔 ----
const BM_ACTS = { ...MAGE_ACTS,
  atk1: { name: 'atk1', clip: 'fang', dur: 0.34, basic: true, speed: 'aspd', chain: [0.13, 0.34], next: 'atk2', move: [[0.03, 0.1, 150]],
    hits: [HB(0.07, 0.12, [0, 86, 22, 30, 95], 0.85, { stun: 0.36, knock: 40, hs: 0.05, snd: 'stab', type: 'phys' })], events: [evAt(0.06, e => fxStreak({ x: e.x + e.face * 10, y: e.y, z: e.z + 58, face: e.face, len: 90, w: 8, col: '#dfe8ff', dur: 0.12 }))] },
  atk2: { name: 'atk2', clip: 'sky', dur: 0.38, basic: true, speed: 'aspd', chain: [0.15, 0.38], next: 'atk3', move: [[0.03, 0.08, 70]],
    hits: [HB(0.1, 0.16, [0, 70, 26, 0, 120], 0.9, { stun: 0.4, launch: 300, knock: 20, hs: 0.05, snd: 'blunt', type: 'phys' })], events: [slashAt(0.09, { a0: 1.4, a1: -1.9, r: 52, w: 10, off: [10, 50] })] },
  atk3: { name: 'atk3', clip: 'bmSweep', dur: 0.48, basic: true, speed: 'aspd', move: [[0.04, 0.12, 100]],
    hits: [HB(0.12, 0.2, [-10, 95, 34, 0, 120], 1.2, { stun: 0.45, knock: 220, heavy: true, hs: 0.07, snd: 'blunt', type: 'phys', last: true, shake: 1.5 })], events: [slashAt(0.11, { a0: -1.3, a1: 1.1, r: 62, w: 13, off: [24, 55], heavy: true })] },
};
// ---- 命中钩子：直接攻击命中生成炫纹（每个动作一次）、记下最后命中的目标；连击精通延长连击判定；炫纹爆弹缩短倒计时 ----
CLASSES.mage.onHit = (p, t, h, dmg, act) => {
  if (jobOf(p) !== BM) return;
  if (hasSkill(p, 'bm_combo') && isHuman(p)) game.comboT = Math.max(game.comboT, 1.9);
  if (!act || h.noChaser) return;
  p._lastHitTgt = t; p._lastHitT = game.t;
  if (!act._chG && !act.awaken) { act._chG = true; addChaser(p, 1); }
  for (const s of summonsOf(p, 'bm_timebomb')) if (s.host === t) s.lifeT = Math.min(s.life - 0.05, s.lifeT + 0.15);
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
