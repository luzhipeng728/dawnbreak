/* =====================================================================
   元素师 P1（一觉之后）：元素之幕、元素震荡、元素奥义、圣灵符文、圣灵水晶、元素之门、二觉“第六元素”、
   元素之源、光与暗的交响、三觉“宇宙寂灭：冰火之歌”（docs/SKILLS_OFFICIAL_mage.md 3.1，等级按 1.1 压缩）
   光幕 / 水晶 / 奇点 / 行星都在运行时画（source-over + lighter），动作帧见 sprites.js 的 el* 片段
   ===================================================================== */
const ELC = ['#ff9a50', '#9fe6ff', '#fff38a', '#c79aff'];
// 延时效果：施法者已经死亡 / 离场时不再生效（魔法师三个转职的 P1 共用）
function mgAfter(e, t, fn) { game.after(t, () => { if (!e.dead && !e.remove && ents.indexOf(e) >= 0) fn(); }); }
// 把范围内的敌人拉向一点（首领只拉一半）
function mgPull(e, cx, cy, r, k) { for (const t of ents) if (foe(e, t) && !t.dead && t.invul <= 0 && inGround(t, cx, cy, r)) { const m = t.boss ? k * 0.5 : k; t.x += (cx - t.x) * m; t.y += (cy - t.y) * m; } }
function elCurtainFx(x, y, r, dur) {
  addFx({ x, y: y + 1, z: 0, dur, draw(c) {
    const k = this.t / this.dur, a = k < 0.08 ? k / 0.08 : k > 0.9 ? (1 - k) / 0.1 : 1, X = sx(this.x), Y = sy(this.y, 0);
    c.save(); c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 9; i++) { const u = (i / 8 - 0.5) * 2 * r, w = 9 + 5 * Math.sin(game.t * 9 + i);
      c.globalAlpha = 0.32 * a * (0.7 + 0.3 * Math.sin(game.t * 13 + i * 1.7)); c.fillStyle = ELC[i % 4]; c.fillRect(X + u - w / 2, Y - 290, w, 290); }
    c.globalAlpha = 0.8 * a; drawSpr(c, fxTint('hexagram', '#ffe8ff'), X, Y - 290, r * 2.4, r * 0.7, { rot: game.t }); c.restore(); } });
}
function elRingFx(x, y, r, dur, col) {
  addFx({ x, y: y - 1, z: 0, dur, draw(c) { const k = this.t / this.dur, a = k < 0.1 ? k * 10 : k > 0.85 ? (1 - k) / 0.15 : 1;
    c.save(); c.translate(sx(this.x), sy(this.y, 0)); c.scale(1, GR); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.65 * a;
    drawSpr(c, fxTint('hexagram', col), 0, 0, r * 2, r * 2, { rot: game.t * 0.8 }); c.restore(); } });
}
function elCrystalFx(x, y, grow) {
  elRingFx(x, y, 120, grow + 0.2, '#bfe8ff');
  addFx({ x, y: y + 1, z: 0, dur: grow + 0.15, draw(c) { const k = Math.min(1, this.t / grow), s = 0.25 + 0.75 * k, X = sx(this.x), Y = sy(this.y, 0);
    c.save(); drawSpr(c, fxTint('icespike', '#e8f6ff'), X, Y, 110 * s, 170 * s, { ay: 1 });
    c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.3 + 0.4 * k * (0.6 + 0.4 * Math.sin(game.t * 12)); drawSpr(c, fxTint('orb', '#bfe8ff'), X, Y - 80 * s, 140 * s, 140 * s, {}); c.restore(); } });
}
// 元素之门：跟着目标移动的门
function elGateFx(t, col, dur) {
  addFx({ x: t.x, y: t.y + 0.5, z: 0, dur, tg: t,
    draw(c) { const g = this.tg, k = this.t / this.dur, a = k < 0.1 ? k * 10 : k > 0.85 ? (1 - k) / 0.15 : 1; if (!g) return; this.x = g.x; this.y = g.y + 0.5;
      const X = sx(g.x), Y = sy(g.y, g.z + g.h * (g.scale || 1) + 55); c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.85 * a;
      drawSpr(c, fxTint('hexagram', col), X, Y, 64, 22, { rot: game.t * 2 }); c.globalAlpha = 0.5 * a; drawSpr(c, fxTint('orb', col), X, Y, 30, 30, {}); c.restore(); } });
}
function elShardDrop(t, col) {
  addFx({ tg: t, x: t.x, y: t.y + 0.6, z: 0, dur: 0.16, draw(c) { const g = this.tg, k = this.t / this.dur, top = g.z + g.h * (g.scale || 1) + 50, z = top - (top - g.z - g.h * 0.5) * k;
    drawSpr(c, fxTint('icespike', col), sx(g.x), sy(g.y, z), 22, 40, { rot: Math.PI }); } });
}
// 第六元素：四色元素绕着一点收缩的奇点
function elSingularityFx(x, y, dur) {
  addFx({ x, y: y + 1, z: 0, dur, draw(c) { const k = this.t / this.dur, g = Math.min(1, k * 3), X = sx(this.x), Y = sy(this.y, 90);
    c.save(); c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 12; i++) { const a = game.t * (5 + i * 0.3) + i * TAU / 12, rr = (40 + 90 * ((i * 37 + this.t * 160) % 100) / 100) * g;
      c.globalAlpha = 0.8; drawSpr(c, fxTint('orb', ELC[i % 4]), X + Math.cos(a) * rr, Y + Math.sin(a) * rr * 0.55, 22, 22, {}); }
    c.globalAlpha = 0.9; drawSpr(c, fxTint('orb', '#ffffff'), X, Y, 40 + 50 * g + Math.sin(game.t * 20) * 6, 40 + 50 * g, {});
    drawSpr(c, fxTint('vortex', '#e0d0ff'), X, Y, 170 * g, 100 * g, { rot: -game.t * 4 }); c.restore(); } });
}
// 宇宙寂灭：周围一块地面被掀进宇宙（画在人物后面的星空），燃烧行星和冰冻行星从两边撞过来
function elCosmosFx(cx, cy, dur, hit) {
  const stars = Array.from({ length: 70 }, () => [Math.random(), Math.random(), 0.5 + Math.random() * 1.5]);
  addFx({ x: cx, y: -20, z: 0, dur, draw(c) { const k = this.t / this.dur, a = Math.min(1, this.t / 0.4) * (k > 0.92 ? (1 - k) / 0.08 : 1), W = c.canvas.width, H = c.canvas.height;
    c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 0.82 * a; c.fillStyle = '#070418'; c.fillRect(0, 0, W, H);
    c.globalCompositeOperation = 'lighter'; c.fillStyle = '#ffffff';
    for (const [u, v, s] of stars) { c.globalAlpha = a * (0.4 + 0.6 * Math.abs(Math.sin(game.t * 2 + u * 40))); c.fillRect(u * W, v * H * 0.8, s * 2, s * 2); }
    c.globalAlpha = 0.35 * a; drawSpr(c, fxTint('vortex', '#6a3ab0'), W * 0.5, H * 0.3, W * 0.8, H * 0.5, { rot: game.t * 0.1 }); c.restore(); } });
  addFx({ x: cx, y: cy + 3, z: 0, dur, draw(c) { const t = this.t, m = clamp((t - 0.3) / (hit - 0.3), 0, 1), e = m * m, Y = sy(this.y, 150);
    if (t > hit + 0.1) return;
    for (const [side, col, core] of [[-1, '#ff6a2a', '#ffcf80'], [1, '#6ad0ff', '#e8faff']]) { const X = sx(this.x + side * (820 - 740 * e)), R = 110;
      c.save(); c.fillStyle = side < 0 ? '#5a1a08' : '#0a3a5a'; c.beginPath(); c.arc(X, Y, R * 0.8, 0, TAU); c.fill();
      c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.9; drawSpr(c, fxTint('orb', col), X, Y, R * 2.2, R * 2.2, {}); c.globalAlpha = 0.5; drawSpr(c, fxTint('orb', core), X - side * 20, Y - 20, R, R, {}); c.restore(); } } });
}
// ---- 一觉段 ----
defSkill('el_curtain', { name: '元素之幕', cls: 'mage', job: EL, tier: 1, lvReq: 23, mp: 60, cd: 20, type: 'mag', elemNote: 'all', col: '#e0a0ff', cast: true,
  desc: '在前方上空展开魔法阵，倾泻彩虹光幕：3 秒 20 段伤害，最后结晶碎裂再打一次大伤害。蓄气（最长 1 秒）扩大范围。放出后马上就能行动。', pow: lv => skillDmg(12, 1.2, lv), ai: { kind: 'aoe', r: [60, 320], dy: 60 },
  act: (lv, p) => ({ name: 'el_curtain', clip: 'elCurtain', dur: 0.55, cancelFrom: 0.4, noCounter: true, charge: mCharge(p, 1.0, '#e0a0ff', { at: 0.08 }),
    events: [evAt(0.2, e => { const at = aimAhead(e, 200, 340), r = 90 * (1 + (e.act.chargeK || 0) * 0.3); sfx.magic(); elCurtainFx(at.x, at.y, r, 3.25);
      for (let i = 0; i < 20; i++) mgAfter(e, 0.1 + i * 0.15, () => blast(e, at.x, at.y, r, { dmg: skillDmg(0.4, 0.04, lv), stun: 0.25, knock: 0, hs: 0.02, type: 'mag', col: ELC[i % 4], elem: ELEM4[i % 4][0] }, { zMax: 260 }));
      mgAfter(e, 3.2, () => { sfx.ice(); fxBurst(at.x, at.y, 80, 220, '#e0f0ff'); fxShock(at.x, at.y, r * 1.6, '#e0a0ff');
        blast(e, at.x, at.y, r * 1.2, { dmg: skillDmg(4, 0.4, lv), launch: 300, knock: 80, hs: 0.08, big: 1.3, type: 'mag', col: '#ffffff', downHit: true }, { zMax: 260 }); }); })] }) });
