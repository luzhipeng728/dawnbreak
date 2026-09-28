/* =====================================================================
   远古地下城的手写机制（外壳在 content/regions/ancient.js）：每个房间一段脚本 + 两个领主的专属钩子
   比尔马克帝国试验场（牛头）：R0 嗜血猫妖 | R1 伊凡房（柱子召唤会自爆的伊凡，12 只清完路障才炸开，上校残血变红追人自爆）
     | R2 统帅房（柱子召唤幼小牛头，柱子在统帅就减伤）| R3 哈尼克（残血倔强：霸体 + 叫猫）| R4 嗜血猫妖（同伴死了会狂暴）
     | R5 牛头械王（倒地起身三道落雷、罪恶之眼激光、保护模式：全屏吼叫 + 无敌 + 机器人，15 秒没清掉变成牛头统帅）
   悲鸣洞穴（虫穴）：R0 丛林僵尸 | R1 法布罗（紫色法阵里打不到，队长活着队员回血，队长死了队员逃散）
     | R2 魔剑阿波菲斯（盗墓者挖出魔剑，20 秒内没打掉它，盗墓者回满血狂暴）| R3 骷髅凯恩（跟着人走的光阵）
     | R4 戮蛊幼虫（两个法阵保护，幼虫互相吞噬、吃两只变成成虫）| R5 虫王戮蛊（钻地破土的旋风、进食阶段：幼虫爬到洞口就被吃掉回血）
   只在单机 / 主机上跑（组队的队员由主机同步）。ANC.stats 是测试读的计数。
   ===================================================================== */
const ANC = { rooms: {}, stats: {} };
const ancStat = (k, n = 1) => { ANC.stats[k] = (ANC.stats[k] || 0) + n; };
const ancGuest = () => typeof netIsGuest === 'function' && netIsGuest();
const ancAlive = e => e && !e.dead && !e.remove;
const ancFoes = () => ents.filter(t => t.team === 'p' && !t.dead && !t.remove);
function ancSpawn(kind, x, y, o = {}) {
  const dg = game.dungeon, W = game.room ? game.room.x1 : 1400;
  return spawnMonster(kind, clamp(x, 50, W - 50), clamp(y, 14, DEPTH - 14), { lvl: dg.def.lvl[1], mul: dg.D.hp * (dg.hpMul || 1), atkMul: dg.D.atk, expMul: dg.D.exp, ...o });
}
const ancKillObj = e => { if (ancAlive(e)) { e.invul = 0; e.hp = 0; killEnt(e, game.player || e, {}); } };
const ancSay = (e, txt, col = '#ffd070', size = 14) => fxText(txt, e.x, e.y, e.z + e.h * (e.scale || 1) + 20, { col, size, dur: 1.4 });
const ancTrue = (src, t, frac) => msTrueHit(src, t, frac);

/* ---------------- 门：放进已有的场景（洛兰 / 暗精灵地区），洛兰右边原来那个“还没开放”的出口换成这扇隐藏门 ---------------- */
for (const [id, G] of Object.entries(REGIONS.ancient.spec.dungeons)) {
  const S = SCENES[G.gate.scene]; if (!S) continue;
  if (!S.gates.some(g => g.dungeon === id)) S.gates.push({ dungeon: id, x: G.gate.x });
  S.exits = S.exits.filter(x => !(x.locked && x.label === DUNGEONS[id].name));
}

