/* =====================================================================
   驱魔师（二）：式神系（朱雀 / 玄武 / 白虎 / 青龙 —— 现版都是“出现一次、攻击、离开”，不是常驻召唤兽）、升龙·开阵、
   三次觉醒技（四座千泰门 / 真龙焚天 / 雷鸣怒海·火啸山崩）、式神灭却·合、二 / 三觉被动、觉醒自动学会、被动刷新、登记
   式神 = 召唤框架的 field（game/summon.js）：技能动作的事件里生成，所以队友那边重放动作时影子上也会出现同一只式神（只是表现，不结算伤害）
   共鸣（式神之悟）：式神技能写成 instant —— 巨兵系技能施放中直接生成（没有施放动作、不打断当前技能）；平时照常做 0.42 秒的召唤动作（act）
   ===================================================================== */
// 式神技能的施放：act = 召唤动作（事件里生成式神）；instant = 共鸣时直接生成，否则做召唤动作
function peShikiDef(id, S, spawn) {
  const act = (lv, p) => ({ name: id, clip: 'peSummon', dur: 0.42, noCounter: true,
    events: [evAt(0.02, e => { peTalisman(e, 2); fxCharge(e, S.col, 2); sfx.charge(); }), evAt(0.16, e => { spawn(e, lv); fxSpr('rune', e.x + e.face * 40, e.y, 2, { w: 120, h: 44, dur: 0.4, col: S.col, grow: [0.4, 1] }); })] });
  defSkill(id, { cls: 'priest', job: PE, ...S, act,
    req: p => (p.st === 'act' && p.act && !p.act.basic && !peResOk(p)) ? '施放中不能用' : true,
    instant: (lv, p, extra) => {
      if (peResOk(p)) { const r = peRes(p); if (r.n >= 2) r.last = game.t; r.n--; spawn(p, lv); fxText('共鸣', p.x, p.y, p.z + 90, { col: S.col, size: 11, dur: 0.5 }); peTalisman(p, 1); return; }
      p.doAct(act(lv, p), extra); } });
}
// 式神在场的通用绘制：淡入 / 淡出（k0 秒淡入、最后 k1 秒淡出）
const peFade = (s, k0 = 0.12, k1 = 0.25) => clamp(Math.min(s.lifeT / k0, (s.life - s.lifeT) / k1), 0, 1);

/* ---- 式神：热炎朱雀（↑→→+Z）：朱雀裹着火焰旋风往前冲（4 段，把敌人带着走），再往上飞起爆炸；555% × 4 : 3333% ---- */
defSummon('pe_suzaku_s', { kind: 'field', life: 1.25, max: 3, over: 'oldest', keepRoom: false, col: PE_COL.fire,
  onSpawn: s => { s.x0 = s.x; s.z = 60; s.n = 0; s.carry = new Set(); },
  update: s => { const k = s.lifeT, R = game.room;
    if (k < 0.55) { s.x = s.x0 + s.face * 430 * easeOut(k / 0.55); if (R) s.x = clamp(s.x, R.x0 + 20, R.x1 - 20); } else if (!s.boom) s.z = 60 + (k - 0.55) * 260;
    const TT = [0.08, 0.2, 0.32, 0.44];
    while (s.n < 4 && k >= TT[s.n]) { s.n++; sfx.hit('fire', false);
      for (const t of ents) if (foe(s.owner, t) && t.invul <= 0 && Math.abs(t.x - s.x) < 95 && Math.abs(t.y - s.y) < 65 && t.z < 170) {
        summonHit(s, t, { dmg: s.per, stun: 0.45, knock: 0, airLift: 40, hs: 0.03, downHit: true, snd: 'fire', col: '#ffb070' }); s.carry.add(t); } }
    if (!s.boom) for (const t of s.carry) if (!t.dead && peMovable(t)) { t.x = s.x + s.face * 30; t.y = lerp(t.y, s.y, 0.3); }   // 朱雀冲锋把敌人卷在火焰旋风里一起带走
    if (!s.boom && k >= 0.78) { s.boom = true; cam.shake = Math.max(cam.shake, 6); sfx.boom(0.8); fxSpr('explosion', s.x, s.y, s.z, { w: 260, dur: 0.5, grow: [0.4, 1.2] }); fxShock(s.x, s.y, 220, PE_COL.fire);
      summonArea(s, s.x, s.y, 175, { dmg: s.fin, launch: 480, knock: 120, hs: 0.08, downHit: true, big: 1.5, snd: 'fire', col: '#ffb070' }, { zMax: 260 }); } },
  drawUpright(c, s) { if (s.boom && s.lifeT > 0.9) return; const a = peFade(s, 0.08, 0.1), X = sx(s.x), Y = sy(s.y, s.z), t = s.lifeT;
    c.save(); c.globalAlpha = a; c.globalCompositeOperation = 'lighter';
    drawSpr(c, fxTint('slash', PE_COL.fire), X, Y, 170, 90, { rot: -t * 16, alpha: 0.8 }); drawSpr(c, fxTint('slash', '#ffd070'), X, Y, 130, 70, { rot: t * 12 + 1, alpha: 0.6 }); drawSpr(c, 'flame', X - s.face * 50, Y + 10, 120, 70, { flip: s.face < 0, alpha: 0.8 });
    c.restore(); c.save(); c.globalAlpha = a; peBeast(c, 'pe_suzaku', X, Y + 50, 110, { flip: s.face < 0, ay: 0.9 }); c.restore(); } });
peShikiDef('pe_suzaku', { name: '式神：热炎朱雀', lvReq: 17, mp: 40, cd: 8, col: '#ff6a2a', icon: 'pe_suzaku',
  desc: '召唤朱雀（施放 0.3 秒）：朱雀裹着火焰旋风往前冲（4 段，把路上的敌人带着走），然后向上飞起爆炸。看起来是火，但不是火属性。可以在普攻中施放；学了式神之悟后，巨兵系技能施放中可以用“共鸣”瞬发。',
  pow: lv => skillDmg(4, 0.4, lv), infoExtra: () => [['冲刺 × 4 : 爆炸', '555% × 4 : 3333%'], ['冲刺距离', '430px']], ai: { kind: 'poke', r: [0, 420], dy: 50 } },
  (e, lv) => { const s = summon(e, 'pe_suzaku_s', { x: e.x + e.face * 30, y: e.y }); if (!s) return; const T = skillDmg(4, 0.4, lv); s.per = T * 0.1; s.fin = T * 0.6; });

