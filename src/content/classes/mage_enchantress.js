/* =====================================================================
   转职：小魔女（魔法师）—— 暗黑少女 → 冥月女神 → 知源·小魔女。按国服现版对齐（docs/SKILLS_OFFICIAL_mage.md 3.5），小魔女组维护
   定位：辅助。独立攻击（indep），人偶操纵者让全部攻击变成暗属性，防具板甲。
   疯疯熊：进地下城自动出现的常驻傀儡（召唤框架 follower：不限时、不会被打），默认站在主角正前方，只在下令时出手；
          熊系技能主角只做一个很短的下令动作（enCmd），由熊独立出招；疯熊守护在主角被控制时也能放。
   国服冷却制（2026-01 删除了诅咒人偶资源）+ 韩服单刷模式（用户已定）：不在组队地下城里时（soloPlay）
          自动偏爱疯疯熊（熊技能加伤）、攻击力 +40%、技能冷却 −20%；禁忌诅咒对自己也给队友那份加成。
   组队：范围 BUFF / 回复走 coop 的技能重放——队友那边重放小魔女的技能动作时（施法者是影子），效果落在本机玩家身上；
          不看距离的（小魔女的偏爱）再用 partySend 发给其他房间的队友。net/party_sync.js（协战师组）提供 soloPlay / partyOf / partySend；
          还没合并时按单人处理。
   动作帧：mage_ench1（enCmd 下令 / enStep / enBanzai 万岁 / enSew 缝纫 / enHug 抱人偶 / enEars 捂耳朵 / enBandage 缠绷带 / enNail 钉钉子）；
          召唤物 / 物件：spr/madbear（疯疯熊）、spr/zombiedoll（僵尸人偶）、spr/thornhut（林中小屋）；素材没到时用简笔画兜底。
   ===================================================================== */
const EN = 'enchantress', EN_COL = '#9a3a7a', EN_CURSE = '#b05ae0', EN_ROSE = '#e0406a', EN_THORN = '#2e1a2c';
const enOn = p => !!p && jobOf(p) === EN;
// 单刷模式：不在组队地下城里（net/party_sync.js 的 soloPlay；决斗场一律不算）
const enSolo = () => typeof soloPlay === 'function' ? !!soloPlay() : !game.pvp && !(typeof coop !== 'undefined' && coop.active() && coop.mates.size > 0);
// 范围内的真人玩家（含 src 自己）：自己的客户端 = 自己 + 队友影子（只是表现）；队友的客户端重放时 src 是影子 = 本机玩家
function enParty(src, r = Infinity) {
  if (typeof partyOf === 'function') return partyOf(src, r);
  const L = [src]; if (game.player && game.player !== src) L.push(game.player);
  if (typeof coop !== 'undefined' && coop.mates) for (const g of coop.mates.values()) if (!L.includes(g)) L.push(g);
  return L.filter(t => t && t.team === src.team && !t.dead && !t.away && !t.summon && Math.abs(t.x - src.x) <= r);
}
const enOwner = e => e && e.summon ? e.owner : e;
// 只发给队友（不含自己；自己那份已经在本地结算过）：net/party_sync.js 的 partySend；影子重放 / AI 格斗者不发
const enSend = (kind, data, e) => { if (e && !e.ghost && e === game.player && typeof partySend === 'function') partySend(kind, data, e); };
// 偏爱对象吃到的诅咒 / 爱意 / 回复效果 +15%～20%
const enFavorK = t => t && t.buffs && t.buffs.en_favored ? 1.15 + 0.005 * (t.buffs.en_favored.lv || 1) : 1;
const EN_SCALE = ['atk', 'dmg', 'aspd', 'cspd', 'mspd', 'crit'];
// 范围内的队友上 BUFF：fx(t, self) → buff 对象（t 秒、数值）；偏爱对象的数值按 enFavorK 放大
function enBuffParty(e, r, id, fx) {
  for (const t of enParty(e, r)) {
    const b = fx(t, t === e); if (!b) continue;
    const k = t === e ? 1 : enFavorK(t), o = { ...b, from: e.id }; if (k !== 1) for (const key of EN_SCALE) if (typeof o[key] === 'number') o[key] *= k;
    t.buffs[id] = o; fxAura(t, b.col || EN_COL, 0.6);
  }
}
function enHeal(t, pct) {
  if (!t || t.dead) return; const v = Math.round(t.hpMax * pct * enFavorK(t)); if (v <= 0 || t.hp >= t.hpMax) return;
  t.hp = Math.min(t.hpMax, t.hp + v); addNumber(v, t.x, t.y, t.z + 30, { heal: true, player: true });
}
const EN_BAD = { burn: 1, poison: 1, bleed: 1, freeze: 1, stun: 1, slow: 1, blind: 1, shock: 1, curse: 1, sleep: 1, root: 1, bind: 1, confuse: 1 };
function enCleanse(t) {
  const S = t && t.status; if (!S) return 0; let n = 0;
  for (const k in S) if (EN_BAD[k]) { delete S[k]; n++; }
  if (n) { if (t.st === 'hit') t.stun = Math.min(t.stun, 0.1); fxText('解除异常', t.x, t.y, t.z + 30, { col: '#ffd0e8', size: 10 }); }
  return n;
}
// 攻击判定的默认字段：独立攻击 + 暗属性；命中时给敌人叠冥月绽放
function enH(dmg, o = {}) {
  const f = o.onHit;
  return { type: 'indep', elem: 'dark', col: '#e0a0ff', snd: 'slash', ...o, dmg, onHit: f ? (a, t, d) => { enBloomHit(a, t); f(a, t, d); } : enBloomHit };
}
// 伤害是否打到过（藤鞭落空判定）
const enMissed = e => !e.hitsDone || e.hitsDone.size === 0;

/* ---- 素材：逐帧精灵的单帧绘制（林中小屋这类不是实体的物件）；没有素材返回 false，调用方画兜底 ---- */
function enFrame(c, key, f, X, Y, sc, o = {}) {
  const S = typeof SPR_DATA !== 'undefined' && SPR_DATA[key], F = S && S.frames[f], im = IMG[`spr/${key}/${f}`];
  if (!F || !im) return false;
  c.save(); c.translate(X, Y); if (o.alpha !== undefined) c.globalAlpha *= clamp(o.alpha, 0, 1);
  c.scale((o.flip ? -1 : 1) * sc * (o.sx || 1) / S.res, sc * (o.sy || 1) / S.res); c.drawImage(im, -F.ax, -F.ay); c.restore();
  return true;
}
const enHasArt = key => typeof SPR_DATA !== 'undefined' && !!SPR_DATA[key] && !!IMG[`spr/${key}/idle`];
function enLoadArt() { if (typeof loadBundles === 'function') loadBundles(['spr:madbear', 'spr:zombiedoll', 'spr:thornhut']).catch(() => { }); }

/* ---- 荆棘 / 蔷薇的兜底画法（特效素材 fx/en* 到了就用素材） ---- */
function enThornLine(c, x0, y0, x1, y1, w, seed) {
  const L = Math.hypot(x1 - x0, y1 - y0) || 1, nx = -(y1 - y0) / L, ny = (x1 - x0) / L, n = Math.max(2, Math.floor(L / 14));
  c.strokeStyle = EN_THORN; c.lineWidth = w; c.lineCap = 'round'; c.beginPath();
  for (let i = 0; i <= n; i++) { const u = i / n, o = Math.sin(u * 9 + seed) * w * 1.2; const X = lerp(x0, x1, u) + nx * o, Y = lerp(y0, y1, u) + ny * o; if (i) c.lineTo(X, Y); else c.moveTo(X, Y); }
  c.stroke(); c.fillStyle = EN_THORN;
  for (let i = 1; i < n; i += 2) { const u = i / n, X = lerp(x0, x1, u), Y = lerp(y0, y1, u), s = (i % 4 ? 1 : -1) * w * 1.6; c.beginPath(); c.moveTo(X - 2, Y); c.lineTo(X + 2, Y); c.lineTo(X + nx * s, Y + ny * s); c.fill(); }
}
function enRose(c, X, Y, r, a = 1) {
  if (IMG['fx/enRose']) { drawSpr(c, 'enRose', X, Y, r * 2.4, 0, { add: false, alpha: a }); return; }
  c.save(); c.globalAlpha *= a; c.fillStyle = '#8a1030'; c.beginPath(); c.arc(X, Y, r, 0, TAU); c.fill();
  c.fillStyle = EN_ROSE; c.beginPath(); c.arc(X - r * 0.2, Y - r * 0.2, r * 0.7, 0, TAU); c.fill(); c.fillStyle = '#ff8aa0'; c.beginPath(); c.arc(X - r * 0.3, Y - r * 0.3, r * 0.3, 0, TAU); c.fill(); c.restore();
}
// 地面上的一丛荆棘尖刺（御敌之刺 / 庭院 / 小屋刺人）：k = 0..1 伸出程度
function enSpikes(c, X, Y, w, h, k, seed = 0) {
  if (k <= 0) return;
  if (IMG['fx/enSpike']) { drawSpr(c, 'enSpike', X, Y + 4, w, h * k, { add: false, ay: 1 }); return; }
  c.fillStyle = EN_THORN;
  for (let i = 0; i < 5; i++) { const u = (i - 2) / 2, x = X + u * w * 0.4, hh = h * k * (1 - Math.abs(u) * 0.35) * (0.8 + 0.2 * Math.sin(seed + i * 2.1)); c.beginPath(); c.moveTo(x - 5, Y); c.lineTo(x + 5, Y); c.lineTo(x + u * 8, Y - hh); c.fill(); }
}

/* =====================================================================
   疯疯熊（follower）：动作表 spr/madbear —— walk（idle、walk1~8）/ act（scratch1·2、punch1·2、slam1·2、guard、hurt）/ more（leap、fall、roar、claw1·2、idle2、cheer、down）
   ===================================================================== */
const EN_GUARD_R = 600;   // 疯熊守护的施放范围（官方 600px）：离主角最近、在这个范围内的敌人
const EN_BEAR_CLIP_NAMES = ['bScratch1', 'bScratch2', 'bScratch', 'bPunch', 'bSlam', 'bLeap', 'bFall', 'bRoar', 'bClaw', 'bGuard', 'bCheer', 'bHurt'];
const EN_BEAR_CLIPS = { ...BEAST_CLIPS };
for (const n of EN_BEAR_CLIP_NAMES) { EN_BEAR_CLIPS[n] = { dur: 9, keys: [k(0, POSE.idle)] }; Object.defineProperty(EN_BEAR_CLIPS[n], '__name', { value: n }); }
let EN_BEAR_ANIMS = null;
function enBearAnims() {
  if (EN_BEAR_ANIMS) return EN_BEAR_ANIMS;
  const F = (typeof SPR_DATA !== 'undefined' && SPR_DATA.madbear && SPR_DATA.madbear.frames) || {}, or = (...L) => L.find(n => F[n]) || 'idle';
  const walk = [1, 2, 3, 4, 5, 6, 7, 8].map(i => 'walk' + i).filter(n => F[n]);
  return EN_BEAR_ANIMS = { ...(typeof SPR_ANIMS !== 'undefined' ? SPR_ANIMS.monster : {}),
    idle: [['idle', 0]], walk: walk.length ? { fps: 10, frames: walk } : [['idle', 0]], run: walk.length ? { fps: 17, frames: walk } : [['idle', 0]],
    jumpUp: [[or('leap'), 0]], jumpFall: [[or('fall'), 0]], land: [[or('slam2'), 0]], back: [[or('leap'), 0]],
    hit: [[or('hurt'), 0]], hit2: [[or('hurt'), 0]], air: [[or('hurt'), 0]], airUp: [[or('hurt'), 0]], bounceUp: [[or('down'), 0]], down: [[or('down'), 0]], getup: [[or('idle2', 'idle'), 0]], held: [[or('hurt'), 0]],
    bScratch1: [[or('scratch1'), 0]], bScratch2: [[or('scratch2'), 0]], bScratch: [[or('scratch1'), 0], [or('scratch2'), 0.24]],
    bPunch: [[or('punch1'), 0], [or('punch2'), 0.12]], bSlam: [[or('slam1'), 0], [or('slam2'), 0.2]],
    bLeap: [[or('leap'), 0]], bFall: [[or('fall'), 0], [or('slam2'), 9]], bRoar: [[or('roar'), 0]], bClaw: { fps: 11, frames: [or('claw1', 'scratch1'), or('claw2', 'scratch2')] },
    bGuard: [[or('guard'), 0]], bCheer: [[or('cheer'), 0]], bHurt: [[or('hurt'), 0]] };
}
// 兜底模型（素材还没加载 / 还没合并时）：布偶熊的简笔画，头顶两根傀儡线
const EN_BEAR_FB = { draw(c, pose, t) {
  const n = pose.__c || 'idle', atk = /Scratch|Claw|Punch|Slam/.test(n), up = /Leap|Roar|Cheer/.test(n), b = Math.sin(t * 3) * 1.2;
  c.save(); c.lineWidth = 2; c.strokeStyle = '#3a2210';
  c.strokeStyle = 'rgba(235,225,205,.8)'; c.lineWidth = 1; c.beginPath(); c.moveTo(-8, -98 + b); c.lineTo(-8, -190); c.moveTo(9, -98 + b); c.lineTo(9, -190); c.stroke();
  c.lineWidth = 2; c.strokeStyle = '#3a2210'; c.fillStyle = '#8a5a30';
  c.beginPath(); c.ellipse(-8, -8, 8, 7, 0, 0, TAU); c.ellipse(9, -8, 8, 7, 0, 0, TAU); c.fill(); c.stroke();
  c.beginPath(); c.ellipse(0, -40 + b, 22, 28, 0, 0, TAU); c.fill(); c.stroke();
  c.fillStyle = '#8a5aa8'; c.beginPath(); c.ellipse(4, -38 + b, 10, 13, 0, 0, TAU); c.fill();
  c.fillStyle = '#8a5a30'; const ax = atk ? 30 : 16, ay = up ? -86 : atk ? -52 : -40;
  c.beginPath(); c.ellipse(ax, ay + b, 8, 10, 0, 0, TAU); c.fill(); c.stroke(); c.beginPath(); c.ellipse(-16, -40 + b, 7, 10, 0, 0, TAU); c.fill(); c.stroke();
  c.beginPath(); c.arc(2, -80 + b, 19, 0, TAU); c.fill(); c.stroke();
  c.beginPath(); c.arc(-12, -96 + b, 7, 0, TAU); c.arc(14, -96 + b, 7, 0, TAU); c.fill(); c.stroke();
  c.fillStyle = '#1a1010'; c.beginPath(); c.arc(8, -82 + b, 3.5, 0, TAU); c.fill(); c.strokeStyle = '#1a1010'; c.beginPath(); c.moveTo(-6, -85 + b); c.lineTo(-1, -80 + b); c.moveTo(-1, -85 + b); c.lineTo(-6, -80 + b); c.stroke();
  c.beginPath(); c.moveTo(-2, -71 + b); c.lineTo(14, -71 + b); c.stroke();
  c.restore(); } };
// 傀儡线：每帧的挂点（spr.json 的 str，切帧时从身体最高处取）统一往天上画，所有动作表的线都一致；人偶剧场中线由暗黑少女牵着（noStr）
function enBearModel(noStr) {
  if (!enHasArt('madbear')) return EN_BEAR_FB;
  const m = new SpriteModel('madbear', { ...SPR_FALLBACK, _: 'idle' }, enBearAnims()); if (noStr) return m;
  const d0 = m.draw.bind(m);
  m.draw = (c, pose, t, opts) => { d0(c, pose, t, opts); const F = m.S.frames[m.frameOf(pose)]; if (!F || !F.str) return; const k = 1 / m.S.res;
    c.save(); c.strokeStyle = 'rgba(236,226,206,.85)'; c.lineWidth = 1; c.beginPath();
    for (const [x, y] of F.str) { const X = (x - F.ax) * k, Y = (y - F.ay) * k; c.moveTo(X, Y + 2); c.lineTo(X + Math.sin(t * 1.3 + x) * 4, Y - 420); }
    c.stroke(); c.restore(); };
  return m;
}
// 默认 AI：站在主角正前方；主角跑远了就跟上，太远直接闪现；不主动出手（傀儡，只听命令）
function enBearAI(s, dt) {
  const o = s.owner, D = s.sdef;
  if (o.enStage) { s.warp(o.x, o.y); s.vx = s.vy = 0; s.setState('idle'); return; }
  const R = game.room, gx = R ? clamp(o.x + o.face * 58, R.x0 + 20, R.x1 - 20) : o.x + o.face * 58, gy = clamp(o.y + 3, 4, DEPTH - 4);
  if (Math.abs(s.x - o.x) > 520 || Math.abs(s.y - o.y) > 160) { s.warp(gx, gy); fxBurst(s.x, s.y, 40, 60, '#d8b0ff'); return; }
  const dx = gx - s.x, dy = gy - s.y;
  if (Math.abs(dx) > 8 || Math.abs(dy) > 5) {
    const far = Math.abs(dx) > 110 || o.st === 'run', l = Math.hypot(dx, dy * 1.3) || 1, sp = (far ? D.runSpeed : D.speed) * (1 + buffVal(s, 'mspd'));
    s.vx = dx / l * sp; s.vy = dy / l * sp * 0.8; if (Math.abs(dx) > 8) s.face = Math.sign(dx);
    s.setState(far ? 'run' : 'walk');
  } else { s.vx = s.vy = 0; s.setState('idle'); s.face = o.face; }
}
defSummon('en_bear', { kind: 'follower', name: '疯疯熊', bundle: 'madbear', model: () => enBearModel(), clips: EN_BEAR_CLIPS, w: 16, d: 13, h: 100, scale: 1, speed: 190, runSpeed: 380, shadowR: 20,
  life: Infinity, max: 1, over: 'refresh', keepRoom: true, enterAt: 'front', col: '#c8a070', type: 'indep', elem: 'dark', ai: enBearAI,
  onSpawn(s) { if (s.owner.ghost) s.ghost = true; },   // 队友影子的熊只是表现（applyHit 不结算影子）
  update(s) {   // 偏爱疯疯熊：熊系技能加伤（单刷时施放偏爱自动选熊）
    const F = s.owner.buffs && s.owner.buffs.en_favor, lv = F ? F.lv || 1 : 1;
    if (F && F.bear) s.buffs.en_favor = { t: 0.5, dmg: 0.15 + 0.005 * lv }; else delete s.buffs.en_favor;
  } });
