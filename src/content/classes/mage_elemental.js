/* =====================================================================
   转职：元素师（魔法师）—— 按国服现版对齐（docs/SKILLS_OFFICIAL_mage.md 3.1）
   被动 / BUFF：魔法记忆、移动施法（蓄气时可以走动）、元素点燃（轮换属性点亮标记加伤）、属性精通、魔力增幅
   技能：烈焰冲击（施法中移动魔法阵）、虚无之球、冰墙（再按撤掉）、雷旋、天雷（准星落雷 3 道）、极冰盛宴（引导，连按 X 加速）、
        湮灭黑洞（再按提前引爆）、杰克降临；觉醒 陨星幻灭（大魔导师）
   蓄气（mCharge，mage.js）：PvE 只放大范围，决斗场才加伤害
   ===================================================================== */
const EL = 'elemental';
// ---- 被动 / BUFF ----
defSkill('el_memorize', { name: '魔法记忆', cls: 'mage', job: EL, lvReq: 15, maxLv: 1, passive: true, type: 'mag', col: '#7a8ae0',
  desc: '【被动】施放速度提高、蓄气时间缩短；杰克爆弹、光电鳗、冰霜雪人、暗影夜猫的蓄气时间再额外缩短。', infoExtra: () => [['施放速度', '+25%'], ['蓄气时间', '-20%'], ['基础元素技能蓄气', '再 -26%']] });
defSkill('el_movecast', { name: '移动施法', cls: 'mage', job: EL, lvReq: 15, maxLv: 1, passive: true, type: 'mag', col: '#5ab0a0',
  desc: '【被动】蓄气期间可以自由走动（双击方向冲刺），蓄满后按住技能键一直保持满蓄，松开才发射；蓄着的技能可以带进下一个房间。蓄气中被击中则取消。对烈焰冲击、冰墙、陨星幻灭无效（它们不能蓄气）。' });
const elArc = p => !!p && hasSkill(p, 'el_arcana');
const elBest = p => { let b = 'fire', v = -1e9; for (const k of ['fire', 'ice', 'light', 'dark']) { const x = (p.elem && p.elem[k]) || 0; if (x > v) { v = x; b = k; } } return b; };   // 全属性技能：按自己属强最高的属性结算   // 二觉被动元素奥义：天雷 / 极冰盛宴 / 湮灭黑洞 / 杰克降临变成全属性（彩虹色）并获得特殊效果
const EL_MARK = { fire: '#ff9a50', ice: '#9fe6ff', light: '#fff38a', dark: '#c79aff' };
defSkill('el_burn', { name: '元素点燃', cls: 'mage', job: EL, lvReq: 16, mp: 30, cd: 5, type: 'mag', buff: true, col: '#e0703a', ai: { kind: 'buff' },
  desc: '【BUFF】身边出现火、冰、光、暗四个属性标记。施放一个和上一次属性不同的技能时，对应标记亮起 28 秒；亮起的标记越多，技能伤害越高。全属性技能一次点亮全部标记。',
  infoExtra: lv => [['1 / 2 / 3 / 4 个标记', [0.5, 1, 1.5, 2].map(m => pct(m * (0.01 + 0.004 * lv))).join(' / ')]],
  act: (lv) => ({ name: 'el_burn', clip: 'cheer', dur: 0.45, noCounter: true,
    onStart: e => { const b = e.buffs.el_burn; e.buffs.el_burn = { t: 1e9, lv, marks: b ? b.marks : { fire: 0, ice: 0, light: 0, dark: 0 }, last: b ? b.last : null, dmg: b ? b.dmg : 0 }; sfx.buff(); fxAura(e, '#ff9a50'); elBurnFx(e); } }) });
// 元素技能施放时记一下属性（所有魔法师技能的 act 都包了一层，见文件末尾）
function elNote(p, elem) {
  const B = p.buffs && p.buffs.el_burn; if (!B || !elem) return;
  const L = elem === 'all' ? ['fire', 'ice', 'light', 'dark'] : [elem], perm = hasSkill(p, 'el_source');
  for (const el of L) if (el !== B.last || elem === 'all') { B.marks[el] = perm ? 1e9 : game.t + 28; if (elem !== 'all') fxText(({ fire: '火', ice: '冰', light: '光', dark: '暗' })[el], p.x, p.y, p.z + 30, { col: EL_MARK[el], size: 10, dur: 0.5 }); }
  B.last = elem === 'all' ? B.last : elem;
}
function elBurnFx(p) {
  if (p._elFx && fxList.indexOf(p._elFx) >= 0) return;
  p._elFx = addFx({ ent: p, y: p.y, dur: 1e9, update() { const e = this.ent; this.y = e.y + 0.3; if (!e.buffs || !e.buffs.el_burn || e.dead || ents.indexOf(e) < 0) this.t = this.dur; },
    draw(c) { const e = this.ent, B = e.buffs.el_burn; if (!B) return; let i = 0;
      for (const el of ['fire', 'ice', 'light', 'dark']) { const on = B.marks[el] > game.t, a = game.t * 2 + i * TAU / 4, x = e.x + Math.cos(a) * 30, y = e.y + Math.sin(a) * 7, z = e.z + 70 + Math.sin(a * 2) * 4;
        drawSpr(c, fxTint('orb', EL_MARK[el]), sx(x), sy(y, z), on ? 16 : 9, on ? 16 : 9, { alpha: on ? 1 : 0.35 }); i++; } } });
}
defSkill('el_mastery', { name: '属性精通', cls: 'mage', job: EL, lvReq: 18, passive: true, type: 'mag', col: '#8a6ad8',
  desc: '【被动】普攻和元素技能的攻击力提高，全属性抗性提高。', infoExtra: lv => [['技能攻击力', '+' + pct(0.1 + 0.01 * lv)], ['全属性抗性', '+' + (5 + lv)]] });
