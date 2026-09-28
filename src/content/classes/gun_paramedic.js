/* =====================================================================
   转职：协战师（神枪手（女）第 5 转职，辅助；国服 2025-06 上线，见 docs/SKILLS_OFFICIAL_gun.md 第 8 节）
   - 独立攻击（type 'indep'）；没有转职任务：创建角色时直接选，或 Lv.15 在凯丽处直接转职（jobs.paramedic.atCreate / direct）
   - 强袭战斗服（系统常量·战斗服）：进地下城 / 测试场 / 决斗场自动变身，整套换成战斗服帧集 art/final/spr/pmsuit（不显示时装），
     普攻换成 [SCQC] 近身格斗（能量刃横斩 → 上撩斩 → 回旋后踢 → 贴身射击），回城变回来
   - 战场信息：普攻命中 +5%、技能命中 +10~40%（每次施放算一次），满 100% 得 1 层，最多 3 层；机动强化 / 净化 / 缓冲 各耗 1 层，军械强化（进阶）耗 2 层
   - 无动作施放（S.instant）：BUFF 类在任何动作中（技能、觉醒也行）直接放出，不打断当前动作
   - 同步：BUFF / 保护罩全队生效，不看距离、跨房间（net/party_sync.js 的 partyCast，组队刷图时走中继）
   - 保护罩：可叠加的吸伤护盾（总量上限 = 目标最大 HP 60%，限制解除 +10%），没有治疗；强化保护罩 = 受到的伤害 −20% + 霸体
   - 单人专属加成（soloPlay()）：独立攻击 +32%、冷却 −20%、每消耗 1 层信息，分析无人机呼叫一次激光轰炸
   - 基础技能只能学 5 个：后撩踢、浮空弹、钉刺射、刺踢、上旋踢（其余女枪基础技能对协战师加 S.excl）
   ===================================================================== */
const PM = 'paramedic', PM_COL = '#6ad8ff', PM_RED = '#ff8a7a';
const isPM = p => !!p && p.cls === 'gun' && jobOf(p) === PM;
const PM_BASE = ['g_knee', 'g_launch', 'g_stomp', 'g_flash', 'g_spin'];
// 协战师学不了的女枪基础技能（其他转职文件后加的基础技能自己写 only / excl；这里在第一次用到时再补一遍）
function pmExclude() {
  for (const id of CLASSES.gun.skills) { const S = SKILLS[id]; if (!S || S.cls !== 'gun' || S.job || PM_BASE.includes(id)) continue; if (!(S.excl || (S.excl = [])).includes(PM)) S.excl.push(PM); }
}
pmExclude();
sfx.pmZap = function (v = 1) { this.tone('sawtooth', 1400, 500, 0.12, 0.06 * v); this.tone('sine', 900, 1600, 0.1, 0.08 * v); this.noise('highpass', 3000, 800, 0.08, 0.12 * v, 1); };
sfx.pmBeep = function () { this.tone('square', 1320, 1320, 0.05, 0.05); this.tone('square', 1760, 1760, 0.05, 0.04, { delay: 0.07 }); };
sfx.pmBlade = function () { this.tone('sawtooth', 700, 1500, 0.08, 0.05); this.noise('bandpass', 4200, 1400, 0.1, 0.18, 1.2); };

/* ---------------- 战场信息 ---------------- */
const PM_INFO_MAX = 300;
const pmStacks = p => Math.floor((p.pmInfo || 0) / 100);
// 信息获取：技能按冷却折算（冷却越长给得越多，10~40%）
const pmSkillInfo = id => { const S = SKILLS[id]; if (!S || S.buff || S.passive) return 0; return S.pmInfo ?? clamp(Math.round(S.cd * 2.5), 10, 40); };
function pmGain(p, n) {
  if (!isPM(p) || p.dead || !(n > 0)) return;
  const k = 1 + 0.03 * skLv(p, 'pm_info'), s0 = pmStacks(p);
  p.pmInfo = Math.min(PM_INFO_MAX, (p.pmInfo || 0) + n * k);
  if (pmStacks(p) > s0) { fxText('战场信息 +1', p.x, p.y, p.z + 26, { col: PM_COL, size: 11, dur: 0.7 }); if (isHuman(p)) sfx.pmBeep(); }
}
// 消耗层数；单人时每层呼叫一次激光轰炸
function pmSpend(p, n) {
  if (pmStacks(p) < n) return false;
  p.pmInfo -= 100 * n;
  if (soloPlay() && hasSkill(p, 'pm_info')) for (let i = 0; i < n; i++) game.after(0.15 + i * 0.35, () => { if (!p.dead && ents.includes(p)) pmLaser(p); });
  return true;
}
const pmReqStacks = n => p => pmStacks(p) >= n || `战场信息不足（需要 ${n} 层）`;
// 命中收集信息：同一次施放只算一次（普攻按一段动作算一次）。投射物 / 立即判定在 hit 上写 pmTok（通常 = e.act）
function pmOnHit(a, h, act, opt) {
  const tok = h.pmTok || (act && !opt.proj ? act : null); if (!tok || tok._pmG) return;
  const n = h.pmInfo ?? (tok.basic ? 5 : tok.skill ? pmSkillInfo(tok.skill) : 0); if (!n) return;
  tok._pmG = true; pmGain(a, n);
}
{ const h0 = CLASSES.gun.onHit; CLASSES.gun.onHit = function (a, t, h, dmg, act, opt) { if (h0) h0(a, t, h, dmg, act, opt); if (isPM(a)) pmOnHit(a, h, act, opt || {}); }; }
// 单人：激光轰炸（分析无人机标记最强的敌人，天上落下一道激光，4 段范围伤害）
function pmLaser(p) {
  let t = null, best = -1;
  for (const o of ents) if (foe(p, o) && Math.abs(o.x - p.x) < 720 && Math.abs(o.y - p.y) < 260) { const v = (o.boss ? 3e9 : o.elite ? 2e9 : 0) + 1e6 - Math.abs(o.x - p.x); if (v > best) { best = v; t = o; } }
  const x = t ? t.x : p.x + p.face * 160, y = t ? t.y : p.y, lv = Math.max(1, skLv(p, 'pm_info'));
  sfx.pmZap(1.2); pmSkyLaser(x, y, 0.55, 46);
  for (let i = 0; i < 4; i++) game.after(0.08 + i * 0.1, () => { if (p.dead) return; cam.shake = Math.max(cam.shake, 3);
    blast(p, x, y, 72, { dmg: skillDmg(1.5, 0.15, lv), type: 'indep', stun: 0.35, knock: 30, airLift: 160, hs: 0.03, col: '#bff4ff', snd: 'crit', sure: true, downHit: i === 3 }, { zMax: 200 }); });
}
// 从天而降的激光柱（发光贴图 fx/pm_laser；没有素材时用 fx/laser 竖着画）
function pmSkyLaser(x, y, dur = 0.5, w = 40, col = '#9fe8ff') {
  fxShock(x, y, 70, col);
  addFx({ x, y: y + 2, z: 0, dur, add: true, draw(c) {
    const k = this.t / this.dur, X = sx(this.x), Y = sy(this.y, 0), ww = w * (k < 0.12 ? k / 0.12 : 1 - easeIn(Math.max(0, (k - 0.55) / 0.45)) * 0.9);
    if (IMG['fx/pm_laser']) drawSpr(c, 'pm_laser', X, Y + 10, ww * 1.6, Y + 30, { ay: 1, alpha: 1 - k * 0.3 });
    else { c.save(); c.translate(X, Y); c.rotate(-Math.PI / 2); drawSpr(c, fxTint('laser', col), 0, 0, Y + 40, ww, { ax: 0, ay: 0.5 }); c.restore(); }
    drawSpr(c, fxTint('spark', col), X, Y - 4, 90 * (0.7 + k), 0, { alpha: 1 - k });
  } });
}

/* ---------------- 保护罩 ---------------- */
const pmShieldCap = p => 0.6 + (skLv(p, 'pm_limit') > 0 ? 0.1 : 0);
// 全队保护罩（普通，可叠加）
function pmShield(p, id, pct, t) { partyCast('shield', { id, pct, t, cap: pmShieldCap(p) }, p); }
// 全队强化保护罩：受到的伤害 −20%（限制解除 −30%）+ 霸体，外加一层小护盾
function pmRedShield(p, t = 8, pct = 0.03) {
  const dr = 0.2 + (skLv(p, 'pm_limit') > 0 ? 0.1 : 0);
  partyCast('buff', { id: 'pm_red', b: { t, taken: -dr, sa: 1, col: PM_RED, name: '强化保护罩' }, aura: PM_RED }, p);
  partyCast('shield', { id: 'pm_redsh', pct, t, cap: pmShieldCap(p) }, p);
}
// 全队 BUFF（学了“系统常量·同步”才全队；没学只给自己）
function pmParty(p, id, b, aura) {
  const d = { id, b, aura };
  if (hasSkill(p, 'pm_sync') && p === game.player) partyCast('buff', d, p); else partyOn.fx.buff(p, d, null);
}

