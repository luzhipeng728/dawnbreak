/* =====================================================================
   区域：格兰之森（官方经典版，大转移前）
   新增地下城：defineDungeon(id, {...})，再在某个区域场景的 gates 里放一个门即可
     mobs：[怪物, 权重]；boss：{ kind, lvl }；elite：精英房的怪；rooms：直达路线房间数（= 最少消耗的疲劳）
     hidden：隐藏地下城，满足 unlock（{ quest } 或 { clear }）后门才会出现
   ===================================================================== */
defineDungeon('lorien', { name: '洛兰', lvl: [1, 2], theme: 'forest', rooms: 3, branches: 1, cols: 4, mobs: [['goblin', 3], ['goblinThrower', 1]], boss: { kind: 'goblinChief', lvl: 3 }, clearExp: 260,
  desc: '艾尔文防线外的森林边缘。最近哥布林频繁出没，投掷哥布林的首领就藏在林子里。' });
defineDungeon('lorien_deep', { name: '洛兰深处', lvl: [2, 3], theme: 'forest', rooms: 4, branches: 1, cols: 4, mobs: [['goblin', 3], ['goblinThrower', 2], ['goblinCaptain', 1]], elite: 'goblinCaptain', boss: { kind: 'tauSoldierBoss', lvl: 4 }, clearExp: 460,
  desc: '洛兰的更深处，牛头兵在这里出没。小心它霸体的斧击和带眩晕的角撞。' });
defineDungeon('dark_woods', { name: '幽暗密林', lvl: [3, 5], theme: 'forestDark', rooms: 5, mobs: [['goblin', 2], ['goblinThrower', 2], ['goblinCaptain', 1], ['goblinBlue', 1], ['goblinRed', 1], ['tauSoldier', 1]], elite: 'tauSoldier', boss: { kind: 'tauBeast', lvl: 7 }, clearExp: 800,
  desc: '终日不见阳光的昏暗森林。牛头巨兽盘踞在最深处——它的咆哮能让人动弹不得，攻击慢但带霸体。' });
defineDungeon('dark_woods_deep', { name: '幽暗密林深处', lvl: [4, 7], theme: 'forestDark', rooms: 6, mobs: [['catDemon', 3], ['tauVanguard', 1], ['goblinCaptain', 1], ['goblinThrower', 1]], elite: 'tauVanguard', boss: { kind: 'catCurse', lvl: 9 }, clearExp: 1150, bgm: 'dungeon2',
  desc: '密林的最深处，猫妖们在此聚集。暗咒猫妖会快速跳扑抓挠，啃咬还会带上诅咒。' });
defineDungeon('thunder_ruins', { name: '雷鸣废墟', lvl: [6, 9], theme: 'ruins', rooms: 6, mobs: [['catDemon', 3], ['catGlow', 1], ['goblinCoward', 1], ['goblinFrost', 1], ['tauBeast', 0.5]], elite: 'catDemon', boss: { kind: 'goblinShaman', lvl: 11 }, clearExp: 1500, bgm: 'dungeon2',
  desc: '森林中的石头废墟，雷云终年不散。落雷凯诺会召唤落雷——地面出现黄色魔法阵时赶紧躲开，后跳也能躲。' });
defineDungeon('venom_ruins', { name: '猛毒雷鸣废墟', lvl: [8, 11], theme: 'ruinsPoison', rooms: 7, mobs: [['catDemon', 3], ['catGlow', 1], ['catVenom', 2], ['tauBeast', 0.5]], elite: 'catVenom', boss: { kind: 'catKing', lvl: 12 }, clearExp: 2000, bgm: 'dungeon2',
  desc: '弥漫毒雾的废墟。毒猫王会快速追击并下毒，被暴击时会喷出毒雾，近身时也会主动放毒。' });
