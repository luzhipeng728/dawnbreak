/* =====================================================================
   装备深化 · 特效：史诗 / 传说的专属特效、套装件数特效（proc）、史诗掉落光柱、掉落音效
   proc 写在物品库（defineGear 的 proc 字段，可以是数组）或套装件数效果里（bonus[n].proc）：
     { on: 'hit'|'crit'|'kill'|'hurt'|'lowhp'|'skill', chance, cd（秒）, act, name（飘字）, desc（tooltip 说明）, ...参数 }
     act：
       strike  追加一次伤害 { mul 攻击力倍率, elem?, aoe?（范围半径）, vis: slash|bolt|moon|fire|ice|dark|holy|nova|swords|petal, col? }
       cut     削减目标当前 HP { cut 比例, boss: false = 对领主无效 }
       status  异常状态 { status: burn|poison|bleed|freeze|stun|slow, dur, dps（攻击力倍率 / 秒） }
       heal    恢复 { hp?, mp? }（上限比例）
       shield  护盾 { amt（HP 上限比例）, dur }：吸收受到的伤害
       buff    自身增益 { buff: { aspd cspd mspd crit critDmg dmg atk taken }, dur, stack?（可叠加层数） }
       reset   重置刚施放的技能冷却（on: 'skill'）
       skillcd 指定技能的冷却减少 { skill, sec }（on: 'skill'）
       extra   附加伤害（按这一击伤害的比例，直接扣血）{ frac, exec?（目标 HP 越低附加越多，最多 frac + exec） }
       debuff  目标受到的伤害增加 { taken, dur }
     过滤条件：skill（只对某个技能生效）、vs（目标带有某种异常状态才生效，'any' = 任意）、combo（连击数达到 N 时）
   只在地下城 / 测试房间里生效，决斗场不生效
   ===================================================================== */