defSkill('el_quake', { name: '元素震荡', cls: 'mage', job: EL, tier: 1, lvReq: 25, mp: 80, cd: 30, type: 'mag', elemNote: 'all', col: '#c08aff', cast: true,
  desc: '在身前展开巨大的魔法阵引发地震：3 段伤害并把范围内的敌人定住约 2.5 秒，最后从地下爆发。施法约 1.75 秒，期间霸体。蓄气（最长 1.5 秒）扩大范围。', pow: lv => skillDmg(14, 1.4, lv), ai: { kind: 'aoe', r: [0, 220], dy: 80 },
  act: (lv, p) => ({ name: 'el_quake', clip: 'elQuake', dur: 1.95, superArmor: true, noCounter: true, charge: mCharge(p, 1.5, '#c08aff', { at: 0.08 }),
    events: [...[0.3, 0.75, 1.2].map((t, i) => evAt(t, e => { const a = e.act; if (!a.r) { a.r = 190 * (1 + (a.chargeK || 0) * 0.3); a.cx = e.x + e.face * 60; a.cy = e.y; elRingFx(a.cx, a.cy, a.r, 1.6, '#c08aff'); }
        sfx.boom(0.5 + i * 0.1); cam.shake = Math.max(cam.shake, 3 + i); fxShock(a.cx, a.cy, a.r, ELC[i]); fxDust(a.cx, a.cy, 8, a.r * 0.6);
        blast(e, a.cx, a.cy, a.r, { dmg: skillDmg(2.4, 0.24, lv), stun: 0.5, knock: 0, hs: 0.04, type: 'mag', col: ELC[i], downHit: true }, { zMax: 60, status: 'root', sdur: 2.5 }); })),
      evAt(1.75, e => { const a = e.act; sfx.boom(1.1); cam.shake = Math.max(cam.shake, 8); fxBurst(a.cx, a.cy, 30, a.r * 1.4, '#e0c0ff');
        blast(e, a.cx, a.cy, a.r, { dmg: skillDmg(6.8, 0.68, lv), launch: 420, knock: 60, hs: 0.1, big: 1.6, type: 'mag', col: '#ffffff', downHit: true }, { zMax: 120 }); })] }) });
