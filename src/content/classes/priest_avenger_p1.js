/* =====================================================================
   复仇者（二）：魔化：末日审判者（变身）+ 魔化专属（恶魔之爪 / 审判 / 恶魔屏障）、Lv23 以后的技能、二 / 三觉、化魔改写、觉醒自动学会、被动刷新、组队同步、登记
   ===================================================================== */
/* ---- 魔化：末日审判者（一觉「末日审判者」的觉醒技，KR 악마화）----
   发动：蹲身 → 紫黑色的魔气往身上聚（地面裂开）→ 插图 + 时停 → 胸口的十字疤吸进圣光 → 仰天嘶吼、全身炸开魔气（三圈冲击波、魔气柱、震飞周围的敌人）
   之后 50 秒：体型变大（×1.22）、黑色恶魔之躯、恶魔角 / 翼、红眼、胸口十字疤发光、身后末日审判者的虚影、脚下紫色魔法阵和紫黑火焰；HUD 恶魔能量条上显示剩余时间 */
function paTransform(e, lv, fromHalf) {
  if (fromHalf) { delete e.buffs.pa_half; e.cool.pa_meta = SKILLS.pa_meta.cd * (e.cdMul || 1); }
  const hf = skLv(e, 'pa_meta') ? 1 : 0;
  e.buffs.pa_demon = { t: 50, aspd: 0.1 + 0.05 * hf, mspd: 0.1 + 0.1 * hf, critDmg: 0.15, taken: -0.15, lv, name: '魔化', col: '#9a3ad8' };
  if (e.scale !== PA_SCALE) e._paScale0 = e.scale || 1; e.scale = PA_SCALE; e._paD = 1; e.acts = priestActs(e);
  paDemonFx(e); paGain(e, 50, 'keep');
  cam.shake = Math.max(cam.shake, 18); cam.flash = 0.2; cam.flashCol = '#8a2ad8'; paRoarSfx(1);
  fxSpr('aura', e.x, e.y, 0, { h: 420, w: 220, ay: 1, dur: 0.9, col: '#8a2ad8', grow: [0.4, 1.2] }); fxBurst(e.x, e.y, e.z + 70, 360, PA_COL.dark);
  for (let i = 0; i < 3; i++) game.after(i * 0.1, () => fxShock(e.x, e.y, (260 + i * 130) * (fromHalf ? 1.4 : 1), i === 1 ? '#ff4a9a' : PA_COL.dark));
  addFx({ ent: e, x: e.x, y: e.y - 0.7, z: 0, dur: 0.9, draw(c) { const E = this.ent, k = this.t / this.dur, dem = paImg('pa_demon'); if (!dem) return;
    drawSpr(c, dem, sx(E.x - E.face * 20), sy(E.y, E.z) + 8, 0, 300 * (0.7 + 0.5 * easeOut(k)), { add: false, flip: E.face < 0, alpha: (1 - k) * 0.8, ay: 1 }); } });
  addFx({ ent: e, x: e.x, y: e.y + 0.8, z: 0, dur: 0.9, draw(c) { const E = this.ent, k = this.t / this.dur, a = k < 0.1 ? k / 0.1 : 1 - (k - 0.1) / 0.9; c.save(); c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 10; i++) { const ang = i / 10 * TAU + 0.3, r = 30 + 110 * easeOut(k); c.globalAlpha = 0.85 * a; jlCell(c, 'jv_flame', i % 3 ? PA_COL.flame : '#ff4a9a', i + Math.floor(this.t * 20), sx(E.x + Math.cos(ang) * r), sy(E.y + Math.sin(ang) * r * 0.35, E.z) + 4, 80 + 30 * Math.sin(i * 1.7), 1.2); }
    c.restore(); } });
  blast(e, e.x, e.y, fromHalf ? 400 : 280, { dmg: skillDmg(6, 1.5, lv), type: 'mag', launch: 420, knock: 320, hs: 0.1, big: 1.6, downHit: true, sure: true, snd: 'slash', col: '#e0a0ff' }, { zMax: 200 });
  fxText('神啊……!', e.x, e.y, e.z + 130, { col: '#ffa0e0', size: 18, dur: 1 });
  game.after(0.7, () => { if (paDemon(e)) fxText('……真是爽快的感觉。', e.x, e.y, e.z + 150, { col: '#e0b0ff', size: 13, dur: 1.2 }); });
}
defSkill('pa_awaken', { name: '魔化：末日审判者', cls: 'priest', job: PA, tier: 1, lvReq: 21, maxLv: 3, sp: 0, mp: 150, cd: 145, pvp: 0.45, awaken: true, type: 'mag', col: '#9a3ad8', icon: 'pa_awaken',
  desc: '【一次觉醒「末日审判者」的觉醒技 · 变身】完成一次觉醒任务时自动学会（不花 SP，等级随角色等级提升）并放进技能栏（↑↑↓↓+Z）。释放体内的恶魔，化身末日审判者 50 秒：体型变大、黑色的恶魔之躯长出恶魔角和翼，变身时嘶吼着炸开魔气把周围的敌人震飞（变身动画中无敌）。魔化中：全程霸体、不能被抓，受到的伤害 −15%，攻击速度 / 移动速度提高，魔法暴击伤害 +15%；普攻变成巨爪 4 段（范围很大），空斩打键变成「恶魔之爪」，多了「审判」「恶魔屏障」；复仇者的转职技能全部自动换成恶魔版（伤害更高、冷却更长）；除后跳 / 恶魔之手 / 化魔以外的转职前技能不能用。化魔每次施放：魔化持续 +7.3 秒、魔化冷却 −21 秒（实际上可以一直保持）。冷却好了再按一次 = 周身伤害并把时间重置满；冷却中再按一次 = 解除魔化。HP 归零时恶之再临会把你变回人形。',
  pow: lv => skillDmg(6, 1.5, lv), infoExtra: () => [['持续', '50 秒'], ['受到伤害', '−15%'], ['攻速 / 移速', '+10%（学了半魔化再 +5% / +10%）'], ['霸体', '全程，不能被抓']], ai: { kind: 'buff' },
  recast: { ok: p => paDemon(p), instant: p => (p.cool.pa_awaken || 0) > 0, cd: 0.4,
    act: (lv, p) => { if ((p.cool.pa_awaken || 0) > 0) { paDemonEnd(p, '解除魔化'); return null; }
      p.cool.pa_awaken = SKILLS.pa_awaken.cd * (p.cdMul || 1);
      return { name: 'pa_awaken', clip: 'paRoar', dur: 0.6, noCounter: true, invul: true, superArmor: true, type: 'mag',
        events: [evAt(0.15, e => { if (e.buffs.pa_demon) e.buffs.pa_demon.t = 50; paRoarSfx(0.8); cam.shake = Math.max(cam.shake, 12); fxShock(e.x, e.y, 360, PA_COL.dark); fxShock(e.x, e.y, 220, '#ff4a9a'); fxAura(e, '#9a3ad8', 0.8);
          fxText('魔化 · 重置', e.x, e.y, e.z + 130, { col: '#ffa0e0', size: 14 });
          blast(e, e.x, e.y, 300, { dmg: skillDmg(6, 1.5, lv), type: 'mag', launch: 380, knock: 260, hs: 0.1, big: 1.5, downHit: true, sure: true, snd: 'slash', col: '#e0a0ff' }, { zMax: 200 }); })] }; } },
  act: (lv, p) => { const fromHalf = paHalf(p), T = fromHalf ? 0.25 : 0.55;
    return { name: 'pa_awaken', clip: 'paHunch', dur: T + 0.55, noCounter: true, invul: true, superArmor: true, type: 'mag',
      onStart: e => { game.cutin = { t: 0, dur: fromHalf ? 0.8 : 1.1, name: '魔化：末日审判者', who: cutinWho(e) }; game.timeStop = fromHalf ? 0.5 : 0.9; sfx.awaken(); sfx.charge(); fxDust(e.x, e.y, 8, 20, '#4a3a5a');
        fxSpr('crossx', e.x + e.face * 6, e.y, e.z + 62, { w: 60, dur: T + 0.2, col: '#ffffff', grow: [0.4, 1.4] }); paCracks(e.x, e.y, 150); },
      update: e => { if (e.actT < T && Math.random() < 0.8) { fxCharge(e, Math.random() < 0.5 ? PA_COL.dark : '#ff4a9a', 3); cam.shake = Math.max(cam.shake, 2); } },
      events: [evAt(T, e => { e.play('paRoar', true); paTransform(e, lv, fromHalf); })] }; } });