/* ---- 式神：地之玄武（↑→+Z）：玄武往前方伸手做出一片旋转碎石的区域，竖起一根手指：区域里所有敌人强制硬直；碎石 10 段（每 0.3 秒，式神之悟 0.2 秒）---- */
defSummon('pe_genbu_s', { kind: 'field', life: 3.8, max: 1, over: 'oldest', keepRoom: false, col: PE_COL.earth, r: 175, zMax: 200,
  onSpawn: s => { s.n = 0; s.tx = s.x - s.face * 150; },
  update: s => { const k = s.lifeT, iv = skLv(s.owner, 'pe_general') ? 0.2 : 0.3;
    if (!s.held && k >= 0.45) { s.held = true; sfx.boom(0.6); fxText('定!', s.x, s.y, 140, { col: '#e8c080', size: 14 }); fxShock(s.x, s.y, 360, PE_COL.earth);
      for (const t of ents) if (foe(s.owner, t) && t.invul <= 0 && inGround(t, s.x, s.y, s.sdef.r)) { addStatus(t, 'hold', 3.2, { src: s.owner }); pePull(t, s.x, s.y, 0.3); } }
    while (s.held && s.n < 10 && k >= 0.5 + s.n * iv) { s.n++; sfx.hit('blunt', false);
      summonArea(s, s.x, s.y, s.sdef.r, { dmg: s.per, stun: 0.3, knock: 0, hs: 0.02, downHit: true, snd: 'blunt', col: '#e8c080' }, { zMax: 200 });
      fxSpr('rock', s.x + rnd(-120, 120), s.y + rnd(-30, 30), rnd(20, 90), { w: rnd(22, 36), dur: 0.35, add: false, spin: rnd(-8, 8), grow: [1, 0.5] }); } },
  draw(c, s) { const a = peFade(s, 0.2, 0.4), X = sx(s.x), Y = sy(s.y, 0);
    c.save(); c.globalAlpha = a * 0.75; drawSpr(c, fxTint('rune', PE_COL.earth), X, Y, s.sdef.r * 2.3, s.sdef.r * 2.3 * GR, { ground: true, rot: s.lifeT * 0.6 }); c.restore(); },
  drawUpright(c, s) { const a = peFade(s, 0.2, 0.4), t = s.lifeT;
    c.save(); c.globalAlpha = a;
    for (let i = 0; i < 8; i++) { const ang = t * 2.4 + i / 8 * TAU, r = s.sdef.r * (0.55 + 0.35 * ((i % 3) / 2));
      drawSpr(c, 'rock', sx(s.x + Math.cos(ang) * r), sy(s.y + Math.sin(ang) * r * GR, 40 + 50 * Math.abs(Math.sin(ang * 1.3 + i))), 22 + (i % 3) * 7, 0, { add: false, rot: t * 5 + i }); }
    peBeast(c, 'pe_genbu', sx(s.tx), sy(s.y, 0), 120, { flip: s.face < 0 }); c.restore(); } });
peShikiDef('pe_genbu', { name: '式神：地之玄武', lvReq: 18, mp: 65, cd: 8, col: '#c8964a', icon: 'pe_genbu', pre: { pe_suzaku: 1 },
  desc: '召唤玄武：玄武往前方伸手，做出一片旋转碎石的区域，竖起一根手指——区域里所有的敌人强制硬直（霸体也打断；领主时间缩短），碎石接连砸 10 下。出手前有一点预备时间。可以在普攻中施放；式神之悟：共鸣瞬发、碎石间隔 0.3 → 0.2 秒。需要式神：热炎朱雀 Lv1。',
  pow: lv => skillDmg(4, 0.4, lv), infoExtra: () => [['段数', '10'], ['区域半径', '175px'], ['强制硬直', '3.2 秒']], ai: { kind: 'aoe', r: [60, 360], dy: 70 } },
  (e, lv) => { const s = summon(e, 'pe_genbu_s', { x: e.x + e.face * 230, y: e.y }); if (!s) return; s.per = skillDmg(4, 0.4, lv) / 10; });

/* ---- 式神：空之白虎（↓←+Z）：白虎在前方放下“空之珠”，化作雷电区域：固定 8 道落雷（每 0.3 秒），每道只打一个目标，在敌人之间轮流；二觉被动范围 +10% ---- */
defSummon('pe_byakko_s', { kind: 'field', life: 3.0, max: 1, over: 'oldest', keepRoom: false, col: PE_COL.thunder,
  onSpawn: s => { s.n = 0; s.hits = new Map(); s.r = 210 * (skLv(s.owner, 'pe_kouryu') ? 1.1 : 1); s.tx = s.x - s.face * 170; },
  update: s => { const k = s.lifeT;
    while (s.n < 8 && k >= 0.45 + s.n * 0.3) { s.n++;
      const L = ents.filter(t => foe(s.owner, t) && t.invul <= 0 && inGround(t, s.x, s.y, s.r) && t.z < 260).sort((a, b) => (s.hits.get(a.id) || 0) - (s.hits.get(b.id) || 0) || Math.abs(a.x - s.x) - Math.abs(b.x - s.x));
      const t = L[0], x = t ? t.x : s.x + rnd(-s.r * 0.6, s.r * 0.6), y = t ? t.y : s.y + rnd(-30, 30);
      if (t) { s.hits.set(t.id, (s.hits.get(t.id) || 0) + 1); summonHit(s, t, { dmg: s.per, stun: 0.45, knock: 0, hs: 0.05, downHit: true, snd: 'crit', col: '#dff0ff' }); }
      cam.shake = Math.max(cam.shake, 3); sfx.zap();
      addFx({ x, y: y + 2, z: 0, dur: 0.28, flip: Math.random() < 0.5, draw(c) { const kk = this.t / this.dur, X = sx(this.x), Y = sy(this.y, 0), al = kk < 0.15 ? 1 : 1 - (kk - 0.15) / 0.85;
        drawSpr(c, fxTint('lightning', '#bfe6ff'), X, Y + 6, 60, Y + 30, { ay: 1, flip: this.flip !== (Math.floor(this.t * 40) % 2 === 1), alpha: al }); drawSpr(c, 'spark', X, Y - 8, 80 * (0.6 + kk), 0, { alpha: al }); } });
      fxShock(x, y, 70, '#dff0ff'); } },
  draw(c, s) { const a = peFade(s, 0.3, 0.3); c.save(); c.globalAlpha = a * 0.6; drawSpr(c, fxTint('hexagram', '#9fd8ff'), sx(s.x), sy(s.y, 0), s.r * 2, s.r * 2 * GR, { ground: true, rot: -s.lifeT }); c.restore(); },
  drawUpright(c, s) { const a = peFade(s, 0.2, 0.3), t = s.lifeT, X = sx(s.x), Y = sy(s.y, 120 + Math.sin(t * 4) * 6);
    c.save(); c.globalAlpha = a; drawSpr(c, fxTint('orb', '#bfe6ff'), X, Y, 70 + 10 * Math.sin(t * 12), 0, {}); drawSpr(c, fxTint('thunderbolt', '#dff0ff'), X, Y, 90, 0, { rot: t * 6, alpha: 0.6 });
    if (t < 1.2) { c.globalAlpha = a * clamp((1.2 - t) / 0.3, 0, 1); peBeast(c, 'pe_byakko', sx(s.tx), sy(s.y, 0), 115, { flip: s.face < 0 }); } c.restore(); } });
