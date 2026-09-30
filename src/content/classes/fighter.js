/* =====================================================================
   职业：格斗家（男，key `fighter`）—— 基础职业（B3：普攻、跑攻、跳攻、15 个基础技能；计划见 docs/CLASS_PLAN_FIGHTER.md，官方资料见 docs/SKILLS_OFFICIAL_fighter.md，
   逐技能对照见 docs/skills/fighter_base_final.md，规格 docs/skills/fighter.json）
   现状：ready:false（选角显示“即将开放”；开发测试用网址 ?fighter=1 强制开放，见 content/classes/common.js clsOpen）；美术到位前是矢量占位模型（鬼剑士骨架换色、不拿武器），
         精灵帧到位后自动换成 SpriteModel（content/sprites.js，片段名 = SPR_ANIMS.fighter）。
   普攻：快拳 → 下段踢（贴地）→ 中段踢 → 下劈（击倒），武器只改攻速 / 距离 / 硬直（FIGHTER_FEEL）；跑攻 = 肩撞（默认击倒；学了疾风追击后不击倒、按 X 追加）；跳攻 = 空中踢（之后不能用鹰踏）。
   基础技能：上踢（Z）、前踢（按住↑+Z）、下段踢（按住↓+Z）、膝击（按住→+Z，抓取）、分身（→+Space）、疾风追击（跑攻中 X）/ 疾风连击（被动）、钢筋铁骨（被动）、瞬步（↑→+Space）、
             鹰踏（空中 Z）、念气波（↓→+Z）、抛沙（←→+Z）、蹲伏（↓↓+C）、金刚碎（→↑+Z）、旋风腿（←↓→+C）
   取消：普攻 → 攻击技能随时；例外（官方）：念气波只有气功师、抛沙只有街霸、旋风腿只有散打能在普攻中取消（S.noForce(p)）；分身不能取消普攻（气功师学了幻影爆碎后可以）
   约定：代码里一律写 p.cls === 'fighter'（实体上的 e.fighter 是“格斗者 = 玩家类实体”，和本职业无关，别写成 p.fighter）。
   转职（各自的文件登记 CLASSES.fighter.jobs.<id>，J.ready:false 做完再开）：气功师 fighter_nen.js、散打 fighter_striker.js、街霸 fighter_brawler.js、柔道家 fighter_grappler.js
   分工：本文件归 B3（基础职业）；B4~B7 只改自己的转职文件，往 FIGHTER_HOOKS / FIGHTER_ACT_PICK 里登记，不改这里。给转职用的构件：fNenShot（念气波投射物，蓄念炮可传 sc / pierce / dmg）、
         fighterActsFor(F)（按武器生成的普攻表，FIGHTER_ACT_PICK 换普攻时展开它再覆盖，别丢了 fchain1~4）、fRing（圆形范围打击，可按目标改伤害）、fKick（踢腿弧光）
   引擎钩子（B0-E，engine/combat.js / entity.js / game/player.js / content/monsters/bestiary.js）：
     抓取 h.grabInvul / grabMax / grabRange / grabDown / grabAir / onGrabFail，grabsOf / throwAll / throwArc；addStatus(t, 'hold', 秒)；
     指令 'holdu'（按住↑）、空中 C（['', id, 'jump'] + S.air + S.airOnly）、跑攻中 X（跑攻动作的 keyLinks: { attack: 'f_chain' }）、蹲伏 fCrouchAct（act.hurtH 压低受击盒）
   ===================================================================== */
const PAL_FIGHTER = { skin: '#f0c8a0', hair: '#2a2220', eye: '#3a3040', coat: '#e8e2d4', coat2: '#b8b0a0', trim: '#c8323c', scarf: '#c8323c', pants: '#2a2c3a', boot: '#3a2a22', glove: '#c8323c', belt: '#c8323c', blade: '#cfd8e6', glow: '#ffb04a', hat: '#c8323c' };

/* ---- id 预留表（B0 定死，各块按这个写，不要另起）：技能 id 按 SKILLS_OFFICIAL_fighter.md“本作建议”列；帧名 / 片段名前缀和技能前缀相同 ---- */
const FIGHTER_IDS = {
  prefix: { base: 'f_', nenmaster: 'fn_', striker: 'fs_', brawler: 'fb_', grappler: 'fg_' },
  jobs: ['nenmaster', 'striker', 'brawler', 'grappler'],
  weapons: { knuckle: 'kn', boxing: 'bx', claw: 'cl', tonfa: 'tf', gauntlet: 'ga' },   // 武器类型 key → 物品代码（WTYPES，game/items.js）
  base: ['f_highkick', 'f_hammer', 'f_lowkick', 'f_knee', 'f_clone', 'f_chain', 'f_chain2', 'f_iron', 'f_flash', 'f_airwalk', 'f_nenshot', 'f_sand', 'f_crouch', 'f_seismic', 'f_tornado'],
  nenmaster: ['fn_sense', 'fn_lightaff', 'fn_cloth', 'fn_tattoo', 'fn_cannon', 'fn_spiral', 'fn_legstrike', 'fn_guard', 'fn_press', 'fn_nencannon2', 'fn_blast', 'fn_stone', 'fn_tiger', 'fn_roar', 'fn_thunderdrop',
    'fn_field', 'fn_haitai', 'fn_conduit', 'fn_awaken', 'fn_spear', 'fn_pillar', 'fn_absorb', 'fn_windstorm', 'fn_blade', 'fn_moon', 'fn_awaken2', 'fn_nature', 'fn_tigerblast', 'fn_awaken3'],
  striker: ['fs_glove', 'fs_light', 'fs_power', 'fs_elbow', 'fs_sa', 'fs_pusher', 'fs_bone', 'fs_raid', 'fs_aim', 'fs_shift', 'fs_step', 'fs_rush', 'fs_close', 'fs_flamekick', 'fs_dance',
    'fs_dragon', 'fs_burn', 'fs_awaken', 'fs_dual', 'fs_whirl', 'fs_spin', 'fs_fire', 'fs_descent', 'fs_cannon', 'fs_awaken2', 'fs_limit', 'fs_mortal', 'fs_awaken3'],
  brawler: ['fb_poisonres', 'fb_overstrain', 'fb_heavy', 'fb_strong', 'fb_autoload', 'fb_poison', 'fb_backstreet', 'fb_hook', 'fb_pocket', 'fb_claw', 'fb_needle', 'fb_brick', 'fb_mount', 'fb_taunt', 'fb_tackle',
    'fb_net', 'fb_vulcan', 'fb_mine', 'fb_lariat', 'fb_thousand', 'fb_awaken', 'fb_barrel', 'fb_chain', 'fb_rulebreak', 'fb_chaindrive', 'fb_cavein', 'fb_awaken2', 'fb_picaresque', 'fb_roadtohell', 'fb_awaken3'],
  grappler: ['fg_grabcannon', 'fg_takedown', 'fg_overgrab', 'fg_slide', 'fg_light', 'fg_gauntlet', 'fg_combo', 'fg_fling', 'fg_tackle', 'fg_breakdown', 'fg_necksnap', 'fg_snapshot', 'fg_airsteiner', 'fg_slamkick',
    'fg_magnum', 'fg_rolling', 'fg_cannonspike', 'fg_counter', 'fg_awaken', 'fg_pierce', 'fg_fury', 'fg_strongest', 'fg_blacktornado', 'fg_stormdiver', 'fg_awaken2', 'fg_equanimity', 'fg_basalt', 'fg_awaken3'],
};

/* ---- 武器手感（官方：5 种武器只改速度 / 距离 / 数值，不改普攻动作；攻速 / 施放速度本身在 WTYPES.aspd / cspd 里）----
   reach 普攻 / 跑攻 / 跳攻判定前沿的倍率，stun 硬直倍率，physMp / physCd 物理技能的 MP / 冷却倍率（臂铠；抓取技能 S.grab 和觉醒不受影响），
   jobCd 某个转职自己技能的冷却倍率（拳套：散打技能冷却 -10%）。没装武器按手套算 */
const FIGHTER_FEEL = {
  knuckle: { reach: 0.9, stun: 0.95, physMp: 1, physCd: 1 },
  boxing: { reach: 0.95, stun: 1, physMp: 1, physCd: 1, jobCd: { striker: 0.9 } },
  claw: { reach: 1.2, stun: 1.25, physMp: 1, physCd: 1 },
  tonfa: { reach: 1.1, stun: 1, physMp: 1, physCd: 1 },
  gauntlet: { reach: 1.0, stun: 1.1, physMp: 1.2, physCd: 1.1 },
};
const fFeelOf = p => FIGHTER_FEEL[wtypeOf(p)] || FIGHTER_FEEL.knuckle;
// 这个技能吃不吃臂铠的物理惩罚：物理、不是抓取、不是觉醒
const fPhysPenalty = (p, S) => !!S && (S.type || p.dmgType) === 'phys' && !S.grab && !S.awaken;
function fCdMul(p, id) {
  const S = SKILLS[id], F = fFeelOf(p); if (!S) return 1;
  return (fPhysPenalty(p, S) ? F.physCd : 1) * (F.jobCd && S.job && F.jobCd[S.job] || 1);
}