// 地面裂开的紫色裂缝（魔化蓄力）
function paCracks(x, y, r) {
  const L = []; for (let i = 0; i < 7; i++) { const a = i / 7 * TAU + rnd(-0.2, 0.2), pts = [[0, 0]]; let d = 0; while (d < r) { d += rnd(r * 0.15, r * 0.25); pts.push([Math.cos(a) * d + rnd(-6, 6), Math.sin(a) * d * GR + rnd(-3, 3)]); } L.push(pts); }
  addFx({ x, y: y - 40, z: 0, dur: 1.0, draw(c) { const k = this.t / this.dur, a = k < 0.2 ? k / 0.2 : 1 - Math.max(0, k - 0.6) / 0.4, X = sx(x), Y = sy(y, 0);
    c.save(); c.globalCompositeOperation = 'lighter'; for (const [w, cc, al] of [[8, PA_COL.dark, 0.4], [2.5, '#ffb0ff', 0.9]]) { c.strokeStyle = cc; c.globalAlpha = a * al; c.lineWidth = w; for (const P of L) { c.beginPath(); P.forEach(([px, py], i) => i ? c.lineTo(X + px, Y + py) : c.moveTo(X + px, Y + py)); c.stroke(); } } c.restore(); } });
}
// 恶魔之爪：魔化中空斩打键（Z）变成它（官方替换 공참타 键）：暗属性巨爪下劈，可以按住蓄力（加伤不多），命中能量 +15；能从普攻中放出，也能接其他技能
defSkill('pa_claw', { name: '恶魔之爪', cls: 'priest', job: PA, tier: 1, lvReq: 21, lvFrom: 'pa_awaken', maxLv: 3, hidden: true, mp: 0, cd: 2, type: 'mag', elem: 'dark', col: '#b05aff', icon: 'pa_claw',
  desc: '魔化中按空斩打键（Z）：暗属性巨爪猛地劈下，可以按住蓄力（伤害略增）。能从普攻中放出，放完也能马上接别的技能。命中时恶魔能量 +15。',
  pow: lv => skillDmg(2.2, 0.4, lv), ai: { kind: 'poke', r: [0, 200], dy: 60 },
  act: lv => ({ name: 'pa_claw', clip: 'paSlash2', dur: 0.5, noCounter: true, cancelable: true, cancelFrom: 0.26, type: 'mag',
    charge: { at: 0.05, max: 0.6, min: 0, dmg: 0.2, update: e => { if (Math.random() < 0.4) fxCharge(e, PA_COL.claw, 1); } },
    hits: [HB(0.12, 0.2, [0, 210, 66, -10, 220], skillDmg(2.2, 0.4, lv), { type: 'mag', elem: 'dark', stun: 0.6, knock: 140, launch: 220, hs: 0.08, big: 1.5, downHit: true, snd: 'slash', col: '#e0a0ff', onHit: (a, t) => paGain(a, 15) })],
    events: [evAt(0.11, e => { paClawFx(e.x + e.face * 105, e.y, e.z + 70, e.face, 2); fxShock(e.x + e.face * 105, e.y, 180, PA_COL.claw); sfx.swing(true); cam.shake = Math.max(cam.shake, 3); })] }) });
// 审判：只有魔化 / 半魔化中能用，耗 100 恶魔能量（半魔化不耗）。原地：巨臂上挑 + 终结砸（1 : 2.85）；施放时按住 →：巨臂抓敌 → 摔到身后 → 拖着狂奔（↑ / ↓ 移动，途中碰到的敌人强制硬直一起拖走，再按技能键提前扔出）→ 压 → 抛；抓取期间无敌；抓不起的敌人改为握碎爆炸
const PA_EXEC = { up: 1, slam: 0.45, drag: 0.09, press: 0.28, toss: 1.07 };
defSkill('pa_execute', { name: '审判', cls: 'priest', job: PA, tier: 1, lvReq: 21, lvFrom: 'pa_awaken', maxLv: 3, sp: 0, mp: 0, cd: 145, type: 'mag', col: '#d02a6a', icon: 'pa_execute', grab: true,
  req: p => !(paDemon(p) || paHalf(p)) ? '只有魔化 / 半魔化中能用' : paHalf(p) || paE(p) >= 100 || '恶魔能量不足 100',
  desc: '【魔化 / 半魔化中才能用，完成一次觉醒任务时自动学会（←→+Z）】消耗 100 恶魔能量（半魔化中不耗），召唤巨大的恶魔之臂：原地施放 = 上挑 + 终结重砸（1 : 2.85）；施放时按住 → = 抓住身前的敌人摔到身后，再拖着他在地上狂奔（↑ / ↓ 移动，路上碰到的敌人强制硬直、一起拖走，再按技能键提前扔出），最后压住一扔（抓取期间无敌）。抓不起来的敌人会被一把握碎（爆炸）。半魔化中不拖行。伤害随魔化的等级提升。',
  pow: lv => skillDmg(22, 6, lv), infoExtra: () => [['原地', '上挑 1 : 终结 2.85'], ['抓取版', '上挑 1 / 摔 0.45 / 拖 0.09 × 15 / 压 0.28 / 抛 1.07'], ['消耗', '100 恶魔能量']], ai: { kind: 'grab', r: [0, 140], dy: 40 },
  act: (lv, p) => { const T = skillDmg(22, 6, lv) * (1 + 0.02 * skLv(p, 'pa_nightmare')), I = p.pad, drag = !paHalf(p) && !!(I && I.dx() === p.face);
    const armFx = (e, x, z, rot, s = 1) => fxSpr('bloodhand', x, e.y, z, { w: 260 * s, h: 120 * s, dur: 0.4, col: '#6a1a9a', rot, flip: e.face < 0, grow: [0.5, 1.1] });
    if (!drag) { const U = T / 3.85;
      return { name: 'pa_execute', clip: 'paExecute', dur: 1.1, noCounter: true, superArmor: true, type: 'mag',
        onStart: e => { paSpend(e, 100); sfx.charge(); },
        events: [evAt(0.18, e => { armFx(e, e.x + e.face * 90, 20, -e.face * 1.2, 1.3); sfx.swing(true); instantHit(e, { box: [0, 200, 70, -10, 220], dmg: U, type: 'mag', launch: 520, knock: 40, hs: 0.08, downHit: true, sure: true, snd: 'slash', col: '#ff80c0' }); }),
          evAt(0.6, e => { const x = e.x + e.face * 120; armFx(e, x, 160, e.face * 1.4, 1.6); cam.shake = Math.max(cam.shake, 14); cam.flash = 0.1; cam.flashCol = '#ff60a0'; sfx.boom(1.3);
            fxShock(x, e.y, 300, '#d02a6a'); fxBurst(x, e.y, 40, 300, PA_COL.dark); paCracks(x, e.y, 180);
            instantHit(e, { box: [-20, 240, 80, -10, 320], dmg: U * 2.85, type: 'mag', down: true, downLift: 200, knock: 160, hs: 0.18, big: 2.4, shake: 6, downHit: true, sure: true, snd: 'blunt', col: '#ff80c0' }); })] }; }
    const U = T / 4.15;
    return { name: 'pa_execute', clip: 'paGrab', dur: 0.6, noCounter: true, superArmor: true, type: 'mag',
      onStart: e => { paSpend(e, 100); sfx.charge(); armFx(e, e.x + e.face * 80, 40, 0, 1.2); },
      hits: [HB(0.08, 0.24, [0, 170, 60, 0, 200], U * PA_EXEC.up, { type: 'mag', grab: true, grabInvul: true, launch: 0, stun: 0.6, hs: 0.06, snd: 'slash', col: '#ff80c0',
        onGrabFail: (a, t) => { if (!a.act || a.act.skill !== 'pa_execute' || a.act.crushed) return; a.act.crushed = true; fxBurst(t.x, t.y, t.z + 60, 300, '#d02a6a'); cam.shake = Math.max(cam.shake, 10); sfx.boom(1.2);
          applyHit(a, t, { dmg: U * 2.45, type: 'mag', knock: 200, launch: 260, hs: 0.14, big: 2, sure: true, snd: 'slash', col: '#ff80c0', box: null }, { src: a }); a.act.dur = a.actT + 0.5; } })],
      onGrab: (e, t) => { const a = e.act; if (a.gT !== undefined) return; a.gT = e.actT; a.dur = e.actT + 2.4; a.drag = new Set(); a.n = 0; t.heldClip = 'hit2'; sfx.swing(true);
        game.after(0.15, () => { if (e.act !== a || !e.grabbed) return; e.face = -e.face; cam.shake = Math.max(cam.shake, 6); fxShock(e.x + e.face * 60, e.y, 180, '#d02a6a'); applyHit(e, t, { dmg: U * PA_EXEC.slam, type: 'mag', sure: true, hs: 0.06, snd: 'blunt', col: '#ff80c0', box: null }, { src: e }); e.face = -e.face; }); },
      onInput: (e, I2) => { const a = e.act; if (a.gT === undefined || a.done) return false; e.vy = I2.dy() * 180; if (e.actT - a.gT > 0.4 && I2.buffered(a.key || 'cmd')) { I2.consume(a.key || 'cmd'); a.toss = true; } return false; },
      update: e => { const a = e.act; if (a.gT === undefined || a.done) return; const k = e.actT - a.gT, t = e.grabbed;
        if (k > 0.3 && !a.toss && k < 1.9) { e.vx = e.face * 520; if (Math.floor(k / 0.1) !== a.dk && a.n < 15) { a.dk = Math.floor(k / 0.1); a.n++; fxDust(e.x + e.face * 50, e.y, 3, 14, '#4a2a5a');
            if (t) applyHit(e, t, { dmg: U * PA_EXEC.drag, type: 'mag', sure: true, hs: 0.01, snd: 'blunt', col: '#ff80c0', box: null }, { src: e });
            for (const o of ents) if (hittable(e, o) && o !== t && Math.abs(o.x - (e.x + e.face * 80)) < 70 && Math.abs(o.y - e.y) < 60 && o.z < 150) { if (!a.drag.has(o)) { a.drag.add(o); if (!o.boss) addStatus(o, 'hold', 2.2, { src: e }); } applyHit(e, o, { dmg: U * PA_EXEC.drag, type: 'mag', hs: 0.01, snd: 'blunt', col: '#ff80c0', box: null }, { src: e }); }
            for (const o of a.drag) if (!o.boss && !o.dead) { o.x = e.x + e.face * rnd(90, 130); o.y = lerp(o.y, e.y, 0.5); } } }
        if (!a.done && (a.toss || k >= 1.9)) { a.done = true; e.vx = 0; e.play('paExecute', true); cam.shake = Math.max(cam.shake, 12); sfx.boom(1.2); fxShock(e.x + e.face * 80, e.y, 260, '#d02a6a');
          if (t) { applyHit(e, t, { dmg: U * PA_EXEC.press, type: 'mag', sure: true, hs: 0.08, snd: 'blunt', col: '#ff80c0', box: null }, { src: e });
            throwArc(e, t, { dx: 320, h: 160, dur: 0.5, other: { dmg: U * 0.2, type: 'mag', down: true, knock: 160, hs: 0.05, snd: 'blunt' }, hit: { dmg: U * PA_EXEC.toss, type: 'mag', down: true, downLift: 180, knock: 120, hs: 0.14, shake: 6, big: 2, snd: 'blunt' } }); }
          for (const o of a.drag) { if (o.status && o.status.hold && o.status.hold.src === e) delete o.status.hold; if (!o.dead) applyHit(e, o, { dmg: U * 0.3, type: 'mag', knock: 260, launch: 300, hs: 0.06, sure: true, snd: 'blunt', col: '#ff80c0', box: null }, { src: e }); }
          a.dur = e.actT + 0.45; } },
      hold: (e, t) => { t.x = e.x + e.face * 70; t.y = e.y + 0.5; t.z = e.z + 30; t.face = -e.face; },
      onEnd: e => { e.vy = 0; } }; } });
