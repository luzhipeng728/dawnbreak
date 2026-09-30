/* =====================================================================
   31~60 区域的每日 / 支线 / 区域制霸链（按官方 60~70 版的重复任务 / 支线整理，写不到的地方按区域剧情自创）
   - 登记：defineRegionQuests(区域 id, { chapter, scene, npc, dailies, sides, tour })（game/region.js，docs/REGION_PIPELINE.md §2.3）
   - 每日：每个区域 1~2 个，发放人是这个区域城镇的 NPC；奖励 = 按玩家等级的经验 + 约一趟同级地下城的金币 + 区域材料 / 矛盾的结晶体 / 邀请函 / 宇宙灵魂
   - 支线：跟区域剧情走，前置是对应的主线步骤（老存档主线已经全部完成 → 直接能接）
   - 制霸链：通关区域的全部地下城（最后一步含本区域的深渊）→ 区域称号；不能一键完成，满级也值得打
   - 里程碑：赛丽亚的 Lv40 / 50 / 60（对应成就「百战精英」「超越极限」「破晓之巅」），前置是各区域的制霸链
   - 任务道具只借用现有图标（icon），不另外出图；放在 content/abyss.js 后面（「深渊的呼唤」要用深渊地下城的列表）
   ===================================================================== */
{
const D = (gold, items) => ({ expFrac: 0.06, gold, items });   // 每日奖励
const ABYSS_ALL = Object.values(DUNGEONS).filter(G => G.abyss).sort((a, b) => b.lvl[0] - a.lvl[0]).map(G => G.id);   // 高等级在前：自动前往先挑能进的最高级深渊
// 区域称号（任务奖励，商店不卖；属性在天空之城的解放者和商城至尊称号之间）
const T = (key, name, lvl, st, fx, desc) => defineTitle(key, { name, lvl, rar: 4, noDrop: true, st, fx, desc });
T('title_rg_darkelf', '暗黑城的解放者', 38, { str: 24, int: 24, vit: 24, spr: 24, dark: 10 }, { dmgUp: 0.04, critDmg: 0.03 }, '通关暗精灵地区的全部地下城与暗黑城深渊。');
T('title_rg_snow', '冰龙的征服者', 42, { str: 26, int: 26, vit: 26, spr: 26, ice: 12 }, { dmgUp: 0.04, aspd: 0.02, cspd: 0.02 }, '通关万年雪山的全部地下城与雪山深渊。攻击 / 施放速度 +2%。');
T('title_rg_ancient', '远古的探索者', 50, { str: 28, int: 28, vit: 28, spr: 28, hardness: 10 }, { dmgUp: 0.045, dmgReduce: 0.02 }, '闯过比尔马克帝国试验场与悲鸣洞穴。');
T('title_rg_gent', '皇都的守护者', 52, { str: 30, int: 30, vit: 30, spr: 30, fire: 12 }, { dmgUp: 0.045, critDmg: 0.04 }, '通关诺斯玛尔与根特的全部地下城与诺斯玛尔深渊。');
T('title_rg_train', '海上列车的英雄', 56, { str: 32, int: 32, vit: 32, spr: 32 }, { dmgUp: 0.05, mspd: 0.03 }, '通关海上列车的全部地下城与海上列车深渊。移动速度 +3%。');
T('title_rg_timegate', '时空的旅者', 59, { str: 34, int: 34, vit: 34, spr: 34, crit: 0.01, mcrit: 0.01 }, { dmgUp: 0.05, cdr: 0.02 }, '走完过去的回廊，通关时空之门深渊。技能冷却 -2%。');
T('title_rg_siroco', '魔界的讨伐者', 60, { str: 36, int: 36, vit: 36, spr: 36, crit: 0.02, mcrit: 0.02 }, { dmgUp: 0.05, critDmg: 0.05 }, '讨伐潜行者希洛克，通关魔界深渊。');

/* ---------------- 暗精灵地区 · 暗黑城（Lv31~38） ---------------- */
defineRegionQuests('darkelf', { chapter: '暗黑城篇 · 支线', scene: 'aferia_camp', npc: 'kurent',
  dailies: [
    { id: 'd_de_spider', name: '准备去熔岩穴', npc: 'bryce', lvl: 32,   // 官方：布莱斯的重复任务
      desc: '布莱斯要给前线的姐姐加尔做防火涂层。去「蜘蛛洞穴」收集 10 条被污染的蜘蛛腿。',
      goals: [{ type: 'collect', key: 'q_de_spiderleg', item: '被污染的蜘蛛腿', icon: 'q_venom_gland', from: ['poisonSpider', 'smallSpider'], dungeon: 'spider_cave', rate: 0.4, n: 10, desc: '还在微微抽动的蜘蛛腿，毛刺上沾着紫色的毒液。' }],
      talk: { offer: ['姐姐加尔说，熔岩穴烫得连靴底都会化掉。', '被污染的蜘蛛腿上的毒液晒干以后能做成防火涂层。去蜘蛛洞穴帮我弄 10 条来——每天都要。'], doing: ['毒蜘蛛的腿最好用，小蜘蛛的也凑合。'], done: ['够了够了！今天的涂层有着落了。这些晶块你拿去强化装备吧。'] },
      reward: D(2500, [QI('c_black', 5), QI('crystal', 20)]) },
    { id: 'd_de_ruins', name: '再探王的遗迹', lvl: 36, pre: 'q_de10',   // 官方：克伦特的重复任务（灵魂晶石）
      desc: '王的遗迹里游荡的冤魂会凝成发光的晶石。带回 8 块，让克伦特为暗精灵的祖先送葬。',
      goals: [{ type: 'collect', key: 'q_de_soulgem', item: '遗迹的灵魂晶石', icon: 'q_magic_crystal', dungeon: 'king_ruins', rate: 0.35, n: 8, desc: '暗精灵祖先的灵魂凝成的晶石，摸上去冰凉。' }],
      talk: { offer: ['王的遗迹里的冤魂……一到夜里就会凝成发光的晶石。', '那是暗精灵祖先的灵魂。把它们带回来，我会在营地为它们送葬。'], doing: ['遗迹的入口在暗精灵地区靠右的地方。'], done: ['……谢谢。今晚又有几位祖先能安息了。'] },
      reward: D(3200, [QI('m_contra', 2), QI('abyss_ticket', 1)]) },
  ],
  sides: [
    { id: 's_de_morgan', name: '摩根的研究笔记', lvl: 32, pre: 'q_de03',
      desc: '盗尸者把摩根的研究笔记撕成碎页带走了。去「浅栖之地」从盗尸者身上找回 5 页。',
      goals: [{ type: 'collect', key: 'q_de_note', item: '摩根的研究笔记', icon: 'q_scroll', from: ['corpseThief'], dungeon: 'shallow_haunt', rate: 0.35, n: 5, desc: '字迹潦草的炼金笔记，边角被毒液腐蚀了。' }],
      talk: { offer: ['摩根的信上说，他把研究结果都记在笔记里了。', '可是浅栖之地的盗尸者什么都偷……他的笔记一定被撕成碎页带走了。'], doing: ['盗尸者喜欢躲在尸堆后面。'], done: ['“传染病不是人类带来的，源头在地下更深的地方。”……摩根早就知道了。', '这些药是他留下的配方做的，你收着。'] },
      reward: { exp: 0.08, gold: 3000, items: [QI('elixir', 3)] } },
    { id: 's_de_war', name: '谁的战争', npc: 'bryce', to: 'kurent', lvl: 34, pre: 'q_de07',   // 官方：谁的战争 → 加尔的恼怒
      desc: '失踪大使的护卫都死在了暗精灵墓地。从墓地骷髅身上找回 10 片护卫的披风碎片，交给克伦特。',
      goals: [{ type: 'collect', key: 'q_de_cloth', item: '粗糙的布片', icon: 'q_goblin_fur', from: ['tombSkeleton', 'rockSkeleton'], dungeon: 'darkelf_tomb', rate: 0.4, n: 10, desc: '公国护卫披风上撕下来的布片，还能看出公国的纹章。' }],
      talk: { offer: ['姐姐加尔在前线天天骂人类，说大使的护卫是暗精灵杀的。', '我不信。墓地的骷髅身上挂着一些布片……你去带回来，交给克伦特看看。'], doing: ['墓地骷髅会举盾，绕到背后打。'], done: ['这是公国护卫的披风……伤口是骷髅的骨刃留下的，不是暗精灵的弯刀。', '有了这个，加尔也该冷静下来了。'] },
      reward: { exp: 0.08, gold: 3500 } },
    { id: 's_de_curse', name: '被诅咒的战争', lvl: 35, pre: 's_de_war',
      desc: '克伦特怀疑这场战争被人下了诅咒。去西海岸魔法师公会问问莎兰。',
      goals: [{ type: 'talk', npc: 'sharan', lines: ['被诅咒的战争？……克伦特的直觉没错。', '传染病让两个种族互相猜疑，这正是使徒留下的诅咒最擅长的事。', '回去告诉他：源头在诺伊佩拉，而王的遗迹里的冤魂知道更多。'] }],
      talk: { offer: ['传染病、失踪的大使、互相猜疑……一切都太巧了。', '人类的魔法师公会有一位叫莎兰的会长，她见过许多诅咒。替我去问问她。'], doing: ['莎兰在西海岸的魔法师公会。'], done: ['……使徒的诅咒。果然。'] },
      reward: { exp: 0.06, gold: 2500 } },
    { id: 's_de_suffer', name: '为了受苦的人们', lvl: 36, pre: ['s_de_curse', 'q_de10'],
      desc: '王的遗迹里的冤魂还在受苦。在「王的遗迹」收集 6 声冤魂的哀叹，并打倒不灭之王 波罗丁，让它们解脱。',
      goals: [{ type: 'collect', key: 'q_de_wail', item: '冤魂的哀叹', icon: 'q_glow_powder', from: ['wraith', 'tombSkeleton', 'rockSkeleton'], dungeon: 'king_ruins', rate: 0.35, n: 6, desc: '冤魂消散时留下的一撮发光的粉末，贴近耳朵能听见哭声。' },
        { type: 'kill', kind: 'boroding', boss: true, dungeon: 'king_ruins', text: '在王的遗迹打倒不灭之王 波罗丁' }],
      talk: { offer: ['莎兰说得对。遗迹里的冤魂被诅咒困住了，它们的王也一样。', '把冤魂的哀叹带回来，我会做成宁神符咒——然后请你让波罗丁王安息。'], doing: ['波罗丁在炎与冰之间切换，站进相反颜色的法阵。'], done: ['宁神符咒做好了。冤魂们……终于不哭了。', '暗精灵欠你一个人情，冒险家。'] },
      reward: { exp: 0.1, gold: 4500, items: [QI('m_contra', 3)] } },
  ],
  tour: { pre: 'q_de15', lvl: 38, steps: [
    { id: 'r_de1', name: '暗黑城巡礼', dungeons: ['shallow_haunt', 'spider_cave', 'darkelf_tomb', 'lava_cave', 'king_ruins', 'darkcity_gate'],
      desc: '【区域制霸】战争停下了，可暗黑城的怪物还在。把暗精灵地区的地下城各通关一次。',
      talk: { offer: ['停战的约定签下了，可暗黑城的怪物不认什么约定。', '把每一层都再走一遍吧——让暗精灵和人类都看看，这片土地已经安全了。'], doing: ['浅栖之地、蜘蛛洞穴、墓地、熔岩穴、王的遗迹、暗黑城入口——一个都不能少。'], done: ['营地里的孩子们都在传你的名字。', '最后一件事——诺伊佩拉和深渊。'] },
      reward: { exp: 0.1, gold: 6000, items: [QI('m_contra', 5), QI('abyss_ticket', 2)] } },
    { id: 'r_de2', name: '暗黑城的解放者', dungeons: ['neipera', 'abyss_darkelf'], pre: 'q_abyss_darkelf',
      desc: '【区域制霸】通关「诺伊佩拉」和「暗黑城深渊」，成为暗黑城的解放者。',
      talk: { offer: ['瘟疫的源头和深渊的裂缝还在地下。', '再去诺伊佩拉看一次，然后穿过暗黑城的深渊——之后，暗黑城就真正属于我们了。'], doing: ['深渊需要邀请函，歌兰蒂斯那里有。'], done: ['暗精灵王国会记住你——「暗黑城的解放者」。'] },
      reward: { exp: 0.12, gold: 10000, title: 'title_rg_darkelf', items: [QI('m_cosmos', 3)] } },
  ] },
});

/* ---------------- 万年雪山 · 斯顿雪域（Lv36~42） ---------------- */
defineRegionQuests('snow', { chapter: '雪山篇 · 支线', scene: 'storm_pass', npc: 'orca',
  dailies: [
    { id: 'd_sn_leather', name: '有用的皮革', npc: 'balrena', lvl: 38,   // 官方：有用的皮革（山脊 · 雪虎的毛皮）
      desc: '图卢斯族的盔甲要衬上雪虎的毛皮才不会冻裂。去「山脊」或「白色废墟」收集 12 张雪虎的毛皮。',
      goals: [{ type: 'collect', key: 'q_sn_fur', item: '雪虎的毛皮', icon: 'q_kaino_fur', from: ['iceTiger'], dungeon: ['ridge', 'white_ruins'], rate: 0.45, n: 12, desc: '厚实的白色毛皮，带着黑色的条纹。' }],
      talk: { offer: ['图卢斯族的盔甲冰龙都咬不穿——可是不衬毛皮，人会先冻僵。', '寒冰虎的毛皮最好。山脊和白色废墟都有，给我 12 张。'], doing: ['寒冰虎扑过来之前会压低身子。'], done: ['好皮子！今天又能多做两件内衬了。'] },
      reward: D(3200, [QI('c_blue', 5), QI('crystal', 20)]) },
    { id: 'd_sn_endless', name: '没有尽头', lvl: 41, pre: 'q_sn11',   // 官方：没有尽头（冰雪宫殿 · 孩子的灵魂结晶）
      desc: '冰雪宫殿里还冻着被洛丝带走的孩子们的灵魂。收集 6 块孩子的灵魂结晶，交给奥尔卡。',
      goals: [{ type: 'collect', key: 'q_sn_child', item: '孩子的灵魂结晶', icon: 'q_frost_crystal', dungeon: 'ice_palace', rate: 0.3, n: 6, desc: '小小的冰晶，里面好像有人在笑。' }],
      talk: { offer: ['冰雪女王洛丝倒下了，可她带走的孩子们……灵魂还冻在宫殿里。', '每天都有新的结晶从墙里渗出来。去把它们带回家吧。'], doing: ['冰雪宫殿在万年雪山的深处。'], done: ['族里的老人们会把它们埋在向阳的坡上。……这件事，没有尽头。'] },
      reward: D(3600, [QI('m_contra', 2), QI('abyss_ticket', 1)]) },
  ],
  sides: [
    { id: 's_sn_phantom', name: '幻影', npc: 'balrena', lvl: 37, pre: 'q_sn05',   // 官方：幻影 / 母亲的心（巴尔雷娜）
      desc: '巴尔雷娜总梦见走丢的哥哥查理。在「冰心少年」打倒查理，带回他身上的旧围巾。',
      goals: [{ type: 'collect', key: 'q_sn_scarf', item: '查理的旧围巾', icon: 'q_wt_mask', from: 'charlie', boss: true, dungeon: 'frozen_heart', rate: 1, rar: 2, desc: '褪了色的毛线围巾，角上绣着一个“查”字。' }],
      talk: { offer: ['……冰心少年？他的名字叫查理？', '我哥哥也叫查理，小时候在雪山里走丢了。我每天晚上都梦见他站在雪里，一动不动。', '求你了……如果真的是他，把他身上的东西带回来给我看看。'], doing: ['冰心少年的玩具士兵会一直冒出来。'], done: ['这条围巾……是妈妈织的。', '真的是他。他一直都在雪山里，一直在等人找到他。'] },
      reward: { exp: 0.08, gold: 3500 } },
    { id: 's_sn_mother', name: '母亲的心', npc: 'balrena', lvl: 38, pre: 's_sn_phantom',
      desc: '巴尔雷娜想把围巾埋回冰心少年的玩具屋。先征得班图族副族长奥尔卡的同意，再通关「冰心少年」。',
      goals: [{ type: 'talk', npc: 'orca', lines: ['图卢斯族的孩子……也被雪山带走了吗。', '去吧。雪山属于所有失去孩子的母亲。'] }, { type: 'clear', dungeon: 'frozen_heart' }],
      talk: { offer: ['妈妈到死都在织围巾，织了好多条，一条也没送出去。', '我想把这条围巾还给哥哥……可那里是班图族的土地，得先问问奥尔卡。'], doing: ['奥尔卡在村子中间。'], done: ['围巾埋好了吗？……谢谢你。', '妈妈要是知道，一定会很高兴。这是图卢斯族的护具，你收下吧。'] },
      reward: { exp: 0.08, gold: 3500, items: [QE('rand', 38, 3)] } },
    { id: 's_sn_bwanga', name: '族长的拳头', lvl: 41, pre: 'q_sn10',
      desc: '布万加只认拳头。以 A 以上的评价通关「布万加的修炼场」，让班图族的战士们服气。',
      goals: [{ type: 'clear', dungeon: 'bwanga_dojo', rank: 'A' }],
      talk: { offer: ['你打赢了我哥哥，可族里还有人不服。', '班图族只认拳头：在修炼场里打出漂亮的一仗，他们就会闭嘴。'], doing: ['评价要 A 以上——少挨打，打得快。'], done: ['战士们都在说你的事。布万加也……笑了，我很久没见他笑过。'] },
      reward: { exp: 0.08, gold: 4500, items: [QI('m_contra', 3)] } },
    { id: 's_sn_proof', name: '死斗的证据', lvl: 42, pre: 'q_sn14',   // 官方：死斗的证据（斯卡萨之巢 · 冰龙之魂）
      desc: '冰龙每次倒下都会留下一缕冰龙之魂。再去「斯卡萨之巢」两次，带回 2 缕冰龙之魂。',
      goals: [{ type: 'collect', key: 'q_sn_dragonsoul', item: '冰龙之魂', icon: 'q_wt_ice', from: 'skasa', boss: true, dungeon: 'skasa_nest', rate: 1, rar: 3, n: 2, desc: '冰龙斯卡萨的魂魄凝成的冰晶，永远不会融化。' }],
      talk: { offer: ['冰龙没有死透——它每次倒下都会留下一缕魂魄，三十年后又会醒来。', '把冰龙之魂带回来，族里的巫师会把它封进图腾。'], doing: ['斯卡萨的冰息会冻住脚下，别停在原地。'], done: ['两缕冰龙之魂……这下至少能多睡几十年了。'] },
      reward: { exp: 0.1, gold: 6000, items: [QI('m_contra', 3), QI('abyss_ticket', 2)] } },
  ],
  tour: { pre: 'q_sn14', lvl: 42, steps: [
    { id: 'r_sn1', name: '万年雪山巡礼', dungeons: ['frozen_heart', 'lik_well', 'ridge', 'white_ruins', 'bwanga_dojo', 'ice_palace'],
      desc: '【区域制霸】冰龙倒下了，雪山的怪物却更躁动了。把万年雪山的地下城各通关一次。',
      talk: { offer: ['冰龙倒下以后，雪山里的怪物像是没了主人，到处乱跑。', '把每一个地方都走一遍吧，班图族的猎人才敢上山。'], doing: ['冰心少年、利库天井、山脊、白色废墟、修炼场、冰雪宫殿。'], done: ['猎人们回来了，说雪山安静得像三十年前一样。'] },
      reward: { exp: 0.1, gold: 6500, items: [QI('m_contra', 5), QI('abyss_ticket', 2)] } },
    { id: 'r_sn2', name: '冰龙的征服者', dungeons: ['skasa_nest', 'abyss_snow'], pre: 'q_abyss_snow',
      desc: '【区域制霸】再通关「斯卡萨之巢」和「万年雪山深渊」，成为冰龙的征服者。',
      talk: { offer: ['最后是冰龙的巢穴，和雪山下面的深渊。', '做到这一步的人，班图族会叫他“冰龙的征服者”。'], doing: ['深渊需要邀请函。'], done: ['「冰龙的征服者」——这个名字会刻在班图族的图腾上。'] },
      reward: { exp: 0.12, gold: 11000, title: 'title_rg_snow', items: [QI('m_cosmos', 3)] } },
  ] },
});

/* ---------------- 远古 · 比尔马克帝国试验场 / 悲鸣洞穴（Lv44~50） ---------------- */
defineRegionQuests('ancient', { chapter: '远古 · 支线', scene: 'gf_lorien', npc: 'tuguan',
  dailies: [
    { id: 'd_an_gear', name: '帝国的齿轮', lvl: 45, pre: 'q_an01',
      desc: '土罐想拼出比尔马克帝国的机器。去「比尔马克帝国试验场」收集 8 个帝国的齿轮。',
      goals: [{ type: 'collect', key: 'q_an_gear', item: '帝国的齿轮', icon: 'q_rusty_iron', dungeon: 'bilmark', rate: 0.3, n: 8, desc: '刻着帝国纹章的黄铜齿轮，还带着机油味。' }],
      talk: { offer: ['嘘——我在拼一台帝国的机器。', '试验场里的伊凡和实验体身上都有齿轮，给我 8 个，一天 8 个就够。'], doing: ['伊凡会自爆，捡齿轮的时候离它远点。'], done: ['嘿嘿，又多了一截传动轴。等拼好了，第一个给你看！'] },
      reward: D(4000, [QI('m_contra', 2), QI('crystal', 30)]) },
    { id: 'd_an_wail', name: '征服悲鸣洞穴', npc: 'kurent', lvl: 50, pre: 'q_an03',   // 官方：征服悲鸣洞穴（灾难的征兆 + 蓝色小晶块）
      desc: '悲鸣洞穴每天都在渗出灾难的征兆。收集 10 个灾难的征兆，再带 10 个蓝色小晶块，克伦特要重新加固封印。',
      goals: [{ type: 'collect', key: 'q_an_omen', item: '灾难的征兆', icon: 'q_cursed_tooth', dungeon: 'wailing_cave', rate: 0.35, n: 10, desc: '虫王巢穴里长出来的黑色骨刺，碰到的东西都会枯萎。' }, { type: 'item', key: 'c_blue', n: 10 }],
      talk: { offer: ['悲鸣洞穴的封印每天都在变弱。', '带回灾难的征兆，我才知道裂缝在哪里；封印要用蓝色小晶块来补。'], doing: ['蓝色小晶块在分解装备或者地下城里都能拿到。'], done: ['封印补好了——今天的悲鸣，会小一点。'] },
      reward: D(4500, [QI('m_contra', 3), QI('abyss_ticket', 1)]) },
  ],
  sides: [
    { id: 's_an_hanik', name: '倔强的哈尼克', lvl: 45, pre: 'q_an02',
      desc: '试验场里的猫妖首领哈尼克和疯狂伊凡上校还在作乱。在「比尔马克帝国试验场」打倒它们。',
      goals: [{ type: 'kill', kind: 'hanik', dungeon: 'bilmark', text: '在比尔马克帝国试验场打倒倔强的哈尼克' }, { type: 'kill', kind: 'ivanColonel', dungeon: 'bilmark', text: '在比尔马克帝国试验场打倒疯狂伊凡上校' }],
      talk: { offer: ['机械牛倒了，可试验场里还有两个麻烦：猫妖的头儿哈尼克，和伊凡上校。', '哈尼克血量低了就再也打不退——一口气打倒它。'], doing: ['伊凡上校残血会变红追人自爆，躲开再打。'], done: ['试验场总算安静了。这是我在里面捡的，你拿着！'] },
      reward: { exp: 0.08, gold: 5000, items: [QI('m_contra', 3)] } },
    { id: 's_an_apophis', name: '魔剑阿波菲斯', npc: 'kurent', lvl: 50, pre: 'q_an04',
      desc: '盗墓者一直在悲鸣洞穴里挖魔剑阿波菲斯，骷髅凯恩也握着一把魔剑。在「悲鸣洞穴」打倒魔剑阿波菲斯和骷髅凯恩。',
      goals: [{ type: 'kill', kind: 'apophis', dungeon: 'wailing_cave', text: '在悲鸣洞穴打倒魔剑阿波菲斯' }, { type: 'kill', kind: 'kain', dungeon: 'wailing_cave', text: '在悲鸣洞穴打倒骷髅凯恩' }],
      talk: { offer: ['魔剑阿波菲斯……它在地下沉睡了几百年，现在又被盗墓者挖出来了。', '骷髅凯恩生前是个剑士，死后还握着魔剑不放。两个都要除掉。'], doing: ['魔剑出土后 20 秒内要打掉，否则盗墓者会发狂。'], done: ['魔剑的气息散了。凯恩……也终于放下了剑。'] },
      reward: { exp: 0.08, gold: 5500, items: [QI('m_contra', 3)] } },
  ],
  tour: { pre: 'q_an04', lvl: 50, steps: [
    { id: 'r_an1', name: '远古的探索者', dungeons: ['bilmark', 'wailing_cave'],
      desc: '【区域制霸】再闯一次比尔马克帝国试验场和悲鸣洞穴，证明你能看穿每一个机关。',
      talk: { offer: ['远古的地下城靠的不是蛮力，是看清楚。', '两个地方各闯一次，你就是真正的“远古的探索者”。'], doing: ['试验场在洛兰最右边，悲鸣洞穴在暗精灵地区最右边。'], done: ['嘿嘿，我就知道你行！这个称号是你的了。'] },
      reward: { exp: 0.12, gold: 10000, title: 'title_rg_ancient', items: [QI('m_cosmos', 3), QI('abyss_ticket', 2)] } },
  ] },
});

/* ---------------- 诺斯玛尔 · 天界根特（Lv44~52） ---------------- */
defineRegionQuests('gent', { chapter: '天界篇 · 支线', scene: 'heaven_gate', npc: 'kishika',
  dailies: [
    { id: 'd_gt_bandit', name: '诺斯玛尔的悬赏', npc: 'boken', lvl: 45,
      desc: '【每日悬赏】诺斯玛尔的疯狂盗贼团还在打劫过路人。在「堕落的盗贼」或「迷乱之村」哈穆林击败 30 个盗贼。',
      goals: [{ type: 'kill', kind: ['madBandit', 'madBanditF', 'banditGang'], dungeon: ['fallen_bandits', 'hamelin'], n: 30, text: '在诺斯玛尔击败疯狂盗贼' }],
      talk: { offer: ['魔震倒了，盗贼团可没散。', '公会的悬赏：每天清掉 30 个，赏金照发。'], doing: ['堕落的盗贼和哈穆林都有他们的人。'], done: ['赏金在这里。诺斯玛尔的路……总算有人敢走了。'] },
      reward: D(4000, [QI('m_contra', 2), QI('crystal', 30)]) },
    { id: 'd_gt_supply', name: '前线补给', lvl: 49,
      desc: '天界的抵抗军缺弹药。从「根特外围」「根特东门」的卡勒特士兵身上夺回 8 箱军需品。',
      goals: [{ type: 'collect', key: 'q_gt_supply', item: '卡勒特的军需箱', icon: 'q_org_seal', from: ['kartelGunner', 'kartelGrenadier', 'kartelMedic', 'kartelRider'], dungeon: ['gent_outskirts', 'gent_east'], rate: 0.3, n: 8, desc: '贴着卡勒特封条的小木箱，里面是弹药和绷带。' }],
      talk: { offer: ['抵抗军的弹药每天都不够用。', '卡勒特的士兵身上带着军需箱——抢回来，就是我们的了！'], doing: ['医疗兵身上的箱子最多，先打他们。'], done: ['弹药、绷带、还有罐头！今天前线又能撑一天。'] },
      reward: D(4500, [QI('m_contra', 3), QI('abyss_ticket', 1)]) },
  ],
  sides: [
    { id: 's_gt_piper', name: '消失的孩子们', npc: 'sosia', lvl: 46, pre: 'q_gt04',
      desc: '哈穆林的孩子们跟着笛声消失了。去「迷乱之村」哈穆林找回 6 个孩子们留下的小铃铛，交给索西雅。',
      goals: [{ type: 'collect', key: 'q_gt_bell', item: '孩子的小铃铛', icon: 'q_wt_orb', dungeon: 'hamelin', rate: 0.3, n: 6, desc: '系在孩子手腕上的铜铃铛，摇起来叮当响。' }],
      talk: { offer: ['我夜里在哈穆林那边听到过笛声……第二天，村里的孩子就一个都不见了。', '他们手上都系着小铃铛。求你去找找，哪怕只找到铃铛也好。'], doing: ['鼠群会一直涌过来，别站着不动。'], done: ['……六个铃铛。', '孩子们的父母至少还有个念想。这些药剂你带着，天界那边用得上。'] },
      reward: { exp: 0.08, gold: 5000, items: [QI('elixir', 3)] } },
    { id: 's_gt_flute', name: '情报的价值', npc: 'sherlock', lvl: 47, pre: 'q_gt05',
      desc: '夏洛克想要皮特的魔笛碎片——他说那上面刻着“天界的主人”的记号。在哈穆林打倒魔笛使者皮特，带回魔笛的碎片。',
      goals: [{ type: 'collect', key: 'q_gt_flute', item: '魔笛的碎片', icon: 'q_grey_shard', from: 'piper', boss: true, dungeon: 'hamelin', rate: 1, rar: 2, desc: '断成几截的骨笛，内侧刻着一个齿轮形状的记号。' }],
      talk: { offer: ['皮特临死前说“天界的主人会来接我”？嘿嘿，这可是值钱的情报。', '他的魔笛上一定有记号。拿碎片来，我告诉你一件天界的事。'], doing: ['打中真正的皮特，幻影就会散掉。'], done: ['齿轮记号……这是卡勒特的标志。', '天界的主人？不，是卡勒特在背后收买了这帮疯子。'] },
      reward: { exp: 0.08, gold: 5000, items: [QI('abyss_ticket', 1)] } },
    { id: 's_gt_order', name: '卡勒特的密令', lvl: 50, pre: 'q_gt10',
      desc: '本汀克和苏雷德身上都带着卡勒特的密令。在「根特外围」和「根特东门」分别打倒他们，夺回密令。',
      goals: [{ type: 'collect', key: 'q_gt_order1', item: '纵火犯的密令', icon: 'q_scroll', from: 'bentink', boss: true, dungeon: 'gent_outskirts', rate: 1, rar: 2, desc: '烧焦了一角的命令书：“烧掉外围的粮仓。”' },
        { type: 'collect', key: 'q_gt_order2', item: '机动队的密令', icon: 'q_scroll', from: 'suleide', boss: true, dungeon: 'gent_east', rate: 1, rar: 2, desc: '沾着机油的命令书：“东门得手后，与南门的 GT-9600 会合。”' }],
      talk: { offer: ['卡勒特的指挥官身上都带着密令。', '拿到它们，我们就知道卡勒特下一步要打哪里。'], doing: ['本汀克在外围，苏雷德在东门。'], done: ['……他们的目标不只是根特。北门、海上列车，全都在计划里。', '谢谢你，这些情报能救很多人。'] },
      reward: { exp: 0.1, gold: 6000, items: [QI('m_contra', 3)] } },
  ],
  tour: { pre: 'q_gt12', steps: [
    { id: 'r_gt1', name: '幽灵城巡礼', npc: 'boken', lvl: 48, dungeons: ['fallen_bandits', 'hamelin', 'abyss_norsemar'], pre: 'q_abyss_norsemar',
      desc: '【区域制霸】把诺斯玛尔的地下城和诺斯玛尔深渊各通关一次，让幽灵城重新有人住。',
      talk: { offer: ['公国想把诺斯玛尔重新建起来，可那里还是盗贼、老鼠和深渊。', '都清一遍吧——堕落的盗贼、哈穆林，还有诺斯玛尔深渊。'], doing: ['深渊需要邀请函。'], done: ['公国的工匠已经出发了。幽灵城……要改名字了。'] },
      reward: { exp: 0.1, gold: 7000, items: [QI('m_contra', 5), QI('abyss_ticket', 2)] } },
    { id: 'r_gt2', name: '皇都的守护者', lvl: 52, dungeons: ['gent_outskirts', 'gent_east', 'gent_south'],
      desc: '【区域制霸】再守一次根特的外围、东门和南门，成为皇都的守护者。',
      talk: { offer: ['卡勒特一次又一次地回来。', '外围、东门、南门——再守一遍。这次让他们记住，根特是有守护者的。'], doing: ['GT-9600 的防御模式护盾一定要打破。'], done: ['皇都的人都叫你「皇都的守护者」。……我也这么叫。'] },
      reward: { exp: 0.12, gold: 12000, title: 'title_rg_gent', items: [QI('m_cosmos', 3)] } },
  ] },
});

/* ---------------- 天界 · 海上列车（Lv52~56） ---------------- */
defineRegionQuests('train', { chapter: '天界篇 · 海上列车 · 支线', scene: 'luft_port', npc: 'harland',
  dailies: [
    { id: 'd_tr_pirate', name: '铁鳞海贼团的悬赏', lvl: 52,
      desc: '【每日悬赏】铁鳞海贼团天天袭击车站。在「列车上的海贼」或「夺回西部线」击败 30 个海贼。',
      goals: [{ type: 'kill', kind: ['seaPirate', 'spearPirate', 'bleedPirate', 'crocPirate'], dungeon: ['sea_pirates', 'west_line'], n: 30, text: '击败铁鳞海贼团的海贼' }],
      talk: { offer: ['乘客又被抢了！', '车站出悬赏：每天 30 个海贼，一个都不能少。'], doing: ['投枪海贼躲在后面，先收拾他们。'], done: ['今天的车准点发车了！赏金拿好。'] },
      reward: D(4800, [QI('m_contra', 3), QI('crystal', 40)]) },
    { id: 'd_tr_parts', name: '列车的备用零件', lvl: 54, pre: 'q_tr04',
      desc: '海上列车每天都要检修。从「夺回西部线」「雾都赫伊斯」的卡勒特士兵身上夺回 8 个备用零件。',
      goals: [{ type: 'collect', key: 'q_tr_parts', item: '列车的备用零件', icon: 'q_golem_shard', from: ['ktMarine', 'ktFlamer', 'ktShield', 'ktGunner'], dungeon: ['west_line', 'heis'], rate: 0.3, n: 8, desc: '海上列车的阀门和齿轮，被卡勒特拆下来带走了。' }],
      talk: { offer: ['卡勒特占着西部线的时候，把列车的零件拆得七零八落。', '他们的士兵身上还带着——抢回来，列车才跑得动。'], doing: ['火焰兵的油罐会爆炸，别贴太近。'], done: ['阀门、齿轮、压力表……都齐了。今天的检修能做完！'] },
      reward: D(5000, [QI('m_contra', 3), QI('abyss_ticket', 1)]) },
  ],
  sides: [
    { id: 's_tr_mermaid', name: '被锁住的人鱼', lvl: 52, pre: 'q_tr02',
      desc: '鳄鱼海贼把蓝色人鱼锁在船上当炮手。在「列车上的海贼」击败 10 个鳄鱼海贼，放走人鱼。',
      goals: [{ type: 'kill', kind: 'crocPirate', dungeon: 'sea_pirates', n: 10, text: '在列车上的海贼击败鳄鱼海贼' }],
      talk: { offer: ['你看到那些蓝色人鱼了吗？她们不是海贼——是被鳄鱼海贼锁在船上的。', '小人鱼空空也被抓去了。打倒看守的鳄鱼海贼，锁链就开了。'], doing: ['人鱼被迫攻击你的时候，别对她们下重手。'], done: ['海里传来了歌声……是人鱼在道谢。'] },
      reward: { exp: 0.08, gold: 5500, items: [QI('elixir', 3)] } },
    { id: 's_tr_log', name: '雾都的秘密', lvl: 55, pre: 'q_tr07',
      desc: '范·弗拉丁的航海日志里记着卡勒特的补给航线。在「雾都赫伊斯」打倒范·弗拉丁，带回航海日志。',
      goals: [{ type: 'collect', key: 'q_tr_log', item: '范·弗拉丁的航海日志', icon: 'q_captain_mark', from: 'fladin', boss: true, dungeon: 'heis', rate: 1, rar: 2, desc: '被雾气泡软的皮面日志，最后一页画着一条通往天界北方的航线。' }],
      talk: { offer: ['范·弗拉丁是卡勒特的船长，雾都的每一条船都归他管。', '他的航海日志里一定记着补给航线——拿到它，我们就能截断卡勒特的补给。'], doing: ['雾里的狙击手要先找出来。'], done: ['……补给航线一直通到天界北方。卡勒特真正的基地在那里。'] },
      reward: { exp: 0.08, gold: 6000, items: [QI('abyss_ticket', 1), QI('m_contra', 2)] } },
    { id: 's_tr_trek', name: '告密者特雷克', lvl: 56, pre: 'q_tr08',
      desc: '把列车时刻表卖给卡勒特的，是告密者特雷克。在「决战阿登高地」打倒 3 次特雷克。',
      goals: [{ type: 'kill', kind: 'trek', dungeon: 'arden', n: 3, text: '在决战阿登高地打倒告密者特雷克' }],
      talk: { offer: ['海贼每次都知道哪班车运货——有人在告密。', '查到了，是特雷克。他现在躲在阿登高地的卡勒特军营里。'], doing: ['特雷克打不过就会跑，追上去。'], done: ['特雷克的账本上记着好几个车站的名字……我这就去通知他们。'] },
      reward: { exp: 0.1, gold: 6500, items: [QI('m_contra', 3)] } },
  ],
  tour: { pre: 'q_tr09', steps: [
    { id: 'r_tr1', name: '海上铁道巡礼', lvl: 55, dungeons: ['sea_pirates', 'west_line', 'heis'],
      desc: '【区域制霸】沿着海上铁道再跑一趟：通关「列车上的海贼」「夺回西部线」「雾都赫伊斯」。',
      talk: { offer: ['海上列车重新运行了，可铁道沿线还不太平。', '陪列车再跑一趟吧——海贼、西部线、赫伊斯。'], doing: ['每一站都要通关一次。'], done: ['整条线路都安全了！乘客们在车厢里给你鼓掌呢。'] },
      reward: { exp: 0.1, gold: 7500, items: [QI('m_contra', 5), QI('abyss_ticket', 2)] } },
    { id: 'r_tr2', name: '海上列车的英雄', lvl: 56, dungeons: ['arden', 'abyss_train'], pre: 'q_abyss_train',
      desc: '【区域制霸】通关「决战阿登高地」和「海上列车深渊」，成为海上列车的英雄。',
      talk: { offer: ['最后是阿登高地和铁道尽头的深渊。', '做完这些，你就是海上列车永远的英雄。'], doing: ['深渊需要邀请函。'], done: ['「海上列车的英雄」——以后你坐车，永远免票！'] },
      reward: { exp: 0.12, gold: 12000, title: 'title_rg_train', items: [QI('m_cosmos', 4)] } },
  ] },
});

/* ---------------- 时空之门（Lv55~59） ---------------- */
{
const TG_ALL = ['grand_fire', 'plague_source', 'kartel_origin', 'holy_war', 'secret_zone', 'old_wail', 'old_winter', 'iris_raid'];
defineRegionQuests('timegate', { chapter: '时空之门篇 · 支线', scene: 'time_gate', npc: 'silan',
  dailies: [
    { id: 'd_tg_rift', name: '时空的裂隙', lvl: 56,
      desc: '时空之门每天都会裂开新的缝隙。通关时空之门的任意地下城 2 次，把裂隙压回去。',
      goals: [{ type: 'clear', dungeon: TG_ALL, n: 2, text: '通关时空之门的任意地下城' }],
      talk: { offer: ['门的另一边，过去正在一点点渗过来。', '每天穿过两次回廊，裂隙就会合上一些。'], doing: ['哪一段过去都可以。'], done: ['今天的裂隙合上了。……明天还会再开。'] },
      reward: D(5500, [QI('m_contra', 3), QI('m_cosmos', 1)]) },
    { id: 'd_tg_shard', name: '过去的回响', lvl: 58, pre: 'q_tg10',
      desc: '回廊后段的怪物身上带着时空的碎片。在「绝密区域」「昔日悲鸣」「凛冬」收集 10 块时空的碎片。',
      goals: [{ type: 'collect', key: 'q_tg_shard', item: '时空的碎片', icon: 'q_zero_g_shard', dungeon: ['secret_zone', 'old_wail', 'old_winter'], rate: 0.3, n: 10, desc: '一块浮在半空的透明碎片，里面映着不属于现在的景色。' }],
      talk: { offer: ['过去的回廊越往后，时空越不稳定。', '怪物身上的时空碎片会把回廊越撕越大。把它们收回来，我来封住。'], doing: ['绝密区域、昔日悲鸣、凛冬都有。'], done: ['碎片封好了。你看——里面映着的是三十年前的雪山。'] },
      reward: D(5800, [QI('m_cosmos', 2), QI('abyss_ticket', 1)]) },
  ],
  sides: [
    { id: 's_tg_fire', name: '那一年的大火', lvl: 55, pre: 'q_tg03',
      desc: '格兰之森的大火烧掉了无数树精。在「格兰之火」从燃烧的树精身上救下 5 颗还活着的种子。',
      goals: [{ type: 'collect', key: 'q_tg_seed', item: '格兰之森的种子', icon: 'q_herb', from: ['fireTreant'], dungeon: 'grand_fire', rate: 0.4, n: 5, desc: '被烤焦了外壳，里面还有一点绿意。' }],
      talk: { offer: ['那一年的大火……格兰之森到现在都没有完全长回来。', '燃烧的树精身上还有没烧坏的种子。救下来，带回现在的格兰之森去种。'], doing: ['燃烧的树精倒下之前会爆出火星。'], done: ['还活着……', '等赛丽亚把它们种下去，格兰之森又会多一片树荫。'] },
      reward: { exp: 0.08, gold: 6000, items: [QI('elixir', 3)] } },
    { id: 's_tg_gracia', name: '格拉西亚家族的荣耀', lvl: 57, pre: 'q_tg09',
      desc: '暗黑圣战里的尼尔巴斯·格拉西亚身上挂着家族的家徽。夺回家徽，给阿法利亚营地的克伦特看看。',
      goals: [{ type: 'collect', key: 'q_tg_crest', item: '格拉西亚家族的家徽', icon: 'q_spinel', from: 'nilbas', boss: true, dungeon: 'holy_war', rate: 1, rar: 3, desc: '一枚银质家徽，刻着一头獠牙野猪。' },
        { type: 'talk', npc: 'kurent', lines: ['这个家徽……是格拉西亚家族的。', '诺伊佩拉的名门，在暗黑圣战里站错了一边。家族的遗物后来都沉进了深渊。', '把它带回去吧，冒险家。过去的荣耀，就留在过去。'] }],
      talk: { offer: ['尼尔巴斯·格拉西亚……这个姓氏，暗精灵应该认得。', '把他的家徽带回来，去问问克伦特。'], doing: ['克伦特在阿法利亚营地。'], done: ['过去的荣耀，就留在过去……克伦特说得对。'] },
      reward: { exp: 0.08, gold: 6500, items: [QI('m_cosmos', 2)] } },
    { id: 's_tg_shade', name: '昔日的悲鸣', lvl: 58, pre: 'q_tg11',
      desc: '昔日的悲鸣洞穴里游荡着希洛克的残影——使徒在很久以前就来过。在「昔日悲鸣」击败 10 个希洛克的残影。',
      goals: [{ type: 'kill', kind: 'siroShade', dungeon: 'old_wail', n: 10, text: '在昔日悲鸣击败希洛克的残影' }],
      talk: { offer: ['昔日的悲鸣洞穴里……有希洛克的影子。', '那个使徒在很久以前就来过阿拉德。打散它的残影，别让它们顺着时空爬到现在。'], doing: ['残影会从背后出现。'], done: ['残影散了……可希洛克本身，还在魔界等着。'] },
      reward: { exp: 0.08, gold: 6500, items: [QI('m_cosmos', 2)] } },
    { id: 's_tg_iris', name: '吟游诗人的歌', lvl: 59, pre: 'q_tg13',
      desc: '吟游诗人艾丽丝唱的歌里藏着三条龙的来历。在「谜之觉悟」打倒艾丽丝，带回她的乐谱。',
      goals: [{ type: 'collect', key: 'q_tg_score', item: '艾丽丝的乐谱', icon: 'q_scroll', from: 'irisBard', boss: true, dungeon: 'iris_raid', rate: 1, rar: 3, desc: '五线谱的空白处写满了看不懂的文字。' }],
      talk: { offer: ['艾丽丝的歌……每一段都对应一条龙。', '她的乐谱里一定写着是谁把龙放到了阿拉德。'], doing: ['谜之觉悟在回廊的最深处。'], done: ['……乐谱的最后一页写着一个名字。现在还不能告诉你。', '等时候到了，我们再一起面对它。'] },
      reward: { exp: 0.1, gold: 7500, items: [QI('m_cosmos', 2), QI('abyss_ticket', 1)] } },
  ],
  tour: { pre: 'q_tg14', steps: [
    { id: 'r_tg1', name: '过去的回廊 · 前段', lvl: 57, dungeons: ['grand_fire', 'plague_source', 'kartel_origin', 'holy_war'],
      desc: '【区域制霸】把过去的回廊前段走完：格兰之火、瘟疫之源、卡勒特之初、暗黑圣战。',
      talk: { offer: ['过去的回廊还开着。每一段过去都值得再看一次。'], doing: ['前段四个地方，各一次。'], done: ['前段走完了。后段的时空更不稳定——小心。'] },
      reward: { exp: 0.1, gold: 7500, items: [QI('m_contra', 5)] } },
    { id: 'r_tg2', name: '过去的回廊 · 后段', lvl: 58, dungeons: ['secret_zone', 'old_wail', 'old_winter'],
      desc: '【区域制霸】走完过去的回廊后段：绝密区域、昔日悲鸣、凛冬。',
      talk: { offer: ['后段是帝国的试验场、悲鸣洞穴和三十年前的雪山。'], doing: ['三个地方，各一次。'], done: ['只剩最后一段了——谜之觉悟，还有门后的深渊。'] },
      reward: { exp: 0.1, gold: 8000, items: [QI('m_cosmos', 2), QI('abyss_ticket', 2)] } },
    { id: 'r_tg3', name: '时空的旅者', lvl: 59, dungeons: ['iris_raid', 'abyss_timegate'], pre: 'q_abyss_timegate',
      desc: '【区域制霸】通关「谜之觉悟」和「时空之门深渊」，成为时空的旅者。',
      talk: { offer: ['最后是谜之觉悟，和时空之门的深渊。', '走完这一步，你就见过阿拉德所有的过去了。'], doing: ['深渊需要邀请函。'], done: ['「时空的旅者」。……阿甘左要是知道，会很高兴的。'] },
      reward: { exp: 0.12, gold: 13000, title: 'title_rg_timegate', items: [QI('m_cosmos', 4)] } },
  ] },
});
}

/* ---------------- 魔界 · 希洛克（Lv60） ---------------- */
defineRegionQuests('siroco', { chapter: '第七章 · 支线', scene: 'siroco_town', npc: 'agonzo',
  dailies: [
    { id: 'd_si_patrol', name: '幻界巡逻', lvl: 60,
      desc: '希洛克的幻界每天都在重新长出来。通关法则之门、知性之门、痛苦之门中的任意 2 次。',
      goals: [{ type: 'clear', dungeon: ['law_gate', 'wit_gate', 'pain_gate'], n: 2, text: '通关希洛克的幻界（法则 / 知性 / 痛苦之门）' }],
      talk: { offer: ['幻界不会消失，它每天都会重新长出来。', '走两趟吧。别让它长回原来的样子。'], doing: ['背对她的凝视。'], done: ['……今天的幻界，比昨天薄了一点。'] },
      reward: D(6500, [QI('m_cosmos', 2), QI('m_contra', 3)]) },
    { id: 'd_si_abyss', name: '深渊的呼唤', npc: 'mira', lvl: 60, pre: 'q_abyss_gf',   // 终局每日：打一次任意深渊
      desc: '米拉在收购深渊里的东西。通关任意一个深渊派对。',
      goals: [{ type: 'clear', dungeon: ABYSS_ALL, text: '通关任意深渊派对' }],
      talk: { offer: ['深渊里捞出来的东西，在魔界可是硬通货。', '每天进一次深渊——随便哪一个——我就按老价钱给你结账，外加两张邀请函当定金。'], doing: ['邀请函不够？歌兰蒂斯那里能换。'], done: ['好货！这是今天的报酬，明天还来哦。'] },
      reward: D(8000, [QI('m_cosmos', 3), QI('abyss_ticket', 2)]) },
  ],
  sides: [
    { id: 's_si_eye', name: '深渊眼魔的眼球', npc: 'mira', lvl: 60, pre: 'q_si04',
      desc: '米拉说深渊眼魔的眼球在魔界很值钱。在「知性之门」「痛苦之门」收集 6 颗。',
      goals: [{ type: 'collect', key: 'q_si_eye', item: '深渊眼魔的眼球', icon: 'q_dragon_eye', from: ['gazer'], dungeon: ['wit_gate', 'pain_gate'], rate: 0.5, n: 6, desc: '还在转动的眼球。最好别盯着它看。' }],
      talk: { offer: ['深渊眼魔的眼球，魔界的贵族拿它当宝石戴。', '给我 6 颗，价钱好商量。'], doing: ['眼魔的激光会扫一整排，上下躲。'], done: ['成色真好！这是你的分成。'] },
      reward: { exp: 0.06, gold: 9000, items: [QI('m_cosmos', 2)] } },
    { id: 's_si_jailer', name: '碎颅狱卒', lvl: 60, pre: 'q_si06',
      desc: '碎颅狱卒守着幻界的牢房，被关进去的人再也没出来过。在「痛苦之门」或「无形棺柩」击败 8 个碎颅狱卒。',
      goals: [{ type: 'kill', kind: 'jailer', dungeon: ['pain_gate', 'siroco_coffin'], n: 8, text: '击败碎颅狱卒' }],
      talk: { offer: ['幻界里有一座牢房，碎颅狱卒守着门。', '被关进去的人……我找过，一个都没找到。打倒狱卒，牢门才会开。'], doing: ['狱卒的锤子砸下来之前会高高举起。'], done: ['牢门开了。里面是空的——他们早就被希洛克吞掉了。'] },
      reward: { exp: 0.06, gold: 9000, items: [QI('m_contra', 5)] } },
    { id: 's_si_luxi', name: '卢克西的记忆', lvl: 60, pre: 'q_si09',
      desc: '希洛克吞下的记忆里有卢克西的一部分。在「无形棺柩」讨伐希洛克，带回卢克西的记忆碎片。',
      goals: [{ type: 'collect', key: 'q_si_luxi', item: '卢克西的记忆碎片', icon: 'q_si_memory', from: 'siroco', boss: true, dungeon: 'siroco_coffin', rate: 1, rar: 3, desc: '淡紫色的晶片，里面映着一个女人回头微笑的样子。' }],
      talk: { offer: ['希洛克每次被打倒，都会吐出一点它吞下去的记忆。', '卢克西的记忆……只要一片就好。'], doing: ['别相信你看到的第一个希洛克。'], done: ['……她在笑。', '谢谢你。这些你拿去——我已经用不上了。'] },
      reward: { exp: 0.08, gold: 12000, items: [QI('m_cosmos', 3)] } },
  ],
  tour: { pre: 'q_si09', lvl: 60, steps: [
    { id: 'r_si1', name: '魔界巡礼', dungeons: ['law_gate', 'wit_gate', 'pain_gate'],
      desc: '【区域制霸】再闯一次希洛克的三道门：法则之门、知性之门、痛苦之门。',
      talk: { offer: ['希洛克倒下了，可它的幻界还在。', '再走一次三道门——这次不是为了救人，是为了让幻界记住，谁才是这里的主人。'], doing: ['三道门，各一次。'], done: ['幻界在发抖。……最后是棺柩和深渊。'] },
      reward: { exp: 0.1, gold: 12000, items: [QI('m_cosmos', 3), QI('abyss_ticket', 2)] } },
    { id: 'r_si2', name: '魔界的讨伐者', dungeons: ['siroco_coffin', 'abyss_siroco'], pre: 'q_abyss_siroco',
      desc: '【区域制霸】讨伐「无形棺柩」的潜行者希洛克并通关「魔界深渊」，成为魔界的讨伐者。',
      talk: { offer: ['最后一次——无形棺柩，和魔界的深渊。', '做完这些，魔界的恶魔们都会知道你的名字。'], doing: ['深渊需要邀请函。'], done: ['「魔界的讨伐者」。……卢克西要是在，一定会为你鼓掌。'] },
      reward: { exp: 0.12, gold: 15000, title: 'title_rg_siroco', items: [QI('m_cosmos', 5)] } },
  ] },
});

/* ---------------- 里程碑（赛丽亚，对应成就「百战精英」「超越极限」「破晓之巅」；不能一键完成） ---------------- */
{
const M = (id, def) => defineQuest(id, { type: 'side', chapter: '里程碑', npc: 'seria', noQuick: true, ...def });
M('q_ms40', { name: '百战精英', lvl: 40, pre: 'r_de2',
  desc: '成为暗黑城的解放者，并达到 Lv.40。',
  goals: [{ type: 'level', lvl: 40 }],
  talk: { offer: ['暗精灵的王国都在传你的名字呢。', '等你到了 Lv.40，回来给我看看好吗？'], done: ['百战精英……你已经是真正的冒险家了。这些是我攒下来的，收下吧。'] },
  reward: QR(40, 0.1, 15000, { coins: 3, items: [QI('m_contra', 5), QI('abyss_ticket', 3)] }) });
M('q_ms50', { name: '超越极限', lvl: 50, pre: ['q_ms40', 'r_sn2', 'r_an1'],
  desc: '征服冰龙、探索远古，并达到 Lv.50。',
  goals: [{ type: 'level', lvl: 50 }],
  talk: { offer: ['冰龙和远古的地下城……你一个人全都走过了？', 'Lv.50 的时候，再来找我。'], done: ['超越极限。……你走得比我想象的还要远。'] },
  reward: QR(50, 0.1, 25000, { items: [QI('amp_book', 1), QI('m_cosmos', 5)] }) });
M('q_ms60', { name: '破晓之巅', lvl: 60, pre: ['q_ms50', 'r_gt2', 'r_tr2', 'r_tg3', 'r_si2'],
  desc: '成为皇都的守护者、海上列车的英雄、时空的旅者和魔界的讨伐者，并达到满级 Lv.60。',
  goals: [{ type: 'level', lvl: 60 }],
  talk: { offer: ['天界、时空之门、魔界……阿拉德已经没有你没去过的地方了。', '到了 Lv.60，我在这里等你。'], done: ['破晓之巅。', '每天早上，我都会为你祈祷。以后也是。……欢迎回来，{name}。'] },
  reward: QR(60, 0.1, 40000, { items: [QI('m_soul', 1), QI('amp_book', 1), QI('m_cosmos', 10)] }) });
}
}