/* ---- 矢量占位模型的骨骼片段（美术到位后由 content/sprites.js 换成逐帧精灵；片段名 = SPR_ANIMS.fighter 的名字） ---- */
POSE.fJab = P(POSE.idle, { torso: -6, head: 4, uaF: 88, faF: 0, wF: -90, uaB: -30, faB: 70 });
POSE.fJabW = P(POSE.idle, { torso: 4, head: -2, uaF: 40, faF: 90, wF: -90, uaB: -20, faB: 80 });
POSE.fLowKick = P(POSE.idle, { torso: 18, head: -10, thF: 70, shF: -8, ftF: 10, thB: -16, shB: -14, uaF: 30, faF: 80, wF: -90, uaB: -40, faB: 60 });
POSE.fAxeUp = P(POSE.idle, { torso: 16, head: -12, thF: 170, shF: -2, ftF: 20, thB: -8, shB: -10, uaF: 20, faF: 80, uaB: -50, faB: 40 });
POSE.fAxeDown = P(POSE.idle, { torso: -14, head: 10, thF: 60, shF: -4, ftF: 0, thB: -24, shB: -30, uaF: 40, faF: 70, uaB: -30, faB: 60 });
POSE.fShoulder = P(POSE.dashS, { uaF: 30, faF: 100, wF: -90, uaB: -40, faB: 90 });
POSE.fJKick = P(POSE.jumpUp, { torso: 20, head: -10, thF: 100, shF: -6, ftF: 10, thB: 20, shB: -90, uaF: 40, faF: 80 });
POSE.fCrouch = P(POSE.idle, { g: 0, r: [0, 18, 0], torso: -30, head: 20, thF: 100, shF: -130, ftF: 30, thB: 60, shB: -120, ftB: 60, uaF: 50, faF: 90, uaB: 30, faB: 90 });
POSE.fHighW = P(POSE.idle, { torso: -16, head: 10, thF: 44, shF: -84, ftF: 24, thB: -12, shB: -34, uaF: 40, faF: 90, uaB: -20, faB: 80 });
POSE.fHighS = P(POSE.idle, { torso: 24, head: -14, thF: 178, shF: 0, ftF: 10, thB: -6, shB: -8, ftB: 20, uaF: 10, faF: 80, uaB: -60, faB: 50 });
POSE.fGrab = P(POSE.idle, { torso: -12, head: 8, uaF: 92, faF: 10, wF: -90, uaB: 80, faB: 20, thF: 30, shF: -30, thB: -20, shB: -14 });
POSE.fKnee = P(POSE.fGrab, { torso: -4, thF: 124, shF: -134, ftF: 20, thB: -8, shB: -6 });
POSE.fPalm = P(POSE.idle, { torso: -12, head: 8, uaF: 92, faF: -4, wF: -90, uaB: -40, faB: 70, thF: 34, shF: -20, thB: -30, shB: -12 });
POSE.fPalm2 = P(POSE.fPalm, { uaB: 88, faB: 0 });
POSE.fSeal = P(POSE.idle, { torso: -4, head: 2, uaF: 62, faF: 122, uaB: 60, faB: 122 });
POSE.fFocus = P(POSE.idle, { torso: 2, head: -4, uaF: -10, faF: 110, uaB: -10, faB: 110, thF: 26, shF: -30, thB: -26, shB: -30 });
POSE.fStomp = P(POSE.jumpFall, { torso: -10, head: 12, thF: 12, shF: -4, ftF: 0, thB: 34, shB: -100, uaF: 120, faF: 30, uaB: 110, faB: 30 });
POSE.fDive = P(POSE.jumpFall, { torso: -24, head: 14, thF: 40, shF: -2, ftF: 10, thB: -20, shB: -80, uaF: 60, faF: 60, uaB: -40, faB: 60 });
POSE.fQuake = P(POSE.land, { torso: -30, head: 20, uaF: 30, faF: 60, uaB: -30, faB: 60 });
CLIPS.fighter = { ...HUMAN_CLIPS,
  atk1: { dur: 0.26, fps: 24, keys: [k(0, POSE.fJabW, 'hold'), k(0.05, POSE.fJab, 'out'), k(0.14, POSE.fJab), k(0.26, POSE.idle)] },
  atk2: { dur: 0.28, fps: 24, keys: [k(0, POSE.kickW, 'hold'), k(0.04, POSE.fLowKick, 'out'), k(0.16, POSE.fLowKick), k(0.28, POSE.idle)] },
  atk3: { dur: 0.34, fps: 24, keys: [k(0, POSE.kickW, 'hold'), k(0.07, POSE.kickSide, 'out'), k(0.2, POSE.kickSide), k(0.34, POSE.idle)] },
  atk4: { dur: 0.46, fps: 24, keys: [k(0, POSE.fAxeUp, 'hold'), k(0.14, POSE.fAxeDown, 'out'), k(0.3, POSE.fAxeDown), k(0.46, POSE.idle)] },
  dash: { dur: 0.42, fps: 24, keys: [k(0, POSE.runA), k(0.05, POSE.fShoulder, 'hold'), k(0.28, POSE.fShoulder), k(0.42, POSE.idle)] },
  jatk: { dur: 0.34, fps: 24, keys: [k(0, POSE.jumpUp, 'hold'), k(0.06, POSE.fJKick, 'out'), k(0.34, POSE.jumpFall)] },
  crouch: { dur: 0.3, keys: [k(0, POSE.fCrouch)] },
  highkick: { dur: 0.46, fps: 24, keys: [k(0, POSE.fHighW, 'hold'), k(0.08, POSE.fHighS, 'out'), k(0.3, POSE.fHighS), k(0.46, POSE.idle)] },
  hammer: { dur: 0.5, fps: 24, keys: [k(0, POSE.kickW, 'hold'), k(0.08, POSE.kickSide, 'out'), k(0.3, POSE.kickSide), k(0.5, POSE.idle)] },
  grab: { dur: 0.4, keys: [k(0, POSE.fGrab)] },
  knee: { dur: 0.3, fps: 24, keys: [k(0, POSE.fGrab, 'hold'), k(0.06, POSE.fKnee, 'out'), k(0.3, POSE.fGrab)] },
  spinkick: { dur: 0.16, loop: true, fps: 16, keys: [k(0, P(POSE.kickSide, { g: 0 })), k(0.08, P(POSE.kickSide, { g: 0, thF: 110, torso: 36 }))] },
  stomp: { dur: 0.3, keys: [k(0, POSE.fStomp)] },
  dive: { dur: 0.3, keys: [k(0, POSE.fDive)] },
  palm: { dur: 0.3, fps: 24, keys: [k(0, POSE.fJabW, 'hold'), k(0.05, POSE.fPalm, 'out'), k(0.3, POSE.fPalm)] },
  palm2: { dur: 0.3, fps: 24, keys: [k(0, POSE.fSeal, 'hold'), k(0.06, POSE.fPalm2, 'out'), k(0.3, POSE.fPalm2)] },
  seal: { dur: 0.4, keys: [k(0, POSE.fSeal)] },
  focus: { dur: 0.4, keys: [k(0, POSE.fFocus)] },
  quake: { dur: 0.4, keys: [k(0, POSE.fQuake)] },
};

