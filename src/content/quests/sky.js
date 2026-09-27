/* =====================================================================
   天空之城篇（Lv.14~23，接格兰之森主线「前往天空之城」）
   - 任务名按官方 2009 年 ACT2 版天空之城主线整理：精灵的魔法阵 → 调查力量减弱的魔法阵 → 行踪不明的罗莉安 → 水落石出 →
     人偶之王道格里 → 石巨人塔 → 黄金石巨人 → 研究石巨人 → 除掉普拉塔尼的方法 → 存在的宫殿 → 光之城主的宫殿 → 光之军队 →
     光之城主 - 赛格哈特 → 不灭的赛格哈特 → 光之城主的诞生 → 巴卡尔的遗言 → 盛载记忆的水晶球 → 向天帷巨兽进军
   - 隐藏地下城「悬空城」：未被修复的魔法阵 → 变强的天空之城气息 → 悬空城（q_hidden_floating，完成后门出现）→ 悬空城的第一个关口 → 最后关口
   - 地下城 / 怪物 id 由「地下城内容」组定义（content/world/sky_castle.js）；区域不存在时这些任务不会出现（cond）
   ===================================================================== */
const SKY = () => !!SCENES.sky_castle;
const SKY_DGS = ['dragon_tower', 'puppet_hall', 'golem_tower', 'dark_corridor', 'lord_palace', 'floating_castle'];
const SKY_MOBS = ['wyvern', 'wyvernBlue', 'dragonman', 'minius', 'puppeteer', 'puppeteerRock', 'puppeteerIce', 'golem', 'golemBronze', 'golemMaster', 'kargo', 'kargoGoggle', 'expeller', 'expellerAxe', 'hughes', 'knight'];
const CH5 = '第五章 · 天空之城', CHF = '隐藏地下城 · 悬空城';
const skyQuest = (id, def) => defineQuest(id, { cond: SKY, ...def });

/* ---------------- 主线 ---------------- */
skyQuest('q_c01', { type: 'main', chapter: CH5, name: '精灵的魔法阵', npc: 'seria', to: 'sharan', lvl: 14, pre: 'q_m21',
  desc: '带着魔法结晶去西海岸魔法师公会找莎兰，她在研究通往天空之城的精灵魔法阵。',
  talk: { offer: ['魔法结晶已经准备好了。', '西海岸魔法师公会的莎兰小姐，一直守着那座通往天空的魔法阵。去找她吧——我会在这里为你祈祷。'],
    done: ['魔法结晶？……赛丽亚那孩子，果然知道很多事。', '西海岸的这座魔法阵，就是通往天空之城的门。可它的力量，一直在一点点减弱……'] },
  reward: QR(14, 0.04, 400) });
skyQuest('q_c02', { type: 'main', chapter: CH5, name: '调查力量减弱的魔法阵', npc: 'sharan', lvl: 14, pre: 'q_c01',
  desc: '魔法阵力量减弱的原因恐怕在天空之城那边。先去第一座塔——龙人之塔看看。',
  goals: [{ type: 'clear', dungeon: 'dragon_tower' }],
  talk: { offer: ['魔法阵力量减弱的原因，恐怕在天空之城那边。', '第一座塔是龙人之塔——翼龙和龙人的巢穴。去看看那里发生了什么。', '天空之城的入口在西海岸的高处，Lv.14 以上才上得去。'],
    doing: ['龙人之塔，就在天空之城的最下层。'], done: ['龙人们变得很狂暴？……果然，城的深处有东西在吸取魔力。'] },
  reward: QR(14, 0.12, 800) });