/* ---------------- 强袭战斗服（变身） ---------------- */
// 战斗服帧集的动画表（帧名见 art/tools/paramedic_art.py；没画的帧自动退回站姿）
let PM_ANIMS = null;
function pmAnims() {
  return PM_ANIMS || (PM_ANIMS = { ...BASE_ANIMS,
    jumpUp: [['jump2', 0]], jumpFall: [['jump3', 0], ['jump4', 0.12]], land: [['jump5', 0]], back: [['jump4', 0]],
    pmA1: [['a1_1', 0], ['a1_2', 0.06]], pmA2: [['a2_1', 0], ['a2_2', 0.07]], pmA3: [['a3_1', 0], ['a3_2', 0.09]], pmA4: [['a4_1', 0], ['a4_2', 0.11]],
    pmDash: [['dash1', 0], ['dash2', 0.06]], pmJatk: [['jatk1', 0], ['jatk2', 0.05], ['jatk3', 0.13]],
    // 5 个基础技能（战斗服版姿势）
    kick: [['kick1', 0], ['kick2', 0.08]], gshot: [['shoot1', 0], ['shoot2', 0.03], ['shoot1', 0.12]], gaim: [['shoot1', 0]], holster: [['shoot1', 0]],
    slide: [['slide1', 0], ['slide2', 0.06]], stomp: [['stomp1', 0], ['stomp2', 0.12]], flashKick: [['kick1', 0], ['flash', 0.06]],
    spinkick: { fps: 12, frames: ['sk1', 'a3_1', 'a3_2'] }, gbuff: [['command', 0]],
    // 协战师技能
    pmShot: { fps: 14, frames: ['shoot2', 'shoot1'] }, pmAim: [['shoot1', 0]], pmSlide: [['slideShot', 0]],
    pmStrike: [['dashKick', 0], ['backKick', 0.2]], pmStrike2: [['a3_1', 0], ['a3_2', 0.06]],
    pmEvade: [['bladeBack', 0], ['shoot1', 0.28], ['shoot2', 0.33], ['shoot1', 0.4], ['shoot2', 0.45]],
    pmRaid: [['raid1', 0], ['raid2', 0.25], ['a1_2', 0.4], ['raid2', 0.55], ['a2_2', 0.7], ['raid1', 0.85], ['a1_2', 1.0]],
    pmBash: [['shieldBash', 0]], pmRay: [['cannon1', 0], ['cannon2', 0.34]], pmCommand: [['command', 0]],
    pmFlip: [['backflip', 0]], pmSwing: [['swing', 0]], pmDeploy: [['deploy', 0]], pmField: [['fieldCast', 0]], pmRush: [['overlimit', 0]],
    pmAwk2: [['awk2a', 0]], pmAwk2b: [['awk2b', 0]], pmDive: [['dive', 0]], pmLand: [['landing', 0]], pmGuard: [['guard', 0]], pmSalute: [['salute', 0]] });
}
// 战斗服用到的片段名补进 CLIPS.gun（时长覆盖所有帧；逐帧动画按片段名选帧）
for (const name of ['pmA1', 'pmA2', 'pmA3', 'pmA4', 'pmDash', 'pmJatk', 'pmShot', 'pmAim', 'pmSlide', 'pmStrike', 'pmStrike2', 'pmEvade', 'pmRaid', 'pmBash', 'pmRay', 'pmCommand',
  'pmFlip', 'pmSwing', 'pmDeploy', 'pmField', 'pmRush', 'pmAwk2', 'pmAwk2b', 'pmDive', 'pmLand', 'pmGuard', 'pmSalute']) CLIPS.gun[name] = name === 'pmShot' ? { dur: 2 / 14, loop: true, keys: [k(0, POSE.gAim)] } : { dur: 3, keys: [k(0, POSE.gAim)] };
const pmSuitReady = () => !!(SPR_DATA.pmsuit && IMG['spr/pmsuit/idle']);
const pmSuitScene = () => game.scene !== 'town' && game.scene !== 'title' && game.scene !== 'none';
// 按需加载战斗服帧集（只加载一次；加载完还不齐就不再重试，保持原模型）
function pmSuitLoad(then) {
  if (pmSuitReady() || !SPR_DATA.pmsuit || pmSuitLoad.tried || typeof loadBundles !== 'function') return;
  pmSuitLoad.tried = true; loadBundles(['spr:pmsuit']).then(() => { if (then && pmSuitReady()) then(); });
}
// 变身 / 变回：换模型（战斗服帧集没有外观层 = 不显示时装、武器画在帧里）和普攻动作表
function pmSuitSync(p) {
  const want = isPM(p) && pmSuitScene();
  if (want && !p._pmSuit) {
    if (!pmSuitReady()) { pmSuitLoad(() => pmSuitSync(p)); return; }
    p._pmNorm = { model: p.model, acts: p.acts };
    p.model = new SpriteModel('pmsuit', SPR_FALLBACK, pmAnims(), isHuman(p) && save.data && save.data.pmAlt ? { hue: 175, bright: 0.82, sat: 1.1 } : {});
    p.acts = PM_ACTS; p._pmSuit = true;
    if (!p.ghost && p.st !== 'act') { fxAura(p, PM_COL, 0.7); if (isHuman(p)) sfx.pmBeep(); }
  } else if (!want && p._pmSuit) {
    p.model = p._pmNorm.model; p.acts = p._pmNorm.acts; p._pmSuit = false; p._pmNorm = null;
  }
}
// [SCQC] 普攻：能量刃横斩 → 上撩斩 → 回旋后踢 → 贴身射击（最后一下击退）；跑攻 = 能量刃突刺；跳攻 = 空中下斩（每跳 2 次）
const pmSlash = (t, o) => slashAt(t, { col: '#8fe8ff', ...o });
function pmMuzzle(e, z = 62, big = 1) {
  addFx({ x: e.x + e.face * 42, y: e.y + 1, z: e.z + z, dur: 0.08, add: true, rot: e.face < 0 ? Math.PI : 0, draw(c) { drawSpr(c, fxTint('muzzle', '#9fe8ff'), sx(this.x), sy(this.y, this.z), 40 * big, 0, { ax: 0.2, rot: this.rot, alpha: 1 - this.t / this.dur }); } });
}
const PM_ACTS = {
  atk1: { name: 'atk1', clip: 'pmA1', dur: 0.34, basic: true, type: 'indep', speed: 'aspd', chain: [0.13, 0.34], next: 'atk2', move: [[0.02, 0.08, 100]],
    hits: [HB(0.06, 0.12, [0, 80, 28, 18, 105], 1.0, { stun: 0.3, knock: 45, hs: 0.055, col: '#bff4ff' })],
    events: [pmSlash(0.05, { a0: -2.3, a1: 0.8, r: 58, w: 14, off: [16, 62], squash: 0.7 }), evAt(0.04, () => sfx.pmBlade())] },
  atk2: { name: 'atk2', clip: 'pmA2', dur: 0.36, basic: true, type: 'indep', speed: 'aspd', chain: [0.14, 0.36], next: 'atk3', move: [[0.02, 0.08, 90]],
    hits: [HB(0.07, 0.13, [0, 76, 28, 18, 125], 1.05, { stun: 0.32, knock: 30, airLift: 200, hs: 0.055, col: '#bff4ff' })],
    events: [pmSlash(0.06, { a0: 1.2, a1: -2.0, r: 56, w: 14, off: [12, 60], squash: 0.85 }), evAt(0.05, () => sfx.pmBlade())] },
  atk3: { name: 'atk3', clip: 'pmA3', dur: 0.42, basic: true, type: 'indep', speed: 'aspd', chain: [0.2, 0.42], next: 'atk4', move: [[0.04, 0.12, 120]],
    hits: [HB(0.09, 0.16, [-10, 84, 30, 20, 100], 1.2, { stun: 0.45, knock: 150, hs: 0.07, snd: 'blunt', shake: 2 })],
    events: [evAt(0.07, () => sfx.swing(true))] },
  atk4: { name: 'atk4', clip: 'pmA4', dur: 0.48, basic: true, type: 'indep', speed: 'aspd', move: [[0.02, 0.08, 60]],
    events: [evAt(0.11, e => { pmMuzzle(e, 62, 1.4); sfx.gun(1.3); cam.shake = Math.max(cam.shake, 3);
      instantHit(e, { box: [10, 150, 24, 36, 100], dmg: 1.7, stun: 0.55, knock: 240, heavy: true, hs: 0.09, big: 1.4, snd: 'stab', col: '#bff4ff' }); })] },
  dash: { name: 'dash', clip: 'pmDash', dur: 0.46, basic: true, type: 'indep', speed: 'aspd', move: [[0, 0.28, 440]], noCounter: true,
    hits: [HB(0.04, 0.28, [0, 66, 26, 28, 95], 1.35, { stun: 0.45, knock: 230, hs: 0.07, shake: 2, heavy: true, col: '#bff4ff' })],
    events: [evAt(0.03, e => { fxStreak({ x: e.x, y: e.y, z: e.z + 60, face: e.face, len: 90, w: 10, col: '#8fe8ff' }); sfx.pmBlade(); })] },
  jatk: { name: 'jatk', clip: 'pmJatk', dur: 0.3, basic: true, type: 'indep', speed: 'aspd', airOnly: true, lowGrav: 0.6, chain: [0.15, 0.3], next: 'jatk',
    hits: [HB(0.05, 0.14, [0, 72, 26, -40, 80], 0.9, { stun: 0.3, knock: 40, airLift: 90, hs: 0.05, col: '#bff4ff' })],
    events: [pmSlash(0.04, { a0: -1.6, a1: 1.3, r: 50, w: 12, off: [10, 40], squash: 0.9 }), evAt(0.03, () => sfx.pmBlade())] },
  back: BACKSTEP,
};
// 战斗服的跳攻上限：每跳 2 次（按武器算的跳射上限只在没变身时生效）
{ const f0 = CLASSES.gun.airMaxOf; CLASSES.gun.airMaxOf = p => p._pmSuit ? 2 : f0 ? f0(p) : 1; }