// 活着的疯疯熊；被外部移除（remove）但还没走完召唤框架收尾的熊先收掉，免得熊技能落在一只看不见的熊身上
const enBearOf = p => { for (const s of summonsOf(p, 'en_bear')) { if (s.remove || s.dead) dismissOne(s, 'gone'); else return s; } return null; };
function enBearSpawn(p) {
  const s = summon(p, 'en_bear', { x: p.x + p.face * 58, y: p.y });
  if (s) { fxBurst(s.x, s.y, 50, 90, '#d8b0ff'); if (!enHasArt('madbear')) enLoadArt(); }
  return s;
}
// 让熊（或人偶剧场中的主角自己）做一个动作；熊离得太远先召回身前
function enBearDo(p, def) {
  if (p.enStage) { p.doAct(def, p.act && p.act.skill ? { skill: p.act.skill, lv: p.act.lv, type: 'indep' } : undefined); return p; }
  const s = enBearOf(p) || enBearSpawn(p); if (!s) return null;
  if (Math.abs(s.x - p.x) > 280 || Math.abs(s.y - p.y) > 90) { s.warp(p.x + p.face * 58, p.y); fxBurst(s.x, s.y, 40, 60, '#d8b0ff'); }
  const t = aimAhead(p, 0, 320, 70); s.face = t.t ? Math.sign(t.t.x - s.x) || p.face : p.face;
  summonAct(s, def);
  return s;
}
// 熊系技能：主角只做很短的下令动作（人偶剧场中直接由主角变成的熊出招）
function enBearSkill(p, id, lv, move) {
  if (p && p.enStage) return { ...move(lv), name: id };
  return { name: id, clip: 'enCmd', dur: 0.3, noCounter: true, onStart: e => { e._enCmdT = game.t; enBearDo(e, move(lv)); } };
}
// 熊的招式（熊或人偶剧场中的主角都用这一份；e = 出招者）
const EN_MOVES = {
  scratch: lv => ({ clip: 'bScratch', dur: 0.62, move: [[0.04, 0.16, 150], [0.28, 0.36, 90]],
    hits: [HB(0.1, 0.18, [-24, 100, 32, 0, 120], skillDmg(0.55, 0.055, lv), enH(0, { stun: 0.38, knock: 50, hs: 0.05 })), HB(0.34, 0.42, [-24, 105, 32, 0, 120], skillDmg(0.55, 0.055, lv), enH(0, { stun: 0.42, knock: 90, hs: 0.05 }))].map(h => ({ ...h, dmg: skillDmg(0.55, 0.055, lv) })),
    events: [evAt(0.08, e => { sfx.swing(false); fxSlashOn(e, { a0: -2.2, a1: 0.8, r: 60, w: 10, off: [18, 70], col: '#ffd0a0' }); }), evAt(0.32, e => { sfx.swing(true); fxSlashOn(e, { a0: 1.0, a1: -2.0, r: 63, w: 10, off: [18, 70], col: '#ffd0a0' }); })] }),
  // 疯熊火箭拳：拳头连着傀儡线射出去，打中处爆出圆形冲击波，然后收回
  rocket: lv => ({ clip: 'bPunch', dur: 0.9, events: [evAt(0.12, e => enRocketFist(e, lv))] }),
  // 疯熊守护：扑向最近的敌人砸下
  guard: lv => ({ clip: 'bLeap', dur: 0.95, noCounter: true, onStart: e => { const t = nearestFoe(enOwner(e), EN_GUARD_R); e.act.tx = t ? t.x - Math.sign(t.x - e.x || e.face) * 20 : e.x + e.face * 160; e.act.ty = t ? t.y : e.y; e.face = Math.sign(e.act.tx - e.x) || e.face; e.vz = 520; e.z = 1; sfx.jump(); },
    update: (e, dt) => { const a = e.act; if (a.landed) return; e.vx = (a.tx - e.x) * 3.2; e.vy = (a.ty - e.y) * 3.2; if (e.actT > 0.3 && !a.falling) { a.falling = true; e.play('bFall', true); } },
    onLand: e => { const a = e.act; if (!a || a.landed) return; a.landed = true; e.vx = e.vy = 0; e.play('bSlam', true); e.actT = Math.max(e.actT, 0.62); sfx.boom(0.5); cam.shake = Math.max(cam.shake, 4); fxShock(e.x + e.face * 20, e.y, 190, '#c8a070'); fxShock(e.x + e.face * 20, e.y, 120, EN_CURSE); fxDust(e.x, e.y, 10, 50, '#8a7a6a');
      blast(e, e.x + e.face * 20, e.y, 160, enH(skillDmg(3.6, 0.36, a.lv || 1), { launch: 380, knock: 80, hs: 0.08, snd: 'blunt', shake: 3 }), { zMax: 120 }); } }),
  // 疯疯熊坠击：跳出屏幕，落在敌人（按 → 更远）处，冲击波把周围的敌人吸到落点并挑空
  fall: lv => ({ clip: 'bLeap', dur: 1.5, noCounter: true, invul: true,
    onStart: e => { const O = enOwner(e), far = O.pad && O.pad.dx() === O.face, t = aimAhead(O, far ? 380 : 240, far ? 560 : 420, 120); e.act.tx = t.t && !far ? t.x : O.x + O.face * (far ? 380 : 240); e.act.ty = t.t ? t.y : O.y; e.vz = 1300; e.z = 1; sfx.jump(); fxDust(e.x, e.y, 6, 20); },
    update: (e, dt) => { const a = e.act; if (e.actT < 0.55) { e.vx = e.vy = 0; return; } if (!a.drop) { a.drop = true; e.warp(a.tx, a.ty, 620); e.vz = -1500; e.play('bFall', true); warnMark && 0; } },
    onLand: e => { const a = e.act; if (!a || !a.drop || a.landed) return; a.landed = true; e.play('bSlam', true); e.actT = Math.max(e.actT, 1.2); enBearQuake(e, a.lv || 1); } }),
  // 变大吧！疯疯熊：变大后对前方狂抓 + 最后一捶；按 → 慢慢推进
  big: lv => ({ clip: 'bClaw', dur: 3.0, superArmor: true, noCounter: true, bigMadd: true,
    onInput: (e, I) => { if (e.enStage) enBigMash(e, e.act, I); return false; },
    update: (e, dt) => { const O = enOwner(e), u = e.actT; e.act.spd = Math.max(1, e.act.spd - dt * 0.9); e.scale = e.enStage ? 1.3 : u < 0.25 ? lerp(1, 2.1, u / 0.25) : u > 2.8 ? lerp(2.1, 1, (u - 2.8) / 0.2) : 2.1; if (e.enStage) e.scale = 1.3 * (u < 0.25 ? lerp(1, 1.7, u / 0.25) : u > 2.8 ? lerp(1.7, 1, (u - 2.8) / 0.2) : 1.7);
      e.vx = O.pad && O.pad.dx() === e.face && u < 2.5 ? e.face * 70 : 0; if (u > 2.45 && !e.act.sl) { e.act.sl = true; e.play('bSlam', true); } },
    onEnd: e => { e.scale = e.enStage ? 1.3 : 1; },
    hits: [HB(0.3, 2.45, [0, 220, 60, 0, 230], skillDmg(0.8, 0.08, lv), enH(0, { rep: 0.2, stun: 0.45, knock: 25, hs: 0.02 })), HB(2.6, 2.7, [0, 250, 66, 0, 250], skillDmg(5, 0.5, lv), enH(0, { launch: 420, knock: 220, hs: 0.12, shake: 7, big: 2, snd: 'blunt' }))].map((h, i) => ({ ...h, dmg: i ? skillDmg(5, 0.5, lv) : skillDmg(0.8, 0.08, lv) })),
    events: [evAt(0.02, e => { sfx.boom(0.4); fxBurst(e.x, e.y, 80, 160, '#d8b0ff'); }), evAt(2.58, e => { sfx.boom(0.9); cam.shake = Math.max(cam.shake, 7); fxShock(e.x + e.face * 130, e.y, 230, '#c8a070'); fxDust(e.x + e.face * 150, e.y, 10, 60, '#8a7a6a'); })] }),
  // 哇咔咔！：把周围的敌人吸过来，瞬间变大咆哮（官方：咆哮多段 10 次，最后一下把敌人震飞）
  roar: lv => ({ clip: 'bRoar', dur: 1.8, superArmor: true, noCounter: true,
    update: e => { const u = e.actT, b = e.enStage ? 1.3 : 1; e.scale = b * (u < 0.55 ? 1 : u < 0.7 ? lerp(1, 2, (u - 0.55) / 0.15) : u > 1.55 ? lerp(2, 1, Math.min(1, (u - 1.55) / 0.2)) : 2);
      if (u > 0.7 && u < 1.5 && (e.act.rw = (e.act.rw || 0) - 1) <= 0) { e.act.rw = 5; fxShock(e.x + e.face * 30, e.y, 220 + Math.random() * 120, u < 1.1 ? '#ffd0a0' : EN_CURSE); } },
    onEnd: e => { e.scale = e.enStage ? 1.3 : 1; },
    hits: [HB(0.7, 1.52, [-260, 320, 96, 0, 220], 0, enH(0, { rep: 0.09, max: 9, stun: 0.5, knock: 12, radial: true, hs: 0.02, snd: 'blunt' })), HB(1.55, 1.62, [-260, 320, 96, 0, 220], 0, enH(0, { launch: 320, knock: 140, radial: true, hs: 0.08, shake: 5, snd: 'blunt' }))]
      .map((h, i) => ({ ...h, dmg: i ? skillDmg(2.1, 0.21, lv) : skillDmg(0.6, 0.06, lv) })),
    events: [evAt(0.15, e => { for (const t of ents) if (foe(e, t) && !t.boss && t.invul <= 0 && Math.abs(t.x - e.x) < 800 && Math.abs(t.y - e.y) < 200 && t.weight <= 3) { t.x = lerp(t.x, e.x + e.face * 60, 0.75); t.y = lerp(t.y, e.y, 0.6); fxDust(t.x, t.y, 3, 10); } fxShock(e.x, e.y, 800, EN_CURSE); fxShock(e.x, e.y, 520, '#ffd0a0'); }),
      evAt(0.7, e => { sfx.boom(0.8); cam.shake = Math.max(cam.shake, 6); }), evAt(1.55, e => { sfx.boom(1); cam.shake = Math.max(cam.shake, 8); fxShock(e.x + e.face * 30, e.y, 330, '#ffd0a0'); fxShock(e.x + e.face * 30, e.y, 240, EN_CURSE); })] }),
  // 咆哮吧！疯疯熊：巨熊向前喷诅咒吐息，24 段；地面留下 5 秒的诅咒地带
  breath: lv => ({ clip: 'bRoar', dur: 2.8, superArmor: true, noCounter: true,
    update: e => { const u = e.actT, b = e.enStage ? 1.3 : 1; e.scale = b * (u < 0.3 ? lerp(1, 2.4, u / 0.3) : u > 2.6 ? lerp(2.4, 1, (u - 2.6) / 0.2) : 2.4);
      if (u > 0.35 && u < 2.55) for (let i = 0; i < 2; i++) if (Math.random() < 0.7) addFx({ x: e.x + e.face * rnd(60, 600), y: e.y + rnd(-60, 60), z: rnd(30, 130), dur: 0.35, draw(c) { const q = this.t / this.dur; drawSpr(c, fxTint('darkorb', EN_CURSE), sx(this.x), sy(this.y, this.z), 84 * (0.5 + q), 0, { alpha: 0.8 * (1 - q) }); } }); },
    onEnd: e => { e.scale = e.enStage ? 1.3 : 1; },
    hits: [HB(0.35, 2.55, [20, 620, 80, 0, 220], skillDmg(0.55, 0.055, lv), enH(0, { rep: 0.09, max: 24, stun: 0.35, knock: 20, hs: 0.01, col: EN_CURSE }))].map(h => ({ ...h, dmg: skillDmg(0.55, 0.055, lv) })),
    events: [evAt(0.34, e => { sfx.boom(0.7); summon(enOwner(e), 'en_cursezone', { x: e.x + e.face * 300, y: e.y, lv }); })] }),
};
// 火箭拳：拳头投射物（连着傀儡线），命中或飞到头就原地炸出冲击波，然后收回
function enRocketFist(e, lv) {
  sfx.swing(true); const x0 = e.x + e.face * 8, face = e.face, R = 330;
  spawnProj({ owner: e, x: x0, y: e.y, z: 62, face, vx: face * 900, life: 0.9, w: 18, d: 18, h: 30, pierce: false, back: false,
    hit: enH(skillDmg(0.8, 0.08, lv), { stun: 0.4, knock: 60, hs: 0.05, snd: 'blunt' }),
    update(pr, dt) { if (!pr.back && (pr.x - x0) * face >= R) { pr.back = true; enFistBoom(e, pr, lv); } if (pr.back) { pr.vx = 0; const tx = e.x + face * 30; pr.x = damp(pr.x, tx, 14, dt); if (Math.abs(pr.x - tx) < 12) pr.t = pr.life; pr.hit = null; } },
    onHitT(pr) { if (!pr.back) { pr.back = true; enFistBoom(e, pr, lv); } },
    draw(c, pr) { const X = sx(pr.x), Y = sy(pr.y, pr.z), X0 = sx(e.x + face * 18), Y0 = sy(e.y, e.z + 70);
      c.strokeStyle = 'rgba(235,225,205,.85)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(X0, Y0); c.quadraticCurveTo((X0 + X) / 2, Math.max(Y0, Y) + 8, X, Y); c.stroke();
      c.fillStyle = '#8a5a30'; c.strokeStyle = '#3a2210'; c.lineWidth = 2; c.beginPath(); c.arc(X, Y, 11, 0, TAU); c.fill(); c.stroke();
      c.fillStyle = '#f0e0c0'; for (let i = -1; i <= 1; i++) { c.beginPath(); c.moveTo(X + face * 9, Y + i * 6 - 2); c.lineTo(X + face * 17, Y + i * 6); c.lineTo(X + face * 9, Y + i * 6 + 2); c.fill(); } } });
}
function enFistBoom(e, pr, lv) {
  sfx.boom(0.4); fxShock(pr.x, pr.y, 130, '#e0b0ff'); fxBurst(pr.x, pr.y, pr.z, 130, '#d8b0ff');
  blast(e, pr.x, pr.y, 100, enH(skillDmg(1.4, 0.14, lv), { launch: 240, knock: 90, hs: 0.06, snd: 'blunt' }), { zMax: 140 });
}
// 坠击落地：把周围的敌人吸到落点并挑空
function enBearQuake(e, lv) {
  sfx.boom(1); cam.shake = Math.max(cam.shake, 8); fxShock(e.x, e.y, 260, '#c8a070'); fxShock(e.x, e.y, 170, EN_CURSE); fxDust(e.x, e.y, 16, 60, '#8a7a6a');
  for (const t of ents) if (foe(e, t) && t.invul <= 0 && !t.boss && inGround(t, e.x, e.y, 260) && t.weight <= 3) { t.x = lerp(t.x, e.x, 0.7); t.y = lerp(t.y, e.y, 0.7); }
  blast(e, e.x, e.y, 220, enH(skillDmg(4.4, 0.44, lv), { launch: 460, knock: 30, hs: 0.1, big: 1.6, snd: 'blunt', downHit: true }), { zMax: 200 });
}

/* ---- 僵尸人偶（疯狂召唤）：冲向敌人自爆 ---- */
const EN_DOLL_CLIPS = { ...BEAST_CLIPS };
for (const n of ['dRun', 'dSwell']) { EN_DOLL_CLIPS[n] = { dur: 9, keys: [k(0, POSE.idle)] }; Object.defineProperty(EN_DOLL_CLIPS[n], '__name', { value: n }); }
const EN_DOLL_FB = { draw(c, pose, t) {
  const sw = pose.__c === 'dSwell' ? 1.35 : 1, b = Math.abs(Math.sin(t * 14)) * 2;
  c.save(); c.lineWidth = 1.5; c.strokeStyle = '#2a3020'; c.fillStyle = '#9aaa7a';
  c.beginPath(); c.ellipse(0, -14 - b, 8 * sw, 10 * sw, 0, 0, TAU); c.fill(); c.stroke();
  c.beginPath(); c.arc(1, -32 - b, 11 * sw, 0, TAU); c.fill(); c.stroke();
  c.strokeStyle = '#6a3a2a'; c.lineWidth = 2; c.beginPath(); c.moveTo(4, -42 - b); c.lineTo(10, -52 - b); c.stroke();
  c.fillStyle = '#1a1a14'; c.beginPath(); c.arc(5, -33 - b, 2.5, 0, TAU); c.fill(); c.restore(); } };
function enDollModel() {
  if (!enHasArt('zombiedoll')) return EN_DOLL_FB;
  const F = SPR_DATA.zombiedoll.frames, or = (...L) => L.find(n => F[n]) || 'idle', walk = [1, 2, 3, 4, 5, 6, 7, 8].map(i => 'walk' + i).filter(n => F[n]);
  return new SpriteModel('zombiedoll', { ...SPR_FALLBACK, _: 'idle' }, { ...SPR_ANIMS.monster, idle: [['idle', 0]], walk: walk.length ? { fps: 10, frames: walk } : [['idle', 0]],
    run: { fps: 12, frames: [or('run1'), or('run2')] }, dRun: { fps: 12, frames: [or('run1'), or('run2')] }, dSwell: [[or('swell1'), 0], [or('swell2'), 0.18]] });
}
function enDollBoom(s) {
  if (s.boomed) return; s.boomed = true;
  sfx.boom(0.35); fxBurst(s.x, s.y, 20, 130, EN_CURSE); fxShock(s.x, s.y, 100, EN_CURSE);
  if (!s.owner.ghost) summonArea(s, s.x, s.y, 90, enH(skillDmg(0.9, 0.09, s.lv), { launch: 240, knock: 70, hs: 0.05, snd: 'fire' }), { status: 'curse', sdur: 5, zMax: 80 });
}
defSummon('en_doll', { kind: 'follower', name: '僵尸人偶', bundle: 'zombiedoll', model: () => enDollModel(), clips: EN_DOLL_CLIPS, w: 9, d: 9, h: 46, scale: 1, speed: 290, shadowR: 10,
  life: 4, max: 10, over: 'oldest', keepRoom: false, col: EN_CURSE, type: 'indep', elem: 'dark',
  ai(s, dt) {
    let t = s.target && !s.target.dead && !s.target.remove ? s.target : null;
    if (!t) t = s.target = nearestFoe(s, 800);
    const gx = t ? t.x : s.x + s.face * 200, gy = t ? t.y : s.y, dx = gx - s.x, dy = gy - s.y, l = Math.hypot(dx, dy * 1.4) || 1;
    if (t && l < 16 + (t.w || 10) + s.w) {   // 贴到敌人身上鼓起来再自爆（动作期间框架不调 ai，所以用动作事件引爆）
      s.vx = s.vy = 0; s.doAct({ name: 'dSwell', clip: 'dSwell', dur: 0.34, noCounter: true,
        update: d => { d.vx = d.vy = 0; if (!t.dead && !t.remove) { d.x = t.x - Math.sign(t.x - d.x || -d.face) * (t.w || 10) * 0.6; d.y = t.y + 1; } if (Math.random() < 0.6) fxCharge(d, EN_CURSE); },
        events: [evAt(0.3, d => { enDollBoom(d); dismissOne(d, 'cmd'); })] }); return; }
    s.vx = dx / l * s.sdef.speed; s.vy = dy / l * s.sdef.speed * 0.8; if (Math.abs(dx) > 4) s.face = Math.sign(dx); s.setState('run'); s.play('dRun');
  },
  onEnd(s, why) { if (why === 'life') enDollBoom(s); } });

