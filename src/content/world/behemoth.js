/* =====================================================================
   区域：天帷巨兽（官方经典版：乘船从西海岸出发，Lv28~40；本作 Lv24~30，接在天空之城之后）
   传说中每 300 年穿过天空之海降入下界的巨兽。它的背上有古代文明的遗迹，GBL 教在那里建立了神殿；
   长脚罗特斯袭击神殿之后，教徒们变成了怪物，只剩下奥菲利亚一个人逃回西海岸。
   入口：西海岸 · 商贸区的船（towns.js 的 up 出口 x 1040，minLv 24）。
   - behemoth（神殿之路）：神殿外围 → 树精丛林 → 炼狱；右边通往脊背
   - behemoth_spine（脊背）：极昼 → 第二脊椎 → 天帷禁地（隐藏）；装备深化组在 x 2500 / 2900 放了两扇深渊门
   官方的“第一脊椎”没有单独做：它的领主巨型黑章鱼放进了第二脊椎当精英。
   怪物与领主见 content/monsters/behemoth.js，背景主题见 content/themes/behemoth.js。
   ===================================================================== */
defineDungeon('temple_outskirts', { name: '神殿外围', lvl: [24, 25], theme: 'bhTemple', rooms: 6, branches: 2, mobs: [['gblBeliever', 3], ['gblPriest', 2], ['octopus', 2], ['dragonCannon', 1], ['yaksha', 0.5]], elite: 'gblBishop', boss: { kind: 'gblArchbishop', lvl: 26 }, bossAdds: 2, clearExp: 12000, bgm: 'dungeon',
  desc: 'GBL 教神殿的外围，变成怪物的信徒还在巡逻。领主房里有大主教和大祭司两个人——大祭司活着时大主教有圣光护盾，先打倒大祭司。' });
defineDungeon('treant_jungle', { name: '树精丛林', lvl: [25, 26], theme: 'bhJungle', rooms: 6, branches: 2, mobs: [['treant', 3], ['treantDark', 2], ['flower', 2], ['octopus', 1], ['gblPriest', 1]], elite: 'gardenerRul', boss: { kind: 'rodin', lvl: 27 }, bossAdds: 2, clearExp: 12800, bgm: 'dungeon2',
  desc: '长在巨兽背上的魔法丛林。混乱花走近了会喷花粉。巨树守护者罗丁的根须会沿着你所在的那一排刺过来——上下走开就能躲。' });
defineDungeon('purgatory', { name: '炼狱', lvl: [26, 27], theme: 'bhPurgatory', rooms: 7, branches: 3, rows: 4, mobs: [['yaksha', 3], ['zombie', 2], ['gblBeliever', 1], ['gblShaman', 2], ['babyOcto', 1]], elite: 'yaksha', boss: { kind: 'yakshaKing', lvl: 28 }, bossAdds: 3, clearExp: 13600, bgm: 'dungeon3',
  desc: '熔岩流淌的地下神殿。夜叉王又快又常霸体：冲刺前地上会出现红线；听到“震地咆哮”就跳起来，冲击波是贴着地面扩散的。' });
defineDungeon('polar_day', { name: '极昼', lvl: [27, 28], theme: 'bhDay', rooms: 7, branches: 3, rows: 4, mobs: [['gblBeliever', 2], ['gblBishop', 1], ['donnier', 2], ['sawCart', 2], ['fireCannon', 1.5], ['octopus', 1]], elite: 'sawCart', boss: { kind: 'donnierEX', lvl: 29 }, bossAdds: 2, clearExp: 14400, bgm: 'dungeon',
  desc: '太阳永不落下的金色神殿。飞艇多尼尔会往你脚下扔炸弹（有红圈）。多尼尔（EX）会地毯轰炸、放激光、发射追踪导弹，还会空投信徒。' });
