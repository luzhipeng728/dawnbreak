/* =====================================================================
   成就定义（规则与界面在 game/achieve.js、ui/social/achieve.js）
   - 六个分类：成长 / 战斗 / 收集 / 社交 / 经济 / 探索；铜 / 银 / 金三档，成就点 10 / 25 / 50
   - defineAch(id, { cat, tier, name, desc, val: X => 当前值, n: 目标（数字或函数）, reward: { cera, title, items: [[key, n]] }, cash?, online?, hidden? })
     val 里的 X：X.c 统计计数（save.data.ach.c）、X.lvl、X.codex（图鉴统计）、X.own（背包 + 仓库 + 身上的物品汇总）、X.cleared(id)、X.best 等（见 achieve.js 的 achCtx）
   - cash：商城组旧成就 CASH_ACH 的 id（并入本系统；已经领过点券的直接算达成，不重复发奖）
   - online：社交类，需要登录联机才能推进（界面上标注）
   - 称号奖励和装备深化组的称号写法一致（defineTitle，角色绑定，不能出售）
   ===================================================================== */
const ACH_TIER = [null, { name: '铜', col: '#e0935a', pts: 10 }, { name: '银', col: '#cfdbe8', pts: 25 }, { name: '金', col: '#ffd23a', pts: 50 }];
const ACH_CATS = [['grow', '成长'], ['fight', '战斗'], ['collect', '收集'], ['social', '社交'], ['econ', '经济'], ['explore', '探索']];
const ACHIEVEMENTS = {};   // id → 定义（商城组按 typeof ACHIEVEMENTS 判断新系统在不在，在就不再自己发 CASH_ACH 的点券）
// 点券奖励：商城旧成就（cash）保持原值；新成就按 ACH_CERA_MUL 缩放（和商城组的经济模拟对过：全部成就约 3.2 万点券，大头在中后期）
const ACH_CERA_MUL = 0.6;
function defineAch(id, def) {
  const A = ACHIEVEMENTS[id] = { id, n: 1, reward: {}, ...def };
  if (!A.cash && A.reward.cera) A.reward = { ...A.reward, cera: Math.max(10, Math.round(A.reward.cera * ACH_CERA_MUL / 10) * 10) };
  return A;
}

/* ---- 成就称号（角色绑定、不能出售；属性克制） ---- */
{
  const T = (key, name, lvl, rar, st, fx, desc) => defineTitle(key, { name, lvl, rar, noDrop: true, noSell: true, bind: 'char', st, fx, desc });
  T('title_ach_lvl', '传奇勇士', 30, 4, { str: 15, int: 15, vit: 15, spr: 15 }, { expUp: 0.02 }, '成就「传奇勇士」：角色达到 Lv.30。');
  T('title_ach_perfect', '完美主义者', 1, 4, { str: 14, int: 14, vit: 10, spr: 10 }, { critDmg: 0.03 }, '成就「完美主义者」：打出 20 次 SSS 评价。');
  T('title_ach_abyss', '深渊行者', 1, 4, { str: 14, int: 14, vit: 14, spr: 14 }, { dmgUp: 0.02 }, '成就「深渊行者」：通关深渊派对 30 次。');
  T('title_ach_collector', '传说收藏家', 1, 4, { str: 12, int: 12, vit: 12, spr: 12 }, { goldUp: 0.03 }, '成就「传说收藏家」：图鉴收集 30 件不同的史诗。');
  T('title_ach_smith', '神之手', 1, 4, { str: 12, int: 12, vit: 12, spr: 12 }, { hardness: 10 }, '成就「神之手」：把一件装备增幅到 +12。');
  T('title_ach_rich', '大富翁', 1, 3, { str: 10, int: 10, vit: 10, spr: 10 }, { goldUp: 0.03 }, '成就「大富翁」：同时持有 100 万金币。');
  T('title_ach_explorer', '阿拉德漫游者', 1, 3, { str: 10, int: 10, vit: 10, spr: 10 }, { mspd: 0.02 }, '成就「阿拉德漫游者」：通关全部隐藏地下城。');
  T('title_ach_duel', '决斗王', 1, 4, { str: 12, int: 12, vit: 12, spr: 12 }, { crit: 0.01, mcrit: 0.01 }, '成就「决斗王」：好友决斗胜利 30 次。');
  T('title_ach_star', '人气王', 1, 3, { str: 10, int: 10, vit: 10, spr: 10 }, { mpRegen: 0.05 }, '成就「人气王」：拥有 10 位好友。');
  T('title_ach_pillar', '公会之柱', 1, 4, { str: 12, int: 12, vit: 12, spr: 12 }, { expUp: 0.02 }, '成就「公会之柱」：累计公会贡献 5000。');
  T('title_ach_master', '成就大师', 1, 4, { str: 16, int: 16, vit: 16, spr: 16 }, { dmgUp: 0.02 }, '成就「成就大师」：成就点达到 2000。');
  // 公会商店的称号（个人贡献兑换）
  T('title_guild', '公会的荣耀', 1, 3, { str: 10, int: 10, vit: 10, spr: 10 }, { expUp: 0.02 }, '公会商店（公会 Lv.5）：用个人贡献兑换。');
  T('title_guild2', '公会的传奇', 1, 4, { str: 15, int: 15, vit: 15, spr: 15 }, { expUp: 0.02, goldUp: 0.02 }, '公会商店（公会 Lv.9）：用个人贡献兑换。');
}

