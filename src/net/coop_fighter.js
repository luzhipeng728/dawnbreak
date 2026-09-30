/* =====================================================================
   组队刷图：男格斗家的职业状态同步到队友那边的影子（B9，docs/NETWORK.md「格斗家」）
   - 本人每次发自己的状态（'p'，20Hz）时附带 ff：
       b 看得见的 BUFF（念气环绕 / 御 / 龙虎啸 / 风雷啸 / 月华万象、烈焰焚步 / 霸体护甲 / 强拳 / 双重施放、强化投掷 / 后街战术 / 挑衅、暴力抓取）
       o 念气珠（5 颗的有无，位掩码）  e 风雷能量  q 街霸 4 种投掷物的装填 [剩几个, 上限, 是否在装填]
   - 影子收到后：BUFF 按列表增删（影子上的 BUFF 不会自己走时间，重放技能时加上的也以本人为准）、念气珠 / 龙虎啸 / 焚步 / 强拳的特效跟上、
     龙虎啸换普攻表（重放普攻时是虎爪）、装填数照抄（重放投掷时强化 / 一次两个的判断和本人一致）
   - 念气罩走 party_sync（partyCast 'fn_guard'：每个人在自己那边生成罩子，罩内各自无敌），不在这里
   - 只是表现：影子不造成伤害（applyHit 开头挡掉），这里的数值不参与任何结算
   ===================================================================== */
const COOP_FF_BUFFS = ['fn_spiral', 'fn_stone', 'fn_tiger', 'fn_windstorm', 'fn_radiant', 'fs_awaken', 'fs_sa', 'fs_power', 'fs_dual', 'fb_strong', 'fb_backstreet', 'fb_taunt', 'fg_overgrab'];
const COOP_FF_Q = ['fb_poison', 'fb_needle', 'fb_brick', 'fb_net'];
function coopFighterState(p) {
  const d = { b: COOP_FF_BUFFS.filter(k => p.buffs && p.buffs[k]) };
  if (p._fnOrb) d.o = p._fnOrb.on.reduce((m, on, i) => m | (on ? 1 << i : 0), 0);
  if (p._fnE !== undefined) d.e = Math.round(p._fnE);
  const q = {}; let n = 0;
  for (const id of COOP_FF_Q) { const Q = p.charges && p.charges[id]; if (Q) { q[id] = [Q.n, Q.cap || 0, Q.rl ? 1 : 0]; n++; } }
  if (n) d.q = q;
  return d;
}
function coopFighterApply(g, d) {
  const B = g.buffs || (g.buffs = {}), want = new Set(Array.isArray(d.b) ? d.b : []), tiger0 = !!B.fn_tiger;
  for (const k of COOP_FF_BUFFS) { if (want.has(k)) { if (!B[k]) B[k] = { t: 1e9, lv: 1, ghost: true }; } else if (B[k]) delete B[k]; }
  if (B.fn_spiral && typeof fnOrbs === 'function') { const S = fnOrbs(g), o = d.o | 0; for (let i = 0; i < S.on.length; i++) S.on[i] = !!(o & (1 << i)); fnOrbFx(g); }
  if (B.fn_tiger && typeof fnTigerFx === 'function') fnTigerFx(g);
  if (B.fs_awaken && typeof fsFeetFx === 'function') fsFeetFx(g);
  if (B.fs_power && typeof fsFistFx === 'function') fsFistFx(g);
  if (!!B.fn_tiger !== tiger0) g.acts = fighterActs(g);
  if (d.e !== undefined) g._fnE = clamp(+d.e || 0, 0, 1000);
  if (d.q && typeof d.q === 'object') for (const id of COOP_FF_Q) { const v = d.q[id], Q = Array.isArray(v) && chargesOf(g, id); if (Q) { Q.n = clamp(v[0] | 0, 0, 99); Q.cap = clamp(v[1] | 0, 0, 99); Q.rl = !!v[2]; } }
  g.mp = g.mpMax;   // 影子上也跑念气珠的每帧逻辑（会耗 MP）：别让它自己把念气环绕关掉
}
{ const send0 = coop.send; coop.send = function (m, to) { if (m && m.k === 'p' && this.state === 'play') { const p = game.player; if (p && p.cls === 'fighter') m.ff = coopFighterState(p); } return send0.call(this, m, to); }; }
{ const st0 = coop.onMateState; coop.onMateState = function (uid, d, recvT) { st0.call(this, uid, d, recvT); const g = this.mates.get(uid); if (g && g.cls === 'fighter' && d && d.ff && typeof d.ff === 'object') coopSafe(() => coopFighterApply(g, d.ff)); }; }