/* =====================================================================
   场地（field）：玫瑰藤蔓 / 蔷薇囚狱 / 爱之急救 / 林中小屋 / 苦痛庭院 / 诅咒地带 / 挚爱囚笼
   ===================================================================== */
// 玫瑰藤蔓：荆棘贴地向前爬（0.5 秒爬满 450px），留在地上 2.5 秒，每 0.3 秒刺一下（轻微击退 + 出血）；可以预先铺好
const EN_VINE_LEN = 450;
defSummon('en_vine', { kind: 'field', life: 2.6, max: 2, r: 500, tick: 0.3, keepRoom: false,
  onSpawn(s) { s.len = 0; s.face = s.owner.face; s.seed = rnd(0, 9); },
  update(s, dt) { s.len = Math.min(EN_VINE_LEN, s.len + dt * 900); },
  onTick(s) { if (s.owner.ghost) return; const x0 = s.x, x1 = s.x + s.face * s.len;
    for (const t of ents) if (foe(s.owner, t) && t.invul <= 0 && t.z < 40 && t.st !== 'down' && Math.abs(t.y - s.y) < 28 + t.d && (t.x - x0) * s.face > -t.w && (t.x - x1) * s.face < t.w)
      if (summonHit(s, t, enH(skillDmg(0.3, 0.03, s.lv), { stun: 0.25, knock: 40, hs: 0.02, col: '#ff8aa0' }))) addStatus(t, 'bleed', 3, { dps: atkOf(s.owner, 'indep') * 0.03, src: s.owner }); },
  draw(c, s) { const a = s.life - s.lifeT < 0.4 ? (s.life - s.lifeT) / 0.4 : 1, X0 = sx(s.x), Y = sy(s.y, 0), X1 = sx(s.x + s.face * s.len);
    if (IMG['fx/enVine']) { c.save(); c.beginPath(); c.rect(Math.min(X0, X1), Y - 60, Math.abs(X1 - X0) + 1, 90); c.clip(); drawSpr(c, 'enVine', sx(s.x + s.face * EN_VINE_LEN / 2), Y - 6, EN_VINE_LEN, 0, { add: false, flip: s.face < 0, alpha: a }); c.restore(); return; }
    c.save(); c.globalAlpha = a; enThornLine(c, X0, Y - 2, X1, Y - 2, 3, s.seed); enThornLine(c, X0, Y + 3, X1, Y + 1, 2, s.seed + 3);
    for (let x = 40; x < s.len; x += 70) enRose(c, sx(s.x + s.face * x), Y - 4, 4, a); c.restore(); } });
// 蔷薇囚狱：前方一片荆棘区，定身约 4.5 秒，敌人身下开出蔷薇多段伤害，结束时爆炸击倒
defSummon('en_jail', { kind: 'field', life: 4.6, max: 1, r: 210, tick: 0.3, keepRoom: false,
  onSpawn(s) { s.caught = new Set(); },
  onTick(s, foes) { if (s.owner.ghost) return;
    for (const t of foes) { if (!s.caught.has(t)) { s.caught.add(t); addStatus(t, 'root', s.life - s.lifeT, { src: s.owner }); }
      summonHit(s, t, enH(skillDmg(0.25, 0.025, s.lv), { stun: 0.3, knock: 0, hs: 0.01, col: '#ff6a8a' })); } },
  onEnd(s, why) { if (why !== 'life') return; sfx.boom(0.8); cam.shake = Math.max(cam.shake, 5); fxShock(s.x, s.y, 250, EN_ROSE); fxBurst(s.x, s.y, 30, 280, EN_ROSE);
    if (s.owner.ghost) return; for (const t of s.caught) if (t.status && t.status.root) delete t.status.root;
    summonArea(s, s.x, s.y, 230, enH(skillDmg(2.4, 0.24, s.lv), { down: true, downLift: 300, knock: 140, hs: 0.08, big: 1.5, col: EN_ROSE }), { zMax: 120 }); },
  draw(c, s) { const u = s.lifeT, a = u < 0.2 ? u / 0.2 : Math.min(1, (s.life - u) / 0.2), X = sx(s.x), Y = sy(s.y, 0);
    c.save(); c.globalAlpha = a * 0.55; c.fillStyle = '#3a1030'; c.beginPath(); c.ellipse(X, Y, 210, 210 * GR, 0, 0, TAU); c.fill(); c.restore();
    c.save(); c.globalAlpha = a; for (let i = 0; i < 14; i++) { const an = i * TAU / 14 + 0.3, r = 195; enThornLine(c, X + Math.cos(an) * r, Y + Math.sin(an) * r * GR, X + Math.cos(an + 0.55) * r, Y + Math.sin(an + 0.55) * r * GR, 3, i); }
    for (const t of s.caught) if (!t.dead) enRose(c, sx(t.x), sy(t.y, 0) - 2, 5 + 3 * Math.sin(game.t * 6 + t.id), a); c.restore(); } });
// 爱之急救：以施放位置为中心的绷带魔法阵，约 8 秒内持续回复范围内的队友
defSummon('en_aid', { kind: 'field', life: 8, max: 1, r: 800, tick: 0.5, keepRoom: false,
  onTick(s) { for (const t of enParty(s.owner)) if (inGround(t, s.x, s.y, 800)) enHeal(t, 0.012 + 0.001 * s.lv); },
  draw(c, s) { const u = s.lifeT, a = u < 0.3 ? u / 0.3 : Math.min(1, (s.life - u) / 0.5), X = sx(s.x), Y = sy(s.y, 0), im = IMG['fx/enBandage'] ? 'enBandage' : fxTint('hexagram', '#ff9ac0');
    c.save(); c.translate(X, Y); c.scale(1, GR); c.rotate(game.t * 0.4); c.globalAlpha = 0.55 * a; drawSpr(c, im, 0, 0, 560, 560, { add: !IMG['fx/enBandage'] }); c.restore();
    c.save(); c.globalAlpha = 0.18 * a; c.strokeStyle = '#ffd0e0'; c.lineWidth = 3; c.beginPath(); c.ellipse(X, Y, 800, 800 * GR, 0, 0, TAU); c.stroke(); c.restore(); } });
// 林中小屋：队友跳进去就无敌（小屋蠕动时扣 5% HP），按跳跃出来；靠近的敌人被刺并击退。每张图最多 2 次
defSummon('en_hut', { kind: 'field', life: 20, max: 1, r: 170, tick: 1.0, keepRoom: false,
  onSpawn(s) { s.wig = 0; s.wigT = 3.5; s.stab = 0; s.open = 0; },
  update(s, dt) {
    s.wig = Math.max(0, s.wig - dt); s.stab = Math.max(0, s.stab - dt); s.open = Math.max(0, s.open - dt);
    if (s.lifeT > 1 && s.lifeT < s.life - 1 && (s.wigT -= dt) <= 0) { s.wigT = 3.5; s.wig = 0.7; const p = game.player; if (p && p.enHut === s && !(p.buffs && p.buffs.en_favored)) { const v = Math.max(0, Math.min(p.hp - 1, Math.round(p.hpMax * 0.05))); if (v) { p.hp -= v; addNumber(v, p.x, p.y, p.z + 60, { player: true }); } } }
    const p = game.player;   // 进屋：本机玩家跳起来落到小屋上（队友那边同一座小屋由技能重放生成）
    if (p && !p.dead && !p.enHut && !p.enStage && s.lifeT > 0.9 && s.lifeT < s.life - 1 && p.z > 12 && p.vz < 0 && Math.abs(p.x - s.x) < 46 && Math.abs(p.y - s.y) < 26) enHutEnter(p, s);
  },
  onTick(s, foes) { if (s.lifeT < 0.9 || s.owner.ghost) return; let n = 0; for (const t of foes) { if (summonHit(s, t, enH(skillDmg(0.35, 0.035, s.lv), { radial: true, knock: 220, stun: 0.4, hs: 0.04 }))) n++; } if (n) { s.stab = 0.3; sfx.swing(false); fxShock(s.x, s.y, 170, EN_ROSE); } },
  onEnd(s) { const p = game.player; if (p && p.enHut === s) enHutExit(p); },
  drawUpright(c, s) { enDrawHut(c, s); } });
const EN_HUT_GROW = ['g1', 'g2', 'g3', 'g4', 'g5', 'idle'], EN_HUT_WITHER = ['idle', 'w1', 'w2', 'w3'];
function enDrawHut(c, s) {
  const X = sx(s.x), Y = sy(s.y, 0), u = s.lifeT, end = s.life - u, sw = s.wig > 0 ? Math.sin(game.t * 30) * 0.03 : 0;
  const sc = 0.95, grow = u < 0.9 ? easeOut(Math.min(1, u / 0.9)) : 1, fade = end < 0.35 ? end / 0.35 : 1;
  if (enHasArt('thornhut')) {
    // 生长 1.0 秒：藤芽 → 长高 → 编成墙架 → 木板墙 → 屋顶 → 成形；枯萎最后 1.2 秒：枯黄下垂 → 塌下 → 一堆碎木；相邻两个阶段交叉淡入
    const seq = u < 1.0 ? EN_HUT_GROW : end < 1.2 ? EN_HUT_WITHER : null;
    if (seq) { const q = u < 1.0 ? u / 1.0 : 1 - end / 1.2, p = q * (seq.length - 1), i = Math.min(seq.length - 2, Math.floor(p)), f = p - i;
      enFrame(c, 'thornhut', seq[i], X, Y, sc, { alpha: (1 - f) * fade }); enFrame(c, 'thornhut', seq[i + 1], X, Y, sc, { alpha: f * fade }); return; }
    const f = s.open > 0 ? 'open' : s.stab > 0 ? 'stab' : s.wig > 0 ? (Math.floor(game.t * 10) % 2 ? 'wiggle1' : 'wiggle2') : 'idle';
    enFrame(c, 'thornhut', f, X, Y, sc, { sx: 1 + sw, sy: 1 - sw });
    return;
  }
  // 兜底：简笔荆棘小屋
  c.save(); c.globalAlpha = fade; c.translate(X, Y); c.scale(1 + sw, grow * (1 - sw));
  c.fillStyle = '#3a2a24'; c.strokeStyle = '#140a10'; c.lineWidth = 2; c.fillRect(-34, -58, 68, 58); c.strokeRect(-34, -58, 68, 58);
  c.fillStyle = '#2a1a36'; c.beginPath(); c.moveTo(-44, -56); c.lineTo(0, -104); c.lineTo(44, -56); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = s.open > 0 ? '#c080ff' : '#6a3a8a'; c.beginPath(); c.arc(8, -22, 12, Math.PI, 0); c.lineTo(20, 0); c.lineTo(-4, 0); c.closePath(); c.fill();
  c.fillStyle = '#c08aff'; c.fillRect(-24, -44, 10, 10);
  for (let i = 0; i < 4; i++) enThornLine(c, -40 + i * 22, -2, -30 + i * 20, -70 + (i % 2) * 20, 2, i);
  enRose(c, -20, -72, 5); enRose(c, 22, -64, 5); c.restore();
  if (s.stab > 0) { enSpikes(c, X - 110, Y, 50, 50, s.stab / 0.3); enSpikes(c, X + 110, Y, 50, 50, s.stab / 0.3, 2); }
}
const EN_EMPTY_MODEL = { draw() { } };
function enHutEnter(p, s) {
  p.enHut = s; s.open = 0.4; sfx.door && sfx.door(); fxText('躲进小屋', p.x, p.y, p.z + 60, { col: '#ffd0e8', size: 11 });
  p.doAct({ name: 'enHut', clip: 'idle', dur: 1e9, invul: true, noCounter: true,
    onStart: e => { e._enHutM = e.model; e._enHutSh = e.shadowR; e.model = EN_EMPTY_MODEL; e.shadowR = 0; },
    update: e => { const H = e.enHut; if (!H || H.gone) { e.endAct(); return; } e.x = H.x; e.y = H.y + 1; e.z = 0; e.vx = e.vy = e.vz = 0; },
    onInput: (e, I) => { if (I.buffered('jump')) { I.consume('jump'); enHutExit(e); } return true; },
    onEnd: e => { if (e._enHutM) { e.model = e._enHutM; e.shadowR = e._enHutSh; e._enHutM = null; } const H = e.enHut; e.enHut = null; e.invul = Math.max(e.invul, 0.6); if (H && !H.gone) H.open = 0.4; } });
}
function enHutExit(p) { if (p.act && p.act.name === 'enHut') { p.endAct(); p.vz = p.jumpV * 0.75; p.z = 1; p.setState('jump'); } else p.enHut = null; }
// 诅咒地带（咆哮吧！疯疯熊）：5 秒，诅咒 + 持续伤害
defSummon('en_cursezone', { kind: 'field', life: 5, max: 1, r: 280, tick: 0.5, keepRoom: false,
  // 官方：诅咒地带不造成伤害；走进来的队友（含自己）禁忌诅咒 / 偏爱的持续时间 +45 秒（每人每片地带一次）
  onTick(s, foes) { if (s.owner.ghost) return; for (const t of foes) addStatus(t, 'curse', 2, { amt: 0.12, src: s.owner });
    s.ext = s.ext || new Set();
    for (const t of enParty(s.owner, 2000)) if (!s.ext.has(t) && inGround(t, s.x, s.y, 280)) { s.ext.add(t); let n = 0; for (const k of ['en_forbidden', 'en_favor']) if (t.buffs[k]) { t.buffs[k].t += 45; n++; } if (n) fxText('+45 秒', t.x, t.y, t.z + 80, { col: '#d0a0ff', size: 10 }); } },
  draw(c, s) { const u = s.lifeT, a = u < 0.3 ? u / 0.3 : Math.min(1, (s.life - u) / 0.6), X = sx(s.x), Y = sy(s.y, 0);
    c.save(); c.translate(X, Y); c.scale(1, GR); c.rotate(-game.t * 0.6); c.globalAlpha = 0.5 * a; drawSpr(c, fxTint('rune', EN_CURSE), 0, 0, 560, 560); c.restore();
    if (Math.random() < 0.45) addFx({ x: s.x + rnd(-240, 240), y: s.y + rnd(-100, 100), z: 0, vz: 30, dur: 0.8, update(dt) { this.z += this.vz * dt; }, draw(cc) { const q = this.t / this.dur; drawSpr(cc, fxTint('darkorb', EN_CURSE), sx(this.x), sy(this.y, this.z), 26 * (1 - q * 0.5), 0, { alpha: 0.6 * (1 - q) }); } }); } });
// 苦痛庭院：以自身为中心约 500px 的荆棘庭院，8 段伤害 + 束缚 3 秒
defSummon('en_garden', { kind: 'field', life: 3.4, max: 1, r: 500, tick: 0.4, hits: 8, keepRoom: false,
  // 前 7 段荆棘多段（出血），第 8 段蔷薇爆炸（官方：荆棘多段 + 蔷薇爆炸 + 出血 3 秒 + 束缚 3 秒）
  onTick(s, foes) { if (s.owner.ghost) return; const first = s.hits === 0, fin = s.hits === 7;
    for (const t of foes) { if (first) addStatus(t, 'bind', 3, { src: s.owner });
      if (fin) { summonHit(s, t, enH(skillDmg(5.6, 0.56, s.lv), { stun: 0.6, knock: 60, radial: true, hs: 0.08, big: 1.4, col: EN_ROSE, snd: 'blunt' })); fxBurst(t.x, t.y, 30, 70, EN_ROSE); }
      else if (summonHit(s, t, enH(skillDmg(0.8, 0.08, s.lv), { stun: 0.35, knock: 0, hs: 0.03, col: EN_ROSE }))) addStatus(t, 'bleed', 3, { dps: atkOf(s.owner, 'indep') * 0.03, src: s.owner }); }
    if (fin) { sfx.boom(0.9); cam.shake = Math.max(cam.shake, 6); fxShock(s.x, s.y, 500, EN_ROSE); fxShock(s.x, s.y, 330, EN_ROSE); for (let i = 0; i < 16; i++) { const an = i * TAU / 16, rr = i % 2 ? 340 : 200; fxSpr('petal', s.x + Math.cos(an) * rr, s.y + Math.sin(an) * rr * GR, 20, { w: 64, dur: 0.6, col: EN_ROSE }); } } },
  draw(c, s) { const u = s.lifeT, a = u < 0.25 ? u / 0.25 : Math.min(1, (s.life - u) / 0.4), X = sx(s.x), Y = sy(s.y, 0);
    c.save(); c.globalAlpha = a * 0.45; c.fillStyle = '#2a0a20'; c.beginPath(); c.ellipse(X, Y, 500, 500 * GR, 0, 0, TAU); c.fill(); c.globalAlpha = a;
    for (let i = 0; i < 28; i++) { const an = i * TAU / 28 + (i % 2) * 0.1, r = 140 + (i % 4) * 100, x = X + Math.cos(an) * r, y = Y + Math.sin(an) * r * GR; enSpikes(c, x, y, 34, 46, Math.min(1, u * 4) * (0.7 + 0.3 * Math.sin(game.t * 8 + i)), i); if (i % 2) enRose(c, x + 6, y - 6, 4, a); }
    c.restore(); } });
