/* =====================================================================
   区域：天空之城（官方经典版，大转移前位于西海岸，16 级可进入；本作从 Lv14 开放）
   据说是天界通往阿拉德大陆的唯一通道。爆龙王巴卡尔的部下光之城主赛格哈特封锁了这里，
   格兰之森的大火让魔法阵的力量减弱，冒险家终于可以登上天空之城。
   入口：西海岸 · 商贸区东端的云梯（世界组在 west_coast 加的 up 出口，minLv 14）。
   地下城从左到右等级递增：龙人之塔 → 人偶玄关 → 石巨人塔 → 黑暗玄廊 → 城主宫殿，最右边是隐藏的悬空城。
   怪物与领主见 content/monsters/sky_castle.js，背景主题见 content/themes/sky_castle.js。
   ===================================================================== */
defineDungeon('dragon_tower', { name: '龙人之塔', lvl: [14, 16], theme: 'skyTower', rooms: 6, branches: 2, mobs: [['wyvern', 3], ['wyvernBlue', 2], ['dragonman', 3], ['minius', 1]], elite: 'minius', boss: { kind: 'lucas', lvl: 17 }, bossAdds: 2, clearExp: 4800, bgm: 'dungeon',
  desc: '天空之城的第一层。受魔法阵影响，这里的龙族进化成了龙人。鲁卡斯会放电、落下囚笼、召唤分身——领主房两侧的龙之雕像会一直喷火，先打掉它们。' });
defineDungeon('puppet_hall', { name: '人偶玄关', lvl: [15, 17], theme: 'skyHall', rooms: 6, branches: 2, mobs: [['puppeteer', 3], ['puppeteerRock', 2], ['dragonman', 2], ['minius', 1], ['puppeteerIce', 0.4]], elite: 'puppeteerRock', boss: { kind: 'dogrey', lvl: 18 }, bossAdds: 2, clearExp: 5400, bgm: 'dungeon2',
  desc: '摆满冰冷石像的玄关，人偶师在暗处施法——脚下出现红圈时后跳就能躲开。人偶之王道格里会连放三次石柱、用丝线把人拖过去，还会扔石化石弹。' });
defineDungeon('golem_tower', { name: '石巨人塔', lvl: [16, 19], theme: 'skyTower', rooms: 7, branches: 3, rows: 4, mobs: [['golem', 3], ['golemBronze', 2], ['puppeteer', 2], ['puppeteerRock', 1]], elite: 'golemMaster', boss: { kind: 'platani', lvl: 20 }, bossAdds: 2, clearExp: 6400, bgm: 'dungeon3',
  desc: '魔法生命体石巨人把守的高塔。打倒石巨人操纵师，石巨人会一起崩裂。黄金巨人普拉塔尼几乎不会硬直，但连续冲撞之后会过热——那就是反击的时机。' });
defineDungeon('dark_corridor', { name: '黑暗玄廊', lvl: [18, 21], theme: 'skyDark', rooms: 7, branches: 3, rows: 4, mobs: [['kargo', 2.5], ['kargoGoggle', 1.5], ['expeller', 3], ['expellerAxe', 1.5]], elite: 'expellerAxe', boss: { kind: 'skyExpeller', lvl: 22 }, bossAdds: 3, clearExp: 7600, bgm: 'abyss', bossBgm: 'boss',
  desc: '伸手不见五指的长廊。夜视镜卡格会让四周更黑，先解决它。光之城主的亲卫队长天之驱逐者会落下 1~3 列雷电（总有一条安全通道）并长距离冲刺。' });
defineDungeon('lord_palace', { name: '城主宫殿', lvl: [20, 23], theme: 'skyPalace', rooms: 8, branches: 3, rows: 4, mobs: [['minius', 2], ['puppeteerRock', 2], ['golemBronze', 2], ['expeller', 2], ['expellerAxe', 1], ['kargoGoggle', 1]], elite: 'hughes', boss: { kind: 'seghart', lvl: 24 }, bossAdds: 3, clearExp: 10800, bgm: 'dungeon3',
  desc: '天空之城的最顶层。光之城主赛格哈特会甩动长发、放出光环；雷电密布时要么贴身要么离远；地上出现细细的光线时，赶紧上下移动躲开激光。' });
defineDungeon('floating_castle', { name: '悬空城', lvl: [21, 24], theme: 'skyPalace', rooms: 7, branches: 3, rows: 4, hidden: true, unlock: { quest: 'q_hidden_floating' }, mobs: [['knight', 3], ['expeller', 2], ['expellerAxe', 1], ['kargo', 1], ['golemBronze', 1]], elite: 'knight', boss: { kind: 'sinEye', lvl: 25 }, bossAdds: 3, clearExp: 11500, bgm: 'abyss', bossBgm: 'boss',
  desc: '【隐藏地下城】飘在云上的废城。侍剑骑兵平时是石像，走近才会醒来。罪恶之眼会放冲击波、追踪光柱和石化眼球——眼球那一排总会留一个缺口。' });

/* ---- 门的美术（世界组出图：art/final/world/g_<id>.webp；portal 是传送门在图里的位置 [cx, cy, rx, ry]） ---- */
if (typeof GATE_ART !== 'undefined') Object.assign(GATE_ART, {
  dragon_tower: { art: 'world/g_dragon_tower', portal: [0.5, 0.72, 0.12, 0.2], col: '255,170,90' },
  puppet_hall: { art: 'world/g_puppet_hall', portal: [0.51, 0.57, 0.17, 0.31], col: '200,130,255' },
  golem_tower: { art: 'world/g_golem_tower', portal: [0.5, 0.56, 0.17, 0.33], col: '255,215,90' },
  dark_corridor: { art: 'world/g_dark_corridor', portal: [0.49, 0.55, 0.16, 0.35], col: '255,70,70' },
  lord_palace: { art: 'world/g_lord_palace', portal: [0.5, 0.62, 0.15, 0.3], col: '255,245,200' },
  floating_castle: { art: 'world/g_floating_castle', portal: [0.5, 0.42, 0.13, 0.2], col: '230,90,200', h: 220 },
});

/* ---- 区域地图：从西海岸的云梯上来，站在最左边；越往右等级越高 ---- */
defineScene('sky_castle', { name: '天空之城', area: '天空之城', kind: 'field', width: 3600, theme: 'skyTower', bgm: 'sky', map: [30, 5],
  exits: [{ side: 'left', to: 'west_coast' }],
  gates: [{ dungeon: 'dragon_tower', x: 480 }, { dungeon: 'puppet_hall', x: 1000 }, { dungeon: 'golem_tower', x: 1520 }, { dungeon: 'dark_corridor', x: 2040 }, { dungeon: 'lord_palace', x: 2560 }, { dungeon: 'floating_castle', x: 3080 }] });
