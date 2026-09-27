/* =====================================================================
   支线任务：每个 NPC 至少一个（官方经典版的支线 / 系列挑战为主，道具名尽量用官方名；自创的标「自创」）
   ===================================================================== */
/* ---- 艾尔文防线 ---- */
defineQuest('s_ray_patrol', { name: '防线的巡逻', npc: ['ray', 'linus'], lvl: 1,   // 自创
  desc: '哨兵雷蒙希望你帮忙清理洛兰一带的哥布林，让防线的居民能安心出门。',
  goals: [{ type: 'kill', kind: ['goblin', 'goblinThrower'], dungeon: 'lorien', n: 15, text: '在洛兰击败哥布林' }],
  talk: { offer: ['站住！……啊，是冒险家啊。抱歉，最近哥布林太多，大家都神经兮兮的。', '我一个人守不过来。能帮我在洛兰清理掉 15 只哥布林吗？'], done: ['谢谢！今晚防线的大家总算能睡个安稳觉了。'] },
  reward: QR(1, 0.35, 400, { items: [QI('hpS', 5)] }) });

defineQuest('s_lily_elf', { name: '精灵的足迹', npc: ['lily', 'seria'], lvl: 2,   // 自创
  desc: '精灵迷莉莉相信洛兰还留着精灵的足迹。以 B 以上的评价通关洛兰，替她看看。',
  goals: [{ type: 'clear', dungeon: 'lorien', rank: 'B' }],
  talk: { offer: ['你知道吗？很久以前，艾尔文防线住满了精灵！这些大树屋都是他们的家！', '听说洛兰的树林里还留着精灵的足迹……可是哥布林太多了，我不敢去。', '你能去洛兰帮我看看吗？要打得漂漂亮亮的（评价 B 以上），精灵才会现身哦！'], done: ['真的看到了发光的脚印？！呀——我就知道！', '这个是我收藏的宝贝，送给你！'] },
  reward: QR(2, 0.3, 300, { items: [QI('mpM', 3)] }) });

defineQuest('s_linus_ring', { name: '赛丽亚的戒指', npc: 'linus', to: 'seria', lvl: 3,
  desc: '赛丽亚的戒指被洛兰深处的牛头兵抢走了。林纳斯拜托你把它找回来，直接交给赛丽亚。',
  goals: [{ type: 'collect', key: 'q_seria_ring', item: '赛丽亚的戒指', from: 'tauSoldierBoss', boss: true, dungeon: 'lorien_deep', rate: 1, desc: '一枚小巧的银戒指，内侧刻着精灵文字。' }],
  talk: { offer: ['赛丽亚那丫头去林边采药的时候，被牛头兵抢走了戒指。她嘴上说没关系，其实难过得不得了。', '那戒指是她从小戴着的。去洛兰深处，从牛头兵首领身上把它拿回来，直接交给她吧。'], doing: ['牛头兵首领就在洛兰深处。'], done: ['这是……我的戒指！你专门去帮我找回来的吗？', '谢谢你……我会好好珍惜它的。'] },
  reward: QR(3, 0.35, 600, { items: [QI('hpM', 3)] }) });

defineQuest('s_board_badge', { name: '复仇的徽章', npc: ['board', 'linus'], lvl: 3,
  desc: '【布告】哥布林十夫长屡次袭击商队。带回 6 个十夫长的标记，可领取赏金。',
  goals: [{ type: 'collect', key: 'q_captain_mark', item: '十夫长的标记', from: 'goblinCaptain', rate: 0.6, n: 6, desc: '哥布林十夫长佩戴的铁制徽章。' }],
  talk: { offer: ['【艾尔文防线布告栏】', '悬赏：哥布林十夫长屡次袭击往来的商队，已有多人受伤。', '凡带回 6 个“十夫长的标记”者，可领取赏金。——艾尔文防线自卫队'], done: ['【布告栏】赏金已发放。感谢你为防线做出的贡献！'] },
  reward: QR(3, 0.35, 900) });