defineDungeon('second_spine', { name: '第二脊椎', lvl: [28, 30], theme: 'bhSpine', rooms: 7, branches: 3, rows: 4, mobs: [['octopus', 3], ['octopusBlue', 2], ['babyOcto', 1.5], ['gblBishop', 1], ['laserCannon', 0.6], ['gblShaman', 1]], elite: 'blackOctopus', boss: { kind: 'lotus', lvl: 30 }, bossAdds: 2, clearExp: 15600, bgm: 'abyss', bossBgm: 'boss',
  desc: '巨兽的脊椎深处，章鱼的巢穴。长脚罗特斯几乎不动，但触手能扫过整排——地上亮起细线时上下躲开；它 4 秒没挨打就会回血，要一直打。' });
defineDungeon('forbidden_land', { name: '天帷禁地', lvl: [29, 30], theme: 'bhForbidden', rooms: 7, branches: 3, rows: 4, hidden: true, unlock: { quest: 'q_hidden_forbidden' }, mobs: [['gblRevPriest', 3], ['gblRevShaman', 2], ['gblRevBishop', 1], ['zombie', 1]], elite: 'gblRevBishop', boss: { kind: 'marcel', lvl: 30 }, bossAdds: 3, clearExp: 16000, bgm: 'abyss', bossBgm: 'boss',
  desc: '【隐藏地下城】GBL 教的禁地。审判者马塞尔全程霸体，会扔三把上下错开的飞刀；他升起血色护罩时，把他引出罩子再打。' });

/* ---- 门的美术（art/final/world/g_<id>.webp，按世界组的流程生成：art/tools/behemoth_art.py gates → worldprep.py g_） ---- */
if (typeof GATE_ART !== 'undefined') Object.assign(GATE_ART, {
  temple_outskirts: { art: 'world/g_temple_outskirts', portal: [0.5, 0.58, 0.16, 0.3], col: '120,230,220' },
  treant_jungle: { art: 'world/g_treant_jungle', portal: [0.5, 0.58, 0.16, 0.3], col: '150,255,120' },
  purgatory: { art: 'world/g_purgatory', portal: [0.5, 0.58, 0.16, 0.3], col: '255,110,50' },
  polar_day: { art: 'world/g_polar_day', portal: [0.5, 0.58, 0.16, 0.3], col: '255,240,170' },
  second_spine: { art: 'world/g_second_spine', portal: [0.5, 0.58, 0.16, 0.3], col: '200,120,255' },
  forbidden_land: { art: 'world/g_forbidden_land', portal: [0.5, 0.58, 0.16, 0.3], col: '255,60,80' },
});

/* ---- 区域地图 ---- */
// 神殿之路：从西海岸坐船上来，站在最左边的码头；越往右等级越高，最右边通往脊背
defineScene('behemoth', { name: '天帷巨兽', area: '神殿之路', kind: 'field', width: 2900, theme: 'bhTemple', bgm: 'sky', map: [12, 6],
  props: [{ art: 'world/b_ship', x: 200, h: 230 }],
  exits: [{ side: 'left', to: 'west_coast' }, { side: 'right', to: 'behemoth_spine', minLv: 27, label: '天帷巨兽 · 脊背' }],
  gates: [{ dungeon: 'temple_outskirts', x: 650 }, { dungeon: 'treant_jungle', x: 1350 }, { dungeon: 'purgatory', x: 2050 }] });
// 脊背：极昼、第二脊椎、天帷禁地（隐藏）；x 2500 / 2900 留给装备深化组的深渊门
defineScene('behemoth_spine', { name: '天帷巨兽', area: '脊背', kind: 'field', width: 3200, theme: 'bhSpine', bgm: 'sky', map: [4, 12],
  exits: [{ side: 'left', to: 'behemoth' }],
  gates: [{ dungeon: 'polar_day', x: 600 }, { dungeon: 'second_spine', x: 1250 }, { dungeon: 'forbidden_land', x: 1900 }] });
