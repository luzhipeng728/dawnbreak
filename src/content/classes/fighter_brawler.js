/* =====================================================================
   格斗家转职：街霸（男，brawler）—— B0 空壳：只登记转职（J.ready:false = 转职窗口不显示；开发测试 ?fighter=1 强制开放），技能 / 动作 / 钩子由 B6 填。
   技能 id 前缀 fb_（FIGHTER_IDS.brawler 已定死，content/classes/fighter.js）；新动作片段写进 J.anims（content/sprites.js 并入 SPR_ANIMS.fighter），帧名同样用 fb_ 前缀。
   要做的：4 种投掷物装填 + 强化投掷 + 一次扔两个、按异常个数加伤、锁链、骑乘捶打、魔法职业（J.dmgType）
   ===================================================================== */
CLASSES.fighter.jobs.brawler = { art: 'job/brawler', name: '街霸', role: '中近距离 · 投掷 / 异常（魔法百分比）', armor: 'heavy', dmgType: 'mag', growth: { int: 1.08, vit: 1.05 },
  awakenName: '千手罗汉', awakenName2: '暗街之王', awakenName3: '归元·街霸', ready: false,
  desc: '在暗街里摸爬滚打出来的格斗家。毒瓶、毒针、砖块、罗网四种投掷物自动装填，敌人身上的异常越多伤害越高；锁链大招把一群敌人拖进来暴打。魔法百分比伤害职业。',
  skills: [], anims: {} };
