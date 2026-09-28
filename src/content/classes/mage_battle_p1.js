/* =====================================================================
   战斗法师 P1（一觉之后）：闪击碎霸、煌龙天临、战灵潜能、炫纹簇、使徒之舞、二觉“一骑当千碎霸”、使徒化身、
   太古之力、炫纹之源：太古神光、太古化身、三觉“太古星河·殒灭”（docs/SKILLS_OFFICIAL_mage.md 3.3，等级按 1.1 压缩）
   变身不出整套帧：用现有帧 + 运行时画的光环（决定见文档第 8 节）；矛、星河、星团都在运行时画
   ===================================================================== */
// 跟着人物的光环（变身 / 觉醒）：id 给了就在 BUFF 消失时结束
function bmAuraFx(e, col, dur, id) {
  addFx({ ent: e, x: e.x, y: e.y - 0.4, z: 0, dur, id, update() { const p = this.ent; this.x = p.x; this.y = p.y - 0.4; if (p.dead || ents.indexOf(p) < 0 || (this.id && !p.buffs[this.id])) this.t = this.dur; },
    draw(c) { const p = this.ent, X = sx(p.x), Y = sy(p.y, p.z + 60), k = 0.75 + 0.25 * Math.sin(game.t * 7);
      c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.45 * k; drawSpr(c, fxTint('orb', col), X, Y, 120, 170, {});
      c.globalAlpha = 0.6; for (let i = 0; i < 4; i++) { const u = (game.t * 0.9 + i / 4) % 1; drawSpr(c, fxTint('orb', col), X + Math.sin(i * 2.1 + game.t * 3) * 26, Y + 50 - u * 130, 8, 8, { alpha: 1 - u }); } c.restore(); } });
}
// 金色大矛（插在地上一会儿再消散）；fall = 从天上落下来
function bmSpearFx(x, y, dur, col, fall) {
  addFx({ x, y: y + 0.5, z: 0, dur, draw(c) { const k = this.t / this.dur, f = fall ? Math.min(1, this.t / 0.12) : 1, z = 320 * (1 - f), X = sx(this.x), Y = sy(this.y, z), a = k > 0.75 ? (1 - k) / 0.25 : 1;
    c.save(); c.globalAlpha = a; c.fillStyle = '#fff4d0'; c.beginPath(); c.moveTo(X, Y + 6); c.lineTo(X - 10, Y - 40); c.lineTo(X + 10, Y - 40); c.fill();
    c.fillStyle = '#c89a3a'; c.fillRect(X - 3, Y - 170, 6, 132); c.fillRect(X - 14, Y - 44, 28, 5);
    c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.5 * a; drawSpr(c, fxTint('orb', col), X, Y - 70, 44, 180, {}); c.restore(); } });
}
// 太古星河：前方上空旋转的星河
function bmGalaxyFx(x, y, dur) {
  addFx({ x, y: y + 1, z: 0, dur, draw(c) { const k = this.t / this.dur, g = Math.min(1, this.t / 0.3), a = k > 0.85 ? (1 - k) / 0.15 : 1, X = sx(this.x), Y = sy(this.y, 180);
    c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.7 * a; drawSpr(c, fxTint('vortex', '#6a8aff'), X, Y, 420 * g, 170 * g, { rot: game.t * 1.5 });
    c.globalAlpha = 0.5 * a; drawSpr(c, fxTint('vortex', '#ffd070'), X, Y, 260 * g, 110 * g, { rot: -game.t * 2 });
    for (let i = 0; i < 16; i++) { const an = game.t * 1.2 + i * TAU / 16, r = (60 + (i % 4) * 40) * g; c.globalAlpha = a; drawSpr(c, fxTint('orb', i % 3 ? '#dfe8ff' : '#ffe070'), X + Math.cos(an) * r, Y + Math.sin(an) * r * 0.4, 9, 9, {}); } c.restore(); } });
}
BM_BODY.push('bm_flashsmash', 'bm_descent');
// ---- 一觉段 ----
defSkill('bm_flashsmash', { name: '闪击碎霸', cls: 'mage', job: BM, tier: 1, lvReq: 23, mp: 60, cd: 30, type: 'phys', col: '#8ac8ff',
  desc: '原地快速转一圈（让周围的敌人硬直），再一次大幅横扫。全程霸体。', pow: lv => skillDmg(12, 1.2, lv), ai: { kind: 'aoe', r: [0, 160], dy: 40 },
  act: (lv) => ({ name: 'bm_flashsmash', clip: 'bmFlashSmash', dur: 0.85, superArmor: true, noCounter: true, cancelFrom: 0.7,
    hits: [HB(0.08, 0.3, [-90, 90, 30, 0, 110], skillDmg(3, 0.3, lv), { stun: 0.6, knock: 10, hs: 0.04, snd: 'blunt', type: 'phys', rep: 0.1, max: 2 }),
      HB(0.5, 0.58, [-20, 190, 40, 0, 130], skillDmg(9, 0.9, lv), { stun: 0.5, knock: 240, heavy: true, hs: 0.1, big: 1.4, snd: 'blunt', type: 'phys', shake: 3 })],
    events: [evAt(0.08, e => { sfx.swing(false); fxSlash({ x: e.x, y: e.y, z: e.z, face: e.face, col: CHASER_COL, a0: -3.1, a1: 3.1, r: 90, w: 16, off: [0, 50], squash: 0.45, dur: 0.24 }); }),
      evAt(0.48, e => { sfx.swing(true); fxSlash({ x: e.x, y: e.y, z: e.z, face: e.face, col: '#dfe8ff', a0: -1.4, a1: 1.2, r: 150, w: 22, off: [20, 55], dur: 0.24 }); })] }) });
