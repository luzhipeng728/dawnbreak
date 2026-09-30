/* =====================================================================
   街霸 P1（一觉之后，docs/SKILLS_OFFICIAL_fighter.md 6.1；等级按 common.md 第 7 节压缩）：
   一觉 千手罗汉：千手奥义、天崩地裂（觉醒）、爆破污桶、千锁乱舞
   二觉 暗街之王：诡诈之道、暗街夺命锁、飞沙走石、燃火轰天炮（觉醒）
   三觉 归元·街霸：逆道·皆允、逆道·爆狱、逆道·幽链之界（觉醒）
   锁链 / 链钩 / 木桶 / 炸药桶 / 铁管毒雷 / 暗街的楼房全部运行时绘制（fighter_brawler.js 的 fbDraw*）；碎石 / 火焰 / 爆炸复用 fx 素材。
   ===================================================================== */
// 天崩地裂留下的火焰地带（6 秒，灼伤 + 中毒）
defSummon('fb_firezone', { kind: 'field', life: 6, r: 200, tick: 0.5, max: 2, over: 'oldest', keepRoom: false,
  onTick(s, list) { for (const t of list) { summonHit(s, t, { dmg: s.dmg, stun: 0.1, knock: 0, hs: 0.02, type: 'mag', col: FB_COL.fire, snd: 'blunt' }); fbAbn(s.owner, t, 'burn', 3, s.dps); fbAbn(s.owner, t, 'poison', 3, s.dps * 0.8); } },
  draw(c, s) { const k = s.lifeT / s.life, a = k > 0.88 ? (1 - k) / 0.12 : Math.min(1, s.lifeT * 4), X = sx(s.x), Y = sy(s.y, 0), R = 200;
    c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.35 * a; const g = c.createRadialGradient(X, Y, 10, X, Y, R); g.addColorStop(0, '#ff9a3a'); g.addColorStop(1, 'rgba(255,60,20,0)'); c.fillStyle = g;
    c.beginPath(); c.ellipse(X, Y, R, R * GR, 0, 0, TAU); c.fill(); c.restore();
    for (let i = 0; i < 7; i++) { const ang = i * 0.9 + s.sid, rr = R * (0.25 + 0.7 * ((i * 53) % 10) / 10), fl = 0.7 + 0.3 * Math.sin(game.t * 9 + i);
      drawSpr(c, 'jv_flame', X + Math.cos(ang) * rr, Y + Math.sin(ang) * rr * GR + 4, 0, 46 * fl, { ay: 1, alpha: a * 0.85 }); } } });

/* ---- 千手奥义（一觉被动）：投掷物装填数 +、再投间隔 / 装填冷却缩短、飞行速度 ×1.1；基本 / 技能攻击、暴击提高 ---- */
defSkill('fb_thousand', { name: '千手奥义', cls: 'fighter', job: FB_JOB, tier: 1, lvReq: 21, passive: true, type: 'mag', col: '#d8a030',
  desc: '【被动 · 一觉】四种投掷物的装填数增加，再投间隔和装填冷却缩短，投掷物飞得更快（×1.1）；基本攻击和技能攻击提高，物理 / 魔法暴击率提高。',
  infoExtra: lv => [['装填数', '+' + (1 + Math.floor((lv - 1) / 3))], ['再投间隔', '×' + (0.96 - 0.01 * lv).toFixed(2)], ['装填冷却', '×' + (1 - 0.02 * lv).toFixed(2)], ['攻击', '+' + pct(0.04 + 0.005 * lv)], ['暴击率', '+3%']] });

