/* =====================================================================
   城镇：按官方经典版（大转移前）布局
   赛丽亚的房间（新手出生点）→ 艾尔文防线集市 ←→ 赫顿玛尔（市政街 / 中央广场 / 旧城区 / 后街）←→ 西海岸（商贸区 / 魔法师公会）
   官方依据：艾尔文防线集市向左是赫顿玛尔市政街（Lv.3），向右是洛兰；格兰之森在赫顿玛尔左手边（经过风振一直向左）；
            NPC 名单与功能参照官方百科的各区域 NPC 表。标“自创”的是为了让城镇热闹一点补的原创角色
   新增 NPC：defineNpc(id, { name, title, art, h, services, lines, greet })，再放进某个场景的 npcs（步骤见 docs/CONTENT_GUIDE.md）
     services：quest（任务）、shop:<商店id>、storage（仓库）、repair（修理）、enhance（强化）、disassemble（分解）、job（转职）、cure（解除虚弱）、travel（区域移动）、arena（决斗场）
     greet：打开对话时的开场白（没有就从 lines 里随机）；still：不做待机动画（布告栏这类物件）
   ===================================================================== */
const START_SCENE = 'seria_room';

/* ---- 艾尔文防线（官方：赛丽亚、林纳斯、土罐、布告栏；雷蒙、莉莉为自创） ---- */
defineNpc('seria', { name: '赛丽亚', title: '新手引导', art: 'world/npc_seria', h: 112, services: ['quest', 'shop:seria', 'storage'],
  greet: ['啊，勇士，你终于醒了！', '欢迎回来，勇士。'],
  lines: ['欢迎回来，勇士。今天也要去冒险吗？', '累了就回来休息吧，我会一直在这里等你。', '不知道为什么，我总觉得自己知道很多事情……', '你在洛兰昏倒以后睡了一整天，可把我吓坏了。', '格兰之森的哥布林越来越多了，出门要小心。'] });
defineNpc('linus', { name: '林纳斯', title: '铁匠', art: 'world/npc_linus', h: 124, services: ['quest', 'shop:linus', 'repair', 'enhance', 'disassemble'],
  greet: ['哟，是你啊。手里的家伙还顺手吗？'],
  lines: ['武器坏了就拿来修，别拿命开玩笑。', '想要变强？先把手里的家伙练熟再说。', '我年轻的时候也是帝国有名的剑客……算了，不提了。', '强化这种事，看的是运气，也看的是胆量。'] });
defineNpc('tuguan', { name: '土罐', title: '罐子商人', art: 'world/npc_tuguan', h: 108, services: ['quest', 'shop:tuguan'],
  greet: ['来~来~来~ 以钱赚钱咧~！'],
  lines: ['这些罐子里装的，可是远古时期留下来的宝物！', '罐子战队的伙伴——火罐、木罐、水罐、金罐——分布在阿拉德各地，见到了替我打个招呼！', '打开罐子之前，谁也不知道里面是什么，这就是人生啊！', '头上的罐子？这是信仰，不能摘。'] });
defineNpc('board', { name: '布告栏', title: '艾尔文防线', art: 'world/b_board', h: 104, still: true, shadow: 26, services: ['quest'],
  greet: ['布告栏上贴着几张告示。'],
  lines: ['【告示】近日洛兰一带哥布林频繁出没，外出请结伴而行。——艾尔文防线哨所', '【寻人】有人在格兰之森见过一位白色马尾的少女吗？（告示已经褪色了）', '【招募】赫顿玛尔诚招各路冒险家，详情请到市政街冒险家公会咨询。', '【悬赏】讨伐洛兰深处的牛头兵，报酬从优。'] });
defineNpc('ray', { name: '雷蒙', title: '防线哨兵', art: 'world/npc_ray', h: 118, services: ['quest'],
  greet: ['站住！……啊，是冒险家啊，辛苦了。'],
  lines: ['往左走就是赫顿玛尔的市政街，不过没有 Lv.3 的本事，哨所可不放行。', '格兰之森那场大火之后，精灵们就再也没有回来过。', '洛兰的哥布林最近胆子越来越大，投掷哥布林都敢跑到防线外面来了。', '换岗时间还早……好想去赛丽亚那儿喝杯热牛奶。'] });