/* ---- 写定义用的小工具 ---- */
const achQuestN = type => () => Object.values(QUESTS).filter(q => q.type === type).length;
const achDgIds = (pred) => Object.values(DUNGEONS).filter(d => d && !d.abyss && pred(d)).map(d => d.id);
const ACH_AREA = {
  lorien: ['lorien', 'lorien_deep'],
  gf: ['dark_woods', 'dark_woods_deep', 'thunder_ruins', 'venom_ruins', 'graca', 'blazing_graca'],
  sky: ['dragon_tower', 'puppet_hall', 'golem_tower', 'dark_corridor', 'lord_palace'],
  behemoth: ['temple_outskirts', 'treant_jungle', 'purgatory', 'polar_day', 'second_spine'],
};
const achHas = ids => ids.filter(id => DUNGEONS[id]);
const R = (cera, extra = {}) => ({ cera, ...extra });

/* ================= 成长 ================= */
for (const [lv, tier, name, rw] of [[5, 1, '初露锋芒', R(50)], [10, 1, '小有所成', R(80, { items: [['fatigue', 1]] })], [15, 1, '独当一面', R(100)], [20, 2, '身经百战', R(200, { items: [['guard', 1]] })], [25, 2, '名震阿拉德', R(300)], [30, 3, '传奇勇士', R(600, { title: 'title_ach_lvl' })]])
  defineAch('lvl' + lv, { cat: 'grow', tier, name, desc: `角色达到 Lv.${lv}`, val: X => X.lvl, n: lv, reward: rw });
