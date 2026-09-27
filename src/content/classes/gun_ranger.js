/* =====================================================================
   转职：漫游枪手（女）—— 左轮专精。左轮精通、致命射击、死亡左轮、枪舞、移动射击、多重爆头、双鹰回旋，觉醒 血腥狂欢（沾血蔷薇）
   ===================================================================== */
defSkill('g_revmaster', { name: '左轮精通', cls: 'gun', job: 'ranger', lvReq: 15, mp: 0, cd: 0, type: 'phys', passive: true, col: '#8a6a3a',
  desc: '【被动】普通射击的弹速与伤害提升；技能等级 5 以上子弹可以穿透敌人。', infoExtra: lv => [['射击伤害', '+' + pct(0.02 * lv)], ['穿透', lv >= 5 ? '是' : '5 级解锁']] });
defSkill('g_head', { name: '致命射击', cls: 'gun', job: 'ranger', lvReq: 15, mp: 25, cd: 6, type: 'phys', icon: 'g_head', col: '#8a2a3a',
  desc: '瞬间瞄准，射出一发贯穿直线的精准子弹，暴击率大幅提升并把敌人击倒。', pow: lv => skillDmg(4.0, 0.4, lv), ai: { kind: 'burst', r: [0, 520], dy: 12 },
  act: (lv) => ({ name: 'g_head', clip: 'aimShot', dur: 0.62, cancelFrom: 0.42, superArmor: [0.05, 0.3],
    update: e => { if (e.actT < 0.28) addFx({ x: e.x, y: e.y + 0.6, z: e.z + 64, face: e.face, dur: 0.02, draw(c) { c.strokeStyle = `rgba(255,40,40,${0.35 + 0.3 * Math.random()})`; c.lineWidth = 1; c.beginPath(); c.moveTo(sx(this.x + this.face * 34), sy(this.y, this.z)); c.lineTo(sx(this.x + this.face * 520), sy(this.y, this.z)); c.stroke(); } }); },
    events: [evAt(0.02, () => sfx.charge()), evAt(0.3, e => {
      muzzle(e); sfx.gun(1.6); sfx.iai(); cam.shake = 5; cam.flash = 0.05; cam.flashCol = '#fff0d0';
      fxStreak({ x: e.x + e.face * 30, y: e.y, z: e.z + 64, face: e.face, len: 520, w: 10, col: '#ffd070', dur: 0.25 });
      instantHit(e, { box: [20, 520, 16, 45, 90], dmg: skillDmg(4.0, 0.4, lv) * shotDmgOf(e), down: true, knock: 240, hs: 0.12, big: 1.6, col: '#ffe0a0', critBonus: 0.4, snd: 'stab' });
    })] }) });
defSkill('g_buff', { name: '死亡左轮', cls: 'gun', job: 'ranger', lvReq: 21, mp: 60, cd: 40, type: 'phys', buff: true, icon: 'g_buff', col: '#8a60e0',
  desc: '【BUFF】30 秒内左轮射击的伤害与暴击伤害提升。', infoExtra: lv => [['射击伤害', '+' + pct(0.15 + 0.02 * lv)], ['暴击伤害', '+' + pct(0.2 + 0.02 * lv)]], ai: { kind: 'buff' },
  act: (lv) => ({ name: 'g_buff', clip: 'gbuff', dur: 0.45, noCounter: true,
    onStart: e => { e.buffs.g_buff = { t: 30, shot: 0.15 + 0.02 * lv, critDmg: 0.2 + 0.02 * lv }; sfx.buff(); muzzle(e); sfx.gun(0.6); fxAura(e, '#b080ff'); } }) });
defSkill('g_rapid', { name: '枪舞', cls: 'gun', job: 'ranger', lvReq: 23, mp: 50, cd: 10, type: 'phys', icon: 'g_rapid', col: '#d8a02a',
  desc: '双枪狂舞，向身体周围连续射击。连按 X 加快射速，按 C 中断。', pow: lv => skillDmg(5.0, 0.5, lv), ai: { kind: 'aoe', r: [0, 200], dy: 60 },
  act: (lv) => ({ name: 'g_rapid', clip: 'gunDance', dur: 1.6, noCounter: true, superArmor: [0, 0.15],
    onInput: (e, I) => { if (I.buffered('attack')) { I.consume('attack'); e.act.fast = Math.min(0.5, (e.act.fast || 0) + 0.06); } if (I.buffered('jump')) { I.consume('jump'); e.act.dur = Math.min(e.act.dur, e.actT + 0.05); } return false; },
    update: e => { const a = e.act, step = 0.075 * (1 - (a.fast || 0)), n = Math.floor(e.actT / step);
      if (n !== a.n && e.actT < a.dur - 0.12) { a.n = n; const f = e.face; e.face = n % 3 === 1 ? -f : f; fireBullet(e, { up: n % 4 === 2, low: n % 4 === 3, dmg: skillDmg(0.3, 0.03, lv) * shotDmgOf(e), lift: 180, life: 0.35, vol: 0.5, quiet: n % 2 === 1 }); e.face = f; } } }) });