defSkill('bm_descent', { name: '煌龙天临', cls: 'mage', job: BM, tier: 1, lvReq: 25, mp: 80, cd: 50, type: 'phys', col: '#ffd070',
  desc: '用龙之炫纹凝成煌龙之矛，跳起来向前下劈：1 段大伤害 + 冲击波，矛插在地上一会儿再消散。施放时按住 → 边前进边劈。', pow: lv => skillDmg(16, 1.6, lv), ai: { kind: 'burst', r: [40, 260], dy: 40 },
  act: (lv, p) => { const adv = !!(p && p.pad && p.pad.dx() * p.face > 0);
    return { name: 'bm_descent', clip: 'bmDescent', dur: 1.0, superArmor: true, noCounter: true, cancelFrom: 0.85, move: [[0.08, 0.4, adv ? 420 : 140, 520]],
      events: [evAt(0.1, e => sfx.charge()), evAt(0.4, e => { e.vz = -1100; }),
        evAt(0.5, e => { const x = e.x + e.face * 50; sfx.boom(1.0); cam.shake = Math.max(cam.shake, 7); fxShock(x, e.y, 200, '#ffd070'); bmSpearFx(x, e.y, 1.2, '#ffd070');
          blast(e, x, e.y, 70, { dmg: skillDmg(11, 1.1, lv), launch: 360, knock: 80, hs: 0.12, big: 1.5, type: 'phys', col: '#ffe070', downHit: true }, { zMax: 150 });
          mgAfter(e, 0.06, () => blast(e, x, e.y, 170, { dmg: skillDmg(5, 0.5, lv), launch: 200, knock: 160, hs: 0.06, type: 'phys', col: '#ffd070', downHit: true, noChaser: true }, { zMax: 80 })); })] }; } });
// ---- 二觉段 ----
defSkill('bm_potential', { name: '战灵潜能', cls: 'mage', job: BM, tier: 2, lvReq: 26, passive: true, type: 'phys', col: '#ffd23a',
  desc: '【被动·二觉】物理 / 魔法两边的力量融为一体：技能攻击力和暴击率提高。', infoExtra: lv => [['技能攻击力', '+' + pct(0.12 + 0.02 * lv)], ['暴击率', '+' + pct(0.05)]] });
defSummon('bm_cluster', { kind: 'field', r: 110, life: 10, max: 1, col: CHASER_COL, keepRoom: false,
  onEnd: (s, why) => { if (why !== 'life' && why !== 'cmd') return; const o = s.owner; sfx.boom(0.9);
    for (let i = 0; i < 7; i++) mgAfter(o, i * 0.07, () => { const x = s.x + rnd(-70, 70), y = clamp(s.y + rnd(-30, 30), 8, DEPTH - 8); fxBurst(x, y, 70, 120, i % 2 ? CHASER_COL : '#ffe070');
      blast(o, x, y, 90, { dmg: s.dmg || 1, launch: i === 6 ? 380 : 120, knock: 40, hs: 0.04, type: 'phys', col: CHASER_COL, downHit: true, noChaser: true }, { zMax: 220 }); }); },
  drawUpright(c, s) { const X = sx(s.x), Y = sy(s.y, 70), k = s.lifeT / s.life, pulse = k > 0.8 ? 1 + Math.sin(game.t * 30) * 0.15 : 1;
    c.save(); c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 14; i++) { const a = game.t * (1.5 + (i % 3) * 0.5) + i * 2.4, r = (20 + (i * 13) % 40) * pulse; drawSpr(c, fxTint('orb', i % 4 ? CHASER_COL : '#ffe070'), X + Math.cos(a) * r, Y + Math.sin(a) * r * 0.7, 16, 16, {}); }
    c.globalAlpha = 0.5; drawSpr(c, fxTint('orb', '#dfe8ff'), X, Y, 70 * pulse, 70 * pulse, {}); c.restore(); } });