skyQuest('q_c03', { type: 'main', chapter: CH5, name: '行踪不明的罗莉安', npc: 'sharan', to: ['lorian', 'roget'], lvl: 15, pre: 'q_c02',
  desc: '罗莉安去龙人之塔采集龙鳞后失踪了。打倒塔的主人鲁卡斯，把她带回来。',
  goals: [{ type: 'kill', kind: 'lucas', boss: true, dungeon: 'dragon_tower', text: '在龙人之塔击败领主 鲁卡斯' }],
  talk: { offer: ['还有一件事……罗莉安前几天说要去龙人之塔采集龙鳞，到现在还没回来。', '龙人之塔的主人鲁卡斯会制造分身，还会召唤龙之雕像。拜托了，把她带回来。'],
    doing: ['罗莉安……她一定还在塔里。'], done: ['呜呜……我还以为要在塔里过一辈子了！谢谢你～', '鲁卡斯那家伙守着的不是宝物，是一块和赛丽亚说的一模一样的灰色结晶！'] },
  reward: QR(15, 0.1, 900, { items: [QI('hpL', 3)] }) });
skyQuest('q_c04', { type: 'main', chapter: CH5, name: '水落石出', npc: ['lorian', 'roget'], to: 'sharan', lvl: 15, pre: 'q_c03',
  desc: '罗莉安在塔里看到的东西，要尽快告诉莎兰。',
  talk: { offer: ['快去告诉莎兰姐姐：天空之城的怪物们，都被那种灰色结晶控制着。', '而结晶的力量，好像都来自城最上层的“光之城主”。'],
    done: ['……光之城主，赛格哈特。', '原来如此。魔法阵的力量减弱、怪物发狂，全都是因为他。一切都水落石出了。'] },
  reward: QR(15, 0.04, 400) });
skyQuest('q_c05', { type: 'main', chapter: CH5, name: '人偶之王道格里', npc: 'sharan', lvl: 16, pre: 'q_c04',
  desc: '通往上层的路被人偶玄关挡住了。以冒险级以上的难度击败人偶之王道格里。',
  goals: [{ type: 'kill', kind: 'dogrey', boss: true, dungeon: 'puppet_hall', diff: 1, text: '在人偶玄关击败人偶之王 道格里（冒险级以上）' }],
  talk: { offer: ['通往城上层的路，被人偶玄关挡住了。', '那里的主人是人偶之王道格里。它用丝线操纵着成群的人偶——只有冒险级以上的难度，才能切断它真正的丝线。'],
    doing: ['冒险级以上。普通的难度，只能打断人偶的丝线，伤不到道格里本身。'], done: ['人偶的丝线断了。上层的路，开了。'] },
  reward: QR(16, 0.12, 1000) });
skyQuest('q_c06', { type: 'main', chapter: CH5, name: '石巨人塔', npc: 'sharan', lvl: 17, pre: 'q_c05',
  desc: '人偶玄关之后是石巨人塔。守护城的石巨人正在攻击所有闯入者。',
  goals: [{ type: 'clear', dungeon: 'golem_tower' }],
  talk: { offer: ['人偶玄关之后，是石巨人塔。', '那些石巨人本是守护天空之城的魔法造物，现在却在攻击所有闯入者。去弄清楚原因。'],
    doing: ['石巨人很硬，但动作很慢。'], done: ['石巨人的核心……被灰色结晶污染了。'] },
  reward: QR(17, 0.1, 900) });
skyQuest('q_c07', { type: 'main', chapter: CH5, name: '黄金石巨人', npc: 'sharan', to: ['norton', 'kiri'], lvl: 17, pre: 'q_c06',
  desc: '塔顶的黄金石巨人普拉塔尼几乎打不坏。去问问研究石巨人的诺顿。',
  talk: { offer: ['塔顶有一具黄金石巨人，普拉塔尼。它的身体几乎打不坏。', '赫顿玛尔的诺顿对石巨人很有研究，去问问他有没有办法。'],
    done: ['黄金石巨人？！那可是天空之城的古代兵器！', '想打倒它，得先弄明白石巨人是怎么动起来的。'] },
  reward: QR(17, 0.03, 300) });
