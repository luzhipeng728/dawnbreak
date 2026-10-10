/* =====================================================================
   奥兹玛攻坚战 → 团本体系的接入层（docs/RAID_OZMA.md §4~§7；框架见 docs/RAID_FRAMEWORK.md）
   - 地图 / 门将 / 领主清单仍是 ozma_core.js 的 OZMA_CORE.CONTENT；会话、分队、计时、倒计时 / 功能图 / 钥匙图、理智值 / 混沌等级、翻牌 / 奖励 / 拾取分配 一律走 raid_core.js，
     服务端 server/modules/raid.js 托管同一份文件。这个文件把清单翻译成 RAID_DEFS.ozma（节点图 + 规则参数 + 奖励表），登记进 RAID_CORE。
   - 加载顺序：ozma_core.js → raid_core.js → raid_ozma.js（src/ORDER；服务端 loadRaidCore 同序加载，在 node:vm 里没有别的全局，所以奖励 key 直接写在这里）。
   - 三档：guide 单人引导（1 队，删去功能图 / 倒计时图，混沌固定 1，奥兹玛不锁血）/ duo 两人（每人一队，血量 ×0.6）/ team 多队（12 人 3 队，每队 4 人）。
   - 领主机制 / 精英 / 理智 HUD 是客户端内容：src/content/raids/ozma_raid.js、src/ui/raid_ozma.js。
   ===================================================================== */