defSkill('el_amplify', { name: '魔力增幅', cls: 'mage', job: EL, lvReq: 21, passive: true, type: 'mag', col: '#d05ae0',
  desc: '【被动·一觉】魔法攻击力和魔法暴击率提高。', infoExtra: lv => [['魔法攻击力', '+' + pct(0.06 + 0.01 * lv)], ['魔法暴击率', '+' + pct(0.05 + 0.005 * lv)]] });
// ---- 技能 ----
// 烈焰冲击：施法 0.7 秒内用方向键移动地面上的魔法阵，然后火柱喷出把敌人高高挑起（不能蓄气）
defSkill('mg_flame', { name: '烈焰冲击', cls: 'mage', job: EL, lvReq: 15, mp: 30, cd: 7, type: 'mag', elem: 'fire', icon: 'mg_flame', col: '#d8502a', cast: true,
  desc: '在前方地面展开魔法阵，施法期间可以用方向键移动魔法阵，随后火柱从地下喷出，把敌人高高挑起。可以放在自己脚下防身。', pow: lv => skillDmg(3.6, 0.36, lv), ai: { kind: 'aoe', r: [0, 320], dy: 70 },
  act: (lv) => ({ name: 'mg_flame', clip: 'flameCast', dur: 0.9, cancelFrom: 0.72, noCounter: true,
    onStart: e => { const at = aimAhead(e, 150, 320); e.act.cx = at.x; e.act.cy = at.y; },
    onInput: (e, I, dt) => { const a = e.act; if (e.actT > 0.62) return false; let mx = I.dx(), my = I.dy();
      if (!isHuman(e)) { const t = nearestFoe(e, 420); if (t) { mx = Math.sign(t.x - a.cx) * (Math.abs(t.x - a.cx) > 12); my = Math.sign(t.y - a.cy) * (Math.abs(t.y - a.cy) > 8); } }
      const d = dt || 1 / 60; a.cx += mx * 300 * d; a.cy = clamp(a.cy + my * 160 * d, 8, DEPTH - 8); e.vx = e.vy = 0; return false; },
    update: e => { const a = e.act; if (e.actT < 0.64) addFx({ x: a.cx, y: a.cy - 1, z: 0, dur: 0.02, draw(c) { c.save(); c.translate(sx(this.x), sy(this.y, 0)); c.scale(1, GR); c.rotate(game.t * 3); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.7; drawSpr(c, fxTint('hexagram', '#ff9a50'), 0, 0, 220, 220, {}); c.restore(); } }); },
    events: [evAt(0.64, e => { const a = e.act, hit = { dmg: skillDmg(0.72, 0.072, lv), stun: 0.3, launch: 360, knock: 10, hs: 0.03, rep: 0.14, max: 5, snd: 'fire', col: '#ffb060', elem: 'fire', type: 'mag' };
      if (hasSkill(e, 'el_source')) { elFrostFire(e, a.cx, a.cy, hit); return; }
      sfx.hit('fire', false); sfx.boom(0.4); fxShock(a.cx, a.cy, 110, '#ff9a50'); groundPillar(e, a.cx, a.cy, { life: 0.8, hit, bw: 96, bd: 44, ringW: 230, drawH: 230 }); for (const s of [-1, 1]) groundPillar(e, a.cx + s * 60, a.cy + s * 14, { life: 0.7, ring: false, drawH: 185 }); })] }) });
// 元素之源（三觉被动）改变的烈焰冲击：先向魔法阵一带喷出寒气把敌人冻住，再在每个被冻住的敌人脚下喷出火柱（冰火双属性，挑空率 85%）
function elFrostFire(e, cx, cy, hit) {
  sfx.ice(); fxSpr('frost', cx, cy, 0, { w: 360, dur: 0.5, ay: 0.8, add: false, grow: [0.5, 1.1] }); fxShock(cx, cy, 180, '#bfefff');
  const L = ents.filter(t => foe(e, t) && !t.dead && t.invul <= 0 && inGround(t, cx, cy, 180)).slice(0, 6);
  for (const t of L) addStatus(t, 'freeze', 0.5, { src: e });
  game.after(0.22, () => { if (e.dead) return; sfx.hit('fire', false); sfx.boom(0.5);
    const at = L.filter(t => !t.dead).map(t => ({ x: t.x, y: t.y })); if (!at.length) at.push({ x: cx, y: cy });
    for (const q of at) groundPillar(e, q.x, q.y, { life: 0.8, hit: { ...hit, launch: 306 }, bw: 56, bd: 30, ringW: 150, drawH: 200 }); });
}
// 虚无之球：缓慢前进的暗属性黑球，穿透敌人多段打击，射程很远；蓄气让球变大、飞得更远
defSkill('mg_void', { name: '虚无之球', cls: 'mage', job: EL, lvReq: 16, mp: 40, cd: 6, type: 'mag', elem: 'dark', col: '#4a1a6a', cast: true,
  desc: '向前射出一颗缓慢前进的暗属性虚无之球，贯穿路径上的敌人，每 0.3 秒造成一次伤害，射程很远。蓄气（最长 0.8 秒）让球变大、飞得更远。', pow: lv => skillDmg(4.2, 0.42, lv), ai: { kind: 'proj', r: [0, 520], dy: 24 },
  act: (lv, p) => ({ name: 'mg_void', clip: 'void', dur: 0.6, cancelFrom: 0.42, charge: mCharge(p, 0.8, '#c79aff', { at: 0.1, clip: 'mchan' }),
    events: [evAt(0.26, e => { sfx.charge(); const k = e.act.chargeK || 0, sc = 1 + k * 0.4;
      if (hasSkill(e, 'el_source')) { elFusionVoid(e, lv, sc); return; }
      shootProj(e, { img: 'darkorb', w: 110 * sc, speed: 170, life: (1150 + k * 250) / 170, z: 30, dx: 40, bw: 44 * sc, bh: 90 * sc, bd: 34 * sc, pierce: true, spin: 2, noFlip: true,
        hit: { dmg: skillDmg(0.3, 0.03, lv), stun: 0.35, knock: 10, airLift: 60, hs: 0.03, rep: 0.25, elem: 'dark', type: 'mag', col: '#c79aff' },
        onHitT: (pr, t) => { if (hasSA(t) || t.weight > 2 || t.fixed) return; t.x += clamp(pr.x - t.x, -10, 10); t.vx = pr.vx; },   // 缓慢的球把轻的敌人卷着走（多段）
        onEnd: pr => { fxBurst(pr.x, pr.y, pr.z + 30, 150 * sc, '#b070ff'); } }); })] }) });