defineQuest('s_tuguan_bet', { name: '土罐的打赌', npc: ['tuguan', 'linus'], lvl: 3,
  desc: '罐子商人土罐跟人打赌，说有冒险家能在 2 分 30 秒内通关洛兰深处。',
  goals: [{ type: 'clear', dungeon: 'lorien_deep', time: 150 }],
  talk: { offer: ['嘿嘿嘿，我跟火罐那家伙打了个赌！', '我说，一定有冒险家能在 2 分 30 秒之内通关洛兰深处！他不信，赌注是一整车罐子！', '帮帮我吧！赢了分你一半……呃，分你点好东西！'], doing: ['2 分 30 秒！一秒都不能多！'], done: ['赢啦赢啦！火罐那家伙的脸都绿了！', '说好的谢礼！拿去拿去！'] },
  reward: QR(3, 0.35, 1200, { items: [QI('hpM', 5)] }) });

defineQuest('s_linus_wine', { name: '馋酒的人', npc: 'linus', to: ['tuguan', 'linus'], lvl: 11,
  desc: '林纳斯想喝一口好酒。去问问罐子商人土罐有没有门路。',
  talk: { offer: ['唉……打了一天铁，就想喝上一口好酒。', '集市的土罐那里什么罐子都有，说不定也有酒坛子。帮我去问问。'], done: ['酒？当然有门路！不过酿好酒得有好材料……'] },
  reward: QR(11, 0.15, 800) });

defineQuest('s_linus_wine2', { name: '酿酒材料', npc: ['tuguan', 'linus'], to: 'linus', lvl: 11, pre: 's_linus_wine',
  desc: '酿极品谷酒需要熟透的山葡萄。格兰之森的怪物们常常偷吃山葡萄，打倒它们就能找到。',
  goals: [{ type: 'collect', key: 'q_wild_grape', item: '熟透的山葡萄', rate: 0.25, n: 8, desc: '紫得发黑的山葡萄，香气扑鼻。' }],
  talk: { offer: ['要酿极品谷酒，得用熟透的山葡萄。', '格兰之森的怪物们老偷吃山葡萄，打倒它们多半能找到几串。找齐 8 串，直接送去给林纳斯吧，我会把酿法告诉他。'], doing: ['山葡萄要熟透的，青的可不行。'], done: ['哦哦——这香味！土罐那小子果然有两下子。', '等酿好了，第一杯请你喝！先拿着这个。'] },
  reward: QR(11, 0.3, 2000, { items: [QI('crystal', 10)] }) });

/* ---- 赫顿玛尔 ---- */
defineQuest('s_olan_herb', { name: '奶奶的草药', npc: ['olan', 'grandis'], lvl: 4,   // 自创
  desc: '杂货奶奶奥兰的草药被幽暗密林的哥布林偷走了。',
  goals: [{ type: 'collect', key: 'q_herb', item: '被偷走的草药', from: Q_GOBLINS, dungeon: 'dark_woods', rate: 0.45, n: 6, desc: '晒干的药草，闻起来有薄荷的清香。' }],
  talk: { offer: ['哎哟，年轻人，来得正好。', '奶奶晒在后院的草药，被幽暗密林跑出来的哥布林偷走了。那可是给街坊们治咳嗽的呀。', '能帮奶奶找回 6 包吗？'], done: ['好孩子，好孩子。来，这些药你拿着路上用。'] },
  reward: QR(4, 0.35, 700, { items: [QI('hpM', 5), QI('mpM', 3)] }) });

defineQuest('s_paris_fur', { name: '哥布林材料', npc: 'paris', lvl: 4,
  desc: '帕丽丝想用哥布林毛皮做一批新款式的时装。',
  goals: [{ type: 'collect', key: 'q_goblin_fur', item: '哥布林毛皮', from: Q_GOBLINS, rate: 0.4, n: 8, desc: '粗糙但结实的毛皮，据说染色后意外地好看。' }],
  talk: { offer: ['勇士～你觉得哥布林毛皮做成披风会不会很可爱？', '我想试试新款式！帮我收集 8 张哥布林毛皮好不好？作为回报，送你一个超受欢迎的称号哦～'], done: ['哇，手感比想象的还好！新款式一定大卖！', '这是说好的称号～戴上它，你就是赫顿玛尔最时尚的冒险家啦！'] },
  reward: QR(4, 0.3, 500, { title: '时尚冒险家', titleKey: 'title_fashion' }) });