skyQuest('q_c08', { type: 'main', chapter: CH5, name: '研究石巨人', npc: ['norton', 'kiri'], lvl: 17, pre: 'q_c07',
  desc: '诺顿需要 3 个青铜石巨人的心脏来研究石巨人的弱点。',
  goals: [{ type: 'collect', key: 'q_golem_heart', item: '青铜石巨人的心脏', from: 'golemBronze', dungeon: SKY_DGS, rate: 0.5, n: 3, desc: '还在微微转动的青铜齿轮心脏。' }],
  talk: { offer: ['给我弄 3 个青铜石巨人的心脏来。', '拆开看看，就知道它们是靠什么动起来的了。'],
    doing: ['青铜石巨人，石巨人塔里就有。'], done: ['原来如此……心脏里的齿轮一旦停转，整个身体就会僵住！'] },
  reward: QR(17, 0.1, 900) });
skyQuest('q_c09', { type: 'main', chapter: CH5, name: '除掉普拉塔尼的方法', npc: ['norton', 'kiri'], lvl: 18, pre: 'q_c08',
  desc: '普拉塔尼的弱点在胸口的心脏。以冒险级以上的难度击败黄金巨人普拉塔尼。',
  goals: [{ type: 'kill', kind: 'platani', boss: true, dungeon: 'golem_tower', diff: 1, text: '在石巨人塔击败黄金巨人 普拉塔尼（冒险级以上）' }],
  talk: { offer: ['普拉塔尼的弱点，就在胸口的心脏。', '它蓄力的时候心脏会发光——趁那个时候狠狠地打！冒险级以上的难度，它才会露出真正的核心。'],
    doing: ['看准心脏发光的时候！'], done: ['黄金石巨人倒下了！哈哈，这可是天空之城的大新闻！', '这是我珍藏的好东西，拿去用吧。'] },
  reward: QR(18, 0.12, 1200, { items: [QE('rand', 18, 2)] }) });
skyQuest('q_c10', { type: 'main', chapter: CH5, name: '存在的宫殿', npc: ['norton', 'kiri'], to: 'kiri', lvl: 19, pre: 'q_c09',
  desc: '普拉塔尼身上刻着宫殿的地图。去问问来自天界的凯丽。',
  talk: { offer: ['普拉塔尼身上刻着一张地图……', '天空之城的最上层，真的有一座宫殿。这种事，还是去问从天界来的凯丽吧。'],
    done: ['宫殿？……那是光之城主赛格哈特的宫殿。', '在天界，我们都叫他“叛徒”。'] },
  reward: QR(19, 0.03, 300) });
skyQuest('q_c11', { type: 'main', chapter: CH5, name: '光之城主的宫殿', npc: 'kiri', lvl: 19, pre: 'q_c10',
  desc: '通往宫殿的路是黑暗玄廊。先打通黑暗玄廊。',
  goals: [{ type: 'clear', dungeon: 'dark_corridor' }],
  talk: { offer: ['通往宫殿的路是黑暗玄廊。那里连光都照不进去——卡格们戴着夜视镜，在黑暗里看得一清二楚。', '先打通黑暗玄廊吧！'],
    doing: ['黑漆漆的，小心脚下~'], done: ['了不起！黑暗玄廊的尽头，就是宫殿的大门了~'] },
  reward: QR(19, 0.12, 1200) });
skyQuest('q_c12', { type: 'main', chapter: CH5, name: '光之军队', npc: 'kiri', lvl: 20, pre: 'q_c11',
  desc: '宫殿门口驻守着赛格哈特的光之军队。消灭驱逐者和斧之驱逐者，再打倒它们的首领天之驱逐者。',
  goals: [{ type: 'kill', kind: 'expeller', n: 10 }, { type: 'kill', kind: 'expellerAxe', n: 5 }, { type: 'kill', kind: 'skyExpeller', boss: true, text: '在黑暗玄廊击败 天之驱逐者' }],
  talk: { offer: ['宫殿门口驻守着赛格哈特的“光之军队”——驱逐者。', '消灭 10 名驱逐者、5 名斧之驱逐者，再打倒它们的首领天之驱逐者！'],
    doing: ['驱逐者们的阵型很严密，从背后打它们！'], done: ['光之军队溃散了！接下来……就是赛格哈特本人了。'] },
  reward: QR(20, 0.12, 1500) });