/* ---------------- 机关物件：召唤柱、路障、法阵核心、罪恶之眼（不动、不出招，由房间脚本驱动）---------------- */
class AncPillarModel {
  constructor(col, h, kind) { this.col = col; this.h = h; this.kind = kind; this.skel = { map: {} }; }
  draw(c, pose, t = 0) {
    const h = this.h, w = h * 0.2, col = this.col;
    if (this.kind === 'barricade') {   // 木桶 + 削尖的木桩
      for (let i = -1; i <= 1; i++) { c.fillStyle = '#6a4a2a'; c.strokeStyle = '#2a1a0a'; c.lineWidth = 3; c.beginPath(); c.moveTo(i * 26 - 6, 0); c.lineTo(i * 26 - 2, -h); c.lineTo(i * 26 + 6, -h + 10); c.lineTo(i * 26 + 6, 0); c.closePath(); c.fill(); c.stroke(); }
      for (const [x, y] of [[-30, 0], [18, 0], [-6, -38]]) { c.fillStyle = '#8a5a2a'; c.strokeStyle = '#2a1a0a'; c.beginPath(); c.ellipse(x, y - 20, 18, 22, 0, 0, TAU); c.fill(); c.stroke(); c.strokeStyle = '#3a3a3a'; c.beginPath(); c.moveTo(x - 18, y - 28); c.lineTo(x + 18, y - 28); c.moveTo(x - 18, y - 12); c.lineTo(x + 18, y - 12); c.stroke(); }
      c.fillStyle = `rgba(255,70,40,${0.5 + 0.4 * Math.sin(t * 6)})`; c.beginPath(); c.arc(-6, -76, 5, 0, TAU); c.fill();
      return;
    }
    if (this.kind === 'core') { new MsCrystalModel(col, h).draw(c, pose, t); return; }
    // 召唤柱：铆钉铁柱 + 发光核心
    c.fillStyle = '#4a4440'; c.strokeStyle = '#1a1614'; c.lineWidth = 3; c.fillRect(-w, -h, w * 2, h); c.strokeRect(-w, -h, w * 2, h);
    c.fillStyle = '#6a625a'; c.fillRect(-w - 6, -h - 10, w * 2 + 12, 14); c.fillRect(-w - 6, -14, w * 2 + 12, 14);
    c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.55 + 0.35 * Math.sin(t * 5); c.fillStyle = col; c.beginPath(); c.ellipse(0, -h * 0.55, w * 0.7, h * 0.16, 0, 0, TAU); c.fill(); c.restore();
    c.fillStyle = '#2a2420'; for (let y = -h + 16; y < -16; y += 22) { c.beginPath(); c.arc(-w + 5, y, 2.5, 0, TAU); c.arc(w - 5, y, 2.5, 0, TAU); c.fill(); }
  }
}
const ancObj = (name, model, h, o = {}) => ({ ...MON.msCrystal, name, h, w: 18, d: 14, shadowR: 22, model, noGrab: true, ...o });
Object.assign(MON, {
  bmPillar: ancObj('伊凡召唤柱', () => new AncPillarModel('#ff9a40', 150), 150),
  bmPillarB: ancObj('幼小牛头召唤柱', () => new AncPillarModel('#ffd060', 140), 140),
  bmBarricade: ancObj('路障', () => new AncPillarModel('#ff6a40', 90, 'barricade'), 90, { w: 44 }),
  bmEye: ancObj('罪恶之眼', () => new MsCrystalModel('#ffe070', 70), 70, { scale: 0.5 }),
  wcCore: ancObj('紫色法阵核心', () => new AncPillarModel('#b870ff', 96, 'core'), 96),
});
if (MON.sinEye) MON_ART.bmEye = ['sinEye', { hue: 20, bright: 1.1 }];   // 罪恶之眼：天空之城的罪恶之眼，缩小 + 换色
// 数值：伊凡柱 / 路障打不动（由脚本打碎）；统帅房的柱子和法阵核心能打，血量按同级小怪算
MON.bmPillarB.hp = Math.round(MON.tauCalf.hp * 6); MON.wcCore.hp = Math.round(MON.jungleZombie.hp * 3.5);
// 魔剑阿波菲斯：没有逐帧精灵，画成悬空旋转的魔剑（用 epics3.js 的武器图标）
class ApophisModel {
  constructor() { this.skel = { map: {} }; }
  draw(c, pose, t = 0) {
    const im = IMG['icon/item_ep_gs_apophis'], bob = Math.sin(t * 2.2) * 6;
    c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.35 + 0.15 * Math.sin(t * 5); c.fillStyle = '#9a3aff'; c.beginPath(); c.ellipse(0, -70 + bob, 34, 70, 0, 0, TAU); c.fill(); c.restore();
    c.save(); c.translate(0, -70 + bob); c.rotate(-Math.PI * 0.75 + Math.sin(t * 1.5) * 0.12);
    if (im) c.drawImage(im, -64, -64, 128, 128);
    else { c.fillStyle = '#2a1030'; c.strokeStyle = '#d090ff'; c.lineWidth = 3; c.fillRect(-8, -60, 16, 100); c.strokeRect(-8, -60, 16, 100); c.fillRect(-24, 36, 48, 8); }
    c.restore();
  }
}
MON.apophis.model = () => new ApophisModel(); MON.apophis.customModel = true;
MON.mechKing.summons.push('bmEye');   // 罪恶之眼的精灵随领主一起加载

/* ---------------- 房间脚本：第一次进房间时把默认刷的怪换成这个房间自己的配置，之后每帧跑 update ---------------- */
bus.on('roomEnter', e => {
  const S = ANC.rooms[e.id], dg = game.dungeon; if (!S || !dg || ancGuest()) return;
  const sc = S[e.room.gx]; if (!sc) return;
  for (let i = ents.length - 1; i >= 0; i--) { const m = ents[i]; if (m.team === 'e' && !m.boss) ents.splice(i, 1); }
  dg.waves = [];
  const R = dg.ancRoom = { t: 0, W: game.room.x1, gx: e.room.gx, name: sc.name };
  ancStat('room:' + e.id + ':' + e.room.gx);
  if (sc.say) game.after(0.6, () => toastMsg(sc.say, '#ffd8a0'));
  sc.start(dg, R);
  addFx({ x: 0, y: -1, z: 0, dur: 1e9, update(dt) {
      if (game.dungeon !== dg || dg.room !== e.room) { this.t = this.dur; return; }
      if (dg.state !== 'play') return;
      R.t += dt; if (sc.update) sc.update(dg, R, dt);
    }, draw(c) { if (sc.draw && game.dungeon === dg && dg.room === e.room) sc.draw(c, dg, R); } });
});
bus.on('dungeonEnter', e => { if (ANC.rooms[e.id]) ANC.stats = {}; });