peShikiDef('pe_byakko', { name: '式神：空之白虎', lvReq: 19, mp: 65, cd: 16.5, col: '#bfe6ff', icon: 'pe_byakko', pre: { pe_genbu: 1 },
  desc: '召唤白虎：白虎在前方放下一颗“空之珠”，化作一片雷电区域，接连落下 8 道落雷。每道落雷只打一个目标，在区域里的敌人之间轮流（只有一个敌人时 8 道都打它）。驱魔的主力伤害技能。可以在普攻中施放；式神契结：真龙 使范围 +10%。需要式神：地之玄武 Lv1。',
  pow: lv => skillDmg(7, 0.7, lv), infoExtra: () => [['落雷', '8 道 × 2109%'], ['区域半径', '210px']], ai: { kind: 'aoe', r: [80, 380], dy: 80 } },
  (e, lv) => { const s = summon(e, 'pe_byakko_s', { x: e.x + e.face * 250, y: e.y }); if (!s) return; s.per = skillDmg(7, 0.7, lv) / 8; });

/* ---- 式神：幻海青龙（←↓→+Space）：青龙在身后出现，挥着巨兵往前冲、连砍 3 下，跃起一记终结重砸（水花），然后得意地消失；1 : 2 : 2 : 5 ---- */
defSummon('pe_seiryu_s', { kind: 'field', life: 1.75, max: 1, over: 'oldest', keepRoom: false, col: PE_COL.water,
  onSpawn: s => { s.x0 = s.x; s.n = 0; s.z = 0; s.carry = new Set(); },
  update: s => { const k = s.lifeT, R = game.room;
    if (k < 0.95) s.x = s.x0 + s.face * 470 * (k / 0.95); else if (k < 1.25) { s.z = Math.sin((k - 0.95) / 0.3 * Math.PI) * 110; s.x = s.x0 + s.face * (470 + 90 * (k - 0.95) / 0.3); }
    if (R) s.x = clamp(s.x, R.x0 + 20, R.x1 - 20);
    const TT = [0.25, 0.5, 0.75], W = [1, 2, 2];
    while (s.n < 3 && k >= TT[s.n]) { const i = s.n++; sfx.swing(true); fxSlash({ x: s.x, y: s.y, z: 0, face: s.face, a0: i % 2 ? 1.2 : -2.2, a1: i % 2 ? -2.2 : 1.2, r: 120, w: 26, off: [20, 60], col: '#8ad8ff', heavy: true });
      for (const t of ents) if (foe(s.owner, t) && t.invul <= 0 && (t.x - s.x) * s.face > -40 && Math.abs(t.x - s.x) < 190 && Math.abs(t.y - s.y) < 75 && t.z < 200)
        { summonHit(s, t, { dmg: s.U * W[i], stun: 0.5, knock: 0, airLift: 80, hs: 0.05, downHit: true, snd: 'slash', col: '#bfe6ff' }); s.carry.add(t); } }
    if (!s.slam) for (const t of s.carry) if (!t.dead && peMovable(t)) { t.x = s.x + s.face * 90; t.y = lerp(t.y, s.y, 0.2); }   // 青龙一路砍一路把敌人往前推
    if (!s.slam && k >= 1.25) { s.slam = true; s.z = 0; cam.shake = Math.max(cam.shake, 8); sfx.boom(0.9); const x = s.x + s.face * 60;
      fxSpr('wave', x - 50, s.y, 40, { h: 220, dur: 0.45, col: '#4ab8ff', grow: [0.5, 1.3] }); fxSpr('wave', x + 50, s.y, 40, { h: 220, dur: 0.45, col: '#4ab8ff', flip: true, grow: [0.5, 1.3] }); fxShock(x, s.y, 300, '#4ab8ff'); fxShock(x, s.y, 160, '#dff4ff');
      summonArea(s, x, s.y, 210, { dmg: s.U * 5, launch: 460, knock: 140, hs: 0.1, big: 1.8, downHit: true, snd: 'blunt', col: '#bfe6ff' }, { zMax: 240 }); } },
  drawUpright(c, s) { const a = peFade(s, 0.12, 0.3); c.save(); c.globalAlpha = a; if (s.lifeT < 0.95) drawSpr(c, fxTint('wave', '#4ab8ff'), sx(s.x - s.face * 50), sy(s.y, 30), 0, 110, { rot: s.face * Math.PI / 2, alpha: 0.5 });
    peBeast(c, 'pe_seiryu', sx(s.x), sy(s.y, s.z), 150, { flip: s.face < 0 }); c.restore(); } });
peShikiDef('pe_seiryu', { name: '式神：幻海青龙', tier: 1, lvReq: 23, mp: 100, cd: 30, col: '#4ab8ff', icon: 'pe_seiryu', pre: { pe_byakko: 1 },
  desc: '召唤青龙：青龙在你身后出现，挥着巨兵往前冲，连砍 3 下，再跃起一记终结重砸（1 : 2 : 2 : 5），然后得意地消失。水花只是特效，不是水属性。可以在普攻中施放；式神之悟：共鸣瞬发。需要式神：空之白虎 Lv1。',
  pow: lv => skillDmg(11, 1.1, lv), infoExtra: () => [['段数', '4（1 : 2 : 2 : 5）'], ['冲锋距离', '约 560px']], ai: { kind: 'poke', r: [0, 480], dy: 60 } },
  (e, lv) => { const s = summon(e, 'pe_seiryu_s', { x: e.x - e.face * 90, y: e.y }); if (!s) return; s.U = skillDmg(11, 1.1, lv) / 10; fxSpr('wave', s.x, s.y, 30, { h: 160, dur: 0.4, col: '#4ab8ff', grow: [0.3, 1] }); });

/* ---- 升龙·开阵（←→→+Z）：在前方展开黄龙升天的法阵，吸住阵里的敌人，黄龙从阵中心冲天而起（20 段），再倒栽下来砸回地面；两部分各约一半 ---- */
defSummon('pe_pentacle_s', { kind: 'field', life: 2.25, max: 1, over: 'oldest', keepRoom: false, col: PE_COL.dragon, r: 190,
  onSpawn: s => { s.n = 0; },
  update: s => { const k = s.lifeT;
    for (const t of ents) if (foe(s.owner, t) && inGround(t, s.x, s.y, s.sdef.r * 1.5) && k < 1.6) pePull(t, s.x, s.y, 0.04);
    while (s.n < 20 && k >= 0.1 + s.n * 0.05) { s.n++; summonArea(s, s.x, s.y, s.sdef.r, { dmg: s.rise, stun: 0.3, knock: -20, airLift: 70, hs: 0.01, downHit: true, snd: 'crit', col: '#fff0a0' }, { zMax: 320 }); }
    if (!s.crash && k >= 1.6) { s.crash = true; cam.shake = Math.max(cam.shake, 12); cam.flash = 0.12; cam.flashCol = '#fff0a0'; sfx.boom(1.2); peSlamFx(s.x, s.y, 300, PE_COL.dragon, 1.6);
      fxSpr('aura', s.x, s.y, 0, { h: 380, w: 160, ay: 1, dur: 0.5, col: '#ffe070', grow: [1.2, 0.6] });
      summonArea(s, s.x, s.y, s.sdef.r * 1.15, { dmg: s.fin, launch: 520, knock: 60, hs: 0.14, big: 2.2, downHit: true, snd: 'blunt', col: '#fff0a0' }, { zMax: 320 }); } },
  draw(c, s) { const a = peFade(s, 0.15, 0.3); c.save(); c.globalAlpha = a; drawSpr(c, fxTint('hexagram', PE_COL.dragon), sx(s.x), sy(s.y, 0), s.sdef.r * 2.2, s.sdef.r * 2.2 * GR, { ground: true, rot: s.lifeT * 1.5 });
    drawSpr(c, fxTint('rune', '#ffb040'), sx(s.x), sy(s.y, 0), s.sdef.r * 1.4, s.sdef.r * 1.4 * GR, { ground: true, rot: -s.lifeT * 2 }); c.restore(); },
  drawUpright(c, s) { const k = s.lifeT, a = peFade(s, 0.15, 0.3), X = sx(s.x);
    c.save(); c.globalAlpha = a; if (k < 1.6) drawSpr(c, fxTint('aura', '#ffe070'), X, sy(s.y, 0), 130, 440 * Math.min(1, k / 0.3), { ay: 1, alpha: 0.8 });
    const z = k < 1.05 ? 420 * easeOut(Math.min(1, k / 1.05)) : k < 1.6 ? 420 : 420 * (1 - (k - 1.6) / 0.15);
    if (k < 1.75) peBeast(c, 'pe_kouryu', X, sy(s.y, Math.max(0, z)), 260, { rot: k >= 1.6 ? Math.PI : 0, ay: k >= 1.6 ? 0.1 : 0.9 }); c.restore(); } });