/* ---- 天崩地裂（一觉，↑↑↓↓+Z）：巨大的链钩划过地面引发连环爆炸（把敌人拖向中间）→ 抓起巨石砸下，冲击波；留下 6 秒火焰地带；无敌；投掷物全部装满 ---- */
defSkill('fb_awaken', { name: '天崩地裂', cls: 'fighter', job: FB_JOB, tier: 1, lvReq: 21, maxLv: 3, mp: 150, cd: 135, pvp: 0.45, type: 'mag', awaken: true, col: '#ff8a3a',
  desc: '【觉醒 · 千手罗汉】甩出巨大的链钩，从远处沿地面拖回来，一路引发爆炸并把敌人拖向中间；接着抓起一块巨石砸下，冲击波把周围的敌人震飞，造成灼伤 / 中毒 / 出血，砸下的地方留下 6 秒的火焰地带（灼伤 + 中毒）。施放中无敌；施放时自动装满没在装填冷却中的投掷物。',
  pow: lv => skillDmg(30, 8, lv), ai: { kind: 'awaken', r: [0, 520], dy: 120 },
  act: lv => { const D = skillDmg(30, 8, lv);
    return { name: 'fb_awaken', clip: 'fbSwing', dur: 2.25, superArmor: true, invul: true, noCounter: true,
      onStart: e => { game.cutin = { t: 0, dur: 1.0, name: '天崩地裂', who: cutinWho(e, 1) }; game.timeStop = 0.9; sfx.awaken(); e.invul = Math.max(e.invul, 1.2); fxAfterimage(e, '#ff8a3a');
        const R = game.room, cx = e.x + e.face * 240; e.act.cx = R ? clamp(cx, R.x0 + 80, R.x1 - 80) : cx; e.act.cy = e.y; e.act.far = e.x + e.face * 540;
        for (const id of FB_THROWS) { const Q = hasSkill(e, id) && chargesOf(e, id); if (Q && !Q.rl) fbFill(e, id); } },
      update: e => { const a = e.act;
        // 链钩：0.1~0.4 甩出去，0.4~0.95 沿地面拖回来
        if (e.actT < 1.0) { const k1 = clamp((e.actT - 0.1) / 0.3, 0, 1), k2 = clamp((e.actT - 0.4) / 0.55, 0, 1), hx = lerp(lerp(e.x + e.face * 30, a.far, easeOut(k1)), e.x + e.face * 70, easeIn(k2)), hz = k2 > 0 ? 6 : 60 + 40 * Math.sin(k1 * Math.PI);
          a.hx = hx; addFx({ x: hx, y: e.y + 0.8, z: 0, dur: 0.02, draw(c) { fbDrawChain(c, sx(e.x + e.face * 12), sy(e.y, e.z + 70), sx(hx), sy(e.y, hz), { end: 'hook', s: 1.8, hs: 2.4, sag: k2 > 0 ? 8 : 0 }); } }); } },
      events: [
        ...Array.from({ length: 6 }, (_, i) => evAt(0.44 + i * 0.09, e => { const a = e.act, x = a.hx ?? e.x + e.face * (480 - i * 70); sfx.boom(0.5); cam.shake = Math.max(cam.shake, 4);
          fxSpr('explosion', x, a.cy, 30, { w: 130, dur: 0.4 }); fxSpr('enSpike', x, a.cy, 0, { w: 90, dur: 0.6, ay: 1, add: false }); fxDust(x, a.cy, 5, 30);
          const hit = fbArea(e, x, a.cy, 120, { dmg: D * 0.06, stun: 0.5, knock: 0, airLift: 90, hs: 0.04, sure: true, downHit: true, col: '#ffb050' }, { zMax: 200 });
          for (const t of hit) if (!hasSA(t) && !t.boss && !t.fixed) t.x = lerp(t.x, a.cx, 0.45); })),   // 往中间拖（霸体的敌人拖不动）
        evAt(1.0, e => { e.play('fbLift', true); sfx.charge(); cam.shake = Math.max(cam.shake, 3); }),
        evAt(1.0, e => addFx({ ent: e, x: e.x, y: e.y + 0.5, z: 0, dur: 0.55, draw(c) { const k = Math.min(1, this.t / 0.3), p = this.ent; fbDrawRock(c, sx(p.x), sy(p.y, p.z + 110 + 40 * k), 60 + 70 * k, 0.2); } })),
        evAt(1.55, e => { const a = e.act; e.play('fbSlam', true); sfx.swing(true);
          addFx({ x: a.cx, y: a.cy + 0.5, z: 0, dur: 0.16, x0: e.x, draw(c) { const k = easeIn(this.t / this.dur); fbDrawRock(c, sx(lerp(this.x0, this.x, k)), sy(this.y, 170 * (1 - k) + 30), 140, k * 2); } }); }),
        evAt(1.7, e => { const a = e.act; cam.shake = 12; cam.flash = 0.08; cam.flashCol = '#ffd090'; sfx.boom(1.4);
          fxShock(a.cx, a.cy, 420, '#ff8a3a'); fxShock(a.cx, a.cy, 300, '#ffe0a0'); fxBurst(a.cx, a.cy, 60, 380, '#ffb050'); fxSpr('lava', a.cx, a.cy, 0, { w: 300, dur: 0.9, ay: 1 }); fxSpr('rock', a.cx, a.cy, 30, { w: 120, dur: 0.6, add: false });
          for (let i = 0; i < 12; i++) { const vx = rnd(-320, 320), vz = rnd(200, 460); addFx({ x: a.cx, y: a.cy + rnd(-30, 30), z: 20, vx, vz, dur: 0.8, r: rnd(0, 6), update(dt) { this.x += this.vx * dt; this.vz -= 1000 * dt; this.z = Math.max(0, this.z + this.vz * dt); }, draw(c) { fbDrawRock(c, sx(this.x), sy(this.y, this.z), 22, this.r + this.t * 8); } }); }
          for (let i = 0; i < 5; i++) game.after(i * 0.05, () => fxSpr('jv_flame', a.cx + rnd(-180, 180), a.cy + rnd(-40, 40), 0, { w: 70, h: 110, dur: 0.6, ay: 1 }));
          fbArea(e, a.cx, a.cy, 320, { dmg: D * 0.58, launch: 520, knock: 200, hs: 0.14, big: 2.2, sure: true, downHit: true, col: '#ffb050', snd: 'crit',
            onHit: (q, t) => { fbAbn(q, t, 'burn', 6, 0.02 * D); fbAbn(q, t, 'poison', 6, 0.015 * D); fbAbn(q, t, 'bleed', 6, 0.015 * D); } }, { zMax: 260 });
          const s = summon(e, 'fb_firezone', { x: a.cx, y: a.cy, life: 6 }); if (s) { s.dmg = D * 0.012; s.dps = 0.01 * D; }
          e.invul = Math.max(e.invul, 0.6); })] }; } });

/* ---- 爆破污桶（→←↓→+Z）：扔出一桶黏糊糊的爆炸物（大范围、灼伤 / 中毒 / 减速）；强化投掷：改成一脚踢出铁桶（范围窄、伤害高、击倒，不耗投掷物）---- */
defSkill('fb_barrel', { name: '爆破污桶', cls: 'fighter', job: FB_JOB, tier: 1, lvReq: 23, mp: 60, cd: 20, type: 'mag', col: '#8a5a32',
  desc: '向前方扔出一只装满黏稠爆炸物的木桶，落地炸开的污物覆盖很大一片（落点后方也打得到），造成灼伤、中毒和减速（移速 -32.5%、攻速 -15%，7 秒）。强化投掷：改成一脚踢出铁桶，范围变窄但伤害更高并击倒敌人，没有减速（不消耗投掷物）。',
  pow: lv => skillDmg(13, 1.3, lv), ai: { kind: 'aoe', r: [100, 420], dy: 60 },
  act: (lv, p) => { const strong = !!(p && p.buffs && p.buffs.fb_strong), D = skillDmg(13, 1.3, lv);
    const base = { name: 'fb_barrel', dur: 0.62, noCounter: true, cancelFrom: 0.5, links: fbRbLinks(p), linkFrom: 0.3, fbRB: true, onEnd: (e, cut) => { if (cut) e._fbRB = game.t; } };
    if (strong) return { ...base, clip: 'fbKick', onStart: e => { delete e.buffs.fb_strong; },
      events: [evAt(0.08, e => addFx({ ent: e, x: e.x, y: e.y + 0.5, z: 0, dur: 0.14, draw(c) { const p = this.ent; fbDrawBarrel(c, sx(p.x + p.face * 30), sy(p.y, 14), 0, 'iron', 1.6); } })),
        evAt(0.22, e => { sfx.hit('blunt', false); sfx.swing(true);
          spawnProj({ owner: e, x: e.x + e.face * 34, y: e.y, z: 14, vx: e.face * 760 * fbSpd(e), vz: 0, face: e.face, life: 0.6, w: 18, d: 20, h: 40, pierce: false, spin: 0,
            hit: { dmg: D * 0.3, stun: 0.5, knock: 120, hs: 0.06, type: 'mag', col: '#dfe4ee', snd: 'blunt' },
            update(q, dt) { q.spin += dt * 18 * q.face; if (Math.random() < 0.5) fxDust(q.x - q.face * 12, q.y, 1, 4); },
            onEnd(q) { cam.shake = Math.max(cam.shake, 7); sfx.boom(1.0); fxSpr('explosion', q.x, q.y, 30, { w: 190, dur: 0.5, grow: [0.5, 1.2] }); fxShock(q.x, q.y, 180, '#ffb050');
              fbArea(e, q.x, q.y, 120, { dmg: D * 0.95, down: true, downLift: 260, knock: 180, hs: 0.12, big: 1.8, sure: true, col: '#ffb050', snd: 'crit', downHit: true, onHit: (a, t) => fbAbn(a, t, 'burn', 4, 0.012 * D) }, { zMax: 200 }); },
            draw(c, q) { fbDrawBarrel(c, sx(q.x), sy(q.y, q.z + 14), q.spin, 'iron', 1.6); } }); })] };
    return { ...base, clip: 'fbThrow',
      events: [evAt(0.18, e => { sfx.swing(true); const A = fbAim(e, 280, 400);
        fbLob(e, { tx: A.x, ty: A.y, T: 0.5 / fbSpd(e), vz: 260, z0: 90, bw: 18, bd: 18, bh: 30, shadow: 16, spinV: 6, draw: (c, X, Y, q) => fbDrawBarrel(c, X, Y, q.spin, 'wood', 1.8),
          onLand: q => { const x = q.x, y = q.y; cam.shake = Math.max(cam.shake, 6); sfx.boom(0.9);
            fxSpr('explosion', x, y, 30, { w: 170, dur: 0.45 }); fxShock(x, y, 240, '#9ad05a');
            for (let i = 0; i < 7; i++) fxSpr('poison', x + e.face * rnd(-60, 200), y + rnd(-40, 40), rnd(10, 50), { w: 110, dur: 0.7, grow: [0.5, 1.2], col: i % 2 ? '#9ad05a' : undefined });
            const onHit = (a, t) => { fbAbn(a, t, 'burn', 4, 0.012 * D); fbAbn(a, t, 'poison', 4, 0.012 * D); fbAbn(a, t, 'slow', 7); };
            const seen = new Set(), mul = t => seen.has(t) ? 0 : (seen.add(t), 1);   // 落点 + 落点后方一大片（官方：污物溅得很远），每个敌人只算一次
            fbArea(e, x, y, 170, { dmg: D, launch: 260, knock: 80, hs: 0.1, big: 1.6, sure: true, col: '#9ad05a', downHit: true, onHit }, { mul, zMax: 200 });
            fbArea(e, x + e.face * 150, y, 150, { dmg: D, launch: 260, knock: 80, hs: 0.1, big: 1.6, sure: true, col: '#9ad05a', downHit: true, onHit }, { mul, zMax: 200 }); } }); })] }; } });