defSkill('bm_cluster', { name: '炫纹簇', cls: 'mage', job: BM, tier: 2, lvReq: 26, mp: 90, cd: 45, type: 'phys', col: CHASER_COL,
  desc: '在前方布下一团炫纹“星团”，10 秒后自动爆炸（7 段）；再按一次技能键立即引爆，放其他技能时也能按。', pow: lv => skillDmg(14, 1.4, lv), ai: { kind: 'aoe', r: [40, 280], dy: 60 },
  recast: { ok: p => summonsOf(p, 'bm_cluster').length > 0, instant: true, cd: 0.2, mp: 0, act: (lv, p) => dismissSummons(p, 'bm_cluster', 'cmd') },
  act: (lv) => ({ name: 'bm_cluster', clip: 'bmCall', dur: 0.45, cancelFrom: 0.3, noCounter: true,
    events: [evAt(0.15, e => { const at = aimAhead(e, 150, 260), s = summon(e, 'bm_cluster', { x: at.x, y: at.y, lv }); if (s) s.dmg = skillDmg(2, 0.2, lv); sfx.magic(); })] }) });
defSkill('bm_apostledance', { name: '使徒之舞', cls: 'mage', job: BM, tier: 2, lvReq: 26, mp: 100, cd: 40, type: 'phys', col: '#ffd070',
  desc: '召唤使徒之矛在前方乱舞，最后把范围内的敌人拉到你身前并束缚住。', pow: lv => skillDmg(18, 1.8, lv), ai: { kind: 'aoe', r: [0, 320], dy: 90 },
  act: (lv) => ({ name: 'bm_apostledance', clip: 'bmDance', dur: 1.4, superArmor: true, noCounter: true, cancelFrom: 1.15,
    onStart: e => { e.act.cx = e.x + e.face * 180; e.act.cy = e.y; },
    events: [...Array.from({ length: 8 }, (_, i) => evAt(0.2 + i * 0.1, e => { const a = e.act, x = a.cx + rnd(-110, 110), y = clamp(a.cy + rnd(-40, 40), 8, DEPTH - 8); bmSpearFx(x, y, 0.45, '#ffd070', true); sfx.swing(i % 2 === 0);
        mgAfter(e, 0.12, () => blast(e, x, y, 70, { dmg: skillDmg(1.6, 0.16, lv), stun: 0.6, knock: 0, hs: 0.04, type: 'phys', col: '#ffe070' }, { zMax: 200 })); })),
      evAt(1.05, e => { const a = e.act, x = e.x + e.face * 70; sfx.boom(0.8);
        for (const t of ents) if (foe(e, t) && !t.dead && t.invul <= 0 && inGround(t, a.cx, a.cy, 200)) { if (!t.boss) { t.x = x + rnd(-10, 10); t.y = clamp(e.y + rnd(-10, 10), 8, DEPTH - 8); } addStatus(t, 'bind', 2.5, { src: e }); }
        fxShock(x, e.y, 120, '#ffd070'); blast(e, x, e.y, 90, { dmg: skillDmg(5, 0.5, lv), stun: 0.8, knock: 0, hs: 0.08, type: 'phys', col: '#ffe070', downHit: true }, { zMax: 200 }); })] }) });
