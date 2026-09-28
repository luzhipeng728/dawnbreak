/* =====================================================================
   91. 自动测试机器人（?bot）：通过虚拟按键操作角色——找怪、对齐、普攻/放技能、躲预警圈、清完房间走向领主房、结算翻牌
   ?lv=N 直接给角色 N 级 + 同等级装备与技能，用于数值验证
   ===================================================================== */
const bot = {
  on: PARAMS.has('bot'), runPh: 0, runDir: 0, stuckT: 0, lastPos: 0, resT: 0, log: [], deaths: 0,
  tick(dt) {
    const V = input.virt = {};
    const p = game.player, D = game.dungeon;
    if (menus.isOpen('result')) { this.result(dt); return; }
    this.flipped = false; this.resT = 0;
    if (!p || !D || game.scene !== 'dungeon' || D.transition) return;
    if (D.state === 'dead') { if (!this.wasDead) this.deaths++; this.wasDead = true; if (D.deadT < 9) V.attack = 2; return; }
    this.wasDead = false;
    if (p.st === 'down' && Math.random() < 0.1) { V.jump = 2; return; }
    // 1) 躲地面预警
    const danger = groundFx.find(g => g.fire && !g.friendly && inGround(p, g.x, g.y, g.r + 10));
    if (danger) {
      const ty = danger.y > DEPTH / 2 ? 8 : DEPTH - 8;
      if (canBackstep(p) && Math.random() < 0.3) { V.down = 1; V.jump = 2; this.dodges = (this.dodges || 0) + 1; return; }   // 后跳（官方没有闪避键）
      this.move(V, p, p.x + (p.x >= danger.x ? 60 : -60), ty, true); return;
    }
    // 2) 打怪
    let tgt = null, best = 1e9;
    for (const e of ents) if (e.team === 'e' && !e.dead && !e.remove) { const d = Math.abs(e.x - p.x) + Math.abs(e.y - p.y) * 2 + (e.boss ? -200 : 0); if (d < best) { best = d; tgt = e; } }
    if (tgt) {
      const side = p.x < tgt.x ? -1 : 1, reach = 50 + tgt.w;
      const ax = Math.abs(tgt.x - p.x), ay = Math.abs(tgt.y - p.y);
      if (ax < reach + 40 && ay < 14) {
        const want = tgt.x > p.x ? 1 : -1;
        if (p.face !== want) { V[want > 0 ? 'right' : 'left'] = 1; return; }
        if (p.st === 'act' && Math.random() < 0.6) { V.attack = 2; return; }
        const ready = [];
        for (let i = 0; i < SKILL_SLOTS; i++) { const id = game.skillBar[i], S = id && SKILLS[id]; if (S && (game.skillLv[id] || 0) > 0 && (p.cool[id] || 0) <= 0 && p.mp >= S.mp && (!S.buff || !p.buffs[id])) ready.push(i); }
        if (ready.length && Math.random() < 0.08) V['s' + pick(ready)] = 2; else V.attack = 2;
        if (p.hp < p.hpMax * 0.35 && inv.potCd <= 0 && inv.count(inv.quick[0])) V.i0 = 2;
        if (p.mp < p.mpMax * 0.2 && inv.potCd <= 0 && inv.count(inv.quick[1])) V.i1 = 2;
        return;
      }
      this.move(V, p, tgt.x + side * reach, tgt.y, ax > 260);
      return;
    }
    // 3) 清完房间：走向通往领主房的门
    if (!D.doorsOpen) return;
    const dir = this.route(D);
    if (!dir) return;
    const W = game.room.x1, pos = { left: [0, DEPTH / 2], right: [W, DEPTH / 2], up: [W / 2, 0], down: [W / 2, DEPTH] }[dir];
    this.move(V, p, pos[0], pos[1], true);
  },
  // 广度优先：从当前房间到领主房的第一步方向（优先走没清过的房间）
  route(D) {
    const start = D.room, prev = new Map([[start, null]]), q = [start];
    while (q.length) { const r = q.shift(); if (r.type === 'boss') { let c = r; while (prev.get(c) && prev.get(c).room !== start) c = prev.get(c).room; const s = prev.get(c); return s ? s.dir : null; } for (const d in r.doors) { const n = r.doors[d]; if (!prev.has(n)) { prev.set(n, { room: r, dir: d }); q.push(n); } } }
    return null;
  },
  move(V, p, x, y, run) {
    const dx = x - p.x, dy = y - p.y;
    const h = Math.abs(dx) > 12 ? (dx > 0 ? 'right' : 'left') : null, v = Math.abs(dy) > 5 ? (dy > 0 ? 'down' : 'up') : null;
    if (v) V[v] = 1;
    if (!h) { this.runPh = 0; return; }
    // 双击跑：按 → 松 → 按住
    if (run && p.st !== 'run' && !(p.st === 'act')) {
      this.runPh = this.runPh + 1; if (this.runPh === 1 || this.runPh === 3) V[h] = 2; else if (this.runPh === 2) return; else V[h] = 1;
      if (this.runPh > 8) this.runPh = 0;
    } else V[h] = 1;
    // 卡住检测
    const pos = Math.round(p.x) * 1000 + Math.round(p.y);
    if (pos === this.lastPos && !p.busy) { this.stuckT += 1 / 60; if (this.stuckT > 1.5) { V.jump = 2; this.stuckT = 0; } } else this.stuckT = 0;
    this.lastPos = pos;
  },
  result(dt) {
    this.resT += dt;
    if (this.resT > 1 && !this.flipped) { const c = document.querySelector('#result .card'); if (c) { c.click(); this.flipped = true; } }
    if (this.resT > 2.5 && !window.__botDone) { const D = game.dungeon; window.__botDone = { dodges: this.dodges || 0, rank: D.result.rank, time: Math.round(D.result.time), hurt: D.hurt, deaths: this.deaths, coins: D.usedCoins, lvl: game.lvl, maxCombo: game.maxCombo }; }
  },
};
// 测试用：直接把角色拉到指定等级，穿上同等级的蓝/紫装，所有技能学到合理等级
function testLoadout(lv) {
  const p = game.player; game.lvl = lv;
  for (const s of Object.keys(SLOT_WEIGHT)) inv.equip[s] = makeEquip(s, lv, s === 'weapon' ? 2 : 1, p.cls);   // 只填能掉落的部位（称号 / 时装栏不填）
  for (const id of CLASSES[p.cls].skills) { const S = SKILLS[id]; if (S.lvReq <= lv) { let n = Math.max(1, Math.min(S.maxLv, 1 + Math.floor((lv - S.lvReq) / 2))); if (n >= S.maxLv) while (n < skillMaxLv(S) && skillLvReq(S, n + 1) <= lv) n++; game.skillLv[id] = n; } }
  game.skillBar = CLASSES[p.cls].skills.filter(id => game.skillLv[id] > 0 && !SKILLS[id].passive).concat(Array(SKILL_SLOTS).fill(null)).slice(0, SKILL_SLOTS);
  inv.add(makeConsumable('hpM', 20)); inv.add(makeConsumable('mpM', 20)); inv.quick = ['hpM', 'mpM', null, null, null, null];
  recalcStats(p); p.hp = p.hpMax; p.mp = p.mpMax;
}
