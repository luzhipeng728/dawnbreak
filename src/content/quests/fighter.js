/* =====================================================================
   格斗家（男）的转职 / 觉醒任务线（B8，docs/CLASS_PLAN_FIGHTER.md §2.5、docs/SKILLS_OFFICIAL_fighter.md §8；写法照 witch.js / gun_spitfire.js）
   导师：风振（fengzhen，赫顿玛尔中央广场）。入门「风拳流大师风振」、七次修炼（风拳流 第一式~第六式 → 出师之战）、转职、觉醒台词在 quests/job.js 的 JOB_CHAINS.fighter / AWAKEN_MORE.fighter。
   这里放两样：
   1. 四个转职各自的转职任务线（官方经典男格斗版，官方 18 级 → 本作 15 级），登记成 CLASSES.fighter.jobs.<id>.quests / trial。
      这个文件比 quests/job.js 的统一登记晚加载，所以在这里自己 defineQuest（cond 和 job.js 一样：在转职窗口接了这个方向才出现）。转职文件（fighter_nen.js 等）不要再写 quests / trial。
   2. 一觉的转职剧情（官方经典 48 级男版 → 本作 21 级）：夹在通用的两步中间 —— q_awaken_fighter_1（暗黑雷鸣废墟 ×3）→ 本转职两步 → q_awaken_fighter_2（烈焰格拉卡 + 无色小晶块，解锁觉醒）；
      q_awaken_fighter_2 加 cond：本转职的剧情做完才出现。二觉（26）/ 三觉（30）走通用模板。
   没开放时不生效：任务全是 cls: 'fighter'，只有格斗家角色（CLASSES.fighter.ready 或开发测试 ?fighter=1）才看得见；转职方向没开放（J.ready:false）时转职窗口里接不到。
   官方 → 本作：王的遗迹 → 城主宫殿；比尔马克帝国试验场 → 黑暗玄廊 / 石巨人塔；加尔·伊莱丝（本作没有）→ 诺顿；决斗胜点、单人通关（任务引擎没有这两种条件）→ 城主宫殿的牌 / 不用复活币。
   - 气功师：风振 → 莎兰「火热的念心脏」→ 烈焰格拉卡 ×2 → 念心脏交给风振；       一觉 狂虎帝：城主宫殿 ×2 → 莎兰「泪之颜料」（白色小晶块 + 下级元素结晶）
   - 散打：  格拉卡 B 评价 → 7 分钟内通关烈焰格拉卡 → 不用复活币通关暗黑雷鸣废墟；   一觉 武极：城主宫殿「露珠」+ 黑暗玄廊「月下美人」→ 莎兰「黎明颜料」（红色小晶块 + 下级元素结晶）
   - 街霸：  风振 → 诺顿「高浓缩的免毒药剂」→ 黑色小晶块 → 药剂交给风振 → 暗黑雷鸣废墟；   一觉 千手罗汉：诺顿 → 城主宫殿 + 黑暗玄廊的考验 + 黑色小晶块
   - 柔道家：风振 → 诺顿「椎骨肌肉强化剂」→ 牛头怪的硬角 + 蓝色小晶块 → 强化剂交给风振 → 暗黑雷鸣废墟；   一觉 风林火山：博肯的四张牌（人类 / 亡者 / 无魂 / 海恕）
   小晶块按本作经济减量（同弹药专家：官方 60 个，卡坤店里 120 金一个）。暗黑雷鸣废墟是隐藏地下城：进入它之前的那一步任务奖励会直接开放这扇门。
   道具图标全部复用 art/final/icon 里现有的任务道具图（不新画）。
   ===================================================================== */
