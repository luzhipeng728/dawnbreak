/* =====================================================================
   天帷巨兽篇（Lv.24~30，接天空之城篇的「向天帷巨兽进军」）——地下城内容组编写，写法同 content/quests/sky.js
   - 主线按官方经典版（2009 年「天帷巨兽」主线）整理：向天帷巨兽进军（莎兰 → 奥菲利亚）→ 调查GBL神殿 → 请宽恕我 →
     预言家赫亚西斯的预言书（黄昏 / 暗 / 光，官方从稀有怪“传道师”身上拿，这里改成从领主身上拿）→ 巨型黑章鱼 → 长脚罗特斯 → 天帷巨兽的悲鸣（自创收尾）
   - 隐藏地下城「天帷禁地」：审判者马塞尔的日记 - 前篇 → 马塞尔留下的线索 → 血腥伊恩（q_hidden_forbidden，完成后门出现；
     官方要交上级硬化剂 / 砥石等材料，这里改成冒险级以上通关第二脊椎）→ 大陆的肚子 → 审判者马塞尔的日记 - 后篇
   - 任务道具共用现有的图标（icon 字段），不另外出图
   - 区域不存在时这些任务不会出现（cond）
   ===================================================================== */
const Q_BH = () => !!SCENES.behemoth;
const Q_BH_DGS = ['temple_outskirts', 'treant_jungle', 'purgatory', 'polar_day', 'second_spine', 'forbidden_land'];
const Q_BH_GBL = ['gblBeliever', 'gblPriest', 'gblShaman', 'gblBishop', 'gblRevPriest', 'gblRevShaman', 'gblRevBishop'];
const Q_BH_OCTO = ['octopus', 'octopusBlue', 'babyOcto', 'blackOctopus'];
const Q_CH6 = '第六章 · 天帷巨兽', Q_CHB = '隐藏地下城 · 天帷禁地';
const bhQuest = (id, def) => defineQuest(id, { cond: Q_BH, ...def });

/* ---------------- 主线 ---------------- */
bhQuest('q_b01', { type: 'main', chapter: Q_CH6, name: '向天帷巨兽进军', npc: 'sharan', to: 'ophelia', lvl: 24, pre: 'q_c18',
  desc: '天空的更远处，一头巨兽正在降下。去魔法师公会找 GBL 教唯一的幸存者奥菲利亚。',
  talk: { offer: ['天帷巨兽——每 300 年穿过天空之海降入下界的巨兽，它的背上有古代文明的遗迹。', 'GBL 教在那里建了神殿……可是教团出了事。唯一逃回来的教徒奥菲利亚，就在公会里。去找她谈谈吧。'],
    done: ['……你是莎兰会长说的那位冒险家？', '我是奥菲利亚，GBL 教的祭司。神殿里的大家……都变成了怪物。', '去天帷巨兽的船就在西海岸商贸区的码头，Lv.24 以上就能上船。'] },
  reward: QR(24, 0.04, 600) });
bhQuest('q_b02', { type: 'main', chapter: Q_CH6, name: '调查GBL神殿', npc: 'ophelia', lvl: 24, pre: 'q_b01',
  desc: '奥菲利亚想知道神殿现在怎么样了。通关天帷巨兽的「神殿外围」。',
  goals: [{ type: 'clear', dungeon: 'temple_outskirts' }],
  talk: { offer: ['那天晚上，神殿的钟一直在响……醒来的时候，信徒们的眼睛都变成了白色。', '请去神殿外围看看，现在那里变成了什么样子。'],
    doing: ['神殿外围就在码头旁边。'], done: ['信徒们还戴着面具在巡逻……他们已经认不出任何人了。'] },
  reward: QR(24, 0.12, 1500) });
bhQuest('q_b03', { type: 'main', chapter: Q_CH6, name: '请宽恕我', npc: 'ophelia', lvl: 25, pre: 'q_b02',
  desc: '大主教和大祭司也失去了心智。在神殿外围打倒 GBL教大主教和大祭司，让他们解脱。',
  goals: [{ type: 'kill', kind: 'gblHighPriest', dungeon: 'temple_outskirts', text: '在神殿外围打倒 GBL教大祭司' }, { type: 'kill', kind: 'gblArchbishop', boss: true, dungeon: 'temple_outskirts', text: '在神殿外围打倒 GBL教大主教' }],
  talk: { offer: ['大主教大人和大祭司大人……也没能逃过。', '大祭司大人会用圣光守护大主教大人。请先打倒她，再……', '……请宽恕我，让他们解脱吧。'],
    doing: ['大祭司大人活着的时候，大主教大人身上的护盾是打不破的。'], done: ['……谢谢你。他们终于可以休息了。', '大主教大人手里握着这个——是教团的预言书的残页。'] },
  reward: QR(25, 0.14, 2000, { items: [QE('rand', 25, 2)] }) });