const GEAR_PROC_VIS = {
  slash: (t, col) => fxSlashX(t.x, t.y, t.z + 40, 170, col || '#ffe8a0'),
  moon: (t, col) => { fxSpr('slash', t.x, t.y, t.z + 45, { w: 230, dur: 0.35, col: col || '#cfe4ff', grow: [0.6, 1.2] }); fxSlashX(t.x, t.y, t.z + 40, 150, col || '#e8f4ff'); },
  bolt: (t, col) => { fxSpr('thunderbolt', t.x, t.y, 0, { h: 240, dur: 0.35, ay: 1, col }); fxBurst(t.x, t.y, t.z + 30, 120, col || '#9ad8ff'); },
  fire: (t, col) => { fxSpr('explosion', t.x, t.y, t.z + 30, { w: 150, dur: 0.45, grow: [0.5, 1.2], col }); },
  ice: (t, col) => { fxSpr('icespike', t.x, t.y, 0, { h: 130, dur: 0.45, ay: 1, col }); },
  dark: (t, col) => { fxSpr('darkorb', t.x, t.y, t.z + 40, { w: 140, dur: 0.45, grow: [0.4, 1.3], col }); },
  holy: (t, col) => { fxSpr('pillar', t.x, t.y, 0, { h: 260, w: 90, dur: 0.5, ay: 1, col: col || '#fff2b0' }); },
  nova: (t, col) => { fxShock(t.x, t.y, 160, col || '#ffe070'); fxBurst(t.x, t.y, t.z + 30, 200, col || '#ffe070'); },
  swords: (t, col) => { fxSpr('swordrain', t.x, t.y, 0, { h: 200, dur: 0.5, ay: 1, col }); },
  petal: (t, col) => { fxSpr('petal', t.x, t.y, t.z + 40, { w: 160, dur: 0.6, grow: [0.5, 1.3], spin: 2, col }); },
};
const gearRt = { cd: {}, busy: false, shield: 0, shieldT: 0, stacks: {} };
// 身上生效的 proc 列表（recalcStats 时重建，写在 p.gearProcs）
function gearProcList(E) {
  const out = [];
  const push = (P, id, src) => { for (const x of [].concat(P)) if (x) out.push({ on: 'hit', ...x, id: id + '#' + out.length, src }); };
  for (const s of SLOTS) {
    const it = inv.equip[s]; if (!it || it.slot !== s || !itemActive(it)) continue;
    const D = ITEMS[it.key]; if (D && D.proc) push(D.proc, it.key, D.name);
  }
  for (const x of E.sets || []) { const S = SETS[x.id]; if (!S) continue; for (const n of x.on) if (S.bonus[n] && S.bonus[n].proc) push(S.bonus[n].proc, `${x.id}:${n}`, `${S.name} ${n} 件`); }
  return out;
}
const gearProcOk = () => (game.scene === 'dungeon' || game.scene === 'test') && !game.duel && !game.pvp;
const gearMainType = p => typeof mainDmgType === 'function' ? mainDmgType(p) : p.dmgType || 'phys';
function gearFire(on, ctx = {}) {
  const p = game.player; if (!p || p.dead || gearRt.busy || !gearProcOk()) return;
  const L = p.gearProcs; if (!L || !L.length) return;
  for (const P of L) {
    if (P.on !== on) continue;
    if (P.skill && ctx.id !== P.skill) continue;
    if (P.combo && (game.combo || 0) < P.combo) continue;
    if (P.vs) { const S = ctx.target && ctx.target.status; if (!S || (P.vs === 'any' ? !Object.keys(S).length : !S[P.vs])) continue; }
    if (P.cd && (gearRt.cd[P.id] || 0) > game.t) continue;
    if (Math.random() >= (P.chance ?? 1)) continue;
    if (gearAct(p, P, ctx) === false) continue;
    if (P.cd) gearRt.cd[P.id] = game.t + P.cd;
  }
}
// 被击 / 击杀这类没有目标的触发：找离玩家最近的敌人（250 像素内）
function gearNearFoe(p) { let best = null, bd = 250; for (const e of ents) if (e.team === 'e' && !e.dead && e.hp > 0) { const d = Math.abs(e.x - p.x) + Math.abs(e.y - p.y) * 1.5; if (d < bd) { bd = d; best = e; } } return best; }
function gearAct(p, P, ctx) {
  const t = ctx.target && ctx.target.team === 'e' ? ctx.target : (P.act === 'strike' || P.act === 'debuff') && (P.on === 'hurt' || P.on === 'lowhp' || P.on === 'kill' || P.on === 'skill') ? gearNearFoe(p) : ctx.target, alive = t && !t.dead && t.hp > 0 && t.team === 'e';
  const act = P.act || (P.cut ? 'cut' : P.burn ? 'status' : 'strike');
  if (act === 'strike') {
    if (!alive) return false;
    const R = P.aoe || 0, list = R ? ents.filter(e => e.team === 'e' && !e.dead && e.hp > 0 && Math.abs(e.x - t.x) < R && Math.abs(e.y - t.y) < R * 0.6).slice(0, 8) : [t];
    gearRt.busy = true;
    try { for (const e of list) applyHit(p, e, { dmg: P.mul || 1, sure: true, type: P.type || gearMainType(p), elem: P.elem, stun: 0.15, knock: 40, hs: 0.02, snd: P.snd || 'crit', col: P.col, noCounterBonus: true }, { mul: 1, proj: true }); }
    finally { gearRt.busy = false; }
    (GEAR_PROC_VIS[P.vis] || GEAR_PROC_VIS.slash)(t, P.col);
  } else if (act === 'cut') {
    if (!alive || (t.boss && P.boss === false)) return false;
    const d = Math.max(1, Math.round(t.hp * P.cut)); t.hp = Math.max(1, t.hp - d);
    addNumber(d, t.x, t.y, t.z + 20, { col: '#ff4a8a' }); GEAR_PROC_VIS.slash(t, '#ff4a8a');
  } else if (act === 'status') {
    if (!alive || typeof addStatus !== 'function') return false;
    const kind = P.status || (P.burn ? 'burn' : 'burn');
    addStatus(t, kind, P.dur || P.burn || 3, { dps: (p.atk || 500) * (P.dps ?? 0.12), src: p });
    if (P.vis) (GEAR_PROC_VIS[P.vis] || GEAR_PROC_VIS.fire)(t, P.col);
  } else if (act === 'heal') {
    if (P.hp) { const v = Math.round(p.hpMax * P.hp); p.hp = Math.min(p.hpMax, p.hp + v); addNumber(v, p.x, p.y, p.z, { heal: true }); }
    if (P.mp) { const v = Math.round(p.mpMax * P.mp); p.mp = Math.min(p.mpMax, p.mp + v); addNumber(v, p.x, p.y, p.z + 12, { col: '#6ab8ff' }); }
    fxAura(p, P.col || '#8aff9a', 0.6);
  } else if (act === 'shield') {
    gearRt.shield = Math.round(p.hpMax * (P.amt || 0.1)); gearRt.shieldT = game.t + (P.dur || 6);
    p.buffs = p.buffs || {}; p.buffs.gear_shield = { t: P.dur || 6, name: P.name || '护盾', col: '#6ad0ff', src: String(P.id || '').split('#')[0] };
    fxAura(p, '#6ad0ff', 0.8);
  } else if (act === 'buff') {
    p.buffs = p.buffs || {}; const key = 'gear_' + (P.key || P.id), cur = p.buffs[key], max = P.stack || 1;
    const n = Math.min(max, (cur ? cur.n || 1 : 0) + 1), B = { t: P.dur || 5, n, name: `${P.name || '装备特效'}${max > 1 ? ` ×${n}` : ''}`, col: P.col || '#ffb24a', src: String(P.id || '').split('#')[0] };
    for (const k in P.buff) B[k] = P.buff[k] * n;
    p.buffs[key] = B;
    if (!cur || n > (cur.n || 1)) { if (max === 1 || n === max) fxAura(p, P.col || '#ffd23a', 0.5); }
    if (max > 1 && cur && n === cur.n) return true;   // 满层：只刷新时间，不再飘字
  } else if (act === 'extra') {
    if (!alive || !ctx.dmg) return false;
    const f = (P.frac || 0.1) + (P.exec ? P.exec * (1 - t.hp / t.hpMax) : 0), d = Math.max(1, Math.round(ctx.dmg * f));
    t.hp -= d; addNumber(d, t.x, t.y, t.z + 26, { col: P.col || '#ffb24a' });
    if (t.hp <= 0 && !t.dead) { t.hp = 0; killEnt(t, p, {}); }
    if (!P.name) return true;
  } else if (act === 'debuff') {
    if (!alive) return false;
    t.buffs = t.buffs || {}; const key = 'gear_' + (P.key || 'debuff'); t.buffs[key] = { taken: P.taken || 0.1, t: P.dur || 5 };
    game.after(P.dur || 5, () => { if (t.buffs && t.buffs[key]) delete t.buffs[key]; });
    if (P.vis) (GEAR_PROC_VIS[P.vis] || GEAR_PROC_VIS.dark)(t, P.col);
  } else if (act === 'skillcd') {
    if (!ctx.id || !p.cool || !(p.cool[ctx.id] > 0)) return false;
    p.cool[ctx.id] = Math.max(0, p.cool[ctx.id] - (P.sec || 1));
  } else if (act === 'reset') {
    if (!ctx.id || !p.cool || !(p.cool[ctx.id] > 0)) return false;
    p.cool[ctx.id] = 0; fxAura(p, '#9ae8ff', 0.5);
  } else return false;
  if (P.name) fxText(P.name, (alive ? t : p).x, (alive ? t : p).y, (alive ? t : p).z + 20, { col: P.txtCol || '#ffd23a', size: 12, dur: 0.8 });
  return true;
}
bus.on('playerHit', e => { if (!e || !e.target || e.target.team === 'p' || e.target.cls) return; gearFire('hit', e); if (e.crit) gearFire('crit', e); });
bus.on('kill', e => { if (game.player && !gearRt.busy) gearFire('kill', e); });
bus.on('skillUse', e => gearFire('skill', e));
bus.on('playerHurt', e => {
  const p = game.player; if (!p || !gearProcOk()) return;
  // 护盾：把这次受到的伤害（最多到护盾值）补回来
  if (gearRt.shield > 0 && gearRt.shieldT > game.t && e && e.dmg > 0 && !p.dead) {
    const a = Math.min(gearRt.shield, e.dmg); gearRt.shield -= a; p.hp = Math.min(p.hpMax, p.hp + a);
    if (gearRt.shield <= 0 && p.buffs) delete p.buffs.gear_shield;
    fxText('吸收', p.x, p.y, p.z + 10, { col: '#6ad0ff', size: 10, dur: 0.5 });
  }
  gearFire('hurt', e);
  if (p.hp > 0 && p.hp < p.hpMax * 0.3) gearFire('lowhp', e);
});
bus.on('dungeonEnter', () => { gearRt.cd = {}; gearRt.shield = 0; });