// 恶魔屏障：魔化中 ↓↓+X，任何技能 / 跳跃中都能插放（没有动作）：2 秒暗黑屏障，受到的打击伤害 −60%（不是无敌、只护自己）；再按一次取消；毁灭之翼施放中不能用
defSkill('pa_barrier', { name: '恶魔屏障', cls: 'priest', job: PA, tier: 1, lvReq: 21, maxLv: 1, sp: 0, mp: 0, cd: 5, type: 'mag', buff: true, col: '#6a3aa8', icon: 'pa_barrier',
  req: p => !paDemon(p) ? '只有魔化中能用' : p.act && p.act.skill === 'pa_awaken3' ? '毁灭之翼中不能用' : true,
  desc: '【魔化中才能用，完成一次觉醒任务时自动学会（↓↓+X）】张开 2 秒的暗黑屏障：受到的打击伤害 −60%（不是无敌，只保护自己）。没有施放动作，任何技能、跳跃中都能插放（可以用来砍掉后摇）；再按一次取消。末日福音：毁灭之翼施放中不能用。',
  infoExtra: () => [['受到伤害', '−60%'], ['持续', '2 秒']], ai: { kind: 'buff' },
  recast: { ok: p => !!p.buffs.pa_barrier, instant: true, cd: 0.2, act: (lv, p) => { delete p.buffs.pa_barrier; } },
  instant: (lv, p) => { p.buffs.pa_barrier = { t: 2, taken: -0.6, name: '恶魔屏障', col: '#6a3aa8' }; sfx.buff();
    addFx({ ent: p, x: p.x, y: p.y + 0.9, z: 0, dur: 2, draw(c) { const E = this.ent; if (!E.buffs.pa_barrier) { this.dur = this.t; return; } this.y = E.y + 0.9; const sc = E.scale || 1, k = this.t;
      drawSpr(c, fxTint('darkorb', '#8a4ad8'), sx(E.x), sy(E.y, E.z + 60 * sc), 170 * sc, 190 * sc, { rot: k * 1.5, alpha: 0.55 }); drawSpr(c, fxTint('hexagram', '#b070ff'), sx(E.x), sy(E.y, E.z + 60 * sc), 150 * sc, 170 * sc, { rot: -k, alpha: 0.35 }); } }); } });

/* ---- Lv23 以后的转职技能 ---- */
// 地狱之门：在前方打开地狱之门，门里射出一道远程直线多段（每个目标最多 8 击，射程和重火器差不多远）；门本体也有判定、法阵后方没有；轻微击退；霸体；能量 +40。魔化 +50%
defSummon('pa_gate_s', { kind: 'field', life: 2.0, max: 1, over: 'oldest', keepRoom: false, type: 'mag', elem: 'dark', col: PA_COL.dark,
  onSpawn: s => { s.n = 0; s.hits = new Map(); },
  update: s => { const k = s.lifeT;
    while (s.n < 8 && k >= 0.3 + s.n * 0.18) { s.n++; if (s.n % 2) sfx.hit('slash', false);
      for (const t of ents) if (foe(s.owner, t) && t.invul <= 0 && (t.x - s.x) * s.face > -60 && (t.x - s.x) * s.face < 760 && Math.abs(t.y - s.y) < 75 && t.z < 180 && (s.hits.get(t.id) || 0) < 8) {
        s.hits.set(t.id, (s.hits.get(t.id) || 0) + 1); summonHit(s, t, { dmg: s.per, type: 'mag', stun: 0.35, knock: 25, hs: 0.02, downHit: true, snd: 'slash', col: '#d0a0ff' }); } } },
  drawUpright(c, s) { const k = s.lifeT, a = paFade(s), X = sx(s.x), Y = sy(s.y - 20, 0);
    c.save(); c.globalAlpha = a; drawSpr(c, IMG['fx/sb_gate'] ? fxTint('sb_gate', '#9a4ae8') : null, X, Y, 0, 230, { add: false, ay: 1, flip: s.face < 0 }); c.restore();
    if (k > 0.25 && k < 1.8) { const w = 40 + 14 * Math.sin(k * 30); c.save(); c.globalAlpha = a; drawSpr(c, fxTint('laser', '#9a4ae8'), X + s.face * 10, sy(s.y, 95), 760, w, { ax: 0, ay: 0.5, flip: s.face < 0 }); drawSpr(c, fxTint('laser', '#ffd0ff'), X + s.face * 10, sy(s.y, 95), 760, w * 0.35, { ax: 0, ay: 0.5, flip: s.face < 0 }); c.restore(); } } });
const paFade = s => clamp(Math.min(s.lifeT / 0.2, (s.life - s.lifeT) / 0.3), 0, 1);
defSkill('pa_gate', { name: '地狱之门', cls: 'priest', job: PA, tier: 1, lvReq: 23, mp: 100, cd: 30, type: 'mag', elem: 'dark', col: '#9a4ae8', icon: 'pa_gate',
  desc: '在身前打开地狱之门，门里射出一道恶魔之气的洪流：直线远程多段（射程约 760px，每个目标最多 8 击），门本体也有判定（门后方没有）；轻微击退。霸体。恶魔能量 +40。魔化：攻击力 +50%。',
  pow: lv => skillDmg(11, 1.1, lv), infoExtra: () => [['段数', '每个目标最多 8 × 1467%'], ['射程', '约 760px']], ai: { kind: 'poke', r: [60, 700], dy: 50 },
  act: lv => ({ name: 'pa_gate', clip: 'paCast', dur: 0.7, noCounter: true, superArmor: true, type: 'mag',
    events: [evAt(0.05, e => { fxCharge(e, PA_COL.dark, 3); sfx.charge(); }),
      evAt(0.3, e => { const s = summon(e, 'pa_gate_s', { x: e.x + e.face * 100, y: e.y }); if (s) s.per = skillDmg(11, 1.1, lv) * paDmg(e, 'pa_gate') / 8; fxShock(e.x + e.face * 100, e.y, 200, PA_COL.dark); sfx.boom(0.8); cam.shake = Math.max(cam.shake, 5); })] }) });
// 末日浩劫：起跳（准备时霸体，飞出画面后无敌），地面生成漩涡魔法阵（方向键移动、吸怪）；再按技能键或时间到 → 恶魔之躯从天而降砸下（单段）；能量 +45。魔化 +35%
defSummon('pa_vortex_s', { kind: 'field', life: 3.0, max: 1, over: 'oldest', keepRoom: false, col: PA_COL.dark, r: 210,
  update: s => { for (const t of ents) if (foe(s.owner, t) && !t.boss && !(hasSA(t) && t.st !== 'hit') && inGround(t, s.x, s.y, s.sdef.r * 1.3)) { t.x = lerp(t.x, s.x, 0.05); t.y = lerp(t.y, s.y, 0.05); } },
  draw(c, s) { const a = paFade(s); c.save(); c.globalAlpha = a; drawSpr(c, fxTint('rune', '#9a3ad8'), sx(s.x), sy(s.y, 0), s.sdef.r * 2.2, s.sdef.r * 2.2 * GR, { ground: true, rot: s.lifeT * 2.5 });
    drawSpr(c, fxTint('hexagram', '#ff4a9a'), sx(s.x), sy(s.y, 0), s.sdef.r * 1.5, s.sdef.r * 1.5 * GR, { ground: true, rot: -s.lifeT * 3 }); c.restore(); } });