/* ---- 千锁乱舞（→←↑→+Z）：大幅挥动锁链，把敌人赶到中间并出血，最后猛拽（远处的敌人也被拉到身前）；霸体 ---- */
defSkill('fb_chain', { name: '千锁乱舞', cls: 'fighter', job: FB_JOB, tier: 1, lvReq: 25, mp: 90, cd: 50, type: 'mag', col: '#9aa0b0',
  desc: '大幅度来回挥动锁链（前后各约 380px），把敌人赶到身前并让他们出血，最后一记猛拽把周围的敌人都拉到身前（离得远的也拉得过来）。施放中霸体。',
  pow: lv => skillDmg(16, 1.6, lv), ai: { kind: 'aoe', r: [0, 380], dy: 60 },
  act: (lv, p) => { const D = skillDmg(16, 1.6, lv);
    const swing = (i) => e => { e.play('fbSwing', true); sfx.swing(true); cam.shake = Math.max(cam.shake, 3); const back = i % 2;
      fbChainSweep(e, 0.32, { r: 380, a0: back ? 0 : Math.PI, a1: back ? Math.PI : 0, s: 1.5 }); fxDust(e.x + e.face * (back ? -200 : 200), e.y, 4, 60);
      const hit = fbBox(e, [-380, 380, 70, 0, 130], { dmg: D * 0.2, stun: 0.5, knock: 0, airLift: 60, hs: 0.05, sure: true, col: '#dfe4ee', snd: 'slash', onHit: (a, t) => fbAbn(a, t, 'bleed', 3, 0.012 * D) });
      for (const t of hit) if (!hasSA(t) && !t.boss && !t.fixed) t.x = lerp(t.x, e.x + e.face * 110, 0.4); };
    return { name: 'fb_chain', clip: 'fbSwing', dur: 1.75, superArmor: true, noCounter: true, links: fbRbLinks(p), linkFrom: 0.3, fbRB: true, onEnd: (e, cut) => { if (cut) e._fbRB = game.t; },
      events: [evAt(0.12, swing(0)), evAt(0.46, swing(1)), evAt(0.8, swing(2)),
        evAt(1.2, e => { e.play('fbSlam', true); sfx.swing(true); cam.shake = Math.max(cam.shake, 6);
          const got = []; for (const t of ents) if (foe(e, t) && !t.dead && t.invul <= 0 && Math.abs(t.x - e.x) < 560 && Math.abs(t.y - e.y) < 110) got.push(t);
          for (const t of got) { addFx({ x: t.x, y: t.y + 0.5, z: 0, dur: 0.22, t0: t, draw(c) { const q = this.t0; fbDrawChain(c, sx(e.x + e.face * 10), sy(e.y, e.z + 62), sx(q.x), sy(q.y, q.z + q.h * 0.5), { end: 'hook', s: 1.1 }); } });
            if (!t.boss && !t.fixed) { const R = game.room, x = e.x + e.face * rnd(60, 110); t.x = R ? clamp(x, R.x0 + t.w, R.x1 - t.w) : x; t.y = clamp(lerp(t.y, e.y, 0.6), 4, DEPTH - 4); } }
          fbBox(e, [-560, 560, 110, 0, 160], { dmg: D * 0.4, down: true, downLift: 180, knock: 60, hs: 0.1, big: 1.6, sure: true, col: '#dfe4ee', snd: 'blunt', downHit: true, onHit: (a, t) => fbAbn(a, t, 'bleed', 3, 0.015 * D) });
          fxShock(e.x + e.face * 80, e.y, 200, '#dfe4ee'); })] }; } });

/* ---- 诡诈之道（二觉被动）----
   转职技能伤害提高；所有怪物异常抗性降低（本作折算为异常持续时间 +20%）；进地下城 / 复活时自动装满投掷物；
   毒雷引爆 / 极恶飞锁 / 千锁乱舞 / 爆破污桶 / 飞沙走石 施放中可以取消接抛沙和投掷技能（霸体、不消耗投掷物） */
defSkill('fb_rulebreak', { name: '诡诈之道', cls: 'fighter', job: FB_JOB, tier: 2, lvReq: 26, passive: true, type: 'mag', col: '#6a3a9a',
  desc: '【被动 · 二觉】不择手段取胜：基本攻击和转职技能攻击提高；所有怪物的异常抗性降低（本作：施加的异常持续时间 +20%）；进入地下城、复活时自动装满投掷物。毒雷引爆、极恶飞锁、千锁乱舞、爆破污桶、飞沙走石施放中可以取消接抛沙和投掷技能，取消出来的投掷带霸体且不消耗投掷物。',
  infoExtra: lv => [['攻击', '+' + pct(0.08 + 0.01 * lv)], ['异常持续时间', '+20%']] });