defineQuest('s_fengzhen_wind', { name: '像风一样(难)', npc: 'fengzhen', lvl: 5,
  desc: '风振的挑战：在 3 分钟内通关幽暗密林深处。',
  goals: [{ type: 'clear', dungeon: 'dark_woods_deep', time: 180 }],
  talk: { offer: ['风拳流的第一课：快。', '像风一样穿过森林——3 分钟内通关幽暗密林深处。做得到吗？'], doing: ['太慢了。风是不会停下来的。'], done: ['……不错。你已经摸到风的影子了。'] },
  reward: QR(5, 0.4, 1000, { sp: 10 }) });

defineQuest('s_albert_skill', { name: '技能的研究', npc: ['albert', 'gsd'], lvl: 5,   // 自创
  desc: '技能研究家阿尔伯特想收集实战数据：在战斗中使用 40 次技能。',
  goals: [{ type: 'skill', n: 40, text: '在战斗中使用技能' }],
  talk: { offer: ['你好你好！我是研究技能的阿尔伯特！', '书上的理论已经读烂了，我需要实战数据！在战斗中使用 40 次技能，然后回来告诉我手感如何！'], doing: ['数据还不够！再多用几次技能！'], done: ['太棒了，这些数据太珍贵了！', '作为回报，这本技能心得送给你——读完能多领悟一些技能点。'] },
  reward: QR(5, 0.3, 800, { sp: 20 }) });

defineQuest('s_kiri_test', { name: '凯丽的测试(难)', npc: 'kiri', lvl: 6,
  desc: '凯丽想看看你敢不敢强化：把武器强化到 +4。',
  goals: [{ type: 'enhance', slot: 'weapon', lvl: 4 }],
  talk: { offer: ['来自天界的强化技术，可不是随便谁都敢试的哦~', '把你的武器强化到 +4 给我看看！失败了也别哭鼻子~'], doing: ['+4 哦，+4！加油~'], done: ['闪闪发光的！很有胆量嘛~', '这些晶块送你，以后常来凯丽这里强化哦！'] },
  reward: QR(6, 0.3, 1500, { items: [QI('crystal', 30)] }) });

defineQuest('s_boken_guild', { name: '公会的悬赏', npc: ['boken', 'skadi'], lvl: 8,   // 自创
  desc: '公会管理员博肯发布的悬赏：击败 5 只精英怪物。',
  goals: [{ type: 'kill', elite: true, n: 5, text: '击败精英怪物' }],
  talk: { offer: ['冒险家公会本周的悬赏：精英怪物。', '那些家伙比普通怪物强得多，经常伤到新人。击败 5 只，公会有重赏。'], done: ['公会记下你的功劳了。这是赏金。'] },
  reward: QR(8, 0.35, 2000, { items: [QI('hpL', 2)] }) });

defineQuest('s_sosia_venom', { name: '药剂的材料', npc: ['sosia', 'grandis'], lvl: 9,   // 自创
  desc: '药剂商人索西雅需要毒爪猫妖的毒腺来调制解毒剂。',
  goals: [{ type: 'collect', key: 'q_venom_gland', item: '毒爪猫妖的毒腺', from: 'catVenom', dungeon: 'venom_ruins', rate: 0.45, n: 6, desc: '装着紫色毒液的小囊。以毒攻毒，是调制解毒剂的好材料。' }],
  talk: { offer: ['最近中毒的冒险家越来越多了，解毒剂都快卖断货了。', '解毒剂的主材料是毒爪猫妖的毒腺——以毒攻毒嘛。帮我弄 6 个来？'], done: ['嗯嗯，成色不错！这些药水就当是谢礼啦～'] },
  reward: QR(9, 0.35, 1500, { items: [QI('hpL', 3), QI('mpM', 5)] }) });