bhQuest('q_b04', { type: 'main', chapter: Q_CH6, name: '预言家赫亚西斯的预言书 - 黄昏', npc: 'ophelia', lvl: 25, pre: 'q_b03',
  desc: '教团的预言家赫亚西斯留下了四卷预言书。黄昏之卷被巨树守护者罗丁吞进了树干里。',
  goals: [{ type: 'collect', key: 'q_bh_book_dusk', icon: 'q_scroll', item: '黄昏之预言书', from: 'rodin', boss: true, dungeon: 'treant_jungle', rate: 1, rar: 2, desc: '封面上画着沉入云海的夕阳。' }],
  talk: { offer: ['预言家赫亚西斯大人留下了四卷预言书：黎明、黄昏、暗与光。', '黎明之卷在大主教大人手里。黄昏之卷……被树精丛林的巨树守护者罗丁吞进了树干。', '罗丁的根须会沿着你站的那一排刺过来，上下走开就能躲。'],
    doing: ['罗丁的果实掉下来之前，地上会有红圈。'], done: ['黄昏之卷……“巨兽降下之时，长足之物将醒来”。'] },
  reward: QR(25, 0.14, 2000) });
bhQuest('q_b05', { type: 'main', chapter: Q_CH6, name: '预言家赫亚西斯的预言书 - 暗', npc: 'ophelia', lvl: 26, pre: 'q_b04',
  desc: '暗之卷在炼狱的夜叉王手里。',
  goals: [{ type: 'collect', key: 'q_bh_book_dark', icon: 'q_scroll', item: '暗之预言书', from: 'yakshaKing', boss: true, dungeon: 'purgatory', rate: 1, rar: 2, desc: '封面上是一片漆黑，摸上去是温热的。' }],
  talk: { offer: ['暗之卷……在炼狱。守着它的是夜叉王。', '他很快，而且常常霸体。听到“震地咆哮”的时候就跳起来——冲击波是贴着地面扩散的。'],
    doing: ['冲刺之前地上会出现红线，别站在线上。'], done: ['“长足之物以教徒为饵，以巨兽为床”……', '长足之物……难道是长脚罗特斯？'] },
  reward: QR(26, 0.14, 2200) });
bhQuest('q_b06', { type: 'main', chapter: Q_CH6, name: '预言家赫亚西斯的预言书 - 光', npc: 'ophelia', lvl: 27, pre: 'q_b05',
  desc: '最后一卷光之预言书，在极昼的飞艇多尼尔（EX）的船舱里。',
  goals: [{ type: 'collect', key: 'q_bh_book_light', icon: 'q_scroll', item: '光之预言书', from: 'donnierEX', boss: true, dungeon: 'polar_day', rate: 1, rar: 2, desc: '封面烫着金色的太阳，闪得睁不开眼。' }],
  talk: { offer: ['最后一卷在极昼——太阳永不落下的地方。', '教团的飞艇多尼尔被怪物占据了，光之卷就锁在最大那艘的船舱里。', '它会地毯轰炸，地上的红圈是一排一排出现的，看清楚再走。'],
    doing: ['极昼在巨兽的脊背那边，要从神殿之路一直往右走。'], done: ['四卷都齐了……“长足之物盘踞于脊椎，唯勇者可断其足”。'] },
  reward: QR(27, 0.14, 2400, { items: [QI('hpL', 5)] }) });
bhQuest('q_b07', { type: 'main', chapter: Q_CH6, name: '巨型黑章鱼', npc: 'ophelia', lvl: 28, pre: 'q_b06',
  desc: '脊椎里有一只巨型黑章鱼在守路。在第二脊椎打倒它。',
  goals: [{ type: 'kill', kind: 'blackOctopus', dungeon: 'second_spine', text: '在第二脊椎打倒 巨型黑章鱼' }],
  talk: { offer: ['去脊椎的路被一只巨型黑章鱼堵住了。它会原地转圈，还会喷墨。', '它转起来之前，脚下会出现一圈红色——离远一点。'],
    doing: ['巨型黑章鱼一般守在第二脊椎的岔路里。'], done: ['路通了。再往里走……就是长脚罗特斯的巢穴。'] },
  reward: QR(28, 0.12, 2400) });