defineAch('job', { cat: 'grow', tier: 1, name: '新的道路', desc: '完成转职', val: X => (X.job ? 1 : 0), reward: R(500), cash: 'job' });
defineAch('awaken', { cat: 'grow', tier: 2, name: '觉醒', desc: '解锁觉醒技能', val: X => (X.awaken ? 1 : 0), reward: R(1000), cash: 'awaken' });
defineAch('skill10', { cat: 'grow', tier: 1, name: '技能研究者', desc: '学会 10 个技能', val: X => X.skills, n: 10, reward: R(50) });
defineAch('skillmax3', { cat: 'grow', tier: 2, name: '专精', desc: '把 3 个技能升到满级', val: X => X.skillsMax, n: 3, reward: R(150) });
defineAch('main10', { cat: 'grow', tier: 1, name: '故事的开端', desc: '完成 10 个主线任务', val: X => X.quest('main'), n: 10, reward: R(80) });
defineAch('main30', { cat: 'grow', tier: 2, name: '命运的齿轮', desc: '完成 30 个主线任务', val: X => X.quest('main'), n: 30, reward: R(250) });
defineAch('mainAll', { cat: 'grow', tier: 3, name: '阿拉德的传说', desc: '完成全部主线任务', val: X => X.quest('main'), n: achQuestN('main'), reward: R(800, { items: [['box_magic', 2]] }) });
defineAch('side10', { cat: 'grow', tier: 1, name: '热心肠', desc: '完成 10 个支线任务', val: X => X.quest('side'), n: 10, reward: R(60) });
defineAch('side30', { cat: 'grow', tier: 2, name: '有求必应', desc: '完成 30 个支线任务', val: X => X.quest('side'), n: 30, reward: R(200) });
defineAch('hidden3', { cat: 'grow', tier: 2, name: '秘密的守护者', desc: '完成 3 个隐藏任务', val: X => X.quest('hidden'), n: 3, reward: R(200) });
defineAch('hiddenAll', { cat: 'grow', tier: 3, name: '真相只有一个', desc: '完成全部隐藏任务', val: X => X.quest('hidden'), n: achQuestN('hidden'), reward: R(600) });
defineAch('daily10', { cat: 'grow', tier: 1, name: '每日功课', desc: '累计完成 10 个每日任务', val: X => X.c.daily || 0, n: 10, reward: R(60) });
defineAch('daily50', { cat: 'grow', tier: 2, name: '持之以恒', desc: '累计完成 50 个每日任务', val: X => X.c.daily || 0, n: 50, reward: R(200, { items: [['fatigue', 2]] }) });
defineAch('daily200', { cat: 'grow', tier: 3, name: '风雨无阻', desc: '累计完成 200 个每日任务', val: X => X.c.daily || 0, n: 200, reward: R(600) });
defineAch('play10h', { cat: 'grow', tier: 1, name: '沉浸其中', desc: '游戏时间累计 10 小时', val: X => Math.floor(X.playH), n: 10, reward: R(80) });
defineAch('play50h', { cat: 'grow', tier: 2, name: '阿拉德的居民', desc: '游戏时间累计 50 小时', val: X => Math.floor(X.playH), n: 50, reward: R(250) });
defineAch('chars3', { cat: 'grow', tier: 1, name: '多面手', desc: '创建 3 个角色', val: X => X.chars, n: 3, reward: R(80) });
defineAch('pts500', { cat: 'grow', tier: 1, name: '成就收集者', desc: '成就点达到 500', val: X => X.pts, n: 500, reward: R(100) });
defineAch('pts1000', { cat: 'grow', tier: 2, name: '成就猎人', desc: '成就点达到 1000', val: X => X.pts, n: 1000, reward: R(300) });
defineAch('pts2000', { cat: 'grow', tier: 3, name: '成就大师', desc: '成就点达到 2000', val: X => X.pts, n: 2000, reward: R(800, { title: 'title_ach_master' }) });

