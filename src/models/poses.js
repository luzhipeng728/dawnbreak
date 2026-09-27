/* =====================================================================
   05. 人形姿势与动画片段（角度单位：度；见 02_rig 的角度约定）
   torso 负值 = 前倾；ua 0 = 下垂、+90 = 前平举、+180 = 上举；fa 正值 = 屈肘；
   th 正值 = 大腿前抬；sh 负值 = 屈膝；ft 用来把脚放平；wF 武器相对手的角度（0 = 与前臂垂直朝前）
   g: 0 表示不自动踩地（空中姿势）
   ===================================================================== */
const POSE = {};
POSE.idle = { r: [0, 0, 0], torso: -8, head: 6, uaB: -18, faB: 30, uaF: 25, faF: 40, wF: -40, thB: -14, shB: -12, ftB: 26, thF: 18, shF: -22, ftF: 4 };
POSE.idle2 = P(POSE.idle, { torso: -9, head: 8, uaF: 27, faF: 43, uaB: -15, faB: 34 });
// 走路（4 个关键姿势循环）
POSE.walkA = P(POSE.idle, { torso: -10, uaB: 18, faB: 30, thF: 28, shF: -6, ftF: -8, thB: -24, shB: -22, ftB: 34 });
POSE.walkB = P(POSE.idle, { torso: -10, uaB: 0, faB: 25, thF: 2, shF: -28, ftF: 18, thB: 10, shB: -52, ftB: 42 });
POSE.walkC = P(POSE.idle, { torso: -10, uaB: -22, faB: 30, thF: -22, shF: -24, ftF: 30, thB: 26, shB: -8, ftB: -6 });
POSE.walkD = P(POSE.idle, { torso: -10, uaB: 0, faB: 25, thF: 12, shF: -52, ftF: 40, thB: 0, shB: -26, ftB: 18 });
// 跑步：前倾、刀拖在身后
const RUNB = { torso: -24, head: 16, uaF: -38, faF: 24, wF: -64, uaB: 40, faB: 80 };
POSE.runA = P(POSE.idle, { ...RUNB, thF: 58, shF: -24, ftF: -12, thB: -42, shB: -48, ftB: 46, uaB: -30, faB: 70 });
POSE.runB = P(POSE.idle, { ...RUNB, thF: 18, shF: -90, ftF: 50, thB: 12, shB: -30, ftB: 20 });
POSE.runC = P(POSE.idle, { ...RUNB, thF: -40, shF: -52, ftF: 48, thB: 58, shB: -22, ftB: -10, uaB: 60, faB: 80 });
POSE.runD = P(POSE.idle, { ...RUNB, thF: 14, shF: -30, ftF: 22, thB: 18, shB: -92, ftB: 50 });
// 跳跃
POSE.jumpUp = P(POSE.idle, { g: 0, torso: -6, uaF: 55, faF: 50, wF: -20, uaB: -40, faB: 50, thF: 55, shF: -80, ftF: 30, thB: 5, shB: -60, ftB: 30 });
POSE.jumpFall = P(POSE.idle, { g: 0, torso: -2, uaF: 40, faF: 40, wF: -30, uaB: -20, faB: 40, thF: 25, shF: -35, ftF: 10, thB: -10, shB: -30, ftB: 25 });
POSE.land = P(POSE.idle, { torso: -18, head: 12, thF: 45, shF: -70, ftF: 25, thB: -5, shB: -75, ftB: 60 });
// 普攻 1：横斩
POSE.a1w = P(POSE.idle, { torso: 2, head: 4, uaF: 145, faF: 70, wF: 40, uaB: -30, faB: 30 });
POSE.a1s = P(POSE.idle, { torso: -22, head: 14, uaF: 78, faF: 4, wF: -8, uaB: -55, faB: 40, thF: 40, shF: -28, ftF: -10, thB: -30, shB: -10, ftB: 34 });
POSE.a1r = P(POSE.a1s, { torso: -16, uaF: 60, faF: 20, wF: -30 });
// 普攻 2：回身上撩
POSE.a2w = P(POSE.a1s, { torso: -26, uaF: 30, faF: 10, wF: -95 });
POSE.a2s = P(POSE.a1s, { torso: -4, head: 2, uaF: 170, faF: 12, wF: 30, uaB: -40 });
POSE.a2r = P(POSE.a2s, { uaF: 150, faF: 30 });
// 普攻 3：跃步重劈
POSE.a3w = P(POSE.idle, { torso: 6, head: 0, uaF: 190, faF: 70, wF: 70, uaB: 150, faB: 70, thF: 40, shF: -40, ftF: 0, thB: -20, shB: -20, ftB: 30 });
POSE.a3s = P(POSE.idle, { torso: -38, head: 26, uaF: 70, faF: -8, wF: -40, uaB: 60, faB: 20, thF: 60, shF: -55, ftF: 5, thB: -45, shB: -5, ftB: 45 });
POSE.a3r = P(POSE.a3s, { torso: -30, uaF: 55 });
// 冲刺攻击：突刺
POSE.dashS = P(POSE.idle, { torso: -34, head: 24, uaF: 95, faF: -5, wF: -85, uaB: -60, faB: 30, thF: 62, shF: -40, ftF: -2, thB: -50, shB: -10, ftB: 50 });
// 跳跃攻击：空中斜劈
POSE.jAtkW = P(POSE.jumpUp, { uaF: 170, faF: 60, wF: 50 });
POSE.jAtkS = P(POSE.jumpUp, { torso: -20, uaF: 60, faF: 0, wF: -60, thF: 40, shF: -60 });
// 上挑（浮空技）
POSE.upW = P(POSE.idle, { torso: -30, head: 20, uaF: 10, faF: 10, wF: -100, thF: 50, shF: -70, ftF: 30, thB: -30, shB: -40, ftB: 50 });
POSE.upS = P(POSE.idle, { torso: 8, head: -6, uaF: 185, faF: 10, wF: 30, uaB: -60, faB: 20, thF: 20, shF: -10, ftF: 0, thB: -20, shB: -30, ftB: 40 });
// 后跳
POSE.back = P(POSE.jumpFall, { torso: 12, head: -8, uaF: 20, faF: 60, wF: -50, uaB: -60, faB: 40, thF: 50, shF: -60, thB: 20, shB: -80 });
// 受击 / 浮空 / 倒地 / 起身
POSE.hit = P(POSE.idle, { torso: 16, head: -18, uaF: -20, faF: 30, wF: -60, uaB: -40, faB: 20, thF: 10, shF: -10, thB: -20, shB: -20 });
POSE.hit2 = P(POSE.hit, { torso: 22, head: -24, uaF: -35 });
POSE.air = P(POSE.idle, { g: 0, r: [0, -20, 40], torso: 30, head: -20, uaF: -70, faF: 20, wF: -70, uaB: -100, faB: 30, thF: 30, shF: -20, thB: 10, shB: -40 });
POSE.air2 = P(POSE.air, { r: [0, -20, 70], torso: 25, uaF: -90, uaB: -120, thF: 45 });
POSE.down = { g: 0, r: [0, -8, 90], torso: 8, head: -10, uaF: -150, faF: 20, wF: -40, uaB: -170, faB: 10, thF: 6, shF: -10, ftF: 20, thB: -4, shB: -6, ftB: 20 };
POSE.tuck = { g: 0, r: [0, 30, 0], torso: -70, head: 40, uaF: 60, faF: 120, wF: -60, uaB: 50, faB: 120, thF: 120, shF: -140, ftF: 40, thB: 110, shB: -140, ftB: 40 };
POSE.getup = P(POSE.idle, { torso: -40, head: 20, thF: 70, shF: -110, ftF: 40, thB: -10, shB: -120, ftB: 90, uaF: 40, faF: 60, uaB: 30, faB: 60 });