defineNpc('lily', { name: '莉莉', title: '精灵迷少女', art: 'world/npc_lily', h: 92, services: ['quest'],
  greet: ['哇！你是从森林那边回来的冒险家吗？'],
  lines: ['听说很久以前，艾尔文防线住着好多精灵，他们把大树掏空了当房子！', '赛丽亚姐姐一定是精灵！她的耳朵……好吧，我还没看清楚。', '等我长大了，也要去格兰之森冒险！', '你见过会发光的蘑菇吗？书上说洛兰深处到处都是。'] });
/* ---- 赫顿玛尔 · 市政街（官方：歌兰蒂斯、阿尔伯特、博肯、维尔·克鲁；斯卡迪女王在王宫前） ---- */
defineNpc('skadi', { name: '斯卡迪女王', title: '贝尔玛尔公国女王', art: 'world/npc_skadi', h: 120, services: ['quest'],
  greet: ['欢迎来到赫顿玛尔，勇士。'],
  lines: ['赫顿玛尔是大魔法师玛尔在沙漠中建起的城市，这里的一切都是白色的。', '格兰之森的异变，让我寝食难安。', '王国需要像你这样的冒险家。'] });
defineNpc('grandis', { name: '歌兰蒂斯', title: '圣职者导师 · 大圣堂', art: 'world/npc_grandis', h: 124, services: ['quest', 'cure'],
  greet: ['愿神的光辉指引你。'],
  lines: ['愿神的光辉指引你。', '受了伤就来大圣堂吧，这里的祈祷能驱散虚弱。', '赫顿玛尔的人们，都在等待勇士的到来。', '圣职者的道路还没有向你敞开……（圣职者职业尚未开放）'] });
defineNpc('albert', { name: '阿尔伯特', title: '技能研究家', art: 'world/npc_albert', h: 120, services: ['quest'],
  greet: ['哦？你的动作里有些有意思的东西。'],
  lines: ['我毕生都在研究各个流派的战斗技巧，哪怕只看一眼，也能看出门道。', '技能不在多，在于用得对不对。连招的衔接，才是真正的学问。', '听说剑魂能把一把普通的太刀用出十种花样……真想亲眼看看。', '攒够了技能点，别忘了按 K 好好规划一下。'] });
defineNpc('boken', { name: '博肯', title: '冒险家公会', art: 'world/npc_boken', h: 118, services: ['quest'],
  greet: ['欢迎来到赫顿玛尔冒险家公会！'],
  lines: ['公会负责登记和管理各地的冒险家，最近来申请的人可真不少。', '一个人刷图固然自在，但有伙伴在身边，深渊里也不会觉得冷。', '公会的名册上又多了一个名字——就是你！'] });
defineNpc('vier', { name: '维尔·克鲁', title: '竞技大赛', art: 'world/npc_vier', h: 118, services: ['quest', 'arena'],
  greet: ['来来来！想在竞技场上一决高下吗？'],
  lines: ['赫顿玛尔竞技大赛，是勇士证明自己的舞台！', '上一届的冠军是一位鬼剑士，一招拔刀斩就结束了比赛。', '想参加决斗？先把基本功练扎实再说吧。', '观众们最喜欢华丽的连招了！'] });
/* ---- 赫顿玛尔 · 中央广场（官方：凯丽、风振、诺顿、索西雅、诺羽） ---- */
defineNpc('kiri', { name: '凯丽', title: '强化 · 神枪手导师', art: 'world/npc_kiri', h: 114, services: ['quest', 'shop:kiri', 'enhance', 'job'], jobFor: 'gun',
  greet: ['嗨~要让装备闪闪发光吗？'],
  lines: ['来自天界的技术，可比你们地上的铁匠厉害多了！', '想让装备闪闪发光？交给凯丽吧~', '枪械的奥秘，可不是随便谁都能掌握的哦。'] });
defineNpc('fengzhen', { name: '风振', title: '格斗家导师', art: 'world/npc_fengzhen', h: 114, services: ['quest'],
  greet: ['嗯，来得正好。'],
  lines: ['拳头，才是最诚实的武器。', '风拳流的修行，没有捷径。', '往左一直走就是格兰之森，路上小心。', '……你的身法还欠火候。（格斗家职业尚未开放）'] });