defSkill('bm_awaken2', { name: '一骑当千碎霸', cls: 'mage', job: BM, tier: 2, lvReq: 27, maxLv: 3, mp: 200, cd: 170, pvp: 0.45, type: 'phys', awaken: true, col: '#ffd23a',
  desc: '【二次觉醒】瞬间使徒化，凝出一把巨大的使徒之矛，蓄力后大幅横扫前方，冲击波随后席卷。全程无敌。', pow: lv => skillDmg(34, 9, lv), ai: { kind: 'awaken', r: [0, 420], dy: 100 },
  act: (lv) => ({ name: 'bm_awaken2', clip: 'bmApostle', dur: 2.3, superArmor: true, noCounter: true, invul: true,
    onStart: e => { game.cutin = { t: 0, dur: 1.0, name: '一骑当千碎霸', who: cutinWho(e, 2) }; game.timeStop = 0.9; sfx.awaken(); bmAuraFx(e, '#ffd23a', 2.3); },
    update: e => { if (e.actT > 0.95 && e.actT < 1.5 && Math.random() < 0.6) fxCharge(e, '#ffd23a'); },
    events: [evAt(0.95, e => sfx.charge()),
      evAt(1.5, e => { sfx.swing(true); cam.shake = 10; fxSlash({ x: e.x, y: e.y, z: e.z, face: e.face, col: '#ffd23a', a0: -1.8, a1: 1.4, r: 300, w: 40, off: [20, 70], dur: 0.35 });
        instantHit(e, { box: [-40, 480, 120, 0, 260], dmg: skillDmg(24, 6, lv), launch: 460, knock: 260, hs: 0.16, big: 2.2, sure: true, downHit: true, type: 'phys', col: '#ffe070', noChaser: true }); }),
      evAt(1.75, e => { const x = e.x + e.face * 260; cam.flash = 0.2; cam.flashCol = '#fff0c0'; fxShock(x, e.y, 380, '#ffd070'); fxBurst(x, e.y, 60, 360, '#ffe070');
        blast(e, x, e.y, 300, { dmg: skillDmg(10, 3, lv), launch: 300, knock: 180, hs: 0.1, sure: true, downHit: true, type: 'phys', col: '#ffd070', noChaser: true }, { zMax: 220 }); e.invul = Math.max(e.invul, 0.6); })] }) });
// 使徒化身 / 太古化身：变身 BUFF（form 1 / 2）。霸体、异常免疫、斗神意志至少 3 段；受到致死伤害时留 1 点 HP 并解除变身（受击前钩子 minHp）
const BM_FORM_IMMUNE = Object.freeze(Object.fromEntries(Object.keys(STATUS_COL).map(k => [k, true])));
const bmForm = p => p.buffs && (p.buffs.bm_primal || p.buffs.bm_avatar);
function bmFormAct(id, lv, dur, fx, col) {
  return { name: id, clip: 'bmPose', dur: 0.6, noCounter: true, invul: true, onStart: e => {
    if (!toggleBuff(e, id, dur, { lv, ...fx })) return; delete e.buffs[id === 'bm_avatar' ? 'bm_primal' : 'bm_avatar']; sfx.awaken(); cam.shake = Math.max(cam.shake, 5); fxShock(e.x, e.y, 180, col); bmAuraFx(e, col, dur, id); } };
}
defSkill('bm_avatar', { name: '使徒化身', cls: 'mage', job: BM, tier: 2, lvReq: 27, mp: 100, cd: 170, type: 'phys', buff: true, col: '#ffd23a', ai: { kind: 'buff' },
  desc: '【变身】40 秒内常驻霸体、几乎不受异常状态影响，攻击速度、移动速度和技能攻击力提高，斗神意志至少保持 3 段；受到致死伤害时留 1 点 HP 并解除变身。再按一次解除。',
  infoExtra: lv => [['攻速 / 移速', '+' + pct(0.1 + 0.01 * lv)], ['技能攻击力', '+' + pct(0.05 + 0.01 * lv)]],
  act: (lv) => bmFormAct('bm_avatar', lv, 40, { aspd: 0.1 + 0.01 * lv, mspd: 0.1 + 0.01 * lv, dmg: 0.05 + 0.01 * lv }, '#ffd23a') });
// ---- 三觉段 ----
defSkill('bm_ancient', { name: '太古之力', cls: 'mage', job: BM, tier: 3, lvReq: 29, passive: true, type: 'phys', col: '#ffe070',
  desc: '【被动·三觉】炫纹的命中增益变成常驻；技能攻击力提高。', infoExtra: lv => [['技能攻击力', '+' + pct(0.08 + 0.02 * lv)]] });