// 挚爱囚笼：荆棘鸟笼把敌人关起来强控，结束时笼子收缩，把敌人聚到中心
defSummon('en_cage', { kind: 'field', life: 5, max: 1, r: 300, tick: 0.5, keepRoom: false,
  onSpawn(s) { s.caught = new Set(); },
  onTick(s, foes) { if (s.owner.ghost) return; for (const t of foes) { if (!s.caught.has(t)) { s.caught.add(t); addStatus(t, 'root', s.life - s.lifeT, { src: s.owner }); } summonHit(s, t, enH(skillDmg(0.9, 0.09, s.lv), { stun: 0.3, knock: 0, hs: 0.02 })); } },
  onEnd(s, why) { if (why !== 'life') return; sfx.boom(1); cam.shake = Math.max(cam.shake, 8); fxShock(s.x, s.y, 380, EN_ROSE); fxShock(s.x, s.y, 220, '#ffd0e0');
    if (s.owner.ghost) return; for (const t of ents) if (foe(s.owner, t) && inGround(t, s.x, s.y, 380)) { if (t.status) delete t.status.root; if (!t.boss) { t.x = lerp(t.x, s.x, 0.8); t.y = lerp(t.y, s.y, 0.8); } }
    summonArea(s, s.x, s.y, 200, enH(skillDmg(12, 1.2, s.lv), { launch: 480, knock: 40, hs: 0.12, big: 2, col: EN_ROSE, downHit: true }), { zMax: 200 }); },
  drawUpright(c, s) { const u = s.lifeT, end = s.life - u, a = Math.min(1, u / 0.3, end / 0.3 + 0.3), sh = end < 0.5 ? end / 0.5 : 1, X = sx(s.x), Y = sy(s.y, 0), R = 265 * (0.4 + 0.6 * sh), H = 300 * Math.min(1, u / 0.4);
    if (IMG['fx/enCage']) { drawSpr(c, 'enCage', X, Y + 10, R * 2.2, 0, { add: false, ay: 1, alpha: a }); return; }
    c.save(); c.globalAlpha = a; for (let i = 0; i < 13; i++) { const an = i * TAU / 13, x = X + Math.cos(an) * R, y = Y + Math.sin(an) * R * GR; enThornLine(c, x, y, lerp(x, X, 0.85), Y - H, 2.5, i); }
    c.strokeStyle = EN_THORN; c.lineWidth = 3; c.beginPath(); c.ellipse(X, Y, R, R * GR, 0, 0, TAU); c.stroke(); c.beginPath(); c.arc(X, Y - H, 10, 0, TAU); c.stroke(); enRose(c, X, Y - H - 8, 7, a); c.restore(); } });
// 诅咒人偶（疯狂召唤贴在队友身上）：挂在宿主肩头的小人偶，只是表现
defSummon('en_curseDoll', { kind: 'attach', host: 'target', life: 20, max: 8, keepRoom: false,
  draw(c, s) { const h = s.host, X = sx(h.x - h.face * 14), Y = sy(h.y, h.z + (h.h || 90) * 0.78) + Math.sin(game.t * 4 + s.sid) * 2;
    c.save(); c.globalAlpha = s.life - s.lifeT < 2 ? 0.5 + 0.5 * Math.sin(game.t * 16) : 1; c.fillStyle = '#9aaa7a'; c.strokeStyle = '#2a3020'; c.lineWidth = 1;
    c.beginPath(); c.arc(X, Y - 8, 5, 0, TAU); c.fill(); c.stroke(); c.fillRect(X - 3, Y - 4, 6, 7); c.fillStyle = EN_CURSE; c.fillRect(X - 1, Y - 11, 2, 2); c.restore(); } });

/* =====================================================================
   被动：黑魔法扫把、人偶操纵者、邪恶的好奇心、少女的爱（一觉）、冥月绽放（二觉）、不祥的微笑（三觉）
   ===================================================================== */
defSkill('en_broom', { name: '黑魔法扫把', cls: 'mage', job: EN, lvReq: 15, maxLv: 1, passive: true, type: 'indep', col: '#5a3a6a',
  desc: '【被动】可以装备扫把（小魔女不骑扫把飞行）。施放速度 +30%，命中率 +5%。', infoExtra: () => [['施放速度', '+30%'], ['命中率', '+5%']] });
defSkill('en_puppeteer', { name: '人偶操纵者', cls: 'mage', job: EN, lvReq: 15, passive: true, type: 'indep', col: '#6a3a2a',
  desc: '【被动】操纵人偶的秘术：攻击力提高，免疫诅咒，全部攻击变成暗属性，解锁疯疯熊的技能。\n单刷模式（不在组队地下城里时）：施放小魔女的偏爱时自动偏爱疯疯熊，攻击力 +40%，技能冷却 −20%。',
  infoExtra: lv => [['攻击力', '+' + pct(0.02 + 0.01 * lv)], ['单刷模式', '攻击力 +40% / 冷却 −20%']] });
defSkill('en_curiosity', { name: '邪恶的好奇心', cls: 'mage', job: EN, lvReq: 16, passive: true, type: 'indep', col: '#8a2a5a',
  desc: '【被动】对一切都充满危险的好奇心：技能攻击力和暴击率提高。', infoExtra: lv => [['技能攻击力', '+' + pct(0.06 + 0.01 * lv)], ['暴击率', '+' + pct(0.03 + 0.005 * lv)]] });
const enGirlLove = lv => ({ aspd: 0.05 + 0.005 * lv, mspd: 0.05 + 0.005 * lv, cspd: 0.05 + 0.005 * lv, atk: 0.02 + 0.004 * lv });
defSkill('en_girllove', { name: '少女的爱', cls: 'mage', job: EN, tier: 1, lvReq: 21, passive: true, type: 'indep', col: '#e05a8a',
  desc: '【被动·一觉】少女满溢的爱意：900px 内的队伍成员（包括自己）攻击速度、移动速度、施放速度和攻击力提高。',
  infoExtra: lv => { const b = enGirlLove(lv); return [['攻速 / 移速 / 施放', '+' + pct(b.aspd)], ['攻击力', '+' + pct(b.atk)]]; } });
defSkill('en_bloom', { name: '冥月绽放', cls: 'mage', job: EN, tier: 2, lvReq: 26, passive: true, type: 'indep', col: '#5a2a8a',
  desc: '【被动·二觉】冥月之力在攻击中绽放：命中敌人时叠加“冥月”（最多 5 层，5 秒），每层让该敌人受到的伤害提高；自己的技能攻击力提高。',
  infoExtra: lv => [['每层受到伤害', '+' + pct(0.012 + 0.0015 * lv)], ['技能攻击力', '+' + pct(0.08 + 0.01 * lv)]] });
defSkill('en_sinister', { name: '不祥的微笑', cls: 'mage', job: EN, tier: 3, lvReq: 29, maxLv: 1, passive: true, type: 'indep', col: '#3a1a3a',
  desc: '【被动·三觉】蔷薇藤鞭一下也没打中时，冷却缩短到 1 秒；疯疯熊每 30 秒自动替你挡下一次攻击。' });
function enBloomHit(a, t) {
  const o = enOwner(a); if (!o || !enOn(o) || !t || t.fighter && !game.pvp) return; const lv = skLv(o, 'en_bloom'); if (!lv) return;
  const B = (t.buffs || (t.buffs = {})).en_bloom || (t.buffs.en_bloom = { t: 5, n: 0, taken: 0 });
  B.n = Math.min(5, B.n + 1); B.taken = B.n * (0.012 + 0.0015 * lv); B.until = game.t + 5; B.t = 5;
}

/* =====================================================================
   主动技能（官方 Lv≤48 → 本作 Lv≤21，含一觉）
   ===================================================================== */
const enCmdTxt = s => s;
defSkill('en_rosevine', { name: '玫瑰藤蔓', cls: 'mage', job: EN, lvReq: 10, mp: 25, cd: 5, type: 'indep', elem: 'dark', col: '#8a2040', cast: true,
  desc: '荆棘藤贴着地面向前爬出 450px，留在地上 2.5 秒：碰到的敌人每 0.3 秒受到一次伤害（轻微击退 + 出血）。可以预先铺在敌人要走的路上。', pow: lv => skillDmg(0.3, 0.03, lv) * 6, ai: { kind: 'proj', r: [0, 420], dy: 20 },
  act: (lv) => ({ name: 'en_rosevine', clip: 'mdown', dur: 0.45, cancelFrom: 0.3, events: [evAt(0.14, e => { sfx.swing(false); fxDust(e.x + e.face * 30, e.y, 4, 10, '#5a3a3a'); summon(e, 'en_vine', { x: e.x + e.face * 26, y: e.y, lv }); })] }) });
defSkill('en_mend', { noHitCheck: true, name: '细心缝补', cls: 'mage', job: EN, lvReq: 15, mp: 60, cd: 8, type: 'indep', col: '#e07aa0', cast: true, noForce: true,
  desc: '给坏坏兔的破洞缝上几针：900px 内的队友（包括自己）立即回复 HP 并解除异常状态，之后每 0.5 秒再回复 3 次。施放中霸体，按跳跃键可以取消。',
  infoExtra: lv => [['立即回复', pct(0.06 + 0.004 * lv) + ' HP'], ['之后 3 次', pct(0.02 + 0.002 * lv) + ' HP']], ai: { kind: 'buff' },
  act: (lv) => ({ name: 'en_mend', clip: 'enSew', dur: 0.9, superArmor: true, noCounter: true,
    onInput: (e, I) => { if (I.buffered('jump') && e.actT > 0.1) { I.consume('jump'); e.endAct(); } return false; },
    events: [evAt(0.35, e => enMendNow(e, lv))] }) });
function enMendNow(e, lv) {
  sfx.buff(); fxSpr(IMG['fx/enNeedle'] ? 'enNeedle' : 'heal', e.x + e.face * 16, e.y, e.z + 60, { w: 60, dur: 0.6, add: !IMG['fx/enNeedle'] });
  enParty(e, 900).forEach(t => { enHeal(t, 0.06 + 0.004 * lv); enCleanse(t); fxSpr('heal', t.x, t.y, t.z + 40, { w: 70, dur: 0.6, col: '#ff9ac0' }); });
  for (let i = 1; i <= 3; i++) game.after(i * 0.5, () => { if (!e.dead && ents.includes(e)) enParty(e, 900).forEach(t => enHeal(t, 0.02 + 0.002 * lv)); });
}
defSkill('en_scratch', { name: '疯狂乱抓', cls: 'mage', job: EN, lvReq: 15, mp: 15, cd: 3, type: 'indep', elem: 'dark', col: '#a0603a', bear: true,
  desc: '【疯疯熊】下令让疯疯熊掏出爪子向前挠 2 下。', pow: lv => skillDmg(0.55, 0.055, lv) * 2, ai: { kind: 'poke', r: [0, 150], dy: 24 },
  act: (lv, p) => enBearSkill(p, 'en_scratch', lv, EN_MOVES.scratch) });
defSkill('en_favor', { name: '小魔女的偏爱', cls: 'mage', job: EN, lvReq: 16, mp: 80, cd: 10, type: 'indep', buff: true, col: '#ff7ab0',
  desc: '【队伍 BUFF】抱紧坏坏兔表达爱意：300 秒内全部队友受到的伤害降低、HP / MP 上限提高。同时选出一名“偏爱对象”——离你最近（300px 内）的队友：他吃到的诅咒、爱意和回复效果提高，并且不受禁忌诅咒的副作用；身边没有队友时偏爱疯疯熊（熊系技能加伤）。单刷时自动偏爱疯疯熊。',
  infoExtra: lv => [['受到伤害', '-' + pct(0.04 + 0.004 * lv)], ['HP / MP 上限', '+' + pct(0.05 + 0.005 * lv)], ['偏爱对象效果', '+' + pct(0.15 + 0.005 * lv)], ['偏爱疯疯熊', '熊技能 +' + pct(0.15 + 0.005 * lv)]], ai: { kind: 'buff' },
  act: (lv) => ({ name: 'en_favor', clip: 'enHug', dur: 0.9, noCounter: true, events: [evAt(0.45, e => enFavorCast(e, lv))] }) });
// 偏爱对象：离小魔女最近（300px 内）的队友；没有就偏爱疯疯熊（单刷时总是熊）
function enPickFavor(e) {
  if (enSolo() && !e.ghost) return null; let best = null, bd = 300;
  for (const t of enParty(e)) if (t !== e) { const d = Math.abs(t.x - e.x) + Math.abs(t.y - e.y); if (d < bd) { bd = d; best = t; } }
  return best;
}
function enFavorCast(e, lv) {
  sfx.buff(); for (let i = 0; i < 6; i++) fxCharge(e, '#ff9ac0');
  const b = { t: 300, lv, taken: -(0.04 + 0.004 * lv), hpPct: 0.05 + 0.005 * lv, mpPct: 0.05 + 0.005 * lv, col: '#ff7ab0', name: '小魔女的偏爱' };
  const f = enPickFavor(e);
  for (const t of enParty(e)) { t.buffs.en_favor = { ...b, bear: t === e && !f }; fxAura(t, '#ff9ac0', 0.8); if (t !== e) { if (t === f) t.buffs.en_favored = { t: 300, lv, col: '#ff4a8a', name: '偏爱对象' }; else delete t.buffs.en_favored; } }
  if (f) fxText('♥ 偏爱', f.x, f.y, f.z + (f.h || 100) + 10, { col: '#ff6aa0', size: 13, dur: 1 }); else { const s = enBearOf(e); if (s) { fxText('♥ 偏爱疯疯熊', s.x, s.y, s.z + 110, { col: '#ff6aa0', size: 12, dur: 1 }); fxAura(s, '#ff9ac0', 0.8); } }
  enSend('buff', { id: 'en_favor', b }, e);   // 其他房间的队友
}
defSkill('en_rocket', { name: '疯熊火箭拳', cls: 'mage', job: EN, lvReq: 16, mp: 30, cd: 6, type: 'indep', elem: 'dark', col: '#7a4a2a', bear: true,
  desc: '【疯疯熊】疯疯熊的拳头连着傀儡线射出去（330px），打中的地方爆出圆形冲击波，然后收回拳头。', pow: lv => skillDmg(0.8, 0.08, lv) + skillDmg(1.4, 0.14, lv), ai: { kind: 'proj', r: [40, 380], dy: 24 },
  act: (lv, p) => enBearSkill(p, 'en_rocket', lv, EN_MOVES.rocket) });
const enHotBuff = lv => ({ t: 12, aspd: 0.08 + 0.006 * lv, mspd: 0.08 + 0.006 * lv, cspd: 0.1 + 0.008 * lv, col: '#ff8a3a', name: '火热的爱意' });
defSkill('en_hotfeet', { name: '火热的爱意', cls: 'mage', job: EN, lvReq: 17, mp: 40, cd: 0.5, charges: 2, reload: 12, type: 'indep', elem: 'dark', col: '#e0602a',
  desc: '点燃诅咒人偶的脚（2 次，每 12 秒补充 1 次）：900px 内的队友 12 秒内攻击速度、移动速度和施放速度提高——但站着不动的话脚底会被火烧。同时在前方连续燃起 3 次暗火灼烧敌人。',
  infoExtra: lv => { const b = enHotBuff(lv); return [['攻速 / 移速', '+' + pct(b.aspd)], ['施放速度', '+' + pct(b.cspd)], ['暗火', `3 × ${pct(skillDmg(0.7, 0.07, lv))}`]]; }, pow: lv => skillDmg(0.7, 0.07, lv) * 3, ai: { kind: 'buff' },
  act: (lv) => ({ name: 'en_hotfeet', clip: 'enCmd', dur: 0.5, noCounter: true,
    events: [evAt(0.14, e => enHotNow(e, lv))] }) });
// 火热的爱意：在身前点燃一个诅咒人偶的脚——队友加速；人偶的热量传给附近的敌人（3 段暗火，前两段硬直，最后一段轻轻炸起）
function enHotNow(e, lv) {
  sfx.flame ? sfx.flame() : sfx.buff(); enBuffParty(e, 900, 'en_hotfeet', () => enHotBuff(lv));
  const x = e.x + e.face * 110, y = e.y; enDollFx(x, y, { dur: 0.75, burn: true, face: e.face, drop: !!e.enStage });
  for (let i = 0; i < 3; i++) game.after(0.1 + i * 0.16, () => { if (e.dead) return; fxSpr('flame', x, y, 10, { w: 110 + i * 18, h: 110 + i * 16, dur: 0.45, col: '#c070ff', ay: 1 }); for (const d of [-1, 1]) fxSpr('flame', x + d * 70, y + d * 18, 10, { w: 70 + i * 10, h: 80 + i * 10, dur: 0.4, col: '#c070ff', ay: 1 }); fxShock(x, y, 120, '#c070ff'); fxDust(x, y, 3, 10, '#6a3a5a');
    blast(e, x, y, 120, enH(skillDmg(0.7, 0.07, lv), i < 2 ? { stun: 0.35, knock: 10, hs: 0.04, snd: 'fire', col: '#d090ff' } : { launch: 150, knock: 40, hs: 0.04, snd: 'fire', col: '#d090ff' }), { zMax: 90 }); });
}
// 诅咒人偶的一次性表现（烫脚点火 / 人偶剧场里从画面上方掉下来）：drop = 从天而降，burn = 脚底着火
function enDollFx(x, y, o = {}) {
  addFx({ x, y: y + 0.4, z: 0, dur: o.dur || 0.6, face: o.face || 1, draw(c) {
    const u = this.t, d = this.dur, fall = o.drop ? Math.max(0, 1 - u / 0.25) : 0, z = 380 * fall * fall, a = u > d - 0.15 ? (d - u) / 0.15 : 1, X = sx(this.x), Y = sy(this.y, z);
    c.save(); c.globalAlpha = clamp(a, 0, 1);
    if (!enFrame(c, 'zombiedoll', fall > 0 ? 'fall' : 'idle', X, Y, 0.75, { flip: this.face < 0 })) { c.translate(X, Y); c.scale(this.face * 0.8, 0.8); EN_DOLL_FB.draw(c, { __c: 'idle' }, u); }
    c.restore();
    if (o.burn && !fall) { c.save(); c.globalAlpha = 0.9 * clamp(a, 0, 1); drawSpr(c, fxTint('flame', '#ff8a3a'), X, Y + 2, 34, 40, { ay: 1 }); c.restore(); } } });
}
defSkill('en_rosewhip', { name: '蔷薇藤鞭', cls: 'mage', job: EN, lvReq: 17, mp: 45, cd: 10, type: 'indep', elem: 'dark', col: '#a0203a',
  desc: '挥出荆棘长鞭先向前砸下，再往回一拽，把敌人拉到身前（施放中霸体）。', pow: lv => skillDmg(1.8, 0.18, lv) * 2, ai: { kind: 'poke', r: [40, 280], dy: 24 },
  act: (lv) => ({ name: 'en_rosewhip', clip: 'whip', dur: 0.8, superArmor: true, cancelFrom: 0.62,
    hits: [HB(0.18, 0.26, [20, 320, 40, 0, 150], skillDmg(1.8, 0.18, lv), enH(0, { stun: 0.55, knock: 20, hs: 0.06, col: EN_ROSE })), HB(0.46, 0.54, [20, 320, 40, 0, 150], skillDmg(1.8, 0.18, lv), enH(0, { pull: true, knock: 280, stun: 0.5, hs: 0.05, col: EN_ROSE }))].map((h, i) => ({ ...h, dmg: skillDmg(1.8, 0.18, lv) })),
    events: [evAt(0.14, e => enWhipFx(e, false)), evAt(0.44, e => enWhipFx(e, true))],
    onEnd: e => { if (hasSkill(e, 'en_sinister') && enMissed(e) && e.cool) e.cool.en_rosewhip = Math.min(e.cool.en_rosewhip || 0, 1); } }) });