bhQuest('q_b08', { type: 'main', chapter: Q_CH6, name: '长脚罗特斯', npc: 'ophelia', lvl: 29, pre: 'q_b07',
  desc: '袭击神殿、把信徒们变成怪物的元凶，就是盘踞在脊椎深处的长脚罗特斯。打倒它。',
  goals: [{ type: 'kill', kind: 'lotus', boss: true, dungeon: 'second_spine', text: '在第二脊椎打倒 长脚罗特斯' }],
  talk: { offer: ['一切的元凶，就是长脚罗特斯。', '它几乎不会移动，但触手能扫过一整排。地上亮起细细的紫线时，上下躲开。', '还有……它 4 秒没挨打就会回血。请一直打下去，不要停。'],
    doing: ['不要让它有喘息的机会。'], done: ['……罗特斯倒下了。', '谢谢你，{name}。神殿的钟声，终于停了。'] },
  reward: QR(29, 0.16, 3000, { items: [QE('weapon', 30, 2)] }) });
bhQuest('q_b09', { type: 'main', chapter: Q_CH6, name: '天帷巨兽的悲鸣', npc: 'ophelia', to: 'sharan', lvl: 30, pre: 'q_b08',   // 自创：本作的篇章收尾
  desc: '罗特斯倒下后，天帷巨兽发出了一声长长的悲鸣。以冒险级以上的难度再次通关第二脊椎，确认巨兽平安，然后回去向莎兰报告。',
  goals: [{ type: 'clear', dungeon: 'second_spine', diff: 1 }],
  talk: { offer: ['罗特斯倒下的那一刻，巨兽发出了一声长长的悲鸣……', '它的伤还没好。请以冒险级以上的难度再去一次第二脊椎，确认它平安无事，然后替我向莎兰会长报告。'],
    doing: ['冒险级以上……罗特斯的残党还在里面。'], done: ['巨兽的悲鸣停了？……太好了。', '天帷巨兽会继续在天空之海里游下去。{name}，你已经是阿拉德最强的冒险家之一了。', '——天帷巨兽篇 · 完——'] },
  reward: QR(30, 0.2, 5000, { coins: 3 }) });

/* ---------------- 隐藏地下城：天帷禁地 ---------------- */
bhQuest('q_fb1', { type: 'hidden', story: true, chapter: Q_CHB, name: '审判者马塞尔的日记 - 前篇', npc: 'ophelia', lvl: 29, pre: 'q_b08',
  desc: '罗特斯的巢穴里有一本教团的日记。以冒险级以上的难度打倒长脚罗特斯，把日记带回来。',
  goals: [{ type: 'collect', key: 'q_bh_diary1', icon: 'q_scroll', item: '马塞尔的日记 - 前篇', from: 'lotus', boss: true, dungeon: 'second_spine', diff: 1, rate: 1, rar: 3, desc: '封面上写着“血腥净化”。' }],
  talk: { offer: ['罗特斯的巢穴里……好像有教团的东西。', '以冒险级以上的难度再打倒罗特斯一次，把它守着的东西带回来好吗？'],
    doing: ['冒险级以上。'], done: ['……这是审判者马塞尔的日记。', '马塞尔是教团秘密组织“血腥净化”的首领。罗特斯袭击神殿那天，他……没有死？'] },
  reward: QR(29, 0.08, 2000) });
bhQuest('q_fb2', { type: 'hidden', story: true, chapter: Q_CHB, name: '马塞尔留下的线索', npc: 'ophelia', lvl: 29, pre: 'q_fb1',
  desc: '日记里说，血腥净化的成员身上都有纹章。从天帷巨兽的 GBL 教徒身上收集 10 个血腥净化的纹章。',
  goals: [{ type: 'collect', key: 'q_bh_crest', icon: 'q_org_seal', item: '血腥净化的纹章', from: Q_BH_GBL, dungeon: Q_BH_DGS, rate: 0.4, n: 10, desc: '一枚刻着被剑刺穿的太阳的铁纹章。' }],
  talk: { offer: ['日记里说，血腥净化的成员身上都带着纹章。', '请从天帷巨兽的教徒身上收集 10 个——我想知道，还有多少人跟着马塞尔。'], doing: ['还差一些……'], done: ['这么多……马塞尔用禁咒让他们复活了。'] },
  reward: QR(29, 0.08, 2000) });