defSkill('bm_light', { name: '炫纹之源：太古神光', cls: 'mage', job: BM, tier: 3, lvReq: 29, mp: 150, cd: 50, type: 'phys', col: '#fff0a0',
  desc: '化身普希娅，吸收身边最多 10 个炫纹（不够也能放），向前一记大范围突刺。每吸收一个炫纹伤害 +5%。', pow: lv => skillDmg(30, 3, lv), ai: { kind: 'burst', r: [0, 420], dy: 60 },
  act: (lv) => ({ name: 'bm_light', clip: 'bmLunge', dur: 1.2, superArmor: true, noCounter: true, invul: [0, 0.9],
    onStart: e => { const L = e.chasers || [], n = Math.min(10, L.length); L.splice(0, n); e.act.n = n; if (n) chaserOrbit(e); bmAuraFx(e, '#fff0a0', 1.2); fxText(`炫纹 ×${n}`, e.x, e.y, e.z + 40, { col: '#fff0a0', size: 11, dur: 0.6 }); },
    update: e => { if (e.actT < 0.5 && Math.random() < 0.7) fxCharge(e, '#fff0a0'); },
    events: [evAt(0.5, e => { sfx.iai(); cam.shake = Math.max(cam.shake, 8); fxBeam(e.x + e.face * 30, e.y, e.z + 70, 440, e.face, { w: 60, col: '#fff0a0', dur: 0.35 }); fxStreak({ x: e.x, y: e.y, z: e.z + 70, face: e.face, len: 460, w: 16, col: '#ffffff', dur: 0.3 });
      instantHit(e, { box: [0, 460, 60, 0, 160], dmg: skillDmg(30, 3, lv) * (1 + 0.05 * e.act.n), launch: 300, knock: 200, hs: 0.14, big: 1.8, type: 'phys', col: '#fff6c0', downHit: true }); })] }) });
defSkill('bm_primal', { name: '太古化身', cls: 'mage', job: BM, tier: 3, lvReq: 30, mp: 150, cd: 180, type: 'phys', buff: true, col: '#8ac8ff', ai: { kind: 'buff' },
  desc: '【变身】和使徒化身同类，80 秒，数值更高（两种变身不能同时存在）。再按一次解除。', infoExtra: lv => [['攻速 / 移速', '+' + pct(0.15 + 0.01 * lv)], ['技能攻击力', '+' + pct(0.1 + 0.015 * lv)]],
  act: (lv) => bmFormAct('bm_primal', lv, 80, { aspd: 0.15 + 0.01 * lv, mspd: 0.15 + 0.01 * lv, dmg: 0.1 + 0.015 * lv }, '#8ac8ff') });