function enWhipFx(e, back) {
  sfx.swing(!back); const x0 = e.x + e.face * 20, x1 = e.x + e.face * 320;
  addFx({ x: e.x, y: e.y + 1, z: 0, dur: 0.26, back, draw(c) { const k = this.t / this.dur, reach = this.back ? 1 - easeOut(k) : easeOut(Math.min(1, k * 2)), X0 = sx(x0), X1 = sx(lerp(x0, x1, reach)), Y0 = sy(e.y, e.z + 70), Y1 = sy(e.y, this.back ? 30 : Math.max(0, 90 - k * 200));
    if (IMG['fx/enWhip']) { drawSpr(c, 'enWhip', (X0 + X1) / 2, (Y0 + Y1) / 2, Math.abs(X1 - X0) + 20, 76, { add: false, flip: e.face < 0, alpha: 1 - k * 0.5 }); return; }
    enThornLine(c, X0, Y0, X1, Y1, 3, 1); enRose(c, X1, Y1, 5); } });
  if (!back) { fxDust(x1, e.y, 6, 30, '#6a4a4a'); fxShock(x1 - e.face * 60, e.y, 90, EN_ROSE); cam.shake = Math.max(cam.shake, 2); }
}
const enForbBuff = (lv, self) => self ? { t: 300, lv, dmg: 0.05 + 0.006 * lv, ...(enSolo() ? { atk: 0.06 + 0.008 * lv } : {}), self: true, col: EN_CURSE, name: '禁忌诅咒' } : { t: 300, lv, atk: 0.06 + 0.008 * lv, col: EN_CURSE, name: '禁忌诅咒' };
defSkill('en_forbidden', { name: '禁忌诅咒', cls: 'mage', job: EN, lvReq: 18, mp: 100, cd: 10, type: 'indep', buff: true, col: '#7a2aa0',
  desc: '【队伍 BUFF】以坏坏兔为媒介扩散诅咒（抱着兔子向前一步，再高高抛起）：300 秒内 900px 内的队友攻击力大幅提高，自己的技能攻击力提高（单刷时自己也获得队友那份攻击力）。\n副作用：剩下 20 秒起，每 5 秒扣 5% HP（自己和偏爱对象不扣）。',
  infoExtra: lv => [['队友攻击力', '+' + pct(0.06 + 0.008 * lv)], ['自己技能攻击力', '+' + pct(0.05 + 0.006 * lv)]], ai: { kind: 'buff' },
  act: (lv) => ({ name: 'en_forbidden', clip: 'enForb', dur: 1.1, noCounter: true,
    events: [evAt(0.55, e => enForbNow(e, lv))] }) });
function enForbNow(e, lv) { sfx.buff(); fxBurst(e.x, e.y, e.z + 110, 140, EN_CURSE); fxShock(e.x, e.y, 200, EN_CURSE); enBuffParty(e, 900, 'en_forbidden', (t, self) => enForbBuff(lv, self)); }
defSkill('en_guard', { name: '疯熊守护', cls: 'mage', job: EN, lvReq: 18, mp: 40, cd: 10, type: 'indep', elem: 'dark', col: '#6a4a2a', bear: true, cmdNote: undefined,
  desc: '【疯疯熊】疯疯熊扑向最近的敌人砸下，把敌人挑起。你被击中、倒地或被控制时也能施放。', pow: lv => skillDmg(3.6, 0.36, lv), ai: { kind: 'aoe', r: [0, 600], dy: 120 },
  whenHit: () => false, hitStates: ['hit', 'down', 'air', 'held'], req: p => !!nearestFoe(p, EN_GUARD_R) || '范围内没有敌人',   // whenHit 返回 false = 不限制：平时和受击 / 倒地时都能放
  instant: (lv, p, extra) => { const def = EN_MOVES.guard(lv); def.lv = lv;
    if (p.enStage) { if (!p.free && p.st !== 'act') { p.interrupt(); p.stun = 0; } p.doAct({ ...def, name: 'en_guard' }, extra); return; }
    enBearDo(p, def); if (p.free || (p.st === 'act' && p.act && p.act.basic)) p.doAct({ name: 'en_guard', clip: 'enCmd', dur: 0.28, noCounter: true }, extra); } });
defSkill('en_thornspike', { name: '御敌之刺', cls: 'mage', job: EN, lvReq: 18, mp: 45, cd: 10, type: 'indep', elem: 'dark', col: '#4a1a3a', cast: true,
  desc: '前方地面刺出大量荆棘，把范围内的敌人往前聚拢到一处并挑起，附带出血。', pow: lv => skillDmg(3.2, 0.32, lv), ai: { kind: 'aoe', r: [30, 380], dy: 70 },
  act: (lv) => ({ name: 'en_thornspike', clip: 'mdown', dur: 0.6, cancelFrom: 0.45, events: [evAt(0.2, e => enThornSpike(e, lv))] }) });
function enThornSpike(e, lv) {
  sfx.hit('slash', false); sfx.boom(0.3); const x0 = e.x + e.face * 40, x1 = e.x + e.face * 380, cx = e.x + e.face * 210;
  addFx({ x: cx, y: e.y + 1, z: 0, dur: 0.7, draw(c) { const k = this.t / this.dur, g = k < 0.2 ? easeOut(k / 0.2) : k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1; for (let i = 0; i < 11; i++) { const x = lerp(x0, x1, i / 10); enSpikes(c, sx(x), sy(e.y + ((i * 37) % 3 - 1) * 26, 0), 42, 84 - Math.abs(i - 5) * 5, g, i); } } });
  for (const t of ents) if (foe(e, t) && t.invul <= 0 && t.z < 60 && Math.abs(t.y - e.y) < 70 && (t.x - x0) * e.face > -t.w && (t.x - x1) * e.face < t.w) {
    if (!t.boss && t.weight <= 3) { t.x = lerp(t.x, cx, 0.6); t.y = lerp(t.y, e.y, 0.5); }
    applyHit(e, t, enH(skillDmg(3.2, 0.32, lv), { launch: 300, knock: 20, hs: 0.07, downHit: true, onHit: (a, tt) => addStatus(tt, 'bleed', 4, { dps: atkOf(a, 'indep') * 0.05, src: a }) }), { proj: true, src: { x: cx - e.face * 10, y: t.y, z: 0, face: e.face } });
  }
}
defSkill('en_bearfall', { name: '疯疯熊坠击', cls: 'mage', job: EN, lvReq: 19, mp: 55, cd: 12, type: 'indep', elem: 'dark', col: '#8a5a3a', bear: true,
  desc: '【疯疯熊】疯疯熊跳出屏幕，再砸向前方的敌人：落地冲击波把周围的敌人吸到落点并挑起。施放时按住 → 可以落得更远。', pow: lv => skillDmg(4.4, 0.44, lv), ai: { kind: 'aoe', r: [100, 450], dy: 100 },
  act: (lv, p) => enBearSkill(p, 'en_bearfall', lv, l => ({ ...EN_MOVES.fall(l), lv: l })) });
defSkill('en_madcall', { name: '疯狂召唤', cls: 'mage', job: EN, lvReq: 19, mp: 60, cd: 0.5, charges: 2, reload: 20, type: 'indep', elem: 'dark', col: '#6a8a4a',
  desc: '（2 次，每 20 秒补充 1 次）给 900px 内的每个队友贴一个特殊的诅咒人偶（20 秒内攻击力提高），同时放出 5 个僵尸人偶冲向敌人自爆（附带诅咒）。',
  infoExtra: lv => [['队友攻击力', '+' + pct(0.03 + 0.003 * lv)], ['僵尸人偶', `5 × ${pct(skillDmg(0.9, 0.09, lv))}`]], pow: lv => skillDmg(0.9, 0.09, lv) * 5, ai: { kind: 'aoe', r: [0, 500], dy: 120 },
  act: (lv) => ({ name: 'en_madcall', clip: 'summon', dur: 0.55, noCounter: true, events: [evAt(0.22, e => enMadCall(e, lv))] }) });
function enMadCall(e, lv) {
  sfx.magic(); fxSigil('hexagram', e.x, e.y, 0, { w: 120, dur: 0.6, ay: 0.5, grow: [0.4, 1], col: EN_CURSE });
  enBuffParty(e, 900, 'en_madcall', () => ({ t: 20, atk: 0.03 + 0.003 * lv, col: EN_CURSE, name: '诅咒人偶' }));
  for (const t of enParty(e, 900)) summon(e, 'en_curseDoll', { target: t });
  const foes = ents.filter(t => foe(e, t) && t.invul <= 0 && Math.abs(t.x - e.x) < 800).sort((a, b) => Math.abs(a.x - e.x) - Math.abs(b.x - e.x)).slice(0, 5);
  for (let i = 0; i < 5; i++) { const s = summon(e, 'en_doll', { x: e.x + e.face * (24 + i * 6), y: clamp(e.y + (i - 2) * 16, 6, DEPTH - 6), lv, target: foes.length ? foes[i % foes.length] : null }); if (s) { s.face = e.face; fxDust(s.x, s.y, 2, 8, '#6a7a5a'); } }
}
defSkill('en_rosejail', { name: '蔷薇囚狱', cls: 'mage', job: EN, lvReq: 19, mp: 70, cd: 18, type: 'indep', elem: 'dark', col: '#c02a50', cast: true,
  desc: '在前方展开一片荆棘地：里面的敌人被定身约 4.5 秒，脚下不断开出蔷薇造成多段伤害，结束时爆炸把敌人击倒。施放后可以自由行动；再按一次技能键立即引爆。',
  recast: { ok: p => summonsOf(p, 'en_jail').length > 0, instant: true, cd: 0.3, mp: 0, act: (lv, p) => { for (const s of summonsOf(p, 'en_jail')) s.life = Math.min(s.life, s.lifeT + 0.02); } }, pow: lv => skillDmg(0.25, 0.025, lv) * 15 + skillDmg(2.4, 0.24, lv), ai: { kind: 'aoe', r: [60, 320], dy: 60 },
  act: (lv) => ({ name: 'en_rosejail', clip: 'enCmd', dur: 0.45, noCounter: true, events: [evAt(0.15, e => { sfx.magic(); const at = aimAhead(e, 180, 320, 80); summon(e, 'en_jail', { x: at.t ? at.x : e.x + e.face * 180, y: at.t ? at.y : e.y, lv }); })] }) });
defSkill('en_firstaid', { noHitCheck: true, name: '爱之急救', cls: 'mage', job: EN, lvReq: 19, mp: 80, cd: 40, type: 'indep', col: '#ff9ac0', cast: true, noForce: true,
  desc: '给坏坏兔缠上绷带：立即解除 800px 内队友的异常状态，并在脚下展开 800px 的绷带魔法阵，约 8 秒内持续回复阵里的队友。',
  infoExtra: lv => [['每 0.5 秒回复', pct(0.012 + 0.001 * lv) + ' HP'], ['持续', '8 秒']], ai: { kind: 'buff' },
  act: (lv) => ({ name: 'en_firstaid', clip: 'enBandage', dur: 0.8, noCounter: true, events: [evAt(0.35, e => enAidNow(e, lv))] }) });
function enAidNow(e, lv) { sfx.buff(); summon(e, 'en_aid', { x: e.x, y: e.y, lv }); enParty(e, 800).forEach(t => enCleanse(t)); }
defSkill('en_hut', { name: '林中小屋', cls: 'mage', job: EN, lvReq: 20, mp: 60, cd: 50, type: 'indep', elem: 'dark', col: '#4a2a4a', cast: true, noForce: true,
  desc: '在前方长出一座荆棘小屋（20 秒，每张地下城最多 2 次）：队友跳起来落到小屋上就能躲进去，屋里无敌，但小屋每次蠕动会扣 5% HP；按跳跃键出来。靠近小屋的敌人会被荆棘刺中击退。',
  pow: lv => skillDmg(0.35, 0.035, lv) * 18, req: p => (p._enHutN || 0) < 2 || '这张图已经用了 2 次', ai: { kind: 'buff' },
  act: (lv) => ({ name: 'en_hut', clip: 'enCmd', dur: 0.5, noCounter: true, events: [evAt(0.2, e => enHutNow(e, lv))] }) });
function enHutNow(e, lv) {
  e._enHutN = (e._enHutN || 0) + 1; const x = e.x + e.face * 110, y = e.y;
  const go = () => { sfx.magic(); fxDust(x, y, 8, 30, '#5a3a3a'); summon(e, 'en_hut', { x, y, lv }); };
  if (e.enStage) { enDollFx(x, y, { dur: 0.3, drop: true, face: e.face }); game.after(0.26, () => { if (!e.dead) go(); }); } else go();
}
defSkill('en_bigbear', { name: '变大吧！疯疯熊', cls: 'mage', job: EN, lvReq: 20, mp: 120, cd: 45, type: 'indep', elem: 'dark', col: '#b07040', bear: true,
  desc: '【疯疯熊】疯疯熊瞬间变大，对前方狂抓一通再狠狠捶下。期间你无敌约 3 秒，并且可以不做动作直接施放细心缝补和爱之急救；按住 → 疯疯熊会慢慢推进；连按技能键或 X 抓得更快；按跳跃键中断。',
  pow: lv => skillDmg(0.8, 0.08, lv) * 11 + skillDmg(5, 0.5, lv), ai: { kind: 'burst', r: [0, 260], dy: 60 },
  act: (lv, p) => p && p.enStage ? { ...EN_MOVES.big(lv), name: 'en_bigbear' } : { name: 'en_bigbear', clip: 'enCmd', dur: 3.0, invul: true, noCounter: true,
    onStart: e => { const s = enBearDo(e, EN_MOVES.big(lv)); e.act.bear = s; e.act.bAct = s && s.act; },
    update: e => { const a = e.act, s = a.bear; if (e.actT > 0.2 && (!s || s.act !== a.bAct)) e.endAct(); },
    onInput: (e, I) => { const a = e.act, s = a.bear; if (s && s.act === a.bAct && enBigMash(e, s.act, I)) { if (s.act) s.endAct(); e.endAct(); return true; } enQuickCast(e, I, ['en_mend', 'en_firstaid']); return true; } } });
// 变大吧！疯疯熊：连按技能键 / X 让狂抓变快（多段次数不变、提前打完）；按跳跃键中断。返回 true = 中断
function enBigMash(p, a, I) {
  if (!a || !a.bigMadd) return false;
  if (I.buffered('jump')) { I.consume('jump'); if (p.enStage) p.endAct(); return true; }
  const slot = barOf(p).indexOf('en_bigbear');
  if (I.buffered('attack') || (slot >= 0 && I.buffered('s' + slot))) { I.consume('attack'); if (slot >= 0) I.consume('s' + slot); if (a.actT < 2.4) a.spd = Math.min(2.2, a.spd + 0.3); }
  return false;
}
// 不做动作直接施放（变大吧！期间的缝补 / 急救）：扣 MP、进冷却，效果直接生效（再用 partySend 通知其他客户端上的队友）
function enQuickCast(p, I, ids) {
  const bar = barOf(p);
  for (const id of ids) { const i = bar.indexOf(id), S = SKILLS[id]; if (i < 0 || !I.buffered('s' + i) || !skillUsable(p, id) || (p.cool[id] || 0) > 0 || p.mp < S.mp) continue;
    I.consume('s' + i); p.mp -= S.mp; p.cool[id] = S.cd * (p.cdMul || 1); const lv = lvOf(p, id);
    if (id === 'en_mend') enMendNow(p, lv); else enAidNow(p, lv);
    enSend('heal', { pct: id === 'en_mend' ? 0.06 + 0.004 * lv : 0.1 }, p); enSend('cleanse', { n: 9 }, p);
    if (isHuman(p)) { game.onSkill(id); bus.emit('skillUse', { id }); } }
}

/* =====================================================================
   一觉：开幕！人偶剧场 —— 熊拉上帷幕，暗黑少女从上方现身，手指牵线操纵疯疯熊：
   变身期间玩家改为操控熊（普攻 / 熊系技能都由熊出招）、全队 BUFF、受到的伤害降低、免疫异常；
   开场约 3 秒不能动但无敌；国服持续 36 秒并自动放一次疯狂召唤；结束时巨熊撕破幕布，全屏伤害。
   ===================================================================== */
