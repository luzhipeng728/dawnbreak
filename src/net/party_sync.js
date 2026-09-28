/* =====================================================================
   全队效果同步（辅助职业：协战师 / 小魔女共用）：单刷判定、队伍成员、全队 BUFF / 保护罩 / 回复 / 净化 / 复活、光环
   - 全部是 function 声明（整份脚本一起提升）：职业文件加载时就能调用 partyOn / partyAura，和本文件在 ORDER 里的位置无关
   - 组队刷图（net/coop.js）中：partyCast 先作用在自己的 game.player 上，再用房间中继 { k: 'pfx', kind, d } 发给全队；
     不看距离、跨房间（队友在别的房间也生效）；收到的一方作用在它自己的 game.player 上。服务端 relay 不过滤 d.k，不用改服务端
   - 队友出招会在它的“影子”上重放（coop.onMateAct）：影子上的 partyCast 直接忽略，避免重复生效 / 来回转发
   - AI / 决斗格斗者（不是 game.player 也不是影子）：只作用在它自己身上
   - 内置 kind：buff / shield / heal / cleanse / revive；职业自己的 kind 用前缀（协战师 pm_、小魔女 en_）
   - 保护罩 = BUFF 上的 absorb 点数（可叠加，总量不超过最大 HP × cap）。engine/combat.js 的 applyHit 调 absorbHit 先扣护盾；
     没有那一行时用 t.onDamaged 兜底回补 HP（在死亡判定之前）
   ===================================================================== */
// 单刷：不在组队地下城里（队里只有自己也算单刷）；决斗场永远不算
function soloPlay() { return !game.pvp && !(typeof coop !== 'undefined' && coop.active() && coop.mates.size > 0); }
function partySolo() { return soloPlay(); }
function partyInCoop() { return typeof coop !== 'undefined' && coop.state === 'play' && coop.mates.size > 0; }
// 组队中的队友影子（有 .uid、.kit.job、.lvl）；单机返回 []
function partyMates() { return typeof coop !== 'undefined' && coop.active() ? [...coop.mates.values()] : []; }
// 施放者身边的队伍成员（距离型 BUFF 用）：自己 + 队友影子（影子上的 BUFF 只是表现），同队、活着、在同一个房间、不是召唤物、|dx| ≤ r
function partyOf(src, r = Infinity) {
  const L = [game.player, ...partyMates()]; if (src && !L.includes(src)) L.push(src);
  return L.filter(t => t && t.team === (src ? src.team : 'p') && !t.dead && !t.away && !t.summon && (!src || Math.abs(t.x - src.x) <= r));
}
// 注册“收到后作用在自己身上”的处理函数：fn(me, data, fromGhost)（自己施放时 fromGhost = null）
function partyOn(kind, fn) { (partyOn.fx || (partyOn.fx = {}))[kind] = fn; }
// 全队施放：src = 施放者（省略 = game.player）
function partyCast(kind, data = {}, src) {
  const f = partyOn.fx && partyOn.fx[kind]; if (!f) return false;
  if (src && src.ghost) return false;                                   // 队友影子重放：真正的施放在队友自己的客户端
  if (src && src !== game.player) { try { f(src, data, null); } catch (e) { console.error('partyCast', kind, e); } return true; }   // AI / 决斗格斗者
  const me = game.player; if (me) { try { f(me, data, null); } catch (e) { console.error('partyCast', kind, e); } }
  if (partyInCoop()) coop.send({ k: 'pfx', kind, d: data }, 'all');
  return true;
}
// 只发给队友（不作用在自己身上），例如“不含自己”的一觉 BUFF
function partySend(kind, data = {}, src) { if (src && src !== game.player) return false; if (partyInCoop()) { coop.send({ k: 'pfx', kind, d: data }, 'all'); return true; } return false; }
function partyRecv(m) {
  const d = m && m.d; if (!d || d.k !== 'pfx' || typeof coop === 'undefined' || coop.state !== 'play') return;
  const f = partyOn.fx && partyOn.fx[d.kind], me = game.player; if (!f || !me || typeof d.d !== 'object' || !d.d) return;
  try { f(me, d.d, coop.mates.get(m.f) || null); } catch (e) { console.error('partyRecv', d.kind, e); }
}
if (typeof net !== 'undefined' && !partyRecv.on) { partyRecv.on = true; net.on('r', partyRecv); }