/* ---------------- 每 0.25 秒：变身、系统被动、信息显示、单人加成、光环 ---------------- */
const PM_AUTO = [['pm_suit', 1], ['pm_sync', 15], ['pm_info', 15]];   // 系统被动：到等级自动学会（0 SP）
function pmPassive(p) {
  if (!isPM(p)) { if (p._pmSuit) pmSuitSync(p); return; }
  if (isHuman(p) && game.skillLv) for (const [id, L] of PM_AUTO) if (game.lvl >= L && !(game.skillLv[id] > 0)) game.skillLv[id] = 1;
  pmSuitSync(p);
  const solo = soloPlay(), lvSync = skLv(p, 'pm_sync');
  setPassive(p, 'pm_sync', lvSync > 0, { atk: 0.04 + 0.01 * (lvSync - 1), col: PM_COL });
  // 战场信息：图标显示层数；单人时独立攻击 +32%（atk 对独立攻击同样生效）
  if (hasSkill(p, 'pm_info')) p.buffs.pm_info = { t: 0.4, passive: true, n: pmStacks(p), atk: solo ? 0.32 : 0, col: PM_COL };
  else delete p.buffs.pm_info;
  // 单人：冷却 −20%（recalcStats 重算后重新乘上）
  if (p.stats !== p._pmCdRef || p._pmCdSolo !== solo) { if (p.stats !== p._pmCdRef) { p._pmCdRef = p.stats; p._pmCdBase = p.cdMul || 1; } p._pmCdSolo = solo; p.cdMul = (p._pmCdBase || 1) * (solo && hasSkill(p, 'pm_info') ? 0.8 : 1); }
  if (p._pmSuit && isHuman(p)) pmPips(p);
  if (p._pmSuit && hasSkill(p, 'pm_info') && typeof summon === 'function' && !summonsOf(p, 'pm_drone').length) summon(p, 'pm_drone', { lv: 1 });
  // 系统·作战应对：全队光环（每秒广播一次，队友在别的房间也生效）
  const lt = skLv(p, 'pm_tactic');
  if (lt > 0 && pmSuitScene() && game.t - (p._pmAuraT || -9) > 1) { p._pmAuraT = game.t;
    pmParty(p, 'pm_tactic', { t: 1.6, aspd: 0.03 + 0.005 * (lt - 1), mspd: 0.03 + 0.005 * (lt - 1), atk: 0.02 + 0.004 * (lt - 1), col: PM_COL }); }
}
CLASSES.gun.passives = CLASSES.gun.passives || [];
CLASSES.gun.passives.push(pmPassive);
// 队友影子（组队刷图）：也换成战斗服
partyAura(PM, src => { if (src.ghost) pmSuitSync(src); });
if (typeof bus !== 'undefined') {
  bus.on('dungeonEnter', () => { const p = game.player; if (isPM(p)) { p.pmInfo = 0; pmSuitSync(p); } });
  bus.on('sceneEnter', () => { const p = game.player; if (p && p._pmSuit) pmSuitSync(p); if (isPM(p)) pmSuitLoad(); });
  bus.on('jobChange', e => { const p = game.player; if (e && e.job === PM && p) { pmExclude(); pmSuitLoad(); pmPassive(p); } });
}
// 头顶的信息槽：3 个六边形，按百分比填充
function pmPips(p) {
  if (p._pmPipFx && fxList.indexOf(p._pmPipFx) >= 0) return;
  p._pmPipFx = addFx({ ent: p, y: p.y, dur: 1e9, update() { const e = this.ent; this.y = e.y + 0.6; if (!e._pmSuit || e.dead || game.player !== e) this.t = this.dur; },
    draw(c) { const e = this.ent, v = e.pmInfo || 0, X = sx(e.x), Y = sy(e.y, e.z + 128);
      c.save(); c.lineWidth = 1.5;
      for (let i = 0; i < 3; i++) { const f = clamp((v - i * 100) / 100, 0, 1), cx = X + (i - 1) * 13;
        c.beginPath(); for (let j = 0; j < 6; j++) { const a = Math.PI / 6 + j * Math.PI / 3; c.lineTo(cx + Math.cos(a) * 5.5, Y + Math.sin(a) * 5.5); } c.closePath();
        c.fillStyle = 'rgba(10,20,40,.55)'; c.fill();
        if (f > 0) { c.save(); c.clip(); c.fillStyle = f >= 1 ? '#8ff0ff' : '#3a8ab0'; c.fillRect(cx - 6, Y + 6 - 12 * f, 12, 12 * f); c.restore(); }
        c.strokeStyle = f >= 1 ? '#dffaff' : 'rgba(160,220,255,.7)'; c.stroke(); }
      c.restore(); } });
}
// 分析无人机：挂在自己肩后浮动（跨房间），单人时负责激光轰炸
defSummon('pm_drone', { kind: 'attach', host: 'owner', life: 1e9, keepRoom: true, max: 1, tags: ['pm'], col: PM_COL,
  draw(c, s) { const o = s.owner; if (!o || !o._pmSuit) return; const bob = Math.sin(game.t * 3) * 4, X = sx(o.x - o.face * 30), Y = sy(o.y - 0.5, o.z + 118 + bob);
    if (IMG['fx/pm_drone']) drawSpr(c, 'pm_drone', X, Y, 30, 0, { add: false, flip: o.face < 0 });
    else { c.save(); c.translate(X, Y); c.fillStyle = '#e8eef4'; c.strokeStyle = '#1e2a44'; c.lineWidth = 1.5; c.beginPath(); c.ellipse(0, 0, 10, 5, 0, 0, TAU); c.fill(); c.stroke();
      c.fillStyle = Math.floor(game.t * 4) % 2 ? PM_COL : '#2a6a8a'; c.beginPath(); c.arc(o.face * 4, 0, 2.2, 0, TAU); c.fill(); c.restore(); } } });

/* ---------------- 技能 ---------------- */
// 协战师的直线射击（能量手枪，立即命中）：画一道光迹，打第一个挡在前面的敌人
function pmShot(e, t, dmg, o = {}) {
  const z = e.z + (o.z || 62); pmMuzzle(e, o.z || 62); if (!o.quiet) sfx.gun(o.vol || 0.9);
  const tx = t ? t.x : e.x + e.face * 420, ty = t ? t.y : e.y, tz = t ? t.z + t.hurtH() * 0.6 : z;
  addFx({ x: e.x + e.face * 40, y: Math.max(e.y, ty) + 1, z, tx, ty, tz, dur: 0.09, add: true, draw(c) { const k = this.t / this.dur; c.save(); c.globalCompositeOperation = 'lighter'; c.strokeStyle = `rgba(150,235,255,${1 - k})`; c.lineWidth = 3; c.beginPath(); c.moveTo(sx(this.x), sy(this.y, this.z)); c.lineTo(sx(this.tx), sy(this.ty, this.tz)); c.stroke(); c.restore(); } });
  if (t && hittable(e, t)) applyHit(e, t, { dmg, stun: 0.3, knock: 30, airLift: 130, hs: 0.04, snd: 'stab', col: '#bff4ff', sure: true, pmTok: e.act, ...(o.hit || {}) }, { proj: true });
}
// 前方最近的敌人（range 内）
function pmNearest(e, range, dy = 90) { let best = null, bd = 1e9; for (const o of ents) if (hittable(e, o) && (o.x - e.x) * e.face > -20 && Math.abs(o.x - e.x) < range && Math.abs(o.y - e.y) < dy) { const d = Math.abs(o.x - e.x) + Math.abs(o.y - e.y); if (d < bd) { bd = d; best = o; } } return best; }
const pmSkill = (id, S) => defSkill(id, { cls: 'gun', job: PM, type: 'indep', ...S });
// 无动作施放的 BUFF：instant(lv, p)；air = 空中也能放；noForce 由 instant 绕过（canCancelInto 对 instant 直接放行）
const pmBuff = (id, S) => pmSkill(id, { buff: true, air: true, ai: { kind: 'buff' }, ...S });

// ---- 系统（被动） ----
pmSkill('pm_suit', { name: '系统常量·战斗服', lvReq: 1, maxLv: 1, sp: 0, passive: true, col: '#3a5a8a', cmdNote: '自动',
  desc: '【被动】进入地下城时自动穿上强袭战斗服：普通攻击变为 [SCQC] 近身格斗——能量刃横斩、上撩斩、回旋后踢，最后贴身射击把敌人打飞；跑攻是能量刃突刺，跳攻是空中下斩（每跳 2 次）。战斗服里不显示时装。普通攻击命中时收集 5% 战场信息。' });
pmSkill('pm_sync', { name: '系统常量·同步', lvReq: 15, sp: 0, passive: true, col: '#3a8ab0',
  desc: '【被动】与队员的作战系统同步：自己的攻击力提高；协战师的 BUFF 和保护罩对全队生效——不看距离，队员在别的房间也一样。', infoExtra: lv => [['攻击力', '+' + pct(0.04 + 0.01 * (lv - 1))], ['BUFF 范围', '全队（跨房间）']] });
pmSkill('pm_info', { name: '系统·战场信息', lvReq: 15, sp: 0, passive: true, col: '#2a9ad8',
  desc: '【被动】攻击时收集战场信息：普通攻击命中 +5%，技能命中 +10~40%（冷却越长的技能越多，每次施放算一次）。满 100% 得 1 层，最多 3 层；机动强化、保护模件消耗层数。分析无人机随行。\n单人作战时（没有组队）获得专属加成：独立攻击力 +32%、技能冷却 −20%，并且每消耗 1 层信息，分析无人机呼叫一次激光轰炸。',
  infoExtra: lv => [['信息收集量', '+' + pct(0.03 * lv)], ['激光轰炸', pct(skillDmg(1.5, 0.15, lv)) + ' × 4'], ['单人加成', '独立攻击 +32% / 冷却 −20%']] });
// ---- 攻击 ----
pmSkill('pm_lockshot', { name: '近战·锁定连射', lvReq: 5, lvStep: 2, sp: 20, mp: 12, cd: 3, col: '#4aa0d8', pmInfo: 10,
  desc: '锁定前方最近的敌人（远距离也能锁定），快速连开 2 枪。', pow: lv => skillDmg(1.1, 0.11, lv) * 2, ai: { kind: 'poke', r: [0, 600], dy: 60 },
  act: (lv) => ({ name: 'pm_lockshot', clip: 'pmShot', dur: 0.34, noCounter: true,
    onStart: e => { const t = pmNearest(e, 640, 120); e.act.tg = t; if (t) e.face = t.x >= e.x ? 1 : -1; },
    events: [0.05, 0.16].map(tt => evAt(tt, e => pmShot(e, e.act.tg && !e.act.tg.dead ? e.act.tg : pmNearest(e, 640, 120), skillDmg(1.1, 0.11, lv)))) }) });
pmSkill('pm_assault', { name: '战服·强袭目标', lvReq: 15, mp: 30, cd: 6, col: '#3a7ac8', pmInfo: 20,
  desc: '单膝跪地向前滑行，边滑边连开 5 枪。施放后全队获得 8 秒强化保护罩（受到的伤害 −20%、霸体，外加一层小护盾）。', pow: lv => skillDmg(0.68, 0.068, lv) * 5, ai: { kind: 'poke', r: [0, 420], dy: 30 },
  infoExtra: () => [['强化保护罩', '8 秒']],
  act: (lv) => ({ name: 'pm_assault', clip: 'pmSlide', dur: 0.62, noCounter: true, move: [[0.02, 0.45, 300]],
    update: e => { if (e.actT < 0.45 && Math.random() < 0.6) fxDust(e.x - e.face * 12, e.y, 1, 5); },
    events: [...[0.08, 0.16, 0.24, 0.32, 0.4].map((tt, i) => evAt(tt, e => pmShot(e, pmNearest(e, 460, 40), skillDmg(0.68, 0.068, lv), { quiet: i % 2 === 1, hit: { stun: 0.35, knock: 60 } }))),
      evAt(0.45, e => pmRedShield(e))] }) });