skyQuest('q_c13', { type: 'main', chapter: CH5, name: '光之城主 - 赛格哈特', npc: 'kiri', lvl: 20, pre: 'q_c12',
  desc: '光之城主赛格哈特背叛了天界，用灰色结晶的力量控制了整座天空之城。去城主宫殿打倒他。',
  goals: [{ type: 'kill', kind: 'seghart', boss: true, dungeon: 'lord_palace', text: '在城主宫殿击败光之城主 赛格哈特' }],
  talk: { offer: ['光之城主赛格哈特，曾经是天界最强的剑士。', '他背叛了天界，用灰色结晶的力量控制了整座天空之城。', '他的光剑很快，但每一招之后都有空隙——去吧，结束这一切！'],
    doing: ['赛格哈特的光剑……千万别硬接。'], done: ['……赛格哈特倒下了。', '可是，他的光……没有消失。'] },
  reward: QR(20, 0.15, 2000, { items: [QE('weapon', 21, 2)] }) });
skyQuest('q_c14', { type: 'main', chapter: CH5, name: '不灭的赛格哈特', npc: 'kiri', to: 'seria', lvl: 21, pre: 'q_c13',
  desc: '赛格哈特化成光又在王座上重新凝聚。也许赛丽亚会知道原因。',
  talk: { offer: ['赛格哈特的身体化成了光，又在王座上重新凝聚……他是不灭的。', '也许，那个什么都知道的女孩会有办法。'],
    done: ['……他不是不灭的。他只是被“某个人”的力量束缚在了那里。', '那个人的名字……巴卡尔。'] },
  reward: QR(21, 0.03, 300) });
skyQuest('q_c15', { type: 'main', chapter: CH5, name: '光之城主的诞生', npc: 'seria', to: ['kakun', 'roget'], lvl: 21, pre: 'q_c14',
  desc: '巴卡尔是很久以前统治天空的黑龙。去问问知道古老传说的暗精灵卡坤。',
  talk: { offer: ['巴卡尔……是很久以前统治天空的龙。', '暗精灵的卡坤先生知道很多古老的传说，去问问他吧。'],
    done: ['巴、巴卡尔？！……那可是传说中的黑龙！', '暗精灵的古书里写着：赛格哈特是巴卡尔亲手造出来的城主。'] },
  reward: QR(21, 0.03, 300) });
skyQuest('q_c16', { type: 'main', chapter: CH5, name: '巴卡尔的遗言', npc: ['kakun', 'roget'], lvl: 22, pre: 'q_c15',
  desc: '巴卡尔的遗言说，城主的心封在水晶之中。再次打倒赛格哈特，夺走他的水晶球。',
  goals: [{ type: 'collect', key: 'q_crystal_ball', item: '赛格哈特的水晶球', from: 'seghart', boss: true, dungeon: 'lord_palace', rate: 1, rar: 3, desc: '球里有无数人的记忆在缓缓转动。' }],
  talk: { offer: ['古书的最后一页，是巴卡尔的遗言：“我的城主永不倒下，因为他的心在水晶之中。”', '只要夺走赛格哈特的水晶球，他就再也不能复活了！'],
    doing: ['水晶球……一定在赛格哈特身上。'], done: ['就、就是这个！里面……好像有很多人的记忆在转动。'] },
  reward: QR(22, 0.12, 1500) });
skyQuest('q_c17', { type: 'main', chapter: CH5, name: '盛载记忆的水晶球', npc: ['kakun', 'roget'], to: 'sharan', lvl: 22, pre: 'q_c16',
  desc: '水晶球里的魔法，卡坤看不懂。拿去给莎兰看看。',
  talk: { offer: ['这种魔法我看不懂……拿去给莎兰看看吧。'],
    done: ['……这是被赛格哈特夺走的，天空之城居民的记忆。', '把它们还给天空吧。城主，终于可以安息了。'] },
  reward: QR(22, 0.03, 300) });