defSkill('pa_disaster', { name: '末日浩劫', cls: 'priest', job: PA, tier: 1, lvReq: 25, mp: 110, cd: 50, type: 'mag', col: '#7a2ab8', icon: 'pa_disaster',
  desc: '纵身跃出画面（准备时霸体，飞出画面后无敌），地面出现一个漩涡魔法阵把周围的敌人吸过去——方向键可以移动魔法阵；再按技能键（或 2.2 秒后）恶魔之躯从天而降砸在魔法阵上（单段，全部伤害）。恶魔能量 +45。魔化：攻击力 +35%。',
  pow: lv => skillDmg(20, 2, lv), infoExtra: () => [['段数', '1（20616%）'], ['魔法阵半径', '210px']], ai: { kind: 'aoe', r: [60, 360], dy: 100 },
  act: (lv, p) => { const T = skillDmg(20, 2, lv) * paDmg(p, 'pa_disaster');
    return { name: 'pa_disaster', clip: 'paHunch', dur: 3.4, noCounter: true, superArmor: true, type: 'mag',
      onStart: e => { const a = e.act; a.v = summon(e, 'pa_vortex_s', { x: e.x + e.face * 220, y: e.y }); sfx.charge(); },
      onInput: (e, I) => { const a = e.act, v = a.v; if (!v || a.crash) return false; if (a.up) { v.x += I.dx() * 5; v.y = clamp(v.y + I.dy() * 3, 8, DEPTH - 8); if (game.room) v.x = clamp(v.x, game.room.x0 + 40, game.room.x1 - 40); }
        if (a.up && e.actT > 0.6 && I.buffered(a.key || 'cmd')) { I.consume(a.key || 'cmd'); a.go = true; } return false; },
      update: e => { const a = e.act;
        if (!a.up && e.actT >= 0.25) { a.up = true; e.play('jumpUp', true); e.vz = 1500; e.z = Math.max(e.z, 1); sfx.jump(); fxDust(e.x, e.y, 6, 16); fxShock(e.x, e.y, 120, PA_COL.dark); }
        if (a.up && !a.crash) { if (e.z > 300) e.invul = Math.max(e.invul, 0.1); if (e.actT > 0.35 && e.vz <= 0) { e.vz = 0; e.z = Math.max(e.z, a.apex || (a.apex = Math.max(e.z, 400))); } e.vx = 0;
          if (a.go || e.actT >= 2.4) { a.crash = true; const v = a.v; if (v && !v.gone) { e.x = v.x; e.y = v.y; } e.vz = -3200; e.play('paDive', true); } }
        if (a.crash && !a.boom && e.z > 20) e.invul = Math.max(e.invul, 0.05); },
      onLand: e => { const a = e.act; if (!a.crash) { e.vz = 0; return; } if (a.boom) return; a.boom = true; a.dur = e.actT + 0.6; const v = a.v; if (v) dismissOne(v, 'done');
        cam.shake = 22; cam.flash = 0.2; cam.flashCol = '#a040ff'; sfx.boom(1.8); paRoarSfx(0.6);
        paBoom(e.x, e.y, 30, 380); fxShock(e.x, e.y, 460, PA_COL.dark); fxShock(e.x, e.y, 280, '#ff4a9a'); paCracks(e.x, e.y, 260);
        addFx({ x: e.x, y: e.y - 0.5, z: 0, dur: 0.6, draw(c) { const k = this.t / this.dur, dem = paImg('pa_demon'); if (dem) drawSpr(c, dem, sx(this.x), sy(this.y, 0) + 10, 0, 280, { add: false, alpha: 0.8 * (1 - k), ay: 1 }); } });
        blast(e, e.x, e.y, 230, { dmg: T, type: 'mag', launch: 560, knock: 160, hs: 0.2, big: 2.6, shake: 8, downHit: true, sure: true, snd: 'blunt', col: '#e0a0ff' }, { zMax: 260 }); } }; } });
// 不朽战吼：全方位嘶吼 3 下（50% 诅咒 3 秒），按住技能键再吼 2 次（每次 −50 能量）；每次命中回能量（普通 20 / 领主 40）。魔化：5 段、把敌人垂直吹飞；半魔化：追加吼不耗能量
defSkill('pa_howl', { name: '不朽战吼', cls: 'priest', job: PA, tier: 2, lvReq: 26, mp: 110, cd: 40, type: 'mag', col: '#8a3ad8', icon: 'pa_howl',
  desc: '向四面八方发出恶魔的嘶吼，连吼 3 下（每下 50% 几率诅咒 3 秒）；按住技能键再追加吼 2 次（每次消耗 50 恶魔能量）。每次打中敌人都会回复恶魔能量（普通 20、领主 40），半魔化中也能回。魔化：变成 5 段，把敌人垂直吹飞；半魔化：追加吼不耗能量。',
  pow: lv => skillDmg(14, 1.4, lv), infoExtra: () => [['嘶吼', '3 × 10998%'], ['追加（按住）', '2 × 2752%，每次 −50 能量'], ['半径', '290px']], ai: { kind: 'aoe', r: [0, 280], dy: 120 },
  act: (lv, p) => { const T = skillDmg(14, 1.4, lv), D = paDemon(p), N = D ? 5 : 3, per = T * paDmg(p, 'pa_howl') / N;
    return { name: 'pa_howl', clip: 'paRoar', dur: 0.4 + N * 0.22 + 0.2, noCounter: true, superArmor: true, type: 'mag',
      update: e => { const a = e.act; a.n = a.n || 0; const due = 0.3 + a.n * 0.22;
        const roar = (d, big) => { paRoarSfx(big ? 0.7 : 0.4); cam.shake = Math.max(cam.shake, big ? 8 : 5); fxShock(e.x, e.y, 300, a.n % 2 ? '#ff4a9a' : PA_COL.dark);
          fxSpr('ghost', e.x + e.face * 30, e.y, e.z + 90, { w: 150, dur: 0.4, col: '#8a3ad8', flip: e.face < 0, grow: [0.6, 1.3] });
          for (const t of ents) if (hittable(e, t) && Math.hypot(t.x - e.x, (t.y - e.y) / GR) < 290 + t.w && t.z < 260) { applyHit(e, t, { dmg: d, type: 'mag', stun: 0.5, knock: D ? 0 : 60, launch: D ? 420 : 0, radial: true, hs: 0.05, downHit: true, snd: 'slash', col: '#d0a0ff', box: null }, { src: e });
            paGain(e, t.boss ? 40 : 20, 'keep'); if (Math.random() < 0.5) addStatus(t, 'curse', 3, { src: e }); } };
        if (a.n < N && e.actT >= due) { a.n++; roar(per, false); }
        if (a.n >= N && !a.extraDone) { const I = e.pad, held = I && a.key && I.is(a.key); a.ex = a.ex || 0;
          if (held && a.ex < 2 && e.actT >= due && paSpend(e, 50)) { a.ex++; a.dur += 0.22; roar(per * 0.25, true); fxText('吼!', e.x, e.y, e.z + 120, { col: '#ffa0e0', size: 12 }); } else if (!held || a.ex >= 2) a.extraDone = true; } } }; } });