// 元素之源改变的虚无之球：光暗强制融合的球出现在前方一片区域里原地震颤，14 段伤害后爆炸
function elFusionVoid(e, lv, sc) {
  const at = aimAhead(e, 220, 360), x = at.x, y = at.y, per = skillDmg(0.3, 0.03, lv);
  addFx({ x, y: y + 1, z: 0, dur: 1.75, draw(c) { const k = this.t / this.dur, g = Math.min(1, k * 6) * (k > 0.93 ? (1 - k) / 0.07 : 1), j = k > 0.1 ? 3 + 5 * k : 0,
    X = sx(this.x) + Math.sin(game.t * 70) * j, Y = sy(this.y, 60) + Math.cos(game.t * 55) * j * 0.6, R = 120 * sc * g;
    c.save(); c.globalCompositeOperation = 'lighter'; drawSpr(c, fxTint('orb', '#fff6c0'), X - R * 0.18, Y, R * 1.3, R * 1.3, {}); drawSpr(c, fxTint('vortex', '#c79aff'), X + R * 0.18, Y, R * 1.4, R * 1.4, { rot: -game.t * 6 }); c.restore();
    drawSpr(c, 'darkorb', X, Y, R * 0.8, R * 0.8, { rot: game.t * 4, add: false }); } });
  for (let i = 0; i < 14; i++) game.after(0.12 + i * 0.1, () => { if (e.dead) return; if (i % 3 === 0) sfx.zap();
    blast(e, x, y, 110 * sc, { dmg: per * 0.4, stun: 0.35, knock: 0, hs: 0.02, type: 'mag', elem: i % 2 ? 'dark' : 'light', col: i % 2 ? '#c79aff' : '#fff6c0', downHit: true }, { zMax: 140 }); });
  game.after(1.6, () => { if (e.dead) return; sfx.boom(0.8); cam.shake = Math.max(cam.shake, 5); fxBurst(x, y, 60, 230 * sc, '#e0c0ff'); fxShock(x, y, 150 * sc, '#fff6c0');
    blast(e, x, y, 150 * sc, { dmg: per * 2.4, launch: 300, knock: 100, hs: 0.08, big: 1.3, type: 'mag', elem: 'dark', col: '#e0c0ff', downHit: true }, { zMax: 200 }); });
}
// 冰墙：周身冰墙，把敌人推到圈外；敌人穿过冰墙会被减速；站在圈内自己获得霸体和减伤；再按一次技能键撤掉
defSkill('mg_icewall', { name: '冰墙', cls: 'mage', job: EL, lvReq: 17, mp: 45, cd: 15, type: 'mag', elem: 'ice', col: '#6ab8e8', cast: true,
  desc: '在自身周围升起一圈冰墙，造成伤害并把敌人推到圈外；冰墙持续 3 秒，敌人穿过时减速 50%。站在圈内时自己获得霸体，受到的伤害降低。再按一次技能键撤掉冰墙。', pow: lv => skillDmg(3.0, 0.3, lv), ai: { kind: 'aoe', r: [0, 160], dy: 70 },
  recast: { ok: p => { const w = p._icewall, d = w ? game.t - w.lastT : -1; return !!(w && w.alive && d >= 0 && d < 0.5); }, cd: 0.3, mp: 0, act: () => ({ name: 'mg_icewall', clip: 'wall', dur: 0.2, noCounter: true, onStart: e => { if (e._icewall) e._icewall.dur = 0; } }) },
  act: (lv) => ({ name: 'mg_icewall', clip: 'wall', dur: 0.6, cancelFrom: 0.45, superArmor: true, noCounter: true,
    events: [evAt(0.2, e => { sfx.ice(); sfx.boom(0.5); cam.shake = Math.max(cam.shake, 4); const cx = e.x, cy = e.y;
      blast(e, cx, cy, 160, { dmg: skillDmg(3.0, 0.3, lv), launch: 240, knock: 200, hs: 0.08, elem: 'ice', type: 'mag', col: '#bfefff' }, { zMax: 150 });
      const wall = e._icewall = { t: 0, dur: 3, alive: true, fx: [] };
      for (let i = 0; i < 10; i++) { const a = i / 10 * TAU; wall.fx.push(fxSpr('icewall', cx + Math.cos(a) * 145, cy + Math.sin(a) * 62, 0, { w: 150, dur: 3, ay: 0.9, add: false, grow: [0.3, 1], fadeIn: 0.03 }));
        wall.fx.push(fxSpr('icespike', cx + Math.cos(a) * 145, cy + Math.sin(a) * 62 + 1, 0, { h: 150, rot: -Math.PI / 2, dur: 3, ay: 0.5, alpha: 0.55, grow: [0.3, 1], fadeIn: 0.03 })); }   // 官方是一圈高高的蓝白冰柱
      wall.lastT = game.t; game.after(0.01, function tick() { wall.t += 0.1; wall.lastT = game.t; const inside = !e.dead && Math.hypot(e.x - cx, (e.y - cy) * 2.2) < 150;
        if (inside) { e.superArmor = Math.max(e.superArmor, 0.15); e.buffs.mg_icewall = { t: 0.15, taken: -0.3 }; }
        for (const t of ents) if (foe(e, t) && Math.abs(Math.hypot(t.x - cx, (t.y - cy) * 2.2) - 150) < 26) addStatus(t, 'slow', 3, { src: e });
        if (wall.t < wall.dur && !e.dead && ents.indexOf(e) >= 0) game.after(0.1, tick);
        else { wall.alive = false; for (const f of wall.fx) if (f) f.t = Math.max(f.t, f.dur - 0.2); fxBurst(cx, cy, 30, 230, '#bfefff'); } }); })] }) });