/* ---- 暗街夺命锁（→←→+Z）：锁链插进地面旋转，把周围的敌人挑起（出血），再全部抓起摔到地上；摔之前 ↑ 扔最远、→ 扔到锁链处、其他扔到身前 ---- */
defSkill('fb_chaindrive', { name: '暗街夺命锁', cls: 'fighter', job: FB_JOB, tier: 2, lvReq: 26, mp: 100, cd: 40, type: 'mag', col: '#6a6e7a', grab: true,
  desc: '把锁链插进前方地面旋转，把周围的敌人挑到空中并出血，接着抓住被挑起的敌人全部摔到地上（落地爆炸）。摔之前按方向键调整落点：↑ 扔到最远，→ 扔到锁链插地的位置，其他扔到身前。抓不住的敌人（霸体被挑不起、领主等）改为受到一记重击。施放中霸体。',
  pow: lv => skillDmg(18, 1.8, lv), ai: { kind: 'aoe', r: [60, 360], dy: 60 },
  act: lv => { const D = skillDmg(18, 1.8, lv);
    return { name: 'fb_chaindrive', clip: 'fbSlam', dur: 1.9, superArmor: true, noCounter: true, noAwk: true, grabInvul: true,
      onStart: e => { const R = game.room, cx = e.x + e.face * 200; e.act.cx = R ? clamp(cx, R.x0 + 40, R.x1 - 40) : cx; e.act.cy = e.y; e.act.dirK = 0; },
      hold: (e, t, i) => { const a = e.act, k = clamp((e.actT - 1.0) / 0.25, 0, 1); t.x = lerp(t.x, a.cx + ((i % 3) - 1) * 26, 0.3); t.y = clamp(a.cy + ((i % 2) ? 10 : -10), 4, DEPTH - 4); t.z = 60 + 70 * k + (i % 3) * 8; t.face = -e.face; },
      onInput: (e, I) => { const a = e.act; if (e.actT >= 0.9 && e.actT < 1.35) { if (I.is('up')) a.dirK = 2; else if (I.dx() === e.face) a.dirK = 1; else if (I.dx() || I.is('down')) a.dirK = 0; } return false; },
      update: e => { const a = e.act; if (e.actT > 0.12 && e.actT < 1.4) addFx({ x: a.cx, y: a.cy + 0.6, z: 0, dur: 0.02, draw(c) { const X = sx(a.cx), Y = sy(a.cy, 0);
          fbDrawChain(c, sx(e.x + e.face * 10), sy(e.y, e.z + 58), X, Y + 2, { s: 1.2, sag: 6 });
          for (let j = 0; j < 3; j++) { const ang = game.t * 14 + j * TAU / 3, r = 110; fbDrawChain(c, X, Y - 4, X + Math.cos(ang) * r, Y - 4 + Math.sin(ang) * r * GR, { s: 1.1 }); } } }); },
      events: [evAt(0.12, e => { sfx.swing(true); sfx.hit('stab', false); fxDust(e.act.cx, e.act.cy, 8, 30); cam.shake = Math.max(cam.shake, 3); }),
        ...Array.from({ length: 5 }, (_, i) => evAt(0.3 + i * 0.12, e => { const a = e.act; sfx.swing(false); fxDust(a.cx + rnd(-100, 100), a.cy + rnd(-30, 30), 3, 20, '#a89a8a');
          const hit = fbArea(e, a.cx, a.cy, 230, { dmg: D * 0.05, launch: i === 0 ? 360 : 0, airLift: 160, stun: 0.5, knock: 0, hs: 0.03, sure: true, col: '#dfe4ee', snd: 'slash', downHit: true, onHit: (q, t) => fbAbn(q, t, 'bleed', 3, 0.012 * D) }, { zMax: 260 });
          for (const t of hit) if (!hasSA(t) && !t.boss && !t.fixed) t.x = lerp(t.x, a.cx, 0.3); })),
        evAt(1.0, e => { const a = e.act, H = { grabMax: 12, grabInvul: true, grabDown: true };   // 抓起被挑起来的敌人（能抓的全抓）；抓不住的吃一记重击
          for (const t of ents.slice()) { if (!foe(e, t) || t.dead || t.invul > 0 || !inGround(t, a.cx, a.cy, 260)) continue;
            if (canGrab(e, t, H) && !hasSA(t)) startGrab(e, t, H); else applyHit(e, t, { dmg: D * 0.55, sure: true, stun: 0.6, knock: 60, hs: 0.1, big: 1.6, type: 'mag', col: '#dfe4ee', snd: 'blunt' }, { proj: true, src: { x: a.cx, y: a.cy, z: 0, face: e.face } }); }
          sfx.swing(true); }),
        evAt(1.4, e => { const a = e.act, L = grabsOf(e), R = game.room; if (!L.length) return; e.play('fbSlam', true); sfx.swing(true);
          const dest = a.dirK === 2 ? e.x + e.face * 480 : a.dirK === 1 ? a.cx : e.x + e.face * 70;
          L.forEach((t, i) => { const x1 = (R ? clamp(dest + ((i % 3) - 1) * 24, R.x0 + t.w, R.x1 - t.w) : dest), dir = Math.sign(x1 - t.x) || e.face;
            throwArc(e, t, { dx: Math.abs(x1 - t.x), dir, h: 70, dur: 0.32, other: { dmg: D * 0.05, down: true, knock: 100, type: 'mag' },
              hit: { dmg: D * 0.3, spike: 320, hs: 0.1, type: 'mag', shake: 6, big: 1.8 },
              onLand: (q, tt) => { if (i) return; sfx.boom(1.1); cam.shake = Math.max(cam.shake, 8); fxSpr('explosion', tt.x, tt.y, 20, { w: 200, dur: 0.5 }); fxShock(tt.x, tt.y, 220, '#ffd090');
                fbArea(e, tt.x, tt.y, 150, { dmg: D * 0.15, launch: 300, knock: 100, hs: 0.08, sure: true, col: '#ffd090', downHit: true }, { zMax: 200 }); } }); }); })] }; } });