/* ---- 数值清洗（网络来的数据）---- */
const PARTY_BUFF_KEYS = { t: [0, 900], atk: [-0.5, 3], aspd: [-0.5, 1], cspd: [-0.5, 1], mspd: [-0.5, 1], crit: [-0.5, 1], critDmg: [-1, 3], dmg: [-0.5, 3], taken: [-0.9, 1],
  hpPct: [0, 2], mpPct: [0, 2], stagger: [-500, 2000], mpr: [0, 5], lv: [0, 99], n: [0, 99], sa: [0, 1], inv: [0, 1], absorb: [0, 1e9] };
function partyCleanBuff(b) {
  const o = {}; if (!b || typeof b !== 'object') return o;
  for (const k in PARTY_BUFF_KEYS) if (typeof b[k] === 'number' && isFinite(b[k])) o[k] = clamp(b[k], PARTY_BUFF_KEYS[k][0], PARTY_BUFF_KEYS[k][1]);
  if (typeof b.col === 'string' && /^#[0-9a-f]{3,8}$/i.test(b.col)) o.col = b.col;
  if (typeof b.name === 'string') o.name = b.name.slice(0, 16);
  return o;
}
const partyIdOk = id => typeof id === 'string' && /^[a-z0-9_]{1,32}$/.test(id);

/* ---- 内置：BUFF（按 id 覆盖 = 刷新）---- */
partyOn('buff', (me, d) => {
  if (!partyIdOk(d.id) || me.dead) return;
  const b = partyCleanBuff(d.b); if (!(b.t > 0)) return;
  me.buffs[d.id] = { ...b, party: 1 };
  if (typeof applyBuffs === 'function') applyBuffs(me);
  partyStatTick(me);
  if (typeof d.aura === 'string' && /^#[0-9a-f]{3,8}$/i.test(d.aura)) fxAura(me, d.aura, 0.8);
});
/* ---- 内置：保护罩（可叠加的吸伤护盾）：{ id, pct 吸收量 = 自己最大 HP × pct | v 数值, t 秒, cap 总量上限 = 最大 HP × cap（默认 0.5）} ---- */
partyOn('shield', (me, d) => {
  if (!partyIdOk(d.id) || me.dead) return;
  const v = d.pct ? me.hpMax * clamp(+d.pct, 0, 2) : clamp(+d.v || 0, 0, 1e9), t = clamp(+d.t || 0, 0, 120), cap = clamp(+d.cap || 0.5, 0.05, 2); if (!(v > 0) || !(t > 0)) return;
  addAbsorb(me, d.id, v, t, cap);
});
/* ---- 内置：回复 { pct 最大 HP 比例 | v 数值, mp: 最大 MP 比例 } ---- */
partyOn('heal', (me, d) => {
  if (me.dead) return;
  const v = d.pct ? me.hpMax * clamp(+d.pct, 0, 1) : clamp(+d.v || 0, 0, 1e9);
  if (v > 0) { me.hp = Math.min(me.hpMax, me.hp + v); if (typeof addNumber === 'function') addNumber(Math.round(v), me.x, me.y, me.z, { col: '#7aff8a' }); }
  if (d.mp) me.mp = Math.min(me.mpMax, me.mp + me.mpMax * clamp(+d.mp, 0, 1));
});
/* ---- 内置：净化 { n 最多解除几种异常 } ---- */
partyOn('cleanse', (me, d) => { if (!me.dead) partyCleanse(me, clamp(+d.n || 1, 1, 20)); });
function partyCleanse(me, n) {
  const S = me.status; let k = 0; if (!S) return 0;
  for (const s of Object.keys(S)) { if (k >= n) break; delete S[s]; k++; }
  if (k) { fxText('净化', me.x, me.y, me.z + 20, { col: '#9ff0ff', size: 12 }); if (me.st === 'hit' && me.stun > 0.2) me.stun = 0.2; }
  return k;
}
/* ---- 内置：复活 { uid 被复活的队员 } —— 死亡倒计时（地下城 deadT）里原地复活，不花复活币 ---- */
partyOn('revive', (me, d) => {
  const uid = typeof net !== 'undefined' && net.user ? net.user.id : 0;
  if (d.uid && d.uid !== uid && me === game.player) return;
  partyRevive(me);
});
function partyRevive(me) {
  const dg = game.dungeon;
  if (me === game.player && dg && dg.state === 'dead' && typeof dg.revive === 'function' && typeof save !== 'undefined' && save.data) {
    save.data.coins = (save.data.coins || 0) + 1; dg.revive(); dg.usedCoins = Math.max(0, (dg.usedCoins || 1) - 1);   // 借 revive() 的全部表现，复活币原样退回
    fxText('紧急复苏', me.x, me.y, me.z + 30, { col: '#ffe07a', size: 16, dur: 1.2 }); return true;
  }
  if (me.dead && me !== game.player) { me.dead = false; me.hp = me.hpMax; me.invul = 3; me.setState('idle'); return true; }
  return false;
}

/* ---- 吸收护盾：BUFF 上的 absorb 点数 ---- */
function addAbsorb(me, id, v, t, cap = 0.5) {
  const b = me.buffs[id] || (me.buffs[id] = { t: 0, absorb: 0, n: 0, party: 1 });
  const total = absorbOf(me) - (b.absorb || 0), room = Math.max(0, me.hpMax * cap - total);
  b.absorb = Math.min(room, (b.absorb || 0) + v); b.t = Math.max(b.t || 0, t); b.n = (b.n || 0) + 1; b.cap = cap;
  if (!(b.absorb > 0)) { delete me.buffs[id]; return 0; }
  if (!me.onDamaged) me.onDamaged = partyOnDamaged;
  partyShieldFx(me);
  return b.absorb;
}
function absorbOf(t) { let s = 0; const B = t && t.buffs; if (B) for (const k in B) if (B[k].absorb > 0) s += B[k].absorb; return s; }
// applyHit 的钩子：先扣护盾，返回剩下的伤害（先到期的护盾先扣）
function absorbHit(t, dmg) {
  t._absorbT = 1;
  const B = t.buffs; if (!B || !(dmg > 0)) return dmg;
  let left = dmg, took = 0;
  const L = Object.keys(B).filter(k => B[k].absorb > 0).sort((a, b) => B[a].t - B[b].t);
  for (const k of L) { const b = B[k], x = Math.min(b.absorb, left); b.absorb -= x; left -= x; took += x; if (b.absorb <= 0.5) delete B[k]; if (left <= 0) break; }
  if (took > 0) { t._absorbed = (t._absorbed || 0) + took; fxText('护盾 ' + Math.round(took), t.x, t.y, t.z + 36, { col: '#8fe8ff', size: 10, dur: 0.5 }); }
  return left;
}
// 兜底：combat.js 没有调用 absorbHit 时（t._absorbT 没被置上），伤害已经扣到 HP 上了——在死亡判定之前把护盾吸收的部分补回来
function partyOnDamaged(t, a, dmg) {
  if (t._absorbT) { t._absorbT = 0; return; }
  const left = absorbHit(t, dmg); t._absorbT = 0;
  if (left < dmg) t.hp += dmg - left;
}
// 护盾外观：玩家身上一层淡淡的六边形光罩（运行时发光贴图，叠加混合；没有素材时画一个椭圆）
function partyShieldFx(me) {
  if (me._shFx && fxList.indexOf(me._shFx) >= 0) return;
  me._shFx = addFx({ ent: me, y: me.y, dur: 1e9, add: true,
    update() { const e = this.ent; this.y = e.y + 0.4; if (e.dead || absorbOf(e) <= 0 || (ents.indexOf(e) < 0 && e !== game.player)) this.t = this.dur; },
    draw(c) { const e = this.ent, k = clamp(absorbOf(e) / Math.max(1, e.hpMax * 0.5), 0.25, 1), X = sx(e.x), Y = sy(e.y, e.z + 52), pul = 1 + Math.sin(game.t * 4) * 0.03;
      if (IMG['fx/pm_bubble']) drawSpr(c, 'pm_bubble', X, Y, 118 * pul, 150 * pul, { alpha: 0.35 + 0.35 * k });
      else { c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.25 + 0.3 * k; c.strokeStyle = '#8fe8ff'; c.lineWidth = 2; c.beginPath(); c.ellipse(X, Y, 44 * pul, 62 * pul, 0, 0, TAU); c.stroke(); c.restore(); } } });
}

/* ---- 最大 HP / MP 百分比 BUFF（小魔女的偏爱、协战师装甲强化）：recalcStats 重算后重新叠上；当前 HP 按比例跟着变 ---- */
function partyStatTick(p) {
  if (!p || !p.buffs) return;
  let hp = 0, mp = 0; for (const k in p.buffs) { const b = p.buffs[k]; hp += b.hpPct || 0; mp += b.mpPct || 0; }
  const S = p._pst || (p._pst = { ref: undefined, hp: 0, mp: 0, hb: p.hpMax, mb: p.mpMax });
  if (S.ref !== p.stats) { S.ref = p.stats; S.hb = p.hpMax; S.mb = p.mpMax; S.hp = 0; S.mp = 0; }   // recalcStats 刚重算：此时的上限不含加成
  if (hp !== S.hp) { const f = p.hp / Math.max(1, p.hpMax); p.hpMax = Math.round(S.hb * (1 + hp)); p.hp = Math.min(p.hpMax, Math.max(p.dead ? 0 : 1, Math.round(p.hpMax * f))); S.hp = hp; }
  if (mp !== S.mp) { const f = p.mp / Math.max(1, p.mpMax); p.mpMax = Math.round(S.mb * (1 + mp)); p.mp = Math.min(p.mpMax, Math.round(p.mpMax * f)); S.mp = mp; }
}

/* ---- 光环（按转职）：每 0.5 秒，对 [自己, ...队友影子] 里转职是 job 的施放者调用 fn(src, me)，由 fn 给 me（= game.player）上短时 BUFF ---- */
function partyAura(job, fn) { (partyAura.fx || (partyAura.fx = {}))[job] = fn; }
function partyTick(dt) {
  const me = game.player; if (!me) return;
  partyStatTick(me);
  if (!me.dead && buffVal(me, 'sa') > 0) me.superArmor = Math.max(me.superArmor || 0, 0.05);   // BUFF 上的霸体（协战师强化保护罩等）
  if (!me.dead && buffVal(me, 'inv') > 0) me.invul = Math.max(me.invul || 0, 0.05);             // BUFF 上的无敌（协战师区域防御等）
  partyTick.t = (partyTick.t || 0) - dt; if (partyTick.t > 0 || !partyAura.fx) return; partyTick.t = 0.5;
  for (const src of [me, ...partyMates()]) {
    const job = src === me ? game.job : src.kit && src.kit.job, f = job && partyAura.fx[job];
    if (f && !src.dead) { try { f(src, me); } catch (e) { console.error('partyAura', job, e); } }
  }
}
// 挂进主循环：updateGroundFx 只在地下城 / 测试场景调用（同 game/summon.js 的做法）
if (typeof updateGroundFx === 'function' && !partyTick.hooked) { partyTick.hooked = true; const u0 = updateGroundFx; updateGroundFx = function (dt) { u0(dt); try { partyTick(dt); } catch (e) { console.error('partyTick', e); } }; }