// 公共：紫色法阵（悲鸣洞穴）—— 法阵里的怪物打不到（无敌），核心被打碎法阵就消失
function ancCircleUpdate(R) {
  for (const C of R.circles) if (C.on && !ancAlive(C.core)) { C.on = false; ancStat('circleBroken'); fxBurst(C.x, C.y, 30, 220, '#b870ff'); toastMsg('紫色法阵被打碎了！', '#d8b0ff'); }
  for (const m of ents) {
    if (m.team !== 'e' || m.dead || m.kind === 'wcCore' || m.boss) continue;
    const inside = R.circles.some(C => C.on && inGround(m, C.x, C.y, C.r));
    if (inside) { m.invul = Math.max(m.invul, 0.12); m.ancShield = true; m.botSkip = true; }
    else if (m.ancShield) { m.ancShield = false; m.botSkip = false; }
  }
}
function ancCircleDraw(c, R) {
  for (const C of R.circles) {
    if (!C.on) continue;
    const X = sx(C.x), Y = sy(C.y, 0), rot = game.t * 0.4, img = typeof fxTint === 'function' ? fxTint('hexagram', '#a050ff') : null;
    c.save(); c.translate(X, Y); c.scale(1, GR); c.rotate(rot); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.55 + 0.15 * Math.sin(game.t * 3);
    if (img) c.drawImage(img, -C.r, -C.r, C.r * 2, C.r * 2); else { c.strokeStyle = '#b870ff'; c.lineWidth = 4; c.beginPath(); c.arc(0, 0, C.r, 0, TAU); c.stroke(); }
    c.restore();
  }
}
// 公共：戮蛊幼虫互相吞噬 —— 两只贴在一起 1.6 秒，一只吃掉另一只；吃满两只长成戮蛊成虫
function ancLarvaDevour(dt, skip) {
  const L = ents.filter(e => e.kind === 'larva' && ancAlive(e) && !e.ancFeed && !(skip && skip(e)));
  for (const a of L) {
    if (!ancAlive(a)) continue;
    let near = null, nd = 36;
    for (const b of L) if (b !== a && ancAlive(b)) { const d = Math.hypot(a.x - b.x, (a.y - b.y) * 1.6); if (d < nd) { nd = d; near = b; } }
    if (!near) { a.ancNear = null; a.ancNearT = 0; continue; }
    if (a.ancNear !== near) { a.ancNear = near; a.ancNearT = 0; }
    a.ancNearT += dt;
    if (a.ancNearT < 1.6) continue;
    const [big, small] = (a.ancEat || 0) >= (near.ancEat || 0) ? [a, near] : [near, a];
    small.remove = true; big.ancEat = (big.ancEat || 0) + 1; big.hp = Math.min(big.hpMax, big.hp + small.hp); a.ancNearT = 0; a.ancNear = null;
    ancStat('larvaEat'); ancSay(big, '吞噬！', '#d090ff'); fxBurst(big.x, big.y, 20, 90, '#9a5aff'); sfx.hit && sfx.hit('blunt', false);
    if (big.ancEat >= 2) {
      const ad = ancSpawn('adultBug', big.x, big.y, { lvl: big.lvl + 1, elite: true, drop: true });
      big.remove = true; ancStat('larvaAdult'); ancSay(ad, '长成了戮蛊成虫！', '#ff8ad0', 15); fxShock(ad.x, ad.y, 120, '#b070ff');
    }
  }
}