defineNpc('norton', { name: '诺顿', title: '商人 · 分解', art: 'world/npc_norton', h: 120, services: ['quest', 'shop:norton', 'disassemble'],
  greet: ['欢迎光临！诺顿的店，只做公道生意。'],
  lines: ['用不上的装备别急着卖，拿来分解，能得到不少好材料。', '赫顿玛尔是整个大陆的商业中心，什么稀罕货都能在这里找到。', '价钱嘛……好商量，好商量。', '我这双眼睛，看宝石从来没走眼过。'] });
defineNpc('sosia', { name: '索西雅', title: '药剂商人', art: 'world/npc_sosia', h: 114, services: ['quest', 'shop:sosia', 'cure'],
  greet: ['受伤了吗？快坐下歇歇。'],
  lines: ['冒险之前，记得带够回复药剂。', '要是在地下城里吃了败仗，身体会虚弱一阵子，我可以帮你调理。', '这瓶是新调的，味道……嗯，良药苦口嘛。', '后街最近不太平，你可别一个人乱逛。'] });
defineNpc('nuoyu', { name: '诺羽', title: '区域移动', art: 'world/npc_nuoyu', h: 104, services: ['travel'],
  greet: ['要去哪里呢？诺羽带你一程~'],
  lines: ['只要是去过的城镇，都可以用传送阵一下子过去哦。', '这座传送阵是大魔法师玛尔留下来的，到现在还能用呢！', '西海岸的马琳是我的好朋友，她管着那边的传送阵。', '按 N 也能打开世界地图，看看自己在哪儿。'] });
/* ---- 赫顿玛尔 · 旧城区（官方：G.S.D、奥兰、卡妮娜、辛达） ---- */
defineNpc('gsd', { name: 'G.S.D', title: '鬼剑士导师', art: 'world/npc_gsd', h: 120, services: ['quest', 'job'], jobFor: 'sword',
  greet: ['……你来了。'],
  lines: ['……你的左臂，在哭泣。', '剑，不是用眼睛看的，是用心。', '被鬼神附身的人，要么驾驭它，要么被它吞噬。'] });
defineNpc('olan', { name: '奥兰', title: '杂货奶奶', art: 'world/npc_olan', h: 96, services: ['quest', 'shop:olan'],
  greet: ['哎哟，孩子，饿了吧？'],
  lines: ['旧城区住了一辈子啦，这条街上的每一块石头奶奶都认识。', '面包是早上刚烤的，带几个路上吃。', '年轻人出门在外，一定要吃饱穿暖。', '以前赫顿玛尔可没这么多冒险家，现在热闹多了。'] });
defineNpc('kanina', { name: '卡妮娜', title: '防具商人', art: 'world/npc_kanina', h: 116, services: ['quest', 'shop:kanina'],
  greet: ['看看防具？命只有一条哦。'],
  lines: ['轻甲灵活、重甲结实——选哪种，看你怎么打。', '别光顾着攻击，被牛头兵一斧子劈中可不是闹着玩的。', '这些护甲都是我亲手挑的，质量有保证。', '不买也可以看看，试穿不收钱。'] });
defineNpc('sinda', { name: '辛达', title: '材料商人', art: 'world/npc_sinda', h: 116, services: ['quest', 'shop:sinda'],
  greet: ['……需要材料吗？'],
  lines: ['……矿石、皮革、布料，都有。', '强化和分解都离不开材料……多备一点。', '（辛达默默地整理着货箱）', '无色小晶体……最近很抢手。'] });
/* ---- 赫顿玛尔 · 后街（官方：夏洛克、米内特；帕丽丝“臭水沟公主”） ---- */
defineNpc('paris', { name: '帕丽丝', title: '时装 · 称号', art: 'world/npc_paris', h: 114, services: ['shop:paris'],
  greet: ['哎呀，这位勇士，打扮得也太朴素了吧！'],
  lines: ['勇士也要穿得漂亮才行！', '这些称号可是很受欢迎的哦~', '后街虽然乱了点，最时髦的东西可都在这里。', '看看新到的款式吧！'] });
defineNpc('sherlock', { name: '夏洛克', title: '哥布林商人', art: 'world/npc_sherlock', h: 100, services: ['quest', 'shop:sherlock'],
  greet: ['嘿嘿，客人，要看看好东西吗？'],
  lines: ['别看我是哥布林，做生意可是最讲信用的！', '这些货都是我从阿拉德各地淘来的，每一件都有故事。', '洛兰那些野蛮的同族？别把我和他们相提并论！', '金币，金币，亮晶晶的金币~'] });