// 雷旋：一只大号光电鳗绕自身转一整圈，打击四周的敌人并击倒（地面 / 空中 / 倒地都打得到）；蓄气放大
defSkill('mg_vortex', { name: '雷旋', cls: 'mage', job: EL, lvReq: 17, mp: 40, cd: 8, type: 'mag', elem: 'light', col: '#e0c82a', cast: true,
  desc: '召唤一只大号光电鳗绕自身旋转一整圈，攻击周围所有敌人并把它们击倒（空中、倒地的敌人也打得到）。蓄气（最长 0.5 秒）让光电鳗变大。', pow: lv => skillDmg(3.8, 0.38, lv), ai: { kind: 'aoe', r: [0, 170], dy: 70 },
  act: (lv, p) => ({ name: 'mg_vortex', clip: 'thunderCast', dur: 0.75, cancelFrom: 0.62, charge: mCharge(p, 0.5, '#fff38a', { at: 0.05, clip: 'mchan' }),
    events: [evAt(0.1, e => { sfx.zap(); const sc = 1 + (e.act.chargeK || 0) * 0.2, R = 115 * sc, dir = e.face;
      spawnProj({ owner: e, x: e.x, y: e.y, z: 20, face: e.face, life: 0.6, w: 56 * sc, d: 36 * sc, h: 90 * sc, pierce: true,
        hit: { dmg: skillDmg(3.8, 0.38, lv), stun: 0.4, down: true, downLift: 200, knock: 160, radial: true, downHit: true, hs: 0.07, max: 1, elem: 'light', type: 'mag', col: '#fff6a0', snd: 'crit', big: 1.3 },
        update(pr) { const a = -Math.PI / 2 * dir + dir * pr.t / pr.life * TAU; pr.x = e.x + Math.cos(a) * R * dir; pr.y = clamp(e.y + Math.sin(a) * R * 0.42, 4, DEPTH - 4); pr.face = dir; },
        draw(c, pr) { drawSpr(c, 'eel', sx(pr.x), sy(pr.y, pr.z + 10), 120 * sc, 120 * sc, { rot: pr.t * 14 }); drawSpr(c, 'spark', sx(pr.x), sy(pr.y, pr.z + 10), 90 * sc, 90 * sc, { rot: -pr.t * 10 }); } }); fxShock(e.x, e.y, R + 55 * sc, '#fff6a0'); })] }) });
// 强化-天雷（官方以前的 TP 技能，35 级 → 本作 19 级）：天雷伤害 +55%，落雷间隔减半（自动落雷也更快），冷却固定 20 秒
const THUNDER_UP = { dmg: 0.55, cd: 20 };
defSkill('el_thunderup', { name: '强化-天雷', cls: 'mage', job: EL, lvReq: 19, maxLv: 1, passive: true, type: 'mag', elem: 'light', col: '#f0d83a', pre: { mg_thunder: 1 },
  desc: '【被动】强化天雷：天雷的伤害提高 55%，落雷的间隔减半（按 X 连续落雷、不操作时自动落雷都更快）；天雷的冷却时间固定为 20 秒。',
  infoExtra: () => [['天雷伤害', '+' + pct(THUNDER_UP.dmg)], ['落雷间隔', '-50%'], ['天雷冷却', THUNDER_UP.cd + ' 秒']] });
// 天雷：出现准星（方向键移动），按 X 在准星处落雷，共 3 道；期间霸体、自己不能移动，按跳跃提前结束；蓄满时雷更大、命中必定眩晕
defSkill('mg_thunder', { name: '天雷', cls: 'mage', job: EL, lvReq: 19, mp: 60, cd: 15, type: 'mag', elem: 'light', icon: 'mg_thunder', col: '#d8c82a', cast: true,
  desc: '一只手按在头上召来雷云，出现准星（方向键移动），按 X 在准星处落下天雷，共 3 道（一段时间不按会自动落下）。期间霸体、自己不能移动，按跳跃键提前结束。蓄气（最长 0.8 秒）蓄满时雷更大，命中必定眩晕。', pow: lv => skillDmg(2.2, 0.22, lv) * 3, ai: { kind: 'aoe', r: [40, 420], dy: 90 },
  act: (lv, p) => ({ name: 'mg_thunder', clip: 'thunderCast', dur: 5.2, noCounter: true, superArmor: true, cancelFrom: 0.6, charge: mCharge(p, 0.8, '#fff38a', { at: 0.05, clip: 'thunderCast', onRoom: e => { const at = aimAhead(e, 160, 420); e.act.cx = at.x; e.act.cy = at.y; } }),
    onStart: e => { const at = aimAhead(e, 160, 420); e.act.cx = at.x; e.act.cy = at.y; e.act.n = 0; e.act.cd = 0;
      if (hasSkill(e, 'el_thunderup')) { e.act.up = 1; if (!e.ghost) e.cool.mg_thunder = THUNDER_UP.cd * (e.cdMul || 1) * (game.pvp && SKILLS.mg_thunder.pvpCd ? SKILLS.mg_thunder.pvpCd : 1); } },
    onInput: (e, I, dt) => { const a = e.act; e.vx = e.vy = 0; if (!a.chargeDone) return false; const d = dt || 1 / 60;
      if (I.buffered('jump')) { I.consume('jump'); a.dur = e.actT + 0.1; return true; }
      if (isHuman(e)) { a.cx += I.dx() * 330 * d; a.cy = clamp(a.cy + I.dy() * 180 * d, 8, DEPTH - 8); } else { const t = nearestFoe(e, 520); if (t) { a.cx = damp(a.cx, t.x, 6, d); a.cy = damp(a.cy, t.y, 6, d); } }
      a.cx = clamp(a.cx, e.x - 500, e.x + 500);
      if (a.lastT === undefined) a.lastT = e.actT;
      const iv = a.up ? 0.5 : 1;   // 强化-天雷：落雷间隔减半
      const auto = isHuman(e) ? e.actT - a.lastT > 1.5 * iv : e.actT > 0.5 + a.n * 0.35 * iv;   // 一段时间不按 X 就自动落雷（官方 20 秒，本作压缩成 1.5 秒）
      if ((I.buffered('attack') || auto) && e.actT > a.cd && a.n < 3) { I.consume('attack'); a.n++; a.cd = e.actT + 0.25 * iv; a.lastT = e.actT; const big = (a.chargeK || 0) > 0.95, r = big ? 105 : 85;
        const rb = elArc(e), col = rb ? ELC[(a.n - 1) % 4] : '#fff6a0';   // 元素奥义：全属性（彩虹色），落雷把周围的敌人聚过来
        if (rb) { mgPull(e, a.cx, a.cy, r * 2.8, 0.75); fxShock(a.cx, a.cy, r * 2.2, col); }
        lightningStrike({ x: a.cx, y: a.cy }); fxShock(a.cx, a.cy, r, col); sfx.zap();
        blast(e, a.cx, a.cy, r, { dmg: skillDmg(2.2, 0.22, lv) * (a.up ? 1 + THUNDER_UP.dmg : 1), stun: 0.6, knock: 20, hs: 0.08, snd: 'crit', col, elem: rb ? elBest(e) : 'light', type: 'mag' }, { zMax: 220, status: big ? 'stun' : null, sdur: 1.2 });
        if (a.n >= 3) a.dur = e.actT + 0.35; }
      return true; },
    update: e => { const a = e.act; if (!a.chargeDone) return; addFx({ x: a.cx, y: a.cy + 1, z: 0, dur: 0.02, draw(c) { const X = sx(this.x), Y = sy(this.y, 0); c.strokeStyle = 'rgba(255,240,120,.85)'; c.lineWidth = 2; c.beginPath(); c.ellipse(X, Y, 85, 85 * GR, 0, 0, TAU); c.stroke(); c.beginPath(); c.moveTo(X - 95, Y); c.lineTo(X + 95, Y); c.moveTo(X, Y - 42); c.lineTo(X, Y + 42); c.stroke(); } }); } }) });