skyQuest('q_c18', { type: 'main', chapter: CH5, name: '向天帷巨兽进军', npc: 'sharan', lvl: 23, pre: 'q_c17',
  desc: '天空的更远处还有更大的威胁。以冒险级以上、A 以上的评价通关城主宫殿，证明你已经准备好了。',
  goals: [{ type: 'clear', dungeon: 'lord_palace', diff: 1, rank: 'A' }],
  talk: { offer: ['天空之城恢复了平静……但魔法阵告诉我，天空的更远处，还有东西在移动。', '在那之前，证明你已经准备好了：以冒险级以上、A 以上的评价通关城主宫殿。'],
    doing: ['还不够。那样的力量，是撑不过接下来的战斗的。'],
    done: ['……天空的更远处，有一头遮天蔽日的巨兽——天帷巨兽。', '那是下一段冒险了。{name}，谢谢你。', '——天空之城篇 · 完——'] },
  reward: QR(23, 0.2, 3000, { title: '天空之城的解放者', titleKey: 'title_skycastle', coins: 2 }) });

/* ---------------- 隐藏地下城：悬空城 ---------------- */
skyQuest('q_fl1', { type: 'hidden', story: true, chapter: CHF, name: '未被修复的魔法阵', npc: 'sharan', lvl: 20, pre: 'q_c11',
  desc: '天空之城还有一座没被修复的魔法阵。在天空之城各地下城收集尖晶石、萤石和锆石各 5 个。',
  goals: [
    { type: 'collect', key: 'q_spinel', item: '尖晶石', from: SKY_MOBS, dungeon: SKY_DGS, rate: 0.3, n: 5, desc: '天空之城建筑里的红色魔力石。' },
    { type: 'collect', key: 'q_fluorite', item: '萤石', from: SKY_MOBS, dungeon: SKY_DGS, rate: 0.3, n: 5, desc: '天空之城建筑里的彩色魔力石。' },
    { type: 'collect', key: 'q_zircon', item: '锆石', from: SKY_MOBS, dungeon: SKY_DGS, rate: 0.3, n: 5, desc: '天空之城建筑里的透明魔力石。' }],
  talk: { offer: ['天空之城里，还有一座没被修复的魔法阵。', '修复它需要三种魔力石：尖晶石、萤石和锆石，各 5 个。天空之城的怪物们身上常常带着。'],
    doing: ['三种魔力石，一种都不能少。'], done: ['魔法阵……修好了。可是，它指向的地方，不在任何地图上。'] },
  reward: QR(20, 0.06, 3000) });
skyQuest('q_fl2', { type: 'hidden', story: true, chapter: CHF, name: '变强的天空之城气息', npc: 'sharan', to: 'kiri', lvl: 21, pre: 'q_fl1',
  desc: '修好的魔法阵指向一个不在地图上的地方。去问问凯丽。',
  talk: { offer: ['修好的魔法阵，指向天空之城的更高处。那里的气息，比城主宫殿还要强。', '凯丽也许知道些什么。'],
    done: ['不在地图上的地方？……难道是悬空城？！', '那是连天界都不敢靠近的地方。'] },
  reward: QR(21, 0.03, 300) });
skyQuest('q_hidden_floating', { type: 'hidden', story: true, chapter: CHF, name: '悬空城', npc: 'kiri', lvl: 21, pre: ['q_fl2', 'q_c11'],
  desc: '想进悬空城，得先证明实力：以冒险级以上的难度通关黑暗玄廊。完成后悬空城的门就会出现。',
  goals: [{ type: 'clear', dungeon: 'dark_corridor', diff: 1 }],
  talk: { offer: ['悬空城……传说是赛格哈特真正的王座。', '去那里太危险了！除非你能在冒险级以上的难度通关黑暗玄廊，不然我可不告诉你入口在哪~'],
    doing: ['冒险级以上的黑暗玄廊！说好了哦~'], done: ['……好吧，我服了你。', '悬空城的入口，就在天空之城的最高处。门已经为你打开了。'] },
  reward: { exp: qexp(21, 0.08), gold: 1500, unlock: 'floating_castle' } });