bhQuest('q_hidden_forbidden', { type: 'hidden', story: true, chapter: Q_CHB, name: '血腥伊恩', npc: 'ophelia', lvl: 29, pre: ['q_fb2', 'q_b08'],
  desc: '马塞尔的禁地藏在巨兽的肚子里。先证明你有资格：以冒险级以上的难度通关第二脊椎。完成后天帷禁地的门就会出现。',
  goals: [{ type: 'clear', dungeon: 'second_spine', diff: 1 }],
  talk: { offer: ['马塞尔用禁咒把灵魂抽离肉体，逃进了巨兽的肚子里——那里就是教团的禁地。', '入口会在脊背上出现……但只对足够强的人。', '以冒险级以上的难度通关第二脊椎，证明给我看。'],
    doing: ['冒险级以上的第二脊椎。'], done: ['……入口出现了。就在脊背那边，第二脊椎的右边。', '请一定小心，马塞尔从来不会倒下。'] },
  reward: QR(29, 0.08, 2000, { unlock: 'forbidden_land' }) });
bhQuest('q_fb4', { type: 'hidden', chapter: Q_CHB, name: '大陆的肚子', npc: 'ophelia', lvl: 29, pre: 'q_hidden_forbidden',
  desc: '进入天帷禁地，看看马塞尔在做什么。',
  goals: [{ type: 'clear', dungeon: 'forbidden_land' }],
  talk: { offer: ['去禁地看看吧。复活的教徒比以前更快、更狠。'], doing: ['禁地在脊背，第二脊椎的右边。'], done: ['他在那里……重建教团？用死去的信徒？'] },
  reward: QR(29, 0.1, 2500) });
bhQuest('q_fb5', { type: 'hidden', chapter: Q_CHB, name: '审判者马塞尔的日记 - 后篇', npc: 'ophelia', lvl: 30, pre: 'q_fb4',
  desc: '以冒险级以上的难度打倒审判者马塞尔，从他身上找到日记的后半本。',
  goals: [{ type: 'collect', key: 'q_bh_diary2', icon: 'q_scroll', item: '马塞尔的日记 - 后篇', from: 'marcel', boss: true, dungeon: 'forbidden_land', diff: 1, rate: 1, rar: 3, desc: '最后一页的字迹已经乱得看不清了。' }],
  talk: { offer: ['马塞尔全程霸体，扔的飞刀是上下错开的三把。', '他升起血色护罩的时候，把他引出罩子再打。', '……请结束这一切吧，以冒险级以上的难度。'],
    doing: ['护罩里的他几乎不会受伤。'], done: ['“罗特斯已死，我的复仇也失去了意义……”', '……他最后，只是一个失去了一切的人。谢谢你，{name}。'] },
  reward: QR(30, 0.15, 4000, { coins: 2, items: [QE('bracelet', 30, 2)] }) });

/* ---------------- 支线 ---------------- */
bhQuest('s_bh_weapon', { name: '收集武器材料', npc: ['kakun', 'roget'], lvl: 24,   // 官方：卡坤
  desc: '卡坤想研究天帷巨兽的武器。从龙头炮身上收集坚固的铁具，从教徒身上收集破损的刀刃。',
  goals: [{ type: 'collect', key: 'q_bh_iron', icon: 'q_rusty_iron', item: '坚固的铁具', from: ['dragonCannon', 'fireCannon', 'laserCannon'], rate: 0.5, n: 6, desc: '龙头炮上拆下来的铁件，比普通的铁硬得多。' },
    { type: 'collect', key: 'q_bh_blade', icon: 'q_rusty_iron', item: '破损的刀刃', from: Q_BH_GBL, rate: 0.4, n: 6, desc: '教徒们用的仪式短刀，刃口已经卷了。' }],
  talk: { offer: ['天帷巨兽上的东西，都是古代文明的技术！', '帮我从龙头炮身上拆些铁具，再从教徒身上捡些断刀回来。'], done: ['这个硬度……果然不是现在的技术能做出来的。'] },
  reward: QR(24, 0.05, 1500, { items: [QI('crystal', 30)] }) });