defineQuest('s_sherlock_trust', { name: '夏洛克的托付', npc: ['sherlock', 'fengzhen'], lvl: 7,
  desc: '雷鸣废墟的哥布林总是抢夏洛克的货。帮他出口气：击败 15 只哥布林。',
  goals: [{ type: 'kill', kind: Q_GOBLINS, dungeon: 'thunder_ruins', n: 15, text: '在雷鸣废墟击败哥布林' }],
  talk: { offer: ['那些家伙……每次我运货经过雷鸣废墟，都要被抢走一半！', '都是以前欺负我的同族……帮我狠狠教训他们一顿，打倒 15 只！'], done: ['呼——心里舒坦多了！这是给你的，别客气！'] },
  reward: QR(7, 0.35, 1500) });

defineQuest('s_sherlock_biz', { name: '生意上的事', npc: ['sherlock', 'fengzhen'], lvl: 9, pre: 's_sherlock_trust',
  desc: '夏洛克接了一笔大订单，需要 10 瓶小型生命药剂。',
  goals: [{ type: 'item', key: 'hpS', n: 10 }],
  talk: { offer: ['嘿嘿，接到一笔大订单！可我手头的药剂不够……', '能卖给我 10 瓶小型生命药剂吗？价钱好商量！'], doing: ['10 瓶小型生命药剂！药剂商人那里就能买到。'], done: ['好好好！生意成了！这是货款，外加一点小费！'] },
  reward: QR(9, 0.2, 2500) });

defineQuest('s_minette_night', { name: '暗夜的试炼', npc: ['minette', 'gsd'], lvl: 12,   // 自创
  desc: '暗夜使者米内特的试炼：不使用复活币，以 A 以上的评价通关猛毒雷鸣废墟。',
  goals: [{ type: 'clear', dungeon: 'venom_ruins', rank: 'A', noCoin: true }],
  talk: { offer: ['……暗夜使者的道路，还没有向你们开放。', '但我想看看，你是否配得上黑暗。——不借助复活币的力量，以 A 以上的评价穿过猛毒雷鸣废墟。'], doing: ['影子是不会倒下的。'], done: ['……有意思。总有一天，我们还会再见的。'] },
  reward: QR(12, 0.35, 3000, { coins: 2 }) });

defineQuest('s_skadi_border', { name: '女王的委托', npc: 'skadi', lvl: 11,   // 自创
  desc: '斯卡迪女王担忧格拉卡的牛头怪会越过边境。在格拉卡击败 25 只牛头怪。',
  goals: [{ type: 'kill', kind: Q_TAUS, dungeon: ['graca', 'blazing_graca'], n: 25, text: '在格拉卡击败牛头怪' }],
  talk: { offer: ['勇士，贝尔玛尔公国需要你的力量。', '格拉卡的牛头怪日渐凶暴，边境的村庄已经多次遭到袭击。', '请替我削弱它们的势力——在格拉卡击败 25 只牛头怪。'], done: ['边境的村民们会记住你的名字。这是王国的谢礼。'] },
  reward: QR(11, 0.4, 4000, { items: [QE('rand', 12, 2)] }) });

defineQuest('s_vier_arena', { name: '竞技大赛的邀请', npc: ['vier', 'skadi'], lvl: 10,   // 自创
  desc: '维尔·克鲁想邀请有实力的冒险家参加竞技大赛：以 SS 以上的评价通关任意地下城。',
  goals: [{ type: 'clear', dungeon: 'any', rank: 'SS' }],
  talk: { offer: ['我是竞技大赛的主办人维尔·克鲁。', '我在寻找真正的强者。以 SS 以上的评价通关任意一个地下城，证明给我看！'], done: ['漂亮！竞技场的大门随时为你敞开！'] },
  reward: QR(10, 0.35, 3000, { items: [QI('guard', 1)] }) });