/* ---- 特效构件（全部复用 art/final/fx 运行时染色，不烘进人物帧） ---- */
const F_COL = { kick: '#fff0d8', wind: '#bfe4ff', nen: '#fff0a0', sand: '#d8b878', ghost: '#bfe4ff' };
// 踢腿弧光：fxSlash 的细弧（o 同 fxSlash：a0 / a1 起止角、r 半径、w 粗细、off 偏移、squash 压扁）
const fKick = (t, o) => evAt(t, e => { fxSlash({ x: e.x, y: e.y, z: e.z, face: e.face, col: o.col || F_COL.kick, w: 10, ...o }); if (!o.silent) sfx.swing(o.heavy); });
// 圆形范围打击（地面 (x,y) 为圆心、r 半径，纵深按透视压扁）：hf(t) 返回这个目标的攻击（null = 跳过），可以按目标改伤害（金刚碎 对倒地 +50%）；skip = 不打的目标集合
function fRing(e, x, y, r, hf, o = {}) {
  const src = { x, y, z: 0, face: e.face }; let n = 0;
  for (const t of ents) {
    if (!foe(e, t) || t.invul > 0 || (o.skip && o.skip.has(t)) || !inGround(t, x, y, r) || t.z > (o.zMax ?? 40)) continue;
    const h = hf(t); if (!h || (t.st === 'down' && !h.downHit)) continue;
    applyHit(e, t, { radial: true, ...h, box: null }, { proj: true, src }); n++;
  }
  return n;
}
// 沙粒：从手上扇形撒出的小颗粒（纯表现）
function fSandSpray(e) {
  const cols = ['#e8d098', '#c8a868', '#a88850', '#f0e0b0'];
  for (let i = 0; i < 30; i++) {
    const sp = rnd(320, 680), ang = rnd(-0.25, 0.55);
    addFx({ x: e.x + e.face * 20, y: e.y + rnd(-8, 8), z: e.z + rnd(24, 40), vx: e.face * sp * Math.cos(ang), vy: rnd(-90, 90), vz: sp * Math.sin(ang) * 0.5, dur: rnd(0.28, 0.46), col: cols[i % 4], s: rnd(2, 4),
      update(dt) { this.x += this.vx * dt; this.y += this.vy * dt * 0.3; this.z = Math.max(0, this.z + this.vz * dt); this.vz -= 700 * dt; this.vx *= 0.97; },
      draw(c) { const k = this.t / this.dur; c.globalAlpha = 1 - k * k; c.fillStyle = this.col; c.fillRect(sx(this.x) - this.s / 2, sy(this.y, this.z) - this.s / 2, this.s, this.s); c.globalAlpha = 1; } });
  }
  for (let i = 0; i < 4; i++) fxDust(e.x + e.face * (50 + i * 34), e.y, 2, 16, '#c8aa78');
  // 扇形沙雾：几团沙色烟往前飘、变大、变淡
  for (let i = 0; i < 4; i++) addFx({ x: e.x + e.face * 26, y: e.y + (i - 1.5) * 6, z: e.z + 30 + i * 6, vx: e.face * (260 + i * 70), vz: (i - 1) * 40, dur: 0.42, s: 30 + i * 6, rot: rnd(-0.5, 0.5),
    update(dt) { this.x += this.vx * dt; this.z = Math.max(4, this.z + this.vz * dt); this.vx *= 0.9; },
    draw(c) { const k = this.t / this.dur; drawSpr(c, 'dust', sx(this.x), sy(this.y, this.z), this.s * (0.7 + k * 1.3), 0, { add: false, rot: this.rot, alpha: 0.75 * (1 - k) }); } });
}
// 旋风腿的风：绕着身体转的两道弧 + 脚下扁平的风环
function fWind(e, n) {
  const a0 = n % 2 ? -0.6 : 2.5;
  fxSlash({ x: e.x, y: e.y, z: e.z, face: e.face, col: F_COL.wind, a0, a1: a0 + (n % 2 ? 2.6 : -2.6), r: 84, w: 14, off: [0, 50], squash: 0.42, dur: 0.12 });
  if (n % 2 === 0) fxSpr('wave', e.x, e.y, e.z + 14, { w: 190, h: 34, dur: 0.22, col: F_COL.wind, alpha: 0.7, grow: [0.8, 1.1] });
}

/* ---- 普攻：按武器手感生成（判定前沿 × reach、硬直 × stun），每种武器一张，passives 每 0.25 秒按武器 / BUFF 挑表 ----
   普攻 4 段：快拳（距离短）→ 下段踢（出招极快、贴地）→ 中段踢（= 前踢的动作）→ 下劈（击倒）；跑攻 肩撞；跳攻 空中踢；fchain1~4 = 疾风追击 / 疾风连击的追加击（算普攻） */
const F_CHAIN_MP = 8;   // 疾风追击：每一击都耗 MP（官方 Lv1 8）
function fighterActsFor(F) {
  const R = b => [b[0], Math.round(b[1] * F.reach), b[2], b[3], b[4]], S = s => +(s * F.stun).toFixed(3);
  const dashKeep = [HB(0.04, 0.24, R([0, 82, 34, 20, 100]), 1.3, { stun: S(0.55), knock: 70, hs: 0.07, shake: 2, snd: 'blunt' })];   // 学了疾风追击：肩撞不再击倒（敌人站着，方便追加）
  // 疾风追击的第 k 击：k = 1、2（基础），3、4（疾风连击）；没学疾风连击时第 2 击就是收尾（击退）
  const chainNext = k => p => { const nx = 'fchain' + (k + 1); return p.acts[nx] && p.mp >= F_CHAIN_MP && (k < 2 || hasSkill(p, 'f_chain2')) ? nx : null; };
  const chainAct = (k, clip, dmg, o) => ({ name: 'fchain' + k, clip, dur: 0.32, basic: true, speed: 'aspd', chain: [0.13, 0.32], next: k < 4 ? chainNext(k) : null, noCounter: true, move: [[0.02, 0.08, 130]],
    // 官方：追加击按 X 或疾风追击的技能键都行（技能键只在这里当 X 用，Z 等其他键照常取消到别的技能）
    onInput: (e, I) => { const s = barOf(e).indexOf('f_chain'), a = e.act; if (s < 0 || !a.next || e.actT < a.chain[0] || !I.buffered('s' + s)) return false;
      const nx = a.next(e); if (!nx) return false; I.consume('s' + s); faceInput(e, I.dx()); e.doAct(e.acts[nx]); return true; },
    onStart: e => { if (k > 1) e.mp = Math.max(0, e.mp - F_CHAIN_MP); if (k === 2 && !hasSkill(e, 'f_chain2')) e.act.hits = [HB(0.05, 0.12, R([0, 96, 36, 20, 105]), dmg, { stun: S(0.5), knock: 260, heavy: true, hs: 0.08, shake: 2, big: 1.3, snd: 'blunt', dmgKey: 'f_chain' })];
      fxStreak({ x: e.x + e.face * 16, y: e.y, z: e.z + 64, face: e.face, len: 70, w: 8, col: F_COL.wind, dur: 0.14 }); sfx.swing(k === 4); },
    hits: [HB(0.05, 0.12, R([0, 96, 36, 20, 105]), dmg, { stun: S(0.42), knock: 40, hs: 0.06, snd: 'blunt', dmgKey: 'f_chain', ...o })] });
  return {
    atk1: { name: 'atk1', dur: 0.26, basic: true, speed: 'aspd', chain: [0.1, 0.26], next: 'atk2', move: [[0.02, 0.06, 90]],
      hits: [HB(0.05, 0.09, R([0, 86, 32, 40, 100]), 0.85, { stun: S(0.28), knock: 40, hs: 0.05, snd: 'blunt' })],
      events: [evAt(0.04, e => { fxStreak({ x: e.x + e.face * 18, y: e.y, z: e.z + 66, face: e.face, len: 56, w: 6, col: F_COL.kick, dur: 0.1 }); sfx.swing(false); })] },
    // 下段踢：判定贴地（官方下段攻击；蹲伏的敌人也打得到）
    atk2: { name: 'atk2', dur: 0.28, basic: true, speed: 'aspd', chain: [0.1, 0.28], next: 'atk3', move: [[0.02, 0.06, 80]],
      hits: [HB(0.04, 0.08, R([0, 94, 32, 0, 42]), 0.9, { stun: S(0.3), knock: 40, hs: 0.05, snd: 'blunt' })],
      events: [fKick(0.03, { a0: 0.75, a1: -0.45, r: 62, w: 9, off: [8, 16], squash: 0.5, dur: 0.12 })] },
    atk3: { name: 'atk3', dur: 0.34, basic: true, speed: 'aspd', chain: [0.13, 0.34], next: 'atk4', move: [[0.03, 0.08, 110]],
      hits: [HB(0.07, 0.12, R([0, 104, 34, 20, 92]), 1.1, { stun: S(0.36), knock: 70, hs: 0.06, snd: 'blunt' })],
      events: [fKick(0.06, { a0: 1.25, a1: -0.35, r: 70, w: 11, off: [12, 40], squash: 0.7 })] },
    // 下劈：击倒
    atk4: { name: 'atk4', dur: 0.46, basic: true, speed: 'aspd', move: [[0.04, 0.12, 120]],
      hits: [HB(0.14, 0.2, R([0, 100, 36, 0, 120]), 1.5, { down: true, downLift: 160, knock: 120, hs: 0.09, shake: 3, big: 1.3, heavy: true, snd: 'blunt' })],
      events: [fKick(0.12, { a0: -1.95, a1: 1.2, r: 76, w: 13, off: [16, 44], heavy: true }), evAt(0.18, e => fxDust(e.x + e.face * 60, e.y, 3, 12))] },
    // 跑攻 肩撞：默认击倒；学了疾风追击（f_chain）后不击倒，肩撞后半段按 X 派生追加击（keyLinks）
    dash: { name: 'dash', dur: 0.42, basic: true, speed: 'aspd', move: [[0, 0.24, 400]], noCounter: true, keyLinks: { attack: 'f_chain' }, linkFrom: 0.16,
      hits: [HB(0.04, 0.24, R([0, 82, 34, 20, 100]), 1.3, { down: true, knock: 220, hs: 0.07, shake: 2, heavy: true, snd: 'blunt' })],
      onStart: e => { if (hasSkill(e, 'f_chain')) e.act.hits = dashKeep; },
      events: [evAt(0.03, e => { fxStreak({ x: e.x - e.face * 10, y: e.y, z: e.z + 60, face: e.face, len: 90, w: 12, col: F_COL.kick, dur: 0.2 }); fxDust(e.x - e.face * 12, e.y, 2, 6); sfx.swing(true); })] },
    // 跳攻 空中踢：踢过之后这次跳跃不能再用鹰踏（官方）
    jatk: { name: 'jatk', dur: 0.34, basic: true, speed: 'aspd', airOnly: true, lowGrav: 0.75, onStart: e => { e._fNoAW = true; },
      hits: [HB(0.06, 0.16, R([0, 84, 32, -30, 72]), 0.95, { stun: S(0.32), knock: 50, hs: 0.05, airLift: 160, snd: 'blunt' })],
      events: [fKick(0.05, { a0: 1.1, a1: -0.2, r: 62, w: 10, off: [10, 26], squash: 0.7 })] },
    fchain1: chainAct(1, 'atk1', 0.9), fchain2: chainAct(2, 'palm', 1.0), fchain3: chainAct(3, 'atk1', 1.0), fchain4: chainAct(4, 'palm2', 1.25, { knock: 280, heavy: true, stun: S(0.5), hs: 0.09, shake: 3, big: 1.3 }),
  };
}
const FIGHTER_ACTS_BY_W = {}; for (const w in FIGHTER_FEEL) FIGHTER_ACTS_BY_W[w] = fighterActsFor(FIGHTER_FEEL[w]);
const FIGHTER_ACTS = FIGHTER_ACTS_BY_W.knuckle;
const fActsOf = p => (p && FIGHTER_ACTS_BY_W[wtypeOf(p)]) || FIGHTER_ACTS;
// 普攻动作表按转职 / BUFF 挑选（气功师 龙虎啸：普攻 / 跑攻 / 跳攻全换）：转职文件往 FIGHTER_ACT_PICK 里登记 p => 动作表 | null
const FIGHTER_ACT_PICK = [];
function fighterActs(p) { for (const f of FIGHTER_ACT_PICK) { const A = f(p); if (A) return A; } return fActsOf(p); }