/* ---- 飞沙走石（↓→→+Z）：锁链甩向天花板把它拉塌，碎石落下（伤害 + 眩晕），最后一块大石头出血 + 冲击波（挑起）；设置型：甩完就能行动 ---- */
defSkill('fb_cavein', { name: '飞沙走石', cls: 'fighter', job: FB_JOB, tier: 2, lvReq: 26, mp: 100, cd: 45, type: 'mag', col: '#a08a6a',
  desc: '把锁链甩到天花板上用力拉塌，前方一大片（约 60~460px）落下大量碎石，造成伤害并让敌人眩晕；最后砸下一块大石头，出血并放出冲击波把敌人挑起。甩完锁链就能行动，碎石继续落下（攻击速度不影响落石速度）。',
  pow: lv => skillDmg(17, 1.7, lv), ai: { kind: 'aoe', r: [60, 440], dy: 60 },
  act: (lv, p) => { const D = skillDmg(17, 1.7, lv);
    return { name: 'fb_cavein', clip: 'fbThrow', dur: 0.72, superArmor: [0, 0.5], noCounter: true, cancelFrom: 0.6, links: fbRbLinks(p), linkFrom: 0.3, fbRB: true, onEnd: (e, cut) => { if (cut) e._fbRB = game.t; },
      events: [evAt(0.14, e => { sfx.swing(true); const x0 = e.x, y0 = e.y, f = e.face;
        addFx({ x: x0, y: y0 + 0.6, z: 0, dur: 0.5, draw(c) { const k = Math.min(1, this.t / 0.15), X = sx(x0 + f * 10), Y = sy(y0, 72); fbDrawChain(c, X, Y, X + f * 120 * k, Y - 300 * k, { end: 'hook', s: 1.2 }); } });
        game.after(0.2, () => { cam.shake = Math.max(cam.shake, 5); sfx.boom(0.6);
          for (let i = 0; i < 14; i++) game.after(0.1 + i * 0.09, () => { if (e.dead) return; const x = x0 + f * rnd(60, 460), y = clamp(y0 + rnd(-60, 60), 6, DEPTH - 6), w = rnd(22, 40);
            addFx({ x, y: y + 0.5, z: 0, dur: 0.22, draw(c) { const k = easeIn(this.t / this.dur); fbDrawRock(c, sx(this.x), sy(this.y, 360 * (1 - k)), w, k * 6); } });
            game.after(0.22, () => { fxDust(x, y, 3, 12, '#a89a8a'); sfx.hit('blunt', false);
              fbArea(e, x, y, 55, { dmg: D * 0.03, stun: 0.4, knock: 10, hs: 0.03, sure: true, col: '#d8c8a8', downHit: true, onHit: (q, t) => fbAbn(q, t, 'stun', 1.5) }, { zMax: 200 }); }); });
          game.after(1.55, () => { if (e.dead) return; const x = x0 + f * 260;
            addFx({ x, y: y0 + 0.5, z: 0, dur: 0.25, draw(c) { const k = easeIn(this.t / this.dur); fbDrawRock(c, sx(this.x), sy(this.y, 420 * (1 - k)), 130, k * 3); } });
            game.after(0.25, () => { cam.shake = Math.max(cam.shake, 9); sfx.boom(1.2); fxShock(x, y0, 300, '#ffd070'); fxShock(x, y0, 200, '#fff0c0'); fxBurst(x, y0, 40, 260, '#ffd070'); fxSpr('rock', x, y0, 30, { w: 110, dur: 0.6, add: false });
              fbArea(e, x, y0, 110, { dmg: D * 0.35, stun: 0.6, knock: 40, hs: 0.1, big: 1.8, sure: true, col: '#ffd070', snd: 'crit', downHit: true, onHit: (q, t) => fbAbn(q, t, 'bleed', 5, 0.02 * D) }, { zMax: 200 });
              fbArea(e, x, y0, 230, { dmg: D * 0.23, launch: 380, knock: 120, hs: 0.08, sure: true, col: '#ffd070', downHit: true }, { zMax: 200 }); }); }); }); })] }; } });

/* ---- 燃火轰天炮（二觉，↑↓→→+Z）：气势压制周围的敌人（强制硬直），抡起绑满毒雷的铁管猛砸引爆（5 次爆炸）；每个异常 +25%（按压制时的个数，最多 3 个）；无敌 ---- */
defSkill('fb_awaken2', { name: '燃火轰天炮', cls: 'fighter', job: FB_JOB, tier: 2, lvReq: 27, maxLv: 3, mp: 200, cd: 170, pvp: 0.45, type: 'mag', awaken: true, col: '#ff5ad0',
  desc: '【觉醒 · 暗街之王】用压倒性的气势压制周围的敌人（强制硬直），抡起绑满毒雷的铁管猛砸，毒雷接连爆炸 5 次（前 2 次最强）。压制时敌人身上每有一个异常状态，对他的伤害 +25%（最多 3 个）。施放中无敌。',
  pow: lv => skillDmg(36, 9, lv), ai: { kind: 'awaken', r: [0, 380], dy: 110 },
  act: lv => { const D = skillDmg(36, 9, lv);
    return { name: 'fb_awaken2', clip: 'fbTaunt', dur: 2.35, superArmor: true, invul: true, noCounter: true,
      onStart: e => { game.cutin = { t: 0, dur: 1.0, name: '燃火轰天炮', who: cutinWho(e, 2) }; game.timeStop = 0.9; sfx.awaken(); e.invul = Math.max(e.invul, 1.2); e.act.nmap = new Map();
        addFx({ ent: e, x: e.x, y: e.y - 0.5, z: 0, dur: 1.2, draw(c) { const p = this.ent, k = this.t / this.dur, X = sx(p.x), Y = sy(p.y, 0), R = 380 * easeOut(Math.min(1, k * 3));
          c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.5 * (1 - k); c.strokeStyle = FB_COL.pink; c.lineWidth = 10; c.beginPath(); c.ellipse(X, Y, R, R * GR, 0, 0, TAU); c.stroke();
          c.lineWidth = 3; c.strokeStyle = '#ffd0f0'; c.beginPath(); c.ellipse(X, Y, R * 0.8, R * 0.8 * GR, 0, 0, TAU); c.stroke(); c.restore(); } }); },
      update: e => { const a = e.act; if (e.actT > 0.35 && e.actT < 1.0) addFx({ x: e.x, y: e.y + 0.7, z: 0, dur: 0.02, draw(c) { fbAwk2Pipe(c, e, clamp((e.actT - 0.35) / 0.4, 0, 1)); } }); },
      events: [evAt(0.08, e => { const a = e.act; sfx.boom(0.6); cam.shake = Math.max(cam.shake, 4);
          for (const t of ents) if (foe(e, t) && !t.dead && inGround(t, e.x, e.y, 380)) { a.nmap.set(t, fbN(t)); addStatus(t, 'hold', 2.4); } }),
        evAt(0.3, e => { e.play('fbLift', true); sfx.charge(); }),
        evAt(0.74, e => { const a = e.act, mul = t => fbAbnMul(null, 0.25, a.nmap.get(t) ?? fbN(t)); e.play('fbSlam', true); sfx.swing(true); cam.shake = 8; cam.flash = 0.06; cam.flashCol = '#ffffff';
          fbSpeedLines(e, 0.35);
          fbBox(e, [-40, 280, 80, 0, 170], { dmg: D * 0.22, stun: 0.6, knock: 30, hs: 0.1, big: 1.8, sure: true, col: '#ffd0f0', snd: 'blunt', downHit: true }, { mul }); }),
        ...[[0.95, 0.2, 230], [1.12, 0.2, 230], [1.3, 0.1, 160], [1.42, 0.1, 160], [1.54, 0.1, 160]].map(([t0, k, r], i) => evAt(t0, e => {
          const a = e.act, mul = t => fbAbnMul(null, 0.25, a.nmap.get(t) ?? fbN(t)), x = e.x + e.face * (i < 2 ? 170 : rnd(80, 320)), y = clamp(e.y + (i < 2 ? 0 : rnd(-50, 50)), 6, DEPTH - 6);
          sfx.boom(i < 2 ? 1.3 : 0.8); cam.shake = Math.max(cam.shake, i < 2 ? 10 : 6); if (i < 2) { cam.flash = 0.07; cam.flashCol = '#ffc080'; }
          fxSpr('explosion', x, y, 40, { w: r * 1.4, dur: 0.5, grow: [0.5, 1.2] }); fxShock(x, y, r * 1.3, '#ff8a3a'); fxBurst(x, y, 50, r * 1.2, FB_COL.pink); fxSpr('poison', x, y, 30, { w: r * 0.8, dur: 0.6 });
          fbArea(e, x, y, r, { dmg: D * k, launch: i === 4 ? 460 : 200, knock: 80, hs: 0.1, big: 1.8, sure: true, col: '#ffb050', snd: 'crit', downHit: true,
            onHit: (q, t) => { fbAbn(q, t, 'poison', 5, 0.015 * D); fbAbn(q, t, 'burn', 5, 0.015 * D); } }, { mul, zMax: 280 });
          if (i === 4) e.invul = Math.max(e.invul, 0.6); }))] }; } });