// 极冰盛宴：身前展开大魔法阵，冰柱连续突刺 8 段（几率冰冻）；引导施法：霸体、不能移动，连按 X 加快突刺，按跳跃中断；蓄满时阵内敌人减速
defSkill('mg_icefeast', { name: '极冰盛宴', cls: 'mage', job: EL, lvReq: 19, mp: 70, cd: 19, type: 'mag', elem: 'ice', col: '#3a8ae0', cast: true,
  desc: '在身前展开冰之魔法阵，阵内冰柱连续突刺 8 次，有几率冰冻敌人。引导施法期间霸体、不能移动；连按 X 加快突刺，按跳跃键中断。蓄气（最长 1 秒）蓄满时阵内敌人减速。', pow: lv => skillDmg(1.0, 0.1, lv) * 8, ai: { kind: 'aoe', r: [60, 320], dy: 80 },
  act: (lv, p) => ({ name: 'mg_icefeast', clip: 'wall', dur: 3.2, superArmor: true, noCounter: true, charge: mCharge(p, 1.0, '#bfefff', { at: 0.05, clip: 'mchan', onRoom: e => { const at = aimAhead(e, 180, 360); e.act.cx = at.x; e.act.cy = at.y; } }),
    onStart: e => { const at = aimAhead(e, 180, 360); e.act.cx = at.x; e.act.cy = at.y; e.act.n = 0; e.act.next = 0.35; },
    onInput: (e, I) => { const a = e.act; e.vx = e.vy = 0; if (!a.chargeDone) return false;
      if (I.buffered('jump')) { I.consume('jump'); a.dur = e.actT + 0.1; return true; }
      if (I.buffered('attack')) { I.consume('attack'); a.next = Math.max(e.actT + 0.05, a.next - 0.12); }
      return true; },
    update: e => { const a = e.act; if (!a.chargeDone) return;
      if (!a.tele) { a.tele = true; a.rb = elArc(e); sfx.ice(); telegraph({ x: a.cx, y: a.cy, r: 185, dur: 2.8, kind: 'frost', col: a.rb ? '#ffe8ff' : '#bfefff', friendly: true }); if ((a.chargeK || 0) > 0.95) for (const t of ents) if (foe(e, t) && inGround(t, a.cx, a.cy, 185)) addStatus(t, 'slow', 4, { src: e });
        if (a.rb) { const cx = a.cx, cy = a.cy; for (let i = 0; i < 8; i++) mgAfter(e, 0.35 + i * 0.26, () => icefeastSpike(e, cx, cy, lv, i, true)); a.n = 8; a.dur = e.actT + 0.35; return; } }   // 元素奥义：放下就走，魔法阵自己突刺
      if (e.actT >= a.next && a.n < 8) { icefeastSpike(e, a.cx, a.cy, lv, a.n, false); a.n++; a.next = e.actT + 0.26;
        if (a.n >= 8) a.dur = e.actT + 0.3; } } }) });
