/* =====================================================================
   格斗家转职：气功师（男，nenmaster）—— B0 空壳：只登记转职（J.ready:false = 转职窗口不显示；开发测试 ?fighter=1 强制开放），技能 / 动作 / 钩子由 B4 填。
   技能 id 前缀 fn_（FIGHTER_IDS.nenmaster 已定死，content/classes/fighter.js）；新动作片段写进 J.anims（content/sprites.js 并入 SPR_ANIMS.fighter），帧名同样用 fn_ 前缀。
   要做的：念气环绕（最多 5 颗念气珠）、念兽·龙虎啸换普攻（FIGHTER_ACT_PICK）、风雷能量槽 + HUD 小条、念气罩队伍无敌（net/party_sync.js）、金雷虎骑乘
   ===================================================================== */
CLASSES.fighter.jobs.nenmaster = { art: 'job/nenmaster', name: '气功师', role: '中距离 · 念气（光属性魔法）', armor: 'cloth', dmgType: 'mag', growth: { int: 1.1, spr: 1.05 },
  awakenName: '狂虎帝', awakenName2: '念皇', awakenName3: '归元·气功师', ready: false,
  desc: '以念气为武器的格斗家。念气珠环绕周身自动出击，念兽·龙虎啸让普攻化为光属性魔法，二觉的风雷能量槽攒满后开启风雷啸；念气罩护住罩内的队友。光属性魔法伤害职业。',
  skills: [], anims: {} };