// ---- 二觉段 ----
defSkill('el_arcana', { name: '元素奥义', cls: 'mage', job: EL, tier: 2, lvReq: 26, passive: true, type: 'mag', col: '#ffd0f0',
  desc: '【被动·二觉】技能攻击力提高。天雷、极冰盛宴、湮灭黑洞、杰克降临变成全属性技能：施放时一次点亮全部元素标记。', infoExtra: lv => [['技能攻击力', '+' + pct(0.18 + 0.02 * lv)]] });
defSkill('el_rune', { name: '圣灵符文', cls: 'mage', job: EL, tier: 2, lvReq: 26, mp: 60, cd: 10, type: 'mag', buff: true, col: '#fff0a0', ai: { kind: 'buff' },
  desc: '【BUFF】合并了元素点燃和魔法秀：施放时同时开启元素点燃；施放速度和魔法暴击率提高；四个元素标记全部亮起时自动施放一次魔法秀（当前全部技能冷却减少 20%，每 20 秒最多一次）。',
  infoExtra: lv => [['施放速度', '+' + pct(0.1 + 0.01 * lv)], ['魔法暴击率', '+' + pct(0.05 + 0.005 * lv)]],
  act: (lv) => ({ name: 'el_rune', clip: 'elCurtain', dur: 0.6, noCounter: true, onStart: e => { e.buffs.el_rune = { t: 1e9, lv, cspd: 0.1 + 0.01 * lv, crit: 0.05 + 0.005 * lv };
    if (!e.buffs.el_burn) e.buffs.el_burn = { t: 1e9, lv: Math.max(1, skLv(e, 'el_burn')), marks: { fire: 0, ice: 0, light: 0, dark: 0 }, last: null, dmg: 0 };
    elBurnFx(e); sfx.buff(); fxAura(e, '#fff0a0'); elRingFx(e.x, e.y, 90, 0.8, '#fff0a0'); } }) });