// 机动打击：突进 → 回旋后踢；命中后再按一次追加第二击（学了“系统·临战编程”自动追加）
function pmStrike2(lv) {
  return { name: 'pm_strike2', clip: 'pmStrike2', dur: 0.42, noCounter: true, move: [[0, 0.1, 80]],
    hits: [HB(0.06, 0.14, [-10, 86, 30, 0, 110], skillDmg(2.2, 0.22, lv), { down: true, knock: 220, hs: 0.1, shake: 3, big: 1.4, snd: 'blunt', col: '#bff4ff' })],
    events: [evAt(0.05, () => sfx.swing(true))] };
}
pmSkill('pm_strike', { name: '战服·机动打击', lvReq: 16, mp: 35, cd: 8, col: '#2a6ab8',
  desc: '推进器点火向前突进，接一记回旋后踢把敌人踢上天。命中后再按一次技能键追加一记下劈踢（学会“系统·临战编程”后自动追加）。', pow: lv => skillDmg(3.4, 0.34, lv) + skillDmg(2.2, 0.22, lv), ai: { kind: 'gap', r: [40, 280], dy: 22 },
  act: (lv, p) => ({ name: 'pm_strike', clip: 'pmStrike', dur: 0.62, noCounter: true, superArmor: [0, 0.2], move: [[0, 0.2, 520]],
    follow: e => e.hitsDone.size ? pmStrike2(lv) : null, followWin: [0.3, 0.62],
    hits: [HB(0.24, 0.32, [-10, 90, 30, 20, 130], skillDmg(3.4, 0.34, lv), { launch: 420, knock: 80, hs: 0.08, shake: 3, big: 1.3, snd: 'blunt', col: '#bff4ff' })],
    update: e => { if (e.actT < 0.2) { if (Math.random() < 0.7) fxDust(e.x - e.face * 16, e.y, 1, 6, '#9fd8ff');   // 突进到敌人面前就停，接回旋踢
      if (e.act.move && ents.some(t => foe(e, t) && !t.dead && (t.x - e.x) * e.face > 0 && (t.x - e.x) * e.face < 64 && Math.abs(t.y - e.y) < 26)) { e.act.move = null; e.vx = 0; } } },
    events: [evAt(0.02, () => { sfx.jump(); sfx.pmZap(0.5); }), evAt(0.22, () => sfx.swing(true)),
      // 系统·临战编程：命中后自动追加第二击（走 follow，联机时队友那边的影子也重放第二击）
      evAt(0.4, e => { const a = e.act; if (hasSkill(e, 'pm_program') && e.hitsDone.size && a && a.follow && !e.ghost) { const nx = a.follow(e); if (nx) e.doAct(nx, { skill: a.skill, lv: a.lv, key: a.key, type: a.type }); } })] }) });
pmSkill('pm_evade', { name: '近战·闪退射击', lvReq: 17, mp: 25, cd: 6, col: '#4a8ad8',
  desc: '挥出能量刃同时向后跳开，落地前再对前方的敌人连开 2 枪。学会“系统·临战编程”后，施放时给全队一层保护罩。', pow: lv => skillDmg(1.6, 0.16, lv) + skillDmg(1.3, 0.13, lv) * 2, ai: { kind: 'escape', r: [0, 90], dy: 26 },
  act: (lv) => ({ name: 'pm_evade', clip: 'pmEvade', dur: 0.62, noCounter: true, move: [[0.04, 0.3, -300, 180]],
    hits: [HB(0.02, 0.1, [-10, 88, 30, 10, 110], skillDmg(1.6, 0.16, lv), { stun: 0.45, knock: 120, hs: 0.06, col: '#bff4ff' })],
    onLand: e => { e.vx = 0; },
    events: [pmSlash(0.02, { a0: -2.4, a1: 0.9, r: 60, w: 15, off: [14, 62], squash: 0.75 }), evAt(0.02, e => { sfx.pmBlade(); if (hasSkill(e, 'pm_program')) pmShield(e, 'pm_buffer', 0.05, 10); }),
      ...[0.3, 0.42].map(tt => evAt(tt, e => pmShot(e, pmNearest(e, 520, 80), skillDmg(1.3, 0.13, lv))))] }) });
// 指定射击：按怪物等级（领主 > 精英 > 等级高的）再按距离锁定，连开 6 枪
function pmMarkTarget(e) {
  let best = null, bv = -1;
  for (const o of ents) if (hittable(e, o) && Math.abs(o.x - e.x) < 620 && Math.abs(o.y - e.y) < 160) { const v = (o.boss ? 3 : o.elite ? 2 : 1) * 1e6 + (o.lvl || 1) * 1e3 - Math.abs(o.x - e.x); if (v > bv) { bv = v; best = o; } }
  return best;
}
pmSkill('pm_mark', { name: '近战·指定射击', lvReq: 18, mp: 40, cd: 10, col: '#5a9ae8',
  desc: '锁定一个目标（优先领主和精英，其次等级高的，再其次距离近的），连开 6 枪，暴击率提高。', pow: lv => skillDmg(1.0, 0.1, lv) * 6, ai: { kind: 'burst', r: [0, 600], dy: 120 },
  act: (lv) => ({ name: 'pm_mark', clip: 'pmShot', dur: 0.95, noCounter: true, superArmor: [0, 0.95],
    onStart: e => { const t = pmMarkTarget(e); e.act.tg = t; if (t) { e.face = t.x >= e.x ? 1 : -1; pmReticle(t); } sfx.pmBeep(); },
    events: [0.2, 0.3, 0.4, 0.5, 0.6, 0.7].map((tt, i) => evAt(tt, e => { const t = e.act.tg && !e.act.tg.dead ? e.act.tg : pmMarkTarget(e); if (t) e.face = t.x >= e.x ? 1 : -1; pmShot(e, t, skillDmg(1.0, 0.1, lv), { quiet: i % 2 === 1, hit: { critBonus: 0.2, stun: 0.3, knock: 20 } }); })) }) });
function pmReticle(t) { addFx({ ent: t, y: t.y + 3, dur: 0.9, draw(c) { const e = this.ent, X = sx(e.x), Y = sy(e.y, e.z + e.hurtH() * 0.6), r = 12 + (1 - Math.min(1, this.t / 0.25)) * 14; c.save(); c.strokeStyle = '#8ff0ff'; c.lineWidth = 2; c.beginPath(); c.arc(X, Y, r, 0, TAU); c.moveTo(X - r - 5, Y); c.lineTo(X - r + 5, Y); c.moveTo(X + r - 5, Y); c.lineTo(X + r + 5, Y); c.moveTo(X, Y - r - 5); c.lineTo(X, Y - r + 5); c.moveTo(X, Y + r - 5); c.lineTo(X, Y + r + 5); c.stroke(); c.restore(); } }); }
// 爆刃突袭：能量刃把前方的敌人拉到身前连斩，最后沿直线回到原位；施放中无敌
pmSkill('pm_raid', { name: '近战·爆刃突袭', lvReq: 19, mp: 55, cd: 15, col: '#3a6ad8',
  desc: '伸长能量刃把前方的敌人拉到身前，一阵连斩后最后一击把敌人斩飞，然后沿直线退回原来的位置。施放中无敌。', pow: lv => skillDmg(1.0, 0.1, lv) + skillDmg(0.9, 0.09, lv) * 5 + skillDmg(2.5, 0.25, lv), ai: { kind: 'burst', r: [0, 240], dy: 40 },
  act: (lv) => ({ name: 'pm_raid', clip: 'pmRaid', dur: 1.35, noCounter: true, invul: [0, 1.35],
    onStart: e => { e.act.ox = e.x; e.act.oy = e.y; },
    events: [evAt(0.05, e => { sfx.pmBlade(); fxStreak({ x: e.x, y: e.y, z: e.z + 62, face: e.face, len: 260, w: 12, col: '#8fe8ff', dur: 0.25 });
        for (const t of ents) if (hittable(e, t) && (t.x - e.x) * e.face > -10 && Math.abs(t.x - e.x) < 280 && Math.abs(t.y - e.y) < 50) {
          if (!t.boss && !t.noGrab && t.weight <= 2.2) { t.x = e.x + e.face * rnd(40, 60); t.y = clamp(lerp(t.y, e.y, 0.7), 4, DEPTH - 4); }
          applyHit(e, t, { dmg: skillDmg(1.0, 0.1, lv), stun: 0.8, knock: 0, hs: 0.04, sure: true, col: '#bff4ff', pmTok: e.act }, { proj: true }); } }),
      ...[0.3, 0.45, 0.6, 0.75, 0.9].map((tt, i) => evAt(tt, e => { sfx.pmBlade(); fxSlashOn(e, { a0: i % 2 ? 1.1 : -2.2, a1: i % 2 ? -2.0 : 0.9, r: 60, w: 14, off: [16, 60], squash: 0.7, col: '#8fe8ff' });
        instantHit(e, { box: [-20, 110, 34, 0, 130], dmg: skillDmg(0.9, 0.09, lv), stun: 0.6, knock: 5, airLift: 60, hs: 0.035, col: '#bff4ff' }); })),
      evAt(1.05, e => { sfx.pmBlade(); cam.shake = 5; fxSlashOn(e, { a0: -2.8, a1: 1.2, r: 76, w: 22, off: [10, 58], squash: 0.9, col: '#dffaff', heavy: true });
        instantHit(e, { box: [-20, 130, 36, 0, 140], dmg: skillDmg(2.5, 0.25, lv), launch: 460, knock: 160, hs: 0.1, big: 1.5, col: '#dffaff' }); }),
      evAt(1.15, e => { fxAfterimage(e, '#6ad8ff'); const x0 = e.x, y0 = e.y; e.warp(e.act.ox, e.act.oy); fxStreak({ x: Math.min(x0, e.x), y: e.y, z: e.z + 50, face: 1, len: Math.abs(x0 - e.x), w: 8, col: '#8fe8ff', dur: 0.2 }); })] }) });
// 护盾冲击：展开护盾向前冲撞；施放后全队强化保护罩
function pmHexShield(e, dur) {
  addFx({ ent: e, y: e.y + 1, dur, add: true, draw(c) { const o = this.ent, k = this.t / this.dur, X = sx(o.x + o.face * 44), Y = sy(o.y, o.z + 58), a = k < 0.15 ? k / 0.15 : k > 0.8 ? (1 - k) / 0.2 : 1;
    if (IMG['fx/pm_hexshield']) drawSpr(c, 'pm_hexshield', X, Y, 0, 120, { flip: o.face < 0, alpha: a * 0.9 });
    else { c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = a * 0.6; c.strokeStyle = '#8fe8ff'; c.lineWidth = 3; c.beginPath(); c.ellipse(X, Y, 14, 56, 0, 0, TAU); c.stroke(); c.restore(); } } });
}
pmSkill('pm_bash', { name: '战服·护盾冲击', lvReq: 19, mp: 45, cd: 25, col: '#2a5aa8', pmInfo: 25,
  desc: '在身前展开能量护盾向前冲撞，把路上的敌人撞飞。冲撞中霸体。施放后全队获得 8 秒强化保护罩。', pow: lv => skillDmg(11.5, 1.15, lv), ai: { kind: 'gap', r: [0, 300], dy: 30 },
  act: (lv) => ({ name: 'pm_bash', clip: 'pmBash', dur: 0.62, noCounter: true, superArmor: true, move: [[0.06, 0.42, 380]],
    onStart: e => { pmHexShield(e, 0.55); sfx.pmZap(0.8); },
    hits: [HB(0.06, 0.44, [0, 74, 34, 0, 130], skillDmg(11.5, 1.15, lv), { knock: 280, stun: 0.6, airLift: 120, heavy: true, hs: 0.09, shake: 4, big: 1.4, snd: 'blunt', col: '#bff4ff' })],
    events: [evAt(0.46, e => pmRedShield(e))] }) });