defSkill('pe_pentacle', { name: '升龙·开阵', cls: 'priest', job: PE, tier: 2, lvReq: 26, mp: 110, cd: 50, col: '#ffcf3a', icon: 'pe_pentacle',
  desc: '在前方展开黄龙升天的法阵（施放 0.5 秒），把阵里的敌人吸向中心；黄龙从阵中心冲天而起连续撞击 20 下，再倒栽下来砸回地面（两部分各约一半伤害）。设置型技能：放下以后你可以去做别的事。',
  pow: lv => skillDmg(20, 2, lv), infoExtra: () => [['上升', '20 段 × 2666%'], ['下落', '53291%'], ['法阵半径', '190px']], ai: { kind: 'aoe', r: [80, 380], dy: 80 },
  act: lv => ({ name: 'pe_pentacle', clip: 'peSeal', dur: 0.62, noCounter: true,
    events: [evAt(0.02, e => { fxCharge(e, PE_COL.dragon, 3); peTalisman(e, 2); sfx.charge(); }),
      evAt(0.45, e => { const s = summon(e, 'pe_pentacle_s', { x: e.x + e.face * 240, y: e.y }); if (!s) return; const T = skillDmg(20, 2, lv); s.rise = T * 0.5 / 20; s.fin = T * 0.5; sfx.boom(0.5); })] }) });

/* =====================================================================
   觉醒（官方 50 / 85 / 100 级 → 本作 21 / 27 / 30 级；完成觉醒任务自动学会，不花 SP，等级随角色等级提升，自动放进技能栏）
   ===================================================================== */
// 四座千泰门（一觉「龙斗士」，KR 사좌천태문）：召唤四座式神神殿的大门，驱魔师站定把门推开，成群的神鸟涌出（20 段），最后一只巨大的神鸟撞破大门飞过（大部分伤害）。全程无敌
defSummon('pe_gate_s', { kind: 'field', life: 3.7, max: 1, over: 'oldest', keepRoom: false, col: PE_COL.seal,
  onSpawn: s => { s.n = 0; s.birds = []; },
  update: (s, dt) => { const k = s.lifeT, o = s.owner;
    while (s.n < 20 && k >= 1.0 + s.n * 0.08) { s.n++; for (let i = 0; i < 2; i++) s.birds.push({ x: s.x, y: s.y + rnd(-110, 110), z: rnd(40, 200), vx: s.face * rnd(700, 1000), t: 0, h: rnd(36, 62) });
      for (const t of ents) if (foe(o, t) && t.invul <= 0 && (t.x - s.ox) * s.face > -40 && (t.x - s.x) * s.face < 640 && Math.abs(t.y - s.y) < 170 && t.z < 320)
        summonHit(s, t, { dmg: s.swarm, stun: 0.35, knock: 12, airLift: 40, hs: 0.01, downHit: true, snd: 'fire', col: '#ffb070' }); if (s.n % 3 === 0) sfx.hit('fire', false); }
    for (const b of s.birds) { b.t += dt; b.x += b.vx * dt; } s.birds = s.birds.filter(b => b.t < 0.8);
    if (!s.big && k >= 2.75) { s.big = true; s.bigT = k; cam.shake = Math.max(cam.shake, 16); cam.flash = 0.2; cam.flashCol = '#ffd0a0'; sfx.boom(1.6); fxText('千泰门!', s.x, s.y, 260, { col: '#ffb040', size: 24, dur: 1 });
      for (let i = 0; i < 4; i++) game.after(0.06 * i, () => { fxSpr('explosion', s.x + s.face * (80 + i * 150), s.y + rnd(-40, 40), rnd(40, 140), { w: 300, dur: 0.5, grow: [0.4, 1.2] }); fxShock(s.x + s.face * (80 + i * 150), s.y, 260, PE_COL.fire); });
      for (const t of ents) if (foe(o, t) && t.invul <= 0 && (t.x - s.ox) * s.face > -80 && (t.x - s.x) * s.face < 820 && Math.abs(t.y - s.y) < 200 && t.z < 360)
        summonHit(s, t, { dmg: s.fin, launch: 560, knock: 360, hs: 0.2, big: 2.6, sure: true, downHit: true, snd: 'fire', col: '#fff0c0' }); } },
  drawUpright(c, s) { const k = s.lifeT, a = peFade(s, 0.25, 0.4), X = sx(s.x), Y = sy(s.y - 40, 0), open = clamp((k - 0.4) / 0.6, 0, 1);
    c.save(); c.globalAlpha = a * (0.55 + 0.35 * (1 - open)); peBeast(c, 'pe_gate', X, Y + 6, 330, { alpha: s.big && k - s.bigT < 0.1 ? 0.5 : 1 });
    c.globalAlpha = a; if (open > 0) { drawSpr(c, fxTint('aura', '#ffc050'), X, Y - 10, 170 * open, 300, { ay: 1, alpha: 0.9 * open }); drawSpr(c, fxTint('burst', '#ffd070'), X, Y - 130, 260 * open, 0, { rot: k * 2, alpha: 0.7 * open }); }
    c.globalCompositeOperation = 'lighter'; for (const b of s.birds) { c.globalAlpha = a * (1 - b.t / 0.8); peBeast(c, 'pe_suzaku', sx(b.x), sy(b.y, b.z), b.h, { flip: s.face < 0, ay: 0.5, add: true }); }
    c.restore();
    if (s.big) { const f = (k - s.bigT) / 0.5; if (f < 1) { c.save(); c.globalAlpha = 1 - f * f; peBeast(c, 'pe_suzaku', sx(s.x + s.face * 820 * easeOut(f)), sy(s.y, 150), 360, { flip: s.face < 0, ay: 0.5 });
      drawSpr(c, 'flame', sx(s.x + s.face * (820 * easeOut(f) - 200)), sy(s.y, 150), 420, 180, { flip: s.face < 0, alpha: 0.8 }); c.restore(); } } } });