// 燃火轰天炮的铁管：从身后抡到身前，管子上绑着一串毒雷
function fbAwk2Pipe(c, e, k) {
  const ang = lerp(-2.4, 0.25, easeOut(k)), X = sx(e.x + e.face * 8), Y = sy(e.y, e.z + 70), L = 150, ex = X + Math.cos(ang) * L * e.face, ey = Y + Math.sin(ang) * L;
  c.save(); c.lineCap = 'round'; c.strokeStyle = FB_OUT; c.lineWidth = 11; c.beginPath(); c.moveTo(X, Y); c.lineTo(ex, ey); c.stroke();
  c.strokeStyle = '#6a707c'; c.lineWidth = 6; c.beginPath(); c.moveTo(X, Y); c.lineTo(ex, ey); c.stroke(); c.restore();
  for (let i = 1; i <= 5; i++) { const t = 0.35 + i * 0.13; fbDrawMine(c, lerp(X, ex, t), lerp(Y, ey, t), 1.25); }
}
// 黑白速度线（燃火轰天炮 / 幽链之界的重击瞬间）
function fbSpeedLines(e, dur) {
  addFx({ x: e.x, y: e.y + 60, z: 0, dur, draw(c) { const k = this.t / this.dur, X = sx(e.x + e.face * 120), Y = sy(e.y, 70);
    c.save(); c.globalAlpha = 0.55 * (1 - k); c.strokeStyle = '#ffffff'; c.lineWidth = 2;
    for (let i = 0; i < 26; i++) { const a = i * TAU / 26 + (i % 3) * 0.05, r0 = 90 + (i * 37 % 40), r1 = 520; c.beginPath(); c.moveTo(X + Math.cos(a) * r0, Y + Math.sin(a) * r0 * 0.6); c.lineTo(X + Math.cos(a) * r1, Y + Math.sin(a) * r1 * 0.6); c.stroke(); }
    c.restore(); } });
}

/* ---- 逆道·皆允（三觉被动）：基本 / 转职技能攻击提高；改造投掷（毒瓶特制瓶 / 毒雾、毒针感电 / 范围、砖块挂锁链）---- */
defSkill('fb_picaresque', { name: '逆道·皆允', cls: 'fighter', job: FB_JOB, tier: 3, lvReq: 29, passive: true, type: 'mag', col: '#8a3aa0',
  desc: '【被动 · 三觉】为了赢不择手段：基本攻击和转职技能攻击提高，并改造投掷技能：\n· 毒瓶：普通投掷变成毒瓶和火焰瓶合一的特制瓶（中毒 + 灼伤）；强化投掷留下的毒雾多留 2 秒\n· 毒针：普通投掷附带感电；强化投掷的每根针命中时小范围爆开\n· 砖块：强化投掷的岩石挂上锁链，砸下后再拽回来扫一遍',
  infoExtra: lv => [['攻击', '+' + pct(0.1 + 0.01 * lv)]] });

