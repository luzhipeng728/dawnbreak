/* =====================================================================
   转职外观（转职后一眼看出是谁）：每个转职 = 一条数据 + 可选的绘制钩子。官方依据与配方见 docs/JOB_VISUALS.md
   渲染在 models/job_fx.js（外观层 AvatarLayer 的 under / over 里调用），所以城镇、地下城、选角、个人信息、决斗、
   其他玩家（look.job 随 look 一起发出去）、组队影子、AI 对手（kit.job）都一样；覆盖层叠在最上面，任何时装 / 混搭都能用。
   字段（全部可选）：
     acc     头部配件 key（AVATAR_ACC，按头部锚点叠加）；noFace: 1 = 戴着它时不画时装眼镜
     arm     副手（鬼手）特效，锚点 F.oh（art/tools/avatar_hands.py）：{ col 颜色, h 火舌高度（游戏像素）, n 火舌数, a 透明度, motes 往上飘的光点颜色, drip 往下滴的血颜色 }
     eyes    眼睛发光（头部锚点 + JL_EYE[职业]；脸被挡住的帧不画）：{ col, r 半径, trail 1 = 移动时往后拖一道光（“红眼”）}
     spirit  身后常驻的小鬼神（fx/jv_wisp）：{ col, h 高度, a 透明度 }
     states  状态特效 [{ id, on(e) → 强度（0 = 没开）, fx }]，fx 可以组合：
               ghost { col, a }          身后跟着的鬼影（自己的着色剪影，移动时拖远一点）
               trail { col, a }          移动时的残影（最近 0.25 秒的帧）
               fade  { a, col }          无敌期间半透明（e.invul > 0），身上一层鬼火微光
               wisps { col, n }          身边环绕的鬼火（数量 = n + 强度）
               burn  { col, n, h }       全身燃烧：身后一圈着色轮廓 + 沿身体的火舌（强度越高越大越多）
               wtint col                 武器（含双持副手）染成这个颜色的光
     draw    (c, L, F, f, back, e) → 自定义钩子（back = true 画在人物身后，false 画在身前；坐标见 job_fx.js 头注释）
   新增一个转职的外观：在 JOB_LOOKS 里加一条（颜色 / 组件参数），需要特殊画法再写 draw；特效素材用 art/tools/jobvis_art.py 出。
   ===================================================================== */
// 阿修罗的 X 形眼罩（原来在 sword_asura.js，只给自己看；挪到这里后其他玩家也看得到）
AVATAR_ACC.job_asura_eyes = { img: 'asura_face', face: 1, pos: { sword: [9, 25, 0, 0.66], 'sword@': [9, 25, 0, 0.66] } };

const JOB_LOOKS = {
  // 鬼泣：左臂鬼手冒紫色鬼火、身后跟着一只小鬼神；残影之凯贾（俗称鬼影步）= 身后鬼影 + 残影 + 前冲无敌时半透明；阵在场时身边鬼火环绕（鬼影重重）
  soulbender: {
    col: '#9a6aff',
    arm: { col: '#8a5cff', h: 30, n: 2, a: 0.95, motes: '#c8b0ff' },
    spirit: { col: '#9a7aff', h: 38, a: 0.8 },
    states: [
      { id: 'kaiga', on: e => e.buffs && e.buffs.sb_kaiga ? 1 : 0, fx: { ghost: { col: '#7a6aff', a: 0.42 }, trail: { col: '#9a8aff', a: 0.45 }, fade: { a: 0.45, col: '#b8a8ff' } } },
      { id: 'field', on: e => typeof summonsOf === 'function' ? Math.min(3, summonsOf(e, { tag: 'field' }).length) : 0, fx: { wisps: { col: '#9a7aff', n: 1 } } },
    ],
  },
  // 狂战士（红眼）：眼睛红光 + 移动时拖出红色光带、鬼手滴血冒血气；狂暴之力 = 全身血焰 + 双刀染红；暴走再叠一层（火更大更多）
  berserker: {
    col: '#e01020',
    arm: { col: '#ff1a30', h: 26, n: 2, a: 0.9, motes: '#ff7a6a', drip: '#9a0018' },
    eyes: { col: '#ff1a28', r: 3.2, trail: 1 },
    states: [
      { id: 'burn', on: e => e.buffs ? (e.buffs.frenzy ? 1 : 0) + (e.buffs.rampage ? 1 : 0) : 0, fx: { burn: { col: '#ff2a2a', n: 8, h: 34 } } },
      { id: 'frenzy', on: e => e.buffs && e.buffs.frenzy ? 1 : 0, fx: { wtint: '#ff2030' } },
    ],
  },
  asura: { acc: ['job_asura_eyes'], noFace: 1 },
};
// look.acc 里加上转职配件（戴眼罩的转职去掉时装眼镜）
function jobLookAcc(job, acc) {
  const J = job && JOB_LOOKS[job]; if (!J || !J.acc) return acc || [];
  const a = (acc || []).filter(k => !(J.noFace && AVATAR_ACC[k] && AVATAR_ACC[k].face) && !J.acc.includes(k));
  return a.concat(J.acc);
}