defSkill('pe_awaken', { name: '四座千泰门', cls: 'priest', job: PE, tier: 1, lvReq: 21, maxLv: 3, sp: 0, mp: 150, cd: 135, pvp: 0.45, awaken: true, col: '#ff4a2a', icon: 'pe_awaken',
  desc: '【一次觉醒「龙斗士」的觉醒技】完成一次觉醒任务时自动学会（不花 SP，等级随角色等级提升）并放进技能栏（↑↑↓↓+Z）。在身前召唤四座式神神殿的大门，驱魔师站定把门推开：成群的神鸟从门里涌出，扫过你身前到门后 640px 的一大片（20 段），最后一只巨大的神鸟撞破大门、贯穿整个前方（大部分伤害）。全程无敌。',
  pow: lv => skillDmg(24, 6.5, lv), infoExtra: () => [['神鸟群', '20 段（约 40%）'], ['巨型神鸟', '约 60%'], ['范围', '前方 820px']], ai: { kind: 'awaken', r: [0, 700], dy: 150 },
  act: lv => ({ name: 'pe_awaken', clip: 'peSeal', dur: 3.5, noCounter: true, invul: true, superArmor: true,
    onStart: e => { game.cutin = { t: 0, dur: 1.1, name: '四座千泰门', who: cutinWho(e) }; game.timeStop = 0.9; sfx.awaken(); peTalisman(e, 4); for (let i = 0; i < 3; i++) fxCharge(e, PE_COL.fire, 3); },
    events: [evAt(0.1, e => { const T = skillDmg(24, 6.5, lv), R = game.room, x = R ? clamp(e.x + e.face * 170, R.x0 + 120, R.x1 - 120) : e.x + e.face * 170;
        const s = summon(e, 'pe_gate_s', { x, y: e.y }); if (s) { s.swarm = T * 0.4 / 20; s.fin = T * 0.6; s.ox = e.x; } fxShock(x, e.y, 300, PE_COL.seal); sfx.boom(0.8); cam.shake = 8; }),
      evAt(0.5, e => { e.play('peSummon', true); fxText('开!', e.x, e.y, e.z + 90, { col: '#ffb040', size: 16 }); }),
      evAt(2.6, e => { e.play('pePlant', true); fxAura(e, PE_COL.fire, 0.8); })] }) });

// 真龙焚天（二觉「真龙星君」，KR 진격의 황룡）：布下阵法，黄龙从天而降化作巨大的黄龙战斧落到手里，一记横扫（全部伤害）。约 2.6 秒后出手，全程无敌
defSkill('pe_awaken2', { name: '真龙焚天', cls: 'priest', job: PE, tier: 2, lvReq: 27, maxLv: 3, sp: 0, mp: 200, cd: 170, pvp: 0.45, awaken: true, col: '#ffcf3a', icon: 'pe_awaken2',
  desc: '【二次觉醒「真龙星君」的觉醒技】完成二次觉醒任务时自动学会（不花 SP）并放进技能栏（↓↑→→+Z）。布下阵法，黄龙从天而降化作一柄巨大的黄龙战斧落到你手里，抡圆了一记横扫，斩开前方的一切（单段，全部伤害）。约 2.6 秒后出手，全程无敌。',
  pow: lv => skillDmg(32, 9, lv), infoExtra: () => [['段数', '1'], ['范围', '前方 600px、身后 140px']], ai: { kind: 'awaken', r: [0, 560], dy: 160 },
  act: lv => ({ name: 'pe_awaken2', clip: 'peSummon', dur: 3.3, noCounter: true, invul: true, superArmor: true,
    onStart: e => { game.cutin = { t: 0, dur: 1.1, name: '真龙焚天', who: cutinWho(e, 2) }; game.timeStop = 0.9; sfx.awaken(); const a = e.act; a.dz = 700;
      a.fx = addFx({ ent: e, x: e.x, y: e.y + 0.4, z: 0, dur: 3.3, draw(c) { const E = this.ent, A = E.act; if (!A || A.name !== 'pe_awaken2') { this.dur = this.t; return; }
        const k = this.t, X = sx(E.x), Y = sy(E.y, 0), al = Math.min(1, k / 0.3);
        c.save(); c.globalAlpha = al * 0.9; drawSpr(c, fxTint('hexagram', PE_COL.dragon), X, Y, 560, 560 * GR, { ground: true, rot: k * 0.8 }); drawSpr(c, fxTint('rune', '#ffb040'), X, Y, 360, 360 * GR, { ground: true, rot: -k * 1.4 }); c.restore();
        if (A.dz > 0) { c.save(); peBeast(c, 'pe_kouryu', sx(E.x - E.face * 20), sy(E.y, A.dz), 300, { rot: Math.PI, ay: 0.1 }); c.restore(); }
        if (A.axe) { c.save(); c.globalCompositeOperation = 'lighter'; drawSpr(c, fxTint('aura', '#ffe070'), X + E.face * 20, sy(E.y, E.z), 160, 330, { ay: 1, alpha: 0.6 + 0.3 * Math.sin(k * 20) }); c.restore(); } } }); },
    update: e => { const a = e.act, k = e.actT;
      if (k > 0.3 && k < 1.35) { a.dz = 700 * (1 - easeOut((k - 0.3) / 1.05)) + 120; if (Math.random() < 0.5) fxCharge(e, PE_COL.dragon, 2); }
      if (!a.axe && k >= 1.35) { a.axe = true; a.dz = 0; cam.flash = 0.2; cam.flashCol = '#fff0a0'; sfx.boom(1); fxBurst(e.x, e.y, e.z + 80, 300, PE_COL.dragon); fxText('真龙!', e.x, e.y, e.z + 110, { col: '#ffe070', size: 18 }); e.play('peCharge', true); }
      if (a.axe && !a.swing && k < 2.55 && Math.random() < 0.6) fxCharge(e, '#ffe070', 3);
      if (!a.swing && k >= 2.6) { a.swing = true; e.play('peSweep', true); cam.shake = 20; cam.flash = 0.2; cam.flashCol = '#ffe8a0'; sfx.boom(1.6); sfx.iai();
        fxSlashOn(e, { a0: -2.8, a1: 1.6, r: 300, w: 60, off: [40, 70], col: '#ffe070', heavy: true, dur: 0.3 }); fxSlashOn(e, { a0: -2.6, a1: 1.4, r: 240, w: 40, off: [40, 70], col: '#fff8d0', heavy: true, dur: 0.25 });
        fxSpr('dragonfang', e.x + e.face * 300, e.y, 80, { w: 700, h: 150, dur: 0.5, col: '#ffcf3a', flip: e.face < 0, grow: [0.6, 1.1] }); fxShock(e.x + e.face * 220, e.y, 520, PE_COL.dragon); peCracks(e.x + e.face * 220, e.y, 320, '#ffcf3a', 1);
        const T = skillDmg(32, 9, lv);
        for (const t of ents) if (hittable(e, t) && (t.x - e.x) * e.face > -140 && Math.abs(t.x - e.x) < 620 && Math.abs(t.y - e.y) < 190 && t.z < 360)
          applyHit(e, t, { dmg: T, launch: 560, knock: 420, hs: 0.22, big: 2.8, sure: true, downHit: true, critBonus: 0.1, snd: 'blunt', col: '#fff0a0', box: null }, { src: e }); } } }) });