/* ---------------- 史诗掉落光柱（预渲染贴图 + lighter 叠加；每帧只 drawImage / fillRect） ---------------- */
const PILLAR_TEX = {};
function pillarTex(kind) {
  if (PILLAR_TEX[kind]) return PILLAR_TEX[kind];
  const C = { epic: [[255, 250, 220], [255, 196, 50]], legend: [[255, 236, 200], [255, 120, 20]], abyss: [[255, 240, 255], [200, 90, 255]] }[kind] || [[255, 250, 220], [255, 196, 50]];
  const [c0, c1] = C, rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
  // 光柱：竖向渐变（底亮顶透明）× 横向高斯遮罩（中间亮两边透明）
  const [cv, x] = offCanvas(96, 512);
  const g = x.createLinearGradient(0, 512, 0, 0); g.addColorStop(0, rgba(c0, 1)); g.addColorStop(0.12, rgba(c1, 0.95)); g.addColorStop(0.6, rgba(c1, 0.45)); g.addColorStop(1, rgba(c1, 0));
  x.fillStyle = g; x.fillRect(0, 0, 96, 512);
  x.globalCompositeOperation = 'destination-in';
  const m = x.createLinearGradient(0, 0, 96, 0); m.addColorStop(0, 'rgba(0,0,0,0)'); m.addColorStop(0.3, 'rgba(0,0,0,0.35)'); m.addColorStop(0.5, 'rgba(0,0,0,1)'); m.addColorStop(0.7, 'rgba(0,0,0,0.35)'); m.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = m; x.fillRect(0, 0, 96, 512);
  // 地面光环
  const [rc2, r2] = offCanvas(128, 128); const rg2 = r2.createRadialGradient(64, 64, 2, 64, 64, 64); rg2.addColorStop(0, rgba(c0, 1)); rg2.addColorStop(0.4, rgba(c1, 0.55)); rg2.addColorStop(1, rgba(c1, 0)); r2.fillStyle = rg2; r2.fillRect(0, 0, 128, 128);
  return (PILLAR_TEX[kind] = { beam: cv, ring: rc2, col: rgba(c1, 1), hi: rgba(c0, 1) });
}
// d：掉落物；X / Y：地面上的屏幕坐标。史诗（金）/ 深渊史诗（金 + 紫环）/ 传说（橙、矮一些）
function drawDropPillar(c, d, X, Y) {
  const r = d.item.rar || 0, kind = r >= 5 ? 'epic' : 'legend', T = pillarTex(kind);
  const lt = d.landT == null ? -1 : game.t - d.landT;
  c.save(); c.globalCompositeOperation = 'lighter';
  const H0 = r >= 5 ? 330 : 170, grow = lt < 0 ? 0.25 : Math.min(1, 0.25 + lt / 0.25 * 0.75), H = H0 * grow;
  const pulse = 0.8 + 0.2 * Math.sin(d.t * 3.2), w = (r >= 5 ? 46 : 30) * (1 + 0.08 * Math.sin(d.t * 5));
  c.globalAlpha = pulse; c.drawImage(T.beam, X - w / 2, Y - H, w, H);
  c.globalAlpha = 0.7 * pulse; c.drawImage(T.beam, X - w * 0.18, Y - H * 1.05, w * 0.36, H * 1.05);
  // 落地瞬间：一道粗光冲天 + 地面爆闪
  if (lt >= 0 && lt < 0.5) { const k = lt / 0.5; c.globalAlpha = 1 - k; c.drawImage(T.beam, X - w * (1.6 + k), Y - H0 * 1.3, w * (3.2 + 2 * k), H0 * 1.3); c.drawImage(T.ring, X - 90 * (0.5 + k), Y - 40 * (0.5 + k), 180 * (0.5 + k), 80 * (0.5 + k)); }
  // 地面光环（深渊史诗外加一圈紫色）
  c.globalAlpha = 0.85; c.drawImage(T.ring, X - 40, Y - 12, 80, 24);
  if (d.abyss) { const A = pillarTex('abyss'), s = 1 + 0.15 * Math.sin(d.t * 2.4); c.globalAlpha = 0.7; c.drawImage(A.ring, X - 56 * s, Y - 16 * s, 112 * s, 32 * s); }
  // 上升的光点
  c.fillStyle = T.hi;
  for (let i = 0; i < 9; i++) {
    const ph = ((d.t * (40 + i * 7) + i * 53) % H), a = 1 - ph / H;
    c.globalAlpha = a * 0.9; c.fillRect(X + Math.sin(d.t * 2 + i * 1.7) * w * 0.35 - 1, Y - ph - 2, 2, 4);
  }
  c.restore();
}
/* ---------------- 音效：史诗落地（低沉的“咚”+ 上行的钟声 + 高频余韵）、传说落地 ---------------- */
const gearSfx = {
  epicDrop() {
    if (!sfx.ok) return;
    sfx.tone('sine', 130, 55, 0.7, 0.28, { attack: 0.005 }); sfx.noise('lowpass', 900, 120, 0.5, 0.18, 0.7);
    [0, 7, 12, 16, 19, 24].forEach((s, i) => { sfx.tone('sine', 523 * Math.pow(2, s / 12), 0, 0.9, 0.08, { delay: 0.12 + i * 0.07 }); sfx.tone('triangle', 1046 * Math.pow(2, s / 12), 0, 0.5, 0.025, { delay: 0.12 + i * 0.07 }); });
    sfx.noise('highpass', 6000, 9000, 1.2, 0.05, 0.5, 0.3);
  },
  legendDrop() { if (!sfx.ok) return; [0, 5, 9].forEach((s, i) => sfx.tone('sine', 659 * Math.pow(2, s / 12), 0, 0.5, 0.07, { delay: i * 0.06 })); },
  abyssOpen() { if (!sfx.ok) return; sfx.tone('sawtooth', 70, 40, 1.2, 0.12); sfx.noise('lowpass', 400, 80, 1.2, 0.2, 0.8); [0, 3, 6].forEach((s, i) => sfx.tone('sine', 220 * Math.pow(2, s / 12), 0, 0.8, 0.06, { delay: 0.2 + i * 0.15 })); },
};