// 极冰盛宴的一次突刺：阵内随机位置冒出冰柱，整个魔法阵结算一次（几率冰冻）；rb = 元素奥义的全属性彩虹版
function icefeastSpike(e, cx, cy, lv, i, rb) {
  const x = cx + rnd(-150, 150), y = clamp(cy + rnd(-65, 65), 6, DEPTH - 6), col = rb ? ELC[i % 4] : '#bfefff'; sfx.ice();
  addFx({ x, y: y + 1, z: 0, dur: 0.35, draw(c) { const q = this.t / this.dur; drawSpr(c, rb ? fxTint('icespike', col) : 'icespike', sx(this.x), sy(this.y, 0) - 40 * (1 - Math.min(1, q * 4)), 0, 120, { rot: -Math.PI / 2, ay: 0.5, add: true, alpha: 1 - Math.max(0, q - 0.6) / 0.4 }); } });
  blast(e, cx, cy, 185, { dmg: skillDmg(1.0, 0.1, lv), stun: 0.4, airLift: 140, knock: 10, hs: 0.04, elem: rb ? elBest(e) : 'ice', type: 'mag', col, downHit: true }, { zMax: 200 });
  for (const t of ents) if (foe(e, t) && inGround(t, cx, cy, 185) && Math.random() < 0.08) addStatus(t, 'freeze', 1.2, { src: e });
}
// 湮灭黑洞：身前生成黑洞，4 秒内持续把敌人吸向中心、15 段伤害，最后爆炸把敌人炸飞；蓄气提高吸附速度；再按一次技能键提前引爆
defSkill('mg_hole', { name: '湮灭黑洞', cls: 'mage', job: EL, lvReq: 19, mp: 70, cd: 35, type: 'mag', elem: 'dark', icon: 'mg_hole', col: '#4a2a6a', cast: true,
  desc: '在前方制造黑洞，4 秒内持续把周围的敌人吸向中心并造成多段伤害，最后爆炸把它们炸飞。蓄气（最长 0.8 秒）提高吸附速度。再按一次技能键提前引爆。', pow: lv => skillDmg(8.5, 0.85, lv), ai: { kind: 'aoe', r: [80, 320], dy: 80 },
  recast: { ok: p => !!(p._hole && !p._hole.gone), cd: 0.3, mp: 0, act: () => ({ name: 'mg_hole', clip: 'grip', dur: 0.2, noCounter: true, onStart: e => { if (e._hole) e._hole.t = e._hole.life; } }) },
  act: (lv, p) => ({ name: 'mg_hole', clip: 'grip', dur: 0.7, superArmor: true, noCounter: true, cancelFrom: 0.5, charge: mCharge(p, 0.8, '#c79aff', { at: 0.1, clip: 'mchan' }),
    events: [evAt(0.15, e => { const at = aimAhead(e, 190, 320), pull = 2.2 * (1 + (e.act.chargeK || 0) * 0.25), rb = elArc(e), R = rb ? 396 : 360, el = rb ? elBest(e) : 'dark'; sfx.charge();   // 元素奥义：吸附范围 +10%、全属性
      const pr = e._hole = spawnProj({ owner: e, x: at.x, y: at.y, z: 20, face: e.face, life: 4, w: 66, d: 44, h: 110, pierce: true,
        hit: { dmg: skillDmg(0.27, 0.027, lv), stun: 0.35, knock: 0, airLift: 60, hs: 0.02, rep: 0.27, col: '#d0a0ff', elem: el, type: 'mag' },
        update(q, dt) { for (const t of ents) if (foe(e, t) && Math.hypot(t.x - q.x, t.y - q.y) < R && !(t.boss && hasSA(t)) && t.st !== 'held') { t.x = damp(t.x, q.x, pull, dt); t.y = damp(t.y, q.y, pull, dt); } },
        onEnd(q) { q.gone = true; sfx.boom(0.9); cam.shake = Math.max(cam.shake, 6); blast(e, q.x, q.y, 185, { dmg: skillDmg(4.5, 0.45, lv), launch: 400, knock: 160, hs: 0.1, big: 1.6, col: '#e0b0ff', elem: el, type: 'mag', downHit: true }, { zMax: 220 }); fxBurst(q.x, q.y, 40, 300, '#c080ff'); fxShock(q.x, q.y, 185, '#c080ff'); if (rb) for (let i = 0; i < 4; i++) fxShock(q.x, q.y, 220 + i * 40, ELC[i]); },
        draw(c, q) { const X = sx(q.x), Y = sy(q.y, q.z), k = q.t / q.life, s = Math.min(1, k * 8) * (k > 0.95 ? (1 - k) / 0.05 : 1); const HR = Math.max(0.5, 70 * s), gr = c.createRadialGradient(X, Y, HR * 0.2, X, Y, HR); gr.addColorStop(0, 'rgba(8,2,22,.96)'); gr.addColorStop(0.75, 'rgba(30,8,70,.9)'); gr.addColorStop(1, 'rgba(150,80,255,.85)'); c.fillStyle = gr; c.beginPath(); c.ellipse(X, Y, HR, HR * 0.85, 0, 0, TAU); c.fill();   // 官方是大块深紫黑球体加亮紫边
          
          if (rb) for (let i = 0; i < 4; i++) drawSpr(c, fxTint('vortex', ELC[i]), X, Y, (115 + i * 26) * s, (115 + i * 26) * s, { rot: -game.t * (4 + i) + i }); else { drawSpr(c, fxTint('vortex', '#5a20a0'), X, Y, 230 * s, 230 * s, { rot: -game.t * 5, alpha: 0.9 }); const g2 = c.createRadialGradient(X, Y, 2, X, Y, HR * 1.05); g2.addColorStop(0, 'rgba(6,2,16,.97)'); g2.addColorStop(0.7, 'rgba(14,4,36,.85)'); g2.addColorStop(1, 'rgba(14,4,36,0)'); c.fillStyle = g2; c.beginPath(); c.ellipse(X, Y, HR * 1.05, HR * 0.9, 0, 0, TAU); c.fill(); } } }); })] }) });
