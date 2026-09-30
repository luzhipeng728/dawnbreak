/* =====================================================================
   转职任务链（官方经典版：格兰之森 - 杀手 → 拜访导师 → 七次修炼 → 在导师处转职；本作转职 Lv.15，觉醒 Lv.21——官方一觉 50 级按统一等级表换算，见 docs/SKILLS_OFFICIAL_common.md 第 7 节）
   - 鬼剑士：G.S.D「鬼剑士之路」；神枪手：凯丽「弹无虚发」；魔法师：莎兰「神奇的魔法」；格斗家（男）：风振「风拳流」（转职任务线 / 一觉剧情另见 content/quests/fighter.js）
   - 最后的试炼：被击不超过 50 次通关烈焰格拉卡（试玩核查：原来的 15 次太苛刻，远程哥布林的小伤害、多段攻击的每一段都算被击；机器人 45~60 次；只躲地面预警的键盘试玩：鬼剑士 27~58、神枪手 37、魔法师 40~56）
   - 转职任务链（拜访导师 → 七次修炼 → 最后的试炼）只给还没转职的角色（job: false）；创建角色时就选好转职的（协战师）不会出现
   - 觉醒：两步任务，完成后 save.data.flags.awaken = true（awakenUnlocked() 为真）；二次觉醒 26 级 / 三次觉醒 30 级各两步，完成后 flags.awaken2 / awaken3（tierUnlocked(2 / 3)）
   ===================================================================== */
defineQuest('q_job_kill', { type: 'job', name: '格兰之森 - 杀手', npc: 'linus', lvl: 2,
  desc: '林纳斯的考验：被击不超过 30 次通关洛兰深处。通过了，他就把你介绍给职业导师。',
  goals: [{ type: 'clear', dungeon: 'lorien_deep', hurt: 30 }],   // 原来 12 次：机器人 14~25 次；键盘试玩 鬼剑士 15、神枪手 22~28、魔法师 19
  talk: { offer: ['想变得更强，光靠蛮力是不够的。', '真正的强者，是不会被敌人轻易碰到的。——被击不超过 30 次，通关洛兰深处。做到了，我就把你介绍给你的导师。'], doing: ['被打中超过 30 次就不算。挨打之前，先想想怎么躲——远处扔石头的哥布林要先解决。'], done: ['哼，有点样子了。', '去见见你的导师吧。他们会带你走上真正属于你的道路。'] },
  reward: QR(2, 0.12, 300, { items: [QI('hpM', 3)], title: 'title_basic' }) });

