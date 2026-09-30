/* =====================================================================
   格斗家转职：柔道家（男，grappler）—— B0 空壳：只登记转职（J.ready:false = 转职窗口不显示；开发测试 ?fighter=1 强制开放），技能 / 动作 / 钩子由 B7 填。
   技能 id 前缀 fg_（FIGHTER_IDS.grappler 已定死，content/classes/fighter.js）；新动作片段写进 J.anims（content/sprites.js 并入 SPR_ANIMS.fighter），帧名同样用 fg_ 前缀。
   要做的：抓取整树（h.grabInvul / grabMax / grabRange / grabDown / grabAir / onGrabFail、throwArc、addStatus(t, "hold")）、抓轰炮回退、滑行 / 连环抓取、二觉预约施放
   ===================================================================== */
CLASSES.fighter.jobs.grappler = { art: 'job/grappler', name: '柔道家', role: '近战 · 抓取 / 投技（物理）', armor: 'light', growth: { str: 1.1, vit: 1.06 },
  awakenName: '风林火山', awakenName2: '宗师', awakenName3: '归元·柔道家', ready: false,
  desc: '把抓取练到极致的格斗家。几乎所有技能都是抓取，抓住时自己无敌；抓不动的敌人自动改成抓轰炮，冲击波加上无视霸体的强制硬直。暴力抓取把周围的敌人一起卷过来。',
  skills: [], anims: {} };