/* ================= 战斗 ================= */
defineAch('kill500', { cat: 'fight', tier: 1, name: '百战勇士', desc: '累计击杀 500 只怪物', val: X => X.c.kill || 0, n: 500, reward: R(200), cash: 'kill500' });
defineAch('kill3000', { cat: 'fight', tier: 2, name: '千人斩', desc: '累计击杀 3000 只怪物', val: X => X.c.kill || 0, n: 3000, reward: R(600), cash: 'kill3000' });
defineAch('kill10000', { cat: 'fight', tier: 3, name: '万夫莫敌', desc: '累计击杀 10000 只怪物', val: X => X.c.kill || 0, n: 10000, reward: R(1500), cash: 'kill10000' });
defineAch('boss10', { cat: 'fight', tier: 1, name: '领主猎手', desc: '击败 10 次地下城领主', val: X => X.c.boss || 0, n: 10, reward: R(60) });
defineAch('boss100', { cat: 'fight', tier: 2, name: '领主克星', desc: '击败 100 次地下城领主', val: X => X.c.boss || 0, n: 100, reward: R(250) });
defineAch('boss500', { cat: 'fight', tier: 3, name: '王者之师', desc: '击败 500 次地下城领主', val: X => X.c.boss || 0, n: 500, reward: R(800, { items: [['tk_enh7', 1]] }) });
defineAch('elite50', { cat: 'fight', tier: 1, name: '精英克星', desc: '击败 50 只精英怪', val: X => X.c.elite || 0, n: 50, reward: R(60) });
defineAch('clear10', { cat: 'fight', tier: 1, name: '初次冒险', desc: '累计通关 10 次地下城', val: X => X.c.clear || 0, n: 10, reward: R(50) });
defineAch('clear50', { cat: 'fight', tier: 2, name: '地下城常客', desc: '累计通关 50 次地下城', val: X => X.c.clear || 0, n: 50, reward: R(500), cash: 'clear50' });
defineAch('clear200', { cat: 'fight', tier: 3, name: '老练的冒险家', desc: '累计通关 200 次地下城', val: X => X.c.clear || 0, n: 200, reward: R(1500), cash: 'clear200' });
defineAch('sss', { cat: 'fight', tier: 2, name: '完美演出', desc: '打出 SSS 评价', val: X => X.c.sss || 0, reward: R(500), cash: 'sss' });
defineAch('sss20', { cat: 'fight', tier: 3, name: '完美主义者', desc: '累计打出 20 次 SSS 评价', val: X => X.c.sss || 0, n: 20, reward: R(600, { title: 'title_ach_perfect' }) });
defineAch('rankS50', { cat: 'fight', tier: 2, name: '华丽的战斗', desc: '累计 50 次以 S 以上评价通关', val: X => X.c.splus || 0, n: 50, reward: R(200) });
defineAch('nohit', { cat: 'fight', tier: 2, name: '毫发无伤', desc: '一次也没被打中就通关地下城（Lv.5 以上的地下城）', val: X => X.c.nohit || 0, reward: R(200) });
defineAch('nohit10', { cat: 'fight', tier: 3, name: '闪避大师', desc: '累计 10 次零受击通关（Lv.5 以上的地下城）', val: X => X.c.nohit || 0, n: 10, reward: R(600) });
defineAch('combo50', { cat: 'fight', tier: 1, name: '连击达人', desc: '单次地下城最高连击达到 50', val: X => X.c.combo || 0, n: 50, reward: R(60) });
defineAch('combo150', { cat: 'fight', tier: 2, name: '连击之王', desc: '单次地下城最高连击达到 150', val: X => X.c.combo || 0, n: 150, reward: R(250) });
defineAch('fast', { cat: 'fight', tier: 2, name: '疾风迅雷', desc: '60 秒内通关一个 Lv.10 以上的地下城', val: X => X.c.fast || 0, reward: R(250) });
defineAch('diff1', { cat: 'fight', tier: 1, name: '冒险开始', desc: '以冒险难度通关地下城', val: X => X.c.d1 || 0, reward: R(60) });
defineAch('diff2', { cat: 'fight', tier: 2, name: '勇士之证', desc: '以勇士难度通关地下城', val: X => X.c.d2 || 0, reward: R(200) });
defineAch('diff3', { cat: 'fight', tier: 3, name: '王者降临', desc: '以王者难度通关地下城', val: X => X.c.d3 || 0, reward: R(600, { items: [['box_magic', 1]] }) });
defineAch('abyss1', { cat: 'fight', tier: 2, name: '深渊的邀请', desc: '通关深渊派对', val: X => X.c.abyss || 0, reward: R(200) });
defineAch('abyss30', { cat: 'fight', tier: 3, name: '深渊行者', desc: '累计通关深渊派对 30 次', val: X => X.c.abyss || 0, n: 30, reward: R(800, { title: 'title_ach_abyss' }) });
defineAch('death10', { cat: 'fight', tier: 1, name: '屡败屡战', desc: '在地下城里倒下 10 次（没关系，站起来就好）', val: X => X.c.death || 0, n: 10, reward: R(30, { items: [['coin', 2]] }) });
// 讨伐：每个地下城的领主一个成就（天帷巨兽合并后自动出现）
for (const D of Object.values(DUNGEONS)) {
  if (!D || D.abyss || !D.boss || !MON[D.boss.kind]) continue;
  const nm = MON[D.boss.kind].name;
  defineAch('boss_' + D.id, { cat: 'fight', tier: D.hidden || D.lvl[0] >= 20 ? 2 : 1, name: `讨伐：${nm}`, desc: `在${D.name}击败领主${nm}`, val: X => X.bossK(D.boss.kind, D.id), reward: R(D.hidden || D.lvl[0] >= 20 ? 150 : Math.min(100, 30 + D.lvl[0] * 4)) });
}

