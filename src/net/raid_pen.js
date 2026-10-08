/* =====================================================================
   团本跨图效果的客户端部分（规则在 game/raid_core.js：aura 叠层 / 共享血量 / 重置 / 旋转 / 合并）
   - 领主：atk 攻击 +x、def 防御 +x（= 受伤 ÷(1+x)）、dmgTaken 受伤倍率、groggy / weak 虚弱（停手）
   - 本机玩家：ptaken 受到的伤害 +x、blind 视野遮挡 x 秒（每层触发一次）
   - 主机刷东西：adds 每层在本图刷 n 只怪、whirl 黑色旋风（跟着玩家落下的圈）
   - pool：共享血量（真理之棺 ×3 / 阴影之棺）——服务端发差值，这里按差值加减领主血量；上报阈值 1%
   - 到领主房报 boss（幻影之城 / 否定 / 压抑 / 忘却因此开放，扭曲的效果也要这时才生效）
   只包 raidNet 的方法，不改 net/raid.js 的结构；在 ORDER 里排在 net/raid.js 后面。
   ===================================================================== */
const RAID_PEN_WHY = { reset: '进度被重置了：回到营地', limit: '时间到了：回到营地', kick: '关联的地下城没打完：你也被送回营地', merge: '共鸣！真理的意识之棺合并成了阴影之棺：回到营地集合' };
const RAID_PEN_ADDS_MAX = 6;
{
  const N = raidNet;
  const _entered = N.onEntered, _setup = N.bossSetup, _on = N.buffOn, _off = N.buffOff, _fx = N.onFx, _pulse = N.pulse;
  N.onEntered = function (m) {
    _entered.call(this, m);
    const C = this.ctx; if (!C || C.run !== m.run) return;
    C.limit = m.limit || 0; C.pool = m.pool || null; C.form = m.form || null; C.blindUntil = 0;
    if (C.form) this.say(`希洛克的形态：${C.form}`, '#e0b0ff');
    if (C.limit) this.say(`这张图限时 ${Math.round((C.limit - this.now()) / 1000)} 秒`, '#ffd8a0');
  };
  N.bossSetup = function (dg, b) {
    const C = dg.raid, first = C && !b.raidSet;
    if (first) b.raidAtk0 = b.atk;
    _setup.call(this, dg, b);
    if (!first) return;
    if (C.pool) { b.hp = Math.max(1, Math.round(b.hpMax * clamp(C.pool.hp, 0.001, 1))); C.hpSent = b.hp / b.hpMax; }
    if (!C.bossSent) { C.bossSent = true; this.ev('boss'); }
  };
  N.buffOn = function (b, f) {
    _on.call(this, b, f);
    if (!b || b.dead) return;
    const p = f.p || {};
    if (p.atk && b.raidAtk0) { (b.raidAtk = b.raidAtk || {})[f.id] = p.atk; b.atk = Math.round(b.raidAtk0 * (1 + Object.values(b.raidAtk).reduce((s, v) => s + v, 0))); }
    if (p.def && typeof msMulSet === 'function') msMulSet(b, 'raid_def_' + f.id, 1 / (1 + p.def));
    if (p.weak && f.kind !== 'groggy') { const dur = Math.max(1, ((f.until || 0) - this.now()) / 1000); b.aiCd = Math.max(b.aiCd || 0, dur); }
  };
  N.buffOff = function (b, id) {
    _off.call(this, b, id);
    if (!b) return;
    if (b.raidAtk && b.raidAtk[id] != null) { delete b.raidAtk[id]; b.atk = Math.round(b.raidAtk0 * (1 + Object.values(b.raidAtk).reduce((s, v) => s + v, 0))); }
    if (typeof msMulSet === 'function') msMulSet(b, 'raid_def_' + id, null);
  };
  // 每层触发一次的效果（刷怪 / 旋风 / 遮挡视野）：只在 aura 的 tick 推送里做
  N.penTick = function (C, p) {
    const dg = game.dungeon; if (!dg || dg.raid !== C || dg.guest) return;
    const P = game.player; if (!P) return;
    if (p.blind) { C.blindUntil = this.now() + p.blind * 1000; this.say(`视野被遮挡 ${p.blind} 秒`, '#b0a0ff'); }
    if (p.adds && MON[p.adds]) {
      const live = ents.filter(e => !e.dead && e.kind === p.adds).length, n = Math.max(0, Math.min(p.n || 1, RAID_PEN_ADDS_MAX - live));
      const D = dg.D || {}, o = { lvl: (dg.def.lvl || [62])[0], mul: (D.hp || 1) * (dg.hpMul || 1), atkMul: D.atk || 1, drop: true };
      for (let i = 0; i < n; i++) spawnMonster(p.adds, clamp(P.x + (i % 2 ? 1 : -1) * (160 + 60 * i), 60, msRoomW() - 60), clamp(P.y + (Math.random() - 0.5) * 60, 20, DEPTH - 20), o);
      if (n) fxText(`${MON[p.adds].name} ×${n}`, P.x, P.y, P.z + 160, { col: '#ff9a7a', size: 14, dur: 1.6 });
    }
    if (p.whirl && typeof telegraph === 'function') {
      for (let i = 0; i < 2; i++) telegraph({ x: P.x + (i ? 120 : 0), y: P.y, r: 70, dur: 1.4 + i * 0.4, kind: 'circle', col: '#6a4aff', follow: i ? null : P,
        fire: g => { const t = game.realPlayer || game.player, src = ents.find(e => e.team === 'e' && !e.dead); if (t && src && Math.hypot(t.x - g.x, (t.y - g.y) * 2) < g.r && typeof msTrueHit === 'function') msTrueHit(src, t, 0.08); } });
      this.say('黑色旋风！', '#a08aff');
    }
  };
  N.onFx = function (m) {
    const C = this.ctx, here = C && m.node && m.node === C.node, p = m.p || {}, b = C && C.boss;
    if (m.kind === 'closed' && here && RAID_PEN_WHY[p.why]) { this.leaveNode(RAID_PEN_WHY[p.why]); this.changed(); return; }
    _fx.call(this, m);
    switch (m.kind) {
      case 'buff':
        if (here && p.tick) this.penTick(C, p.p || {});
        if (here && p.n > 1 && !p.tick) this.say(`效果叠到 ${p.n} 层`, '#ffd8a0');
        break;
      case 'pool':
        if (here && C.pool) {
          C.pool.hp = p.hp; if (p.by) C.pool.by = p.by;
          if (b && !b.dead && C.isHost && b.hpMax > 0) {
            b.hp = clamp(Math.round(b.hp + (p.d || 0) * b.hpMax), p.hp <= 0 ? 0 : 1, b.hpMax); C.hpSent = b.hp / b.hpMax;
            if (p.hp <= 0 && !C.cleared) { b.raidOk = true; b.invul = 0; b.hp = 0; killEnt(b, game.player || b, {}); }
          }
        }
        break;
      case 'reset': this.say(p.group ? '破坏之门的共享时限到了：全部重置、重新分配顺序' : `第 ${p.area} 层的进度重置了`, '#ff9a8a'); break;
      case 'rotate': this.say(p.res ? '共鸣！现在去打「忘却」' : '真理的意识之棺旋转了', p.res ? '#ffe070' : '#e0b0ff'); break;
      case 'merge': toastMsg('阴影之棺开了：一起进去！', '#ffe070'); break;
    }
  };
  N.pulse = function () {
    const C = this.ctx, dg = game.dungeon;
    if (C && C.started && !C.done && dg && dg.raid === C) {
      const b = C.boss;
      // 共享血量：1% 就报（另一边要尽快看到）；_pulse 的 5% 阈值之前先发
      if (C.pool && C.isHost && b && !b.dead && !C.held && !C.cleared && b.hpMax > 0) {
        const f = clamp(b.hp / b.hpMax, 0, 1);
        if (Math.abs(f - C.hpSent) >= 0.01) { C.hpSent = f; this.ev('hp', Math.round(f * 1000) / 1000); }
      }
      const P = game.realPlayer || game.player, now = this.now();
      if (P && P.buffs) for (const f of C.buffs) if (f.p && f.p.ptaken && (!f.until || f.until > now)) P.buffs['raid_' + f.id] = { taken: f.p.ptaken, t: 0.6 };
      const fog = typeof groundFx !== 'undefined' && groundFx.find(g => g.raidBlind);
      if (C.blindUntil > now && !fog && typeof msGround === 'function') msGround(null, { fogR: 150, raidBlind: true });
      else if (fog && !(C.blindUntil > now)) msGroundOff(fog);
    }
    _pulse.call(this);
  };
}