defineNpc('minette', { name: '米内特', title: '暗夜使者导师', art: 'world/npc_minette', h: 118, services: ['quest'],
  greet: ['……在阴影里待久了，眼睛反而更好使。'],
  lines: ['暗夜使者行走在光照不到的地方。', '后街的每一条小巷，我都了如指掌。', '想学暗杀术？现在的你还不够格。（暗夜使者职业尚未开放）', '月光酒馆……那里的老板娘可不简单。'] });
/* ---- 西海岸 · 商贸区（官方：罗杰·莱文、罗莉安、卡坤、达芙妮） ---- */
defineNpc('roget', { name: '罗杰', title: '生产商 · 港口', art: 'world/npc_roget', h: 118, services: ['quest', 'shop:roget'],
  greet: ['海风的味道，闻起来就像冒险！'],
  lines: ['海风的味道，闻起来就像冒险！', '船上来了些稀罕货，要不要看看？', '魔法师公会就在商贸区左边，莎兰会长在那里。', '想当年我出海的时候，见过比房子还大的章鱼！'] });
defineNpc('lorian', { name: '罗莉安', title: '魔法商人', art: 'world/npc_lorian', h: 114, services: ['quest', 'shop:lorian'],
  greet: ['欢迎光临~今天的我也很可爱吧？'],
  lines: ['大家都说我是西海岸最漂亮的人……嘻嘻，其实我也这么觉得。', '魔法师的武器和首饰，在我这里都能找到哦。', '莎兰会长是我最崇拜的人！', '看到海上的船了吗？据说天空之城就在那片云的后面。'] });
defineNpc('kakun', { name: '卡坤', title: '暗精灵商人', art: 'world/npc_kakun', h: 124, services: ['quest', 'shop:kakun', 'repair'],
  greet: ['……人类的城市，总是这么吵闹。'],
  lines: ['我来自地下的暗精灵王国，奉女王之命与人类通商。', '武器坏了可以交给我修，暗精灵的锻造技术不比人类差。', '暗黑城……总有一天，你会去那里的。', '莎兰大人是我们暗精灵中最了解人类的一位。'] });
defineNpc('daphne', { name: '达芙妮', title: '首饰商人', art: 'world/npc_daphne', h: 114, services: ['quest', 'shop:daphne'],
  greet: ['欢迎，想看看首饰吗？'],
  lines: ['每一件首饰上的宝石，都是我亲手镶嵌的。', '好的首饰能让魔力流动得更顺畅。', '罗杰那个老头，又在跟人吹他当年出海的事了吧？', '这条项链？非卖品，是我母亲留下来的。'] });
/* ---- 西海岸 · 魔法师公会（官方：莎兰、艾丽丝、奥菲利亚、马琳） ---- */
defineNpc('sharan', { name: '莎兰', title: '魔法师导师', art: 'world/npc_sharan', h: 120, services: ['quest', 'job'], jobFor: 'mage',
  greet: ['魔力的流动，你感觉到了吗？'],
  lines: ['魔力的流动，你感觉到了吗？', '暗精灵的魔法学识，可不会轻易传授给别人。', '元素也好，战斗也好，都只是魔法的一种形态。', '我受梅娅女王之命来到人类的城市，建立了这座魔法学院。'] });
defineNpc('alice', { name: '艾丽丝', title: '吟游诗人', art: 'world/npc_alice', h: 116, services: ['quest'],
  greet: ['♪……啊，有客人来了。'],
  lines: ['我在歌里唱的，都是阿拉德大陆的过去与未来。', '你的命运之线……很有趣，交织着许多人的故事。', '♪ 风从格兰之森吹来，带着精灵们遗落的歌……', '总有一天，你会明白“使徒”这个词的含义。'] });
defineNpc('ophelia', { name: '奥菲利亚', title: '防具商人', art: 'world/npc_ophelia', h: 116, services: ['quest', 'shop:ophelia'],
  greet: ['……你好，冒险家。'],
  lines: ['我是 GBL 教唯一幸存的教徒。', '天帷巨兽的背上，有我们教团的神殿……', '这些护甲是教团留下来的，希望它们能保护你。', '知识是最好的武器——可惜很多人不这么认为。'] });
