/* =====================================================================
   格斗家转职：散打（男，striker）—— B0 空壳：只登记转职（J.ready:false = 转职窗口不显示；开发测试 ?fighter=1 强制开放），技能 / 动作 / 钩子由 B5 填。
   技能 id 前缀 fs_（FIGHTER_IDS.striker 已定死，content/classes/fighter.js）；新动作片段写进 J.anims（content/sprites.js 并入 SPR_ANIMS.fighter），帧名同样用 fs_ 前缀。
   要做的：柔化肌肉（次数制强制中断 + 增伤，FIGHTER_HOOKS.cancelHook / softCommit）、霸体护甲、烈焰焚步变身 BUFF + 双重施放、拳套专属（WTYPES.boxing.jobs）
   ===================================================================== */
CLASSES.fighter.jobs.striker = { art: 'job/striker', name: '散打', role: '近战 · 连打（物理）', armor: 'light', growth: { str: 1.1, vit: 1.04 },
  awakenName: '武极', awakenName2: '极武皇', awakenName3: '归元·散打', ready: false,
  desc: '只相信自己拳脚的格斗家。柔化肌肉让散打技能之间可以强制衔接并提高伤害，霸体护甲撑住正面；一觉烈焰焚步点燃双腿，能把下一个技能双重施放。拳套只有散打能装备。',
  skills: [], anims: {} };