defineQuest('s_grandis_rest', { name: '安息的祈祷', npc: 'grandis', lvl: 16,   // 自创
  desc: '暗黑雷鸣废墟的亡者无法安息。击败 20 只僵尸，让它们回归大地。',
  goals: [{ type: 'kill', kind: ['zombie', 'zombieRed'], dungeon: 'dark_thunder', n: 20, text: '在暗黑雷鸣废墟击败僵尸' }],
  talk: { offer: ['愿神的光辉指引你。', '暗黑雷鸣废墟的亡者们被邪恶束缚，无法安息。它们也曾是有家人的人啊。', '请让 20 位亡者回归大地。我会在大圣堂为他们祈祷。'], done: ['……我听到了，他们终于安息了。愿你的前路光明。'] },
  reward: QR(16, 0.4, 5000, { items: [QI('elixir', 2)] }) });

defineQuest('s_gsd_eye', { name: 'G.S.D的修炼 - 心眼', npc: 'gsd', lvl: 10,
  desc: 'G.S.D 的修炼：被击不超过 5 次通关幽暗密林深处。',
  goals: [{ type: 'clear', dungeon: 'dark_woods_deep', hurt: 5 }],
  talk: { offer: ['眼睛会骗人，心不会。', '用心眼去看敌人的动作——被击不超过 5 次，穿过幽暗密林深处。'], doing: ['你在用眼睛看。'], done: ['……你开始“看见”了。'] },
  reward: QR(10, 0.4, 2000, { sp: 15 }) });

defineQuest('s_norton_mage', { name: '邪恶的魔法师', npc: ['norton', 'kiri'], lvl: 13,
  desc: '诺顿收到消息：冰霜克拉赫和烈焰彼诺修这对魔法师姐妹在森林里作乱。',
  goals: [{ type: 'kill', kind: 'frostMage', boss: true, text: '击败 冰霜克拉赫' }, { type: 'kill', kind: 'flameMage', boss: true, text: '击败 烈焰彼诺修' }],
  talk: { offer: ['做生意的最怕路不太平。', '冰霜克拉赫和烈焰彼诺修，一冰一火，把森林两头的商路都堵死了。帮我把她们都解决掉吧。'], done: ['商路总算通了！这是我的一点心意。'] },
  reward: QR(13, 0.45, 4000, { items: [QE('rand', 14, 2)] }) });

defineQuest('s_sinda_horn', { name: '结实的角', npc: ['sinda', 'linus'], lvl: 12,
  desc: '辛达要用牛头怪的硬角做锻造用的锤柄。',
  goals: [{ type: 'collect', key: 'q_tau_horn', item: '牛头怪的硬角', from: Q_TAUS, rate: 0.45, n: 7, desc: '又硬又韧的牛角，是做锤柄的好材料。' }],
  talk: { offer: ['好的锤柄，得用牛头怪的硬角来做——又硬又韧，敲一万下都不会裂。', '帮我弄 7 根来！'], done: ['好角！好角！这下能打出好东西了！'] },
  reward: QR(12, 0.35, 3000, { items: [QI('crystal', 20)] }) });

/* ---- 魔法阵线（官方：修补魔法阵布告 → 寻找魔法粘合剂的材料 → 委托罗莉安 → 缺少胶水 → 传递魔法粘合剂） ---- */
defineQuest('s_mc1', { name: '修补魔法阵布告', npc: ['board', 'seria'], to: 'sharan', lvl: 6,
  desc: '【布告】保护艾尔文防线的精灵魔法阵出现了裂痕，请有能力的冒险家联系西海岸的魔法师莎兰。',
  talk: { offer: ['【艾尔文防线布告栏】', '通知：守护防线的古老魔法阵出现了裂痕。', '有能力的冒险家，请前往西海岸魔法师公会，协助暗精灵魔法师莎兰进行修补。'], done: ['你是看到布告来的？很好。', '修补魔法阵需要特制的魔法粘合剂……材料可不好找。'] },
  reward: QR(6, 0.2, 500) });

