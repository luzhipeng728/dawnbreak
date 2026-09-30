/* =====================================================================
   暗精灵地区 · 领主的自定义钩子（机制库覆盖不到的部分；其余全部在 darkelf.js 的数据里，规划见 docs/BOSS_PLAN.md §2 暗精灵、§3.2）
   - split 分裂（诺伊佩拉 狄瑞吉的幻影；只有这一个领主用，所以按 §3.2 写在区域钩子文件里）：
       领主离场，分成 n 块碎片（各分到剩余血量的 1/n，碎片也算领主）；碎片要在 window 秒内全部打倒，先倒下的超时会重新凝聚（reviveHp × 份额）；
       全部打倒 → 领主在最后一块碎片的位置现形、随即崩散（= 领主倒下，掉落 / 任务照常结算）
       组队：碎片是主机刷的怪（照常同步成傀儡）；重新凝聚的提示走机制事件 'rv'，队员只放提示和特效
   - 无头骑士的「梦魇狂奔」（REGION_HOOKS.headless）：stance 切到 gallop 模式时每秒回复 1.2% HP（输出检查：打得比它回得快），切到 rest 模式受到的伤害 +30%
       回血只在主机算（血量随快照同步），队员这边只显示 HUD 提示
   ===================================================================== */
defineBossMech('split', { defaults: { n: 3, kind: '', window: 10, reviveHp: 0.5, say: '', col: '#c0a0ff' },
  start(m, st, p) {
    const W = msRoomW(), kind = p.kind || m.kind + 'Shard', x0 = m.x, y0 = m.y;
    st.share = Math.max(1, Math.round(m.hp / p.n)); st.group = []; st.last = null;
    msHide(m, true);
    for (let i = 0; i < p.n; i++) st.group.push(deSplitSpawn(m, st, kind, clamp(x0 + (i - (p.n - 1) / 2) * 210, 80, W - 80), clamp(y0 + (i % 2 ? -50 : 50), 20, DEPTH - 20), st.share));
    deSplitFx(x0, y0, p, true);
  },
  update(m, st, p) {
    const G = st.group, alive = G.filter(o => !o.dead && !o.remove);
    for (let i = 0; i < G.length; i++) {
      const o = G[i]; if (!o.dead && !o.remove) continue;
      if (o.msSDown === undefined) { o.msSDown = game.t; st.last = o; if (alive.length) toastMsg(`${o.name}倒下了——${p.window} 秒内打倒剩下的 ${alive.length} 块！`, p.col); }
      if (!alive.length || game.t - o.msSDown < p.window) continue;
      const n = G[i] = deSplitSpawn(m, st, o.kind, o.x, o.y, st.share * p.reviveHp), txt = `${n.name}重新凝聚了——要在 ${p.window} 秒内把碎片全部打倒！`;
      deSplitRevFx(n.x, n.y, txt, p); msNetEv(m, st, 'rv', { t: txt, x: Math.round(n.x), y: Math.round(n.y) }); msLog('fail', m, { id: 'split', why: 'revive' });
    }
    if (G.every(o => o.dead || o.remove)) st.done = true;
  },
  end(m, st, p) {
    const ok = st.group.every(o => o.dead || o.remove), L = st.last || st.group[st.group.length - 1];
    msMechResult(m, st, ok);
    if (m.msHidden) msHide(m, false);
    if (L) { m.x = L.x; m.y = L.y; }
    deSplitFx(m.x, m.y, p, false);
    if (!ok || st.test || m.dead) return;   // test.solve（test/boss.mjs 的 mechs 部分）：只验证能解开，不让领主倒下
    m.invul = 1; m.stun = 1; if (m.act) m.endAct(); m.setState('hit');
    game.after(0.4, () => { if (m.dead) return; m.invul = 0; m.hp = 0; killEnt(m, game.player || m, {}); });
  },
  mirror: {
    start(m, st, p) { if (m) deSplitFx(m.x, m.y, p, true); else if (p.say) toastMsg(p.say, p.col); },
    ev(m, st, p, e, d) { if (e === 'rv') deSplitRevFx(d.x, d.y, d.t, p); },
    end(m, st, p) { if (m) deSplitFx(m.x, m.y, p, false); } } });
function deSplitSpawn(m, st, kind, x, y, hp) {
  const o = spawnMonster(kind, x, y, { lvl: m.lvl, boss: true, drop: true, ...skyMul() });
  o.hp = o.hpMax = Math.max(1, Math.round(hp)); o.noLoot = true; o.msSplit = st;
  if (game.dungeon) game.dungeon.bossGroup = [...new Set([...(game.dungeon.bossGroup || []), o])];
  return o;
}
function deSplitFx(x, y, p, on) {
  fxBurst(x, y, 60, 260, p.col); fxShock(x, y, 220, p.col); cam.shake = Math.max(cam.shake, 8); sfx.boom(1);
  if (on && p.say) { toastMsg(p.say, p.col); fxText('分裂！', x, y, 180, { col: p.col, size: 22, dur: 1.4 }); }
  if (!on) fxText('碎片重新聚在了一起……', x, y, 170, { col: p.col, size: 16, dur: 1.4 });
}
function deSplitRevFx(x, y, txt, p) { toastMsg(txt, '#ff6a6a'); fxBurst(x, y, 60, 180, p.col); sfx.buff(); }
BOSS_MECHS.split.test = { async solve(m, st, p, BH) { st.test = true; for (let k = 0; k < 20 && !st.done && !st.ended; k++) { for (const o of st.group) BH.kill(o); await BH.gw(0.3); } } };

REGION_HOOKS.headless = {
  sig: ['梦魇狂奔（回血输出检查）'],
  update(m, dt) {
    if (!deGallopOn(m) || m.dead) { m.deHealT = 0; return; }
    m.deHealT = (m.deHealT || 0) - dt; if (m.deHealT > 0) return; m.deHealT = 1;
    const h = Math.round(m.hpMax * 0.012); m.hp = Math.min(m.hpMax, m.hp + h); addNumber(h, m.x, m.y, m.z + 40, { heal: true });
  },
  hud(c, m, x, y) { if (!deGallopOn(m)) return; uiText('梦魇狂奔：每秒回复 1.2% HP——打得比它回得快！', x, y + 14, { size: 15, color: '#d8c0ff', sw: 3 }); },
};
const deGallopOn = m => { const st = m.msStanceSt, md = st && st.p.modes[st.i]; return !!(md && md.id === 'gallop'); };