// 式神灭却·合（↑↓→→+Z）：朱雀和玄武助阵（红色法阵）：巨兵插进地里，撬起一大块岩盘往上抡，再往前一摔，岩盘砸进地面、碎石四溅
defSkill('pe_blitz', { name: '式神灭却·合', cls: 'priest', job: PE, tier: 3, lvReq: 29, mp: 120, cd: 60, col: '#ff5a2a', icon: 'pe_blitz',
  desc: '朱雀和玄武现身助阵（脚下展开红色法阵）：把巨兵插进地里 → 撬起一大块岩盘往上抡（挑空）→ 往前一摔，岩盘砸进地面、碎石四溅（4 段）。霸体。可以在普攻中、落凤锤砸地后施放。',
  pow: lv => skillDmg(24, 2.4, lv), infoExtra: () => [['插地 : 撬岩 : 上抡冲击 : 碎石', '19069 : 9534 : 28603 : 9534'], ['范围', '前方 360px']], ai: { kind: 'aoe', r: [0, 340], dy: 90 },
  act: lv => { const T = skillDmg(24, 2.4, lv), R = [19069, 9534, 28603, 9534].map(v => v / 66740 * T);
    return { name: 'pe_blitz', clip: 'pePlant', dur: 1.8, noCounter: true, superArmor: true,
      onStart: e => { const x = e.x; fxSpr('rune', x, e.y, 2, { w: 380, h: 150, dur: 1.8, col: '#ff3a3a', grow: [0.5, 1] }); peTalisman(e, 3);
        addFx({ ent: e, x: e.x, y: e.y - 0.5, z: 0, dur: 1.6, fx0: e.x, fc: e.face, draw(c) { const k = this.t / this.dur, a = k < 0.15 ? k / 0.15 : k > 0.8 ? (1 - k) / 0.2 : 1; c.save(); c.globalAlpha = a;
          peBeast(c, 'pe_suzaku', sx(this.fx0 - this.fc * 90), sy(this.y, 140 + Math.sin(this.t * 6) * 8), 110, { flip: this.fc < 0, ay: 0.5 }); peBeast(c, 'pe_genbu', sx(this.fx0 - this.fc * 150), sy(this.y - 20, 0), 100, { flip: this.fc < 0 }); c.restore(); } }); },
      events: [evAt(0.3, e => { const x = e.x + e.face * 80; peSlamFx(x, e.y, 200, PE_COL.fire, 1.2); blast(e, x, e.y, 180, { dmg: R[0], stun: 0.6, knock: 0, hs: 0.08, downHit: true, snd: 'blunt', col: '#ffc080' }, { zMax: 120 }); }),
        evAt(0.7, e => { e.play('peSweep', true); const x = e.x + e.face * 130; sfx.swing(true); cam.shake = Math.max(cam.shake, 8);
          fxSpr('rock', x, e.y, 60, { w: 190, dur: 0.55, add: false, spin: e.face * 3, grow: [0.8, 1.1] }); peArc(e, { a0: 1.6, a1: -1.6, r: 170, off: [30, 60] });
          instantHit(e, { box: [0, 250, 80, 0, 200], dmg: R[1], launch: 300, knock: 20, hs: 0.06, downHit: true, snd: 'blunt', col: '#e8c080' });
          blast(e, x, e.y, 210, { dmg: R[2], launch: 560, knock: 60, hs: 0.12, big: 1.8, downHit: true, snd: 'blunt', col: '#ffc080' }, { zMax: 260 }); fxShock(x, e.y, 320, PE_COL.fire); }),
        evAt(1.15, e => { e.play('peSwing', true); const x = e.x + e.face * 220; cam.shake = Math.max(cam.shake, 12); cam.flash = 0.12; cam.flashCol = '#ffc080';
          peSlamFx(x, e.y, 280, PE_COL.earth, 2); peCracks(x, e.y, 240, '#ff8a3a', 0.9); fxSpr('explosion', x, e.y, 30, { w: 280, dur: 0.5, grow: [0.5, 1.2] });
          for (let i = 0; i < 4; i++) game.after(0.06 * i, () => { if (e.dead) return; const xx = x + e.face * rnd(-60, 140), yy = e.y + rnd(-60, 60);
            fxSpr('rock', xx, yy, rnd(20, 80), { w: rnd(40, 70), dur: 0.5, add: false, spin: rnd(-8, 8), grow: [1, 0.7] }); fxDust(xx, yy, 4, 20);
            blast(e, x, e.y, 200, { dmg: R[3] / 4, launch: 220, knock: 90, hs: 0.04, downHit: true, snd: 'blunt', col: '#e8c080' }, { zMax: 220 }); }); })] }; } });