defineQuest('s_mc2', { name: '寻找魔法粘合剂的材料', npc: 'sharan', lvl: 7, pre: 's_mc1',
  desc: '魔法粘合剂需要 3 个牛头怪的硬角、2 张凯诺的毛皮和 2 个寒气结晶。',
  goals: [
    { type: 'collect', key: 'q_glue_horn', item: '牛头怪的硬角', from: Q_TAUS, rate: 0.45, n: 3, desc: '又硬又韧的牛角。' },
    { type: 'collect', key: 'q_kaino_fur', item: '凯诺的毛皮', from: 'goblinShaman', boss: true, rate: 1, n: 2, desc: '落雷凯诺的毛皮，摸上去会噼啪作响。' },
    { type: 'collect', key: 'q_glue_frost', item: '寒气结晶', from: 'goblinFrost', rate: 0.5, n: 2, desc: '冰霜哥布林身上的结晶。' }],
  talk: { offer: ['魔法粘合剂的配方是：牛头怪的硬角 3 个，凯诺的毛皮 2 张，寒气结晶 2 个。', '硬角在牛头怪身上，毛皮要从雷鸣废墟的落雷凯诺身上剥，寒气结晶……冰霜哥布林身上有。去吧。'], doing: ['材料不齐，粘合剂是做不出来的。'], done: ['嗯，材料齐了。', '不过调制粘合剂还需要胶水做底料——这方面，罗莉安比我在行。'] },
  reward: QR(7, 0.35, 1200) });

defineQuest('s_mc3', { name: '委托罗莉安', npc: 'sharan', to: ['lorian', 'roget'], lvl: 7, pre: 's_mc2',
  desc: '把材料送到西海岸的魔法商人罗莉安那里，请她调制粘合剂。',
  talk: { offer: ['把这些材料交给西海岸商贸区的罗莉安。', '她虽然爱打扮，调配药剂的手艺却是一流的。'], done: ['哎呀，莎兰姐姐的委托？交给我吧～', '……咦，胶水不够了呀。'] },
  reward: QR(7, 0.15, 500) });

defineQuest('s_mc4', { name: '缺少胶水', npc: ['lorian', 'roget'], lvl: 8, pre: 's_mc3',
  desc: '调粘合剂的胶水被幽暗密林的哥布林偷走了。找回 4 瓶胶水。',
  goals: [{ type: 'collect', key: 'q_glue', item: '胶水', from: Q_GOBLINS, dungeon: ['dark_woods', 'dark_woods_deep'], rate: 0.4, n: 4, desc: '黏糊糊的一小瓶。哥布林好像拿它粘陷阱。' }],
  talk: { offer: ['我的胶水……上次去格兰之森采集的时候，被哥布林顺走了！', '它们拿去粘陷阱了吧，真讨厌～帮我从幽暗密林的哥布林那里拿回 4 瓶好不好？'], done: ['就是这个！粘合剂马上就能调好～'] },
  reward: QR(8, 0.3, 1200) });

defineQuest('s_mc5', { name: '传递魔法粘合剂', npc: ['lorian', 'roget'], to: ['board', 'seria'], lvl: 8, pre: 's_mc4',
  desc: '把调好的魔法粘合剂送回艾尔文防线，修补魔法阵。',
  talk: { offer: ['调好啦！闪闪发亮的魔法粘合剂～', '快送回艾尔文防线吧，布告栏旁边就是魔法阵的基石。'], done: ['【艾尔文防线布告栏】', '魔法阵修补完成。艾尔文防线全体居民，向你致以最诚挚的谢意！'] },
  reward: QR(8, 0.4, 2000, { items: [QI('elixir', 1), QI('guard', 1)] }) });

/* ---- 西海岸 ---- */
defineQuest('s_lorian_skin', { name: '罗莉安的皮肤护理法', npc: ['lorian', 'roget'], lvl: 8,
  desc: '罗莉安听说荧光猫妖的骨粉能让皮肤发光。',
  goals: [{ type: 'collect', key: 'q_glow_powder', item: '萤光猫妖的骨粉', from: 'catGlow', rate: 0.5, n: 5, desc: '在黑暗中微微发光的粉末。' }],
  talk: { offer: ['听说……荧光猫妖的骨粉，能让皮肤像月光一样发光哦！', '帮我弄 5 份来嘛～我请你喝茶！'], done: ['哇～真的在发光！谢谢你～这些是回礼！'] },
  reward: QR(8, 0.3, 1000, { items: [QI('mpM', 5)] }) });

