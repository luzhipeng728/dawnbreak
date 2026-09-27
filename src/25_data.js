/* =====================================================================
   25. 数据：区域与地下城表（原创名称，玩法结构参照原作格兰之森一带），职业补充信息
   mobs：[怪物, 权重]；boss：领主；rooms：直达路线房间数
   ===================================================================== */
const AREA = { name: '翠影林地' };
const DUNGEONS = {
  path: { id: 'path', name: '林边小径', lvl: [1, 2], theme: 'forest', rooms: 4, branches: 1, cols: 4, rows: 3, mobs: [['goblin', 3], ['goblinThrower', 1]], boss: { kind: 'goblinChief', lvl: 3 }, bossAdds: 2, clearExp: 260, bgm: 'dungeon', desc: '营地外围的林间小路，最近常有哥布林出没，拿它们练练手吧。' },
  deep: { id: 'deep', name: '林边深处', lvl: [2, 4], theme: 'forest', rooms: 5, branches: 2, cols: 4, rows: 3, mobs: [['goblin', 3], ['goblinThrower', 2], ['goblinCaptain', 1]], elite: 'goblinCaptain', boss: { kind: 'tauSoldierBoss', lvl: 5 }, bossAdds: 2, clearExp: 520, bgm: 'dungeon', desc: '林子更深处，牛头族的斥候在这里扎营。小心它们的霸体斧击和冲撞。' },
  shade: { id: 'shade', name: '幽影密林', lvl: [4, 7], theme: 'forestDark', rooms: 6, branches: 2, cols: 5, rows: 3, mobs: [['goblin', 2], ['goblinThrower', 2], ['goblinBlue', 1], ['goblinRed', 1], ['tauSoldier', 1]], elite: 'tauSoldier', boss: { kind: 'tauBeast', lvl: 8 }, bossAdds: 2, clearExp: 900, bgm: 'dungeon2', desc: '终日不见阳光的密林。牛头巨兽盘踞在最深处，它的咆哮能让人动弹不得。' },
  thunder: { id: 'thunder', name: '雷鸣遗迹', lvl: [6, 10], theme: 'ruins', rooms: 6, branches: 2, cols: 5, rows: 3, mobs: [['catDemon', 3], ['catGlow', 1], ['goblinBlue', 1], ['goblinCoward', 1], ['tauSoldier', 1]], elite: 'catDemon', boss: { kind: 'goblinShaman', lvl: 11 }, bossAdds: 2, clearExp: 1500, bgm: 'dungeon2', desc: '被雷云笼罩的古代遗迹。一名会召唤落雷的哥布林术士在此作祟——地面出现黄色法阵时赶紧躲开。' },
  venom: { id: 'venom', name: '毒雾遗迹', lvl: [8, 12], theme: 'ruinsPoison', rooms: 7, branches: 2, cols: 5, rows: 3, mobs: [['catDemon', 3], ['catGlow', 1], ['catVenom', 2], ['tauBeast', 0.5]], elite: 'catVenom', boss: { kind: 'catKing', lvl: 13 }, bossAdds: 2, clearExp: 2100, bgm: 'dungeon2', desc: '毒雾弥漫的遗迹深处，毒猫王带领着猫妖群。它移动极快，被暴击时会喷出毒雾。' },
  camp: { id: 'camp', name: '牛头营地', lvl: [11, 15], theme: 'camp', rooms: 6, branches: 3, cols: 5, rows: 3, mobs: [['tauSoldier', 3], ['tauBeast', 1], ['goblinRed', 2], ['goblinCaptain', 1]], elite: 'tauBeast', boss: { kind: 'tauKing', lvl: 16 }, bossAdds: 3, clearExp: 3000, bgm: 'dungeon3', desc: '牛头族的大本营。牛头王会蓄力后砸出地震，还会从远处低头冲撞——趁它蓄力时打断它！' },
  flame: { id: 'flame', name: '烈焰营地', lvl: [13, 18], theme: 'campFire', rooms: 7, branches: 3, cols: 5, rows: 4, mobs: [['tauSoldier', 2], ['goblinRed', 3], ['goblinBomber', 2], ['tauBeast', 1]], elite: 'tauBeast', boss: { kind: 'flameMage', lvl: 18 }, bossAdds: 2, clearExp: 4200, bgm: 'dungeon3', desc: '被烈焰吞没的营地。炎术士会召唤陨石，地面出现红色六芒星时就是落点，还会召唤自爆哥布林。' },
  abyss: { id: 'abyss', name: '亡者遗迹', lvl: [16, 22], theme: 'ruinsDark', rooms: 7, branches: 3, cols: 5, rows: 4, hidden: true, mobs: [['zombie', 3], ['zombieRed', 1], ['goblinBomber', 1], ['catVenom', 1]], elite: 'zombieRed', boss: { kind: 'boneLord', lvl: 22 }, bossAdds: 3, clearExp: 6000, bgm: 'abyss', bossBgm: 'boss', desc: '【隐藏地下城】阴森的亡者遗迹。骨狱领主会让地面结出白霜——几秒后白霜处会冻结，边打边跳吧。' },
};
Object.assign(CLASSES.sword, {
  desc: '手持太刀的近战剑士，连段流畅、浮空强势，指令技能丰富。', model: () => RIG_DATA.sword ? new ImageModel('sword') : buildSwordsman(),
  skills: ['upslash', 'triple', 'wave', 'slam', 'focus', 'iai', 'spin', 'flurry', 'rise', 'awaken'],
  start: ['upslash', 'triple', 'wave', 'spin'], bar: ['upslash', 'triple', 'wave', 'spin', null, null, null, null, null, null, null, null],
});
function cmdLabel(cls) { for (const [seq, id] of CLASSES[cls].cmds) if (SKILLS[id]) SKILLS[id].cmdTxt = `指令：${cmdText(seq)}+Z`; }