/* ======================= 比尔马克帝国试验场 ======================= */
ANC.rooms.bilmark = {
  0: { name: '嗜血猫妖', say: '实验室的笼子被打开了——嗜血猫妖！',
    start(dg, R) { for (let i = 0; i < 6; i++) ancSpawn('bloodCat', 460 + i * 110, 30 + (i % 3) * 60); } },
  1: { name: '疯狂伊凡', say: '柱子在不停地召唤疯狂伊凡——在它们爆炸之前清掉！清光 12 只，路障才会炸开。',
    start(dg, R) {
      const W = R.W; R.quota = 12; R.summoned = 0; R.ivans = [];
      R.pillars = [0.1, 0.2, 0.3, 0.4].map((k, i) => { const p = ancSpawn('bmPillar', W * k, i % 2 ? DEPTH * 0.78 : DEPTH * 0.22); p.invul = 1e9; p.botSkip = true; p.ancCd = 0.8 + i * 1.3; return p; });
      R.bar = ancSpawn('bmBarricade', W * 0.62, DEPTH / 2); R.bar.invul = 1e9; R.bar.botSkip = true;
    },
    update(dg, R, dt) {
      const W = R.W;
      // 柱子召唤（同时最多 6 只）
      const alive = R.ivans.filter(ancAlive).length;
      if (R.summoned < R.quota) for (const p of R.pillars) {
        if (!ancAlive(p)) continue; p.ancCd -= dt;
        if (p.ancCd > 0 || alive >= 6 || R.summoned >= R.quota) continue;
        p.ancCd = 5.5; R.summoned++;
        const v = ancSpawn('ivan', p.x + 40, p.y + rnd(-20, 20), { drop: true }); v.ancFuse = 8; R.ivans.push(v); ancStat('ivanSummon'); fxShock(p.x, p.y, 70, '#ff9a40');
      }
      // 伊凡的引信：8 秒没打死就自爆（追着人炸）
      for (const v of R.ivans) {
        if (!ancAlive(v) || v.ancBoom) continue;
        v.ancFuse -= dt;
        if (v.ancFuse <= 0) { v.ancBoom = true; ancStat('ivanBoom'); ancSay(v, '嘿嘿嘿……', '#ff6a3a'); msExplodeAt(v, v.x, v.y, { r: 95, windup: 0.55, dmg: 1.5, suicide: true, col: '#ff5a2a' }, v); }
      }
      // 12 只都没了 → 柱子熄灭，路障炸开，伊凡上校冲出来
      if (!R.open && R.summoned >= R.quota && !R.ivans.some(ancAlive)) {
        R.open = true; ancStat('barricadeOpen');
        for (const p of R.pillars) ancKillObj(p);
        const bx = R.bar.x; ancKillObj(R.bar); meteorImpact({ x: bx, y: DEPTH / 2, r: 110 }, 0.8); cam.shake = 12; sfx.boom(1.3);
        toastMsg('路障炸开了！疯狂伊凡上校冲了出来！', '#ff8a4a');
        R.col = ancSpawn('ivanColonel', W * 0.86, DEPTH / 2, { elite: true, lvl: dg.def.lvl[1] + 1, drop: true });
      }
      // 路障还在：挡住玩家
      if (ancAlive(R.bar)) for (const p of ancFoes()) if (p.x > R.bar.x - 40) { p.x = R.bar.x - 40; p.vx = Math.min(0, p.vx); }
      // 上校：残血变红，6 秒后自爆（很疼）
      const C = R.col;
      if (ancAlive(C) && !C.ancRed && C.hp < C.hpMax * 0.35) {
        C.ancRed = true; C.ancFuse = 6; C.speed *= 1.6; C.superArmor = 99; ancStat('colonelRed');
        ancSay(C, '一起上天吧！！', '#ff3a2a', 16); toastMsg('伊凡上校开始倒计时自爆——快打倒他，或者跑远 / 跳起来！', '#ff6a4a'); fxAura(C, '#ff2a1a', 1.2);
      }
      if (ancAlive(C) && C.ancRed) {
        C.superArmor = Math.max(C.superArmor, 1); C.ancFuse -= dt;
        if (C.ancFuse <= 0 && !C.ancBoom) { C.ancBoom = true; ancStat('colonelBoom'); msExplodeAt(C, C.x, C.y, { r: 170, windup: 0.4, dmg: 2.4, suicide: true, col: '#ff2a1a' }, C); cam.shake = 16; }
      }
    },
    draw(c, dg, R) {
      for (const v of [...R.ivans, R.col]) if (ancAlive(v) && (v.ancFuse ?? 99) < 4 && !v.ancBoom) {
        const X = sx(v.x), Y = sy(v.y, v.z + v.h * (v.scale || 1) + 30), n = Math.ceil(v.ancFuse);
        c.save(); c.font = '900 22px "Arial Black",sans-serif'; c.textAlign = 'center'; c.lineWidth = 5; c.strokeStyle = '#1a0806'; c.strokeText(n, X, Y); c.fillStyle = Math.floor(game.t * 8) % 2 ? '#ff3a2a' : '#ffe070'; c.fillText(n, X, Y); c.restore();
      }
      if (!R.open) uiTextWorld(c, `疯狂伊凡 ${R.summoned - R.ivans.filter(ancAlive).length}/${R.quota}`, WW / 2, 92, '#ffc080');
    } },
  2: { name: '牛头统帅', say: '两根柱子在召唤幼小牛头，柱子还在，牛头统帅受到的伤害大减——先拆柱子！',
    start(dg, R) {
      const W = R.W;
      R.pillars = [0.12, 0.88].map((k, i) => { const p = ancSpawn('bmPillarB', W * k, i ? DEPTH * 0.3 : DEPTH * 0.7); p.ancCd = 1.5 + i; return p; });
      R.cmd = ancSpawn('tauCommander', W * 0.6, DEPTH / 2, { elite: true, lvl: dg.def.lvl[1] + 1, drop: true });
      for (let i = 0; i < 2; i++) ancSpawn('tauCalf', W * (0.4 + i * 0.1), 40 + i * 80);
    },
    update(dg, R, dt) {
      const calves = ents.filter(e => e.kind === 'tauCalf' && ancAlive(e)).length;
      for (const p of R.pillars) {
        if (!ancAlive(p)) { if (!p.ancDead) { p.ancDead = true; ancStat('pillarBroken'); toastMsg('召唤柱被拆掉了！', '#ffe0a0'); } continue; }
        p.ancCd -= dt; if (p.ancCd > 0 || calves >= 5) continue;
        p.ancCd = 4.5; ancSpawn('tauCalf', p.x + (p.x < R.W / 2 ? 50 : -50), p.y, { drop: true }); ancStat('calfSummon'); fxShock(p.x, p.y, 60, '#ffd060');
      }
      const up = R.pillars.filter(ancAlive).length;
      if (ancAlive(R.cmd)) R.cmd.dmgTakenMul = up ? (up === 2 ? 0.3 : 0.6) : 1;
    },
    draw(c, dg, R) {
      if (!ancAlive(R.cmd)) return;
      for (const p of R.pillars) if (ancAlive(p)) {   // 柱子 → 统帅的连线（减伤的来源）
        c.save(); c.globalCompositeOperation = 'lighter'; c.strokeStyle = '#ffd060'; c.globalAlpha = 0.5 + 0.2 * Math.sin(game.t * 6); c.lineWidth = 3;
        c.beginPath(); c.moveTo(sx(p.x), sy(p.y, 110)); c.lineTo(sx(R.cmd.x), sy(R.cmd.y, 80)); c.stroke(); c.restore();
      }
    } },
  3: { name: '倔强的哈尼克', say: '倔强的哈尼克和一群善变猫妖。它血量低了就再也打不退了。',
    start(dg, R) {
      R.boss = ancSpawn('hanik', R.W * 0.66, DEPTH / 2, { elite: true, lvl: dg.def.lvl[1] + 1, drop: true });
      for (let i = 0; i < 5; i++) ancSpawn('fickleCat', R.W * (0.35 + i * 0.1), 30 + (i % 3) * 60);
    },
    update(dg, R) {
      const H = R.boss;
      if (ancAlive(H) && !H.ancStub && H.hp < H.hpMax * 0.4) {
        H.ancStub = true; H.speed *= 1.25; ancStat('hanikStubborn'); ancSay(H, '我……不会倒下！', '#ff9a5a', 16); fxAura(H, '#ff8a3a', 1);
        for (let i = 0; i < 3; i++) ancSpawn('fickleCat', H.x + rnd(-160, 160), rnd(20, DEPTH - 20), { drop: true });
      }
      if (ancAlive(H) && H.ancStub) H.superArmor = Math.max(H.superArmor || 0, 0.3);
    } },
  4: { name: '嗜血猫妖', say: '更多的嗜血猫妖——同伴倒下时它们会发狂。',
    start(dg, R) {
      R.cats = []; for (let i = 0; i < 8; i++) R.cats.push(ancSpawn('bloodCat', 420 + (i % 4) * 150 + rnd(0, 60), 26 + Math.floor(i / 4) * 90 + rnd(0, 30)));
      R.cats.push(ancSpawn('bloodCat', R.W * 0.8, DEPTH / 2, { elite: true, lvl: dg.def.lvl[1] + 1, drop: true }));
    },
    update(dg, R) {
      for (const c of R.cats) if (c.dead && !c.ancCounted) {
        c.ancCounted = true;
        for (const o of R.cats) if (ancAlive(o)) { o.ancRage = (o.ancRage || 0) + 1; if (o.ancRage <= 4) { o.speed *= 1.08; o.atk = Math.round(o.atk * 1.06); } }
        ancStat('catFrenzy'); if (R.cats.some(ancAlive)) toastMsg('嗜血猫妖发狂了！', '#ff8a8a');
      }
    } },
  5: { name: '牛头械王', start() {}, update() {} },
};
// 牛头械王：倒地起身 → 前方上中下三道落雷；罪恶之眼；保护模式（全屏吼叫眩晕，跳起来能躲；机器人 15 秒没清掉 → 变成牛头统帅）
REGION_HOOKS.mechKing = {
  onSpawn(m) { m.anc = { eye: 10, wasDown: false }; },
  update(m, dt) {
    const A = m.anc; if (!A) return;
    const down = m.st === 'down' || m.st === 'getup';
    if (down) A.wasDown = true; else if (A.wasDown) { A.wasDown = false; mechKingLanes(m); }
    const st = (m.msMechs || []).find(s => s.id === 'invuln' && !s.done);
    m.botSkip = !!st;
    if (!st) { A.eye -= dt; if (A.eye <= 0 && !m.busy) { A.eye = rnd(13, 17); mechKingEyes(m); } return; }
    st.ancT ??= 15; st.ancT -= dt;
    if (st.ancT <= 0 && !st.ancMorph) {
      st.ancMorph = true;
      const left = st.objs.filter(o => ancAlive(o) && o.kind === 'bmRobot');
      for (const o of left) {
        const c = spawnMonster('tauCommander', o.x, o.y, { lvl: m.lvl - 1, elite: true, drop: true, ...skyMul() }); o.remove = true; st.objs.push(c);
        fxShock(o.x, o.y, 120, '#ffb060'); ancStat('robotMorph');
      }
      if (left.length) toastMsg('机器人变成了牛头统帅！', '#ff8a4a');
    }
  },
  onPhase(m, i) {
    if (i < 1) return;
    ancStat('protectMode'); cam.flash = 0.3; cam.flashCol = '#8ad8ff'; sfx.boom(1.3);
    toastMsg('保护模式启动！全屏吼叫——跳起来能躲；15 秒内打掉机器人！', '#8ad8ff');
    for (const t of ancFoes()) { if (t.z > 12) { fxText('躲开了吼叫', t.x, t.y, t.z + 60, { col: '#c8f0ff', size: 12 }); ancStat('roarDodge'); continue; } addStatus(t, 'stun', 1.6, { src: m, force: true }); ancStat('roarStun'); }
  },
  hud(c, m, x, y) {
    const st = (m.msMechs || []).find(s => s.id === 'invuln' && !s.done); if (!st) return;
    const left = st.objs.filter(ancAlive).length;
    uiText(st.ancMorph ? `保护模式 · 还剩 ${left} 个` : `保护模式 · 机器人 ${left} 个 · ${Math.max(0, st.ancT ?? 15).toFixed(0)} 秒后变成牛头统帅`, x + 790, y + 14, { size: 15, align: 'right', color: '#8ad8ff', sw: 3 });
  },
};
function mechKingLanes(m) {
  if (m.dead || m.msHidden) return;
  ancStat('lanes'); msSay(m, '雷电——别站在它前面！', '#fff38a', 15);
  for (const k of [0.18, 0.5, 0.82]) {
    telegraph({ kind: 'line', x: m.x, y: DEPTH * k, len: 760, face: m.face, hw: 22, dur: 1.1, col: '#fff38a', fire: g => {
      if (m.dead) return;
      for (let i = 1; i <= 5; i++) lightningStrike({ x: g.x + g.face * i * 140, y: g.y });
      for (const t of ancFoes()) {
        const dx = (t.x - g.x) * g.face;
        if (Math.abs(t.y - g.y) > g.hw + 10 || dx < -10 || dx > g.len || t.invul > 0) continue;
        addStatus(t, 'shock', 4, { src: m, force: true }); applyHit(m, t, { dmg: 1.5, sure: true, knock: 140, stun: 0.4, hs: 0.05 }, { proj: true }); ancStat('laneHit');   // 先感电：挨打后的无敌帧会挡住状态
      }
    } });
  }
}
function mechKingEyes(m) {
  const p = game.player; if (!p) return;
  ancStat('eyes'); msSay(m, '罪恶之眼！', '#ffe070', 14);
  for (const s of [-1, 1]) {
    const x = clamp(p.x + s * rnd(110, 220), 80, game.room.x1 - 80), y = rnd(24, DEPTH - 24);
    telegraph({ x, y, r: 40, dur: 1.1, col: '#ffe070', fire: () => {
      if (m.dead || game.dungeon == null) return;
      const eye = spawnMonster('bmEye', x, y, { lvl: m.lvl }); eye.invul = 1e9; eye.botSkip = true; eye.z = 50; eye.face = p.x >= x ? 1 : -1;
      telegraph({ kind: 'line', x, y, len: 900, face: eye.face, hw: 16, dur: 0.9, col: '#ffe070', fire: g => {
        eye.remove = true; if (m.dead) return;
        addFx({ x, y: y + 1, z: 0, dur: 0.35, face: g.face, draw(c) { const k = this.t / this.dur, X = sx(this.x), Y = sy(this.y, 50); c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 1 - k; c.fillStyle = '#fff4b0'; c.fillRect(Math.min(X, X + 900 * this.face), Y - 7, 900, 14); c.fillStyle = '#ffe070'; c.fillRect(Math.min(X, X + 900 * this.face), Y - 16, 900, 32 * (1 - k)); c.restore(); } });
        for (const t of ancFoes()) { const dx = (t.x - x) * g.face; if (Math.abs(t.y - y) <= g.hw + 8 && dx >= -8 && dx <= g.len && t.invul <= 0) { applyHit(m, t, { dmg: 1.1, sure: true, knock: 60, stun: 0.3, hs: 0.04 }, { proj: true }); ancStat('eyeHit'); } }
        ancStat('eyeLaser');
      } });
    } });
  }
}