defineNpc('marin', { name: '马琳', title: '区域移动', art: 'world/npc_marin', h: 108, services: ['travel'],
  greet: ['要出发了吗？马琳送你一程！'],
  lines: ['西海岸的传送阵连着赫顿玛尔和艾尔文防线，去过的地方都能传送。', '诺羽那丫头又偷懒了吧？', '有一天，我想坐船去看看天空之城。', '按 N 可以打开世界地图哦。'] });

/* ---- 场景 ---- */
const lamp = (x, o) => ({ art: 'world/p_lamp', x, h: 128, glow: [0.74, 0.36, 30], ...o });
const banner = (x, o) => ({ art: 'world/p_banner', x, h: 150, anim: 'flag', ...o });
// 赛丽亚的房间：官方新手在这里醒来（赛丽亚旅馆内）
defineScene('seria_room', { name: '艾尔文防线', area: '赛丽亚的房间', kind: 'town', interior: true, width: 960, theme: 'seriaRoom', bgm: 'seria', ambient: 'sunbeam', map: [74, 24], spawn: { x: 330, y: 96 },
  npcs: [{ npc: 'seria', x: 560, y: 64 }],
  exits: [{ side: 'right', to: 'elvenguard' }] });
// 艾尔文防线集市：赛丽亚旅馆在中间，出门往左是林纳斯的铁匠铺；向右出城到洛兰，向左通往赫顿玛尔市政街（Lv.3）
defineScene('elvenguard', { name: '艾尔文防线', area: '集市', kind: 'town', width: 2600, theme: 'elvenguard', bgm: 'town', ambient: 'leaves', map: [74, 40], spawn: { x: 1330, y: 60 },
  props: [{ art: 'world/b_elfhouse', x: 250, h: 190 }, lamp(520), { art: 'world/b_forge', x: 760, h: 230 }, { art: 'world/p_barrels', x: 960, h: 50 }, { art: 'world/b_well', x: 1080, h: 120 },
    { art: 'world/b_inn', x: 1330, h: 290 }, lamp(1545), { art: 'world/b_potstall', x: 1780, h: 150 }, { art: 'world/b_elfhouse', x: 2240, h: 180, flip: true }, { art: 'world/b_signpost', x: 2500, h: 110 },
    { art: 'world/p_cat', x: 1440, y: 10, h: 30, anim: 'breathe' }, { art: 'world/p_chicken', x: 1960, y: 70, h: 26, anim: 'breathe' }, { art: 'world/p_planter', x: 1190, h: 36 }, { art: 'world/p_crates', x: 600, h: 56 }],
  npcs: [{ npc: 'ray', x: 160, y: 60, face: 1 }, { npc: 'linus', x: 820, y: 44 }, { npc: 'lily', x: 1580, y: 84 }, { npc: 'tuguan', x: 1770, y: 44 }, { npc: 'board', x: 2050, y: 18 }],
  exits: [{ side: 'left', to: 'hendon_myre', minLv: 3 }, { side: 'right', to: 'gf_lorien' }, { side: 'up', x: 1330, to: 'seria_room', door: true }] });
// 赫顿玛尔市政街：竞技场、市政厅（冒险家公会）、大圣堂、王宫
defineScene('hendon_myre', { name: '赫顿玛尔', area: '市政街', kind: 'town', width: 3200, theme: 'civic', bgm: 'hendon', ambient: 'petals', map: [60, 40],
  props: [{ art: 'world/b_arena', x: 420, h: 250 }, banner(700), { art: 'world/b_townhall', x: 1160, h: 300 }, lamp(1540), { art: 'world/b_cathedral', x: 1960, h: 300 }, banner(2420), { art: 'world/b_palace', x: 2820, h: 290 },
    { art: 'world/p_planter', x: 880, h: 36 }, { art: 'world/p_planter', x: 2250, h: 36 }, { art: 'world/p_puppy', x: 1700, y: 120, h: 30, anim: 'breathe' },
    { art: 'world/p_bench', x: 1560, h: 40 }, { art: 'world/p_tree', x: 1380, h: 70, anim: 'sway' }, { art: 'world/p_tree', x: 2600, h: 70, anim: 'sway' }],
  npcs: [{ npc: 'vier', x: 480, y: 46 }, { npc: 'albert', x: 1050, y: 44 }, { npc: 'boken', x: 1270, y: 50 }, { npc: 'grandis', x: 2020, y: 44 }, { npc: 'skadi', x: 2850, y: 40 }],
  exits: [{ side: 'right', to: 'elvenguard' }, { side: 'left', to: 'hm_plaza' }] });