defineDungeon('frozen_woods', { name: '冰霜幽暗密林', lvl: [9, 12], theme: 'frozenWoods', rooms: 5, hidden: true, unlock: { quest: 'q_hidden_frozen' }, mobs: [['catGlow', 1], ['tauGuard', 2], ['goblinFrost', 3]], elite: 'tauGuard', boss: { kind: 'frostMage', lvl: 12 }, clearExp: 2300, bgm: 'dungeon2',
  desc: '【隐藏地下城】被冰雪封住的幽暗密林。冰霜克拉赫会召唤一圈冰箭封路，还会叫来哥布林帮手。' });
defineDungeon('graca', { name: '格拉卡', lvl: [11, 14], theme: 'camp', rooms: 6, branches: 3, mobs: [['tauSoldier', 3], ['tauVanguard', 2], ['tauGuard', 1], ['tauBeast', 1], ['goblinRed', 2]], elite: 'tauBeast', boss: { kind: 'tauKing', lvl: 16 }, bossAdds: 3, clearExp: 3000, bgm: 'dungeon3',
  desc: '牛头怪的营地，俗称“牛圈”。牛头王萨乌塔会蓄力后正面地震，还会长距离角撞——趁它蓄力时打断它！' });
defineDungeon('blazing_graca', { name: '烈焰格拉卡', lvl: [12, 16], theme: 'campFire', rooms: 7, branches: 3, rows: 4, mobs: [['tauSoldier', 2], ['goblinRed', 3], ['goblinBomber', 2], ['tauBeast', 1]], elite: 'tauBeast', boss: { kind: 'flameMage', lvl: 17 }, clearExp: 4200, bgm: 'dungeon3',
  desc: '被烈焰吞没的格拉卡。烈焰彼诺修会召唤火陨石——地面出现六芒星时就是落点，还会召唤会自爆的哥布林。' });
defineDungeon('dark_thunder', { name: '暗黑雷鸣废墟', lvl: [14, 20], theme: 'ruinsDark', rooms: 7, branches: 3, rows: 4, hidden: true, unlock: { quest: 'q_hidden_dark' }, mobs: [['zombie', 3], ['zombieRed', 1], ['plague', 1], ['catVenom', 1]], elite: 'zombieRed', boss: { kind: 'boneLord', lvl: 19 }, bossAdds: 3, clearExp: 6000, bgm: 'abyss', bossBgm: 'boss',
  desc: '【隐藏地下城】阴森的僵尸废墟。盗尸者骨狱息会让地面结出白霜，几秒后白霜处会冻结——边打边跳吧。' });

/* ---- 区域地图：林间道路两旁是各个地下城的门 ---- */
defineScene('gf_lorien', { name: '格兰之森', area: '格兰之森 · 洛兰', kind: 'field', width: 2900, theme: 'forest', bgm: 'field',
  exits: [{ side: 'left', to: 'elvenguard' }, { side: 'right', to: 'gf_thunder' }],
  gates: [{ dungeon: 'lorien', x: 520 }, { dungeon: 'lorien_deep', x: 1120 }, { dungeon: 'dark_woods', x: 1720 }, { dungeon: 'dark_woods_deep', x: 2320 }] });
defineScene('gf_thunder', { name: '格兰之森', area: '格兰之森 · 雷鸣废墟', kind: 'field', width: 2500, theme: 'ruins', bgm: 'field',
  exits: [{ side: 'left', to: 'gf_lorien' }, { side: 'right', to: 'gf_graca' }],
  gates: [{ dungeon: 'thunder_ruins', x: 520 }, { dungeon: 'venom_ruins', x: 1200 }, { dungeon: 'frozen_woods', x: 1880 }] });
defineScene('gf_graca', { name: '格兰之森', area: '格兰之森 · 格拉卡', kind: 'field', width: 2500, theme: 'camp', bgm: 'field',
  exits: [{ side: 'left', to: 'gf_thunder' }],
  gates: [{ dungeon: 'graca', x: 520 }, { dungeon: 'blazing_graca', x: 1200 }, { dungeon: 'dark_thunder', x: 1880 }] });