skyQuest('q_fl3', { type: 'hidden', chapter: CHF, name: '悬空城的第一个关口', npc: 'kiri', lvl: 21, pre: 'q_hidden_floating',
  desc: '悬空城的守卫佩戴着龙纹装饰品。收集 10 个，证明你已经突破了第一个关口。',
  goals: [{ type: 'collect', key: 'q_dragon_ornament', item: '龙纹装饰品', from: ['knight', 'expeller', 'expellerAxe'], dungeon: 'floating_castle', rate: 0.5, n: 10, desc: '悬空城守卫的徽饰，刻着盘绕的龙纹。' }],
  talk: { offer: ['悬空城的守卫都佩戴着龙纹装饰品——那是赛格哈特亲卫的标志。', '带 10 个回来，证明你已经突破了第一个关口！'],
    doing: ['侍剑骑兵的剑很快，小心~'], done: ['第一个关口，突破！'] },
  reward: QR(21, 0.08, 1500) });
skyQuest('q_fl4', { type: 'hidden', chapter: CHF, name: '最后关口', npc: 'kiri', lvl: 22, pre: 'q_fl3',
  desc: '悬空城的最深处，是注视着一切的罪恶之眼。打倒它。',
  goals: [{ type: 'kill', kind: 'sinEye', boss: true, dungeon: 'floating_castle', text: '在悬空城击败 罪恶之眼' }],
  talk: { offer: ['悬空城的最深处，有一只注视着一切的眼睛——罪恶之眼。', '赛格哈特的力量，就是从它那里来的。这是最后的关口了！'],
    doing: ['罪恶之眼……别被它盯上太久。'], done: ['罪恶之眼闭上了……天空之城的天空，终于放晴了！', '这个手镯是天界的宝物，现在它属于你了。'] },
  reward: QR(22, 0.15, 2500, { items: [QE('bracelet', 22, 2)] }) });

/* ---------------- 支线 ---------------- */
skyQuest('s_daphne_feather', { name: '翼龙的羽毛', npc: ['daphne', 'roget'], lvl: 14,   // 自创
  desc: '首饰商人达芙妮想用翼龙的羽毛做新的发饰。',
  goals: [{ type: 'collect', key: 'q_wyvern_feather', item: '翼龙的羽毛', from: ['wyvern', 'wyvernBlue'], rate: 0.4, n: 6, desc: '泛着青色光泽的长羽毛。' }],
  talk: { offer: ['天空之城的翼龙，羽毛可漂亮了。', '帮我带 6 根回来吧，做成发饰一定很受欢迎～'], done: ['好漂亮的颜色！这个戒指送你，当作谢礼～'] },
  reward: QR(14, 0.05, 800, { items: [QE('ring', 15, 1)] }) });
skyQuest('s_sinda_charcoal', { name: '木炭', npc: ['sinda', 'linus'], lvl: 15,
  desc: '辛达的炉子需要火力更旺的精炼炭。天空之城的翼龙会把木炭叼回巢里。',
  goals: [{ type: 'collect', key: 'q_charcoal', item: '精炼炭', from: ['wyvern', 'wyvernBlue'], rate: 0.4, n: 8, desc: '烧得发亮的黑炭，火力比普通木炭旺得多。' }],
  talk: { offer: ['我的炉子火力不够，打不出好东西！', '听说天空之城的翼龙会把精炼炭叼回巢里——帮我抢 8 块回来！'], done: ['好炭！这火一上来，打什么都顺手！'] },
  reward: QR(15, 0.05, 1000, { items: [QI('crystal', 20)] }) });