// 开拓射线：战斗服手炮向前发射激光（多段），扫过的地面随后依次爆炸
pmSkill('pm_ray', { name: '战服·开拓射线', lvReq: 20, mp: 60, cd: 45, col: '#3a9ae0', elem: 'light',
  desc: '把护臂变形成手炮，向前发射贯穿的激光（6 段），激光扫过的地面随后从近到远依次爆炸。施放中霸体。', pow: lv => skillDmg(2.25, 0.225, lv) * 6 + skillDmg(2.5, 0.25, lv) * 5, ai: { kind: 'burst', r: [0, 600], dy: 16 },
  act: (lv) => ({ name: 'pm_ray', clip: 'pmRay', dur: 1.3, noCounter: true, superArmor: true,
    update: e => { if (e.actT < 0.34 && Math.random() < 0.6 && typeof fxCharge === 'function') fxCharge(e, '#8fe8ff'); },
    events: [evAt(0.02, () => sfx.charge()), evAt(0.34, e => { sfx.pmZap(1.3); sfx.iai(); cam.shake = 5; fxBeam(e.x + e.face * 52, e.y, e.z + 58, 620, e.face, { w: 44, dur: 0.6, col: '#8fe8ff' }); }),
      ...[0.36, 0.44, 0.52, 0.6, 0.68, 0.76].map(tt => evAt(tt, e => instantHit(e, { box: [40, 640, 16, 24, 90], dmg: skillDmg(2.25, 0.225, lv), stun: 0.4, knock: 30, airLift: 140, hs: 0.03, col: '#bff4ff', elem: 'light' }))),
      ...[0, 1, 2, 3, 4].map(i => evAt(0.82 + i * 0.08, e => { const x = e.x + e.face * (110 + i * 120); fxBurst(x, e.y, 20, 150, '#8fe8ff'); fxShock(x, e.y, 70, '#9fe8ff'); sfx.boom(0.4); cam.shake = Math.max(cam.shake, 3);
        blast(e, x, e.y, 70, { dmg: skillDmg(2.5, 0.25, lv), type: 'indep', launch: 300, knock: 60, hs: 0.05, col: '#bff4ff', snd: 'fire', pmTok: e.act }, { zMax: 150 }); }))] }) });
// ---- BUFF（无动作施放、全队同步）----
pmBuff('pm_mobility', { name: '机动强化', lvReq: 15, mp: 30, cd: 15, col: '#3ac0d8', req: pmReqStacks(1),
  desc: '【BUFF · 无动作】消耗 1 层战场信息：12 秒内全队攻击速度、移动速度、施放速度提高。可以在任何动作中施放，不打断当前动作。', infoExtra: lv => [['三速', '+' + pct(0.08 + 0.006 * (lv - 1))], ['持续', '12 秒'], ['消耗', '战场信息 1 层']],
  instant: (lv, p) => { if (!pmSpend(p, 1)) return; const v = 0.08 + 0.006 * (lv - 1); sfx.buff(); pmParty(p, 'pm_mobility', { t: 12, aspd: v, mspd: v, cspd: v, col: '#3ac0d8' }, '#6ae0ff'); } });
pmBuff('pm_purge', { name: '保护模件（净化）', lvReq: 16, mp: 30, cd: 12, col: '#5ad0c0', req: pmReqStacks(1),
  desc: '【BUFF · 无动作】消耗 1 层战场信息：解除全队身上最多 5 种异常状态。', infoExtra: () => [['解除异常', '最多 5 种'], ['消耗', '战场信息 1 层']],
  instant: (lv, p) => { if (!pmSpend(p, 1)) return; sfx.buff(); fxAura(p, '#9ff0ff', 0.6); if (hasSkill(p, 'pm_sync') && p === game.player) partyCast('cleanse', { n: 5 }, p); else partyCleanse(p, 5); } });
pmBuff('pm_armor', { name: '装甲强化', lvReq: 17, mp: 60, cd: 10, col: '#4a7ab8',
  desc: '【BUFF · 无动作】强化全队的装甲：300 秒内最大 HP / MP 提高，受到的伤害降低。', infoExtra: lv => [['最大 HP / MP', '+' + pct(0.06 + 0.01 * (lv - 1))], ['受到的伤害', '−' + pct(0.04 + 0.006 * (lv - 1))], ['持续', '300 秒']],
  instant: (lv, p) => { const v = 0.06 + 0.01 * (lv - 1); sfx.buff(); pmParty(p, 'pm_armor', { t: 300, hpPct: v, mpPct: v, taken: -(0.04 + 0.006 * (lv - 1)), col: '#4a7ab8' }, '#8ab8ff'); } });
pmBuff('pm_arms', { name: '军械强化', lvReq: 18, mp: 60, cd: 10, col: '#e0a03a',
  desc: '【BUFF · 无动作】协战师的主 BUFF：强化全队的武器，300 秒内攻击力（物理 / 魔法 / 独立）提高。', infoExtra: lv => [['攻击力', '+' + pct(0.08 + 0.012 * (lv - 1))], ['持续', '300 秒']],
  instant: (lv, p) => { sfx.buff(); pmParty(p, 'pm_arms', { t: 300, atk: 0.08 + 0.012 * (lv - 1), col: '#e0a03a' }, '#ffd070'); } });
pmBuff('pm_buffer', { name: '保护模件（缓冲）', lvReq: 19, mp: 40, cd: 8, col: '#3aa0e8', req: pmReqStacks(1),
  desc: '【BUFF · 无动作】消耗 1 层战场信息：给全队套上可叠加的保护罩（15 秒），吸收伤害。保护罩总量不超过最大 HP 的 60%。', infoExtra: lv => [['保护罩', '最大 HP × ' + pct(0.1 + 0.005 * (lv - 1))], ['持续', '15 秒'], ['消耗', '战场信息 1 层']],
  instant: (lv, p) => { if (!pmSpend(p, 1)) return; sfx.buff(); fxAura(p, '#8fe8ff', 0.6); pmShield(p, 'pm_buffer', 0.1 + 0.005 * (lv - 1), 15); } });
pmBuff('pm_armsx', { name: '军械强化（进阶）', lvReq: 19, mp: 50, cd: 20, col: '#e07a2a', req: pmReqStacks(2), pre: { pm_arms: 1 },
  desc: '【BUFF · 无动作】消耗 2 层战场信息：10 秒内全队的军械强化效果提高（攻击力再提高）。', infoExtra: lv => [['攻击力', '+' + pct(0.12 + 0.01 * (lv - 1))], ['持续', '10 秒'], ['消耗', '战场信息 2 层']],
  instant: (lv, p) => { if (!pmSpend(p, 2)) return; sfx.buff(); sfx.pmZap(0.6); pmParty(p, 'pm_armsx', { t: 10, atk: 0.12 + 0.01 * (lv - 1), col: '#e07a2a' }, '#ffb050'); } });
pmSkill('pm_tactic', { name: '系统·作战应对', lvReq: 21, passive: true, col: '#3a8ac8',
  desc: '【被动 · 光环】根据战场信息调整全队的作战参数：全队攻击力、攻击速度、移动速度提高（不看距离，队员在别的房间也生效）。', infoExtra: lv => [['攻击力', '+' + pct(0.02 + 0.004 * (lv - 1))], ['攻速 / 移速', '+' + pct(0.03 + 0.005 * (lv - 1))]] });
// ---- 一觉：强袭策略：区域肃清（督战官）----
pmSkill('pm_awk1', { name: '强袭策略：区域肃清', lvReq: 21, maxLv: 3, mp: 150, cd: 160, pvp: 0.45, awaken: true, col: '#3ac0ff',
  desc: '【觉醒】呼叫医神设备升空，对周围的敌人进行 10 轮激光支援；同时 33 秒内全队（不含自己）攻击力、攻击速度、移动速度大幅提高。施放中无敌。', pow: lv => skillDmg(2.2, 0.6, lv) * 10, ai: { kind: 'awaken', r: [0, 500], dy: 120 },
  infoExtra: lv => [['队员攻击力', '+' + pct(0.12 + 0.03 * (lv - 1))], ['队员攻速 / 移速', '+' + pct(0.1)], ['持续', '33 秒（不含自己）']],
  act: (lv) => ({ name: 'pm_awk1', clip: 'pmCommand', dur: 2.2, superArmor: true, noCounter: true, invul: [0, 2.2],
    onStart: e => { game.cutin = { t: 0, dur: 1.0, name: '强袭策略：区域肃清', who: cutinWho(e) }; game.timeStop = 0.9; sfx.awaken();
      if (e === game.player) partySend('buff', { id: 'pm_awk1', b: { t: 33, atk: 0.12 + 0.03 * (lv - 1), aspd: 0.1, mspd: 0.1, col: '#3ac0ff' }, aura: '#8fe8ff' }, e); },
    update: e => { const a = e.act; if (!a.dev && e.actT > 0.95) a.dev = pmMedic(e, 1.3); },
    events: Array.from({ length: 10 }, (_, i) => evAt(1.0 + i * 0.1, e => {
      const L = ents.filter(t => hittable(e, t) && Math.abs(t.x - e.x) < 520 && Math.abs(t.y - e.y) < 200), t = L.length ? L[i % L.length] : null;
      const x = t ? t.x : e.x + e.face * rnd(60, 360), y = t ? t.y : clamp(e.y + rnd(-60, 60), 8, DEPTH - 8);
      pmSkyLaser(x, y, 0.4, 36); sfx.pmZap(0.8); cam.shake = Math.max(cam.shake, 4);
      blast(e, x, y, 80, { dmg: skillDmg(2.2, 0.6, lv), type: 'indep', stun: 0.5, launch: 260, knock: 40, hs: 0.05, sure: true, downHit: true, col: '#bff4ff', pmTok: e.act }, { zMax: 220 }); })) }) });
// 医神设备（觉醒用的空中支援平台）：从天上降下来悬停，结束后升空
function pmMedic(e, dur) {
  return addFx({ x: e.x, y: e.y - 2, z: 0, dur, add: false, draw(c) { const k = this.t / this.dur, up = k < 0.2 ? (1 - k / 0.2) * 200 : k > 0.85 ? (k - 0.85) / 0.15 * 260 : 0, X = sx(this.x), Y = sy(this.y, 230 + up + Math.sin(game.t * 3) * 5);
    if (IMG['fx/pm_medic']) drawSpr(c, 'pm_medic', X, Y, 150, 0, { add: false });
    else { c.save(); c.translate(X, Y); c.fillStyle = '#e8eef4'; c.strokeStyle = '#1e2a44'; c.lineWidth = 2; c.beginPath(); c.ellipse(0, 0, 60, 16, 0, 0, TAU); c.fill(); c.stroke(); c.fillStyle = PM_COL; c.fillRect(-30, -3, 60, 6); c.restore(); } } });
}