/* ---- 蹲伏状态（f_crouch 用）：受击盒压到 hurtH（只有下段判定打得到），dur 秒；X = onX(e)（地下城里是无敌肩撞），C = 起身 ---- */
function fCrouchAct(o = {}) {
  return { name: 'f_crouch', clip: 'crouch', dur: o.dur ?? 2, hurtH: o.hurtH ?? 18, noCounter: true, noAwk: true, backOk: false,
    onInput: (e, I) => {
      if (I.buffered('jump')) { while (I.consume('jump')); e.endAct(); return true; }   // 起身：这次按的 C 全部吃掉，不接着起跳
      if (o.onX && I.buffered('attack')) { while (I.consume('attack')); o.onX(e); return true; }
      return false;
    } };
}

/* =====================================================================
   基础技能（国服现版；等级按 SKILLS_OFFICIAL_common.md 第 7 节压缩，冷却写官方现版值，刷图时引擎统一 ×0.6，?rawcd 看原值）
   ===================================================================== */
defSkill('f_highkick', { name: '上踢', cls: 'fighter', lvReq: 1, lvStep: 3, mp: 10, cd: 2, type: 'phys', col: '#e0802a',
  desc: '先向前滑出一小步，再竖直向上猛踢，把敌人踢到空中。动作前半段固定霸体（不是几率）。上下方向的判定较窄。', pow: lv => skillDmg(1.8, 0.18, lv), ai: { kind: 'launch', r: [0, 100], dy: 22 },
  act: lv => ({ name: 'f_highkick', clip: 'highkick', dur: 0.46, superArmor: [0, 0.2], move: [[0.02, 0.1, 170]],
    hits: [HB(0.1, 0.19, [0, 100, 30, 0, 130], skillDmg(1.8, 0.18, lv), { launch: 560 + lv * 6, knock: 30, hs: 0.08, snd: 'blunt', shake: 2, big: 1.2 })],
    events: [evAt(0.02, e => fxDust(e.x - e.face * 6, e.y, 2, 6)), fKick(0.09, { a0: 1.5, a1: -1.75, r: 78, w: 13, off: [18, 42], heavy: true })] }) });
// 前踢：施放时再看方向键（官方：→ 踢得更远、← 原地踢出），所以在动作开头判定，不在施放瞬间（施放瞬间按 ← 会先转身）
defSkill('f_hammer', { name: '前踢', cls: 'fighter', lvReq: 1, mp: 10, cd: 2.7, type: 'phys', col: '#3a8ad0',
  desc: '侧身一记前踢，把敌人远远踢开（动作和普攻第 3 段相同）。踢出时按住 → 腿伸得更远、按住 ← 原地踢出。上下方向判定宽，贴地的判定窄，打不到倒地的敌人。',
  pow: lv => skillDmg(2.1, 0.21, lv), ai: { kind: 'poke', r: [0, 130], dy: 30 },
  act: lv => ({ name: 'f_hammer', clip: 'hammer', dur: 0.5, move: [[0.04, 0.12, 150]],
    hits: [HB(0.1, 0.19, [0, 124, 42, 22, 112], skillDmg(2.1, 0.21, lv), { knock: 420, stun: 0.55, airLift: 180, heavy: true, hs: 0.09, shake: 3, big: 1.3, snd: 'blunt' })],
    update: e => { const a = e.act; if (a.dir !== undefined || e.actT < 0.03) return; a.dir = e.pad ? e.pad.dx() * e.face : 0;
      if (a.dir > 0) { a.move = [[0.04, 0.14, 330]]; a.hits[0].box = [0, 150, 42, 22, 112]; } else if (a.dir < 0) a.move = null; },
    events: [evAt(0.1, e => { fxStreak({ x: e.x + e.face * 16, y: e.y, z: e.z + 62, face: e.face, len: e.act.dir > 0 ? 160 : 128, w: 13, col: F_COL.kick }); sfx.swing(true); })] }) });
// 下段踢：打倒地；命中后在被踢的敌人脚下出冲击波，打周围的敌人（直接被踢中的不吃冲击波）
function fLowWave(a, t, dmg) {
  const A = a.act; if (!A || A.name !== 'f_lowkick') return;
  (A._direct || (A._direct = new Set())).add(t);
  if (A._wave) return; A._wave = true;
  const x = t.x, y = t.y; fxShock(x, y, 130, '#ffe0a0'); fxDust(x, y, 5, 26);
  game.after(0.06, () => { if (!a.dead) fRing(a, x, y, 125, () => ({ dmg, stun: 0.5, knock: 90, hs: 0.04, downHit: true, snd: 'blunt' }), { skip: A._direct }); });
}
defSkill('f_lowkick', { name: '下段踢', cls: 'fighter', lvReq: 5, mp: 10, cd: 1.8, type: 'phys', col: '#c89a2a',
  desc: '贴地的下段踢，能踢到倒地的敌人，被踢中的敌人严重硬直。命中后在敌人脚下产生冲击波，波及周围的敌人（直接被踢中的敌人不吃冲击波）。',
  pow: lv => skillDmg(1.1, 0.11, lv) + skillDmg(0.9, 0.09, lv), infoExtra: lv => [['冲击波攻击力', pct(skillDmg(0.9, 0.09, lv))]], ai: { kind: 'poke', r: [0, 100], dy: 24 },
  act: lv => ({ name: 'f_lowkick', clip: 'atk2', dur: 0.42,
    hits: [HB(0.06, 0.13, [0, 104, 32, 0, 42], skillDmg(1.1, 0.11, lv), { downHit: true, otgLift: 60, stun: 0.75, knock: 50, hs: 0.07, snd: 'blunt', big: 1.1, onHit: (a, t) => fLowWave(a, t, skillDmg(0.9, 0.09, lv)) })],
    events: [fKick(0.05, { a0: 0.75, a1: -0.45, r: 66, w: 11, off: [8, 14], squash: 0.5, dur: 0.13 })] }) });