// 毁灭强击：瞬间魔化，用恶魔之角往前冲（← / → 调距离、↑ / ↓ 调纵深），把前方（和身后 100px 内）的敌人挂在角上带走 → 骷髅形暗黑冲击波 + 暗炎持续伤害 5 击；
// 终结前再按技能键额外消耗最多 125 能量，暗炎变 10 击；冲锋中无敌
defSkill('pa_smite', { name: '毁灭强击', cls: 'priest', job: PA, tier: 2, lvReq: 26, mp: 120, cd: 45, type: 'mag', col: '#b03ad8', icon: 'pa_smite',
  desc: '瞬间魔化，低头用恶魔之角向前猛冲（约 450px；按 → 更远、按 ← 更近，↑ / ↓ 调纵深），把前方和身后 100px 内的敌人挂在角上一路带走，冲到头炸出骷髅形的暗黑冲击波，再烧出暗炎（5 击）。终结前再按技能键额外消耗最多 125 恶魔能量，暗炎变成 10 击。冲锋中无敌。魔化：攻击力 +35%；半魔化：不耗能量。',
  pow: lv => skillDmg(16, 1.6, lv), infoExtra: () => [['冲击波 : 暗炎', '28 : 1 × 5'], ['冲锋', '约 450px']], ai: { kind: 'gap', r: [0, 460], dy: 60 },
  act: (lv, p) => { const T = skillDmg(16, 1.6, lv) * paDmg(p, 'pa_smite'), I = p.pad, d = I ? I.dx() * p.face : 0, dist = d > 0 ? 560 : d < 0 ? 320 : 450;
    return { name: 'pa_smite', clip: 'paStab', dur: 1.5, noCounter: true, superArmor: true, invul: [0, 0.5], type: 'mag',
      onStart: e => { const a = e.act; a.x0 = e.x; a.hook = new Set(); fxAura(e, PA_COL.dark, 0.5); paRoarSfx(0.5); fxText('哈啊!', e.x, e.y, e.z + 120, { col: '#ffa0e0', size: 12 });
        a.hornFx = addFx({ ent: e, x: e.x, y: e.y + 0.3, z: 0, dur: 0.6, draw(c) { const E = this.ent, H = paImg('pa_horns'); if (H) drawSpr(c, H, sx(E.x + E.face * 36), sy(E.y, E.z + 70), 90, 0, { add: false, rot: E.face * 1.2 }); } }); },
      onInput: (e, I2) => { const a = e.act; e.vy = I2.dy() * 150; if (a.stop && !a.fin && I2.buffered(a.key || 'cmd')) { I2.consume(a.key || 'cmd'); a.more = true; } return false; },
      update: e => { const a = e.act;
        if (!a.stop) { e.vx = e.face * 1100; if (Math.floor(e.actT / 0.03) !== a.ai) { a.ai = Math.floor(e.actT / 0.03); fxAfterimage(e, '#8a4ad8'); }
          for (const t of ents) if (hittable(e, t) && (t.x - e.x) * e.face > -100 && (t.x - e.x) * e.face < 120 && Math.abs(t.y - e.y) < 70 && t.z < 180) { if (!a.hook.has(t)) { a.hook.add(t); applyHit(e, t, { dmg: T * 0.02, type: 'mag', stun: 0.8, knock: 0, hs: 0.02, sure: true, snd: 'blunt', col: '#e0a0ff', box: null }, { src: e }); }
            if (!t.boss && !(hasSA(t) && t.st !== 'hit')) { t.x = e.x + e.face * 80; t.y = lerp(t.y, e.y, 0.5); } }
          if (Math.abs(e.x - a.x0) >= dist || e.actT > 0.5) { a.stop = true; a.stopT = e.actT; e.vx = 0; e.play('paRoar', true); } }
        if (a.stop && !a.boom && e.actT - a.stopT >= 0.12) { a.boom = true; const x = e.x + e.face * 90; cam.shake = 16; cam.flash = 0.2; cam.flashCol = '#a040ff'; sfx.boom(1.5);
          fxSpr('ghost', x, e.y, 90, { w: 260, dur: 0.6, col: '#9a3ad8', flip: e.face < 0, grow: [0.5, 1.4] }); paBoom(x, e.y, 60, 300); fxShock(x, e.y, 360, PA_COL.dark);
          blast(e, x, e.y, 220, { dmg: T * 28 / 33, type: 'mag', launch: 460, knock: 240, hs: 0.16, big: 2.2, downHit: true, sure: true, snd: 'slash', col: '#e0a0ff' }, { zMax: 240 }); }
        if (a.boom && !a.fin && e.actT - a.stopT >= 0.3) { a.fin = true; const n = a.more && paSpend(e, Math.min(125, paHalf(e) ? 0 : paE(e))) ? 10 : 5, x = e.x + e.face * 90; a.dur = e.actT + 0.12 * n + 0.3;
          for (let i = 0; i < n; i++) game.after(0.12 * i, () => { if (e.dead) return; for (let j = 0; j < 3; j++) paFlameAt(x + rnd(-120, 120), e.y + rnd(-50, 50));
            areaHit(e, x, e.y, 200, 0, { dmg: T / 33, type: 'mag', stun: 0.3, knock: 0, hs: 0.01, downHit: true, snd: 'fire', col: '#d0a0ff' }, { zMax: 200 }); }); } },
      onEnd: e => { e.vy = 0; } }; } });
// 地上一团紫黑火焰
function paFlameAt(x, y) { addFx({ x, y: y + 0.2, z: 0, dur: 0.6, draw(c) { const k = this.t / this.dur; paFlame(c, sx(this.x), sy(this.y, 0), 50 * (1 - k * 0.5), Math.floor(this.t * 14), 1 - k); } }); }
// 永堕：混沌弑神（二觉「永生者」，KR 언홀리 퓨리）：人形施放时先魔化（前摇更长）→ 解放爆炸 → 连锁撕裂 12 次（每次 +11 能量，无视霸体把敌人拉到身前）→ 上撕挑空 → X 形撕裂终结 ×2；
// 连打 X 加速；终结前按住 Z / X 额外消耗最多 100 能量，终结 +35%；按 C 直接跳到终结。全程无敌
defSkill('pa_awaken2', { name: '永堕：混沌弑神', cls: 'priest', job: PA, tier: 2, lvReq: 27, maxLv: 3, sp: 0, mp: 200, cd: 180, pvp: 0.45, awaken: true, type: 'mag', col: '#d02a6a', icon: 'pa_awaken2',
  desc: '【二次觉醒「永生者」的觉醒技】完成二次觉醒任务时自动学会（不花 SP）并放进技能栏（↓↑→→+Z）。（人形施放时先变魔，前摇更长）解放魔气炸开 → 双爪连锁撕裂 12 次（每次回 11 恶魔能量，无视霸体把敌人拉到身前）→ 往上一撕把敌人挑空 → X 形撕裂终结两下（大部分伤害）。连打 X 撕得更快；终结前按住 Z / X 额外消耗最多 100 恶魔能量，终结 +35%；按 C 直接跳到终结。全程无敌。魔化中施放 +35%、前摇更短。',
  pow: lv => skillDmg(32, 9, lv), infoExtra: () => [['爆炸 / 撕裂 / 上撕 / 终结', '1 / 0.72 × 12 / 1.8 / 4.3 × 2'], ['按住终结', '−100 能量，+35%']], ai: { kind: 'awaken', r: [0, 260], dy: 120 },
  act: (lv, p) => { const D = paDemon(p), T = skillDmg(32, 9, lv) * paDmg(p, 'pa_awaken2'), U = T / 20.04, W0 = D ? 0.25 : 0.7;
    return { name: 'pa_awaken2', clip: 'paHunch', dur: W0 + 3.2, noCounter: true, invul: true, superArmor: true, type: 'mag',
      onStart: e => { game.cutin = { t: 0, dur: 1.1, name: '永堕：混沌弑神', who: cutinWho(e, 2) }; game.timeStop = 0.9; sfx.awaken(); const a = e.act; a.n = 0; a.t0 = W0;
        if (!D) { fxText('变魔……', e.x, e.y, e.z + 120, { col: '#ffa0e0', size: 13 }); paRoarSfx(0.6); a.temp = addFx({ ent: e, x: e.x, y: e.y + 0.02, z: 0, dur: W0 + 3.2, draw(c) { const E = this.ent; if (!E.act || E.act.name !== 'pa_awaken2') { this.dur = this.t; return; } paShade(c, E, 'rgba(34,10,52,0.6)', Math.min(1, this.t / 0.4)); } }); } },
      onInput: (e, I) => { const a = e.act; if (I.buffered('attack')) { I.consume('attack'); a.fast = 0.25; } if (!a.skip && a.n < 12 && I.buffered('jump')) { I.consume('jump'); a.skip = true; } return false; },
      update: (e, dt) => { const a = e.act, k = e.actT; if (a.fast > 0) { a.fast -= dt; e.actT += dt * 0.6; }
        const pull = () => { for (const t of ents) if (hittable(e, t) && Math.abs(t.x - e.x) < 420 && Math.abs(t.y - e.y) < 150 && t.z < 260 && !t.boss) { t.x = lerp(t.x, e.x + e.face * 80, 0.35); t.y = lerp(t.y, e.y, 0.3); } };
        const area = (d, o) => { for (const t of ents) if (hittable(e, t) && (t.x - e.x) * e.face > -80 && (t.x - e.x) * e.face < 280 && Math.abs(t.y - e.y) < 110 && t.z < 300) applyHit(e, t, { dmg: d, type: 'mag', sure: true, downHit: true, snd: 'slash', col: '#ff80c0', box: null, ...o }, { src: e }); };
        if (!a.rel && k >= a.t0) { a.rel = true; e.play('paRoar', true); cam.shake = 14; cam.flash = 0.2; cam.flashCol = '#d02a6a'; sfx.boom(1.3); fxBurst(e.x, e.y, e.z + 60, 360, '#d02a6a'); fxShock(e.x, e.y, 360, PA_COL.dark);
          for (let i = 0; i < 8; i++) fxSpr('crossx', e.x + rnd(-120, 120), e.y + rnd(-40, 40), rnd(40, 160), { w: rnd(20, 40), dur: 0.5, col: '#ff3a5a', rot: rnd(0, TAU), grow: [0.3, 1] }); area(U, { stun: 0.6, knock: 0 }); pull(); }
        if (a.rel && a.n < 12 && !a.skip && k >= a.t0 + 0.3 + a.n * 0.12) { a.n++; e.play(a.n % 2 ? 'paSlash' : 'paSlash2', true); e.animT = 0.05; sfx.swing(a.n % 3 === 0); pull();
          paClawFx(e.x + e.face * 90, e.y, e.z + rnd(40, 100), a.n % 2 ? e.face : -e.face, 1.6, a.n % 2 ? '#ff4a9a' : PA_COL.claw); area(U * 0.72, { stun: 0.5, knock: 0, hs: 0.03 }); paGain(e, 11, 'keep'); cam.shake = Math.max(cam.shake, 4); }
        if (a.rel && !a.up && (a.n >= 12 || a.skip) && k >= a.t0 + 0.3 + a.n * 0.12) { a.up = true; a.upT = k; e.play('paUpper', true); paClawFx(e.x + e.face * 90, e.y, e.z + 120, e.face, 2.2); area(U * 1.8, { launch: 560, knock: 20, hs: 0.1 }); sfx.swing(true); }
        if (a.up && !a.fin && k >= a.upT + 0.45) { a.fin = true; const I = e.pad, held = I && (I.is('attack') || I.is(a.key || 'cmd')), extra = held ? Math.min(100, paHalf(e) ? 100 : paE(e)) : 0; if (extra && !paHalf(e)) e._paE -= extra; const mul = 1 + 0.35 * extra / 100;
          cam.shake = 22; cam.flash = 0.2; cam.flashCol = '#ff4a8a'; sfx.boom(1.8); fxText('混沌弑神!', e.x, e.y, e.z + 160, { col: '#ff80c0', size: 22, dur: 1.1 });
          for (const r of [0.8, -0.8]) fxSpr('crossx', e.x + e.face * 150, e.y, 150, { w: 380, h: 60, dur: 0.6, col: '#ff3a6a', rot: r, grow: [0.4, 1.2] });
          area(U * 4.3 * mul, { launch: 520, knock: 60, hs: 0.14, big: 2.4 }); game.after(0.2, () => { if (e.dead) return; fxBurst(e.x + e.face * 150, e.y, 150, 420, '#d02a6a'); area(U * 4.3 * mul, { launch: 600, knock: 360, hs: 0.2, big: 2.8, critBonus: 0.1 }); });
          a.dur = k + 0.8; } } }; } });