/* ================= 收集 ================= */
defineAch('epic', { cat: 'collect', tier: 2, name: '天选之人', desc: '第一次获得史诗装备', val: X => Math.max(X.c.epic || 0, X.codex.epic), reward: R(1000), cash: 'epic' });
defineAch('codex5', { cat: 'collect', tier: 1, name: '史诗收藏者', desc: '装备图鉴收集 5 件不同的史诗', val: X => X.codex.epic, n: 5, reward: R(100) });
defineAch('codex15', { cat: 'collect', tier: 2, name: '史诗鉴赏家', desc: '装备图鉴收集 15 件不同的史诗', val: X => X.codex.epic, n: 15, reward: R(300) });
defineAch('codex30', { cat: 'collect', tier: 3, name: '传说收藏家', desc: '装备图鉴收集 30 件不同的史诗', val: X => X.codex.epic, n: 30, reward: R(800, { title: 'title_ach_collector' }) });
defineAch('codex60', { cat: 'collect', tier: 3, name: '阿拉德博物馆', desc: '装备图鉴收集 60 件不同的史诗', val: X => X.codex.epic, n: 60, reward: R(1000, { items: [['box_magic', 3]] }) });
defineAch('legend5', { cat: 'collect', tier: 1, name: '传说的碎片', desc: '装备图鉴收集 5 件传说装备', val: X => X.codex.legend, n: 5, reward: R(80) });
defineAch('legend15', { cat: 'collect', tier: 2, name: '传说的回响', desc: '装备图鉴收集 15 件传说装备', val: X => X.codex.legend, n: 15, reward: R(250) });
defineAch('set1', { cat: 'collect', tier: 2, name: '套装达人', desc: '装备图鉴集齐 1 套史诗套装', val: X => X.codex.set, reward: R(300) });
defineAch('set3', { cat: 'collect', tier: 3, name: '套装大师', desc: '装备图鉴集齐 3 套史诗套装', val: X => X.codex.set, n: 3, reward: R(800) });
defineAch('artifact10', { cat: 'collect', tier: 1, name: '神器猎人', desc: '装备图鉴收集 10 件神器套装部件', val: X => X.codex.artifact || 0, n: 10, reward: R(80) });
defineAch('abyssEpic', { cat: 'collect', tier: 2, name: '深渊的馈赠', desc: '在深渊派对里获得史诗', val: X => X.codex.abyssEpic || 0, reward: R(300) });
defineAch('abyssEpic5', { cat: 'collect', tier: 3, name: '深渊宠儿', desc: '在深渊派对里获得 5 件不同的史诗', val: X => X.codex.abyssEpic || 0, n: 5, reward: R(800) });
defineAch('title3', { cat: 'collect', tier: 1, name: '头衔', desc: '拥有 3 个不同的称号', val: X => X.own.titles, n: 3, reward: R(60) });
defineAch('title8', { cat: 'collect', tier: 2, name: '名号满天下', desc: '拥有 8 个不同的称号', val: X => X.own.titles, n: 8, reward: R(200) });
defineAch('title15', { cat: 'collect', tier: 3, name: '称号收藏家', desc: '拥有 15 个不同的称号', val: X => X.own.titles, n: 15, reward: R(600) });
defineAch('avatar8', { cat: 'collect', tier: 1, name: '时尚达人', desc: '拥有 8 件时装', val: X => X.own.avatars, n: 8, reward: R(80) });
defineAch('avatarSet', { cat: 'collect', tier: 2, name: '全套穿搭', desc: '集齐一整套时装（8 件）', val: X => X.own.avatarSet, n: 8, reward: R(250) });
defineAch('sky', { cat: 'collect', tier: 3, name: '天空之上', desc: '第一次合成出稀有装扮', val: X => X.c.sky || 0, reward: R(1000), cash: 'sky' });
defineAch('pet', { cat: 'collect', tier: 1, name: '形影不离', desc: '拥有宠物', val: X => X.own.pets, reward: R(80) });
defineAch('aura', { cat: 'collect', tier: 1, name: '光芒四射', desc: '拥有光环', val: X => X.own.auras, reward: R(80) });
defineAch('card10', { cat: 'collect', tier: 1, name: '卡片收集', desc: '拥有 10 种不同的怪物卡片', val: X => X.own.cards, n: 10, reward: R(80) });
defineAch('score', { cat: 'collect', tier: 2, name: '全副武装', desc: '装备评分达到 3000', val: X => X.score, n: 3000, reward: R(200) });
defineAch('score2', { cat: 'collect', tier: 3, name: '神装在身', desc: '装备评分达到 8000', val: X => X.score, n: 8000, reward: R(600) });