defSkill('el_crystal', { name: '圣灵水晶', cls: 'mage', job: EL, tier: 2, lvReq: 26, mp: 100, cd: 40, type: 'mag', elemNote: 'all', col: '#bfe8ff', cast: true,
  desc: '在前方放下魔法阵，水晶约 3 秒内慢慢长大（这段时间没有伤害），长满后一次性大爆炸。放下后马上就能行动。蓄气（最长 1 秒）扩大爆炸范围。', pow: lv => skillDmg(22, 2.2, lv), ai: { kind: 'aoe', r: [60, 300], dy: 60 },
  act: (lv, p) => ({ name: 'el_crystal', clip: 'elCrystal', dur: 0.6, cancelFrom: 0.45, noCounter: true, charge: mCharge(p, 1.0, '#bfe8ff', { at: 0.08 }),
    events: [evAt(0.25, e => { const at = aimAhead(e, 170, 300), r = 130 * (1 + (e.act.chargeK || 0) * 0.3); sfx.magic(); elCrystalFx(at.x, at.y, 3.0);
      mgAfter(e, 3.0, () => { sfx.boom(1.2); cam.shake = Math.max(cam.shake, 8); cam.flash = 0.15; cam.flashCol = '#e0f4ff'; fxShock(at.x, at.y, r * 1.8, '#bfe8ff'); fxBurst(at.x, at.y, 60, r * 2, '#ffffff');
        blast(e, at.x, at.y, r, { dmg: skillDmg(22, 2.2, lv), launch: 420, knock: 140, hs: 0.12, big: 1.8, type: 'mag', col: '#bfe8ff', downHit: true, sure: true }, { zMax: 260 }); }); })] }) });