const EN_STAGE_HIT = o => enH(0, { type: 'indep', ...o });
const EN_STAGE_ACTS = {
  atk1: { name: 'atk1', clip: 'bScratch1', dur: 0.4, basic: true, speed: 'aspd', chain: [0.16, 0.4], next: 'atk2', move: [[0.03, 0.1, 110]], hits: [HB(0.1, 0.18, [0, 92, 30, 0, 140], 1.3, EN_STAGE_HIT({ stun: 0.4, knock: 60, hs: 0.05 }))], events: [slashAt(0.08, { a0: -2.2, a1: 0.8, r: 56, w: 10, off: [18, 70], col: '#ffd0a0' })] },
  atk2: { name: 'atk2', clip: 'bScratch2', dur: 0.42, basic: true, speed: 'aspd', chain: [0.16, 0.42], next: 'atk3', move: [[0.03, 0.1, 110]], hits: [HB(0.1, 0.18, [0, 92, 30, 0, 140], 1.4, EN_STAGE_HIT({ stun: 0.42, knock: 60, hs: 0.05 }))], events: [slashAt(0.08, { a0: 1.0, a1: -2.0, r: 56, w: 10, off: [18, 70], col: '#ffd0a0' })] },
  atk3: { name: 'atk3', clip: 'bSlam', dur: 0.58, basic: true, speed: 'aspd', move: [[0.04, 0.14, 120]], hits: [HB(0.2, 0.28, [0, 100, 34, 0, 150], 2.0, EN_STAGE_HIT({ launch: 300, knock: 150, hs: 0.08, shake: 3, snd: 'blunt', last: true }))], events: [evAt(0.2, e => { sfx.boom(0.4); fxShock(e.x + e.face * 60, e.y, 90, '#c8a070'); })] },
  dash: { name: 'dash', clip: 'bPunch', dur: 0.5, basic: true, speed: 'aspd', move: [[0, 0.25, 360]], noCounter: true, hits: [HB(0.06, 0.26, [0, 90, 30, 0, 130], 1.6, EN_STAGE_HIT({ launch: 240, knock: 120, hs: 0.06, snd: 'blunt' }))] },
  jatk: { name: 'jatk', clip: 'bFall', dur: 0.4, basic: true, speed: 'aspd', airOnly: true, lowGrav: 1.3, hits: [HB(0.05, 0.4, [0, 80, 30, -60, 100], 1.3, EN_STAGE_HIT({ spike: 200, knock: 60, hs: 0.05, snd: 'blunt' }))] },
  back: { ...BACKSTEP, clip: 'bLeap' },
};
const EN_IMMUNE_ALL = { burn: 1, poison: 1, bleed: 1, freeze: 1, stun: 1, slow: 1, blind: 1, shock: 1, curse: 1, sleep: 1, root: 1, bind: 1, confuse: 1, taunt: 1 };
const enStageBuff = (lv, k, self) => ({ t: 1.5, atk: (0.08 + 0.01 * lv) * k, aspd: 0.1 * k, mspd: 0.1 * k, cspd: 0.1 * k, ...(self ? {} : { taken: -(0.3 + 0.03 * lv) }), col: '#ff5a9a', name: '人偶剧场' });
function enStageStart(e, lv, o) {
  if (e.enStage) { const St = e.enStage; St.dur = Math.max(St.dur, St.t) + (o.add || 0); St.k = Math.max(St.k, o.k || 1); St.fin = Math.max(St.fin, o.fin || 1); St.lv = Math.max(St.lv, lv); return; }
  e.enStage = { t: 0, dur: o.dur, lv, k: o.k || 1, fin: o.fin || 1, tick: 0 };
  e._enStageSave = { model: e.model, clips: e.clips, acts: e.acts, scale: e.scale, statusImmune: e.statusImmune, h: e.h };
  e.model = enBearModel(true); e.clips = EN_BEAR_CLIPS; e.acts = EN_STAGE_ACTS; e.scale = 1.3; e.statusImmune = EN_IMMUNE_ALL; e.h = 120;
  if (e.act) { const a = e.act; e.act = null; if (a.onEnd) a.onEnd(e, true); } e.setState('idle');
  if (e.status) for (const k in e.status) if (EN_BAD[k]) delete e.status[k];
  const s = enBearOf(e); if (s) { s._enM = s.model; s.model = EN_EMPTY_MODEL; s.shadowR = 0; }
  if (!enHasArt('madbear')) { enLoadArt(); e._enBearLoad = true; }
  e._enPup = addFx({ y: e.y + 0.6, dur: 1e9, ent: e, update() { const E = this.ent; this.y = E.y + 0.6; if (!E.enStage || E.dead) this.t = this.dur; }, draw(c) { enDrawPuppeteer(c, this.ent); } });
}
function enStageTick(e, dt) {
  const St = e.enStage; St.t += dt;
  if (e.dead || ents.indexOf(e) < 0) { enStageEnd(e, false); return; }
  if (e._enBearLoad && enHasArt('madbear')) { e._enBearLoad = false; e.model = enBearModel(true); }
  e.buffs.en_stage = { t: St.dur - St.t, taken: -(0.3 + 0.03 * St.lv), col: '#ff5a9a', name: '人偶剧场（变身）' };
  if ((St.tick -= dt) <= 0) { St.tick = 1; enBuffParty(e, 900, 'en_stageP', (t, self) => enStageBuff(St.lv, St.k, self)); }
  if (e.act && e.act.skill === 'en_awaken2') St.dur = Math.max(St.dur, St.t + 0.5);   // 人偶之森期间剧场不会结束，放完再谢幕
  if (St.t >= St.dur) enStageEnd(e, true);
}
// 再按觉醒键提前谢幕：开场 1.5 秒后；三觉（a3）只在三觉的剧场里生效。AI 只在快结束时才用（避免决斗里一开就收）
function enCanFinale(p, a3) {
  const St = p && p.enStage; if (!St || St.t < 1.5 || (a3 && !(St.a3 !== undefined && St.t - St.a3 > 1.5))) return false;
  if (p.act && p.act.skill && SKILLS[p.act.skill] && SKILLS[p.act.skill].awaken) return false;
  return isHuman(p) || St.t > St.dur - 3;
}
function enStageEnd(e, finale) {
  const St = e.enStage; if (!St) return; e.enStage = null;
  const S0 = e._enStageSave; if (S0) { e.model = S0.model; e.clips = S0.clips; e.acts = S0.acts; e.scale = S0.scale; e.statusImmune = S0.statusImmune; e.h = S0.h; e._enStageSave = null; }
  delete e.buffs.en_stage; if (e.act && EN_STAGE_ACTS[e.act.name] === undefined && /^b[A-Z]/.test(e.act.clip || '')) e.endAct();
  const s = enBearOf(e); if (s && s._enM) { s.model = s._enM; s._enM = null; s.shadowR = s.sdef.shadowR || 20; s.warp(e.x + e.face * 58, e.y); }
  if (!finale || e.dead) return;
  // 谢幕：巨熊撕破幕布，全屏伤害
  enCurtain(e, 1.4, true); sfx.boom(1.2); cam.shake = Math.max(cam.shake, 12); cam.flash = 0.2; cam.flashCol = '#ffd0e8';
  e.invul = Math.max(e.invul, 1.2);
  game.after(0.5, () => { if (!ents.includes(e)) return; for (const t of ents) if (foe(e, t) && t.invul <= 0 && !t.dead)
    applyHit(e, t, enH(skillDmg(24, 6, St.lv) * St.fin, { launch: 520, knock: 200, hs: 0.14, big: 2.4, sure: true, downHit: true, snd: 'blunt', col: EN_ROSE }), { proj: true, src: { x: t.x - e.face * 20, y: t.y, z: 0, face: e.face } }); });
}
// 暗黑少女悬在熊的上方牵线（人偶剧场中）
let EN_PUP_POSE = null;
function enDrawPuppeteer(c, e) {
  const M = e._enStageSave && e._enStageSave.model; if (!M || e.dead) return;
  if (!EN_PUP_POSE) EN_PUP_POSE = Object.assign({}, POSE.mCast, { __c: 'enCmd', __t: 0, __n: 'mCast' });
  const bob = Math.sin(game.t * 2.2) * 5, sc = 0.78, X = sx(e.x - e.face * 8), Y = sy(e.y, e.z + 205 + bob), f = e.face;
  c.save(); c.strokeStyle = 'rgba(240,232,215,.8)'; c.lineWidth = 1.1; c.beginPath();
  for (const [hx, bx] of [[16, -14], [22, 16]]) { c.moveTo(X + f * hx * sc, Y - 78 * sc); c.lineTo(sx(e.x + f * bx * 1.3), sy(e.y, e.z + 118)); }
  c.stroke(); c.translate(X, Y); c.scale(f * sc, sc); M.draw(c, EN_PUP_POSE, game.t); c.restore();
}
// 帷幕：两片暗红幕布从两边合上 / 拉开；rip = 谢幕时被巨熊撕开
function enCurtain(e, dur, rip) {
  addFx({ x: cam.x, y: DEPTH + 400, z: 0, dur, rip, draw(c) {
    const k = this.t / this.dur, cl = this.rip ? (k < 0.3 ? 1 : 1 - easeOut((k - 0.3) / 0.7)) : (k < 0.4 ? easeOut(k / 0.4) : k < 0.6 ? 1 : 1 - easeOut((k - 0.6) / 0.4)), w = WW / 2 * cl;
    if (w <= 1) return;
    c.save(); c.globalAlpha = 0.96;
    for (const side of [0, 1]) { const x0 = side ? WW - w : 0; c.fillStyle = '#5a0a1e'; c.fillRect(x0, 0, w, WH); c.fillStyle = '#3a0612'; for (let x = x0 + 10; x < x0 + w; x += 34) c.fillRect(x, 0, 10, WH); c.fillStyle = '#c8962a'; c.fillRect(side ? x0 : x0 + w - 6, 0, 6, WH); }
    c.fillStyle = '#7a1028'; c.fillRect(0, 0, WW, 36); c.fillStyle = '#c8962a'; c.fillRect(0, 34, WW, 4);
    if (this.rip && k > 0.25 && k < 0.7) { const q = (k - 0.25) / 0.45; c.globalAlpha = 1 - q; c.strokeStyle = '#ffd0a0'; c.lineWidth = 6; c.beginPath(); for (let i = 0; i < 3; i++) { c.moveTo(WW / 2 - 90 + i * 60, 60); c.lineTo(WW / 2 - 160 + i * 60, WH - 40); } c.stroke(); }
    c.restore(); } });
}
defSkill('en_awaken', { name: '开幕！人偶剧场', cls: 'mage', job: EN, tier: 1, lvReq: 21, maxLv: 3, mp: 250, cd: 160, pvp: 0.45, type: 'indep', elem: 'dark', awaken: true, col: '#c0306a',
  desc: '【觉醒】疯疯熊拉上帷幕，暗黑少女从上方现身，用傀儡线操纵疯疯熊（约 3 秒的开场期间无敌）。36 秒内你改为操控疯疯熊：普攻和熊系技能都由熊出招，900px 内的队友攻击力、攻速、移速、施放速度提高，自己受到的伤害降低并免疫异常状态。开场时自动施放一次疯狂召唤。变身期间小魔女的技能照样能用：BUFF / 回复 / 诅咒人偶类技能不做动作直接生效（诅咒人偶从画面上方掉下来），人偶戏法由人偶自己钉；女法的基础技能只能用替身草人。时间到或再按一次技能键时谢幕：巨熊撕破幕布，对全屏敌人造成巨大伤害。',
  pow: lv => skillDmg(24, 6, lv), infoExtra: lv => [['持续', '36 秒（再按技能键提前谢幕）'], ['受到伤害', '-' + pct(0.3 + 0.03 * lv)], ['队友攻击力', '+' + pct(0.08 + 0.01 * lv)]], ai: { kind: 'awaken', r: [0, 400], dy: 120 },
  recast: { ok: p => enCanFinale(p, false), instant: true, cd: 0.5, mp: 0, act: (lv, p) => enStageEnd(p, true) },
  act: (lv) => ({ name: 'en_awaken', clip: 'enBanzai', dur: 2.4, invul: true, superArmor: true, noCounter: true,
    onStart: e => { game.cutin = { t: 0, dur: 1.0, name: '开幕！人偶剧场', who: cutinWho(e) }; game.timeStop = 0.9; sfx.awaken(); enCurtain(e, 2.3, false); },
    events: [evAt(1.2, e => { sfx.boom(0.5); fxBurst(e.x, e.y, 100, 220, EN_ROSE); }), evAt(2.3, e => { enStageStart(e, lv, { dur: 36 }); if (lvOf(e, 'en_madcall') || !isHuman(e)) enMadCall(e, Math.max(1, lvOf(e, 'en_madcall'))); })] }) });

/* =====================================================================
   一觉之后的技能（官方 Lv60～100 → 本作 Lv23～30），含二觉、三觉
   ===================================================================== */
defSkill('en_puppettrick', { name: '人偶戏法', cls: 'mage', job: EN, tier: 1, lvReq: 23, mp: 110, cd: 30, type: 'indep', elem: 'dark', col: '#8a6a3a', cast: true,
  desc: '身前出现一个诅咒人偶，把 700px 内的敌人变成哥布林 / 牛头兽人偶并定住。往诅咒人偶身上钉钉子，每一钉都同时钉进所有敌人人偶（约 4.5 秒钉 6 下，连按 X 钉得更快），最后一钉把敌人打飞。施放中霸体；人偶剧场中由人偶自己钉，不影响操控疯疯熊。',
  pow: lv => skillDmg(0.8, 0.08, lv) * EN_HEX_N + skillDmg(3, 0.3, lv), ai: { kind: 'burst', r: [0, 660], dy: 180 },
  act: (lv) => ({ name: 'en_puppettrick', clip: 'enNail', dur: 8, superArmor: true, noCounter: true,
    onStart: e => { e.act.hex = enHexDoll(e, lv); },
    update: e => { const a = e.act, H = a.hex; if (!H || H.gone) { e.endAct(); return; } if (H.done && (a.endAt ??= e.actT + 0.35) <= e.actT) e.endAct(); },
    onInput: (e, I) => { if (I.buffered('attack')) { I.consume('attack'); enHexMash(e.act.hex); } return false; } }) });
// 诅咒人偶（人偶戏法）：身前的巫毒人偶，钉子钉进它 = 钉进所有被变成人偶的敌人；没人连按时每 0.55 秒自动钉一下
const EN_HEX_N = 6;
function enHexDoll(e, lv) {
  sfx.magic(); fxShock(e.x, e.y, 700, '#c8a070'); fxShock(e.x, e.y, 420, EN_CURSE); fxBurst(e.x + e.face * 40, e.y + 14, 30, 80, EN_CURSE);
  return summon(e, 'en_hexdoll', { x: e.x + e.face * 40, y: e.y + 14, lv });   // 比疯疯熊靠前一点（纵深），不被熊挡住
}
function enHexMash(H) { if (H && !H.gone && !H.done && H.lifeT - H.lastNail >= 0.12) H.next = Math.min(H.next, 0.02); }
defSummon('en_hexdoll', { kind: 'field', life: 9, max: 1, r: 0, tick: 99, keepRoom: false,
  onSpawn(s) { const o = s.owner; s.face = o.face; s.nails = 0; s.next = 0.75; s.lastNail = 0; s.done = false; s.tricks = [];
    s.tg = o.ghost ? [] : ents.filter(t => foe(o, t) && t.invul <= 0 && !t.dead && Math.abs(t.x - o.x) < 700 && Math.abs(t.y - o.y) < 200);
    for (const t of s.tg) { addStatus(t, 'root', 6, { src: o }); const k = summon(o, 'en_trick', { target: t, life: 6 }); if (k) s.tricks.push(k); } },
  update(s, dt) { if (s.done) return; if ((s.next -= dt) <= 0) enHexNail(s); },
  onEnd(s) { for (const t of s.tg) if (t.status && t.status.root) delete t.status.root; for (const k of s.tricks) dismissOne(k, 'cmd'); },
  drawUpright(c, s) { enDrawHex(c, s); } });
function enHexNail(s) {
  const o = s.owner, fin = s.nails >= EN_HEX_N; s.nails++; s.lastNail = s.lifeT; s.next = fin ? 9 : s.nails === EN_HEX_N ? 0.6 : 0.55;
  if (o.act && o.act.hex === s) o.play('enNail', true);
  fxBurst(s.x, s.y, 34, fin ? 110 : 40, fin ? '#ffd0a0' : '#e0c090');
  const alive = s.tg.filter(t => !t.dead && !t.remove);
  if (!fin) { sfx.hit('stab', false); for (const t of alive) { fxSpr(IMG['fx/enNeedle'] ? 'enNeedle' : 'spark', t.x, t.y, t.z + (t.h || 80) * 0.6, { w: 26, dur: 0.3, add: !IMG['fx/enNeedle'] });
      applyHit(o, t, enH(skillDmg(0.8, 0.08, s.lv), { stun: 0.4, knock: 0, hs: 0.04, snd: 'stab', col: '#e0c090' }), { proj: true, src: { x: s.x, y: t.y, z: 0, face: Math.sign(t.x - s.x) || s.face } }); }
    return; }
  // 最后一钉：人偶弹开，敌人变回原样被打飞
  s.done = true; s.life = s.lifeT + 0.5; sfx.boom(0.8); cam.shake = Math.max(cam.shake, 6);
  for (const t of s.tg) if (t.status && t.status.root) delete t.status.root; for (const k of s.tricks) dismissOne(k, 'cmd'); s.tricks = [];
  for (const t of alive) applyHit(o, t, enH(skillDmg(3, 0.3, s.lv), { launch: 380, knock: 260, hs: 0.1, big: 1.6, snd: 'blunt' }), { proj: true, src: { x: s.x, y: t.y, z: 0, face: Math.sign(t.x - s.x) || s.face } });
}
function enDrawHex(c, s) {
  const X = sx(s.x), Y = sy(s.y, 0), u = s.lifeT, a = Math.min(1, u / 0.2, s.done ? (s.life - u) / 0.5 : 1), pop = u < 0.25 ? easeOutBack(u / 0.25) : 1, sh = s.lifeT - s.lastNail < 0.12 ? Math.sin(u * 90) * 2 : 0;
  c.save(); c.globalAlpha = a * 0.5; c.translate(X, Y); c.scale(1, GR); c.rotate(game.t * 0.8); drawSpr(c, fxTint('rune', EN_CURSE), 0, 0, 90, 90); c.restore();
  c.save(); c.globalAlpha = a; c.translate(X + sh, Y); c.scale(pop, pop);
  if (!enFrame(c, 'zombiedoll', 'idle', 0, 0, 1.4, { flip: s.face < 0 })) { c.scale(s.face * 1.4, 1.4); EN_DOLL_FB.draw(c, { __c: 'idle' }, 0); c.scale(s.face / 1.4, 1 / 1.4); }
  c.scale(1.2, 1.2);   // 钉子位置按放大后的人偶算
  // 钉子：银色长钉按顺序钉满全身
  for (let i = 0; i < Math.min(s.nails, EN_HEX_N); i++) { const px = [-8, 7, -3, 9, -10, 2][i] * s.face, py = [-54, -46, -34, -26, -18, -62][i], an = [-0.6, 0.5, -0.3, 0.7, -0.8, 0.1][i] * s.face;
    c.save(); c.translate(px, py); c.rotate(an); c.fillStyle = '#d8dce8'; c.strokeStyle = '#4a4a5a'; c.lineWidth = 1; c.fillRect(-1.2, -16, 2.4, 16); c.strokeRect(-1.2, -16, 2.4, 16); c.beginPath(); c.arc(0, -16, 3, 0, TAU); c.fill(); c.stroke(); c.restore(); }
  c.restore();
}
// 人偶戏法：敌人暂时变成布偶（换成暗淡的哥布林 / 牛头兵模型），结束换回来
defSummon('en_trick', { kind: 'attach', host: 'target', life: 6, max: 30, keepRoom: false,
  onSpawn(s) { const h = s.host, kind = h.weight > 1.5 ? 'tau' : 'goblin'; s.m0 = h.model; if (SPR_DATA[kind] && IMG[`spr/${kind}/idle`]) h.model = new SpriteModel(kind, { ...SPR_FALLBACK, _: 'idle' }, SPR_ANIMS.monster, { sat: 0.35, bright: 1.15 }); fxBurst(h.x, h.y, h.z + 40, 90, '#e0c090'); },
  onEnd(s) { const h = s.host; if (h && s.m0) h.model = s.m0; if (h && !h.dead) fxBurst(h.x, h.y, h.z + 40, 80, '#e0c090'); },
  draw(c, s) { const h = s.host; c.save(); c.strokeStyle = 'rgba(240,232,215,.7)'; c.lineWidth = 1; c.beginPath(); c.moveTo(sx(h.x - 6), sy(h.y, h.z + (h.h || 80))); c.lineTo(sx(h.x - 6), sy(h.y, h.z + (h.h || 80) + 140)); c.moveTo(sx(h.x + 8), sy(h.y, h.z + (h.h || 80) * 0.8)); c.lineTo(sx(h.x + 8), sy(h.y, h.z + (h.h || 80) + 140)); c.stroke(); c.restore(); } });