// 中央广场：往左一直走是格兰之森；北边的路口上去是旧城区，南边的小巷下去是后街
defineScene('hm_plaza', { name: '赫顿玛尔', area: '中央广场', kind: 'town', width: 3400, theme: 'town', bgm: 'hendon', ambient: 'petals', map: [46, 40],
  props: [{ art: 'world/b_dojo', x: 460, h: 220 }, lamp(800), { art: 'world/b_workshop', x: 1110, h: 240 }, { art: 'world/b_fountain', x: 1760, h: 200, anim: 'fountain' }, { art: 'world/b_teleporter', x: 2070, h: 100, glow: [0.5, 0.35, 60, '120,210,255'] },
    lamp(2260), { art: 'world/b_merchant', x: 2470, h: 230 }, { art: 'world/b_potion', x: 3040, h: 220 }, banner(1420), { art: 'world/p_cart', x: 2700, y: 150, h: 64 }, { art: 'world/p_sacks', x: 2330, h: 40 },
    { art: 'world/p_bench', x: 1990, h: 40 }, { art: 'world/p_chicken', x: 800, y: 130, h: 24, anim: 'breathe', flip: true }, { art: 'world/p_bucket', x: 2860, h: 26 }],
  npcs: [{ npc: 'fengzhen', x: 530, y: 42 }, { npc: 'kiri', x: 1170, y: 44 }, { npc: 'nuoyu', x: 2070, y: 40 }, { npc: 'norton', x: 2520, y: 46 }, { npc: 'sosia', x: 3080, y: 42 }],
  exits: [{ side: 'right', to: 'hendon_myre' }, { side: 'left', to: 'gf_forest' }, { side: 'up', x: 1440, to: 'hm_oldtown' }, { side: 'down', x: 2780, to: 'hm_backstreet' }] });
// 旧城区：老房子、杂货铺、防具店；G.S.D 在街角
defineScene('hm_oldtown', { name: '赫顿玛尔', area: '旧城区', kind: 'town', width: 2800, theme: 'oldtown', bgm: 'hendon', ambient: 'dust', map: [40, 20],
  props: [{ art: 'world/b_oldhouse', x: 300, h: 260 }, { art: 'world/b_grocery', x: 830, h: 220 }, lamp(1180), { art: 'world/b_armorshop', x: 1520, h: 230 }, { art: 'world/p_crates', x: 1790, h: 56 }, { art: 'world/b_oldhouse', x: 2200, h: 250, flip: true },
    { art: 'world/p_logs', x: 2500, h: 36 }, { art: 'world/p_hay', x: 600, y: 150, h: 40 }, { art: 'world/p_sign', x: 1000, h: 64 }, { art: 'world/p_cat', x: 2080, y: 6, h: 28, anim: 'breathe', flip: true }],
  npcs: [{ npc: 'olan', x: 870, y: 46 }, { npc: 'kanina', x: 1560, y: 44 }, { npc: 'sinda', x: 1830, y: 60 }, { npc: 'gsd', x: 2420, y: 44 }],
  exits: [{ side: 'down', x: 1180, to: 'hm_plaza' }, { side: 'left', to: 'west_coast' }] });
// 后街：昏暗的小巷，月光酒馆（官方 Lv.49 的地下城区域，这里只做门面）
defineScene('hm_backstreet', { name: '赫顿玛尔', area: '后街', kind: 'town', width: 2400, theme: 'backstreet', bgm: 'backstreet', ambient: 'lantern', map: [46, 56],
  props: [{ art: 'world/b_alley', x: 300, h: 250 }, { art: 'world/b_tavern', x: 960, h: 260 }, { art: 'world/p_barrels', x: 1210, h: 50 }, { art: 'world/b_goblinstall', x: 1680, h: 200 }, { art: 'world/b_alley', x: 2160, h: 240, flip: true },
    { art: 'world/p_blackcat', x: 1400, y: 8, h: 32, anim: 'breathe' }, { art: 'world/p_chest', x: 1880, h: 32 }, { art: 'world/p_crates', x: 620, y: 160, h: 50 }],
  npcs: [{ npc: 'paris', x: 560, y: 44 }, { npc: 'sherlock', x: 1720, y: 46 }, { npc: 'minette', x: 2230, y: 30 }],
  exits: [{ side: 'up', x: 1320, to: 'hm_plaza' }, { side: 'up', x: 960, label: '月光酒馆', locked: '月光酒馆（Lv.49 地下城区域）还没有开放', door: true }] });