/* ---- 逆道·爆狱（↑↓→→+Z）：滚出一桶硬化剂（多段），再踢飞炸药桶爆炸，范围内强制硬直 2.5 秒；强化投掷：换成金属燃料桶，一路连环爆炸 + 灼伤 ---- */
defSkill('fb_roadtohell', { name: '逆道·爆狱', cls: 'fighter', job: FB_JOB, tier: 3, lvReq: 29, mp: 150, cd: 60, type: 'mag', col: '#c83a2a',
  desc: '向前滚出一桶特殊硬化剂（一路多段伤害），再一脚踢飞炸药桶，爆炸让范围内的敌人强制硬直 2.5 秒（无视霸体，领主缩短）。强化投掷：滚出去的换成装满可燃物的金属桶，沿路引发连环爆炸并造成灼伤（不消耗投掷物）。指令和燃火轰天炮相同（同指令时冷却长的优先，这个技能请放在快捷栏）。',
  pow: lv => skillDmg(30, 3, lv), ai: { kind: 'burst', r: [0, 460], dy: 50 },
  act: (lv, p) => { const D = skillDmg(30, 3, lv);
    return { name: 'fb_roadtohell', clip: 'fbThrow', dur: 1.15, superArmor: true, noCounter: true, cancelFrom: 1.0,
      onStart: e => { e.act.metal = !!e.buffs.fb_strong; delete e.buffs.fb_strong; },
      events: [evAt(0.14, e => { const metal = e.act.metal, path = []; sfx.swing(true);
          spawnProj({ owner: e, x: e.x + e.face * 30, y: e.y, z: 0, vx: e.face * 540 * fbSpd(e), vz: 0, face: e.face, life: 0.85, w: 22, d: 22, h: 44, pierce: true, spin: 0,
            hit: { dmg: D * 0.06, rep: 0.12, max: 5, stun: 0.45, knock: 20, hs: 0.03, type: 'mag', col: metal ? '#ffb050' : '#c8d8a0', snd: 'blunt' },
            update(q, dt) { q.spin += dt * 10 * q.face; if (Math.random() < 0.5) fxDust(q.x - q.face * 14, q.y, 1, 5); if (metal && Math.floor(q.t / 0.15) !== q.k) { q.k = Math.floor(q.t / 0.15); path.push(q.x); } },
            onEnd(q) { if (!metal) return; path.push(q.x);   // 金属燃料桶：沿路连环爆炸
              path.slice(-5).forEach((x, i) => game.after(i * 0.08, () => { sfx.boom(0.6); fxSpr('explosion', x, q.y, 30, { w: 120, dur: 0.4 }); fxSpr('jv_flame', x, q.y, 0, { w: 90, dur: 0.5, ay: 1 });
                fbArea(e, x, q.y, 90, { dmg: D * 0.06, stun: 0.4, knock: 40, airLift: 100, hs: 0.04, sure: true, col: '#ffb050', downHit: true, onHit: (a, t) => fbAbn(a, t, 'burn', 5, 0.012 * D) }, { zMax: 200 }); })); },
            draw(c, q) { fbDrawBarrel(c, sx(q.x), sy(q.y, q.z + 18), q.spin, metal ? 'metal' : 'wood', 1.7); } }); }),
        evAt(0.55, e => { e.play('fbKick', true); addFx({ ent: e, x: e.x, y: e.y + 0.5, z: 0, dur: 0.12, draw(c) { const p = this.ent; fbDrawBarrel(c, sx(p.x + p.face * 30), sy(p.y, 16), 0, 'bomb', 1.5); } }); }),
        evAt(0.66, e => { sfx.hit('blunt', false); sfx.swing(true);
          spawnProj({ owner: e, x: e.x + e.face * 34, y: e.y, z: 20, vx: e.face * 620 * fbSpd(e), vz: 160, grav: 420, face: e.face, life: 0.75, w: 18, d: 20, h: 36, pierce: false, spin: 0,
            hit: { dmg: D * 0.05, stun: 0.4, knock: 20, hs: 0.04, type: 'mag', col: '#ffb050', snd: 'blunt' },
            update(q, dt) { q.spin += dt * 14 * q.face; },
            onEnd(q) { cam.shake = 11; cam.flash = 0.07; cam.flashCol = '#ffc080'; sfx.boom(1.3); fxSpr('explosion', q.x, q.y, 40, { w: 300, dur: 0.55, grow: [0.5, 1.2] }); fxShock(q.x, q.y, 300, '#ff8a3a'); fxShock(q.x, q.y, 200, '#fff0c0');
              fbArea(e, q.x, q.y, 220, { dmg: D * 0.6, stun: 0.6, knock: 60, hs: 0.14, big: 2, sure: true, col: '#ffb050', snd: 'crit', downHit: true, onHit: (a, t) => addStatus(t, 'hold', 2.5) }, { zMax: 240 }); },
            draw(c, q) { fbDrawBarrel(c, sx(q.x), sy(q.y, q.z), q.spin, 'bomb', 1.5); } }); })] }; } });

/* ---- 逆道·幽链之界（三觉，←↑→↓+Z）：把敌人拉进街霸的老巢“暗街”，挥锁链乱打、拆掉周围的楼房，跳起把楼房碎片聚成巨型炸弹砸下引爆；出血 / 中毒 / 灼伤 6 秒；无敌 ---- */
defSkill('fb_awaken3', { name: '逆道·幽链之界', cls: 'fighter', job: FB_JOB, tier: 3, lvReq: 30, maxLv: 3, mp: 300, cd: 270, pvp: 0.45, type: 'mag', awaken: true, col: '#6a3aa0',
  desc: '【觉醒 · 归元·街霸】把周围的敌人拖进街霸的老巢“暗街”：锁链横扫 5 次、旋转乱打 10 次，拆掉周围的楼房；再跳起来用锁链把楼房碎片聚成一颗巨型炸弹砸下引爆，被炸到的敌人出血、中毒、灼伤 6 秒。施放中无敌。',
  pow: lv => skillDmg(46, 12, lv), ai: { kind: 'awaken', r: [0, 600], dy: 140 },
  act: lv => { const D = skillDmg(46, 12, lv);
    return { name: 'fb_awaken3', clip: 'fbSwing', dur: 3.1, superArmor: true, invul: true, noCounter: true, lowGrav: 0.5,
      onStart: e => { game.cutin = { t: 0, dur: 1.0, name: '逆道·幽链之界', who: cutinWho(e, 3) }; game.timeStop = 1.0; sfx.awaken(); e.invul = Math.max(e.invul, 1.3); fbAlleyFx(e, 3.6);
        for (const t of ents) if (foe(e, t) && !t.dead && !t.fixed && Math.abs(t.x - e.x) < 640 && !t.boss) { const R = game.room, x = e.x + e.face * rnd(70, 220); t.x = R ? clamp(x, R.x0 + t.w, R.x1 - t.w) : x; t.y = clamp(lerp(t.y, e.y, 0.5), 4, DEPTH - 4); } },
      onLand: e => { e.vz = 0; },
      events: [
        ...Array.from({ length: 5 }, (_, i) => evAt(0.3 + i * 0.13, e => { sfx.swing(true); cam.shake = Math.max(cam.shake, 3);
          fbChainSwingFx(e, 0.16, { r: 340, spin: i % 2 ? -16 : 16, a0: i % 2 ? 0 : Math.PI, flat: 0.3, s: 1.4 });
          fbBox(e, [-360, 360, 90, 0, 170], { dmg: D * 0.05, stun: 0.5, knock: 0, airLift: 60, hs: 0.04, sure: true, col: '#c8a0ff', snd: 'slash', downHit: true }); })),
        evAt(1.0, e => { e.act.spin = fbChainSwingFx(e, 0.9, { r: 320, spin: 22, flat: 0.3, s: 1.5, col: '#c8a0ff' }); e.act.alley && (e.act.alley.crash = game.t); }),
        ...Array.from({ length: 10 }, (_, i) => evAt(1.0 + i * 0.09, e => { if (i % 2 === 0) sfx.swing(false); cam.shake = Math.max(cam.shake, 4);
          fbArea(e, e.x, e.y, 330, { dmg: D * 0.03, stun: 0.5, knock: 0, airLift: 50, hs: 0.02, sure: true, col: '#c8a0ff', snd: 'slash', downHit: true, onHit: (q, t) => fbAbn(q, t, 'bleed', 6, 0.004 * D) }, { zMax: 260 }); })),
        evAt(1.95, e => { e.play('fbLift', true); e.vz = 520; e.z = Math.max(e.z, 1); sfx.jump(); sfx.charge(); const a = e.act, R = game.room, cx = e.x + e.face * 150; a.cx = R ? clamp(cx, R.x0 + 60, R.x1 - 60) : cx; a.cy = e.y;
          a.bomb = addFx({ ent: e, x: e.x, y: e.y + 0.9, z: 0, dur: 0.8, draw(c) { const p = this.ent, k = Math.min(1, this.t / 0.5), X = sx(p.x + p.face * 10), Y = sy(p.y, p.z + 170), r = 20 + 70 * k;
            c.save(); c.globalCompositeOperation = 'lighter'; drawSpr(c, fxTint('darkorb', '#8a4ad8'), X, Y, r * 2.4, r * 2.4, { rot: game.t * 2 }); c.restore();
            for (let i = 0; i < 9; i++) { const ang = game.t * 3 + i * TAU / 9, rr = r * (1.4 - k * 0.5); fbDrawRock(c, X + Math.cos(ang) * rr, Y + Math.sin(ang) * rr * 0.6, 18 + (i % 3) * 6, ang); }
            for (let i = 0; i < 4; i++) { const ang = -game.t * 4 + i * TAU / 4; fbDrawChain(c, X, Y, X + Math.cos(ang) * r * 1.1, Y + Math.sin(ang) * r * 0.7, { s: 1.1 }); } } }); }),
        evAt(2.55, e => { const a = e.act; e.play('fbSlam', true); e.vz = -1100; sfx.swing(true); if (a.bomb) a.bomb.t = a.bomb.dur;
          addFx({ x: a.cx, y: a.cy + 0.9, z: 0, dur: 0.18, x0: e.x, z0: e.z + 170, draw(c) { const k = easeIn(this.t / this.dur); drawSpr(c, fxTint('darkorb', '#8a4ad8'), sx(lerp(this.x0, this.x, k)), sy(this.y, lerp(this.z0, 40, k)), 200, 200, { rot: game.t * 3 }); } }); }),
        evAt(2.75, e => { const a = e.act; cam.shake = 16; cam.flash = 0.12; cam.flashCol = '#e8d0ff'; sfx.boom(1.6); fbSpeedLines(e, 0.4);
          fxSpr('explosion', a.cx, a.cy, 60, { w: 520, dur: 0.7, grow: [0.4, 1.2] }); fxShock(a.cx, a.cy, 600, '#a060ff'); fxShock(a.cx, a.cy, 440, '#ff8a3a'); fxBurst(a.cx, a.cy, 80, 560, '#d0a0ff');
          for (let i = 0; i < 16; i++) { const vx = rnd(-420, 420), vz = rnd(220, 560); addFx({ x: a.cx, y: a.cy + rnd(-40, 40), z: 30, vx, vz, dur: 0.9, r: rnd(0, 6), update(dt) { this.x += this.vx * dt; this.vz -= 1000 * dt; this.z = Math.max(0, this.z + this.vz * dt); }, draw(c) { fbDrawRock(c, sx(this.x), sy(this.y, this.z), 26, this.r + this.t * 8); } }); }
          fbArea(e, a.cx, a.cy, 540, { dmg: D * 0.45, launch: 560, knock: 240, hs: 0.16, big: 2.4, sure: true, col: '#e0c0ff', snd: 'crit', downHit: true,
            onHit: (q, t) => { fbAbn(q, t, 'bleed', 6, 0.01 * D); fbAbn(q, t, 'poison', 6, 0.01 * D); fbAbn(q, t, 'burn', 6, 0.01 * D); } }, { zMax: 320 });
          e.invul = Math.max(e.invul, 0.8); })] }; } });