/* ================= 社交（登录后） ================= */
defineAch('friend1', { cat: 'social', tier: 1, name: '结交好友', desc: '拥有 1 位好友', val: X => X.c.friends || 0, reward: R(50), online: true });
defineAch('friend5', { cat: 'social', tier: 2, name: '朋友满天下', desc: '拥有 5 位好友', val: X => X.c.friends || 0, n: 5, reward: R(200), online: true });
defineAch('friend10', { cat: 'social', tier: 3, name: '人气王', desc: '拥有 10 位好友', val: X => X.c.friends || 0, n: 10, reward: R(500, { title: 'title_ach_star' }), online: true });
defineAch('coop1', { cat: 'social', tier: 1, name: '并肩作战', desc: '组队通关地下城', val: X => X.c.coop || 0, reward: R(80), online: true });
defineAch('coop20', { cat: 'social', tier: 2, name: '默契搭档', desc: '组队通关 20 次地下城', val: X => X.c.coop || 0, n: 20, reward: R(250), online: true });
defineAch('coop100', { cat: 'social', tier: 3, name: '生死之交', desc: '组队通关 100 次地下城', val: X => X.c.coop || 0, n: 100, reward: R(700), online: true });
defineAch('coop4', { cat: 'social', tier: 2, name: '四人成行', desc: '4 人满员组队通关地下城', val: X => X.c.coop4 || 0, reward: R(200), online: true });
defineAch('duel1', { cat: 'social', tier: 1, name: '切磋', desc: '和好友决斗一次', val: X => X.c.duel || 0, reward: R(50), online: true });
defineAch('duelWin10', { cat: 'social', tier: 2, name: '决斗高手', desc: '好友决斗胜利 10 次', val: X => X.c.duelWin || 0, n: 10, reward: R(250), online: true });
defineAch('duelWin30', { cat: 'social', tier: 3, name: '决斗王', desc: '好友决斗胜利 30 次', val: X => X.c.duelWin || 0, n: 30, reward: R(600, { title: 'title_ach_duel' }), online: true });
defineAch('guildJoin', { cat: 'social', tier: 1, name: '有家可归', desc: '加入公会', val: X => X.c.guildJoin || 0, reward: R(80), online: true });
defineAch('guildLead', { cat: 'social', tier: 2, name: '一会之长', desc: '创建公会', val: X => X.c.guildLead || 0, reward: R(200), online: true });
defineAch('guildLv5', { cat: 'social', tier: 2, name: '公会壮大', desc: '所在公会达到 Lv.5', val: X => X.c.guildLvl || 0, n: 5, reward: R(250), online: true });
defineAch('guildLv10', { cat: 'social', tier: 3, name: '公会鼎盛', desc: '所在公会达到 Lv.10', val: X => X.c.guildLvl || 0, n: 10, reward: R(800), online: true });
defineAch('contrib1000', { cat: 'social', tier: 2, name: '公会骨干', desc: '累计公会贡献 1000', val: X => X.c.guildContrib || 0, n: 1000, reward: R(250), online: true });
defineAch('contrib5000', { cat: 'social', tier: 3, name: '公会之柱', desc: '累计公会贡献 5000', val: X => X.c.guildContrib || 0, n: 5000, reward: R(600, { title: 'title_ach_pillar' }), online: true });
defineAch('mail1', { cat: 'social', tier: 1, name: '见字如面', desc: '给好友寄一封信', val: X => X.c.mailSent || 0, reward: R(50), online: true });
defineAch('chat1', { cat: 'social', tier: 1, name: '打个招呼', desc: '在聊天频道里发言', val: X => X.c.chat || 0, reward: R(30), online: true });
defineAch('signin7', { cat: 'social', tier: 1, name: '常来看看', desc: '累计签到 7 天', val: X => X.c.signin || 0, n: 7, reward: R(80), online: true });
defineAch('signin30', { cat: 'social', tier: 2, name: '老朋友', desc: '累计签到 30 天', val: X => X.c.signin || 0, n: 30, reward: R(300), online: true });
defineAch('streak14', { cat: 'social', tier: 3, name: '一天不落', desc: '连续签到 14 天', val: X => X.c.streak || 0, n: 14, reward: R(500), online: true });