// 膝击：抓取（抓住期间自己无敌，能抓霸体 / 格挡中的敌人，抓不了“不可抓取”的敌人）→ 膝撞两下 → 最后一下把敌人挑到空中；柔道家的强化（多撞一下、↑ 一起跳起 / ↓ 摔地）由 B7 包一层
function fKneeHit(e, dmg, last) {
  const g = e.grabbed; if (!g) return;
  e.play('knee', true); sfx.swing(last); cam.shake = Math.max(cam.shake, last ? 3 : 1.5);
  fxBurst(g.x - e.face * 4, g.y, g.z + 46, last ? 110 : 70, '#ffd090');
  if (last) { e.invul = Math.max(e.invul, 0.3); throwGrab(e, { dmg, launch: 580, knock: 60, hs: 0.1, shake: 3, big: 1.4, snd: 'blunt' }); }
  else applyHit(e, g, { dmg, sure: true, hs: 0.06, snd: 'blunt', big: 1.1 });
}
defSkill('f_knee', { name: '膝击', cls: 'fighter', lvReq: 5, mp: 20, cd: 5, type: 'phys', grab: true, col: '#b83a3a',
  desc: '抓住面前的敌人，用膝盖连撞两下，最后一下把敌人挑到空中。抓住期间自己无敌；能抓住霸体、格挡中的敌人，抓不住体型太大 / 不可抓取的敌人（领主等）。普攻第 2 段（下段踢）之后马上接膝击 =“拖抓”。',
  pow: lv => skillDmg(0.2, 0.02, lv) + skillDmg(0.36, 0.036, lv) * 2 + skillDmg(2.0, 0.2, lv), ai: { kind: 'grab', r: [0, 70], dy: 18 },
  act: lv => ({ name: 'f_knee', clip: 'grab', dur: 0.42, noCounter: true, move: [[0.02, 0.08, 120]],
    hits: [HB(0.05, 0.15, [0, 80, 32, 0, 115], skillDmg(0.2, 0.02, lv), { grab: true, grabInvul: true, stun: 0.3, hs: 0.04, snd: 'blunt' })],
    onGrab: (e, t) => { const a = e.act; if (a.gT !== undefined) return; a.gT = e.actT; a.dur = e.actT + 0.95; a.move = null; e.vx = 0; t.heldClip = 'hit2';
      a.events = (a.events || []).concat([0.2, 0.44, 0.7].map((dt, i) => ({ t: a.gT + dt, done: false, fn: e2 => fKneeHit(e2, i < 2 ? skillDmg(0.36, 0.036, lv) : skillDmg(2.0, 0.2, lv), i === 2) }))); },
    hold: (e, t) => { const a = e.act, k = a.gT === undefined ? 0 : clamp((e.actT - a.gT) / 0.6, 0, 1); t.x = e.x + e.face * 30; t.y = e.y + 0.5; t.z = e.z + k * 28; t.face = -e.face; } }) });
// 分身：半透明的淡蓝色分身冲到身前排开，嘲讽周围的怪物（怪物优先打分身）、挡子弹、碰到的敌人硬直（霸体除外）；分身有 HP，被打太多会消失
function fGhostModel(o) {
  const M = CLASSES.fighter.model(), W = Object.create(M);
  W.draw = function (c, pose, t, opts) { const ga = c.globalAlpha; c.globalAlpha = ga * 0.45; M.draw(c, pose, t, opts); c.globalCompositeOperation = 'lighter'; c.globalAlpha = ga * 0.18; M.draw(c, pose, t, opts); c.globalCompositeOperation = 'source-over'; c.globalAlpha = ga; };
  return W;
}
defSummon('f_clone', { kind: 'follower', name: '分身', model: o => fGhostModel(o), clips: () => CLIPS.fighter, w: 13, d: 12, h: 100, speed: 520, weight: 3, life: 7, max: 10, over: 'oldest', keepRoom: false, col: F_COL.ghost, tags: ['clone'],
  type: 'phys', attacks: [], hp: o => o.hpMax * 0.12,
  onSpawn: s => { s.play('run', true); fxAura(s, F_COL.ghost, 0.4); },
  ai: (s, dt) => {
    if (s.goalX !== undefined) {   // 先冲到自己的站位
      const gx = s.goalX - s.x, gy = s.goalY - s.y;
      if (Math.abs(gx) > 8 || Math.abs(gy) > 4) { const l = Math.hypot(gx, gy) || 1; s.vx = gx / l * 520; s.vy = gy / l * 360; s.face = s.goalFace; s.setState('run'); return; }
      s.goalX = undefined; s.vx = s.vy = 0; s.setState('idle'); s.face = s.goalFace;
    }
    s.vx = s.vy = 0; if (s.st !== 'idle') s.setState('idle');
    s.tauntT = (s.tauntT || 0) - dt; s.bumpT = (s.bumpT || 0) - dt;
    if (s.tauntT <= 0) { s.tauntT = 0.5; for (const t of ents) if (foe(s.owner, t) && !t.dead && !t.fighter && Math.hypot(t.x - s.x, (t.y - s.y) * 2) < 460 && !(hasStatus(t, 'taunt') && t.status.taunt.src && t.status.taunt.src.skey === 'f_clone' && t.status.taunt.src !== s && !t.status.taunt.src.gone)) addStatus(t, 'taunt', 1, { src: s }); }
    // 碰到分身的敌人硬直（不造成伤害，只有受击反应；霸体 / 倒地 / 浮空的不算）
    if (s.bumpT <= 0) { s.bumpT = 0.5; for (const t of ents) if (foe(s.owner, t) && !t.dead && !t.fighter && (t.st === 'idle' || t.st === 'walk' || t.st === 'run' || t.st === 'act') && !hasSA(t) && !(t.act && t.act.breakable) && Math.abs(t.x - s.x) < t.w + s.w + 8 && Math.abs(t.y - s.y) < 16 && t.z < 30) {
      react(s.owner, t, { stun: 0.45, knock: 40 }, s, false, false); t.flash = 0.08; fxSpr('spark', t.x, t.y, t.z + 50, { w: 40, dur: 0.15, col: F_COL.ghost }); } }
  } });
defSkill('f_clone', { name: '分身', cls: 'fighter', lvReq: 5, mp: 6, cd: 7, type: 'phys', summon: true, col: '#6ab0e0', noForce: p => !skLv(p, 'fn_blast'),
  desc: '结印生成和技能等级同样数量的分身（持续 7 秒），分身冲到身前排开。怪物会优先攻击分身，分身能挡住子弹，碰到分身的敌人会硬直（霸体的敌人除外）。分身有 HP，被打得太多就会消失。不能在普攻中施放。',
  infoExtra: lv => [['分身数', lv + ' 个'], ['持续', '7 秒']], ai: { kind: 'buff', summon: 'f_clone' },
  act: lv => ({ name: 'f_clone', clip: 'seal', dur: 0.4, noCounter: true,
    events: [evAt(0.02, e => { fxCharge(e, F_COL.ghost, 4); sfx.charge(); }), evAt(0.2, e => { dismissSummons(e, 'f_clone', 'replaced'); const R = game.room;
      for (let i = 0; i < lv; i++) { const s = summon(e, 'f_clone', { lv, x: e.x, y: e.y }); if (!s) continue;
        s.goalX = e.x + e.face * (70 + 36 * i); s.goalY = clamp(e.y + [0, -16, 16][i % 3], 8, DEPTH - 8); s.goalFace = e.face; s.face = e.face;
        if (R) s.goalX = clamp(s.goalX, R.x0 + 24, R.x1 - 24); }
      fxBurst(e.x, e.y, e.z + 50, 90, F_COL.ghost); })] }) });
// 疾风追击：肩撞后按 X（或技能键）追加 2 击，每击耗 MP；追加的攻击算普攻（普攻能取消的技能都能取消它）。直接按技能键 = 原地打出第一击
defSkill('f_chain', { name: '疾风追击', cls: 'fighter', lvReq: 10, mp: F_CHAIN_MP, cd: 1.8, type: 'phys', col: '#3a6ad8', cmdNote: '跑攻中 X',
  desc: '学会后跑动攻击（肩撞）不再把敌人击倒；肩撞时按 X 追加 2 次连打（学了疾风连击再多 2 次），每一击都消耗 MP。追加的攻击算普通攻击，可以被普通攻击能取消的技能取消。',
  pow: lv => (0.9 + 1.0) * (1 + 0.08 * (lv - 1)), infoExtra: () => [['每击 MP', String(F_CHAIN_MP)]], ai: { kind: 'poke', r: [0, 100], dy: 22 },
  act: (lv, p) => ({ ...fActsOf(p).fchain1 }) });
defSkill('f_chain2', { name: '疾风连击', cls: 'fighter', lvReq: 16, maxLv: 1, passive: true, type: 'phys', col: '#2a5ab8', pre: { f_chain: 1 }, cmdNote: '跑攻中 X',
  desc: '【被动】疾风追击的追加攻击再多 2 次（最多 4 次）。需要疾风追击 Lv1。', pow: () => 1.0 + 1.25 });