// 极恶洪流：头顶生成暗黑球（准备的一瞬闪现真魔化的翅膀）→ 光束横扫前方 3 击 + 终结（地面留下陨坑）；按住技能键额外消耗 125 能量，+20% 并附带光属性。魔化 +30%
defSkill('pa_stream', { name: '极恶洪流', cls: 'priest', job: PA, tier: 3, lvReq: 29, mp: 120, cd: 60, type: 'mag', col: '#9a3ad8', icon: 'pa_stream',
  desc: '在头顶凝聚一颗暗黑球（准备的一瞬间，背后闪现真魔化的翅膀，光与暗汇入球中），射出一道光束横扫前方 3 击，最后轰出终结（地面留下陨坑）。按住技能键额外消耗 125 恶魔能量：伤害 +20%，并附带光属性。魔化：攻击力 +30%；半魔化：不耗能量。',
  pow: lv => skillDmg(24, 2.4, lv), infoExtra: () => [['横扫 : 终结', '1 × 3 : 4.5'], ['射程', '约 650px']], ai: { kind: 'poke', r: [60, 620], dy: 70 },
  act: (lv, p) => { const T = skillDmg(24, 2.4, lv) * paDmg(p, 'pa_stream'), U = T / 7.5;
    return { name: 'pa_stream', clip: 'paCast', dur: 2.0, noCounter: true, superArmor: true, type: 'mag',
      onStart: e => { sfx.charge(); addFx({ ent: e, x: e.x, y: e.y - 0.4, z: 0, dur: 0.6, draw(c) { const E = this.ent, W = paImg('pa_wings'), k = this.t / this.dur; if (W) drawSpr(c, W, sx(E.x), sy(E.y, E.z + 80), 260, 200, { add: false, alpha: 1 - k, ay: 0.55 }); } }); },
      update: e => { const a = e.act, k = e.actT, ox = e.x, oz = e.z + 170;
        if (k < 0.7 && Math.random() < 0.6) fxCharge(e, Math.random() < 0.5 ? '#fff0ff' : PA_COL.dark, 2);
        if (!a.lit && k >= 0.65) { a.lit = true; const I = e.pad; a.boost = !!(I && a.key && I.is(a.key)) && paSpend(e, 125); if (a.boost) fxText('极恶!', e.x, e.y, e.z + 200, { col: '#fff0ff', size: 14 }); }
        for (const [i, t0] of [[1, 0.75], [2, 0.95], [3, 1.15]]) if (!a['s' + i] && k >= t0) { a['s' + i] = true; const x = e.x + e.face * (180 + i * 120); sfx.hit('crit', false);
          fxBeam(ox, e.y, oz, 700, e.face, { img: 'laser', col: i % 2 ? '#b060ff' : '#fff0ff', w: 36, dur: 0.22 }); fxShock(x, e.y, 180, PA_COL.dark);
          instantHit(e, { box: [40, 660, 70, -10, 200], dmg: U * (a.boost ? 1.2 : 1), type: 'mag', elem: a.boost ? 'light' : undefined, stun: 0.5, knock: 30, hs: 0.04, downHit: true, snd: 'crit', col: '#f0d0ff' }); }
        if (!a.fin && k >= 1.4) { a.fin = true; const x = e.x + e.face * 380; cam.shake = 16; cam.flash = 0.2; cam.flashCol = '#f0c0ff'; sfx.boom(1.5);
          fxBeam(ox, e.y, oz, 700, e.face, { img: 'laser', col: '#fff4ff', w: 80, dur: 0.4 }); paBoom(x, e.y, 30, 320); paCracks(x, e.y, 200);
          instantHit(e, { box: [40, 680, 90, -10, 240], dmg: U * 4.5 * (a.boost ? 1.2 : 1), type: 'mag', elem: a.boost ? 'light' : undefined, launch: 480, knock: 200, hs: 0.14, big: 2.2, downHit: true, snd: 'blunt', col: '#fff0ff' }); } },
      events: [evAt(0.1, e => addFx({ ent: e, x: e.x, y: e.y + 0.5, z: 0, dur: 1.7, draw(c) { const E = this.ent, k = this.t; if (!E.act || E.act.name !== 'pa_stream') { this.dur = this.t; return; }
        drawSpr(c, fxTint('darkorb', '#8a2ad8'), sx(E.x), sy(E.y, E.z + 170), 70 + 30 * Math.min(1, k / 0.6), 0, { rot: k * 5 }); drawSpr(c, fxTint('orb', '#fff0ff'), sx(E.x), sy(E.y, E.z + 170), 36, 0, {}); } }))] }; } });