defSkill('el_gate', { name: '元素之门', cls: 'mage', job: EL, tier: 2, lvReq: 26, mp: 120, cd: 45, type: 'mag', col: '#ffd070', cast: true,
  req: p => ents.some(t => foe(p, t) && !t.dead && Math.abs(t.x - p.x) < 520 && Math.abs(t.y - p.y) < 200) || '附近没有敌人',
  desc: '附近有敌人才能施放。在最多 20 个敌人头顶各打开一扇元素之门，门跟着目标移动，每 0.2 秒落下一颗结晶，共 10 颗。施放时按方向键选属性：↑ 光、↓ 暗、← / → 火，不按为冰。门越少，每扇门的伤害越高。',
  pow: lv => skillDmg(16, 1.6, lv), ai: { kind: 'aoe', r: [0, 480], dy: 120 },
  act: (lv) => ({ name: 'el_gate', clip: 'elGate', dur: 0.7, cancelFrom: 0.5, noCounter: true,
    events: [evAt(0.3, e => { const dx = e.pad ? e.pad.dx() : 0, dy = e.pad ? e.pad.dy() : 0, [el, col] = ELEM4[dy < 0 ? 2 : dy > 0 ? 3 : dx ? 0 : 1];
      const L = ents.filter(t => foe(e, t) && !t.dead && t.invul <= 0 && Math.abs(t.x - e.x) < 520 && Math.abs(t.y - e.y) < 200).sort((a, b) => Math.abs(a.x - e.x) - Math.abs(b.x - e.x)).slice(0, 20);
      const per = skillDmg(1.6, 0.16, lv) * 3 / (2 + L.length); sfx.magic(); elNote(e, el);
      for (const t of L) { elGateFx(t, col, 2.25); for (let i = 0; i < 10; i++) mgAfter(e, 0.2 + i * 0.2, () => { if (t.dead || t.remove) return; elShardDrop(t, col);
        applyHit(e, t, { dmg: per, stun: 0.3, knock: 0, hs: 0.02, type: 'mag', elem: el, col, box: null }, { proj: true, src: { x: t.x - e.face * 10, y: t.y, z: t.z + 120, face: e.face } }); }); } })] }) });
defSkill('el_awaken2', { name: '第六元素', cls: 'mage', job: EL, tier: 2, lvReq: 27, maxLv: 3, mp: 200, cd: 140, pvp: 0.45, type: 'mag', elemNote: 'all', awaken: true, col: '#ffffff',
  desc: '【二次觉醒】把火、冰、光、暗全部元素聚到身前的一点，吸附周围的敌人，20 段伤害后引发超大爆炸。全程无敌。', pow: lv => skillDmg(34, 9, lv), ai: { kind: 'awaken', r: [0, 380], dy: 100 },
  act: (lv) => ({ name: 'el_awaken2', clip: 'elSixth', dur: 3.3, superArmor: true, noCounter: true, invul: true,
    onStart: e => { game.cutin = { t: 0, dur: 1.0, name: '第六元素', who: cutinWho(e, 2) }; game.timeStop = 0.9; sfx.awaken(); const R = game.room, x = e.x + e.face * 170; e.act.cx = R ? clamp(x, R.x0 + 60, R.x1 - 60) : x; e.act.cy = e.y; },
    update: e => { const a = e.act; if (e.actT < 1.0 || e.actT > 2.7) return; mgPull(e, a.cx, a.cy, 320, 0.06); const n = Math.floor((e.actT - 1.0) / 0.085);
      if (n !== a.n && n < 20) { a.n = n; blast(e, a.cx, a.cy, 150, { dmg: skillDmg(0.8, 0.2, lv), stun: 0.4, knock: 0, hs: 0.02, type: 'mag', col: ELC[n % 4], elem: ELEM4[n % 4][0], sure: true, downHit: true }, { zMax: 260 }); } },
    events: [evAt(0.95, e => { sfx.charge(); elSingularityFx(e.act.cx, e.act.cy, 1.9); }),
      evAt(2.8, e => { const a = e.act; cam.flash = 0.3; cam.flashCol = '#ffffff'; cam.shake = 14; sfx.boom(1.5); fxShock(a.cx, a.cy, 460, '#ffffff'); for (let i = 0; i < 4; i++) fxShock(a.cx, a.cy, 180 + i * 70, ELC[i]); fxBurst(a.cx, a.cy, 90, 480, '#fff6e0');
        blast(e, a.cx, a.cy, 300, { dmg: skillDmg(18, 5, lv), launch: 520, knock: 220, hs: 0.16, big: 2.2, type: 'mag', col: '#ffffff', sure: true, downHit: true }, { zMax: 280 }); e.invul = Math.max(e.invul, 0.8); })] }) });