/* ================= 经济 ================= */
defineAch('enh7', { cat: 'econ', tier: 1, name: '锋芒初露', desc: '强化成功到 +7', val: X => X.c.enhMax || 0, n: 7, reward: R(300), cash: 'enh7' });
defineAch('enh10', { cat: 'econ', tier: 2, name: '神兵利器', desc: '强化成功到 +10', val: X => X.c.enhMax || 0, n: 10, reward: R(800), cash: 'enh10' });
defineAch('enh12', { cat: 'econ', tier: 3, name: '登峰造极', desc: '强化成功到 +12', val: X => X.c.enhMax || 0, n: 12, reward: R(2000), cash: 'enh12' });
defineAch('enhTry50', { cat: 'econ', tier: 1, name: '敲敲打打', desc: '累计强化 50 次', val: X => X.c.enhTry || 0, n: 50, reward: R(60) });
defineAch('broken', { cat: 'econ', tier: 1, name: '心碎时刻', desc: '强化失败，装备破碎了……', val: X => X.c.broken || 0, reward: R(100, { items: [['guard', 1]] }), hidden: true });
defineAch('amp7', { cat: 'econ', tier: 1, name: '异界之力', desc: '增幅成功到 +7', val: X => X.c.ampMax || 0, n: 7, reward: R(150) });
defineAch('amp10', { cat: 'econ', tier: 2, name: '红字装备', desc: '增幅成功到 +10', val: X => X.c.ampMax || 0, n: 10, reward: R(500) });
defineAch('amp12', { cat: 'econ', tier: 3, name: '神之手', desc: '增幅成功到 +12', val: X => X.c.ampMax || 0, n: 12, reward: R(1000, { title: 'title_ach_smith' }) });
defineAch('forge3', { cat: 'econ', tier: 1, name: '千锤百炼', desc: '锻造成功到 +3', val: X => X.c.forgeMax || 0, n: 3, reward: R(80) });
defineAch('forge6', { cat: 'econ', tier: 2, name: '锻造名匠', desc: '锻造成功到 +6', val: X => X.c.forgeMax || 0, n: 6, reward: R(300) });
defineAch('enchant1', { cat: 'econ', tier: 1, name: '附魔入门', desc: '给装备附魔', val: X => X.c.enchant || 0, reward: R(60) });
defineAch('enchant10', { cat: 'econ', tier: 2, name: '附魔师', desc: '累计附魔 10 次', val: X => X.c.enchant || 0, n: 10, reward: R(200) });
defineAch('box', { cat: 'econ', tier: 1, name: '开箱达人', desc: '第一次打开魔盒', val: X => X.c.box || 0, reward: R(100), cash: 'box' });
defineAch('box50', { cat: 'econ', tier: 2, name: '开箱狂人', desc: '累计打开 50 个箱子', val: X => X.c.boxAll || 0, n: 50, reward: R(200) });
defineAch('cash1', { cat: 'econ', tier: 1, name: '光顾商城', desc: '在破晓商城用点券购物', val: X => X.c.cashBuy || 0, reward: R(50) });
defineAch('cash10k', { cat: 'econ', tier: 2, name: '商城贵宾', desc: '在商城累计消费 10000 点券', val: X => X.c.cashSpent || 0, n: 10000, reward: R(500) });
defineAch('auction1', { cat: 'econ', tier: 1, name: '初次上架', desc: '在拍卖行上架物品', val: X => X.c.aucList || 0, reward: R(50), online: true });
defineAch('auctionBuy', { cat: 'econ', tier: 1, name: '捡漏', desc: '在拍卖行买到物品', val: X => X.c.aucBuy || 0, reward: R(50), online: true });
defineAch('auctionSold10', { cat: 'econ', tier: 2, name: '生意兴隆', desc: '在拍卖行卖出 10 件物品', val: X => X.c.aucSold || 0, n: 10, reward: R(250), online: true });
defineAch('gold100k', { cat: 'econ', tier: 1, name: '小有积蓄', desc: '同时持有 10 万金币', val: X => X.c.goldMax || 0, n: 100000, reward: R(80) });
defineAch('gold1m', { cat: 'econ', tier: 3, name: '大富翁', desc: '同时持有 100 万金币', val: X => X.c.goldMax || 0, n: 1000000, reward: R(600, { title: 'title_ach_rich' }) });
defineAch('dis100', { cat: 'econ', tier: 2, name: '拆解专家', desc: '累计分解 100 件装备', val: X => X.c.dis || 0, n: 100, reward: R(200) });
defineAch('sell100', { cat: 'econ', tier: 1, name: '精打细算', desc: '累计向商店出售 100 件物品', val: X => X.c.sell || 0, n: 100, reward: R(60) });
defineAch('repair20', { cat: 'econ', tier: 1, name: '爱惜装备', desc: '修理装备 20 次', val: X => X.c.repair || 0, n: 20, reward: R(50) });