defineQuest('s_kk1', { name: '暗恋', npc: ['kakun', 'roget'], to: ['lorian', 'roget'], lvl: 10,
  desc: '暗精灵商人卡坤暗恋赛丽亚很久了，想请罗莉安出出主意。',
  talk: { offer: ['那个……你认识艾尔文防线的赛丽亚小姐吧？', '我……我从第一次见到她就……啊啊啊我在说什么！', '总之！能帮我去问问罗莉安，女孩子都喜欢什么礼物吗？'], done: ['卡坤那家伙？噗——终于忍不住了吗～', '行吧，看在你的面子上，我就教教他。'] },
  reward: QR(10, 0.15, 800) });

defineQuest('s_kk2', { name: '罗莉安的指教', npc: ['lorian', 'roget'], to: ['kakun', 'roget'], lvl: 10, pre: 's_kk1',
  desc: '罗莉安说：猫妖脚爪做的护身符最受女孩子欢迎。收集 5 个猫妖脚爪交给卡坤。',
  goals: [{ type: 'collect', key: 'q_cat_paw', item: '猫妖脚爪', from: Q_CATS, rate: 0.45, n: 5, desc: '软软的肉垫，据说能带来好运。' }],
  talk: { offer: ['女孩子嘛，最喜欢又可爱又能保平安的东西。', '用猫妖脚爪做的护身符，软软的，还能带来好运～收集 5 个，拿给卡坤让他自己做！'], done: ['猫、猫妖脚爪？……好、好可爱！', '我这就熬夜做护身符！'] },
  reward: QR(10, 0.3, 1500) });

defineQuest('s_kk3', { name: '鼓起勇气', npc: ['kakun', 'roget'], to: 'seria', lvl: 10, pre: 's_kk2',
  desc: '卡坤做好了护身符，却不敢自己送。帮他把护身符和信交给赛丽亚。',
  talk: { offer: ['护、护身符做好了……', '可是我……我一看到赛丽亚小姐就说不出话来。', '拜托你！帮我把护身符和这封信交给她！'], done: ['这是……卡坤先生送的？', '（赛丽亚认真地读完了信，脸微微红了。）'] },
  reward: QR(10, 0.15, 800) });

defineQuest('s_kk4', { name: '赛丽亚的答复', npc: 'seria', to: ['kakun', 'roget'], lvl: 10, pre: 's_kk3',
  desc: '把赛丽亚的答复带回给卡坤。',
  talk: { offer: ['请替我谢谢卡坤先生。护身符很可爱，我会好好收着的。', '不过……我的心里，好像一直在等一个很久很久以前的约定。', '所以，我们做朋友吧——请这样告诉他。'], done: ['……朋、朋友吗。', '嗯……能做朋友，我已经很开心了！真的！谢谢你！'] },
  reward: QR(10, 0.35, 2000, { items: [QI('elixir', 1)] }) });

defineQuest('s_daphne_cloth', { name: '交换碎布片', npc: ['daphne', 'roget'], lvl: 5,
  desc: '首饰商人达芙妮在研究新的饰品材料：5 根哥布林胡须和 5 撮牛头怪的毛发。',
  goals: [
    { type: 'collect', key: 'q_goblin_beard', item: '哥布林胡须', from: Q_GOBLINS, rate: 0.4, n: 5, desc: '又硬又卷的胡须。' },
    { type: 'collect', key: 'q_tau_hair', item: '牛头怪的毛发', from: Q_TAUS, rate: 0.5, n: 5, desc: '粗硬的黑色毛发，编起来很结实。' }],
  talk: { offer: ['我在研究新的饰品编织法。', '哥布林胡须够硬，牛头怪的毛发够韧——各给我 5 份，我拿好东西跟你换。'], done: ['嗯，品质很好。说好的交换～'] },
  reward: QR(5, 0.35, 900, { items: [QE('ring', 6, 1)] }) });

defineQuest('s_roget_craft', { name: '生产商的委托', npc: 'roget', lvl: 8,   // 自创
  desc: '罗杰要为一批出海的船打造铁件，需要 30 个无色小晶块。',
  goals: [{ type: 'item', key: 'crystal', n: 30 }],
  talk: { offer: ['海风的味道，闻起来就像冒险！', '有一批船要出海，船上的铁件得用无色小晶块加固。你手头有 30 个吗？我按市价加倍收！'], done: ['好嘞！这下船能平安出海了！'] },
  reward: QR(8, 0.25, 2500) });