/* ======================= 悲鸣洞穴 ======================= */
ANC.rooms.wailing_cave = {
  0: { name: '丛林僵尸', say: '洞穴里传来悲鸣……丛林僵尸挡住了路。',
    start(dg, R) { for (let i = 0; i < 8; i++) ancSpawn('jungleZombie', 420 + (i % 4) * 160 + rnd(0, 50), 24 + Math.floor(i / 4) * 100 + rnd(0, 30)); } },
  1: { name: '法布罗队长', say: '紫色法阵里的怪物打不到——把它们引出来，或者打碎法阵核心。队长活着，队员会一直回血。',
    start(dg, R) {
      const cx = R.W * 0.66, cy = DEPTH / 2;
      R.circles = [{ x: cx, y: cy, r: 140, on: true, core: ancSpawn('wcCore', cx + 70, cy - 40) }];
      R.cap = ancSpawn('fabroCaptain', cx - 20, cy, { elite: true, lvl: dg.def.lvl[1] + 1, drop: true });
      R.mem = [0, 1, 2, 3].map(i => ancSpawn('fabroMember', cx + Math.cos(i * 1.57) * 90, cy + Math.sin(i * 1.57) * 40));
    },
    update(dg, R, dt) {
      ancCircleUpdate(R);
      if (ancAlive(R.cap)) { for (const e of R.mem) if (ancAlive(e) && e.hp < e.hpMax) { const h = e.hpMax * 0.04 * dt; e.hp = Math.min(e.hpMax, e.hp + h); R.regen = (R.regen || 0) + h; } }
      else if (!R.fled) {
        R.fled = true; ancStat('captainDown'); toastMsg('法布罗队长倒下了——队员们四散逃跑！', '#ffd8a0');
        for (const C of R.circles) ancKillObj(C.core);
        for (const e of R.mem) if (ancAlive(e)) { const dir = e.x < R.W / 2 ? -1 : 1; e.ancFlee = true; e.botSkip = true; e.invul = 1e9; e.control = m => { m.vx = dir * 260; m.vy = 0; m.face = dir; if (m.st !== 'walk' && !m.busy) m.setState('walk'); }; game.after(2.2, () => { if (ancAlive(e)) { e.remove = true; ancStat('memberFled'); } }); }
      }
    },
    draw(c, dg, R) { ancCircleDraw(c, R); } },
  2: { name: '魔剑阿波菲斯', say: '盗墓者在挖什么东西……',
    start(dg, R) {
      const x = R.W * 0.62, y = DEPTH / 2; R.spot = { x, y }; R.dig = 3;
      R.diggers = [0, 1, 2, 3].map(i => { const e = ancSpawn('graveDigger', x + Math.cos(i * 1.57 + 0.6) * 110, y + Math.sin(i * 1.57 + 0.6) * 45, { drop: true }); e.aiCd = 3.2; e.face = x > e.x ? 1 : -1; return e; });
      telegraph({ x, y, r: 70, dur: 3, col: '#b050ff' });
    },
    update(dg, R, dt) {
      if (R.dig > 0) { R.dig -= dt; if (R.dig <= 0) {
        R.sword = ancSpawn('apophis', R.spot.x, R.spot.y, { elite: true, lvl: dg.def.lvl[1] + 1, drop: true }); R.swordT = 20; ancStat('apophisRise');
        fxSpr('pillar', R.spot.x, R.spot.y, 0, { h: 300, w: 120, dur: 1, ay: 1, col: '#a040ff' }); cam.shake = 10; sfx.boom(1.1);
        toastMsg('魔剑阿波菲斯出土了！20 秒内打掉它，否则盗墓者会发狂！', '#e0a0ff');
        const od = R.sword.onDeath; R.sword.onDeath = a => { if (od) od(a); ancApophisDrop(R.sword); };
      } return; }
      if (R.swordT > 0 && ancAlive(R.sword)) { R.swordT -= dt; if (R.swordT <= 0) {
        ancStat('diggerRage'); toastMsg('魔剑的力量涌进了盗墓者的身体——它们发狂了！', '#ff6a8a');
        for (const e of R.diggers) if (ancAlive(e)) { e.hp = e.hpMax; e.atk = Math.round(e.atk * 1.6); e.speed *= 1.35; e.superArmor = 99; fxAura(e, '#ff2a4a', 1.2); ancSay(e, '狂暴！', '#ff4a4a', 15); }
      } }
      if (R.sword && !ancAlive(R.sword) && !R.slain) { R.slain = true; if (R.swordT > 0) { ancStat('swordSlain'); toastMsg('魔剑阿波菲斯沉寂了。', '#d8b0ff'); } }
    },
    draw(c, dg, R) { if (ancAlive(R.sword) && R.swordT > 0) uiTextWorld(c, `魔剑阿波菲斯 ${Math.ceil(R.swordT)}`, WW / 2, 92, R.swordT < 6 ? '#ff6a6a' : '#e0b0ff'); } },
  3: { name: '骷髅凯恩', say: '骷髅凯恩握着魔剑从地下钻了出来——脚下的光阵会跟着你走！',
    start(dg, R) {
      R.kain = ancSpawn('kain', R.W * 0.68, DEPTH / 2, { elite: true, lvl: dg.def.lvl[1] + 1, drop: true });
      for (let i = 0; i < 4; i++) ancSpawn('jungleZombie', R.W * (0.3 + i * 0.12), 30 + (i % 2) * 110);
    } },
  4: { name: '戮蛊幼虫', say: '两个紫色法阵护着一窝戮蛊幼虫——它们会互相吞噬，吃掉两只就长成成虫！',
    start(dg, R) {
      R.circles = [[0.36, 0.3], [0.72, 0.7]].map(([kx, ky]) => { const x = R.W * kx, y = DEPTH * ky; return { x, y, r: 120, on: true, core: ancSpawn('wcCore', x, y) }; });
      for (const C of R.circles) for (let i = 0; i < 5; i++) ancSpawn('larva', C.x + rnd(-90, 90), C.y + rnd(-30, 30), { drop: true });
    },
    update(dg, R, dt) {
      ancCircleUpdate(R); ancLarvaDevour(dt);
      if (!R.done && !ents.some(e => (e.kind === 'larva' || e.kind === 'adultBug') && ancAlive(e))) { R.done = true; for (const C of R.circles) ancKillObj(C.core); }
    },
    draw(c, dg, R) { ancCircleDraw(c, R); } },
  5: { name: '虫王戮蛊',
    start(dg, R) { R.boss = dg.boss; },
    update(dg, R, dt) {
      const B = R.boss; if (!B) return;
      // 进食阶段（虫王钻进地下，invuln 机制召出的幼虫）：幼虫爬向洞口，爬到就被吃掉给虫王回血
      const st = (B.msMechs || []).find(s => s.id === 'invuln' && !s.done);
      if (st) {
        R.hole = R.hole || { x: B.x, y: B.y };
        for (const o of st.objs) {
          if (!ancAlive(o)) continue;
          if (!o.ancFeed) { o.ancFeed = true; o.speed = 70; o.control = e => { if (e.busy) return; const dx = R.hole.x - e.x, dy = R.hole.y - e.y, d = Math.hypot(dx, dy) || 1; e.vx = dx / d * e.speed; e.vy = dy / d * e.speed * 0.7; e.face = dx >= 0 ? 1 : -1; if (e.st !== 'walk') e.setState('walk'); }; }
          if (Math.hypot(o.x - R.hole.x, (o.y - R.hole.y) * 1.6) < 64) {
            o.remove = true; const h = Math.round(B.hpMax * 0.05); B.hp = Math.min(B.hpMax, B.hp + h); addNumber(h, R.hole.x, R.hole.y, 40, { heal: true });
            ancStat('bugEat'); fxBurst(R.hole.x, R.hole.y, 20, 120, '#b070ff'); toastMsg('幼虫被虫王吃掉了——虫王回复了体力！', '#ff8ad0');
          }
        }
      } else R.hole = null;
      ancLarvaDevour(dt, e => e.ancFeed);
    },
    draw(c, dg, R) {
      if (!R.hole) return;
      const X = sx(R.hole.x), Y = sy(R.hole.y, 0);
      c.save(); c.fillStyle = 'rgba(20,8,24,0.85)'; c.beginPath(); c.ellipse(X, Y, 96, 96 * GR, 0, 0, TAU); c.fill(); c.strokeStyle = '#b070ff'; c.lineWidth = 3; c.stroke(); c.restore();
    } },
};
// 虫王戮蛊：钻地找人 → 破土而出 + 两圈旋风往外扩（跑远或者跳起来）
REGION_HOOKS.bugKing = {
  onSpawn(m) { m.anc = { burrow: 14 }; },
  update(m, dt) {
    const A = m.anc; if (!A || A.dig || msMechActive(m, 'invuln')) return;
    A.burrow -= dt; if (A.burrow <= 0 && !m.busy) bugKingBurrow(m);
  },
  hud(c, m, x, y) { const A = m.anc; if (A && !A.dig && !msMechActive(m, 'invuln')) uiText(`钻地 ${Math.max(0, A.burrow).toFixed(0)}s`, x + 790, y + 14, { size: 15, align: 'right', color: '#d8b0ff', sw: 3 }); },
};
function bugKingBurrow(m) {
  const A = m.anc, p = game.player; if (!p) return;
  A.dig = true; A.burrow = rnd(16, 20); ancStat('burrow');
  toastMsg('虫王钻进了地下——它在找你！', '#d8b0ff'); msSay(m, '', '#d8b0ff');
  msHide(m, true);
  telegraph({ x: p.x, y: p.y, r: 120, dur: 2.2, follow: p, col: '#b070ff', kind: 'hex', friendly: true, fire: g => {   // 范围跟着虫王的体型（scale 2.2）
    A.dig = false; if (m.dead) return;
    msHide(m, false); m.x = clamp(g.x, 80, game.room.x1 - 80); m.y = clamp(g.y, 20, DEPTH - 20); m.z = 0; cam.shake = 14; sfx.boom(1.3);
    const x = m.x, y = m.y;
    const ring = (r0, r1) => { fxShock(x, y, r1, '#b070ff'); for (const t of ancFoes()) if (t.invul <= 0 && t.z < 30 && inGround(t, x, y, r1) && !(r0 > 0 && inGround(t, x, y, r0))) { applyHit(m, t, { dmg: 1.3, sure: true, knock: 260, launch: 260, hs: 0.05 }, { proj: true }); ancStat('burrowHit'); } };
    ring(0, 125); game.after(0.35, () => ring(125, 250)); game.after(0.7, () => ring(250, 375));
  } });
}
// 魔剑阿波菲斯倒下：小几率掉落 epics3.js 的「魔剑-阿波菲斯」
function ancApophisDrop(e) {
  if (ancGuest() || !ITEMS.ep_gs_apophis || Math.random() > 0.08) return;
  const it = makeItem('ep_gs_apophis'); if (it) spawnDrop({ kind: 'item', item: it, x: e.x, y: e.y, z: 40 });
}