const JOB_CHAINS = {
  sword: { mentor: 'gsd', visit: 'G.S.D的传说', path: '鬼剑士之路', step: n => `第${n}次修炼`, last: '最后的修炼',
    visitOffer: ['你的左臂……还疼吗？', '被鬼神附身的人，要么驾驭它，要么被它吞噬。赫顿玛尔旧城区有位盲眼的剑士，他也曾和你一样。', '去找 G.S.D 老先生吧。他是所有鬼剑士的导师。'],
    visitDone: ['……你的左臂，在哭泣。', '我是 G.S.D。从今天起，我来教你如何与鬼神共处。'],
    finalDone: ['……你的剑，已经不再迷茫了。', '鬼神之力可以毁灭一切，也可以守护一切。剑魂以剑为道，狂战士以血为刃——选择你的道路吧。'],
    change: '鬼神的指引', changeOffer: ['转职之后，就再也不能回头了。', '想清楚了，就在我这里选择你的道路。'], changeDone: ['……很好。从今往后，你就是一名{job}了。'],
    aw1: '觉醒 - 遭遇瓶颈', aw2: '觉醒 - 突破瓶颈', awOffer: ['……你的剑停在了一道墙前。那是每个剑士都会遇到的瓶颈。', '去暗黑雷鸣废墟吧，在亡者之间磨砺你的剑，三次。'], aw2Offer: ['瓶颈已经出现裂缝了。', '最后，在冒险级以上的烈焰格拉卡以 C 以上的评价战斗，再带 30 块无色小晶块来，我为你铸一把觉醒之剑。'], awDone: ['……墙，碎了。', '你的剑，终于觉醒了。去吧，让鬼神也为之颤抖。'] },
  gun: { mentor: 'kiri', visit: '来自天界的神枪手凯丽', path: '弹无虚发', step: n => `第${n}次冒险`, last: '向新的冒险前进',
    visitOffer: ['用枪的？那你得去见见凯丽。', '她是从天界来的游侠，枪法没人比得上。赫顿玛尔中央广场，一眼就能认出她——最吵的那个。'],
    visitDone: ['哦~新来的神枪手？看起来还挺有精神的嘛！', '我是凯丽，来自天界的神枪手！从今天起就叫我老师吧~'],
    finalDone: ['哇哦，完美！弹无虚发，说的就是你嘛~', '漫游枪手靠左轮和身法，枪炮师靠重火力——你想走哪条路？'],
    change: '天界的枪声', changeOffer: ['选好了就不能反悔哦~', '想清楚了就在凯丽这里转职吧！'], changeDone: ['恭喜恭喜！从今天起你就是{job}啦！'],
    aw1: '觉醒 - 暴风眼 1', aw2: '觉醒 - 暴风眼 2', awOffer: ['你知道暴风眼吗？风暴的正中心，反而是最安静的地方。', '真正的神枪手，要在枪林弹雨中保持冷静——去暗黑雷鸣废墟，打三次！'], aw2Offer: ['快了快了！', '冒险级以上的烈焰格拉卡，C 以上的评价！再带 30 块无色小晶块来，我给你改装觉醒用的武器~'], awDone: ['就是这个眼神！你已经站在暴风眼里了！', '觉醒吧，神枪手！'] },
  mage: { mentor: 'sharan', visit: '暗精灵魔法师莎兰', path: '神奇的魔法', step: n => `第${n}次冒险`, last: '最后的冒险',
    visitOffer: ['你身上的魔力很特别。', '西海岸的魔法师公会里，有一位暗精灵魔法师叫莎兰。她的魔法学识，整个阿拉德都数一数二。去拜她为师吧。'],
    visitDone: ['……魔力的流动，你感觉到了吗？', '我是莎兰。暗精灵的魔法学识，可不会轻易传授给别人——除非你证明自己配得上。'],
    finalDone: ['你已经证明了自己。', '元素师驾驭四大元素，战斗法师把魔力化为拳脚——魔法的形态，由你来决定。'],
    change: '魔法的真理', changeOffer: ['一旦选择，就无法回头。', '想好了，就在我这里完成转职的仪式。'], changeDone: ['仪式完成了。从今往后，你就是一名{job}。'],
    aw1: '觉醒 - 魔力的瓶颈', aw2: '觉醒 - 魔力觉醒', awOffer: ['你的魔力，已经触到了容器的边缘。', '去暗黑雷鸣废墟，在死亡的气息中感受魔力的极限，三次。'], aw2Offer: ['容器开始出现裂缝了。', '最后，在冒险级以上的烈焰格拉卡以 C 以上的评价战斗，再带 30 块无色小晶块来，我用它们为你刻下觉醒的魔法阵。'], awDone: ['……感觉到了吗？你的魔力，已经没有边界了。', '觉醒吧，魔法师。'] },
  // 格斗家（男）：风拳流大师风振（官方入门任务「风拳流大师风振」）。四个转职各自的转职任务线、一觉两步之间的转职剧情在 content/quests/fighter.js
  fighter: { mentor: 'fengzhen', visit: '风拳流大师风振', path: '风拳流', step: n => `第${'一二三四五六七'[n - 1]}式`, last: '出师之战',
    visitOffer: ['拳头硬，腿更硬——你是格斗家吧？', '赫顿玛尔中央广场有个叫风振的人，风拳流的大师。别看他年纪不大，城里的格斗家都得叫他一声师父。', '去找他吧。能不能拜进门，就看你自己了。'],
    visitDone: ['……脚步很重，拳头很急。', '我是风振，风拳流的传人。想学真正的格斗，先把那股蛮劲收起来——风，是看不见、也抓不住的。'],
    finalDone: ['……好。你的拳脚里，已经有风了。', '格斗的道路有四条：气功师以念御敌，散打只信自己的拳脚，街霸不择手段，柔道家一抓定胜负。', '每一条路都有它自己的试炼。在我这里选好方向，接下那条路的转职任务吧。'],
    change: '拳脚的道路', changeOffer: ['选一条路，走完它的试炼，再回来找我。', '接了一条路的试炼，就先别想着另一条——半途换方向，进行到一半的那一步就白做了。'], changeDone: ['……从今往后，你就是一名{job}了。', '别忘了风拳流的第一课：出拳之前，先稳住自己的下盘。'],
    aw1: '觉醒 - 风的壁垒', aw2: '觉醒 - 破壁', awOffer: ['……最近出拳，是不是总觉得差了一口气？', '那是每个格斗家都会撞上的墙。墙的那一边，才是觉醒。', '先去暗黑雷鸣废墟，在亡者之间把拳脚磨利——三次。'],
    aw2Offer: ['……看来你已经找到了自己的路。', '墙已经裂开了。最后一步：冒险级以上的烈焰格拉卡，C 以上的评价；再带 30 块无色小晶块来，我为你打一副觉醒的护手。'], awDone: ['……这一拳，连风都追不上了。', '{job}的觉醒，成了。去吧，让整个阿拉德都记住你的名字。'] },
};
// 二次 / 三次觉醒的台词（各职业导师）
const AWAKEN_MORE = {
  sword: { n2: '超越极限', n2b: '鬼神的真名', o2: ['觉醒只是开始。', '你的剑已经碰到了新的墙——去天帷巨兽的炼狱，打三次。'], d2: ['……鬼神在你的剑里低语了它的真名。', '二次觉醒，完成了。'],
    o3: ['到了这一步，已经没有人能教你了。', '剩下的，只有你自己。去第二脊椎，打两次。'], d3: ['……剑与鬼神，已经没有分别了。', '这才是真正的觉醒。'] },
  gun: { n2: '更强的火力', n2b: '暴风的中心', o2: ['觉醒了还不够哦~', '天帷巨兽的炼狱，打三次！火力还能再往上提！'], d2: ['哇——这枪声，连天界都听得见了！', '二次觉醒，完成！'],
    o3: ['接下来的路，凯丽也没走过呢。', '去第二脊椎打两次吧，我在这儿等你的好消息~'], d3: ['……你已经比我强了。', '这就是真正的觉醒，神枪手！'] },
  mage: { n2: '魔力的深渊', n2b: '元素的真理', o2: ['觉醒之后，魔力还会继续生长。', '去天帷巨兽的炼狱，打三次。'], d2: ['……魔力的深渊，你已经看到底了。', '二次觉醒，完成了。'],
    o3: ['魔法的尽头是什么？没有人知道。', '去第二脊椎，打两次，然后亲自去看看。'], d3: ['……原来如此，尽头就是你自己。', '这才是真正的觉醒。'] },
  fighter: { n2: '风的尽头', n2b: '无相', o2: ['觉醒之后，你以为就到头了？', '风没有尽头。去天帷巨兽的炼狱，冒险级以上，打三次。'], d2: ['……好拳。这一拳里，已经看不出招式了。', '二次觉醒，成了。'],
    o3: ['到了这一步，我也教不了你什么了。', '剩下的路，要你自己的拳脚去走。去第二脊椎，打两次。'], d3: ['……归元。千般招式，最后都回到了一拳一脚。', '这才是真正的觉醒。风拳流，以你为傲。'] },
};
// 七次修炼（官方模板，按本作的地下城和 15 级转职调整）
const JOB_STEPS = [
  { lvl: 4, goals: [{ type: 'kill', kind: 'tauSoldier', dungeon: 'dark_woods', n: 4, text: '在幽暗密林击败牛头兵' }], desc: '在幽暗密林击败 4 只牛头兵。', line: '牛头兵有霸体，别跟它比力气。' },
  { lvl: 5, goals: [{ type: 'collect', key: 'q_cat_nail', item: '猫妖指甲', from: 'catDemon', rate: 0.5, n: 10, desc: '锋利的猫妖指甲。' }], desc: '收集 10 个猫妖指甲。', line: '猫妖的指甲又快又利，要抓住它们落地的瞬间。' },
  { lvl: 7, goals: [{ type: 'clear', dungeon: 'thunder_ruins', diff: 1 }], desc: '以冒险级以上的难度通关雷鸣废墟。', line: '冒险级的雷鸣废墟，怪物会更凶。' },
  { lvl: 9, goals: [{ type: 'kill', kind: 'catVenom', dungeon: 'venom_ruins', n: 6, text: '在猛毒雷鸣废墟击败毒爪猫妖' }], desc: '在猛毒雷鸣废墟击败 6 只毒爪猫妖。', line: '中毒了就先退一步，别贪刀。' },
  { lvl: 11, pre: 'q_hidden_frozen', goals: [{ type: 'clear', dungeon: 'frozen_woods', diff: 1 }], desc: '以冒险级以上的难度通关冰霜幽暗密林。', line: '冰霜幽暗密林……那里的寒气会冻住犹豫的人。' },
  { lvl: 13, goals: [{ type: 'clear', dungeon: 'graca', diff: 1 }], desc: '以冒险级以上的难度通关格拉卡。', line: '牛头王蓄力的时候，就是你的机会。' },
];
for (const [cls, C] of Object.entries(JOB_CHAINS)) {
  const M = C.mentor;
  defineQuest(`q_job_visit_${cls}`, { type: 'job', cls, job: false, name: C.visit, npc: 'linus', to: M, lvl: 3, pre: 'q_job_kill',
    desc: `去拜访${qNpcName(M)}，开始${CLASSES[cls] ? CLASSES[cls].name : ''}的修炼。`,
    talk: { offer: C.visitOffer, done: C.visitDone }, reward: QR(3, 0.04, 250) });
  let prev = `q_job_visit_${cls}`;
  JOB_STEPS.forEach((S, i) => {
    const id = `q_job_${cls}_${i + 1}`;
    defineQuest(id, { type: 'job', cls, job: false, name: `${C.path} - ${C.step(i + 1)}`, npc: M, lvl: S.lvl, pre: [prev].concat(S.pre || []), desc: S.desc,
      goals: S.goals.map(g => ({ ...g, key: g.key && g.key + '_' + cls, icon: g.key })),
      talk: { offer: [`${C.path}，${C.step(i + 1)}。`, S.desc, S.line], doing: [S.line], done: [i < 5 ? '很好，继续保持。' : '……你离转职只差最后一步了。'] },
      reward: QR(S.lvl, 0.08, 200 + S.lvl * 60, { items: [QI(i % 2 ? 'mpM' : 'hpM', 3)] }) });
    prev = id;
  });
  defineQuest(`q_job_${cls}_final`, { type: 'job', cls, job: false, name: `${C.path} - ${C.last}`, npc: M, lvl: 15, pre: prev,
    desc: '最后的试炼：被击不超过 50 次，通关烈焰格拉卡。',
    goals: [{ type: 'clear', dungeon: 'blazing_graca', hurt: 50 }],
    talk: { offer: [`${C.path}——${C.last}。`, '烈焰格拉卡。被击不超过 50 次，活着走出来。', '做到了，你就有资格选择自己的道路。'], doing: ['50 次。多一次都不行。先收拾扔火瓶的赤哥布林，看到地上的红色六芒星就躲开。'], done: C.finalDone },
    reward: QR(15, 0.12, 1500, { sp: 20 }) });
  defineQuest(`q_job_${cls}_change`, { type: 'job', cls, name: C.change, npc: M, lvl: 15, pre: `q_job_${cls}_final`,
    desc: `在${qNpcName(M)}处完成转职（对话里选择「转职」）。`,
    goals: [{ type: 'job', text: `在${qNpcName(M)}处完成转职` }],
    talk: { offer: C.changeOffer, accept: '准备好了，就选择右边的「转职」吧。', doing: ['选好你的道路了吗？（在对话菜单里选择「转职」）'], done: C.changeDone },
    reward: QR(15, 0.08, 1500, { items: [QI('elixir', 2)] }) });
  defineQuest(`q_awaken_${cls}_1`, { type: 'job', cls, job: true, name: C.aw1, npc: M, lvl: 21, pre: 'q_hidden_dark',   // 已转职就行（不要求交了转职任务：协战师这类创建角色时就选好转职、不走转职任务链）
    desc: '在暗黑雷鸣废墟磨砺自己，通关 3 次。',
    goals: [{ type: 'clear', dungeon: 'dark_thunder', n: 3 }],
    talk: { offer: C.awOffer, doing: ['还不够。'], done: ['……瓶颈，已经出现裂缝了。'] },
    reward: QR(21, 0.12, 2500) });
  defineQuest(`q_awaken_${cls}_2`, { type: 'job', cls, job: true, name: C.aw2, npc: M, lvl: 21, pre: `q_awaken_${cls}_1`,
    desc: '以 C 以上的评价通关冒险级以上的烈焰格拉卡，并带来 30 个无色小晶块。完成后解锁觉醒技能。',
    goals: [{ type: 'clear', dungeon: 'blazing_graca', diff: 1, rank: 'C' }, { type: 'item', key: 'crystal', n: 30 }],   // 试玩核查：原来是勇士级 S——Lv.18 机器人勇士级要 5~7 分钟、被击 68~100 次、评价 F，S 几乎做不到；冒险级：机器人 S、只躲地面预警的键盘试玩 C~D（被击 57~69）；按“宁可偏简单”取 C（被击 ≤ 约 60 次）
    talk: { offer: C.aw2Offer, doing: ['冒险级以上，C 以上的评价——少挨打，评价就高。还有 30 块无色小晶块。'], done: C.awDone },
    reward: QR(21, 0.17, 4000, { flag: 'awaken', title: 'title_awaken' }) });
  // 二次觉醒（官方 75 级任务、85 级技能 → 本作 26 级）/ 三次觉醒（官方 100 级「真正的觉醒」→ 本作 30 级）：完成后解锁该阶段的技能（S.tier 2 / 3）
  const A = AWAKEN_MORE[cls];
  defineQuest(`q_awaken2_${cls}_1`, { type: 'job', cls, job: true, name: `二次觉醒 - ${A.n2}`, npc: M, lvl: 26, pre: `q_awaken_${cls}_2`,
    desc: '以冒险级以上的难度通关天帷巨兽的炼狱 3 次。',
    goals: [{ type: 'clear', dungeon: 'purgatory', diff: 1, n: 3 }],
    talk: { offer: A.o2, doing: ['炼狱，冒险级以上，三次。'], done: ['……还差最后一步。'] },
    reward: QR(26, 0.12, 5000) });
  defineQuest(`q_awaken2_${cls}_2`, { type: 'job', cls, job: true, name: `二次觉醒 - ${A.n2b}`, npc: M, lvl: 26, pre: `q_awaken2_${cls}_1`,
    desc: '以冒险级以上的难度、C 以上的评价通关极昼。完成后解锁二次觉醒的技能。',
    goals: [{ type: 'clear', dungeon: 'polar_day', diff: 1, rank: 'C' }],
    talk: { offer: ['去极昼吧。在那片不落的阳光下，把你的力量再推高一层。'], doing: ['极昼，冒险级以上，C 以上的评价。'], done: A.d2 },
    reward: QR(26, 0.17, 8000, { flag: 'awaken2' }) });
  defineQuest(`q_awaken3_${cls}_1`, { type: 'job', cls, job: true, name: `真正的觉醒 - 上`, npc: M, lvl: 30, pre: `q_awaken2_${cls}_2`,
    desc: '以冒险级以上的难度通关第二脊椎 2 次。',
    goals: [{ type: 'clear', dungeon: 'second_spine', diff: 1, n: 2 }],
    talk: { offer: A.o3, doing: ['第二脊椎，冒险级以上，两次。'], done: ['……你看见那面镜子了吗？'] },
    reward: QR(30, 0.12, 8000) });
  defineQuest(`q_awaken3_${cls}_2`, { type: 'job', cls, job: true, name: `真正的觉醒 - 下`, npc: M, lvl: 30, pre: `q_awaken3_${cls}_1`,
    desc: '以冒险级以上的难度通关天帷禁地，战胜镜子里的自己。完成后解锁三次觉醒的技能。',
    goals: [{ type: 'clear', dungeon: 'forbidden_land', diff: 1 }],
    talk: { offer: ['天帷禁地的最深处，有一个和你一模一样的人在等你。', '打败那个人——打败过去的自己，才是真正的觉醒。'], doing: ['天帷禁地，冒险级以上。'], done: A.d3 },
    reward: QR(30, 0.2, 12000, { flag: 'awaken3' }) });
}
/* ---- 转职专属任务线（官方：在导师处选一个转职方向，接它的转职任务，做完才能转成这个方向）----
   数据写在转职定义上（职业文件比任务引擎早加载，不能直接 defineQuest）：
     CLASSES[cls].jobs[job].quests = [[任务id, def], …]   def 同 defineQuest（type / cls 可省），第一步一般 pre: 'q_job_<职业>_final'
     CLASSES[cls].jobs[job].trial  = 最后一步的任务 id（转职窗口：没完成就不能转成这个方向）
   玩家在转职窗口里点「接受 X 的转职任务」→ save.data.jobPick = job，这条任务线才出现（同一时间只接一条，换方向会放弃进行中的那一步）。
   只有 trial、没有 quests 的转职（任务在别的文件里定义）：窗口只提示去做这个任务 ---- */
const jobPickOf = () => (save.data && save.data.jobPick) || null;
for (const cls in CLASSES) for (const [jid, J] of Object.entries(CLASSES[cls].jobs || {})) for (const [id, d] of J.quests || [])
  defineQuest(id, { type: 'job', cls, ...d, cond: () => jobPickOf() === jid && (!d.cond || d.cond()) });