skyQuest('s_kakun_water', { name: '痛苦的爱情与创作', npc: ['kakun', 'roget'], lvl: 16, pre: 's_kk4',
  desc: '被赛丽亚婉拒后，卡坤决定把心情写成诗。他需要寒冰人偶师沙杜身上的冰冷的净化水来让自己冷静下来。',
  goals: [{ type: 'collect', key: 'q_pure_water', item: '冰冷的净化水', from: 'puppeteerIce', dungeon: 'puppet_hall', rate: 1, n: 3, desc: '冰得刺骨的净化水，据说能让发热的脑袋冷静下来。' }],
  talk: { offer: ['我、我没事……真的没事。', '我决定把这份心情写成诗！可是一提笔脑袋就发热……', '人偶玄关的寒冰人偶师沙杜身上有“冰冷的净化水”，喝一口就能冷静下来。它很少出现……拜托了。'],
    doing: ['沙杜很少露面……要多去几次人偶玄关才行。'], done: ['……好冰。脑袋清醒多了。', '诗写好了，题目叫《流动的森林与天空》。谢谢你，朋友。'] },
  reward: QR(16, 0.05, 1000) });
skyQuest('s_sosia_drake', { name: '新菜单 - 德雷克香槟', npc: ['sosia', 'grandis'], lvl: 16,
  desc: '索西雅想推出新饮品“德雷克香槟”，需要幼龙心脏做药引。',
  goals: [{ type: 'collect', key: 'q_drake_heart', item: '幼龙心脏', from: ['wyvern', 'wyvernBlue', 'dragonman'], rate: 0.3, n: 3, desc: '还带着余温的小小心脏，是德雷克香槟的秘方。' }],
  talk: { offer: ['我要推出新饮品啦！名字都想好了——“德雷克香槟”！', '秘方是幼龙心脏……咳，你别用那种眼神看我，喝了真的能恢复体力！'], done: ['新菜单完成！第一杯请你喝～'] },
  reward: QR(16, 0.05, 1000, { items: [QI('hpL', 5)] }) });
skyQuest('s_sherlock_loan', { name: '高利贷', npc: ['sherlock', 'fengzhen'], lvl: 17,
  desc: '人偶玄关的人偶师们欠了夏洛克一大笔钱，却想赖账。',
  goals: [{ type: 'collect', key: 'q_money_bag', item: '钱袋', from: ['puppeteer', 'puppeteerRock'], rate: 0.4, n: 5, desc: '鼓鼓囊囊的钱袋，里面是人偶师们欠的债。' }],
  talk: { offer: ['那些人偶师！从我这儿借了钱，转头就躲进了人偶玄关！', '帮我把 5 个钱袋讨回来，分你一成！'], done: ['嘿嘿，一分不少！说好的，这是你的一成！'] },
  reward: QR(17, 0.05, 1500) });
skyQuest('s_gsd_eyes', { name: '能让眼睛复明的药', npc: 'gsd', lvl: 18,
  desc: '诺顿说，龙人之塔的眼草能做成让眼睛复明的药。G.S.D 却只是笑了笑。',
  goals: [{ type: 'collect', key: 'q_eye_herb', item: '眼草', from: ['dragonman', 'minius', 'wyvern'], dungeon: 'dragon_tower', rate: 0.35, n: 5, desc: '花心像眼睛一样的草药，据说能治眼疾。' }],
  talk: { offer: ['诺顿那家伙说，龙人之塔的眼草能治好我的眼睛。', '……也罢，去带 5 株回来吧。就当是你的修行。'],
    done: ['……谢谢你。不过，这些药还是给更需要的人吧。', '我早就不需要眼睛了。心眼看到的东西，比眼睛更多。'] },
  reward: QR(18, 0.05, 1200, { sp: 5 }) });
skyQuest('s_norton_golem', { name: '石巨人的秘密', npc: ['norton', 'kiri'], lvl: 19,
  desc: '诺顿想弄清楚石巨人为什么会被灰色结晶控制。',
  goals: [{ type: 'collect', key: 'q_golem_shard', item: '石巨人的碎片', from: ['golem', 'golemBronze', 'golemMaster'], rate: 0.4, n: 6, desc: '刻着符文的石块，符文还在微微发光。' }],
  talk: { offer: ['石巨人的秘密，一定藏在它们身上的符文里。', '带 6 块石巨人的碎片来，我要把符文拓下来研究。'], done: ['嗯……符文被改写过。有人故意让它们发疯。'] },
  reward: QR(19, 0.05, 1200, { items: [QI('crystal', 30)] }) });
