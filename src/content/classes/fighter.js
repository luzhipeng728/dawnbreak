/* =====================================================================
   职业：格斗家（男，key `fighter`）—— B0 骨架（docs/CLASS_PLAN_FIGHTER.md §4.1；官方技能见 docs/SKILLS_OFFICIAL_fighter.md）
   现状：ready:false（选角显示“即将开放”；开发测试用网址 ?fighter=1 强制开放，见 content/classes/common.js clsOpen）；
         普攻 4 段占位（快拳 → 下段踢 → 中段踢 → 下劈）、跑攻肩撞、跳攻空中踢，还没有技能；美术到位前是矢量占位模型（鬼剑士骨架换色、不拿武器）。
   约定：代码里一律写 p.cls === 'fighter'（实体上的 e.fighter 是“格斗者 = 玩家类实体”，和本职业无关，别写成 p.fighter）。
   转职（各自的文件登记 CLASSES.fighter.jobs.<id>，J.ready:false 做完再开）：气功师 fighter_nen.js、散打 fighter_striker.js、街霸 fighter_brawler.js、柔道家 fighter_grappler.js
   分工：本文件之后归 B3（基础职业）；B4~B7 只改自己的转职文件，往 FIGHTER_HOOKS / FIGHTER_ACT_PICK 里登记，不改这里。
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
CLIPS.fighter = { ...HUMAN_CLIPS,
  atk1: { dur: 0.26, fps: 24, keys: [k(0, POSE.fJabW, 'hold'), k(0.05, POSE.fJab, 'out'), k(0.14, POSE.fJab), k(0.26, POSE.idle)] },
  atk2: { dur: 0.28, fps: 24, keys: [k(0, POSE.kickW, 'hold'), k(0.04, POSE.fLowKick, 'out'), k(0.16, POSE.fLowKick), k(0.28, POSE.idle)] },
  atk3: { dur: 0.34, fps: 24, keys: [k(0, POSE.kickW, 'hold'), k(0.07, POSE.kickSide, 'out'), k(0.2, POSE.kickSide), k(0.34, POSE.idle)] },
  atk4: { dur: 0.46, fps: 24, keys: [k(0, POSE.fAxeUp, 'hold'), k(0.14, POSE.fAxeDown, 'out'), k(0.3, POSE.fAxeDown), k(0.46, POSE.idle)] },
  dash: { dur: 0.42, fps: 24, keys: [k(0, POSE.runA), k(0.05, POSE.fShoulder, 'hold'), k(0.28, POSE.fShoulder), k(0.42, POSE.idle)] },
  jatk: { dur: 0.34, fps: 24, keys: [k(0, POSE.jumpUp, 'hold'), k(0.06, POSE.fJKick, 'out'), k(0.34, POSE.jumpFall)] },
  crouch: { dur: 0.3, keys: [k(0, POSE.fCrouch)] },
};

/* ---- 普攻（占位，B3 按官方重做）：动作表按武器手感生成（判定前沿 × reach、硬直 × stun），每种武器一张，passives 每 0.25 秒按武器 / BUFF 挑表 ---- */
function fighterActsFor(F) {
  const R = b => [b[0], Math.round(b[1] * F.reach), b[2], b[3], b[4]], S = s => +(s * F.stun).toFixed(3);
  return {
    atk1: { name: 'atk1', dur: 0.26, basic: true, speed: 'aspd', chain: [0.1, 0.26], next: 'atk2', move: [[0.02, 0.06, 90]],
      hits: [HB(0.05, 0.09, R([0, 70, 30, 40, 100]), 0.85, { stun: S(0.28), knock: 40, hs: 0.05, snd: 'blunt' })] },
    // 下段踢：判定贴地（官方下段攻击；蹲伏的敌人也打得到）
    atk2: { name: 'atk2', dur: 0.28, basic: true, speed: 'aspd', chain: [0.1, 0.28], next: 'atk3', move: [[0.02, 0.06, 80]],
      hits: [HB(0.04, 0.08, R([0, 78, 30, 0, 40]), 0.9, { stun: S(0.3), knock: 40, hs: 0.05, snd: 'blunt' })] },
    atk3: { name: 'atk3', dur: 0.34, basic: true, speed: 'aspd', chain: [0.13, 0.34], next: 'atk4', move: [[0.03, 0.08, 110]],
      hits: [HB(0.07, 0.12, R([0, 88, 32, 20, 90]), 1.1, { stun: S(0.36), knock: 70, hs: 0.06, snd: 'blunt' })] },
    // 下劈：击倒
    atk4: { name: 'atk4', dur: 0.46, basic: true, speed: 'aspd', move: [[0.04, 0.12, 120]],
      hits: [HB(0.14, 0.2, R([0, 84, 34, 0, 110]), 1.5, { down: true, downLift: 160, knock: 120, hs: 0.09, shake: 3, big: 1.3, heavy: true, snd: 'blunt' })] },
    // 跑攻 肩撞：默认击倒；疾风追击（f_chain，B3）学了以后跑攻中按 X 派生（keyLinks；技能没定义时什么也不发生）
    dash: { name: 'dash', dur: 0.42, basic: true, speed: 'aspd', move: [[0, 0.24, 400]], noCounter: true, keyLinks: { attack: 'f_chain' }, linkFrom: 0.08,
      hits: [HB(0.04, 0.24, R([0, 64, 30, 20, 90]), 1.3, { down: true, knock: 220, hs: 0.07, shake: 2, heavy: true, snd: 'blunt' })] },
    jatk: { name: 'jatk', dur: 0.34, basic: true, speed: 'aspd', airOnly: true, lowGrav: 0.75,
      hits: [HB(0.06, 0.16, R([0, 72, 30, -30, 70]), 0.95, { stun: S(0.32), knock: 50, hs: 0.05, airLift: 160, snd: 'blunt' })] },
  };
}
const FIGHTER_ACTS_BY_W = {}; for (const w in FIGHTER_FEEL) FIGHTER_ACTS_BY_W[w] = fighterActsFor(FIGHTER_FEEL[w]);
const FIGHTER_ACTS = FIGHTER_ACTS_BY_W.knuckle;
// 普攻动作表按转职 / BUFF 挑选（气功师 龙虎啸：普攻 / 跑攻 / 跳攻全换）：转职文件往 FIGHTER_ACT_PICK 里登记 p => 动作表 | null
const FIGHTER_ACT_PICK = [];
function fighterActs(p) { for (const f of FIGHTER_ACT_PICK) { const A = f(p); if (A) return A; } return FIGHTER_ACTS_BY_W[wtypeOf(p)] || FIGHTER_ACTS; }