/* ---- 动画片段 ---- */
const k = (t, pose, ease) => ease ? [t, pose, ease] : [t, pose];
const CLIPS = window.CLIPS = { sword: {} };
const HUMAN_CLIPS = {
  idle: { dur: 1.2, loop: true, fps: 8, keys: [k(0, POSE.idle, 'smooth'), k(0.6, POSE.idle2, 'smooth')] },
  walk: { dur: 0.8, loop: true, fps: 12, keys: [k(0, POSE.walkA), k(0.2, POSE.walkB), k(0.4, POSE.walkC), k(0.6, POSE.walkD)] },
  run: { dur: 0.48, loop: true, fps: 14, keys: [k(0, POSE.runA), k(0.12, POSE.runB), k(0.24, POSE.runC), k(0.36, POSE.runD)] },
  jumpUp: { dur: 0.2, keys: [k(0, POSE.jumpUp)] },
  jumpFall: { dur: 0.3, keys: [k(0, POSE.jumpUp), k(0.3, POSE.jumpFall)] },
  land: { dur: 0.12, keys: [k(0, POSE.land), k(0.12, POSE.idle)] },
  atk1: { dur: 0.36, fps: 24, keys: [k(0, POSE.a1w, 'hold'), k(0.08, POSE.a1s, 'out'), k(0.16, POSE.a1r), k(0.36, POSE.idle)] },
  atk2: { dur: 0.38, fps: 24, keys: [k(0, POSE.a2w, 'hold'), k(0.08, POSE.a2s, 'out'), k(0.18, POSE.a2r), k(0.38, POSE.idle)] },
  atk3: { dur: 0.5, fps: 24, keys: [k(0, POSE.a3w, 'hold'), k(0.14, POSE.a3s, 'out'), k(0.26, POSE.a3r), k(0.5, POSE.idle)] },
  dash: { dur: 0.45, fps: 24, keys: [k(0, POSE.runA), k(0.06, POSE.dashS, 'hold'), k(0.3, POSE.dashS), k(0.45, POSE.idle)] },
  jatk: { dur: 0.35, fps: 24, keys: [k(0, POSE.jAtkW, 'hold'), k(0.08, POSE.jAtkS, 'out'), k(0.35, POSE.jumpFall)] },
  up: { dur: 0.5, fps: 24, keys: [k(0, POSE.upW, 'hold'), k(0.12, POSE.upS, 'out'), k(0.3, POSE.upS), k(0.5, POSE.idle)] },
  back: { dur: 0.35, keys: [k(0, POSE.back), k(0.35, POSE.jumpFall)] },
  hit: { dur: 0.3, fps: 16, keys: [k(0, POSE.hit2), k(0.12, POSE.hit), k(0.3, POSE.idle)] },
  air: { dur: 0.6, loop: true, fps: 10, keys: [k(0, POSE.air), k(0.3, POSE.air2)] },
  down: { dur: 0.3, keys: [k(0, POSE.down)] },
  getup: { dur: 0.4, fps: 12, keys: [k(0, POSE.down), k(0.18, POSE.getup), k(0.4, POSE.idle)] },
  // 闪避翻滚：抱团绕腰转一圈（r = [x, y, 角度]，g:0 不自动踩地）
  roll: { dur: 0.36, fps: 24, keys: [k(0, P(POSE.land, { g: 0, r: [0, 18, 0] })), k(0.06, P(POSE.tuck, { r: [0, 30, 60] })), k(0.14, P(POSE.tuck, { r: [0, 32, 190] })), k(0.24, P(POSE.tuck, { r: [0, 30, 320] })), k(0.36, P(POSE.land, { g: 0, r: [0, 16, 360] }))] },
};
Object.assign(CLIPS.sword, HUMAN_CLIPS);
// 技能用姿势
POSE.iaiW = P(POSE.idle, { torso: -28, head: 18, uaF: -40, faF: 70, wF: -95, uaB: 40, faB: 90, thF: 60, shF: -70, ftF: 10, thB: -40, shB: -50, ftB: 60 });
POSE.iaiS = P(POSE.dashS, { uaF: 85, faF: 0, wF: -5, uaB: -80, faB: 20 });
POSE.thrustA = P(POSE.dashS, { uaF: 88, faF: 0, wF: -88 });
POSE.thrustB = P(POSE.dashS, { uaF: 70, faF: 30, wF: -95, torso: -28 });
Object.assign(CLIPS.sword, {
  a3slam: { dur: 1.2, fps: 20, keys: [k(0, POSE.a3w, 'hold'), k(0.28, POSE.a3s), k(1.2, POSE.a3s)] },
  iai: { dur: 0.95, fps: 20, keys: [k(0, POSE.iaiW, 'hold'), k(0.4, POSE.iaiS, 'out'), k(0.7, POSE.iaiS), k(0.95, POSE.idle)] },
  flurry: { dur: 0.16, loop: true, fps: 24, keys: [k(0, POSE.thrustA), k(0.08, POSE.thrustB)] },
  spin: { dur: 0.55, fps: 20, keys: [k(0, POSE.a1s), k(0.12, POSE.a2w), k(0.24, POSE.a2s), k(0.4, POSE.a1r), k(0.55, POSE.idle)] },
});
