/* =====================================================================
   每日任务：每天 06:00 重置（questsDailyReset）。经典期格兰之森叫“重复任务”，名字沿用官方的重复任务
   经验奖励按玩家当前等级计算（expFrac）
   ===================================================================== */
defineQuest('d_seria_help', { type: 'daily', name: '赛丽亚的帮助', npc: 'seria', lvl: 5,
  desc: '赛丽亚每天都在为冒险家们祈祷。通关任意地下城 2 次，让她安心。',
  goals: [{ type: 'clear', dungeon: 'any', n: 2 }],
  talk: { offer: ['今天也要去冒险吗？', '那……答应我，平平安安地通关 2 次地下城再回来，好吗？我会准备好药等你。'], doing: ['要平平安安的哦。'], done: ['欢迎回来！今天也辛苦了。这些药你收好。'] },
  reward: { expFrac: 0.12, gold: 800, items: [QI('hpM', 3), QI('mpM', 2)] } });

defineQuest('d_old_iron', { type: 'daily', name: '收集古铁', npc: 'roget', lvl: 6,
  desc: '罗杰每天都收购生锈的铁片。打倒怪物有几率找到。',
  goals: [{ type: 'collect', key: 'q_rusty_iron', item: '生锈的铁片', rate: 0.3, n: 8, desc: '锈迹斑斑的铁片，回炉后还能用。' }],
  talk: { offer: ['老规矩，今天也收生锈的铁片！', '格兰之森的怪物身上常带着些破铜烂铁，给我 8 片，换你一把晶块。'], done: ['好铁！回炉以后又是一块好料。拿去吧！'] },
  reward: { expFrac: 0.1, gold: 600, items: [QI('crystal', 10)] } });

defineQuest('d_beer', { type: 'daily', name: '缺少啤酒材料', npc: ['tuguan', 'linus'], lvl: 5,
  desc: '酿啤酒需要清凉的罗荆果。格兰之森的怪物常偷吃它们。',
  goals: [{ type: 'collect', key: 'q_rojing', item: '清凉的罗荆果', rate: 0.3, n: 6, desc: '咬一口透心凉的小果子，是酿啤酒的关键。' }],
  talk: { offer: ['今天的啤酒又不够卖了！', '清凉的罗荆果，6 个！怪物们老偷吃这玩意儿，打倒它们就能找到。'], done: ['冰冰凉凉！今晚的啤酒有着落了！'] },
  reward: { expFrac: 0.1, gold: 1200, items: [QI('hpS', 5)] } });

defineQuest('d_bounty', { type: 'daily', name: '布告栏的悬赏', npc: ['board', 'skadi'], lvl: 8,
  desc: '【每日悬赏】击败 2 只地下城领主。',
  goals: [{ type: 'kill', boss: true, n: 2, text: '击败地下城领主' }],
  talk: { offer: ['【布告栏 · 每日悬赏】', '格兰之森各地的领主威胁着往来行人的安全。击败任意 2 只领主，可领取赏金与复活币一枚。'], done: ['【布告栏】今日悬赏已完成，赏金已发放。'] },
  reward: { expFrac: 0.15, gold: 1500, coins: 1 } });

defineQuest('d_gsd_eye', { type: 'daily', name: '心眼的修行', npc: 'gsd', lvl: 10,
  desc: 'G.S.D 的每日修行：以 A 以上的评价通关任意地下城。',
  goals: [{ type: 'clear', dungeon: 'any', rank: 'A' }],
  talk: { offer: ['修行，一天都不能停。', '今天，以 A 以上的评价穿过任意一个地下城。'], done: ['……今天的你，比昨天更近了一步。'] },
  reward: { expFrac: 0.18, gold: 1000 } });
