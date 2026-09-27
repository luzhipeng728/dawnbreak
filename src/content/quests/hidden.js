/* =====================================================================
   隐藏任务：解锁两个隐藏地下城（world.js 的 dungeonUnlocked 检查 save.data.questDone[id]）
   - q_hidden_frozen → 冰霜幽暗密林（官方：G.S.D 的「疯掉的魔法师克拉赫」接下即开放；本作改为先追查寒气的源头）
   - q_hidden_dark   → 暗黑雷鸣废墟（官方：辛达丢失的锤子 → 奇怪的石头 → 暗黑雷鸣废墟）
   story: true 的任务会在追踪栏里当作主线引导
   ===================================================================== */
defineQuest('q_hidden_frozen', { type: 'hidden', story: true, chapter: '隐藏地下城 · 冰霜幽暗密林', name: '寒气的源头', npc: 'gsd', lvl: 9, pre: 'q_m12',   // 自创（寒气结晶是官方道具名）
  desc: '雷鸣废墟的冰霜哥布林身上带着不属于这个季节的寒气。收集寒气结晶，追查寒气的源头。',
  goals: [{ type: 'collect', key: 'q_frost_crystal', item: '寒气结晶', from: 'goblinFrost', dungeon: 'thunder_ruins', rate: 0.5, n: 5, desc: '冰霜哥布林身上的结晶，散发着刺骨的寒气。' }],
  talk: {
    offer: ['最近，雷鸣废墟的冰霜哥布林身上，总是带着一股不属于这个季节的寒气。', '寒气是从幽暗密林的方向来的——可那里，从来不下雪。', '带 5 块“寒气结晶”回来。我要弄清楚，是谁在森林里制造冬天。'],
    doing: ['冰霜哥布林……在雷鸣废墟。'],
    done: ['……这寒气里，有人类魔法的痕迹。', '幽暗密林的深处，出现了一条被冰雪封住的路——“冰霜幽暗密林”。门已经为你打开了。'],
  },
  reward: { exp: qexp(9, 0.1), gold: 800, unlock: 'frozen_woods' } });

defineQuest('q_dark_1', { type: 'hidden', story: true, chapter: '隐藏地下城 · 暗黑雷鸣废墟', name: '辛达丢失的锤子', npc: ['sinda', 'linus'], to: ['norton', 'kiri'], lvl: 14, pre: 'q_m18',
  desc: '辛达从雷鸣废墟逃出来时抓了一把会呜咽的碎石。把这块魔晶石拿给中央广场的商人诺顿鉴定。',
  talk: {
    offer: ['我逃出来的时候，只抓了一把废墟里的碎石头。可这石头有点怪——摸着冰凉，还会发出低低的呜咽声。', '中央广场的诺顿是个识货的商人，你帮我把这块魔晶石拿给他看看吧。'],
    done: ['哦？这是……让我瞧瞧。啧，这可不是普通的魔晶石。', '上面有被诅咒的痕迹。要想弄清楚，还得再找些东西来对照。'],
  },
  reward: { exp: qexp(14, 0.04), gold: 500 } });

defineQuest('q_dark_2', { type: 'hidden', story: true, chapter: '隐藏地下城 · 暗黑雷鸣废墟', name: '奇怪的石头', npc: ['norton', 'kiri'], to: ['sinda', 'linus'], lvl: 14, pre: 'q_dark_1',
  desc: '森林里一部分猫妖的牙齿被同样的诅咒侵蚀了。收集 8 颗被诅咒的前齿，交给辛达对照。',
  goals: [{ type: 'collect', key: 'q_cursed_tooth', item: '被诅咒的前齿', from: Q_CATS, dungeon: ['venom_ruins', 'dark_woods_deep', 'thunder_ruins'], rate: 0.5, n: 8, desc: '发黑的猫妖牙齿，上面爬满了诅咒的纹路。' }],
  talk: {
    offer: ['森林里的猫妖，据说有一部分牙齿被同样的诅咒侵蚀了。', '帮我收集 8 颗“被诅咒的前齿”——猫妖身上就有，猛毒雷鸣废墟的最多。', '收齐了直接拿给辛达，让他和那块石头对照一下。'],
    doing: ['被诅咒的前齿，找到了吗？'],
    done: ['一模一样……石头上的诅咒，和猫妖牙齿上的是同一种。', '诅咒的源头，就在我挖穿的那条路下面。'],
  },
  reward: { exp: qexp(14, 0.1), gold: 1200, items: [QI('crystal', 15)] } });

defineQuest('q_hidden_dark', { type: 'hidden', story: true, chapter: '隐藏地下城 · 暗黑雷鸣废墟', name: '被诅咒的废墟', npc: ['sinda', 'linus'], lvl: 15, pre: 'q_dark_2',   // 自创：官方为「暗黑雷鸣废墟」
  desc: '辛达挖穿的路在雷鸣废墟最里面，被落石挡住了。以 A 以上的评价通关雷鸣废墟，清出一条路来。',
  goals: [{ type: 'clear', dungeon: 'thunder_ruins', rank: 'A' }],
  talk: {
    offer: ['我挖穿的那条路，在雷鸣废墟的最里面，被落石挡住了。', '得先把废墟里的怪物收拾干净，才能安心搬开石头。你去雷鸣废墟好好打一场——干净利落地打（评价 A 以上），我好跟过去。'],
    doing: ['评价 A 以上！打得漂亮一点，我才敢跟过去。'],
    done: ['好样的！石头搬开了……看，那就是通往地下的路。', '“暗黑雷鸣废墟”——下面阴森森的，连雷声都透着寒意。门就在雷鸣废墟那一带，你随时可以进去。'],
  },
  reward: { exp: qexp(15, 0.1), gold: 1200, unlock: 'dark_thunder' } });