bhQuest('s_bh_armor', { name: '收集防具材料', npc: ['sinda', 'linus'], lvl: 25,   // 官方：辛达
  desc: '辛达想用龙头炮的炮身打造新的防具。',
  goals: [{ type: 'collect', key: 'q_bh_barrel', icon: 'q_golem_shard', item: '龙头炮的炮身', from: ['dragonCannon', 'fireCannon', 'laserCannon'], rate: 0.45, n: 8, desc: '雕成龙头的铜炮管，还是热的。' }],
  talk: { offer: ['听说天帷巨兽上有会走路的大炮？', '炮身的铜料可是上等货！给我带 8 块回来。'], done: ['好铜！这下能打一副好甲了。'] },
  reward: QR(25, 0.05, 1600, { items: [QE('rand', 25, 1)] }) });
bhQuest('s_bh_souls', { name: '减轻信徒的痛苦', npc: 'ophelia', lvl: 25,   // 官方：奥菲利亚
  desc: '奥菲利亚希望你让变成怪物的信徒们解脱。消灭 30 名 GBL 教信徒和 20 只章鱼怪。',
  goals: [{ type: 'kill', kind: Q_BH_GBL, n: 30, text: '消灭 GBL 教徒' }, { type: 'kill', kind: Q_BH_OCTO, n: 20, text: '消灭章鱼' }],
  talk: { offer: ['他们曾经都是我的同伴……', '请让他们解脱吧。还有那些章鱼——它们是罗特斯的爪牙。'], done: ['……愿他们安息。'] },
  reward: QR(25, 0.06, 1800) });
bhQuest('s_bh_seed', { name: '树精的种子', npc: ['norton', 'kiri'], lvl: 26,   // 自创
  desc: '诺顿听说树精丛林的种子能长出会走路的树，想拿来做生意。',
  goals: [{ type: 'collect', key: 'q_bh_seed', icon: 'q_herb', item: '树精的种子', from: ['treant', 'treantDark', 'gardenerRul'], rate: 0.4, n: 6, desc: '圆滚滚的种子，偶尔会自己动一下。' }],
  talk: { offer: ['会走路的树！你想想，要是能卖给贵族当看门的……', '帮我弄 6 颗树精的种子来！'], done: ['嘿嘿，它在动！发财了发财了！'] },
  reward: QR(26, 0.05, 2000, { items: [QI('guard', 1)] }) });
bhQuest('s_bh_octopus', { name: '章鱼怪的标本', npc: ['kiri', 'norton'], lvl: 27,   // 官方：凯丽（50 个，这里 15 个）
  desc: '凯丽要研究罗特斯的爪牙，需要章鱼怪的标本。',
  goals: [{ type: 'collect', key: 'q_bh_octo', icon: 'q_poison_sac', item: '章鱼怪的标本', from: Q_BH_OCTO, rate: 0.45, n: 15, desc: '泡在瓶子里还在扭来扭去的触手。' }],
  talk: { offer: ['天界的研究所也没见过这种章鱼！', '帮我收集 15 个标本吧~ 不要怕，它们装进瓶子里就不动了……大概。'], done: ['哇，还在动！好可爱~'] },
  reward: QR(27, 0.05, 2200, { items: [QI('hpL', 5)] }) });
bhQuest('s_bh_gardener', { name: '园丁鲁尔', npc: ['alice', 'sharan'], lvl: 26,   // 官方怪物名，任务自创
  desc: '吟游诗人艾丽丝想写一首关于树精丛林的歌。打倒会种花的园丁鲁尔，把故事讲给她听。',
  goals: [{ type: 'kill', kind: 'gardenerRul', dungeon: 'treant_jungle', text: '在树精丛林打倒 园丁鲁尔' }],
  talk: { offer: ['我在写一首关于树精丛林的歌！', '听说那里有个会种花的树精，叫园丁鲁尔……你能去见见它，然后把故事讲给我听吗？'], done: ['它会让混乱花开满整个房间？好浪漫……也好可怕！', '这首歌就叫《园丁与花》吧。'] },
  reward: QR(26, 0.05, 2000, { sp: 5 }) });