/* ---- 蹲伏状态（f_crouch 用，B3 接技能）：受击盒压到 hurtH（只有下段判定打得到），dur 秒；X = onX(e)（地下城里是无敌肩撞），C = 起身 ---- */
function fCrouchAct(o = {}) {
  return { name: 'f_crouch', clip: 'crouch', dur: o.dur ?? 2, hurtH: o.hurtH ?? 18, noCounter: true, noAwk: true, backOk: false,
    onInput: (e, I) => {
      if (I.buffered('jump')) { while (I.consume('jump')); e.endAct(); return true; }   // 起身：这次按的 C 全部吃掉，不接着起跳
      if (o.onX && I.buffered('attack')) { while (I.consume('attack')); o.onX(e); return true; }
      return false;
    } };
}

/* ---- 职业定义 ---- */
CLASSES.fighter = { name: '格斗家', ready: false, hp0: 1800, hpPer: 150, mp0: 700, mpPer: 40, atk0: 480, atkPer: 58, str0: 7, strPer: 2.2, def0: 300, defPer: 28, crit: 0.08, speed: 165, runSpeed: 300,
  desc: '以拳脚为武器的武斗家。男格斗家主要用腿，上踢、膝击、下段踢衔接抓取与投技；转职后可以成为气功师、散打、街霸或柔道家。',
  model: () => buildSwordsman(PAL_FIGHTER, { weapon: null, hair: 'short', hat: 'bandana', scarf: false, pauldron: false, coatTail: false }),
  acts: FIGHTER_ACTS, slashCol: '#ffb04a', dmgType: 'phys', airMax: 1,
  res: { light: 20, dark: -20 },   // 官方：格斗家天生光抗 +20、暗抗 -20（progress.js recalcStats 读 C.res）
  skills: [], start: [], bar: Array(SKILL_SLOTS).fill(null),
  // 指令：[方向序列, 技能 id, 按键]（f 前 b 后 u 上 d 下；hold 按住→、holdd 按住↓、holdu 按住↑；按键省略 = Z，attack = X，buff = Space，jump = C）
  cmds: [], jobs: {}, passives: [] };
CLASSES.fighter.passives.push(p => {
  if (!(p.st === 'act' && p.act && p.act.basic)) p.acts = fighterActs(p);   // 普攻连段中途不换表
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