/* ---------------- 23 级以后（二觉 / 三觉那一段）---------------- */
// 二觉 / 三觉技能：写 tier: 2 / 3（通用组按 flags.awaken2 / awaken3 解锁，二觉任务 26 级、三觉 30 级）
const pmCutin = (e, n) => { const k = 'paramedic' + (n > 1 ? n : ''); return jobOf(e) === PM && IMG['cutin/' + k] ? { cls: k, model: e.model, x: e.x } : cutinWho(e); };
// 保护模件（黄金复苏）：倒下的队员在死亡倒计时（黄金时间）里原地复苏；单人时改为除颤电击（周身电击 + 自己一层保护罩）
pmBuff('pm_revive', { name: '保护模件（黄金复苏）', lvReq: 23, mp: 50, cd: 30, col: '#ffd23a', req: pmReqStacks(1),
  desc: '【BUFF · 无动作】消耗 1 层战场信息：倒下的队员在黄金时间（死亡后的倒计时）内被除颤器电击复苏，不消耗复活币。\n单人作战时改为除颤电击：对周围的敌人造成电击伤害（附带感电），并给自己一层保护罩。',
  infoExtra: lv => [['单人：电击', pct(skillDmg(3.0, 0.3, lv))], ['单人：保护罩', '最大 HP × 15%'], ['消耗', '战场信息 1 层']],
  instant: (lv, p) => {
    const dead = partyMates().filter(g => g.dead && g.uid);
    if (!soloPlay() && !dead.length) { fxText('没有需要复苏的队员', p.x, p.y, p.z + 30, { col: '#ffd23a', size: 11 }); p.cool.pm_revive = 1; p.mp += SKILLS.pm_revive.mp; return; }
    if (!pmSpend(p, 1)) return; sfx.pmZap(1.2);
    for (const g of dead) { partySend('revive', { uid: g.uid }, p); fxSpr('spark', g.x, g.y, g.z + 50, { w: 160, dur: 0.5, col: '#ffe07a' }); }
    if (soloPlay()) { fxShock(p.x, p.y, 150, '#ffe07a'); cam.shake = 4;
      blast(p, p.x, p.y, 150, { dmg: skillDmg(3.0, 0.3, lv), type: 'indep', stun: 0.8, knock: 60, hs: 0.06, snd: 'crit', col: '#fff0a0', sure: true }, { zMax: 150 });
      for (const t of ents) if (foe(p, t) && inGround(t, p.x, p.y, 150)) addStatus(t, 'shock', 3, { src: p });
      pmShield(p, 'pm_buffer', 0.15, 15); }
  } });
// 系统·区域防御：无人机展开力场，持续伤害力场内的敌人；力场期间自己免疫伤害，全队短暂无敌
defSummon('pm_field', { kind: 'field', life: 3, tick: 0.3, r: 150, zMax: 160, max: 1, tags: ['pm'], col: PM_COL,
  onTick: (s, L) => { for (const t of L) summonHit(s, t, { dmg: skillDmg(0.55, 0.055, s.lv), type: 'indep', stun: 0.3, knock: 20, hs: 0.02, col: '#bff4ff', snd: 'crit' }); },
  draw(c, s) { const k = s.lifeT / s.life, a = k < 0.1 ? k / 0.1 : k > 0.85 ? (1 - k) / 0.15 : 1, X = sx(s.x), Y = sy(s.y, 0);
    c.save(); c.translate(X, Y); c.scale(1, GR); c.globalCompositeOperation = 'lighter';
    if (IMG['fx/pm_field']) { c.globalAlpha = 0.55 * a; drawSpr(c, 'pm_field', 0, 0, 320, 320, { rot: game.t * 0.6 }); }
    else { c.globalAlpha = 0.5 * a; c.strokeStyle = PM_COL; c.lineWidth = 3; c.beginPath(); c.arc(0, 0, 150, 0, TAU); c.stroke(); c.globalAlpha = 0.12 * a; c.fillStyle = PM_COL; c.fill(); }
    c.restore(); } });
pmSkill('pm_field', { name: '系统·区域防御', lvReq: 23, mp: 60, cd: 25, col: '#2a8ac8',
  desc: '分析无人机在身边展开 3 秒的防御力场：力场内的敌人持续受到伤害；力场期间自己免疫伤害，全队获得 1.5 秒无敌。', pow: lv => skillDmg(0.55, 0.055, lv) * 10, ai: { kind: 'aoe', r: [0, 150], dy: 60 },
  infoExtra: () => [['力场', '3 秒'], ['全队无敌', '1.5 秒']],
  act: (lv) => ({ name: 'pm_field', clip: 'pmField', dur: 0.55, noCounter: true, invul: [0, 0.55],
    events: [evAt(0.18, e => { sfx.pmZap(1); fxShock(e.x, e.y, 160, PM_COL); summon(e, 'pm_field', { x: e.x, y: e.y, lv });
      partyOn.fx.buff(e, { id: 'pm_field', b: { t: 3, inv: 1, col: PM_COL, name: '区域防御' } }, null);
      if (e === game.player) partySend('buff', { id: 'pm_field', b: { t: 1.5, inv: 1, col: PM_COL, name: '区域防御' }, aura: PM_COL }, e); })] }) });
// 战服·歼灭行动：6 架小无人机在身前排成扇形，一齐向前发射直线激光（2 轮）；然后后撤，回收无人机合体成大剑挥斩
function pmMiniDrones(e, dur) {
  return addFx({ x: e.x, y: e.y - 1, z: 0, face: e.face, dur, draw(c) { const k = this.t / this.dur, u = easeOut(Math.min(1, k * 5));
    for (let i = 0; i < 6; i++) { const P = pmDronePos(this, i, u), X = sx(P.x), Y = sy(P.y, P.z + Math.sin(game.t * 6 + i) * 3);
      if (IMG['fx/pm_minidrone']) drawSpr(c, 'pm_minidrone', X, Y, 26, 0, { add: false, flip: this.face < 0 });
      else { c.fillStyle = '#e8eef4'; c.strokeStyle = '#1e2a44'; c.beginPath(); c.ellipse(X, Y, 8, 4, 0, 0, TAU); c.fill(); c.stroke(); c.fillStyle = PM_COL; c.fillRect(X - 2, Y - 1, 4, 2); } } } });
}
const pmDronePos = (o, i, u = 1) => ({ x: o.x + o.face * (40 + (i % 2) * 22) * u, y: o.y + (i - 2.5) * 12 * u, z: 36 + (i % 3) * 34 * u });
pmSkill('pm_annihilate', { name: '战服·歼灭行动', lvReq: 25, mp: 80, cd: 30, col: '#2a7ae0', elem: 'light',
  desc: '放出 6 架小型无人机在身前排成扇形，一齐向前方发射直线激光（2 轮）；随后向后撤开，回收无人机合体成大剑向前挥斩。施放中霸体。', pow: lv => skillDmg(1.8, 0.18, lv) * 2 + skillDmg(4.0, 0.4, lv), ai: { kind: 'burst', r: [0, 560], dy: 40 },
  act: (lv) => ({ name: 'pm_annihilate', clip: 'pmCommand', dur: 1.75, noCounter: true, superArmor: true,
    onStart: e => { e.act.dr = pmMiniDrones(e, 1.0); sfx.pmBeep(); },
    events: [...[0.3, 0.55].map(tt => evAt(tt, e => { sfx.pmZap(0.9); cam.shake = Math.max(cam.shake, 3); const D = e.act.dr;
        for (let i = 0; i < 6; i++) { const P = D ? pmDronePos(D, i) : { x: e.x + e.face * 40, y: e.y, z: 60 }; fxBeam(P.x + e.face * 8, P.y, P.z, 620, e.face, { w: 14, dur: 0.24, col: '#9fe8ff' }); }
        instantHit(e, { box: [30, 660, 40, 0, 160], dmg: skillDmg(1.8, 0.18, lv), stun: 0.45, knock: 20, airLift: 110, hs: 0.03, col: '#bff4ff', elem: 'light', pmTok: e.act }); })),
      evAt(0.95, e => { e.play('pmFlip', true); e.vz = 300; e.vx = -e.face * 260; sfx.jump(); }),
      evAt(1.3, e => { e.vx = 0; e.play('pmSwing', true); sfx.pmBlade(); sfx.swing(true); cam.shake = 6; fxSlashOn(e, { a0: -2.9, a1: 1.3, r: 120, w: 30, off: [20, 60], squash: 0.6, col: '#dffaff', heavy: true });
        instantHit(e, { box: [-20, 260, 40, 0, 150], dmg: skillDmg(4.0, 0.4, lv), launch: 420, knock: 220, hs: 0.12, big: 1.8, col: '#dffaff', sure: true }); })] }) });
pmSkill('pm_limit', { name: '系统·限制解除', lvReq: 26, tier: 2, passive: true, col: '#d05ae0',
  desc: '【被动 · 二觉】解除战斗服的输出限制：攻击力提高；保护罩总量上限提高到最大 HP 的 70%，强化保护罩的减伤提高到 30%。', infoExtra: lv => [['攻击力', '+' + pct(0.05 + 0.01 * (lv - 1))], ['保护罩上限', '70%'], ['强化保护罩减伤', '30%']] });