// “暗街”：背景压暗 + 两边的破楼剪影（亮着几扇窗），旋转乱打时楼房塌下来
function fbAlleyFx(e, dur) {
  const x0 = e.x, f = e.face, L = Array.from({ length: 8 }, (_, i) => ({ dx: (i - 3.5) * 150 + rnd(-20, 20), w: rnd(90, 130), h: rnd(170, 260), win: Array.from({ length: 6 }, () => [rnd(0.15, 0.85), rnd(0.1, 0.8)]) }));
  const A = addFx({ x: x0, y: -40, z: 0, dur, crash: 0, draw(c) {
    const k = this.t / this.dur, a = k < 0.08 ? k / 0.08 : k > 0.88 ? (1 - k) / 0.12 : 1;
    c.save(); c.globalAlpha = 0.62 * a; c.fillStyle = '#0c0616'; c.fillRect(0, 0, WW, WH); c.globalAlpha = a;
    const fall = this.crash ? clamp((game.t - this.crash) / 0.9, 0, 1) : 0, gy = sy(0, 0);
    for (const b of L) { const X = sx(x0 + b.dx) - b.w / 2, H = b.h * (1 - 0.7 * fall), Y = gy - H + fall * 20;
      c.fillStyle = '#231432'; c.fillRect(X, Y, b.w, H); c.strokeStyle = '#4a2a6a'; c.lineWidth = 2; c.strokeRect(X, Y, b.w, H);
      c.fillStyle = 'rgba(255,200,90,.75)'; for (const [u, v] of b.win) if (v * b.h < H) c.fillRect(X + u * b.w - 5, Y + v * H - 6, 10, 12); }
    c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.25 * a; const g = c.createLinearGradient(0, gy - 200, 0, gy); g.addColorStop(0, 'rgba(120,60,200,0)'); g.addColorStop(1, 'rgba(160,80,255,.8)'); c.fillStyle = g; c.fillRect(0, gy - 200, WW, 200);
    c.restore(); } });
  if (e.act) e.act.alley = A;
  return A;
}

/* ---- 登记 ---- */
CLASSES.fighter.jobs.brawler.skills.push('fb_thousand', 'fb_awaken', 'fb_barrel', 'fb_chain', 'fb_rulebreak', 'fb_chaindrive', 'fb_cavein', 'fb_awaken2', 'fb_picaresque', 'fb_roadtohell', 'fb_awaken3');
CLASSES.fighter.cmds.push(['uudd', 'fb_awaken'], ['fbdf', 'fb_barrel'], ['fbuf', 'fb_chain'], ['fbf', 'fb_chaindrive'], ['dff', 'fb_cavein'], ['udff', 'fb_awaken2'], ['udff', 'fb_roadtohell'], ['bufd', 'fb_awaken3']);
CLASSES.fighter.passives.push(p => {
  if (!isFb(p)) return;
  const th = skLv(p, 'fb_thousand'); setPassive(p, 'fb_thousand', th > 0, { dmg: 0.04 + 0.005 * th, crit: 0.03 });
  const rb = skLv(p, 'fb_rulebreak'); setPassive(p, 'fb_rulebreak', rb > 0, { dmg: 0.08 + 0.01 * rb });
  const pc = skLv(p, 'fb_picaresque'); setPassive(p, 'fb_picaresque', pc > 0, { dmg: 0.1 + 0.01 * pc });
});