/* ================= 探索 ================= */
defineAch('scene5', { cat: 'explore', tier: 1, name: '出门看看', desc: '去过 5 个不同的地方', val: X => X.seen, n: 5, reward: R(50) });
defineAch('sceneAll', { cat: 'explore', tier: 2, name: '足迹遍布', desc: '去过所有的城镇和区域', val: X => X.seen, n: () => Object.keys(SCENES).length, reward: R(300) });
defineAch('npc20', { cat: 'explore', tier: 1, name: '社交达人', desc: '和 20 位不同的 NPC 对话', val: X => X.npcs, n: 20, reward: R(60) });
defineAch('npcAll', { cat: 'explore', tier: 2, name: '阿拉德百事通', desc: '和所有 NPC 都说过话', val: X => X.npcs, n: () => Object.keys(NPCS).length, reward: R(250) });
defineAch('dg10', { cat: 'explore', tier: 1, name: '地下城探险家', desc: '通关 10 个不同的地下城', val: X => X.dgCleared, n: 10, reward: R(100) });
defineAch('dgAll', { cat: 'explore', tier: 3, name: '征服者', desc: '通关所有的地下城（不含深渊）', val: X => X.dgCleared, n: () => achDgIds(() => true).length, reward: R(800, { items: [['box_magic', 2]] }) });
defineAch('area_lorien', { cat: 'explore', tier: 1, name: '洛兰的朋友', desc: '通关洛兰的全部地下城', val: X => X.clearedOf(ACH_AREA.lorien), n: ACH_AREA.lorien.length, reward: R(50) });
defineAch('area_gf', { cat: 'explore', tier: 2, name: '格兰之森的解放者', desc: '通关格兰之森的全部普通地下城', val: X => X.clearedOf(ACH_AREA.gf), n: ACH_AREA.gf.length, reward: R(200) });
defineAch('area_sky', { cat: 'explore', tier: 2, name: '登上天空之城', desc: '通关天空之城的全部普通地下城', val: X => X.clearedOf(ACH_AREA.sky), n: ACH_AREA.sky.length, reward: R(300) });
if (achHas(ACH_AREA.behemoth).length === ACH_AREA.behemoth.length) defineAch('area_behemoth', { cat: 'explore', tier: 3, name: '征服天帷巨兽', desc: '通关天帷巨兽的全部普通地下城', val: X => X.clearedOf(ACH_AREA.behemoth), n: ACH_AREA.behemoth.length, reward: R(600) });
const ACH_HIDDEN = () => achDgIds(d => d.hidden);
for (const D of Object.values(DUNGEONS)) if (D && D.hidden && !D.abyss) defineAch('hid_' + D.id, { cat: 'explore', tier: D.lvl[0] >= 20 ? 3 : 2, name: `秘境：${D.name}`, desc: `通关隐藏地下城「${D.name}」`, val: X => (X.cleared(D.id) ? 1 : 0), reward: R(D.lvl[0] >= 20 ? 500 : 250), hidden: true });
defineAch('hiddenDgAll', { cat: 'explore', tier: 3, name: '阿拉德漫游者', desc: '通关全部隐藏地下城', val: X => X.clearedOf(ACH_HIDDEN()), n: () => ACH_HIDDEN().length, reward: R(800, { title: 'title_ach_explorer' }) });
defineAch('firstLord', { cat: 'explore', tier: 2, name: '天空之城的见证者', desc: '通关城主宫殿', val: X => (X.cleared('lord_palace') ? 1 : 0), reward: R(200) });
defineAch('seria', { cat: 'explore', tier: 1, name: '回到原点', desc: '回到赛丽亚的房间', val: X => (X.seenId('seria_room') ? 1 : 0), reward: R(20), hidden: true });