CLASSES.gun.passives.push(p => { if (!isPM(p)) return; const lv = skLv(p, 'pm_limit'); setPassive(p, 'pm_limit', lv > 0, { atk: 0.05 + 0.01 * (lv - 1), col: '#d05ae0' }); });
// 战服·超限压制：全功率向前突进，追踪前方的敌人连续打击 5 次（敌人多时逐个打），然后回到原位；施放中无敌
pmSkill('pm_overlimit', { name: '战服·超限压制', lvReq: 26, mp: 90, cd: 35, col: '#3a5ae0',
  desc: '战斗服全功率运转：高速追踪前方的敌人连续打击 5 次（敌人多时逐个打，最多 5 个），然后回到原来的位置。施放中无敌。', pow: lv => skillDmg(1.6, 0.16, lv) * 5, ai: { kind: 'burst', r: [0, 520], dy: 120 },
  act: (lv) => ({ name: 'pm_overlimit', clip: 'pmRush', dur: 1.55, noCounter: true, invul: [0, 1.55],
    onStart: e => { e.act.ox = e.x; e.act.oy = e.y; e.act.list = ents.filter(t => hittable(e, t) && (t.x - e.x) * e.face > -20 && Math.abs(t.x - e.x) < 560 && Math.abs(t.y - e.y) < 160).sort((a, b) => Math.abs(a.x - e.x) - Math.abs(b.x - e.x)).slice(0, 5); sfx.pmZap(1); },
    events: [...Array.from({ length: 5 }, (_, i) => evAt(0.12 + i * 0.2, e => { const L = e.act.list.filter(t => !t.dead && !t.remove), t = L.length ? L[i % L.length] : null;
        fxAfterimage(e, '#6ad8ff'); const x0 = e.x;
        if (t) { e.face = t.x >= e.x ? 1 : -1; e.warp(t.x - e.face * 40, t.y); } else e.warp(e.x + e.face * 60, e.y);
        fxStreak({ x: Math.min(x0, e.x), y: e.y, z: e.z + 55, face: 1, len: Math.max(8, Math.abs(e.x - x0)), w: 8, col: '#8fe8ff', dur: 0.15 });
        e.play(i % 2 ? 'pmRaid' : 'pmRush', true); sfx.pmBlade(); fxSlashOn(e, { a0: i % 2 ? 1.1 : -2.3, a1: i % 2 ? -2.0 : 0.9, r: 62, w: 16, off: [16, 60], squash: 0.7, col: '#8fe8ff' });
        const h = { dmg: skillDmg(1.6, 0.16, lv), stun: 1.0, knock: i === 4 ? 160 : 20, launch: i === 4 ? 380 : 0, airLift: 80, hs: i === 4 ? 0.1 : 0.05, sure: true, col: '#bff4ff', pmTok: e.act };
        if (t) applyHit(e, t, h, { proj: true }); else instantHit(e, { box: [0, 90, 34, 0, 130], ...h }); })),
      evAt(1.2, e => { fxAfterimage(e, '#6ad8ff'); const x0 = e.x; e.warp(e.act.ox, e.act.oy); e.play('pmA1', true); fxStreak({ x: Math.min(x0, e.x), y: e.y, z: e.z + 50, face: 1, len: Math.max(8, Math.abs(x0 - e.x)), w: 8, col: '#8fe8ff', dur: 0.2 }); })] }) });
// 战服·超负荷炮：在前方部署遥控兵器，充能后向前方冲击；施放后全队强化保护罩
pmSkill('pm_overload', { name: '战服·超负荷炮', lvReq: 26, mp: 100, cd: 40, col: '#e05a3a',
  desc: '在前方部署遥控兵器：充能时吸住附近的敌人并持续造成伤害，1 秒后向前方释放超负荷冲击波，把路上的敌人全部轰飞。施放后全队获得 8 秒强化保护罩。', pow: lv => skillDmg(1.0, 0.1, lv) * 5 + skillDmg(8.0, 0.8, lv), ai: { kind: 'burst', r: [0, 520], dy: 30 },
  act: (lv) => ({ name: 'pm_overload', clip: 'pmDeploy', dur: 0.6, noCounter: true, superArmor: true,
    events: [evAt(0.25, e => { sfx.pmBeep(); pmRemote(e, lv); }), evAt(0.4, e => pmRedShield(e, 8, 0.05))] }) });
// 在指定位置朝指定方向做一次立即判定（遥控兵器等：发射点不是施放者本人）
function pmHitAt(owner, x, y, face, h) {
  const b = h.box, B = { x0: face > 0 ? x + b[0] : x - b[1], x1: face > 0 ? x + b[1] : x - b[0], y0: y - b[2], y1: y + b[2], z0: b[3], z1: b[4] }, src = { x, y, z: 0, face };
  for (const t of ents) if (canHit(owner, t, h) && overlaps(B, t)) applyHit(owner, t, { ...h, box: null }, { proj: true, src });
}
function pmRemote(e, lv) {
  const x = e.x + e.face * 70, y = e.y, face = e.face, owner = e, tok = e.act;
  addFx({ x, y: y + 0.5, z: 0, dur: 1.8, draw(c) { const k = this.t, X = sx(this.x), Y = sy(this.y, 18);
    if (IMG['fx/pm_remote']) drawSpr(c, 'pm_remote', X, Y, 64, 0, { add: false, flip: face < 0 });
    else { c.fillStyle = '#e8eef4'; c.strokeStyle = '#1e2a44'; c.lineWidth = 2; c.fillRect(X - 22, Y - 14, 44, 24); c.strokeRect(X - 22, Y - 14, 44, 24); }
    if (k < 1.1) drawSpr(c, fxTint('spark', '#ff9a7a'), X + face * 26, Y - 2, 30 + k * 60, 0, { alpha: 0.6 + 0.4 * Math.sin(game.t * 30) }); } });
  for (let i = 0; i < 5; i++) game.after(0.2 + i * 0.18, () => { if (owner.dead) return; pmHitAt(owner, x, y, face, { box: [0, 90, 40, 0, 120], dmg: skillDmg(1.0, 0.1, lv), type: 'indep', stun: 0.4, knock: -40, hs: 0.02, col: '#ffc0a0', pmTok: tok }); });
  game.after(1.1, () => { if (owner.dead) return; sfx.cannon(1.4); sfx.pmZap(1.4); cam.shake = 10; cam.flash = 0.15; cam.flashCol = '#ffe0d0';
    fxBeam(x + face * 30, y, 40, 620, face, { w: 90, dur: 0.7, col: '#ff9a7a' });
    pmHitAt(owner, x, y, face, { box: [20, 640, 40, 0, 160], dmg: skillDmg(8.0, 0.8, lv), type: 'indep', launch: 480, knock: 300, hs: 0.14, big: 2, sure: true, downHit: true, col: '#ffd0c0', pmTok: tok }); });
}
// ---- 二觉：绝境策略：极限歼灭（战勤统帅）----
// 二觉的“自律神经系统激活”：头顶的蓄能环慢慢充满
function pmNerveFx(e, dur) {
  return addFx({ ent: e, y: e.y + 1, dur, add: true, update() { this.y = this.ent.y + 1; }, draw(c) { const E = this.ent, k = this.t / this.dur, X = sx(E.x), Y = sy(E.y, E.z + 150);
    c.save(); c.lineWidth = 5; c.strokeStyle = 'rgba(40,30,70,.7)'; c.beginPath(); c.arc(X, Y, 16, 0, TAU); c.stroke();
    c.globalCompositeOperation = 'lighter'; c.strokeStyle = '#c8b0ff'; c.beginPath(); c.arc(X, Y, 16, -Math.PI / 2, -Math.PI / 2 + TAU * k); c.stroke();
    c.font = 'bold 10px sans-serif'; c.textAlign = 'center'; c.fillStyle = '#e8dcff'; c.fillText('神经系统激活', X, Y - 24); c.restore(); } });
}
pmSkill('pm_awk2', { name: '绝境策略：极限歼灭', lvReq: 27, maxLv: 3, mp: 200, cd: 180, pvp: 0.45, awaken: true, tier: 2, col: '#6a3ae0',
  desc: '【二觉】先用约 2.5 秒“激活自律神经系统”（蓄能，无敌），然后调用战斗服的全部兵器发动歼灭连段：手炮连射 → 能量刃乱斩 → 无人机齐射 → 合体大剑终结。全部命中时获得 2 层战场信息。施放中无敌。', pow: lv => skillDmg(30, 9, lv), ai: { kind: 'awaken', r: [0, 420], dy: 80 },
  act: (lv) => ({ name: 'pm_awk2', clip: 'pmAwk2', dur: 4.95, superArmor: true, noCounter: true, invul: [0, 4.95],
    onStart: e => { game.cutin = { t: 0, dur: 1.0, name: '绝境策略：极限歼灭', who: pmCutin(e, 2) }; game.timeStop = 0.9; sfx.awaken(); e.act.hitN = 0; e.act.need = 0; pmNerveFx(e, 2.55); },
    update: e => { if (e.actT < 2.55 && Math.random() < 0.7) fxCharge(e, '#c8b0ff', 2); if (e.actT > 2.5 && !e.act.go) { e.act.go = true; sfx.pmZap(1.4); cam.flash = 0.12; cam.flashCol = '#e0d0ff'; fxShock(e.x, e.y, 180, '#c8b0ff'); } },
    events: [
      ...Array.from({ length: 8 }, (_, i) => evAt(2.6 + i * 0.08, e => { e.act.need++; pmMuzzle(e, 50, 1.6); sfx.gun(1.2); cam.shake = Math.max(cam.shake, 3);
        if (instantHit(e, { box: [20, 520, 30, 0, 110], dmg: skillDmg(1.2, 0.35, lv), stun: 0.5, knock: 20, airLift: 110, hs: 0.02, sure: true, downHit: true, col: '#d8c0ff', pmTok: e.act })) e.act.hitN++; })),
      ...Array.from({ length: 6 }, (_, i) => evAt(3.35 + i * 0.1, e => { e.act.need++; e.play(i % 2 ? 'pmA2' : 'pmA1', true); sfx.pmBlade(); fxSlashOn(e, { a0: i % 2 ? 1.1 : -2.3, a1: i % 2 ? -2.0 : 0.9, r: 80, w: 18, off: [20, 60], squash: 0.7, col: '#c8b0ff' });
        if (instantHit(e, { box: [-20, 150, 40, 0, 150], dmg: skillDmg(1.3, 0.4, lv), stun: 0.6, knock: 5, airLift: 60, hs: 0.03, sure: true, downHit: true, col: '#d8c0ff' })) e.act.hitN++; })),
      evAt(4.0, e => { pmMiniDrones(e, 0.5); sfx.pmZap(1.2); e.act.need++; let n = 0;
        for (let i = 0; i < 6; i++) { const x = e.x + e.face * (60 + i * 60); pmSkyLaser(x, e.y, 0.3, 26, '#c8b0ff'); for (const t of ents) if (hittable(e, t) && Math.abs(t.x - x) < 50 && Math.abs(t.y - e.y) < 70) { applyHit(e, t, { dmg: skillDmg(0.8, 0.25, lv), stun: 0.6, airLift: 140, hs: 0.02, sure: true, downHit: true, col: '#d8c0ff' }, { proj: true }); n++; } }
        if (n) e.act.hitN++; }),
      evAt(4.4, e => { e.play('pmAwk2b', true); e.act.need++; sfx.boom(1.3); cam.shake = 12; cam.flash = 0.25; cam.flashCol = '#e0d0ff'; fxSlashOn(e, { a0: -3.0, a1: 1.4, r: 130, w: 34, off: [20, 60], squash: 0.6, col: '#e8d8ff', heavy: true });
        if (instantHit(e, { box: [-30, 260, 50, 0, 180], dmg: skillDmg(8, 2.4, lv), launch: 520, knock: 260, hs: 0.16, big: 2.2, sure: true, downHit: true, col: '#e8d8ff' })) e.act.hitN++;
        if (e.act.hitN >= e.act.need) { pmGain(e, 200); fxText('全部命中！战场信息 +2', e.x, e.y, e.z + 40, { col: '#e0d0ff', size: 14, dur: 1.2 }); } })] }) });