const RAID_OZMA = (() => {
  if (typeof OZMA_CORE === 'undefined' || typeof RAID_DEFS === 'undefined') return null;
  const O = OZMA_CORE, C = O.CONTENT, nodes1 = {}, nodes2 = {};
  // 阶段 1：三大区域各一条地图链（每区 5 张）：钥匙图 → 两张主线图（其中一张是「双剑图」，通关混沌等级 +1）+ 一张功能图 → 主领主（拿到钥匙才进）。
  //   毁灭 = 红：亡者回廊（全团打领主伤害 +12%）、双剑图 = 欢愉之阿斯特罗斯 · 主领主 = 贝利亚斯
  //   绝望 = 蓝紫：赛赫（理智上限 +30、恢复）、主领主 = 提亚马特
  //   恐怖 = 黑绿：赤红乐园祭坛（解除卡赞无敌）、双剑图 = 艾德菲尔 · 主领主 = 卡赞（要钥匙 + 祭坛）【原创：区域—领主 / 功能图归属官方未核实】
  const LORD = {
    ruin: { key: ['ruin_path', 'ruin'], mains: ['ruin_resting', 'ruin_gladden'], sword: 'ruin_gladden', func: 'ruin_corridor', lord: 'ruin_beyond', name: '贝利亚斯' },
    despair: { key: ['despair_crossroads', 'despair'], mains: ['despair_aventus', 'despair_phylis'], sword: null, func: 'despair_serha', lord: 'despair_lunen', name: '提亚马特' },
    terror: { key: ['terror_land', 'terror'], mains: ['terror_grauben', 'terror_eldfell'], sword: 'terror_eldfell', func: 'terror_red_altar', lord: 'terror_martyr', name: '卡赞' },
  };
  const FUNC_FX = {
    ruin_corridor: { kind: 'gbuff', id: 'dead_hall', p: { dmgTaken: 1.12 }, dur: 0, text: '亡者回廊通关：全团对领主的伤害 +12%' },
    despair_serha: { kind: 'gbuff', id: 'serha', p: { sanMax: 30, sanRegen: 1 }, dur: 0, text: '赛赫通关：理智上限 +30，理智缓慢恢复' },
    terror_red_altar: { kind: 'key', id: 'altar', text: '赤红乐园祭坛点亮：卡赞的无敌解除了' },
  };
  const ELITE_OF = { ruin: 'ozEliteRuin', despair: 'ozEliteDespair', terror: 'ozEliteTerror' };
  O.REGIONS.forEach((rid, ri) => {
    const L = LORD[rid], X = 0.17 + ri * 0.33, at = (id, y, dx = 0) => ({ pos: [X + dx, y], dg: 'ozma_' + id, boss: id });
    const nm = id => O.MAP_BY_ID[id].name, pathId = L.key[0], gate = { [ELITE_OF[rid]]: { fx: [{ kind: 'sanity', v: 10, text: '门将倒下：全团理智 +10' }] } };
    nodes1[pathId] = { name: nm(pathId) + '（钥匙图）', type: 'key', area: ri + 1, need: [], ...at(pathId, 0.1), fx: { clear: [{ kind: 'key', id: L.key[1], text: `${C.areas[rid].name}的钥匙到手了` }] }, elites: gate, guide: { name: nm(pathId) + '（钥匙图）' } };
    L.mains.forEach((id, k) => {
      const sword = id === L.sword;
      nodes1[id] = { name: nm(id) + (sword ? '（双剑图）' : ''), type: 'main', area: ri + 1, need: [pathId], ...at(id, 0.3 + k * 0.2),
        ...(sword ? { fx: { clear: [{ kind: 'chaos', v: 1, text: '双剑图通关：混沌等级 +1（奖励更多，敌人更强）' }] } } : {}), elites: gate, guide: k ? false : { need: [pathId] } };
    });
    nodes1[L.func] = { name: nm(L.func) + '（功能图）', type: 'func', area: ri + 1, need: [pathId], respawn: 0, ...at(L.func, 0.7), fx: { clear: [FUNC_FX[L.func]] }, elites: gate, guide: false };
    nodes1[L.lord] = { name: nm(L.lord) + ` · ${L.name}`, type: 'main', area: ri + 1, need: L.mains.concat(), needKey: [L.key[1], ...(rid === 'terror' ? ['altar'] : [])], ...at(L.lord, 0.9), cp: true, elites: gate,
      guide: { need: [L.mains[0]], needKey: [L.key[1]] } };
  });
  const last = rid => LORD[rid].lord;
  // 阶段 2：奥兹玛（共享血量存档点，50% 锁血，要阿斯特罗斯倒下才解）/ 埃利诺斯倒计时 / 阿斯特罗斯；三队轮转：奥兹玛 → 埃利诺斯（清夜）→ 奥兹玛 → 阿斯特罗斯 → 奥兹玛【存疑：清夜官方含义未核实】
  nodes2.p2_elerinon = { name: '埃利诺斯 · 倒计时', type: 'timer', area: 1, pos: [0.22, 0.25], need: [], timer: 420, repair: 150, dg: 'ozma_p2_elerinon', boss: 'p2_elerinon',
    fx: { clear: [{ kind: 'gbuff', id: 'elerinon_sup', p: { dmgTaken: 1.15 }, dur: 150, text: '埃利诺斯被压制：全团对领主的伤害 +15%（150 秒）' }],
      expire: [{ kind: 'reset', areas: [1], text: '埃利诺斯没压住：爆炸，阿斯特罗斯所在图的进度重置了' }, { kind: 'sanity', v: -15, text: '爆炸冲击：全团理智 -15' }] },
    elites: { ozEliteSuppress: { fx: [{ kind: 'countdown', to: 'p2_elerinon', sec: 420, text: '压制者倒下：倒计时重置' }] } }, guide: false };
  nodes2.p2_armis = { name: '阿尔米斯 · 阿斯特罗斯', type: 'main', area: 1, pos: [0.22, 0.75], need: [], dg: 'ozma_p2_armis', boss: 'p2_armis', cp: true, elites: { ozEliteChaos: { fx: [{ kind: 'sanity', v: 10 }] } },
    fx: { clear: [{ kind: 'gbuff', id: 'ozmaUnlock', p: {}, dur: 0, text: '阿斯特罗斯倒下：奥兹玛的锁血解除了' }] }, guide: { name: '阿尔米斯 · 阿斯特罗斯' } };
  nodes2.p2_throne = { name: '混沌王座 · 奥兹玛', type: 'final', area: 2, pos: [0.75, 0.5], need: [], dg: 'ozma_p2_throne', boss: 'p2_throne', cp: true, hold: 0.5, elites: { ozEliteChaos: { fx: [{ kind: 'sanity', v: 10 }] } },
    guide: { need: ['p2_armis'], hold: 0 } };
  // 全部奖励 key 写在这里（服务端只加载 raid_core / raid_ozma，没有物品表）：25 件融合装备，key 规则见 content/items/raid_ozma.js
  const GEAR = ['ruin', 'despair', 'terror', 'sacrifice', 'flame'].flatMap(s => [1, 2, 3, 4, 5].map(i => `raid_oz_${s}_${i}`));
  RAID_DEFS.ozma = {
    id: 'ozma', name: '团本 · 奥兹玛攻坚战', minLvl: 60, orderMax: 4,
    limits: { day: 1, week: 2 },
    // 12 人 3 队（官方）：队伍 / 人数档位字段含义见 raid_core.js 的 siroco 定义
    duoMax: 2, teamSize: 4, minPlayers: 4, minTeams: 2, maxTeams: 3, maxPlayers: O.MAX,
    par: nt => 1,
    // 复活币：全团共享，团队版随队数增加（官方小队模式 10 枚）；每人每图上限
    lives: { normal: nt => Math.max(6, nt * 4), guide: 10 }, perNode: { normal: 6, guide: 6 }, erosion: { normal: 60, guide: 10 },
    rest: 300, subAfter: 180, subWindow: 90, guard: { minClear: { normal: 5, guide: 0 }, maxDrop: 0.05 },
    lvl: { node: 64, final: 65 },
    // 理智值：初始 100，归零第一次进小游戏回 restore，第二次倒下；混沌等级 1~3：等级越高货币越多（chaos.cur）
    sanity: { max: 100, restore: 50 }, chaos: { max: 3, cur: [1, 1.3, 1.7] },
    scale: {
      normal: { hp: nt => (nt >= 3 ? 1 : nt === 2 ? 0.6 : 0.5), atk: 1, mech: 1, cur: 1, gear: 1, penalty: true, pen: nt => Math.min(1, nt / 3) },
      guide: { hp: 0.85, atk: 0.85, mech: 0.6, cur: 0.6, gear: 0.6, penalty: false, pen: 0 },
    },
    blurb: '奥兹玛攻坚战：毁灭 / 绝望 / 恐怖三区域各五张图（钥匙图 → 主线 / 功能 / 双剑图 → 主领主 贝利亚斯 / 提亚马特 / 卡赞），再分头压制埃利诺斯、击败阿斯特罗斯，最后挑战混沌王座的奥兹玛。理智值归零会被拉进小游戏，混沌等级越高奖励越多。12 人 3 队（引导 1 人、两人版可玩）。',
    phases: [
      { id: 1, name: '三大区域', limit: { normal: O.PHASE_LIMIT[0], guide: O.PHASE_LIMIT[0] }, goal: O.REGIONS.map(last), nodes: nodes1 },
      { id: 2, name: '混沌王座', limit: { normal: O.PHASE_LIMIT[1], guide: O.PHASE_LIMIT[1] }, goal: ['p2_throne'], nodes: nodes2 },
    ],
    // 奖励：货币「混沌的怨念」（混沌等级乘算）；P2 第二张牌 22% 融合装备（25 选 1）
    rewards: { cur: 'raid_ozma_grudge', p1: [{ cur: [4, 6] }, { cur: [3, 5] }], p2: [{ cur: [14, 18] }, { table: [[78, { cur: [6, 9] }], [22, { pick: GEAR, n: 1, gear: true }]] }] },
  };
  return { def: RAID_DEFS.ozma, GEAR, LORD };
})();