defSkill('g_moving', { name: '移动射击', cls: 'gun', job: 'ranger', lvReq: 23, mp: 40, cd: 12, type: 'phys', col: '#6a8a3a',
  desc: '进入移动射击模式（4 秒）：方向键自由移动，X 射击，Z 改变射击方向，C 退出。', pow: lv => skillDmg(0.4, 0.04, lv), infoExtra: () => [['持续', '4 秒']], ai: { kind: 'mode' },
  act: (lv) => ({ name: 'g_moving', clip: 'moveShot', dur: 4, noCounter: true, cancelable: true, cancelFrom: 0.2,
    onInput: (e, I) => {
      const dx = I.dx(), dy = I.dy(), sp = e.speed * mspdOf(e) * 0.75;
      e.vx = dx * sp; e.vy = dy * sp * 0.8;
      if (I.buffered('cmd')) { I.consume('cmd'); I.consume('cmdB'); e.face = -e.face; }
      if (I.buffered('jump')) { I.consume('jump'); e.act.dur = Math.min(e.act.dur, e.actT + 0.05); }
      if ((I.buffered('attack') || I.is('attack')) && !(e.act.cdT > e.actT)) { I.consume('attack'); e.act.cdT = e.actT + 0.12 / aspdOf(e); fireBullet(e, { dmg: skillDmg(0.4, 0.04, lv) * shotDmgOf(e) }); }
      e.act.walking = !!(dx || dy);
      return false;   // 技能仍然可以取消移动射击
    },
    update: e => { e.play(e.act.walking ? 'moveShot' : 'dualAim'); },
    onEnd: e => { e.vx = 0; e.vy = 0; } }) });
defSkill('g_multi', { name: '多重爆头', cls: 'gun', job: 'ranger', lvReq: 25, mp: 60, cd: 15, type: 'phys', col: '#a02a3a',
  desc: '锁定前方范围内最多 5 名敌人，接连对每个目标精准爆头，暴击率提升。', pow: lv => skillDmg(7.0, 0.7, lv), ai: { kind: 'burst', r: [0, 420], dy: 80 },
  act: (lv) => ({ name: 'g_multi', clip: 'aimShot', dur: 1.2, noCounter: true, superArmor: true,
    onStart: e => { e.act.list = ents.filter(t => hittable(e, t) && (t.x - e.x) * e.face > -20 && Math.abs(t.x - e.x) < 420 && Math.abs(t.y - e.y) < 90).slice(0, 5); sfx.charge();
      for (const t of e.act.list) addFx({ ent: t, x: t.x, y: t.y + 3, z: 0, dur: 0.5, draw(c) { const X = sx(this.ent.x), Y = sy(this.ent.y, this.ent.z + this.ent.h * 0.6), r = 14 + (1 - this.t / this.dur) * 10; c.strokeStyle = '#ff3030'; c.lineWidth = 2; c.beginPath(); c.arc(X, Y, r, 0, TAU); c.moveTo(X - r - 4, Y); c.lineTo(X + r + 4, Y); c.moveTo(X, Y - r - 4); c.lineTo(X, Y + r + 4); c.stroke(); } }); },
    update: e => { const a = e.act, n = Math.floor((e.actT - 0.45) / 0.1);
      if (e.actT > 0.45 && n !== a.n && n < a.list.length) { a.n = n; const t = a.list[n]; if (!t || t.dead) return; e.face = t.x >= e.x ? 1 : -1; muzzle(e); sfx.gun(1.2); e.play('aimShot', true);
        addFx({ x: e.x + e.face * 34, y: Math.max(e.y, t.y) + 1, z: e.z + 64, tx: t.x, ty: t.y, tz: t.z + t.hurtH() * 0.7, dur: 0.1, add: true, draw(c) { c.save(); c.globalCompositeOperation = 'lighter'; c.strokeStyle = `rgba(255,220,120,${1 - this.t / this.dur})`; c.lineWidth = 3; c.beginPath(); c.moveTo(sx(this.x), sy(this.y, this.z)); c.lineTo(sx(this.tx), sy(this.ty, this.tz)); c.stroke(); c.restore(); } });
        if (hittable(e, t)) applyHit(e, t, { dmg: skillDmg(1.4, 0.14, lv) * shotDmgOf(e), stun: 0.6, knock: 120, heavy: true, hs: 0.08, critBonus: 0.3, snd: 'stab', col: '#ffe0a0', sure: true }, { proj: true }); } } }) });
defSkill('g_hawk', { name: '双鹰回旋', cls: 'gun', job: 'ranger', lvReq: 27, mp: 60, cd: 16, type: 'phys', icon: 'g_hawk', col: '#2aa0a0',
  desc: '把两把左轮旋转着掷出，飞出后再飞回手中，来回切割路径上的敌人。再按技能键可以追加投掷（最多 3 次）。', pow: lv => skillDmg(4.5, 0.45, lv) * 3, ai: { kind: 'proj', r: [0, 330], dy: 20 },
  act: (lv) => hawkThrow(lv, 1) });
