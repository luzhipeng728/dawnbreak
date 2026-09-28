/* =====================================================================
   转职任务链（官方经典版：格兰之森 - 杀手 → 拜访导师 → 七次修炼 → 在导师处转职；本作转职 Lv.15，觉醒 Lv.18）
   - 鬼剑士：G.S.D「鬼剑士之路」；神枪手：凯丽「弹无虚发」；魔法师：莎兰「神奇的魔法」
   - 最后的试炼：被击不超过 40 次通关烈焰格拉卡（试玩核查：原来的 15 次太苛刻，远程哥布林的小伤害也算被击；机器人 45~60 次、只躲地面预警的键盘试玩 27~50 次）
   - 觉醒：两步任务，完成后 save.data.flags.awaken = true（awakenUnlocked() 为真）
   ===================================================================== */
defineQuest('q_job_kill', { type: 'job', name: '格兰之森 - 杀手', npc: 'linus', lvl: 2,
  desc: '林纳斯的考验：被击不超过 25 次通关洛兰深处。通过了，他就把你介绍给职业导师。',
  goals: [{ type: 'clear', dungeon: 'lorien_deep', hurt: 25 }],   // 原来 12 次：机器人 14~25 次，新手很难做到
  talk: { offer: ['想变得更强，光靠蛮力是不够的。', '真正的强者，是不会被敌人轻易碰到的。——被击不超过 25 次，通关洛兰深处。做到了，我就把你介绍给你的导师。'], doing: ['被打中超过 25 次就不算。挨打之前，先想想怎么躲——远处扔石头的哥布林要先解决。'], done: ['哼，有点样子了。', '去见见你的导师吧。他们会带你走上真正属于你的道路。'] },
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
  defineQuest(`q_job_visit_${cls}`, { type: 'job', cls, name: C.visit, npc: 'linus', to: M, lvl: 3, pre: 'q_job_kill',
    desc: `去拜访${qNpcName(M)}，开始${CLASSES[cls] ? CLASSES[cls].name : ''}的修炼。`,
    talk: { offer: C.visitOffer, done: C.visitDone }, reward: QR(3, 0.04, 250) });
  let prev = `q_job_visit_${cls}`;
  JOB_STEPS.forEach((S, i) => {
    const id = `q_job_${cls}_${i + 1}`;
    defineQuest(id, { type: 'job', cls, name: `${C.path} - ${C.step(i + 1)}`, npc: M, lvl: S.lvl, pre: [prev].concat(S.pre || []), desc: S.desc,
      goals: S.goals.map(g => ({ ...g, key: g.key && g.key + '_' + cls, icon: g.key })),
      talk: { offer: [`${C.path}，${C.step(i + 1)}。`, S.desc, S.line], doing: [S.line], done: [i < 5 ? '很好，继续保持。' : '……你离转职只差最后一步了。'] },
      reward: QR(S.lvl, 0.08, 200 + S.lvl * 60, { items: [QI(i % 2 ? 'mpM' : 'hpM', 3)] }) });
    prev = id;
  });
  defineQuest(`q_job_${cls}_final`, { type: 'job', cls, name: `${C.path} - ${C.last}`, npc: M, lvl: 15, pre: prev,
    desc: '最后的试炼：被击不超过 40 次，通关烈焰格拉卡。',
    goals: [{ type: 'clear', dungeon: 'blazing_graca', hurt: 40 }],
    talk: { offer: [`${C.path}——${C.last}。`, '烈焰格拉卡。被击不超过 40 次，活着走出来。', '做到了，你就有资格选择自己的道路。'], doing: ['40 次。多一次都不行。先收拾扔火瓶的赤哥布林，看到地上的红色六芒星就躲开。'], done: C.finalDone },
    reward: QR(15, 0.12, 1500, { sp: 20 }) });
  defineQuest(`q_job_${cls}_change`, { type: 'job', cls, name: C.change, npc: M, lvl: 15, pre: `q_job_${cls}_final`,
    desc: `在${qNpcName(M)}处完成转职（对话里选择「转职」）。`,
    goals: [{ type: 'job', text: `在${qNpcName(M)}处完成转职` }],
    talk: { offer: C.changeOffer, accept: '准备好了，就选择右边的「转职」吧。', doing: ['选好你的道路了吗？（在对话菜单里选择「转职」）'], done: C.changeDone },
    reward: QR(15, 0.08, 1500, { items: [QI('elixir', 2)] }) });
  defineQuest(`q_awaken_${cls}_1`, { type: 'job', cls, job: true, name: C.aw1, npc: M, lvl: 18, pre: [`q_job_${cls}_change`, 'q_hidden_dark'],
    desc: '在暗黑雷鸣废墟磨砺自己，通关 3 次。',
    goals: [{ type: 'clear', dungeon: 'dark_thunder', n: 3 }],
    talk: { offer: C.awOffer, doing: ['还不够。'], done: ['……瓶颈，已经出现裂缝了。'] },
    reward: QR(18, 0.12, 2500) });
  defineQuest(`q_awaken_${cls}_2`, { type: 'job', cls, job: true, name: C.aw2, npc: M, lvl: 18, pre: `q_awaken_${cls}_1`,
    desc: '以 C 以上的评价通关冒险级以上的烈焰格拉卡，并带来 30 个无色小晶块。完成后解锁觉醒技能。',
    goals: [{ type: 'clear', dungeon: 'blazing_graca', diff: 1, rank: 'C' }, { type: 'item', key: 'crystal', n: 30 }],   // 试玩核查：原来是勇士级 S——Lv.18 机器人勇士级要 5~7 分钟、被击 68~100 次、评价 F，S 几乎做不到；冒险级：机器人 S、只躲地面预警的键盘试玩 C~D（被击 57~69）；按“宁可偏简单”取 C（被击 ≤ 约 60 次）
    talk: { offer: C.aw2Offer, doing: ['冒险级以上，C 以上的评价——少挨打，评价就高。还有 30 块无色小晶块。'], done: C.awDone },
    reward: QR(18, 0.17, 4000, { flag: 'awaken', title: 'title_awaken' }) });
}