// 杰克降临：巨型南瓜斜着砸向前方——先小范围撞击（约两成伤害），落地冲击波大范围爆炸（约八成）；蓄气放大
defSkill('mg_jackfall', { name: '杰克降临', cls: 'mage', job: EL, lvReq: 20, mp: 60, cd: 45, type: 'mag', elem: 'fire', col: '#e0702a', cast: true,
  desc: '从天空召唤巨型南瓜斜着砸向前方：先是小范围的撞击，落地后冲击波大范围爆炸。每次南瓜的表情都不一样。蓄气（最长 1 秒）让南瓜和爆炸变大。', pow: lv => skillDmg(7.5, 0.75, lv), ai: { kind: 'aoe', r: [80, 320], dy: 60 },
  act: (lv, p) => ({ name: 'mg_jackfall', clip: 'jackfall', dur: 0.8, superArmor: true, noCounter: true, cancelFrom: 0.62, charge: mCharge(p, 1.0, '#ffb060', { at: 0.08, clip: 'mchan' }),
    events: [evAt(0.15, e => { const at = aimAhead(e, 200, 380), rb = elArc(e), sc = (1 + (e.act.chargeK || 0) * 0.2) * (rb ? 1.1 : 1), el = rb ? elBest(e) : 'fire', flip = Math.random() < 0.5; sfx.charge();   // 元素奥义：南瓜 +10%、全属性、落地后小陨石
      telegraph({ x: at.x, y: at.y, r: 180 * sc, dur: 0.75, kind: 'hex', col: '#ff9a3a', friendly: true, fire: g => { meteorImpact(g, 1.5 * sc); fxShock(g.x, g.y, 300 * sc, '#ffb060');
        blast(e, g.x, g.y, 75 * sc, { dmg: skillDmg(1.5, 0.15, lv), launch: 300, knock: 60, hs: 0.08, snd: 'fire', col: '#ffb060', elem: el, type: 'mag' }, { zMax: 200 });
        game.after(0.08, () => blast(e, g.x, g.y, 185 * sc, { dmg: skillDmg(6.0, 0.6, lv), launch: 460, knock: 160, hs: 0.12, big: 1.8, snd: 'fire', col: '#ffb060', elem: el, type: 'mag', downHit: true }, { zMax: 220 }));
        if (rb) for (let i = 0; i < 5; i++) mgAfter(e, 0.15 + i * 0.14, () => { const x = g.x + rnd(-180, 180) * sc, y = clamp(g.y + rnd(-70, 70), 6, DEPTH - 6), col = ELC[i % 4];
          addFx({ x, y: y + 2, z: 0, dur: 0.22, col, draw(c) { const k = this.t / this.dur; drawSpr(c, fxTint('meteor', this.col), sx(this.x) - 90 * (1 - k), sy(this.y, 0) - 200 * (1 - k), 48, 0, { ax: 0.8, ay: 0.82 }); } });
          mgAfter(e, 0.22, () => { meteorImpact({ x, y }, 0.55); blast(e, x, y, 90, { dmg: skillDmg(0.3, 0.03, lv), launch: 200, knock: 40, hs: 0.03, elem: el, type: 'mag', col, downHit: true }, { zMax: 200 }); }); }); } });
      const face = jackFace(e);
      addFx({ x: at.x, y: at.y + 2, z: 0, dur: 0.75, add: false, draw(c) { const k = this.t / this.dur; drawSpr(c, face, sx(this.x) - 240 * (1 - k), sy(this.y, 0) - 480 * (1 - k) - 55, 160 * sc, 0, { add: false, rot: k * 2, flip }); } }); })] }) });