// 雷鸣怒海·火啸山崩（三觉「光启·驱魔师」，KR 오행:벽천지격）：五只式神化作战斧与念珠 → 青龙的海啸 + 白虎的雷霆（5 段）+ 水柱 → 腾到海面上冥想聚力 → 黄龙头战斧砸下 → 地面连环爆炸（10 段）
defSkill('pe_awaken3', { name: '雷鸣怒海·火啸山崩', cls: 'priest', job: PE, tier: 3, lvReq: 30, maxLv: 3, sp: 0, mp: 300, cd: 270, pvp: 0.45, awaken: true, col: '#ffd040', icon: 'pe_awaken3',
  desc: '【三次觉醒「光启·驱魔师」的觉醒技】完成三次觉醒任务时自动学会（不花 SP）并放进技能栏（←→→↑+Z）。五只式神化作战斧与念珠：青龙卷起海啸、白虎降下雷霆（5 段）、再冲起一道水柱；你腾到海面之上冥想聚力，挥下黄龙头的巨大战斧（约 40%），砸得地面连环爆炸（10 段）。全程无敌。',
  pow: lv => skillDmg(46, 12, lv), infoExtra: () => [['海啸 + 雷霆', '5 段 × 16337%'], ['水柱', '16337%'], ['黄龙战斧', '130694%'], ['地面爆炸', '10 段 × 9802%']], ai: { kind: 'awaken', r: [0, 620], dy: 170 },
  act: lv => { const T = skillDmg(46, 12, lv), W = { bolt: T * 16337 / 326736, pillar: T * 16337 / 326736, axe: T * 130694 / 326736, boom: T * 9802 / 326736 };
    const area = (e, h, dx0 = -140, dx1 = 640) => { for (const t of ents) if (hittable(e, t) && (t.x - e.x) * e.face > dx0 && (t.x - e.x) * e.face < dx1 && Math.abs(t.y - e.y) < 200 && t.z < 400) applyHit(e, t, { sure: true, downHit: true, box: null, ...h }, { src: e }); };
    return { name: 'pe_awaken3', clip: 'peSummon', dur: 4.5, noCounter: true, invul: true, superArmor: true,
      onStart: e => { game.cutin = { t: 0, dur: 1.2, name: '雷鸣怒海·火啸山崩', who: cutinWho(e, 3) }; game.timeStop = 1.0; sfx.awaken(); const a = e.act; a.x0 = e.x; a.y0 = e.y;
        addFx({ ent: e, x: e.x, y: e.y - 0.5, z: 0, dur: 0.9, draw(c) { const E = this.ent, k = this.t / this.dur, a2 = k < 0.2 ? k / 0.2 : 1 - (k - 0.2) / 0.8;
          c.save(); c.globalAlpha = a2; ['pe_suzaku', 'pe_genbu', 'pe_byakko', 'pe_seiryu', 'pe_kouryu'].forEach((n, i) => { const ang = i / 5 * TAU + k * 2, r = 150 * (1 - k * 0.8);
            peBeast(c, n, sx(E.x + Math.cos(ang) * r), sy(E.y + Math.sin(ang) * r * GR, 60 + 40 * Math.sin(ang)), 90, { ay: 0.6 }); }); c.restore(); } }); },
      update: e => { const a = e.act, k = e.actT;
        if (!a.wave && k >= 0.6) { a.wave = true; sfx.boom(1.2); cam.shake = 10; fxSpr('wave', e.x - e.face * 60, e.y, 60, { h: 420, dur: 0.9, col: '#4ab8ff', grow: [0.6, 1.4] }); fxSpr('wave', e.x + e.face * 260, e.y, 60, { h: 380, dur: 1.0, col: '#6ac8ff', flip: true, grow: [0.4, 1.4] }); }
        while (a.wave && (a.nb || 0) < 5 && k >= 0.7 + (a.nb || 0) * 0.14) { a.nb = (a.nb || 0) + 1; const x = e.x + e.face * rnd(80, 520), y = e.y + rnd(-120, 120);
          addFx({ x, y: y + 2, z: 0, dur: 0.3, draw(c) { const kk = this.t / this.dur, X = sx(this.x), Y = sy(this.y, 0); drawSpr(c, fxTint('lightning', '#bfe6ff'), X, Y + 6, 80, Y + 40, { ay: 1, alpha: 1 - kk }); drawSpr(c, 'spark', X, Y, 120, 0, { alpha: 1 - kk }); } });
          fxShock(x, y, 120, '#dff0ff'); cam.shake = Math.max(cam.shake, 5); area(e, { dmg: W.bolt, stun: 0.5, knock: 30, airLift: 60, hs: 0.04, snd: 'crit', col: '#dff0ff' }); }
        if (!a.pillar && k >= 1.5) { a.pillar = true; const x = e.x + e.face * 220; fxSpr('aura', x, e.y, 0, { h: 480, w: 200, ay: 1, dur: 0.6, col: '#4ab8ff', grow: [0.4, 1.2] }); fxSpr('wave', x, e.y, 120, { h: 300, dur: 0.6, col: '#8ad8ff', grow: [0.5, 1.2] }); sfx.boom(0.8); area(e, { dmg: W.pillar, launch: 420, knock: 20, hs: 0.06, snd: 'blunt', col: '#bfe6ff' }); }
        if (k >= 1.8 && k < 3.0) { e.z = Math.min(160, (k - 1.8) * 500); e.vz = 0; if (!a.med) { a.med = true; e.play('peSeal', true); fxText('五行…', e.x, e.y, e.z + 120, { col: '#ffe070', size: 14 }); } if (Math.random() < 0.7) fxCharge(e, Math.random() < 0.5 ? '#ffe070' : '#8ad8ff', 3); }
        if (!a.axe && k >= 3.0) { a.axe = true; e.play('peSwing', true); e.vz = -2200; sfx.swing(true); fxSlashOn(e, { a0: -2.9, a1: 1.5, r: 280, w: 64, off: [40, 80], col: '#ffe070', heavy: true, dur: 0.3 }); }
        if (a.axe && !a.smash && (e.z <= 0 || k >= 3.25)) { a.smash = true; e.z = 0; e.vz = 0; const x = e.x + e.face * 200; cam.shake = 22; cam.flash = 0.2; cam.flashCol = '#fff0c0'; sfx.boom(1.8);
          fxText('火啸山崩!', x, e.y, 200, { col: '#ffb040', size: 24, dur: 1.1 }); fxSpr('dragonfang', x, e.y, 120, { w: 420, h: 240, dur: 0.5, col: '#ffcf3a', rot: Math.PI / 2 * e.face, grow: [0.6, 1.2] });
          peSlamFx(x, e.y, 460, PE_COL.dragon, 2.5); peCracks(x, e.y, 380, '#ffb040', 1.4); area(e, { dmg: W.axe, launch: 600, knock: 200, hs: 0.24, big: 3, critBonus: 0.1, snd: 'blunt', col: '#fff0a0' }); a.bt = k; }
        while (a.smash && (a.nx || 0) < 10 && k >= a.bt + 0.12 + (a.nx || 0) * 0.07) { a.nx = (a.nx || 0) + 1; const x = e.x + e.face * rnd(40, 600), y = e.y + rnd(-150, 150);
          fxSpr('explosion', x, y, rnd(10, 60), { w: rnd(170, 260), dur: 0.45, grow: [0.4, 1.2] }); fxShock(x, y, 160, PE_COL.fire); cam.shake = Math.max(cam.shake, 6); sfx.hit('fire', false);
          area(e, { dmg: W.boom, launch: 260, knock: 60, hs: 0.03, snd: 'fire', col: '#ffc080' }); } },
      onEnd: e => { e.z = 0; } }; } });

/* ---- 二 / 三觉被动 ---- */
peDef('pe_insight', { name: '式神之力', tier: 2, lvReq: 26, sp: 30, passive: true, col: '#ffb040',
  desc: '【二觉被动】与式神心意相通：物理 / 魔法攻击力、物理 / 魔法暴击率常驻提高。', infoExtra: lv => [['攻击力', '+' + pct(0.02 + 0.006 * lv)], ['暴击率', '+' + pct(0.02 + 0.004 * lv)]] });
peDef('pe_kouryu', { name: '式神契结：真龙', tier: 2, lvReq: 26, maxLv: 1, sp: 0, passive: true, col: '#ffcf3a',
  desc: '【二觉被动，完成二次觉醒任务时自动学会】与黄龙结下契约（黄龙本身不会现身）：技能攻击力提高；自己和同一房间的队友攻击速度 / 施放速度 / 移动速度 +10%；升天阵、式神：空之白虎 的范围 +10%。',
  infoExtra: () => [['技能攻击力', '+10%'], ['全队三速', '+10%'], ['升天阵 / 白虎范围', '+10%']] });
peDef('pe_general', { name: '式神之悟', tier: 3, lvReq: 29, sp: 40, passive: true, col: '#6ab8ff',
  desc: '【三觉被动】参透式神之道：普攻和驱魔技能攻击力提高；获得「共鸣」—— 巨兵系技能（空斩打、落凤锤、疾风打、星落打、狂乱锤击、疾空旋风破、无双击、逆鳞震、逆龙七杀、式神灭却·合）施放中，可以瞬发式神技能（没有施放动作、不打断当前技能），最多 2 次，每 3 秒恢复 1 次（不受冷却缩减影响；HUD 图标上的数字）。式神：地之玄武 的碎石间隔 0.3 → 0.2 秒。',
  infoExtra: lv => [['攻击力', '+' + pct(0.03 * lv)], ['共鸣', '2 次，每 3 秒恢复 1 次']] });