skyQuest('s_boken_danger', { name: '危险的任务', npc: ['boken', 'skadi'], lvl: 19,
  desc: '公会怀疑有一个神秘组织在黑暗玄廊里活动。从卡格身上找到他们的印章。',
  goals: [{ type: 'collect', key: 'q_org_seal', item: '组织的印章', from: ['kargo', 'kargoGoggle'], dungeon: 'dark_corridor', rate: 0.4, n: 5, desc: '刻着陌生徽记的铁印章。' }],
  talk: { offer: ['这件事别声张。', '公会怀疑有个神秘组织在黑暗玄廊里活动，那些卡格身上带着他们的印章。带 5 个回来。'], done: ['……果然是他们。这件事到此为止，谢谢你。'] },
  reward: QR(19, 0.05, 1500, { coins: 1 }) });
skyQuest('s_linus_friend', { name: '祭奠好友', npc: 'linus', lvl: 20,
  desc: '林纳斯想起了一位故友。去听听 G.S.D 讲那个人的故事。',
  goals: [{ type: 'talk', npc: 'gsd', lines: ['……林纳斯让你来的？', '他年轻时有个一起练剑的好友，也是鬼剑士。那孩子最后没能驾驭住左臂里的鬼神……', '是林纳斯亲手结束了他的痛苦。从那以后，林纳斯就放下了剑，拿起了铁锤。', '告诉他：那孩子不会怪他的。'] }],
  talk: { offer: ['……今天是个老朋友的忌日。', '那家伙的事，G.S.D 比我记得清楚。你去听听吧——我自己，说不出口。'],
    doing: ['去吧，G.S.D 在旧城区。'], done: ['……是吗，他这么说啊。', '谢谢你。这把剑是那家伙的，一直放在我这里。现在，交给你了。'] },
  reward: QR(20, 0.05, 1000, { items: [QE('weapon', 20, 2)] }) });
skyQuest('s_gsd_sky', { name: '不寻常的天空之城气息', npc: 'gsd', lvl: 21, pre: 's_gsd_eyes',
  desc: 'G.S.D 的鬼手对天空之城的气息起了反应。收集 10 个耀眼的龙人之眼。',
  goals: [{ type: 'collect', key: 'q_dragon_eye', item: '耀眼的龙人之眼', from: 'dragonman', rate: 0.4, n: 10, desc: '金色的竖瞳，像是还在注视着什么。' }],
  talk: { offer: ['……我的鬼手在发烫。天空之城的气息，不寻常。', '龙人的眼睛能看见魔力的流动。带 10 个耀眼的龙人之眼来，让我“看”个清楚。'], done: ['……原来如此。那股气息的尽头，是一条龙。'] },
  reward: QR(21, 0.05, 1500) });
skyQuest('s_norton_zerog', { name: '悬空城的无重力碎片', npc: ['norton', 'kiri'], lvl: 22, pre: 'q_hidden_floating',
  desc: '悬空城之所以能浮在空中，靠的是一种无重力碎片。诺顿想要几块研究。',
  goals: [{ type: 'collect', key: 'q_zero_g_shard', item: '无重力碎片', from: ['knight', 'expeller', 'expellerAxe', 'kargo', 'golemBronze'], dungeon: 'floating_castle', rate: 0.4, n: 5, desc: '会自己浮起来的紫色晶体。' }],
  talk: { offer: ['会飞的城堡！你知道这对商人意味着什么吗？', '悬空城靠一种“无重力碎片”浮在空中。带 5 块回来，我要发大财了！'], done: ['浮、浮起来了！哈哈哈，这下能造会飞的商船了！'] },
  reward: QR(22, 0.05, 2000, { items: [QI('guard', 1)] }) });