function hawkThrow(lv, n) {
  return { name: 'g_hawk' + n, clip: 'ghawk', dur: 0.55, cancelFrom: 0.42, follow: n < 3 ? () => hawkThrow(lv, n + 1) : null, followWin: [0.3, 0.55],
    events: [evAt(0.22, e => { sfx.swing(true); hawkGun(e, 0, skillDmg(1.5, 0.15, lv)); game.after(0.12, () => { if (!e.dead) hawkGun(e, 1, skillDmg(1.5, 0.15, lv)); }); })] };
}
defSkill('g_awaken', { name: '血腥狂欢', cls: 'gun', job: 'ranger', lvReq: 18, maxLv: 3, mp: 150, cd: 60, pvp: 0.45, type: 'phys', awaken: true, col: '#c0102a',
  desc: '【觉醒】重踏大地把周围敌人震上天，跃起在空中旋转扫射，落地后双枪乱射，最后以一朵血色蔷薇的爆炸收尾。', pow: lv => skillDmg(20, 6, lv), ai: { kind: 'awaken', r: [0, 300], dy: 90 },
  act: (lv) => ({ name: 'g_awaken', clip: 'crazy', dur: 2.9, superArmor: true, noCounter: true, invul: [0, 2.9],
    onStart: e => { game.cutin = { t: 0, dur: 1.0, name: '血腥狂欢', who: cutinWho(e) }; game.timeStop = 0.9; sfx.awaken(); },
    update: e => {
      const a = e.act, pool = () => ents.filter(t => hittable(e, t) && Math.abs(t.x - e.x) < 420);
      if (e.actT > 1.25 && e.actT < 2.45 && Math.floor(e.actT / 0.05) !== a.n) { a.n = Math.floor(e.actT / 0.05); const L = pool(); sfx.gun(0.5); muzzle(e);
        if (L.length) { const t = pick(L); e.face = a.n % 2 ? 1 : -1; addFx({ x: e.x + e.face * 30, y: Math.max(e.y, t.y) + 1, z: e.z + 60, tx: t.x, ty: t.y, tz: t.z + t.hurtH() * 0.5, dur: 0.08, add: true, draw(c) { c.save(); c.globalCompositeOperation = 'lighter'; c.strokeStyle = `rgba(255,120,140,${1 - this.t / this.dur})`; c.lineWidth = 2; c.beginPath(); c.moveTo(sx(this.x), sy(this.y, this.z)); c.lineTo(sx(this.tx), sy(this.ty, this.tz)); c.stroke(); c.restore(); } });
          applyHit(e, t, { dmg: skillDmg(0.5, 0.15, lv), stun: 0.3, knock: 10, airLift: 170, hs: 0.02, snd: 'stab', col: '#ff8aa0', sure: true, downHit: true }, { proj: true }); } }
      if (e.actT > 1.25 && e.actT < 1.85 && !a.jumped) { a.jumped = true; e.vz = 420; e.z = Math.max(e.z, 1); e.play('crazyAir', true); }
    },
    lowGrav: 0.35, onLand: e => { if (e.act.jumped && !e.act.landed) { e.act.landed = true; e.play('crazyLand', true); fxDust(e.x, e.y, 8, 20); } },
    events: [evAt(0.95, e => { cam.shake = 8; sfx.boom(1); fxShock(e.x, e.y, 260, '#ff5a7a'); blast(e, e.x, e.y, 200, { dmg: skillDmg(3, 1, lv), launch: 500, knock: 40, hs: 0.1, big: 1.6, downHit: true, sure: true }, { zMax: 200 }); }),
      evAt(2.5, e => { cam.flash = 0.3; cam.flashCol = '#ffb0c0'; cam.shake = 12; sfx.boom(1.3);
        for (const t of ents) if (hittable(e, t) && Math.abs(t.x - e.x) < 460) { fxSpr('petal', t.x, t.y, t.z + 40, { w: 140, dur: 0.6, col: '#ff4a6a', grow: [0.4, 1.2] }); fxBurst(t.x, t.y, t.z + 40, 160, '#ff3a5a');
          applyHit(e, t, { dmg: skillDmg(7, 2, lv), down: true, knock: 240, hs: 0.15, big: 2, critBonus: 0.2, sure: true, downHit: true, col: '#ff8aa0' }, { proj: true }); } })] }) });
CLASSES.gun.jobs.ranger = { art: 'job/ranger', name: '漫游枪手', role: '远程 · 连射', armor: 'leather', awaken: 'g_awaken', awakenName: '沾血蔷薇',
  desc: '专精左轮的枪手。射速快、暴击高，致命射击与多重爆头精准致命，移动射击边走边打。',
  skills: ['g_revmaster', 'g_head', 'g_buff', 'g_rapid', 'g_moving', 'g_multi', 'g_hawk', 'g_awaken'] };
CLASSES.gun.cmds.push(['ff', 'g_head'], ['ff', 'g_buff', 'buff'], ['fbf', 'g_rapid', 'attack'], ['df', 'g_moving', 'jump'], ['buf', 'g_multi'], ['bdf', 'g_hawk'], ['uudd', 'g_awaken']);