defSkill('bm_awaken3', { name: '太古星河·殒灭', cls: 'mage', job: BM, tier: 3, lvReq: 30, maxLv: 3, mp: 300, cd: 270, pvp: 0.45, type: 'phys', awaken: true, col: '#8ac8ff',
  desc: '【三次觉醒】5 连斩 → 把矛刺上星河 → 掷矛 → 飞踢把矛踩进地里 → 拔矛横扫 → 星河爆炸。全程无敌。', pow: lv => skillDmg(46, 12, lv), ai: { kind: 'awaken', r: [0, 420], dy: 100 },
  act: (lv) => ({ name: 'bm_awaken3', clip: 'bmGalaxy', dur: 4.0, superArmor: true, noCounter: true, invul: true,
    onStart: e => { game.cutin = { t: 0, dur: 1.2, name: '太古星河·殒灭', who: cutinWho(e, 3) }; game.timeStop = 1.0; sfx.awaken(); bmAuraFx(e, '#8ac8ff', 4.0); const R = game.room, x = e.x + e.face * 170; e.act.cx = R ? clamp(x, R.x0 + 60, R.x1 - 60) : x; e.act.cy = e.y; },
    events: [...[1.0, 1.12, 1.24, 1.36, 1.48].map((t, i) => evAt(t, e => { sfx.swing(i === 4); fxSlash({ x: e.x, y: e.y, z: e.z, face: e.face, col: i % 2 ? '#ffe070' : CHASER_COL, a0: i % 2 ? 1.2 : -1.4, a1: i % 2 ? -1.4 : 1.2, r: 120, w: 18, off: [20, 60], dur: 0.18 });
        blast(e, e.x + e.face * 90, e.y, 110, { dmg: skillDmg(2.4, 0.6, lv), stun: 0.6, knock: 10, hs: 0.04, type: 'phys', col: '#dfe8ff', sure: true, noChaser: true }, { zMax: 220 }); })),
      evAt(1.6, e => { sfx.charge(); bmGalaxyFx(e.act.cx, e.act.cy, 2.2); fxBeam(e.x + e.face * 20, e.y, e.z + 90, 200, e.face, { w: 24, col: '#ffe070', dur: 0.3 }); }),
      evAt(1.9, e => { sfx.swing(true); bmSpearFx(e.act.cx, e.act.cy, 1.0, '#8ac8ff', true); }),
      evAt(2.25, e => { const a = e.act; sfx.boom(1.0); cam.shake = 9; fxShock(a.cx, a.cy, 260, '#8ac8ff'); blast(e, a.cx, a.cy, 160, { dmg: skillDmg(8, 2, lv), launch: 260, knock: 40, hs: 0.1, type: 'phys', col: '#8ac8ff', sure: true, downHit: true, noChaser: true }, { zMax: 240 }); }),
      evAt(2.75, e => { sfx.swing(true); fxSlash({ x: e.x, y: e.y, z: e.z, face: e.face, col: '#ffe070', a0: -1.8, a1: 1.4, r: 260, w: 34, off: [20, 60], dur: 0.3 });
        instantHit(e, { box: [-40, 420, 110, 0, 240], dmg: skillDmg(8, 2, lv), launch: 300, knock: 120, hs: 0.1, sure: true, downHit: true, type: 'phys', col: '#ffe070', noChaser: true }); }),
      evAt(3.3, e => { const a = e.act; cam.flash = 0.35; cam.flashCol = '#e0f0ff'; cam.shake = 15; sfx.boom(1.5); fxShock(a.cx, a.cy, 520, '#8ac8ff'); fxShock(a.cx, a.cy, 400, '#ffe070'); fxBurst(a.cx, a.cy, 120, 500, '#dfe8ff');
        blast(e, a.cx, a.cy, 330, { dmg: skillDmg(26, 7, lv), launch: 520, knock: 220, hs: 0.16, big: 2.2, type: 'phys', col: '#ffffff', sure: true, downHit: true, noChaser: true }, { zMax: 320 }); e.invul = Math.max(e.invul, 0.8); })] }) });
// ---- 登记 ----
CLASSES.mage.jobs.battlemage.skills.push('bm_flashsmash', 'bm_descent', 'bm_potential', 'bm_cluster', 'bm_apostledance', 'bm_awaken2', 'bm_avatar', 'bm_ancient', 'bm_light', 'bm_primal', 'bm_awaken3');
CLASSES.mage.cmds.push(['bdb', 'bm_flashsmash'], ['udf', 'bm_descent'], ['dud', 'bm_cluster'], ['fbf', 'bm_apostledance'], ['ddff', 'bm_awaken2'], ['dbu', 'bm_avatar', 'buff'], ['fdu', 'bm_light'], ['dbub', 'bm_primal', 'buff'], ['ffdd', 'bm_awaken3']);
CLASSES.mage.passives.push(p => {
  if (jobOf(p) !== BM) return;
  const po = skLv(p, 'bm_potential'); setPassive(p, 'bm_potential', po > 0, { dmg: 0.12 + 0.02 * po, crit: 0.05 });
  const an = skLv(p, 'bm_ancient'); setPassive(p, 'bm_ancient', an > 0, { dmg: 0.08 + 0.02 * an }); if (an > 0 && hasSkill(p, 'bm_chaser')) chaserBuff(p);
  const F = bmForm(p);
  if (F) { p.superArmor = Math.max(p.superArmor || 0, 0.3); if (!p.statusImmune || p.statusImmune === BM_FORM_IMMUNE) p.statusImmune = BM_FORM_IMMUNE; if (skLv(p, 'bm_will') > 0 && (p._will || 0) < 3) p._will = 3;
    if (p.hp <= 1) { delete p.buffs.bm_avatar; delete p.buffs.bm_primal; fxText('解除变身', p.x, p.y, p.z + 40, { col: '#ffd23a', size: 11 }); } }
  else if (p.statusImmune === BM_FORM_IMMUNE) p.statusImmune = null;
});
{ const bh0 = CLASSES.mage.beforeHurt;
  CLASSES.mage.beforeHurt = (t, a, h, opt) => { const r = bh0 ? bh0(t, a, h, opt) : null; if (jobOf(t) !== BM || !bmForm(t) || (r && r.block)) return r; return { ...(r || {}), minHp: 1 }; }; }
