/* =====================================================================
   奥兹玛 → 团本体系的接入层（docs/RAID_FRAMEWORK.md §奥兹玛）
   - 内容清单仍然是 ozma_core.js 的 OZMA_CORE.CONTENT（地图 / 门将 / 领主阶段 / 机制，OZMA_CORE.init / event 的独立状态机保留给它自己的测试和参考）；
   - 会话、分队、计时、倒计时 / 功能图 / 钥匙图、理智值 / 混沌等级、翻牌 / 奖励 / 拾取分配 一律走 raid_core.js（RAID_CORE），服务端的 server/modules/raid.js 才能托管；
     这个文件只做一件事：把清单翻译成 RAID_DEFS.ozma（节点图），登记进 RAID_CORE。
   - 加载顺序：ozma_core.js → raid_core.js → raid_ozma.js（src/ORDER；服务端 loadRaidCore 同序加载，在 node:vm 里没有别的全局）。
   这里只是骨架（地区链 + 钥匙图 + 王座合流）：功能图（亡者回廊 / 赛赫 / 祭坛 / 双剑图）、埃利诺斯倒计时、阿斯特罗斯三扇门、奥兹玛锁血等具体玩法由奥兹玛内容负责人
   在 RAID_DEFS.ozma 的节点上补 type: 'func' | 'timer' | 'key'、fx、needKey、elites（见 raid_core.js 头部）；不要在别处改规则参数（服务端看不到）。
   ===================================================================== */
const RAID_OZMA = (() => {
  if (typeof OZMA_CORE === 'undefined' || typeof RAID_DEFS === 'undefined') return null;
  const O = OZMA_CORE, C = O.CONTENT, nodes1 = {}, nodes2 = {};
  // 阶段 1：三大区域各一条地图链（第一张 = 钥匙图，通关得到该区域的钥匙；区域最后一张通关 = 这个区域完成），区域色调：毁灭 = 红，绝望 = 蓝紫，恐怖 = 黑绿
  O.REGIONS.forEach((rid, ri) => {
    const maps = C.areas[rid].maps;
    maps.forEach((M, i) => {
      nodes1[M.id] = { name: M.name, type: i === 0 ? 'key' : 'main', area: ri + 1, pos: [0.17 + ri * 0.33, 0.12 + i * 0.19], need: i ? [maps[i - 1].id] : [], dg: 'ozma_' + M.id, boss: M.boss,
        fx: i === 0 ? { clear: [{ kind: 'key', id: rid, text: `${C.areas[rid].name}的钥匙到手了` }] } : undefined };
      if (!nodes1[M.id].fx) delete nodes1[M.id].fx;
    });
  });
  // 阶段 2：埃利诺 / 阿尔米斯各自分头，混沌王座要两张都通关、整队一起进
  C.final.forEach((M, i) => {
    const throne = M.id === 'p2_throne';
    nodes2[M.id] = { name: M.name, type: throne ? 'final' : 'main', area: throne ? 2 : 1, pos: throne ? [0.75, 0.5] : [0.25, 0.3 + i * 0.4], need: throne ? C.final.filter(x => x.id !== M.id).map(x => x.id) : [], dg: 'ozma_' + M.id, boss: M.boss, ...(throne ? { together: true } : {}) };
  });
  const last = rid => C.areas[rid].maps[C.areas[rid].maps.length - 1].id;
  RAID_DEFS.ozma = {
    id: 'ozma', name: '团本 · 奥兹玛攻坚战', minLvl: 60, orderMax: 4,
    limits: { day: 1, week: 2 },
    // 12 人 3 队（官方）：队伍 / 人数档位字段含义见 raid_core.js 的 siroco 定义
    duoMax: 2, teamSize: 4, minPlayers: 4, minTeams: 2, maxTeams: 3, maxPlayers: O.MAX,
    par: nt => 1,
    lives: { normal: 6, guide: 3 }, perNode: { normal: 6, guide: 4 }, erosion: { normal: 60, guide: 10 },
    rest: 300, subAfter: 180, subWindow: 90, guard: { minClear: 20, maxDrop: 0.05 },
    lvl: { node: 64, final: 65 },
    // 理智值：归零第一次进小游戏回 restore，第二次倒下；混沌等级 1~3：等级越高奖励货币越多
    sanity: { max: 100, restore: 50 }, chaos: { max: 3, cur: [1, 1.25, 1.5] },
    scale: {
      normal: { hp: 1, atk: 1, mech: 1, cur: 1, gear: 1, penalty: true, pen: nt => Math.min(1, nt / 3) },
      guide: { hp: 0.85, atk: 0.85, mech: 0.6, cur: 0.6, gear: 0.6, penalty: false, pen: 0 },
    },
    blurb: '奥兹玛攻坚战（接入骨架）：毁灭 / 绝望 / 恐怖三区域各一条地图链，通关后进入埃利诺 / 阿尔米斯，最后整队挑战混沌王座。理智值与混沌等级已接入规则核心。',
    phases: [
      { id: 1, name: '三大区域', limit: { normal: O.PHASE_LIMIT[0], guide: O.PHASE_LIMIT[0] }, goal: O.REGIONS.map(last), nodes: nodes1 },
      { id: 2, name: '混沌王座', limit: { normal: O.PHASE_LIMIT[1], guide: O.PHASE_LIMIT[1] }, goal: ['p2_throne'], nodes: nodes2 },
    ],
    // 奖励占位（用现有的团本货币）：奥兹玛自己的货币 / 融合装由内容负责人填
    rewards: { cur: 'raid_petal', p1: [{ cur: [3, 4] }, { key: 'raid_immaterial', n: [1, 2] }], p2: [{ cur: [12, 16] }, { key: 'raid_immaterial', n: [2, 4] }] },
  };
  return { def: RAID_DEFS.ozma };
})();