// 杰克降临的南瓜每次换一张表情（坏笑 / 生气 / 吃惊 / 眨眼吐舌），不和上一次重复
const JACK_FACES = ['jackbig', 'jackbig2', 'jackbig3', 'jackbig4'];
function jackFace(e) { const L = JACK_FACES.filter(n => IMG['fx/' + n] && n !== e._jackFace); const n = L.length ? pick(L) : 'jackbig'; e._jackFace = n; return n; }
// 陨星幻灭（觉醒）：可移动的法阵落四属性结晶（移动时法阵缩小、落点更密）；按技能键或跳跃键砸下最后 5 颗大结晶并大爆炸收尾；全程无敌
const ELEM4 = [['fire', '#ff9a50'], ['ice', '#9fe6ff'], ['light', '#fff38a'], ['dark', '#c79aff']];
function astralFinale(e, lv) {
  const a = e.act; if (!a || a.fin) return; a.fin = true; a.dur = e.actT + 1.1;
  for (let i = 0; i < 5; i++) game.after(0.12 * i, () => { const [el, col] = ELEM4[i % 4], x = a.cx + rnd(-a.r, a.r) * 0.5, y = clamp(a.cy + rnd(-a.r, a.r) * 0.2, 6, DEPTH - 6);
    addFx({ x, y: y + 2, z: 0, dur: 0.3, col, draw(c) { const k = this.t / this.dur; drawSpr(c, 'elemmeteor', sx(this.x) - 160 * (1 - k), sy(this.y, 0) - 360 * (1 - k), 190, 0, { ax: 0.8, ay: 0.82 }); } });
    game.after(0.3, () => { meteorImpact({ x, y }, 1.2); blast(e, x, y, 125, { dmg: skillDmg(3, 0.9, lv), launch: 360, knock: 80, hs: 0.06, elem: el, type: 'mag', col, downHit: true, sure: true }, { zMax: 240 }); }); });
  game.after(0.9, () => { cam.flash = 0.2; cam.flashCol = '#fff0d0'; cam.shake = 10; sfx.boom(1.2); fxShock(a.cx, a.cy, a.r + 60, '#ffe070'); fxShock(a.cx, a.cy, a.r * 0.7, '#fff6d0'); blast(e, a.cx, a.cy, a.r + 60, { dmg: skillDmg(6, 1.8, lv), launch: 480, knock: 160, hs: 0.12, big: 2, type: 'mag', col: '#ffe070', downHit: true, sure: true }, { zMax: 260 }); });
}
defSkill('mg_awaken', { name: '陨星幻灭', cls: 'mage', job: EL, lvReq: 21, maxLv: 3, mp: 150, cd: 135, pvp: 0.45, type: 'mag', elemNote: 'all', awaken: true, icon: 'mg_awaken', col: '#ffd23a',
  desc: '【觉醒】展开巨大的法阵（方向键移动，移动时法阵缩小、结晶更密集），火、冰、光、暗四属性结晶接连坠落。按技能键或跳跃键立即砸下最后 5 颗大结晶并引发大爆炸。施放中无敌。', pow: lv => skillDmg(30, 8, lv), ai: { kind: 'awaken', r: [0, 460], dy: 120 },
  act: (lv) => ({ name: 'mg_awaken', clip: 'mAwk', dur: 4.4, superArmor: true, invul: true, noCounter: true,
    onStart: e => { game.cutin = { t: 0, dur: 1.0, name: '陨星幻灭', who: cutinWho(e) }; game.timeStop = 0.9; sfx.awaken(); const at = aimAhead(e, 220, 400); e.act.cx = at.x; e.act.cy = at.y; e.act.r = 330; },
    onInput: (e, I, dt) => { const a = e.act; e.vx = e.vy = 0; if (a.fin) return true; let mx = I.dx(), my = I.dy(); const d = dt || 1 / 60;
      if (e.actT > 1.2 && (I.buffered('jump') || (I.hit && ((a.key && I.hit(a.key)) || I.hit('cmd'))))) { I.consume('jump'); I.consume && I.consume('cmd'); astralFinale(e, lv); return true; }   // 技能键（或指令施放时的 Z）/ 跳跃键：立即砸下最后 5 颗
      if (!isHuman(e)) { const t = nearestFoe(e, 600); if (t) { mx = Math.sign(t.x - a.cx) * (Math.abs(t.x - a.cx) > 20); my = Math.sign(t.y - a.cy) * (Math.abs(t.y - a.cy) > 10); } }
      a.cx += mx * 180 * d; a.cy = clamp(a.cy + my * 120 * d, 10, DEPTH - 10); a.r = damp(a.r, mx || my ? 220 : 330, 3, d); return true; },
    update: e => { const a = e.act; if (e.actT < 0.95) return;
      if (e.actT > 3.5 && !a.fin) astralFinale(e, lv);
      addFx({ x: a.cx, y: a.cy - 1, z: 0, dur: 0.02, r: a.r, draw(c) { c.save(); c.translate(sx(this.x), sy(this.y, 0)); c.scale(1, GR); c.rotate(game.t); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.6; const im = IMG['fx/hexagram']; if (im) c.drawImage(im, -this.r, -this.r, this.r * 2, this.r * 2); c.restore(); } });
      if (a.fin) return;
      const n = Math.floor((e.actT - 1.0) / 0.06);   // 官方 40 颗、每 0.06 秒一颗（移动时法阵小、落点密，停住时法阵大）
      if (e.actT > 1.0 && n !== a.n && n < 40) { a.n = n; const [el, col] = ELEM4[n % 4], x = a.cx + rnd(-a.r, a.r) * 0.7, y = clamp(a.cy + rnd(-a.r, a.r) * 0.25, 6, DEPTH - 6);
        addFx({ x, y: y + 2, z: 0, dur: 0.3, col, draw(c) { const k = this.t / this.dur; drawSpr(c, 'elemmeteor', sx(this.x) - 160 * (1 - k), sy(this.y, 0) - 360 * (1 - k), 130, 0, { ax: 0.8, ay: 0.82 }); } });
        game.after(0.3, () => { meteorImpact({ x, y }, 0.8); blast(e, x, y, 115, { dmg: skillDmg(0.55, 0.16, lv), launch: 300, knock: 60, hs: 0.04, elem: el, type: 'mag', col, downHit: true }, { zMax: 240 }); }); } } }) });
CLASSES.mage.jobs.elemental = { art: 'job/elemental', name: '元素师', role: '远程 · 范围', armor: 'cloth', awaken: 'mg_awaken', awakenName: '大魔导师',
  desc: '把元素的力量发挥到极限的纯魔法师。大多数技能可以蓄气，学会移动施法后能边走边蓄；轮换火、冰、光、暗四种属性点亮元素标记来提高伤害。',
  skills: ['el_memorize', 'el_movecast', 'mg_flame', 'mg_void', 'el_burn', 'mg_icewall', 'mg_vortex', 'el_mastery', 'mg_thunder', 'el_thunderup', 'mg_icefeast', 'mg_hole', 'mg_jackfall', 'el_amplify', 'mg_awaken'] };
CLASSES.mage.cmds.push(['uu', 'mg_flame'], ['fdf', 'mg_void'], ['ud', 'el_burn', 'buff'], ['dd', 'mg_icewall'], ['bdf', 'mg_vortex'], ['udu', 'mg_thunder'], ['udd', 'mg_icefeast'], ['bff', 'mg_hole'], ['uff', 'mg_jackfall'], ['uudd', 'mg_awaken']);
// ---- 被动刷新（每 0.25 秒）：魔法记忆、属性精通、魔力增幅；元素点燃的加成按亮起的标记数 ----
CLASSES.mage.passives.push(p => {
  if (jobOf(p) !== EL) return;
  setPassive(p, 'el_memorize', hasSkill(p, 'el_memorize'), { cspd: 0.25, chargeCut: 0.2, chargeCutB: 0.26 });
  const ms = skLv(p, 'el_mastery'); setPassive(p, 'el_mastery', ms > 0, { dmg: 0.1 + 0.01 * ms });
  const am = skLv(p, 'el_amplify'); setPassive(p, 'el_amplify', am > 0, { atk: 0.06 + 0.01 * am, crit: 0.05 + 0.005 * am });
  const B = p.buffs.el_burn; if (B) { const n = ['fire', 'ice', 'light', 'dark'].filter(el => B.marks[el] > game.t).length; B.dmg = n * 0.5 * (0.01 + 0.004 * (B.lv || 1)); if (isHuman(p)) elBurnFx(p); }
});
// 所有魔法师技能施放时把属性记给元素点燃（包一层 act；不影响技能本身）
for (const id in SKILLS) { const S = SKILLS[id], el = S.elemNote || S.elem; if (S.cls !== 'mage' || !S.act || !el) continue; const f = S.act; S.act = (lv, p) => { if (p && p.buffs && p.buffs.el_burn) elNote(p, el); return f(lv, p); }; }