// 系统常量·战斗服（改良型）：战斗服外观二选一（标准型 / 改良型）——施放一次切换
pmBuff('pm_suit2', { name: '系统常量·战斗服（改良型）', lvReq: 29, maxLv: 1, sp: 15, mp: 0, cd: 1, col: '#c8a04a', ai: null,
  desc: '【外观】战斗服外观二选一：标准型（白 / 天蓝）或改良型（换色）。施放一次切换，地下城里立刻换装。', infoExtra: () => [['当前外观', typeof save !== 'undefined' && save.data && save.data.pmAlt ? '改良型' : '标准型']],
  instant: (lv, p) => { const alt = !(save.data && save.data.pmAlt); if (save.data) save.data.pmAlt = alt; if (p._pmSuit) { p.model = p._pmNorm.model; p.acts = p._pmNorm.acts; p._pmSuit = false; pmSuitSync(p); } fxText(alt ? '改良型' : '标准型', p.x, p.y, p.z + 30, { col: '#ffd070', size: 12 }); } });
pmSkill('pm_program', { name: '系统·临战编程', lvReq: 29, maxLv: 1, passive: true, col: '#3ab0a0',
  desc: '【被动】预先编写的作战程序：战服·机动打击命中后自动追加第二击；近战·闪退射击施放时给全队一层保护罩（最大 HP 的 5%）。' });
// 系统·孤军突破：医神设备突围——蹲伏无敌，医神设备向周围倾泻能量攻击，结束时获得 1 层战场信息
pmSkill('pm_breakout', { name: '系统·孤军突破', lvReq: 29, mp: 80, cd: 45, col: '#e0c03a',
  desc: '呼叫医神设备强行突围：蹲低防御（无敌）等待支援，医神设备向周围倾泻能量攻击，最后一次大爆发；结束时获得 1 层战场信息。', pow: lv => skillDmg(1.2, 0.12, lv) * 6 + skillDmg(5.0, 0.5, lv), ai: { kind: 'aoe', r: [0, 260], dy: 100 },
  act: (lv) => ({ name: 'pm_breakout', clip: 'pmGuard', dur: 1.7, noCounter: true, invul: [0, 1.7],
    onStart: e => { pmMedic(e, 1.7); sfx.pmBeep(); },
    events: [...Array.from({ length: 6 }, (_, i) => evAt(0.35 + i * 0.15, e => { const a = i * 1.1, x = e.x + Math.cos(a) * 140, y = clamp(e.y + Math.sin(a) * 50, 8, DEPTH - 8); pmSkyLaser(x, y, 0.3, 28, '#ffe07a'); sfx.pmZap(0.6);
        blast(e, x, y, 80, { dmg: skillDmg(1.2, 0.12, lv), type: 'indep', stun: 0.5, knock: 60, hs: 0.03, sure: true, col: '#fff0a0', pmTok: e.act }, { zMax: 180 }); })),
      evAt(1.4, e => { e.play('pmField', true); cam.shake = 9; sfx.boom(1.2); fxShock(e.x, e.y, 240, '#ffe07a'); fxBurst(e.x, e.y, 60, 320, '#ffe07a');
        blast(e, e.x, e.y, 240, { dmg: skillDmg(5.0, 0.5, lv), type: 'indep', launch: 420, knock: 200, hs: 0.1, big: 1.6, sure: true, downHit: true, col: '#fff0a0' }, { zMax: 220 }); pmGain(e, 100); })] }) });
// ---- 三觉：空袭策略：神兵天降（重霄·协战师）：超高空速降，全队强化 + 激光 10 段 + 连锁爆炸 15 段；和一觉共享冷却 ----
pmSkill('pm_awk3', { name: '空袭策略：神兵天降', lvReq: 30, maxLv: 3, mp: 250, cd: 160, pvp: 0.45, awaken: true, tier: 3, col: '#ffd23a',
  desc: '【三觉】从超高空的医神设备上速降：全队（含自己）攻击力、三速大幅提高 40 秒，医神设备进行 10 段激光轰炸，落地时引发 15 段连锁爆炸。和“强袭策略：区域肃清”共享冷却。施放中无敌。',
  pow: lv => skillDmg(2.5, 0.8, lv) * 10 + skillDmg(1.4, 0.45, lv) * 15, ai: { kind: 'awaken', r: [0, 520], dy: 140 },
  infoExtra: lv => [['全队攻击力', '+' + pct(0.15 + 0.03 * (lv - 1))], ['全队三速', '+12%'], ['持续', '40 秒'], ['共享冷却', '强袭策略：区域肃清']],
  act: (lv) => ({ name: 'pm_awk3', clip: 'pmSalute', dur: 3.4, superArmor: true, noCounter: true, invul: [0, 3.4], lowGrav: 0.001,
    onStart: e => { game.cutin = { t: 0, dur: 1.1, name: '空袭策略：神兵天降', who: pmCutin(e, 3) }; game.timeStop = 1.0; sfx.awaken(); e.act.ox = e.x; e.act.oy = e.y;
      if (!e.ghost) { e.cool.pm_awk1 = Math.max(e.cool.pm_awk1 || 0, SKILLS.pm_awk3.cd * (e.cdMul || 1)); pmParty(e, 'pm_awk3', { t: 40, atk: 0.15 + 0.03 * (lv - 1), aspd: 0.12, mspd: 0.12, cspd: 0.12, col: '#ffd23a' }, '#ffe07a'); } },
    update: e => { const a = e.act, t = e.actT; e.vz = 0;
      if (t > 1.0 && t < 1.3) e.z = 520 * (t - 1.0) / 0.3;
      else if (t >= 1.3 && t < 2.25) { e.z = Math.max(0, 520 * (1 - (t - 1.3) / 0.95)); if (!a.dive) { a.dive = true; e.play('pmDive', true); } if (!a.medic) a.medic = pmMedic(e, 2.1); }
      else if (t >= 2.25 && !a.landed) { a.landed = true; e.z = 0; e.play('pmLand', true); } },
    onEnd: e => { e.z = 0; },
    events: [...Array.from({ length: 10 }, (_, i) => evAt(1.35 + i * 0.09, e => { const L = ents.filter(t => hittable(e, t) && Math.abs(t.x - e.act.ox) < 560 && Math.abs(t.y - e.act.oy) < 220), t = L.length ? L[i % L.length] : null;
        const x = t ? t.x : e.act.ox + rnd(-360, 360), y = t ? t.y : clamp(e.act.oy + rnd(-70, 70), 8, DEPTH - 8); pmSkyLaser(x, y, 0.35, 34, '#ffe07a'); sfx.pmZap(0.7); cam.shake = Math.max(cam.shake, 4);
        blast(e, x, y, 80, { dmg: skillDmg(2.5, 0.8, lv), type: 'indep', stun: 0.6, launch: 240, knock: 30, hs: 0.04, sure: true, downHit: true, col: '#fff0a0', pmTok: e.act }, { zMax: 400 }); })),
      evAt(2.25, e => { cam.shake = 14; cam.flash = 0.3; cam.flashCol = '#fff6d0'; sfx.boom(1.5); fxShock(e.x, e.y, 260, '#ffe07a'); fxDust(e.x, e.y, 14, 40); }),
      ...Array.from({ length: 15 }, (_, i) => evAt(2.3 + i * 0.06, e => { const r = 60 + i * 26, a = i * 2.4, x = e.x + Math.cos(a) * r, y = clamp(e.y + Math.sin(a) * r * 0.35, 8, DEPTH - 8);
        fxBurst(x, y, 20, 170, '#ffc060'); if (i % 3 === 0) sfx.boom(0.5); cam.shake = Math.max(cam.shake, 5);
        blast(e, x, y, 85, { dmg: skillDmg(1.4, 0.45, lv), type: 'indep', launch: 360, knock: 120, hs: 0.04, sure: true, downHit: true, col: '#ffd0a0' }, { zMax: 300 }); }))] }) });
// 三觉和一觉共享冷却：施放一觉时三觉也进入冷却
{ const A1 = SKILLS.pm_awk1, act0 = A1.act; A1.act = (lv, p) => { const A = act0(lv, p), s0 = A.onStart; return { ...A, onStart: e => { if (s0) s0(e); if (!e.ghost) e.cool.pm_awk3 = Math.max(e.cool.pm_awk3 || 0, A1.cd * (e.cdMul || 1)); } }; }; }

CLASSES.gun.jobs.paramedic = { art: 'job/paramedic', name: '协战师', role: '辅助 · 全队 BUFF / 保护罩', armor: 'leather', awaken: 'pm_awk1', awakenName: '督战官', awaken2Name: '战勤统帅', awaken3Name: '重霄·协战师',
  growth: { spr: 1.1, str: 1.05 }, atCreate: true, direct: true,
  desc: '穿上强袭战斗服的作战支援专家。收集战场信息，为全队施加 BUFF 与保护罩——不看距离、跨越房间；单人作战时独立攻击力与冷却获得专属加成，还会呼叫激光轰炸。没有转职任务。',
  skills: ['pm_suit', 'pm_lockshot', 'pm_sync', 'pm_info', 'pm_mobility', 'pm_assault', 'pm_purge', 'pm_strike', 'pm_evade', 'pm_armor', 'pm_arms', 'pm_mark', 'pm_raid', 'pm_buffer', 'pm_armsx', 'pm_bash', 'pm_ray', 'pm_tactic', 'pm_awk1',
    'pm_revive', 'pm_field', 'pm_annihilate', 'pm_limit', 'pm_overlimit', 'pm_overload', 'pm_awk2', 'pm_suit2', 'pm_program', 'pm_breakout', 'pm_awk3'] };
// 指令（官方 BUFF 指令来自 NamuWiki / 韩服攻略；攻击技能的指令本作自定）
CLASSES.gun.cmds.push(['d', 'pm_lockshot'], ['ff', 'pm_assault'], ['df', 'pm_strike', 'attack'], ['bf', 'pm_evade'], ['ud', 'pm_mark'], ['fdf', 'pm_raid'], ['fbf', 'pm_bash'], ['du', 'pm_ray'], ['uudd', 'pm_awk1'],
  ['dd', 'pm_mobility', 'buff'], ['d', 'pm_purge', 'buff'], ['f', 'pm_armor', 'buff'], ['ff', 'pm_arms', 'buff'], ['u', 'pm_buffer', 'buff'], ['fb', 'pm_armsx', 'buff'],
  ['bdf', 'pm_revive', 'buff'], ['uu', 'pm_field'], ['fdb', 'pm_annihilate'], ['bfb', 'pm_overlimit'], ['dfd', 'pm_overload'], ['duff', 'pm_awk2'], ['bdfu', 'pm_breakout'], ['dfdf', 'pm_awk3']);