/* ---- 冷却：驱魔之书（驱魔技能冷却 −10%，觉醒除外）---- */
PRIEST_HOOKS.onCast.push((p, id, act, how) => {
  if (!peOn(p) || how === 'recast' || !skLv(p, 'pe_book')) return;
  const S = SKILLS[id]; if (!S || S.job !== PE || S.awaken || S.passive) return;
  if (p.cool[id] > 0) p.cool[id] *= 0.9;
});
// 真龙：自己和同一房间的队友三速 +10%（组队时每个客户端各自给自己加；队友是驱魔师且到了二觉等级就算）
partyAura(PE, (src, me) => {
  const on = src === me ? skLv(me, 'pe_kouryu') > 0 : (src.lvl || 0) >= 27;
  if (on && !me.dead) me.buffs.pe_kouryuA = { t: 1.2, aspd: 0.1, cspd: 0.1, mspd: 0.1, name: '真龙', col: PE_COL.dragon };
});

/* ---- 觉醒自动学会（官方：觉醒技完成觉醒任务自动获得、0 SP、等级随角色等级提升；真龙 二觉时自动给 1 级）---- */
const PE_AUTO = [['pe_awaken', 1, true], ['pe_awaken2', 2, true], ['pe_kouryu', 2, false], ['pe_awaken3', 3, true]];
function peAutoAwaken(p) {
  if (p.kit || !game.skillLv || !game.skillBar || (typeof isHuman === 'function' && !isHuman(p))) return;
  const got = [];
  for (const [id, tier, grow] of PE_AUTO) { const S = SKILLS[id]; if (!S || !tierUnlocked(tier) || game.lvl < S.lvReq) continue;
    const cur = game.skillLv[id] || 0, want = grow ? Math.min(S.maxLv || 1, 1 + Math.floor((game.lvl - S.lvReq) / (S.lvStep || 1))) : 1;
    if (cur >= want) continue; game.skillLv[id] = want;
    if (!cur) { got.push(S.name); if (!S.passive && !game.skillBar.includes(id)) { const k = game.skillBar.indexOf(null); if (k >= 0) game.skillBar[k] = id; } } }
  if (got.length) { toastMsg(`觉醒：自动学会 ${got.join('、')}（主动技能已放进技能栏）`, '#ffb040'); if (typeof save !== 'undefined' && save.write) save.write(); }
}

/* ---- 被动效果（每 0.25 秒刷新；hide = 不在 HUD 上显示图标）---- */
const PE_PSV = ['pe_force', 'pe_mastery', 'pe_book', 'pe_spirit', 'pe_insight', 'pe_kouryu', 'pe_general'];
CLASSES.priest.passives.push(p => {
  if (!peOn(p)) { for (const id of PE_PSV) setPassive(p, id, false); if (p._peElemOn) { p._peElemOn = 0; p.atkElem = p._peElem0; } return; }
  pePatchBase(); peAutoAwaken(p);
  const L = id => skLv(p, id);
  setPassive(p, 'pe_force', L('pe_force') > 0, { mspd: 0.1, hide: true });
  setPassive(p, 'pe_mastery', L('pe_mastery') > 0, { atk: 0.02 + 0.004 * L('pe_mastery'), hide: true });
  setPassive(p, 'pe_book', L('pe_book') > 0, { dmg: 0.006 * L('pe_book'), hide: true });
  setPassive(p, 'pe_spirit', L('pe_spirit') > 0, { atk: 0.02 + 0.004 * L('pe_spirit'), hide: true });
  setPassive(p, 'pe_insight', L('pe_insight') > 0, { atk: 0.02 + 0.006 * L('pe_insight'), crit: 0.02 + 0.004 * L('pe_insight'), hide: true });
  setPassive(p, 'pe_kouryu', L('pe_kouryu') > 0, { dmg: 0.1, hide: true });
  if (L('pe_general')) setPassive(p, 'pe_general', true, { dmg: 0.03 * L('pe_general'), lab: '×' + peRes(p).n, col: '#6ab8ff' }); else setPassive(p, 'pe_general', false);
  // 法阵：万悟 —— 魔法攻击更高时按魔法结算（物理 / 魔法合一）
  if (L('pe_zen') && p.matk !== undefined && p.atk !== undefined) p.dmgType = p.matk > p.atk ? 'mag' : 'phys';
  // 封魔莲华：武器附带火 / 光属性（取属性强化更高的一边；武器本身有属性时不改）
  if (p.buffs.pe_lotus) { if (!p._peElemOn) { p._peElemOn = 1; p._peElem0 = p.atkElem; } if (!p._peElem0) p.atkElem = p.elem && (p.elem.fire || 0) > (p.elem.light || 0) ? 'fire' : 'light'; }
  else if (p._peElemOn) { p._peElemOn = 0; p.atkElem = p._peElem0; }
});

/* ---- 登记（转职元数据在 priest.js；这里写技能 / 指令 / 动作 / 觉醒技 id）---- */
{ const J = CLASSES.priest.jobs.exorcist;
  Object.assign(J, { art: 'job/exorcist', awaken: 'pe_awaken', awaken2: 'pe_awaken2', awaken3: 'pe_awaken3', awakenName3: '光启·驱魔师',
    auto: ['pe_zen', 'pe_force', 'pe_lurk', 'pe_plate', 'pe_gale'] });
  Object.assign(J.anims, PE_ANIMS);
  J.skills.push('pe_zen', 'pe_force', 'pe_lurk', 'pe_plate', 'pe_gale', 'pe_mastery', 'pe_lotus', 'pe_star', 'pe_suzaku', 'pe_genbu', 'pe_book', 'pe_byakko', 'pe_chaos',
    'pe_spin', 'pe_atomic', 'pe_spirit', 'pe_awaken', 'pe_seiryu', 'pe_quake', 'pe_insight', 'pe_kouryu', 'pe_seven', 'pe_pentacle', 'pe_awaken2', 'pe_general', 'pe_blitz', 'pe_awaken3');
  // 指令（官方默认指令；白虎官方页和玄武写成同一个，本作用 ↓←+Z）
  CLASSES.priest.cmds.push(['df', 'pe_lotus', 'buff'], ['fu', 'pe_gale'], ['uu', 'pe_star'], ['uff', 'pe_suzaku'], ['uf', 'pe_genbu'], ['db', 'pe_byakko'], ['dd', 'pe_chaos'],
    ['bdf', 'pe_spin'], ['fbf', 'pe_atomic'], ['uudd', 'pe_awaken'], ['bdf', 'pe_seiryu', 'buff'], ['fbuf', 'pe_quake'], ['duf', 'pe_seven'], ['bff', 'pe_pentacle'],
    ['duff', 'pe_awaken2'], ['udff', 'pe_blitz'], ['bffu', 'pe_awaken3']); }