// ---- 三觉段 ----
defSkill('el_source', { name: '元素之源', cls: 'mage', job: EL, tier: 3, lvReq: 29, passive: true, type: 'mag', col: '#fff6d0',
  desc: '【被动·三觉】元素点燃的标记亮起后不再熄灭；技能攻击力提高。', infoExtra: lv => [['技能攻击力', '+' + pct(0.08 + 0.02 * lv)]] });
defSkill('el_symphony', { name: '光与暗的交响', cls: 'mage', job: EL, tier: 3, lvReq: 29, mp: 150, cd: 50, type: 'mag', elem: 'light', col: '#fff6c0', cast: true,
  desc: '原地放出光与暗融合的巨大光束，约 15 段伤害。蓄气（最长 1.5 秒）让光束变粗。施放中霸体。', pow: lv => skillDmg(26, 2.6, lv), ai: { kind: 'burst', r: [0, 460], dy: 50 },
  act: (lv, p) => ({ name: 'el_symphony', clip: 'elBeam', dur: 2.1, superArmor: true, noCounter: true, charge: mCharge(p, 1.5, '#fff6c0', { at: 0.08, clip: 'elBeam' }),
    onStart: e => { elNote(e, 'dark'); },
    update: e => { const a = e.act; if (e.actT < 0.4 || e.actT > 1.9) return; const n = Math.floor((e.actT - 0.4) / 0.1), w = 26 * (1 + (a.chargeK || 0) * 0.8);
      if (n === a.n || n >= 15) return; a.n = n; if (n === 0) { sfx.zap(); cam.shake = Math.max(cam.shake, 4); }
      fxBeam(e.x + e.face * 34, e.y, e.z + 72, 470, e.face, { w: w * 1.6, col: '#fff6c0', dur: 0.14 }); fxBeam(e.x + e.face * 34, e.y, e.z + 72, 470, e.face, { w: w * 0.8, col: '#8a4ad0', dur: 0.14 });
      instantHit(e, { box: [20, 490, w, 20, 130], dmg: skillDmg(1.73, 0.17, lv), stun: 0.3, knock: 6, hs: 0.02, type: 'mag', elem: n % 2 ? 'dark' : 'light', col: n % 2 ? '#c79aff' : '#fff6c0', downHit: true, last: n === 14 }); } }) });