defineQuest('s_ophelia_spine', { name: '调查牛头怪的炼金大师', npc: ['ophelia', 'sharan'], lvl: 12,
  desc: '奥菲利亚怀疑有炼金术师在给牛头怪用药。收集 5 根牛头怪的脊骨调查。',
  goals: [{ type: 'collect', key: 'q_tau_spine', item: '牛头怪的脊骨', from: Q_TAUS, dungeon: ['graca', 'blazing_graca'], rate: 0.45, n: 5, desc: '异常粗壮的脊骨，骨缝里有炼金药剂的痕迹。' }],
  talk: { offer: ['格拉卡的牛头怪，骨骼粗得不正常。', '我怀疑，有炼金术师在偷偷给它们用药。带 5 根牛头怪的脊骨回来，我要化验一下。'], done: ['……果然，有炼金药剂的残留。', '谢谢你。这件护甲是我的一点心意。'] },
  reward: QR(12, 0.35, 3000, { items: [QE('top', 13, 2)] }) });

defineQuest('s_sharan_cat', { name: '魔法研究 - 猫妖篇', npc: 'sharan', lvl: 8,
  desc: '莎兰在研究荧光猫妖的治愈魔法：击败 8 只荧光猫妖。',
  goals: [{ type: 'kill', kind: 'catGlow', n: 8 }],
  talk: { offer: ['荧光猫妖会为同伴治疗——这是一种很原始、却很有效的治愈魔法。', '替我观察它们施法的瞬间，然后击败 8 只。治疗的时候它们会站着不动，优先打它们。'], done: ['嗯……施法的节奏和我想的一样。你的观察很有帮助。'] },
  reward: QR(8, 0.35, 1200, { items: [QI('mpM', 5)] }) });

defineQuest('s_alice_song', { name: '冰与火的歌谣', npc: ['alice', 'sharan'], lvl: 13,   // 自创
  desc: '吟游诗人艾丽丝想为克拉赫与彼诺修姐妹写一首歌。先去听听莎兰讲她们的故事，再亲眼去看看冰与火的森林。',
  goals: [
    { type: 'talk', npc: 'sharan', lines: ['克拉赫和彼诺修？……她们是我的同门师妹。', '一个喜欢冬天，一个喜欢夏天，从小吵到大，却谁也离不开谁。', '师父说格兰之森太危险，她们偏要去……告诉艾丽丝，歌里别把她们写成坏人。'] },
    { type: 'clear', dungeon: 'frozen_woods' }, { type: 'clear', dungeon: 'blazing_graca' }],
  talk: { offer: ['♪ 冰之森林，火之营地，两位少女迷失在流动的森林里——', '我想为那对魔法师姐妹写一首歌，可是我对她们一无所知。', '听说魔法师公会的莎兰认识她们。你能先替我去问问，再亲眼去看看冰与火的森林吗？'], done: ['……原来是这样的故事。', '♪ 冬天的妹妹，夏天的姐姐，终于在歌里重逢——谢谢你，这首歌会传遍阿拉德的。'] },
  reward: QR(13, 0.45, 3000, { title: '歌谣中的冒险家', titleKey: 'title_ballad' }) });

defineQuest('s_kanina_armor', { name: '合身的防具', npc: ['kanina', 'linus'], lvl: 6,   // 自创
  desc: '防具商人卡妮娜说，冒险家要穿合身的防具：穿戴 Lv.5 以上的上衣。',
  goals: [{ type: 'equip', slot: 'top', lvl: 5 }],
  talk: { offer: ['你身上这件……该换了吧？', '冒险家的命，一半在武器上，一半在防具上。去换一件 Lv.5 以上的上衣再来给我看看。'], done: ['这才像样嘛。这些晶块拿去强化防具用。'] },
  reward: QR(6, 0.25, 800, { items: [QI('crystal', 15)] }) });