// 末日福音：毁灭之翼（三觉「神启·复仇者」，KR 괴멸의 복음）：进入真·恶魔化 → 撕下一侧翅膀，追踪全场最强的敌人掷出 → 翅膀贯穿把敌人钉在空中 → 急袭 → 拔出翅膀撕开暗黑空间 → 翅膀聚力化作巨大的光之镰刀斩灭
defSkill('pa_awaken3', { name: '末日福音：毁灭之翼', cls: 'priest', job: PA, tier: 3, lvReq: 30, maxLv: 3, sp: 0, mp: 300, cd: 290, pvp: 0.45, awaken: true, type: 'mag', col: '#fff0c0', icon: 'pa_awaken3',
  desc: '【三次觉醒「神启·复仇者」的觉醒技】完成三次觉醒任务时自动学会（不花 SP）并放进技能栏（←↑→↓+Z）。进入真·恶魔化：撕下一侧的翅膀，追踪全场最强的敌人（领主 > 精英 > HP 最高）掷出 → 翅膀贯穿把它钉在空中 → 急袭 → 拔出翅膀撕开暗黑空间 → 翅膀聚力化作一柄巨大的光之镰刀，斩灭前方的一切（2 : 1 : 2.5 : 4.5）。全程无敌；施放中不能用恶魔屏障。魔化中施放 +40%。',
  pow: lv => skillDmg(46, 12, lv), infoExtra: () => [['钉 / 急袭 / 拔翼 / 光镰', '2 / 1 / 2.5 / 4.5'], ['锁定', '全场最强的敌人']], ai: { kind: 'awaken', r: [0, 700], dy: 200 },
  act: (lv, p) => { const T = skillDmg(46, 12, lv) * paDmg(p, 'pa_awaken3'), U = T / 10;
    const strongest = e => { let b = null, bv = -1; for (const t of ents) if (hittable(e, t) && Math.abs(t.x - e.x) < 900) { const v = (t.boss ? 3 : t.elite ? 2 : 1) * 1e9 + (t.hpMax || 0); if (v > bv) { bv = v; b = t; } } return b; };
    const area = (e, x, r, d, o) => { for (const t of ents) if (hittable(e, t) && Math.abs(t.x - x) < r && Math.abs(t.y - e.y) < 170 && t.z < 400) applyHit(e, t, { dmg: d, type: 'mag', sure: true, downHit: true, snd: 'slash', col: '#fff0c0', box: null, ...o }, { src: e }); };
    return { name: 'pa_awaken3', clip: 'paRoar', dur: 3.8, noCounter: true, invul: true, superArmor: true, type: 'mag',
      onStart: e => { game.cutin = { t: 0, dur: 1.2, name: '末日福音：毁灭之翼', who: cutinWho(e, 3) }; game.timeStop = 1.0; sfx.awaken(); paRoarSfx(1); const a = e.act; a.tgt = strongest(e);
        a.big = addFx({ ent: e, x: e.x, y: e.y - 0.6, z: 0, dur: 3.8, draw(c) { const E = this.ent, A = E.act; if (!A || A.name !== 'pa_awaken3') { this.dur = this.t; return; } const k = this.t, dem = paImg('pa_demon'), W = paImg('pa_wings');
          c.save(); c.globalAlpha = Math.min(1, k / 0.4) * 0.55; if (dem) drawSpr(c, dem, sx(E.x - E.face * 20), sy(E.y, E.z) + 8, 0, 300, { add: false, flip: E.face < 0, ay: 1 }); c.restore();
          if (W && !A.torn) drawSpr(c, W, sx(E.x), sy(E.y, E.z + 90), 300, 230, { add: false, ay: 0.55 });
          if (W && A.torn) { c.save(); c.beginPath(); c.rect(E.face > 0 ? sx(E.x) - 200 : sx(E.x), 0, 200, 2000); c.clip(); drawSpr(c, W, sx(E.x), sy(E.y, E.z + 90), 300, 230, { add: false, ay: 0.55 }); c.restore(); }
          c.save(); c.globalCompositeOperation = 'lighter'; drawSpr(c, fxTint('shock', '#fff0c0'), sx(E.x), sy(E.y, E.z + 110), 360 + 30 * Math.sin(k * 4), 360, { rot: k, alpha: 0.35 }); c.restore(); } }); },
      update: e => { const a = e.act, k = e.actT, t = a.tgt && !a.tgt.dead ? a.tgt : null, tx = t ? t.x : e.x + e.face * 300, ty = t ? t.y : e.y;
        if (!a.torn && k >= 0.5) { a.torn = true; cam.shake = 10; sfx.boom(0.9); fxText('……!', e.x, e.y, e.z + 160, { col: '#fff0c0', size: 16 });
          for (let i = 0; i < 12; i++) fxSpr('spark', e.x - e.face * 40 + rnd(-20, 20), e.y, e.z + 100 + rnd(-30, 30), { w: rnd(30, 60), dur: 0.5, col: '#fff0c0' });
          a.wing = { x: e.x, y: e.y, z: e.z + 100, t: 0 }; addFx({ x: e.x, y: e.y + 1, z: 0, dur: 0.5, draw(c) { const kk = this.t / this.dur, W = IMG['fx/pa_lightwing']; const X = lerp(a.wing.x, tx, easeOut(kk)), Z = lerp(a.wing.z, 130, kk);
            this.y = ty + 1; if (W) drawSpr(c, W, sx(X), sy(lerp(a.wing.y, ty, kk), Z), 0, 140, { add: true, rot: e.face * (0.8 + kk * 6) }); } }); }
        if (!a.pin && k >= 1.0) { a.pin = true; if (t) { t.z = Math.max(t.z, 120); t.vz = 0; if (!t.boss) addStatus(t, 'hold', 2.6, { src: e, force: true }); }
          cam.shake = 12; sfx.boom(1.1); fxSpr('crossx', tx, ty, 130, { w: 160, dur: 0.5, col: '#fff0c0', grow: [0.4, 1.2] }); area(e, tx, 160, U * 2, { stun: 1.2, knock: 0 }); }
        if (!a.dash && k >= 1.45) { a.dash = true; fxAfterimage(e, '#b060ff'); const x0 = e.x; e.face = Math.sign(tx - e.x) || e.face; e.x = clamp(tx - e.face * 90, game.room ? game.room.x0 + 30 : -1e9, game.room ? game.room.x1 - 30 : 1e9); e.y = ty;
          fxStreak({ x: (x0 + e.x) / 2, y: e.y, z: e.z + 70, face: e.face, len: Math.abs(e.x - x0) + 100, w: 30, col: '#b060ff', dur: 0.3 }); e.play('paStab', true); sfx.swing(true); paClawFx(tx, ty, 120, e.face, 2); area(e, tx, 180, U, { stun: 1, knock: 0 }); }
        if (!a.rip && k >= 1.95) { a.rip = true; e.play('paGrab', true); cam.shake = 16; cam.flash = 0.2; cam.flashCol = '#40104a'; sfx.boom(1.3);
          fxSpr('darkorb', tx, ty, 130, { w: 380, h: 260, dur: 0.8, col: '#2a0a3a', grow: [0.3, 1.2], add: false }); fxSpr('crossx', tx, ty, 130, { w: 420, h: 80, dur: 0.6, col: '#ff3a8a', rot: 0.3, grow: [0.3, 1.2] }); area(e, tx, 240, U * 2.5, { stun: 1, knock: 0 }); }
        if (!a.scythe && k >= 2.5) { a.scythe = true; e.play('paSlash2', true); cam.shake = 26; cam.flash = 0.2; cam.flashCol = '#fff8e0'; sfx.boom(2); fxText('毁灭之翼!', e.x, e.y, e.z + 180, { col: '#fff0c0', size: 24, dur: 1.2 });
          addFx({ x: e.x, y: e.y + 2, z: 0, dur: 0.8, f: e.face, draw(c) { const kk = this.t / this.dur, S = IMG['fx/pa_lightscythe'], X = sx(this.x + this.f * 160), Y = sy(this.y, 180); if (S) drawSpr(c, S, X, Y, 0, 460, { add: false, flip: this.f < 0, rot: this.f * (-1.4 + 2.4 * easeOut(Math.min(1, kk * 2))), alpha: 1 - kk * kk }); } });
          fxSlashOn(e, { a0: -2.9, a1: 1.8, r: 340, w: 80, off: [60, 90], col: '#fff0c0', heavy: true, dur: 0.35 }); fxShock(e.x + e.face * 200, e.y, 600, '#fff0c0'); fxShock(e.x + e.face * 200, e.y, 360, PA_COL.dark);
          for (const o of ents) if (o.status && o.status.hold && o.status.hold.src === e) delete o.status.hold;
          for (const o of ents) if (hittable(e, o) && (o.x - e.x) * e.face > -200 && (o.x - e.x) * e.face < 700 && Math.abs(o.y - e.y) < 200 && o.z < 420) applyHit(e, o, { dmg: U * 4.5, type: 'mag', launch: 620, knock: 420, hs: 0.24, big: 3, critBonus: 0.1, sure: true, downHit: true, snd: 'slash', col: '#fff8e0', box: null }, { src: e }); } } }; } });

/* ---- 化魔（高痛之喜）在复仇者下的改写：没有施放动作（可以在别的技能中放），第一次手动放完以后每 8 秒自动施放；
   每次：HP 换 MP、恶魔能量 +、魔化持续 +7.3 秒、魔化冷却 −21 秒、必定触发幻听 ---- */
function paRaptureDo(p) {
  const hp = Math.round(p.hpMax * P_RAPTURE.hp), mp = Math.round(p.mpMax * P_RAPTURE.mp); p.hp = Math.max(1, p.hp - hp); p.mp = Math.min(p.mpMax, p.mp + mp);
  paGain(p, 60 + 5 * Math.max(1, skLv(p, 'pa_devil')), 'keep');
  if (p.buffs.pa_demon) { p.buffs.pa_demon.t = Math.min(50, p.buffs.pa_demon.t + 7.3); if (p.cool.pa_awaken > 0) p.cool.pa_awaken = Math.max(0, p.cool.pa_awaken - 21); }
  const ec = skLv(p, 'pa_echo'); if (ec) p.buffs.pa_echoB = { t: 30, mspd: 0.02 * ec, name: '幻听', col: '#9a6ad8' };
  addNumber(mp, p.x, p.y, p.z + 20, { col: '#7ac8ff' }); fxSpr('darkorb', p.x, p.y, p.z + 60, { w: 70, dur: 0.4, col: P_COL.blood, alpha: 0.7, grow: [0.6, 1.2] }); fxText('化魔', p.x, p.y, p.z + 110, { col: '#ff9ab8', size: 10, dur: 0.5 });
}
defSkill('pa_rapture', { name: '化魔', cls: 'priest', job: PA, lvReq: 15, lvFrom: 'p_rapture', maxLv: 1, hidden: true, mp: 0, cd: 8, type: 'mag', col: '#b04a6a', icon: 'p_rapture',
  desc: '复仇者的化魔：没有施放动作（其他技能施放中也能用）；第一次手动施放以后每 8 秒自动施放。每次：消耗 3% 最大 HP、回复 6% 最大 MP，恶魔能量 +65 以上，魔化持续 +7.3 秒、魔化冷却 −21 秒，必定触发幻听。',
  instant: (lv, p, extra) => { p._paAuto = 1; paRaptureDo(p); p.cool.p_rapture = p.cool.pa_rapture; sfx.charge();
    if (!(p.st === 'act' && p.act && !p.act.basic)) p.doAct({ name: 'p_rapture', clip: 'paPray', dur: 0.25, noCounter: true }, { ...extra, skill: 'p_rapture' }); } });   // 站着施放时做一个很短的动作（队友那边的影子也能看到）；技能中施放没有动作
// 改形：复仇者按化魔键 = pa_rapture；魔化中空斩打键 = 恶魔之爪（S.morph 包一层；基础技能还没定义时跳过）
function paMorph(id, to) { const S = SKILLS[id]; if (!S || S._paMorph) return; const m0 = S.morph; S._paMorph = true; S.morph = p => (paOn(p) && to(p)) || (m0 ? m0(p) : null); }
function paPatchBase() { paMorph('p_rapture', () => 'pa_rapture'); paMorph('p_launcher', p => paDemon(p) ? 'pa_claw' : null); }
paPatchBase();
// 魔化中不能被抓（官方：全程霸体、不能被抓，不是无敌）
PRIEST_HOOKS.beforeHurt.push((p, a, h) => paOn(p) && paDemon(p) && h && h.grab ? { block: true } : null);