// 钢筋铁骨：物理防御 / 体力（这里按受到的物理伤害减少折算）+ 受击时一定几率霸体
const fIronDef = lv => 0.03 + 0.007 * (lv - 1), fIronSA = lv => 0.05 + 0.01 * (lv - 1);
defSkill('f_iron', { name: '钢筋铁骨', cls: 'fighter', lvReq: 10, passive: true, type: 'phys', col: '#8a8a9a',
  desc: '【被动】把身体锻炼得像钢铁一样：物理防御和体力提高（受到的物理伤害减少），被击中时有一定几率进入 1 秒霸体（这一下不硬直）。',
  infoExtra: lv => [['受到的物理伤害', '-' + pct(fIronDef(lv))], ['受击霸体几率', pct(fIronSA(lv))]] });
// 瞬步：向前瞬移 210px（官方 200px × 1.05）；碰到敌人就停在敌人面前（只看横向和纵深，不看高度），被房间边缘挡住
defSkill('f_flash', { name: '瞬步', cls: 'fighter', lvReq: 10, maxLv: 1, mp: 14, cd: 5, type: 'phys', move: true, col: '#5ab0e8',
  desc: '瞬间向前移动 210px。碰到敌人时停在敌人面前。', infoExtra: () => [['距离', '210px']], ai: { kind: 'gap', r: [120, 320], dy: 30 },
  act: () => ({ name: 'f_flash', clip: 'dash', dur: 0.26, noCounter: true,
    onStart: e => { const R = game.room, x0 = e.x; let x1 = e.x + e.face * 210;
      for (const t of ents) if (foe(e, t) && !t.dead && Math.abs(t.y - e.y) < t.d + e.d + 4 && (t.x - e.x) * e.face > 0) { const stop = t.x - e.face * (t.w + e.w + 4); if ((stop - x1) * e.face < 0) x1 = (stop - x0) * e.face > 0 ? stop : x0; }
      if (R) x1 = clamp(x1, R.x0 + e.w, R.x1 - e.w);
      for (const k of [0, 0.34, 0.67]) { e.x = x0 + (x1 - x0) * k; fxAfterimage(e, F_COL.wind); }
      e.x = x1; e.vx = 0; fxDust(x0, e.y, 3, 10); fxDust(x1, e.y, 3, 10); fxStreak({ x: x0, y: e.y, z: e.z + 56, face: e.face, len: Math.abs(x1 - x0), w: 10, col: F_COL.wind, dur: 0.2 }); sfx.swing(false); } }) });
// 鹰踏：空中踩敌人再弹起来，最多踩 2 次，最后一踩最强（踩之前有一点前摇），每一踩都耗 MP；落地后才开始冷却；这次跳跃用过跳攻就不能用；每踩一次都能接别的空中技能
defSkill('f_airwalk', { name: '鹰踏', cls: 'fighter', lvReq: 15, mp: 10, cd: 7, type: 'phys', air: true, airOnly: true, col: '#5a8a3a', cmdNote: '空中 Z',
  req: p => !p._fNoAW || '跳跃攻击后不能用',
  desc: '跳跃中踩向前下方的敌人，踩中后借力弹起；弹起后再按一次（Z 或技能键）踩出最后一脚（有一点前摇，伤害最高）。最多踩 2 次，每一次都消耗 MP；每踩一次之后都可以接其他空中技能。落地后才开始冷却；跳跃攻击之后这次跳跃不能再用。',
  pow: lv => skillDmg(0.9, 0.09, lv) + skillDmg(3.1, 0.31, lv), infoExtra: lv => [['最后一踩攻击力', pct(skillDmg(3.1, 0.31, lv))]], ai: { kind: 'air', r: [0, 90], dy: 24 },
  act: lv => ({ name: 'f_airwalk', clip: 'dive', dur: 1.4, airOnly: true, noCounter: true,
    onStart: e => { const a = e.act; a.stage = 1; e.vz = Math.min(e.vz, -480); e.vx = e.face * 200; sfx.swing(false); },
    hits: [HB(0, 1.4, [-16, 50, 30, -70, 24], skillDmg(0.9, 0.09, lv), { stun: 0.45, knock: 20, airLift: 80, hs: 0.06, snd: 'blunt', onHit: a => fStomp(a, false) })],
    onInput: (e, I) => { const a = e.act;
      if (a.stage === 1 && a.bT !== undefined && e.actT - a.bT > 0.08 && (I.buffered('cmd') || (a.key && a.key !== 'cmd' && I.buffered(a.key)))) {
        I.consume('cmd'); if (a.key) I.consume(a.key); if (e.mp < 10) return true;
        e.mp -= 10; a.stage = 2; a.cancelable = false; a.w2 = e.actT + 0.14; a.lowGrav = 0.05; e.vz = 0; e.vx = 0; e.play('stomp', true); fxCharge(e, '#d8f0b0', 3); a.dur = e.actT + 1.4; return true; }
      return false; },
    update: e => { const a = e.act;
      if (a.stage === 2 && a.w2 !== undefined && e.actT >= a.w2) { a.w2 = undefined; a.lowGrav = 0; e.vz = -720; e.vx = e.face * 150; e.hitsDone.clear();
        a.hits = [HB(e.actT, e.actT + 1.2, [-18, 54, 32, -80, 24], skillDmg(3.1, 0.31, lv), { stun: 0.55, knock: 60, spike: 260, bounce: 0.4, hs: 0.1, shake: 3, big: 1.4, snd: 'blunt', onHit: a2 => fStomp(a2, true) })]; sfx.swing(true); } },
    onLand: e => { const a = e.act; e.vx = 0; fxDust(e.x, e.y, 4, 12); a.hits = null; a.onLand = null; a.onInput = null; a.airOnly = false; a.dur = e.actT + 0.14; e.play('land', true); } }) });
function fStomp(e, last) {
  const a = e.act; if (!a || a.name !== 'f_airwalk' || a.stomped === a.stage) return;
  // 同一帧踩到几个敌人只弹一次；这里在命中结算的循环里，不能把 hits 置空（null）
  a.stomped = a.stage; a.hits = []; a.bT = e.actT; e.vz = last ? 360 : 460; e.vx = e.face * (last ? 40 : 70); e.play('stomp', true);
  fxShock(e.x + e.face * 16, e.y, last ? 90 : 60, '#d8f0b0'); cam.shake = Math.max(cam.shake, last ? 3 : 1.5);
  a.cancelable = true; a.cancelFrom = e.actT + 0.05;   // 每踩一次之后可以接别的空中技能
  a.dur = e.actT + (last ? 0.3 : 0.55);
}
// 念气波：推掌放出念气团，飞到比身高稍远的地方；命中爆炸（半径 50px），光属性魔法伤害 + 感电 100% 3 秒；不穿透、硬直小，打空中的敌人挑得高一点。
// fNenShot(e, lv, o) 给气功师「蓄念炮」用：o = { sc 大小, pierce, dmg, life, speed, hit（覆盖命中字段）}
function fNenShot(e, lv, o = {}) {
  const sc = o.sc || 1, dmg = o.dmg ?? skillDmg(2.2, 0.22, lv), img = fxTint('orb', F_COL.nen), r = 50 * sc;
  const boom = pr => { if (pr.boomed) return; pr.boomed = true; fxBurst(pr.x, pr.y, pr.z + 14 * sc, 110 * sc, '#fff6c0'); fxSpr('spark', pr.x, pr.y, pr.z + 16 * sc, { w: 80 * sc, dur: 0.2, col: '#bfe4ff' }); sfx.hit('crit', false); };
  return spawnProj({ owner: e, x: e.x + e.face * 34, y: e.y, z: e.z + 44, vx: e.face * (o.speed || 560), face: e.face, life: o.life || 0.42, w: 18 * sc, d: 16 * sc, h: 30 * sc, pierce: !!o.pierce, shadow: 8 * sc,
    hit: { dmg, type: 'mag', elem: 'light', stun: 0.22, knock: 40, airLift: 300, hs: 0.05, snd: 'crit', col: '#fff6b0', big: 1.1 * sc,
      onHit: (a, t) => { addStatus(t, 'shock', 3, { src: a, hitDmg: atkOf(a, 'mag') * dmg * 0.11 }); fRing(a, t.x, t.y, r, x => x === t ? null : { dmg: dmg * 0.3, type: 'mag', elem: 'light', stun: 0.2, knock: 30, hs: 0.02 }, { zMax: 80 }); },
      ...(o.hit || {}) },
    onHitT: pr => boom(pr), onEnd: pr => boom(pr),
    update(pr) { if (Math.random() < 0.6) addFx({ x: pr.x - pr.face * 10, y: pr.y + 0.3, z: pr.z + 14 * sc + rnd(-6, 6), dur: 0.18, draw(c) { const k = this.t / this.dur; c.fillStyle = '#fff6c0'; c.globalAlpha = 0.8 * (1 - k); c.fillRect(sx(this.x) - 2, sy(this.y, this.z) - 2, 4, 4); c.globalAlpha = 1; } }); },
    draw(c, pr) { const X = sx(pr.x), Y = sy(pr.y, pr.z + 14 * sc); drawSpr(c, img, X, Y, 46 * sc, 46 * sc, { rot: pr.t * 9 }); drawSpr(c, 'spark', X, Y, 34 * sc, 34 * sc, { rot: -pr.t * 14, alpha: 0.6 }); } });
}
defSkill('f_nenshot', { name: '念气波', cls: 'fighter', lvReq: 15, mp: 15, cd: 2.5, type: 'mag', elem: 'light', cast: true, col: '#e8c83a', noForce: p => jobOf(p) !== 'nenmaster',
  desc: '推出一掌，放出念气团攻击前方（射程比身高稍远）。命中时爆炸，造成光属性魔法伤害并 100% 感电 3 秒；不能穿透，硬直很小。只有气功师能在普攻中取消施放；气功师学了「蓄念炮」可以按住蓄力。',
  pow: lv => skillDmg(2.2, 0.22, lv), infoExtra: () => [['感电', '100%，3 秒'], ['爆炸半径', '50px']], ai: { kind: 'proj', r: [0, 260], dy: 20 },
  act: lv => ({ name: 'f_nenshot', clip: 'palm', dur: 0.4, noCounter: true,
    events: [evAt(0.02, e => fxCharge(e, F_COL.nen, 2)), evAt(0.1, e => fNenShot(e, lv))] }) });