defSkill('el_awaken3', { name: '宇宙寂灭：冰火之歌', cls: 'mage', job: EL, tier: 3, lvReq: 30, maxLv: 3, mp: 300, cd: 180, pvp: 0.45, type: 'mag', elemNote: 'all', awaken: true, col: '#ff8a5a',
  desc: '【三次觉醒】把身边的一块大地掀进宇宙：燃烧的行星和冰冻的行星从两边撞上来把它粉碎，最后 7 段爆炸余波。范围内的敌人全程被困住。全程无敌。', pow: lv => skillDmg(46, 12, lv), ai: { kind: 'awaken', r: [0, 420], dy: 120 },
  act: (lv) => ({ name: 'el_awaken3', clip: 'elCosmos', dur: 5.0, superArmor: true, noCounter: true, invul: true,
    onStart: e => { game.cutin = { t: 0, dur: 1.2, name: '宇宙寂灭：冰火之歌', who: cutinWho(e, 3) }; game.timeStop = 1.0; sfx.awaken(); const R = game.room, x = e.x + e.face * 150; e.act.cx = R ? clamp(x, R.x0 + 80, R.x1 - 80) : x; e.act.cy = e.y; },
    update: e => { const a = e.act; if (e.actT < 1.1 || e.actT > 3.5) return; const n = Math.floor((e.actT - 1.1) / 0.3);
      if (n !== a.n) { a.n = n; blast(e, a.cx, a.cy, 300, { dmg: skillDmg(0.9, 0.25, lv), stun: 0.6, knock: 0, hs: 0.02, type: 'mag', col: n % 2 ? '#9fe6ff' : '#ff9a50', elem: n % 2 ? 'ice' : 'fire', sure: true, downHit: true }, { zMax: 300, status: 'root', sdur: 1.2 }); } },
    events: [evAt(1.05, e => { const a = e.act; sfx.charge(); cam.shake = Math.max(cam.shake, 5); elCosmosFx(a.cx, a.cy, 3.9, 3.4 - 1.05); elRingFx(a.cx, a.cy, 300, 3.9, '#a080ff'); }),
      evAt(3.4, e => { const a = e.act; cam.flash = 0.35; cam.flashCol = '#fff0e0'; cam.shake = 16; sfx.boom(1.6); fxShock(a.cx, a.cy, 520, '#ff9a50'); fxShock(a.cx, a.cy, 420, '#9fe6ff'); fxBurst(a.cx, a.cy, 150, 520, '#ffe0c0');
        blast(e, a.cx, a.cy, 320, { dmg: skillDmg(22, 6, lv), launch: 480, knock: 200, hs: 0.16, big: 2.2, type: 'mag', col: '#ffffff', sure: true, downHit: true }, { zMax: 320 }); }),
      ...Array.from({ length: 7 }, (_, i) => evAt(3.6 + i * 0.16, e => { const a = e.act, x = a.cx + rnd(-220, 220), y = clamp(a.cy + rnd(-60, 60), 8, DEPTH - 8), [el, col] = ELEM4[i % 2 ? 1 : 0];
        sfx.boom(0.6); meteorImpact({ x, y }, 0.7); fxShock(x, y, 150, col); blast(e, x, y, 120, { dmg: skillDmg(2.6, 0.7, lv), launch: 320, knock: 60, hs: 0.05, type: 'mag', elem: el, col, sure: true, downHit: true }, { zMax: 260 }); }))] }) });
// ---- 登记 ----
CLASSES.mage.jobs.elemental.skills.push('el_curtain', 'el_quake', 'el_arcana', 'el_rune', 'el_crystal', 'el_gate', 'el_awaken2', 'el_source', 'el_symphony', 'el_awaken3');
CLASSES.mage.cmds.push(['fdd', 'el_curtain'], ['dud', 'el_quake'], ['ufd', 'el_rune', 'buff'], ['fud', 'el_crystal'], ['dff', 'el_gate'], ['duff', 'el_awaken2'], ['bfd', 'el_symphony'], ['ffdd', 'el_awaken3']);
CLASSES.mage.passives.push(p => {
  if (jobOf(p) !== EL) return;
  const ar = skLv(p, 'el_arcana'); setPassive(p, 'el_arcana', ar > 0, { dmg: 0.18 + 0.02 * ar });
  const so = skLv(p, 'el_source'); setPassive(p, 'el_source', so > 0, { dmg: 0.08 + 0.02 * so });
  const B = p.buffs.el_burn;
  if (p.buffs.el_rune && B && ['fire', 'ice', 'light', 'dark'].every(el => B.marks[el] > game.t) && game.t > (p._runeShow || 0)) {
    p._runeShow = game.t + 20; for (const k in p.cool) { const S = SKILLS[k]; if (S && !S.awaken) p.cool[k] *= 0.8; }
    fxText('魔法秀', p.x, p.y, p.z + 40, { col: '#fff0a0', size: 12, dur: 0.8 }); fxAura(p, '#fff0a0'); sfx.buff(); }
});
// 新技能也把属性记给元素点燃；元素奥义：四个招牌技能施放时点亮全部标记
for (const id of ['el_curtain', 'el_quake', 'el_crystal', 'el_awaken2', 'el_symphony', 'el_awaken3']) { const S = SKILLS[id], el = S.elemNote || S.elem, f = S.act; S.act = (lv, p) => { if (p && p.buffs && p.buffs.el_burn) elNote(p, el); return f(lv, p); }; }
for (const id of ['mg_thunder', 'mg_icefeast', 'mg_hole', 'mg_jackfall']) { const S = SKILLS[id], f = S.act; S.act = (lv, p) => { if (p && p.buffs && p.buffs.el_burn && hasSkill(p, 'el_arcana')) elNote(p, 'all'); return f(lv, p); }; }