defSkill('en_lovesting', { name: '爱之刺痛', cls: 'mage', job: EN, tier: 1, lvReq: 23, mp: 100, cd: 30, type: 'indep', elem: 'dark', col: '#c03a6a', cast: true,
  desc: '抱紧坏坏兔，背后长出荆棘藤翼，荆棘像雨一样落在前方（持续引导约 2 秒，霸体；按跳跃键提前结束）。', pow: lv => skillDmg(0.55, 0.055, lv) * 14, ai: { kind: 'aoe', r: [40, 560], dy: 100 },
  act: (lv) => ({ name: 'en_lovesting', clip: 'enHug', dur: 2.5, superArmor: true, noCounter: true,
    onInput: (e, I) => { if (I.buffered('jump') && e.actT > 0.4) { I.consume('jump'); e.endAct(); } return false; },
    update: (e, dt) => { const a = e.act; a.rt = (a.rt || 0) - dt; if (e.actT > 0.35 && e.actT < 2.4 && a.rt <= 0) { a.rt = 0.14; const x = e.x + e.face * rnd(60, 560), y = clamp(e.y + rnd(-80, 80), 4, DEPTH - 4); enThornDrop(e, x, y, lv); }
      if (Math.random() < 0.5) addFx({ x: e.x - e.face * 18, y: e.y - 0.5, z: e.z + 70, dur: 0.05, f: e.face, draw(c) { for (const s of [-1, 1]) enThornLine(c, sx(this.x), sy(this.y, this.z), sx(this.x - this.f * 50), sy(this.y, this.z + 40 + s * 26), 2.5, s); } }); } }) });
function enThornDrop(e, x, y, lv) {
  const T = Math.random() < 0.6 && pick(ents.filter(t => foe(e, t) && !t.dead && (t.x - e.x) * e.face > 20 && Math.abs(t.x - e.x) < 580 && Math.abs(t.y - e.y) < 110)); if (T) { x = T.x + rnd(-24, 24); y = clamp(T.y + rnd(-10, 10), 4, DEPTH - 4); }
  addFx({ x, y: y + 1, z: 0, dur: 0.22, draw(c) { const k = this.t / this.dur, z = 260 * (1 - k); enThornLine(c, sx(this.x - 11), sy(this.y, z + 46), sx(this.x), sy(this.y, z), 4, x); } });
  game.after(0.22, () => { if (e.dead) return; fxDust(x, y, 3, 12, '#6a3a4a'); fxShock(x, y, 60, EN_ROSE); blast(e, x, y, 60, enH(skillDmg(0.55, 0.055, lv), { stun: 0.3, knock: 20, hs: 0.02, col: EN_ROSE }), { zMax: 120 }); });
}
defSkill('en_possession', { name: '永恒的占据', cls: 'mage', job: EN, tier: 1, lvReq: 25, mp: 150, cd: 60, type: 'indep', col: '#d0c0a0', cast: true, noForce: true,
  desc: '傀儡线从天而降，把倒下的队友提起来复活。单人时没有效果。', req: p => !enSolo() || '组队时才能使用', ai: { kind: 'buff' },
  act: (lv) => ({ name: 'en_possession', clip: 'enBanzai', dur: 0.9, noCounter: true, events: [evAt(0.45, e => { sfx.buff(); fxAura(e, '#f0e8d0', 1);
    if (typeof coop !== 'undefined' && coop.mates) for (const g of coop.mates.values()) if (g.dead) { enSend('revive', { uid: g.uid }, e); fxText('复活', g.x, g.y, g.z + 60, { col: '#f0e8d0' }); } })] }) });
defSkill('en_wakaka', { name: '哇咔咔！', cls: 'mage', job: EN, tier: 1, lvReq: 25, mp: 120, cd: 40, type: 'indep', elem: 'dark', col: '#c07030', bear: true,
  desc: '【疯疯熊】疯疯熊把周围 800px 的敌人吸过来，瞬间变大连续咆哮（10 段，最后一声把敌人震飞；你捂住耳朵）。', pow: lv => skillDmg(0.6, 0.06, lv) * 9 + skillDmg(2.1, 0.21, lv), ai: { kind: 'burst', r: [0, 600], dy: 150 },
  act: (lv, p) => p && p.enStage ? { ...EN_MOVES.roar(lv), name: 'en_wakaka' } : { name: 'en_wakaka', clip: 'enEars', dur: 1.2, noCounter: true, onStart: e => enBearDo(e, EN_MOVES.roar(lv)) } });
defSkill('en_garden', { name: '苦痛庭院', cls: 'mage', job: EN, tier: 2, lvReq: 26, mp: 150, cd: 40, type: 'indep', elem: 'dark', col: '#6a1a3a', cast: true,
  desc: '以自身为中心展开约 500px 的荆棘庭院：荆棘连刺 7 段（出血），最后庭院里的蔷薇一齐爆炸；里面的敌人被束缚 3 秒。', pow: lv => skillDmg(0.8, 0.08, lv) * 7 + skillDmg(5.6, 0.56, lv), ai: { kind: 'aoe', r: [0, 480], dy: 180 },
  act: (lv) => ({ name: 'en_garden', clip: 'enBanzai', dur: 0.8, noCounter: true, events: [evAt(0.3, e => { sfx.magic(); fxShock(e.x, e.y, 250, EN_ROSE); summon(e, 'en_garden', { x: e.x, y: e.y, lv }); })] }) });
defSkill('en_roarbear', { name: '咆哮吧！疯疯熊', cls: 'mage', job: EN, tier: 2, lvReq: 26, mp: 160, cd: 45, type: 'indep', elem: 'dark', col: '#7a3a8a', bear: true,
  desc: '【疯疯熊】疯疯熊变成巨熊，向前喷出诅咒吐息（24 段），地面留下 5 秒的紫色诅咒地带：敌人被诅咒，走进来的队友（含自己）禁忌诅咒和偏爱的持续时间 +45 秒。', pow: lv => skillDmg(0.55, 0.055, lv) * 24, ai: { kind: 'burst', r: [0, 600], dy: 80 },
  act: (lv, p) => enBearSkill(p, 'en_roarbear', lv, EN_MOVES.breath) });
defSkill('en_lovecage', { name: '挚爱囚笼', cls: 'mage', job: EN, tier: 3, lvReq: 29, mp: 200, cd: 60, type: 'indep', elem: 'dark', col: '#a01a4a', cast: true,
  desc: '用荆棘编成一座巨大的鸟笼，把前方的敌人关起来“展览”（定身 5 秒，持续伤害）；结束时笼子收缩，把敌人聚到中心并造成巨大伤害。再按一次技能键让笼子立即收缩。',
  recast: { ok: p => summonsOf(p, 'en_cage').some(s => s.life - s.lifeT > 0.5), instant: true, cd: 0.3, mp: 0, act: (lv, p) => { for (const s of summonsOf(p, 'en_cage')) s.life = Math.min(s.life, s.lifeT + 0.5); } }, pow: lv => skillDmg(0.9, 0.09, lv) * 10 + skillDmg(12, 1.2, lv), ai: { kind: 'burst', r: [60, 360], dy: 80 },
  act: (lv) => ({ name: 'en_lovecage', clip: 'enCmd', dur: 0.8, noCounter: true, events: [evAt(0.25, e => { sfx.magic(); const at = aimAhead(e, 200, 360, 90); summon(e, 'en_cage', { x: at.t ? at.x : e.x + e.face * 200, y: at.t ? at.y : e.y, lv }); })] }) });
// 二觉：欢迎光临人偶之森 —— 当前空间变成人偶之森，超巨型疯疯熊扫激光、再挥两次手臂（共 7 段，7 秒，期间无敌）
defSkill('en_awaken2', { name: '欢迎光临人偶之森', cls: 'mage', job: EN, tier: 2, lvReq: 27, maxLv: 3, mp: 400, cd: 180, pvp: 0.4, type: 'indep', elem: 'dark', awaken: true, col: '#5a2a6a',
  desc: '【二觉】把当前空间变成人偶之森：超巨型疯疯熊从森林深处升起，张嘴喷出的诅咒光束来回扫过全屏（5 段），再抡起巨臂砸两次（2 段），共 7 段。持续 7 秒，期间你无敌。在人偶剧场中施放时剧场会一直持续到放完，画面变成巨熊撑破舞台。', pow: lv => skillDmg(9, 2.2, lv) * 7, ai: { kind: 'awaken', r: [0, 500], dy: 150 },
  act: (lv, p) => ({ name: 'en_awaken2', clip: p && p.enStage ? 'bRoar' : 'enHug', dur: 7, invul: true, superArmor: true, noCounter: true,
    onStart: e => { game.cutin = { t: 0, dur: 1.0, name: '欢迎光临人偶之森', who: enCutinWho(e, 2) }; game.timeStop = 0.9; sfx.awaken(); if (e.enStage) enCurtain(e, 1.4, true); enForest(e, 7); },
    events: [1.4, 2.1, 2.8, 3.5, 4.2].map((t0, i) => evAt(t0, e => { sfx.zap && sfx.zap(); cam.shake = Math.max(cam.shake, 5); enHitAll(e, skillDmg(9, 2.2, lv), { stun: 0.6, knock: 30, hs: 0.05, col: EN_CURSE }); }))
      .concat([5.3, 6.3].map((t0, i) => evAt(t0, e => { sfx.boom(1); cam.shake = Math.max(cam.shake, 10); fxShock(cam.x + WW / 2, e.y, 500, '#c8a070'); enHitAll(e, skillDmg(9, 2.2, lv), { launch: i ? 520 : 300, knock: 160, hs: 0.1, big: 2, snd: 'blunt' }); }))) }) });
function enHitAll(e, dmg, o) { for (const t of ents) if (foe(e, t) && t.invul <= 0 && !t.dead) applyHit(e, t, enH(dmg, { sure: true, downHit: true, ...o }), { proj: true, src: { x: t.x - e.face * 20, y: t.y, z: 0, face: e.face } }); }
const enCutinWho = (e, n) => IMG['cutin/' + EN + n] ? { cls: EN + n, model: e.model, x: e.x } : cutinWho(e);
// 屏幕空间画一只巨型疯疯熊（脚底在 X, Y，sc = 放大倍数）；返回嘴的位置（光束从这里喷出）
function enGiantBear(c, frame, X, Y, sc, a) {
  const D = typeof SPR_DATA !== 'undefined' && SPR_DATA.madbear, F = D && (D.frames[frame] || D.frames.idle), im = F && IMG['spr/madbear/' + (D.frames[frame] ? frame : 'idle')];
  c.save(); c.globalAlpha *= a;
  if (F && im) { c.translate(X, Y); c.scale(sc / D.res, sc / D.res); c.drawImage(im, -F.ax, -F.ay); }
  else { c.translate(X, Y); c.scale(sc, sc); EN_BEAR_FB.draw(c, { __c: frame === 'roar' ? 'bRoar' : /slam/.test(frame) ? 'bSlam' : 'idle' }, game.t); }
  c.restore();
  return { x: X + 7 * sc, y: Y - 58 * sc };
}
// 人偶之森（二觉）：森林盖住场景 → 巨熊从下方升起 → 张嘴喷光束来回扫全屏（1.2~4.6 秒）→ 抡臂砸两次（5.3 / 6.3 秒）。时间和技能动作同步（都在 timeStop 之后才走）
function enForest(e, dur) {
  addFx({ x: cam.x, y: -50, z: 0, dur, draw(c) {
    const t = this.t, k = t / this.dur, a = k < 0.12 ? k / 0.12 : k > 0.9 ? (1 - k) / 0.1 : 1; c.save(); c.globalAlpha = 0.82 * a;
    if (IMG['fx/enForest']) drawSpr(c, 'enForest', WW / 2, WH / 2, WW, WH, { add: false });
    else { c.fillStyle = '#1a0a24'; c.fillRect(0, 0, WW, WH); c.fillStyle = '#2a1238'; for (let i = 0; i < 9; i++) { const x = i * 120 - 20, h = 260 + (i % 3) * 60; c.fillRect(x, WH - h, 26, h); c.beginPath(); c.arc(x + 13, WH - h, 60, 0, TAU); c.fill(); } }
    c.restore();
    const rise = t < 0.4 ? 1 : t < 1.2 ? 1 - easeOut((t - 0.4) / 0.8) : 0, bx = WW / 2, by = WH - 30 + rise * WH * 0.75, bs = 3.4 + Math.sin(t * 1.5) * 0.05;
    const fr = t < 1.15 ? 'idle' : t < 4.6 ? 'roar' : t < 5.2 ? 'slam1' : t < 5.75 ? 'slam2' : t < 6.2 ? 'slam1' : 'slam2';
    const M = enGiantBear(c, fr, bx, by, bs, 0.95 * a), gy = sy(e.y, 0);
    // 诅咒光束：嘴 → 地面，来回扫过全屏（每 0.7 秒扫一趟，扫到哪里炸到哪里）
    if (t > 1.2 && t < 4.6) { const q = (t - 1.05) / 0.7, tri = q % 2 < 1 ? q % 1 : 1 - q % 1, gx = WW * (0.04 + 0.92 * tri), fl = 0.85 + 0.15 * Math.sin(t * 40);
      c.save(); c.globalCompositeOperation = 'lighter'; c.lineCap = 'round';
      for (const [w, col, al] of [[46, EN_CURSE, 0.35], [24, '#d890ff', 0.6], [9, '#fff0ff', 0.9]]) { c.globalAlpha = al * a * fl; c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.moveTo(M.x, M.y); c.lineTo(gx, gy); c.stroke(); }
      c.globalAlpha = 0.7 * a; c.fillStyle = '#e0a0ff'; c.beginPath(); c.ellipse(gx, gy, 60 * fl, 18 * fl, 0, 0, TAU); c.fill(); c.beginPath(); c.arc(M.x, M.y, 22 * fl, 0, TAU); c.fill(); c.restore();
      if (Math.random() < 0.5) fxBurst(cam.x + gx, e.y + rnd(-30, 30), 10, 50, EN_CURSE); }
    // 巨臂横扫：两道巨大的爪痕
    for (const t0 of [5.3, 6.3]) if (t > t0 - 0.05 && t < t0 + 0.4) { const q = clamp((t - t0 + 0.05) / 0.45, 0, 1); c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = (1 - q) * a; c.strokeStyle = '#ffe0c0'; c.lineCap = 'round';
      for (let i = 0; i < 3; i++) { c.lineWidth = 16 - i * 3; c.beginPath(); c.arc(bx, by - 120, 360 + i * 38, Math.PI * (1.05 + 0.1 * i), Math.PI * (1.05 + 0.1 * i) + Math.PI * 0.9 * easeOut(q)); c.stroke(); } c.restore(); }
  } });
}
defSkill('en_awaken3', { name: '终幕！人偶剧场', cls: 'mage', job: EN, tier: 3, lvReq: 30, maxLv: 3, mp: 500, cd: 270, pvp: 0.35, type: 'indep', elem: 'dark', awaken: true, col: '#8a0a3a',
  desc: '【三觉】“Prepare... The Final Puppet Show...!”\n长篇舞台：没有在人偶剧场中时施放，进入加强版的人偶剧场（41 秒，全队加成和谢幕伤害更高）。\n短篇舞台：在一觉的人偶剧场中施放（不用再拉幕），剧场延长 20 秒并加强，舞台燃起暗火烧遍全屏（5 段 + 火焰终结），最后巨熊一爪撕开舞台。\n再按一次技能键：立即谢幕。',
  pow: lv => skillDmg(40, 10, lv), ai: { kind: 'awaken', r: [0, 500], dy: 150 },
  recast: { ok: p => enCanFinale(p, true), instant: true, cd: 0.5, mp: 0, act: (lv, p) => enStageEnd(p, true) },
  act: (lv, p) => { const short = !!(p && p.enStage), T = short ? 1.2 : 2.4;
    return { name: 'en_awaken3', clip: short ? 'bRoar' : 'enBanzai', dur: T + 0.2, invul: true, superArmor: true, noCounter: true,
      onStart: e => { game.cutin = { t: 0, dur: 1.1, name: '终幕！人偶剧场', who: enCutinWho(e, 3) }; game.timeStop = 1.0; sfx.awaken(); e.act.short = short; if (!short) enCurtain(e, 2.4, false); },
      events: [evAt(T, e => { if (e.act.short) { enStageStart(e, lv, { add: 20, k: 1.5, fin: 1.6 }); enShortShow(e, skillDmg(20, 5, lv)); }
        else { enStageStart(e, lv, { dur: 41, k: 1.5, fin: 1.7 }); if (lvOf(e, 'en_madcall') || !isHuman(e)) enMadCall(e, Math.max(1, lvOf(e, 'en_madcall'))); }
        if (e.enStage) e.enStage.a3 = e.enStage.t; })] }; } });