/* ---- 觉醒自动学会（魔化 / 审判 / 恶魔屏障 / 恶之再临 一觉时，混沌弑神 二觉时，毁灭之翼 三觉时；0 SP，觉醒技等级随角色等级提升）---- */
const PA_AUTO = [['pa_awaken', 1, true], ['pa_execute', 1, false], ['pa_barrier', 1, false], ['pa_rebirth', 1, false], ['pa_awaken2', 2, true], ['pa_awaken3', 3, true]];
function paAutoAwaken(p) {
  if (p.kit || !game.skillLv || !game.skillBar || (typeof isHuman === 'function' && !isHuman(p))) return;
  const got = [];
  for (const [id, tier, grow] of PA_AUTO) { const S = SKILLS[id]; if (!S || !tierUnlocked(tier) || game.lvl < S.lvReq) continue;
    const cur = game.skillLv[id] || 0, want = grow ? Math.min(S.maxLv || 1, 1 + Math.floor((game.lvl - S.lvReq) / (S.lvStep || 1))) : 1;
    if (cur >= want) continue; game.skillLv[id] = want;
    if (!cur) { got.push(S.name); if (!S.passive && !game.skillBar.includes(id)) { const k = game.skillBar.indexOf(null); if (k >= 0) game.skillBar[k] = id; } } }
  if (got.length) { toastMsg(`觉醒：自动学会 ${got.join('、')}（主动技能已放进技能栏）`, '#c080ff'); if (typeof save !== 'undefined' && save.write) save.write(); }
}

/* ---- 被动效果（每 0.25 秒；hide = 不在 HUD 上显示图标）：半魔化流失、魔化的外观 / 霸体 / 结束、化魔自动施放、镰刀精通、各种被动 ---- */
const PA_PSV = ['pa_devil', 'pa_scythe', 'pa_echo', 'pa_nightmare', 'pa_evil', 'pa_righteous'];
CLASSES.priest.passives.push(p => {
  if (!paOn(p)) { for (const id of PA_PSV) setPassive(p, id, false); if (p._paD) { p._paD = 0; p.scale = p._paScale0 || 1; delete p.buffs.pa_demon; } return; }
  paPatchBase(); paAutoAwaken(p); paHudHook(); paCoopHook();
  const L = id => skLv(p, id);
  // 魔化：外观、霸体；BUFF 到时间了 → 体型 / 普攻复原
  if (paDemon(p)) { p.superArmor = Math.max(p.superArmor, 0.3); paDemonFx(p); if (p.scale !== PA_SCALE) { p._paScale0 = p.scale || 1; p.scale = PA_SCALE; } p._paD = 1; }
  else if (p._paD) { p._paD = 0; p.scale = p._paScale0 || 1; p.acts = priestActs(p); fxBurst(p.x, p.y, p.z + 60, 200, PA_COL.dark); fxText('魔化结束', p.x, p.y, p.z + 90, { col: '#d0b0e0', size: 12 }); }
  // 半魔化：每 1.29 秒 −15 能量，归零解除
  if (paHalf(p)) { paHalfFx(p); const B = p.buffs.pa_half; B.drainT = (B.drainT || 0) + 0.25; while (B.drainT >= 1.29) { B.drainT -= 1.29; p._paE = Math.max(0, paE(p) - 15); } if (paE(p) <= 0) paHalfEnd(p, '恶魔能量耗尽'); }
  // 化魔：第一次手动施放后每 8 秒自动（城镇里不放）
  if (p._paAuto && game.scene !== 'town' && !(p.cool.pa_rapture > 0) && !p.dead && hasSkill(p, 'p_rapture')) { paRaptureDo(p); p.cool.pa_rapture = p.cool.p_rapture = SKILLS.pa_rapture.cd; }
  // 镰刀精通：装镰刀时魔攻 / 攻速 / 魔暴 +，暗抗 +、光抗 −（按原值改，不累加）
  const sc = L('pa_scythe'), scy = sc > 0 && wtypeOf(p) === 'scythe';
  setPassive(p, 'pa_scythe', scy, { atk: 0.02 * sc, aspd: 0.02 * sc, crit: 0.025 * sc, hide: true });
  if (p.res && p.res !== p._paResRef) { p._paResRef = p.res; p._paRes0 = { dark: p.res.dark || 0, light: p.res.light || 0 }; }
  if (p._paResRef) { p.res.dark = p._paRes0.dark + (scy ? 6 * sc : 0); p.res.light = p._paRes0.light - (scy ? 3 * sc : 0); }
  setPassive(p, 'pa_devil', L('pa_devil') > 0, { hide: true });
  setPassive(p, 'pa_echo', L('pa_echo') > 0, { atk: 0.012 * L('pa_echo'), hide: true });
  setPassive(p, 'pa_nightmare', L('pa_nightmare') > 0, { dmg: 0.008 * L('pa_nightmare'), hide: true });
  setPassive(p, 'pa_evil', L('pa_evil') > 0, { dmg: 0.02 * L('pa_evil'), hide: true });
  setPassive(p, 'pa_righteous', L('pa_righteous') > 0, { dmg: 0.03 * L('pa_righteous'), hide: true });
});

/* ---- 组队：复仇者的状态同步到队友那边的影子（魔化 / 半魔化 / 屏障 / 能量；影子上的 BUFF 以本人为准，换房间后外观由这里补回来）----
   队友出招本来就会在影子上重放（变身动作的事件里就会给影子挂上魔化 BUFF 和外观），这里补上化魔续时 / 提前解除 / 换房间这些不出招的变化 */
function paCoopState(p) { const D = p.buffs.pa_demon; return { d: D ? Math.max(1, Math.round(D.t)) : 0, h: paHalf(p) ? 1 : 0, b: p.buffs.pa_barrier ? 1 : 0, e: Math.round(paE(p)) }; }
function paCoopApply(g, d) {
  const B = g.buffs || (g.buffs = {});
  if (d.d > 0) { if (!B.pa_demon) { B.pa_demon = { t: d.d + 1, name: '魔化', col: '#9a3ad8', ghost: true }; g._paScale0 = g.scale || 1; } else B.pa_demon.t = d.d + 1; g.scale = PA_SCALE; paDemonFx(g); }
  else if (B.pa_demon) { delete B.pa_demon; g.scale = g._paScale0 || 1; }
  if (d.h) { if (!B.pa_half) B.pa_half = { t: 1e9, ghost: true }; paHalfFx(g); } else delete B.pa_half;
  if (d.b) B.pa_barrier = B.pa_barrier || { t: 2, ghost: true }; else delete B.pa_barrier;
  g._paE = clamp(+d.e || 0, 0, PA_EMAX);
}
function paCoopHook() {
  if (paCoopHook.on || typeof coop === 'undefined' || !coop.send || !coop.onMateState) return; paCoopHook.on = true;
  const send0 = coop.send; coop.send = function (m, to) { if (m && m.k === 'p' && this.state === 'play') { const p = game.player; if (p && paOn(p)) m.pa = paCoopState(p); } return send0.call(this, m, to); };
  const st0 = coop.onMateState; coop.onMateState = function (uid, d, recvT) { st0.call(this, uid, d, recvT); const g = this.mates.get(uid); if (g && d && d.pa && typeof d.pa === 'object') coopSafe(() => paCoopApply(g, d.pa)); };
}
bus.on('coopStart', paCoopHook);

/* ---- 登记（转职元数据在 priest.js；这里写技能 / 指令 / 动作 / 觉醒技 id）---- */
{ const J = CLASSES.priest.jobs.avenger;
  Object.assign(J, { art: 'job/avenger', awaken: 'pa_awaken', awaken2: 'pa_awaken2', awaken3: 'pa_awaken3', auto: ['pa_devil', 'pa_heavy'] });
  Object.assign(J.anims, PA_ANIMS);
  J.skills.push('pa_devil', 'pa_heavy', 'pa_meta', 'pa_render', 'pa_mine', 'pa_scythe', 'pa_cutter', 'pa_fall', 'pa_thorn', 'pa_echo', 'pa_wheel', 'pa_fist', 'pa_reaper', 'pa_authority',
    'pa_nightmare', 'pa_awaken', 'pa_claw', 'pa_execute', 'pa_barrier', 'pa_rebirth', 'pa_rapture', 'pa_gate', 'pa_disaster', 'pa_evil', 'pa_howl', 'pa_smite', 'pa_awaken2', 'pa_righteous', 'pa_stream', 'pa_awaken3');
  // 指令（官方默认指令；黑暗之触旧版和恶魔之拳同为 ↓↓+Z，本作改成 ↓←+Z）
  CLASSES.priest.cmds.push(['df', 'pa_meta', 'buff'], ['dfub', 'pa_render', 'buff'], ['fu', 'pa_mine'], ['ubdf', 'pa_cutter', 'buff'], ['uu', 'pa_thorn'], ['uf', 'pa_wheel'], ['dd', 'pa_fist'],
    ['db', 'pa_reaper'], ['fbf', 'pa_authority'], ['fd', 'pa_fall', 'buff'], ['uudd', 'pa_awaken'], ['bf', 'pa_execute'], ['dd', 'pa_barrier', 'attack'], ['fbdf', 'pa_gate'], ['fbuf', 'pa_disaster'],
    ['duf', 'pa_howl'], ['dff', 'pa_smite'], ['duff', 'pa_awaken2'], ['uff', 'pa_stream'], ['bufd', 'pa_awaken3']); }