// 西海岸商贸区：港口（去天帷巨兽的船，未开放）、首饰店；东端是通往天空之城的云梯（官方：天空之城在西海岸东部）
// 天空之城区域地图 sky_castle 由地下城内容组提供（content/world/sky_castle.js），没合进来时这个出口显示“未开放”
defineScene('west_coast', { name: '西海岸', area: '商贸区', kind: 'town', width: 2800, theme: 'westcoast', bgm: 'westcoast', ambient: 'gulls', map: [24, 20],
  props: [{ art: 'world/b_harbor', x: 420, h: 220 }, { art: 'world/b_ship', x: 1040, h: 240 }, { art: 'world/p_anchor', x: 1330, h: 66 }, { art: 'world/b_jewelry', x: 1640, h: 220 }, lamp(1900),
    { art: 'world/p_net', x: 2080, h: 90, anim: 'hang' }, { art: 'world/p_fishcrates', x: 2400, h: 44 }, { art: 'world/p_gull', x: 760, h: 70 }, { art: 'world/p_buoy', x: 2220, h: 34 },
    { art: 'world/b_skystair', x: 2600, h: 310 }, { art: 'world/p_rope', x: 1240, y: 170, h: 26 }, { art: 'world/p_boat', x: 200, h: 40 }, { art: 'world/p_bollard', x: 1480, h: 30 }],
  npcs: [{ npc: 'roget', x: 470, y: 42 }, { npc: 'daphne', x: 1680, y: 44 }, { npc: 'lorian', x: 1960, y: 56 }, { npc: 'kakun', x: 2300, y: 44 }],
  exits: [{ side: 'right', to: 'hm_oldtown' }, { side: 'left', to: 'wc_guild' }, { side: 'up', x: 2600, to: 'sky_castle', minLv: 14, label: '天空之城', optional: true },
    { side: 'up', x: 1040, label: '天帷巨兽', locked: '去天帷巨兽的船还没有起航（Lv.27 区域，暂未开放）' }] });
// 西海岸魔法师公会：莎兰的魔法学院
defineScene('wc_guild', { name: '西海岸', area: '魔法师公会', kind: 'town', width: 2600, theme: 'magicGuild', bgm: 'guild', ambient: 'magic', map: [10, 20],
  props: [{ art: 'world/b_guildhall', x: 660, h: 300 }, { art: 'world/p_magiclamp', x: 1000, h: 130, glow: [0.5, 0.2, 36, '190,140,255'] }, { art: 'world/b_academy', x: 1380, h: 300 }, { art: 'world/p_crystal', x: 1620, h: 70, anim: 'bob', glow: [0.5, 0.35, 40, '190,140,255'] },
    { art: 'world/b_library', x: 1980, h: 280 }, { art: 'world/b_teleporter', x: 2380, h: 100, glow: [0.5, 0.35, 60, '120,210,255'] }, { art: 'world/p_books', x: 1180, h: 50 }, { art: 'world/p_cauldron', x: 2200, y: 150, h: 52 },
    { art: 'world/p_telescope', x: 2140, h: 66 }, { art: 'world/p_blueflower', x: 900, h: 40, glow: [0.5, 0.3, 26, '120,200,255'] }, { art: 'world/p_blueflower', x: 1830, h: 40, glow: [0.5, 0.3, 26, '120,200,255'] }],
  npcs: [{ npc: 'sharan', x: 730, y: 44 }, { npc: 'alice', x: 1180, y: 70 }, { npc: 'ophelia', x: 1720, y: 44 }, { npc: 'marin', x: 2380, y: 40 }],
  exits: [{ side: 'right', to: 'west_coast' }] });