const FIGHTER_JOB_LINES = {
  nenmaster: [
    ['q_job_nenmaster_1', { name: '气功师 - 火热的念心脏', npc: 'fengzhen', to: 'sharan',
      desc: '风振说，想用念气战斗，先得有一颗承受得住念的心脏。去西海岸的魔法师公会，向莎兰打听「火热的念心脏」。',
      talk: { offer: ['气功师……你想以念御敌？', '念气不是蛮力。拳头打不到的地方，念可以到；可念烧起来的时候，最先烧到的是你自己。', '西海岸魔法师公会的莎兰，懂得怎么炼一颗「火热的念心脏」。去问问她——就说是风振让你去的。'],
        done: ['风振的徒弟？……难怪，你身上的气乱得像一团火。', '「火热的念心脏」可不是买得到的东西。它得在真正的火焰里，用你自己的念去炼。'] },
      reward: QR(15, 0.03, 300) }],
    ['q_job_nenmaster_2', { name: '气功师 - 炼念', npc: 'sharan',
      desc: '在烈焰格拉卡的火焰里炼念：通关烈焰格拉卡 2 次，从烈焰 彼诺修身上带回「火热的念心脏」。',
      goals: [{ type: 'clear', dungeon: 'blazing_graca', n: 2 },
        { type: 'collect', key: 'q_fn_heart', item: '火热的念心脏', icon: 'q_drake_heart', from: 'flameMage', dungeon: 'blazing_graca', rate: 1, desc: '在烈焰里炼成的念之心脏，握在手里还在一下一下地跳。' }],
      talk: { offer: ['烈焰格拉卡的火，是彼诺修用魔力点起来的——正好拿来炼念。', '进去，打穿它两次。第一次，让你的念习惯火；第二次，让火习惯你的念。', '彼诺修倒下的时候，火焰会凝成一颗心脏的形状。把它带回来。'],
        doing: ['念要稳。火再大，也别让它烧进你心里去。'],
        done: ['……跳得很有力。它已经认你做主人了。', '拿去给风振吧。剩下的，是他教你的事。'] },
      reward: QR(15, 0.08, 900, { items: [QI('mpM', 3)] }) }],
    ['q_job_nenmaster_3', { name: '气功师 - 念的心脏', npc: 'sharan', to: 'fengzhen',
      desc: '把「火热的念心脏」交给风振。',
      talk: { offer: ['去吧，风振在等你。', '……对了，念气珠要是绕着你乱转，别慌。那是它们在认路。'],
        done: ['……念心脏，你炼成了。', '从今往后，你的念会像它一样跳动：念气珠会自己绕着你转，念兽会替你咆哮。', '想好了，就在我这里转职吧。'] },
      reward: QR(15, 0.05, 600, { items: [QI('elixir', 1)] }) }],
  ],
  striker: [
    ['q_job_striker_1', { name: '散打 - 拳脚的节奏', npc: 'fengzhen',
      desc: '以 B 以上的评价通关格拉卡：连段要连得上，挨打要少，出手要快。',
      goals: [{ type: 'clear', dungeon: 'graca', rank: 'B' }],
      talk: { offer: ['散打？……不靠念，也不靠旁门左道，只信自己的拳脚。', '这条路最苦。我先看看你的底子——去格拉卡，打出 B 以上的评价。'],
        doing: ['评价看的是连击、速度和挨打的次数。一拳一脚都要打在实处。'],
        done: ['还算干净。', '可光是干净，还不够。'] },
      reward: QR(15, 0.05, 500) }],
    ['q_job_striker_2', { name: '散打 - 七分钟', npc: 'fengzhen',
      desc: '7 分钟内通关烈焰格拉卡。',
      goals: [{ type: 'clear', dungeon: 'blazing_graca', time: 420 }],
      talk: { offer: ['散打的拳，要快。', '烈焰格拉卡，七分钟之内打穿它。慢一秒都不算。'],
        doing: ['七分钟。别在小怪身上磨蹭，一路往前推。'],
        done: ['好快的拳。', '最后一关，我不会再给你任何退路。'] },
      reward: QR(15, 0.06, 700, { unlock: 'dark_thunder', items: [QI('hpM', 3)] }) }],
    ['q_job_striker_3', { name: '散打 - 一个人的战斗', npc: 'fengzhen',
      desc: '不使用复活币，通关暗黑雷鸣废墟。',
      goals: [{ type: 'clear', dungeon: 'dark_thunder', noCoin: true }],
      talk: { offer: ['暗黑雷鸣废墟。一个人进去，一个人走出来。', '不许用复活币。倒下了，就说明你的拳脚还不够硬。'],
        doing: ['不用复活币。……暗黑雷鸣废墟的门还没开的话，先去旧城区找辛达，她丢了一把锤子。'],
        done: ['……你是站着走出来的。', '散打的拳里没有花样，只有千锤百炼。想好了，就在我这里转职吧。'] },
      reward: QR(16, 0.08, 1000, { items: [QI('elixir', 1)] }) }],
  ],
  brawler: [
    ['q_job_brawler_1', { name: '街霸 - 高浓缩的免毒药剂', npc: 'fengzhen', to: 'norton',
      desc: '玩毒的人，得先保证毒不倒自己。去中央广场找商人诺顿，打听「高浓缩的免毒药剂」。',
      talk: { offer: ['街霸……哼，后街的打法。沙子、毒药、砖头，什么都往人脸上招呼。', '我不喜欢，可我不否认它管用。只是玩毒的人，得先保证毒不倒自己。', '诺顿有门路弄到「高浓缩的免毒药剂」。他就在广场那头，去问问吧。'],
        done: ['免毒药剂？嘘——小声点。', '这东西市面上可没有卖的。不过嘛……价钱好商量，好商量。'] },
      reward: QR(15, 0.03, 300) }],
    ['q_job_brawler_2', { name: '街霸 - 黑色的代价', npc: 'norton',
      desc: '诺顿要 20 个黑色小晶块来调配免毒药剂（卡坤的店里有卖，猛毒雷鸣废墟也能打到）。',
      goals: [{ type: 'item', key: 'c_black', n: 20 }],
      talk: { offer: ['药剂的原料里，最难弄的是暗之力——黑色小晶块。', '20 个。我不收金币，只收晶块。西海岸卡坤的店里有，猛毒雷鸣废墟也能捡到。'],
        doing: ['20 个黑色小晶块，一个都不能少。'],
        done: ['嗯……成色不错。', '药剂调好了。喝一口，一个星期之内什么毒都放不倒你。'] },
      reward: QR(15, 0.06, 800) }],
    ['q_job_brawler_3', { name: '街霸 - 以毒攻毒', npc: 'norton', to: 'fengzhen',
      desc: '把「高浓缩的免毒药剂」交给风振。',
      talk: { offer: ['拿去给风振看看吧。那人一本正经的，你可别说药是从我这儿弄的。', '……算了，说也无所谓。'],
        done: ['免毒药剂……诺顿那家伙，果然什么都弄得到。', '有了它，你就可以放心地玩毒了。最后一关，让我看看你在后街能不能活下来。'] },
      reward: QR(15, 0.03, 400, { unlock: 'dark_thunder' }) }],
    ['q_job_brawler_4', { name: '街霸 - 后街的规矩', npc: 'fengzhen',
      desc: '通关暗黑雷鸣废墟。',
      goals: [{ type: 'clear', dungeon: 'dark_thunder' }],
      talk: { offer: ['后街只有一条规矩：活下来的人说了算。', '暗黑雷鸣废墟里全是不怕毒的亡者。你能在那里活下来，才配得上「街霸」这两个字。'],
        doing: ['亡者不怕毒，可它们怕砖头。……门还没开的话，先去旧城区找辛达。'],
        done: ['……赢了就是赢了，我不问你用了什么手段。', '想好了，就在我这里转职吧。'] },
      reward: QR(16, 0.08, 1000, { items: [QI('elixir', 1)] }) }],
  ],
  grappler: [
    ['q_job_grappler_1', { name: '柔道家 - 椎骨肌肉强化剂', npc: 'fengzhen', to: 'norton',
      desc: '一抓定胜负，靠的是腰背的力气。去找诺顿打听「椎骨肌肉强化剂」。',
      talk: { offer: ['柔道家……抓住，摔出去，一招定胜负。', '可你想过没有？把比你重十倍的牛头怪举过头顶，最先断掉的是你自己的脊梁。', '诺顿那里有一种「椎骨肌肉强化剂」。去问问他。'],
        done: ['椎骨肌肉强化剂？嘿，你是风振的徒弟吧——上一个来问的，也是他的徒弟。', '配方我有，材料你得自己去弄。'] },
      reward: QR(15, 0.03, 300) }],
    ['q_job_grappler_2', { name: '柔道家 - 牛角与蓝晶', npc: 'norton',
      desc: '收集 8 个牛头怪的硬角（格拉卡的牛头怪身上），再带 10 个蓝色小晶块给诺顿。',
      goals: [{ type: 'collect', key: 'q_fg_horn', item: '牛头怪的硬角', icon: 'q_tau_horn', from: ['tauSoldier', 'tauVanguard', 'tauGuard', 'tauBeast', 'tauKing'], dungeon: 'graca', rate: 0.5, n: 8, desc: '格拉卡牛头怪的角，敲起来像铁一样响。' },
        { type: 'item', key: 'c_blue', n: 10 }],
      talk: { offer: ['第一样：牛头怪的硬角，8 个。格拉卡那群牛头怪的角，是整个格兰之森最硬的东西。', '第二样：蓝色小晶块，10 个。冰之力能让药性慢慢渗进骨头里，不然会烧坏你的筋。'],
        doing: ['8 个硬角，10 个蓝色小晶块。'],
        done: ['……好，都齐了。', '强化剂调好了。一天一口，别贪多。'] },
      reward: QR(15, 0.06, 800) }],
    ['q_job_grappler_3', { name: '柔道家 - 钢铁的脊梁', npc: 'norton', to: 'fengzhen',
      desc: '把「椎骨肌肉强化剂」交给风振。',
      talk: { offer: ['去给风振复命吧。下次再来，记得多买点东西。'],
        done: ['嗯……腰背的力气，确实不一样了。', '最后一关：抓住那些亡者，把它们一个一个摔回地底下去。'] },
      reward: QR(15, 0.03, 400, { unlock: 'dark_thunder' }) }],
    ['q_job_grappler_4', { name: '柔道家 - 一抓定胜负', npc: 'fengzhen',
      desc: '通关暗黑雷鸣废墟。',
      goals: [{ type: 'clear', dungeon: 'dark_thunder' }],
      talk: { offer: ['柔道家不需要太多招式。', '抓住它，摔出去——就这么简单，也就这么难。去暗黑雷鸣废墟，证明给我看。'],
        doing: ['抓不住的敌人，就用气劲逼它停下来。……门还没开的话，先去旧城区找辛达。'],
        done: ['好摔。', '从今往后，被你抓住的敌人就没有退路了。想好了，就在我这里转职吧。'] },
      reward: QR(16, 0.08, 1000, { items: [QI('elixir', 1)] }) }],
  ],
};
// 一觉的转职剧情（Lv.21，q_awaken_fighter_1 之后、q_awaken_fighter_2 之前）；最后一步都回到发起人那里交，交完再去风振处接「觉醒 - 破壁」
const FIGHTER_AWAKEN_LINES = {
  nenmaster: [
    ['q_awaken_nenmaster_1', { name: '狂虎帝 - 猛虎的念', npc: 'fengzhen', to: 'sharan',
      desc: '通关城主宫殿 2 次，把在光之城主面前磨出来的念带给莎兰。',
      goals: [{ type: 'clear', dungeon: 'lord_palace', n: 2 }],
      talk: { offer: ['你的念兽，现在还只是一只小猫。', '要让它变成真正的猛虎，得先让你的念见识真正的强者——天空之城的城主宫殿，光之城主赛格哈特。打败他两次。', '然后去找莎兰。她知道怎么把念的形状画下来。'],
        doing: ['城主宫殿，两次。'],
        done: ['……念里有猛兽的味道了。', '要把它的形状定下来，需要「泪之颜料」。'] },
      reward: QR(21, 0.06, 2000) }],
    ['q_awaken_nenmaster_2', { name: '狂虎帝 - 泪之颜料', npc: 'sharan',
      desc: '带 10 个白色小晶块和 2 个下级元素结晶给莎兰，调配「泪之颜料」。',
      goals: [{ type: 'item', key: 'c_white', n: 10 }, { type: 'item', key: 'm_elem', n: 2 }],
      talk: { offer: ['泪之颜料……暗精灵的祭司用它在额头上画念纹。', '光之力的白色小晶块 10 个，下级元素结晶 2 个。带来，我为你调。'],
        doing: ['白色小晶块 10 个，下级元素结晶 2 个。'],
        done: ['……调好了。你看，颜料里映出了一只老虎。', '拿去给风振吧。狂虎帝——这个名字，你配得上。'] },
      reward: QR(21, 0.08, 3000) }],
  ],
  striker: [
    ['q_awaken_striker_1', { name: '武极 - 露珠与月下美人', npc: 'fengzhen', to: 'sharan',
      desc: '在城主宫殿收集 2 滴「露珠」，在黑暗玄廊收集 2 朵「月下美人」，交给莎兰。',
      goals: [{ type: 'collect', key: 'q_fs_dew', item: '露珠', icon: 'q_pure_water', dungeon: 'lord_palace', rate: 0.35, n: 2, desc: '城主宫殿的清晨凝在石阶上的露珠，一碰就会滚落。' },
        { type: 'collect', key: 'q_fs_moon', item: '月下美人', icon: 'q_eye_herb', dungeon: 'dark_corridor', rate: 0.35, n: 2, desc: '只在见不到太阳的地方开放的花，一离开黑暗就会合上花瓣。' }],
      talk: { offer: ['你的拳脚已经练到头了——再往上，靠的不是力气。', '烈焰焚步：把念点在自己的双腿上，让每一脚都烧起来。这门功夫，要先画出「黎明颜料」的念纹。', '颜料的引子有两样：城主宫殿的「露珠」，黑暗玄廊的「月下美人」。各带两份去给莎兰。'],
        doing: ['露珠在城主宫殿，月下美人在黑暗玄廊——那种花只在见不到太阳的地方开。'],
        done: ['……露珠和月下美人，一个是清晨，一个是深夜。', '再添一把火，就能调出「黎明颜料」。'] },
      reward: QR(21, 0.06, 2000) }],
    ['q_awaken_striker_2', { name: '武极 - 黎明颜料', npc: 'sharan',
      desc: '带 10 个红色小晶块和 2 个下级元素结晶给莎兰，调配「黎明颜料」。',
      goals: [{ type: 'item', key: 'c_red', n: 10 }, { type: 'item', key: 'm_elem', n: 2 }],
      talk: { offer: ['火之力的红色小晶块 10 个，下级元素结晶 2 个。', '深夜和清晨之间，要靠火来接上——就像你的拳和脚。'],
        doing: ['红色小晶块 10 个，下级元素结晶 2 个。'],
        done: ['黎明颜料，调好了。颜色像刚升起来的太阳。', '拿去给风振吧。武极……只信拳脚的人走到最后，拳脚就是道。'] },
      reward: QR(21, 0.08, 3000) }],
  ],
  brawler: [
    ['q_awaken_brawler_1', { name: '千手罗汉 - 后街的传说', npc: 'fengzhen', to: 'norton',
      desc: '去找诺顿打听「千手罗汉」的传说。',
      talk: { offer: ['后街流传着一个说法：真正的街霸打起架来，像长了一千只手。', '我不懂那一套。可诺顿那家伙在后街混了半辈子，他一定知道。'],
        done: ['千手罗汉？……你还真敢问。', '那是后街的老传说了。想学的人，得先过两道考验，再交一份“学费”。'] },
      reward: QR(21, 0.04, 1000) }],
    ['q_awaken_brawler_2', { name: '千手罗汉 - 千只手的考验', npc: 'norton',
      desc: '通关城主宫殿和黑暗玄廊各 1 次，再带 10 个黑色小晶块给诺顿。',
      goals: [{ type: 'clear', dungeon: 'lord_palace' }, { type: 'clear', dungeon: 'dark_corridor' }, { type: 'item', key: 'c_black', n: 10 }],
      talk: { offer: ['第一道：城主宫殿。第二道：黑暗玄廊。都是天空之城最不讲道理的地方——正合你的胃口。', '学费嘛，10 个黑色小晶块。别这么看我，后街的规矩就是这样。'],
        doing: ['城主宫殿、黑暗玄廊，各一次；再加 10 个黑色小晶块。'],
        done: ['……哈哈，好！我年轻时要是有你这身手，也不至于在这儿卖东西。', '去告诉风振吧——后街出了一个千手罗汉。'] },
      reward: QR(21, 0.08, 3000) }],
  ],
  grappler: [
    ['q_awaken_grappler_1', { name: '风林火山 - 博肯的牌局', npc: 'fengzhen', to: 'boken',
      desc: '去市政街的冒险家公会拜访博肯。',
      talk: { offer: ['柔道家的觉醒，我教不了你。', '市政街冒险家公会的博肯，年轻时是赫顿玛尔最有名的柔道家。风林火山——这四个字，只有他能传给你。'],
        done: ['风振让你来的？……那小子，还记得我这个老头子。', '想学风林火山，先陪我凑一局牌吧。四张牌：人类、亡者、无魂、海恕。凑齐了，我就教你。'] },
      reward: QR(21, 0.04, 1000) }],
    ['q_awaken_grappler_2', { name: '风林火山 - 四张牌', npc: 'boken',
      desc: '集齐四张牌交给博肯：城主宫殿的「人类之牌」和「亡者之牌」（光之城主 赛格哈特），石巨人塔的「无魂之牌」（黄金巨人 普拉塔尼），再用 10 个蓝色小晶块换「海恕之牌」。',
      goals: [{ type: 'collect', key: 'q_fg_card_man', item: '人类之牌', icon: 'q_captain_mark', dungeon: 'lord_palace', rate: 0.25, desc: '城主宫殿的守卫身上带着的牌，背面刻着一个人影。' },
        { type: 'collect', key: 'q_fg_card_dead', item: '亡者之牌', icon: 'q_cursed_tooth', from: 'seghart', dungeon: 'lord_palace', rate: 1, desc: '从光之城主手里夺来的牌，摸上去冰凉刺骨。' },
        { type: 'collect', key: 'q_fg_card_soul', item: '无魂之牌', icon: 'q_golem_shard', from: 'platani', dungeon: 'golem_tower', rate: 1, desc: '黄金巨人体内的一块石牌。没有灵魂的东西，最难摔。' },
        { type: 'item', key: 'c_blue', n: 10, text: '用 10 个蓝色小晶块换「海恕之牌」' }],
      talk: { offer: ['人类之牌，在城主宫殿的守卫身上；亡者之牌，在光之城主赛格哈特手里。', '无魂之牌，在石巨人塔的黄金巨人那里。', '海恕之牌嘛……在我这儿。拿 10 个蓝色小晶块来换。'],
        doing: ['人类、亡者、无魂、海恕。四张牌，一张都不能少。'],
        done: ['……风、林、火、山。四张牌，齐了。', '抓住的时候静如林，摔出去的时候疾如风、侵掠如火，站稳了就不动如山。去吧，告诉风振，他的徒弟出师了。'] },
      reward: QR(21, 0.08, 3000) }],
  ],
};
for (const [jid, L] of Object.entries(FIGHTER_JOB_LINES)) {
  Object.assign(CLASSES.fighter.jobs[jid], { quests: L, trial: L[L.length - 1][0] });
  L.forEach(([id, d], i) => defineQuest(id, { type: 'job', cls: 'fighter', job: false, lvl: 15, pre: i ? L[i - 1][0] : 'q_job_fighter_final', ...d, cond: () => jobPickOf() === jid }));
}
for (const [jid, L] of Object.entries(FIGHTER_AWAKEN_LINES))
  L.forEach(([id, d], i) => defineQuest(id, { type: 'job', cls: 'fighter', job: true, lvl: 21, pre: i ? L[i - 1][0] : 'q_awaken_fighter_1', ...d, cond: () => game.job === jid }));
QUESTS.q_awaken_fighter_2.cond = () => { const L = FIGHTER_AWAKEN_LINES[game.job]; return !L || questDone(L[L.length - 1][0]); };