// 抛沙：贴身往前撒一把沙（下段判定、穿透、从身体中间扇形撒开，贴身也打得到），几率失明；有前后摇。只有街霸能在普攻中取消施放
const fBlindP = lv => Math.min(1, 0.5 + 0.04 * (lv - 1)), fBlindT = lv => 5 + 0.4 * (lv - 1);
defSkill('f_sand', { name: '抛沙', cls: 'fighter', lvReq: 10, mp: 15, cd: 3, type: 'phys', col: '#c8a050', noForce: p => jobOf(p) !== 'brawler',
  desc: '抓起一把沙子朝前方撒出（贴身也打得到，穿透，下段判定），命中的敌人有几率失明。出招前后都有破绽。只有街霸能在普攻中取消施放。',
  pow: lv => skillDmg(2.0, 0.2, lv), infoExtra: lv => [['失明几率', pct(fBlindP(lv))], ['失明时间', fBlindT(lv).toFixed(1) + ' 秒']], ai: { kind: 'poke', r: [0, 170], dy: 34 },
  act: lv => ({ name: 'f_sand', clip: 'crouch', dur: 0.58, noCounter: true,
    events: [evAt(0.18, e => { e.play('palm2', true); fSandSpray(e); sfx.swing(false);
      instantHit(e, { box: [-6, 178, 46, 0, 80], dmg: skillDmg(2.0, 0.2, lv), stun: 0.5, knock: 50, hs: 0.05, snd: 'blunt', col: '#f0e0b0',
        onHit: (a, t) => { if (Math.random() < fBlindP(lv)) addStatus(t, 'blind', fBlindT(lv), { src: a }); } }); })] }) });
// 蹲伏：蹲下 2 秒（受击盒和倒地时一样矮，只有下段判定打得到）；蹲着按 X = 肩撞（地下城里无敌，200%），按跳跃起身；跑动中施放会滑着蹲下
function fCrouchShoulder(e, lv) {
  e.doAct({ name: 'f_crouchX', clip: 'dash', dur: 0.42, speed: 'aspd', noCounter: true, move: [[0, 0.22, 380]], invul: game.pvp ? null : [0, 0.3],
    hits: [HB(0.03, 0.22, [0, 86, 34, 0, 100], skillDmg(2.0, 0.12, lv), { down: true, downLift: 180, knock: 200, hs: 0.07, shake: 2, heavy: true, snd: 'blunt' })],
    events: [evAt(0.02, e2 => { fxStreak({ x: e2.x - e2.face * 10, y: e2.y, z: e2.z + 56, face: e2.face, len: 90, w: 12, col: F_COL.kick, dur: 0.2 }); fxDust(e2.x, e2.y, 3, 8); sfx.swing(true); })] },
    { skill: 'f_crouch', lv, type: 'phys' });
}
defSkill('f_crouch', { name: '蹲伏', cls: 'fighter', lvReq: 15, mp: 3, cd: 2, type: 'phys', noHitCheck: true, col: '#6a6a8a',
  desc: '蹲下躲避攻击（2 秒，等级越高越久），蹲着时受击判定和倒地时一样矮，没有下段判定的攻击都打不到。蹲着按 X 用肩膀撞出去（地下城里撞出时无敌），按跳跃起身。跑动中施放会滑着蹲下。',
  infoExtra: lv => [['持续', (2 + 0.1 * (lv - 1)).toFixed(1) + ' 秒'], ['肩撞攻击力', pct(skillDmg(2.0, 0.12, lv))]], ai: { kind: 'guard' },
  act: (lv, p) => ({ ...fCrouchAct({ dur: 2 + 0.1 * (lv - 1), hurtH: 22, onX: e => fCrouchShoulder(e, lv) }), links: ['fs_pusher'],   // 散打：蹲伏中可以接铁山靠（官方）
    move: p && p.st === 'run' ? [[0, 0.26, 300]] : null, onStart: e => { fxDust(e.x, e.y, 3, 10); fxAura(e, '#9fb8d8', 0.3); } }) });
// 金刚碎：向前小跳（空中用方向键调落点，横向 / 纵深都能调），双脚踩地：落地踢 + 冲击波把周围的敌人挑到空中（霸体的除外），对倒地的敌人 +50%；后摇较长（等级越高越短），冲击波范围随等级变大
const fSeismicR = lv => 150 * (1 + 0.084 * (lv - 1));
defSkill('f_seismic', { name: '金刚碎', cls: 'fighter', lvReq: 15, mp: 20, cd: 5, type: 'phys', col: '#a0703a',
  desc: '向前小跳，双脚踩向地面：踩中的敌人受到踢击，同时产生冲击波把周围的敌人挑到空中（霸体的敌人不会被挑起），对倒地的敌人伤害 +50%。跳起时可以用方向键调整落点（前后、上下）。收招较慢，等级越高收招越快、冲击波越大。',
  pow: lv => skillDmg(0.9, 0.09, lv) + skillDmg(2.2, 0.22, lv), infoExtra: lv => [['冲击波半径', Math.round(fSeismicR(lv)) + 'px'], ['冲击波攻击力', pct(skillDmg(2.2, 0.22, lv))]], ai: { kind: 'aoe', r: [40, 220], dy: 40 },
  act: lv => ({ name: 'f_seismic', clip: 'jumpUp', dur: 2, noCounter: true,
    onStart: e => { e.vz = 470; e.z = Math.max(e.z, 1); e.vx = e.face * 190; e.vy = 0; sfx.jump(); fxDust(e.x, e.y, 3, 8); },
    onInput: (e, I) => { if (e.z > 1 && e.act.onLand) { const d = I.dx() * e.face; e.vx = e.face * (d > 0 ? 300 : d < 0 ? 70 : 190); e.vy = I.dy() * 150; } return false; },
    onLand: e => { const a = e.act; if (e.actT < 0.08) { e.vz = 0; return; }
      a.onLand = null; e.vx = e.vy = 0; e.play('quake', true); a.dur = e.actT + 0.3 + Math.max(0.04, 0.23 - 0.021 * (lv - 1));
      const r = fSeismicR(lv), x = e.x + e.face * 18; cam.shake = Math.max(cam.shake, 5); sfx.boom(0.7); fxShock(x, e.y, r + 20, '#e0b070'); fxShock(x, e.y, r * 0.6, '#fff0c0'); fxDust(x, e.y, 10, r * 0.5, '#b89870');
      for (let i = 0; i < 6; i++) { const ang = i / 6 * TAU; fxSpr('rock', x + Math.cos(ang) * r * 0.45, e.y + Math.sin(ang) * r * 0.15, 10 + rnd(0, 20), { w: rnd(16, 26), dur: 0.5, add: false, spin: rnd(-6, 6), grow: [1, 0.6] }); }
      instantHit(e, { box: [-24, 64, 30, 0, 70], dmg: skillDmg(0.9, 0.09, lv), launch: 480, knock: 40, hs: 0.06, snd: 'blunt', downHit: true });
      fRing(e, x, e.y, r, t => ({ dmg: skillDmg(2.2, 0.22, lv) * (t.st === 'down' ? 1.5 : 1), launch: 600, knock: 60, hs: 0.07, downHit: true, snd: 'blunt', big: 1.2 }), { zMax: 60 }); } }) });
