/* =====================================================================
   魔道学者的专属转职试炼（官方剧情，docs/SKILLS_OFFICIAL_mage.md 3.4）：
   莎兰借给你《魔道学概论》，又从魔界带来四只法米利尔；试炼是收集四件实验材料，最后通关龙人之塔。
   - 接取：完成魔法师的「最后的冒险」之后，还没转职（或已经是魔道学者）
   - 官方第四件材料「睡眠眼罩」出自暗黑雷鸣废墟；本作那里是隐藏地下城（要先做完支线才能进），所以改成在龙人之塔里收集
   - 转职窗口：魔道学者的卡片写了 trial: 'q_job_witch_2'（转职窗口支持时，完成试炼才能选）
   ===================================================================== */
const WITCH_TRIAL_OK = () => !game.job || game.job === 'witch';
defineQuest('q_job_witch_1', { type: 'job', cls: 'mage', name: '魔道学概论', npc: 'sharan', lvl: 15, pre: 'q_job_mage_final', cond: WITCH_TRIAL_OK,
  desc: '莎兰借给你一本《魔道学概论》。照着书上的配方，去收集三件实验材料。',
  goals: [
    { type: 'collect', key: 'q_wt_candle', item: '永不熄灭的蜡烛', icon: 'q_wt_candle', dungeon: 'blazing_graca', rate: 0.25, desc: '烈焰格拉卡里捡到的蜡烛，怎么吹都不会灭。' },
    { type: 'collect', key: 'q_wt_ice', item: '永不融化的寒冰', icon: 'q_wt_ice', dungeon: 'frozen_woods', rate: 0.3, desc: '冰霜幽暗密林深处的寒冰，握在手里也不会化。' },
    { type: 'collect', key: 'q_wt_orb', item: '低温电光球', icon: 'q_wt_orb', dungeon: 'thunder_ruins', rate: 0.3, desc: '一颗噼啪作响、摸起来却冰凉的电光球。' }],
  talk: { offer: ['……你对那些机关、药水、会动的小东西，好像特别感兴趣？', '这本《魔道学概论》借给你。魔法不只是咒语——把魔力和炼金术、机械结合起来，也能做出了不起的东西。',
    '先照书上的配方做个实验吧：烈焰格拉卡的「永不熄灭的蜡烛」、冰霜幽暗密林的「永不融化的寒冰」、雷鸣废墟的「低温电光球」。'],
    doing: ['三件材料都齐了再来找我。书上说……嗯，最好别把蜡烛和寒冰放在同一个口袋里。'],
    done: ['都带回来了？让我看看……很好，材料都没有变质。', '最后还差一样东西，也是最难弄到的。'] },
  reward: QR(15, 0.06, 800, { items: [QI('mpM', 3)] }) });
defineQuest('q_job_witch_2', { type: 'job', cls: 'mage', name: '魔道学者的试炼', npc: 'sharan', lvl: 15, pre: 'q_job_witch_1', cond: WITCH_TRIAL_OK,
  desc: '在龙人之塔找到「睡眠眼罩」，并通关龙人之塔。完成后才能选择魔道学者。',
  goals: [
    { type: 'collect', key: 'q_wt_mask', item: '睡眠眼罩', icon: 'q_wt_mask', dungeon: 'dragon_tower', rate: 0.3, desc: '一副软绵绵的眼罩。据说戴上它，连龙人都会睡得打呼噜。' },
    { type: 'clear', dungeon: 'dragon_tower' }],
  talk: { offer: ['最后一件材料是「睡眠眼罩」——天空之城的龙人之塔里有。', '顺便把那座塔闯过去。连龙人都对付不了的话，可驾驭不了我接下来要介绍给你的小家伙们。'],
    doing: ['眼罩和龙人之塔，缺一不可。'],
    done: ['做到了呢。那么，来见见它们吧——', '这是我从魔界带来的四只法米利尔：杰克、雪人、光电鳗和夜猫。它们又可爱又柔弱，但为了帮助喜欢的人，会发挥出巨大的力量。',
      '从今往后，它们就是你的实验助手了。想好了，就在我这里完成转职吧。'] },
  reward: QR(16, 0.1, 1500, { sp: 10 }) });