// 三觉短篇舞台：暗火从舞台两边烧遍全屏（5 段）→ 火焰终结 → 巨熊一爪撕开舞台（伤害合计 = total）
function enShortShow(e, total) {
  const burn = (i, fin) => { if (!ents.includes(e)) return; sfx.boom(fin ? 1 : 0.4); cam.shake = Math.max(cam.shake, fin ? 9 : 3);
    for (let x = cam.x + 40; x < cam.x + WW; x += fin ? 90 : 150) fxSpr('flame', x + rnd(-30, 30), clamp(e.y + rnd(-60, 60), 4, DEPTH - 4), 0, { w: fin ? 90 : 60, h: fin ? 150 : 90, dur: 0.5, col: '#c060ff', ay: 1 });
    enHitAll(e, total * (fin ? 0.2 : 0.08), fin ? { launch: 300, knock: 60, hs: 0.08, col: '#d090ff', snd: 'fire' } : { stun: 0.4, knock: 10, hs: 0.03, col: '#d090ff', snd: 'fire' }); };
  for (let i = 0; i < 5; i++) game.after(i * 0.18, () => burn(i, false));
  game.after(1.0, () => burn(5, true));
  addFx({ x: cam.x, y: DEPTH + 300, z: 0, dur: 1.1, draw(c) { const t = this.t, a = t < 0.2 ? t / 0.2 : t > 0.85 ? (1.1 - t) / 0.25 : 1, up = t < 0.35 ? 1 - easeOut(t / 0.35) : 0;
    enGiantBear(c, t < 0.5 ? 'slam1' : 'slam2', WW * 0.5, WH - 20 + up * WH * 0.6, 3.1, 0.9 * clamp(a, 0, 1));
    if (t > 0.5 && t < 0.95) { const q = (t - 0.5) / 0.45; c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 1 - q; c.strokeStyle = '#ffe0c0'; c.lineCap = 'round'; for (let i = 0; i < 4; i++) { c.lineWidth = 14 - i * 2; c.beginPath(); c.moveTo(WW * (0.2 + i * 0.18), 30); c.lineTo(WW * (0.1 + i * 0.18) + q * 40, WH - 30); c.stroke(); } c.restore(); } } });
  game.after(1.45, () => { if (!ents.includes(e)) return; sfx.boom(1.2); cam.shake = Math.max(cam.shake, 12); cam.flash = 0.15; cam.flashCol = '#ffd0e8';
    enHitAll(e, total * 0.4, { launch: 460, knock: 160, hs: 0.1, big: 2, col: EN_ROSE, snd: 'blunt' }); });
}

/* =====================================================================
   转职登记、指令、被动刷新、每帧逻辑
   ===================================================================== */
CLASSES.mage.jobs.enchantress = { art: 'job/enchantress', name: '小魔女', role: '辅助 · 人偶', armor: 'plate', awaken: 'en_awaken', awakenName: '暗黑少女', awaken2: 'en_awaken2', awakenName2: '冥月女神', awaken3: 'en_awaken3', awakenName3: '知源·小魔女',
  desc: '用诅咒和人偶术强化队友、削弱敌人的辅助魔法师，身边永远跟着傀儡疯疯熊。组队时为全队带来强力的诅咒 BUFF 和回复；单刷时自动偏爱疯疯熊，攻击力和冷却大幅强化。',
  skills: ['en_rosevine', 'en_broom', 'en_puppeteer', 'en_mend', 'en_scratch', 'en_favor', 'en_curiosity', 'en_rocket', 'en_hotfeet', 'en_rosewhip', 'en_forbidden', 'en_guard', 'en_thornspike',
    'en_bearfall', 'en_madcall', 'en_rosejail', 'en_firstaid', 'en_hut', 'en_bigbear', 'en_girllove', 'en_awaken',
    'en_puppettrick', 'en_lovesting', 'en_possession', 'en_wakaka', 'en_bloom', 'en_garden', 'en_roarbear', 'en_awaken2', 'en_sinister', 'en_lovecage', 'en_awaken3'] };
CLASSES.mage.cmds.push(['fd', 'en_rosevine'], ['dd', 'en_mend', 'buff'], ['dd', 'en_scratch'], ['uf', 'en_favor', 'buff'], ['fdf', 'en_rocket'], ['fu', 'en_hotfeet', 'buff'], ['bdf', 'en_rosewhip'],
  ['ud', 'en_forbidden', 'buff'], ['uu', 'en_guard'], ['udu', 'en_thornspike'], ['uff', 'en_bearfall'], ['udd', 'en_madcall'], ['bff', 'en_rosejail'], ['uu', 'en_firstaid', 'buff'], ['dbd', 'en_hut'],
  ['ddf', 'en_bigbear'], ['uudd', 'en_awaken'], ['dbf', 'en_puppettrick'], ['uud', 'en_lovesting'], ['bu', 'en_possession', 'buff'], ['bdb', 'en_wakaka'], ['ddu', 'en_garden'], ['fbf', 'en_roarbear'],
  ['udf', 'en_lovecage'], ['uddu', 'en_awaken2'], ['duud', 'en_awaken3']);
// 人偶剧场中（官方：操控疯疯熊时能用小魔女的技能、BUFF 和替身草人）：女法的其他基础技能不能用
for (const id of CLASSES.mage.skills) { const S = SKILLS[id]; if (!S || S.passive || id === 'mg_phase') continue; const r0 = S.req; S.req = p => p && p.enStage ? '人偶剧场中不能使用' : r0 ? r0(p) : true; }
// 小魔女的非熊技能在人偶剧场中：BUFF / 回复 / 诅咒人偶类不做动作直接生效（诅咒人偶从画面上方掉到熊旁边）、人偶戏法由人偶自己钉（不锁住熊）；
// 其余技能由熊做一个对应的动作施放
const EN_STAGE_QUICK = { en_forbidden: (e, lv) => { enDollFx(e.x + e.face * 40, e.y, { dur: 0.5, drop: true, face: e.face }); enForbNow(e, lv); }, en_hotfeet: enHotNow,
  en_madcall: (e, lv) => { enDollFx(e.x + e.face * 40, e.y, { dur: 0.5, drop: true, face: e.face }); enMadCall(e, lv); }, en_hut: enHutNow, en_mend: enMendNow, en_firstaid: enAidNow, en_favor: enFavorCast, en_puppettrick: enHexDoll };
const EN_STAGE_CLIP = { mdown: 'bSlam', whip: 'bClaw', enHug: 'bRoar', enBanzai: 'bCheer', enCmd: 'bCheer', enNail: 'bSlam', summon: 'bCheer', enSew: 'bCheer', enBandage: 'bCheer', enForb: 'bCheer' };
for (const id of CLASSES.mage.jobs.enchantress.skills) { const S = SKILLS[id]; if (!S || S.passive || S.bear || S.awaken || S.instant || !S.act) continue; const a0 = S.act;
  S.act = (lv, p) => { if (!p || !p.enStage) return a0(lv, p); const q = EN_STAGE_QUICK[id];
    if (q) return { name: id, clip: 'bCheer', dur: 0.16, noCounter: true, onStart: e => q(e, lv) };
    const A = a0(lv, p); return { ...A, clip: EN_STAGE_CLIP[A.clip] || 'bCheer' }; }; }
// 熊系技能要先学人偶操纵者
for (const id of CLASSES.mage.jobs.enchantress.skills) { const S = SKILLS[id]; if (S && S.bear) { const r0 = S.req; S.req = p => !p || hasSkill(p, 'en_puppeteer') || !isHuman(p) ? (r0 ? r0(p) : true) : '需要学会人偶操纵者'; } }
// 被动刷新（每 0.25 秒）
CLASSES.mage.passives.push(p => {
  if (!enOn(p)) { if (p._enOn) { p._enOn = false; for (const k of ['en_broom', 'en_puppeteer', 'en_curiosity', 'en_girllove', 'en_bloom', 'en_solo']) delete p.buffs[k]; if (p.statusImmune && p.statusImmune.curse && !p.enStage) p.statusImmune = null; } return; }
  p._enOn = true;
  const br = skLv(p, 'en_broom'); setPassive(p, 'en_broom', br > 0, { cspd: 0.3 }); if (br && p.stats) p.hitRate = (p.stats.hitRate || 0) + 0.05;
  const pu = skLv(p, 'en_puppeteer'); setPassive(p, 'en_puppeteer', pu > 0, { atk: 0.02 + 0.01 * pu });
  if (pu) { if (!p.enStage) p.statusImmune = { ...(p.statusImmune || {}), curse: true }; p.atkElem = 'dark'; }
  const cu = skLv(p, 'en_curiosity'); setPassive(p, 'en_curiosity', cu > 0, { dmg: 0.06 + 0.01 * cu, crit: 0.03 + 0.005 * cu });
  const gl = skLv(p, 'en_girllove'); setPassive(p, 'en_girllove', gl > 0, enGirlLove(gl));
  const bl = skLv(p, 'en_bloom'); setPassive(p, 'en_bloom', bl > 0, { dmg: 0.08 + 0.01 * bl });
  // 单刷模式：攻击力 +40%、冷却 −20%（每 0.25 秒多扣一段冷却；觉醒不算）
  const solo = enSolo(); setPassive(p, 'en_solo', solo, { atk: 0.4, name: '单刷模式', col: '#c05a9a' });
  if (solo && p.cool) for (const id in p.cool) { const S = SKILLS[id]; if (p.cool[id] > 0 && S && !S.awaken) p.cool[id] -= 0.25 * 0.25; }
});
// 不祥的微笑：疯疯熊每 30 秒自动替你挡下一次攻击（受击前钩子；保留其他职业文件可能挂上的钩子）
{ const bh0 = CLASSES.mage.beforeHurt;
  CLASSES.mage.beforeHurt = (t, a, h, opt) => {
    const r = bh0 ? bh0(t, a, h, opt) : null; if (r && r.block) return r;
    if (enOn(t) && hasSkill(t, 'en_sinister') && game.t >= (t._enBlockT || 0) && !t.enStage && !h.grab && !h.unblockable) {
      const s = enBearOf(t); if (s && !s.busy) { t._enBlockT = game.t + 30; s.warp(t.x + Math.sign((a.x || t.x) - t.x || t.face) * 30, t.y); summonAct(s, { clip: 'bGuard', dur: 0.5 }); fxGuard(s); fxText('疯熊守护', s.x, s.y, s.z + 110, { col: '#ffd0a0', size: 12 }); return { block: true }; }
    }
    return r;
  }; }

// 本机玩家身上的持续效果：禁忌诅咒的副作用、烫脚、少女的爱光环
function enLocalTick(p, dt) {
  const B = p.buffs;
  const F = B.en_forbidden; if (F && !F.self && !B.en_favored && F.t <= 20 && !p.dead) { F.dr = (F.dr ?? 5) - dt; if (F.dr <= 0) { F.dr = 5; const v = Math.max(0, Math.min(p.hp - 1, Math.round(p.hpMax * 0.05))); if (v) { p.hp -= v; addNumber(v, p.x, p.y, p.z + 40, { player: true }); fxText('诅咒反噬', p.x, p.y, p.z + 60, { col: EN_CURSE, size: 10 }); } } }
  const H = B.en_hotfeet; if (H && !B.en_favored) { const still = p.z <= 0.5 && Math.abs(p.vx) < 1 && Math.abs(p.vy) < 1 && p.st !== 'act'; H.still = still ? (H.still || 0) + dt : 0;
    if (H.still > 0.8) { H.bt = (H.bt || 0) - dt; if (H.bt <= 0) { H.bt = 0.5; const v = Math.max(0, Math.min(p.hp - 1, Math.round(p.hpMax * 0.01))); if (v) { p.hp -= v; addNumber(v, p.x, p.y, p.z + 10, { player: true }); } fxSpr('flame', p.x, p.y, 0, { w: 40, h: 46, dur: 0.4, col: '#ff8a3a', ay: 1 }); } } }
  // 少女的爱：900px 内有小魔女（队友影子也算；影子的技能等级按人物等级估算）
  if (!enOn(p) || !lvOf(p, 'en_girllove')) { let best = 0; for (const e of ents) if (e !== p && e.fighter && !e.dead && e.team === p.team && enOn(e) && Math.abs(e.x - p.x) <= 900) { const lv = e.ghost ? clamp((e.lvl || 1) - 20, 0, 10) : skLv(e, 'en_girllove'); if (lv > best) best = lv; }
    if (best) B.en_girllove = { t: 0.5, ...enGirlLove(best), name: '少女的爱', col: '#e05a8a' }; }
}
let enScanT = 0;
function enTick(dt) {
  for (const e of ents) if (e.fighter && !e.dead && enOn(e) && !e.remove && !enBearOf(e)) enBearSpawn(e);
  for (const e of ents) if (e.enStage) enStageTick(e, dt);
  const p = game.player; if (p && !p.dead && p.buffs) enLocalTick(p, dt);
  if ((enScanT -= dt) <= 0) { enScanT = 0.5; for (const t of ents) if (t.buffs && t.buffs.en_bloom && !(t.buffs.en_bloom.until > game.t)) delete t.buffs.en_bloom; }
}
{ const u0 = updateGroundFx; updateGroundFx = function (dt) { u0(dt); try { enTick(dt); } catch (e) { console.error('小魔女', e); } }; }
// 离开地下城 / 换角色：人偶剧场、小屋状态复原；每张图重置林中小屋次数
function enReset() { for (const e of [game.player, ...ents]) if (e) { if (e.enStage) enStageEnd(e, false); e._enHutN = 0; if (e.enHut) { e.enHut = null; if (e._enHutM) { e.model = e._enHutM; e.shadowR = e._enHutSh; e._enHutM = null; } } } }
if (typeof bus !== 'undefined') { bus.on('dungeonEnter', enReset); bus.on('sceneEnter', enReset); bus.on('jobChange', e => { if (e && e.job === EN) enLoadArt(); }); }

/* ---- 动作片段（骨骼兜底 + 逐帧动画表） ---- */
Object.assign(CLIPS.mage, {
  enCmd: { dur: 0.3, keys: [k(0, POSE.mCast)] }, enStep: { dur: 0.4, keys: [k(0, POSE.mIdle)] }, enBanzai: { dur: 1, keys: [k(0, POSE.mCastUp)] },
  enSew: { dur: 1, keys: [k(0, POSE.mChan)] }, enHug: { dur: 3, keys: [k(0, POSE.mChan)] }, enEars: { dur: 1.5, keys: [k(0, POSE.mCastDown)] },
  enBandage: { dur: 1, keys: [k(0, POSE.mChan)] }, enNail: { dur: 3, keys: [k(0, POSE.mCastUp)] }, enForb: { dur: 1.2, keys: [k(0, POSE.mIdle), k(0.4, POSE.mCastUp)] },
});
// 逐帧动画表在 content/sprites.js 里定义（本文件加载时还没有）：所有文件加载完后再挂上；没有新帧时用相近的旧帧
function enRegAnims() {
  if (typeof SPR_ANIMS === 'undefined' || !SPR_ANIMS.mage || SPR_ANIMS.mage.enCmd) return;
  const F = (typeof SPR_DATA !== 'undefined' && SPR_DATA.mage && SPR_DATA.mage.frames) || {}, or = (n, alt) => F[n] ? n : alt;
  Object.assign(SPR_ANIMS.mage, {
    enCmd: [[or('enCmd', 'cast1'), 0]], enStep: [[or('enStep', 'cheer'), 0]], enBanzai: [[or('enBanzai', 'showtime'), 0]], enSew: [[or('enSew', 'chan1'), 0]],
    enHug: [[or('enHug', 'chan1'), 0]], enEars: [[or('enEars', 'cower'), 0]], enBandage: [[or('enBandage', 'chan2'), 0]], enNail: [[or('enNail', 'castUp1'), 0], [or('enNail', 'castDown2'), 0.45]],
    enForb: [[or('enStep', 'cheer'), 0], [or('enBanzai', 'showtime'), 0.45]] });
}
// 转职后的剧情任务「暗宅的邀请」（官方没有经典转职任务；按调研文档的建议：莎兰指引去冰霜幽暗密林深处的迷雾里找到暗宅）
function enQuests() {
  if (typeof defineQuest !== 'function' || typeof QUESTS === 'undefined' || QUESTS.q_job_ench_house) return;
  defineQuest('q_job_ench_house', { type: 'job', cls: 'mage', name: '人偶之森的暗宅', npc: 'sharan', lvl: 15, job: true, cond: () => game.job === EN, pre: 'q_job_mage_change',
    desc: '莎兰说，你操纵人偶的力量来自魔界博隆克斯的“人偶之森”。去冰霜幽暗密林深处的迷雾里，找到通往暗宅的路。',
    goals: [{ type: 'clear', dungeon: 'frozen_woods', n: 1 }],
    talk: { offer: ['……那只熊，是你自己缝的？', '魔界博隆克斯有一片“人偶之森”，每一棵树都是魔法陷阱，紫色的雾会让人一点点忘记自己。森林中心有一座暗宅——传说濒死的人去过那里之后，都获得了新生。', '冰霜幽暗密林的深处也有同样的紫雾。去看看吧，你的人偶会给你带路。'],
      doing: ['冰霜幽暗密林深处的迷雾……跟着疯疯熊走。'], done: ['当当当当~！', '你找到的不是暗宅，是你自己——一个会把别人做成人偶、再把他们重新唤醒的人。', '别忘了，诅咒也是一种爱。'] },
    reward: typeof QR === 'function' ? QR(15, 0.1, 1200, { items: [QI('elixir', 1)] }) : { gold: 1200 } });
}
if (typeof queueMicrotask === 'function') queueMicrotask(() => { try { enRegAnims(); enQuests(); } catch (e) { console.error('小魔女', e); } });