// 旋风腿：原地高速旋转踢（男版不能移动），把打到的敌人往自己身前拉；地面 / 空中 / 后跳中都能用；身体稍微离地（最下段没有受击判定）；按跳跃取消，之后可以接空中技能。只有散打能在普攻中取消施放
const fTornadoN = lv => Math.min(9, 4 + Math.floor((lv - 1) / 2));
defSkill('f_tornado', { name: '旋风腿', cls: 'fighter', lvReq: 18, mp: 50, cd: 8, type: 'phys', air: true, col: '#4a9ad8', noForce: p => jobOf(p) !== 'striker',
  desc: '原地高速旋转连踢（1 级 4 段，等级越高段数越多），把打到的敌人往身前拉。地面、空中、后跳中都能用；旋转时身体稍微离地。旋转中按跳跃可以取消并跳起，之后能接空中技能。只有散打能在普攻中取消施放。',
  pow: lv => skillDmg(1.15, 0.06, lv) * fTornadoN(lv), infoExtra: lv => [['段数', fTornadoN(lv) + ' 段']], ai: { kind: 'aoe', r: [0, 100], dy: 34 },
  act: lv => { const n = fTornadoN(lv);
    return { name: 'f_tornado', clip: 'spinkick', dur: 0.16 + n * 0.1 + 0.18, noCounter: true, lowGrav: 0.001,
      onStart: e => { e.vz = 0; e.z = Math.max(e.z, 12); e.vx = e.vy = 0; sfx.swing(true); },
      onInput: (e, I) => { if (e.actT > 0.12 && I.buffered('jump')) { while (I.consume('jump')); e.endAct(); e.vz = e.jumpV * 0.85; e.z = Math.max(e.z, 1); e.jumpRun = false; e.setState('jump'); sfx.jump(); return true; } return false; },
      update: e => { e.vz = 0; e.vx = 0; e.vy = 0; const i = Math.floor(e.actT / 0.1); if (i !== e.act.ti && e.actT < 0.16 + n * 0.1) { e.act.ti = i; e.drawFlip = i % 2 === 1; fWind(e, i); if (i % 2) sfx.swing(false); } },
      onEnd: e => { e.drawFlip = false; },
      hits: [HB(0.12, 0.16 + n * 0.1, [-96, 108, 38, -12, 118], skillDmg(1.15, 0.06, lv), { rep: 0.1, max: n, radial: true, knock: -90, airLift: 200, stun: 0.35, hs: 0.035, snd: 'blunt' })] }; } });

/* ---- 职业定义 ---- */
CLASSES.fighter = { name: '格斗家', ready: false, hp0: 1800, hpPer: 150, mp0: 700, mpPer: 40, atk0: 480, atkPer: 58, str0: 7, strPer: 2.2, def0: 300, defPer: 28, crit: 0.08, speed: 165, runSpeed: 300,
  desc: '以拳脚为武器的武斗家。男格斗家主要用腿，上踢、膝击、下段踢衔接抓取与投技；转职后可以成为气功师、散打、街霸或柔道家。',
  model: () => buildSwordsman(PAL_FIGHTER, { weapon: null, hair: 'short', hat: 'bandana', scarf: false, pauldron: false, coatTail: false }),
  acts: FIGHTER_ACTS, slashCol: '#ffb04a', dmgType: 'phys', airMax: 1,
  res: { light: 20, dark: -20 },   // 官方：格斗家天生光抗 +20、暗抗 -20（progress.js recalcStats 读 C.res）
  skills: [...FIGHTER_IDS.base], start: ['f_highkick', 'f_hammer'], bar: ['f_highkick', 'f_hammer', ...Array(SKILL_SLOTS - 2).fill(null)],
  // 指令：[方向序列, 技能 id, 按键]（f 前 b 后 u 上 d 下；hold 按住→、holdd 按住↓、holdu 按住↑；按键省略 = Z，attack = X，buff = Space，jump = C）
  cmds: [['', 'f_highkick'], ['holdu', 'f_hammer'], ['holdd', 'f_lowkick'], ['hold', 'f_knee'], ['f', 'f_clone', 'buff'], ['uf', 'f_flash', 'buff'], ['', 'f_airwalk'],
    ['df', 'f_nenshot'], ['bf', 'f_sand'], ['dd', 'f_crouch', 'jump'], ['fu', 'f_seismic'], ['bdf', 'f_tornado', 'jump']],
  jobs: {}, passives: [] };
CLASSES.fighter.passives.push(p => {
  if (!(p.st === 'act' && p.act && p.act.basic)) p.acts = fighterActs(p);   // 普攻连段中途不换表
  if (p.z <= 0.5 && p.st !== 'act' && p.st !== 'jump') {
    p._fNoAW = false;   // 落地：跳攻后不能鹰踏的限制解除
    if (p._fAwCd !== undefined) { p.cool.f_airwalk = p._fAwCd; p._fAwCd = undefined; }   // 鹰踏：落地后才开始冷却
  }
});

/* ---- 职业钩子：基础 / 各转职往这里登记（照 sword.js SWORD_HOOKS）----
   onHit(p, t, h, dmg, act, opt) 命中；onHurt(p, a, h, dmg) 受击后；beforeHurt(p, a, h, opt) → { block, mul, minHp, noStun, noStatus } 受击前（多个结果：mul 相乘、block 优先）；
   onCast(p, id, act, how) 施放后（扣完 MP / 冷却之后；how = 'recast' 是再按）；cancelHook(p, act, id) → true = 允许这次技能取消（散打 柔化肌肉）；softCommit(p, act, id) 真放出来后扣次数 */
const FIGHTER_HOOKS = { onHit: [], onHurt: [], beforeHurt: [], onCast: [], cancelHook: [], softCommit: [] };
CLASSES.fighter.onHit = (p, t, h, dmg, act, opt) => { for (const f of FIGHTER_HOOKS.onHit) f(p, t, h, dmg, act, opt); };
CLASSES.fighter.onHurt = (p, a, h, dmg) => { for (const f of FIGHTER_HOOKS.onHurt) f(p, a, h, dmg); };
CLASSES.fighter.beforeHurt = (p, a, h, opt = {}) => {
  let r = null;
  for (const f of FIGHTER_HOOKS.beforeHurt) { const x = f(p, a, h, opt); if (!x) continue; if (x.block) return x; r = { ...r, ...x, mul: ((r && r.mul) || 1) * (x.mul || 1) }; }
  return r;
};
CLASSES.fighter.onCast = (p, id, act, how) => {
  if (how !== 'recast') { const m = fCdMul(p, id); if (m !== 1 && p.cool[id] > 0) p.cool[id] *= m; }   // 武器手感：臂铠物理技能冷却、拳套散打冷却
  for (const f of FIGHTER_HOOKS.onCast) f(p, id, act, how);
};
CLASSES.fighter.mpMul = (p, id) => fPhysPenalty(p, SKILLS[id]) ? fFeelOf(p).physMp : 1;   // 臂铠：物理技能 MP 变多（抓取除外）
CLASSES.fighter.cancelHook = (p, a, id) => FIGHTER_HOOKS.cancelHook.some(f => f(p, a, id));
CLASSES.fighter.softCommit = (p, a, id) => { for (const f of FIGHTER_HOOKS.softCommit) f(p, a, id); };
// 鹰踏：施放时先把冷却挂起（显示成很长），落地后再按原值开始（passives 里落地时恢复）
FIGHTER_HOOKS.onCast.push((p, id, act, how) => { if (id !== 'f_airwalk' || how === 'recast') return; p._fAwCd = p.cool.f_airwalk; p.cool.f_airwalk = 99; });
// 钢筋铁骨：受到的物理伤害减少；一定几率霸体（这一下不硬直，之后 1 秒霸体）
FIGHTER_HOOKS.beforeHurt.push((p, a, h, opt) => {
  const lv = skLv(p, 'f_iron'); if (!lv || h.grab) return null;
  const type = h.type || opt.type || (a && a.act && a.act.type) || (a && a.dmgType) || 'phys', r = { mul: type === 'phys' ? 1 - fIronDef(lv) : 1 };
  if (p.st !== 'held' && Math.random() < fIronSA(lv)) { r.noStun = true; p.superArmor = Math.max(p.superArmor, 1); fxText('钢筋铁骨', p.x, p.y, p.z + 16, { col: '#c8d0e0', size: 10, dur: 0.6 }); }
  return r;
});
